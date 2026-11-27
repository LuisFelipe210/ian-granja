import { obterSessaoAtiva } from "@/lib/revisional-db";

/** Chama /api/atendimento-ia com a sessão do usuário (navegador). */
export async function chamarAtendimento<T>(corpo: Record<string, unknown>): Promise<T> {
    const sessao = await obterSessaoAtiva();
    if (!sessao) throw new Error("Sessão expirada. Entre novamente.");
    const res = await fetch("/api/atendimento-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessao.accessToken}` },
        body: JSON.stringify(corpo),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string } & T;
    if (!res.ok || !json.ok) throw new Error(json.message || `Falha no atendimento por IA (${res.status}).`);
    return json;
}
