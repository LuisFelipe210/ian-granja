/**
 * Conector MCP — salvar documentos na base de conhecimento de um cliente usando o Claude do próprio
 * plano (o Claude lê o PDF na conversa; o servidor só grava).
 *
 * Fluxo com confirmação obrigatória, em duas ferramentas:
 *   1. preparar_documento_para_base_cliente → NÃO grava. Devolve um Markdown com exatamente o que vai
 *      ser salvo e um código de confirmação assinado (HMAC) sobre esse conteúdo.
 *   2. salvar_documento_na_base_cliente → só grava com o código, e só se o conteúdo for idêntico ao da
 *      prévia (qualquer mudança invalida o código e exige nova prévia).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
    LIMITES_CONHECIMENTO,
    sanitizarItemConhecimento,
    type FatoDocumento,
} from "../atendimento/base-conhecimento.ts";

export interface ClienteBasico {
    id: string;
    nome: string;
    cpf_cnpj: string;
}

export interface BaseConhecimentoDb {
    listarClientesBasico(): Promise<ClienteBasico[]>;
    criarItemConhecimento(linha: Record<string, unknown>): Promise<{ id: string }>;
}

const VALIDADE_MS = 30 * 60 * 1000;

let segredoDoProcesso = "";
function segredoConfirmacao(): string {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
    const doAmbiente = (env.MCP_CONFIRMACAO_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (doAmbiente) return doAmbiente;
    // Sem segredo configurado: vale só enquanto este processo estiver vivo (a prévia pode expirar antes).
    if (!segredoDoProcesso) segredoDoProcesso = randomBytes(32).toString("hex");
    return segredoDoProcesso;
}

/* ------------------------------------------------------------------ Definições das ferramentas */

const PROPRIEDADES_DOCUMENTO = {
    clienteId: { type: "string", description: "Id do cliente (se souber)." },
    clienteNome: { type: "string", description: "Nome do cliente cadastrado (pode ser parcial)." },
    cpfCnpj: { type: "string", description: "CPF ou CNPJ do cliente, para desempatar nomes parecidos." },
    titulo: { type: "string", description: "Nome curto do documento, ex.: 'CCB Banco X nº 123' ou 'Sentença'." },
    arquivoNome: { type: "string", description: "Nome do arquivo anexado, se houver." },
    resumo: {
        type: "string",
        description: "Resumo em português simples (até 8 frases), só com o que está escrito no documento.",
    },
    fatos: {
        type: "array",
        description: "Fatos objetivos copiados EXATAMENTE do documento, cada um com a página (1 = primeira; null em foto).",
        items: {
            type: "object",
            additionalProperties: false,
            required: ["rotulo", "valor"],
            properties: {
                rotulo: { type: "string" },
                valor: { type: "string" },
                pagina: { type: ["integer", "null"] },
            },
        },
    },
    visivelCliente: {
        type: "boolean",
        description: "true (padrão) = a IA do WhatsApp pode usar nas respostas a este cliente; false = só interno.",
    },
} as const;

export const MCP_TOOLS_BASE_CONHECIMENTO = [
    {
        name: "preparar_documento_para_base_cliente",
        description:
            "PRIMEIRO PASSO para salvar um documento (PDF/foto lido na conversa) na base de conhecimento de um cliente, usada pela IA do atendimento no WhatsApp. NÃO SALVA NADA: devolve `previaMarkdown` com exatamente o que será gravado e um `codigoConfirmacao`. Regras de leitura: copie valores, datas, números de contrato/processo e nomes EXATAMENTE como estão no documento (nunca calcule, arredonde ou complete); cada fato com a página; se algo estiver ilegível, não crie o fato; o resumo não traz opinião jurídica. Depois de chamar: mostre ao usuário o `previaMarkdown` COMPLETO, sem resumir nem alterar, e pergunte se pode salvar. Só chame salvar_documento_na_base_cliente se o usuário confirmar explicitamente.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            required: ["titulo"],
            properties: PROPRIEDADES_DOCUMENTO,
        },
    },
    {
        name: "salvar_documento_na_base_cliente",
        description:
            "SEGUNDO PASSO: grava na base do cliente o documento já mostrado ao usuário por preparar_documento_para_base_cliente. Use SOMENTE depois que o usuário confirmar explicitamente a prévia. Envie os MESMOS dados da prévia (sem nenhuma alteração) e o `codigoConfirmacao` recebido. Se o usuário pedir mudanças, chame preparar_documento_para_base_cliente de novo e mostre a nova prévia.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            required: ["titulo", "codigoConfirmacao"],
            properties: {
                ...PROPRIEDADES_DOCUMENTO,
                codigoConfirmacao: { type: "string", description: "Código devolvido pela prévia." },
            },
        },
    },
] as const;

