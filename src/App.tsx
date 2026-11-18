import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "motion/react";
import Index from "./pages/Index";
import { ScrollToTop } from "@/components/ScrollToTop";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { SeoManager } from "@/components/SeoManager";

const Sobre = lazy(() => import("./pages/Sobre"));
const Atuacao = lazy(() => import("./pages/Atuacao"));
const AtuacaoDetalhes = lazy(() => import("./pages/AtuacaoDetalhes"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Contato = lazy(() => import("./pages/Contato"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CalculadoraJuros = lazy(() => import("./pages/CalculadoraJuros"));
const CalculadoraAdvogado = lazy(() => import("./pages/CalculadoraAdvogado"));

const App = () => (
    <MotionConfig reducedMotion="user">
        <Sonner />
        <BrowserRouter>
            <ScrollToTop />
            <SeoManager />
            <Suspense fallback={<div className="min-h-screen bg-ink" />}>
                <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/sobre" element={<Sobre />} />
                    <Route path="/atuacao" element={<Atuacao />} />
                    <Route path="/atuacao/:slug" element={<AtuacaoDetalhes />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/contato" element={<Contato />} />
                    <Route path="/calculadora-juros-abusivos" element={<CalculadoraJuros />} />
                    {/* Uso interno do advogado: fora do menu e do sitemap, com noindex e sub-rotas próprias. */}
                    <Route path="/ferramentas/calculadora-revisional/*" element={<CalculadoraAdvogado />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Suspense>
            <WhatsAppFloat />
        </BrowserRouter>
    </MotionConfig>
);

export default App;
