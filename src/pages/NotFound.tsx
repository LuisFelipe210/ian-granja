import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
    const location = useLocation();

    useEffect(() => {
        console.error(
            "404 Error: User attempted to access non-existent route:",
            location.pathname
        );
    }, [location.pathname]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-primary text-primary-foreground">
            <div className="max-w-md px-6 text-center">
                <AlertTriangle className="mx-auto mb-6 h-16 w-16 text-accent" />

                <h1 className="mb-4 text-6xl font-bold text-accent">404</h1>
                <h2 className="mb-4 text-3xl font-bold">Página Não Encontrada</h2>
                <p className="mb-8 text-lg text-primary-foreground/80">
                    O conteúdo que você procurou não existe ou foi movido.
                </p>

                <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="bg-transparent text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary"
                >
                    <NavLink to="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar ao Início
                    </NavLink>
                </Button>
            </div>
        </div>
    );
};

export default NotFound;