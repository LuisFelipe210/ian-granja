import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
    assinaturaMetaValida,
    assinaturaYCloudValida,
    chaveTelefone,
    enviarTextoWhatsApp,
    lerConfigWhatsApp,
    dentroDaJanela,
    lerWebhookWhatsApp,
    normalizarTelefone,
    parametroTemplate,
    telefoneLegivel,
    type ConfigWhatsApp,
} from "../src/lib/atendimento/whatsapp.ts";
import { enviarRespostaConversa, processarWebhookWhatsApp } from "../src/lib/atendimento/processar-whatsapp.ts";
import { criarClienteAnthropic } from "../src/lib/atendimento/ia-atendimento.ts";
import { handleWhatsAppWebhook } from "../api/whatsapp-webhook.ts";
import { handleAtendimentoIaRequest } from "../api/atendimento-ia.ts";

const ID_CLIENTE = "11111111-1111-4111-8111-111111111111";
const TELEFONE_META = "558187654321"; // a Meta às vezes manda sem o nono dígito
const CONFIG: ConfigWhatsApp = {
    provedor: "meta",
    ycloudApiKey: "",
    ycloudWebhookSecret: "",
    numeroEscritorio: "",
    token: "tok-wa",
    phoneNumberId: "123456",
    appSecret: "segredo-app",
    verifyToken: "verifica",
    templateAviso: "aviso_atendimento",
    idiomaTemplate: "pt_BR",
    versaoGraph: "v23.0",
};

function webhookTexto(texto: string, id = "wamid.1", ts = Math.floor(Date.now() / 1000)) {
    return {
        object: "whatsapp_business_account",
        entry: [
            {
                changes: [
                    {
                        field: "messages",
                        value: {
                            contacts: [{ wa_id: TELEFONE_META, profile: { name: "Maria" } }],
                            messages: [
                                { id, from: TELEFONE_META, timestamp: String(ts), type: "text", text: { body: texto } } as Record<
                                    string,
                                    unknown
                                >,
                            ],
                        } as Record<string, unknown>,
                    },
                ],
            },
        ],
    };
}

/* ------------------------------------------------------------------ Funções puras */

describe("telefones", () => {
    it("normaliza e compara com ou sem o nono dígito", () => {
        assert.equal(normalizarTelefone("(81) 98765-4321"), "5581987654321");
        assert.equal(chaveTelefone("(81) 98765-4321"), chaveTelefone(TELEFONE_META));
        assert.notEqual(chaveTelefone("(81) 98765-4321"), chaveTelefone("(82) 98765-4321"));
        assert.equal(telefoneLegivel("5581987654321"), "(81) 98765-4321");
    });
    it("janela de 24h", () => {
        const agora = Date.parse("2026-11-27T12:00:00Z");
        assert.equal(dentroDaJanela("2026-11-26T13:00:00Z", agora), true);
        assert.equal(dentroDaJanela("2026-11-26T11:00:00Z", agora), false);
        assert.equal(dentroDaJanela(null, agora), false);
    });
    it("parâmetro de template sem quebra de linha", () => {
        assert.equal(parametroTemplate("oi\n\ntudo   bem?"), "oi tudo bem?");
        assert.equal(parametroTemplate(""), "-");
    });
});

describe("lerWebhookWhatsApp", () => {
    it("lê texto, mídia e falha de entrega", () => {
        const corpo = webhookTexto("Qual o número do meu processo?");
        const value = corpo.entry[0].changes[0].value;
        (value.messages as unknown[]).push({ id: "wamid.2", from: TELEFONE_META, timestamp: "1", type: "audio", audio: {} });
        value.statuses = [{ id: "wamid.out", status: "failed", errors: [{ code: 131026, title: "Message undeliverable" }] }];
        const { mensagens, status } = lerWebhookWhatsApp(corpo);
        assert.equal(mensagens.length, 2);
        assert.equal(mensagens[0].nomeContato, "Maria");
        assert.equal(mensagens[0].de, TELEFONE_META);
        assert.equal(mensagens[1].tipo, "midia");
        assert.equal(mensagens[1].texto, "[áudio]");
        assert.equal(status[0].status, "failed");
        assert.match(status[0].erro, /131026/);
    });
    it("ignora corpo que não é da Meta", () => {
        assert.deepEqual(lerWebhookWhatsApp({ object: "page" }), { mensagens: [], status: [], ecos: [] });
    });
});

