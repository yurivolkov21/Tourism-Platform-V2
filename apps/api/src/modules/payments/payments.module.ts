import { forwardRef, Module, type Provider } from '@nestjs/common';
import { env } from '../../config/env.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { AdminPaymentEventsController } from './admin-payment-events.controller.js';
import { AdminPaymentEventsService } from './admin-payment-events.service.js';
import { FakeGateway } from './fake.gateway.js';
import { PAYMENT_GATEWAYS, type PaymentGateway } from './gateway.js';
import { PaymentsService } from './payments.service.js';
import { PayPalGateway } from './paypal.gateway.js';
import { StripeGateway } from './stripe.gateway.js';
import { WebhooksController } from './webhooks.controller.js';

/**
 * Real gateway (W5): mỗi cái CHỈ đăng ký khi bộ env của nó đầy đủ — Stripe cần
 * cặp key+webhook-secret, PayPal cần bộ ba client id/secret + webhook id (host
 * sandbox hardcode; capstone không bao giờ chạy live — spec §1). Thiếu bộ env
 * thì provider đó đơn giản không có trong array, nên các path webhook/create của
 * nó 404 qua resolveGateway (hành vi sẵn có). Production bắt buộc ít nhất một bộ
 * đầy đủ ở thời điểm parse env (superRefine trong env.ts), nên một lần boot prod
 * không bao giờ rơi vào array rỗng.
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
 * Wiring cho payment gateway (spec P2 §3, W1 + W5).
 *
 * `PAYMENT_GATEWAYS` resolve ra `PaymentGateway[]`; consumer chọn theo provider
 * qua `resolveGateway`. Bộ provider được quyết định MỘT LẦN, tại lúc định nghĩa
 * module, dựa trên `NODE_ENV`:
 *
 * - test  → một FakeGateway duy nhất (cũng đăng ký dưới class token riêng để int
 *   test có thể `app.get(FakeGateway)` mà xem session / emit webhook). Chọn cách
 *   này thay vì một PaymentsTestModule riêng vì các int suite boot AppModule
 *   THẬT (theo pattern catalog/auth) — một conditional provider giữ boot path đó
 *   y hệt mà không bao giờ để fake lọt vào graph prod.
 * - dev/prod → các real gateway cấu hình theo env ({@link realGateways}).
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
 * Bổ sung ở W2: {@link WebhooksController} (webhook provider dạng raw-body) +
 * {@link PaymentsService} (idempotency PaymentEvent + dispatch). Vòng lặp module
 * với BookingsModule là có thật và cố ý — BookingsService cần `PAYMENT_GATEWAYS`
 * (checkout khi create), PaymentsService cần `BookingsService.claimSeatsForPaid`
 * (claim PAID khi có webhook) — nên `forwardRef` ở CẢ HAI import.
 *
 * F8 (spec P4c §3-F8, §2.1 "mỗi vùng một module — payments thêm admin-*"):
 * {@link AdminPaymentEventsController} + {@link AdminPaymentEventsService} đọc
 * sổ `payment_events` cho admin. Đọc thuần, không chạm gateway lẫn
 * PaymentsService — chỉ ở chung nhà vì cùng bảng.
 */
@Module({
  imports: [forwardRef(() => BookingsModule)],
  controllers: [WebhooksController, AdminPaymentEventsController],
  providers: [...gatewayProviders, PaymentsService, AdminPaymentEventsService],
  exports: [PAYMENT_GATEWAYS],
})
export class PaymentsModule {}
