/**
 * Online payment provider contract.
 *
 * SECURITY:
 * - Never accept, store, log, or display merchant/owner card numbers,
 *   expiry, CVV/CVC, PIN, or OTP.
 * - Customer card data must only be entered on the payment provider's
 *   hosted checkout (or equivalent). This app only stores provider
 *   transaction references after server-side verification.
 */

export type OnlineCheckoutInput = {
  amountPkr: number | string;
  currency?: string;
  bookingNumber: string;
  bookingId: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
};

export type OnlineCheckoutResult = {
  tracker: string;
  checkoutUrl: string;
  clientToken?: string;
  raw?: unknown;
  mock: boolean;
  provider: string;
};

export const ONLINE_PAYMENT_PROVIDER = Symbol('ONLINE_PAYMENT_PROVIDER');

export interface OnlinePaymentProvider {
  readonly providerName: string;
  createCheckout(input: OnlineCheckoutInput): Promise<OnlineCheckoutResult>;
}
