import { oc } from '@orpc/contract';
import { z } from 'zod';
import {
  AdminBookingDetailSchema,
  AdminBookingsListQuerySchema,
  AdminCancellationRequestSchema,
  AdminCancellationsListQuerySchema,
  AdminRefundInputSchema,
  AdminRefundResultSchema,
  BookingCodeSchema,
  BookingSchema,
  BookingsListQuerySchema,
  CancelBookingInputSchema,
  CancellationRequestSchema,
  CreateBookingInputSchema,
  DecideCancellationInputSchema,
  DecideCancellationResultSchema,
} from './schemas/bookings.js';
import {
  DestinationSchema,
  HealthSchema,
  PagedSchema,
  TourCardSchema,
  TourCategorySchema,
  TourDetailSchema,
  ToursListQuerySchema,
} from './schemas/catalog.js';

/**
 * oRPC contract v1 (spec §6) — health + public catalog read. Implemented in
 * `@tourism/api` via `@orpc/nest` `@Implement`; consumed by P3 web through
 * `ContractRouterClient<ContractRouter>`.
 *
 * Every procedure carries an explicit REST-ish `.route` path — @orpc/nest
 * mounts controllers at EXACTLY these paths (no extra prefix), hence the
 * `/api` namespace to sit alongside `/api/auth/*` (Better Auth) and clear of
 * the bare `/health` infra probe.
 */
