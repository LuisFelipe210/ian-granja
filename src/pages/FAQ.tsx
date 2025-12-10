import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { Phone, MessageCircle, Clock, Shield, Sparkles, ArrowRight, Plus, Minus } from "lucide-react";

const FAQ = () => {
    const faqs = [
        {
            question: "Como funciona a primeira consulta?",
            answer:
                "A primeira consulta é uma oportunidade para entendermos seu caso e avaliarmos a melhor estratégia jurídica. Durante esse encontro, você expõe sua situação, esclarecemos suas dúvidas e apresentamos um plano de ação personalizado. A consulta pode ser presencial ou online, conforme sua preferência.",
        },
        {
            question: "Quanto custam os honorários advocatícios?",
            answer:
                "Trabalhamos com total transparência nos honorários. O valor varia de acordo com a complexidade do caso e pode ser estabelecido de diferentes formas: honorários fixos, percentual sobre o êxito ou honorários por hora. Sempre apresentamos uma proposta clara antes de iniciar qualquer trabalho, sem surpresas.",
        },
        {
            question: "Quanto tempo leva um processo judicial?",
            answer:
                "O tempo de tramitação varia conforme a natureza do caso, a complexidade dos fatos e a movimentação processual. Ações mais simples podem ser resolvidas em meses, enquanto casos mais complexos podem levar anos. Mantemos nossos clientes sempre informados sobre o andamento e buscamos soluções mais céleres quando possível.",
        },
        {
            question: "Posso resolver meu problema sem ir à Justiça?",
            answer:
                "Sim! Sempre que possível, buscamos soluções extrajudiciais, como negociações, acordos e mediações. Essa abordagem costuma ser mais rápida, econômica e menos desgastante. Quando o acordo não é viável, estamos preparados para defender seus direitos judicialmente com toda a competência.",
        },
        {
            question: "Como acompanho o andamento do meu processo?",
            answer:
                "Você receberá atualizações regulares sobre seu caso por e-mail, telefone ou WhatsApp. Além disso, oferecemos acesso exclusivo ao sistema do escritório, onde você poderá acompanhar todas as movimentações processuais em tempo real utilizando seu login e senha. Nosso compromisso é manter você informado em todas as etapas do processo.",
        },
        {
            question: "Vocês atuam em todo o Brasil?",
            answer:
                "Sim! Temos atuação nacional e estamos capacitados para representar clientes em qualquer estado do Brasil. Utilizamos tecnologia e parcerias estratégicas para garantir um atendimento de qualidade independente da localização.",
        },
        {
            question: "Quais documentos preciso levar na primeira consulta?",
            answer:
                "Recomendamos trazer todos os documentos relacionados ao seu caso: contratos, comprovantes, notificações, e-mails, mensagens e qualquer outro material relevante. Quanto mais informações você fornecer, melhor será nossa análise e mais precisa será a estratégia desenvolvida.",
        },
        {
            question: "Posso cancelar o contrato de honorários?",
            answer:
                "Sim. O cliente tem o direito de rescindir o contrato de prestação de serviços advocatícios a qualquer momento, respeitando os termos acordados. Em casos de rescisão, os honorários devidos serão proporcionais aos serviços já prestados até aquele momento.",
        },
        {
            question: "Como sei se tenho um caso forte?",
            answer:
                "Durante a consulta inicial, realizamos uma análise técnica do seu caso, avaliando as chances de êxito com base na legislação, jurisprudência e provas disponíveis. Somos transparentes quanto às possibilidades reais de sucesso e sempre orientamos da forma mais honesta possível.",
        },
        {
            question: "Vocês trabalham com causas urgentes?",
            answer:
                "Sim! Temos estrutura para atender demandas urgentes, incluindo liminares, medidas cautelares e plantões judiciais. Entre em contato imediatamente e avaliaremos a possibilidade de atendimento prioritário conforme a gravidade e urgência do caso.",
        },
    ];

    const features = [
        {
            icon: Clock,
            title: "Atendimento Ágil",
            description: "Resposta em até 24 horas. Não deixamos você esperando quando o assunto é urgente.",
        },
        {
            icon: MessageCircle,
            title: "Primeira Análise",
            description: "Entendemos seu cenário sem compromisso para direcionar a melhor estratégia.",
        },
        {
            icon: Shield,
            title: "Transparência Total",
            description: "Sem juridiquês. Explicamos custos, riscos e prazos de forma clara e honesta.",
        },
    ];

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

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-4xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 backdrop-blur-sm rounded-full text-accent text-sm mb-6 border border-accent/30">
                            <span>FAQ</span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold mb-6 text-primary-foreground">
                            Perguntas
                            <span className="block text-accent mt-2">Frequentes</span>
                        </h1>
                        <p className="text-lg sm:text-2xl text-primary-foreground/80 max-w-3xl mx-auto leading-relaxed">
                            Tire suas dúvidas sobre nossos serviços, processos e como podemos ajudá-lo.
                        </p>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0">
                    <svg className="w-full h-16" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className="fill-background"></path>
                    </svg>
                </div>
            </section>

            <section className="py-16 sm:py-24 bg-muted/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full filter blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full filter blur-3xl"></div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
                    <div className="text-center mb-10 sm:mb-12">
                        <div className="inline-block px-4 py-2 bg-accent/10 backdrop-blur-sm rounded-full text-accent text-sm mb-4 font-semibold border border-accent/20">
                            Respostas Completas
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
                            Tudo o que Você Precisa Saber
                        </h2>
                        <p className="text-base text-muted-foreground">
                            Clique em qualquer pergunta para ver a resposta detalhada
                        </p>
                    </div>

                    <Accordion type="single" collapsible className="space-y-4">
                        {faqs.map((faq, index) => (
                            <AccordionItem
                                key={index}
                                value={`item-${index}`}
                                className="group border border-accent/20 bg-card/50 backdrop-blur-sm rounded-2xl px-2 transition-all duration-300 data-[state=open]:bg-accent/5 data-[state=open]:border-accent/50 hover:border-accent/40"
                            >
                                <AccordionTrigger className="px-4 py-5 hover:no-underline [&[data-state=open]>div>div>svg.plus]:hidden [&[data-state=open]>div>div>svg.minus]:block">
                                    <div className="flex items-center justify-between w-full text-left">
                                        <span className="text-base sm:text-lg font-semibold text-foreground group-hover:text-accent transition-colors duration-300 pr-4">
                                            {faq.question}
                                        </span>
                                        <div className="flex-shrink-0">
                                            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center group-data-[state=open]:bg-accent group-data-[state=open]:text-accent-foreground transition-all duration-300">
                                                <Plus className="w-4 h-4 text-accent plus transition-transform duration-300 group-hover:rotate-90" />
                                                <Minus className="w-4 h-4 text-accent-foreground minus hidden" />
                                            </div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-6 text-muted-foreground text-sm sm:text-base leading-relaxed">
                                    <div className="pt-2 border-t border-accent/10">
                                        {faq.answer}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </section>

            <section className="py-16 sm:py-24 bg-primary relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-1/4 w-80 h-80 bg-accent rounded-full filter blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-accent rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
                </div>
                <div className="absolute inset-0 opacity-5">
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: 'linear-gradient(hsl(47 22% 46% / 0.3) 1px, transparent 1px)',
                            backgroundSize: '100px 100px',
                        }}
                    ></div>
                </div>
                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 backdrop-blur-sm rounded-full text-primary-foreground text-sm mb-6 border border-accent/30">
                            <span className="font-semibold">Estamos Aqui Para Ajudar</span>
                        </div>

                        <h2 className="text-3xl sm:text-5xl font-bold text-primary-foreground mb-4">
                            Ainda Tem Dúvidas?
                        </h2>
                        <p className="text-base sm:text-xl text-primary-foreground/80 mb-8 sm:mb-10 leading-relaxed">
                            Nossa equipe está pronta para esclarecer todas as suas questões e apresentar a melhor solução para o seu caso.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button
                                size="lg"
                                className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-2xl hover:shadow-3xl transition-all duration-300 group text-base sm:text-lg px-6 py-5 sm:px-8 sm:py-6 border-2 border-accent/50 w-full sm:w-auto"
                                asChild
                            >
                                <NavLink to="#" isContactLink>
                                    Entre em Contato
                                    <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                                </NavLink>
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="border-2 border-foreground/20 text-black hover:bg-accent/10 hover:border-accent text-base sm:text-lg px-6 py-5 sm:px-8 sm:py-6 backdrop-blur-sm w-full sm:w-auto"
                                asChild
                            >
                                <a href="tel:+5587988448690">
                                    <Phone className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                                    (87) 9 8844-8690
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-20 sm:py-28 bg-muted/40 relative">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16 sm:mb-20">
                        <div className="inline-block px-4 py-2 bg-accent/10 backdrop-blur-sm rounded-full text-accent text-sm mb-4 font-semibold border border-accent/20">
                            Nossos Diferenciais
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                            Como Podemos Te Ajudar
                        </h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            Compromisso, ética e agilidade para resolver o seu problema.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="group relative p-8 rounded-[2rem] bg-card border border-border/50 hover:border-accent/50 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                                <div className="absolute -right-8 -top-8 w-32 h-32 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-all duration-500" />

                                <div className="relative z-10 flex flex-col items-start h-full">
                                    <div className="mb-6 relative">
                                        <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 group-hover:bg-accent group-hover:scale-110 transition-all duration-500">
                                            <feature.icon className="w-7 h-7 text-accent group-hover:text-accent-foreground transition-colors duration-500" />
                                        </div>
                                        <div className="absolute top-14 left-7 w-px h-8 bg-accent/20 group-hover:h-12 group-hover:bg-accent/40 transition-all duration-500 delay-100" />
                                    </div>

                                    <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 group-hover:text-accent transition-colors duration-300">
                                        {feature.title}
                                    </h3>

                                    <p className="text-base text-muted-foreground leading-relaxed flex-grow group-hover:text-foreground/80 transition-colors duration-300">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default FAQ;