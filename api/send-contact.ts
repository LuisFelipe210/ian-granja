import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createTransport, type SendMailOptions } from "nodemailer";
import { getHeader, origemPermitida } from "./_http.ts";

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;
const LINE_BREAK_RE = /[\r\n]/;

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 5;
const RATE_MAX_BUCKETS = 1_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export interface ContactData {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
    website: string;
}

export type ParseContactResult =
    | { ok: true; honeypot: boolean; data: ContactData }
    | { ok: false; error: string };

export interface ContactRequest {
    method?: string;
    body?: unknown;
    headers: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string };
}

export interface ContactResponse {
    status: (code: number) => ContactResponse;
    json: (body: unknown) => unknown;
}

export type SendMailFn = (options: SendMailOptions) => Promise<unknown>;

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function parseAndValidateContact(rawBody: unknown): ParseContactResult {
    let parsed: unknown = rawBody;
    if (typeof rawBody === "string") {
        try {
            parsed = JSON.parse(rawBody);
        } catch {
            return { ok: false, error: "Invalid JSON" };
        }
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "Invalid payload" };
    }

    const record = parsed as Record<string, unknown>;
    const str = (key: string) => (typeof record[key] === "string" ? (record[key] as string).trim() : "");

    const name = str("name");
    const email = str("email");
    const phone = str("phone");
    const rawSubject = str("subject").replace(/[\r\n]+/g, " ").trim();
    const subject = rawSubject || "Contato pelo site";
    const message = str("message");
    const website = str("website");

    if (website.length > 0) {
        return {
            ok: true,
            honeypot: true,
            data: { name, email, phone, subject, message, website },
        };
    }

    const validName = name.length >= 1 && name.length <= 120 && !LINE_BREAK_RE.test(name);
    const validEmail = email.length >= 1 && email.length <= 254 && !LINE_BREAK_RE.test(email) && EMAIL_RE.test(email);
    const validPhone = phone.length <= 40 && !LINE_BREAK_RE.test(phone);
    const validSubject = subject.length <= 120;
    const validMessage = message.length >= 1 && message.length <= 5000;

    if (!validName || !validEmail || !validPhone || !validSubject || !validMessage) {
        return { ok: false, error: "Dados inválidos ou incompletos." };
    }

    return {
        ok: true,
        honeypot: false,
        data: { name, email, phone, subject, message, website },
    };
}

export function checkRateLimit(ip: string, now = Date.now()): boolean {
    if (rateBuckets.size >= RATE_MAX_BUCKETS) {
        for (const [key, entry] of rateBuckets.entries()) {
            if (entry.resetAt <= now) {
                rateBuckets.delete(key);
            }
        }
        // Evicção FIFO caso todas as entradas ainda estejam dentro da janela (proteção contra DoS de memória).
        while (rateBuckets.size >= RATE_MAX_BUCKETS) {
            const oldestKey = rateBuckets.keys().next().value;
            if (oldestKey === undefined) break;
            rateBuckets.delete(oldestKey);
        }
    }

    const existing = rateBuckets.get(ip);
    if (!existing || existing.resetAt <= now) {
        rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }

    if (existing.count >= RATE_MAX_REQUESTS) {
        return false;
    }

    existing.count += 1;
    return true;
}

export function resetRateLimit(): void {
    rateBuckets.clear();
}

function extractClientIp(request: ContactRequest): string {
    // Na Vercel, x-vercel-forwarded-for e x-real-ip são definidos pelo edge e não forjáveis pelo cliente.
    const vercelIp = getHeader(request.headers, "x-vercel-forwarded-for").split(",")[0].trim();
    if (vercelIp) return vercelIp;
    const realIp = getHeader(request.headers, "x-real-ip").trim();
    if (realIp) return realIp;
    const forwarded = getHeader(request.headers, "x-forwarded-for");
    if (forwarded.trim().length > 0) {
        return forwarded.split(",")[0].trim();
    }
    return request.socket?.remoteAddress || "unknown";
}

export async function handleContactRequest(
    request: ContactRequest,
    response: ContactResponse,
    sendMailFn?: SendMailFn,
) {
    if (request.method !== "POST") {
        return response.status(405).json({ message: "Method not allowed" });
    }

    const origin = getHeader(request.headers, "origin").trim();
    if (origin && !origemPermitida(origin)) {
        return response.status(403).json({ message: "Origin not allowed" });
    }

    const ip = extractClientIp(request);
    if (!checkRateLimit(ip)) {
        return response.status(429).json({ message: "Too many requests" });
    }

    const parsed = parseAndValidateContact(request.body);
    if (!parsed.ok) {
        return response.status(400).json({ message: parsed.error });
    }

    if (parsed.honeypot) {
        return response.status(200).json({ message: "Email sent successfully" });
    }

    const { name, email, phone, subject, message } = parsed.data;
    const phoneDisplay = phone || "Não informado";

    try {
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;
        const emailTo = process.env.EMAIL_TO;

        if (!sendMailFn && (!emailUser || !emailPass || !emailTo)) {
            console.error("Missing email environment configuration");
            return response.status(500).json({ message: "Internal server error" });
        }

        const mailOptions: SendMailOptions = {
            from: emailUser ?? "",
            to: emailTo ?? "",
            replyTo: email,
            subject: `Novo contato pelo site: ${subject}`,
            text: [
                `Nome: ${name}`,
                `Email: ${email}`,
                `Telefone: ${phoneDisplay}`,
                "",
                "Mensagem:",
                message,
            ].join("\n"),
            html: [
                "<h3>Novo contato recebido via site</h3>",
                `<p><strong>Nome:</strong> ${escapeHtml(name)}</p>`,
                `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
                `<p><strong>Telefone:</strong> ${escapeHtml(phoneDisplay)}</p>`,
                "<br/>",
                "<p><strong>Mensagem:</strong></p>",
                `<p>${escapeHtml(message).replace(/\r?\n/g, "<br>")}</p>`,
            ].join("\n"),
        };

        if (sendMailFn) {
            await sendMailFn(mailOptions);
        } else {
            const transporter = createTransport({
                service: "gmail",
                connectionTimeout: 8_000,
                greetingTimeout: 8_000,
                socketTimeout: 10_000,
                auth: {
                    user: emailUser,
                    pass: emailPass,
                },
            });
            try {
                await transporter.sendMail(mailOptions);
            } finally {
                transporter.close();
            }
        }

        return response.status(200).json({ message: "Email sent successfully" });
    } catch (error) {
        console.error("Error sending email:", error);
        return response.status(500).json({ message: "Internal server error" });
    }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
    return handleContactRequest(request, response);
}