export const NOMES_TOOLS_BASE_CONHECIMENTO = new Set<string>(MCP_TOOLS_BASE_CONHECIMENTO.map((t) => t.name));

/* ------------------------------------------------------------------ Cliente */

const semAcentos = (s: string) =>
    s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

function cpfMascarado(doc: string): string {
    const d = doc.replace(/\D/g, "");
    if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
    if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**`;
    return "sem CPF/CNPJ";
}

async function localizarCliente(db: BaseConhecimentoDb, args: Record<string, unknown>): Promise<ClienteBasico> {
    const id = typeof args.clienteId === "string" ? args.clienteId.trim().toLowerCase() : "";
    const doc = typeof args.cpfCnpj === "string" ? args.cpfCnpj.replace(/\D/g, "") : "";
    const nome = typeof args.clienteNome === "string" ? semAcentos(args.clienteNome) : "";
    if (!id && !doc && !nome) throw new Error("Informe o cliente: clienteNome, cpfCnpj ou clienteId.");

    const clientes = await db.listarClientesBasico();
    let achados = clientes;
    if (id) achados = achados.filter((c) => c.id.toLowerCase() === id);
    if (doc) achados = achados.filter((c) => c.cpf_cnpj.replace(/\D/g, "") === doc);
    if (nome) {
        const exatos = achados.filter((c) => semAcentos(c.nome) === nome);
        achados = exatos.length > 0 ? exatos : achados.filter((c) => semAcentos(c.nome).includes(nome));
    }

    if (achados.length === 1) return achados[0];
    if (achados.length === 0) {
        throw new Error("Nenhum cliente cadastrado com esses dados. Confira o nome ou informe o CPF/CNPJ.");
    }
    const lista = achados
        .slice(0, 10)
        .map((c) => `- ${c.nome} (${cpfMascarado(c.cpf_cnpj)}) — clienteId ${c.id}`)
        .join("\n");
    throw new Error(`Mais de um cliente encontrado. Pergunte ao usuário qual é e repita com o clienteId:\n${lista}`);
}

/* ------------------------------------------------------------------ Conteúdo e assinatura */

function linhaParaSalvar(cliente: ClienteBasico, args: Record<string, unknown>): Record<string, unknown> {
    const linha = sanitizarItemConhecimento({
        cliente_id: cliente.id,
        origem: "documento",
        titulo: typeof args.titulo === "string" ? args.titulo : "",
        arquivo_nome: typeof args.arquivoNome === "string" ? args.arquivoNome : "",
        resumo: typeof args.resumo === "string" ? args.resumo : "",
        fatos: (Array.isArray(args.fatos) ? args.fatos : []) as FatoDocumento[],
        visivel_cliente: args.visivelCliente !== false,
    });
    if (!String(linha.resumo ?? "").trim() && (linha.fatos as FatoDocumento[]).length === 0) {
        throw new Error("Nada para salvar: envie o resumo e/ou os fatos do documento.");
    }
    return linha;
}

function assinatura(linha: Record<string, unknown>, expira: number): string {
    const canonico = JSON.stringify([
        expira,
        linha.cliente_id,
        linha.origem,
        linha.titulo,
        linha.arquivo_nome,
        linha.resumo,
        linha.fatos,
        linha.visivel_cliente,
    ]);
    return createHmac("sha256", segredoConfirmacao()).update(canonico).digest("hex").slice(0, 32);
}

function codigoValido(codigo: string, linha: Record<string, unknown>, agora: number): "ok" | "expirado" | "diferente" {
    const m = /^([0-9a-z]+)\.([0-9a-f]{32})$/.exec(codigo.trim());
    if (!m) return "diferente";
    const expira = parseInt(m[1], 36);
    if (!Number.isFinite(expira) || agora > expira) return "expirado";
    const esperado = Buffer.from(assinatura(linha, expira), "hex");
    const recebido = Buffer.from(m[2], "hex");
    return esperado.length === recebido.length && timingSafeEqual(esperado, recebido) ? "ok" : "diferente";
}

const celula = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

export function previaMarkdown(cliente: ClienteBasico, linha: Record<string, unknown>, codigo: string): string {
    const fatos = linha.fatos as FatoDocumento[];
    const partes = [
        "## Confirmação: salvar na base do cliente",
        "",
        `**Cliente:** ${cliente.nome} (${cpfMascarado(cliente.cpf_cnpj)})`,
        `**Documento:** ${linha.titulo}${linha.arquivo_nome ? ` · arquivo \`${linha.arquivo_nome}\`` : ""}`,
        `**Uso nas respostas do WhatsApp:** ${
            linha.visivel_cliente ? "Sim, a IA pode usar nas respostas a este cliente" : "Não, fica só como registro interno"
        }`,
        "",
        "### Resumo",
        String(linha.resumo || "_(sem resumo)_"),
        "",
        `### Fatos (${fatos.length})`,
    ];
    if (fatos.length > 0) {
        partes.push("| # | Informação | Valor | Pág. |", "|---|---|---|---|");
        fatos.forEach((f, i) => partes.push(`| ${i + 1} | ${celula(f.rotulo)} | ${celula(f.valor)} | ${f.pagina ?? "–"} |`));
    } else {
        partes.push("_(nenhum fato)_");
    }
    partes.push(
        "",
        "---",
        `Código de confirmação: \`${codigo}\` (vale 30 minutos)`,
        "",
        "**Nada foi salvo ainda.** Responda **confirmo** para gravar exatamente isto, ou diga o que corrigir.",
    );
    return partes.join("\n");
}

