export type GrupoFonteEditor = "Jurídicas (Serifa)" | "Modernas (Sem serifa)" | "Monoespaçada";

export interface FonteEditor {
    rotulo: string;
    /** Valor aplicado em `font-family` pelo TipTap (compatível com o sanitizador CSS e o Word). */
    valor: string;
    grupo: GrupoFonteEditor;
    /** Nome exato da família no Google Fonts, quando é web font externa. */
    googleFamily?: string;
    /** Se `true`, carrega pesos 400 e 700 com itálico no Google Fonts. */
    temItalico?: boolean;
}

export const GRUPOS_FONTE_EDITOR: GrupoFonteEditor[] = [
    "Jurídicas (Serifa)",
    "Modernas (Sem serifa)",
    "Monoespaçada",
];

export const FONTES_EDITOR: FonteEditor[] = [
    // Clássicas / Jurídicas (Serifa)
    { rotulo: "Times New Roman", valor: "'Times New Roman', Times, serif", grupo: "Jurídicas (Serifa)" },
    { rotulo: "Georgia", valor: "Georgia, serif", grupo: "Jurídicas (Serifa)" },
    {
        rotulo: "Garamond",
        valor: "'EB Garamond', Garamond, 'Times New Roman', serif",
        grupo: "Jurídicas (Serifa)",
        googleFamily: "EB Garamond",
        temItalico: true,
    },
    {
        rotulo: "Merriweather",
        valor: "'Merriweather', Georgia, serif",
        grupo: "Jurídicas (Serifa)",
        googleFamily: "Merriweather",
        temItalico: true,
    },
    {
        rotulo: "Lora",
        valor: "'Lora', Georgia, serif",
        grupo: "Jurídicas (Serifa)",
        googleFamily: "Lora",
        temItalico: true,
    },
    {
        rotulo: "Playfair Display",
        valor: "'Playfair Display', Georgia, serif",
        grupo: "Jurídicas (Serifa)",
        googleFamily: "Playfair Display",
        temItalico: true,
    },
    {
        rotulo: "Libre Baskerville",
        valor: "'Libre Baskerville', Georgia, serif",
        grupo: "Jurídicas (Serifa)",
        googleFamily: "Libre Baskerville",
        temItalico: true,
    },
    {
        rotulo: "Literata",
        valor: "'Literata Variable', 'Literata', Georgia, serif",
        grupo: "Jurídicas (Serifa)",
        googleFamily: "Literata",
        temItalico: true,
    },
    {
        rotulo: "Palatino / Book Antiqua",
        valor: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
        grupo: "Jurídicas (Serifa)",
    },

    // Modernas (Sem serifa)
    {
        rotulo: "Montserrat",
        valor: "'Montserrat', Arial, sans-serif",
        grupo: "Modernas (Sem serifa)",
        googleFamily: "Montserrat",
        temItalico: true,
    },
    { rotulo: "Arial", valor: "Arial, Helvetica, sans-serif", grupo: "Modernas (Sem serifa)" },
    { rotulo: "Calibri", valor: "Calibri, 'Segoe UI', Arial, sans-serif", grupo: "Modernas (Sem serifa)" },
    {
        rotulo: "Inter",
        valor: "'Inter', Arial, sans-serif",
        grupo: "Modernas (Sem serifa)",
        googleFamily: "Inter",
        temItalico: true,
    },
    {
        rotulo: "Roboto",
        valor: "'Roboto', Arial, sans-serif",
        grupo: "Modernas (Sem serifa)",
        googleFamily: "Roboto",
        temItalico: true,
    },
    {
        rotulo: "Open Sans",
        valor: "'Open Sans', Arial, sans-serif",
        grupo: "Modernas (Sem serifa)",
        googleFamily: "Open Sans",
        temItalico: true,
    },
    {
        rotulo: "Lato",
        valor: "'Lato', Arial, sans-serif",
        grupo: "Modernas (Sem serifa)",
        googleFamily: "Lato",
        temItalico: true,
    },
    {
        rotulo: "Poppins",
        valor: "'Poppins', Arial, sans-serif",
        grupo: "Modernas (Sem serifa)",
        googleFamily: "Poppins",
        temItalico: true,
    },
    {
        rotulo: "Source Sans 3",
        valor: "'Source Sans 3', Arial, sans-serif",
        grupo: "Modernas (Sem serifa)",
        googleFamily: "Source Sans 3",
        temItalico: true,
    },
    {
        rotulo: "Raleway",
        valor: "'Raleway', Arial, sans-serif",
        grupo: "Modernas (Sem serifa)",
        googleFamily: "Raleway",
        temItalico: true,
    },
    {
        rotulo: "Nunito",
        valor: "'Nunito', Arial, sans-serif",
        grupo: "Modernas (Sem serifa)",
        googleFamily: "Nunito",
        temItalico: true,
    },
    {
        rotulo: "Archivo",
        valor: "'Archivo Variable', 'Archivo', Arial, sans-serif",
        grupo: "Modernas (Sem serifa)",
        googleFamily: "Archivo",
        temItalico: true,
    },
    { rotulo: "Verdana", valor: "Verdana, Geneva, sans-serif", grupo: "Modernas (Sem serifa)" },
    { rotulo: "Tahoma", valor: "Tahoma, Geneva, sans-serif", grupo: "Modernas (Sem serifa)" },
    { rotulo: "Trebuchet MS", valor: "'Trebuchet MS', Helvetica, sans-serif", grupo: "Modernas (Sem serifa)" },

    // Monoespaçada
    { rotulo: "Courier New", valor: "'Courier New', Courier, monospace", grupo: "Monoespaçada" },
];

