import { z } from 'zod';
import { DecimalStringSchema } from './catalog.js';

/**
 * Booking schemas (spec P2 §3, W1) — the ONE source of truth for the customer
 * booking surface: oRPC contract input/output + P3 web client types.
 *
 * Same serialization conventions as catalog.ts: Decimal money as strings,
 * `@db.Date` columns as `YYYY-MM-DD`, DB-nullable fields as explicit `null`.
 * Length caps mirror `apps/api/prisma/schema.prisma` (Booking model) exactly.
 */

/** Mirrors Prisma enum PaymentProvider (ADR-0006, amended). */
export const PaymentProviderSchema = z.enum(['STRIPE', 'PAYPAL']);
export type PaymentProviderValue = z.output<typeof PaymentProviderSchema>;

/** Mirrors Prisma enum BookingStatus. */
export const BookingStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);
export type BookingStatusValue = z.output<typeof BookingStatusSchema>;

/** `BK-` + 8 uppercase base36 chars (see apps/api bookings/booking-code.ts). */
export const BookingCodeSchema = z.string().regex(/^BK-[A-Z0-9]{8}$/, 'expected a booking code');

/**
 * Input for `bookings.create`. The departure is addressed directly by id (the
 * tour is derived server-side — no `tourSlug`, it could only disagree).
 * Group-size bounds beyond `numAdults ≥ 1` are business rules checked
 * server-side against the departure's remaining seats.
 */
export const CreateBookingInputSchema = z.object({
  departureId: z.uuid(),
  numAdults: z.int().min(1),
  numChildren: z.int().min(0).default(0),
  contactName: z.string().min(1).max(120),
  contactEmail: z.email().max(200),
  contactPhone: z.string().min(1).max(30).optional(),
  specialRequests: z.string().min(1).max(1000).optional(),
  paymentProvider: PaymentProviderSchema,
});

export type CreateBookingInput = z.output<typeof CreateBookingInputSchema>;

/**
 * Public booking shape. Snapshot fields (tourTitle, departure dates,
 * unitPrice) reflect what the customer bought at create time — they never
 * re-render when the tour is edited (audit H3). `checkoutUrl` is only
 * non-null right after `create` (the gateway session redirect); reads
 * return it as `null`.
 */
export const BookingSchema = z.object({
  id: z.uuid(),
  code: BookingCodeSchema,
  status: BookingStatusSchema,
  tourTitle: z.string().min(1).max(160),
  departureStartDate: z.iso.date(),
  departureEndDate: z.iso.date(),
  unitPrice: DecimalStringSchema,
  totalAmount: DecimalStringSchema,
  currency: z.string().length(3),
  numAdults: z.int().min(1),
  numChildren: z.int().min(0),
  contactName: z.string().min(1).max(120),
  contactEmail: z.email().max(200),
  contactPhone: z.string().max(30).nullable(),
  specialRequests: z.string().max(1000).nullable(),
  paymentProvider: PaymentProviderSchema,
  checkoutUrl: z.url().nullable(),
  paidAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type Booking = z.output<typeof BookingSchema>;

/**
 * Query for `bookings.mine`. Same pagination conventions as the catalog list
 * (plain typed fields — ZodSmartCoercionPlugin coerces query strings
 * server-side).
 */
export const BookingsListQuerySchema = z.object({
  page: z.int().min(1).default(1),
  limit: z.int().min(1).max(50).default(12),
  status: BookingStatusSchema.optional(),
});

export type BookingsListQuery = z.output<typeof BookingsListQuerySchema>;
