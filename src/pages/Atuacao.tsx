import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import {
    Shield,
    Scale,
    TrendingUp,
    CheckCircle2,
    ArrowRight,
    Briefcase
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { practiceAreas } from "@/data/practiceAreas";

const Atuacao = () => {
    // --- ESTADO E LÓGICA DA ANIMAÇÃO ---
    const [activeIndex, setActiveIndex] = useState(0);

    const howWeWork = [
        {
            step: "01",
            title: "Diagnóstico",
            description: "Análise profunda do caso e identificação de riscos.",
            icon: Shield,
        },
        {
            step: "02",
            title: "Planejamento",
            description: "Definição da melhor tese jurídica e estratégia processual.",
            icon: TrendingUp,
        },
        {
            step: "03",
            title: "Atuação",
            description: "Diligência combativa em todas as instâncias necessárias.",
            icon: Scale,
        },
        {
            step: "04",
            title: "Resolução",
            description: "Foco total na entrega do melhor resultado possível.",
            icon: CheckCircle2,
        },
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prevIndex) =>
                (prevIndex + 1) % howWeWork.length
            );
        }, 3000);

        return () => clearInterval(interval);
    }, [howWeWork.length]);

    return (
        <div className="min-h-screen bg-background font-sans selection:bg-accent selection:text-accent-foreground">
            <Navigation />

            {/* --- HERO SECTION --- */}
            <section className="relative pt-32 pb-24 bg-[#0f172a] text-white overflow-hidden border-b border-white/5">
                <div className="absolute inset-0 opacity-[0.05]"
                     style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-px w-12 bg-accent"></div>
                            <span className="text-accent font-medium tracking-[0.2em] uppercase text-xs">Expertise Jurídica</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight drop-shadow-xl">
                            Atuação Estratégica <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-white">
                                Multidisciplinar
                            </span>
                        </h1>
                        <p className="text-xl text-gray-400 leading-relaxed max-w-2xl border-l-4 border-accent/20 pl-6 rounded-sm">
                            Combinamos conhecimento técnico profundo com uma visão de negócios para entregar soluções jurídicas que geram valor real e segurança.
                        </p>
                    </div>
                </div>
            </section>

            {/* --- ÁREAS DE ATUAÇÃO --- */}
            <section className="py-24 bg-muted/20 relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/5 via-background to-background pointer-events-none" />

                <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {practiceAreas.map((area, index) => (
                            <Link
                                key={index}
                                to={`/atuacao/${area.slug}`}
                                className="group relative h-full"
                            >
                                <div className="absolute -inset-0.5 bg-gradient-to-br from-accent to-accent/0 rounded-3xl blur opacity-0 group-hover:opacity-40 transition duration-500"></div>

                                <div className="relative h-full bg-background border border-border/60 hover:border-border p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                                    <div className="mb-6 w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent group-hover:scale-110 transition-all duration-300 border border-accent/20 shadow-inner">
                                        <area.icon className="h-7 w-7 text-accent group-hover:text-accent-foreground transition-colors duration-300" strokeWidth={1.5} />
                                    </div>

                                    <h3 className="text-2xl font-bold text-foreground mb-3 group-hover:text-accent transition-colors duration-300">
                                        {area.title}
                                    </h3>

                                    <p className="text-muted-foreground leading-relaxed mb-6 text-sm flex-grow">
                                        {area.description}
                                    </p>

                                    <div className="pt-6 border-t border-border/50 flex items-center justify-between mt-auto">
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                                            Saiba Mais
                                        </span>
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-all duration-300">
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- METODOLOGIA: LAYOUT DIVIDIDO + ANIMAÇÃO --- */}
            <section className="py-24 bg-background border-y border-border">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">

                        {/* COLUNA ESQUERDA: TÍTULO FIXO */}
                        <div className="lg:col-span-4 sticky top-32">
                            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
                                Nossa Metodologia
                            </h2>
                            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                                Processos claros e transparentes. Você acompanha cada passo da nossa atuação, desde a primeira conversa até a resolução final.
                            </p>
                            <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 h-12 shadow-lg hover:shadow-xl transition-all" size="lg" asChild>
                                <NavLink to="/contato" isContactLink>
                                    Iniciar Atendimento
                                </NavLink>
                            </Button>
                        </div>

                        {/* COLUNA DIREITA: CARDS ANIMADOS EM GRID */}
                        <div className="lg:col-span-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                {howWeWork.map((item, index) => {
                                    const isActive = index === activeIndex;

                                    return (
                                        <div
                                            key={item.step}
                                            className="relative"
                                            onMouseEnter={() => setActiveIndex(index)}
                                        >
                                            <div
                                                className={`relative bg-card/50 backdrop-blur-sm rounded-3xl overflow-hidden border transition-all duration-500 h-full p-8
                                                    ${isActive ? 'bg-accent/5 border-accent shadow-lg scale-[1.02]' : 'border-border/50 hover:border-accent/50'}
                                                `}
                                            >
                                                {/* Barra Vertical Animada */}
                                                <div
                                                    className={`absolute left-0 top-0 bottom-0 w-1.5 bg-accent transform origin-top transition-transform duration-500 
                                                        ${isActive ? 'scale-y-100' : 'scale-y-0'}
                                                    `}
                                                ></div>

                                                <div className="flex items-center justify-between mb-6">
                                                    <div className={`text-5xl font-black transition-colors duration-300 ${isActive ? 'text-accent' : 'text-muted-foreground/20'}`}>
                                                        {item.step}
                                                    </div>
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-accent text-accent-foreground shadow-lg scale-110' : 'bg-muted text-muted-foreground'}`}>
                                                        <item.icon className="w-6 h-6" />
                                                    </div>
                                                </div>

                                                {/* Barra Horizontal Animada */}
                                                <div className={`h-px bg-accent mb-6 transform origin-left transition-transform duration-500 ${isActive ? 'scale-x-100' : 'scale-x-0'}`}></div>

                                                <h3 className={`text-xl font-bold mb-3 transition-colors duration-300 ${isActive ? 'text-foreground' : 'text-foreground/80'}`}>
                                                    {item.title}
                                                </h3>
                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* --- CTA --- */}
            <section className="py-24 bg-muted/20">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-5xl font-bold mb-8 text-foreground max-w-4xl mx-auto leading-tight tracking-tight">
                        Ainda com dúvidas sobre qual área atende sua necessidade?
                    </h2>
                    <p className="text-muted-foreground text-lg mb-12 max-w-2xl mx-auto">
                        Nossa equipe está pronta para avaliar o seu caso específico e direcionar para o especialista mais adequado.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <Button size="xl" className="h-14 px-8 text-lg bg-accent hover:bg-accent/90 text-accent-foreground rounded-full min-w-[240px] shadow-xl hover:scale-105 transition-transform" asChild>
                            <NavLink to="#" isContactLink>
                                <ArrowRight className="mr-2 h-5 w-5" />
                                Falar com Especialista
                            </NavLink>
                        </Button>

                        <span className="text-muted-foreground text-sm uppercase tracking-widest font-semibold px-4">ou</span>

                        <Button variant="outline" size="xl" className="h-14 px-8 text-lg border-2 rounded-full hover:bg-background min-w-[240px] hover:border-accent hover:text-accent transition-all" asChild>
                            <NavLink to="/sobre">
                                Conhecer o Escritório
                            </NavLink>
                        </Button>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default Atuacao;