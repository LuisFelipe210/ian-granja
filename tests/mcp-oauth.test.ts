import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { handleOAuthRequest } from "../api/oauth.ts";
import { handleMcpHttpRequest } from "../api/mcp.ts";
import { retornoPermitido } from "../src/lib/mcp/oauth.ts";

const SEGREDO = "segredo-oauth-teste";
const ENV = { MCP_OAUTH_SECRET: SEGREDO, VITE_SUPABASE_URL: "https://db.test", VITE_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service" };
const RETORNO = "https://claude.ai/api/mcp/auth_callback";

function resposta() {
    const r = { code: 0, body: undefined as unknown, headers: {} as Record<string, string> };
    const api = {
        status(c: number) {
            r.code = c;
            return api;
        },
        setHeader(k: string, v: string) {
            r.headers[k] = v;
        },
        json(b: unknown) {
            r.body = b;
            return b;
        },
        send(b: string) {
            r.body = b;
            return b;
        },
        end() {
            return undefined;
        },
    };
    return { r, api };
}

/** Supabase simulado: senha certa = "senha-certa"; autorizados = lista. */
function supabase(autorizados = ["contato@iangranja.adv.br"]) {
    return (async (url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/auth/v1/token")) {
            const { email, password } = JSON.parse(String(init?.body));
            if (password !== "senha-certa") return Response.json({ error: "invalid_grant" }, { status: 400 });
            return Response.json({ access_token: `tok-${email}`, user: { id: "user-1", email } });
        }
        if (u.includes("/rpc/is_escritorio_autorizado")) {
            const token = String((init?.headers as Record<string, string>).Authorization).replace("Bearer tok-", "");
            return Response.json(autorizados.includes(token));
        }
        if (u.includes("revisional_usuarios_autorizados")) return Response.json(autorizados.map((email) => ({ email })));
        return Response.json([]);
    }) as typeof fetch;
}

async function chamar(rota: string, req: { method?: string; query?: Record<string, string>; body?: unknown }, fetchFn = supabase(), agoraS?: number) {
    const { r, api } = resposta();
    await handleOAuthRequest(
        { method: req.method ?? "GET", headers: { host: "www.iangranja.adv.br" }, query: { rota, ...(req.query ?? {}) }, body: req.body },
        api,
        { env: ENV, fetchFn, agoraS },
    );
    return r;
}

function pkce() {
    const verificador = randomBytes(32).toString("base64url");
    return { verificador, desafio: createHash("sha256").update(verificador).digest("base64url") };
}

function camposLogin(desafio: string) {
    return {
        response_type: "code",
        client_id: "ig_cliente",
        redirect_uri: RETORNO,
        code_challenge: desafio,
        code_challenge_method: "S256",
        state: "estado-123",
    };
}

