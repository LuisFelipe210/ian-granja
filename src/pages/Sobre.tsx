import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import lawyerPortrait from "@/assets/lawyer-portrait.jpg";
import {
    Target,
    Users,
    Scale,
    Briefcase,
    Sparkles,
    TrendingUp,
    MapPin,
    Award,
    CheckCircle2,
    ArrowRight
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Sobre = () => {
    const values = [
        {
            icon: Scale,
            title: "Ética Inegociável",
            description: "Transparência absoluta em cada etapa do processo. A confiança é a base da nossa atuação.",
        },
        {
            icon: Target,
            title: "Foco no Resultado",
            description: "Estratégias jurídicas desenhadas sob medida para alcançar a melhor resolução possível.",
        },
        {
            icon: Users,
            title: "Atendimento Humanizado",
            description: "Entendemos que por trás de cada processo existem pessoas, histórias e expectativas.",
        },
        {
            icon: Briefcase,
            title: "Excelência Técnica",
            description: "Atualização constante e profundidade teórica para enfrentar os casos mais complexos.",
        },
    ];

    const specialization = [
        "Bacharelado em Direito com Láurea Acadêmica",
        "OAB/PE nº 61.107 — Registro Ativo e Regular",
        "Especialista em Direito Bancário e do Consumidor",
        "Consultoria Jurídica Empresarial Estratégica",
    ];

    const addressDetails = {
        address: "Avenida Cardoso de Sá, n. 860, sala 5, Cidade Universitária, Centro Empresarial Sergio Cabral, CEP 56302-110, Petrolina-PE",
        iframeSrc: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3936.588698774776!2d-40.5042!3d-9.3956!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zOcKwMjMnNDQuMiJTIDQwwrAzMCcxNS4xIlc!5e0!3m2!1spt-BR!2sbr!4v1600000000000!5m2!1spt-BR!2sbr", // Lembre-se de por o link HTTPS real aqui
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
                            <span className="text-accent font-medium tracking-[0.2em] uppercase text-xs">Sobre o Escritório</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight drop-shadow-xl">
                            Defesa Técnica & <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-white">
                                Estratégia Jurídica
                            </span>
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed max-w-2xl border-l-4 border-accent/20 pl-6 rounded-sm">
                            Muito mais que um escritório de advocacia. Somos parceiros estratégicos na proteção do seu patrimônio e dos seus direitos.
                        </p>
                    </div>
                </div>
            </section>

            {/* --- BIO & FOTO: Design Fluido --- */}
            <section className="py-24 bg-white">
                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-center">

                        {/* Foto Arredondada e Colorida */}
                        <div className="lg:col-span-5 relative group order-2 lg:order-1">
                            {/* Elemento decorativo de fundo */}
                            <div className="absolute top-4 -left-4 w-full h-full border-2 border-accent/20 rounded-[2.5rem] z-0 group-hover:top-2 group-hover:-left-2 transition-all duration-500"></div>

                            <div className="relative z-10 bg-muted aspect-[3/4] overflow-hidden rounded-[2.5rem] shadow-2xl">
                                <img
                                    src={lawyerPortrait}
                                    alt="Ian Granja Advogado"
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                {/* Overlay sutil no bottom para contraste se precisar */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60"></div>
                            </div>
                        </div>

                        {/* Texto Institucional */}
                        <div className="lg:col-span-7 space-y-8 order-1 lg:order-2">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-accent/20">
                                    <TrendingUp className="w-3 h-3" />
                                    Fundador & Advogado Sênior
                                </div>
                                <h2 className="text-4xl font-bold text-foreground mb-4">
                                    Ian Granja
                                </h2>
                                <p className="text-lg text-muted-foreground leading-relaxed">
                                    Com 5 anos de atuação sólida no mercado jurídico, fundei o escritório com uma premissa clara:
                                    <span className="text-foreground font-semibold"> o Direito não precisa ser complicado, ele precisa ser efetivo.</span>
                                </p>
                            </div>

                            <div className="space-y-4">
                                <p className="text-muted-foreground leading-relaxed">
                                    Minha trajetória é marcada pela defesa intransigente dos interesses dos meus clientes, combinando rigor técnico acadêmico com uma visão prática e resolutiva dos tribunais.
                                </p>
                                <div className="p-6 bg-muted/30 border-l-4 border-accent rounded-r-2xl">
                                    <p className="text-foreground italic font-medium leading-relaxed">
                                        "Não vendemos processos. Entregamos segurança jurídica e tranquilidade para que você possa focar no que realmente importa na sua vida."
                                    </p>
                                </div>
                            </div>

                            {/* Lista de Credenciais */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                                {specialization.map((item, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                                        <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                                        </div>
                                        <span className="text-sm text-foreground/80 leading-snug">{item}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-6">
                                <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-8 h-12 shadow-lg hover:shadow-xl transition-all" asChild>
                                    <NavLink to="#" isContactLink>
                                        Agendar Reunião
                                        <Sparkles className="ml-2 w-4 h-4" />
                                    </NavLink>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- PILARES: Cards Flutuantes (Estilo Atuação) --- */}
            <section className="py-24 bg-muted/20 relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-accent/5 via-background to-background pointer-events-none" />

                <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="mb-12 text-center md:text-left">
                        <h2 className="text-3xl font-bold text-foreground mb-4">Nossos Pilares</h2>
                        <p className="text-muted-foreground max-w-2xl">Princípios fundamentais que norteiam nossa conduta profissional.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {values.map((value, index) => (
                            <div key={index} className="group bg-white p-8 rounded-3xl border border-border/60 hover:border-accent/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                <div className="mb-6 inline-block p-3 bg-accent/5 rounded-2xl border border-accent/10 group-hover:bg-accent group-hover:text-accent-foreground transition-all duration-300 group-hover:scale-110">
                                    <value.icon className="h-6 w-6 text-accent group-hover:text-accent-foreground transition-colors" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground mb-3">{value.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {value.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- MAPA: Layout Arredondado --- */}
            <section className="py-12 bg-background">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="rounded-[2.5rem] overflow-hidden shadow-2xl border border-border bg-[#0f172a] grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">

                        {/* Info Column */}
                        <div className="lg:col-span-4 text-white p-10 flex flex-col justify-center relative overflow-hidden">
                            {/* Pattern de fundo sutil no card */}
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-accent to-transparent"></div>

                            <div className="relative z-10">
                                <div className="mb-8">
                                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
                                        <MapPin className="w-6 h-6 text-accent" />
                                    </div>
                                    <h3 className="text-3xl font-bold mb-2">Visite-nos</h3>
                                    <p className="text-gray-400">Petrolina, Pernambuco</p>
                                </div>

                                <div className="space-y-6 text-gray-300">
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                        <p className="font-bold text-white mb-1 text-sm uppercase tracking-wide text-accent">Endereço</p>
                                        <p className="leading-relaxed text-sm">Av. Cardoso de Sá, n. 860, sala 5<br/>Cidade Universitária<br/>Centro Empresarial Sergio Cabral</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                        <p className="font-bold text-white mb-1 text-sm uppercase tracking-wide text-accent">Horário</p>
                                        <p className="text-sm">Segunda a Sexta: 08h às 18h</p>
                                    </div>
                                    <div className="pt-4">
                                        <Button variant="outline" className="w-full border-white/20 text-white bg-transparent hover:bg-white hover:text-[#0f172a] rounded-full h-12" asChild>
                                            <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">
                                                Abrir no Google Maps <ArrowRight className="ml-2 w-4 h-4" />
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Map Column */}
                        <div className="lg:col-span-8 h-[400px] lg:h-auto bg-muted relative">
                            <iframe
                                src={addressDetails.iframeSrc}
                                width="100%"
                                height="100%"
                                style={{ border: 0, filter: "grayscale(100%) invert(0%)" }}
                                allowFullScreen={false}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title="Mapa Localização"
                                className="absolute inset-0"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default Sobre;