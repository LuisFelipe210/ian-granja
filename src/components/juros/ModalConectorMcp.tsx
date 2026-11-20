import { useState } from "react";
import { Check, Copy, Plug, X } from "lucide-react";
import { ModalDialog } from "@/components/juros/ModalDialog";

interface ModalConectorMcpProps {
    aberto: boolean;
    onFechar: () => void;
}

interface BotaoCopiarProps {
    copiado: boolean;
    rotulo: string;
    onCopiar: () => void;
}

const BotaoCopiar = ({ copiado, rotulo, onCopiar }: BotaoCopiarProps) => (
    <button
        type="button"
        onClick={onCopiar}
        className="inline-flex shrink-0 items-center gap-1 border border-ink/30 px-2 py-1 text-[11px] font-semibold text-ink hover:bg-ink/5"
    >
        {copiado ? <Check aria-hidden className="size-3" /> : <Copy aria-hidden className="size-3" />}
        {copiado ? "Copiado" : rotulo}
    </button>
);

/** Conteúdo das instruções (usado na janela e na página Configurações > Integrações). */
export const ConteudoConectorMcp = ({ className, semIntro = false }: { className?: string; semIntro?: boolean }) => {
    const [copiadoBloco, setCopiadoBloco] = useState<string | null>(null);

    const copiarTexto = async (chave: string, texto: string) => {
        try {
            await navigator.clipboard.writeText(texto);
            setCopiadoBloco(chave);
            setTimeout(() => setCopiadoBloco(null), 1800);
        } catch {
            /* sem permissão de área de transferência: o texto continua visível para copiar à mão */
        }
    };

    const origem = typeof window !== "undefined" ? window.location.origin : "https://www.iangranja.adv.br";
    const urlMcp = `${origem}/api/mcp`;
    const jsonDesktop = JSON.stringify(
        {
            mcpServers: {
                "ian-granja-revisional": {
                    command: "node",
                    args: ["--experimental-strip-types", "scripts/mcp-revisional.ts"],
                },
            },
        },
        null,
        2,
    );

    return (
        <div className={className ?? "space-y-5 text-xs leading-relaxed text-ink"}>
                    {!semIntro && (
                        <p className="text-sm text-muted-foreground">
                            Com o conector ligado, você manda o contrato (PDF ou foto) direto no Claude e ele faz o cálculo
                            revisional com o motor oficial desta calculadora, cadastra o cliente na carteira, renova
                            cálculos, muda fases e consulta casos.
                        </p>
                    )}

                    <div className="space-y-2 border border-ink/20 bg-secondary/40 p-3.5">
                        <p className="font-bold text-ink">Exemplos do que pedir no Claude:</p>
                        <ul className="list-disc space-y-1 pl-4 text-ink/90">
                            <li>
                                “Lê esse contrato, faz o cálculo revisional pela média do BACEN com seguro prestamista em
                                dobro, cadastra o cliente na fase Triagem e me dá o resumo para a inicial.”
                            </li>
                            <li>“Atualiza o cálculo de João da Silva para a data de hoje.”</li>
                            <li>“Move a cliente Maria para a fase Ajuizado.”</li>
                            <li>“Quais clientes do Banco Pan têm abuso acima de 1,8x?”</li>
                        </ul>
                    </div>

                    <section className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <h4 className="text-[13px] font-semibold text-ink">1. Conector remoto HTTP (Bearer / header)</h4>
                            <BotaoCopiar
                                copiado={copiadoBloco === "http"}
                                rotulo="Copiar URL"
                                onCopiar={() => void copiarTexto("http", urlMcp)}
                            />
                        </div>
                        <ol className="list-decimal space-y-1 pl-4 text-ink/90">
                            <li>
                                No cliente MCP (Claude Code, Cursor ou conector remoto com suporte a cabeçalhos), configure o
                                endpoint abaixo:
                            </li>
                            <li>
                                Envie o token no cabeçalho <code>Authorization: Bearer SEU_TOKEN</code> (ou{" "}
                                <code>x-mcp-token: SEU_TOKEN</code>). Por segurança, o token não é aceito na URL.
                            </li>
                            <li>Salve e ative o conector numa conversa nova.</li>
                        </ol>
                        <code className="block break-all border border-ink/20 bg-secondary px-3 py-2 text-[11px] font-semibold text-ink">
                            {urlMcp}
                        </code>
                        <p className="text-[11px] text-muted-foreground">
                            O token é o valor de <code>MCP_AUTH_TOKEN</code> nas variáveis de ambiente da Vercel. Ele não
                            aparece aqui por segurança: peça a quem administra o site.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <h4 className="text-[13px] font-semibold text-ink">2. Claude Desktop ou Claude Code (neste computador)</h4>
                            <BotaoCopiar
                                copiado={copiadoBloco === "desktop"}
                                rotulo="Copiar JSON"
                                onCopiar={() => void copiarTexto("desktop", jsonDesktop)}
                            />
                        </div>
                        <pre className="overflow-x-auto border border-ink/20 bg-ink-deep p-3 text-[11px] text-paper">
                            {jsonDesktop}
                        </pre>
                        <p className="text-[11px] text-muted-foreground">
                            O arquivo <code>.mcp.json</code> já está na raiz do projeto e o conector está registrado como{" "}
                            <code>ian-granja-revisional</code> no Claude Desktop deste Mac.
                        </p>
                    </section>
                </div>
    );
};

/**
 * Instruções para conectar o Claude (site, app, Desktop ou Code) ao sistema pelo conector MCP:
 * cadastrar contratos por PDF/foto, renovar cálculos, mover fases e consultar a carteira direto no Claude.
 */
export const ModalConectorMcp = ({ aberto, onFechar }: ModalConectorMcpProps) => (
    <ModalDialog
        aberto={aberto}
        onFechar={onFechar}
        ariaLabelledBy="mcp-modal-title"
        tituloAcessivel="Conectar o Claude ao sistema"
        contentClassName="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden border border-ink/30 bg-card shadow-2xl"
    >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink/20 bg-ink px-5 py-3.5 text-paper">
            <div className="flex items-center gap-2">
                <Plug aria-hidden className="size-4 text-gold-light" />
                <h3 id="mcp-modal-title" className="sys-title text-paper">
                    Conectar o Claude ao sistema
                </h3>
            </div>
            <button
                type="button"
                onClick={onFechar}
                aria-label="Fechar janela"
                className="inline-flex size-8 items-center justify-center text-paper/75 hover:text-paper"
            >
                <X className="size-4" />
            </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
            <ConteudoConectorMcp />
        </div>
    </ModalDialog>
);
