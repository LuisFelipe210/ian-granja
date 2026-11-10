import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { PageHero } from "@/components/PageHero";
import { Grifo } from "@/components/Grifo";
import { HeroArt } from "@/components/HeroArt";
import { Cta } from "@/components/Cta";
import { ADDRESS_LINES, EMAIL, HOURS, MAPS_EMBED, PHONE_DISPLAY, PHONE_HREF } from "@/lib/contact";

interface FormData {
    name: string;
    email: string;
    phone: string;
    message: string;
}

const emptyForm: FormData = { name: "", email: "", phone: "", message: "" };

const sendEmail = async (data: FormData): Promise<boolean> => {
    try {
        const response = await fetch("/api/send-contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, subject: "Contato pelo site" }),
        });
        return response.ok;
    } catch {
        return false;
    }
};

const labelClass = "block text-sm font-semibold text-ink";

const Contato = () => {
    const [formData, setFormData] = useState<FormData>(emptyForm);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const success = await sendEmail(formData);
        setIsLoading(false);

        if (success) {
            toast.success("Mensagem enviada. Entraremos em contato.");
            setFormData(emptyForm);
        } else {
            toast.error("Não foi possível enviar agora. Sua mensagem continua no formulário: tente de novo ou fale pelo WhatsApp.");
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="min-h-screen bg-background">
            <Navigation />

            <main>
                <PageHero
                    title={[
                        "Conte o que",
                        <>
                            <Grifo delay={900}>aconteceu.</Grifo>
                        </>,
                    ]}
                    lead="Estamos prontos para ouvir o seu caso. Fale pelo WhatsApp para uma resposta mais rápida ou preencha a ficha abaixo."
                    aside={
                        <div className="hidden items-center lg:flex">
                            <HeroArt variant="celular" className="mx-0 w-1/2 max-w-none lg:ml-0" />
                            <HeroArt variant="envelope" className="mx-0 w-1/2 max-w-none lg:ml-0" />
                        </div>
                    }
                />

                <section className="bg-background">
                    <div className="container grid gap-x-16 gap-y-14 py-20 md:py-28 lg:grid-cols-12">
                        <div className="lg:col-span-7">
                            <div className="sheet-on-paper px-6 py-8 sm:px-10 sm:py-10">
                                <h2 className="subdisplay text-3xl text-ink">Ficha de atendimento</h2>
                                <p className="mt-3 text-muted-foreground">
                                    Preencha para uma análise inicial do seu caso. Todos os campos são necessários.
                                </p>

                                <form onSubmit={handleSubmit} className="mt-9 space-y-7">
                                    <div className="grid gap-7 md:grid-cols-2">
                                        <div>
                                            <label htmlFor="name" className={labelClass}>Nome completo</label>
                                            <input
                                                id="name"
                                                name="name"
                                                autoComplete="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                                className="field"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="phone" className={labelClass}>Telefone ou WhatsApp</label>
                                            <input
                                                id="phone"
                                                name="phone"
                                                type="tel"
                                                autoComplete="tel"
                                                inputMode="tel"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                required
                                                placeholder="(87) 90000-0000"
                                                className="field"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="email" className={labelClass}>E-mail</label>
                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            placeholder="voce@email.com"
                                            className="field"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="message" className={labelClass}>Relato do caso</label>
                                        <textarea
                                            id="message"
                                            name="message"
                                            value={formData.message}
                                            onChange={handleChange}
                                            rows={5}
                                            required
                                            placeholder="Descreva brevemente o que aconteceu."
                                            className="field resize-y"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="inline-flex min-h-14 w-full items-center justify-center gap-3 bg-ink px-7 text-base font-semibold text-paper transition-colors duration-200 hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                                    >
                                        {isLoading && <Loader2 aria-hidden className="size-5 animate-spin" />}
                                        {isLoading ? "Enviando" : "Enviar ficha"}
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div className="lg:col-span-5">
                            <div className="bg-ink p-8 text-paper">
                                <h2 className="subdisplay text-2xl">Mais rápido pelo WhatsApp</h2>
                                <p className="mt-4 leading-relaxed text-paper/80">
                                    Mande uma foto do documento ou conte o que aconteceu.
                                </p>
                                <Cta whatsapp="Olá! Gostaria de falar com um advogado." className="mt-7 w-full">
                                    Iniciar conversa
                                </Cta>
                            </div>

                            <dl className="mt-10 border-t border-ink/25">
                                <div className="border-b border-ink/25 py-6">
                                    <dt className="text-sm font-semibold text-muted-foreground">Escritório</dt>
                                    <dd className="mt-2 text-lg leading-relaxed text-ink">
                                        <address className="not-italic">
                                            {ADDRESS_LINES.map((line) => (
                                                <span key={line} className="block">{line}</span>
                                            ))}
                                        </address>
                                    </dd>
                                </div>
                                <div className="border-b border-ink/25 py-6">
                                    <dt className="text-sm font-semibold text-muted-foreground">E-mail, para envio de documentos</dt>
                                    <dd className="mt-2 text-lg text-ink">
                                        <a href={`mailto:${EMAIL}`} className="underline decoration-gold decoration-2 hover:decoration-ink">
                                            {EMAIL}
                                        </a>
                                    </dd>
                                </div>
                                <div className="border-b border-ink/25 py-6">
                                    <dt className="text-sm font-semibold text-muted-foreground">Telefone</dt>
                                    <dd className="mt-2 text-lg text-ink">
                                        <a href={PHONE_HREF} className="underline decoration-gold decoration-2 hover:decoration-ink">
                                            {PHONE_DISPLAY}
                                        </a>
                                    </dd>
                                </div>
                                <div className="border-b border-ink/25 py-6">
                                    <dt className="text-sm font-semibold text-muted-foreground">Horário</dt>
                                    <dd className="mt-2 text-lg text-ink">{HOURS}. Atendimento online disponível.</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </section>

                <section className="bg-background pb-20 md:pb-28">
                    <div className="container">
                        <div className="sheet-on-paper p-3">
                            <iframe
                                src={MAPS_EMBED}
                                title="Mapa com a localização do escritório em Petrolina-PE"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                className="block h-[420px] w-full border-0 grayscale"
                            />
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
};

export default Contato;
