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
import { HelpCircle, Phone, MessageCircle, Clock, Shield, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";

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
                "Você receberá atualizações regulares sobre seu caso por e-mail, telefone ou WhatsApp. Além disso, disponibilizamos consultas periódicas para esclarecer qualquer dúvida. Nosso compromisso é manter você informado em todas as etapas do processo.",
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

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            <Navigation />

            <section className="relative pt-24 pb-16 overflow-hidden bg-primary sm:pt-32 sm:pb-24">
                {/* Animated Background */}
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
                            <Sparkles className="w-4 h-4" />
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

                    <Accordion type="single" collapsible className="space-y-3">
                        {faqs.map((faq, index) => (
                            <AccordionItem
                                key={index}
                                value={`item-${index}`}
                                className="relative rounded-xl px-4 sm:px-6 border-2 border-accent/30 bg-white/10 dark:bg-zinc-900/20 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group hover:border-accent/60"
                            >
                                <AccordionTrigger className="text-left text-base sm:text-lg font-semibold py-4 sm:py-6 text-foreground transition-all group-hover:text-accent [&[data-state=open]]:text-accent">
                                    {faq.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-sm sm:text-base text-muted-foreground pb-4 sm:pb-6 leading-relaxed border-t border-accent/20 pt-3 sm:pt-4">
                                    {faq.answer}
                                </AccordionContent>

                                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-accent/50 via-accent to-accent/50 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
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
                            <Sparkles className="w-4 h-4" />
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

            <section className="py-16 sm:py-24 bg-muted/20 dark:bg-background/40 relative">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-10 sm:mb-16">
                        <div className="inline-block px-4 py-2 bg-accent/10 backdrop-blur-sm rounded-full text-accent text-sm mb-4 font-semibold border border-accent/20">
                            Nossos Diferenciais
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                            Como Podemos Te Ajudar
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
                        <div className="group relative">
                            <div className="absolute -inset-1 bg-gradient-to-br from-accent/30 to-accent/10 rounded-2xl blur-lg opacity-100 md:opacity-0 group-hover:md:opacity-100 transition duration-500"></div>

                            <div className="relative text-center p-8 sm:p-10 rounded-2xl sm:rounded-3xl bg-card/40 dark:bg-zinc-900/30 border border-accent/30 hover:border-accent shadow-xl hover:shadow-2xl backdrop-blur-2xl transition-all duration-300 min-h-[320px] sm:min-h-[360px]">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-accent/15 border border-accent/40 shadow-md flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-accent group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                                    <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-accent group-hover:text-accent-foreground transition-colors duration-300" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-3 group-hover:text-accent transition-colors duration-300">
                                    Atendimento Rápido
                                </h3>
                                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                                    Resposta em até 24 horas para todos os contatos
                                </p>
                            </div>
                        </div>

                        <div className="group relative">
                            <div className="absolute -inset-1 bg-gradient-to-br from-accent/30 to-accent/10 rounded-2xl blur-lg opacity-100 md:opacity-0 group-hover:md:opacity-100 transition duration-500"></div>

                            <div className="relative text-center p-8 sm:p-10 rounded-2xl sm:rounded-3xl bg-card/40 dark:bg-zinc-900/30 border border-accent/30 hover:border-accent shadow-xl hover:shadow-2xl backdrop-blur-2xl transition-all duration-300 min-h-[320px] sm:min-h-[360px]">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-accent/15 border border-accent/40 shadow-md flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-accent group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                                    <MessageCircle className="w-6 h-6 sm:w-8 sm:h-8 text-accent group-hover:text-accent-foreground transition-colors duration-300" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-3 group-hover:text-accent transition-colors duration-300">
                                    Consulta Sem Compromisso
                                </h3>
                                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                                    Avalie seu caso sem qualquer obrigação
                                </p>
                            </div>
                        </div>

                        <div className="group relative">
                            <div className="absolute -inset-1 bg-gradient-to-br from-accent/30 to-accent/10 rounded-2xl blur-lg opacity-100 md:opacity-0 group-hover:md:opacity-100 transition duration-500"></div>

                            <div className="relative text-center p-8 sm:p-10 rounded-2xl sm:rounded-3xl bg-card/40 dark:bg-zinc-900/30 border border-accent/30 hover:border-accent shadow-xl hover:shadow-2xl backdrop-blur-2xl transition-all duration-300 min-h-[320px] sm:min-h-[360px]">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-accent/15 border border-accent/40 shadow-md flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-accent group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                                    <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-accent group-hover:text-accent-foreground transition-colors duration-300" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-3 group-hover:text-accent transition-colors duration-300">
                                    Transparência Total
                                </h3>
                                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                                    Informações claras sobre custos e prazos
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default FAQ;