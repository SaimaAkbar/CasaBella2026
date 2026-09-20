import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';

export type SafepayCheckoutResult = {
  tracker: string;
  checkoutUrl: string;
  clientToken?: string;
  raw?: unknown;
  mock: boolean;
};

@Injectable()
export class SafepayService {
  private readonly logger = new Logger(SafepayService.name);

  get environment(): 'sandbox' | 'production' | 'mock' {
    const value = (process.env.SAFE_PAY_ENVIRONMENT ?? 'mock')
      .trim()
      .toLowerCase();
    if (value === 'production' || value === 'sandbox' || value === 'mock') {
      return value;
    }
    return 'mock';
  }

  get isMock(): boolean {
    // Mock ONLY when explicitly requested — never fall back silently
    // just because API keys are missing (that caused fake "paid" bookings).
    return this.environment === 'mock';
  }

  assertLiveKeysConfigured() {
    const apiKey = process.env.SAFE_PAY_API_KEY?.trim();
    const secretKey = process.env.SAFE_PAY_SECRET_KEY?.trim();
    if (!apiKey || !secretKey) {
      throw new BadRequestException(
        'Real online payments are not configured. Add SAFE_PAY_API_KEY and SAFE_PAY_SECRET_KEY from your Safepay merchant dashboard, set SAFE_PAY_ENVIRONMENT=sandbox (or production), and restart the backend. We never collect card numbers on this website — customers pay on Safepay hosted checkout so money goes to your merchant account.',
      );
    }
  }

  getPublicConfig() {
    const hasKeys = Boolean(
      process.env.SAFE_PAY_API_KEY?.trim() &&
        process.env.SAFE_PAY_SECRET_KEY?.trim(),
    );
    const canStartCheckout = this.isMock || hasKeys;
    return {
      provider: 'safepay',
      mode: this.environment,
      acceptsRealCards: !this.isMock && hasKeys,
      canStartCheckout,
      message: this.isMock
        ? 'TEST MODE: payments are simulated. No money is collected. Set SAFE_PAY_ENVIRONMENT=sandbox and add Safepay merchant API keys for real card payments into your account.'
        : !hasKeys
          ? 'Safepay merchant API keys are missing. Add SAFE_PAY_API_KEY and SAFE_PAY_SECRET_KEY in backend/.env, then restart the server.'
          : 'Customers pay on Safepay secure checkout. Card details are never stored in Casa Bella. Funds settle to your Safepay merchant account.',
    };
  }

  private get apiHost(): string {
    return this.environment === 'production'
      ? 'https://api.getsafepay.com'
      : 'https://sandbox.api.getsafepay.com';
  }

  private get websiteUrl(): string {
    return (
      process.env.WEBSITE_URL?.trim() ||
      'http://localhost:3001'
    ).replace(/\/$/, '');
  }

  private get intent(): string {
    return process.env.SAFE_PAY_INTENT?.trim() || 'CYBERSOURCE';
  }

  /** Convert PKR decimal amount to paisa (minor units). */
  toMinorUnits(amountPkr: number | string): number {
    const n = typeof amountPkr === 'string' ? Number(amountPkr) : amountPkr;
    if (!Number.isFinite(n) || n <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
    return Math.round(n * 100);
  }

  async createCheckout(input: {
    amountPkr: number | string;
    currency?: string;
    bookingNumber: string;
    bookingId: string;
    customerEmail?: string | null;
    customerPhone?: string | null;
  }): Promise<SafepayCheckoutResult> {
    const currency = input.currency ?? 'PKR';
    const amountMinor = this.toMinorUnits(input.amountPkr);

    if (this.isMock) {
      const tracker = `mock_${randomUUID()}`;
      const checkoutUrl = `${this.websiteUrl}/booking/mock-pay?bookingNumber=${encodeURIComponent(input.bookingNumber)}&tracker=${encodeURIComponent(tracker)}`;
      this.logger.warn(
        `SAFE_PAY mock checkout for ${input.bookingNumber} → ${checkoutUrl}`,
      );
      return { tracker, checkoutUrl, mock: true };
    }

    this.assertLiveKeysConfigured();
    const apiKey = process.env.SAFE_PAY_API_KEY!.trim();
    const secretKey = process.env.SAFE_PAY_SECRET_KEY!.trim();

    try {
      const session = await this.postJson<{
        data?: { tracker?: { token?: string } };
        tracker?: { token?: string };
      }>('/order/payments/v3/', {
        merchant_api_key: apiKey,
        intent: this.intent,
        mode: 'payment',
        entry_mode: 'raw',
        currency,
        amount: amountMinor,
        metadata: {
          bookingNumber: input.bookingNumber,
          bookingId: input.bookingId,
          email: input.customerEmail ?? undefined,
          phone: input.customerPhone ?? undefined,
        },
        include_fees: false,
      });

      const tracker =
        session?.data?.tracker?.token ?? session?.tracker?.token;
      if (!tracker) {
        throw new Error('Safepay session response missing tracker token');
      }

      const passport = await this.postJson<{ data?: string }>(
        '/client/passport/v1/token',
        {},
      );
      const clientToken =
        typeof passport?.data === 'string' ? passport.data : undefined;
      if (!clientToken) {
        throw new Error('Safepay passport response missing client token');
      }

      const checkoutUrl = this.buildHostedCheckoutUrl(
        tracker,
        clientToken,
        input.bookingNumber,
      );
      return {
        tracker,
        checkoutUrl,
        clientToken,
        raw: session,
        mock: false,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Safepay checkout failed';
      this.logger.error(`Safepay createCheckout failed: ${message}`);
      throw new BadRequestException(
        `Unable to start Safepay checkout: ${message}`,
      );
    }
  }

  buildHostedCheckoutUrl(tracker: string, tbt: string, bookingNumber?: string): string {
    const environment =
      this.environment === 'production' ? 'production' : 'sandbox';
    const base =
      environment === 'production'
        ? 'https://getsafepay.com/embed/payment'
        : `${this.apiHost}/embedded`;
    const confirmation = bookingNumber
      ? `${this.websiteUrl}/booking/confirmation?ref=${encodeURIComponent(bookingNumber)}`
      : `${this.websiteUrl}/booking/confirmation`;
    const params = new URLSearchParams({
      environment,
      tracker,
      tbt,
      source: 'hosted',
      redirect_url: confirmation,
      cancel_url: `${this.websiteUrl}/booking?cancelled=1`,
    });
    return `${base}?${params.toString()}`;
  }

  verifyWebhookSignature(
    rawBody: Buffer | string,
    timestamp: string | undefined,
    signature: string | undefined,
  ): boolean {
    const secret = process.env.SAFE_PAY_WEBHOOK_SECRET?.trim() ?? '';
    if (!secret) {
      if (this.environment === 'mock') {
        return true;
      }
      throw new UnauthorizedException('SAFE_PAY_WEBHOOK_SECRET is not configured');
    }

    if (!timestamp || !signature) {
      return false;
    }

    const body =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const payload = `${timestamp}.${body}`;
    const expected = createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    const provided = signature.replace(/^sha256=/i, '').trim();
    try {
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(provided, 'hex');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return expected === provided;
    }
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const secretKey = process.env.SAFE_PAY_SECRET_KEY!.trim();
    const response = await fetch(`${this.apiHost}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let json: T | null = null;
    try {
      json = text ? (JSON.parse(text) as T) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      throw new Error(
        `Safepay ${path} → HTTP ${response.status}: ${text.slice(0, 400)}`,
      );
    }

    return json as T;
  }
}
