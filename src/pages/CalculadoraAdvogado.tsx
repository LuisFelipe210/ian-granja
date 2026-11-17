import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Loader2 } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Campo, MesAno, ModalidadeSelect, PessoaToggle, labelClass } from "@/components/juros/Campos";
import {
    LIMITE_ABUSIVO,
    analisar,
    brl,
    consultarBacen,
    historico,
    lerDecimal,
    lerMoeda,
    mIdx,
    mNome,
    nivel,
    num,
    resumo,
    validar,
    type Analise,
    type Modalidade,
    type Nivel,
    type Pessoa,
} from "@/lib/juros";
import { HeroArt } from "@/components/HeroArt";
import logo from "@/assets/logo2.png";

/**
 * Calculadora revisional completa, para uso do advogado.
 * Fica fora do menu e fora do sitemap (noindex no SeoManager): acesso só pelo link.
 */

const ROTULO: Record<Nivel, string> = { abuso: "Indício de abuso", acima: "Acima da média", media: "Na média" };
const COR: Record<Nivel, string> = {
    abuso: "bg-destructive text-destructive-foreground",
    acima: "bg-gold-light text-ink",
    media: "bg-ink/10 text-ink",
};

const Selo = ({ n }: { n: Nivel }) => (
    <span className={cn("inline-block px-2.5 py-1 text-xs font-semibold", COR[n])}>{ROTULO[n]}</span>
);

const Comparacao = ({ titulo, contrato, media, serie, mes, razao }: { titulo: string; contrato: string; media: string; serie: number | null; mes: string; razao: number }) => (
    <div className="border border-ink/25 bg-card p-5">
        <div className="flex items-center justify-between gap-3">
            <h3 className="rubric text-ink/80">{titulo}</h3>
            <Selo n={nivel(razao)} />
        </div>
        <dl className="mt-4 space-y-2 tabular-nums">
            <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Contrato</dt>
                <dd className="font-semibold text-ink">{contrato}</dd>
            </div>
            <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                    Média BACEN {mNome(mes)}
                    {serie ? <span className="text-xs"> · SGS {serie}</span> : null}
                </dt>
                <dd className="font-semibold text-ink">{media}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-ink/20 pt-2">
                <dt className="text-muted-foreground">Contrato / média</dt>
                <dd className="subdisplay text-2xl text-ink">{num(razao)}x</dd>
            </div>
        </dl>
    </div>
);

