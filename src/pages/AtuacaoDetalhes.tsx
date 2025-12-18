import { useParams, Navigate } from "react-router-dom";
import { practiceAreas } from "@/data/practiceAreas";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { CheckCircle2, ArrowRight, Phone } from "lucide-react";

const AtuacaoDetalhes = () => {
    const { slug } = useParams(); // Pega o slug da URL (ex: 'direito-bancario')

    // Encontra a área correspondente nos dados
    const area = practiceAreas.find((item) => item.slug === slug);

    // Se não achar (ex: url errada), volta pra home ou página 404
    if (!area) {
        return <Navigate to="/atuacao" replace />;
    }

    const Icon = area.icon;

    return (
        <div className="min-h-screen bg-background">
            <Navigation />

            {/* --- HERO DA ÁREA --- */}
            <section className="relative pt-32 pb-20 bg-primary overflow-hidden">
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="absolute -right-20 top-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl"></div>

                <div className="container relative mx-auto px-4">
                    <div className="max-w-4xl">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 backdrop-blur-md rounded-full text-accent border border-accent/20 mb-6">
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-semibold uppercase tracking-wider">Especialidade</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                            {area.title}
                        </h1>
                        <p className="text-xl text-white/80 leading-relaxed max-w-2xl">
                            {area.description}
                        </p>
                    </div>
                </div>
            </section>

            {/* --- CONTEÚDO PRINCIPAL --- */}
            <section className="py-20">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

                        {/* Coluna da Esquerda: Detalhes e Serviços */}
                        <div className="lg:col-span-2 space-y-12">
                            <div>
                                <h2 className="text-3xl font-bold text-foreground mb-6">Como podemos ajudar</h2>
                                <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                                    {/* Aqui você usaria area.fullDescription se tivesse criado no arquivo de dados */}
                                    Nossa atuação em {area.title} é pautada na excelência técnica e na busca incansável pelos direitos dos nossos clientes. Entendemos as nuances desta área e aplicamos as melhores estratégias jurídicas.
                                </p>

                                <div className="bg-muted/30 p-8 rounded-2xl border border-accent/20">
                                    <h3 className="text-xl font-bold text-foreground mb-6">Nossos Serviços em {area.title}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {area.services.map((service, idx) => (
                                            <div key={idx} className="flex items-start gap-3">
                                                <div className="mt-1 w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                                                    <CheckCircle2 className="w-3 h-3 text-accent" />
                                                </div>
                                                <span className="text-foreground/80">{service}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Coluna da Direita: Sidebar / CTA */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-32 space-y-6">
                                {/* Card de Contato */}
                                <div className="bg-primary text-primary-foreground p-8 rounded-2xl shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>

                                    <h3 className="text-2xl font-bold mb-4 relative z-10">Precisa de um especialista em {area.title}?</h3>
                                    <p className="text-primary-foreground/80 mb-8 relative z-10">
                                        Agende uma consulta inicial para avaliarmos o seu caso detalhadamente.
                                    </p>

                                    <Button size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold" asChild>
                                        <NavLink to="/contato">
                                            <Phone className="w-4 h-4 mr-2" />
                                            Falar com Advogado
                                        </NavLink>
                                    </Button>
                                </div>

                                {/* Outras Áreas (Navegação rápida) */}
                                <div className="border border-border p-6 rounded-2xl">
                                    <h4 className="font-bold mb-4">Outras Áreas</h4>
                                    <nav className="flex flex-col space-y-2">
                                        {practiceAreas
                                            .filter(a => a.slug !== slug) // Não mostra a área atual
                                            .slice(0, 5) // Mostra apenas 5
                                            .map((item) => (
                                                <NavLink
                                                    key={item.slug}
                                                    to={`/atuacao/${item.slug}`}
                                                    className="block p-3 rounded-lg hover:bg-muted transition-colors text-sm text-muted-foreground hover:text-foreground"
                                                >
                                                    {item.title}
                                                </NavLink>
                                            ))}
                                    </nav>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default AtuacaoDetalhes;