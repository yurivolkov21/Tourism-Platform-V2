import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  PagedSchema,
  PaymentEventDetailSchema,
  PaymentEventRowSchema,
  PaymentProviderSchema,
} from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, DepartureStatus, PaymentProvider } from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test) — vùng payment events admin (spec
 * P4c §3-F8): list (filter provider/type + tìm eventId + cờ unprocessed ép
 * từ query string + phân trang + guard) và byId (payload đã redact; 404/400).
 *
 * Fixture ghi THẲNG vào `payment_events` (không đi qua webhook): endpoint
 * này chỉ đọc sổ, còn cách sổ được ghi đã có `payments.int.spec.ts` canh.
 */

const PUBLISHED_SLUG = 'hoi-an-lantern-evening';
const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test'; // ADMIN_EMAILS (int config)
const CUSTOMER_EMAIL = 'payment-events-customer@tourism.test';

const PagedRowsSchema = PagedSchema(PaymentEventRowSchema);

function requireFixtureTour(slug: string) {
  const found = catalog.tours.find((t) => t.slug === slug);
  if (!found) throw new Error(`fixture tour missing: ${slug}`);
  return found;
}

const tour = requireFixtureTour(PUBLISHED_SLUG);

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

const DAY = 86_400_000;
const at = (minutesAgo: number): Date => new Date(Date.now() - minutesAgo * 60_000);

/** `client_secret` của một PaymentIntent — chuỗi này KHÔNG được xuất hiện trong response nào. */
const CLIENT_SECRET = 'pi_3PayEvt_secret_TOP-SECRET-CLIENT-VALUE';

