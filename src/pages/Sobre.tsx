import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import lawyerPortrait from "@/assets/lawyer-portrait.jpg";
import { Target, Eye, Award, Users, Lightbulb, Scale } from "lucide-react";

const Sobre = () => {
  const values = [
    {
      icon: Scale,
      title: "Ética e Transparência",
      description: "Atuamos com integridade total, mantendo nossos clientes informados em cada etapa do processo.",
    },
    {
      icon: Target,
      title: "Foco em Resultados",
      description: "Não medimos esforços para alcançar os melhores resultados para nossos clientes.",
    },
    {
      icon: Users,
      title: "Atendimento Personalizado",
      description: "Cada cliente é único e merece uma estratégia jurídica desenvolvida especialmente para seu caso.",
    },
    {
      icon: Lightbulb,
      title: "Inovação e Eficiência",
      description: "Utilizamos as melhores práticas e tecnologias para tornar nossos serviços mais eficientes.",
    },
  ];

  const achievements = [
    "Mais de 5 anos de experiência em direito do consumidor e bancário",
    "Centenas de casos resolvidos com sucesso",
    "Reconhecido pela excelência no atendimento ao cliente",
    "Atuação em todo território nacional",
    "Especialização em casos complexos de superendividamento",
    "Parceiro de diversas associações de consumidores",
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-primary to-primary/90 text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
              Conheça Nossa História
            </h1>
            <p className="text-lg sm:text-xl opacity-90">
              Um escritório fundado nos princípios da justiça, transparência e compromisso com resultados reais.
            </p>
          </div>
        </div>
      </section>

      {/* About Content */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <img
                src={lawyerPortrait}
                alt="Ian Granja"
                className="rounded-2xl shadow-2xl w-full h-auto"
              />
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-accent font-semibold mb-2">Sócio Fundador</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">Ian Granja</h2>
              </div>
              <p className="text-muted-foreground text-lg">
                Me chamo Ian. Na minha vida, sempre acreditei que algo só muda de verdade quando notamos a diferença. Com a advocacia não é diferente: não existe direito se o cidadão não vê o resultado prático dele.
              </p>
              <p className="text-muted-foreground text-lg">
                Por isso, busco soluções jurídicas eficientes, acredito em um atendimento próximo, transparente e personalizado. Meu compromisso é oferecer segurança e resultado prático a cada cliente que confia em meu escritório.
              </p>
              <p className="text-muted-foreground text-lg">
                Com mais de 5 anos de experiência, nosso escritório se especializou em defender os direitos de consumidores e empresas, sempre com foco em entregar não apenas processos, mas soluções que transformam a vida de nossos clientes.
              </p>
              <Button size="lg" asChild>
                <NavLink to="/contato">Entre em Contato</NavLink>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Mission and Vision */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <Card className="border-2 border-accent/20">
              <CardContent className="p-8">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent mb-6">
                  <Target className="h-8 w-8 text-accent-foreground" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">Nossa Missão</h3>
                <p className="text-muted-foreground text-lg">
                  Oferecer soluções jurídicas eficientes e personalizadas, com transparência total e compromisso inabalável com os resultados de nossos clientes.
                </p>
              </CardContent>
            </Card>
            <Card className="border-2 border-accent/20">
              <CardContent className="p-8">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent mb-6">
                  <Eye className="h-8 w-8 text-accent-foreground" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">Nossa Visão</h3>
                <p className="text-muted-foreground text-lg">
                  Ser reconhecido como referência em advocacia consultiva e contenciosa, destacando-nos pela excelência no atendimento e pela conquista de resultados práticos.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Nossos Valores</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Os princípios que guiam cada decisão e ação em nosso escritório.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 mx-auto mb-4">
                    <value.icon className="h-7 w-7 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/90 text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Award className="h-16 w-16 text-accent mx-auto mb-4" />
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Conquistas e Diferenciais</h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto">
              Anos de dedicação resultaram em reconhecimento e excelência.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {achievements.map((achievement, index) => (
              <div key={index} className="flex items-start space-x-3 bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent flex items-center justify-center mt-0.5">
                  <span className="text-accent-foreground text-sm font-bold">✓</span>
                </div>
                <p className="text-primary-foreground">{achievement}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
            Pronto para Conhecer Mais?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Entre em contato conosco e descubra como podemos ajudar a resolver sua questão jurídica.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <NavLink to="/contato">Agendar Consulta</NavLink>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <NavLink to="/atuacao">Ver Áreas de Atuação</NavLink>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Sobre;
