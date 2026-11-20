import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
    AlertTriangle,
    Building2,
    Check,
    ClipboardCopy,
    ExternalLink,
    FilePlus2,
    Loader2,
    MapPin,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    UserRound,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    ESTADOS_CIVIS,
    buscarCep,
    cnpjValido,
    cpfValido,
    formatarCep,
    formatarCpfCnpj,
    formatarTelefone,
    mascaraCpfCnpj,
    pendenciasCadastro,
    qualificacaoCompleta,
    somenteDigitos,
} from "@/lib/clientes";
import {
    atualizarCliente,
    clienteEmBranco,
    criarCliente,
    excluirCliente,
    isTabelaTarefasAusente,
    listarClientes,
    vincularCasoAoCliente,
    type CalculoSalvo,
    type Cliente,
    type ClientePayload,
} from "@/lib/revisional-db";
import { useTravarRolagem } from "@/lib/use-travar-rolagem";
import { usePaginacao } from "@/lib/use-paginacao";
import { BarraPaginacao } from "@/components/juros/PaginacaoLista";

const UFS = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
    "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

function normalizar(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
}

function paraFormulario(c: Cliente | null): ClientePayload {
    if (!c) return clienteEmBranco();
    const base = clienteEmBranco();
    const out = { ...base };
    for (const chave of Object.keys(base) as Array<keyof ClientePayload>) {
        const v = c[chave];
        if (v !== undefined) (out as Record<string, unknown>)[chave] = v ?? base[chave];
    }
    return out;
}

function erroDocumento(form: ClientePayload): string | null {
    const d = somenteDigitos(form.cpf_cnpj);
    if (!d) return null;
    if (form.tipo_pessoa === "pj") return cnpjValido(d) ? null : "CNPJ inválido. Confira os números.";
    return cpfValido(d) ? null : "CPF inválido. Confira os números.";
}

/* ------------------------------------------------------- Campos do formulário */

function Campo({
    id,
    rotulo,
    children,
    erro,
    className,
}: {
    id: string;
    rotulo: string;
    children: ReactNode;
    erro?: string | null;
    className?: string;
}) {
    return (
        <div className={className}>
            <label htmlFor={id} className="sys-label block">
                {rotulo}
            </label>
            {children}
            {erro && <p className="mt-1 text-[11px] font-medium text-destructive">{erro}</p>}
        </div>
    );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
    return (
        <section className="space-y-3">
            <h3 className="border-b border-ink/10 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {titulo}
            </h3>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">{children}</div>
        </section>
    );
}

/* ------------------------------------------------------- Ficha do cliente */

interface AlvoFicha {
    cliente: Cliente | null;
}

