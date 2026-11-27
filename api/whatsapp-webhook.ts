import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_URL } from "../src/lib/revisional-db.ts";
import { criarClienteAnthropic, resolverModeloResposta } from "../src/lib/atendimento/ia-atendimento.ts";
import { processarWebhookWhatsApp } from "../src/lib/atendimento/processar-whatsapp.ts";
import { lerModelosEscritorio } from "../src/lib/atendimento/contexto-cliente.ts";
import { chaveGemini } from "../src/lib/atendimento/ia-gemini.ts";
import { ehModeloGemini } from "../src/lib/atendimento/modelos.ts";
import { lerConfigWhatsApp, webhookAutentico, whatsappConfigurado, type ConfigWhatsApp } from "../src/lib/atendimento/whatsapp.ts";
import { timingSafeEqualStr } from "./_http.ts";

/**
 * Webhook do WhatsApp (YCloud ou Meta direto, conforme a configuração).
 *   GET  → verificação do endereço (hub.challenge), só usada ao cadastrar o webhook direto na Meta.
 *   POST → mensagens, respostas dadas pelo celular e status de entrega. Só aceita corpo assinado
 *          (YCloud-Signature com o segredo do webhook, ou X-Hub-Signature-256 com o App Secret da Meta).
 * Usa a service role do Supabase (não há usuário logado aqui). Nada é enviado ao cliente:
 * a IA só deixa um rascunho para o escritório aprovar.
 */

export interface WebhookRequest {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[] | undefined>;
    /** Corpo exatamente como chegou (a assinatura é calculada sobre ele). */
    corpoCru: string;
}

export interface WebhookResponse {
    status: (code: number) => WebhookResponse;
    setHeader?: (name: string, value: string) => void;
    json: (body: unknown) => unknown;
    send?: (body: string) => unknown;
}

const q = (query: WebhookRequest["query"], k: string) => {
    const v = query?.[k];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
};

export async function handleWhatsAppWebhook(
    request: WebhookRequest,
    response: WebhookResponse,
    options: {
        config?: ConfigWhatsApp;
        env?: Record<string, string | undefined>;
        fetchFn?: typeof fetch;
        anthropic?: Anthropic | null;
    } = {},
) {
    response.setHeader?.("Cache-Control", "no-store, max-age=0");
    const env = options.env ?? process.env;
    const config = options.config ?? lerConfigWhatsApp(env);

    if (request.method === "GET") {
        const desafio = q(request.query, "hub.challenge");
        if (
            q(request.query, "hub.mode") === "subscribe" &&
            config.verifyToken &&
            timingSafeEqualStr(q(request.query, "hub.verify_token"), config.verifyToken) &&
            /^[\w-]{1,200}$/.test(desafio)
        ) {
            response.setHeader?.("Content-Type", "text/plain; charset=utf-8");
            response.status(200);
            return response.send ? response.send(desafio) : response.json(desafio);
        }
        return response.status(403).json({ ok: false });
    }

    if (request.method !== "POST") return response.status(405).json({ ok: false, message: "Method not allowed" });

    if (!whatsappConfigurado(config)) {
        return response.status(503).json({ ok: false, message: "WhatsApp não configurado no servidor." });
    }
    if (!webhookAutentico(config, request.corpoCru, request.headers)) {
        return response.status(401).json({ ok: false, message: "Assinatura inválida." });
    }

    const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
    if (!serviceKey) {
        return response.status(503).json({ ok: false, message: "Configure SUPABASE_SERVICE_ROLE_KEY na Vercel." });
    }

    let corpo: unknown;
    try {
        corpo = JSON.parse(request.corpoCru);
    } catch {
        return response.status(400).json({ ok: false, message: "JSON inválido." });
    }

    // Sem chave da Anthropic o webhook ainda grava as mensagens; só não sai rascunho.
    let anthropic: Anthropic | null = options.anthropic ?? null;
    if (options.anthropic === undefined) {
        try {
            anthropic = criarClienteAnthropic({ fetchFn: options.fetchFn });
        } catch {
            anthropic = null;
        }
    }

    const acesso = {
        supabaseUrl: (env.VITE_SUPABASE_URL || SUPABASE_URL).replace(/\/+$/, ""),
        apiKey: serviceKey,
        bearer: serviceKey,
        fetchFn: options.fetchFn,
    };
    const modelo = resolverModeloResposta(env.ATENDIMENTO_MODEL, (await lerModelosEscritorio(acesso)).resposta);
    // Sem a chave do provedor do modelo escolhido, as mensagens são gravadas mas não sai rascunho.
    const iaDisponivel = ehModeloGemini(modelo) ? Boolean(chaveGemini(env)) : Boolean(anthropic);

    try {
        const resultado = await processarWebhookWhatsApp(corpo, {
            acesso,
            config,
            ia: iaDisponivel ? { anthropic, modelo, fetchFn: options.fetchFn } : null,
            fetchFn: options.fetchFn,
        });
        if (resultado.erros.length > 0) console.error("[whatsapp-webhook]", resultado.erros.join(" | "));
        return response.status(200).json({ ok: true, ...resultado, erros: resultado.erros.length });
    } catch (err) {
        // A mensagem não foi gravada: responder erro faz a Meta reenviar mais tarde.
        console.error("[whatsapp-webhook] falha ao gravar:", (err as Error).message);
        return response.status(500).json({ ok: false });
    }
}

async function lerCorpoCru(req: VercelRequest): Promise<string> {
    const pronto = (req as unknown as { rawBody?: unknown }).rawBody;
    if (typeof pronto === "string") return pronto;
    if (Buffer.isBuffer(pronto)) return pronto.toString("utf8");
    const partes: Buffer[] = [];
    for await (const parte of req as AsyncIterable<Buffer | string>) {
        partes.push(typeof parte === "string" ? Buffer.from(parte) : parte);
    }
    return Buffer.concat(partes).toString("utf8");
}

// A assinatura da Meta vale para o corpo cru: o parser automático de JSON fica desligado.
export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const corpoCru = req.method === "POST" ? await lerCorpoCru(req) : "";
    return handleWhatsAppWebhook(
        { method: req.method, headers: req.headers, query: req.query, corpoCru },
        res as unknown as WebhookResponse,
    );
}
