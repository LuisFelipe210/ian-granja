/**
 * Contas da régua do editor (estilo Word), em centímetros.
 *
 * Recuos do parágrafo (como gravados no HTML):
 * - esquerda: margin-left; direita: margin-right; primeira: text-indent (relativo ao recuo esquerdo,
 *   negativo = deslocado).
 *
 * Marcadores na régua horizontal (posição a partir da margem esquerda, exceto o direito, que é medido
 * a partir da margem direita), como no Word:
 * - primeira (triângulo de cima): esquerda + primeira
 * - deslocado (triângulo de baixo): esquerda — arrasta o recuo esquerdo mantendo a 1ª linha no lugar
 * - esquerdo (retângulo): esquerda — arrasta o parágrafo inteiro (1ª linha acompanha)
 * - direito (triângulo à direita): direita
 */

export const PASSO_REGUA_CM = 0.25;
/** Largura mínima de texto que os recuos precisam deixar livre. */
export const LARGURA_MIN_TEXTO_CM = 1;
export const MARGEM_MIN_REGUA_CM = 0.5;
export const MARGEM_MAX_REGUA_CM = 6;
/** Largura/altura mínima da área de texto ao arrastar margens. */
export const AREA_MIN_TEXTO_CM = 2;

export type MarcadorRecuo = "primeira" | "deslocado" | "esquerdo" | "direito";

export interface RecuosCm {
    esquerda: number;
    direita: number;
    primeira: number;
}

const arred = (n: number) => Math.round(n * 100) / 100;
const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Encaixa no passo da régua (0,25 cm); com `livre` (Alt no Word) só arredonda a 0,01 cm. */
export function ajustarAoPasso(cm: number, livre = false): number {
    if (!Number.isFinite(cm)) return 0;
    return livre ? arred(cm) : arred(Math.round(cm / PASSO_REGUA_CM) * PASSO_REGUA_CM);
}

export function posicoesMarcadores(r: RecuosCm): Record<MarcadorRecuo, number> {
    return {
        primeira: arred(r.esquerda + r.primeira),
        deslocado: arred(r.esquerda),
        esquerdo: arred(r.esquerda),
        direito: arred(r.direita),
    };
}

export interface LimitesRecuoCm {
    /** Menor valor permitido para os marcadores da esquerda (negativo = entra na margem esquerda até a borda do papel). */
    minEsq?: number;
    /** Menor valor permitido para o marcador da direita (negativo = entra na margem direita até a borda do papel). */
    minDir?: number;
}

/**
 * Novo conjunto de recuos ao soltar um marcador em `valorCm` (na escala do próprio marcador).
 * `larguraTextoCm` = largura da página menos as margens esquerda e direita.
 * Com `limites` negativos (ex.: `-margemEsq`), os marcadores podem entrar na área cinza da margem, como no Word.
 */
export function arrastarMarcador(
    marcador: MarcadorRecuo,
    valorCm: number,
    r: RecuosCm,
    larguraTextoCm: number,
    limites?: LimitesRecuoCm,
): RecuosCm {
    const minE = limites?.minEsq ?? 0;
    const minD = limites?.minDir ?? 0;
    const primeiraAbs = r.esquerda + r.primeira;
    const limiteDireito = (direita: number) => Math.max(minE, larguraTextoCm - direita - LARGURA_MIN_TEXTO_CM);

    if (marcador === "direito") {
        const maisALaDireita = Math.max(r.esquerda, primeiraAbs);
        const direita = limitar(valorCm, minD, Math.max(minD, larguraTextoCm - maisALaDireita - LARGURA_MIN_TEXTO_CM));
        return { ...r, direita: arred(direita) };
    }

    if (marcador === "primeira") {
        const abs = limitar(valorCm, minE, limiteDireito(r.direita));
        return { ...r, primeira: arred(abs - r.esquerda) };
    }

    if (marcador === "deslocado") {
        // Move o recuo esquerdo e mantém a 1ª linha onde está (vira recuo deslocado ou de 1ª linha).
        const esquerda = limitar(valorCm, minE, limiteDireito(r.direita));
        return { ...r, esquerda: arred(esquerda), primeira: arred(primeiraAbs - esquerda) };
    }

    // "esquerdo": o parágrafo inteiro anda; a 1ª linha mantém a mesma distância do recuo.
    const minEsq = Math.max(minE, minE - r.primeira);
    const maxEsq = Math.max(minEsq, limiteDireito(r.direita) - Math.max(0, r.primeira));
    const esquerda = limitar(valorCm, minEsq, maxEsq);
    return { ...r, esquerda: arred(esquerda) };
}

/** Margem ao arrastar o limite cinza/branco da régua, respeitando a área mínima de texto. */
export function arrastarMargem(valorCm: number, margemOposta: number, tamanhoPaginaCm: number): number {
    const max = Math.min(MARGEM_MAX_REGUA_CM, tamanhoPaginaCm - margemOposta - AREA_MIN_TEXTO_CM);
    return arred(limitar(valorCm, MARGEM_MIN_REGUA_CM, Math.max(MARGEM_MIN_REGUA_CM, max)));
}

export interface MarcaRegua {
    /** Posição a partir da borda da página (cm). */
    posCm: number;
    tipo: "cm" | "meio" | "quarto";
    /** Número exibido nas marcas de centímetro (distância até a margem, como no Word). */
    rotulo?: string;
}

/** Marcas a cada 0,25 cm ao longo da página, com o zero na margem (`origemCm`). */
export function marcasRegua(tamanhoPaginaCm: number, origemCm: number): MarcaRegua[] {
    const marcas: MarcaRegua[] = [];
    const ini = Math.ceil((-origemCm - 1e-9) / PASSO_REGUA_CM);
    const fim = Math.floor((tamanhoPaginaCm - origemCm + 1e-9) / PASSO_REGUA_CM);
    for (let k = ini; k <= fim; k++) {
        const pos = arred(origemCm + k * PASSO_REGUA_CM);
        if (pos <= 0 || pos >= tamanhoPaginaCm) continue;
        const resto = ((k % 4) + 4) % 4;
        const tipo = resto === 0 ? "cm" : resto === 2 ? "meio" : "quarto";
        marcas.push(
            tipo === "cm" && k !== 0 ? { posCm: pos, tipo, rotulo: String(Math.abs(k / 4)) } : { posCm: pos, tipo },
        );
    }
    return marcas;
}

/** "1,25 cm" */
export function formatarCmRegua(cm: number): string {
    return `${String(arred(cm)).replace(".", ",")} cm`;
}
