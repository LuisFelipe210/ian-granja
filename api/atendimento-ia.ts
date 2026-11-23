import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../src/lib/revisional-db.ts";
import { LIMITE_TOTAL_ANEXOS_BYTES, bytesDeBase64 } from "../src/lib/juros/claude-revisional.ts";
import { carregarContextoCliente, idClienteValido } from "../src/lib/atendimento/contexto-cliente.ts";
import {
    MAX_MENSAGEM_CLIENTE,
    criarClienteAnthropic,
    extrairDocumentoCliente,
    resolverModeloAtendimento,
    responderMensagemCliente,
    type MidiaDocumento,
    type TurnoConversa,
} from "../src/lib/atendimento/ia-atendimento.ts";
import { aplicarHeadersApiSeguros, getHeader, verificarUsuarioAutorizado } from "./_http.ts";
import type { ApiHttpRequest, ApiHttpResponse } from "./claude-revisional.ts";

/**
 * Atendimento por IA — Fase 1 (uso interno, pelo sistema):
 *   { acao: "extrair_documento", arquivo: { nome, mediaType, base64 } }  → resumo + fatos para revisar
 *   { acao: "simular_resposta", clienteId, mensagem, historico? }        → resposta como o cliente veria
 * Só para usuários logados e autorizados do escritório.
 */

const MIDIAS = new Set<MidiaDocumento>(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function handleAtendimentoIaRequest(
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    options: { fetchFn?: typeof fetch; anthropic?: Anthropic } = {},
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
    const modelo = resolverModeloAtendimento(process.env.ATENDIMENTO_MODEL);

    let anthropic: Anthropic;
    try {
        anthropic = options.anthropic ?? criarClienteAnthropic({ fetchFn: options.fetchFn });
    } catch (err) {
        return response.status(503).json({ ok: false, message: (err as Error).message });
    }

    try {
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
            const extracao = await extrairDocumentoCliente({ base64, mediaType, nomeArquivo: nome, client: anthropic, modelo });
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

            const contexto = await carregarContextoCliente(payload.clienteId, {
                supabaseUrl,
                apiKey: anonKey,
                bearer,
                fetchFn,
            });
            const resposta = await responderMensagemCliente({ contexto, historico, mensagem, client: anthropic, modelo });
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
