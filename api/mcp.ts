import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
    MCP_TOOLS,
    RevisionalServerDb,
    handleMcpJsonRpc,
    type JsonRpcRequest,
    type RevisionalDbAdapter,
} from "../src/lib/mcp/revisional-mcp-core.ts";
import type { ApiHttpRequest, ApiHttpResponse, OpcoesConfiancaApi } from "./claude-revisional.ts";

function getHeader(headers: Record<string, string | string[] | undefined>, name: string): string {
    const val = headers[name.toLowerCase()] ?? headers[name];
    if (Array.isArray(val)) return val[0] ?? "";
    return val ?? "";
}

function getQueryParam(query: Record<string, string | string[] | undefined> | undefined, name: string): string {
    if (!query) return "";
    const val = query[name];
    if (Array.isArray(val)) return val[0] ?? "";
    return val ?? "";
}

export async function handleMcpHttpRequest(
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    options: OpcoesConfiancaApi & {
        db?: RevisionalDbAdapter;
        fetchFn?: typeof fetch;
    } = {},
) {
    response.setHeader?.("Access-Control-Allow-Origin", "*");
    response.setHeader?.("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader?.(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, x-mcp-token, x-revisional-email, x-revisional-password",
    );

    if (request.method === "OPTIONS") {
        response.status(204);
        return response.end ? response.end() : response.json({});
    }

    if (request.method === "GET") {
        return response.status(200).json({
            ok: true,
            name: "ian-granja-revisional-mcp",
            version: "1.0.0",
            protocol: "mcp-jsonrpc-2.0",
            tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
        });
    }

    if (request.method !== "POST") {
        return response.status(405).json({ ok: false, message: "Method not allowed" });
    }

    let db: RevisionalDbAdapter | undefined = options.db;
    if (!db) {
        const expectedMcpToken = (process.env.MCP_AUTH_TOKEN || "").trim();
        const authHeader = getHeader(request.headers, "authorization");
        const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : "";
        const providedMcpToken =
            getHeader(request.headers, "x-mcp-token").trim() ||
            getQueryParam(request.query, "token").trim() ||
            bearerToken;

        if (expectedMcpToken) {
            if (providedMcpToken !== expectedMcpToken) {
                return response.status(401).json({
                    jsonrpc: "2.0",
                    id: null,
                    error: { code: -32001, message: "Unauthorized MCP token" },
                });
            }
            db = new RevisionalServerDb({ fetchFn: options.fetchFn });
        } else if (bearerToken) {
            db = new RevisionalServerDb({
                accessToken: bearerToken,
                fetchFn: options.fetchFn,
            });
        } else if (
            getHeader(request.headers, "x-revisional-email") &&
            getHeader(request.headers, "x-revisional-password")
        ) {
            db = new RevisionalServerDb({
                email: getHeader(request.headers, "x-revisional-email").trim(),
                password: getHeader(request.headers, "x-revisional-password"),
                fetchFn: options.fetchFn,
            });
        } else if (options.conexaoLocalVerificada) {
            db = new RevisionalServerDb({ fetchFn: options.fetchFn });
        } else {
            return response.status(401).json({
                jsonrpc: "2.0",
                id: null,
                error: {
                    code: -32001,
                    message:
                        "Autenticação obrigatória no endpoint MCP remoto. Configure MCP_AUTH_TOKEN na Vercel ou envie Authorization: Bearer <token>.",
                },
            });
        }
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
        const results = (
            await Promise.all((parsed as JsonRpcRequest[]).map((item) => handleMcpJsonRpc(item, db!)))
        ).filter((r) => r !== null);
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
