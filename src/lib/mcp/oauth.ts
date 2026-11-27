/**
 * OAuth 2.1 do conector MCP (o claude.ai exige login para conectores personalizados).
 *
 * - Sem tabela nova: códigos e tokens são assinados com HMAC (stateless) e expiram sozinhos.
 * - Só devolve o código para endereços de retorno do próprio Claude (claude.ai / claude.com) ou do
 *   computador local (Claude Code/Desktop), com PKCE S256 obrigatório.
 * - O login é o do sistema (Supabase Auth) e só entra quem está em revisional_usuarios_autorizados.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const VALIDADE_CODIGO_S = 5 * 60;
export const VALIDADE_ACESSO_S = 60 * 60;
export const VALIDADE_RENOVACAO_S = 30 * 24 * 60 * 60;

type Env = Record<string, string | undefined>;
const envPadrao = (): Env => (globalThis as { process?: { env?: Env } }).process?.env ?? {};

export function segredoOAuth(env: Env = envPadrao()): string {
    const s = (env.MCP_OAUTH_SECRET || env.MCP_AUTH_TOKEN || env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!s) throw new Error("Configure MCP_OAUTH_SECRET (ou MCP_AUTH_TOKEN) na Vercel para o login do conector.");
    return s;
}

/* ------------------------------------------------------------------ Assinatura */

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export interface Carga {
    t: "codigo" | "acesso" | "renovacao";
    exp: number;
    email: string;
    sub: string;
    cid?: string;
    uri?: string;
    pkce?: string;
}

export function assinar(carga: Carga, segredo: string): string {
    const corpo = b64url(JSON.stringify(carga));
    const sig = createHmac("sha256", segredo).update(corpo).digest("base64url");
    return `${corpo}.${sig}`;
}

export function verificar(token: string, tipo: Carga["t"], segredo: string, agoraS = Math.floor(Date.now() / 1000)): Carga | null {
    const [corpo, sig, sobra] = token.split(".");
    if (!corpo || !sig || sobra !== undefined) return null;
    const esperado = createHmac("sha256", segredo).update(corpo).digest();
    let recebido: Buffer;
    try {
        recebido = Buffer.from(sig, "base64url");
    } catch {
        return null;
    }
    if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return null;
    try {
        const c = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as Carga;
        if (c.t !== tipo || typeof c.exp !== "number" || c.exp < agoraS || !c.email) return null;
        return c;
    } catch {
        return null;
    }
}

export function verificarTokenAcesso(token: string, env: Env = envPadrao()): Carga | null {
    let segredo: string;
    try {
        segredo = segredoOAuth(env);
    } catch {
        return null;
    }
    return verificar(token, "acesso", segredo);
}

export function pkceConfere(verificador: string, desafio: string): boolean {
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verificador)) return false;
    const calc = createHash("sha256").update(verificador).digest("base64url");
    const a = Buffer.from(calc);
    const b = Buffer.from(desafio);
    return a.length === b.length && timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ Clientes e retorno */

const RETORNOS_CLAUDE = new Set(["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"]);

/** Só o Claude (web/app) e o computador local (Claude Code/Desktop) recebem o código. */
export function retornoPermitido(uri: string): boolean {
    if (RETORNOS_CLAUDE.has(uri)) return true;
    try {
        const u = new URL(uri);
        return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1") && !u.username;
    } catch {
        return false;
    }
}

export function novoClientId(): string {
    return `ig_${randomBytes(16).toString("hex")}`;
}

/* ------------------------------------------------------------------ Metadados */

export function urlBase(host: string | undefined, env: Env = envPadrao()): string {
    const fixo = (env.MCP_PUBLIC_URL || "").trim().replace(/\/+$/, "");
    if (fixo) return fixo;
    const h = (host || "www.iangranja.adv.br").trim();
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h);
    return `${local ? "http" : "https"}://${h}`;
}

export function metadadosRecurso(base: string) {
    return {
        resource: `${base}/api/mcp`,
        authorization_servers: [base],
        bearer_methods_supported: ["header"],
        scopes_supported: ["mcp"],
        resource_name: "Ian Granja Advogados — sistema revisional",
    };
}

export function metadadosServidor(base: string) {
    return {
        issuer: base,
        authorization_endpoint: `${base}/api/oauth/authorize`,
        token_endpoint: `${base}/api/oauth/token`,
        registration_endpoint: `${base}/api/oauth/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
        scopes_supported: ["mcp"],
        client_id_metadata_document_supported: true,
    };
}

/* ------------------------------------------------------------------ Tela de login */

const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export function paginaLogin(campos: Record<string, string>, erro = ""): string {
    const ocultos = Object.entries(campos)
        .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
        .join("");
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Entrar — Ian Granja Advogados</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1530;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0b1530}
main{background:#fff;width:100%;max-width:380px;margin:16px;padding:28px 24px;box-sizing:border-box}
h1{font-size:18px;margin:0 0 4px}p{font-size:13px;color:#555;margin:0 0 20px;line-height:1.5}
label{display:block;font-size:12px;font-weight:600;margin:12px 0 4px}
input[type=email],input[type=password]{width:100%;box-sizing:border-box;padding:10px;border:1px solid #c9c9c9;font-size:15px}
button{margin-top:18px;width:100%;padding:11px;border:0;background:#b8924a;color:#0b1530;font-weight:700;font-size:15px;cursor:pointer}
.erro{background:#fdecec;color:#8a1c1c;padding:8px 10px;font-size:13px;margin-bottom:8px}
</style></head><body><main>
<h1>Conectar o Claude ao sistema</h1>
<p>Entre com o e-mail e a senha do sistema do escritório. O Claude poderá consultar e cadastrar casos, clientes e agenda em seu nome.</p>
${erro ? `<div class="erro" role="alert">${esc(erro)}</div>` : ""}
<form method="post" action="/api/oauth/authorize">${ocultos}
<label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="username" required autofocus>
<label for="senha">Senha</label><input id="senha" name="senha" type="password" autocomplete="current-password" required>
<button type="submit">Entrar e conectar</button>
</form></main></body></html>`;
}

/** Depois do login: volta para o Claude. Meta refresh (o CSP do site bloqueia redirect de formulário para outro domínio). */
export function paginaRetorno(url: string): string {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${esc(url)}">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Conectado</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px">Conectado. Voltando para o Claude… <a href="${esc(url)}">continuar</a></body></html>`;
}
