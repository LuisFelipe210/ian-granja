/**
 * Extensões e utilitários estilo Microsoft Word para o editor de documentos jurídicos:
 * - Recuo lateral (esquerda/direita em cm), 1ª linha / deslocado (`text-indent`),
 *   entrelinha (`line-height`) e espaçamento antes/depois do parágrafo (`margin-top`/`margin-bottom`).
 * - Sobrescrito (`<sup>`) e subscrito (`<sub>`).
 * - Transformação de caixa (MAIÚSCULAS, minúsculas, Iniciais Maiúsculas, Frase).
 * - Localizar e substituir preservando formatação inline.
 */
import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/react";

const TIPOS_BLOCO_ESPACAMENTO = ["paragraph", "heading", "blockquote"] as const;

export const PASSO_RECUO_CM = 1.25;
export const MAX_RECUO_CM = 10;

export interface AtributosEspacamentoParagrafo {
    recuoEsquerda?: string | null;
    recuoDireita?: string | null;
    recuoPrimeiraLinha?: string | null;
    entrelinha?: string | null;
    espacoAntes?: string | null;
    espacoDepois?: string | null;
}

/** Converte "1,25cm" / "1.25cm" / "47.2px" para número em cm (0 se vazio/inválido). */
export function lerCmDeCss(valor?: string | null): number {
    if (!valor) return 0;
    const limpo = valor.trim().toLowerCase().replace(",", ".");
    const m = limpo.match(/^(-?\d+(?:\.\d+)?)(cm|mm|pt|px)?$/);
    if (!m) return 0;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return 0;
    const un = m[2] ?? "cm";
    if (un === "cm") return n;
    if (un === "mm") return n / 10;
    if (un === "pt") return (n * 2.54) / 72;
    if (un === "px") return (n * 2.54) / 96;
    return 0;
}

export function formatarCmCss(cm: number, permitirNegativo = false): string | null {
    if (!Number.isFinite(cm)) return null;
    const min = permitirNegativo ? -MAX_RECUO_CM : 0;
    const limitado = Math.round(Math.min(MAX_RECUO_CM, Math.max(min, cm)) * 100) / 100;
    if (Math.abs(limitado) < 0.01) return null;
    return `${limitado}cm`;
}

export const EspacamentoParagrafo = Extension.create({
    name: "espacamentoParagrafo",

    addGlobalAttributes() {
        return [
            {
                types: [...TIPOS_BLOCO_ESPACAMENTO],
                attributes: {
                    recuoEsquerda: {
                        default: null,
                        parseHTML: (el) => el.style.marginLeft || null,
                        renderHTML: (attrs) =>
                            attrs.recuoEsquerda ? { style: `margin-left: ${attrs.recuoEsquerda}` } : {},
                    },
                    recuoDireita: {
                        default: null,
                        parseHTML: (el) => el.style.marginRight || null,
                        renderHTML: (attrs) =>
                            attrs.recuoDireita ? { style: `margin-right: ${attrs.recuoDireita}` } : {},
                    },
                    recuoPrimeiraLinha: {
                        default: null,
                        parseHTML: (el) => el.style.textIndent || null,
                        renderHTML: (attrs) =>
                            attrs.recuoPrimeiraLinha ? { style: `text-indent: ${attrs.recuoPrimeiraLinha}` } : {},
                    },
                    entrelinha: {
                        default: null,
                        parseHTML: (el) => el.style.lineHeight || null,
                        renderHTML: (attrs) =>
                            attrs.entrelinha ? { style: `line-height: ${attrs.entrelinha}` } : {},
                    },
                    espacoAntes: {
                        default: null,
                        parseHTML: (el) => el.style.marginTop || null,
                        renderHTML: (attrs) =>
                            attrs.espacoAntes ? { style: `margin-top: ${attrs.espacoAntes}` } : {},
                    },
                    espacoDepois: {
                        default: null,
                        parseHTML: (el) => el.style.marginBottom || null,
                        renderHTML: (attrs) =>
                            attrs.espacoDepois ? { style: `margin-bottom: ${attrs.espacoDepois}` } : {},
                    },
                },
            },
        ];
    },

    addKeyboardShortcuts() {
        return {
            Tab: () => {
                // Dentro de listas ou tabelas, preserva a navegação/aninhamento nativos.
                if (
                    this.editor.isActive("bulletList") ||
                    this.editor.isActive("orderedList") ||
                    this.editor.isActive("table")
                ) {
                    return false;
                }
                return ajustarRecuoLateral(this.editor, PASSO_RECUO_CM);
            },
            "Shift-Tab": () => {
                if (
                    this.editor.isActive("bulletList") ||
                    this.editor.isActive("orderedList") ||
                    this.editor.isActive("table")
                ) {
                    return false;
                }
                return ajustarRecuoLateral(this.editor, -PASSO_RECUO_CM);
            },
        };
    },
});

