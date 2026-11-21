import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
    ArrowLeftRight,
    Baseline,
    CaseSensitive,
    Check,
    ChevronDown,
    Highlighter,
    Link2,
    Minus,
    Plus,
    RemoveFormatting,
    Search,
    SeparatorHorizontal,
    Strikethrough,
    Subscript,
    Superscript,
    TableCellsMerge,
    TableCellsSplit,
    Trash2,
    Unlink,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FONTES_EDITOR, GRUPOS_FONTE_EDITOR, encontrarFonteEditor } from "@/lib/fontes-editor";
import {
    aplicarEspacamentoParagrafo,
    formatarCmCss,
    lerCmDeCss,
    lerEspacamentoAtual,
    localizarOcorrencias,
    substituirOcorrencias,
    transformarCaixaSelecao,
    type ModoCaixaTexto,
} from "@/components/juros/extensoes-word-editor";

function useMenuSuspenso() {
    const [aberto, setAberto] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!aberto) return;
        const fechar = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
        };
        const esc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setAberto(false);
        };
        document.addEventListener("mousedown", fechar);
        document.addEventListener("keydown", esc);
        return () => {
            document.removeEventListener("mousedown", fechar);
            document.removeEventListener("keydown", esc);
        };
    }, [aberto]);
    return { aberto, setAberto, ref };
}

/* ------------------------------------------------------- Seletor de fonte (estilo Word) */

