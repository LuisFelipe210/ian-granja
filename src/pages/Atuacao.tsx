import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { PageHero } from "@/components/PageHero";
import { Grifo } from "@/components/Grifo";
import { HeroArt } from "@/components/HeroArt";
import { AreaIndex } from "@/components/AreaIndex";
import { TextLink } from "@/components/Cta";
import { Fecho } from "@/components/Fecho";

const methodologySteps = [
    {
        title: "Diagnóstico profundo",
        description:
            "Não olhamos apenas o problema, olhamos o contexto. Analisamos riscos, provas e viabilidade antes de qualquer ação.",
    },
    {
        title: "Estratégia personalizada",
        description:
            "Fugimos de modelos prontos. Desenhamos a tese jurídica específica para o seu caso.",
    },
    {
        title: "Atuação combativa",
        description:
            "Diligência ativa. Não esperamos o processo andar sozinho; impulsionamos cada etapa com técnica e urgência.",
    },
    {
        title: "Resolução e clareza",
        description:
            "Prestação de contas transparente, em linguagem que você entende, do início ao fim.",
    },
];

const Atuacao = () => (
    <div className="min-h-screen bg-background">
        <Navigation />

        <main>
            <PageHero
                title={[
                    "O que aconteceu",
                    <>
                        <Grifo delay={900}>com você?</Grifo>
                    </>,
                ]}
                lead="Oito áreas de atuação, um mesmo jeito de trabalhar: ler o documento, explicar em português claro e agir. Escolha a frase mais parecida com a sua."
                art={<HeroArt variant="pilha" />}
            />

            <section className="bg-ink pb-20 text-paper md:pb-28">
                <div className="container">
                    <AreaIndex />
                </div>
            </section>

            <section className="bg-background">
                <div className="container grid gap-x-16 gap-y-12 py-20 md:py-28 lg:grid-cols-12">
                    <div className="lg:col-span-5">
                        <div className="lg:sticky lg:top-32">
                            <h2 className="display text-[clamp(2rem,4.2vw,3.5rem)]">
                                Transparência do início ao fim.
                            </h2>
                            <p className="mt-7 max-w-[44ch] text-lg leading-relaxed text-muted-foreground">
                                Processos jurídicos geram ansiedade. Por isso o trabalho segue quatro etapas, e
                                você sabe em qual delas o seu caso está.
                            </p>
                            <TextLink to="/contato" className="mt-8 text-ink">
                                Entenda como trabalhamos
                            </TextLink>
                        </div>
                    </div>

                    <ol className="border-t border-ink/25 lg:col-span-7">
                        {methodologySteps.map((step, index) => (
                            <li
                                key={step.title}
                                className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 border-b border-ink/25 py-8 md:grid-cols-[5.5rem_minmax(0,1fr)]"
                            >
                                <span
                                    aria-hidden
                                    className="display text-[2.5rem] text-gold-deep md:text-[3.25rem]"
                                >
                                    {index + 1}
                                </span>
                                <div>
                                    <h3 className="subdisplay text-2xl text-ink">{step.title}</h3>
                                    <p className="mt-3 max-w-[56ch] font-serif text-[1.0625rem] leading-[1.7] text-ink/85">
                                        {step.description}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <Fecho
                title="Não achou a sua frase?"
                text="Conte o que aconteceu, do seu jeito. O atendimento começa entendendo o seu caso e dizendo qual é o caminho."
                message="Olá! Preciso de orientação e não sei qual é a área do meu caso."
            />
        </main>

        <Footer />
    </div>
);

export default Atuacao;
