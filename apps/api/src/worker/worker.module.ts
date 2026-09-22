import { Module, type Provider } from '@nestjs/common';
import { env } from '../config/env.js';
import { BookingsModule } from '../modules/bookings/bookings.module.js';
import { MediaGarbageModule } from '../modules/media/media-garbage.module.js';
import { ConsoleDeliverer, EMAIL_DELIVERER } from './deliverer.js';
import { DepartureRefundService } from './departure-refund.service.js';
import { EnquiryRetentionService } from './enquiry-retention.service.js';
import { OutboxService } from './outbox.service.js';
import { PendingSweepService } from './pending-sweep.service.js';
import { ResendDeliverer } from './resend.deliverer.js';

/**
 * Module cho worker process (src/worker.ts) — chỉ outbox consumer + deliverer,
 * không HTTP. P2 W5: RESEND_API_KEY set → ResendDeliverer (gửi thật qua
 * Resend API); không set → giữ ConsoleDeliverer P1 (dev/test boots không cần
 * email — pattern Nexora). Quyết định một lần ở module definition, giống
 * gatewayProviders bên payments.module.
 */
const delivererProvider: Provider = env.RESEND_API_KEY
  ? {
      provide: EMAIL_DELIVERER,
      useValue: new ResendDeliverer({
        apiKey: env.RESEND_API_KEY,
        from: env.EMAIL_FROM,
        frontendUrl: env.FRONTEND_URL,
      }),
    }
  : { provide: EMAIL_DELIVERER, useClass: ConsoleDeliverer };

@Module({
  // ADR-0035: worker chạy cron dọn ảnh mồ côi. Import `MediaGarbageModule`
  // chứ KHÔNG `MediaModule` — module kia khai `MediaController` mang
  // ThrottlerGuard, mà worker không dựng tầng HTTP nên context chết ngay
  // lúc bootstrap (đo được: ba int spec worker đỏ).
  // `BookingsModule` (F13): hàng đợi hoàn tiền dùng LẠI lõi huỷ của money-path
  // thay vì chép lại CTE huỷ-ghi-sổ-trả-ghế. Kéo cả module vào được — khác
  // `MediaModule` ở trên, controller của nó không đòi `THROTTLER:MODULE_OPTIONS`
  // (đo bằng cách dựng context worker thật, không suy từ hình dạng file).
  imports: [MediaGarbageModule, BookingsModule],
  providers: [
    OutboxService,
    PendingSweepService,
    EnquiryRetentionService,
    DepartureRefundService,
    delivererProvider,
  ],
  exports: [OutboxService, PendingSweepService, EnquiryRetentionService, DepartureRefundService],
})
export class WorkerModule {}
