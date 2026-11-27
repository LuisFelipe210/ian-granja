import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
    ArrowLeft,
    Building2,
    Check,
    ChevronRight,
    ClipboardCopy,
    FilePlus2,
    Loader2,
    Mail,
    MapPin,
    Phone,
    Trash2,
    UserRound,
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
    vincularCasoAoCliente,
    type CalculoSalvo,
    type Cliente,
    type ClientePayload,
} from "@/lib/revisional-db";
import { BaseConhecimentoCliente } from "@/components/juros/BaseConhecimentoCliente";
import { ModalConfirmarExclusao } from "@/components/juros/ModalConfirmarExclusao";

const UFS = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
    "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

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

function iniciais(nome: string): string {
    const partes = nome.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return "?";
    const primeira = partes[0][0] ?? "";
    const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "";
    return (primeira + ultima).toUpperCase();
}

/* ------------------------------------------------------- Peças do formulário */

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
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</div>
        </section>
    );
}

function Cartao({ titulo, acao, children }: { titulo: ReactNode; acao?: ReactNode; children: ReactNode }) {
    return (
        <section className="border border-ink/15 bg-card">
            <div className="flex min-h-11 items-center justify-between gap-2 border-b border-ink/10 px-4 py-2">
                <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
                {acao}
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

/* ------------------------------------------------------- Página do cliente */

type AbaPagina = "cadastro" | "base";

export interface PaginaClienteProps {
    /** Cliente salvo; `null` abre o cadastro de um cliente novo. */
    cliente: Cliente | null;
    calculos: CalculoSalvo[];
    onVoltar: () => void;
    onSalvo: (c: Cliente, novo: boolean) => void;
    onExcluido: (id: string) => void;
    onAbrirCaso: (c: CalculoSalvo) => void;
    onGerarDocumento: (clienteId: string) => void;
    onCasosAlterados: () => void;
}

export function PaginaCliente({
    cliente,
    calculos,
    onVoltar,
    onSalvo,
    onExcluido,
    onAbrirCaso,
    onGerarDocumento,
    onCasosAlterados,
}: PaginaClienteProps) {
    // O componente é montado com `key` = id do cliente: o estado inicial vem do cadastro salvo.
    const [form, setForm] = useState<ClientePayload>(() => paraFormulario(cliente));
    const [original, setOriginal] = useState<ClientePayload>(() => paraFormulario(cliente));
    const [salvando, setSalvando] = useState(false);
    const [buscandoCep, setBuscandoCep] = useState(false);
    const [erroCep, setErroCep] = useState<string | null>(null);
    const [confirmarExclusao, setConfirmarExclusao] = useState(false);
    const [excluindo, setExcluindo] = useState(false);
    const fecharConfirmacao = useCallback(() => setConfirmarExclusao(false), []);
    const [confirmarDescarte, setConfirmarDescarte] = useState(false);
    const [casoParaVincular, setCasoParaVincular] = useState("");
    const [aba, setAba] = useState<AbaPagina>("cadastro");
    const [totalBase, setTotalBase] = useState<number | null>(null);
    const nomeRef = useRef<HTMLInputElement>(null);
    const numeroRef = useRef<HTMLInputElement>(null);
    const ultimoCepBuscado = useRef(somenteDigitos(cliente?.cep ?? ""));
    const cepReqRef = useRef(0);

    const alterado = JSON.stringify(form) !== JSON.stringify(original);
    const set = <K extends keyof ClientePayload>(chave: K, valor: ClientePayload[K]) =>
        setForm((f) => ({ ...f, [chave]: valor }));

    useEffect(() => {
        window.scrollTo({ top: 0 });
        if (!cliente) setTimeout(() => nomeRef.current?.focus(), 50);
        // Invalida buscas de CEP em andamento ao sair da página.
        return () => {
            cepReqRef.current += 1;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Avisa antes de fechar a aba do navegador com alterações não salvas.
    useEffect(() => {
        if (!alterado) return;
        const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", aviso);
        return () => window.removeEventListener("beforeunload", aviso);
    }, [alterado]);

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

    const erroDoc = erroDocumento(form);
    const qualificacao = qualificacaoCompleta({
        ...(cliente ?? ({} as Cliente)),
        ...form,
        cpf_cnpj: somenteDigitos(form.cpf_cnpj),
    } as Cliente);
    const pj = form.tipo_pessoa === "pj";
    const pendencias = cliente ? pendenciasCadastro(cliente) : [];

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

    const voltar = () => {
        if (alterado && !confirmarDescarte) {
            setConfirmarDescarte(true);
            return;
        }
        onVoltar();
    };

    const excluir = async () => {
        if (!cliente) return;
        setExcluindo(true);
        try {
            await excluirCliente(cliente.id);
            onExcluido(cliente.id);
            onCasosAlterados();
            toast.success("Cliente excluído. Os casos continuam na carteira.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
            setExcluindo(false);
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
    const botaoSecundario =
        "inline-flex h-9 items-center gap-1.5 border border-ink/25 bg-card px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5";

    const formulario = (
        <form onSubmit={salvar}>
            <div className="space-y-8 p-5 sm:p-6">
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
            </div>
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 bg-card px-5 py-3 sm:px-6">
                <p className="text-xs text-muted-foreground">
                    {alterado ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-gold-deep">
                            <span aria-hidden className="size-1.5 bg-gold-deep" /> Alterações não salvas
                        </span>
                    ) : cliente ? (
                        "Tudo salvo."
                    ) : (
                        "Preencha pelo menos o nome."
                    )}
                </p>
                <button
                    type="submit"
                    disabled={salvando || (Boolean(cliente) && !alterado)}
                    className="inline-flex h-9 items-center gap-1.5 bg-gold px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-gold-light disabled:opacity-50"
                >
                    {salvando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    {cliente ? "Salvar alterações" : "Cadastrar cliente"}
                </button>
            </div>
        </form>
    );

    const meta = cliente
        ? [
              cliente.cpf_cnpj
                  ? { Icone: cliente.tipo_pessoa === "pj" ? Building2 : UserRound, texto: formatarCpfCnpj(cliente.cpf_cnpj) }
                  : null,
              cliente.telefone ? { Icone: Phone, texto: formatarTelefone(cliente.telefone) } : null,
              cliente.email ? { Icone: Mail, texto: cliente.email } : null,
              cliente.cidade ? { Icone: MapPin, texto: [cliente.cidade, cliente.uf].filter(Boolean).join("/") } : null,
          ].filter((x): x is NonNullable<typeof x> => x !== null)
        : [];

    return (
        <div className="space-y-5">
            {/* Voltar / navegação */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={voltar}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:text-ink"
                >
                    <ArrowLeft className="size-4" /> Clientes
                </button>
                {confirmarDescarte && (
                    <span className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-ink">Sair sem salvar as alterações?</span>
                        <button
                            type="button"
                            onClick={onVoltar}
                            className="inline-flex h-7 items-center border border-ink/25 px-2 font-semibold text-ink hover:bg-ink/5"
                        >
                            Sair sem salvar
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmarDescarte(false)}
                            className="font-semibold text-muted-foreground hover:text-ink"
                        >
                            Continuar editando
                        </button>
                    </span>
                )}
            </div>

            {/* Cabeçalho */}
            <header className="flex flex-wrap items-start justify-between gap-4 border border-ink/15 bg-card p-5 sm:p-6">
                <div className="flex min-w-0 items-start gap-4">
                    <span
                        aria-hidden
                        className="inline-flex size-14 shrink-0 items-center justify-center bg-ink text-lg font-semibold tracking-wide text-paper"
                    >
                        {cliente ? iniciais(cliente.nome) : <UserRound className="size-6" />}
                    </span>
                    <div className="min-w-0 space-y-1.5">
                        <h2 className="text-xl font-semibold leading-tight text-ink sm:text-2xl">
                            {cliente ? cliente.nome : "Novo cliente"}
                        </h2>
                        {meta.length > 0 && (
                            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                {meta.map(({ Icone, texto }) => (
                                    <li key={texto} className="inline-flex items-center gap-1.5 tabular-nums">
                                        <Icone aria-hidden className="size-3.5 shrink-0" />
                                        {texto}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {cliente && (
                            <p
                                className={cn(
                                    "text-xs font-semibold",
                                    pendencias.length ? "text-gold-deep" : "text-emerald-700",
                                )}
                            >
                                {pendencias.length ? `Cadastro incompleto: falta ${pendencias.join(", ")}` : "Cadastro completo"}
                            </p>
                        )}
                    </div>
                </div>
                {cliente && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setConfirmarExclusao(true)}
                            aria-label="Excluir cadastro"
                            title="Excluir cadastro"
                            className={cn(botaoSecundario, "w-9 justify-center px-0 hover:text-destructive")}
                        >
                            <Trash2 className="size-4" />
                        </button>
                        <ModalConfirmarExclusao
                            aberto={confirmarExclusao}
                            titulo="Excluir cliente"
                            fraseConfirmacao={cliente.nome}
                            rotuloBotao="Excluir este cliente"
                            excluindo={excluindo}
                            onConfirmar={() => void excluir()}
                            onCancelar={fecharConfirmacao}
                        >
                            <p>
                                O cadastro de <strong>{cliente.nome}</strong> e a base do atendimento por IA dele vão ser
                                apagados.
                                {casos.length > 0 &&
                                    ` ${casos.length === 1 ? "O caso ligado continua" : `Os ${casos.length} casos ligados continuam`} na carteira, só sem o cliente.`}
                            </p>
                        </ModalConfirmarExclusao>
                        <button
                            type="button"
                            onClick={() => onGerarDocumento(cliente.id)}
                            className="inline-flex h-9 items-center gap-1.5 bg-gold px-3.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-gold-light"
                        >
                            <FilePlus2 className="size-4" />
                            Gerar documento
                        </button>
                    </div>
                )}
            </header>

            {!cliente ? (
                <div className="max-w-4xl border border-ink/15 bg-card">{formulario}</div>
            ) : (
                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
                    {/* Coluna principal: cadastro e base da IA */}
                    <div className="min-w-0 border border-ink/15 bg-card">
                        <div role="tablist" aria-label="Seções do cliente" className="flex gap-6 border-b border-ink/15 px-5 sm:px-6">
                            {(
                                [
                                    { id: "cadastro", rotulo: "Dados do cadastro", total: null },
                                    { id: "base", rotulo: "Base do atendimento por IA", total: totalBase },
                                ] as const
                            ).map((a) => (
                                <button
                                    key={a.id}
                                    type="button"
                                    role="tab"
                                    id={`cliente-aba-${a.id}`}
                                    aria-controls={`cliente-painel-${a.id}`}
                                    aria-selected={aba === a.id}
                                    onClick={() => setAba(a.id)}
                                    className={cn(
                                        "-mb-px inline-flex h-12 shrink-0 items-center gap-1.5 border-b-2 text-sm font-semibold transition-colors duration-150",
                                        aba === a.id
                                            ? "border-ink text-ink"
                                            : "border-transparent text-muted-foreground hover:text-ink",
                                    )}
                                >
                                    {a.rotulo}
                                    {a.total !== null && (
                                        <span
                                            className={cn(
                                                "inline-flex h-5 min-w-5 items-center justify-center px-1 text-[10.5px] tabular-nums",
                                                aba === a.id ? "bg-ink text-paper" : "bg-secondary text-muted-foreground",
                                            )}
                                        >
                                            {a.total}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div
                            id="cliente-painel-cadastro"
                            role="tabpanel"
                            aria-labelledby="cliente-aba-cadastro"
                            hidden={aba !== "cadastro"}
                        >
                            {formulario}
                        </div>
                        <div
                            id="cliente-painel-base"
                            role="tabpanel"
                            aria-labelledby="cliente-aba-base"
                            hidden={aba !== "base"}
                            className="p-5 sm:p-6"
                        >
                            <BaseConhecimentoCliente
                                clienteId={cliente.id}
                                nomeCliente={cliente.nome}
                                onTotalChange={setTotalBase}
                            />
                        </div>
                    </div>

                    {/* Lateral: casos e qualificação */}
                    <aside className="space-y-5">
                        <Cartao
                            titulo={
                                <>
                                    Casos na carteira <span className="font-normal text-muted-foreground">({casos.length})</span>
                                </>
                            }
                        >
                            <div className="space-y-4">
                                {casos.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Nenhum caso ligado a este cliente.</p>
                                ) : (
                                    <ul className="-mx-4 -mt-4 divide-y divide-ink/10">
                                        {casos.map((c) => (
                                            <li key={c.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => onAbrirCaso(c)}
                                                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-ink/[0.03]"
                                                >
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-semibold tabular-nums text-ink">
                                                            {c.processo_global || "Sem número de processo"}
                                                        </span>
                                                        <span className="block truncate text-xs text-muted-foreground">
                                                            {[c.banco, c.modalidade_nome].filter(Boolean).join(" · ") || "—"}
                                                        </span>
                                                    </span>
                                                    <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {outrosCasos.length > 0 && (
                                    <div className={cn("space-y-1.5", casos.length > 0 && "border-t border-ink/10 pt-4")}>
                                        <label htmlFor="cli-vincular" className="sys-label block">
                                            Ligar outro caso (nome digitado diferente)
                                        </label>
                                        <div className="flex items-end gap-2">
                                            <select
                                                id="cli-vincular"
                                                value={casoParaVincular}
                                                onChange={(e) => setCasoParaVincular(e.target.value)}
                                                className={cn(classeInput, "min-w-0 flex-1")}
                                            >
                                                <option value="">Escolha o caso</option>
                                                {outrosCasos.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.cliente_nome}
                                                        {c.processo_global ? ` · ${c.processo_global}` : ""}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                disabled={!casoParaVincular}
                                                onClick={() => void vincularCaso()}
                                                className="inline-flex h-8 shrink-0 items-center border border-ink/25 px-3 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-40"
                                            >
                                                Ligar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Cartao>

                        <Cartao
                            titulo="Qualificação para a petição"
                            acao={
                                <button
                                    type="button"
                                    onClick={() => void copiarQualificacao()}
                                    className="inline-flex h-7 items-center gap-1 border border-ink/20 px-2 text-xs font-semibold text-ink hover:bg-ink/5"
                                >
                                    <ClipboardCopy className="size-3.5" /> Copiar
                                </button>
                            }
                        >
                            <p className="font-serif text-sm leading-relaxed text-ink">
                                {form.nome.trim() ? qualificacao : "Preencha o nome para ver a qualificação."}
                            </p>
                            <p className="mt-3 text-[11px] text-muted-foreground">
                                Nos modelos de documento, use o campo{" "}
                                <strong className="text-ink">[qualificação completa]</strong>.
                            </p>
                        </Cartao>
                    </aside>
                </div>
            )}
        </div>
    );
}
