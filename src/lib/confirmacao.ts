/**
 * Confirmação digitada (estilo GitHub) para ações que não têm volta.
 * Compara sem diferenciar maiúsculas, acentos e espaços repetidos.
 */
export function frasesIguais(digitado: string, esperado: string): boolean {
    const n = (s: string) =>
        s
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    return n(digitado) !== "" && n(digitado) === n(esperado);
}

/** Frase pedida para excluir clientes: o nome, se for um só; "excluir N clientes", se forem vários. */
export function fraseExclusaoClientes(nomes: string[]): string {
    return nomes.length === 1 ? nomes[0] : `excluir ${nomes.length} clientes`;
}
