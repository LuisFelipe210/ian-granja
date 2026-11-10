import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/contact";

type Variant = "gold" | "ink" | "line-light" | "line-dark";

const base =
    "group inline-flex min-h-14 items-center justify-center gap-3 px-7 py-3 text-base font-semibold transition-[background-color,color,border-color,transform] duration-200 ease-out active:translate-y-px";

const variants: Record<Variant, string> = {
    gold: "bg-gold-light text-ink hover:bg-paper-white",
    ink: "bg-ink text-paper hover:bg-ink-soft",
    "line-light": "border border-paper/40 text-paper hover:border-gold-light hover:text-gold-light",
    "line-dark": "border border-ink/40 text-ink hover:bg-ink hover:text-paper",
};

interface CtaProps {
    children: ReactNode;
    variant?: Variant;
    /** Rota interna. */
    to?: string;
    /** Link externo. */
    href?: string;
    /** Abre o WhatsApp com esta mensagem já escrita. */
    whatsapp?: string;
    className?: string;
}

export const Cta = ({ children, variant = "gold", to, href, whatsapp, className }: CtaProps) => {
    const classes = cn(base, variants[variant], className);

    if (to) {
        return (
            <Link to={to} className={classes}>
                {children}
                <ArrowRight
                    aria-hidden
                    className="size-4 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1"
                />
            </Link>
        );
    }

    const isWhatsapp = whatsapp !== undefined;

    return (
        <a
            href={isWhatsapp ? whatsappUrl(whatsapp || undefined) : href}
            target="_blank"
            rel="noopener noreferrer"
            className={classes}
        >
            {isWhatsapp && <FaWhatsapp aria-hidden className="size-5 shrink-0" />}
            {children}
        </a>
    );
};

interface TextLinkProps {
    to: string;
    children: ReactNode;
    className?: string;
}

/** Link de texto com seta, para ações secundárias. */
export const TextLink = ({ to, children, className }: TextLinkProps) => (
    <Link
        to={to}
        className={cn(
            "group inline-flex items-center gap-2 font-semibold underline decoration-gold decoration-2 underline-offset-[0.35em] transition-colors duration-200 hover:decoration-current",
            className,
        )}
    >
        {children}
        <ArrowRight
            aria-hidden
            className="size-4 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1"
        />
    </Link>
);
