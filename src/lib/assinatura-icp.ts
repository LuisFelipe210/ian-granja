/**
 * Assinatura digital ICP-Brasil (PAdES-BES / ETSI.CAdES.detached) 100% no navegador
 * usando certificado A1 (.pfx/.p12) com `node-forge` + `pdf-lib`, e preparação de campo
 * `/Sig` vazio para assinatura externa em token A3, Gov.br ou PJeOffice.
 *
 * Módulo puro (sem DOM): roda no navegador e em `node --test`.
 */
import forge from "node-forge";
import {
    PDFArray,
    PDFDict,
    PDFDocument,
    PDFHexString,
    PDFName,
    PDFNumber,
    PDFString,
    StandardFonts,
    rgb,
} from "pdf-lib";

export interface InfoCertificadoIcp {
    titular: string;
    cpfCnpj: string;
    emissor: string;
    serial: string;
    validoDe: Date;
    validoAte: Date;
    expirado: boolean;
    aindaNaoValido: boolean;
    icpBrasil: boolean;
    cadeiaTotal: number;
}

export interface CertificadoA1Carregado {
    info: InfoCertificadoIcp;
    privateKey: forge.pki.rsa.PrivateKey;
    cert: forge.pki.Certificate;
    chain: forge.pki.Certificate[];
}

/** Retângulo da assinatura no PDF (pontos PDF, origem no canto inferior esquerdo da página). */
export interface PosicaoAssinaturaPdf {
    paginaIndex: number;
    x: number;
    y: number;
    largura: number;
    altura: number;
}

export interface OpcoesAssinaturaPdf {
    razao?: string;
    localizacao?: string;
    posicao?: PosicaoAssinaturaPdf;
    desenharSelo?: boolean;
    rubricaDataUrl?: string;
    oabTexto?: string;
    dataAssinatura?: Date;
}

export interface ResultadoAssinaturaPdf {
    pdfBytes: Uint8Array;
    hashSha256Hex: string;
    assinadoEm: Date;
    info: InfoCertificadoIcp;
}

const CP1252_EXTRA: Record<number, number> = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
};

/** Garante que `pdf-lib` com fontes padrão (WinAnsi) nunca lance erro com caracteres especiais. */
export function normalizarWinAnsi(texto: string): string {
    const pre = texto
        .replace(/[\u00A0\u202F\t]/g, " ")
        .replace(/\u2212/g, "-")
        .replace(/≤/g, "<=")
        .replace(/≥/g, ">=")
        .replace(/→/g, "->")
        .replace(/←/g, "<-");
    let out = "";
    for (const ch of pre) {
        const cp = ch.codePointAt(0) ?? 0x20;
        if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || cp in CP1252_EXTRA) {
            out += ch;
        } else if (cp >= 0x20) {
            out += " ";
        }
    }
    return out;
}

