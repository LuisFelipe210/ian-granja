/**
 * Base de conhecimento do atendimento por IA — parte pura (sem rede), usada no navegador, no servidor e
 * nos testes.
 *
 * Princípio anti-alucinação: a IA só recebe as FONTES de UM cliente (montadas aqui, em código, a partir
 * do id desse cliente) e toda resposta passa por `validarRespostaAtendimento`, que recusa a resposta e
 * troca por uma mensagem fixa quando ela não cita fontes válidas ou traz número/data que não está nas
 * fontes citadas.
 */

export type OrigemConhecimento = "documento" | "anotacao";

export interface FatoDocumento {
    rotulo: string;
    valor: string;
    /** Página do PDF de onde o fato saiu (1 = primeira). Nulo em anotações ou imagens. */
    pagina: number | null;
}

export interface ItemConhecimento {
    id: string;
    cliente_id: string;
    origem: OrigemConhecimento;
    titulo: string;
    arquivo_nome: string;
    resumo: string;
    fatos: FatoDocumento[];
    visivel_cliente: boolean;
    created_by_email: string;
    created_at: string;
    updated_at: string;
}

export type ItemConhecimentoPayload = Pick<
    ItemConhecimento,
    "cliente_id" | "origem" | "titulo" | "arquivo_nome" | "resumo" | "fatos" | "visivel_cliente"
>;

/** Resultado da leitura de um PDF/foto pela IA, antes de o escritório revisar e salvar. */
export interface ExtracaoDocumento {
    titulo: string;
    resumo: string;
    fatos: FatoDocumento[];
}

/** Dados mínimos de um caso que o atendimento pode mencionar ao próprio cliente. */
export interface CasoParaAtendimento {
    processo_global: string;
    banco: string;
    modalidade_nome: string;
    fase: string;
    valor_financiado: number | null;
    valor_parcela: number | null;
    parcelas: number | null;
    atualizado_em: string;
}

export interface FonteAtendimento {
    /** "F1", "F2"... — é o que a IA cita no campo `fontes`. */
    id: string;
    titulo: string;
    texto: string;
}

export interface ContextoAtendimento {
    clienteId: string;
    nomeCliente: string;
    fontes: FonteAtendimento[];
}

export type SituacaoResposta = "respondido" | "sem_informacao" | "encaminhar_advogado";

/** Formato que a IA devolve (structured output). */
export interface SaidaModeloAtendimento {
    situacao: SituacaoResposta;
    mensagem: string;
    fontes: string[];
}

export interface RespostaAtendimento {
    situacao: SituacaoResposta;
    mensagem: string;
    fontes: FonteAtendimento[];
    /** true quando o código descartou a resposta da IA por falta de base. */
    bloqueadaPelaValidacao: boolean;
    /** Por que foi bloqueada / encaminhada (só para o escritório, nunca vai ao cliente). */
    motivoInterno: string;
    /** true = avisar o advogado (pergunta sem base, pedido de orientação jurídica, reclamação...). */
    avisarAdvogado: boolean;
}

export const LIMITES_CONHECIMENTO = {
    titulo: 200,
    arquivoNome: 255,
    resumo: 4000,
    rotulo: 120,
    valor: 600,
    fatos: 120,
} as const;

const limpar = (v: unknown, max: number): string =>
    typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Normaliza a lista de fatos vinda da IA ou do banco: descarta vazios, corta tamanhos e páginas inválidas. */
export function normalizarFatos(raw: unknown): FatoDocumento[] {
    if (!Array.isArray(raw)) return [];
    const fatos: FatoDocumento[] = [];
    for (const item of raw) {
        if (!item || typeof item !== "object") continue;
        const r = item as Record<string, unknown>;
        const rotulo = limpar(r.rotulo, LIMITES_CONHECIMENTO.rotulo);
        const valor = limpar(r.valor, LIMITES_CONHECIMENTO.valor);
        if (!rotulo || !valor) continue;
        const p = typeof r.pagina === "number" ? r.pagina : Number(r.pagina);
        const pagina = Number.isInteger(p) && p >= 1 && p <= 2000 ? p : null;
        fatos.push({ rotulo, valor, pagina });
        if (fatos.length >= LIMITES_CONHECIMENTO.fatos) break;
    }
    return fatos;
}

