import { Module } from '@nestjs/common';
import { ConsoleDeliverer, EMAIL_DELIVERER } from './deliverer.js';
import { OutboxService } from './outbox.service.js';

/**
 * Module cho worker process (src/worker.ts) — chỉ outbox consumer + deliverer,
 * không HTTP. P2: đổi binding EMAIL_DELIVERER sang ResendDeliverer.
 */
@Module({
  providers: [OutboxService, { provide: EMAIL_DELIVERER, useClass: ConsoleDeliverer }],
  exports: [OutboxService],
})
export class WorkerModule {}
