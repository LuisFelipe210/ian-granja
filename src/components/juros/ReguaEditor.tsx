/**
 * Régua do editor no estilo Word.
 * - Horizontal (fixa sob a barra): margens em cinza, numeração em cm a partir da margem e os quatro
 *   marcadores de recuo (1ª linha, deslocado, recuo esquerdo e recuo direito), arrastáveis.
 * - Vertical (ao lado de cada folha): margens superior e inferior arrastáveis.
 * Arrastar mostra o valor e uma guia pontilhada; solta encaixando a cada 0,25 cm (Alt = livre).
 * Teclado: setas movem 0,25 cm (Shift+setas = 1 cm).
 */
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import {
    FORMATOS_PAPEL,
    MARGEM_INF_TIMBRADO_CM,
    MARGEM_SUP_TIMBRADO_CM,
    PX_POR_CM,
    normalizarConfigPagina,
    type ConfigPagina,
    type GeometriaPagina,
} from "@/lib/documentos";
import {
    TABULACAO_PADRAO_CM,
    aplicarEspacamentoParagrafo,
    formatarCmCss,
    lerCmDeCss,
    lerEspacamentoAtual,
} from "@/components/juros/extensoes-word-editor";
import {
    ajustarAoPasso,
    arrastarMargem,
    arrastarMarcador,
    formatarCmRegua,
    marcasRegua,
    posicoesMarcadores,
    type MarcadorRecuo,
    type RecuosCm,
} from "@/lib/regua-editor";

const ALTURA_REGUA = 22;
const LARGURA_REGUA_V = 15;
const COR_MARGEM = "#dfe3ec";
const COR_TRACO = "rgba(6, 18, 55, 0.55)";

const ROTULOS_MARCADOR: Record<MarcadorRecuo, string> = {
    primeira: "Recuo da primeira linha",
    deslocado: "Recuo deslocado",
    esquerdo: "Recuo à esquerda",
    direito: "Recuo à direita",
};

type LadoMargem = "esquerda" | "direita" | "superior" | "inferior";
const ROTULOS_MARGEM: Record<LadoMargem, string> = {
    esquerda: "Margem esquerda",
    direita: "Margem direita",
    superior: "Margem superior",
    inferior: "Margem inferior",
};

type ArrastoRecuo = {
    tipo: "recuo";
    marcador: MarcadorRecuo;
    inicio: number;
    inicioCm: number;
    base: RecuosCm;
    atual: RecuosCm;
    valorCm: number;
};
type ArrastoMargem = { tipo: "margem"; lado: LadoMargem; inicio: number; inicioCm: number; valorCm: number };
type ArrastoTab = { tipo: "tab"; inicio: number; inicioY: number; inicioCm: number; valorCm: number; remover: boolean };
type Arrasto = ArrastoRecuo | ArrastoMargem | ArrastoTab;

function Guia({ horizontal, pos }: { horizontal?: boolean; pos: number }) {
    return (
        <div
            aria-hidden
            className="pointer-events-none fixed z-40"
            style={
                horizontal
                    ? { top: pos, left: 0, right: 0, borderTop: `1px dashed ${COR_TRACO}` }
                    : { left: pos, top: 0, bottom: 0, borderLeft: `1px dashed ${COR_TRACO}` }
            }
        />
    );
}

function Balao({ texto, x, y }: { texto: string; x: number; y: number }) {
    return (
        <div
            role="status"
            className="pointer-events-none absolute z-30 -translate-x-1/2 whitespace-nowrap bg-ink px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-paper shadow"
            style={{ left: x, top: y }}
        >
            {texto}
        </div>
    );
}

