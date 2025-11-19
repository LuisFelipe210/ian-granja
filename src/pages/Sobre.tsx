import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import lawyerPortrait from "@/assets/lawyer-portrait.jpg";
import { Target, Users, Scale, Briefcase, Sparkles, TrendingUp, ArrowRight, MapPin, Stethoscope, Award } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface MapEmbedProps {
    address: string;
    iframeSrc: string;
}

const MapEmbed: React.FC<MapEmbedProps> = ({ address, iframeSrc }) => {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="max-w-4xl mx-auto text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent rounded-full text-sm mb-4 font-semibold border border-accent/20">
                    <MapPin className="w-4 h-4" />
                    <span>Localização do Escritório</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                    Estamos em Petrolina-PE
                </h2>
                <p className="text-lg text-muted-foreground">
                    {address}
                </p>
            </div>

            <div className="relative w-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl border-4 border-accent/30 aspect-[16/9] md:aspect-[21/9]">
                <iframe
                    src={iframeSrc}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={false}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Localização Ian Granja Advocacia"
                    className="absolute inset-0"
                />
                <div className={cn(
                    "absolute inset-0 pointer-events-none transition-all duration-500",
                    "bg-transparent dark:bg-background/20"
                )} />
            </div>

            <div className="mt-8 text-center">
                <a
                    href="https://wa.me/5587988448690"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent/80 font-semibold transition-colors flex items-center justify-center gap-2"
                >
                    Atendimento disponível também 100% online
                    <MapPin className="w-4 h-4" />
                </a>
            </div>
        </div>
    );
};

