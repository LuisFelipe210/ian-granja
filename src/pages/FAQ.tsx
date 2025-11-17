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
import { HelpCircle } from "lucide-react";

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
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary to-primary/90 text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <HelpCircle className="h-16 w-16 text-accent mx-auto mb-6" />
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
              Perguntas Frequentes
            </h1>
            <p className="text-lg sm:text-xl opacity-90">
              Tire suas dúvidas sobre nossos serviços, processos e como podemos ajudá-lo.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border rounded-lg px-6 bg-card"
              >
                <AccordionTrigger className="text-left hover:text-accent text-lg font-semibold py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Still Have Questions */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Ainda Tem Dúvidas?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Nossa equipe está pronta para esclarecer todas as suas questões e apresentar a melhor solução para o seu caso.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <NavLink to="/contato">Entre em Contato</NavLink>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="tel:+5587988448690">(87) 9 8844-8690</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Help */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center p-6">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📞</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Atendimento Rápido</h3>
              <p className="text-sm text-muted-foreground">
                Resposta em até 24 horas para todos os contatos
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💼</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Consulta Sem Compromisso</h3>
              <p className="text-sm text-muted-foreground">
                Avalie seu caso sem qualquer obrigação
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✅</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Transparência Total</h3>
              <p className="text-sm text-muted-foreground">
                Informações claras sobre custos e prazos
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default FAQ;
