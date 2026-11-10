import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { PageHero } from "@/components/PageHero";
import { Grifo } from "@/components/Grifo";
import { SignatureArt } from "@/components/HeroArt";
import { Cta, TextLink } from "@/components/Cta";
import { Fecho } from "@/components/Fecho";
import { ADDRESS_LINES, HOURS, MAPS_EMBED, MAPS_URL } from "@/lib/contact";
import lawyerPortrait from "@/assets/lawyer-portrait.webp";

const credentials = [
    { label: "Inscrição", value: "OAB/PE 61.107" },
    { label: "Experiência", value: "5+ anos de mercado" },
    { label: "Formação", value: "Pós-graduado em direito civil, processo civil e direito bancário" },
];

const values = [
    {
        title: "Ética inegociável",
        description: "Transparência absoluta. A confiança é o nosso maior ativo.",
    },
    {
        title: "Foco na solução",
        description: "Não vendemos processos, entregamos estratégias de resolução.",
    },
    {
        title: "Atendimento humanizado",
        description: "Entendemos que por trás de cada processo existe uma vida.",
    },
    {
        title: "Excelência técnica",
        description: "Atualização constante para enfrentar casos complexos.",
    },
];

const Sobre = () => (
    <div className="min-h-screen bg-background">
        <Navigation />

        <main>
            <PageHero
                title={[
                    "Quem assina",
                    <>
                        <Grifo delay={900}>embaixo.</Grifo>
                    </>,
                ]}
                lead="Defesa técnica e estratégia jurídica na proteção do seu patrimônio e dos seus direitos, por um advogado que você sabe quem é."
                aside={
                    <div className="flex items-start justify-end">
                        {/* Folha de qualificação, enfiada atrás da foto; só onde há largura para as duas. */}
                        <div className="sheet relative -mr-8 mt-24 hidden w-[17.5rem] shrink-0 -rotate-[2.5deg] py-6 pl-6 pr-12 xl:block">
                            <p className="rubric border-b border-ink/25 pb-3 text-ink">Qualificação</p>
                            <dl className="mt-4 space-y-4">
                                <div>
                                    <dt className="text-xs font-semibold text-ink/70">Inscrição</dt>
                                    <dd className="mt-1 font-serif text-[1.0625rem] font-semibold text-ink">
                                        <Grifo delay={1400}>OAB/PE 61.107</Grifo>
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-semibold text-ink/70">Formação</dt>
                                    <dd className="mt-1 font-serif text-[0.9375rem] leading-snug text-ink">
                                        Pós-graduado em direito civil, processo civil e direito bancário
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-semibold text-ink/70">Escritório</dt>
                                    <dd className="mt-1 font-serif text-[0.9375rem] leading-snug text-ink">
                                        Petrolina-PE, presencial e online
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        <div className="sheet relative w-full max-w-[21rem] p-3 lg:rotate-[1.5deg]">
                            <img
                                src={lawyerPortrait}
                                alt="Ian Granja, advogado, em seu escritório"
                                width={1024}
                                height={1024}
                                className="aspect-[4/5] w-full object-cover object-top"
                            />
                            <p className="rubric px-1 pb-1 pt-3 text-ink">Ian Granja · Sócio fundador</p>
                        </div>
                    </div>
                }
            >
                <SignatureArt className="mt-12 max-w-[26rem]" />
            </PageHero>

            <section className="bg-background">
                <div className="container grid gap-x-16 gap-y-14 py-20 md:py-28 lg:grid-cols-12">
                    <div className="lg:col-span-7">
                        <h2 className="display text-[clamp(2rem,4.2vw,3.5rem)]">Ian Granja</h2>
                        <p className="mt-3 text-lg font-medium text-gold-deep">Sócio fundador e advogado sênior</p>

                        <div className="mt-9 max-w-[62ch] space-y-6 font-serif text-[1.1875rem] leading-[1.7] text-ink/90">
                            <p>
                                Com uma atuação sólida no mercado jurídico, fundei o escritório com uma premissa
                                clara:{" "}
                                <Grifo className="font-semibold text-ink">
                                    o Direito não precisa ser complicado, ele precisa ser efetivo.
                                </Grifo>
                            </p>
                            <p>
                                Minha trajetória é marcada pela defesa intransigente dos interesses dos meus
                                clientes, combinando rigor técnico acadêmico com uma visão prática dos tribunais.
                                Acredito que cada caso exige uma estratégia única, desenhada sob medida.
                            </p>
                        </div>

                        <div className="mt-10 flex flex-col gap-x-8 gap-y-5 sm:flex-row sm:items-center">
                            <Cta variant="ink" whatsapp="Olá! Gostaria de agendar uma reunião com o Ian.">
                                Agendar reunião
                            </Cta>
                            <TextLink to="/atuacao" className="text-ink">
                                Ver áreas de atuação
                            </TextLink>
                        </div>
                    </div>

                    <dl className="self-start border-t border-ink/25 lg:col-span-5">
                        {credentials.map((cred) => (
                            <div key={cred.label} className="border-b border-ink/25 py-6">
                                <dt className="text-sm font-semibold text-muted-foreground">{cred.label}</dt>
                                <dd className="subdisplay mt-2 text-2xl text-ink">{cred.value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            <section className="bg-ink text-paper">
                <div className="container py-20 md:py-28">
                    <div className="grid gap-x-12 gap-y-6 lg:grid-cols-12 lg:items-end">
                        <h2 className="display text-[clamp(2rem,4.2vw,3.5rem)] lg:col-span-7">
                            Princípios que nos guiam.
                        </h2>
                        <p className="max-w-[44ch] text-lg leading-relaxed text-paper/80 lg:col-span-5">
                            Não somos apenas advogados. Somos parceiros comprometidos com a ética e a eficiência.
                        </p>
                    </div>

                    <dl className="mt-14 grid gap-x-12 border-t border-paper/20 md:grid-cols-2">
                        {values.map((value) => (
                            <div key={value.title} className="border-b border-paper/20 py-8">
                                <dt className="subdisplay text-2xl text-gold-light">{value.title}</dt>
                                <dd className="mt-3 max-w-[42ch] text-lg leading-relaxed text-paper/85">
                                    {value.description}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            <section className="bg-background">
                <div className="container grid gap-x-16 gap-y-12 py-20 md:py-28 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                        <h2 className="display text-[clamp(2rem,4.2vw,3.5rem)]">Onde nos encontrar.</h2>
                        <address className="mt-8 text-lg not-italic leading-relaxed text-ink">
                            {ADDRESS_LINES.map((line) => (
                                <span key={line} className="block">{line}</span>
                            ))}
                        </address>
                        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{HOURS}</p>
                        <Cta variant="line-dark" href={MAPS_URL} className="mt-8">
                            Traçar rota
                        </Cta>
                    </div>

                    <div className="sheet-on-paper p-3 lg:col-span-8">
                        <iframe
                            src={MAPS_EMBED}
                            title="Mapa com a localização do escritório em Petrolina-PE"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            className="block h-[420px] w-full border-0 grayscale"
                        />
                    </div>
                </div>
            </section>

            <Fecho
                title="Mande o papel. A gente lê."
                text="Uma foto do contrato, da carta ou da notificação já basta para a primeira conversa."
            />
        </main>

        <Footer />
    </div>
);

export default Sobre;