/** Converte `data:image/...;base64,...` para bytes e detecta PNG vs JPEG. */
export function decodificarDataUrlImagem(dataUrl?: string): { tipo: "png" | "jpeg"; bytes: Uint8Array } | null {
    if (!dataUrl) return null;
    const m = dataUrl.trim().match(/^data:image\/(png|jpeg|jpg);base64,([a-zA-Z0-9+/=]+)$/i);
    if (!m) return null;
    const bin = forge.util.decode64(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return {
        tipo: m[1].toLowerCase() === "png" ? "png" : "jpeg",
        bytes,
    };
}

function uint8ParaForgeBytes(bytes: Uint8Array): string {
    let s = "";
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return s;
}

function forgeBytesParaUint8(bytesStr: string): Uint8Array {
    const out = new Uint8Array(bytesStr.length);
    for (let i = 0; i < bytesStr.length; i++) out[i] = bytesStr.charCodeAt(i) & 0xff;
    return out;
}

function formatarDocumentoBrasileiro(digitos: string): string {
    if (digitos.length === 11) {
        return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
    }
    if (digitos.length === 14) {
        return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
    }
    return digitos;
}

function textoCampoCert(attrs: forge.pki.CertificateField[], nomes: string[]): string {
    for (const nome of nomes) {
        const f = attrs.find((a) => a.shortName === nome || a.name === nome);
        if (typeof f?.value === "string" && f.value.trim()) return f.value.trim();
    }
    return "";
}

function extrairCpfIcpOid(cert: forge.pki.Certificate): string {
    const san = cert.getExtension("subjectAltName") as { altNames?: Array<{ type: number; value?: unknown }> } | null;
    const raw = JSON.stringify(san ?? {});
    const m = raw.match(/\d{8}(\d{11})/);
    return m ? formatarDocumentoBrasileiro(m[1]) : "";
}

function derCertificado(c: forge.pki.Certificate): string {
    return forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes();
}

function ehAutoAssinado(c: forge.pki.Certificate): boolean {
    try {
        return c.subject.hash === c.issuer.hash;
    } catch {
        return false;
    }
}

function ordenarCadeiaCertificados(leaf: forge.pki.Certificate, todos: forge.pki.Certificate[]): forge.pki.Certificate[] {
    const cadeia: forge.pki.Certificate[] = [leaf];
    // Remove só cópias do MESMO certificado (DER idêntico): o número de série é único apenas por emissor,
    // então uma AC intermediária/raiz pode ter o mesmo serial do titular e precisa continuar na cadeia.
    const vistos = new Set<string>([derCertificado(leaf)]);
    const restantes: forge.pki.Certificate[] = [];
    for (const c of todos) {
        const der = derCertificado(c);
        if (vistos.has(der)) continue;
        vistos.add(der);
        restantes.push(c);
    }
    let atual = leaf;
    for (let passo = 0; passo < restantes.length + 2; passo++) {
        if (ehAutoAssinado(atual)) break;
        const idx = restantes.findIndex((cand) => {
            try {
                return cand.subject.hash === atual.issuer.hash;
            } catch {
                return false;
            }
        });
        if (idx === -1) break;
        const [proximo] = restantes.splice(idx, 1);
        cadeia.push(proximo);
        atual = proximo;
    }
    return [...cadeia, ...restantes];
}

/**
 * Lê um arquivo PKCS#12 (.pfx / .p12) do certificado A1 em memória (100% client-side),
 * extraindo a chave privada RSA, o certificado do titular e toda a cadeia ICP-Brasil.
 */
export function lerCertificadoPfx(pfxBytes: Uint8Array, senha: string): CertificadoA1Carregado {
    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
        const der = forge.util.createBuffer(uint8ParaForgeBytes(pfxBytes));
        const asn1Obj = forge.asn1.fromDer(der);
        p12 = forge.pkcs12.pkcs12FromAsn1(asn1Obj, false, senha);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/password|mac/i.test(msg)) {
            throw new Error("Senha do certificado A1 incorreta.");
        }
        throw new Error("Arquivo de certificado (.pfx/.p12) inválido ou corrompido.");
    }

    const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];
    const plain = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? [];
    const keyBag = [...shrouded, ...plain].find((b) => Boolean(b.key));
    const privateKey = keyBag?.key;
    if (!privateKey || typeof privateKey.sign !== "function") {
        throw new Error("Este arquivo .pfx/.p12 não contém uma chave privada RSA válida.");
    }

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
    const certs = certBags.map((b) => b.cert).filter((c): c is forge.pki.Certificate => Boolean(c));
    if (certs.length === 0) {
        throw new Error("Nenhum certificado encontrado dentro do arquivo .pfx/.p12.");
    }

    const leafPorChave = certs.find((c) => {
        const pub = c.publicKey as forge.pki.rsa.PublicKey | undefined;
        return Boolean(pub?.n && privateKey.n && pub.n.compareTo(privateKey.n) === 0);
    });
    const keyLocalId = keyBag.attributes?.localKeyId?.[0];
    const leafPorId = keyLocalId
        ? certBags.find((b) => b.attributes?.localKeyId?.[0] === keyLocalId)?.cert
        : undefined;
    const leaf = leafPorChave ?? leafPorId ?? certs[0];
    const chain = ordenarCadeiaCertificados(leaf, certs);

    const cnBruto = textoCampoCert(leaf.subject.attributes, ["CN", "commonName", "O"]) || "Titular do certificado";
    const mCnDoc = cnBruto.match(/^(.+?):(\d{11}|\d{14})$/);
    const titular = (mCnDoc ? mCnDoc[1] : cnBruto).trim();
    const cpfCnpj = mCnDoc ? formatarDocumentoBrasileiro(mCnDoc[2]) : extrairCpfIcpOid(leaf);
    const emissor = textoCampoCert(leaf.issuer.attributes, ["CN", "commonName", "O", "organizationName"]) || "Autoridade Certificadora";

    const textoCadeia = chain
        .map((c) =>
            [...c.subject.attributes, ...c.issuer.attributes].map((a) => String(a.value ?? "")).join(" "),
        )
        .join(" ");
    const icpBrasil = /icp-?brasil|\biti\b|serpro|certisign|soluti|valid|safeweb|\bac\s+oab\b|autoridade certificadora/i.test(
        textoCadeia,
    );

    const agora = new Date();
    const validoDe = leaf.validity.notBefore;
    const validoAte = leaf.validity.notAfter;

    return {
        info: {
            titular,
            cpfCnpj,
            emissor,
            serial: leaf.serialNumber,
            validoDe,
            validoAte,
            expirado: agora.getTime() > validoAte.getTime(),
            aindaNaoValido: agora.getTime() < validoDe.getTime(),
            icpBrasil,
            cadeiaTotal: chain.length,
        },
        privateKey,
        cert: leaf,
        chain,
    };
}

