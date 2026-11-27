import { createHash, timingSafeEqual } from "node:crypto";

export interface HttpHeadersLike {
    [key: string]: string | string[] | undefined;
}

export interface HttpResponseLike {
    setHeader?: (name: string, value: string) => void;
}

export function getHeader(headers: HttpHeadersLike, name: string): string {
    const val = headers[name.toLowerCase()] ?? headers[name];
    if (Array.isArray(val)) return val[0] ?? "";
    return val ?? "";
}

/**
 * Comparação em tempo constante via digest SHA-256 (evita vazar inclusive o comprimento do segredo).
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
    if (!a || !b) return false;
    const ha = createHash("sha256").update(a, "utf8").digest();
    const hb = createHash("sha256").update(b, "utf8").digest();
    return timingSafeEqual(ha, hb);
}

const ORIGENS_PERMITIDAS_BASE = new Set([
    "https://www.iangranja.adv.br",
    "https://iangranja.adv.br",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]);

export function origemPermitida(origin: string): boolean {
    const clean = origin.trim();
    if (!clean) return false;
    if (ORIGENS_PERMITIDAS_BASE.has(clean)) return true;
    const extras = (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (extras.includes(clean)) return true;
    const vercelUrl = (process.env.VERCEL_URL || "").trim();
    if (vercelUrl && clean === `https://${vercelUrl}`) return true;
    return false;
}

/**
 * Aplica headers CORS restritos à allowlist (nunca `Access-Control-Allow-Origin: *` em rotas autenticadas)
 * e `Cache-Control: no-store` para evitar cache de respostas jurídicas/sensíveis.
 */
export function aplicarHeadersApiSeguros(
    headers: HttpHeadersLike,
    response: HttpResponseLike,
    metodos: string,
    allowHeaders: string,
): void {
    response.setHeader?.("Cache-Control", "no-store, max-age=0");
    response.setHeader?.("Vary", "Origin");
    const origin = getHeader(headers, "origin").trim();
    if (origin && origemPermitida(origin)) {
        response.setHeader?.("Access-Control-Allow-Origin", origin);
        response.setHeader?.("Access-Control-Allow-Methods", metodos);
        response.setHeader?.("Access-Control-Allow-Headers", allowHeaders);
    }
}

/**
 * Confirma que o token é uma sessão válida E que o e-mail está na whitelist do escritório
 * (`public.is_escritorio_autorizado()`, a mesma regra do RLS).
 */
export async function verificarUsuarioAutorizado(
    token: string,
    supabaseUrl: string,
    anonKey: string,
    fetchFn: typeof fetch,
): Promise<boolean> {
    try {
        const res = await fetchFn(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/is_escritorio_autorizado`, {
            method: "POST",
            signal: AbortSignal.timeout(6_000),
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: "{}",
        });
        if (!res.ok) return false;
        return (await res.json()) === true;
    } catch {
        return false;
    }
}
