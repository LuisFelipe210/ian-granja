import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Cta, TextLink } from "@/components/Cta";
import { Grifo } from "@/components/Grifo";
import { Rise } from "@/components/PageHero";
import { DocumentSheet } from "@/components/DocumentSheet";
import { AreaIndex } from "@/components/AreaIndex";
import { Fecho } from "@/components/Fecho";
import { areaDocuments, heroDocumentSlugs } from "@/data/documents";
import { OAB } from "@/lib/contact";
import { cn } from "@/lib/utils";
import lawyerPortrait from "@/assets/lawyer-portrait.webp";
import cliente1 from "@/assets/cliente1.webp";
import cliente2 from "@/assets/cliente2.webp";
import cliente3 from "@/assets/cliente3.webp";

const testimonials = [
    {
        before: "Profissionalismo ímpar. O Dr. Ian conseguiu ",
        mark: "resolver uma situação que se arrastava há anos",
        after: " em outros escritórios.",
        author: "Jefferson Adriano",
        role: "Empresário",
        image: cliente1,
    },
    {
        before: "Me senti segura desde o primeiro atendimento. A ",
        mark: "transparência sobre os riscos e possibilidades",
        after: " foi total.",
        author: "Maria Almeida",
        role: "Autônoma",
        image: cliente3,
    },
    {
        before: "Resultado rápido e ",
        mark: "atendimento humanizado",
        after: ". Indico para todos os meus conhecidos.",
        author: "Victor Flávio",
        role: "Dentista",
        image: cliente2,
    },
];

