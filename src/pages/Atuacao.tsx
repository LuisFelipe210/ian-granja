import { useState } from "react";
import { Link } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { practiceAreas } from "@/data/practiceAreas";
import {
    TrendingUp,
    CheckCircle2,
    ArrowRight,
    AlertCircle,
    Gavel
} from "lucide-react";

const Atuacao = () => {
    const [activeStep, setActiveStep] = useState(0);

    const methodologySteps = [
        {
            step: "01",
            title: "Diagnóstico Profundo",
            description: "Não olhamos apenas o problema, olhamos o contexto. Analisamos riscos, provas e viabilidade antes de qualquer ação.",
            icon: AlertCircle,
        },
        {
            step: "02",
            title: "Estratégia Personalizada",
            description: "Fugimos de modelos prontos. Desenhamos a tese jurídica específica para o seu caso visando o resultado mais rápido.",
            icon: TrendingUp,
        },
        {
            step: "03",
            title: "Atuação Combativa",
            description: "Diligência ativa. Não esperamos o processo andar sozinho; impulsionamos cada etapa com técnica e urgência.",
            icon: Gavel,
        },
        {
            step: "04",
            title: "Resolução e Clareza",
            description: "Foco total na entrega do resultado e prestação de contas transparente em linguagem que você entende.",
            icon: CheckCircle2,
        },
    ];

    return (
        <div className="min-h-screen bg-background font-sans selection:bg-accent selection:text-accent-foreground">
            <Navigation />

            {/* --- HERO SECTION: CORRIGIDA (Igual ao FAQ/Sobre) --- */}
            <section className="relative pt-36 pb-24 bg-primary text-primary-foreground overflow-hidden border-b border-primary-foreground/10">
                <div className="absolute inset-0 opacity-[0.05]"
                     style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl">
                        {/* Tag alinhada com linha decorativa */}
                        <div className="flex items-center gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="h-px w-12 bg-accent"></div>
                            <span className="text-accent font-bold tracking-widest uppercase text-[10px]">
                                Expertise Jurídica
                            </span>
                        </div>

                        {/* Título Grande */}
                        <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight drop-shadow-xl text-primary-foreground animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                            Atuação Estratégica <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent/80 to-primary-foreground">
                                Multidisciplinar
                            </span>
                        </h1>

                        {/* Descrição com borda lateral */}
                        <p className="text-xl text-primary-foreground/80 leading-relaxed max-w-2xl border-l-4 border-accent pl-6 rounded-sm animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                            Combinamos conhecimento técnico profundo com uma visão de negócios para entregar soluções jurídicas que geram valor real e segurança.
                        </p>
                    </div>
                </div>
            </section>

            {/* --- GRID DE ATUAÇÃO --- */}
            <section className="py-24 bg-muted/20 relative">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-16 text-center max-w-3xl mx-auto">
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Áreas de Especialidade</h2>
                        <p className="text-muted-foreground">Nossas especialidades são focadas em resolver conflitos complexos.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                        {practiceAreas.map((area, index) => (
                            <Link
                                key={index}
                                to={`/atuacao/${area.slug}`}
                                className="group relative bg-card rounded-3xl p-8 border border-border/60 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col h-full overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                                <div className="mb-6 w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-foreground group-hover:bg-accent group-hover:text-primary transition-colors duration-300">
                                    {area.icon && <area.icon className="h-7 w-7" strokeWidth={1.5} />}
                                </div>

                                <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-accent transition-colors">
                                    {area.title}
                                </h3>

                                <p className="text-muted-foreground leading-relaxed text-sm mb-8 flex-grow">
                                    {area.description}
                                </p>

                                <div className="mt-auto flex items-center text-sm font-bold text-foreground group-hover:text-accent transition-colors">
                                    Saiba mais <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- METODOLOGIA --- */}
            <section className="py-24 bg-primary text-primary-foreground overflow-hidden">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

                        <div className="lg:col-span-5 lg:sticky lg:top-32 self-start">
                            <span className="text-accent font-bold uppercase tracking-widest text-sm mb-2 block">Nosso Processo</span>
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-primary-foreground leading-tight">
                                Transparência do início ao fim.
                            </h2>
                            <p className="text-primary-foreground/70 text-lg leading-relaxed mb-8">
                                Sabemos que processos jurídicos geram ansiedade. Por isso, desenvolvemos um método onde você nunca fica no escuro.
                            </p>

                            <Button variant="outline" className="border-primary-foreground/20 text-black hover:bg-primary-foreground hover:text-primary rounded-full h-12 px-8" asChild>
                                <NavLink to="/contato">Entenda como trabalhamos</NavLink>
                            </Button>
                        </div>

                        <div className="lg:col-span-7 space-y-4">
                            {methodologySteps.map((item, index) => {
                                const isActive = activeStep === index;
                                return (
                                    <div
                                        key={index}
                                        onMouseEnter={() => setActiveStep(index)}
                                        className={`group relative p-8 rounded-3xl border transition-all duration-500 cursor-default
                                            ${isActive
                                            ? 'bg-primary-foreground/10 border-accent/50 shadow-lg'
                                            : 'bg-transparent border-primary-foreground/5 hover:bg-primary-foreground/5 hover:border-primary-foreground/10'}
                                        `}
                                    >
                                        <div className="flex flex-col md:flex-row gap-6 md:items-start">
                                            <div className="flex-shrink-0">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border transition-all duration-300
                                                    ${isActive
                                                    ? 'bg-accent text-primary border-accent'
                                                    : 'bg-transparent text-primary-foreground/60 border-primary-foreground/20 group-hover:border-primary-foreground/40'}
                                                `}>
                                                    {isActive ? <item.icon className="w-5 h-5"/> : item.step}
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className={`text-xl font-bold mb-2 transition-colors duration-300 ${isActive ? 'text-primary-foreground' : 'text-primary-foreground/80 group-hover:text-primary-foreground'}`}>
                                                    {item.title}
                                                </h3>
                                                <p className={`text-sm leading-relaxed transition-colors duration-300 ${isActive ? 'text-primary-foreground/80' : 'text-primary-foreground/60'}`}>
                                                    {item.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                    </div>
                </div>
            </section>

            {/* --- CTA FINAL --- */}
            <section className="py-24 bg-background">
                <div className="container mx-auto px-4">
                    <div className="bg-primary rounded-[3rem] p-8 md:p-16 text-center relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2"></div>
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] translate-x-1/2 translate-y-1/2"></div>

                        <div className="relative z-10 max-w-3xl mx-auto">
                            <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-6">
                                Precisa de orientação especializada?
                            </h2>
                            <p className="text-primary-foreground/70 text-lg mb-10">
                                Nossa equipe está pronta para avaliar o seu caso e direcionar para o especialista adequado.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Button size="xl" className="w-full sm:w-auto h-16 px-10 rounded-full text-lg font-bold bg-accent hover:bg-accent/90 text-primary hover:scale-105 transition-transform shadow-lg" asChild>
                                    <NavLink to="#" isContactLink>
                                        <ArrowRight className="mr-2 w-5 h-5" /> Falar no WhatsApp
                                    </NavLink>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default Atuacao;