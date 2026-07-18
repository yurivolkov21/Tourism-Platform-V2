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
      CreateBookingInputSchema.safeParse({ ...validCreate, paymentProvider: 'BITCOIN' }).success,
    ).toBe(false);
    expect(PaymentProviderSchema.options).toEqual(['STRIPE', 'PAYPAL']);
  });

  it('rejects a non-uuid departureId and a malformed contact email', () => {
    expect(
      CreateBookingInputSchema.safeParse({ ...validCreate, departureId: 'not-a-uuid' }).success,
    ).toBe(false);
    expect(
      CreateBookingInputSchema.safeParse({ ...validCreate, contactEmail: 'nope' }).success,
    ).toBe(false);
  });

  it('enforces the schema.prisma length caps on contact fields', () => {
    expect(
      CreateBookingInputSchema.safeParse({ ...validCreate, contactName: 'x'.repeat(121) }).success,
    ).toBe(false);
    expect(
      CreateBookingInputSchema.safeParse({ ...validCreate, contactPhone: '9'.repeat(31) }).success,
    ).toBe(false);
    expect(
      CreateBookingInputSchema.safeParse({ ...validCreate, specialRequests: 'x'.repeat(1001) })
        .success,
    ).toBe(false);
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
    });
    expect(parsed.totalAmount).toBe('117.00');
    expect(parsed.checkoutUrl).not.toBeNull();
    expect(BookingSchema.safeParse({ ...parsed, code: 'bk-lowercase' }).success).toBe(false);
    // Money must never arrive as a float.
    expect(BookingSchema.safeParse({ ...parsed, totalAmount: 117 }).success).toBe(false);
  });
});

describe('BookingsListQuerySchema', () => {
  it('defaults page/limit and accepts an optional status filter', () => {
    expect(BookingsListQuerySchema.parse({})).toMatchObject({ page: 1, limit: 12 });
    expect(BookingsListQuerySchema.parse({ status: 'PAID' }).status).toBe('PAID');
    expect(BookingsListQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
    expect(BookingsListQuerySchema.safeParse({ limit: 999 }).success).toBe(false);
  });
});
