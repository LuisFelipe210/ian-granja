import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NavLink } from "@/components/NavLink";
import heroImage from "@/assets/hero-law-office.jpg";
import lawyerPortrait from "@/assets/lawyer-portrait.jpg";
import {
  Scale,
  Briefcase,
  Users,
  Shield,
  TrendingUp,
  Home,
  Heart,
  Award,
  CheckCircle,
  Phone,
} from "lucide-react";

const Index = () => {
  const practiceAreas = [
    {
      icon: Briefcase,
      title: "Direito Bancário",
      description:
        "Defendemos consumidores contra práticas abusivas de instituições financeiras, com foco na recuperação de veículos e revisão de contratos.",
    },
    {
      icon: Users,
      title: "Direito Trabalhista",
      description:
        "Representamos trabalhadores e empresas em disputas judiciais e extrajudiciais, priorizando soluções céleres e seguras.",
    },
    {
      icon: Shield,
      title: "Direito do Consumidor",
      description:
        "Atuamos na defesa de consumidores em casos de cobranças indevidas, negativação irregular e falhas na prestação de serviços.",
    },
    {
      icon: Scale,
      title: "Direito Empresarial",
      description:
        "Assessoria jurídica completa para empresas, com foco em contratos, responsabilidade civil e defesa administrativa.",
    },
    {
      icon: TrendingUp,
      title: "Superendividamento",
      description:
        "Ajudamos consumidores a reorganizar sua vida financeira, com ações para revisão de dívidas e negociação com bancos.",
    },
    {
      icon: Heart,
      title: "Planos de Saúde",
      description:
        "Defesa contra negativas de cobertura, reajustes abusivos, cancelamentos indevidos e demora em autorizações.",
    },
    {
      icon: Home,
      title: "Direito Imobiliário",
      description:
        "Atuamos em questões relacionadas a compra e venda de imóveis, distratos, financiamentos e usucapião.",
    },
  ];

  const whyChooseUs = [
    {
      icon: Award,
      title: "Histórico de Resultados Reais",
      description:
        "Atuamos com foco em soluções práticas e eficazes, sempre buscando decisões favoráveis que representem verdadeiro alívio jurídico e financeiro.",
    },
    {
      icon: CheckCircle,
      title: "Transparência nos Honorários",
      description:
        "Nossos clientes sabem exatamente o que esperar. Explicamos com clareza os custos envolvidos, sem surpresas.",
    },
    {
      icon: Users,
      title: "Atendimento Humanizado e Estratégico",
      description:
        "Mais do que resolver processos, entregamos orientação jurídica com empatia, clareza e comprometimento.",
    },
  ];

  const stats = [
    { number: "2000+", label: "Consultas Realizadas" },
    { number: "90%", label: "Índice de Satisfação" },
    { number: "10+", label: "Anos de Experiência" },
    { number: "100%", label: "Dedicação aos Clientes" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `linear-gradient(rgba(22, 30, 46, 0.85), rgba(22, 30, 46, 0.85)), url(${heroImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-primary-foreground mb-6 animate-fade-in">
            Oferecemos Soluções Jurídicas
            <br />
            <span className="text-accent">com Foco no Resultado</span>
          </h1>
          <p className="text-lg sm:text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Advocacia experiente e especializada. Atendimento personalizado com compromisso em entregar resultados práticos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" variant="default" asChild className="w-full sm:w-auto">
              <NavLink to="/contato">
                <Phone className="mr-2 h-5 w-5" />
                Falar com Advogado
              </NavLink>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto bg-transparent text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary">
              <NavLink to="/atuacao">Conheça Nossa Atuação</NavLink>
            </Button>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4 border border-primary-foreground/20">
              <p className="text-primary-foreground font-semibold">Atuação Nacional</p>
              <p className="text-primary-foreground/80 text-sm">Advogados presentes em todo o país</p>
            </div>
            <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4 border border-primary-foreground/20">
              <p className="text-primary-foreground font-semibold">Telefone para Contato</p>
              <p className="text-primary-foreground/80 text-sm">(87) 9 8844-8690</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-gradient-to-b from-background to-muted">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <p className="text-accent font-semibold mb-2">Sócio Fundador, Ian Granja</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
                É Um Prazer Te Conhecer
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Me chamo Ian. Na minha vida, sempre acreditei que algo só muda de verdade quando notamos a diferença.
                </p>
                <p>
                  Com a advocacia não é diferente: não existe direito se o cidadão não vê o resultado prático dele.
                </p>
                <p>
                  Por isso, busco soluções jurídicas eficientes, acredito em um atendimento próximo, transparente e personalizado. Meu compromisso é oferecer segurança e resultado prático a cada cliente que confia em meu escritório.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
                <div>
                  <h3 className="text-2xl font-bold text-accent mb-2">5 Anos</h3>
                  <p className="text-sm text-muted-foreground">de experiência na advocacia</p>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-accent mb-2">Foco no Resultado</h3>
                  <p className="text-sm text-muted-foreground">Não há direito sem resultado</p>
                </div>
              </div>
              <Button size="lg" className="mt-8" asChild>
                <NavLink to="/sobre">Saiba Mais Sobre Nós</NavLink>
              </Button>
            </div>
            <div className="order-1 lg:order-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-primary/20 rounded-2xl transform rotate-3" />
                <img
                  src={lawyerPortrait}
                  alt="Ian Granja"
                  className="relative rounded-2xl shadow-2xl w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Practice Areas */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Advocacia Full Service
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Atuamos em diversas áreas do direito, sempre com foco na excelência e em resultados efetivos para nossos clientes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {practiceAreas.map((area, index) => (
              <Card key={index} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-accent/10 group-hover:bg-accent group-hover:scale-110 transition-all duration-300 mb-4">
                    <area.icon className="h-7 w-7 text-accent group-hover:text-accent-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-accent transition-colors">
                    {area.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">{area.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-12">
            <Button size="lg" variant="outline" asChild>
              <NavLink to="/atuacao">Ver Todas as Áreas</NavLink>
            </Button>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-accent font-semibold mb-2">Advocacia experiente e especializada</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Por Que Nos Contratar
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {whyChooseUs.map((item, index) => (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent mx-auto mb-4">
                  <item.icon className="h-8 w-8 text-accent-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-4xl sm:text-5xl font-bold text-accent mb-2">{stat.number}</p>
                <p className="text-sm sm:text-base opacity-90">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/90 text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Pronto para Resolver Seu Problema Jurídico?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Entre em contato conosco e agende uma consulta. Estamos prontos para oferecer a solução que você precisa.
          </p>
          <Button size="lg" variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
            <NavLink to="/contato">
              <Phone className="mr-2 h-5 w-5" />
              Agendar Consulta
            </NavLink>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
