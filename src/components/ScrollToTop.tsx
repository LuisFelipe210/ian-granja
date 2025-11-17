import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Componente que garante que a janela sempre role para o topo
 * quando a rota de navegação muda.
 */
export const ScrollToTop = () => {
    // Pegamos a localização atual para observar as mudanças de rota
    const { pathname } = useLocation();

    useEffect(() => {
        // Força o scroll para o topo da janela (posição 0, 0)
        window.scrollTo(0, 0);
    }, [pathname]);

    return null; // Este componente não renderiza nada visível
};