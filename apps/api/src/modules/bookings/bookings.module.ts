import { forwardRef, Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { AdminBookingsController } from './admin-bookings.controller.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { RefundsService } from './refunds.service.js';

/**
 * `forwardRef`: BookingsModule ↔ PaymentsModule is a real cycle (W2) —
 * BookingsService and RefundsService consume PAYMENT_GATEWAYS, PaymentsService
 * consumes BookingsService.claimSeatsForPaid. See payments.module.ts.
 */
@Module({
  imports: [forwardRef(() => PaymentsModule)],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService, RefundsService],
  exports: [BookingsService, RefundsService],
})
export class BookingsModule {}
