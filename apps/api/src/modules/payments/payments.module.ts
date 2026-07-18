import { Module, type Provider } from '@nestjs/common';
import { env } from '../../config/env.js';
import { FakeGateway } from './fake.gateway.js';
import { PAYMENT_GATEWAYS } from './gateway.js';

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

@Module({
  providers: gatewayProviders,
  exports: [PAYMENT_GATEWAYS],
})
export class PaymentsModule {}
