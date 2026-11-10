import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Grifo } from "@/components/Grifo";
import type { LegalDoc } from "@/data/documents";

interface DocumentSheetProps {
    doc: LegalDoc;
    /** "side": notas na margem direita em telas médias; "below": sempre abaixo do trecho. */
    notes?: "side" | "below";
    className?: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/** Uma folha de documento com os trechos grifados e as notas em português claro. */
export const DocumentSheet = ({ doc, notes = "below", className }: DocumentSheetProps) => {
    const reduce = useReducedMotion();
    let marked = -1;

    return (
        <figure className={cn("sheet px-5 py-6 font-serif sm:px-9 sm:py-9", className)}>
            <div className="rubric flex items-baseline justify-between gap-6 border-b border-ink/25 pb-3">
                <span>{doc.kind}</span>
                <span className="shrink-0 text-ink/70">{doc.ref}</span>
            </div>

            <div className="mt-5 space-y-5 sm:mt-6 sm:space-y-6">
                {doc.clauses.map((clause, i) => {
                    if (clause.note) marked += 1;
                    const delay = 350 + marked * 750;

                    return (
                        <div
                            key={i}
                            className={cn(
                                "grid gap-x-7 gap-y-3",
                                notes === "side" && "md:grid-cols-[minmax(0,1fr)_12.5rem]",
                            )}
                        >
                            <p className="text-[0.8125rem] leading-[1.95] text-ink/75">
                                {clause.parts.map((part, j) =>
                                    typeof part === "string" ? (
                                        <span key={j}>{part}</span>
                                    ) : (
                                        <Grifo
                                            key={j}
                                            delay={delay}
                                            className="text-[1.0625rem] font-semibold leading-snug text-ink"
                                        >
                                            {part.mark}
                                        </Grifo>
                                    ),
                                )}
                            </p>

                            {clause.note && (
                                <motion.p
                                    initial={reduce ? false : { opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                                    transition={{ duration: 0.6, ease: EASE, delay: (delay + 450) / 1000 }}
                                    className={cn(
                                        "self-start bg-gold-light/30 px-4 py-3 font-sans text-[0.875rem] font-medium leading-snug text-ink",
                                        notes === "side" &&
                                            "md:border-t-2 md:border-gold md:bg-transparent md:px-0 md:pb-0 md:pt-2",
                                    )}
                                >
                                    {clause.note}
                                </motion.p>
                            )}
                        </div>
                    );
                })}
            </div>

            <figcaption className="mt-7 border-t border-ink/15 pt-3 font-sans text-xs text-ink/70">
                Documento ilustrativo. A leitura de verdade é feita no seu documento.
            </figcaption>
        </figure>
    );
};
