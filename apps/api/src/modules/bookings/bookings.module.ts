import { forwardRef, Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

/**
 * `forwardRef`: BookingsModule ↔ PaymentsModule is a real cycle (W2) —
 * BookingsService consumes PAYMENT_GATEWAYS, PaymentsService consumes
 * BookingsService.claimSeatsForPaid. See payments.module.ts.
 */
@Module({
  imports: [forwardRef(() => PaymentsModule)],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
