import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

interface RiseProps {
    children: ReactNode;
    /** Atraso em segundos. */
    delay?: number;
    className?: string;
}

/** Uma linha de título que sobe de trás de uma máscara ao carregar. */
export const Rise = ({ children, delay = 0, className }: RiseProps) => {
    const reduce = useReducedMotion();

    return (
        <span className={cn("-mx-[0.2em] -mb-[0.12em] block overflow-hidden px-[0.2em] pb-[0.12em]", className)}>
            <motion.span
                className="block"
                initial={reduce ? false : { y: "108%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.95, ease: EASE, delay }}
            >
                {children}
            </motion.span>
        </span>
    );
};

interface PageHeroProps {
    /** Linhas do título; cada uma sobe em sequência. */
    title: ReactNode[];
    lead?: string;
    /** Conteúdo acima do título, como a trilha de navegação. */
    before?: ReactNode;
    /** Coluna à direita, como uma folha ou o retrato. */
    aside?: ReactNode;
    /** Ilustração decorativa numa coluna estreita à direita; some em telas pequenas. */
    art?: ReactNode;
    /** Troca o tamanho padrão do título, para palavras longas que não cabem na coluna. */
    titleClassName?: string;
    children?: ReactNode;
}

/** Cabeçalho das páginas internas: mesa azul, título largo e, se houver, uma folha ao lado. */
export const PageHero = ({ title, lead, before, aside, art, titleClassName, children }: PageHeroProps) => (
    <section className="overflow-hidden bg-ink text-paper">
        <div
            className={cn(
                "container grid gap-x-12 gap-y-14 pb-16 pt-32 md:pb-24 md:pt-44 lg:grid-cols-12",
                art ? "lg:items-center" : "lg:items-start",
            )}
        >
            <div className={aside ? "lg:col-span-6" : art ? "lg:col-span-8" : "lg:col-span-10"}>
                {before}
                <h1 className={cn("display", titleClassName ?? "text-[clamp(2.5rem,5.6vw,4.75rem)]")}>
                    {title.map((line, i) => (
                        <Rise key={i} delay={i * 0.09}>
                            {line}
                        </Rise>
                    ))}
                </h1>
                {lead && <p className="mt-8 max-w-[54ch] text-lg leading-relaxed text-paper/80">{lead}</p>}
                {children}
            </div>
            {aside && <div className="lg:col-span-6">{aside}</div>}
            {art && <div className="hidden lg:col-span-4 lg:block">{art}</div>}
        </div>
    </section>
);
