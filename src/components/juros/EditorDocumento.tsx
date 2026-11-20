import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PmNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extensions";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    Bold,
    Braces,
    ChevronDown,
    Italic,
    List,
    ListOrdered,
    Minus,
    Quote,
    Redo2,
    Ruler,
    SeparatorHorizontal,
    Strikethrough,
    Table as IconeTabela,
    Underline as IconeSublinhado,
    Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    CAMPOS_DOCUMENTO,
    FORMATOS_PAPEL,
    GRUPOS_CAMPOS,
    PREDEFINICOES_MARGEM,
    REGEX_CAMPO,
    acharCampoConhecido,
    ehRotuloCampo,
    geometriaDaPagina,
    idPredefinicaoMargem,
    normalizarConfigPagina,
    resumoConfigPagina,
    type ConfigPagina,
    type FormatoPapel,
    type MargensPagina,
} from "@/lib/documentos";
import { Paginacao, QuebraPagina, type PaginacaoStorage } from "@/components/juros/paginacao-editor";

/* ------------------------------------------------------- Destaque dos [campos] */

type ModoEditor = "modelo" | "documento";

const chaveDestaque = new PluginKey<DecorationSet>("destaque-campos");

function decoracoesCampos(doc: PmNode, modo: ModoEditor): DecorationSet {
    const decos: Decoration[] = [];
    doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        for (const m of node.text.matchAll(REGEX_CAMPO)) {
            if (!ehRotuloCampo(m[1])) continue;
            const inicio = pos + (m.index ?? 0);
            const conhecido = Boolean(acharCampoConhecido(m[1]));
            // No modelo: dourado = o sistema preenche sozinho; tracejado = vai perguntar na hora.
            // No documento: qualquer colchete que sobrou ainda precisa ser preenchido.
            const classe =
                modo === "documento"
                    ? "campo-doc campo-doc--pendente"
                    : conhecido
                      ? "campo-doc"
                      : "campo-doc campo-doc--manual";
            decos.push(
                Decoration.inline(inicio, inicio + m[0].length, {
                    class: classe,
                    title:
                        modo === "documento"
                            ? "Campo ainda não preenchido"
                            : conhecido
                              ? "Preenchido com os dados do cliente"
                              : "Campo personalizado: será perguntado ao gerar o documento",
                }),
            );
        }
    });
    return DecorationSet.create(doc, decos);
}

const DestaqueCampos = Extension.create<{ modo: ModoEditor }>({
    name: "destaqueCampos",
    addOptions() {
        return { modo: "modelo" };
    },
    addProseMirrorPlugins() {
        const modo = this.options.modo;
        return [
            new Plugin<DecorationSet>({
                key: chaveDestaque,
                state: {
                    init: (_, { doc }) => decoracoesCampos(doc, modo),
                    apply: (tr, antigo) => (tr.docChanged ? decoracoesCampos(tr.doc, modo) : antigo),
                },
                props: {
                    decorations(state) {
                        return chaveDestaque.getState(state);
                    },
                },
            }),
        ];
    },
});

/* ------------------------------------------------------- Barra de ferramentas */

const FONTES = [
    { rotulo: "Times New Roman", valor: '"Times New Roman", Times, serif' },
    { rotulo: "Arial", valor: "Arial, Helvetica, sans-serif" },
    { rotulo: "Calibri", valor: "Calibri, Carlito, sans-serif" },
    { rotulo: "Garamond", valor: "Garamond, 'EB Garamond', serif" },
];
const TAMANHOS = ["10pt", "11pt", "14pt", "16pt", "18pt"];

function BotaoFerramenta({
    ativo,
    desabilitado,
    rotulo,
    onClick,
    children,
}: {
    ativo?: boolean;
    desabilitado?: boolean;
    rotulo: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            title={rotulo}
            aria-label={rotulo}
            aria-pressed={ativo}
            disabled={desabilitado}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center text-ink transition-colors duration-150 disabled:opacity-35",
                ativo ? "bg-ink text-paper" : "hover:bg-ink/[0.07]",
            )}
        >
            {children}
        </button>
    );
}

