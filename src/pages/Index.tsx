import React from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NavLink } from "@/components/NavLink";
import heroImage from "@/assets/hero-law-office.jpg";
import lawyerPortrait from "@/assets/lawyer-portrait.jpg";
import cliente1 from "@/assets/cliente1.jpg";
import cliente2 from "@/assets/cliente2.jpg";
import cliente3 from "@/assets/cliente3.jpg";
import {
    Scale,
    Briefcase,
    Users,
    Shield,
    Award,
    CheckCircle,
    Phone,
    ArrowRight,
    Quote,
    Heart,
    Goal,
    Star
} from "lucide-react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

const Index = () => {
    const plugin = React.useRef(
        Autoplay({ delay: 5000, stopOnInteraction: true })
    );

    const homePracticeAreas = [
        {
            icon: Briefcase,
            title: "Direito Bancário",
            description: "Recuperação de veículos e revisão de contratos.",
        },
        {
            icon: Users,
            title: "Direito Trabalhista",
            description: "Defesa de trabalhadores e empresas em disputas.",
        },
        {
            icon: Shield,
            title: "Direito do Consumidor",
            description: "Defesa contra cobranças e negativação indevida.",
        },
        {
            icon: Heart,
            title: "Planos de Saúde",
            description: "Ações contra negativas e reajustes abusivos.",
        },
    ];

    const whyChooseUs = [
        {
            icon: Award,
            title: "Histórico de Resultados",
            description: "Foco em soluções eficazes e decisões favoráveis.",
        },
        {
            icon: CheckCircle,
            title: "Honorários Transparentes",
            description: "Sem surpresas. Clareza total do início ao fim.",
        },
        {
            icon: Users,
            title: "Atendimento Humanizado",
            description: "Empatia e clareza na orientação jurídica.",
        },
    ];

    const stats = [
        { number: "2k+", label: "Consultas" },
        { number: "98%", label: "Satisfação" },
        { number: "5+", label: "Anos de Mercado" },
        { number: "100%", label: "Dedicação" },
    ];

    const testimonials = [
        {
            quote: "Ótimo atendimento pelo Dr. Ian, sempre atencioso. Acompanhou-me de maneira extraordinária.",
            name: "Jefferson Adriano",
            profession: "Empresário",
            avatar: cliente1
        },
        {
            quote: "O Dr. Ian resolve, orienta e veste a camisa. Indico de olhos fechados pela competência.",
            name: "Victor Flávio",
            profession: "Dentista",
            avatar: cliente2
        },
        {
            quote: "Agiu rápido e com uma competência que nunca vi. O resultado mudou minha vida.",
            name: "Maria Almeida",
            profession: "Autônoma",
            avatar: cliente3
        },
    ];

    return (
        <div className="min-h-screen bg-background font-sans selection:bg-accent selection:text-accent-foreground">
            <Navigation />

            {/* --- HERO SECTION: ORIGINAL (Mas com botões arredondados) --- */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-28 pb-12">
                <div
                    className="absolute inset-0 z-0"
                    style={{
                        backgroundImage: `linear-gradient(to top, hsl(var(--primary) / 0.95) 10%, hsl(var(--primary) / 0.4) 100%), url(${heroImage})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                />
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-primary-foreground mb-6 animate-in fade-in-0 slide-in-from-bottom-10 duration-1000 delay-300 drop-shadow-lg">
                        Oferecemos Soluções Jurídicas
                        <br />
                        <span className="text-accent">com Foco no Resultado</span>
                    </h1>
                    <p className="text-lg sm:text-xl text-primary-foreground/90 mb-10 max-w-2xl mx-auto animate-in fade-in-0 slide-in-from-bottom-10 duration-1000 delay-500 font-medium">
                        Advocacia experiente e especializada. Atendimento personalizado com compromisso em entregar resultados práticos.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in-0 slide-in-from-bottom-10 duration-1000 delay-700">
                        {/* Botões Arredondados (Rounded-full) */}
                        <Button size="xl" asChild className="w-full sm:w-auto h-14 px-8 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground shadow-xl transition-transform hover:scale-105">
                            <NavLink to="#" isContactLink>
                                <Phone className="mr-2 h-5 w-5" />
                                Falar com Advogado
                            </NavLink>
                        </Button>
                        <Button size="xl" variant="outline" asChild
                                className="w-full sm:w-auto h-14 px-8 rounded-full bg-white/10 backdrop-blur-sm text-white border-white/30 hover:bg-white hover:text-primary transition-transform hover:scale-105"
                        >
                            <NavLink to="/atuacao">Conheça Nossa Atuação</NavLink>
                        </Button>
                    </div>

                    {/* Cards de Informação - Arredondados */}
                    <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto animate-in fade-in-0 slide-in-from-bottom-10 duration-1000 delay-900">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-lg hover:bg-white/15 transition-colors">
                            <p className="text-white font-bold text-lg mb-1">Atuação Nacional</p>
                            <p className="text-white/70 text-sm">Processos digitais em todo o Brasil</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-lg hover:bg-white/15 transition-colors">
                            <p className="text-white font-bold text-lg mb-1">Plantão WhatsApp</p>
                            <p className="text-white/70 text-sm">(87) 9 8844-8690</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- LAYOUT PRINCIPAL: STICKY + CONTEÚDO FLUIDO --- */}
            <section className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-24 bg-background">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 lg:gap-12">

                    {/* --- COLUNA ESQUERDA (STICKY - Agora com Bordas Suaves) --- */}
                    <div className="lg:col-span-1 lg:sticky lg:top-28 self-start">
                        <div className="flex flex-col items-center lg:items-start p-8 border border-border/60 bg-card rounded-3xl shadow-xl">
                            {/* Foto Arredondada */}
                            <div className="relative group w-full max-w-[260px] mb-8 mx-auto lg:mx-0">
                                <img
                                    src={lawyerPortrait}
                                    alt="Ian Granja"
                                    loading="lazy"
                                    className="w-full aspect-[3/4] object-cover rounded-2xl shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                                />
                                {/* Badge Flutuante */}
                                <div className="absolute -bottom-4 -right-4 bg-accent text-accent-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-lg">
                                    OAB/PE 61.107
                                </div>
                            </div>

                            <p className="text-accent font-bold mb-2 uppercase tracking-widest text-xs text-center lg:text-left w-full">Sócio Fundador</p>
                            <h2 className="text-3xl font-bold text-foreground mb-4 text-center lg:text-left w-full">
                                Ian Granja
                            </h2>

                            <blockquote className="italic text-muted-foreground my-4 text-lg text-center lg:text-left font-serif leading-relaxed">
                                "Não existe direito se o cidadão não vê o resultado prático dele."
                            </blockquote>

                            <p className="text-foreground/80 text-sm mb-8 text-center lg:text-left leading-relaxed">
                                Advogado com 5 anos de experiência e atuação nacional. Especialista em resolver problemas complexos com estratégias diretas.
                            </p>

                            <div className="space-y-3 w-full">
                                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl border border-border/50">
                                    <div className="p-2 bg-background rounded-full shadow-sm"><Scale className="h-5 w-5 text-accent" /></div>
                                    <div>
                                        <h3 className="text-xs font-bold uppercase text-foreground">Experiência</h3>
                                        <p className="text-muted-foreground text-xs">Foco em resultados.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl border border-border/50">
                                    <div className="p-2 bg-background rounded-full shadow-sm"><Goal className="h-5 w-5 text-accent" /></div>
                                    <div>
                                        <h3 className="text-xs font-bold uppercase text-foreground">Estratégia</h3>
                                        <p className="text-muted-foreground text-xs">Soluções ágeis.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 w-full">
                                <Button
                                    variant="outline"
                                    className="w-full h-12 text-base border-foreground/10 hover:border-accent hover:bg-accent hover:text-accent-foreground rounded-xl transition-all"
                                    asChild
                                >
                                    <NavLink to="/sobre">
                                        Conheça a História <ArrowRight className="ml-2 w-4 h-4" />
                                    </NavLink>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* --- COLUNA DIREITA (CONTEÚDO) --- */}
                    <div className="lg:col-span-2 space-y-24">

                        {/* Áreas de Atuação - Cards Flutuantes (Não mais grade colada) */}
                        <section id="practice-areas">
                            <div className="mb-10 text-center lg:text-left">
                                <h2 className="text-3xl font-bold text-foreground mb-4">
                                    Nossas Especialidades
                                </h2 >
                                <p className="text-lg text-muted-foreground">
                                    Atuação focada em resultados práticos.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {homePracticeAreas.map((area) => (
                                    <NavLink
                                        key={area.title}
                                        to="/atuacao"
                                        className="group bg-card p-8 rounded-3xl border border-border/60 hover:border-accent/50 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
                                    >
                                        <div className="mb-6">
                                            <div className="w-14 h-14 bg-accent/10 flex items-center justify-center rounded-2xl group-hover:bg-accent group-hover:scale-110 transition-all duration-300">
                                                <area.icon className="h-7 w-7 text-accent group-hover:text-accent-foreground transition-colors" />
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-bold text-foreground mb-3">
                                            {area.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed flex-grow">
                                            {area.description}
                                        </p>
                                        <div className="mt-6 flex items-center text-accent font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                                            Saiba mais <ArrowRight className="ml-2 w-4 h-4" />
                                        </div>
                                    </NavLink>
                                ))}
                            </div>

                            <div className="text-center mt-12">
                                <Button size="lg" variant="ghost" className="rounded-full hover:bg-muted px-8 h-12 text-muted-foreground hover:text-foreground" asChild>
                                    <NavLink to="/atuacao">Ver Todas as Áreas →</NavLink>
                                </Button>
                            </div>
                        </section>

                        {/* Depoimentos - Cards Suaves */}
                        <section id="testimonial-stable">
                            <div className="mb-10 text-center lg:text-left">
                                <span className="text-accent font-bold uppercase tracking-widest text-xs mb-2 block">Feedback</span>
                                <h2 className="text-3xl font-bold text-foreground">
                                    O que dizem nossos clientes
                                </h2>
                            </div>

                            <div className="relative">
                                <div className="absolute -inset-4 bg-muted/30 rounded-[3rem] -z-10 transform -rotate-1"></div>
                                <Carousel
                                    plugins={[plugin.current]}
                                    className="w-full"
                                    onMouseEnter={plugin.current.stop}
                                    onMouseLeave={plugin.current.reset}
                                    opts={{ align: "start", loop: true }}
                                >
                                    <CarouselContent className="-ml-4">
                                        {testimonials.map((testimonial, index) => (
                                            <CarouselItem key={index} className="md:basis-1/2 pl-4">
                                                <div className="bg-white rounded-3xl p-8 border border-border/60 shadow-sm h-full flex flex-col relative overflow-hidden group hover:border-accent/30 transition-colors">
                                                    <Quote className="absolute top-6 right-6 h-12 w-12 text-accent/10 rotate-180" />

                                                    <div className="flex items-center gap-1 mb-6 text-yellow-500">
                                                        {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                                                    </div>

                                                    <blockquote className="text-lg text-foreground/80 leading-relaxed mb-8 flex-grow">
                                                        "{testimonial.quote}"
                                                    </blockquote>

                                                    <div className="flex items-center gap-4 pt-6 border-t border-border/50">
                                                        <img
                                                            src={testimonial.avatar}
                                                            alt={testimonial.name}
                                                            loading="lazy"
                                                            className="w-12 h-12 rounded-full object-cover shadow-md"
                                                        />
                                                        <div>
                                                            <p className="text-sm font-bold text-foreground">{testimonial.name}</p>
                                                            <p className="text-xs text-muted-foreground">{testimonial.profession}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                    <div className="hidden md:flex justify-end gap-2 mt-6 pr-4">
                                        <CarouselPrevious className="static translate-y-0 rounded-full border-border hover:bg-accent hover:text-accent-foreground" />
                                        <CarouselNext className="static translate-y-0 rounded-full border-border hover:bg-accent hover:text-accent-foreground" />
                                    </div>
                                </Carousel>
                            </div>
                        </section>

                        {/* Por que nós - Cards com Gradiente Suave */}
                        <section id="why-choose-us" className="bg-[#0f172a] text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                            {/* Background Pattern */}
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                            <div className="relative z-10 mb-10 text-center lg:text-left">
                                <p className="text-accent font-semibold mb-2 uppercase tracking-wider text-xs">Diferenciais</p>
                                <h2 className="text-3xl font-bold text-white mb-4">
                                    Por Que Nos Contratar?
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                                {whyChooseUs.map((item) => (
                                    <div key={item.title} className="group bg-white/5 p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                                        <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-4 text-accent-foreground shadow-lg group-hover:scale-110 transition-transform">
                                            <item.icon className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2">
                                            {item.title}
                                        </h3>
                                        <p className="text-white/60 text-sm leading-relaxed">
                                            {item.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>

                    </div>
                </div>
            </section>

            {/* --- STATS STRIP (Com bordas arredondadas) --- */}
            <section className="py-12">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-accent text-accent-foreground rounded-[2rem] p-12 grid grid-cols-2 md:grid-cols-4 gap-8 shadow-xl">
                        {stats.map((stat, index) => (
                            <div key={index} className="text-center relative">
                                {index !== stats.length - 1 && <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-12 bg-black/10"></div>}
                                <p className="text-4xl md:text-5xl font-black mb-1">{stat.number}</p>
                                <p className="text-xs sm:text-sm font-bold uppercase tracking-wider opacity-80">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default Index;