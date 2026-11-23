import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    montarFontesCliente,
    normalizarExtracao,
    sanitizarItemConhecimento,
    tokensNumericos,
    validarRespostaAtendimento,
    type ContextoAtendimento,
    type ItemConhecimento,
} from "../src/lib/atendimento/base-conhecimento.ts";
import { carregarContextoCliente } from "../src/lib/atendimento/contexto-cliente.ts";
import {
    criarClienteAnthropic,
    extrairDocumentoCliente,
    responderMensagemCliente,
} from "../src/lib/atendimento/ia-atendimento.ts";
import { handleAtendimentoIaRequest } from "../api/atendimento-ia.ts";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

function item(p: Partial<ItemConhecimento>): ItemConhecimento {
    return {
        id: "x",
        cliente_id: ID_A,
        origem: "documento",
        titulo: "CCB",
        arquivo_nome: "ccb.pdf",
        resumo: "",
        fatos: [],
        visivel_cliente: true,
        created_by_email: "",
        created_at: "2026-11-20T10:00:00Z",
        updated_at: "2026-11-20T10:00:00Z",
        ...p,
    };
}

function contextoExemplo(): ContextoAtendimento {
    return montarFontesCliente({
        clienteId: ID_A,
        nomeCliente: "Maria Teste da Silva",
        casos: [
            {
                processo_global: "0001234-56.2026.8.17.0001",
                banco: "Banco Exemplo",
                modalidade_nome: "Financiamento de veículo",
                fase: "Ajuizado",
                valor_financiado: 35000,
                valor_parcela: 1250.5,
                parcelas: 48,
                atualizado_em: "2026-11-21T09:00:00Z",
            },
        ],
        itens: [
            item({
                titulo: "Despacho",
                resumo: "Audiência de conciliação designada.",
                fatos: [{ rotulo: "Data da audiência", valor: "10/12/2026 às 14h", pagina: 1 }],
            }),
        ],
    });
}

describe("montarFontesCliente — isolamento por cliente", () => {
    it("descarta itens de outro cliente e itens internos", () => {
        const ctx = montarFontesCliente({
            clienteId: ID_A,
            nomeCliente: "Maria",
            casos: [],
            itens: [
                item({ titulo: "Doc da Maria", resumo: "ok" }),
                item({ titulo: "Doc do João", resumo: "segredo", cliente_id: ID_B }),
                item({ titulo: "Nota interna", resumo: "estratégia", visivel_cliente: false }),
            ],
        });
        const tudo = ctx.fontes.map((f) => `${f.titulo} ${f.texto}`).join("\n");
        assert.match(tudo, /Doc da Maria/);
        assert.doesNotMatch(tudo, /João|segredo|estratégia/);
        assert.deepEqual(
            ctx.fontes.map((f) => f.id),
            ["F1", "F2"],
        );
    });

    it("não inclui estimativas de ganho do caso", () => {
        const texto = contextoExemplo().fontes.map((f) => f.texto).join("\n");
        assert.doesNotMatch(texto, /pago a mais|valor da ação|receber/i);
        assert.match(texto, /R\$\s?35\.000,00/);
    });
});

describe("tokensNumericos", () => {
    it("normaliza datas em formatos diferentes para o mesmo token", () => {
        assert.deepEqual(tokensNumericos("10/12/2026"), ["D:20261210"]);
        assert.deepEqual(tokensNumericos("2026-12-10"), ["D:20261210"]);
        assert.deepEqual(tokensNumericos("10 de dezembro de 2026"), ["D:20261210"]);
    });
    it("reduz valores a dígitos", () => {
        assert.deepEqual(tokensNumericos("R$ 1.250,50 em 48x"), ["125050", "48"]);
    });
});