function FichaCliente({
    alvo,
    calculos,
    onFechar,
    onSalvo,
    onExcluido,
    onAbrirCaso,
    onGerarDocumento,
    onCasosAlterados,
}: {
    alvo: AlvoFicha | null;
    calculos: CalculoSalvo[];
    onFechar: () => void;
    onSalvo: (c: Cliente, novo: boolean) => void;
    onExcluido: (id: string) => void;
    onAbrirCaso: (c: CalculoSalvo) => void;
    onGerarDocumento: (clienteId: string) => void;
    onCasosAlterados: () => void;
}) {
    useTravarRolagem(Boolean(alvo));
    const [form, setForm] = useState<ClientePayload>(clienteEmBranco());
    const [original, setOriginal] = useState<ClientePayload>(clienteEmBranco());
    const [salvando, setSalvando] = useState(false);
    const [buscandoCep, setBuscandoCep] = useState(false);
    const [erroCep, setErroCep] = useState<string | null>(null);
    const [confirmarExclusao, setConfirmarExclusao] = useState(false);
    const [confirmarDescarte, setConfirmarDescarte] = useState(false);
    const [casoParaVincular, setCasoParaVincular] = useState("");
    const nomeRef = useRef<HTMLInputElement>(null);
    const numeroRef = useRef<HTMLInputElement>(null);
    const ultimoCepBuscado = useRef("");

    const cliente = alvo?.cliente ?? null;

    useEffect(() => {
        if (!alvo) return;
        const f = paraFormulario(alvo.cliente);
        setForm(f);
        setOriginal(f);
        setConfirmarExclusao(false);
        setConfirmarDescarte(false);
        setErroCep(null);
        setCasoParaVincular("");
        ultimoCepBuscado.current = f.cep;
        if (!alvo.cliente) setTimeout(() => nomeRef.current?.focus(), 50);
    }, [alvo]);

    const alterado = JSON.stringify(form) !== JSON.stringify(original);
    const set = <K extends keyof ClientePayload>(chave: K, valor: ClientePayload[K]) =>
        setForm((f) => ({ ...f, [chave]: valor }));

    const casos = useMemo(
        () => (cliente ? calculos.filter((c) => c.cliente_id === cliente.id) : []),
        [calculos, cliente],
    );
    const outrosCasos = useMemo(
        () =>
            cliente
                ? calculos
                      .filter((c) => c.cliente_id !== cliente.id)
                      .sort((a, b) => a.cliente_nome.localeCompare(b.cliente_nome))
                : [],
        [calculos, cliente],
    );

    const cepReqRef = useRef(0);

    useEffect(() => {
        // Invalida buscas de CEP em andamento ao trocar de cliente ou fechar o painel.
        cepReqRef.current += 1;
    }, [alvo]);

    useEffect(() => {
        if (!alvo) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onFechar();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [alvo, onFechar]);

    const preencherPeloCep = useCallback(async (cep: string) => {
        const d = somenteDigitos(cep);
        if (d.length !== 8 || d === ultimoCepBuscado.current) return;
        ultimoCepBuscado.current = d;
        const reqId = ++cepReqRef.current;
        setBuscandoCep(true);
        setErroCep(null);
        try {
            const end = await buscarCep(d);
            if (reqId !== cepReqRef.current) return;
            if (!end) {
                setErroCep("CEP não encontrado. Preencha o endereço à mão.");
                return;
            }
            setForm((f) => ({
                ...f,
                logradouro: end.logradouro || f.logradouro,
                bairro: end.bairro || f.bairro,
                cidade: end.cidade || f.cidade,
                uf: end.uf || f.uf,
            }));
            setTimeout(() => numeroRef.current?.focus(), 30);
        } catch {
            if (reqId !== cepReqRef.current) return;
            setErroCep("Não deu para consultar o CEP agora. Preencha o endereço à mão.");
        } finally {
            if (reqId === cepReqRef.current) setBuscandoCep(false);
        }
    }, []);

    if (!alvo) return null;

    const erroDoc = erroDocumento(form);
    const qualificacao = qualificacaoCompleta({
        ...(cliente ?? ({} as Cliente)),
        ...form,
        cpf_cnpj: somenteDigitos(form.cpf_cnpj),
    } as Cliente);
    const pj = form.tipo_pessoa === "pj";

    const salvar = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!form.nome.trim()) {
            toast.error("Informe o nome do cliente.");
            nomeRef.current?.focus();
            return;
        }
        if (erroDoc) {
            toast.error(erroDoc);
            return;
        }
        setSalvando(true);
        try {
            const payload = { ...form, cpf_cnpj: somenteDigitos(form.cpf_cnpj) };
            const salvo = cliente ? await atualizarCliente(cliente.id, payload) : await criarCliente(payload);
            const f = paraFormulario(salvo);
            setForm(f);
            setOriginal(f);
            onSalvo(salvo, !cliente);
            if (cliente && salvo.nome !== cliente.nome) onCasosAlterados();
            toast.success(cliente ? "Cadastro atualizado." : "Cliente cadastrado.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível salvar o cliente.");
        } finally {
            setSalvando(false);
        }
    };

    const fechar = () => {
        if (alterado && !confirmarDescarte) {
            setConfirmarDescarte(true);
            return;
        }
        onFechar();
    };

    const excluir = async () => {
        if (!cliente) return;
        try {
            await excluirCliente(cliente.id);
            onExcluido(cliente.id);
            onCasosAlterados();
            toast.success("Cliente excluído. Os casos continuam na carteira.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
        }
    };

    const vincularCaso = async () => {
        if (!cliente || !casoParaVincular) return;
        try {
            await vincularCasoAoCliente(casoParaVincular, cliente);
            setCasoParaVincular("");
            onCasosAlterados();
            toast.success("Caso ligado a este cliente.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível ligar o caso.");
        }
    };

    const copiarQualificacao = async () => {
        try {
            await navigator.clipboard.writeText(qualificacao);
            toast.success("Qualificação copiada.");
        } catch {
            toast.error("O navegador não deixou copiar.");
        }
    };

    const classeInput = "field py-1.5 text-sm";

    return createPortal(
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-ficha-cliente" className="fixed inset-0 z-50 flex justify-end">
            <div aria-hidden onClick={fechar} className="fixed inset-0 bg-ink-deep/45" />
            <div className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-ink/20 bg-card shadow-2xl">
                <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-ink/15 px-5">
                    <h2 id="titulo-ficha-cliente" className="sys-title truncate text-ink">
                        {cliente ? cliente.nome : "Novo cliente"}
                    </h2>
                    <div className="flex items-center gap-1">
                        {cliente && (
                            <button
                                type="button"
                                onClick={() => onGerarDocumento(cliente.id)}
                                className="inline-flex h-8 items-center gap-1.5 bg-gold px-2.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-gold-light"
                            >
                                <FilePlus2 className="size-3.5" />
                                Gerar documento
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={fechar}
                            aria-label="Fechar"
                            className="inline-flex size-8 items-center justify-center text-muted-foreground hover:text-ink"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                </div>

                <form onSubmit={salvar} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-7 overflow-y-auto p-5">
                        <div role="group" aria-label="Tipo de pessoa" className="sys-grupo inline-flex border border-ink/25">
                            {(
                                [
                                    { id: "pf", rotulo: "Pessoa física", Icone: UserRound },
                                    { id: "pj", rotulo: "Empresa (PJ)", Icone: Building2 },
                                ] as const
                            ).map((t, i) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    aria-pressed={form.tipo_pessoa === t.id}
                                    onClick={() =>
                                        setForm((f) =>
                                            f.tipo_pessoa === t.id ? f : { ...f, tipo_pessoa: t.id, cpf_cnpj: "" },
                                        )
                                    }
                                    className={cn(
                                        "inline-flex h-8 items-center gap-1.5 px-3 text-xs font-semibold transition-colors duration-150",
                                        i > 0 && "border-l border-ink/20",
                                        form.tipo_pessoa === t.id ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                                    )}
                                >
                                    <t.Icone aria-hidden className="size-3.5" />
                                    {t.rotulo}
                                </button>
                            ))}
                        </div>

                        <Secao titulo="Identificação">
                            <Campo id="cli-nome" rotulo={pj ? "Razão social" : "Nome completo"} className="sm:col-span-2">
                                <input
                                    ref={nomeRef}
                                    id="cli-nome"
                                    value={form.nome}
                                    onChange={(e) => set("nome", e.target.value)}
                                    maxLength={200}
                                    required
                                    className={classeInput}
                                />
                            </Campo>
                            <Campo id="cli-doc" rotulo={pj ? "CNPJ" : "CPF"} erro={erroDoc}>
                                <input
                                    id="cli-doc"
                                    inputMode="numeric"
                                    value={mascaraCpfCnpj(form.cpf_cnpj, form.tipo_pessoa)}
                                    onChange={(e) => set("cpf_cnpj", somenteDigitos(e.target.value))}
                                    placeholder={pj ? "00.000.000/0000-00" : "000.000.000-00"}
                                    aria-invalid={Boolean(erroDoc)}
                                    className={classeInput}
                                />
                            </Campo>
                            {!pj ? (
                                <Campo id="cli-nasc" rotulo="Data de nascimento">
                                    <input
                                        id="cli-nasc"
                                        type="date"
                                        value={form.data_nascimento ?? ""}
                                        onChange={(e) => set("data_nascimento", e.target.value || null)}
                                        className={classeInput}
                                    />
                                </Campo>
                            ) : (
                                <span className="hidden sm:block" />
                            )}
                            {!pj && (
                                <>
                                    <Campo id="cli-rg" rotulo="RG">
                                        <input
                                            id="cli-rg"
                                            value={form.rg}
                                            onChange={(e) => set("rg", e.target.value)}
                                            maxLength={40}
                                            className={classeInput}
                                        />
                                    </Campo>
                                    <Campo id="cli-rg-orgao" rotulo="Órgão emissor">
                                        <input
                                            id="cli-rg-orgao"
                                            value={form.rg_orgao}
                                            onChange={(e) => set("rg_orgao", e.target.value)}
                                            maxLength={40}
                                            placeholder="Ex.: SDS/PE"
                                            className={classeInput}
                                        />
                                    </Campo>
                                </>
                            )}
                        </Secao>

                        {!pj ? (
                            <Secao titulo="Qualificação">
                                <Campo id="cli-genero" rotulo="Gênero (para concordância)">
                                    <select
                                        id="cli-genero"
                                        value={form.genero}
                                        onChange={(e) => set("genero", e.target.value as ClientePayload["genero"])}
                                        className={classeInput}
                                    >
                                        <option value="">Não informar (usa “(a)”)</option>
                                        <option value="m">Masculino: brasileiro, casado</option>
                                        <option value="f">Feminino: brasileira, casada</option>
                                    </select>
                                </Campo>
                                <Campo id="cli-nac" rotulo="Nacionalidade">
                                    <input
                                        id="cli-nac"
                                        value={form.nacionalidade}
                                        onChange={(e) => set("nacionalidade", e.target.value)}
                                        maxLength={60}
                                        placeholder="brasileiro"
                                        className={classeInput}
                                    />
                                </Campo>
                                <Campo id="cli-civil" rotulo="Estado civil">
                                    <select
                                        id="cli-civil"
                                        value={form.estado_civil}
                                        onChange={(e) => set("estado_civil", e.target.value)}
                                        className={classeInput}
                                    >
                                        <option value="">Não informado</option>
                                        {ESTADOS_CIVIS.map((e) => (
                                            <option key={e.id} value={e.id}>
                                                {e.neutro}
                                            </option>
                                        ))}
                                    </select>
                                </Campo>
                                <Campo id="cli-prof" rotulo="Profissão">
                                    <input
                                        id="cli-prof"
                                        value={form.profissao}
                                        onChange={(e) => set("profissao", e.target.value)}
                                        maxLength={100}
                                        placeholder="Ex.: motorista"
                                        className={classeInput}
                                    />
                                </Campo>
                            </Secao>
                        ) : (
                            <Secao titulo="Representante legal">
                                <Campo id="cli-rep" rotulo="Nome do representante">
                                    <input
                                        id="cli-rep"
                                        value={form.representante_nome}
                                        onChange={(e) => set("representante_nome", e.target.value)}
                                        maxLength={200}
                                        className={classeInput}
                                    />
                                </Campo>
                                <Campo
                                    id="cli-rep-cpf"
                                    rotulo="CPF do representante"
                                    erro={
                                        form.representante_cpf && !cpfValido(form.representante_cpf) ? "CPF inválido." : null
                                    }
                                >
                                    <input
                                        id="cli-rep-cpf"
                                        inputMode="numeric"
                                        value={mascaraCpfCnpj(form.representante_cpf, "pf")}
                                        onChange={(e) => set("representante_cpf", somenteDigitos(e.target.value))}
                                        placeholder="000.000.000-00"
                                        className={classeInput}
                                    />
                                </Campo>
                            </Secao>
                        )}

                        <Secao titulo="Endereço">
                            <Campo id="cli-cep" rotulo="CEP" erro={erroCep}>
                                <div className="relative">
                                    <input
                                        id="cli-cep"
                                        inputMode="numeric"
                                        value={formatarCep(form.cep)}
                                        onChange={(e) => {
                                            const d = somenteDigitos(e.target.value).slice(0, 8);
                                            set("cep", d);
                                            if (d.length === 8) void preencherPeloCep(d);
                                        }}
                                        placeholder="00000-000"
                                        className={cn(classeInput, "pr-6")}
                                    />
                                    {buscandoCep && (
                                        <Loader2 className="absolute right-0 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                    )}
                                </div>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    Digite o CEP e o endereço é preenchido sozinho.
                                </p>
                            </Campo>
                            <span className="hidden sm:block" />
                            <Campo id="cli-rua" rotulo="Rua / logradouro" className="sm:col-span-2">
                                <input
                                    id="cli-rua"
                                    value={form.logradouro}
                                    onChange={(e) => set("logradouro", e.target.value)}
                                    maxLength={200}
                                    className={classeInput}
                                />
                            </Campo>
                            <Campo id="cli-num" rotulo="Número">
                                <input
                                    ref={numeroRef}
                                    id="cli-num"
                                    value={form.numero}
                                    onChange={(e) => set("numero", e.target.value)}
                                    maxLength={20}
                                    className={classeInput}
                                />
                            </Campo>
                            <Campo id="cli-comp" rotulo="Complemento">
                                <input
                                    id="cli-comp"
                                    value={form.complemento}
                                    onChange={(e) => set("complemento", e.target.value)}
                                    maxLength={100}
                                    placeholder="Apto, bloco..."
                                    className={classeInput}
                                />
                            </Campo>
                            <Campo id="cli-bairro" rotulo="Bairro">
                                <input
                                    id="cli-bairro"
                                    value={form.bairro}
                                    onChange={(e) => set("bairro", e.target.value)}
                                    maxLength={100}
                                    className={classeInput}
                                />
                            </Campo>
                            <div className="grid grid-cols-[1fr_72px] gap-3">
                                <Campo id="cli-cidade" rotulo="Cidade">
                                    <input
                                        id="cli-cidade"
                                        value={form.cidade}
                                        onChange={(e) => set("cidade", e.target.value)}
                                        maxLength={100}
                                        className={classeInput}
                                    />
                                </Campo>
                                <Campo id="cli-uf" rotulo="UF">
                                    <select
                                        id="cli-uf"
                                        value={form.uf}
                                        onChange={(e) => set("uf", e.target.value)}
                                        className={classeInput}
                                    >
                                        <option value="">—</option>
                                        {UFS.map((uf) => (
                                            <option key={uf} value={uf}>
                                                {uf}
                                            </option>
                                        ))}
                                    </select>
                                </Campo>
                            </div>
                        </Secao>

                        <Secao titulo="Contato">
                            <Campo id="cli-tel" rotulo="Telefone / WhatsApp">
                                <input
                                    id="cli-tel"
                                    type="tel"
                                    value={form.telefone}
                                    onChange={(e) => set("telefone", e.target.value)}
                                    onBlur={() => set("telefone", formatarTelefone(form.telefone))}
                                    maxLength={40}
                                    placeholder="(87) 90000-0000"
                                    className={classeInput}
                                />
                            </Campo>
                            <Campo id="cli-email" rotulo="E-mail">
                                <input
                                    id="cli-email"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => set("email", e.target.value)}
                                    maxLength={200}
                                    className={classeInput}
                                />
                            </Campo>
                            <Campo id="cli-obs" rotulo="Observações" className="sm:col-span-2">
                                <textarea
                                    id="cli-obs"
                                    value={form.observacoes}
                                    onChange={(e) => set("observacoes", e.target.value)}
                                    maxLength={4000}
                                    rows={2}
                                    className={cn(classeInput, "resize-y")}
                                />
                            </Campo>
                        </Secao>

                        <section className="space-y-2">
                            <div className="flex items-center justify-between gap-2 border-b border-ink/10 pb-1.5">
                                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Qualificação para a petição
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => void copiarQualificacao()}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink hover:underline"
                                >
                                    <ClipboardCopy className="size-3" /> Copiar
                                </button>
                            </div>
                            <p className="bg-secondary/60 px-3 py-2.5 font-serif text-sm leading-relaxed text-ink">
                                {form.nome.trim() ? qualificacao : "Preencha o nome para ver a qualificação."}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                                Nos modelos de documento, use o campo <strong className="text-ink">[qualificação completa]</strong>.
                            </p>
                        </section>

                        {cliente && (
                            <section className="space-y-2">
                                <h3 className="border-b border-ink/10 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Casos na carteira ({casos.length})
                                </h3>
                                {casos.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Nenhum caso ligado a este cliente.</p>
                                ) : (
                                    <ul className="divide-y divide-ink/10 border border-ink/15">
                                        {casos.map((c) => (
                                            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-ink">
                                                        {c.processo_global || "Sem número de processo"}
                                                    </p>
                                                    <p className="truncate text-[11px] text-muted-foreground">
                                                        {[c.banco, c.modalidade_nome].filter(Boolean).join(" · ")}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => onAbrirCaso(c)}
                                                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-ink hover:underline"
                                                >
                                                    Abrir <ExternalLink className="size-3" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {outrosCasos.length > 0 && (
                                    <div className="flex items-end gap-2">
                                        <div className="min-w-0 flex-1">
                                            <label htmlFor="cli-vincular" className="text-[11px] font-medium text-muted-foreground">
                                                Ligar outro caso a este cliente (ex.: nome digitado diferente)
                                            </label>
                                            <select
                                                id="cli-vincular"
                                                value={casoParaVincular}
                                                onChange={(e) => setCasoParaVincular(e.target.value)}
                                                className={classeInput}
                                            >
                                                <option value="">Escolha o caso</option>
                                                {outrosCasos.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.cliente_nome}
                                                        {c.processo_global ? ` · ${c.processo_global}` : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={!casoParaVincular}
                                            onClick={() => void vincularCaso()}
                                            className="inline-flex h-8 shrink-0 items-center border border-ink/25 px-3 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-40"
                                        >
                                            Ligar
                                        </button>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-ink/15 px-5 py-3">
                        {confirmarDescarte ? (
                            <span className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-semibold text-ink">Descartar as alterações?</span>
                                <button
                                    type="button"
                                    onClick={onFechar}
                                    className="inline-flex h-7 items-center border border-ink/25 px-2 font-semibold text-ink hover:bg-ink/5"
                                >
                                    Descartar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmarDescarte(false)}
                                    className="font-semibold text-muted-foreground hover:text-ink"
                                >
                                    Continuar editando
                                </button>
                            </span>
                        ) : cliente ? (
                            confirmarExclusao ? (
                                <span className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-semibold text-destructive">Excluir o cadastro?</span>
                                    <button
                                        type="button"
                                        onClick={() => void excluir()}
                                        className="inline-flex h-7 items-center bg-destructive px-2 font-semibold text-white"
                                    >
                                        Excluir
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmarExclusao(false)}
                                        className="font-semibold text-muted-foreground hover:text-ink"
                                    >
                                        Cancelar
                                    </button>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmarExclusao(true)}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="size-3.5" /> Excluir cadastro
                                </button>
                            )
                        ) : (
                            <span />
                        )}
                        <button
                            type="submit"
                            disabled={salvando || (Boolean(cliente) && !alterado)}
                            className="inline-flex h-9 items-center gap-1.5 bg-gold px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-gold-light disabled:opacity-50"
                        >
                            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                            {cliente ? (alterado ? "Salvar alterações" : "Salvo") : "Cadastrar cliente"}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}

/* ------------------------------------------------------- Tela */

interface ClientesSistemaProps {
    calculos: CalculoSalvo[];
    onAbrirCaso: (c: CalculoSalvo) => void;
    onGerarDocumento: (clienteId: string) => void;
    onRecarregarCasos: () => void;
}

type Filtro = "todos" | "incompletos";

export const ClientesSistema = ({ calculos, onAbrirCaso, onGerarDocumento, onRecarregarCasos }: ClientesSistemaProps) => {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [indisponivel, setIndisponivel] = useState(false);
    const [busca, setBusca] = useState("");
    const [filtro, setFiltro] = useState<Filtro>("todos");
    const [alvo, setAlvo] = useState<AlvoFicha | null>(null);

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
                    onClick={() => setAlvo({ cliente: null })}
                    className="inline-flex h-9 items-center gap-1.5 bg-gold px-3.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-gold-light"
                >
                    <Plus className="size-3.5" />
                    Novo cliente
                </button>
            </div>

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
                    <div className="hidden grid-cols-[minmax(0,2fr)_150px_140px_minmax(0,1fr)_60px_minmax(0,1.3fr)] gap-3 border-b border-ink/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground xl:grid">
                        <span>Cliente</span>
                        <span>CPF / CNPJ</span>
                        <span>Telefone</span>
                        <span>Cidade</span>
                        <span className="text-right">Casos</span>
                        <span>Cadastro</span>
                    </div>
                    <ul className="divide-y divide-ink/10">
                        {pag.itensPagina.map((c) => {
                            const faltando = pendenciasCadastro(c);
                            const qtd = casosPorCliente.get(c.id) ?? 0;
                            return (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        onClick={() => setAlvo({ cliente: c })}
                                        className="grid w-full gap-x-3 gap-y-0.5 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-ink/[0.03] xl:grid-cols-[minmax(0,2fr)_150px_140px_minmax(0,1fr)_60px_minmax(0,1.3fr)] xl:items-center"
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

            <FichaCliente
                alvo={alvo}
                calculos={calculos}
                onFechar={() => setAlvo(null)}
                onSalvo={(salvo, novo) => {
                    setClientes((prev) =>
                        (novo ? [...prev, salvo] : prev.map((c) => (c.id === salvo.id ? salvo : c))).sort((a, b) =>
                            a.nome.localeCompare(b.nome),
                        ),
                    );
                    // Mantém a ficha aberta com o registro atualizado (nome no topo, casos, próxima comparação).
                    setAlvo({ cliente: salvo });
                }}
                onExcluido={(id) => {
                    setClientes((prev) => prev.filter((c) => c.id !== id));
                    setAlvo(null);
                }}
                onAbrirCaso={(c) => {
                    setAlvo(null);
                    onAbrirCaso(c);
                }}
                onGerarDocumento={(id) => {
                    setAlvo(null);
                    onGerarDocumento(id);
                }}
                onCasosAlterados={onRecarregarCasos}
            />
        </div>
    );
};
