import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { CatalogService } from './catalog.service.js';

/**
 * oRPC contract implementation (spec §6, D2) via `@orpc/nest`:
 * each method is decorated with `@Implement(<contract procedure>)` and returns
 * `implement(<same procedure>).handler(...)` — @orpc/nest mounts it as a
 * regular Nest route at the contract's `.route.path` (`{slug}` → `:slug` for
 * the router), then validates input/output against the contract schemas.
 *
 * All catalog procedures are PUBLIC — no AuthGuard on purpose.
 */
@Controller()
export class CatalogController {
  private readonly startedAt = Date.now();

  constructor(private readonly catalog: CatalogService) {}

  /** Contract flavour of the health probe (the REST /health stays for infra). */
  @Implement(contract.health.check)
  health() {
    return implement(contract.health.check).handler(() => ({
      status: 'ok' as const,
      uptimeSec: Math.round((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    }));
  }

  @Implement(contract.catalog.tours.list)
  listTours() {
    return implement(contract.catalog.tours.list).handler(({ input }) =>
      this.catalog.listTours(input),
    );
  }

  @Implement(contract.catalog.tours.bySlug)
  tourBySlug() {
    return implement(contract.catalog.tours.bySlug).handler(async ({ input, errors }) => {
      const tour = await this.catalog.getTourBySlug(input.slug);
      if (!tour) throw errors.NOT_FOUND();
      return tour;
    });
  }

  @Implement(contract.catalog.destinations.list)
  listDestinations() {
    return implement(contract.catalog.destinations.list).handler(() =>
      this.catalog.listDestinations(),
    );
  }

  @Implement(contract.catalog.categories.list)
  listCategories() {
    return implement(contract.catalog.categories.list).handler(() => this.catalog.listCategories());
  }
}
