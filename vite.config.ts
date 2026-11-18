import type { IncomingMessage, ServerResponse } from "node:http";
import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";

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
};

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

          // O dev server escuta em todas as interfaces (host "::"): só conexões que chegam de fato pelo
          // loopback dispensam login. O header Host não serve para isso porque o cliente o define.
          const conexaoLocalVerificada = ENDERECOS_LOOPBACK.has(req.socket.remoteAddress ?? "");

          await fn(
            {
              method: req.method,
              headers: req.headers,
              body: bodyStr,
              query,
            },
            mockRes as unknown as ServerResponse,
            { conexaoLocalVerificada },
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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const envVars = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mode === "development" && localApiDevPlugin(envVars),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
