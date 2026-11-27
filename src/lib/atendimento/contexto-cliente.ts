/**
 * Carrega, no servidor, as fontes de UM cliente direto do Supabase (PostgREST).
 * O isolamento é feito aqui, em código: todas as consultas filtram pelo `clienteId` recebido, então a IA
 * nunca recebe dados de outro cliente — nem por erro dela, nem por pedido malicioso na mensagem.
 */
import {
    montarFontesCliente,
    normalizarItemConhecimento,
    type CasoParaAtendimento,
    type ContextoAtendimento,
} from "./base-conhecimento.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function idClienteValido(id: unknown): id is string {
    return typeof id === "string" && UUID_RE.test(id);
}

export interface AcessoSupabase {
    supabaseUrl: string;
    /** anon key (com o token do usuário) ou, na Fase 2, a service role do webhook. */
    apiKey: string;
    bearer: string;
    fetchFn?: typeof fetch;
}

async function lerTabela<T>(acesso: AcessoSupabase, caminho: string): Promise<T[]> {
    const fetchFn = acesso.fetchFn ?? fetch;
    const res = await fetchFn(`${acesso.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${caminho}`, {
        signal: AbortSignal.timeout(8_000),
        headers: { apikey: acesso.apiKey, Authorization: `Bearer ${acesso.bearer}`, Accept: "application/json" },
    });
    if (!res.ok) {
        const corpo = (await res.json().catch(() => ({}))) as { code?: string };
        if (corpo.code === "42P01" || corpo.code === "PGRST205") {
            throw new Error("A base do atendimento precisa da migração do banco (20261122120000).");
        }
        throw new Error(`Falha ao ler os dados do cliente (${res.status}).`);
    }
    return (await res.json()) as T[];
}

/**
 * Modelos de IA escolhidos no site (tela Configurações). Se a migração ainda não rodou ou a leitura
 * falhar, devolve vazio e o servidor usa a variável de ambiente ou o padrão — o atendimento não para.
 */
export async function lerModelosEscritorio(acesso: AcessoSupabase): Promise<{ resposta: string; extracao: string }> {
    try {
        const rows = await lerTabela<{ atendimento_modelo_resposta?: string; atendimento_modelo_extracao?: string }>(
            acesso,
            "revisional_configuracoes?select=atendimento_modelo_resposta,atendimento_modelo_extracao&id=eq.escritorio&limit=1",
        );
        return {
            resposta: rows[0]?.atendimento_modelo_resposta ?? "",
            extracao: rows[0]?.atendimento_modelo_extracao ?? "",
        };
    } catch {
        return { resposta: "", extracao: "" };
    }
}

const num = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};

export async function carregarContextoCliente(idRecebido: string, acesso: AcessoSupabase): Promise<ContextoAtendimento> {
    if (!idClienteValido(idRecebido)) throw new Error("Cliente inválido.");
    // O PostgREST devolve UUIDs em minúsculas; comparar com o id como veio (maiúsculas) recusaria o cliente.
    const clienteId = idRecebido.toLowerCase();
    const id = encodeURIComponent(clienteId);

    const [clientes, casos, fases, itens] = await Promise.all([
        lerTabela<{ id: string; nome: string }>(acesso, `revisional_clientes?select=id,nome&id=eq.${id}&limit=1`),
        lerTabela<Record<string, unknown>>(
            acesso,
            `revisional_calculos?select=processo_global,banco,modalidade_nome,categoria_id,valor_financiado,valor_parcela,parcelas,updated_at&cliente_id=eq.${id}&order=updated_at.desc&limit=20`,
        ),
        lerTabela<{ id: string; nome: string }>(acesso, "revisional_categorias?select=id,nome"),
        lerTabela<Record<string, unknown>>(
            acesso,
            `revisional_cliente_conhecimento?select=*&cliente_id=eq.${id}&visivel_cliente=is.true&order=created_at.asc&limit=200`,
        ),
    ]);

    const cliente = clientes[0];
    if (!cliente || cliente.id !== clienteId) throw new Error("Cliente não encontrado.");
    const nomeFase = new Map(fases.map((f) => [f.id, f.nome]));

    const casosAtendimento: CasoParaAtendimento[] = casos.map((c) => ({
        processo_global: typeof c.processo_global === "string" ? c.processo_global : "",
        banco: typeof c.banco === "string" ? c.banco : "",
        modalidade_nome: typeof c.modalidade_nome === "string" ? c.modalidade_nome : "",
        fase: typeof c.categoria_id === "string" ? (nomeFase.get(c.categoria_id) ?? "") : "",
        valor_financiado: num(c.valor_financiado),
        valor_parcela: num(c.valor_parcela),
        parcelas: num(c.parcelas),
        atualizado_em: typeof c.updated_at === "string" ? c.updated_at : "",
    }));

    return montarFontesCliente({
        clienteId,
        nomeCliente: cliente.nome,
        casos: casosAtendimento,
        // Segunda trava: mesmo que a consulta voltasse algo de outro cliente, montarFontesCliente descarta.
        itens: itens.map(normalizarItemConhecimento),
    });
}
