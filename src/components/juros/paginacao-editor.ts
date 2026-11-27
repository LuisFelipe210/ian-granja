/**
 * Paginação visual do editor de documentos (folhas separadas, como no Word).
 *
 * O texto continua sendo um documento só; o que muda é o desenho: depois de cada alteração,
 * mede onde cada linha cairia e, quando uma linha passa da margem inferior da folha, coloca um
 * "salto" (decoração invisível do ProseMirror) que empurra o resto para o topo da folha seguinte.
 * - Parágrafo comum é dividido por linha (igual ao Word).
 * - Título, tabela e linha horizontal vão inteiros para a próxima folha.
 * - Quebra de página manual (Ctrl+Enter) força a folha seguinte.
 * Os saltos não fazem parte do conteúdo: não vão para o banco, para o Word nem para o PDF.
 */
import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { GeometriaPagina } from "@/lib/documentos";

/* ------------------------------------------------------- Quebra de página manual */

export const QuebraPagina = Node.create({
    name: "quebraPagina",
    group: "block",
    atom: true,
    selectable: true,
    draggable: false,
    parseHTML() {
        return [
            { tag: "div[data-quebra-pagina]" },
            // Quebra vinda do Word ao colar.
            {
                tag: "br",
                getAttrs: (el) =>
                    /page-break-before:\s*always/i.test((el as HTMLElement).getAttribute("style") ?? "") ? null : false,
            },
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return ["div", mergeAttributes(HTMLAttributes, { "data-quebra-pagina": "", class: "quebra-pagina" })];
    },
    addKeyboardShortcuts() {
        return {
            "Mod-Enter": () => this.editor.chain().insertContent({ type: this.name }).run(),
        };
    },
});

/* ------------------------------------------------------- Paginação */

interface Salto {
    pos: number;
    altura: number;
    /** "bloco": div antes do parágrafo/título/tabela; "linha": dentro do parágrafo, no começo da linha. */
    tipo: "bloco" | "linha";
}

export interface PaginacaoStorage {
    geometria: GeometriaPagina | null;
    paginas: number;
    aoMudarPaginas: ((n: number) => void) | null;
    recalcular: () => void;
}

interface EstadoPaginacao {
    saltos: Salto[];
    decos: DecorationSet;
}

const chavePaginacao = new PluginKey<EstadoPaginacao>("paginacao");

function criarDecoracoes(doc: PmNode, saltos: Salto[]): DecorationSet {
    return DecorationSet.create(
        doc,
        saltos.map((s) =>
            Decoration.widget(
                s.pos,
                () => {
                    const el = document.createElement(s.tipo === "linha" ? "span" : "div");
                    el.className = `salto-pagina salto-pagina--${s.tipo}`;
                    el.style.height = `${s.altura}px`;
                    el.contentEditable = "false";
                    el.setAttribute("aria-hidden", "true");
                    return el;
                },
                { side: -1, ignoreSelection: true, key: `salto-${s.tipo}-${s.altura.toFixed(1)}` },
            ),
        ),
    );
}

type Unidade =
    | { tipo: "linhas"; pos: number; no: PmNode; el: HTMLElement }
    | { tipo: "bloco"; pos: number; no: PmNode; el: HTMLElement }
    | { tipo: "quebra"; pos: number; no: PmNode; el: HTMLElement };

/**
 * Onde pôr o salto antes de um bloco: se ele é o primeiro filho de um item de lista/citação,
 * o salto vai antes do item (senão o marcador da lista ficaria na folha de cima).
 */
function posicaoSaltoBloco(doc: PmNode, pos: number): number {
    const $pos = doc.resolve(pos);
    let alvo = pos;
    for (let d = $pos.depth; d > 0; d--) {
        if ($pos.index(d) !== 0) break;
        alvo = $pos.before(d);
    }
    return alvo;
}

interface LinhaMedida {
    topo: number;
    base: number;
    /** Coordenadas de tela (para achar a posição no texto). */
    xTela: number;
    yTela: number;
}

/** Agrupa os retângulos do texto do parágrafo em linhas (coordenadas da folha, sem zoom). */
function medirLinhas(el: HTMLElement, yDaTela: (y: number) => number): LinhaMedida[] {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects())
        .filter((r) => r.height > 0)
        .sort((a, b) => a.top - b.top || a.left - b.left);
    const linhas: Array<{ top: number; bottom: number; left: number }> = [];
    for (const r of rects) {
        const ultima = linhas[linhas.length - 1];
        const sobrepoe = ultima && r.top < ultima.bottom - Math.min(r.height, ultima.bottom - ultima.top) / 2;
        if (ultima && sobrepoe) {
            ultima.top = Math.min(ultima.top, r.top);
            ultima.bottom = Math.max(ultima.bottom, r.bottom);
            ultima.left = Math.min(ultima.left, r.left);
        } else {
            linhas.push({ top: r.top, bottom: r.bottom, left: r.left });
        }
    }
    return linhas.map((l) => ({
        topo: yDaTela(l.top),
        base: yDaTela(l.bottom),
        xTela: l.left + 1,
        yTela: (l.top + l.bottom) / 2,
    }));
}

