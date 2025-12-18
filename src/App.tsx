import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Sobre from "./pages/Sobre";
import Atuacao from "./pages/Atuacao";
import AtuacaoDetalhes from "./pages/AtuacaoDetalhes";
import FAQ from "./pages/FAQ";
import Contato from "./pages/Contato";
import NotFound from "./pages/NotFound";
import { createContext, useContext, useState, useMemo, useEffect } from "react";
import { ContactDrawer } from "@/components/ContactDrawer";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LoadingScreen } from "@/components/LoadingScreen";

type ContactContextType = {
    isDrawerOpen: boolean;
    openDrawer: () => void;
    closeDrawer: () => void;
};

const ContactContext = createContext<ContactContextType | undefined>(undefined);

export const useContactDrawer = () => {
    const context = useContext(ContactContext);
    if (context === undefined) {
        throw new Error("useContactDrawer must be used within a ContactProvider");
    }
    return context;
};

const ContactProvider = ({ children }: { children: React.ReactNode }) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const openDrawer = () => setIsDrawerOpen(true);
    const closeDrawer = () => setIsDrawerOpen(false);

    const value = useMemo(() => ({
        isDrawerOpen,
        openDrawer,
        closeDrawer,
    }), [isDrawerOpen]);

    return (
        <ContactContext.Provider value={value}>
            {children}
        </ContactContext.Provider>
    );
};
// -------------------------------------------

const queryClient = new QueryClient();

const App = () => {
    // Estado para controlar o carregamento
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Simula o tempo de carregamento (2.5 segundos para a animação completar)
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                {/* Se estiver carregando, mostra a tela de Loading. Se não, mostra o App normal. */}
                {isLoading ? (
                    <LoadingScreen />
                ) : (
                    <>
                        <div className="bg-noise mix-blend-overlay"></div>

                        <Toaster />
                        <Sonner />
                        <ContactProvider>
                            <BrowserRouter>
                                <ScrollToTop />
                                <Routes>
                                    <Route path="/" element={<Index />} />
                                    <Route path="/sobre" element={<Sobre />} />

                                    {/* ROTAS DE ATUAÇÃO */}
                                    <Route path="/atuacao" element={<Atuacao />} />
                                    {/* Essa porra aqui embaixo que faz a mágica da página dinâmica: */}
                                    <Route path="/atuacao/:slug" element={<AtuacaoDetalhes />} />

                                    <Route path="/faq" element={<FAQ />} />
                                    <Route path="contato" element={<Contato />} />
                                    <Route path="*" element={<NotFound />} />
                                </Routes>
                            </BrowserRouter>
                            <ContactDrawer />
                        </ContactProvider>
                    </>
                )}
            </TooltipProvider>
        </QueryClientProvider>
    );
};

export default App;