export function MenuFonteEditor({ editor, fonteAtual }: { editor: Editor; fonteAtual: string }) {
    const { aberto, setAberto, ref } = useMenuSuspenso();
    const [busca, setBusca] = useState("");
    const ativa = encontrarFonteEditor(fonteAtual);

    const termo = busca.trim().toLowerCase();
    const filtradas = termo
        ? FONTES_EDITOR.filter((f) => f.rotulo.toLowerCase().includes(termo) || f.grupo.toLowerCase().includes(termo))
        : FONTES_EDITOR;

    const escolher = (valor: string | null) => {
        if (valor) editor.chain().focus().setFontFamily(valor).run();
        else editor.chain().focus().unsetFontFamily().run();
        setAberto(false);
        setBusca("");
    };

    return (
        <div ref={ref} className="relative ml-0.5">
            <button
                type="button"
                title={ativa ? `Fonte: ${ativa.rotulo}` : "Fonte do texto (padrão: Times New Roman)"}
                aria-label="Fonte"
                aria-expanded={aberto}
                aria-haspopup="listbox"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    setAberto((v) => !v);
                    setBusca("");
                }}
                className={cn(
                    "inline-flex h-[26px] w-[104px] shrink-0 items-center justify-between gap-1 border border-ink/20 bg-card px-1.5 text-[11px] font-medium text-ink transition-colors hover:border-ink/40 focus:border-ink focus:outline-none",
                    aberto && "border-ink",
                )}
            >
                <span className="truncate" style={ativa ? { fontFamily: ativa.valor } : undefined}>
                    {ativa ? ativa.rotulo : "Fonte"}
                </span>
                <ChevronDown aria-hidden className="size-3 shrink-0 text-muted-foreground" />
            </button>
            {aberto && (
                <div
                    role="listbox"
                    aria-label="Escolher fonte"
                    className="absolute left-0 top-7 z-30 w-64 max-w-[calc(100vw-2rem)] border border-ink/20 bg-card shadow-xl"
                >
                    <div className="border-b border-ink/10 p-1.5">
                        <div className="relative">
                            <Search
                                aria-hidden
                                className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                type="text"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar fonte (ex.: Montserrat)…"
                                autoFocus
                                className="h-7 w-full border border-ink/20 bg-background pl-6 pr-2 text-[11px] text-ink focus:border-ink focus:outline-none"
                            />
                        </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto py-1">
                        {!termo && (
                            <button
                                type="button"
                                role="option"
                                aria-selected={!ativa}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => escolher(null)}
                                className={cn(
                                    "flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs hover:bg-ink/[0.06]",
                                    !ativa ? "bg-ink/[0.05] font-semibold text-ink" : "text-muted-foreground",
                                )}
                            >
                                <span>Padrão (Times New Roman)</span>
                                {!ativa && <Check aria-hidden className="size-3.5 text-ink" />}
                            </button>
                        )}
                        {GRUPOS_FONTE_EDITOR.map((grupo) => {
                            const itens = filtradas.filter((f) => f.grupo === grupo);
                            if (itens.length === 0) return null;
                            return (
                                <div key={grupo} className="border-t border-ink/10 pt-1 first:border-t-0">
                                    <p className="px-2.5 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        {grupo}
                                    </p>
                                    {itens.map((f) => {
                                        const selecionada = ativa?.rotulo === f.rotulo;
                                        return (
                                            <button
                                                key={f.rotulo}
                                                type="button"
                                                role="option"
                                                aria-selected={selecionada}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => escolher(f.valor)}
                                                className={cn(
                                                    "flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[13px] text-ink hover:bg-ink/[0.06]",
                                                    selecionada && "bg-gold/20 font-semibold",
                                                )}
                                            >
                                                <span className="truncate" style={{ fontFamily: f.valor }}>
                                                    {f.rotulo}
                                                </span>
                                                {selecionada && <Check aria-hidden className="size-3.5 shrink-0 text-ink" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                        {filtradas.length === 0 && (
                            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                                Nenhuma fonte encontrada para "{busca}".
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------- Cor do texto e realce */

const CORES_TEXTO = [
    { rotulo: "Preto", valor: "#000000" },
    { rotulo: "Azul-marinho", valor: "#061237" },
    { rotulo: "Cinza escuro", valor: "#475273" },
    { rotulo: "Dourado escuro", valor: "#8b6d3b" },
    { rotulo: "Vermelho escuro", valor: "#991b1b" },
    { rotulo: "Verde escuro", valor: "#166534" },
];

const CORES_REALCE = [
    { rotulo: "Amarelo", valor: "#fef08a" },
    { rotulo: "Dourado suave", valor: "#f3e5c3" },
    { rotulo: "Verde claro", valor: "#dcfce7" },
    { rotulo: "Azul claro", valor: "#dbeafe" },
    { rotulo: "Rosa claro", valor: "#fce7f3" },
];

export function MenuCorTexto({
    editor,
    corAtual,
    realceAtual,
}: {
    editor: Editor;
    corAtual: string;
    realceAtual: string;
}) {
    const { aberto, setAberto, ref } = useMenuSuspenso();

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                title="Cor do texto e marca-texto"
                aria-label="Cor do texto e marca-texto"
                aria-expanded={aberto}
                aria-haspopup="menu"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAberto((v) => !v)}
                className="inline-flex h-[26px] shrink-0 items-center gap-0.5 px-1 text-ink transition-colors hover:bg-ink/[0.07]"
            >
                <span className="relative flex flex-col items-center">
                    <Baseline className="size-3.5" />
                    <span
                        aria-hidden
                        className="-mt-0.5 h-0.5 w-3.5"
                        style={{ backgroundColor: corAtual || "#000000" }}
                    />
                </span>
                <ChevronDown aria-hidden className="size-2.5 text-ink/60" />
            </button>

            {aberto && (
                <div className="absolute left-0 top-8 z-30 w-52 space-y-3 border border-ink/20 bg-card p-2.5 shadow-xl">
                    <div>
                        <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Cor do texto
                            </span>
                            {corAtual && (
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        editor.chain().focus().unsetColor().run();
                                        setAberto(false);
                                    }}
                                    className="text-[10px] font-medium text-ink/70 hover:text-ink hover:underline"
                                >
                                    Automático
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {CORES_TEXTO.map((c) => (
                                <button
                                    key={c.valor}
                                    type="button"
                                    title={c.rotulo}
                                    aria-label={`Cor do texto: ${c.rotulo}`}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        editor.chain().focus().setColor(c.valor).run();
                                        setAberto(false);
                                    }}
                                    className={cn(
                                        "size-6 border transition-transform hover:scale-110",
                                        corAtual.toLowerCase() === c.valor
                                            ? "border-gold-deep ring-1 ring-gold-deep"
                                            : "border-ink/25",
                                    )}
                                    style={{ backgroundColor: c.valor }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-ink/10 pt-2.5">
                        <div className="mb-1.5 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                <Highlighter aria-hidden className="size-3" /> Marca-texto
                            </span>
                            {realceAtual && (
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        editor.chain().focus().unsetBackgroundColor().run();
                                        setAberto(false);
                                    }}
                                    className="text-[10px] font-medium text-ink/70 hover:text-ink hover:underline"
                                >
                                    Sem cor
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {CORES_REALCE.map((c) => (
                                <button
                                    key={c.valor}
                                    type="button"
                                    title={c.rotulo}
                                    aria-label={`Marca-texto: ${c.rotulo}`}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        editor.chain().focus().setBackgroundColor(c.valor).run();
                                        setAberto(false);
                                    }}
                                    className={cn(
                                        "size-6 border transition-transform hover:scale-110",
                                        realceAtual.toLowerCase() === c.valor
                                            ? "border-gold-deep ring-1 ring-gold-deep"
                                            : "border-ink/25",
                                    )}
                                    style={{ backgroundColor: c.valor }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------- Menu Aa (Tachado, x², x₂, Caixa, Limpar) */

export function MenuFormatoExtra({
    editor,
    tachado,
    sobrescrito,
    subscrito,
}: {
    editor: Editor;
    tachado: boolean;
    sobrescrito: boolean;
    subscrito: boolean;
}) {
    const { aberto, setAberto, ref } = useMenuSuspenso();

    const aplicarCaixa = (modo: ModoCaixaTexto) => {
        if (!transformarCaixaSelecao(editor, modo)) {
            toast.info("Selecione um trecho de texto para alterar maiúsculas/minúsculas.");
        }
        setAberto(false);
    };

    const ativo = tachado || sobrescrito || subscrito;

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                title="Maiúsculas/minúsculas, sobrescrito, tachado e limpar formatação"
                aria-label="Mais formatações de fonte"
                aria-expanded={aberto}
                aria-haspopup="menu"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAberto((v) => !v)}
                className={cn(
                    "inline-flex h-[26px] shrink-0 items-center gap-0.5 px-1 text-ink transition-colors",
                    ativo ? "bg-ink text-paper" : "hover:bg-ink/[0.07]",
                )}
            >
                <CaseSensitive className="size-3.5" />
                <ChevronDown aria-hidden className="size-2.5 opacity-70" />
            </button>

            {aberto && (
                <div className="absolute left-0 top-8 z-30 w-56 border border-ink/20 bg-card py-1 text-xs shadow-xl">
                    <div className="flex items-center gap-1 border-b border-ink/10 px-2 pb-1.5 pt-1">
                        <button
                            type="button"
                            title="Tachado"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => editor.chain().focus().toggleStrike().run()}
                            className={cn(
                                "inline-flex h-7 flex-1 items-center justify-center gap-1 border text-[11px] font-medium",
                                tachado ? "border-ink bg-ink text-paper" : "border-ink/20 text-ink hover:bg-ink/5",
                            )}
                        >
                            <Strikethrough className="size-3" /> Tachado
                        </button>
                        <button
                            type="button"
                            title="Sobrescrito (Ctrl+.)"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => editor.chain().focus().toggleMark("sobrescrito").run()}
                            className={cn(
                                "inline-flex size-7 items-center justify-center border",
                                sobrescrito ? "border-ink bg-ink text-paper" : "border-ink/20 text-ink hover:bg-ink/5",
                            )}
                        >
                            <Superscript className="size-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Subscrito (Ctrl+,)"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => editor.chain().focus().toggleMark("subscrito").run()}
                            className={cn(
                                "inline-flex size-7 items-center justify-center border",
                                subscrito ? "border-ink bg-ink text-paper" : "border-ink/20 text-ink hover:bg-ink/5",
                            )}
                        >
                            <Subscript className="size-3.5" />
                        </button>
                    </div>

                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Maiúsculas e minúsculas
                    </p>
                    {(
                        [
                            ["maiusculas", "MAIÚSCULAS"],
                            ["minusculas", "minúsculas"],
                            ["titulo", "Iniciais Maiúsculas"],
                            ["frase", "Primeira letra da frase"],
                        ] as const
                    ).map(([modo, rotulo]) => (
                        <button
                            key={modo}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => aplicarCaixa(modo)}
                            className="block w-full px-3 py-1.5 text-left text-xs text-ink hover:bg-ink/5"
                        >
                            {rotulo}
                        </button>
                    ))}

                    <div className="mt-1 border-t border-ink/10 pt-1">
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                editor.chain().focus().unsetAllMarks().clearNodes().run();
                                aplicarEspacamentoParagrafo(editor, {
                                    recuoEsquerda: null,
                                    recuoDireita: null,
                                    recuoPrimeiraLinha: null,
                                    entrelinha: null,
                                    espacoAntes: null,
                                    espacoDepois: null,
                                });
                                setAberto(false);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-ink hover:bg-ink/5"
                        >
                            <RemoveFormatting className="size-3.5 text-ink/70" />
                            Limpar formatação
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------- Menu Recuo lateral e Espaçamento (Word) */

const OPCOES_RECUO_CM = [0, 1.25, 2, 4];
const OPCOES_ENTRELINHA = [
    { rotulo: "1,0", valor: "1" },
    { rotulo: "1,15", valor: "1.15" },
    { rotulo: "1,5", valor: "1.5" },
    { rotulo: "2,0", valor: "2" },
];
const OPCOES_ESPACO_PT = [
    { rotulo: "0 pt", valor: null as string | null },
    { rotulo: "6 pt", valor: "6pt" },
    { rotulo: "12 pt", valor: "12pt" },
];

export function MenuRecuoEspacamento({ editor }: { editor: Editor }) {
    const { aberto, setAberto, ref } = useMenuSuspenso();
    const atual = lerEspacamentoAtual(editor);
    const esqAtual = lerCmDeCss(atual.recuoEsquerda);
    const dirAtual = lerCmDeCss(atual.recuoDireita);
    const primAtual = lerCmDeCss(atual.recuoPrimeiraLinha);

    const [esqTexto, setEsqTexto] = useState("");
    const [dirTexto, setDirTexto] = useState("");

    useEffect(() => {
        if (!aberto) return;
        setEsqTexto(String(esqAtual).replace(".", ","));
        setDirTexto(String(dirAtual).replace(".", ","));
    }, [aberto, esqAtual, dirAtual]);

    const temPersonalizacao = Boolean(
        atual.recuoEsquerda ||
            atual.recuoDireita ||
            atual.recuoPrimeiraLinha ||
            atual.entrelinha ||
            atual.espacoAntes ||
            atual.espacoDepois,
    );

    const aplicarEsq = (cm: number) => {
        aplicarEspacamentoParagrafo(editor, { recuoEsquerda: formatarCmCss(cm, false) });
        setEsqTexto(String(Math.max(0, Math.min(10, Math.round(cm * 100) / 100))).replace(".", ","));
    };

    const aplicarDir = (cm: number) => {
        aplicarEspacamentoParagrafo(editor, { recuoDireita: formatarCmCss(cm, false) });
        setDirTexto(String(Math.max(0, Math.min(10, Math.round(cm * 100) / 100))).replace(".", ","));
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                title="Recuo lateral, 1ª linha e espaçamento entre linhas"
                aria-label="Recuo e espaçamento do parágrafo"
                aria-expanded={aberto}
                aria-haspopup="dialog"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAberto((v) => !v)}
                className={cn(
                    "inline-flex h-[26px] shrink-0 items-center gap-0.5 px-1 text-ink transition-colors",
                    temPersonalizacao ? "bg-gold-light/35 text-ink" : "hover:bg-ink/[0.07]",
                )}
            >
                <ArrowLeftRight className="size-3.5" />
                <ChevronDown aria-hidden className="size-2.5 text-ink/60" />
            </button>

            {aberto && (
                <div
                    role="dialog"
                    aria-label="Recuo e espaçamento do parágrafo"
                    className="absolute right-0 top-8 z-30 w-80 max-w-[calc(100vw-2rem)] space-y-3 border border-ink/20 bg-card p-3 text-xs shadow-xl"
                >
                    {/* Atalhos jurídicos prontos */}
                    <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Modelos rápidos de petição
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    editor.chain().focus().setTextAlign("justify").run();
                                    aplicarEspacamentoParagrafo(editor, {
                                        recuoEsquerda: null,
                                        recuoDireita: null,
                                        recuoPrimeiraLinha: "1.5cm",
                                        entrelinha: "1.5",
                                    });
                                }}
                                className="border border-ink/20 bg-secondary/40 px-2 py-1.5 text-left text-[11px] font-medium text-ink hover:bg-ink/5"
                            >
                                Parágrafo jurídico
                                <span className="block text-[10px] text-muted-foreground">1ª linha 1,5 cm · justif.</span>
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    editor.chain().focus().setTextAlign("justify").run();
                                    aplicarEspacamentoParagrafo(editor, {
                                        recuoEsquerda: "4cm",
                                        recuoDireita: null,
                                        recuoPrimeiraLinha: null,
                                        entrelinha: "1.15",
                                    });
                                }}
                                className="border border-ink/20 bg-secondary/40 px-2 py-1.5 text-left text-[11px] font-medium text-ink hover:bg-ink/5"
                            >
                                Citação / Ementa
                                <span className="block text-[10px] text-muted-foreground">4 cm esq. · 1,15</span>
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    editor.chain().focus().setTextAlign("justify").run();
                                    aplicarEspacamentoParagrafo(editor, {
                                        recuoEsquerda: "2cm",
                                        recuoDireita: "2cm",
                                        recuoPrimeiraLinha: null,
                                    });
                                }}
                                className="border border-ink/20 bg-secondary/40 px-2 py-1.5 text-left text-[11px] font-medium text-ink hover:bg-ink/5"
                            >
                                Recuo bilateral
                                <span className="block text-[10px] text-muted-foreground">2 cm esq. e 2 cm dir.</span>
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    aplicarEspacamentoParagrafo(editor, {
                                        recuoEsquerda: null,
                                        recuoDireita: null,
                                        recuoPrimeiraLinha: null,
                                        entrelinha: null,
                                        espacoAntes: null,
                                        espacoDepois: null,
                                    });
                                }}
                                className="border border-ink/20 bg-card px-2 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-ink/5 hover:text-ink"
                            >
                                Zerar recuos
                                <span className="block text-[10px] text-muted-foreground">Voltar ao padrão</span>
                            </button>
                        </div>
                    </div>

                    {/* Recuo lateral (Esquerda e Direita) */}
                    <div className="space-y-2 border-t border-ink/10 pt-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Recuo lateral (cm)
                        </p>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label htmlFor="recuo-esq-cm" className="block text-[11px] font-medium text-ink">
                                    Esquerda
                                </label>
                                <input
                                    id="recuo-esq-cm"
                                    inputMode="decimal"
                                    value={esqTexto}
                                    onChange={(e) => setEsqTexto(e.target.value)}
                                    onBlur={() => {
                                        const n = Number(esqTexto.replace(",", "."));
                                        if (Number.isFinite(n)) aplicarEsq(n);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            const n = Number(esqTexto.replace(",", "."));
                                            if (Number.isFinite(n)) aplicarEsq(n);
                                        }
                                    }}
                                    className="mt-0.5 h-7 w-full border border-ink/20 bg-card px-2 text-xs text-ink focus:border-ink focus:outline-none"
                                />
                                <div className="mt-1 flex gap-1">
                                    {OPCOES_RECUO_CM.map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => aplicarEsq(v)}
                                            className={cn(
                                                "flex-1 border py-0.5 text-[10px] font-medium",
                                                Math.abs(esqAtual - v) < 0.05
                                                    ? "border-ink bg-ink text-paper"
                                                    : "border-ink/20 text-ink hover:bg-ink/5",
                                            )}
                                        >
                                            {String(v).replace(".", ",")}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label htmlFor="recuo-dir-cm" className="block text-[11px] font-medium text-ink">
                                    Direita
                                </label>
                                <input
                                    id="recuo-dir-cm"
                                    inputMode="decimal"
                                    value={dirTexto}
                                    onChange={(e) => setDirTexto(e.target.value)}
                                    onBlur={() => {
                                        const n = Number(dirTexto.replace(",", "."));
                                        if (Number.isFinite(n)) aplicarDir(n);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            const n = Number(dirTexto.replace(",", "."));
                                            if (Number.isFinite(n)) aplicarDir(n);
                                        }
                                    }}
                                    className="mt-0.5 h-7 w-full border border-ink/20 bg-card px-2 text-xs text-ink focus:border-ink focus:outline-none"
                                />
                                <div className="mt-1 flex gap-1">
                                    {OPCOES_RECUO_CM.map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => aplicarDir(v)}
                                            className={cn(
                                                "flex-1 border py-0.5 text-[10px] font-medium",
                                                Math.abs(dirAtual - v) < 0.05
                                                    ? "border-ink bg-ink text-paper"
                                                    : "border-ink/20 text-ink hover:bg-ink/5",
                                            )}
                                        >
                                            {String(v).replace(".", ",")}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Especial: 1ª linha / Deslocado */}
                    <div className="border-t border-ink/10 pt-2.5">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Primeira linha / Especial
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                            {(
                                [
                                    { rotulo: "Nenhum", ativo: Math.abs(primAtual) < 0.05, patch: { recuoPrimeiraLinha: null } },
                                    {
                                        rotulo: "1ª linha (1,25 cm)",
                                        ativo: Math.abs(primAtual - 1.25) < 0.05,
                                        patch: { recuoPrimeiraLinha: "1.25cm" },
                                    },
                                    {
                                        rotulo: "1ª linha (2,0 cm)",
                                        ativo: Math.abs(primAtual - 2) < 0.05,
                                        patch: { recuoPrimeiraLinha: "2cm" },
                                    },
                                    {
                                        rotulo: "Deslocado (1,25 cm)",
                                        ativo: primAtual < -0.5,
                                        patch: { recuoEsquerda: "1.25cm", recuoPrimeiraLinha: "-1.25cm" },
                                    },
                                ] as const
                            ).map((op) => (
                                <button
                                    key={op.rotulo}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => aplicarEspacamentoParagrafo(editor, op.patch)}
                                    className={cn(
                                        "border px-2 py-1 text-left text-[11px] font-medium",
                                        op.ativo ? "border-ink bg-ink text-paper" : "border-ink/20 text-ink hover:bg-ink/5",
                                    )}
                                >
                                    {op.rotulo}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Entrelinha e espaço entre parágrafos */}
                    <div className="grid grid-cols-2 gap-2.5 border-t border-ink/10 pt-2.5">
                        <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Entre linhas
                            </p>
                            <div className="flex gap-1">
                                {OPCOES_ENTRELINHA.map((op) => {
                                    const ativo = (atual.entrelinha ?? "1.5") === op.valor;
                                    return (
                                        <button
                                            key={op.valor}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() =>
                                                aplicarEspacamentoParagrafo(editor, {
                                                    entrelinha: op.valor === "1.5" ? null : op.valor,
                                                })
                                            }
                                            className={cn(
                                                "flex-1 border py-1 text-[10px] font-semibold",
                                                ativo ? "border-ink bg-ink text-paper" : "border-ink/20 text-ink hover:bg-ink/5",
                                            )}
                                        >
                                            {op.rotulo}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Após parágrafo
                            </p>
                            <div className="flex gap-1">
                                {OPCOES_ESPACO_PT.map((op) => {
                                    const ativo = (atual.espacoDepois ?? null) === op.valor;
                                    return (
                                        <button
                                            key={op.rotulo}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() =>
                                                aplicarEspacamentoParagrafo(editor, { espacoDepois: op.valor })
                                            }
                                            className={cn(
                                                "flex-1 border py-1 text-[10px] font-semibold",
                                                ativo ? "border-ink bg-ink text-paper" : "border-ink/20 text-ink hover:bg-ink/5",
                                            )}
                                        >
                                            {op.rotulo.replace(" pt", "")}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------- Menu Inserir (Link, Linha, Quebra) */

export function MenuInserirElemento({ editor, temLink }: { editor: Editor; temLink: boolean }) {
    const { aberto, setAberto, ref } = useMenuSuspenso();

    const gerenciarLink = () => {
        const atual = (editor.getAttributes("link").href as string | undefined) ?? "";
        const url = window.prompt("Endereço do link (https://… ou mailto:…):", atual || "https://");
        if (url === null) return;
        const limpo = url.trim();
        if (!limpo) {
            editor.chain().focus().unsetLink().run();
            setAberto(false);
            return;
        }
        if (!/^(?:https?:|mailto:)/i.test(limpo)) {
            toast.error("Use um endereço iniciado por https://, http:// ou mailto:.");
            return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: limpo }).run();
        setAberto(false);
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                title="Inserir link, linha horizontal ou quebra de página"
                aria-label="Inserir elemento"
                aria-expanded={aberto}
                aria-haspopup="menu"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAberto((v) => !v)}
                className={cn(
                    "inline-flex h-[26px] shrink-0 items-center gap-0.5 px-1 text-ink transition-colors",
                    temLink ? "bg-ink text-paper" : "hover:bg-ink/[0.07]",
                )}
            >
                <Plus className="size-3.5" />
                <ChevronDown aria-hidden className="size-2.5 opacity-70" />
            </button>

            {aberto && (
                <div className="absolute right-0 top-8 z-30 w-52 border border-ink/20 bg-card py-1 text-xs shadow-xl">
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={gerenciarLink}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-ink/5"
                    >
                        <Link2 className="size-3.5 text-ink/70" />
                        {temLink ? "Editar link…" : "Inserir link…"}
                    </button>
                    {temLink && (
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                editor.chain().focus().unsetLink().run();
                                setAberto(false);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-ink/5"
                        >
                            <Unlink className="size-3.5 text-ink/70" />
                            Remover link
                        </button>
                    )}
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            editor.chain().focus().setHorizontalRule().run();
                            setAberto(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-ink/5"
                    >
                        <Minus className="size-3.5 text-ink/70" />
                        Linha horizontal
                    </button>
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            editor.chain().focus().insertContent({ type: "quebraPagina" }).run();
                            setAberto(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-ink/5"
                    >
                        <SeparatorHorizontal className="size-3.5 text-ink/70" />
                        Quebra de página (Ctrl+Enter)
                    </button>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------- Micro-barra contextual de Tabela */

export function BarraTabelaContextual({ editor }: { editor: Editor }) {
    const cls =
        "inline-flex h-6 items-center gap-1 border border-ink/20 bg-card px-2 text-[11px] font-medium text-ink hover:bg-ink/5 disabled:opacity-40";
    return (
        <div
            role="toolbar"
            aria-label="Opções da tabela"
            className="flex flex-wrap items-center gap-1 border-b border-ink/15 bg-secondary/60 px-2 py-1 text-[11px]"
        >
            <span className="mr-1 font-semibold uppercase tracking-wider text-muted-foreground">Tabela:</span>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addRowBefore().run()} className={cls}>
                + Linha acima
            </button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addRowAfter().run()} className={cls}>
                + Linha abaixo
            </button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteRow().run()} className={cls}>
                − Linha
            </button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addColumnBefore().run()} className={cls}>
                + Coluna antes
            </button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addColumnAfter().run()} className={cls}>
                + Coluna depois
            </button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteColumn().run()} className={cls}>
                − Coluna
            </button>
            <button
                type="button"
                disabled={!editor.can().mergeCells()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().mergeCells().run()}
                className={cls}
            >
                <TableCellsMerge className="size-3" /> Mesclar
            </button>
            <button
                type="button"
                disabled={!editor.can().splitCell()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().splitCell().run()}
                className={cls}
            >
                <TableCellsSplit className="size-3" /> Dividir
            </button>
            <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="ml-auto inline-flex h-6 items-center gap-1 border border-destructive/35 bg-card px-2 text-[11px] font-medium text-destructive hover:bg-destructive/5"
            >
                <Trash2 className="size-3" /> Excluir tabela
            </button>
        </div>
    );
}

/* ------------------------------------------------------- Barra Localizar e Substituir */

export function BarraLocalizarSubstituir({
    editor,
    onFechar,
}: {
    editor: Editor;
    onFechar: () => void;
}) {
    const [busca, setBusca] = useState("");
    const [substituto, setSubstituto] = useState("");
    const [sensivel, setSensivel] = useState(false);
    const [indiceAtual, setIndiceAtual] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const ocorrencias = localizarOcorrencias(editor, busca, sensivel);

    const irPara = (idx: number) => {
        if (ocorrencias.length === 0) return;
        const pos = ((idx % ocorrencias.length) + ocorrencias.length) % ocorrencias.length;
        setIndiceAtual(pos);
        const oc = ocorrencias[pos];
        editor.chain().focus().setTextSelection({ from: oc.from, to: oc.to }).scrollIntoView().run();
    };

    const substituir = (todas: boolean) => {
        const qtd = substituirOcorrencias(editor, busca, substituto, todas, sensivel);
        if (qtd > 0) {
            toast.success(qtd === 1 ? "1 ocorrência substituída." : `${qtd} ocorrências substituídas.`);
            setIndiceAtual(0);
        } else {
            toast.info("Nenhuma ocorrência encontrada.");
        }
    };

    return (
        <div
            role="search"
            aria-label="Localizar e substituir"
            className="flex flex-wrap items-center gap-1.5 border-b border-ink/15 bg-secondary/50 px-2.5 py-1.5 text-xs"
        >
            <Search aria-hidden className="size-3.5 text-muted-foreground" />
            <input
                ref={inputRef}
                value={busca}
                onChange={(e) => {
                    setBusca(e.target.value);
                    setIndiceAtual(0);
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        irPara(e.shiftKey ? indiceAtual - 1 : indiceAtual + 1);
                    } else if (e.key === "Escape") {
                        onFechar();
                    }
                }}
                placeholder="Localizar no texto…"
                className="h-7 w-40 border border-ink/20 bg-card px-2 text-xs text-ink focus:border-ink focus:outline-none"
            />
            <input
                value={substituto}
                onChange={(e) => setSubstituto(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Escape") onFechar();
                }}
                placeholder="Substituir por…"
                className="h-7 w-40 border border-ink/20 bg-card px-2 text-xs text-ink focus:border-ink focus:outline-none"
            />
            <button
                type="button"
                aria-pressed={sensivel}
                title="Diferenciar maiúsculas de minúsculas"
                onClick={() => setSensivel((v) => !v)}
                className={cn(
                    "h-7 border px-1.5 text-[11px] font-semibold",
                    sensivel ? "border-ink bg-ink text-paper" : "border-ink/20 bg-card text-ink/70 hover:bg-ink/5",
                )}
            >
                Aa
            </button>
            <span className="min-w-[4.5rem] text-[11px] tabular-nums text-muted-foreground">
                {busca ? (ocorrencias.length > 0 ? `${Math.min(indiceAtual + 1, ocorrencias.length)} de ${ocorrencias.length}` : "0 achados") : ""}
            </span>
            <button
                type="button"
                disabled={ocorrencias.length === 0}
                onClick={() => irPara(indiceAtual + 1)}
                className="h-7 border border-ink/20 bg-card px-2 text-[11px] font-medium text-ink hover:bg-ink/5 disabled:opacity-40"
            >
                Próxima
            </button>
            <button
                type="button"
                disabled={ocorrencias.length === 0}
                onClick={() => substituir(false)}
                className="h-7 border border-ink/20 bg-card px-2 text-[11px] font-medium text-ink hover:bg-ink/5 disabled:opacity-40"
            >
                Substituir
            </button>
            <button
                type="button"
                disabled={ocorrencias.length === 0}
                onClick={() => substituir(true)}
                className="h-7 bg-ink px-2 text-[11px] font-semibold text-paper hover:bg-ink-soft disabled:opacity-40"
            >
                Substituir tudo
            </button>
            <button
                type="button"
                onClick={onFechar}
                aria-label="Fechar localizar e substituir"
                className="ml-auto inline-flex size-7 items-center justify-center text-ink/60 hover:text-ink"
            >
                <X className="size-3.5" />
            </button>
        </div>
    );
}
