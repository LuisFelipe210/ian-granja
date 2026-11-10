import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

const PAPER_LINE = "hsl(var(--background) / 0.7)";
const TEXT_LINE = "hsl(var(--background) / 0.3)";
const SHEET_FILL = "hsl(var(--ink-soft))";
const GOLD = "hsl(var(--gold-light))";

interface PageProps {
    /** Contorno da folha, em comandos de path. */
    d: string;
    /** Rotação em graus e o centro em torno do qual gira. */
    rot?: number;
    cx?: number;
    cy?: number;
    delay?: number;
    children?: ReactNode;
}

/** Uma folha: o contorno se desenha e o papel aparece. */
const Page = ({ d, rot = 0, cx = 260, cy = 210, delay = 0, children }: PageProps) => {
    const reduce = useReducedMotion();

    return (
        <g transform={`rotate(${rot} ${cx} ${cy})`}>
            <motion.path
                d={d}
                fill={SHEET_FILL}
                stroke={PAPER_LINE}
                strokeWidth={1.5}
                strokeLinejoin="round"
                initial={reduce ? false : { pathLength: 0, fillOpacity: 0 }}
                animate={{ pathLength: 1, fillOpacity: 1 }}
                transition={{ duration: 1.2, ease: EASE, delay }}
            />
            {children}
        </g>
    );
};

interface LinesProps {
    x: number;
    y: number;
    w: number;
    /** Largura de cada linha, de 0 a 1. */
    rows: number[];
    gap?: number;
    delay?: number;
}

/** Linhas de texto miúdo, que se escrevem da esquerda para a direita. */
const Lines = ({ x, y, w, rows, gap = 18, delay = 0 }: LinesProps) => {
    const reduce = useReducedMotion();

    return (
        <>
            {rows.map((ratio, i) => (
                <motion.path
                    key={i}
                    d={`M${x} ${y + i * gap}h${w * ratio}`}
                    stroke={TEXT_LINE}
                    strokeWidth={4}
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.7, ease: EASE, delay: delay + i * 0.06 }}
                />
            ))}
        </>
    );
};

interface MarkProps {
    x: number;
    y: number;
    w: number;
    h?: number;
    delay?: number;
}

/** O grifo: uma barra de marca-texto que corre sobre a linha. */
const Mark = ({ x, y, w, h = 14, delay = 0 }: MarkProps) => {
    const reduce = useReducedMotion();

    return (
        <motion.rect
            x={x}
            y={y - h / 2}
            width={w}
            height={h}
            fill={GOLD}
            style={{ originX: 0 }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.85, ease: EASE, delay }}
        />
    );
};

interface PenProps {
    d: string;
    width?: number;
    delay?: number;
    duration?: number;
}

/** Um traço de caneta dourada. */
const Pen = ({ d, width = 2.5, delay = 0, duration = 0.9 }: PenProps) => {
    const reduce = useReducedMotion();

    return (
        <motion.path
            d={d}
            fill="none"
            stroke={GOLD}
            strokeWidth={width}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration, ease: EASE, delay }}
        />
    );
};

const Rule = ({ d }: { d: string }) => <path d={d} stroke={PAPER_LINE} strokeWidth={1} />;