/** Lê os atributos de espaçamento do primeiro bloco da seleção atual. */
export function lerEspacamentoAtual(editor: Editor): AtributosEspacamentoParagrafo {
    for (const tipo of TIPOS_BLOCO_ESPACAMENTO) {
        if (editor.isActive(tipo)) {
            const attrs = editor.getAttributes(tipo) as AtributosEspacamentoParagrafo;
            return {
                recuoEsquerda: attrs.recuoEsquerda ?? null,
                recuoDireita: attrs.recuoDireita ?? null,
                recuoPrimeiraLinha: attrs.recuoPrimeiraLinha ?? null,
                entrelinha: attrs.entrelinha ?? null,
                espacoAntes: attrs.espacoAntes ?? null,
                espacoDepois: attrs.espacoDepois ?? null,
            };
        }
    }
    return {};
}

/** Aplica um conjunto parcial de atributos de espaçamento a todos os blocos selecionados. */
export function aplicarEspacamentoParagrafo(editor: Editor, patch: AtributosEspacamentoParagrafo): boolean {
    const { state, view } = editor;
    const { from, to } = state.selection;
    const tr = state.tr;
    let mudou = false;

    state.doc.nodesBetween(from, to, (node, pos) => {
        if ((TIPOS_BLOCO_ESPACAMENTO as readonly string[]).includes(node.type.name)) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch });
            mudou = true;
            return false;
        }
        return true;
    });

    if (!mudou) return false;
    view.dispatch(tr);
    editor.commands.focus();
    return true;
}

/** Soma ou subtrai `deltaCm` no recuo esquerdo de todos os blocos selecionados. */
export function ajustarRecuoLateral(editor: Editor, deltaCm: number): boolean {
    const { state, view } = editor;
    const { from, to } = state.selection;
    const tr = state.tr;
    let mudou = false;

    state.doc.nodesBetween(from, to, (node, pos) => {
        if ((TIPOS_BLOCO_ESPACAMENTO as readonly string[]).includes(node.type.name)) {
            const atual = lerCmDeCss(node.attrs.recuoEsquerda as string | null);
            const proximo = formatarCmCss(atual + deltaCm, false);
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, recuoEsquerda: proximo });
            mudou = true;
            return false;
        }
        return true;
    });

    if (!mudou) return false;
    view.dispatch(tr);
    editor.commands.focus();
    return true;
}

/* ------------------------------------------------------- Sobrescrito e Subscrito */

export const Sobrescrito = Mark.create({
    name: "sobrescrito",
    excludes: "subscrito",
    parseHTML() {
        return [{ tag: "sup" }];
    },
    renderHTML({ HTMLAttributes }) {
        return ["sup", mergeAttributes(HTMLAttributes), 0];
    },
    addKeyboardShortcuts() {
        return {
            "Mod-.": () => this.editor.chain().focus().toggleMark(this.name).run(),
        };
    },
});

export const Subscrito = Mark.create({
    name: "subscrito",
    excludes: "sobrescrito",
    parseHTML() {
        return [{ tag: "sub" }];
    },
    renderHTML({ HTMLAttributes }) {
        return ["sub", mergeAttributes(HTMLAttributes), 0];
    },
    addKeyboardShortcuts() {
        return {
            "Mod-,": () => this.editor.chain().focus().toggleMark(this.name).run(),
        };
    },
});

/* ------------------------------------------------------- Transformação de caixa (Aa) */

export type ModoCaixaTexto = "maiusculas" | "minusculas" | "titulo" | "frase";

const PARTICULAS_TITULO = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos", "a", "o", "as", "os", "por", "para", "com", "sem"]);

function converterCaixa(texto: string, modo: ModoCaixaTexto): string {
    if (modo === "maiusculas") return texto.toLocaleUpperCase("pt-BR");
    if (modo === "minusculas") return texto.toLocaleLowerCase("pt-BR");
    if (modo === "frase") {
        const baixo = texto.toLocaleLowerCase("pt-BR");
        return baixo.replace(/(^\s*|[.!?]\s+)([\p{L}])/gu, (_, pref: string, letra: string) => pref + letra.toLocaleUpperCase("pt-BR"));
    }
    let idx = 0;
    return texto
        .toLocaleLowerCase("pt-BR")
        .replace(/[\p{L}\p{N}]+/gu, (palavra) => {
            const atual = idx++;
            if (atual > 0 && PARTICULAS_TITULO.has(palavra)) return palavra;
            return palavra.charAt(0).toLocaleUpperCase("pt-BR") + palavra.slice(1);
        });
}

