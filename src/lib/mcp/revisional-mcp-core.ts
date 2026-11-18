import {
    MODALIDADES,
    brl,
    consultarBacen,
    mNome,
    num,
    taxaMedia,
    type Nivel,
} from "../juros/index.ts";
import {
    BANCOS_USUAIS,
    PARAMETROS_DECISAO_PADRAO,
    TIPOS_TARIFA,
    calcularProcessoRevisional,
    consultarTaxasOlinda,
    hojeISO,
    prepararDadosBacenProcesso,
    primeiroVencimentoSugerido,
    type ContratoInput,
    type DeducaoItem,
    type FonteTaxaRevisional,
    type ParametrosDecisao,
    type ProcessoRevisionalInput,
    type TarifaItem,
    type TaxaOlindaSelecao,
} from "../juros/revisional-pro.ts";
import {
    normalizarBancoInput,
    normalizarModalidadeInput,
    normalizarTipoTarifa,
    resolverCategoriaPorNome,
} from "../juros/claude-revisional.ts";
import {
    OAB_ESCRITORIO_PADRAO,
    consultarDjen,
    cruzarComunicacoesComCarteira,
} from "../juros/djen.ts";
import { normalizarRotuloBanco } from "../juros/graficos-dados.ts";
import {
    SUPABASE_ANON_KEY,
    SUPABASE_URL,
    isCalculoPendente,
    montarTextoPeticaoPro,
    normalizeNumericRow,
    prepararRenovacaoCalculo,
    processoParaPayload,
    type CalculoPayload,
    type CalculoSalvo,
    type Categoria,
    type CategoriaCor,
    type FichaCliente,
} from "../revisional-db.ts";

export interface RevisionalDbAdapter {
    listarCategorias(): Promise<Categoria[]>;
    criarCategoria(nome: string, cor?: CategoriaCor, ordem?: number): Promise<Categoria>;
    listarCalculos(): Promise<CalculoSalvo[]>;
    criarCalculo(payload: CalculoPayload): Promise<CalculoSalvo>;
    atualizarCalculo(id: string, payload: Partial<CalculoPayload>): Promise<CalculoSalvo>;
}

export interface RevisionalServerDbConfig {
    supabaseUrl?: string;
    anonKey?: string;
    serviceRoleKey?: string;
    accessToken?: string;
    email?: string;
    password?: string;
    fetchFn?: typeof fetch;
}

function semAcentos(str: string): string {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function normalizarDataContrato(raw?: string): string {
    const s = (raw ?? "").trim();
    if (!s) return hojeISO();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}$/.test(s)) return `${s}-10`;
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const brMes = s.match(/^(\d{2})\/(\d{4})$/);
    if (brMes) return `${brMes[2]}-${brMes[1]}-10`;
    return s;
}

export class RevisionalServerDb implements RevisionalDbAdapter {
    private readonly supabaseUrl: string;
    private readonly anonKey: string;
    private readonly serviceRoleKey: string;
    private readonly email: string;
    private readonly password: string;
    private readonly fetchFn: typeof fetch;
    private tokenCache: { token: string; expiresAt: number } | null = null;

    constructor(config: RevisionalServerDbConfig = {}) {
        const procEnv = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
            .process?.env;

        this.supabaseUrl = (config.supabaseUrl || procEnv?.VITE_SUPABASE_URL || SUPABASE_URL).replace(/\/+$/, "");
        this.anonKey = config.anonKey || procEnv?.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
        const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(this.supabaseUrl);

        // Credenciais vindas do chamador (token de sessão ou e-mail/senha) definem sozinhas o modo de
        // autenticação: nunca são trocadas pela service role nem pelo login padrão do ambiente, senão
        // qualquer "Bearer x" receberia acesso total ignorando o RLS.
        const credenciaisDoChamador = Boolean(config.accessToken || config.email || config.password);
        const serviceRoleDoAmbiente = isLocal
            ? procEnv?.LOCAL_SUPABASE_SERVICE_ROLE_KEY || procEnv?.SUPABASE_SERVICE_ROLE_KEY || ""
            : procEnv?.SUPABASE_SERVICE_ROLE_KEY || "";
        this.serviceRoleKey = config.serviceRoleKey || (credenciaisDoChamador ? "" : serviceRoleDoAmbiente);

        this.email =
            config.email ||
            (credenciaisDoChamador ? "" : procEnv?.REVISIONAL_EMAIL || "contato@iangranja.adv.br");
        this.password =
            config.password ||
            (credenciaisDoChamador
                ? ""
                : procEnv?.REVISIONAL_PASSWORD || procEnv?.INITIAL_PASS_IAN || procEnv?.INITIAL_PASS_DEV || "");
        this.fetchFn = config.fetchFn ?? fetch;

        if (config.accessToken) {
            this.tokenCache = {
                token: config.accessToken,
                expiresAt: Date.now() + 55 * 60_000,
            };
        }
    }

    private async getHeaders(): Promise<Record<string, string>> {
        if (this.serviceRoleKey) {
            return {
                apikey: this.serviceRoleKey,
                Authorization: `Bearer ${this.serviceRoleKey}`,
                "Content-Type": "application/json",
            };
        }

        if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) {
            return {
                apikey: this.anonKey,
                Authorization: `Bearer ${this.tokenCache.token}`,
                "Content-Type": "application/json",
            };
        }

        if (!this.email || !this.password) {
            throw new Error(
                "Credenciais do Supabase ausentes para o conector MCP. Configure SUPABASE_SERVICE_ROLE_KEY (ou LOCAL_SUPABASE_SERVICE_ROLE_KEY em dev) ou REVISIONAL_EMAIL/REVISIONAL_PASSWORD.",
            );
        }

