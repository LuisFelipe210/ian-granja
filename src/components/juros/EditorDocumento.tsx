import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PmNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { BackgroundColor, Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
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
    ImagePlus,
    IndentDecrease,
    IndentIncrease,
    Italic,
    List,
    ListOrdered,
    Loader2,
    PenTool,
    Quote,
    Redo2,
    Ruler,
    Search,
    Stamp,
    Table as IconeTabela,
    Trash2,
    Underline as IconeSublinhado,
    Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logoTimbrado from "@/assets/logo.png";
import { definirConfigEscritorio } from "@/lib/config-escritorio";
import { useConfigEscritorio } from "@/lib/use-config-escritorio";
import { salvarTimbradoEscritorio } from "@/lib/revisional-db";
import { prepararImagemTimbradoA4 } from "@/lib/timbrado-imagem";
import {
    CAMPOS_DOCUMENTO,
    FORMATOS_PAPEL,
    GRUPOS_CAMPOS,
    PREDEFINICOES_MARGEM,
    PX_POR_CM,
    REGEX_CAMPO,
    acharCampoConhecido,
    dadosTimbradoEscritorio,
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
import { ReguaHorizontal, ReguaVertical } from "@/components/juros/ReguaEditor";
import { BlocoAssinatura } from "@/components/juros/BlocoAssinaturaEditor";
import {
    EspacamentoParagrafo,
    PASSO_RECUO_CM,
    Sobrescrito,
    Subscrito,
    ajustarRecuoLateral,
} from "@/components/juros/extensoes-word-editor";
import {
    BarraLocalizarSubstituir,
    BarraTabelaContextual,
    MenuCorTexto,
    MenuFonteEditor,
    MenuFormatoExtra,
    MenuInserirElemento,
    MenuRecuoEspacamento,
} from "@/components/juros/BarraWordEditor";
import { garantirFontesEditorCarregadas } from "@/lib/fontes-editor";

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

const TAMANHOS = ["8pt", "9pt", "10pt", "11pt", "12pt", "13pt", "14pt", "16pt", "18pt", "20pt", "24pt", "28pt"];

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
                "inline-flex size-[26px] shrink-0 items-center justify-center text-ink transition-colors duration-150 disabled:opacity-35",
                ativo ? "bg-ink text-paper" : "hover:bg-ink/[0.07]",
            )}
        >
            {children}
        </button>
    );
}