/* ------------------------------------------------------------------ YCloud (coexistência) */

const YCLOUD: ConfigWhatsApp = {
    ...CONFIG,
    provedor: "ycloud",
    token: "",
    phoneNumberId: "",
    appSecret: "",
    verifyToken: "",
    ycloudApiKey: "yc-key",
    ycloudWebhookSecret: "whsec_teste",
    numeroEscritorio: "+558130000000",
};

function eventoYCloud(tipo: string, chave: string, dados: Record<string, unknown>) {
    return { id: `evt_${Math.random().toString(36).slice(2)}`, type: tipo, apiVersion: "v2", createTime: new Date().toISOString(), [chave]: dados };
}

function assinarYCloud(corpo: string, segredo = "whsec_teste", t = "1764240000") {
    return `t=${t},s=${createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex")}`;
}

describe("YCloud", () => {
    it("escolhe a YCloud quando há chave e exige número e segredo", () => {
        const c = lerConfigWhatsApp({ YCLOUD_API_KEY: "k", YCLOUD_WEBHOOK_SECRET: "s", WHATSAPP_NUMERO_ESCRITORIO: "(81) 3000-0000" });
        assert.equal(c.provedor, "ycloud");
        assert.equal(c.numeroEscritorio, "+558130000000");
        assert.equal(lerConfigWhatsApp({ YCLOUD_API_KEY: "k" }).provedor, "ycloud");
        assert.equal(lerConfigWhatsApp({ WHATSAPP_TOKEN: "t" }).provedor, "meta");
    });

    it("lê mensagem recebida, resposta pelo celular e falha de entrega", () => {
        const recebida = lerWebhookWhatsApp(
            eventoYCloud("whatsapp.inbound_message.received", "whatsappInboundMessage", {
                id: "yc1",
                wamid: "wamid.in1",
                from: "+558187654321",
                to: "+558130000000",
                sendTime: "2026-11-27T12:00:00.000Z",
                type: "text",
                text: { body: "Oi, e meu processo?" },
                customerProfile: { name: "Maria" },
            }),
        );
        assert.deepEqual(recebida.mensagens[0], {
            waMessageId: "wamid.in1",
            de: TELEFONE_META,
            nomeContato: "Maria",
            recebidaEm: "2026-11-27T12:00:00.000Z",
            tipo: "texto",
            texto: "Oi, e meu processo?",
        });

        const eco = lerWebhookWhatsApp(
            eventoYCloud("whatsapp.smb.message.echoes", "whatsappMessage", {
                id: "yc2",
                wamid: "wamid.eco1",
                from: "+558130000000",
                to: "+558187654321",
                type: "text",
                text: { body: "Já te ligo" },
                sendTime: "2026-11-27T12:05:00.000Z",
            }),
        );
        assert.equal(eco.ecos[0].para, TELEFONE_META);
        assert.equal(eco.ecos[0].texto, "Já te ligo");

        const falha = lerWebhookWhatsApp(
            eventoYCloud("whatsapp.message.updated", "whatsappMessage", {
                id: "yc3",
                wamid: "wamid.out9",
                status: "failed",
                errorCode: "131026",
                errorMessage: "Message undeliverable",
            }),
        );
        assert.deepEqual(falha.status[0].ids, ["wamid.out9", "yc3"]);
        assert.match(falha.status[0].erro, /131026/);
    });

    it("assinatura YCloud-Signature", () => {
        const corpo = JSON.stringify({ type: "whatsapp.inbound_message.received" });
        assert.equal(assinaturaYCloudValida(corpo, assinarYCloud(corpo), "whsec_teste"), true);
        assert.equal(assinaturaYCloudValida(corpo, assinarYCloud(corpo, "teste"), "whsec_teste"), true, "aceita a chave sem o prefixo");
        assert.equal(assinaturaYCloudValida(`${corpo} `, assinarYCloud(corpo), "whsec_teste"), false);
        assert.equal(assinaturaYCloudValida(corpo, assinarYCloud(corpo, "outro"), "whsec_teste"), false);
        assert.equal(assinaturaYCloudValida(corpo, "t=abc,s=00", "whsec_teste"), false);
    });

    it("envia texto pela YCloud com número do escritório e chave", async () => {
        let url = "";
        let init: RequestInit | undefined;
        const fetchFn = (async (u: unknown, i?: RequestInit) => {
            url = String(u);
            init = i;
            return Response.json({ id: "yc9", wamid: "wamid.out1", status: "sent" });
        }) as typeof fetch;
        const id = await enviarTextoWhatsApp({ config: YCLOUD, para: TELEFONE_META, texto: "Olá", fetchFn });
        assert.equal(id, "wamid.out1");
        assert.equal(url, "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly");
        assert.equal((init?.headers as Record<string, string>)["X-API-Key"], "yc-key");
        assert.deepEqual(JSON.parse(String(init?.body)), {
            from: "+558130000000",
            to: `+${TELEFONE_META}`,
            type: "text",
            text: { body: "Olá" },
        });
    });

    it("falha fora da janela de 24h vira mensagem clara", async () => {
        const fetchFn = (async () =>
            Response.json({ id: "x", status: "failed", errorCode: "131047", errorMessage: "Re-engagement message" })) as typeof fetch;
        await assert.rejects(enviarTextoWhatsApp({ config: YCLOUD, para: TELEFONE_META, texto: "Olá", fetchFn }), /24h/);
    });
});

