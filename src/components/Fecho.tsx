import type { ReactNode } from "react";
import { Cta } from "@/components/Cta";
import { HOURS } from "@/lib/contact";

interface FechoProps {
    title: ReactNode;
    text: string;
    /** Mensagem que já vai escrita no WhatsApp. */
    message?: string;
    cta?: string;
}

/** Fecho da página: a faixa dourada com o convite para mandar o documento. */
export const Fecho = ({
    title,
    text,
    message = "Olá! Quero mandar um documento para o Ian dar uma olhada.",
    cta = "Abrir o WhatsApp",
}: FechoProps) => (
    <section className="bg-gold-light text-ink">
        <div className="container grid gap-x-12 gap-y-10 py-20 md:py-28 lg:grid-cols-12 lg:items-end">
            <h2 className="display text-[clamp(2.5rem,6vw,5rem)] lg:col-span-7">{title}</h2>
            <div className="lg:col-span-5">
                <p className="max-w-[44ch] text-lg leading-relaxed">{text}</p>
                <Cta variant="ink" whatsapp={message} className="mt-8 w-full sm:w-auto">
                    {cta}
                </Cta>
                <p className="mt-5 text-sm font-medium">{HOURS}. Presencial em Petrolina-PE ou online.</p>
            </div>
        </div>
    </section>
);
