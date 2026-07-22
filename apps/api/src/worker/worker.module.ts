import { Module, type Provider } from '@nestjs/common';
import { env } from '../config/env.js';
import { ConsoleDeliverer, EMAIL_DELIVERER } from './deliverer.js';
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
  providers: [OutboxService, PendingSweepService, delivererProvider],
  exports: [OutboxService, PendingSweepService],
})
export class WorkerModule {}
