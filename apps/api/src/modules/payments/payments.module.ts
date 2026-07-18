import { forwardRef, Module, type Provider } from '@nestjs/common';
import { env } from '../../config/env.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { FakeGateway } from './fake.gateway.js';
import { PAYMENT_GATEWAYS, type PaymentGateway } from './gateway.js';
import { PaymentsService } from './payments.service.js';
import { PayPalGateway } from './paypal.gateway.js';
import { StripeGateway } from './stripe.gateway.js';
import { WebhooksController } from './webhooks.controller.js';

/**
 * Real gateways (W5): each registers ONLY when its env set is complete —
 * Stripe needs the key+webhook-secret pair, PayPal the client id/secret +
 * webhook id trio (sandbox host is hardcoded; the capstone never runs live —
 * spec §1). A missing set simply leaves that provider out of the array, so
 * its webhook/create paths 404 via resolveGateway (existing behavior).
 * Production requires at least one full set at env parse time (env.ts
 * superRefine), so a prod boot can never end up with an empty array.
 */
function realGateways(): PaymentGateway[] {
  const gateways: PaymentGateway[] = [];
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    gateways.push(
      new StripeGateway({
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      }),
    );
  }
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID) {
    gateways.push(
      new PayPalGateway({
        clientId: env.PAYPAL_CLIENT_ID,
        clientSecret: env.PAYPAL_CLIENT_SECRET,
        webhookId: env.PAYPAL_WEBHOOK_ID,
      }),
    );
  }
  return gateways;
}

/**
 * Payment gateway wiring (spec P2 §3, W1 + W5).
 *
 * `PAYMENT_GATEWAYS` resolves to `PaymentGateway[]`; consumers pick by
 * provider via `resolveGateway`. Provider set is decided ONCE, at module
 * definition, off `NODE_ENV`:
 *
 * - test  → a single FakeGateway (also registered under its own class token so
 *   int tests can `app.get(FakeGateway)` to inspect sessions / emit webhooks).
 *   Chosen over a separate PaymentsTestModule because the int suites boot the
 *   REAL AppModule (catalog/auth pattern) — a conditional provider keeps that
 *   boot path identical while never letting the fake into a prod graph.
 * - dev/prod → the env-configured real gateways ({@link realGateways}).
 */
const gatewayProviders: Provider[] =
  env.NODE_ENV === 'test'
    ? [
        { provide: FakeGateway, useValue: new FakeGateway() },
        {
          provide: PAYMENT_GATEWAYS,
          useFactory: (fake: FakeGateway) => [fake],
          inject: [FakeGateway],
        },
      ]
    : [{ provide: PAYMENT_GATEWAYS, useValue: realGateways() }];

/**
 * W2 additions: {@link WebhooksController} (raw-body provider webhooks) +
 * {@link PaymentsService} (PaymentEvent idempotency + dispatch). The module
 * cycle with BookingsModule is real and intentional — BookingsService needs
 * `PAYMENT_GATEWAYS` (checkout at create), PaymentsService needs
 * `BookingsService.claimSeatsForPaid` (PAID claim on webhook) — hence
 * `forwardRef` on BOTH imports.
 */
@Module({
  imports: [forwardRef(() => BookingsModule)],
  controllers: [WebhooksController],
  providers: [...gatewayProviders, PaymentsService],
  exports: [PAYMENT_GATEWAYS],
})
export class PaymentsModule {}