        const res = await this.fetchFn(`${this.supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: "POST",
            headers: {
                apikey: this.anonKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: this.email, password: this.password }),
        });

        const body = (await res.json().catch(() => ({}))) as {
            access_token?: string;
            expires_in?: number;
            error_description?: string;
            msg?: string;
            message?: string;
        };

        if (!res.ok || !body.access_token) {
            throw new Error(
                `Falha ao autenticar no Supabase (${res.status}): ${body.error_description || body.msg || body.message || "verifique as credenciais"}`,
            );
        }

        this.tokenCache = {
            token: body.access_token,
            expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
        };

        return {
            apikey: this.anonKey,
            Authorization: `Bearer ${this.tokenCache.token}`,
            "Content-Type": "application/json",
        };
    }

    private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const authHeaders = await this.getHeaders();
        const res = await this.fetchFn(`${this.supabaseUrl}/rest/v1/${path}`, {
            ...init,
            headers: {
                ...authHeaders,
                ...(init.headers ?? {}),
            },
        });

        if (!res.ok) {
            const errTxt = await res.text().catch(() => "");
            throw new Error(`Erro Supabase REST (${res.status}) em ${path}: ${errTxt.slice(0, 260)}`);
        }

        if (res.status === 204) return undefined as T;
        const raw: unknown = await res.json();
        return normalizeNumericRow(raw) as T;
    }

    async listarCategorias(): Promise<Categoria[]> {
        return this.request<Categoria[]>("revisional_categorias?select=*&order=ordem.asc,nome.asc");
    }

    async criarCategoria(nome: string, cor: CategoriaCor = "gold", ordem?: number): Promise<Categoria> {
        const existentes = await this.listarCategorias();
        const jaExiste = resolverCategoriaPorNome(nome, existentes);
        if (jaExiste && semAcentos(jaExiste.nome) === semAcentos(nome)) {
            return jaExiste;
        }
        const proxOrdem = ordem ?? existentes.reduce((acc, c) => Math.max(acc, c.ordem), 0) + 1;
        const rows = await this.request<Categoria[]>("revisional_categorias", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ nome: nome.trim(), cor, ordem: proxOrdem }),
        });
        return rows[0];
    }

    async listarCalculos(): Promise<CalculoSalvo[]> {
        return this.request<CalculoSalvo[]>("revisional_calculos?select=*&order=updated_at.desc");
    }

    async criarCalculo(payload: CalculoPayload): Promise<CalculoSalvo> {
        const rows = await this.request<CalculoSalvo[]>("revisional_calculos", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(payload),
        });
        return rows[0];
    }

    async atualizarCalculo(id: string, payload: Partial<CalculoPayload>): Promise<CalculoSalvo> {
        const rows = await this.request<CalculoSalvo[]>(
            `revisional_calculos?id=eq.${encodeURIComponent(id)}`,
            {
                method: "PATCH",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify(payload),
            },
        );
        return rows[0];
    }
}

/* ----------------------------------------------------- Helpers de Domínio */

interface ContratoEntradaTool {
    descricao?: string;
    instituicao?: string;
    numeroContrato?: string;
    pessoa?: "pf" | "pj";
    modalidadeId?: string;
    dataContrato: string;
    primeiroVencimento?: string;
    valorFinanciado: number;
    valorParcela: number;
    parcelas: number;
    pagas?: number;
    taxaMensal?: number;
    taxaAnual?: number;
    fonteTaxaRevisional?: FonteTaxaRevisional;
    taxaRevisionalManualAm?: number;
    taxaRevisionalManualAa?: number;
    usarTaxaBancoOlinda?: boolean;
}

interface TarifaEntradaTool {
    tipo?: string;
    descricaoCustom?: string;
    valor: number;
    dataCobranca?: string;
    emDobro?: boolean;
}

interface DeducaoEntradaTool {
    descricao: string;
    valor: number;
    data?: string;
    atualizar?: boolean;
}

async function resolverContratoInput(
    raw: ContratoEntradaTool,
    idx: number,
    bancoPadrao: string,
    numeroPadrao: string,
): Promise<ContratoInput> {
    const { id: modId, pessoa } = normalizarModalidadeInput(raw.modalidadeId, raw.pessoa);
    const dataContrato = normalizarDataContrato(raw.dataContrato);
    const primeiroVencimento = raw.primeiroVencimento
        ? normalizarDataContrato(raw.primeiroVencimento)
        : primeiroVencimentoSugerido(dataContrato);
    const instituicao = normalizarBancoInput(raw.instituicao || bancoPadrao);
    const parcelas = Math.max(1, Math.round(Number(raw.parcelas)));
    const pagas = Math.max(0, Math.min(parcelas, Math.round(Number(raw.pagas ?? 0))));

    let fonteTaxa: FonteTaxaRevisional = raw.fonteTaxaRevisional ?? (raw.usarTaxaBancoOlinda ? "banco_olinda" : "media_sgs");
    let bancoOlinda: TaxaOlindaSelecao | null = null;

    if (fonteTaxa === "banco_olinda") {
        const modObj = MODALIDADES.find((m) => m.id === modId);
        if (modObj && instituicao) {
            const ranking = await consultarTaxasOlinda(modObj, dataContrato);
            const alvoNorm = semAcentos(instituicao).replace(/\bs\.?a\.?\b|\bbanco\b|\bbco\b/g, "").trim();
            const match =
                ranking.find((r) => semAcentos(r.instituicao) === semAcentos(instituicao)) ??
                ranking.find((r) => alvoNorm && semAcentos(r.instituicao).includes(alvoNorm));
            if (match) {
                bancoOlinda = {
                    instituicao: match.instituicao,
                    taxaAm: match.taxaAm,
                    taxaAa: match.taxaAa,
                    periodo: `${match.inicioPeriodo} a ${match.fimPeriodo}`,
                };
            }
        }
        if (!bancoOlinda) {
            fonteTaxa = "media_sgs";
        }
    }

    return {
        id: `c-${idx + 1}-${Math.random().toString(36).slice(2, 7)}`,
        descricao: raw.descricao?.trim() || `Contrato ${idx + 1}`,
        instituicao,
        numeroContrato: (raw.numeroContrato ?? numeroPadrao ?? "").trim(),
        pessoa,
        modalidadeId: modId,
        dataContrato,
        primeiroVencimento,
        valorFinanciado: Number(raw.valorFinanciado),
        valorParcela: Number(raw.valorParcela),
        parcelas,
        pagas,
        taxaMensal: raw.taxaMensal && raw.taxaMensal > 0 ? Number(raw.taxaMensal) : undefined,
        taxaAnual: raw.taxaAnual && raw.taxaAnual > 0 ? Number(raw.taxaAnual) : undefined,
        fonteTaxaRevisional: fonteTaxa,
        taxaRevisionalManualAm:
            raw.taxaRevisionalManualAm && raw.taxaRevisionalManualAm > 0
                ? Number(raw.taxaRevisionalManualAm)
                : undefined,
        taxaRevisionalManualAa:
            raw.taxaRevisionalManualAa && raw.taxaRevisionalManualAa > 0
                ? Number(raw.taxaRevisionalManualAa)
                : undefined,
        bancoOlinda,
        pagamentosExtras: [],
    };
}

function normalizarTarifasEntrada(
    tarifas: TarifaEntradaTool[] | undefined,
    dataPadrao: string,
): TarifaItem[] {
    return (tarifas ?? [])
        .filter((t) => Number(t.valor) > 0)
        .map((t, idx) => {
            const norm = normalizarTipoTarifa(t.tipo || t.descricaoCustom);
            return {
                id: `tar-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
                tipo: norm.tipo,
                descricaoCustom: t.descricaoCustom?.trim() || norm.descricaoCustom,
                valor: Math.round(Number(t.valor) * 100) / 100,
                dataCobranca: t.dataCobranca ? normalizarDataContrato(t.dataCobranca) : dataPadrao,
                emDobro: t.emDobro ?? true,
            };
        });
}