function extrairIssuerESerialAsn1(cert: forge.pki.Certificate): {
    issuerAsn1: forge.asn1.Asn1;
    serialAsn1: forge.asn1.Asn1;
} {
    const certAsn1 = forge.pki.certificateToAsn1(cert);
    const tbs = (certAsn1.value as forge.asn1.Asn1[])[0];
    const tbsCampos = tbs.value as forge.asn1.Asn1[];
    const temVersao =
        tbsCampos[0]?.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && tbsCampos[0]?.type === 0;
    return {
        serialAsn1: temVersao ? tbsCampos[1] : tbsCampos[0],
        issuerAsn1: temVersao ? tbsCampos[3] : tbsCampos[2],
    };
}

const OID_CONTENT_TYPE = "1.2.840.113549.1.9.3";
const OID_MESSAGE_DIGEST = "1.2.840.113549.1.9.4";
const OID_SIGNING_TIME = "1.2.840.113549.1.9.5";
const OID_SIGNING_CERTIFICATE_V2 = "1.2.840.113549.1.9.16.2.47";
const OID_SHA256 = forge.pki.oids.sha256;
const OID_SHA256_RSA = forge.pki.oids.sha256WithRSAEncryption;
const OID_PKCS7_DATA = "1.2.840.113549.1.7.1";
const OID_PKCS7_SIGNED_DATA = "1.2.840.113549.1.7.2";

/**
 * Monta o atributo `SigningCertificateV2` (RFC 5035, OID 1.2.840.113549.1.9.16.2.47)
 * obrigatório no perfil ICP-Brasil PAdES-BES (DOC-ICP-15.03 / ETSI EN 319 142-1).
 */
export function montarSigningCertificateV2Asn1(cert: forge.pki.Certificate): forge.asn1.Asn1 {
    const { asn1 } = forge;
    const certDer = asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const md = forge.md.sha256.create();
    md.update(certDer);
    const certHashBytes = md.digest().getBytes();
    const { issuerAsn1, serialAsn1 } = extrairIssuerESerialAsn1(cert);

    // ESSCertIDv2: hashAlgorithm DEFAULT id-sha256 (omitido por regra DER).
    const essCertIdV2 = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, certHashBytes),
        // IssuerSerial
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            // GeneralNames -> directoryName [4] EXPLICIT Name
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                asn1.create(asn1.Class.CONTEXT_SPECIFIC, 4, true, [issuerAsn1]),
            ]),
            serialAsn1,
        ]),
    ]);

    // SigningCertificateV2
    return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [essCertIdV2]),
    ]);
}