export const contract = {
  health: {
    check: oc
      .route({
        method: 'GET',
        path: '/api/health',
        summary: 'API liveness (contract flavour of the /health infra probe)',
      })
      .output(HealthSchema),
  },
  catalog: {
    tours: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/tours',
          summary: 'List published tours (filter + paginate)',
        })
        .input(ToursListQuerySchema)
        .output(PagedSchema(TourCardSchema)),
      bySlug: oc
        .route({
          method: 'GET',
          path: '/api/tours/{slug}',
          summary: 'Published tour detail incl. upcoming OPEN departures',
        })
        .input(z.object({ slug: z.string().min(1).max(120) }))
        .errors({
          NOT_FOUND: { message: 'Tour not found' },
        })
        .output(TourDetailSchema),
    },
    destinations: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/destinations',
          summary: 'List active destinations with published-tour counts',
        })
        .output(z.array(DestinationSchema)),
    },
    categories: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/categories',
          summary: 'List active tour categories',
        })
        .output(z.array(TourCategorySchema)),
    },
  },
  /**
   * Customer bookings (spec P2 §3, W1) — every procedure here is AUTHED:
   * the oRPC contract carries no auth metadata by design; enforcement is the
   * Nest `AuthGuard` applied on the implementing controller (guards run
   * before the oRPC interceptor, so an anonymous call 401s before parsing).
   */
  bookings: {
    create: oc
      .route({
        method: 'POST',
        path: '/api/bookings',
        summary: 'Create a PENDING booking + gateway checkout session (authed)',
      })
      .input(CreateBookingInputSchema)
      .errors({
        // Departure missing, not OPEN, already departed, or tour unpublished —
        // one code on purpose: the caller can't act on the difference, and a
        // fine-grained code would leak unpublished-tour existence.
        DEPARTURE_NOT_AVAILABLE: {
          status: 400,
          message: 'This departure is not available for booking',
        },
        SEATS_UNAVAILABLE: {
          status: 409,
          message: 'Not enough seats left on this departure',
        },
      })
      .output(BookingSchema),
    mine: oc
      .route({
        method: 'GET',
        path: '/api/bookings',
        summary: 'List own bookings, newest first (authed, paged)',
      })
      .input(BookingsListQuerySchema)
      .output(PagedSchema(BookingSchema)),
    byCode: oc
      .route({
        method: 'GET',
        path: '/api/bookings/{code}',
        summary: 'Own booking detail by code (authed, owner-only)',
      })
      .input(z.object({ code: BookingCodeSchema }))
      .errors({
        // Also returned for another user's booking — owner-or-404.
        NOT_FOUND: { message: 'Booking not found' },
      })
      .output(BookingSchema),
    cancel: oc
      .route({
        method: 'POST',
        path: '/api/bookings/{code}/cancel',
        summary: 'Request cancellation of an own PAID booking (authed, owner-only)',
      })
      .input(CancelBookingInputSchema)
      .errors({
        // Owner-or-404, same policy as byCode.
        NOT_FOUND: { message: 'Booking not found' },
        // The partial unique index fired — a live REQUESTED row already exists.
        ALREADY_REQUESTED: {
          status: 409,
          message: 'A cancellation request is already open for this booking',
        },
        // Booking not PAID, or the departure has already started — one code:
        // either way this booking cannot enter the cancellation flow.
        NOT_CANCELLABLE: {
          status: 422,
          message: 'Only a PAID booking with a future departure can be cancelled',
        },
      })
      .output(CancellationRequestSchema),
  },
  /**
   * Admin surface (spec P2 §3, W3). Same guard model as `bookings`: the
   * contract carries no auth metadata; the implementing controller stacks
   * `AuthGuard` + `@Roles('ADMIN')` (anonymous → 401, non-admin → 403) before
   * oRPC parses anything.
   */
  admin: {
    bookings: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/admin/bookings',
          summary: 'List ALL bookings (admin, paged, status/search filters)',
        })
        .input(AdminBookingsListQuerySchema)
        .output(PagedSchema(BookingSchema)),
      byCode: oc
        .route({
          method: 'GET',
          path: '/api/admin/bookings/{code}',
          summary: 'Any booking by code + cancellation history (admin — not owner-scoped)',
        })
        .input(z.object({ code: BookingCodeSchema }))
        .errors({
          NOT_FOUND: { message: 'Booking not found' },
        })
        .output(AdminBookingDetailSchema),
      refund: oc
        .route({
          method: 'POST',
          path: '/api/admin/bookings/{code}/refund',
          summary: 'Issue a (partial) refund — appends a Refund ledger row',
        })
        .input(AdminRefundInputSchema)
        .errors({
          NOT_FOUND: { message: 'Booking not found' },
          // 422s below: the request parsed fine but the ledger/state refuses it.
          NOT_REFUNDABLE: {
            status: 422,
            message:
              'Only a PAID or PARTIALLY_REFUNDED booking with a captured payment is refundable',
          },
          OVER_TOTAL: {
            status: 422,
            message: 'Refund amount plus prior refunds would exceed the booking total',
          },
          ZERO_OR_NEGATIVE: {
            status: 422,
            message: 'Refund amount must be greater than zero',
          },
          NOTHING_LEFT: {
            status: 422,
            message: 'Booking is already fully refunded',
          },
          // The provider refused/failed the refund call — nothing was ledgered.
          REFUND_FAILED: {
            status: 502,
            message: 'Provider refund failed',
          },
        })
        .output(AdminRefundResultSchema),
    },
    /**
     * Cancellation queue (spec P2 W4, D1-B). `decide` is one endpoint for both
     * verdicts: deny flips the request only; approve orchestrates the
     * full-remainder refund + booking CANCELLED + seat release.
     */
    cancellations: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/admin/cancellations',
          summary: 'List cancellation requests (admin, paged, status filter)',
        })
        .input(AdminCancellationsListQuerySchema)
        .output(PagedSchema(AdminCancellationRequestSchema)),
      decide: oc
        .route({
          method: 'POST',
          path: '/api/admin/cancellations/{id}/decide',
          summary: 'Approve (refund + cancel + release seats) or deny a request',
        })
        .input(DecideCancellationInputSchema)
        .errors({
          NOT_FOUND: { message: 'Cancellation request not found' },
          // The request is DENIED/REFUNDED already — decisions are final
          // (append-only history: the customer re-requests instead).
          ALREADY_DECIDED: {
            status: 409,
            message: 'This cancellation request has already been decided',
          },
          // Approve only: the booking has no refundable remainder / captured
          // payment (same gate class as admin.bookings.refund).
          NOT_REFUNDABLE: {
            status: 422,
            message: 'Booking has no refundable remainder to approve against',
          },
          // Approve only: the provider refused/failed the refund call —
          // nothing was ledgered and the request stays REQUESTED.
          REFUND_FAILED: {
            status: 502,
            message: 'Provider refund failed',
          },
        })
        .output(DecideCancellationResultSchema),
    },
  },
};

export type ContractRouter = typeof contract;
