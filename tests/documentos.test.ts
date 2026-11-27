import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    CONFIG_PAGINA_PADRAO,
    PREDEFINICOES_MARGEM,
    acharCampoConhecido,
    agruparDocumentosPorCliente,
    dataPorExtenso,
    estiloPaginaDocumento,
    geometriaDaPagina,
    normalizarConfigPagina,
    resumoConfigPagina,
    sanitizarHtmlDocumento,
    extrairCampos,
    htmlParaTextoSimples,
    montarArquivoWord,
    montarHtmlImpressaoDocumento,
    nomeArquivoDocumento,
    normalizarChaveCampo,
    preencherModelo,
    valorPorExtenso,
    valoresIniciaisCampos,
} from "../src/lib/documentos.ts";
import { sanitizarDocumentoPayload, sanitizarModeloPayload, type CalculoSalvo } from "../src/lib/revisional-db.ts";

const calculoExemplo = {
    id: "c1",
    cliente_nome: "Maria Exemplo da Silva",
    processo_global: "0000000-00.2026.8.17.0000",
    banco: "Banco Exemplo S.A.",
    documento_contrato: "CCB 123",
    modalidade_nome: "Veículos PF",
    valor_financiado: 30000,
    valor_parcela: 1250.5,
    parcelas: 48,
    contrato_am: 3.2,
    media_am: 1.9,
    valor_total_acao: 12345.67,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    dados_completos: {
        origemDjen: { tribunal: "TJPE", orgao: "2ª Vara Cível da Comarca de Petrolina", classe: "Procedimento Comum" },
    },
} as unknown as CalculoSalvo;

const HOJE = new Date(2026, 10, 20);

describe("campos entre colchetes", () => {
    it("extrai campos únicos na ordem, ignorando [...] e variações de acento/caixa", () => {
        const html =
            "<p>[Nome do Cliente], processo nº [número do processo]. Citação [...] e [nome do cliente] de novo.</p><p>[CPF do cliente]</p>";
        assert.deepEqual(extrairCampos(html), ["Nome do Cliente", "número do processo", "CPF do cliente"]);
    });

    it("reconhece apelidos e ignora acentos", () => {
        assert.equal(acharCampoConhecido("Cliente")?.rotulo, "nome do cliente");
        assert.equal(acharCampoConhecido("NUMERO DO PROCESSO")?.rotulo, "número do processo");
        assert.equal(acharCampoConhecido("nº do processo")?.rotulo, "número do processo");
        assert.equal(acharCampoConhecido("banco")?.rotulo, "parte contrária");
        assert.equal(acharCampoConhecido("CPF do cliente")?.rotulo, "CPF do cliente");
        assert.equal(acharCampoConhecido("nome da testemunha"), null);
        assert.equal(normalizarChaveCampo("  Parte   Contrária "), "parte contraria");
    });

    it("puxa os dados do cliente, inclusive vara do DJEN e valor por extenso", () => {
        const campos = [
            "nome do cliente",
            "número do processo",
            "parte contrária",
            "vara",
            "valor da causa",
            "valor da causa por extenso",
            "data por extenso",
            "oab",
            "CPF do cliente",
        ];
        const v = valoresIniciaisCampos(campos, { calculo: calculoExemplo, hoje: HOJE });
        assert.equal(v["nome do cliente"], "Maria Exemplo da Silva");
        assert.equal(v["numero do processo"], "0000000-00.2026.8.17.0000");
        assert.equal(v["parte contraria"], "Banco Exemplo S.A.");
        assert.equal(v["vara"], "2ª Vara Cível da Comarca de Petrolina");
        assert.match(v["valor da causa"], /12\.345,67/);
        assert.equal(
            v["valor da causa por extenso"],
            "doze mil, trezentos e quarenta e cinco reais e sessenta e sete centavos",
        );
        assert.equal(v["data por extenso"], "20 de novembro de 2026");
        assert.equal(v["oab"], "OAB/PE 61.107");
        assert.equal(v["cpf do cliente"], "");
    });

    it("sem cliente, campos do cadastro ficam vazios mas data e escritório vêm preenchidos", () => {
        const v = valoresIniciaisCampos(["nome do cliente", "cidade", "data de hoje"], { calculo: null, hoje: HOJE });
        assert.equal(v["nome do cliente"], "");
        assert.equal(v["cidade"], "Petrolina-PE");
        assert.equal(v["data de hoje"], "20/11/2026");
    });

    it("preenche o modelo, escapa HTML e mantém campo em branco para revisar depois", () => {
        const html = "<p><strong>[nome do cliente]</strong>, CPF [CPF do cliente], vem [...] em face de [banco].</p>";
        const out = preencherModelo(html, {
            "nome do cliente": "Ana <b>&</b> Filhos",
            "cpf do cliente": "  ",
            banco: "Banco X",
        });
        assert.equal(
            out,
            "<p><strong>Ana &lt;b&gt;&amp;&lt;/b&gt; Filhos</strong>, CPF [CPF do cliente], vem [...] em face de Banco X.</p>",
        );
    });

    it("campo com entidade HTML no texto é reconhecido", () => {
        assert.deepEqual(extrairCampos("<p>[nome&nbsp;do cliente]</p>"), ["nome do cliente"]);
        assert.equal(preencherModelo("<p>[nome&nbsp;do cliente]</p>", { "nome do cliente": "Ana" }), "<p>Ana</p>");
    });
});