function criarAtributoCms(oid: string, valor: forge.asn1.Asn1): forge.asn1.Asn1 {
    const { asn1 } = forge;
    return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(oid).getBytes()),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [valor]),
    ]);
}

/**
 * Gera envelope CMS/PKCS#7 destacado (DER) compatível com PAdES-BES (`ETSI.CAdES.detached`):
 * hash SHA-256 dos bytes cobertos pelo ByteRange + SigningCertificateV2 + cadeia completa.
 */
export function assinarBytesPadesBes(
    bytesParaAssinar: Uint8Array,
    certCarregado: CertificadoA1Carregado,
    dataAssinatura: Date = new Date(),
): Uint8Array {
    const { asn1, md, pki } = forge;

    const mdConteudo = md.sha256.create();
    mdConteudo.update(uint8ParaForgeBytes(bytesParaAssinar));
    const digestConteudo = mdConteudo.digest().getBytes();

    const tempoVal =
        dataAssinatura >= new Date("1950-01-01T00:00:00Z") &&
        dataAssinatura < new Date("2050-01-01T00:00:00Z")
            ? asn1.create(asn1.Class.UNIVERSAL, asn1.Type.UTCTIME, false, asn1.dateToUtcTime(dataAssinatura))
            : asn1.create(
                  asn1.Class.UNIVERSAL,
                  asn1.Type.GENERALIZEDTIME,
                  false,
                  asn1.dateToGeneralizedTime(dataAssinatura),
              );

    const attrsBrutos: forge.asn1.Asn1[] = [
        criarAtributoCms(
            OID_CONTENT_TYPE,
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(OID_PKCS7_DATA).getBytes()),
        ),
        criarAtributoCms(
            OID_MESSAGE_DIGEST,
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, digestConteudo),
        ),
        criarAtributoCms(OID_SIGNING_TIME, tempoVal),
        criarAtributoCms(OID_SIGNING_CERTIFICATE_V2, montarSigningCertificateV2Asn1(certCarregado.cert)),
    ];

    // Ordenação canônica DER para SET OF Attribute (X.690 11.6).
    const attrsOrdenados = attrsBrutos
        .map((node) => ({ node, der: asn1.toDer(node).getBytes() }))
        .sort((a, b) => (a.der < b.der ? -1 : a.der > b.der ? 1 : 0))
        .map((item) => item.node);

    const setParaAssinar = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, attrsOrdenados);
    const mdAttrs = md.sha256.create();
    mdAttrs.update(asn1.toDer(setParaAssinar).getBytes());
    const assinaturaBytes = certCarregado.privateKey.sign(mdAttrs, "RSASSA-PKCS1-V1_5");

    const { issuerAsn1, serialAsn1 } = extrairIssuerESerialAsn1(certCarregado.cert);

    const sha256AlgId = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(OID_SHA256).getBytes()),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ""),
    ]);

    const sha256RsaAlgId = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(OID_SHA256_RSA).getBytes()),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ""),
    ]);

    const signerInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(1).getBytes()),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [issuerAsn1, serialAsn1]),
        sha256AlgId,
        asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, attrsOrdenados),
        sha256RsaAlgId,
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, assinaturaBytes),
    ]);

    const certsAsn1 = certCarregado.chain.map((c) => pki.certificateToAsn1(c));

    const signedData = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(1).getBytes()),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [sha256AlgId]),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(OID_PKCS7_DATA).getBytes()),
        ]),
        asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, certsAsn1),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [signerInfo]),
    ]);

    const contentInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(OID_PKCS7_SIGNED_DATA).getBytes()),
        asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [signedData]),
    ]);

    return forgeBytesParaUint8(asn1.toDer(contentInfo).getBytes());
}

const BYTERANGE_PLACEHOLDER_STR = "[ 0 1000000001 1000000002 1000000003 ]";
/** 16 KB reservados em hex para o envelope CMS + cadeia completa ICP-Brasil. */
const TAMANHO_HEX_CONTEUDO = 32768;

