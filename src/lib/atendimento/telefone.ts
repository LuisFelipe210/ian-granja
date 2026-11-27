/**
 * Telefones de WhatsApp e janela de 24h da Meta. Sem dependências de Node: usado também no navegador.
 */

/* ------------------------------------------------------------------ Telefones */

/** Só dígitos, com DDI. Número brasileiro sem DDI (10 ou 11 dígitos) ganha o 55. */
export function normalizarTelefone(raw: string): string {
    let d = String(raw ?? "").replace(/\D/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    if (d.length === 10 || d.length === 11) d = `55${d}`;
    return d;
}

/**
 * Chave para comparar números brasileiros. A Meta às vezes manda o celular SEM o nono dígito
 * (5581 8765-4321), e o cadastro costuma ter COM ele (81 98765-4321): os dois viram 55 + DDD + 8 finais.
 */
export function chaveTelefone(raw: string): string {
    const d = normalizarTelefone(raw);
    if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return `55${d.slice(2, 4)}${d.slice(-8)}`;
    return d;
}

export function telefoneLegivel(raw: string): string {
    const d = normalizarTelefone(raw);
    const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d);
    return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d ? `+${d}` : "";
}

/* ------------------------------------------------------------------ Janela de 24h */

export const JANELA_ATENDIMENTO_MS = 24 * 60 * 60 * 1000;

export function dentroDaJanela(ultimaMensagemClienteEm: string | null | undefined, agora = Date.now()): boolean {
    const t = Date.parse(ultimaMensagemClienteEm ?? "");
    return Number.isFinite(t) && agora - t < JANELA_ATENDIMENTO_MS;
}
