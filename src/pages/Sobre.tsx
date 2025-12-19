import React from "react";
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
    ArrowRight,
    Award,
    GraduationCap,
    FileSignature,
    Building2
} from "lucide-react";

const Sobre = () => {

    // Credenciais destacadas para dar autoridade
    const credentials = [
        { icon: FileSignature, label: "OAB/PE", value: "61.107" },
        { icon: GraduationCap, label: "Formação", value: "Láurea Acadêmica" },
        { icon: TrendingUp, label: "Experiência", value: "5+ Anos de Mercado" },
    ];

    const values = [
        {
            icon: Scale,
            title: "Ética Inegociável",
            description: "Transparência absoluta. A confiança é o nosso maior ativo.",
        },
        {
            icon: Target,
            title: "Foco no Resultado",
            description: "Não vendemos processos, entregamos estratégias de resolução.",
        },
        {
            icon: Users,
            title: "Atendimento Humanizado",
            description: "Entendemos que por trás de cada processo existe uma vida.",
        },
        {
            icon: Briefcase,
            title: "Excelência Técnica",
            description: "Atualização constante para enfrentar casos complexos.",
        },
    ];

    const addressDetails = {
        address: "Avenida Cardoso de Sá, n. 860, sala 5, Cidade Universitária, Centro Empresarial Sergio Cabral, CEP 56302-110, Petrolina-PE",
        iframeSrc: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3936.568474249089!2d-40.5050899!3d-9.3712869!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x773719000000001%3A0x0!2sCentro%20Empresarial%20Sergio%20Cabral!5e0!3m2!1spt-BR!2sbr!4v1600000000000!5m2!1spt-BR!2sbr",
    };

    return (
        <div className="min-h-screen bg-background font-sans selection:bg-accent selection:text-accent-foreground">
            <Navigation />

            {/* --- HERO SECTION: IDENTIDADE VISUAL PADRONIZADA --- */}
            <section className="relative pt-36 pb-24 bg-primary text-primary-foreground overflow-hidden border-b border-primary-foreground/10">
                <div className="absolute inset-0 opacity-[0.05]"
                     style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl">
                        <div className="flex items-center gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="h-px w-12 bg-accent"></div>
                            <span className="text-accent font-bold tracking-widest uppercase text-[10px] border border-accent/30 px-3 py-1 bg-accent/10 rounded-full">
                                O Escritório
                            </span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight text-primary-foreground">
                            Defesa Técnica & <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent/80 to-primary-foreground">
                                Estratégia Jurídica
                            </span>
                        </h1>

                        <p className="text-xl text-primary-foreground/80 leading-relaxed max-w-2xl border-l-4 border-accent pl-6 rounded-sm">
                            Somos parceiros estratégicos na proteção do seu patrimônio e dos seus direitos.
                        </p>
                    </div>
                </div>
            </section>

            {/* --- PERFIL DO ADVOGADO: LAYOUT DENSO E ESTRUTURADO --- */}
            <section className="py-24 bg-background">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row gap-16 items-start">

                        {/* COLUNA ESQUERDA: FOTO (STICKY) */}
                        <div className="w-full lg:w-5/12 lg:sticky lg:top-32">
                            <div className="relative group rounded-[2.5rem] overflow-hidden shadow-2xl border border-border/50">
                                <img
                                    src={lawyerPortrait}
                                    alt="Ian Granja"
                                    className="w-full aspect-[3/4] object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                {/* Overlay Gradiente na foto para o texto sobrepor se necessário */}
                                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-8">
                                    <p className="text-white font-medium italic">"Advocacia é coragem."</p>
                                </div>
                            </div>
                        </div>

                        {/* COLUNA DIREITA: BIO E DADOS */}
                        <div className="w-full lg:w-7/12 space-y-10">
                            <div>
                                <h2 className="text-4xl font-bold text-foreground mb-4">Ian Granja</h2>
                                <p className="text-lg text-accent font-medium mb-6">Sócio Fundador & Advogado Sênior</p>

                                <div className="prose prose-lg text-muted-foreground leading-relaxed text-justify">
                                    <p className="mb-4">
                                        Com uma atuação sólida no mercado jurídico, fundei o escritório com uma premissa clara:
                                        <span className="text-foreground font-semibold"> o Direito não precisa ser complicado, ele precisa ser efetivo.</span>
                                    </p>
                                    <p>
                                        Minha trajetória é marcada pela defesa intransigente dos interesses dos meus clientes, combinando rigor técnico acadêmico com uma visão prática dos tribunais. Acredito que cada caso exige uma estratégia única, desenhada sob medida para alcançar o melhor resultado possível no menor tempo hábil.
                                    </p>
                                </div>
                            </div>

                            {/* Grid de Credenciais (Box visualmente fechado) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {credentials.map((cred, i) => (
                                    <div key={i} className="bg-muted/30 p-4 rounded-2xl border border-border flex flex-col items-center text-center hover:bg-muted/50 transition-colors">
                                        <cred.icon className="w-6 h-6 text-accent mb-2" />
                                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">{cred.label}</span>
                                        <span className="text-lg font-bold text-foreground">{cred.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 flex flex-col sm:flex-row gap-4">
                                <Button size="xl" className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-8 h-14 shadow-lg" asChild>
                                    <NavLink to="#" isContactLink>
                                        Agendar Reunião
                                        <ArrowRight className="ml-2 w-5 h-5" />
                                    </NavLink>
                                </Button>
                                <Button variant="outline" size="xl" className="rounded-full px-8 h-14 border-border hover:bg-primary" asChild>
                                    <NavLink to="/atuacao">
                                        Ver Áreas de Atuação
                                    </NavLink>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- PILARES E VALORES: BG-PRIMARY (DARK MODE PARA CONTRASTE) --- */}
            {/* Isso resolve a sensação de "disperso". O fundo escuro agrupa tudo. */}
            <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl"></div>

                <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
                        <div className="max-w-2xl">
                            <span className="text-accent font-bold uppercase tracking-widest text-sm mb-2 block">Nossa Filosofia</span>
                            <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground">
                                Princípios que nos guiam.
                            </h2>
                        </div>
                        <p className="text-primary-foreground/60 max-w-md text-right md:text-left">
                            Não somos apenas advogados. Somos parceiros comprometidos com a ética e a eficiência.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {values.map((value, index) => (
                            <div key={index} className="group p-6 rounded-3xl bg-primary-foreground/5 border border-primary-foreground/10 hover:bg-primary-foreground/10 transition-all duration-300">
                                <div className="mb-6 inline-flex p-3 rounded-2xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-primary transition-colors">
                                    <value.icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold text-primary-foreground mb-3">{value.title}</h3>
                                <p className="text-sm text-primary-foreground/70 leading-relaxed">
                                    {value.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- LOCALIZAÇÃO: ESTRUTURA UNIFICADA --- */}
            <section className="py-24 bg-background">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-foreground">Onde nos encontrar</h2>
                        <p className="text-muted-foreground mt-2">Uma estrutura moderna pronta para lhe receber.</p>
                    </div>

                    <div className="rounded-[2.5rem] overflow-hidden shadow-2xl border border-border bg-card grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">

                        {/* Coluna Informações (Visualmente leve) */}
                        <div className="lg:col-span-4 p-10 flex flex-col justify-center bg-card">
                            <div className="space-y-8">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-accent/10 rounded-xl text-accent">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-foreground text-lg mb-1">Endereço</h4>
                                        <p className="text-muted-foreground text-sm leading-relaxed">
                                            Av. Cardoso de Sá, n. 860, sala 5<br/>
                                            Cidade Universitária<br/>
                                            Petrolina - PE
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-accent/10 rounded-xl text-accent">
                                        <Briefcase className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-foreground text-lg mb-1">Atendimento</h4>
                                        <p className="text-muted-foreground text-sm">
                                            Segunda a Sexta<br/>
                                            08h às 18h
                                        </p>
                                    </div>
                                </div>

                                <Button className="w-full rounded-full h-12 mt-4" variant="outline" asChild>
                                    <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">
                                        Traçar Rota <MapPin className="ml-2 w-4 h-4" />
                                    </a>
                                </Button>
                            </div>
                        </div>

                        {/* Coluna Mapa (Expandido) */}
                        <div className="lg:col-span-8 h-[400px] lg:h-auto bg-muted relative border-l border-border/50">
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