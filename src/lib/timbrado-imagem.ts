/**
 * Prepara uma imagem de papel timbrado A4 (PNG, JPG ou WebP) para ser salva e aplicada
 * em todas as folhas do editor, na impressão/PDF e no Word.
 * Redimensiona imagens enormes mantendo ~200 DPI para A4 (1654×2339 px) e limita o peso final.
 */

import { sanitizarTimbradoImagemUrl } from "./config-escritorio.ts";

const MAX_ARQUIVO_BYTES = 15 * 1024 * 1024;
const MAX_LARGURA_PX = 1654;
const MAX_ALTURA_PX = 2339;
const MAX_DATA_URL_CHARS = 2_300_000;
const TIPOS_ACEITOS = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const EXTENSOES_ACEITAS = /\.(?:png|jpe?g|webp)$/i;

function lerComoDataUrl(arquivo: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Não foi possível ler o arquivo da imagem."));
        };
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo da imagem."));
        reader.readAsDataURL(arquivo);
    });
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Arquivo de imagem inválido ou corrompido."));
        img.src = src;
    });
}

export async function prepararImagemTimbradoA4(arquivo: File): Promise<string> {
    const tipoOk = TIPOS_ACEITOS.has(arquivo.type.toLowerCase());
    const extOk = EXTENSOES_ACEITAS.test(arquivo.name);
    if (!tipoOk && !(arquivo.type === "" && extOk)) {
        throw new Error("Envie uma imagem em PNG, JPG ou WebP do seu papel timbrado A4.");
    }
    if (arquivo.size > MAX_ARQUIVO_BYTES) {
        throw new Error("A imagem passa de 15 MB. Exporte em PNG ou JPG com resolução até 300 DPI.");
    }

    // Arquivo sem tipo (alguns apps/arrastes não informam): assume o da extensão, senão o data URI sairia
    // como application/octet-stream e o sanitizador apagaria a imagem em silêncio ao salvar.
    const tipo = tipoOk ? arquivo.type.toLowerCase() : tipoPelaExtensao(arquivo.name);
    const fonte = tipoOk ? arquivo : new Blob([arquivo], { type: tipo });
    const resultado = await otimizarImagem(fonte, tipo);
    if (!sanitizarTimbradoImagemUrl(resultado)) {
        throw new Error("Não foi possível preparar a imagem do timbrado. Exporte em PNG ou JPG e tente de novo.");
    }
    return resultado;
}

function tipoPelaExtensao(nome: string): string {
    const ext = nome.toLowerCase().split(".").pop();
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    return "image/jpeg";
}

async function otimizarImagem(arquivo: Blob, tipo: string): Promise<string> {
    const originalUrl = await lerComoDataUrl(arquivo);
    const img = await carregarImagem(originalUrl);
    const wOrig = img.naturalWidth || img.width;
    const hOrig = img.naturalHeight || img.height;
    if (!(wOrig > 0 && hOrig > 0)) {
        throw new Error("Não foi possível identificar as dimensões da imagem.");
    }

    // Se já está dentro do tamanho e peso ideais, preserva exatamente os pixels originais.
    if (wOrig <= MAX_LARGURA_PX && hOrig <= MAX_ALTURA_PX && originalUrl.length <= MAX_DATA_URL_CHARS) {
        return originalUrl;
    }

    const escala = Math.min(1, MAX_LARGURA_PX / wOrig, MAX_ALTURA_PX / hOrig);
    const w = Math.max(1, Math.round(wOrig * escala));
    const h = Math.max(1, Math.round(hOrig * escala));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Este navegador não conseguiu processar a imagem.");

    // Fundo branco garante papel limpo caso a imagem tenha transparência ao converter para JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    // Tenta PNG primeiro se o original era PNG pequeno; senão JPEG de alta qualidade (ótimo para A4 e Word).
    if (tipo === "image/png") {
        const png = canvas.toDataURL("image/png");
        if (png.length <= MAX_DATA_URL_CHARS) return png;
    }

    for (const qualidade of [0.92, 0.85, 0.78, 0.7]) {
        const jpg = canvas.toDataURL("image/jpeg", qualidade);
        if (jpg.length <= MAX_DATA_URL_CHARS) return jpg;
    }

    throw new Error("Mesmo comprimida, a imagem ficou muito grande para salvar. Tente reduzir a resolução.");
}
