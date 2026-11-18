import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    ArrowRight,
    BarChart3,
    BookmarkCheck,
    BookmarkPlus,
    Calculator,
    Check,
    Copy,
    CopyPlus,
    ExternalLink,
    FileDown,
    FilePlus2,
    FileSpreadsheet,
    FolderClock,
    FolderOpen,
    Gavel,
    KeyRound,
    Loader2,
    LogOut,
    Plus,
    RefreshCw,
    Save,
    Table2,
    Tags,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { labelClass } from "@/components/juros/Campos";
import { TelaLogin, ModalAlterarSenha } from "@/components/juros/RevisionalAuth";
import { GerenciarCategorias, SeloCategoria } from "@/components/juros/GerenciarCategorias";
import { HistoricoCalculos } from "@/components/juros/HistoricoCalculos";
import { ProcessosSalvosDjen } from "@/components/juros/ProcessosSalvosDjen";
import { FormContratoRevisional } from "@/components/juros/FormContratoRevisional";
import { ModalRankingOlinda } from "@/components/juros/ModalRankingOlinda";
import { ModalConsultaDjen, type ContextoInicialDjen } from "@/components/juros/ModalConsultaDjen";
import { SecoesPericiaisExtras } from "@/components/juros/SecoesPericiaisExtras";
import { AssistenteClaudeRevisional } from "@/components/juros/AssistenteClaudeRevisional";
import { GraficoSerieBacen, PainelGraficosCaso } from "@/components/juros/GraficosCasoRevisional";
import { PainelEstatisticas } from "@/components/juros/PainelEstatisticas";
import {
    MODALIDADES,
    brl,
    mNome,
    nivel,
    num,
    validar,
    type Nivel,
} from "@/lib/juros";
import {
    PARAMETROS_DECISAO_PADRAO,
    calcularProcessoRevisional,
    contratoInputParaForm,
    criarContratoFormEmBranco,
    formParaContratoInput,
    hojeISO,
    prepararDadosBacenProcesso,
    type ContratoFormState,
    type DeducaoItem,
    type ParametrosDecisao,
    type ProcessoRevisionalInput,
    type ResultadoContrato,
    type ResultadoProcessoRevisional,
    type TarifaItem,
    type TaxaOlindaSelecao,
} from "@/lib/juros/revisional-pro";
import {
    aplicarExtracaoClaudeAoEstado,
    type ClaudeExtracaoRevisional,
} from "@/lib/juros/claude-revisional";
import { baixarCsvDemonstrativo, baixarLaudoPdf } from "@/lib/juros/laudo-pdf";
import {
    INTERVALO_VERIFICACAO_DJEN_HORAS,
    anexarMovimentacaoDjenAoProcesso,
    criarPayloadCarteiraDeDjen,
    normalizarNumeroProcessoDjen,
    verificarPublicacoesDjen,
    type DjenComunicacao,
} from "@/lib/juros/djen";
import {
    IS_LOCAL_SUPABASE,
    RevisionalApiError,
    atualizarCalculo,
    calculoParaProcesso,
    consumirHashRecuperacao,
    criarCalculo,
    criarCategoria,
    fichaSemCalculoParaPayload,
    isCalculoPendente,
    listarCalculos,
    listarCategorias,
    montarTextoPeticaoPro,
    obterSessaoAtiva,
    processoParaPayload,
    sairDaSessao,
    type CalculoSalvo,
    type Categoria,
    type FichaCliente,
    type RevisionalSession,
} from "@/lib/revisional-db";
import { HeroArt } from "@/components/HeroArt";
import logo from "@/assets/logo2.png";

/**
 * Calculadora revisional pericial completa, para uso interno do escritório.
 * Protegida por login fechado no Supabase, com histórico, categorias, API Olinda e Laudo PDF.
 */

const ROTULO: Record<Nivel, string> = { abuso: "Indício de abuso", acima: "Acima da média", media: "Na média" };
const COR: Record<Nivel, string> = {
    abuso: "bg-destructive text-destructive-foreground",
    acima: "bg-gold-light text-ink",
    media: "bg-ink/10 text-ink",
};

const FICHA_VAZIA: FichaCliente = {
    clienteNome: "",
    processoGlobal: "",
    banco: "",
    documentoContrato: "",
    categoriaId: null,
    observacoes: "",
};

const Selo = ({ n }: { n: Nivel }) => (
    <span className={cn("inline-block px-2.5 py-1 text-xs font-semibold", COR[n])}>{ROTULO[n]}</span>
);

const Comparacao = ({
    titulo,
    contrato,
    media,
    serie,
    mes,
    razao,
}: {
    titulo: string;
    contrato: string;
    media: string;
    serie: number | null;
    mes: string;
    razao: number;
}) => (
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
                    Média BCB {mNome(mes)}
                    {serie ? <span className="text-xs"> · SGS {serie}</span> : null}
                </dt>
                <dd className="font-semibold text-ink">{media}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-ink/20 pt-2">
                <dt className="text-muted-foreground">Contrato / paradigma</dt>
                <dd className="subdisplay text-2xl text-ink">{num(razao)}x</dd>
            </div>
        </dl>
    </div>
);

const Linha = ({ rotulo, a, b, fmt }: { rotulo: string; a: number; b: number; fmt: (x: number) => string }) => {
    const d = a - b;
    return (
        <tr className="border-b border-ink/15 last:border-0">
            <th scope="row" className="py-2.5 pr-4 text-left font-medium text-ink">
                {rotulo}
            </th>
            <td className="py-2.5 pl-4 text-right">{fmt(a)}</td>
            <td className="py-2.5 pl-4 text-right">{fmt(b)}</td>
            <td className={cn("py-2.5 pl-4 text-right font-semibold", d > 0.004 ? "text-destructive" : "text-ink")}>
                {d > 0.004 ? "+" : ""}
                {fmt(d)}
            </td>
        </tr>
    );
};

