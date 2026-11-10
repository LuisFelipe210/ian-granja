import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface FaqListProps {
    items: { question: string; answer: string }[];
}

/** Lista de perguntas: linhas de documento que se abrem, a pergunta aberta fica grifada. */
export const FaqList = ({ items }: FaqListProps) => (
    <Accordion type="single" collapsible className="border-t border-ink/25">
        {items.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-b border-ink/25">
                <AccordionTrigger className="group gap-6 py-6 text-left text-lg font-semibold leading-snug text-ink hover:no-underline md:text-xl [&>svg]:size-5 [&>svg]:text-ink">
                    <span>
                        <span className="grifo grifo-hover">{item.question}</span>
                    </span>
                </AccordionTrigger>
                <AccordionContent className="max-w-[68ch] pb-8 font-serif text-[1.0625rem] leading-[1.75] text-ink/85">
                    {item.answer}
                </AccordionContent>
            </AccordionItem>
        ))}
    </Accordion>
);
