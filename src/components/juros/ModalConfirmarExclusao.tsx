import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { useTravarRolagem } from "@/lib/use-travar-rolagem";
import { frasesIguais } from "@/lib/confirmacao";

/**
 * Confirmação no estilo do GitHub: o botão de excluir só libera depois que a pessoa digita
 * a frase pedida (o nome do cliente ou "excluir N clientes").
 */
export function ModalConfirmarExclusao({
    aberto,
    titulo,
    children,
    fraseConfirmacao,
    rotuloBotao,
    excluindo,
    onConfirmar,
    onCancelar,
}: {
    aberto: boolean;
    titulo: string;
    children: ReactNode;
    fraseConfirmacao: string;
    rotuloBotao: string;
    excluindo: boolean;
    onConfirmar: () => void;
    onCancelar: () => void;
}) {
    useTravarRolagem(aberto);
    const [digitado, setDigitado] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const idTitulo = useId();
    const idCampo = useId();

    useEffect(() => {
        if (!aberto) return;
        setDigitado("");
        const t = setTimeout(() => inputRef.current?.focus(), 30);
        return () => clearTimeout(t);
    }, [aberto]);

    useEffect(() => {
        if (!aberto) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !excluindo) onCancelar();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [aberto, excluindo, onCancelar]);

    if (!aberto) return null;
    const liberado = frasesIguais(digitado, fraseConfirmacao) && !excluindo;

    return createPortal(
        <div role="dialog" aria-modal="true" aria-labelledby={idTitulo} className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div aria-hidden onClick={() => !excluindo && onCancelar()} className="fixed inset-0 bg-ink-deep/55" />
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (liberado) onConfirmar();
                }}
                className="relative z-10 w-full max-w-md border border-ink/20 bg-card shadow-2xl"
            >
                <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
                    <h2 id={idTitulo} className="flex items-center gap-2 text-base font-semibold text-ink">
                        <AlertTriangle aria-hidden className="size-5 shrink-0 text-destructive" />
                        {titulo}
                    </h2>
                    <button
                        type="button"
                        onClick={onCancelar}
                        disabled={excluindo}
                        aria-label="Fechar"
                        className="inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:text-ink"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4 text-sm text-ink">
                    {children}
                    <div className="border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-ink">
                        Essa ação não pode ser desfeita.
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor={idCampo} className="block text-sm">
                            Para confirmar, digite{" "}
                            <strong className="select-all bg-secondary px-1 py-0.5 font-semibold">{fraseConfirmacao}</strong>{" "}
                            abaixo:
                        </label>
                        <input
                            ref={inputRef}
                            id={idCampo}
                            value={digitado}
                            onChange={(e) => setDigitado(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            disabled={excluindo}
                            className="h-9 w-full border border-ink/25 bg-background px-2.5 text-sm text-ink outline-none focus:border-ink"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-ink/10 px-5 py-3">
                    <button
                        type="button"
                        onClick={onCancelar}
                        disabled={excluindo}
                        className="inline-flex h-9 items-center px-3 text-xs font-semibold text-muted-foreground hover:text-ink"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={!liberado}
                        className="inline-flex h-9 items-center gap-1.5 bg-destructive px-4 text-xs font-semibold text-white transition-opacity hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {excluindo ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        {rotuloBotao}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
}
