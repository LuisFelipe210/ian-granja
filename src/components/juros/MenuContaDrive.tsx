import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ErroGoogleDrive, desconectarContaDrive, trocarContaDrive } from "@/lib/google-drive";

interface MenuContaDriveProps {
    conta: string;
    disabled?: boolean;
    className?: string;
}

const itemClass =
    "flex cursor-pointer select-none items-center gap-2.5 px-3 py-2 text-xs font-medium outline-none transition-colors duration-150 data-[disabled]:cursor-default data-[disabled]:opacity-50";

/**
 * Seta ao lado do "Salvar no Drive": mostra a conta Google conectada e permite trocar de conta
 * ou desconectar. Só aparece depois que alguma conta foi usada neste navegador.
 */
export const MenuContaDrive = ({ conta, disabled, className }: MenuContaDriveProps) => {
    const trocar = async () => {
        try {
            const nova = await trocarContaDrive();
            if (nova) toast.success(`Google Drive conectado como ${nova}.`);
        } catch (e) {
            if (e instanceof ErroGoogleDrive && e.codigo === "cancelado") return;
            toast.error(e instanceof Error ? e.message : "Não foi possível trocar a conta do Google Drive.");
        }
    };

    const desconectar = async () => {
        await desconectarContaDrive();
        toast.success("Google Drive desconectado deste navegador.");
    };

    return (
        <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger
                disabled={disabled}
                aria-label={`Conta do Google Drive: ${conta}`}
                title={`Google Drive: ${conta}`}
                className={cn(
                    // Fica dentro do botão "Salvar no Drive": sem borda própria, só um filete à esquerda.
                    "inline-flex items-center rounded-none border-l border-ink/20 px-2 text-ink/70 outline-none transition-colors duration-150 hover:bg-ink/5 hover:text-ink focus-visible:bg-ink/10 disabled:opacity-60 data-[state=open]:bg-ink data-[state=open]:text-paper",
                    className,
                )}
            >
                <ChevronDown aria-hidden className="size-3.5" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    collisionPadding={8}
                    className="z-50 min-w-[15rem] max-w-[20rem] border border-ink/25 bg-card py-1 shadow-xl"
                >
                    <DropdownMenu.Label className="px-3 pb-2 pt-1.5">
                        <span className="block text-[0.6875rem] font-semibold uppercase tracking-wide text-ink/55">
                            Google Drive conectado
                        </span>
                        <span className="block truncate text-xs font-medium text-ink">{conta}</span>
                    </DropdownMenu.Label>
                    <DropdownMenu.Separator className="my-1 h-px bg-ink/10" />
                    <DropdownMenu.Item
                        onSelect={() => void trocar()}
                        className={cn(itemClass, "text-ink data-[highlighted]:bg-ink/5")}
                    >
                        <UserRoundCog aria-hidden strokeWidth={1.85} className="size-4 shrink-0 text-ink/65" />
                        Trocar conta
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        onSelect={() => void desconectar()}
                        className={cn(itemClass, "text-destructive data-[highlighted]:bg-destructive/[0.07]")}
                    >
                        <LogOut aria-hidden strokeWidth={1.85} className="size-4 shrink-0" />
                        Desconectar
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
};