const Separador = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-ink/15" />;


function MenuInserirCampo({ editor }: { editor: Editor }) {
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

    const inserir = (rotulo: string) => {
        editor.chain().focus().insertContent(`[${rotulo}]`).run();
        setAberto(false);
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                aria-expanded={aberto}
                aria-haspopup="menu"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAberto((v) => !v)}
                className="inline-flex h-8 items-center gap-1.5 bg-gold px-2.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-gold-light"
            >
                <Braces aria-hidden className="size-3.5" />
                Inserir campo
                <ChevronDown aria-hidden className="size-3" />
            </button>
            {aberto && (
                <div
                    role="menu"
                    className="absolute right-0 top-9 z-30 max-h-[60vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto border border-ink/20 bg-card py-1 shadow-xl"
                >
                    {GRUPOS_CAMPOS.map((grupo) => (
                        <div key={grupo}>
                            <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {grupo}
                            </p>
                            {CAMPOS_DOCUMENTO.filter((c) => c.grupo === grupo).map((c) => (
                                <button
                                    key={c.rotulo}
                                    type="button"
                                    role="menuitem"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => inserir(c.rotulo)}
                                    className="block w-full px-3 py-1.5 text-left hover:bg-ink/[0.05]"
                                >
                                    <span className="block text-sm font-medium text-ink">[{c.rotulo}]</span>
                                    <span className="block text-[11px] text-muted-foreground">{c.descricao}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                    <div className="mt-1 border-t border-ink/10 px-3 py-2.5 text-[11px] leading-snug text-muted-foreground">
                        Qualquer texto entre colchetes vira um campo. Ex.:{" "}
                        <strong className="text-ink">[CPF do cliente]</strong> é perguntado na hora de gerar o documento.
                    </div>
                </div>
            )}
        </div>
    );
}

function usePopover() {
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

const ROTULOS_MARGEM: Array<{ chave: keyof MargensPagina; rotulo: string }> = [
    { chave: "superior", rotulo: "Superior" },
    { chave: "inferior", rotulo: "Inferior" },
    { chave: "esquerda", rotulo: "Esquerda" },
    { chave: "direita", rotulo: "Direita" },
];

function MenuPagina({ pagina, onChange }: { pagina: ConfigPagina; onChange: (c: ConfigPagina) => void }) {
    const { aberto, setAberto, ref } = usePopover();
    const predefinicao = idPredefinicaoMargem(pagina.margens);
    const [personalizada, setPersonalizada] = useState(predefinicao === "personalizada");
    const [rascunho, setRascunho] = useState<Record<keyof MargensPagina, string>>(() => ({
        superior: String(pagina.margens.superior).replace(".", ","),
        inferior: String(pagina.margens.inferior).replace(".", ","),
        esquerda: String(pagina.margens.esquerda).replace(".", ","),
        direita: String(pagina.margens.direita).replace(".", ","),
    }));

    useEffect(() => {
        if (!aberto) return;
        setPersonalizada(idPredefinicaoMargem(pagina.margens) === "personalizada");
        setRascunho({
            superior: String(pagina.margens.superior).replace(".", ","),
            inferior: String(pagina.margens.inferior).replace(".", ","),
            esquerda: String(pagina.margens.esquerda).replace(".", ","),
            direita: String(pagina.margens.direita).replace(".", ","),
        });
    }, [aberto, pagina.margens]);

    const aplicarRascunho = (r: Record<keyof MargensPagina, string>) => {
        onChange(normalizarConfigPagina({ formato: pagina.formato, margens: r }));
    };

    const classeSelect =
        "h-8 w-full border border-ink/20 bg-card px-1.5 text-xs font-medium text-ink focus:border-ink focus:outline-none";

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                aria-expanded={aberto}
                aria-haspopup="dialog"
                title="Papel e margens"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAberto((v) => !v)}
                className="inline-flex h-8 items-center gap-1.5 border border-ink/20 bg-card px-2 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/[0.05]"
            >
                <Ruler aria-hidden className="size-3.5" />
                {resumoConfigPagina(pagina)}
                <ChevronDown aria-hidden className="size-3" />
            </button>
            {aberto && (
                <div
                    role="dialog"
                    aria-label="Configurar página"
                    className="absolute left-0 top-9 z-30 w-72 max-w-[calc(100vw-2rem)] space-y-3 border border-ink/20 bg-card p-3 shadow-xl"
                >
                    <div>
                        <label htmlFor="pagina-papel" className="mb-1 block text-[11px] font-semibold text-ink">
                            Papel
                        </label>
                        <select
                            id="pagina-papel"
                            value={pagina.formato}
                            onChange={(e) => onChange({ ...pagina, formato: e.target.value as FormatoPapel })}
                            className={classeSelect}
                        >
                            {(Object.keys(FORMATOS_PAPEL) as FormatoPapel[]).map((f) => (
                                <option key={f} value={f}>
                                    {FORMATOS_PAPEL[f].rotulo}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="pagina-margens" className="mb-1 block text-[11px] font-semibold text-ink">
                            Margens
                        </label>
                        <select
                            id="pagina-margens"
                            value={personalizada ? "personalizada" : predefinicao}
                            onChange={(e) => {
                                const id = e.target.value;
                                if (id === "personalizada") {
                                    setPersonalizada(true);
                                    return;
                                }
                                setPersonalizada(false);
                                const p = PREDEFINICOES_MARGEM.find((x) => x.id === id);
                                if (p) onChange({ ...pagina, margens: { ...p.margens } });
                            }}
                            className={classeSelect}
                        >
                            {PREDEFINICOES_MARGEM.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.rotulo}
                                </option>
                            ))}
                            <option value="personalizada">Personalizadas…</option>
                        </select>
                    </div>
                    {personalizada && (
                        <div className="grid grid-cols-2 gap-2">
                            {ROTULOS_MARGEM.map(({ chave, rotulo }) => (
                                <label key={chave} className="block text-[11px] font-medium text-muted-foreground">
                                    {rotulo} (cm)
                                    <input
                                        inputMode="decimal"
                                        value={rascunho[chave]}
                                        onChange={(e) => setRascunho((r) => ({ ...r, [chave]: e.target.value }))}
                                        onBlur={() => aplicarRascunho(rascunho)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") aplicarRascunho(rascunho);
                                        }}
                                        className="mt-0.5 h-8 w-full border border-ink/20 bg-card px-2 text-xs text-ink focus:border-ink focus:outline-none"
                                    />
                                </label>
                            ))}
                            <p className="col-span-2 text-[10px] text-muted-foreground">Entre 0,5 e 6 cm.</p>
                        </div>
                    )}
                    <p className="border-t border-ink/10 pt-2 text-[10px] leading-snug text-muted-foreground">
                        Vale só para este arquivo. O Word e o PDF saem com o mesmo papel e as mesmas margens.
                    </p>
                </div>
            )}
        </div>
    );
}

function BarraFerramentas({
    editor,
    pagina,
    onPaginaChange,
}: {
    editor: Editor;
    pagina: ConfigPagina;
    onPaginaChange: (c: ConfigPagina) => void;
}) {
    const estado = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            negrito: e.isActive("bold"),
            italico: e.isActive("italic"),
            sublinhado: e.isActive("underline"),
            tachado: e.isActive("strike"),
            esquerda: e.isActive({ textAlign: "left" }),
            centro: e.isActive({ textAlign: "center" }),
            direita: e.isActive({ textAlign: "right" }),
            justificado: e.isActive({ textAlign: "justify" }),
            lista: e.isActive("bulletList"),
            listaNumerada: e.isActive("orderedList"),
            citacao: e.isActive("blockquote"),
            h1: e.isActive("heading", { level: 1 }),
            h2: e.isActive("heading", { level: 2 }),
            fonte: (e.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
            tamanho: (e.getAttributes("textStyle").fontSize as string | undefined) ?? "",
            podeDesfazer: e.can().undo(),
            podeRefazer: e.can().redo(),
            naTabela: e.isActive("table"),
        }),
    });

    const estiloBloco = estado.h1 ? "h1" : estado.h2 ? "h2" : "p";
    const classeSelect =
        "h-8 shrink-0 border border-ink/20 bg-card px-1.5 text-xs font-medium text-ink focus:border-ink focus:outline-none";

    return (
        <div
            role="toolbar"
            aria-label="Formatação do texto"
            className="flex flex-wrap items-center gap-0.5 border-b border-ink/15 bg-card px-2 py-1.5"
        >
            <BotaoFerramenta
                rotulo="Desfazer (Ctrl+Z)"
                desabilitado={!estado.podeDesfazer}
                onClick={() => editor.chain().focus().undo().run()}
            >
                <Undo2 className="size-4" />
            </BotaoFerramenta>
            <BotaoFerramenta
                rotulo="Refazer (Ctrl+Y)"
                desabilitado={!estado.podeRefazer}
                onClick={() => editor.chain().focus().redo().run()}
            >
                <Redo2 className="size-4" />
            </BotaoFerramenta>
            <Separador />
            <select
                aria-label="Estilo do parágrafo"
                value={estiloBloco}
                onChange={(e) => {
                    const v = e.target.value;
                    if (v === "p") editor.chain().focus().setParagraph().run();
                    else editor.chain().focus().setHeading({ level: v === "h1" ? 1 : 2 }).run();
                }}
                className={cn(classeSelect, "w-[104px]")}
            >
                <option value="p">Texto normal</option>
                <option value="h1">Título</option>
                <option value="h2">Subtítulo</option>
            </select>
            <select
                aria-label="Fonte"
                value={FONTES.find((f) => f.valor === estado.fonte)?.valor ?? ""}
                onChange={(e) => {
                    const v = e.target.value;
                    if (v) editor.chain().focus().setFontFamily(v).run();
                    else editor.chain().focus().unsetFontFamily().run();
                }}
                className={cn(classeSelect, "ml-1 w-[124px]")}
            >
                <option value="">Fonte padrão</option>
                {FONTES.map((f) => (
                    <option key={f.rotulo} value={f.valor}>
                        {f.rotulo}
                    </option>
                ))}
            </select>
            <select
                aria-label="Tamanho da letra"
                value={estado.tamanho}
                onChange={(e) => {
                    const v = e.target.value;
                    if (v) editor.chain().focus().setFontSize(v).run();
                    else editor.chain().focus().unsetFontSize().run();
                }}
                className={cn(classeSelect, "ml-1 w-[58px]")}
            >
                <option value="">12</option>
                {TAMANHOS.map((t) => (
                    <option key={t} value={t}>
                        {t.replace("pt", "")}
                    </option>
                ))}
            </select>
            <Separador />
            <BotaoFerramenta
                rotulo="Negrito (Ctrl+B)"
                ativo={estado.negrito}
                onClick={() => editor.chain().focus().toggleBold().run()}
            >
                <Bold className="size-4" />
            </BotaoFerramenta>
            <BotaoFerramenta
                rotulo="Itálico (Ctrl+I)"
                ativo={estado.italico}
                onClick={() => editor.chain().focus().toggleItalic().run()}
            >
                <Italic className="size-4" />
            </BotaoFerramenta>
            <BotaoFerramenta
                rotulo="Sublinhado (Ctrl+U)"
                ativo={estado.sublinhado}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
                <IconeSublinhado className="size-4" />
            </BotaoFerramenta>
            <BotaoFerramenta
                rotulo="Tachado"
                ativo={estado.tachado}
                onClick={() => editor.chain().focus().toggleStrike().run()}
            >
                <Strikethrough className="size-4" />
            </BotaoFerramenta>
            <Separador />
            <BotaoFerramenta
                rotulo="Alinhar à esquerda"
                ativo={estado.esquerda}
                onClick={() => editor.chain().focus().setTextAlign("left").run()}
            >
                <AlignLeft className="size-4" />
            </BotaoFerramenta>
            <BotaoFerramenta
                rotulo="Centralizar"
                ativo={estado.centro}
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
            >
                <AlignCenter className="size-4" />
            </BotaoFerramenta>
            <BotaoFerramenta
                rotulo="Alinhar à direita"
                ativo={estado.direita}
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
            >
                <AlignRight className="size-4" />
            </BotaoFerramenta>
            <BotaoFerramenta
                rotulo="Justificar"
                ativo={estado.justificado}
                onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            >
                <AlignJustify className="size-4" />
            </BotaoFerramenta>
            <Separador />
            <BotaoFerramenta
                rotulo="Lista com marcadores"
                ativo={estado.lista}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
                <List className="size-4" />
            </BotaoFerramenta>
            <BotaoFerramenta
                rotulo="Lista numerada"
                ativo={estado.listaNumerada}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
                <ListOrdered className="size-4" />
            </BotaoFerramenta>
            <BotaoFerramenta
                rotulo="Citação recuada (4 cm)"
                ativo={estado.citacao}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
                <Quote className="size-4" />
            </BotaoFerramenta>
            <BotaoFerramenta
                rotulo={estado.naTabela ? "Remover tabela" : "Inserir tabela"}
                ativo={estado.naTabela}
                onClick={() =>
                    estado.naTabela
                        ? editor.chain().focus().deleteTable().run()
                        : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run()
                }
            >
                <IconeTabela className="size-4" />
            </BotaoFerramenta>
            <BotaoFerramenta rotulo="Linha horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                <Minus className="size-4" />
            </BotaoFerramenta>
            <BotaoFerramenta
                rotulo="Quebra de página (Ctrl+Enter)"
                onClick={() => editor.chain().focus().insertContent({ type: "quebraPagina" }).run()}
            >
                <SeparatorHorizontal className="size-4" />
            </BotaoFerramenta>
            <Separador />
            <MenuPagina pagina={pagina} onChange={onPaginaChange} />
            <div className="ml-auto pl-2">
                <MenuInserirCampo editor={editor} />
            </div>
        </div>
    );
}

