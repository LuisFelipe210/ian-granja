import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalDialogProps {
    aberto: boolean;
    onFechar: () => void;
    /** Impede fechamento por Escape ou clique fora (ex.: modal obrigatório ou envio em andamento). */
    bloquearFechamento?: boolean;
    /** ID do título visível dentro do conteúdo (usado em aria-labelledby). */
    ariaLabelledBy?: string;
    /** Título acessível oculto quando não há Dialog.Title explícito. */
    tituloAcessivel?: string;
    overlayClassName?: string;
    contentClassName?: string;
    children: ReactNode;
}

/**
 * Wrapper de diálogo acessível baseado em @radix-ui/react-dialog:
 * fornece focus trap, fechamento por Escape, restauração de foco e bloqueio de rolagem nativos.
 */
export function ModalDialog({
    aberto,
    onFechar,
    bloquearFechamento = false,
    ariaLabelledBy,
    tituloAcessivel = "Janela de diálogo",
    overlayClassName,
    contentClassName,
    children,
}: ModalDialogProps) {
    return (
        <Dialog.Root
            open={aberto}
            onOpenChange={(open) => {
                if (!open && !bloquearFechamento) onFechar();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay
                    className={cn(
                        "fixed inset-0 z-[100] bg-ink-deep/65 overscroll-contain",
                        overlayClassName,
                    )}
                />
                <Dialog.Content
                    aria-labelledby={ariaLabelledBy}
                    aria-describedby={undefined}
                    onEscapeKeyDown={(e) => {
                        if (bloquearFechamento) e.preventDefault();
                    }}
                    onPointerDownOutside={(e) => {
                        if (bloquearFechamento) e.preventDefault();
                    }}
                    onInteractOutside={(e) => {
                        if (bloquearFechamento) e.preventDefault();
                    }}
                    className={cn(
                        "fixed left-1/2 top-1/2 z-[101] -translate-x-1/2 -translate-y-1/2 focus:outline-none",
                        contentClassName,
                    )}
                >
                    <Dialog.Title className="sr-only">{tituloAcessivel}</Dialog.Title>
                    {children}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