function ReguaMarcas({
    tamanhoCm,
    origemCm,
    comprimento,
    espessura,
    vertical,
}: {
    tamanhoCm: number;
    origemCm: number;
    comprimento: number;
    espessura: number;
    vertical?: boolean;
}) {
    const meio = espessura / 2;
    return (
        <svg
            aria-hidden
            className="absolute inset-0"
            width={vertical ? espessura : comprimento}
            height={vertical ? comprimento : espessura}
        >
            {marcasRegua(tamanhoCm, origemCm).map((m) => {
                const p = m.posCm * PX_POR_CM;
                if (m.rotulo)
                    return (
                        <text
                            key={m.posCm}
                            x={vertical ? meio : p}
                            y={vertical ? p + 3 : meio + 3.5}
                            textAnchor="middle"
                            fontSize={vertical ? 8 : 8.5}
                            fontFamily="Archivo Variable, Archivo, sans-serif"
                            fill="rgba(6,18,55,0.75)"
                        >
                            {m.rotulo}
                        </text>
                    );
                const t = m.tipo === "meio" ? (vertical ? 5 : 6) : vertical ? 2.5 : 3;
                return vertical ? (
                    <line key={m.posCm} y1={p} y2={p} x1={meio - t / 2} x2={meio + t / 2} stroke={COR_TRACO} strokeWidth={0.8} />
                ) : (
                    <line key={m.posCm} x1={p} x2={p} y1={meio - t / 2} y2={meio + t / 2} stroke={COR_TRACO} strokeWidth={0.8} />
                );
            })}
        </svg>
    );
}

const passoTecla = (e: ReactKeyboardEvent, mais: string, menos: string) => {
    if (e.key !== mais && e.key !== menos) return 0;
    e.preventDefault();
    return (e.key === mais ? 1 : -1) * (e.shiftKey ? 1 : 0.25);
};

/* ------------------------------------------------------- Horizontal */

/**
 * Onde o parágrafo atual realmente começa e termina dentro da área de texto (cm), sem contar os recuos
 * dele: listas (1,5 cm), citação (4 cm) e células de tabela empurram o texto sem que o parágrafo tenha
 * recuo próprio. A régua soma isso para mostrar os marcadores onde o texto está.
 */
function medirContainer(e: Editor): { esq: number; dir: number } {
    try {
        const { node } = e.view.domAtPos(e.state.selection.from);
        const base = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
        const el = base?.closest("p, h1, h2, h3") as HTMLElement | null;
        const raiz = e.view.dom as HTMLElement;
        if (!el || !raiz.contains(el)) return { esq: 0, dir: 0 };
        const escalaTela = raiz.getBoundingClientRect().width / (raiz.offsetWidth || 1) || 1;
        const cr = getComputedStyle(raiz);
        const ce = getComputedStyle(el);
        const rr = raiz.getBoundingClientRect();
        const re = el.getBoundingClientRect();
        const ini = rr.left + parseFloat(cr.paddingLeft) * escalaTela;
        const fim = rr.right - parseFloat(cr.paddingRight) * escalaTela;
        const cm = (px: number) => Math.max(0, Math.round((px / PX_POR_CM) * 100) / 100);
        return {
            esq: cm((re.left - ini) / escalaTela - parseFloat(ce.marginLeft)),
            dir: cm((fim - re.right) / escalaTela - parseFloat(ce.marginRight)),
        };
    } catch {
        return { esq: 0, dir: 0 };
    }
}

/** Distância (vertical) que tira a parada de tabulação da régua ao arrastar, como no Word. */
const DISTANCIA_REMOVER_TAB_PX = 18;

