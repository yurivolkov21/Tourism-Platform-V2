import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AdminMonthlyReportSchema, BookingStatusSchema } from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  BookingStatus,
  CancellationRequestStatus,
  DepartureStatus,
  PaymentProvider,
  ReviewSource,
} from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test) — báo cáo tháng (spec P4b §3-F6).
 *
 * Khác `stats.int.spec.ts` ở một điểm quyết định: mọi mốc là NGÀY CỐ ĐỊNH của
 * lịch (tháng 5/2026), không phải "cách đây N ngày". Đó chính là lời hứa của
 * báo cáo tháng — cùng một `?month=` cho cùng con số dù đọc lúc nào — nên
 * test phải neo như vậy thì mới khoá được lời hứa đó.
 *
 * Mỗi metric có dữ liệu ở BA chỗ: trong tháng, tháng liền trước và tháng liền
 * sau. Một biên lệch nửa ngày sẽ kéo hàng xóm vào và hiện ra ngay.
 */

const PUBLISHED_SLUG = 'hoi-an-lantern-evening';
const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test'; // ADMIN_EMAILS (int config)
const CUSTOMER_EMAIL = 'reports-customer@tourism.test';

/** Tháng được báo cáo, và hai tháng hàng xóm dùng làm nhiễu. */
const MONTH = '2026-05';

function requireFixtureTour(slug: string) {
  const found = catalog.tours.find((t) => t.slug === slug);
  if (!found) throw new Error(`fixture tour missing: ${slug}`);
  return found;
}

const tour = requireFixtureTour(PUBLISHED_SLUG);
const DAY = 86_400_000;

/** Mốc UTC tường minh — đọc ra là biết nó nằm ở tháng nào. */
const at = (iso: string): Date => new Date(iso);

/** Lấy cookie pair (name=value) từ set-cookie của inject response. */
function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = (Array.isArray(raw) ? raw : [raw]).filter(
    (c): c is string => typeof c === 'string',
  );
  const session = cookies.find((c) => c.includes('session_token'));
  if (!session) throw new Error(`No session cookie in: ${JSON.stringify(raw)}`);
  const pair = session.split(';')[0];
  if (!pair) throw new Error('Malformed set-cookie');
  return pair;
}

