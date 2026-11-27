import { useCallback, useEffect, useRef, useState } from "react";
import {
    AlertTriangle,
    Bot,
    Check,
    FileText,
    Loader2,
    MessageSquareText,
    NotebookPen,
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
        <div className="space-y-2.5 border border-gold/60 bg-gold/5 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink">
                {doc ? `Revise o que a IA leu de ${rascunho.arquivoNome}` : "Nova anotação"}
            </p>
            <input
                aria-label="Título"
                value={rascunho.titulo}
                onChange={(e) => onChange({ ...rascunho, titulo: e.target.value })}
                onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (podeSalvar) onSalvar();
                }}
                maxLength={200}
                placeholder="Título"
                className="field py-1.5 text-sm"
            />
            <textarea
                aria-label={doc ? "Resumo" : "Texto da anotação"}
                value={rascunho.resumo}
                onChange={(e) => onChange({ ...rascunho, resumo: e.target.value })}
                maxLength={4000}
                rows={doc ? 4 : 3}
                placeholder={doc ? "Resumo" : "Ex.: Audiência de conciliação marcada para 10/12/2026, às 14h, por vídeo."}
                className="field resize-y py-1.5 text-sm"
            />
            {doc && (
                <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">
                        Fatos extraídos ({rascunho.fatos.length}). Tire o que estiver errado antes de salvar.
                    </p>
                    <ul className="max-h-56 divide-y divide-ink/10 overflow-y-auto border border-ink/15 bg-background">
                        {rascunho.fatos.map((f, i) => (
                            <li key={`${f.rotulo}-${i}`} className="flex items-start gap-2 px-2.5 py-1.5 text-xs">
                                <span className="min-w-0 flex-1">
                                    <span className="font-semibold text-ink">{f.rotulo}:</span> {f.valor}
                                    {f.pagina ? <span className="text-muted-foreground"> · pág. {f.pagina}</span> : null}
                                </span>
                                <button
                                    type="button"
                                    aria-label={`Remover ${f.rotulo}`}
                                    onClick={() =>
                                        onChange({ ...rascunho, fatos: rascunho.fatos.filter((_, j) => j !== i) })
                                    }
                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                >
                                    <X className="size-3.5" />
                                </button>
                            </li>
                        ))}
                        {rascunho.fatos.length === 0 && (
                            <li className="px-2.5 py-2 text-xs text-muted-foreground">Nenhum fato extraído.</li>
                        )}
                    </ul>
                </div>
            )}
            <label className="flex items-center gap-2 text-xs text-ink">
                <input
                    type="checkbox"
                    checked={rascunho.visivelCliente}
                    onChange={(e) => onChange({ ...rascunho, visivelCliente: e.target.checked })}
                />
                Pode ser usado nas respostas a este cliente
            </label>
            <div className="flex justify-end gap-2">
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