const Sobre = () => {
    const values = [
        {
            icon: Scale,
            title: "Compromisso Ético",
            description: "Nossa reputação é construída pela transparência, confiança e comprometimento com resultados.",
        },
        {
            icon: Target,
            title: "Vitórias Relevantes",
            description: "O escritório tem por objetivo alcançar vitórias relevantes e desenvolver estratégias personalizadas em cada caso.",
        },
        {
            icon: Users,
            title: "Atuação Especializada",
            description: "Contamos com atuação especializada e sólida formação jurídica para oferecer soluções seguras e eficazes.",
        },
        {
            icon: Briefcase,
            title: "Advogados Qualificados",
            description: "Advogados Qualificados com sólida formação jurídica e atuação estratégica.",
        },
    ];

    const specialization = [
        "Bacharelado em Direito: Formado com sólida base jurídica e destaque acadêmico.",
        "OAB/PE nº 61.107: Registro profissional ativo em Pernambuco.",
        "Foco nas áreas de Direito Bancário, Trabalhista e Empresarial.",
        "Atuação destacada em projetos sociais durante a graduação, com foco na defesa de direitos fundamentais.",
    ];

    const addressDetails = {
        address: "Avenida Cardoso de Sá, n. 860, sala 5, Cidade Universitária, Centro Empresarial Sergio Cabral, CEP 56302-110",
        iframeSrc: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3947.5342426867015!2d-40.50570702581029!3d-9.379201590736173!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x7a2d04a60015099%3A0x6a2e4f04c64b611e!2sAv.%20Cardoso%20de%20S%C3%A1%2C%20860%20-%20Cidade%20Universit%C3%A1ria%2C%20Petrolina%20-%20PE%2C%2056302-110%2C%20Brasil!5e0!3m2!1spt-BR!2sus!4v1703632420459!5m2!1spt-BR!2sus",
    };

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            <Navigation />
            <section className="relative pt-24 pb-20 overflow-hidden bg-primary sm:pt-32 sm:pb-28">
                <div className="absolute inset-0">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 -left-4 w-72 h-72 bg-accent rounded-full mix-blend-screen filter blur-3xl animate-pulse"></div>
                        <div className="absolute top-0 -right-4 w-72 h-72 bg-accent rounded-full mix-blend-screen filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
                        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-accent rounded-full mix-blend-screen filter blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
                    </div>
                </div>

                <div className="absolute top-20 left-10 w-20 h-20 border-2 border-accent/20 rounded-full"></div>
                <div className="absolute bottom-20 right-10 w-32 h-32 border-2 border-accent/20 rounded-full"></div>
                <div className="absolute top-1/2 left-1/4 w-16 h-16 border border-accent/10 rotate-45"></div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-5xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 backdrop-blur-sm rounded-full text-accent text-sm mb-6 border border-accent/30">
                            <Sparkles className="w-4 h-4" />
                            <span>Advocacia Estratégica e Personalizada</span>
                        </div>
                        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 text-primary-foreground">
                            Conheça Nossa
                            <span className="block text-accent mt-2">
                                História
                            </span>
                        </h1>
                        <p className="text-xl sm:text-2xl text-primary-foreground/80 max-w-3xl mx-auto leading-relaxed">
                            Nosso compromisso é simplificar o Direito e entregar segurança jurídica com clareza e confiança.
                        </p>

                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0">
                    <svg className="w-full h-16" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className="fill-background"></path>
                    </svg>
                </div>
            </section>

            <section className="py-24 relative bg-background">
                <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full filter blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-muted/50 rounded-full filter blur-3xl"></div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-br from-accent/30 to-accent/10 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition duration-700"></div>
                            <div className="relative max-w-sm mx-auto">
                                <img
                                    src={lawyerPortrait}
                                    alt="Ian Granja"
                                    loading="lazy"
                                    width={384}
                                    height={400}
                                    className="rounded-2xl shadow-2xl w-full h-auto relative z-10 transform group-hover:scale-[1.02] transition duration-500"
                                />
                                <div className="absolute -bottom-6 -right-6 w-full h-full border-2 border-accent/30 rounded-2xl hidden md:block"></div>
                            </div>
                            <div className="absolute -top-4 -left-4 w-24 h-24 border-t-4 border-l-4 border-accent/40 rounded-tl-3xl hidden md:block"></div>
                        </div>

                        <div className="space-y-8">
                            <div>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent rounded-full text-sm font-semibold mb-4 border border-accent/20">
                                    <TrendingUp className="w-4 h-4" />
                                    Ian Granja ADVs
                                </div>
                                <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
                                    Advocacia com Foco
                                    <span className="block text-accent">
                                        Estratégico
                                    </span>
                                </h2>
                            </div>

                            <p className="text-lg text-muted-foreground leading-relaxed">
                                O escritório foi fundado com o objetivo de alcançar vitórias relevantes e desenvolver estratégias personalizadas em cada caso, com <span className="font-semibold text-foreground">5 anos de atuação sólida</span>.
                            </p>

                            <div className="relative pl-8 py-6 border-l-4 border-accent bg-accent/5 rounded-r-lg">
                                <blockquote className="text-xl text-foreground italic font-medium leading-relaxed">
                                    "Direito não é sobre vencer a qualquer custo. É sobre proteger o que importa com estratégia, ética e verdade."
                                </blockquote>
                            </div>

                            <p className="text-lg text-muted-foreground leading-relaxed">
                                Cada cliente é tratado com seriedade e atenção, buscando simplificar o Direito e entregar segurança jurídica com clareza e confiança.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300 group" asChild>
                                    <NavLink to="#" isContactLink>
                                        Fale com um Advogado
                                        <Sparkles className="ml-2 w-4 h-4 group-hover:rotate-12 transition-transform" />
                                    </NavLink>
                                </Button>
                                <Button size="lg" variant="outline" className="border-2 border-foreground/20 hover:border-accent hover:bg-accent/5" asChild>
                                    <NavLink to="/atuacao">Ver Áreas de Atuação</NavLink>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 bg-muted/30 relative overflow-hidden">
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--accent)) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
                    <div className="text-center mb-16">
                        <div className="inline-block px-4 py-2 bg-accent/10 backdrop-blur-sm rounded-full text-accent text-sm mb-4 font-semibold border border-accent/20">
                            Nossos Diferenciais
                        </div>
                        <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">Nossos Pilares</h2>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Os princípios que guiam cada decisão e ação em nosso escritório.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {values.map((value, index) => (
                            <div key={index} className="group relative">
                                <div className="absolute -inset-0.5 bg-accent rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-500"></div>

                                <Card className="relative bg-card border-border hover:border-accent/50 rounded-2xl p-6 h-full transition-all duration-500 group-hover:transform group-hover:-translate-y-2 group-hover:shadow-xl">
                                    <CardContent className="p-0">
                                        <div className="inline-flex p-3 rounded-xl bg-accent/10 border-2 border-accent/20 mb-4 group-hover:bg-accent/20 group-hover:border-accent/40 transition-all duration-300">
                                            <value.icon className="h-6 w-6 text-accent" />
                                        </div>

                                        <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-accent transition-colors duration-300">{value.title}</h3>
                                        <p className="text-muted-foreground leading-relaxed">{value.description}</p>

                                        <div className="absolute bottom-0 left-0 w-full h-1 bg-accent rounded-b-2xl transform scale-x-0 group-hover:scale-x-100 transition duration-500"></div>
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-24 bg-primary relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-10 w-64 h-64 bg-accent rounded-full filter blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '3s' }}></div>
                </div>

                <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(hsl(var(--accent) / 0.2) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--accent) / 0.2) 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
                    <div className="text-center mb-16">
                        <div className="inline-flex p-4 bg-accent/10 backdrop-blur-sm rounded-2xl mb-6 border border-accent/20">
                            <Stethoscope className="h-12 w-12 text-accent" />
                        </div>
                        <h2 className="text-4xl sm:text-5xl font-bold text-primary-foreground mb-6">
                            Formação e Foco de Atuação
                        </h2>
                        <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto">
                            Sólida base jurídica e atuação focada nas áreas mais relevantes para o cliente.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {specialization.map((item, index) => (
                            <div key={index} className="group flex items-start space-x-4 bg-primary-foreground/5 backdrop-blur-md rounded-2xl p-6 border border-accent/20 hover:bg-primary-foreground/10 hover:border-accent/40 transition-all duration-300">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent border-2 border-accent/50 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <span className="text-primary text-lg font-bold">✓</span>
                                </div>
                                <p className="text-primary-foreground/90 leading-relaxed">{item}</p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-accent/10 backdrop-blur-md rounded-2xl p-8 border-2 border-accent/30">
                        <p className="text-primary-foreground/90 text-center leading-relaxed">
                            <span className="font-semibold text-accent">OAB/PE nº 61.107.</span> Atuação como advogado nas áreas de Direito Bancário, Trabalhista e Empresarial, com foco em proteção veicular, defesa do consumidor e estratégias de recuperação de ativos.
                        </p>
                    </div>
                </div>
            </section>

            <section className="bg-muted/30 relative">
                <MapEmbed
                    address={addressDetails.address}
                    iframeSrc={addressDetails.iframeSrc}
                />
            </section>

            <section className="py-24 bg-background relative overflow-hidden">
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/20 rounded-full filter blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-muted rounded-full filter blur-3xl animate-pulse"></div>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="max-w-4xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent rounded-full text-sm font-semibold mb-6 border border-accent/20">
                            <Sparkles className="w-4 h-4" />
                            Dê o Primeiro Passo
                        </div>

                        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6">
                            Agende Sua
                            <span className="block text-accent mt-2">
                                Consulta
                            </span>
                        </h2>

                        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                            Descubra como a estratégia correta pode proteger o que é importante para você.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 py-6 shadow-xl hover:shadow-2xl transition-all duration-300 group" asChild>
                                <NavLink to="#" isContactLink>
                                    Fale com um Especialista
                                    <Award className="ml-2 w-5 h-5 group-hover:rotate-12 transition-transform" />
                                </NavLink>
                            </Button>
                            <Button size="lg" variant="outline" className="border-2 border-foreground/20 hover:border-accent hover:bg-accent hover:text-accent-foreground text-lg px-8 py-6" asChild>
                                <NavLink to="/atuacao">Ver Áreas de Atuação</NavLink>
                            </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-8 mt-16 max-w-2xl mx-auto">
                            <div className="text-center group">
                                <div className="text-3xl font-bold text-foreground mb-1 group-hover:text-accent transition-colors duration-300">5+</div>
                                <div className="text-sm text-muted-foreground">Anos de Experiência</div>
                            </div>
                            <div className="text-center group">
                                <div className="text-3xl font-bold text-foreground mb-1 group-hover:text-accent transition-colors duration-300">OAB/PE</div>
                                <div className="text-sm text-muted-foreground">Registro Ativo</div>
                            </div>
                            <div className="text-center group">
                                <div className="text-3xl font-bold text-foreground mb-1 group-hover:text-accent transition-colors duration-300">100%</div>
                                <div className="text-sm text-muted-foreground">Compromisso Ético</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default Sobre;