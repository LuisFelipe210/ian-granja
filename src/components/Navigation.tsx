import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import logoDesktop from "@/assets/logo2.png";
import logoMobile from "@/assets/logo3.jpg";

export const Navigation = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        document.body.style.overflow = isMenuOpen ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isMenuOpen]);

    const navItems = [
        { to: "/", label: "Início" },
        { to: "/atuacao", label: "Áreas de Atuação" },
        { to: "/sobre", label: "Sobre" },
        { to: "/faq", label: "Dúvidas" },
    ];

    return (
        <>
            <header
                className={cn(
                    "fixed top-0 left-0 w-full z-50 transition-all duration-500 ease-in-out",
                    scrolled
                        ? "py-2 bg-primary/95 backdrop-blur-md shadow-md border-b border-white/10" // Ajustei pro azul escuro executivo
                        : "py-6 bg-transparent"
                )}
            >
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">

                        {/* --- LOGO --- */}
                        <NavLink
                            to="/"
                            className="flex items-center gap-3 group relative z-50 shrink-0"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            <img
                                src={logoMobile}
                                alt="Logo"
                                className="lg:hidden h-16 w-auto object-contain transition-transform duration-300 group-hover:scale-105 rounded-md"
                            />
                            <img
                                src={logoDesktop}
                                alt="Logo"
                                className="hidden lg:block h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                            />
                        </NavLink>

                        {/* --- MENU DESKTOP --- */}
                        <div className="hidden lg:flex items-center">
                            <nav className="flex items-center gap-1">
                                <ul className="flex items-center px-2">
                                    {navItems.map((item) => (
                                        <li key={item.to}>
                                            <NavLink
                                                to={item.to}
                                                className={({ isActive }) => cn(
                                                    "text-sm font-bold px-4 py-2 rounded-full transition-all duration-300 block",
                                                    isActive
                                                        ? "text-white bg-white/20"
                                                        : "text-white/90 hover:text-white hover:bg-white/10"
                                                )}
                                            >
                                                {item.label}
                                            </NavLink>
                                        </li>
                                    ))}
                                </ul>

                                <div className="h-5 w-px bg-white/30 mx-3" />

                                <div className="flex items-center gap-2">
                                    <Button
                                        asChild
                                        size="sm"
                                        className="rounded-full font-bold shadow-lg bg-white text-[#0f172a] hover:bg-white/90 hover:-translate-y-0.5 transition-all"
                                    >
                                        {/* AQUI MUDOU, CARALHO: Agora vai pra /contato */}
                                        <NavLink to="/contato">
                                            Agendar
                                            <ArrowRight className="ml-1 h-3 w-3" />
                                        </NavLink>
                                    </Button>
                                </div>
                            </nav>
                        </div>

                        {/* --- MENU MOBILE TOGGLE --- */}
                        <div className="lg:hidden flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="relative z-50 text-white hover:bg-white/20 rounded-full"
                            >
                                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* --- MOBILE OVERLAY --- */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-primary/95 backdrop-blur-xl lg:hidden transition-all duration-300",
                    isMenuOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
                )}
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col h-full justify-center items-center px-6 gap-8">
                    <nav className="flex flex-col items-center gap-6">
                        {navItems.map((item, index) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setIsMenuOpen(false)}
                                className={({ isActive }) => cn(
                                    "text-3xl font-bold transition-colors tracking-tight",
                                    isActive ? "text-white scale-110" : "text-white/70 hover:text-white"
                                )}
                                style={{
                                    transitionDelay: isMenuOpen ? `${index * 50}ms` : '0ms'
                                }}
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="w-16 h-1 bg-white/20 rounded-full" />

                    <div className="flex flex-col gap-4 w-full max-w-xs">
                        <Button
                            asChild
                            size="lg"
                            className="w-full text-lg font-bold h-14 rounded-2xl shadow-xl bg-white text-[#0f172a] hover:bg-white/90"
                        >
                            {/* AQUI TAMBÉM MUDOU: Link corrigido */}
                            <NavLink to="/contato" onClick={() => setIsMenuOpen(false)}>
                                <Phone className="mr-2 h-5 w-5" />
                                Consulta Gratuita
                            </NavLink>
                        </Button>
                        <p className="text-center text-xs text-white/50 uppercase tracking-widest">
                            Seg - Sex • 08h às 18h
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};