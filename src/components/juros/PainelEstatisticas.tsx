import { useMemo, useState } from "react";
import { ArrowUpRight, Calculator, RefreshCw } from "lucide-react";
import { brl, num } from "@/lib/juros";
import { agregarEstatisticasCarteira } from "@/lib/juros/graficos-dados";
import type { CalculoSalvo, Categoria } from "@/lib/revisional-db";
import { cn } from "@/lib/utils";

interface PainelEstatisticasProps {
    calculos: CalculoSalvo[];
    categorias: Categoria[];
    carregando: boolean;
    onRecarregar: () => void;
    onIrCalculadora: () => void;
    onAbrirHistoricoCategoria: (categoriaId: string) => void;
}

const COR_BARRA_CATEGORIA: Record<string, string> = {
    navy: "bg-ink",
    gold: "bg-gold",
    crimson: "bg-destructive",
    emerald: "bg-[#126A35]",
    slate: "bg-[#475273]",
    amber: "bg-[#9A6700]",
};

export const PainelEstatisticas = ({
    calculos,
    categorias,
    carregando,
    onRecarregar,
    onIrCalculadora,
    onAbrirHistoricoCategoria,
}: PainelEstatisticasProps) => {
    const [filtroCat, setFiltroCat] = useState<string>("todas");

    const calculosRecorte = useMemo(() => {
        if (filtroCat === "todas") return calculos;
        if (filtroCat === "sem") {
            const idsValidos = new Set(categorias.map((c) => c.id));
            return calculos.filter((c) => !c.categoria_id || !idsValidos.has(c.categoria_id));
        }
        return calculos.filter((c) => c.categoria_id === filtroCat);
    }, [calculos, categorias, filtroCat]);

    const statsGeral = useMemo(
        () => agregarEstatisticasCarteira(calculos, categorias),
        [calculos, categorias],
    );
    const stats = useMemo(
        () => agregarEstatisticasCarteira(calculosRecorte, categorias),
        [calculosRecorte, categorias],
    );

    if (calculos.length === 0) {
        return (
            <div className="sheet-on-paper p-8 text-center sm:p-12">
                <p className="rubric text-gold-deep">Painel analítico</p>
                <h1 className="subdisplay mt-2 text-2xl text-ink sm:text-3xl">
                    Salve cálculos para visualizar os gráficos da carteira
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Assim que os casos forem salvos no histórico, este painel consolida automaticamente o volume
                    financeiro por categoria, ranking de bancos demandados, modalidades e grau de abusividade.
                </p>
                <button
                    type="button"
                    onClick={onIrCalculadora}
                    className="mt-6 inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-soft"
                >
                    <Calculator className="size-4" />
                    Fazer novo cálculo
                </button>
            </div>
        );
    }

    const maxCatValor = Math.max(1, ...statsGeral.porCategoria.map((c) => c.valorTotal));
    const maxBancoValor = Math.max(1, ...stats.porBanco.map((b) => b.valorTotal));
    const maxModValor = Math.max(1, ...stats.porModalidade.map((m) => m.valorTotal));
    const totalNiveis = Math.max(1, stats.totalCasos);

    return (
        <div className="space-y-8">
            {/* Cabeçalho e filtro rápido de carteira */}
            <div className="sheet-on-paper p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="rubric text-gold-deep">Visão estratégica do escritório</p>
                        <h1 className="subdisplay mt-1 text-2xl text-ink sm:text-3xl">
                            Painel gráfico da carteira revisional
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Indicadores consolidados dos {calculos.length}{" "}
                            {calculos.length === 1 ? "caso salvo" : "casos salvos"} no banco do escritório.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onRecarregar}
                        disabled={carregando}
                        className="inline-flex h-10 items-center gap-2 border border-ink/30 px-3.5 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50"
                    >
                        <RefreshCw className={cn("size-3.5", carregando && "animate-spin")} />
                        Atualizar dados
                    </button>
                </div>

                {/* Filtro rápido por categoria */}
                <div className="mt-5 flex flex-wrap gap-2 border-t border-ink/15 pt-4">
                    <button
                        type="button"
                        onClick={() => setFiltroCat("todas")}
                        className={cn(
                            "inline-flex h-8 items-center border px-3 text-xs font-semibold transition-colors",
                            filtroCat === "todas"
                                ? "border-ink bg-ink text-paper"
                                : "border-ink/25 text-ink hover:bg-ink/5",
                        )}
                    >
                        Toda a carteira ({calculos.length})
                    </button>
                    {statsGeral.porCategoria
                        .filter((c) => c.casos > 0)
                        .map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setFiltroCat(c.id)}
                                className={cn(
                                    "inline-flex h-8 items-center border px-3 text-xs font-semibold transition-colors",
                                    filtroCat === c.id
                                        ? "border-ink bg-ink text-paper"
                                        : "border-ink/25 text-ink hover:bg-ink/5",
                                )}
                            >
                                {c.nome} ({c.casos})
                            </button>
                        ))}
                </div>
            </div>

            {/* 4 KPIs Executivos */}
            <dl className="grid border-2 border-ink bg-card tabular-nums sm:grid-cols-2 lg:grid-cols-4 sm:divide-x sm:divide-ink/20">
                <div className="border-b border-ink/20 px-5 py-5 lg:border-b-0">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Proveito econômico total
                    </dt>
                    <dd className="subdisplay mt-2 text-2xl text-ink">{brl(stats.proveitoTotal)}</dd>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Em {stats.totalCasos} {stats.totalCasos === 1 ? "caso" : "casos"} no recorte
                    </p>
                </div>

                <div className="border-b border-ink/20 px-5 py-5 lg:border-b-0">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Pago a mais + tarifas
                    </dt>
                    <dd className="subdisplay mt-2 text-2xl text-ink">{brl(stats.pagoAMaisETarifasTotal)}</dd>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Capital financiado: {brl(stats.valorFinanciadoTotal)}
                    </p>
                </div>

                <div className="border-b border-ink/20 px-5 py-5 sm:border-b-0">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Indício de abuso (≥ 1,5x)
                    </dt>
                    <dd className="subdisplay mt-2 text-2xl text-destructive">
                        {num(stats.percentualAbuso, 0)}%{" "}
                        <span className="text-base font-semibold text-ink">
                            ({stats.qtdPorNivel.abuso}/{stats.totalCasos})
                        </span>
                    </dd>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Razão média da carteira: <strong className="text-ink">{num(stats.razaoMediaGeral, 2)}x</strong>
                    </p>
                </div>

                <div className="px-5 py-5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Ticket médio da ação
                    </dt>
                    <dd className="subdisplay mt-2 text-2xl text-ink">{brl(stats.ticketMedio)}</dd>
                    <p className="mt-1 text-xs text-muted-foreground">Média de proveito por cliente</p>
                </div>
            </dl>

            {/* Grade de gráficos analíticos */}
            <div className="grid gap-7 lg:grid-cols-2">
                {/* Gráfico 1: Pipeline por Categoria */}
                <section className="border border-ink/25 bg-card p-6">
                    <div className="flex items-baseline justify-between gap-3 border-b border-ink/15 pb-3">
                        <div>
                            <p className="rubric text-gold-deep">Pipeline do escritório</p>
                            <h2 className="subdisplay mt-1 text-xl text-ink">Volume financeiro por categoria</h2>
                        </div>
                        <span className="text-xs text-muted-foreground">Clique para filtrar histórico</span>
                    </div>

                    <div className="mt-5 space-y-4 tabular-nums">
                        {statsGeral.porCategoria.map((cat) => {
                            const largura =
                                cat.valorTotal > 0 ? Math.max(3, (cat.valorTotal / maxCatValor) * 100) : 0;
                            const corBarra = COR_BARRA_CATEGORIA[cat.cor] ?? "bg-ink";
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => onAbrirHistoricoCategoria(cat.id)}
                                    className="group block w-full text-left"
                                >
                                    <div className="flex items-baseline justify-between gap-3 text-xs">
                                        <span className="inline-flex items-center gap-1.5 font-semibold text-ink group-hover:underline">
                                            {cat.nome}
                                            <span className="font-normal text-muted-foreground">
                                                ({cat.casos} {cat.casos === 1 ? "caso" : "casos"})
                                            </span>
                                            <ArrowUpRight className="size-3 text-ink/45 transition-transform group-hover:translate-x-0.5" />
                                        </span>
                                        <span className="font-bold text-ink">{brl(cat.valorTotal)}</span>
                                    </div>
                                    <div className="mt-1.5 h-4 w-full bg-secondary">
                                        {largura > 0 && (
                                            <div
                                                style={{ width: `${largura.toFixed(1)}%` }}
                                                className={cn("h-full transition-all duration-300", corBarra)}
                                            />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Gráfico 2: Grau de Abusividade */}
                <section className="border border-ink/25 bg-card p-6">
                    <div className="border-b border-ink/15 pb-3">
                        <p className="rubric text-gold-deep">Qualificação técnica</p>
                        <h2 className="subdisplay mt-1 text-xl text-ink">Distribuição por grau de abusividade</h2>
                    </div>

                    {/* Barra empilhada */}
                    <div className="mt-5 flex h-7 w-full overflow-hidden bg-secondary">
                        {stats.qtdPorNivel.abuso > 0 && (
                            <div
                                style={{
                                    width: `${((stats.qtdPorNivel.abuso / totalNiveis) * 100).toFixed(2)}%`,
                                }}
                                title={`Indício de abuso: ${stats.qtdPorNivel.abuso}`}
                                className="h-full bg-destructive"
                            />
                        )}
                        {stats.qtdPorNivel.acima > 0 && (
                            <div
                                style={{
                                    width: `${((stats.qtdPorNivel.acima / totalNiveis) * 100).toFixed(2)}%`,
                                }}
                                title={`Acima da média: ${stats.qtdPorNivel.acima}`}
                                className="h-full bg-gold"
                            />
                        )}
                        {stats.qtdPorNivel.media > 0 && (
                            <div
                                style={{
                                    width: `${((stats.qtdPorNivel.media / totalNiveis) * 100).toFixed(2)}%`,
                                }}
                                title={`Juros bons / Na média: ${stats.qtdPorNivel.media}`}
                                className="h-full bg-[#126A35]"
                            />
                        )}
                    </div>

                    <div className="mt-5 divide-y divide-ink/15 text-sm tabular-nums">
                        {(
                            [
                                {
                                    id: "abuso",
                                    titulo: "Indício de abuso (≥ 1,5x a média)",
                                    cor: "bg-destructive",
                                    qtd: stats.qtdPorNivel.abuso,
                                    valor: stats.valorPorNivel.abuso,
                                },
                                {
                                    id: "acima",
                                    titulo: "Acima da média (1,1x a 1,49x)",
                                    cor: "bg-gold",
                                    qtd: stats.qtdPorNivel.acima,
                                    valor: stats.valorPorNivel.acima,
                                },
                                {
                                    id: "media",
                                    titulo: "Juros bons / Dentro da média (≤ 1,1x)",
                                    cor: "bg-[#126A35]",
                                    qtd: stats.qtdPorNivel.media,
                                    valor: stats.valorPorNivel.media,
                                },
                            ] as const
                        ).map((faixa) => (
                            <div key={faixa.id} className="flex items-center justify-between gap-4 py-3">
                                <div className="flex items-center gap-2.5">
                                    <span aria-hidden className={cn("inline-block size-3 shrink-0", faixa.cor)} />
                                    <div>
                                        <p className="font-semibold text-ink">{faixa.titulo}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {faixa.qtd} {faixa.qtd === 1 ? "caso" : "casos"} (
                                            {num((faixa.qtd / totalNiveis) * 100, 0)}%)
                                        </p>
                                    </div>
                                </div>
                                <span className="font-bold text-ink">{brl(faixa.valor)}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Gráfico 3: Ranking de Bancos */}
                <section className="border border-ink/25 bg-card p-6">
                    <div className="border-b border-ink/15 pb-3">
                        <p className="rubric text-gold-deep">Instituições demandadas</p>
                        <h2 className="subdisplay mt-1 text-xl text-ink">Ranking por banco e abuso médio</h2>
                    </div>

                    <div className="mt-5 space-y-4 tabular-nums">
                        {stats.porBanco.slice(0, 8).map((b) => {
                            const largura = Math.max(4, (b.valorTotal / maxBancoValor) * 100);
                            return (
                                <div key={b.nome} className="space-y-1.5">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                                        <span className="font-semibold text-ink">
                                            {b.nome}{" "}
                                            <span className="font-normal text-muted-foreground">
                                                · {b.casos} {b.casos === 1 ? "caso" : "casos"} · média{" "}
                                                <strong
                                                    className={cn(
                                                        b.razaoMedia >= 1.5 ? "text-destructive" : "text-ink",
                                                    )}
                                                >
                                                    {num(b.razaoMedia, 2)}x
                                                </strong>
                                            </span>
                                        </span>
                                        <span className="font-bold text-ink">{brl(b.valorTotal)}</span>
                                    </div>
                                    <div className="h-4 w-full bg-secondary">
                                        <div
                                            style={{ width: `${largura.toFixed(1)}%` }}
                                            className={cn(
                                                "h-full",
                                                b.razaoMedia >= 1.5 ? "bg-destructive" : "bg-ink",
                                            )}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Gráfico 4: Modalidades de Crédito */}
                <section className="border border-ink/25 bg-card p-6">
                    <div className="border-b border-ink/15 pb-3">
                        <p className="rubric text-gold-deep">Linhas de crédito</p>
                        <h2 className="subdisplay mt-1 text-xl text-ink">Volume revisional por modalidade</h2>
                    </div>

                    <div className="mt-5 space-y-4 tabular-nums">
                        {stats.porModalidade.map((m) => {
                            const largura = Math.max(4, (m.valorTotal / maxModValor) * 100);
                            return (
                                <div key={m.nome} className="space-y-1.5">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                                        <span className="font-semibold text-ink">
                                            {m.nome}{" "}
                                            <span className="font-normal text-muted-foreground">
                                                · {m.casos} {m.casos === 1 ? "caso" : "casos"} · {num(m.razaoMedia, 2)}x
                                            </span>
                                        </span>
                                        <span className="font-bold text-ink">{brl(m.valorTotal)}</span>
                                    </div>
                                    <div className="h-4 w-full bg-secondary">
                                        <div
                                            style={{ width: `${largura.toFixed(1)}%` }}
                                            className="h-full bg-gold-deep"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        </div>
    );
};
