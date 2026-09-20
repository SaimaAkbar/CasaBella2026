import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

export type SendMailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly fromAddress: string | null;

  constructor() {
    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    this.fromAddress =
      process.env.SMTP_FROM?.trim() ||
      process.env.ADMIN_NOTIFICATION_EMAIL?.trim() ||
      null;

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP not fully configured (SMTP_HOST/SMTP_USER/SMTP_PASS); outbound email disabled',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  isConfigured() {
    return this.transporter !== null && Boolean(this.fromAddress);
  }

  async send(input: SendMailInput): Promise<boolean> {
    if (!this.transporter || !this.fromAddress) {
      this.logger.warn(
        `Skipping email "${input.subject}" — SMTP not configured`,
      );
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `Failed to send email "${input.subject}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
