import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { PageHero } from "@/components/PageHero";
import { Grifo } from "@/components/Grifo";
import { HeroArt } from "@/components/HeroArt";
import { FaqList } from "@/components/FaqList";
import { Fecho } from "@/components/Fecho";

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
        title: "Atendimento ágil",
        description: "Resposta rápida. Não deixamos você esperando quando o assunto é urgente.",
    },
    {
        title: "Primeira análise",
        description: "Entendemos seu cenário sem compromisso para direcionar a melhor estratégia.",
    },
    {
        title: "Transparência total",
        description: "Sem juridiquês. Explicamos custos, riscos e prazos de forma clara e honesta.",
    },
];

// Dados estruturados das perguntas, para os buscadores. "<" é escapado para não fechar a tag.
const faqJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
}).replace(/</g, "\\u003c");

const FAQ = () => (
    <div className="min-h-screen bg-background">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
        <Navigation />

        <main>
            <PageHero
                title={[
                    "Perguntas",
                    <>
                        <Grifo delay={900}>frequentes.</Grifo>
                    </>,
                ]}
                lead="As dúvidas mais comuns sobre nossos serviços, os processos e a forma como atuamos na defesa dos seus direitos."
                art={<HeroArt variant="duvida" />}
            />

            <section className="bg-background">
                <div className="container py-20 md:py-28">
                    <div className="mx-auto max-w-4xl">
                        <FaqList items={faqs} />
                    </div>
                </div>
            </section>

            <section className="bg-ink text-paper">
                <div className="container py-20 md:py-28">
                    <h2 className="display text-[clamp(2rem,4.2vw,3.5rem)]">Por que nos escolher.</h2>
                    <dl className="mt-12 grid gap-x-12 border-t border-paper/20 md:grid-cols-3">
                        {features.map((feature) => (
                            <div key={feature.title} className="border-b border-paper/20 py-8 md:border-b-0">
                                <dt className="subdisplay text-2xl text-gold-light">{feature.title}</dt>
                                <dd className="mt-3 max-w-[36ch] text-lg leading-relaxed text-paper/85">
                                    {feature.description}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            <Fecho
                title="Ainda com dúvidas?"
                text="Pergunte direto. Nossa equipe está pronta para orientar você."
                message="Olá! Tenho uma dúvida e gostaria de falar com um advogado."
            />
        </main>

        <Footer />
    </div>
);

export default FAQ;
