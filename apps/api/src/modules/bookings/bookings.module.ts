import { forwardRef, Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { AdminBookingsController } from './admin-bookings.controller.js';
import { AdminCancellationsController } from './admin-cancellations.controller.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { CancellationsService } from './cancellations.service.js';
import { RefundsService } from './refunds.service.js';

/**
 * `forwardRef`: BookingsModule ↔ PaymentsModule is a real cycle (W2) —
 * BookingsService and RefundsService consume PAYMENT_GATEWAYS, PaymentsService
 * consumes BookingsService.claimSeatsForPaid. See payments.module.ts.
 * CancellationsService (W4) lives here rather than its own module: it is the
 * third leg of the same money-path (reuses RefundsService's gateway step and
 * the booking mappers).
 */
@Module({
  imports: [forwardRef(() => PaymentsModule)],
  controllers: [BookingsController, AdminBookingsController, AdminCancellationsController],
  providers: [BookingsService, RefundsService, CancellationsService],
  exports: [BookingsService, RefundsService, CancellationsService],
})
export class BookingsModule {}
