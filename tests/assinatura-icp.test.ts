import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, createVerify } from "node:crypto";
import forge from "node-forge";
import { PDFArray, PDFDict, PDFDocument, PDFName } from "pdf-lib";
import {
    assinarPdfComCertificadoA1,
    lerCertificadoPfx,
    pdfJaPossuiAssinatura,
    prepararPdfParaAssinaturaA3,
    validarVigenciaCertificado,
} from "../src/lib/assinatura-icp.ts";
import { gerarPdfDocumento, larguraAteProximaTab } from "../src/lib/documento-pdf.ts";
import { CONFIG_PAGINA_PADRAO } from "../src/lib/documentos.ts";

function criarCertificadosTeste(opcoes: { expirado?: boolean; serialCa?: string } = {}) {
    const keysCa = forge.pki.rsa.generateKeyPair(2048);
    const caCert = forge.pki.createCertificate();
    caCert.publicKey = keysCa.publicKey;
    caCert.serialNumber = opcoes.serialCa ?? "01";
    const agora = Date.now();
    caCert.validity.notBefore = new Date(agora - 86_400_000 * 365);
    caCert.validity.notAfter = new Date(agora + 86_400_000 * 365 * 5);
    const caAttrs = [
        { name: "commonName", value: "AC OAB ICP-Brasil Teste" },
        { name: "organizationName", value: "ICP-Brasil" },
        { name: "countryName", value: "BR" },
    ];
    caCert.setSubject(caAttrs);
    caCert.setIssuer(caAttrs);
    caCert.setExtensions([
        { name: "basicConstraints", cA: true },
        { name: "keyUsage", keyCertSign: true, cRLSign: true },
    ]);
    caCert.sign(keysCa.privateKey, forge.md.sha256.create());

    const keysLeaf = forge.pki.rsa.generateKeyPair(2048);
    const leafCert = forge.pki.createCertificate();
    leafCert.publicKey = keysLeaf.publicKey;
    leafCert.serialNumber = "020202";
    leafCert.validity.notBefore = new Date(agora - 86_400_000 * 10);
    leafCert.validity.notAfter = opcoes.expirado
        ? new Date(agora - 86_400_000)
        : new Date(agora + 86_400_000 * 365);
    leafCert.setSubject([
        { name: "commonName", value: "IAN FELIPE MENEZES SOUZA GRANJA:12345678900" },
        { name: "countryName", value: "BR" },
    ]);
    leafCert.setIssuer(caAttrs);
    leafCert.setExtensions([
        { name: "basicConstraints", cA: false },
        { name: "keyUsage", digitalSignature: true, nonRepudiation: true },
    ]);
    leafCert.sign(keysCa.privateKey, forge.md.sha256.create());

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keysLeaf.privateKey, [leafCert, caCert], "Teste123!", {
        algorithm: "aes256",
    });
    const derStr = forge.asn1.toDer(p12Asn1).getBytes();
    const pfxBytes = new Uint8Array(derStr.length);
    for (let i = 0; i < derStr.length; i++) pfxBytes[i] = derStr.charCodeAt(i);

    return { pfxBytes, leafCert, caCert };
}

function extrairByteRangeEConteudo(pdfBytes: Uint8Array): {
    byteRange: [number, number, number, number];
    contentsHex: string;
} {
    const latin1 = Buffer.from(pdfBytes).toString("latin1");
    const brMatch = latin1.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
    assert.ok(brMatch, "PDF assinado deve conter /ByteRange");
    const br: [number, number, number, number] = [
        Number(brMatch[1]),
        Number(brMatch[2]),
        Number(brMatch[3]),
        Number(brMatch[4]),
    ];
    assert.equal(br[0], 0);
    assert.equal(pdfBytes[br[1]], 0x3c, "b1 deve apontar exatamente para '<' de /Contents");
    assert.equal(pdfBytes[br[2] - 1], 0x3e, "b2 - 1 deve apontar exatamente para '>' de /Contents");
    const contentsHex = latin1.slice(br[1] + 1, br[2] - 1);
    return { byteRange: br, contentsHex };
}

