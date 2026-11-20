import { LIMITE_ABUSIVO, brl, mIdx, mNome, num } from "@/lib/juros";
import type { ResultadoContrato, ResultadoProcessoRevisional } from "@/lib/juros/revisional-pro";
import {
    composicaoCustoContrato,
    decomporProveitoGlobal,
    historicoBacenContrato,
    serieSaldoDevedorContrato,
} from "@/lib/juros/graficos-dados";
import { cn } from "@/lib/utils";

function brlCurto(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `R$ ${num(v / 1_000_000, 1)}M`;
    if (Math.abs(v) >= 1_000) return `R$ ${num(v / 1_000, 0)} mil`;
    return brl(v);
}

/** Curva oficial de 36 meses do BACEN/SGS, sempre visível mesmo quando o paradigma é Olinda BCB ou Manual. */
export const GraficoSerieBacen = ({ rc }: { rc: ResultadoContrato }) => {
    const dados = historicoBacenContrato(rc);
    if (!dados) return null;

    const a = rc.analise;
    const { pontos: pts, serieCodigo, mesReferencia, usandoParadigmaExterno, taxaParadigmaAm, limiteAbusoAm } = dados;

    const W = 720;
    const H = 246;
    const L = 52;
    const R = 16;
    const T = 16;
    const B = 32;
    const ini = mIdx(pts[0].mes);
    const fim = mIdx(pts[pts.length - 1].mes);
    const ymax = Math.max(a.contratoAm, limiteAbusoAm, taxaParadigmaAm, ...pts.map((p) => p.v)) * 1.15;
    const X = (ix: number) => L + ((ix - ini) / Math.max(1, fim - ini)) * (W - L - R);
    const Y = (v: number) => T + (1 - v / Math.max(0.01, ymax)) * (H - T - B);
    const kx = mIdx(mesReferencia);

    const anos: number[] = [];
    for (let ix = ini; ix <= fim; ix++) {
        if (ix % 12 === 0) anos.push(ix);
    }

    return (
        <figure className="border border-ink/25 bg-card p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 pb-2.5">
                <div>
                    <h3 className="sys-section text-ink">
                        Histórico da taxa média do Banco Central (SGS {serieCodigo})
                    </h3>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                    Mês de referência: <strong className="text-ink">{mNome(mesReferencia)}</strong> (
                    {num(dados.mediaSgsAm)}% a.m.)
                </span>
            </div>

            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="block h-auto w-full"
                role="img"
                aria-label="Taxa média mensal do BACEN ao longo do tempo comparada à taxa do contrato"
            >
                {[0, 1, 2, 3, 4].map((t) => {
                    const v = (ymax * t) / 4;
                    return (
                        <g key={t}>
                            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="hsl(var(--border))" />
                            <text
                                x={L - 8}
                                y={Y(v) + 4}
                                fontSize="11"
                                textAnchor="end"
                                fill="hsl(var(--muted-foreground))"
                            >
                                {num(v, 1)}%
                            </text>
                        </g>
                    );
                })}
                {anos.map((ix) => (
                    <text
                        key={ix}
                        x={X(ix)}
                        y={H - 8}
                        fontSize="11"
                        textAnchor="middle"
                        fill="hsl(var(--muted-foreground))"
                    >
                        {Math.floor(ix / 12)}
                    </text>
                ))}

                {/* Curva da média de mercado BACEN/SGS */}
                <polyline
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    points={pts.map((p) => `${X(mIdx(p.mes)).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")}
                />

                {/* Taxa paradigma externa (Olinda BCB ou Manual), quando diferente da curva SGS */}
                {usandoParadigmaExterno && (
                    <line
                        x1={L}
                        x2={W - R}
                        y1={Y(taxaParadigmaAm)}
                        y2={Y(taxaParadigmaAm)}
                        stroke="hsl(var(--gold-deep))"
                        strokeWidth="2"
                    />
                )}

                {/* Limite de referência de abuso (1,5x o paradigma) */}
                <line
                    x1={L}
                    x2={W - R}
                    y1={Y(limiteAbusoAm)}
                    y2={Y(limiteAbusoAm)}
                    stroke="hsl(var(--gold))"
                    strokeWidth="1.5"
                    strokeDasharray="3 4"
                />

                {/* Taxa cobrada no contrato */}
                <line
                    x1={L}
                    x2={W - R}
                    y1={Y(a.contratoAm)}
                    y2={Y(a.contratoAm)}
                    stroke="hsl(var(--destructive))"
                    strokeWidth="2.2"
                    strokeDasharray="7 4"
                />

                {kx >= ini && kx <= fim && (
                    <g>
                        <line
                            x1={X(kx)}
                            x2={X(kx)}
                            y1={T}
                            y2={H - B}
                            stroke="hsl(var(--gold-deep))"
                            strokeWidth="1.2"
                            strokeDasharray="2 2"
                        />
                        <circle
                            cx={X(kx)}
                            cy={Y(dados.mediaSgsAm)}
                            r="5"
                            fill="hsl(var(--gold-light))"
                            stroke="hsl(var(--primary))"
                            strokeWidth="2"
                        />
                    </g>
                )}
            </svg>

            <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                    <span className="h-0.5 w-5 bg-ink" />
                    Média BACEN · SGS {serieCodigo}
                </span>
                {usandoParadigmaExterno && (
                    <span className="inline-flex items-center gap-2">
                        <span className="h-0.5 w-5 bg-gold-deep" />
                        Paradigma aplicado ({num(taxaParadigmaAm)}% a.m.)
                    </span>
                )}
                <span className="inline-flex items-center gap-2">
                    <span className="h-0.5 w-5 border-t-2 border-dashed border-destructive" />
                    Contrato ({num(a.contratoAm)}% a.m.)
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="h-0.5 w-5 border-t-2 border-dotted border-gold" />
                    {num(LIMITE_ABUSIVO, 1)}x o paradigma ({num(limiteAbusoAm)}% a.m.)
                </span>
            </figcaption>
        </figure>
    );
};

const GraficoReguaTaxas = ({ rc }: { rc: ResultadoContrato }) => {
    const a = rc.analise;
    const dadosBacen = historicoBacenContrato(rc);
    const limiteAm = rc.taxaRevisionalAm * LIMITE_ABUSIVO;
    const maxTaxa = Math.max(a.contratoAm, limiteAm, rc.taxaRevisionalAm, dadosBacen?.mediaSgsAm ?? 0) * 1.12;
    const pct = (v: number) => `${Math.min(100, Math.max(2, (v / Math.max(0.01, maxTaxa)) * 100)).toFixed(1)}%`;
    const posLimite = Math.min(98, (limiteAm / Math.max(0.01, maxTaxa)) * 100);

    const barras: Array<{
        rotulo: string;
        detalhe: string;
        valorAm: number;
        corBarra: string;
        destaque?: boolean;
    }> = [
        {
            rotulo: "Taxa do contrato",
            detalhe: `${num(a.contratoAa)}% a.a.`,
            valorAm: a.contratoAm,
            corBarra:
                rc.nivel === "abuso"
                    ? "bg-destructive"
                    : rc.nivel === "acima"
                      ? "bg-gold"
                      : "bg-ink",
            destaque: true,
        },
        {
            rotulo:
                rc.contrato.fonteTaxaRevisional === "banco_olinda"
                    ? "Taxa do banco no BCB Olinda"
                    : rc.contrato.fonteTaxaRevisional === "manual"
                      ? "Taxa paradigma manual"
                      : "Taxa média de mercado (BACEN)",
            detalhe: `${num(rc.taxaRevisionalAa)}% a.a.`,
            valorAm: rc.taxaRevisionalAm,
            corBarra: "bg-ink",
        },
    ];

    if (dadosBacen && rc.contrato.fonteTaxaRevisional !== "media_sgs") {
        barras.push({
            rotulo: `Média geral BACEN (${mNome(dadosBacen.mesReferencia)})`,
            detalhe: `SGS ${dadosBacen.serieCodigo}`,
            valorAm: dadosBacen.mediaSgsAm,
            corBarra: "bg-ink/45",
        });
    }

    return (
        <figure className="border border-ink/25 bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 pb-2.5">
                <div>
                    <h3 className="sys-section text-ink">Régua de abusividade da taxa mensal</h3>
                </div>
                <span className="text-xs font-semibold tabular-nums text-ink">
                    Razão: {num(a.razaoAm, 2)}x o paradigma
                </span>
            </div>

            <div className="relative mt-5 space-y-4">
                {/* Linha guia vertical em 1,5x */}
                <div
                    aria-hidden
                    style={{ left: `${posLimite.toFixed(1)}%` }}
                    className="pointer-events-none absolute bottom-0 top-0 z-10 border-l-2 border-dashed border-gold-deep/75"
                >
                    <span className="absolute -top-3.5 right-1 whitespace-nowrap bg-gold-light px-1.5 py-0.5 text-[10px] font-bold text-ink">
                        1,5x ({num(limiteAm)}%)
                    </span>
                </div>

                {barras.map((b) => (
                    <div key={b.rotulo} className="space-y-1.5 pt-2">
                        <div className="flex items-baseline justify-between gap-3 text-xs tabular-nums">
                            <span className={cn("text-ink", b.destaque ? "font-bold" : "font-medium")}>
                                {b.rotulo}{" "}
                                <span className="font-normal text-muted-foreground">({b.detalhe})</span>
                            </span>
                            <span className="font-bold text-ink">{num(b.valorAm)}% a.m.</span>
                        </div>
                        <div className="h-5 w-full bg-secondary">
                            <div
                                style={{ width: pct(b.valorAm) }}
                                className={cn("h-full transition-all duration-300", b.corBarra)}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <figcaption className="mt-4 border-t border-ink/10 pt-2.5 text-xs text-muted-foreground">
                A linha tracejada dourada marca <strong>1,5x a taxa paradigma</strong> ({num(limiteAm)}% a.m.), patamar
                usualmente adotado na jurisprudência bancária como forte indício de onerosidade excessiva.
            </figcaption>
        </figure>
    );
};

const GraficoEvolucaoSaldo = ({ rc }: { rc: ResultadoContrato }) => {
    const serie = serieSaldoDevedorContrato(rc);
    const { pontos, parcelaQuitacaoAntecipada, saldoBancoHoje, saldoRecalculadoHoje, reducaoDividaHoje } = serie;
    const e = rc.analise.entrada;

    if (pontos.length < 2) return null;

    const W = 720;
    const H = 258;
    const L = 70;
    const R = 18;
    const T = 18;
    const B = 34;

    const nMax = Math.max(1, e.parcelas);
    const yMax = Math.max(e.valor, ...pontos.map((p) => p.saldoBanco)) * 1.08;
    const X = (k: number) => L + (k / nMax) * (W - L - R);
    const Y = (v: number) => T + (1 - v / Math.max(1, yMax)) * (H - T - B);

    const ticksX: number[] = [];
    const stepX = Math.max(1, Math.round(nMax / 6));
    for (let k = 0; k <= nMax; k += stepX) ticksX.push(k);
    if (ticksX[ticksX.length - 1] !== nMax) ticksX.push(nMax);

    return (
        <figure className="border border-ink/25 bg-card p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 pb-2.5">
                <div>
                    <h3 className="sys-section text-ink">
                        Curva de evolução do saldo devedor ({e.parcelas} parcelas)
                    </h3>
                </div>
                {e.pagas > 0 && e.pagas < e.parcelas && reducaoDividaHoje > 0 && (
                    <span className="bg-gold-light/50 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">
                        Queda imediata na {e.pagas}ª parcela: -{brl(reducaoDividaHoje)}
                    </span>
                )}
            </div>

            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="block h-auto w-full"
                role="img"
                aria-label="Evolução do saldo devedor no contrato comparado ao saldo recalculado"
            >
                {[0, 1, 2, 3, 4].map((t) => {
                    const v = (yMax * t) / 4;
                    return (
                        <g key={t}>
                            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="hsl(var(--border))" />
                            <text
                                x={L - 8}
                                y={Y(v) + 4}
                                fontSize="10.5"
                                textAnchor="end"
                                fill="hsl(var(--muted-foreground))"
                            >
                                {brlCurto(v)}
                            </text>
                        </g>
                    );
                })}

                {ticksX.map((k) => (
                    <text
                        key={k}
                        x={X(k)}
                        y={H - 9}
                        fontSize="10.5"
                        textAnchor="middle"
                        fill="hsl(var(--muted-foreground))"
                    >
                        {k}ª
                    </text>
                ))}

                {/* Área sombreada entre o saldo do banco e o saldo recalculado */}
                <polygon
                    fill="hsl(var(--gold-light) / 0.28)"
                    points={[
                        ...pontos.map((p) => `${X(p.parcela).toFixed(1)},${Y(p.saldoBanco).toFixed(1)}`),
                        ...[...pontos]
                            .reverse()
                            .map((p) => `${X(p.parcela).toFixed(1)},${Y(p.saldoAbatendoPagas).toFixed(1)}`),
                    ].join(" ")}
                />

                {/* Cronograma teórico com parcela justa */}
                <polyline
                    fill="none"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth="1.5"
                    strokeDasharray="2 3"
                    points={pontos
                        .map((p) => `${X(p.parcela).toFixed(1)},${Y(p.saldoCronogramaParadigma).toFixed(1)}`)
                        .join(" ")}
                />

                {/* Saldo cobrado pelo banco: é o dado real do contrato, então linha sólida */}
                <polyline
                    fill="none"
                    stroke="hsl(var(--destructive))"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={pontos.map((p) => `${X(p.parcela).toFixed(1)},${Y(p.saldoBanco).toFixed(1)}`).join(" ")}
                />

                {/* Saldo recalculado abatendo as parcelas pagas */}
                <polyline
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={pontos
                        .map((p) => `${X(p.parcela).toFixed(1)},${Y(p.saldoAbatendoPagas).toFixed(1)}`)
                        .join(" ")}
                />

                {/* Marcador da parcela atual paga */}
                {e.pagas > 0 && e.pagas < e.parcelas && (
                    <g>
                        <line
                            x1={X(e.pagas)}
                            x2={X(e.pagas)}
                            y1={T}
                            y2={H - B}
                            stroke="hsl(var(--gold-deep))"
                            strokeWidth="1.5"
                        />
                        <circle
                            cx={X(e.pagas)}
                            cy={Y(saldoBancoHoje)}
                            r="4.5"
                            fill="hsl(var(--destructive))"
                            stroke="hsl(var(--card))"
                            strokeWidth="2"
                        />
                        <circle
                            cx={X(e.pagas)}
                            cy={Y(saldoRecalculadoHoje)}
                            r="5"
                            fill="hsl(var(--gold-light))"
                            stroke="hsl(var(--primary))"
                            strokeWidth="2"
                        />
                    </g>
                )}

                {/* Ponto de quitação antecipada */}
                {parcelaQuitacaoAntecipada !== null && (
                    <circle
                        cx={X(parcelaQuitacaoAntecipada)}
                        cy={Y(0)}
                        r="5"
                        fill="hsl(var(--gold))"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                    />
                )}
            </svg>

            <figcaption className="mt-3 space-y-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                    <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="h-0.5 w-5 rounded-full bg-destructive" />
                        Saldo exigido pelo banco (contrato)
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="h-0.5 w-5 rounded-full bg-ink" />
                        Saldo recalculado (abatendo parcelas de {brl(e.parcela)})
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="h-0.5 w-5 border-t-2 border-dotted border-muted-foreground" />
                        Projeção com parcela revisada ({brl(rc.analise.parcelaNaMedia)})
                    </span>
                </div>

                {parcelaQuitacaoAntecipada !== null && parcelaQuitacaoAntecipada < e.parcelas && (
                    <p className="border border-gold/40 bg-gold-light/20 px-3 py-2 font-medium text-ink">
                        Aplicando a taxa paradigma sobre o valor de parcela cobrado ({brl(e.parcela)}), o contrato
                        zera o saldo devedor na <strong>{parcelaQuitacaoAntecipada}ª parcela</strong> (
                        {e.parcelas - parcelaQuitacaoAntecipada}{" "}
                        {e.parcelas - parcelaQuitacaoAntecipada === 1 ? "mês" : "meses"} antes do final).
                    </p>
                )}
            </figcaption>
        </figure>
    );
};

const GraficoComposicaoCusto = ({
    rc,
    resultado,
}: {
    rc: ResultadoContrato;
    resultado: ResultadoProcessoRevisional;
}) => {
    const comp = composicaoCustoContrato(rc);
    const fatias = decomporProveitoGlobal(resultado);
    const somaFatias = fatias.reduce((acc, f) => acc + f.valor, 0);
    const maxTotal = Math.max(1, comp.totalContrato, comp.totalParadigma);

    const pCapBanco = (comp.principal / maxTotal) * 100;
    const pJurBanco = (comp.jurosContrato / maxTotal) * 100;
    const pCapJusto = (comp.principal / maxTotal) * 100;
    const pJurJusto = (comp.jurosParadigma / maxTotal) * 100;

    return (
        <figure className="border border-ink/25 bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 pb-2.5">
                <div>
                    <h3 className="sys-section text-ink">Capital financiado vs. juros totais do contrato</h3>
                </div>
                <span className="text-xs font-semibold tabular-nums text-destructive">
                    Excesso bruto em juros: {brl(comp.excessoJurosNominal)}
                </span>
            </div>

            <div className="mt-4 space-y-4 tabular-nums">
                {/* Barra 1: Contrato cobrado pelo banco */}
                <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-xs">
                        <span className="font-bold text-ink">Total cobrado no contrato</span>
                        <span className="font-bold text-ink">{brl(comp.totalContrato)}</span>
                    </div>
                    <div className="flex h-6 w-full overflow-hidden bg-secondary">
                        <div
                            style={{ width: `${pCapBanco.toFixed(2)}%` }}
                            title={`Principal: ${brl(comp.principal)}`}
                            className="h-full bg-ink"
                        />
                        <div
                            style={{ width: `${pJurBanco.toFixed(2)}%` }}
                            title={`Juros cobrados: ${brl(comp.jurosContrato)}`}
                            className="h-full bg-destructive"
                        />
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>Capital: {brl(comp.principal)}</span>
                        <span className="font-medium text-destructive">
                            Juros cobrados: {brl(comp.jurosContrato)} (
                            {num((comp.jurosContrato / Math.max(1, comp.totalContrato)) * 100, 0)}% do total)
                        </span>
                    </div>
                </div>

                {/* Barra 2: Contrato recalculado na taxa paradigma */}
                <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-ink">Total recalculado na taxa paradigma</span>
                        <span className="font-bold text-ink">{brl(comp.totalParadigma)}</span>
                    </div>
                    <div className="flex h-6 w-full overflow-hidden bg-secondary">
                        <div
                            style={{ width: `${pCapJusto.toFixed(2)}%` }}
                            title={`Principal: ${brl(comp.principal)}`}
                            className="h-full bg-ink"
                        />
                        <div
                            style={{ width: `${pJurJusto.toFixed(2)}%` }}
                            title={`Juros na taxa paradigma: ${brl(comp.jurosParadigma)}`}
                            className="h-full bg-gold"
                        />
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>Capital: {brl(comp.principal)}</span>
                        <span>
                            Juros na taxa justa: {brl(comp.jurosParadigma)} (
                            {num((comp.jurosParadigma / Math.max(1, comp.totalParadigma)) * 100, 0)}% do total)
                        </span>
                    </div>
                </div>
            </div>

            {/* Composição do Proveito Econômico Global da Ação */}
            {somaFatias > 0 && (
                <div className="mt-6 border-t border-ink/15 pt-4">
                    <div className="flex items-baseline justify-between text-xs tabular-nums">
                        <span className="font-semibold text-ink">
                            Origem do proveito econômico da ação
                        </span>
                        <span className="font-bold text-ink">{brl(resultado.resumo.valorTotalAcao)}</span>
                    </div>

                    <div className="mt-2 flex h-4 w-full overflow-hidden bg-secondary">
                        {fatias.map((f) => (
                            <div
                                key={f.id}
                                style={{
                                    width: `${((f.valor / somaFatias) * 100).toFixed(2)}%`,
                                    backgroundColor: f.corHex,
                                }}
                                title={`${f.rotulo}: ${brl(f.valor)}`}
                                className="h-full border-r border-card last:border-r-0"
                            />
                        ))}
                    </div>

                    <dl className="mt-3 grid gap-2 text-xs tabular-nums sm:grid-cols-2">
                        {fatias.map((f) => (
                            <div key={f.id} className="flex items-center justify-between gap-2 border-b border-ink/10 pb-1">
                                <dt className="inline-flex items-center gap-2 text-muted-foreground">
                                    <span
                                        aria-hidden
                                        style={{ backgroundColor: f.corHex }}
                                        className="inline-block size-2.5 shrink-0"
                                    />
                                    <span>{f.rotulo}</span>
                                </dt>
                                <dd className="font-semibold text-ink">{brl(f.valor)}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}
        </figure>
    );
};

export const PainelGraficosCaso = ({
    rc,
    resultado,
}: {
    rc: ResultadoContrato;
    resultado: ResultadoProcessoRevisional;
}) => (
    <div className="space-y-6">
        <GraficoReguaTaxas rc={rc} />
        <GraficoEvolucaoSaldo rc={rc} />
        <GraficoComposicaoCusto rc={rc} resultado={resultado} />
        <GraficoSerieBacen rc={rc} />
    </div>
);
