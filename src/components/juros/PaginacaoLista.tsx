import { type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { numerosPaginas } from "@/lib/use-paginacao";

/**
 * Paginação única do sistema: nenhuma lista cresce sem fim na tela.
 * - `usePaginacao` (src/lib/use-paginacao.ts) fatia a lista e volta para a página 1 quando os filtros mudam.
 * - `BarraPaginacao` mostra "1–20 de 45", itens por página e os números (com reticências).
 * - `variante="compacta"` serve para colunas do quadro e blocos pequenos: ‹ 1/3 ›.
 */

interface BarraPaginacaoProps {
    pagina: number;
    totalPaginas: number;
    total: number;
    inicio: number;
    fim: number;
    onPagina: (p: number) => void;
    porPagina?: number;
    onPorPagina?: (n: number) => void;
    opcoesPorPagina?: number[];
    /** "processos", "clientes"... usado no texto e na acessibilidade. */
    rotulo: string;
    variante?: "completa" | "compacta";
    /** Ao trocar de página, rola até o topo desta lista. */
    alvoRolagem?: RefObject<HTMLElement>;
    className?: string;
}

export function BarraPaginacao({
    pagina,
    totalPaginas,
    total,
    inicio,
    fim,
    onPagina,
    porPagina,
    onPorPagina,
    opcoesPorPagina = [10, 20, 50],
    rotulo,
    variante = "completa",
    alvoRolagem,
    className,
}: BarraPaginacaoProps) {
    if (total === 0) return null;

    const ir = (p: number) => {
        onPagina(p);
        const alvo = alvoRolagem?.current;
        if (alvo) {
            const topo = alvo.getBoundingClientRect().top;
            // Só rola se o começo da lista saiu da tela (header fixo de 56px).
            if (topo < 64) window.scrollBy({ top: topo - 72, behavior: "smooth" });
        }
    };

    const botaoSeta =
        "inline-flex items-center justify-center border border-ink/25 font-semibold text-ink transition-colors duration-150 hover:bg-ink/5 disabled:opacity-35 disabled:hover:bg-transparent";

    if (variante === "compacta") {
        if (totalPaginas <= 1) return null;
        return (
            <nav
                aria-label={`Paginação de ${rotulo}`}
                className={cn("flex items-center justify-between gap-2 text-[11px] tabular-nums", className)}
            >
                <span className="text-muted-foreground">
                    {inicio + 1}–{fim} de {total}
                </span>
                <span className="inline-flex items-center gap-1">
                    <button
                        type="button"
                        disabled={pagina <= 1}
                        onClick={() => ir(pagina - 1)}
                        aria-label="Página anterior"
                        className={cn(botaoSeta, "size-6")}
                    >
                        <ChevronLeft className="size-3.5" />
                    </button>
                    <span className="min-w-[2.5rem] text-center font-semibold text-ink">
                        {pagina}/{totalPaginas}
                    </span>
                    <button
                        type="button"
                        disabled={pagina >= totalPaginas}
                        onClick={() => ir(pagina + 1)}
                        aria-label="Próxima página"
                        className={cn(botaoSeta, "size-6")}
                    >
                        <ChevronRight className="size-3.5" />
                    </button>
                </span>
            </nav>
        );
    }

    return (
        <div className={cn("flex flex-wrap items-center justify-between gap-3 px-1 text-xs tabular-nums", className)}>
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                <span>
                    Mostrando <strong className="text-ink">{inicio + 1}</strong>–<strong className="text-ink">{fim}</strong>{" "}
                    de <strong className="text-ink">{total}</strong> {rotulo}
                </span>
                {porPagina !== undefined && onPorPagina && (
                    <label className="inline-flex items-center gap-1.5">
                        <span>Por página:</span>
                        <select
                            value={porPagina}
                            onChange={(e) => onPorPagina(Number(e.target.value))}
                            aria-label={`Quantidade de ${rotulo} por página`}
                            className="h-7 border border-ink/25 bg-background px-2 font-semibold text-ink"
                        >
                            {opcoesPorPagina.map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>

            {totalPaginas > 1 && (
                <nav aria-label={`Paginação de ${rotulo}`} className="inline-flex flex-wrap items-center gap-1">
                    <button
                        type="button"
                        disabled={pagina <= 1}
                        onClick={() => ir(pagina - 1)}
                        className={cn(botaoSeta, "h-8 gap-1 px-2.5")}
                    >
                        <ChevronLeft className="size-3.5" />
                        <span className="hidden sm:inline">Anterior</span>
                    </button>
                    {numerosPaginas(pagina, totalPaginas).map((n, i) =>
                        n === "…" ? (
                            <span key={`r${i}`} aria-hidden className="px-1 text-muted-foreground">
                                …
                            </span>
                        ) : (
                            <button
                                key={n}
                                type="button"
                                aria-current={n === pagina ? "page" : undefined}
                                aria-label={`Página ${n}`}
                                onClick={() => ir(n)}
                                className={cn(
                                    "inline-flex size-8 items-center justify-center border font-bold transition-colors duration-150",
                                    n === pagina ? "border-ink bg-ink text-paper" : "border-ink/25 text-ink hover:bg-ink/5",
                                )}
                            >
                                {n}
                            </button>
                        ),
                    )}
                    <button
                        type="button"
                        disabled={pagina >= totalPaginas}
                        onClick={() => ir(pagina + 1)}
                        className={cn(botaoSeta, "h-8 gap-1 px-2.5")}
                    >
                        <span className="hidden sm:inline">Próxima</span>
                        <ChevronRight className="size-3.5" />
                    </button>
                </nav>
            )}
        </div>
    );
}