export function normalizarExtracao(raw: unknown): ExtracaoDocumento {
    const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return {
        titulo: limpar(r.titulo, LIMITES_CONHECIMENTO.titulo) || "Documento",
        resumo: typeof r.resumo === "string" ? r.resumo.trim().slice(0, LIMITES_CONHECIMENTO.resumo) : "",
        fatos: normalizarFatos(r.fatos),
    };
}

/** Limpa o payload antes de gravar no banco. */
export function sanitizarItemConhecimento(p: Partial<ItemConhecimentoPayload>): Record<string, unknown> {
    const origem: OrigemConhecimento = p.origem === "anotacao" ? "anotacao" : "documento";
    return {
        ...(p.cliente_id ? { cliente_id: p.cliente_id } : {}),
        origem,
        titulo: limpar(p.titulo, LIMITES_CONHECIMENTO.titulo) || (origem === "anotacao" ? "Anotação" : "Documento"),
        arquivo_nome: limpar(p.arquivo_nome, LIMITES_CONHECIMENTO.arquivoNome),
        resumo: typeof p.resumo === "string" ? p.resumo.trim().slice(0, LIMITES_CONHECIMENTO.resumo) : "",
        fatos: normalizarFatos(p.fatos),
        visivel_cliente: p.visivel_cliente !== false,
    };
}

export function normalizarItemConhecimento(raw: Record<string, unknown>): ItemConhecimento {
    return {
        id: String(raw.id ?? ""),
        cliente_id: String(raw.cliente_id ?? ""),
        origem: raw.origem === "anotacao" ? "anotacao" : "documento",
        titulo: typeof raw.titulo === "string" ? raw.titulo : "",
        arquivo_nome: typeof raw.arquivo_nome === "string" ? raw.arquivo_nome : "",
        resumo: typeof raw.resumo === "string" ? raw.resumo : "",
        fatos: normalizarFatos(raw.fatos),
        visivel_cliente: raw.visivel_cliente !== false,
        created_by_email: typeof raw.created_by_email === "string" ? raw.created_by_email : "",
        created_at: typeof raw.created_at === "string" ? raw.created_at : "",
        updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
    };
}

/* ------------------------------------------------------------------ Fontes */

