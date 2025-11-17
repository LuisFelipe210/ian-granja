import { NavLink } from "@/components/NavLink";
import { Phone, Mail, MapPin } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo e Descrição */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent">
                <span className="text-xl font-bold text-accent-foreground">IG</span>
              </div>
              <div>
                <div className="text-lg font-bold">Ian Granja</div>
                <div className="text-xs opacity-80">Advocacia & Consultoria</div>
              </div>
            </div>
            <p className="text-sm opacity-80">
              Soluções jurídicas com foco no resultado. Atendimento personalizado e compromisso com a excelência.
            </p>
          </div>

          {/* Links Rápidos */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Navegação</h3>
            <ul className="space-y-2">
              <li>
                <NavLink to="/" className="text-sm opacity-80 hover:opacity-100 hover:text-accent transition-all">
                  Início
                </NavLink>
              </li>
              <li>
                <NavLink to="/sobre" className="text-sm opacity-80 hover:opacity-100 hover:text-accent transition-all">
                  Sobre
                </NavLink>
              </li>
              <li>
                <NavLink to="/atuacao" className="text-sm opacity-80 hover:opacity-100 hover:text-accent transition-all">
                  Áreas de Atuação
                </NavLink>
              </li>
              <li>
                <NavLink to="/faq" className="text-sm opacity-80 hover:opacity-100 hover:text-accent transition-all">
                  FAQ
                </NavLink>
              </li>
              <li>
                <NavLink to="/contato" className="text-sm opacity-80 hover:opacity-100 hover:text-accent transition-all">
                  Contato
                </NavLink>
              </li>
            </ul>
          </div>

          {/* Áreas de Atuação */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Áreas de Atuação</h3>
            <ul className="space-y-2 text-sm opacity-80">
              <li>Direito Bancário</li>
              <li>Direito Trabalhista</li>
              <li>Direito do Consumidor</li>
              <li>Direito Empresarial</li>
              <li>Superendividamento</li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contato</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-2">
                <Phone className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="text-sm opacity-80">(87) 9 8844-8690</span>
              </li>
              <li className="flex items-start space-x-2">
                <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="text-sm opacity-80">contato@iangranja.adv.br</span>
              </li>
              <li className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="text-sm opacity-80">Atuação Nacional</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-primary-foreground/10">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-sm opacity-80">
              © {new Date().getFullYear()} Ian Granja Advocacia. Todos os direitos reservados.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-sm opacity-80 hover:opacity-100 hover:text-accent transition-all">
                Política de Privacidade
              </a>
              <a href="#" className="text-sm opacity-80 hover:opacity-100 hover:text-accent transition-all">
                Termos de Uso
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