async function obterCodigo(desafio: string, fetchFn = supabase()) {
    const r = await chamar("authorize", { method: "POST", body: { ...camposLogin(desafio), email: "contato@iangranja.adv.br", senha: "senha-certa" } }, fetchFn);
    assert.equal(r.code, 200, String(r.body));
    const url = /url=([^"]+)"/.exec(String(r.body))![1].replace(/&amp;/g, "&");
    const destino = new URL(url);
    assert.equal(destino.origin + destino.pathname, RETORNO);
    assert.equal(destino.searchParams.get("state"), "estado-123");
    return destino.searchParams.get("code")!;
}

describe("OAuth do conector MCP", () => {
    it("publica os metadados de descoberta", async () => {
        const prm = (await chamar("prm", {})).body as Record<string, unknown>;
        assert.equal(prm.resource, "https://www.iangranja.adv.br/api/mcp");
        assert.deepEqual(prm.authorization_servers, ["https://www.iangranja.adv.br"]);
        const asm = (await chamar("asm", {})).body as Record<string, unknown>;
        assert.equal(asm.token_endpoint, "https://www.iangranja.adv.br/api/oauth/token");
        assert.deepEqual(asm.code_challenge_methods_supported, ["S256"]);
    });

    it("registro aceita só endereços de retorno do Claude ou do computador local", async () => {
        const ok = await chamar("register", { method: "POST", body: { redirect_uris: [RETORNO], client_name: "Claude" } });
        assert.equal(ok.code, 201);
        assert.match(String((ok.body as { client_id: string }).client_id), /^ig_/);
        const ruim = await chamar("register", { method: "POST", body: { redirect_uris: ["https://evil.example/cb"] } });
        assert.equal(ruim.code, 400);
        assert.equal(retornoPermitido("http://localhost:43210/callback"), true);
        assert.equal(retornoPermitido("https://claude.ai.evil.com/api/mcp/auth_callback"), false);
        assert.equal(retornoPermitido("http://evil.com/cb"), false);
    });

    it("tela de login, senha errada e conta sem acesso", async () => {
        const { desafio } = pkce();
        const tela = await chamar("authorize", { query: camposLogin(desafio) });
        assert.equal(tela.code, 200);
        assert.match(String(tela.body), /<form method="post" action="\/api\/oauth\/authorize">/);
        assert.match(String(tela.body), /name="state" value="estado-123"/);

        const errada = await chamar("authorize", { method: "POST", body: { ...camposLogin(desafio), email: "contato@iangranja.adv.br", senha: "x" } });
        assert.equal(errada.code, 401);
        assert.match(String(errada.body), /incorretos/);

        const semAcesso = await chamar(
            "authorize",
            { method: "POST", body: { ...camposLogin(desafio), email: "outro@x.com", senha: "senha-certa" } },
            supabase([]),
        );
        assert.equal(semAcesso.code, 403);
    });

    it("recusa retorno fora da lista e login sem PKCE", async () => {
        const fora = await chamar("authorize", { query: { ...camposLogin(pkce().desafio), redirect_uri: "https://evil.example/cb" } });
        assert.equal(fora.code, 400);
        assert.doesNotMatch(String(fora.body), /evil\.example/);
        const semPkce = await chamar("authorize", { query: { ...camposLogin("curto"), code_challenge_method: "plain" } });
        assert.equal(semPkce.code, 400);
        assert.match(String(semPkce.body), /error=invalid_request/);
    });

    it("código + PKCE vira token que o conector aceita; renovação funciona", async () => {
        const { verificador, desafio } = pkce();
        const codigo = await obterCodigo(desafio);

        const errado = await chamar("token", {
            method: "POST",
            body: { grant_type: "authorization_code", code: codigo, client_id: "ig_cliente", redirect_uri: RETORNO, code_verifier: pkce().verificador },
        });
        assert.equal(errado.code, 400);
        const outroRetorno = await chamar("token", {
            method: "POST",
            body: { grant_type: "authorization_code", code: codigo, client_id: "ig_cliente", redirect_uri: "http://localhost:1/cb", code_verifier: verificador },
        });
        assert.equal(outroRetorno.code, 400);

        const ok = await chamar("token", {
            method: "POST",
            body: `grant_type=authorization_code&code=${encodeURIComponent(codigo)}&client_id=ig_cliente&redirect_uri=${encodeURIComponent(RETORNO)}&code_verifier=${verificador}`,
        });
        assert.equal(ok.code, 200);
        const tokens = ok.body as { access_token: string; refresh_token: string; token_type: string };
        assert.equal(tokens.token_type, "Bearer");

        // O conector aceita o token de acesso, mesmo com MCP_AUTH_TOKEN configurado.
        const anterior = { ...process.env };
        process.env.MCP_OAUTH_SECRET = SEGREDO;
        process.env.MCP_AUTH_TOKEN = "outro-token-fixo";
        try {
            const { r, api } = resposta();
            await handleMcpHttpRequest(
                { method: "GET", headers: { host: "www.iangranja.adv.br", authorization: `Bearer ${tokens.access_token}` } },
                api,
            );
            assert.equal(r.code, 200);

            const negado = resposta();
            await handleMcpHttpRequest({ method: "GET", headers: { host: "www.iangranja.adv.br" } }, negado.api);
            assert.equal(negado.r.code, 401);
            assert.equal(
                negado.r.headers["WWW-Authenticate"],
                'Bearer resource_metadata="https://www.iangranja.adv.br/.well-known/oauth-protected-resource"',
            );
        } finally {
            process.env = anterior;
        }

        const renovado = await chamar("token", { method: "POST", body: { grant_type: "refresh_token", refresh_token: tokens.refresh_token } });
        assert.equal(renovado.code, 200);
        const semAcesso = await chamar("token", { method: "POST", body: { grant_type: "refresh_token", refresh_token: tokens.refresh_token } }, supabase([]));
        assert.equal(semAcesso.code, 400, "quem saiu da lista do escritório não renova");
    });

    it("código expira em 5 minutos", async () => {
        const { verificador, desafio } = pkce();
        const codigo = await obterCodigo(desafio);
        const tarde = await chamar(
            "token",
            { method: "POST", body: { grant_type: "authorization_code", code: codigo, client_id: "ig_cliente", redirect_uri: RETORNO, code_verifier: verificador } },
            supabase(),
            Math.floor(Date.now() / 1000) + 6 * 60,
        );
        assert.equal(tarde.code, 400);
    });
});
