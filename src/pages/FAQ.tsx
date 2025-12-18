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
import { Phone, MessageCircle, Clock, Shield, Sparkles, ArrowRight, HelpCircle, ChevronDown } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

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
                "Você receberá atualizações regulares sobre seu caso por e-mail, telefone ou WhatsApp. Além disso, oferecemos acesso exclusivo ao sistema do escritório, onde você poderá acompanhar todas as movimentações processuais em tempo real utilizando seu login e senha.",
        },
        {
            question: "Vocês atuam em todo o Brasil?",
            answer:
                "Sim! Temos atuação nacional e estamos capacitados para representar clientes em qualquer estado do Brasil. Utilizamos tecnologia e parcerias estratégicas para garantir um atendimento de qualidade independente da localização.",
        },
        {
            question: "Quais documentos preciso levar na primeira consulta?",
            answer:
                "Recomendamos trazer todos os documentos relacionados ao seu caso: contratos, comprovantes, notificações, e-mails, mensagens e qualquer outro material relevante. Quanto mais informações você fornecer, melhor será nossa análise.",
        },
        {
            question: "Posso cancelar o contrato de honorários?",
            answer:
                "Sim. O cliente tem o direito de rescindir o contrato de prestação de serviços advocatícios a qualquer momento, respeitando os termos acordados. Em casos de rescisão, os honorários devidos serão proporcionais aos serviços já prestados.",
        },
        {
            question: "Como sei se tenho um caso forte?",
            answer:
                "Durante a consulta inicial, realizamos uma análise técnica do seu caso, avaliando as chances de êxito com base na legislação, jurisprudência e provas disponíveis. Somos transparentes quanto às possibilidades reais de sucesso.",
        },
        {
            question: "Vocês trabalham com causas urgentes?",
            answer:
                "Sim! Temos estrutura para atender demandas urgentes, incluindo liminares, medidas cautelares e plantões judiciais. Entre em contato imediatamente e avaliaremos a possibilidade de atendimento prioritário.",
        },
    ];

    const features = [
        {
            icon: Clock,
            title: "Atendimento Ágil",
            description: "Resposta rápida. Não deixamos você esperando quando o assunto é urgente.",
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
        <div className="min-h-screen bg-background font-sans selection:bg-accent selection:text-accent-foreground">
            <Navigation />

            {/* --- HERO SECTION: Premium Dark --- */}
            <section className="relative pt-32 pb-24 bg-primary text-white overflow-hidden border-b border-white/5">
                <div className="absolute inset-0 opacity-[0.05]"
                     style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                </div>

                <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-px w-12 bg-accent"></div>
                            <span className="text-accent font-medium tracking-[0.2em] uppercase text-xs">Suporte Jurídico</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight drop-shadow-xl">
                            Perguntas <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-white">
                                Frequentes
                            </span>
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed max-w-2xl border-l-4 border-accent/20 pl-6 rounded-sm">
                            Esclareça suas principais dúvidas sobre nossos serviços, processos e a forma como atuamos na defesa dos seus direitos.
                        </p>
                    </div>
                </div>
            </section>

            {/* --- FAQ LIST: Cards Separados e Modernos --- */}
            <section className="py-24 bg-muted/20 relative">
                {/* Detalhe de fundo */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/5 via-transparent to-transparent pointer-events-none" />

                <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl relative z-10">
                    <Accordion type="single" collapsible className="space-y-4">
                        {faqs.map((faq, index) => (
                            <AccordionItem
                                key={index}
                                value={`item-${index}`}
                                className="group border border-border/60 bg-white rounded-2xl px-2 shadow-sm hover:shadow-md transition-all duration-300 data-[state=open]:border-accent/50 data-[state=open]:ring-1 data-[state=open]:ring-accent/20"
                            >
                                <AccordionTrigger className="px-6 py-5 hover:no-underline text-left">
                                    <div className="flex items-center gap-4 w-full">
                                        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-sm font-bold shrink-0 group-data-[state=open]:bg-accent group-data-[state=open]:text-accent-foreground transition-colors">
                                            {index + 1}
                                        </div>
                                        <span className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors flex-grow">
                                            {faq.question}
                                        </span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6 pt-0 ml-12 text-muted-foreground text-base leading-relaxed border-t border-transparent group-data-[state=open]:border-border/40 group-data-[state=open]:pt-4">
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </section>

            {/* --- DIFERENCIAIS: Cards Flutuantes --- */}
            <section className="py-24 bg-background">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-foreground mb-4">Por que nos escolher?</h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                            Compromisso, ética e agilidade para resolver o seu problema com eficiência.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <div key={index} className="group bg-card p-8 rounded-[2rem] border border-border/60 hover:border-accent/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center">
                                <div className="mb-6 w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 group-hover:bg-accent group-hover:scale-110 transition-all duration-300">
                                    <feature.icon className="w-8 h-8 text-accent group-hover:text-accent-foreground transition-colors duration-300" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- CTA: Premium Dark --- */}
            <section className="py-24 bg-[#0f172a] text-white overflow-hidden relative">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent via-transparent to-transparent"></div>

                <div className="container mx-auto px-4 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-accent text-sm font-semibold mb-8 rounded-full border border-white/20 backdrop-blur-md">
                        <HelpCircle className="w-4 h-4" />
                        Ainda com dúvidas?
                    </div>

                    <h2 className="text-3xl md:text-5xl font-bold mb-8 text-white max-w-4xl mx-auto leading-tight">
                        Nossa equipe está pronta para <br/> orientar você.
                    </h2>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <Button size="xl" className="h-14 px-8 text-lg bg-accent hover:bg-accent/90 text-accent-foreground rounded-full min-w-[240px] shadow-lg hover:scale-105 transition-transform" asChild>
                            <NavLink to="#" isContactLink>
                                <Phone className="mr-2 h-5 w-5" />
                                Falar com Especialista
                            </NavLink>
                        </Button>

                        <span className="text-white/40 text-sm uppercase tracking-widest font-semibold px-4">ou</span>

                        <Button variant="outline" size="xl" className="h-14 px-8 text-lg border-white/20 bg-transparent text-white hover:bg-white hover:text-[#0f172a] rounded-full min-w-[240px] hover:scale-105 transition-transform" asChild>
                            <a href="https://wa.me/5587988448690" target="_blank" rel="noopener noreferrer">
                                <FaWhatsapp className="mr-2 h-5 w-5" />
                                WhatsApp Direto
                            </a>
                        </Button>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default FAQ;