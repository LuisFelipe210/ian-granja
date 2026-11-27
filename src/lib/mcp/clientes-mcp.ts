/**
 * Conector MCP — cadastro de clientes (buscar, cadastrar e editar) com as MESMAS validações da tela
 * Clientes (sanitizarClientePayload: CPF/CNPJ com dígito verificador, CEP, UF, limites de tamanho).
 * Excluir cliente fica de fora de propósito: só pelo site, que pede confirmação.
 */
import { formatarCpfCnpj, pendenciasCadastro, somenteDigitos, ESTADOS_CIVIS } from "../clientes.ts";
import { sanitizarClientePayload, type Cliente, type ClientePayload } from "../revisional-db.ts";

export interface ClientesDb {
    listarClientes(): Promise<Cliente[]>;
    criarCliente(linha: Record<string, unknown>): Promise<Cliente>;
    atualizarCliente(id: string, patch: Record<string, unknown>): Promise<Cliente>;
}

/* ------------------------------------------------------------------ Definições */

const CAMPOS_CLIENTE = {
    tipoPessoa: { type: "string", enum: ["pf", "pj"], description: "pf = pessoa física (padrão), pj = empresa." },
    nome: { type: "string", description: "Nome completo (ou razão social)." },
    cpfCnpj: { type: "string", description: "CPF (11 dígitos) ou CNPJ (14), com ou sem pontuação." },
    rg: { type: "string" },
    rgOrgao: { type: "string", description: "Órgão emissor do RG, ex.: SDS/PE." },
    nacionalidade: { type: "string", description: "Ex.: brasileiro." },
    estadoCivil: {
        type: "string",
        description: "solteiro, casado, união estável, divorciado, separado ou viúvo (masculino ou feminino).",
    },
    profissao: { type: "string" },
    genero: { type: "string", enum: ["m", "f", ""], description: "m ou f (usado na qualificação das petições)." },
    dataNascimento: { type: "string", description: "DD/MM/AAAA ou AAAA-MM-DD." },
    email: { type: "string" },
    telefone: { type: "string", description: "Com DDD. É por ele que o atendimento do WhatsApp reconhece o cliente." },
    cep: { type: "string" },
    logradouro: { type: "string" },
    numero: { type: "string" },
    complemento: { type: "string" },
    bairro: { type: "string" },
    cidade: { type: "string" },
    uf: { type: "string", description: "Sigla, ex.: PE." },
    representanteNome: { type: "string", description: "Só para empresa (pj): nome do representante legal." },
    representanteCpf: { type: "string", description: "Só para empresa (pj): CPF do representante." },
    observacoes: { type: "string" },
} as const;

export const MCP_TOOLS_CLIENTES = [
    {
        name: "buscar_clientes",
        description:
            "Procura no cadastro de Clientes do escritório por nome, CPF/CNPJ, telefone, e-mail ou cidade. Devolve o clienteId, os dados principais e o que falta no cadastro. Use antes de editar ou para conferir se o cliente já existe.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
                busca: { type: "string", description: "Texto livre (nome, CPF, telefone...). Vazio lista os primeiros." },
                limite: { type: "integer", minimum: 1, maximum: 50 },
            },
        },
    },
    {
        name: "cadastrar_cliente",
        description:
            "Cadastra um cliente novo na tela Clientes, com validação de CPF/CNPJ, CEP e UF. Recusa CPF/CNPJ já cadastrado. Se já existir alguém com o mesmo nome e sem CPF informado, pergunte ao usuário antes e repita com permitirNomeRepetido=true. Dados vindos de documentos devem ser copiados exatamente como estão.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            required: ["nome"],
            properties: {
                ...CAMPOS_CLIENTE,
                permitirNomeRepetido: { type: "boolean", description: "true só depois de o usuário confirmar que é outra pessoa." },
            },
        },
    },
    {
        name: "atualizar_cliente",
        description:
            "Edita o cadastro de um cliente existente. Localize pelo clienteId (veja buscar_clientes) ou por nome/CPF que identifique uma única pessoa. Só os campos enviados mudam; envie \"\" para apagar um campo. O nome do cliente pode ser corrigido com novoNome.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
                clienteId: { type: "string" },
                buscaCliente: { type: "string", description: "Nome ou CPF/CNPJ do cliente a editar (se não tiver o clienteId)." },
                novoNome: { type: "string" },
                ...Object.fromEntries(Object.entries(CAMPOS_CLIENTE).filter(([k]) => k !== "nome")),
            },
        },
    },
] as const;

