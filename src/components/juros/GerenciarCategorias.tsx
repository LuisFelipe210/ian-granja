import { useState, type FormEvent } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    atualizarCategoria,
    atualizarTipo,
    criarCategoria,
    criarTipo,
    excluirCategoria,
    excluirTipo,
    type Categoria,
    type CategoriaCor,
} from "@/lib/revisional-db";

/** A mesma tela gerencia as FASES (etapas do fluxo) e as CATEGORIAS (tipo da ação). */
type TipoLista = "fase" | "categoria";

const API_LISTA = {
    fase: { criar: criarCategoria, atualizar: atualizarCategoria, excluir: excluirCategoria },
    categoria: { criar: criarTipo, atualizar: atualizarTipo, excluir: excluirTipo },
} as const;

const ROTULOS_LISTA: Record<TipoLista, { singular: string; plural: string; titulo: string; placeholder: string; semItem: string }> = {
    fase: {
        singular: "fase",
        plural: "fases",
        titulo: "Nova fase do fluxo",
        placeholder: "Ex.: Triagem, Em análise, Ajuizado, Sentença...",
        semItem: "Os casos ficam sem fase.",
    },
    categoria: {
        singular: "categoria",
        plural: "categorias",
        titulo: "Nova categoria (tipo da ação)",
        placeholder: "Ex.: Revisional, Busca e Apreensão, Superendividamento...",
        semItem: "Os casos ficam sem categoria.",
    },
};

const CORES_CATEGORIA: { id: CategoriaCor; rotulo: string; badge: string; dot: string }[] = [
    { id: "gold", rotulo: "Dourado", badge: "bg-gold-light/70 text-ink border-gold", dot: "bg-gold" },
    { id: "ink", rotulo: "Marinho", badge: "bg-ink/10 text-ink border-ink/30", dot: "bg-ink" },
    { id: "crimson", rotulo: "Urgente", badge: "bg-destructive/15 text-destructive border-destructive/40", dot: "bg-destructive" },
    { id: "emerald", rotulo: "Ativo", badge: "bg-[#177F40]/15 text-[#126A35] border-[#177F40]/40", dot: "bg-[#177F40]" },
    { id: "slate", rotulo: "Neutro", badge: "bg-secondary text-ink/85 border-ink/25", dot: "bg-ink/45" },
];

const estiloCategoria = (cor: CategoriaCor = "slate") =>
    CORES_CATEGORIA.find((c) => c.id === cor) ?? CORES_CATEGORIA[4];

export const SeloCategoria = ({ categoria }: { categoria?: Categoria | null }) => {
    if (!categoria) {
        return (
            <span className="inline-flex items-center border border-ink/20 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Sem categoria
            </span>
        );
    }
    const est = estiloCategoria(categoria.cor);
    return (
        <span className={cn("inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-semibold", est.badge)}>
            <span aria-hidden className={cn("size-1.5", est.dot)} />
            {categoria.nome}
        </span>
    );
};

interface GerenciarCategoriasProps {
    categorias: Categoria[];
    contagemPorCategoria: Record<string, number>;
    onChange: (novas: Categoria[]) => void;
    /** "fase" (padrão) ou "categoria" (tipo da ação). */
    tipoLista?: TipoLista;
}

