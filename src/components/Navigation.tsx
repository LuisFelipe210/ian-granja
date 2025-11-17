import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo2.png"; // Importação da logo

export const Navigation = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        document.body.style.overflow = mobileMenuOpen ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [mobileMenuOpen]);

    const closeMobileMenu = () => setMobileMenuOpen(false);

    const navItems = [
        { to: "/", label: "Início" },
        { to: "/sobre", label: "Sobre" },
        { to: "/atuacao", label: "Atuação" },
        { to: "/faq", label: "FAQ" },
    ];

    const linkClasses = "relative text-base font-bold text-foreground/90 transition-all duration-300 hover:text-accent group px-3 py-1 rounded-lg hover:bg-muted/50";
    const activeLinkClasses = "text-accent after:scale-x-100 bg-muted/50 dark:bg-primary/30";

    return (
        <>
            <nav
                className={cn(
                    "fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
                    "bg-background/80 dark:bg-primary/50 backdrop-blur-lg shadow-xl border border-border/50",
                    "h-[70px] w-[95%] rounded-lg"
                )}
            >
                <div className="px-4 sm:px-6 h-full flex items-center justify-between">
                    <NavLink to="/" className="flex items-center space-x-3 group" onClick={closeMobileMenu}>

                        {/* LOGO SUBSTITUÍDA AQUI, DESGRAÇA */}
                        <img
                            src={logoImg}
                            alt="Ian Granja Advocacia Logo"
                            className="h-10 w-auto transition-all duration-300 group-hover:scale-105"
                        />

                        <div className="hidden sm:block">
                            <div className="text-xl font-extrabold text-foreground transition-colors duration-300 group-hover:text-accent">
                                Ian Granja
                            </div>
                        </div>
                    </NavLink>

                    <div className="flex items-center gap-2">
                        <div className="hidden lg:flex items-center space-x-4 lg:space-x-6">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={linkClasses}
                                    activeClassName={activeLinkClasses}
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>

                        <Button
                            variant="default"
                            size="sm"
                            asChild
                            className="hidden lg:flex bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:shadow-xl transition-all duration-300 text-sm px-6 py-2 h-10 font-bold"
                        >
                            <NavLink to="#" isContactLink>
                                <Phone className="mr-2 h-4 w-4" />
                                Fale com Advogado
                            </NavLink>
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden h-10 w-10 text-foreground hover:bg-muted/50 rounded-full transition-colors duration-200 relative z-50"
                            aria-expanded={mobileMenuOpen}
                            aria-controls="mobile-menu"
                        >
                            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </Button>
                    </div>
                </div>
            </nav>

            <div
                id="mobile-menu"
                className={cn(
                    "fixed inset-0 z-40 lg:hidden transition-opacity duration-300",
                    "bg-background/95 dark:bg-primary/95 backdrop-blur-lg",
                    mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                )}
                onClick={closeMobileMenu}
            >
                <div
                    className={cn(
                        "h-full w-full flex flex-col items-center justify-center transition-all duration-300",
                        mobileMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex flex-col items-center space-y-8 px-6 w-full">
                        {navItems.map((item, index) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={closeMobileMenu}
                                className="text-3xl font-bold text-foreground dark:text-primary-foreground hover:text-accent transition-all duration-300 uppercase tracking-wide hover:scale-110 active:scale-95"
                                activeClassName="text-accent"
                                style={{ transitionDelay: mobileMenuOpen ? `${index * 50}ms` : '0ms' }}
                            >
                                {item.label}
                            </NavLink>
                        ))}

                        <div className="w-1/3 h-px bg-gradient-to-r from-transparent via-accent to-transparent my-6" />

                        <Button
                            size="lg"
                            className="flex items-center gap-3 text-lg font-bold uppercase transition-all duration-300 hover:scale-105 active:scale-95 border-2 border-accent/50 px-8 py-4 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-xl"
                            asChild
                            onClick={closeMobileMenu}
                        >
                            <NavLink to="#" isContactLink>
                                <Phone className="h-6 w-6"/> Fale com Advogado
                            </NavLink>
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
};