function SimuladorAtendimento({ clienteId, nome }: { clienteId: string; nome: string }) {
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
        <div className="space-y-2 border border-ink/15 p-3">
            <p className="text-[11px] text-muted-foreground">
                Escreva como se fosse <strong className="text-ink">{nome.split(/\s+/)[0]}</strong> no WhatsApp. Nada é
                enviado ao cliente: é só um teste com a base dele.
            </p>
            <div className="max-h-72 space-y-2 overflow-y-auto bg-secondary/40 p-2">
                {turnos.length === 0 && (
                    <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                        Ex.: “Qual o número do meu processo?” ou “Quanto vou receber?”
                    </p>
                )}
                {turnos.map((t, i) => (
                    <div key={i} className={cn("flex", t.autor === "cliente" ? "justify-end" : "justify-start")}>
                        <div
                            className={cn(
                                "max-w-[85%] space-y-1 px-2.5 py-1.5 text-sm text-ink",
                                t.autor === "cliente" ? "bg-gold/25" : "bg-background",
                            )}
                        >
                            <p className="whitespace-pre-wrap">{t.texto}</p>
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
            <div className="flex gap-2">
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

/* ------------------------------------------------------------- Seção na ficha */

export function BaseConhecimentoCliente({ clienteId, nomeCliente }: { clienteId: string; nomeCliente: string }) {
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
            setItens(await listarConhecimentoCliente(clienteId));
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

    return (
        // Esta seção é renderizada dentro do <form> da ficha do cliente: Enter num campo daqui não pode
        // enviar aquele formulário (salvaria o cadastro e a anotação se perderia).
        <section
            className="space-y-2.5"
            onKeyDown={(e) => {
                if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
            }}
        >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-1.5">
                <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Bot className="size-3.5" /> Base do atendimento por IA ({itens.length})
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        disabled={lendo || Boolean(rascunho)}
                        onClick={() => inputArquivo.current?.click()}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink hover:underline disabled:opacity-40"
                    >
                        {lendo ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                        {lendo ? "Lendo documento…" : "Ler PDF ou foto"}
                    </button>
                    <button
                        type="button"
                        disabled={lendo || Boolean(rascunho)}
                        onClick={() =>
                            setRascunho({ origem: "anotacao", arquivoNome: "", titulo: "", resumo: "", fatos: [], visivelCliente: true })
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink hover:underline disabled:opacity-40"
                    >
                        <NotebookPen className="size-3" /> Anotação
                    </button>
                    <button
                        type="button"
                        onClick={() => setSimulando((s) => !s)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink hover:underline"
                    >
                        <MessageSquareText className="size-3" /> {simulando ? "Fechar teste" : "Testar atendimento"}
                    </button>
                </div>
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

            <p className="text-[11px] text-muted-foreground">
                A IA lê o PDF uma vez e guarda só o texto. Quando este cliente mandar mensagem, ela responde usando
                apenas o que está aqui e nos casos dele. Se não estiver aqui, ela não responde e avisa você.
            </p>

            {rascunho && (
                <EditorRascunho
                    rascunho={rascunho}
                    salvando={salvando}
                    onChange={setRascunho}
                    onSalvar={() => void salvar()}
                    onCancelar={() => setRascunho(null)}
                />
            )}

            {simulando && <SimuladorAtendimento clienteId={clienteId} nome={nomeCliente} />}

            {carregando ? (
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Carregando…
                </p>
            ) : erro ? (
                <p className="inline-flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="size-3.5" /> {erro}
                </p>
            ) : itens.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    Nenhum documento na base. Sem documentos, o atendimento só sabe os dados dos casos deste cliente.
                </p>
            ) : (
                <ul className="divide-y divide-ink/10 border border-ink/15">
                    {itens.map((it) => {
                        const aberto = abertoId === it.id;
                        return (
                            <li key={it.id} className="px-3 py-2">
                                <div className="flex items-start justify-between gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setAbertoId(aberto ? null : it.id)}
                                        aria-expanded={aberto}
                                        className="min-w-0 flex-1 text-left"
                                    >
                                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                                            {it.origem === "documento" ? (
                                                <FileText className="size-3.5 shrink-0" />
                                            ) : (
                                                <NotebookPen className="size-3.5 shrink-0" />
                                            )}
                                            <span className="truncate">{it.titulo}</span>
                                        </p>
                                        <p className="truncate text-[11px] text-muted-foreground">
                                            {[
                                                dataCurta(it.created_at),
                                                it.fatos.length ? `${it.fatos.length} fatos` : "",
                                                it.visivel_cliente ? "" : "interno (não usado nas respostas)",
                                            ]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </p>
                                    </button>
                                    {excluirId === it.id ? (
                                        <span className="flex shrink-0 items-center gap-2 text-[11px]">
                                            <button
                                                type="button"
                                                onClick={() => void excluir(it.id)}
                                                className="font-semibold text-destructive hover:underline"
                                            >
                                                Excluir
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setExcluirId(null)}
                                                className="font-semibold text-muted-foreground hover:text-ink"
                                            >
                                                Cancelar
                                            </button>
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            aria-label={`Excluir ${it.titulo}`}
                                            onClick={() => setExcluirId(it.id)}
                                            className="shrink-0 text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                                {aberto && (
                                    <div className="mt-2 space-y-1.5 text-xs text-ink">
                                        {it.resumo && <p className="whitespace-pre-wrap leading-relaxed">{it.resumo}</p>}
                                        {it.fatos.length > 0 && (
                                            <ul className="space-y-0.5">
                                                {it.fatos.map((f, i) => (
                                                    <li key={i}>
                                                        <span className="font-semibold">{f.rotulo}:</span> {f.valor}
                                                        {f.pagina ? (
                                                            <span className="text-muted-foreground"> · pág. {f.pagina}</span>
                                                        ) : null}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
