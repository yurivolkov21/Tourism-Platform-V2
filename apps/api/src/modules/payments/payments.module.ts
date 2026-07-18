import { forwardRef, Module, type Provider } from '@nestjs/common';
import { env } from '../../config/env.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { FakeGateway } from './fake.gateway.js';
import { PAYMENT_GATEWAYS } from './gateway.js';
import { PaymentsService } from './payments.service.js';
import { WebhooksController } from './webhooks.controller.js';

/**
 * Payment gateway wiring (spec P2 §3, W1).
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
 * - dev/prod → empty until W5 lands StripeGateway/PayPalGateway here (booking
 *   create then fails fast in resolveGateway with a clear message).
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
    : [{ provide: PAYMENT_GATEWAYS, useValue: [] }];

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