describe("valor e data por extenso", () => {
    const casos: Array<[number, string]> = [
        [0, "zero real"],
        [1, "um real"],
        [0.01, "um centavo"],
        [100, "cem reais"],
        [101, "cento e um reais"],
        [1000, "mil reais"],
        [1001, "mil e um reais"],
        [1100, "mil e cem reais"],
        [1250.5, "mil, duzentos e cinquenta reais e cinquenta centavos"],
        [21000, "vinte e um mil reais"],
        [1_000_000, "um milhão de reais"],
        [2_500_000, "dois milhões e quinhentos mil reais"],
        [15.99, "quinze reais e noventa e nove centavos"],
    ];
    for (const [valor, esperado] of casos) {
        it(`${valor} → ${esperado}`, () => assert.equal(valorPorExtenso(valor), esperado));
    }

    it("data por extenso", () => {
        assert.equal(dataPorExtenso(new Date(2026, 0, 5)), "5 de janeiro de 2026");
    });
});

describe("exportação", () => {
    it("monta arquivo Word com A4, timbrado ativo por padrão e título escapado", () => {
        const doc = montarArquivoWord("Petição <ciente>", "<p>Olá</p>");
        assert.match(doc, /urn:schemas-microsoft-com:office:word/);
        assert.match(doc, /<title>Petição &lt;ciente&gt;<\/title>/);
        assert.match(doc, /IAN GRANJA/);
        assert.match(doc, /ADVOGADOS/);
        assert.match(doc, /OAB\/PE 61\.107/);
        assert.match(doc, /<div class="doc-corpo"><p>Olá<\/p><\/div>/);

        const semTimbrado = montarArquivoWord("Petição <ciente>", "<p>Olá</p>", {
            ...CONFIG_PAGINA_PADRAO,
            timbrado: false,
        });
        assert.match(semTimbrado, /margin: 3cm 2cm 2cm 3cm/);
        assert.ok(!semTimbrado.includes("IAN GRANJA"));
    });

    it("monta HTML de impressão com timbrado fixo em todas as páginas e CSP segura", () => {
        const htmlComTimbrado = montarHtmlImpressaoDocumento("Petição", "<p>Texto<script>alert(1)</script></p>", CONFIG_PAGINA_PADRAO, {
            logoSrc: "data:image/jpeg;base64,/9j/4AAQ",
        });
        assert.match(htmlComTimbrado, /class="timbrado-cabecalho"/);
        assert.match(htmlComTimbrado, /class="timbrado-rodape"/);
        assert.match(htmlComTimbrado, /table class="timbrado-layout"/);
        assert.match(htmlComTimbrado, /data:image\/jpeg;base64,\/9j\/4AAQ/);
        assert.ok(!htmlComTimbrado.includes("<script"));

        const htmlSemTimbrado = montarHtmlImpressaoDocumento("Petição", "<p>Texto</p>", {
            ...CONFIG_PAGINA_PADRAO,
            timbrado: false,
        });
        assert.ok(!htmlSemTimbrado.includes("timbrado-cabecalho"));

        const htmlA4Proprio = montarHtmlImpressaoDocumento("Petição", "<p>Texto</p>", CONFIG_PAGINA_PADRAO, {
            timbradoImagemUrl: "data:image/png;base64,iVBORw0KGgo=",
        });
        assert.match(htmlA4Proprio, /class="timbrado-fundo-a4"/);
        assert.match(htmlA4Proprio, /data:image\/png;base64,iVBORw0KGgo=/);
        assert.ok(!htmlA4Proprio.includes("timbrado-cabecalho"));

        const wordA4Proprio = montarArquivoWord("Petição", "<p>Texto</p>", CONFIG_PAGINA_PADRAO, {
            timbradoImagemUrl: "data:image/png;base64,iVBORw0KGgo=",
        });
        assert.match(wordA4Proprio, /<div style="mso-element:header" id="h1"><p class="MsoHeader"[^>]*><img src="data:image\/png;base64,iVBORw0KGgo="/);
        assert.match(wordA4Proprio, /mso-position-vertical-relative:page/);
        assert.match(wordA4Proprio, /mso-header: h1;/);
        assert.ok(!wordA4Proprio.includes("mso-element:footer"));
    });

    it("Word repete cabeçalho/rodapé timbrados em todas as páginas sem encolher a margem superior", () => {
        const doc = montarArquivoWord("Petição", "<p>Texto</p>", CONFIG_PAGINA_PADRAO);
        // Seções reais do Word (repetidas em cada página), fora do corpo do texto.
        assert.match(doc, /<div style="mso-element:header" id="h1">.*IAN GRANJA/s);
        assert.match(doc, /<div style="mso-element:footer" id="f1">.*Av\. Cardoso de Sá/s);
        assert.match(doc, /mso-header: h1; mso-footer: f1;/);
        // Margem ABNT (3 cm) respeitada com a reserva mínima do timbrado, nunca reduzida para 2 cm.
        assert.match(doc, /margin: 3\.2cm 2cm 2\.4cm 3cm;/);
        assert.ok(doc.indexOf('<div class="doc-corpo">') < doc.indexOf("mso-element:header"));
    });

    it("nome de arquivo sem acento nem símbolo", () => {
        assert.equal(nomeArquivoDocumento("Petição — Ciente: Maria/João"), "Peticao-Ciente-Maria-Joao");
        assert.equal(nomeArquivoDocumento("???"), "documento");
    });

    it("converte HTML em texto simples para colar", () => {
        const txt = htmlParaTextoSimples("<p><strong>A</strong> &amp; B</p><p></p><ul><li>um</li><li>dois</li></ul>");
        assert.equal(txt, "A & B\n\n• um\n• dois");
    });
});

