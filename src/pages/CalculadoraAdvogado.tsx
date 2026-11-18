import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    BarChart3,
    BookmarkCheck,
    Calculator,
    Check,
    Copy,
    CopyPlus,
    ExternalLink,
    FileDown,
    FilePlus2,
    FileSpreadsheet,
    FolderClock,
    KeyRound,
    Loader2,
    LogOut,
    Plus,
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
import { FormContratoRevisional } from "@/components/juros/FormContratoRevisional";
import { ModalRankingOlinda } from "@/components/juros/ModalRankingOlinda";
import { SecoesPericiaisExtras } from "@/components/juros/SecoesPericiaisExtras";
import { GraficoSerieBacen, PainelGraficosCaso } from "@/components/juros/GraficosCasoRevisional";
import { PainelEstatisticas } from "@/components/juros/PainelEstatisticas";
import {
    MODALIDADES,
    brl,
    mNome,
    nivel,
    num,
    resumo,
    validar,
    type Analise,
    type Nivel,
} from "@/lib/juros";
import {
    INDICES_CORRECAO_OPCOES,
    PARAMETROS_DECISAO_PADRAO,
    TIPOS_JUROS_OPCOES,
    calcularProcessoRevisional,
    contratoInputParaForm,
    criarContratoFormEmBranco,
    formParaContratoInput,
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
import { baixarCsvDemonstrativo, baixarLaudoPdf } from "@/lib/juros/laudo-pdf";
import {
    IS_LOCAL_SUPABASE,
    RevisionalApiError,
    atualizarCalculo,
    calculoParaProcesso,
    consumirHashRecuperacao,
    criarCalculo,
    criarCategoria,
    listarCalculos,
    listarCategorias,
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

const montarTextoPeticaoPro = (
    res: ResultadoProcessoRevisional,
    ficha: FichaCliente,
    categoria?: Categoria | null,
) => {
    const linhas: string[] = [];
    if (ficha.clienteNome.trim()) linhas.push(`Cliente / Autor(a): ${ficha.clienteNome.trim()}`);
    if (ficha.processoGlobal?.trim()) linhas.push(`Processo nº: ${ficha.processoGlobal.trim()}`);
    if (categoria) linhas.push(`Categoria: ${categoria.nome}`);

    const indiceLabel =
        res.parametros.tipoJuros === "SELIC"
            ? "SELIC (englobando correção + juros)"
            : (INDICES_CORRECAO_OPCOES.find((o) => o.id === res.parametros.indiceCorrecao)?.label ?? "");
    const jurosLabel =
        res.parametros.tipoJuros === "FIXO_CUSTOM"
            ? `${num(res.parametros.jurosFixoMensal)}% a.m.`
            : (TIPOS_JUROS_OPCOES.find((o) => o.id === res.parametros.tipoJuros)?.label ?? "");

    linhas.push(`Atualização até ${res.parametros.dataBaseAtualizacao}: ${indiceLabel} | Juros: ${jurosLabel}`);

    const blocosContratos = res.contratos.map((rc, idx) => {
        const analiseTexto: Analise =
            rc.contrato.fonteTaxaRevisional === "banco_olinda"
                ? { ...rc.analise, media: { ...rc.analise.media, nota: "" } }
                : rc.analise;
        const cab = [
            `--- Contrato ${idx + 1}: ${rc.contrato.descricao || rc.analise.entrada.mod.nome} ---`,
            rc.contrato.instituicao ? `Instituição financeira: ${rc.contrato.instituicao}` : "",
            rc.contrato.numeroContrato ? `Nº contrato: ${rc.contrato.numeroContrato}` : "",
            `Paradigma: ${rc.fonteTaxaRotulo}`,
            resumo(analiseTexto),
            `Diferença nas pagas atualizada: ${brl(rc.totalAtualizadoParcelas)}${rc.extrasAtualizado > 0 ? ` | Extras: ${brl(rc.extrasAtualizado)}` : ""}`,
        ]
            .filter(Boolean)
            .join("\n");
        return cab;
    });

    const partes = [linhas.join("\n"), ...blocosContratos];

    if (res.tarifas.length > 0) {
        const tarLines = res.tarifas.map(
            (t) =>
                `- ${t.titulo}: ${brl(t.valorOriginal)} (${t.item.emDobro ? "em dobro" : "simples"}) -> atualizado: ${brl(t.total)}`,
        );
        partes.push(["Seguros e Tarifas Abusivas:", ...tarLines].join("\n"));
    }

    const r = res.resumo;
    partes.push(
        [
            "Resumo Global da Ação:",
            `Total líquido a restituir / compensar: ${brl(r.totalRestituicaoAtualizado)}`,
            r.economiaVincendasTotal > 0 ? `Economia nas parcelas vincendas: ${brl(r.economiaVincendasTotal)}` : "",
            `Proveito econômico / Valor total da ação: ${brl(r.valorTotalAcao)}`,
        ]
            .filter(Boolean)
            .join("\n"),
    );

    if (ficha.observacoes.trim()) {
        partes.push(`Observações: ${ficha.observacoes.trim()}`);
    }

    return partes.join("\n\n");
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
    onSalvar: (comoNovo: boolean) => void;
}

const ResultadoPainel = ({
    resultado,
    ficha,
    categoria,
    calculoAtivoId,
    salvando,
    onSalvar,
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
        <div className="space-y-8" aria-live="polite">
            {/* Barra de ações: salvar, PDF e CSV */}
            <div className="flex flex-wrap items-center justify-between gap-4 border border-ink/25 bg-card px-5 py-4">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {calculoAtivoId ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#126A35]">
                                <BookmarkCheck className="size-4" />
                                Vinculado ao histórico
                            </span>
                        ) : (
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Cálculo ainda não salvo
                            </span>
                        )}
                        {ficha.clienteNome.trim() && (
                            <span className="text-sm font-semibold text-ink">· {ficha.clienteNome.trim()}</span>
                        )}
                        {categoria && <SeloCategoria categoria={categoria} />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Exporte o Laudo Técnico em A4, baixe a planilha CSV ou salve o caso completo no banco.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={baixarPdf}
                        className="inline-flex min-h-10 items-center gap-2 border border-gold bg-gold-light px-3.5 text-xs font-semibold text-ink hover:bg-paper-white"
                    >
                        <FileDown className="size-4" />
                        Laudo PDF
                    </button>

                    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 border border-ink/25 bg-background/60 px-3 text-xs font-medium text-ink select-none">
                        <input
                            type="checkbox"
                            checked={incluirGraficosPdf}
                            onChange={(e) => setIncluirGraficosPdf(e.target.checked)}
                            className="accent-ink"
                        />
                        Gráficos no PDF
                    </label>

                    <button
                        type="button"
                        onClick={() =>
                            baixarCsvDemonstrativo(resultado, {
                                clienteNome: ficha.clienteNome || "cliente",
                                processoGlobal: ficha.processoGlobal,
                            })
                        }
                        className="inline-flex min-h-10 items-center gap-2 border border-ink/35 px-3 text-xs font-semibold text-ink hover:bg-ink/5"
                    >
                        <FileSpreadsheet className="size-4" />
                        CSV
                    </button>

                    {calculoAtivoId ? (
                        <>
                            <button
                                type="button"
                                disabled={salvando}
                                onClick={() => onSalvar(false)}
                                className="inline-flex min-h-10 items-center gap-2 bg-ink px-4 text-xs font-semibold text-paper hover:bg-ink-soft disabled:opacity-70"
                            >
                                {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                Atualizar salvo
                            </button>
                            <button
                                type="button"
                                disabled={salvando}
                                onClick={() => onSalvar(true)}
                                className="inline-flex min-h-10 items-center gap-2 border border-ink/35 px-3 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-70"
                            >
                                <CopyPlus className="size-4" />
                                Salvar novo
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            disabled={salvando}
                            onClick={() => onSalvar(true)}
                            className="inline-flex min-h-10 items-center gap-2 bg-ink px-4 text-xs font-semibold text-paper hover:bg-ink-soft disabled:opacity-70"
                        >
                            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                            Salvar no histórico
                        </button>
                    )}
                </div>
            </div>

            {/* Quadro Resumo Global do Laudo */}
            <section className="border-2 border-ink bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-ink px-5 py-3 text-paper">
                    <h2 className="rubric text-gold-light">Resumo Global do Laudo</h2>
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

type AbaAtiva = "calculadora" | "painel" | "historico" | "categorias";

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
              : subRota === "categorias"
                ? "categorias"
                : "calculadora";
    const rotaCasoId = subRota.startsWith("caso/") ? decodeURIComponent(subRota.slice(5)) : null;
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

    // Estado completo do processo pericial
    const [contratosForm, setContratosForm] = useState<ContratoFormState[]>(() => [criarContratoFormEmBranco(1)]);
    const [parametros, setParametros] = useState<ParametrosDecisao>(() => PARAMETROS_DECISAO_PADRAO());
    const [tarifas, setTarifas] = useState<TarifaItem[]>([]);
    const [deducoes, setDeducoes] = useState<DeducaoItem[]>([]);

    // Modal Olinda
    const [olindaAlvoIdx, setOlindaAlvoIdx] = useState<number | null>(null);

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
            const payload = processoParaPayload(res.resultado, res.input, ficha);
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
                                Histórico ({calculos.length})
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

            {aba === "painel" && (
                <main className="container py-10 lg:py-14">
                    <PainelEstatisticas
                        calculos={calculos}
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
                        calculos={calculos}
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

                    <form onSubmit={calcular} noValidate className="space-y-6 lg:col-span-5">
                        <div>
                            <h1 className="subdisplay text-[1.75rem] text-ink">Cálculo revisional pericial</h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Múltiplos contratos, tabela por banco (BCB Olinda), tarifas, correção monetária e laudo PDF.
                            </p>
                        </div>

                        {/* Ficha global do caso */}
                        <section className="space-y-5 border border-ink/25 bg-card p-5">
                            <div className="flex items-baseline justify-between gap-3 border-b border-ink/20 pb-2.5">
                                <h2 className="rubric text-ink">Identificação do caso</h2>
                                {calculoAtivoId && (
                                    <span className="text-xs font-semibold text-gold-deep">Editando salvo</span>
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
                                    className="field"
                                />
                            </div>

                            <div>
                                <label htmlFor="adv-processo" className={labelClass}>
                                    Nº do processo (global)
                                </label>
                                <input
                                    id="adv-processo"
                                    value={ficha.processoGlobal ?? ""}
                                    onChange={(e) => setFicha({ ...ficha, processoGlobal: e.target.value })}
                                    maxLength={80}
                                    placeholder="Ex.: 0002720-86.2026.8.17.1130 (opcional)"
                                    className="field tabular-nums"
                                />
                            </div>

                            <div>
                                <div className="flex items-baseline justify-between gap-2">
                                    <label htmlFor="adv-cat" className={labelClass}>
                                        Categoria
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setCriandoCatRapida((v) => !v)}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-ink/75 hover:text-ink"
                                    >
                                        <Plus className="size-3" />
                                        Nova categoria
                                    </button>
                                </div>
                                <select
                                    id="adv-cat"
                                    value={ficha.categoriaId ?? ""}
                                    onChange={(e) => setFicha({ ...ficha, categoriaId: e.target.value || null })}
                                    className="field cursor-pointer [&>option]:text-ink"
                                >
                                    <option value="">Sem categoria</option>
                                    {categorias.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.nome}
                                        </option>
                                    ))}
                                </select>

                                {criandoCatRapida && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <input
                                            value={nomeCatRapida}
                                            onChange={(e) => setNomeCatRapida(e.target.value)}
                                            placeholder="Nome da nova categoria"
                                            maxLength={60}
                                            className="field py-1.5 text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={criarCategoriaInline}
                                            className="inline-flex h-9 shrink-0 items-center bg-ink px-3 text-xs font-semibold text-paper hover:bg-ink-soft"
                                        >
                                            Criar
                                        </button>
                                    </div>
                                )}
                            </div>

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
                                    className="field resize-y text-sm"
                                />
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
                                onSalvar={salvarNoBanco}
                            />
                        ) : (
                            <div className="grid items-center gap-8 bg-ink p-8 text-paper sm:grid-cols-[minmax(0,1fr)_14rem] lg:sticky lg:top-8">
                                <div>
                                    <p className="subdisplay text-2xl">O laudo aparece aqui.</p>
                                    <p className="mt-3 max-w-[56ch] leading-relaxed text-paper/80">
                                        Adicione um ou mais contratos, consulte a taxa média ou a taxa por banco no BCB
                                        Olinda, inclua tarifas/seguros e gere o demonstrativo atualizado pronto para
                                        PDF. Você também pode abrir os{" "}
                                        <Link
                                            to={`${BASE_ROTA}/historico`}
                                            className="font-semibold text-gold-light underline underline-offset-4"
                                        >
                                            {calculos.length} cálculos salvos
                                        </Link>
                                        .
                                    </p>
                                </div>
                                <HeroArt variant="calculo" className="max-w-[14rem]" />
                            </div>
                        )}
                    </div>
                </main>
            )}
        </div>
    );
};

export default CalculadoraAdvogado;
