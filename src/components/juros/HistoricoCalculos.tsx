import { Fragment, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
    ArrowDownUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Columns3,
    CopyPlus,
    Eye,
    EyeOff,
    FileDown,
    FileText,
    FolderKanban,
    FolderOpen,
    GripVertical,
    List,
    Loader2,
    Maximize2,
    Minimize2,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { brl, mNome, num, type Nivel } from "@/lib/juros";
import { calcularProcessoRevisional, prepararDadosBacenProcesso } from "@/lib/juros/revisional-pro";
import { baixarLaudoPdf } from "@/lib/juros/laudo-pdf";
import { normalizarRotuloBanco } from "@/lib/juros/graficos-dados";
import {
    atualizarCalculo,
    calculoParaProcesso,
    excluirCalculo,
    type CalculoSalvo,
    type Categoria,
} from "@/lib/revisional-db";
import { SeloCategoria } from "@/components/juros/GerenciarCategorias";

type ModoExibicao = "tabela" | "agrupado" | "quadro";
type DensidadeQuadro = "detalhado" | "compacto";
type CampoOrdenacao = "recentes" | "valor_desc" | "abuso_desc" | "nome_asc" | "banco_asc";

const VIEW_STORAGE_KEY = "ig_historico_modo_v1";
const QUADRO_DENSIDADE_KEY = "ig_historico_quadro_densidade_v1";

const ROTULO_NIVEL_CURTO: Record<Nivel, string> = {
    abuso: "Abuso",
    acima: "Acima",
    media: "Na média",
};

const COR_NIVEL: Record<Nivel, string> = {
    abuso: "bg-destructive text-destructive-foreground",
    acima: "bg-gold-light text-ink",
    media: "bg-[#126A35]/15 text-[#126A35]",
};

const BORDA_NIVEL: Record<Nivel, string> = {
    abuso: "border-l-[3px] border-l-destructive",
    acima: "border-l-[3px] border-l-gold",
    media: "border-l-[3px] border-l-[#126A35]",
};

const BORDA_TOPO_CAT: Record<string, string> = {
    gold: "border-t-[3px] border-t-gold",
    ink: "border-t-[3px] border-t-ink",
    crimson: "border-t-[3px] border-t-destructive",
    emerald: "border-t-[3px] border-t-[#126A35]",
    slate: "border-t-[3px] border-t-[#475273]",
};

const FUNDO_CAB_CAT: Record<string, string> = {
    gold: "bg-gold-light/20",
    ink: "bg-ink/[0.04]",
    crimson: "bg-destructive/[0.05]",
    emerald: "bg-[#126A35]/[0.06]",
    slate: "bg-secondary/70",
};

function rotuloCurtoCaso(c: CalculoSalvo): string {
    if (c.nivel === "abuso") return ROTULO_NIVEL_CURTO.abuso;
    if (c.nivel === "acima") return ROTULO_NIVEL_CURTO.acima;
    return Number(c.razao_am) < 0.96 ? "Juros bons" : "Na média";
}

const COR_PONTO_CAT: Record<string, string> = {
    gold: "bg-gold",
    ink: "bg-ink",
    crimson: "bg-destructive",
    emerald: "bg-[#126A35]",
    slate: "bg-[#475273]",
};

function formatarDataCurta(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
        });
    } catch {
        return iso;
    }
}

