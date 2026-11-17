import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    escapeHtml,
    handleContactRequest,
    resetRateLimit,
    type ContactRequest,
    type ContactResponse,
} from "../api/send-contact.ts";
import type { SendMailOptions } from "nodemailer";

const createMockRes = () => {
    let statusCode = 200;
    let body: unknown = null;
    const res: ContactResponse = {
        status(code: number) {
            statusCode = code;
            return res;
        },
        json(payload: unknown) {
            body = payload;
            return res;
        },
    };
    return {
        res,
        getStatus: () => statusCode,
        getBody: () => body,
    };
};

const baseReq = (overrides: Partial<ContactRequest> = {}): ContactRequest => ({
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.1" },
    body: {
        name: "Maria Silva",
        email: "maria@example.com",
        phone: "(87) 99999-0000",
        subject: "Contato pelo site",
        message: "Preciso analisar um contrato.",
        website: "",
    },
    ...overrides,
});

describe("api/send-contact", () => {
    beforeEach(() => {
        resetRateLimit();
    });

    it("escapeHtml neutraliza tags e aspas", () => {
        assert.equal(
            escapeHtml(`<script>alert("xss")</script> & 'ok'`),
            "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;ok&#39;",
        );
    });

    it("rejeita método diferente de POST com 405", async () => {
        const mock = createMockRes();
        await handleContactRequest(baseReq({ method: "GET" }), mock.res, async () => {});
        assert.equal(mock.getStatus(), 405);
    });

    it("retorna 400 para payload inválido, JSON malformado ou cabeçalho com quebra de linha", async () => {
        for (const badBody of [
            null,
            "{bad json",
            { name: "Ana", email: "ana@example.com" },
            { name: "Ana", email: "invalido", message: "oi" },
            { name: "Ana", email: "ana@example.com\r\nBcc: x@y.com", message: "oi" },
            { name: "Ana\nSobrenome", email: "ana@example.com", message: "oi" },
        ]) {
            resetRateLimit();
            const mock = createMockRes();
            await handleContactRequest(baseReq({ body: badBody }), mock.res, async () => {});
            assert.equal(mock.getStatus(), 400);
        }
    });

    it("honeypot preenchido responde 200 sem disparar e-mail", async () => {
        let called = false;
        const mock = createMockRes();
        await handleContactRequest(
            baseReq({
                body: {
                    name: "Bot",
                    email: "bot@example.com",
                    message: "spam",
                    website: "https://spam.example",
                },
            }),
            mock.res,
            async () => {
                called = true;
            },
        );
        assert.equal(mock.getStatus(), 200);
        assert.equal(called, false);
    });

    it("envio válido escapa HTML no corpo e retorna 200", async () => {
        const sent: SendMailOptions[] = [];
        const mock = createMockRes();
        await handleContactRequest(
            baseReq({
                body: {
                    name: 'João <img src=x onerror=alert(1)>',
                    email: "joao@example.com",
                    phone: "",
                    subject: "Dúvida\r\nBcc: attacker@example.com",
                    message: "Linha 1\n<script>alert(1)</script>",
                    website: "",
                },
            }),
            mock.res,
            async (opts) => {
                sent.push(opts);
            },
        );

        assert.equal(mock.getStatus(), 200);
        assert.equal(sent.length, 1);
        const html = String(sent[0].html);
        assert.ok(!html.includes("<script>"));
        assert.ok(!html.includes("<img "));
        assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assert.ok(html.includes("Linha 1<br>&lt;script&gt;"));
        assert.ok(!String(sent[0].subject).includes("\n"));
    });

    it("aplica rate limit por IP na 6ª requisição", async () => {
        for (let i = 0; i < 5; i++) {
            const ok = createMockRes();
            await handleContactRequest(baseReq({ headers: { "x-forwarded-for": "203.0.113.10" } }), ok.res, async () => {});
            assert.equal(ok.getStatus(), 200);
        }

        const blocked = createMockRes();
        await handleContactRequest(baseReq({ headers: { "x-forwarded-for": "203.0.113.10" } }), blocked.res, async () => {});
        assert.equal(blocked.getStatus(), 429);

        const otherIp = createMockRes();
        await handleContactRequest(baseReq({ headers: { "x-forwarded-for": "203.0.113.11" } }), otherIp.res, async () => {});
        assert.equal(otherIp.getStatus(), 200);
    });
});
