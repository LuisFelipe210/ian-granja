import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../src/lib/revisional-db.ts";
import { LIMITE_TOTAL_ANEXOS_BYTES, bytesDeBase64 } from "../src/lib/juros/claude-revisional.ts";
import { carregarContextoCliente, idClienteValido, lerModelosEscritorio } from "../src/lib/atendimento/contexto-cliente.ts";
import {
    MAX_MENSAGEM_CLIENTE,
    criarClienteAnthropic,
    extrairDocumentoCliente,
    resolverModeloExtracao,
    resolverModeloResposta,
    responderMensagemCliente,
    type MidiaDocumento,
    type TurnoConversa,
} from "../src/lib/atendimento/ia-atendimento.ts";
import { enviarRespostaConversa, gerarRascunhoConversa, lerConversa } from "../src/lib/atendimento/processar-whatsapp.ts";
import { ErroWhatsApp, lerConfigWhatsApp, whatsappConfigurado, type ConfigWhatsApp } from "../src/lib/atendimento/whatsapp.ts";
import { aplicarHeadersApiSeguros, getHeader, verificarUsuarioAutorizado } from "./_http.ts";
import type { ApiHttpRequest, ApiHttpResponse } from "./claude-revisional.ts";

/**
 * Atendimento por IA — Fase 1 (uso interno, pelo sistema):
 *   { acao: "extrair_documento", arquivo: { nome, mediaType, base64 } }  → resumo + fatos para revisar
 *   { acao: "simular_resposta", clienteId, mensagem, historico? }        → resposta como o cliente veria
 * Fase 2 (WhatsApp, o advogado aprova cada envio):
 *   { acao: "status_whatsapp" }                                          → o servidor está configurado?
 *   { acao: "gerar_rascunho", conversaId }                               → (re)faz o rascunho da IA
 *   { acao: "enviar_resposta", conversaId, texto, rascunhoId? }          → envia ao cliente pelo WhatsApp
 * Só para usuários logados e autorizados do escritório.
 */

