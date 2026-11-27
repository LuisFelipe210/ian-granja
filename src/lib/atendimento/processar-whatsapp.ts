/**
 * Fluxo do atendimento pelo WhatsApp (somente servidor):
 *   mensagem chega → grava na conversa → se o número é de um cliente, a IA prepara um RASCUNHO com a
 *   base dele → o escritório é avisado (caixa de entrada sempre; WhatsApp pessoal para quem ligou).
 * O envio ao cliente só acontece por `enviarRespostaConversa`, chamado quando o advogado aprova.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { carregarContextoCliente, type AcessoSupabase } from "./contexto-cliente.ts";
import { responderMensagemCliente, type TurnoConversa } from "./ia-atendimento.ts";
import {
    chaveTelefone,
    dentroDaJanela,
    enviarTemplateWhatsApp,
    enviarTextoWhatsApp,
    ErroWhatsApp,
    lerWebhookWhatsApp,
    telefoneLegivel,
    type ConfigWhatsApp,
    type MensagemDoApp,
    type MensagemRecebida,
} from "./whatsapp.ts";

/* ------------------------------------------------------------------ Tipos das linhas */

export interface ConversaRow {
    id: string;
    telefone: string;
    nome_contato: string;
    cliente_id: string | null;
    status: "pendente" | "respondida" | "encerrada";
    ultima_mensagem_cliente_em: string | null;
    ultima_mensagem_em: string;
    ultima_mensagem_previa: string;
}

export interface MensagemRow {
    id: string;
    conversa_id: string;
    direcao: "entrada" | "saida";
    autor: "cliente" | "ia" | "advogado";
    tipo: "texto" | "midia";
    texto: string;
    status: "recebida" | "rascunho" | "enviada" | "falhou" | "descartada";
    wa_message_id: string | null;
    situacao_ia: "respondido" | "sem_informacao" | "encaminhar_advogado" | null;
    fontes: Array<{ id: string; titulo: string }>;
    motivo_interno: string;
    erro: string;
    created_at: string;
}

/* ------------------------------------------------------------------ PostgREST mínimo */

class ErroRest extends Error {
    readonly status: number;
    readonly codigo: string;
    constructor(message: string, status: number, codigo: string) {
        super(message);
        this.status = status;
        this.codigo = codigo;
    }
}

