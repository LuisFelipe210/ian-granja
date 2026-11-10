import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Cta } from "@/components/Cta";
import { HOURS } from "@/lib/contact";
import logo from "@/assets/logo2.png";

const navItems = [
    { to: "/", label: "Início" },
    { to: "/atuacao", label: "Áreas de atuação" },
    { to: "/sobre", label: "Sobre" },
    { to: "/faq", label: "Dúvidas" },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export const Navigation = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const { pathname } = useLocation();
    const reduce = useReducedMotion();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        document.body.style.overflow = isMenuOpen ? "hidden" : "";
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsMenuOpen(false);
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", onKey);
        };
    }, [isMenuOpen]);

    return (
        <>
            <header
                className={cn(
                    "fixed inset-x-0 top-0 z-50 border-b bg-ink text-paper transition-colors duration-300",
                    scrolled || isMenuOpen ? "border-paper/15" : "border-transparent",
                )}
            >
                <div className="container flex h-[4.5rem] items-center justify-between gap-6">
                    <Link to="/" className="shrink-0" aria-label="Ian Granja Advogados, página inicial">
                        <img src={logo} alt="Ian Granja Advogados" width={768} height={132} className="h-9 w-auto md:h-10" />
                    </Link>

                    <nav aria-label="Principal" className="hidden items-center gap-9 lg:flex">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === "/"}
                                className={({ isActive }) =>
                                    cn(
                                        "relative py-2 text-[0.9375rem] font-medium transition-colors duration-200",
                                        "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:bg-gold-light after:transition-transform after:duration-300 after:ease-out",
                                        isActive
                                            ? "text-paper after:scale-x-100"
                                            : "text-paper/75 after:scale-x-0 hover:text-paper hover:after:scale-x-100",
                                    )
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                        <Link
                            to="/contato"
                            className="inline-flex h-11 items-center border border-gold-light/70 px-5 text-[0.9375rem] font-semibold text-gold-light transition-colors duration-200 hover:bg-gold-light hover:text-ink"
                        >
                            Agendar
                        </Link>
                    </nav>

                    <button
                        type="button"
                        onClick={() => setIsMenuOpen((open) => !open)}
                        aria-expanded={isMenuOpen}
                        aria-controls="menu-mobile"
                        aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
                        className="-mr-2 inline-flex size-11 items-center justify-center text-paper lg:hidden"
                    >
                        {isMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
                    </button>
                </div>
            </header>

            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        id="menu-mobile"
                        initial={reduce ? false : { clipPath: "inset(0 0 100% 0)" }}
                        animate={{ clipPath: "inset(0 0 0% 0)" }}
                        exit={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
                        transition={{ duration: 0.5, ease: EASE }}
                        className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-ink px-5 pb-8 pt-[6.5rem] text-paper lg:hidden"
                    >
                        <nav aria-label="Principal" className="flex flex-col border-t border-paper/20">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.to === "/"}
                                    className={({ isActive }) =>
                                        cn(
                                            "subdisplay border-b border-paper/20 py-5 text-[2rem]",
                                            isActive ? "text-gold-light" : "text-paper",
                                        )
                                    }
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                            <NavLink
                                to="/contato"
                                className={({ isActive }) =>
                                    cn(
                                        "subdisplay border-b border-paper/20 py-5 text-[2rem]",
                                        isActive ? "text-gold-light" : "text-paper",
                                    )
                                }
                            >
                                Contato
                            </NavLink>
                        </nav>

                        <div className="mt-auto pt-10">
                            <Cta whatsapp="Olá! Quero mandar um documento para o Ian dar uma olhada." className="w-full">
                                Mandar meu documento
                            </Cta>
                            <p className="mt-4 text-sm text-paper/75">{HOURS}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