export const NOMES_TOOLS_CLIENTES = new Set<string>(MCP_TOOLS_CLIENTES.map((t) => t.name));

/* ------------------------------------------------------------------ Conversões */

const normalizar = (s: string) =>
    s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

const MAPA_CAMPOS: Array<[string, keyof ClientePayload]> = [
    ["tipoPessoa", "tipo_pessoa"],
    ["cpfCnpj", "cpf_cnpj"],
    ["rg", "rg"],
    ["rgOrgao", "rg_orgao"],
    ["nacionalidade", "nacionalidade"],
    ["profissao", "profissao"],
    ["email", "email"],
    ["telefone", "telefone"],
    ["cep", "cep"],
    ["logradouro", "logradouro"],
    ["numero", "numero"],
    ["complemento", "complemento"],
    ["bairro", "bairro"],
    ["cidade", "cidade"],
    ["uf", "uf"],
    ["representanteNome", "representante_nome"],
    ["representanteCpf", "representante_cpf"],
    ["observacoes", "observacoes"],
];

export function estadoCivilId(texto: string): string {
    const t = normalizar(texto);
    if (!t) return "";
    const direto = ESTADOS_CIVIS.find((e) => e.id === t.replace(/ /g, "_"));
    if (direto) return direto.id;
    if (t.startsWith("solteir")) return "solteiro";
    if (t.startsWith("casad")) return "casado";
    if (t.includes("uniao estavel") || t.includes("convivente")) return "uniao_estavel";
    if (t.startsWith("divorciad")) return "divorciado";
    if (t.startsWith("separad")) return "separado";
    if (t.startsWith("viuv")) return "viuvo";
    throw new Error("Estado civil não reconhecido. Use: solteiro, casado, união estável, divorciado, separado ou viúvo.");
}

