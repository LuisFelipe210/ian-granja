import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MESES, MODALIDADES, PRIMEIRO_ANO, mascaraMoeda, type Modalidade, type Pessoa } from "@/lib/juros";

export const labelClass = "block text-sm font-semibold text-ink";

interface PessoaToggleProps {
    value: Pessoa;
    onChange: (p: Pessoa) => void;
    labels?: Record<Pessoa, string>;
    ariaLabel?: string;
}

/** Escolha entre pessoa física e jurídica, como duas caixas de marcar numa ficha. */
export const PessoaToggle = ({
    value,
    onChange,
    labels = { pf: "Pessoa física", pj: "Empresa (PJ)" },
    ariaLabel = "Quem assinou o contrato",
}: PessoaToggleProps) => {
    const refs = useRef<Partial<Record<Pessoa, HTMLButtonElement | null>>>({});

    const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, current: Pessoa) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") {
            return;
        }
        e.preventDefault();
        const next: Pessoa = current === "pf" ? "pj" : "pf";
        onChange(next);
        refs.current[next]?.focus();
    };

    return (
        <div role="radiogroup" aria-label={ariaLabel} className="grid grid-cols-2 border border-ink/30">
            {(["pf", "pj"] as Pessoa[]).map((p) => (
                <button
                    key={p}
                    ref={(el) => {
                        refs.current[p] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={value === p}
                    tabIndex={value === p ? 0 : -1}
                    onClick={() => onChange(p)}
                    onKeyDown={(e) => onKeyDown(e, p)}
                    className={cn(
                        "min-h-12 px-4 text-[0.9375rem] font-semibold transition-colors duration-200 first:border-r first:border-ink/30",
                        value === p ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                    )}
                >
                    {labels[p]}
                </button>
            ))}
        </div>
    );
};

interface ModalidadeSelectProps {
    id: string;
    pessoa: Pessoa;
    value: string | null;
    onChange: (m: Modalidade | null) => void;
    /** Mostra as séries do BACEN da opção escolhida. */
    tecnico?: boolean;
}

/** Seletor do tipo de contrato, com a explicação da opção escolhida logo abaixo. */
export const ModalidadeSelect = ({ id, pessoa, value, onChange, tecnico }: ModalidadeSelectProps) => {
    const opcoes = MODALIDADES.filter((m) => m.pessoa === pessoa);
    const atual = opcoes.find((m) => m.id === value);
    return (
        <div>
            <Select
                id={id}
                value={value ?? ""}
                onChange={(v) => onChange(opcoes.find((m) => m.id === v) ?? null)}
                label="Tipo de contrato"
            >
                <option value="">Escolha o tipo de contrato</option>
                {opcoes.map((m) => (
                    <option key={m.id} value={m.id}>
                        {m.nome}
                    </option>
                ))}
            </Select>
            {atual && (
                <p className="mt-2 text-sm text-muted-foreground">
                    {atual.resumo}
                    {tecnico && (
                        <span className="tabular-nums">
                            {" "}· SGS {atual.am} (a.m.) / {atual.aa} (a.a.)
                            {atual.alt ? `; antes de nov/2025: ${atual.alt.am} / ${atual.alt.aa}` : ""}
                        </span>
                    )}
                </p>
            )}
        </div>
    );
};

interface SelectProps {
    id: string;
    value: string;
    onChange: (v: string) => void;
    children: ReactNode;
    label: string;
}

const Select = ({ id, value, onChange, children, label }: SelectProps) => (
    <div className="relative">
        <select
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn("field cursor-pointer appearance-none pr-8 [&>option]:text-ink", !value && "text-ink/35")}
            aria-label={label}
        >
            {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-1 top-1/2 size-4 -translate-y-1/2 text-ink/60" />
    </div>
);

interface MesAnoProps {
    mes: string;
    ano: string;
    onMes: (v: string) => void;
    onAno: (v: string) => void;
    idPrefix: string;
}

/** Mês e ano da contratação. */
export const MesAno = ({ mes, ano, onMes, onAno, idPrefix }: MesAnoProps) => {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    const anos: number[] = [];
    for (let y = anoAtual; y >= PRIMEIRO_ANO; y--) anos.push(y);

    const handleAno = (novoAno: string) => {
        if (Number(novoAno) === anoAtual && Number(mes) > mesAtual) {
            onMes("");
        }
        onAno(novoAno);
    };

    return (
        <div className="grid grid-cols-[1.4fr_1fr] gap-5">
            <Select id={`${idPrefix}-mes`} value={mes} onChange={onMes} label="Mês da contratação">
                <option value="">Mês</option>
                {MESES.map((n, i) => (
                    <option
                        key={n}
                        value={String(i + 1).padStart(2, "0")}
                        disabled={Number(ano) === anoAtual && i + 1 > mesAtual}
                    >
                        {n}
                    </option>
                ))}
            </Select>
            <Select id={`${idPrefix}-ano`} value={ano} onChange={handleAno} label="Ano da contratação">
                <option value="">Ano</option>
                {anos.map((y) => (
                    <option key={y} value={y}>
                        {y}
                    </option>
                ))}
            </Select>
        </div>
    );
};

interface CampoProps {
    id: string;
    label: ReactNode;
    value: string;
    onChange: (v: string) => void;
    /** "moeda" mostra R$ e aplica a máscara; "taxa" aceita decimais; "inteiro" só números. */
    tipo: "moeda" | "taxa" | "inteiro";
    sufixo?: string;
    placeholder?: string;
    ajuda?: ReactNode;
}

/** Campo sublinhado de ficha, com prefixo R$ ou sufixo de taxa. */
export const Campo = ({ id, label, value, onChange, tipo, sufixo, placeholder, ajuda }: CampoProps) => (
    <div>
        <label htmlFor={id} className={labelClass}>
            {label}
        </label>
        <div className="relative">
            {tipo === "moeda" && (
                <span aria-hidden className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                </span>
            )}
            <input
                id={id}
                value={value}
                inputMode={tipo === "taxa" ? "decimal" : "numeric"}
                autoComplete="off"
                placeholder={placeholder}
                aria-describedby={ajuda ? `${id}-ajuda` : undefined}
                onChange={(e) => {
                    const v = e.target.value;
                    if (tipo === "moeda") onChange(mascaraMoeda(v));
                    else if (tipo === "inteiro") onChange(v.replace(/\D/g, "").slice(0, 3));
                    else onChange(v.replace(/[^\d.,]/g, ""));
                }}
                className={cn("field tabular-nums", tipo === "moeda" && "pl-8", sufixo && "pr-14")}
            />
            {sufixo && (
                <span aria-hidden className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {sufixo}
                </span>
            )}
        </div>
        {ajuda && (
            <p id={`${id}-ajuda`} className="mt-2 text-sm text-muted-foreground">
                {ajuda}
            </p>
        )}
    </div>
);
