import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
    INTERVALO_VERIFICACAO_DJEN_HORAS,
    OAB_ESCRITORIO_PADRAO,
    verificarPublicacoesDjen,
} from "../src/lib/juros/djen.ts";
import { RevisionalServerDb, type RevisionalDbAdapter } from "../src/lib/mcp/revisional-mcp-core.ts";
import { definirConfigEscritorio } from "../src/lib/config-escritorio.ts";
import type { ApiHttpRequest, ApiHttpResponse, OpcoesConfiancaApi } from "./claude-revisional.ts";
import { getHeader, timingSafeEqualStr } from "./_http.ts";

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
    response.setHeader?.("Cache-Control", "no-store, max-age=0");

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
        const auth = getHeader(request.headers, "authorization").trim();
        if (!timingSafeEqualStr(auth, `Bearer ${segredo}`)) {
            return response.status(401).json({ ok: false, message: "Unauthorized" });
        }
    }

    const db = options.db ?? new RevisionalServerDb({ fetchFn: options.fetchFn });
    const intervaloEnv = Number(process.env.DJEN_SYNC_INTERVALO_HORAS);
    const intervaloHoras =
        Number.isFinite(intervaloEnv) && intervaloEnv >= 0 ? intervaloEnv : INTERVALO_VERIFICACAO_DJEN_HORAS;

    try {
        const [calculos, categorias, tipos, cfgEscritorio] = await Promise.all([
            db.listarCalculos(),
            db.listarCategorias(),
            db.listarTipos ? db.listarTipos() : Promise.resolve([]),
            db.obterConfigEscritorio ? db.obterConfigEscritorio().catch(() => null) : Promise.resolve(null),
        ]);
        // Nome do advogado salvo em Configurações: usado para reconhecer as intimações dele.
        if (cfgEscritorio) definirConfigEscritorio(cfgEscritorio);
        const resultado = await verificarPublicacoesDjen({
            calculos,
            atualizar: (id, patch) => db.atualizarCalculo(id, patch),
            // Também varre pela OAB do escritório e cadastra em Processos os processos novos.
            varreduraOab: {
                numeroOab:
                    process.env.DJEN_OAB_NUMERO?.trim() || cfgEscritorio?.oabNumero || OAB_ESCRITORIO_PADRAO.numeroOab,
                ufOab: process.env.DJEN_OAB_UF?.trim() || cfgEscritorio?.oabUf || OAB_ESCRITORIO_PADRAO.ufOab,
                criar: (payload) => db.criarCalculo(payload),
                listarAtuais: () => db.listarCalculos(),
                ...(db.existeCalculoComProcesso
                    ? { existeProcesso: (cnj: string) => db.existeCalculoComProcesso!(cnj) }
                    : {}),
                categorias,
                tipos,
            },
            fetchFn: options.fetchFn,
            esperar: options.esperar,
            intervaloHoras,
            // Funções da Vercel têm teto de duração (maxDuration em vercel.json); o que sobrar fica
            // para a próxima execução, começando pelos processos verificados há mais tempo.
            orcamentoMs: 45_000,
        });

        const { atualizados: _atualizados, criados, ...resumo } = resultado;
        if (resumo.erros.length > 0) {
            console.error("[djen-sync] Falhas em processos:", resumo.erros);
        }
        return response.status(200).json({ ok: true, ...resumo, processosNovos: criados.length });
    } catch (error) {
        console.error("[djen-sync] Erro:", error);
        return response.status(500).json({
            ok: false,
            message: "Erro ao verificar publicações do DJEN.",
        });
    }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
    return handleDjenSync(request, response);
}