/** Transforma a caixa do texto selecionado mantendo todas as marcas inline (negrito, fonte, cor). */
export function transformarCaixaSelecao(editor: Editor, modo: ModoCaixaTexto): boolean {
    const { state, view } = editor;
    const { from, to, empty } = state.selection;
    if (empty) return false;

    type Trecho = { de: number; ate: number; texto: string; marks: readonly import("@tiptap/pm/model").Mark[] };
    // Agrupa os trechos de texto por parágrafo: "Frase" e "Iniciais Maiúsculas" precisam enxergar o
    // parágrafo inteiro, senão cada pedaço com formatação diferente (negrito, fonte) vira "início".
    const grupos: Trecho[][] = [];
    let grupoAtual: Trecho[] | null = null;
    state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.isTextblock) {
            grupoAtual = [];
            grupos.push(grupoAtual);
            return true;
        }
        if (!node.isText || !node.text) return true;
        const inicio = Math.max(from, pos);
        const fim = Math.min(to, pos + node.text.length);
        if (inicio >= fim) return true;
        if (!grupoAtual) {
            grupoAtual = [];
            grupos.push(grupoAtual);
        }
        grupoAtual.push({ de: inicio, ate: fim, texto: node.text.slice(inicio - pos, fim - pos), marks: node.marks });
        return true;
    });

    const substituicoes: Trecho[] = [];
    for (const grupo of grupos) {
        if (grupo.length === 0) continue;
        const original = grupo.map((t) => t.texto).join("");
        const convertido = converterCaixa(original, modo);
        // Raro (ex.: "ß" → "SS"): o tamanho mudou e não dá para redistribuir; converte pedaço a pedaço.
        const mesmoTamanho = convertido.length === original.length;
        let offset = 0;
        for (const t of grupo) {
            const novo = mesmoTamanho
                ? convertido.slice(offset, offset + t.texto.length)
                : converterCaixa(t.texto, modo);
            offset += t.texto.length;
            if (novo !== t.texto) substituicoes.push({ ...t, texto: novo });
        }
    }

    if (substituicoes.length === 0) return false;
    const tr = state.tr;
    for (let i = substituicoes.length - 1; i >= 0; i--) {
        const s = substituicoes[i];
        tr.replaceWith(s.de, s.ate, state.schema.text(s.texto, s.marks));
    }
    view.dispatch(tr);
    editor.commands.focus();
    return true;
}

/* ------------------------------------------------------- Localizar e Substituir */

export interface OcorrenciaBusca {
    from: number;
    to: number;
}

export function localizarOcorrencias(
    editor: Editor,
    termo: string,
    diferenciarMaiusculas = false,
): OcorrenciaBusca[] {
    if (!termo) return [];
    const alvo = diferenciarMaiusculas ? termo : termo.toLocaleLowerCase("pt-BR");
    const achados: OcorrenciaBusca[] = [];

    editor.state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        const texto = diferenciarMaiusculas ? node.text : node.text.toLocaleLowerCase("pt-BR");
        let idx = 0;
        while (idx <= texto.length - alvo.length) {
            const achou = texto.indexOf(alvo, idx);
            if (achou === -1) break;
            achados.push({ from: pos + achou, to: pos + achou + alvo.length });
            idx = achou + Math.max(1, alvo.length);
        }
    });

    return achados;
}

export function substituirOcorrencias(
    editor: Editor,
    termo: string,
    substituto: string,
    todas: boolean,
    diferenciarMaiusculas = false,
): number {
    const lista = localizarOcorrencias(editor, termo, diferenciarMaiusculas);
    if (lista.length === 0) return 0;

    const alvos = todas ? lista : [lista[0]];
    const { state, view } = editor;
    const tr = state.tr;

    for (let i = alvos.length - 1; i >= 0; i--) {
        const oc = alvos[i];
        // Marcas do próprio trecho encontrado (negrito, link, fonte). `resolve(from).marks()` pegaria as
        // do texto anterior quando a ocorrência começa exatamente onde a formatação começa.
        const noTexto = state.doc.nodeAt(oc.from);
        const marks = noTexto?.isText ? noTexto.marks : state.doc.resolve(oc.from).marks();
        if (substituto) {
            tr.replaceWith(oc.from, oc.to, state.schema.text(substituto, marks));
        } else {
            tr.delete(oc.from, oc.to);
        }
    }

    view.dispatch(tr);
    editor.commands.focus();
    return alvos.length;
}
