import {
  BookingSchema,
  BookingsListQuerySchema,
  CreateBookingInputSchema,
  PaymentProviderSchema,
} from './bookings.js';

const validCreate = {
  departureId: 'e9000001-0000-4000-8000-000000000001',
  numAdults: 2,
  numChildren: 1,
  contactName: 'Alice Nguyen',
  contactEmail: 'alice@example.com',
  paymentProvider: 'STRIPE',
};

describe('CreateBookingInputSchema', () => {
  it('accepts a minimal valid input and defaults numChildren to 0', () => {
    const { numChildren: _drop, ...withoutChildren } = validCreate;
    const parsed = CreateBookingInputSchema.parse(withoutChildren);
    expect(parsed.numChildren).toBe(0);
    expect(parsed.paymentProvider).toBe('STRIPE');
  });

  it('rejects numAdults < 1 (children cannot travel alone)', () => {
    expect(CreateBookingInputSchema.safeParse({ ...validCreate, numAdults: 0 }).success).toBe(
      false,
    );
    expect(CreateBookingInputSchema.safeParse({ ...validCreate, numAdults: -1 }).success).toBe(
      false,
    );
    expect(CreateBookingInputSchema.safeParse({ ...validCreate, numAdults: 1.5 }).success).toBe(
      false,
    );
  });

  it('rejects negative numChildren', () => {
    expect(CreateBookingInputSchema.safeParse({ ...validCreate, numChildren: -1 }).success).toBe(
      false,
    );
  });

  it('rejects an unknown payment provider', () => {
    expect(
      CreateBookingInputSchema.safeParse({
        ...validCreate,
        paymentProvider: 'BITCOIN',
      }).success,
    ).toBe(false);
    expect(PaymentProviderSchema.options).toEqual(['STRIPE', 'PAYPAL']);
  });

  it('rejects a non-uuid departureId and a malformed contact email', () => {
    expect(
      CreateBookingInputSchema.safeParse({
        ...validCreate,
        departureId: 'not-a-uuid',
      }).success,
    ).toBe(false);
    expect(
      CreateBookingInputSchema.safeParse({
        ...validCreate,
        contactEmail: 'nope',
      }).success,
    ).toBe(false);
  });

  it('enforces the schema.prisma length caps on contact fields', () => {
    expect(
      CreateBookingInputSchema.safeParse({
        ...validCreate,
        contactName: 'x'.repeat(121),
      }).success,
    ).toBe(false);
    expect(
      CreateBookingInputSchema.safeParse({
        ...validCreate,
        contactPhone: '9'.repeat(31),
      }).success,
    ).toBe(false);
    expect(
      CreateBookingInputSchema.safeParse({
        ...validCreate,
        specialRequests: 'x'.repeat(1001),
      }).success,
    ).toBe(false);
  });

  it('rejects contactPhone shorter than 6 chars (parity Nexora @Length(6,30))', () => {
    expect(
      CreateBookingInputSchema.safeParse({ ...validCreate, contactPhone: '12345' }).success,
    ).toBe(false);
    expect(
      CreateBookingInputSchema.safeParse({ ...validCreate, contactPhone: '123456' }).success,
    ).toBe(true);
  });
});

