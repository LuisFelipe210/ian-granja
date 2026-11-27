import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MODALIDADES, analisar } from "../src/lib/juros/index.ts";
import {
    RevisionalApiError,
    analiseParaPayload,
    calculoParaFormulario,
    gerarUrlGoogleCalendar,
    isTabelaTarefasAusente,
    normalizarTarefaRow,
    type CalculoSalvo,
} from "../src/lib/revisional-db.ts";
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
    it("recusa sem CRON_SECRET configurado (503 fail-closed) e com token inválido (401)", async () => {
        const prevSecret = process.env.CRON_SECRET;
        try {
            delete process.env.CRON_SECRET;
            const semSecret = createMockRes();
            await handleKeepAlive({ method: "GET", headers: {} }, semSecret.res);
            assert.equal(semSecret.getStatus(), 503);

            process.env.CRON_SECRET = "segredo-cron-teste";
            const errado = createMockRes();
            await handleKeepAlive({ method: "GET", headers: { authorization: "Bearer errado" } }, errado.res);
            assert.equal(errado.getStatus(), 401);
        } finally {
            if (prevSecret === undefined) delete process.env.CRON_SECRET;
            else process.env.CRON_SECRET = prevSecret;
        }
    });

    it("aceita GET autenticado com CRON_SECRET e repassa o ping ao RPC do Supabase", async () => {
        const prevSecret = process.env.CRON_SECRET;
        process.env.CRON_SECRET = "segredo-cron-teste";
        try {
            let calledUrl = "";
            const mockFetch = (async (url: string | URL | Request) => {
                calledUrl = String(url);
                return new Response(JSON.stringify("2026-11-17T09:00:00Z"), { status: 200 });
            }) as typeof fetch;

            const mock = createMockRes();
            await handleKeepAlive(
                { method: "GET", headers: { authorization: "Bearer segredo-cron-teste" } },
                mock.res,
                mockFetch,
            );
            assert.equal(mock.getStatus(), 200);
            assert.match(calledUrl, /\/rest\/v1\/rpc\/keep_alive_ping$/);
        } finally {
            if (prevSecret === undefined) delete process.env.CRON_SECRET;
            else process.env.CRON_SECRET = prevSecret;
        }
    });

    it("rejeita métodos inválidos com 405", async () => {
        const mock = createMockRes();
        await handleKeepAlive({ method: "DELETE", headers: {} }, mock.res);
        assert.equal(mock.getStatus(), 405);
    });
});

describe("revisional-db tarefas e fallback de tabela ausente", () => {
    it("normalizarTarefaRow normaliza hora HH:MM:SS, tipo e concluída", () => {
        const t = normalizarTarefaRow({
            id: "tar-1",
            titulo: "  Prazo contestação  ",
            tipo: "prazo",
            data: "2026-11-18T00:00:00Z",
            hora: "14:30:00",
            calculo_id: "calc-1",
            concluida: false,
            observacoes: "Levar cálculo",
            created_by_email: "contato@iangranja.adv.br",
            created_at: "2026-11-18T12:00:00Z",
            updated_at: "2026-11-18T12:00:00Z",
        });

        assert.equal(t.id, "tar-1");
        assert.equal(t.titulo, "Prazo contestação");
        assert.equal(t.tipo, "prazo");
        assert.equal(t.data, "2026-11-18");
        assert.equal(t.hora, "14:30");
        assert.equal(t.calculo_id, "calc-1");
        assert.equal(t.concluida, false);

        const fallback = normalizarTarefaRow({
            id: "tar-2",
            titulo: "Ligação",
            tipo: "desconhecido",
            data: "2026-11-19",
            hora: "",
            calculo_id: null,
            concluida: 1,
        });

        assert.equal(fallback.tipo, "tarefa");
        assert.equal(fallback.hora, null);
        assert.equal(fallback.calculo_id, null);
        assert.equal(fallback.concluida, true);
    });

    it("isTabelaTarefasAusente detecta 404, 42P01, PGRST205 e TABELA_AUSENTE", () => {
        assert.equal(isTabelaTarefasAusente(new RevisionalApiError("A agenda precisa da migração", 404)), true);
        assert.equal(isTabelaTarefasAusente(new RevisionalApiError("missing", 400, "42P01")), true);
        assert.equal(isTabelaTarefasAusente(new RevisionalApiError("missing", 404, "PGRST205")), true);
        assert.equal(isTabelaTarefasAusente(new RevisionalApiError("missing", 500, "TABELA_AUSENTE")), true);

        assert.equal(isTabelaTarefasAusente(new RevisionalApiError("Não autorizado", 403, "42501")), false);
        assert.equal(isTabelaTarefasAusente(new RevisionalApiError("Sessão expirada", 401)), false);
        assert.equal(isTabelaTarefasAusente(new Error("Erro genérico")), false);
    });

    it("gerarUrlGoogleCalendar formata evento com hora (America/Recife) e evento de dia inteiro", () => {
        const comHora = gerarUrlGoogleCalendar(
            {
                titulo: "Audiência de conciliação",
                tipo: "audiencia",
                data: "2026-11-20",
                hora: "14:30",
                observacoes: "Sala virtual CEJUSC",
            },
            {
                cliente_nome: "Maria Silva",
                processo_global: "0001234-56.2025.8.17.0001",
                banco: "Banco Itaú",
            },
        );
        const urlHora = new URL(comHora);
        assert.equal(urlHora.origin + urlHora.pathname, "https://calendar.google.com/calendar/render");
        assert.equal(urlHora.searchParams.get("action"), "TEMPLATE");
        assert.equal(urlHora.searchParams.get("text"), "[Audiência] Audiência de conciliação");
        assert.equal(urlHora.searchParams.get("dates"), "20261120T143000/20261120T153000");
        assert.equal(urlHora.searchParams.get("ctz"), "America/Recife");
        const details = urlHora.searchParams.get("details") ?? "";
        assert.ok(details.includes("Cliente: Maria Silva"));
        assert.ok(details.includes("Processo: 0001234-56.2025.8.17.0001"));
        assert.ok(details.includes("Sala virtual CEJUSC"));

        const diaInteiro = gerarUrlGoogleCalendar({
            titulo: "Protocolo de petição inicial",
            tipo: "prazo",
            data: "2026-11-30",
            hora: null,
            observacoes: "",
        });
        const urlDia = new URL(diaInteiro);
        assert.equal(urlDia.searchParams.get("text"), "[Prazo] Protocolo de petição inicial");
        assert.equal(urlDia.searchParams.get("dates"), "20261130/20261201");
        assert.equal(urlDia.searchParams.get("ctz"), null);
    });
});