export function ReguaHorizontal({
    editor,
    pagina,
    escala,
    onPaginaChange,
}: {
    editor: Editor;
    pagina: ConfigPagina;
    escala: number;
    onPaginaChange: (c: ConfigPagina) => void;
}) {
    const recuos = useEditorState({
        editor,
        selector: ({ editor: e }) => {
            const a = lerEspacamentoAtual(e);
            const container = medirContainer(e);
            const tab = lerCmDeCss(a.tabulacao);
            return {
                temBloco: Object.keys(a).length > 0,
                esquerda: lerCmDeCss(a.recuoEsquerda),
                direita: lerCmDeCss(a.recuoDireita),
                primeira: lerCmDeCss(a.recuoPrimeiraLinha),
                baseEsq: container.esq,
                baseDir: container.dir,
                tabulacao: tab > 0 ? tab : null,
            };
        },
    });
    const reguaRef = useRef<HTMLDivElement>(null);
    const [arrasto, setArrasto] = useState<Arrasto | null>(null);
    const [guiaX, setGuiaX] = useState<number | null>(null);

    const papel = FORMATOS_PAPEL[pagina.formato];
    const larguraPx = papel.larguraCm * PX_POR_CM;
    const margemArrastada = (lado: "esquerda" | "direita") =>
        arrasto?.tipo === "margem" && arrasto.lado === lado ? arrasto.valorCm : pagina.margens[lado];
    const margemEsq = margemArrastada("esquerda");
    const margemDir = margemArrastada("direita");
    // Recuos são relativos ao contêiner (lista, citação, célula); a régua mostra a posição real.
    const larguraTextoCm =
        papel.larguraCm - pagina.margens.esquerda - pagina.margens.direita - recuos.baseEsq - recuos.baseDir;
    const base: RecuosCm = { esquerda: recuos.esquerda, direita: recuos.direita, primeira: recuos.primeira };
    const vis = arrasto?.tipo === "recuo" ? arrasto.atual : base;
    const pos = posicoesMarcadores(vis);
    const xDe = (m: MarcadorRecuo, p = pos, esq = margemEsq, dir = margemDir) =>
        (m === "direito" ? papel.larguraCm - dir - recuos.baseDir - p.direito : esq + recuos.baseEsq + p[m]) * PX_POR_CM;
    /** Tabulações contam a partir do início do parágrafo (depois do recuo esquerdo). */
    const inicioParagrafoCm = margemEsq + recuos.baseEsq + vis.esquerda;
    const fimTextoCm = papel.larguraCm - margemDir - recuos.baseDir - vis.direita;
    const tabVis = arrasto?.tipo === "tab" ? arrasto.valorCm : recuos.tabulacao;
    const intervaloTab = tabVis ?? TABULACAO_PADRAO_CM;
    const paradas: number[] = [];
    for (let k = 1; inicioParagrafoCm + k * intervaloTab < fimTextoCm - 0.01 && k < 80; k++) {
        paradas.push(inicioParagrafoCm + k * intervaloTab);
    }

    const xNaTela = (xPx: number) => {
        const r = reguaRef.current?.getBoundingClientRect();
        return r ? r.left + xPx * escala : null;
    };

    // Permite arrastar os marcadores para dentro da margem cinza até a borda do papel (recuo negativo, como no Word).
    const limitesRecuo = {
        minEsq: -(pagina.margens.esquerda + recuos.baseEsq),
        minDir: -(pagina.margens.direita + recuos.baseDir),
    };

    const gravarRecuos = (r: RecuosCm) =>
        aplicarEspacamentoParagrafo(editor, {
            recuoEsquerda: formatarCmCss(r.esquerda, true),
            recuoDireita: formatarCmCss(r.direita, true),
            recuoPrimeiraLinha: formatarCmCss(r.primeira, true),
        });

    const larguraParagrafoCm = Math.max(0.25, fimTextoCm - inicioParagrafoCm);
    const valorTab = (cm: number) => Math.min(Math.max(0.25, cm), larguraParagrafoCm);
    const gravarTab = (cm: number | null) =>
        aplicarEspacamentoParagrafo(editor, { tabulacao: cm === null ? null : `${Math.round(cm * 100) / 100}cm` });

    const valorMargem = (lado: "esquerda" | "direita", cm: number) =>
        arrastarMargem(cm, lado === "esquerda" ? pagina.margens.direita : pagina.margens.esquerda, papel.larguraCm);

    const gravarMargem = (lado: "esquerda" | "direita", cm: number) =>
        onPaginaChange(normalizarConfigPagina({ ...pagina, margens: { ...pagina.margens, [lado]: cm } }));

    const iniciar = (e: ReactPointerEvent<HTMLElement>, a: Arrasto) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setArrasto(a);
    };

    const mover = (e: ReactPointerEvent<HTMLElement>) => {
        if (!arrasto) return;
        // Recuo direito e margem direita crescem para a esquerda.
        const invertido =
            (arrasto.tipo === "recuo" && arrasto.marcador === "direito") ||
            (arrasto.tipo === "margem" && arrasto.lado === "direita");
        const deltaCm = ((e.clientX - arrasto.inicio) / escala / PX_POR_CM) * (invertido ? -1 : 1);
        const bruto = ajustarAoPasso(arrasto.inicioCm + deltaCm, e.altKey);
        if (arrasto.tipo === "recuo") {
            const atual = arrastarMarcador(arrasto.marcador, bruto, arrasto.base, larguraTextoCm, limitesRecuo);
            const p = posicoesMarcadores(atual);
            setArrasto({ ...arrasto, atual, valorCm: p[arrasto.marcador] });
            setGuiaX(xNaTela(xDe(arrasto.marcador, p, pagina.margens.esquerda, pagina.margens.direita)));
        } else if (arrasto.tipo === "tab") {
            const fora = Math.abs(e.clientY - arrasto.inicioY) > DISTANCIA_REMOVER_TAB_PX;
            const v = valorTab(bruto);
            setArrasto({ ...arrasto, valorCm: v, remover: fora });
            setGuiaX(fora ? null : xNaTela((inicioParagrafoCm + v) * PX_POR_CM));
        } else if (arrasto.lado === "esquerda" || arrasto.lado === "direita") {
            const v = valorMargem(arrasto.lado, bruto);
            setArrasto({ ...arrasto, valorCm: v });
            setGuiaX(xNaTela((arrasto.lado === "esquerda" ? v : papel.larguraCm - v) * PX_POR_CM));
        }
    };

    const encerrar = (gravar: boolean) => {
        if (arrasto && gravar) {
            if (arrasto.tipo === "recuo") {
                const { base: b, atual: a } = arrasto;
                if (a.esquerda !== b.esquerda || a.direita !== b.direita || a.primeira !== b.primeira) gravarRecuos(a);
            } else if (arrasto.tipo === "tab") {
                if (arrasto.remover) gravarTab(null);
                else if (arrasto.valorCm !== arrasto.inicioCm) gravarTab(arrasto.valorCm);
            } else if ((arrasto.lado === "esquerda" || arrasto.lado === "direita") && arrasto.valorCm !== arrasto.inicioCm) {
                gravarMargem(arrasto.lado, arrasto.valorCm);
            }
        }
        setArrasto(null);
        setGuiaX(null);
    };

    /** Clique na régua (área do texto) cria ou move a parada de tabulação do parágrafo, como no Word. */
    const clicarNaRegua = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!recuos.temBloco || e.button !== 0) return;
        const r = reguaRef.current?.getBoundingClientRect();
        if (!r) return;
        const cm = (e.clientX - r.left) / escala / PX_POR_CM - inicioParagrafoCm;
        if (cm <= 0.1 || inicioParagrafoCm + cm >= fimTextoCm) return;
        e.preventDefault();
        gravarTab(valorTab(ajustarAoPasso(cm, e.altKey)));
    };

    const marcador = (m: MarcadorRecuo, forma: "baixo" | "cima" | "caixa", top: number) => {
        const ativo = arrasto?.tipo === "recuo" && arrasto.marcador === m;
        const valor = posicoesMarcadores(base)[m];
        const valorReal = m === "direito" ? recuos.baseDir + valor : recuos.baseEsq + valor;
        return (
            <div
                key={m}
                role="slider"
                tabIndex={0}
                aria-label={ROTULOS_MARCADOR[m]}
                aria-valuemin={m === "direito" ? limitesRecuo.minDir : limitesRecuo.minEsq}
                aria-valuemax={10}
                aria-valuenow={valorReal}
                aria-valuetext={formatarCmRegua(valorReal)}
                title={`${ROTULOS_MARCADOR[m]}: ${formatarCmRegua(valorReal)}`}
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) =>
                    iniciar(e, { tipo: "recuo", marcador: m, inicio: e.clientX, inicioCm: valor, base, atual: base, valorCm: valor })
                }
                onPointerMove={mover}
                onPointerUp={() => encerrar(true)}
                onPointerCancel={() => encerrar(false)}
                onKeyDown={(e) => {
                    const passo = passoTecla(e, "ArrowRight", "ArrowLeft");
                    if (!passo) return;
                    const alvo = ajustarAoPasso(valor + (m === "direito" ? -passo : passo));
                    gravarRecuos(arrastarMarcador(m, alvo, base, larguraTextoCm, limitesRecuo));
                }}
                className="absolute z-10 -translate-x-1/2 cursor-ew-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-gold"
                style={{ left: xDe(m), top, width: 11, height: forma === "caixa" ? 6 : 7 }}
            >
                <svg viewBox={forma === "caixa" ? "0 0 11 6" : "0 0 11 7"} className="block size-full overflow-visible">
                    {forma === "baixo" && <path d="M0.5 0.5H10.5L5.5 6.5Z" fill={ativo ? "#e9dcb8" : "#fbfbfd"} stroke={COR_TRACO} />}
                    {forma === "cima" && <path d="M5.5 0.5L10.5 6.5H0.5Z" fill={ativo ? "#e9dcb8" : "#fbfbfd"} stroke={COR_TRACO} />}
                    {forma === "caixa" && (
                        <rect x="0.5" y="0.5" width="10" height="5" fill={ativo ? "#e9dcb8" : "#fbfbfd"} stroke={COR_TRACO} />
                    )}
                </svg>
            </div>
        );
    };

    const marcadorTab = () => {
        if (tabVis === null || tabVis === undefined) return null;
        const valor = recuos.tabulacao ?? tabVis;
        const removendo = arrasto?.tipo === "tab" && arrasto.remover;
        return (
            <div
                role="slider"
                tabIndex={0}
                aria-label="Parada de tabulação (Delete remove)"
                aria-valuemin={0.25}
                aria-valuemax={larguraParagrafoCm}
                aria-valuenow={valor}
                aria-valuetext={formatarCmRegua(valor)}
                title={`Parada de tabulação: ${formatarCmRegua(valor)} (arraste para fora da régua ou dê dois cliques para remover)`}
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    iniciar(e, { tipo: "tab", inicio: e.clientX, inicioY: e.clientY, inicioCm: valor, valorCm: valor, remover: false });
                }}
                onPointerMove={mover}
                onPointerUp={() => encerrar(true)}
                onPointerCancel={() => encerrar(false)}
                onDoubleClick={() => gravarTab(null)}
                onKeyDown={(e) => {
                    if (e.key === "Delete" || e.key === "Backspace") {
                        e.preventDefault();
                        gravarTab(null);
                        return;
                    }
                    const passo = passoTecla(e, "ArrowRight", "ArrowLeft");
                    if (passo) gravarTab(valorTab(ajustarAoPasso(valor + passo)));
                }}
                className={cn(
                    "absolute z-10 -translate-x-[1px] cursor-ew-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-gold",
                    removendo && "opacity-30",
                )}
                style={{ left: (inicioParagrafoCm + tabVis) * PX_POR_CM, top: ALTURA_REGUA - 9, width: 8, height: 8 }}
            >
                <svg viewBox="0 0 8 8" className="block size-full overflow-visible">
                    <path d="M1 0.5V7H7.5" fill="none" stroke="#061237" strokeWidth={1.6} />
                </svg>
            </div>
        );
    };

    const limiteMargem = (lado: "esquerda" | "direita") => {
        const valor = pagina.margens[lado];
        const xPx = (lado === "esquerda" ? margemEsq : papel.larguraCm - margemDir) * PX_POR_CM;
        return (
            <div
                role="slider"
                tabIndex={0}
                aria-label={ROTULOS_MARGEM[lado]}
                aria-valuemin={0.5}
                aria-valuemax={6}
                aria-valuenow={valor}
                aria-valuetext={formatarCmRegua(valor)}
                title={`${ROTULOS_MARGEM[lado]}: ${formatarCmRegua(valor)} (arraste)`}
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    iniciar(e, { tipo: "margem", lado, inicio: e.clientX, inicioCm: valor, valorCm: valor });
                }}
                onPointerMove={mover}
                onPointerUp={() => encerrar(true)}
                onPointerCancel={() => encerrar(false)}
                onKeyDown={(e) => {
                    const passo = passoTecla(e, "ArrowRight", "ArrowLeft");
                    if (!passo) return;
                    gravarMargem(lado, valorMargem(lado, ajustarAoPasso(valor + (lado === "direita" ? -passo : passo))));
                }}
                className="absolute top-0 z-[5] h-full -translate-x-1/2 cursor-col-resize touch-none outline-none hover:bg-ink/15 focus-visible:ring-2 focus-visible:ring-gold"
                style={{ left: xPx, width: 8 }}
            />
        );
    };

    const balao = !arrasto
        ? null
        : arrasto.tipo === "recuo"
          ? {
                texto: `${ROTULOS_MARCADOR[arrasto.marcador]}: ${formatarCmRegua(
                    (arrasto.marcador === "direito" ? recuos.baseDir : recuos.baseEsq) + arrasto.valorCm,
                )}`,
                x: xDe(arrasto.marcador),
            }
          : arrasto.tipo === "tab"
            ? {
                  texto: arrasto.remover ? "Solte para remover a tabulação" : `Tabulação: ${formatarCmRegua(arrasto.valorCm)}`,
                  x: (inicioParagrafoCm + arrasto.valorCm) * PX_POR_CM,
              }
            : {
                  texto: `${ROTULOS_MARGEM[arrasto.lado]}: ${formatarCmRegua(arrasto.valorCm)}`,
                  x: (arrasto.lado === "esquerda" ? margemEsq : papel.larguraCm - margemDir) * PX_POR_CM,
              };

    return (
        <div role="group" aria-label="Régua horizontal" className="hidden border-b border-ink/15 bg-secondary/70 px-2 py-1 sm:block sm:px-6">
            <div className="relative mx-auto" style={{ width: larguraPx * escala, height: ALTURA_REGUA * escala }}>
                <div
                    ref={reguaRef}
                    className="absolute left-0 top-0 origin-top-left select-none"
                    style={{ width: larguraPx, height: ALTURA_REGUA, transform: `scale(${escala})` }}
                >
                    <div className="absolute inset-0 border border-ink/20 bg-white" />
                    <div className="absolute inset-y-0 left-0" style={{ width: margemEsq * PX_POR_CM, background: COR_MARGEM }} />
                    <div className="absolute inset-y-0 right-0" style={{ width: margemDir * PX_POR_CM, background: COR_MARGEM }} />
                    {/* Recuo herdado da lista, citação ou célula, em cinza claro. */}
                    {recuos.temBloco && recuos.baseEsq > 0.05 && (
                        <div
                            aria-hidden
                            className="absolute inset-y-[3px]"
                            style={{ left: margemEsq * PX_POR_CM, width: recuos.baseEsq * PX_POR_CM, background: "rgba(223,227,236,0.55)" }}
                        />
                    )}
                    <ReguaMarcas tamanhoCm={papel.larguraCm} origemCm={margemEsq} comprimento={larguraPx} espessura={ALTURA_REGUA} />
                    {/* Clique na área do texto cria a parada de tabulação. */}
                    <div
                        aria-hidden
                        title="Clique para criar uma parada de tabulação"
                        onMouseDown={(e) => e.preventDefault()}
                        onPointerDown={clicarNaRegua}
                        className="absolute inset-y-0 cursor-crosshair"
                        style={{ left: margemEsq * PX_POR_CM, width: Math.max(0, (papel.larguraCm - margemEsq - margemDir) * PX_POR_CM) }}
                    />
                    {recuos.temBloco && (
                        <svg aria-hidden className="pointer-events-none absolute inset-0" width={larguraPx} height={ALTURA_REGUA}>
                            {paradas.map((cm) => (
                                <line
                                    key={cm}
                                    x1={cm * PX_POR_CM}
                                    x2={cm * PX_POR_CM}
                                    y1={ALTURA_REGUA - 3}
                                    y2={ALTURA_REGUA}
                                    stroke="rgba(6,18,55,0.35)"
                                    strokeWidth={1}
                                />
                            ))}
                        </svg>
                    )}
                    {limiteMargem("esquerda")}
                    {limiteMargem("direita")}
                    {recuos.temBloco && (
                        <>
                            {marcador("primeira", "baixo", 0)}
                            {marcador("deslocado", "cima", 9)}
                            {marcador("esquerdo", "caixa", 16)}
                            {marcador("direito", "cima", 9)}
                            {marcadorTab()}
                        </>
                    )}
                    {balao && <Balao texto={balao.texto} x={balao.x} y={ALTURA_REGUA + 3} />}
                </div>
            </div>
            {guiaX !== null && <Guia pos={guiaX} />}
        </div>
    );
}

