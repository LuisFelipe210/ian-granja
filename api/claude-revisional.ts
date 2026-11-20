import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
    LIMITE_TOTAL_ANEXOS_BYTES,
    bytesDeBase64,
    executarExtracaoClaudeServer,
    type ClaudeArquivoAnexo,
    type ClaudeMimeType,
    type EstadoAtualCalculadora,
} from "../src/lib/juros/claude-revisional.ts";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../src/lib/revisional-db.ts";
import { aplicarHeadersApiSeguros, getHeader, verificarUsuarioAutorizado } from "./_http.ts";

const ALLOWED_MIMES = new Set<ClaudeMimeType>([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
]);

const MAX_COMANDO_CHARS = 8_000;
const MAX_ESTADO_ATUAL_BYTES = 120_000;

export interface ApiHttpRequest {
    method?: string;
    body?: unknown;
    headers: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[] | undefined>;
}

export interface ApiHttpResponse {
    status: (code: number) => ApiHttpResponse;
    setHeader?: (name: string, value: string) => void;
    json: (body: unknown) => unknown;
    end?: () => unknown;
}

/**
 * Opções de confiança dos handlers HTTP. `conexaoLocalVerificada` só deve ser `true` quando quem chama
 * conferiu o endereço remoto do socket (loopback) e a origem local, como faz o plugin de API do Vite em dev.
 */
export interface OpcoesConfiancaApi {
    conexaoLocalVerificada?: boolean;
}

export async function handleClaudeRevisionalRequest(
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    options: OpcoesConfiancaApi & {
        fetchFn?: typeof fetch;
        apiKey?: string;
        skipAuthCheck?: boolean;
    } = {},
) {
    aplicarHeadersApiSeguros(request.headers, response, "POST, OPTIONS", "Content-Type, Authorization");

    if (request.method === "OPTIONS") {
        response.status(204);
        return response.end ? response.end() : response.json({});
    }

    if (request.method !== "POST") {
        return response.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const fetchFn = options.fetchFn ?? fetch;

    if (!options.skipAuthCheck) {
        const authHeader = getHeader(request.headers, "authorization");
        const bearer = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : "";

        if (bearer) {
            const supabaseUrl = process.env.VITE_SUPABASE_URL || SUPABASE_URL;
            const anonKey = process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
            const valido = await verificarUsuarioAutorizado(bearer, supabaseUrl, anonKey, fetchFn);
            if (!valido) {
                return response.status(401).json({
                    ok: false,
                    message: "Sessão expirada ou não autorizada para usar o assistente.",
                });
            }
        } else if (!options.conexaoLocalVerificada) {
            return response.status(401).json({
                ok: false,
                message: "Faça login na Calculadora Revisional para usar o assistente Claude.",
            });
        }
    }

    let parsedBody: unknown = request.body;
    if (typeof parsedBody === "string") {
        try {
            parsedBody = JSON.parse(parsedBody);
        } catch {
            return response.status(400).json({ ok: false, message: "JSON inválido." });
        }
    }

    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
        return response.status(400).json({ ok: false, message: "Corpo da requisição inválido." });
    }

    const payload = parsedBody as {
        comando?: unknown;
        arquivos?: unknown;
        estadoAtual?: Partial<EstadoAtualCalculadora>;
        anthropicApiKey?: unknown;
        model?: unknown;
    };

    const comando = typeof payload.comando === "string" ? payload.comando.trim() : "";
    if (comando.length > MAX_COMANDO_CHARS) {
        return response.status(413).json({
            ok: false,
            message: `O comando excede o limite de ${MAX_COMANDO_CHARS} caracteres.`,
        });
    }

    if (payload.estadoAtual !== undefined) {
        try {
            if (JSON.stringify(payload.estadoAtual).length > MAX_ESTADO_ATUAL_BYTES) {
                return response.status(413).json({
                    ok: false,
                    message: "O contexto do caso atual excede o limite permitido.",
                });
            }
        } catch {
            return response.status(400).json({ ok: false, message: "Contexto do caso inválido." });
        }
    }

    const arquivosRaw = Array.isArray(payload.arquivos) ? payload.arquivos : [];

    if (arquivosRaw.length > 8) {
        return response.status(400).json({ ok: false, message: "Envie no máximo 8 arquivos por vez." });
    }

    const arquivos: ClaudeArquivoAnexo[] = [];
    for (const item of arquivosRaw) {
        if (!item || typeof item !== "object") continue;
        const arq = item as Record<string, unknown>;
        const mediaType = typeof arq.mediaType === "string" ? (arq.mediaType as ClaudeMimeType) : null;
        const base64 = typeof arq.base64 === "string" ? arq.base64.trim() : "";
        const nome = typeof arq.nome === "string" ? arq.nome.trim() : "documento";
        if (!mediaType || !ALLOWED_MIMES.has(mediaType) || !base64) {
            return response.status(400).json({
                ok: false,
                message: `Arquivo "${nome}" com formato não suportado. Use PDF, PNG, JPG, WEBP ou TXT.`,
            });
        }
        arquivos.push({ nome, mediaType, base64 });
    }

    // Mesmo limite da tela: na Vercel o corpo maior nem chegaria aqui; em dev isso mantém o
    // comportamento igual ao de produção.
    const totalAnexos = arquivos.reduce((soma, a) => soma + bytesDeBase64(a.base64), 0);
    if (totalAnexos > LIMITE_TOTAL_ANEXOS_BYTES) {
        return response.status(413).json({
            ok: false,
            message: `O total dos anexos passa de ${Math.round(LIMITE_TOTAL_ANEXOS_BYTES / (1024 * 1024))} MB. Comprima o PDF ou envie só as páginas do contrato.`,
        });
    }

    if (!comando && arquivos.length === 0) {
        return response.status(400).json({
            ok: false,
            message: "Anexe um contrato (PDF/foto) ou digite um comando para o Claude.",
        });
    }

    const clientApiKey = typeof payload.anthropicApiKey === "string" ? payload.anthropicApiKey.trim() : "";
    const apiKey = options.apiKey || clientApiKey || process.env.ANTHROPIC_API_KEY || "";
    const usandoChaveServidor = !clientApiKey;
    const rawModel = typeof payload.model === "string" && payload.model.trim() ? payload.model.trim() : undefined;
    // Evita que o cliente escale o custo para modelos Opus usando a ANTHROPIC_API_KEY do servidor.
    const model = usandoChaveServidor && rawModel?.includes("opus") ? undefined : rawModel;

    try {
        const result = await executarExtracaoClaudeServer({
            comando,
            arquivos,
            estadoAtual: payload.estadoAtual,
            apiKey,
            model,
            fetchFn,
        });
        return response.status(200).json({
            ok: true,
            ...result,
        });
    } catch (error) {
        console.error("[claude-revisional] Erro:", error);
        const rawMsg = error instanceof Error ? error.message : "";
        const statusCode = rawMsg.includes("ANTHROPIC_API_KEY") ? 400 : 500;
        const message =
            statusCode === 400
                ? rawMsg
                : rawMsg.startsWith("O Claude recusou") || rawMsg.startsWith("O documento")
                  ? rawMsg
                  : "Não foi possível processar o contrato com o assistente agora. Tente novamente.";
        return response.status(statusCode).json({ ok: false, message });
    }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
    return handleClaudeRevisionalRequest(request, response);
}