describe("configuração de página", () => {
    it("normaliza valores ruins para A4/ABNT e limita margens entre 0,5 e 6 cm", () => {
        assert.deepEqual(normalizarConfigPagina(null), CONFIG_PAGINA_PADRAO);
        assert.deepEqual(
            normalizarConfigPagina({ formato: "a3", margens: { superior: "2,5", inferior: 99, esquerda: -1, direita: "x" } }),
            { formato: "a4", margens: { superior: 2.5, inferior: 6, esquerda: 0.5, direita: 2 }, timbrado: false },
        );
        assert.equal(normalizarConfigPagina({ timbrado: false }).timbrado, false);
        assert.equal(normalizarConfigPagina({ timbrado: true }).timbrado, true);
    });

    it("documentos salvos antes do timbrado continuam em folha limpa (sem mudar margens/paginação)", () => {
        const legado = normalizarConfigPagina({
            formato: "a4",
            margens: { superior: 1.27, inferior: 1.27, esquerda: 1.27, direita: 1.27 },
        });
        assert.equal(legado.timbrado, false);
        assert.equal(geometriaDaPagina(legado).margemSuperior, 1.27 * (96 / 2.54));
        // Sem nada salvo (novo modelo), vale o padrão com timbrado.
        assert.equal(normalizarConfigPagina(undefined).timbrado, true);
    });

    it("resumo e geometria em px (96 dpi) respeitando reserva mínima do timbrado", () => {
        assert.equal(resumoConfigPagina(CONFIG_PAGINA_PADRAO), "A4 · ABNT");
        const oficio = normalizarConfigPagina({
            formato: "oficio",
            margens: { superior: 2.5, inferior: 2.5, esquerda: 2.5, direita: 2.5 },
            timbrado: false,
        });
        assert.equal(resumoConfigPagina(oficio), "Ofício · Normal");
        const gSem = geometriaDaPagina({ ...CONFIG_PAGINA_PADRAO, timbrado: false });
        assert.equal(Math.round(gSem.largura), 794);
        assert.equal(Math.round(gSem.altura), 1123);
        assert.equal(Math.round(gSem.margemSuperior), 113);
        const gCom = geometriaDaPagina(CONFIG_PAGINA_PADRAO);
        assert.equal(Math.round(gCom.margemSuperior), 121);
        assert.equal(Math.round(gCom.margemInferior), 91);
    });

    it("Word e PDF saem com o papel/margens escolhidos e quebra de página do Word", () => {
        const c = normalizarConfigPagina({
            formato: "oficio",
            margens: { superior: 2.5, inferior: 2, esquerda: 3, direita: 1.5 },
            timbrado: false,
        });
        const word = montarArquivoWord("Doc", '<p>a</p><div data-quebra-pagina="" class="quebra-pagina"></div><p>b</p>', c);
        assert.match(word, /size: 21\.6cm 33cm; margin: 2\.5cm 1\.5cm 2cm 3cm;/);
        assert.match(word, /<p>a<\/p><br clear="all" style="mso-special-character:line-break;page-break-before:always"><p>b<\/p>/);
        assert.match(estiloPaginaDocumento(c), /@page \{ size: 21\.6cm 33cm; margin: 2\.5cm 1\.5cm 2cm 3cm; \}/);
    });

    it("reconhece predefinições de margem estilo Word (Moderada, Larga, Estreita, Autos)", () => {
        const esperada: Record<string, string> = {
            abnt: "A4 · ABNT",
            normal: "A4 · Normal",
            moderada: "A4 · Moderada",
            larga: "A4 · Larga",
            estreita: "A4 · Estreita",
            encadernacao: "A4 · Autos",
        };
        for (const p of PREDEFINICOES_MARGEM) {
            const cfg = normalizarConfigPagina({ formato: "a4", margens: p.margens, timbrado: true });
            assert.equal(resumoConfigPagina(cfg), esperada[p.id]);
        }
    });

    it("sanitiza HTML preservando recuos laterais (inclusive negativos na margem), primeira linha, deslocado, entrelinha, cores e sup/sub", () => {
        const entrada =
            '<p style="margin-left: -1.5cm; margin-right: -1cm; text-indent: -1.25cm; line-height: 1.15; margin-top: 6pt; margin-bottom: 12pt; padding-left: -2cm; background-image: url(https://evil.test/x)">Art. 5<sup>o</sup> <span style="color: #8b1e24; background-color: #fef08a">H<sub>2</sub>O</span> <s>tachado</s></p>';
        const saida = sanitizarHtmlDocumento(entrada);
        assert.ok(saida.includes("margin-left: -1.5cm"), saida);
        assert.ok(saida.includes("margin-right: -1cm"), saida);
        assert.ok(saida.includes("text-indent: -1.25cm"), saida);
        assert.ok(saida.includes("line-height: 1.15"), saida);
        assert.ok(saida.includes("margin-top: 6pt"), saida);
        assert.ok(saida.includes("margin-bottom: 12pt"), saida);
        assert.ok(saida.includes("color: #8b1e24"), saida);
        assert.ok(saida.includes("background-color: #fef08a"), saida);
        assert.ok(saida.includes("<sup>o</sup>"), saida);
        assert.ok(saida.includes("<sub>2</sub>"), saida);
        assert.ok(saida.includes("<s>tachado</s>"), saida);
        assert.ok(!saida.includes("evil.test"), saida);
        assert.ok(!saida.includes("padding-left: -2cm"), saida);
    });

    it("fontes do editor: inclui Montserrat e injeta Google Fonts apenas quando usada na impressão", async () => {
        const { FONTES_EDITOR, encontrarFonteEditor, urlGoogleFontsParaHtml } = await import("../src/lib/fontes-editor.ts");
        assert.ok(FONTES_EDITOR.length >= 20);
        assert.equal(encontrarFonteEditor('"Montserrat", Arial, sans-serif')?.rotulo, "Montserrat");
        assert.equal(encontrarFonteEditor("'EB Garamond', Garamond, serif")?.rotulo, "Garamond");
        assert.equal(urlGoogleFontsParaHtml("<p>Texto padrão</p>"), "");
        const urlMont = urlGoogleFontsParaHtml('<p><span style="font-family: \'Montserrat\', Arial, sans-serif">Oi</span></p>');
        assert.match(urlMont, /fonts\.googleapis\.com\/css2\?family=Montserrat:/);

        const htmlSemWebFont = montarHtmlImpressaoDocumento("Petição", "<p>Simples</p>", {
            ...CONFIG_PAGINA_PADRAO,
            timbrado: false,
        });
        assert.ok(!htmlSemWebFont.includes("fonts.googleapis.com"));

        const htmlComMontserrat = montarHtmlImpressaoDocumento(
            "Petição",
            '<p><span style="font-family: \'Montserrat\', Arial, sans-serif">Com Montserrat</span></p>',
            { ...CONFIG_PAGINA_PADRAO, timbrado: false },
        );
        assert.ok(htmlComMontserrat.includes("fonts.googleapis.com/css2?family=Montserrat:"));
        assert.ok(htmlComMontserrat.includes("font-src 'self' data: https://fonts.gstatic.com;"));
    });
});