export const GerenciarCategorias = ({
    categorias,
    contagemPorCategoria,
    onChange,
    tipoLista = "fase",
}: GerenciarCategoriasProps) => {
    const api = API_LISTA[tipoLista];
    const rotulo = ROTULOS_LISTA[tipoLista];
    const Singular = rotulo.singular.charAt(0).toUpperCase() + rotulo.singular.slice(1);
    const [novoNome, setNovoNome] = useState("");
    const [novaCor, setNovaCor] = useState<CategoriaCor>("gold");
    const [criando, setCriando] = useState(false);

    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [editNome, setEditNome] = useState("");
    const [editCor, setEditCor] = useState<CategoriaCor>("gold");
    const [salvandoId, setSalvandoId] = useState<string | null>(null);
    const [confirmarExclusaoId, setConfirmarExclusaoId] = useState<string | null>(null);

    const adicionar = async (ev: FormEvent) => {
        ev.preventDefault();
        if (!novoNome.trim()) return;
        setCriando(true);
        try {
            const maxOrdem = categorias.reduce((acc, c) => Math.max(acc, c.ordem), 0);
            const criada = await api.criar(novoNome, novaCor, maxOrdem + 1);
            onChange([...categorias, criada]);
            setNovoNome("");
            toast.success(`${Singular} "${criada.nome}" criada.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : `Erro ao criar ${rotulo.singular}.`);
        } finally {
            setCriando(false);
        }
    };

    const iniciarEdicao = (cat: Categoria) => {
        setEditandoId(cat.id);
        setEditNome(cat.nome);
        setEditCor(cat.cor);
        setConfirmarExclusaoId(null);
    };

    const salvarEdicao = async (id: string) => {
        if (!editNome.trim()) return;
        setSalvandoId(id);
        try {
            const atualizada = await api.atualizar(id, { nome: editNome.trim(), cor: editCor });
            onChange(categorias.map((c) => (c.id === id ? atualizada : c)));
            setEditandoId(null);
            toast.success(`${Singular} atualizada.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : `Erro ao atualizar ${rotulo.singular}.`);
        } finally {
            setSalvandoId(null);
        }
    };

    const remover = async (cat: Categoria) => {
        setSalvandoId(cat.id);
        try {
            await api.excluir(cat.id);
            onChange(categorias.filter((c) => c.id !== cat.id));
            setConfirmarExclusaoId(null);
            toast.success(`${Singular} "${cat.nome}" removida.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : `Erro ao excluir ${rotulo.singular}.`);
        } finally {
            setSalvandoId(null);
        }
    };

    return (
        <div className="space-y-5">
            <form
                onSubmit={adicionar}
                className="flex flex-wrap items-end gap-4 border border-ink/20 bg-card px-5 py-4"
            >
                <div className="min-w-[14rem] flex-1">
                    <label htmlFor={`nova-${tipoLista}-nome`} className="sys-label block text-ink">
                        {rotulo.titulo}
                    </label>
                    <input
                        id={`nova-${tipoLista}-nome`}
                        value={novoNome}
                        onChange={(e) => setNovoNome(e.target.value)}
                        maxLength={60}
                        placeholder={rotulo.placeholder}
                        className="field py-2 text-sm"
                        required
                    />
                </div>

                <div>
                    <span className="sys-label block text-ink">Cor</span>
                    <div className="mt-2 flex items-center gap-1.5">
                        {CORES_CATEGORIA.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setNovaCor(c.id)}
                                title={c.rotulo}
                                aria-label={`Cor ${c.rotulo}`}
                                aria-pressed={novaCor === c.id}
                                className={cn(
                                    "inline-flex size-8 items-center justify-center border transition-colors",
                                    novaCor === c.id ? "border-ink ring-2 ring-gold" : "border-ink/20 opacity-70 hover:opacity-100",
                                )}
                            >
                                <span className={cn("size-3.5", c.dot)} />
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={criando || !novoNome.trim()}
                    className="inline-flex h-9 items-center justify-center gap-1.5 bg-ink px-4 text-xs font-semibold text-paper hover:bg-ink-soft disabled:opacity-60"
                >
                    {criando ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                    Criar {rotulo.singular}
                </button>
            </form>

            <div className="border border-ink/20 bg-card">
                <div className="border-b border-ink/15 px-5 py-3">
                    <h2 className="sys-section text-ink">
                        {Singular === "Fase" ? "Fases" : "Categorias"} cadastradas ({categorias.length})
                    </h2>
                </div>

                {categorias.length === 0 ? (
                    <p className="px-6 py-8 text-sm text-muted-foreground">Nenhuma {rotulo.singular} cadastrada ainda.</p>
                ) : (
                    <ul className="divide-y divide-ink/15">
                        {categorias.map((cat) => {
                            const qtd = contagemPorCategoria[cat.id] ?? 0;
                            const emEdicao = editandoId === cat.id;
                            const confirmando = confirmarExclusaoId === cat.id;

                            return (
                                <li key={cat.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                                    {emEdicao ? (
                                        <div className="flex flex-1 flex-wrap items-center gap-4">
                                            <input
                                                value={editNome}
                                                onChange={(e) => setEditNome(e.target.value)}
                                                maxLength={60}
                                                aria-label={`Editar nome da ${rotulo.singular}`}
                                                className="field max-w-xs py-1.5"
                                            />
                                            <div className="flex items-center gap-1.5">
                                                {CORES_CATEGORIA.map((c) => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => setEditCor(c.id)}
                                                        title={c.rotulo}
                                                        aria-label={`Cor ${c.rotulo}`}
                                                        className={cn(
                                                            "inline-flex size-7 items-center justify-center border",
                                                            editCor === c.id ? "border-ink ring-2 ring-gold" : "border-ink/20 opacity-65",
                                                        )}
                                                    >
                                                        <span className={cn("size-3.5", c.dot)} />
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={salvandoId === cat.id}
                                                    onClick={() => salvarEdicao(cat.id)}
                                                    className="inline-flex h-9 items-center gap-1.5 bg-ink px-3 text-xs font-semibold text-paper hover:bg-ink-soft"
                                                >
                                                    <Check className="size-3.5" />
                                                    Salvar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditandoId(null)}
                                                    className="inline-flex h-9 items-center gap-1 border border-ink/30 px-3 text-xs font-semibold text-ink hover:bg-ink/5"
                                                >
                                                    <X className="size-3.5" />
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <SeloCategoria categoria={cat} />
                                                <span className="text-xs tabular-nums text-muted-foreground">
                                                    {qtd} {qtd === 1 ? "caso" : "casos"}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {confirmando ? (
                                                    <>
                                                        <span className="text-xs text-muted-foreground">
                                                            {rotulo.semItem}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            disabled={salvandoId === cat.id}
                                                            onClick={() => remover(cat)}
                                                            className="inline-flex h-8 items-center bg-destructive px-3 text-xs font-semibold text-destructive-foreground"
                                                        >
                                                            Confirmar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmarExclusaoId(null)}
                                                            className="inline-flex h-8 items-center border border-ink/30 px-2.5 text-xs font-semibold text-ink"
                                                        >
                                                            Não
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => iniciarEdicao(cat)}
                                                            className="inline-flex h-8 items-center gap-1.5 border border-ink/25 px-3 text-xs font-semibold text-ink hover:bg-ink/5"
                                                        >
                                                            <Pencil className="size-3.5" />
                                                            Editar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmarExclusaoId(cat.id)}
                                                            aria-label={`Excluir ${rotulo.singular} ${cat.nome}`}
                                                            className="inline-flex size-8 items-center justify-center border border-ink/25 text-ink/70 hover:border-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};
