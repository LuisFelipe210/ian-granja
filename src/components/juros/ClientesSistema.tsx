import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Building2, Loader2, MapPin, Plus, RefreshCw, Search, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatarCpfCnpj, formatarTelefone, pendenciasCadastro, somenteDigitos } from "@/lib/clientes";
import {
    excluirClientes,
    isTabelaTarefasAusente,
    listarClientes,
    type CalculoSalvo,
    type Cliente,
} from "@/lib/revisional-db";
import { usePaginacao } from "@/lib/use-paginacao";
import { ModalConfirmarExclusao } from "@/components/juros/ModalConfirmarExclusao";
import { fraseExclusaoClientes } from "@/lib/confirmacao";
import { BarraPaginacao } from "@/components/juros/PaginacaoLista";
import { PaginaCliente } from "@/components/juros/PaginaCliente";

function normalizar(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
}

/** Caixa de seleção que aceita o estado "parcial" (alguns itens marcados). */
function CaixaSelecao({
    marcada,
    parcial = false,
    onChange,
    rotulo,
}: {
    marcada: boolean;
    parcial?: boolean;
    onChange: (marcada: boolean) => void;
    rotulo: string;
}) {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = parcial && !marcada;
    }, [parcial, marcada]);
    return (
        <input
            ref={ref}
            type="checkbox"
            checked={marcada}
            onChange={(e) => onChange(e.target.checked)}
            aria-label={rotulo}
            className="size-4 shrink-0 cursor-pointer accent-ink"
        />
    );
}

/* ------------------------------------------------------- Tela */

interface ClientesSistemaProps {
    calculos: CalculoSalvo[];
    /** Cliente aberto pela rota (`clientes/:id`); "novo" abre o cadastro em branco; null mostra a lista. */
    clienteIdRota: string | null;
    onNavegarCliente: (id: string | null, opcoes?: { substituir?: boolean }) => void;
    onAbrirCaso: (c: CalculoSalvo) => void;
    onGerarDocumento: (clienteId: string) => void;
    onRecarregarCasos: () => void;
}

type Filtro = "todos" | "incompletos";