describe("payloads do banco", () => {
    it("página é saneada antes de salvar", () => {
        assert.deepEqual(
            sanitizarModeloPayload({
                pagina: { formato: "xx" as never, margens: { superior: 10, inferior: 0, esquerda: 3, direita: 2 }, timbrado: true },
            }),
            { pagina: { formato: "a4", margens: { superior: 6, inferior: 0.5, esquerda: 3, direita: 2 }, timbrado: true } },
        );
    });

    it("valida nome do modelo e limita tamanho", () => {
        assert.throws(() => sanitizarModeloPayload({ nome: "   " }), /nome/);
        assert.deepEqual(sanitizarModeloPayload({ nome: "  Ciente ", descricao: " x " }), { nome: "Ciente", descricao: "x" });
        assert.throws(() => sanitizarModeloPayload({ conteudo_html: "x".repeat(500_001) }), /grande demais/);
    });

    it("documento: título obrigatório, vínculos vazios viram null e sanitiza XSS no HTML", () => {
        assert.throws(() => sanitizarDocumentoPayload({ titulo: "" }), /título/);
        assert.deepEqual(sanitizarDocumentoPayload({ titulo: "Doc", calculo_id: "", modelo_id: null }), {
            titulo: "Doc",
            calculo_id: null,
            modelo_id: null,
        });
        const salvo = sanitizarDocumentoPayload({
            titulo: "Petição",
            conteudo_html:
                '<p style="text-align: justify" onclick="alert(1)">Texto <script>alert(1)</script><iframe src="https://evil.com"></iframe><a href="javascript:alert(1)">link</a><a href="https://tjpe.jus.br">ok</a></p>',
        });
        const html = String(salvo.conteudo_html);
        assert.ok(!html.includes("<script"), html);
        assert.ok(!html.includes("<iframe"), html);
        assert.ok(!html.includes("onclick"), html);
        assert.ok(!html.includes("javascript:"), html);
        assert.ok(html.includes('style="text-align: justify"'), html);
        assert.ok(html.includes('href="https://tjpe.jus.br"'), html);
    });
});