/* ------------------------------------------------------- Vertical */

export function ReguaVertical({
    pagina,
    geometria,
    paginas,
    escala,
    temImagemPersonalizada,
    onPaginaChange,
}: {
    pagina: ConfigPagina;
    geometria: GeometriaPagina;
    paginas: number;
    escala: number;
    temImagemPersonalizada: boolean;
    onPaginaChange: (c: ConfigPagina) => void;
}) {
    const [arrasto, setArrasto] = useState<(ArrastoMargem & { pagina: number }) | null>(null);
    const [guiaY, setGuiaY] = useState<number | null>(null);
    const reguasRef = useRef<Array<HTMLDivElement | null>>([]);

    const papel = FORMATOS_PAPEL[pagina.formato];
    const passo = geometria.altura + geometria.intervalo;
    // Com o timbrado padrão, o texto respeita um espaço mínimo no topo e na base (margensEfetivas).
    const minTimbrado = (lado: "superior" | "inferior") =>
        pagina.timbrado && !temImagemPersonalizada ? (lado === "superior" ? MARGEM_SUP_TIMBRADO_CM : MARGEM_INF_TIMBRADO_CM) : 0;
    const efetiva = (lado: "superior" | "inferior") => Math.max(pagina.margens[lado], minTimbrado(lado));
    const vis = (lado: "superior" | "inferior") =>
        arrasto?.lado === lado ? arrasto.valorCm : efetiva(lado);
    const supCm = vis("superior");
    const infCm = vis("inferior");
    const yDe = (lado: "superior" | "inferior", cm: number) => (lado === "superior" ? cm : papel.alturaCm - cm) * PX_POR_CM;

    const valorMargem = (lado: "superior" | "inferior", cm: number) =>
        Math.max(
            minTimbrado(lado),
            arrastarMargem(cm, lado === "superior" ? pagina.margens.inferior : pagina.margens.superior, papel.alturaCm),
        );

    const gravar = (lado: "superior" | "inferior", cm: number) =>
        onPaginaChange(normalizarConfigPagina({ ...pagina, margens: { ...pagina.margens, [lado]: cm } }));

    const encerrar = (gravarValor: boolean) => {
        if (gravarValor && arrasto && arrasto.valorCm !== arrasto.inicioCm) {
            gravar(arrasto.lado as "superior" | "inferior", arrasto.valorCm);
        }
        setArrasto(null);
        setGuiaY(null);
    };

    const limite = (i: number, lado: "superior" | "inferior") => {
        const valor = efetiva(lado);
        const min = minTimbrado(lado);
        return (
            <div
                role="slider"
                tabIndex={0}
                aria-orientation="vertical"
                aria-label={`${ROTULOS_MARGEM[lado]}${min ? ` (mínimo de ${formatarCmRegua(min)} com o timbrado)` : ""}`}
                aria-valuemin={Math.max(0.5, min)}
                aria-valuemax={6}
                aria-valuenow={valor}
                aria-valuetext={formatarCmRegua(valor)}
                title={`${ROTULOS_MARGEM[lado]}: ${formatarCmRegua(valor)} (arraste)`}
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setArrasto({ tipo: "margem", lado, inicio: e.clientY, inicioCm: valor, valorCm: valor, pagina: i });
                }}
                onPointerMove={(e) => {
                    if (!arrasto) return;
                    const l = arrasto.lado as "superior" | "inferior";
                    const delta = ((e.clientY - arrasto.inicio) / escala / PX_POR_CM) * (l === "inferior" ? -1 : 1);
                    const v = valorMargem(l, ajustarAoPasso(arrasto.inicioCm + delta, e.altKey));
                    setArrasto({ ...arrasto, valorCm: v });
                    const r = reguasRef.current[arrasto.pagina]?.getBoundingClientRect();
                    setGuiaY(r ? r.top + yDe(l, v) * escala : null);
                }}
                onPointerUp={() => encerrar(true)}
                onPointerCancel={() => encerrar(false)}
                onKeyDown={(e) => {
                    const passoCm = passoTecla(e, "ArrowDown", "ArrowUp");
                    if (!passoCm) return;
                    gravar(lado, valorMargem(lado, ajustarAoPasso(valor + (lado === "inferior" ? -passoCm : passoCm))));
                }}
                className="absolute left-0 z-[5] w-full -translate-y-1/2 cursor-row-resize touch-none outline-none hover:bg-ink/15 focus-visible:ring-2 focus-visible:ring-gold"
                style={{ top: yDe(lado, lado === "superior" ? supCm : infCm), height: 8 }}
            />
        );
    };

    return (
        <>
            {Array.from({ length: paginas }, (_, i) => (
                <div
                    key={i}
                    ref={(el) => {
                        reguasRef.current[i] = el;
                    }}
                    role="group"
                    aria-label={`Régua vertical da página ${i + 1}`}
                    className="absolute hidden select-none sm:block"
                    style={{ top: i * passo, left: -(LARGURA_REGUA_V + 5), width: LARGURA_REGUA_V, height: geometria.altura }}
                >
                    <div className="absolute inset-0 border border-ink/20 bg-white" />
                    <div className="absolute inset-x-0 top-0" style={{ height: supCm * PX_POR_CM, background: COR_MARGEM }} />
                    <div className="absolute inset-x-0 bottom-0" style={{ height: infCm * PX_POR_CM, background: COR_MARGEM }} />
                    <ReguaMarcas
                        vertical
                        tamanhoCm={papel.alturaCm}
                        origemCm={supCm}
                        comprimento={geometria.altura}
                        espessura={LARGURA_REGUA_V}
                    />
                    {limite(i, "superior")}
                    {limite(i, "inferior")}
                    {arrasto && arrasto.pagina === i && (
                        <Balao
                            texto={`${ROTULOS_MARGEM[arrasto.lado]}: ${formatarCmRegua(arrasto.valorCm)}`}
                            x={LARGURA_REGUA_V + 62}
                            y={yDe(arrasto.lado as "superior" | "inferior", arrasto.valorCm) - 9}
                        />
                    )}
                </div>
            ))}
            {guiaY !== null && <Guia horizontal pos={guiaY} />}
        </>
    );
}
