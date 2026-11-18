import { MODALIDADES, num, type Analise, type Modalidade, type Nivel, type Pessoa } from "./juros/index.ts";
import {
    PARAMETROS_DECISAO_PADRAO,
    primeiroVencimentoSugerido,
    type ContratoInput,
    type ProcessoRevisionalInput,
    type ResultadoProcessoRevisional,
} from "./juros/revisional-pro.ts";

const DEFAULT_SUPABASE_URL = "https://smeaktuuuxahmbzpjwqa.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZWFrdHV1dXhhaG1ienBqd3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MDkwNDYsImV4cCI6MjExMDA4NTA0Nn0.w9BajnZKcF3wgzCxxK45QfZAzayKNCYK_ynqyG17Rb4";

const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
export const SUPABASE_URL = metaEnv?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = metaEnv?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
export const IS_LOCAL_SUPABASE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SUPABASE_URL);

const SESSION_KEY = IS_LOCAL_SUPABASE ? "ig_revisional_session_local_v1" : "ig_revisional_session_v1";

export type CategoriaCor = "gold" | "ink" | "crimson" | "emerald" | "slate";

export interface Categoria {
    id: string;
    nome: string;
    cor: CategoriaCor;
    ordem: number;
    created_at: string;
}

export interface FichaCliente {
    clienteNome: string;
    processoGlobal?: string;
    banco: string;
    documentoContrato: string;
    categoriaId: string | null;
    observacoes: string;
}

export interface CalculoSalvo {
    id: string;
    categoria_id: string | null;
    cliente_nome: string;
    processo_global: string;
    banco: string;
    documento_contrato: string;
    observacoes: string;
    pessoa: Pessoa;
    modalidade_id: string;
    modalidade_nome: string;
    mes_contrato: string;
    valor_financiado: number;
    valor_parcela: number;
    parcelas: number;
    pagas: number;
    taxa_mensal_informada: number | null;
    taxa_anual_informada: number | null;
    media_mensal_manual: number | null;
    media_anual_manual: number | null;
    contrato_am: number;
    contrato_aa: number;
    taxa_efetiva: number;
    media_am: number;
    media_aa: number;
    media_mes: string;
    serie_am: number | null;
    serie_aa: number | null;
    razao_am: number;
    razao_aa: number;
    nivel: Nivel;
    diferenca_total: number;
    pago_a_mais: number;
    saldo_recalculado: number;
    qtd_contratos: number;
    total_tarifas: number;
    valor_total_acao: number;
    dados_completos: Partial<ProcessoRevisionalInput>;
    created_by_email: string;
    created_at: string;
    updated_at: string;
}

export type CalculoPayload = Omit<
    CalculoSalvo,
    "id" | "created_by_email" | "created_at" | "updated_at"
>;

export interface RevisionalSession {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: {
        id: string;
        email: string;
    };
}

export class RevisionalApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = "RevisionalApiError";
        this.status = status;
    }
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const optNum = (n?: number) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? round4(n) : null);

export function analiseParaPayload(a: Analise, ficha: FichaCliente): CalculoPayload {
    const e = a.entrada;
    const clienteNome = ficha.clienteNome.trim();
    if (!clienteNome) {
        throw new Error("Informe o nome do cliente antes de salvar.");
    }

    return {
        categoria_id: ficha.categoriaId || null,
        cliente_nome: clienteNome,
        processo_global: (ficha.processoGlobal ?? "").trim(),
        banco: ficha.banco.trim(),
        documento_contrato: ficha.documentoContrato.trim(),
        observacoes: ficha.observacoes.trim(),
        pessoa: e.mod.pessoa,
        modalidade_id: e.mod.id,
        modalidade_nome: e.mod.nome,
        mes_contrato: e.mes,
        valor_financiado: round2(e.valor),
        valor_parcela: round2(e.parcela),
        parcelas: e.parcelas,
        pagas: e.pagas,
        taxa_mensal_informada: optNum(e.taxaMensal),
        taxa_anual_informada: optNum(e.taxaAnual),
        media_mensal_manual: optNum(e.mediaMensal),
        media_anual_manual: optNum(e.mediaAnual),
        contrato_am: round4(a.contratoAm),
        contrato_aa: round4(a.contratoAa),
        taxa_efetiva: round4(a.taxaEfetiva),
        media_am: round4(a.media.am),
        media_aa: round4(a.media.aa),
        media_mes: a.media.mes,
        serie_am: a.media.serieAm,
        serie_aa: a.media.serieAa,
        razao_am: round4(a.razaoAm),
        razao_aa: round4(a.razaoAa),
        nivel: a.nivel,
        diferenca_total: round2(a.diferenca),
        pago_a_mais: round2(a.pagoAMais),
        saldo_recalculado: round2(a.saldoRecalculado),
        qtd_contratos: 1,
        total_tarifas: 0,
        valor_total_acao: round2(a.diferenca),
        dados_completos: {},
    };
}

