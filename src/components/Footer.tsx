import { NavLink } from "@/components/NavLink";
import { Phone, Mail, MapPin, ArrowRight, Instagram } from "lucide-react";
import { FaWhatsapp } from 'react-icons/fa';
import logoImg from "@/assets/logo2.png";

export const Footer = () => {
    return (
        <footer className="bg-primary text-primary-foreground pt-16 pb-6 border-t border-accent/10">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">

                    <div className="space-y-4 pr-4">
                        <NavLink to="/" className="flex items-center group w-fit">

                            <img
                                src={logoImg}
                                alt="Ian Granja Advocacia Logo"
                                className="h-12 w-auto transition-all duration-300 group-hover:scale-105"
                            />

                        </NavLink>
                        <p className="text-sm opacity-80 pt-2 leading-relaxed">
                            Soluções jurídicas com foco no resultado. Atendimento personalizado e compromisso com a excelência.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-4 border-b border-primary-foreground/10 pb-2">Navegação</h3>
                        <ul className="space-y-3">
                            <li>
                                <NavLink to="/" className="text-sm opacity-90 hover:opacity-100 hover:text-accent transition-all flex items-center">
                                    <span className="mr-2 text-accent text-xs">•</span> Início
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/sobre" className="text-sm opacity-90 hover:opacity-100 hover:text-accent transition-all flex items-center">
                                    <span className="mr-2 text-accent text-xs">•</span> Sobre
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/atuacao" className="text-sm opacity-90 hover:opacity-100 hover:text-accent transition-all flex items-center">
                                    <span className="mr-2 text-accent text-xs">•</span> Áreas de Atuação
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/faq" className="text-sm opacity-90 hover:opacity-100 hover:text-accent transition-all flex items-center">
                                    <span className="mr-2 text-accent text-xs">•</span> FAQ
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="#" isContactLink className="text-sm font-semibold text-accent hover:opacity-100 transition-all flex items-center">
                                    <span className="mr-2 text-accent text-xs">»</span> Contato
                                </NavLink>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-4 border-b border-primary-foreground/10 pb-2">Áreas Comuns</h3>
                        <ul className="space-y-3">
                            <li>
                                <NavLink to="/atuacao#bancario" className="text-sm opacity-90 hover:opacity-100 hover:text-accent transition-all flex items-center">
                                    <span className="mr-2 text-accent text-xs">»</span> Direito Bancário
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/atuacao#trabalhista" className="text-sm opacity-90 hover:opacity-100 hover:text-accent transition-all flex items-center">
                                    <span className="mr-2 text-accent text-xs">»</span> Direito Trabalhista
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/atuacao#consumidor" className="text-sm opacity-90 hover:opacity-100 hover:text-accent transition-all flex items-center">
                                    <span className="mr-2 text-accent text-xs">»</span> Direito do Consumidor
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/atuacao#empresarial" className="text-sm opacity-90 hover:opacity-100 hover:text-accent transition-all flex items-center">
                                    <span className="mr-2 text-accent text-xs">»</span> Direito Empresarial
                                </NavLink>
                            </li>
                            <li className="pt-2">
                                <NavLink to="/atuacao" className="text-sm font-semibold text-accent hover:opacity-100 transition-all flex items-center">
                                    Ver todas as áreas <ArrowRight className="w-3 h-3 ml-1" />
                                </NavLink>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-4 border-b border-primary-foreground/10 pb-2">Fale Conosco</h3>
                        <ul className="space-y-3">
                            <li className="flex items-start space-x-3">
                                <Phone className="h-4 w-4 mt-0.5 flex-shrink-0 text-accent" />
                                <div>
                                    <a href="tel:+5587988448690" className="text-sm opacity-90 hover:opacity-100 hover:text-accent transition-colors block">
                                        (87) 9 8844-8690
                                    </a>
                                    <span className="text-xs opacity-70 block">Ligação e WhatsApp</span>
                                </div>
                            </li>
                            <li className="flex items-start space-x-3">
                                <FaWhatsapp className="h-4 w-4 mt-0.5 flex-shrink-0 text-accent" />
                                <div>
                                    <a
                                        href="https://wa.me/5587988448690"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm opacity-90 hover:opacity-100 hover:text-accent transition-colors block"
                                    >
                                        Chamar no WhatsApp
                                    </a>
                                    <span className="text-xs opacity-70 block">Atendimento Imediato</span>
                                </div>
                            </li>
                            <li className="flex items-start space-x-3">
                                <Instagram className="h-4 w-4 mt-0.5 flex-shrink-0 text-accent" />
                                <a
                                    href="https://www.instagram.com/iangranja.adv"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm opacity-90 hover:opacity-100 hover:text-accent transition-colors"
                                >
                                    @iangranja.adv
                                </a>
                            </li>
                            <li className="flex items-start space-x-3">
                                <Mail className="h-4 w-4 mt-0.5 flex-shrink-0 text-accent" />
                                <a href="mailto:contato@iangranja.adv.br" className="text-sm opacity-90 hover:opacity-100 hover:text-accent transition-colors">
                                    contato@iangranja.adv.br
                                </a>
                            </li>
                            <li className="flex items-start space-x-3">
                                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-accent" />
                                <span className="text-sm opacity-90">Atuação online e presencial </span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-12 pt-6 border-t border-primary-foreground/10">
                    <div className="flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0">
                        <p className="text-xs opacity-70 text-center md:text-left">
                            © {new Date().getFullYear()} Ian Granja Advocacia. Todos os direitos reservados.
                        </p>
                        <div className="flex space-x-6">
                            <a href="#" className="text-xs opacity-70 hover:opacity-100 hover:text-accent transition-all">
                                Política de Privacidade
                            </a>
                            <a href="#" className="text-xs opacity-70 hover:opacity-100 hover:text-accent transition-all">
                                Termos de Uso
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};