describe('BookingSchema', () => {
  it('parses the public booking shape (decimal strings, calendar dates, nullable checkoutUrl)', () => {
    const parsed = BookingSchema.parse({
      id: 'a0000001-0000-4000-8000-000000000001',
      code: 'BK-7Q2M9XKD',
      status: 'PENDING',
      tourTitle: 'Hội An Ancient Town Walking Tour',
      departureStartDate: '2026-09-18',
      departureEndDate: '2026-09-18',
      unitPrice: '39.00',
      totalAmount: '117.00',
      currency: 'USD',
      numAdults: 2,
      numChildren: 1,
      contactName: 'Alice Nguyen',
      contactEmail: 'alice@example.com',
      contactPhone: null,
      specialRequests: null,
      paymentProvider: 'STRIPE',
      checkoutUrl: 'https://fake.checkout.local/cs_1',
      paidAt: null,
      cancelledAt: null,
      createdAt: '2026-07-18T09:00:00.000Z',
      cancellationStatus: null,
      cancellationRequestedAt: null,
      cancellationDecidedAt: null,
      refundedTotal: '0.00',
      reviewedAt: null,
    });
    expect(parsed.totalAmount).toBe('117.00');
    expect(parsed.checkoutUrl).not.toBeNull();
    expect(parsed.cancellationStatus).toBeNull();
    expect(BookingSchema.safeParse({ ...parsed, code: 'bk-lowercase' }).success).toBe(false);
    // Money must never arrive as a float.
    expect(BookingSchema.safeParse({ ...parsed, totalAmount: 117 }).success).toBe(false);
    // Task 6a (A2): cancellationStatus mirror enum CancellationRequestStatus.
    expect(BookingSchema.safeParse({ ...parsed, cancellationStatus: 'REQUESTED' }).success).toBe(
      true,
    );
    expect(BookingSchema.safeParse({ ...parsed, cancellationStatus: 'APPROVED' }).success).toBe(
      false,
    );
  });

  // Cụm C (spec 07/08 §3): ba field đọc-kèm, tất cả additive.
  it('carries the cancellation timestamps as nullable ISO datetimes', () => {
    const base = {
      id: 'b0000001-0000-4000-8000-000000000001',
      code: 'BK-AAAA1111',
      status: 'PAID',
      tourTitle: 'North to South Classic',
      departureStartDate: '2026-09-12',
      departureEndDate: '2026-09-23',
      unitPrice: '1290.00',
      totalAmount: '3870.00',
      currency: 'USD',
      numAdults: 2,
      numChildren: 1,
      contactName: 'Alice Nguyen',
      contactEmail: 'alice@example.com',
      contactPhone: null,
      specialRequests: null,
      paymentProvider: 'STRIPE',
      checkoutUrl: null,
      paidAt: '2026-08-04T07:22:00.000Z',
      cancelledAt: null,
      createdAt: '2026-08-04T07:15:00.000Z',
      cancellationStatus: 'REQUESTED',
      cancellationRequestedAt: '2026-08-05T09:00:00.000Z',
      cancellationDecidedAt: null,
      refundedTotal: '0.00',
      reviewedAt: null,
    };
    expect(BookingSchema.parse(base).cancellationRequestedAt).toBe('2026-08-05T09:00:00.000Z');
    expect(
      BookingSchema.parse({ ...base, cancellationDecidedAt: null }).cancellationDecidedAt,
    ).toBeNull();
    // Ngày lịch trần không phải datetime — chặn nhầm lẫn với departureStartDate.
    expect(
      BookingSchema.safeParse({ ...base, cancellationRequestedAt: '2026-08-05' }).success,
    ).toBe(false);
    // Không được vắng mặt: contract khai nullable chứ không optional.
    const { cancellationRequestedAt: _drop, ...missing } = base;
    expect(BookingSchema.safeParse(missing).success).toBe(false);
  });

  it('always carries refundedTotal as a decimal string, never a float or null', () => {
    const base = {
      id: 'b0000001-0000-4000-8000-000000000001',
      code: 'BK-AAAA1111',
      status: 'PARTIALLY_REFUNDED',
      tourTitle: 'North to South Classic',
      departureStartDate: '2026-09-12',
      departureEndDate: '2026-09-23',
      unitPrice: '1290.00',
      totalAmount: '3870.00',
      currency: 'USD',
      numAdults: 2,
      numChildren: 1,
      contactName: 'Alice Nguyen',
      contactEmail: 'alice@example.com',
      contactPhone: null,
      specialRequests: null,
      paymentProvider: 'STRIPE',
      checkoutUrl: null,
      paidAt: '2026-08-04T07:22:00.000Z',
      cancelledAt: null,
      createdAt: '2026-08-04T07:15:00.000Z',
      cancellationStatus: null,
      cancellationRequestedAt: null,
      cancellationDecidedAt: null,
      refundedTotal: '700.00',
      reviewedAt: null,
    };
    expect(BookingSchema.parse(base).refundedTotal).toBe('700.00');
    expect(BookingSchema.safeParse({ ...base, refundedTotal: 700 }).success).toBe(false);
    expect(BookingSchema.safeParse({ ...base, refundedTotal: null }).success).toBe(false);
  });
});

describe('BookingsListQuerySchema', () => {
  it('defaults page/limit and accepts an optional status filter', () => {
    expect(BookingsListQuerySchema.parse({})).toMatchObject({
      page: 1,
      limit: 12,
    });
    expect(BookingsListQuerySchema.parse({ status: 'PAID' }).status).toBe('PAID');
    expect(BookingsListQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
    expect(BookingsListQuerySchema.safeParse({ limit: 999 }).success).toBe(false);
  });
});

/** Booking hợp lệ tối thiểu, dùng cho các khối test thêm về sau. */
const validBooking = {
  id: 'a0000001-0000-4000-8000-000000000001',
  code: 'BK-7Q2M9XKD',
  status: 'PENDING',
  tourTitle: 'Hội An Ancient Town Walking Tour',
  departureStartDate: '2026-09-18',
  departureEndDate: '2026-09-18',
  unitPrice: '39.00',
  totalAmount: '117.00',
  currency: 'USD',
  numAdults: 2,
  numChildren: 1,
  contactName: 'Alice Nguyen',
  contactEmail: 'alice@example.com',
  contactPhone: null,
  specialRequests: null,
  paymentProvider: 'STRIPE',
  checkoutUrl: null,
  paidAt: null,
  cancelledAt: null,
  createdAt: '2026-07-18T09:00:00.000Z',
  cancellationStatus: null,
  cancellationRequestedAt: null,
  cancellationDecidedAt: null,
  refundedTotal: '0.00',
  reviewedAt: null,
};

describe('BookingSchema.reviewedAt — cụm B nửa 2', () => {
  it('nhận mốc thời gian đã review', () => {
    const b = { ...validBooking, reviewedAt: '2026-08-01T10:00:00.000Z' };
    expect(BookingSchema.parse(b).reviewedAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it('null = CHƯA review — khác undefined là "chưa hỏi"', () => {
    expect(BookingSchema.parse({ ...validBooking, reviewedAt: null }).reviewedAt).toBeNull();
  });

  it('khoá BẮT BUỘC có mặt', () => {
    // Không có nó thì web phải POST rồi bắt 409 để biết — tức khách gõ xong cả
    // bài đánh giá mới được báo là không viết được.
    const { reviewedAt: _r, ...missing } = { ...validBooking, reviewedAt: null };
    expect(() => BookingSchema.parse(missing)).toThrow();
  });

  it('từ chối chuỗi không phải datetime', () => {
    expect(() => BookingSchema.parse({ ...validBooking, reviewedAt: '2026-08-01' })).toThrow();
  });
});
