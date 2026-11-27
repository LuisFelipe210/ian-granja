import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executarToolBaseConhecimento, type BaseConhecimentoDb } from "../src/lib/mcp/base-conhecimento-mcp.ts";
import { executarToolMcp, MCP_TOOLS, type RevisionalDbAdapter } from "../src/lib/mcp/revisional-mcp-core.ts";

const MARIA = { id: "11111111-1111-4111-8111-111111111111", nome: "Maria Teste da Silva", cpf_cnpj: "12345678909" };
const MARIA2 = { id: "22222222-2222-4222-8222-222222222222", nome: "Maria Souza", cpf_cnpj: "98765432100" };

function dbFalso() {
    const salvos: Array<Record<string, unknown>> = [];
    const db: BaseConhecimentoDb = {
        listarClientesBasico: async () => [MARIA, MARIA2],
        criarItemConhecimento: async (linha) => {
            salvos.push(linha);
            return { id: `item-${salvos.length}` };
        },
    };
    return { db, salvos };
}

const DOC = {
    clienteNome: "maria teste da silva",
    titulo: "CCB Banco Exemplo nº 123",
    arquivoNome: "ccb.pdf",
    resumo: "Contrato de financiamento de veículo.",
    fatos: [
        { rotulo: "Valor financiado", valor: "R$ 35.000,00", pagina: 1 },
        { rotulo: "Parcelas | prazo", valor: "48", pagina: 2 },
    ],
};

type Previa = { salvo: boolean; previaMarkdown: string; codigoConfirmacao: string };

describe("MCP: documento na base do cliente com confirmação", () => {
    it("a prévia devolve o Markdown do que será salvo e NÃO grava nada", async () => {
        const { db, salvos } = dbFalso();
        const r = (await executarToolBaseConhecimento("preparar_documento_para_base_cliente", DOC, db)) as Previa;
        assert.equal(r.salvo, false);
        assert.equal(salvos.length, 0);
        assert.match(r.previaMarkdown, /\*\*Cliente:\*\* Maria Teste da Silva \(\*\*\*\.456\.789-\*\*\)/);
        assert.match(r.previaMarkdown, /\| 1 \| Valor financiado \| R\$ 35\.000,00 \| 1 \|/);
        assert.match(r.previaMarkdown, /Parcelas \\\| prazo/, "barra vertical escapada na tabela");
        assert.match(r.previaMarkdown, /Nada foi salvo ainda/);
        assert.ok(r.previaMarkdown.includes(r.codigoConfirmacao));
        assert.doesNotMatch(r.previaMarkdown, /12345678909/, "CPF completo não aparece");
    });

    it("salva só com o código e com o conteúdo idêntico ao da prévia", async () => {
        const { db, salvos } = dbFalso();
        const { codigoConfirmacao } = (await executarToolBaseConhecimento(
            "preparar_documento_para_base_cliente",
            DOC,
            db,
        )) as Previa;

        await assert.rejects(
            executarToolBaseConhecimento("salvar_documento_na_base_cliente", DOC, db),
            /não é o mesmo da prévia/,
            "sem código não grava",
        );
        await assert.rejects(
            executarToolBaseConhecimento(
                "salvar_documento_na_base_cliente",
                { ...DOC, fatos: [{ rotulo: "Valor financiado", valor: "R$ 3.500,00", pagina: 1 }], codigoConfirmacao },
                db,
            ),
            /não é o mesmo da prévia/,
            "conteúdo alterado depois da prévia não grava",
        );
        assert.equal(salvos.length, 0);

        const r = (await executarToolBaseConhecimento(
            "salvar_documento_na_base_cliente",
            { ...DOC, codigoConfirmacao },
            db,
        )) as { salvo: boolean };
        assert.equal(r.salvo, true);
        assert.equal(salvos.length, 1);
        assert.equal(salvos[0].cliente_id, MARIA.id);
        assert.equal(salvos[0].visivel_cliente, true);
        assert.equal((salvos[0].fatos as unknown[]).length, 2);
    });

    it("o código expira em 30 minutos", async () => {
        const { db, salvos } = dbFalso();
        const agora = Date.parse("2026-11-27T12:00:00Z");
        const { codigoConfirmacao } = (await executarToolBaseConhecimento(
            "preparar_documento_para_base_cliente",
            DOC,
            db,
            agora,
        )) as Previa;
        await assert.rejects(
            executarToolBaseConhecimento(
                "salvar_documento_na_base_cliente",
                { ...DOC, codigoConfirmacao },
                db,
                agora + 31 * 60 * 1000,
            ),
            /expirou/,
        );
        assert.equal(salvos.length, 0);
    });

    it("nome ambíguo pede para escolher o cliente", async () => {
        const { db } = dbFalso();
        await assert.rejects(
            executarToolBaseConhecimento("preparar_documento_para_base_cliente", { ...DOC, clienteNome: "maria" }, db),
            /Mais de um cliente[\s\S]*Maria Teste da Silva[\s\S]*Maria Souza/,
        );
        const porCpf = (await executarToolBaseConhecimento(
            "preparar_documento_para_base_cliente",
            { ...DOC, clienteNome: "maria", cpfCnpj: "987.654.321-00" },
            db,
        )) as Previa;
        assert.match(porCpf.previaMarkdown, /Maria Souza/);
    });

    it("está registrado no conector e exige acesso ao banco", async () => {
        const nomes: string[] = MCP_TOOLS.map((t) => t.name);
        assert.ok(nomes.includes("preparar_documento_para_base_cliente"));
        assert.ok(nomes.includes("salvar_documento_na_base_cliente"));
        const semBase = {} as RevisionalDbAdapter;
        await assert.rejects(executarToolMcp("preparar_documento_para_base_cliente", DOC, semBase), /não tem acesso/);
    });
});
