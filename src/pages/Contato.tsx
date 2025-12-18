import React, { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mail, Phone, MapPin, Send, Loader2, Clock } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

interface FormData {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
}

const sendEmail = async (data: FormData): Promise<boolean> => {
    // Simulação da API - Substitua pela sua rota real
    return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
};

const Contato = () => {
    const [formData, setFormData] = useState<FormData>({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
    });

    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const success = await sendEmail(formData);
        setIsLoading(false);

        if (success) {
            toast.success("Mensagem enviada! Retornaremos em breve.");
            setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
        } else {
            toast.error("Erro ao enviar. Tente pelo WhatsApp.");
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="min-h-screen bg-background font-sans selection:bg-accent selection:text-accent-foreground">
            <Navigation />

            {/* --- HERO SECTION: Premium Dark --- */}
            <section className="relative pt-32 pb-24 bg-primary text-white overflow-hidden border-b border-white/5">
                <div className="absolute inset-0 opacity-[0.05]"
                     style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-px w-12 bg-accent"></div>
                            <span className="text-accent font-medium tracking-[0.2em] uppercase text-xs">Fale Conosco</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight drop-shadow-xl">
                            Atendimento <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-white">
                                Personalizado
                            </span>
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed max-w-2xl border-l-4 border-accent/20 pl-6 rounded-sm">
                            Estamos prontos para ouvir seu caso e oferecer a melhor estratégia jurídica. Entre em contato pelos canais abaixo ou envie uma mensagem.
                        </p>
                    </div>
                </div>
            </section>

            {/* --- CONTEÚDO PRINCIPAL --- */}
            <section className="py-24 bg-background relative">
                {/* Background Decorativo */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-accent/5 via-background to-background pointer-events-none" />

                <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">

                        {/* LADO ESQUERDO: Formulário (7 colunas) */}
                        <div className="lg:col-span-7">
                            <div className="bg-card border border-border/60 p-8 md:p-12 rounded-[2rem] shadow-xl">
                                <h3 className="text-2xl font-bold text-foreground mb-2">Envie sua Mensagem</h3>
                                <p className="text-muted-foreground mb-8">Preencha o formulário abaixo e entraremos em contato.</p>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="name" className="text-sm font-medium text-foreground ml-1">Nome Completo</Label>
                                            <Input id="name" name="name" value={formData.name} onChange={handleChange} required className="bg-background border-border/50 h-12 rounded-xl focus:ring-accent focus:border-accent" placeholder="Digite seu nome" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="phone" className="text-sm font-medium text-foreground ml-1">Telefone / WhatsApp</Label>
                                            <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} required className="bg-background border-border/50 h-12 rounded-xl focus:ring-accent focus:border-accent" placeholder="(DDD) 00000-0000" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-sm font-medium text-foreground ml-1">E-mail Profissional</Label>
                                        <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required className="bg-background border-border/50 h-12 rounded-xl focus:ring-accent focus:border-accent" placeholder="seu@email.com" />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="message" className="text-sm font-medium text-foreground ml-1">Relato do Caso</Label>
                                        <Textarea id="message" name="message" value={formData.message} onChange={handleChange} rows={5} required className="bg-background border-border/50 rounded-xl focus:ring-accent focus:border-accent resize-none p-4" placeholder="Descreva brevemente sua situação..." />
                                    </div>

                                    <Button type="submit" disabled={isLoading} className="w-full h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground rounded-full font-bold shadow-lg hover:scale-[1.02] transition-transform">
                                        {isLoading ? (
                                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</>
                                        ) : (
                                            <><Send className="mr-2 h-5 w-5" /> Enviar Solicitação</>
                                        )}
                                    </Button>
                                </form>
                            </div>
                        </div>

                        {/* LADO DIREITO: Informações de Contato (5 colunas) */}
                        <div className="lg:col-span-5 space-y-8">

                            {/* Card WhatsApp */}
                            <div
                                className="bg-[#25D366] text-white rounded-[2rem] p-8 flex items-center gap-6 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden"
                                onClick={() => window.open("https://wa.me/5587988448690", "_blank")}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>

                                <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                                    <FaWhatsapp className="w-8 h-8" />
                                </div>
                                <div className="relative z-10">
                                    <h4 className="text-xl font-bold mb-1">WhatsApp Direto</h4>
                                    <p className="text-white/90 text-sm mb-2">Resposta rápida para urgências.</p>
                                    <span className="font-bold text-lg border-b-2 border-white/40 pb-0.5 group-hover:border-white transition-colors">(87) 9 8844-8690</span>
                                </div>
                            </div>

                            {/* Info Blocks */}
                            <div className="space-y-4">
                                <div className="flex gap-5 p-6 bg-card border border-border/50 rounded-3xl hover:border-accent/30 transition-colors">
                                    <div className="w-12 h-12 bg-accent/10 flex items-center justify-center rounded-2xl shrink-0">
                                        <MapPin className="w-6 h-6 text-accent" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-foreground mb-2">Escritório Físico</h4>
                                        <p className="text-muted-foreground text-sm leading-relaxed">
                                            Av. Cardoso de Sá, n. 860, sala 5<br/>
                                            Cidade Universitária<br/>
                                            Centro Empresarial Sergio Cabral<br/>
                                            Petrolina-PE, CEP 56302-110
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-5 p-6 bg-card border border-border/50 rounded-3xl hover:border-accent/30 transition-colors">
                                    <div className="w-12 h-12 bg-accent/10 flex items-center justify-center rounded-2xl shrink-0">
                                        <Mail className="w-6 h-6 text-accent" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-foreground mb-2">E-mail</h4>
                                        <a href="mailto:contato@iangranja.adv.br" className="text-muted-foreground text-sm hover:text-accent transition-colors block">
                                            contato@iangranja.adv.br
                                        </a>
                                        <span className="text-xs text-muted-foreground/60 mt-1 block">Para envio de documentos e parcerias</span>
                                    </div>
                                </div>

                                <div className="flex gap-5 p-6 bg-card border border-border/50 rounded-3xl hover:border-accent/30 transition-colors">
                                    <div className="w-12 h-12 bg-accent/10 flex items-center justify-center rounded-2xl shrink-0">
                                        <Clock className="w-6 h-6 text-accent" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-foreground mb-2">Horário</h4>
                                        <p className="text-muted-foreground text-sm">
                                            Segunda a Sexta: <span className="font-semibold text-foreground">08h às 18h</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">Atendimento online disponível</p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </section>

            {/* --- MAPA: Arredondado --- */}
            <section className="pb-24 px-4 sm:px-6 lg:px-8 bg-background">
                <div className="container mx-auto">
                    <div className="h-[450px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white dark:border-zinc-800 relative group">
                        <iframe
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3947.5342426867015!2d-40.50570702581029!3d-9.379201590736173!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x7a2d04a60015099%3A0x6a2e4f04c64b611e!2sAv.%20Cardoso%20de%20S%C3%A1%2C%20860%20-%20Cidade%20Universit%C3%A1ria%2C%20Petrolina%20-%20PE%2C%2056302-110%2C%20Brasil!5e0!3m2!1spt-BR!2sus!4v1703632420459!5m2!1spt-BR!2sus"
                            width="100%"
                            height="100%"
                            style={{ border: 0, filter: "grayscale(100%) invert(0%)" }}
                            allowFullScreen={false}
                            loading="lazy"
                            title="Mapa"
                            className="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                        />
                        <div className="absolute inset-0 pointer-events-none border-[6px] border-white/10 rounded-[2.5rem] mix-blend-overlay"></div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default Contato;