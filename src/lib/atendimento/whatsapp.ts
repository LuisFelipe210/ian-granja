/**
 * WhatsApp — parte que não depende do banco: leitura do webhook, assinatura e envio de mensagens.
 * Dois provedores, com o mesmo resultado para o resto do sistema:
 *   - "ycloud": parceiro oficial da Meta, usado para a COEXISTÊNCIA (o número continua no app
 *     WhatsApp Business do celular). Padrão quando YCLOUD_API_KEY está configurada.
 *   - "meta":   WhatsApp Cloud API direto (número só na API).
 * Usado só no servidor.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizarTelefone } from "./telefone.ts";

export { chaveTelefone, dentroDaJanela, JANELA_ATENDIMENTO_MS, normalizarTelefone, telefoneLegivel } from "./telefone.ts";

export type ProvedorWhatsApp = "ycloud" | "meta";

export interface ConfigWhatsApp {
    provedor: ProvedorWhatsApp;
    /** Template aprovado na Meta para avisar o advogado (fora da janela de 24h só template funciona). */
    templateAviso: string;
    idiomaTemplate: string;
    // Meta (Cloud API direto)
    token: string;
    phoneNumberId: string;
    appSecret: string;
    verifyToken: string;
    versaoGraph: string;
    // YCloud
    ycloudApiKey: string;
    ycloudWebhookSecret: string;
    /** Número do escritório em E.164 (+55...), obrigatório no envio pela YCloud. */
    numeroEscritorio: string;
}

export function lerConfigWhatsApp(env: Record<string, string | undefined> = process.env): ConfigWhatsApp {
    const v = (k: string) => (env[k] ?? "").trim();
    const escolhido = v("WHATSAPP_PROVEDOR").toLowerCase();
    const provedor: ProvedorWhatsApp =
        escolhido === "meta" || escolhido === "ycloud" ? escolhido : v("YCLOUD_API_KEY") ? "ycloud" : "meta";
    const numero = normalizarTelefone(v("WHATSAPP_NUMERO_ESCRITORIO"));
    return {
        provedor,
        templateAviso: v("WHATSAPP_TEMPLATE_AVISO"),
        idiomaTemplate: v("WHATSAPP_TEMPLATE_IDIOMA") || "pt_BR",
        token: v("WHATSAPP_TOKEN"),
        phoneNumberId: v("WHATSAPP_PHONE_NUMBER_ID"),
        appSecret: v("WHATSAPP_APP_SECRET"),
        verifyToken: v("WHATSAPP_VERIFY_TOKEN"),
        versaoGraph: /^v\d+\.\d+$/.test(v("WHATSAPP_GRAPH_VERSION")) ? v("WHATSAPP_GRAPH_VERSION") : "v23.0",
        ycloudApiKey: v("YCLOUD_API_KEY"),
        ycloudWebhookSecret: v("YCLOUD_WEBHOOK_SECRET"),
        numeroEscritorio: numero ? `+${numero}` : "",
    };
}

/** Pode enviar e receber? (o aviso por template é opcional) */
export function whatsappConfigurado(c: ConfigWhatsApp): boolean {
    if (c.provedor === "ycloud") return Boolean(c.ycloudApiKey && c.ycloudWebhookSecret && c.numeroEscritorio);
    return Boolean(c.token && c.phoneNumberId && c.appSecret && c.verifyToken);
}

/* ------------------------------------------------------------------ Webhook */

export interface MensagemRecebida {
    waMessageId: string;
    /** wa_id de quem mandou (só dígitos). */
    de: string;
    nomeContato: string;
    /** ISO 8601. */
    recebidaEm: string;
    tipo: "texto" | "midia";
    /** Texto da mensagem, ou legenda/rótulo quando é mídia ("[áudio]"). */
    texto: string;
}

/** Coexistência: mensagem que o escritório mandou pelo app WhatsApp Business do celular. */
export interface MensagemDoApp {
    waMessageId: string;
    /** Cliente que recebeu (só dígitos). */
    para: string;
    enviadaEm: string;
    tipo: "texto" | "midia";
    texto: string;
}

export interface StatusEnvio {
    /** Ids pelos quais a mensagem pode ter sido gravada (wamid e, na YCloud, o id interno deles). */
    ids: string[];
    status: "sent" | "delivered" | "read" | "failed";
    erro: string;
}

