import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Loader2, MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AcaoLinha {
    id: string;
    rotulo: string;
    Icone: LucideIcon;
    onSelect: () => void;
    disabled?: boolean;
    carregando?: boolean;
    destrutiva?: boolean;
}

interface MenuAcoesLinhaProps {
    /** Nome do cliente/caso, usado no rótulo acessível do botão. */
    contexto: string;
    acoes: AcaoLinha[];
    className?: string;
}

/**
 * Menu "⋯" para as ações secundárias de uma linha de tabela ou cartão.
 * Renderiza em portal (não é cortado pelo overflow da tabela) e mantém
 * o vocabulário do sistema: cantos retos, borda de 1px e sombra só na camada flutuante.
 */
export const MenuAcoesLinha = ({ contexto, acoes, className }: MenuAcoesLinhaProps) => {
    const algumaCarregando = acoes.some((a) => a.carregando);
    const comuns = acoes.filter((a) => !a.destrutiva);
    const destrutivas = acoes.filter((a) => a.destrutiva);

    const renderItem = (acao: AcaoLinha) => {
        const { Icone } = acao;
        return (
            <DropdownMenu.Item
                key={acao.id}
                disabled={acao.disabled || acao.carregando}
                onSelect={acao.onSelect}
                className={cn(
                    "flex cursor-pointer select-none items-center gap-2.5 px-3 py-2 text-xs font-medium outline-none transition-colors duration-150 data-[disabled]:cursor-default data-[disabled]:opacity-50",
                    acao.destrutiva
                        ? "text-destructive data-[highlighted]:bg-destructive/[0.07]"
                        : "text-ink data-[highlighted]:bg-ink/5",
                )}
            >
                {acao.carregando ? (
                    <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
                ) : (
                    <Icone
                        aria-hidden
                        strokeWidth={1.85}
                        className={cn("size-4 shrink-0", !acao.destrutiva && "text-ink/65")}
                    />
                )}
                {acao.rotulo}
            </DropdownMenu.Item>
        );
    };

    return (
        <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger
                aria-label={`Mais ações para ${contexto}`}
                title="Mais ações"
                className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center border border-ink/25 text-ink/75 outline-none transition-colors duration-150 hover:border-ink/50 hover:bg-ink/5 hover:text-ink focus-visible:border-ink data-[state=open]:border-ink data-[state=open]:bg-ink data-[state=open]:text-paper",
                    className,
                )}
            >
                {algumaCarregando ? (
                    <Loader2 aria-hidden className="size-3.5 animate-spin" />
                ) : (
                    <MoreHorizontal aria-hidden className="size-4" strokeWidth={1.85} />
                )}
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    collisionPadding={8}
                    className="z-50 min-w-[13rem] border border-ink/25 bg-card py-1 shadow-xl"
                >
                    {comuns.map(renderItem)}
                    {destrutivas.length > 0 && comuns.length > 0 && (
                        <DropdownMenu.Separator className="my-1 h-px bg-ink/10" />
                    )}
                    {destrutivas.map(renderItem)}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
};
