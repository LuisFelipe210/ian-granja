import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const MAX_BYTES = 32 * 1024 * 1024;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BYTES) {
        reject(new Error("Payload excede o limite de 32MB."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const ENDERECOS_LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** Funções de /api servidas pelo dev server (na Vercel cada arquivo vira uma função). */
const ROTAS_API_LOCAIS: Record<string, { modulo: string; handler: string }> = {
  "/api/claude-revisional": { modulo: "/api/claude-revisional.ts", handler: "handleClaudeRevisionalRequest" },
  "/api/mcp": { modulo: "/api/mcp.ts", handler: "handleMcpHttpRequest" },
  "/api/djen-sync": { modulo: "/api/djen-sync.ts", handler: "handleDjenSync" },
  "/api/send-contact": { modulo: "/api/send-contact.ts", handler: "handleContactRequest" },
};

const ORIGEM_LOCAL_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function localApiDevPlugin(envVars: Record<string, string>): Plugin {
  return {
    name: "local-revisional-api-dev",
    configureServer(server) {
      for (const [k, v] of Object.entries(envVars)) {
        if (process.env[k] === undefined) {
          process.env[k] = v;
        }
      }

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        const [pathname, queryStr = ""] = rawUrl.split("?");
        const rota = ROTAS_API_LOCAIS[pathname];
        if (!rota) {
          return next();
        }

        try {
          const query = Object.fromEntries(new URLSearchParams(queryStr).entries());
          const bodyStr = req.method === "POST" ? await readRequestBody(req) : undefined;
          let statusCode = 200;

          const mockRes = {
            status(code: number) {
              statusCode = code;
              return mockRes;
            },
            setHeader(name: string, value: string) {
              res.setHeader(name, value);
            },
            json(payload: unknown) {
              res.statusCode = statusCode;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify(payload));
            },
            end() {
              res.statusCode = statusCode;
              res.end();
            },
          };

          const mod = await server.ssrLoadModule(rota.modulo);
          const fn = mod[rota.handler] as (r: unknown, s: unknown, o: unknown) => Promise<unknown>;

          // O dev server escuta em todas as interfaces (host "::"): só conexões pelo loopback E
          // sem origem cross-site dispensam login (evita site externo chamar http://127.0.0.1:8080/api/*).
          const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
          const secFetchSite = Array.isArray(req.headers["sec-fetch-site"])
            ? req.headers["sec-fetch-site"][0]
            : req.headers["sec-fetch-site"];
          const origemSegura =
            (!originHeader || ORIGEM_LOCAL_RE.test(originHeader)) && secFetchSite !== "cross-site";
          const conexaoLocalVerificada =
            ENDERECOS_LOOPBACK.has(req.socket.remoteAddress ?? "") && origemSegura;

          await fn(
            {
              method: req.method,
              headers: req.headers,
              body: bodyStr,
              query,
              socket: { remoteAddress: req.socket.remoteAddress },
            },
            mockRes as unknown as ServerResponse,
            pathname === "/api/send-contact" ? undefined : { conexaoLocalVerificada },
          );
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              ok: false,
              message: err instanceof Error ? err.message : "Erro interno na API local.",
            }),
          );
        }
      });
    },
  };
}

/**
 * Cabeçalhos de segurança de produção (CSP etc.), lidos do vercel.json para que o `vite preview`
 * sirva exatamente a mesma política e dê para testá-la localmente antes do deploy.
 * O dev server (`vite`) não usa a CSP: ele depende de scripts embutidos para o hot reload.
 */
function cabecalhosSegurancaProducao(): Record<string, string> {
  try {
    const config = JSON.parse(readFileSync(path.resolve(__dirname, "vercel.json"), "utf8")) as {
      headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const regra = config.headers?.find((h) => h.source === "/(.*)");
    const cabecalhos = Object.fromEntries((regra?.headers ?? []).map((h) => [h.key, h.value]));
    // Só para testes locais: `CSP_EXTRA_CONNECT=http://127.0.0.1:54321 vite preview` libera o Supabase local.
    const extra = process.env.CSP_EXTRA_CONNECT?.trim();
    if (extra && cabecalhos["Content-Security-Policy"]) {
      cabecalhos["Content-Security-Policy"] = cabecalhos["Content-Security-Policy"].replace(
        "connect-src 'self'",
        `connect-src 'self' ${extra}`,
      );
    }
    return cabecalhos;
  } catch (err) {
    console.error("[vite preview] Falha ao ler headers de segurança em vercel.json:", err);
    return {};
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const envVars = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      host: "127.0.0.1",
      port: 8080,
    },
    preview: {
      headers: cabecalhosSegurancaProducao(),
    },
    plugins: [
      react(),
      mode === "development" && localApiDevPlugin(envVars),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