export function processoParaPayload(
    resultado: ResultadoProcessoRevisional,
    input: ProcessoRevisionalInput,
    ficha: FichaCliente,
): CalculoPayload {
    const principal = resultado.contratos[0];
    if (!principal) {
        throw new Error("Adicione pelo menos um contrato antes de salvar.");
    }
    const base = analiseParaPayload(principal.analise, {
        ...ficha,
        banco: ficha.banco.trim() || principal.contrato.instituicao,
        documentoContrato: ficha.documentoContrato.trim() || principal.contrato.numeroContrato,
    });

    const pagoAMaisTotal = resultado.contratos.reduce((s, r) => s + r.analise.pagoAMais, 0);
    const diferencaTotalContratos = resultado.contratos.reduce((s, r) => s + r.analise.diferenca, 0);
    const saldoRecalculadoTotal = resultado.contratos.reduce((s, r) => s + r.analise.saldoRecalculado, 0);

    return {
        ...base,
        diferenca_total: round2(diferencaTotalContratos),
        pago_a_mais: round2(pagoAMaisTotal),
        saldo_recalculado: round2(saldoRecalculadoTotal),
        qtd_contratos: resultado.contratos.length,
        total_tarifas: round2(resultado.resumo.tarifasAtualizado),
        valor_total_acao: round2(resultado.resumo.valorTotalAcao),
        dados_completos: input,
    };
}

export function calculoParaProcesso(c: CalculoSalvo): {
    ficha: FichaCliente;
    processo: ProcessoRevisionalInput;
} {
    const ficha: FichaCliente = {
        clienteNome: c.cliente_nome,
        processoGlobal: c.processo_global ?? "",
        banco: c.banco ?? "",
        documentoContrato: c.documento_contrato ?? "",
        categoriaId: c.categoria_id,
        observacoes: c.observacoes ?? "",
    };

    const padrao = PARAMETROS_DECISAO_PADRAO();
    const dc = c.dados_completos;
    if (dc && Array.isArray(dc.contratos) && dc.contratos.length > 0) {
        return {
            ficha,
            processo: {
                parametros: { ...padrao, ...(dc.parametros ?? {}) },
                contratos: dc.contratos.map((ct, idx) => ({
                    ...ct,
                    id: ct.id || `c-${idx + 1}`,
                    pagamentosExtras: Array.isArray(ct.pagamentosExtras) ? ct.pagamentosExtras : [],
                })),
                tarifas: Array.isArray(dc.tarifas) ? dc.tarifas : [],
                deducoes: Array.isArray(dc.deducoes) ? dc.deducoes : [],
            },
        };
    }

    // Retrocompatibilidade para registros antigos sem dados_completos
    const dataContrato = `${c.mes_contrato}-10`;
    const contratoLegado: ContratoInput = {
        id: "c-1",
        descricao: "Contrato 1",
        instituicao: c.banco ?? "",
        numeroContrato: c.documento_contrato ?? "",
        pessoa: c.pessoa,
        modalidadeId: c.modalidade_id,
        dataContrato,
        primeiroVencimento: primeiroVencimentoSugerido(dataContrato),
        valorFinanciado: Number(c.valor_financiado),
        valorParcela: Number(c.valor_parcela),
        parcelas: c.parcelas,
        pagas: c.pagas,
        taxaMensal: c.taxa_mensal_informada ?? undefined,
        taxaAnual: c.taxa_anual_informada ?? undefined,
        fonteTaxaRevisional:
            c.media_mensal_manual != null || c.media_anual_manual != null ? "manual" : "media_sgs",
        taxaRevisionalManualAm: c.media_mensal_manual ?? undefined,
        taxaRevisionalManualAa: c.media_anual_manual ?? undefined,
        bancoOlinda: null,
        pagamentosExtras: [],
    };

    return {
        ficha,
        processo: {
            parametros: padrao,
            contratos: [contratoLegado],
            tarifas: [],
            deducoes: [],
        },
    };
}

export interface FormularioRestaurado {
    pessoa: Pessoa;
    mod: Modalidade | null;
    mes: string;
    ano: string;
    valorF: string;
    parcela: string;
    parcelas: string;
    pagas: string;
    taxaM: string;
    taxaA: string;
    mediaM: string;
    mediaA: string;
    ficha: FichaCliente;
}

