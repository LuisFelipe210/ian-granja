import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatarNomeParte, resumirTeorPublicacao } from "../src/lib/juros/djen.ts";
import { MODALIDADES } from "../src/lib/juros/index.ts";
import {
    PARAMETROS_DECISAO_PADRAO,
    calcularProcessoRevisional,
    hojeISO,
    type ProcessoRevisionalInput,
} from "../src/lib/juros/revisional-pro.ts";
import {
    aplicarExtracaoClaudeAoEstado,
    executarExtracaoClaudeServer,
    interpretarComandoLocalFallback,
    normalizarTipoTarifa,
} from "../src/lib/juros/claude-revisional.ts";
import {
    anexarMovimentacaoDjenAoProcesso,
    atualizarFichaProcessoDjen,
    consultarDjen,
    criarPayloadCarteiraDeDjen,
    cruzarComunicacoesComCarteira,
    ehAdvogadoDoProcesso,
    extrairDadosCarteiraDeDjen,
    lerDadosProcessoDjen,
    limparTextoDjen,
    marcarPublicacoesDjenComoVistas,
    normalizarNumeroProcessoDjen,
    urlHttpSegura,
    verificarPublicacoesDjen,
} from "../src/lib/juros/djen.ts";
import {
    RevisionalServerDb,
    handleMcpJsonRpc,
    type RevisionalDbAdapter,
} from "../src/lib/mcp/revisional-mcp-core.ts";
import {
    calculoParaProcesso,
    fichaSemCalculoParaPayload,
    isCalculoPendente,
    montarTextoPeticaoPro,
    prepararRenovacaoCalculo,
    processoParaPayload,
    type CalculoPayload,
    type CalculoSalvo,
    type Categoria,
    type CategoriaCor,
    type FichaCliente,
} from "../src/lib/revisional-db.ts";
import { handleClaudeRevisionalRequest, type ApiHttpResponse } from "../api/claude-revisional.ts";
import { handleMcpHttpRequest } from "../api/mcp.ts";
import { handleDjenSync } from "../api/djen-sync.ts";