describe("assinatura da Meta", () => {
    it("aceita só o corpo assinado com o App Secret", () => {
        const corpo = JSON.stringify(webhookTexto("oi"));
        const sig = `sha256=${createHmac("sha256", "segredo-app").update(corpo).digest("hex")}`;
        assert.equal(assinaturaMetaValida(corpo, sig, "segredo-app"), true);
        assert.equal(assinaturaMetaValida(`${corpo} `, sig, "segredo-app"), false);
        assert.equal(assinaturaMetaValida(corpo, sig, "outro"), false);
        assert.equal(assinaturaMetaValida(corpo, "sha256=zz", "segredo-app"), false);
    });
});

/* ------------------------------------------------------------------ Supabase + Claude + Meta simulados */

type Linha = Record<string, unknown>;

function bancoFalso() {
    const tabelas: Record<string, Linha[]> = {
        revisional_clientes: [{ id: ID_CLIENTE, nome: "Maria Teste da Silva", telefone: "(81) 98765-4321" }],
        revisional_calculos: [
            {
                cliente_id: ID_CLIENTE,
                processo_global: "0001234-56.2026.8.17.0001",
                banco: "Banco Exemplo",
                modalidade_nome: "Financiamento",
                categoria_id: null,
                valor_financiado: 35000,
                valor_parcela: null,
                parcelas: 48,
                updated_at: "2026-11-21T09:00:00Z",
            },
        ],
        revisional_categorias: [],
        revisional_cliente_conhecimento: [],
        revisional_atendimento_conversas: [],
        revisional_atendimento_mensagens: [],
        revisional_atendimento_avisos: [{ telefone: "5581999990000", avisar_whatsapp: true }],
    };
    let seq = 0;
    const enviadosMeta: Array<Record<string, unknown>> = [];
    let respostaClaude: unknown = {
        situacao: "respondido",
        mensagem: "Maria, seu processo é o 0001234-56.2026.8.17.0001.",
        fontes: ["F2"],
    };
    let chamadasClaude = 0;

    const filtrar = (linhas: Linha[], params: URLSearchParams) =>
        linhas.filter((l) => {
            for (const [k, v] of params) {
                if (["select", "order", "limit", "on_conflict"].includes(k)) continue;
                const valor = l[k];
                if (v.startsWith("eq.") && String(valor) !== v.slice(3)) return false;
                if (v.startsWith("neq.") && String(valor ?? "") === v.slice(4)) return false;
                if (v === "is.true" && valor !== true) return false;
                if (v.startsWith("in.(")) {
                    const lista = v.slice(4, -1).split(",").map((x) => x.replace(/^"|"$/g, ""));
                    if (!lista.includes(String(valor))) return false;
                }
            }
            return true;
        });

    const fetchFn = (async (url: unknown, init?: RequestInit) => {
        const u = new URL(String(url));
        if (u.hostname === "api.anthropic.com") {
            chamadasClaude++;
            return Response.json({
                id: "msg",
                type: "message",
                role: "assistant",
                model: "claude-opus-5-5",
                content: [{ type: "text", text: JSON.stringify(respostaClaude) }],
                stop_reason: "end_turn",
                stop_sequence: null,
                usage: { input_tokens: 1, output_tokens: 1 },
            });
        }
        if (u.hostname === "graph.facebook.com") {
            const corpo = JSON.parse(String(init?.body)) as Record<string, unknown>;
            enviadosMeta.push(corpo);
            return Response.json({ messages: [{ id: `wamid.out.${enviadosMeta.length}` }] });
        }
        const tabela = u.pathname.replace("/rest/v1/", "");
        const linhas = tabelas[tabela];
        if (!linhas) return Response.json({ code: "PGRST205" }, { status: 404 });
        const metodo = init?.method ?? "GET";
        if (metodo === "GET") {
            let r = filtrar(linhas, u.searchParams);
            const limite = Number(u.searchParams.get("limit") || 0);
            if (limite) r = r.slice(0, limite);
            return Response.json(r);
        }
        if (metodo === "POST") {
            const nova = { ...(JSON.parse(String(init?.body)) as Linha) };
            if (tabela === "revisional_atendimento_mensagens" && nova.wa_message_id) {
                if (linhas.some((l) => l.wa_message_id === nova.wa_message_id)) {
                    return Response.json({ code: "23505" }, { status: 409 });
                }
            }
            const linha: Linha = {
                id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
                created_at: new Date(Date.now() + seq).toISOString(),
                fontes: [],
                motivo_interno: "",
                erro: "",
                tipo: "texto",
                ...nova,
            };
            linhas.push(linha);
            return Response.json([linha], { status: 201 });
        }
        if (metodo === "PATCH") {
            const patch = JSON.parse(String(init?.body)) as Linha;
            const alvo = filtrar(linhas, u.searchParams);
            for (const l of alvo) Object.assign(l, patch);
            return Response.json(alvo);
        }
        return new Response(null, { status: 405 });
    }) as typeof fetch;

    return {
        tabelas,
        fetchFn,
        enviadosMeta,
        chamadasClaude: () => chamadasClaude,
        definirRespostaClaude(r: unknown) {
            respostaClaude = r;
        },
        acesso: { supabaseUrl: "https://db.test", apiKey: "service", bearer: "service", fetchFn },
    };
}