function dataBR(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function reais(n: number | null): string {
    if (n == null || !Number.isFinite(n) || n <= 0) return "";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Monta as fontes numeradas de UM cliente. Só entra aqui o que esse cliente pode saber dele mesmo:
 * nome, casos (sem estimativas de ganho) e os itens da base marcados como visíveis ao cliente.
 */
export function montarFontesCliente(args: {
    clienteId: string;
    nomeCliente: string;
    casos: CasoParaAtendimento[];
    itens: ItemConhecimento[];
}): ContextoAtendimento {
    const fontes: FonteAtendimento[] = [];
    const add = (titulo: string, linhas: string[]) => {
        const texto = linhas.filter((l) => l.trim()).join("\n");
        if (texto) fontes.push({ id: `F${fontes.length + 1}`, titulo, texto });
    };

    add("Cadastro do cliente", [`Nome: ${args.nomeCliente}`]);

    args.casos.forEach((c, i) => {
        add(`Caso ${i + 1}${c.processo_global ? ` (processo ${c.processo_global})` : ""}`, [
            c.processo_global ? `Número do processo: ${c.processo_global}` : "Número do processo: ainda não distribuído",
            c.banco ? `Banco: ${c.banco}` : "",
            c.modalidade_nome ? `Tipo de contrato: ${c.modalidade_nome}` : "",
            c.fase ? `Fase atual no escritório: ${c.fase}` : "",
            reais(c.valor_financiado) ? `Valor financiado no contrato: ${reais(c.valor_financiado)}` : "",
            reais(c.valor_parcela) ? `Valor da parcela no contrato: ${reais(c.valor_parcela)}` : "",
            c.parcelas ? `Quantidade de parcelas do contrato: ${c.parcelas}` : "",
            dataBR(c.atualizado_em) ? `Última atualização do caso no sistema: ${dataBR(c.atualizado_em)}` : "",
        ]);
    });

    args.itens
        .filter((it) => it.visivel_cliente && it.cliente_id.toLowerCase() === args.clienteId.toLowerCase())
        .forEach((it) => {
            const quando = dataBR(it.created_at);
            add(it.origem === "anotacao" ? `Anotação do escritório: ${it.titulo}` : `Documento: ${it.titulo}`, [
                quando ? `Registrado em: ${quando}` : "",
                it.resumo ? `Resumo: ${it.resumo}` : "",
                ...it.fatos.map((f) => `${f.rotulo}: ${f.valor}${f.pagina ? ` (pág. ${f.pagina})` : ""}`),
            ]);
        });

    return { clienteId: args.clienteId, nomeCliente: args.nomeCliente, fontes };
}

/** Texto das fontes como vai para a IA (cada uma delimitada e identificada). */
export function fontesComoTexto(fontes: FonteAtendimento[]): string {
    return fontes
        // Sem "<" e ">" vindos de documentos/anotações: um texto extraído não pode fechar a <fonte> e
        // abrir uma falsa (ex.: '</fonte><fonte id="F1" titulo="Cadastro">Valor a receber...').
        .map((f) => {
            const titulo = f.titulo.replace(/[<>"]/g, (c) => (c === '"' ? "'" : ""));
            return `<fonte id="${f.id}" titulo="${titulo}">\n${f.texto.replace(/[<>]/g, "")}\n</fonte>`;
        })
        .join("\n\n");
}

/* ------------------------------------------------------------------ Validação */

const MESES: Record<string, string> = {
    janeiro: "01", fevereiro: "02", marco: "03", "março": "03", abril: "04", maio: "05", junho: "06",
    julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};
const MES_RE = "(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)";
/** Não pode estar colado em outro número (evita pegar "8.17.0001" de dentro de um número de processo). */
const ANTES = "(?<![\\d.,\\-/])";
const DEPOIS = "(?![\\d]|[.,\\-/]\\d)";

/**
 * Um número ou data encontrado no texto. `chaves` são as formas equivalentes dele: a resposta passa
 * quando QUALQUER chave de cada token dela aparece entre as chaves das fontes citadas.
 * - "N:35000"   valor (pt-BR: "35.000,00", "35.000", "35000" e "35 mil" viram o mesmo valor);
 * - "I:123..."  identificador só com dígitos (processo, CPF, contrato), comparado inteiro, nunca por prefixo;
 * - "D:aaaammdd" data completa; "DM:mmdd" dia+mês; "MA:aaaamm" mês+ano; "DIA:dd" só o dia.
 */
export interface TokenNumerico {
    texto: string;
    chaves: string[];
}

/** "resposta": cada data vale só como foi escrita. "fonte": uma data completa também cobre dia, mês e ano soltos. */
export type PapelTexto = "resposta" | "fonte";

const pad2 = (s: string) => s.padStart(2, "0");

function valorNormalizado(inteiro: string, fracao: string): string {
    const i = inteiro.replace(/^0+(?=\d)/, "");
    const f = fracao.replace(/0+$/, "");
    return f ? `${i}.${f}` : i;
}

function chavesDeNumero(bruto: string): string[] {
    const ptBR = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/.exec(bruto);
    if (!ptBR) return [`I:${bruto.replace(/\D/g, "")}`];
    const inteiro = ptBR[1].replace(/\./g, "");
    const chaves = [`N:${valorNormalizado(inteiro, ptBR[2] ?? "")}`];
    // Sem vírgula pode ser também um identificador curto ("contrato 35000").
    if (ptBR[2] === undefined) chaves.push(`I:${inteiro}`);
    return chaves;
}

function dataValida(dia: string, mes: string): boolean {
    const d = Number(dia);
    const m = Number(mes);
    return d >= 1 && d <= 31 && m >= 1 && m <= 12;
}

export function tokensNumericos(texto: string, papel: PapelTexto = "resposta"): TokenNumerico[] {
    const tokens: TokenNumerico[] = [];
    const fonte = papel === "fonte";
    let resto = ` ${texto.toLowerCase()} `;

    const trocar = (re: RegExp, fn: (g: string[]) => string[] | null) => {
        resto = resto.replace(re, (...args: unknown[]) => {
            const casado = String(args[0]);
            // args = [casado, ...grupos, posição, textoInteiro]; grupo opcional ausente vira "".
            const grupos = args.slice(1, -2).map((a) => (typeof a === "string" ? a : ""));
            const chaves = fn(grupos);
            if (!chaves) return casado;
            tokens.push({ texto: casado.trim(), chaves });
            return " ";
        });
    };
    const dataCompleta = (ano: string, mes: string, dia: string): string[] | null => {
        if (!dataValida(dia, mes)) return null;
        const [m, d] = [pad2(mes), pad2(dia)];
        const completa = `D:${ano}${m}${d}`;
        return fonte ? [completa, `DM:${m}${d}`, `MA:${ano}${m}`, `DIA:${d}`, `N:${ano}`, `I:${ano}`] : [completa];
    };
    const anoCheio = (a: string) => (a.length === 2 ? `20${a}` : a);

    trocar(new RegExp(`${ANTES}(\\d{4})-(\\d{2})-(\\d{2})${DEPOIS}`, "g"), (g) => dataCompleta(g[0], g[1], g[2]));
    trocar(new RegExp(`${ANTES}(\\d{1,2})([/.])(\\d{1,2})\\2(\\d{4}|\\d{2})${DEPOIS}`, "g"), (g) =>
        dataCompleta(anoCheio(g[3]), g[2], g[0]),
    );
    trocar(new RegExp(`(\\d{1,2})º?\\s+de\\s+${MES_RE}\\s+de\\s+(\\d{4})`, "g"), (g) =>
        dataCompleta(g[2], MESES[g[1]], g[0]),
    );
    // Datas parciais: "10 de dezembro", "10/12", "dezembro de 2026", "dia 10".
    const diaMes = (dia: string, mes: string): string[] | null => {
        if (!dataValida(dia, mes)) return null;
        const [m, d] = [pad2(mes), pad2(dia)];
        return fonte ? [`DM:${m}${d}`, `DIA:${d}`] : [`DM:${m}${d}`];
    };
    trocar(new RegExp(`(\\d{1,2})º?\\s+de\\s+${MES_RE}\\b`, "g"), (g) => diaMes(g[0], MESES[g[1]]));
    trocar(new RegExp(`\\b${MES_RE}\\s*(?:de\\s+|/)(\\d{4})\\b`, "g"), (g) =>
        fonte ? [`MA:${g[1]}${MESES[g[0]]}`, `N:${g[1]}`, `I:${g[1]}`] : [`MA:${g[1]}${MESES[g[0]]}`],
    );
    trocar(new RegExp(`${ANTES}(\\d{1,2})/(\\d{1,2})${DEPOIS}`, "g"), (g) => diaMes(g[0], g[1]));
    trocar(/\bdia\s+(\d{1,2})\b/g, (g) => [`DIA:${pad2(g[0])}`]);

    // "35 mil", "1,2 milhão": só na resposta faz sentido (as fontes trazem o valor por extenso em número).
    trocar(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(mil|milhão|milhao|milhões|milhoes|bilhão|bilhao|bilhões|bilhoes)\b/g, (g) => {
        const mult = g[2].startsWith("b") ? 1e9 : g[2].startsWith("milh") ? 1e6 : 1e3;
        const base = Number(`${g[0].replace(/\./g, "")}.${g[1] || "0"}`);
        const [i, f] = (Math.round(base * mult * 100) / 100).toFixed(2).split(".");
        return [`N:${valorNormalizado(i, f)}`];
    });

    for (const m of resto.matchAll(/\d[\d.,\-/]*\d|\d/g)) tokens.push({ texto: m[0], chaves: chavesDeNumero(m[0]) });
    return tokens;
}

/** Número/data da resposta tem base nas fontes? Compara valores e identificadores inteiros, nunca prefixos. */
function numeroTemBase(token: TokenNumerico, chavesFontes: Set<string>): boolean {
    // Números de 1 dígito ("1ª parcela", "2 contratos") não identificam nada sozinhos.
    if (token.chaves.some((c) => /^N:\d$/.test(c))) return true;
    return token.chaves.some((c) => chavesFontes.has(c));
}

function primeiroNome(nomeCliente: string): string {
    return nomeCliente.trim().split(/\s+/)[0] ?? "";
}

export function mensagemPadraoSemBase(nomeCliente: string): string {
    const nome = primeiroNome(nomeCliente);
    return `${nome ? `${nome}, ` : ""}não encontrei essa informação no seu processo aqui comigo. Já avisei o advogado responsável e ele vai te responder assim que possível.`;
}

export function mensagemPadraoEncaminhar(nomeCliente: string): string {
    const nome = primeiroNome(nomeCliente);
    return `${nome ? `${nome}, ` : ""}essa pergunta precisa ser respondida pelo advogado. Já passei para ele e você terá o retorno assim que possível.`;
}

/**
 * Última barreira contra alucinação, em CÓDIGO (não depende da IA obedecer):
 * - "respondido" precisa citar ao menos uma fonte existente;
 * - todo número ou data da mensagem precisa aparecer nas fontes citadas;
 * - "sem_informacao" e "encaminhar_advogado" nunca repassam o texto da IA: usam mensagem fixa.
 */
export function validarRespostaAtendimento(saida: unknown, contexto: ContextoAtendimento): RespostaAtendimento {
    const semBase = (motivo: string, bloqueada: boolean): RespostaAtendimento => ({
        situacao: "sem_informacao",
        mensagem: mensagemPadraoSemBase(contexto.nomeCliente),
        fontes: [],
        bloqueadaPelaValidacao: bloqueada,
        motivoInterno: motivo,
        avisarAdvogado: true,
    });

    if (!saida || typeof saida !== "object") return semBase("A IA não devolveu uma resposta estruturada.", true);
    const s = saida as Partial<SaidaModeloAtendimento>;
    const mensagem = typeof s.mensagem === "string" ? s.mensagem.trim() : "";
    const idsCitados = Array.isArray(s.fontes) ? s.fontes.filter((x): x is string => typeof x === "string") : [];

    if (s.situacao === "encaminhar_advogado") {
        return {
            situacao: "encaminhar_advogado",
            mensagem: mensagemPadraoEncaminhar(contexto.nomeCliente),
            fontes: [],
            bloqueadaPelaValidacao: false,
            motivoInterno: "A IA indicou que a pergunta precisa do advogado.",
            avisarAdvogado: true,
        };
    }
    if (s.situacao !== "respondido") {
        return semBase("A IA não encontrou a informação nas fontes do cliente.", false);
    }

    if (!mensagem) return semBase("Resposta vazia.", true);
    if (mensagem.length > 1500) return semBase("Resposta longa demais para o WhatsApp.", true);
    if (idsCitados.length === 0) return semBase("A IA respondeu sem citar nenhuma fonte.", true);

    const porId = new Map(contexto.fontes.map((f) => [f.id, f]));
    const desconhecidas = idsCitados.filter((id) => !porId.has(id));
    if (desconhecidas.length > 0) return semBase(`A IA citou fontes inexistentes: ${desconhecidas.join(", ")}.`, true);

    const citadas = [...new Set(idsCitados)].map((id) => porId.get(id)!);
    const chavesFontes = new Set(citadas.flatMap((f) => tokensNumericos(f.texto, "fonte").flatMap((t) => t.chaves)));
    const foraDaBase = tokensNumericos(mensagem).filter((t) => !numeroTemBase(t, chavesFontes));
    if (foraDaBase.length > 0) {
        const legivel = [...new Set(foraDaBase.map((t) => t.texto))];
        return semBase(`A resposta trazia números/datas que não estão nas fontes citadas: ${legivel.join(", ")}.`, true);
    }

    return {
        situacao: "respondido",
        mensagem,
        fontes: citadas,
        bloqueadaPelaValidacao: false,
        motivoInterno: "",
        avisarAdvogado: false,
    };
}