/* ------------------------------------------------------- Editor */

interface EditorDocumentoProps {
    /** HTML inicial. Trocar a `chave` recria o editor com outro conteúdo. */
    conteudoInicial: string;
    chave: string;
    modo: ModoEditor;
    pagina: ConfigPagina;
    onPaginaChange: (c: ConfigPagina) => void;
    onChange: (html: string) => void;
}

const ESPACO_ROTULO_FINAL = 28;

export function EditorDocumento({ conteudoInicial, chave, modo, pagina, onPaginaChange, onChange }: EditorDocumentoProps) {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const areaRef = useRef<HTMLDivElement>(null);
    const [paginas, setPaginas] = useState(1);
    const [escala, setEscala] = useState(1);

    const geometria = useMemo(() => geometriaDaPagina(pagina), [pagina]);

    const extensoes = useMemo(
        () => [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                link: {
                    openOnClick: false,
                    autolink: true,
                    protocols: ["http", "https", "mailto"],
                    isAllowedUri: (url, ctx) => {
                        if (!ctx.defaultValidate(url)) return false;
                        return /^(?:https?:|mailto:)/i.test(url.trim());
                    },
                },
            }),
            TextStyle,
            FontFamily,
            FontSize,
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            QuebraPagina,
            Paginacao,
            Placeholder.configure({
                placeholder:
                    modo === "modelo"
                        ? "Escreva o modelo. Use “Inserir campo” para colocar [nome do cliente], [número do processo]..."
                        : "Escreva o documento...",
            }),
            DestaqueCampos.configure({ modo }),
        ],
        [modo],
    );

    const editor = useEditor(
        {
            extensions: extensoes,
            content: conteudoInicial,
            editorProps: {
                attributes: {
                    class: "folha-documento-conteudo",
                    spellcheck: "true",
                    lang: "pt-BR",
                    "aria-label": modo === "modelo" ? "Texto do modelo" : "Texto do documento",
                },
            },
            onUpdate: ({ editor: e }) => onChangeRef.current(e.getHTML()),
        },
        [chave, extensoes],
    );

    // Papel/margens mudaram (ou o editor foi recriado): mede de novo as folhas.
    useEffect(() => {
        if (!editor) return;
        const storage = (editor.storage as unknown as { paginacao: PaginacaoStorage }).paginacao;
        storage.geometria = geometria;
        storage.aoMudarPaginas = setPaginas;
        setPaginas(storage.paginas);
        // Espera o React aplicar as novas margens no DOM antes de medir.
        const id = requestAnimationFrame(() => storage.recalcular());
        return () => {
            cancelAnimationFrame(id);
            storage.aoMudarPaginas = null;
        };
    }, [editor, geometria]);

    // Folha mais larga que a tela (celular, janela estreita): reduz o zoom para caber, como o Word.
    useEffect(() => {
        const area = areaRef.current;
        if (!area) return;
        const medir = () => {
            const estilo = getComputedStyle(area);
            const livre = area.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
            setEscala(livre > 0 ? Math.min(1, livre / geometria.largura) : 1);
        };
        medir();
        const obs = new ResizeObserver(medir);
        obs.observe(area);
        return () => obs.disconnect();
    }, [geometria.largura]);

    if (!editor) return null;

    const passo = geometria.altura + geometria.intervalo;
    const alturaTotal = paginas * passo - geometria.intervalo;
    const variaveis = {
        "--pag-largura": `${geometria.largura}px`,
        "--pag-ms": `${geometria.margemSuperior}px`,
        "--pag-mi": `${geometria.margemInferior}px`,
        "--pag-me": `${geometria.margemEsquerda}px`,
        "--pag-md": `${geometria.margemDireita}px`,
        "--pag-total": `${alturaTotal}px`,
    } as CSSProperties;

    return (
        <div className="flex min-w-0 flex-1 flex-col border border-ink/15 bg-card">
            <div className="sticky top-14 z-20">
                <BarraFerramentas editor={editor} pagina={pagina} onPaginaChange={onPaginaChange} />
            </div>
            <div ref={areaRef} className="flex-1 overflow-hidden bg-secondary/70 px-2 py-4 sm:px-6 sm:py-8">
                <div
                    className="relative mx-auto"
                    style={{
                        width: geometria.largura * escala,
                        height: (alturaTotal + ESPACO_ROTULO_FINAL) * escala,
                    }}
                >
                    <div
                        className="folha-paginada absolute left-0 top-0 origin-top-left"
                        style={{ ...variaveis, width: geometria.largura, transform: `scale(${escala})` }}
                    >
                        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0">
                            {Array.from({ length: paginas }, (_, i) => (
                                <div key={i}>
                                    <div className="pagina-fundo" style={{ top: i * passo, height: geometria.altura }} />
                                    <div
                                        className="pagina-rotulo"
                                        style={{ top: i * passo + geometria.altura + 6 }}
                                    >
                                        Página {i + 1} de {paginas}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <EditorContent editor={editor} />
                    </div>
                </div>
            </div>
        </div>
    );
}
