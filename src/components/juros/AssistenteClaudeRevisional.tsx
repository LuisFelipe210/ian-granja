import { useEffect, useRef, useState, type DragEvent } from "react";
import {
    Bot,
    FileText,
    Image as ImageIcon,
    KeyRound,
    Loader2,
    Paperclip,
    Plug,
    Sparkles,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    ErroGoogleDrive,
    GOOGLE_DRIVE_CONFIGURADO,
    baixarArquivoDrive,
    escolherArquivosDrive,
    prepararGoogleDrive,
} from "@/lib/google-drive";
import { IconeGoogleDrive } from "@/components/juros/IconeGoogleDrive";
import { ModalConectorMcp } from "@/components/juros/ModalConectorMcp";
import {
    LIMITE_TOTAL_ANEXOS_BYTES,
    interpretarComandoLocalFallback,
    type ClaudeArquivoAnexo,
    type ClaudeExtracaoRevisional,
    type ClaudeMimeType,
    type EstadoAtualCalculadora,
} from "@/lib/juros/claude-revisional";

const MAX_TOTAL_MB = Math.round(LIMITE_TOTAL_ANEXOS_BYTES / (1024 * 1024));

function lerApiKeySalva(): string {
    // Nunca persiste chave da Anthropic em localStorage (risco de exfiltração por XSS/extensões).
    return "";
}

function detectarMime(file: File): ClaudeMimeType | null {
    const t = file.type.toLowerCase();
    if (t === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "application/pdf";
    if (t === "image/png" || file.name.toLowerCase().endsWith(".png")) return "image/png";
    if (t === "image/webp" || file.name.toLowerCase().endsWith(".webp")) return "image/webp";
    if (t === "image/jpeg" || t === "image/jpg" || /\.(jpe?g)$/i.test(file.name)) return "image/jpeg";
    if (t.startsWith("text/") || /\.(txt|csv)$/i.test(file.name)) return "text/plain";
    return null;
}

/** Tipos que o Claude lê e que dá para baixar direto do Drive (documentos nativos do Google ficam de fora). */
const MIME_ACEITOS_DRIVE = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"];

function fileParaBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            const comma = result.indexOf(",");
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error(`Não foi possível ler o arquivo "${file.name}".`));
        reader.readAsDataURL(file);
    });
}

function formatBytes(bytes?: number): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AssistenteClaudeRevisionalProps {
    sessaoAccessToken: string;
    estadoAtual: EstadoAtualCalculadora;
    calculoAtivoId: string | null;
    carregandoExterno?: boolean;
    onAplicarResultadoClaude: (
        extracao: ClaudeExtracaoRevisional,
        opcoes: { salvarAutomaticamente: boolean; fonte: "claude_api" | "parser_local" },
    ) => Promise<void>;
}

