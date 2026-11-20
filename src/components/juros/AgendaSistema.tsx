import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
    AlertTriangle,
    Calendar as CalendarIcon,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    ExternalLink,
    List,
    Loader2,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    ROTULO_TIPO_TAREFA,
    atualizarTarefa,
    criarTarefa,
    dataHojeLocalISO,
    excluirTarefa,
    formatarDataDiaTitulo,
    gerarUrlGoogleCalendar,
    isCalculoPendente,
    somarDiasISO,
    type CalculoSalvo,
    type Tarefa,
    type TarefaPayload,
    type TipoTarefa,
} from "@/lib/revisional-db";
import { useTravarRolagem } from "@/lib/use-travar-rolagem";
import { BarraPaginacao } from "@/components/juros/PaginacaoLista";

const CLASSE_TIPO_TAREFA: Record<TipoTarefa, string> = {
    prazo: "text-destructive font-semibold",
    audiencia: "text-gold-deep font-semibold",
    reuniao: "text-ink font-semibold",
    tarefa: "text-muted-foreground font-medium",
};

const PONTO_TIPO_TAREFA: Record<TipoTarefa, string> = {
    prazo: "bg-destructive",
    audiencia: "bg-gold",
    reuniao: "bg-ink",
    tarefa: "bg-ink/40",
};

const OPCOES_TIPO: Array<{ value: TipoTarefa; label: string }> = [
    { value: "prazo", label: "Prazo" },
    { value: "audiencia", label: "Audiência" },
    { value: "reuniao", label: "Reunião" },
    { value: "tarefa", label: "Tarefa" },
];

const DIAS_SEMANA_CAB = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/* ----------------------------------------------------- Linha compartilhada (Início + Agenda) */

interface LinhaTarefaAgendaProps {
    tarefa: Tarefa;
    hojeIso: string;
    casoVinculado?: CalculoSalvo | null;
    alternando?: boolean;
    onAlternarConcluida: (tarefa: Tarefa) => void;
    onEditar: (tarefa: Tarefa) => void;
    onAbrirCaso?: (caso: CalculoSalvo) => void;
}

