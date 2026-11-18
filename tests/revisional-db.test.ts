import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MODALIDADES, analisar } from "../src/lib/juros/index.ts";
import { analiseParaPayload, calculoParaFormulario, type CalculoSalvo } from "../src/lib/revisional-db.ts";
import { handleKeepAlive, type KeepAliveResponse } from "../api/keep-alive.ts";

const createMockRes = () => {
    let statusCode = 200;
    let body: unknown = null;
    const res: KeepAliveResponse = {
        status(code: number) {
            statusCode = code;
            return res;
        },
        json(payload: unknown) {
            body = payload;
            return res;
        },
    };
    return { res, getStatus: () => statusCode, getBody: () => body };
};

describe("revisional-db serialização e restauração", () => {
    it("analiseParaPayload exige nome do cliente e preserva snapshot completo", () => {
        const veiculoPf = MODALIDADES.find((m) => m.id === "veiculo-pf")!;
        const a = analisar({
            mod: veiculoPf,
            mes: "2025-11",
            valor: 45000,
            parcela: 1750,
            parcelas: 48,
            pagas: 10,
            taxaMensal: 2.95,
        });
        assert.ok(a);

        assert.throws(() =>
            analiseParaPayload(a, {
                clienteNome: "   ",
                banco: "",
                documentoContrato: "",
                categoriaId: null,
                observacoes: "",
            }),
        );

        const payload = analiseParaPayload(a, {
            clienteNome: "  Carlos Eduardo  ",
            banco: " Santander ",
            documentoContrato: " 998877 ",
            categoriaId: "cat-123",
            observacoes: " Busca e apreensão em curso ",
        });

        assert.equal(payload.cliente_nome, "Carlos Eduardo");
        assert.equal(payload.banco, "Santander");
        assert.equal(payload.documento_contrato, "998877");
        assert.equal(payload.categoria_id, "cat-123");
        assert.equal(payload.modalidade_id, "veiculo-pf");
        assert.equal(payload.mes_contrato, "2025-11");
        assert.equal(payload.valor_financiado, 45000);
        assert.equal(payload.parcelas, 48);
        assert.equal(payload.pagas, 10);
        assert.equal(payload.taxa_mensal_informada, 2.95);
        assert.equal(payload.taxa_anual_informada, null);

        const salvoSimulado: CalculoSalvo = {
            ...payload,
            id: "calc-1",
            created_by_email: "contato@iangranja.adv.br",
            created_at: "2026-11-17T20:00:00Z",
            updated_at: "2026-11-17T20:00:00Z",
        };

        const form = calculoParaFormulario(salvoSimulado);
        assert.equal(form.ano, "2025");
        assert.equal(form.mes, "11");
        assert.equal(form.mod?.id, "veiculo-pf");
        assert.equal(form.ficha.clienteNome, "Carlos Eduardo");
        assert.equal(form.ficha.banco, "Santander");
        assert.equal(form.taxaM, "2,95");
        assert.equal(form.taxaA, "");
    });
});

describe("api/keep-alive cron", () => {
    it("aceita GET e repassa o ping ao RPC do Supabase", async () => {
        let calledUrl = "";
        const mockFetch = (async (url: string | URL | Request) => {
            calledUrl = String(url);
            return new Response(JSON.stringify("2026-11-17T09:00:00Z"), { status: 200 });
        }) as typeof fetch;

        const mock = createMockRes();
        await handleKeepAlive({ method: "GET", headers: {} }, mock.res, mockFetch);
        assert.equal(mock.getStatus(), 200);
        assert.match(calledUrl, /\/rest\/v1\/rpc\/keep_alive_ping$/);
    });

    it("rejeita métodos inválidos com 405", async () => {
        const mock = createMockRes();
        await handleKeepAlive({ method: "DELETE", headers: {} }, mock.res);
        assert.equal(mock.getStatus(), 405);
    });
});
