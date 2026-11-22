/**
 * Modelos de documento com campos entre colchetes.
 *
 * O Ian escreve o modelo uma vez ("[nome do cliente], já qualificado nos autos...") e o sistema
 * troca cada [campo] pelos dados do cliente da carteira na hora de gerar a petição. Campos que o
 * sistema não conhece (ex.: [CPF do cliente]) viram perguntas no formulário de geração.
 *
 * Funções puras: rodam no navegador e nos testes (node --test), sem DOM.
 */
import { brl, num } from "./juros/index.ts";
import { lerDadosProcessoDjen } from "./juros/djen.ts";
import {
    cidadeAssinatura,
    configEscritorioAtual,
    formatarOab,
    type ConfigEscritorio,
} from "./config-escritorio.ts";
import { urlGoogleFontsParaHtml } from "./fontes-editor.ts";
import type { CalculoSalvo, Cliente } from "./revisional-db.ts";
import {
    enderecoCompleto,
    estadoCivilPorExtenso,
    formatarCep,
    formatarCpf,
    formatarCpfCnpj,
    formatarTelefone,
    nacionalidadeFlexionada,
    qualificacaoCompleta,
} from "./clientes.ts";

export const GRUPOS_CAMPOS = ["Cliente", "Processo", "Contrato e valores", "Escritório e data"] as const;
export type GrupoCampo = (typeof GRUPOS_CAMPOS)[number];

export interface DefinicaoCampo {
    /** Rótulo canônico, do jeito que aparece no texto: [nome do cliente]. */
    rotulo: string;
    grupo: GrupoCampo;
    descricao: string;
    /** Outras formas aceitas (sem acento, minúsculas), ex.: "cliente", "autor". */
    apelidos?: string[];
    /** Valor a partir do cliente; sem cliente (ou sem o dado) devolve "". */
    resolver: (ctx: ContextoCampos) => string;
}

export interface ContextoCampos {
    /** Cadastro da pessoa (CPF, RG, endereço...). */
    cliente?: Cliente | null;
    /** Caso/processo da carteira (número, banco, valores). */
    calculo: CalculoSalvo | null;
    hoje: Date;
    /** Nome, OAB e cidade de Configurações (sem informar, usa o valor carregado do banco). */
    escritorio?: ConfigEscritorio;
}

const escritorioDe = (ctx: ContextoCampos) => ctx.escritorio ?? configEscritorioAtual();

const MESES_EXTENSO = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
];

export function dataPorExtenso(d: Date): string {
    return `${d.getDate()} de ${MESES_EXTENSO[d.getMonth()]} de ${d.getFullYear()}`;
}