function textoParaAscii(str: string): Uint8Array {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
    return out;
}

function procurarSequenciaBytes(palheiro: Uint8Array, agulha: Uint8Array, inicio = 0): number {
    const limite = palheiro.length - agulha.length;
    for (let i = inicio; i <= limite; i++) {
        let ok = true;
        for (let j = 0; j < agulha.length; j++) {
            if (palheiro[i + j] !== agulha[j]) {
                ok = false;
                break;
            }
        }
        if (ok) return i;
    }
    return -1;
}

function garantirAcroFormEWidget(
    pdfDoc: PDFDocument,
    paginaIndex: number,
    retangulo: [number, number, number, number],
    nomeCampo: string,
    valorRef?: ReturnType<PDFDocument["context"]["register"]>,
    sigFlags?: number,
) {
    const pagina = pdfDoc.getPage(paginaIndex);
    const [x1, y1, x2, y2] = retangulo;
    const largura = Math.max(10, x2 - x1);
    const altura = Math.max(10, y2 - y1);

    // Aparência transparente para tornar toda a área clicável sem cobrir o texto/rubrica da página.
    const apStream = pdfDoc.context.stream(new Uint8Array(0), {
        Type: "XObject",
        Subtype: "Form",
        BBox: [0, 0, largura, altura],
    });
    const apRef = pdfDoc.context.register(apStream);

    const widgetDict = pdfDoc.context.obj({
        Type: "Annot",
        Subtype: "Widget",
        FT: "Sig",
        Rect: [x1, y1, x2, y2],
        T: PDFString.of(normalizarWinAnsi(nomeCampo)),
        F: 4,
        P: pagina.ref,
        AP: { N: apRef },
    });
    if (valorRef) {
        widgetDict.set(PDFName.of("V"), valorRef);
    }
    const widgetRef = pdfDoc.context.register(widgetDict);

    let annots = pagina.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (!annots) {
        annots = pdfDoc.context.obj([]);
        pagina.node.set(PDFName.of("Annots"), annots);
    }
    annots.push(widgetRef);

    let acroForm = pdfDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
    if (!acroForm) {
        acroForm = pdfDoc.context.obj({ Fields: [] });
        const acroRef = pdfDoc.context.register(acroForm);
        pdfDoc.catalog.set(PDFName.of("AcroForm"), acroRef);
    }
    if (sigFlags !== undefined) {
        acroForm.set(PDFName.of("SigFlags"), PDFNumber.of(sigFlags));
    }
    let fields = acroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
    if (!fields) {
        fields = pdfDoc.context.obj([]);
        acroForm.set(PDFName.of("Fields"), fields);
    }
    fields.push(widgetRef);
}

function posicaoPadraoRodape(pdfDoc: PDFDocument, custom?: PosicaoAssinaturaPdf): PosicaoAssinaturaPdf {
    const total = pdfDoc.getPageCount();
    const paginaIndex = custom && custom.paginaIndex >= 0 && custom.paginaIndex < total ? custom.paginaIndex : total - 1;
    const { width } = pdfDoc.getPage(paginaIndex).getSize();
    if (custom) {
        return {
            paginaIndex,
            x: Math.max(18, Math.min(width - custom.largura - 18, custom.x)),
            y: Math.max(18, custom.y),
            largura: custom.largura,
            altura: custom.altura,
        };
    }
    const largura = Math.min(250, width - 72);
    return {
        paginaIndex,
        x: width - largura - 36,
        y: 38,
        largura,
        altura: 58,
    };
}

