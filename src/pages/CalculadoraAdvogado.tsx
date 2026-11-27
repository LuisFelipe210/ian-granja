import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    BarChart3,
    BookmarkPlus,
    Check,
    Copy,
    CopyPlus,
    FileDown,
    FileSpreadsheet,
    Gavel,
    Loader2,
    Plus,
    RefreshCw,
    Save,
    Table2,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { labelClass } from "@/components/juros/Campos";
import { TelaLogin, ModalAlterarSenha } from "@/components/juros/RevisionalAuth";
import { GerenciarCategorias, SeloCategoria } from "@/components/juros/GerenciarCategorias";
import { FormContratoRevisional } from "@/components/juros/FormContratoRevisional";
import type { ContextoInicialDjen } from "@/components/juros/ModalConsultaDjen";
import { SecoesPericiaisExtras } from "@/components/juros/SecoesPericiaisExtras";
import { GraficoSerieBacen, PainelGraficosCaso } from "@/components/juros/GraficosCasoRevisional";
import {
    BASE_ROTA,
    ROTA_CALCULO,
    ShellSistema,
    type AbaSistema,
} from "@/components/juros/ShellSistema";
import { configEscritorioAtual, definirConfigEscritorio } from "@/lib/config-escritorio";
import type { AlvoSheetTarefa } from "@/components/juros/AgendaSistema";
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
import type { LaudoMetadata } from "@/lib/juros/laudo-pdf";
import {
    ErroGoogleDrive,
    GOOGLE_DRIVE_CONFIGURADO,
    criarPastaDrive,
    desconectarGoogleDrive,
    enviarArquivoDrive,
    escolherPastaDrive,
    esquecerUltimaPastaDrive,
    lembrarUltimaPastaDrive,
    prepararGoogleDrive,
    ultimaPastaDrive,
    type ItemDrive,
} from "@/lib/google-drive";
import { IconeGoogleDrive } from "@/components/juros/IconeGoogleDrive";
import { ModalDestinoDrive, type DestinoDrive } from "@/components/juros/ModalDestinoDrive";
import { MenuContaDrive } from "@/components/juros/MenuContaDrive";
import { useContaDrive } from "@/lib/use-conta-drive";
import {
    INTERVALO_VERIFICACAO_DJEN_HORAS,
    anexarMovimentacaoDjenAoProcesso,
    criarPayloadCarteiraDeDjen,
    lerDadosProcessoDjen,
    normalizarNumeroProcessoDjen,
    urlHttpSegura,
    verificarPublicacoesDjen,
    type DjenComunicacao,
} from "@/lib/juros/djen";
import {
    RevisionalApiError,
    atualizarCalculo,
    calculoParaProcesso,
    consumirHashRecuperacao,
    contarConversasPendentes,
    criarCalculo,
    existeCalculoComProcesso,
    criarCategoria,
    dataHojeLocalISO,
    fichaSemCalculoParaPayload,
    isCalculoPendente,
    isTabelaTarefasAusente,
    listarCalculos,
    listarCategorias,
    listarTipos,
    listarTarefas,
    montarTextoPeticaoPro,
    obterConfigEscritorio,
    obterSessaoAtiva,
    processoParaPayload,
    sairDaSessao,
    type CalculoSalvo,
    type Categoria,
    type TipoAcao,
    type FichaCliente,
    type RevisionalSession,
    type Tarefa,
} from "@/lib/revisional-db";

/** Telas e modais pesados carregados sob demanda para manter o bundle inicial enxuto. */
const DocumentosSistema = lazy(() =>
    import("@/components/juros/DocumentosSistema").then((m) => ({ default: m.DocumentosSistema })),
);
const InicioSistema = lazy(() =>
    import("@/components/juros/InicioSistema").then((m) => ({ default: m.InicioSistema })),
);
const AgendaSistema = lazy(() =>
    import("@/components/juros/AgendaSistema").then((m) => ({ default: m.AgendaSistema })),
);
const SheetTarefa = lazy(() =>
    import("@/components/juros/AgendaSistema").then((m) => ({ default: m.SheetTarefa })),
);
const AtendimentoSistema = lazy(() =>
    import("@/components/juros/AtendimentoSistema").then((m) => ({ default: m.AtendimentoSistema })),
);
const ClientesSistema = lazy(() =>
    import("@/components/juros/ClientesSistema").then((m) => ({ default: m.ClientesSistema })),
);
const PainelEstatisticas = lazy(() =>
    import("@/components/juros/PainelEstatisticas").then((m) => ({ default: m.PainelEstatisticas })),
);
const HistoricoCalculos = lazy(() =>
    import("@/components/juros/HistoricoCalculos").then((m) => ({ default: m.HistoricoCalculos })),
);
const ProcessosSalvosDjen = lazy(() =>
    import("@/components/juros/ProcessosSalvosDjen").then((m) => ({ default: m.ProcessosSalvosDjen })),
);
const ConfiguracoesSistema = lazy(() =>
    import("@/components/juros/ConfiguracoesSistema").then((m) => ({ default: m.ConfiguracoesSistema })),
);
const ModalRankingOlinda = lazy(() =>
    import("@/components/juros/ModalRankingOlinda").then((m) => ({ default: m.ModalRankingOlinda })),
);
const ModalConsultaDjen = lazy(() =>
    import("@/components/juros/ModalConsultaDjen").then((m) => ({ default: m.ModalConsultaDjen })),
);
const AssistenteClaudeRevisional = lazy(() =>
    import("@/components/juros/AssistenteClaudeRevisional").then((m) => ({ default: m.AssistenteClaudeRevisional })),
);