export const LinhaTarefaAgenda = ({
    tarefa,
    hojeIso,
    casoVinculado,
    alternando = false,
    onAlternarConcluida,
    onEditar,
    onAbrirCaso,
}: LinhaTarefaAgendaProps) => {
    const atrasada = !tarefa.concluida && tarefa.data < hojeIso;

    return (
        <div
            className={cn(
                "flex items-start justify-between gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-ink/[0.025]",
                tarefa.concluida && "opacity-65",
            )}
        >
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={tarefa.concluida}
                    aria-label={
                        tarefa.concluida
                            ? `Reabrir "${tarefa.titulo}"`
                            : `Concluir "${tarefa.titulo}"`
                    }
                    disabled={alternando}
                    onClick={() => onAlternarConcluida(tarefa)}
                    className={cn(
                        "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center border transition-colors duration-150",
                        tarefa.concluida
                            ? "border-ink bg-ink text-paper"
                            : "border-ink/40 bg-card hover:border-ink",
                    )}
                >
                    {tarefa.concluida && <Check aria-hidden className="size-3" />}
                </button>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span
                            className={cn(
                                "text-xs",
                                atrasada && tarefa.tipo === "prazo"
                                    ? "font-semibold text-destructive"
                                    : CLASSE_TIPO_TAREFA[tarefa.tipo],
                            )}
                        >
                            {ROTULO_TIPO_TAREFA[tarefa.tipo]}
                        </span>
                        {tarefa.hora && (
                            <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                                <Clock aria-hidden className="size-3" />
                                {tarefa.hora}
                            </span>
                        )}
                        {atrasada && (
                            <span className="text-[11px] font-semibold text-destructive">
                                Atrasado ({tarefa.data.split("-").reverse().join("/")})
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => onEditar(tarefa)}
                        className={cn(
                            "mt-0.5 block max-w-full text-left font-medium text-ink hover:underline",
                            tarefa.concluida && "line-through text-muted-foreground",
                        )}
                    >
                        {tarefa.titulo}
                    </button>

                    {(casoVinculado || tarefa.observacoes) && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {casoVinculado && onAbrirCaso && (
                                <button
                                    type="button"
                                    onClick={() => onAbrirCaso(casoVinculado)}
                                    className="inline-flex items-center gap-1 font-medium text-gold-deep hover:text-ink hover:underline"
                                >
                                    <span className="truncate max-w-[16rem]">{casoVinculado.cliente_nome}</span>
                                    <ExternalLink aria-hidden className="size-3 shrink-0" />
                                </button>
                            )}
                            {tarefa.observacoes && (
                                <span className="line-clamp-1 max-w-md">{tarefa.observacoes}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <BotaoGoogleAgenda tarefa={tarefa} casoVinculado={casoVinculado} />
        </div>
    );
};

/** Ícone do Google Agenda (quadrado com moldura nas cores do Google e o "31"), desenhado em SVG. */
export const IconeGoogleAgenda = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" className={className}>
        <path fill="#1967D2" d="M0 5.5V3a3 3 0 0 1 3-3h2.5v5.5z" />
        <path fill="#4285F4" d="M5.5 0h13v5.5h-13zM0 5.5h5.5v13H0z" />
        <path fill="#1967D2" d="M18.5 0H21a3 3 0 0 1 3 3v2.5h-5.5z" />
        <path fill="#FBBC04" d="M18.5 5.5H24v13h-5.5z" />
        <path fill="#188038" d="M0 18.5h5.5V24H3a3 3 0 0 1-3-3z" />
        <path fill="#34A853" d="M5.5 18.5h13V24h-13z" />
        <path fill="#EA4335" d="M18.5 24 24 18.5h-5.5z" />
        <path fill="#fff" d="M5.5 5.5h13v13h-13z" />
        <text
            x="12"
            y="15.4"
            textAnchor="middle"
            fill="#1A73E8"
            fontFamily="Archivo Variable, Archivo, system-ui, sans-serif"
            fontSize="8.4"
            fontWeight="700"
        >
            31
        </text>
    </svg>
);

/** Atalho discreto (ícone) para enviar o compromisso ao Google Agenda, sem disputar largura com o título. */
export const BotaoGoogleAgenda = ({
    tarefa,
    casoVinculado,
    className,
}: {
    tarefa: Tarefa;
    casoVinculado?: CalculoSalvo | null;
    className?: string;
}) => (
    <a
        href={gerarUrlGoogleCalendar(tarefa, casoVinculado)}
        target="_blank"
        rel="noopener noreferrer"
        title="Adicionar ao Google Agenda"
        aria-label={`Adicionar "${tarefa.titulo}" ao Google Agenda (abre em nova aba)`}
        className={cn(
            "group/gcal hidden size-7 shrink-0 items-center justify-center border border-transparent transition-colors duration-150 hover:border-ink/20 hover:bg-ink/[0.04] focus-visible:border-ink/30 sm:inline-flex",
            className,
        )}
    >
        <IconeGoogleAgenda className="size-[18px] opacity-80 transition-opacity duration-150 group-hover/gcal:opacity-100 group-focus-visible/gcal:opacity-100" />
    </a>
);

/* ----------------------------------------------------- Sheet lateral de Tarefa */

export type AlvoSheetTarefa =
    | { modo: "criar"; dataInicial?: string; calculoIdInicial?: string | null }
    | { modo: "editar"; tarefa: Tarefa };

interface SheetTarefaProps {
    alvo: AlvoSheetTarefa | null;
    calculos: CalculoSalvo[];
    agendaIndisponivel: boolean;
    onFechar: () => void;
    onSalvo: (tarefa: Tarefa, modo: "criar" | "editar") => void;
    onExcluido: (id: string) => void;
}

export const SheetTarefa = ({
    alvo,
    calculos,
    agendaIndisponivel,
    onFechar,
    onSalvo,
    onExcluido,
}: SheetTarefaProps) => {
    const [titulo, setTitulo] = useState("");
    const [tipo, setTipo] = useState<TipoTarefa>("prazo");
    const [data, setData] = useState(() => dataHojeLocalISO());
    const [hora, setHora] = useState("");
    const [calculoId, setCalculoId] = useState<string | null>(null);
    const [concluida, setConcluida] = useState(false);
    const [observacoes, setObservacoes] = useState("");

    const [buscaCaso, setBuscaCaso] = useState("");
    const [listaCasosAberta, setListaCasosAberta] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [excluindo, setExcluindo] = useState(false);
    const [confirmarExclusao, setConfirmarExclusao] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const tituloInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!alvo) return;
        setErro(null);
        setConfirmarExclusao(false);
        setListaCasosAberta(false);
        setBuscaCaso("");

        if (alvo.modo === "editar") {
            const t = alvo.tarefa;
            setTitulo(t.titulo);
            setTipo(t.tipo);
            setData(t.data || dataHojeLocalISO());
            setHora(t.hora ?? "");
            setCalculoId(t.calculo_id);
            setConcluida(t.concluida);
            setObservacoes(t.observacoes);
        } else {
            setTitulo("");
            setTipo(alvo.calculoIdInicial ? "prazo" : "tarefa");
            setData(alvo.dataInicial || dataHojeLocalISO());
            setHora("");
            setCalculoId(alvo.calculoIdInicial ?? null);
            setConcluida(false);
            setObservacoes("");
        }

        requestAnimationFrame(() => tituloInputRef.current?.focus());
    }, [alvo]);

    useEffect(() => {
        if (!alvo) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onFechar();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [alvo, onFechar]);

    useTravarRolagem(Boolean(alvo));

    const casoSelecionado = useMemo(
        () => (calculoId ? calculos.find((c) => c.id === calculoId) ?? null : null),
        [calculos, calculoId],
    );

    const casosFiltrados = useMemo(() => {
        const termo = buscaCaso.trim().toLowerCase();
        if (!termo) return calculos.slice(0, 8);
        return calculos
            .filter((c) =>
                [c.cliente_nome, c.processo_global, c.banco, c.documento_contrato]
                    .join(" ")
                    .toLowerCase()
                    .includes(termo),
            )
            .slice(0, 8);
    }, [buscaCaso, calculos]);

    if (!alvo) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (agendaIndisponivel) {
            setErro("A agenda precisa da migração do banco antes de salvar.");
            return;
        }
        const tituloLimpo = titulo.trim();
        if (!tituloLimpo) {
            setErro("Informe o título da tarefa ou prazo.");
            tituloInputRef.current?.focus();
            return;
        }
        if (!data) {
            setErro("Informe a data.");
            return;
        }

        const payload: TarefaPayload = {
            titulo: tituloLimpo,
            tipo,
            data,
            hora: hora.trim() ? hora.trim() : null,
            calculo_id: calculoId,
            concluida,
            observacoes: observacoes.trim(),
        };

        setSalvando(true);
        setErro(null);
        try {
            if (alvo.modo === "editar") {
                const atualizada = await atualizarTarefa(alvo.tarefa.id, payload);
                onSalvo(atualizada, "editar");
                toast.success("Agenda atualizada.");
            } else {
                const criada = await criarTarefa(payload);
                onSalvo(criada, "criar");
                toast.success("Item adicionado à agenda.");
            }
            onFechar();
        } catch (err) {
            setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
        } finally {
            setSalvando(false);
        }
    };

    const handleExcluir = async () => {
        if (alvo.modo !== "editar") return;
        setExcluindo(true);
        try {
            await excluirTarefa(alvo.tarefa.id);
            onExcluido(alvo.tarefa.id);
            toast.success("Item excluído da agenda.");
            onFechar();
        } catch (err) {
            setErro(err instanceof Error ? err.message : "Não foi possível excluir.");
        } finally {
            setExcluindo(false);
        }
    };

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-sheet-tarefa"
            className="fixed inset-0 z-50 flex justify-end"
        >
            <div
                aria-hidden
                onClick={onFechar}
                className="fixed inset-0 bg-ink-deep/45 transition-opacity duration-200"
            />
            <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-ink/20 bg-card shadow-2xl">
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-ink/15 px-5">
                    <h2 id="titulo-sheet-tarefa" className="sys-title text-ink">
                        {alvo.modo === "editar" ? "Editar tarefa / prazo" : "Nova tarefa ou prazo"}
                    </h2>
                    <button
                        type="button"
                        onClick={onFechar}
                        aria-label="Fechar painel"
                        className="inline-flex size-8 items-center justify-center text-muted-foreground hover:text-ink"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
                    <div className="flex-1 space-y-5 p-5">
                        <div>
                            <label htmlFor="tarefa-titulo" className="sys-label block text-ink">
                                Título
                            </label>
                            <input
                                ref={tituloInputRef}
                                id="tarefa-titulo"
                                value={titulo}
                                onChange={(e) => setTitulo(e.target.value)}
                                maxLength={200}
                                placeholder="Ex.: Protocolar contestação, audiência CEJUSC..."
                                className="field py-2 text-sm"
                                required
                            />
                        </div>

                        <div>
                            <span className="sys-label block text-ink">Tipo</span>
                            <div
                                role="group"
                                aria-label="Tipo do compromisso"
                                className="mt-2 grid grid-cols-4 border border-ink/25 bg-background"
                            >
                                {OPCOES_TIPO.map((op, idx) => {
                                    const ativo = tipo === op.value;
                                    return (
                                        <button
                                            key={op.value}
                                            type="button"
                                            aria-pressed={ativo}
                                            onClick={() => setTipo(op.value)}
                                            className={cn(
                                                "h-9 text-xs font-semibold transition-colors duration-150",
                                                idx > 0 && "border-l border-ink/20",
                                                ativo ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                                            )}
                                        >
                                            {op.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="tarefa-data" className="sys-label block text-ink">
                                    Data
                                </label>
                                <input
                                    id="tarefa-data"
                                    type="date"
                                    value={data}
                                    onChange={(e) => setData(e.target.value)}
                                    className="field py-2 text-sm tabular-nums"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="tarefa-hora" className="sys-label block text-ink">
                                    Hora (opcional)
                                </label>
                                <input
                                    id="tarefa-hora"
                                    type="time"
                                    value={hora}
                                    onChange={(e) => setHora(e.target.value)}
                                    className="field py-2 text-sm tabular-nums"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between gap-2">
                                <label htmlFor="tarefa-caso-busca" className="sys-label text-ink">
                                    Caso ou processo vinculado
                                </label>
                                {casoSelecionado && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCalculoId(null);
                                            setBuscaCaso("");
                                        }}
                                        className="text-xs font-medium text-muted-foreground hover:text-ink hover:underline"
                                    >
                                        Desvincular
                                    </button>
                                )}
                            </div>

                            {casoSelecionado ? (
                                <div className="mt-2 flex items-center justify-between gap-2 border border-ink/25 bg-background px-3 py-2 text-xs">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-ink">
                                            {casoSelecionado.cliente_nome}
                                        </p>
                                        <p className="truncate text-muted-foreground">
                                            {[casoSelecionado.processo_global, casoSelecionado.banco]
                                                .filter(Boolean)
                                                .join(" · ") ||
                                                (isCalculoPendente(casoSelecionado)
                                                    ? "Processo DJEN"
                                                    : "Caso da carteira")}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setListaCasosAberta(true)}
                                        className="shrink-0 text-xs font-semibold text-gold-deep hover:text-ink"
                                    >
                                        Trocar
                                    </button>
                                </div>
                            ) : (
                                <div className="relative mt-1.5">
                                    <Search
                                        aria-hidden
                                        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <input
                                        id="tarefa-caso-busca"
                                        type="search"
                                        value={buscaCaso}
                                        onFocus={() => setListaCasosAberta(true)}
                                        onChange={(e) => {
                                            setBuscaCaso(e.target.value);
                                            setListaCasosAberta(true);
                                        }}
                                        placeholder="Buscar cliente, CNJ ou banco…"
                                        className="h-9 w-full border border-ink/25 bg-background pl-8 pr-3 text-xs text-ink placeholder:text-muted-foreground focus:border-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                                    />
                                </div>
                            )}

                            {listaCasosAberta && (
                                <div className="mt-1.5 max-h-44 overflow-y-auto border border-ink/25 bg-card">
                                    {casosFiltrados.length === 0 ? (
                                        <p className="px-3 py-2 text-xs text-muted-foreground">
                                            Nenhum caso encontrado.
                                        </p>
                                    ) : (
                                        <ul className="divide-y divide-ink/10">
                                            {casosFiltrados.map((c) => (
                                                <li key={c.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCalculoId(c.id);
                                                            setBuscaCaso("");
                                                            setListaCasosAberta(false);
                                                        }}
                                                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-ink/5"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate font-semibold text-ink">
                                                                {c.cliente_nome}
                                                            </p>
                                                            <p className="truncate text-[11px] text-muted-foreground">
                                                                {[c.processo_global, c.banco]
                                                                    .filter(Boolean)
                                                                    .join(" · ") || "Sem CNJ"}
                                                            </p>
                                                        </div>
                                                        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                                                            {isCalculoPendente(c) ? "Processo" : "Carteira"}
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="tarefa-obs" className="sys-label block text-ink">
                                Observações
                            </label>
                            <textarea
                                id="tarefa-obs"
                                rows={3}
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                maxLength={2000}
                                placeholder="Link da audiência, documentos necessários, observações..."
                                className="field resize-y py-2 text-sm"
                            />
                        </div>

                        {alvo.modo === "editar" && (
                            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink select-none">
                                <input
                                    type="checkbox"
                                    checked={concluida}
                                    onChange={(e) => setConcluida(e.target.checked)}
                                    className="size-4 accent-ink"
                                />
                                Marcar como concluída
                            </label>
                        )}

                        {data && (
                            <div className="border-t border-ink/10 pt-3">
                                <a
                                    href={gerarUrlGoogleCalendar(
                                        {
                                            titulo: titulo.trim() || "Compromisso jurídico",
                                            tipo,
                                            data,
                                            hora: hora.trim() || null,
                                            observacoes,
                                        },
                                        casoSelecionado,
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 items-center gap-1.5 border border-ink/20 bg-background px-2.5 text-xs font-medium text-ink transition-colors hover:border-ink/45 hover:bg-ink/[0.04]"
                                >
                                    <IconeGoogleAgenda className="size-4" />
                                    <span>Enviar para Google Agenda</span>
                                    <ExternalLink aria-hidden className="size-3" />
                                </a>
                            </div>
                        )}

                        {erro && (
                            <p
                                role="alert"
                                className="border-t border-destructive pt-2 text-xs font-medium text-destructive"
                            >
                                {erro}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/15 bg-background px-5 py-3.5">
                        {alvo.modo === "editar" ? (
                            confirmarExclusao ? (
                                <div className="inline-flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        disabled={excluindo}
                                        onClick={handleExcluir}
                                        className="inline-flex h-9 items-center bg-destructive px-3 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
                                    >
                                        {excluindo ? "Excluindo…" : "Confirmar exclusão"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmarExclusao(false)}
                                        className="inline-flex h-9 items-center border border-ink/25 px-2.5 text-xs font-medium text-ink"
                                    >
                                        Não
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmarExclusao(true)}
                                    className="inline-flex h-9 items-center gap-1.5 border border-ink/25 px-3 text-xs font-medium text-ink/75 hover:border-destructive hover:text-destructive"
                                >
                                    <Trash2 aria-hidden className="size-3.5" />
                                    Excluir
                                </button>
                            )
                        ) : (
                            <span />
                        )}

                        <div className="inline-flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onFechar}
                                className="inline-flex h-9 items-center border border-ink/25 bg-card px-3.5 text-xs font-semibold text-ink hover:bg-ink/5"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={salvando || agendaIndisponivel}
                                className="inline-flex h-9 items-center gap-1.5 bg-gold px-4 text-xs font-semibold text-ink hover:bg-gold-light disabled:opacity-60"
                            >
                                {salvando && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
                                Salvar
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
};


/* ----------------------------------------------------- Tela Agenda */

interface AgendaSistemaProps {
    tarefas: Tarefa[];
    calculos: CalculoSalvo[];
    carregando: boolean;
    agendaIndisponivel: boolean;
    onRecarregar: () => void;
    onAbrirNovaTarefa: (dataInicial?: string) => void;
    onEditarTarefa: (tarefa: Tarefa) => void;
    onAtualizada: (tarefa: Tarefa) => void;
    onAbrirCasoOuProcesso: (caso: CalculoSalvo) => void;
}

/** Etiqueta do compromisso na visão Mês: fundo leve na cor do tipo. */
const CLASSE_ETIQUETA_TIPO: Record<TipoTarefa, string> = {
    prazo: "bg-destructive/10 text-destructive",
    audiencia: "bg-gold/20 text-ink",
    reuniao: "bg-ink/10 text-ink",
    tarefa: "bg-ink/[0.05] text-ink/80",
};

const MESES_LONGOS = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
];
const DIAS_SEMANA_LONGOS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function dataDeIso(iso: string): Date {
    const [ano, mes, dia] = iso.split("-").map(Number);
    return new Date(ano, (mes || 1) - 1, dia || 1, 12, 0, 0);
}

/** Segunda-feira da semana que contém a data. */
function segundaDaSemana(iso: string): string {
    const offset = (dataDeIso(iso).getDay() + 6) % 7;
    return somarDiasISO(iso, -offset);
}

/** "16 – 22 de novembro de 2026" · "30 de novembro – 6 de dezembro de 2026". */
function rotuloSemana(segundaIso: string): string {
    const ini = dataDeIso(segundaIso);
    const fim = dataDeIso(somarDiasISO(segundaIso, 6));
    if (ini.getMonth() === fim.getMonth()) {
        return `${ini.getDate()} – ${fim.getDate()} de ${MESES_LONGOS[fim.getMonth()]} de ${fim.getFullYear()}`;
    }
    const sufixoAnoIni = ini.getFullYear() !== fim.getFullYear() ? ` de ${ini.getFullYear()}` : "";
    return `${ini.getDate()} de ${MESES_LONGOS[ini.getMonth()]}${sufixoAnoIni} – ${fim.getDate()} de ${
        MESES_LONGOS[fim.getMonth()]
    } de ${fim.getFullYear()}`;
}

const ordenarPorDataHora = (a: Tarefa, b: Tarefa) =>
    a.data.localeCompare(b.data) || (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99");

/* Linha da pauta semanal: hora numa coluna própria, depois o compromisso. */
const LinhaPauta = ({
    tarefa,
    hojeIso,
    caso,
    alternando,
    onAlternar,
    onEditar,
    onAbrirCaso,
}: {
    tarefa: Tarefa;
    hojeIso: string;
    caso: CalculoSalvo | null;
    alternando: boolean;
    onAlternar: (t: Tarefa) => void;
    onEditar: (t: Tarefa) => void;
    onAbrirCaso: (c: CalculoSalvo) => void;
}) => {
    const atrasada = !tarefa.concluida && tarefa.data < hojeIso;
    return (
        <li
            className={cn(
                "grid grid-cols-[1rem_3.25rem_minmax(0,1fr)_auto] items-start gap-x-3 px-3 py-2.5 transition-colors duration-150 hover:bg-ink/[0.025] sm:px-4",
                tarefa.concluida && "opacity-60",
            )}
        >
            <button
                type="button"
                role="checkbox"
                aria-checked={tarefa.concluida}
                aria-label={tarefa.concluida ? `Reabrir "${tarefa.titulo}"` : `Concluir "${tarefa.titulo}"`}
                disabled={alternando}
                onClick={() => onAlternar(tarefa)}
                className={cn(
                    "mt-0.5 inline-flex size-4 items-center justify-center border transition-colors duration-150 disabled:opacity-50",
                    tarefa.concluida ? "border-ink bg-ink text-paper" : "border-ink/40 bg-card hover:border-ink",
                )}
            >
                {tarefa.concluida && <Check aria-hidden className="size-3" />}
            </button>

            <span
                className={cn(
                    "leading-5 tabular-nums",
                    tarefa.hora ? "text-sm font-semibold text-ink" : "text-xs text-muted-foreground",
                    atrasada && "text-destructive",
                )}
            >
                {tarefa.hora ?? "Dia todo"}
            </span>

            <div className="min-w-0">
                <button
                    type="button"
                    onClick={() => onEditar(tarefa)}
                    className={cn(
                        "block max-w-full text-left text-sm font-medium leading-5 text-ink hover:underline",
                        tarefa.concluida && "text-muted-foreground line-through",
                    )}
                >
                    {tarefa.titulo}
                </button>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className={cn("inline-flex items-center gap-1.5", CLASSE_TIPO_TAREFA[tarefa.tipo])}>
                        <span aria-hidden className={cn("size-1.5", PONTO_TIPO_TAREFA[tarefa.tipo])} />
                        {ROTULO_TIPO_TAREFA[tarefa.tipo]}
                    </span>
                    {caso && (
                        <button
                            type="button"
                            onClick={() => onAbrirCaso(caso)}
                            className="max-w-[18rem] truncate font-medium text-gold-deep hover:text-ink hover:underline"
                        >
                            {caso.cliente_nome}
                        </button>
                    )}
                    {tarefa.observacoes && <span className="line-clamp-1 max-w-md">{tarefa.observacoes}</span>}
                </div>
            </div>

            <BotaoGoogleAgenda tarefa={tarefa} casoVinculado={caso} />
        </li>
    );
};

export const AgendaSistema = ({
    tarefas,
    calculos,
    carregando,
    agendaIndisponivel,
    onRecarregar,
    onAbrirNovaTarefa,
    onEditarTarefa,
    onAtualizada,
    onAbrirCasoOuProcesso,
}: AgendaSistemaProps) => {
    const hojeIso = useMemo(() => dataHojeLocalISO(), []);

    const [diaSelecionado, setDiaSelecionado] = useState<string>(hojeIso);
    const [mesCursor, setMesCursor] = useState(() => {
        const d = dataDeIso(dataHojeLocalISO());
        return { ano: d.getFullYear(), mes: d.getMonth() };
    });
    const [visao, setVisao] = useState<"semana" | "mes">("semana");
    const [filtroTipo, setFiltroTipo] = useState<TipoTarefa | "todos">("todos");
    const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
    const [alternandoId, setAlternandoId] = useState<string | null>(null);
    const [paginaAtrasadas, setPaginaAtrasadas] = useState(1);
    const refsDias = useRef(new Map<string, HTMLElement>());

    const mapaCalculos = useMemo(() => new Map(calculos.map((c) => [c.id, c])), [calculos]);
    const casoDe = (t: Tarefa) => (t.calculo_id ? mapaCalculos.get(t.calculo_id) ?? null : null);

    const alternarConcluida = async (t: Tarefa) => {
        setAlternandoId(t.id);
        try {
            const atualizada = await atualizarTarefa(t.id, { concluida: !t.concluida });
            onAtualizada(atualizada);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível atualizar a tarefa.");
        } finally {
            setAlternandoId(null);
        }
    };

    const tarefasFiltradas = useMemo(
        () =>
            tarefas
                .filter((t) => {
                    if (!mostrarConcluidas && t.concluida) return false;
                    if (filtroTipo !== "todos" && t.tipo !== filtroTipo) return false;
                    return true;
                })
                .sort(ordenarPorDataHora),
        [tarefas, mostrarConcluidas, filtroTipo],
    );

    const tarefasPorData = useMemo(() => {
        const mapa = new Map<string, Tarefa[]>();
        for (const t of tarefasFiltradas) {
            const lista = mapa.get(t.data);
            if (lista) lista.push(t);
            else mapa.set(t.data, [t]);
        }
        return mapa;
    }, [tarefasFiltradas]);

    const contagemPorTipo = useMemo(() => {
        const base: Record<TipoTarefa, number> = { prazo: 0, audiencia: 0, reuniao: 0, tarefa: 0 };
        for (const t of tarefas) if (!t.concluida) base[t.tipo] += 1;
        return base;
    }, [tarefas]);

    const atrasadas = useMemo(
        () => tarefas.filter((t) => !t.concluida && t.data < hojeIso).sort(ordenarPorDataHora),
        [tarefas, hojeIso],
    );

    /* ---------- Semana */
    const segunda = useMemo(() => segundaDaSemana(diaSelecionado), [diaSelecionado]);
    const diasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => somarDiasISO(segunda, i)), [segunda]);
    const totalSemana = diasSemana.reduce((soma, iso) => soma + (tarefasPorData.get(iso)?.length ?? 0), 0);

    /* ---------- Mês (mini-calendário e visão Mês) */
    const celulasMes = useMemo(() => {
        const primeiroDia = new Date(mesCursor.ano, mesCursor.mes, 1, 12, 0, 0);
        const ultimoDia = new Date(mesCursor.ano, mesCursor.mes + 1, 0, 12, 0, 0);
        const offsetInicio = (primeiroDia.getDay() + 6) % 7;
        const totalCelulas = Math.ceil((offsetInicio + ultimoDia.getDate()) / 7) * 7;
        const out: Array<{ iso: string; dia: number; noMes: boolean; fimDeSemana: boolean }> = [];
        for (let i = 0; i < totalCelulas; i++) {
            const d = new Date(mesCursor.ano, mesCursor.mes, 1 - offsetInicio + i, 12, 0, 0);
            out.push({
                iso: dataHojeLocalISO(d),
                dia: d.getDate(),
                noMes: d.getMonth() === mesCursor.mes,
                fimDeSemana: d.getDay() === 0 || d.getDay() === 6,
            });
        }
        return out;
    }, [mesCursor]);

    const nomeMes = MESES_LONGOS[mesCursor.mes];
    const tituloMes = `${nomeMes.charAt(0).toUpperCase()}${nomeMes.slice(1)} de ${mesCursor.ano}`;

    const moverMes = (delta: number) =>
        setMesCursor((prev) => {
            const d = new Date(prev.ano, prev.mes + delta, 1, 12, 0, 0);
            return { ano: d.getFullYear(), mes: d.getMonth() };
        });

    const sincronizarMes = (iso: string) => {
        const d = dataDeIso(iso);
        setMesCursor({ ano: d.getFullYear(), mes: d.getMonth() });
    };

    const selecionarDia = (iso: string, rolar = true) => {
        setDiaSelecionado(iso);
        sincronizarMes(iso);
        if (visao !== "semana") setVisao("semana");
        if (rolar) {
            requestAnimationFrame(() =>
                refsDias.current.get(iso)?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
            );
        }
    };

    const moverSemana = (delta: number) => {
        const novo = somarDiasISO(diaSelecionado, delta * 7);
        setDiaSelecionado(novo);
        sincronizarMes(novo);
    };

    if (agendaIndisponivel) {
        return (
            <div className="border border-ink/20 bg-card p-6 sm:p-8">
                <div className="flex items-start gap-3">
                    <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-deep" />
                    <div className="space-y-2">
                        <h2 className="sys-section text-ink">A agenda precisa da migração do banco</h2>
                        <p className="max-w-xl text-sm text-muted-foreground">
                            A tabela <code className="bg-secondary px-1 py-0.5 text-xs">revisional_tarefas</code> ainda
                            não existe neste banco Supabase. Aplique a migração{" "}
                            <code className="bg-secondary px-1 py-0.5 text-xs">
                                20261118120000_revisional_tarefas.sql
                            </code>{" "}
                            e tente novamente.
                        </p>
                        <button
                            type="button"
                            onClick={onRecarregar}
                            disabled={carregando}
                            className="inline-flex h-8 items-center gap-1.5 border border-ink/25 px-3 text-xs font-semibold text-ink hover:bg-ink/5"
                        >
                            <RefreshCw className={cn("size-3.5", carregando && "animate-spin")} />
                            Verificar novamente
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ---------- Blocos */

    const alternadorVisao = (
        <div role="group" aria-label="Modo de visualização" className="sys-grupo inline-flex border border-ink/25 bg-card">
            {(
                [
                    { id: "semana", label: "Semana", Icone: List },
                    { id: "mes", label: "Mês", Icone: CalendarIcon },
                ] as const
            ).map(({ id, label, Icone }, i) => (
                <button
                    key={id}
                    type="button"
                    aria-pressed={visao === id}
                    onClick={() => {
                        setVisao(id);
                        if (id === "mes") sincronizarMes(diaSelecionado);
                    }}
                    className={cn(
                        "inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold transition-colors duration-150",
                        i > 0 && "border-l border-ink/20",
                        visao === id ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                    )}
                >
                    <Icone aria-hidden className="size-3.5" />
                    {label}
                </button>
            ))}
        </div>
    );

    const botaoSeta = (direcao: -1 | 1, onClick: () => void, rotulo: string) => (
        <button
            type="button"
            onClick={onClick}
            aria-label={rotulo}
            className="inline-flex size-9 items-center justify-center border border-ink/25 bg-card text-ink transition-colors duration-150 hover:bg-ink/5"
        >
            {direcao < 0 ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
    );

    const filtros = (
        <section className="border border-ink/15 bg-card">
            <h3 className="border-b border-ink/10 px-4 py-2.5 text-xs font-semibold text-ink">Mostrar</h3>
            <ul className="py-1">
                {[{ value: "todos" as const, label: "Todos os tipos" }, ...OPCOES_TIPO].map((op) => {
                    const ativo = filtroTipo === op.value;
                    const qtd =
                        op.value === "todos"
                            ? Object.values(contagemPorTipo).reduce((a, b) => a + b, 0)
                            : contagemPorTipo[op.value];
                    return (
                        <li key={op.value}>
                            <button
                                type="button"
                                aria-pressed={ativo}
                                onClick={() => setFiltroTipo(op.value)}
                                className={cn(
                                    "flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-sm transition-colors duration-150",
                                    ativo ? "bg-ink/[0.07] font-semibold text-ink" : "text-ink/85 hover:bg-ink/[0.03]",
                                )}
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        "size-2.5 shrink-0",
                                        op.value === "todos" ? "border border-ink/40" : PONTO_TIPO_TAREFA[op.value],
                                    )}
                                />
                                <span className="flex-1">{op.label}</span>
                                <span className="text-xs tabular-nums text-muted-foreground">{qtd}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <label className="flex cursor-pointer select-none items-center gap-2 border-t border-ink/10 px-4 py-2.5 text-xs font-medium text-ink">
                <input
                    type="checkbox"
                    checked={mostrarConcluidas}
                    onChange={(e) => setMostrarConcluidas(e.target.checked)}
                    className="size-3.5 accent-ink"
                />
                Incluir concluídos
            </label>
        </section>
    );

    const fimDaSemana = somarDiasISO(segunda, 6);

    const miniCalendario = (
        <section className="overflow-hidden border border-ink/15 bg-card" aria-label="Calendário do mês">
            <div className="flex items-center justify-between bg-ink px-2 py-1.5">
                <button
                    type="button"
                    onClick={() => moverMes(-1)}
                    aria-label="Mês anterior"
                    className="inline-flex size-8 items-center justify-center text-paper/80 transition-colors duration-150 hover:bg-paper/10 hover:text-paper"
                >
                    <ChevronLeft className="size-4" />
                </button>
                <h3 className="text-sm font-semibold text-paper">{tituloMes}</h3>
                <button
                    type="button"
                    onClick={() => moverMes(1)}
                    aria-label="Próximo mês"
                    className="inline-flex size-8 items-center justify-center text-paper/80 transition-colors duration-150 hover:bg-paper/10 hover:text-paper"
                >
                    <ChevronRight className="size-4" />
                </button>
            </div>
            <div className="px-3 pb-3 pt-2">
                <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground">
                    {DIAS_SEMANA_CAB.map((d) => (
                        <span key={d} className="py-1">
                            {d.charAt(0)}
                        </span>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5">
                    {celulasMes.map((c) => {
                        const naSemana = c.iso >= segunda && c.iso <= fimDaSemana;
                        const itens = tarefasPorData.get(c.iso) ?? [];
                        const selecionado = c.iso === diaSelecionado;
                        const ehHoje = c.iso === hojeIso;
                        return (
                            <button
                                key={c.iso}
                                type="button"
                                onClick={() => selecionarDia(c.iso)}
                                aria-label={`${c.dia} de ${MESES_LONGOS[dataDeIso(c.iso).getMonth()]}${
                                    itens.length ? `, ${itens.length} compromisso(s)` : ""
                                }`}
                                aria-pressed={selecionado}
                                className={cn(
                                    "flex h-10 flex-col items-center justify-center gap-0.5 text-xs tabular-nums transition-colors duration-150",
                                    naSemana ? "bg-gold-light/30" : "hover:bg-ink/[0.04]",
                                    !c.noMes && "text-muted-foreground/50",
                                )}
                            >
                                <span
                                    className={cn(
                                        "inline-flex size-6 items-center justify-center",
                                        ehHoje
                                            ? "rounded-full bg-ink font-semibold text-paper"
                                            : selecionado
                                              ? "font-bold text-ink underline decoration-2 underline-offset-4"
                                              : c.noMes
                                                ? "font-medium text-ink"
                                                : "",
                                    )}
                                >
                                    {c.dia}
                                </span>
                                <span aria-hidden className="flex h-1 gap-px">
                                    {itens.slice(0, 3).map((t) => (
                                        <span key={t.id} className={cn("size-1", PONTO_TIPO_TAREFA[t.tipo])} />
                                    ))}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );

    const POR_PAGINA_ATRASADAS = 6;
    const totalPaginasAtrasadas = Math.max(1, Math.ceil(atrasadas.length / POR_PAGINA_ATRASADAS));
    const paginaAtrasadasSegura = Math.min(paginaAtrasadas, totalPaginasAtrasadas);
    const inicioAtrasadas = (paginaAtrasadasSegura - 1) * POR_PAGINA_ATRASADAS;
    const fimAtrasadas = Math.min(atrasadas.length, inicioAtrasadas + POR_PAGINA_ATRASADAS);

    const blocoAtrasados =
        atrasadas.length > 0 ? (
            <section className="overflow-hidden border border-destructive/30 bg-card">
                <h3 className="flex items-center justify-between bg-destructive px-4 py-2 text-xs font-semibold text-paper">
                    <span>Atrasados</span>
                    <span className="tabular-nums">{atrasadas.length}</span>
                </h3>
                <ul className="divide-y divide-ink/10">
                    {atrasadas.slice(inicioAtrasadas, fimAtrasadas).map((t) => (
                        <li key={t.id} className="flex items-start gap-3 px-4 py-2">
                            <button
                                type="button"
                                role="checkbox"
                                aria-checked={false}
                                aria-label={`Concluir "${t.titulo}"`}
                                disabled={alternandoId === t.id}
                                onClick={() => alternarConcluida(t)}
                                className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center border border-ink/40 bg-card hover:border-ink disabled:opacity-50"
                            />
                            <div className="min-w-0 flex-1">
                                <button
                                    type="button"
                                    onClick={() => onEditarTarefa(t)}
                                    className="block max-w-full truncate text-left text-sm font-medium text-ink hover:underline"
                                >
                                    {t.titulo}
                                </button>
                                <p className="text-xs tabular-nums text-destructive">
                                    {formatarDataDiaTitulo(t.data, hojeIso)}
                                    {t.hora ? ` · ${t.hora}` : ""} · {ROTULO_TIPO_TAREFA[t.tipo]}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
                <BarraPaginacao
                    variante="compacta"
                    pagina={paginaAtrasadasSegura}
                    totalPaginas={totalPaginasAtrasadas}
                    total={atrasadas.length}
                    inicio={inicioAtrasadas}
                    fim={fimAtrasadas}
                    onPagina={setPaginaAtrasadas}
                    rotulo="atrasados"
                    className="border-t border-ink/10 px-4 py-2"
                />
            </section>
        ) : null;

    /* ---------- Visão Semana: faixa de dias + pauta */
    const visaoSemana = (
        <div className="space-y-4">
            <div className="grid grid-cols-7 border border-ink/15 bg-card">
                {diasSemana.map((iso, i) => {
                    const d = dataDeIso(iso);
                    const itens = tarefasPorData.get(iso) ?? [];
                    const selecionado = iso === diaSelecionado;
                    const ehHoje = iso === hojeIso;
                    return (
                        <button
                            key={iso}
                            type="button"
                            onClick={() => selecionarDia(iso)}
                            aria-pressed={selecionado}
                            aria-label={`${DIAS_SEMANA_LONGOS[d.getDay()]}, ${d.getDate()}: ${
                                itens.length ? `${itens.length} compromisso(s)` : "livre"
                            }`}
                            className={cn(
                                "flex min-h-[5.5rem] flex-col items-start gap-1 px-2 py-2.5 text-left transition-colors duration-150 sm:px-3",
                                i > 0 && "border-l border-ink/10",
                                selecionado
                                    ? "bg-ink text-paper"
                                    : i >= 5
                                      ? "bg-secondary/55 text-ink hover:bg-ink/[0.05]"
                                      : "text-ink hover:bg-ink/[0.03]",
                            )}
                        >
                            <span
                                className={cn(
                                    "text-[11px] font-semibold",
                                    selecionado ? "text-paper/75" : ehHoje ? "text-gold-deep" : "text-muted-foreground",
                                )}
                            >
                                {ehHoje ? "Hoje" : DIAS_SEMANA_CAB[i]}
                            </span>
                            <span className="text-2xl font-semibold leading-none tracking-tight tabular-nums sm:text-[1.75rem]">
                                {d.getDate()}
                            </span>
                            <span className="mt-auto flex min-h-2 flex-wrap gap-0.5">
                                {itens.slice(0, 5).map((t) => (
                                    <span
                                        key={t.id}
                                        aria-hidden
                                        className={cn(
                                            "size-2",
                                            PONTO_TIPO_TAREFA[t.tipo],
                                            selecionado && "ring-1 ring-paper/60",
                                            t.concluida && "opacity-40",
                                        )}
                                    />
                                ))}
                            </span>
                        </button>
                    );
                })}
            </div>

            <section className="overflow-hidden border border-ink/15 bg-card" aria-label="Pauta da semana">
                {diasSemana.map((iso, i) => {
                    const d = dataDeIso(iso);
                    const itens = tarefasPorData.get(iso) ?? [];
                    const selecionado = iso === diaSelecionado;
                    const ehHoje = iso === hojeIso;
                    const passado = iso < hojeIso;
                    return (
                        <div
                            key={iso}
                            ref={(el) => {
                                if (el) refsDias.current.set(iso, el);
                                else refsDias.current.delete(iso);
                            }}
                            className={cn(
                                "grid scroll-mt-24 grid-cols-[4.25rem_minmax(0,1fr)] sm:grid-cols-[6rem_minmax(0,1fr)]",
                                i > 0 && "border-t border-ink/15",
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => selecionarDia(iso, false)}
                                className={cn(
                                    "flex flex-col items-start border-r px-3 py-3 text-left transition-colors duration-150 sm:px-4",
                                    selecionado
                                        ? "border-ink bg-ink text-paper"
                                        : "border-ink/10 bg-secondary/40 text-ink hover:bg-secondary/70",
                                )}
                            >
                                <span className="text-[1.6rem] font-semibold leading-none tracking-tight tabular-nums">
                                    {d.getDate()}
                                </span>
                                <span
                                    className={cn(
                                        "mt-1 text-[11px] font-semibold",
                                        selecionado ? "text-paper/75" : ehHoje ? "text-gold-deep" : "text-muted-foreground",
                                    )}
                                >
                                    {ehHoje ? "Hoje" : DIAS_SEMANA_LONGOS[d.getDay()]}
                                </span>
                            </button>

                            <div className="min-w-0">
                                {itens.length === 0 ? (
                                    <div className="flex min-h-[3.5rem] items-center justify-between gap-3 px-3 sm:px-4">
                                        <span
                                            className={cn(
                                                "text-xs",
                                                passado ? "text-muted-foreground/60" : "text-muted-foreground",
                                            )}
                                        >
                                            Livre
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => onAbrirNovaTarefa(iso)}
                                            className="inline-flex h-7 items-center gap-1 px-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
                                        >
                                            <Plus aria-hidden className="size-3.5" />
                                            Agendar
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <ul className="divide-y divide-ink/10">
                                            {itens.map((t) => (
                                                <LinhaPauta
                                                    key={t.id}
                                                    tarefa={t}
                                                    hojeIso={hojeIso}
                                                    caso={casoDe(t)}
                                                    alternando={alternandoId === t.id}
                                                    onAlternar={alternarConcluida}
                                                    onEditar={onEditarTarefa}
                                                    onAbrirCaso={onAbrirCasoOuProcesso}
                                                />
                                            ))}
                                        </ul>
                                        <button
                                            type="button"
                                            onClick={() => onAbrirNovaTarefa(iso)}
                                            className="flex w-full items-center gap-1 border-t border-dashed border-ink/10 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-ink/[0.03] hover:text-ink sm:px-4"
                                        >
                                            <Plus aria-hidden className="size-3.5" />
                                            Agendar neste dia
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </section>
        </div>
    );

    /* ---------- Visão Mês: visão geral; clicar num dia abre a semana dele */
    const visaoMes = (
        <section className="overflow-hidden border border-ink/15 bg-card" aria-label={`Calendário de ${tituloMes}`}>
            <div className="grid grid-cols-7 bg-ink">
                {DIAS_SEMANA_CAB.map((diaSem) => (
                    <div key={diaSem} className="px-2 py-2 text-[11px] font-semibold text-paper/80 sm:px-2.5 sm:text-xs">
                        {diaSem}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {celulasMes.map((celula, idx) => {
                    const itens = tarefasPorData.get(celula.iso) ?? [];
                    const visiveis = itens.slice(0, 4);
                    const excedente = itens.length - visiveis.length;
                    return (
                        <button
                            key={celula.iso}
                            type="button"
                            onClick={() => selecionarDia(celula.iso)}
                            aria-label={`Abrir a semana de ${celula.dia}/${dataDeIso(celula.iso).getMonth() + 1}${
                                itens.length ? `, ${itens.length} compromisso(s)` : ""
                            }`}
                            className={cn(
                                "flex min-h-[3.5rem] flex-col items-stretch border-ink/12 p-1.5 text-left transition-colors duration-150 sm:min-h-[7.5rem] sm:p-2",
                                idx % 7 !== 0 && "border-l",
                                idx >= 7 && "border-t",
                                celula.fimDeSemana ? "bg-secondary/55 hover:bg-ink/[0.05]" : "bg-card hover:bg-ink/[0.03]",
                            )}
                        >
                            <span
                                className={cn(
                                    "inline-flex size-6 items-center justify-center text-xs tabular-nums",
                                    celula.iso === hojeIso
                                        ? "rounded-full bg-ink font-semibold text-paper"
                                        : celula.noMes
                                          ? "font-semibold text-ink"
                                          : "text-muted-foreground/55",
                                )}
                            >
                                {celula.dia}
                            </span>
                            {itens.length > 0 && (
                                <span aria-hidden className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                                    {itens.slice(0, 4).map((t) => (
                                        <span key={t.id} className={cn("size-1.5", PONTO_TIPO_TAREFA[t.tipo])} />
                                    ))}
                                </span>
                            )}
                            {itens.length > 0 && (
                                <span className="mt-1.5 hidden space-y-1 sm:block">
                                    {visiveis.map((t) => (
                                        <span
                                            key={t.id}
                                            className={cn(
                                                "block px-1.5 py-[3px] text-[11px] font-medium leading-snug",
                                                CLASSE_ETIQUETA_TIPO[t.tipo],
                                                t.concluida && "line-through opacity-55",
                                            )}
                                        >
                                            {t.hora && <span className="block font-semibold tabular-nums">{t.hora}</span>}
                                            <span className="line-clamp-2">{t.titulo}</span>
                                        </span>
                                    ))}
                                    {excedente > 0 && (
                                        <span className="block px-1.5 text-[11px] font-semibold text-gold-deep">
                                            +{excedente} {excedente === 1 ? "outro" : "outros"}
                                        </span>
                                    )}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </section>
    );

    return (
        <div className="space-y-5">
            {/* Cabeçalho da Agenda: período em destaque, navegação e modo de visualização */}
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-ink/15 pb-4">
                <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                        {visao === "semana"
                            ? `${totalSemana} ${totalSemana === 1 ? "compromisso" : "compromissos"} na semana`
                            : "Visão do mês · clique num dia para abrir a semana"}
                    </p>
                    <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-ink">
                        {visao === "semana" ? rotuloSemana(segunda) : tituloMes}
                    </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {visao === "semana" ? (
                        <>
                            {botaoSeta(-1, () => moverSemana(-1), "Semana anterior")}
                            {botaoSeta(1, () => moverSemana(1), "Próxima semana")}
                        </>
                    ) : (
                        <>
                            {botaoSeta(-1, () => moverMes(-1), "Mês anterior")}
                            {botaoSeta(1, () => moverMes(1), "Próximo mês")}
                        </>
                    )}
                    <button
                        type="button"
                        onClick={() => selecionarDia(hojeIso)}
                        className="inline-flex h-9 items-center border border-ink/25 bg-card px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5"
                    >
                        Hoje
                    </button>
                    {alternadorVisao}
                    <button
                        type="button"
                        onClick={() => onAbrirNovaTarefa(diaSelecionado)}
                        className="inline-flex h-9 items-center gap-1.5 bg-ink px-3 text-xs font-semibold text-paper transition-colors duration-150 hover:bg-ink-soft"
                    >
                        <Plus aria-hidden className="size-3.5" />
                        Agendar
                    </button>
                </div>
            </header>

            {visao === "semana" ? (
                <div className="grid gap-6 lg:grid-cols-12">
                    <div className="min-w-0 lg:col-span-8 xl:col-span-9">{visaoSemana}</div>
                    <aside className="min-w-0 space-y-4 lg:col-span-4 xl:col-span-3">
                        {miniCalendario}
                        {blocoAtrasados}
                        {filtros}
                    </aside>
                </div>
            ) : (
                <div className="space-y-3">
                    {visaoMes}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {OPCOES_TIPO.map((op) => (
                            <span key={op.value} className="inline-flex items-center gap-1.5">
                                <span aria-hidden className={cn("size-2", PONTO_TIPO_TAREFA[op.value])} />
                                {op.label}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
