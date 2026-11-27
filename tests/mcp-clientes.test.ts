import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dataIso, estadoCivilId, executarToolClientes, type ClientesDb } from "../src/lib/mcp/clientes-mcp.ts";
import { MCP_TOOLS } from "../src/lib/mcp/revisional-mcp-core.ts";
import { clienteEmBranco, type Cliente } from "../src/lib/revisional-db.ts";

function dbFalso(inicial: Array<Partial<Cliente>> = []) {
    let seq = 0;
    const clientes: Cliente[] = inicial.map((c) => ({
        ...clienteEmBranco(),
        id: `id-${++seq}`,
        created_by_email: "",
        created_at: "",
        updated_at: "",
        ...c,
    })) as Cliente[];
    const db: ClientesDb = {
        listarClientes: async () => clientes,
        criarCliente: async (linha) => {
            const c = { ...clienteEmBranco(), ...linha, id: `id-${++seq}`, created_by_email: "", created_at: "", updated_at: "" } as Cliente;
            clientes.push(c);
            return c;
        },
        atualizarCliente: async (id, patch) => {
            const c = clientes.find((x) => x.id === id)!;
            Object.assign(c, patch);
            return c;
        },
    };
    return { db, clientes };
}

type Resultado = { sucesso: boolean; cliente: { clienteId: string; nome: string; cpfCnpj: string }; camposAlterados?: string[] };

describe("MCP: cadastro de clientes", () => {
    it("está registrado no conector", () => {
        const nomes: string[] = MCP_TOOLS.map((t) => t.name);
        for (const n of ["buscar_clientes", "cadastrar_cliente", "atualizar_cliente"]) assert.ok(nomes.includes(n), n);
    });

    it("cadastra com as validações da tela Clientes", async () => {
        const { db, clientes } = dbFalso();
        const r = (await executarToolClientes(
            "cadastrar_cliente",
            {
                nome: "  Maria   Teste da Silva ",
                cpfCnpj: "123.456.789-09",
                estadoCivil: "Casada",
                genero: "feminino",
                dataNascimento: "05/03/1985",
                telefone: "(81) 98765-4321",
                cep: "56300-000",
                uf: "pe",
            },
            db,
        )) as Resultado;
        assert.equal(r.sucesso, true);
        assert.equal(r.cliente.cpfCnpj, "123.456.789-09");
        const salvo = clientes[0];
        assert.equal(salvo.nome, "Maria Teste da Silva");
        assert.equal(salvo.cpf_cnpj, "12345678909");
        assert.equal(salvo.estado_civil, "casado");
        assert.equal(salvo.genero, "f");
        assert.equal(salvo.data_nascimento, "1985-03-05");
        assert.equal(salvo.cep, "56300000");
        assert.equal(salvo.uf, "PE");
        assert.equal(salvo.tipo_pessoa, "pf");
    });

    it("recusa CPF inválido e CPF já cadastrado", async () => {
        const { db } = dbFalso([{ nome: "Maria", cpf_cnpj: "12345678909" }]);
        await assert.rejects(executarToolClientes("cadastrar_cliente", { nome: "João", cpfCnpj: "111.111.111-12" }, db), /CPF inválido/);
        await assert.rejects(
            executarToolClientes("cadastrar_cliente", { nome: "Outra", cpfCnpj: "123.456.789-09" }, db),
            /Já existe um cliente com este CPF\/CNPJ: Maria/,
        );
    });

    it("nome repetido sem CPF pede confirmação antes de cadastrar", async () => {
        const { db, clientes } = dbFalso([{ nome: "José da Silva" }]);
        await assert.rejects(executarToolClientes("cadastrar_cliente", { nome: "jose da silva" }, db), /permitirNomeRepetido/);
        await executarToolClientes("cadastrar_cliente", { nome: "José da Silva", permitirNomeRepetido: true }, db);
        assert.equal(clientes.length, 2);
    });

    it("edita só os campos enviados, localizando por nome ou CPF", async () => {
        const { db, clientes } = dbFalso([{ nome: "Maria Teste da Silva", cpf_cnpj: "12345678909", email: "a@b.com" }]);
        const r = (await executarToolClientes(
            "atualizar_cliente",
            { buscaCliente: "123.456.789-09", telefone: "(81) 3000-0000", email: "" },
            db,
        )) as Resultado;
        assert.deepEqual(r.camposAlterados?.sort(), ["email", "telefone"]);
        assert.equal(clientes[0].telefone, "(81) 3000-0000");
        assert.equal(clientes[0].email, "");
        assert.equal(clientes[0].nome, "Maria Teste da Silva");
    });

    it("edição ambígua pede o clienteId", async () => {
        const { db } = dbFalso([{ nome: "Maria Souza" }, { nome: "Maria Lima" }]);
        await assert.rejects(
            executarToolClientes("atualizar_cliente", { buscaCliente: "maria", telefone: "1" }, db),
            /Mais de um cliente[\s\S]*Maria Souza[\s\S]*Maria Lima/,
        );
    });

    it("busca por nome, CPF ou telefone e mostra o que falta no cadastro", async () => {
        const { db } = dbFalso([{ nome: "Maria Teste", cpf_cnpj: "12345678909", telefone: "(81) 98765-4321" }, { nome: "João" }]);
        const porTel = (await executarToolClientes("buscar_clientes", { busca: "98765" }, db)) as {
            total: number;
            clientes: Array<{ nome: string; faltaNoCadastro: string[] }>;
        };
        assert.equal(porTel.total, 1);
        assert.equal(porTel.clientes[0].nome, "Maria Teste");
        assert.ok(porTel.clientes[0].faltaNoCadastro.length > 0);
    });

    it("estado civil e data em formatos comuns", () => {
        assert.equal(estadoCivilId("viúva"), "viuvo");
        assert.equal(estadoCivilId("União estável"), "uniao_estavel");
        assert.throws(() => estadoCivilId("noivo"), /não reconhecido/);
        assert.equal(dataIso("2000-01-31"), "2000-01-31");
        assert.throws(() => dataIso("31/13/2000"), /inválida/);
    });
});