function depsDe(db: ReturnType<typeof bancoFalso>, config: ConfigWhatsApp = CONFIG) {
    const anthropic = criarClienteAnthropic({ apiKey: "sk-teste", fetchFn: db.fetchFn });
    return { acesso: db.acesso, config, ia: { anthropic, modelo: "claude-opus-5-5" }, fetchFn: db.fetchFn };
}

describe("processarWebhookWhatsApp", () => {
    it("grava a mensagem, reconhece o cliente, faz rascunho e avisa o advogado (sem responder ao cliente)", async () => {
        const db = bancoFalso();
        const r = await processarWebhookWhatsApp(webhookTexto("Qual o número do meu processo?"), depsDe(db));

        assert.deepEqual({ ...r, erros: r.erros.length }, { recebidas: 1, pelocelular: 0, duplicadas: 0, rascunhos: 1, avisos: 1, erros: 0 });
        const [conversa] = db.tabelas.revisional_atendimento_conversas;
        assert.equal(conversa.cliente_id, ID_CLIENTE);
        assert.equal(conversa.status, "pendente");
        const rascunho = db.tabelas.revisional_atendimento_mensagens.find((m) => m.status === "rascunho");
        assert.ok(rascunho);
        assert.equal(rascunho.situacao_ia, "respondido");
        assert.match(String(rascunho.texto), /0001234-56\.2026\.8\.17\.0001/);

        // Único envio à Meta é o aviso por template ao advogado, nunca texto ao cliente.
        assert.equal(db.enviadosMeta.length, 1);
        assert.equal(db.enviadosMeta[0].type, "template");
        assert.equal(db.enviadosMeta[0].to, "5581999990000");
    });

    it("webhook repetido pela Meta não duplica nem gera outro rascunho", async () => {
        const db = bancoFalso();
        const deps = depsDe(db);
        await processarWebhookWhatsApp(webhookTexto("oi"), deps);
        const r = await processarWebhookWhatsApp(webhookTexto("oi"), deps);
        assert.equal(r.duplicadas, 1);
        assert.equal(r.rascunhos, 0);
        assert.equal(db.chamadasClaude(), 1);
    });

    it("segunda mensagem com a conversa já pendente: novo rascunho substitui o antigo e não avisa de novo", async () => {
        const db = bancoFalso();
        const deps = depsDe(db);
        await processarWebhookWhatsApp(webhookTexto("oi", "wamid.a"), deps);
        const r = await processarWebhookWhatsApp(webhookTexto("e o processo?", "wamid.b"), deps);
        assert.equal(r.avisos, 0);
        const status = db.tabelas.revisional_atendimento_mensagens.filter((m) => m.direcao === "saida").map((m) => m.status);
        assert.deepEqual(status, ["descartada", "rascunho"]);
    });

    it("número desconhecido: grava a conversa sem cliente e sem chamar a IA", async () => {
        const db = bancoFalso();
        db.tabelas.revisional_clientes[0].telefone = "(11) 90000-0000";
        const r = await processarWebhookWhatsApp(webhookTexto("Bom dia"), depsDe(db));
        assert.equal(r.recebidas, 1);
        assert.equal(r.rascunhos, 0);
        assert.equal(db.chamadasClaude(), 0);
        assert.equal(db.tabelas.revisional_atendimento_conversas[0].cliente_id, null);
    });

    it("áudio vira rascunho vazio encaminhado ao advogado, sem chamar a IA", async () => {
        const db = bancoFalso();
        const corpo = webhookTexto("x");
        const msg = (corpo.entry[0].changes[0].value.messages as Record<string, unknown>[])[0];
        msg.type = "audio";
        delete msg.text;
        msg.audio = { id: "media1" };
        await processarWebhookWhatsApp(corpo, depsDe(db));
        assert.equal(db.chamadasClaude(), 0);
        const rascunho = db.tabelas.revisional_atendimento_mensagens.find((m) => m.status === "rascunho");
        assert.equal(rascunho?.situacao_ia, "encaminhar_advogado");
        assert.match(String(rascunho?.motivo_interno), /áudio/);
    });

    it("coexistência: resposta dada pelo celular entra na conversa, descarta o rascunho e fecha a pendência", async () => {
        const db = bancoFalso();
        const deps = depsDe(db, { ...CONFIG, templateAviso: "" });
        await processarWebhookWhatsApp(webhookTexto("Qual o número do meu processo?"), deps);
        const eco = {
            object: "whatsapp_business_account",
            entry: [
                {
                    changes: [
                        {
                            field: "smb_message_echoes",
                            value: {
                                message_echoes: [
                                    {
                                        id: "wamid.celular.1",
                                        from: "558130000000",
                                        to: TELEFONE_META,
                                        timestamp: String(Math.floor(Date.now() / 1000)),
                                        type: "text",
                                        text: { body: "Oi Maria, já te ligo." },
                                    },
                                ],
                            },
                        },
                    ],
                },
            ],
        };
        const r = await processarWebhookWhatsApp(eco, deps);
        assert.equal(r.pelocelular, 1);
        const [conversa] = db.tabelas.revisional_atendimento_conversas;
        assert.equal(conversa.status, "respondida");
        const saidas = db.tabelas.revisional_atendimento_mensagens.filter((m) => m.direcao === "saida");
        assert.deepEqual(
            saidas.map((m) => [m.autor, m.status]),
            [
                ["ia", "descartada"],
                ["advogado", "enviada"],
            ],
        );
        // Reenvio do mesmo eco não duplica.
        const r2 = await processarWebhookWhatsApp(eco, deps);
        assert.equal(r2.pelocelular, 0);
        assert.equal(db.enviadosMeta.length, 0);
    });

    it("resposta com número inventado chega bloqueada ao rascunho", async () => {
        const db = bancoFalso();
        db.definirRespostaClaude({ situacao: "respondido", mensagem: "Você vai receber R$ 12.000,00.", fontes: ["F2"] });
        await processarWebhookWhatsApp(webhookTexto("Quanto vou receber?"), depsDe(db));
        const rascunho = db.tabelas.revisional_atendimento_mensagens.find((m) => m.status === "rascunho");
        assert.equal(rascunho?.situacao_ia, "sem_informacao");
        assert.doesNotMatch(String(rascunho?.texto), /12\.000/);
    });
});