export const AssistenteClaudeRevisional = ({
    sessaoAccessToken,
    estadoAtual,
    calculoAtivoId,
    carregandoExterno = false,
    onAplicarResultadoClaude,
}: AssistenteClaudeRevisionalProps) => {
    const inputArquivoRef = useRef<HTMLInputElement>(null);
    const [arquivos, setArquivos] = useState<ClaudeArquivoAnexo[]>([]);
    const [comando, setComando] = useState("");
    const [salvarAuto, setSalvarAuto] = useState(true);
    const [processando, setProcessando] = useState(false);
    const [arrastando, setArrastando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [buscandoDrive, setBuscandoDrive] = useState(false);

    useEffect(() => {
        prepararGoogleDrive();
    }, []);
    const [ultimoResumo, setUltimoResumo] = useState<string | null>(null);

    const [mostrarConfigChave, setMostrarConfigChave] = useState(false);
    const [apiKeyLocal, setApiKeyLocal] = useState(lerApiKeySalva);
    const [modalMcpAberto, setModalMcpAberto] = useState(false);

    const ocupado = processando || carregandoExterno;

    const adicionarArquivos = async (lista: FileList | File[] | null) => {
        if (!lista || lista.length === 0) return;
        setErro(null);

        const atuaisBytes = arquivos.reduce((s, a) => s + (a.tamanhoBytes ?? 0), 0);
        let acumulado = atuaisBytes;
        const novos: ClaudeArquivoAnexo[] = [];

        for (const file of Array.from(lista)) {
            if (arquivos.length + novos.length >= 8) {
                setErro("Máximo de 8 anexos por análise.");
                break;
            }
            const mime = detectarMime(file);
            if (!mime) {
                setErro(`Formato não suportado (${file.name}). Envie PDF, PNG, JPG, WEBP ou TXT.`);
                continue;
            }
            if (acumulado + file.size > LIMITE_TOTAL_ANEXOS_BYTES) {
                setErro(
                    `O total dos anexos passa de ${MAX_TOTAL_MB} MB (limite do servidor). Comprima o PDF, envie só as páginas do contrato ou use o Conector MCP no Claude Desktop.`,
                );
                continue;
            }
            const base64 = await fileParaBase64(file);
            acumulado += file.size;
            novos.push({
                nome: file.name,
                mediaType: mime,
                base64,
                tamanhoBytes: file.size,
            });
        }

        if (novos.length > 0) {
            setArquivos((prev) => [...prev, ...novos]);
        }
    };

    const handleDrop = (e: DragEvent<HTMLElement>) => {
        e.preventDefault();
        setArrastando(false);
        void adicionarArquivos(e.dataTransfer.files);
    };

    /** Escolhe o contrato no Google Drive e anexa como se fosse um arquivo do computador. */
    const importarDoDrive = async () => {
        if (!GOOGLE_DRIVE_CONFIGURADO) {
            toast.info("O Google Drive ainda não foi configurado neste sistema.", {
                description: "Faltam as chaves do Google Cloud (passo a passo em docs/GOOGLE-DRIVE.md).",
            });
            return;
        }
        setErro(null);
        setBuscandoDrive(true);
        try {
            const itens = await escolherArquivosDrive({
                mimeTypes: MIME_ACEITOS_DRIVE,
                multiplos: true,
                titulo: "Escolha o contrato (PDF ou foto) no Google Drive",
            });
            if (itens.length === 0) return;
            const baixados = await Promise.all(itens.map((item) => baixarArquivoDrive(item)));
            await adicionarArquivos(baixados);
        } catch (e) {
            if (e instanceof ErroGoogleDrive && e.codigo === "cancelado") return;
            setErro(e instanceof Error ? e.message : "Não foi possível trazer o arquivo do Google Drive.");
        } finally {
            setBuscandoDrive(false);
        }
    };

    const salvarChaveLocal = (valor: string) => {
        setApiKeyLocal(valor);
    };

    const executarComClaude = async () => {
        if (!comando.trim() && arquivos.length === 0) {
            setErro("Anexe um PDF/foto do contrato ou digite uma instrução.");
            return;
        }

        setErro(null);
        setProcessando(true);
        try {
            const temBinario = arquivos.some(
                (a) => a.mediaType === "application/pdf" || a.mediaType.startsWith("image/"),
            );

            let extracao: ClaudeExtracaoRevisional;
            let fonte: "claude_api" | "parser_local" = "claude_api";

            const res = await fetch("/api/claude-revisional", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(sessaoAccessToken ? { Authorization: `Bearer ${sessaoAccessToken}` } : {}),
                },
                body: JSON.stringify({
                    comando: comando.trim(),
                    arquivos: arquivos.map((a) => ({
                        nome: a.nome,
                        mediaType: a.mediaType,
                        base64: a.base64,
                    })),
                    estadoAtual,
                    anthropicApiKey: apiKeyLocal.trim() || undefined,
                }),
            });

            if (res.status === 404 && !temBinario) {
                const temCaso = Boolean(
                    estadoAtual.ficha.clienteNome.trim() ||
                        (estadoAtual.processo.contratos[0]?.valorFinanciado ?? 0) > 0,
                );
                extracao = interpretarComandoLocalFallback(comando.trim(), "", temCaso);
                fonte = "parser_local";
            } else {
                const json = (await res.json().catch(() => ({}))) as {
                    ok?: boolean;
                    message?: string;
                    extracao?: ClaudeExtracaoRevisional;
                    fonte?: "claude_api" | "parser_local";
                };
                if (!res.ok || !json.ok || !json.extracao) {
                    throw new Error(json.message || `Falha ao consultar Claude (${res.status}).`);
                }
                extracao = json.extracao;
                fonte = json.fonte ?? "claude_api";
            }

            setUltimoResumo(extracao.resumoExplicacao);
            // Proteção contra prompt injection indireta: nunca gravar no banco por sugestão do LLM
            // quando o usuário não habilitou explicitamente o salvamento automático.
            const deveSalvar = salvarAuto;
            await onAplicarResultadoClaude(extracao, {
                salvarAutomaticamente: deveSalvar,
                fonte,
            });
            setArquivos([]);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Erro ao processar solicitação com o Claude.";
            setErro(msg);
            toast.error(msg);
        } finally {
            setProcessando(false);
        }
    };

    const sugestoes = calculoAtivoId
        ? [
              {
                  rotulo: "+ Alvará R$ 5 mil e atualizar",
                  texto: "Atualiza o cálculo deste cliente para hoje e inclui alvará de R$ 5.000",
              },
              {
                  rotulo: "Data-base hoje (Lei 14.905)",
                  texto: "Atualiza a data-base para hoje pela Lei 14.905/2024",
              },
              {
                  rotulo: "+ Prestamista em dobro",
                  texto: "Adiciona Seguro Prestamista de R$ 1.800 em dobro",
              },
          ]
        : [
              {
                  rotulo: "Média BACEN + seguro em dobro",
                  texto: "Lê esse contrato e calcula pela média do BACEN com seguro prestamista em dobro",
              },
              {
                  rotulo: "Fase Busca e Apreensão",
                  texto: "Cadastra na fase Busca e Apreensão e salva no histórico",
              },
          ];

    return (
        <section
            onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={handleDrop}
            aria-label="Leitura Automática e Comando Claude"
            className={cn(
                "border border-ink/20 bg-card transition-colors duration-150",
                arrastando && "border-gold bg-gold-light/20 ring-1 ring-gold",
            )}
        >
            <input
                ref={inputArquivoRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp,.txt"
                multiple
                className="sr-only"
                onChange={(e) => {
                    void adicionarArquivos(e.target.files);
                    e.target.value = "";
                }}
            />

            {/* Cabeçalho compacto */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/15 px-4 py-3">
                <div className="flex items-center gap-2">
                    <Bot aria-hidden className="size-4 text-gold-deep" />
                    <h2 className="sys-section text-ink">Leitura automática com Claude</h2>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => inputArquivoRef.current?.click()}
                        className="inline-flex h-7 items-center gap-1.5 border border-ink/25 bg-background/80 px-2.5 text-[11px] font-semibold text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                    >
                        <Paperclip className="size-3" />
                        Anexar PDF / Foto
                    </button>
                    <button
                        type="button"
                        onClick={() => void importarDoDrive()}
                        disabled={buscandoDrive}
                        title="Trazer o contrato direto do Google Drive"
                        className="inline-flex h-7 items-center gap-1.5 border border-ink/25 bg-background/80 px-2.5 text-[11px] font-semibold text-ink transition-colors hover:border-ink hover:bg-ink/5 disabled:cursor-wait disabled:opacity-70"
                    >
                        {buscandoDrive ? (
                            <Loader2 aria-hidden className="size-3 animate-spin" />
                        ) : (
                            <IconeGoogleDrive className="size-3.5" />
                        )}
                        {buscandoDrive ? "Buscando no Drive…" : "Google Drive"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setMostrarConfigChave((v) => !v)}
                        title="Configurar chave ANTHROPIC_API_KEY"
                        className={cn(
                            "inline-flex h-7 items-center gap-1 border px-2 text-[11px] font-semibold transition-colors",
                            mostrarConfigChave
                                ? "border-ink bg-ink text-paper"
                                : "border-ink/20 text-ink/75 hover:border-ink/45 hover:text-ink",
                        )}
                    >
                        <KeyRound className="size-3" />
                        API
                    </button>
                    <button
                        type="button"
                        onClick={() => setModalMcpAberto(true)}
                        className="inline-flex h-7 items-center gap-1 border border-gold bg-gold-light/40 px-2 text-[11px] font-semibold text-ink hover:bg-gold-light"
                    >
                        <Plug className="size-3" />
                        MCP
                    </button>
                </div>
            </div>

            <div className="space-y-3 px-4 py-3.5">
                {mostrarConfigChave && (
                    <div className="space-y-1.5 border border-ink/15 bg-secondary/45 p-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                            <label htmlFor="claude-api-key" className="font-semibold text-ink">
                                Chave API Anthropic (para PDFs/fotos no site)
                            </label>
                            {apiKeyLocal && (
                                <button
                                    type="button"
                                    onClick={() => salvarChaveLocal("")}
                                    className="text-[11px] font-semibold text-destructive hover:underline"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>
                        <input
                            id="claude-api-key"
                            type="password"
                            value={apiKeyLocal}
                            onChange={(e) => salvarChaveLocal(e.target.value)}
                            placeholder="sk-ant-api03-..."
                            className="field py-1.5 text-xs"
                        />
                    </div>
                )}

                {arquivos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {arquivos.map((arq, idx) => (
                            <span
                                key={`${arq.nome}-${idx}`}
                                className="inline-flex max-w-full items-center gap-1.5 border border-gold bg-gold-light/25 px-2.5 py-1 text-[11px] font-medium text-ink"
                            >
                                {arq.mediaType.startsWith("image/") ? (
                                    <ImageIcon className="size-3 shrink-0 text-gold-deep" />
                                ) : (
                                    <FileText className="size-3 shrink-0 text-gold-deep" />
                                )}
                                <span className="max-w-[12rem] truncate">{arq.nome}</span>
                                {arq.tamanhoBytes ? (
                                    <span className="text-[10px] text-muted-foreground">
                                        ({formatBytes(arq.tamanhoBytes)})
                                    </span>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => setArquivos((prev) => prev.filter((_, i) => i !== idx))}
                                    aria-label={`Remover ${arq.nome}`}
                                    className="text-ink/60 hover:text-destructive"
                                >
                                    <X className="size-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <textarea
                    id="claude-comando"
                    aria-label="Instrução ou comando para o Claude"
                    rows={2}
                    value={comando}
                    onChange={(e) => setComando(e.target.value)}
                    placeholder={
                        arrastando
                            ? "Solte o PDF ou foto do contrato aqui..."
                            : calculoAtivoId
                              ? "Solte um documento aqui ou digite: Atualiza para hoje e inclui alvará de R$ 5.000..."
                              : "Solte o PDF/foto da CCB aqui ou digite os dados do contrato e a fase do Kanban..."
                    }
                    className="w-full resize-y border border-ink/20 bg-background/60 px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-ink/45 focus:border-ink focus:bg-card focus:outline-none"
                />

                <div className="flex flex-wrap items-center gap-1.5">
                    {sugestoes.map((sug) => (
                        <button
                            key={sug.rotulo}
                            type="button"
                            onClick={() => setComando(sug.texto)}
                            className="border border-ink/15 bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-ink/80 transition-colors hover:border-ink/40 hover:bg-secondary hover:text-ink"
                        >
                            {sug.rotulo}
                        </button>
                    ))}
                </div>

                {ultimoResumo && !erro && (
                    <p className="border-l-2 border-gold bg-gold-light/20 px-2.5 py-1.5 text-[11px] text-ink">
                        <strong>Claude:</strong> {ultimoResumo}
                    </p>
                )}

                {erro && (
                    <p
                        role="alert"
                        className="border-l-2 border-destructive bg-destructive/5 px-2.5 py-1.5 text-[11px] font-medium text-destructive"
                    >
                        {erro}
                    </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-medium text-muted-foreground select-none hover:text-ink">
                        <input
                            type="checkbox"
                            checked={salvarAuto}
                            onChange={(e) => setSalvarAuto(e.target.checked)}
                            className="accent-ink"
                        />
                        Salvar no histórico ao concluir
                    </label>

                    <button
                        type="button"
                        disabled={ocupado}
                        onClick={executarComClaude}
                        className="inline-flex h-9 items-center justify-center gap-1.5 border border-gold bg-gold-light px-3.5 text-xs font-bold text-ink transition-colors hover:bg-gold-light/80 disabled:cursor-wait disabled:opacity-65"
                    >
                        {ocupado ? (
                            <Loader2 aria-hidden className="size-3.5 animate-spin" />
                        ) : (
                            <Sparkles aria-hidden className="size-3.5" />
                        )}
                        {processando ? "Analisando..." : "Preencher e Calcular"}
                    </button>
                </div>
            </div>

            <ModalConectorMcp aberto={modalMcpAberto} onFechar={() => setModalMcpAberto(false)} />
        </section>
    );
};
