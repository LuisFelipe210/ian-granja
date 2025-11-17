import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
// Importando o hook que está definido em App.tsx (a ser exportado lá)
import { useContactDrawer } from "@/App";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
    className?: string;
    activeClassName?: string;
    pendingClassName?: string;
    // Nova prop para links de contato
    isContactLink?: boolean;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
    ({ className, activeClassName, pendingClassName, to, isContactLink, onClick, ...props }, ref) => {

        // Novo bloco de lógica para o Contact Drawer
        if (isContactLink) {
            // Usa o hook para obter a função de abertura
            const { openDrawer } = useContactDrawer();

            const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                e.stopPropagation();
                openDrawer(); // Chama a função para abrir o drawer
                onClick?.(e as any);
            };

            // Retorna uma tag <a> que age como botão, forçando a abertura do drawer
            return (
                <a
                    ref={ref as any}
                    href="#"
                    onClick={handleClick}
                    className={cn(className)}
                    {...props}
                >
                    {props.children}
                </a>
            );
        }

        // Lógica original do NavLink para todas as outras rotas
        return (
            <RouterNavLink
                ref={ref}
                to={to}
                onClick={onClick}
                className={({ isActive, isPending }) =>
                    cn(className, isActive && activeClassName, isPending && pendingClassName)
                }
                {...props}
            />
        );
    },
);

NavLink.displayName = "NavLink";

export { NavLink };