describe("enviarRespostaConversa", () => {
    async function preparar() {
        const db = bancoFalso();
        await processarWebhookWhatsApp(webhookTexto("Qual o número do meu processo?"), depsDe(db, { ...CONFIG, templateAviso: "" }));
        const conversa = db.tabelas.revisional_atendimento_conversas[0];
        const rascunho = db.tabelas.revisional_atendimento_mensagens.find((m) => m.status === "rascunho")!;
        return { db, conversa, rascunho };
    }

    it("envia o rascunho aprovado como texto e marca a conversa como respondida", async () => {
        const { db, conversa, rascunho } = await preparar();
        const enviada = await enviarRespostaConversa({
            acesso: db.acesso,
            config: CONFIG,
            conversaId: String(conversa.id),
            texto: String(rascunho.texto),
            rascunhoId: String(rascunho.id),
            fetchFn: db.fetchFn,
        });
        assert.equal(enviada.status, "enviada");
        assert.equal(enviada.autor, "ia");
        assert.equal(db.enviadosMeta.length, 1);
        assert.equal(db.enviadosMeta[0].type, "text");
        assert.equal(db.enviadosMeta[0].to, TELEFONE_META);
        assert.equal(conversa.status, "respondida");
    });

    it("texto editado pelo advogado fica registrado como dele", async () => {
        const { db, conversa, rascunho } = await preparar();
        const enviada = await enviarRespostaConversa({
            acesso: db.acesso,
            config: CONFIG,
            conversaId: String(conversa.id),
            texto: "Maria, já te mando o número completo.",
            rascunhoId: String(rascunho.id),
            fetchFn: db.fetchFn,
        });
        assert.equal(enviada.autor, "advogado");
    });

    it("recusa enviar fora da janela de 24h, sem chamar a Meta", async () => {
        const { db, conversa, rascunho } = await preparar();
        await assert.rejects(
            enviarRespostaConversa({
                acesso: db.acesso,
                config: CONFIG,
                conversaId: String(conversa.id),
                texto: "oi",
                rascunhoId: String(rascunho.id),
                fetchFn: db.fetchFn,
                agora: Date.now() + 25 * 60 * 60 * 1000,
            }),
            /24h/,
        );
        assert.equal(db.enviadosMeta.length, 0);
    });

    it("não envia o mesmo rascunho duas vezes", async () => {
        const { db, conversa, rascunho } = await preparar();
        const args = {
            acesso: db.acesso,
            config: CONFIG,
            conversaId: String(conversa.id),
            texto: String(rascunho.texto),
            rascunhoId: String(rascunho.id),
            fetchFn: db.fetchFn,
        };
        await enviarRespostaConversa(args);
        await assert.rejects(enviarRespostaConversa(args), /já foi enviado/);
        assert.equal(db.enviadosMeta.length, 1);
    });
});