const Separador = () => <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-ink/15" />;


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
                className="inline-flex h-7 items-center gap-1 whitespace-nowrap bg-gold px-2 text-[11px] font-semibold text-ink transition-colors duration-150 hover:bg-gold-light"
            >
                <Braces aria-hidden className="size-3" />
                Inserir campo
                <ChevronDown aria-hidden className="size-3" />
            </button>
            {aberto && (
                <div
                    role="menu"
                    className="absolute right-0 top-8 z-30 max-h-[60vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto border border-ink/20 bg-card py-1 shadow-xl"
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
    const [importandoTimbrado, setImportandoTimbrado] = useState(false);
    const inputTimbradoRef = useRef<HTMLInputElement>(null);
    const configEscritorio = useConfigEscritorio();
    const temTimbradoProprio = Boolean(configEscritorio.timbradoImagemUrl);

    const importarTimbrado = async (arquivo?: File) => {
        if (!arquivo) return;
        setImportandoTimbrado(true);
        try {
            const dataUrl = await prepararImagemTimbradoA4(arquivo);
            const atualizado = await salvarTimbradoEscritorio(dataUrl);
            definirConfigEscritorio(atualizado);
            if (!pagina.timbrado) onChange({ ...pagina, timbrado: true });
            toast.success("Timbrado A4 importado e aplicado em todas as páginas.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível importar o timbrado.");
        } finally {
            setImportandoTimbrado(false);
            if (inputTimbradoRef.current) inputTimbradoRef.current.value = "";
        }
    };

    const removerTimbradoProprio = async () => {
        setImportandoTimbrado(true);
        try {
            const atualizado = await salvarTimbradoEscritorio("");
            definirConfigEscritorio(atualizado);
            toast.success("Timbrado personalizado removido. Usando o padrão do escritório.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível remover o timbrado.");
        } finally {
            setImportandoTimbrado(false);
        }
    };

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
        onChange(normalizarConfigPagina({ formato: pagina.formato, margens: r, timbrado: pagina.timbrado }));
    };

    const classeSelect =
        "h-8 w-full border border-ink/20 bg-card px-1.5 text-xs font-medium text-ink focus:border-ink focus:outline-none";

    return (
        <div ref={ref} className="relative">
            <input
                id="input-timbrado-editor"
                ref={inputTimbradoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                className="sr-only"
                disabled={importandoTimbrado}
                onChange={(e) => void importarTimbrado(e.target.files?.[0])}
            />
            <button
                type="button"
                aria-expanded={aberto}
                aria-haspopup="dialog"
                title="Papel, margens e timbrado"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAberto((v) => !v)}
                className="inline-flex h-7 items-center gap-1 whitespace-nowrap border border-ink/20 bg-card px-1.5 text-[11px] font-semibold text-ink transition-colors duration-150 hover:bg-ink/[0.05]"
            >
                <Ruler aria-hidden className="size-3" />
                {resumoConfigPagina(pagina)}
                <ChevronDown aria-hidden className="size-3" />
            </button>
            {aberto && (
                <div
                    role="dialog"
                    aria-label="Configurar página"
                    className="absolute right-0 top-8 z-30 w-72 max-w-[calc(100vw-2rem)] space-y-3 border border-ink/20 bg-card p-3 shadow-xl"
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
                    <div className="space-y-2 border-t border-ink/10 pt-2.5">
                        <label className="flex cursor-pointer items-start gap-2 text-xs text-ink">
                            <input
                                type="checkbox"
                                checked={pagina.timbrado}
                                onChange={(e) => onChange({ ...pagina, timbrado: e.target.checked })}
                                className="mt-0.5 accent-ink"
                            />
                            <span className="leading-snug">
                                <span className="block font-semibold">Papel timbrado do escritório</span>
                                <span className="block text-[10px] text-muted-foreground">
                                    {temTimbradoProprio
                                        ? "Usando sua imagem A4 importada em todas as folhas."
                                        : "Usando cabeçalho e rodapé padrão. Você pode importar seu A4 abaixo."}
                                </span>
                            </span>
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5 pl-5">
                            <label
                                htmlFor="input-timbrado-editor"
                                className={cn(
                                    "inline-flex h-7 cursor-pointer items-center gap-1.5 border border-ink/25 bg-card px-2 text-[11px] font-semibold text-ink hover:bg-ink/5",
                                    importandoTimbrado && "pointer-events-none opacity-50",
                                )}
                            >
                                {importandoTimbrado ? (
                                    <Loader2 aria-hidden className="size-3 animate-spin" />
                                ) : (
                                    <ImagePlus aria-hidden className="size-3 text-gold-deep" />
                                )}
                                {temTimbradoProprio ? "Trocar timbrado A4" : "Importar meu timbrado (A4)"}
                            </label>
                            {temTimbradoProprio && (
                                <button
                                    type="button"
                                    disabled={importandoTimbrado}
                                    onClick={() => void removerTimbradoProprio()}
                                    title="Voltar ao timbrado padrão do sistema"
                                    className="inline-flex h-7 items-center gap-1 border border-ink/20 px-2 text-[11px] font-medium text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
                                >
                                    <Trash2 aria-hidden className="size-3" />
                                    Padrão
                                </button>
                            )}
                        </div>
                    </div>
                    <p className="border-t border-ink/10 pt-2 text-[10px] leading-snug text-muted-foreground">
                        Ajuste as margens acima se quiser alinhar o texto ao cabeçalho e rodapé da sua arte A4.
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
    buscaAberta,
    onAlternarBusca,
    reguaVisivel,
    onAlternarRegua,
}: {
    editor: Editor;
    pagina: ConfigPagina;
    onPaginaChange: (c: ConfigPagina) => void;
    buscaAberta: boolean;
    onAlternarBusca: () => void;
    reguaVisivel: boolean;
    onAlternarRegua: () => void;
}) {
    const estado = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            negrito: e.isActive("bold"),
            italico: e.isActive("italic"),
            sublinhado: e.isActive("underline"),
            tachado: e.isActive("strike"),
            sobrescrito: e.isActive("sobrescrito"),
            subscrito: e.isActive("subscrito"),
            cor: (e.getAttributes("textStyle").color as string | undefined) ?? "",
            realce: (e.getAttributes("textStyle").backgroundColor as string | undefined) ?? "",
            temLink: e.isActive("link"),
            esquerda: e.isActive({ textAlign: "left" }),
            centro: e.isActive({ textAlign: "center" }),
            direita: e.isActive({ textAlign: "right" }),
            justificado: e.isActive({ textAlign: "justify" }),
            lista: e.isActive("bulletList"),
            listaNumerada: e.isActive("orderedList"),
            citacao: e.isActive("blockquote"),
            h1: e.isActive("heading", { level: 1 }),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            fonte: (e.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
            tamanho: (e.getAttributes("textStyle").fontSize as string | undefined) ?? "",
            podeDesfazer: e.can().undo(),
            podeRefazer: e.can().redo(),
            naTabela: e.isActive("table"),
        }),
    });

    const estiloBloco = estado.h1 ? "h1" : estado.h2 ? "h2" : estado.h3 ? "h3" : "p";
    const classeSelect =
        "h-[26px] shrink-0 border border-ink/20 bg-card px-1 text-[11px] font-medium text-ink focus:border-ink focus:outline-none";

    return (
        <div>
            <div
                role="toolbar"
                aria-label="Formatação do texto"
                className="flex flex-wrap items-center gap-0.5 border-b border-ink/15 bg-card px-1.5 py-1"
            >
                <BotaoFerramenta
                    rotulo="Desfazer (Ctrl+Z)"
                    desabilitado={!estado.podeDesfazer}
                    onClick={() => editor.chain().focus().undo().run()}
                >
                    <Undo2 className="size-3.5" />
                </BotaoFerramenta>
                <BotaoFerramenta
                    rotulo="Refazer (Ctrl+Y)"
                    desabilitado={!estado.podeRefazer}
                    onClick={() => editor.chain().focus().redo().run()}
                >
                    <Redo2 className="size-3.5" />
                </BotaoFerramenta>
                <Separador />
                <select
                    aria-label="Estilo do parágrafo"
                    value={estiloBloco}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (v === "p") editor.chain().focus().setParagraph().run();
                        else editor.chain().focus().setHeading({ level: v === "h1" ? 1 : v === "h2" ? 2 : 3 }).run();
                    }}
                    className={cn(classeSelect, "w-[74px]")}
                >
                    <option value="p">Normal</option>
                    <option value="h1">Título 1</option>
                    <option value="h2">Título 2</option>
                    <option value="h3">Título 3</option>
                </select>
                <MenuFonteEditor editor={editor} fonteAtual={estado.fonte} />
                <select
                    aria-label="Tamanho da letra"
                    value={estado.tamanho}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (v) editor.chain().focus().setFontSize(v).run();
                        else editor.chain().focus().unsetFontSize().run();
                    }}
                    className={cn(classeSelect, "ml-0.5 w-[42px]")}
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
                    <Bold className="size-3.5" />
                </BotaoFerramenta>
                <BotaoFerramenta
                    rotulo="Itálico (Ctrl+I)"
                    ativo={estado.italico}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                    <Italic className="size-3.5" />
                </BotaoFerramenta>
                <BotaoFerramenta
                    rotulo="Sublinhado (Ctrl+U)"
                    ativo={estado.sublinhado}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                    <IconeSublinhado className="size-3.5" />
                </BotaoFerramenta>
                <MenuCorTexto editor={editor} corAtual={estado.cor} realceAtual={estado.realce} />
                <MenuFormatoExtra
                    editor={editor}
                    tachado={estado.tachado}
                    sobrescrito={estado.sobrescrito}
                    subscrito={estado.subscrito}
                />
                <Separador />
                <BotaoFerramenta
                    rotulo="Alinhar à esquerda"
                    ativo={estado.esquerda}
                    onClick={() => editor.chain().focus().setTextAlign("left").run()}
                >
                    <AlignLeft className="size-3.5" />
                </BotaoFerramenta>
                <BotaoFerramenta
                    rotulo="Centralizar"
                    ativo={estado.centro}
                    onClick={() => editor.chain().focus().setTextAlign("center").run()}
                >
                    <AlignCenter className="size-3.5" />
                </BotaoFerramenta>
                <BotaoFerramenta
                    rotulo="Alinhar à direita"
                    ativo={estado.direita}
                    onClick={() => editor.chain().focus().setTextAlign("right").run()}
                >
                    <AlignRight className="size-3.5" />
                </BotaoFerramenta>
                <BotaoFerramenta
                    rotulo="Justificar"
                    ativo={estado.justificado}
                    onClick={() => editor.chain().focus().setTextAlign("justify").run()}
                >
                    <AlignJustify className="size-3.5" />
                </BotaoFerramenta>
                <BotaoFerramenta
                    rotulo="Diminuir recuo lateral (Shift+Tab)"
                    onClick={() => ajustarRecuoLateral(editor, -PASSO_RECUO_CM)}
                >
                    <IndentDecrease className="size-3.5" />
                </BotaoFerramenta>
                <BotaoFerramenta
                    rotulo="Aumentar recuo lateral (Tab)"
                    onClick={() => ajustarRecuoLateral(editor, PASSO_RECUO_CM)}
                >
                    <IndentIncrease className="size-3.5" />
                </BotaoFerramenta>
                <MenuRecuoEspacamento editor={editor} />
                <Separador />
                <BotaoFerramenta
                    rotulo="Lista com marcadores"
                    ativo={estado.lista}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                    <List className="size-3.5" />
                </BotaoFerramenta>
                <BotaoFerramenta
                    rotulo="Lista numerada"
                    ativo={estado.listaNumerada}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    <ListOrdered className="size-3.5" />
                </BotaoFerramenta>
                <BotaoFerramenta
                    rotulo="Citação recuada (4 cm)"
                    ativo={estado.citacao}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                >
                    <Quote className="size-3.5" />
                </BotaoFerramenta>
                <BotaoFerramenta
                    rotulo={estado.naTabela ? "Remover tabela" : "Inserir tabela 3×3"}
                    ativo={estado.naTabela}
                    onClick={() =>
                        estado.naTabela
                            ? editor.chain().focus().deleteTable().run()
                            : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run()
                    }
                >
                    <IconeTabela className="size-3.5" />
                </BotaoFerramenta>
                <MenuInserirElemento editor={editor} temLink={estado.temLink} />
                <BotaoFerramenta
                    rotulo="Localizar e substituir (Ctrl+H)"
                    ativo={buscaAberta}
                    onClick={onAlternarBusca}
                >
                    <Search className="size-3.5" />
                </BotaoFerramenta>
                <BotaoFerramenta
                    rotulo={reguaVisivel ? "Ocultar régua" : "Mostrar régua"}
                    ativo={reguaVisivel}
                    onClick={onAlternarRegua}
                >
                    <Ruler className="size-3.5" />
                </BotaoFerramenta>
                <Separador />
                <MenuPagina pagina={pagina} onChange={onPaginaChange} />
                <button
                    type="button"
                    aria-pressed={pagina.timbrado}
                    title={pagina.timbrado ? "Remover papel timbrado desta folha" : "Aplicar papel timbrado do escritório"}
                    onClick={() => onPaginaChange({ ...pagina, timbrado: !pagina.timbrado })}
                    className={cn(
                        "ml-0.5 inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap border px-1.5 text-[11px] font-semibold transition-colors",
                        pagina.timbrado
                            ? "border-gold-deep/50 bg-gold-light/25 text-ink hover:bg-gold-light/40"
                            : "border-ink/20 bg-card text-ink/70 hover:bg-ink/5 hover:text-ink",
                    )}
                >
                    <Stamp aria-hidden className="size-3 text-gold-deep" />
                    Timbrado
                </button>
                <button
                    type="button"
                    title="Inserir bloco de assinatura do advogado (rubrica, Nome, OAB e espaço ICP-Brasil)"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().insertContent({ type: "blocoAssinatura" }).run()}
                    className="ml-0.5 inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap border border-ink/20 bg-card px-1.5 text-[11px] font-semibold text-ink/80 transition-colors hover:bg-ink/5 hover:text-ink"
                >
                    <PenTool aria-hidden className="size-3 text-gold-deep" />
                    Assinatura
                </button>
                <div className="ml-auto pl-1">
                    <MenuInserirCampo editor={editor} />
                </div>
            </div>
            {estado.naTabela && <BarraTabelaContextual editor={editor} />}
            {buscaAberta && <BarraLocalizarSubstituir editor={editor} onFechar={onAlternarBusca} />}
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
    onAbrirAssinatura?: () => void;
}