const MIDIAS = new Set<MidiaDocumento>(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function handleAtendimentoIaRequest(
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    options: { fetchFn?: typeof fetch; anthropic?: Anthropic; whatsapp?: ConfigWhatsApp } = {},
) {
    aplicarHeadersApiSeguros(request.headers, response, "POST, OPTIONS", "Content-Type, Authorization");
    if (request.method === "OPTIONS") {
        response.status(204);
        return response.end ? response.end() : response.json({});
    }
    if (request.method !== "POST") return response.status(405).json({ ok: false, message: "Method not allowed" });

    const fetchFn = options.fetchFn ?? fetch;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

    const auth = getHeader(request.headers, "authorization");
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!bearer || !(await verificarUsuarioAutorizado(bearer, supabaseUrl, anonKey, fetchFn))) {
        return response.status(401).json({ ok: false, message: "Entre no sistema para usar o atendimento por IA." });
    }

    let body: unknown = request.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch {
            return response.status(400).json({ ok: false, message: "JSON inválido." });
        }
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return response.status(400).json({ ok: false, message: "Corpo da requisição inválido." });
    }
    const payload = body as Record<string, unknown>;

    const acesso = { supabaseUrl, apiKey: anonKey, bearer, fetchFn };
    const whatsapp = options.whatsapp ?? lerConfigWhatsApp();
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const conversaId = typeof payload.conversaId === "string" && UUID_RE.test(payload.conversaId) ? payload.conversaId : "";

    try {
        // Ações que não chamam a IA.
        if (payload.acao === "status_whatsapp") {
            return response.status(200).json({
                ok: true,
                configurado: whatsappConfigurado(whatsapp),
                avisoPorWhatsApp: Boolean(whatsapp.templateAviso),
            });
        }
        if (payload.acao === "enviar_resposta") {
            if (!whatsappConfigurado(whatsapp)) {
                return response.status(503).json({ ok: false, message: "O WhatsApp ainda não foi configurado no servidor." });
            }
            if (!conversaId) return response.status(400).json({ ok: false, message: "Conversa inválida." });
            const texto = typeof payload.texto === "string" ? payload.texto : "";
            const rascunhoId =
                typeof payload.rascunhoId === "string" && UUID_RE.test(payload.rascunhoId) ? payload.rascunhoId : undefined;
            const mensagem = await enviarRespostaConversa({ acesso, config: whatsapp, conversaId, texto, rascunhoId, fetchFn });
            return response.status(200).json({ ok: true, mensagem });
        }
    } catch (err) {
        const status = err instanceof ErroWhatsApp ? 422 : 502;
        return response.status(status).json({ ok: false, message: (err as Error).message || "Falha no atendimento." });
    }

    // Sem chave da Anthropic ainda dá para usar os modelos Gemini (testes); o erro claro vem na hora de
    // chamar um modelo Claude.
    let anthropic: Anthropic | null = options.anthropic ?? null;
    if (!anthropic) {
        try {
            anthropic = criarClienteAnthropic({ fetchFn: options.fetchFn });
        } catch {
            anthropic = null;
        }
    }

    const doSite = await lerModelosEscritorio(acesso);
    const modelo = resolverModeloResposta(process.env.ATENDIMENTO_MODEL, doSite.resposta);
    const modeloExtracao = resolverModeloExtracao(process.env.ATENDIMENTO_MODEL_EXTRACAO, doSite.extracao);

    try {
        if (payload.acao === "gerar_rascunho") {
            if (!conversaId) return response.status(400).json({ ok: false, message: "Conversa inválida." });
            const conversa = await lerConversa(acesso, conversaId);
            if (!conversa) return response.status(404).json({ ok: false, message: "Conversa não encontrada." });
            if (!conversa.cliente_id) {
                return response.status(400).json({ ok: false, message: "Ligue a conversa a um cliente antes de pedir o rascunho." });
            }
            const rascunho = await gerarRascunhoConversa(acesso, conversa, { anthropic, modelo, fetchFn: options.fetchFn });
            return response.status(200).json({ ok: true, rascunho });
        }

        if (payload.acao === "extrair_documento") {
            const arq = (payload.arquivo ?? {}) as Record<string, unknown>;
            const mediaType = arq.mediaType as MidiaDocumento;
            const base64 = typeof arq.base64 === "string" ? arq.base64.replace(/\s+/g, "") : "";
            const nome = typeof arq.nome === "string" ? arq.nome.slice(0, 255) : "documento";
            if (!MIDIAS.has(mediaType)) {
                return response.status(400).json({ ok: false, message: "Envie um PDF ou uma foto (JPG, PNG ou WEBP)." });
            }
            if (!base64 || !/^[A-Za-z0-9+/]+=*$/.test(base64)) {
                return response.status(400).json({ ok: false, message: "Arquivo inválido." });
            }
            if (bytesDeBase64(base64) > LIMITE_TOTAL_ANEXOS_BYTES) {
                return response.status(413).json({ ok: false, message: "Arquivo acima de 3 MB. Envie um PDF menor." });
            }
            const extracao = await extrairDocumentoCliente({ base64, mediaType, nomeArquivo: nome, client: anthropic, modelo: modeloExtracao, fetchFn: options.fetchFn });
            return response.status(200).json({ ok: true, extracao });
        }

        if (payload.acao === "simular_resposta") {
            if (!idClienteValido(payload.clienteId)) {
                return response.status(400).json({ ok: false, message: "Cliente inválido." });
            }
            const mensagem = typeof payload.mensagem === "string" ? payload.mensagem.trim() : "";
            if (!mensagem) return response.status(400).json({ ok: false, message: "Escreva a mensagem do cliente." });
            if (mensagem.length > MAX_MENSAGEM_CLIENTE) {
                return response.status(413).json({ ok: false, message: "Mensagem longa demais." });
            }
            const historico: TurnoConversa[] = (Array.isArray(payload.historico) ? payload.historico : [])
                .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === "object")
                .map((t) => ({
                    autor: t.autor === "atendimento" ? ("atendimento" as const) : ("cliente" as const),
                    texto: typeof t.texto === "string" ? t.texto : "",
                }));

            const contexto = await carregarContextoCliente(payload.clienteId, acesso);
            const resposta = await responderMensagemCliente({
                contexto,
                historico,
                mensagem,
                client: anthropic,
                modelo,
                fetchFn: options.fetchFn,
            });
            return response.status(200).json({ ok: true, resposta, totalFontes: contexto.fontes.length });
        }

        return response.status(400).json({ ok: false, message: "Ação desconhecida." });
    } catch (err) {
        return response.status(502).json({ ok: false, message: (err as Error).message || "Falha no atendimento." });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    return handleAtendimentoIaRequest(req as unknown as ApiHttpRequest, res as unknown as ApiHttpResponse);
}
