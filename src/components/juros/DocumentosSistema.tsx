import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    ClipboardCopy,
    CopyPlus,
    FilePlus2,
    FileText,
    FileType2,
    Loader2,
    Pencil,
    Printer,
    RefreshCw,
    Search,
    Trash2,
    UserRound,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EditorDocumento } from "@/components/juros/EditorDocumento";
import {
    CONFIG_PAGINA_PADRAO,
    acharCampoConhecido,
    escaparHtml,
    estiloPaginaDocumento,
    extrairCampos,
    htmlParaTextoSimples,
    montarArquivoWord,
    nomeArquivoDocumento,
    normalizarChaveCampo,
    normalizarConfigPagina,
    preencherModelo,
    sanitizarHtmlDocumento,
    valoresIniciaisCampos,
    type ConfigPagina,
} from "@/lib/documentos";
import {
    atualizarDocumento,
    atualizarModelo,
    criarDocumento,
    criarModelo,
    excluirDocumento,
    excluirModelo,
    isTabelaTarefasAusente,
    listarDocumentos,
    listarClientes,
    listarModelos,
    type CalculoSalvo,
    type Cliente,
    type DocumentoGerado,
    type ModeloDocumento,
} from "@/lib/revisional-db";
import { useTravarRolagem } from "@/lib/use-travar-rolagem";
import { usePaginacao } from "@/lib/use-paginacao";
import { BarraPaginacao } from "@/components/juros/PaginacaoLista";
import { formatarCpfCnpj, pendenciasCadastro } from "@/lib/clientes";

/* ------------------------------------------------------- Exportação */

function baixarWord(titulo: string, html: string, pagina: ConfigPagina) {
    // BOM: faz o Word reconhecer o arquivo como UTF-8 (acentos).
    const blob = new Blob(["\ufeff", montarArquivoWord(titulo, html, pagina)], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeArquivoDocumento(titulo)}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function imprimirDocumento(titulo: string, html: string, pagina: ConfigPagina) {
    const htmlSeguro = sanitizarHtmlDocumento(html);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    // Sem allow-scripts: bloqueia execução de JS no iframe mesmo em navegadores/ambientes sem CSP.
    iframe.setAttribute("sandbox", "allow-same-origin allow-modals");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
        iframe.remove();
        toast.error("Não foi possível abrir a impressão neste navegador.");
        return;
    }
    doc.open();
    doc.write(
        `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><title>${escaparHtml(titulo)}</title><style>${estiloPaginaDocumento(pagina)}</style></head><body>${htmlSeguro}</body></html>`,
    );
    doc.close();
    const remover = () => setTimeout(() => iframe.remove(), 500);
    win.addEventListener("afterprint", remover, { once: true });
    setTimeout(() => {
        win.focus();
        win.print();
        // Safari não dispara afterprint de forma confiável.
        setTimeout(() => iframe.isConnected && iframe.remove(), 60_000);
    }, 150);
}

async function copiarDocumento(html: string) {
    const htmlSeguro = sanitizarHtmlDocumento(html);
    const texto = htmlParaTextoSimples(htmlSeguro);
    try {
        if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([htmlSeguro], { type: "text/html" }),
                    "text/plain": new Blob([texto], { type: "text/plain" }),
                }),
            ]);
        } else {
            await navigator.clipboard.writeText(texto);
        }
        toast.success("Texto copiado. É só colar no PJe, no Word ou no WhatsApp.");
    } catch {
        toast.error("O navegador não deixou copiar. Selecione o texto e use Ctrl+C.");
    }
}

function contarCamposPendentes(html: string): number {
    return extrairCampos(html).length;
}