describe("configurações do escritório (nome, OAB, cidade)", async () => {
    const cfg = await import("../src/lib/config-escritorio.ts");

    it("normaliza linha do banco e cai no padrão quando falta dado", () => {
        assert.deepEqual(
            cfg.normalizarConfigEscritorio({ nome_advogado: "  Fulano  de Tal ", oab_numero: "12.345", oab_uf: "ba", cidade: "", uf: "x" }),
            {
                nomeAdvogado: "Fulano de Tal",
                oabNumero: "12345",
                oabUf: "BA",
                cidade: "Petrolina",
                uf: "PE",
                timbradoImagemUrl: "",
                assinaturaImagemUrl: "",
            },
        );
        assert.deepEqual(cfg.normalizarConfigEscritorio(null), cfg.CONFIG_ESCRITORIO_PADRAO);
        assert.equal(
            cfg.normalizarConfigEscritorio({ timbrado_imagem_url: "data:image/png;base64,AAAA" }).timbradoImagemUrl,
            "data:image/png;base64,AAAA",
        );
        assert.equal(
            cfg.normalizarConfigEscritorio({ assinatura_imagem_url: "data:image/png;base64,BBBB" }).assinaturaImagemUrl,
            "data:image/png;base64,BBBB",
        );
        assert.equal(
            cfg.normalizarConfigEscritorio({ assinatura_imagem_url: "javascript:alert(1)" }).assinaturaImagemUrl,
            "",
        );
        assert.equal(
            cfg.normalizarConfigEscritorio({ timbrado_imagem_url: "javascript:alert(1)" }).timbradoImagemUrl,
            "",
        );
        assert.equal(cfg.formatarOab({ oabNumero: "61107", oabUf: "PE" }), "OAB/PE 61.107");
        assert.equal(cfg.formatarOab({ oabNumero: "1234567", oabUf: "SP" }), "OAB/SP 1.234.567");
        assert.equal(cfg.cidadeAssinatura({ cidade: "Juazeiro", uf: "BA" }), "Juazeiro-BA");
        assert.deepEqual(cfg.configParaLinha({ nomeAdvogado: "A", oabNumero: "9", oabUf: "pe", cidade: "C", uf: "PE" }), {
            id: "escritorio",
            nome_advogado: "A",
            oab_numero: "9",
            oab_uf: "PE",
            cidade: "C",
            uf: "PE",
        });
    });

    it("[advogado], [oab] e [cidade] usam o que foi salvo em Configurações", () => {
        const html = "<p>[cidade], [data por extenso].</p><p>[advogado]<br>[oab]</p>";
        const campos = extrairCampos(html);
        cfg.definirConfigEscritorio({ nomeAdvogado: "Fulana Teste", oabNumero: "12345", oabUf: "BA", cidade: "Juazeiro", uf: "BA" });
        try {
            const v = valoresIniciaisCampos(campos, { calculo: null, hoje: new Date(2026, 10, 20) });
            assert.equal(
                preencherModelo(html, v),
                "<p>Juazeiro-BA, 20 de novembro de 2026.</p><p>Fulana Teste<br>OAB/BA 12.345</p>",
            );
        } finally {
            cfg.definirConfigEscritorio(cfg.CONFIG_ESCRITORIO_PADRAO);
        }
    });
});

