import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NavLink } from "@/components/NavLink";
import heroImage from "@/assets/hero-law-office.jpg";
import lawyerPortrait from "@/assets/lawyer-portrait.jpg";
// REMOVIDO: importações problemáticas do Carrossel 3D
import {
    Scale,
    Briefcase,
    Users,
    Shield,
    Award,
    CheckCircle,
    Phone,
    ArrowRight,
    Quote, // MANTIDO para o Testemunhal Estático
    Heart,
    Goal,
} from "lucide-react";

const Index = () => {
    // Lista de serviços para a Home (só os 4 principais, porra)
    const homePracticeAreas = [
        {
            icon: Briefcase,
            title: "Direito Bancário",
            description:
                "Foco na recuperação de veículos e revisão de contratos abusivos.",
        },
        {
            icon: Users,
            title: "Direito Trabalhista",
            description:
                "Representamos trabalhadores e empresas em disputas judiciais.",
        },
        {
            icon: Shield,
            title: "Direito do Consumidor",
            description:
                "Atuamos na defesa contra cobranças indevidas e negativação irregular.",
        },
        {
            icon: Heart,
            title: "Planos de Saúde",
            description:
                "Defesa contra negativas de cobertura e reajustes abusivos.",
        },
    ];

    // Os diferenciais (porque contratar)
    const whyChooseUs = [
        {
            icon: Award,
            title: "Histórico de Resultados Reais",
            description:
                "Atuamos com foco em soluções práticas e eficazes, buscando decisões favoráveis que tragam alívio real.",
        },
        {
            icon: CheckCircle,
            title: "Transparência nos Honorários",
            description:
                "Nossos clientes sabem exatamente o que esperar do início ao fim, sem surpresas ou letras miúdas.",
        },
        {
            icon: Users,
            title: "Atendimento Humanizado",
            description:
                "Mais do que processos, entregamos orientação jurídica com empatia, clareza e comprometimento total.",
        },
    ];

    // As estatísticas
    const stats = [
        { number: "2000+", label: "Consultas Realizadas" },
        { number: "90%", label: "Índice de Satisfação" },
        { number: "5+", label: "Anos de Experiência" },
        { number: "100%", label: "Dedicação aos Clientes" },
    ];

    // Os testemunhais (versão estável, 2 colunas)
    const testimonials = [
        {
            quote: "O Dr. Ian não mediu esforços para resolver meu problema com o banco. Pensei que perderia meu carro, mas ele agiu rápido e com uma competência que eu nunca tinha visto. Transparência total e um resultado que mudou minha vida.",
            name: "Maria S. Almeida",
            role: "Cliente de Direito Bancário",
            avatar: "https://randomuser.me/api/portraits/women/68.jpg"
        },
        {
            quote: "Meu carro havia sido apreendido e eu achava que não tinha saída. O Dr. Ian foi extremamente atencioso e conseguiu resolver tudo com rapidez. Sou muito grato!",
            name: "Nelson Tavares",
            role: "Recife/PE",
            avatar: "https://randomuser.me/api/portraits/men/32.jpg"
        },
        {
            quote: "Tentei resolver sozinho um problema com o banco e só me estressei. Quando procurei o escritório, recebi um atendimento claro e resolutivo. Recomendo demais.",
            name: "Vanessa Silva",
            role: "Salvador/BA",
            avatar: "https://randomuser.me/api/portraits/women/44.jpg"
        },
    ];

    return (
        <div className="min-h-screen bg-background">
            <Navigation />

            <section className="relative h-screen flex items-center justify-center overflow-hidden">
                <div
                    className="absolute inset-0 z-0"
                    style={{
                        backgroundImage: `linear-gradient(to top, hsl(var(--primary) / 0.95) 10%, hsl(var(--primary) / 0.6) 100%), url(${heroImage})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                />
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-primary-foreground mb-6 animate-in fade-in-0 slide-in-from-bottom-10 duration-1000 delay-300">
                        Oferecemos Soluções Jurídicas
                        <br />
                        <span className="text-accent">com Foco no Resultado</span>
                    </h1>
                    <p className="text-lg sm:text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto animate-in fade-in-0 slide-in-from-bottom-10 duration-1000 delay-500">
                        Advocacia experiente e especializada. Atendimento personalizado com compromisso em entregar resultados práticos.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in-0 slide-in-from-bottom-10 duration-1000 delay-700">
                        <Button size="lg" asChild className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                            <NavLink to="#" isContactLink>
                                <Phone className="mr-2 h-5 w-5" />
                                Falar com Advogado
                            </NavLink>
                        </Button>
                        <Button size="lg" variant="outline" asChild className="w-full sm:w-auto bg-transparent text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary">
                            <NavLink to="/atuacao">Conheça Nossa Atuação</NavLink>
                        </Button>
                    </div>
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto animate-in fade-in-0 slide-in-from-bottom-10 duration-1000 delay-900">
                        <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4 border-l-4 border-accent border-y-primary-foreground/20 border-r-primary-foreground/20">
                            <p className="text-primary-foreground font-semibold">Atuação Nacional</p>
                            <p className="text-primary-foreground/80 text-sm">Advogados presentes em todo o país</p>
                        </div>
                        <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4 border-l-4 border-accent border-y-primary-foreground/20 border-r-primary-foreground/20">
                            <p className="text-primary-foreground font-semibold">Telefone para Contato</p>
                            <p className="text-primary-foreground/80 text-sm">(87) 9 8844-8690</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-24">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 lg:gap-12">

                    <div className="lg:col-span-1 lg:sticky lg:top-28 self-start">
                        <div className="flex flex-col items-center lg:items-start">
                            <img
                                src={lawyerPortrait}
                                alt="Ian Granja"
                                className="w-60 h-60 rounded-full shadow-2xl border-8 border-muted/50 mb-6 object-cover"
                            />
                            <p className="text-accent font-semibold mb-2 uppercase tracking-wider">Sócio Fundador, Ian Granja</p>
                            <h2 className="text-3xl font-bold text-foreground mb-4 text-center lg:text-left">
                                É Um Prazer Te Conhecer
                            </h2>
                            <blockquote className="border-l-4 border-accent pl-6 italic text-foreground my-4 text-lg text-center lg:text-left">
                                "Não existe direito se o cidadão não vê o resultado prático dele."
                            </blockquote>
                            <p className="text-muted-foreground text-sm mb-8 text-center lg:text-left">
                                Meu compromisso é oferecer segurança e resultado prático a cada cliente que confia em meu escritório.
                            </p>

                            {/* Credenciais */}
                            <div className="grid grid-cols-1 gap-6 w-full max-w-sm">
                                <div className="flex items-start space-x-4 p-4 bg-muted/50 rounded-lg">
                                    <div className="flex-shrink-0 mt-1">
                                        <Scale className="h-8 w-8 text-accent opacity-90" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1">
                                            5 Anos de Experiência
                                        </h3>
                                        <p className="text-muted-foreground text-sm">
                                            Atuação focada em resultados reais.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-4 p-4 bg-muted/50 rounded-lg">
                                    <div className="flex-shrink-0 mt-1">
                                        <Goal className="h-8 w-8 text-accent opacity-90" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1">
                                            Foco no Resultado
                                        </h3>
                                        <p className="text-muted-foreground text-sm">
                                            Não há direito sem resultado prático.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 w-full max-w-sm">
                                <Button
                                    variant="outline"
                                    className="w-full text-base border-2 border-foreground/20 hover:border-accent hover:bg-accent transition-all duration-300"
                                    asChild
                                >
                                    <NavLink to="/sobre">
                                        Conheça Nossa História
                                        <ArrowRight className="ml-2 w-4 h-4" />
                                    </NavLink>
                                </Button>
                            </div>

                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-24">

                        <section id="practice-areas">
                            <div className="mb-12">
                                <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                                    Nossas Especialidades
                                </h2 >
                                <p className="text-lg text-muted-foreground">
                                    Atuação focada em resultados práticos. Veja nossas principais áreas de expertise.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {homePracticeAreas.map((area) => (
                                    <NavLink
                                        key={area.title}
                                        to="/atuacao"
                                        className="group bg-card rounded-2xl shadow-lg border-2 border-transparent hover:border-accent transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex items-center space-x-6 p-6"
                                    >
                                        {/* Ícone */}
                                        <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 group-hover:bg-accent transition-all duration-300">
                                            <area.icon className="h-8 w-8 text-accent group-hover:text-accent-foreground transition-colors duration-300" />
                                        </div>
                                        {/* Textos */}
                                        <div className="flex-grow">
                                            <h3 className="text-xl font-bold text-foreground mb-1">
                                                {area.title}
                                            </h3>
                                            <p className="text-muted-foreground text-sm">
                                                {area.description}
                                            </p>
                                        </div>
                                        {/* Seta */}
                                        <div className="flex-shrink-0 ml-auto self-center">
                                            <ArrowRight className="h-6 w-6 text-muted-foreground opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-accent transition-all duration-300" />
                                        </div>
                                    </NavLink>
                                ))}
                            </div>

                            <div className="text-center mt-12">
                                <Button size="lg" variant="outline" asChild>
                                    <NavLink to="/atuacao">Ver Todas as Áreas de Atuação</NavLink>
                                </Button>
                            </div>
                        </section>

                        <section id="testimonial-stable">
                            <div className="text-center mb-12">
                                <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-2">
                                    Experiência Confirmada
                                </p>
                                <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                                    O QUE OS NOSSOS CLIENTES DIZEM
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {testimonials.slice(0, 2).map((testimonial, index) => (
                                    <Card key={index} className="bg-muted/50 rounded-2xl shadow-xl p-6 relative border border-border/50">
                                        <Quote className="absolute top-6 left-6 h-12 w-12 text-accent opacity-10" />
                                        <blockquote className="text-lg font-medium text-foreground/90 my-4 relative z-10">
                                            "{testimonial.quote}"
                                        </blockquote>
                                        <footer className="flex items-center gap-4 relative z-10 pt-4 border-t border-border/50 mt-4">
                                            <img
                                                src={testimonial.avatar}
                                                alt={testimonial.name}
                                                className="w-12 h-12 rounded-full object-cover border-2 border-accent"
                                            />
                                            <div>
                                                <p className="text-base font-semibold text-accent">{testimonial.name}</p>
                                                <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                                            </div>
                                        </footer>
                                    </Card>
                                ))}
                            </div>
                        </section>

                        <section id="why-choose-us">
                            <div className="text-center mb-16 max-w-3xl mx-auto">
                                <p className="text-accent font-semibold mb-2 uppercase tracking-wider">Nosso Compromisso</p>
                                <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                                    Por Que Nos Contratar?
                                </h2>
                                <p className="text-lg text-muted-foreground">
                                    Nosso compromisso vai além do processo. Entregamos soluções reais com atendimento humanizado e foco total no seu resultado.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {whyChooseUs.map((item) => (
                                    <Card
                                        key={item.title}
                                        className="group bg-card rounded-2xl shadow-xl p-8 text-center flex flex-col items-center
                                                   border border-border/50 transition-all duration-300
                                                   hover:border-accent/80 hover:bg-muted/30 hover:shadow-2xl hover:-translate-y-1"
                                    >
                                        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent mb-6 transition-all duration-300 group-hover:scale-105 group-hover:rotate-3 group-hover:bg-accent/90">
                                            <item.icon className="h-8 w-8 text-accent-foreground transition-all duration-300 group-hover:scale-110" />
                                        </div>

                                        <h3 className="text-xl font-semibold text-foreground mb-3 transition-colors duration-300 group-hover:text-accent">
                                            {item.title}
                                        </h3>
                                        <p className="text-muted-foreground text-sm">{item.description}</p>
                                    </Card>
                                ))}
                            </div>
                        </section>

                    </div>
                </div>
            </section>

            <section className="py-16 bg-muted/50">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {stats.map((stat, index) => (
                            <div key={index} className="text-center">
                                <p className="text-4xl sm:text-5xl font-bold text-accent mb-2">{stat.number}</p>
                                <p className="text-sm sm:text-base opacity-90 text-muted-foreground">{stat.label}</p> {/* CORRIGIDO A COR DO TEXTO */}
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