function formatarDataHoraBr(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function desenharCarimboIcpPdf(
    pdfDoc: PDFDocument,
    pos: PosicaoAssinaturaPdf,
    info: InfoCertificadoIcp,
    dataAssinatura: Date,
    opcoes: OpcoesAssinaturaPdf,
) {
    const page = pdfDoc.getPage(pos.paginaIndex);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const seloLarg = Math.max(210, Math.min(275, pos.largura));
    const seloAlt = Math.max(50, Math.min(62, pos.altura));
    const sx = pos.x + (pos.largura - seloLarg) / 2;
    const sy = pos.y;

    page.drawRectangle({
        x: sx,
        y: sy,
        width: seloLarg,
        height: seloAlt,
        color: rgb(0.985, 0.978, 0.96),
        borderColor: rgb(0.024, 0.071, 0.216),
        borderWidth: 0.75,
    });
    page.drawRectangle({
        x: sx,
        y: sy,
        width: 3,
        height: seloAlt,
        color: rgb(0.545, 0.427, 0.231),
    });

    let textoX = sx + 8;
    const imgInfo = decodificarDataUrlImagem(opcoes.rubricaDataUrl);
    if (imgInfo) {
        try {
            const img = imgInfo.tipo === "png" ? await pdfDoc.embedPng(imgInfo.bytes) : await pdfDoc.embedJpg(imgInfo.bytes);
            const maxW = 54;
            const maxH = seloAlt - 12;
            const esc = Math.min(maxW / img.width, maxH / img.height, 1);
            const iw = img.width * esc;
            const ih = img.height * esc;
            page.drawImage(img, {
                x: sx + 7,
                y: sy + (seloAlt - ih) / 2,
                width: iw,
                height: ih,
            });
            textoX = sx + iw + 12;
        } catch {
            // Imagem incompatível não impede a assinatura criptográfica.
        }
    }

    const largDisp = sx + seloLarg - textoX - 6;
    const truncar = (txt: string, tam: number, fonte: typeof fontBold) => {
        let s = normalizarWinAnsi(txt);
        while (s.length > 3 && fonte.widthOfTextAtSize(s, tam) > largDisp) {
            s = `${s.slice(0, -4)}...`;
        }
        return s;
    };

    const yTop = sy + seloAlt - 11;
    page.drawText(truncar("ASSINADO DIGITALMENTE · ICP-BRASIL", 6.2, fontBold), {
        x: textoX,
        y: yTop,
        size: 6.2,
        font: fontBold,
        color: rgb(0.545, 0.427, 0.231),
    });
    page.drawText(truncar(info.titular, 7.8, fontBold), {
        x: textoX,
        y: yTop - 10,
        size: 7.8,
        font: fontBold,
        color: rgb(0.024, 0.071, 0.216),
    });
    const linhaIdent = [opcoes.oabTexto, info.cpfCnpj ? `CPF/CNPJ ${info.cpfCnpj}` : ""].filter(Boolean).join(" · ");
    if (linhaIdent) {
        page.drawText(truncar(linhaIdent, 6.4, fontReg), {
            x: textoX,
            y: yTop - 19,
            size: 6.4,
            font: fontReg,
            color: rgb(0.15, 0.19, 0.28),
        });
    }
    page.drawText(
        truncar(`${formatarDataHoraBr(dataAssinatura)} · ${info.emissor}`, 6, fontReg),
        {
            x: textoX,
            y: yTop - (linhaIdent ? 28 : 20),
            size: 6,
            font: fontReg,
            color: rgb(0.28, 0.32, 0.42),
        },
    );
    page.drawText(truncar("Validar em validar.iti.gov.br", 5.8, fontReg), {
        x: textoX,
        y: sy + 5,
        size: 5.8,
        font: fontReg,
        color: rgb(0.35, 0.39, 0.48),
    });
}

function dicionarioEhAssinatura(d: PDFDict): boolean {
    if (d.has(PDFName.of("ByteRange"))) return true;
    // Campo de assinatura já preenchido (/FT /Sig com /V), mesmo que o /Sig seja objeto direto.
    return d.get(PDFName.of("FT")) === PDFName.of("Sig") && d.has(PDFName.of("V"));
}

/**
 * `true` se o PDF já tem alguma assinatura digital (ou carimbo do tempo) aplicada.
 * Este módulo regrava o arquivo inteiro ao assinar, o que invalidaria assinaturas anteriores.
 */
export function pdfJaPossuiAssinatura(pdfDoc: PDFDocument): boolean {
    for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
        if (obj instanceof PDFDict && dicionarioEhAssinatura(obj)) return true;
    }
    return false;
}

