import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createTransport, type SendMailOptions } from "nodemailer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINE_BREAK_RE = /[\r\n]/;

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 5;
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
    if (rateBuckets.size > 500) {
        for (const [key, entry] of rateBuckets.entries()) {
            if (entry.resetAt <= now) {
                rateBuckets.delete(key);
            }
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
    const forwarded = request.headers["x-forwarded-for"];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (typeof first === "string" && first.trim().length > 0) {
        return first.split(",")[0].trim();
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
                auth: {
                    user: emailUser,
                    pass: emailPass,
                },
            });
            await transporter.sendMail(mailOptions);
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