describe("validarRespostaAtendimento — trava anti-alucinação em código", () => {
    const ctx = contextoExemplo();

    it("aceita resposta com fonte citada e números que estão nela", () => {
        const r = validarRespostaAtendimento(
            {
                situacao: "respondido",
                mensagem: "Maria, sua audiência de conciliação é em 10 de dezembro de 2026, às 14h.",
                fontes: ["F3"],
            },
            ctx,
        );
        assert.equal(r.situacao, "respondido");
        assert.equal(r.bloqueadaPelaValidacao, false);
        assert.equal(r.fontes[0].titulo, "Documento: Despacho");
    });

    it("bloqueia valor inventado", () => {
        const r = validarRespostaAtendimento(
            { situacao: "respondido", mensagem: "Você deve receber R$ 12.000,00.", fontes: ["F2"] },
            ctx,
        );
        assert.equal(r.bloqueadaPelaValidacao, true);
        assert.equal(r.situacao, "sem_informacao");
        assert.doesNotMatch(r.mensagem, /12\.000/);
        assert.match(r.motivoInterno, /1200000/);
    });

    it("bloqueia data que não está na fonte citada (mesmo existindo em outra)", () => {
        const r = validarRespostaAtendimento(
            { situacao: "respondido", mensagem: "A audiência é em 10/12/2026.", fontes: ["F2"] },
            ctx,
        );
        assert.equal(r.bloqueadaPelaValidacao, true);
    });

    it("bloqueia resposta sem fonte ou com fonte inexistente", () => {
        assert.equal(
            validarRespostaAtendimento({ situacao: "respondido", mensagem: "Está tudo certo.", fontes: [] }, ctx)
                .bloqueadaPelaValidacao,
            true,
        );
        assert.equal(
            validarRespostaAtendimento({ situacao: "respondido", mensagem: "Está tudo certo.", fontes: ["F9"] }, ctx)
                .bloqueadaPelaValidacao,
            true,
        );
    });

    it("nunca repassa o texto da IA quando ela não respondeu", () => {
        const sem = validarRespostaAtendimento(
            { situacao: "sem_informacao", mensagem: "Acho que é R$ 9.999", fontes: [] },
            ctx,
        );
        assert.doesNotMatch(sem.mensagem, /9\.999/);
        assert.match(sem.mensagem, /^Maria, não encontrei/);
        assert.equal(sem.avisarAdvogado, true);

        const enc = validarRespostaAtendimento(
            { situacao: "encaminhar_advogado", mensagem: "Você vai ganhar com certeza", fontes: [] },
            ctx,
        );
        assert.equal(enc.situacao, "encaminhar_advogado");
        assert.doesNotMatch(enc.mensagem, /ganhar/);
    });

    it("saída quebrada vira 'sem informação'", () => {
        assert.equal(validarRespostaAtendimento(null, ctx).situacao, "sem_informacao");
        assert.equal(validarRespostaAtendimento("texto solto", ctx).bloqueadaPelaValidacao, true);
    });
});

describe("normalização de dados", () => {
    it("normalizarExtracao corta lixo e páginas inválidas", () => {
        const e = normalizarExtracao({
            titulo: "  CCB  ",
            resumo: "ok",
            fatos: [{ rotulo: "Parcela", valor: "R$ 10", pagina: 0 }, { rotulo: "", valor: "x" }, "lixo"],
        });
        assert.equal(e.titulo, "CCB");
        assert.deepEqual(e.fatos, [{ rotulo: "Parcela", valor: "R$ 10", pagina: null }]);
    });
    it("sanitizarItemConhecimento força origem válida e título", () => {
        const p = sanitizarItemConhecimento({ cliente_id: ID_A, origem: "x" as never, titulo: " ", resumo: "a" });
        assert.equal(p.origem, "documento");
        assert.equal(p.titulo, "Documento");
        assert.equal(p.visivel_cliente, true);
    });
});

/* ------------------------------------------------------------------ Rede simulada */

