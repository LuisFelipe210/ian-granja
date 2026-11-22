/**
 * Gerador vetorial puro (via `pdf-lib`) de documentos jurídicos em PDF.
 * Reproduz papel (A4/Ofício/Carta), margens, papel timbrado repetido em todas as páginas,
 * alinhamentos, recuos (inclusive negativos), itálico/negrito/sublinhado, listas, tabelas,
 * quebras de página e posicionamento exato do bloco de assinatura do advogado para ICP-Brasil.
 *
 * Roda no navegador e no Node (sem depender obrigatoriamente de DOM).
 */
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, StandardFonts, rgb } from "pdf-lib";
import {
    CONFIG_PAGINA_PADRAO,
    FORMATOS_PAPEL,
    dadosTimbradoEscritorio,
    dataPorExtenso,
    margensEfetivas,
    sanitizarHtmlDocumento,
    type ConfigPagina,
} from "./documentos.ts";
import { cidadeAssinatura, configEscritorioAtual, formatarOab, type ConfigEscritorio } from "./config-escritorio.ts";
import { decodificarDataUrlImagem, normalizarWinAnsi, type PosicaoAssinaturaPdf } from "./assinatura-icp.ts";

const PT_POR_CM = 72 / 2.54;
const cmParaPt = (cm: number) => cm * PT_POR_CM;

interface NoHtml {
    tag: string;
    attrs: Record<string, string>;
    style: Record<string, string>;
    text?: string;
    children: NoHtml[];
}

interface EstiloInline {
    negrito: boolean;
    italico: boolean;
    sublinhado: boolean;
    tachado: boolean;
    sobrescrito: boolean;
    subscrito: boolean;
    familia: "serif" | "sans" | "mono";
    tamanhoPt: number;
    cor: ReturnType<typeof rgb>;
    realce?: ReturnType<typeof rgb>;
}

interface PedacoInline {
    texto: string;
    estilo: EstiloInline;
    largura: number;
    /** Tabulação: a largura real só é conhecida ao montar a linha (vai até a próxima parada). */
    tab?: boolean;
}

/** Paradas de tabulação de um bloco: passo (CSS tab-size) e onde cada linha começa em relação à origem. */
interface ParadasTab {
    passoPt: number;
    inicioPrimeiraPt: number;
    inicioDemaisPt: number;
}

/** Parada padrão do editor/Word: a cada 1,25 cm. */
const TAB_PADRAO_PT = 1.25 * PT_POR_CM;

/** Distância até a próxima parada a partir de `posPt` (como o CSS: se ficar quase colada, pula uma). */
export function larguraAteProximaTab(posPt: number, passoPt: number): number {
    const passo = passoPt > 1 ? passoPt : TAB_PADRAO_PT;
    let prox = (Math.floor((posPt + 0.01) / passo) + 1) * passo;
    if (prox - posPt < 1.5) prox += passo;
    return prox - posPt;
}

interface LinhaQuebrada {
    pedacos: PedacoInline[];
    larguraTotal: number;
    larguraEspacos: number;
    qtdEspacos: number;
    altura: number;
    ultimaDoParagrafo: boolean;
}

export interface OpcoesGerarPdfDocumento {
    titulo: string;
    corpoHtml: string;
    pagina?: ConfigPagina;
    escritorio?: ConfigEscritorio;
    logoSrc?: string;
    timbradoImagemUrl?: string;
    assinaturaImagemUrl?: string;
    hoje?: Date;
}

function decodificarEntidadesTexto(s: string): string {
    return s
        .replace(/&nbsp;/gi, " ")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&amp;/gi, "&")
        .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)));
}

function parseStyleString(raw: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const parte of raw.split(";")) {
        const idx = parte.indexOf(":");
        if (idx <= 0) continue;
        const prop = parte.slice(0, idx).trim().toLowerCase();
        const val = parte.slice(idx + 1).trim();
        if (prop && val) out[prop] = val;
    }
    return out;
}

