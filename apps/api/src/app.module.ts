import { Module } from '@nestjs/common';
import { ORPCModule, onError } from '@orpc/nest';
import { experimental_ZodSmartCoercionPlugin as ZodSmartCoercionPlugin } from '@orpc/zod/zod4';
import { AuthModule } from './auth/auth.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    /**
     * oRPC runtime config for every `@Implement` controller (docs: openapi/
     * integrations/implement-contract-in-nest). ZodSmartCoercionPlugin turns
     * HTTP query strings ("2", "true") into the schema's number/boolean so
     * contract schemas stay honest (no z.coerce) for typed clients.
     * Unexpected (non-ORPCError) failures are logged via onError; oRPC still
     * answers with its INTERNAL_SERVER_ERROR JSON shape.
     */
    ORPCModule.forRoot({
      plugins: [new ZodSmartCoercionPlugin()],
      interceptors: [
        onError((error) => {
          console.error('[orpc]', error);
        }),
      ],
    }),
    HealthModule,
    AuthModule,
    CatalogModule,
    BookingsModule,
  ],
})
export class AppModule {}