/* ------------------------------------------------------------------ Execução */

export async function executarToolBaseConhecimento(
    name: string,
    args: Record<string, unknown>,
    db: BaseConhecimentoDb,
    agora: number = Date.now(),
): Promise<unknown> {
    const cliente = await localizarCliente(db, args);
    const linha = linhaParaSalvar(cliente, args);

    if (name === "preparar_documento_para_base_cliente") {
        const expira = agora + VALIDADE_MS;
        const codigo = `${expira.toString(36)}.${assinatura(linha, expira)}`;
        return {
            salvo: false,
            previaMarkdown: previaMarkdown(cliente, linha, codigo),
            codigoConfirmacao: codigo,
            instrucao:
                "Mostre o previaMarkdown completo ao usuário e pergunte se pode salvar. Só chame salvar_documento_na_base_cliente, com os mesmos dados e este código, depois de uma confirmação explícita.",
            limites: { fatos: LIMITES_CONHECIMENTO.fatos, resumo: LIMITES_CONHECIMENTO.resumo },
        };
    }

    if (name === "salvar_documento_na_base_cliente") {
        const codigo = typeof args.codigoConfirmacao === "string" ? args.codigoConfirmacao : "";
        const situacao = codigoValido(codigo, linha, agora);
        if (situacao === "expirado") {
            throw new Error("A prévia expirou (30 minutos). Chame preparar_documento_para_base_cliente de novo e mostre a nova prévia.");
        }
        if (situacao === "diferente") {
            throw new Error(
                "O conteúdo não é o mesmo da prévia confirmada (ou o código é inválido). Nada foi salvo. Gere uma nova prévia com preparar_documento_para_base_cliente e peça confirmação de novo.",
            );
        }
        const salvo = await db.criarItemConhecimento(linha);
        return {
            salvo: true,
            itemId: salvo.id,
            mensagem: `Salvo na base de ${cliente.nome}: "${linha.titulo}" com ${(linha.fatos as FatoDocumento[]).length} fato(s).${
                linha.visivel_cliente ? " A IA do WhatsApp já pode usar." : " Marcado como interno."
            }`,
        };
    }

    throw new Error(`Ferramenta desconhecida: ${name}`);
}
