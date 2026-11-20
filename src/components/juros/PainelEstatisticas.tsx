import { useMemo, useState, type ReactNode } from "react";
import { Calculator, RefreshCw } from "lucide-react";
import { brl, num, LIMITE_ABUSIVO, type Nivel } from "@/lib/juros";
import { agregarEstatisticasCarteira, normalizarRotuloBanco } from "@/lib/juros/graficos-dados";
import { isCalculoPendente, type CalculoSalvo, type Categoria } from "@/lib/revisional-db";
import { cn } from "@/lib/utils";
import { BarraPaginacao } from "@/components/juros/PaginacaoLista";

interface PainelEstatisticasProps {
    calculos: CalculoSalvo[];
    categorias: Categoria[];
    carregando: boolean;
    onRecarregar: () => void;
    onIrCalculadora: () => void;
    onAbrirHistoricoCategoria: (categoriaId: string) => void;
    /** Categorias = tipo da ação (revisional_tipos). As "categorias" acima são as fases. */
    tipos?: Categoria[];
    onAbrirHistoricoTipo?: (tipoId: string) => void;
}

/* ------------------------------------------------------------------ Vocabulário dos gráficos */

/** Cores de status: só para o grau de abusividade (sempre acompanhadas de rótulo). */
const BG_NIVEL: Record<Nivel, string> = {
    abuso: "bg-destructive",
    acima: "bg-gold",
    media: "bg-[#126A35]",
};

const NIVEIS: Array<{ id: Nivel; rotulo: string; faixa: string; textoSobreCor: string }> = [
    { id: "abuso", rotulo: "Indício de abuso", faixa: "≥ 1,5x a média", textoSobreCor: "text-paper" },
    { id: "acima", rotulo: "Acima da média", faixa: "1,1x a 1,49x", textoSobreCor: "text-ink" },
    { id: "media", rotulo: "Dentro da média", faixa: "≤ 1,1x", textoSobreCor: "text-paper" },
];

const ROTULO_NIVEL: Record<Nivel, string> = {
    abuso: "indício de abuso",
    acima: "acima da média",
    media: "dentro da média",
};

/** Faixas do histograma alinhadas aos limites de 1,1x e 1,5x. */
const FAIXAS_RAZAO: Array<{ rotulo: string; descricao: string; nivel: Nivel }> = [
    { rotulo: "< 0,9", descricao: "abaixo de 0,9x", nivel: "media" },
    { rotulo: "0,9–1,1", descricao: "de 0,9x a 1,1x", nivel: "media" },
    { rotulo: "1,1–1,3", descricao: "de 1,1x a 1,3x", nivel: "acima" },
    { rotulo: "1,3–1,5", descricao: "de 1,3x a 1,5x", nivel: "acima" },
    { rotulo: "1,5–1,75", descricao: "de 1,5x a 1,75x", nivel: "abuso" },
    { rotulo: "1,75–2", descricao: "de 1,75x a 2x", nivel: "abuso" },
    { rotulo: "2–2,5", descricao: "de 2x a 2,5x", nivel: "abuso" },
    { rotulo: "≥ 2,5", descricao: "2,5x ou mais", nivel: "abuso" },
];

/** Valores que separam as faixas acima (marcas do eixo do histograma, em "x"). */
const LIMITES_FAIXAS = ["0,9", "1,1", "1,3", "1,5", "1,75", "2", "2,5"];

function indiceFaixaRazao(r: number): number {
    if (r < 0.9) return 0;
    if (r <= 1.1) return 1;
    if (r <= 1.3) return 2;
    if (r < LIMITE_ABUSIVO) return 3;
    if (r < 1.75) return 4;
    if (r < 2) return 5;
    if (r < 2.5) return 6;
    return 7;
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const fmtCompacto = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
});
const brlCompacto = (v: number) => fmtCompacto.format(v);

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function nivelDoCaso(c: CalculoSalvo): Nivel {
    return c.nivel === "abuso" || c.nivel === "acima" ? c.nivel : "media";
}

function mediana(valores: number[]): number {
    if (!valores.length) return 0;
    const ord = [...valores].sort((a, b) => a - b);
    const meio = Math.floor(ord.length / 2);
    return ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2;
}

function valorAcao(c: CalculoSalvo): number {
    return Number(c.valor_total_acao) || Number(c.diferenca_total) || 0;
}

/* ------------------------------------------------------------------ Moldura dos cartões */

