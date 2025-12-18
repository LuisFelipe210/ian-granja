import { useParams, Navigate, Link } from "react-router-dom";
import { practiceAreas } from "@/data/practiceAreas";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    CheckCircle2,
    ArrowRight,
    Phone,
    MessageSquare,
    ChevronRight,
    Check,
    Scale,
    ShieldCheck,
    Clock,
    FileText
} from "lucide-react";
import {FaWhatsapp} from "react-icons/fa";

const AtuacaoDetalhes = () => {
    const { slug } = useParams();

    const area = practiceAreas.find((item) => item.slug === slug);

    if (!area) {
        return <Navigate to="/atuacao" replace />;
    }

    const Icon = area.icon;

    // Dados simulados
    const commonDoubts = [
        {
            question: "Quais documentos preciso para iniciar?",
            answer: "Geralmente solicitamos documentos pessoais (RG, CPF), comprovante de residência e todos os documentos relacionados ao fato (contratos, trocas de e-mail, notificações). Faremos uma triagem detalhada na primeira reunião."
        },
        {
            question: "Quanto tempo demora um processo nessa área?",
            answer: "O tempo varia conforme a complexidade e a vara judicial. No entanto, nossa atuação é focada em agilidade, buscando sempre liminares ou acordos extrajudiciais quando vantajoso para o cliente."
        },
        {
            question: "Como funcionam os honorários?",
            answer: "Trabalhamos com total transparência. Analisamos o caso e propomos honorários justos, que podem ser fixos, parcelados ou, em alguns casos, condicionados ao êxito da ação (ad exitum)."
        }
    ];

    return (
        <div className="min-h-screen bg-background font-sans selection:bg-accent selection:text-accent-foreground">
            <Navigation />

            {/* --- HERO SECTION --- */}
            <section className="relative pt-36 pb-32 bg-primary text-white overflow-hidden border-b border-white/5">
                <div className="absolute inset-0 opacity-[0.05]"
                     style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl">
                        <div className="flex items-center gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <Link to="/atuacao" className="text-gray-400 hover:text-white transition-colors text-sm uppercase tracking-wider font-medium flex items-center gap-2">
                                Áreas de Atuação <ChevronRight className="w-3 h-3" />
                            </Link>
                            <span className="text-accent font-bold tracking-widest uppercase text-[10px] border border-accent/30 px-3 py-1 bg-accent/10 rounded-full">
                                Especialidade
                            </span>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-start gap-6 mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl w-fit backdrop-blur-sm shadow-2xl">
                                <Icon className="w-10 h-10 text-accent" strokeWidth={1.5} />
                            </div>
                            <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight text-white">
                                {area.title}
                            </h1>
                        </div>

                        <p className="text-xl text-gray-300 leading-relaxed max-w-3xl border-l-4 border-accent pl-6 rounded-sm animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                            {area.description}
                        </p>
                    </div>
                </div>
            </section>

            {/* --- CONTEÚDO PRINCIPAL --- */}
            <section className="py-24 bg-background">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">

                        {/* --- COLUNA ESQUERDA: Conteúdo Rico (8 colunas) --- */}
                        <div className="lg:col-span-8">

                            {/* 1. Contexto */}
                            <div className="mb-16">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="w-2 h-8 bg-accent rounded-full"></span>
                                    Contexto e Abordagem
                                </h2>
                                <p className="text-muted-foreground text-lg leading-relaxed text-justify">
                                    {area.fullDescription || area.description}
                                </p>
                            </div>

                            {/* 2. Por que contratar especialista */}
                            <div className="mb-16">
                                <h3 className="text-xl font-bold text-foreground mb-8">
                                    Por que contratar um especialista em {area.title}?
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white p-6 rounded-2xl border border-border/50">
                                        <Scale className="w-8 h-8 text-accent mb-4" />
                                        <h4 className="font-bold text-foreground mb-2">Domínio da Legislação</h4>
                                        <p className="text-sm text-muted-foreground">Conhecimento profundo das leis específicas e das últimas decisões dos tribunais (jurisprudência) sobre o tema.</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl border border-border/50">
                                        <ShieldCheck className="w-8 h-8 text-accent mb-4" />
                                        <h4 className="font-bold text-foreground mb-2">Estratégia Assertiva</h4>
                                        <p className="text-sm text-muted-foreground">Evitamos erros comuns que generalistas cometem. Cada documento é analisado com lupa técnica.</p>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Escopo de Atuação */}
                            <div className="mb-16">
                                <h3 className="text-xl font-bold text-foreground mb-8">
                                    Nossos Serviços na Área
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {area.services.map((service, idx) => (
                                        <div key={idx} className="group bg-card p-5 rounded-2xl border border-border/60 hover:border-accent/50 hover:bg-muted/30 transition-all duration-300 flex items-start gap-4 hover:shadow-md hover:-translate-y-1">
                                            <div className="mt-1 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent group-hover:scale-110 transition-all shrink-0">
                                                <Check className="w-3.5 h-3.5 text-accent group-hover:text-accent-foreground" strokeWidth={3} />
                                            </div>
                                            <span className="text-foreground/80 group-hover:text-foreground font-medium text-sm leading-relaxed pt-0.5">
                                                {service}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 4. Dúvidas Comuns */}
                            <div>
                                <h3 className="text-xl font-bold text-foreground mb-6">
                                    Dúvidas Frequentes
                                </h3>
                                <Accordion type="single" collapsible className="w-full space-y-4">
                                    {commonDoubts.map((item, i) => (
                                        <AccordionItem key={i} value={`item-${i}`} className="border border-border/60 bg-card rounded-2xl px-6 data-[state=open]:border-accent/50 data-[state=open]:bg-accent/5 transition-all">
                                            <AccordionTrigger className="hover:no-underline py-5 text-left font-semibold text-foreground">
                                                {item.question}
                                            </AccordionTrigger>
                                            <AccordionContent className="text-muted-foreground text-base pb-6">
                                                {item.answer}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </div>

                        {/* --- COLUNA DIREITA: Sidebar (4 colunas) --- */}
                        <div className="lg:col-span-4">
                            {/* AQUI ESTÁ A CORREÇÃO: O 'sticky' fica no wrapper que segura os dois cards */}
                            <div className="sticky top-28 space-y-10">

                                {/* Card de Contato - Dark & Rounded */}
                                <div className="bg-primary text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-accent/20 transition-all duration-500"></div>

                                    <h3 className="text-xl font-bold mb-4 relative z-10 text-white">
                                        Precisa de orientação em {area.title}?
                                    </h3>
                                    <p className="text-gray-400 mb-8 relative z-10 text-sm leading-relaxed">
                                        Nossa equipe técnica está pronta para analisar a viabilidade do seu caso hoje mesmo.
                                    </p>

                                    <div className="space-y-4 relative z-10">
                                        <Button size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-full h-12 shadow-lg hover:scale-105 transition-transform" asChild>
                                            <NavLink to="#" isContactLink>
                                                <Phone className="w-4 h-4 mr-2" />
                                                Falar com Especialista
                                            </NavLink>
                                        </Button>

                                        <Button variant="outline" size="lg" className="w-full border-white/10 bg-white/5 text-white hover:bg-white hover:text-[#0f172a] rounded-full h-12 hover:scale-105 transition-transform backdrop-blur-sm" asChild>
                                            <a href="https://wa.me/5587988448690" target="_blank" rel="noopener noreferrer">
                                                <FaWhatsapp className="w-4 h-4 mr-2" />
                                                WhatsApp
                                            </a>
                                        </Button>
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-white/10">
                                        <div className="flex items-center gap-3 text-white/60 text-xs">
                                            <Clock className="w-4 h-4" />
                                            <span>Seg - Sex • 08h às 18h</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-white/60 text-xs mt-2">
                                            <FileText className="w-4 h-4" />
                                            <span>Atendimento Online e Presencial</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Navegação Rápida */}
                                <div className="p-8 bg-card border border-border/50 rounded-[2rem]">
                                    <h4 className="font-bold mb-6 text-foreground text-xs uppercase tracking-widest text-accent">Outras Especialidades</h4>
                                    <nav className="flex flex-col space-y-2">
                                        {practiceAreas
                                            .filter(a => a.slug !== slug)
                                            .slice(0, 5)
                                            .map((item) => (
                                                <Link
                                                    key={item.slug}
                                                    to={`/atuacao/${item.slug}`}
                                                    className="group flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-all duration-300"
                                                >
                                                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1">
                                                    {item.title}
                                                </span>
                                                    <ArrowRight className="w-3 h-3 text-accent opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 flex-shrink-0" />
                                                </Link>
                                            ))}
                                    </nav>
                                    <div className="mt-6 pt-6 border-t border-border/50 text-center">
                                        <Link to="/atuacao" className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors">
                                            Ver todas
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* --- CTA FINAL --- */}
            <section className="py-24 bg-muted/20 border-t border-border">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
                        Não deixe seus direitos para depois
                    </h2>
                    <p className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto">
                        A demora pode prejudicar seu caso. Converse com nossa equipe e entenda suas opções legais agora.
                    </p>
                    <div className="flex justify-center">
                        <Button size="xl" className="h-14 px-10 text-lg bg-accent hover:bg-accent/90 text-accent-foreground rounded-full shadow-xl hover:scale-105 transition-transform" asChild>
                            <NavLink to="#" isContactLink>
                                Iniciar Atendimento
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </NavLink>
                        </Button>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default AtuacaoDetalhes;