describe("lista de documentos agrupada por cliente", () => {
    const doc = (id: string, cliente: string | null, updated_at: string) => ({ id, cliente, updated_at });

    it("junta pelo nome do cliente (sem acento/caixa), mais recente primeiro e sem cliente no fim", () => {
        const grupos = agruparDocumentosPorCliente(
            [
                doc("a", "José da Silva", "2026-11-10T10:00:00Z"),
                doc("b", null, "2026-11-20T10:00:00Z"),
                doc("c", "Maria Souza", "2026-11-15T10:00:00Z"),
                doc("d", "JOSE DA SILVA", "2026-11-18T10:00:00Z"),
                doc("e", "  ", "2026-11-01T10:00:00Z"),
            ],
            (d) => d.cliente,
        );
        assert.deepEqual(
            grupos.map((g) => [g.nome, g.itens.map((d) => d.id), g.ultimaEdicao]),
            [
                ["JOSE DA SILVA", ["d", "a"], "2026-11-18T10:00:00Z"],
                ["Maria Souza", ["c"], "2026-11-15T10:00:00Z"],
                [null, ["b", "e"], "2026-11-20T10:00:00Z"],
            ],
        );
    });

    it("lista vazia não gera grupos", () => {
        assert.deepEqual(agruparDocumentosPorCliente([], () => "x"), []);
    });
});