function garantirPdfAssinavel(pdfDoc: PDFDocument) {
    if (pdfDoc.isEncrypted) {
        throw new Error("Este PDF está protegido por senha/criptografia. Remova a proteção antes de assinar.");
    }
    if (pdfJaPossuiAssinatura(pdfDoc)) {
        throw new Error(
            "Este PDF já tem assinatura digital. Assinar aqui invalidaria a assinatura existente — use um assinador com coassinatura (Assinador ITI, Adobe Acrobat ou PJeOffice).",
        );
    }
}

/** Recusa certificado vencido ou ainda não válido na data/hora da assinatura. */
export function validarVigenciaCertificado(cert: forge.pki.Certificate, quando: Date): void {
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    if (quando.getTime() > cert.validity.notAfter.getTime()) {
        throw new Error(
            `Certificado vencido em ${fmt(cert.validity.notAfter)}. A assinatura não teria validade jurídica — renove o certificado A1.`,
        );
    }
    if (quando.getTime() < cert.validity.notBefore.getTime()) {
        throw new Error(`Este certificado só passa a valer em ${fmt(cert.validity.notBefore)}.`);
    }
}

/**
 * Assina um PDF com certificado digital A1 ICP-Brasil (PAdES-BES / `ETSI.CAdES.detached`).
 * Injeta o dicionário `/Sig`, reserva o `/Contents`, grava `/ByteRange` exato e assina com SHA-256.
 * Recusa PDF criptografado ou já assinado, e certificado fora da validade.
 */
export async function assinarPdfComCertificadoA1(
    pdfBytes: Uint8Array,
    certCarregado: CertificadoA1Carregado,
    opcoes: OpcoesAssinaturaPdf = {},
): Promise<ResultadoAssinaturaPdf> {
    const dataAssinatura = opcoes.dataAssinatura ?? new Date();
    validarVigenciaCertificado(certCarregado.cert, dataAssinatura);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    garantirPdfAssinavel(pdfDoc);
    if (pdfDoc.getPageCount() === 0) {
        throw new Error("O PDF não possui nenhuma página para assinar.");
    }

    const pos = posicaoPadraoRodape(pdfDoc, opcoes.posicao);
    if (opcoes.desenharSelo !== false) {
        await desenharCarimboIcpPdf(pdfDoc, pos, certCarregado.info, dataAssinatura, opcoes);
    }

    const sigDict = pdfDoc.context.obj({
        Type: "Sig",
        Filter: "Adobe.PPKLite",
        SubFilter: "ETSI.CAdES.detached",
        ByteRange: [
            PDFNumber.of(0),
            PDFNumber.of(1000000001),
            PDFNumber.of(1000000002),
            PDFNumber.of(1000000003),
        ],
        Contents: PDFHexString.of("0".repeat(TAMANHO_HEX_CONTEUDO)),
        Name: PDFString.of(normalizarWinAnsi(certCarregado.info.titular)),
        Reason: PDFString.of(normalizarWinAnsi(opcoes.razao || "Assinatura digital de documento jurídico")),
        Location: PDFString.of(normalizarWinAnsi(opcoes.localizacao || "Brasil")),
        M: PDFString.fromDate(dataAssinatura),
    });
    const sigRef = pdfDoc.context.register(sigDict);

    garantirAcroFormEWidget(
        pdfDoc,
        pos.paginaIndex,
        [pos.x, pos.y, pos.x + pos.largura, pos.y + pos.altura],
        `Assinatura_Advogado_${dataAssinatura.getTime()}`,
        sigRef,
        3,
    );

    const pdfComPlaceholder = await pdfDoc.save({ useObjectStreams: false });
    const saida = new Uint8Array(pdfComPlaceholder);

    const agulhaByteRange = textoParaAscii(BYTERANGE_PLACEHOLDER_STR);
    const agulhaConteudo = textoParaAscii(`<${"0".repeat(TAMANHO_HEX_CONTEUDO)}>`);

    const brInicio = procurarSequenciaBytes(saida, agulhaByteRange);
    const ctInicio = procurarSequenciaBytes(saida, agulhaConteudo);
    if (brInicio === -1 || ctInicio === -1) {
        throw new Error("Não foi possível preparar os marcadores criptográficos do PDF.");
    }

    const b1 = ctInicio;
    const b2 = ctInicio + agulhaConteudo.length;
    const b3 = saida.length - b2;
    const novaFaixa = `[ 0 ${b1} ${b2} ${b3}`;
    if (novaFaixa.length + 2 > agulhaByteRange.length) {
        throw new Error("PDF grande demais para o marcador de ByteRange.");
    }
    const faixaPreenchida = `${novaFaixa.padEnd(agulhaByteRange.length - 1, " ")}]`;
    saida.set(textoParaAscii(faixaPreenchida), brInicio);

    const bytesParaAssinar = new Uint8Array(b1 + b3);
    bytesParaAssinar.set(saida.subarray(0, b1), 0);
    bytesParaAssinar.set(saida.subarray(b2), b1);

    const cmsDer = assinarBytesPadesBes(bytesParaAssinar, certCarregado, dataAssinatura);
    let hexCms = "";
    for (let i = 0; i < cmsDer.length; i++) {
        hexCms += cmsDer[i].toString(16).toUpperCase().padStart(2, "0");
    }
    if (hexCms.length > TAMANHO_HEX_CONTEUDO) {
        throw new Error("A cadeia do certificado A1 excedeu o espaço reservado no PDF (16 KB).");
    }

    // Conteúdo preenchido com zeros à direita dentro de `<...>`, como exige a especificação PDF 1.7.
    const hexFinal = hexCms.padEnd(TAMANHO_HEX_CONTEUDO, "0");
    saida.set(textoParaAscii(hexFinal), ctInicio + 1);

    const mdFinal = forge.md.sha256.create();
    mdFinal.update(uint8ParaForgeBytes(saida));

    return {
        pdfBytes: saida,
        hashSha256Hex: mdFinal.digest().toHex(),
        assinadoEm: dataAssinatura,
        info: certCarregado.info,
    };
}