/** Taxa média mensal ao longo do tempo, com a taxa do contrato e o mês da contratação. */
const Grafico = ({ a }: { a: Analise }) => {
    const serie = a.media.serieAm;
    const pts = serie ? historico(serie, a.entrada.mes) : [];
    if (pts.length < 2) return null;

    const W = 720;
    const H = 240;
    const L = 46;
    const R = 14;
    const T = 14;
    const B = 30;
    const ini = mIdx(pts[0].mes);
    const fim = mIdx(pts[pts.length - 1].mes);
    const ymax = Math.max(a.contratoAm, ...pts.map((p) => p.v)) * 1.15;
    const X = (ix: number) => L + ((ix - ini) / Math.max(1, fim - ini)) * (W - L - R);
    const Y = (v: number) => T + (1 - v / ymax) * (H - T - B);
    const kx = mIdx(a.media.mes);
    const anos: number[] = [];
    for (let ix = ini; ix <= fim; ix++) if (ix % 12 === 0) anos.push(ix);

    return (
        <figure className="border border-ink/25 bg-card p-4">
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Taxa média mensal do BACEN ao longo do tempo comparada à taxa do contrato">
                {[0, 1, 2, 3, 4].map((t) => {
                    const v = (ymax * t) / 4;
                    return (
                        <g key={t}>
                            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="hsl(var(--border))" />
                            <text x={L - 8} y={Y(v) + 4} fontSize="11" textAnchor="end" fill="hsl(var(--muted-foreground))">
                                {num(v, 1)}%
                            </text>
                        </g>
                    );
                })}
                {anos.map((ix) => (
                    <text key={ix} x={X(ix)} y={H - 8} fontSize="11" textAnchor="middle" fill="hsl(var(--muted-foreground))">
                        {Math.floor(ix / 12)}
                    </text>
                ))}
                <polyline
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    points={pts.map((p) => `${X(mIdx(p.mes)).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")}
                />
                <line x1={L} x2={W - R} y1={Y(a.contratoAm)} y2={Y(a.contratoAm)} stroke="hsl(var(--destructive))" strokeWidth="2" strokeDasharray="6 4" />
                <line x1={L} x2={W - R} y1={Y(a.media.am * LIMITE_ABUSIVO)} y2={Y(a.media.am * LIMITE_ABUSIVO)} stroke="hsl(var(--gold))" strokeWidth="1.5" strokeDasharray="2 4" />
                {kx >= ini && kx <= fim && (
                    <g>
                        <line x1={X(kx)} x2={X(kx)} y1={T} y2={H - B} stroke="hsl(var(--gold-deep))" strokeWidth="1.5" />
                        <circle cx={X(kx)} cy={Y(a.media.am)} r="5" fill="hsl(var(--gold-light))" stroke="hsl(var(--primary))" strokeWidth="2" />
                    </g>
                )}
            </svg>
            <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                    <span className="h-0.5 w-5 bg-ink" />
                    Média BACEN, % a.m. (SGS {serie})
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="h-0.5 w-5 border-t-2 border-dashed border-destructive" />
                    Taxa do contrato
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="h-0.5 w-5 border-t-2 border-dotted border-gold" />
                    {num(LIMITE_ABUSIVO, 1)}x a média do mês
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-0.5 bg-gold-deep" />
                    Contratação ({mNome(a.media.mes)})
                </span>
            </figcaption>
        </figure>
    );
};

const Linha = ({ rotulo, a, b, fmt }: { rotulo: string; a: number; b: number; fmt: (x: number) => string }) => {
    const d = a - b;
    return (
        <tr className="border-b border-ink/15 last:border-0">
            <th scope="row" className="py-2.5 pr-4 text-left font-medium text-ink">{rotulo}</th>
            <td className="py-2.5 pl-4 text-right">{fmt(a)}</td>
            <td className="py-2.5 pl-4 text-right">{fmt(b)}</td>
            <td className={cn("py-2.5 pl-4 text-right font-semibold", d > 0.004 ? "text-destructive" : "text-ink")}>
                {d > 0.004 ? "+" : ""}
                {fmt(d)}
            </td>
        </tr>
    );
};

const Resultado = ({ a, online }: { a: Analise; online: boolean }) => {
    const [copiado, setCopiado] = useState(false);
    const e = a.entrada;
    const texto = resumo(a);
    const pct = (x: number) => `${num(x)}%`;

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1800);
        } catch {
            /* sem permissão de área de transferência: o texto continua visível para copiar à mão */
        }
    };

    return (
        <div className="space-y-8" aria-live="polite">
            <header className="border-b border-ink/25 pb-6">
                <div className="flex flex-wrap items-center gap-3">
                    <Selo n={a.nivel} />
                    <span className="text-sm text-muted-foreground">
                        {e.mod.nome} ({e.mod.pessoa.toUpperCase()}) · contratado em {mNome(e.mes)}
                    </span>
                </div>
                <h2 className="subdisplay mt-4 text-[2rem] text-ink">
                    {a.nivel === "media" ? "Taxa dentro da média de mercado" : `Taxa ${num(a.razaoAm, 2)}x a média mensal`}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {a.manual
                        ? "Taxa média informada manualmente."
                        : `Fonte: BACEN/SGS, séries ${a.media.serieAm} (% a.m.) e ${a.media.serieAa} (% a.a.), ${mNome(a.media.mes)}. ${online ? "Consultado agora no Banco Central." : "BACEN indisponível: usados os dados guardados no site."}`}
                    {a.media.nota && <span className="mt-1 block font-medium text-ink">{a.media.nota}</span>}
                    {nivel(a.razaoAa) !== a.nivel && (
                        <span className="mt-1 block font-medium text-ink">
                            Na capitalização composta anual, a razão atinge {num(a.razaoAa, 2)}x da média anual.
                        </span>
                    )}
                    {a.custosEmbutidos && (
                        <span className="mt-1 block font-medium text-destructive">
                            Pelas parcelas, a taxa efetiva é {pct(a.taxaEfetiva)} a.m., maior que a informada ({pct(a.contratoAm)} a.m.): há custos embutidos.
                        </span>
                    )}
                </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
                <Comparacao titulo="Mensal" contrato={`${pct(a.contratoAm)} a.m.`} media={`${pct(a.media.am)} a.m.`} serie={a.media.serieAm} mes={a.media.mes} razao={a.razaoAm} />
                <Comparacao titulo="Anual" contrato={`${pct(a.contratoAa)} a.a.`} media={`${pct(a.media.aa)} a.a.`} serie={a.media.serieAa} mes={a.media.mes} razao={a.razaoAa} />
            </div>

            <dl className="grid border-y border-ink/25 tabular-nums sm:grid-cols-3 sm:divide-x sm:divide-ink/20">
                <div className="py-5 sm:pr-5">
                    <dt className="text-sm text-muted-foreground">Diferença no contrato todo</dt>
                    <dd className="subdisplay mt-1 text-[1.75rem] text-ink">{brl(a.diferenca)}</dd>
                </div>
                <div className="border-t border-ink/20 py-5 sm:border-t-0 sm:px-5">
                    <dt className="text-sm text-muted-foreground">Já pago a mais ({e.pagas} parcelas)</dt>
                    <dd className="subdisplay mt-1 text-[1.75rem] text-ink">{brl(a.pagoAMais)}</dd>
                </div>
                <div className="border-t border-ink/20 py-5 sm:border-t-0 sm:pl-5">
                    <dt className="text-sm text-muted-foreground">Em dobro (art. 42, CDC)</dt>
                    <dd className="subdisplay mt-1 text-[1.75rem] text-ink">{brl(a.pagoAMais * 2)}</dd>
                </div>
            </dl>

            <Grafico a={a} />

            <div className="overflow-x-auto border border-ink/25 bg-card px-5 py-2">
                <table className="w-full min-w-[34rem] text-sm tabular-nums">
                    <thead>
                        <tr className="border-b border-ink/25 text-xs text-muted-foreground">
                            <th className="py-2.5 text-left font-semibold">
                                <span className="sr-only">Item</span>
                            </th>
                            <th className="py-2.5 pl-4 text-right font-semibold">Contrato</th>
                            <th className="py-2.5 pl-4 text-right font-semibold">Na taxa média</th>
                            <th className="py-2.5 pl-4 text-right font-semibold">Diferença</th>
                        </tr>
                    </thead>
                    <tbody>
                        <Linha rotulo="Taxa mensal" a={a.contratoAm} b={a.media.am} fmt={pct} />
                        <Linha rotulo="Taxa anual" a={a.contratoAa} b={a.media.aa} fmt={pct} />
                        <Linha rotulo="Parcela" a={e.parcela} b={a.parcelaNaMedia} fmt={brl} />
                        <Linha rotulo="Total de juros" a={a.juros} b={a.jurosNaMedia} fmt={brl} />
                        {e.pagas > 0 && e.pagas < e.parcelas && (
                            <>
                                <Linha rotulo="Saldo no cronograma (original vs. média)" a={a.saldoHoje} b={a.saldoHojeNaMedia} fmt={brl} />
                                <Linha rotulo="Saldo recalculado (abatendo pagas)" a={a.saldoHoje} b={a.saldoRecalculado} fmt={brl} />
                            </>
                        )}
                        <Linha rotulo="Total a pagar" a={a.total} b={a.totalNaMedia} fmt={brl} />
                    </tbody>
                </table>
            </div>

            <section className="border border-ink/25 bg-card p-5">
                <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-ink">Resumo para a petição</h3>
                    <button
                        type="button"
                        onClick={copiar}
                        className="inline-flex min-h-10 items-center gap-2 border border-ink/40 px-4 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-paper"
                    >
                        {copiado ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                        {copiado ? "Copiado" : "Copiar"}
                    </button>
                </div>
                <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink/90">{texto}</pre>
            </section>

            <details className="group border border-ink/25 bg-card">
                <summary className="cursor-pointer px-5 py-4 font-semibold text-ink">Parcela por parcela (taxa efetiva {pct(a.taxaEfetiva)} a.m.)</summary>
                <div className="max-h-[26rem] overflow-auto border-t border-ink/25">
                    <TabelaParcelas a={a} />
                </div>
            </details>
        </div>
    );
};

const TabelaParcelas = ({ a }: { a: Analise }) => {
    const e = a.entrada;
    const i = a.taxaEfetiva / 100;
    const linhas: { q: number; j: number; am: number; s: number }[] = [];
    let s = e.valor;
    for (let q = 1; q <= e.parcelas; q++) {
        const j = s * i;
        const am = e.parcela - j;
        s = Math.max(0, s - am);
        linhas.push({ q, j, am, s });
    }
    return (
        <table className="w-full min-w-[40rem] text-sm tabular-nums">
            <thead className="sticky top-0 bg-secondary text-xs text-muted-foreground">
                <tr>
                    {["Nº", "Parcela", "Juros", "Amortização", "Saldo devedor", "Parcela na média"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-right font-semibold first:text-left">
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {linhas.map(({ q, j, am, s }) => (
                    <tr key={q} className={cn("border-t border-ink/10", q <= e.pagas && "text-muted-foreground")}>
                        <td className="px-4 py-2 text-left">
                            {q}
                            {q <= e.pagas && <span className="sr-only"> (paga)</span>}
                            {q <= e.pagas && <Check aria-hidden className="ml-1.5 inline size-3.5 text-gold-deep" />}
                        </td>
                        <td className="px-4 py-2 text-right">{brl(e.parcela)}</td>
                        <td className="px-4 py-2 text-right">{brl(j)}</td>
                        <td className="px-4 py-2 text-right">{brl(am)}</td>
                        <td className="px-4 py-2 text-right">{brl(s)}</td>
                        <td className="px-4 py-2 text-right">{brl(a.parcelaNaMedia)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

const CalculadoraAdvogado = () => {
    const reduce = useReducedMotion();
    const [pessoa, setPessoa] = useState<Pessoa>("pf");
    const [mod, setMod] = useState<Modalidade | null>(null);
    const [mes, setMes] = useState("");
    const [ano, setAno] = useState("");
    const [taxaM, setTaxaM] = useState("");
    const [taxaA, setTaxaA] = useState("");
    const [valorF, setValorF] = useState("");
    const [parcela, setParcela] = useState("");
    const [parcelas, setParcelas] = useState("");
    const [pagas, setPagas] = useState("");
    const [mediaM, setMediaM] = useState("");
    const [mediaA, setMediaA] = useState("");
    const [erro, setErro] = useState<string | null>(null);
    const [carregando, setCarregando] = useState(false);
    const [res, setRes] = useState<{ a: Analise; online: boolean } | null>(null);
    const topoRes = useRef<HTMLDivElement>(null);

    const calcular = async (ev: FormEvent) => {
        ev.preventDefault();
        const entrada = {
            mod: mod ?? undefined,
            mes: mes && ano ? `${ano}-${mes}` : "",
            valor: lerMoeda(valorF),
            parcela: lerMoeda(parcela),
            parcelas: parseInt(parcelas, 10) || 0,
            pagas: parseInt(pagas || "0", 10),
            taxaMensal: lerDecimal(taxaM),
            taxaAnual: lerDecimal(taxaA),
            mediaMensal: lerDecimal(mediaM),
            mediaAnual: lerDecimal(mediaA),
        };
        const msg = validar(entrada);
        if (msg) return setErro(msg);
        for (const [txt, v, nome] of [
            [taxaM, entrada.taxaMensal, "taxa mensal do contrato"],
            [taxaA, entrada.taxaAnual, "taxa anual do contrato"],
            [mediaM, entrada.mediaMensal, "taxa média mensal"],
            [mediaA, entrada.mediaAnual, "taxa média anual"],
        ] as const)
            if (txt && !(v > 0)) return setErro(`A ${nome} não é um número válido.`);

        setErro(null);
        setCarregando(true);
        const online = await consultarBacen(entrada.mod!, entrada.mes);
        const a = analisar({ ...entrada, mod: entrada.mod! });
        setCarregando(false);
        if (!a) return setErro("Sem taxa média para esse mês. Informe a média manualmente.");
        setRes({ a, online });
        if (window.matchMedia("(max-width: 1023px)").matches)
            requestAnimationFrame(() =>
                topoRes.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }),
            );
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="bg-ink text-paper">
                <div className="container flex h-16 items-center justify-between gap-6">
                    <Link to="/" aria-label="Ian Granja Advogados, página inicial">
                        <img src={logo} alt="Ian Granja Advogados" width={768} height={132} className="h-8 w-auto" />
                    </Link>
                    <p className="text-sm text-paper/75">Calculadora revisional · uso interno</p>
                </div>
            </header>

            <main className="container grid gap-x-12 gap-y-10 py-10 lg:grid-cols-12 lg:py-14">
                <form onSubmit={calcular} noValidate className="space-y-7 lg:col-span-5 xl:col-span-4">
                    <div>
                        <h1 className="subdisplay text-[1.75rem] text-ink">Juros x média do BACEN</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Mensal compara com a média mensal; anual com a média anual. Taxas consultadas no SGS no momento do cálculo.
                        </p>
                    </div>

                    <fieldset className="space-y-3">
                        <legend className={labelClass}>Contratante</legend>
                        <PessoaToggle
                            value={pessoa}
                            onChange={(p) => {
                                setPessoa(p);
                                setMod(null);
                            }}
                        />
                    </fieldset>

                    <fieldset className="space-y-2">
                        <legend className={labelClass}>Modalidade</legend>
                        <ModalidadeSelect id="adv-tipo" pessoa={pessoa} value={mod?.id ?? null} onChange={setMod} tecnico />
                    </fieldset>

                    <fieldset>
                        <legend className={labelClass}>Data da contratação</legend>
                        <MesAno idPrefix="adv" mes={mes} ano={ano} onMes={setMes} onAno={setAno} />
                    </fieldset>

                    <div className="grid grid-cols-2 gap-x-5 gap-y-6">
                        <Campo id="adv-tm" label="Taxa do contrato" tipo="taxa" sufixo="% a.m." value={taxaM} onChange={setTaxaM} placeholder="2,99" />
                        <Campo id="adv-ta" label="Taxa do contrato" tipo="taxa" sufixo="% a.a." value={taxaA} onChange={setTaxaA} placeholder="42,48" />
                        <Campo id="adv-valor" label="Valor financiado" tipo="moeda" value={valorF} onChange={setValorF} placeholder="0,00" />
                        <Campo id="adv-parcela" label="Parcela" tipo="moeda" value={parcela} onChange={setParcela} placeholder="0,00" />
                        <Campo id="adv-n" label="Nº de parcelas" tipo="inteiro" value={parcelas} onChange={setParcelas} placeholder="48" />
                        <Campo id="adv-pagas" label="Parcelas pagas" tipo="inteiro" value={pagas} onChange={setPagas} placeholder="0" />
                    </div>
                    <p className="text-sm text-muted-foreground">Taxas em branco: usa a taxa efetiva calculada pelas parcelas.</p>

                    <details className="border-y border-ink/25">
                        <summary className="cursor-pointer py-3 text-sm font-semibold text-ink">Substituir a taxa média do BACEN</summary>
                        <div className="grid grid-cols-2 gap-5 pb-5">
                            <Campo id="adv-mm" label="Média" tipo="taxa" sufixo="% a.m." value={mediaM} onChange={setMediaM} />
                            <Campo id="adv-ma" label="Média" tipo="taxa" sufixo="% a.a." value={mediaA} onChange={setMediaA} />
                        </div>
                    </details>

                    {erro && (
                        <p role="alert" className="border-t-2 border-destructive pt-3 text-sm font-medium text-destructive">
                            {erro}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={carregando}
                        className="inline-flex min-h-12 w-full items-center justify-center gap-3 bg-ink px-6 font-semibold text-paper transition-colors duration-200 hover:bg-ink-soft disabled:cursor-wait disabled:opacity-70"
                    >
                        {carregando && <Loader2 aria-hidden className="size-5 animate-spin" />}
                        {carregando ? "Consultando o BACEN" : "Calcular"}
                    </button>
                </form>

                <div ref={topoRes} className="scroll-mt-6 lg:col-span-7 xl:col-span-8">
                    {res ? (
                        <Resultado a={res.a} online={res.online} />
                    ) : (
                        <div className="grid items-center gap-8 bg-ink p-8 text-paper sm:grid-cols-[minmax(0,1fr)_14rem] lg:mt-16">
                            <div>
                                <p className="subdisplay text-2xl">O resultado aparece aqui.</p>
                                <p className="mt-3 max-w-[56ch] leading-relaxed text-paper/80">
                                    Escolha a modalidade e a data da contratação, informe as taxas do contrato (se houver) e os valores das
                                    parcelas. Antes de nov/2025, empréstimo com garantia real usa a série de aquisição de veículos; sem
                                    garantia usa crédito pessoal não consignado total.
                                </p>
                            </div>
                            <HeroArt variant="calculo" className="max-w-[14rem]" />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default CalculadoraAdvogado;