const ESPACO_ROTULO_FINAL = 28;

export function EditorDocumento({
    conteudoInicial,
    chave,
    modo,
    pagina,
    onPaginaChange,
    onChange,
    onAbrirAssinatura,
}: EditorDocumentoProps) {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onAbrirAssinaturaRef = useRef(onAbrirAssinatura);
    onAbrirAssinaturaRef.current = onAbrirAssinatura;
    const areaRef = useRef<HTMLDivElement>(null);
    const [paginas, setPaginas] = useState(1);
    const [escala, setEscala] = useState(1);
    const [buscaAberta, setBuscaAberta] = useState(false);
    // Régua estilo Word: aparece por padrão; a escolha fica salva neste navegador.
    const [reguaVisivel, setReguaVisivel] = useState(() => {
        try {
            return window.localStorage.getItem("ig_editor_regua") !== "0";
        } catch {
            return true;
        }
    });
    const alternarRegua = () =>
        setReguaVisivel((v) => {
            try {
                window.localStorage.setItem("ig_editor_regua", v ? "0" : "1");
            } catch {
                /* só nesta sessão */
            }
            return !v;
        });
    const [estatisticas, setEstatisticas] = useState({ palavras: 0, caracteres: 0 });
    const configEscritorio = useConfigEscritorio();
    const timbradoImagemUrl = configEscritorio.timbradoImagemUrl || "";
    const dadosTimbrado = useMemo(() => dadosTimbradoEscritorio(configEscritorio), [configEscritorio]);

    const geometria = useMemo(
        () => geometriaDaPagina(pagina, 32, Boolean(timbradoImagemUrl)),
        [pagina, timbradoImagemUrl],
    );

    useEffect(() => {
        garantirFontesEditorCarregadas();
    }, []);

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
            Color,
            BackgroundColor,
            FontFamily,
            FontSize,
            Sobrescrito,
            Subscrito,
            EspacamentoParagrafo,
            TextAlign.configure({ types: ["heading", "paragraph", "blockquote"] }),
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            QuebraPagina,
            BlocoAssinatura,
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
            onUpdate: ({ editor: e }) => {
                onChangeRef.current(e.getHTML());
                const texto = e.getText().trim();
                setEstatisticas({
                    palavras: texto ? texto.split(/\s+/).length : 0,
                    caracteres: texto.length,
                });
            },
        },
        [chave, extensoes],
    );

    // Sincroniza callback de abertura do modal de assinatura sem recriar as extensões.
    useEffect(() => {
        if (!editor || editor.isDestroyed) return;
        const st = (editor.storage as unknown as { blocoAssinatura?: { onAssinar: (() => void) | null } }).blocoAssinatura;
        if (st) {
            st.onAssinar = onAbrirAssinatura ? () => onAbrirAssinaturaRef.current?.() : null;
        }
    }, [editor, onAbrirAssinatura]);

    // Atualiza contagem inicial e atalho Ctrl+H para Localizar e Substituir.
    useEffect(() => {
        if (!editor || editor.isDestroyed) return;
        const texto = editor.getText().trim();
        setEstatisticas({
            palavras: texto ? texto.split(/\s+/).length : 0,
            caracteres: texto.length,
        });
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
                e.preventDefault();
                setBuscaAberta((v) => !v);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [editor]);

    // Papel/margens mudaram (ou o editor foi recriado): mede de novo as folhas.
    useEffect(() => {
        if (!editor || editor.isDestroyed) return;
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
                <BarraFerramentas
                    editor={editor}
                    pagina={pagina}
                    onPaginaChange={onPaginaChange}
                    buscaAberta={buscaAberta}
                    onAlternarBusca={() => setBuscaAberta((v) => !v)}
                    reguaVisivel={reguaVisivel}
                    onAlternarRegua={alternarRegua}
                />
                {reguaVisivel && (
                    <ReguaHorizontal editor={editor} pagina={pagina} escala={escala} onPaginaChange={onPaginaChange} />
                )}
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
                        {reguaVisivel && (
                            <ReguaVertical
                                pagina={pagina}
                                geometria={geometria}
                                paginas={paginas}
                                escala={escala}
                                temImagemPersonalizada={Boolean(timbradoImagemUrl)}
                                onPaginaChange={onPaginaChange}
                            />
                        )}
                        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0">
                            {Array.from({ length: paginas }, (_, i) => (
                                <div key={i}>
                                    <div className="pagina-fundo" style={{ top: i * passo, height: geometria.altura }}>
                                        {pagina.timbrado &&
                                            (timbradoImagemUrl ? (
                                                <img
                                                    src={timbradoImagemUrl}
                                                    alt=""
                                                    className="absolute inset-0 size-full object-fill"
                                                />
                                            ) : (
                                                <>
                                                    <div
                                                        className="absolute flex items-center justify-between gap-3 border-b-2 border-[#061237] pb-2"
                                                        style={{
                                                            top: 0.65 * PX_POR_CM,
                                                            left: geometria.margemEsquerda,
                                                            right: geometria.margemDireita,
                                                            boxShadow: "0 3px 0 0 #ffffff, 0 4px 0 0 #b6a182",
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <img
                                                                src={logoTimbrado}
                                                                alt=""
                                                                className="size-9 shrink-0 object-cover"
                                                            />
                                                            <div className="font-sans leading-none">
                                                                <div className="text-[14px] font-bold tracking-[0.14em] text-[#061237]">
                                                                    {dadosTimbrado.tituloEscritorio}
                                                                </div>
                                                                <div className="mt-1 text-[9px] font-semibold tracking-[0.34em] text-[#8b6d3b]">
                                                                    {dadosTimbrado.subtituloEscritorio}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right font-sans leading-snug">
                                                            <div className="text-[11px] font-semibold text-[#061237]">
                                                                {dadosTimbrado.advogado}
                                                            </div>
                                                            <div className="text-[10px] font-semibold tracking-[0.08em] text-[#8b6d3b]">
                                                                {dadosTimbrado.oab}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div
                                                        className="absolute border-t border-[#b6a182] pt-1.5 text-center font-sans text-[10px] leading-[1.45] text-[#475273]"
                                                        style={{
                                                            bottom: 0.55 * PX_POR_CM,
                                                            left: geometria.margemEsquerda,
                                                            right: geometria.margemDireita,
                                                        }}
                                                    >
                                                        <div>{dadosTimbrado.endereco}</div>
                                                        <div>{dadosTimbrado.contato}</div>
                                                    </div>
                                                </>
                                            ))}
                                    </div>
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/15 bg-card px-3 py-1 text-[11px] tabular-nums text-muted-foreground">
                <span className="flex items-center gap-3">
                    <span>
                        {paginas} {paginas === 1 ? "página" : "páginas"}
                    </span>
                    <span>
                        {estatisticas.palavras.toLocaleString("pt-BR")}{" "}
                        {estatisticas.palavras === 1 ? "palavra" : "palavras"}
                    </span>
                    <span>{estatisticas.caracteres.toLocaleString("pt-BR")} caracteres</span>
                </span>
                <span className="flex items-center gap-3">
                    <span>{resumoConfigPagina(pagina)}</span>
                    <span>{pagina.timbrado ? (timbradoImagemUrl ? "Timbrado A4 próprio" : "Timbrado padrão") : "Folha limpa"}</span>
                    <span>Zoom {Math.round(escala * 100)}%</span>
                </span>
            </div>
        </div>
    );
}
