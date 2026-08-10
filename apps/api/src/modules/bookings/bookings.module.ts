import { forwardRef, Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { AdminBookingsController } from './admin-bookings.controller.js';
import { AdminCancellationsController } from './admin-cancellations.controller.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { CancellationsService } from './cancellations.service.js';
import { RefundsService } from './refunds.service.js';

/**
 * `forwardRef`: BookingsModule ↔ PaymentsModule là một cycle thật (W2) —
 * BookingsService và RefundsService tiêu thụ PAYMENT_GATEWAYS, còn
 * PaymentsService tiêu thụ BookingsService.claimSeatsForPaid. Xem
 * payments.module.ts. CancellationsService (W4) nằm ở đây thay vì module riêng:
 * nó là chân thứ ba của cùng money-path (tái dùng bước gateway của RefundsService
 * và các booking mapper).
 */
@Module({
  imports: [forwardRef(() => PaymentsModule), MediaModule],
  controllers: [BookingsController, AdminBookingsController, AdminCancellationsController],
  providers: [BookingsService, RefundsService, CancellationsService],
  exports: [BookingsService, RefundsService, CancellationsService],
})
export class BookingsModule {}