const BlocoContratoResultado = ({
    rc,
    emDobro,
}: {
    rc: ResultadoContrato;
    emDobro: boolean;
}) => {
    const a = rc.analise;
    const e = a.entrada;
    const pct = (x: number) => `${num(x)}%`;

    return (
        <div className="space-y-7">
            <header className="border-b border-ink/25 pb-5">
                <div className="flex flex-wrap items-center gap-3">
                    <Selo n={rc.nivel} />
                    <span className="text-sm text-muted-foreground">
                        {e.mod.nome} ({e.mod.pessoa.toUpperCase()}) · contratado em {mNome(e.mes)}
                        {rc.contrato.instituicao ? ` · ${rc.contrato.instituicao}` : ""}
                    </span>
                </div>
                <h2 className="subdisplay mt-4 text-[2rem] text-ink">
                    {rc.nivel === "media" ? "Taxa dentro da média" : `Taxa ${num(a.razaoAm, 2)}x a média mensal`}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    Paradigma: <strong className="text-ink">{rc.fonteTaxaRotulo}</strong> ·{" "}
                    {rc.onlineBacen ? "Séries atualizadas no Banco Central." : "Dados guardados / entrada manual."}
                    {rc.contrato.fonteTaxaRevisional === "media_sgs" && a.media.nota && (
                        <span className="mt-1 block font-medium text-ink">{a.media.nota}</span>
                    )}
                    {nivel(a.razaoAa) !== rc.nivel && (
                        <span className="mt-1 block font-medium text-ink">
                            Na capitalização composta anual, a razão atinge {num(a.razaoAa, 2)}x da média anual.
                        </span>
                    )}
                    {a.custosEmbutidos && (
                        <span className="mt-1 block font-medium text-destructive">
                            Pelas parcelas, a taxa efetiva é {pct(a.taxaEfetiva)} a.m., maior que a informada (
                            {pct(a.contratoAm)} a.m.): há custos ou seguros embutidos.
                        </span>
                    )}
                </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
                <Comparacao
                    titulo="Mensal"
                    contrato={`${pct(a.contratoAm)} a.m.`}
                    media={`${pct(a.media.am)} a.m.`}
                    serie={a.media.serieAm}
                    mes={a.media.mes}
                    razao={a.razaoAm}
                />
                <Comparacao
                    titulo="Anual"
                    contrato={`${pct(a.contratoAa)} a.a.`}
                    media={`${pct(a.media.aa)} a.a.`}
                    serie={a.media.serieAa}
                    mes={a.media.mes}
                    razao={a.razaoAa}
                />
            </div>

            <GraficoSerieBacen rc={rc} />

            <div className="overflow-x-auto border border-ink/25 bg-card px-5 py-2">
                <table className="w-full min-w-[34rem] text-sm tabular-nums">
                    <thead>
                        <tr className="border-b border-ink/25 text-xs text-muted-foreground">
                            <th className="py-2.5 text-left font-semibold">
                                <span className="sr-only">Item</span>
                            </th>
                            <th className="py-2.5 pl-4 text-right font-semibold">Contrato</th>
                            <th className="py-2.5 pl-4 text-right font-semibold">Paradigma</th>
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
                                <Linha
                                    rotulo="Saldo no cronograma (original vs. média)"
                                    a={a.saldoHoje}
                                    b={a.saldoHojeNaMedia}
                                    fmt={brl}
                                />
                                <Linha
                                    rotulo="Saldo recalculado (abatendo pagas)"
                                    a={a.saldoHoje}
                                    b={a.saldoRecalculado}
                                    fmt={brl}
                                />
                            </>
                        )}
                        <Linha rotulo="Total a pagar" a={a.total} b={a.totalNaMedia} fmt={brl} />
                    </tbody>
                </table>
            </div>

            <details className="group border border-ink/25 bg-card">
                <summary className="cursor-pointer px-5 py-4 font-semibold text-ink">
                    Demonstrativo completo das parcelas (atualizado: {brl(rc.totalAtualizadoParcelas)})
                </summary>
                <div className="max-h-[28rem] overflow-auto border-t border-ink/25">
                    <table className="w-full min-w-[46rem] text-xs tabular-nums">
                        <thead className="sticky top-0 bg-secondary text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2.5 text-left font-semibold">Nº</th>
                                <th className="px-3 py-2.5 text-left font-semibold">Vencimento</th>
                                <th className="px-3 py-2.5 text-right font-semibold">Devido</th>
                                <th className="px-3 py-2.5 text-right font-semibold">Pago</th>
                                <th className="px-3 py-2.5 text-right font-semibold">
                                    {emDobro ? "Dif. (Dobro)" : "Diferença"}
                                </th>
                                <th className="px-3 py-2.5 text-right font-semibold">Correção</th>
                                <th className="px-3 py-2.5 text-right font-semibold">Juros</th>
                                <th className="px-3 py-2.5 text-right font-semibold">Total Atualizado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ink/10">
                            {rc.linhas.map((l) => (
                                <tr key={l.numero} className={cn(!l.paga && "bg-background/50 text-muted-foreground")}>
                                    <td className="px-3 py-2">
                                        {l.numero}
                                        {l.paga && <Check aria-hidden className="ml-1 inline size-3 text-gold-deep" />}
                                    </td>
                                    <td className="px-3 py-2">{l.vencimento.split("-").reverse().join("/")}</td>
                                    <td className="px-3 py-2 text-right">{brl(l.valorDevido)}</td>
                                    <td className="px-3 py-2 text-right">{l.paga ? brl(l.valorPago) : "Vincenda"}</td>
                                    <td className="px-3 py-2 text-right">{brl(l.diferencaBaseRestituicao)}</td>
                                    <td className="px-3 py-2 text-right">{brl(l.correcao)}</td>
                                    <td className="px-3 py-2 text-right">{brl(l.juros)}</td>
                                    <td className="px-3 py-2 text-right font-semibold text-ink">
                                        {brl(l.totalAtualizado)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>

            {rc.extras.length > 0 && (
                <div className="overflow-x-auto border border-ink/25 bg-card p-5">
                    <h3 className="font-semibold text-ink">Pagamentos extras / antecipações</h3>
                    <table className="mt-3 w-full text-xs tabular-nums">
                        <thead>
                            <tr className="border-b border-ink/20 text-muted-foreground">
                                <th className="py-2 text-left">Descrição</th>
                                <th className="py-2 text-left">Data</th>
                                <th className="py-2 text-right">Base</th>
                                <th className="py-2 text-right">Correção</th>
                                <th className="py-2 text-right">Juros</th>
                                <th className="py-2 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ink/10">
                            {rc.extras.map((ex) => (
                                <tr key={ex.id}>
                                    <td className="py-2">{ex.descricao}</td>
                                    <td className="py-2">{ex.data.split("-").reverse().join("/")}</td>
                                    <td className="py-2 text-right">{brl(ex.valorBase)}</td>
                                    <td className="py-2 text-right">{brl(ex.correcao)}</td>
                                    <td className="py-2 text-right">{brl(ex.juros)}</td>
                                    <td className="py-2 text-right font-semibold">{brl(ex.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

interface ResultadoPainelProps {
    resultado: ResultadoProcessoRevisional;
    ficha: FichaCliente;
    categoria?: Categoria | null;
    calculoAtivoId: string | null;
    salvando: boolean;
    renovando?: boolean;
    onSalvar: (comoNovo: boolean) => void;
    onRenovarHoje?: () => void;
}

const ResultadoPainel = ({
    resultado,
    ficha,
    categoria,
    calculoAtivoId,
    salvando,
    renovando = false,
    onSalvar,
    onRenovarHoje,
}: ResultadoPainelProps) => {
    const [contratoAtivoIdx, setContratoAtivoIdx] = useState(0);
    const [visaoResultado, setVisaoResultado] = useState<"demonstrativo" | "graficos">("demonstrativo");
    const [incluirGraficosPdf, setIncluirGraficosPdf] = useState(true);
    const [copiado, setCopiado] = useState(false);

    const safeIdx = Math.min(contratoAtivoIdx, Math.max(0, resultado.contratos.length - 1));
    const contratoAtual = resultado.contratos[safeIdx];
    const r = resultado.resumo;
    const texto = montarTextoPeticaoPro(resultado, ficha, categoria);

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1800);
        } catch {
            /* fallback manual */
        }
    };

    const baixarPdf = () => {
        try {
            const ok = baixarLaudoPdf(resultado, {
                clienteNome: ficha.clienteNome || "Cliente",
                processoGlobal: ficha.processoGlobal,
                categoriaNome: categoria?.nome,
                observacoes: ficha.observacoes,
                incluirGraficos: incluirGraficosPdf,
            });
            if (ok) {
                toast.success("Laudo PDF baixado.");
            }
        } catch {
            toast.error("Não foi possível gerar o arquivo PDF agora.");
        }
    };

    return (
        <div className="space-y-7" aria-live="polite">
            {/* Barra de ações: salvar, PDF, renovar e CSV */}
            <div className="sheet-on-paper flex flex-wrap items-center justify-between gap-4 border border-ink/20 px-5 py-4">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {calculoAtivoId ? (
                            <span className="inline-flex items-center gap-1.5 bg-[#126A35]/10 px-2 py-0.5 text-xs font-semibold text-[#126A35]">
                                <BookmarkCheck className="size-3.5" />
                                Salvo no histórico
                            </span>
                        ) : (
                            <span className="bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Rascunho não salvo
                            </span>
                        )}
                        {ficha.clienteNome.trim() && (
                            <span className="text-sm font-bold text-ink">{ficha.clienteNome.trim()}</span>
                        )}
                        {categoria && <SeloCategoria categoria={categoria} />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Atualização até {resultado.parametros.dataBaseAtualizacao.split("-").reverse().join("/")} ·{" "}
                        {resultado.contratos.length}{" "}
                        {resultado.contratos.length === 1 ? "contrato" : "contratos"}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={baixarPdf}
                        className="inline-flex min-h-9 items-center gap-1.5 border border-gold bg-gold-light px-3.5 text-xs font-bold text-ink hover:bg-paper-white"
                    >
                        <FileDown className="size-3.5" />
                        Laudo PDF
                    </button>

                    <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 border border-ink/20 bg-background/60 px-2.5 text-xs font-medium text-ink select-none">
                        <input
                            type="checkbox"
                            checked={incluirGraficosPdf}
                            onChange={(e) => setIncluirGraficosPdf(e.target.checked)}
                            className="accent-ink"
                        />
                        Gráficos
                    </label>

                    <button
                        type="button"
                        onClick={() =>
                            baixarCsvDemonstrativo(resultado, {
                                clienteNome: ficha.clienteNome || "cliente",
                                processoGlobal: ficha.processoGlobal,
                            })
                        }
                        className="inline-flex min-h-9 items-center gap-1.5 border border-ink/30 px-2.5 text-xs font-semibold text-ink hover:bg-ink/5"
                    >
                        <FileSpreadsheet className="size-3.5" />
                        CSV
                    </button>

                    {onRenovarHoje && (calculoAtivoId || resultado.parametros.dataBaseAtualizacao !== hojeISO()) && (
                        <button
                            type="button"
                            disabled={renovando || salvando}
                            onClick={onRenovarHoje}
                            title="Atualiza a data-base para hoje, consulta os índices recentes do BACEN, recalcula, salva e gera o novo PDF"
                            className="inline-flex min-h-9 items-center gap-1.5 border border-ink/35 bg-secondary px-3 text-xs font-semibold text-ink hover:bg-ink hover:text-paper disabled:opacity-60"
                        >
                            {renovando ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                            Renovar p/ hoje
                        </button>
                    )}

                    {calculoAtivoId ? (
                        <>
                            <button
                                type="button"
                                disabled={salvando}
                                onClick={() => onSalvar(false)}
                                className="inline-flex min-h-9 items-center gap-1.5 bg-ink px-3.5 text-xs font-semibold text-paper hover:bg-ink-soft disabled:opacity-70"
                            >
                                {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                                Atualizar salvo
                            </button>
                            <button
                                type="button"
                                disabled={salvando}
                                onClick={() => onSalvar(true)}
                                className="inline-flex min-h-9 items-center gap-1.5 border border-ink/30 px-2.5 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-70"
                            >
                                <CopyPlus className="size-3.5" />
                                Salvar novo
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            disabled={salvando}
                            onClick={() => onSalvar(true)}
                            className="inline-flex min-h-9 items-center gap-1.5 bg-ink px-3.5 text-xs font-semibold text-paper hover:bg-ink-soft disabled:opacity-70"
                        >
                            {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                            Salvar no histórico
                        </button>
                    )}
                </div>
            </div>

            {/* Faixa de 3 KPIs em destaque */}
            <div className="grid gap-4 sm:grid-cols-3 tabular-nums">
                <div className="border border-gold bg-gold-light/25 p-5">
                    <span className="rubric text-gold-deep">Proveito Econômico Total</span>
                    <p className="display mt-2 text-[1.75rem] text-ink">{brl(r.valorTotalAcao)}</p>
                    <p className="mt-1.5 text-xs text-ink/75">
                        Soma de restituição + economia futura
                    </p>
                </div>

                <div className="sheet-on-paper border border-ink/20 p-5">
                    <span className="rubric text-muted-foreground">Líquido a Restituir</span>
                    <p className="subdisplay mt-2 text-[1.5rem] text-ink">{brl(r.totalRestituicaoAtualizado)}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                        Pagas + tarifas{r.deducoesAtualizado > 0 ? " − deduções" : ""}
                    </p>
                </div>

                <div className="sheet-on-paper border border-ink/20 p-5">
                    {r.economiaVincendasTotal > 0 ? (
                        <>
                            <span className="rubric text-muted-foreground">Economia nas Vincendas</span>
                            <p className="subdisplay mt-2 text-[1.5rem] text-ink">
                                {brl(r.economiaVincendasTotal)}
                            </p>
                            <p className="mt-1.5 text-xs text-muted-foreground">
                                Taxa {num(contratoAtual?.analise.razaoAm ?? 1, 2)}x paradigma BACEN
                            </p>
                        </>
                    ) : (
                        <>
                            <span className="rubric text-muted-foreground">Grau vs. Paradigma</span>
                            <div className="mt-2 flex items-baseline justify-between gap-2">
                                <p className="subdisplay text-[1.5rem] text-ink">
                                    {num(contratoAtual?.analise.razaoAm ?? 1, 2)}x
                                </p>
                                {contratoAtual && <Selo n={contratoAtual.nivel} />}
                            </div>
                            <p className="mt-1.5 text-xs text-muted-foreground">
                                {contratoAtual
                                    ? `${num(contratoAtual.analise.contratoAm)}% vs ${num(contratoAtual.taxaRevisionalAm)}% a.m.`
                                    : "Comparativo mensal"}
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* Quadro Resumo Global do Laudo */}
            <section className="sheet-on-paper border border-ink/25">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-ink px-5 py-3 text-paper">
                    <h2 className="rubric text-gold-light">Composição Analítica do Laudo</h2>
                    <span className="text-xs text-paper/75">
                        {resultado.contratos.length}{" "}
                        {resultado.contratos.length === 1 ? "contrato" : "contratos"} · atualização até{" "}
                        {resultado.parametros.dataBaseAtualizacao.split("-").reverse().join("/")}
                    </span>
                </div>

                <dl className="divide-y divide-ink/15 px-5 text-sm tabular-nums">
                    <div className="flex items-center justify-between gap-4 py-3">
                        <dt className="text-muted-foreground">
                            Diferenças nas parcelas pagas (atualizadas)
                            {resultado.parametros.restituicaoDobroParcelas ? " · Art. 42 CDC (dobro)" : ""}
                        </dt>
                        <dd className="font-semibold text-ink">{brl(r.principalContratosAtualizado)}</dd>
                    </div>
                    {r.extrasAtualizado > 0 && (
                        <div className="flex items-center justify-between gap-4 py-3">
                            <dt className="text-muted-foreground">Pagamentos extras / antecipações</dt>
                            <dd className="font-semibold text-ink">{brl(r.extrasAtualizado)}</dd>
                        </div>
                    )}
                    {r.tarifasAtualizado > 0 && (
                        <div className="flex items-center justify-between gap-4 py-3">
                            <dt className="text-muted-foreground">Seguros prestamistas e tarifas abusivas</dt>
                            <dd className="font-semibold text-ink">{brl(r.tarifasAtualizado)}</dd>
                        </div>
                    )}
                    {r.deducoesAtualizado > 0 && (
                        <div className="flex items-center justify-between gap-4 py-3">
                            <dt className="text-muted-foreground">(-) Deduções / Alvarás abatidos</dt>
                            <dd className="font-semibold text-destructive">- {brl(r.deducoesAtualizado)}</dd>
                        </div>
                    )}
                    {r.valorMultaGlobal > 0 && (
                        <div className="flex items-center justify-between gap-4 py-3">
                            <dt className="text-muted-foreground">
                                Multa global ({num(resultado.parametros.multaGlobalPercentual)}%)
                            </dt>
                            <dd className="font-semibold text-ink">{brl(r.valorMultaGlobal)}</dd>
                        </div>
                    )}
                    {r.valorHonorarios > 0 && (
                        <div className="flex items-center justify-between gap-4 py-3">
                            <dt className="text-muted-foreground">
                                Honorários ({num(resultado.parametros.honorariosPercentual)}%)
                            </dt>
                            <dd className="font-semibold text-ink">{brl(r.valorHonorarios)}</dd>
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-4 py-3">
                        <dt className="font-medium text-ink">Total líquido a restituir / compensar</dt>
                        <dd className="font-bold text-ink">{brl(r.totalRestituicaoAtualizado)}</dd>
                    </div>
                    {r.economiaVincendasTotal > 0 && (
                        <div className="flex items-center justify-between gap-4 py-3">
                            <dt className="text-muted-foreground">Economia nas parcelas vincendas</dt>
                            <dd className="font-semibold text-ink">{brl(r.economiaVincendasTotal)}</dd>
                        </div>
                    )}
                    <div className="flex flex-wrap items-baseline justify-between gap-4 bg-gold-light/30 px-5 py-4 -mx-5">
                        <dt className="subdisplay text-base text-ink">PROVEITO ECONÔMICO / VALOR DA AÇÃO</dt>
                        <dd className="display text-[1.75rem] text-ink">{brl(r.valorTotalAcao)}</dd>
                    </div>
                </dl>
            </section>

            {/* Alternância entre Demonstrativo/Tabelas e Gráficos Periciais */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/25 pb-2">
                <div className="inline-flex border border-ink/25 bg-card">
                    <button
                        type="button"
                        onClick={() => setVisaoResultado("demonstrativo")}
                        className={cn(
                            "inline-flex min-h-10 items-center gap-2 px-4 text-xs font-semibold transition-colors",
                            visaoResultado === "demonstrativo"
                                ? "bg-ink text-paper"
                                : "text-ink hover:bg-ink/5",
                        )}
                    >
                        <Table2 className="size-3.5" />
                        Demonstrativo e Tabelas
                    </button>
                    <button
                        type="button"
                        onClick={() => setVisaoResultado("graficos")}
                        className={cn(
                            "inline-flex min-h-10 items-center gap-2 border-l border-ink/25 px-4 text-xs font-semibold transition-colors",
                            visaoResultado === "graficos"
                                ? "bg-ink text-paper"
                                : "text-ink hover:bg-ink/5",
                        )}
                    >
                        <BarChart3 className="size-3.5" />
                        Gráficos Periciais (4)
                    </button>
                </div>

                {resultado.contratos.length > 1 && (
                    <div className="flex flex-wrap gap-1">
                        {resultado.contratos.map((rc, idx) => (
                            <button
                                key={rc.contrato.id}
                                type="button"
                                onClick={() => setContratoAtivoIdx(idx)}
                                className={cn(
                                    "border border-ink/25 px-3 py-1.5 text-xs font-semibold transition-colors",
                                    safeIdx === idx ? "bg-ink text-paper" : "bg-card text-ink hover:bg-ink/5",
                                )}
                            >
                                {rc.contrato.descricao || `Contrato ${idx + 1}`}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {contratoAtual &&
                (visaoResultado === "graficos" ? (
                    <PainelGraficosCaso rc={contratoAtual} resultado={resultado} />
                ) : (
                    <BlocoContratoResultado
                        rc={contratoAtual}
                        emDobro={resultado.parametros.restituicaoDobroParcelas}
                    />
                ))}

            {resultado.tarifas.length > 0 && (
                <section className="overflow-x-auto border border-ink/25 bg-card p-5">
                    <h3 className="font-semibold text-ink">Seguros Prestamistas e Tarifas Abusivas</h3>
                    <table className="mt-3 w-full min-w-[34rem] text-xs tabular-nums">
                        <thead>
                            <tr className="border-b border-ink/20 text-muted-foreground">
                                <th className="py-2 text-left">Descrição</th>
                                <th className="py-2 text-left">Data</th>
                                <th className="py-2 text-left">Tipo</th>
                                <th className="py-2 text-right">Original</th>
                                <th className="py-2 text-right">Correção</th>
                                <th className="py-2 text-right">Juros</th>
                                <th className="py-2 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ink/10">
                            {resultado.tarifas.map((t) => (
                                <tr key={t.item.id}>
                                    <td className="py-2 font-medium text-ink">{t.titulo}</td>
                                    <td className="py-2">{t.item.dataCobranca.split("-").reverse().join("/")}</td>
                                    <td className="py-2">{t.item.emDobro ? "Dobro (Art. 42)" : "Simples"}</td>
                                    <td className="py-2 text-right">{brl(t.valorOriginal)}</td>
                                    <td className="py-2 text-right">{brl(t.correcao)}</td>
                                    <td className="py-2 text-right">{brl(t.juros)}</td>
                                    <td className="py-2 text-right font-semibold text-ink">{brl(t.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {resultado.deducoes.length > 0 && (
                <section className="overflow-x-auto border border-ink/25 bg-card p-5">
                    <h3 className="font-semibold text-ink">Valores a Deduzir (Pagamentos / Alvarás)</h3>
                    <table className="mt-3 w-full text-xs tabular-nums">
                        <thead>
                            <tr className="border-b border-ink/20 text-muted-foreground">
                                <th className="py-2 text-left">Descrição</th>
                                <th className="py-2 text-left">Data</th>
                                <th className="py-2 text-right">Base</th>
                                <th className="py-2 text-right">Correção + Juros</th>
                                <th className="py-2 text-right">Total Deduzido</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ink/10">
                            {resultado.deducoes.map((d) => (
                                <tr key={d.item.id}>
                                    <td className="py-2 font-medium text-ink">{d.item.descricao || "Alvará"}</td>
                                    <td className="py-2">{d.item.data.split("-").reverse().join("/")}</td>
                                    <td className="py-2 text-right">{brl(d.valorBase)}</td>
                                    <td className="py-2 text-right">{brl(d.correcao + d.juros)}</td>
                                    <td className="py-2 text-right font-semibold text-destructive">-{brl(d.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

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
        </div>
    );
};

type AbaAtiva = "calculadora" | "painel" | "historico" | "processos" | "categorias";

const BASE_ROTA = "/ferramentas/calculadora-revisional";

const CalculadoraAdvogado = () => {
    const reduce = useReducedMotion();
    const location = useLocation();
    const navigate = useNavigate();

    const subRota = location.pathname.startsWith(BASE_ROTA)
        ? location.pathname.slice(BASE_ROTA.length).replace(/^\/+|\/+$/g, "")
        : "";
    const aba: AbaAtiva =
        subRota === "painel"
            ? "painel"
            : subRota === "historico"
              ? "historico"
              : subRota === "processos" || subRota.startsWith("processos/")
                ? "processos"
                : subRota === "categorias"
                  ? "categorias"
                  : "calculadora";
    const rotaCasoId = subRota.startsWith("caso/") ? decodeURIComponent(subRota.slice(5)) : null;
    const rotaProcessoId = subRota.startsWith("processos/")
        ? decodeURIComponent(subRota.slice("processos/".length))
        : null;
    const origemHistorico = (location.state as { origemHistorico?: string } | null)?.origemHistorico ?? null;

    // Sessão e carregamento inicial
    const [verificandoSessao, setVerificandoSessao] = useState(true);
    const [sessao, setSessao] = useState<RevisionalSession | null>(null);
    const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
    const [senhaObrigatoria, setSenhaObrigatoria] = useState(false);

    // Dados do banco
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [calculos, setCalculos] = useState<CalculoSalvo[]>([]);
    const [carregandoBanco, setCarregandoBanco] = useState(false);

    // Ficha do caso
    const [formInstanceKey, setFormInstanceKey] = useState(1);
    const [calculoAtivoId, setCalculoAtivoId] = useState<string | null>(null);
    const [ficha, setFicha] = useState<FichaCliente>(FICHA_VAZIA);
    const [criandoCatRapida, setCriandoCatRapida] = useState(false);
    const [nomeCatRapida, setNomeCatRapida] = useState("");
    const [salvandoCalculo, setSalvandoCalculo] = useState(false);
    const [salvandoFicha, setSalvandoFicha] = useState(false);
    const [renovandoCaso, setRenovandoCaso] = useState(false);

    // Estado completo do processo pericial
    const [contratosForm, setContratosForm] = useState<ContratoFormState[]>(() => [criarContratoFormEmBranco(1)]);
    const [parametros, setParametros] = useState<ParametrosDecisao>(() => PARAMETROS_DECISAO_PADRAO());
    const [tarifas, setTarifas] = useState<TarifaItem[]>([]);
    const [deducoes, setDeducoes] = useState<DeducaoItem[]>([]);

    // Modal Olinda e Modal DJEN
    const [olindaAlvoIdx, setOlindaAlvoIdx] = useState<number | null>(null);
    const [djenContexto, setDjenContexto] = useState<ContextoInicialDjen | null>(null);
    const [verificandoDjen, setVerificandoDjen] = useState(false);
    const verificandoDjenRef = useRef(false);
    const calculosRef = useRef<CalculoSalvo[]>([]);

    const [erro, setErro] = useState<string | null>(null);
    const [carregando, setCarregando] = useState(false);
    const [res, setRes] = useState<{
        resultado: ResultadoProcessoRevisional;
        input: ProcessoRevisionalInput;
    } | null>(null);

    const topoRes = useRef<HTMLDivElement>(null);
    const clienteInputRef = useRef<HTMLInputElement>(null);
    const casoSincronizadoRef = useRef<string | null>(null);

    const carregarDadosEscritorio = useCallback(async () => {
        setCarregandoBanco(true);
        try {
            const [cats, calcs] = await Promise.all([listarCategorias(), listarCalculos()]);
            setCategorias(cats);
            setCalculos(calcs);
        } catch (e) {
            if (e instanceof RevisionalApiError && e.status === 401) {
                setSessao(null);
            } else {
                toast.error(e instanceof Error ? e.message : "Erro ao carregar histórico.");
            }
        } finally {
            setCarregandoBanco(false);
        }
    }, []);

    useEffect(() => {
        calculosRef.current = calculos;
    }, [calculos]);

    /**
     * Consulta o DJEN para os processos salvos e anexa as publicações novas ao histórico de cada um.
     * Automática: só processos sem verificação há INTERVALO_VERIFICACAO_DJEN_HORAS. Manual: todos.
     */
    const verificarPublicacoesSalvas = useCallback(
        async (manual: boolean) => {
            if (verificandoDjenRef.current) return;
            verificandoDjenRef.current = true;
            setVerificandoDjen(true);
            try {
                if (manual) {
                    // Inclui processos salvos em outro computador desde o login.
                    const frescos = await listarCalculos();
                    calculosRef.current = frescos;
                    setCalculos(frescos);
                }

                const resultado = await verificarPublicacoesDjen({
                    calculos: calculosRef.current,
                    atualizar: atualizarCalculo,
                    obterAtual: (id) => calculosRef.current.find((c) => c.id === id),
                    intervaloHoras: manual ? 0 : INTERVALO_VERIFICACAO_DJEN_HORAS,
                });

                if (resultado.atualizados.length > 0) {
                    const porId = new Map(resultado.atualizados.map((c) => [c.id, c]));
                    setCalculos((prev) => prev.map((c) => porId.get(c.id) ?? c));
                }

                if (resultado.totalNovas > 0) {
                    const nomes = resultado.processosComNovidade.map((p) => p.clienteNome);
                    toast.success(
                        resultado.totalNovas === 1
                            ? "1 publicação nova no DJEN"
                            : `${resultado.totalNovas} publicações novas no DJEN`,
                        {
                            id: "djen-verificacao",
                            description: nomes.slice(0, 3).join(", ") + (nomes.length > 3 ? ` e mais ${nomes.length - 3}` : ""),
                            action: {
                                label: "Ver processos",
                                onClick: () => navigate(`${BASE_ROTA}/processos`),
                            },
                        },
                    );
                } else if (manual) {
                    toast.info(
                        resultado.verificados === 0
                            ? "Nenhum processo salvo com número CNJ para verificar."
                            : `Nenhuma publicação nova em ${resultado.verificados} ${resultado.verificados === 1 ? "processo verificado" : "processos verificados"}.`,
                        { id: "djen-verificacao" },
                    );
                }

                if (resultado.interrompidoPorLimite && manual) {
                    toast.warning(
                        `A API do DJEN limitou as consultas; ${resultado.adiados} ${resultado.adiados === 1 ? "processo fica" : "processos ficam"} para a próxima verificação.`,
                    );
                }
                if (resultado.erros.length > 0 && manual) {
                    toast.error(
                        `${resultado.erros.length} ${resultado.erros.length === 1 ? "processo não pôde ser verificado" : "processos não puderam ser verificados"}: ${resultado.erros[0].mensagem}`,
                    );
                }
            } catch (e) {
                if (e instanceof RevisionalApiError && e.status === 401) {
                    setSessao(null);
                } else if (manual) {
                    toast.error(e instanceof Error ? e.message : "Não foi possível verificar o DJEN agora.");
                }
            } finally {
                verificandoDjenRef.current = false;
                setVerificandoDjen(false);
            }
        },
        [navigate],
    );

    // Enquanto o sistema estiver aberto, confere a cada 15 min se algum processo passou do intervalo
    // de verificação; sem processos vencidos, nenhuma consulta é feita. O cron diário cobre o resto.
    useEffect(() => {
        if (!sessao) return;
        const primeira = window.setTimeout(() => void verificarPublicacoesSalvas(false), 15_000);
        const periodica = window.setInterval(() => void verificarPublicacoesSalvas(false), 15 * 60_000);
        return () => {
            window.clearTimeout(primeira);
            window.clearInterval(periodica);
        };
    }, [sessao, verificarPublicacoesSalvas]);

    useEffect(() => {
        let ativo = true;
        (async () => {
            try {
                const viaHash = await consumirHashRecuperacao();
                if (!ativo) return;
                if (viaHash) {
                    setSessao(viaHash.session);
                    if (viaHash.recovery) {
                        setSenhaObrigatoria(true);
                        setModalSenhaAberto(true);
                    }
                    return;
                }
                const existente = await obterSessaoAtiva();
                if (ativo) setSessao(existente);
            } finally {
                if (ativo) setVerificandoSessao(false);
            }
        })();
        return () => {
            ativo = false;
        };
    }, []);

    useEffect(() => {
        if (sessao) {
            carregarDadosEscritorio();
        }
    }, [sessao, carregarDadosEscritorio]);

    const { calculosCarteira, processosSalvos } = useMemo(() => {
        const carteira: CalculoSalvo[] = [];
        const processos: CalculoSalvo[] = [];
        for (const c of calculos) {
            if (isCalculoPendente(c)) {
                processos.push(c);
            } else {
                carteira.push(c);
            }
        }
        return { calculosCarteira: carteira, processosSalvos: processos };
    }, [calculos]);

    const contagemPorCategoria = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const c of calculos) {
            if (c.categoria_id) {
                counts[c.categoria_id] = (counts[c.categoria_id] ?? 0) + 1;
            }
        }
        return counts;
    }, [calculos]);

    const categoriaSelecionada = useMemo(
        () => categorias.find((c) => c.id === ficha.categoriaId) ?? null,
        [categorias, ficha.categoriaId],
    );

    const limparCamposEmMemoria = useCallback(() => {
        casoSincronizadoRef.current = null;
        setFormInstanceKey((k) => k + 1);
        setCalculoAtivoId(null);
        setFicha(FICHA_VAZIA);
        setContratosForm([criarContratoFormEmBranco(1)]);
        setParametros(PARAMETROS_DECISAO_PADRAO());
        setTarifas([]);
        setDeducoes([]);
        setErro(null);
        setRes(null);
    }, []);

    const limparFormulario = () => {
        limparCamposEmMemoria();
        if (location.pathname !== BASE_ROTA) {
            navigate(BASE_ROTA);
        }
    };

    const carregarCasoEmEstado = useCallback(async (c: CalculoSalvo, manterVinculo: boolean) => {
        const { ficha: fichaRest, processo } = calculoParaProcesso(c);
        casoSincronizadoRef.current = manterVinculo ? c.id : null;
        setFormInstanceKey((k) => k + 1);
        setCalculoAtivoId(manterVinculo ? c.id : null);
        setFicha(
            manterVinculo ? fichaRest : { ...fichaRest, clienteNome: `${fichaRest.clienteNome} (cópia)` },
        );
        setContratosForm(processo.contratos.map(contratoInputParaForm));
        setParametros(processo.parametros);
        setTarifas(processo.tarifas);
        setDeducoes(processo.deducoes);
        setErro(null);

        if (isCalculoPendente(c)) {
            setRes(null);
            return;
        }

        try {
            const { onlineByContrato, seriesEconomicas } = await prepararDadosBacenProcesso(processo);
            const resultado = calcularProcessoRevisional(processo, seriesEconomicas, onlineByContrato);
            setRes({ resultado, input: processo });
        } catch {
            setRes(null);
        }
    }, []);

    // Sincroniza URL /caso/:id ao recarregar a página ou usar voltar/avançar do navegador (gesto de 2 dedos no Mac)
    useEffect(() => {
        if (!rotaCasoId) {
            if (casoSincronizadoRef.current !== null) {
                limparCamposEmMemoria();
            }
            return;
        }
        if (casoSincronizadoRef.current === rotaCasoId) return;
        const encontrado = calculos.find((item) => item.id === rotaCasoId);
        if (encontrado) {
            void carregarCasoEmEstado(encontrado, true);
        }
    }, [rotaCasoId, calculos, carregarCasoEmEstado, limparCamposEmMemoria]);

    const abrirCasoDoHistorico = (c: CalculoSalvo) => {
        const origem = `${location.pathname}${location.search}`;
        void carregarCasoEmEstado(c, true);
        navigate(`${BASE_ROTA}/caso/${encodeURIComponent(c.id)}`, {
            state: { origemHistorico: origem },
        });
    };

    const abrirProcessoSalvo = (c: CalculoSalvo) => {
        navigate(`${BASE_ROTA}/processos/${encodeURIComponent(c.id)}`);
    };

    const duplicarCasoDoHistorico = (c: CalculoSalvo) => {
        const origem = `${location.pathname}${location.search}`;
        void carregarCasoEmEstado(c, false);
        navigate(BASE_ROTA, {
            state: { origemHistorico: origem },
        });
    };

    const voltarParaHistorico = () => {
        if (origemHistorico) {
            navigate(-1);
        } else {
            navigate(`${BASE_ROTA}/historico`);
        }
    };

    const calcular = async (ev: FormEvent) => {
        ev.preventDefault();
        const contratosInput = contratosForm.map(formParaContratoInput);

        for (let idx = 0; idx < contratosInput.length; idx++) {
            const ct = contratosInput[idx];
            const form = contratosForm[idx];
            const mod = MODALIDADES.find((m) => m.id === ct.modalidadeId);
            const mes = ct.dataContrato.slice(0, 7);
            const msg = validar({
                mod,
                mes,
                valor: ct.valorFinanciado,
                parcela: ct.valorParcela,
                parcelas: ct.parcelas,
                pagas: ct.pagas,
            });
            if (msg) {
                return setErro(`Contrato ${idx + 1}: ${msg}`);
            }
            for (const [txt, v, nome] of [
                [form.taxaM, ct.taxaMensal, "taxa mensal do contrato"],
                [form.taxaA, ct.taxaAnual, "taxa anual do contrato"],
                [form.revisionalM, ct.taxaRevisionalManualAm, "taxa revisional mensal"],
                [form.revisionalA, ct.taxaRevisionalManualAa, "taxa revisional anual"],
            ] as const) {
                if (txt && !(v !== undefined && v > 0)) {
                    return setErro(`Contrato ${idx + 1}: a ${nome} não é um número válido.`);
                }
            }
            if (ct.fonteTaxaRevisional === "banco_olinda" && !ct.bancoOlinda) {
                return setErro(`Contrato ${idx + 1}: selecione a instituição na tabela do BCB Olinda.`);
            }
            if (ct.fonteTaxaRevisional === "manual" && !(ct.taxaRevisionalManualAm || ct.taxaRevisionalManualAa)) {
                return setErro(`Contrato ${idx + 1}: informe a taxa revisional manual.`);
            }
        }

        const input: ProcessoRevisionalInput = {
            parametros,
            contratos: contratosInput,
            tarifas,
            deducoes,
        };

        setErro(null);
        setCarregando(true);
        try {
            const { onlineByContrato, seriesEconomicas } = await prepararDadosBacenProcesso(input);
            const resultado = calcularProcessoRevisional(input, seriesEconomicas, onlineByContrato);
            setRes({ resultado, input });
            if (window.matchMedia("(max-width: 1023px)").matches) {
                requestAnimationFrame(() =>
                    topoRes.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }),
                );
            }
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível concluir o cálculo agora.");
        } finally {
            setCarregando(false);
        }
    };

    const salvarNoBanco = async (comoNovo: boolean) => {
        if (!res) return;
        if (!ficha.clienteNome.trim()) {
            toast.error("Informe o nome do cliente para salvar no histórico.");
            clienteInputRef.current?.focus();
            clienteInputRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
            return;
        }

        setSalvandoCalculo(true);
        try {
            const existente =
                !comoNovo && calculoAtivoId ? calculos.find((item) => item.id === calculoAtivoId) : undefined;
            const payload = processoParaPayload(res.resultado, res.input, ficha, existente);
            if (!comoNovo && calculoAtivoId) {
                const atualizado = await atualizarCalculo(calculoAtivoId, payload);
                setCalculos((prev) => [atualizado, ...prev.filter((item) => item.id !== atualizado.id)]);
                toast.success(`Ficha de "${atualizado.cliente_nome}" atualizada.`);
            } else {
                const criado = await criarCalculo(payload);
                casoSincronizadoRef.current = criado.id;
                setCalculoAtivoId(criado.id);
                setCalculos((prev) => [criado, ...prev]);
                navigate(`${BASE_ROTA}/caso/${encodeURIComponent(criado.id)}`, { replace: true });
                toast.success(`Cálculo de "${criado.cliente_nome}" salvo no histórico.`);
            }
        } catch (e) {
            if (e instanceof RevisionalApiError && e.status === 401) {
                setSessao(null);
            }
            toast.error(e instanceof Error ? e.message : "Não foi possível salvar o cálculo.");
        } finally {
            setSalvandoCalculo(false);
        }
    };

    const salvarFichaSemCalculo = async () => {
        if (!ficha.clienteNome.trim()) {
            toast.error("Informe o nome do cliente para salvar na carteira.");
            clienteInputRef.current?.focus();
            clienteInputRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
            return;
        }

        setSalvandoFicha(true);
        try {
            const primeiro = contratosForm[0];
            const fichaCompleta: FichaCliente = {
                ...ficha,
                banco: ficha.banco.trim() || primeiro?.instituicao?.trim() || "",
                documentoContrato: ficha.documentoContrato.trim() || primeiro?.numeroContrato?.trim() || "",
            };
            const existente = calculoAtivoId
                ? calculos.find((item) => item.id === calculoAtivoId) ?? null
                : null;
            const origemDjenExistente = (
                existente?.dados_completos as { origemDjen?: Record<string, unknown> } | undefined
            )?.origemDjen;

            const payload = fichaSemCalculoParaPayload(fichaCompleta, {
                modalidadeId: primeiro?.modalidadeId,
                mesContrato: primeiro?.dataContrato?.slice(0, 7),
                origemDjen: origemDjenExistente,
                // Mantém o valor da causa citado na publicação do DJEN ao regravar a ficha pendente.
                valorEstimadoAcao:
                    existente && isCalculoPendente(existente)
                        ? Number(existente.valor_total_acao) || undefined
                        : undefined,
            });

            if (existente && isCalculoPendente(existente)) {
                const atualizado = await atualizarCalculo(existente.id, payload);
                setCalculos((prev) => [atualizado, ...prev.filter((item) => item.id !== atualizado.id)]);
                toast.success(`Ficha de "${atualizado.cliente_nome}" atualizada em Processos.`);
            } else if (existente) {
                const atualizado = await atualizarCalculo(existente.id, {
                    categoria_id: fichaCompleta.categoriaId || null,
                    cliente_nome: payload.cliente_nome,
                    processo_global: payload.processo_global,
                    banco: payload.banco,
                    documento_contrato: payload.documento_contrato,
                    observacoes: payload.observacoes,
                });
                setCalculos((prev) => [atualizado, ...prev.filter((item) => item.id !== atualizado.id)]);
                toast.success(`Ficha de "${atualizado.cliente_nome}" atualizada na carteira.`);
            } else {
                const criado = await criarCalculo(payload);
                casoSincronizadoRef.current = criado.id;
                setCalculoAtivoId(criado.id);
                setCalculos((prev) => [criado, ...prev]);
                navigate(`${BASE_ROTA}/caso/${encodeURIComponent(criado.id)}`, { replace: true });
                toast.success(`Ficha de "${criado.cliente_nome}" salva em Processos (aguardando contrato).`);
            }
        } catch (e) {
            if (e instanceof RevisionalApiError && e.status === 401) {
                setSessao(null);
            }
            toast.error(e instanceof Error ? e.message : "Não foi possível salvar a ficha.");
        } finally {
            setSalvandoFicha(false);
        }
    };

    const salvarPublicacaoDjenNaCarteira = async (item: DjenComunicacao) => {
        try {
            const existingByCnj = item.numeroProcessoDigitos
                ? calculos.find(
                      (c) =>
                          normalizarNumeroProcessoDjen(c.processo_global || "") ===
                          item.numeroProcessoDigitos,
                  )
                : undefined;

            if (existingByCnj) {
                if (isCalculoPendente(existingByCnj)) {
                    const patch = anexarMovimentacaoDjenAoProcesso(existingByCnj, item);
                    const atualizado = await atualizarCalculo(existingByCnj.id, patch);
                    setCalculos((prev) => [
                        atualizado,
                        ...prev.filter((row) => row.id !== atualizado.id),
                    ]);
                    toast.success(`Publicação anexada ao processo de "${atualizado.cliente_nome}".`, {
                        id: "djen-carteira-save",
                        action: {
                            label: "Ver Processo",
                            onClick: () => {
                                setDjenContexto(null);
                                navigate(`${BASE_ROTA}/processos/${encodeURIComponent(atualizado.id)}`);
                            },
                        },
                    });
                    return;
                }

                const obsResumo =
                    item.texto.length > 420 ? `${item.texto.slice(0, 420).trim()}...` : item.texto;
                await vincularDjenAoCaso({
                    calculoId: existingByCnj.id,
                    processoGlobal: item.numeroProcessoMascara,
                    observacaoAdicional: `[DJEN ${item.dataDisponibilizacaoBr} · ${item.siglaTribunal} · ${item.nomeOrgao}]: ${obsResumo}`,
                    comunicacao: item,
                });
                toast.success(`Publicação vinculada ao caso existente de "${existingByCnj.cliente_nome}".`, {
                    id: "djen-carteira-save",
                });
                return;
            }

            const payload = criarPayloadCarteiraDeDjen(item, categorias);
            const criado = await criarCalculo(payload);
            setCalculos((prev) => [criado, ...prev]);
            toast.success(`Processo de "${criado.cliente_nome}" salvo em Processos.`, {
                id: "djen-carteira-save",
                action: {
                    label: "Ver Processo",
                    onClick: () => {
                        setDjenContexto(null);
                        navigate(`${BASE_ROTA}/processos/${encodeURIComponent(criado.id)}`);
                    },
                },
            });
        } catch (e) {
            if (e instanceof RevisionalApiError && e.status === 401) {
                setSessao(null);
            }
            throw e;
        }
    };

    const criarCategoriaInline = async () => {
        if (!nomeCatRapida.trim()) return;
        try {
            const maxOrdem = categorias.reduce((acc, c) => Math.max(acc, c.ordem), 0);
            const nova = await criarCategoria(nomeCatRapida.trim(), "gold", maxOrdem + 1);
            setCategorias((prev) => [...prev, nova]);
            setFicha((f) => ({ ...f, categoriaId: nova.id }));
            setNomeCatRapida("");
            setCriandoCatRapida(false);
            toast.success(`Categoria "${nova.nome}" criada.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao criar categoria.");
        }
    };

    const encerrarSessao = async () => {
        await sairDaSessao();
        setSessao(null);
        setCalculos([]);
        limparFormulario();
    };

    const renovarCasoNaCalculadora = async () => {
        const dataHoje = hojeISO();
        const contratosInput = contratosForm.map(formParaContratoInput);
        const novosParametros: ParametrosDecisao = {
            ...parametros,
            dataBaseAtualizacao: dataHoje,
        };
        const inputAtualizado: ProcessoRevisionalInput = {
            parametros: novosParametros,
            contratos: contratosInput,
            tarifas,
            deducoes,
        };

        setRenovandoCaso(true);
        setErro(null);
        try {
            const valorAnterior = res?.resultado.resumo.valorTotalAcao ?? 0;
            const { onlineByContrato, seriesEconomicas } = await prepararDadosBacenProcesso(inputAtualizado);
            const novoResultado = calcularProcessoRevisional(inputAtualizado, seriesEconomicas, onlineByContrato);

            setFormInstanceKey((k) => k + 1);
            setParametros(novosParametros);
            setRes({ resultado: novoResultado, input: inputAtualizado });

            if (calculoAtivoId && ficha.clienteNome.trim()) {
                const existente = calculos.find((item) => item.id === calculoAtivoId);
                const payload = processoParaPayload(novoResultado, inputAtualizado, ficha, existente);
                const atualizado = await atualizarCalculo(calculoAtivoId, payload);
                setCalculos((prev) => [atualizado, ...prev.filter((item) => item.id !== atualizado.id)]);
            }

            const catAtual = categorias.find((c) => c.id === ficha.categoriaId) ?? null;
            baixarLaudoPdf(novoResultado, {
                clienteNome: ficha.clienteNome || "Cliente",
                processoGlobal: ficha.processoGlobal,
                categoriaNome: catAtual?.nome,
                observacoes: ficha.observacoes,
                incluirGraficos: true,
            });

            const valorNovo = novoResultado.resumo.valorTotalAcao;
            toast.success(
                valorAnterior > 0
                    ? `Cálculo renovado para hoje: ${brl(valorAnterior)} → ${brl(valorNovo)} (PDF atualizado).`
                    : `Cálculo atualizado para hoje (${brl(valorNovo)}) e PDF baixado.`,
            );
        } catch (e) {
            if (e instanceof RevisionalApiError && e.status === 401) {
                setSessao(null);
            }
            toast.error(e instanceof Error ? e.message : "Não foi possível renovar o cálculo agora.");
        } finally {
            setRenovandoCaso(false);
        }
    };

    const aplicarResultadoClaude = async (
        extracao: ClaudeExtracaoRevisional,
        opcoes: { salvarAutomaticamente: boolean; fonte: "claude_api" | "parser_local" },
    ) => {
        const contratosAtuaisInput = contratosForm.map(formParaContratoInput);
        const {
            ficha: nextFichaBase,
            processo: nextProcesso,
            categoriaSugeridaNome,
        } = aplicarExtracaoClaudeAoEstado(extracao, {
            ficha,
            processo: {
                parametros,
                contratos: contratosAtuaisInput,
                tarifas,
                deducoes,
            },
            categorias,
        });

        const nextFicha = { ...nextFichaBase };
        if (categoriaSugeridaNome) {
            try {
                const maxOrdem = categorias.reduce((acc, c) => Math.max(acc, c.ordem), 0);
                const novaCat = await criarCategoria(categoriaSugeridaNome, "gold", maxOrdem + 1);
                setCategorias((prev) => [...prev, novaCat]);
                nextFicha.categoriaId = novaCat.id;
            } catch {
                /* mantém sem categoria se falhar */
            }
        }

        const virouNovoCaso = extracao.modoOperacao === "novo_caso";
        if (virouNovoCaso && calculoAtivoId) {
            casoSincronizadoRef.current = null;
            setCalculoAtivoId(null);
        }

        setFormInstanceKey((k) => k + 1);
        setFicha(nextFicha);
        setContratosForm(nextProcesso.contratos.map(contratoInputParaForm));
        setParametros(nextProcesso.parametros);
        setTarifas(nextProcesso.tarifas);
        setDeducoes(nextProcesso.deducoes);
        setErro(null);

        const primeiro = nextProcesso.contratos[0];
        const mod = primeiro ? MODALIDADES.find((m) => m.id === primeiro.modalidadeId) : undefined;
        const msgVal = primeiro
            ? validar({
                  mod,
                  mes: primeiro.dataContrato.slice(0, 7),
                  valor: primeiro.valorFinanciado,
                  parcela: primeiro.valorParcela,
                  parcelas: primeiro.parcelas,
                  pagas: primeiro.pagas,
              })
            : "Contrato não informado.";

        if (msgVal) {
            setRes(null);
            toast.info(
                `Campos preenchidos pelo Claude (${opcoes.fonte === "claude_api" ? "API" : "comando"}). ${msgVal}`,
            );
            return;
        }

        setCarregando(true);
        try {
            const { onlineByContrato, seriesEconomicas } = await prepararDadosBacenProcesso(nextProcesso);
            const resultado = calcularProcessoRevisional(nextProcesso, seriesEconomicas, onlineByContrato);
            setRes({ resultado, input: nextProcesso });

            if (opcoes.salvarAutomaticamente && nextFicha.clienteNome.trim()) {
                const existente =
                    !virouNovoCaso && calculoAtivoId
                        ? calculos.find((item) => item.id === calculoAtivoId)
                        : undefined;
                const payload = processoParaPayload(resultado, nextProcesso, nextFicha, existente);
                if (!virouNovoCaso && calculoAtivoId) {
                    const atualizado = await atualizarCalculo(calculoAtivoId, payload);
                    setCalculos((prev) => [atualizado, ...prev.filter((item) => item.id !== atualizado.id)]);
                    toast.success(`Caso de "${atualizado.cliente_nome}" atualizado com Claude e salvo.`);
                } else {
                    const criado = await criarCalculo(payload);
                    casoSincronizadoRef.current = criado.id;
                    setCalculoAtivoId(criado.id);
                    setCalculos((prev) => [criado, ...prev]);
                    navigate(`${BASE_ROTA}/caso/${encodeURIComponent(criado.id)}`, { replace: true });
                    toast.success(`Contrato de "${criado.cliente_nome}" calculado com Claude e salvo.`);
                }
            } else {
                toast.success("Contrato preenchido e cálculo concluído com Claude.");
            }
        } catch (e) {
            if (e instanceof RevisionalApiError && e.status === 401) {
                setSessao(null);
            }
            const msg = e instanceof Error ? e.message : "Não foi possível calcular após preencher.";
            setErro(msg);
            toast.error(msg);
        } finally {
            setCarregando(false);
        }
    };

    const olindaContratoAtual = olindaAlvoIdx !== null ? contratosForm[olindaAlvoIdx] : null;

    const aplicarTaxaOlinda = (sel: TaxaOlindaSelecao) => {
        if (olindaAlvoIdx === null) return;
        setContratosForm((prev) =>
            prev.map((ct, i) =>
                i === olindaAlvoIdx
                    ? {
                          ...ct,
                          instituicao: ct.instituicao.trim() ? ct.instituicao : sel.instituicao,
                          fonteTaxaRevisional: "banco_olinda",
                          bancoOlinda: sel,
                      }
                    : ct,
            ),
        );
    };

    const preencherBancoOlinda = (nomeBanco: string) => {
        if (olindaAlvoIdx === null) return;
        setContratosForm((prev) =>
            prev.map((ct, i) => (i === olindaAlvoIdx ? { ...ct, instituicao: nomeBanco } : ct)),
        );
    };

    const vincularDjenAoCaso = async (opts: {
        calculoId: string | null;
        processoGlobal?: string;
        observacaoAdicional?: string;
        comunicacao?: DjenComunicacao;
    }) => {
        const alvoId = opts.calculoId;
        const procNovo = opts.processoGlobal?.trim();
        const obsAdd = opts.observacaoAdicional?.trim();

        if (alvoId) {
            const existente = calculos.find((c) => c.id === alvoId);
            if (existente && isCalculoPendente(existente) && opts.comunicacao) {
                const patch = anexarMovimentacaoDjenAoProcesso(existente, opts.comunicacao);
                const atualizado = await atualizarCalculo(alvoId, patch);
                setCalculos((prev) => prev.map((item) => (item.id === atualizado.id ? atualizado : item)));
            } else if (existente) {
                const obsAtual = existente.observacoes?.trim() ?? "";
                const obsFinal = obsAdd
                    ? obsAtual
                        ? obsAtual.includes(obsAdd)
                            ? obsAtual
                            : `${obsAtual}\n${obsAdd}`
                        : obsAdd
                    : obsAtual;
                const patch: { processo_global?: string; observacoes?: string } = {};
                if (procNovo && !existente.processo_global?.trim()) {
                    patch.processo_global = procNovo;
                }
                if (obsAdd) {
                    patch.observacoes = obsFinal;
                }
                const atualizado = await atualizarCalculo(alvoId, patch);
                setCalculos((prev) => prev.map((item) => (item.id === atualizado.id ? atualizado : item)));
            }
        }

        if (!alvoId || alvoId === calculoAtivoId) {
            setFicha((prev) => {
                const obsAtual = prev.observacoes.trim();
                const obsFinal = obsAdd
                    ? obsAtual
                        ? obsAtual.includes(obsAdd)
                            ? obsAtual
                            : `${obsAtual}\n${obsAdd}`
                        : obsAdd
                    : obsAtual;
                return {
                    ...prev,
                    processoGlobal: procNovo && !prev.processoGlobal?.trim() ? procNovo : prev.processoGlobal,
                    observacoes: obsFinal,
                };
            });
        }
    };

    const usarPublicacaoDjenNaCalculadora = (dados: {
        clienteNome: string;
        processoGlobal: string;
        banco: string;
        documentoContrato?: string;
        categoriaId?: string | null;
        modalidadeId?: string;
        observacao?: string;
    }) => {
        limparCamposEmMemoria();
        setFicha({
            ...FICHA_VAZIA,
            clienteNome: dados.clienteNome,
            processoGlobal: dados.processoGlobal,
            banco: dados.banco,
            documentoContrato: dados.documentoContrato ?? "",
            categoriaId: dados.categoriaId ?? null,
            observacoes: dados.observacao ?? "",
        });
        const modMatch = dados.modalidadeId
            ? MODALIDADES.find((m) => m.id === dados.modalidadeId)
            : undefined;
        if (dados.banco || dados.documentoContrato || modMatch) {
            setContratosForm((prev) =>
                prev.map((ct, idx) =>
                    idx === 0
                        ? {
                              ...ct,
                              instituicao: dados.banco || ct.instituicao,
                              numeroContrato: dados.documentoContrato || ct.numeroContrato,
                              pessoa: modMatch ? modMatch.pessoa : ct.pessoa,
                              modalidadeId: modMatch ? modMatch.id : ct.modalidadeId,
                          }
                        : ct,
                ),
            );
        }
        if (aba !== "calculadora") {
            navigate(BASE_ROTA);
        }
        toast.success("Dados do processo no DJEN preenchidos na calculadora.");
    };

    if (verificandoSessao) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-ink text-paper">
                <Loader2 className="size-7 animate-spin text-gold-light" aria-label="Carregando" />
            </div>
        );
    }

    if (!sessao) {
        return <TelaLogin onAutenticado={setSessao} />;
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-paper/15 bg-ink text-paper">
                <div className="container flex flex-wrap items-center justify-between gap-4 py-3.5">
                    <div className="flex items-center gap-4 sm:gap-6">
                        <Link to={BASE_ROTA} aria-label="Início da Calculadora Revisional">
                            <img src={logo} alt="Ian Granja Advogados" width={768} height={132} className="h-8 w-auto" />
                        </Link>
                        <span className="hidden border-l border-paper/20 pl-5 text-sm font-medium text-paper/80 sm:inline">
                            Calculadora revisional
                        </span>
                        {IS_LOCAL_SUPABASE && (
                            <span
                                title="Conectado ao banco PostgreSQL local via OrbStack/Docker (isolado de produção)"
                                className="inline-flex items-center border border-gold-light/60 bg-gold-light/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-gold-light"
                            >
                                Banco Local · Teste
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="hidden text-paper/70 md:inline">{sessao.user.email}</span>
                        <Link
                            to="/"
                            className="inline-flex h-9 items-center gap-1.5 border border-paper/20 px-2.5 font-medium text-paper/75 hover:border-paper/50 hover:text-paper"
                        >
                            <ExternalLink className="size-3.5" />
                            Site
                        </Link>
                        <button
                            type="button"
                            onClick={() => {
                                setSenhaObrigatoria(false);
                                setModalSenhaAberto(true);
                            }}
                            className="inline-flex h-9 items-center gap-1.5 border border-paper/25 px-3 font-semibold text-paper/90 hover:border-gold-light hover:text-gold-light"
                        >
                            <KeyRound className="size-3.5" />
                            Senha
                        </button>
                        <button
                            type="button"
                            onClick={encerrarSessao}
                            className="inline-flex h-9 items-center gap-1.5 border border-paper/25 px-3 font-semibold text-paper/90 hover:border-gold-light hover:text-gold-light"
                        >
                            <LogOut className="size-3.5" />
                            Sair
                        </button>
                    </div>
                </div>

                {/* Navegação interna da ferramenta */}
                <div className="border-t border-paper/10 bg-ink-deep/60">
                    <div className="container flex flex-wrap items-center justify-between gap-3">
                        <nav aria-label="Seções da calculadora" className="flex gap-1">
                            <Link
                                to={calculoAtivoId ? `${BASE_ROTA}/caso/${encodeURIComponent(calculoAtivoId)}` : BASE_ROTA}
                                className={cn(
                                    "inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors",
                                    aba === "calculadora"
                                        ? "border-gold-light text-paper"
                                        : "border-transparent text-paper/70 hover:text-paper",
                                )}
                            >
                                <Calculator className="size-4" />
                                Calculadora
                            </Link>
                            <Link
                                to={`${BASE_ROTA}/painel`}
                                className={cn(
                                    "inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors",
                                    aba === "painel"
                                        ? "border-gold-light text-paper"
                                        : "border-transparent text-paper/70 hover:text-paper",
                                )}
                            >
                                <BarChart3 className="size-4" />
                                Painel
                            </Link>
                            <Link
                                to={`${BASE_ROTA}/historico`}
                                className={cn(
                                    "inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors",
                                    aba === "historico"
                                        ? "border-gold-light text-paper"
                                        : "border-transparent text-paper/70 hover:text-paper",
                                )}
                            >
                                <FolderClock className="size-4" />
                                Carteira ({calculosCarteira.length})
                            </Link>
                            <Link
                                to={`${BASE_ROTA}/processos`}
                                className={cn(
                                    "inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors",
                                    aba === "processos"
                                        ? "border-gold-light text-paper"
                                        : "border-transparent text-paper/70 hover:text-paper",
                                )}
                            >
                                <Gavel className="size-4" />
                                Processos ({processosSalvos.length})
                            </Link>
                            <Link
                                to={`${BASE_ROTA}/categorias`}
                                className={cn(
                                    "inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors",
                                    aba === "categorias"
                                        ? "border-gold-light text-paper"
                                        : "border-transparent text-paper/70 hover:text-paper",
                                )}
                            >
                                <Tags className="size-4" />
                                Categorias ({categorias.length})
                            </Link>
                        </nav>

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setDjenContexto({ modoInicial: "oab" })}
                                className="inline-flex h-8 items-center gap-1.5 border border-gold-light/50 bg-gold-light/15 px-2.5 text-xs font-semibold text-gold-light hover:bg-gold-light hover:text-ink"
                            >
                                <Gavel className="size-3.5" />
                                Radar DJEN (OAB 61.107)
                            </button>

                            {aba === "calculadora" && (calculoAtivoId || res || ficha.clienteNome) && (
                                <button
                                    type="button"
                                    onClick={limparFormulario}
                                    className="inline-flex h-8 items-center gap-1.5 text-xs font-semibold text-gold-light hover:underline"
                                >
                                    <FilePlus2 className="size-3.5" />
                                    Novo cálculo em branco
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <ModalAlterarSenha
                aberto={modalSenhaAberto}
                obrigatorio={senhaObrigatoria}
                onFechar={() => {
                    setSenhaObrigatoria(false);
                    setModalSenhaAberto(false);
                }}
            />

            <ModalRankingOlinda
                aberto={olindaAlvoIdx !== null && Boolean(olindaContratoAtual)}
                modalidadeId={olindaContratoAtual?.modalidadeId ?? ""}
                dataRef={olindaContratoAtual?.dataContrato ?? ""}
                bancoAtual={olindaContratoAtual?.instituicao ?? ""}
                onFechar={() => setOlindaAlvoIdx(null)}
                onSelecionarTaxa={aplicarTaxaOlinda}
                onPreencherBanco={preencherBancoOlinda}
            />

            <ModalConsultaDjen
                aberto={djenContexto !== null}
                contexto={djenContexto}
                calculos={calculos}
                categorias={categorias}
                onFechar={() => setDjenContexto(null)}
                onAbrirCaso={abrirCasoDoHistorico}
                onAbrirProcessoSalvo={abrirProcessoSalvo}
                onUsarNaCalculadora={usarPublicacaoDjenNaCalculadora}
                onVincularCnjObservacao={vincularDjenAoCaso}
                onSalvarNaCarteira={salvarPublicacaoDjenNaCarteira}
            />

            {aba === "painel" && (
                <main className="container py-10 lg:py-14">
                    <PainelEstatisticas
                        calculos={calculosCarteira}
                        categorias={categorias}
                        carregando={carregandoBanco}
                        onRecarregar={carregarDadosEscritorio}
                        onIrCalculadora={() => navigate(BASE_ROTA)}
                        onAbrirHistoricoCategoria={(catId) => {
                            const qs = catId && catId !== "todas" ? `?cat=${encodeURIComponent(catId)}` : "";
                            navigate(`${BASE_ROTA}/historico${qs}`);
                        }}
                    />
                </main>
            )}

            {aba === "historico" && (
                <main className="container py-10 lg:py-14">
                    <HistoricoCalculos
                        calculos={calculosCarteira}
                        categorias={categorias}
                        calculoAtivoId={calculoAtivoId}
                        carregando={carregandoBanco}
                        onRecarregar={carregarDadosEscritorio}
                        onAbrir={abrirCasoDoHistorico}
                        onDuplicar={duplicarCasoDoHistorico}
                        onAtualizado={(atualizado) =>
                            setCalculos((prev) => prev.map((item) => (item.id === atualizado.id ? atualizado : item)))
                        }
                        onExcluido={(id) => {
                            setCalculos((prev) => prev.filter((item) => item.id !== id));
                            if (calculoAtivoId === id) {
                                limparCamposEmMemoria();
                            }
                        }}
                        onGerenciarCategorias={() => navigate(`${BASE_ROTA}/categorias`)}
                        onAbrirDjen={(c) =>
                            setDjenContexto({
                                modoInicial: "processo",
                                calculoId: c.id,
                                clienteNome: c.cliente_nome,
                                processoGlobal: c.processo_global,
                            })
                        }
                        onAbrirRadarDjen={() => setDjenContexto({ modoInicial: "oab" })}
                    />
                </main>
            )}

            {aba === "processos" && (
                <main className="container py-10 lg:py-14">
                    <ProcessosSalvosDjen
                        processos={processosSalvos}
                        categorias={categorias}
                        processoAtivoId={rotaProcessoId}
                        verificandoDjen={verificandoDjen}
                        intervaloVerificacaoHoras={INTERVALO_VERIFICACAO_DJEN_HORAS}
                        onVerificarDjen={() => void verificarPublicacoesSalvas(true)}
                        onAbrirProcesso={abrirProcessoSalvo}
                        onVoltarLista={() => navigate(`${BASE_ROTA}/processos`)}
                        onAtualizado={(atualizado) =>
                            setCalculos((prev) => prev.map((item) => (item.id === atualizado.id ? atualizado : item)))
                        }
                        onExcluido={(id) => {
                            setCalculos((prev) => prev.filter((item) => item.id !== id));
                            if (calculoAtivoId === id) {
                                limparCamposEmMemoria();
                            }
                        }}
                        onAbrirRadarDjen={() => setDjenContexto({ modoInicial: "oab" })}
                        onConsultarDjenProcesso={(c) =>
                            setDjenContexto({
                                modoInicial: "processo",
                                calculoId: c.id,
                                clienteNome: c.cliente_nome,
                                processoGlobal: c.processo_global,
                            })
                        }
                        onLevarParaCalculadora={abrirCasoDoHistorico}
                    />
                </main>
            )}

            {aba === "categorias" && (
                <main className="container max-w-4xl py-10 lg:py-14">
                    <GerenciarCategorias
                        categorias={categorias}
                        contagemPorCategoria={contagemPorCategoria}
                        onChange={(novas) => {
                            setCategorias(novas);
                            if (ficha.categoriaId && !novas.some((c) => c.id === ficha.categoriaId)) {
                                setFicha((f) => ({ ...f, categoriaId: null }));
                            }
                        }}
                    />
                </main>
            )}

            {aba === "calculadora" && (
                <main className="container grid gap-x-10 gap-y-10 py-10 lg:grid-cols-12 lg:py-14">
                    {(calculoAtivoId || origemHistorico) && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/20 pb-3 lg:col-span-12">
                            <button
                                type="button"
                                onClick={voltarParaHistorico}
                                className="inline-flex items-center gap-2 text-xs font-semibold text-ink hover:underline"
                            >
                                <ArrowLeft className="size-3.5" />
                                Voltar para a pauta de clientes
                            </button>
                            {ficha.clienteNome && (
                                <span className="text-xs text-muted-foreground">
                                    Visualizando ficha de <strong className="text-ink">{ficha.clienteNome}</strong>
                                </span>
                            )}
                        </div>
                    )}

                    <form onSubmit={calcular} noValidate className="space-y-5 lg:col-span-5">
                        <div className="border-b border-ink/15 pb-4">
                            <span className="rubric text-gold-deep">Suite Pericial Bancária</span>
                            <h1 className="subdisplay mt-1.5 text-[1.75rem] text-ink">
                                Cálculo revisional completo
                            </h1>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                                Múltiplos contratos, taxas BACEN/Olinda, tarifas em dobro, atualização monetária e laudo
                                PDF A4.
                            </p>
                        </div>

                        <AssistenteClaudeRevisional
                            sessaoAccessToken={sessao.accessToken}
                            calculoAtivoId={calculoAtivoId}
                            carregandoExterno={carregando || salvandoCalculo || renovandoCaso}
                            estadoAtual={{
                                ficha,
                                processo: {
                                    parametros,
                                    contratos: contratosForm.map(formParaContratoInput),
                                    tarifas,
                                    deducoes,
                                },
                                categorias,
                            }}
                            onAplicarResultadoClaude={aplicarResultadoClaude}
                        />

                        {/* 01 · Ficha global do caso */}
                        <section className="sheet-on-paper space-y-5 border border-ink/20 p-5 sm:p-6">
                            <div className="flex items-baseline justify-between gap-3 border-b border-ink/15 pb-2.5">
                                <h2 className="rubric text-ink">01 · Identificação do caso</h2>
                                {calculoAtivoId && (
                                    <span className="bg-gold-light/40 px-2 py-0.5 text-[11px] font-semibold text-ink">
                                        Editando salvo
                                    </span>
                                )}
                            </div>

                            <div>
                                <label htmlFor="adv-cliente" className={labelClass}>
                                    Nome do cliente / Autor(a)
                                </label>
                                <input
                                    ref={clienteInputRef}
                                    id="adv-cliente"
                                    value={ficha.clienteNome}
                                    onChange={(e) => setFicha({ ...ficha, clienteNome: e.target.value })}
                                    maxLength={160}
                                    placeholder="Ex.: José Carlos Ferreira"
                                    className="field py-2"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <div className="flex items-baseline justify-between gap-2">
                                        <label htmlFor="adv-processo" className={labelClass}>
                                            Nº do processo (CNJ)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setDjenContexto({
                                                    modoInicial: "processo",
                                                    calculoId: calculoAtivoId,
                                                    clienteNome: ficha.clienteNome,
                                                    processoGlobal: ficha.processoGlobal ?? "",
                                                })
                                            }
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-deep hover:text-ink"
                                        >
                                            <Gavel className="size-3" />
                                            Consultar DJEN
                                        </button>
                                    </div>
                                    <input
                                        id="adv-processo"
                                        value={ficha.processoGlobal ?? ""}
                                        onChange={(e) => setFicha({ ...ficha, processoGlobal: e.target.value })}
                                        maxLength={80}
                                        placeholder="0002720-86.2026.8.17.1130"
                                        className="field py-2 text-sm tabular-nums"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-baseline justify-between gap-2">
                                        <label htmlFor="adv-cat" className={labelClass}>
                                            Fase / Categoria
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setCriandoCatRapida((v) => !v)}
                                            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-ink/75 hover:text-ink"
                                        >
                                            <Plus className="size-3" />
                                            Nova
                                        </button>
                                    </div>
                                    <select
                                        id="adv-cat"
                                        value={ficha.categoriaId ?? ""}
                                        onChange={(e) => setFicha({ ...ficha, categoriaId: e.target.value || null })}
                                        className="field cursor-pointer py-2 text-sm [&>option]:text-ink"
                                    >
                                        <option value="">Sem categoria</option>
                                        {categorias.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {criandoCatRapida && (
                                <div className="flex items-center gap-2 border border-ink/15 bg-secondary/40 p-2.5">
                                    <input
                                        value={nomeCatRapida}
                                        onChange={(e) => setNomeCatRapida(e.target.value)}
                                        placeholder="Nome da nova fase/categoria"
                                        maxLength={60}
                                        className="field py-1 text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={criarCategoriaInline}
                                        className="inline-flex h-8 shrink-0 items-center bg-ink px-3 text-xs font-semibold text-paper hover:bg-ink-soft"
                                    >
                                        Criar
                                    </button>
                                </div>
                            )}

                            <div>
                                <label htmlFor="adv-obs" className={labelClass}>
                                    Observações do caso (aparecem no laudo)
                                </label>
                                <textarea
                                    id="adv-obs"
                                    rows={2}
                                    value={ficha.observacoes}
                                    onChange={(e) => setFicha({ ...ficha, observacoes: e.target.value })}
                                    maxLength={4000}
                                    placeholder="Seguro prestamista, tarifa de cadastro, vara, prazos..."
                                    className="field resize-y py-2 text-sm"
                                />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/12 pt-3">
                                <span className="text-[11px] leading-snug text-muted-foreground">
                                    Sem valores do contrato ainda? Salve a ficha na aba Processos antes de calcular.
                                </span>
                                <button
                                    type="button"
                                    disabled={salvandoFicha || salvandoCalculo}
                                    onClick={salvarFichaSemCalculo}
                                    className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-[#126A35]/50 bg-[#126A35]/10 px-3 text-xs font-semibold text-[#126A35] hover:bg-[#126A35] hover:text-paper disabled:opacity-60"
                                >
                                    {salvandoFicha ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <BookmarkPlus className="size-3.5" />
                                    )}
                                    {calculoAtivoId ? "Atualizar Ficha" : "Salvar em Processos"}
                                </button>
                            </div>
                        </section>

                        {/* Contratos */}
                        <div className="space-y-5">
                            {contratosForm.map((ct, idx) => (
                                <FormContratoRevisional
                                    key={ct.id}
                                    index={idx}
                                    totalContratos={contratosForm.length}
                                    form={ct}
                                    onChange={(atualizado) =>
                                        setContratosForm((prev) => prev.map((x, i) => (i === idx ? atualizado : x)))
                                    }
                                    onRemover={() =>
                                        setContratosForm((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                    onAbrirOlinda={() => setOlindaAlvoIdx(idx)}
                                />
                            ))}

                            <button
                                type="button"
                                onClick={() =>
                                    setContratosForm((prev) => [...prev, criarContratoFormEmBranco(prev.length + 1)])
                                }
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-dashed border-ink/40 px-4 text-sm font-semibold text-ink hover:bg-ink/5"
                            >
                                <Plus className="size-4" />
                                Adicionar mais um contrato
                            </button>
                        </div>

                        {/* Seguros, tarifas, correção monetária, juros e deduções */}
                        <SecoesPericiaisExtras
                            key={formInstanceKey}
                            parametros={parametros}
                            onParametrosChange={setParametros}
                            tarifas={tarifas}
                            onTarifasChange={setTarifas}
                            deducoes={deducoes}
                            onDeducoesChange={setDeducoes}
                            dataContratoPadrao={contratosForm[0]?.dataContrato ?? ""}
                        />

                        {erro && (
                            <p
                                role="alert"
                                className="border-t-2 border-destructive pt-3 text-sm font-medium text-destructive"
                            >
                                {erro}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={carregando}
                            className="inline-flex min-h-12 w-full items-center justify-center gap-3 bg-ink px-6 font-semibold text-paper transition-colors duration-200 hover:bg-ink-soft disabled:cursor-wait disabled:opacity-70"
                        >
                            {carregando && <Loader2 aria-hidden className="size-5 animate-spin" />}
                            {carregando ? "Consultando BACEN e atualizando índices" : "Calcular revisão completa"}
                        </button>
                    </form>

                    <div ref={topoRes} className="scroll-mt-6 lg:col-span-7">
                        {res ? (
                            <ResultadoPainel
                                resultado={res.resultado}
                                ficha={ficha}
                                categoria={categoriaSelecionada}
                                calculoAtivoId={calculoAtivoId}
                                salvando={salvandoCalculo}
                                renovando={renovandoCaso}
                                onSalvar={salvarNoBanco}
                                onRenovarHoje={renovarCasoNaCalculadora}
                            />
                        ) : (
                            <div className="sheet-on-paper border border-ink/20 lg:sticky lg:top-8">
                                <div className="grid items-center gap-6 bg-ink px-6 py-7 text-paper sm:grid-cols-[minmax(0,1fr)_10.5rem]">
                                    <div>
                                        <span className="rubric text-gold-light">Folha de Rosto Pericial</span>
                                        <h2 className="subdisplay mt-2 text-2xl text-paper">
                                            O laudo completo aparece aqui.
                                        </h2>
                                        <p className="mt-2.5 max-w-[52ch] text-sm leading-relaxed text-paper/80">
                                            Solte o PDF/foto da CCB no painel do Claude ou preencha os dados ao lado para
                                            gerar o comparativo BACEN, os gráficos e o Laudo PDF em A4.
                                        </p>
                                    </div>
                                    <HeroArt variant="calculo" className="mx-auto max-w-[10.5rem]" />
                                </div>

                                <div className="grid divide-y divide-ink/15 border-b border-ink/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                                    <div className="p-4">
                                        <span className="rubric text-gold-deep">01 · Contrato</span>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                            Informe capital, parcelas e taxa ou anexe o contrato direto no Claude.
                                        </p>
                                    </div>
                                    <div className="p-4">
                                        <span className="rubric text-gold-deep">02 · BACEN / Olinda</span>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                            Consulta automática às médias SGS e taxas por instituição financeira.
                                        </p>
                                    </div>
                                    <div className="p-4">
                                        <span className="rubric text-gold-deep">03 · Laudo &amp; Inicial</span>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                            Resumo pronto para petição, CSV das parcelas e PDF A4 com gráficos.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="rubric text-ink">Últimos casos salvos</h3>
                                        <Link
                                            to={`${BASE_ROTA}/historico`}
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-gold-deep hover:text-ink hover:underline"
                                        >
                                            Ver pauta completa ({calculosCarteira.length})
                                            <ArrowRight className="size-3.5" />
                                        </Link>
                                    </div>

                                    {calculosCarteira.length === 0 ? (
                                        <p className="mt-3 text-xs text-muted-foreground">
                                            Nenhum cálculo salvo ainda. Calcule um contrato e salve para acessá-lo rápido
                                            por aqui.
                                        </p>
                                    ) : (
                                        <ul className="mt-3 divide-y divide-ink/12 border border-ink/15 bg-background/50">
                                            {calculosCarteira.slice(0, 4).map((c) => {
                                                const pendente = isCalculoPendente(c);
                                                const val = Number(c.valor_total_acao) || Number(c.diferenca_total) || 0;
                                                return (
                                                    <li key={c.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => abrirCasoDoHistorico(c)}
                                                            className="flex w-full items-center justify-between gap-4 px-3.5 py-2.5 text-left transition-colors hover:bg-ink/[0.03]"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-semibold text-ink">
                                                                    {c.cliente_nome}
                                                                </p>
                                                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                                    {c.banco || "Banco não informado"} ·{" "}
                                                                    {mNome(c.mes_contrato)} ·{" "}
                                                                    {pendente ? "Aguardando contrato" : `${num(c.razao_am, 2)}x`}
                                                                </p>
                                                            </div>
                                                            <div className="flex shrink-0 items-center gap-2.5 tabular-nums">
                                                                <span className="text-sm font-bold text-ink">
                                                                    {pendente && val === 0 ? "Pendente" : brl(val)}
                                                                </span>
                                                                <FolderOpen className="size-3.5 text-ink/50" />
                                                            </div>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            )}
        </div>
    );
};

export default CalculadoraAdvogado;
