import React, { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mail, Phone, MapPin, Send, Loader2, Clock, Building2, ArrowRight } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

interface FormData {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
}

const sendEmail = async (data: FormData): Promise<boolean> => {
    // Simulação da API
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
            toast.success("Mensagem enviada com sucesso! Entraremos em contato.");
            setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
        } else {
            toast.error("Erro ao enviar. Por favor, tente pelo WhatsApp.");
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="min-h-screen bg-background font-sans selection:bg-accent selection:text-accent-foreground">
            <Navigation />

            {/* --- HERO SECTION: BG-PRIMARY (Padronizado) --- */}
            <section className="relative pt-36 pb-24 bg-primary text-primary-foreground overflow-hidden border-b border-primary-foreground/10">
                <div className="absolute inset-0 opacity-[0.05]"
                     style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl">
                        <div className="flex items-center gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="h-px w-12 bg-accent"></div>
                            <span className="text-accent font-bold tracking-widest uppercase text-[10px] border border-accent/30 px-3 py-1 bg-accent/10 rounded-full">
                                Fale Conosco
                            </span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight drop-shadow-xl text-primary-foreground animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                            Atendimento <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent/80 to-primary-foreground">
                                Personalizado
                            </span>
                        </h1>

                        <p className="text-xl text-primary-foreground/80 leading-relaxed max-w-2xl border-l-4 border-accent pl-6 rounded-sm animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                            Estamos prontos para ouvir seu caso e oferecer a melhor estratégia jurídica. Entre em contato pelos canais abaixo ou envie uma mensagem.
                        </p>
                    </div>
                </div>
            </section>

            {/* --- CONTEÚDO PRINCIPAL: BG-MUTED/20 --- */}
            <section className="py-24 bg-muted/20 relative">
                {/* Background Decorativo */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/5 via-transparent to-transparent pointer-events-none" />

                <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

                        {/* LADO ESQUERDO: Formulário Premium (7 colunas) */}
                        <div className="lg:col-span-7">
                            <div className="bg-card border border-border/60 p-8 md:p-10 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent to-accent/0 opacity-50"></div>

                                <h3 className="text-2xl font-bold text-foreground mb-2">Envie sua Mensagem</h3>
                                <p className="text-muted-foreground mb-8">Preencha o formulário para uma análise inicial do seu caso.</p>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="name" className="text-sm font-semibold text-foreground ml-1">Nome Completo</Label>
                                            <Input
                                                id="name"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                                className="bg-muted/50 border-border/50 h-14 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                                placeholder="Digite seu nome"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="phone" className="text-sm font-semibold text-foreground ml-1">Telefone / WhatsApp</Label>
                                            <Input
                                                id="phone"
                                                name="phone"
                                                type="tel"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                required
                                                className="bg-muted/50 border-border/50 h-14 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                                placeholder="(DDD) 00000-0000"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-sm font-semibold text-foreground ml-1">E-mail de Contato</Label>
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            className="bg-muted/50 border-border/50 h-14 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                            placeholder="seu@email.com"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="message" className="text-sm font-semibold text-foreground ml-1">Relato do Caso</Label>
                                        <Textarea
                                            id="message"
                                            name="message"
                                            value={formData.message}
                                            onChange={handleChange}
                                            rows={5}
                                            required
                                            className="bg-muted/50 border-border/50 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none p-4 transition-all"
                                            placeholder="Descreva brevemente sua situação para que possamos entender o contexto..."
                                        />
                                    </div>

                                    <Button type="submit" disabled={isLoading} size="xl" className="w-full h-14 text-lg bg-accent hover:bg-accent/90 text-primary font-bold rounded-full shadow-lg hover:scale-[1.01] transition-transform">
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
                        <div className="lg:col-span-5 space-y-8 sticky top-28">

                            {/* Card WhatsApp - AGORA DARK (Mais elegante) */}
                            <div
                                className="bg-primary text-primary-foreground rounded-[2.5rem] p-8 flex items-center gap-6 shadow-2xl hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden border border-primary-foreground/10"
                                onClick={() => window.open("https://wa.me/5587988448690", "_blank")}
                            >
                                {/* Glow Verde Sutil */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/20 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 group-hover:bg-green-500/30 transition-all duration-700"></div>

                                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm group-hover:bg-green-500 group-hover:text-white transition-all duration-300 shadow-inner border border-white/5">
                                    <FaWhatsapp className="w-8 h-8" />
                                </div>
                                <div className="relative z-10">
                                    <h4 className="text-xl font-bold mb-1 text-primary-foreground">WhatsApp Direto</h4>
                                    <p className="text-primary-foreground/60 text-sm mb-3">Resposta rápida para urgências.</p>
                                    <span className="font-bold text-lg text-accent flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                                        Iniciar Conversa <ArrowRight className="w-4 h-4" />
                                    </span>
                                </div>
                            </div>

                            {/* Info Blocks - Clean Style */}
                            <div className="space-y-4">
                                <div className="group flex gap-5 p-6 bg-card border border-border/60 rounded-[2rem] hover:border-accent/50 hover:shadow-md transition-all">
                                    <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-accent group-hover:text-primary transition-colors duration-300">
                                        <Building2 className="w-6 h-6 text-foreground group-hover:text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-foreground mb-1">Escritório Físico</h4>
                                        <p className="text-muted-foreground text-sm leading-relaxed">
                                            Av. Cardoso de Sá, n. 860, sala 5<br/>
                                            Centro Empresarial Sergio Cabral<br/>
                                            Petrolina-PE
                                        </p>
                                    </div>
                                </div>

                                <div className="group flex gap-5 p-6 bg-card border border-border/60 rounded-[2rem] hover:border-accent/50 hover:shadow-md transition-all">
                                    <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-accent group-hover:text-primary transition-colors duration-300">
                                        <Mail className="w-6 h-6 text-foreground group-hover:text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-foreground mb-1">E-mail</h4>
                                        <a href="mailto:contato@iangranja.adv.br" className="text-muted-foreground text-sm hover:text-accent transition-colors block">
                                            contato@iangranja.adv.br
                                        </a>
                                        <span className="text-xs text-muted-foreground/60 mt-1 block">Envio de documentos</span>
                                    </div>
                                </div>

                                <div className="group flex gap-5 p-6 bg-card border border-border/60 rounded-[2rem] hover:border-accent/50 hover:shadow-md transition-all">
                                    <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-accent group-hover:text-primary transition-colors duration-300">
                                        <Clock className="w-6 h-6 text-foreground group-hover:text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-foreground mb-1">Horário</h4>
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

            {/* --- MAPA: BG-PRIMARY CONTAINER --- */}
            <section className="py-12 bg-background">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="h-[450px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border border-border/50 relative group bg-muted">
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
                        {/* Overlay para dar acabamento nas bordas */}
                        <div className="absolute inset-0 pointer-events-none rounded-[2.5rem] shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]"></div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default Contato;