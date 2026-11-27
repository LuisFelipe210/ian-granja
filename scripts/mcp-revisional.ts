import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
    RevisionalServerDb,
    handleMcpJsonRpc,
    type JsonRpcRequest,
    type RevisionalDbAdapter,
} from "../src/lib/mcp/revisional-mcp-core.ts";

function parseEnvFile(filePath: string): Record<string, string> {
    if (!existsSync(filePath)) return {};
    const out: Record<string, string> = {};
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        out[key] = val;
    }
    return out;
}

async function isLocalSupabaseUp(url: string): Promise<boolean> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 500);
    try {
        const res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/`, { signal: ctl.signal });
        return res.status > 0;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

async function createDbFromProjectEnv(): Promise<RevisionalServerDb> {
    const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const envProd = parseEnvFile(resolve(rootDir, ".env.local"));
    const envDev = parseEnvFile(resolve(rootDir, ".env.development.local"));

    const explicitTarget = process.env.MCP_SUPABASE_TARGET;
    const explicitUrl = process.env.VITE_SUPABASE_URL;

    let supabaseUrl = explicitUrl;
    let anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
    let password = process.env.REVISIONAL_PASSWORD || process.env.INITIAL_PASS_IAN || process.env.INITIAL_PASS_DEV;

    if (!supabaseUrl) {
        const localUrl = envDev.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
        const temAmbienteLocal = existsSync(resolve(rootDir, ".env.development.local"));
        const localNoAr = explicitTarget !== "prod" && temAmbienteLocal && (await isLocalSupabaseUp(localUrl));

        // Máquina de desenvolvimento com o banco local parado: nunca cair silenciosamente na
        // produção com a service role (as tools gravam e movem casos reais). Produção só por escolha.
        if (temAmbienteLocal && !localNoAr && explicitTarget !== "prod" && explicitTarget !== "local") {
            throw new Error(
                `Supabase local fora do ar em ${localUrl}. Rode "npm run db:start" ou, para usar a produção de propósito, defina MCP_SUPABASE_TARGET=prod.`,
            );
        }

        const useLocal = explicitTarget === "local" || localNoAr;
        console.error(`[mcp-revisional] Banco: ${useLocal ? `local (${localUrl})` : "PRODUÇÃO"}`);

        if (useLocal) {
            supabaseUrl = localUrl;
            anonKey = anonKey || envDev.VITE_SUPABASE_ANON_KEY;
            serviceRoleKey = serviceRoleKey || envDev.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
        } else {
            supabaseUrl = envProd.VITE_SUPABASE_URL;
            anonKey = anonKey || envProd.VITE_SUPABASE_ANON_KEY;
            serviceRoleKey = serviceRoleKey || envProd.SUPABASE_SERVICE_ROLE_KEY;
            password = password || envProd.INITIAL_PASS_IAN || envProd.INITIAL_PASS_DEV;
        }
    }

    return new RevisionalServerDb({
        supabaseUrl,
        anonKey,
        serviceRoleKey,
        email: process.env.REVISIONAL_EMAIL || "contato@iangranja.adv.br",
        password,
    });
}

/**
 * Resolve o banco só quando uma tool precisa dele. Assim o servidor sobe e responde ao
 * handshake mesmo com o Supabase local parado (o app do Claude marcava "Server disconnected");
 * o erro aparece na chamada da tool e a próxima chamada tenta de novo, sem reiniciar o conector.
 */
function createLazyDb(): RevisionalDbAdapter {
    let pending: Promise<RevisionalServerDb> | null = null;
    const get = () => {
        if (!pending) {
            pending = createDbFromProjectEnv().catch((err) => {
                pending = null;
                throw err;
            });
        }
        return pending;
    };
    return {
        listarCategorias: async () => (await get()).listarCategorias(),
        criarCategoria: async (nome, cor, ordem) => (await get()).criarCategoria(nome, cor, ordem),
        listarCalculos: async () => (await get()).listarCalculos(),
        criarCalculo: async (payload) => (await get()).criarCalculo(payload),
        atualizarCalculo: async (id, payload) => (await get()).atualizarCalculo(id, payload),
        listarTipos: async () => (await get()).listarTipos(),
        criarTipo: async (nome, cor, ordem) => (await get()).criarTipo(nome, cor, ordem),
        listarTarefas: async () => (await get()).listarTarefas(),
        criarTarefa: async (payload) => (await get()).criarTarefa(payload),
        atualizarTarefa: async (id, patch) => (await get()).atualizarTarefa(id, patch),
        excluirTarefa: async (id) => (await get()).excluirTarefa(id),
        obterConfigEscritorio: async () => (await get()).obterConfigEscritorio(),
        existeCalculoComProcesso: async (cnj) => (await get()).existeCalculoComProcesso(cnj),
        listarClientesBasico: async () => (await get()).listarClientesBasico(),
        criarItemConhecimento: async (linha) => (await get()).criarItemConhecimento(linha),
    };
}

async function main() {
    const db = createLazyDb();
    // Pré-aquece a mesma instância lazy para registrar no log qual banco será usado.
    db.obterConfigEscritorio?.().catch((err) => {
        console.error(`[mcp-revisional] Aviso: ${err instanceof Error ? err.message : String(err)}`);
    });

    const rl = readline.createInterface({
        input: process.stdin,
        crlfDelay: Infinity,
    });

    const writeMsg = (payload: unknown) => {
        process.stdout.write(`${JSON.stringify(payload)}\n`);
    };

    let activeCount = 0;
    let stdinClosed = false;
    const maybeExit = () => {
        if (stdinClosed && activeCount === 0) {
            process.exit(0);
        }
    };

    rl.on("line", (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        activeCount += 1;
        void (async () => {
            try {
                const parsed = JSON.parse(trimmed) as JsonRpcRequest | JsonRpcRequest[];
                if (Array.isArray(parsed)) {
                    const responses = (await Promise.all(parsed.map((item) => handleMcpJsonRpc(item, db)))).filter(
                        (r) => r !== null,
                    );
                    if (responses.length > 0) writeMsg(responses);
                } else {
                    const res = await handleMcpJsonRpc(parsed, db);
                    if (res !== null) writeMsg(res);
                }
            } catch (err) {
                writeMsg({
                    jsonrpc: "2.0",
                    id: null,
                    error: {
                        code: -32700,
                        message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
                    },
                });
            } finally {
                activeCount -= 1;
                maybeExit();
            }
        })();
    });

    rl.on("close", () => {
        stdinClosed = true;
        maybeExit();
    });
}

main().catch((err) => {
    console.error("[mcp-revisional] Fatal error:", err);
    process.exit(1);
});
