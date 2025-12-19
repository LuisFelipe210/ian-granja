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
    ChevronRight,
    Check,
    Scale,
    ShieldCheck,
    Clock,
    FileText,
    BookOpen
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

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

            {/* --- HERO SECTION: PREMIUM LOOK --- */}
            <section className="relative pt-36 pb-24 bg-primary text-primary-foreground overflow-hidden border-b border-primary-foreground/10">
                {/* Pattern de fundo */}
                <div className="absolute inset-0 opacity-[0.05]"
                     style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl">
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <Link to="/atuacao" className="text-primary-foreground/60 hover:text-primary-foreground transition-colors text-sm uppercase tracking-wider font-medium flex items-center gap-2">
                                Áreas de Atuação <ChevronRight className="w-3 h-3" />
                            </Link>
                            <span className="text-accent font-bold tracking-widest uppercase text-[10px]">
                                Especialidade
                            </span>
                        </div>

                        {/* Título com destaque visual */}
                        <div className="flex flex-col md:flex-row md:items-start gap-6 mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                            <div className="p-4 bg-primary-foreground/5 border border-primary-foreground/10 rounded-2xl w-fit backdrop-blur-sm shadow-2xl hidden md:block">
                                {Icon && <Icon className="w-10 h-10 text-accent" strokeWidth={1.5} />}
                            </div>
                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight text-primary-foreground">
                                Atuação em <br/>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent/80 to-primary-foreground">
                                    {area.title}
                                </span>
                            </h1>
                        </div>

                        <p className="text-xl text-primary-foreground/80 leading-relaxed max-w-3xl border-l-4 border-accent pl-6 rounded-sm animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                            {area.description}
                        </p>
                    </div>
                </div>
            </section>

            {/* --- CONTEÚDO PRINCIPAL --- */}
            <section className="py-24 bg-background relative">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">

                        {/* --- COLUNA ESQUERDA: Conteúdo Rico (8 colunas) --- */}
                        <div className="lg:col-span-8 space-y-20">

                            {/* 1. Contexto Detalhado */}
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-accent/10 rounded-lg">
                                        <BookOpen className="w-6 h-6 text-accent" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-foreground">
                                        Entenda o Contexto
                                    </h2>
                                </div>
                                <div className="prose prose-lg text-muted-foreground leading-relaxed text-justify max-w-none">
                                    {/* Simulação de parágrafos para parecer mais robusto */}
                                    <p>{area.fullDescription || area.description}</p>
                                    <p className="mt-4">
                                        Nossa abordagem nesta área é pautada pela análise minuciosa de cada detalhe. Entendemos que cada caso possui suas particularidades e exige uma estratégia jurídica personalizada, focada não apenas na resolução do conflito, mas na prevenção de riscos futuros.
                                    </p>
                                </div>
                            </div>

                            {/* 2. Por que contratar especialista (Cards Visuais) */}
                            <div>
                                <h3 className="text-2xl font-bold text-foreground mb-8">
                                    Por que contratar um especialista?
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-card p-8 rounded-3xl border border-border/60 shadow-sm hover:shadow-lg transition-all duration-300 group">
                                        <div className="mb-4 p-3 bg-muted rounded-2xl w-fit group-hover:bg-accent group-hover:text-primary transition-colors">
                                            <Scale className="w-6 h-6" />
                                        </div>
                                        <h4 className="font-bold text-lg text-foreground mb-3">Domínio da Legislação</h4>
                                        <p className="text-muted-foreground text-sm leading-relaxed">
                                            Conhecimento profundo das leis específicas e das últimas decisões dos tribunais (jurisprudência) sobre o tema, garantindo a melhor tese de defesa.
                                        </p>
                                    </div>
                                    <div className="bg-card p-8 rounded-3xl border border-border/60 shadow-sm hover:shadow-lg transition-all duration-300 group">
                                        <div className="mb-4 p-3 bg-muted rounded-2xl w-fit group-hover:bg-accent group-hover:text-primary transition-colors">
                                            <ShieldCheck className="w-6 h-6" />
                                        </div>
                                        <h4 className="font-bold text-lg text-foreground mb-3">Estratégia Assertiva</h4>
                                        <p className="text-muted-foreground text-sm leading-relaxed">
                                            Evitamos erros comuns que generalistas cometem. Cada documento é analisado com lupa técnica para blindar seu direito.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Escopo de Atuação (Checklist Moderno) */}
                            <div className="bg-muted/30 p-8 rounded-[2rem] border border-border/50">
                                <h3 className="text-2xl font-bold text-foreground mb-8">
                                    O que podemos fazer por você
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {area.services.map((service, idx) => (
                                        <div key={idx} className="flex items-start gap-4 p-3 rounded-xl hover:bg-background transition-colors">
                                            <div className="mt-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center shrink-0 shadow-sm">
                                                <Check className="w-3 h-3 text-primary-foreground" strokeWidth={4} />
                                            </div>
                                            <span className="text-foreground/90 font-medium text-sm leading-relaxed pt-0.5">
                                                {service}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 4. Dúvidas Comuns (Clean Accordion) */}
                            <div>
                                <h3 className="text-2xl font-bold text-foreground mb-8">
                                    Dúvidas Frequentes
                                </h3>
                                <Accordion type="single" collapsible className="w-full space-y-4">
                                    {commonDoubts.map((item, i) => (
                                        <AccordionItem key={i} value={`item-${i}`} className="border border-border/60 bg-card rounded-2xl px-2 shadow-sm data-[state=open]:border-accent/50 data-[state=open]:ring-1 data-[state=open]:ring-accent/10 transition-all">
                                            <AccordionTrigger className="hover:no-underline py-5 px-4 text-left font-semibold text-foreground text-base">
                                                {item.question}
                                            </AccordionTrigger>
                                            <AccordionContent className="text-muted-foreground text-base pb-6 px-4 leading-relaxed">
                                                {item.answer}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </div>

                        {/* --- COLUNA DIREITA: Sidebar Sticky --- */}
                        <div className="lg:col-span-4">
                            <div className="sticky top-32 space-y-8">

                                {/* Card de Contato - BG-PRIMARY (Dark Mode) */}
                                <div className="bg-primary text-primary-foreground p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group border border-primary-foreground/10">
                                    {/* Efeito de Fundo */}
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-accent/20 transition-all duration-700"></div>

                                    <div className="relative z-10">
                                        <div className="mb-6 inline-flex p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                                            <Phone className="w-6 h-6 text-accent" />
                                        </div>

                                        <h3 className="text-2xl font-bold mb-4 text-primary-foreground">
                                            Precisa de ajuda com {area.title}?
                                        </h3>
                                        <p className="text-primary-foreground/70 mb-8 text-sm leading-relaxed">
                                            Nossa equipe está pronta para analisar seu caso hoje mesmo com sigilo total.
                                        </p>

                                        <div className="space-y-4">
                                            <Button size="lg" className="w-full bg-accent text-primary hover:bg-white hover:text-primary font-bold rounded-full h-14 shadow-lg hover:shadow-xl hover:scale-105 transition-all" asChild>
                                                <NavLink to="#" isContactLink>
                                                    Falar com Especialista
                                                    <ArrowRight className="w-4 h-4 ml-2" />
                                                </NavLink>
                                            </Button>

                                            <Button
                                                variant="outline"
                                                size="lg"
                                                className="w-full border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary rounded-full h-14 hover:scale-105 transition-all"
                                                asChild
                                            >
                                                <a href="https://wa.me/5587988448690" target="_blank" rel="noopener noreferrer">
                                                    <FaWhatsapp className="w-5 h-5 mr-2" />
                                                    WhatsApp
                                                </a>
                                            </Button>
                                        </div>

                                        <div className="mt-8 pt-6 border-t border-primary-foreground/10 flex flex-col gap-3">
                                            <div className="flex items-center gap-3 text-primary-foreground/60 text-xs font-medium">
                                                <Clock className="w-4 h-4 text-accent" />
                                                <span>Seg - Sex • 08h às 18h</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-primary-foreground/60 text-xs font-medium">
                                                <FileText className="w-4 h-4 text-accent" />
                                                <span>Atendimento Online e Presencial</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Menu de Navegação Rápida */}
                                <div className="p-8 bg-card border border-border/60 rounded-[2.5rem] shadow-sm">
                                    <h4 className="font-bold mb-6 text-foreground text-xs uppercase tracking-widest text-accent">Outras Áreas</h4>
                                    <nav className="flex flex-col space-y-2">
                                        {practiceAreas
                                            .filter(a => a.slug !== slug)
                                            .slice(0, 5)
                                            .map((item) => (
                                                <Link
                                                    key={item.slug}
                                                    to={`/atuacao/${item.slug}`}
                                                    className="group flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-all duration-300"
                                                >
                                                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1">
                                                    {item.title}
                                                </span>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-1 transition-all" />
                                                </Link>
                                            ))}
                                    </nav>
                                    <div className="mt-6 pt-6 border-t border-border/50 text-center">
                                        <Link to="/atuacao" className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors">
                                            Ver todas as áreas
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* --- CTA FINAL: CARD FLUTUANTE (Igual ao resto do site) --- */}
            <section className="py-24 bg-background">
                <div className="container mx-auto px-4">
                    <div className="bg-primary rounded-[3rem] p-8 md:p-16 text-center relative overflow-hidden shadow-2xl">
                        {/* Efeitos de fundo */}
                        <div className="absolute top-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2"></div>
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] translate-x-1/2 translate-y-1/2"></div>

                        <div className="relative z-10 max-w-3xl mx-auto">
                            <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-6">
                                Ainda tem dúvidas sobre o caso?
                            </h2>
                            <p className="text-primary-foreground/70 text-lg mb-10 max-w-2xl mx-auto">
                                Não deixe para depois. Uma orientação jurídica precoce pode salvar seu patrimônio e garantir seus direitos.
                            </p>

                            <div className="flex justify-center">
                                <Button size="xl" className="w-full sm:w-auto h-16 px-12 rounded-full text-lg font-bold bg-accent hover:bg-white text-primary hover:text-primary transition-all shadow-lg hover:shadow-xl hover:scale-105" asChild>
                                    <NavLink to="#" isContactLink>
                                        Iniciar Atendimento
                                        <ArrowRight className="ml-2 h-5 w-5" />
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

export default AtuacaoDetalhes;