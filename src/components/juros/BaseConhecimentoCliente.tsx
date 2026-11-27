import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
    AlertTriangle,
    Bot,
    Check,
    ChevronDown,
    FileText,
    Loader2,
    MessageSquareText,
    NotebookPen,
    Search,
    Send,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { criarItemConhecimento, excluirItemConhecimento, listarConhecimentoCliente } from "@/lib/revisional-db";
import { chamarAtendimento } from "@/lib/atendimento/api-cliente";
import type {
    ExtracaoDocumento,
    FatoDocumento,
    ItemConhecimento,
    RespostaAtendimento,
} from "@/lib/atendimento/base-conhecimento";

const LIMITE_ARQUIVO = 3 * 1024 * 1024;
const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
/** A partir de quantos fatos aparece o campo para filtrar a lista. */
const FATOS_PARA_FILTRO = 8;

function lerBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
        reader.readAsDataURL(file);
    });
}

function dataCurta(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function normalizar(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
}

/* ------------------------------------------------------------- Peças visuais */

function Chip({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "alerta" }) {
    return (
        <span
            className={cn(
                "inline-flex h-5 items-center px-1.5 text-[10.5px] font-semibold",
                tom === "alerta" ? "bg-gold/25 text-ink" : "bg-secondary text-muted-foreground",
            )}
        >
            {children}
        </span>
    );
}

/** Lista de fatos em duas colunas (rótulo | valor), com a página discreta à direita. */
function TabelaFatos({ fatos, onRemover }: { fatos: FatoDocumento[]; onRemover?: (indice: number) => void }) {
    const [filtro, setFiltro] = useState("");
    const termo = normalizar(filtro.trim());
    const visiveis = useMemo(
        () =>
            fatos
                .map((f, i) => ({ f, i }))
                .filter(({ f }) => !termo || normalizar(`${f.rotulo} ${f.valor}`).includes(termo)),
        [fatos, termo],
    );

    if (fatos.length === 0) {
        return <p className="text-xs text-muted-foreground">Nenhum fato extraído.</p>;
    }

    return (
        <div className="space-y-2">
            {fatos.length >= FATOS_PARA_FILTRO && (
                <label className="flex items-center gap-2 border-b border-ink/15 pb-1 text-muted-foreground focus-within:border-ink">
                    <Search aria-hidden className="size-3.5 shrink-0" />
                    <input
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                        placeholder={`Filtrar ${fatos.length} fatos (ex.: placa, parcela, CPF)`}
                        aria-label="Filtrar fatos"
                        className="min-w-0 flex-1 bg-transparent py-1 text-xs text-ink outline-none placeholder:text-ink/35"
                    />
                    {filtro && (
                        <button
                            type="button"
                            aria-label="Limpar filtro"
                            onClick={() => setFiltro("")}
                            className="shrink-0 hover:text-ink"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </label>
            )}
            <dl className="divide-y divide-ink/10 border border-ink/10">
                {visiveis.map(({ f, i }) => (
                    <div
                        key={`${f.rotulo}-${i}`}
                        className="grid grid-cols-1 gap-x-4 gap-y-0.5 px-3 py-2 text-xs odd:bg-secondary/35 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]"
                    >
                        <dt className="font-medium text-muted-foreground">{f.rotulo}</dt>
                        <dd className="break-words text-ink">{f.valor}</dd>
                        <dd className="flex items-start gap-2 sm:justify-end">
                            {f.pagina ? (
                                <span className="whitespace-nowrap text-[10.5px] tabular-nums text-muted-foreground">
                                    p. {f.pagina}
                                </span>
                            ) : null}
                            {onRemover && (
                                <button
                                    type="button"
                                    aria-label={`Remover ${f.rotulo}`}
                                    onClick={() => onRemover(i)}
                                    className="text-muted-foreground hover:text-destructive"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </dd>
                    </div>
                ))}
                {visiveis.length === 0 && (
                    <div className="px-3 py-3 text-xs text-muted-foreground">Nenhum fato com “{filtro.trim()}”.</div>
                )}
            </dl>
        </div>
    );
}

/* ------------------------------------------------------------- Rascunho (antes de salvar) */

interface Rascunho {
    origem: "documento" | "anotacao";
    arquivoNome: string;
    titulo: string;
    resumo: string;
    fatos: FatoDocumento[];
    visivelCliente: boolean;
}

function EditorRascunho({
    rascunho,
    salvando,
    onChange,
    onSalvar,
    onCancelar,
}: {
    rascunho: Rascunho;
    salvando: boolean;
    onChange: (r: Rascunho) => void;
    onSalvar: () => void;
    onCancelar: () => void;
}) {
    const doc = rascunho.origem === "documento";
    const podeSalvar = !salvando && !!rascunho.titulo.trim() && (!!rascunho.resumo.trim() || rascunho.fatos.length > 0);
    return (
        <div className="space-y-4 border border-gold/70 bg-gold/5 p-4">
            <div>
                <p className="text-sm font-semibold text-ink">{doc ? "Revise antes de salvar" : "Nova anotação"}</p>
                {doc && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        O que a IA leu de <span className="font-medium text-ink">{rascunho.arquivoNome}</span>. Corrija
                        o que estiver errado: a IA vai responder ao cliente com base nisso.
                    </p>
                )}
            </div>
            <div>
                <label htmlFor="rascunho-titulo" className="sys-label block">
                    Título
                </label>
                <input
                    id="rascunho-titulo"
                    value={rascunho.titulo}
                    onChange={(e) => onChange({ ...rascunho, titulo: e.target.value })}
                    onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        if (podeSalvar) onSalvar();
                    }}
                    maxLength={200}
                    className="field py-1.5 text-sm"
                />
            </div>
            <div>
                <label htmlFor="rascunho-resumo" className="sys-label block">
                    {doc ? "Resumo" : "Texto da anotação"}
                </label>
                <textarea
                    id="rascunho-resumo"
                    value={rascunho.resumo}
                    onChange={(e) => onChange({ ...rascunho, resumo: e.target.value })}
                    maxLength={4000}
                    rows={doc ? 5 : 3}
                    placeholder={doc ? "" : "Ex.: Audiência de conciliação marcada para 10/12/2026, às 14h, por vídeo."}
                    className="field resize-y py-1.5 text-sm leading-relaxed"
                />
            </div>
            {doc && (
                <div className="space-y-2">
                    <p className="sys-label">Fatos extraídos ({rascunho.fatos.length}). Tire o que estiver errado.</p>
                    <div className="max-h-80 overflow-y-auto bg-background">
                        <TabelaFatos
                            fatos={rascunho.fatos}
                            onRemover={(i) =>
                                onChange({ ...rascunho, fatos: rascunho.fatos.filter((_, j) => j !== i) })
                            }
                        />
                    </div>
                </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/40 pt-3">
                <label className="flex items-center gap-2 text-xs text-ink">
                    <input
                        type="checkbox"
                        checked={rascunho.visivelCliente}
                        onChange={(e) => onChange({ ...rascunho, visivelCliente: e.target.checked })}
                    />
                    Pode ser usado nas respostas a este cliente
                </label>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onCancelar}
                        className="inline-flex h-8 items-center px-3 text-xs font-semibold text-muted-foreground hover:text-ink"
                    >
                        Descartar
                    </button>
                    <button
                        type="button"
                        disabled={!podeSalvar}
                        onClick={onSalvar}
                        className="inline-flex h-8 items-center gap-1.5 bg-gold px-3 text-xs font-semibold text-ink hover:bg-gold-light disabled:opacity-50"
                    >
                        {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        Salvar na base
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------- Simulador */

interface TurnoSimulado {
    autor: "cliente" | "atendimento";
    texto: string;
    resposta?: RespostaAtendimento;
}

const ROTULO_SITUACAO: Record<RespostaAtendimento["situacao"], string> = {
    respondido: "Respondido com base",
    sem_informacao: "Sem informação na base",
    encaminhar_advogado: "Encaminhado ao advogado",
};

function SimuladorAtendimento({
    clienteId,
    nome,
    onFechar,
}: {
    clienteId: string;
    nome: string;
    onFechar: () => void;
}) {
    const [turnos, setTurnos] = useState<TurnoSimulado[]>([]);
    const [texto, setTexto] = useState("");
    const [enviando, setEnviando] = useState(false);
    const fimRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fimRef.current?.scrollIntoView({ block: "nearest" });
    }, [turnos, enviando]);

    const enviar = async () => {
        const mensagem = texto.trim();
        if (!mensagem || enviando) return;
        const historico = turnos.map(({ autor, texto: t }) => ({ autor, texto: t }));
        setTurnos((ts) => [...ts, { autor: "cliente", texto: mensagem }]);
        setTexto("");
        setEnviando(true);
        try {
            const { resposta } = await chamarAtendimento<{ resposta: RespostaAtendimento }>({
                acao: "simular_resposta",
                clienteId,
                mensagem,
                historico,
            });
            setTurnos((ts) => [...ts, { autor: "atendimento", texto: resposta.mensagem, resposta }]);
        } catch (err) {
            toast.error((err as Error).message);
            setTurnos((ts) => ts.slice(0, -1));
            setTexto(mensagem);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="border border-ink/15">
            <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
                <div>
                    <p className="text-sm font-semibold text-ink">Testar atendimento</p>
                    <p className="text-xs text-muted-foreground">
                        Escreva como se fosse {nome.split(/\s+/)[0]} no WhatsApp. Nada é enviado ao cliente.
                    </p>
                </div>
                <button
                    type="button"
                    aria-label="Fechar teste"
                    onClick={onFechar}
                    className="inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:text-ink"
                >
                    <X className="size-4" />
                </button>
            </div>
            <div className="max-h-80 min-h-32 space-y-2 overflow-y-auto bg-secondary/40 p-3">
                {turnos.length === 0 && (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                        Ex.: “Qual o número do meu processo?” ou “Quanto vou receber?”
                    </p>
                )}
                {turnos.map((t, i) => (
                    <div key={i} className={cn("flex", t.autor === "cliente" ? "justify-end" : "justify-start")}>
                        <div
                            className={cn(
                                "max-w-[85%] space-y-1 px-3 py-2 text-sm text-ink",
                                t.autor === "cliente" ? "bg-gold/25" : "border border-ink/10 bg-background",
                            )}
                        >
                            <p className="whitespace-pre-wrap leading-relaxed">{t.texto}</p>
                            {t.resposta && (
                                <div className="space-y-0.5 border-t border-ink/10 pt-1 text-[10.5px] text-muted-foreground">
                                    <p
                                        className={cn(
                                            "font-semibold",
                                            t.resposta.situacao === "respondido" ? "text-ink" : "text-destructive",
                                        )}
                                    >
                                        {ROTULO_SITUACAO[t.resposta.situacao]}
                                        {t.resposta.avisarAdvogado ? " · você seria avisado" : ""}
                                    </p>
                                    {t.resposta.fontes.length > 0 && (
                                        <p>Fontes: {t.resposta.fontes.map((f) => f.titulo).join("; ")}</p>
                                    )}
                                    {t.resposta.motivoInterno && <p>Motivo: {t.resposta.motivoInterno}</p>}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {enviando && (
                    <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Consultando a base do cliente…
                    </div>
                )}
                <div ref={fimRef} />
            </div>
            <div className="flex gap-2 border-t border-ink/10 px-3 py-2">
                <input
                    aria-label="Mensagem do cliente"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            void enviar();
                        }
                    }}
                    maxLength={2000}
                    placeholder="Mensagem do cliente"
                    className="field min-w-0 flex-1 py-1.5 text-sm"
                />
                <button
                    type="button"
                    onClick={() => void enviar()}
                    disabled={enviando || !texto.trim()}
                    aria-label="Enviar"
                    className="inline-flex h-8 shrink-0 items-center bg-ink px-3 text-white hover:bg-ink/90 disabled:opacity-40"
                >
                    <Send className="size-3.5" />
                </button>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------- Item da base */

function CartaoItem({
    item,
    aberto,
    confirmandoExclusao,
    onAlternar,
    onPedirExclusao,
    onCancelarExclusao,
    onExcluir,
}: {
    item: ItemConhecimento;
    aberto: boolean;
    confirmandoExclusao: boolean;
    onAlternar: () => void;
    onPedirExclusao: () => void;
    onCancelarExclusao: () => void;
    onExcluir: () => void;
}) {
    const Icone = item.origem === "documento" ? FileText : NotebookPen;
    const idCorpo = `base-item-${item.id}`;
    return (
        <li className={cn("border bg-background transition-colors duration-150", aberto ? "border-ink/30" : "border-ink/15")}>
            <div className="flex items-start gap-3 p-3">
                <button
                    type="button"
                    onClick={onAlternar}
                    aria-expanded={aberto}
                    aria-controls={idCorpo}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                    <span className="inline-flex size-8 shrink-0 items-center justify-center bg-secondary text-ink">
                        <Icone aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug text-ink">{item.titulo}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Chip>{item.origem === "documento" ? "Documento" : "Anotação"}</Chip>
                            {item.created_at && <Chip>{dataCurta(item.created_at)}</Chip>}
                            {item.fatos.length > 0 && (
                                <Chip>
                                    {item.fatos.length} {item.fatos.length === 1 ? "fato" : "fatos"}
                                </Chip>
                            )}
                            {!item.visivel_cliente && <Chip tom="alerta">Interno · não usado nas respostas</Chip>}
                        </span>
                    </span>
                    <ChevronDown
                        aria-hidden
                        className={cn(
                            "mt-1.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150",
                            aberto && "rotate-180",
                        )}
                    />
                </button>
                {confirmandoExclusao ? (
                    <span className="flex shrink-0 items-center gap-2 pt-1 text-xs">
                        <button type="button" onClick={onExcluir} className="font-semibold text-destructive hover:underline">
                            Excluir
                        </button>
                        <button
                            type="button"
                            onClick={onCancelarExclusao}
                            className="font-semibold text-muted-foreground hover:text-ink"
                        >
                            Cancelar
                        </button>
                    </span>
                ) : (
                    <button
                        type="button"
                        aria-label={`Excluir ${item.titulo}`}
                        onClick={onPedirExclusao}
                        className="inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                )}
            </div>
            {aberto && (
                <div id={idCorpo} className="space-y-4 border-t border-ink/10 px-3 pb-4 pt-3 sm:px-4">
                    {item.resumo && (
                        <div className="space-y-1">
                            <p className="sys-label">{item.origem === "documento" ? "Resumo" : "Anotação"}</p>
                            <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-ink">{item.resumo}</p>
                        </div>
                    )}
                    {item.fatos.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="sys-label">Fatos ({item.fatos.length})</p>
                            <TabelaFatos fatos={item.fatos} />
                        </div>
                    )}
                    {item.arquivo_nome && (
                        <p className="text-[11px] text-muted-foreground">Arquivo lido: {item.arquivo_nome}</p>
                    )}
                </div>
            )}
        </li>
    );
}

/* ------------------------------------------------------------- Seção na ficha */

export function BaseConhecimentoCliente({
    clienteId,
    nomeCliente,
    onTotalChange,
}: {
    clienteId: string;
    nomeCliente: string;
    /** Avisa quantos itens a base tem (para o contador da aba). */
    onTotalChange?: (total: number) => void;
}) {
    const [itens, setItens] = useState<ItemConhecimento[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState<string | null>(null);
    const [lendo, setLendo] = useState(false);
    const [rascunho, setRascunho] = useState<Rascunho | null>(null);
    const [salvando, setSalvando] = useState(false);
    const [abertoId, setAbertoId] = useState<string | null>(null);
    const [excluirId, setExcluirId] = useState<string | null>(null);
    const [simulando, setSimulando] = useState(false);
    const inputArquivo = useRef<HTMLInputElement>(null);

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            const lista = await listarConhecimentoCliente(clienteId);
            setItens(lista);
            // Com um item só, já mostra o conteúdo aberto.
            setAbertoId(lista.length === 1 ? lista[0].id : null);
            setErro(null);
        } catch (err) {
            setErro((err as Error).message);
        } finally {
            setCarregando(false);
        }
    }, [clienteId]);

    useEffect(() => {
        void carregar();
    }, [carregar]);

    useEffect(() => {
        if (!carregando) onTotalChange?.(itens.length);
    }, [carregando, itens.length, onTotalChange]);

    const lerArquivo = async (file: File) => {
        if (!TIPOS_ACEITOS.includes(file.type)) {
            toast.error("Envie um PDF ou uma foto (JPG, PNG ou WEBP).");
            return;
        }
        if (file.size > LIMITE_ARQUIVO) {
            toast.error("Arquivo acima de 3 MB. Envie um PDF menor ou só as páginas importantes.");
            return;
        }
        setLendo(true);
        try {
            const base64 = await lerBase64(file);
            const { extracao } = await chamarAtendimento<{ extracao: ExtracaoDocumento }>({
                acao: "extrair_documento",
                arquivo: { nome: file.name, mediaType: file.type, base64 },
            });
            setRascunho({
                origem: "documento",
                arquivoNome: file.name,
                titulo: extracao.titulo,
                resumo: extracao.resumo,
                fatos: extracao.fatos,
                visivelCliente: true,
            });
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setLendo(false);
        }
    };

    const salvar = async () => {
        if (!rascunho) return;
        setSalvando(true);
        try {
            const novo = await criarItemConhecimento({
                cliente_id: clienteId,
                origem: rascunho.origem,
                titulo: rascunho.titulo,
                arquivo_nome: rascunho.arquivoNome,
                resumo: rascunho.resumo,
                fatos: rascunho.fatos,
                visivel_cliente: rascunho.visivelCliente,
            });
            setItens((xs) => [novo, ...xs]);
            setAbertoId(novo.id);
            setRascunho(null);
            toast.success("Salvo na base do atendimento.");
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setSalvando(false);
        }
    };

    const excluir = async (id: string) => {
        try {
            await excluirItemConhecimento(id);
            setItens((xs) => xs.filter((x) => x.id !== id));
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setExcluirId(null);
        }
    };

    const ocupado = lendo || Boolean(rascunho);
    const botaoSecundario =
        "inline-flex h-8 items-center gap-1.5 border border-ink/25 px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5 disabled:opacity-40";

    return (
        // Esta seção é renderizada dentro do <form> da ficha do cliente: Enter num campo daqui não pode
        // enviar aquele formulário (salvaria o cadastro e a anotação se perderia).
        <section
            aria-label="Base do atendimento por IA"
            className="space-y-4"
            onKeyDown={(e) => {
                if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
            }}
        >
            <div className="flex gap-3 bg-secondary/60 px-4 py-3">
                <Bot aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
                <p className="text-xs leading-relaxed text-ink">
                    Quando este cliente mandar mensagem, a IA responde usando <strong>só</strong> o que está aqui e nos
                    casos dele. Se a resposta não estiver na base, ela não responde e avisa você.
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => inputArquivo.current?.click()}
                    className="inline-flex h-8 items-center gap-1.5 bg-gold px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-gold-light disabled:opacity-50"
                >
                    {lendo ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                    {lendo ? "Lendo documento…" : "Ler PDF ou foto"}
                </button>
                <button
                    type="button"
                    disabled={ocupado}
                    onClick={() =>
                        setRascunho({ origem: "anotacao", arquivoNome: "", titulo: "", resumo: "", fatos: [], visivelCliente: true })
                    }
                    className={botaoSecundario}
                >
                    <NotebookPen className="size-3.5" /> Nova anotação
                </button>
                <button
                    type="button"
                    aria-pressed={simulando}
                    onClick={() => setSimulando((s) => !s)}
                    className={cn(botaoSecundario, simulando && "border-ink bg-ink text-paper hover:bg-ink/90")}
                >
                    <MessageSquareText className="size-3.5" /> Testar atendimento
                </button>
                <input
                    ref={inputArquivo}
                    type="file"
                    accept={TIPOS_ACEITOS.join(",")}
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void lerArquivo(f);
                    }}
                />
            </div>

            {rascunho && (
                <EditorRascunho
                    rascunho={rascunho}
                    salvando={salvando}
                    onChange={setRascunho}
                    onSalvar={() => void salvar()}
                    onCancelar={() => setRascunho(null)}
                />
            )}

            {simulando && (
                <SimuladorAtendimento clienteId={clienteId} nome={nomeCliente} onFechar={() => setSimulando(false)} />
            )}

            {carregando ? (
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Carregando…
                </p>
            ) : erro ? (
                <p className="inline-flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="size-3.5" /> {erro}
                </p>
            ) : itens.length === 0 ? (
                !rascunho && (
                    <div className="border border-dashed border-ink/20 px-4 py-8 text-center">
                        <FileText aria-hidden className="mx-auto size-5 text-muted-foreground" />
                        <p className="mt-2 text-sm font-medium text-ink">Nenhum documento na base</p>
                        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                            Sem documentos, o atendimento só sabe os dados dos casos deste cliente. Envie o contrato,
                            a procuração ou uma anotação.
                        </p>
                    </div>
                )
            ) : (
                <ul className="space-y-2">
                    {itens.map((it) => (
                        <CartaoItem
                            key={it.id}
                            item={it}
                            aberto={abertoId === it.id}
                            confirmandoExclusao={excluirId === it.id}
                            onAlternar={() => setAbertoId((a) => (a === it.id ? null : it.id))}
                            onPedirExclusao={() => setExcluirId(it.id)}
                            onCancelarExclusao={() => setExcluirId(null)}
                            onExcluir={() => void excluir(it.id)}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}
