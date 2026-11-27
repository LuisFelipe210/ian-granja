import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../src/lib/revisional-db.ts";
import { getHeader, timingSafeEqualStr } from "./_http.ts";

export interface KeepAliveRequest {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
}

export interface KeepAliveResponse {
    status: (code: number) => KeepAliveResponse;
    setHeader?: (name: string, value: string) => void;
    json: (body: unknown) => unknown;
}

export async function handleKeepAlive(
    request: KeepAliveRequest,
    response: KeepAliveResponse,
    fetchFn: typeof fetch = fetch,
) {
    response.setHeader?.("Cache-Control", "no-store, max-age=0");

    if (request.method !== "GET" && request.method !== "POST") {
        return response.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const cronSecret = (process.env.CRON_SECRET || "").trim();
    if (!cronSecret) {
        return response.status(503).json({
            ok: false,
            message: "Configure CRON_SECRET na Vercel para habilitar o keep-alive.",
        });
    }

    const headerVal = getHeader(request.headers, "authorization").trim();
    if (!timingSafeEqualStr(headerVal, `Bearer ${cronSecret}`)) {
        return response.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const supabaseUrl = (process.env.VITE_SUPABASE_URL || SUPABASE_URL).replace(/\/+$/, "");
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    const apiKey = serviceKey || process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

    try {
        const res = await fetchFn(`${supabaseUrl}/rest/v1/rpc/keep_alive_ping`, {
            method: "POST",
            signal: AbortSignal.timeout(10_000),
            headers: {
                apikey: apiKey,
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: "{}",
        });

        if (!res.ok) {
            const detail = await res.text();
            console.error("Supabase keep-alive failed:", res.status, detail);
            return response.status(502).json({ ok: false, status: res.status });
        }

        const pingedAt: unknown = await res.json();
        return response.status(200).json({ ok: true, pingedAt });
    } catch (error) {
        console.error("Supabase keep-alive error:", error);
        return response.status(500).json({ ok: false, message: "Internal server error" });
    }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
    return handleKeepAlive(request, response);
}
