import { useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    Calculator,
    Check,
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
import { brl } from "@/lib/juros";
import {
    atualizarFichaProcessoDjen,
    lerDadosProcessoDjen,
    marcarPublicacoesDjenComoVistas,
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

    useEffect(() => {
        setClienteNome(view.clienteNome);
        setParteContraria(view.parteContraria);
        setProcessoGlobal(view.processoGlobal);
        setCategoriaId(view.categoriaId ?? "");
        setStatusProcesso(view.statusProcesso);
        setAnotacoesInternas(view.anotacoesInternas);
    }, [
        calc.id,
        calc.updated_at,
        view.clienteNome,
        view.parteContraria,
        view.processoGlobal,
        view.categoriaId,
        view.statusProcesso,
        view.anotacoesInternas,
    ]);

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
                    {view.linkUltimaPublicacao && (
                        <a
                            href={view.linkUltimaPublicacao}
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

            {/* Cabeçalho editorial do dossiê */}
            <header className="sheet-on-paper border border-ink/20 p-5 sm:p-6">
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

                        <h1 className="subdisplay text-2xl leading-tight text-ink sm:text-[1.75rem]">
                            {view.clienteNome}
                        </h1>

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
                                    <span>{view.classe}</span>
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
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Valor citado no texto
                            </span>
                            <span className="text-base font-bold text-ink">{brl(view.valorCitado)}</span>
                        </div>
                    )}
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Coluna esquerda: Ficha editável + Partes e Advogados */}
                <div className="space-y-5 lg:col-span-5">
                    <section className="sheet-on-paper space-y-4 border border-ink/20 p-5">
                        <div className="border-b border-ink/15 pb-2.5">
                            <h2 className="subdisplay text-lg text-ink">Dados do processo</h2>
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

                    <section className="sheet-on-paper space-y-4 border border-ink/20 p-5">
                        <div className="flex items-center gap-2 border-b border-ink/15 pb-2.5">
                            <Users className="size-4 text-gold-deep" />
                            <h2 className="subdisplay text-lg text-ink">Partes e Advogados Intimados</h2>
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
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
                <section className="space-y-4 lg:col-span-7">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/20 pb-2.5">
                        <h2 className="subdisplay text-xl text-ink">
                            Publicações no DJEN{" "}
                            <span className="font-sans text-base font-medium tabular-nums text-muted-foreground">
                                {view.movimentacoes.length}
                            </span>
                        </h2>
                    </div>

                    {view.movimentacoes.length === 0 ? (
                        <div className="sheet-on-paper border border-ink/20 p-6 text-center">
                            <p className="subdisplay text-lg text-ink">Nenhuma movimentação registrada ainda.</p>
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
                        <div className="space-y-4">
                            {view.movimentacoes.map((m, idx) => (
                                <article
                                    key={`${m.id}-${idx}`}
                                    className="sheet-on-paper border border-ink/20 p-5"
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
                                            {m.link && (
                                                <a
                                                    href={m.link}
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
}: ProcessosSalvosDjenProps) => {
    const [busca, setBusca] = useState("");
    const [filtroStatus, setFiltroStatus] = useState<StatusProcessoDjen | "todos">("todos");
    const [filtroTribunal, setFiltroTribunal] = useState<string>("todos");
    const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
    const [operandoId, setOperandoId] = useState<string | null>(null);
    const [confirmarExclusaoId, setConfirmarExclusaoId] = useState<string | null>(null);
    const [copiadoCnjId, setCopiadoCnjId] = useState<string | null>(null);

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
        setFiltroStatus("todos");
        setFiltroTribunal("todos");
        setFiltroCategoria("todas");
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

    const renderSituacao = (calc: CalculoSalvo, view: ProcessoDjenSalvoView) => (
        <div className="flex items-center gap-2">
            <span aria-hidden className={cn("size-2 shrink-0", PONTO_STATUS[view.statusProcesso])} />
            <select
                value={view.statusProcesso}
                disabled={operandoId === calc.id}
                onChange={(e) => trocarStatusCard(calc, e.target.value as StatusProcessoDjen)}
                aria-label={`Situação do processo de ${view.clienteNome}`}
                className="h-8 min-w-0 cursor-pointer border border-transparent bg-transparent pr-1 text-sm text-ink hover:border-ink/25 focus:border-ink focus:outline-none disabled:cursor-wait disabled:opacity-60"
            >
                {OPCOES_STATUS.map((op) => (
                    <option key={op.value} value={op.value}>
                        {op.label}
                    </option>
                ))}
            </select>
        </div>
    );

    const renderFase = (calc: CalculoSalvo, view: ProcessoDjenSalvoView) => (
        <select
            value={calc.categoria_id ?? ""}
            disabled={operandoId === calc.id}
            onChange={(e) => trocarCategoriaCard(calc, e.target.value)}
            aria-label={`Fase do processo de ${view.clienteNome}`}
            className="h-8 w-auto min-w-0 max-w-[11rem] cursor-pointer border border-transparent bg-transparent pr-1 text-sm text-ink hover:border-ink/25 focus:border-ink focus:outline-none disabled:cursor-wait disabled:opacity-60"
        >
            <option value="">Sem fase</option>
            {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                    {c.nome}
                </option>
            ))}
        </select>
    );

    /** `atalhosSoNoXl`: na tabela entre lg e xl só cabe "Abrir"; os atalhos também existem no dossiê. */
    const renderAcoes = (calc: CalculoSalvo, view: ProcessoDjenSalvoView, atalhosSoNoXl = false) => {
        const classeAtalho = cn(
            "size-8 items-center justify-center border border-ink/25",
            atalhosSoNoXl ? "hidden xl:inline-flex" : "inline-flex",
        );
        if (confirmarExclusaoId === calc.id) {
            return (
                <div className="inline-flex items-center justify-end gap-1">
                    <span className="mr-1 whitespace-nowrap text-xs font-semibold text-destructive">
                        Excluir processo?
                    </span>
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
            );
        }

        return (
            <div className="inline-flex items-center justify-end gap-1">
                <button
                    type="button"
                    onClick={() => onAbrirProcesso(calc)}
                    className="inline-flex h-8 items-center gap-1 whitespace-nowrap bg-ink px-3 text-xs font-semibold text-paper hover:bg-ink-soft"
                >
                    <FolderOpen className="size-3.5" />
                    Abrir
                </button>
                <button
                    type="button"
                    onClick={() => onConsultarDjenProcesso(calc)}
                    title="Buscar novas publicações deste processo no DJEN"
                    aria-label={`Buscar publicações de ${view.clienteNome} no DJEN`}
                    className={cn(classeAtalho, "text-ink/80 hover:border-ink hover:bg-ink hover:text-paper")}
                >
                    <Gavel className="size-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => onLevarParaCalculadora(calc)}
                    title="Levar para a calculadora revisional"
                    aria-label={`Levar ${view.clienteNome} para a calculadora`}
                    className={cn(classeAtalho, "text-ink/80 hover:border-ink hover:bg-ink hover:text-paper")}
                >
                    <Calculator className="size-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => setConfirmarExclusaoId(calc.id)}
                    title="Excluir processo"
                    aria-label={`Excluir processo de ${view.clienteNome}`}
                    className={cn(classeAtalho, "text-ink/60 hover:border-destructive hover:text-destructive")}
                >
                    <Trash2 className="size-3.5" />
                </button>
            </div>
        );
    };

    const linhaPublicacao = (view: ProcessoDjenSalvoView) =>
        [view.tribunal, view.tipoComunicacao].filter(Boolean).join(" · ");

    return (
        <div className="space-y-5">
            <div className="sheet-on-paper p-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/15 pb-4">
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                            <h1 className="subdisplay text-2xl text-ink">Processos acompanhados</h1>
                            {estatisticas.total > 0 && (
                                <p className="text-xs font-medium tabular-nums text-muted-foreground">
                                    <strong className="text-ink">{estatisticas.total}</strong>{" "}
                                    {estatisticas.total === 1 ? "processo" : "processos"} ·{" "}
                                    {estatisticas.comNovidade > 0 && (
                                        <>
                                            <strong className="text-gold-deep">{estatisticas.comNovidade}</strong> com
                                            publicação nova ·{" "}
                                        </>
                                    )}
                                    <strong className="text-ink">{estatisticas.prazosAbertos}</strong> com prazo em
                                    aberto · {plural(estatisticas.tribunais, "tribunal", "tribunais")} ·{" "}
                                    {plural(estatisticas.totalMovs, "publicação salva", "publicações salvas")}
                                </p>
                            )}
                        </div>
                        {estatisticas.total > 0 && (
                            <p aria-live="polite" className="text-xs text-muted-foreground">
                                {verificandoDjen
                                    ? "Verificando novas publicações no DJEN…"
                                    : `Verificação automática a cada ${intervaloVerificacaoHoras} h${
                                          estatisticas.ultimaVerificacao
                                              ? ` · última ${descreverMomento(estatisticas.ultimaVerificacao)}`
                                              : ""
                                      }`}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onAbrirRadarDjen}
                            title="Buscar publicações da OAB/PE 61.107 no DJEN"
                            className="inline-flex h-9 items-center gap-1.5 border border-gold bg-gold-light/40 px-3 text-xs font-semibold text-ink hover:bg-gold-light"
                        >
                            <Radar className="size-3.5" />
                            Radar DJEN
                        </button>
                        <button
                            type="button"
                            onClick={onVerificarDjen}
                            disabled={verificandoDjen}
                            className="inline-flex h-9 items-center gap-1.5 border border-ink/30 px-3 text-xs font-semibold text-ink hover:bg-ink/5 disabled:cursor-wait disabled:opacity-60"
                        >
                            <RefreshCw className={cn("size-3.5", verificandoDjen && "animate-spin")} />
                            Verificar agora
                        </button>
                    </div>
                </div>

                {processos.length > 0 && (
                    <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center">
                        {/* Celular: select nativo; a partir do tablet, o controle segmentado inteiro cabe na linha */}
                        <select
                            value={filtroStatus}
                            onChange={(e) => setFiltroStatus(e.target.value as StatusProcessoDjen | "todos")}
                            aria-label="Filtrar por situação"
                            className="field cursor-pointer py-2 text-xs font-medium md:hidden [&>option]:text-ink"
                        >
                            {opcoesFiltroStatus.map((op) => (
                                <option key={op.value} value={op.value}>
                                    {op.value === "todos" ? "Todas as situações" : op.label} ({op.qtd})
                                </option>
                            ))}
                        </select>

                        <div
                            role="group"
                            aria-label="Filtrar por situação"
                            className="hidden shrink-0 self-start border border-ink/30 bg-background md:inline-flex"
                        >
                            {opcoesFiltroStatus.map((op, idx) => {
                                    const ativo = filtroStatus === op.value;
                                    return (
                                        <button
                                            key={op.value}
                                            type="button"
                                            aria-pressed={ativo}
                                            onClick={() => setFiltroStatus(op.value)}
                                            className={cn(
                                                "inline-flex h-9 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold transition-colors",
                                                idx > 0 && "border-l border-ink/25",
                                                ativo ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                                            )}
                                        >
                                            {op.label}
                                            <span
                                                className={cn(
                                                    "tabular-nums",
                                                    ativo ? "text-paper/70" : "text-muted-foreground",
                                                )}
                                            >
                                                {op.qtd}
                                            </span>
                                        </button>
                                    );
                                })}
                        </div>

                        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_11rem_auto]">
                            <div className="relative sm:col-span-2 lg:col-span-1">
                                <Search
                                    aria-hidden
                                    className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-ink/50"
                                />
                                <input
                                    type="search"
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                    placeholder="Buscar cliente, parte, CNJ, vara ou teor..."
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

                            {temFiltros && (
                                <button
                                    type="button"
                                    onClick={limparFiltros}
                                    className="justify-self-start whitespace-nowrap text-xs font-semibold text-ink underline-offset-4 hover:underline"
                                >
                                    Limpar filtros
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {processos.length === 0 ? (
                <div className="border border-ink/25 bg-card px-6 py-12 text-center">
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
                    {/* Tabela (desktop) */}
                    <div className="hidden overflow-x-auto overscroll-x-contain border border-ink/25 bg-card lg:block">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead className="border-b border-ink/25 bg-secondary/80 text-[11px] uppercase tracking-wider text-muted-foreground">
                                <tr>
                                    <th scope="col" className="whitespace-nowrap py-2.5 pl-4 pr-3 font-semibold">
                                        Cliente
                                    </th>
                                    <th scope="col" className="whitespace-nowrap px-3 py-2.5 font-semibold">
                                        Processo
                                    </th>
                                    <th scope="col" className="w-px whitespace-nowrap px-3 py-2.5 font-semibold">
                                        Última publicação
                                    </th>
                                    <th scope="col" className="w-px whitespace-nowrap px-3 py-2.5 font-semibold">
                                        Situação
                                    </th>
                                    <th scope="col" className="hidden w-px whitespace-nowrap px-3 py-2.5 font-semibold xl:table-cell">
                                        Fase
                                    </th>
                                    <th scope="col" className="w-px whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                                        Valor citado
                                    </th>
                                    <th scope="col" className="w-px whitespace-nowrap py-2.5 pl-3 pr-4 text-right font-semibold">
                                        <span className="sr-only">Ações</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ink/12">
                                {filtrados.map(({ calc, view }) => (
                                    <tr key={calc.id} className="transition-colors hover:bg-ink/[0.025]">
                                        <td className="min-w-[12rem] py-3 pl-4 pr-3 align-middle">
                                            <div className="flex min-w-0 items-start gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => onAbrirProcesso(calc)}
                                                    title={view.clienteNome}
                                                    className="line-clamp-2 break-words text-left font-semibold leading-snug text-ink hover:underline"
                                                >
                                                    {view.clienteNome}
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
                                                className="mt-0.5 line-clamp-1 break-all text-xs text-muted-foreground"
                                            >
                                                {view.parteContraria ? `vs. ${view.parteContraria}` : "Parte contrária não identificada"}
                                            </p>
                                        </td>
                                        <td className="max-w-[17rem] px-3 py-3 align-middle">
                                            {renderCnj(calc, view)}
                                            {(view.classe || view.orgao) && (
                                                <p
                                                    title={[view.classe, view.orgao].filter(Boolean).join(" · ")}
                                                    className="mt-0.5 line-clamp-1 break-all text-xs text-muted-foreground"
                                                >
                                                    {[view.classe, view.orgao].filter(Boolean).join(" · ")}
                                                </p>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 align-middle">
                                            <span className="tabular-nums text-ink">
                                                {view.dataUltimaPublicacaoBr || "—"}
                                            </span>
                                            {view.idsNovos.length > 0 && (
                                                <span className="ml-2 bg-gold-light px-1.5 py-0.5 text-[11px] font-semibold text-ink">
                                                    {view.idsNovos.length === 1 ? "1 nova" : `${view.idsNovos.length} novas`}
                                                </span>
                                            )}
                                            <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                                                {linhaPublicacao(view)}
                                                {view.movimentacoes.length > 1 &&
                                                    ` · ${plural(view.movimentacoes.length, "publicação", "publicações")}`}
                                            </p>
                                        </td>
                                        <td className="px-3 py-3 align-middle">{renderSituacao(calc, view)}</td>
                                        <td className="hidden px-3 py-3 align-middle xl:table-cell">{renderFase(calc, view)}</td>
                                        <td className="whitespace-nowrap px-3 py-3 text-right align-middle tabular-nums">
                                            {view.valorCitado > 0 ? (
                                                <span className="font-semibold text-ink">{brl(view.valorCitado)}</span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="py-3 pl-3 pr-4 text-right align-middle">
                                            {renderAcoes(calc, view, true)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Lista empilhada (celular e tablet) */}
                    <ul className="divide-y divide-ink/12 border border-ink/25 bg-card lg:hidden">
                        {filtrados.map(({ calc, view }) => (
                            <li key={calc.id} className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => onAbrirProcesso(calc)}
                                            className="line-clamp-2 break-words text-left font-semibold leading-snug text-ink hover:underline"
                                        >
                                            {view.clienteNome}
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

                                <div className="space-y-0.5 text-sm">
                                    {renderCnj(calc, view)}
                                    <p className="text-xs text-muted-foreground">
                                        {view.idsNovos.length > 0 && (
                                            <span className="mr-2 bg-gold-light px-1.5 py-0.5 font-semibold text-ink">
                                                {view.idsNovos.length === 1 ? "1 nova" : `${view.idsNovos.length} novas`}
                                            </span>
                                        )}
                                        {[view.dataUltimaPublicacaoBr, linhaPublicacao(view)].filter(Boolean).join(" · ")}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {renderSituacao(calc, view)}
                                    {renderFase(calc, view)}
                                </div>

                                <div className="flex justify-end">{renderAcoes(calc, view)}</div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
};
