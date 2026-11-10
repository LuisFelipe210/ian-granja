import { useRef, type ReactNode } from "react";
import { useInView } from "motion/react";
import { cn } from "@/lib/utils";

interface GrifoProps {
    children: ReactNode;
    /** Atraso em ms antes de o marca-texto correr. */
    delay?: number;
    className?: string;
}

/** Trecho grifado: o marca-texto dourado corre sobre o texto quando ele entra na tela. */
export const Grifo = ({ children, delay = 0, className }: GrifoProps) => {
    const ref = useRef<HTMLElement>(null);
    const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });

    return (
        <mark
            ref={ref}
            data-on={inView}
            className={cn("grifo", className)}
            style={{ transitionDelay: `${delay}ms, ${delay + 120}ms` }}
        >
            {children}
        </mark>
    );
};