function normalizarDeducoesEntrada(deducoes: DeducaoEntradaTool[] | undefined): DeducaoItem[] {
    return (deducoes ?? [])
        .filter((d) => Number(d.valor) > 0)
        .map((d, idx) => ({
            id: `ded-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            descricao: d.descricao?.trim() || "Alvará / Dedução",
            valor: Math.round(Number(d.valor) * 100) / 100,
            data: d.data ? normalizarDataContrato(d.data) : hojeISO(),
            atualizar: d.atualizar ?? true,
        }));
}

async function resolverOuCriarCategoria(
    db: RevisionalDbAdapter,
    categoriaNome?: string,
    categoriaId?: string | null,
): Promise<Categoria | null> {
    const categorias = await db.listarCategorias();
    if (categoriaId) {
        const porId = categorias.find((c) => c.id === categoriaId);
        if (porId) return porId;
    }
    if (categoriaNome?.trim()) {
        const encontrada = resolverCategoriaPorNome(categoriaNome, categorias);
        if (encontrada) return encontrada;
        return db.criarCategoria(categoriaNome.trim(), "gold");
    }
    return null;
}

async function localizarCasoExistente(
    db: RevisionalDbAdapter,
    filtro: { calculoId?: string; clienteNome?: string; processoGlobal?: string; busca?: string },
): Promise<{ caso: CalculoSalvo; encontradoPor: "id" | "cliente" | "processo" | "busca" }> {
    const calculos = await db.listarCalculos();

    if (filtro.calculoId?.trim()) {
        const idAlvo = filtro.calculoId.trim();
        const porId = calculos.find((c) => c.id === idAlvo);
        if (!porId) {
            throw new Error(`Nenhum cálculo encontrado com o ID "${idAlvo}".`);
        }
        return { caso: porId, encontradoPor: "id" };
    }

    if (filtro.busca?.trim()) {
        const alvo = semAcentos(filtro.busca);
        const matches = calculos.filter((c) =>
            semAcentos(`${c.cliente_nome} ${c.processo_global} ${c.documento_contrato} ${c.banco}`).includes(alvo),
        );
        if (matches.length === 1) return { caso: matches[0], encontradoPor: "busca" };
        if (matches.length > 1) {
            const exato = matches.find(
                (c) =>
                    semAcentos(c.cliente_nome) === alvo ||
                    semAcentos(c.processo_global) === alvo,
            );
            if (exato) return { caso: exato, encontradoPor: "busca" };
            throw new Error(
                `Múltiplos casos encontrados para "${filtro.busca}": ${matches
                    .slice(0, 5)
                    .map((m) => `${m.cliente_nome} (${m.id})`)
                    .join(", ")}. Informe o calculoId exato.`,
            );
        }
    }

    if (filtro.clienteNome?.trim()) {
        const alvo = semAcentos(filtro.clienteNome);
        const exato = calculos.find((c) => semAcentos(c.cliente_nome) === alvo);
        if (exato) return { caso: exato, encontradoPor: "cliente" };

        const parciais = calculos.filter((c) => semAcentos(c.cliente_nome).includes(alvo));
        if (parciais.length === 1) return { caso: parciais[0], encontradoPor: "cliente" };
        if (parciais.length > 1) {
            throw new Error(
                `Mais de um cliente corresponde a "${filtro.clienteNome}": ${parciais
                    .slice(0, 5)
                    .map((m) => `${m.cliente_nome} [${m.banco || "sem banco"}] (${m.id})`)
                    .join(", ")}. Especifique o nome completo ou calculoId.`,
            );
        }
    }

    if (filtro.processoGlobal?.trim()) {
        const alvo = semAcentos(filtro.processoGlobal);
        const porProc = calculos.find((c) => semAcentos(c.processo_global) === alvo);
        if (porProc) return { caso: porProc, encontradoPor: "processo" };
    }

    throw new Error(
        `Caso não encontrado no histórico (critério: ${filtro.clienteNome || filtro.processoGlobal || filtro.busca || "não informado"}).`,
    );
}

/* ----------------------------------------------------- Definição das Tools MCP */

export const MCP_TOOLS = [
    {
        name: "calcular_e_cadastrar_caso_revisional",
        description:
            "Executa o cálculo revisional oficial do escritório consultando taxas do BACEN (SGS/Olinda) e séries econômicas (INPC/IPCA/IGP-M/SELIC), cadastra o caso no histórico/Kanban do Supabase e retorna o resumo formatado pronto para a petição inicial.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            required: ["clienteNome", "contratos"],
            properties: {
                clienteNome: { type: "string", description: "Nome completo do cliente / autor(a)" },
                processoGlobal: { type: "string", description: "Número CNJ do processo (opcional)" },
                banco: { type: "string", description: "Nome da instituição financeira (ex.: Santander, Banco Pan)" },
                documentoContrato: { type: "string", description: "Número do contrato / CCB (opcional)" },
                categoriaNome: {
                    type: "string",
                    description: "Fase do Kanban (ex.: Triagem, Busca e Apreensão, Revisional, Ajuizado, Acordo / Concluído)",
                },
                observacoes: { type: "string", description: "Observações e teses do caso" },
                contratos: {
                    type: "array",
                    minItems: 1,
                    items: {
                        type: "object",
                        required: ["dataContrato", "valorFinanciado", "valorParcela", "parcelas"],
                        properties: {
                            descricao: { type: "string" },
                            instituicao: { type: "string" },
                            numeroContrato: { type: "string" },
                            pessoa: { type: "string", enum: ["pf", "pj"] },
                            modalidadeId: {
                                type: "string",
                                description: `Modalidade BACEN (${MODALIDADES.map((m) => m.id).join(", ")}) ou descrição`,
                            },
                            dataContrato: { type: "string", description: "YYYY-MM-DD ou YYYY-MM" },
                            primeiroVencimento: { type: "string", description: "YYYY-MM-DD" },
                            valorFinanciado: { type: "number" },
                            valorParcela: { type: "number" },
                            parcelas: { type: "integer" },
                            pagas: { type: "integer" },
                            taxaMensal: { type: "number" },
                            taxaAnual: { type: "number" },
                            fonteTaxaRevisional: {
                                type: "string",
                                enum: ["media_sgs", "banco_olinda", "manual"],
                            },
                            taxaRevisionalManualAm: { type: "number" },
                            taxaRevisionalManualAa: { type: "number" },
                            usarTaxaBancoOlinda: { type: "boolean" },
                        },
                    },
                },
                tarifas: {
                    type: "array",
                    description: "Seguros prestamistas, avaliação do bem, registro de contrato, TAC, TEC, IOF etc.",
                    items: {
                        type: "object",
                        required: ["valor"],
                        properties: {
                            tipo: { type: "string" },
                            descricaoCustom: { type: "string" },
                            valor: { type: "number" },
                            dataCobranca: { type: "string" },
                            emDobro: { type: "boolean", description: "Padrão true (Art. 42 CDC)" },
                        },
                    },
                },
                deducoes: {
                    type: "array",
                    description: "Alvarás ou valores já devolvidos a deduzir",
                    items: {
                        type: "object",
                        required: ["descricao", "valor"],
                        properties: {
                            descricao: { type: "string" },
                            valor: { type: "number" },
                            data: { type: "string" },
                            atualizar: { type: "boolean" },
                        },
                    },
                },
                parametros: {
                    type: "object",
                    properties: {
                        indiceCorrecao: { type: "string", enum: ["INPC_IPCA", "INPC", "IPCA", "IGPM", "NENHUM"] },
                        tipoJuros: { type: "string", enum: ["LEI_14905", "SELIC", "FIXO_1", "FIXO_CUSTOM", "NENHUM"] },
                        jurosFixoMensal: { type: "number" },
                        dataBaseAtualizacao: { type: "string" },
                        restituicaoDobroParcelas: { type: "boolean" },
                        multaGlobalPercentual: { type: "number" },
                        honorariosPercentual: { type: "number" },
                    },
                },
                salvarNoHistorico: { type: "boolean", description: "Se false, apenas simula sem salvar no banco (padrão true)" },
            },
        },
    },
    {
        name: "renovar_e_atualizar_caso",
        description:
            "Renova e atualiza um cálculo revisional já existente no histórico: atualiza a data-base de correção monetária (INPC/IPCA/SELIC) para hoje ou outra data, adiciona novos contratos/tarifas/alvarás, atualiza parcelas pagas, preenche número CNJ e salva o novo proveito econômico.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
                calculoId: { type: "string" },
                clienteNome: { type: "string", description: "Nome do cliente para localizar no histórico" },
                processoGlobal: { type: "string", description: "Número CNJ para localizar ou preencher no caso" },
                novoProcessoGlobal: { type: "string", description: "Novo número CNJ a preencher/atualizar" },
                novaDataBase: { type: "string", description: "YYYY-MM-DD (padrão: data de hoje)" },
                novaCategoriaNome: { type: "string", description: "Opcional: mover cartão para outra fase" },
                observacoesAdicionais: { type: "string" },
                pagasContratoPrincipal: { type: "integer" },
                novosContratos: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["dataContrato", "valorFinanciado", "valorParcela", "parcelas"],
                        properties: {
                            descricao: { type: "string" },
                            instituicao: { type: "string" },
                            numeroContrato: { type: "string" },
                            pessoa: { type: "string", enum: ["pf", "pj"] },
                            modalidadeId: { type: "string" },
                            dataContrato: { type: "string" },
                            valorFinanciado: { type: "number" },
                            valorParcela: { type: "number" },
                            parcelas: { type: "integer" },
                            pagas: { type: "integer" },
                            taxaMensal: { type: "number" },
                            taxaAnual: { type: "number" },
                        },
                    },
                },
                novasTarifas: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["valor"],
                        properties: {
                            tipo: { type: "string" },
                            descricaoCustom: { type: "string" },
                            valor: { type: "number" },
                            dataCobranca: { type: "string" },
                            emDobro: { type: "boolean" },
                        },
                    },
                },
                novasDeducoes: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["descricao", "valor"],
                        properties: {
                            descricao: { type: "string" },
                            valor: { type: "number" },
                            data: { type: "string" },
                            atualizar: { type: "boolean" },
                        },
                    },
                },
                parametros: {
                    type: "object",
                    properties: {
                        indiceCorrecao: { type: "string", enum: ["INPC_IPCA", "INPC", "IPCA", "IGPM", "NENHUM"] },
                        tipoJuros: { type: "string", enum: ["LEI_14905", "SELIC", "FIXO_1", "FIXO_CUSTOM", "NENHUM"] },
                        jurosFixoMensal: { type: "number" },
                        restituicaoDobroParcelas: { type: "boolean" },
                        multaGlobalPercentual: { type: "number" },
                        honorariosPercentual: { type: "number" },
                    },
                },
            },
        },
    },
    {
        name: "mover_cartao_kanban",
        description:
            "Move o cartão de um cliente entre as fases do Kanban (ex.: Triagem -> Busca e Apreensão -> Ajuizado -> Acordo / Concluído) e opcionalmente preenche o CNJ ou adiciona observações.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            required: ["novaCategoriaNome"],
            properties: {
                calculoId: { type: "string" },
                clienteNome: { type: "string" },
                processoGlobal: { type: "string" },
                novaCategoriaNome: { type: "string" },
                novoProcessoGlobal: { type: "string" },
                observacoesAdicionais: { type: "string" },
            },
        },
    },
    {
        name: "consultar_carteira_clientes",
        description:
            "Consulta e filtra os cálculos salvos na carteira do escritório por instituição financeira (ex.: Banco Pan), razão de abuso mínima/máxima (ex.: acima de 1,8x), grau de abuso, fase do Kanban, valor mínimo da ação ou texto livre.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
                banco: { type: "string", description: "Ex.: Banco Pan, Santander, BV, Itaú" },
                razaoMinima: { type: "number", description: "Ex.: 1.8 para contratos com taxa >= 1,8x a média" },
                razaoMaxima: { type: "number" },
                nivel: { type: "string", enum: ["abuso", "acima", "media"] },
                categoriaNome: { type: "string" },
                busca: { type: "string" },
                valorMinimoAcao: { type: "number" },
                ordenarPor: { type: "string", enum: ["recentes", "valor_desc", "abuso_desc", "nome_asc"] },
                limite: { type: "integer", minimum: 1, maximum: 200 },
            },
        },
    },
    {
        name: "consultar_taxas_bacen_olinda",
        description:
            "Consulta a taxa média de mercado do Banco Central (SGS) e o ranking diário por instituição financeira na API Olinda do BCB para uma modalidade e data.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            required: ["modalidadeId"],
            properties: {
                modalidadeId: { type: "string", description: "Ex.: veiculo-pf, sem-garantia, consig-inss" },
                dataReferencia: { type: "string", description: "YYYY-MM-DD ou YYYY-MM (padrão: hoje)" },
                bancoFiltro: { type: "string" },
                limiteRanking: { type: "integer", minimum: 1, maximum: 100 },
            },
        },
    },
    {
        name: "listar_fases_e_modalidades",
        description:
            "Lista as fases/colunas existentes no Kanban com contagem e volume financeiro por fase, além das modalidades do BACEN, tipos de tarifas e bancos usuais.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {},
        },
    },
    {
        name: "consultar_publicacoes_djen",
        description:
            "Consulta publicações, intimações, decisões e sentenças na API pública oficial do DJEN (Comunica PJe / CNJ) por número CNJ do processo, nome de cliente/parte ou pela OAB do escritório (padrão OAB/PE 61.107 — Ian Granja), cruzando automaticamente com os clientes salvos no Kanban.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
                clienteNome: {
                    type: "string",
                    description: "Opcional: busca o processo CNJ ou nome do cliente salvo na carteira",
                },
                numeroProcesso: { type: "string", description: "Número do processo CNJ (com ou sem máscara)" },
                numeroOab: { type: "string", description: "Número da OAB (padrão: 61107)" },
                ufOab: { type: "string", description: "UF da OAB (padrão: PE)" },
                nomeParte: { type: "string", description: "Nome de uma das partes" },
                siglaTribunal: { type: "string", description: "Ex.: TJPE, TJBA, TRF5, TRT6" },
                texto: { type: "string", description: "Trecho ou palavra-chave no teor da publicação" },
                ultimosDias: {
                    type: "integer",
                    minimum: 1,
                    maximum: 180,
                    description: "Busca publicações dos últimos N dias até hoje",
                },
                dataInicio: { type: "string", description: "YYYY-MM-DD" },
                dataFim: { type: "string", description: "YYYY-MM-DD" },
                apenasClientesDaCarteira: {
                    type: "boolean",
                    description: "Se true, retorna apenas publicações vinculadas a clientes já salvos no sistema",
                },
                limite: { type: "integer", minimum: 1, maximum: 100 },
            },
        },
    },
] as const;

/* ----------------------------------------------------- Execução das Tools */

export async function executarToolMcp(
    name: string,
    rawArgs: Record<string, unknown>,
    db: RevisionalDbAdapter,
): Promise<unknown> {
    if (name === "calcular_e_cadastrar_caso_revisional") {
        const salvarNoHistorico = rawArgs.salvarNoHistorico !== false;
        const clienteNome = String(rawArgs.clienteNome ?? "").trim();
        if (salvarNoHistorico && !clienteNome) {
            throw new Error("Informe clienteNome para cadastrar o caso no histórico.");
        }

        const contratosRaw = Array.isArray(rawArgs.contratos)
            ? (rawArgs.contratos as ContratoEntradaTool[])
            : [];
        if (contratosRaw.length === 0) {
            throw new Error("Informe pelo menos um contrato em contratos[].");
        }

        const bancoFicha = normalizarBancoInput(
            String(rawArgs.banco ?? contratosRaw[0]?.instituicao ?? ""),
        );
        const numeroContratoFicha = String(
            rawArgs.documentoContrato ?? contratosRaw[0]?.numeroContrato ?? "",
        ).trim();

        const contratos = await Promise.all(
            contratosRaw.map((ct, idx) =>
                resolverContratoInput(ct, idx, bancoFicha, idx === 0 ? numeroContratoFicha : ""),
            ),
        );

        const dataPadrao = contratos[0]?.dataContrato || hojeISO();
        const tarifas = normalizarTarifasEntrada(
            rawArgs.tarifas as TarifaEntradaTool[] | undefined,
            dataPadrao,
        );
        const deducoes = normalizarDeducoesEntrada(
            rawArgs.deducoes as DeducaoEntradaTool[] | undefined,
        );

        const paramRaw = (rawArgs.parametros ?? {}) as Partial<ParametrosDecisao>;
        const parametros: ParametrosDecisao = {
            ...PARAMETROS_DECISAO_PADRAO(),
            ...paramRaw,
            dataBaseAtualizacao: paramRaw.dataBaseAtualizacao
                ? normalizarDataContrato(paramRaw.dataBaseAtualizacao)
                : hojeISO(),
        };

        const processo: ProcessoRevisionalInput = {
            parametros,
            contratos,
            tarifas,
            deducoes,
        };

        const categoria = await resolverOuCriarCategoria(
            db,
            typeof rawArgs.categoriaNome === "string" ? rawArgs.categoriaNome : undefined,
        );

        const ficha: FichaCliente = {
            clienteNome: clienteNome || "Simulação sem identificação",
            processoGlobal: String(rawArgs.processoGlobal ?? "").trim(),
            banco: bancoFicha || contratos[0]?.instituicao || "",
            documentoContrato: numeroContratoFicha || contratos[0]?.numeroContrato || "",
            categoriaId: categoria?.id ?? null,
            observacoes: String(rawArgs.observacoes ?? "").trim(),
        };

        const { onlineByContrato, seriesEconomicas } = await prepararDadosBacenProcesso(processo);
        const resultado = calcularProcessoRevisional(processo, seriesEconomicas, onlineByContrato);

        let salvo: CalculoSalvo | null = null;
        if (salvarNoHistorico) {
            const payload = processoParaPayload(resultado, processo, ficha);
            salvo = await db.criarCalculo(payload);
        }

        const principal = resultado.contratos[0];
        return {
            salvoNoHistorico: Boolean(salvo),
            id: salvo?.id ?? null,
            clienteNome: ficha.clienteNome,
            processoGlobal: ficha.processoGlobal || null,
            banco: ficha.banco,
            faseKanban: categoria?.nome ?? "Sem categoria",
            grauAbuso: principal?.nivel,
            razaoAbusoMensal: principal ? Number(principal.analise.razaoAm.toFixed(4)) : null,
            taxaContratoAm: principal ? Number(principal.analise.contratoAm.toFixed(4)) : null,
            taxaParadigmaAm: principal ? Number(principal.taxaRevisionalAm.toFixed(4)) : null,
            parcelaContrato: principal ? principal.contrato.valorParcela : null,
            parcelaParadigma: principal ? Number(principal.analise.parcelaNaMedia.toFixed(2)) : null,
            resumoFinanceiro: {
                diferencasPagasAtualizada: Number(resultado.resumo.principalContratosAtualizado.toFixed(2)),
                tarifasSegurosAtualizado: Number(resultado.resumo.tarifasAtualizado.toFixed(2)),
                deducoesAtualizado: Number(resultado.resumo.deducoesAtualizado.toFixed(2)),
                totalRestituirCompensar: Number(resultado.resumo.totalRestituicaoAtualizado.toFixed(2)),
                economiaVincendas: Number(resultado.resumo.economiaVincendasTotal.toFixed(2)),
                proveitoEconomicoTotalAcao: Number(resultado.resumo.valorTotalAcao.toFixed(2)),
                proveitoEconomicoFormatado: brl(resultado.resumo.valorTotalAcao),
            },
            resumoParaPeticao: montarTextoPeticaoPro(resultado, ficha, categoria),
        };
    }

    if (name === "renovar_e_atualizar_caso") {
        const { caso, encontradoPor } = await localizarCasoExistente(db, {
            calculoId: typeof rawArgs.calculoId === "string" ? rawArgs.calculoId : undefined,
            clienteNome: typeof rawArgs.clienteNome === "string" ? rawArgs.clienteNome : undefined,
            processoGlobal: typeof rawArgs.processoGlobal === "string" ? rawArgs.processoGlobal : undefined,
        });

        const novaCategoria =
            typeof rawArgs.novaCategoriaNome === "string" && rawArgs.novaCategoriaNome.trim()
                ? await resolverOuCriarCategoria(db, rawArgs.novaCategoriaNome)
                : null;

        const processoParaPreencher =
            typeof rawArgs.novoProcessoGlobal === "string" && rawArgs.novoProcessoGlobal.trim()
                ? rawArgs.novoProcessoGlobal.trim()
                : typeof rawArgs.processoGlobal === "string" &&
                    rawArgs.processoGlobal.trim() &&
                    encontradoPor !== "processo"
                  ? rawArgs.processoGlobal.trim()
                  : undefined;

        const dataPadraoTarifa = caso.mes_contrato ? `${caso.mes_contrato}-10` : hojeISO();
        const novosContratosRaw = Array.isArray(rawArgs.novosContratos)
            ? (rawArgs.novosContratos as ContratoEntradaTool[])
            : [];
        const novosContratos = await Promise.all(
            novosContratosRaw.map((ct, idx) =>
                resolverContratoInput(ct, caso.qtd_contratos + idx, caso.banco, ""),
            ),
        );

        const novasTarifas = normalizarTarifasEntrada(
            rawArgs.novasTarifas as TarifaEntradaTool[] | undefined,
            dataPadraoTarifa,
        );
        const novasDeducoes = normalizarDeducoesEntrada(
            rawArgs.novasDeducoes as DeducaoEntradaTool[] | undefined,
        );

        const prep = await prepararRenovacaoCalculo(caso, {
            novaDataBase:
                typeof rawArgs.novaDataBase === "string" && rawArgs.novaDataBase.trim()
                    ? normalizarDataContrato(rawArgs.novaDataBase)
                    : hojeISO(),
            fichaPatch: {
                ...(processoParaPreencher ? { processoGlobal: processoParaPreencher } : {}),
                ...(novaCategoria ? { categoriaId: novaCategoria.id } : {}),
            },
            observacoesAdicionais:
                typeof rawArgs.observacoesAdicionais === "string" ? rawArgs.observacoesAdicionais : undefined,
            parametrosPatch: (rawArgs.parametros ?? undefined) as Partial<ParametrosDecisao> | undefined,
            pagasContratoPrincipal:
                typeof rawArgs.pagasContratoPrincipal === "number"
                    ? rawArgs.pagasContratoPrincipal
                    : undefined,
            novosContratos,
            novasTarifas,
            novasDeducoes,
        });

        const atualizado = await db.atualizarCalculo(caso.id, prep.payload);
        const categorias = await db.listarCategorias();
        const catAtual = categorias.find((c) => c.id === atualizado.categoria_id) ?? null;

        return {
            id: atualizado.id,
            clienteNome: atualizado.cliente_nome,
            processoGlobal: atualizado.processo_global || null,
            faseKanban: catAtual?.nome ?? "Sem categoria",
            dataBaseAnterior: prep.dataBaseAnterior,
            dataBaseNova: prep.dataBaseNova,
            valorAnterior: prep.valorAnterior,
            valorNovo: prep.valorNovo,
            diferencaGanho: prep.diferencaGanho,
            valorAnteriorFormatado: brl(prep.valorAnterior),
            valorNovoFormatado: brl(prep.valorNovo),
            qtdContratos: atualizado.qtd_contratos,
            totalTarifasAtualizado: atualizado.total_tarifas,
            resumoParaPeticao: montarTextoPeticaoPro(prep.resultado, prep.ficha, catAtual),
        };
    }

    if (name === "mover_cartao_kanban") {
        const novaCategoriaNome = String(rawArgs.novaCategoriaNome ?? "").trim();
        if (!novaCategoriaNome) {
            throw new Error("Informe novaCategoriaNome para mover o cartão no Kanban.");
        }

        const { caso } = await localizarCasoExistente(db, {
            calculoId: typeof rawArgs.calculoId === "string" ? rawArgs.calculoId : undefined,
            clienteNome: typeof rawArgs.clienteNome === "string" ? rawArgs.clienteNome : undefined,
            processoGlobal: typeof rawArgs.processoGlobal === "string" ? rawArgs.processoGlobal : undefined,
        });

        const categoriasAntes = await db.listarCategorias();
        const faseAnterior =
            categoriasAntes.find((c) => c.id === caso.categoria_id)?.nome ?? "Sem categoria";
        const novaCat = await resolverOuCriarCategoria(db, novaCategoriaNome);
        if (!novaCat) {
            throw new Error("Não foi possível resolver ou criar a fase de destino.");
        }

        const patch: Partial<CalculoPayload> = {
            categoria_id: novaCat.id,
        };
        if (typeof rawArgs.novoProcessoGlobal === "string" && rawArgs.novoProcessoGlobal.trim()) {
            patch.processo_global = rawArgs.novoProcessoGlobal.trim();
        }
        if (typeof rawArgs.observacoesAdicionais === "string" && rawArgs.observacoesAdicionais.trim()) {
            const obsAnt = caso.observacoes?.trim() ?? "";
            const obsAdd = rawArgs.observacoesAdicionais.trim();
            patch.observacoes = obsAnt ? `${obsAnt}\n${obsAdd}` : obsAdd;
        }

        const atualizado = await db.atualizarCalculo(caso.id, patch);

        return {
            id: atualizado.id,
            clienteNome: atualizado.cliente_nome,
            processoGlobal: atualizado.processo_global || null,
            faseAnterior,
            faseAtual: novaCat.nome,
            proveitoEconomico: brl(Number(atualizado.valor_total_acao) || Number(atualizado.diferenca_total) || 0),
        };
    }

    if (name === "consultar_carteira_clientes") {
        const [categorias, todosCalculos] = await Promise.all([db.listarCategorias(), db.listarCalculos()]);
        // Fichas do DJEN ainda sem contrato guardam valores sentinela (razão 1, nível "media") e
        // distorceriam médias, filtros e somas: ficam fora da carteira, como na tela.
        const calculos = todosCalculos.filter((c) => !isCalculoPendente(c));
        const qtdAguardandoContrato = todosCalculos.length - calculos.length;
        const mapaCats = new Map(categorias.map((c) => [c.id, c]));

        const bancoFiltro = typeof rawArgs.banco === "string" ? rawArgs.banco.trim() : "";
        const bancoNormOficial = bancoFiltro ? semAcentos(normalizarBancoInput(bancoFiltro)) : "";
        const bancoNormRaw = bancoFiltro ? semAcentos(bancoFiltro) : "";

        const razaoMin = typeof rawArgs.razaoMinima === "number" ? rawArgs.razaoMinima : null;
        const razaoMax = typeof rawArgs.razaoMaxima === "number" ? rawArgs.razaoMaxima : null;
        const nivelFiltro = typeof rawArgs.nivel === "string" ? (rawArgs.nivel as Nivel) : null;
        const catFiltro =
            typeof rawArgs.categoriaNome === "string" && rawArgs.categoriaNome.trim()
                ? resolverCategoriaPorNome(rawArgs.categoriaNome, categorias)
                : null;
        const buscaTexto = typeof rawArgs.busca === "string" ? semAcentos(rawArgs.busca) : "";
        const valorMinimo = typeof rawArgs.valorMinimoAcao === "number" ? rawArgs.valorMinimoAcao : null;

        let filtrados = calculos.filter((c) => {
            if (bancoFiltro) {
                const rotBanco = semAcentos(normalizarRotuloBanco(c.banco || ""));
                const rawBanco = semAcentos(c.banco || "");
                const normBanco = semAcentos(normalizarBancoInput(c.banco || ""));
                const bate =
                    rawBanco.includes(bancoNormRaw) ||
                    rotBanco.includes(bancoNormRaw) ||
                    (bancoNormOficial && normBanco === bancoNormOficial);
                if (!bate) return false;
            }
            if (razaoMin !== null && Number(c.razao_am) < razaoMin) return false;
            if (razaoMax !== null && Number(c.razao_am) > razaoMax) return false;
            if (nivelFiltro && c.nivel !== nivelFiltro) return false;
            if (catFiltro && c.categoria_id !== catFiltro.id) return false;
            if (
                typeof rawArgs.categoriaNome === "string" &&
                rawArgs.categoriaNome.trim() &&
                !catFiltro &&
                semAcentos(rawArgs.categoriaNome) !== "sem categoria"
            ) {
                return false;
            }
            if (
                typeof rawArgs.categoriaNome === "string" &&
                semAcentos(rawArgs.categoriaNome) === "sem categoria" &&
                c.categoria_id !== null
            ) {
                return false;
            }
            const valAcao = Number(c.valor_total_acao) || Number(c.diferenca_total) || 0;
            if (valorMinimo !== null && valAcao < valorMinimo) return false;

            if (buscaTexto) {
                const alvo = semAcentos(
                    `${c.cliente_nome} ${c.processo_global} ${c.banco} ${c.documento_contrato} ${c.modalidade_nome} ${c.observacoes}`,
                );
                if (!alvo.includes(buscaTexto)) return false;
            }
            return true;
        });

        const ordenarPor = typeof rawArgs.ordenarPor === "string" ? rawArgs.ordenarPor : "abuso_desc";
        filtrados = [...filtrados].sort((a, b) => {
            if (ordenarPor === "valor_desc") {
                return (
                    (Number(b.valor_total_acao) || Number(b.diferenca_total) || 0) -
                    (Number(a.valor_total_acao) || Number(a.diferenca_total) || 0)
                );
            }
            if (ordenarPor === "nome_asc") {
                return a.cliente_nome.localeCompare(b.cliente_nome, "pt-BR");
            }
            if (ordenarPor === "recentes") {
                return b.updated_at.localeCompare(a.updated_at);
            }
            return (Number(b.razao_am) || 0) - (Number(a.razao_am) || 0);
        });

        const limite = Math.min(200, Math.max(1, Number(rawArgs.limite) || 50));
        const somaProveito = filtrados.reduce(
            (acc, c) => acc + (Number(c.valor_total_acao) || Number(c.diferenca_total) || 0),
            0,
        );
        const mediaRazao =
            filtrados.length > 0
                ? filtrados.reduce((acc, c) => acc + Number(c.razao_am || 0), 0) / filtrados.length
                : 0;

        return {
            totalEncontrados: filtrados.length,
            processosAguardandoContrato: qtdAguardandoContrato,
            somaProveitoEconomico: Math.round(somaProveito * 100) / 100,
            somaProveitoFormatado: brl(somaProveito),
            mediaRazaoAbuso: Number(mediaRazao.toFixed(2)),
            casosComAbusoGrave: filtrados.filter((c) => c.nivel === "abuso").length,
            clientes: filtrados.slice(0, limite).map((c) => {
                const val = Number(c.valor_total_acao) || Number(c.diferenca_total) || 0;
                return {
                    id: c.id,
                    clienteNome: c.cliente_nome,
                    processoGlobal: c.processo_global || null,
                    banco: c.banco ? normalizarRotuloBanco(c.banco) : "Não informado",
                    faseKanban: c.categoria_id ? mapaCats.get(c.categoria_id)?.nome ?? "Sem categoria" : "Sem categoria",
                    modalidade: c.modalidade_nome,
                    mesContrato: c.mes_contrato,
                    taxaContratoAm: Number(c.contrato_am),
                    taxaMediaBacenAm: Number(c.media_am),
                    razaoAbuso: Number(c.razao_am),
                    razaoFormatada: `${num(Number(c.razao_am), 2)}x`,
                    nivel: c.nivel,
                    parcelasPagas: `${c.pagas}/${c.parcelas}`,
                    qtdContratos: c.qtd_contratos,
                    totalTarifas: Number(c.total_tarifas),
                    valorTotalAcao: val,
                    valorTotalAcaoFormatado: brl(val),
                    atualizadoEm: c.updated_at,
                };
            }),
        };
    }

    if (name === "consultar_taxas_bacen_olinda") {
        const { id: modId } = normalizarModalidadeInput(String(rawArgs.modalidadeId ?? ""));
        const mod = MODALIDADES.find((m) => m.id === modId);
        if (!mod) {
            throw new Error(`Modalidade "${String(rawArgs.modalidadeId)}" não encontrada.`);
        }
        const dataRef = rawArgs.dataReferencia
            ? normalizarDataContrato(String(rawArgs.dataReferencia))
            : hojeISO();
        const mesRef = dataRef.slice(0, 7);

        const online = await consultarBacen(mod, mesRef);
        const media = taxaMedia(mod, mesRef);
        const olinda = await consultarTaxasOlinda(mod, dataRef);

        const filtro = typeof rawArgs.bancoFiltro === "string" ? semAcentos(rawArgs.bancoFiltro) : "";
        const filtrados = filtro
            ? olinda.filter((r) => semAcentos(r.instituicao).includes(filtro))
            : olinda;
        const limite = Math.min(100, Math.max(1, Number(rawArgs.limiteRanking) || 20));

        return {
            modalidadeId: mod.id,
            modalidadeNome: mod.nome,
            pessoa: mod.pessoa.toUpperCase(),
            dataReferencia: dataRef,
            onlineBacenSgs: online,
            mediaMercadoSgs: media
                ? {
                      mes: media.mes,
                      mesFormatado: mNome(media.mes),
                      taxaAm: media.am,
                      taxaAa: media.aa,
                      serieAm: media.serieAm,
                      serieAa: media.serieAa,
                      nota: media.nota || null,
                  }
                : null,
            rankingOlinda: filtrados.slice(0, limite),
        };
    }

    if (name === "listar_fases_e_modalidades") {
        const [categorias, todosCalculos] = await Promise.all([db.listarCategorias(), db.listarCalculos()]);
        const calculos = todosCalculos.filter((c) => !isCalculoPendente(c));
        const pendentes = todosCalculos.filter((c) => isCalculoPendente(c));
        const fases = categorias.map((cat) => {
            const itens = calculos.filter((c) => c.categoria_id === cat.id);
            const soma = itens.reduce(
                (acc, c) => acc + (Number(c.valor_total_acao) || Number(c.diferenca_total) || 0),
                0,
            );
            return {
                id: cat.id,
                nome: cat.nome,
                cor: cat.cor,
                ordem: cat.ordem,
                qtdCasos: itens.length,
                qtdAguardandoContrato: pendentes.filter((c) => c.categoria_id === cat.id).length,
                proveitoTotal: Math.round(soma * 100) / 100,
                proveitoFormatado: brl(soma),
            };
        });
        const semCategoriaValida = (c: CalculoSalvo) =>
            !c.categoria_id || !categorias.some((x) => x.id === c.categoria_id);
        const semCat = calculos.filter(semCategoriaValida);
        const pendentesSemCat = pendentes.filter(semCategoriaValida);
        if (semCat.length > 0 || pendentesSemCat.length > 0) {
            const somaSem = semCat.reduce(
                (acc, c) => acc + (Number(c.valor_total_acao) || Number(c.diferenca_total) || 0),
                0,
            );
            fases.push({
                id: "sem",
                nome: "Sem categoria",
                cor: "slate",
                ordem: 999,
                qtdCasos: semCat.length,
                qtdAguardandoContrato: pendentesSemCat.length,
                proveitoTotal: Math.round(somaSem * 100) / 100,
                proveitoFormatado: brl(somaSem),
            });
        }

        return {
            totalCasosCarteira: calculos.length,
            processosAguardandoContrato: pendentes.length,
            fases,
            modalidades: MODALIDADES.map((m) => ({
                id: m.id,
                nome: m.nome,
                pessoa: m.pessoa,
                resumo: m.resumo,
            })),
            tiposTarifa: TIPOS_TARIFA,
            bancosUsuais: BANCOS_USUAIS,
        };
    }

    if (name === "consultar_publicacoes_djen") {
        const [categorias, calculos] = await Promise.all([db.listarCategorias(), db.listarCalculos()]);

        let numeroProcesso = typeof rawArgs.numeroProcesso === "string" ? rawArgs.numeroProcesso.trim() : "";
        let nomeParte = typeof rawArgs.nomeParte === "string" ? rawArgs.nomeParte.trim() : "";
        const clienteNome = typeof rawArgs.clienteNome === "string" ? rawArgs.clienteNome.trim() : "";

        if (clienteNome && !numeroProcesso) {
            try {
                const { caso } = await localizarCasoExistente(db, { clienteNome });
                if (caso.processo_global?.trim()) {
                    numeroProcesso = caso.processo_global.trim();
                } else if (!nomeParte) {
                    nomeParte = caso.cliente_nome;
                }
            } catch {
                if (!nomeParte) nomeParte = clienteNome;
            }
        }

        const siglaTribunal = typeof rawArgs.siglaTribunal === "string" ? rawArgs.siglaTribunal.trim() : "";
        const textoBusca = typeof rawArgs.texto === "string" ? rawArgs.texto.trim() : "";

        const informouOab = typeof rawArgs.numeroOab === "string" && rawArgs.numeroOab.trim().length > 0;
        let numeroOab = informouOab ? String(rawArgs.numeroOab).trim() : "";
        let ufOab = typeof rawArgs.ufOab === "string" && rawArgs.ufOab.trim() ? rawArgs.ufOab.trim() : "";

        if (!numeroProcesso && !numeroOab && !siglaTribunal && !textoBusca) {
            numeroOab = OAB_ESCRITORIO_PADRAO.numeroOab;
            ufOab = ufOab || OAB_ESCRITORIO_PADRAO.ufOab;
        } else if (numeroOab && !ufOab) {
            ufOab = OAB_ESCRITORIO_PADRAO.ufOab;
        }

        let dataInicio = typeof rawArgs.dataInicio === "string" ? rawArgs.dataInicio.trim() : "";
        let dataFim = typeof rawArgs.dataFim === "string" ? rawArgs.dataFim.trim() : "";
        if (typeof rawArgs.ultimosDias === "number" && rawArgs.ultimosDias > 0 && !dataInicio) {
            const fimDate = new Date();
            const iniDate = new Date(fimDate.getTime() - rawArgs.ultimosDias * 86400_000);
            dataInicio = iniDate.toISOString().slice(0, 10);
            dataFim = dataFim || fimDate.toISOString().slice(0, 10);
        }

        const limite = Math.min(100, Math.max(1, Number(rawArgs.limite) || 15));
        const res = await consultarDjen({
            numeroProcesso: numeroProcesso || undefined,
            numeroOab: numeroOab || undefined,
            ufOab: ufOab || undefined,
            nomeParte: nomeParte || undefined,
            siglaTribunal: siglaTribunal || undefined,
            texto: textoBusca || undefined,
            dataDisponibilizacaoInicio: dataInicio || undefined,
            dataDisponibilizacaoFim: dataFim || undefined,
            itensPorPagina: limite <= 5 ? 5 : 100,
        });

        const cruzadas = cruzarComunicacoesComCarteira(res.items, calculos, categorias);
        const filtradas =
            rawArgs.apenasClientesDaCarteira === true
                ? cruzadas.filter((item) => item.clienteVinculado !== null)
                : cruzadas;
        const limitadas = filtradas.slice(0, limite);

        return {
            totalNoDjen: res.totalRegistros,
            exibidas: limitadas.length,
            comVinculoNaCarteira: cruzadas.filter((item) => item.clienteVinculado !== null).length,
            filtroAplicado: {
                numeroProcesso: numeroProcesso || null,
                numeroOab: numeroOab ? `${numeroOab}/${ufOab}` : null,
                nomeParte: nomeParte || null,
                siglaTribunal: siglaTribunal || null,
                periodo: dataInicio || dataFim ? `${dataInicio || "..."} até ${dataFim || "..."}` : null,
            },
            publicacoes: limitadas.map((item) => ({
                id: item.id,
                data: item.dataDisponibilizacaoBr,
                tribunal: item.siglaTribunal,
                orgao: item.nomeOrgao,
                classe: item.nomeClasse,
                tipoComunicacao: item.tipoComunicacao,
                numeroProcesso: item.numeroProcessoMascara,
                link: item.link || null,
                clienteVinculado: item.clienteVinculado,
                bancoDetectado: item.bancoDetectado || null,
                clienteSugerido: item.clienteSugerido || null,
                destinatarios: item.destinatarios,
                teor: item.texto,
            })),
        };
    }

    throw new Error(`Ferramenta MCP desconhecida: "${name}".`);
}

/* ----------------------------------------------------- Protocolo JSON-RPC 2.0 MCP */

export interface JsonRpcRequest {
    jsonrpc?: string;
    id?: string | number | null;
    method: string;
    params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: string | number | null;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

/**
 * Ponto de entrada JSON-RPC: qualquer exceção (ex.: credenciais do Supabase expiradas em
 * resources/read) vira uma resposta de erro -32603 com o id original, para o cliente MCP não ficar
 * esperando nem receber um 500 sem corpo.
 */
export async function handleMcpJsonRpc(
    req: JsonRpcRequest,
    db: RevisionalDbAdapter,
): Promise<JsonRpcResponse | null> {
    try {
        return await despacharMcpJsonRpc(req, db);
    } catch (err) {
        const id = req && req.id !== undefined && req.id !== null ? req.id : null;
        return {
            jsonrpc: "2.0",
            id,
            error: {
                code: -32603,
                message: `Erro interno: ${err instanceof Error ? err.message : String(err)}`,
            },
        };
    }
}

async function despacharMcpJsonRpc(
    req: JsonRpcRequest,
    db: RevisionalDbAdapter,
): Promise<JsonRpcResponse | null> {
    const hasId = req.id !== undefined && req.id !== null;
    const id = hasId ? req.id! : null;

    if (!req.method) {
        return {
            jsonrpc: "2.0",
            id,
            error: { code: -32600, message: "Invalid Request: missing method" },
        };
    }

    // Notificações JSON-RPC não devem gerar resposta
    if (req.method.startsWith("notifications/") && !hasId) {
        return null;
    }

    if (req.method === "initialize") {
        const clientProto =
            typeof req.params?.protocolVersion === "string" ? req.params.protocolVersion : "2024-11-05";
        return {
            jsonrpc: "2.0",
            id,
            result: {
                protocolVersion: clientProto,
                capabilities: {
                    tools: { listChanged: false },
                    resources: { listChanged: false },
                    prompts: { listChanged: false },
                },
                serverInfo: {
                    name: "ian-granja-revisional-mcp",
                    version: "1.0.0",
                },
                instructions:
                    "Conector oficial da Calculadora Revisional Bancária (Ian Granja Advogados). Use calcular_e_cadastrar_caso_revisional ao ler contratos em PDF/foto, renovar_e_atualizar_caso para atualizar índices BACEN ou adicionar tarifas/alvarás/CNJ, mover_cartao_kanban para mudar fases e consultar_carteira_clientes para pesquisar processos por banco ou grau de abuso.",
            },
        };
    }

    if (req.method === "notifications/initialized" || req.method === "ping") {
        return { jsonrpc: "2.0", id, result: {} };
    }

    if (req.method === "tools/list") {
        return {
            jsonrpc: "2.0",
            id,
            result: { tools: MCP_TOOLS },
        };
    }

    if (req.method === "tools/call") {
        const toolName = typeof req.params?.name === "string" ? req.params.name : "";
        const args =
            req.params?.arguments && typeof req.params.arguments === "object"
                ? (req.params.arguments as Record<string, unknown>)
                : {};
        try {
            const output = await executarToolMcp(toolName, args, db);
            return {
                jsonrpc: "2.0",
                id,
                result: {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(output, null, 2),
                        },
                    ],
                    isError: false,
                },
            };
        } catch (err) {
            return {
                jsonrpc: "2.0",
                id,
                result: {
                    content: [
                        {
                            type: "text",
                            text: `Erro ao executar ${toolName}: ${err instanceof Error ? err.message : String(err)}`,
                        },
                    ],
                    isError: true,
                },
            };
        }
    }

    if (req.method === "resources/list") {
        return {
            jsonrpc: "2.0",
            id,
            result: {
                resources: [
                    {
                        uri: "revisional://carteira/resumo",
                        name: "Resumo da Carteira Revisional",
                        description: "Fases do Kanban, totais financeiros e clientes salvos.",
                        mimeType: "application/json",
                    },
                    {
                        uri: "revisional://referencia/modalidades",
                        name: "Modalidades BACEN e Tarifas",
                        description: "Catálogo de modalidades SGS/Olinda, bancos e tipos de tarifas.",
                        mimeType: "application/json",
                    },
                ],
            },
        };
    }

    if (req.method === "resources/read") {
        const uri = typeof req.params?.uri === "string" ? req.params.uri : "";
        if (uri === "revisional://carteira/resumo") {
            const data = await executarToolMcp("consultar_carteira_clientes", { limite: 100 }, db);
            return {
                jsonrpc: "2.0",
                id,
                result: {
                    contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }],
                },
            };
        }
        if (uri === "revisional://referencia/modalidades") {
            const data = await executarToolMcp("listar_fases_e_modalidades", {}, db);
            return {
                jsonrpc: "2.0",
                id,
                result: {
                    contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }],
                },
            };
        }
        return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: `Recurso não encontrado: ${uri}` },
        };
    }

    if (req.method === "prompts/list") {
        return {
            jsonrpc: "2.0",
            id,
            result: {
                prompts: [
                    {
                        name: "analisar_contrato_revisional",
                        description:
                            "Extrai dados de um contrato bancário anexado, calcula pela média BACEN e cadastra o cliente no Kanban.",
                        arguments: [
                            { name: "fase_kanban", description: "Ex.: Busca e Apreensão", required: false },
                            { name: "tarifas_em_dobro", description: "sim/não", required: false },
                        ],
                    },
                ],
            },
        };
    }

    if (req.method === "prompts/get") {
        const nomePrompt = typeof req.params?.name === "string" ? req.params.name : "";
        if (nomePrompt !== "analisar_contrato_revisional") {
            return {
                jsonrpc: "2.0",
                id,
                error: { code: -32602, message: `Prompt desconhecido: ${nomePrompt}` },
            };
        }
        const fase = typeof req.params?.arguments === "object" && req.params.arguments
            ? String((req.params.arguments as Record<string, unknown>).fase_kanban ?? "Busca e Apreensão")
            : "Busca e Apreensão";
        return {
            jsonrpc: "2.0",
            id,
            result: {
                description: "Fluxo completo de análise revisional a partir de contrato bancário.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Leia o contrato bancário anexado, identifique cliente, banco, nº do contrato, data da contratação, modalidade, valor financiado, valor da parcela, quantidade de parcelas, taxa mensal/anual e seguros/tarifas embutidas (Seguro Prestamista, Avaliação do Bem, Registro, IOF, TAC/TEC). Em seguida execute a ferramenta calcular_e_cadastrar_caso_revisional cadastrando na fase "${fase}" e me apresente o resumo pronto para a petição inicial.`,
                        },
                    },
                ],
            },
        };
    }

    return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${req.method}` },
    };
}
