import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { practiceAreas } from "@/data/practiceAreas";
import { areaPhrases } from "@/data/documents";

/** Índice das áreas de atuação, pela frase com que o cliente chega. Vive sobre fundo azul. */
export const AreaIndex = () => (
    <ul className="border-t border-paper/20">
        {practiceAreas.map((area) => (
            <li key={area.slug} className="border-b border-paper/20">
                <Link
                    to={`/atuacao/${area.slug}`}
                    className="group grid items-baseline gap-x-8 gap-y-2 py-6 md:grid-cols-[minmax(0,1fr)_13rem_1.5rem] md:py-7"
                >
                    <span className="subdisplay text-[clamp(1.5rem,3vw,2.5rem)] text-paper">
                        <span className="grifo grifo-hover">{areaPhrases[area.slug]}</span>
                    </span>
                    <span className="text-[0.9375rem] font-medium text-gold-light md:text-right">{area.title}</span>
                    <ArrowUpRight
                        aria-hidden
                        className="hidden size-5 self-center text-paper/50 transition-[transform,color] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold-light md:block"
                    />
                </Link>
            </li>
        ))}
    </ul>
);