const CartaoGrafico = ({
    titulo,
    apoio,
    acao,
    className,
    children,
}: {
    titulo: string;
    apoio?: ReactNode;
    acao?: ReactNode;
    className?: string;
    children: ReactNode;
}) => (
    <section className={cn("min-w-0 overflow-hidden border border-ink/15 bg-card", className)}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 bg-ink px-5 py-3">
            <div className="min-w-0">
                <h2 className="sys-section text-paper">{titulo}</h2>
                {apoio && <p className="mt-0.5 text-xs leading-snug text-paper/65">{apoio}</p>}
            </div>
            {acao}
        </div>
        <div className="px-5 pb-5 pt-1">{children}</div>
    </section>
);

/** Colunas simples de uma série (sem eixo Y: o maior valor e o mês atual levam rótulo). */
const MiniColunas = ({
    titulo,
    valores,
    rotulosMes,
    formatar,
}: {
    titulo: string;
    valores: number[];
    rotulosMes: string[];
    formatar: (v: number) => string;
}) => {
    const max = Math.max(0, ...valores);
    const idxMax = max > 0 ? valores.lastIndexOf(max) : -1;
    const idxAtual = valores.length - 1;
    const ALTURA = 64;

    return (
        <div>
            <p className="text-xs font-semibold text-ink">{titulo}</p>
            <div className="mt-2 flex h-[84px] items-end gap-0.5 border-b border-ink/25">
                {valores.map((v, i) => {
                    const altura = max > 0 ? Math.round((v / max) * ALTURA) : 0;
                    // Rótulo seletivo: o maior valor e o mês atual (se não ficarem colados um no outro).
                    const rotularAtual = i === idxAtual && Math.abs(idxAtual - idxMax) !== 1;
                    const rotular = v > 0 && (i === idxMax || rotularAtual);
                    return (
                        <div
                            key={i}
                            role="img"
                            aria-label={`${rotulosMes[i]}: ${formatar(v)}`}
                            title={`${rotulosMes[i]}: ${formatar(v)}`}
                            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                        >
                            {rotular && (
                                <span className="mb-1 whitespace-nowrap text-[10.5px] font-semibold tabular-nums text-ink">
                                    {formatar(v)}
                                </span>
                            )}
                            {altura > 0 && (
                                <div
                                    className="w-full max-w-6 rounded-t-[3px] bg-ink"
                                    style={{ height: `${Math.max(2, altura)}px` }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ Painel */

const LIMITE_BANCOS_VISIVEIS = 10;

export const PainelEstatisticas = ({
    calculos,
    categorias,
    carregando,
    onRecarregar,
    onIrCalculadora,
    onAbrirHistoricoCategoria,
    tipos = [],
    onAbrirHistoricoTipo,
}: PainelEstatisticasProps) => {
    const [filtroCat, setFiltroCat] = useState<string>("todas");
    const [filtroTipo, setFiltroTipo] = useState<string>("todos");
    const [paginaBancos, setPaginaBancos] = useState(1);

    // Dois recortes independentes: fase (categoria_id) e categoria / tipo da ação (tipo_id).
    const passaFase = useMemo(() => {
        const idsValidos = new Set(categorias.map((c) => c.id));
        return (c: CalculoSalvo) =>
            filtroCat === "todas" ||
            (filtroCat === "sem" ? !c.categoria_id || !idsValidos.has(c.categoria_id) : c.categoria_id === filtroCat);
    }, [categorias, filtroCat]);
    const passaTipo = useMemo(() => {
        const idsValidos = new Set(tipos.map((t) => t.id));
        return (c: CalculoSalvo) =>
            filtroTipo === "todos" ||
            (filtroTipo === "sem" ? !c.tipo_id || !idsValidos.has(c.tipo_id) : c.tipo_id === filtroTipo);
    }, [tipos, filtroTipo]);

    const calculosRecorte = useMemo(
        () => calculos.filter((c) => passaFase(c) && passaTipo(c)),
        [calculos, passaFase, passaTipo],
    );

    /** "Carteira por fase" ignora o filtro de fase (mostra todas), mas respeita o de categoria. */
    const statsGeral = useMemo(
        () => agregarEstatisticasCarteira(calculos.filter(passaTipo), categorias),
        [calculos, categorias, passaTipo],
    );

    /** "Carteira por categoria" ignora o filtro de categoria, mas respeita o de fase. */
    const porTipo = useMemo(() => {
        const base = calculos.filter(passaFase);
        const linhas = tipos.map((t) => {
            const itens = base.filter((c) => c.tipo_id === t.id);
            return {
                id: t.id,
                nome: t.nome,
                casos: itens.length,
                valorTotal: itens.reduce((acc, c) => acc + valorAcao(c), 0),
                abusos: itens.filter((c) => c.nivel === "abuso").length,
            };
        });
        const idsValidos = new Set(tipos.map((t) => t.id));
        const sem = base.filter((c) => !c.tipo_id || !idsValidos.has(c.tipo_id));
        if (sem.length > 0) {
            linhas.push({
                id: "sem",
                nome: "Sem categoria",
                casos: sem.length,
                valorTotal: sem.reduce((acc, c) => acc + valorAcao(c), 0),
                abusos: sem.filter((c) => c.nivel === "abuso").length,
            });
        }
        return linhas;
    }, [calculos, passaFase, tipos]);
    const stats = useMemo(
        () => agregarEstatisticasCarteira(calculosRecorte, categorias),
        [calculosRecorte, categorias],
    );

    /** Fases na ordem definida pelo escritório (campo `ordem`), "Sem categoria" por último. */
    const fases = useMemo(() => {
        const ordem = new Map(categorias.map((c) => [c.id, c.ordem]));
        return [...statsGeral.porCategoria].sort(
            (a, b) => (ordem.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (ordem.get(b.id) ?? Number.MAX_SAFE_INTEGER),
        );
    }, [statsGeral.porCategoria, categorias]);

    const casosComTaxa = useMemo(
        () => calculosRecorte.filter((c) => !isCalculoPendente(c) && Number(c.razao_am) > 0),
        [calculosRecorte],
    );

    const histograma = useMemo(() => {
        const faixas = FAIXAS_RAZAO.map((f) => ({ ...f, clientes: [] as string[] }));
        let noLimite = 0;
        for (const c of casosComTaxa) {
            const r = Number(c.razao_am);
            faixas[indiceFaixaRazao(r)].clientes.push(c.cliente_nome);
            if (r >= 1.4 && r < LIMITE_ABUSIVO) noLimite += 1;
        }
        return { faixas, noLimite };
    }, [casosComTaxa]);

    const evolucao = useMemo(() => {
        const hoje = new Date();
        const meses = Array.from({ length: 12 }, (_, i) => {
            const d = new Date(hoje.getFullYear(), hoje.getMonth() - 11 + i, 1);
            return {
                chave: `${d.getFullYear()}-${d.getMonth()}`,
                rotulo: MESES_CURTOS[d.getMonth()],
                rotuloLongo: `${MESES_CURTOS[d.getMonth()]}/${d.getFullYear()}`,
                ano: d.getFullYear(),
                mes: d.getMonth(),
                casos: 0,
                valor: 0,
            };
        });
        const porChave = new Map(meses.map((m) => [m.chave, m]));
        for (const c of calculosRecorte) {
            const d = new Date(c.created_at);
            if (Number.isNaN(d.getTime())) continue;
            const alvo = porChave.get(`${d.getFullYear()}-${d.getMonth()}`);
            if (!alvo) continue;
            alvo.casos += 1;
            alvo.valor += valorAcao(c);
        }
        return meses;
    }, [calculosRecorte]);

    const bancos = useMemo(() => {
        const mapa = new Map<
            string,
            { nome: string; casos: Array<{ id: string; cliente: string; razao: number; nivel: Nivel }>; total: number }
        >();
        for (const c of casosComTaxa) {
            const nome = normalizarRotuloBanco(c.banco || "");
            const g = mapa.get(nome) ?? { nome, casos: [], total: 0 };
            g.casos.push({ id: c.id, cliente: c.cliente_nome, razao: Number(c.razao_am), nivel: nivelDoCaso(c) });
            g.total += valorAcao(c);
            mapa.set(nome, g);
        }
        return [...mapa.values()]
            .map((g) => ({ ...g, mediana: mediana(g.casos.map((x) => x.razao)) }))
            .sort((a, b) => b.mediana - a.mediana || b.casos.length - a.casos.length);
    }, [casosComTaxa]);

    const escalaBancos = useMemo(() => {
        const maiorRazao = Math.max(0, ...casosComTaxa.map((c) => Number(c.razao_am)));
        const max = Math.max(3, Math.ceil(maiorRazao * 2) / 2);
        const min = 0.5;
        const ticks: number[] = [];
        for (let t = min; t <= max + 1e-9; t += 0.5) ticks.push(Number(t.toFixed(2)));
        const pos = (r: number) => ((Math.min(Math.max(r, min), max) - min) / (max - min)) * 100;
        return { min, max, ticks, pos };
    }, [casosComTaxa]);

    if (calculos.length === 0) {
        return (
            <div className="border border-ink/20 bg-card p-8 text-center sm:p-10">
                <h2 className="sys-section text-ink">Salve cálculos para visualizar os gráficos da carteira</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Assim que os casos forem salvos, este painel mostra a carteira por fase, o grau de abusividade, a
                    distribuição das taxas, a evolução mês a mês e o comportamento de cada banco.
                </p>
                <button
                    type="button"
                    onClick={onIrCalculadora}
                    className="mt-5 inline-flex h-9 items-center gap-2 bg-ink px-4 text-xs font-semibold text-paper hover:bg-ink-soft"
                >
                    <Calculator className="size-4" />
                    Fazer novo cálculo
                </button>
            </div>
        );
    }

    const maxCasosFase = Math.max(1, ...fases.map((f) => f.casos));
    const maxCasosTipo = Math.max(1, ...porTipo.map((t) => t.casos));
    const temFiltro = filtroCat !== "todas" || filtroTipo !== "todos";
    const maxModValor = Math.max(1, ...stats.porModalidade.map((m) => m.valorTotal));
    const totalNiveis = Math.max(1, stats.totalCasos);
    const maxFaixa = Math.max(1, ...histograma.faixas.map((f) => f.clientes.length));
    const totalPaginasBancos = Math.max(1, Math.ceil(bancos.length / LIMITE_BANCOS_VISIVEIS));
    const paginaBancosSegura = Math.min(paginaBancos, totalPaginasBancos);
    const inicioBancos = (paginaBancosSegura - 1) * LIMITE_BANCOS_VISIVEIS;
    const fimBancos = Math.min(bancos.length, inicioBancos + LIMITE_BANCOS_VISIVEIS);
    const bancosVisiveis = bancos.slice(inicioBancos, fimBancos);
    const ALTURA_HISTOGRAMA = 128;

    const pctPos = (r: number) => `${escalaBancos.pos(r).toFixed(2)}%`;

    return (
        <div className="space-y-6">
            {/* Cabeçalho da página: recorte atual e filtros por fase e por categoria */}
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight tabular-nums text-ink">
                        {plural(calculosRecorte.length, "caso", "casos")}
                        <span className="px-1.5 font-normal text-ink/30">·</span>
                        {brl(stats.proveitoTotal)}
                        <span className="text-base font-medium text-muted-foreground"> em proveito</span>
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {temFiltro ? (
                            <>
                                Recorte de {plural(calculos.length, "caso", "casos")} da carteira
                                <span className="px-1.5 text-ink/30">·</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFiltroCat("todas");
                                        setFiltroTipo("todos");
                                    }}
                                    className="font-semibold text-ink underline-offset-4 hover:underline"
                                >
                                    Ver toda a carteira
                                </button>
                            </>
                        ) : (
                            "Toda a carteira do escritório"
                        )}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onRecarregar}
                    disabled={carregando}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 border border-ink/25 bg-card px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5 disabled:opacity-50"
                >
                    <RefreshCw className={cn("size-3.5", carregando && "animate-spin")} />
                    Atualizar dados
                </button>
            </header>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div role="group" aria-label="Filtrar por fase" className="flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-xs font-semibold text-muted-foreground">Fase</span>
                    {[{ id: "todas", nome: "Todas", casos: statsGeral.totalCasos }, ...fases].map((f) => {
                        const ativo = filtroCat === f.id;
                        return (
                            <button
                                key={f.id}
                                type="button"
                                aria-pressed={ativo}
                                onClick={() => setFiltroCat(f.id)}
                                className={cn(
                                    "inline-flex h-8 items-center gap-1.5 whitespace-nowrap px-2.5 text-xs font-medium transition-colors duration-150",
                                    ativo ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                                )}
                            >
                                {f.nome}
                                <span className={cn("tabular-nums", ativo ? "text-paper/70" : "text-muted-foreground")}>
                                    {f.casos}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {tipos.length > 0 && (
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        Categoria
                        <select
                            value={filtroTipo}
                            onChange={(e) => setFiltroTipo(e.target.value)}
                            className="field w-48 cursor-pointer py-1.5 text-xs font-medium text-ink [&>option]:text-ink"
                        >
                            <option value="todos">Todas as categorias</option>
                            {tipos.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.nome}
                                </option>
                            ))}
                            <option value="sem">Sem categoria</option>
                        </select>
                    </label>
                )}
            </div>

            {/* Faixa única de 4 KPIs */}
            <dl className="grid divide-y divide-ink/15 border-y border-ink/20 tabular-nums sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
                <div className="px-4 py-3.5">
                    <dt className="sys-label">Proveito econômico total</dt>
                    <dd className="sys-kpi-value mt-1 text-ink">{brl(stats.proveitoTotal)}</dd>
                </div>
                <div className="px-4 py-3.5">
                    <dt className="sys-label">Pago a mais + tarifas</dt>
                    <dd className="sys-kpi-value mt-1 text-ink">{brl(stats.pagoAMaisETarifasTotal)}</dd>
                </div>
                <div className="px-4 py-3.5">
                    <dt className="sys-label">Indício de abuso (≥ 1,5x)</dt>
                    <dd className="sys-kpi-value mt-1 text-ink">
                        {num(stats.percentualAbuso, 0)}%{" "}
                        <span className="text-sm font-semibold text-muted-foreground">
                            ({stats.qtdPorNivel.abuso}/{stats.totalCasos})
                        </span>
                    </dd>
                </div>
                <div className="px-4 py-3.5">
                    <dt className="sys-label">Ticket médio da ação</dt>
                    <dd className="sys-kpi-value mt-1 text-ink">{brl(stats.ticketMedio)}</dd>
                </div>
            </dl>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* 1. Carteira por fase */}
                <CartaoGrafico
                    className="lg:col-span-6"
                    titulo="Carteira por fase"
                    apoio="Casos em cada etapa do fluxo, na ordem do escritório. Clique para abrir na carteira."
                >
                    <ul className="mt-3 tabular-nums">
                        {fases.map((f) => {
                            const largura = f.casos > 0 ? Math.max(2, (f.casos / maxCasosFase) * 100) : 0;
                            const esmaecida = filtroCat !== "todas" && filtroCat !== f.id;
                            return (
                                <li key={f.id}>
                                    <button
                                        type="button"
                                        onClick={() => onAbrirHistoricoCategoria(f.id)}
                                        aria-label={`${f.nome}: ${plural(f.casos, "caso", "casos")}, ${brl(f.valorTotal)} em proveito. Abrir na carteira.`}
                                        className={cn(
                                            "group grid w-full grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-3 py-2 text-left transition-opacity duration-150 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]",
                                            esmaecida && "opacity-40 hover:opacity-100",
                                        )}
                                    >
                                        <span className="truncate text-xs font-semibold text-ink group-hover:underline">
                                            {f.nome}
                                        </span>
                                        <span className="block h-2.5 overflow-hidden bg-secondary">
                                            {largura > 0 && (
                                                <span
                                                    className="block h-full rounded-r-[3px] bg-ink"
                                                    style={{ width: `${largura.toFixed(1)}%` }}
                                                />
                                            )}
                                        </span>
                                        <span className="whitespace-nowrap text-right text-xs">
                                            <strong className="font-semibold text-ink">{f.casos}</strong>
                                            <span className="text-muted-foreground"> · {brlCompacto(f.valorTotal)}</span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </CartaoGrafico>

                {/* 1b. Carteira por categoria (tipo da ação) */}
                {tipos.length > 0 && (
                    <CartaoGrafico
                        className="lg:col-span-6"
                        titulo="Carteira por categoria"
                        apoio="Casos por tipo de ação, com quantos têm indício de abuso. Clique para abrir na carteira."
                    >
                        <ul className="mt-3 tabular-nums">
                            {porTipo.map((t) => {
                                const largura = t.casos > 0 ? Math.max(2, (t.casos / maxCasosTipo) * 100) : 0;
                                const esmaecida = filtroTipo !== "todos" && filtroTipo !== t.id;
                                return (
                                    <li key={t.id}>
                                        <button
                                            type="button"
                                            disabled={!onAbrirHistoricoTipo}
                                            onClick={() => onAbrirHistoricoTipo?.(t.id)}
                                            aria-label={`${t.nome}: ${plural(t.casos, "caso", "casos")}, ${brl(t.valorTotal)} em proveito. Abrir na carteira.`}
                                            className={cn(
                                                "group grid w-full grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-3 py-2 text-left transition-opacity duration-150 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]",
                                                esmaecida && "opacity-40 hover:opacity-100",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "truncate text-xs font-semibold group-hover:underline",
                                                    t.id === "sem" ? "text-muted-foreground" : "text-ink",
                                                )}
                                            >
                                                {t.nome}
                                            </span>
                                            <span className="block h-2.5 overflow-hidden bg-secondary">
                                                {largura > 0 && (
                                                    <span
                                                        className="block h-full rounded-r-[3px] bg-ink/70"
                                                        style={{ width: `${largura.toFixed(1)}%` }}
                                                    />
                                                )}
                                            </span>
                                            <span className="whitespace-nowrap text-right text-xs">
                                                <strong className="font-semibold text-ink">{t.casos}</strong>
                                                <span className="text-muted-foreground"> · {brlCompacto(t.valorTotal)}</span>
                                                {t.abusos > 0 && (
                                                    <span className="font-semibold text-destructive"> · {t.abusos} abuso</span>
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </CartaoGrafico>
                )}

                {/* 2. Grau de abusividade */}
                <CartaoGrafico
                    className="lg:col-span-6"
                    titulo="Grau de abusividade"
                    apoio="A barra é dividida pelo número de casos; o proveito em R$ vem na tabela."
                >
                    <div
                        role="img"
                        aria-label={NIVEIS.map(
                            (n) => `${n.rotulo}: ${plural(stats.qtdPorNivel[n.id], "caso", "casos")}`,
                        ).join("; ")}
                        className="mt-4 flex h-9 w-full gap-0.5 overflow-hidden rounded-[5px]"
                    >
                        {NIVEIS.map((n) => {
                            const qtd = stats.qtdPorNivel[n.id];
                            if (qtd === 0) return null;
                            const pct = Math.round((qtd / totalNiveis) * 100);
                            return (
                                <div
                                    key={n.id}
                                    title={`${n.rotulo}: ${plural(qtd, "caso", "casos")} (${pct}%)`}
                                    style={{ flex: `${qtd} 1 0%` }}
                                    className={cn(
                                        "flex min-w-0 items-center justify-center text-xs font-semibold tabular-nums",
                                        BG_NIVEL[n.id],
                                        n.textoSobreCor,
                                    )}
                                >
                                    {pct >= 14 ? `${qtd} · ${pct}%` : pct >= 7 ? qtd : ""}
                                </div>
                            );
                        })}
                    </div>

                    <table className="mt-4 w-full text-sm tabular-nums">
                        <thead>
                            <tr className="border-b border-ink/15 text-xs text-muted-foreground">
                                <th scope="col" className="pb-1.5 text-left font-medium">
                                    Grau
                                </th>
                                <th scope="col" className="pb-1.5 text-right font-medium">
                                    Casos
                                </th>
                                <th scope="col" className="pb-1.5 pl-3 text-right font-medium">
                                    Proveito da ação
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ink/10">
                            {NIVEIS.map((n) => {
                                const qtd = stats.qtdPorNivel[n.id];
                                return (
                                    <tr key={n.id}>
                                        <td className="py-2.5 pr-2">
                                            <span className="flex items-center gap-2.5">
                                                <span
                                                    aria-hidden
                                                    className={cn("inline-block size-2.5 shrink-0", BG_NIVEL[n.id])}
                                                />
                                                <span>
                                                    <span className="block font-medium text-ink">{n.rotulo}</span>
                                                    <span className="block text-xs text-muted-foreground">{n.faixa}</span>
                                                </span>
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap py-2.5 text-right">
                                            <span className="font-semibold text-ink">{qtd}</span>{" "}
                                            <span className="text-xs text-muted-foreground">
                                                ({num((qtd / totalNiveis) * 100, 0)}%)
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap py-2.5 pl-3 text-right font-semibold text-ink">
                                            {brl(stats.valorPorNivel[n.id])}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </CartaoGrafico>

                {/* 3. Distribuição das taxas */}
                <CartaoGrafico
                    className="lg:col-span-6"
                    titulo="Distribuição das taxas"
                    apoio="Casos por faixa da razão entre a taxa do contrato e a média de mercado."
                >
                    <div className="mt-7">
                        <div className="relative flex h-40 items-end gap-0.5 border-b border-ink/25">
                            {histograma.faixas.map((f) => {
                                const n = f.clientes.length;
                                const altura = n > 0 ? Math.max(3, Math.round((n / maxFaixa) * ALTURA_HISTOGRAMA)) : 0;
                                const descricao = `${f.descricao}: ${plural(n, "caso", "casos")}`;
                                return (
                                    <div
                                        key={f.rotulo}
                                        role="img"
                                        aria-label={descricao}
                                        title={n > 0 ? `${descricao}\n${f.clientes.join("\n")}` : descricao}
                                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                                    >
                                        {n > 0 && (
                                            <span className="mb-1 text-[11px] font-semibold tabular-nums text-ink">{n}</span>
                                        )}
                                        {altura > 0 && (
                                            <div
                                                className={cn("w-full max-w-6 rounded-t-[3px]", BG_NIVEL[f.nivel])}
                                                style={{ height: `${altura}px` }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                            {/* Limite de 1,5x: fica exatamente entre a 4ª e a 5ª faixa */}
                            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-ink/45" />
                            <span className="pointer-events-none absolute -top-6 left-1/2 ml-1.5 whitespace-nowrap text-[11px] font-semibold text-ink">
                                1,5x · limite de abuso
                            </span>
                        </div>
                        {/* Eixo: marca os limites entre as faixas (cada coluna é o intervalo entre duas marcas) */}
                        <div className="relative mt-1 h-4">
                            {LIMITES_FAIXAS.map((limite, k) => (
                                <span
                                    key={limite}
                                    className="absolute top-0 -translate-x-1/2 text-[10.5px] tabular-nums text-muted-foreground"
                                    style={{ left: `${(((k + 1) / FAIXAS_RAZAO.length) * 100).toFixed(2)}%` }}
                                >
                                    {limite}
                                </span>
                            ))}
                        </div>
                        <p className="mt-0.5 text-center text-[11px] text-muted-foreground">
                            razão taxa do contrato ÷ média (x)
                        </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink/10 pt-3 text-xs text-muted-foreground">
                        {NIVEIS.map((n) => (
                            <span key={n.id} className="inline-flex items-center gap-1.5">
                                <span aria-hidden className={cn("inline-block size-2.5", BG_NIVEL[n.id])} />
                                {n.rotulo}
                            </span>
                        ))}
                    </div>
                    {histograma.noLimite > 0 && (
                        <p className="mt-2 text-xs leading-relaxed text-ink">
                            <strong className="font-semibold">
                                {plural(histograma.noLimite, "caso está", "casos estão")} entre 1,4x e 1,5x
                            </strong>
                            , no limite: com outra taxa de referência, podem passar a indício de abuso.
                        </p>
                    )}
                </CartaoGrafico>

                {/* 4. Evolução mensal (duas séries, cada uma com sua escala, eixo de meses compartilhado) */}
                <CartaoGrafico
                    className={tipos.length > 0 ? "lg:col-span-12" : "lg:col-span-6"}
                    titulo="Evolução mensal"
                    apoio="Pelo mês em que o caso foi cadastrado, nos últimos 12 meses."
                >
                    <div className="mt-4 space-y-4">
                        <MiniColunas
                            titulo="Casos cadastrados"
                            valores={evolucao.map((m) => m.casos)}
                            rotulosMes={evolucao.map((m) => m.rotuloLongo)}
                            formatar={(v) => String(v)}
                        />
                        <MiniColunas
                            titulo="Proveito dos casos cadastrados"
                            valores={evolucao.map((m) => m.valor)}
                            rotulosMes={evolucao.map((m) => m.rotuloLongo)}
                            formatar={brlCompacto}
                        />
                        <div className="-mt-2 flex gap-0.5">
                            {evolucao.map((m, i) => (
                                <span
                                    key={m.chave}
                                    className="min-w-0 flex-1 text-center text-[10.5px] leading-tight text-muted-foreground"
                                >
                                    {m.rotulo}
                                    {(i === 0 || m.mes === 0) && (
                                        <span className="block tabular-nums text-ink/60">{m.ano}</span>
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>
                </CartaoGrafico>

                {/* 5. Abuso por banco: um ponto por caso */}
                <CartaoGrafico
                    className="lg:col-span-12 xl:col-span-7"
                    titulo="Abuso por banco"
                    apoio="Cada ponto é um caso. Bancos ordenados pela mediana da razão; poucos casos pedem cautela na leitura."
                >
                    <div className="mt-3 text-xs tabular-nums">
                        {/* Cabeçalho: escala */}
                        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_6.5rem]">
                            <span className="hidden sm:block" />
                            <div className="relative h-5">
                                {escalaBancos.ticks.map((t) => (
                                    <span
                                        key={t}
                                        className="absolute top-0 -translate-x-1/2 text-[10.5px] text-muted-foreground"
                                        style={{ left: pctPos(t) }}
                                    >
                                        {num(t, 1)}x
                                    </span>
                                ))}
                            </div>
                            <span className="hidden text-right text-[10.5px] text-muted-foreground sm:block">
                                casos · proveito
                            </span>
                        </div>

                        <ul className="border-y border-ink/10">
                            {bancosVisiveis.map((b) => (
                                <li
                                    key={b.nome}
                                    className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-x-3 border-b border-ink/5 last:border-b-0 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_6.5rem] sm:border-b-0"
                                >
                                    <span className="order-1 flex min-w-0 items-center pt-1.5 sm:py-1.5">
                                        <span className="truncate font-medium text-ink" title={b.nome}>
                                            {b.nome}
                                        </span>
                                    </span>
                                    <div className="relative order-3 col-span-2 min-h-8 sm:order-2 sm:col-span-1">
                                        {/* referências: 1,0x média de mercado, 1,5x abuso */}
                                        <span
                                            aria-hidden
                                            className="absolute inset-y-0 w-px bg-ink/25"
                                            style={{ left: pctPos(1) }}
                                        />
                                        <span
                                            aria-hidden
                                            className="absolute inset-y-0 w-px bg-ink/50"
                                            style={{ left: pctPos(LIMITE_ABUSIVO) }}
                                        />
                                        {/* mediana */}
                                        <span
                                            aria-hidden
                                            title={`Mediana: ${num(b.mediana, 2)}x`}
                                            className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-ink"
                                            style={{ left: pctPos(b.mediana) }}
                                        />
                                        {b.casos.map((caso, i) => {
                                            const deslocamento = b.casos.length > 1 ? (i % 3) * 4 - 4 : 0;
                                            const descricao = `${caso.cliente}: ${num(caso.razao, 2)}x (${ROTULO_NIVEL[caso.nivel]})`;
                                            return (
                                                <span
                                                    key={caso.id}
                                                    role="img"
                                                    aria-label={descricao}
                                                    title={descricao}
                                                    className="absolute top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                                                    style={{
                                                        left: pctPos(caso.razao),
                                                        marginTop: `${deslocamento}px`,
                                                    }}
                                                >
                                                    <span
                                                        className={cn(
                                                            "block size-2.5 rounded-full ring-2 ring-card",
                                                            BG_NIVEL[caso.nivel],
                                                        )}
                                                    />
                                                </span>
                                            );
                                        })}
                                    </div>
                                    <span className="order-2 flex items-center justify-end whitespace-nowrap pt-1.5 text-right sm:order-3 sm:py-1.5">
                                        <strong className="font-semibold text-ink">{b.casos.length}</strong>
                                        <span className="text-muted-foreground">&nbsp;· {brlCompacto(b.total)}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                                {NIVEIS.map((n) => (
                                    <span key={n.id} className="inline-flex items-center gap-1.5">
                                        <span aria-hidden className={cn("inline-block size-2.5 rounded-full", BG_NIVEL[n.id])} />
                                        {n.rotulo}
                                    </span>
                                ))}
                                <span className="inline-flex items-center gap-1.5">
                                    <span aria-hidden className="inline-block h-3.5 w-0.5 bg-ink" />
                                    Mediana
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span aria-hidden className="inline-block h-3.5 w-px bg-ink/25" />
                                    1,0x (média de mercado)
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span aria-hidden className="inline-block h-3.5 w-px bg-ink/50" />
                                    1,5x (abuso)
                                </span>
                            </div>
                            <BarraPaginacao
                                variante="compacta"
                                pagina={paginaBancosSegura}
                                totalPaginas={totalPaginasBancos}
                                total={bancos.length}
                                inicio={inicioBancos}
                                fim={fimBancos}
                                onPagina={setPaginaBancos}
                                rotulo="bancos"
                                className="min-w-[11rem]"
                            />
                        </div>
                    </div>
                </CartaoGrafico>

                {/* 6. Volume por modalidade */}
                <CartaoGrafico
                    className="lg:col-span-12 xl:col-span-5"
                    titulo="Volume por modalidade"
                    apoio="Proveito somado por modalidade de crédito."
                >
                    <ul className="mt-3 space-y-3 tabular-nums">
                        {stats.porModalidade.map((m) => {
                            const largura = Math.max(2, (m.valorTotal / maxModValor) * 100);
                            return (
                                <li key={m.nome}>
                                    <div className="flex items-baseline justify-between gap-3 text-xs">
                                        <span className="min-w-0">
                                            <span className="font-semibold text-ink">{m.nome}</span>{" "}
                                            <span className="text-muted-foreground">
                                                · {plural(m.casos, "caso", "casos")} · média {num(m.razaoMedia, 2)}x
                                            </span>
                                        </span>
                                        <span className="shrink-0 font-semibold text-ink">{brlCompacto(m.valorTotal)}</span>
                                    </div>
                                    <span className="mt-1.5 block h-2 overflow-hidden bg-secondary">
                                        <span
                                            className="block h-full rounded-r-[3px] bg-ink/70"
                                            style={{ width: `${largura.toFixed(1)}%` }}
                                        />
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </CartaoGrafico>
            </div>
        </div>
    );
};