async function rest<T>(acesso: AcessoSupabase, caminho: string, init: RequestInit = {}): Promise<T> {
    const fetchFn = acesso.fetchFn ?? fetch;
    const res = await fetchFn(`${acesso.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${caminho}`, {
        ...init,
        signal: AbortSignal.timeout(8_000),
        headers: {
            apikey: acesso.apiKey,
            Authorization: `Bearer ${acesso.bearer}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
    });
    if (!res.ok) {
        const corpo = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
        if (corpo.code === "42P01" || corpo.code === "PGRST205") {
            throw new ErroRest("O atendimento pelo WhatsApp precisa da migração do banco (20261127130000).", res.status, corpo.code);
        }
        throw new ErroRest(`Falha no banco (${res.status}${corpo.message ? `: ${corpo.message}` : ""}).`, res.status, corpo.code ?? "");
    }
    if (res.status === 204) return undefined as T;
    const texto = await res.text();
    return (texto ? JSON.parse(texto) : undefined) as T;
}

const ret = { Prefer: "return=representation" };
const enc = encodeURIComponent;

export async function lerConversa(acesso: AcessoSupabase, id: string): Promise<ConversaRow | null> {
    const rows = await rest<ConversaRow[]>(acesso, `revisional_atendimento_conversas?select=*&id=eq.${enc(id)}&limit=1`);
    return rows[0] ?? null;
}

async function atualizarConversa(acesso: AcessoSupabase, id: string, patch: Partial<ConversaRow>): Promise<void> {
    await rest(acesso, `revisional_atendimento_conversas?id=eq.${enc(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
}

async function inserirMensagem(acesso: AcessoSupabase, linha: Partial<MensagemRow>): Promise<MensagemRow | null> {
    try {
        const rows = await rest<MensagemRow[]>(acesso, "revisional_atendimento_mensagens", {
            method: "POST",
            headers: ret,
            body: JSON.stringify(linha),
        });
        return rows[0] ?? null;
    } catch (err) {
        // wa_message_id repetido = a Meta reenviou o mesmo webhook: já foi processado.
        if (err instanceof ErroRest && err.codigo === "23505") return null;
        throw err;
    }
}

async function atualizarMensagem(acesso: AcessoSupabase, filtro: string, patch: Partial<MensagemRow>): Promise<MensagemRow[]> {
    return rest<MensagemRow[]>(acesso, `revisional_atendimento_mensagens?${filtro}`, {
        method: "PATCH",
        headers: ret,
        body: JSON.stringify(patch),
    });
}

/** Número do WhatsApp → cliente cadastrado (compara sem o nono dígito, ver `chaveTelefone`). */
export async function encontrarClientePorTelefone(acesso: AcessoSupabase, telefone: string): Promise<string | null> {
    const alvo = chaveTelefone(telefone);
    const clientes = await rest<Array<{ id: string; telefone: string }>>(
        acesso,
        "revisional_clientes?select=id,telefone&telefone=neq.&limit=5000",
    );
    const achados = clientes.filter((c) => c.telefone && chaveTelefone(c.telefone) === alvo);
    // Dois clientes com o mesmo número (ex.: casal): não dá para adivinhar, o escritório escolhe.
    return achados.length === 1 ? achados[0].id : null;
}

async function obterOuCriarConversa(
    acesso: AcessoSupabase,
    msg: MensagemRecebida,
): Promise<{ conversa: ConversaRow; estavaPendente: boolean }> {
    const buscar = async () =>
        (
            await rest<ConversaRow[]>(
                acesso,
                `revisional_atendimento_conversas?select=*&telefone=eq.${enc(msg.de)}&limit=1`,
            )
        )[0] ?? null;

    const previa = msg.texto.slice(0, 300);
    const existente = await buscar();
    if (existente) {
        const patch: Partial<ConversaRow> = {
            status: "pendente",
            ultima_mensagem_cliente_em: msg.recebidaEm,
            ultima_mensagem_em: msg.recebidaEm,
            ultima_mensagem_previa: previa,
            ...(msg.nomeContato && !existente.nome_contato ? { nome_contato: msg.nomeContato } : {}),
        };
        if (!existente.cliente_id) {
            const clienteId = await encontrarClientePorTelefone(acesso, msg.de);
            if (clienteId) patch.cliente_id = clienteId;
        }
        await atualizarConversa(acesso, existente.id, patch);
        return { conversa: { ...existente, ...patch }, estavaPendente: existente.status === "pendente" };
    }

    const clienteId = await encontrarClientePorTelefone(acesso, msg.de);
    try {
        const rows = await rest<ConversaRow[]>(acesso, "revisional_atendimento_conversas", {
            method: "POST",
            headers: ret,
            body: JSON.stringify({
                telefone: msg.de,
                nome_contato: msg.nomeContato,
                cliente_id: clienteId,
                status: "pendente",
                ultima_mensagem_cliente_em: msg.recebidaEm,
                ultima_mensagem_em: msg.recebidaEm,
                ultima_mensagem_previa: previa,
            }),
        });
        return { conversa: rows[0], estavaPendente: false };
    } catch (err) {
        // Duas mensagens do mesmo número ao mesmo tempo: a outra criou a conversa primeiro.
        if (err instanceof ErroRest && err.codigo === "23505") {
            const criada = await buscar();
            if (criada) return { conversa: criada, estavaPendente: true };
        }
        throw err;
    }
}

/* ------------------------------------------------------------------ Rascunho da IA */

/** Histórico para a IA: só o que o cliente mandou e o que de fato foi enviado a ele. */
export function historicoParaIa(mensagens: MensagemRow[]): TurnoConversa[] {
    return mensagens
        .filter((m) => (m.direcao === "entrada" && m.status === "recebida") || (m.direcao === "saida" && m.status === "enviada"))
        .map((m) => ({ autor: m.direcao === "entrada" ? ("cliente" as const) : ("atendimento" as const), texto: m.texto }));
}

export interface DepsIa {
    /** Nulo quando o modelo escolhido é Gemini e não há chave da Anthropic. */
    anthropic: Anthropic | null;
    fetchFn?: typeof fetch;
    modelo: string;
}

/**
 * Gera (ou refaz) o rascunho de resposta à última mensagem do cliente. Rascunhos anteriores da conversa
 * ainda não enviados são descartados: o novo já considera a conversa inteira.
 */
export async function gerarRascunhoConversa(
    acesso: AcessoSupabase,
    conversa: ConversaRow,
    ia: DepsIa,
): Promise<MensagemRow | null> {
    if (!conversa.cliente_id) return null;
    const mensagens = await rest<MensagemRow[]>(
        acesso,
        `revisional_atendimento_mensagens?select=*&conversa_id=eq.${enc(conversa.id)}&order=created_at.asc&limit=200`,
    );
    const ultimaIdx = mensagens.map((m) => m.direcao).lastIndexOf("entrada");
    if (ultimaIdx < 0) return null;
    const ultima = mensagens[ultimaIdx];

    await atualizarMensagem(acesso, `conversa_id=eq.${enc(conversa.id)}&status=eq.rascunho`, { status: "descartada" });

    if (ultima.tipo === "midia") {
        return inserirMensagem(acesso, {
            conversa_id: conversa.id,
            direcao: "saida",
            autor: "ia",
            texto: "",
            status: "rascunho",
            situacao_ia: "encaminhar_advogado",
            motivo_interno: `O cliente mandou ${ultima.texto.split(" ")[0]}: a IA não lê mídia, responda manualmente.`,
        });
    }

    const contexto = await carregarContextoCliente(conversa.cliente_id, acesso);
    const resposta = await responderMensagemCliente({
        contexto,
        historico: historicoParaIa(mensagens.slice(0, ultimaIdx)),
        mensagem: ultima.texto,
        client: ia.anthropic,
        fetchFn: ia.fetchFn,
        modelo: ia.modelo,
    });
    return inserirMensagem(acesso, {
        conversa_id: conversa.id,
        direcao: "saida",
        autor: "ia",
        texto: resposta.mensagem,
        status: "rascunho",
        situacao_ia: resposta.situacao,
        fontes: resposta.fontes.map((f) => ({ id: f.id, titulo: f.titulo })),
        motivo_interno: resposta.motivoInterno.slice(0, 1000),
    });
}

/* ------------------------------------------------------------------ Aviso ao advogado */

async function avisarAdvogados(
    acesso: AcessoSupabase,
    config: ConfigWhatsApp,
    conversa: ConversaRow,
    nomeCliente: string,
    previa: string,
    fetchFn?: typeof fetch,
): Promise<number> {
    if (!config.templateAviso) return 0;
    const avisos = await rest<Array<{ telefone: string }>>(
        acesso,
        "revisional_atendimento_avisos?select=telefone&avisar_whatsapp=is.true",
    );
    const quem = nomeCliente || conversa.nome_contato || telefoneLegivel(conversa.telefone);
    let enviados = 0;
    for (const a of avisos) {
        // Não avisa o advogado sobre a própria mensagem (ex.: testando o número do escritório).
        if (!a.telefone || chaveTelefone(a.telefone) === chaveTelefone(conversa.telefone)) continue;
        try {
            await enviarTemplateWhatsApp({ config, para: a.telefone, parametros: [quem, previa], fetchFn });
            enviados++;
        } catch {
            // Aviso é melhor-esforço: a conversa já está na caixa de entrada do sistema.
        }
    }
    return enviados;
}

/* ------------------------------------------------------------------ Webhook */

/**
 * Coexistência: o escritório respondeu pelo celular. A resposta entra na conversa, o rascunho da IA
 * (se havia) é descartado e a pendência fecha — ninguém responde duas vezes.
 */
async function registrarMensagemDoApp(acesso: AcessoSupabase, eco: MensagemDoApp): Promise<boolean> {
    let conversa =
        (
            await rest<ConversaRow[]>(acesso, `revisional_atendimento_conversas?select=*&telefone=eq.${enc(eco.para)}&limit=1`)
        )[0] ?? null;
    const previa = eco.texto.slice(0, 300);
    if (!conversa) {
        // Conversa começada pelo escritório no celular: cria para o histórico ficar completo.
        const clienteId = await encontrarClientePorTelefone(acesso, eco.para);
        try {
            conversa =
                (
                    await rest<ConversaRow[]>(acesso, "revisional_atendimento_conversas", {
                        method: "POST",
                        headers: ret,
                        body: JSON.stringify({
                            telefone: eco.para,
                            cliente_id: clienteId,
                            status: "respondida",
                            ultima_mensagem_em: eco.enviadaEm,
                            ultima_mensagem_previa: previa,
                        }),
                    })
                )[0] ?? null;
        } catch (err) {
            if (!(err instanceof ErroRest && err.codigo === "23505")) throw err;
            conversa =
                (
                    await rest<ConversaRow[]>(
                        acesso,
                        `revisional_atendimento_conversas?select=*&telefone=eq.${enc(eco.para)}&limit=1`,
                    )
                )[0] ?? null;
        }
        if (!conversa) return false;
    }

    const gravada = await inserirMensagem(acesso, {
        conversa_id: conversa.id,
        direcao: "saida",
        autor: "advogado",
        tipo: eco.tipo,
        texto: eco.texto,
        status: "enviada",
        wa_message_id: eco.waMessageId,
        motivo_interno: "Enviada pelo app WhatsApp Business do celular.",
    });
    if (!gravada) return false;
    await atualizarMensagem(acesso, `conversa_id=eq.${enc(conversa.id)}&status=eq.rascunho`, { status: "descartada" });
    await atualizarConversa(acesso, conversa.id, {
        status: "respondida",
        ultima_mensagem_em: eco.enviadaEm,
        ultima_mensagem_previa: previa,
    });
    return true;
}

export interface ResultadoWebhook {
    recebidas: number;
    /** Respostas que o escritório mandou pelo celular (coexistência). */
    pelocelular: number;
    duplicadas: number;
    rascunhos: number;
    avisos: number;
    erros: string[];
}

export async function processarWebhookWhatsApp(
    corpo: unknown,
    deps: { acesso: AcessoSupabase; config: ConfigWhatsApp; ia: DepsIa | null; fetchFn?: typeof fetch },
): Promise<ResultadoWebhook> {
    const { acesso, config } = deps;
    const { mensagens, status, ecos } = lerWebhookWhatsApp(corpo);
    const r: ResultadoWebhook = { recebidas: 0, pelocelular: 0, duplicadas: 0, rascunhos: 0, avisos: 0, erros: [] };

    // 1) Grava tudo primeiro (se algo falhar aqui, o webhook responde erro e a Meta reenvia).
    const novasPorConversa = new Map<string, { conversa: ConversaRow; ultima: MensagemRecebida; estavaPendente: boolean }>();
    for (const msg of mensagens) {
        const { conversa, estavaPendente } = await obterOuCriarConversa(acesso, msg);
        const gravada = await inserirMensagem(acesso, {
            conversa_id: conversa.id,
            direcao: "entrada",
            autor: "cliente",
            tipo: msg.tipo,
            texto: msg.texto,
            status: "recebida",
            wa_message_id: msg.waMessageId,
        });
        if (!gravada) {
            r.duplicadas++;
            continue;
        }
        r.recebidas++;
        const anterior = novasPorConversa.get(conversa.id);
        novasPorConversa.set(conversa.id, {
            conversa,
            ultima: msg,
            estavaPendente: anterior ? anterior.estavaPendente : estavaPendente,
        });
    }

    // 1b) Respostas dadas pelo celular (coexistência).
    for (const eco of ecos) {
        if (await registrarMensagemDoApp(acesso, eco)) r.pelocelular++;
        else r.duplicadas++;
    }

    // 2) Falha no envio informada pela Meta (ex.: número sem WhatsApp).
    for (const s of status) {
        if (s.status !== "failed" || s.ids.length === 0) continue;
        try {
            await atualizarMensagem(acesso, `wa_message_id=in.(${s.ids.map((id) => `"${id.replace(/"/g, "")}"`).join(",")})`, {
                status: "falhou",
                erro: s.erro || "O WhatsApp não entregou a mensagem.",
            });
        } catch (err) {
            r.erros.push((err as Error).message);
        }
    }

    // 3) Rascunho da IA (um por conversa, para a última mensagem) e aviso ao advogado.
    for (const { conversa, ultima, estavaPendente } of novasPorConversa.values()) {
        let nomeCliente = "";
        if (conversa.cliente_id && deps.ia) {
            try {
                const rascunho = await gerarRascunhoConversa(acesso, conversa, deps.ia);
                if (rascunho) r.rascunhos++;
            } catch (err) {
                r.erros.push(`Rascunho: ${(err as Error).message}`);
            }
        }
        if (conversa.cliente_id) {
            try {
                const rows = await rest<Array<{ nome: string }>>(
                    acesso,
                    `revisional_clientes?select=nome&id=eq.${enc(conversa.cliente_id)}&limit=1`,
                );
                nomeCliente = rows[0]?.nome ?? "";
            } catch {
                nomeCliente = "";
            }
        }
        // Avisa uma vez por pendência: se a conversa já estava esperando, o advogado já foi avisado.
        if (!estavaPendente) {
            try {
                r.avisos += await avisarAdvogados(acesso, config, conversa, nomeCliente, ultima.texto, deps.fetchFn);
            } catch (err) {
                r.erros.push(`Aviso: ${(err as Error).message}`);
            }
        }
    }
    return r;
}

/* ------------------------------------------------------------------ Envio aprovado pelo advogado */

export async function enviarRespostaConversa(opts: {
    acesso: AcessoSupabase;
    config: ConfigWhatsApp;
    conversaId: string;
    texto: string;
    rascunhoId?: string;
    fetchFn?: typeof fetch;
    agora?: number;
}): Promise<MensagemRow> {
    const texto = opts.texto.trim();
    if (!texto) throw new ErroWhatsApp("Escreva a resposta antes de enviar.");
    if (texto.length > 4096) throw new ErroWhatsApp("Resposta longa demais para o WhatsApp (máx. 4096 caracteres).");

    const conversa = await lerConversa(opts.acesso, opts.conversaId);
    if (!conversa) throw new ErroWhatsApp("Conversa não encontrada.");
    if (!dentroDaJanela(conversa.ultima_mensagem_cliente_em, opts.agora)) {
        throw new ErroWhatsApp(
            "Passaram mais de 24h desde a última mensagem do cliente: o WhatsApp só deixa responder depois que ele escrever de novo.",
        );
    }

    let rascunho: MensagemRow | null = null;
    if (opts.rascunhoId) {
        const rows = await rest<MensagemRow[]>(
            opts.acesso,
            `revisional_atendimento_mensagens?select=*&id=eq.${enc(opts.rascunhoId)}&conversa_id=eq.${enc(conversa.id)}&limit=1`,
        );
        rascunho = rows[0] ?? null;
        if (!rascunho || rascunho.status !== "rascunho") {
            throw new ErroWhatsApp("Este rascunho já foi enviado ou descartado. Atualize a conversa.");
        }
    }

    const waId = await enviarTextoWhatsApp({ config: opts.config, para: conversa.telefone, texto, fetchFn: opts.fetchFn });
    // Se o advogado mexeu no texto da IA, a resposta passa a ser dele.
    const autor = rascunho && rascunho.texto.trim() === texto ? "ia" : "advogado";

    let enviada: MensagemRow | null;
    if (rascunho) {
        enviada =
            (
                await atualizarMensagem(opts.acesso, `id=eq.${enc(rascunho.id)}`, {
                    texto,
                    autor,
                    status: "enviada",
                    wa_message_id: waId,
                })
            )[0] ?? null;
    } else {
        enviada = await inserirMensagem(opts.acesso, {
            conversa_id: conversa.id,
            direcao: "saida",
            autor: "advogado",
            texto,
            status: "enviada",
            wa_message_id: waId,
        });
    }
    await atualizarMensagem(opts.acesso, `conversa_id=eq.${enc(conversa.id)}&status=eq.rascunho`, { status: "descartada" });
    await atualizarConversa(opts.acesso, conversa.id, {
        status: "respondida",
        ultima_mensagem_em: new Date(opts.agora ?? Date.now()).toISOString(),
        ultima_mensagem_previa: texto.slice(0, 300),
    });
    if (!enviada) throw new ErroWhatsApp("A mensagem foi enviada, mas não consegui registrar no sistema. Atualize a conversa.");
    return enviada;
}
