import * as React from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface MapEmbedProps {
    address: string;
    iframeSrc: string;
}

const PETROLINA_ADDRESS = "Avenida Cardoso de Sá, n. 860, sala 5, Cidade Universitária, Centro Empresarial Sergio Cabral, Petrolina-PE";

export const MapEmbed: React.FC<MapEmbedProps> = ({ address, iframeSrc }) => {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="max-w-4xl mx-auto text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm mb-4 font-semibold border border-primary/20">
                    <MapPin className="w-4 h-4" />
                    <span>Localização do Escritório</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                    Estamos em Petrolina-PE
                </h2>
                <p className="text-lg text-muted-foreground">
                    {address}
                </p>
            </div>

            <div className="relative w-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl border-4 border-accent/30 aspect-[16/9] md:aspect-[21/9]">
                <iframe
                    src={iframeSrc}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={false}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Localização Ian Granja Advocacia"
                    className="absolute inset-0"
                />
                <div className={cn(
                    "absolute inset-0 pointer-events-none transition-all duration-500",
                    "bg-transparent dark:bg-background/20"
                )} />
            </div>

            <div className="mt-8 text-center">
                <a
                    href="https://wa.me/5587988448690"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent/80 font-semibold transition-colors flex items-center justify-center gap-2"
                >
                    Atendimento disponível também 100% online
                    <MapPin className="w-4 h-4" />
                </a>
            </div>
        </div>
    );
};