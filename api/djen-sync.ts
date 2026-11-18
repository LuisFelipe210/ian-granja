import type { VercelRequest, VercelResponse } from "@vercel/node";
import { INTERVALO_VERIFICACAO_DJEN_HORAS, verificarPublicacoesDjen } from "../src/lib/juros/djen.ts";
import { RevisionalServerDb, type RevisionalDbAdapter } from "../src/lib/mcp/revisional-mcp-core.ts";
import type { ApiHttpRequest, ApiHttpResponse, OpcoesConfiancaApi } from "./claude-revisional.ts";

function getHeader(headers: Record<string, string | string[] | undefined>, name: string): string {
    const val = headers[name.toLowerCase()] ?? headers[name];
    if (Array.isArray(val)) return val[0] ?? "";
    return val ?? "";
}

/**
 * Verificação agendada de novas publicações do DJEN para os processos salvos (Vercel Cron).
 * Grava no banco com a service role, por isso exige CRON_SECRET: a Vercel envia
 * `Authorization: Bearer <CRON_SECRET>` nas execuções do cron.
 */
export async function handleDjenSync(
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    options: OpcoesConfiancaApi & {
        db?: RevisionalDbAdapter;
        fetchFn?: typeof fetch;
        esperar?: (ms: number) => Promise<void>;
    } = {},
) {
    if (request.method !== "GET" && request.method !== "POST") {
        return response.status(405).json({ ok: false, message: "Method not allowed" });
    }

    if (!options.conexaoLocalVerificada) {
        const segredo = (process.env.CRON_SECRET || "").trim();
        if (!segredo) {
            return response.status(503).json({
                ok: false,
                message: "Configure CRON_SECRET na Vercel para habilitar a verificação automática do DJEN.",
            });
        }
        if (getHeader(request.headers, "authorization") !== `Bearer ${segredo}`) {
            return response.status(401).json({ ok: false, message: "Unauthorized" });
        }
    }

    const db = options.db ?? new RevisionalServerDb({ fetchFn: options.fetchFn });
    const intervaloEnv = Number(process.env.DJEN_SYNC_INTERVALO_HORAS);
    const intervaloHoras =
        Number.isFinite(intervaloEnv) && intervaloEnv >= 0 ? intervaloEnv : INTERVALO_VERIFICACAO_DJEN_HORAS;

    try {
        const calculos = await db.listarCalculos();
        const resultado = await verificarPublicacoesDjen({
            calculos,
            atualizar: (id, patch) => db.atualizarCalculo(id, patch),
            fetchFn: options.fetchFn,
            esperar: options.esperar,
            intervaloHoras,
            // Funções da Vercel têm teto de duração (maxDuration em vercel.json); o que sobrar fica
            // para a próxima execução, começando pelos processos verificados há mais tempo.
            orcamentoMs: 45_000,
        });

        const { atualizados: _atualizados, ...resumo } = resultado;
        if (resumo.erros.length > 0) {
            console.error("[djen-sync] Falhas em processos:", resumo.erros);
        }
        return response.status(200).json({ ok: true, ...resumo });
    } catch (error) {
        console.error("[djen-sync] Erro:", error);
        return response.status(500).json({
            ok: false,
            message: error instanceof Error ? error.message : "Erro ao verificar publicações do DJEN.",
        });
    }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
    return handleDjenSync(request, response);
}