export function calculoParaFormulario(c: CalculoSalvo): FormularioRestaurado {
    const [ano = "", mes = ""] = c.mes_contrato.split("-");
    const mod = MODALIDADES.find((m) => m.id === c.modalidade_id) ?? null;
    return {
        pessoa: c.pessoa,
        mod,
        mes,
        ano,
        valorF: num(Number(c.valor_financiado)),
        parcela: num(Number(c.valor_parcela)),
        parcelas: String(c.parcelas),
        pagas: String(c.pagas),
        taxaM: c.taxa_mensal_informada != null ? num(Number(c.taxa_mensal_informada)) : "",
        taxaA: c.taxa_anual_informada != null ? num(Number(c.taxa_anual_informada)) : "",
        mediaM: c.media_mensal_manual != null ? num(Number(c.media_mensal_manual)) : "",
        mediaA: c.media_anual_manual != null ? num(Number(c.media_anual_manual)) : "",
        ficha: {
            clienteNome: c.cliente_nome,
            processoGlobal: c.processo_global ?? "",
            banco: c.banco ?? "",
            documentoContrato: c.documento_contrato ?? "",
            categoriaId: c.categoria_id,
            observacoes: c.observacoes ?? "",
        },
    };
}

/* ----------------------------------------------------- Sessão / GoTrue Auth */

interface BrowserEnv {
    localStorage: {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
        removeItem(key: string): void;
    };
    location: {
        hash: string;
        pathname: string;
        search: string;
        origin: string;
    };
    history: {
        replaceState(data: unknown, unused: string, url?: string | null): void;
    };
}

function getBrowser(): BrowserEnv | null {
    const g = globalThis as unknown as { window?: BrowserEnv };
    return g.window ?? null;
}

function readStoredSession(): RevisionalSession | null {
    const win = getBrowser();
    if (!win) return null;
    try {
        const raw = win.localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as RevisionalSession;
        if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.user?.email) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeStoredSession(session: RevisionalSession | null) {
    const win = getBrowser();
    if (!win) return;
    if (!session) {
        win.localStorage.removeItem(SESSION_KEY);
    } else {
        win.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
}

interface GoTrueTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: { id: string; email?: string };
}

function mapTokenResponse(data: GoTrueTokenResponse): RevisionalSession {
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
        user: {
            id: data.user.id,
            email: data.user.email ?? "",
        },
    };
}

function traduzirErroAuth(status: number, msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
    if (lower.includes("signups not allowed")) return "Cadastro público desativado. Solicite acesso ao administrador.";
    if (status === 429 || lower.includes("rate limit") || lower.includes("security purposes")) {
        return "Muitas solicitações seguidas. Aguarde um minuto e tente novamente.";
    }
    if (lower.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
    return "Não foi possível autenticar agora. Tente novamente.";
}

/** Verifica se a URL veio de um link de redefinição de senha (#access_token=...&type=recovery). */
export async function consumirHashRecuperacao(): Promise<{ session: RevisionalSession; recovery: boolean } | null> {
    const win = getBrowser();
    if (!win || !win.location.hash.includes("access_token=")) return null;
    const params = new URLSearchParams(win.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn = Number(params.get("expires_in") || "3600");
    const type = params.get("type");
    win.history.replaceState(null, "", win.location.pathname + win.location.search);

    if (!accessToken || !refreshToken) return null;

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id: string; email?: string };
    const session: RevisionalSession = {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
        user: { id: user.id, email: user.email ?? "" },
    };
    writeStoredSession(session);
    return { session, recovery: type === "recovery" };
}

export async function entrarComSenha(email: string, password: string): Promise<RevisionalSession> {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
    });

    const body = (await res.json().catch(() => ({}))) as Partial<GoTrueTokenResponse> & {
        msg?: string;
        error_description?: string;
        message?: string;
    };

    if (!res.ok || !body.access_token || !body.refresh_token || !body.user) {
        const rawMsg = body.error_description || body.msg || body.message || "";
        throw new RevisionalApiError(traduzirErroAuth(res.status, rawMsg), res.status);
    }

    const session = mapTokenResponse(body as GoTrueTokenResponse);
    writeStoredSession(session);
    return session;
}

export async function obterSessaoAtiva(): Promise<RevisionalSession | null> {
    const current = readStoredSession();
    if (!current) return null;
    if (current.expiresAt - 60_000 > Date.now()) {
        return current;
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ refresh_token: current.refreshToken }),
        });
        if (!res.ok) {
            writeStoredSession(null);
            return null;
        }
        const refreshed = mapTokenResponse((await res.json()) as GoTrueTokenResponse);
        writeStoredSession(refreshed);
        return refreshed;
    } catch {
        return current;
    }
}

