import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { Card, CardContent } from "@/components/ui/card";
import {
    Briefcase,
    Users,
    Shield,
    Scale,
    TrendingUp,
    Home,
    Heart,
    Building2,
    Sparkles,
    CheckCircle2,
    ArrowRight,
    X,
} from "lucide-react";
import { useState, useEffect } from "react";

const Atuacao = () => {
    const [selectedArea, setSelectedArea] = useState(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const practiceAreas = [
        {
            icon: Briefcase,
            title: "Direito Bancário",
            description:
                "Defendemos os consumidores contra práticas abusivas de instituições financeiras, com foco na recuperação de veículos apreendidos, revisão de contratos e defesa em execuções bancárias.",
            services: [
                "Recuperação de veículos financiados",
                "Revisão de contratos bancários",
                "Defesa em execuções bancárias",
                "Questionamento de juros abusivos",
                "Ações contra cobranças indevidas",
            ],
        },
        {
            icon: Users,
            title: "Direito Trabalhista",
            description:
                "Representamos trabalhadores e empresas em disputas judiciais e extrajudiciais, priorizando soluções céleres e seguras para rescisões, verbas e relações de trabalho.",
            services: [
                "Reclamações trabalhistas",
                "Rescisões contratuais",
                "Horas extras e adicionais",
                "Assédio moral e dano moral",
                "Consultoria preventiva para empresas",
            ],
        },
        {
            icon: Shield,
            title: "Direito do Consumidor",
            description:
                "Atuamos na defesa de consumidores em casos de cobranças indevidas, negativação irregular, falhas na prestação de serviços e descumprimento contratual.",
            services: [
                "Negativação indevida",
                "Defeitos em produtos e serviços",
                "Cobranças abusivas",
                "Cancelamento de contratos",
                "Indenizações por danos morais e materiais",
            ],
        },
        {
            icon: Scale,
            title: "Direito Empresarial",
            description:
                "Assessoria jurídica completa para empresas e associações de proteção veicular, com foco em contratos, responsabilidade civil, regulamentação e defesa administrativa.",
            services: [
                "Elaboração e revisão de contratos",
                "Consultoria societária",
                "Recuperação judicial",
                "Defesas administrativas",
                "Compliance empresarial",
            ],
        },
        {
            icon: TrendingUp,
            title: "Superendividamento",
            description:
                "Ajudamos consumidores a reorganizar sua vida financeira, com ações para revisão de dívidas, negociação com bancos e defesa contra abusos de crédito.",
            services: [
                "Negociação de dívidas",
                "Ações de superendividamento",
                "Suspensão de protestos",
                "Planejamento financeiro jurídico",
                "Defesa contra execuções múltiplas",
            ],
        },
        {
            icon: Heart,
            title: "Planos de Saúde",
            description:
                "Defesa de usuários contra negativas de cobertura, reajustes abusivos, cancelamentos indevidos e demora em autorizações de tratamentos médicos.",
            services: [
                "Negativas de cobertura",
                "Reajustes abusivos",
                "Cancelamento indevido",
                "Autorização de cirurgias e exames",
                "Internações de emergência",
            ],
        },
        {
            icon: Home,
            title: "Direito Imobiliário",
            description:
                "Atuamos em questões relacionadas a compra e venda de imóveis, distratos, financiamentos, usucapião e problemas com construtoras e incorporadoras.",
            services: [
                "Contratos de compra e venda",
                "Distrato e rescisão",
                "Usucapião",
                "Ações contra construtoras",
                "Regularização imobiliária",
            ],
        },
        {
            icon: Building2,
            title: "Direito Civil",
            description:
                "Atuação ampla em questões cíveis, incluindo responsabilidade civil, contratos, família e sucessões, sempre com foco na melhor solução para nossos clientes.",
            services: [
                "Ações indenizatórias",
                "Contratos em geral",
                "Inventários e partilhas",
                "Divórcios e união estável",
                "Pensão alimentícia",
            ],
        },
    ];

    const howWeWork = [
        {
            step: "01",
            title: "Análise Inicial",
            description: "Avaliação completa do seu caso sem compromisso.",
            icon: Shield,
        },
        {
            step: "02",
            title: "Estratégia",
            description: "Desenvolvimento de um plano de ação personalizado.",
            icon: TrendingUp,
        },
        {
            step: "03",
            title: "Execução",
            description: "Atuação focada com acompanhamento constante.",
            icon: Scale,
        },
        {
            step: "04",
            title: "Resultado",
            description: "Solução efetiva para o seu problema jurídico.",
            icon: CheckCircle2,
        },
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prevIndex) =>
                (prevIndex + 1) % howWeWork.length
            );
        }, 2000);


        return () => clearInterval(interval);
    }, [howWeWork.length]);

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            <Navigation />

            <section className="relative pt-24 pb-16 overflow-hidden bg-primary sm:pt-32 sm:pb-24">
                <div className="absolute inset-0">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent rounded-full filter blur-3xl animate-pulse"></div>
                        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
                    </div>
                </div>

                <div className="absolute top-20 left-10 w-20 h-20 border-2 border-accent/20 rounded-full hidden sm:block"></div>
                <div className="absolute bottom-20 right-10 w-32 h-32 border-2 border-accent/20 rounded-full hidden sm:block"></div>
                <div className="absolute top-1/2 right-1/4 w-16 h-16 border border-accent/10 rotate-45 hidden sm:block"></div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-4xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 backdrop-blur-sm rounded-full text-accent text-sm mb-6 border border-accent/30">
                            <span>Advocacia Full Service</span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold mb-6 text-primary-foreground">
                            Áreas de
                            <span className="block text-accent mt-2">Atuação</span>
                        </h1>
                        <p className="text-lg sm:text-2xl text-primary-foreground/80 max-w-3xl mx-auto leading-relaxed">
                            Especialização em diversas áreas do direito. Soluções completas e personalizadas para cada necessidade.
                        </p>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0">
                    <svg className="w-full h-16" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className="fill-background"></path>
                    </svg>
                </div>
            </section>

            <section className="py-24 relative bg-gradient-to-br from-background via-muted/10 to-background">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full filter blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/10 rounded-full filter blur-3xl"></div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <div className="inline-block px-4 py-2 bg-accent/10 backdrop-blur-sm rounded-full text-accent text-sm mb-4 font-semibold border border-accent/20">
                            Nossas Especialidades
                        </div>
                        <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
                            Expertise em Diversas Áreas
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Clique em qualquer área para ver todos os serviços oferecidos
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
                        {practiceAreas.map((area, index) => (
                            <div
                                key={index}
                                className="group relative h-full cursor-pointer"
                                onClick={() => setSelectedArea(area)}
                            >
                                <div className="absolute -inset-1 bg-gradient-to-br from-accent/30 to-accent/10 rounded-2xl blur-lg opacity-100 lg:opacity-0 group-hover:lg:opacity-100 transition duration-500"></div>

                                <Card className="relative bg-muted/40 dark:bg-zinc-800/40 border border-accent/40 hover:border-accent/80 rounded-2xl overflow-hidden h-full transition-all duration-500 group-hover:shadow-2xl translate-y-0 lg:group-hover:-translate-y-2 lg:-translate-y-0 backdrop-blur-sm">
                                    <CardContent className="p-6 flex flex-col h-full">
                                        <div className="mb-4">
                                            <div className="inline-flex p-4 rounded-xl bg-accent border border-accent/50 lg:group-hover:bg-accent group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-md">
                                                <area.icon className="h-8 w-8 text-accent-foreground lg:text-accent-foreground group-hover:lg:text-accent-foreground transition-colors duration-300" />
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-accent lg:text-foreground group-hover:lg:text-accent transition-colors duration-300 mb-3">
                                            {area.title}
                                        </h3>

                                        <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-grow line-clamp-3">
                                            {area.description}
                                        </p>

                                        <div className="h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent mb-4"></div>

                                        <div className="space-y-2">
                                            <h4 className="text-xs font-semibold text-accent uppercase tracking-wide mb-2 flex items-center gap-2">
                                                <div className="h-px flex-1 bg-accent/20"></div>
                                                <span>Principais Serviços</span>
                                                <div className="h-px flex-1 bg-accent/20"></div>
                                            </h4>
                                            <ul className="space-y-2">
                                                {area.services.slice(0, 3).map((service, idx) => (
                                                    <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                                                        <div className="w-4 h-4 rounded-full bg-accent/30 border border-accent/60 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-accent group-hover:border-accent/70 group-hover:scale-110 transition-all duration-300">
                                                            <CheckCircle2 className="w-2.5 h-2.5 text-accent group-hover:text-accent-foreground transition-colors duration-300" />
                                                        </div>
                                                        <span className="line-clamp-1">{service}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            {area.services.length > 3 && (
                                                <div className="mt-3 pt-3 border-t border-accent/10">
                                                    <p className="text-xs text-accent font-semibold flex items-center gap-2">
                                                        +{area.services.length - 3} outros serviços
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-accent/50 via-accent to-accent/50 rounded-b-2xl transform scale-x-100 lg:scale-x-0 group-hover:lg:scale-x-100 transition duration-500"></div>

                                        <div className="absolute top-4 right-4 flex items-center gap-2">
                                            <span className="text-xs font-semibold text-accent opacity-90 lg:hidden">
                                                Ver Serviços
                                            </span>
                                            <div className="w-7 h-7 rounded-full bg-accent/20 backdrop-blur-sm border border-accent/40 flex items-center justify-center">
                                                <ArrowRight className="w-4 h-4 text-accent" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    </div>
                </div>

                {selectedArea && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectedArea(null)}
                    >
                        <div
                            className="relative bg-card rounded-lg max-w-2xl w-full max-h-[95vh] flex flex-col border-2 border-accent/30 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-gradient-to-br from-primary to-primary/90 p-6 sm:p-8 relative rounded-lg overflow-hidden flex-shrink-0">
                                <div className="absolute inset-0 opacity-10">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-accent rounded-full filter blur-3xl animate-pulse"></div>
                                </div>
                                <div className="relative flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="p-3 sm:p-4 rounded-xl bg-accent/20 border-2 border-accent/40">
                                            <selectedArea.icon className="h-8 w-8 sm:h-10 sm:w-10 text-accent" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl sm:text-3xl font-bold  text-primary-foreground mb-1">
                                                {selectedArea.title}
                                            </h3>
                                            <p className="text-sm text-primary-foreground/80 leading-relaxed">
                                                {selectedArea.description}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedArea(null)}
                                        className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 border border-primary-foreground/20 flex items-center justify-center transition-all duration-300 hover:scale-110"
                                    >
                                        <X className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 sm:p-8 overflow-y-auto flex-1">
                                <div className="flex items-center gap-2 mb-4 sm:mb-6">
                                    <div className="h-px flex-1 bg-accent/20"></div>
                                    <h4 className="text-xs sm:text-sm font-semibold text-accent uppercase tracking-wider">
                                        Todos os Serviços Oferecidos
                                    </h4>
                                    <div className="h-px flex-1 bg-accent/20"></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                    {selectedArea.services.map((service, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-accent/40 hover:bg-accent/10 hover:border-accent/60 transition-all duration-300 group"
                                        >
                                            <div className="w-5 h-5 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-accent group-hover:scale-110 transition-all duration-300">
                                                <CheckCircle2 className="w-3 h-3 text-accent group-hover:text-accent-foreground transition-colors duration-300" />
                                            </div>
                                            <span className="text-xs sm:text-sm text-foreground leading-relaxed">
                                                {service}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-accent/10 to-accent/5 border-2 border-accent/30">
                                    <p className="text-center text-xs sm:text-sm text-muted-foreground mb-4">
                                        Precisa de ajuda com <span className="font-semibold text-accent">{selectedArea.title}</span>?
                                    </p>
                                    <Button size="lg" className="w-full bg-accent hover:bg-accent/70 text-accent-foreground" asChild>
                                        <NavLink to="#" isContactLink>
                                            Falar com um Especialista
                                            <ArrowRight className="ml-2 w-4 h-4" />
                                        </NavLink>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <section className="py-24 bg-primary relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-1/4 w-80 h-80 bg-accent rounded-full filter blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-accent rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
                </div>

                <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(hsl(47 22% 46% / 0.3) 1px, transparent 1px)', backgroundSize: '100px 100px' }}></div>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <div className="inline-block px-4 py-2 bg-accent/10 backdrop-blur-sm rounded-full text-accent text-sm mb-4 font-semibold border border-accent/30">
                            Nossa Metodologia
                        </div>
                        <h2 className="text-4xl sm:text-5xl font-bold text-primary-foreground mb-4">
                            Como Trabalhamos
                        </h2>
                        <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto">
                            Nossa metodologia garante resultados efetivos e transparência total em cada etapa.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
                        {howWeWork.map((item, index) => {
                            const isActive = index === activeIndex;

                            return (
                                <div key={item.step} className="relative pb-12 lg:pb-0"
                                     onMouseEnter={() => setActiveIndex(index)}
                                     onMouseLeave={() => {}}
                                >
                                    <div
                                        className={`relative bg-primary-foreground/5 backdrop-blur-sm rounded-2xl overflow-hidden border border-accent/20 transition-all duration-500 
                                            ${isActive ? 'bg-primary-foreground/10 border-accent/50' : 'hover:border-accent/50'}
                                        `}
                                    >
                                        <div
                                            className={`absolute left-0 top-0 bottom-0 w-1 bg-accent transform origin-top transition-transform duration-500 
                                                ${isActive ? 'scale-y-100' : 'scale-y-0'}
                                            `}
                                        ></div>

                                        <div className="p-8">
                                            <div className="flex items-center justify-between mb-6">
                                                <div
                                                    className={`text-5xl font-bold text-accent/20 transition-colors duration-300
                                                        ${isActive ? 'text-accent/40' : ''}
                                                    `}
                                                >
                                                    {item.step}
                                                </div>
                                                <div
                                                    className={`w-12 h-12 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center transition-all duration-300
                                                        ${isActive ? 'bg-accent scale-110' : 'hover:bg-accent hover:scale-110'}
                                                    `}
                                                >
                                                    <item.icon
                                                        className={`w-6 h-6 text-accent transition-colors duration-300
                                                            ${isActive ? 'text-accent-foreground' : 'hover:text-accent-foreground'}
                                                        `}
                                                    />
                                                </div>
                                            </div>

                                            <div
                                                className={`h-px bg-accent/20 mb-6 transform origin-left transition-transform duration-500
                                                    ${isActive ? 'scale-x-100' : 'scale-x-0'}
                                                `}
                                            ></div>

                                            <h3
                                                className={`text-xl font-bold text-primary-foreground mb-3 transition-colors duration-300
                                                    ${isActive ? 'text-accent' : ''}
                                                `}
                                            >
                                                {item.title}
                                            </h3>
                                            <p className="text-sm text-primary-foreground/70 leading-relaxed">
                                                {item.description}
                                            </p>
                                        </div>

                                        <div
                                            className={`absolute bottom-0 right-0 w-16 h-16 border-r border-b border-accent/20 rounded-tr-2xl transform transition-transform duration-500
                                                ${isActive ? 'translate-x-0 translate-y-0' : 'translate-x-8 translate-y-8'}
                                            `}
                                        ></div>
                                    </div>

                                    {index < howWeWork.length - 1 && (
                                        <>
                                            <div className="absolute left-1/2 bottom-0 w-px h-8 bg-accent/30 transform -translate-x-1/2 translate-y-full lg:hidden"></div>
                                            <div className="absolute left-1/2 bottom-0 w-2 h-2 rounded-full bg-accent/60 border-2 border-primary transform -translate-x-1/2 translate-y-full z-10 lg:hidden"></div>
                                        </>
                                    )}

                                    {index < howWeWork.length - 1 && (
                                        <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 rounded-full bg-accent/40"></div>
                                                <div className="w-2 h-px bg-accent/40"></div>
                                                <div className="w-2 h-2 rounded-full bg-accent/40"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="py-24 bg-muted/50 relative overflow-hidden">
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-0 left-1/3 w-96 h-96 bg-primary rounded-full filter blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-primary rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
                </div>

                <div className="absolute inset-0 opacity-0">
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(0 0% 9%) 1px, transparent 0)',
                        backgroundSize: '50px 50px'
                    }}></div>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 backdrop-blur-sm rounded-full text-primary text-sm mb-6 border border-primary/30">
                            <span className="font-semibold">Estamos Aqui Para Ajudar</span>
                        </div>

                        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
                            Não Encontrou a Área que Procura?
                        </h2>
                        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
                            Entre em contato conosco. Nossa equipe está pronta para avaliar seu caso e oferecer a melhor solução jurídica.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button
                                size="lg"
                                className="px-10 text-lg"
                                asChild
                            >
                                <NavLink to="#" isContactLink>
                                    Falar com um Especialista
                                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </NavLink>
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="text-lg"
                                asChild
                            >
                                <NavLink to="/sobre">Conheça Nossa História</NavLink>
                            </Button>
                        </div>

                        <div className="mt-16 flex items-center justify-center gap-8">
                            <div className="text-center">
                                <div className="text-4xl font-bold text-foreground mb-1">5+</div>
                                <div className="text-sm text-muted-foreground">Anos de Experiência</div>
                            </div>
                            <div className="h-12 w-px bg-accent-foreground/30"></div>
                            <div className="text-center">
                                <div className="text-4xl font-bold text-foreground mb-1">8</div>
                                <div className="text-sm text-muted-foreground">Áreas de Atuação</div>
                            </div>
                            <div className="h-12 w-px bg-accent-foreground/30"></div>
                            <div className="text-center">
                                <div className="text-4xl font-bold text-foreground mb-1">100%</div>
                                <div className="text-sm text-muted-foreground">Compromisso</div>
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