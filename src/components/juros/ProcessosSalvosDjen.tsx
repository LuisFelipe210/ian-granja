import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    ArrowLeft,
    Calculator,
    CalendarPlus,
    Check,
    ChevronDown,
    Copy,
    ExternalLink,
    FileText,
    FolderOpen,
    Gavel,
    Loader2,
    Radar,
    RefreshCw,
    Save,
    Search,
    Trash2,
    Users,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { configEscritorioAtual, formatarOab } from "@/lib/config-escritorio";
import { BarraPaginacao } from "@/components/juros/PaginacaoLista";
import { usePaginacao } from "@/lib/use-paginacao";
import { brl } from "@/lib/juros";
import {
    atualizarFichaProcessoDjen,
    formatarClasseProcessual,
    formatarNomeParte,
    formatarRecebidaEm,
    lerDadosProcessoDjen,
    marcarPublicacoesDjenComoVistas,
    resumirTeorPublicacao,
    urlHttpSegura,
    type ProcessoDjenSalvoView,
    type StatusProcessoDjen,
} from "@/lib/juros/djen";
import {
    atualizarCalculo,
    excluirCalculo,
    type CalculoSalvo,
    type Categoria,
} from "@/lib/revisional-db";
import { SeloCategoria } from "@/components/juros/GerenciarCategorias";
import { MenuAcoesLinha } from "@/components/juros/MenuAcoesLinha";

interface ProcessosSalvosDjenProps {
    processos: CalculoSalvo[];
    categorias: Categoria[];
    processoAtivoId: string | null;
    verificandoDjen: boolean;
    intervaloVerificacaoHoras: number;
    onVerificarDjen: () => void;
    onAbrirProcesso: (c: CalculoSalvo) => void;
    onVoltarLista: () => void;
    onAtualizado: (c: CalculoSalvo) => void;
    onExcluido: (id: string) => void;
    onAbrirRadarDjen: () => void;
    onConsultarDjenProcesso: (c: CalculoSalvo) => void;
    onLevarParaCalculadora: (c: CalculoSalvo) => void;
    onAdicionarPrazo?: (c: CalculoSalvo) => void;
}

const OPCOES_STATUS: Array<{ value: StatusProcessoDjen; label: string }> = [
    { value: "prazo_aberto", label: "Prazo em aberto" },
    { value: "em_analise", label: "Em análise" },
    { value: "manifestado", label: "Manifestado" },
    { value: "concluido", label: "Concluído" },
];

/** Marcador quadrado da situação na lista: só "prazo em aberto" usa o acento, porque pede ação. */
const PONTO_STATUS: Record<StatusProcessoDjen, string> = {
    prazo_aberto: "bg-gold",
    em_analise: "bg-ink/45",
    manifestado: "bg-[#126A35]",
    concluido: "bg-ink/20",
};

const ROTULO_STATUS: Record<StatusProcessoDjen, string> = {
    prazo_aberto: "Prazo em aberto",
    em_analise: "Em análise",
    manifestado: "Manifestado",
    concluido: "Concluído",
};

/** "há 12 min", "há 3 h", "em 17/11 às 07:00": horário da última verificação automática. */
function descreverMomento(iso: string, agora: Date = new Date()): string {
    const momento = new Date(iso);
    const minutos = Math.round((agora.getTime() - momento.getTime()) / 60_000);
    if (!Number.isFinite(minutos)) return "";
    if (minutos < 1) return "agora há pouco";
    if (minutos < 60) return `há ${minutos} min`;
    if (minutos < 24 * 60) return `há ${Math.floor(minutos / 60)} h`;
    const data = momento.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const hora = momento.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `em ${data} às ${hora}`;
}

function rotuloPolo(polo: string): string {
    const p = polo.trim().toUpperCase();
    if (p === "A" || p.includes("ATIV")) return "Polo Ativo";
    if (p === "P" || p.includes("PASS")) return "Polo Passivo";
    return p || "Parte";
}

interface ItemProcessoComView {
    calc: CalculoSalvo;
    view: ProcessoDjenSalvoView;
}

interface DetalheProcessoDjenProps {
    item: ItemProcessoComView;
    categorias: Categoria[];
    mapaCategorias: Record<string, Categoria>;
    onVoltarLista: () => void;
    onAtualizado: (c: CalculoSalvo) => void;
    onExcluido: (id: string) => void;
    onConsultarDjenProcesso: (c: CalculoSalvo) => void;
    onLevarParaCalculadora: (c: CalculoSalvo) => void;
    onAdicionarPrazo?: (c: CalculoSalvo) => void;
}