function primeiraFamilia(css: string): string {
    return css
        .split(",")[0]
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .toLowerCase();
}

/** Encontra a definição da fonte a partir do valor `font-family` retornado pelo TipTap/DOM. */
export function encontrarFonteEditor(fontFamilyCss?: string): FonteEditor | null {
    if (!fontFamilyCss) return null;
    const alvo = primeiraFamilia(fontFamilyCss);
    if (!alvo) return null;
    return (
        FONTES_EDITOR.find((f) => {
            if (primeiraFamilia(f.valor) === alvo) return true;
            if (f.googleFamily && f.googleFamily.toLowerCase() === alvo) return true;
            if (f.rotulo.toLowerCase() === alvo) return true;
            return false;
        }) ?? null
    );
}

function montarUrlGoogleFonts(familias: FonteEditor[]): string {
    const unicas = familias.filter((f): f is FonteEditor & { googleFamily: string } => Boolean(f.googleFamily));
    if (unicas.length === 0) return "";
    const params = unicas.map((f) => {
        const nome = f.googleFamily.replace(/\s+/g, "+");
        return f.temItalico ? `family=${nome}:ital,wght@0,400;0,700;1,400;1,700` : `family=${nome}:wght@400;700`;
    });
    return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}

/** URL do Google Fonts com todas as web fonts disponíveis no editor. */
export const URL_GOOGLE_FONTS_EDITOR = montarUrlGoogleFonts(FONTES_EDITOR);

/**
 * Monta uma URL mínima do Google Fonts contendo apenas as fontes realmente usadas
 * no HTML de um documento (para impressão/PDF rápida e fiel).
 */
export function urlGoogleFontsParaHtml(html: string): string {
    if (!html) return "";
    const lower = html.toLowerCase();
    const usadas = FONTES_EDITOR.filter(
        (f) => f.googleFamily && lower.includes(f.googleFamily.toLowerCase()),
    );
    return montarUrlGoogleFonts(usadas);
}

const ID_LINK_FONTES_EDITOR = "ian-editor-google-fonts";

/** Injeta o stylesheet das web fonts do editor sob demanda (uma única vez no navegador). */
export function garantirFontesEditorCarregadas(): void {
    if (typeof document === "undefined" || !URL_GOOGLE_FONTS_EDITOR) return;
    if (document.getElementById(ID_LINK_FONTES_EDITOR)) return;
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = "https://fonts.gstatic.com";
    preconnect.crossOrigin = "anonymous";
    document.head.appendChild(preconnect);

    const link = document.createElement("link");
    link.id = ID_LINK_FONTES_EDITOR;
    link.rel = "stylesheet";
    link.href = URL_GOOGLE_FONTS_EDITOR;
    document.head.appendChild(link);
}
