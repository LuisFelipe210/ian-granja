import { useParams, Navigate, Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { practiceAreas } from "@/data/practiceAreas";
import { areaDocuments, areaPhrases } from "@/data/documents";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { PageHero } from "@/components/PageHero";
import { DocumentSheet } from "@/components/DocumentSheet";
import { FaqList } from "@/components/FaqList";
import { Cta } from "@/components/Cta";
import { Fecho } from "@/components/Fecho";
import { HOURS } from "@/lib/contact";

const commonDoubts = [
    {
        question: "Quais documentos preciso para iniciar?",
        answer:
            "Geralmente solicitamos documentos pessoais (RG, CPF), comprovante de residência e todos os documentos relacionados ao fato (contratos, trocas de e-mail, notificações). Faremos uma triagem detalhada na primeira reunião.",
    },
    {
        question: "Quanto tempo demora um processo nessa área?",
        answer:
            "O tempo varia conforme a complexidade e a vara judicial. Nossa atuação busca agilidade, avaliando liminares ou acordos extrajudiciais quando vantajoso para o cliente.",
    },
    {
        question: "Como funcionam os honorários?",
        answer:
            "Trabalhamos com total transparência. Analisamos o caso e propomos honorários justos, que podem ser fixos, parcelados ou, em alguns casos, condicionados ao êxito da ação (ad exitum).",
    },
];

const reasons = [
    {
        title: "Domínio da legislação",
        text: "Conhecimento profundo das leis específicas e das últimas decisões dos tribunais sobre o tema, para construir a melhor tese de defesa.",
    },
    {
        title: "Estratégia assertiva",
        text: "Evitamos erros comuns que generalistas cometem. Cada documento é analisado com lupa técnica para proteger o seu direito.",
    },
];

const AtuacaoDetalhes = () => {
    const { slug } = useParams();
    const area = practiceAreas.find((item) => item.slug === slug);

    if (!area) {
        return <Navigate to="/atuacao" replace />;
    }

    const doc = areaDocuments[area.slug];
    const phrase = areaPhrases[area.slug];
    // Palavras longas como "Superendividamento" não cabem na coluna no tamanho padrão.
    const longestWord = Math.max(...area.title.split(" ").map((word) => word.length));
    const whatsappMessage =`Olá! Preciso de ajuda com ${area.title}.`;

    return (
        <div className="min-h-screen bg-background">
            <Navigation />

            <main>
                <PageHero
                    key={area.slug}
                    before={
                        <nav aria-label="Trilha" className="mb-7 text-sm font-medium">
                            <Link
                                to="/atuacao"
                                className="text-gold-light underline decoration-gold-light/40 underline-offset-4 transition-colors hover:decoration-gold-light"
                            >
                                Áreas de atuação
                            </Link>
                            <span aria-hidden className="px-2 text-paper/50">/</span>
                            <span className="text-paper/75">{area.title}</span>
                        </nav>
                    }
                    title={[area.title]}
                    titleClassName={
                        longestWord > 12
                            ? "text-[clamp(1.7rem,3.9vw,3.25rem)]"
                            : "text-[clamp(2.5rem,5vw,4.5rem)]"
                    }
                    lead={area.description}
                    aside={
                        doc && (
                            <div className="lg:rotate-[1deg]">
                                <DocumentSheet doc={doc} />
                            </div>
                        )
                    }
                >
                    {phrase && (
                        <p className="subdisplay mt-10 max-w-[18ch] text-[clamp(1.5rem,2.6vw,2rem)] text-gold-light">
                            “{phrase}”
                        </p>
                    )}
                </PageHero>

                <section className="bg-background">
                    <div className="container grid gap-x-16 gap-y-16 py-20 md:py-28 lg:grid-cols-12">
                        <div className="space-y-20 lg:col-span-8">
                            <div>
                                <h2 className="display text-[clamp(1.75rem,3.4vw,2.75rem)]">O que está em jogo.</h2>
                                <div className="mt-7 max-w-[68ch] space-y-5 font-serif text-[1.125rem] leading-[1.75] text-ink/90">
                                    <p>{area.fullDescription || area.description}</p>
                                    <p>
                                        Nossa abordagem nesta área é pautada pela análise minuciosa de cada
                                        detalhe. Cada caso tem suas particularidades e exige uma estratégia
                                        jurídica própria, voltada para a resolução do conflito e para a
                                        prevenção de riscos futuros.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <h2 className="display text-[clamp(1.75rem,3.4vw,2.75rem)]">
                                    O que podemos fazer por você.
                                </h2>
                                <ul className="mt-8 grid border-t border-ink/25 sm:grid-cols-2 sm:gap-x-10">
                                    {area.services.map((service) => (
                                        <li
                                            key={service}
                                            className="flex items-start gap-3 border-b border-ink/25 py-4 text-[1.0625rem] font-medium text-ink"
                                        >
                                            <Check aria-hidden strokeWidth={2.5} className="mt-1 size-4 shrink-0 text-gold-deep" />
                                            {service}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div>
                                <h2 className="display text-[clamp(1.75rem,3.4vw,2.75rem)]">
                                    Por que um advogado da área.
                                </h2>
                                <dl className="mt-8 grid gap-x-12 gap-y-8 sm:grid-cols-2">
                                    {reasons.map((reason) => (
                                        <div key={reason.title} className="border-t-2 border-gold pt-4">
                                            <dt className="subdisplay text-xl text-ink">{reason.title}</dt>
                                            <dd className="mt-3 leading-relaxed text-muted-foreground">{reason.text}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>

                            <div>
                                <h2 className="display mb-8 text-[clamp(1.75rem,3.4vw,2.75rem)]">Dúvidas frequentes.</h2>
                                <FaqList items={commonDoubts} />
                            </div>
                        </div>

                        <aside className="lg:col-span-4">
                            <div className="space-y-10 lg:sticky lg:top-28">
                                <div className="bg-ink p-8 text-paper">
                                    <h2 className="subdisplay text-2xl">Precisa de ajuda com {area.title}?</h2>
                                    <p className="mt-4 leading-relaxed text-paper/80">
                                        Mande o seu documento ou conte o que aconteceu. A conversa é sigilosa.
                                    </p>
                                    <Cta whatsapp={whatsappMessage} className="mt-7 w-full">
                                        Falar no WhatsApp
                                    </Cta>
                                    <p className="mt-5 text-sm text-paper/75">{HOURS}. Online e presencial.</p>
                                </div>

                                <nav aria-label="Outras áreas de atuação">
                                    <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Outras áreas</h2>
                                    <ul className="border-t border-ink/25">
                                        {practiceAreas
                                            .filter((item) => item.slug !== area.slug)
                                            .map((item) => (
                                                <li key={item.slug} className="border-b border-ink/25">
                                                    <Link
                                                        to={`/atuacao/${item.slug}`}
                                                        className="group flex items-center justify-between gap-4 py-3.5 font-medium text-ink"
                                                    >
                                                        <span>
                                                            <span className="grifo grifo-hover">{item.title}</span>
                                                        </span>
                                                        <ArrowRight
                                                            aria-hidden
                                                            className="size-4 shrink-0 text-ink/50 transition-transform duration-200 ease-out group-hover:translate-x-1 group-hover:text-ink"
                                                        />
                                                    </Link>
                                                </li>
                                            ))}
                                    </ul>
                                </nav>
                            </div>
                        </aside>
                    </div>
                </section>

                <Fecho
                    title="Ainda em dúvida sobre o seu caso?"
                    text="Uma orientação logo no começo ajuda a entender prazos, riscos e opções antes de assinar, pagar ou desistir."
                    message={whatsappMessage}
                />
            </main>

            <Footer />
        </div>
    );
};

export default AtuacaoDetalhes;
