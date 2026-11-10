import { Link } from "react-router-dom";
import { practiceAreas } from "@/data/practiceAreas";
import {
    ADDRESS_LINES,
    EMAIL,
    HOURS,
    INSTAGRAM_HANDLE,
    INSTAGRAM_URL,
    OAB,
    PHONE_DISPLAY,
    PHONE_HREF,
    whatsappUrl,
} from "@/lib/contact";
import logo from "@/assets/logo2.png";

const linkClass =
    "text-[0.9375rem] text-paper/80 underline decoration-transparent decoration-1 transition-colors duration-200 hover:text-paper hover:decoration-gold-light";

const headingClass = "mb-4 text-sm font-semibold text-gold-light";

export const Footer = () => (
    <footer className="bg-ink-deep text-paper">
        <div className="container grid gap-x-10 gap-y-12 py-16 md:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-4">
                <Link to="/" aria-label="Ian Granja Advogados, página inicial" className="inline-block">
                    <img src={logo} alt="Ian Granja Advogados" width={768} height={132} className="h-10 w-auto" />
                </Link>
                <p className="mt-6 max-w-[36ch] text-[0.9375rem] leading-relaxed text-paper/80">
                    Advocacia em Petrolina-PE, com atendimento presencial e online. Leitura do seu documento e
                    explicação em português claro.
                </p>
            </div>

            <nav aria-label="Rodapé" className="lg:col-span-2">
                <h2 className={headingClass}>Navegação</h2>
                <ul className="space-y-3">
                    <li><Link to="/" className={linkClass}>Início</Link></li>
                    <li><Link to="/atuacao" className={linkClass}>Áreas de atuação</Link></li>
                    <li><Link to="/sobre" className={linkClass}>Sobre</Link></li>
                    <li><Link to="/faq" className={linkClass}>Dúvidas</Link></li>
                    <li><Link to="/contato" className={linkClass}>Contato</Link></li>
                </ul>
            </nav>

            <nav aria-label="Áreas de atuação" className="lg:col-span-3">
                <h2 className={headingClass}>Áreas</h2>
                <ul className="space-y-3">
                    {practiceAreas.map((area) => (
                        <li key={area.slug}>
                            <Link to={`/atuacao/${area.slug}`} className={linkClass}>
                                {area.title}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="lg:col-span-3">
                <h2 className={headingClass}>Contato</h2>
                <ul className="space-y-3">
                    <li>
                        <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className={linkClass}>
                            WhatsApp {PHONE_DISPLAY}
                        </a>
                    </li>
                    <li><a href={PHONE_HREF} className={linkClass}>Ligar para o escritório</a></li>
                    <li><a href={`mailto:${EMAIL}`} className={linkClass}>{EMAIL}</a></li>
                    <li>
                        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                            Instagram {INSTAGRAM_HANDLE}
                        </a>
                    </li>
                </ul>
                <address className="mt-6 text-[0.9375rem] not-italic leading-relaxed text-paper/80">
                    {ADDRESS_LINES.map((line) => (
                        <span key={line} className="block">{line}</span>
                    ))}
                    <span className="mt-2 block">{HOURS}</span>
                </address>
            </div>
        </div>

        <div className="border-t border-paper/15">
            <div className="container flex flex-col gap-2 py-6 pr-20 text-sm text-paper/75 md:flex-row md:justify-between">
                <p>© {new Date().getFullYear()} Ian Granja Advocacia. Todos os direitos reservados.</p>
                <p>Ian Granja, {OAB}</p>
            </div>
        </div>
    </footer>
);