describe("tabulação (estilo Word)", () => {
    it("mantém o caractere de tabulação e a parada do parágrafo ao sanear", () => {
        const html = sanitizarHtmlDocumento('<p style="tab-size: 8cm">Petrolina\tAssinatura</p>');
        assert.match(html, /tab-size: 8cm/);
        assert.ok(html.includes("Petrolina\tAssinatura"));
        assert.ok(!sanitizarHtmlDocumento('<p style="tab-size: 8; color: red">x</p>').includes("tab-size"));
    });

    it("Word recebe a tabulação no formato dele e a parada como tab-stops", () => {
        const doc = montarArquivoWord("Doc", '<p style="tab-size: 8cm">a\tb</p>', { ...CONFIG_PAGINA_PADRAO, timbrado: false });
        assert.match(doc, /a<span style="mso-tab-count:1">\t<\/span>b/);
        assert.match(doc, /tab-size: 8cm; tab-stops: 8cm/);
    });

    it("PDF/impressão usa parada padrão de 1,25 cm e preserva as tabulações", () => {
        const html = montarHtmlImpressaoDocumento("Doc", "<p>a\tb</p>", { ...CONFIG_PAGINA_PADRAO, timbrado: false });
        assert.match(html, /\.doc-corpo \{ tab-size: 1\.25cm; \}/);
        assert.match(html, /white-space: pre-wrap/);
    });
});

