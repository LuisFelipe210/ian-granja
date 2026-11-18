import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    PARAMETROS_DECISAO_PADRAO,
    atualizarValorMonetario,
    calcularProcessoRevisional,
    gerarGradePadrao,
    type ProcessoRevisionalInput,
    type SeriesEconomicas,
} from "../src/lib/juros/revisional-pro.ts";
import {
    baixarLaudoPdf,
    gerarBytesLaudoPdf,
    gerarCsvDemonstrativo,
    gerarHtmlLaudoRevisional,
} from "../src/lib/juros/laudo-pdf.ts";
import { calculoParaProcesso, processoParaPayload, type CalculoSalvo } from "../src/lib/revisional-db.ts";
import {
    agregarEstatisticasCarteira,
    composicaoCustoContrato,
    historicoBacenContrato,
    serieSaldoDevedorContrato,
} from "../src/lib/juros/graficos-dados.ts";

const SERIES_MOCK: SeriesEconomicas = {
    inpc: { "2024-06": 0.25, "2024-07": 0.26, "2024-08": 0.1 },
    ipca: { "2024-09": 0.44, "2024-10": 0.56, "2024-11": 0.39 },
    igpm: { "2024-09": 0.62, "2024-10": 1.52 },
    selic: { "2024-09": 0.84, "2024-10": 0.93, "2024-11": 0.79 },
};

describe("atualizarValorMonetario", () => {
    it("aplica INPC até ago/2024, IPCA depois e Taxa Legal da Lei 14.905/2024", () => {
        const params = {
            ...PARAMETROS_DECISAO_PADRAO(),
            indiceCorrecao: "INPC_IPCA" as const,
            tipoJuros: "LEI_14905" as const,
            dataBaseAtualizacao: "2024-11-30",
        };
        // Evento em 2024-07 -> meses: 2024-07 (INPC 0.26 + 1% juros), 2024-08 (INPC 0.10 + 1% juros),
        // 2024-09 (IPCA 0.44 + taxa legal (1.0084/1.0044-1)=0.398%), 2024-10 (IPCA 0.56 + taxa legal (1.0093/1.0056-1)=0.368%)
        const upd = atualizarValorMonetario(1000, "2024-07-10", params, SERIES_MOCK);
        assert.ok(upd.correcao > 13 && upd.correcao < 15, `Correção inesperada: ${upd.correcao}`);
        assert.ok(upd.percentualJuros > 2.7 && upd.percentualJuros < 2.85, `Juros % inesperado: ${upd.percentualJuros}`);
        assert.ok(Math.abs(upd.total - (1000 + upd.correcao + upd.juros)) < 1e-6);
    });

    it("SELIC pura zera correção separada para evitar bis in idem", () => {
        const params = {
            ...PARAMETROS_DECISAO_PADRAO(),
            indiceCorrecao: "IPCA" as const,
            tipoJuros: "SELIC" as const,
            dataBaseAtualizacao: "2024-11-30",
        };
        const upd = atualizarValorMonetario(1000, "2024-09-10", params, SERIES_MOCK);
        assert.equal(upd.correcao, 0);
        // 0.84% (set/24) + 0.93% (out/24) = 1.77% sobre 1000 = 17.70
        assert.ok(Math.abs(upd.juros - 17.7) < 1e-4);
    });
});