describe("certificado A1 e assinatura digital ICP-Brasil PAdES-BES", () => {
    const { pfxBytes, leafCert } = criarCertificadosTeste();
    const expirado = criarCertificadosTeste({ expirado: true });

    it("lê .pfx A1 válido, extrai titular, CPF, emissor, cadeia completa e recusa senha errada", () => {
        const carregado = lerCertificadoPfx(pfxBytes, "Teste123!");
        assert.equal(carregado.info.titular, "IAN FELIPE MENEZES SOUZA GRANJA");
        assert.equal(carregado.info.cpfCnpj, "123.456.789-00");
        assert.equal(carregado.info.emissor, "AC OAB ICP-Brasil Teste");
        assert.equal(carregado.info.icpBrasil, true);
        assert.equal(carregado.info.expirado, false);
        assert.equal(carregado.info.cadeiaTotal, 2);

        assert.throws(() => lerCertificadoPfx(pfxBytes, "SenhaErrada"), /Senha/);

        const certVencido = lerCertificadoPfx(expirado.pfxBytes, "Teste123!");
        assert.equal(certVencido.info.expirado, true);
    });

    it("gera PDF vetorial completo do documento com bloco de assinatura e assina em PAdES-BES verificável por crypto nativo", async () => {
        const cert = lerCertificadoPfx(pfxBytes, "Teste123!");
        const htmlDoc = `
            <h1 style="text-align: center">EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO</h1>
            <p style="margin-left: -1cm; text-indent: 1.5cm; text-align: justify">
                <strong>MARIA DA SILVA</strong>, vem respeitosamente apresentar <em>manifestação</em> com
                <s>correção</s> e H<sub>2</sub>O / Art. 5<sup>o</sup>.
            </p>
            <ul><li>Item primeiro</li><li>Item segundo</li></ul>
            <table><tr><th>Parcela</th><th>Valor</th></tr><tr><td>01</td><td>R$ 1.250,50</td></tr></table>
            <div data-assinatura-advogado="true" data-alinhamento="center" data-mostrar-data="true" data-mostrar-selo="true"></div>
        `;

        const { pdfBytes, posicaoAssinatura } = await gerarPdfDocumento({
            titulo: "Petição Teste",
            corpoHtml: htmlDoc,
            pagina: CONFIG_PAGINA_PADRAO,
            hoje: new Date(2026, 10, 20),
        });
        assert.ok(pdfBytes.length > 1000);
        assert.ok(posicaoAssinatura.largura >= 200);

        const assinado = await assinarPdfComCertificadoA1(pdfBytes, cert, {
            posicao: posicaoAssinatura,
            razao: "Petição revisional",
            localizacao: "Petrolina-PE",
            oabTexto: "OAB/PE 61.107",
            // Relativa a agora: o certificado de teste vale de 10 dias atrás até daqui a 1 ano.
            dataAssinatura: new Date(Date.now() - 3_600_000),
        });

        assert.match(assinado.hashSha256Hex, /^[0-9a-f]{64}$/);

        const parsedDoc = await PDFDocument.load(assinado.pdfBytes);
        const acroForm = parsedDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
        assert.ok(acroForm, "Deve conter AcroForm");
        assert.equal(acroForm.get(PDFName.of("SigFlags"))?.toString(), "3");
        const fields = acroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
        assert.ok(fields && fields.size() >= 1);

        const { byteRange: [b0, b1, b2, b3], contentsHex } = extrairByteRangeEConteudo(assinado.pdfBytes);
        assert.equal(b0, 0);
        assert.equal(b2 + b3, assinado.pdfBytes.length, "ByteRange deve cobrir 100% dos bytes fora de /Contents");

        const parteAssinada = Buffer.concat([
            Buffer.from(assinado.pdfBytes.subarray(0, b1)),
            Buffer.from(assinado.pdfBytes.subarray(b2)),
        ]);
        const hashEsperadoConteudo = createHash("sha256").update(parteAssinada).digest();

        // Converte hex para DER binário calculando o tamanho exato da SEQUENCE ASN.1 raiz (antes do padding '00').
        const contentsBuf = Buffer.from(contentsHex, "hex");
        assert.equal(contentsBuf[0], 0x30, "CMS ContentInfo deve iniciar com tag SEQUENCE (0x30)");
        const lenByte = contentsBuf[1];
        let cmsTotalLen = 0;
        if ((lenByte & 0x80) === 0) {
            cmsTotalLen = 2 + lenByte;
        } else {
            const numBytesLen = lenByte & 0x7f;
            let bodyLen = 0;
            for (let i = 0; i < numBytesLen; i++) bodyLen = (bodyLen << 8) | contentsBuf[2 + i];
            cmsTotalLen = 2 + numBytesLen + bodyLen;
        }
        const cmsDerBuf = contentsBuf.subarray(0, cmsTotalLen);
        const contentInfoAsn1 = forge.asn1.fromDer(cmsDerBuf.toString("binary"));
        assert.equal(forge.asn1.derToOid((contentInfoAsn1.value[0] as forge.asn1.Asn1).value as string), "1.2.840.113549.1.7.2");

        const signedData = ((contentInfoAsn1.value[1] as forge.asn1.Asn1).value[0] as forge.asn1.Asn1);
        const signedDataFields = signedData.value as forge.asn1.Asn1[];
        const signerInfosSet = signedDataFields[signedDataFields.length - 1];
        const signerInfo = (signerInfosSet.value as forge.asn1.Asn1[])[0];
        const siFields = signerInfo.value as forge.asn1.Asn1[];

        // SignerInfo: version, sid, digestAlg, [0] signedAttrs, sigAlg, signature
        const signedAttrsImplicit = siFields[3];
        assert.equal(signedAttrsImplicit.tagClass, forge.asn1.Class.CONTEXT_SPECIFIC);
        const attrs = signedAttrsImplicit.value as forge.asn1.Asn1[];

        const acharAttr = (oid: string) =>
            attrs.find((a) => forge.asn1.derToOid((a.value[0] as forge.asn1.Asn1).value as string) === oid);

        const attrDigest = acharAttr("1.2.840.113549.1.9.4");
        assert.ok(attrDigest, "messageDigest deve estar presente");
        const digestNoCms = Buffer.from(
            ((attrDigest.value[1] as forge.asn1.Asn1).value[0] as forge.asn1.Asn1).value as string,
            "binary",
        );
        assert.deepEqual(digestNoCms, hashEsperadoConteudo);

        const attrSigCertV2 = acharAttr("1.2.840.113549.1.9.16.2.47");
        assert.ok(attrSigCertV2, "SigningCertificateV2 (PAdES / ICP-Brasil) deve estar presente");
        const scV2Seq = (attrSigCertV2.value[1] as forge.asn1.Asn1).value[0] as forge.asn1.Asn1;
        const essCertIdV2 = ((scV2Seq.value[0] as forge.asn1.Asn1).value[0] as forge.asn1.Asn1);
        const certHashNoCms = Buffer.from((essCertIdV2.value[0] as forge.asn1.Asn1).value as string, "binary");
        const leafDer = forge.asn1.toDer(forge.pki.certificateToAsn1(leafCert)).getBytes();
        const certHashEsperado = createHash("sha256").update(Buffer.from(leafDer, "binary")).digest();
        assert.deepEqual(certHashNoCms, certHashEsperado);

        // Verifica criptograficamente a assinatura RSA-SHA256 com o crypto nativo do Node!
        const attrsSetDer = Buffer.from(
            forge.asn1
                .toDer(forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs))
                .getBytes(),
            "binary",
        );
        const assinaturaBuf = Buffer.from(siFields[5].value as string, "binary");
        const verifier = createVerify("RSA-SHA256");
        verifier.update(attrsSetDer);
        assert.equal(verifier.verify(forge.pki.certificateToPem(leafCert), assinaturaBuf), true);
    });

    it("assina PDF externo pré-existente e prepara campo AcroForm vazio para token A3 / Gov.br", async () => {
        const cert = lerCertificadoPfx(pfxBytes, "Teste123!");
        const pdfBase = await PDFDocument.create();
        pdfBase.addPage([595, 842]).drawText("Documento externo");
        const bytesBase = await pdfBase.save();

        const assinadoExterno = await assinarPdfComCertificadoA1(bytesBase, cert);
        const docExt = await PDFDocument.load(assinadoExterno.pdfBytes);
        assert.equal(docExt.getPageCount(), 1);
        extrairByteRangeEConteudo(assinadoExterno.pdfBytes);

        const paraA3 = await prepararPdfParaAssinaturaA3(bytesBase);
        const docA3 = await PDFDocument.load(paraA3);
        const acroA3 = docA3.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
        assert.ok(acroA3);
        const fieldsA3 = acroA3.lookupMaybe(PDFName.of("Fields"), PDFArray);
        assert.ok(fieldsA3 && fieldsA3.size() === 1);
        const widget = fieldsA3.lookup(0, PDFDict);
        assert.equal(widget.get(PDFName.of("FT"))?.toString(), "/Sig");
        assert.equal(widget.get(PDFName.of("V")), undefined, "Campo para A3 deve estar vazio (/V ausente)");
    });

    it("recusa assinar de novo um PDF já assinado (regravar invalidaria a 1ª assinatura)", async () => {
        const cert = lerCertificadoPfx(pfxBytes, "Teste123!");
        const pdfBase = await PDFDocument.create();
        pdfBase.addPage([595, 842]).drawText("Laudo assinado pelo perito");
        const assinado = await assinarPdfComCertificadoA1(await pdfBase.save(), cert);

        assert.equal(pdfJaPossuiAssinatura(await PDFDocument.load(assinado.pdfBytes)), true);
        assert.equal(pdfJaPossuiAssinatura(pdfBase), false);
        await assert.rejects(() => assinarPdfComCertificadoA1(assinado.pdfBytes, cert), /já tem assinatura digital/);
        await assert.rejects(() => prepararPdfParaAssinaturaA3(assinado.pdfBytes), /já tem assinatura digital/);

        // Também com object streams (como Word/Acrobat costumam salvar).
        const comObjStreams = await (await PDFDocument.load(assinado.pdfBytes)).save({ useObjectStreams: true });
        await assert.rejects(() => assinarPdfComCertificadoA1(comObjStreams, cert), /já tem assinatura digital/);
    });

    it("recusa certificado vencido ou ainda não vigente na hora de assinar", async () => {
        const pdfBase = await PDFDocument.create();
        pdfBase.addPage([595, 842]);
        const bytes = await pdfBase.save();

        const vencido = lerCertificadoPfx(expirado.pfxBytes, "Teste123!");
        await assert.rejects(() => assinarPdfComCertificadoA1(bytes, vencido), /Certificado vencido/);

        const valido = lerCertificadoPfx(pfxBytes, "Teste123!");
        await assert.rejects(
            () => assinarPdfComCertificadoA1(bytes, valido, { dataAssinatura: new Date(Date.now() - 86_400_000 * 30) }),
            /só passa a valer/,
        );
        assert.throws(() => validarVigenciaCertificado(vencido.cert, new Date()), /vencido/);
    });

    it("mantém na cadeia a AC com o mesmo número de série do titular", () => {
        const mesmoSerial = criarCertificadosTeste({ serialCa: "020202" });
        const carregado = lerCertificadoPfx(mesmoSerial.pfxBytes, "Teste123!");
        assert.equal(carregado.info.cadeiaTotal, 2);
        assert.equal(carregado.chain[1].serialNumber, "020202");
        assert.equal(carregado.chain[1].subject.getField("CN")?.value, "AC OAB ICP-Brasil Teste");
    });
});