/* ------------------------------------------------------------------ Rotas */

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
        send(b: string) {
            r.body = b;
            return b;
        },
        setHeader() {},
    };
    return { r, api };
}

describe("api/whatsapp-webhook", () => {
    it("responde o desafio de verificação só com o token certo", async () => {
        const ok = resposta();
        await handleWhatsAppWebhook(
            {
                method: "GET",
                headers: {},
                corpoCru: "",
                query: { "hub.mode": "subscribe", "hub.verify_token": "verifica", "hub.challenge": "123abc" },
            },
            ok.api,
            { config: CONFIG, env: {} },
        );
        assert.equal(ok.r.code, 200);
        assert.equal(ok.r.body, "123abc");

        const ruim = resposta();
        await handleWhatsAppWebhook(
            { method: "GET", headers: {}, corpoCru: "", query: { "hub.mode": "subscribe", "hub.verify_token": "x", "hub.challenge": "1" } },
            ruim.api,
            { config: CONFIG, env: {} },
        );
        assert.equal(ruim.r.code, 403);
    });

    it("recusa POST sem assinatura válida antes de tocar no banco", async () => {
        let chamou = false;
        const fetchFn = (async () => {
            chamou = true;
            return Response.json([]);
        }) as typeof fetch;
        const { r, api } = resposta();
        await handleWhatsAppWebhook(
            { method: "POST", headers: { "x-hub-signature-256": "sha256=00" }, corpoCru: JSON.stringify(webhookTexto("oi")) },
            api,
            { config: CONFIG, env: { SUPABASE_SERVICE_ROLE_KEY: "service" }, fetchFn, anthropic: null },
        );
        assert.equal(r.code, 401);
        assert.equal(chamou, false);
    });

    it("POST assinado grava a mensagem", async () => {
        const db = bancoFalso();
        const corpoCru = JSON.stringify(webhookTexto("oi"));
        const sig = `sha256=${createHmac("sha256", CONFIG.appSecret).update(corpoCru).digest("hex")}`;
        const { r, api } = resposta();
        await handleWhatsAppWebhook({ method: "POST", headers: { "x-hub-signature-256": sig }, corpoCru }, api, {
            config: CONFIG,
            env: { SUPABASE_SERVICE_ROLE_KEY: "service", VITE_SUPABASE_URL: "https://db.test" },
            fetchFn: db.fetchFn,
            anthropic: null,
        });
        assert.equal(r.code, 200);
        assert.equal(db.tabelas.revisional_atendimento_mensagens.length, 1);
    });
});