const sheet = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}z`;

/** Pilha de folhas, a de cima já lida e grifada. */
const Pilha = () => (
    <>
        <Page d={sheet(140, 50, 250, 320)} rot={-10} delay={0.1} />
        <Page d={sheet(140, 50, 250, 320)} rot={-3.5} delay={0.22} />
        <Page d={sheet(140, 50, 250, 320)} rot={4} delay={0.34}>
            <Lines x={168} y={84} w={90} rows={[1]} delay={0.9} />
            <Lines x={322} y={84} w={40} rows={[1]} delay={0.95} />
            <Rule d="M168 100h194" />
            <Lines x={168} y={128} w={194} rows={[1, 0.92]} delay={1} />
            <Mark x={168} y={164} w={128} delay={1.5} />
            <Lines x={304} y={164} w={58} rows={[1]} delay={1.1} />
            <Lines x={168} y={182} w={194} rows={[0.96, 0.6]} delay={1.15} />
            <Lines x={168} y={240} w={194} rows={[1]} delay={1.25} />
            <Lines x={168} y={258} w={36} rows={[1]} delay={1.3} />
            <Mark x={212} y={258} w={150} delay={1.9} />
            <Lines x={168} y={276} w={194} rows={[0.88, 0.5]} delay={1.35} />
            <Pen d="M168 334c18-9 30 7 46-1s26-8 44 0 30 4 44-2" delay={2.4} />
        </Page>
    </>
);

/** Folha com um trecho circulado à caneta e a dúvida na margem. */
const Duvida = () => (
    <>
        <Page d={sheet(96, 44, 250, 330)} rot={-3} cx={221} cy={209} delay={0.1}>
            <Lines x={124} y={80} w={110} rows={[1]} delay={0.8} />
            <Rule d="M124 96h194" />
            <Lines x={124} y={124} w={194} rows={[1, 0.94, 0.7]} delay={0.9} />
            <Lines x={124} y={196} w={48} rows={[1]} delay={1.05} />
            <Mark x={180} y={196} w={120} delay={1.4} />
            <Lines x={124} y={214} w={194} rows={[0.9]} delay={1.1} />
            <Lines x={124} y={262} w={194} rows={[1, 0.96, 0.82, 0.45]} delay={1.2} />
            <Pen
                d="M170 198c-2-22 132-28 140-2s-132 30-142 6c-4-10 12-18 34-21"
                delay={1.9}
                duration={1.1}
            />
        </Page>
        <Pen d="M396 150c0-44 76-44 76 2 0 36-38 38-38 82" width={11} delay={2.3} duration={0.8} />
        <Mark x={427} y={268} w={14} h={14} delay={2.9} />
    </>
);

/** Folha grifada saindo do envelope, pronta para ser enviada. */
const Envelope = () => {
    const reduce = useReducedMotion();

    return (
        <>
            <motion.g
                initial={reduce ? false : { y: 70 }}
                animate={{ y: 0 }}
                transition={{ duration: 1.2, ease: EASE, delay: 1.1 }}
            >
                <Page d={sheet(160, 30, 200, 250)} rot={-2.5} cx={260} cy={155} delay={0.6}>
                    <Lines x={184} y={62} w={84} rows={[1]} delay={1.2} />
                    <Rule d="M184 78h152" />
                    <Lines x={184} y={104} w={152} rows={[1, 0.9]} delay={1.3} />
                    <Mark x={184} y={140} w={112} delay={2} />
                    <Lines x={184} y={158} w={152} rows={[0.95, 0.55]} delay={1.4} />
                </Page>
            </motion.g>
            <Page d={sheet(100, 196, 320, 176)} delay={0.1} />
            <Pen d="M100 196l160 104 160-104" width={1.5} delay={0.5} />
            <Pen d="M100 372l112-98M420 372l-112-98" width={1.5} delay={0.8} />
        </>
    );
};

/** Folha em branco, com a ponta dobrada. */
const Branco = () => (
    <>
        <Page d="M140 46h180l70 70v258h-250z" rot={3} delay={0.1} />
        <g transform="rotate(3 260 210)">
            <Pen d="M320 46v70h70" width={1.5} delay={0.9} />
            <Pen d="M186 214c22-10 34 8 52-2s30-8 46 2" delay={1.4} />
        </g>
    </>
);

interface SignatureArtProps {
    className?: string;
}

/** Linha de assinatura com um floreio de caneta e a caneta pousada no fim do traço. Decorativa. */
export const SignatureArt = ({ className }: SignatureArtProps) => {
    const reduce = useReducedMotion();

    return (
        <svg viewBox="0 0 440 150" aria-hidden className={cn("block h-auto w-full overflow-visible", className)}>
            <motion.path
                d="M8 118h330"
                stroke={PAPER_LINE}
                strokeWidth={1.5}
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, ease: EASE, delay: 0.5 }}
            />
            <Pen d="M10 100l12 12M22 100l-12 12" width={1.5} delay={0.9} duration={0.4} />
            <Pen
                d="M44 108C60 74 78 62 86 74C96 90 60 122 78 118C98 114 104 78 120 82C134 86 112 118 128 116C146 114 150 88 164 90C176 92 166 114 180 112C204 108 222 96 258 88"
                delay={1.3}
                duration={1.5}
            />
            <g transform="translate(258 88) rotate(-38)">
            <motion.g
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE, delay: 2.6 }}
            >
                <path d="M0 0l26-8v16z" fill={GOLD} stroke={GOLD} strokeWidth={1.5} strokeLinejoin="round" />
                <path
                    d="M26-9h132v18h-132z"
                    fill={SHEET_FILL}
                    stroke={PAPER_LINE}
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                />
                <path d="M46-9v18M124-9v18" stroke={PAPER_LINE} strokeWidth={1.5} />
            </motion.g>
            </g>
        </svg>
    );
};

const variants = {
    pilha: Pilha,
    duvida: Duvida,
    envelope: Envelope,
    branco: Branco,
};

interface HeroArtProps {
    variant: keyof typeof variants;
    className?: string;
}

/** Ilustração de linha para o cabeçalho das páginas: papéis, grifo e caneta. Decorativa. */
export const HeroArt = ({ variant, className }: HeroArtProps) => {
    const Art = variants[variant];

    return (
        <svg
            viewBox="0 0 520 420"
            aria-hidden
            className={cn("mx-auto block h-auto w-full max-w-[26rem] overflow-visible lg:ml-auto lg:mr-0", className)}
        >
            <Art />
        </svg>
    );
};
