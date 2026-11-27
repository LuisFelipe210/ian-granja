/**
 * Modelos de IA que o escritório pode escolher para o atendimento (tela Configurações).
 * Sem dependências de servidor: usado no navegador (seletor) e no servidor (validação).
 * Custos estimados com ~5 mil tokens de entrada e ~1 mil de saída por rascunho.
 */

export interface OpcaoModelo {
    id: string;
    nome: string;
    resumo: string;
    /** Custo aproximado de 1.000 rascunhos de resposta. */
    custoMilRascunhos: string;
    /** Custo aproximado para ler um PDF de ~20 páginas. */
    custoDocumento: string;
}

export const MODELOS_ATENDIMENTO: OpcaoModelo[] = [
    {
        id: "claude-haiku-5-5",
        nome: "Claude Haiku 5.5",
        resumo: "Econômico e rápido. Bom para respostas curtas com a base do cliente.",
        custoMilRascunhos: "~R$ 6",
        custoDocumento: "~R$ 0,05",
    },
    {
        id: "claude-sonnet-5-5",
        nome: "Claude Sonnet 5.5",
        resumo: "Equilibrado. Lê documentos com boa precisão.",
        custoMilRascunhos: "~R$ 110",
        custoDocumento: "~R$ 0,80",
    },
    {
        id: "claude-opus-5-5",
        nome: "Claude Opus 5.5",
        resumo: "O mais preciso e o mais caro.",
        custoMilRascunhos: "~R$ 220",
        custoDocumento: "~R$ 1,60",
    },
];

/** Padrões escolhidos pelo custo: Haiku nos rascunhos, Sonnet na leitura de documentos. */
export const MODELO_RESPOSTA_PADRAO = "claude-haiku-5-5";
export const MODELO_EXTRACAO_PADRAO = "claude-sonnet-5-5";

const IDS = new Set(MODELOS_ATENDIMENTO.map((m) => m.id));

export function modeloPermitido(id: unknown): id is string {
    return typeof id === "string" && IDS.has(id.trim());
}

/** Primeiro candidato válido (escolha salva no site → variável de ambiente → padrão). */
export function escolherModelo(candidatos: Array<string | null | undefined>, padrao: string): string {
    for (const c of candidatos) if (modeloPermitido(c)) return c.trim();
    return padrao;
}

export interface ModelosEscritorio {
    resposta: string;
    extracao: string;
}