describe("tabulação no PDF gerado", () => {
    it("vai até a próxima parada (1,25 cm por padrão) e pula parada colada", () => {
        const passo = (1.25 / 2.54) * 72;
        assert.ok(Math.abs(larguraAteProximaTab(0, passo) - passo) < 1e-6);
        assert.ok(Math.abs(larguraAteProximaTab(10, passo) - (passo - 10)) < 1e-6);
        // A 0,5 pt da parada: pula para a seguinte, como o navegador.
        assert.ok(Math.abs(larguraAteProximaTab(passo - 0.5, passo) - (passo + 0.5)) < 1e-6);
        // Parada personalizada (tab-size: 8cm).
        const oitoCm = (8 / 2.54) * 72;
        assert.ok(Math.abs(larguraAteProximaTab(20, oitoCm) - (oitoCm - 20)) < 1e-6);
        // 1ª linha com recuo deslocado começa antes da origem.
        assert.ok(Math.abs(larguraAteProximaTab(-20, passo) - 20) < 1e-6);
    });

    it("gera o PDF com Tab no início do parágrafo e tab-size próprio sem erro", async () => {
        const { pdfBytes } = await gerarPdfDocumento({
            titulo: "Tabs",
            corpoHtml:
                '<p>\tPrimeira linha recuada com Tab.</p><p style="tab-size: 8cm">Nome:\tFulano\tCPF</p>',
            pagina: CONFIG_PAGINA_PADRAO,
        });
        const doc = await PDFDocument.load(pdfBytes);
        assert.equal(doc.getPageCount(), 1);
    });
});
