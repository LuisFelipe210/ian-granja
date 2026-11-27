import { useRef, useState, type FormEvent } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { PageHero } from "@/components/PageHero";
import { Grifo } from "@/components/Grifo";
import { Cta } from "@/components/Cta";
import { Fecho } from "@/components/Fecho";
import { HeroArt } from "@/components/HeroArt";
import { Campo, MesAno, ModalidadeSelect, PessoaToggle, labelClass } from "@/components/juros/Campos";
import {
    analisar,
    brl,
    consultarBacen,
    lerDecimal,
    lerMoeda,
    mNome,
    num,
    validar,
    type Analise,
    type Modalidade,
    type Pessoa,
} from "@/lib/juros";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Mensagem que vai pronta para o WhatsApp, em português de gente. */
const mensagemWhatsapp = (a: Analise) => {
    const e = a.entrada;
    return [
        "Olá! Usei a calculadora de juros do site e queria que o Ian olhasse meu contrato.",
        "",
        `Contrato: ${e.mod.nome}${e.mod.pessoa === "pj" ? " (empresa)" : ""}, assinado em ${mNome(e.mes)}`,
        `Valor financiado: ${brl(e.valor)}, ${e.parcelas} parcelas de ${brl(e.parcela)}`,
        `Minha taxa: ${num(a.contratoAm)}% ao mês. Média do Banco Central: ${num(a.media.am)}% ao mês.`,
    ].join("\n");
};

const Resultado = ({ a, onRefazer }: { a: Analise; onRefazer: () => void }) => {
    const reduce = useReducedMotion();
    const e = a.entrada;
    const n = a.nivel;

    return (
        <motion.article
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            aria-live="polite"
            className="sheet-on-paper px-6 py-8 font-serif sm:px-10 sm:py-10"
        >
            <div className="rubric flex items-baseline justify-between gap-6 border-b border-ink/25 pb-3 font-sans">
                <span>Comparação com o Banco Central</span>
                <span className="shrink-0 text-ink/70">{mNome(a.media.mes)}</span>
            </div>

            <h2 className="subdisplay mt-7 font-sans text-[clamp(1.6rem,3vw,2.25rem)] text-ink">
                {n === "media" ? (
                    <>
                        Sua taxa está <Grifo delay={250}>perto da média</Grifo> do mercado.
                    </>
                ) : (
                    <>
                        Sua taxa é <Grifo delay={250}>{num(a.razaoAm, 1)} vezes</Grifo> a média do Banco Central.
                    </>
                )}
            </h2>

            <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-[1.75] text-ink/85">
                {n === "abuso" &&
                    "A Justiça costuma considerar abusiva a taxa que fica muito acima da média do mercado. É um bom motivo para um advogado ler o seu contrato."}
                {n === "acima" &&
                    "Está acima da média, mas não muito longe. Ainda assim, o contrato pode ter tarifas e seguros cobrados sem necessidade."}
                {n === "media" &&
                    "Pelos números que você informou, os juros não fogem da média. Tarifas, seguros e outras cobranças do contrato ainda podem ser questionados."}
            </p>

            <dl className="mt-8 border-t border-ink/25 font-sans">
                <div className="flex items-baseline justify-between gap-6 border-b border-ink/25 py-4">
                    <dt className="text-muted-foreground">Sua taxa{a.taxasInformadas ? "" : " (pelas parcelas)"}</dt>
                    <dd className="whitespace-nowrap text-lg font-semibold tabular-nums text-ink">{num(a.contratoAm)}% ao mês</dd>
                </div>
                <div className="flex items-baseline justify-between gap-6 border-b border-ink/25 py-4">
                    <dt className="text-muted-foreground">Média do Banco Central em {mNome(a.media.mes)}</dt>
                    <dd className="whitespace-nowrap text-lg font-semibold tabular-nums text-ink">{num(a.media.am)}% ao mês</dd>
                </div>
                <div className="flex items-baseline justify-between gap-6 border-b border-ink/25 py-4">
                    <dt className="text-muted-foreground">Parcela com a taxa média</dt>
                    <dd className="whitespace-nowrap text-lg font-semibold tabular-nums text-ink">{brl(a.parcelaNaMedia)}</dd>
                </div>
            </dl>

            {a.custosEmbutidos && (
                <p className="mt-4 border-l-2 border-gold bg-gold/10 px-3.5 py-2.5 font-sans text-sm leading-relaxed text-ink">
                    Atenção: pelas parcelas informadas, a taxa efetiva ({num(a.taxaEfetiva)}% a.m.) é maior que a taxa
                    escrita no contrato ({num(a.contratoAm)}% a.m.). Isso costuma indicar seguros, tarifas ou encargos
                    embutidos no financiamento.
                </p>
            )}

            {a.media.nota && (
                <p className="mt-4 font-sans text-sm text-muted-foreground">{a.media.nota}</p>
            )}

            {a.diferenca > 0 && (
                <div className="mt-8 font-sans">
                    <p className="text-sm font-semibold text-muted-foreground">Você pode pagar a mais, no contrato todo</p>
                    <p className="display mt-2 text-[clamp(2.25rem,5vw,3.25rem)] tabular-nums text-ink">{brl(a.diferenca)}</p>
                    <p className="mt-4 border-t-2 border-gold pt-2 text-[0.9375rem] font-medium leading-snug text-ink">
                        {e.pagas > 0
                            ? `Das ${e.pagas} parcelas que você já pagou, cerca de ${brl(a.pagoAMais)} ficaram acima da média.`
                            : "É quanto o contrato custa a mais do que custaria com a taxa média."}
                    </p>
                </div>
            )}

            <div className="mt-10 flex flex-col gap-3 font-sans sm:flex-row sm:flex-wrap">
                <Cta variant="ink" whatsapp={mensagemWhatsapp(a)} className="w-full sm:w-auto">
                    Mandar meu contrato
                </Cta>
                <button
                    type="button"
                    onClick={onRefazer}
                    className="inline-flex min-h-14 items-center justify-center gap-2 border border-ink/40 px-6 font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-paper"
                >
                    <RotateCcw aria-hidden className="size-4" />
                    Calcular outro
                </button>
            </div>

            <p className="mt-8 border-t border-ink/15 pt-3 font-sans text-xs leading-relaxed text-ink/70">
                Estimativa pela Tabela Price, com a taxa média que o Banco Central divulgou para este tipo de crédito no mês da
                contratação. Não é parecer jurídico: só a leitura do contrato confirma se há abuso.
            </p>
        </motion.article>
    );
};