describe("assinatura do advogado e campo [assinatura]", async () => {
    const cfg = await import("../src/lib/config-escritorio.ts");

    it("[assinatura] expande em bloco estruturado ao gerar o documento e mantém se vazio", () => {
        const html = '<p>Termos em que pede deferimento.</p><p style="text-align: right">[assinatura]</p>';
        const campos = extrairCampos(html);
        assert.deepEqual(campos, ["assinatura"]);
        const v = valoresIniciaisCampos(campos, { calculo: null, hoje: new Date(2026, 10, 20) });
        assert.match(v.assinatura, /OAB\/PE 61\.107/);

        const preenchido = preencherModelo(html, v);
        assert.match(preenchido, /data-assinatura-advogado="true"/);
        assert.match(preenchido, /data-alinhamento="right"/);

        const inline = preencherModelo("<p>Termos,[assinatura]</p><p></p>", v);
        assert.match(inline, /<p>Termos,<\/p><div data-assinatura-advogado="true"/);

        const pendente = preencherModelo("<p>[assinatura]</p>", { assinatura: "   " });
        assert.equal(pendente, "<p>[assinatura]</p>");
    });

    it("[assinatura] nunca gera tags cruzadas e mantém os atributos do parágrafo dividido", () => {
        const v = { assinatura: "Dr. Fulano — OAB/PE 1" };

        // Sozinho no parágrafo, mesmo em negrito: vira o bloco com o alinhamento do parágrafo.
        const soNegrito = preencherModelo('<p style="text-align: right"><strong>[assinatura]</strong></p>', v);
        assert.match(soNegrito, /^<div data-assinatura-advogado="true" data-alinhamento="right"[^>]*><\/div>$/);

        // Direto no parágrafo com texto: divide e os dois lados mantêm o estilo.
        const dividido = preencherModelo('<p style="text-align: justify">Termos, [assinatura] fim.</p>', v);
        assert.equal(
            dividido,
            '<p style="text-align: justify">Termos, </p>' +
                '<div data-assinatura-advogado="true" data-alinhamento="center" data-mostrar-data="true" data-mostrar-selo="true"></div>' +
                '<p style="text-align: justify"> fim.</p>',
        );

        // Dentro de formatação no meio do texto, título ou célula: vira texto, sem </p> solto.
        const emNegrito = preencherModelo("<p>Assina: <strong>[assinatura]</strong> hoje</p>", v);
        assert.equal(emNegrito, "<p>Assina: <strong>Dr. Fulano — OAB/PE 1</strong> hoje</p>");
        const titulo = preencherModelo("<h2>[assinatura]</h2>", v);
        assert.equal(titulo, "<h2>Dr. Fulano — OAB/PE 1</h2>");
        const celula = preencherModelo("<table><tr><td>[assinatura]</td></tr></table>", v);
        assert.equal(celula, "<table><tr><td>Dr. Fulano — OAB/PE 1</td></tr></table>");

        // Outros campos do mesmo parágrafo continuam sendo preenchidos.
        const misto = preencherModelo("<p>[cidade], [assinatura]</p>", { ...v, cidade: "Recife" });
        assert.match(misto, /^<p>Recife, <\/p><div data-assinatura-advogado="true"/);
    });

    it("sanitiza bloco de assinatura mantendo atributos seguros e descartando valores inválidos", () => {
        const sujo =
            '<div data-assinatura-advogado="x" data-alinhamento="right" data-mostrar-data="false" data-mostrar-selo="true" onclick="alert(1)"></div><div data-assinatura-advogado="true" data-alinhamento="justify" data-mostrar-data="nao"></div>';
        const limpo = sanitizarHtmlDocumento(sujo);
        assert.ok(limpo.includes('data-assinatura-advogado="true"'), limpo);
        assert.ok(limpo.includes('data-alinhamento="right"'), limpo);
        assert.ok(limpo.includes('data-mostrar-data="false"'), limpo);
        assert.ok(limpo.includes('data-mostrar-selo="true"'), limpo);
        assert.ok(!limpo.includes("onclick"), limpo);
        assert.ok(!limpo.includes('data-alinhamento="justify"'), limpo);
        assert.ok(!limpo.includes('data-mostrar-data="nao"'), limpo);
    });

    it("expande bloco de assinatura no HTML de impressão, Word e texto simples com nome, OAB e rubrica", () => {
        cfg.definirConfigEscritorio({
            nomeAdvogado: "Dr. Teste Silva",
            oabNumero: "99887",
            oabUf: "SP",
            cidade: "Campinas",
            uf: "SP",
            assinaturaImagemUrl: "data:image/png;base64,iVBORw0KGgo=",
        });
        try {
            const corpo = '<p>Corpo</p><div data-assinatura-advogado="true" data-alinhamento="center" data-mostrar-data="true" data-mostrar-selo="true"></div>';
            const printHtml = montarHtmlImpressaoDocumento("Petição", corpo, { ...CONFIG_PAGINA_PADRAO, timbrado: false });
            assert.ok(printHtml.includes("Dr. Teste Silva"), printHtml);
            assert.ok(printHtml.includes("OAB/SP 99.887"), printHtml);
            assert.ok(printHtml.includes("Campinas-SP,"), printHtml);
            assert.ok(printHtml.includes("data:image/png;base64,iVBORw0KGgo="), printHtml);
            assert.ok(printHtml.includes("ICP-Brasil"), printHtml);
            // Documento impresso/Word não foi assinado: não pode afirmar que foi.
            assert.ok(printHtml.includes("Espaço para assinatura digital"), printHtml);
            assert.ok(!/Assinado digitalmente/i.test(printHtml), printHtml);

            const wordHtml = montarArquivoWord("Petição", corpo, { ...CONFIG_PAGINA_PADRAO, timbrado: false });
            assert.ok(!/Assinado digitalmente/i.test(wordHtml), wordHtml);
            assert.ok(wordHtml.includes("Dr. Teste Silva"), wordHtml);
            assert.ok(wordHtml.includes("OAB/SP 99.887"), wordHtml);
            assert.ok(wordHtml.includes("data:image/png;base64,iVBORw0KGgo="), wordHtml);

            const texto = htmlParaTextoSimples(corpo);
            assert.ok(texto.includes("Campinas-SP,"), texto);
            assert.ok(texto.includes("Dr. Teste Silva"), texto);
            assert.ok(texto.includes("OAB/SP 99.887"), texto);
        } finally {
            cfg.definirConfigEscritorio(cfg.CONFIG_ESCRITORIO_PADRAO);
        }
    });
});
