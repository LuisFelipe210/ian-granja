import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    MODALIDADES,
    consultarSerieSgsMeses,
    lerMoeda,
    limparCachesBacen,
    taxaMedia,
} from "../src/lib/juros/index.ts";
import { consultarDjen } from "../src/lib/juros/djen.ts";
import {
    CONFIG_ESCRITORIO_PADRAO,
    definirConfigEscritorio,
} from "../src/lib/config-escritorio.ts";
import {
    PARAMETROS_DECISAO_PADRAO,
    calcularProcessoRevisional,
} from "../src/lib/juros/revisional-pro.ts";
import { gerarBytesLaudoPdf, gerarCsvDemonstrativo } from "../src/lib/juros/laudo-pdf.ts";
import { practiceAreas } from "../src/data/practiceAreas.ts";

const ROOT = process.cwd();

describe("Contratos de dados (MODALIDADES ↔ bacen-series.json e seo.json ↔ practiceAreas)", () => {
    it("todas as séries de todas as 13 modalidades existem em bacen-series.json com valores válidos", () => {
        const json = JSON.parse(
            fs.readFileSync(path.join(ROOT, "src/lib/juros/bacen-series.json"), "utf8"),
        ) as Record<string, { i: string; v: Array<number | null> }>;

        for (const mod of MODALIDADES) {
            const codigos = [mod.am, mod.aa, ...(mod.alt ? [mod.alt.am, mod.alt.aa] : [])];
            for (const cod of codigos) {
                const s = json[String(cod)];
                assert.ok(s, `Série ${cod} (${mod.id}) ausente em bacen-series.json`);
                const validos = s.v.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
                const minimo = s.i >= "2025-01" ? 6 : 60;
                assert.ok(validos.length >= minimo, `Série ${cod} (${mod.id}) tem poucos dados (${validos.length})`);
            }
            const media = taxaMedia(mod, "2026-01");
            assert.ok(media && media.am > 0 && media.aa > 0, `taxaMedia falhou para ${mod.id}`);
        }
    });

    it("seo.json cobre todas as áreas de atuação e não lista rotas internas /ferramentas/", () => {
        const seo = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/seo.json"), "utf8")) as {
            siteUrl: string;
            pages: Record<string, { title: string; description: string }>;
        };
        assert.ok(seo.siteUrl.startsWith("https://"));
        for (const area of practiceAreas) {
            const rota = `/atuacao/${area.slug}`;
            const meta = seo.pages[rota];
            assert.ok(meta, `Rota ${rota} ausente em src/data/seo.json`);
            assert.ok(meta.title.trim().length > 10, `Título curto/vazio para ${rota}`);
            assert.ok(meta.description.trim().length > 30, `Descrição curta/vazia para ${rota}`);
        }
        for (const rota of Object.keys(seo.pages)) {
            assert.ok(!rota.startsWith("/ferramentas"), `Rota privada ${rota} não deve estar em seo.json`);
        }
    });
});

