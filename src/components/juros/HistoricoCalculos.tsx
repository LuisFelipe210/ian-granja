import { Fragment, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
    ArrowDownUp,
    CalendarPlus,
    ChevronDown,
    ChevronRight,
    CopyPlus,
    FileDown,
    FileText,
    FolderKanban,
    FolderOpen,
    Gavel,
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
import { BarraPaginacao } from "@/components/juros/PaginacaoLista";
import { brl, mNome, num, type Nivel } from "@/lib/juros";
import {
    calcularProcessoRevisional,
    hojeISO,
    prepararDadosBacenProcesso,
} from "@/lib/juros/revisional-pro";
import { normalizarRotuloBanco } from "@/lib/juros/graficos-dados";
import {
    atualizarCalculo,
    atualizarCategoria,
    calculoParaProcesso,
    criarCategoria,
    excluirCalculo,
    isCalculoPendente,
    renovarCalculoSalvo,
    type CalculoSalvo,
    type Categoria,
} from "@/lib/revisional-db";
import { SeloCategoria } from "@/components/juros/GerenciarCategorias";
import { MenuAcoesLinha, type AcaoLinha } from "@/components/juros/MenuAcoesLinha";

type ModoExibicao = "tabela" | "agrupado" | "quadro";

/** Cartões por coluna do quadro antes de paginar. */
const CARTOES_POR_COLUNA = 12;
type CampoOrdenacao = "recentes" | "valor_desc" | "abuso_desc" | "nome_asc" | "banco_asc";

const VIEW_STORAGE_KEY = "ig_historico_modo_v1";

const ROTULO_NIVEL_CURTO: Record<Nivel, string> = {
    abuso: "Abuso",
    acima: "Acima",
    media: "Na média",
};

const COR_NIVEL: Record<Nivel, string> = {
    abuso: "bg-destructive/10 text-destructive",
    acima: "bg-gold-light/60 text-ink",
    media: "bg-[#126A35]/10 text-[#126A35]",
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

/** Modo salvo da Carteira. O Quadro (kanban) virou a tela CRM, então aqui só tabela ou por fase. */
function lerModoSalvo(): ModoExibicao {
    try {
        const v = localStorage.getItem(VIEW_STORAGE_KEY);
        if (v === "tabela" || v === "agrupado") return v;
    } catch {
        /* ignore */
    }
    return "tabela";
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
    onAbrirDjen?: (c: CalculoSalvo) => void;
    onAbrirRadarDjen?: () => void;
    onAdicionarPrazo?: (c: CalculoSalvo) => void;
    /** Recebe a lista de fases atualizada quando uma fase é criada ou renomeada no Quadro. */
    onCategoriasAlteradas?: (categorias: Categoria[]) => void;
    /** Categorias no sentido de tipo da ação (revisional_tipos). As "categorias" acima são as fases. */
    tipos?: Categoria[];
    /** "carteira" = tabela ou agrupado por fase; "crm" = só o quadro kanban por fase. */
    visao?: "carteira" | "crm";
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
    onAbrirDjen,
    onAbrirRadarDjen,
    onAdicionarPrazo,
    onCategoriasAlteradas,
    tipos = [],
    visao = "carteira",
}: HistoricoCalculosProps) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const topoListaRef = useRef<HTMLDivElement>(null);

    const modoParam = searchParams.get("modo");
    const modo: ModoExibicao =
        visao === "crm"
            ? "quadro"
            : modoParam === "tabela" || modoParam === "agrupado"
              ? modoParam
              : lerModoSalvo();

    const ordParam = searchParams.get("ord") as CampoOrdenacao | null;
    const ordenacao: CampoOrdenacao = ordParam && ORDENACOES_VALIDAS.has(ordParam) ? ordParam : "recentes";

    const filtroCategoria = searchParams.get("cat") || "todas";
    const grauParam = searchParams.get("grau");
    const filtroNivel: "todos" | Nivel =
        grauParam === "abuso" || grauParam === "acima" || grauParam === "media" ? grauParam : "todos";
    const filtroBanco = searchParams.get("banco") || "todos";
    const filtroTipo = searchParams.get("tipo") || "todos";
    const pagina = Math.max(1, parseInt(searchParams.get("p") || "1", 10) || 1);
    const ppRaw = parseInt(searchParams.get("pp") || "10", 10);
    const itensPorPagina = ppRaw === 20 || ppRaw === 50 ? ppRaw : 10;

    const queryUrl = searchParams.get("q") ?? "";
    const [busca, setBusca] = useState(queryUrl);

    useEffect(() => {
        setBusca(queryUrl);
    }, [queryUrl]);

    useEffect(() => {
        const valorNormalizado = busca.trim() ? busca : "";
        if (valorNormalizado === queryUrl) return;
        const timer = window.setTimeout(() => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    if (busca.trim()) next.set("q", busca);
                    else next.delete("q");
                    next.delete("p");
                    return next;
                },
                { replace: true },
            );
        }, 220);
        return () => window.clearTimeout(timer);
    }, [busca, queryUrl, setSearchParams]);

    const [expandidoId, setExpandidoId] = useState<string | null>(null);
    const [confirmarExclusaoId, setConfirmarExclusaoId] = useState<string | null>(null);
    const [operandoId, setOperandoId] = useState<string | null>(null);
    const [baixandoPdfId, setBaixandoPdfId] = useState<string | null>(null);
    const [renovandoId, setRenovandoId] = useState<string | null>(null);
    const [gruposFechados, setGruposFechados] = useState<Record<string, boolean>>({});
    // Página atual de cada grupo (modo agrupado) e de cada coluna do quadro: nenhuma lista sem fim.
    const [paginasGrupo, setPaginasGrupo] = useState<Record<string, number>>({});
    const fatiaGrupo = <T,>(chave: string, itens: T[], porPagina: number) => {
        const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
        const pagina = Math.min(paginasGrupo[chave] ?? 1, totalPaginas);
        const inicio = (pagina - 1) * porPagina;
        const fim = Math.min(itens.length, inicio + porPagina);
        return {
            itens: itens.slice(inicio, fim),
            pagina,
            totalPaginas,
            total: itens.length,
            inicio,
            fim,
            irPara: (p: number) => setPaginasGrupo((prev) => ({ ...prev, [chave]: p })),
        };
    };

    // Quadro (kanban por fase): arrastar cartões e criar/renomear fases no próprio quadro
    const [arrastandoId, setArrastandoId] = useState<string | null>(null);
    const [colunaAlvoDrag, setColunaAlvoDrag] = useState<string | null>(null);
    const [novaFaseAberta, setNovaFaseAberta] = useState(false);
    const [novaFaseNome, setNovaFaseNome] = useState("");
    const [renomeandoFaseId, setRenomeandoFaseId] = useState<string | null>(null);
    const [nomeFaseEdicao, setNomeFaseEdicao] = useState("");
    const [salvandoFase, setSalvandoFase] = useState(false);

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
                (k === "ord" && v === "recentes") ||
                (k === "tipo" && v === "todos")
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

    const mapaTipos = useMemo(() => Object.fromEntries(tipos.map((t) => [t.id, t])), [tipos]);

    /** Etiqueta da categoria (tipo da ação) do caso; null quando o caso não tem categoria. */
    const seloTipo = (c: CalculoSalvo) => {
        const t = c.tipo_id ? mapaTipos[c.tipo_id] : null;
        if (!t) return null;
        return (
            <span
                title={`Categoria: ${t.nome}`}
                className="inline-flex max-w-full shrink-0 items-center gap-1 border border-ink/15 bg-secondary/60 px-1.5 py-px text-[10px] font-semibold text-ink/80"
            >
                <span aria-hidden className={cn("size-1.5 shrink-0", COR_PONTO_CAT[t.cor] ?? "bg-ink")} />
                <span className="truncate">{t.nome}</span>
            </span>
        );
    };

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

            if (filtroTipo === "sem") {
                if (c.tipo_id && mapaTipos[c.tipo_id]) return false;
            } else if (filtroTipo !== "todos" && c.tipo_id !== filtroTipo) {
                return false;
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
                c.tipo_id ? mapaTipos[c.tipo_id]?.nome ?? "" : "",
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
    }, [busca, calculos, filtroBanco, filtroCategoria, filtroNivel, filtroTipo, mapaCategorias, mapaTipos, modo, ordenacao]);

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

    const criarFaseNoQuadro = async () => {
        const nome = novaFaseNome.trim();
        if (!nome || salvandoFase) return;
        if (categorias.some((cat) => cat.nome.trim().toLowerCase() === nome.toLowerCase())) {
            toast.error(`Já existe a fase "${nome}".`);
            return;
        }
        setSalvandoFase(true);
        try {
            const maxOrdem = categorias.reduce((m, cat) => Math.max(m, cat.ordem ?? 0), 0);
            const nova = await criarCategoria(nome, "ink", maxOrdem + 1);
            onCategoriasAlteradas?.([...categorias, nova]);
            setNovaFaseNome("");
            setNovaFaseAberta(false);
            toast.success(`Fase "${nova.nome}" criada.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível criar a fase.");
        } finally {
            setSalvandoFase(false);
        }
    };

    const renomearFase = async (id: string) => {
        const nome = nomeFaseEdicao.trim();
        const atual = categorias.find((cat) => cat.id === id);
        setRenomeandoFaseId(null);
        if (!atual || !nome || nome === atual.nome) return;
        try {
            const atualizada = await atualizarCategoria(id, { nome });
            onCategoriasAlteradas?.(categorias.map((cat) => (cat.id === id ? atualizada : cat)));
            toast.success(`Fase renomeada para "${atualizada.nome}".`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível renomear a fase.");
        }
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
        if (isCalculoPendente(c)) {
            toast.info(
                `"${c.cliente_nome}" ainda está aguardando os dados do contrato. Abra o caso para calcular e gerar o Laudo PDF.`,
                { action: { label: "Abrir caso", onClick: () => onAbrir(c) } },
            );
            return;
        }
        setBaixandoPdfId(c.id);
        try {
            const { ficha, processo } = calculoParaProcesso(c);
            const { onlineByContrato, seriesEconomicas } = await prepararDadosBacenProcesso(processo);
            const resultado = calcularProcessoRevisional(processo, seriesEconomicas, onlineByContrato);
            const cat = c.categoria_id ? mapaCategorias[c.categoria_id] : null;
            const { baixarLaudoPdf } = await import("@/lib/juros/laudo-pdf");
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

    const renovarCasoParaHoje = async (c: CalculoSalvo) => {
        if (isCalculoPendente(c)) {
            toast.info(
                `"${c.cliente_nome}" foi salvo sem dados financeiros do contrato. Abra o caso na calculadora para preencher e calcular.`,
                { action: { label: "Abrir caso", onClick: () => onAbrir(c) } },
            );
            return;
        }
        setRenovandoId(c.id);
        try {
            const { atualizado, resultado, ficha, valorAnterior, valorNovo } = await renovarCalculoSalvo(c, {
                novaDataBase: hojeISO(),
            });
            onAtualizado(atualizado);
            const cat = atualizado.categoria_id ? mapaCategorias[atualizado.categoria_id] : null;
            const { baixarLaudoPdf } = await import("@/lib/juros/laudo-pdf");
            baixarLaudoPdf(resultado, {
                clienteNome: ficha.clienteNome || atualizado.cliente_nome,
                processoGlobal: ficha.processoGlobal,
                categoriaNome: cat?.nome,
                observacoes: ficha.observacoes,
                incluirGraficos: true,
            });
            toast.success(
                `Cálculo de "${atualizado.cliente_nome}" renovado para hoje (${brl(valorAnterior)} → ${brl(valorNovo)}) e Laudo PDF atualizado.`,
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível renovar o cálculo agora.");
        } finally {
            setRenovandoId(null);
        }
    };

    /** Ações secundárias do caso, agrupadas no menu "⋯" da linha e do cartão. */
    const acoesSecundariasCaso = (c: CalculoSalvo): AcaoLinha[] => {
        const ocupado = renovandoId === c.id || baixandoPdfId === c.id;
        const acoes: AcaoLinha[] = [];
        if (onAdicionarPrazo) {
            acoes.push({
                id: "prazo",
                rotulo: "Adicionar prazo ou tarefa",
                Icone: CalendarPlus,
                onSelect: () => onAdicionarPrazo(c),
            });
        }
        if (onAbrirDjen) {
            acoes.push({
                id: "djen",
                rotulo: "Consultar publicações no DJEN",
                Icone: Gavel,
                onSelect: () => onAbrirDjen(c),
            });
        }
        acoes.push(
            {
                id: "renovar",
                rotulo: "Renovar para hoje (BACEN + laudo)",
                Icone: RefreshCw,
                onSelect: () => renovarCasoParaHoje(c),
                disabled: ocupado,
                carregando: renovandoId === c.id,
            },
            {
                id: "duplicar",
                rotulo: "Duplicar caso",
                Icone: CopyPlus,
                onSelect: () => onDuplicar(c),
            },
            {
                id: "excluir",
                rotulo: "Excluir cálculo",
                Icone: Trash2,
                onSelect: () => setConfirmarExclusaoId(c.id),
                destrutiva: true,
            },
        );
        return acoes;
    };

    const temFiltrosAtivos =
        busca.trim() !== "" ||
        filtroNivel !== "todos" ||
        filtroBanco !== "todos" ||
        filtroTipo !== "todos" ||
        (modo === "tabela" && filtroCategoria !== "todas");

    const limparFiltros = () => {
        setBusca("");
        atualizarUrl({ q: null, cat: null, grau: null, banco: null, tipo: null, p: null }, false);
    };

    const alternarOrdenacao = (alvo: CampoOrdenacao) => {
        atualizarUrl({ ord: ordenacao === alvo ? "recentes" : alvo, p: null }, true);
    };

    /** Celular e tablet: um cartão por caso; o cartão inteiro abre o caso, os controles não. */
    const renderListaCartoes = (itens: CalculoSalvo[]) => (
        <ul className="divide-y divide-ink/10 border border-ink/15 bg-card lg:hidden">
            {itens.map((c) => {
                const pendente = isCalculoPendente(c);
                const bancoRotulo = c.banco?.trim() ? normalizarRotuloBanco(c.banco) : "Banco não informado";
                const valAcao = valorAcaoCaso(c);
                const confirmando = confirmarExclusaoId === c.id;
                const corFase = c.categoria_id ? COR_PONTO_CAT[mapaCategorias[c.categoria_id]?.cor ?? ""] : null;

                return (
                    <li
                        key={c.id}
                        onClick={() => onAbrir(c)}
                        className={cn(
                            "cursor-pointer space-y-3 p-4 transition-colors duration-150 active:bg-ink/[0.04]",
                            calculoAtivoId === c.id && "bg-gold-light/20",
                        )}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAbrir(c);
                                    }}
                                    className="flex items-center gap-1.5 text-left font-semibold leading-snug text-ink hover:underline"
                                >
                                    <span className="line-clamp-2">{c.cliente_nome}</span>
                                    {c.observacoes?.trim() && (
                                        <FileText aria-label="Possui observações" className="size-3.5 shrink-0 text-gold-deep" />
                                    )}
                                </button>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {bancoRotulo} · {c.modalidade_nome}
                                </p>
                            </div>
                            <div className="shrink-0 text-right tabular-nums">
                                <p className="text-sm font-bold text-ink">
                                    {pendente && valAcao === 0 ? "Pendente" : valAcao > 0 ? brl(valAcao) : "—"}
                                </p>
                                {!pendente && c.pago_a_mais > 0 && (
                                    <p className="text-[11px] text-muted-foreground">Já pago: {brl(c.pago_a_mais)}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
                            {seloTipo(c)}
                            {pendente ? (
                                <span className="bg-secondary px-2 py-0.5 text-[11px] font-semibold text-ink/85">
                                    Aguardando contrato
                                </span>
                            ) : (
                                <>
                                    <span className={cn("px-2 py-0.5 text-[11px] font-bold", COR_NIVEL[c.nivel])}>
                                        {num(c.razao_am, 2)}x · {rotuloCurtoCaso(c)}
                                    </span>
                                    <span>
                                        {num(c.contrato_am)}% vs {num(c.media_am)}% a.m.
                                    </span>
                                </>
                            )}
                            <span>{c.processo_global || "Pré-ajuizamento"}</span>
                        </div>

                        <div className="flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                            <label className="relative flex min-w-0 max-w-[13rem] flex-1 items-center">
                                <span
                                    aria-hidden
                                    className={cn(
                                        "pointer-events-none absolute left-2 size-2",
                                        corFase ?? (c.categoria_id ? "bg-ink" : "border border-ink/40"),
                                    )}
                                />
                                <select
                                    value={c.categoria_id ?? ""}
                                    disabled={operandoId === c.id}
                                    onChange={(e) => trocarCategoriaItem(c, e.target.value)}
                                    aria-label={`Fase de ${c.cliente_nome}`}
                                    className="h-8 w-full cursor-pointer appearance-none truncate border border-ink/15 bg-card py-0 pl-6 pr-7 text-xs font-semibold text-ink focus:border-ink focus:outline-none disabled:cursor-wait disabled:opacity-60"
                                >
                                    <option value="">Sem fase</option>
                                    {categorias.map((catOpt) => (
                                        <option key={catOpt.id} value={catOpt.id}>
                                            {catOpt.nome}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown
                                    aria-hidden
                                    className="pointer-events-none absolute right-2 size-3.5 text-ink/50"
                                />
                            </label>

                            {confirmando ? (
                                <div className="inline-flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        disabled={operandoId === c.id}
                                        onClick={() => removerCalculo(c)}
                                        className="inline-flex h-8 items-center bg-destructive px-2.5 text-xs font-semibold text-destructive-foreground"
                                    >
                                        Excluir
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmarExclusaoId(null)}
                                        className="inline-flex h-8 items-center border border-ink/30 px-2.5 text-xs font-semibold text-ink"
                                    >
                                        Não
                                    </button>
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={baixandoPdfId === c.id || renovandoId === c.id}
                                        onClick={() => baixarPdfDireto(c)}
                                        aria-label={`Baixar Laudo PDF de ${c.cliente_nome}`}
                                        className="inline-flex size-8 items-center justify-center border border-ink/25 text-ink/80 disabled:opacity-60"
                                    >
                                        {baixandoPdfId === c.id ? (
                                            <Loader2 className="size-3.5 animate-spin" />
                                        ) : (
                                            <FileDown className="size-3.5" />
                                        )}
                                    </button>
                                    <MenuAcoesLinha
                                        contexto={c.cliente_nome}
                                        className="size-8"
                                        acoes={[
                                            {
                                                id: "abrir",
                                                rotulo: "Abrir caso",
                                                Icone: FolderOpen,
                                                onSelect: () => onAbrir(c),
                                            },
                                            ...acoesSecundariasCaso(c),
                                        ]}
                                    />
                                </div>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );

    const renderTabelaLinhas = (itens: CalculoSalvo[], ocultarColunaCategoria = false) => (
        <>
        {renderListaCartoes(itens)}
        <div className="hidden max-h-[72vh] overflow-auto overscroll-x-contain border border-ink/15 bg-card lg:block">
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm tabular-nums lg:min-w-0">
                <thead className="sticky top-0 z-10 bg-ink text-xs text-paper/80">
                    <tr>
                        <th className="whitespace-nowrap py-2.5 pl-3 pr-2 font-semibold">
                            <button
                                type="button"
                                onClick={() => alternarOrdenacao("nome_asc")}
                                className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-paper"
                            >
                                Cliente / Processo
                                <ArrowDownUp className="size-3 opacity-60" />
                            </button>
                        </th>
                        <th className="whitespace-nowrap px-2.5 py-2.5 font-semibold">
                            <button
                                type="button"
                                onClick={() => alternarOrdenacao("banco_asc")}
                                className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-paper"
                            >
                                Banco / Contrato
                                <ArrowDownUp className="size-3 opacity-60" />
                            </button>
                        </th>
                        {!ocultarColunaCategoria && (
                            <th className="whitespace-nowrap px-2.5 py-2.5 font-semibold">Fase / Categoria</th>
                        )}
                        <th className="whitespace-nowrap px-2.5 py-2.5 font-semibold">
                            <button
                                type="button"
                                onClick={() => alternarOrdenacao("abuso_desc")}
                                className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-paper"
                            >
                                Taxas / Grau
                                <ArrowDownUp className="size-3 opacity-60" />
                            </button>
                        </th>
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-right font-semibold">
                            <button
                                type="button"
                                onClick={() => alternarOrdenacao("valor_desc")}
                                className="ml-auto inline-flex items-center gap-1 transition-colors duration-150 hover:text-paper"
                            >
                                Proveito da Ação
                                <ArrowDownUp className="size-3 opacity-60" />
                            </button>
                        </th>
                        <th className="whitespace-nowrap py-2.5 pl-2 pr-3 text-right font-semibold">
                            <span className="sr-only">Ações</span>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-ink/12">
                    {itens.map((c) => {
                        const ativo = calculoAtivoId === c.id;
                        const expandido = expandidoId === c.id;
                        const confirmando = confirmarExclusaoId === c.id;
                        const pendente = isCalculoPendente(c);
                        const bancoRotulo = c.banco?.trim() ? normalizarRotuloBanco(c.banco) : "Não informado";
                        const valAcao = valorAcaoCaso(c);

                        return (
                            <Fragment key={c.id}>
                                <tr
                                    onClick={() => onAbrir(c)}
                                    className={cn(
                                        "cursor-pointer transition-colors duration-150 hover:bg-ink/[0.035]",
                                        ativo && "bg-gold-light/20",
                                    )}
                                >
                                    {/* Coluna 1: Cliente + Processo */}
                                    <td className="max-w-[14rem] py-2 pl-3 pr-2 align-middle sm:max-w-[16rem] lg:max-w-[17rem]">
                                        <div className="flex items-start gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandidoId(expandido ? null : c.id);
                                                }}
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
                                            <div className="min-w-0 flex-1">
                                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onAbrir(c);
                                                        }}
                                                        title={c.cliente_nome}
                                                        className="max-w-[11rem] truncate text-left font-semibold text-ink hover:underline sm:max-w-[13rem] lg:max-w-[14rem]"
                                                    >
                                                        {c.cliente_nome}
                                                    </button>
                                                    {seloTipo(c)}
                                                    {c.qtd_contratos > 1 && (
                                                        <span className="shrink-0 bg-ink/10 px-1.5 py-0.2 text-[10px] font-bold text-ink">
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
                                                        <span className="shrink-0 bg-gold-light px-1.5 py-0.2 text-[10px] font-bold text-ink">
                                                            Aberto
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
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
                                    <td className="max-w-[10rem] px-2.5 py-2 align-middle sm:max-w-[12rem]">
                                        <p title={bancoRotulo} className="truncate font-semibold text-ink">
                                            {bancoRotulo}
                                        </p>
                                        <p
                                            title={`${c.modalidade_nome} (${c.pessoa.toUpperCase()})`}
                                            className="mt-0.5 truncate text-xs text-muted-foreground"
                                        >
                                            {c.modalidade_nome} ({c.pessoa.toUpperCase()}) · {mNome(c.mes_contrato)} ·{" "}
                                            {pendente ? "Aguardando" : `${c.pagas}/${c.parcelas} pagas`}
                                        </p>
                                    </td>

                                    {/* Coluna 3: Seletor rápido de Categoria */}
                                    {!ocultarColunaCategoria && (
                                        <td className="px-2.5 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                                            <label className="relative flex w-[10.5rem] items-center">
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        "pointer-events-none absolute left-2 size-2",
                                                        c.categoria_id
                                                            ? COR_PONTO_CAT[mapaCategorias[c.categoria_id]?.cor ?? ""] ?? "bg-ink"
                                                            : "border border-ink/40",
                                                    )}
                                                />
                                                <select
                                                    value={c.categoria_id ?? ""}
                                                    disabled={operandoId === c.id}
                                                    onChange={(e) => trocarCategoriaItem(c, e.target.value)}
                                                    aria-label={`Fase de ${c.cliente_nome}`}
                                                    className="h-7 w-full cursor-pointer appearance-none truncate border border-ink/15 bg-card py-0 pl-6 pr-7 text-xs font-semibold text-ink transition-colors duration-150 hover:border-ink/40 focus:border-ink focus:outline-none disabled:cursor-wait disabled:opacity-60"
                                                >
                                                    <option value="">Sem fase</option>
                                                    {categorias.map((catOpt) => (
                                                        <option key={catOpt.id} value={catOpt.id}>
                                                            {catOpt.nome}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown
                                                    aria-hidden
                                                    className="pointer-events-none absolute right-2 size-3.5 text-ink/50"
                                                />
                                            </label>
                                        </td>
                                    )}

                                    {/* Coluna 4: Taxa / Nível de Abuso */}
                                    <td className="whitespace-nowrap px-2.5 py-2 align-middle">
                                        {pendente ? (
                                            <>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="inline-block whitespace-nowrap bg-secondary px-2 py-0.5 text-[11px] font-semibold text-ink/85">
                                                        Aguardando contrato
                                                    </span>
                                                </div>
                                                <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                                                    Clique em Abrir p/ calcular
                                                </p>
                                            </>
                                        ) : (
                                            <>
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
                                            </>
                                        )}
                                    </td>

                                    {/* Coluna 5: Valor da Ação */}
                                    <td className="whitespace-nowrap px-2.5 py-2 text-right align-middle">
                                        <p className="font-bold text-ink">
                                            {pendente && valAcao === 0 ? "Pendente" : valAcao > 0 ? brl(valAcao) : "—"}
                                        </p>
                                        <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                                            {pendente
                                                ? valAcao > 0
                                                    ? "Valor citado no processo"
                                                    : "Contrato não lançado"
                                                : c.pago_a_mais > 0
                                                  ? `Já pago: ${brl(c.pago_a_mais)}`
                                                  : valAcao === 0
                                                    ? "Taxa regular"
                                                    : `Financ.: ${brl(c.valor_financiado)}`}
                                        </p>
                                    </td>

                                    {/* Coluna 6: Ações alinhadas e fixas */}
                                    <td
                                        className="whitespace-nowrap py-2 pl-2 pr-3 text-right align-middle"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {confirmando ? (
                                            <div className="inline-flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    disabled={operandoId === c.id}
                                                    onClick={() => removerCalculo(c)}
                                                    className="inline-flex h-7 items-center whitespace-nowrap bg-destructive px-2.5 text-xs font-semibold text-destructive-foreground"
                                                >
                                                    Confirmar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmarExclusaoId(null)}
                                                    className="inline-flex h-7 items-center border border-ink/30 px-2 text-xs font-semibold text-ink"
                                                >
                                                    Não
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    disabled={baixandoPdfId === c.id || renovandoId === c.id}
                                                    onClick={() => baixarPdfDireto(c)}
                                                    title="Baixar Laudo PDF"
                                                    aria-label={`Baixar Laudo PDF de ${c.cliente_nome}`}
                                                    className="inline-flex size-7 items-center justify-center border border-ink/25 text-ink/80 transition-colors duration-150 hover:border-ink hover:bg-ink hover:text-paper disabled:opacity-60"
                                                >
                                                    {baixandoPdfId === c.id ? (
                                                        <Loader2 className="size-3.5 animate-spin" />
                                                    ) : (
                                                        <FileDown className="size-3.5" />
                                                    )}
                                                </button>
                                                <MenuAcoesLinha
                                                    contexto={c.cliente_nome}
                                                    acoes={[
                                                        {
                                                            id: "abrir",
                                                            rotulo: "Abrir caso",
                                                            Icone: FolderOpen,
                                                            onSelect: () => onAbrir(c),
                                                        },
                                                        ...acoesSecundariasCaso(c),
                                                    ]}
                                                />
                                            </div>
                                        )}
                                    </td>
                                </tr>

                                {/* Gaveta expansível sob demanda: ficha detalhada e observações */}
                                {expandido && (
                                    <tr className="bg-background/70">
                                        <td colSpan={ocultarColunaCategoria ? 5 : 6} className="px-6 py-4">
                                            {c.cliente_nome.length > 36 && (
                                                <p className="mb-3 text-xs font-semibold text-ink">
                                                    <span className="font-normal text-muted-foreground">
                                                        Nome completo / Parte:{" "}
                                                    </span>
                                                    {c.cliente_nome}
                                                </p>
                                            )}
                                            <div className="grid gap-4 text-xs sm:grid-cols-4">
                                                <div>
                                                    <span className="text-muted-foreground">Financiado / Parcelas</span>
                                                    <p className="mt-0.5 font-semibold text-ink">
                                                        {pendente
                                                            ? "Aguardando preenchimento do contrato"
                                                            : `${brl(c.valor_financiado)} (${c.parcelas}x de ${brl(c.valor_parcela)})`}
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
        </>
    );

    return (
        <div ref={topoListaRef} className="scroll-mt-6 space-y-5">
            {/* Cabeçalho da Carteira: resumo, modo de organização e ações */}
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight tabular-nums text-ink">
                        {filtradosOrdenados.length} {filtradosOrdenados.length === 1 ? "caso" : "casos"}
                        <span className="px-1.5 font-normal text-ink/30">·</span>
                        {brl(resumoLista.somaValores)}
                        <span className="text-base font-medium text-muted-foreground"> em proveito</span>
                    </h2>
                    <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                        <span className="font-semibold text-destructive">{resumoLista.abusos} com abuso</span>
                        <span className="px-1.5 text-ink/30">·</span>
                        <span className="font-semibold text-[#126A35]">{resumoLista.regulares}</span> com juros bons ou
                        na média
                        {temFiltrosAtivos && (
                            <>
                                <span className="px-1.5 text-ink/30">·</span>
                                <button
                                    type="button"
                                    onClick={limparFiltros}
                                    className="font-semibold text-ink underline-offset-4 hover:underline"
                                >
                                    Limpar filtros
                                </button>
                            </>
                        )}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {visao === "carteira" && (
                    <div
                        role="group"
                        aria-label="Modo de organização da lista"
                        className="sys-grupo inline-flex border border-ink/25 bg-card"
                    >
                        {(
                            [
                                { id: "tabela", label: "Tabela", Icone: List },
                                { id: "agrupado", label: "Por fase", Icone: FolderKanban },
                            ] as const
                        ).map(({ id, label, Icone }, i) => (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={modo === id}
                                onClick={() => alterarModo(id)}
                                className={cn(
                                    "inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold transition-colors duration-150",
                                    i > 0 && "border-l border-ink/20",
                                    modo === id ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                                )}
                            >
                                <Icone className="size-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>
                    )}

                    {onAbrirRadarDjen && (
                        <button
                            type="button"
                            onClick={onAbrirRadarDjen}
                            className="inline-flex h-9 items-center gap-1.5 border border-ink/25 bg-card px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5"
                        >
                            <Gavel className="size-3.5 text-gold-deep" />
                            Radar DJEN
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onGerenciarCategorias}
                        className="inline-flex h-9 items-center border border-ink/25 bg-card px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5"
                    >
                        Fases
                    </button>
                    <button
                        type="button"
                        onClick={onRecarregar}
                        disabled={carregando}
                        aria-label={visao === "crm" ? "Atualizar CRM" : "Atualizar carteira"}
                        title={visao === "crm" ? "Atualizar CRM" : "Atualizar carteira"}
                        className="inline-flex size-9 items-center justify-center border border-ink/25 bg-card text-ink transition-colors duration-150 hover:bg-ink/5 disabled:opacity-50"
                    >
                        <RefreshCw className={cn("size-3.5", carregando && "animate-spin")} />
                    </button>
                </div>
            </header>

            {/* Fases como filtro rápido (modo Tabela): ponto da cor da fase + contagem */}
            {modo === "tabela" && (
                <div role="group" aria-label="Filtrar por fase" className="flex flex-wrap items-center gap-1 border-b border-ink/15 pb-3">
                    {[
                        { id: "todas", nome: "Todas", qtd: calculos.length, ponto: null as string | null },
                        ...categorias.map((cat) => ({
                            id: cat.id,
                            nome: cat.nome,
                            qtd: contagensCat[cat.id] ?? 0,
                            ponto: COR_PONTO_CAT[cat.cor] ?? "bg-ink",
                        })),
                        ...(contagensCat.sem > 0
                            ? [{ id: "sem", nome: "Sem fase", qtd: contagensCat.sem, ponto: "border border-ink/40" }]
                            : []),
                    ].map((op) => {
                        const ativo = filtroCategoria === op.id;
                        return (
                            <button
                                key={op.id}
                                type="button"
                                aria-pressed={ativo}
                                onClick={() => atualizarUrl({ cat: op.id, p: null }, false)}
                                className={cn(
                                    "inline-flex h-8 items-center gap-1.5 whitespace-nowrap px-2.5 text-xs font-medium transition-colors duration-150",
                                    ativo ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                                )}
                            >
                                {op.ponto && <span aria-hidden className={cn("size-2 shrink-0", op.ponto)} />}
                                {op.nome}
                                <span className={cn("tabular-nums", ativo ? "text-paper/70" : "text-muted-foreground")}>
                                    {op.qtd}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Busca, filtros e ordenação numa fileira */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,10.5rem))]">
                <div className="relative sm:col-span-2 lg:col-span-1">
                    <Search
                        aria-hidden
                        className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-ink/50"
                    />
                    <input
                        type="search"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar cliente, CNJ, banco ou contrato"
                        aria-label={visao === "crm" ? "Buscar no CRM" : "Buscar na carteira"}
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

                {tipos.length > 0 && (
                    <select
                        value={filtroTipo}
                        onChange={(e) => atualizarUrl({ tipo: e.target.value, p: null }, true)}
                        aria-label="Filtrar por categoria"
                        className="field cursor-pointer py-2 text-xs font-medium [&>option]:text-ink"
                    >
                        <option value="todos">Todas as categorias</option>
                        {tipos.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.nome}
                            </option>
                        ))}
                        <option value="sem">Sem categoria</option>
                    </select>
                )}

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

            {/* Estado vazio */}
            {filtradosOrdenados.length === 0 ? (
                <div className="border border-ink/20 bg-card p-10 text-center">
                    <p className="sys-section text-ink">
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

                    <BarraPaginacao
                        pagina={paginaSegura}
                        totalPaginas={totalPaginas}
                        total={filtradosOrdenados.length}
                        inicio={indiceInicio}
                        fim={indiceFim}
                        onPagina={irParaPagina}
                        porPagina={itensPorPagina}
                        onPorPagina={(n) => atualizarUrl({ pp: String(n), p: null }, true)}
                        rotulo="clientes"
                    />
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
                                                <span className="text-[13px] font-semibold text-ink">
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

                                    {!fechado && (() => {
                                        const fatia = fatiaGrupo(`grupo:${g.id}`, g.itens, 10);
                                        return (
                                            <div className="border-t border-ink/20">
                                                {renderTabelaLinhas(fatia.itens, true)}
                                                <BarraPaginacao
                                                    variante="compacta"
                                                    pagina={fatia.pagina}
                                                    totalPaginas={fatia.totalPaginas}
                                                    total={fatia.total}
                                                    inicio={fatia.inicio}
                                                    fim={fatia.fim}
                                                    onPagina={fatia.irPara}
                                                    rotulo={`clientes da fase ${g.nome}`}
                                                    className="border-t border-ink/10 px-4 py-2"
                                                />
                                            </div>
                                        );
                                    })()}
                                </section>
                            );
                        })}
                </div>
            ) : (
                /* Modo Quadro: kanban por fase, como no Trello. Cada fase é uma coluna; os cartões
                   mudam de fase arrastando ou pelo "⋯"; a última coluna cria uma fase nova. */
                <div className="space-y-2">
                    <p aria-live="polite" className="text-xs text-muted-foreground">
                        {arrastandoId ? (
                            <span className="font-semibold text-ink">Solte o cartão na fase de destino.</span>
                        ) : (
                            "Arraste o cartão para outra fase (ou use o ⋯). Clique no cartão para abrir o caso e no nome da fase para renomear."
                        )}
                    </p>

                    <div className="flex items-start gap-2.5 overflow-x-auto overscroll-x-contain pb-3">
                        {gruposPorCategoria.map((g) => {
                            const alvoAtivo = colunaAlvoDrag === g.id;
                            const corPonto =
                                g.id === "sem" ? "border border-ink/40" : COR_PONTO_CAT[g.cor] ?? "bg-ink";
                            const editando = renomeandoFaseId === g.id;

                            return (
                                <section
                                    key={g.id}
                                    aria-label={`Fase ${g.nome}`}
                                    onDragOver={(e) => {
                                        if (!arrastandoId) return;
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = "move";
                                        if (colunaAlvoDrag !== g.id) setColunaAlvoDrag(g.id);
                                    }}
                                    onDragLeave={(e) => {
                                        if (
                                            !e.currentTarget.contains(e.relatedTarget as Node | null) &&
                                            colunaAlvoDrag === g.id
                                        ) {
                                            setColunaAlvoDrag(null);
                                        }
                                    }}
                                    onDrop={(e) => lidarSoltarNaColuna(e, g.id)}
                                    className={cn(
                                        "flex max-h-[calc(100vh-15rem)] min-h-[12rem] w-[16.5rem] shrink-0 flex-col border bg-secondary/60 transition-colors duration-150",
                                        alvoAtivo ? "border-ink bg-gold-light/30" : "border-ink/12",
                                    )}
                                >
                                    <header className="px-3 pb-2 pt-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            {editando ? (
                                                <input
                                                    autoFocus
                                                    onFocus={(e) => e.currentTarget.select()}
                                                    value={nomeFaseEdicao}
                                                    onChange={(e) => setNomeFaseEdicao(e.target.value)}
                                                    onBlur={() => renomearFase(g.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") e.currentTarget.blur();
                                                        if (e.key === "Escape") setRenomeandoFaseId(null);
                                                    }}
                                                    aria-label={`Novo nome da fase ${g.nome}`}
                                                    className="h-7 min-w-0 flex-1 border border-ink bg-card px-1.5 text-[13px] font-semibold text-ink focus:outline-none"
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={g.id === "sem"}
                                                    onClick={() => {
                                                        setNomeFaseEdicao(g.nome);
                                                        setRenomeandoFaseId(g.id);
                                                    }}
                                                    title={g.id === "sem" ? g.nome : "Clique para renomear a fase"}
                                                    className="flex min-w-0 items-center gap-1.5 text-left text-[13px] font-semibold text-ink enabled:hover:underline enabled:hover:underline-offset-4"
                                                >
                                                    <span aria-hidden className={cn("size-2 shrink-0", corPonto)} />
                                                    <span className="truncate">{g.nome}</span>
                                                </button>
                                            )}
                                            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                                                {g.itens.length}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 flex items-center justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
                                            <span>{brl(g.soma)}</span>
                                            {g.abusos > 0 && (
                                                <span className="font-semibold text-destructive">
                                                    {g.abusos} {g.abusos === 1 ? "abuso" : "abusos"}
                                                </span>
                                            )}
                                        </p>
                                    </header>

                                    <ul className="flex-1 space-y-1.5 overflow-y-auto px-1.5 pb-1.5">
                                        {g.itens.length === 0 && (
                                            <li
                                                className={cn(
                                                    "flex h-16 items-center justify-center border border-dashed px-3 text-center text-[11px]",
                                                    alvoAtivo ? "border-ink text-ink" : "border-ink/20 text-muted-foreground",
                                                )}
                                            >
                                                {arrastandoId ? `Soltar em ${g.nome}` : "Nenhum caso nesta fase"}
                                            </li>
                                        )}
                                        {fatiaGrupo(`coluna:${g.id}`, g.itens, CARTOES_POR_COLUNA).itens.map((c) => {
                                            const pendente = isCalculoPendente(c);
                                            const valAcao = valorAcaoCaso(c);
                                            const confirmando = confirmarExclusaoId === c.id;
                                            const bancoRot = c.banco?.trim()
                                                ? normalizarRotuloBanco(c.banco)
                                                : "Banco não informado";
                                            const destinos = gruposPorCategoria.filter((o) => o.id !== g.id);

                                            return (
                                                <li
                                                    key={c.id}
                                                    draggable={operandoId !== c.id && !confirmando}
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData("text/plain", c.id);
                                                        e.dataTransfer.effectAllowed = "move";
                                                        setArrastandoId(c.id);
                                                    }}
                                                    onDragEnd={() => {
                                                        setArrastandoId(null);
                                                        setColunaAlvoDrag(null);
                                                    }}
                                                    onClick={() => onAbrir(c)}
                                                    className={cn(
                                                        "cursor-pointer border bg-card p-2.5 transition-colors duration-150 hover:border-ink/45",
                                                        calculoAtivoId === c.id ? "border-ink/50 bg-gold-light/20" : "border-ink/12",
                                                        arrastandoId === c.id && "opacity-40",
                                                        operandoId === c.id && "opacity-60",
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onAbrir(c);
                                                            }}
                                                            className="line-clamp-2 text-left text-[13px] font-semibold leading-snug text-ink hover:underline"
                                                        >
                                                            {c.cliente_nome}
                                                        </button>
                                                        <div className="-mr-1 -mt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                            <MenuAcoesLinha
                                                                contexto={c.cliente_nome}
                                                                className="size-7 border-transparent"
                                                                acoes={[
                                                                    {
                                                                        id: "abrir",
                                                                        rotulo: "Abrir caso",
                                                                        Icone: FolderOpen,
                                                                        onSelect: () => onAbrir(c),
                                                                    },
                                                                    ...destinos.map((d) => ({
                                                                        id: `mover-${d.id}`,
                                                                        rotulo: `Mover para ${d.nome}`,
                                                                        Icone: FolderKanban,
                                                                        onSelect: () => trocarCategoriaItem(c, d.id === "sem" ? "" : d.id),
                                                                    })),
                                                                    ...acoesSecundariasCaso(c),
                                                                ]}
                                                            />
                                                        </div>
                                                    </div>
                                                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                                        {bancoRot}
                                                    </p>
                                                    {seloTipo(c) && <div className="mt-1.5">{seloTipo(c)}</div>}

                                                    {confirmando ? (
                                                        <div
                                                            className="mt-2 flex items-center justify-between gap-2"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <span className="text-[11px] font-semibold text-destructive">Excluir?</span>
                                                            <span className="inline-flex gap-1">
                                                                <button
                                                                    type="button"
                                                                    disabled={operandoId === c.id}
                                                                    onClick={() => removerCalculo(c)}
                                                                    className="inline-flex h-7 items-center bg-destructive px-2 text-[11px] font-semibold text-destructive-foreground"
                                                                >
                                                                    Excluir
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setConfirmarExclusaoId(null)}
                                                                    className="inline-flex h-7 items-center border border-ink/30 px-2 text-[11px] font-semibold text-ink"
                                                                >
                                                                    Não
                                                                </button>
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-2 flex items-center justify-between gap-2 tabular-nums">
                                                            <span className="text-[13px] font-bold text-ink">
                                                                {pendente && valAcao === 0 ? "Pendente" : valAcao > 0 ? brl(valAcao) : "—"}
                                                            </span>
                                                            {pendente ? (
                                                                <span className="text-[10px] font-semibold text-muted-foreground">
                                                                    Sem contrato
                                                                </span>
                                                            ) : (
                                                                <span
                                                                    title={`${num(c.contrato_am)}% vs ${num(c.media_am)}% a.m.`}
                                                                    className={cn("px-1.5 py-0.5 text-[10px] font-bold", COR_NIVEL[c.nivel])}
                                                                >
                                                                    {num(c.razao_am, 2)}x
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {(() => {
                                        const fatia = fatiaGrupo(`coluna:${g.id}`, g.itens, CARTOES_POR_COLUNA);
                                        return (
                                            <BarraPaginacao
                                                variante="compacta"
                                                pagina={fatia.pagina}
                                                totalPaginas={fatia.totalPaginas}
                                                total={fatia.total}
                                                inicio={fatia.inicio}
                                                fim={fatia.fim}
                                                onPagina={fatia.irPara}
                                                rotulo={`casos da fase ${g.nome}`}
                                                className="border-t border-ink/10 px-2.5 py-1.5"
                                            />
                                        );
                                    })()}
                                </section>
                            );
                        })}

                        {/* Última coluna: criar fase sem sair do quadro */}
                        <section className="w-[16.5rem] shrink-0">
                            {novaFaseAberta ? (
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        void criarFaseNoQuadro();
                                    }}
                                    className="space-y-2 border border-ink/15 bg-card p-2.5"
                                >
                                    <input
                                        autoFocus
                                        value={novaFaseNome}
                                        onChange={(e) => setNovaFaseNome(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Escape") {
                                                setNovaFaseAberta(false);
                                                setNovaFaseNome("");
                                            }
                                        }}
                                        placeholder="Nome da fase"
                                        aria-label="Nome da nova fase"
                                        className="h-8 w-full border border-ink/30 bg-card px-2 text-sm text-ink focus:border-ink focus:outline-none"
                                    />
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="submit"
                                            disabled={!novaFaseNome.trim() || salvandoFase}
                                            className="inline-flex h-8 items-center bg-ink px-3 text-xs font-semibold text-paper transition-colors duration-150 hover:bg-ink-soft disabled:opacity-50"
                                        >
                                            {salvandoFase ? "Criando…" : "Criar fase"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNovaFaseAberta(false);
                                                setNovaFaseNome("");
                                            }}
                                            aria-label="Cancelar nova fase"
                                            className="inline-flex size-8 items-center justify-center text-ink/60 hover:bg-ink/5 hover:text-ink"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setNovaFaseAberta(true)}
                                    className="flex h-11 w-full items-center gap-1.5 border border-dashed border-ink/25 px-3 text-sm font-medium text-ink/70 transition-colors duration-150 hover:border-ink/50 hover:bg-ink/[0.03] hover:text-ink"
                                >
                                    <Plus className="size-4" />
                                    Adicionar fase
                                </button>
                            )}
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
};
