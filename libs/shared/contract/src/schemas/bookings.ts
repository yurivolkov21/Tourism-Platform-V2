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

// ─────────────────────────────────────────────────────────────────────────────
// Admin surface (spec P2 §3, W3) — refund ledger + management list
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One append-only Refund ledger row (audit H1 upgrade — replaces Nexora's four
 * nullable refund columns). `adminId` null = automatic refund (overbook /
 * orphaned capture); `providerRefundId` null only for legacy/unknown rows.
 */
export const RefundSchema = z.object({
  id: z.uuid(),
  amount: DecimalStringSchema,
  currency: z.string().length(3),
  providerRefundId: z.string().max(255).nullable(),
  adminId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});

export type Refund = z.output<typeof RefundSchema>;

/**
 * Input for `admin.bookings.refund`. `amount` omitted → refund the remainder
 * (total − SUM(refunds)); it is currency-less on purpose — the booking's
 * currency is implied, so a refund/booking currency mismatch (invariant #6) is
 * unrepresentable on this path. `reason` is stored in the refund email outbox
 * payload only (the Refund model deliberately has no reason column — audit).
 */
export const AdminRefundInputSchema = z.object({
  code: BookingCodeSchema,
  amount: DecimalStringSchema.optional(),
  reason: z.string().min(1).max(500).optional(),
});

export type AdminRefundInput = z.output<typeof AdminRefundInputSchema>;

/** Output of `admin.bookings.refund`: the re-derived booking + full ledger. */
export const AdminRefundResultSchema = z.object({
  booking: BookingSchema,
  refunds: z.array(RefundSchema),
});

export type AdminRefundResult = z.output<typeof AdminRefundResultSchema>;

/**
 * Query for `admin.bookings.list` (ported lightly from Nexora's admin list
 * DTO): pagination + `status` filter + free-text `search` matched
 * case-insensitively against booking code, contact email and contact name.
 */
export const AdminBookingsListQuerySchema = z.object({
  page: z.int().min(1).default(1),
  limit: z.int().min(1).max(100).default(20),
  status: BookingStatusSchema.optional(),
  search: z.string().min(1).max(120).optional(),
});

export type AdminBookingsListQuery = z.output<typeof AdminBookingsListQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Cancellations (spec P2 §3, W4 — D1-B append-only history)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors Prisma enum CancellationRequestStatus. REQUESTED = live (at most one
 * per booking — partial unique index), DENIED = admin refused (booking stays
 * PAID), REFUNDED = approved → full-remainder refund issued + booking
 * CANCELLED (docs/conventions/booking-states.md).
 */
export const CancellationRequestStatusSchema = z.enum(['REQUESTED', 'REFUNDED', 'DENIED']);
export type CancellationRequestStatusValue = z.output<typeof CancellationRequestStatusSchema>;

/** Input for `bookings.cancel` — the customer's reason travels to the admin queue. */
export const CancelBookingInputSchema = z.object({
  code: BookingCodeSchema,
  reason: z.string().min(1).max(1000),
});

export type CancelBookingInput = z.output<typeof CancelBookingInputSchema>;

/**
 * One cancellation request row (append-only history per D1-B — a booking can
 * carry several: DENIED history + at most one live REQUESTED). Decision fields
 * are null until an admin decides.
 */
export const CancellationRequestSchema = z.object({
  id: z.uuid(),
  bookingCode: BookingCodeSchema,
  reason: z.string().min(1).max(1000),
  status: CancellationRequestStatusSchema,
  decisionNote: z.string().max(500).nullable(),
  decidedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type CancellationRequest = z.output<typeof CancellationRequestSchema>;

/**
 * Admin-queue row: the request plus enough booking context to decide without a
 * second lookup (ported from Nexora's admin cancellation DTO).
 */
export const AdminCancellationRequestSchema = CancellationRequestSchema.extend({
  tourTitle: z.string().min(1).max(160),
  departureStartDate: z.iso.date(),
  contactName: z.string().min(1).max(120),
  contactEmail: z.email().max(200),
});

export type AdminCancellationRequest = z.output<typeof AdminCancellationRequestSchema>;

/**
 * Query for `admin.cancellations.list`. `status` omitted → ALL requests
 * (consistent with `admin.bookings.list`; the open queue is `?status=REQUESTED`).
 */
export const AdminCancellationsListQuerySchema = z.object({
  page: z.int().min(1).default(1),
  limit: z.int().min(1).max(100).default(20),
  status: CancellationRequestStatusSchema.optional(),
});

export type AdminCancellationsListQuery = z.output<typeof AdminCancellationsListQuerySchema>;

/**
 * Input for `admin.cancellations.decide` — one endpoint for both verdicts.
 * `approve: true` → full-remainder refund + booking CANCELLED + seats released
 * + request REFUNDED; `approve: false` → request DENIED, booking untouched.
 */
export const DecideCancellationInputSchema = z.object({
  id: z.uuid(),
  approve: z.boolean(),
  decisionNote: z.string().min(1).max(500).optional(),
});

export type DecideCancellationInput = z.output<typeof DecideCancellationInputSchema>;

/** Output of `admin.cancellations.decide`: the decided request + the booking after it. */
export const DecideCancellationResultSchema = z.object({
  request: AdminCancellationRequestSchema,
  booking: BookingSchema,
});

export type DecideCancellationResult = z.output<typeof DecideCancellationResultSchema>;

/**
 * Output of `admin.bookings.byCode` (W4 upgrade): the booking plus its full
 * cancellation history, oldest first — the D1-B append-only trail (DENIED rows
 * survive re-requests) is part of the admin detail view.
 */
export const AdminBookingDetailSchema = BookingSchema.extend({
  cancellationRequests: z.array(CancellationRequestSchema),
});

export type AdminBookingDetail = z.output<typeof AdminBookingDetailSchema>;
