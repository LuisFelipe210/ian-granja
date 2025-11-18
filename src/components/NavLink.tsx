import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { useContactDrawer } from "@/App";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
    className?: string;
    activeClassName?: string;
    pendingClassName?: string;
    isContactLink?: boolean;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
    ({ className, activeClassName, pendingClassName, to, isContactLink, onClick, ...props }, ref) => {

        if (isContactLink) {
            const { openDrawer } = useContactDrawer();

            const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                e.stopPropagation();
                openDrawer();
            };

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