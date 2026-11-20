import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
    MCP_TOOLS,
    RevisionalServerDb,
    handleMcpJsonRpc,
    type JsonRpcRequest,
    type RevisionalDbAdapter,
} from "../src/lib/mcp/revisional-mcp-core.ts";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../src/lib/revisional-db.ts";
import type { ApiHttpRequest, ApiHttpResponse, OpcoesConfiancaApi } from "./claude-revisional.ts";
import {
    aplicarHeadersApiSeguros,
    getHeader,
    timingSafeEqualStr,
    verificarUsuarioAutorizado,
} from "./_http.ts";

const MAX_BATCH_ITEMS = 20;

async function autenticarMcp(
    request: ApiHttpRequest,
    options: OpcoesConfiancaApi & {
        db?: RevisionalDbAdapter;
        fetchFn?: typeof fetch;
    },
): Promise<{ ok: true; db: RevisionalDbAdapter } | { ok: false; message: string }> {
    if (options.db) return { ok: true, db: options.db };

    const expectedMcpToken = (process.env.MCP_AUTH_TOKEN || "").trim();
    const authHeader = getHeader(request.headers, "authorization");
    const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : "";
    // Aceita token apenas em headers (Authorization: Bearer ou x-mcp-token), nunca em query string (?token=).
    const providedMcpToken = getHeader(request.headers, "x-mcp-token").trim() || bearerToken;

    if (expectedMcpToken) {
        if (!timingSafeEqualStr(providedMcpToken, expectedMcpToken)) {
            return { ok: false, message: "Unauthorized MCP token" };
        }
        return { ok: true, db: new RevisionalServerDb({ fetchFn: options.fetchFn }) };
    }

    if (bearerToken) {
        const fetchFn = options.fetchFn ?? fetch;
        const supabaseUrl = process.env.VITE_SUPABASE_URL || SUPABASE_URL;
        const anonKey = process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
        const autorizado = await verificarUsuarioAutorizado(bearerToken, supabaseUrl, anonKey, fetchFn);
        if (!autorizado) {
            return { ok: false, message: "Unauthorized Bearer token" };
        }
        return {
            ok: true,
            db: new RevisionalServerDb({
                accessToken: bearerToken,
                fetchFn: options.fetchFn,
            }),
        };
    }

    if (options.conexaoLocalVerificada) {
        return { ok: true, db: new RevisionalServerDb({ fetchFn: options.fetchFn }) };
    }

    return {
        ok: false,
        message:
            "Autenticação obrigatória no endpoint MCP remoto. Configure MCP_AUTH_TOKEN na Vercel ou envie Authorization: Bearer <token>.",
    };
}

export async function handleMcpHttpRequest(
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    options: OpcoesConfiancaApi & {
        db?: RevisionalDbAdapter;
        fetchFn?: typeof fetch;
    } = {},
) {
    aplicarHeadersApiSeguros(
        request.headers,
        response,
        "GET, POST, OPTIONS",
        "Content-Type, Authorization, x-mcp-token",
    );

    if (request.method === "OPTIONS") {
        response.status(204);
        return response.end ? response.end() : response.json({});
    }

    if (request.method !== "GET" && request.method !== "POST") {
        return response.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const auth = await autenticarMcp(request, options);
    if (!auth.ok) {
        return response.status(401).json({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32001, message: auth.message },
        });
    }
    const db = auth.db;

    if (request.method === "GET") {
        return response.status(200).json({
            ok: true,
            name: "ian-granja-revisional-mcp",
            version: "1.0.0",
            protocol: "mcp-jsonrpc-2.0",
            tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
        });
    }

    let parsed: unknown = request.body;
    if (typeof parsed === "string") {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            return response.status(400).json({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32700, message: "Parse error: invalid JSON" },
            });
        }
    }

    if (!parsed || typeof parsed !== "object") {
        return response.status(400).json({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32600, message: "Invalid Request" },
        });
    }

    if (Array.isArray(parsed)) {
        if (parsed.length === 0 || parsed.length > MAX_BATCH_ITEMS) {
            return response.status(400).json({
                jsonrpc: "2.0",
                id: null,
                error: {
                    code: -32600,
                    message:
                        parsed.length === 0
                            ? "Invalid Request: empty batch"
                            : `Invalid Request: batch limit is ${MAX_BATCH_ITEMS} items`,
                },
            });
        }
        const results: unknown[] = [];
        for (const item of parsed) {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
                results.push({
                    jsonrpc: "2.0",
                    id: null,
                    error: { code: -32600, message: "Invalid Request" },
                });
                continue;
            }
            const r = await handleMcpJsonRpc(item as JsonRpcRequest, db);
            if (r !== null) results.push(r);
        }
        if (results.length === 0) {
            response.status(202);
            return response.end ? response.end() : response.json({});
        }
        return response.status(200).json(results);
    }

    const res = await handleMcpJsonRpc(parsed as JsonRpcRequest, db);
    if (res === null) {
        response.status(202);
        return response.end ? response.end() : response.json({});
    }
    return response.status(200).json(res);
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
    return handleMcpHttpRequest(request, response);
}