describe('admin monthly report integration (F6)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let customerId: string;

  const future45 = new Date(Date.now() + 45 * DAY);
  const dep = {
    id: 'e9600001-0000-4000-8000-000000000001',
    tourId: tour.id,
    startDate: future45,
    endDate: new Date(future45.getTime() + DAY),
    seatsTotal: 500,
    seatsBooked: 0,
    status: DepartureStatus.OPEN,
  } satisfies Prisma.TourDepartureCreateManyInput;

  const bookingId = (n: number) => `e9600002-0000-4000-8000-${String(n).padStart(12, '0')}`;

  function booking(
    n: number,
    row: { status: BookingStatus; total: string; createdAt: Date; paidAt: Date | null },
  ): Prisma.BookingCreateManyInput {
    return {
      id: bookingId(n),
      code: `BK-RPRT${String(n).padStart(4, '0')}`,
      userId: customerId,
      tourId: tour.id,
      departureId: dep.id,
      numAdults: 1,
      numChildren: 0,
      totalAmount: row.total,
      unitPrice: row.total,
      currency: 'USD',
      status: row.status,
      tourTitle: tour.title,
      departureStartDate: dep.startDate,
      departureEndDate: dep.endDate,
      contactName: 'Ada Lovelace',
      contactEmail: CUSTOMER_EMAIL,
      paymentProvider: PaymentProvider.STRIPE,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
    };
  }

  /** GET báo cáo của một tháng. */
  const get = (month: string, cookie: string) =>
    app.inject({
      method: 'GET',
      url: `/api/admin/reports/monthly?month=${month}`,
      headers: { cookie },
    });

  const report = async (month = MONTH) => {
    const res = await get(month, adminCookie);
    expect(res.statusCode).toBe(200);
    return AdminMonthlyReportSchema.parse(res.json());
  };

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE tour_categories, destinations, users, payment_events, outbox CASCADE',
    );
    await prisma.tourCategory.createMany({ data: catalog.tourCategories });
    await prisma.destination.createMany({ data: catalog.destinations });
    await prisma.tour.createMany({ data: [tour] as unknown as Prisma.TourCreateManyInput[] });
    await prisma.tourDeparture.createMany({ data: [dep] });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    for (const email of [ADMIN_EMAIL, CUSTOMER_EMAIL]) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email, password: PASSWORD, name: 'Test User' },
      });
      await prisma.user.update({
        where: { email },
        data: { emailVerified: true, ...(email === ADMIN_EMAIL ? { role: 'ADMIN' } : {}) },
      });
    }
    adminCookie = sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: ADMIN_EMAIL, password: PASSWORD },
      }),
    );
    customerCookie = sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: CUSTOMER_EMAIL, password: PASSWORD },
      }),
    );
    customerId = (await prisma.user.findUniqueOrThrow({ where: { email: CUSTOMER_EMAIL } })).id;
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE bookings, refunds, cancellation_requests, reviews, review_moderation_events, outbox CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('guard: ẩn danh → 401, khách thường → 403', async () => {
    const anon = await app.inject({
      method: 'GET',
      url: `/api/admin/reports/monthly?month=${MONTH}`,
    });
    expect(anon.statusCode).toBe(401);
    expect((await get(MONTH, customerCookie)).statusCode).toBe(403);
  });

  it('month sai định dạng → 400 (contract chặn trước khi chạm DB)', async () => {
    expect((await get('2026-5', adminCookie)).statusCode).toBe(400);
    expect((await get('2026-13', adminCookie)).statusCode).toBe(400);
    expect((await get('2026-05-01', adminCookie)).statusCode).toBe(400);
    // Năm ngoài trần 1900–2099 cũng là 400 (vòng vá review F6): `9999-12`
    // từng sinh mốc năm 10000 làm chính output schema từ chối response (trang
    // lỗi thay vì "tháng trống"), `0050-06` từng âm thầm thành tháng 6/1950.
    expect((await get('9999-12', adminCookie)).statusCode).toBe(400);
    expect((await get('0050-06', adminCookie)).statusCode).toBe(400);
  });

  it('tháng trống là một báo cáo TOÀN SỐ 0, không phải 404', async () => {
    const empty = await report();
    expect(empty).toMatchObject({
      month: MONTH,
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-06-01T00:00:00.000Z',
      revenue: '0.00',
      paidBookings: 0,
      newBookings: 0,
      refundedTotal: '0.00',
      refunds: 0,
      cancellationsApproved: 0,
      cancellationsDenied: 0,
      reviewsApproved: 0,
    });
    // Phân rã trạng thái vẫn đủ hàng — "0" là một con số, không phải dòng thiếu.
    expect(empty.bookingsByStatus.map((row) => row.status)).toEqual(BookingStatusSchema.options);
    expect(empty.bookingsByStatus.every((row) => row.count === 0)).toBe(true);
  });

  it('tháng CHỈ có refund (không payment nào) lấy đồng tiền từ chính sổ hoàn, không phải USD', async () => {
    // Kịch bản bình thường của một tháng vắng: hoàn tiền cho booking EUR đã
    // trả từ tháng trước. Fallback 'USD' cũ dán nhãn đô cho tiền EUR trên
    // chính tờ báo cáo đem in (vòng vá review F6) — giờ nhãn hỏi lần lượt
    // payment của tháng rồi sổ hoàn, 'USD' chỉ dành cho tháng mọi số đều 0.
    await prisma.booking.createMany({
      data: [
        {
          ...booking(1, {
            status: BookingStatus.REFUNDED,
            total: '90.00',
            createdAt: at('2026-04-05T00:00:00.000Z'),
            paidAt: at('2026-04-06T00:00:00.000Z'), // trả tiền THÁNG 4 — ngoài kỳ
          }),
          currency: 'EUR',
        },
      ],
    });
    await prisma.refund.create({
      data: {
        id: 'e9600003-0000-4000-8000-000000000009',
        bookingId: bookingId(1),
        amount: '75.00',
        currency: 'EUR',
        createdAt: at('2026-05-10T00:00:00.000Z'),
      },
    });

    const may = await report('2026-05');
    expect(may.revenue).toBe('0.00');
    expect(may.paidBookings).toBe(0);
    expect(may.refundedTotal).toBe('75.00');
    expect(may.currency).toBe('EUR');
  });

  describe('với dữ liệu ở cả ba tháng', () => {
    beforeEach(async () => {
      await prisma.booking.createMany({
        data: [
          // ── Trong tháng 5 ──
          booking(1, {
            status: BookingStatus.PAID,
            total: '100.00',
            createdAt: at('2026-05-01T00:00:00.000Z'), // đúng biên đầu — PHẢI vào
            paidAt: at('2026-05-02T09:00:00.000Z'),
          }),
          booking(2, {
            status: BookingStatus.CANCELLED,
            total: '200.00',
            createdAt: at('2026-05-15T12:00:00.000Z'),
            paidAt: at('2026-05-15T12:30:00.000Z'),
          }),
          booking(3, {
            status: BookingStatus.PENDING,
            total: '300.00',
            createdAt: at('2026-05-31T23:59:59.000Z'), // đúng biên cuối — PHẢI vào
            paidAt: null,
          }),
          // Tạo tháng 4 nhưng TRẢ TIỀN tháng 5: doanh thu là của tháng 5,
          // còn `newBookings` là của tháng 4 (revenue neo `paid_at`).
          booking(4, {
            status: BookingStatus.PAID,
            total: '50.00',
            createdAt: at('2026-04-20T08:00:00.000Z'),
            paidAt: at('2026-05-03T08:00:00.000Z'),
          }),
          // ── Tháng 4 (hàng xóm) ──
          booking(5, {
            status: BookingStatus.PAID,
            total: '999.00',
            createdAt: at('2026-04-10T00:00:00.000Z'),
            paidAt: at('2026-04-10T00:00:00.000Z'),
          }),
          // ── Tháng 6 (hàng xóm) — 00:00 ngày 1/6 là biên NGOÀI ──
          booking(6, {
            status: BookingStatus.PAID,
            total: '777.00',
            createdAt: at('2026-06-01T00:00:00.000Z'),
            paidAt: at('2026-06-01T00:00:00.000Z'),
          }),
        ],
      });

      await prisma.refund.createMany({
        data: [
          // Hoàn trong tháng 5 cho booking trả tiền tháng 5.
          {
            id: 'e9600003-0000-4000-8000-000000000001',
            bookingId: bookingId(2),
            amount: '80.00',
            currency: 'USD',
            createdAt: at('2026-05-20T10:00:00.000Z'),
          },
          // Hoàn trong tháng 5 cho booking TRẢ TIỀN THÁNG 4 — vẫn là dòng
          // tiền đi ra của tháng 5 (không phải hiệu chỉnh doanh thu tháng 4).
          {
            id: 'e9600003-0000-4000-8000-000000000002',
            bookingId: bookingId(5),
            amount: '20.50',
            currency: 'USD',
            createdAt: at('2026-05-28T10:00:00.000Z'),
          },
          // Hoàn tháng 6 — ngoài kỳ.
          {
            id: 'e9600003-0000-4000-8000-000000000003',
            bookingId: bookingId(6),
            amount: '500.00',
            currency: 'USD',
            createdAt: at('2026-06-02T10:00:00.000Z'),
          },
        ],
      });

      await prisma.cancellationRequest.createMany({
        data: [
          {
            id: 'e9600004-0000-4000-8000-000000000001',
            bookingId: bookingId(2),
            userId: customerId,
            reason: 'Family emergency — cannot travel.',
            status: CancellationRequestStatus.REFUNDED,
            createdAt: at('2026-05-10T00:00:00.000Z'),
            decidedAt: at('2026-05-12T00:00:00.000Z'),
          },
          {
            id: 'e9600004-0000-4000-8000-000000000002',
            bookingId: bookingId(1),
            userId: customerId,
            reason: 'Changed my mind about the dates.',
            status: CancellationRequestStatus.DENIED,
            createdAt: at('2026-05-11T00:00:00.000Z'),
            decidedAt: at('2026-05-13T00:00:00.000Z'),
          },
          // MỞ trong tháng 5 nhưng QUYẾT tháng 6 — thuộc báo cáo tháng 6.
          {
            id: 'e9600004-0000-4000-8000-000000000003',
            bookingId: bookingId(4),
            userId: customerId,
            reason: 'Requested in May, decided in June.',
            status: CancellationRequestStatus.DENIED,
            createdAt: at('2026-05-30T00:00:00.000Z'),
            decidedAt: at('2026-06-02T00:00:00.000Z'),
          },
        ],
      });

      await prisma.review.createMany({
        data: [1, 2].map((n) => ({
          id: `e9600005-0000-4000-8000-${String(n).padStart(12, '0')}`,
          tourId: tour.id,
          userId: customerId,
          bookingId: bookingId(n),
          source: ReviewSource.VERIFIED,
          rating: 5,
          body: 'A perfectly ordinary review body, long enough to be real.',
          authorName: 'Ada Lovelace',
          isApproved: true,
          createdAt: at('2026-05-05T00:00:00.000Z'),
          moderatedAt: at('2026-05-06T00:00:00.000Z'),
        })),
      });

      await prisma.reviewModerationEvent.createMany({
        data: [
          {
            id: 'e9600006-0000-4000-8000-000000000001',
            reviewId: 'e9600005-0000-4000-8000-000000000001',
            fromApproved: false,
            toApproved: true,
            createdAt: at('2026-05-06T00:00:00.000Z'),
          },
          // Lượt GỠ duyệt — không phải lượt duyệt, không được đếm.
          {
            id: 'e9600006-0000-4000-8000-000000000002',
            reviewId: 'e9600005-0000-4000-8000-000000000001',
            fromApproved: true,
            toApproved: false,
            createdAt: at('2026-05-07T00:00:00.000Z'),
          },
          {
            id: 'e9600006-0000-4000-8000-000000000003',
            reviewId: 'e9600005-0000-4000-8000-000000000002',
            fromApproved: false,
            toApproved: true,
            createdAt: at('2026-05-08T00:00:00.000Z'),
          },
          // Duyệt trong tháng 6 — ngoài kỳ.
          {
            id: 'e9600006-0000-4000-8000-000000000004',
            reviewId: 'e9600005-0000-4000-8000-000000000002',
            fromApproved: false,
            toApproved: true,
            createdAt: at('2026-06-05T00:00:00.000Z'),
          },
        ],
      });
    });

    it('revenue neo theo paid_at và là GROSS — hoàn tiền KHÔNG bị trừ', async () => {
      const may = await report();
      // 100 (booking 1) + 200 (booking 2, huỷ sau) + 50 (booking 4, tạo
      // tháng 4 trả tiền tháng 5). 80.00 hoàn trong tháng KHÔNG bị trừ.
      expect(may.revenue).toBe('350.00');
      expect(may.paidBookings).toBe(3);
      expect(may.currency).toBe('USD');
    });

    it('newBookings đếm theo created_at, cả hai biên tháng đều đúng', async () => {
      const may = await report();
      // booking 1 (00:00 ngày 1/5) + 2 + 3 (23:59 ngày 31/5). Booking 4 tạo
      // tháng 4, booking 6 tạo đúng 00:00 ngày 1/6 — cả hai NGOÀI.
      expect(may.newBookings).toBe(3);
    });

    it('bookingsByStatus phân rã đúng lứa TẠO trong tháng và cộng lại bằng newBookings', async () => {
      const may = await report();
      const counts = Object.fromEntries(may.bookingsByStatus.map((r) => [r.status, r.count]));
      expect(counts).toMatchObject({ PAID: 1, CANCELLED: 1, PENDING: 1, REFUNDED: 0 });
      expect(may.bookingsByStatus.reduce((sum, r) => sum + r.count, 0)).toBe(may.newBookings);
    });

    it('refundedTotal là sổ cái tiền ĐI RA của tháng, kể cả cho booking trả tiền tháng trước', async () => {
      const may = await report();
      expect(may.refundedTotal).toBe('100.50'); // 80.00 + 20.50
      expect(may.refunds).toBe(2);
    });

    it('cancellations đếm theo decided_at — mở tháng này quyết tháng sau thuộc tháng sau', async () => {
      const may = await report();
      expect(may.cancellationsApproved).toBe(1);
      expect(may.cancellationsDenied).toBe(1);

      const june = await report('2026-06');
      expect(june.cancellationsDenied).toBe(1);
      expect(june.cancellationsApproved).toBe(0);
    });

    it('reviewsApproved đếm LƯỢT duyệt trên audit trail, bỏ qua lượt gỡ duyệt', async () => {
      const may = await report();
      expect(may.reviewsApproved).toBe(2); // hai to_approved=true; lượt gỡ không tính
      expect((await report('2026-06')).reviewsApproved).toBe(1);
    });

    it('tháng hàng xóm không lẫn số của nhau', async () => {
      expect((await report('2026-04')).revenue).toBe('999.00');
      expect((await report('2026-06')).revenue).toBe('777.00');
      expect((await report('2026-06')).refundedTotal).toBe('500.00');
    });

    it('cùng một tháng đọc hai lần cho cùng con số (không neo vào "bây giờ")', async () => {
      const first = await report();
      const second = await report();
      const { generatedAt: _a, ...firstNumbers } = first;
      const { generatedAt: _b, ...secondNumbers } = second;
      expect(firstNumbers).toEqual(secondNumbers);
    });
  });
});