/**
 * Prepara um PDF com campo AcroForm de assinatura digital (`/FT /Sig`) vazio no local da assinatura,
 * pronto para assinar externamente no Assinador Gov.br, PJeOffice, Assinador Serpro ou Adobe (A3).
 */
export async function prepararPdfParaAssinaturaA3(
    pdfBytes: Uint8Array,
    opcoes: Omit<OpcoesAssinaturaPdf, "desenharSelo"> & { desenharMoldura?: boolean } = {},
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    garantirPdfAssinavel(pdfDoc);
    if (pdfDoc.getPageCount() === 0) {
        throw new Error("O PDF não possui nenhuma página.");
    }
    const pos = posicaoPadraoRodape(pdfDoc, opcoes.posicao);

    if (opcoes.desenharMoldura !== false) {
        const page = pdfDoc.getPage(pos.paginaIndex);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        page.drawRectangle({
            x: pos.x,
            y: pos.y,
            width: pos.largura,
            height: pos.altura,
            borderColor: rgb(0.545, 0.427, 0.231),
            borderWidth: 0.7,
            borderDashArray: [3, 2],
            color: rgb(0.99, 0.986, 0.975),
        });
        page.drawText(normalizarWinAnsi("Espaço reservado para assinatura digital ICP-Brasil (A3 / Gov.br)"), {
            x: pos.x + 8,
            y: pos.y + pos.altura / 2 - 3,
            size: 6.5,
            font,
            color: rgb(0.35, 0.39, 0.48),
        });
    }

    garantirAcroFormEWidget(
        pdfDoc,
        pos.paginaIndex,
        [pos.x, pos.y, pos.x + pos.largura, pos.y + pos.altura],
        `Campo_Assinatura_Advogado_${Date.now()}`,
        undefined,
        1,
    );

    return pdfDoc.save({ useObjectStreams: false });
}