export async function sairDaSessao(): Promise<void> {
    const current = readStoredSession();
    writeStoredSession(null);
    if (!current) return;
    try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${current.accessToken}`,
            },
        });
    } catch {
        /* token local já removido */
    }
}

export async function solicitarRecuperacaoSenha(email: string): Promise<void> {
    const win = getBrowser();
    const redirectTo = win
        ? `${win.location.origin}/ferramentas/calculadora-revisional`
        : "https://www.iangranja.adv.br/ferramentas/calculadora-revisional";

    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
        throw new RevisionalApiError(traduzirErroAuth(res.status, body.msg || body.message || ""), res.status);
    }
}

export async function alterarSenha(novaSenha: string): Promise<void> {
    if (novaSenha.length < 8) {
        throw new Error("Escolha uma senha com pelo menos 8 caracteres.");
    }
    const session = await obterSessaoAtiva();
    if (!session) throw new RevisionalApiError("Sessão expirada. Entre novamente.", 401);

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: novaSenha }),
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
        throw new RevisionalApiError(traduzirErroAuth(res.status, body.msg || body.message || ""), res.status);
    }
}

/* ----------------------------------------------------- PostgREST Data Layer */

async function restRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const session = await obterSessaoAtiva();
    if (!session) {
        throw new RevisionalApiError("Sua sessão expirou. Entre novamente.", 401);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...init,
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
    });

    if (res.status === 401) {
        writeStoredSession(null);
        throw new RevisionalApiError("Sessão expirada. Entre novamente.", 401);
    }

    if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
        if (errBody.code === "23505") {
            throw new RevisionalApiError("Já existe uma categoria com este nome.", 409);
        }
        if (res.status === 403 || errBody.code === "42501") {
            throw new RevisionalApiError("Esta conta não tem permissão para acessar o histórico do escritório.", 403);
        }
        throw new RevisionalApiError(errBody.message || "Erro ao comunicar com o banco de dados.", res.status);
    }

    if (res.status === 204) return undefined as T;
    const raw: unknown = await res.json();
    return normalizeNumericRow(raw) as T;
}

const NUMERIC_CALCULO_KEYS = new Set([
    "valor_financiado",
    "valor_parcela",
    "taxa_mensal_informada",
    "taxa_anual_informada",
    "media_mensal_manual",
    "media_anual_manual",
    "contrato_am",
    "contrato_aa",
    "taxa_efetiva",
    "media_am",
    "media_aa",
    "razao_am",
    "razao_aa",
    "diferenca_total",
    "pago_a_mais",
    "saldo_recalculado",
    "total_tarifas",
    "valor_total_acao",
]);

function normalizeNumericRow(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(normalizeNumericRow);
    if (!input || typeof input !== "object") return input;
    const obj = { ...(input as Record<string, unknown>) };
    for (const key of NUMERIC_CALCULO_KEYS) {
        if (key in obj && obj[key] != null) {
            obj[key] = Number(obj[key]);
        }
    }
    return obj;
}

export async function listarCategorias(): Promise<Categoria[]> {
    return restRequest<Categoria[]>("revisional_categorias?select=*&order=ordem.asc,nome.asc");
}

export async function criarCategoria(nome: string, cor: CategoriaCor = "gold", ordem = 10): Promise<Categoria> {
    const rows = await restRequest<Categoria[]>("revisional_categorias", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ nome: nome.trim(), cor, ordem }),
    });
    return rows[0];
}

export async function atualizarCategoria(
    id: string,
    patch: Partial<Pick<Categoria, "nome" | "cor" | "ordem">>,
): Promise<Categoria> {
    const rows = await restRequest<Categoria[]>(`revisional_categorias?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch),
    });
    return rows[0];
}

export async function excluirCategoria(id: string): Promise<void> {
    await restRequest<void>(`revisional_categorias?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}

export async function listarCalculos(): Promise<CalculoSalvo[]> {
    return restRequest<CalculoSalvo[]>("revisional_calculos?select=*&order=updated_at.desc");
}

export async function criarCalculo(payload: CalculoPayload): Promise<CalculoSalvo> {
    const rows = await restRequest<CalculoSalvo[]>("revisional_calculos", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
    });
    return rows[0];
}

export async function atualizarCalculo(id: string, payload: Partial<CalculoPayload>): Promise<CalculoSalvo> {
    const rows = await restRequest<CalculoSalvo[]>(`revisional_calculos?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
    });
    return rows[0];
}

export async function excluirCalculo(id: string): Promise<void> {
    await restRequest<void>(`revisional_calculos?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}
