import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_URL = (process.env.LOCAL_SUPABASE_URL || "http://127.0.0.1:54321").replace(/\/+$/, "");
const LOCAL_STUDIO_URL = "http://127.0.0.1:54323";

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

async function isSupabaseLocalAtivo(): Promise<boolean> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 1200);
    try {
        const res = await fetch(`${LOCAL_URL}/rest/v1/`, { signal: ctl.signal });
        return res.status > 0;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

async function precisaExecutarSeed(serviceRoleKey: string): Promise<boolean> {
    try {
        const headers = {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
        };

        const [usersRes, calcRes] = await Promise.all([
            fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=5`, { headers }),
            fetch(`${LOCAL_URL}/rest/v1/revisional_calculos?select=id&limit=1`, { headers }),
        ]);

        if (!usersRes.ok || !calcRes.ok) return false;

        const usersBody = (await usersRes.json()) as { users?: unknown[] };
        const calcRows = (await calcRes.json()) as unknown[];
        return (usersBody.users?.length ?? 0) === 0 || calcRows.length === 0;
    } catch {
        return false;
    }
}

function executarSeed(): void {
    console.log("[dev:local] Executando seed local (scripts/seed-local.ts)...");
    const seedRes = spawnSync(
        process.execPath,
        ["--experimental-strip-types", resolve(ROOT_DIR, "scripts/seed-local.ts")],
        { cwd: ROOT_DIR, stdio: "inherit" },
    );
    if (seedRes.status !== 0) {
        throw new Error(`scripts/seed-local.ts encerrou com código ${seedRes.status ?? "desconhecido"}.`);
    }
}

async function main() {
    const rawArgs = process.argv.slice(2);
    const forceSeed = rawArgs.includes("--seed");
    const viteArgs = rawArgs.filter((arg) => arg !== "--seed");

    const envDev = parseEnvFile(resolve(ROOT_DIR, ".env.development.local"));
    const serviceRoleKey =
        process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY || envDev.LOCAL_SUPABASE_SERVICE_ROLE_KEY || "";

    const ativo = await isSupabaseLocalAtivo();
    if (!ativo) {
        console.log("[dev:local] Subindo banco Supabase local (supabase start)...");
        const startRes = spawnSync("supabase", ["start"], { cwd: ROOT_DIR, stdio: "inherit" });
        if (startRes.status !== 0) {
            throw new Error(
                "Não foi possível iniciar o Supabase local. Verifique se o Docker / OrbStack está em execução.",
            );
        }
    } else {
        console.log(`[dev:local] Supabase local já está ativo em ${LOCAL_URL}.`);
    }

    if (forceSeed || (serviceRoleKey && (await precisaExecutarSeed(serviceRoleKey)))) {
        executarSeed();
    } else {
        console.log("[dev:local] Banco local já populado (use --seed ou npm run db:seed para repopular).");
    }

    console.log("");
    console.log("===============================================================");
    console.log(`  Supabase Local API : ${LOCAL_URL}`);
    console.log(`  Supabase Studio    : ${LOCAL_STUDIO_URL}`);
    console.log("  Acessos locais     : contato@iangranja.adv.br | lf210400@gmail.com");
    console.log("  Rota calculadora   : /ferramentas/calculadora-revisional");
    console.log("===============================================================");
    console.log("");

    const viteBin = resolve(ROOT_DIR, "node_modules/vite/bin/vite.js");
    const child = existsSync(viteBin)
        ? spawn(process.execPath, [viteBin, ...viteArgs], { cwd: ROOT_DIR, stdio: "inherit" })
        : spawn("npx", ["vite", ...viteArgs], { cwd: ROOT_DIR, stdio: "inherit" });

    const encerrar = (signal: NodeJS.Signals) => {
        if (!child.killed) child.kill(signal);
    };
    process.on("SIGINT", () => encerrar("SIGINT"));
    process.on("SIGTERM", () => encerrar("SIGTERM"));

    child.on("exit", (code) => {
        process.exit(code ?? 0);
    });
}

main().catch((err) => {
    console.error("[dev:local] Erro:", err instanceof Error ? err.message : err);
    process.exit(1);
});
