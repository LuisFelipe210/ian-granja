import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export const Navigation = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <NavLink to="/" className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary/80">
              <span className="text-2xl font-bold text-primary-foreground">IG</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-xl font-bold text-foreground">Ian Granja</div>
              <div className="text-xs text-muted-foreground">Advocacia & Consultoria</div>
            </div>
          </NavLink>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <NavLink
              to="/"
              className="text-sm font-medium text-foreground hover:text-accent transition-colors"
              activeClassName="text-accent"
            >
              Início
            </NavLink>
            <NavLink
              to="/sobre"
              className="text-sm font-medium text-foreground hover:text-accent transition-colors"
              activeClassName="text-accent"
            >
              Sobre
            </NavLink>
            <NavLink
              to="/atuacao"
              className="text-sm font-medium text-foreground hover:text-accent transition-colors"
              activeClassName="text-accent"
            >
              Áreas de Atuação
            </NavLink>
            <NavLink
              to="/faq"
              className="text-sm font-medium text-foreground hover:text-accent transition-colors"
              activeClassName="text-accent"
            >
              FAQ
            </NavLink>
            <NavLink
              to="/contato"
              className="text-sm font-medium text-foreground hover:text-accent transition-colors"
              activeClassName="text-accent"
            >
              Contato
            </NavLink>
            <Button variant="default" size="sm" asChild>
              <NavLink to="/contato">Falar com Advogado</NavLink>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-foreground hover:bg-muted"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2 border-t border-border">
            <NavLink
              to="/"
              className="block px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-md"
              activeClassName="bg-muted text-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              Início
            </NavLink>
            <NavLink
              to="/sobre"
              className="block px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-md"
              activeClassName="bg-muted text-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sobre
            </NavLink>
            <NavLink
              to="/atuacao"
              className="block px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-md"
              activeClassName="bg-muted text-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              Áreas de Atuação
            </NavLink>
            <NavLink
              to="/faq"
              className="block px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-md"
              activeClassName="bg-muted text-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              FAQ
            </NavLink>
            <NavLink
              to="/contato"
              className="block px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-md"
              activeClassName="bg-muted text-accent"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contato
            </NavLink>
            <div className="px-4 pt-2">
              <Button variant="default" size="sm" className="w-full" asChild>
                <NavLink to="/contato" onClick={() => setMobileMenuOpen(false)}>
                  Falar com Advogado
                </NavLink>
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