describe("Helpers P2/P3 (lerMoeda, dedup SGS, falsos positivos DJEN e OAB dinâmica no PDF)", () => {
    it("lerMoeda trata prefixo R$, formato BR e ponto decimal americano", () => {
        assert.equal(lerMoeda("R$ 1.500,50"), 1500.5);
        assert.equal(lerMoeda("1500.50"), 1500.5);
        assert.equal(lerMoeda("2.000"), 2000);
        assert.equal(lerMoeda("0,75"), 0.75);
        assert.equal(lerMoeda(""), 0);
    });

    it("consultarSerieSgsMeses deduplica chamadas simultâneas em voo", async () => {
        limparCachesBacen();
        const prevFetch = globalThis.fetch;
        let chamadas = 0;
        globalThis.fetch = (async () => {
            chamadas += 1;
            await new Promise((r) => setTimeout(r, 15));
            return new Response(JSON.stringify([{ data: "01/01/2020", valor: "0.42" }]), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }) as typeof fetch;
        try {
            const [a, b] = await Promise.all([
                consultarSerieSgsMeses(433, 2020, 2020),
                consultarSerieSgsMeses(433, 2020, 2020),
            ]);
            assert.equal(chamadas, 1);
            assert.equal(a["2020-01"], 0.42);
            assert.equal(b["2020-01"], 0.42);
        } finally {
            globalThis.fetch = prevFetch;
            limparCachesBacen();
        }
    });

    it("consultarDjen não classifica empresas comuns como bancos (Safra Agrícola, Mercantil Silva)", async () => {
        const mockFetch = (async () =>
            new Response(
                JSON.stringify({
                    count: 2,
                    items: [
                        {
                            id: 1,
                            numero_processo: "00012345620258171130",
                            siglaTribunal: "TJPE",
                            nomeOrgao: "1ª Vara Cível",
                            nomeClasse: "Procedimento Comum Cível",
                            tipoComunicacao: "Intimação",
                            data_disponibilizacao: "2026-11-10",
                            texto: "Intime-se a parte autora.",
                            destinatarios: [
                                { nome: "SAFRA AGRICOLA LTDA", polo: "A" },
                                { nome: "MERCANTIL SILVA LTDA", polo: "P" },
                            ],
                            destinatarioadvogados: [],
                        },
                        {
                            id: 2,
                            numero_processo: "00099995620258171130",
                            siglaTribunal: "TJPE",
                            nomeOrgao: "1ª Vara Cível",
                            nomeClasse: "Procedimento Comum Cível",
                            tipoComunicacao: "Intimação",
                            data_disponibilizacao: "2026-11-10",
                            texto: "Intime-se a parte autora.",
                            destinatarios: [
                                { nome: "JOAO DA SILVA", polo: "A" },
                                { nome: "BANCO SAFRA S.A.", polo: "P" },
                            ],
                            destinatarioadvogados: [],
                        },
                    ],
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            )) as typeof fetch;

        const res = await consultarDjen({ numeroOab: "61107", ufOab: "PE" }, mockFetch);
        assert.equal(res.items[0].clienteSugerido, "SAFRA AGRICOLA LTDA");
        assert.equal(res.items[0].bancoDetectado, "MERCANTIL SILVA LTDA");
        assert.equal(res.items[1].clienteSugerido, "JOAO DA SILVA");
        assert.equal(res.items[1].bancoDetectado, "BCO SAFRA S.A.");
    });

    it("laudo-pdf usa a OAB e advogado configurados em config-escritorio", () => {
        definirConfigEscritorio({
            nomeAdvogado: "Dra. Carla Exemplo",
            oabNumero: "99887",
            oabUf: "BA",
            cidade: "Juazeiro",
            uf: "BA",
        });
        try {
            const input = {
                processoGlobal: "0001111-22.2025.8.05.0146",
                contratos: [
                    {
                        id: "c1",
                        descricao: "Contrato 1",
                        instituicao: "Banco Teste",
                        numeroContrato: "123",
                        pessoa: "pf" as const,
                        modalidadeId: "veiculo-pf" as const,
                        dataContrato: "2024-01-10",
                        primeiroVencimento: "2024-02-10",
                        valorFinanciado: 30000,
                        valorParcela: 1300,
                        parcelas: 36,
                        pagas: 10,
                        taxaMensal: 3.1,
                        tipoJurosContrato: "AM" as const,
                        metodo: "PRICE" as const,
                        sistemaJuros: "COMPOSTO" as const,
                        fonteTaxaRevisional: "media_sgs" as const,
                        pagamentosExtras: [],
                        gradePersonalizada: [],
                    },
                ],
                tarifas: [],
                deducoes: [],
                parametros: { ...PARAMETROS_DECISAO_PADRAO(), indiceCorrecao: "NENHUM" as const, tipoJuros: "NENHUM" as const },
            };
            const res = calcularProcessoRevisional(input, { inpc: {}, ipca: {}, igpm: {}, selic: {} }, { c1: false });
            const csv = gerarCsvDemonstrativo(res, { clienteNome: "Cliente Teste" });
            assert.match(csv, /OAB\/BA 99\.887/);
            const pdf = gerarBytesLaudoPdf(res, { clienteNome: "Cliente Teste", incluirGraficos: false });
            assert.ok(pdf.length > 500);
        } finally {
            definirConfigEscritorio(CONFIG_ESCRITORIO_PADRAO);
        }
    });
});