function respostaClaude(json: unknown, stop = "end_turn") {
    return new Response(
        JSON.stringify({
            id: "msg_teste",
            type: "message",
            role: "assistant",
            model: "claude-opus-5-5",
            content: [{ type: "text", text: JSON.stringify(json) }],
            stop_reason: stop,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 10 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
    );
}

describe("responderMensagemCliente (Claude simulado)", () => {
    it("manda só as fontes do cliente, sem ferramentas, e valida a saída", async () => {
        let corpo: Record<string, unknown> = {};
        const fetchFn = (async (_url: unknown, init?: RequestInit) => {
            corpo = JSON.parse(String(init?.body));
            return respostaClaude({ situacao: "respondido", mensagem: "Seu processo é o 0001234-56.2026.8.17.0001.", fontes: ["F2"] });
        }) as typeof fetch;
        const client = criarClienteAnthropic({ apiKey: "sk-teste", fetchFn });

        const r = await responderMensagemCliente({
            contexto: contextoExemplo(),
            historico: [{ autor: "cliente", texto: "oi" }],
            mensagem: "Qual o número do meu processo?",
            client,
        });

        assert.equal(r.situacao, "respondido");
        assert.equal(corpo.model, "claude-opus-5-5");
        assert.equal(corpo.tools, undefined, "o atendimento não pode ter ferramentas (nem busca na web)");
        assert.equal(corpo.fallbacks, "default");
        const sistema = JSON.stringify(corpo.system);
        assert.match(sistema, /Maria Teste da Silva/);
        assert.match(sistema, /0001234-56\.2026\.8\.17\.0001/);
        const msgs = corpo.messages as Array<{ role: string; content: string }>;
        assert.equal(msgs.length, 1);
        assert.match(msgs[0].content, /<historico_conversa>[\s\S]*Cliente: oi/);
    });

    it("recusa do modelo vira encaminhamento ao advogado", async () => {
        const fetchFn = (async () => respostaClaude({}, "refusal")) as typeof fetch;
        const r = await responderMensagemCliente({
            contexto: contextoExemplo(),
            historico: [],
            mensagem: "teste",
            client: criarClienteAnthropic({ apiKey: "sk-teste", fetchFn }),
        });
        assert.equal(r.situacao, "encaminhar_advogado");
        assert.equal(r.avisarAdvogado, true);
    });

    it("extrairDocumentoCliente envia o PDF como documento e normaliza os fatos", async () => {
        let corpo: Record<string, unknown> = {};
        const fetchFn = (async (_url: unknown, init?: RequestInit) => {
            corpo = JSON.parse(String(init?.body));
            return respostaClaude({ titulo: "CCB", resumo: "Contrato.", fatos: [{ rotulo: "Parcelas", valor: "48", pagina: 2 }] });
        }) as typeof fetch;
        const e = await extrairDocumentoCliente({
            base64: "JVBERi0=",
            mediaType: "application/pdf",
            nomeArquivo: "ccb.pdf",
            client: criarClienteAnthropic({ apiKey: "sk-teste", fetchFn }),
        });
        assert.deepEqual(e.fatos, [{ rotulo: "Parcelas", valor: "48", pagina: 2 }]);
        const content = (corpo.messages as Array<{ content: Array<{ type: string }> }>)[0].content;
        assert.equal(content[0].type, "document");
    });
});

describe("carregarContextoCliente (Supabase simulado)", () => {
    it("filtra todas as consultas pelo id do cliente", async () => {
        const urls: string[] = [];
        const fetchFn = (async (url: unknown) => {
            const u = String(url);
            urls.push(u);
            if (u.includes("revisional_clientes")) return Response.json([{ id: ID_A, nome: "Maria" }]);
            if (u.includes("revisional_categorias")) return Response.json([{ id: "fase1", nome: "Ajuizado" }]);
            if (u.includes("revisional_calculos"))
                return Response.json([{ processo_global: "123", banco: "B", categoria_id: "fase1", updated_at: "2026-11-01" }]);
            // Simula o banco devolvendo um item de OUTRO cliente: não pode entrar nas fontes.
            return Response.json([{ id: "i1", cliente_id: ID_B, titulo: "Alheio", resumo: "segredo", fatos: [] }]);
        }) as typeof fetch;

        const ctx = await carregarContextoCliente(ID_A, { supabaseUrl: "https://db.test", apiKey: "anon", bearer: "tok", fetchFn });
        for (const u of urls.filter((x) => !x.includes("revisional_categorias"))) {
            assert.ok(u.includes(ID_A), `consulta sem filtro do cliente: ${u}`);
        }
        const texto = ctx.fontes.map((f) => f.texto).join("\n");
        assert.match(texto, /Fase atual no escritório: Ajuizado/);
        assert.doesNotMatch(texto, /segredo/);
    });

    it("rejeita id que não é UUID (evita injeção no filtro)", async () => {
        await assert.rejects(
            carregarContextoCliente("1 or 1=1", { supabaseUrl: "https://db.test", apiKey: "a", bearer: "b" }),
            /Cliente inválido/,
        );
    });
});

describe("api/atendimento-ia", () => {
    function resposta() {
        const r = { code: 0, body: undefined as unknown };
        const api = {
            status(c: number) {
                r.code = c;
                return api;
            },
            json(b: unknown) {
                r.body = b;
                return b;
            },
            setHeader() {},
        };
        return { r, api };
    }

    it("exige login", async () => {
        const { r, api } = resposta();
        await handleAtendimentoIaRequest({ method: "POST", headers: {}, body: {} }, api);
        assert.equal(r.code, 401);
    });

    it("recusa id de cliente inválido antes de chamar a IA", async () => {
        const { r, api } = resposta();
        const fetchFn = (async () => Response.json(true)) as typeof fetch;
        await handleAtendimentoIaRequest(
            { method: "POST", headers: { authorization: "Bearer tok" }, body: { acao: "simular_resposta", clienteId: "abc", mensagem: "oi" } },
            api,
            { fetchFn, anthropic: criarClienteAnthropic({ apiKey: "sk-teste", fetchFn }) },
        );
        assert.equal(r.code, 400);
    });
});