const CarregandoTela = ({ rotulo = "Carregando tela…" }: { rotulo?: string }) => (
    <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {rotulo}
    </div>
);

/**
 * Calculadora revisional pericial completa, para uso interno do escritório.
 * Protegida por login fechado no Supabase, com histórico, categorias, API Olinda e Laudo PDF.
 */

/**
 * Card "Leitura automática com Claude" (anexar PDF/foto, Google Drive, conector MCP) escondido a pedido
 * em 18/11/2026. O código continua no lugar: troque para `true` para mostrar de novo.
 */
const MOSTRAR_LEITURA_CLAUDE = false;

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
    <div className="border border-ink/20 bg-card p-4">
        <div className="flex items-center justify-between gap-3">
            <h3 className="sys-label font-semibold text-ink">{titulo}</h3>
            <Selo n={nivel(razao)} />
        </div>
        <dl className="mt-3 space-y-2 text-sm tabular-nums">
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
            <div className="flex items-baseline justify-between gap-4 border-t border-ink/15 pt-2">
                <dt className="text-muted-foreground">Contrato / paradigma</dt>
                <dd className="text-xl font-bold text-ink">{num(razao)}x</dd>
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
                <h2 className="mt-3 text-xl font-bold text-ink">
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
    const [salvandoDrive, setSalvandoDrive] = useState(false);
    /** Janela "Onde salvar o laudo?" do Google Drive. */
    const [modalDriveAberto, setModalDriveAberto] = useState(false);
    const contaDrive = useContaDrive();
    /** Última pasta usada no Drive, lida ao abrir a janela (vem marcada como padrão). */
    const [ultimaPastaDriveAtual, setUltimaPastaDriveAtual] = useState<ItemDrive | null>(null);

    useEffect(() => {
        prepararGoogleDrive();
    }, []);

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

    const metaLaudo = (): LaudoMetadata => ({
        clienteNome: ficha.clienteNome || "Cliente",
        processoGlobal: ficha.processoGlobal,
        categoriaNome: categoria?.nome,
        observacoes: ficha.observacoes,
        incluirGraficos: incluirGraficosPdf,
    });

    const baixarPdf = async () => {
        try {
            const { baixarLaudoPdf } = await import("@/lib/juros/laudo-pdf");
            const ok = baixarLaudoPdf(resultado, metaLaudo());
            if (ok) {
                toast.success("Laudo PDF baixado.");
            }
        } catch {
            toast.error("Não foi possível gerar o arquivo PDF agora.");
        }
    };

    const clienteDrive = ficha.clienteNome.trim() || "Cliente";

    /** Abre a janela "Onde salvar o laudo?" (criar pasta nova ou usar uma existente). */
    const salvarLaudoNoDrive = () => {
        if (!GOOGLE_DRIVE_CONFIGURADO) {
            toast.info("O Google Drive ainda não foi configurado neste sistema.", {
                description: "Faltam as chaves do Google Cloud (passo a passo em docs/GOOGLE-DRIVE.md).",
            });
            return;
        }
        setUltimaPastaDriveAtual(ultimaPastaDrive());
        setModalDriveAberto(true);
    };

    const fecharDestinoDrive = useCallback(() => setModalDriveAberto(false), []);

    /** Usado pela janela: abre o seletor do Google só com pastas. Cancelar devolve `null`. */
    const escolherPastaNoDrive = useCallback(async () => {
        try {
            return await escolherPastaDrive(`Escolha a pasta para o laudo de ${clienteDrive}`);
        } catch (e) {
            if (e instanceof ErroGoogleDrive && e.codigo === "cancelado") return null;
            throw e;
        }
    }, [clienteDrive]);

    /** Cria a pasta nova (se for o caso), gera o laudo e envia para o Drive. */
    const confirmarDestinoDrive = async (destino: DestinoDrive) => {
        const cliente = clienteDrive;
        // A pasta escolhida no topo da janela (ex.: "Processos"); `null` = raiz do Meu Drive.
        const pastaBase = destino.tipo === "nova" ? destino.pastaPai : destino.pasta;
        setSalvandoDrive(true);
        try {
            const pasta =
                destino.tipo === "nova"
                    ? await criarPastaDrive({ nome: destino.nome, pastaPaiId: destino.pastaPai?.id })
                    : destino.pasta;
            const { gerarBytesLaudoPdf } = await import("@/lib/juros/laudo-pdf");
            const bytes = gerarBytesLaudoPdf(resultado, metaLaudo());
            const dataHoje = new Date().toLocaleDateString("pt-BR").split("/").join("-");
            const enviado = await enviarArquivoDrive({
                nome: `Laudo revisional - ${cliente} - ${dataHoje}.pdf`,
                conteudo: new Blob([bytes], { type: "application/pdf" }),
                mimeType: "application/pdf",
                pastaId: pasta?.id ?? null,
            });
            const link = urlHttpSegura(enviado.link);
            // Lembra a pasta base (não a subpasta do cliente): o próximo laudo já começa nela.
            if (pastaBase) lembrarUltimaPastaDrive(pastaBase);
            else esquecerUltimaPastaDrive();
            setModalDriveAberto(false);
            toast.success(`Laudo salvo em "${pasta ? pasta.nome : "Meu Drive"}" no Google Drive.`, {
                action: link
                    ? { label: "Abrir", onClick: () => window.open(link, "_blank", "noopener,noreferrer") }
                    : undefined,
            });
        } catch (e) {
            if (e instanceof ErroGoogleDrive && e.codigo === "cancelado") return;
            // A última pasta foi apagada ou perdeu o acesso: esquece para não oferecer de novo.
            if (
                e instanceof ErroGoogleDrive &&
                e.codigo === "sem_permissao" &&
                pastaBase &&
                pastaBase.id === ultimaPastaDriveAtual?.id
            ) {
                esquecerUltimaPastaDrive();
                setUltimaPastaDriveAtual(null);
            }
            toast.error(e instanceof Error ? e.message : "Não foi possível salvar o laudo no Google Drive.");
        } finally {
            setSalvandoDrive(false);
        }
    };

    return (
        <div className="space-y-6" aria-live="polite">
            <ModalDestinoDrive
                aberto={modalDriveAberto}
                nomeSugerido={clienteDrive}
                conta={contaDrive}
                ultimaPasta={ultimaPastaDriveAtual}
                enviando={salvandoDrive}
                onEscolherPasta={escolherPastaNoDrive}
                onConfirmar={(destino) => void confirmarDestinoDrive(destino)}
                onFechar={fecharDestinoDrive}
            />

            {/* Barra de ações em duas faixas: identificação + salvar | exportar + renovar */}
            <div className="border border-ink/20 bg-card">
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            {calculoAtivoId ? (
                                <span className="inline-flex items-center gap-1.5 bg-[#126A35]/10 px-2 py-0.5 text-xs font-semibold text-[#126A35]">
                                    <Check className="size-3.5" />
                                    Salvo na carteira
                                </span>
                            ) : (
                                <span className="bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
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
    
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                        {onRenovarHoje && (calculoAtivoId || resultado.parametros.dataBaseAtualizacao !== hojeISO()) && (
                            <button
                                type="button"
                                disabled={renovando || salvando}
                                onClick={onRenovarHoje}
                                title="Atualiza a data-base para hoje, consulta os índices recentes do BACEN, recalcula, salva e gera o novo PDF"
                                className="inline-flex min-h-9 items-center gap-1.5 border border-ink/30 px-2.5 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-60"
                            >
                                {renovando ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                                Renovar para hoje
                            </button>
                        )}
                    </div>
                </div>

                {/* Exportar: cada item cresce para preencher a linha, então a quebra fica alinhada em painéis estreitos */}
                <div className="flex flex-wrap items-stretch gap-2 border-t border-ink/12 bg-background/60 px-4 py-2.5">
                    {/* Laudo PDF + "com gráficos" num botão só (a opção vale também para o envio ao Drive) */}
                    <div className="inline-flex h-8 grow items-stretch overflow-hidden border border-ink/30 bg-card">
                        <button
                            type="button"
                            onClick={baixarPdf}
                            className="inline-flex grow items-center justify-center gap-1.5 whitespace-nowrap rounded-none px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink hover:text-paper"
                        >
                            <FileDown className="size-3.5" />
                            Laudo PDF
                        </button>
                        <label
                            title="Incluir os gráficos no Laudo PDF (também no enviado ao Drive)"
                            className="inline-flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-none border-l border-ink/20 px-2.5 text-xs font-medium text-ink/80 hover:bg-ink/[0.04]"
                        >
                            <input
                                type="checkbox"
                                checked={incluirGraficosPdf}
                                onChange={(e) => setIncluirGraficosPdf(e.target.checked)}
                                className="accent-ink"
                            />
                            com gráficos
                        </label>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            void import("@/lib/juros/laudo-pdf")
                                .then(({ baixarCsvDemonstrativo }) =>
                                    baixarCsvDemonstrativo(resultado, {
                                        clienteNome: ficha.clienteNome || "cliente",
                                        processoGlobal: ficha.processoGlobal,
                                    }),
                                )
                                .catch(() => toast.error("Não foi possível gerar o arquivo CSV agora."));
                        }}
                        className="inline-flex h-8 grow items-center justify-center gap-1.5 whitespace-nowrap border border-ink/30 bg-card px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5"
                    >
                        <FileSpreadsheet className="size-3.5" />
                        CSV
                    </button>

                    {/* Um botão só, com a seta da conta dentro (separada por um filete) */}
                    <div className="inline-flex h-8 grow items-stretch overflow-hidden border border-ink/30 bg-card">
                        <button
                            type="button"
                            onClick={salvarLaudoNoDrive}
                            disabled={salvandoDrive}
                            title={
                                contaDrive
                                    ? `Salvar o Laudo PDF no Google Drive (${contaDrive})`
                                    : "Salvar o Laudo PDF numa pasta do Google Drive"
                            }
                            className="inline-flex grow items-center justify-center gap-1.5 whitespace-nowrap rounded-none px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5 disabled:cursor-wait disabled:opacity-70"
                        >
                            {salvandoDrive ? (
                                <Loader2 aria-hidden className="size-3.5 animate-spin" />
                            ) : (
                                <IconeGoogleDrive className="size-4" />
                            )}
                            {salvandoDrive ? "Salvando no Drive…" : "Salvar no Drive"}
                        </button>
                        {contaDrive && (
                            <MenuContaDrive conta={contaDrive} disabled={salvandoDrive} />
                        )}
                    </div>
    
                </div>
            </div>

            {/* Faixa única de 3 KPIs */}
            <div className="grid divide-y divide-ink/15 border-y border-ink/20 tabular-nums sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="bg-gold-light/20 px-4 py-3.5">
                    <span className="sys-label block text-gold-deep">Proveito econômico total</span>
                    <p className="sys-kpi-value mt-1 text-ink">{brl(r.valorTotalAcao)}</p>
                </div>

                <div className="px-4 py-3.5">
                    <span className="sys-label block">Líquido a restituir</span>
                    <p className="sys-kpi-value mt-1 text-ink">{brl(r.totalRestituicaoAtualizado)}</p>
                </div>

                <div className="px-4 py-3.5">
                    {r.economiaVincendasTotal > 0 ? (
                        <>
                            <span className="sys-label block">Economia nas vincendas</span>
                            <p className="sys-kpi-value mt-1 text-ink">
                                {brl(r.economiaVincendasTotal)}
                            </p>
                        </>
                    ) : (
                        <>
                            <span className="sys-label block">Grau vs. paradigma</span>
                            <div className="mt-1 flex items-baseline justify-between gap-2">
                                <p className="sys-kpi-value text-ink">
                                    {num(contratoAtual?.analise.razaoAm ?? 1, 2)}x
                                </p>
                                {contratoAtual && <Selo n={contratoAtual.nivel} />}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Quadro Resumo Global do Laudo */}
            <section className="border border-ink/20 bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-ink px-4 py-2.5 text-paper">
                    <h2 className="sys-section text-gold-light">Composição analítica do laudo</h2>
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
                    <div className="flex flex-wrap items-baseline justify-between gap-4 bg-gold-light/30 px-4 py-3.5 -mx-5">
                        <dt className="text-sm font-bold text-ink">Proveito econômico / Valor da ação</dt>
                        <dd className="sys-kpi-value text-ink">{brl(r.valorTotalAcao)}</dd>
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

const CalculadoraAdvogado = () => {
    const reduce = useReducedMotion();
    const location = useLocation();
    const navigate = useNavigate();

    const subRota = location.pathname.startsWith(BASE_ROTA)
        ? location.pathname.slice(BASE_ROTA.length).replace(/^\/+|\/+$/g, "")
        : "";
    const aba: AbaSistema =
        subRota === ""
            ? "inicio"
            : subRota === "agenda"
              ? "agenda"
              : subRota === "atendimento"
                ? "atendimento"
              : subRota === "documentos"
                ? "documentos"
                : subRota === "clientes" || subRota.startsWith("clientes/")
                  ? "clientes"
              : subRota === "painel"
                ? "painel"
                : subRota === "historico"
                  ? "historico"
                  : subRota === "crm"
                    ? "crm"
                  : subRota === "processos" || subRota.startsWith("processos/")
                    ? "processos"
                    : subRota === "configuracoes" || subRota === "categorias"
                      ? "configuracoes"
                      : "calculadora";
    // "Fases e categorias" virou uma aba de Configurações: link antigo vai direto para lá.
    useEffect(() => {
        if (subRota === "categorias") navigate(`${BASE_ROTA}/configuracoes?aba=fases`, { replace: true });
    }, [subRota, navigate]);

    const rotaClienteId = subRota.startsWith("clientes/")
        ? decodeURIComponent(subRota.slice("clientes/".length)) || null
        : null;
    const rotaCasoId = subRota.startsWith("caso/") ? decodeURIComponent(subRota.slice(5)) : null;
    const rotaProcessoId = subRota.startsWith("processos/")
        ? decodeURIComponent(subRota.slice("processos/".length))
        : null;
    const origemHistorico = (location.state as { origemHistorico?: string } | null)?.origemHistorico ?? null;
    const origemEhCrm = origemHistorico?.startsWith(`${BASE_ROTA}/crm`) ?? false;
    const rotuloOrigem = origemEhCrm ? "CRM" : "Carteira";

    // O Quadro saiu da Carteira e virou a tela CRM: links antigos (?modo=quadro) vão direto para lá.
    useEffect(() => {
        if (aba !== "historico") return;
        const params = new URLSearchParams(location.search);
        if (params.get("modo") !== "quadro") return;
        params.delete("modo");
        const qs = params.toString();
        navigate(`${BASE_ROTA}/crm${qs ? `?${qs}` : ""}`, { replace: true });
    }, [aba, location.search, navigate]);

    // Sessão e carregamento inicial
    const [verificandoSessao, setVerificandoSessao] = useState(true);
    const [sessao, setSessao] = useState<RevisionalSession | null>(null);
    const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
    const [senhaObrigatoria, setSenhaObrigatoria] = useState(false);

    // Dados do banco
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    /** Categorias no sentido de tipo da ação (revisional_tipos); "categorias" acima são as fases. */
    const [tipos, setTipos] = useState<TipoAcao[]>([]);
    const [calculos, setCalculos] = useState<CalculoSalvo[]>([]);
    const [tarefas, setTarefas] = useState<Tarefa[]>([]);
    const [agendaIndisponivel, setAgendaIndisponivel] = useState(false);
    const [sheetTarefaAlvo, setSheetTarefaAlvo] = useState<AlvoSheetTarefa | null>(null);
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
    const carregamentoCasoReqRef = useRef(0);

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
            const [catsRes, calcsRes, tarefasRes, tiposRes, configRes] = await Promise.allSettled([
                listarCategorias(),
                listarCalculos(),
                listarTarefas(),
                listarTipos(),
                obterConfigEscritorio(),
            ]);

            // Nome, OAB e cidade de Configurações (sem a tabela, ficam os valores padrão).
            if (configRes.status === "fulfilled" && configRes.value) definirConfigEscritorio(configRes.value);

            // Banco sem a migração de categorias (revisional_tipos): segue só com as fases.
            setTipos(tiposRes.status === "fulfilled" ? tiposRes.value : []);

            let expirou = false;
            if (catsRes.status === "fulfilled") {
                setCategorias(catsRes.value);
            } else if (catsRes.reason instanceof RevisionalApiError && catsRes.reason.status === 401) {
                expirou = true;
            } else {
                toast.error(
                    catsRes.reason instanceof Error ? catsRes.reason.message : "Erro ao carregar categorias.",
                );
            }

            if (calcsRes.status === "fulfilled") {
                setCalculos(calcsRes.value);
            } else if (calcsRes.reason instanceof RevisionalApiError && calcsRes.reason.status === 401) {
                expirou = true;
            } else {
                toast.error(
                    calcsRes.reason instanceof Error ? calcsRes.reason.message : "Erro ao carregar carteira.",
                );
            }

            if (tarefasRes.status === "fulfilled") {
                setTarefas(tarefasRes.value);
                setAgendaIndisponivel(false);
            } else if (isTabelaTarefasAusente(tarefasRes.reason)) {
                setTarefas([]);
                setAgendaIndisponivel(true);
            } else if (
                tarefasRes.reason instanceof RevisionalApiError &&
                tarefasRes.reason.status === 401
            ) {
                expirou = true;
            } else {
                toast.error(
                    tarefasRes.reason instanceof Error ? tarefasRes.reason.message : "Erro ao carregar agenda.",
                );
            }

            if (expirou) {
                setSessao(null);
            }
        } finally {
            setCarregandoBanco(false);
        }
    }, []);

    useEffect(() => {
        calculosRef.current = calculos;
    }, [calculos]);

    // Fases e categorias atuais sem recriar o callback de verificação (que reiniciaria os timers).
    const fasesETiposRef = useRef<{ categorias: Categoria[]; tipos: TipoAcao[] }>({ categorias: [], tipos: [] });
    useEffect(() => {
        fasesETiposRef.current = { categorias, tipos };
    }, [categorias, tipos]);

    /**
     * Consulta o DJEN para os processos salvos e anexa as publicações novas ao histórico de cada um.
     * Também varre pela OAB do escritório (manual: sempre; automática: no máximo 1x por hora) e cadastra
     * em Processos os processos novos que aparecerem.
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

                const CHAVE_VARREDURA = "ig_djen_varredura_oab_v1";
                let ultimaVarredura = 0;
                try {
                    ultimaVarredura = Number(localStorage.getItem(CHAVE_VARREDURA)) || 0;
                } catch {
                    /* sem localStorage: varre */
                }
                const varrerOab = manual || Date.now() - ultimaVarredura > 60 * 60_000;

                const resultado = await verificarPublicacoesDjen({
                    calculos: calculosRef.current,
                    atualizar: atualizarCalculo,
                    obterAtual: (id) => calculosRef.current.find((c) => c.id === id),
                    intervaloHoras: manual ? 0 : INTERVALO_VERIFICACAO_DJEN_HORAS,
                    varreduraOab: varrerOab
                        ? {
                              numeroOab: configEscritorioAtual().oabNumero,
                              ufOab: configEscritorioAtual().oabUf,
                              criar: criarCalculo,
                              listarAtuais: listarCalculos,
                              existeProcesso: existeCalculoComProcesso,
                              categorias: fasesETiposRef.current.categorias,
                              tipos: fasesETiposRef.current.tipos,
                          }
                        : undefined,
                });

                if (varrerOab && !resultado.erros.some((e) => e.id === "varredura-oab") && !resultado.interrompidoPorLimite) {
                    try {
                        localStorage.setItem(CHAVE_VARREDURA, String(Date.now()));
                    } catch {
                        /* ignore */
                    }
                }

                if (resultado.atualizados.length > 0 || resultado.criados.length > 0) {
                    const porId = new Map(resultado.atualizados.map((c) => [c.id, c]));
                    const idsCriados = new Set(resultado.criados.map((c) => c.id));
                    setCalculos((prev) => [
                        ...resultado.criados,
                        ...prev.filter((c) => !idsCriados.has(c.id)).map((c) => porId.get(c.id) ?? c),
                    ]);
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
                            : `Nenhuma publicação nova em ${resultado.verificados} ${resultado.verificados === 1 ? "processo verificado" : "processos verificados"} nem na OAB/${configEscritorioAtual().oabUf} ${configEscritorioAtual().oabNumero}.`,
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

    const contagemPorTipo = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const c of calculos) {
            if (c.tipo_id) counts[c.tipo_id] = (counts[c.tipo_id] ?? 0) + 1;
        }
        return counts;
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
        if (location.pathname !== ROTA_CALCULO) {
            navigate(ROTA_CALCULO);
        }
    };

    const carregarCasoEmEstado = useCallback(async (c: CalculoSalvo, manterVinculo: boolean) => {
        const reqId = ++carregamentoCasoReqRef.current;
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
            if (reqId !== carregamentoCasoReqRef.current) return;
            const resultado = calcularProcessoRevisional(processo, seriesEconomicas, onlineByContrato);
            setRes({ resultado, input: processo });
        } catch (err) {
            if (reqId !== carregamentoCasoReqRef.current) return;
            setRes(null);
            setErro(err instanceof Error ? err.message : "Não foi possível recalcular o caso agora.");
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
        navigate(ROTA_CALCULO, {
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
                    ...(fichaCompleta.tipoId !== undefined ? { tipo_id: fichaCompleta.tipoId || null } : {}),
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

            const payload = criarPayloadCarteiraDeDjen(item, categorias, {}, tipos);
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
        carregamentoCasoReqRef.current += 1;
        desconectarGoogleDrive();
        await sairDaSessao();
        setSessao(null);
        setCalculos([]);
        setTarefas([]);
        limparCamposEmMemoria();
        if (location.pathname !== BASE_ROTA) {
            navigate(BASE_ROTA, { replace: true });
        }
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
            const { baixarLaudoPdf } = await import("@/lib/juros/laudo-pdf");
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
        if (aba !== "calculadora" || rotaCasoId) {
            navigate(ROTA_CALCULO);
        }
        toast.success("Dados do processo no DJEN preenchidos na calculadora.");
    };

    const temPublicacaoNova = useMemo(
        () => processosSalvos.some((p) => lerDadosProcessoDjen(p).idsNovos.length > 0),
        [processosSalvos],
    );

    // Contador do menu "Atendimento": conversas do WhatsApp esperando o escritório.
    const [atendimentoPendentes, setAtendimentoPendentes] = useState(0);
    useEffect(() => {
        if (!sessao) return;
        let ativo = true;
        const atualizar = () => {
            if (document.visibilityState !== "visible") return;
            void contarConversasPendentes()
                .then((n) => {
                    if (ativo) setAtendimentoPendentes(n);
                })
                .catch(() => undefined); // sem a migração ainda: fica 0
        };
        atualizar();
        const id = window.setInterval(atualizar, 60_000);
        return () => {
            ativo = false;
            window.clearInterval(id);
        };
    }, [sessao]);

    const agendaPendentesCount = useMemo(() => {
        const hojeIso = dataHojeLocalISO();
        return tarefas.filter((t) => !t.concluida && t.data <= hojeIso).length;
    }, [tarefas]);

    const { tituloTela, breadcrumb } = useMemo(() => {
        if (aba === "inicio") {
            return { tituloTela: "Início", breadcrumb: null };
        }
        if (aba === "agenda") {
            return { tituloTela: "Agenda", breadcrumb: null };
        }
        if (aba === "atendimento") {
            return { tituloTela: "Atendimento", breadcrumb: null };
        }
        if (aba === "documentos") {
            return { tituloTela: "Documentos", breadcrumb: null };
        }
        if (aba === "clientes") {
            return { tituloTela: "Clientes", breadcrumb: null };
        }
        if (aba === "painel") {
            return { tituloTela: "Painel", breadcrumb: null };
        }
        if (aba === "historico") {
            return { tituloTela: "Carteira", breadcrumb: null };
        }
        if (aba === "crm") {
            return { tituloTela: "CRM", breadcrumb: null };
        }
        if (aba === "configuracoes") {
            return { tituloTela: "Configurações", breadcrumb: null };
        }
        if (aba === "processos") {
            if (rotaProcessoId) {
                const proc = processosSalvos.find((p) => p.id === rotaProcessoId);
                return {
                    tituloTela: proc?.cliente_nome || "Processo",
                    breadcrumb: { label: "Processos", to: `${BASE_ROTA}/processos` },
                };
            }
            return { tituloTela: "Processos", breadcrumb: null };
        }
        if (rotaCasoId) {
            return {
                tituloTela: ficha.clienteNome.trim() || "Caso",
                breadcrumb: { label: rotuloOrigem, to: origemEhCrm ? `${BASE_ROTA}/crm` : `${BASE_ROTA}/historico` },
            };
        }
        return { tituloTela: "Calculadora", breadcrumb: null };
    }, [aba, rotaProcessoId, processosSalvos, rotaCasoId, ficha.clienteNome, rotuloOrigem, origemEhCrm]);

    const abrirCasoOuProcesso = (c: CalculoSalvo) => {
        if (isCalculoPendente(c)) {
            abrirProcessoSalvo(c);
        } else {
            abrirCasoDoHistorico(c);
        }
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
        <ShellSistema
            abaAtiva={aba}
            tituloTela={tituloTela}
            breadcrumb={breadcrumb}
            calculos={calculos}
            calculosCarteiraCount={calculosCarteira.length}
            processosSalvosCount={processosSalvos.length}
            temPublicacaoNova={temPublicacaoNova}
            agendaPendentesCount={agendaPendentesCount}
            atendimentoPendentesCount={atendimentoPendentes}
            calculoAtivoId={calculoAtivoId}
            mostrarBotaoLimparCalculo={aba === "calculadora" && Boolean(calculoAtivoId || res || ficha.clienteNome)}
            onLimparCalculo={limparFormulario}
            onAbrirCaso={abrirCasoDoHistorico}
            onAbrirProcesso={abrirProcessoSalvo}
            onNovoCalculo={limparFormulario}
            onNovaTarefa={() => setSheetTarefaAlvo({ modo: "criar", dataInicial: dataHojeLocalISO() })}
            onAbrirRadarDjen={() => setDjenContexto({ modoInicial: "oab" })}
            onSair={encerrarSessao}
        >
            <ModalAlterarSenha
                aberto={modalSenhaAberto}
                obrigatorio={senhaObrigatoria}
                onFechar={() => {
                    setSenhaObrigatoria(false);
                    setModalSenhaAberto(false);
                }}
            />

            <Suspense fallback={null}>
                {olindaAlvoIdx !== null && Boolean(olindaContratoAtual) && (
                    <ModalRankingOlinda
                        aberto
                        modalidadeId={olindaContratoAtual?.modalidadeId ?? ""}
                        dataRef={olindaContratoAtual?.dataContrato ?? ""}
                        bancoAtual={olindaContratoAtual?.instituicao ?? ""}
                        onFechar={() => setOlindaAlvoIdx(null)}
                        onSelecionarTaxa={aplicarTaxaOlinda}
                        onPreencherBanco={preencherBancoOlinda}
                    />
                )}

                {djenContexto !== null && (
                    <ModalConsultaDjen
                        aberto
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
                )}

                {sheetTarefaAlvo !== null && (
                    <SheetTarefa
                        alvo={sheetTarefaAlvo}
                        calculos={calculos}
                        agendaIndisponivel={agendaIndisponivel}
                        onFechar={() => setSheetTarefaAlvo(null)}
                        onSalvo={(salva, modo) => {
                            setTarefas((prev) => {
                                const lista =
                                    modo === "criar"
                                        ? [...prev, salva]
                                        : prev.map((t) => (t.id === salva.id ? salva : t));
                                return lista.sort(
                                    (a, b) =>
                                        a.data.localeCompare(b.data) ||
                                        (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99"),
                                );
                            });
                        }}
                        onExcluido={(id) => setTarefas((prev) => prev.filter((t) => t.id !== id))}
                    />
                )}
            </Suspense>

            <Suspense fallback={<CarregandoTela />}>
                {aba === "inicio" && (
                    <InicioSistema
                        calculos={calculos}
                        calculosCarteira={calculosCarteira}
                        processosSalvos={processosSalvos}
                        categorias={categorias}
                        tarefas={tarefas}
                        carregando={carregandoBanco}
                        verificandoDjen={verificandoDjen}
                        agendaIndisponivel={agendaIndisponivel}
                        onNovoCalculo={limparFormulario}
                        onNovaTarefa={(dataInicial) =>
                            setSheetTarefaAlvo({ modo: "criar", dataInicial: dataInicial || dataHojeLocalISO() })
                        }
                        onEditarTarefa={(tarefa) => setSheetTarefaAlvo({ modo: "editar", tarefa })}
                        onTarefaAtualizada={(atualizada) =>
                            setTarefas((prev) => prev.map((t) => (t.id === atualizada.id ? atualizada : t)))
                        }
                        onAbrirRadarDjen={() => setDjenContexto({ modoInicial: "oab" })}
                        onVerificarDjen={() => void verificarPublicacoesSalvas(true)}
                        onAbrirCaso={abrirCasoDoHistorico}
                        onAbrirProcesso={abrirProcessoSalvo}
                        onAbrirCasoOuProcesso={abrirCasoOuProcesso}
                        onNavegar={(rota) => navigate(rota)}
                    />
                )}

                {aba === "agenda" && (
                    <AgendaSistema
                        tarefas={tarefas}
                        calculos={calculos}
                        carregando={carregandoBanco}
                        agendaIndisponivel={agendaIndisponivel}
                        onRecarregar={carregarDadosEscritorio}
                        onAbrirNovaTarefa={(dataInicial) =>
                            setSheetTarefaAlvo({ modo: "criar", dataInicial: dataInicial || dataHojeLocalISO() })
                        }
                        onEditarTarefa={(tarefa) => setSheetTarefaAlvo({ modo: "editar", tarefa })}
                        onAtualizada={(atualizada) =>
                            setTarefas((prev) => prev.map((t) => (t.id === atualizada.id ? atualizada : t)))
                        }
                        onAbrirCasoOuProcesso={abrirCasoOuProcesso}
                    />
                )}

                {aba === "clientes" && (
                    <ClientesSistema
                        calculos={calculos}
                        clienteIdRota={rotaClienteId}
                        onNavegarCliente={(id, opcoes) =>
                            navigate(id ? `${BASE_ROTA}/clientes/${encodeURIComponent(id)}` : `${BASE_ROTA}/clientes`, {
                                replace: opcoes?.substituir,
                            })
                        }
                        onAbrirCaso={abrirCasoOuProcesso}
                        onGerarDocumento={(clienteId) =>
                            navigate(`${BASE_ROTA}/documentos?gerar=1&clienteId=${encodeURIComponent(clienteId)}`)
                        }
                        onRecarregarCasos={() => void carregarDadosEscritorio()}
                    />
                )}

                {aba === "atendimento" && <AtendimentoSistema onPendentesChange={setAtendimentoPendentes} />}

                {aba === "documentos" && <DocumentosSistema calculos={calculos} />}

                {aba === "painel" && (
                    <PainelEstatisticas
                        calculos={calculosCarteira}
                        categorias={categorias}
                        carregando={carregandoBanco}
                        onRecarregar={carregarDadosEscritorio}
                        onIrCalculadora={() => navigate(ROTA_CALCULO)}
                        onAbrirHistoricoCategoria={(catId) => {
                            const qs = catId && catId !== "todas" ? `?cat=${encodeURIComponent(catId)}` : "";
                            navigate(`${BASE_ROTA}/historico${qs}`);
                        }}
                        tipos={tipos}
                        onAbrirHistoricoTipo={(tipoId) => navigate(`${BASE_ROTA}/historico?tipo=${encodeURIComponent(tipoId)}`)}
                    />
                )}

                {(aba === "historico" || aba === "crm") && (
                    <HistoricoCalculos
                        key={aba}
                        visao={aba === "crm" ? "crm" : "carteira"}
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
                        onGerenciarCategorias={() => navigate(`${BASE_ROTA}/configuracoes?aba=fases`)}
                        onCategoriasAlteradas={setCategorias}
                        tipos={tipos}
                        onAbrirDjen={(c) =>
                            setDjenContexto({
                                modoInicial: "processo",
                                calculoId: c.id,
                                clienteNome: c.cliente_nome,
                                processoGlobal: c.processo_global,
                            })
                        }
                        onAbrirRadarDjen={() => setDjenContexto({ modoInicial: "oab" })}
                        onAdicionarPrazo={(c) =>
                            setSheetTarefaAlvo({
                                modo: "criar",
                                dataInicial: dataHojeLocalISO(),
                                calculoIdInicial: c.id,
                            })
                        }
                    />
                )}

                {aba === "processos" && (
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
                        onAdicionarPrazo={(c) =>
                            setSheetTarefaAlvo({
                                modo: "criar",
                                dataInicial: dataHojeLocalISO(),
                                calculoIdInicial: c.id,
                            })
                        }
                    />
                )}

                {aba === "configuracoes" && (
                    <ConfiguracoesSistema
                        userEmail={sessao.user.email}
                        onSair={() => void encerrarSessao()}
                        fasesECategorias={
                            <div className="grid max-w-6xl gap-8 xl:grid-cols-2">
                                <section className="space-y-3">
                                    <div>
                                        <h2 className="sys-section text-ink">Fases</h2>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            Etapas do fluxo do caso. São as colunas do CRM.
                                        </p>
                                    </div>
                                    <GerenciarCategorias
                                        tipoLista="fase"
                                        categorias={categorias}
                                        contagemPorCategoria={contagemPorCategoria}
                                        onChange={(novas) => {
                                            setCategorias(novas);
                                            if (ficha.categoriaId && !novas.some((c) => c.id === ficha.categoriaId)) {
                                                setFicha((f) => ({ ...f, categoriaId: null }));
                                            }
                                        }}
                                    />
                                </section>
                                <section className="space-y-3">
                                    <div>
                                        <h2 className="sys-section text-ink">Categorias</h2>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            Tipo da ação. Aparecem como etiqueta no caso e servem de filtro.
                                        </p>
                                    </div>
                                    <GerenciarCategorias
                                        tipoLista="categoria"
                                        categorias={tipos}
                                        contagemPorCategoria={contagemPorTipo}
                                        onChange={(novas) => {
                                            setTipos(novas);
                                            if (ficha.tipoId && !novas.some((t) => t.id === ficha.tipoId)) {
                                                setFicha((f) => ({ ...f, tipoId: null }));
                                            }
                                        }}
                                    />
                                </section>
                            </div>
                        }
                    />
                )}
            </Suspense>

            {aba === "calculadora" && (
                <div className="grid gap-x-8 gap-y-8 lg:grid-cols-12">
                    {(calculoAtivoId || origemHistorico) && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-3 lg:col-span-12">
                            <button
                                type="button"
                                onClick={voltarParaHistorico}
                                className="inline-flex items-center gap-2 text-xs font-semibold text-ink hover:underline"
                            >
                                <ArrowLeft className="size-3.5" />
                                Voltar para {origemEhCrm ? "o CRM" : "a carteira"}
                            </button>
                            {ficha.clienteNome && (
                                <span className="text-xs text-muted-foreground">
                                    Editando ficha de <strong className="text-ink">{ficha.clienteNome}</strong>
                                </span>
                            )}
                        </div>
                    )}

                    <form onSubmit={calcular} noValidate className="min-w-0 space-y-5 lg:col-span-5">
                        {MOSTRAR_LEITURA_CLAUDE && (
                            <Suspense fallback={null}>
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
                            </Suspense>
                        )}

                        {/* Identificação do caso */}
                        <section className="space-y-4 border border-ink/20 bg-card p-5">
                            <div className="flex items-baseline justify-between gap-3 border-b border-ink/15 pb-2.5">
                                <h2 className="sys-section text-ink">Identificação do caso</h2>
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

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                                <div>
                                    <label htmlFor="adv-processo" className={labelClass}>
                                        Nº do processo (CNJ)
                                    </label>
                                    <div className="flex items-end gap-2">
                                        <input
                                            id="adv-processo"
                                            value={ficha.processoGlobal ?? ""}
                                            onChange={(e) => setFicha({ ...ficha, processoGlobal: e.target.value })}
                                            maxLength={80}
                                            placeholder="0002720-86.2026.8.17.1130"
                                            className="field min-w-0 flex-1 py-2 text-sm tabular-nums"
                                        />
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
                                            title="Consultar publicações deste processo no DJEN"
                                            className="mb-1 inline-flex h-7 shrink-0 items-center gap-1 border border-ink/20 px-2 text-[11px] font-semibold text-gold-deep transition-colors duration-150 hover:border-ink/45 hover:text-ink"
                                        >
                                            <Gavel aria-hidden className="size-3" />
                                            DJEN
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-baseline justify-between gap-2">
                                        <label htmlFor="adv-cat" className={labelClass}>
                                            Fase
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
                                        <option value="">Sem fase</option>
                                        {categorias.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="adv-tipo" className={labelClass}>
                                    Categoria (tipo da ação)
                                </label>
                                <select
                                    id="adv-tipo"
                                    value={ficha.tipoId ?? ""}
                                    onChange={(e) => setFicha({ ...ficha, tipoId: e.target.value || null })}
                                    className="field cursor-pointer py-2 text-sm [&>option]:text-ink"
                                >
                                    <option value="">Sem categoria</option>
                                    {tipos.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.nome}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {criandoCatRapida && (
                                <div className="flex items-center gap-2 border border-ink/15 bg-secondary/40 p-2.5">
                                    <input
                                        value={nomeCatRapida}
                                        onChange={(e) => setNomeCatRapida(e.target.value)}
                                        placeholder="Nome da nova fase"
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

                    <div ref={topoRes} className="min-w-0 scroll-mt-6 lg:col-span-7">
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
                            <div className="border border-dashed border-ink/25 bg-card p-6 lg:sticky lg:top-20">
                                <h2 className="sys-section text-ink">O resultado aparece aqui</h2>
                                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                                    {MOSTRAR_LEITURA_CLAUDE
                                        ? "Preencha os dados do contrato ao lado ou solte o PDF da CCB no painel do Claude para gerar o comparativo BACEN, os gráficos e o Laudo PDF A4."
                                        : "Preencha os dados do contrato ao lado para gerar o comparativo BACEN, os gráficos e o Laudo PDF A4."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </ShellSistema>
    );
};

export default CalculadoraAdvogado;
