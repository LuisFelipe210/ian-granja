import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Bot, CheckCheck, Loader2, MessageCircle, RefreshCw, Send, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    atualizarConversaAtendimento,
    descartarRascunhoAtendimento,
    listarClientes,
    listarConversasAtendimento,
    listarMensagensConversa,
    RevisionalApiError,
    type Cliente,
    type ConversaAtendimento,
    type MensagemAtendimento,
} from "@/lib/revisional-db";
import { chamarAtendimento } from "@/lib/atendimento/api-cliente";
import { dentroDaJanela, telefoneLegivel } from "@/lib/atendimento/telefone";
import { BASE_ROTA } from "@/components/juros/ShellSistema";

const ROTULO_SITUACAO: Record<NonNullable<MensagemAtendimento["situacao_ia"]>, string> = {
    respondido: "Resposta com base nos dados do cliente",
    sem_informacao: "A IA não achou a informação na base",
    encaminhar_advogado: "Precisa do advogado",
};

const POLL_CONVERSAS_MS = 15_000;
const POLL_MENSAGENS_MS = 8_000;

function tabelaAusente(err: unknown): boolean {
    return (
        err instanceof RevisionalApiError &&
        (err.code === "TABELA_AUSENTE" || err.code === "42P01" || err.code === "PGRST205")
    );
}

