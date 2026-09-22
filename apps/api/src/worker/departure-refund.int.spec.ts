import { Test } from '@nestjs/testing';
import { prisma } from '../auth/auth.config.js';
import { Prisma } from '../generated/prisma/client.js';
import { BookingStatus, DepartureStatus, EmailType } from '../generated/prisma/enums.js';
import { FakeGateway } from '../modules/payments/fake.gateway.js';
import { DepartureRefundService } from './departure-refund.service.js';
import { WorkerModule } from './worker.module.js';

/**
 * Integration (Docker PG, db `tourism_test`) — hàng đợi hoàn tiền của F13
 * (spec P4e-1, ADR-0041 §6).
 *
 * Khác năm queue kia ở một điểm quyết định mọi thứ còn lại: job này MANG
 * PAYLOAD và chạm TIỀN THẬT. Bỏ một lượt không phải là "chờ cron kế" mà là một
 * khách không được hoàn tiền; giao lại hai lượt không phải là "chạy thừa" mà là
 * hoàn hai lần. Nên hai ca đắt nhất ở đây là giao-lại và hoàn-một-phần.
 */

/** Chuyến khởi hành +45 ngày — xa mọi hạn chót, để test không phụ thuộc đồng hồ. */
const FUTURE = new Date(Date.now() + 45 * 86_400_000);