export function dataIso(texto: string): string | null {
    const t = texto.trim();
    if (!t) return null;
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (m) {
        const [d, mes] = [Number(m[1]), Number(m[2])];
        if (d >= 1 && d <= 31 && mes >= 1 && mes <= 12) return `${m[3]}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    throw new Error("Data de nascimento inválida. Use DD/MM/AAAA.");
}

function generoArg(v: unknown): "" | "m" | "f" {
    const t = normalizar(String(v ?? ""));
    if (t === "m" || t.startsWith("masc")) return "m";
    if (t === "f" || t.startsWith("fem")) return "f";
    return "";
}

/** Converte os argumentos da ferramenta (camelCase) para o payload da tabela, só com os campos enviados. */
export function payloadDeArgs(args: Record<string, unknown>, nomeCampo: "nome" | "novoNome"): Partial<ClientePayload> {
    const p: Partial<ClientePayload> = {};
    const nome = args[nomeCampo];
    if (typeof nome === "string") p.nome = nome;
    for (const [arg, coluna] of MAPA_CAMPOS) {
        const v = args[arg];
        if (typeof v === "string") (p as Record<string, unknown>)[coluna] = v;
    }
    if (typeof args.estadoCivil === "string") p.estado_civil = estadoCivilId(args.estadoCivil);
    if (args.genero !== undefined) p.genero = generoArg(args.genero);
    if (typeof args.dataNascimento === "string") p.data_nascimento = dataIso(args.dataNascimento);
    return p;
}

function resumoCliente(c: Cliente) {
    return {
        clienteId: c.id,
        nome: c.nome,
        tipoPessoa: c.tipo_pessoa,
        cpfCnpj: c.cpf_cnpj ? formatarCpfCnpj(c.cpf_cnpj) : "",
        telefone: c.telefone,
        email: c.email,
        endereco: [c.logradouro, c.numero, c.complemento, c.bairro, c.cidade && `${c.cidade}${c.uf ? `/${c.uf}` : ""}`]
            .filter(Boolean)
            .join(", "),
        faltaNoCadastro: pendenciasCadastro(c),
    };
}

/* ------------------------------------------------------------------ Busca */

export function filtrarClientes(clientes: Cliente[], busca: string): Cliente[] {
    const q = normalizar(busca);
    const digitos = somenteDigitos(busca);
    if (!q) return clientes;
    return clientes.filter((c) => {
        if (normalizar(`${c.nome} ${c.email} ${c.cidade}`).includes(q)) return true;
        return digitos.length >= 3 && (c.cpf_cnpj.includes(digitos) || somenteDigitos(c.telefone).includes(digitos));
    });
}

async function localizarUm(db: ClientesDb, args: Record<string, unknown>): Promise<Cliente> {
    const clientes = await db.listarClientes();
    const id = typeof args.clienteId === "string" ? args.clienteId.trim().toLowerCase() : "";
    if (id) {
        const c = clientes.find((x) => x.id.toLowerCase() === id);
        if (!c) throw new Error("Cliente não encontrado com esse clienteId.");
        return c;
    }
    const busca = typeof args.buscaCliente === "string" ? args.buscaCliente : "";
    if (!busca.trim()) throw new Error("Informe o clienteId ou buscaCliente (nome ou CPF/CNPJ).");
    const digitos = somenteDigitos(busca);
    const porDoc = digitos.length >= 11 ? clientes.filter((c) => c.cpf_cnpj === digitos) : [];
    const exatos = clientes.filter((c) => normalizar(c.nome) === normalizar(busca));
    const achados = porDoc.length ? porDoc : exatos.length ? exatos : filtrarClientes(clientes, busca);
    if (achados.length === 1) return achados[0];
    if (achados.length === 0) throw new Error("Nenhum cliente encontrado. Use buscar_clientes para conferir.");
    const lista = achados
        .slice(0, 10)
        .map((c) => `- ${c.nome}${c.cpf_cnpj ? ` (${formatarCpfCnpj(c.cpf_cnpj)})` : ""} — clienteId ${c.id}`)
        .join("\n");
    throw new Error(`Mais de um cliente encontrado. Pergunte ao usuário qual é e repita com o clienteId:\n${lista}`);
}

/* ------------------------------------------------------------------ Execução */

export async function executarToolClientes(name: string, args: Record<string, unknown>, db: ClientesDb): Promise<unknown> {
    if (name === "buscar_clientes") {
        const limite = Math.min(50, Math.max(1, Number(args.limite) || 20));
        const achados = filtrarClientes(await db.listarClientes(), typeof args.busca === "string" ? args.busca : "");
        return {
            total: achados.length,
            clientes: achados.slice(0, limite).map(resumoCliente),
            ...(achados.length > limite ? { aviso: `Mostrando ${limite} de ${achados.length}. Refine a busca.` } : {}),
        };
    }

    if (name === "cadastrar_cliente") {
        const payload = payloadDeArgs(args, "nome");
        if (!payload.tipo_pessoa) payload.tipo_pessoa = somenteDigitos(payload.cpf_cnpj ?? "").length === 14 ? "pj" : "pf";
        const linha = sanitizarClientePayload(payload);

        const existentes = await db.listarClientes();
        const doc = String(linha.cpf_cnpj ?? "");
        const mesmoDoc = doc ? existentes.find((c) => c.cpf_cnpj === doc) : undefined;
        if (mesmoDoc) {
            throw new Error(
                `Já existe um cliente com este CPF/CNPJ: ${mesmoDoc.nome} (clienteId ${mesmoDoc.id}). Use atualizar_cliente para editar.`,
            );
        }
        const mesmoNome = existentes.find((c) => normalizar(c.nome) === normalizar(String(linha.nome)));
        if (mesmoNome && !doc && args.permitirNomeRepetido !== true) {
            throw new Error(
                `Já existe um cliente chamado "${mesmoNome.nome}" (clienteId ${mesmoNome.id}). Se for outra pessoa, confirme com o usuário e repita com permitirNomeRepetido=true; se for a mesma, use atualizar_cliente.`,
            );
        }

        const criado = await db.criarCliente(linha);
        return {
            sucesso: true,
            mensagem: `Cliente ${criado.nome} cadastrado.`,
            cliente: resumoCliente(criado),
        };
    }

    if (name === "atualizar_cliente") {
        const alvo = await localizarUm(db, args);
        const patch = sanitizarClientePayload(payloadDeArgs(args, "novoNome"));
        if (Object.keys(patch).length === 0) throw new Error("Nada para alterar: envie ao menos um campo.");
        const atualizado = await db.atualizarCliente(alvo.id, patch);
        return {
            sucesso: true,
            camposAlterados: Object.keys(patch),
            mensagem: `Cadastro de ${atualizado.nome} atualizado.`,
            cliente: resumoCliente(atualizado),
        };
    }

    throw new Error(`Ferramenta desconhecida: ${name}`);
}