function calcularSaltos(view: EditorView, g: GeometriaPagina): { saltos: Salto[]; paginas: number } {
    const dom = view.dom as HTMLElement;
    const r0 = dom.getBoundingClientRect();
    const escala = dom.offsetWidth > 0 ? r0.width / dom.offsetWidth : 1;
    const yDaTela = (y: number) => (y - r0.top) / (escala || 1);

    const passo = g.altura + g.intervalo;
    const fimConteudo = (pagina: number) => pagina * passo + g.altura - g.margemInferior;
    const inicioConteudo = (pagina: number) => pagina * passo + g.margemSuperior;
    const TOLERANCIA = 0.5;

    const doc = view.state.doc;
    const unidades: Unidade[] = [];
    doc.descendants((no, pos) => {
        const nome = no.type.name;
        if (nome === "quebraPagina" || nome === "table" || nome === "horizontalRule" || (no.isBlock && no.isAtom)) {
            const el = view.nodeDOM(pos);
            if (el instanceof HTMLElement) {
                unidades.push({ tipo: nome === "quebraPagina" ? "quebra" : "bloco", pos, no, el });
            }
            return false;
        }
        if (no.isTextblock) {
            const el = view.nodeDOM(pos);
            if (el instanceof HTMLElement) {
                unidades.push({ tipo: nome === "paragraph" && no.content.size > 0 ? "linhas" : "bloco", pos, no, el });
            }
            return false;
        }
        return true;
    });

    const saltos: Salto[] = [];
    let deslocamento = 0;
    let pagina = 0;
    let ultimaBase = 0;

    const saltarPara = (topoAtual: number) => {
        const novoTopo = inicioConteudo(pagina + 1);
        const altura = novoTopo - topoAtual;
        deslocamento += altura;
        pagina += 1;
        return altura;
    };

    const acertarPagina = (base: number) => {
        // Bloco maior que uma folha: segue a partir da folha onde ele termina.
        while (base > fimConteudo(pagina) + TOLERANCIA) pagina += 1;
    };

    for (const u of unidades) {
        const rect = u.el.getBoundingClientRect();
        const topoNatural = yDaTela(rect.top);
        const baseNatural = yDaTela(rect.bottom);

        if (u.tipo === "quebra") {
            const topo = topoNatural + deslocamento;
            const altura = saltarPara(topo);
            saltos.push({ pos: u.pos + u.no.nodeSize, altura, tipo: "bloco" });
            ultimaBase = inicioConteudo(pagina);
            continue;
        }

        const topo = topoNatural + deslocamento;
        const base = baseNatural + deslocamento;
        const noTopoDaFolha = topo <= inicioConteudo(pagina) + 1;

        if (base <= fimConteudo(pagina) + TOLERANCIA) {
            ultimaBase = base;
            continue;
        }

        if (u.tipo === "bloco") {
            if (!noTopoDaFolha) {
                const altura = saltarPara(topo);
                saltos.push({ pos: posicaoSaltoBloco(doc, u.pos), altura, tipo: "bloco" });
            }
            ultimaBase = baseNatural + deslocamento;
            acertarPagina(ultimaBase);
            continue;
        }

        // Parágrafo: acha a primeira linha que passa da folha e quebra ali.
        const linhas = medirLinhas(u.el, yDaTela);
        if (linhas.length === 0) {
            ultimaBase = base;
            continue;
        }
        for (let i = 0; i < linhas.length; i++) {
            // Limites da linha incluindo a entrelinha (meio do caminho entre uma linha e outra).
            const topoLinha = (i === 0 ? topoNatural : (linhas[i - 1].base + linhas[i].topo) / 2) + deslocamento;
            const baseLinha =
                (i === linhas.length - 1 ? baseNatural : (linhas[i].base + linhas[i + 1].topo) / 2) + deslocamento;
            if (baseLinha <= fimConteudo(pagina) + TOLERANCIA) continue;
            const linhaNoTopo = topoLinha <= inicioConteudo(pagina) + 1;
            if (linhaNoTopo) {
                acertarPagina(baseLinha);
                continue;
            }
            if (i === 0) {
                const altura = saltarPara(topoLinha);
                saltos.push({ pos: posicaoSaltoBloco(doc, u.pos), altura, tipo: "bloco" });
                continue;
            }
            const alvo = view.posAtCoords({ left: linhas[i].xTela, top: linhas[i].yTela });
            const inicioTexto = u.pos + 1;
            const fimTexto = u.pos + u.no.nodeSize - 1;
            if (!alvo || alvo.pos <= inicioTexto || alvo.pos >= fimTexto) {
                // Não deu para achar o começo da linha: leva o parágrafo inteiro.
                const altura = saltarPara(topoNatural + deslocamento);
                saltos.push({ pos: posicaoSaltoBloco(doc, u.pos), altura, tipo: "bloco" });
                break;
            }
            const altura = saltarPara(topoLinha);
            saltos.push({ pos: alvo.pos, altura, tipo: "linha" });
        }
        ultimaBase = baseNatural + deslocamento;
    }

    const paginas = Math.max(pagina + 1, Math.floor(Math.max(0, ultimaBase - 1) / passo) + 1);
    return { saltos, paginas };
}

