import * as React from "react";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export const ContactDrawer = () => {
    const whatsappLink =
        "https://wa.me/5587988448690?text=Ol%C3%A1!%20Gostaria%20de%20falar%20com%20um%20advogado.";

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            asChild
                            size="icon"
                            className="h-16 w-16 rounded-full shadow-2xl bg-[#25D366] hover:bg-[#128C7E] text-white border-4 border-white/20 transition-all duration-300 hover:scale-110 hover:rotate-3"
                        >
                            <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Falar no WhatsApp"
                            >
                                <FaWhatsapp className="h-12 w-12" />
                            </a>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="bg-foreground text-background border-none mb-2 mr-2 px-4 py-2 text-xs font-bold uppercase tracking-wider">
                        <p>Falar no WhatsApp</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
};