const DetalheProcessoDjen = ({
    item,
    categorias,
    mapaCategorias,
    onVoltarLista,
    onAtualizado,
    onExcluido,
    onConsultarDjenProcesso,
    onLevarParaCalculadora,
    onAdicionarPrazo,
}: DetalheProcessoDjenProps) => {
    const { calc, view } = item;

    const [clienteNome, setClienteNome] = useState(view.clienteNome);
    const [parteContraria, setParteContraria] = useState(view.parteContraria);
    const [processoGlobal, setProcessoGlobal] = useState(view.processoGlobal);
    const [categoriaId, setCategoriaId] = useState<string>(view.categoriaId ?? "");
    const [statusProcesso, setStatusProcesso] = useState<StatusProcessoDjen>(view.statusProcesso);
    const [anotacoesInternas, setAnotacoesInternas] = useState(view.anotacoesInternas);

    const [salvando, setSalvando] = useState(false);
    const [excluindo, setExcluindo] = useState(false);
    const [confirmarExclusao, setConfirmarExclusao] = useState(false);
    const [copiadoChave, setCopiadoChave] = useState<string | null>(null);
    const [idsNovosNaAbertura] = useState(() => new Set(view.idsNovos));
    const listaMovRef = useRef<HTMLDivElement>(null);
    const pagMov = usePaginacao(view.movimentacoes, { porPaginaPadrao: 10 });

    useEffect(() => {
        const patch = marcarPublicacoesDjenComoVistas(calc);
        if (!patch) return;
        let ativo = true;
        atualizarCalculo(calc.id, patch)
            .then((atualizado) => {
                if (ativo) onAtualizado(atualizado);
            })
            .catch(() => {
                /* a marca de "nova" volta na próxima abertura */
            });
        return () => {
            ativo = false;
        };
        // Só na abertura do processo; o componente é remontado por processo (key).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Só reseta o formulário ao trocar de processo (calc.id) — não quando `marcarPublicacoesDjenComoVistas`
    // atualiza `calc.updated_at`, evitando apagar anotações/edições em andamento.
    useEffect(() => {
        setClienteNome(view.clienteNome);
        setParteContraria(view.parteContraria);
        setProcessoGlobal(view.processoGlobal);
        setCategoriaId(view.categoriaId ?? "");
        setStatusProcesso(view.statusProcesso);
        setAnotacoesInternas(view.anotacoesInternas);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calc.id]);

    const categoriaAtual = categoriaId ? mapaCategorias[categoriaId] ?? null : null;

    const copiarTexto = async (chave: string, texto: string) => {
        try {
            await navigator.clipboard.writeText(texto);
            setCopiadoChave(chave);
            setTimeout(() => setCopiadoChave((prev) => (prev === chave ? null : prev)), 1800);
        } catch {
            /* ignore */
        }
    };

    const salvarAlteracoes = async () => {
        setSalvando(true);
        try {
            const patch = atualizarFichaProcessoDjen(calc, {
                clienteNome,
                parteContraria,
                processoGlobal,
                categoriaId: categoriaId || null,
                statusProcesso,
                anotacoesInternas,
            });
            const atualizado = await atualizarCalculo(calc.id, patch);
            onAtualizado(atualizado);
            toast.success(`Dados do processo de "${atualizado.cliente_nome}" salvos.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível salvar as alterações.");
        } finally {
            setSalvando(false);
        }
    };

    const removerProcesso = async () => {
        setExcluindo(true);
        try {
            await excluirCalculo(calc.id);
            onExcluido(calc.id);
            toast.success(`Processo de "${calc.cliente_nome}" removido.`);
            onVoltarLista();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível excluir o processo.");
        } finally {
            setExcluindo(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/20 pb-3">
                <button
                    type="button"
                    onClick={onVoltarLista}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-ink hover:underline"
                >
                    <ArrowLeft className="size-3.5" />
                    Voltar para Processos
                </button>

                <div className="flex flex-wrap items-center gap-2">
                    {onAdicionarPrazo && (
                        <button
                            type="button"
                            onClick={() => onAdicionarPrazo(calc)}
                            className="inline-flex h-9 items-center gap-1.5 border border-ink/30 bg-card px-3 text-xs font-semibold text-ink hover:bg-ink/5"
                        >
                            <CalendarPlus className="size-3.5" />
                            Adicionar prazo
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onConsultarDjenProcesso(calc)}
                        className="inline-flex h-9 items-center gap-1.5 border border-ink/30 bg-card px-3 text-xs font-semibold text-ink hover:bg-ink/5"
                    >
                        <Gavel className="size-3.5" />
                        Buscar novas no DJEN
                    </button>
                    <button
                        type="button"
                        onClick={() => onLevarParaCalculadora(calc)}
                        className="inline-flex h-9 items-center gap-1.5 border border-gold bg-gold-light/60 px-3 text-xs font-bold text-ink hover:bg-gold-light"
                    >
                        <Calculator className="size-3.5" />
                        Levar p/ Calculadora
                    </button>
                    {urlHttpSegura(view.linkUltimaPublicacao) && (
                        <a
                            href={urlHttpSegura(view.linkUltimaPublicacao)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 items-center gap-1.5 bg-ink px-3.5 text-xs font-semibold text-paper hover:bg-ink-soft"
                        >
                            <ExternalLink className="size-3.5" />
                            Ver no Tribunal
                        </a>
                    )}
                </div>
            </div>

            {/* Cabeçalho do dossiê */}
            <header className="border border-ink/20 bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                                <span aria-hidden className={cn("size-2", PONTO_STATUS[statusProcesso])} />
                                {ROTULO_STATUS[statusProcesso]}
                            </span>
                            {categoriaAtual && <SeloCategoria categoria={categoriaAtual} />}
                            <span>
                                {[view.tribunal || "DJEN", view.tipoComunicacao].filter(Boolean).join(" · ")}
                            </span>
                            {view.dataUltimaPublicacaoBr && (
                                <span className="tabular-nums">
                                    Última publicação em {view.dataUltimaPublicacaoBr}
                                </span>
                            )}
                        </div>

                        <h2 className="sys-title text-xl text-ink">{formatarNomeParte(view.clienteNome)}</h2>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {view.processoGlobal ? (
                                <button
                                    type="button"
                                    onClick={() => copiarTexto("cnj-header", view.processoGlobal)}
                                    title="Copiar número CNJ"
                                    className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-ink hover:underline"
                                >
                                    <span>CNJ: {view.processoGlobal}</span>
                                    {copiadoChave === "cnj-header" ? (
                                        <Check className="size-3 text-[#126A35]" />
                                    ) : (
                                        <Copy className="size-3 opacity-65" />
                                    )}
                                </button>
                            ) : (
                                <span>Sem número CNJ cadastrado</span>
                            )}
                            {view.classe && (
                                <>
                                    <span aria-hidden>·</span>
                                    <span>{formatarClasseProcessual(view.classe)}</span>
                                </>
                            )}
                            {view.orgao && (
                                <>
                                    <span aria-hidden>·</span>
                                    <span>{view.orgao}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {view.valorCitado > 0 && (
                        <div className="shrink-0 border border-ink/15 bg-secondary/50 px-3.5 py-2 text-right tabular-nums">
                            <span className="block text-[11px] font-medium text-muted-foreground">
                                Valor citado no texto
                            </span>
                            <span className="text-base font-bold text-ink">{brl(view.valorCitado)}</span>
                        </div>
                    )}
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Coluna esquerda: Ficha editável + Partes e Advogados */}
                <div className="min-w-0 space-y-5 lg:col-span-5">
                    <section className="space-y-4 border border-ink/20 bg-card p-5">
                        <div className="border-b border-ink/15 pb-2.5">
                            <h2 className="sys-section text-ink">Dados do processo</h2>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label htmlFor="proc-status" className="block text-xs font-semibold text-ink">
                                    Situação do prazo
                                </label>
                                <select
                                    id="proc-status"
                                    value={statusProcesso}
                                    onChange={(e) => setStatusProcesso(e.target.value as StatusProcessoDjen)}
                                    className="field mt-1 cursor-pointer py-1.5 text-xs font-semibold [&>option]:text-ink"
                                >
                                    {OPCOES_STATUS.map((op) => (
                                        <option key={op.value} value={op.value}>
                                            {op.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="proc-cat" className="block text-xs font-semibold text-ink">
                                    Fase / Categoria
                                </label>
                                <select
                                    id="proc-cat"
                                    value={categoriaId}
                                    onChange={(e) => setCategoriaId(e.target.value)}
                                    className="field mt-1 cursor-pointer py-1.5 text-xs font-semibold [&>option]:text-ink"
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

                        <div>
                            <label htmlFor="proc-cliente" className="block text-xs font-semibold text-ink">
                                Cliente / Parte principal
                            </label>
                            <input
                                id="proc-cliente"
                                value={clienteNome}
                                onChange={(e) => setClienteNome(e.target.value)}
                                maxLength={160}
                                className="field mt-1 py-1.5 text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="proc-contraria" className="block text-xs font-semibold text-ink">
                                Parte contrária / Banco
                            </label>
                            <input
                                id="proc-contraria"
                                value={parteContraria}
                                onChange={(e) => setParteContraria(e.target.value)}
                                maxLength={100}
                                placeholder="Ex.: Banco Santander, Estado..."
                                className="field mt-1 py-1.5 text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="proc-cnj" className="block text-xs font-semibold text-ink">
                                Nº do processo (CNJ)
                            </label>
                            <input
                                id="proc-cnj"
                                value={processoGlobal}
                                onChange={(e) => setProcessoGlobal(e.target.value)}
                                maxLength={80}
                                className="field mt-1 py-1.5 text-sm tabular-nums"
                            />
                        </div>

                        <div>
                            <label htmlFor="proc-notas" className="block text-xs font-semibold text-ink">
                                Anotações internas e providências
                            </label>
                            <textarea
                                id="proc-notas"
                                rows={4}
                                value={anotacoesInternas}
                                onChange={(e) => setAnotacoesInternas(e.target.value)}
                                placeholder="Anote o prazo fatal, peça pendente, audiência ou resumo estratégico..."
                                className="field mt-1 resize-y py-2 text-xs leading-relaxed"
                            />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/15 pt-3">
                            {confirmarExclusao ? (
                                <div className="inline-flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-destructive">Excluir?</span>
                                    <button
                                        type="button"
                                        disabled={excluindo}
                                        onClick={removerProcesso}
                                        className="inline-flex h-8 items-center bg-destructive px-2.5 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
                                    >
                                        Confirmar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmarExclusao(false)}
                                        className="inline-flex h-8 items-center border border-ink/25 px-2 text-xs font-semibold text-ink"
                                    >
                                        Não
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmarExclusao(true)}
                                    className="inline-flex h-8 items-center gap-1.5 border border-ink/25 px-2.5 text-xs font-semibold text-ink/70 hover:border-destructive hover:text-destructive"
                                >
                                    <Trash2 className="size-3.5" />
                                    Excluir processo
                                </button>
                            )}

                            <button
                                type="button"
                                disabled={salvando}
                                onClick={salvarAlteracoes}
                                className="inline-flex h-9 items-center gap-1.5 bg-ink px-4 text-xs font-semibold text-paper hover:bg-ink-soft disabled:opacity-60"
                            >
                                {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                                Salvar alterações
                            </button>
                        </div>
                    </section>

                    <section className="space-y-4 border border-ink/20 bg-card p-5">
                        <div className="flex items-center gap-2 border-b border-ink/15 pb-2.5">
                            <Users className="size-4 text-gold-deep" />
                            <h2 className="sys-section text-ink">Partes e advogados intimados</h2>
                        </div>

                        {view.destinatarios.length === 0 && view.advogados.length === 0 ? (
                            <div className="space-y-2 text-xs text-muted-foreground">
                                <p>
                                    Lista completa de polos não estava gravada nesta publicação antiga. Clique em{" "}
                                    <strong className="text-ink">Buscar novas no DJEN</strong> para atualizar as
                                    partes diretamente do CNJ.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4 text-xs">
                                {view.destinatarios.length > 0 && (
                                    <div>
                                        <span className="block text-[11px] font-medium text-muted-foreground">
                                            Partes registradas ({view.destinatarios.length})
                                        </span>
                                        <ul className="mt-2 divide-y divide-ink/10 border border-ink/15 bg-background/60">
                                            {view.destinatarios.map((d, idx) => (
                                                <li
                                                    key={`${d.nome}-${idx}`}
                                                    className="flex items-start justify-between gap-2 px-3 py-2"
                                                >
                                                    <span className="font-medium text-ink">{d.nome}</span>
                                                    {d.polo && (
                                                        <span className="shrink-0 border border-ink/20 bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-ink/80">
                                                            {rotuloPolo(d.polo)}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {view.advogados.length > 0 && (
                                    <div>
                                        <span className="block text-[11px] font-medium text-muted-foreground">
                                            Advogados vinculados ({view.advogados.length})
                                        </span>
                                        <ul className="mt-2 divide-y divide-ink/10 border border-ink/15 bg-background/60">
                                            {view.advogados.map((a, idx) => (
                                                <li
                                                    key={`${a.nome}-${a.numeroOab}-${idx}`}
                                                    className="flex items-center justify-between gap-2 px-3 py-2"
                                                >
                                                    <span className="text-ink">{a.nome || "Advogado"}</span>
                                                    {(a.numeroOab || a.ufOab) && (
                                                        <span className="shrink-0 tabular-nums text-[11px] font-semibold text-muted-foreground">
                                                            OAB/{a.ufOab || "--"} {a.numeroOab}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </div>

                {/* Coluna direita: Linha do tempo das publicações do DJEN */}
                <section className="min-w-0 space-y-4 lg:col-span-7">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/20 pb-2.5">
                        <h2 className="sys-section text-ink">
                            Publicações no DJEN{" "}
                            <span className="font-normal tabular-nums text-muted-foreground">
                                ({view.movimentacoes.length})
                            </span>
                        </h2>
                    </div>

                    {view.movimentacoes.length === 0 ? (
                        <div className="border border-ink/20 bg-card p-6 text-center">
                            <p className="sys-section text-ink">Nenhuma movimentação registrada ainda.</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Consulte o DJEN para puxar o teor oficial das intimações deste processo.
                            </p>
                            <button
                                type="button"
                                onClick={() => onConsultarDjenProcesso(calc)}
                                className="mt-4 inline-flex h-9 items-center gap-1.5 bg-ink px-4 text-xs font-semibold text-paper hover:bg-ink-soft"
                            >
                                <Gavel className="size-3.5" />
                                Consultar DJEN agora
                            </button>
                        </div>
                    ) : (
                        <div ref={listaMovRef} className="space-y-4">
                            {pagMov.itensPagina.map((m, idx) => (
                                <article
                                    key={`${m.id}-${idx}`}
                                    className="border border-ink/20 bg-card p-5"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-ink/12 pb-3">
                                        <div className="space-y-1">
                                            <p className="text-sm text-ink">
                                                {idsNovosNaAbertura.has(Number(m.id)) && (
                                                    <span className="mr-2 bg-gold-light px-1.5 py-0.5 text-[11px] font-semibold text-ink">
                                                        Nova
                                                    </span>
                                                )}
                                                <span className="font-semibold tabular-nums">
                                                    {m.dataDisponibilizacaoBr || "Sem data"}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {" · "}
                                                    {[m.tribunal || "DJEN", m.tipoComunicacao || "Comunicação"].join(" · ")}
                                                </span>
                                                {m.recebidaEm && (
                                                    <span
                                                        className="tabular-nums text-muted-foreground"
                                                        title="Quando a publicação entrou no sistema"
                                                    >
                                                        {" · entrou "}
                                                        {formatarRecebidaEm(m.recebidaEm)}
                                                    </span>
                                                )}
                                            </p>
                                            {(m.orgao || m.classe) && (
                                                <p className="text-xs text-muted-foreground">
                                                    {m.orgao}
                                                    {m.orgao && m.classe ? " · " : ""}
                                                    {m.classe}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {m.texto && (
                                                <button
                                                    type="button"
                                                    onClick={() => copiarTexto(`mov-${m.id}-${idx}`, m.texto)}
                                                    className="inline-flex h-8 items-center gap-1 border border-ink/25 px-2.5 text-[11px] font-semibold text-ink hover:bg-ink/5"
                                                >
                                                    {copiadoChave === `mov-${m.id}-${idx}` ? (
                                                        <Check className="size-3 text-[#126A35]" />
                                                    ) : (
                                                        <Copy className="size-3" />
                                                    )}
                                                    {copiadoChave === `mov-${m.id}-${idx}` ? "Copiado" : "Copiar teor"}
                                                </button>
                                            )}
                                            {urlHttpSegura(m.link) && (
                                                <a
                                                    href={urlHttpSegura(m.link)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex h-8 items-center gap-1 border border-ink/25 px-2.5 text-[11px] font-semibold text-ink hover:bg-ink/5"
                                                >
                                                    <ExternalLink className="size-3" />
                                                    Tribunal
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 border border-ink/12 bg-background/60 p-4 font-serif text-xs leading-relaxed whitespace-pre-wrap text-ink">
                                        {m.texto ||
                                            "(Publicação sem teor textual disponibilizado — acesse pelo link do tribunal.)"}
                                    </div>
                                </article>
                            ))}
                            <BarraPaginacao
                                pagina={pagMov.pagina}
                                totalPaginas={pagMov.totalPaginas}
                                total={pagMov.total}
                                inicio={pagMov.inicio}
                                fim={pagMov.fim}
                                onPagina={pagMov.irPara}
                                porPagina={pagMov.porPagina}
                                onPorPagina={pagMov.mudarPorPagina}
                                opcoesPorPagina={[10, 20, 50]}
                                rotulo="publicações"
                                alvoRolagem={listaMovRef}
                            />
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export const ProcessosSalvosDjen = ({
    processos,
    categorias,
    processoAtivoId,
    verificandoDjen,
    intervaloVerificacaoHoras,
    onVerificarDjen,
    onAbrirProcesso,
    onVoltarLista,
    onAtualizado,
    onExcluido,
    onAbrirRadarDjen,
    onConsultarDjenProcesso,
    onLevarParaCalculadora,
    onAdicionarPrazo,
}: ProcessosSalvosDjenProps) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [busca, setBusca] = useState("");
    const [filtroTribunal, setFiltroTribunal] = useState<string>("todos");
    const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
    const [operandoId, setOperandoId] = useState<string | null>(null);
    const [confirmarExclusaoId, setConfirmarExclusaoId] = useState<string | null>(null);
    const [copiadoCnjId, setCopiadoCnjId] = useState<string | null>(null);

    const abaParam = searchParams.get("aba");
    const abaLista: "processos" | "publicacoes" = abaParam === "publicacoes" ? "publicacoes" : "processos";
    const filtroPublicacoes: "todas" | "novas" =
        searchParams.get("filtro") === "novas" ? "novas" : "todas";
    const statusParam = searchParams.get("status") as StatusProcessoDjen | null;
    const filtroStatus: StatusProcessoDjen | "todos" =
        statusParam === "prazo_aberto" ||
        statusParam === "em_analise" ||
        statusParam === "manifestado" ||
        statusParam === "concluido"
            ? statusParam
            : "todos";

    const atualizarUrl = (mutacoes: Record<string, string | null>, replace = true) => {
        const next = new URLSearchParams(searchParams);
        for (const [k, v] of Object.entries(mutacoes)) {
            if (!v || v === "todos" || v === "todas" || (k === "aba" && v === "processos")) {
                next.delete(k);
            } else {
                next.set(k, v);
            }
        }
        setSearchParams(next, { replace });
    };

    const mapaCategorias = useMemo(
        () => Object.fromEntries(categorias.map((c) => [c.id, c])),
        [categorias],
    );

    const itensComView = useMemo<ItemProcessoComView[]>(
        () => processos.map((calc) => ({ calc, view: lerDadosProcessoDjen(calc) })),
        [processos],
    );

    const itemAtivo = useMemo(
        () => (processoAtivoId ? itensComView.find((i) => i.calc.id === processoAtivoId) ?? null : null),
        [itensComView, processoAtivoId],
    );

    const tribunaisDisponiveis = useMemo(() => {
        const set = new Set<string>();
        for (const { view } of itensComView) {
            if (view.tribunal) set.add(view.tribunal);
        }
        return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
    }, [itensComView]);

    const estatisticas = useMemo(() => {
        let prazosAbertos = 0;
        let totalMovs = 0;
        let comNovidade = 0;
        let ultimaVerificacao = "";
        for (const { view } of itensComView) {
            if (view.statusProcesso === "prazo_aberto") prazosAbertos += 1;
            if (view.idsNovos.length > 0) comNovidade += 1;
            if (view.ultimaSincronizacao > ultimaVerificacao) ultimaVerificacao = view.ultimaSincronizacao;
            totalMovs += view.movimentacoes.length;
        }
        return {
            total: itensComView.length,
            prazosAbertos,
            comNovidade,
            ultimaVerificacao,
            tribunais: tribunaisDisponiveis.length,
            totalMovs,
        };
    }, [itensComView, tribunaisDisponiveis.length]);

    const contagensStatus = useMemo(() => {
        const counts: Record<StatusProcessoDjen, number> = {
            prazo_aberto: 0,
            em_analise: 0,
            manifestado: 0,
            concluido: 0,
        };
        for (const { view } of itensComView) {
            counts[view.statusProcesso] += 1;
        }
        return counts;
    }, [itensComView]);

    const filtrados = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        return itensComView.filter(({ calc, view }) => {
            if (filtroStatus !== "todos" && view.statusProcesso !== filtroStatus) return false;
            if (filtroTribunal !== "todos" && view.tribunal !== filtroTribunal) return false;
            if (filtroCategoria === "sem" && calc.categoria_id) return false;
            if (filtroCategoria !== "todas" && filtroCategoria !== "sem" && calc.categoria_id !== filtroCategoria) {
                return false;
            }
            if (!termo) return true;
            const textoBusca = [
                view.clienteNome,
                view.parteContraria,
                view.processoGlobal,
                view.tribunal,
                view.orgao,
                view.classe,
                view.anotacoesInternas,
                ...view.movimentacoes.map((m) => m.texto),
            ]
                .join(" ")
                .toLowerCase();
            return textoBusca.includes(termo);
        }).sort(
            (a, b) =>
                Number(b.view.idsNovos.length > 0) - Number(a.view.idsNovos.length > 0) ||
                b.view.dataUltimaPublicacao.localeCompare(a.view.dataUltimaPublicacao),
        );
    }, [itensComView, filtroStatus, filtroTribunal, filtroCategoria, busca]);

    const totalNaoLidas = useMemo(
        () => itensComView.reduce((acc, { view }) => acc + view.idsNovos.length, 0),
        [itensComView],
    );

    const publicacoesPlanas = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        const lista: Array<{
            calc: CalculoSalvo;
            view: ProcessoDjenSalvoView;
            id: number;
            dataIso: string;
            dataBr: string;
            recebidaEm?: string;
            tribunal: string;
            tipo: string;
            orgao: string;
            texto: string;
            nova: boolean;
        }> = [];

        for (const { calc, view } of itensComView) {
            if (filtroTribunal !== "todos" && view.tribunal !== filtroTribunal) continue;
            const setNovos = new Set(view.idsNovos);
            for (const m of view.movimentacoes) {
                const nova = setNovos.has(Number(m.id));
                if (filtroPublicacoes === "novas" && !nova) continue;
                if (termo) {
                    const textoBusca = [
                        view.clienteNome,
                        view.parteContraria,
                        view.processoGlobal,
                        m.tribunal || view.tribunal,
                        m.orgao,
                        m.tipoComunicacao,
                        m.texto,
                    ]
                        .join(" ")
                        .toLowerCase();
                    if (!textoBusca.includes(termo)) continue;
                }
                lista.push({
                    calc,
                    view,
                    id: Number(m.id) || 0,
                    dataIso: m.dataDisponibilizacao || view.dataUltimaPublicacao,
                    dataBr: m.dataDisponibilizacaoBr || view.dataUltimaPublicacaoBr || "—",
                    recebidaEm: m.recebidaEm,
                    tribunal: m.tribunal || view.tribunal || "DJEN",
                    tipo: m.tipoComunicacao || "Comunicação",
                    orgao: m.orgao || view.orgao,
                    texto: m.texto,
                    nova,
                });
            }
        }

        return lista.sort((a, b) => Number(b.nova) - Number(a.nova) || b.dataIso.localeCompare(a.dataIso));
    }, [itensComView, filtroTribunal, filtroPublicacoes, busca]);

    const listaProcRef = useRef<HTMLDivElement>(null);
    const listaPubRef = useRef<HTMLDivElement>(null);
    const pagProc = usePaginacao(filtrados, {
        porPaginaPadrao: 20,
        reiniciarCom: [filtroStatus, filtroTribunal, filtroCategoria, busca],
    });
    const pagPub = usePaginacao(publicacoesPlanas, {
        porPaginaPadrao: 20,
        reiniciarCom: [filtroTribunal, filtroPublicacoes, busca],
    });

    if (itemAtivo) {
        return (
            <DetalheProcessoDjen
                key={itemAtivo.calc.id}
                item={itemAtivo}
                categorias={categorias}
                mapaCategorias={mapaCategorias}
                onVoltarLista={onVoltarLista}
                onAtualizado={onAtualizado}
                onExcluido={onExcluido}
                onConsultarDjenProcesso={onConsultarDjenProcesso}
                onLevarParaCalculadora={onLevarParaCalculadora}
                onAdicionarPrazo={onAdicionarPrazo}
            />
        );
    }

    const trocarStatusCard = async (calc: CalculoSalvo, novoStatus: StatusProcessoDjen) => {
        setOperandoId(calc.id);
        try {
            const patch = atualizarFichaProcessoDjen(calc, { statusProcesso: novoStatus });
            const atualizado = await atualizarCalculo(calc.id, patch);
            onAtualizado(atualizado);
            toast.success(`Status alterado para "${ROTULO_STATUS[novoStatus]}".`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível alterar o status.");
        } finally {
            setOperandoId(null);
        }
    };

    const trocarCategoriaCard = async (calc: CalculoSalvo, novaCatId: string) => {
        setOperandoId(calc.id);
        try {
            const atualizado = await atualizarCalculo(calc.id, { categoria_id: novaCatId || null });
            onAtualizado(atualizado);
            toast.success("Fase atualizada.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível atualizar a fase.");
        } finally {
            setOperandoId(null);
        }
    };

    const excluirCard = async (calc: CalculoSalvo) => {
        setOperandoId(calc.id);
        try {
            await excluirCalculo(calc.id);
            onExcluido(calc.id);
            setConfirmarExclusaoId(null);
            toast.success(`Processo de "${calc.cliente_nome}" excluído.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao excluir processo.");
        } finally {
            setOperandoId(null);
        }
    };

    const copiarCnjCard = async (id: string, cnj: string) => {
        try {
            await navigator.clipboard.writeText(cnj);
            setCopiadoCnjId(id);
            setTimeout(() => setCopiadoCnjId((prev) => (prev === id ? null : prev)), 1600);
        } catch {
            /* ignore */
        }
    };

    const temFiltros =
        busca.trim() !== "" ||
        filtroStatus !== "todos" ||
        filtroTribunal !== "todos" ||
        filtroCategoria !== "todas";

    const limparFiltros = () => {
        setBusca("");
        setFiltroTribunal("todos");
        setFiltroCategoria("todas");
        atualizarUrl({ status: null, filtro: null });
    };

    const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

    const opcoesFiltroStatus: Array<{ value: StatusProcessoDjen | "todos"; label: string; qtd: number }> = [
        { value: "todos", label: "Todos", qtd: itensComView.length },
        ...OPCOES_STATUS.map((op) => ({ value: op.value, label: op.label, qtd: contagensStatus[op.value] })),
    ];

    const renderCnj = (calc: CalculoSalvo, view: ProcessoDjenSalvoView) =>
        view.processoGlobal ? (
            <button
                type="button"
                onClick={() => copiarCnjCard(calc.id, view.processoGlobal)}
                title="Copiar número CNJ"
                className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums text-ink hover:underline"
            >
                {view.processoGlobal}
                {copiadoCnjId === calc.id ? (
                    <Check aria-label="Copiado" className="size-3 text-[#126A35]" />
                ) : (
                    <Copy aria-hidden className="size-3 text-ink/40" />
                )}
            </button>
        ) : (
            <span className="text-muted-foreground">Sem número CNJ</span>
        );

    /** "Abrir" fica sempre visível; as demais ações vão para o menu "⋯" (também existem no dossiê). */
    const renderAcoes = (calc: CalculoSalvo, view: ProcessoDjenSalvoView) => {
        if (confirmarExclusaoId === calc.id) {
            // A coluna de ações é estreita: a confirmação flutua sobre a linha, alinhada à direita.
            return (
                <div className="relative">
                    <div className="absolute right-0 top-0 z-20 inline-flex items-center gap-1 whitespace-nowrap border border-destructive/30 bg-card p-1.5 shadow-xl">
                        <span className="mx-1 text-xs font-semibold text-destructive">Excluir processo?</span>
                        <button
                            type="button"
                            disabled={operandoId === calc.id}
                            onClick={() => excluirCard(calc)}
                            className="inline-flex h-8 items-center bg-destructive px-2.5 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
                        >
                            Excluir
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmarExclusaoId(null)}
                            className="inline-flex h-8 items-center border border-ink/30 px-2.5 text-xs font-semibold text-ink hover:bg-ink/5"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="inline-flex items-center justify-end gap-1">
                <MenuAcoesLinha
                    contexto={view.clienteNome}
                    className="size-8"
                    acoes={[
                        {
                            id: "abrir",
                            rotulo: "Abrir processo",
                            Icone: FolderOpen,
                            onSelect: () => onAbrirProcesso(calc),
                        },
                        {
                            id: "djen",
                            rotulo: "Buscar novas publicações no DJEN",
                            Icone: Gavel,
                            onSelect: () => onConsultarDjenProcesso(calc),
                        },
                        {
                            id: "calculadora",
                            rotulo: "Levar para a calculadora",
                            Icone: Calculator,
                            onSelect: () => onLevarParaCalculadora(calc),
                        },
                        {
                            id: "excluir",
                            rotulo: "Excluir processo",
                            Icone: Trash2,
                            onSelect: () => setConfirmarExclusaoId(calc.id),
                            destrutiva: true,
                        },
                    ]}
                />
            </div>
        );
    };

    const linhaPublicacao = (view: ProcessoDjenSalvoView) =>
        [view.tribunal, view.tipoComunicacao].filter(Boolean).join(" · ");

    const renderSituacaoFase = (calc: CalculoSalvo, view: ProcessoDjenSalvoView) => (
        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
            <label className="relative flex w-fit max-w-full items-center">
                <span
                    aria-hidden
                    className={cn("pointer-events-none absolute left-2 size-2", PONTO_STATUS[view.statusProcesso])}
                />
                <select
                    value={view.statusProcesso}
                    disabled={operandoId === calc.id}
                    onChange={(e) => trocarStatusCard(calc, e.target.value as StatusProcessoDjen)}
                    aria-label={`Situação do processo de ${view.clienteNome}`}
                    className="h-7 max-w-full cursor-pointer appearance-none border border-ink/15 bg-card py-0 pl-6 pr-7 text-xs font-semibold text-ink transition-colors duration-150 hover:border-ink/40 focus:border-ink focus:outline-none disabled:cursor-wait disabled:opacity-60"
                >
                    {OPCOES_STATUS.map((op) => (
                        <option key={op.value} value={op.value}>
                            {op.label}
                        </option>
                    ))}
                </select>
                <ChevronDown aria-hidden className="pointer-events-none absolute right-2 size-3.5 text-ink/50" />
            </label>
            <label className="relative flex w-fit max-w-full items-center">
                <select
                    value={calc.categoria_id ?? ""}
                    disabled={operandoId === calc.id}
                    onChange={(e) => trocarCategoriaCard(calc, e.target.value)}
                    aria-label={`Fase do processo de ${view.clienteNome}`}
                    className="h-6 max-w-[11rem] cursor-pointer appearance-none truncate border border-transparent bg-transparent py-0 pl-2 pr-6 text-xs text-muted-foreground transition-colors duration-150 hover:border-ink/25 hover:text-ink focus:border-ink focus:outline-none disabled:cursor-wait disabled:opacity-60"
                >
                    <option value="">Sem fase</option>
                    {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.nome}
                        </option>
                    ))}
                </select>
                <ChevronDown aria-hidden className="pointer-events-none absolute right-1.5 size-3 text-ink/40" />
            </label>
        </div>
    );

    const renderUltimaPublicacao = (view: ProcessoDjenSalvoView) => {
        const recebida = view.movimentacoes.find((m) => m.recebidaEm)?.recebidaEm;
        return (
            <div className="text-xs">
                <p className="flex items-center gap-2">
                    <span className="text-sm font-medium tabular-nums text-ink">{view.dataUltimaPublicacaoBr || "—"}</span>
                    {view.idsNovos.length > 0 && (
                        <span className="bg-gold-light px-1.5 py-0.5 text-[11px] font-semibold text-ink">
                            {view.idsNovos.length === 1 ? "1 nova" : `${view.idsNovos.length} novas`}
                        </span>
                    )}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                    {linhaPublicacao(view)}
                    {view.movimentacoes.length > 1 && ` · ${view.movimentacoes.length}`}
                </p>
                {recebida && (
                    <p className="tabular-nums text-muted-foreground" title="Quando a publicação entrou no sistema">
                        entrou {formatarRecebidaEm(recebida)}
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-5">
            {/* Cabeçalho da página: resumo da carteira de processos e as duas ações do DJEN */}
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight text-ink">
                        {plural(estatisticas.total, "processo acompanhado", "processos acompanhados")}
                    </h2>
                    {estatisticas.total > 0 && (
                        <p aria-live="polite" className="mt-0.5 text-sm text-muted-foreground">
                            {verificandoDjen ? (
                                "Verificando novas publicações no DJEN…"
                            ) : (
                                <>
                                    {estatisticas.prazosAbertos > 0 && (
                                        <>
                                            <span className="font-semibold text-ink">
                                                {estatisticas.prazosAbertos} com prazo em aberto
                                            </span>
                                            <span className="px-1.5 text-ink/30">·</span>
                                        </>
                                    )}
                                    {`Verificação automática a cada ${intervaloVerificacaoHoras} h`}
                                    {estatisticas.ultimaVerificacao &&
                                        `, a última ${descreverMomento(estatisticas.ultimaVerificacao)}`}
                                </>
                            )}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={onAbrirRadarDjen}
                        title={`Buscar publicações da ${formatarOab(configEscritorioAtual())} no DJEN`}
                        className="inline-flex h-9 items-center gap-1.5 border border-ink/25 bg-card px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5"
                    >
                        <Radar className="size-3.5 text-gold-deep" />
                        Radar DJEN
                    </button>
                    <button
                        type="button"
                        onClick={onVerificarDjen}
                        disabled={verificandoDjen}
                        className="inline-flex h-9 items-center gap-1.5 bg-ink px-3 text-xs font-semibold text-paper transition-colors duration-150 hover:bg-ink-soft disabled:cursor-wait disabled:opacity-60"
                    >
                        <RefreshCw className={cn("size-3.5", verificandoDjen && "animate-spin")} />
                        {verificandoDjen ? "Verificando…" : "Verificar agora"}
                    </button>
                </div>
            </header>

            {/* Abas sublinhadas: Processos · Publicações */}
            <div role="tablist" aria-label="Visualização de processos e publicações" className="flex gap-6 border-b border-ink/15">
                {(
                    [
                        { id: "processos", label: "Processos", qtd: estatisticas.total, novas: 0 },
                        { id: "publicacoes", label: "Publicações", qtd: estatisticas.totalMovs, novas: totalNaoLidas },
                    ] as const
                ).map((aba) => {
                    const ativa = abaLista === aba.id;
                    return (
                        <button
                            key={aba.id}
                            type="button"
                            role="tab"
                            aria-selected={ativa}
                            onClick={() =>
                                atualizarUrl(
                                    aba.id === "processos"
                                        ? { aba: "processos", filtro: null }
                                        : { aba: "publicacoes", status: null },
                                )
                            }
                            className={cn(
                                "-mb-px inline-flex h-10 items-center gap-2 rounded-none border-b-2 text-sm font-semibold transition-colors duration-150",
                                ativa ? "border-ink text-ink" : "border-transparent text-muted-foreground hover:text-ink",
                            )}
                        >
                            {aba.label}
                            <span className="text-xs font-medium tabular-nums text-muted-foreground">{aba.qtd}</span>
                            {aba.novas > 0 && (
                                <span className="bg-gold-light px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                                    {aba.novas} {aba.novas === 1 ? "nova" : "novas"}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {processos.length > 0 && abaLista === "processos" && (
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    {/* Celular: select nativo; a partir do tablet, botões com ponto de cor e contagem */}
                    <select
                        value={filtroStatus}
                        onChange={(e) => atualizarUrl({ status: e.target.value as StatusProcessoDjen | "todos" })}
                        aria-label="Filtrar por situação"
                        className="field cursor-pointer py-2 text-xs font-medium md:hidden [&>option]:text-ink"
                    >
                        {opcoesFiltroStatus.map((op) => (
                            <option key={op.value} value={op.value}>
                                {op.value === "todos" ? "Todas as situações" : op.label} ({op.qtd})
                            </option>
                        ))}
                    </select>

                    <div role="group" aria-label="Filtrar por situação" className="hidden flex-wrap items-center gap-1 md:flex">
                        {opcoesFiltroStatus.map((op) => {
                            const ativo = filtroStatus === op.value;
                            return (
                                <button
                                    key={op.value}
                                    type="button"
                                    aria-pressed={ativo}
                                    onClick={() => atualizarUrl({ status: op.value })}
                                    className={cn(
                                        "inline-flex h-8 items-center gap-1.5 whitespace-nowrap px-2.5 text-xs font-medium transition-colors duration-150",
                                        ativo ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                                    )}
                                >
                                    {op.value !== "todos" && (
                                        <span aria-hidden className={cn("size-2 shrink-0", PONTO_STATUS[op.value])} />
                                    )}
                                    {op.label}
                                    <span className={cn("tabular-nums", ativo ? "text-paper/70" : "text-muted-foreground")}>
                                        {op.qtd}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8.5rem_9rem] xl:w-[33rem] xl:shrink-0">
                        <div className="relative">
                            <Search
                                aria-hidden
                                className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-ink/50"
                            />
                            <input
                                type="search"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar cliente, CNJ ou teor"
                                aria-label="Buscar processos"
                                className="field py-2 pl-6 pr-7 text-sm [&::-webkit-search-cancel-button]:hidden"
                            />
                            {busca && (
                                <button
                                    type="button"
                                    onClick={() => setBusca("")}
                                    aria-label="Limpar busca"
                                    className="absolute right-0 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-ink/50 hover:text-ink"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>

                        <select
                            value={filtroTribunal}
                            onChange={(e) => setFiltroTribunal(e.target.value)}
                            aria-label="Filtrar por tribunal"
                            className="field cursor-pointer py-2 text-xs font-medium [&>option]:text-ink"
                        >
                            <option value="todos">Todos os tribunais</option>
                            {tribunaisDisponiveis.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>

                        <select
                            value={filtroCategoria}
                            onChange={(e) => setFiltroCategoria(e.target.value)}
                            aria-label="Filtrar por fase"
                            className="field cursor-pointer py-2 text-xs font-medium [&>option]:text-ink"
                        >
                            <option value="todas">Todas as fases</option>
                            {categorias.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.nome}
                                </option>
                            ))}
                            <option value="sem">Sem fase</option>
                        </select>
                    </div>
                </div>
            )}

            {processos.length > 0 && abaLista === "publicacoes" && (
                <div className="flex flex-wrap items-center gap-3">
                    <div role="group" aria-label="Filtrar publicações" className="flex items-center gap-1">
                        {(
                            [
                                { id: "todas", label: "Todas", qtd: estatisticas.totalMovs },
                                { id: "novas", label: "Não lidas", qtd: totalNaoLidas },
                            ] as const
                        ).map((op) => {
                            const ativo = filtroPublicacoes === op.id;
                            return (
                                <button
                                    key={op.id}
                                    type="button"
                                    aria-pressed={ativo}
                                    onClick={() => atualizarUrl({ filtro: op.id === "todas" ? null : "novas" })}
                                    className={cn(
                                        "inline-flex h-8 items-center gap-1.5 px-2.5 text-xs font-medium transition-colors duration-150",
                                        ativo ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                                    )}
                                >
                                    {op.label}
                                    <span className={cn("tabular-nums", ativo ? "text-paper/70" : "text-muted-foreground")}>
                                        {op.qtd}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative min-w-[14rem] flex-1">
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-ink/50"
                        />
                        <input
                            type="search"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder="Buscar cliente, CNJ, órgão ou teor da publicação"
                            aria-label="Buscar publicações"
                            className="field py-1.5 pl-6 pr-7 text-sm [&::-webkit-search-cancel-button]:hidden"
                        />
                        {busca && (
                            <button
                                type="button"
                                onClick={() => setBusca("")}
                                aria-label="Limpar busca"
                                className="absolute right-0 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-ink/50 hover:text-ink"
                            >
                                <X className="size-3.5" />
                            </button>
                        )}
                    </div>

                    <select
                        value={filtroTribunal}
                        onChange={(e) => setFiltroTribunal(e.target.value)}
                        aria-label="Filtrar por tribunal"
                        className="field w-auto cursor-pointer py-1.5 text-xs font-medium [&>option]:text-ink"
                    >
                        <option value="todos">Todos os tribunais</option>
                        {tribunaisDisponiveis.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {processos.length === 0 ? (
                <div className="border border-ink/20 bg-card px-6 py-12 text-center">
                    <h2 className="text-base font-semibold text-ink">Nenhum processo acompanhado ainda</h2>
                    <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                        No Radar DJEN, busque as publicações da OAB ou de um número CNJ e use{" "}
                        <strong className="font-semibold text-ink">Salvar em Processos</strong> nas que quiser
                        acompanhar.
                    </p>
                    <button
                        type="button"
                        onClick={onAbrirRadarDjen}
                        className="mt-5 inline-flex h-9 items-center gap-1.5 bg-ink px-4 text-xs font-semibold text-paper hover:bg-ink-soft"
                    >
                        <Radar className="size-3.5" />
                        Abrir Radar DJEN
                    </button>
                </div>
            ) : abaLista === "publicacoes" ? (
                publicacoesPlanas.length === 0 ? (
                    <div className="border border-ink/20 bg-card px-6 py-10 text-center">
                        <p className="text-sm font-semibold text-ink">
                            {filtroPublicacoes === "novas"
                                ? "Nenhuma publicação não lida no momento."
                                : "Nenhuma publicação corresponde aos filtros."}
                        </p>
                        {(filtroPublicacoes === "novas" || busca.trim() || filtroTribunal !== "todos") && (
                            <button
                                type="button"
                                onClick={() => {
                                    setBusca("");
                                    setFiltroTribunal("todos");
                                    atualizarUrl({ filtro: null });
                                }}
                                className="mt-3 text-xs font-semibold text-ink underline underline-offset-4 hover:text-ink-soft"
                            >
                                Mostrar todas as publicações
                            </button>
                        )}
                    </div>
                ) : (
                    <div ref={listaPubRef} className="space-y-3">
                    <ul className="divide-y divide-ink/10 overflow-hidden border border-ink/15 bg-card">
                        {pagPub.itensPagina.map((pub, idx) => (
                            <li key={`${pub.calc.id}-${pub.id}-${idx}`}>
                                <button
                                    type="button"
                                    onClick={() => onAbrirProcesso(pub.calc)}
                                    className={cn(
                                        "grid w-full gap-x-6 gap-y-1.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-ink/[0.03] sm:grid-cols-[9rem_minmax(0,1fr)]",
                                        pub.nova && "bg-gold-light/15",
                                    )}
                                >
                                    <div className="text-xs tabular-nums">
                                        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                                            {pub.dataBr}
                                            {pub.nova && (
                                                <span className="bg-gold-light px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                                                    Nova
                                                </span>
                                            )}
                                        </p>
                                        {pub.recebidaEm && (
                                            <p className="text-muted-foreground" title="Quando a publicação entrou no sistema">
                                                entrou {formatarRecebidaEm(pub.recebidaEm)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="flex flex-wrap items-baseline gap-x-3">
                                            <span className="truncate text-sm font-semibold text-ink">
                                                {formatarNomeParte(pub.view.clienteNome)}
                                            </span>
                                            <span className="text-xs tabular-nums text-muted-foreground">
                                                <span className="font-semibold text-ink/80">{pub.tribunal}</span>
                                                {" · "}
                                                {pub.tipo}
                                                {pub.view.processoGlobal ? ` · ${pub.view.processoGlobal}` : ""}
                                            </span>
                                        </p>
                                        <p className="mt-1 line-clamp-2 max-w-[90ch] text-xs leading-relaxed text-muted-foreground">
                                            {pub.texto
                                                ? resumirTeorPublicacao(pub.texto)
                                                : "(Publicação sem teor textual disponibilizado)"}
                                        </p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <BarraPaginacao
                        pagina={pagPub.pagina}
                        totalPaginas={pagPub.totalPaginas}
                        total={pagPub.total}
                        inicio={pagPub.inicio}
                        fim={pagPub.fim}
                        onPagina={pagPub.irPara}
                        porPagina={pagPub.porPagina}
                        onPorPagina={pagPub.mudarPorPagina}
                        rotulo="publicações"
                        alvoRolagem={listaPubRef}
                    />
                    </div>
                )
            ) : filtrados.length === 0 ? (
                <div className="border border-ink/25 bg-card px-6 py-10 text-center">
                    <p className="text-sm font-semibold text-ink">Nenhum processo corresponde aos filtros.</p>
                    <button
                        type="button"
                        onClick={limparFiltros}
                        className="mt-3 text-xs font-semibold text-ink underline underline-offset-4 hover:text-ink-soft"
                    >
                        Limpar filtros
                    </button>
                </div>
            ) : (
                <>
                    <div ref={listaProcRef} aria-hidden className="-mb-4 h-0" />
                    {temFiltros && (
                        <p className="-mt-2 text-xs text-muted-foreground">
                            {plural(filtrados.length, "processo encontrado", "processos encontrados")} ·{" "}
                            <button
                                type="button"
                                onClick={limparFiltros}
                                className="font-semibold text-ink underline-offset-4 hover:underline"
                            >
                                Limpar filtros
                            </button>
                        </p>
                    )}

                    {/* Tabela (desktop) */}
                    <div className="hidden overflow-hidden border border-ink/15 bg-card xl:block">
                        <table className="w-full table-fixed border-collapse text-left text-sm">
                            <colgroup>
                                <col />
                                <col className="w-[15rem]" />
                                <col className="w-[10.5rem]" />
                                <col className="w-[11.5rem]" />
                                <col className="w-[7.5rem]" />
                                <col className="w-[3.5rem]" />
                            </colgroup>
                            <thead className="bg-ink text-xs text-paper/80">
                                <tr>
                                    <th scope="col" className="py-2.5 pl-4 pr-2 font-semibold">
                                        Cliente
                                    </th>
                                    <th scope="col" className="px-2.5 py-2.5 font-semibold">
                                        Processo
                                    </th>
                                    <th scope="col" className="px-2.5 py-2.5 font-semibold">
                                        Última publicação
                                    </th>
                                    <th scope="col" className="px-2.5 py-2.5 font-semibold">
                                        Situação e fase
                                    </th>
                                    <th scope="col" className="px-2.5 py-2.5 text-right font-semibold">
                                        Valor citado
                                    </th>
                                    <th scope="col" className="py-2.5 pl-2 pr-4 text-right font-semibold">
                                        <span className="sr-only">Ações</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ink/10">
                                {pagProc.itensPagina.map(({ calc, view }) => (
                                    <tr
                                        key={calc.id}
                                        onClick={() => onAbrirProcesso(calc)}
                                        className={cn(
                                            "cursor-pointer align-top transition-colors duration-150 hover:bg-ink/[0.035]",
                                            view.idsNovos.length > 0 && "bg-gold-light/15",
                                        )}
                                    >
                                        <td className="py-3 pl-4 pr-2">
                                            <div className="flex min-w-0 items-start gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAbrirProcesso(calc);
                                                    }}
                                                    title={view.clienteNome}
                                                    className="line-clamp-2 text-left font-semibold leading-snug text-ink hover:underline"
                                                >
                                                    {formatarNomeParte(view.clienteNome)}
                                                </button>
                                                {view.anotacoesInternas && (
                                                    <FileText
                                                        aria-label="Possui anotações internas"
                                                        className="mt-0.5 size-3.5 shrink-0 text-gold-deep"
                                                    />
                                                )}
                                            </div>
                                            <p
                                                title={view.parteContraria || undefined}
                                                className="mt-0.5 truncate text-xs text-muted-foreground"
                                            >
                                                {view.parteContraria ? `vs. ${view.parteContraria}` : "Parte contrária não identificada"}
                                            </p>
                                        </td>
                                        <td className="px-2.5 py-3">
                                            <div className="text-[13px]" onClick={(e) => e.stopPropagation()}>
                                                {renderCnj(calc, view)}
                                            </div>
                                            {(view.classe || view.orgao) && (
                                                <p
                                                    title={[formatarClasseProcessual(view.classe), view.orgao].filter(Boolean).join(" · ")}
                                                    className="mt-0.5 truncate text-xs text-muted-foreground"
                                                >
                                                    {[formatarClasseProcessual(view.classe), view.orgao].filter(Boolean).join(" · ")}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-3">{renderUltimaPublicacao(view)}</td>
                                        <td className="px-2.5 py-2.5">{renderSituacaoFase(calc, view)}</td>
                                        <td className="px-2.5 py-3 text-right tabular-nums">
                                            {view.valorCitado > 0 ? (
                                                <span className="font-semibold text-ink">{brl(view.valorCitado)}</span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 pl-1 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                                            {renderAcoes(calc, view)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Lista empilhada (celular e tablet) */}
                    <ul className="divide-y divide-ink/10 border border-ink/15 bg-card xl:hidden">
                        {pagProc.itensPagina.map(({ calc, view }) => (
                            <li key={calc.id} className={cn("space-y-3 p-4", view.idsNovos.length > 0 && "bg-gold-light/15")}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => onAbrirProcesso(calc)}
                                            className="line-clamp-2 text-left font-semibold leading-snug text-ink hover:underline"
                                        >
                                            {formatarNomeParte(view.clienteNome)}
                                        </button>
                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                            {view.parteContraria ? `vs. ${view.parteContraria}` : "Parte contrária não identificada"}
                                        </p>
                                    </div>
                                    {view.valorCitado > 0 && (
                                        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                                            {brl(view.valorCitado)}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1 text-sm">
                                    {renderCnj(calc, view)}
                                    {renderUltimaPublicacao(view)}
                                </div>

                                <div className="flex items-end justify-between gap-3">
                                    {renderSituacaoFase(calc, view)}
                                    {renderAcoes(calc, view)}
                                </div>
                            </li>
                        ))}
                    </ul>
                    <BarraPaginacao
                        pagina={pagProc.pagina}
                        totalPaginas={pagProc.totalPaginas}
                        total={pagProc.total}
                        inicio={pagProc.inicio}
                        fim={pagProc.fim}
                        onPagina={pagProc.irPara}
                        porPagina={pagProc.porPagina}
                        onPorPagina={pagProc.mudarPorPagina}
                        rotulo="processos"
                        alvoRolagem={listaProcRef}
                    />
                </>
            )}
        </div>
    );
};
