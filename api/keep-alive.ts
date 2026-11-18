import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_SUPABASE_URL = "https://smeaktuuuxahmbzpjwqa.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZWFrdHV1dXhhaG1ienBqd3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MDkwNDYsImV4cCI6MjExMDA4NTA0Nn0.w9BajnZKcF3wgzCxxK45QfZAzayKNCYK_ynqyG17Rb4";

export interface KeepAliveRequest {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
}

export interface KeepAliveResponse {
    status: (code: number) => KeepAliveResponse;
    json: (body: unknown) => unknown;
}

export async function handleKeepAlive(
    request: KeepAliveRequest,
    response: KeepAliveResponse,
    fetchFn: typeof fetch = fetch,
) {
    if (request.method !== "GET" && request.method !== "POST") {
        return response.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const auth = request.headers.authorization;
        const headerVal = Array.isArray(auth) ? auth[0] : auth;
        if (headerVal !== `Bearer ${cronSecret}`) {
            return response.status(401).json({ ok: false, message: "Unauthorized" });
        }
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

    try {
        const res = await fetchFn(`${supabaseUrl}/rest/v1/rpc/keep_alive_ping`, {
            method: "POST",
            headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
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