function criarMockBacenFetch(): typeof fetch {
    return (async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("api.bcb.gov.br/dados/serie/bcdata.sgs.")) {
            const payload = [
                { data: "01/01/2025", valor: "0.45" },
                { data: "01/02/2025", valor: "0.52" },
                { data: "01/03/2025", valor: "0.48" },
                { data: "01/04/2025", valor: "0.40" },
                { data: "01/05/2025", valor: "0.35" },
                { data: "01/06/2025", valor: "0.30" },
                { data: "01/11/2025", valor: "0.42" },
                { data: "01/12/2025", valor: "0.55" },
                { data: "01/01/2026", valor: "0.50" },
                { data: "01/02/2026", valor: "0.44" },
                { data: "01/03/2026", valor: "0.39" },
            ];
            return new Response(JSON.stringify(payload), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }
        return new Response(JSON.stringify({ value: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }) as typeof fetch;
}

class MemoryRevisionalDb implements RevisionalDbAdapter {
    categorias: Categoria[];
    calculos: CalculoSalvo[];
    private seq = 1;

    constructor(categorias: Categoria[] = [], calculos: CalculoSalvo[] = []) {
        this.categorias = [...categorias];
        this.calculos = [...calculos];
    }

    async listarCategorias(): Promise<Categoria[]> {
        return [...this.categorias].sort((a, b) => a.ordem - b.ordem);
    }

    async criarCategoria(nome: string, cor: CategoriaCor = "gold", ordem?: number): Promise<Categoria> {
        const existente = this.categorias.find((c) => c.nome.toLowerCase() === nome.trim().toLowerCase());
        if (existente) return existente;
        const cat: Categoria = {
            id: `cat-${this.seq++}`,
            nome: nome.trim(),
            cor,
            ordem: ordem ?? this.categorias.length + 1,
            created_at: new Date().toISOString(),
        };
        this.categorias.push(cat);
        return cat;
    }

    async listarCalculos(): Promise<CalculoSalvo[]> {
        return [...this.calculos].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }

    async criarCalculo(payload: CalculoPayload): Promise<CalculoSalvo> {
        const now = new Date().toISOString();
        const salvo: CalculoSalvo = {
            ...payload,
            id: `calc-${this.seq++}`,
            created_by_email: "contato@iangranja.adv.br",
            created_at: now,
            updated_at: now,
        };
        this.calculos.unshift(salvo);
        return salvo;
    }

    async atualizarCalculo(id: string, payload: Partial<CalculoPayload>): Promise<CalculoSalvo> {
        const idx = this.calculos.findIndex((c) => c.id === id);
        if (idx < 0) throw new Error(`Calculo ${id} não encontrado`);
        const updated: CalculoSalvo = {
            ...this.calculos[idx],
            ...payload,
            updated_at: new Date().toISOString(),
        };
        this.calculos[idx] = updated;
        return updated;
    }
}

function createMockHttpRes() {
    let statusCode = 200;
    let body: unknown = null;
    const headers: Record<string, string> = {};
    const res: ApiHttpResponse = {
        status(code: number) {
            statusCode = code;
            return res;
        },
        setHeader(k: string, v: string) {
            headers[k] = v;
        },
        json(payload: unknown) {
            body = payload;
            return res;
        },
        end() {
            return res;
        },
    };
    return { res, getStatus: () => statusCode, getBody: () => body, headers };
}

describe("Renovação automática e resumo compartilhado", () => {
    it("prepararRenovacaoCalculo atualiza data-base, inclui alvará e recalcula proveito econômico", async () => {
        const prevFetch = globalThis.fetch;
        globalThis.fetch = criarMockBacenFetch();
        try {
            const processoInicial: ProcessoRevisionalInput = {
                parametros: {
                    ...PARAMETROS_DECISAO_PADRAO(),
                    indiceCorrecao: "NENHUM",
                    tipoJuros: "FIXO_1",
                    dataBaseAtualizacao: "2026-01-10",
                },
                contratos: [
                    {
                        id: "c-1",
                        descricao: "Financiamento",
                        instituicao: "BANCO SANTANDER (BRASIL) S.A.",
                        numeroContrato: "CCB-100",
                        pessoa: "pf",
                        modalidadeId: "veiculo-pf",
                        dataContrato: "2025-10-10",
                        primeiroVencimento: "2025-11-10",
                        valorFinanciado: 40000,
                        valorParcela: 1850,
                        parcelas: 48,
                        pagas: 5,
                        taxaMensal: 3.1,
                        fonteTaxaRevisional: "media_sgs",
                        bancoOlinda: null,
                        pagamentosExtras: [],
                    },
                ],
                tarifas: [],
                deducoes: [],
            };
            const fichaInicial: FichaCliente = {
                clienteNome: "Carlos Silva",
                processoGlobal: "",
                banco: "BANCO SANTANDER (BRASIL) S.A.",
                documentoContrato: "CCB-100",
                categoriaId: "cat-triagem",
                observacoes: "Caso inicial.",
            };

            const resInicial = calcularProcessoRevisional(processoInicial);
            const payloadInicial = processoParaPayload(resInicial, processoInicial, fichaInicial);
            const salvo: CalculoSalvo = {
                ...payloadInicial,
                id: "calc-ren-1",
                created_by_email: "contato@iangranja.adv.br",
                created_at: "2026-01-10T10:00:00Z",
                updated_at: "2026-01-10T10:00:00Z",
            };

            const renovadoSemDeducao = await prepararRenovacaoCalculo(salvo, {
                novaDataBase: "2026-11-18",
            });
            assert.equal(renovadoSemDeducao.dataBaseAnterior, "2026-01-10");
            assert.equal(renovadoSemDeducao.dataBaseNova, "2026-11-18");
            assert.ok(
                renovadoSemDeducao.valorNovo > renovadoSemDeducao.valorAnterior,
                `Esperava aumento na atualização monetária (${renovadoSemDeducao.valorAnterior} -> ${renovadoSemDeducao.valorNovo})`,
            );

            const renovadoComAlvara = await prepararRenovacaoCalculo(salvo, {
                novaDataBase: "2026-11-18",
                fichaPatch: { processoGlobal: "0001111-22.2026.8.17.1130" },
                novasDeducoes: [
                    {
                        id: "ded-1",
                        descricao: "Alvará levantado",
                        valor: 1000,
                        data: "2026-11-18",
                        atualizar: false,
                    },
                ],
            });
            assert.equal(renovadoComAlvara.ficha.processoGlobal, "0001111-22.2026.8.17.1130");
            assert.ok(renovadoComAlvara.valorNovo < renovadoSemDeducao.valorNovo);

            const texto = montarTextoPeticaoPro(renovadoComAlvara.resultado, renovadoComAlvara.ficha, {
                id: "cat-triagem",
                nome: "Triagem",
                cor: "gold",
                ordem: 1,
                created_at: "",
            });
            assert.ok(texto.includes("Carlos Silva"));
            assert.ok(texto.includes("0001111-22.2026.8.17.1130"));
            assert.ok(texto.includes("Proveito econômico"));
        } finally {
            globalThis.fetch = prevFetch;
        }
    });
});

describe("Extração Claude e parser de comandos", () => {
    it("interpretarComandoLocalFallback extrai atualização com alvará e novo cadastro completo", () => {
        const atualizacao = interpretarComandoLocalFallback(
            "Atualiza o cálculo deste cliente para hoje e inclui alvará de R$ 5.000",
            "",
            true,
        );
        assert.equal(atualizacao.modoOperacao, "atualizar_caso_atual");
        assert.equal(atualizacao.acaoSugerida, "calcular_e_salvar");
        assert.equal(atualizacao.ficha.clienteNome, undefined);
        assert.equal(atualizacao.parametros?.dataBaseAtualizacao, hojeISO());
        assert.equal(atualizacao.deducoes?.length, 1);
        assert.equal(atualizacao.deducoes?.[0].valor, 5000);

        const novo = interpretarComandoLocalFallback(
            "Lê esse contrato do Santander, cadastra o cliente João da Silva na fase Busca e Apreensão, veículo PF, data 15/03/2024, valor financiado R$ 45.000, 48x de R$ 1.750, 10 pagas, taxa 2,95% a.m., seguro prestamista de R$ 2.100 em dobro",
            "",
            false,
        );
        assert.equal(novo.modoOperacao, "novo_caso");
        assert.equal(novo.ficha.clienteNome, "João da Silva");
        assert.equal(novo.ficha.banco, "BANCO SANTANDER (BRASIL) S.A.");
        assert.equal(novo.ficha.categoriaNome, "Busca e Apreensão");
        assert.equal(novo.contratos?.[0]?.dataContrato, "2024-03-15");
        assert.equal(novo.contratos?.[0]?.valorFinanciado, 45000);
        assert.equal(novo.contratos?.[0]?.valorParcela, 1750);
        assert.equal(novo.contratos?.[0]?.parcelas, 48);
        assert.equal(novo.contratos?.[0]?.pagas, 10);
        assert.equal(novo.contratos?.[0]?.taxaMensal, 2.95);
        assert.equal(novo.tarifas?.[0]?.tipo, "Seguro Prestamista");
        assert.equal(novo.tarifas?.[0]?.valor, 2100);
        assert.equal(novo.tarifas?.[0]?.emDobro, true);

        const categorias: Categoria[] = [
            { id: "cat-ba", nome: "Busca e Apreensão", cor: "crimson", ordem: 2, created_at: "" },
        ];
        const aplicado = aplicarExtracaoClaudeAoEstado(novo, {
            ficha: {
                clienteNome: "",
                processoGlobal: "",
                banco: "",
                documentoContrato: "",
                categoriaId: null,
                observacoes: "",
            },
            processo: {
                parametros: PARAMETROS_DECISAO_PADRAO(),
                contratos: [],
                tarifas: [],
                deducoes: [],
            },
            categorias,
        });
        assert.equal(aplicado.ficha.categoriaId, "cat-ba");
        assert.equal(aplicado.ficha.clienteNome, "João da Silva");
        assert.equal(aplicado.processo.tarifas.length, 1);
    });

    it("executarExtracaoClaudeServer envia anexo PDF para API da Anthropic e lê tool_use estruturado", async () => {
        let capturedUrl = "";
        let capturedBody: Record<string, unknown> | null = null;
        const mockAnthropicFetch = (async (input: string | URL | Request, init?: RequestInit) => {
            capturedUrl = String(input);
            capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
            return new Response(
                JSON.stringify({
                    id: "msg_test",
                    content: [
                        {
                            type: "tool_use",
                            name: "preencher_calculo_revisional",
                            input: {
                                modoOperacao: "novo_caso",
                                acaoSugerida: "calcular_e_salvar",
                                resumoExplicacao: "Contrato Santander CCB lido com Seguro Prestamista.",
                                ficha: {
                                    clienteNome: "Mariana Oliveira",
                                    banco: "Santander",
                                    documentoContrato: "CCB-998877",
                                    categoriaNome: "Busca e Apreensão",
                                },
                                contratos: [
                                    {
                                        instituicao: "Santander",
                                        modalidadeId: "veiculo-pf",
                                        dataContrato: "2025-11-10",
                                        valorFinanciado: 42000,
                                        valorParcela: 1680,
                                        parcelas: 48,
                                        pagas: 6,
                                        taxaMensal: 2.89,
                                    },
                                ],
                                tarifas: [
                                    {
                                        tipo: "Seguro Prestamista",
                                        valor: 1950,
                                        emDobro: true,
                                    },
                                ],
                            },
                        },
                    ],
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            );
        }) as typeof fetch;

        const out = await executarExtracaoClaudeServer({
            comando: "Lê esse contrato e cadastra na fase Busca e Apreensão",
            arquivos: [
                {
                    nome: "ccb-santander.pdf",
                    mediaType: "application/pdf",
                    base64: Buffer.from("%PDF-1.4 mock").toString("base64"),
                },
            ],
            apiKey: "sk-ant-test-key",
            fetchFn: mockAnthropicFetch,
        });

        assert.equal(capturedUrl, "https://api.anthropic.com/v1/messages");
        assert.ok(capturedBody);
        assert.equal(out.fonte, "claude_api");
        assert.equal(out.extracao.ficha.clienteNome, "Mariana Oliveira");
        assert.equal(out.extracao.tarifas?.[0]?.valor, 1950);

        // Endpoint HTTP /api/claude-revisional
        const { res, getStatus, getBody } = createMockHttpRes();
        await handleClaudeRevisionalRequest(
            {
                method: "POST",
                headers: { host: "localhost:8080" },
                body: {
                    comando: "Atualiza este cliente para hoje e inclui alvará de R$ 2.500",
                    estadoAtual: {
                        ficha: {
                            clienteNome: "Mariana Oliveira",
                            banco: "BANCO SANTANDER (BRASIL) S.A.",
                            documentoContrato: "CCB-998877",
                            categoriaId: null,
                            observacoes: "",
                        },
                    },
                },
            },
            res,
            { skipAuthCheck: true, apiKey: "" },
        );
        assert.equal(getStatus(), 200);
        const apiBody = getBody() as { ok: boolean; fonte: string; extracao: { deducoes?: Array<{ valor: number }> } };
        assert.equal(apiBody.ok, true);
        assert.equal(apiBody.fonte, "parser_local");
        assert.equal(apiBody.extracao.deducoes?.[0]?.valor, 2500);
    });
});

describe("Servidor e ferramentas MCP do Claude", () => {
    it("executa ciclo completo: initialize, tools/list, cadastrar, consultar Banco Pan >= 1,8x, renovar e mover Kanban", async () => {
        const prevFetch = globalThis.fetch;
        globalThis.fetch = criarMockBacenFetch();
        try {
            const db = new MemoryRevisionalDb([
                { id: "cat-1", nome: "Triagem", cor: "gold", ordem: 1, created_at: "" },
                { id: "cat-2", nome: "Busca e Apreensão", cor: "crimson", ordem: 2, created_at: "" },
                { id: "cat-3", nome: "Ajuizado", cor: "emerald", ordem: 3, created_at: "" },
            ]);

            // 1. Initialize & tools/list
            const initRes = await handleMcpJsonRpc(
                { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } },
                db,
            );
            assert.equal((initRes?.result as { serverInfo: { name: string } }).serverInfo.name, "ian-granja-revisional-mcp");

            const listRes = await handleMcpJsonRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, db);
            const tools = (listRes?.result as { tools: Array<{ name: string }> }).tools;
            assert.equal(tools.length, 12);

            // 2. Cadastrar caso Santander com seguro prestamista em dobro
            const cadRes = await handleMcpJsonRpc(
                {
                    jsonrpc: "2.0",
                    id: 3,
                    method: "tools/call",
                    params: {
                        name: "calcular_e_cadastrar_caso_revisional",
                        arguments: {
                            clienteNome: "Roberto Mendes",
                            banco: "Santander",
                            categoriaNome: "Busca e Apreensão",
                            contratos: [
                                {
                                    modalidadeId: "veiculo-pf",
                                    dataContrato: "2025-11-10",
                                    valorFinanciado: 45000,
                                    valorParcela: 1850,
                                    parcelas: 48,
                                    pagas: 8,
                                    taxaMensal: 3.15,
                                },
                            ],
                            tarifas: [{ tipo: "Seguro Prestamista", valor: 2100, emDobro: true }],
                        },
                    },
                },
                db,
            );
            const cadPayload = JSON.parse(
                (cadRes?.result as { content: Array<{ text: string }> }).content[0].text,
            ) as { id: string; salvoNoHistorico: boolean; faseKanban: string; resumoParaPeticao: string };
            assert.equal(cadPayload.salvoNoHistorico, true);
            assert.equal(cadPayload.faseKanban, "Busca e Apreensão");
            assert.ok(cadPayload.resumoParaPeticao.includes("Roberto Mendes"));
            assert.ok(cadPayload.resumoParaPeticao.includes("Seguro Prestamista"));

            // 3. Cadastrar caso Banco Pan com abuso > 1,8x
            await handleMcpJsonRpc(
                {
                    jsonrpc: "2.0",
                    id: 4,
                    method: "tools/call",
                    params: {
                        name: "calcular_e_cadastrar_caso_revisional",
                        arguments: {
                            clienteNome: "Fernanda Costa",
                            banco: "Banco Pan",
                            categoriaNome: "Triagem",
                            contratos: [
                                {
                                    modalidadeId: "veiculo-pf",
                                    dataContrato: "2025-11-10",
                                    valorFinanciado: 30000,
                                    valorParcela: 1750,
                                    parcelas: 48,
                                    pagas: 6,
                                    taxaMensal: 4.9,
                                },
                            ],
                        },
                    },
                },
                db,
            );

            // 4. Consultar carteira: "Quais clientes do Banco Pan têm abuso acima de 1,8x?"
            const consRes = await handleMcpJsonRpc(
                {
                    jsonrpc: "2.0",
                    id: 5,
                    method: "tools/call",
                    params: {
                        name: "consultar_carteira_clientes",
                        arguments: {
                            banco: "Banco Pan",
                            razaoMinima: 1.8,
                        },
                    },
                },
                db,
            );
            const consPayload = JSON.parse(
                (consRes?.result as { content: Array<{ text: string }> }).content[0].text,
            ) as { totalEncontrados: number; clientes: Array<{ clienteNome: string; razaoAbuso: number }> };
            assert.equal(consPayload.totalEncontrados, 1);
            assert.equal(consPayload.clientes[0].clienteNome, "Fernanda Costa");
            assert.ok(consPayload.clientes[0].razaoAbuso >= 1.8);

            // 5. Renovar caso existente preenchendo CNJ e incluindo alvará
            const renRes = await handleMcpJsonRpc(
                {
                    jsonrpc: "2.0",
                    id: 6,
                    method: "tools/call",
                    params: {
                        name: "renovar_e_atualizar_caso",
                        arguments: {
                            clienteNome: "Roberto Mendes",
                            processoGlobal: "0009999-88.2026.8.17.1130",
                            novaDataBase: "2026-11-18",
                            novasDeducoes: [{ descricao: "Alvará", valor: 1500, atualizar: false }],
                        },
                    },
                },
                db,
            );
            const renPayload = JSON.parse(
                (renRes?.result as { content: Array<{ text: string }> }).content[0].text,
            ) as { processoGlobal: string; dataBaseNova: string };
            assert.equal(renPayload.processoGlobal, "0009999-88.2026.8.17.1130");
            assert.equal(renPayload.dataBaseNova, "2026-11-18");

            // 6. Mover cartão no Kanban
            const moveRes = await handleMcpJsonRpc(
                {
                    jsonrpc: "2.0",
                    id: 7,
                    method: "tools/call",
                    params: {
                        name: "mover_cartao_kanban",
                        arguments: {
                            clienteNome: "Roberto Mendes",
                            novaCategoriaNome: "Ajuizado",
                        },
                    },
                },
                db,
            );
            const movePayload = JSON.parse(
                (moveRes?.result as { content: Array<{ text: string }> }).content[0].text,
            ) as { faseAnterior: string; faseAtual: string };
            assert.equal(movePayload.faseAnterior, "Busca e Apreensão");
            assert.equal(movePayload.faseAtual, "Ajuizado");

            // 7. Endpoint HTTP /api/mcp
            const { res, getStatus, getBody } = createMockHttpRes();
            await handleMcpHttpRequest(
                {
                    method: "POST",
                    headers: { host: "localhost:8080" },
                    body: { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "listar_fases_e_modalidades", arguments: {} } },
                },
                res,
                { db },
            );
            assert.equal(getStatus(), 200);
            const httpPayload = JSON.parse(
                ((getBody() as { result: { content: Array<{ text: string }> } }).result.content[0].text),
            ) as { totalCasosCarteira: number; modalidades: unknown[] };
            assert.equal(httpPayload.totalCasosCarteira, 2);
            assert.equal(httpPayload.modalidades.length, MODALIDADES.length);

            // 8. Consulta DJEN (CNJ) e cruzamento com carteira + MCP consultar_publicacoes_djen
            globalThis.fetch = (async (input: string | URL | Request) => {
                const url = String(input);
                if (url.includes("comunicaapi.pje.jus.br/api/v1/comunicacao")) {
                    return new Response(
                        JSON.stringify({
                            status: "success",
                            count: 2,
                            items: [
                                {
                                    id: 1001,
                                    data_disponibilizacao: "2026-11-17",
                                    datadisponibilizacao: "17/11/2026",
                                    siglaTribunal: "TJPE",
                                    tipoComunicacao: "Intimação",
                                    nomeOrgao: "1ª Vara Cível de Petrolina",
                                    nomeClasse: "PROCEDIMENTO COMUM CÍVEL",
                                    numero_processo: "00099998820268171130",
                                    numeroprocessocommascara: "0009999-88.2026.8.17.1130",
                                    texto: "<p>Intime-se o autor para manifestação sobre o laudo e alvará.<br/>Prazo de 15 dias.</p>",
                                    link: "https://pje.tjpe.jus.br/exemplo",
                                    destinatarios: [
                                        { nome: "ROBERTO MENDES", polo: "A" },
                                        { nome: "BANCO SANTANDER (BRASIL) S.A.", polo: "P" },
                                    ],
                                    destinatarioadvogados: [
                                        { advogado: { nome: "IAN FELIPE MENEZES SOUZA GRANJA", numero_oab: "61107", uf_oab: "PE" } },
                                    ],
                                },
                                {
                                    id: 1002,
                                    data_disponibilizacao: "2026-11-16",
                                    datadisponibilizacao: "16/11/2026",
                                    siglaTribunal: "TJBA",
                                    tipoComunicacao: "Despacho",
                                    nomeOrgao: "2ª Vara Cível de Juazeiro",
                                    nomeClasse: "BUSCA E APREENSÃO",
                                    numero_processo: "00012340020268050146",
                                    numeroprocessocommascara: "0001234-00.2026.8.05.0146",
                                    texto: "Cite-se o requerido.",
                                    link: "https://projudi.tjba.jus.br/exemplo",
                                    destinatarios: [
                                        { nome: "BANCO PAN S.A.", polo: "A" },
                                        { nome: "ALINE SOUZA", polo: "P" },
                                    ],
                                    destinatarioadvogados: [],
                                },
                            ],
                        }),
                        { status: 200, headers: { "Content-Type": "application/json" } },
                    );
                }
                return criarMockBacenFetch()(input);
            }) as typeof fetch;

            assert.equal(normalizarNumeroProcessoDjen("0009999-88.2026.8.17.1130"), "00099998820268171130");
            assert.equal(limparTextoDjen("<p>Linha 1<br/>Linha 2</p>"), "Linha 1\nLinha 2");

            const djenRes = await consultarDjen({ numeroOab: "61107", ufOab: "PE" });
            assert.equal(djenRes.totalRegistros, 2);
            const calcsCarteira = await db.listarCalculos();
            const categoriasCarteira = await db.listarCategorias();
            const cruzadas = cruzarComunicacoesComCarteira(djenRes.items, calcsCarteira, categoriasCarteira);
            assert.equal(cruzadas[0].clienteVinculado?.clienteNome, "Roberto Mendes");
            assert.equal(cruzadas[0].clienteVinculado?.correspondenciaPor, "cnj");
            assert.equal(cruzadas[1].clienteVinculado, null);
            assert.equal(cruzadas[1].bancoDetectado, "BANCO PAN S.A.");

            const baseCom = djenRes.items[0];
            const calcBase = calcsCarteira[0];
            const semCnjMatch = cruzarComunicacoesComCarteira(
                [
                    {
                        ...baseCom,
                        id: 2001,
                        numeroProcessoDigitos: "00055551120268171130",
                        numeroProcessoMascara: "0005555-11.2026.8.17.1130",
                        destinatarios: [{ nome: "FERNANDA COSTA", polo: "A" }],
                    },
                    {
                        ...baseCom,
                        id: 2002,
                        numeroProcessoDigitos: "00077771120268171130",
                        numeroProcessoMascara: "0007777-11.2026.8.17.1130",
                        destinatarios: [{ nome: "ROBERTO MENDES", polo: "A" }],
                    },
                    {
                        ...baseCom,
                        id: 2003,
                        numeroProcessoDigitos: "00008318220235050291",
                        numeroProcessoMascara: "0000831-82.2023.5.05.0291",
                        destinatarios: [{ nome: "PEDRO HENRIQUE LOBO FAGUNDES", polo: "A" }],
                    },
                    {
                        ...baseCom,
                        id: 2004,
                        numeroProcessoDigitos: "80016053720248050146",
                        numeroProcessoMascara: "8001605-37.2024.8.05.0146",
                        destinatarios: [
                            {
                                nome: "COOPERATIVA DE CREDITO DO VALE DO SAO FRANCISCO - SICREDI VALE DO SAO FRANCISCO",
                                polo: "P",
                            },
                        ],
                    },
                ],
                [
                    ...calcsCarteira,
                    {
                        ...calcBase,
                        id: "calc-pedro-seed",
                        cliente_nome: "Pedro Henrique Damasceno",
                        processo_global: "",
                    },
                    {
                        ...calcBase,
                        id: "calc-transp-seed",
                        cliente_nome: "Transportadora São Francisco ME",
                        processo_global: "",
                    },
                ],
                categoriasCarteira,
            );
            assert.equal(semCnjMatch[0].clienteVinculado?.clienteNome, "Fernanda Costa");
            assert.equal(semCnjMatch[0].clienteVinculado?.correspondenciaPor, "nome");
            assert.equal(semCnjMatch[1].clienteVinculado, null);
            assert.equal(semCnjMatch[2].clienteVinculado, null);
            assert.equal(semCnjMatch[3].clienteVinculado, null);

            const mcpDjenRes = await handleMcpJsonRpc(
                {
                    jsonrpc: "2.0",
                    id: 9,
                    method: "tools/call",
                    params: {
                        name: "consultar_publicacoes_djen",
                        arguments: {
                            clienteNome: "Roberto Mendes",
                            apenasClientesDaCarteira: true,
                        },
                    },
                },
                db,
            );
            const mcpDjenPayload = JSON.parse(
                (mcpDjenRes?.result as { content: Array<{ text: string }> }).content[0].text,
            ) as { comVinculoNaCarteira: number; publicacoes: Array<{ teor: string; tribunal: string }> };
            assert.equal(mcpDjenPayload.comVinculoNaCarteira, 1);
            assert.equal(mcpDjenPayload.publicacoes[0].tribunal, "TJPE");
            assert.ok(mcpDjenPayload.publicacoes[0].teor.includes("Prazo de 15 dias."));

            // 9. Extração de ficha para Carteira a partir do DJEN e filtragem de advogados/siglas
            const advsTeste = [
                { nome: "IAN FELIPE MENEZES SOUZA GRANJA", numeroOab: "61107", ufOab: "PE" },
                { nome: "LUCIANO GONCALVES OLIVIERI", numeroOab: "11703", ufOab: "ES" },
            ];
            assert.equal(ehAdvogadoDoProcesso("I. F. M. S. G.", advsTeste), true);
            assert.equal(ehAdvogadoDoProcesso("L. G. O.", advsTeste), true);
            assert.equal(ehAdvogadoDoProcesso("LUCIANO GONCALVES OLIVIERI", advsTeste), true);
            assert.equal(ehAdvogadoDoProcesso("L. D. S. R.", advsTeste), false);

            const djenRawSigilo = await consultarDjen(
                { numeroOab: "61107", ufOab: "PE" },
                (async () =>
                    new Response(
                        JSON.stringify({
                            count: 2,
                            items: [
                                {
                                    id: 3001,
                                    data_disponibilizacao: "2026-11-16",
                                    siglaTribunal: "TJBA",
                                    tipoComunicacao: "Intimação",
                                    nomeOrgao: "1ª Vara de Casa Nova",
                                    nomeClasse: "BUSCA E APREENSÃO EM ALIENAÇÃO FIDUCIÁRIA",
                                    numero_processo: "80005272820268050052",
                                    numeroprocessocommascara: "8000527-28.2026.8.05.0052",
                                    texto: "Ação referente ao Contrato nº SANT-884412. Valor da causa: R$ 45.200,00.",
                                    destinatarios: [
                                        { nome: "I. F. M. S. G.", polo: "P" },
                                        { nome: "L. D. S. R.", polo: "P" },
                                        { nome: "L. G. O.", polo: "A" },
                                        {
                                            nome: "SANTANDER SOCIEDADE DE CREDITO, FINANCIAMENTO E INVESTIMENTO S.A.",
                                            polo: "A",
                                        },
                                    ],
                                    destinatarioadvogados: [
                                        { advogado: { nome: "IAN FELIPE MENEZES SOUZA GRANJA", numero_oab: "61107", uf_oab: "PE" } },
                                        { advogado: { nome: "LUCIANO GONCALVES OLIVIERI", numero_oab: "11703", uf_oab: "ES" } },
                                    ],
                                },
                                {
                                    id: 3002,
                                    data_disponibilizacao: "2026-11-16",
                                    siglaTribunal: "TJBA",
                                    tipoComunicacao: "Sentença",
                                    nomeOrgao: "1ª Vara da Fazenda Pública",
                                    nomeClasse: "PROCEDIMENTO COMUM CÍVEL",
                                    numero_processo: "80027238220238050146",
                                    numeroprocessocommascara: "8002723-82.2023.8.05.0146",
                                    texto: "Intime-se a parte autora.",
                                    destinatarios: [
                                        { nome: "FABRICIO EVANGELISTA DE SOUZA", polo: "A" },
                                        { nome: "IAN FELIPE MENEZES SOUZA GRANJA", polo: "A" },
                                        { nome: "ESTADO DA BAHIA", polo: "P" },
                                    ],
                                    destinatarioadvogados: [
                                        { advogado: { nome: "IAN FELIPE MENEZES SOUZA GRANJA", numero_oab: "61107", uf_oab: "PE" } },
                                    ],
                                },
                            ],
                        }),
                        { status: 200, headers: { "Content-Type": "application/json" } },
                    )) as typeof fetch,
            );
            assert.equal(djenRawSigilo.items[0].clienteSugerido, "L. D. S. R.");
            assert.equal(djenRawSigilo.items[0].bancoDetectado, "BANCO SANTANDER (BRASIL) S.A.");
            assert.equal(djenRawSigilo.items[1].clienteSugerido, "FABRICIO EVANGELISTA DE SOUZA");
            assert.equal(djenRawSigilo.items[1].bancoDetectado, "ESTADO DA BAHIA");

            const tiposCarteira = [
                { id: "tipo-ba", nome: "Busca e Apreensão", cor: "crimson" as const, ordem: 1, created_at: "" },
                { id: "tipo-rev", nome: "Revisional", cor: "ink" as const, ordem: 2, created_at: "" },
            ];
            const payloadCarteiraDjen = criarPayloadCarteiraDeDjen(
                djenRawSigilo.items[0],
                categoriasCarteira,
                {},
                tiposCarteira,
            );
            assert.equal(payloadCarteiraDjen.cliente_nome, "L. D. S. R.");
            assert.equal(payloadCarteiraDjen.banco, "BANCO SANTANDER (BRASIL) S.A.");
            assert.equal(payloadCarteiraDjen.documento_contrato, "SANT-884412");
            assert.equal(payloadCarteiraDjen.modalidade_id, "veiculo-pf");
            assert.equal(payloadCarteiraDjen.valor_total_acao, 45200);
            // Fase = Ajuizado (todo processo do DJEN já está em juízo); categoria = tipo da ação pela classe.
            assert.equal(
                payloadCarteiraDjen.categoria_id,
                categoriasCarteira.find((c) => c.nome === "Ajuizado")?.id ?? null,
            );
            assert.equal(payloadCarteiraDjen.tipo_id, "tipo-ba");
            assert.equal(isCalculoPendente(payloadCarteiraDjen), true);

            const salvoPendente = await db.criarCalculo(payloadCarteiraDjen);
            assert.equal(isCalculoPendente(salvoPendente), true);
            const restauradoPendente = calculoParaProcesso(salvoPendente);
            assert.equal(restauradoPendente.processo.contratos[0].valorFinanciado, 0);
            assert.equal(restauradoPendente.processo.contratos[0].parcelas, 0);

            const extraidoSemBanco = extrairDadosCarteiraDeDjen(
                djenRawSigilo.items[1],
                categoriasCarteira,
            );
            assert.equal(extraidoSemBanco.ficha.clienteNome, "FABRICIO EVANGELISTA DE SOUZA");
            assert.equal(extraidoSemBanco.ficha.banco, "ESTADO DA BAHIA");
            assert.equal(extraidoSemBanco.categoriaNomeSugerida, "Ajuizado");

            // 10. Visualização e timeline completa do processo salvo em Processos (DJEN)
            const viewInicial = lerDadosProcessoDjen(salvoPendente);
            assert.equal(viewInicial.tribunal, "TJBA");
            assert.equal(viewInicial.orgao, "1ª Vara de Casa Nova");
            assert.equal(viewInicial.statusProcesso, "prazo_aberto");
            assert.equal(viewInicial.movimentacoes.length, 1);
            assert.equal(viewInicial.destinatarios.length, 4);
            assert.equal(viewInicial.advogados.length, 2);

            const patchAnexo = anexarMovimentacaoDjenAoProcesso(salvoPendente, {
                ...djenRawSigilo.items[0],
                id: 3099,
                dataDisponibilizacao: "2026-11-18",
                dataDisponibilizacaoBr: "18/11/2026",
                tipoComunicacao: "Despacho",
                texto: "Designada audiência de justificação prévia para 10/12/2026.",
            });
            const salvoComAnexo = await db.atualizarCalculo(salvoPendente.id, patchAnexo);
            const viewAnexado = lerDadosProcessoDjen(salvoComAnexo);
            assert.equal(viewAnexado.movimentacoes.length, 2);
            assert.equal(viewAnexado.movimentacoes[0].id, 3099);
            assert.equal(viewAnexado.movimentacoes[0].tipoComunicacao, "Despacho");

            // Deduplicação de publicação repetida (mesmo ID)
            const patchDuplicado = anexarMovimentacaoDjenAoProcesso(salvoComAnexo, {
                ...djenRawSigilo.items[0],
                id: 3099,
                dataDisponibilizacao: "2026-11-18",
                dataDisponibilizacaoBr: "18/11/2026",
                tipoComunicacao: "Despacho",
                texto: "Designada audiência de justificação prévia para 10/12/2026.",
            });
            const salvoSemDuplicar = await db.atualizarCalculo(salvoComAnexo.id, patchDuplicado);
            assert.equal(lerDadosProcessoDjen(salvoSemDuplicar).movimentacoes.length, 2);

            const patchEditado = atualizarFichaProcessoDjen(salvoSemDuplicar, {
                statusProcesso: "manifestado",
                anotacoesInternas: "Contestação e reconvenção protocoladas.",
                parteContraria: "BANCO SANTANDER (BRASIL) S.A.",
            });
            const salvoEditado = await db.atualizarCalculo(salvoSemDuplicar.id, patchEditado);
            const viewEditado = lerDadosProcessoDjen(salvoEditado);
            assert.equal(viewEditado.statusProcesso, "manifestado");
            assert.equal(viewEditado.anotacoesInternas, "Contestação e reconvenção protocoladas.");
            assert.equal(viewEditado.movimentacoes.length, 2);

            // Retrocompatibilidade com ficha salva antes da timeline completa
            const legadoDjen: CalculoSalvo = {
                ...salvoPendente,
                id: "legado-djen-1",
                observacoes:
                    "[DJEN 16/11/2026 · TJBA · 1ª Vara Juizados · PROCEDIMENTO DO JUIZADO ESPECIAL CÍVEL · Intimação]\nRecebido o recurso sem efeito suspensivo.\nLink: https://pje.tjba.jus.br/item",
                dados_completos: {
                    pendenteCalculo: true,
                    origemDjen: { id: 788753028, tribunal: "TJBA" },
                } as unknown as Partial<ProcessoRevisionalInput>,
            };
            const viewLegado = lerDadosProcessoDjen(legadoDjen);
            assert.equal(viewLegado.tribunal, "TJBA");
            assert.equal(viewLegado.orgao, "1ª Vara Juizados");
            assert.equal(viewLegado.movimentacoes.length, 1);
            assert.ok(viewLegado.movimentacoes[0].texto.includes("Recebido o recurso"));
            assert.equal(viewLegado.linkUltimaPublicacao, "https://pje.tjba.jus.br/item");
        } finally {
            globalThis.fetch = prevFetch;
        }
    });
});

/* ----------------------------------------------------- Regressões de autenticação e integridade */

const URL_SUPABASE_TESTE = "https://projeto-teste.supabase.co";
const SERVICE_ROLE_TESTE = "service-role-secreta";

async function comEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
    const anteriores = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
    const aplicar = (valores: Record<string, string | undefined>) => {
        for (const [k, v] of Object.entries(valores)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    };
    aplicar(vars);
    try {
        return await fn();
    } finally {
        aplicar(anteriores);
    }
}

/** fetch falso do Supabase que registra os headers de autorização de cada chamada. */
function criarFetchSupabaseEspiao() {
    const chamadas: Array<{ url: string; authorization: string; apikey: string; body?: string }> = [];
    const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const headers = (init?.headers ?? {}) as Record<string, string>;
        chamadas.push({
            url,
            authorization: headers.Authorization ?? "",
            apikey: headers.apikey ?? "",
            body: typeof init?.body === "string" ? init.body : undefined,
        });
        if (url.includes("/auth/v1/token")) {
            return new Response(JSON.stringify({ error_description: "Invalid login credentials" }), { status: 400 });
        }
        return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    return { fetchFn, chamadas };
}

const ENV_SERVIDOR_COM_SERVICE_ROLE = {
    VITE_SUPABASE_URL: URL_SUPABASE_TESTE,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_TESTE,
    MCP_AUTH_TOKEN: undefined,
    NODE_ENV: "development",
    ANTHROPIC_API_KEY: undefined,
};

describe("Autenticação dos endpoints MCP e Claude", () => {
    it("RevisionalServerDb usa o token do chamador e nunca a service role do ambiente", async () => {
        await comEnv(ENV_SERVIDOR_COM_SERVICE_ROLE, async () => {
            const espiao = criarFetchSupabaseEspiao();
            const db = new RevisionalServerDb({ accessToken: "token-do-usuario", fetchFn: espiao.fetchFn });
            await db.listarCalculos();
            assert.equal(espiao.chamadas.length, 1);
            assert.equal(espiao.chamadas[0].authorization, "Bearer token-do-usuario");
            assert.notEqual(espiao.chamadas[0].apikey, SERVICE_ROLE_TESTE);
        });
    });

    it("RevisionalServerDb com e-mail/senha do chamador faz login real e falha com senha errada", async () => {
        await comEnv(ENV_SERVIDOR_COM_SERVICE_ROLE, async () => {
            const espiao = criarFetchSupabaseEspiao();
            const db = new RevisionalServerDb({
                email: "invasor@exemplo.com",
                password: "qualquer",
                fetchFn: espiao.fetchFn,
            });
            await assert.rejects(() => db.listarCalculos(), /Falha ao autenticar no Supabase \(400\)/);
            assert.ok(espiao.chamadas[0].url.includes("/auth/v1/token"));
            assert.ok(espiao.chamadas.every((c) => !c.authorization.includes(SERVICE_ROLE_TESTE)));
        });
    });

    it("RevisionalServerDb sem credenciais do chamador continua usando a service role (rota com MCP_AUTH_TOKEN)", async () => {
        await comEnv(ENV_SERVIDOR_COM_SERVICE_ROLE, async () => {
            const espiao = criarFetchSupabaseEspiao();
            const db = new RevisionalServerDb({ fetchFn: espiao.fetchFn });
            await db.listarCalculos();
            assert.equal(espiao.chamadas[0].authorization, `Bearer ${SERVICE_ROLE_TESTE}`);
        });
    });

    it("/api/mcp valida Bearer via whitelist e repassa o token ao Supabase em vez da service role", async () => {
        await comEnv(ENV_SERVIDOR_COM_SERVICE_ROLE, async () => {
            const espiao = criarFetchSupabaseEspiao();
            const fetchComWhitelist = (async (input: string | URL | Request, init?: RequestInit) => {
                const url = String(input);
                if (url.includes("/rpc/is_escritorio_autorizado")) {
                    const auth = new Headers(init?.headers).get("authorization") ?? "";
                    return new Response(JSON.stringify(auth === "Bearer token-autorizado"), {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    });
                }
                return espiao.fetchFn(input, init);
            }) as typeof fetch;

            const bloqueado = createMockHttpRes();
            await handleMcpHttpRequest(
                {
                    method: "POST",
                    headers: { host: "www.iangranja.adv.br", authorization: "Bearer invasor" },
                    body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
                },
                bloqueado.res,
                { fetchFn: fetchComWhitelist },
            );
            assert.equal(bloqueado.getStatus(), 401);

            const { res, getStatus } = createMockHttpRes();
            await handleMcpHttpRequest(
                {
                    method: "POST",
                    headers: { host: "www.iangranja.adv.br", authorization: "Bearer token-autorizado" },
                    body: {
                        jsonrpc: "2.0",
                        id: 1,
                        method: "tools/call",
                        params: { name: "consultar_carteira_clientes", arguments: {} },
                    },
                },
                res,
                { fetchFn: fetchComWhitelist },
            );
            assert.equal(getStatus(), 200);
            assert.ok(espiao.chamadas.length > 0);
            assert.ok(espiao.chamadas.every((c) => c.authorization === "Bearer token-autorizado"));
        });
    });

    it("/api/mcp sem credenciais exige login mesmo com Host localhost e NODE_ENV=development", async () => {
        await comEnv(ENV_SERVIDOR_COM_SERVICE_ROLE, async () => {
            const { res, getStatus, getBody } = createMockHttpRes();
            await handleMcpHttpRequest(
                {
                    method: "POST",
                    headers: { host: "localhost:8080" },
                    body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
                },
                res,
            );
            assert.equal(getStatus(), 401);
            assert.equal((getBody() as { error: { code: number } }).error.code, -32001);
        });
    });

    it("/api/mcp aceita a conexão quando o plugin de dev confirmou loopback pelo socket", async () => {
        await comEnv(ENV_SERVIDOR_COM_SERVICE_ROLE, async () => {
            const { res, getStatus } = createMockHttpRes();
            await handleMcpHttpRequest(
                {
                    method: "POST",
                    headers: { host: "192.168.0.10:8080" },
                    body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
                },
                res,
                { conexaoLocalVerificada: true },
            );
            assert.equal(getStatus(), 200);
        });
    });

    it("/api/claude-revisional sem Bearer exige login mesmo com Host localhost", async () => {
        await comEnv(ENV_SERVIDOR_COM_SERVICE_ROLE, async () => {
            const corpo = { comando: "Cliente: Ana Souza, financiado R$ 30.000 em 48x de R$ 1.200" };

            const bloqueado = createMockHttpRes();
            await handleClaudeRevisionalRequest(
                { method: "POST", headers: { host: "localhost:8080" }, body: corpo },
                bloqueado.res,
            );
            assert.equal(bloqueado.getStatus(), 401);

            const liberado = createMockHttpRes();
            await handleClaudeRevisionalRequest(
                { method: "POST", headers: { host: "localhost:8080" }, body: corpo },
                liberado.res,
                { conexaoLocalVerificada: true },
            );
            assert.equal(liberado.getStatus(), 200);
            assert.equal((liberado.getBody() as { fonte: string }).fonte, "parser_local");
        });
    });
});

describe("Processos pendentes do DJEN ao calcular", () => {
    it("renovar com novo contrato substitui o placeholder e preserva origemDjen", async () => {
        const prevFetch = globalThis.fetch;
        globalThis.fetch = criarMockBacenFetch();
        try {
            const origemDjen = {
                id: 4242,
                tribunal: "TJPE",
                statusProcesso: "manifestado",
                anotacoesInternas: "Contestação protocolada.",
                movimentacoes: [{ id: 4242, dataDisponibilizacao: "2026-11-10", texto: "Intimação." }],
            };
            const payloadPendente = fichaSemCalculoParaPayload(
                {
                    clienteNome: "Roberta Lima",
                    processoGlobal: "0001234-56.2026.8.17.1130",
                    banco: "BANCO PAN S.A.",
                    documentoContrato: "",
                    categoriaId: null,
                    observacoes: "",
                },
                { modalidadeId: "veiculo-pf", mesContrato: "2025-10", origemDjen },
            );
            const pendente: CalculoSalvo = {
                ...payloadPendente,
                id: "calc-djen-1",
                created_by_email: "contato@iangranja.adv.br",
                created_at: "2026-11-10T10:00:00Z",
                updated_at: "2026-11-10T10:00:00Z",
            };
            assert.equal(isCalculoPendente(pendente), true);

            const prep = await prepararRenovacaoCalculo(pendente, {
                novaDataBase: "2026-11-18",
                novosContratos: [
                    {
                        id: "c-novo",
                        descricao: "Financiamento",
                        instituicao: "BANCO PAN S.A.",
                        numeroContrato: "PAN-77",
                        pessoa: "pf",
                        modalidadeId: "veiculo-pf",
                        dataContrato: "2025-10-10",
                        primeiroVencimento: "2025-11-10",
                        valorFinanciado: 40000,
                        valorParcela: 1850,
                        parcelas: 48,
                        pagas: 5,
                        taxaMensal: 3.1,
                        fonteTaxaRevisional: "media_sgs",
                        bancoOlinda: null,
                        pagamentosExtras: [],
                    },
                ],
            });

            assert.equal(prep.processo.contratos.length, 1);
            assert.equal(prep.processo.contratos[0].id, "c-novo");
            assert.equal(prep.payload.valor_financiado, 40000);
            assert.ok(Number.isFinite(prep.payload.razao_am) && prep.payload.razao_am > 1);
            assert.equal(isCalculoPendente(prep.payload), false);

            const dc = prep.payload.dados_completos as Record<string, unknown>;
            assert.deepEqual(dc.origemDjen, origemDjen);
            assert.equal(dc.pendenteCalculo, undefined);
        } finally {
            globalThis.fetch = prevFetch;
        }
    });

    it("processoParaPayload sem registro existente não carrega metadados extras", () => {
        const input: ProcessoRevisionalInput = {
            parametros: { ...PARAMETROS_DECISAO_PADRAO(), indiceCorrecao: "NENHUM", tipoJuros: "NENHUM" },
            contratos: [
                {
                    id: "c-1",
                    descricao: "Contrato 1",
                    instituicao: "BANCO PAN S.A.",
                    numeroContrato: "",
                    pessoa: "pf",
                    modalidadeId: "veiculo-pf",
                    dataContrato: "2025-10-10",
                    primeiroVencimento: "2025-11-10",
                    valorFinanciado: 40000,
                    valorParcela: 1850,
                    parcelas: 48,
                    pagas: 5,
                    taxaMensal: 3.1,
                    fonteTaxaRevisional: "media_sgs",
                    bancoOlinda: null,
                    pagamentosExtras: [],
                },
            ],
            tarifas: [],
            deducoes: [],
        };
        const payload = processoParaPayload(calcularProcessoRevisional(input), input, {
            clienteNome: "Teste",
            banco: "BANCO PAN S.A.",
            documentoContrato: "",
            categoriaId: null,
            observacoes: "",
        });
        assert.deepEqual(Object.keys(payload.dados_completos).sort(), ["contratos", "deducoes", "parametros", "tarifas"]);
    });
});

/* ----------------------------------------------------- Regressões dos achados restantes do CR */

function contratoTeste(parcial: Partial<ContratoInputTeste> = {}): ContratoInputTeste {
    return {
        id: "c-1",
        descricao: "Contrato 1",
        instituicao: "BANCO PAN S.A.",
        numeroContrato: "",
        pessoa: "pf",
        modalidadeId: "veiculo-pf",
        dataContrato: "2025-10-10",
        primeiroVencimento: "2025-11-10",
        valorFinanciado: 40000,
        valorParcela: 1850,
        parcelas: 48,
        pagas: 5,
        taxaMensal: 3.1,
        fonteTaxaRevisional: "media_sgs",
        bancoOlinda: null,
        pagamentosExtras: [],
        ...parcial,
    };
}
type ContratoInputTeste = ProcessoRevisionalInput["contratos"][number];

function criarFetchAnthropicEspiao(resposta: Record<string, unknown>) {
    const chamadas: Array<{ body: Record<string, unknown>; headers: Record<string, string> }> = [];
    const fetchFn = (async (_input: string | URL | Request, init?: RequestInit) => {
        chamadas.push({
            body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
            headers: (init?.headers ?? {}) as Record<string, string>,
        });
        return new Response(JSON.stringify(resposta), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    return { fetchFn, chamadas };
}

const RESPOSTA_TOOL_USE = {
    stop_reason: "tool_use",
    content: [
        {
            type: "tool_use",
            name: "preencher_calculo_revisional",
            input: { modoOperacao: "novo_caso", acaoSugerida: "calcular", resumoExplicacao: "ok", ficha: {} },
        },
    ],
};

describe("Chamada à API do Claude (modelos e limites)", () => {
    it("usa claude-sonnet-5-5 com tool_choice auto, fallback de recusa e ignora modelo fora da allowlist", async () => {
        await comEnv({ CLAUDE_MODEL: undefined }, async () => {
            const espiao = criarFetchAnthropicEspiao(RESPOSTA_TOOL_USE);
            const out = await executarExtracaoClaudeServer({
                comando: "Cliente: Ana",
                apiKey: "sk-ant-test",
                model: "claude-3-opus-20240229",
                fetchFn: espiao.fetchFn,
            });
            const { body, headers } = espiao.chamadas[0];
            assert.equal(out.modelo, "claude-sonnet-5-5");
            assert.equal(body.model, "claude-sonnet-5-5");
            assert.deepEqual(body.tool_choice, { type: "auto" });
            assert.equal(body.max_tokens, 16000);
            assert.equal(body.fallbacks, "default");
            assert.equal(headers["anthropic-beta"], "server-side-fallback-2026-07-01");

            const espiaoOpus = criarFetchAnthropicEspiao(RESPOSTA_TOOL_USE);
            await executarExtracaoClaudeServer({
                comando: "Cliente: Ana",
                apiKey: "sk-ant-test",
                model: "claude-opus-5-5",
                fetchFn: espiaoOpus.fetchFn,
            });
            assert.equal(espiaoOpus.chamadas[0].body.model, "claude-opus-5-5");
        });
    });

    it("transforma recusa do modelo em erro claro", async () => {
        await comEnv({ CLAUDE_MODEL: undefined }, async () => {
            const espiao = criarFetchAnthropicEspiao({ stop_reason: "refusal", content: [] });
            await assert.rejects(
                () => executarExtracaoClaudeServer({ comando: "x", apiKey: "sk-ant-test", fetchFn: espiao.fetchFn }),
                /recusou processar/,
            );
        });
    });

    it("/api/claude-revisional recusa Bearer de usuário fora da whitelist do escritório", async () => {
        await comEnv(ENV_SERVIDOR_COM_SERVICE_ROLE, async () => {
            const urls: string[] = [];
            const fetchFn = (async (input: string | URL | Request) => {
                urls.push(String(input));
                return new Response("false", { status: 200, headers: { "Content-Type": "application/json" } });
            }) as typeof fetch;
            const { res, getStatus } = createMockHttpRes();
            await handleClaudeRevisionalRequest(
                {
                    method: "POST",
                    headers: { host: "www.iangranja.adv.br", authorization: "Bearer jwt-valido-de-outra-conta" },
                    body: { comando: "Cliente: Ana" },
                },
                res,
                { fetchFn },
            );
            assert.equal(getStatus(), 401);
            assert.ok(urls[0].endsWith("/rest/v1/rpc/is_escritorio_autorizado"));
            assert.equal(urls.length, 1, "não deve chamar a Anthropic");
        });
    });

    it("/api/claude-revisional responde 413 quando os anexos passam do limite do servidor", async () => {
        const grande = Buffer.alloc(3 * 1024 * 1024 + 10, 1).toString("base64");
        const { res, getStatus } = createMockHttpRes();
        await handleClaudeRevisionalRequest(
            {
                method: "POST",
                headers: {},
                body: { arquivos: [{ nome: "ccb.pdf", mediaType: "application/pdf", base64: grande }] },
            },
            res,
            { skipAuthCheck: true },
        );
        assert.equal(getStatus(), 413);
    });
});

describe("Protocolo e tools MCP (robustez)", () => {
    it("erro interno em resources/read vira resposta JSON-RPC -32603 com o id original", async () => {
        const dbQuebrado = new MemoryRevisionalDb();
        dbQuebrado.listarCalculos = async () => {
            throw new Error("JWT expired");
        };
        const res = await handleMcpJsonRpc(
            { jsonrpc: "2.0", id: 77, method: "resources/read", params: { uri: "revisional://carteira/resumo" } },
            dbQuebrado,
        );
        assert.equal(res?.id, 77);
        assert.equal(res?.error?.code, -32603);
        assert.ok(res?.error?.message.includes("JWT expired"));
    });

    it("consultar_carteira_clientes e listar_fases ignoram fichas do DJEN sem contrato", async () => {
        const prevFetch = globalThis.fetch;
        globalThis.fetch = criarMockBacenFetch();
        try {
            const db = new MemoryRevisionalDb();
            const input: ProcessoRevisionalInput = {
                parametros: { ...PARAMETROS_DECISAO_PADRAO(), indiceCorrecao: "NENHUM", tipoJuros: "NENHUM" },
                contratos: [contratoTeste()],
                tarifas: [],
                deducoes: [],
            };
            const ficha: FichaCliente = {
                clienteNome: "Caso Calculado",
                banco: "BANCO PAN S.A.",
                documentoContrato: "",
                categoriaId: null,
                observacoes: "",
            };
            await db.criarCalculo(processoParaPayload(calcularProcessoRevisional(input), input, ficha));
            await db.criarCalculo(
                fichaSemCalculoParaPayload({ ...ficha, clienteNome: "Ficha DJEN" }, { valorEstimadoAcao: 90000 }),
            );

            const carteiraRes = await handleMcpJsonRpc(
                { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "consultar_carteira_clientes", arguments: {} } },
                db,
            );
            const carteira = JSON.parse(
                (carteiraRes?.result as { content: Array<{ text: string }> }).content[0].text,
            ) as { totalEncontrados: number; processosAguardandoContrato: number; clientes: Array<{ clienteNome: string }> };
            assert.equal(carteira.totalEncontrados, 1);
            assert.equal(carteira.processosAguardandoContrato, 1);
            assert.deepEqual(carteira.clientes.map((c) => c.clienteNome), ["Caso Calculado"]);

            const fasesRes = await handleMcpJsonRpc(
                { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "listar_fases_e_modalidades", arguments: {} } },
                db,
            );
            const fases = JSON.parse(
                (fasesRes?.result as { content: Array<{ text: string }> }).content[0].text,
            ) as { totalCasosCarteira: number; processosAguardandoContrato: number };
            assert.equal(fases.totalCasosCarteira, 1);
            assert.equal(fases.processosAguardandoContrato, 1);
        } finally {
            globalThis.fetch = prevFetch;
        }
    });
});

describe("Aplicação da extração do Claude e regexes de domínio", () => {
    const parametrosBase = () => ({
        ...PARAMETROS_DECISAO_PADRAO(),
        dataBaseAtualizacao: "2026-03-01",
    });

    it("'atualizar_caso_atual' com a calculadora vazia vira caso novo, sem contrato zerado", () => {
        const aplicado = aplicarExtracaoClaudeAoEstado(
            {
                modoOperacao: "atualizar_caso_atual",
                acaoSugerida: "calcular",
                resumoExplicacao: "",
                ficha: { clienteNome: "Ana Souza" },
                contratos: [{ valorFinanciado: 30000, valorParcela: 1200, parcelas: 48, dataContrato: "2025-10-10" }],
            },
            {
                ficha: { clienteNome: "", banco: "", documentoContrato: "", categoriaId: null, observacoes: "" },
                processo: {
                    parametros: parametrosBase(),
                    contratos: [contratoTeste({ valorFinanciado: 0, valorParcela: 0, parcelas: 0, pagas: 0 })],
                    tarifas: [],
                    deducoes: [],
                },
                categorias: [],
            },
        );
        assert.equal(aplicado.processo.contratos.length, 1);
        assert.equal(aplicado.processo.contratos[0].valorFinanciado, 30000);
    });

    it("atualizar com contrato principal em branco preenche o contrato em vez de anexar", () => {
        const aplicado = aplicarExtracaoClaudeAoEstado(
            {
                modoOperacao: "atualizar_caso_atual",
                acaoSugerida: "calcular",
                resumoExplicacao: "",
                ficha: {},
                contratos: [{ valorFinanciado: 30000, valorParcela: 1200, parcelas: 48 }],
            },
            {
                ficha: { clienteNome: "Ana Souza", banco: "", documentoContrato: "", categoriaId: null, observacoes: "" },
                processo: {
                    parametros: parametrosBase(),
                    contratos: [contratoTeste({ valorFinanciado: 0, valorParcela: 0, parcelas: 0, pagas: 0 })],
                    tarifas: [],
                    deducoes: [],
                },
                categorias: [],
            },
        );
        assert.equal(aplicado.processo.contratos.length, 1);
        assert.equal(aplicado.processo.contratos[0].valorFinanciado, 30000);
    });

    it("incluir tarifa num caso carregado mantém a data-base do laudo", () => {
        const aplicado = aplicarExtracaoClaudeAoEstado(
            {
                modoOperacao: "atualizar_caso_atual",
                acaoSugerida: "calcular_e_salvar",
                resumoExplicacao: "",
                ficha: {},
                tarifas: [{ tipo: "Seguro Prestamista", valor: 800 }],
            },
            {
                ficha: { clienteNome: "Ana Souza", banco: "", documentoContrato: "", categoriaId: null, observacoes: "" },
                processo: { parametros: parametrosBase(), contratos: [contratoTeste()], tarifas: [], deducoes: [] },
                categorias: [],
            },
        );
        assert.equal(aplicado.processo.parametros.dataBaseAtualizacao, "2026-03-01");
        assert.equal(aplicado.processo.tarifas.length, 1);
    });

    it("parser local reconhece 'atualiza'/'renova' e ficha DJEN reconhece 'busca e apreensão'", () => {
        const ext = interpretarComandoLocalFallback("Atualiza o cálculo deste caso", "", true);
        assert.equal(ext.modoOperacao, "atualizar_caso_atual");
        assert.equal(ext.parametros?.dataBaseAtualizacao, hojeISO());

        const ficha = fichaSemCalculoParaPayload({
            clienteNome: "Pedro Alves",
            banco: "BANCO PAN S.A.",
            documentoContrato: "",
            categoriaId: null,
            observacoes: "Ação de busca e apreensão distribuída.",
        });
        assert.equal(ficha.modalidade_id, "veiculo-pf");
    });
});

/* ----------------------------------------------------- Verificação automática do DJEN */

const CNJ_SYNC = "0028625-54.2026.8.17.9000";

function itemDjenBruto(id: number, data: string, numeroProcesso = "00286255420268179000") {
    return {
        id,
        numero_processo: numeroProcesso,
        data_disponibilizacao: data,
        siglaTribunal: "TJPE",
        tipoComunicacao: "Intimação",
        nomeOrgao: "2ª Câmara Cível",
        nomeClasse: "AGRAVO DE INSTRUMENTO",
        texto: `Publicação ${id}: intimação das partes.`,
        destinatarios: [{ nome: "EDVALDO MANOEL DE REZENDE", polo: "A" }],
        destinatarioadvogados: [],
    };
}

function criarFetchDjenEspiao(itens: unknown[], status = 200) {
    const urls: string[] = [];
    const fetchFn = (async (input: string | URL | Request) => {
        urls.push(String(input));
        return new Response(JSON.stringify({ count: itens.length, items: itens }), {
            status,
            headers: { "Content-Type": "application/json" },
        });
    }) as typeof fetch;
    return { fetchFn, urls };
}

async function montarCarteiraParaSync() {
    const db = new MemoryRevisionalDb();
    const pendente = await db.criarCalculo(
        fichaSemCalculoParaPayload(
            {
                clienteNome: "EDVALDO MANOEL DE REZENDE",
                processoGlobal: CNJ_SYNC,
                banco: "BANCO BV S.A.",
                documentoContrato: "",
                categoriaId: null,
                observacoes: "",
            },
            {
                origemDjen: {
                    id: 100,
                    tribunal: "TJPE",
                    statusProcesso: "manifestado",
                    movimentacoes: [
                        {
                            id: 100,
                            dataDisponibilizacao: "2026-11-10",
                            dataDisponibilizacaoBr: "10/11/2026",
                            tribunal: "TJPE",
                            orgao: "2ª Câmara Cível",
                            classe: "AGRAVO DE INSTRUMENTO",
                            tipoComunicacao: "Intimação",
                            texto: "Publicação 100.",
                            link: "",
                            numeroComunicacao: null,
                        },
                    ],
                },
            },
        ),
    );
    const semCnj = await db.criarCalculo(
        fichaSemCalculoParaPayload({
            clienteNome: "Sem Número",
            banco: "",
            documentoContrato: "",
            categoriaId: null,
            observacoes: "",
        }),
    );
    const input: ProcessoRevisionalInput = {
        parametros: { ...PARAMETROS_DECISAO_PADRAO(), indiceCorrecao: "NENHUM", tipoJuros: "NENHUM" },
        contratos: [contratoTeste()],
        tarifas: [],
        deducoes: [],
    };
    const calculado = await db.criarCalculo(
        processoParaPayload(calcularProcessoRevisional(input), input, {
            clienteNome: "Caso Calculado",
            processoGlobal: "0004463-92.2019.8.17.3130",
            banco: "BANCO PAN S.A.",
            documentoContrato: "",
            categoriaId: null,
            observacoes: "",
        }),
    );
    return { db, pendente, semCnj, calculado };
}

describe("Verificação automática de publicações do DJEN", () => {
    const agora = new Date("2026-11-18T12:00:00Z");
    const semEspera = async () => {};

    it("anexa só a publicação nova ao histórico, reabre o prazo e marca como nova", async () => {
        const { db, pendente } = await montarCarteiraParaSync();
        const djen = criarFetchDjenEspiao([
            itemDjenBruto(100, "2026-11-10"),
            itemDjenBruto(200, "2026-11-17"),
            itemDjenBruto(300, "2026-11-17", "00044639220198173130"),
        ]);

        const resultado = await verificarPublicacoesDjen({
            calculos: await db.listarCalculos(),
            atualizar: (id, patch) => db.atualizarCalculo(id, patch),
            fetchFn: djen.fetchFn,
            agora: () => agora,
            esperar: semEspera,
        });

        assert.equal(resultado.verificados, 1, "só o processo salvo com CNJ é consultado");
        assert.equal(resultado.totalNovas, 1);
        assert.equal(djen.urls.length, 1);
        assert.ok(djen.urls[0].includes("numeroProcesso=00286255420268179000"));
        assert.ok(djen.urls[0].includes("dataDisponibilizacaoInicio=2026-11-07"));

        const salvo = db.calculos.find((c) => c.id === pendente.id)!;
        const view = lerDadosProcessoDjen(salvo);
        assert.deepEqual(view.movimentacoes.map((m) => m.id).sort(), [100, 200]);
        assert.deepEqual(view.idsNovos, [200]);
        assert.equal(view.statusProcesso, "prazo_aberto");
        assert.equal(view.ultimaSincronizacao, agora.toISOString());
        assert.equal(isCalculoPendente(salvo), true, "continua na aba Processos");
    });

    it("respeita o intervalo por processo e não duplica publicações já anexadas", async () => {
        const { db } = await montarCarteiraParaSync();
        const djen = criarFetchDjenEspiao([itemDjenBruto(100, "2026-11-10"), itemDjenBruto(200, "2026-11-17")]);
        const rodar = (momento: Date, intervaloHoras?: number) =>
            verificarPublicacoesDjen({
                calculos: db.calculos,
                atualizar: (id, patch) => db.atualizarCalculo(id, patch),
                fetchFn: djen.fetchFn,
                agora: () => momento,
                esperar: semEspera,
                intervaloHoras,
            });

        await rodar(agora);
        const umaHoraDepois = new Date(agora.getTime() + 3_600_000);
        assert.equal((await rodar(umaHoraDepois)).verificados, 0, "ainda dentro das 4 h");

        const manual = await rodar(umaHoraDepois, 0);
        assert.equal(manual.verificados, 1);
        assert.equal(manual.totalNovas, 0);
        const view = lerDadosProcessoDjen(db.calculos.find((c) => c.processo_global === CNJ_SYNC)!);
        assert.equal(view.movimentacoes.length, 2);
        assert.deepEqual(view.idsNovos, [200], "a marca de nova permanece até abrir o processo");
    });

    it("abrir o processo tira a marca de nova sem perder o histórico", async () => {
        const { db, pendente } = await montarCarteiraParaSync();
        await verificarPublicacoesDjen({
            calculos: db.calculos,
            atualizar: (id, patch) => db.atualizarCalculo(id, patch),
            fetchFn: criarFetchDjenEspiao([itemDjenBruto(200, "2026-11-17")]).fetchFn,
            agora: () => agora,
            esperar: semEspera,
        });
        const comNova = db.calculos.find((c) => c.id === pendente.id)!;
        const patch = marcarPublicacoesDjenComoVistas(comNova);
        assert.ok(patch);
        const visto = await db.atualizarCalculo(pendente.id, patch);
        assert.deepEqual(lerDadosProcessoDjen(visto).idsNovos, []);
        assert.equal(lerDadosProcessoDjen(visto).movimentacoes.length, 2);
        assert.equal(marcarPublicacoesDjenComoVistas(visto), null);
    });

    it("para a rodada quando a API do DJEN limita as requisições", async () => {
        const { db } = await montarCarteiraParaSync();
        const resultado = await verificarPublicacoesDjen({
            calculos: db.calculos,
            atualizar: (id, patch) => db.atualizarCalculo(id, patch),
            fetchFn: criarFetchDjenEspiao([], 429).fetchFn,
            agora: () => agora,
            esperar: semEspera,
        });
        assert.equal(resultado.interrompidoPorLimite, true);
        assert.equal(resultado.adiados, 1);
        assert.equal(resultado.verificados, 0);
    });

    it("/api/djen-sync exige CRON_SECRET e roda a verificação com o token certo", async () => {
        const { db } = await montarCarteiraParaSync();
        const djen = criarFetchDjenEspiao([itemDjenBruto(200, "2026-11-17")]);

        await comEnv({ CRON_SECRET: undefined }, async () => {
            const { res, getStatus } = createMockHttpRes();
            await handleDjenSync({ method: "GET", headers: {} }, res, { db, fetchFn: djen.fetchFn });
            assert.equal(getStatus(), 503);
        });

        await comEnv({ CRON_SECRET: "segredo-cron", DJEN_SYNC_INTERVALO_HORAS: undefined }, async () => {
            const negado = createMockHttpRes();
            await handleDjenSync(
                { method: "GET", headers: { authorization: "Bearer errado" } },
                negado.res,
                { db, fetchFn: djen.fetchFn },
            );
            assert.equal(negado.getStatus(), 401);

            const ok = createMockHttpRes();
            await handleDjenSync(
                { method: "GET", headers: { authorization: "Bearer segredo-cron" } },
                ok.res,
                { db, fetchFn: djen.fetchFn, esperar: semEspera },
            );
            assert.equal(ok.getStatus(), 200);
            const corpo = ok.getBody() as { ok: boolean; verificados: number; totalNovas: number; atualizados?: unknown };
            assert.equal(corpo.ok, true);
            assert.equal(corpo.verificados, 1);
            assert.equal(corpo.totalNovas, 1);
            assert.equal(corpo.atualizados, undefined, "não devolve os registros completos");
        });
    });
});

describe("Normalização do tipo de tarifa (qualquer formato vindo do contrato)", () => {
    const casos: Array<[string, string]> = [
        ["seguro_prestamista", "Seguro Prestamista"],
        ["SEGURO-PRESTAMISTA", "Seguro Prestamista"],
        ["avaliacao_bem", "Tarifa de Avaliação do Bem"],
        ["Avaliação do bem", "Tarifa de Avaliação do Bem"],
        ["registro_contrato", "Registro de Contrato"],
        ["Registro/Gravame", "Registro de Contrato"],
        ["taxa DETRAN", "Registro de Contrato"],
        ["iof.financiado", "IOF Financiado"],
        ["tarifa_tac", "Tarifa de Abertura de Crédito (TAC)"],
        ["servicos_de_terceiros", "Serviços de Terceiros"],
        ["Tarifa de Abertura de Crédito (TAC)", "Tarifa de Abertura de Crédito (TAC)"],
        ["Super Proteção Financeira - Motos", "Seguro Prestamista"],
        ["Proteção Vida", "Seguro de Vida"],
        ["seguro_vida", "Seguro de Vida"],
        ["Acidentes Pessoais Moto Assist", "Seguro de Acidentes Pessoais"],
        ["Moto Assist", "Seguro de Acidentes Pessoais"],
        ["seguro", "Seguro Prestamista"],
    ];
    for (const [entrada, esperado] of casos) {
        it(`"${entrada}" vira "${esperado}"`, () => {
            assert.equal(normalizarTipoTarifa(entrada).tipo, esperado);
        });
    }

    it("tipo desconhecido continua como 'Outra' e guarda o texto original", () => {
        assert.deepEqual(normalizarTipoTarifa("tarifa_cadastro"), { tipo: "Outra", descricaoCustom: "tarifa_cadastro" });
    });
});

describe("Exibição de publicações do DJEN", () => {
    it("passa nomes em CAIXA ALTA para a forma usual, mantendo iniciais e partículas", () => {
        assert.equal(formatarNomeParte("ELMAR ROBERIO HERCULANO E SILVA"), "Elmar Roberio Herculano e Silva");
        assert.equal(formatarNomeParte("MARIA DAS GRAÇAS NOGUEIRA"), "Maria das Graças Nogueira");
        assert.equal(formatarNomeParte("K. A. D. A."), "K. A. D. A.");
        assert.equal(formatarNomeParte("Já Formatado da Silva"), "Já Formatado da Silva");
    });

    it("começa o resumo no ato processual e trata processo sigiloso", () => {
        assert.equal(
            resumirTeorPublicacao("Tribunal X 5ª Vara CEP 56302-000 Processo nº 1 DECISÃO com força de Mandado"),
            "DECISÃO com força de Mandado",
        );
        assert.match(resumirTeorPublicacao("Este documento faz parte de um processo sigiloso."), /sigiloso/);
        assert.equal(resumirTeorPublicacao(""), "Publicação registrada sem texto resumido.");
    });
});

describe("Fase e categoria (tipo da ação) no conector MCP", () => {
    class MemoryDbComTipos extends MemoryRevisionalDb {
        tipos: Categoria[] = [
            { id: "tipo-ba", nome: "Busca e Apreensão", cor: "crimson", ordem: 1, created_at: "" },
            { id: "tipo-rev", nome: "Revisional", cor: "ink", ordem: 2, created_at: "" },
        ];
        async listarTipos(): Promise<Categoria[]> {
            return [...this.tipos];
        }
        async criarTipo(nome: string, cor: CategoriaCor = "ink"): Promise<Categoria> {
            const novo: Categoria = { id: `tipo-${this.tipos.length + 1}`, nome, cor, ordem: 9, created_at: "" };
            this.tipos.push(novo);
            return novo;
        }
    }

    const fases: Categoria[] = [
        { id: "fase-triagem", nome: "Triagem", cor: "gold", ordem: 1, created_at: "" },
        { id: "fase-ajuizado", nome: "Ajuizado", cor: "emerald", ordem: 3, created_at: "" },
    ];

    const cadastrar = async (db: MemoryDbComTipos, args: Record<string, unknown>) => {
        const res = await handleMcpJsonRpc(
            {
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: {
                    name: "calcular_e_cadastrar_caso_revisional",
                    arguments: {
                        clienteNome: "Teste Fase",
                        banco: "Santander",
                        contratos: [
                            {
                                modalidadeId: "veiculo-pf",
                                dataContrato: "2025-11-10",
                                valorFinanciado: 30000,
                                valorParcela: 1200,
                                parcelas: 48,
                                pagas: 4,
                                taxaMensal: 3.1,
                            },
                        ],
                        ...args,
                    },
                },
            },
            db,
        );
        return JSON.parse((res?.result as { content: Array<{ text: string }> }).content[0].text) as {
            id: string;
            faseKanban: string;
            categoriaAcao: string | null;
        };
    };

    it("grava fase e categoria separadas quando as duas vêm", async () => {
        const prevFetch = globalThis.fetch;
        globalThis.fetch = criarMockBacenFetch();
        try {
            const db = new MemoryDbComTipos(fases);
            const r = await cadastrar(db, { categoriaNome: "Ajuizado", tipoAcao: "Revisional" });
            assert.equal(r.faseKanban, "Ajuizado");
            assert.equal(r.categoriaAcao, "Revisional");
            const salvo = db.calculos.find((c) => c.id === r.id);
            assert.equal(salvo?.categoria_id, "fase-ajuizado");
            assert.equal(salvo?.tipo_id, "tipo-rev");
        } finally {
            globalThis.fetch = prevFetch;
        }
    });

    it("tipo de ação mandado como fase vira categoria e o caso entra em Triagem", async () => {
        const prevFetch = globalThis.fetch;
        globalThis.fetch = criarMockBacenFetch();
        try {
            const db = new MemoryDbComTipos(fases);
            const r = await cadastrar(db, { categoriaNome: "Busca e Apreensão" });
            assert.equal(r.faseKanban, "Triagem");
            assert.equal(r.categoriaAcao, "Busca e Apreensão");
            assert.equal(db.categorias.length, 2, "não recria a fase antiga");
        } finally {
            globalThis.fetch = prevFetch;
        }
    });
});

describe("Varredura do DJEN pela OAB do escritório", () => {
    const agora = new Date("2026-11-19T12:00:00Z");
    const semEspera = async () => {};
    const CNJ_NOVO = "80005272820268050052";

    it("cadastra processo novo da OAB com todas as publicações marcadas como novas e anexa as de processo salvo", async () => {
        const { db, pendente } = await montarCarteiraParaSync();
        const itensOab = [
            itemDjenBruto(100, "2026-11-10"),
            itemDjenBruto(200, "2026-11-19"),
            itemDjenBruto(401, "2026-11-19", CNJ_NOVO),
            itemDjenBruto(400, "2026-11-18", CNJ_NOVO),
        ];
        const urls: string[] = [];
        const fetchFn = (async (input: string | URL | Request) => {
            const url = String(input);
            urls.push(url);
            const cnj = new URL(url).searchParams.get("numeroProcesso");
            const itens = cnj ? itensOab.filter((i) => i.numero_processo === cnj) : itensOab;
            return new Response(JSON.stringify({ count: itens.length, items: itens }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }) as typeof fetch;

        const fases = [{ id: "fase-ajuizado", nome: "Ajuizado", cor: "emerald" as const, ordem: 3, created_at: "" }];
        const resultado = await verificarPublicacoesDjen({
            calculos: await db.listarCalculos(),
            atualizar: (id, patch) => db.atualizarCalculo(id, patch),
            fetchFn,
            agora: () => agora,
            esperar: semEspera,
            varreduraOab: { numeroOab: "61107", ufOab: "PE", criar: (p) => db.criarCalculo(p), categorias: fases },
        });

        assert.ok(urls[0].includes("numeroOab=61107") && urls[0].includes("ufOab=PE"), "primeiro varre pela OAB");
        assert.ok(urls[0].includes("dataDisponibilizacaoInicio=2026-11-16"));
        assert.equal(resultado.criados.length, 1);

        const novo = lerDadosProcessoDjen(resultado.criados[0]);
        assert.equal(normalizarNumeroProcessoDjen(novo.processoGlobal), CNJ_NOVO);
        assert.deepEqual(novo.movimentacoes.map((m) => m.id).sort(), [400, 401]);
        assert.deepEqual([...novo.idsNovos].sort(), [400, 401]);
        assert.equal(resultado.criados[0].categoria_id, "fase-ajuizado");
        assert.equal(isCalculoPendente(resultado.criados[0]), true, "entra na aba Processos");

        const salvo = lerDadosProcessoDjen(db.calculos.find((c) => c.id === pendente.id)!);
        assert.deepEqual(salvo.movimentacoes.map((m) => m.id).sort(), [100, 200], "sem duplicar");
        assert.deepEqual(salvo.idsNovos, [200]);
        assert.equal(resultado.totalNovas, 3);

        // Rodar de novo não recria nem duplica nada
        const segunda = await verificarPublicacoesDjen({
            calculos: db.calculos,
            atualizar: (id, patch) => db.atualizarCalculo(id, patch),
            fetchFn,
            agora: () => agora,
            esperar: semEspera,
            intervaloHoras: 0,
            varreduraOab: { numeroOab: "61107", ufOab: "PE", criar: (p) => db.criarCalculo(p), categorias: fases },
        });
        assert.equal(segunda.criados.length, 0);
        assert.equal(segunda.totalNovas, 0);
    });
});

describe("Varredura da OAB não duplica com duas verificações ao mesmo tempo", () => {
    it("a segunda verificação, partindo da lista antiga em memória, relê o banco e não recria", async () => {
        const { db } = await montarCarteiraParaSync();
        const CNJ_NOVO = "80084675320268050146";
        const itens = [itemDjenBruto(792135501, "2026-11-19", CNJ_NOVO)];
        const fetchFn = (async () =>
            new Response(JSON.stringify({ count: itens.length, items: itens }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })) as typeof fetch;
        const listaAntiga = await db.listarCalculos(); // as duas telas carregaram antes da varredura
        const varredura = {
            numeroOab: "61107",
            ufOab: "PE",
            criar: (p: CalculoPayload) => db.criarCalculo(p),
            listarAtuais: () => db.listarCalculos(),
            existeProcesso: async (numero: string) => db.calculos.some((c) => c.processo_global === numero),
        };
        const rodar = () =>
            verificarPublicacoesDjen({
                calculos: listaAntiga,
                atualizar: (id, patch) => db.atualizarCalculo(id, patch),
                fetchFn,
                agora: () => new Date("2026-11-19T04:48:45Z"),
                esperar: async () => {},
                intervaloHoras: 0,
                varreduraOab: varredura,
            });

        const primeira = await rodar();
        const segunda = await rodar();
        assert.equal(primeira.criados.length, 1);
        assert.equal(segunda.criados.length, 0, "a segunda tela não recria o mesmo processo");
        assert.equal(
            db.calculos.filter((c) => normalizarNumeroProcessoDjen(c.processo_global) === CNJ_NOVO).length,
            1,
        );
    });
});

describe("Regressões P1 (segurança, parser, multi-contrato e MCP HTTP)", () => {
    it("urlHttpSegura permite apenas http/https e bloqueia javascript: e data:", () => {
        assert.equal(urlHttpSegura("https://pje.tjpe.jus.br/doc/1"), "https://pje.tjpe.jus.br/doc/1");
        assert.equal(urlHttpSegura("http://example.com/a"), "http://example.com/a");
        assert.equal(urlHttpSegura("javascript:alert(1)"), "");
        assert.equal(urlHttpSegura("data:text/html,<script>alert(1)</script>"), "");
        assert.equal(urlHttpSegura("   "), "");
    });

    it("parser local não confunde taxa anual (% a.a.) com taxa mensal (% a.m.)", () => {
        const res = interpretarComandoLocalFallback("Contrato de R$ 20.000 em 48x com taxa de 35% a.a.");
        assert.equal(res.contratos?.[0]?.taxaMensal, undefined);
        const resMensal = interpretarComandoLocalFallback("Contrato de R$ 20.000 em 48x com taxa de 2,85% a.m.");
        assert.equal(resMensal.contratos?.[0]?.taxaMensal, 2.85);
    });

    it("aplicarExtracaoClaudeAoEstado atualiza o 2º contrato correspondente sem sobrescrever o 1º", () => {
        const estadoBase = {
            ficha: {
                clienteNome: "Carlos Silva",
                banco: "Santander",
                documentoContrato: "CCB-01",
                categoriaId: null,
                observacoes: "",
            },
            categorias: [],
            processo: {
                processoGlobal: "",
                contratos: [
                    {
                        id: "c-1",
                        descricao: "Contrato 1",
                        instituicao: "Santander",
                        numeroContrato: "CCB-01",
                        pessoa: "pf" as const,
                        modalidadeId: "veiculo-pf" as const,
                        dataContrato: "2024-01-10",
                        primeiroVencimento: "2024-02-10",
                        valorFinanciado: 40000,
                        valorParcela: 1500,
                        parcelas: 48,
                        pagas: 12,
                        taxaMensal: 2.5,
                        tipoJurosContrato: "AM" as const,
                        metodo: "PRICE" as const,
                        sistemaJuros: "COMPOSTO" as const,
                        fonteTaxaRevisional: "media_sgs" as const,
                        pagamentosExtras: [],
                        gradePersonalizada: [],
                    },
                    {
                        id: "c-2",
                        descricao: "Contrato 2",
                        instituicao: "Santander",
                        numeroContrato: "CCB-02",
                        pessoa: "pf" as const,
                        modalidadeId: "pessoal-pf" as const,
                        dataContrato: "2024-06-15",
                        primeiroVencimento: "2024-07-15",
                        valorFinanciado: 15000,
                        valorParcela: 700,
                        parcelas: 36,
                        pagas: 6,
                        taxaMensal: 3.9,
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
                parametros: PARAMETROS_DECISAO_PADRAO(),
            },
        };

        const atualizado = aplicarExtracaoClaudeAoEstado(
            {
                modoOperacao: "atualizar_caso_atual",
                acaoSugerida: "calcular",
                resumoExplicacao: "Atualizou contrato 2",
                ficha: {},
                contratos: [{ numeroContrato: "CCB-02", pagas: 10, taxaMensal: 4.1 }],
                parametros: {},
                tarifas: [],
                deducoes: [],
            },
            estadoBase,
        );

        assert.equal(atualizado.processo.contratos.length, 2);
        assert.equal(atualizado.processo.contratos[0].pagas, 12);
        assert.equal(atualizado.processo.contratos[0].taxaMensal, 2.5);
        assert.equal(atualizado.processo.contratos[1].pagas, 10);
        assert.equal(atualizado.processo.contratos[1].taxaMensal, 4.1);
    });

    it("HTTP /api/mcp exige autenticação no GET, recusa ?token= na query string e limita lotes JSON-RPC", async () => {
        const db = new MemoryRevisionalDb([]);
        const prevToken = process.env.MCP_AUTH_TOKEN;
        process.env.MCP_AUTH_TOKEN = "segredo-mcp-teste";
        try {
            // GET sem autenticação em host público => 401
            {
                const { res, getStatus } = createMockHttpRes();
                await handleMcpHttpRequest(
                    { method: "GET", headers: { host: "www.iangranja.adv.br" } },
                    res,
                );
                assert.equal(getStatus(), 401);
            }

            // POST com ?token= na query string sem header => 401 (query string não é mais aceita)
            {
                const { res, getStatus } = createMockHttpRes();
                await handleMcpHttpRequest(
                    {
                        method: "POST",
                        headers: { host: "www.iangranja.adv.br" },
                        query: { token: "segredo-mcp-teste" },
                        body: { jsonrpc: "2.0", id: 1, method: "ping" },
                    },
                    res,
                );
                assert.equal(getStatus(), 401);
            }

            // Batch vazio [] => 400 / -32600
            {
                const { res, getStatus, getBody } = createMockHttpRes();
                await handleMcpHttpRequest(
                    {
                        method: "POST",
                        headers: { host: "www.iangranja.adv.br", authorization: "Bearer segredo-mcp-teste" },
                        body: [],
                    },
                    res,
                    { db },
                );
                assert.equal(getStatus(), 400);
                assert.equal((getBody() as { error?: { code?: number } }).error?.code, -32600);
            }

            // Batch com > 20 chamadas => 400 / -32600
            {
                const { res, getStatus, getBody } = createMockHttpRes();
                const batchGrande = Array.from({ length: 21 }, (_, i) => ({
                    jsonrpc: "2.0",
                    id: i + 1,
                    method: "ping",
                }));
                await handleMcpHttpRequest(
                    {
                        method: "POST",
                        headers: { host: "www.iangranja.adv.br", authorization: "Bearer segredo-mcp-teste" },
                        body: batchGrande,
                    },
                    res,
                    { db },
                );
                assert.equal(getStatus(), 400);
                assert.equal((getBody() as { error?: { code?: number } }).error?.code, -32600);
            }
        } finally {
            if (prevToken === undefined) delete process.env.MCP_AUTH_TOKEN;
            else process.env.MCP_AUTH_TOKEN = prevToken;
        }
    });
});
