import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  OnlineCheckoutInput,
  OnlineCheckoutResult,
  OnlinePaymentProvider,
} from './online-payment.types';
import { SafepayService } from './safepay.service';

/**
 * Resolves checkout provider.
 * Default: bank_transfer (manual IBAN + staff verification).
 * Optional: safepay / mock for gateway checkout.
 */
@Injectable()
export class OnlinePaymentGatewayService implements OnlinePaymentProvider {
  private readonly logger = new Logger(OnlinePaymentGatewayService.name);

  constructor(private readonly safepay: SafepayService) {}

  get providerName(): string {
    return this.activeProvider();
  }

  get isBankTransfer(): boolean {
    return this.activeProvider() === 'bank_transfer';
  }

  async createCheckout(
    input: OnlineCheckoutInput,
  ): Promise<OnlineCheckoutResult> {
    const provider = this.activeProvider();

    if (provider === 'bank_transfer') {
      const websiteUrl = (
        process.env.WEBSITE_URL?.trim() || 'http://localhost:3001'
      ).replace(/\/$/, '');
      const tracker = `bank_${randomUUID()}`;
      const checkoutUrl = `${websiteUrl}/booking/payment?ref=${encodeURIComponent(input.bookingNumber)}`;
      this.logger.log(
        `Bank transfer hold created for ${input.bookingNumber} → ${checkoutUrl}`,
      );
      return {
        tracker,
        checkoutUrl,
        mock: false,
        provider: 'bank_transfer',
      };
    }

    if (provider === 'sadabiz') {
      throw new BadRequestException(
        'SadaBiz is not configured. Use ONLINE_PAYMENT_PROVIDER=bank_transfer for manual IBAN payments.',
      );
    }

    const result = await this.safepay.createCheckout(input);
    this.logger.log(
      `Hosted checkout created via ${provider} for ${input.bookingNumber}`,
    );
    return {
      ...result,
      provider: result.mock ? 'mock' : 'safepay',
    };
  }

  private activeProvider(): string {
    const raw = (process.env.ONLINE_PAYMENT_PROVIDER ?? 'bank_transfer')
      .trim()
      .toLowerCase();
    if (raw === 'safepay' || raw === 'mock' || raw === 'sadabiz') return raw;
    return 'bank_transfer';
  }
}