export const ClientesSistema = ({
    calculos,
    clienteIdRota,
    onNavegarCliente,
    onAbrirCaso,
    onGerarDocumento,
    onRecarregarCasos,
}: ClientesSistemaProps) => {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [indisponivel, setIndisponivel] = useState(false);
    const [busca, setBusca] = useState("");
    const [filtro, setFiltro] = useState<Filtro>("todos");
    const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
    const [confirmarLote, setConfirmarLote] = useState(false);
    const [excluindoLote, setExcluindoLote] = useState(false);
    const fecharConfirmacaoLote = useCallback(() => setConfirmarLote(false), []);

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            setClientes(await listarClientes());
            setIndisponivel(false);
        } catch (err) {
            if (isTabelaTarefasAusente(err)) setIndisponivel(true);
            else toast.error(err instanceof Error ? err.message : "Não foi possível carregar os clientes.");
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        void carregar();
    }, [carregar]);

    // Casos novos criam clientes no banco (pelo nome): recarrega quando a carteira muda.
    const assinaturaCasos = useMemo(() => calculos.map((c) => `${c.id}:${c.cliente_id ?? ""}`).join("|"), [calculos]);
    const primeiraAssinatura = useRef(assinaturaCasos);
    useEffect(() => {
        if (assinaturaCasos === primeiraAssinatura.current) return;
        primeiraAssinatura.current = assinaturaCasos;
        void listarClientes()
            .then(setClientes)
            .catch(() => undefined);
    }, [assinaturaCasos]);

    const casosPorCliente = useMemo(() => {
        const m = new Map<string, number>();
        for (const c of calculos) if (c.cliente_id) m.set(c.cliente_id, (m.get(c.cliente_id) ?? 0) + 1);
        return m;
    }, [calculos]);

    const incompletos = useMemo(() => clientes.filter((c) => pendenciasCadastro(c).length > 0).length, [clientes]);

    const filtrados = useMemo(() => {
        const q = normalizar(busca.trim());
        const digitos = somenteDigitos(busca);
        return clientes.filter((c) => {
            if (filtro === "incompletos" && pendenciasCadastro(c).length === 0) return false;
            if (!q) return true;
            return (
                normalizar(`${c.nome} ${c.cidade} ${c.email}`).includes(q) ||
                (digitos.length >= 3 && (c.cpf_cnpj.includes(digitos) || somenteDigitos(c.telefone).includes(digitos)))
            );
        });
    }, [clientes, busca, filtro]);

    const listaRef = useRef<HTMLDivElement>(null);
    const pag = usePaginacao(filtrados, { porPaginaPadrao: 20, reiniciarCom: [busca, filtro] });

    // Seleção para excluir em lote. Ids que sumiram da lista (excluídos em outro lugar) saem da seleção.
    useEffect(() => {
        setSelecionados((sel) => {
            if (sel.size === 0) return sel;
            const existentes = new Set(clientes.map((c) => c.id));
            const filtrada = new Set([...sel].filter((id) => existentes.has(id)));
            return filtrada.size === sel.size ? sel : filtrada;
        });
    }, [clientes]);

    useEffect(() => {
        if (selecionados.size === 0) setConfirmarLote(false);
    }, [selecionados]);

    const alternar = (id: string, marcar: boolean) =>
        setSelecionados((sel) => {
            const nova = new Set(sel);
            if (marcar) nova.add(id);
            else nova.delete(id);
            return nova;
        });

    const marcarVarios = (ids: string[], marcar: boolean) =>
        setSelecionados((sel) => {
            const nova = new Set(sel);
            for (const id of ids) {
                if (marcar) nova.add(id);
                else nova.delete(id);
            }
            return nova;
        });

    const idsPagina = pag.itensPagina.map((c) => c.id);
    const marcadosNaPagina = idsPagina.filter((id) => selecionados.has(id)).length;
    const todosFiltradosMarcados = filtrados.length > 0 && filtrados.every((c) => selecionados.has(c.id));
    const casosSelecionados = [...selecionados].reduce((t, id) => t + (casosPorCliente.get(id) ?? 0), 0);
    const nomesSelecionados = clientes.filter((c) => selecionados.has(c.id)).map((c) => c.nome);
    // Um cliente: digita o nome dele. Vários: digita "excluir N clientes" (o número evita apagar mais do que se viu).
    const fraseLote = fraseExclusaoClientes(nomesSelecionados);

    const excluirSelecionados = async () => {
        const ids = [...selecionados];
        if (ids.length === 0) return;
        setExcluindoLote(true);
        try {
            await excluirClientes(ids);
            const removidos = new Set(ids);
            setClientes((prev) => prev.filter((c) => !removidos.has(c.id)));
            setSelecionados(new Set());
            setConfirmarLote(false);
            onRecarregarCasos();
            toast.success(
                ids.length === 1
                    ? "1 cliente excluído. Os casos continuam na carteira."
                    : `${ids.length} clientes excluídos. Os casos continuam na carteira.`,
            );
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível excluir os clientes.");
            // Recarrega para mostrar o que de fato ficou no banco se um lote falhou no meio.
            void carregar();
        } finally {
            setExcluindoLote(false);
        }
    };

    if (indisponivel) {
        return (
            <div className="border border-ink/20 bg-card p-6 sm:p-8">
                <div className="flex items-start gap-3">
                    <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-deep" />
                    <div className="space-y-2">
                        <h2 className="sys-section text-ink">O cadastro de clientes precisa da migração do banco</h2>
                        <p className="max-w-xl text-sm text-muted-foreground">
                            Aplique a migração{" "}
                            <code className="bg-secondary px-1 py-0.5 text-xs">20261120140000_revisional_clientes.sql</code> e
                            tente novamente.
                        </p>
                        <button
                            type="button"
                            onClick={() => void carregar()}
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

    if (clienteIdRota) {
        const novo = clienteIdRota === "novo";
        const cliente = novo ? null : (clientes.find((c) => c.id === clienteIdRota) ?? null);
        if (!novo && !cliente) {
            return carregando ? (
                <div className="flex items-center gap-2 border border-ink/15 bg-card p-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Carregando cliente…
                </div>
            ) : (
                <div className="border border-ink/15 bg-card p-8 text-center">
                    <UserRound aria-hidden className="mx-auto size-8 text-ink/30" />
                    <h2 className="sys-section mt-3 text-ink">Cliente não encontrado</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Ele pode ter sido excluído.</p>
                    <button
                        type="button"
                        onClick={() => onNavegarCliente(null)}
                        className="mt-4 inline-flex h-8 items-center gap-1.5 border border-ink/25 px-3 text-xs font-semibold text-ink hover:bg-ink/5"
                    >
                        Voltar para os clientes
                    </button>
                </div>
            );
        }
        return (
            <PaginaCliente
                key={cliente?.id ?? "novo"}
                cliente={cliente}
                calculos={calculos}
                onVoltar={() => onNavegarCliente(null)}
                onSalvo={(salvo, criado) => {
                    setClientes((prev) =>
                        (criado ? [...prev, salvo] : prev.map((c) => (c.id === salvo.id ? salvo : c))).sort((a, b) =>
                            a.nome.localeCompare(b.nome),
                        ),
                    );
                    if (criado) onNavegarCliente(salvo.id, { substituir: true });
                }}
                onExcluido={(id) => {
                    setClientes((prev) => prev.filter((c) => c.id !== id));
                    onNavegarCliente(null, { substituir: true });
                }}
                onAbrirCaso={onAbrirCaso}
                onGerarDocumento={onGerarDocumento}
                onCasosAlterados={onRecarregarCasos}
            />
        );
    }

    return (
        <div ref={listaRef} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full max-w-md">
                    <Search
                        aria-hidden
                        className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar por nome, CPF, telefone ou cidade"
                        aria-label="Buscar cliente"
                        className="field py-2 pl-6 text-sm"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => onNavegarCliente("novo")}
                    className="inline-flex h-9 items-center gap-1.5 bg-gold px-3.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-gold-light"
                >
                    <Plus className="size-3.5" />
                    Novo cliente
                </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="group" aria-label="Filtro" className="sys-grupo inline-flex border border-ink/25 bg-card">
                    {(
                        [
                            { id: "todos", rotulo: "Todos", qtd: clientes.length },
                            { id: "incompletos", rotulo: "Cadastro incompleto", qtd: incompletos },
                        ] as const
                    ).map((f, i) => (
                        <button
                            key={f.id}
                            type="button"
                            aria-pressed={filtro === f.id}
                            onClick={() => setFiltro(f.id)}
                            className={cn(
                                "inline-flex h-9 items-center gap-1.5 px-3.5 text-xs font-semibold transition-colors duration-150",
                                i > 0 && "border-l border-ink/20",
                                filtro === f.id ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                            )}
                        >
                            {f.rotulo}
                            <span className={cn("tabular-nums", filtro === f.id ? "text-paper/70" : "text-muted-foreground")}>
                                {f.qtd}
                            </span>
                        </button>
                    ))}
                </div>
                {!carregando && filtrados.length > 0 && (
                    <label className="inline-flex h-9 cursor-pointer items-center gap-2 border border-ink/25 bg-card px-3.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5">
                        <CaixaSelecao
                            marcada={todosFiltradosMarcados}
                            parcial={filtrados.some((c) => selecionados.has(c.id))}
                            onChange={(m) => marcarVarios(filtrados.map((c) => c.id), m)}
                            rotulo={`Selecionar todos os ${filtrados.length} clientes`}
                        />
                        Selecionar todos
                        <span className="tabular-nums text-muted-foreground">{filtrados.length}</span>
                    </label>
                )}
            </div>

            {selecionados.size > 0 && (
                <div
                    role="region"
                    aria-label="Clientes selecionados"
                    className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-ink px-4 py-2.5 text-paper shadow-lg"
                >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <strong className="tabular-nums">
                            {selecionados.size} {selecionados.size === 1 ? "selecionado" : "selecionados"}
                        </strong>
                        {!todosFiltradosMarcados && filtrados.length > selecionados.size && (
                            <button
                                type="button"
                                onClick={() => marcarVarios(filtrados.map((c) => c.id), true)}
                                className="text-xs font-semibold text-gold underline-offset-2 hover:underline"
                            >
                                Selecionar todos os {filtrados.length}
                                {busca || filtro !== "todos" ? " encontrados" : ""}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setSelecionados(new Set())}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-paper/70 hover:text-paper"
                        >
                            <X className="size-3.5" /> Limpar seleção
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setConfirmarLote(true)}
                        className="inline-flex h-8 items-center gap-1.5 bg-destructive px-3 text-xs font-semibold text-white hover:bg-destructive/90"
                    >
                        <Trash2 className="size-3.5" /> Excluir {selecionados.size}
                    </button>
                </div>
            )}

            {carregando ? (
                <div className="flex items-center gap-2 border border-ink/15 bg-card p-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Carregando…
                </div>
            ) : filtrados.length === 0 ? (
                <div className="border border-ink/15 bg-card p-8 text-center">
                    <UserRound aria-hidden className="mx-auto size-8 text-ink/30" />
                    <h2 className="sys-section mt-3 text-ink">
                        {busca || filtro !== "todos" ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                    </h2>
                </div>
            ) : (
                <div className="border border-ink/15 bg-card">
                    <div className="flex items-center border-b border-ink/15">
                        <label className="flex shrink-0 cursor-pointer items-center gap-2 self-stretch py-2 pl-4 pr-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <CaixaSelecao
                                marcada={idsPagina.length > 0 && marcadosNaPagina === idsPagina.length}
                                parcial={marcadosNaPagina > 0}
                                onChange={(m) => marcarVarios(idsPagina, m)}
                                rotulo="Selecionar todos desta página"
                            />
                            <span className="xl:hidden">Selecionar página</span>
                        </label>
                        <div className="hidden flex-1 grid-cols-[minmax(0,2fr)_150px_140px_minmax(0,1fr)_60px_minmax(0,1.3fr)] gap-3 py-2 pl-2 pr-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground xl:grid">
                            <span>Cliente</span>
                            <span>CPF / CNPJ</span>
                            <span>Telefone</span>
                            <span>Cidade</span>
                            <span className="text-right">Casos</span>
                            <span>Cadastro</span>
                        </div>
                    </div>
                    <ul className="divide-y divide-ink/10">
                        {pag.itensPagina.map((c) => {
                            const faltando = pendenciasCadastro(c);
                            const qtd = casosPorCliente.get(c.id) ?? 0;
                            return (
                                <li
                                    key={c.id}
                                    className={cn("flex items-stretch", selecionados.has(c.id) && "bg-gold/10")}
                                >
                                    <label className="flex shrink-0 cursor-pointer items-center py-2.5 pl-4 pr-2">
                                        <CaixaSelecao
                                            marcada={selecionados.has(c.id)}
                                            onChange={(m) => alternar(c.id, m)}
                                            rotulo={`Selecionar ${c.nome}`}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => onNavegarCliente(c.id)}
                                        className="grid min-w-0 flex-1 gap-x-3 gap-y-0.5 py-2.5 pl-2 pr-4 text-left transition-colors duration-150 hover:bg-ink/[0.03] xl:grid-cols-[minmax(0,2fr)_150px_140px_minmax(0,1fr)_60px_minmax(0,1.3fr)] xl:items-center"
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            {c.tipo_pessoa === "pj" ? (
                                                <Building2 aria-label="Empresa" className="size-3.5 shrink-0 text-muted-foreground" />
                                            ) : (
                                                <UserRound aria-label="Pessoa física" className="size-3.5 shrink-0 text-muted-foreground" />
                                            )}
                                            <span className="truncate text-sm font-semibold text-ink">{c.nome}</span>
                                        </span>
                                        <span className={cn("text-xs tabular-nums text-ink/80", !c.cpf_cnpj && "hidden xl:block")}>
                                            {c.cpf_cnpj ? formatarCpfCnpj(c.cpf_cnpj) : <span className="text-muted-foreground">—</span>}
                                        </span>
                                        <span className="hidden text-xs tabular-nums text-ink/80 xl:block">
                                            {c.telefone ? formatarTelefone(c.telefone) : <span className="text-muted-foreground">—</span>}
                                        </span>
                                        <span className="hidden truncate text-xs text-ink/80 xl:flex xl:items-center xl:gap-1">
                                            {c.cidade ? (
                                                <>
                                                    <MapPin aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                                                    {[c.cidade, c.uf].filter(Boolean).join("/")}
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </span>
                                        <span className="hidden text-right text-xs tabular-nums text-ink xl:block">{qtd}</span>
                                        <span
                                            title={faltando.length ? `Falta ${faltando.join(", ")}` : undefined}
                                            className={cn(
                                                "truncate text-[11px] font-medium",
                                                faltando.length ? "text-gold-deep" : "text-emerald-700",
                                            )}
                                        >
                                            {faltando.length ? `Falta ${faltando.join(", ")}` : "Completo"}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {!carregando && (
                <BarraPaginacao
                    pagina={pag.pagina}
                    totalPaginas={pag.totalPaginas}
                    total={pag.total}
                    inicio={pag.inicio}
                    fim={pag.fim}
                    onPagina={pag.irPara}
                    porPagina={pag.porPagina}
                    onPorPagina={pag.mudarPorPagina}
                    rotulo="clientes"
                    alvoRolagem={listaRef}
                />
            )}

            <ModalConfirmarExclusao
                aberto={confirmarLote}
                titulo={selecionados.size === 1 ? "Excluir cliente" : `Excluir ${selecionados.size} clientes`}
                fraseConfirmacao={fraseLote}
                rotuloBotao={selecionados.size === 1 ? "Excluir este cliente" : `Excluir os ${selecionados.size} clientes`}
                excluindo={excluindoLote}
                onConfirmar={() => void excluirSelecionados()}
                onCancelar={fecharConfirmacaoLote}
            >
                <p>{selecionados.size === 1 ? "Este cliente vai ser excluído:" : "Estes clientes vão ser excluídos:"}</p>
                <ul className="max-h-40 space-y-0.5 overflow-y-auto border border-ink/10 bg-secondary/40 px-3 py-2 text-xs">
                    {nomesSelecionados.slice(0, 8).map((nome, i) => (
                        <li key={`${nome}-${i}`} className="truncate font-medium">
                            {nome}
                        </li>
                    ))}
                    {nomesSelecionados.length > 8 && (
                        <li className="text-muted-foreground">e mais {nomesSelecionados.length - 8}</li>
                    )}
                </ul>
                {casosSelecionados > 0 && (
                    <p className="text-xs text-muted-foreground">
                        {casosSelecionados === 1 ? "O caso ligado continua" : `Os ${casosSelecionados} casos ligados continuam`}{" "}
                        na carteira, só sem o cliente.
                    </p>
                )}
            </ModalConfirmarExclusao>
        </div>
    );
};
