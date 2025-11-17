import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import {
  Briefcase,
  Users,
  Shield,
  Scale,
  TrendingUp,
  Home,
  Heart,
  Building2,
} from "lucide-react";

const Atuacao = () => {
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary to-primary/90 text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
              Áreas de Atuação
            </h1>
            <p className="text-lg sm:text-xl opacity-90">
              Advocacia Full Service com especialização em diversas áreas do direito. Soluções completas e personalizadas para cada necessidade.
            </p>
          </div>
        </div>
      </section>

      {/* Practice Areas Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {practiceAreas.map((area, index) => (
              <Card key={index} className="hover:shadow-2xl transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-accent/10">
                      <area.icon className="h-7 w-7 text-accent" />
                    </div>
                    <CardTitle className="text-2xl">{area.title}</CardTitle>
                  </div>
                  <p className="text-muted-foreground">{area.description}</p>
                </CardHeader>
                <CardContent>
                  <h4 className="font-semibold text-foreground mb-3">Serviços oferecidos:</h4>
                  <ul className="space-y-2">
                    {area.services.map((service, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-accent mt-1">•</span>
                        <span className="text-sm text-muted-foreground">{service}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How We Work */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Como Trabalhamos
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Nossa metodologia garante resultados efetivos e transparência total em cada etapa.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Análise Inicial",
                description: "Avaliação completa do seu caso sem compromisso.",
              },
              {
                step: "02",
                title: "Estratégia",
                description: "Desenvolvimento de um plano de ação personalizado.",
              },
              {
                step: "03",
                title: "Execução",
                description: "Atuação focada com acompanhamento constante.",
              },
              {
                step: "04",
                title: "Resultado",
                description: "Solução efetiva para o seu problema jurídico.",
              },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="text-5xl font-bold text-accent/20 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/90 text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Não Encontrou a Área que Procura?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Entre em contato conosco. Nossa equipe está pronta para avaliar seu caso e oferecer a melhor solução jurídica.
          </p>
          <Button size="lg" variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
            <NavLink to="/contato">Falar com um Especialista</NavLink>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Atuacao;
