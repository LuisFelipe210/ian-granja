import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
    BookmarkPlus,
    Calculator,
    Check,
    Copy,
    ExternalLink,
    FolderOpen,
    FolderPlus,
    Gavel,
    Loader2,
    Radar,
    Search,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/juros";
import {
    OAB_ESCRITORIO_PADRAO,
    consultarDjen,
    cruzarComunicacoesComCarteira,
    extrairDadosCarteiraDeDjen,
    type DjenComunicacao,
} from "@/lib/juros/djen";
import { isCalculoPendente, type CalculoSalvo, type Categoria } from "@/lib/revisional-db";

export interface ContextoInicialDjen {
    modoInicial?: "processo" | "oab";
    calculoId?: string | null;
    clienteNome?: string;
    processoGlobal?: string;
}

interface ModalConsultaDjenProps {
    aberto: boolean;
    contexto: ContextoInicialDjen | null;
    calculos: CalculoSalvo[];
    categorias: Categoria[];
    onFechar: () => void;
    onAbrirCaso?: (c: CalculoSalvo) => void;
    onAbrirProcessoSalvo?: (c: CalculoSalvo) => void;
    onUsarNaCalculadora?: (dados: {
        clienteNome: string;
        processoGlobal: string;
        banco: string;
        documentoContrato?: string;
        categoriaId?: string | null;
        modalidadeId?: string;
        observacao?: string;
    }) => void;
    onVincularCnjObservacao?: (opts: {
        calculoId: string | null;
        processoGlobal?: string;
        observacaoAdicional?: string;
        comunicacao?: DjenComunicacao;
    }) => Promise<void> | void;
    onSalvarNaCarteira?: (item: DjenComunicacao) => Promise<void>;
}

type AbaDjen = "processo" | "oab";
type JanelaDias = "recentes" | "7" | "15" | "30" | "90";

