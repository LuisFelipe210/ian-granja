import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    ChevronDown,
    ClipboardCopy,
    CopyPlus,
    Download,
    FilePlus2,
    FileText,
    FileType2,
    Loader2,
    Pencil,
    Printer,
    RefreshCw,
    Save,
    Search,
    Trash2,
    UserRound,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logoTimbrado from "@/assets/logo.png";
import { EditorDocumento } from "@/components/juros/EditorDocumento";
import {
    CONFIG_PAGINA_PADRAO,
    acharCampoConhecido,
    extrairCampos,
    htmlParaTextoSimples,
    montarArquivoWord,
    montarHtmlImpressaoDocumento,
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

let logoDataUrlPromise: Promise<string> | null = null;

/** Converte o emblema local em data URI (embute no Word e funciona dentro do iframe sandbox de impressão). */
function obterLogoTimbradoDataUrl(): Promise<string> {
    if (logoDataUrlPromise) return logoDataUrlPromise;
    logoDataUrlPromise = fetch(logoTimbrado)
        .then((res) => (res.ok ? res.blob() : null))
        .then(
            (blob) =>
                new Promise<string>((resolve) => {
                    if (!blob) return resolve("");
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
                    reader.onerror = () => resolve("");
                    reader.readAsDataURL(blob);
                }),
        )
        .catch(() => "");
    return logoDataUrlPromise;
}

async function baixarWord(titulo: string, html: string, pagina: ConfigPagina) {
    const logoSrc = pagina.timbrado ? await obterLogoTimbradoDataUrl() : "";
    // BOM: faz o Word reconhecer o arquivo como UTF-8 (acentos).
    const blob = new Blob(["\ufeff", montarArquivoWord(titulo, html, pagina, { logoSrc })], {
        type: "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeArquivoDocumento(titulo)}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function imprimirDocumento(titulo: string, html: string, pagina: ConfigPagina) {
    const logoSrc = pagina.timbrado ? await obterLogoTimbradoDataUrl() : "";
    const htmlCompleto = montarHtmlImpressaoDocumento(titulo, html, pagina, { logoSrc });
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
    doc.write(htmlCompleto);
    doc.close();
    const remover = () => setTimeout(() => iframe.remove(), 500);
    win.addEventListener("afterprint", remover, { once: true });
    // Aguarda fontes web (ex.: Montserrat, Lato) terminarem de carregar no iframe antes de abrir o PDF.
    const esperarFontes = doc.fonts?.ready
        ? Promise.race([doc.fonts.ready, new Promise((r) => setTimeout(r, 1500))])
        : Promise.resolve();
    await esperarFontes;
    setTimeout(() => {
        win.focus();
        win.print();
        // Safari não dispara afterprint de forma confiável.
        setTimeout(() => iframe.isConnected && iframe.remove(), 60_000);
    }, 180);
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

/* ------------------------------------------------------- Modais centralizados e ilustração SVG */

interface AlvoExclusao {
    tipo: "modelo" | "documento";
    id: string;
    nome: string;
}

function ModalConfirmarExclusao({
    alvo,
    excluindo,
    onCancelar,
    onConfirmar,
}: {
    alvo: AlvoExclusao | null;
    excluindo: boolean;
    onCancelar: () => void;
    onConfirmar: () => void;
}) {
    return (
        <Dialog.Root
            open={Boolean(alvo)}
            onOpenChange={(aberto) => {
                if (!aberto && !excluindo) onCancelar();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-deep/45 backdrop-blur-[2px]" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-ink/20 bg-card p-6 shadow-2xl focus:outline-none">
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                            <Trash2 aria-hidden className="size-5" />
                        </div>
                        <Dialog.Title className="text-base font-semibold tracking-tight text-ink">
                            Tem certeza que você deseja apagar?
                        </Dialog.Title>
                        <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {alvo ? (
                                <>
                                    {alvo.tipo === "modelo" ? "O modelo" : "O documento"}{" "}
                                    <strong className="font-semibold text-ink">“{alvo.nome}”</strong> será apagado
                                    permanentemente e não poderá ser recuperado.
                                </>
                            ) : null}
                        </Dialog.Description>
                    </div>
                    <div className="mt-6 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            disabled={excluindo}
                            onClick={onCancelar}
                            className="inline-flex h-9 items-center border border-ink/25 bg-card px-4 text-xs font-semibold text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            disabled={excluindo}
                            onClick={onConfirmar}
                            className="inline-flex h-9 items-center gap-1.5 bg-destructive px-4 text-xs font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-60"
                        >
                            {excluindo ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                            Sim, apagar
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function ModalSairSemSalvar({
    aberto,
    salvando,
    onCancelar,
    onSairSemSalvar,
    onSalvarESair,
}: {
    aberto: boolean;
    salvando: boolean;
    onCancelar: () => void;
    onSairSemSalvar: () => void;
    onSalvarESair: () => void;
}) {
    return (
        <Dialog.Root
            open={aberto}
            onOpenChange={(open) => {
                if (!open && !salvando) onCancelar();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-deep/45 backdrop-blur-[2px]" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-ink/20 bg-card p-6 shadow-2xl focus:outline-none">
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-gold/25 text-gold-deep">
                            <AlertTriangle aria-hidden className="size-5" />
                        </div>
                        <Dialog.Title className="text-base font-semibold tracking-tight text-ink">
                            Tem certeza que deseja sair sem salvar o documento?
                        </Dialog.Title>
                        <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            Você tem alterações não salvas. Se sair agora sem salvar, tudo o que mudou será descartado.
                        </Dialog.Description>
                    </div>
                    <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            disabled={salvando}
                            onClick={onCancelar}
                            className="inline-flex h-9 items-center border border-ink/20 bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50"
                        >
                            Continuar editando
                        </button>
                        <button
                            type="button"
                            disabled={salvando}
                            onClick={onSairSemSalvar}
                            className="inline-flex h-9 items-center border border-destructive/35 bg-card px-3.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
                        >
                            Sair sem salvar
                        </button>
                        <button
                            type="button"
                            disabled={salvando}
                            onClick={onSalvarESair}
                            className="inline-flex h-9 items-center gap-1.5 bg-ink px-4 text-xs font-semibold text-paper transition-colors hover:bg-ink-deep disabled:opacity-60"
                        >
                            {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                            Salvar e sair
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function IlustracaoDocumentoModelo({ temCampos, timbrado }: { temCampos: boolean; timbrado: boolean }) {
    return (
        <div className="relative mx-auto flex h-44 w-32 items-center justify-center">
            {/* Folha sutil atrás para dar profundidade de papel sobre a mesa */}
            <div
                aria-hidden
                className="pointer-events-none absolute h-[148px] w-[112px] rotate-[4deg] rounded-[4px] border border-ink/10 bg-[#f6f3ec] shadow-sm transition-transform duration-300 group-hover:rotate-[6deg] group-hover:translate-x-0.5"
            />
            <svg
                viewBox="0 0 112 144"
                fill="none"
                aria-hidden
                className="relative h-[152px] w-[118px] -rotate-[3deg] drop-shadow-[0_10px_18px_rgba(6,18,55,0.13)] transition-all duration-300 group-hover:-translate-y-2 group-hover:rotate-0 group-hover:scale-[1.03] group-hover:drop-shadow-[0_16px_26px_rgba(6,18,55,0.20)]"
            >
                {/* Folha A4 com canto superior direito dobrado */}
                <path
                    d="M8 2H82L104 24V136C104 139.314 101.314 142 98 142H8C4.68629 142 2 139.314 2 136V8C2 4.68629 4.68629 2 8 2Z"
                    fill="#FFFFFF"
                    stroke="#061237"
                    strokeOpacity="0.16"
                    strokeWidth="1.5"
                />
                <path
                    d="M82 2V20C82 22.2091 83.7909 24 86 24H104L82 2Z"
                    fill="#ECE8DF"
                    stroke="#061237"
                    strokeOpacity="0.14"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                />
                {/* Cabeçalho de papel timbrado */}
                {timbrado && (
                    <>
                        <rect x="14" y="13" width="10" height="10" rx="1.5" fill="#061237" />
                        <path d="M19 15.8V20.2M17 17.6H21" stroke="#C5B08E" strokeWidth="1.2" strokeLinecap="round" />
                        <rect x="28" y="15" width="32" height="2.6" rx="1.3" fill="#061237" fillOpacity="0.78" />
                        <rect x="28" y="20" width="20" height="1.8" rx="0.9" fill="#B6A182" />
                        <line x1="14" y1="29" x2="92" y2="29" stroke="#061237" strokeOpacity="0.35" strokeWidth="1" />
                        <line x1="14" y1="31.5" x2="92" y2="31.5" stroke="#B6A182" strokeOpacity="0.85" strokeWidth="0.8" />
                    </>
                )}
                {/* Título centralizado */}
                <rect x="28" y={timbrado ? 40 : 28} width="50" height="4" rx="2" fill="#061237" fillOpacity="0.78" />
                {/* Parágrafo 1 */}
                <rect x="14" y={timbrado ? 52 : 42} width="78" height="2.8" rx="1.4" fill="#061237" fillOpacity="0.18" />
                <rect x="14" y={timbrado ? 59 : 49} width="46" height="2.8" rx="1.4" fill="#061237" fillOpacity="0.18" />
                {temCampos ? (
                    <rect x="63" y={timbrado ? 58 : 48} width="26" height="4.8" rx="1.5" fill="#C5B08E" fillOpacity="0.6" />
                ) : (
                    <rect x="63" y={timbrado ? 59 : 49} width="26" height="2.8" rx="1.4" fill="#061237" fillOpacity="0.18" />
                )}
                <rect x="14" y={timbrado ? 66 : 56} width="72" height="2.8" rx="1.4" fill="#061237" fillOpacity="0.18" />
                <rect x="14" y={timbrado ? 73 : 63} width="58" height="2.8" rx="1.4" fill="#061237" fillOpacity="0.18" />
                {/* Parágrafo 2 */}
                <rect x="22" y={timbrado ? 85 : 75} width="70" height="2.8" rx="1.4" fill="#061237" fillOpacity="0.15" />
                {temCampos ? (
                    <rect x="14" y={timbrado ? 91 : 81} width="30" height="4.8" rx="1.5" fill="#C5B08E" fillOpacity="0.6" />
                ) : (
                    <rect x="14" y={timbrado ? 92 : 82} width="30" height="2.8" rx="1.4" fill="#061237" fillOpacity="0.15" />
                )}
                <rect x="48" y={timbrado ? 92 : 82} width="44" height="2.8" rx="1.4" fill="#061237" fillOpacity="0.15" />
                <rect x="14" y={timbrado ? 99 : 89} width="64" height="2.8" rx="1.4" fill="#061237" fillOpacity="0.15" />
                {/* Assinatura no rodapé */}
                <line x1="34" y1="122" x2="78" y2="122" stroke="#061237" strokeOpacity="0.32" strokeWidth="1" />
                <rect x="42" y="126" width="28" height="2.2" rx="1.1" fill="#061237" fillOpacity="0.24" />
            </svg>
        </div>
    );
}

/* ------------------------------------------------------- Tela de edição */

interface RascunhoNovoModelo {
    chave: string;
    nome: string;
    descricao: string;
    conteudo_html: string;
    pagina: ConfigPagina;
}

type ItemEmEdicao =
    | { tipo: "modelo"; registro: ModeloDocumento; novo?: false }
    | { tipo: "modelo"; registro: null; novo: true; rascunho: RascunhoNovoModelo }
    | { tipo: "documento"; registro: DocumentoGerado; novo?: false };

type ItemSalvo =
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
    onSalvo: (item: ItemSalvo) => void;
    onGerarComModelo: (modeloId: string) => void;
}) {
    const ehModelo = item.tipo === "modelo";
    const ehNovoModelo = item.tipo === "modelo" && Boolean(item.novo);
    const chaveInicial = item.tipo === "modelo" && item.novo ? item.rascunho.chave : item.registro.id;
    const conteudoInicial = item.tipo === "modelo" && item.novo ? item.rascunho.conteudo_html : item.registro.conteudo_html;

    const [titulo, setTitulo] = useState(() =>
        item.tipo === "modelo" ? (item.novo ? item.rascunho.nome : item.registro.nome) : item.registro.titulo,
    );
    const [descricao, setDescricao] = useState(() =>
        item.tipo === "modelo" ? (item.novo ? item.rascunho.descricao : item.registro.descricao) : "",
    );
    const [html, setHtml] = useState(conteudoInicial);
    const [pagina, setPagina] = useState<ConfigPagina>(() =>
        normalizarConfigPagina(item.tipo === "modelo" && item.novo ? item.rascunho.pagina : item.registro.pagina),
    );
    // Novo modelo começa pendente para obrigar o salvamento explícito ao sair.
    const [status, setStatus] = useState<StatusSalvo>(ehNovoModelo ? "pendente" : "salvo");
    const [confirmarSaida, setConfirmarSaida] = useState(false);

    const idRegistroRef = useRef<string | null>(item.novo ? null : item.registro.id);
    const pendenteRef = useRef(ehNovoModelo);
    const ultimoRef = useRef({ titulo, descricao, html, pagina });
    ultimoRef.current = { titulo, descricao, html, pagina };
    const onSalvoRef = useRef(onSalvo);
    onSalvoRef.current = onSalvo;
    const salvandoEmVooRef = useRef(false);
    // Conta cada edição: o salvamento só marca "Salvo" se nada mudou enquanto a requisição estava em voo.
    const versaoRef = useRef(0);
    // Pedido de salvar que chegou com outro salvamento em voo (ex.: tela desmontando): roda logo depois.
    const salvarDeNovoRef = useRef(false);
    // Houve edição real do usuário (novo modelo intocado não é criado só por sair da tela).
    const editadoRef = useRef(false);

    const marcarPendente = useCallback(() => {
        pendenteRef.current = true;
        editadoRef.current = true;
        versaoRef.current += 1;
        setStatus("pendente");
    }, []);

    const salvarAgora = useCallback(async (): Promise<string | null> => {
        if (salvandoEmVooRef.current) {
            salvarDeNovoRef.current = true;
            return idRegistroRef.current;
        }
        salvandoEmVooRef.current = true;
        setStatus("salvando");
        const versaoSalva = versaoRef.current;
        let sucesso = false;
        // Fecha o ciclo: só fica "Salvo" se ninguém editou durante a requisição.
        const concluir = () => {
            sucesso = true;
            const mudouNoMeioTempo = versaoRef.current !== versaoSalva;
            pendenteRef.current = mudouNoMeioTempo;
            setStatus(mudouNoMeioTempo ? "pendente" : "salvo");
        };
        try {
            const { titulo: t, descricao: d, html: h, pagina: pg } = ultimoRef.current;
            if (ehModelo) {
                const nomeFinal = t.trim() || "Modelo sem nome";
                const reg = idRegistroRef.current
                    ? await atualizarModelo(idRegistroRef.current, {
                          nome: nomeFinal,
                          descricao: d,
                          conteudo_html: h,
                          pagina: pg,
                      })
                    : await criarModelo({
                          nome: nomeFinal,
                          descricao: d,
                          conteudo_html: h,
                          pagina: pg,
                      });
                idRegistroRef.current = reg.id;
                if (versaoRef.current === versaoSalva) setTitulo(reg.nome);
                concluir();
                onSalvoRef.current({ tipo: "modelo", registro: reg });
                toast.success("Modelo salvo.");
                return reg.id;
            }
            const idDoc = idRegistroRef.current;
            if (!idDoc) return null;
            const reg = await atualizarDocumento(idDoc, {
                titulo: t.trim() || "Documento sem título",
                conteudo_html: h,
                pagina: pg,
            });
            if (versaoRef.current === versaoSalva) setTitulo(reg.titulo);
            concluir();
            onSalvoRef.current({ tipo: "documento", registro: reg });
            toast.success("Documento salvo.");
            return reg.id;
        } catch (err) {
            pendenteRef.current = true;
            setStatus("erro");
            toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
            return null;
        } finally {
            salvandoEmVooRef.current = false;
            const repetir = salvarDeNovoRef.current;
            salvarDeNovoRef.current = false;
            // Edições feitas durante o voo (ou pedido feito ao desmontar) entram num novo salvamento.
            if (repetir && sucesso && pendenteRef.current) void salvarAgoraRef.current();
        }
    }, [ehModelo]);
    const salvarAgoraRef = useRef(salvarAgora);
    salvarAgoraRef.current = salvarAgora;

    // Sair da tela por outro caminho (outra aba do sistema, voltar do navegador) com alteração
    // pendente: salva antes de desmontar, como fazia o salvamento automático.
    useEffect(
        () => () => {
            if (pendenteRef.current && (idRegistroRef.current || editadoRef.current)) {
                void salvarAgoraRef.current();
            }
        },
        [],
    );

    // Aviso nativo se tentar fechar/recarregar a aba do navegador sem salvar + atalho Ctrl+S.
    useEffect(() => {
        const antesDeSair = (e: BeforeUnloadEvent) => {
            if (pendenteRef.current) {
                e.preventDefault();
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                void salvarAgora();
            }
        };
        window.addEventListener("beforeunload", antesDeSair);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("beforeunload", antesDeSair);
            window.removeEventListener("keydown", onKey);
        };
    }, [salvarAgora]);

    const tentarVoltar = () => {
        if (pendenteRef.current) {
            setConfirmarSaida(true);
            return;
        }
        onVoltar();
    };

    const calculo =
        item.tipo === "documento" && item.registro.calculo_id
            ? calculos.find((c) => c.id === item.registro.calculo_id)
            : null;
    const modeloOrigem =
        item.tipo === "documento" && item.registro.modelo_id
            ? modelos.find((m) => m.id === item.registro.modelo_id)
            : null;
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
                        onClick={tentarVoltar}
                        className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-ink"
                    >
                        <ArrowLeft className="size-3.5" />
                        {ehModelo ? "Modelos" : "Documentos"}
                    </button>
                    <input
                        value={titulo}
                        onChange={(e) => {
                            setTitulo(e.target.value);
                            marcarPendente();
                        }}
                        maxLength={ehModelo ? 160 : 200}
                        aria-label={ehModelo ? "Nome do modelo" : "Título do documento"}
                        className="w-full border-0 border-b border-transparent bg-transparent px-0 py-1 text-xl font-semibold tracking-tight text-ink hover:border-ink/20 focus:border-ink focus:outline-none"
                    />
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 font-medium",
                                status === "erro" && "text-destructive",
                                status === "pendente" && "text-gold-deep",
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
                    <button
                        type="button"
                        disabled={status === "salvando"}
                        onClick={() => void salvarAgora()}
                        title="Salvar alterações (Ctrl+S)"
                        className={cn(
                            "inline-flex h-9 items-center gap-1.5 px-3.5 text-xs font-semibold transition-colors duration-150 disabled:opacity-60",
                            status === "pendente" || status === "erro"
                                ? "bg-ink text-paper hover:bg-ink-deep"
                                : "border border-ink/25 bg-card text-ink hover:bg-ink/5",
                        )}
                    >
                        {status === "salvando" ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                        Salvar
                    </button>
                    {ehModelo && (
                        <button
                            type="button"
                            disabled={status === "salvando"}
                            onClick={async () => {
                                const id = pendenteRef.current || !idRegistroRef.current ? await salvarAgora() : idRegistroRef.current;
                                if (id) onGerarComModelo(id);
                            }}
                            className="inline-flex h-9 items-center gap-1.5 bg-gold px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-gold-light disabled:opacity-60"
                        >
                            <FilePlus2 className="size-3.5" />
                            Gerar documento
                        </button>
                    )}
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button type="button" className={botaoAcao}>
                                <Download className="size-3.5" />
                                Exportar
                                <ChevronDown className="size-3 text-ink/60" />
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                align="end"
                                sideOffset={4}
                                className="z-40 min-w-[11.5rem] border border-ink/20 bg-card py-1 shadow-xl"
                            >
                                <DropdownMenu.Item
                                    onSelect={() => {
                                        avisarPendentes();
                                        void imprimirDocumento(tituloExport, html, pagina);
                                    }}
                                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-ink outline-none hover:bg-ink/5 focus:bg-ink/5"
                                >
                                    <Printer className="size-3.5 text-ink/70" />
                                    Salvar como PDF
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                    onSelect={() => {
                                        avisarPendentes();
                                        void baixarWord(tituloExport, html, pagina);
                                    }}
                                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-ink outline-none hover:bg-ink/5 focus:bg-ink/5"
                                >
                                    <FileType2 className="size-3.5 text-ink/70" />
                                    Salvar como Word
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
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
                                marcarPendente();
                            }}
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
                chave={chaveInicial}
                modo={item.tipo}
                conteudoInicial={conteudoInicial}
                pagina={pagina}
                onPaginaChange={(nova) => {
                    setPagina(nova);
                    marcarPendente();
                }}
                onChange={(novo) => {
                    setHtml(novo);
                    marcarPendente();
                }}
            />

            <ModalSairSemSalvar
                aberto={confirmarSaida}
                salvando={status === "salvando"}
                onCancelar={() => setConfirmarSaida(false)}
                onSairSemSalvar={() => {
                    setConfirmarSaida(false);
                    pendenteRef.current = false;
                    onVoltar();
                }}
                onSalvarESair={async () => {
                    const id = await salvarAgora();
                    if (id) {
                        setConfirmarSaida(false);
                        onVoltar();
                    }
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
    const [alvoExclusao, setAlvoExclusao] = useState<AlvoExclusao | null>(null);
    const [excluindo, setExcluindo] = useState(false);
    const [rascunhoNovoModelo, setRascunhoNovoModelo] = useState<RascunhoNovoModelo | null>(null);

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
        if (rascunhoNovoModelo) {
            return { tipo: "modelo", registro: null, novo: true, rascunho: rascunhoNovoModelo };
        }
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
    }, [rascunhoNovoModelo, docId, modeloEditId, documentos, modelos]);

    const aoSalvar = useCallback((salvo: ItemSalvo) => {
        if (salvo.tipo === "modelo") {
            setModelos((prev) => {
                const sem = prev.filter((m) => m.id !== salvo.registro.id);
                return [...sem, salvo.registro].sort((a, b) => a.nome.localeCompare(b.nome));
            });
        } else {
            setDocumentos((prev) => [salvo.registro, ...prev.filter((d) => d.id !== salvo.registro.id)]);
        }
    }, []);

    const abrirNovoModelo = (base?: ModeloDocumento) => {
        const chave = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `novo-${Date.now()}`;
        setRascunhoNovoModelo({
            chave,
            nome: base ? `${base.nome} (cópia)` : "Novo modelo",
            descricao: base?.descricao ?? "",
            conteudo_html: base?.conteudo_html ?? "",
            pagina: base ? normalizarConfigPagina(base.pagina) : CONFIG_PAGINA_PADRAO,
        });
        window.scrollTo({ top: 0 });
    };

    const confirmarExcluirAtual = async () => {
        if (!alvoExclusao) return;
        const { tipo, id } = alvoExclusao;
        setExcluindo(true);
        try {
            if (tipo === "modelo") {
                await excluirModelo(id);
                setModelos((prev) => prev.filter((m) => m.id !== id));
                toast.success("Modelo apagado.");
            } else {
                await excluirDocumento(id);
                setDocumentos((prev) => prev.filter((d) => d.id !== id));
                toast.success("Documento apagado.");
            }
            setAlvoExclusao(null);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível apagar.");
        } finally {
            setExcluindo(false);
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
                setRascunhoNovoModelo(null);
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

    if ((docId || modeloEditId) && !rascunhoNovoModelo && carregando) {
        return (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Abrindo…
            </div>
        );
    }

    if (rascunhoNovoModelo || docId || modeloEditId) {
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
        const chaveTela = itemEdicao.novo ? itemEdicao.rascunho.chave : itemEdicao.registro.id;
        return (
            <>
                <TelaEdicao
                    key={chaveTela}
                    item={itemEdicao}
                    nomeCliente={itemEdicao.tipo === "documento" ? nomeClienteDoc(itemEdicao.registro) : null}
                    calculos={calculos}
                    modelos={modelos}
                    onVoltar={() => {
                        setRascunhoNovoModelo(null);
                        irPara(itemEdicao.tipo === "modelo" ? { aba: "modelos" } : {});
                    }}
                    onSalvo={aoSalvar}
                    onGerarComModelo={(id) => setAlvoGerar({ modeloId: id, clienteId: null, calculoId: null })}
                />
                {painelGerar}
            </>
        );
    }

    /* ---------- Listas */

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
                        onClick={() => abrirNovoModelo()}
                        className="inline-flex h-9 items-center gap-1.5 border border-ink/25 bg-card px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5"
                    >
                        <Pencil className="size-3.5" />
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
                                            onClick={() => setAlvoExclusao({ tipo: "documento", id: d.id, nome: d.titulo })}
                                            className={cn(botaoIcone, "hover:text-destructive")}
                                            title="Apagar"
                                            aria-label={`Apagar ${d.titulo}`}
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </span>
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
                <div className="space-y-6">
                <ul className="grid grid-cols-2 gap-x-6 gap-y-8 pt-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {pagModelos.itensPagina.map((m) => {
                        const campos = extrairCampos(m.conteudo_html);
                        const cfgPag = normalizarConfigPagina(m.pagina);
                        return (
                            <li key={m.id} className="group flex flex-col items-center text-center">
                                <div className="relative flex flex-col items-center">
                                    {/* Folha SVG inclinada (clicar abre para editar) */}
                                    <button
                                        type="button"
                                        onClick={() => irPara({ modelo: m.id })}
                                        title={m.descricao || `Abrir modelo ${m.nome}`}
                                        className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
                                    >
                                        <IlustracaoDocumentoModelo temCampos={campos.length > 0} timbrado={cfgPag.timbrado} />
                                    </button>

                                    {/* Barra flutuante discreta de ações ao passar o mouse */}
                                    <div className="absolute -bottom-1 z-10 flex items-center gap-0.5 rounded-full bg-card/95 px-1.5 py-1 shadow-md ring-1 ring-ink/15 backdrop-blur-sm transition-all duration-200 sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-within:translate-y-0 sm:focus-within:opacity-100">
                                        <button
                                            type="button"
                                            onClick={() => setAlvoGerar({ modeloId: m.id, clienteId: null, calculoId: null })}
                                            className="inline-flex h-6 items-center gap-1 rounded-full bg-gold px-2.5 text-[11px] font-semibold text-ink transition-colors hover:bg-gold-light"
                                            title="Gerar documento com este modelo"
                                        >
                                            <FilePlus2 className="size-3" />
                                            Usar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => abrirNovoModelo(m)}
                                            className="inline-flex size-6 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
                                            title="Duplicar modelo"
                                            aria-label={`Duplicar ${m.nome}`}
                                        >
                                            <CopyPlus className="size-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAlvoExclusao({ tipo: "modelo", id: m.id, nome: m.nome })}
                                            className="inline-flex size-6 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                                            title="Apagar modelo"
                                            aria-label={`Apagar ${m.nome}`}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Nome embaixo do desenho */}
                                <button
                                    type="button"
                                    onClick={() => irPara({ modelo: m.id })}
                                    className="mt-3 max-w-[11.5rem] text-center focus:outline-none"
                                >
                                    <span className="line-clamp-2 block text-sm font-semibold leading-snug text-ink transition-colors group-hover:text-gold-deep">
                                        {m.nome}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                        {campos.length > 0
                                            ? `${campos.length} ${campos.length === 1 ? "campo" : "campos"}`
                                            : "Texto livre"}
                                    </span>
                                </button>
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
            <ModalConfirmarExclusao
                alvo={alvoExclusao}
                excluindo={excluindo}
                onCancelar={() => setAlvoExclusao(null)}
                onConfirmar={() => void confirmarExcluirAtual()}
            />
        </div>
    );
};