function mesmosSaltos(a: Salto[], b: Salto[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((s, i) => s.pos === b[i].pos && s.tipo === b[i].tipo && Math.abs(s.altura - b[i].altura) < 0.75);
}

export const Paginacao = Extension.create<Record<string, never>, PaginacaoStorage>({
    name: "paginacao",

    addStorage() {
        return { geometria: null, paginas: 1, aoMudarPaginas: null, recalcular: () => undefined };
    },

    addProseMirrorPlugins() {
        const storage = this.storage;
        return [
            new Plugin<EstadoPaginacao>({
                key: chavePaginacao,
                state: {
                    init: (): EstadoPaginacao => ({ saltos: [], decos: DecorationSet.empty }),
                    apply(tr, valor): EstadoPaginacao {
                        const novos = tr.getMeta(chavePaginacao) as Salto[] | undefined;
                        if (novos) return { saltos: novos, decos: criarDecoracoes(tr.doc, novos) };
                        if (!tr.docChanged) return valor;
                        // Até recalcular, mantém os saltos no lugar mapeado (evita o texto "pular").
                        const saltos = valor.saltos
                            .map((s) => ({ ...s, pos: tr.mapping.map(s.pos, -1) }))
                            .filter((s) => s.pos >= 0 && s.pos <= tr.doc.content.size);
                        return { saltos, decos: valor.decos.map(tr.mapping, tr.doc) };
                    },
                },
                props: {
                    decorations(state) {
                        return chavePaginacao.getState(state)?.decos ?? DecorationSet.empty;
                    },
                },
                view(editorView) {
                    let timer: ReturnType<typeof setTimeout> | null = null;
                    let destruido = false;

                    const executar = () => {
                        timer = null;
                        if (destruido || !storage.geometria) return;
                        const dom = editorView.dom as HTMLElement;
                        if (!dom.isConnected || dom.offsetWidth === 0) return;
                        if (editorView.composing) {
                            agendar(300);
                            return;
                        }
                        // Mede o texto "corrido", sem os saltos atuais, e depois devolve os saltos.
                        const atuais = Array.from(dom.querySelectorAll<HTMLElement>(".salto-pagina"));
                        for (const el of atuais) el.style.display = "none";
                        let resultado: { saltos: Salto[]; paginas: number };
                        try {
                            resultado = calcularSaltos(editorView, storage.geometria);
                        } finally {
                            for (const el of atuais) el.style.display = "";
                        }
                        if (resultado.paginas !== storage.paginas) {
                            storage.paginas = resultado.paginas;
                            storage.aoMudarPaginas?.(resultado.paginas);
                        }
                        const atual = chavePaginacao.getState(editorView.state)?.saltos ?? [];
                        if (!mesmosSaltos(atual, resultado.saltos)) {
                            editorView.dispatch(
                                editorView.state.tr.setMeta(chavePaginacao, resultado.saltos).setMeta("addToHistory", false),
                            );
                        }
                    };

                    function agendar(ms: number) {
                        if (timer) clearTimeout(timer);
                        timer = setTimeout(executar, ms);
                    }

                    storage.recalcular = () => agendar(0);
                    agendar(0);
                    void document.fonts?.ready.then(() => {
                        if (!destruido) agendar(0);
                    });

                    return {
                        update(view, anterior) {
                            if (!view.state.doc.eq(anterior.doc)) agendar(120);
                        },
                        destroy() {
                            destruido = true;
                            if (timer) clearTimeout(timer);
                            storage.recalcular = () => undefined;
                        },
                    };
                },
            }),
        ];
    },
});