export const ModalConsultaDjen = ({
    aberto,
    contexto,
    calculos,
    categorias,
    onFechar,
    onAbrirCaso,
    onAbrirProcessoSalvo,
    onUsarNaCalculadora,
    onVincularCnjObservacao,
    onSalvarNaCarteira,
}: ModalConsultaDjenProps) => {
    const [aba, setAba] = useState<AbaDjen>("oab");
    const [numeroProcesso, setNumeroProcesso] = useState("");
    const [nomeParte, setNomeParte] = useState("");
    const [numeroOab, setNumeroOab] = useState<string>(OAB_ESCRITORIO_PADRAO.numeroOab);
    const [ufOab, setUfOab] = useState<string>(OAB_ESCRITORIO_PADRAO.ufOab);
    const [siglaTribunal, setSiglaTribunal] = useState("");
    const [janelaDias, setJanelaDias] = useState<JanelaDias>("recentes");
    const [apenasCarteira, setApenasCarteira] = useState(false);
    const [filtroTextoLocal, setFiltroTextoLocal] = useState("");

    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [totalNoDjen, setTotalNoDjen] = useState(0);
    const [resultadosBrutos, setResultadosBrutos] = useState<DjenComunicacao[]>([]);
    const [copiadoId, setCopiadoId] = useState<number | null>(null);
    const [salvandoId, setSalvandoId] = useState<number | null>(null);
    const [salvandoCarteiraId, setSalvandoCarteiraId] = useState<number | null>(null);
    const [salvandoLote, setSalvandoLote] = useState(false);

    const executarBusca = useCallback(
        async (params: {
            modo: AbaDjen;
            proc: string;
            parte: string;
            oab: string;
            uf: string;
            tribunal: string;
            dias: JanelaDias;
        }) => {
            setErro(null);
            setCarregando(true);
            try {
                let dataInicio: string | undefined;
                let dataFim: string | undefined;
                if (params.dias !== "recentes") {
                    const diasNum = Number(params.dias);
                    const hoje = new Date();
                    const ini = new Date(hoje.getTime() - diasNum * 86400_000);
                    dataInicio = ini.toISOString().slice(0, 10);
                    dataFim = hoje.toISOString().slice(0, 10);
                }

                const res = await consultarDjen({
                    numeroProcesso: params.modo === "processo" ? params.proc || undefined : undefined,
                    nomeParte: params.modo === "processo" && !params.proc ? params.parte || undefined : undefined,
                    numeroOab:
                        params.modo === "oab" || (params.modo === "processo" && !params.proc && params.parte)
                            ? params.oab || OAB_ESCRITORIO_PADRAO.numeroOab
                            : undefined,
                    ufOab:
                        params.modo === "oab" || (params.modo === "processo" && !params.proc && params.parte)
                            ? params.uf || OAB_ESCRITORIO_PADRAO.ufOab
                            : undefined,
                    siglaTribunal: params.tribunal.trim() || undefined,
                    dataDisponibilizacaoInicio: dataInicio,
                    dataDisponibilizacaoFim: dataFim,
                    itensPorPagina: 100,
                });

                setTotalNoDjen(res.totalRegistros);
                setResultadosBrutos(res.items);
            } catch (e) {
                setErro(e instanceof Error ? e.message : "Erro ao consultar publicações no DJEN.");
                setResultadosBrutos([]);
                setTotalNoDjen(0);
            } finally {
                setCarregando(false);
            }
        },
        [],
    );

    useEffect(() => {
        if (!aberto) return;
        const modoInicial: AbaDjen = contexto?.modoInicial ?? "oab";
        const procInicial = contexto?.processoGlobal?.trim() ?? "";
        const parteInicial = contexto?.clienteNome?.trim() ?? "";

        setAba(modoInicial);
        setNumeroProcesso(procInicial);
        setNomeParte(parteInicial);
        setFiltroTextoLocal("");
        setErro(null);

        if (modoInicial === "processo" && (procInicial || parteInicial)) {
            void executarBusca({
                modo: "processo",
                proc: procInicial,
                parte: parteInicial,
                oab: numeroOab,
                uf: ufOab,
                tribunal: siglaTribunal,
                dias: "recentes",
            });
        } else if (modoInicial === "oab") {
            void executarBusca({
                modo: "oab",
                proc: "",
                parte: "",
                oab: numeroOab,
                uf: ufOab,
                tribunal: siglaTribunal,
                dias: janelaDias,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aberto, contexto]);

    useEffect(() => {
        if (!aberto) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onFechar();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [aberto, onFechar]);

    const resultadosCruzados = useMemo(
        () => cruzarComunicacoesComCarteira(resultadosBrutos, calculos, categorias),
        [resultadosBrutos, calculos, categorias],
    );

    const resultadosExibidos = useMemo(() => {
        const termo = filtroTextoLocal.trim().toLowerCase();
        return resultadosCruzados.filter((item) => {
            if (apenasCarteira && !item.clienteVinculado) return false;
            if (!termo) return true;
            const alvo = [
                item.numeroProcessoMascara,
                item.siglaTribunal,
                item.nomeOrgao,
                item.nomeClasse,
                item.texto,
                item.clienteVinculado?.clienteNome ?? "",
                ...item.destinatarios.map((d) => d.nome),
            ]
                .join(" ")
                .toLowerCase();
            return alvo.includes(termo);
        });
    }, [apenasCarteira, filtroTextoLocal, resultadosCruzados]);

    const qtdNaCarteira = useMemo(
        () => resultadosCruzados.filter((item) => item.clienteVinculado !== null).length,
        [resultadosCruzados],
    );

    const naoVinculadosUnicos = useMemo(() => {
        const vistos = new Set<string>();
        const lista: DjenComunicacao[] = [];
        for (const item of resultadosExibidos) {
            if (item.clienteVinculado) continue;
            const chave = item.numeroProcessoDigitos || String(item.id);
            if (vistos.has(chave)) continue;
            vistos.add(chave);
            lista.push(item);
        }
        return lista;
    }, [resultadosExibidos]);

    if (!aberto) return null;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        void executarBusca({
            modo: aba,
            proc: numeroProcesso,
            parte: nomeParte,
            oab: numeroOab,
            uf: ufOab,
            tribunal: siglaTribunal,
            dias: janelaDias,
        });
    };

    const copiarTeor = async (item: DjenComunicacao) => {
        const cabecalho = `${item.dataDisponibilizacaoBr} · ${item.siglaTribunal} · ${item.nomeOrgao} · Processo ${item.numeroProcessoMascara}`;
        try {
            await navigator.clipboard.writeText(`${cabecalho}\n\n${item.texto}`);
            setCopiadoId(item.id);
            setTimeout(() => setCopiadoId(null), 1800);
        } catch {
            /* ignore */
        }
    };

    const salvarObservacaoCaso = async (item: DjenComunicacao, incluirCnj = false) => {
        if (!onVincularCnjObservacao) return;
        const resumoTrecho =
            item.texto.length > 420 ? `${item.texto.slice(0, 420).trim()}...` : item.texto;
        const nota = `[DJEN ${item.dataDisponibilizacaoBr} · ${item.siglaTribunal} · ${item.nomeOrgao}]: ${resumoTrecho}`;
        setSalvandoId(item.id);
        try {
            await onVincularCnjObservacao({
                calculoId: contexto?.calculoId ?? item.clienteVinculado?.id ?? null,
                processoGlobal: incluirCnj ? item.numeroProcessoMascara : undefined,
                observacaoAdicional: nota,
                comunicacao: item,
            });
            toast.success(
                incluirCnj
                    ? `CNJ ${item.numeroProcessoMascara} vinculado e publicação salva nas observações.`
                    : "Publicação salva nas observações do caso.",
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o caso.");
        } finally {
            setSalvandoId(null);
        }
    };

    const salvarItemNaCarteira = async (item: DjenComunicacao) => {
        if (!onSalvarNaCarteira) return;
        setSalvandoCarteiraId(item.id);
        try {
            await onSalvarNaCarteira(item);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível salvar na carteira.");
        } finally {
            setSalvandoCarteiraId(null);
        }
    };

    const salvarVisiveisNaCarteira = async () => {
        if (!onSalvarNaCarteira || naoVinculadosUnicos.length === 0) return;
        setSalvandoLote(true);
        let salvos = 0;
        let falhas = 0;
        try {
            for (const item of naoVinculadosUnicos) {
                try {
                    await onSalvarNaCarteira(item);
                    salvos += 1;
                } catch {
                    falhas += 1;
                }
            }
            if (salvos > 0 && falhas === 0) {
                toast.success(
                    `${salvos} ${salvos === 1 ? "processo salvo" : "processos salvos"} em Processos.`,
                    { id: "djen-carteira-save" },
                );
            } else if (salvos > 0) {
                toast.warning(`${salvos} salvos e ${falhas} não puderam ser gravados.`, {
                    id: "djen-carteira-save",
                });
            } else {
                toast.error("Não foi possível salvar as publicações selecionadas.");
            }
        } finally {
            setSalvandoLote(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-deep/80 p-3 sm:p-5 backdrop-blur-[1px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="djen-modal-title"
            onClick={(e) => {
                if (e.target === e.currentTarget) onFechar();
            }}
        >
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col border-2 border-ink bg-card shadow-2xl">
                {/* Cabeçalho */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/20 bg-ink px-5 py-4 text-paper">
                    <div className="flex items-center gap-2.5">
                        <Gavel className="size-4 text-gold-light" />
                        <div>
                            <h2 id="djen-modal-title" className="subdisplay text-lg text-paper">
                                Consulta Oficial DJEN · CNJ
                            </h2>
                            <p className="text-[11px] text-paper/75">
                                Diário de Justiça Eletrônico Nacional (comunicaapi.pje.jus.br)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div role="tablist" className="inline-flex border border-paper/25 bg-ink-deep/60 text-xs">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={aba === "oab"}
                                onClick={() => setAba("oab")}
                                className={cn(
                                    "inline-flex h-8 items-center gap-1.5 px-3 font-semibold transition-colors",
                                    aba === "oab" ? "bg-gold-light text-ink" : "text-paper/80 hover:text-paper",
                                )}
                            >
                                <Radar className="size-3.5" />
                                Radar OAB
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={aba === "processo"}
                                onClick={() => setAba("processo")}
                                className={cn(
                                    "inline-flex h-8 items-center gap-1.5 border-l border-paper/25 px-3 font-semibold transition-colors",
                                    aba === "processo"
                                        ? "bg-gold-light text-ink"
                                        : "text-paper/80 hover:text-paper",
                                )}
                            >
                                <Search className="size-3.5" />
                                Por Processo / Parte
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={onFechar}
                            aria-label="Fechar consulta DJEN"
                            className="inline-flex size-8 items-center justify-center text-paper/75 hover:text-paper"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                </div>

                {/* Formulário de filtros */}
                <form onSubmit={handleSubmit} className="space-y-3 border-b border-ink/15 bg-secondary/45 px-5 py-4">
                    {aba === "processo" ? (
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem_auto] sm:items-end">
                            <div>
                                <label htmlFor="djen-proc" className="block text-xs font-semibold text-ink">
                                    Nº do Processo (CNJ)
                                </label>
                                <input
                                    id="djen-proc"
                                    value={numeroProcesso}
                                    onChange={(e) => setNumeroProcesso(e.target.value)}
                                    placeholder="0002720-86.2026.8.17.1130"
                                    className="field py-1.5 text-sm tabular-nums"
                                />
                            </div>
                            <div>
                                <label htmlFor="djen-parte" className="block text-xs font-semibold text-ink">
                                    Ou nome da parte (com OAB {numeroOab}/{ufOab})
                                </label>
                                <input
                                    id="djen-parte"
                                    value={nomeParte}
                                    onChange={(e) => setNomeParte(e.target.value)}
                                    placeholder="Nome do cliente / parte"
                                    className="field py-1.5 text-sm"
                                />
                            </div>
                            <div>
                                <label htmlFor="djen-trib-p" className="block text-xs font-semibold text-ink">
                                    Tribunal
                                </label>
                                <input
                                    id="djen-trib-p"
                                    value={siglaTribunal}
                                    onChange={(e) => setSiglaTribunal(e.target.value)}
                                    placeholder="Todos (ex. TJPE)"
                                    className="field py-1.5 text-sm uppercase"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={carregando}
                                className="inline-flex h-9 items-center justify-center gap-1.5 bg-ink px-4 text-xs font-semibold text-paper hover:bg-ink-soft disabled:opacity-60"
                            >
                                {carregando ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                                Buscar
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-[7.5rem_4.5rem_8.5rem_10rem_auto] sm:items-end">
                            <div>
                                <label htmlFor="djen-oab" className="block text-xs font-semibold text-ink">
                                    Nº OAB
                                </label>
                                <input
                                    id="djen-oab"
                                    value={numeroOab}
                                    onChange={(e) => setNumeroOab(e.target.value)}
                                    className="field py-1.5 text-sm tabular-nums"
                                />
                            </div>
                            <div>
                                <label htmlFor="djen-uf" className="block text-xs font-semibold text-ink">
                                    UF
                                </label>
                                <input
                                    id="djen-uf"
                                    value={ufOab}
                                    maxLength={2}
                                    onChange={(e) => setUfOab(e.target.value.toUpperCase())}
                                    className="field py-1.5 text-sm uppercase"
                                />
                            </div>
                            <div>
                                <label htmlFor="djen-trib" className="block text-xs font-semibold text-ink">
                                    Tribunal
                                </label>
                                <input
                                    id="djen-trib"
                                    value={siglaTribunal}
                                    onChange={(e) => setSiglaTribunal(e.target.value)}
                                    placeholder="Todos"
                                    className="field py-1.5 text-sm uppercase"
                                />
                            </div>
                            <div>
                                <label htmlFor="djen-dias" className="block text-xs font-semibold text-ink">
                                    Período
                                </label>
                                <select
                                    id="djen-dias"
                                    value={janelaDias}
                                    onChange={(e) => setJanelaDias(e.target.value as JanelaDias)}
                                    className="field cursor-pointer py-1.5 text-xs font-semibold [&>option]:text-ink"
                                >
                                    <option value="recentes">Últimas publicações</option>
                                    <option value="7">Últimos 7 dias</option>
                                    <option value="15">Últimos 15 dias</option>
                                    <option value="30">Últimos 30 dias</option>
                                    <option value="90">Últimos 90 dias</option>
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={carregando}
                                className="inline-flex h-9 items-center justify-center gap-1.5 bg-ink px-4 text-xs font-semibold text-paper hover:bg-ink-soft disabled:opacity-60"
                            >
                                {carregando ? <Loader2 className="size-3.5 animate-spin" /> : <Radar className="size-3.5" />}
                                Consultar OAB
                            </button>
                        </div>
                    )}

                    {/* Barra de resumo e filtro local */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                            <span>
                                Total no DJEN: <strong className="text-ink">{totalNoDjen}</strong>
                            </span>
                            {resultadosBrutos.length > 0 && (
                                <span>
                                    Cruzados na carteira: <strong className="text-[#126A35]">{qtdNaCarteira}</strong>
                                </span>
                            )}
                            <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-ink">
                                <input
                                    type="checkbox"
                                    checked={apenasCarteira}
                                    onChange={(e) => setApenasCarteira(e.target.checked)}
                                    className="accent-ink"
                                />
                                Só clientes da carteira
                            </label>
                            {onSalvarNaCarteira && !carregando && naoVinculadosUnicos.length > 0 && (
                                <button
                                    type="button"
                                    disabled={salvandoLote || salvandoCarteiraId !== null}
                                    onClick={salvarVisiveisNaCarteira}
                                    className="inline-flex h-7 items-center gap-1.5 border border-[#126A35]/40 bg-[#126A35]/10 px-2.5 text-[11px] font-semibold text-[#126A35] hover:bg-[#126A35] hover:text-paper disabled:opacity-60"
                                >
                                    {salvandoLote ? (
                                        <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                        <FolderPlus className="size-3" />
                                    )}
                                    Salvar visíveis em Processos ({naoVinculadosUnicos.length})
                                </button>
                            )}
                        </div>

                        <input
                            type="search"
                            value={filtroTextoLocal}
                            onChange={(e) => setFiltroTextoLocal(e.target.value)}
                            placeholder="Filtrar nos resultados (ex.: alvará, banco, sentença)..."
                            className="w-full border border-ink/20 bg-card px-2.5 py-1 text-xs text-ink sm:w-72"
                        />
                    </div>
                </form>

                {/* Lista de publicações */}
                <div className="flex-1 space-y-3 overflow-y-auto p-5">
                    {carregando ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                            <Loader2 className="size-6 animate-spin text-gold-deep" />
                            <span>Consultando Diário de Justiça Eletrônico Nacional (CNJ)...</span>
                        </div>
                    ) : erro ? (
                        <div className="border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                            {erro}
                        </div>
                    ) : resultadosExibidos.length === 0 ? (
                        <div className="border border-ink/20 bg-background/60 p-8 text-center">
                            <p className="subdisplay text-lg text-ink">Nenhuma publicação exibida.</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {apenasCarteira && resultadosBrutos.length > 0
                                    ? "Há publicações no DJEN, mas nenhuma vinculada aos processos já cadastrados na carteira."
                                    : "Informe o número CNJ do processo ou consulte as publicações recentes da OAB acima."}
                            </p>
                        </div>
                    ) : (
                        resultadosExibidos.map((item) => {
                            const vinc = item.clienteVinculado;
                            const casoObj = vinc ? calculos.find((c) => c.id === vinc.id) ?? null : null;
                            const podeVincularNaFicha = Boolean(
                                onVincularCnjObservacao && (contexto?.calculoId || vinc?.id),
                            );
                            const extraidoCarteira = !vinc ? extrairDadosCarteiraDeDjen(item, categorias) : null;
                            const previewCarteira = onSalvarNaCarteira ? extraidoCarteira : null;

                            return (
                                <article
                                    key={item.id || `${item.numeroProcessoDigitos}-${item.dataDisponibilizacao}`}
                                    className={cn(
                                        "border border-ink/20 bg-card p-4",
                                        vinc && "border-l-[3px] border-l-[#126A35]",
                                    )}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-ink/12 pb-2.5">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                                <span className="bg-ink px-2 py-0.5 text-[11px] font-bold tabular-nums text-paper">
                                                    {item.dataDisponibilizacaoBr || "Sem data"}
                                                </span>
                                                <span className="border border-ink/25 bg-secondary px-2 py-0.5 text-[11px] font-bold text-ink">
                                                    {item.siglaTribunal || "DJEN"}
                                                </span>
                                                <span className="bg-gold-light/45 px-2 py-0.5 text-[11px] font-semibold text-ink">
                                                    {item.tipoComunicacao}
                                                </span>
                                                {item.numeroProcessoMascara && (
                                                    <span className="font-semibold tabular-nums text-ink">
                                                        {item.numeroProcessoMascara}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {item.nomeOrgao}
                                                {item.nomeClasse ? ` · ${item.nomeClasse}` : ""}
                                            </p>
                                        </div>

                                        {vinc && (
                                            <div className="flex flex-wrap items-center gap-2 border border-[#126A35]/30 bg-[#126A35]/10 px-2.5 py-1 text-[11px]">
                                                {casoObj && isCalculoPendente(casoObj) ? (
                                                    <>
                                                        <span className="font-semibold text-[#126A35]">
                                                            Salvo em Processos: {vinc.clienteNome} ({vinc.faseKanban})
                                                        </span>
                                                        {(onAbrirProcessoSalvo || onAbrirCaso) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (onAbrirProcessoSalvo) {
                                                                        onAbrirProcessoSalvo(casoObj);
                                                                    } else {
                                                                        onAbrirCaso?.(casoObj);
                                                                    }
                                                                    onFechar();
                                                                }}
                                                                className="inline-flex items-center gap-1 font-bold text-ink underline"
                                                            >
                                                                <FolderOpen className="size-3" />
                                                                Ver Processo
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="font-semibold text-[#126A35]">
                                                            Carteira de Cálculos: {vinc.clienteNome} ({vinc.faseKanban}
                                                            ) · {brl(vinc.valorTotalAcao)}
                                                        </span>
                                                        {casoObj && onAbrirCaso && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    onAbrirCaso(casoObj);
                                                                    onFechar();
                                                                }}
                                                                className="inline-flex items-center gap-1 font-bold text-ink underline"
                                                            >
                                                                <FolderOpen className="size-3" />
                                                                Abrir Cálculo
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {item.destinatarios.length > 0 && (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            <strong className="text-ink">Partes:</strong>{" "}
                                            {item.destinatarios
                                                .map((d) => (d.polo ? `${d.nome} (${d.polo})` : d.nome))
                                                .join(" × ")}
                                        </p>
                                    )}

                                    {previewCarteira && (
                                        <p className="mt-2 border-l-2 border-gold/70 bg-secondary/40 px-2.5 py-1.5 text-[11px] text-ink/85">
                                            <strong>Dados p/ Processos:</strong> Cliente:{" "}
                                            <span className="font-semibold">{previewCarteira.ficha.clienteNome}</span>
                                            {previewCarteira.ficha.banco && (
                                                <>
                                                    {" · "}Banco/Parte:{" "}
                                                    <span className="font-semibold">{previewCarteira.ficha.banco}</span>
                                                </>
                                            )}
                                            {" · "}Fase:{" "}
                                            <span className="font-semibold">
                                                {previewCarteira.categoriaNomeSugerida}
                                            </span>
                                            {previewCarteira.valorEstimadoAcao > 0 && (
                                                <>
                                                    {" · "}Valor citado:{" "}
                                                    <span className="font-semibold">
                                                        {brl(previewCarteira.valorEstimadoAcao)}
                                                    </span>
                                                </>
                                            )}
                                        </p>
                                    )}

                                    <div className="mt-2.5 max-h-48 overflow-y-auto border border-ink/12 bg-background/60 p-3 font-serif text-xs leading-relaxed whitespace-pre-wrap text-ink">
                                        {item.texto || "(Publicação sem texto disponibilizado — acesse pelo link do tribunal.)"}
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => copiarTeor(item)}
                                            className="inline-flex h-8 items-center gap-1.5 border border-ink/25 px-2.5 text-[11px] font-semibold text-ink hover:bg-ink/5"
                                        >
                                            {copiadoId === item.id ? (
                                                <Check className="size-3 text-[#126A35]" />
                                            ) : (
                                                <Copy className="size-3" />
                                            )}
                                            {copiadoId === item.id ? "Copiado" : "Copiar teor"}
                                        </button>

                                        {item.link && (
                                            <a
                                                href={item.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex h-8 items-center gap-1.5 border border-ink/25 px-2.5 text-[11px] font-semibold text-ink hover:bg-ink/5"
                                            >
                                                <ExternalLink className="size-3" />
                                                Ver no Tribunal
                                            </a>
                                        )}

                                        {podeVincularNaFicha && (
                                            <button
                                                type="button"
                                                disabled={salvandoId === item.id}
                                                onClick={() =>
                                                    salvarObservacaoCaso(
                                                        item,
                                                        !contexto?.processoGlobal && Boolean(item.numeroProcessoMascara),
                                                    )
                                                }
                                                className="inline-flex h-8 items-center gap-1.5 border border-gold bg-gold-light/50 px-2.5 text-[11px] font-semibold text-ink hover:bg-gold-light disabled:opacity-60"
                                            >
                                                {salvandoId === item.id ? (
                                                    <Loader2 className="size-3 animate-spin" />
                                                ) : (
                                                    <BookmarkPlus className="size-3" />
                                                )}
                                                {!contexto?.processoGlobal && item.numeroProcessoMascara
                                                    ? "Vincular CNJ + Salvar obs."
                                                    : "Salvar nas observações"}
                                            </button>
                                        )}

                                        {onUsarNaCalculadora && !vinc && extraidoCarteira && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onUsarNaCalculadora({
                                                        clienteNome: extraidoCarteira.ficha.clienteNome,
                                                        processoGlobal: extraidoCarteira.ficha.processoGlobal ?? "",
                                                        banco: extraidoCarteira.ficha.banco,
                                                        documentoContrato: extraidoCarteira.ficha.documentoContrato,
                                                        categoriaId: extraidoCarteira.ficha.categoriaId,
                                                        modalidadeId: extraidoCarteira.modalidadeId,
                                                        observacao: extraidoCarteira.ficha.observacoes,
                                                    });
                                                    onFechar();
                                                }}
                                                className="inline-flex h-8 items-center gap-1.5 border border-ink bg-card px-3 text-[11px] font-semibold text-ink hover:bg-ink/5"
                                            >
                                                <Calculator className="size-3" />
                                                Usar na Calculadora
                                            </button>
                                        )}

                                        {onSalvarNaCarteira && !vinc && (
                                            <button
                                                type="button"
                                                disabled={salvandoLote || salvandoCarteiraId === item.id}
                                                onClick={() => salvarItemNaCarteira(item)}
                                                className="inline-flex h-8 items-center gap-1.5 bg-[#126A35] px-3 text-[11px] font-semibold text-paper hover:bg-[#0e562b] disabled:opacity-60"
                                            >
                                                {salvandoCarteiraId === item.id ? (
                                                    <Loader2 className="size-3 animate-spin" />
                                                ) : (
                                                    <FolderPlus className="size-3" />
                                                )}
                                                Salvar em Processos
                                            </button>
                                        )}
                                    </div>
                                </article>
                            );
                        })
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
};
