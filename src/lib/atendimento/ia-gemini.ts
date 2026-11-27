/**
 * Chamada ao Gemini (Google AI Studio) com resposta em JSON — usada quando o escritório escolhe um
 * modelo "gemini-*" no site (pensado para TESTES com a chave gratuita). Somente servidor.
 *
 * Atenção: no plano gratuito do Gemini o Google pode usar o conteúdo enviado para melhorar os
 * produtos dele. Use só com dados fictícios; para clientes reais, use Claude ou um plano pago.
 */

export interface ParteGemini {
    text?: string;
    inline_data?: { mime_type: string; data: string };
}

export interface ResultadoGemini {
    /** "ok" | "max_tokens" | "refusal" (bloqueio de segurança ou outro motivo de parada). */
    parada: "ok" | "max_tokens" | "refusal";
    json: unknown;
    modelo: string;
}

const RETENTAVEIS = new Set([404, 429, 500, 502, 503, 504]);

export function chaveGemini(env: Record<string, string | undefined> = process.env): string {
    return (env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY ?? "").trim();
}

export async function chamarGeminiJson(opts: {
    modelo: string;
    sistema: string;
    partes: ParteGemini[];
    schema: Record<string, unknown>;
    maxTokens: number;
    apiKey?: string;
    fetchFn?: typeof fetch;
    timeoutMs?: number;
}): Promise<ResultadoGemini> {
    const apiKey = opts.apiKey ?? chaveGemini();
    if (!apiKey) throw new Error("Configure a chave GEMINI_API_KEY no servidor para usar os modelos Gemini.");
    const fetchFn = opts.fetchFn ?? fetch;
    const corpo = JSON.stringify({
        systemInstruction: { parts: [{ text: opts.sistema }] },
        contents: [{ role: "user", parts: opts.partes }],
        generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: opts.schema,
            maxOutputTokens: opts.maxTokens,
        },
    });

    let res: Response | null = null;
    // Uma nova tentativa rápida: o Gemini às vezes devolve 404/503 passageiro nos aliases "-latest".
    for (let tentativa = 0; tentativa < 2; tentativa++) {
        try {
            res = await fetchFn(
                `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.modelo)}:generateContent`,
                {
                    method: "POST",
                    signal: AbortSignal.timeout(opts.timeoutMs ?? 40_000),
                    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
                    body: corpo,
                },
            );
        } catch (err) {
            if ((err as Error).name === "TimeoutError") throw new Error("O Gemini demorou demais para responder.");
            if (tentativa === 0) continue;
            throw new Error("Não foi possível falar com o Gemini agora.");
        }
        if (res.ok || !RETENTAVEIS.has(res.status) || tentativa === 1) break;
        await new Promise((r) => setTimeout(r, 800));
    }
    if (!res) throw new Error("Não foi possível falar com o Gemini agora.");

    const dados = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
        const e = (dados.error ?? {}) as { message?: string; status?: string };
        if (res.status === 400 && /api key/i.test(e.message ?? "")) throw new Error("Chave GEMINI_API_KEY inválida.");
        if (res.status === 429) throw new Error("Limite do plano gratuito do Gemini atingido. Tente de novo em instantes.");
        throw new Error(`Erro na API do Gemini (${res.status}${e.status ? ` ${e.status}` : ""}).`);
    }

    const modelo = typeof dados.modelVersion === "string" ? dados.modelVersion : opts.modelo;
    const bloqueio = (dados.promptFeedback as { blockReason?: string } | undefined)?.blockReason;
    const candidato = (Array.isArray(dados.candidates) ? dados.candidates[0] : null) as
        | { finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }
        | null;
    if (bloqueio || !candidato) return { parada: "refusal", json: null, modelo };

    const motivo = candidato.finishReason ?? "STOP";
    if (motivo === "MAX_TOKENS") return { parada: "max_tokens", json: null, modelo };
    if (motivo !== "STOP") return { parada: "refusal", json: null, modelo };

    const texto = (candidato.content?.parts ?? [])
        .filter((p) => !p.thought && typeof p.text === "string")
        .map((p) => p.text)
        .join("");
    let json: unknown = null;
    try {
        json = JSON.parse(texto);
    } catch {
        json = null;
    }
    return { parada: "ok", json, modelo };
}
