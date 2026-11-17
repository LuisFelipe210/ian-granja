import { useLocation } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import { whatsappUrl } from "@/lib/contact";

/** Atalho fixo para o WhatsApp nas páginas públicas; as ferramentas internas não têm. */
export const WhatsAppFloat = () => {
    const { pathname } = useLocation();
    return pathname.startsWith("/ferramentas/") ? null : <BotaoWhatsApp />;
};

const BotaoWhatsApp = () => (
    <a
        href={whatsappUrl()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-5 right-5 z-40 inline-flex size-14 items-center justify-center bg-[#177F40] text-white shadow-[0_2px_4px_hsl(var(--ink-deep)/0.3),0_14px_28px_-10px_hsl(var(--ink-deep)/0.6)] transition-[background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#126A35] active:translate-y-0"
    >
        <FaWhatsapp aria-hidden className="size-7" />
    </a>
);
