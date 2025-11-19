import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(
    request: VercelRequest,
    response: VercelResponse
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method not allowed' });
    }

    const { name, email, phone, subject, message } = request.body;

    if (!name || !email || !message) {
        return response.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_TO,
            replyTo: email,
            subject: `Novo contato pelo site: ${subject || 'Sem assunto'}`,
            text: `
        Nome: ${name}
        Email: ${email}
        Telefone: ${phone}
        
        Mensagem:
        ${message}
      `,
            html: `
        <h3>Novo contato recebido via site</h3>
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Telefone:</strong> ${phone}</p>
        <br/>
        <p><strong>Mensagem:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
        };

        await transporter.sendMail(mailOptions);

        return response.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        return response.status(500).json({ message: 'Internal server error' });
    }
}