function dataBr(d: Date): string {
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/* ------------------------------------------------------- Valor por extenso */

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = [
    "dez",
    "onze",
    "doze",
    "treze",
    "quatorze",
    "quinze",
    "dezesseis",
    "dezessete",
    "dezoito",
    "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
    "",
    "cento",
    "duzentos",
    "trezentos",
    "quatrocentos",
    "quinhentos",
    "seiscentos",
    "setecentos",
    "oitocentos",
    "novecentos",
];

function ate999(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cem";
    const c = Math.floor(n / 100);
    const resto = n % 100;
    const partes: string[] = [];
    if (c) partes.push(CENTENAS[c]);
    if (resto >= 10 && resto < 20) {
        partes.push(DEZ_A_DEZENOVE[resto - 10]);
    } else {
        const d = Math.floor(resto / 10);
        const u = resto % 10;
        if (d) partes.push(DEZENAS[d]);
        if (u) partes.push(UNIDADES[u]);
    }
    return partes.join(" e ");
}

const ESCALAS: Array<[string, string]> = [
    ["", ""],
    ["mil", "mil"],
    ["milhão", "milhões"],
    ["bilhão", "bilhões"],
    ["trilhão", "trilhões"],
];

function inteiroPorExtenso(n: number): string {
    if (n === 0) return "zero";
    const grupos: number[] = [];
    let r = n;
    while (r > 0) {
        grupos.push(r % 1000);
        r = Math.floor(r / 1000);
    }
    if (grupos.length > ESCALAS.length) return "";
    const partes: Array<{ texto: string; valor: number }> = [];
    for (let i = grupos.length - 1; i >= 0; i--) {
        const g = grupos[i];
        if (!g) continue;
        let texto: string;
        if (i === 1) texto = g === 1 ? "mil" : `${ate999(g)} mil`;
        else if (i >= 2) texto = `${ate999(g)} ${g === 1 ? ESCALAS[i][0] : ESCALAS[i][1]}`;
        else texto = ate999(g);
        partes.push({ texto, valor: g });
    }
    // "e" antes do último grupo quando ele é < 100 ou centena redonda (mil e cem, mil e vinte);
    // nos demais casos, vírgula (mil, duzentos e trinta).
    return partes
        .map((p, idx) => {
            if (idx === 0) return p.texto;
            const ultimo = idx === partes.length - 1;
            const usaE = ultimo && (p.valor < 100 || p.valor % 100 === 0);
            return usaE ? ` e ${p.texto}` : `, ${p.texto}`;
        })
        .join("");
}

/** 1234.56 → "mil, duzentos e trinta e quatro reais e cinquenta e seis centavos". */
export function valorPorExtenso(valor: number): string {
    if (!Number.isFinite(valor) || valor < 0 || valor >= 1e15) return "";
    const totalCentavos = Math.round(valor * 100);
    const reais = Math.floor(totalCentavos / 100);
    const centavos = totalCentavos % 100;
    const partes: string[] = [];
    if (reais > 0) {
        const extensoReais = inteiroPorExtenso(reais);
        if (!extensoReais) return "";
        const redondoMilhao = reais >= 1_000_000 && reais % 1_000_000 === 0;
        partes.push(`${extensoReais}${redondoMilhao ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
    }
    if (centavos > 0) {
        partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
    }
    if (partes.length === 0) return "zero real";
    return partes.join(" e ");
}

/* ------------------------------------------------------- Campos conhecidos */

const djen = (ctx: ContextoCampos) => (ctx.calculo ? lerDadosProcessoDjen(ctx.calculo) : null);
const valorMonetario = (v: number | null | undefined) => (v && Number.isFinite(v) && v > 0 ? brl(v) : "");

export const CAMPOS_DOCUMENTO: DefinicaoCampo[] = [
    {
        rotulo: "nome do cliente",
        grupo: "Cliente",
        descricao: "Nome do cliente",
        apelidos: ["cliente", "nome", "autor", "autora", "requerente", "nome cliente", "outorgante"],
        resolver: ({ cliente, calculo }) => cliente?.nome?.trim() || calculo?.cliente_nome?.trim() || "",
    },
    {
        rotulo: "qualificação completa",
        grupo: "Cliente",
        descricao: "Parágrafo inteiro: nome, nacionalidade, estado civil, profissão, RG, CPF e endereço",
        apelidos: ["qualificacao", "qualificacao do cliente", "qualificacao da parte"],
        resolver: ({ cliente }) => (cliente ? qualificacaoCompleta(cliente) : ""),
    },
    {
        rotulo: "CPF do cliente",
        grupo: "Cliente",
        descricao: "CPF (ou CNPJ, se for empresa)",
        apelidos: ["cpf", "cnpj", "cpf cnpj", "cnpj do cliente", "documento do cliente"],
        resolver: ({ cliente }) => (cliente?.cpf_cnpj ? formatarCpfCnpj(cliente.cpf_cnpj) : ""),
    },
    {
        rotulo: "RG do cliente",
        grupo: "Cliente",
        descricao: "RG com órgão emissor",
        apelidos: ["rg"],
        resolver: ({ cliente }) =>
            cliente?.rg ? [cliente.rg.trim(), cliente.rg_orgao.trim().toUpperCase()].filter(Boolean).join(" ") : "",
    },
    {
        rotulo: "nacionalidade",
        grupo: "Cliente",
        descricao: "Ex.: brasileiro / brasileira",
        resolver: ({ cliente }) => (cliente ? nacionalidadeFlexionada(cliente.nacionalidade, cliente.genero) : ""),
    },
    {
        rotulo: "estado civil",
        grupo: "Cliente",
        descricao: "Ex.: casado / casada",
        resolver: ({ cliente }) => (cliente?.estado_civil ? estadoCivilPorExtenso(cliente.estado_civil, cliente.genero) : ""),
    },
    {
        rotulo: "profissão",
        grupo: "Cliente",
        descricao: "Profissão do cliente",
        apelidos: ["profissao do cliente"],
        resolver: ({ cliente }) => cliente?.profissao?.trim().toLowerCase() ?? "",
    },
    {
        rotulo: "endereço do cliente",
        grupo: "Cliente",
        descricao: "Rua, nº, bairro, cidade/UF e CEP",
        apelidos: ["endereco", "endereco completo"],
        resolver: ({ cliente }) => (cliente ? enderecoCompleto(cliente) : ""),
    },
    {
        rotulo: "cidade do cliente",
        grupo: "Cliente",
        descricao: "Cidade/UF do cliente",
        resolver: ({ cliente }) => (cliente ? [cliente.cidade.trim(), cliente.uf.trim()].filter(Boolean).join("/") : ""),
    },
    {
        rotulo: "CEP do cliente",
        grupo: "Cliente",
        descricao: "CEP do endereço",
        resolver: ({ cliente }) => (cliente?.cep ? formatarCep(cliente.cep) : ""),
    },
    {
        rotulo: "telefone do cliente",
        grupo: "Cliente",
        descricao: "Telefone / WhatsApp",
        apelidos: ["telefone", "whatsapp"],
        resolver: ({ cliente }) => (cliente?.telefone ? formatarTelefone(cliente.telefone) : ""),
    },
    {
        rotulo: "e-mail do cliente",
        grupo: "Cliente",
        descricao: "E-mail do cliente",
        apelidos: ["email", "email do cliente"],
        resolver: ({ cliente }) => cliente?.email?.trim() ?? "",
    },
    {
        rotulo: "representante legal",
        grupo: "Cliente",
        descricao: "Representante da empresa, com CPF",
        apelidos: ["representante"],
        resolver: ({ cliente }) =>
            cliente?.representante_nome
                ? [cliente.representante_nome.trim(), cliente.representante_cpf ? `CPF ${formatarCpf(cliente.representante_cpf)}` : ""]
                      .filter(Boolean)
                      .join(", ")
                : "",
    },
    {
        rotulo: "número do processo",
        grupo: "Processo",
        descricao: "Número CNJ do processo",
        apelidos: ["processo", "numero processo", "numero do processo", "cnj", "numero cnj"],
        resolver: ({ calculo }) => calculo?.processo_global?.trim() ?? "",
    },
    {
        rotulo: "parte contrária",
        grupo: "Processo",
        descricao: "Banco ou parte contrária",
        apelidos: ["banco", "reu", "re", "requerido", "requerida", "parte contraria"],
        resolver: ({ calculo }) => calculo?.banco?.trim() ?? "",
    },
    {
        rotulo: "vara",
        grupo: "Processo",
        descricao: "Órgão julgador (vem das publicações do DJEN)",
        apelidos: ["orgao", "orgao julgador", "juizo", "comarca"],
        resolver: (ctx) => djen(ctx)?.orgao?.trim() ?? "",
    },
    {
        rotulo: "tribunal",
        grupo: "Processo",
        descricao: "Sigla do tribunal (DJEN)",
        resolver: (ctx) => djen(ctx)?.tribunal?.trim() ?? "",
    },
    {
        rotulo: "classe processual",
        grupo: "Processo",
        descricao: "Classe do processo (DJEN)",
        apelidos: ["classe", "tipo de acao"],
        resolver: (ctx) => djen(ctx)?.classe?.trim() ?? "",
    },
    {
        rotulo: "número do contrato",
        grupo: "Contrato e valores",
        descricao: "Documento / número do contrato",
        apelidos: ["contrato", "numero contrato", "documento do contrato"],
        resolver: ({ calculo }) => calculo?.documento_contrato?.trim() ?? "",
    },
    {
        rotulo: "modalidade",
        grupo: "Contrato e valores",
        descricao: "Modalidade do contrato (BACEN)",
        resolver: ({ calculo }) => calculo?.modalidade_nome?.trim() ?? "",
    },
    {
        rotulo: "valor financiado",
        grupo: "Contrato e valores",
        descricao: "Valor financiado do contrato",
        resolver: ({ calculo }) => valorMonetario(calculo?.valor_financiado),
    },
    {
        rotulo: "valor da parcela",
        grupo: "Contrato e valores",
        descricao: "Parcela contratada",
        apelidos: ["parcela"],
        resolver: ({ calculo }) => valorMonetario(calculo?.valor_parcela),
    },
    {
        rotulo: "quantidade de parcelas",
        grupo: "Contrato e valores",
        descricao: "Prazo do contrato",
        apelidos: ["parcelas", "prazo"],
        resolver: ({ calculo }) => (calculo?.parcelas ? String(calculo.parcelas) : ""),
    },
    {
        rotulo: "taxa do contrato",
        grupo: "Contrato e valores",
        descricao: "Taxa mensal do contrato",
        resolver: ({ calculo }) => (calculo?.contrato_am ? `${num(calculo.contrato_am)}% a.m.` : ""),
    },
    {
        rotulo: "taxa média bacen",
        grupo: "Contrato e valores",
        descricao: "Taxa média de mercado no mês do contrato",
        apelidos: ["taxa media", "media bacen"],
        resolver: ({ calculo }) => (calculo?.media_am ? `${num(calculo.media_am)}% a.m.` : ""),
    },
    {
        rotulo: "valor da causa",
        grupo: "Contrato e valores",
        descricao: "Valor total da ação (cálculo pericial)",
        apelidos: ["valor da acao", "valor total da acao"],
        resolver: ({ calculo }) => valorMonetario(calculo?.valor_total_acao),
    },
    {
        rotulo: "valor da causa por extenso",
        grupo: "Contrato e valores",
        descricao: "Valor da ação escrito por extenso",
        apelidos: ["valor da acao por extenso"],
        resolver: ({ calculo }) =>
            calculo?.valor_total_acao && calculo.valor_total_acao > 0 ? valorPorExtenso(calculo.valor_total_acao) : "",
    },
    {
        rotulo: "data de hoje",
        grupo: "Escritório e data",
        descricao: "Data no formato 20/11/2026",
        apelidos: ["data", "hoje"],
        resolver: ({ hoje }) => dataBr(hoje),
    },
    {
        rotulo: "data por extenso",
        grupo: "Escritório e data",
        descricao: "Data no formato 20 de novembro de 2026",
        resolver: ({ hoje }) => dataPorExtenso(hoje),
    },
    {
        rotulo: "cidade",
        grupo: "Escritório e data",
        descricao: "Cidade do escritório (Configurações)",
        resolver: (ctx) => cidadeAssinatura(escritorioDe(ctx)),
    },
    {
        rotulo: "advogado",
        grupo: "Escritório e data",
        descricao: "Nome do advogado (Configurações)",
        apelidos: ["nome do advogado"],
        resolver: (ctx) => escritorioDe(ctx).nomeAdvogado,
    },
    {
        rotulo: "oab",
        grupo: "Escritório e data",
        descricao: "Inscrição na OAB (Configurações)",
        resolver: (ctx) => formatarOab(escritorioDe(ctx)),
    },
    {
        rotulo: "assinatura",
        grupo: "Escritório e data",
        descricao: "Bloco de assinatura do advogado (rubrica, Nome, OAB e carimbo ICP-Brasil)",
        apelidos: ["assinatura advogado", "assinatura digital", "assinatura do advogado"],
        resolver: (ctx) => `${escritorioDe(ctx).nomeAdvogado} — ${formatarOab(escritorioDe(ctx))}`,
    },
];

/** Minúsculas, sem acento, "nº" vira "numero", sem pontuação, espaços colapsados. */
export interface GrupoDocumentosCliente<T> {
    /** Nome normalizado do cliente ("" = documentos sem cliente). */
    chave: string;
    nome: string | null;
    itens: T[];
    /** updated_at mais recente do grupo (ISO). */
    ultimaEdicao: string;
}

/**
 * Agrupa documentos por cliente (nome normalizado: o mesmo cliente ligado por cadastro ou por caso cai
 * no mesmo grupo). Dentro do grupo e entre grupos, o mais recente vem primeiro; sem cliente fica no fim.
 */
export function agruparDocumentosPorCliente<T extends { updated_at: string }>(
    itens: T[],
    nomeDoCliente: (item: T) => string | null | undefined,
): GrupoDocumentosCliente<T>[] {
    const grupos = new Map<string, GrupoDocumentosCliente<T>>();
    for (const item of itens) {
        const nome = nomeDoCliente(item)?.trim() || null;
        const chave = nome ? normalizarChaveCampo(nome) : "";
        const grupo = grupos.get(chave);
        if (grupo) {
            grupo.itens.push(item);
            // O grupo exibe o nome como está no documento mais recente.
            if (item.updated_at > grupo.ultimaEdicao) {
                grupo.ultimaEdicao = item.updated_at;
                grupo.nome = nome;
            }
        } else {
            grupos.set(chave, { chave, nome, itens: [item], ultimaEdicao: item.updated_at });
        }
    }
    const lista = [...grupos.values()];
    for (const g of lista) g.itens.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return lista.sort((a, b) => {
        if (!a.chave !== !b.chave) return a.chave ? -1 : 1;
        return b.ultimaEdicao.localeCompare(a.ultimaEdicao);
    });
}

export function normalizarChaveCampo(rotulo: string): string {
    return rotulo
        .replace(/\bn[º°]\.?/gi, "numero ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const INDICE_CAMPOS = (() => {
    const mapa = new Map<string, DefinicaoCampo>();
    for (const c of CAMPOS_DOCUMENTO) {
        mapa.set(normalizarChaveCampo(c.rotulo), c);
        for (const a of c.apelidos ?? []) mapa.set(normalizarChaveCampo(a), c);
    }
    return mapa;
})();

export function acharCampoConhecido(rotulo: string): DefinicaoCampo | null {
    return INDICE_CAMPOS.get(normalizarChaveCampo(rotulo)) ?? null;
}

/**
 * [texto] sem quebra de linha nem tag no meio. Só vale como campo se tiver letra:
 * "[...]" (supressão em citação) não conta.
 */
export const REGEX_CAMPO = /\[([^[\]<>\n]{1,80})\]/g;

export function ehRotuloCampo(interno: string): boolean {
    return /\p{L}/u.test(interno);
}

/** Campos usados no HTML, na ordem em que aparecem, sem repetir (pela chave normalizada). */
export function extrairCampos(html: string): string[] {
    const vistos = new Set<string>();
    const lista: string[] = [];
    for (const m of html.matchAll(REGEX_CAMPO)) {
        const interno = decodificarEntidades(m[1]).trim();
        if (!ehRotuloCampo(interno)) continue;
        const chave = normalizarChaveCampo(interno);
        if (!chave || vistos.has(chave)) continue;
        vistos.add(chave);
        lista.push(interno);
    }
    return lista;
}

/** Valores sugeridos para cada campo (chave normalizada → valor). Desconhecidos vêm vazios. */
export function valoresIniciaisCampos(campos: string[], ctx: ContextoCampos): Record<string, string> {
    const out: Record<string, string> = {};
    for (const rotulo of campos) {
        const def = acharCampoConhecido(rotulo);
        out[normalizarChaveCampo(rotulo)] = def ? def.resolver(ctx) : "";
    }
    return out;
}

export function escaparHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const TAGS_PERMITIDAS_DOC = new Set([
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "sub",
    "sup",
    "br",
    "hr",
    "ul",
    "ol",
    "li",
    "blockquote",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "colgroup",
    "col",
    "span",
    "div",
    "a",
]);

const TAGS_DESCARTAR_CONTEUDO = new Set([
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "applet",
    "svg",
    "math",
    "template",
    "noscript",
    "title",
    "textarea",
    "form",
    "input",
    "button",
    "select",
    "meta",
    "link",
    "base",
]);

function sanitizarEstiloSeguro(rawStyle: string): string {
    const declaracoes: string[] = [];
    for (const parte of rawStyle.split(";")) {
        const idx = parte.indexOf(":");
        if (idx <= 0) continue;
        const prop = parte.slice(0, idx).trim().toLowerCase();
        const val = parte.slice(idx + 1).trim();
        if (!val || /url\s*\(|expression\s*\(|@import|javascript:|behavior/i.test(val)) continue;
        if (prop === "text-align" && /^(left|center|right|justify|start|end)$/i.test(val)) {
            declaracoes.push(`text-align: ${val.toLowerCase()}`);
        } else if (prop === "font-size" && /^\d+(?:\.\d+)?(?:pt|px|em|rem|%)$/i.test(val)) {
            declaracoes.push(`font-size: ${val.toLowerCase()}`);
        } else if (prop === "font-family" && /^[a-zA-Z0-9\s,'"-]{1,120}$/.test(val)) {
            declaracoes.push(`font-family: ${val}`);
        } else if (
            (prop === "margin-left" || prop === "margin-right") &&
            /^(?:0|-?\d+(?:\.\d+)?(?:cm|mm|pt|px|em|rem))$/i.test(val)
        ) {
            declaracoes.push(`${prop}: ${val.toLowerCase()}`);
        } else if (
            (prop === "margin-top" ||
                prop === "margin-bottom" ||
                prop === "padding-left" ||
                prop === "padding-right") &&
            /^(?:0|\d+(?:\.\d+)?(?:cm|mm|pt|px|em|rem))$/i.test(val)
        ) {
            declaracoes.push(`${prop}: ${val.toLowerCase()}`);
        } else if (prop === "text-indent" && /^(?:0|-?\d+(?:\.\d+)?(?:cm|mm|pt|px|em|rem))$/i.test(val)) {
            declaracoes.push(`text-indent: ${val.toLowerCase()}`);
        } else if (prop === "tab-size" && /^\d+(?:\.\d+)?(?:cm|mm|pt|px)$/i.test(val)) {
            declaracoes.push(`tab-size: ${val.toLowerCase()}`);
        } else if (prop === "line-height" && /^\d+(?:\.\d+)?(?:em|pt|px|%)?$/i.test(val)) {
            declaracoes.push(`line-height: ${val.toLowerCase()}`);
        } else if (
            (prop === "color" || prop === "background-color") &&
            /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|[a-z]{3,20})$/i.test(
                val,
            )
        ) {
            declaracoes.push(`${prop}: ${val}`);
        }
    }
    return declaracoes.join("; ");
}

function sanitizarHrefDocumento(rawHref: string): string | null {
    const limpo = rawHref.trim();
    if (!limpo) return null;
    try {
        const u = new URL(limpo, "https://www.iangranja.adv.br");
        if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:") {
            return limpo;
        }
    } catch {
        return null;
    }
    return null;
}

interface DomNodeLike {
    nodeType: number;
    textContent: string | null;
    childNodes: ArrayLike<DomNodeLike>;
}

interface DomElementLike extends DomNodeLike {
    tagName: string;
    innerHTML: string;
    getAttribute(name: string): string | null;
    hasAttribute(name: string): boolean;
    setAttribute(name: string, value: string): void;
    appendChild(child: DomNodeLike): void;
}

interface DomDocumentLike {
    body: DomElementLike;
    createTextNode(text: string): DomNodeLike;
    createDocumentFragment(): DomElementLike;
    createElement(tag: string): DomElementLike;
}

interface DomGlobalLike {
    DOMParser?: new () => { parseFromString(src: string, mime: string): DomDocumentLike };
    document?: DomDocumentLike;
}

/**
 * Sanitiza HTML de modelos e documentos (defesa contra Stored XSS em impressão, Word e cópia).
 * No navegador reconstrói a árvore via DOMParser usando allowlist estrita compatível com TipTap;
 * em ambiente Node (sem DOM) aplica sanitização defensiva removendo tags/atributos/protocolos perigosos.
 */
export function sanitizarHtmlDocumento(html: string): string {
    if (!html) return "";
    const g = globalThis as unknown as DomGlobalLike;
    if (typeof g.DOMParser === "function" && g.document) {
        const docRef = g.document;
        const parsed = new g.DOMParser().parseFromString(html, "text/html");
        const limparNo = (node: DomNodeLike): DomNodeLike | null => {
            if (node.nodeType === 3) {
                return docRef.createTextNode(node.textContent ?? "");
            }
            if (node.nodeType !== 1) return null;
            const el = node as DomElementLike;
            const tag = el.tagName.toLowerCase();
            if (TAGS_DESCARTAR_CONTEUDO.has(tag)) return null;

            if (!TAGS_PERMITIDAS_DOC.has(tag)) {
                const frag = docRef.createDocumentFragment();
                for (const filho of Array.from(el.childNodes)) {
                    const limpo = limparNo(filho);
                    if (limpo) frag.appendChild(limpo);
                }
                return frag;
            }

            const novo = docRef.createElement(tag);
            const style = el.getAttribute("style");
            if (style) {
                const styleLimpo = sanitizarEstiloSeguro(style);
                if (styleLimpo) novo.setAttribute("style", styleLimpo);
            }
            if (tag === "div" && el.hasAttribute("data-quebra-pagina")) {
                novo.setAttribute("data-quebra-pagina", el.getAttribute("data-quebra-pagina") || "");
            }
            if (tag === "div" && el.hasAttribute("data-assinatura-advogado")) {
                novo.setAttribute("data-assinatura-advogado", "true");
                const alin = (el.getAttribute("data-alinhamento") ?? "").toLowerCase();
                if (/^(left|center|right)$/.test(alin)) novo.setAttribute("data-alinhamento", alin);
                const mData = (el.getAttribute("data-mostrar-data") ?? "").toLowerCase();
                if (/^(true|false)$/.test(mData)) novo.setAttribute("data-mostrar-data", mData);
                const mSelo = (el.getAttribute("data-mostrar-selo") ?? "").toLowerCase();
                if (/^(true|false)$/.test(mSelo)) novo.setAttribute("data-mostrar-selo", mSelo);
            }
            if (tag === "td" || tag === "th") {
                const colspan = el.getAttribute("colspan");
                const rowspan = el.getAttribute("rowspan");
                if (colspan && /^\d+$/.test(colspan)) novo.setAttribute("colspan", colspan);
                if (rowspan && /^\d+$/.test(rowspan)) novo.setAttribute("rowspan", rowspan);
            }
            if (tag === "a") {
                const href = sanitizarHrefDocumento(el.getAttribute("href") ?? "");
                if (href) {
                    novo.setAttribute("href", href);
                    novo.setAttribute("rel", "noopener noreferrer nofollow");
                }
            }
            for (const filho of Array.from(el.childNodes)) {
                const limpo = limparNo(filho);
                if (limpo) novo.appendChild(limpo);
            }
            return novo;
        };

        const container = docRef.createElement("div");
        for (const filho of Array.from(parsed.body.childNodes)) {
            const limpo = limparNo(filho);
            if (limpo) container.appendChild(limpo);
        }
        return container.innerHTML;
    }

    // Fallback para ambientes sem DOM (testes Node / SSR): remove tags perigosas, handlers e protocolos inseguros.
    let limpo = html
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(
            /<(script|style|iframe|object|embed|applet|svg|math|template|noscript|form|textarea|title)\b[^>]*>[\s\S]*?<\/\1>/gi,
            "",
        )
        .replace(
            /<\/?(script|style|iframe|object|embed|applet|svg|math|template|noscript|form|input|button|select|meta|link|base)\b[^>]*\/?>/gi,
            "",
        );

    limpo = limpo.replace(/<(\/?)([a-zA-Z0-9-]+)([^>]*)>/g, (_full, barra: string, tagRaw: string, attrsRaw: string) => {
        const tag = tagRaw.toLowerCase();
        if (!TAGS_PERMITIDAS_DOC.has(tag)) return "";
        if (barra) return `</${tag}>`;
        const attrsSaida: string[] = [];
        const attrRe = /([a-zA-Z0-9:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
        let m: RegExpExecArray | null;
        while ((m = attrRe.exec(attrsRaw)) !== null) {
            const nome = m[1].toLowerCase();
            const valor = m[2] ?? m[3] ?? m[4] ?? "";
            if (nome === "style") {
                const st = sanitizarEstiloSeguro(valor);
                if (st) attrsSaida.push(`style="${escaparHtml(st)}"`);
            } else if (tag === "div" && nome === "data-quebra-pagina") {
                attrsSaida.push(`data-quebra-pagina="${escaparHtml(valor)}"`);
            } else if (tag === "div" && nome === "data-assinatura-advogado") {
                attrsSaida.push('data-assinatura-advogado="true"');
            } else if (tag === "div" && nome === "data-alinhamento" && /^(?:left|center|right)$/i.test(valor)) {
                attrsSaida.push(`data-alinhamento="${valor.toLowerCase()}"`);
            } else if (
                tag === "div" &&
                (nome === "data-mostrar-data" || nome === "data-mostrar-selo") &&
                /^(?:true|false)$/i.test(valor)
            ) {
                attrsSaida.push(`${nome}="${valor.toLowerCase()}"`);
            } else if ((tag === "td" || tag === "th") && (nome === "colspan" || nome === "rowspan") && /^\d+$/.test(valor)) {
                attrsSaida.push(`${nome}="${valor}"`);
            } else if (tag === "a" && nome === "href") {
                const href = sanitizarHrefDocumento(valor);
                if (href) {
                    attrsSaida.push(`href="${escaparHtml(href)}"`);
                    attrsSaida.push(`rel="noopener noreferrer nofollow"`);
                }
            }
        }
        return attrsSaida.length > 0 ? `<${tag} ${attrsSaida.join(" ")}>` : `<${tag}>`;
    });
    return limpo;
}

function decodificarEntidades(s: string): string {
    return s
        .replace(/&nbsp;/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}

export type AlinhamentoAssinatura = "left" | "center" | "right";

export interface OpcoesBlocoAssinatura {
    alinhamento?: AlinhamentoAssinatura;
    mostrarData?: boolean;
    mostrarSelo?: boolean;
}

export function montarHtmlBlocoAssinatura(opcoes: OpcoesBlocoAssinatura = {}): string {
    const alinhamento: AlinhamentoAssinatura =
        opcoes.alinhamento === "left" || opcoes.alinhamento === "right" ? opcoes.alinhamento : "center";
    const mostrarData = opcoes.mostrarData !== false;
    const mostrarSelo = opcoes.mostrarSelo !== false;
    return `<div data-assinatura-advogado="true" data-alinhamento="${alinhamento}" data-mostrar-data="${mostrarData}" data-mostrar-selo="${mostrarSelo}"></div>`;
}

export const HTML_BLOCO_ASSINATURA_PADRAO = montarHtmlBlocoAssinatura();

function valorCampoAssinatura(rotulo: string, valores: Record<string, string>): string | null {
    const def = acharCampoConhecido(rotulo);
    if (def?.rotulo !== "assinatura") return null;
    const chave = normalizarChaveCampo(rotulo);
    return (valores[chave] ?? valores["assinatura"] ?? "").trim();
}

const TAGS_VAZIAS_HTML = new Set(["br", "img", "hr", "wbr", "input", "col", "area", "source"]);

/** Quantas tags continuam abertas ao fim do trecho (0 = o ponto está direto dentro do parágrafo). */
function profundidadeTagsAbertas(trecho: string): number {
    let d = 0;
    for (const m of trecho.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g)) {
        if (m[3] || TAGS_VAZIAS_HTML.has(m[2].toLowerCase())) continue;
        d += m[1] ? -1 : 1;
    }
    return d;
}

function temConteudoVisivel(trecho: string): boolean {
    if (/<img\b/i.test(trecho)) return true;
    return decodificarEntidades(trecho.replace(/<[^>]*>/g, "")).replace(/\u00a0/g, " ").trim() !== "";
}

function alinhamentoDeAtributos(attrs: string): AlinhamentoAssinatura {
    const m = attrs.match(/text-align:\s*(left|center|right)/i);
    return m ? (m[1].toLowerCase() as AlinhamentoAssinatura) : "center";
}

/**
 * Troca cada [campo] pelo valor informado. Campo sem valor fica como está, para o advogado ver
 * o que falta preencher no editor (o editor destaca os colchetes restantes).
 * O campo [assinatura] vira o bloco completo de assinatura do advogado quando preenchido:
 * - sozinho no parágrafo (mesmo em negrito/itálico): o parágrafo vira o bloco, com o alinhamento dele;
 * - direto no parágrafo junto de outro texto: o parágrafo é dividido e os dois lados mantêm os atributos;
 * - dentro de formatação no meio do texto, título ou célula sem parágrafo: vira o texto "Nome — OAB",
 *   para nunca gerar HTML com tags cruzadas.
 */
export function preencherModelo(html: string, valores: Record<string, string>): string {
    const assinaturaPreenchida = (interno: string) => {
        const rotulo = decodificarEntidades(interno).trim();
        return ehRotuloCampo(rotulo) && Boolean(valorCampoAssinatura(rotulo, valores));
    };

    let saida = html.replace(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/gi, (inteiro, attrsRaw: string | undefined, inner: string) => {
        const attrs = attrsRaw ?? "";
        const bloco = () => montarHtmlBlocoAssinatura({ alinhamento: alinhamentoDeAtributos(attrs) });

        const soTexto = decodificarEntidades(inner.replace(/<[^>]*>/g, "")).trim();
        const mSo = /^\[([^[\]<>\n]{1,80})\]$/.exec(soTexto);
        if (mSo && assinaturaPreenchida(mSo[1])) return bloco();

        const pedacos: string[] = [];
        let ultimo = 0;
        for (const m of inner.matchAll(new RegExp(REGEX_CAMPO.source, "g"))) {
            const idx = m.index ?? 0;
            if (!assinaturaPreenchida(m[1])) continue;
            // Dentro de <strong>/<em>/...: dividir aqui cruzaria as tags; o passo seguinte põe o texto.
            if (profundidadeTagsAbertas(inner.slice(0, idx)) !== 0) continue;
            const antes = inner.slice(ultimo, idx);
            if (temConteudoVisivel(antes)) pedacos.push(`<p${attrs}>${antes}</p>`);
            pedacos.push(bloco());
            ultimo = idx + m[0].length;
        }
        if (pedacos.length === 0) return inteiro;
        const depois = inner.slice(ultimo);
        if (temConteudoVisivel(depois)) pedacos.push(`<p${attrs}>${depois}</p>`);
        return pedacos.join("");
    });

    saida = saida.replace(REGEX_CAMPO, (inteiro, interno: string) => {
        const rotulo = decodificarEntidades(interno).trim();
        if (!ehRotuloCampo(rotulo)) return inteiro;
        const valAss = valorCampoAssinatura(rotulo, valores);
        if (valAss !== null) return valAss ? escaparHtml(valAss) : inteiro;
        const valor = valores[normalizarChaveCampo(rotulo)];
        return valor && valor.trim() ? escaparHtml(valor.trim()) : inteiro;
    });

    return saida;
}

/* ------------------------------------------------------- Página (papel e margens) */

export type FormatoPapel = "a4" | "oficio" | "carta";

export interface MargensPagina {
    superior: number;
    inferior: number;
    esquerda: number;
    direita: number;
}

/** Papel, margens (em cm) e papel timbrado de um modelo ou documento. */
export interface ConfigPagina {
    formato: FormatoPapel;
    margens: MargensPagina;
    /** Exibe o cabeçalho e o rodapé timbrados do escritório em todas as páginas. */
    timbrado: boolean;
}

export const FORMATOS_PAPEL: Record<FormatoPapel, { rotulo: string; curto: string; larguraCm: number; alturaCm: number }> = {
    a4: { rotulo: "A4 (21 × 29,7 cm)", curto: "A4", larguraCm: 21, alturaCm: 29.7 },
    oficio: { rotulo: "Ofício (21,6 × 33 cm)", curto: "Ofício", larguraCm: 21.6, alturaCm: 33 },
    carta: { rotulo: "Carta (21,6 × 27,9 cm)", curto: "Carta", larguraCm: 21.59, alturaCm: 27.94 },
};

export const PREDEFINICOES_MARGEM: Array<{ id: string; rotulo: string; curto: string; margens: MargensPagina }> = [
    { id: "abnt", rotulo: "ABNT / Forense (3 cm sup./esq., 2 cm inf./dir.)", curto: "ABNT", margens: { superior: 3, inferior: 2, esquerda: 3, direita: 2 } },
    { id: "normal", rotulo: "Normal do Word (2,5 cm)", curto: "Normal", margens: { superior: 2.5, inferior: 2.5, esquerda: 2.5, direita: 2.5 } },
    { id: "moderada", rotulo: "Moderada (2,54 cm sup./inf., 1,91 cm lat.)", curto: "Moderada", margens: { superior: 2.54, inferior: 2.54, esquerda: 1.91, direita: 1.91 } },
    { id: "larga", rotulo: "Larga (2,54 cm sup./inf., 5,08 cm lat.)", curto: "Larga", margens: { superior: 2.54, inferior: 2.54, esquerda: 5.08, direita: 5.08 } },
    { id: "estreita", rotulo: "Estreita (1,27 cm)", curto: "Estreita", margens: { superior: 1.27, inferior: 1.27, esquerda: 1.27, direita: 1.27 } },
    { id: "encadernacao", rotulo: "Autos físicos / Encadernação (3,5 cm esq.)", curto: "Autos", margens: { superior: 3, inferior: 2, esquerda: 3.5, direita: 2 } },
];

export const CONFIG_PAGINA_PADRAO: ConfigPagina = {
    formato: "a4",
    margens: { ...PREDEFINICOES_MARGEM[0].margens },
    timbrado: true,
};

const MARGEM_MIN_CM = 0.5;
const MARGEM_MAX_CM = 6;
/** Espaço mínimo reservado no topo e na base quando o papel timbrado está ativo (em cm). */
export const MARGEM_SUP_TIMBRADO_CM = 3.2;
export const MARGEM_INF_TIMBRADO_CM = 2.4;

function margemValida(v: unknown, padrao: number): number {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
    if (!Number.isFinite(n)) return padrao;
    return Math.round(Math.min(MARGEM_MAX_CM, Math.max(MARGEM_MIN_CM, n)) * 100) / 100;
}

/** Aceita qualquer coisa vinda do banco/formulário e devolve uma configuração válida. */
export function normalizarConfigPagina(raw: unknown): ConfigPagina {
    const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const formato: FormatoPapel =
        typeof obj.formato === "string" && obj.formato in FORMATOS_PAPEL ? (obj.formato as FormatoPapel) : "a4";
    const m = obj.margens && typeof obj.margens === "object" ? (obj.margens as Record<string, unknown>) : {};
    const p = CONFIG_PAGINA_PADRAO.margens;
    return {
        formato,
        margens: {
            superior: margemValida(m.superior, p.superior),
            inferior: margemValida(m.inferior, p.inferior),
            esquerda: margemValida(m.esquerda, p.esquerda),
            direita: margemValida(m.direita, p.direita),
        },
        // Sem configuração nenhuma (novo modelo) vale o padrão com timbrado; registros salvos antes do
        // timbrado existir não têm o campo e continuam em folha limpa, sem mudar layout nem paginação.
        timbrado: raw && typeof raw === "object" ? obj.timbrado === true : CONFIG_PAGINA_PADRAO.timbrado,
    };
}

/**
 * Margens efetivas de texto considerando o timbrado:
 * - No timbrado padrão do sistema, garante espaço mínimo para o cabeçalho/rodapé desenhados.
 * - Com imagem A4 importada pelo escritório, respeita exatamente as margens escolhidas pelo usuário.
 */
export function margensEfetivas(c: ConfigPagina, temImagemPersonalizada = false): MargensPagina {
    if (!c.timbrado || temImagemPersonalizada) return c.margens;
    return {
        superior: Math.max(c.margens.superior, MARGEM_SUP_TIMBRADO_CM),
        inferior: Math.max(c.margens.inferior, MARGEM_INF_TIMBRADO_CM),
        esquerda: c.margens.esquerda,
        direita: c.margens.direita,
    };
}

export interface DadosTimbrado {
    tituloEscritorio: string;
    subtituloEscritorio: string;
    advogado: string;
    oab: string;
    endereco: string;
    contato: string;
}

/** Textos exibidos no cabeçalho e rodapé do papel timbrado (acompanha Configurações do escritório). */
export function dadosTimbradoEscritorio(cfg: ConfigEscritorio = configEscritorioAtual()): DadosTimbrado {
    return {
        tituloEscritorio: "IAN GRANJA",
        subtituloEscritorio: "ADVOGADOS",
        advogado: cfg.nomeAdvogado,
        oab: formatarOab(cfg),
        endereco: `Av. Cardoso de Sá, 860, sala 5 · Centro Empresarial Sergio Cabral · ${cidadeAssinatura(cfg)}`,
        contato: "(87) 9 8844-8690 · contato@iangranja.adv.br · www.iangranja.adv.br",
    };
}

export function idPredefinicaoMargem(m: MargensPagina): string {
    const achada = PREDEFINICOES_MARGEM.find(
        (p) =>
            p.margens.superior === m.superior &&
            p.margens.inferior === m.inferior &&
            p.margens.esquerda === m.esquerda &&
            p.margens.direita === m.direita,
    );
    return achada?.id ?? "personalizada";
}

const fmtCm = (n: number) => String(n).replace(".", ",");

/** "A4 · ABNT" / "Ofício · 2,5 / 2,5 / 2,5 / 2,5 cm". */
export function resumoConfigPagina(c: ConfigPagina): string {
    const id = idPredefinicaoMargem(c.margens);
    const achada = PREDEFINICOES_MARGEM.find((p) => p.id === id);
    const margens =
        achada?.curto ??
        `${fmtCm(c.margens.superior)}/${fmtCm(c.margens.direita)}/${fmtCm(c.margens.inferior)}/${fmtCm(c.margens.esquerda)} cm`;
    return `${FORMATOS_PAPEL[c.formato].curto} · ${margens}`;
}

export const PX_POR_CM = 96 / 2.54;

/** Medidas da folha em px (96 dpi) para desenhar as páginas no editor. */
export interface GeometriaPagina {
    largura: number;
    altura: number;
    margemSuperior: number;
    margemInferior: number;
    margemEsquerda: number;
    margemDireita: number;
    /** Espaço cinza entre uma folha e outra. */
    intervalo: number;
}

export function geometriaDaPagina(
    c: ConfigPagina,
    intervalo = 32,
    temImagemPersonalizada = false,
): GeometriaPagina {
    const papel = FORMATOS_PAPEL[c.formato];
    const m = margensEfetivas(c, temImagemPersonalizada);
    return {
        largura: papel.larguraCm * PX_POR_CM,
        altura: papel.alturaCm * PX_POR_CM,
        margemSuperior: m.superior * PX_POR_CM,
        margemInferior: m.inferior * PX_POR_CM,
        margemEsquerda: m.esquerda * PX_POR_CM,
        margemDireita: m.direita * PX_POR_CM,
        intervalo,
    };
}

/* ------------------------------------------------------- Exportação */

const ESTILO_TEXTO_DOCUMENTO = `
  body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 0; }
  p { margin: 0; min-height: 1.5em; widows: 1; orphans: 1; }
  .doc-corpo { tab-size: 1.25cm; }
  .doc-corpo p, .doc-corpo h1, .doc-corpo h2, .doc-corpo h3, .doc-corpo li, .doc-corpo td, .doc-corpo th { white-space: pre-wrap; }
  h1 { font-size: 16pt; margin: 0 0 8pt; }
  h2 { font-size: 14pt; margin: 0 0 6pt; }
  h3 { font-size: 12pt; margin: 0 0 6pt; }
  ul, ol { margin: 0 0 0 1.5cm; padding: 0; }
  blockquote { margin: 0 0 0 4cm; font-size: 10pt; line-height: 1.15; }
  hr { border: 0; border-top: 1px solid #000; margin: 12pt 0; }
  .doc-corpo table { border-collapse: collapse; width: 100%; }
  .doc-corpo td, .doc-corpo th { border: 1px solid #000; padding: 4pt 6pt; vertical-align: top; }
  sup, sub { font-size: 75%; line-height: 0; position: relative; vertical-align: baseline; }
  sup { top: -0.45em; }
  sub { bottom: -0.25em; }
  .doc-assinatura { page-break-inside: avoid; break-inside: avoid; margin: 18pt 0 6pt; }
  div[data-quebra-pagina] { break-after: page; page-break-after: always; height: 0; }
`;

const REGEX_BLOCO_ASSINATURA = /<div\b([^>]*\bdata-assinatura-advogado\b[^>]*)>(?:\s*<\/div>)?/gi;

function lerAtributoTag(attrs: string, nome: string): string {
    const m = attrs.match(new RegExp(`\\b${nome}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
    return (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").trim();
}

/**
 * Expande cada `<div data-assinatura-advogado="true" ...>` no bloco visual de assinatura
 * (local/data, rubrica opcional, linha, Nome, OAB e selo ICP-Brasil) para impressão, PDF ou Word.
 */
export function expandirBlocosAssinaturaHtml(
    htmlSeguro: string,
    opcoes: { escritorio?: ConfigEscritorio; hoje?: Date; modoWord?: boolean } = {},
): string {
    if (!htmlSeguro || !htmlSeguro.includes("data-assinatura-advogado")) return htmlSeguro;
    const cfg = opcoes.escritorio ?? configEscritorioAtual();
    const hoje = opcoes.hoje ?? new Date();
    const rubrica = logoSrcSeguro(cfg.assinaturaImagemUrl);
    const nomeEsc = escaparHtml(cfg.nomeAdvogado);
    const oabEsc = escaparHtml(formatarOab(cfg));
    const localDataEsc = escaparHtml(`${cidadeAssinatura(cfg)}, ${dataPorExtenso(hoje)}.`);

    return htmlSeguro.replace(REGEX_BLOCO_ASSINATURA, (_full, attrs: string) => {
        const alinRaw = lerAtributoTag(attrs, "data-alinhamento").toLowerCase();
        const alin: AlinhamentoAssinatura = alinRaw === "left" || alinRaw === "right" ? alinRaw : "center";
        const mostrarData = lerAtributoTag(attrs, "data-mostrar-data").toLowerCase() !== "false";
        const mostrarSelo = lerAtributoTag(attrs, "data-mostrar-selo").toLowerCase() !== "false";

        const dataHtml = mostrarData
            ? `<p style="margin:0 0 ${rubrica ? "6pt" : "24pt"} 0;font-size:12pt;">${localDataEsc}</p>`
            : rubrica
              ? ""
              : `<p style="margin:0;height:20pt;">&nbsp;</p>`;

        const rubricaHtml = rubrica
            ? `<div style="margin:0 0 2pt 0;text-align:center;"><img src="${escaparHtml(rubrica)}" alt="Assinatura" style="max-height:1.7cm;max-width:6.5cm;object-fit:contain;display:inline-block;" /></div>`
            : "";

        const seloHtml = mostrarSelo
            ? `<div style="margin-top:5pt;display:inline-block;padding:2pt 7pt;border:0.75pt solid #8b6d3b;background:#faf7f0;font-family:Arial,sans-serif;font-size:7.5pt;letter-spacing:0.04em;color:#061237;">Espaço para assinatura digital · <strong>ICP-Brasil</strong></div>`
            : "";

        const miolo = `${rubricaHtml}<div style="border-top:1px solid #000;width:7.5cm;margin:0 auto;padding-top:4pt;text-align:center;"><div style="font-weight:700;font-size:11.5pt;line-height:1.3;">${nomeEsc}</div><div style="font-size:10.5pt;line-height:1.3;">${oabEsc}</div></div>${seloHtml}`;

        if (opcoes.modoWord) {
            const pDataWord = mostrarData
                ? `<p style="margin:0 0 ${rubrica ? "6pt" : "22pt"} 0;text-align:${alin};">${localDataEsc}</p>`
                : "";
            const rubricaWord = rubrica
                ? `<p style="margin:0 0 2pt 0;text-align:center;"><img src="${escaparHtml(rubrica)}" height="52" alt="" style="max-height:1.6cm;max-width:6.2cm;" /></p>`
                : "";
            const seloWord = mostrarSelo
                ? `<p style="margin:4pt 0 0 0;text-align:center;font-family:Arial,sans-serif;font-size:7.5pt;color:#061237;">[ Espaço para assinatura digital · ICP-Brasil ]</p>`
                : "";
            return `<div class="doc-assinatura">${pDataWord}<table align="${alin}" border="0" cellspacing="0" cellpadding="0" style="border:none;border-collapse:collapse;width:7.5cm;"><tr><td style="border:none;padding:0;text-align:center;">${rubricaWord}<div style="border-top:1pt solid #000;padding-top:4pt;font-weight:bold;font-size:11.5pt;text-align:center;">${nomeEsc}</div><div style="font-size:10.5pt;text-align:center;">${oabEsc}</div>${seloWord}</td></tr></table></div>`;
        }

        return `<div class="doc-assinatura" style="text-align:${alin};">${dataHtml}<div style="display:inline-block;text-align:center;">${miolo}</div></div>`;
    });
}

function regraPagina(c: ConfigPagina): string {
    const papel = FORMATOS_PAPEL[c.formato];
    const m = c.margens;
    return `size: ${papel.larguraCm}cm ${papel.alturaCm}cm; margin: ${m.superior}cm ${m.direita}cm ${m.inferior}cm ${m.esquerda}cm;`;
}

/** Aceita apenas data:image/* ou URL http(s)/relativa para o emblema do timbrado. */
function logoSrcSeguro(raw?: string): string {
    const s = (raw ?? "").trim();
    if (!s) return "";
    if (/^data:image\/(?:png|jpeg|jpg|webp);base64,[a-zA-Z0-9+/=]+$/i.test(s)) return s;
    if (/^\/[a-zA-Z0-9._/-]+$/.test(s)) return s;
    return "";
}

/** CSS da impressão / PDF com o papel e as margens escolhidos. */
export function estiloPaginaDocumento(c: ConfigPagina = CONFIG_PAGINA_PADRAO): string {
    return `@page { ${regraPagina(c)} }\n${ESTILO_TEXTO_DOCUMENTO}`;
}

export interface OpcoesExportacaoDocumento {
    logoSrc?: string;
    /** Imagem A4 de folha inteira importada pelo escritório (data URI); sobrescreve o timbrado padrão. */
    timbradoImagemUrl?: string;
    escritorio?: ConfigEscritorio;
}

/**
 * Monta o documento HTML completo pronto para impressão / Salvar em PDF no iframe isolado.
 * Quando `c.timbrado` está ativo, repete o timbrado (imagem A4 própria ou cabeçalho/rodapé padrão)
 * em todas as páginas impressas.
 */
export function montarHtmlImpressaoDocumento(
    titulo: string,
    corpoHtml: string,
    c: ConfigPagina = CONFIG_PAGINA_PADRAO,
    opcoes: OpcoesExportacaoDocumento = {},
): string {
    const cfg = opcoes.escritorio ?? configEscritorioAtual();
    const htmlSeguro = expandirBlocosAssinaturaHtml(sanitizarHtmlDocumento(corpoHtml), { escritorio: cfg });
    const urlFontes = urlGoogleFontsParaHtml(htmlSeguro);
    const linkFontes = urlFontes ? `<link rel="stylesheet" href="${escaparHtml(urlFontes)}">` : "";
    const csp = urlFontes
        ? "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:;"
        : "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:;";

    if (!c.timbrado) {
        return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>${escaparHtml(titulo)}</title>${linkFontes}<style>${estiloPaginaDocumento(c)}</style></head><body><div class="doc-corpo">${htmlSeguro}</div></body></html>`;
    }

    const papel = FORMATOS_PAPEL[c.formato];
    const imgPersonalizada = logoSrcSeguro(opcoes.timbradoImagemUrl ?? cfg.timbradoImagemUrl);

    if (imgPersonalizada) {
        const m = margensEfetivas(c, true);
        const cssA4 = `
  @page { size: ${papel.larguraCm}cm ${papel.alturaCm}cm; margin: 0; }
  html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${ESTILO_TEXTO_DOCUMENTO}
  .timbrado-fundo-a4 {
    position: fixed;
    top: 0;
    left: 0;
    width: ${papel.larguraCm}cm;
    height: ${papel.alturaCm}cm;
    object-fit: fill;
    z-index: -1;
    pointer-events: none;
  }
  table.timbrado-layout {
    width: 100%;
    border-collapse: collapse;
    border: 0;
  }
  table.timbrado-layout > thead > tr > td,
  table.timbrado-layout > tfoot > tr > td,
  table.timbrado-layout > tbody > tr > td {
    border: 0;
    padding: 0;
  }
  .timbrado-espaco-topo { height: ${m.superior}cm; }
  .timbrado-espaco-rodape { height: ${m.inferior}cm; }
  .timbrado-corpo { padding: 0 ${m.direita}cm 0 ${m.esquerda}cm; }
`;
        return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>${escaparHtml(titulo)}</title>${linkFontes}<style>${cssA4}</style></head><body><img class="timbrado-fundo-a4" src="${escaparHtml(imgPersonalizada)}" alt="" /><table class="timbrado-layout"><thead><tr><td><div class="timbrado-espaco-topo">&nbsp;</div></td></tr></thead><tfoot><tr><td><div class="timbrado-espaco-rodape">&nbsp;</div></td></tr></tfoot><tbody><tr><td><div class="timbrado-corpo doc-corpo">${htmlSeguro}</div></td></tr></tbody></table></body></html>`;
    }

    const m = margensEfetivas(c, false);
    const dados = dadosTimbradoEscritorio(cfg);
    const logo = logoSrcSeguro(opcoes.logoSrc);
    const logoImg = logo
        ? `<img src="${escaparHtml(logo)}" alt="" style="width:0.95cm;height:0.95cm;object-fit:cover;display:block;flex-shrink:0;" />`
        : `<div style="width:0.95cm;height:0.95cm;background:#061237;color:#c5b08e;font-family:Georgia,serif;font-size:15pt;font-weight:700;line-height:0.95cm;text-align:center;flex-shrink:0;">G</div>`;

    const css = `
  @page { size: ${papel.larguraCm}cm ${papel.alturaCm}cm; margin: 0; }
  html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${ESTILO_TEXTO_DOCUMENTO}
  .timbrado-cabecalho {
    position: fixed;
    top: 0.65cm;
    left: ${m.esquerda}cm;
    right: ${m.direita}cm;
    padding-bottom: 0.22cm;
    border-bottom: 1.5pt solid #061237;
    box-shadow: 0 2.5pt 0 0 #ffffff, 0 3.5pt 0 0 #b6a182;
    font-family: "Archivo", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12pt;
    background: #ffffff;
  }
  .timbrado-marca {
    display: flex;
    align-items: center;
    gap: 8pt;
  }
  .timbrado-nome {
    font-size: 11.5pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #061237;
    line-height: 1.1;
  }
  .timbrado-sub {
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.34em;
    color: #8b6d3b;
    margin-top: 2pt;
    line-height: 1.1;
  }
  .timbrado-adv {
    text-align: right;
    line-height: 1.3;
  }
  .timbrado-adv-nome {
    font-size: 8.5pt;
    font-weight: 600;
    color: #061237;
  }
  .timbrado-adv-oab {
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: #8b6d3b;
  }
  .timbrado-rodape {
    position: fixed;
    bottom: 0.55cm;
    left: ${m.esquerda}cm;
    right: ${m.direita}cm;
    padding-top: 0.2cm;
    border-top: 0.75pt solid #b6a182;
    text-align: center;
    font-family: "Archivo", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    font-size: 7.5pt;
    line-height: 1.4;
    color: #475273;
    background: #ffffff;
  }
  table.timbrado-layout {
    width: 100%;
    border-collapse: collapse;
    border: 0;
  }
  table.timbrado-layout > thead > tr > td,
  table.timbrado-layout > tfoot > tr > td,
  table.timbrado-layout > tbody > tr > td {
    border: 0;
    padding: 0;
  }
  .timbrado-espaco-topo { height: ${m.superior}cm; }
  .timbrado-espaco-rodape { height: ${m.inferior}cm; }
  .timbrado-corpo { padding: 0 ${m.direita}cm 0 ${m.esquerda}cm; }
`;

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>${escaparHtml(titulo)}</title>${linkFontes}<style>${css}</style></head><body><header class="timbrado-cabecalho"><div class="timbrado-marca">${logoImg}<div><div class="timbrado-nome">${escaparHtml(dados.tituloEscritorio)}</div><div class="timbrado-sub">${escaparHtml(dados.subtituloEscritorio)}</div></div></div><div class="timbrado-adv"><div class="timbrado-adv-nome">${escaparHtml(dados.advogado)}</div><div class="timbrado-adv-oab">${escaparHtml(dados.oab)}</div></div></header><footer class="timbrado-rodape"><div>${escaparHtml(dados.endereco)}</div><div>${escaparHtml(dados.contato)}</div></footer><table class="timbrado-layout"><thead><tr><td><div class="timbrado-espaco-topo">&nbsp;</div></td></tr></thead><tfoot><tr><td><div class="timbrado-espaco-rodape">&nbsp;</div></td></tr></tfoot><tbody><tr><td><div class="timbrado-corpo doc-corpo">${htmlSeguro}</div></td></tr></tbody></table></body></html>`;
}

const REGEX_QUEBRA_PAGINA = /<div[^>]*data-quebra-pagina[^>]*>\s*<\/div>/g;

/** HTML que o Word abre como documento (.doc), com o papel, as margens, timbrado opcional e quebras de página. */
export function montarArquivoWord(
    titulo: string,
    corpoHtml: string,
    c: ConfigPagina = CONFIG_PAGINA_PADRAO,
    opcoes: OpcoesExportacaoDocumento = {},
): string {
    const cfg = opcoes.escritorio ?? configEscritorioAtual();
    const corpo = expandirBlocosAssinaturaHtml(sanitizarHtmlDocumento(corpoHtml), { escritorio: cfg, modoWord: true })
        .replace(REGEX_QUEBRA_PAGINA, `<br clear="all" style="mso-special-character:line-break;page-break-before:always">`)
        // Tabulação: o Word só reconhece no formato dele; a parada do parágrafo vira tab-stops.
        .replace(/\t/g, `<span style="mso-tab-count:1">\t</span>`)
        .replace(/tab-size: ?(\d+(?:\.\d+)?)(cm|mm|pt|px)/g, "tab-size: $1$2; tab-stops: $1$2");

    const imgPersonalizada = c.timbrado ? logoSrcSeguro(opcoes.timbradoImagemUrl ?? cfg.timbradoImagemUrl) : "";

    // Cabeçalho e rodapé viram seções próprias do Word (mso-element:header/footer), que ele repete
    // em todas as páginas. A tabela que os carrega fica fora da folha (margem de 9in) e não aparece.
    let cabecalhoWord = "";
    let rodapeWord = "";
    let margemCabecalhoCm = 0;
    let margemRodapeCm = 0;

    if (c.timbrado && imgPersonalizada) {
        const papel = FORMATOS_PAPEL[c.formato];
        // Imagem A4 ancorada na página, atrás do texto: funciona como fundo de todas as folhas.
        cabecalhoWord = `<p class="MsoHeader" style="margin:0;"><img src="${escaparHtml(imgPersonalizada)}" width="${Math.round(papel.larguraCm * PX_POR_CM)}" height="${Math.round(papel.alturaCm * PX_POR_CM)}" alt="" style="position:absolute;left:0;top:0;width:${papel.larguraCm}cm;height:${papel.alturaCm}cm;z-index:-1;mso-position-horizontal-relative:page;mso-position-vertical-relative:page;" /></p>`;
    } else if (c.timbrado) {
        const dados = dadosTimbradoEscritorio(cfg);
        const logo = logoSrcSeguro(opcoes.logoSrc);
        const celulaLogo = logo
            ? `<td style="border:none;padding:0 10pt 0 0;width:36pt;vertical-align:middle;"><img src="${escaparHtml(logo)}" width="36" height="36" alt="" style="width:36pt;height:36pt;display:block;" /></td>`
            : "";
        cabecalhoWord = `<table style="width:100%;border-collapse:collapse;border:none;border-bottom:1.5pt solid #061237;"><tr>${celulaLogo}<td style="border:none;padding:0 0 8pt 0;vertical-align:middle;"><div style="font-family:Arial,sans-serif;font-size:12pt;font-weight:bold;letter-spacing:2pt;color:#061237;">${escaparHtml(dados.tituloEscritorio)}</div><div style="font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;letter-spacing:3pt;color:#8b6d3b;">${escaparHtml(dados.subtituloEscritorio)}</div></td><td style="border:none;padding:0 0 8pt 0;text-align:right;vertical-align:middle;"><div style="font-family:Arial,sans-serif;font-size:8.5pt;font-weight:bold;color:#061237;">${escaparHtml(dados.advogado)}</div><div style="font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;color:#8b6d3b;">${escaparHtml(dados.oab)}</div></td></tr></table>`;
        rodapeWord = `<div style="padding-top:6pt;border-top:0.75pt solid #b6a182;text-align:center;font-family:Arial,sans-serif;font-size:7.5pt;line-height:1.4;color:#475273;"><div>${escaparHtml(dados.endereco)}</div><div>${escaparHtml(dados.contato)}</div></div>`;
        margemCabecalhoCm = 0.65;
        margemRodapeCm = 0.55;
    }

    // Mesmas margens de texto da tela e do PDF (o timbrado padrão reserva espaço mínimo no topo/base).
    const paginaWord: ConfigPagina = { ...c, margens: margensEfetivas(c, Boolean(imgPersonalizada)) };
    const regrasSecao = cabecalhoWord
        ? ` mso-header-margin: ${margemCabecalhoCm}cm; mso-footer-margin: ${margemRodapeCm}cm; mso-header: h1;${rodapeWord ? " mso-footer: f1;" : ""}`
        : "";
    const secoesWord = cabecalhoWord
        ? `<table id="hrdftrtbl" border="0" cellspacing="0" cellpadding="0"><tr><td><div style="mso-element:header" id="h1">${cabecalhoWord}</div></td>${rodapeWord ? `<td><div style="mso-element:footer" id="f1">${rodapeWord}</div></td>` : ""}</tr></table>`
        : "";

    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page WordSection1 { ${regraPagina(paginaWord)}${regrasSecao} }
  div.WordSection1 { page: WordSection1; }
  table#hrdftrtbl { margin: 0 0 0 9in; }
  ${ESTILO_TEXTO_DOCUMENTO}
</style></head>
<body><div class="WordSection1"><div class="doc-corpo">${corpo}</div>${secoesWord}</div></body></html>`;
}

/** Nome de arquivo seguro: "Petição ciente - Maria" → "Peticao-ciente-Maria". */
export function nomeArquivoDocumento(titulo: string): string {
    const base = titulo
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return base || "documento";
}

/** Texto puro (para copiar e colar no PJe ou no WhatsApp). */
export function htmlParaTextoSimples(html: string): string {
    const cfg = configEscritorioAtual();
    const comAssinatura = html.replace(REGEX_BLOCO_ASSINATURA, (_full, attrs: string) => {
        const mostrarData = lerAtributoTag(attrs, "data-mostrar-data").toLowerCase() !== "false";
        const linhaData = mostrarData ? `${cidadeAssinatura(cfg)}, ${dataPorExtenso(new Date())}.\n\n` : "";
        return `\n\n${linhaData}${cfg.nomeAdvogado}\n${formatarOab(cfg)}\n\n`;
    });
    return decodificarEntidades(
        comAssinatura
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/(p|h[1-6]|li|blockquote|tr)>/gi, "\n")
            .replace(/<li[^>]*>/gi, "• ")
            .replace(/<[^>]+>/g, ""),
    )
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