describe('admin payment events integration (F8)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let customerId: string;

  const BOOKING_ID = 'f8000002-0000-4000-8000-000000000001';
  const BOOKING_CODE = 'BK-PAYEVT01';
  /** bookingId hợp lệ về dạng nhưng KHÔNG có booking — cột không có FK. */
  const DEAD_BOOKING_ID = 'f8000002-dead-4000-8000-000000000000';

  const future45 = new Date(Date.now() + 45 * DAY);
  const dep = {
    id: 'f8000001-0000-4000-8000-000000000001',
    tourId: tour.id,
    startDate: future45,
    endDate: new Date(future45.getTime() + DAY),
    seatsTotal: 500,
    seatsBooked: 0,
    status: DepartureStatus.OPEN,
  } satisfies Prisma.TourDepartureCreateManyInput;

  const rowId = (n: number) => `f8000003-0000-4000-8000-${String(n).padStart(12, '0')}`;

  function event(
    n: number,
    patch: Partial<Prisma.PaymentEventCreateManyInput> & { eventId: string },
  ): Prisma.PaymentEventCreateManyInput {
    return {
      id: rowId(n),
      provider: PaymentProvider.STRIPE,
      type: 'payment.completed',
      payload: { id: patch.eventId, fake: true },
      amount: null,
      currency: null,
      bookingId: null,
      receivedAt: at(n),
      processedAt: at(n),
      ...patch,
    };
  }

  const list = (query: string, cookie: string) =>
    app.inject({ method: 'GET', url: `/api/admin/payment-events${query}`, headers: { cookie } });

  const byId = (id: string, cookie: string) =>
    app.inject({ method: 'GET', url: `/api/admin/payment-events/${id}`, headers: { cookie } });

  const listOk = async (query: string) => {
    const res = await list(query, adminCookie);
    expect(res.statusCode).toBe(200);
    return PagedRowsSchema.parse(res.json());
  };

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE tour_categories, destinations, users, payment_events CASCADE',
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

    // MỘT booking thật để cột bookingCode có gì để join.
    await prisma.booking.create({
      data: {
        id: BOOKING_ID,
        code: BOOKING_CODE,
        userId: customerId,
        tourId: tour.id,
        departureId: dep.id,
        numAdults: 1,
        numChildren: 0,
        totalAmount: '117.00',
        unitPrice: '117.00',
        currency: 'USD',
        status: BookingStatus.PAID,
        tourTitle: tour.title,
        departureStartDate: dep.startDate,
        departureEndDate: dep.endDate,
        contactName: 'Ada Lovelace',
        contactEmail: CUSTOMER_EMAIL,
        paymentProvider: PaymentProvider.STRIPE,
        paidAt: at(10),
      },
    });
  });

  beforeEach(async () => {
    await prisma.paymentEvent.deleteMany();
    await prisma.paymentEvent.createMany({
      data: [
        // n = số phút trước → n nhỏ = mới nhất. Thứ tự mong đợi: 1..7.
        event(1, {
          eventId: 'evt_stripe_completed_1',
          amount: '117.00',
          currency: 'USD',
          bookingId: BOOKING_ID,
          payload: {
            id: 'evt_stripe_completed_1',
            type: 'checkout.session.completed',
            data: { object: { amount_total: 11700, currency: 'usd' } },
          },
        }),
        event(2, {
          eventId: 'WH-PAYPAL-COMPLETED-2',
          provider: PaymentProvider.PAYPAL,
          // PayPal báo "500000" cho VND → gateway ghi "500000.00".
          amount: '500000',
          currency: 'VND',
          bookingId: BOOKING_ID,
        }),
        // CHƯA XỬ LÝ XONG (processedAt null) — và payload mang client_secret
        // của PaymentIntent (Stripe payment_intent.payment_failed).
        event(3, {
          eventId: 'evt_stripe_failed_3',
          type: 'payment.failed',
          processedAt: null,
          payload: {
            id: 'evt_stripe_failed_3',
            type: 'payment_intent.payment_failed',
            data: { object: { id: 'pi_3PayEvt', client_secret: CLIENT_SECRET } },
          },
        }),
        // bookingId trỏ tới booking KHÔNG tồn tại → bookingCode null, không 500.
        event(4, { eventId: 'evt_stripe_other_4', type: 'other', bookingId: DEAD_BOOKING_ID }),
        event(5, {
          eventId: 'WH-PAYPAL-OTHER-5',
          provider: PaymentProvider.PAYPAL,
          type: 'other',
          processedAt: null,
        }),
        event(6, {
          eventId: 'evt_stripe_expired_6',
          type: 'payment.expired',
          bookingId: BOOKING_ID,
          receivedAt: new Date(Date.now() - 3 * DAY),
          processedAt: new Date(Date.now() - 3 * DAY),
        }),
        // Type NGOÀI tuple `PAYMENT_EVENT_TYPES` — cột DB là chuỗi tự do,
        // list vẫn trả và filter vẫn lọc được (vòng vá review F8).
        event(7, {
          eventId: 'evt_stripe_chargeback_7',
          type: 'payment.chargeback',
          receivedAt: new Date(Date.now() - 4 * DAY),
          processedAt: new Date(Date.now() - 4 * DAY),
        }),
      ],
    });
  });

  afterAll(async () => {
    await prisma.paymentEvent.deleteMany();
    await app.close();
    await prisma.$disconnect();
  });

  it('enum PaymentProvider của contract soi gương đúng enum Prisma', () => {
    expect([...PaymentProviderSchema.options]).toEqual(Object.values(PaymentProvider));
  });

  describe('guard — cùng lớp với mọi endpoint admin', () => {
    it('list: ẩn danh → 401, khách thường → 403', async () => {
      expect(
        (await app.inject({ method: 'GET', url: '/api/admin/payment-events' })).statusCode,
      ).toBe(401);
      expect((await list('', customerCookie)).statusCode).toBe(403);
    });

    it('byId: ẩn danh → 401, khách thường → 403', async () => {
      expect(
        (await app.inject({ method: 'GET', url: `/api/admin/payment-events/${rowId(1)}` }))
          .statusCode,
      ).toBe(401);
      expect((await byId(rowId(1), customerCookie)).statusCode).toBe(403);
    });
  });

  describe('list', () => {
    it('không filter: mọi row, mới nhất trước, đủ shape contract, KHÔNG mang payload', async () => {
      const res = await list('', adminCookie);
      expect(res.statusCode).toBe(200);
      const paged = PagedRowsSchema.parse(res.json());
      expect(paged.total).toBe(7);
      expect(paged.items.map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6, 7].map(rowId));
      expect(paged.items[0]).toMatchObject({
        provider: 'STRIPE',
        eventId: 'evt_stripe_completed_1',
        type: 'payment.completed',
        amount: '117.00',
        currency: 'USD',
        bookingCode: BOOKING_CODE,
      });
      expect(paged.items[0]?.processedAt).not.toBeNull();
      // Payload không đi qua list — cả trong JSON thô, không chỉ sau khi parse.
      expect(res.body).not.toContain('"payload"');
      expect(res.body).not.toContain('amount_total');
    });

    it('bookingCode: join từ bookingId; null khi không gắn HOẶC booking không còn (cột không FK)', async () => {
      const paged = await listOk('');
      const byIdMap = new Map(paged.items.map((item) => [item.id, item]));
      expect(byIdMap.get(rowId(2))?.bookingCode).toBe(BOOKING_CODE);
      expect(byIdMap.get(rowId(2))?.amount).toBe('500000.00');
      expect(byIdMap.get(rowId(3))?.bookingCode).toBeNull();
      expect(byIdMap.get(rowId(4))?.bookingCode).toBeNull();
    });

    it('provider=PAYPAL chỉ trả event PayPal', async () => {
      const paged = await listOk('?provider=PAYPAL');
      expect(paged.items.map((item) => item.id)).toEqual([rowId(2), rowId(5)]);
    });

    it('type lọc đúng chuỗi type — cả type NGOÀI tuple gateway biết (cột chuỗi tự do)', async () => {
      const paged = await listOk('?type=payment.completed');
      expect(paged.items.map((item) => item.id)).toEqual([rowId(1), rowId(2)]);
      const free = await listOk('?type=payment.chargeback');
      expect(free.items.map((item) => item.id)).toEqual([rowId(7)]);
      expect(free.items[0]?.type).toBe('payment.chargeback');
    });

    it('search khớp eventId contains, không phân biệt hoa/thường; kết hợp với provider là giao', async () => {
      expect((await listOk('?search=FAILED_3')).items.map((item) => item.id)).toEqual([rowId(3)]);
      expect((await listOk('?search=wh-paypal')).items.map((item) => item.id)).toEqual([
        rowId(2),
        rowId(5),
      ]);
      expect((await listOk('?search=wh-paypal&type=other')).items.map((item) => item.id)).toEqual([
        rowId(5),
      ]);
    });

    it('unprocessed=true (ép từ query string) chỉ trả row processedAt null; =false trả mọi row', async () => {
      // ZodSmartCoercion: "true"/"false" trên URL → boolean của schema.
      const only = await listOk('?unprocessed=true');
      expect(only.items.map((item) => item.id)).toEqual([rowId(3), rowId(5)]);
      expect(only.items.every((item) => item.processedAt === null)).toBe(true);
      expect((await listOk('?unprocessed=false')).total).toBe(7);
    });

    it('phân trang: page/limit ép từ query string, totalPages đúng', async () => {
      const page2 = await listOk('?limit=2&page=2');
      expect(page2).toMatchObject({ page: 2, limit: 2, total: 7, totalPages: 4 });
      expect(page2.items.map((item) => item.id)).toEqual([rowId(3), rowId(4)]);
    });

    it('provider ngoài enum / unprocessed không phải boolean → 400 (contract chặn trước DB)', async () => {
      expect((await list('?provider=SQUARE', adminCookie)).statusCode).toBe(400);
      expect((await list('?unprocessed=yes', adminCookie)).statusCode).toBe(400);
    });
  });

  describe('byId', () => {
    it('200: row + payload nguyên văn của provider', async () => {
      const res = await byId(rowId(1), adminCookie);
      expect(res.statusCode).toBe(200);
      const detail = PaymentEventDetailSchema.parse(res.json());
      expect(detail).toMatchObject({
        id: rowId(1),
        eventId: 'evt_stripe_completed_1',
        bookingCode: BOOKING_CODE,
        payload: {
          id: 'evt_stripe_completed_1',
          type: 'checkout.session.completed',
          data: { object: { amount_total: 11700, currency: 'usd' } },
        },
      });
    });

    it('payload mang client_secret của PaymentIntent → bị CHE, response không mang credential', async () => {
      const res = await byId(rowId(3), adminCookie);
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toContain('TOP-SECRET-CLIENT-VALUE');
      const detail = PaymentEventDetailSchema.parse(res.json());
      expect(detail.payload).toEqual({
        id: 'evt_stripe_failed_3',
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_3PayEvt', client_secret: '[redacted]' } },
      });
      expect(detail.processedAt).toBeNull();
    });

    it('id không tồn tại → 404 NOT_FOUND; id không phải uuid → 400', async () => {
      const missing = await byId('f8000003-0000-4000-8000-999999999999', adminCookie);
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' });
      expect((await byId('evt_not_a_uuid', adminCookie)).statusCode).toBe(400);
    });
  });
});