describe('departure-refund worker integration (F13)', () => {
  let service: DepartureRefundService;
  let fake: FakeGateway;
  let userId: string;
  let adminId: string;
  let tourId: string;
  let departureId: string;
  let otherDepartureId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    service = moduleRef.get(DepartureRefundService);
    fake = moduleRef.get(FakeGateway);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE bookings, refunds, cancellation_requests, payment_events, outbox, tour_departures, tours, tour_categories, users RESTART IDENTITY CASCADE',
    );
    fake.reset();

    const user = await prisma.user.create({
      data: { email: 'traveller@example.com', name: 'Traveller' },
    });
    userId = user.id;
    const admin = await prisma.user.create({
      data: { email: 'boss@example.com', name: 'Boss', role: 'ADMIN' },
    });
    adminId = admin.id;
    const category = await prisma.tourCategory.create({
      data: { slug: 'refund-cat', name: 'Refund', order: 1 },
    });
    const tour = await prisma.tour.create({
      data: {
        slug: 'refund-tour',
        title: 'Refund Tour',
        categoryId: category.id,
        durationDays: 1,
        basePrice: '39.00',
        currency: 'USD',
        isPublished: true,
      },
    });
    tourId = tour.id;
    const departure = await prisma.tourDeparture.create({
      data: {
        tourId: tour.id,
        startDate: FUTURE,
        endDate: FUTURE,
        seatsTotal: 20,
        seatsBooked: 3,
        status: DepartureStatus.CANCELLED,
      },
    });
    departureId = departure.id;
    const other = await prisma.tourDeparture.create({
      data: {
        tourId: tour.id,
        startDate: FUTURE,
        endDate: FUTURE,
        seatsTotal: 20,
        seatsBooked: 0,
        status: DepartureStatus.OPEN,
      },
    });
    otherDepartureId = other.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Một booking ĐÃ TRẢ TIỀN, 3 khách, 117.00 USD — dựng thẳng bằng Prisma. */
  async function seedPaidBooking(code = 'BK-REFUND-1'): Promise<string> {
    const row = await prisma.booking.create({
      data: {
        code,
        userId,
        tourId,
        departureId,
        numAdults: 2,
        numChildren: 1,
        totalAmount: '117.00',
        currency: 'USD',
        status: BookingStatus.PAID,
        tourTitle: 'Refund Tour',
        departureStartDate: FUTURE,
        departureEndDate: FUTURE,
        unitPrice: '39.00',
        contactName: 'Alice Nguyen',
        contactEmail: 'alice@example.com',
        paymentProvider: 'STRIPE',
        providerPaymentId: `pi_${code}`,
        paidAt: new Date(),
      } satisfies Prisma.BookingUncheckedCreateInput,
    });
    return row.id;
  }

  const ledger = (bookingId: string) =>
    prisma.refund.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' } });

  it('hoàn TRỌN phần chưa hoàn, huỷ booking và trả ghế về chuyến', async () => {
    const bookingId = await seedPaidBooking();

    const refunded = await service.refundOne({ bookingId, departureId, adminId });

    expect(refunded).toBe('117.00');
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.status).toBe(BookingStatus.CANCELLED);
    const rows = await ledger(bookingId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount.toFixed(2)).toBe('117.00');
    // Ghế trả lại cho chuyến — chuyến đã huỷ thì con số này chỉ còn là sổ sách,
    // nhưng để lệch là để lại một chuyến "còn 3 người" mãi mãi.
    const departure = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: departureId } });
    expect(departure.seatsBooked).toBe(0);
  });

  it('GIAO LẠI cùng một job: hoàn đúng MỘT lần, và không gọi cổng lượt hai', async () => {
    // pg-boss có thể giao lại (worker chết giữa chừng, job hết hạn rồi retry).
    // Chốt chặn là trạng thái booking đọc TRONG khoá: lượt hai thấy CANCELLED
    // nên dừng TRƯỚC cổng thanh toán, không phải sau.
    const bookingId = await seedPaidBooking();

    const first = await service.refundOne({ bookingId, departureId, adminId });
    const second = await service.refundOne({ bookingId, departureId, adminId });

    expect(first).toBe('117.00');
    expect(second).toBeNull();
    expect(await ledger(bookingId)).toHaveLength(1);
    expect(fake.refunds).toHaveLength(1);
  });

  it('booking đã hoàn MỘT PHẦN thì chỉ hoàn phần còn lại', async () => {
    const bookingId = await seedPaidBooking();
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.PARTIALLY_REFUNDED },
    });
    await prisma.refund.create({
      data: {
        bookingId,
        amount: '40.00',
        currency: 'USD',
        providerPaymentId: `pi_BK-REFUND-1`,
        providerRefundId: 're_goodwill_1',
      },
    });

    const refunded = await service.refundOne({ bookingId, departureId, adminId });

    expect(refunded).toBe('77.00');
    // Trigger `refunds_sum_within_total` là lưới cuối; đụng tới nó nghĩa là đã
    // gọi cổng một lượt thừa, nên phép cộng phải đúng TRƯỚC khi ra tới DB.
    const rows = await ledger(bookingId);
    expect(rows.map((row) => row.amount.toFixed(2))).toEqual(['40.00', '77.00']);
  });

  it('job mang departureId LỆCH với booking → bỏ qua, không hoàn đồng nào', async () => {
    // Job cũ còn nằm trong hàng đợi sau khi booking được dời chuyến. Hoàn theo
    // một job đã lạc là hoàn cho một chuyến vẫn đang chạy.
    const bookingId = await seedPaidBooking();

    const refunded = await service.refundOne({
      bookingId,
      departureId: otherDepartureId,
      adminId,
    });

    expect(refunded).toBeNull();
    expect(fake.refunds).toHaveLength(0);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.status).toBe(BookingStatus.PAID);
  });

  it('xếp email BOOKING_CANCELLED đúng MỘT lần cho mỗi booking', async () => {
    const bookingId = await seedPaidBooking();

    await service.refundOne({ bookingId, departureId, adminId });
    await service.refundOne({ bookingId, departureId, adminId });

    const mails = await prisma.outbox.findMany({ where: { type: EmailType.BOOKING_CANCELLED } });
    expect(mails).toHaveLength(1);
    // Payload phải nói đúng ai là người huỷ — câu chữ email hai đường khác nhau.
    const payload = mails[0]?.payload as { initiator?: string } | undefined;
    expect(payload?.initiator).toBe('operator');
  });

  it('cổng thanh toán từ chối → KHÔNG ghi sổ, booking ở nguyên PAID để job retry', async () => {
    // `retryLimit` của queue mới có ý nghĩa đúng nhờ chỗ này: lượt hỏng không
    // để lại nửa trạng thái nào, nên lượt retry bắt đầu từ cùng một điểm.
    const bookingId = await seedPaidBooking();
    fake.failRefunds = true;

    await expect(service.refundOne({ bookingId, departureId, adminId })).rejects.toThrow();

    expect(await ledger(bookingId)).toHaveLength(0);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.status).toBe(BookingStatus.PAID);
  });
});
