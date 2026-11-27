import { cn } from "@/lib/utils";

interface PastaClienteProps {
    nome: string;
    quantidade: number;
    /** Data da última edição já formatada para exibição. */
    ultimaEdicao: string;
    pendentes: number;
    /** Títulos dos documentos mais recentes (o primeiro aparece na folha da frente). */
    titulos: string[];
    onAbrir: () => void;
}

// Posição de cada folha, da mais funda para a da frente. No hover elas sobem e se abrem em leque.
const FOLHAS = [
    "translate-x-3 rotate-[2.5deg] motion-safe:group-hover:-translate-y-2 motion-safe:group-hover:translate-x-5 motion-safe:group-hover:rotate-[6deg]",
    "-translate-x-1.5 -rotate-[2deg] motion-safe:group-hover:-translate-y-3 motion-safe:group-hover:-translate-x-3 motion-safe:group-hover:-rotate-[5deg]",
    "motion-safe:group-hover:-translate-y-4",
];

/** Cartão em forma de pasta para a visão "Pastas" da lista de documentos. */
export function PastaCliente({ nome, quantidade, ultimaEdicao, pendentes, titulos, onAbrir }: PastaClienteProps) {
    const nFolhas = Math.min(3, Math.max(1, quantidade));
    const folhas = FOLHAS.slice(FOLHAS.length - nFolhas);

    return (
        <button
            type="button"
            onClick={onAbrir}
            aria-label={`Abrir pasta de ${nome}: ${quantidade} ${quantidade === 1 ? "documento" : "documentos"}${
                pendentes > 0 ? `, ${pendentes} ${pendentes === 1 ? "campo" : "campos"} a preencher` : ""
            }`}
            className="group relative block w-full pt-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
        >
            {/* Aba da pasta */}
            <span
                aria-hidden
                className="absolute left-0 top-0 h-3.5 w-2/5 border border-b-0 border-gold/45 bg-[#e6dcc6] transition-colors duration-200 [clip-path:polygon(0_0,calc(100%-12px)_0,100%_100%,0_100%)] group-hover:bg-[#e0d3b6]"
            />
            {/* Fundo da pasta */}
            <span
                aria-hidden
                className="relative block h-44 border border-gold/45 bg-[#e6dcc6] transition-colors duration-200 group-hover:bg-[#e0d3b6]"
            >
                {/* Folhas */}
                <span className="absolute inset-x-4 bottom-10 top-2.5">
                    {folhas.map((pos, i) => {
                        const daFrente = i === folhas.length - 1;
                        return (
                            <span
                                key={pos}
                                className={cn(
                                    "absolute inset-0 border border-ink/10 bg-white px-3 pt-2.5 shadow-[0_1px_2px_rgba(6,18,55,0.08)] transition-transform duration-300 ease-out",
                                    pos,
                                )}
                            >
                                {daFrente && (
                                    <>
                                        <span className="block truncate font-serif text-[9px] font-semibold leading-tight text-ink/70">
                                            {titulos[0] ?? ""}
                                        </span>
                                        <span className="mt-1.5 block h-[3px] w-11/12 bg-ink/10" />
                                        <span className="mt-1 block h-[3px] w-4/5 bg-ink/10" />
                                        <span className="mt-1 block h-[3px] w-2/3 bg-ink/10" />
                                    </>
                                )}
                            </span>
                        );
                    })}
                </span>

                {/* Frente da pasta */}
                <span className="absolute inset-x-0 bottom-0 flex h-[60%] flex-col justify-between border-t border-gold/60 bg-card px-4 pb-3 pt-2.5 shadow-[0_-8px_16px_-12px_rgba(6,18,55,0.35)] transition-transform duration-300 ease-out motion-safe:group-hover:translate-y-0.5">
                    <span className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug text-ink">{nome}</span>
                        {pendentes > 0 && (
                            <span className="shrink-0 border border-destructive/30 bg-destructive/[0.06] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums leading-none text-destructive">
                                {pendentes} {pendentes === 1 ? "pendente" : "pendentes"}
                            </span>
                        )}
                    </span>
                    <span className="min-w-0 text-xs text-muted-foreground">
                        <span className="font-semibold tabular-nums text-ink">{quantidade}</span>{" "}
                        {quantidade === 1 ? "documento" : "documentos"}
                        <span className="block truncate">Editado em {ultimaEdicao}</span>
                    </span>
                </span>
            </span>
        </button>
    );
}
