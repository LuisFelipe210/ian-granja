import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../src/lib/revisional-db.ts";
import {
    assinar,
    metadadosRecurso,
    metadadosServidor,
    novoClientId,
    paginaLogin,
    paginaRetorno,
    pkceConfere,
    retornoPermitido,
    segredoOAuth,
    urlBase,
    VALIDADE_ACESSO_S,
    VALIDADE_CODIGO_S,
    VALIDADE_RENOVACAO_S,
    verificar,
} from "../src/lib/mcp/oauth.ts";
import { getHeader, verificarUsuarioAutorizado } from "./_http.ts";

/**
 * Login OAuth do conector MCP (claude.ai → "Vincular").
 * Rotas (via rewrites do vercel.json, com ?rota=):
 *   prm       GET  /.well-known/oauth-protected-resource
 *   asm       GET  /.well-known/oauth-authorization-server
 *   register  POST /api/oauth/register    (registro dinâmico do cliente)
 *   authorize GET  /api/oauth/authorize   (tela de login) · POST (confere a senha e devolve o código)
 *   token     POST /api/oauth/token       (código → tokens; renovação)
 */

export interface OAuthRequest {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[] | undefined>;
    body?: unknown;
}

export interface OAuthResponse {
    status: (code: number) => OAuthResponse;
    setHeader?: (name: string, value: string) => void;
    json: (body: unknown) => unknown;
    send?: (body: string) => unknown;
    end?: () => unknown;
}

const q = (obj: Record<string, unknown> | undefined, k: string): string => {
    const v = obj?.[k];
    return Array.isArray(v) ? String(v[0] ?? "") : typeof v === "string" ? v : "";
};

function lerCorpo(body: unknown): Record<string, unknown> {
    if (body && typeof body === "object" && !Array.isArray(body) && !Buffer.isBuffer(body)) return body as Record<string, unknown>;
    const texto = Buffer.isBuffer(body) ? body.toString("utf8") : typeof body === "string" ? body : "";
    if (!texto) return {};
    try {
        const j = JSON.parse(texto);
        if (j && typeof j === "object") return j as Record<string, unknown>;
    } catch {
        // formulário
    }
    return Object.fromEntries(new URLSearchParams(texto));
}

function html(response: OAuthResponse, codigo: number, corpo: string) {
    response.setHeader?.("Content-Type", "text/html; charset=utf-8");
    response.status(codigo);
    return response.send ? response.send(corpo) : response.json(corpo);
}

function erroOAuth(response: OAuthResponse, codigo: number, erro: string, descricao: string) {
    return response.status(codigo).json({ error: erro, error_description: descricao });
}

/* ------------------------------------------------------------------ Limite de tentativas de login */

const TENTATIVAS = new Map<string, { n: number; ate: number }>();
function bloqueado(ip: string, agora = Date.now()): boolean {
    const t = TENTATIVAS.get(ip);
    if (!t || t.ate < agora) return false;
    return t.n >= 10;
}
function registrarFalha(ip: string, agora = Date.now()) {
    const t = TENTATIVAS.get(ip);
    if (!t || t.ate < agora) TENTATIVAS.set(ip, { n: 1, ate: agora + 10 * 60 * 1000 });
    else t.n++;
    if (TENTATIVAS.size > 2000) TENTATIVAS.clear();
}

/* ------------------------------------------------------------------ Supabase */

async function loginSupabase(email: string, senha: string, fetchFn: typeof fetch, env: Record<string, string | undefined>) {
    const supabaseUrl = (env.VITE_SUPABASE_URL || SUPABASE_URL).replace(/\/+$/, "");
    const anonKey = env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
    const res = await fetchFn(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        signal: AbortSignal.timeout(8_000),
        headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: senha }),
    });
    if (!res.ok) return null;
    const dados = (await res.json().catch(() => ({}))) as { access_token?: string; user?: { id?: string; email?: string } };
    if (!dados.access_token || !dados.user?.id) return null;
    const autorizado = await verificarUsuarioAutorizado(dados.access_token, supabaseUrl, anonKey, fetchFn);
    if (!autorizado) return { naoAutorizado: true as const };
    return { sub: dados.user.id, email: (dados.user.email || email).toLowerCase() };
}