function formatarDataHora(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ------------------------------------------------------- Painel "Gerar documento" */

interface AlvoGerar {
    modeloId: string | null;
    clienteId: string | null;
    calculoId: string | null;
}

function PainelGerarDocumento({
    alvo,
    modelos,
    clientes,
    calculos,
    onFechar,
    onGerado,
}: {
    alvo: AlvoGerar | null;
    modelos: ModeloDocumento[];
    clientes: Cliente[];
    calculos: CalculoSalvo[];
    onFechar: () => void;
    onGerado: (doc: DocumentoGerado) => void;
}) {
    useTravarRolagem(Boolean(alvo));
    const [modeloId, setModeloId] = useState<string>("");
    const [clienteId, setClienteId] = useState<string>("");
    const [calculoId, setCalculoId] = useState<string>("");
    const [buscaCliente, setBuscaCliente] = useState("");
    const [valores, setValores] = useState<Record<string, string>>({});
    const [titulo, setTitulo] = useState("");
    const [tituloEditado, setTituloEditado] = useState(false);
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        if (!alvo) return;
        setModeloId(alvo.modeloId ?? modelos[0]?.id ?? "");
        const casoInicial = alvo.calculoId ? calculos.find((c) => c.id === alvo.calculoId) : null;
        setClienteId(alvo.clienteId ?? casoInicial?.cliente_id ?? "");
        setCalculoId(alvo.calculoId ?? "");
        setBuscaCliente("");
        setTituloEditado(false);
        // Só ao abrir o painel.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [alvo]);

    const modelo = modelos.find((m) => m.id === modeloId) ?? null;
    const cliente = clientes.find((c) => c.id === clienteId) ?? null;
    const casosDoCliente = useMemo(
        () => (cliente ? calculos.filter((c) => c.cliente_id === cliente.id) : []),
        [calculos, cliente],
    );
    const calculo = casosDoCliente.find((c) => c.id === calculoId) ?? null;
    const campos = useMemo(() => (modelo ? extrairCampos(modelo.conteudo_html) : []), [modelo]);

    // Cliente com um caso só: já escolhe o caso.
    useEffect(() => {
        if (!alvo || !cliente) return;
        if (calculoId && casosDoCliente.some((c) => c.id === calculoId)) return;
        setCalculoId(casosDoCliente.length === 1 ? casosDoCliente[0].id : "");
    }, [alvo, cliente, casosDoCliente, calculoId]);

    // Troca de modelo, cliente ou caso: recalcula o que vem do cadastro.
    useEffect(() => {
        if (!alvo) return;
        setValores(valoresIniciaisCampos(campos, { cliente, calculo, hoje: new Date() }));
    }, [alvo, campos, cliente, calculo]);

    useEffect(() => {
        if (!alvo || tituloEditado) return;
        const base = modelo?.nome ?? "Documento";
        setTitulo(cliente ? `${base} — ${cliente.nome}` : base);
    }, [alvo, modelo, cliente, tituloEditado]);

    const clientesFiltrados = useMemo(() => {
        const q = normalizarChaveCampo(buscaCliente);
        const digitos = buscaCliente.replace(/\D+/g, "");
        const lista = q
            ? clientes.filter(
                  (c) =>
                      normalizarChaveCampo(c.nome).includes(q) ||
                      (digitos.length >= 3 && c.cpf_cnpj.includes(digitos)),
              )
            : clientes;
        return lista.slice(0, 40);
    }, [clientes, buscaCliente]);

    useEffect(() => {
        if (!alvo) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onFechar();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [alvo, onFechar]);

    if (!alvo) return null;

    const emBranco = campos.filter((r) => !(valores[normalizarChaveCampo(r)] ?? "").trim()).length;

    const gerar = async (e: FormEvent) => {
        e.preventDefault();
        setSalvando(true);
        try {
            const html = modelo ? preencherModelo(modelo.conteudo_html, valores) : "";
            const doc = await criarDocumento({
                titulo: titulo.trim() || "Documento",
                calculo_id: calculo?.id ?? null,
                cliente_id: cliente?.id ?? null,
                modelo_id: modelo?.id ?? null,
                conteudo_html: html,
                pagina: modelo ? normalizarConfigPagina(modelo.pagina) : CONFIG_PAGINA_PADRAO,
            });
            onGerado(doc);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível gerar o documento.");
        } finally {
            setSalvando(false);
        }
    };

    const pendencias = cliente ? pendenciasCadastro(cliente) : [];

    return createPortal(
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-gerar-doc" className="fixed inset-0 z-50 flex justify-end">
            <div aria-hidden onClick={onFechar} className="fixed inset-0 bg-ink-deep/45" />
            <div className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-ink/20 bg-card shadow-2xl">
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-ink/15 px-5">
                    <h2 id="titulo-gerar-doc" className="sys-title text-ink">
                        Gerar documento
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

                <form onSubmit={gerar} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-6 overflow-y-auto p-5">
                        <div>
                            <label htmlFor="gerar-modelo" className="sys-label block text-ink">
                                1. Modelo
                            </label>
                            <select
                                id="gerar-modelo"
                                value={modeloId}
                                onChange={(e) => setModeloId(e.target.value)}
                                className="field py-2 text-sm"
                            >
                                <option value="">Documento em branco</option>
                                {modelos.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.nome}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <p className="sys-label text-ink">2. Cliente</p>
                            {cliente ? (
                                <div className="mt-2 space-y-2">
                                    <div className="flex items-start justify-between gap-3 border border-ink/15 bg-secondary/50 px-3 py-2.5">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-ink">{cliente.nome}</p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {cliente.cpf_cnpj
                                                    ? formatarCpfCnpj(cliente.cpf_cnpj)
                                                    : cliente.tipo_pessoa === "pj"
                                                      ? "Sem CNPJ cadastrado"
                                                      : "Sem CPF cadastrado"}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setClienteId("");
                                                setCalculoId("");
                                            }}
                                            className="shrink-0 text-xs font-semibold text-ink underline-offset-2 hover:underline"
                                        >
                                            Trocar
                                        </button>
                                    </div>
                                    {pendencias.length > 0 && (
                                        <p className="text-[11px] text-gold-deep">
                                            Cadastro sem {pendencias.join(", ")}. Complete em Clientes para não precisar
                                            digitar aqui.
                                        </p>
                                    )}
                                    <div>
                                        <label htmlFor="gerar-caso" className="text-[11px] font-semibold text-ink">
                                            Processo / caso
                                        </label>
                                        <select
                                            id="gerar-caso"
                                            value={calculoId}
                                            onChange={(e) => setCalculoId(e.target.value)}
                                            className="field py-1.5 text-sm"
                                        >
                                            <option value="">
                                                {casosDoCliente.length === 0 ? "Nenhum caso na carteira" : "Sem processo"}
                                            </option>
                                            {casosDoCliente.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {[c.processo_global || "Sem número", c.banco].filter(Boolean).join(" · ")}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-1">
                                    <div className="relative">
                                        <Search
                                            aria-hidden
                                            className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                        />
                                        <input
                                            value={buscaCliente}
                                            onChange={(e) => setBuscaCliente(e.target.value)}
                                            placeholder="Buscar por nome ou CPF"
                                            aria-label="Buscar cliente"
                                            className="field py-2 pl-6 text-sm"
                                        />
                                    </div>
                                    <ul className="mt-2 max-h-52 overflow-y-auto border border-ink/15">
                                        {clientesFiltrados.length === 0 && (
                                            <li className="px-3 py-3 text-xs text-muted-foreground">Nenhum cliente encontrado.</li>
                                        )}
                                        {clientesFiltrados.map((c) => {
                                            const qtd = calculos.filter((k) => k.cliente_id === c.id).length;
                                            return (
                                                <li key={c.id} className="border-b border-ink/10 last:border-b-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setClienteId(c.id)}
                                                        className="block w-full px-3 py-2 text-left hover:bg-ink/[0.04]"
                                                    >
                                                        <span className="block truncate text-sm font-medium text-ink">{c.nome}</span>
                                                        <span className="block truncate text-[11px] text-muted-foreground">
                                                            {[
                                                                c.cpf_cnpj ? formatarCpfCnpj(c.cpf_cnpj) : "",
                                                                `${qtd} ${qtd === 1 ? "caso" : "casos"}`,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(" · ")}
                                                        </span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                                        Sem cliente, os campos ficam para preencher à mão abaixo.
                                    </p>
                                </div>
                            )}
                        </div>

                        {campos.length > 0 && (
                            <div>
                                <p className="sys-label text-ink">3. Confira os campos</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    O que veio do cadastro já está preenchido. Pode corrigir aqui; campo em branco fica
                                    destacado no documento para preencher depois.
                                </p>
                                <div className="mt-3 space-y-3">
                                    {campos.map((rotulo) => {
                                        const chave = normalizarChaveCampo(rotulo);
                                        const conhecido = Boolean(acharCampoConhecido(rotulo));
                                        const valor = valores[chave] ?? "";
                                        return (
                                            <div key={chave}>
                                                <label
                                                    htmlFor={`campo-${chave}`}
                                                    className="flex items-center justify-between gap-2 text-xs font-medium text-ink"
                                                >
                                                    <span>[{rotulo}]</span>
                                                    {conhecido && valor ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                                                            <Check aria-hidden className="size-3" /> do cadastro
                                                        </span>
                                                    ) : !valor ? (
                                                        <span className="text-[10px] font-semibold text-gold-deep">a preencher</span>
                                                    ) : null}
                                                </label>
                                                <input
                                                    id={`campo-${chave}`}
                                                    value={valor}
                                                    onChange={(e) => setValores((v) => ({ ...v, [chave]: e.target.value }))}
                                                    className="field py-1.5 text-sm"
                                                    placeholder="Em branco"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div>
                            <label htmlFor="gerar-titulo" className="sys-label block text-ink">
                                {campos.length > 0 ? "4." : "3."} Título do documento
                            </label>
                            <input
                                id="gerar-titulo"
                                value={titulo}
                                onChange={(e) => {
                                    setTitulo(e.target.value);
                                    setTituloEditado(true);
                                }}
                                maxLength={200}
                                className="field py-2 text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-ink/15 px-5 py-3">
                        <p className="text-[11px] text-muted-foreground">
                            {emBranco > 0
                                ? `${emBranco} ${emBranco === 1 ? "campo ficará" : "campos ficarão"} destacado${emBranco === 1 ? "" : "s"}`
                                : campos.length > 0
                                  ? "Todos os campos preenchidos"
                                  : ""}
                        </p>
                        <button
                            type="submit"
                            disabled={salvando}
                            className="inline-flex h-9 items-center gap-1.5 bg-gold px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-gold-light disabled:opacity-60"
                        >
                            {salvando ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
                            Gerar e abrir
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}

/* ------------------------------------------------------- Tela de edição */

type ItemEmEdicao =
    | { tipo: "modelo"; registro: ModeloDocumento }
    | { tipo: "documento"; registro: DocumentoGerado };

type StatusSalvo = "salvo" | "pendente" | "salvando" | "erro";

function TelaEdicao({
    item,
    nomeCliente,
    calculos,
    modelos,
    onVoltar,
    onSalvo,
    onGerarComModelo,
}: {
    item: ItemEmEdicao;
    nomeCliente: string | null;
    calculos: CalculoSalvo[];
    modelos: ModeloDocumento[];
    onVoltar: () => void;
    onSalvo: (item: ItemEmEdicao) => void;
    onGerarComModelo: (modeloId: string) => void;
}) {
    const ehModelo = item.tipo === "modelo";
    const [titulo, setTitulo] = useState(ehModelo ? item.registro.nome : item.registro.titulo);
    const [descricao, setDescricao] = useState(ehModelo ? item.registro.descricao : "");
    const [html, setHtml] = useState(item.registro.conteudo_html);
    const [pagina, setPagina] = useState<ConfigPagina>(() => normalizarConfigPagina(item.registro.pagina));
    const [status, setStatus] = useState<StatusSalvo>("salvo");

    const pendenteRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ultimoRef = useRef({ titulo, descricao, html, pagina });
    ultimoRef.current = { titulo, descricao, html, pagina };
    const itemRef = useRef(item);
    itemRef.current = item;
    const onSalvoRef = useRef(onSalvo);
    onSalvoRef.current = onSalvo;

    const montadoRef = useRef(true);
    const salvandoEmVooRef = useRef(false);

    useEffect(() => {
        montadoRef.current = true;
        return () => {
            montadoRef.current = false;
        };
    }, []);

    const salvarAgora = useCallback(async () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (!pendenteRef.current || salvandoEmVooRef.current) return;
        salvandoEmVooRef.current = true;
        try {
            while (pendenteRef.current) {
                pendenteRef.current = false;
                const { titulo: t, descricao: d, html: h, pagina: pg } = ultimoRef.current;
                const atual = itemRef.current;
                if (montadoRef.current) setStatus("salvando");
                try {
                    if (atual.tipo === "modelo") {
                        const reg = await atualizarModelo(atual.registro.id, {
                            nome: t.trim() || "Modelo sem nome",
                            descricao: d,
                            conteudo_html: h,
                            pagina: pg,
                        });
                        if (montadoRef.current) onSalvoRef.current({ tipo: "modelo", registro: reg });
                    } else {
                        const reg = await atualizarDocumento(atual.registro.id, {
                            titulo: t.trim() || "Documento sem título",
                            conteudo_html: h,
                            pagina: pg,
                        });
                        if (montadoRef.current) onSalvoRef.current({ tipo: "documento", registro: reg });
                    }
                    if (montadoRef.current && !pendenteRef.current) setStatus("salvo");
                } catch (err) {
                    pendenteRef.current = true;
                    if (montadoRef.current) {
                        setStatus("erro");
                        toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
                    }
                    break;
                }
            }
        } finally {
            salvandoEmVooRef.current = false;
        }
    }, []);

    const agendarSalvamento = useCallback(() => {
        pendenteRef.current = true;
        setStatus("pendente");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void salvarAgora(), 1200);
    }, [salvarAgora]);

    // Sai da tela (voltar, trocar de aba) com alteração pendente: salva antes.
    useEffect(() => {
        const antesDeSair = (e: BeforeUnloadEvent) => {
            if (pendenteRef.current) {
                void salvarAgora();
                e.preventDefault();
            }
        };
        window.addEventListener("beforeunload", antesDeSair);
        return () => {
            window.removeEventListener("beforeunload", antesDeSair);
            void salvarAgora();
        };
    }, [salvarAgora]);

    const calculo = !ehModelo && item.registro.calculo_id ? calculos.find((c) => c.id === item.registro.calculo_id) : null;
    const modeloOrigem =
        !ehModelo && item.registro.modelo_id ? modelos.find((m) => m.id === item.registro.modelo_id) : null;
    const pendentes = ehModelo ? 0 : contarCamposPendentes(html);
    const camposModelo = ehModelo ? extrairCampos(html) : [];
    const tituloExport = titulo.trim() || (ehModelo ? "Modelo" : "Documento");

    const avisarPendentes = () => {
        if (pendentes > 0) {
            toast.warning(
                `Ainda ${pendentes === 1 ? "há 1 campo" : `há ${pendentes} campos`} entre colchetes sem preencher.`,
            );
        }
    };

    const rotuloStatus: Record<StatusSalvo, string> = {
        salvo: "Salvo",
        pendente: "Alterações não salvas",
        salvando: "Salvando…",
        erro: "Erro ao salvar",
    };

    const botaoAcao =
        "inline-flex h-9 items-center gap-1.5 border border-ink/25 bg-card px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5";

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={() => {
                            void salvarAgora();
                            onVoltar();
                        }}
                        className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-ink"
                    >
                        <ArrowLeft className="size-3.5" />
                        {ehModelo ? "Modelos" : "Documentos"}
                    </button>
                    <input
                        value={titulo}
                        onChange={(e) => {
                            setTitulo(e.target.value);
                            agendarSalvamento();
                        }}
                        onBlur={() => void salvarAgora()}
                        maxLength={ehModelo ? 160 : 200}
                        aria-label={ehModelo ? "Nome do modelo" : "Título do documento"}
                        className="w-full border-0 border-b border-transparent bg-transparent px-0 py-1 text-xl font-semibold tracking-tight text-ink hover:border-ink/20 focus:border-ink focus:outline-none"
                    />
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 font-medium",
                                status === "erro" && "text-destructive",
                                status === "salvo" && "text-emerald-700",
                            )}
                            aria-live="polite"
                        >
                            {status === "salvando" ? (
                                <Loader2 className="size-3 animate-spin" />
                            ) : status === "salvo" ? (
                                <Check className="size-3" />
                            ) : null}
                            {rotuloStatus[status]}
                        </span>
                        {ehModelo ? (
                            <span>
                                {camposModelo.length} {camposModelo.length === 1 ? "campo" : "campos"} no modelo
                            </span>
                        ) : (
                            <>
                                {(nomeCliente || calculo) && (
                                    <span className="inline-flex items-center gap-1">
                                        <UserRound className="size-3" /> {nomeCliente ?? calculo?.cliente_nome}
                                    </span>
                                )}
                                {modeloOrigem && <span>Modelo: {modeloOrigem.nome}</span>}
                                {pendentes > 0 && (
                                    <span className="font-semibold text-destructive">
                                        {pendentes} {pendentes === 1 ? "campo" : "campos"} sem preencher
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {ehModelo && (
                        <button
                            type="button"
                            onClick={() => {
                                void salvarAgora().then(() => onGerarComModelo(item.registro.id));
                            }}
                            className="inline-flex h-9 items-center gap-1.5 bg-gold px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-gold-light"
                        >
                            <FilePlus2 className="size-3.5" />
                            Gerar documento
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            avisarPendentes();
                            baixarWord(tituloExport, html, pagina);
                        }}
                        className={botaoAcao}
                    >
                        <FileType2 className="size-3.5" />
                        Word
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            avisarPendentes();
                            imprimirDocumento(tituloExport, html, pagina);
                        }}
                        className={botaoAcao}
                        title="Imprimir ou salvar em PDF"
                    >
                        <Printer className="size-3.5" />
                        PDF / Imprimir
                    </button>
                    <button type="button" onClick={() => void copiarDocumento(html)} className={botaoAcao}>
                        <ClipboardCopy className="size-3.5" />
                        Copiar
                    </button>
                </div>
            </div>

            {ehModelo && (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <div className="flex-1">
                        <label htmlFor="modelo-descricao" className="sys-label block">
                            Descrição (opcional)
                        </label>
                        <input
                            id="modelo-descricao"
                            value={descricao}
                            onChange={(e) => {
                                setDescricao(e.target.value);
                                agendarSalvamento();
                            }}
                            onBlur={() => void salvarAgora()}
                            maxLength={500}
                            placeholder="Ex.: usar quando o juiz designar audiência de conciliação"
                            className="field py-1.5 text-sm"
                        />
                    </div>
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground lg:pb-2">
                        <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden className="campo-doc px-1 text-ink">
                                [campo]
                            </span>
                            vem do cadastro
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden className="campo-doc campo-doc--manual px-1 text-ink">
                                [campo]
                            </span>
                            perguntado ao gerar
                        </span>
                    </p>
                </div>
            )}

            <EditorDocumento
                chave={item.registro.id}
                modo={item.tipo}
                conteudoInicial={item.registro.conteudo_html}
                pagina={pagina}
                onPaginaChange={(nova) => {
                    setPagina(nova);
                    agendarSalvamento();
                }}
                onChange={(novo) => {
                    setHtml(novo);
                    agendarSalvamento();
                }}
            />
        </div>
    );
}

/* ------------------------------------------------------- Tela principal */

interface DocumentosSistemaProps {
    calculos: CalculoSalvo[];
}

export const DocumentosSistema = ({ calculos }: DocumentosSistemaProps) => {
    const [params, setParams] = useSearchParams();
    const [modelos, setModelos] = useState<ModeloDocumento[]>([]);
    const [documentos, setDocumentos] = useState<DocumentoGerado[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [indisponivel, setIndisponivel] = useState(false);
    const [busca, setBusca] = useState("");
    const [alvoGerar, setAlvoGerar] = useState<AlvoGerar | null>(null);
    const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null);
    const [criandoModelo, setCriandoModelo] = useState(false);

    const docId = params.get("doc");
    const modeloEditId = params.get("modelo");
    const abaLista: "documentos" | "modelos" = params.get("aba") === "modelos" ? "modelos" : "documentos";

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            const [ms, ds] = await Promise.all([listarModelos(), listarDocumentos()]);
            setModelos(ms);
            setDocumentos(ds);
            // Clientes: se a migração de clientes ainda não rodou, segue sem eles (busca pelos casos).
            setClientes(await listarClientes().catch(() => []));
            setIndisponivel(false);
        } catch (err) {
            if (isTabelaTarefasAusente(err)) setIndisponivel(true);
            else toast.error(err instanceof Error ? err.message : "Não foi possível carregar os documentos.");
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        void carregar();
    }, [carregar]);

    // Atalho vindo de outras telas: ?gerar=1&clienteId=<id>&caso=<id do cálculo>&modeloId=<id>
    useEffect(() => {
        if (params.get("gerar") !== "1" || carregando) return;
        setAlvoGerar({
            modeloId: params.get("modeloId"),
            clienteId: params.get("clienteId"),
            calculoId: params.get("caso"),
        });
        const p = new URLSearchParams(params);
        p.delete("gerar");
        p.delete("clienteId");
        p.delete("caso");
        p.delete("modeloId");
        setParams(p, { replace: true });
    }, [params, carregando, setParams]);

    const irPara = (novo: Record<string, string | null>) => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(novo)) if (v) p.set(k, v);
        setParams(p);
        window.scrollTo({ top: 0 });
    };

    const nomePorCalculo = useMemo(() => new Map(calculos.map((c) => [c.id, c.cliente_nome])), [calculos]);
    const nomePorCliente = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);
    const nomeClienteDoc = (d: DocumentoGerado) =>
        (d.cliente_id ? nomePorCliente.get(d.cliente_id) : undefined) ??
        (d.calculo_id ? nomePorCalculo.get(d.calculo_id) : undefined) ??
        null;
    const nomePorModelo = useMemo(() => new Map(modelos.map((m) => [m.id, m.nome])), [modelos]);

    const itemEdicao: ItemEmEdicao | null = useMemo(() => {
        if (docId) {
            const d = documentos.find((x) => x.id === docId);
            return d ? { tipo: "documento", registro: d } : null;
        }
        if (modeloEditId) {
            const m = modelos.find((x) => x.id === modeloEditId);
            return m ? { tipo: "modelo", registro: m } : null;
        }
        return null;
        // O registro só é lido ao abrir: o editor é recriado apenas quando o id muda.
    }, [docId, modeloEditId, documentos, modelos]);

    const aoSalvar = useCallback((salvo: ItemEmEdicao) => {
        if (salvo.tipo === "modelo") {
            setModelos((prev) =>
                prev.map((m) => (m.id === salvo.registro.id ? salvo.registro : m)).sort((a, b) => a.nome.localeCompare(b.nome)),
            );
        } else {
            setDocumentos((prev) => [salvo.registro, ...prev.filter((d) => d.id !== salvo.registro.id)]);
        }
    }, []);

    const novoModelo = async (base?: ModeloDocumento) => {
        setCriandoModelo(true);
        try {
            const m = await criarModelo({
                nome: base ? `${base.nome} (cópia)` : "Novo modelo",
                descricao: base?.descricao ?? "",
                conteudo_html: base?.conteudo_html ?? "",
                pagina: base ? normalizarConfigPagina(base.pagina) : CONFIG_PAGINA_PADRAO,
            });
            setModelos((prev) => [...prev, m].sort((a, b) => a.nome.localeCompare(b.nome)));
            irPara({ modelo: m.id });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível criar o modelo.");
        } finally {
            setCriandoModelo(false);
        }
    };

    const excluir = async (tipo: "modelo" | "documento", id: string) => {
        try {
            if (tipo === "modelo") {
                await excluirModelo(id);
                setModelos((prev) => prev.filter((m) => m.id !== id));
                toast.success("Modelo excluído.");
            } else {
                await excluirDocumento(id);
                setDocumentos((prev) => prev.filter((d) => d.id !== id));
                toast.success("Documento excluído.");
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
        } finally {
            setConfirmarExclusao(null);
        }
    };

    const q = normalizarChaveCampo(busca);
    const docsFiltrados = useMemo(
        () =>
            q
                ? documentos.filter((d) =>
                      normalizarChaveCampo(
                          `${d.titulo} ${nomeClienteDoc(d) ?? ""} ${nomePorModelo.get(d.modelo_id ?? "") ?? ""}`,
                      ).includes(q),
                  )
                : documentos,
        // nomeClienteDoc depende só dos mapas abaixo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [q, documentos, nomePorCliente, nomePorCalculo, nomePorModelo],
    );
    const modelosFiltrados = useMemo(
        () => (q ? modelos.filter((m) => normalizarChaveCampo(`${m.nome} ${m.descricao}`).includes(q)) : modelos),
        [q, modelos],
    );
    const listaRef = useRef<HTMLDivElement>(null);
    const pagDocs = usePaginacao(docsFiltrados, { porPaginaPadrao: 20, reiniciarCom: [q, abaLista] });
    const pagModelos = usePaginacao(modelosFiltrados, { porPaginaPadrao: 12, reiniciarCom: [q, abaLista] });

    const painelGerar = (
        <PainelGerarDocumento
            alvo={alvoGerar}
            modelos={modelos}
            clientes={clientes}
            calculos={calculos}
            onFechar={() => setAlvoGerar(null)}
            onGerado={(doc) => {
                setDocumentos((prev) => [doc, ...prev]);
                setAlvoGerar(null);
                irPara({ doc: doc.id });
                toast.success("Documento gerado. Revise e baixe em Word ou PDF.");
            }}
        />
    );

    if (indisponivel) {
        return (
            <div className="border border-ink/20 bg-card p-6 sm:p-8">
                <div className="flex items-start gap-3">
                    <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-deep" />
                    <div className="space-y-2">
                        <h2 className="sys-section text-ink">Os documentos precisam da migração do banco</h2>
                        <p className="max-w-xl text-sm text-muted-foreground">
                            As tabelas <code className="bg-secondary px-1 py-0.5 text-xs">revisional_modelos</code> e{" "}
                            <code className="bg-secondary px-1 py-0.5 text-xs">revisional_documentos</code> ainda não existem
                            neste banco. Aplique a migração{" "}
                            <code className="bg-secondary px-1 py-0.5 text-xs">20261120120000_revisional_documentos.sql</code>{" "}
                            e tente novamente.
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

    if ((docId || modeloEditId) && carregando) {
        return (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Abrindo…
            </div>
        );
    }

    if (docId || modeloEditId) {
        if (!itemEdicao) {
            return (
                <div className="border border-ink/15 bg-card p-6 text-sm text-muted-foreground">
                    {docId ? "Documento não encontrado." : "Modelo não encontrado."}{" "}
                    <button
                        type="button"
                        onClick={() => irPara(modeloEditId ? { aba: "modelos" } : {})}
                        className="font-semibold text-ink underline"
                    >
                        Voltar
                    </button>
                </div>
            );
        }
        return (
            <>
                <TelaEdicao
                    key={itemEdicao.registro.id}
                    item={itemEdicao}
                    nomeCliente={itemEdicao.tipo === "documento" ? nomeClienteDoc(itemEdicao.registro) : null}
                    calculos={calculos}
                    modelos={modelos}
                    onVoltar={() => irPara(itemEdicao.tipo === "modelo" ? { aba: "modelos" } : {})}
                    onSalvo={aoSalvar}
                    onGerarComModelo={(id) => setAlvoGerar({ modeloId: id, clienteId: null, calculoId: null })}
                />
                {painelGerar}
            </>
        );
    }

    /* ---------- Listas */

    const linhaConfirmar = (tipo: "modelo" | "documento", id: string) => (
        <span className="inline-flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-destructive">Excluir?</span>
            <button
                type="button"
                onClick={() => void excluir(tipo, id)}
                className="inline-flex h-7 items-center bg-destructive px-2 text-[11px] font-semibold text-white"
            >
                Excluir
            </button>
            <button
                type="button"
                onClick={() => setConfirmarExclusao(null)}
                className="inline-flex h-7 items-center border border-ink/25 px-2 text-[11px] font-semibold text-ink"
            >
                Cancelar
            </button>
        </span>
    );

    const botaoIcone =
        "inline-flex size-8 items-center justify-center text-muted-foreground transition-colors duration-150 hover:bg-ink/[0.06] hover:text-ink";

    return (
        <div ref={listaRef} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                    role="tablist"
                    aria-label="Documentos ou modelos"
                    className="sys-grupo inline-flex border border-ink/25 bg-card"
                >
                    {(
                        [
                            { id: "documentos", rotulo: "Documentos", qtd: documentos.length },
                            { id: "modelos", rotulo: "Modelos", qtd: modelos.length },
                        ] as const
                    ).map((t, i) => (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={abaLista === t.id}
                            onClick={() => irPara(t.id === "modelos" ? { aba: "modelos" } : {})}
                            className={cn(
                                "inline-flex h-9 items-center gap-1.5 px-3.5 text-xs font-semibold transition-colors duration-150",
                                i > 0 && "border-l border-ink/20",
                                abaLista === t.id ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                            )}
                        >
                            {t.rotulo}
                            <span className={cn("tabular-nums", abaLista === t.id ? "text-paper/70" : "text-muted-foreground")}>
                                {t.qtd}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void novoModelo()}
                        disabled={criandoModelo}
                        className="inline-flex h-9 items-center gap-1.5 border border-ink/25 bg-card px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5 disabled:opacity-60"
                    >
                        {criandoModelo ? <Loader2 className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
                        Novo modelo
                    </button>
                    <button
                        type="button"
                        onClick={() => setAlvoGerar({ modeloId: null, clienteId: null, calculoId: null })}
                        className="inline-flex h-9 items-center gap-1.5 bg-gold px-3.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-gold-light"
                    >
                        <FilePlus2 className="size-3.5" />
                        Gerar documento
                    </button>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder={abaLista === "modelos" ? "Buscar modelo" : "Buscar por título, cliente ou modelo"}
                    aria-label="Buscar"
                    className="field py-2 pl-6 text-sm"
                />
            </div>

            {carregando ? (
                <div className="flex items-center gap-2 border border-ink/15 bg-card p-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Carregando…
                </div>
            ) : abaLista === "documentos" ? (
                docsFiltrados.length === 0 ? (
                    <div className="border border-ink/15 bg-card p-8 text-center">
                        <FileText aria-hidden className="mx-auto size-8 text-ink/30" />
                        <h2 className="sys-section mt-3 text-ink">
                            {busca ? "Nenhum documento encontrado" : "Nenhum documento gerado ainda"}
                        </h2>
                        {!busca && (
                            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                                Escolha um modelo e um cliente da carteira: o sistema preenche nome, processo, banco e
                                data sozinho, e você revisa no editor antes de baixar em Word ou PDF.
                            </p>
                        )}
                        {!busca && (
                            <button
                                type="button"
                                onClick={() => setAlvoGerar({ modeloId: null, clienteId: null, calculoId: null })}
                                className="mt-4 inline-flex h-9 items-center gap-1.5 bg-gold px-4 text-sm font-semibold text-ink hover:bg-gold-light"
                            >
                                <FilePlus2 className="size-4" />
                                Gerar o primeiro documento
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                    <ul className="divide-y divide-ink/10 border border-ink/15 bg-card">
                        {pagDocs.itensPagina.map((d) => {
                            const cliente = nomeClienteDoc(d);
                            const modelo = d.modelo_id ? nomePorModelo.get(d.modelo_id) : null;
                            const pendentes = contarCamposPendentes(d.conteudo_html);
                            return (
                                <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-ink/[0.02]">
                                    <button
                                        type="button"
                                        onClick={() => irPara({ doc: d.id })}
                                        className="min-w-0 flex-1 text-left"
                                    >
                                        <span className="block truncate text-sm font-semibold text-ink">{d.titulo}</span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {[cliente, modelo, `Editado em ${formatarDataHora(d.updated_at)}`]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </span>
                                    </button>
                                    {pendentes > 0 && (
                                        <span className="text-[11px] font-semibold text-destructive">
                                            {pendentes} {pendentes === 1 ? "campo" : "campos"} a preencher
                                        </span>
                                    )}
                                    {confirmarExclusao === d.id ? (
                                        linhaConfirmar("documento", d.id)
                                    ) : (
                                        <span className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={() => baixarWord(d.titulo, d.conteudo_html, normalizarConfigPagina(d.pagina))}
                                                className={botaoIcone}
                                                title="Baixar em Word"
                                                aria-label={`Baixar ${d.titulo} em Word`}
                                            >
                                                <FileType2 className="size-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    imprimirDocumento(d.titulo, d.conteudo_html, normalizarConfigPagina(d.pagina))
                                                }
                                                className={botaoIcone}
                                                title="Imprimir ou salvar em PDF"
                                                aria-label={`Imprimir ou salvar ${d.titulo} em PDF`}
                                            >
                                                <Printer className="size-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfirmarExclusao(d.id)}
                                                className={cn(botaoIcone, "hover:text-destructive")}
                                                title="Excluir"
                                                aria-label={`Excluir ${d.titulo}`}
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    <BarraPaginacao
                        pagina={pagDocs.pagina}
                        totalPaginas={pagDocs.totalPaginas}
                        total={pagDocs.total}
                        inicio={pagDocs.inicio}
                        fim={pagDocs.fim}
                        onPagina={pagDocs.irPara}
                        porPagina={pagDocs.porPagina}
                        onPorPagina={pagDocs.mudarPorPagina}
                        rotulo="documentos"
                        alvoRolagem={listaRef}
                    />
                    </div>
                )
            ) : modelosFiltrados.length === 0 ? (
                <div className="border border-ink/15 bg-card p-8 text-center">
                    <Pencil aria-hidden className="mx-auto size-8 text-ink/30" />
                    <h2 className="sys-section mt-3 text-ink">
                        {busca ? "Nenhum modelo encontrado" : "Nenhum modelo ainda"}
                    </h2>
                    {!busca && (
                        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                            Escreva a petição uma vez e marque entre colchetes o que muda de cliente para cliente, como
                            [nome do cliente] e [número do processo].
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {pagModelos.itensPagina.map((m) => {
                        const campos = extrairCampos(m.conteudo_html);
                        return (
                            <li key={m.id} className="flex flex-col border border-ink/15 bg-card">
                                <button
                                    type="button"
                                    onClick={() => irPara({ modelo: m.id })}
                                    className="flex-1 px-4 pb-3 pt-4 text-left hover:bg-ink/[0.02]"
                                >
                                    <span className="block text-sm font-semibold text-ink">{m.nome}</span>
                                    {m.descricao && (
                                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                                            {m.descricao}
                                        </span>
                                    )}
                                    <span className="mt-2.5 flex flex-wrap gap-1">
                                        {campos.slice(0, 5).map((c) => (
                                            <span
                                                key={c}
                                                className={cn(
                                                    "px-1.5 py-0.5 text-[10px] font-medium text-ink",
                                                    acharCampoConhecido(c) ? "bg-gold/25" : "border border-dashed border-gold-deep/70",
                                                )}
                                            >
                                                [{c}]
                                            </span>
                                        ))}
                                        {campos.length > 5 && (
                                            <span className="px-1 py-0.5 text-[10px] text-muted-foreground">
                                                +{campos.length - 5}
                                            </span>
                                        )}
                                        {campos.length === 0 && (
                                            <span className="text-[11px] text-muted-foreground">Sem campos</span>
                                        )}
                                    </span>
                                </button>
                                <div className="flex items-center justify-between gap-2 border-t border-ink/10 px-2 py-1.5">
                                    {confirmarExclusao === m.id ? (
                                        linhaConfirmar("modelo", m.id)
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setAlvoGerar({ modeloId: m.id, clienteId: null, calculoId: null })}
                                                className="inline-flex h-8 items-center gap-1.5 px-2 text-xs font-semibold text-ink hover:bg-ink/[0.06]"
                                            >
                                                <FilePlus2 className="size-3.5" />
                                                Usar modelo
                                            </button>
                                            <span className="flex items-center">
                                                <button
                                                    type="button"
                                                    onClick={() => irPara({ modelo: m.id })}
                                                    className={botaoIcone}
                                                    title="Editar"
                                                    aria-label={`Editar ${m.nome}`}
                                                >
                                                    <Pencil className="size-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void novoModelo(m)}
                                                    className={botaoIcone}
                                                    title="Duplicar"
                                                    aria-label={`Duplicar ${m.nome}`}
                                                >
                                                    <CopyPlus className="size-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmarExclusao(m.id)}
                                                    className={cn(botaoIcone, "hover:text-destructive")}
                                                    title="Excluir"
                                                    aria-label={`Excluir ${m.nome}`}
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </span>
                                        </>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
                <BarraPaginacao
                    pagina={pagModelos.pagina}
                    totalPaginas={pagModelos.totalPaginas}
                    total={pagModelos.total}
                    inicio={pagModelos.inicio}
                    fim={pagModelos.fim}
                    onPagina={pagModelos.irPara}
                    porPagina={pagModelos.porPagina}
                    onPorPagina={pagModelos.mudarPorPagina}
                    opcoesPorPagina={[12, 24, 48]}
                    rotulo="modelos"
                    alvoRolagem={listaRef}
                />
                </div>
            )}

            {painelGerar}
        </div>
    );
};