describe("api/whatsapp-webhook (YCloud)", () => {
    it("aceita evento assinado e recusa sem assinatura", async () => {
        const db = bancoFalso();
        const corpoCru = JSON.stringify(
            eventoYCloud("whatsapp.inbound_message.received", "whatsappInboundMessage", {
                id: "yc1",
                wamid: "wamid.in1",
                from: "+558187654321",
                sendTime: new Date().toISOString(),
                type: "text",
                text: { body: "oi" },
            }),
        );
        const opcoes = {
            config: YCLOUD,
            env: { SUPABASE_SERVICE_ROLE_KEY: "service", VITE_SUPABASE_URL: "https://db.test" },
            fetchFn: db.fetchFn,
            anthropic: null,
        };
        const semAssinatura = resposta();
        await handleWhatsAppWebhook({ method: "POST", headers: {}, corpoCru }, semAssinatura.api, opcoes);
        assert.equal(semAssinatura.r.code, 401);

        const ok = resposta();
        await handleWhatsAppWebhook(
            { method: "POST", headers: { "ycloud-signature": assinarYCloud(corpoCru) }, corpoCru },
            ok.api,
            opcoes,
        );
        assert.equal(ok.r.code, 200);
        assert.equal(db.tabelas.revisional_atendimento_mensagens.length, 1);
        assert.equal(db.tabelas.revisional_atendimento_conversas[0].cliente_id, ID_CLIENTE);
    });
});

describe("api/atendimento-ia — ações do WhatsApp", () => {
    it("enviar_resposta exige login", async () => {
        const { r, api } = resposta();
        await handleAtendimentoIaRequest({ method: "POST", headers: {}, body: { acao: "enviar_resposta" } }, api, {
            whatsapp: CONFIG,
        });
        assert.equal(r.code, 401);
    });

    it("status_whatsapp funciona sem chave da Anthropic", async () => {
        const fetchFn = (async () => Response.json(true)) as typeof fetch;
        const { r, api } = resposta();
        await handleAtendimentoIaRequest(
            { method: "POST", headers: { authorization: "Bearer tok" }, body: { acao: "status_whatsapp" } },
            api,
            { fetchFn, whatsapp: { ...CONFIG, templateAviso: "" } },
        );
        assert.equal(r.code, 200);
        assert.deepEqual(r.body, { ok: true, configurado: true, avisoPorWhatsApp: false });
    });
});