const Index = () => {
    const [active, setActive] = useState(heroDocumentSlugs[0]);
    const doc = areaDocuments[active];

    return (
        <div className="min-h-screen bg-background">
            <Navigation />

            <main>
                {/* A mesa: o título e o documento já grifado */}
                <section className="overflow-hidden bg-ink text-paper">
                    <div className="container grid grid-cols-1 gap-x-12 gap-y-14 pb-20 pt-32 md:pt-40 lg:grid-cols-12 lg:pb-28">
                        <div className="lg:col-span-6 lg:pt-8">
                            <h1 className="display text-[clamp(2.25rem,4.3vw,3.625rem)]">
                                <Rise>Antes de assinar,</Rise>
                                <Rise delay={0.09}>
                                    <Grifo delay={950}>deixa a gente ler.</Grifo>
                                </Rise>
                            </h1>

                            <p className="mt-8 max-w-[48ch] text-lg leading-relaxed text-paper/80">
                                Contrato do banco, carta do plano de saúde, termo de rescisão. Mande o papel que
                                chegou para você: Ian Granja lê, explica em português claro e diz o que dá para
                                fazer.
                            </p>

                            <div className="mt-10 flex flex-col gap-x-8 gap-y-5 sm:flex-row sm:items-center">
                                <Cta whatsapp="Olá! Quero mandar um documento para o Ian dar uma olhada.">
                                    Mandar meu documento
                                </Cta>
                                <TextLink to="/atuacao" className="text-paper">
                                    Ver áreas de atuação
                                </TextLink>
                            </div>

                            <p className="mt-12 text-sm font-medium text-paper/75">
                                Ian Granja, {OAB}. Petrolina-PE e atendimento online.
                            </p>
                        </div>

                        <div className="min-w-0 lg:col-span-6">
                            <div className="lg:-rotate-[1.2deg]">
                                <div
                                    role="group"
                                    aria-label="Escolha o tipo de documento"
                                    className="flex gap-1"
                                >
                                    {heroDocumentSlugs.map((slug) => (
                                        <button
                                            key={slug}
                                            type="button"
                                            aria-pressed={slug === active}
                                            onClick={() => setActive(slug)}
                                            className={cn(
                                                "min-h-11 flex-auto whitespace-nowrap px-2 text-[0.8125rem] font-semibold transition-colors duration-200 sm:flex-none sm:px-4 sm:text-sm",
                                                slug === active
                                                    ? "bg-paper-white text-ink"
                                                    : "bg-ink-soft text-paper/85 hover:bg-paper/25 hover:text-paper",
                                            )}
                                        >
                                            {/* No celular entra o rótulo curto, para as quatro abas caberem à vista. */}
                                            <span className="sm:hidden">
                                                {areaDocuments[slug].tabShort ?? areaDocuments[slug].tab}
                                            </span>
                                            <span className="hidden sm:inline">{areaDocuments[slug].tab}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="relative">
                                    <div
                                        aria-hidden
                                        className="absolute inset-0 hidden translate-x-3 translate-y-2 rotate-[1.6deg] bg-paper/45 lg:block"
                                    />
                                    <div
                                        aria-hidden
                                        className="absolute inset-0 hidden translate-x-1.5 translate-y-1 rotate-[0.7deg] bg-paper/75 lg:block"
                                    />
                                    {/* A folha fica sempre no lugar; só o texto troca e o grifo corre de novo. */}
                                    <DocumentSheet key={active} doc={doc} notes="side" className="relative" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Quem lê: o advogado qualificado como num documento */}
                <section className="bg-background">
                    <div className="container grid gap-x-16 gap-y-12 py-20 md:py-28 lg:grid-cols-12 lg:items-center">
                        <div className="lg:col-span-5">
                            <div className="sheet-on-paper max-w-md p-3 lg:rotate-[1deg]">
                                <img
                                    src={lawyerPortrait}
                                    alt="Ian Granja, advogado, em seu escritório"
                                    width={1024}
                                    height={1024}
                                    loading="lazy"
                                    className="aspect-[4/5] w-full object-cover object-top"
                                />
                            </div>
                        </div>

                        <div className="lg:col-span-7">
                            <h2 className="display text-[clamp(2rem,4.2vw,3.5rem)]">Quem lê o seu documento.</h2>

                            <p className="mt-8 max-w-[38ch] font-serif text-[clamp(1.25rem,2.1vw,1.625rem)] leading-[1.55] text-ink">
                                Ian Granja, advogado inscrito na <Grifo>OAB/PE sob o nº 61.107</Grifo>,
                                pós-graduado em direito civil, processo civil e direito bancário, com escritório
                                em Petrolina-PE e <Grifo delay={250}>atendimento direto pelo WhatsApp</Grifo>.
                            </p>

                            <p className="mt-8 max-w-[62ch] text-[1.0625rem] leading-relaxed text-muted-foreground">
                                Por trás de cada processo existe uma história, um patrimônio ou uma família. Por
                                isso a atuação é técnica, mas o atendimento é, acima de tudo, humano: transparência
                                total sobre honorários e riscos, e comunicação sem juridiquês.
                            </p>

                            <TextLink to="/sobre" className="mt-9 text-ink">
                                Conheça o advogado
                            </TextLink>
                        </div>
                    </div>
                </section>

                {/* As áreas, pela frase com que o cliente chega */}
                <section className="bg-ink text-paper">
                    <div className="container py-20 md:py-28">
                        <div className="mb-12 grid gap-x-12 gap-y-6 lg:grid-cols-12 lg:items-end">
                            <h2 className="display text-[clamp(2rem,4.2vw,3.5rem)] lg:col-span-7">
                                O que aconteceu com você?
                            </h2>
                            <p className="max-w-[46ch] text-lg leading-relaxed text-paper/80 lg:col-span-5">
                                Escolha a frase mais parecida com a sua. Cada uma leva à área que cuida do
                                assunto e ao tipo de documento que costuma vir junto.
                            </p>
                        </div>
                        <AreaIndex />
                    </div>
                </section>

                {/* Depoimentos: declarações assinadas */}
                <section className="bg-background">
                    <div className="container py-20 md:py-28">
                        <h2 className="display max-w-[16ch] text-[clamp(2rem,4.2vw,3.5rem)]">
                            Quem já passou por aqui.
                        </h2>

                        <div className="mt-14 grid gap-y-12 lg:grid-cols-3 lg:gap-x-0">
                            {testimonials.map((t, i) => (
                                <figure
                                    key={t.author}
                                    className={cn(
                                        "flex flex-col border-ink/20 lg:px-10",
                                        i === 0 && "lg:pl-0",
                                        i > 0 && "border-t pt-12 lg:border-l lg:border-t-0 lg:pt-0",
                                        i === testimonials.length - 1 && "lg:pr-0",
                                    )}
                                >
                                    <blockquote className="font-serif text-xl leading-[1.6] text-ink">
                                        “{t.before}
                                        <Grifo delay={i * 200}>{t.mark}</Grifo>
                                        {t.after}”
                                    </blockquote>
                                    <figcaption className="mt-8 flex items-center gap-4 lg:mt-auto lg:pt-10">
                                        <img
                                            src={t.image}
                                            alt=""
                                            loading="lazy"
                                            className="size-14 object-cover object-top"
                                        />
                                        <span>
                                            <span className="block font-semibold text-ink">{t.author}</span>
                                            <span className="block text-sm text-muted-foreground">{t.role}</span>
                                        </span>
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                    </div>
                </section>

                <Fecho
                    title="Mande o papel. A gente lê."
                    text="Uma foto do contrato, da carta ou da notificação já basta para a primeira conversa. Você recebe uma explicação clara do que está escrito e das opções que existem."
                />
            </main>

            <Footer />
        </div>
    );
};

export default Index;
