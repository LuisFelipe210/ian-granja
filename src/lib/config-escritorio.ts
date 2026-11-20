/**
 * Dados do escritório que o advogado ajusta em Configurações: nome, OAB e cidade.
 * Usados nas petições ([advogado], [oab], [cidade]), na busca do DJEN pela OAB e para reconhecer
 * o advogado nas intimações. Sem banco (ou antes de carregar), valem os padrões abaixo.
 *
 * Módulo puro (sem React): roda no navegador, nos testes e nas funções da Vercel.
 */

export interface ConfigEscritorio {
    nomeAdvogado: string;
    /** Só dígitos. */
    oabNumero: string;
    /** Sigla da seccional (PE). */
    oabUf: string;
    cidade: string;
    uf: string;
}

export const CONFIG_ESCRITORIO_PADRAO: ConfigEscritorio = {
    nomeAdvogado: "Ian Felipe Menezes Souza Granja",
    oabNumero: "61107",
    oabUf: "PE",
    cidade: "Petrolina",
    uf: "PE",
};

const uf2 = (v: unknown) => {
    const s = String(v ?? "").trim().toUpperCase();
    return /^[A-Z]{2}$/.test(s) ? s : "";
};

/** Aceita a linha do banco (snake_case) ou o objeto da tela (camelCase). Campo vazio cai no padrão. */
export function normalizarConfigEscritorio(raw: unknown): ConfigEscritorio {
    const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const p = CONFIG_ESCRITORIO_PADRAO;
    const texto = (...chaves: string[]) => {
        for (const k of chaves) {
            const v = o[k];
            if (typeof v === "string" && v.trim()) return v.trim().replace(/\s+/g, " ");
        }
        return "";
    };
    const oab = texto("oabNumero", "oab_numero").replace(/\D+/g, "");
    return {
        nomeAdvogado: texto("nomeAdvogado", "nome_advogado") || p.nomeAdvogado,
        oabNumero: oab || p.oabNumero,
        oabUf: uf2(o.oabUf ?? o.oab_uf) || p.oabUf,
        cidade: texto("cidade") || p.cidade,
        uf: uf2(o.uf) || p.uf,
    };
}

/** Linha para gravar em revisional_configuracoes. */
export function configParaLinha(c: ConfigEscritorio): Record<string, string> {
    const n = normalizarConfigEscritorio(c);
    return {
        id: "escritorio",
        nome_advogado: n.nomeAdvogado.slice(0, 200),
        oab_numero: n.oabNumero.slice(0, 10),
        oab_uf: n.oabUf,
        cidade: n.cidade.slice(0, 100),
        uf: n.uf,
    };
}

/** "OAB/PE 61.107" */
export function formatarOab(c: Pick<ConfigEscritorio, "oabNumero" | "oabUf">): string {
    const numero = c.oabNumero.replace(/\D+/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `OAB/${c.oabUf} ${numero}`;
}

/** "Petrolina-PE" (local e data no fim da petição). */
export function cidadeAssinatura(c: Pick<ConfigEscritorio, "cidade" | "uf">): string {
    return c.uf ? `${c.cidade}-${c.uf}` : c.cidade;
}

/* ------------------------------------------------------- Valor atual (carregado do banco) */

let atual: ConfigEscritorio = { ...CONFIG_ESCRITORIO_PADRAO };
const ouvintes = new Set<() => void>();

export function configEscritorioAtual(): ConfigEscritorio {
    return atual;
}

export function definirConfigEscritorio(c: unknown): ConfigEscritorio {
    atual = normalizarConfigEscritorio(c);
    for (const fn of ouvintes) fn();
    return atual;
}

export function assinarConfigEscritorio(fn: () => void): () => void {
    ouvintes.add(fn);
    return () => {
        ouvintes.delete(fn);
    };
}
