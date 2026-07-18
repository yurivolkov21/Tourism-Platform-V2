import { oc } from '@orpc/contract';
import { z } from 'zod';
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
};

export type ContractRouter = typeof contract;