/** Na renovação: o e-mail continua na lista do escritório? (sem a service role, não dá para conferir) */
async function aindaAutorizado(email: string, fetchFn: typeof fetch, env: Record<string, string | undefined>): Promise<boolean> {
    const chave = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!chave) return true;
    const supabaseUrl = (env.VITE_SUPABASE_URL || SUPABASE_URL).replace(/\/+$/, "");
    try {
        const res = await fetchFn(`${supabaseUrl}/rest/v1/revisional_usuarios_autorizados?select=email`, {
            signal: AbortSignal.timeout(8_000),
            headers: { apikey: chave, Authorization: `Bearer ${chave}` },
        });
        if (!res.ok) return true;
        const linhas = (await res.json()) as Array<{ email?: string }>;
        return linhas.some((l) => (l.email ?? "").trim().toLowerCase() === email.trim().toLowerCase());
    } catch {
        return true;
    }
}

/* ------------------------------------------------------------------ Handler */

export async function handleOAuthRequest(
    request: OAuthRequest,
    response: OAuthResponse,
    options: { fetchFn?: typeof fetch; env?: Record<string, string | undefined>; agoraS?: number } = {},
) {
    const env = options.env ?? process.env;
    const fetchFn = options.fetchFn ?? fetch;
    const agoraS = options.agoraS ?? Math.floor(Date.now() / 1000);
    const base = urlBase(getHeader(request.headers, "x-forwarded-host") || getHeader(request.headers, "host"), env);
    const rota = q(request.query as Record<string, unknown>, "rota");
    response.setHeader?.("Cache-Control", "no-store");
    response.setHeader?.("Access-Control-Allow-Origin", "*");
    response.setHeader?.("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-protocol-version");
    response.setHeader?.("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (request.method === "OPTIONS") {
        response.status(204);
        return response.end ? response.end() : response.json({});
    }

    if (rota === "prm") return response.status(200).json(metadadosRecurso(base));
    if (rota === "asm") return response.status(200).json(metadadosServidor(base));

    let segredo: string;
    try {
        segredo = segredoOAuth(env);
    } catch (err) {
        return erroOAuth(response, 503, "server_error", (err as Error).message);
    }

    /* ---------------- registro dinâmico */
    if (rota === "register") {
        if (request.method !== "POST") return erroOAuth(response, 405, "invalid_request", "Use POST.");
        const corpo = lerCorpo(request.body);
        const uris = Array.isArray(corpo.redirect_uris) ? corpo.redirect_uris.filter((u): u is string => typeof u === "string") : [];
        if (uris.length === 0 || !uris.every(retornoPermitido)) {
            return erroOAuth(response, 400, "invalid_redirect_uri", "Endereço de retorno não permitido.");
        }
        return response.status(201).json({
            client_id: novoClientId(),
            client_id_issued_at: agoraS,
            client_name: typeof corpo.client_name === "string" ? corpo.client_name.slice(0, 100) : "Claude",
            redirect_uris: uris,
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none",
        });
    }

    /* ---------------- autorização (tela de login) */
    if (rota === "authorize") {
        const p = request.method === "POST" ? lerCorpo(request.body) : (request.query as Record<string, unknown>) ?? {};
        const campos = {
            response_type: q(p, "response_type"),
            client_id: q(p, "client_id"),
            redirect_uri: q(p, "redirect_uri"),
            code_challenge: q(p, "code_challenge"),
            code_challenge_method: q(p, "code_challenge_method"),
            state: q(p, "state"),
            scope: q(p, "scope"),
            resource: q(p, "resource"),
        };
        // Sem retorno confiável não dá nem para devolver o erro ao cliente: mostra na tela.
        if (!retornoPermitido(campos.redirect_uri)) {
            return html(response, 400, paginaLogin({}, "Endereço de retorno não permitido. Conecte pelo Claude."));
        }
        if (
            campos.response_type !== "code" ||
            !campos.client_id ||
            campos.client_id.length > 500 ||
            campos.code_challenge_method !== "S256" ||
            !/^[A-Za-z0-9_-]{43}$/.test(campos.code_challenge)
        ) {
            const u = new URL(campos.redirect_uri);
            u.searchParams.set("error", "invalid_request");
            u.searchParams.set("error_description", "Requisição de login inválida (PKCE S256 obrigatório).");
            if (campos.state) u.searchParams.set("state", campos.state);
            return html(response, 400, paginaRetorno(u.toString()));
        }

        if (request.method !== "POST") return html(response, 200, paginaLogin(campos));

        const ip = getHeader(request.headers, "x-forwarded-for").split(",")[0].trim() || "local";
        if (bloqueado(ip)) {
            return html(response, 429, paginaLogin(campos, "Muitas tentativas. Espere alguns minutos e tente de novo."));
        }
        const email = q(p, "email").trim();
        const senha = q(p, "senha");
        let login: Awaited<ReturnType<typeof loginSupabase>> = null;
        try {
            login = email && senha ? await loginSupabase(email, senha, fetchFn, env) : null;
        } catch {
            return html(response, 502, paginaLogin(campos, "Não foi possível falar com o sistema agora. Tente de novo."));
        }
        if (!login) {
            registrarFalha(ip);
            return html(response, 401, paginaLogin(campos, "E-mail ou senha incorretos."));
        }
        if ("naoAutorizado" in login) {
            return html(response, 403, paginaLogin(campos, "Esta conta não tem acesso ao sistema do escritório."));
        }

        const codigo = assinar(
            {
                t: "codigo",
                exp: agoraS + VALIDADE_CODIGO_S,
                email: login.email,
                sub: login.sub,
                cid: campos.client_id,
                uri: campos.redirect_uri,
                pkce: campos.code_challenge,
            },
            segredo,
        );
        const destino = new URL(campos.redirect_uri);
        destino.searchParams.set("code", codigo);
        if (campos.state) destino.searchParams.set("state", campos.state);
        return html(response, 200, paginaRetorno(destino.toString()));
    }

    /* ---------------- token */
    if (rota === "token") {
        if (request.method !== "POST") return erroOAuth(response, 405, "invalid_request", "Use POST.");
        const p = lerCorpo(request.body);
        const tipo = q(p, "grant_type");

        const emitir = (email: string, sub: string, cid: string) =>
            response.status(200).json({
                access_token: assinar({ t: "acesso", exp: agoraS + VALIDADE_ACESSO_S, email, sub, cid }, segredo),
                token_type: "Bearer",
                expires_in: VALIDADE_ACESSO_S,
                refresh_token: assinar({ t: "renovacao", exp: agoraS + VALIDADE_RENOVACAO_S, email, sub, cid }, segredo),
                scope: "mcp",
            });

        if (tipo === "authorization_code") {
            const c = verificar(q(p, "code"), "codigo", segredo, agoraS);
            if (!c) return erroOAuth(response, 400, "invalid_grant", "Código inválido ou expirado.");
            if (c.cid !== q(p, "client_id") || c.uri !== q(p, "redirect_uri")) {
                return erroOAuth(response, 400, "invalid_grant", "Código emitido para outro cliente ou endereço.");
            }
            if (!c.pkce || !pkceConfere(q(p, "code_verifier"), c.pkce)) {
                return erroOAuth(response, 400, "invalid_grant", "code_verifier não confere (PKCE).");
            }
            return emitir(c.email, c.sub, c.cid ?? "");
        }

        if (tipo === "refresh_token") {
            const r = verificar(q(p, "refresh_token"), "renovacao", segredo, agoraS);
            if (!r) return erroOAuth(response, 400, "invalid_grant", "Renovação inválida ou expirada. Conecte de novo.");
            if (!(await aindaAutorizado(r.email, fetchFn, env))) {
                return erroOAuth(response, 400, "invalid_grant", "Esta conta perdeu o acesso ao sistema.");
            }
            return emitir(r.email, r.sub, r.cid ?? "");
        }

        return erroOAuth(response, 400, "unsupported_grant_type", "Use authorization_code ou refresh_token.");
    }

    return erroOAuth(response, 404, "not_found", "Rota OAuth desconhecida.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    return handleOAuthRequest(req as unknown as OAuthRequest, res as unknown as OAuthResponse);
}
