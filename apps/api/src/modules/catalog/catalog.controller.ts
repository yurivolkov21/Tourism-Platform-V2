import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { CatalogService } from './catalog.service.js';

/**
 * Cài đặt contract oRPC (spec §6, D2) qua `@orpc/nest`:
 * mỗi method được decorate bằng `@Implement(<contract procedure>)` và trả về
 * `implement(<đúng procedure đó>).handler(...)` — @orpc/nest mount nó thành
 * route Nest thường tại `.route.path` của contract (`{slug}` → `:slug` cho
 * router), rồi validate input/output theo các schema của contract.
 *
 * Mọi procedure catalog đều PUBLIC — cố ý không gắn AuthGuard.
 */
@Controller()
export class CatalogController {
  private readonly startedAt = Date.now();

  constructor(private readonly catalog: CatalogService) {}

  /** Bản contract của health probe (REST /health vẫn giữ cho infra). */
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
