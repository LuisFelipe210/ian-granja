import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    CONFIG_PAGINA_PADRAO,
    acharCampoConhecido,
    dataPorExtenso,
    estiloPaginaDocumento,
    geometriaDaPagina,
    normalizarConfigPagina,
    resumoConfigPagina,
    extrairCampos,
    htmlParaTextoSimples,
    montarArquivoWord,
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
    it("monta arquivo Word com A4, margens ABNT e título escapado", () => {
        const doc = montarArquivoWord("Petição <ciente>", "<p>Olá</p>");
        assert.match(doc, /urn:schemas-microsoft-com:office:word/);
        assert.match(doc, /margin: 3cm 2cm 2cm 3cm/);
        assert.match(doc, /<title>Petição &lt;ciente&gt;<\/title>/);
        assert.match(doc, /<div class="WordSection1"><p>Olá<\/p><\/div>/);
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
            { formato: "a4", margens: { superior: 2.5, inferior: 6, esquerda: 0.5, direita: 2 } },
        );
    });

    it("resumo e geometria em px (96 dpi)", () => {
        assert.equal(resumoConfigPagina(CONFIG_PAGINA_PADRAO), "A4 · ABNT");
        const oficio = normalizarConfigPagina({ formato: "oficio", margens: { superior: 2.5, inferior: 2.5, esquerda: 2.5, direita: 2.5 } });
        assert.equal(resumoConfigPagina(oficio), "Ofício · Normal");
        const g = geometriaDaPagina(CONFIG_PAGINA_PADRAO);
        assert.equal(Math.round(g.largura), 794);
        assert.equal(Math.round(g.altura), 1123);
        assert.equal(Math.round(g.margemSuperior), 113);
    });

    it("Word e PDF saem com o papel/margens escolhidos e quebra de página do Word", () => {
        const c = normalizarConfigPagina({ formato: "oficio", margens: { superior: 2.5, inferior: 2, esquerda: 3, direita: 1.5 } });
        const word = montarArquivoWord("Doc", '<p>a</p><div data-quebra-pagina="" class="quebra-pagina"></div><p>b</p>', c);
        assert.match(word, /size: 21\.6cm 33cm; margin: 2\.5cm 1\.5cm 2cm 3cm;/);
        assert.match(word, /<p>a<\/p><br clear="all" style="mso-special-character:line-break;page-break-before:always"><p>b<\/p>/);
        assert.match(estiloPaginaDocumento(c), /@page \{ size: 21\.6cm 33cm; margin: 2\.5cm 1\.5cm 2cm 3cm; \}/);
    });
});

describe("payloads do banco", () => {
    it("página é saneada antes de salvar", () => {
        assert.deepEqual(
            sanitizarModeloPayload({
                pagina: { formato: "xx" as never, margens: { superior: 10, inferior: 0, esquerda: 3, direita: 2 } },
            }),
            { pagina: { formato: "a4", margens: { superior: 6, inferior: 0.5, esquerda: 3, direita: 2 } } },
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
            { nomeAdvogado: "Fulano de Tal", oabNumero: "12345", oabUf: "BA", cidade: "Petrolina", uf: "PE" },
        );
        assert.deepEqual(cfg.normalizarConfigEscritorio(null), cfg.CONFIG_ESCRITORIO_PADRAO);
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