function parseHtmlParaNos(html: string): NoHtml[] {
    const g = globalThis as unknown as {
        DOMParser?: new () => { parseFromString(s: string, m: string): { body: Element } };
    };
    if (typeof g.DOMParser === "function") {
        const doc = new g.DOMParser().parseFromString(html, "text/html");
        const converter = (node: Node): NoHtml | null => {
            if (node.nodeType === 3) {
                return { tag: "#text", attrs: {}, style: {}, text: node.textContent ?? "", children: [] };
            }
            if (node.nodeType !== 1) return null;
            const el = node as Element;
            const attrs: Record<string, string> = {};
            for (const a of Array.from(el.attributes)) attrs[a.name.toLowerCase()] = a.value;
            const children: NoHtml[] = [];
            for (const f of Array.from(el.childNodes)) {
                const c = converter(f);
                if (c) children.push(c);
            }
            return {
                tag: el.tagName.toLowerCase(),
                attrs,
                style: parseStyleString(attrs.style ?? ""),
                children,
            };
        };
        const out: NoHtml[] = [];
        for (const f of Array.from(doc.body.childNodes)) {
            const c = converter(f);
            if (c) out.push(c);
        }
        return out;
    }

    // Fallback leve para ambientes Node (testes unitários sem DOM).
    const VOID_TAGS = new Set(["br", "hr", "img", "col", "meta", "link"]);
    const raiz: NoHtml = { tag: "root", attrs: {}, style: {}, children: [] };
    const pilha: NoHtml[] = [raiz];
    const tokenRe = /<(\/?)([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(html)) !== null) {
        if (m[4] !== undefined) {
            pilha[pilha.length - 1].children.push({
                tag: "#text",
                attrs: {},
                style: {},
                text: decodificarEntidadesTexto(m[4]),
                children: [],
            });
            continue;
        }
        const barra = m[1];
        const tag = m[2].toLowerCase();
        const attrsRaw = m[3];
        if (barra) {
            for (let i = pilha.length - 1; i > 0; i--) {
                if (pilha[i].tag === tag) {
                    pilha.length = i;
                    break;
                }
            }
            continue;
        }
        const attrs: Record<string, string> = {};
        const attrRe = /([a-zA-Z0-9:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
        let am: RegExpExecArray | null;
        while ((am = attrRe.exec(attrsRaw)) !== null) {
            attrs[am[1].toLowerCase()] = decodificarEntidadesTexto(am[2] ?? am[3] ?? am[4] ?? "");
        }
        const no: NoHtml = { tag, attrs, style: parseStyleString(attrs.style ?? ""), children: [] };
        pilha[pilha.length - 1].children.push(no);
        if (!VOID_TAGS.has(tag) && !/\/\s*$/.test(attrsRaw)) {
            pilha.push(no);
        }
    }
    return raiz.children;
}

function cssParaPt(valor?: string, padraoPt = 0, baseTamanhoPt = 12): number {
    if (!valor) return padraoPt;
    const limpo = valor.trim().toLowerCase().replace(",", ".");
    if (limpo === "0") return 0;
    const m = limpo.match(/^(-?\d+(?:\.\d+)?)(cm|mm|pt|px|em|rem)?$/);
    if (!m) return padraoPt;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return padraoPt;
    const u = m[2] ?? "pt";
    if (u === "pt") return n;
    if (u === "cm") return n * PT_POR_CM;
    if (u === "mm") return (n / 10) * PT_POR_CM;
    if (u === "px") return n * 0.75;
    if (u === "em" || u === "rem") return n * baseTamanhoPt;
    return padraoPt;
}

function corCssParaRgb(valor?: string): ReturnType<typeof rgb> | null {
    if (!valor) return null;
    const s = valor.trim().toLowerCase();
    const hex3 = s.match(/^#([0-9a-f]{3})$/);
    if (hex3) {
        const [r, g, b] = hex3[1].split("").map((ch) => parseInt(ch + ch, 16) / 255);
        return rgb(r, g, b);
    }
    const hex6 = s.match(/^#([0-9a-f]{6})$/);
    if (hex6) {
        const h = hex6[1];
        return rgb(
            parseInt(h.slice(0, 2), 16) / 255,
            parseInt(h.slice(2, 4), 16) / 255,
            parseInt(h.slice(4, 6), 16) / 255,
        );
    }
    const mRgb = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
    if (mRgb) {
        return rgb(
            Math.min(255, Number(mRgb[1])) / 255,
            Math.min(255, Number(mRgb[2])) / 255,
            Math.min(255, Number(mRgb[3])) / 255,
        );
    }
    if (s === "black") return rgb(0, 0, 0);
    if (s === "white") return rgb(1, 1, 1);
    return null;
}

function familiaDeCss(valor?: string): "serif" | "sans" | "mono" | null {
    if (!valor) return null;
    const s = valor.toLowerCase();
    if (/courier|mono/.test(s)) return "mono";
    if (/montserrat|arial|helvetica|calibri|inter|roboto|open sans|lato|poppins|source sans|raleway|nunito|archivo|verdana|tahoma|trebuchet|sans-serif/.test(s)) {
        return "sans";
    }
    if (/times|georgia|garamond|merriweather|lora|playfair|baskerville|literata|palatino|serif/.test(s)) {
        return "serif";
    }
    return null;
}

export interface ResultadoPdfDocumento {
    pdfBytes: Uint8Array;
    posicaoAssinatura: PosicaoAssinaturaPdf;
}

/**
 * Gera um PDF vetorial completo do documento, com timbrado repetido, paginação automática
 * e as coordenadas exatas do bloco de assinatura do advogado para o carimbo/AcroForm ICP-Brasil.
 */
export async function gerarPdfDocumento(opcoes: OpcoesGerarPdfDocumento): Promise<ResultadoPdfDocumento> {
    const cfg = opcoes.escritorio ?? configEscritorioAtual();
    const paginaCfg = opcoes.pagina ?? CONFIG_PAGINA_PADRAO;
    const hoje = opcoes.hoje ?? new Date();
    const papel = FORMATOS_PAPEL[paginaCfg.formato];
    const larguraPag = cmParaPt(papel.larguraCm);
    const alturaPag = cmParaPt(papel.alturaCm);

    const imgTimbradoSrc = paginaCfg.timbrado ? (opcoes.timbradoImagemUrl ?? cfg.timbradoImagemUrl ?? "") : "";
    const temTimbradoImg = Boolean(decodificarDataUrlImagem(imgTimbradoSrc));
    const mEfet = margensEfetivas(paginaCfg, temTimbradoImg);
    const marEsq = cmParaPt(mEfet.esquerda);
    const marDir = cmParaPt(mEfet.direita);
    const marSup = cmParaPt(mEfet.superior);
    const marInf = cmParaPt(mEfet.inferior);

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(normalizarWinAnsi(opcoes.titulo || "Documento"));
    pdfDoc.setAuthor(normalizarWinAnsi(cfg.nomeAdvogado));
    pdfDoc.setCreator("Ian Granja Advogados");

    const fontes = {
        serif: {
            regular: await pdfDoc.embedFont(StandardFonts.TimesRoman),
            bold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
            italic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
            boldItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
        },
        sans: {
            regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
            bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
            italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
            boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
        },
        mono: {
            regular: await pdfDoc.embedFont(StandardFonts.Courier),
            bold: await pdfDoc.embedFont(StandardFonts.CourierBold),
            italic: await pdfDoc.embedFont(StandardFonts.CourierOblique),
            boldItalic: await pdfDoc.embedFont(StandardFonts.CourierBoldOblique),
        },
    };

    const pegarFonte = (e: EstiloInline): PDFFont => {
        const fam = fontes[e.familia];
        if (e.negrito && e.italico) return fam.boldItalic;
        if (e.negrito) return fam.bold;
        if (e.italico) return fam.italic;
        return fam.regular;
    };

    let timbradoEmbed: PDFImage | null = null;
    if (temTimbradoImg) {
        const decoded = decodificarDataUrlImagem(imgTimbradoSrc);
        if (decoded) {
            timbradoEmbed =
                decoded.tipo === "png" ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
        }
    }

    let logoEmbed: PDFImage | null = null;
    if (paginaCfg.timbrado && !timbradoEmbed && opcoes.logoSrc) {
        const decodedLogo = decodificarDataUrlImagem(opcoes.logoSrc);
        if (decodedLogo) {
            try {
                logoEmbed =
                    decodedLogo.tipo === "png"
                        ? await pdfDoc.embedPng(decodedLogo.bytes)
                        : await pdfDoc.embedJpg(decodedLogo.bytes);
            } catch {
                logoEmbed = null;
            }
        }
    }

    let rubricaEmbed: PDFImage | null = null;
    const rubricaSrc = opcoes.assinaturaImagemUrl ?? cfg.assinaturaImagemUrl ?? "";
    const decodedRub = decodificarDataUrlImagem(rubricaSrc);
    if (decodedRub) {
        try {
            rubricaEmbed =
                decodedRub.tipo === "png"
                    ? await pdfDoc.embedPng(decodedRub.bytes)
                    : await pdfDoc.embedJpg(decodedRub.bytes);
        } catch {
            rubricaEmbed = null;
        }
    }

    const dadosTimb = dadosTimbradoEscritorio(cfg);
    const paginas: PDFPage[] = [];
    let pageAtual!: PDFPage;
    let cursorY = 0;

    const aplicarTimbradoNaPagina = (page: PDFPage) => {
        if (!paginaCfg.timbrado) return;
        if (timbradoEmbed) {
            page.drawImage(timbradoEmbed, { x: 0, y: 0, width: larguraPag, height: alturaPag });
            return;
        }
        const cabY = alturaPag - cmParaPt(0.65);
        const logoTam = cmParaPt(0.95);
        const logoX = marEsq;
        const logoY = cabY - logoTam;
        if (logoEmbed) {
            page.drawImage(logoEmbed, { x: logoX, y: logoY, width: logoTam, height: logoTam });
        } else {
            page.drawRectangle({ x: logoX, y: logoY, width: logoTam, height: logoTam, color: rgb(0.024, 0.071, 0.216) });
            page.drawText("G", {
                x: logoX + logoTam * 0.28,
                y: logoY + logoTam * 0.24,
                size: 15,
                font: fontes.serif.bold,
                color: rgb(0.773, 0.69, 0.557),
            });
        }
        const marcaX = logoX + logoTam + 8;
        page.drawText(normalizarWinAnsi(dadosTimb.tituloEscritorio), {
            x: marcaX,
            y: logoY + logoTam * 0.56,
            size: 11.5,
            font: fontes.sans.bold,
            color: rgb(0.024, 0.071, 0.216),
        });
        page.drawText(normalizarWinAnsi(dadosTimb.subtituloEscritorio), {
            x: marcaX,
            y: logoY + logoTam * 0.16,
            size: 7.5,
            font: fontes.sans.bold,
            color: rgb(0.545, 0.427, 0.231),
        });

        const advTxt = normalizarWinAnsi(dadosTimb.advogado);
        const oabTxt = normalizarWinAnsi(dadosTimb.oab);
        const dirBorda = larguraPag - marDir;
        page.drawText(advTxt, {
            x: dirBorda - fontes.sans.bold.widthOfTextAtSize(advTxt, 8.5),
            y: logoY + logoTam * 0.56,
            size: 8.5,
            font: fontes.sans.bold,
            color: rgb(0.024, 0.071, 0.216),
        });
        page.drawText(oabTxt, {
            x: dirBorda - fontes.sans.bold.widthOfTextAtSize(oabTxt, 7.5),
            y: logoY + logoTam * 0.16,
            size: 7.5,
            font: fontes.sans.bold,
            color: rgb(0.545, 0.427, 0.231),
        });

        const linhaCabY = logoY - 6;
        page.drawLine({
            start: { x: marEsq, y: linhaCabY },
            end: { x: dirBorda, y: linhaCabY },
            thickness: 1.5,
            color: rgb(0.024, 0.071, 0.216),
        });
        page.drawLine({
            start: { x: marEsq, y: linhaCabY - 3 },
            end: { x: dirBorda, y: linhaCabY - 3 },
            thickness: 0.9,
            color: rgb(0.714, 0.631, 0.51),
        });

        // Rodapé
        const rodY = cmParaPt(0.55);
        const endTxt = normalizarWinAnsi(dadosTimb.endereco);
        const conTxt = normalizarWinAnsi(dadosTimb.contato);
        page.drawLine({
            start: { x: marEsq, y: rodY + 22 },
            end: { x: dirBorda, y: rodY + 22 },
            thickness: 0.75,
            color: rgb(0.714, 0.631, 0.51),
        });
        page.drawText(endTxt, {
            x: Math.max(marEsq, (larguraPag - fontes.sans.regular.widthOfTextAtSize(endTxt, 7.5)) / 2),
            y: rodY + 11,
            size: 7.5,
            font: fontes.sans.regular,
            color: rgb(0.278, 0.322, 0.451),
        });
        page.drawText(conTxt, {
            x: Math.max(marEsq, (larguraPag - fontes.sans.regular.widthOfTextAtSize(conTxt, 7.5)) / 2),
            y: rodY + 1,
            size: 7.5,
            font: fontes.sans.regular,
            color: rgb(0.278, 0.322, 0.451),
        });
    };

    const novaPagina = () => {
        pageAtual = pdfDoc.addPage([larguraPag, alturaPag]);
        paginas.push(pageAtual);
        aplicarTimbradoNaPagina(pageAtual);
        cursorY = alturaPag - marSup;
    };

    const garantirEspaco = (alturaNecessaria: number) => {
        if (cursorY - alturaNecessaria < marInf) {
            novaPagina();
        }
    };

    novaPagina();

    const estiloPadrao: EstiloInline = {
        negrito: false,
        italico: false,
        sublinhado: false,
        tachado: false,
        sobrescrito: false,
        subscrito: false,
        familia: "serif",
        tamanhoPt: 12,
        cor: rgb(0, 0, 0),
    };

    const coletarPedacosInline = (no: NoHtml, herdado: EstiloInline): PedacoInline[] => {
        if (no.tag === "#text") {
            const fonte = pegarFonte(herdado);
            const tamEfet = herdado.sobrescrito || herdado.subscrito ? herdado.tamanhoPt * 0.75 : herdado.tamanhoPt;
            const out: PedacoInline[] = [];
            // Cada \t vira um pedaço próprio; a largura é resolvida na quebra de linhas (próxima parada).
            (no.text ?? "").split("\t").forEach((segmento, i) => {
                if (i > 0) out.push({ texto: "\t", estilo: herdado, largura: 0, tab: true });
                for (const t of normalizarWinAnsi(segmento).split(/(\s+)/)) {
                    if (t) out.push({ texto: t, estilo: herdado, largura: fonte.widthOfTextAtSize(t, tamEfet) });
                }
            });
            return out;
        }
        if (no.tag === "br") {
            return [{ texto: "\n", estilo: herdado, largura: 0 }];
        }
        const proximo: EstiloInline = { ...herdado };
        if (no.tag === "strong" || no.tag === "b") proximo.negrito = true;
        if (no.tag === "em" || no.tag === "i") proximo.italico = true;
        if (no.tag === "u") proximo.sublinhado = true;
        if (no.tag === "s" || no.tag === "del") proximo.tachado = true;
        if (no.tag === "sup") proximo.sobrescrito = true;
        if (no.tag === "sub") proximo.subscrito = true;
        const fam = familiaDeCss(no.style["font-family"]);
        if (fam) proximo.familia = fam;
        if (no.style["font-size"]) {
            const pt = cssParaPt(no.style["font-size"], proximo.tamanhoPt, proximo.tamanhoPt);
            if (pt >= 5 && pt <= 72) proximo.tamanhoPt = pt;
        }
        const cor = corCssParaRgb(no.style.color);
        if (cor) proximo.cor = cor;
        const realce = corCssParaRgb(no.style["background-color"]);
        if (realce) proximo.realce = realce;

        const out: PedacoInline[] = [];
        for (const f of no.children) out.push(...coletarPedacosInline(f, proximo));
        return out;
    };

    const quebrarLinhas = (
        pedacos: PedacoInline[],
        larguraPrimeira: number,
        larguraDemais: number,
        fatorEntrelinha: number,
        tamBase: number,
        paradas: ParadasTab = { passoPt: TAB_PADRAO_PT, inicioPrimeiraPt: 0, inicioDemaisPt: 0 },
    ): LinhaQuebrada[] => {
        const linhas: LinhaQuebrada[] = [];
        let atual: PedacoInline[] = [];
        let largAtual = 0;
        let maxTam = tamBase;

        const limiteAtual = () => (linhas.length === 0 ? larguraPrimeira : larguraDemais);
        const larguraTab = () =>
            larguraAteProximaTab(
                (linhas.length === 0 ? paradas.inicioPrimeiraPt : paradas.inicioDemaisPt) + largAtual,
                paradas.passoPt,
            );

        const fecharLinha = (ultima: boolean) => {
            while (atual.length > 0 && /^\s+$/.test(atual[atual.length - 1].texto)) {
                atual.pop();
            }
            let largTotal = 0;
            let largEsp = 0;
            let qtdEsp = 0;
            for (const p of atual) {
                largTotal += p.largura;
                // Tabulação não estica na justificação (só os espaços).
                if (!p.tab && /^\s+$/.test(p.texto)) {
                    largEsp += p.largura;
                    qtdEsp += 1;
                }
            }
            linhas.push({
                pedacos: atual,
                larguraTotal: largTotal,
                larguraEspacos: largEsp,
                qtdEspacos: qtdEsp,
                altura: maxTam * fatorEntrelinha,
                ultimaDoParagrafo: ultima,
            });
            atual = [];
            largAtual = 0;
            maxTam = tamBase;
        };

        for (const p of pedacos) {
            if (p.texto === "\n") {
                fecharLinha(true);
                continue;
            }
            if (p.tab) {
                // Ao contrário do espaço, a tabulação no início da linha conta (recuo com Tab).
                let largura = larguraTab();
                if (atual.length > 0 && largAtual + largura > Math.max(40, limiteAtual())) {
                    fecharLinha(false);
                    largura = larguraTab();
                }
                atual.push({ ...p, largura });
                largAtual += largura;
                continue;
            }
            const ehEspaco = /^\s+$/.test(p.texto);
            if (ehEspaco && atual.length === 0) continue;

            const lim = Math.max(40, limiteAtual());
            if (!ehEspaco && atual.length > 0 && largAtual + p.largura > lim) {
                fecharLinha(false);
            }
            atual.push(p);
            largAtual += p.largura;
            maxTam = Math.max(maxTam, p.estilo.tamanhoPt);
        }

        if (atual.length > 0 || linhas.length === 0) {
            fecharLinha(true);
        }
        return linhas;
    };

    const desenharBlocoTexto = (
        pedacos: PedacoInline[],
        opcoesBloco: {
            alinhamento: string;
            esqCm: number;
            dirCm: number;
            primCm: number;
            fatorEntrelinha: number;
            espacoAntesPt: number;
            espacoDepoisPt: number;
            tamBase: number;
            marcadorLista?: string;
            /** Parada de tabulação do parágrafo (CSS tab-size), em pt; padrão 1,25 cm. */
            tabPt?: number;
        },
    ) => {
        const esqPt = marEsq + cmParaPt(opcoesBloco.esqCm);
        const dirPt = marDir + cmParaPt(opcoesBloco.dirCm);
        const primPt = cmParaPt(opcoesBloco.primCm);
        const xBaseDemais = esqPt + (primPt < 0 ? Math.abs(primPt) : 0);
        const xBasePrimeira = primPt >= 0 ? esqPt + primPt : esqPt;
        const xDireita = larguraPag - dirPt;

        const larguraPrimeira = Math.max(40, xDireita - xBasePrimeira);
        const larguraDemais = Math.max(40, xDireita - xBaseDemais);

        // Como no CSS, as paradas contam da borda do conteúdo do parágrafo (onde ficam as linhas seguintes
        // num recuo deslocado); a 1ª linha começa deslocada pelo text-indent.
        const origemTab = primPt < 0 ? xBaseDemais : esqPt;
        const linhas = quebrarLinhas(
            pedacos,
            larguraPrimeira,
            larguraDemais,
            opcoesBloco.fatorEntrelinha,
            opcoesBloco.tamBase,
            {
                passoPt: opcoesBloco.tabPt ?? TAB_PADRAO_PT,
                inicioPrimeiraPt: xBasePrimeira - origemTab,
                inicioDemaisPt: xBaseDemais - origemTab,
            },
        );

        cursorY -= opcoesBloco.espacoAntesPt;

        for (let idx = 0; idx < linhas.length; idx++) {
            const l = linhas[idx];
            garantirEspaco(l.altura);

            const xIniBase = idx === 0 ? xBasePrimeira : xBaseDemais;
            const largArea = idx === 0 ? larguraPrimeira : larguraDemais;

            if (idx === 0 && opcoesBloco.marcadorLista) {
                pageAtual.drawText(normalizarWinAnsi(opcoesBloco.marcadorLista), {
                    x: xIniBase - 14,
                    y: cursorY - l.altura * 0.78,
                    size: opcoesBloco.tamBase,
                    font: fontes.serif.regular,
                    color: rgb(0, 0, 0),
                });
            }

            let offsetX = 0;
            let extraEspaco = 0;
            if (opcoesBloco.alinhamento === "center") {
                offsetX = Math.max(0, (largArea - l.larguraTotal) / 2);
            } else if (opcoesBloco.alinhamento === "right") {
                offsetX = Math.max(0, largArea - l.larguraTotal);
            } else if (opcoesBloco.alinhamento === "justify" && !l.ultimaDoParagrafo && l.qtdEspacos > 0) {
                const sobra = Math.max(0, largArea - l.larguraTotal);
                extraEspaco = Math.min(sobra / l.qtdEspacos, opcoesBloco.tamBase * 1.5);
            }

            let curX = xIniBase + offsetX;
            const baselineBase = cursorY - l.altura * 0.78;

            for (const p of l.pedacos) {
                const ehEspaco = /^\s+$/.test(p.texto);
                const avanco = p.largura + (ehEspaco && !p.tab ? extraEspaco : 0);
                if (!ehEspaco) {
                    const fonte = pegarFonte(p.estilo);
                    const tam =
                        p.estilo.sobrescrito || p.estilo.subscrito ? p.estilo.tamanhoPt * 0.75 : p.estilo.tamanhoPt;
                    const y = p.estilo.sobrescrito
                        ? baselineBase + p.estilo.tamanhoPt * 0.35
                        : p.estilo.subscrito
                          ? baselineBase - p.estilo.tamanhoPt * 0.18
                          : baselineBase;

                    if (p.estilo.realce) {
                        pageAtual.drawRectangle({
                            x: curX,
                            y: y - tam * 0.22,
                            width: p.largura,
                            height: tam * 1.15,
                            color: p.estilo.realce,
                        });
                    }
                    pageAtual.drawText(p.texto, { x: curX, y, size: tam, font: fonte, color: p.estilo.cor });
                    if (p.estilo.sublinhado) {
                        pageAtual.drawLine({
                            start: { x: curX, y: y - 1.5 },
                            end: { x: curX + p.largura, y: y - 1.5 },
                            thickness: 0.65,
                            color: p.estilo.cor,
                        });
                    }
                    if (p.estilo.tachado) {
                        pageAtual.drawLine({
                            start: { x: curX, y: y + tam * 0.3 },
                            end: { x: curX + p.largura, y: y + tam * 0.3 },
                            thickness: 0.65,
                            color: p.estilo.cor,
                        });
                    }
                }
                curX += avanco;
            }

            cursorY -= l.altura;
        }

        cursorY -= opcoesBloco.espacoDepoisPt;
    };

    let posicaoAssinaturaCapturada: PosicaoAssinaturaPdf | null = null;

    const desenharBlocoAssinatura = (no: NoHtml) => {
        const alin = (no.attrs["data-alinhamento"] || "center").toLowerCase();
        const mostrarData = no.attrs["data-mostrar-data"] !== "false";

        const larguraBloco = 225;
        const altRubrica = rubricaEmbed ? 46 : 22;
        const altData = mostrarData ? 22 : 0;
        const altNomeOab = 30;
        const altCaixaSelo = 62;
        // Soma exata do que o bloco consome abaixo (respiro, data, rubrica/linha, nome+OAB, selo), para o
        // carimbo nunca precisar ser espremido contra a margem inferior por cima do nome/OAB.
        const alturaTotal =
            14 + (mostrarData ? altData + 6 : 0) + altRubrica + altNomeOab + 11 + altCaixaSelo + 8;

        garantirEspaco(alturaTotal);
        cursorY -= 14;

        const areaLarg = larguraPag - marEsq - marDir;
        let blocoX = marEsq + (areaLarg - larguraBloco) / 2;
        if (alin === "left") blocoX = marEsq;
        else if (alin === "right") blocoX = larguraPag - marDir - larguraBloco;

        if (mostrarData) {
            const txtData = normalizarWinAnsi(`${cidadeAssinatura(cfg)}, ${dataPorExtenso(hoje)}.`);
            const wData = fontes.serif.regular.widthOfTextAtSize(txtData, 12);
            const dx =
                alin === "left"
                    ? marEsq
                    : alin === "right"
                      ? larguraPag - marDir - wData
                      : marEsq + (areaLarg - wData) / 2;
            pageAtual.drawText(txtData, {
                x: Math.max(marEsq, dx),
                y: cursorY - 12,
                size: 12,
                font: fontes.serif.regular,
                color: rgb(0, 0, 0),
            });
            cursorY -= altData + 6;
        }

        if (rubricaEmbed) {
            const esc = Math.min(180 / rubricaEmbed.width, 40 / rubricaEmbed.height, 1);
            const rw = rubricaEmbed.width * esc;
            const rh = rubricaEmbed.height * esc;
            pageAtual.drawImage(rubricaEmbed, {
                x: blocoX + (larguraBloco - rw) / 2,
                y: cursorY - rh - 2,
                width: rw,
                height: rh,
            });
            cursorY -= rh + 6;
        } else {
            cursorY -= 22;
        }

        pageAtual.drawLine({
            start: { x: blocoX + 8, y: cursorY },
            end: { x: blocoX + larguraBloco - 8, y: cursorY },
            thickness: 0.9,
            color: rgb(0, 0, 0),
        });
        cursorY -= 13;

        const nomeTxt = normalizarWinAnsi(cfg.nomeAdvogado);
        const wNome = fontes.serif.bold.widthOfTextAtSize(nomeTxt, 11.5);
        pageAtual.drawText(nomeTxt, {
            x: blocoX + (larguraBloco - wNome) / 2,
            y: cursorY,
            size: 11.5,
            font: fontes.serif.bold,
            color: rgb(0, 0, 0),
        });
        cursorY -= 14;

        const oabTxt = normalizarWinAnsi(formatarOab(cfg));
        const wOab = fontes.serif.regular.widthOfTextAtSize(oabTxt, 10.5);
        pageAtual.drawText(oabTxt, {
            x: blocoX + (larguraBloco - wOab) / 2,
            y: cursorY,
            size: 10.5,
            font: fontes.serif.regular,
            color: rgb(0, 0, 0),
        });
        cursorY -= 14;

        const seloY = Math.max(marInf + 6, cursorY - altCaixaSelo);
        posicaoAssinaturaCapturada = {
            paginaIndex: paginas.length - 1,
            x: blocoX,
            y: seloY,
            largura: Math.max(larguraBloco, 235),
            altura: 58,
        };
        cursorY = seloY - 8;
    };

    const desenharTabela = (noTabela: NoHtml) => {
        const linhasTr: NoHtml[] = [];
        const coletarTr = (n: NoHtml) => {
            if (n.tag === "tr") {
                linhasTr.push(n);
                return;
            }
            for (const f of n.children) coletarTr(f);
        };
        coletarTr(noTabela);
        if (linhasTr.length === 0) return;

        cursorY -= 6;
        const areaLarg = larguraPag - marEsq - marDir;

        for (const tr of linhasTr) {
            const celulas = tr.children.filter((c) => c.tag === "td" || c.tag === "th");
            if (celulas.length === 0) continue;
            const largCel = areaLarg / celulas.length;

            const colunasLinhas = celulas.map((cel) => {
                const baseCel: EstiloInline = {
                    ...estiloPadrao,
                    tamanhoPt: 10.5,
                    negrito: cel.tag === "th",
                };
                const pedacos = coletarPedacosInline(cel, baseCel);
                return quebrarLinhas(pedacos, largCel - 10, largCel - 10, 1.3, 10.5);
            });
            const alturaLinha =
                Math.max(...colunasLinhas.map((ls) => ls.reduce((acc, l) => acc + l.altura, 0)), 16) + 10;

            garantirEspaco(alturaLinha);
            const topo = cursorY;
            for (let ci = 0; ci < celulas.length; ci++) {
                const cx = marEsq + ci * largCel;
                pageAtual.drawRectangle({
                    x: cx,
                    y: topo - alturaLinha,
                    width: largCel,
                    height: alturaLinha,
                    borderColor: rgb(0, 0, 0),
                    borderWidth: 0.65,
                });
                let cy = topo - 5;
                for (const l of colunasLinhas[ci]) {
                    let tx = cx + 5;
                    const by = cy - l.altura * 0.78;
                    for (const p of l.pedacos) {
                        if (!/^\s+$/.test(p.texto)) {
                            pageAtual.drawText(p.texto, {
                                x: tx,
                                y: by,
                                size: p.estilo.tamanhoPt,
                                font: pegarFonte(p.estilo),
                                color: p.estilo.cor,
                            });
                        }
                        tx += p.largura;
                    }
                    cy -= l.altura;
                }
            }
            cursorY -= alturaLinha;
        }
        cursorY -= 8;
    };

    const processarNos = (nos: NoHtml[], contexto: { esqCmExtra: number; citacao: boolean }) => {
        for (const no of nos) {
            if (no.tag === "#text") {
                const t = no.text ?? "";
                if (!t.trim()) continue;
                desenharBlocoTexto(coletarPedacosInline(no, estiloPadrao), {
                    alinhamento: "left",
                    esqCm: contexto.esqCmExtra,
                    dirCm: 0,
                    primCm: 0,
                    fatorEntrelinha: 1.5,
                    espacoAntesPt: 0,
                    espacoDepoisPt: 0,
                    tamBase: 12,
                });
                continue;
            }

            if (no.tag === "div" && "data-quebra-pagina" in no.attrs) {
                novaPagina();
                continue;
            }

            if (no.tag === "div" && "data-assinatura-advogado" in no.attrs) {
                desenharBlocoAssinatura(no);
                continue;
            }

            if (no.tag === "hr") {
                garantirEspaco(18);
                cursorY -= 9;
                pageAtual.drawLine({
                    start: { x: marEsq, y: cursorY },
                    end: { x: larguraPag - marDir, y: cursorY },
                    thickness: 0.75,
                    color: rgb(0, 0, 0),
                });
                cursorY -= 9;
                continue;
            }

            if (no.tag === "table") {
                desenharTabela(no);
                continue;
            }

            if (no.tag === "blockquote") {
                processarNos(no.children, { esqCmExtra: contexto.esqCmExtra + 4, citacao: true });
                continue;
            }

            if (no.tag === "ul" || no.tag === "ol") {
                let idxItem = 1;
                for (const item of no.children) {
                    if (item.tag !== "li") continue;
                    const marcador = no.tag === "ol" ? `${idxItem++}.` : "•";
                    const pedacos = coletarPedacosInline(item, estiloPadrao);
                    desenharBlocoTexto(pedacos, {
                        alinhamento: item.style["text-align"] ?? "left",
                        esqCm: contexto.esqCmExtra + 1.5,
                        dirCm: 0,
                        primCm: 0,
                        fatorEntrelinha: 1.5,
                        espacoAntesPt: 0,
                        espacoDepoisPt: 3,
                        tamBase: 12,
                        marcadorLista: marcador,
                    });
                }
                continue;
            }

            if (no.tag === "div") {
                processarNos(no.children, contexto);
                continue;
            }

            const ehHeading = no.tag === "h1" || no.tag === "h2" || no.tag === "h3" || no.tag === "h4";
            const tamPadrao = no.tag === "h1" ? 16 : no.tag === "h2" ? 14 : contexto.citacao ? 10 : 12;
            const estiloBlocoBase: EstiloInline = {
                ...estiloPadrao,
                negrito: ehHeading,
                tamanhoPt: tamPadrao,
            };

            const pedacos = coletarPedacosInline(no, estiloBlocoBase);
            if (pedacos.length === 0) {
                // Parágrafo vazio (Enter) reserva altura de linha.
                garantirEspaco(tamPadrao * 1.5);
                cursorY -= tamPadrao * 1.5;
                continue;
            }

            const entrelinhaRaw = Number((no.style["line-height"] ?? "").replace(",", "."));
            const fatorEntrelinha =
                Number.isFinite(entrelinhaRaw) && entrelinhaRaw >= 0.8 && entrelinhaRaw <= 4
                    ? entrelinhaRaw
                    : contexto.citacao
                      ? 1.15
                      : 1.5;

            const esqCm = no.style["margin-left"]
                ? cssParaPt(no.style["margin-left"], 0, tamPadrao) / PT_POR_CM
                : contexto.esqCmExtra;
            const dirCm = cssParaPt(no.style["margin-right"], 0, tamPadrao) / PT_POR_CM;
            const primCm = cssParaPt(no.style["text-indent"], 0, tamPadrao) / PT_POR_CM;
            const antesPt = cssParaPt(no.style["margin-top"], 0, tamPadrao);
            const depoisPadrao = no.tag === "h1" ? 8 : no.tag === "h2" || no.tag === "h3" ? 6 : 0;
            const depoisPt = no.style["margin-bottom"]
                ? cssParaPt(no.style["margin-bottom"], depoisPadrao, tamPadrao)
                : depoisPadrao;

            const tabPt = cssParaPt(no.style["tab-size"], TAB_PADRAO_PT, tamPadrao);

            desenharBlocoTexto(pedacos, {
                alinhamento: (no.style["text-align"] ?? "left").toLowerCase(),
                esqCm,
                dirCm,
                primCm,
                fatorEntrelinha,
                espacoAntesPt: antesPt,
                espacoDepoisPt: depoisPt,
                tamBase: tamPadrao,
                tabPt: tabPt > 1 ? tabPt : TAB_PADRAO_PT,
            });
        }
    };

    const htmlLimpo = sanitizarHtmlDocumento(opcoes.corpoHtml);
    const nos = parseHtmlParaNos(htmlLimpo);
    processarNos(nos, { esqCmExtra: 0, citacao: false });

    // Sem bloco [assinatura]: o carimbo vai logo abaixo do texto; se a última página não tiver espaço,
    // abre uma página nova em vez de desenhar por cima das últimas linhas.
    const ALTURA_CARIMBO_LIVRE = 64;
    if (!posicaoAssinaturaCapturada && cursorY - ALTURA_CARIMBO_LIVRE < marInf + 6) {
        novaPagina();
    }
    const posicaoAssinatura: PosicaoAssinaturaPdf = posicaoAssinaturaCapturada ?? {
        paginaIndex: paginas.length - 1,
        x: Math.max(marEsq, (larguraPag - 250) / 2),
        y: Math.max(marInf + 6, Math.min(cursorY - ALTURA_CARIMBO_LIVRE, alturaPag - marSup - 70)),
        largura: Math.min(250, larguraPag - marEsq - marDir),
        altura: 58,
    };

    const pdfBytes = await pdfDoc.save();
    return { pdfBytes, posicaoAssinatura };
}
