import { oc } from '@orpc/contract';
import { z } from 'zod';
import {
  BookingCodeSchema,
  BookingSchema,
  BookingsListQuerySchema,
  CreateBookingInputSchema,
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
  },
};

export type ContractRouter = typeof contract;