const passos = [
    ["O Banco Central publica a média.", "Todo mês ele junta as taxas cobradas pelos bancos e divulga a média de cada tipo de crédito."],
    ["A conta usa o mês em que você assinou.", "Comparamos com a média daquele mês, não com a de hoje."],
    ["Muito acima da média pode ser abuso.", "Quando a taxa passa bastante da média, a Justiça costuma rever o contrato."],
];

const ComoFunciona = () => (
    <div>
        <h2 className="subdisplay text-2xl text-ink">Como a conta é feita</h2>
        <ol className="mt-6 border-t border-ink/25">
            {passos.map(([t, d]) => (
                <li key={t} className="border-b border-ink/25 py-5">
                    <p className="font-semibold text-ink">{t}</p>
                    <p className="mt-1 leading-relaxed text-muted-foreground">{d}</p>
                </li>
            ))}
        </ol>
        <p className="mt-6 text-sm text-muted-foreground">Não precisa de cadastro. Os números não saem do seu aparelho.</p>
    </div>
);

const CalculadoraJuros = () => {
    const reduce = useReducedMotion();
    const [pessoa, setPessoa] = useState<Pessoa>("pf");
    const [mod, setMod] = useState<Modalidade | null>(null);
    const [mes, setMes] = useState("");
    const [ano, setAno] = useState("");
    const [valorF, setValorF] = useState("");
    const [parcela, setParcela] = useState("");
    const [parcelas, setParcelas] = useState("");
    const [pagas, setPagas] = useState("");
    const [taxa, setTaxa] = useState("");
    const [erro, setErro] = useState<string | null>(null);
    const [carregando, setCarregando] = useState(false);
    const [resultado, setResultado] = useState<Analise | null>(null);
    const resultadoRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const trocarPessoa = (p: Pessoa) => {
        setPessoa(p);
        setMod(null);
    };

    const calcular = async (ev: FormEvent) => {
        ev.preventDefault();
        const entrada = {
            mod: mod ?? undefined,
            mes: mes && ano ? `${ano}-${mes}` : "",
            valor: lerMoeda(valorF),
            parcela: lerMoeda(parcela),
            parcelas: parseInt(parcelas, 10) || 0,
            pagas: parseInt(pagas || "0", 10),
            taxaMensal: lerDecimal(taxa),
        };
        const msg = validar(entrada);
        if (msg) return setErro(msg);
        if (taxa && !(entrada.taxaMensal > 0)) return setErro("A taxa informada não é um número válido. Use, por exemplo, 2,49.");

        setErro(null);
        setCarregando(true);
        let a: Analise | null = null;
        try {
            await consultarBacen(entrada.mod!, entrada.mes);
            a = analisar({ ...entrada, mod: entrada.mod! });
        } finally {
            setCarregando(false);
        }
        if (!a) return setErro("Não conseguimos a taxa média do Banco Central agora. Tente de novo em alguns minutos.");

        setResultado(a);
        requestAnimationFrame(() =>
            resultadoRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }),
        );
    };

    const refazer = () => {
        setResultado(null);
        formRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    };

    return (
        <div className="min-h-screen bg-background">
            <Navigation />

            <main>
                <PageHero
                    title={["Seus juros estão", <Grifo delay={900}>acima da média?</Grifo>]}
                    lead="Compare a taxa do seu contrato com a média que o Banco Central divulgou no mês em que você assinou. Leva um minuto."
                    art={<HeroArt variant="calculo" />}
                />

                <section className="bg-background">
                    <div className="container grid gap-x-16 gap-y-14 py-20 md:py-28 lg:grid-cols-12">
                        <div className="lg:col-span-7">
                            <form
                                ref={formRef}
                                onSubmit={calcular}
                                noValidate
                                className="sheet-on-paper scroll-mt-28 space-y-9 px-6 py-8 sm:px-10 sm:py-10"
                            >
                                <div>
                                    <h2 className="subdisplay text-3xl text-ink">Dados do contrato</h2>
                                    <p className="mt-3 text-muted-foreground">Está tudo na primeira página do contrato ou no carnê.</p>
                                </div>

                                <fieldset className="space-y-3">
                                    <legend className={labelClass}>Quem assinou</legend>
                                    <PessoaToggle value={pessoa} onChange={trocarPessoa} labels={{ pf: "Pessoa física", pj: "Empresa" }} />
                                </fieldset>

                                <fieldset className="space-y-3">
                                    <legend className={labelClass}>Tipo de contrato</legend>
                                    <ModalidadeSelect id="cli-tipo" pessoa={pessoa} value={mod?.id ?? null} onChange={setMod} />
                                </fieldset>

                                <fieldset>
                                    <legend className={labelClass}>Quando você assinou</legend>
                                    <MesAno idPrefix="cli" mes={mes} ano={ano} onMes={setMes} onAno={setAno} />
                                </fieldset>

                                <div className="grid gap-7 sm:grid-cols-2">
                                    <Campo id="cli-valor" label="Valor financiado" tipo="moeda" value={valorF} onChange={setValorF} placeholder="50.000,00" />
                                    <Campo id="cli-parcela" label="Valor de cada parcela" tipo="moeda" value={parcela} onChange={setParcela} placeholder="1.850,00" />
                                    <Campo id="cli-n" label="Quantidade de parcelas" tipo="inteiro" value={parcelas} onChange={setParcelas} placeholder="48" />
                                    <Campo id="cli-pagas" label="Parcelas já pagas" tipo="inteiro" value={pagas} onChange={setPagas} placeholder="0" />
                                </div>

                                <Campo
                                    id="cli-taxa"
                                    label="Taxa de juros ao mês (se souber)"
                                    tipo="taxa"
                                    sufixo="% a.m."
                                    value={taxa}
                                    onChange={setTaxa}
                                    placeholder="2,49"
                                    ajuda="Se deixar em branco, a gente calcula a taxa pelas parcelas."
                                />

                                {erro && (
                                    <p role="alert" className="border-t-2 border-destructive pt-3 font-medium text-destructive">
                                        {erro}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={carregando}
                                    className="inline-flex min-h-14 w-full items-center justify-center gap-3 bg-ink px-7 text-base font-semibold text-paper transition-colors duration-200 hover:bg-ink-soft disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                                >
                                    {carregando && <Loader2 aria-hidden className="size-5 animate-spin" />}
                                    {carregando ? "Consultando o Banco Central" : "Comparar com a média"}
                                </button>
                            </form>
                        </div>

                        <div ref={resultadoRef} className="scroll-mt-28 lg:col-span-5">
                            <div className="lg:sticky lg:top-28">
                                {resultado ? <Resultado a={resultado} onRefazer={refazer} /> : <ComoFunciona />}
                            </div>
                        </div>
                    </div>
                </section>

                <Fecho
                    title="Prefere que a gente leia o contrato?"
                    text="Mande uma foto do contrato pelo WhatsApp. O Ian confere taxa, tarifas e seguros e explica o que dá para fazer."
                    message="Olá! Quero mandar meu contrato de financiamento para análise dos juros."
                />
            </main>

            <Footer />
        </div>
    );
};

export default CalculadoraJuros;