function formatarDataCompleta(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

function valorAcaoCaso(c: CalculoSalvo): number {
    return Number(c.valor_total_acao) || Number(c.diferenca_total) || 0;
}

function lerModoSalvo(): ModoExibicao {
    try {
        const v = localStorage.getItem(VIEW_STORAGE_KEY);
        if (v === "tabela" || v === "agrupado" || v === "quadro") return v;
    } catch {
        /* ignore */
    }
    return "tabela";
}

function lerDensidadeQuadro(): DensidadeQuadro {
    try {
        const v = localStorage.getItem(QUADRO_DENSIDADE_KEY);
        if (v === "compacto") return "compacto";
    } catch {
        /* ignore */
    }
    return "detalhado";
}

interface HistoricoCalculosProps {
    calculos: CalculoSalvo[];
    categorias: Categoria[];
    calculoAtivoId: string | null;
    carregando: boolean;
    onRecarregar: () => void;
    onAbrir: (c: CalculoSalvo) => void;
    onDuplicar: (c: CalculoSalvo) => void;
    onAtualizado: (c: CalculoSalvo) => void;
    onExcluido: (id: string) => void;
    onGerenciarCategorias: () => void;
}

const ORDENACOES_VALIDAS = new Set<CampoOrdenacao>(["recentes", "valor_desc", "abuso_desc", "nome_asc", "banco_asc"]);

export const HistoricoCalculos = ({
    calculos,
    categorias,
    calculoAtivoId,
    carregando,
    onRecarregar,
    onAbrir,
    onDuplicar,
    onAtualizado,
    onExcluido,
    onGerenciarCategorias,
}: HistoricoCalculosProps) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const topoListaRef = useRef<HTMLDivElement>(null);
    const quadroScrollRef = useRef<HTMLDivElement>(null);

    const modoParam = searchParams.get("modo");
    const modo: ModoExibicao =
        modoParam === "tabela" || modoParam === "agrupado" || modoParam === "quadro" ? modoParam : lerModoSalvo();

    const ordParam = searchParams.get("ord") as CampoOrdenacao | null;
    const ordenacao: CampoOrdenacao = ordParam && ORDENACOES_VALIDAS.has(ordParam) ? ordParam : "recentes";

    const filtroCategoria = searchParams.get("cat") || "todas";
    const grauParam = searchParams.get("grau");
    const filtroNivel: "todos" | Nivel =
        grauParam === "abuso" || grauParam === "acima" || grauParam === "media" ? grauParam : "todos";
    const filtroBanco = searchParams.get("banco") || "todos";
    const pagina = Math.max(1, parseInt(searchParams.get("p") || "1", 10) || 1);
    const ppRaw = parseInt(searchParams.get("pp") || "10", 10);
    const itensPorPagina = ppRaw === 20 || ppRaw === 50 ? ppRaw : 10;

    const queryUrl = searchParams.get("q") ?? "";
    const [busca, setBusca] = useState(queryUrl);

    useEffect(() => {
        setBusca(queryUrl);
    }, [queryUrl]);

    const [expandidoId, setExpandidoId] = useState<string | null>(null);
    const [confirmarExclusaoId, setConfirmarExclusaoId] = useState<string | null>(null);
    const [operandoId, setOperandoId] = useState<string | null>(null);
    const [baixandoPdfId, setBaixandoPdfId] = useState<string | null>(null);
    const [gruposFechados, setGruposFechados] = useState<Record<string, boolean>>({});

    // Controles específicos do Quadro Kanban
    const [densidadeQuadro, setDensidadeQuadro] = useState<DensidadeQuadro>(lerDensidadeQuadro);
    const [ocultarColunasVazias, setOcultarColunasVazias] = useState(false);
    const [colunasRecolhidas, setColunasRecolhidas] = useState<Record<string, boolean>>({});
    const [arrastandoId, setArrastandoId] = useState<string | null>(null);
    const [colunaAlvoDrag, setColunaAlvoDrag] = useState<string | null>(null);
    const [cartaoExpandidoId, setCartaoExpandidoId] = useState<string | null>(null);

    const atualizarUrl = (mutacoes: Record<string, string | null>, replace = false) => {
        const next = new URLSearchParams(searchParams);
        for (const [k, v] of Object.entries(mutacoes)) {
            if (
                v === null ||
                v === "" ||
                (k === "p" && v === "1") ||
                (k === "pp" && v === "10") ||
                (k === "cat" && v === "todas") ||
                (k === "grau" && v === "todos") ||
                (k === "banco" && v === "todos") ||
                (k === "ord" && v === "recentes")
            ) {
                next.delete(k);
            } else {
                next.set(k, v);
            }
        }
        setSearchParams(next, { replace });
    };

    const alterarModo = (novo: ModoExibicao) => {
        try {
            localStorage.setItem(VIEW_STORAGE_KEY, novo);
        } catch {
            /* ignore */
        }
        atualizarUrl({ modo: novo === "tabela" ? null : novo, p: null }, false);
    };

    const alterarDensidadeQuadro = (nova: DensidadeQuadro) => {
        setDensidadeQuadro(nova);
        try {
            localStorage.setItem(QUADRO_DENSIDADE_KEY, nova);
        } catch {
            /* ignore */
        }
    };

    const rolarQuadro = (direcao: "esq" | "dir") => {
        const el = quadroScrollRef.current;
        if (!el) return;
        const passo = Math.max(320, Math.round(el.clientWidth * 0.65));
        el.scrollBy({
            left: direcao === "dir" ? passo : -passo,
            behavior: "smooth",
        });
    };

    const alternarColunaRecolhida = (id: string) => {
        setColunasRecolhidas((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const irParaPagina = (novaPag: number) => {
        atualizarUrl({ p: String(novaPag) }, false);
        requestAnimationFrame(() => {
            topoListaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    };

    const mapaCategorias = useMemo(
        () => Object.fromEntries(categorias.map((c) => [c.id, c])),
        [categorias],
    );

    const bancosDisponiveis = useMemo(() => {
        const set = new Set<string>();
        for (const c of calculos) {
            if (c.banco?.trim()) set.add(normalizarRotuloBanco(c.banco));
        }
        return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
    }, [calculos]);

    const contagensCat = useMemo(() => {
        const counts: Record<string, number> = { sem: 0 };
        for (const c of calculos) {
            if (!c.categoria_id || !mapaCategorias[c.categoria_id]) {
                counts.sem += 1;
            } else {
                counts[c.categoria_id] = (counts[c.categoria_id] ?? 0) + 1;
            }
        }
        return counts;
    }, [calculos, mapaCategorias]);

    const filtradosOrdenados = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        const base = calculos.filter((c) => {
            if (modo === "tabela") {
                if (filtroCategoria === "sem") {
                    if (c.categoria_id && mapaCategorias[c.categoria_id]) return false;
                } else if (filtroCategoria !== "todas" && c.categoria_id !== filtroCategoria) {
                    return false;
                }
            }

            if (filtroNivel !== "todos" && c.nivel !== filtroNivel) {
                return false;
            }

            if (filtroBanco !== "todos") {
                const rotBanco = c.banco?.trim() ? normalizarRotuloBanco(c.banco) : "";
                if (rotBanco !== filtroBanco) return false;
            }

            if (!termo) return true;
            const alvo = [
                c.cliente_nome,
                c.processo_global,
                c.banco,
                normalizarRotuloBanco(c.banco || ""),
                c.documento_contrato,
                c.modalidade_nome,
                c.observacoes,
            ]
                .join(" ")
                .toLowerCase();
            return alvo.includes(termo);
        });

        const copia = [...base];
        copia.sort((a, b) => {
            if (ordenacao === "valor_desc") return valorAcaoCaso(b) - valorAcaoCaso(a);
            if (ordenacao === "abuso_desc") return (Number(b.razao_am) || 0) - (Number(a.razao_am) || 0);
            if (ordenacao === "nome_asc") return a.cliente_nome.localeCompare(b.cliente_nome, "pt-BR");
            if (ordenacao === "banco_asc") {
                return normalizarRotuloBanco(a.banco || "").localeCompare(
                    normalizarRotuloBanco(b.banco || ""),
                    "pt-BR",
                );
            }
            return b.updated_at.localeCompare(a.updated_at);
        });
        return copia;
    }, [busca, calculos, filtroBanco, filtroCategoria, filtroNivel, mapaCategorias, modo, ordenacao]);

    const resumoLista = useMemo(() => {
        let abusos = 0;
        let regulares = 0;
        let somaValores = 0;
        for (const c of filtradosOrdenados) {
            if (c.nivel === "abuso") abusos += 1;
            if (c.nivel === "media") regulares += 1;
            somaValores += valorAcaoCaso(c);
        }
        return { abusos, regulares, somaValores };
    }, [filtradosOrdenados]);

    const totalPaginas = Math.max(1, Math.ceil(filtradosOrdenados.length / itensPorPagina));
    const paginaSegura = Math.min(pagina, totalPaginas);
    const indiceInicio = (paginaSegura - 1) * itensPorPagina;
    const indiceFim = Math.min(filtradosOrdenados.length, indiceInicio + itensPorPagina);
    const itensPaginados = useMemo(
        () => filtradosOrdenados.slice(indiceInicio, indiceFim),
        [filtradosOrdenados, indiceFim, indiceInicio],
    );

    const gruposPorCategoria = useMemo(() => {
        const grupos: Array<{
            id: string;
            nome: string;
            cor: string;
            itens: CalculoSalvo[];
            soma: number;
            abusos: number;
            percentualVolume: number;
        }> = categorias.map((cat) => ({
            id: cat.id,
            nome: cat.nome,
            cor: cat.cor,
            itens: [],
            soma: 0,
            abusos: 0,
            percentualVolume: 0,
        }));
        const mapG = new Map(grupos.map((g) => [g.id, g]));
        const semGrupo = {
            id: "sem",
            nome: "Sem categoria",
            cor: "slate",
            itens: [] as CalculoSalvo[],
            soma: 0,
            abusos: 0,
            percentualVolume: 0,
        };

        for (const c of filtradosOrdenados) {
            const g = c.categoria_id && mapG.has(c.categoria_id) ? mapG.get(c.categoria_id)! : semGrupo;
            g.itens.push(c);
            g.soma += valorAcaoCaso(c);
            if (c.nivel === "abuso") g.abusos += 1;
        }
        if (semGrupo.itens.length > 0) grupos.push(semGrupo);

        const totalVolume = resumoLista.somaValores;
        if (totalVolume > 0) {
            for (const g of grupos) {
                g.percentualVolume = (g.soma / totalVolume) * 100;
            }
        }
        return grupos;
    }, [categorias, filtradosOrdenados, resumoLista.somaValores]);

    const qtdColunasVazias = useMemo(
        () => gruposPorCategoria.filter((g) => g.itens.length === 0).length,
        [gruposPorCategoria],
    );

    const colunasQuadro = useMemo(
        () => (ocultarColunasVazias ? gruposPorCategoria.filter((g) => g.itens.length > 0) : gruposPorCategoria),
        [gruposPorCategoria, ocultarColunasVazias],
    );

    const lidarSoltarNaColuna = (e: DragEvent<HTMLElement>, destinoId: string) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain") || arrastandoId;
        setColunaAlvoDrag(null);
        setArrastandoId(null);
        if (!id) return;
        const caso = filtradosOrdenados.find((x) => x.id === id) ?? calculos.find((x) => x.id === id);
        if (!caso) return;
        const catAtual = caso.categoria_id && mapaCategorias[caso.categoria_id] ? caso.categoria_id : "sem";
        if (catAtual === destinoId) return;
        void trocarCategoriaItem(caso, destinoId === "sem" ? "" : destinoId);
    };

    const trocarCategoriaItem = async (c: CalculoSalvo, novaCatId: string) => {
        setOperandoId(c.id);
        try {
            const atualizado = await atualizarCalculo(c.id, {
                categoria_id: novaCatId || null,
            });
            onAtualizado(atualizado);
            toast.success("Fase/categoria atualizada.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao mover categoria.");
        } finally {
            setOperandoId(null);
        }
    };

    const removerCalculo = async (c: CalculoSalvo) => {
        setOperandoId(c.id);
        try {
            await excluirCalculo(c.id);
            onExcluido(c.id);
            setConfirmarExclusaoId(null);
            toast.success(`Cálculo de "${c.cliente_nome}" removido.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao excluir cálculo.");
        } finally {
            setOperandoId(null);
        }
    };

    const baixarPdfDireto = async (c: CalculoSalvo) => {
        setBaixandoPdfId(c.id);
        try {
            const { ficha, processo } = calculoParaProcesso(c);
            const { onlineByContrato, seriesEconomicas } = await prepararDadosBacenProcesso(processo);
            const resultado = calcularProcessoRevisional(processo, seriesEconomicas, onlineByContrato);
            const cat = c.categoria_id ? mapaCategorias[c.categoria_id] : null;
            const ok = baixarLaudoPdf(resultado, {
                clienteNome: ficha.clienteNome || c.cliente_nome,
                processoGlobal: ficha.processoGlobal,
                categoriaNome: cat?.nome,
                observacoes: ficha.observacoes,
                incluirGraficos: true,
            });
            if (ok) toast.success(`Laudo PDF de "${c.cliente_nome}" baixado.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível gerar o PDF.");
        } finally {
            setBaixandoPdfId(null);
        }
    };

    const temFiltrosAtivos =
        busca.trim() !== "" ||
        filtroNivel !== "todos" ||
        filtroBanco !== "todos" ||
        (modo === "tabela" && filtroCategoria !== "todas");

    const limparFiltros = () => {
        setBusca("");
        atualizarUrl({ q: null, cat: null, grau: null, banco: null, p: null }, false);
    };

    const alternarOrdenacao = (alvo: CampoOrdenacao) => {
        atualizarUrl({ ord: ordenacao === alvo ? "recentes" : alvo, p: null }, true);
    };

    const renderTabelaLinhas = (itens: CalculoSalvo[], ocultarColunaCategoria = false) => (
        <div className="overflow-x-auto overscroll-x-contain border border-ink/25 bg-card">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm tabular-nums">
                <thead className="border-b border-ink/25 bg-secondary/80 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                        <th className="py-2.5 pl-3.5 pr-2 font-semibold">
                            <button
                                type="button"
                                onClick={() => alternarOrdenacao("nome_asc")}
                                className="inline-flex items-center gap-1 hover:text-ink"
                            >
                                Cliente / Processo
                                <ArrowDownUp className="size-3 opacity-60" />
                            </button>
                        </th>
                        <th className="px-3 py-2.5 font-semibold">
                            <button
                                type="button"
                                onClick={() => alternarOrdenacao("banco_asc")}
                                className="inline-flex items-center gap-1 hover:text-ink"
                            >
                                Banco / Contrato
                                <ArrowDownUp className="size-3 opacity-60" />
                            </button>
                        </th>
                        {!ocultarColunaCategoria && <th className="px-3 py-2.5 font-semibold">Fase / Categoria</th>}
                        <th className="px-3 py-2.5 font-semibold">
                            <button
                                type="button"
                                onClick={() => alternarOrdenacao("abuso_desc")}
                                className="inline-flex items-center gap-1 hover:text-ink"
                            >
                                Taxas / Grau
                                <ArrowDownUp className="size-3 opacity-60" />
                            </button>
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold">
                            <button
                                type="button"
                                onClick={() => alternarOrdenacao("valor_desc")}
                                className="ml-auto inline-flex items-center gap-1 hover:text-ink"
                            >
                                Proveito da Ação
                                <ArrowDownUp className="size-3 opacity-60" />
                            </button>
                        </th>
                        <th className="py-2.5 pl-3 pr-4 text-right font-semibold">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-ink/12">
                    {itens.map((c) => {
                        const ativo = calculoAtivoId === c.id;
                        const expandido = expandidoId === c.id;
                        const confirmando = confirmarExclusaoId === c.id;
                        const bancoRotulo = c.banco?.trim() ? normalizarRotuloBanco(c.banco) : "Não informado";
                        const valAcao = valorAcaoCaso(c);

                        return (
                            <Fragment key={c.id}>
                                <tr
                                    className={cn(
                                        "transition-colors hover:bg-ink/[0.025]",
                                        BORDA_NIVEL[c.nivel],
                                        ativo && "bg-gold-light/20",
                                    )}
                                >
                                    {/* Coluna 1: Cliente + Processo */}
                                    <td className="py-3 pl-3 pr-2 align-middle">
                                        <div className="flex items-start gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setExpandidoId(expandido ? null : c.id)}
                                                aria-label={expandido ? "Recolher detalhes" : "Ver detalhes do caso"}
                                                title="Ver resumo completo e observações"
                                                className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center text-ink/50 hover:text-ink"
                                            >
                                                {expandido ? (
                                                    <ChevronDown className="size-3.5" />
                                                ) : (
                                                    <ChevronRight className="size-3.5" />
                                                )}
                                            </button>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => onAbrir(c)}
                                                        className="truncate font-semibold text-ink hover:underline text-left"
                                                    >
                                                        {c.cliente_nome}
                                                    </button>
                                                    {c.qtd_contratos > 1 && (
                                                        <span className="bg-ink/10 px-1.5 py-0.2 text-[10px] font-bold text-ink">
                                                            {c.qtd_contratos} contr.
                                                        </span>
                                                    )}
                                                    {c.observacoes?.trim() && (
                                                        <FileText
                                                            aria-label="Possui observações"
                                                            className="size-3.5 shrink-0 text-gold-deep"
                                                        />
                                                    )}
                                                    {ativo && (
                                                        <span className="bg-gold-light px-1.5 py-0.2 text-[10px] font-bold text-ink">
                                                            Aberto
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {c.processo_global ? (
                                                        <span className="font-medium text-ink/80">
                                                            {c.processo_global}
                                                        </span>
                                                    ) : (
                                                        <span>Pré-ajuizamento</span>
                                                    )}
                                                    {" · "}
                                                    <span>{formatarDataCurta(c.updated_at)}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Coluna 2: Banco + Modalidade */}
                                    <td className="px-3 py-3 align-middle">
                                        <p className="font-semibold text-ink">{bancoRotulo}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {c.modalidade_nome} ({c.pessoa.toUpperCase()}) · {mNome(c.mes_contrato)} ·{" "}
                                            {c.pagas}/{c.parcelas} pagas
                                        </p>
                                    </td>

                                    {/* Coluna 3: Seletor rápido de Categoria */}
                                    {!ocultarColunaCategoria && (
                                        <td className="px-3 py-3 align-middle">
                                            <select
                                                value={c.categoria_id ?? ""}
                                                disabled={operandoId === c.id}
                                                onChange={(e) => trocarCategoriaItem(c, e.target.value)}
                                                aria-label={`Categoria de ${c.cliente_nome}`}
                                                className="h-8 w-[10.5rem] border border-ink/25 bg-background px-2 text-xs font-semibold text-ink focus:border-ink focus:outline-none"
                                            >
                                                <option value="">Sem categoria</option>
                                                {categorias.map((catOpt) => (
                                                    <option key={catOpt.id} value={catOpt.id}>
                                                        {catOpt.nome}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    )}

                                    {/* Coluna 4: Taxa / Nível de Abuso */}
                                    <td className="px-3 py-3 align-middle">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className={cn(
                                                    "inline-block whitespace-nowrap px-2 py-0.5 text-[11px] font-bold",
                                                    COR_NIVEL[c.nivel],
                                                )}
                                            >
                                                {num(c.razao_am, 2)}x · {rotuloCurtoCaso(c)}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                                            {num(c.contrato_am)}% vs {num(c.media_am)}% a.m.
                                        </p>
                                    </td>

                                    {/* Coluna 5: Valor da Ação */}
                                    <td className="px-3 py-3 text-right align-middle">
                                        <p className="font-bold text-ink">{brl(valAcao)}</p>
                                        <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                                            {c.pago_a_mais > 0
                                                ? `Já pago: ${brl(c.pago_a_mais)}`
                                                : valAcao === 0
                                                  ? "Taxa regular"
                                                  : `Financ.: ${brl(c.valor_financiado)}`}
                                        </p>
                                    </td>

                                    {/* Coluna 6: Ações alinhadas e fixas */}
                                    <td className="py-3 pl-3 pr-4 text-right align-middle">
                                        {confirmando ? (
                                            <div className="inline-flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    disabled={operandoId === c.id}
                                                    onClick={() => removerCalculo(c)}
                                                    className="inline-flex h-8 items-center whitespace-nowrap bg-destructive px-2.5 text-xs font-semibold text-destructive-foreground"
                                                >
                                                    Confirmar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmarExclusaoId(null)}
                                                    className="inline-flex h-8 items-center border border-ink/30 px-2 text-xs font-semibold text-ink"
                                                >
                                                    Não
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => onAbrir(c)}
                                                    className="inline-flex h-8 items-center gap-1 whitespace-nowrap bg-ink px-3 text-xs font-semibold text-paper hover:bg-ink-soft"
                                                >
                                                    <FolderOpen className="size-3.5" />
                                                    Abrir
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={baixandoPdfId === c.id}
                                                    onClick={() => baixarPdfDireto(c)}
                                                    title="Baixar Laudo PDF diretamente"
                                                    aria-label={`Baixar Laudo PDF de ${c.cliente_nome}`}
                                                    className="inline-flex size-8 items-center justify-center border border-gold bg-gold-light/50 text-ink hover:bg-gold-light disabled:opacity-60"
                                                >
                                                    {baixandoPdfId === c.id ? (
                                                        <Loader2 className="size-3.5 animate-spin" />
                                                    ) : (
                                                        <FileDown className="size-3.5" />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDuplicar(c)}
                                                    title="Duplicar caso"
                                                    aria-label={`Duplicar cálculo de ${c.cliente_nome}`}
                                                    className="inline-flex size-8 items-center justify-center border border-ink/25 text-ink/75 hover:bg-ink/5 hover:text-ink"
                                                >
                                                    <CopyPlus className="size-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmarExclusaoId(c.id)}
                                                    title="Excluir cálculo"
                                                    aria-label={`Excluir cálculo de ${c.cliente_nome}`}
                                                    className="inline-flex size-8 items-center justify-center border border-ink/25 text-ink/60 hover:border-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>

                                {/* Gaveta expansível sob demanda: ficha detalhada e observações */}
                                {expandido && (
                                    <tr className="bg-background/70">
                                        <td colSpan={ocultarColunaCategoria ? 5 : 6} className="px-6 py-4">
                                            <div className="grid gap-4 text-xs sm:grid-cols-4">
                                                <div>
                                                    <span className="text-muted-foreground">Financiado / Parcelas</span>
                                                    <p className="mt-0.5 font-semibold text-ink">
                                                        {brl(c.valor_financiado)} ({c.parcelas}x de{" "}
                                                        {brl(c.valor_parcela)})
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Nº do Contrato / Banco</span>
                                                    <p className="mt-0.5 font-semibold text-ink">
                                                        {c.documento_contrato || "—"} · {c.banco || "Não informado"}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">
                                                        Saldo Recalculado / Tarifas
                                                    </span>
                                                    <p className="mt-0.5 font-semibold text-ink">
                                                        {brl(c.saldo_recalculado)}
                                                        {c.total_tarifas > 0
                                                            ? ` · Tarifas: ${brl(c.total_tarifas)}`
                                                            : ""}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Registro</span>
                                                    <p className="mt-0.5 font-medium text-ink">
                                                        {formatarDataCompleta(c.updated_at)}
                                                        {c.created_by_email ? ` · ${c.created_by_email}` : ""}
                                                    </p>
                                                </div>
                                            </div>
                                            {c.observacoes && (
                                                <p className="mt-3 border-l-2 border-gold bg-card px-3.5 py-2 font-serif text-xs leading-relaxed text-ink">
                                                    {c.observacoes}
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <div ref={topoListaRef} className="scroll-mt-6 space-y-5">
            {/* Cabeçalho enxuto + Barra de controle unificada */}
            <div className="sheet-on-paper p-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/15 pb-4">
                    <div>
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                            <h1 className="subdisplay text-2xl text-ink">Pauta de clientes salvos</h1>
                            <p className="text-xs font-medium tabular-nums text-muted-foreground">
                                <strong className="text-ink">{filtradosOrdenados.length}</strong>{" "}
                                {filtradosOrdenados.length === 1 ? "caso" : "casos"} ·{" "}
                                <strong className="text-destructive">{resumoLista.abusos}</strong> com abuso ·{" "}
                                <strong className="text-[#126A35]">{resumoLista.regulares}</strong> juros bons/na média ·
                                Soma: <strong className="text-ink">{brl(resumoLista.somaValores)}</strong>
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Alternador de modo de organização */}
                        <div
                            role="group"
                            aria-label="Modo de organização da lista"
                            className="inline-flex border border-ink/30 bg-background"
                        >
                            <button
                                type="button"
                                onClick={() => alterarModo("tabela")}
                                className={cn(
                                    "inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold transition-colors",
                                    modo === "tabela" ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                                )}
                            >
                                <List className="size-3.5" />
                                Tabela
                            </button>
                            <button
                                type="button"
                                onClick={() => alterarModo("agrupado")}
                                className={cn(
                                    "inline-flex h-9 items-center gap-1.5 border-l border-ink/25 px-3 text-xs font-semibold transition-colors",
                                    modo === "agrupado" ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                                )}
                            >
                                <FolderKanban className="size-3.5" />
                                Por Fase
                            </button>
                            <button
                                type="button"
                                onClick={() => alterarModo("quadro")}
                                className={cn(
                                    "inline-flex h-9 items-center gap-1.5 border-l border-ink/25 px-3 text-xs font-semibold transition-colors",
                                    modo === "quadro" ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                                )}
                            >
                                <Columns3 className="size-3.5" />
                                Quadro
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={onGerenciarCategorias}
                            className="inline-flex h-9 items-center border border-ink/30 px-3 text-xs font-semibold text-ink hover:bg-ink/5"
                        >
                            Categorias
                        </button>
                        <button
                            type="button"
                            onClick={onRecarregar}
                            disabled={carregando}
                            aria-label="Atualizar histórico"
                            className="inline-flex size-9 items-center justify-center border border-ink/30 text-ink hover:bg-ink/5 disabled:opacity-50"
                        >
                            <RefreshCw className={cn("size-3.5", carregando && "animate-spin")} />
                        </button>
                    </div>
                </div>

                {/* Filtros e Ordenação em linha única */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11.5rem_11rem_11.5rem]">
                    <div className="relative sm:col-span-2 lg:col-span-1">
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-ink/50"
                        />
                        <input
                            type="search"
                            value={busca}
                            onChange={(e) => {
                                const val = e.target.value;
                                setBusca(val);
                                atualizarUrl({ q: val.trim() ? val : null, p: null }, true);
                            }}
                            placeholder="Buscar cliente, processo CNJ, banco ou contrato..."
                            aria-label="Buscar no histórico"
                            className="field py-2 pl-6 pr-7 text-sm [&::-webkit-search-cancel-button]:hidden"
                        />
                        {busca && (
                            <button
                                type="button"
                                onClick={() => {
                                    setBusca("");
                                    atualizarUrl({ q: null, p: null }, true);
                                }}
                                aria-label="Limpar busca"
                                className="absolute right-0 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-ink/50 hover:text-ink"
                            >
                                <X className="size-3.5" />
                            </button>
                        )}
                    </div>

                    <select
                        value={filtroBanco}
                        onChange={(e) => atualizarUrl({ banco: e.target.value, p: null }, true)}
                        aria-label="Filtrar por instituição bancária"
                        className="field cursor-pointer py-2 text-xs font-medium [&>option]:text-ink"
                    >
                        <option value="todos">Todos os bancos ({bancosDisponiveis.length})</option>
                        {bancosDisponiveis.map((b) => (
                            <option key={b} value={b}>
                                {b}
                            </option>
                        ))}
                    </select>

                    <select
                        value={filtroNivel}
                        onChange={(e) => atualizarUrl({ grau: e.target.value, p: null }, true)}
                        aria-label="Filtrar por grau de abuso"
                        className="field cursor-pointer py-2 text-xs font-medium [&>option]:text-ink"
                    >
                        <option value="todos">Todos os graus</option>
                        <option value="abuso">Indício de abuso (≥ 1,5x)</option>
                        <option value="acima">Acima da média</option>
                        <option value="media">Juros bons / Na média (≤ 1,1x)</option>
                    </select>

                    <select
                        value={ordenacao}
                        onChange={(e) => atualizarUrl({ ord: e.target.value, p: null }, true)}
                        aria-label="Ordenar lista por"
                        className="field cursor-pointer py-2 text-xs font-semibold [&>option]:text-ink"
                    >
                        <option value="recentes">Ordenar: Mais recentes</option>
                        <option value="valor_desc">Ordenar: Maior valor (R$)</option>
                        <option value="abuso_desc">Ordenar: Maior abuso (x)</option>
                        <option value="nome_asc">Ordenar: Cliente (A–Z)</option>
                        <option value="banco_asc">Ordenar: Banco (A–Z)</option>
                    </select>
                </div>

                {/* Abas rápidas de categorias (visíveis no modo Tabela) */}
                {modo === "tabela" && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={() => atualizarUrl({ cat: "todas", p: null }, false)}
                                className={cn(
                                    "inline-flex h-7 items-center border px-2.5 text-xs font-semibold transition-colors",
                                    filtroCategoria === "todas"
                                        ? "border-ink bg-ink text-paper"
                                        : "border-ink/20 text-ink hover:bg-ink/5",
                                )}
                            >
                                Todas ({calculos.length})
                            </button>
                            {categorias.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => atualizarUrl({ cat: cat.id, p: null }, false)}
                                    className={cn(
                                        "inline-flex h-7 items-center gap-1.5 border px-2.5 text-xs font-semibold transition-colors",
                                        filtroCategoria === cat.id
                                            ? "border-ink bg-ink text-paper"
                                            : "border-ink/20 text-ink hover:bg-ink/5",
                                    )}
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "inline-block size-2",
                                            COR_PONTO_CAT[cat.cor] ?? "bg-ink",
                                        )}
                                    />
                                    {cat.nome} ({contagensCat[cat.id] ?? 0})
                                </button>
                            ))}
                            {contagensCat.sem > 0 && (
                                <button
                                    type="button"
                                    onClick={() => atualizarUrl({ cat: "sem", p: null }, false)}
                                    className={cn(
                                        "inline-flex h-7 items-center border px-2.5 text-xs font-semibold transition-colors",
                                        filtroCategoria === "sem"
                                            ? "border-ink bg-ink text-paper"
                                            : "border-ink/20 text-muted-foreground hover:bg-ink/5",
                                    )}
                                >
                                    Sem categoria ({contagensCat.sem})
                                </button>
                            )}
                        </div>

                        {temFiltrosAtivos && (
                            <button
                                type="button"
                                onClick={limparFiltros}
                                className="text-xs font-semibold text-gold-deep underline underline-offset-4 hover:text-ink"
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Estado vazio */}
            {filtradosOrdenados.length === 0 ? (
                <div className="border border-ink/25 bg-card p-10 text-center">
                    <p className="subdisplay text-xl text-ink">
                        {calculos.length === 0
                            ? "Nenhum cálculo salvo ainda."
                            : "Nenhum cliente encontrado para este filtro."}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {calculos.length === 0
                            ? "Calcule um contrato na aba principal, informe o nome do cliente e clique em Salvar no histórico."
                            : "Ajuste a busca ou limpe os filtros selecionados."}
                    </p>
                    {temFiltrosAtivos && (
                        <button
                            type="button"
                            onClick={limparFiltros}
                            className="mt-4 inline-flex h-9 items-center border border-ink/35 px-4 text-xs font-semibold text-ink hover:bg-ink/5"
                        >
                            Mostrar todos os clientes
                        </button>
                    )}
                </div>
            ) : modo === "tabela" ? (
                <div className="space-y-3">
                    {renderTabelaLinhas(itensPaginados, false)}

                    {/* Barra de paginação e tamanho de página */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border border-ink/25 bg-card px-4 py-3 text-xs tabular-nums">
                        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                            <span>
                                Mostrando <strong className="text-ink">{indiceInicio + 1}</strong>–
                                <strong className="text-ink">{indiceFim}</strong> de{" "}
                                <strong className="text-ink">{filtradosOrdenados.length}</strong> clientes
                            </span>
                            <label className="inline-flex items-center gap-1.5">
                                <span>Por página:</span>
                                <select
                                    value={itensPorPagina}
                                    onChange={(e) => atualizarUrl({ pp: e.target.value, p: null }, true)}
                                    aria-label="Quantidade de clientes por página"
                                    className="h-7 border border-ink/25 bg-background px-2 font-semibold text-ink"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                            </label>
                        </div>

                        {totalPaginas > 1 && (
                            <nav aria-label="Paginação de clientes" className="inline-flex items-center gap-1">
                                <button
                                    type="button"
                                    disabled={paginaSegura <= 1}
                                    onClick={() => irParaPagina(Math.max(1, paginaSegura - 1))}
                                    className="inline-flex h-8 items-center gap-1 border border-ink/25 px-2.5 font-semibold text-ink hover:bg-ink/5 disabled:opacity-40"
                                >
                                    <ChevronLeft className="size-3.5" />
                                    Anterior
                                </button>

                                {Array.from({ length: totalPaginas }, (_, idx) => idx + 1).map((numPag) => (
                                    <button
                                        key={numPag}
                                        type="button"
                                        aria-current={numPag === paginaSegura ? "page" : undefined}
                                        onClick={() => irParaPagina(numPag)}
                                        className={cn(
                                            "inline-flex size-8 items-center justify-center border font-bold transition-colors",
                                            numPag === paginaSegura
                                                ? "border-ink bg-ink text-paper"
                                                : "border-ink/25 text-ink hover:bg-ink/5",
                                        )}
                                    >
                                        {numPag}
                                    </button>
                                ))}

                                <button
                                    type="button"
                                    disabled={paginaSegura >= totalPaginas}
                                    onClick={() => irParaPagina(Math.min(totalPaginas, paginaSegura + 1))}
                                    className="inline-flex h-8 items-center gap-1 border border-ink/25 px-2.5 font-semibold text-ink hover:bg-ink/5 disabled:opacity-40"
                                >
                                    Próxima
                                    <ChevronRight className="size-3.5" />
                                </button>
                            </nav>
                        )}
                    </div>
                </div>
            ) : modo === "agrupado" ? (
                <div className="space-y-4">
                    {gruposPorCategoria
                        .filter((g) => g.itens.length > 0)
                        .map((g) => {
                            const fechado = Boolean(gruposFechados[g.id]);
                            const catObj = mapaCategorias[g.id] ?? null;
                            return (
                                <section key={g.id} className="border border-ink/25 bg-card">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setGruposFechados((prev) => ({ ...prev, [g.id]: !prev[g.id] }))
                                        }
                                        className="flex w-full flex-wrap items-center justify-between gap-3 bg-secondary/50 px-4 py-3 text-left hover:bg-secondary/80"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            {fechado ? (
                                                <ChevronRight className="size-4 text-ink/70" />
                                            ) : (
                                                <ChevronDown className="size-4 text-ink/70" />
                                            )}
                                            {catObj ? (
                                                <SeloCategoria categoria={catObj} />
                                            ) : (
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                    {g.nome}
                                                </span>
                                            )}
                                            <span className="text-xs font-semibold text-muted-foreground">
                                                {g.itens.length} {g.itens.length === 1 ? "cliente" : "clientes"}
                                            </span>
                                        </div>
                                        <span className="text-sm font-bold tabular-nums text-ink">
                                            Subtotal: {brl(g.soma)}
                                        </span>
                                    </button>

                                    {!fechado && (
                                        <div className="border-t border-ink/20">
                                            {renderTabelaLinhas(g.itens, true)}
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                </div>
            ) : (
                /* Modo Quadro Kanban por Fase Processual */
                <div className="space-y-3">
                    {/* Barra de subcontrole e telemetria do quadro */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border border-ink/25 bg-card px-4 py-2.5">
                        <p className="text-xs text-muted-foreground">
                            {arrastandoId ? (
                                <span className="font-semibold text-gold-deep">
                                    Solte o processo na coluna da fase desejada para mover.
                                </span>
                            ) : (
                                "Arraste os processos entre as colunas ou altere a fase no próprio cartão."
                            )}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Densidade dos cartões */}
                            <div
                                role="group"
                                aria-label="Densidade dos cartões do quadro"
                                className="inline-flex border border-ink/25 bg-background"
                            >
                                <button
                                    type="button"
                                    aria-pressed={densidadeQuadro === "detalhado"}
                                    onClick={() => alterarDensidadeQuadro("detalhado")}
                                    className={cn(
                                        "inline-flex h-8 items-center gap-1.5 px-2.5 text-xs font-semibold transition-colors",
                                        densidadeQuadro === "detalhado"
                                            ? "bg-ink text-paper"
                                            : "text-ink hover:bg-ink/5",
                                    )}
                                >
                                    <Maximize2 className="size-3" />
                                    Detalhado
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={densidadeQuadro === "compacto"}
                                    onClick={() => alterarDensidadeQuadro("compacto")}
                                    className={cn(
                                        "inline-flex h-8 items-center gap-1.5 border-l border-ink/25 px-2.5 text-xs font-semibold transition-colors",
                                        densidadeQuadro === "compacto"
                                            ? "bg-ink text-paper"
                                            : "text-ink hover:bg-ink/5",
                                    )}
                                >
                                    <Minimize2 className="size-3" />
                                    Compacto
                                </button>
                            </div>

                            {/* Ocultar/mostrar colunas vazias */}
                            <button
                                type="button"
                                aria-pressed={ocultarColunasVazias}
                                disabled={!ocultarColunasVazias && qtdColunasVazias === 0}
                                onClick={() => setOcultarColunasVazias((v) => !v)}
                                className={cn(
                                    "inline-flex h-8 items-center gap-1.5 border px-2.5 text-xs font-semibold transition-colors disabled:opacity-45",
                                    ocultarColunasVazias
                                        ? "border-ink bg-ink text-paper"
                                        : "border-ink/25 text-ink hover:bg-ink/5",
                                )}
                            >
                                {ocultarColunasVazias ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                                {ocultarColunasVazias ? "Mostrar vazias" : "Ocultar vazias"}
                                {qtdColunasVazias > 0 && (
                                    <span className="tabular-nums opacity-80">({qtdColunasVazias})</span>
                                )}
                            </button>

                            {/* Rolagem horizontal rápida */}
                            <div className="inline-flex border border-ink/25 bg-background">
                                <button
                                    type="button"
                                    onClick={() => rolarQuadro("esq")}
                                    title="Rolar quadro para a esquerda"
                                    aria-label="Rolar quadro para a esquerda"
                                    className="inline-flex size-8 items-center justify-center text-ink hover:bg-ink/5"
                                >
                                    <ChevronLeft className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => rolarQuadro("dir")}
                                    title="Rolar quadro para a direita"
                                    aria-label="Rolar quadro para a direita"
                                    className="inline-flex size-8 items-center justify-center border-l border-ink/25 text-ink hover:bg-ink/5"
                                >
                                    <ChevronRight className="size-4" />
                                </button>
                            </div>

                            {/* Atalho para gerenciar/criar nova fase */}
                            <button
                                type="button"
                                onClick={onGerenciarCategorias}
                                className="inline-flex h-8 items-center gap-1 border border-gold bg-gold-light/40 px-2.5 text-xs font-semibold text-ink hover:bg-gold-light"
                            >
                                <Plus className="size-3.5" />
                                Nova fase
                            </button>
                        </div>
                    </div>

                    {/* Trilho horizontal de colunas de fase processual */}
                    <div
                        ref={quadroScrollRef}
                        className="flex items-stretch gap-4 overflow-x-auto overscroll-x-contain pb-4 scroll-smooth"
                    >
                        {colunasQuadro.map((g) => {
                            const recolhida = Boolean(colunasRecolhidas[g.id]);
                            const alvoAtivo = colunaAlvoDrag === g.id;
                            const corPonto = COR_PONTO_CAT[g.cor] ?? "bg-ink";
                            const bordaTopo = BORDA_TOPO_CAT[g.cor] ?? "border-t-[3px] border-t-ink";
                            const fundoCab = FUNDO_CAB_CAT[g.cor] ?? "bg-secondary/60";

                            const dragHandlers = {
                                onDragOver: (e: DragEvent<HTMLElement>) => {
                                    if (!arrastandoId) return;
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "move";
                                    if (colunaAlvoDrag !== g.id) setColunaAlvoDrag(g.id);
                                },
                                onDragLeave: (e: DragEvent<HTMLElement>) => {
                                    if (
                                        !e.currentTarget.contains(e.relatedTarget as Node | null) &&
                                        colunaAlvoDrag === g.id
                                    ) {
                                        setColunaAlvoDrag(null);
                                    }
                                },
                                onDrop: (e: DragEvent<HTMLElement>) => lidarSoltarNaColuna(e, g.id),
                            };

                            if (recolhida) {
                                return (
                                    <section
                                        key={g.id}
                                        {...dragHandlers}
                                        className={cn(
                                            "flex min-h-[22rem] w-12 shrink-0 flex-col items-center justify-between border border-ink/25 bg-card py-3 transition-colors",
                                            bordaTopo,
                                            alvoAtivo && "border-gold bg-gold-light/20 ring-2 ring-gold",
                                        )}
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => alternarColunaRecolhida(g.id)}
                                                title={`Expandir coluna ${g.nome}`}
                                                aria-label={`Expandir coluna ${g.nome}`}
                                                className="inline-flex size-7 items-center justify-center text-ink/60 hover:bg-ink/10 hover:text-ink"
                                            >
                                                <PanelLeftOpen className="size-4" />
                                            </button>
                                            <span className="bg-ink px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-paper">
                                                {g.itens.length}
                                            </span>
                                            <span aria-hidden className={cn("size-2", corPonto)} />
                                        </div>

                                        <h2 className="select-none py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink [writing-mode:vertical-rl] rotate-180">
                                            {g.nome}
                                        </h2>

                                        <div className="flex flex-col items-center gap-1">
                                            {g.abusos > 0 ? (
                                                <span
                                                    title={`${g.abusos} caso(s) com indício de abuso`}
                                                    className="bg-destructive px-1 py-0.5 text-[9px] font-bold tabular-nums text-destructive-foreground"
                                                >
                                                    {g.abusos}!
                                                </span>
                                            ) : (
                                                <span aria-hidden className="h-4" />
                                            )}
                                        </div>
                                    </section>
                                );
                            }

                            return (
                                <section
                                    key={g.id}
                                    {...dragHandlers}
                                    className={cn(
                                        "flex w-[21rem] max-w-[calc(100vw-2.5rem)] shrink-0 flex-col border border-ink/25 bg-secondary/40 transition-colors",
                                        alvoAtivo && "border-gold bg-gold-light/15 ring-2 ring-gold",
                                    )}
                                >
                                    {/* Cabeçalho fixo da coluna */}
                                    <header className={cn("sticky top-0 z-10 border-b border-ink/20 bg-card", bordaTopo)}>
                                        <div
                                            className={cn(
                                                "flex items-center justify-between gap-2 px-3.5 py-2.5",
                                                fundoCab,
                                            )}
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span aria-hidden className={cn("size-2.5 shrink-0", corPonto)} />
                                                <h2 className="rubric truncate text-ink" title={g.nome}>
                                                    {g.nome}
                                                </h2>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-1.5">
                                                {g.abusos > 0 && (
                                                    <span
                                                        title={`${g.abusos} ${g.abusos === 1 ? "caso com abuso" : "casos com abuso"}`}
                                                        className="border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-destructive"
                                                    >
                                                        {g.abusos} {g.abusos === 1 ? "abuso" : "abusos"}
                                                    </span>
                                                )}
                                                <span className="bg-ink px-2 py-0.5 text-[11px] font-bold tabular-nums text-paper">
                                                    {g.itens.length}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => alternarColunaRecolhida(g.id)}
                                                    title={`Recolher coluna ${g.nome}`}
                                                    aria-label={`Recolher coluna ${g.nome}`}
                                                    className="inline-flex size-6 items-center justify-center text-ink/55 hover:bg-ink/10 hover:text-ink"
                                                >
                                                    <PanelLeftClose className="size-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Faixa de telemetria financeira */}
                                        <div className="border-t border-ink/12 bg-card px-3.5 py-2 tabular-nums">
                                            <div className="flex items-baseline justify-between gap-2 text-[11px]">
                                                <span className="text-muted-foreground">
                                                    Proveito: <strong className="font-bold text-ink">{brl(g.soma)}</strong>
                                                </span>
                                                <span className="font-semibold text-ink/70">
                                                    {num(g.percentualVolume, 0)}%
                                                </span>
                                            </div>
                                            <div className="mt-1.5 h-1.5 w-full overflow-hidden bg-ink/10">
                                                <div
                                                    className={cn("h-full transition-all duration-300", corPonto)}
                                                    style={{
                                                        width: `${g.soma > 0 ? Math.max(4, Math.min(100, g.percentualVolume)) : 0}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </header>

                                    {/* Lista de fichas da coluna */}
                                    <div className="max-h-[72vh] flex-1 space-y-3 overflow-y-auto p-3">
                                        {g.itens.length === 0 ? (
                                            <div
                                                className={cn(
                                                    "flex min-h-[11rem] flex-col items-center justify-center border border-dashed px-4 py-8 text-center transition-colors",
                                                    alvoAtivo
                                                        ? "border-gold bg-gold-light/20 text-ink"
                                                        : "border-ink/20 bg-card/45 text-muted-foreground",
                                                )}
                                            >
                                                <p className="text-xs font-semibold text-ink/75">
                                                    Nenhum processo nesta fase
                                                </p>
                                                <p className="mt-1 text-[11px] leading-relaxed">
                                                    Solte um processo aqui para mover para{" "}
                                                    <strong className="text-ink">{g.nome}</strong>
                                                </p>
                                            </div>
                                        ) : (
                                            g.itens.map((c) => {
                                                const ativo = calculoAtivoId === c.id;
                                                const confirmando = confirmarExclusaoId === c.id;
                                                const cardExpandido = cartaoExpandidoId === c.id;
                                                const compacto = densidadeQuadro === "compacto";
                                                const valAcao = valorAcaoCaso(c);
                                                const bancoRot = c.banco?.trim()
                                                    ? normalizarRotuloBanco(c.banco)
                                                    : "Banco não informado";
                                                const pctPagas =
                                                    c.parcelas > 0
                                                        ? Math.min(100, Math.max(0, (c.pagas / c.parcelas) * 100))
                                                        : 0;

                                                return (
                                                    <article
                                                        key={c.id}
                                                        draggable={operandoId !== c.id}
                                                        onDragStart={(e) => {
                                                            e.dataTransfer.setData("text/plain", c.id);
                                                            e.dataTransfer.effectAllowed = "move";
                                                            setArrastandoId(c.id);
                                                        }}
                                                        onDragEnd={() => {
                                                            setArrastandoId(null);
                                                            setColunaAlvoDrag(null);
                                                        }}
                                                        className={cn(
                                                            "group relative border border-ink/20 bg-card shadow-[0_2px_8px_-2px_hsl(var(--ink-deep)/0.14)] transition-all hover:border-ink/45 hover:shadow-[0_6px_16px_-6px_hsl(var(--ink-deep)/0.22)]",
                                                            BORDA_NIVEL[c.nivel],
                                                            ativo && "border-gold bg-gold-light/15 ring-1 ring-gold",
                                                            arrastandoId === c.id && "opacity-45",
                                                            compacto ? "p-2.5" : "p-3.5",
                                                        )}
                                                    >
                                                        {/* 1. Topo do Cartão: Metadados e Grau de Abuso */}
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex min-w-0 items-center gap-1.5">
                                                                <GripVertical
                                                                    aria-hidden
                                                                    className="size-3.5 shrink-0 cursor-grab text-ink/35 group-hover:text-ink/70 active:cursor-grabbing"
                                                                />
                                                                {c.processo_global ? (
                                                                    <span
                                                                        title={`Processo nº ${c.processo_global}`}
                                                                        className="truncate bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink/85"
                                                                    >
                                                                        {c.processo_global}
                                                                    </span>
                                                                ) : (
                                                                    <span className="border border-ink/15 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                                        Pré-ajuizamento
                                                                    </span>
                                                                )}
                                                                {ativo && (
                                                                    <span className="bg-gold-light px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
                                                                        Aberto
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <span
                                                                className={cn(
                                                                    "shrink-0 whitespace-nowrap px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                                                                    COR_NIVEL[c.nivel],
                                                                )}
                                                            >
                                                                {num(c.razao_am, 2)}x · {rotuloCurtoCaso(c)}
                                                            </span>
                                                        </div>

                                                        {/* 2. Identificação do Cliente e Instituição */}
                                                        <div className="mt-2 flex items-start justify-between gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => onAbrir(c)}
                                                                className={cn(
                                                                    "text-left font-bold leading-snug text-ink transition-colors hover:text-gold-deep hover:underline",
                                                                    compacto ? "text-sm" : "text-[15px]",
                                                                )}
                                                            >
                                                                {c.cliente_nome}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setCartaoExpandidoId(cardExpandido ? null : c.id)
                                                                }
                                                                aria-expanded={cardExpandido}
                                                                aria-label={
                                                                    cardExpandido
                                                                        ? `Recolher detalhes de ${c.cliente_nome}`
                                                                        : `Ver detalhes de ${c.cliente_nome}`
                                                                }
                                                                title={
                                                                    cardExpandido
                                                                        ? "Recolher ficha resumida"
                                                                        : "Ver ficha resumida e observações"
                                                                }
                                                                className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center text-ink/45 hover:bg-ink/5 hover:text-ink"
                                                            >
                                                                {cardExpandido ? (
                                                                    <ChevronDown className="size-3.5" />
                                                                ) : (
                                                                    <ChevronRight className="size-3.5" />
                                                                )}
                                                            </button>
                                                        </div>

                                                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                                                            <span className="font-semibold text-ink/85">{bancoRot}</span>
                                                            <span aria-hidden>·</span>
                                                            <span className="truncate">{c.modalidade_nome}</span>
                                                            <span className="border border-ink/15 px-1 py-px text-[10px] font-semibold uppercase text-ink/75">
                                                                {c.pessoa}
                                                            </span>
                                                            {c.qtd_contratos > 1 && (
                                                                <span className="bg-ink/10 px-1.5 py-px text-[10px] font-bold text-ink">
                                                                    {c.qtd_contratos} contr.
                                                                </span>
                                                            )}
                                                            {c.total_tarifas > 0 && (
                                                                <span className="bg-gold-light/50 px-1.5 py-px text-[10px] font-semibold text-ink">
                                                                    + Tarifas
                                                                </span>
                                                            )}
                                                            {compacto && c.observacoes?.trim() && (
                                                                <FileText
                                                                    aria-label="Possui observações"
                                                                    className="size-3 text-gold-deep"
                                                                />
                                                            )}
                                                        </div>

                                                        {/* 3. Bloco Técnico-Financeiro (modo detalhado) */}
                                                        {!compacto && (
                                                            <div className="mt-2.5 grid grid-cols-2 gap-2 border border-ink/12 bg-secondary/45 px-2.5 py-2 text-[11px] tabular-nums">
                                                                <div>
                                                                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                                                                        Taxa vs. média
                                                                    </span>
                                                                    <p className="mt-0.5 font-semibold text-ink">
                                                                        {num(c.contrato_am)}%{" "}
                                                                        <span className="font-normal text-muted-foreground">
                                                                            vs {num(c.media_am)}%
                                                                        </span>
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-baseline justify-between gap-1">
                                                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                                                            Parcelas
                                                                        </span>
                                                                        <span className="font-semibold text-ink">
                                                                            {c.pagas}/{c.parcelas}
                                                                        </span>
                                                                    </div>
                                                                    <div className="mt-1.5 h-1.5 w-full overflow-hidden bg-ink/12">
                                                                        <div
                                                                            className="h-full bg-ink/70"
                                                                            style={{ width: `${pctPagas.toFixed(0)}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* 4. Observações e Gaveta Rápida no Cartão */}
                                                        {!compacto && c.observacoes?.trim() && !cardExpandido && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setCartaoExpandidoId(c.id)}
                                                                aria-expanded={false}
                                                                title="Clique para expandir observações e detalhes do contrato"
                                                                className="mt-2.5 block w-full border-l-2 border-gold pl-2.5 text-left"
                                                            >
                                                                <p className="line-clamp-2 font-serif text-xs leading-relaxed text-ink/80">
                                                                    {c.observacoes}
                                                                </p>
                                                            </button>
                                                        )}

                                                        {cardExpandido && (
                                                            <div className="mt-2.5 space-y-2 border-t border-ink/15 pt-2.5 text-[11px] tabular-nums">
                                                                {c.observacoes?.trim() && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setCartaoExpandidoId(null)}
                                                                        aria-expanded
                                                                        className="block w-full border-l-2 border-gold bg-background/80 py-1.5 pl-2.5 pr-2 text-left"
                                                                    >
                                                                        <p className="font-serif text-xs leading-relaxed text-ink">
                                                                            {c.observacoes}
                                                                        </p>
                                                                    </button>
                                                                )}
                                                                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 bg-background/70 p-2">
                                                                    <div>
                                                                        <dt className="text-[10px] text-muted-foreground">
                                                                            Financiado
                                                                        </dt>
                                                                        <dd className="font-semibold text-ink">
                                                                            {brl(c.valor_financiado)}
                                                                        </dd>
                                                                    </div>
                                                                    <div>
                                                                        <dt className="text-[10px] text-muted-foreground">
                                                                            Parcela
                                                                        </dt>
                                                                        <dd className="font-semibold text-ink">
                                                                            {c.parcelas}x de {brl(c.valor_parcela)}
                                                                        </dd>
                                                                    </div>
                                                                    <div>
                                                                        <dt className="text-[10px] text-muted-foreground">
                                                                            Saldo recalculado
                                                                        </dt>
                                                                        <dd className="font-semibold text-ink">
                                                                            {brl(c.saldo_recalculado)}
                                                                        </dd>
                                                                    </div>
                                                                    <div>
                                                                        <dt className="text-[10px] text-muted-foreground">
                                                                            Atualizado em
                                                                        </dt>
                                                                        <dd className="font-medium text-ink">
                                                                            {formatarDataCompleta(c.updated_at)}
                                                                        </dd>
                                                                    </div>
                                                                </dl>
                                                            </div>
                                                        )}

                                                        {/* 5. Rodapé de Fase, Proveito Econômico e Ações Rápidas */}
                                                        <div className="mt-2.5">
                                                            <label htmlFor={`fase-card-${c.id}`} className="sr-only">
                                                                Alterar fase de {c.cliente_nome}
                                                            </label>
                                                            <select
                                                                id={`fase-card-${c.id}`}
                                                                value={c.categoria_id ?? ""}
                                                                disabled={operandoId === c.id}
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                                onChange={(e) => trocarCategoriaItem(c, e.target.value)}
                                                                className="h-7 w-full cursor-pointer border border-ink/20 bg-background/80 px-2 text-[11px] font-semibold text-ink/85 focus:border-ink focus:outline-none disabled:opacity-50"
                                                            >
                                                                <option value="">Sem categoria</option>
                                                                {categorias.map((catOpt) => (
                                                                    <option key={catOpt.id} value={catOpt.id}>
                                                                        Fase: {catOpt.nome}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="mt-2.5 border-t border-ink/12 pt-2.5 tabular-nums">
                                                            {confirmando ? (
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[11px] font-semibold text-destructive">
                                                                        Excluir cálculo?
                                                                    </span>
                                                                    <div className="inline-flex items-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            disabled={operandoId === c.id}
                                                                            onClick={() => removerCalculo(c)}
                                                                            className="inline-flex h-7 items-center bg-destructive px-2.5 text-[11px] font-semibold text-destructive-foreground disabled:opacity-60"
                                                                        >
                                                                            Confirmar
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setConfirmarExclusaoId(null)}
                                                                            className="inline-flex h-7 items-center border border-ink/30 px-2 text-[11px] font-semibold text-ink hover:bg-ink/5"
                                                                        >
                                                                            Não
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-end justify-between gap-2">
                                                                    <div className="min-w-0">
                                                                        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                                                                            Proveito da ação
                                                                        </span>
                                                                        <span className="block truncate text-sm font-extrabold text-ink">
                                                                            {brl(valAcao)}
                                                                        </span>
                                                                        <span className="block truncate text-[10px] text-muted-foreground">
                                                                            {c.pago_a_mais > 0
                                                                                ? `Já pago: ${brl(c.pago_a_mais)}`
                                                                                : valAcao === 0
                                                                                  ? "Taxa regular"
                                                                                  : `Financ.: ${brl(c.valor_financiado)}`}
                                                                        </span>
                                                                    </div>

                                                                    <div className="inline-flex shrink-0 items-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            disabled={baixandoPdfId === c.id}
                                                                            onClick={() => baixarPdfDireto(c)}
                                                                            title="Baixar Laudo PDF diretamente"
                                                                            aria-label={`Baixar Laudo PDF de ${c.cliente_nome}`}
                                                                            className="inline-flex size-7 items-center justify-center border border-gold bg-gold-light/45 text-ink hover:bg-gold-light disabled:opacity-60"
                                                                        >
                                                                            {baixandoPdfId === c.id ? (
                                                                                <Loader2 className="size-3 animate-spin" />
                                                                            ) : (
                                                                                <FileDown className="size-3" />
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => onDuplicar(c)}
                                                                            title="Duplicar caso"
                                                                            aria-label={`Duplicar cálculo de ${c.cliente_nome}`}
                                                                            className="inline-flex size-7 items-center justify-center border border-ink/25 text-ink/75 hover:bg-ink/5 hover:text-ink"
                                                                        >
                                                                            <CopyPlus className="size-3" />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setConfirmarExclusaoId(c.id)}
                                                                            title="Excluir cálculo"
                                                                            aria-label={`Excluir cálculo de ${c.cliente_nome}`}
                                                                            className="inline-flex size-7 items-center justify-center border border-ink/25 text-ink/60 hover:border-destructive hover:text-destructive"
                                                                        >
                                                                            <Trash2 className="size-3" />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => onAbrir(c)}
                                                                            className="inline-flex h-7 items-center bg-ink px-2.5 text-[11px] font-semibold text-paper hover:bg-ink-soft"
                                                                        >
                                                                            Abrir
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </article>
                                                );
                                            })
                                        )}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
