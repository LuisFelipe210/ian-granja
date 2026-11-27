import { useEffect, useMemo, useRef, useState } from "react";

/** Estado de paginação de uma lista em memória (usado com <BarraPaginacao>). */
export interface EstadoPaginacao<T> {
    pagina: number;
    porPagina: number;
    totalPaginas: number;
    total: number;
    /** Índice (0) do primeiro item da página. */
    inicio: number;
    /** Índice (exclusivo) do fim da página. */
    fim: number;
    itensPagina: T[];
    irPara: (pagina: number) => void;
    mudarPorPagina: (n: number) => void;
}

export function usePaginacao<T>(
    itens: T[],
    {
        porPaginaPadrao = 20,
        /** Qualquer valor que, ao mudar, volta para a página 1 (busca, filtros, aba). */
        reiniciarCom,
    }: { porPaginaPadrao?: number; reiniciarCom?: unknown } = {},
): EstadoPaginacao<T> {
    const [pagina, setPagina] = useState(1);
    const [porPagina, setPorPagina] = useState(porPaginaPadrao);

    const chave = JSON.stringify(reiniciarCom ?? null);
    const chaveAnterior = useRef(chave);
    useEffect(() => {
        if (chaveAnterior.current === chave) return;
        chaveAnterior.current = chave;
        setPagina(1);
    }, [chave]);

    const porPaginaSeguro = Math.max(1, Math.floor(porPagina) || 1);
    const total = itens.length;
    const totalPaginas = Math.max(1, Math.ceil(total / porPaginaSeguro));
    // Lista encolheu (item excluído, filtro): não fica numa página que não existe mais.
    const paginaSegura = Math.min(pagina, totalPaginas);
    const inicio = (paginaSegura - 1) * porPaginaSeguro;
    const fim = Math.min(total, inicio + porPaginaSeguro);
    const itensPagina = useMemo(() => itens.slice(inicio, fim), [itens, inicio, fim]);

    return {
        pagina: paginaSegura,
        porPagina: porPaginaSeguro,
        totalPaginas,
        total,
        inicio,
        fim,
        itensPagina,
        irPara: (p) => setPagina(Math.min(Math.max(1, p), totalPaginas)),
        mudarPorPagina: (n) => {
            setPorPagina(Math.max(1, Math.floor(n) || 1));
            setPagina(1);
        },
    };
}

/** [1, "…", 4, 5, 6, "…", 12] */
export function numerosPaginas(atual: number, total: number): Array<number | "…"> {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const nums = new Set([1, total, atual - 1, atual, atual + 1]);
    if (atual <= 3) [2, 3, 4].forEach((n) => nums.add(n));
    if (atual >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => nums.add(n));
    const ordenados = [...nums].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    const out: Array<number | "…"> = [];
    ordenados.forEach((n, i) => {
        if (i > 0 && n - ordenados[i - 1] > 1) out.push("…");
        out.push(n);
    });
    return out;
}