function quando(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const hoje = new Date();
    return d.toDateString() === hoje.toDateString()
        ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Repete `fn` enquanto a aba do navegador estiver visível. */
function useIntervaloVisivel(fn: () => void, ms: number, ativo = true) {
    const ref = useRef(fn);
    ref.current = fn;
    useEffect(() => {
        if (!ativo) return;
        const id = window.setInterval(() => {
            if (document.visibilityState === "visible") ref.current();
        }, ms);
        return () => window.clearInterval(id);
    }, [ms, ativo]);
}

interface StatusWhatsApp {
    configurado: boolean;
    avisoPorWhatsApp: boolean;
}

/* ------------------------------------------------------------------ Conversa aberta */

function PainelConversa({
    conversa,
    nomeCliente,
    clientes,
    whatsappPronto,
    onVoltar,
    onMudou,
}: {
    conversa: ConversaAtendimento;
    nomeCliente: string;
    clientes: Cliente[];
    whatsappPronto: boolean;
    onVoltar: () => void;
    onMudou: () => void;
}) {
    const [mensagens, setMensagens] = useState<MensagemAtendimento[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [ocupado, setOcupado] = useState<"enviar" | "gerar" | "descartar" | "ligar" | "resolver" | null>(null);
    const [edicao, setEdicao] = useState<{ chave: string; texto: string }>({ chave: "", texto: "" });
    const [clienteParaLigar, setClienteParaLigar] = useState("");
    const fimRef = useRef<HTMLDivElement>(null);

    const carregar = useCallback(
        async (silencioso = false) => {
            try {
                setMensagens(await listarMensagensConversa(conversa.id));
            } catch (err) {
                if (!silencioso) toast.error((err as Error).message);
            } finally {
                setCarregando(false);
            }
        },
        [conversa.id],
    );

    useEffect(() => {
        setCarregando(true);
        setMensagens([]);
        void carregar();
    }, [carregar]);
    useIntervaloVisivel(() => void carregar(true), POLL_MENSAGENS_MS);

    const historico = mensagens.filter((m) => m.status !== "rascunho");
    const rascunho = [...mensagens].reverse().find((m) => m.status === "rascunho") ?? null;

    // O texto em edição só volta ao do rascunho quando chega um rascunho NOVO (a atualização
    // periódica não apaga o que o advogado está escrevendo).
    const chaveEdicao = rascunho ? rascunho.id : `livre:${conversa.id}`;
    const textoRascunho = rascunho?.texto ?? "";
    useEffect(() => {
        setEdicao((e) => (e.chave === chaveEdicao ? e : { chave: chaveEdicao, texto: textoRascunho }));
    }, [chaveEdicao, textoRascunho]);

    useEffect(() => {
        fimRef.current?.scrollIntoView({ block: "nearest" });
    }, [historico.length, rascunho?.id]);

    const janelaAberta = dentroDaJanela(conversa.ultima_mensagem_cliente_em);
    const titulo = nomeCliente || conversa.nome_contato || telefoneLegivel(conversa.telefone);

    const executar = async (tipo: NonNullable<typeof ocupado>, fn: () => Promise<void>) => {
        setOcupado(tipo);
        try {
            await fn();
            await carregar(true);
            onMudou();
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setOcupado(null);
        }
    };

    const enviar = () =>
        executar("enviar", async () => {
            await chamarAtendimento({
                acao: "enviar_resposta",
                conversaId: conversa.id,
                texto: edicao.texto,
                ...(rascunho ? { rascunhoId: rascunho.id } : {}),
            });
            setEdicao({ chave: "", texto: "" });
            toast.success("Resposta enviada pelo WhatsApp.");
        });

    const gerar = () =>
        executar("gerar", async () => {
            await chamarAtendimento({ acao: "gerar_rascunho", conversaId: conversa.id });
        });

    const descartar = () =>
        executar("descartar", async () => {
            if (rascunho) await descartarRascunhoAtendimento(rascunho.id);
            setEdicao({ chave: `livre:${conversa.id}`, texto: "" });
        });

    const ligarCliente = () =>
        executar("ligar", async () => {
            await atualizarConversaAtendimento(conversa.id, { cliente_id: clienteParaLigar });
            onMudou();
            try {
                await chamarAtendimento({ acao: "gerar_rascunho", conversaId: conversa.id });
            } catch (err) {
                toast.error((err as Error).message);
            }
        });

    const resolver = () =>
        executar("resolver", async () => {
            await atualizarConversaAtendimento(conversa.id, { status: "respondida" });
        });

    const podeEnviar = whatsappPronto && janelaAberta && edicao.texto.trim().length > 0 && !ocupado;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink/15 px-4 py-3">
                <button
                    type="button"
                    onClick={onVoltar}
                    aria-label="Voltar para a lista"
                    className="inline-flex size-8 items-center justify-center text-muted-foreground hover:text-ink lg:hidden"
                >
                    <ArrowLeft className="size-4" />
                </button>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{titulo}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        {telefoneLegivel(conversa.telefone)}
                        {nomeCliente && conversa.nome_contato && conversa.nome_contato !== nomeCliente
                            ? ` · no WhatsApp: ${conversa.nome_contato}`
                            : ""}
                    </p>
                </div>
                {conversa.status === "pendente" && (
                    <button
                        type="button"
                        disabled={Boolean(ocupado)}
                        onClick={() => void resolver()}
                        className="inline-flex h-8 items-center gap-1.5 border border-ink/25 px-3 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50"
                    >
                        <CheckCheck className="size-3.5" />
                        Resolvida sem responder
                    </button>
                )}
            </div>

            {!conversa.cliente_id && (
                <div className="shrink-0 space-y-2 border-b border-gold/50 bg-gold/5 px-4 py-3">
                    <p className="flex items-start gap-2 text-xs text-ink">
                        <UserRound className="mt-0.5 size-3.5 shrink-0" />
                        Este número não bate com nenhum cliente cadastrado. Ligue a conversa ao cliente para a IA poder
                        responder com a base dele.
                    </p>
                    <div className="flex gap-2">
                        <select
                            aria-label="Cliente desta conversa"
                            value={clienteParaLigar}
                            onChange={(e) => setClienteParaLigar(e.target.value)}
                            className="field min-w-0 flex-1 py-1.5 text-sm"
                        >
                            <option value="">Escolha o cliente</option>
                            {clientes.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.nome}
                                    {c.telefone ? ` · ${c.telefone}` : ""}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            disabled={!clienteParaLigar || Boolean(ocupado)}
                            onClick={() => void ligarCliente()}
                            className="inline-flex h-8 shrink-0 items-center gap-1.5 bg-ink px-3 text-xs font-semibold text-white hover:bg-ink/90 disabled:opacity-40"
                        >
                            {ocupado === "ligar" && <Loader2 className="size-3.5 animate-spin" />}
                            Ligar
                        </button>
                    </div>
                </div>
            )}

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-secondary/40 p-4">
                {carregando && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Carregando conversa…
                    </p>
                )}
                {historico.map((m) => {
                    const doCliente = m.direcao === "entrada";
                    return (
                        <div key={m.id} className={cn("flex", doCliente ? "justify-start" : "justify-end")}>
                            <div
                                className={cn(
                                    "max-w-[85%] space-y-0.5 px-3 py-2 text-sm text-ink",
                                    doCliente ? "bg-background" : m.status === "falhou" ? "bg-destructive/10" : "bg-gold/25",
                                )}
                            >
                                <p className={cn("whitespace-pre-wrap", m.tipo === "midia" && "italic text-muted-foreground")}>
                                    {m.texto}
                                </p>
                                <p className="text-[10.5px] text-muted-foreground">
                                    {quando(m.created_at)}
                                    {!doCliente &&
                                        (m.autor === "ia"
                                            ? " · resposta da IA aprovada"
                                            : m.motivo_interno.includes("celular")
                                              ? " · enviada pelo celular"
                                              : " · escrita pelo escritório")}
                                    {m.status === "falhou" && (
                                        <span className="font-semibold text-destructive">
                                            {" "}
                                            · não entregue{m.erro ? ` (${m.erro})` : ""}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={fimRef} />
            </div>

            <div className="shrink-0 space-y-2 border-t border-ink/15 p-3">
                {rascunho && (
                    <div className="space-y-1 text-[11px]">
                        <p className="flex flex-wrap items-center gap-1.5 font-semibold uppercase tracking-wider text-ink">
                            <Bot className="size-3.5" /> Rascunho da IA
                            {rascunho.situacao_ia && (
                                <span
                                    className={cn(
                                        "font-medium normal-case tracking-normal",
                                        rascunho.situacao_ia === "respondido" ? "text-muted-foreground" : "text-destructive",
                                    )}
                                >
                                    · {ROTULO_SITUACAO[rascunho.situacao_ia]}
                                </span>
                            )}
                        </p>
                        {rascunho.fontes.length > 0 && (
                            <p className="text-muted-foreground">Fontes: {rascunho.fontes.map((f) => f.titulo).join("; ")}</p>
                        )}
                        {rascunho.motivo_interno && <p className="text-muted-foreground">Motivo: {rascunho.motivo_interno}</p>}
                    </div>
                )}
                <textarea
                    aria-label={rascunho ? "Rascunho da resposta" : "Resposta ao cliente"}
                    value={edicao.texto}
                    onChange={(e) => setEdicao({ chave: chaveEdicao, texto: e.target.value })}
                    maxLength={4096}
                    rows={rascunho ? 4 : 3}
                    placeholder={
                        conversa.cliente_id ? "Escreva a resposta ou peça um rascunho à IA" : "Escreva a resposta ao contato"
                    }
                    className={cn("field w-full resize-y py-2 text-sm", rascunho && "border-gold/60 bg-gold/5")}
                />
                {!janelaAberta && (
                    <p className="flex items-start gap-1.5 text-xs text-destructive">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        Passaram mais de 24h da última mensagem do cliente: o WhatsApp só libera a resposta quando ele
                        escrever de novo.
                    </p>
                )}
                {!whatsappPronto && (
                    <p className="text-xs text-muted-foreground">
                        O envio fica liberado quando o WhatsApp for configurado no servidor.
                    </p>
                )}
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {rascunho && (
                        <button
                            type="button"
                            disabled={Boolean(ocupado)}
                            onClick={() => void descartar()}
                            className="inline-flex h-8 items-center gap-1.5 px-3 text-xs font-semibold text-muted-foreground hover:text-destructive disabled:opacity-50"
                        >
                            <Trash2 className="size-3.5" />
                            Descartar rascunho
                        </button>
                    )}
                    {conversa.cliente_id && (
                        <button
                            type="button"
                            disabled={Boolean(ocupado)}
                            onClick={() => void gerar()}
                            className="inline-flex h-8 items-center gap-1.5 border border-ink/25 px-3 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50"
                        >
                            {ocupado === "gerar" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                            {rascunho ? "Gerar de novo" : "Rascunho com IA"}
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={!podeEnviar}
                        onClick={() => void enviar()}
                        className="inline-flex h-8 items-center gap-1.5 bg-gold px-3 text-xs font-semibold text-ink hover:bg-gold-light disabled:opacity-50"
                    >
                        {ocupado === "enviar" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                        Enviar ao cliente
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ Caixa de entrada */

export function AtendimentoSistema({ onPendentesChange }: { onPendentesChange?: (n: number) => void }) {
    const [conversas, setConversas] = useState<ConversaAtendimento[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [indisponivel, setIndisponivel] = useState(false);
    const [filtro, setFiltro] = useState<"pendentes" | "todas">("pendentes");
    const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
    const [status, setStatus] = useState<StatusWhatsApp | null>(null);

    const carregar = useCallback(
        async (silencioso = false) => {
            try {
                const lista = await listarConversasAtendimento();
                setConversas(lista);
                onPendentesChange?.(lista.filter((c) => c.status === "pendente").length);
            } catch (err) {
                if (tabelaAusente(err)) setIndisponivel(true);
                else if (!silencioso) toast.error((err as Error).message);
            } finally {
                setCarregando(false);
            }
        },
        [onPendentesChange],
    );

    useEffect(() => {
        void carregar();
        void listarClientes()
            .then(setClientes)
            .catch(() => undefined);
        void chamarAtendimento<StatusWhatsApp>({ acao: "status_whatsapp" })
            .then((s) => setStatus({ configurado: s.configurado, avisoPorWhatsApp: s.avisoPorWhatsApp }))
            .catch(() => setStatus({ configurado: false, avisoPorWhatsApp: false }));
    }, [carregar]);
    useIntervaloVisivel(() => void carregar(true), POLL_CONVERSAS_MS, !indisponivel);

    const nomePorCliente = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);
    const pendentes = conversas.filter((c) => c.status === "pendente").length;
    const visiveis = filtro === "pendentes" ? conversas.filter((c) => c.status === "pendente") : conversas;
    const selecionada = conversas.find((c) => c.id === selecionadaId) ?? null;

    if (indisponivel) {
        return (
            <div className="border border-ink/20 bg-card p-6 sm:p-8">
                <div className="flex items-start gap-3">
                    <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-deep" />
                    <div className="space-y-2">
                        <h2 className="sys-section text-ink">O atendimento pelo WhatsApp precisa da migração do banco</h2>
                        <p className="max-w-xl text-sm text-muted-foreground">
                            Aplique a migração{" "}
                            <code className="bg-secondary px-1 py-0.5 text-xs">20261127130000_atendimento_whatsapp.sql</code> (
                            <code className="bg-secondary px-1 py-0.5 text-xs">supabase db push</code>) e recarregue a página.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {status && !status.configurado && (
                <div className="flex items-start gap-3 border border-gold/60 bg-gold/5 p-4 text-sm">
                    <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-deep" />
                    <p className="text-ink">
                        O número de WhatsApp do escritório ainda não foi ligado ao sistema. As conversas aparecem aqui assim
                        que as chaves da YCloud forem configuradas na Vercel.{" "}
                        <Link
                            to={`${BASE_ROTA}/configuracoes?aba=integracoes&integracao=whatsapp`}
                            className="font-semibold underline"
                        >
                            Ver como configurar
                        </Link>
                    </p>
                </div>
            )}

            <div className="grid h-[calc(100dvh-13rem)] min-h-[28rem] border border-ink/15 bg-card lg:grid-cols-[20rem_1fr]">
                <aside className={cn("flex min-h-0 flex-col border-ink/15 lg:border-r", selecionada && "hidden lg:flex")}>
                    <div
                        role="tablist"
                        aria-label="Filtro das conversas"
                        className="flex shrink-0 gap-5 border-b border-ink/15 px-4"
                    >
                        {(
                            [
                                { id: "pendentes", rotulo: `Pendentes (${pendentes})` },
                                { id: "todas", rotulo: "Todas" },
                            ] as const
                        ).map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                role="tab"
                                aria-selected={filtro === f.id}
                                onClick={() => setFiltro(f.id)}
                                className={cn(
                                    "-mb-px inline-flex h-10 items-center border-b-2 text-sm font-semibold transition-colors duration-150",
                                    filtro === f.id
                                        ? "border-ink text-ink"
                                        : "border-transparent text-muted-foreground hover:text-ink",
                                )}
                            >
                                {f.rotulo}
                            </button>
                        ))}
                    </div>
                    <ul className="min-h-0 flex-1 divide-y divide-ink/10 overflow-y-auto">
                        {carregando && (
                            <li className="flex items-center gap-1.5 px-4 py-3 text-xs text-muted-foreground">
                                <Loader2 className="size-3.5 animate-spin" /> Carregando…
                            </li>
                        )}
                        {!carregando && visiveis.length === 0 && (
                            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                                {filtro === "pendentes" ? "Nenhuma mensagem esperando resposta." : "Nenhuma conversa ainda."}
                            </li>
                        )}
                        {visiveis.map((c) => {
                            const nome =
                                (c.cliente_id && nomePorCliente.get(c.cliente_id)) ||
                                c.nome_contato ||
                                telefoneLegivel(c.telefone);
                            return (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelecionadaId(c.id)}
                                        aria-current={c.id === selecionadaId ? "true" : undefined}
                                        className={cn(
                                            "flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-ink/[0.03]",
                                            c.id === selecionadaId && "bg-ink/[0.05]",
                                        )}
                                    >
                                        <span
                                            aria-hidden
                                            className={cn(
                                                "mt-1.5 size-2 shrink-0",
                                                c.status === "pendente" ? "bg-gold-deep" : "bg-transparent",
                                            )}
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-baseline justify-between gap-2">
                                                <span
                                                    className={cn(
                                                        "truncate text-sm text-ink",
                                                        c.status === "pendente" && "font-semibold",
                                                    )}
                                                >
                                                    {nome}
                                                </span>
                                                <span className="shrink-0 text-[11px] text-muted-foreground">
                                                    {quando(c.ultima_mensagem_em)}
                                                </span>
                                            </span>
                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                {c.ultima_mensagem_previa}
                                            </span>
                                            {!c.cliente_id && (
                                                <span className="mt-1 inline-block border border-gold/60 px-1.5 text-[10.5px] font-semibold text-gold-deep">
                                                    Sem cadastro
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </aside>

                <section className={cn("min-h-0", !selecionada && "hidden lg:block")}>
                    {selecionada ? (
                        <PainelConversa
                            key={selecionada.id}
                            conversa={selecionada}
                            nomeCliente={(selecionada.cliente_id && nomePorCliente.get(selecionada.cliente_id)) || ""}
                            clientes={clientes}
                            whatsappPronto={Boolean(status?.configurado)}
                            onVoltar={() => setSelecionadaId(null)}
                            onMudou={() => void carregar(true)}
                        />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
                            <MessageCircle aria-hidden className="size-8 text-ink/25" />
                            <p>Escolha uma conversa para ver as mensagens e o rascunho da IA.</p>
                            <p className="max-w-sm text-xs">
                                Nada é enviado ao cliente sem o seu clique em{" "}
                                <strong className="text-ink">Enviar ao cliente</strong>.
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