describe("motor pericial multi-contrato, tarifas, deduções e laudo", () => {
    const baseInput: ProcessoRevisionalInput = {
        parametros: {
            ...PARAMETROS_DECISAO_PADRAO(),
            indiceCorrecao: "NENHUM",
            tipoJuros: "FIXO_1",
            termoInicialCorrecao: "VENCIMENTO",
            termoInicialJuros: "VENCIMENTO",
            dataBaseAtualizacao: "2026-01-10",
            restituicaoDobroParcelas: true,
            multaGlobalPercentual: 10,
            honorariosPercentual: 20,
        },
        contratos: [
            {
                id: "c-1",
                descricao: "Veículo Gol",
                instituicao: "BANCO PAN S.A.",
                numeroContrato: "CT-111",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2025-11-10",
                primeiroVencimento: "2025-12-10",
                valorFinanciado: 40000,
                valorParcela: 1700,
                parcelas: 48,
                pagas: 2,
                fonteTaxaRevisional: "media_sgs",
                gradePersonalizada: gerarGradePadrao("2025-12-10", "2025-11-10", 48, 1700, 2).map((item) =>
                    item.numero === 1 ? { ...item, valorPago: 1900 } : item,
                ),
                pagamentosExtras: [{ id: "e-1", descricao: "Amortização extra", data: "2025-12-20", valor: 500 }],
            },
            {
                id: "c-2",
                descricao: "Empréstimo complementar",
                instituicao: "BANCO PAN S.A.",
                numeroContrato: "CT-222",
                pessoa: "pf",
                modalidadeId: "sem-garantia",
                dataContrato: "2025-11-10",
                primeiroVencimento: "2025-12-10",
                valorFinanciado: 10000,
                valorParcela: 1500,
                parcelas: 12,
                pagas: 1,
                fonteTaxaRevisional: "banco_olinda",
                bancoOlinda: {
                    instituicao: "BANCO PAN S.A.",
                    taxaAm: 6.5,
                    taxaAa: 112.91,
                    periodo: "2025-11-10",
                },
                pagamentosExtras: [],
            },
        ],
        tarifas: [
            {
                id: "t-1",
                tipo: "Seguro Prestamista",
                descricaoCustom: "",
                valor: 1200,
                dataCobranca: "2025-11-10",
                emDobro: true,
            },
            {
                id: "t-2",
                tipo: "Outra",
                descricaoCustom: "Tarifa de gravame",
                valor: 300,
                dataCobranca: "2025-12-10",
                emDobro: false,
            },
        ],
        deducoes: [
            {
                id: "d-1",
                descricao: "Alvará parcial",
                valor: 500,
                data: "2026-01-10",
                atualizar: false,
            },
        ],
    };

    it("consolida múltiplos contratos, grade editada, pagamentos extras, tarifas, dedução, multa e honorários", () => {
        const res = calcularProcessoRevisional(baseInput);
        assert.equal(res.contratos.length, 2);

        // Na grade do contrato 1, parcela 1 teve valorPago customizado para 1900 e parcela 2 para 1700
        assert.equal(res.contratos[0].linhas[0].valorPago, 1900);
        assert.equal(res.contratos[0].linhas[1].valorPago, 1700);
        // Pagamento extra em dobro (500 * 2 = 1000 + 1 mês de 1% = 1010)
        assert.ok(Math.abs(res.contratos[0].extrasAtualizado - 1010) < 1e-2);

        // Contrato 2 usou Olinda 6.5% a.m.
        assert.equal(res.contratos[1].taxaRevisionalAm, 6.5);

        // Tarifa 1 (1200 * 2 = 2400 + 2 meses de 1% = 2448) + Tarifa 2 (300 + 1 mês de 1% = 303) = 2751
        assert.ok(Math.abs(res.resumo.tarifasAtualizado - 2751) < 1e-2);

        // Base líquida abate dedução de 500
        const esperadoBase =
            res.resumo.principalContratosAtualizado + res.resumo.extrasAtualizado + res.resumo.tarifasAtualizado - 500;
        assert.ok(Math.abs(res.resumo.baseLiquidaCondenacao - esperadoBase) < 1e-2);
        assert.ok(Math.abs(res.resumo.valorMultaGlobal - esperadoBase * 0.1) < 1e-2);
        assert.ok(Math.abs(res.resumo.valorHonorarios - res.resumo.subtotalComMulta * 0.2) < 1e-2);
        assert.ok(res.resumo.valorTotalAcao > res.resumo.totalRestituicaoAtualizado);
    });

    it("gera Laudo HTML A4 com escape XSS e CSV completo", () => {
        const res = calcularProcessoRevisional(baseInput);
        const html = gerarHtmlLaudoRevisional(res, {
            clienteNome: 'Maria <script>alert("xss")</script>',
            processoGlobal: "0001234-56.2026.8.17.1130",
            categoriaNome: "Revisional",
            observacoes: "Nota <b>importante</b>",
        });

        assert.ok(html.includes("Ian Granja Advogados"));
        assert.ok(html.includes("OAB/PE 61.107"));
        assert.ok(html.includes("0001234-56.2026.8.17.1130"));
        assert.ok(html.includes("Tarifa de gravame"));
        assert.ok(!html.includes("<script>alert"));
        assert.ok(html.includes("&lt;script&gt;alert"));

        const csv = gerarCsvDemonstrativo(res, {
            clienteNome: "Maria Silva",
            processoGlobal: "0001234-56.2026.8.17.1130",
        });
        assert.ok(csv.startsWith("\uFEFF"));
        assert.ok(csv.includes("Veículo Gol"));
        assert.ok(csv.includes("Seguro Prestamista"));
    });

    it("serializa e restaura processo completo e registros legados sem dados_completos", () => {
        const res = calcularProcessoRevisional(baseInput);
        const ficha = {
            clienteNome: "Maria Silva",
            processoGlobal: "0001234-56.2026.8.17.1130",
            banco: "",
            documentoContrato: "",
            categoriaId: "cat-1",
            observacoes: "Obs",
        };
        const payload = processoParaPayload(res, baseInput, ficha);
        assert.equal(payload.qtd_contratos, 2);
        assert.equal(payload.processo_global, "0001234-56.2026.8.17.1130");
        assert.equal(payload.banco, "BANCO PAN S.A.");
        assert.ok(payload.total_tarifas > 2700);
        assert.ok(payload.valor_total_acao > 0);

        const salvo: CalculoSalvo = {
            ...payload,
            id: "calc-pro-1",
            created_by_email: "contato@iangranja.adv.br",
            created_at: "2026-11-17T22:00:00Z",
            updated_at: "2026-11-17T22:00:00Z",
        };
        const restaurado = calculoParaProcesso(salvo);
        assert.equal(restaurado.processo.contratos.length, 2);
        assert.equal(restaurado.processo.tarifas.length, 2);
        assert.equal(restaurado.processo.deducoes.length, 1);
        assert.equal(restaurado.ficha.processoGlobal, "0001234-56.2026.8.17.1130");

        // Fallback legado com dados_completos = {}
        const legadoRestaurado = calculoParaProcesso({ ...salvo, dados_completos: {} });
        assert.equal(legadoRestaurado.processo.contratos.length, 1);
        assert.equal(legadoRestaurado.processo.contratos[0].modalidadeId, "veiculo-pf");
    });

    it("gera PDF A4 binário válido em WinAnsi, com paginação automática e download direto sem window.open", () => {
        const toPdfHex = (s: string) => `<${Buffer.from(s, "latin1").toString("hex").toUpperCase()}>`;

        const input48: ProcessoRevisionalInput = {
            ...baseInput,
            contratos: [
                {
                    ...baseInput.contratos[0],
                    pagas: 48,
                    gradePersonalizada: gerarGradePadrao("2025-12-10", "2025-11-10", 48, 1700, 48),
                },
            ],
        };
        const res48 = calcularProcessoRevisional(input48);
        const bytes = gerarBytesLaudoPdf(res48, {
            clienteNome: "João Araújo",
            processoGlobal: "0001234-56.2026.8.17.1130",
            categoriaNome: "Busca e Apreensão",
            observacoes: "Cobrança de seguro prestamista e tarifa sem pactuação expressa.",
        });

        assert.ok(bytes instanceof Uint8Array);
        const pdf = Buffer.from(bytes).toString("latin1");
        assert.ok(pdf.startsWith("%PDF-1.4\n"));
        assert.ok(pdf.endsWith("%%EOF\n"));
        assert.ok(pdf.includes("/BaseFont /Helvetica"));
        assert.ok(pdf.includes("/BaseFont /Helvetica-Bold"));
        assert.ok(pdf.includes("/Encoding /WinAnsiEncoding"));

        // Valida formato rigoroso da tabela xref (entradas de 20 bytes)
        const xrefMatch = pdf.match(/xref\n0 (\d+)\n([\s\S]*?)trailer\n/);
        assert.ok(xrefMatch, "Tabela xref deve existir");
        const count = Number(xrefMatch[1]);
        const xrefLines = xrefMatch[2].split("\n").slice(0, -1);
        assert.equal(xrefLines.length, count);
        for (const line of xrefLines) {
            assert.equal(line.length, 19, `Entrada xref inválida (esperava 19 chars + LF = 20 bytes): ${JSON.stringify(line)}`);
            assert.match(line, /^\d{10} \d{5} [fn] $/);
        }

        // Strings acentuadas codificadas em hexadecimal WinAnsi e múltiplas páginas
        assert.ok(pdf.includes(toPdfHex("João Araújo")));
        assert.ok(pdf.includes(toPdfHex("Busca e Apreensão")));
        assert.ok(pdf.includes(toPdfHex("Totais das parcelas pagas")));
        assert.ok(!pdf.includes(toPdfHex("Tot...")));
        const pageCount = (pdf.match(/\/Type \/Page\b/g) ?? []).length;
        assert.ok(pageCount >= 2, `Esperava múltiplas páginas para 48 parcelas, obteve ${pageCount}`);
        assert.ok(pdf.includes(toPdfHex(`Página 1 de ${pageCount}`)));
        assert.ok(pdf.includes(toPdfHex(`Página ${pageCount} de ${pageCount}`)));

        // Testa baixarLaudoPdf com mock de DOM sem chamar window.open ou print
        const g = globalThis as unknown as { window?: unknown };
        const prevWin = g.window;
        let capturedBlob: Blob | null = null;
        let downloadName = "";
        let clicked = false;
        let removed = false;
        let openCalled = false;

        g.window = {
            open: () => {
                openCalled = true;
                return null;
            },
            URL: {
                createObjectURL: (blob: Blob) => {
                    capturedBlob = blob;
                    return "blob:laudo-teste";
                },
                revokeObjectURL: () => {},
            },
            document: {
                createElement: () => ({
                    href: "",
                    download: "",
                    click: () => {
                        clicked = true;
                    },
                    remove: () => {
                        removed = true;
                    },
                }),
                body: {
                    appendChild: (el: { download?: string }) => {
                        downloadName = el.download ?? "";
                    },
                },
            },
        };

        try {
            const ok = baixarLaudoPdf(res48, {
                clienteNome: "João Araújo",
                processoGlobal: "0001234-56.2026.8.17.1130",
                categoriaNome: "Busca e Apreensão",
            });
            assert.equal(ok, true);
            assert.equal(openCalled, false);
            assert.equal(clicked, true);
            assert.equal(removed, true);
            assert.equal(downloadName, "joao-araujo-laudo-revisional.pdf");
            assert.ok(capturedBlob !== null);
            assert.equal((capturedBlob as Blob).type, "application/pdf");
            assert.ok((capturedBlob as Blob).size > 2000);
        } finally {
            g.window = prevWin;
        }

        // Verifica opção incluirGraficos no PDF
        assert.ok(pdf.includes(toPdfHex("COMPARATIVO DE TAXAS E CUSTO TOTAL")));
        const bytesSemGraf = gerarBytesLaudoPdf(res48, {
            clienteNome: "João Araújo",
            incluirGraficos: false,
        });
        const pdfSemGraf = Buffer.from(bytesSemGraf).toString("latin1");
        assert.ok(!pdfSemGraf.includes(toPdfHex("COMPARATIVO DE TAXAS E CUSTO TOTAL")));
    });

    it("calcula séries gráficas do contrato (inclusive Olinda) e estatísticas consolidadas da carteira", () => {
        const res = calcularProcessoRevisional(baseInput);

        // Contrato 2 usa Olinda BCB, mas historicoBacenContrato ainda retorna a curva oficial do BACEN/SGS
        const histOlinda = historicoBacenContrato(res.contratos[1]);
        assert.ok(histOlinda !== null);
        assert.equal(histOlinda.usandoParadigmaExterno, true);
        assert.ok(histOlinda.pontos.length >= 12);

        const saldo = serieSaldoDevedorContrato(res.contratos[0]);
        assert.ok(saldo.pontos.length >= 3);
        assert.ok(saldo.parcelaQuitacaoAntecipada !== null && saldo.parcelaQuitacaoAntecipada < 48);

        const comp = composicaoCustoContrato(res.contratos[0]);
        assert.equal(comp.principal, 40000);
        assert.ok(comp.excessoJurosNominal > 0);

        // Agregação da carteira agrupa "Banco do Brasil" e "BCO DO BRASIL S.A."
        const p1 = processoParaPayload(res, baseInput, {
            clienteNome: "Cliente A",
            processoGlobal: "",
            banco: "Banco do Brasil",
            documentoContrato: "",
            categoriaId: "cat-busca",
            observacoes: "",
        });
        const p2 = processoParaPayload(res, baseInput, {
            clienteNome: "Cliente B",
            processoGlobal: "",
            banco: "BCO DO BRASIL S.A.",
            documentoContrato: "",
            categoriaId: "cat-busca",
            observacoes: "",
        });
        const stats = agregarEstatisticasCarteira(
            [
                {
                    ...p1,
                    banco: "Banco do Brasil",
                    id: "1",
                    created_by_email: "contato@iangranja.adv.br",
                    created_at: "2026-11-17T00:00:00Z",
                    updated_at: "2026-11-17T00:00:00Z",
                },
                {
                    ...p2,
                    banco: "BCO DO BRASIL S.A.",
                    id: "2",
                    created_by_email: "contato@iangranja.adv.br",
                    created_at: "2026-11-17T00:00:00Z",
                    updated_at: "2026-11-17T00:00:00Z",
                },
            ],
            [{ id: "cat-busca", nome: "Busca e Apreensão", cor: "crimson", ordem: 1, created_at: "2026-11-17T00:00:00Z" }],
        );
        assert.equal(stats.totalCasos, 2);
        assert.equal(stats.porBanco.length, 1);
        assert.equal(stats.porBanco[0].nome, "Banco do Brasil");
        assert.equal(stats.porBanco[0].casos, 2);
        assert.equal(stats.porCategoria[0].casos, 2);
    });
});
