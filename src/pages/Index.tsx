import React from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import heroImage from "@/assets/hero-law-office.jpg";
import lawyerPortrait from "@/assets/lawyer-portrait.jpg";
import cliente1 from "@/assets/cliente1.jpg";
import cliente2 from "@/assets/cliente2.jpg";
import cliente3 from "@/assets/cliente3.jpg";
import {
    Briefcase,
    Users,
    Shield,
    Heart,
    CheckCircle2,
    ArrowRight,
    Star,
    Phone,
    Scale,
    Clock,
    Trophy
} from "lucide-react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import {FaWhatsapp} from "react-icons/fa";

const Index = () => {
    const plugin = React.useRef(
        Autoplay({ delay: 6000, stopOnInteraction: true })
    );

    const stats = [
        { number: "+2.000", label: "Consultas Realizadas", icon: Users },
        { number: "98%", label: "Taxa de Sucesso", icon: Trophy },
        { number: "24h", label: "Atendimento Ágil", icon: Clock },
    ];

    const services = [
        {
            icon: Briefcase,
            title: "Direito Bancário",
            description: "Revisão de juros abusivos, busca e apreensão de veículos e defesa patrimonial.",
        },
        {
            icon: Users,
            title: "Direito Trabalhista",
            description: "Defesa implacável dos direitos do trabalhador e compliance para empresas.",
        },
        {
            icon: Shield,
            title: "Consumidor",
            description: "Indenizações por danos morais, negativação indevida e problemas com voos.",
        },
        {
            icon: Heart,
            title: "Direito à Saúde",
            description: "Liminares para cirurgias, medicamentos de alto custo e home care.",
        },
    ];

    const testimonials = [
        {
            text: "Profissionalismo ímpar. O Dr. Ian conseguiu resolver uma situação que se arrastava há anos em outros escritórios.",
            author: "Jefferson Adriano",
            role: "Empresário",
            image: cliente1
        },
        {
            text: "Me senti segura desde o primeiro atendimento. A transparência sobre os riscos e possibilidades foi total.",
            author: "Maria Almeida",
            role: "Autônoma",
            image: cliente3
        },
        {
            text: "Resultado rápido e atendimento humanizado. Indico para todos os meus conhecidos.",
            author: "Victor Flávio",
            role: "Dentista",
            image: cliente2
        },
    ];

    return (
        <div className="min-h-screen bg-background font-sans">
            <Navigation />

            {/* --- 1. HERO SECTION: IMPONENTE & CENTRALIZADO --- */}
            <section className="relative h-[100vh] min-h-[600px] flex flex-col justify-center items-center overflow-hidden">
                {/* Background com Overlay Gradiente Profissional */}
                <div className="absolute inset-0 z-0">
                    <img
                        src={heroImage}
                        alt="Escritório de Advocacia"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/80 to-primary/60" />
                </div>

                <div className="container relative z-10 px-4 text-center max-w-4xl mx-auto mt-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 text-white text-sm font-semibold mb-6">
                        <Scale className="w-4 h-4" /> Especialistas em Resolução de Conflitos
                    </div>

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight tracking-tight drop-shadow-2xl">
                        Justiça eficiente para <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent/80 to-white">
                            proteger seu patrimônio.
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-200 mb-10 max-w-2xl mx-auto leading-relaxed">
                        Advocacia estratégica com foco em resultados rápidos.
                        Não deixe seus direitos para depois.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button size="xl" className="h-14 px-8 text-lg rounded-full bg-accent hover:bg-accent/90 text-slate-900 font-bold shadow-[0_0_20px_rgba(var(--accent),0.3)] hover:shadow-[0_0_30px_rgba(var(--accent),0.5)] transition-all transform hover:-translate-y-1" asChild>
                            <NavLink to="#" isContactLink>
                                <Phone className="mr-2 w-5 h-5" /> Falar com Especialista
                            </NavLink>
                        </Button>
                        <Button size="xl" variant="outline" className="h-14 px-8 text-lg rounded-full border-white/20 text-black hover:bg-white hover:text-slate-900 transition-all backdrop-blur-sm" asChild>
                            <NavLink to="/atuacao">Conhecer Áreas</NavLink>
                        </Button>
                    </div>
                </div>

                {/* Strip de Estatísticas Flutuante */}
                <div className="absolute bottom-0 w-full border-t border-white/10 bg-primary0/50 backdrop-blur-md py-6 hidden md:block">
                    <div className="container mx-auto px-4 flex justify-center gap-16 text-white">
                        {stats.map((stat, i) => (
                            <div key={i} className="flex items-center gap-4 opacity-80 hover:opacity-100 transition-opacity">
                                <div className="p-3 bg-white/10 rounded-full">
                                    <stat.icon className="w-6 h-6 text-accent" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold leading-none">{stat.number}</p>
                                    <p className="text-xs uppercase tracking-wider text-slate-300">{stat.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- 2. SOBRE (SPLIT LAYOUT) --- */}
            <section className="py-24 bg-white relative overflow-hidden">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                        {/* Lado Esquerdo: Imagem */}
                        <div className="relative group mx-auto lg:mx-0 max-w-md lg:max-w-none">
                            <div className="absolute -inset-4 bg-accent/20 rounded-tr-[4rem] rounded-bl-[4rem] transform rotate-3 group-hover:rotate-2 transition-transform duration-500"></div>
                            <img
                                src={lawyerPortrait}
                                alt="Ian Granja Advogado"
                                className="relative rounded-tr-[3rem] rounded-bl-[3rem] shadow-2xl z-10 w-full object-cover aspect-[3/4]"
                            />

                            {/* Card Flutuante na Imagem */}
                            <div className="absolute bottom-8 -right-4 lg:-right-8 z-20 bg-white p-6 rounded-xl shadow-xl border border-slate-100 max-w-[200px]">
                                <p className="text-accent font-bold text-4xl mb-1">5+</p>
                                <p className="text-slate-600 text-sm font-medium leading-snug">Anos de experiência em casos complexos.</p>
                            </div>
                        </div>

                        {/* Lado Direito: Texto */}
                        <div>
                            <span className="text-accent font-bold uppercase tracking-widest text-sm mb-2 block">O Escritório</span>
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                                Mais que advogados, somos parceiros estratégicos do seu negócio.
                            </h2>
                            <p className="text-slate-600 text-lg mb-6 leading-relaxed">
                                Fundado pelo Dr. Ian Granja, nosso escritório nasceu com a missão de eliminar a burocracia e entregar resultados práticos.
                            </p>
                            <p className="text-slate-600 mb-8 leading-relaxed">
                                Entendemos que por trás de cada processo existe uma história, um patrimônio ou uma família. Por isso, nossa atuação é técnica, mas nosso atendimento é, acima de tudo, humano.
                            </p>

                            <div className="space-y-4 mb-8">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-accent shrink-0 mt-0.5" />
                                    <p className="text-slate-700 font-medium">Transparência total sobre honorários e riscos.</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-accent shrink-0 mt-0.5" />
                                    <p className="text-slate-700 font-medium">Comunicação direta via WhatsApp, sem "juridiquês".</p>
                                </div>
                            </div>

                            <Button variant="default" size="lg" className="rounded-full px-8 bg-primary hover:bg-slate-800" asChild>
                                <NavLink to="/sobre">Conheça nossa História <ArrowRight className="ml-2 w-4 h-4" /></NavLink>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- 3. SERVIÇOS (DARK MODE) --- */}
            <section className="py-24 bg-primary text-white">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <span className="text-accent font-bold uppercase tracking-widest text-sm mb-3 block">Áreas de Atuação</span>
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Excelência Técnica Especializada</h2>
                        <p className="text-slate-400 text-lg">
                            Não somos generalistas. Focamos onde somos melhores para garantir a máxima eficiência para o seu caso.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {services.map((item, index) => (
                            <NavLink key={index} to="/atuacao" className="group relative bg-white/5 p-8 rounded-3xl border border-white/10 hover:bg-white/10 transition-all duration-300 hover:-translate-y-2">
                                <div className="w-14 h-14 bg-accent/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-accent transition-colors duration-300">
                                    <item.icon className="w-7 h-7 text-accent group-hover:text-slate-900 transition-colors" />
                                </div>
                                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                                    {item.description}
                                </p>
                                <div className="flex items-center text-accent text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                                    Detalhes <ArrowRight className="ml-2 w-4 h-4" />
                                </div>
                            </NavLink>
                        ))}
                    </div>

                    <div className="mt-12 text-center">
                        <Button variant="outline" size="lg" className="rounded-full border-white/20 text-black   hover:bg-white hover:text-slate-900 px-8" asChild>
                            <NavLink to="/atuacao">Ver Todas as Áreas</NavLink>
                        </Button>
                    </div>
                </div>
            </section>

            {/* --- 4. PROVA SOCIAL (Clean & Trust) --- */}
            <section className="py-24 bg-slate-50">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                        <div className="max-w-xl">
                            <h2 className="text-3xl font-bold text-slate-900 mb-4">A voz de quem confia.</h2>
                            <p className="text-slate-600 text-lg">
                                A satisfação dos nossos clientes é o principal indicador do nosso sucesso.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex text-amber-500">
                                {[...Array(5)].map((_, i) => <Star key={i} fill="currentColor" className="w-5 h-5" />)}
                            </div>
                        </div>
                    </div>

                    <div className="relative px-4 md:px-12">
                        <Carousel
                            plugins={[plugin.current]}
                            className="w-full"
                            opts={{ align: "start", loop: true }}
                        >
                            <CarouselContent className="-ml-4">
                                {testimonials.map((t, i) => (
                                    <CarouselItem key={i} className="md:basis-1/2 lg:basis-1/3 pl-4">
                                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl transition-shadow h-full flex flex-col">
                                            <div className="mb-6 text-accent">
                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="opacity-20">
                                                    <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H15.017C14.4647 8 14.017 8.44772 14.017 9V11C14.017 11.5523 13.5693 12 13.017 12H12.017V5H22.017V15C22.017 18.3137 19.3307 21 16.017 21H14.017ZM5.0166 21L5.0166 18C5.0166 16.8954 5.91203 16 7.0166 16H10.0166C10.5689 16 11.0166 15.5523 11.0166 15V9C11.0166 8.44772 10.5689 8 10.0166 8H6.0166C5.46432 8 5.0166 8.44772 5.0166 9V11C5.0166 11.5523 4.56889 12 4.0166 12H3.0166V5H13.0166V15C13.0166 18.3137 10.3303 21 7.0166 21H5.0166Z" />
                                                </svg>
                                            </div>
                                            <p className="text-slate-700 leading-relaxed mb-6 flex-grow italic">
                                                "{t.text}"
                                            </p>
                                            <div className="flex items-center gap-4 pt-6 border-t border-slate-100">
                                                <img src={t.image} alt={t.author} className="w-12 h-12 rounded-full object-cover" />
                                                <div>
                                                    <p className="font-bold text-slate-900 text-sm">{t.author}</p>
                                                    <p className="text-slate-500 text-xs">{t.role}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                            <CarouselPrevious className="hidden md:flex -left-4 bg-white hover:bg-accent hover:text-white border-slate-200" />
                            <CarouselNext className="hidden md:flex -right-4 bg-white hover:bg-accent hover:text-white border-slate-200" />
                        </Carousel>
                    </div>
                </div>
            </section>

            {/* --- 5. CTA FINAL (Chamada para ação) --- */}
            <section className="py-20 bg-accent text-slate-900">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-5xl font-bold mb-6">Precisa de orientação jurídica imediata?</h2>
                    <p className="text-xl mb-10 opacity-90 max-w-2xl mx-auto font-medium">
                        Não espere o problema crescer. Converse agora com nossa equipe e descubra a melhor estratégia para o seu caso.
                    </p>
                    <Button size="xl" className="h-16 px-10 text-lg rounded-full bg-primary text-white hover:bg-slate-800 shadow-2xl transition-transform hover:scale-105" asChild>
                        <NavLink to="#" isContactLink>
                            <FaWhatsapp className="mr-3 w-6 h-6" />Atendimento via WhatsApp
                        </NavLink>
                    </Button>
                    <p className="mt-6 text-sm opacity-70 font-medium">Resposta média em até 15 minutos durante o horário comercial.</p>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default Index;