export interface WebhookLido {
    mensagens: MensagemRecebida[];
    status: StatusEnvio[];
    ecos: MensagemDoApp[];
}

const ROTULO_MIDIA: Record<string, string> = {
    audio: "[áudio]",
    voice: "[áudio]",
    image: "[foto]",
    video: "[vídeo]",
    document: "[documento]",
    sticker: "[figurinha]",
    location: "[localização]",
    contacts: "[contato]",
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function conteudoMensagem(mo: Record<string, unknown>): { tipo: "texto" | "midia"; texto: string } {
    const tipoMsg = str(mo.type);
    let tipo: "texto" | "midia" = "texto";
    let texto = "";
    if (tipoMsg === "text") texto = str(obj(mo.text).body);
    else if (tipoMsg === "button") texto = str(obj(mo.button).text);
    else if (tipoMsg === "interactive") {
        const it = obj(mo.interactive);
        texto = str(obj(it.button_reply).title) || str(obj(it.list_reply).title);
    } else {
        tipo = "midia";
        const legenda = str(obj(mo[tipoMsg]).caption);
        const rotulo = ROTULO_MIDIA[tipoMsg] ?? "[mensagem não suportada]";
        texto = legenda ? `${rotulo} ${legenda}` : rotulo;
    }
    return { tipo, texto: texto.trim().slice(0, 4096) };
}

const isoDeSegundos = (ts: string) => {
    const n = Number(ts);
    return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString();
};
const isoDeTexto = (t: string) => {
    const n = Date.parse(t);
    return Number.isFinite(n) ? new Date(n).toISOString() : new Date().toISOString();
};

function statusValido(s: string): s is StatusEnvio["status"] {
    return s === "sent" || s === "delivered" || s === "read" || s === "failed";
}

/** Formato da Meta (objeto "whatsapp_business_account"). */
function lerWebhookMeta(raiz: Record<string, unknown>, r: WebhookLido): void {
    for (const entry of arr(raiz.entry)) {
        for (const change of arr(obj(entry).changes)) {
            const value = obj(obj(change).value);
            const nomes = new Map<string, string>();
            for (const c of arr(value.contacts)) {
                const co = obj(c);
                nomes.set(str(co.wa_id), str(obj(co.profile).name));
            }

            for (const m of arr(value.messages)) {
                const mo = obj(m);
                const id = str(mo.id);
                const de = normalizarTelefone(str(mo.from));
                if (!id || !de) continue;
                const { tipo, texto } = conteudoMensagem(mo);
                if (!texto) continue;
                r.mensagens.push({
                    waMessageId: id.slice(0, 200),
                    de,
                    nomeContato: (nomes.get(str(mo.from)) ?? "").trim().slice(0, 200),
                    recebidaEm: isoDeSegundos(str(mo.timestamp)),
                    tipo,
                    texto,
                });
            }

            // Campo "smb_message_echoes" (coexistência): o que saiu pelo app do celular.
            for (const e of arr(value.message_echoes)) {
                const eo = obj(e);
                const id = str(eo.id);
                const para = normalizarTelefone(str(eo.to));
                if (!id || !para) continue;
                const { tipo, texto } = conteudoMensagem(eo);
                if (!texto) continue;
                r.ecos.push({ waMessageId: id.slice(0, 200), para, enviadaEm: isoDeSegundos(str(eo.timestamp)), tipo, texto });
            }

            for (const s of arr(value.statuses)) {
                const so = obj(s);
                const st = str(so.status);
                if (!statusValido(st)) continue;
                const erro = obj(arr(so.errors)[0]);
                r.status.push({
                    ids: [str(so.id).slice(0, 200)].filter(Boolean),
                    status: st,
                    erro: [String(erro.code ?? ""), str(erro.title), str(obj(erro.error_data).details)]
                        .filter(Boolean)
                        .join(" · ")
                        .slice(0, 1000),
                });
            }
        }
    }
}

/** Formato da YCloud: um evento por requisição ({ id, type: "whatsapp.…", <objeto> }). */
function lerWebhookYCloud(raiz: Record<string, unknown>, r: WebhookLido): void {
    const tipoEvento = str(raiz.type);

    if (tipoEvento === "whatsapp.inbound_message.received") {
        const m = obj(raiz.whatsappInboundMessage);
        const id = str(m.wamid) || str(m.id);
        const de = normalizarTelefone(str(m.from));
        const { tipo, texto } = conteudoMensagem(m);
        if (id && de && texto) {
            r.mensagens.push({
                waMessageId: id.slice(0, 200),
                de,
                nomeContato: str(obj(m.customerProfile).name).trim().slice(0, 200),
                recebidaEm: isoDeTexto(str(m.sendTime)),
                tipo,
                texto,
            });
        }
        return;
    }

    if (tipoEvento === "whatsapp.smb.message.echoes") {
        const m = obj(raiz.whatsappMessage);
        const id = str(m.wamid) || str(m.id);
        const para = normalizarTelefone(str(m.to));
        const { tipo, texto } = conteudoMensagem(m);
        if (id && para && texto) {
            r.ecos.push({
                waMessageId: id.slice(0, 200),
                para,
                enviadaEm: isoDeTexto(str(m.sendTime) || str(m.createTime)),
                tipo,
                texto,
            });
        }
        return;
    }

    if (tipoEvento === "whatsapp.message.updated") {
        const m = obj(raiz.whatsappMessage);
        const st = str(m.status);
        if (!statusValido(st)) return;
        r.status.push({
            ids: [str(m.wamid), str(m.id)].filter(Boolean).map((x) => x.slice(0, 200)),
            status: st,
            erro: [str(m.errorCode), str(m.errorMessage)].filter(Boolean).join(" · ").slice(0, 1000),
        });
    }
}

/** Lê o corpo do webhook (Meta ou YCloud). Ignora o que não entende. */
export function lerWebhookWhatsApp(body: unknown): WebhookLido {
    const r: WebhookLido = { mensagens: [], status: [], ecos: [] };
    const raiz = obj(body);
    if (raiz.object === "whatsapp_business_account") lerWebhookMeta(raiz, r);
    else if (str(raiz.type).startsWith("whatsapp.")) lerWebhookYCloud(raiz, r);
    return r;
}

/* ------------------------------------------------------------------ Assinatura */

function hexIgual(hex: string, esperado: Buffer): boolean {
    if (!/^[0-9a-f]+$/i.test(hex) || hex.length !== esperado.length * 2) return false;
    return timingSafeEqual(Buffer.from(hex, "hex"), esperado);
}

/** Meta: cabeçalho X-Hub-Signature-256 = HMAC-SHA256 do corpo CRU com o App Secret. */
export function assinaturaMetaValida(corpoCru: string | Buffer, cabecalho: string, appSecret: string): boolean {
    if (!appSecret || !cabecalho.startsWith("sha256=")) return false;
    return hexIgual(cabecalho.slice(7), createHmac("sha256", appSecret).update(corpoCru).digest());
}

/** YCloud: cabeçalho YCloud-Signature "t=<timestamp>,s=<hex>" = HMAC-SHA256 de "<timestamp>.<corpo CRU>". */
export function assinaturaYCloudValida(corpoCru: string | Buffer, cabecalho: string, segredo: string): boolean {
    if (!segredo) return false;
    const partes = new Map(
        cabecalho.split(",").map((p) => {
            const i = p.indexOf("=");
            return [p.slice(0, i).trim(), p.slice(i + 1).trim()] as const;
        }),
    );
    const t = partes.get("t") ?? "";
    const s = partes.get("s") ?? "";
    if (!/^\d{1,13}$/.test(t) || !s) return false;
    const corpo = typeof corpoCru === "string" ? Buffer.from(corpoCru, "utf8") : corpoCru;
    const assinar = (chave: string) =>
        createHmac("sha256", chave).update(Buffer.concat([Buffer.from(`${t}.`, "utf8"), corpo])).digest();
    // A documentação não deixa claro se o prefixo "whsec_" faz parte da chave: aceita as duas formas.
    return hexIgual(s, assinar(segredo)) || (segredo.startsWith("whsec_") && hexIgual(s, assinar(segredo.slice(6))));
}

type Cabecalhos = Record<string, string | string[] | undefined>;
const cab = (h: Cabecalhos, nome: string) => {
    const v = h[nome] ?? h[nome.toLowerCase()];
    return (Array.isArray(v) ? v[0] : v) ?? "";
};

export function webhookAutentico(config: ConfigWhatsApp, corpoCru: string | Buffer, headers: Cabecalhos): boolean {
    return config.provedor === "ycloud"
        ? assinaturaYCloudValida(corpoCru, cab(headers, "ycloud-signature"), config.ycloudWebhookSecret)
        : assinaturaMetaValida(corpoCru, cab(headers, "x-hub-signature-256"), config.appSecret);
}

/* ------------------------------------------------------------------ Envio */

export class ErroWhatsApp extends Error {
    readonly codigo?: number;
    constructor(message: string, codigo?: number) {
        super(message);
        this.codigo = codigo;
    }
}

const MSG_JANELA =
    "Passaram mais de 24h desde a última mensagem do cliente: o WhatsApp só deixa responder depois que ele escrever de novo.";

/** Códigos da Meta para "fora da janela de 24h" (repassados também pela YCloud). */
function foraDaJanela(json: unknown): boolean {
    return /\b(131047|131026)\b|re-?engagement|24[ -]?hour/i.test(JSON.stringify(json ?? ""));
}

async function postarMensagem(config: ConfigWhatsApp, corpo: Record<string, unknown>, fetchFn: typeof fetch): Promise<string> {
    const ycloud = config.provedor === "ycloud";
    let res: Response;
    try {
        res = ycloud
            ? await fetchFn("https://api.ycloud.com/v2/whatsapp/messages/sendDirectly", {
                  method: "POST",
                  signal: AbortSignal.timeout(20_000),
                  headers: { "X-API-Key": config.ycloudApiKey, "Content-Type": "application/json" },
                  body: JSON.stringify({ from: config.numeroEscritorio, ...corpo, to: `+${corpo.to}` }),
              })
            : await fetchFn(`https://graph.facebook.com/${config.versaoGraph}/${config.phoneNumberId}/messages`, {
                  method: "POST",
                  signal: AbortSignal.timeout(15_000),
                  headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...corpo }),
              });
    } catch {
        throw new ErroWhatsApp("Não foi possível falar com o WhatsApp agora. Tente de novo.");
    }
    const json = obj(await res.json().catch(() => ({})));

    if (!res.ok) {
        const e = obj(json.error);
        const codigo = Number(e.code) || undefined;
        if (foraDaJanela(json)) throw new ErroWhatsApp(MSG_JANELA, codigo);
        if (res.status === 401 || res.status === 403 || codigo === 190) {
            throw new ErroWhatsApp(ycloud ? "Chave da YCloud inválida." : "Token do WhatsApp inválido ou expirado.", codigo);
        }
        const motivo = str(e.message) || str(json.message) || String(res.status);
        throw new ErroWhatsApp(`O WhatsApp recusou o envio (${motivo}).`, codigo);
    }

    if (ycloud) {
        // sendDirectly responde com o resultado do envio: "failed" vem com 200 e o erro no corpo.
        if (str(json.status) === "failed") {
            if (foraDaJanela(json)) throw new ErroWhatsApp(MSG_JANELA);
            throw new ErroWhatsApp(`O WhatsApp recusou o envio (${str(json.errorMessage) || str(json.errorCode) || "falhou"}).`);
        }
        const id = str(json.wamid) || str(json.id);
        if (!id) throw new ErroWhatsApp("O WhatsApp não confirmou o envio.");
        return id;
    }
    const id = str(obj(arr(json.messages)[0]).id);
    if (!id) throw new ErroWhatsApp("O WhatsApp não confirmou o envio.");
    return id;
}

export function enviarTextoWhatsApp(opts: {
    config: ConfigWhatsApp;
    para: string;
    texto: string;
    fetchFn?: typeof fetch;
}): Promise<string> {
    return postarMensagem(
        opts.config,
        { to: normalizarTelefone(opts.para), type: "text", text: { body: opts.texto.slice(0, 4096) } },
        opts.fetchFn ?? fetch,
    );
}

/** Parâmetro de template: a Meta recusa quebra de linha, tabulação e mais de 4 espaços seguidos. */
export function parametroTemplate(texto: string, max = 200): string {
    const limpo = texto.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
    return (limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo) || "-";
}

export function enviarTemplateWhatsApp(opts: {
    config: ConfigWhatsApp;
    para: string;
    parametros: string[];
    fetchFn?: typeof fetch;
}): Promise<string> {
    return postarMensagem(
        opts.config,
        {
            to: normalizarTelefone(opts.para),
            type: "template",
            template: {
                name: opts.config.templateAviso,
                language: { code: opts.config.idiomaTemplate },
                components: [
                    { type: "body", parameters: opts.parametros.map((p) => ({ type: "text", text: parametroTemplate(p) })) },
                ],
            },
        },
        opts.fetchFn ?? fetch,
    );
}
