import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "motion/react";
import Index from "./pages/Index";
import Sobre from "./pages/Sobre";
import Atuacao from "./pages/Atuacao";
import AtuacaoDetalhes from "./pages/AtuacaoDetalhes";
import FAQ from "./pages/FAQ";
import Contato from "./pages/Contato";
import NotFound from "./pages/NotFound";
import { ScrollToTop } from "@/components/ScrollToTop";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { SeoManager } from "@/components/SeoManager";

const App = () => (
    <MotionConfig reducedMotion="user">
        <Sonner />
        <BrowserRouter>
            <ScrollToTop />
            <SeoManager />
            <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/sobre" element={<Sobre />} />
                <Route path="/atuacao" element={<Atuacao />} />
                <Route path="/atuacao/:slug" element={<AtuacaoDetalhes />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/contato" element={<Contato />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
            <WhatsAppFloat />
        </BrowserRouter>
    </MotionConfig>
);

export default App;
