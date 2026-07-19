import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ORPCModule, onError } from '@orpc/nest';
import { experimental_ZodSmartCoercionPlugin as ZodSmartCoercionPlugin } from '@orpc/zod/zod4';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';

@Module({
  imports: [
    /**
     * Config runtime oRPC cho mọi controller `@Implement` (docs: openapi/
     * integrations/implement-contract-in-nest). ZodSmartCoercionPlugin biến
     * query string HTTP ("2", "true") thành number/boolean của schema để các
     * schema contract giữ đúng bản chất (không cần z.coerce) cho typed client.
     * Lỗi ngoài dự kiến (không phải ORPCError) được log qua onError; oRPC vẫn
     * trả về theo shape JSON INTERNAL_SERVER_ERROR của nó.
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
    ReviewsModule,
  ],
  providers: [
    /**
     * Auth mặc định FAIL-CLOSED (ADR-0003): guard chạy cho MỌI route, route
     * public phải khai `@Public()` tường minh. Đảo lại mặc định cũ (opt-in
     * từng controller) vì route mới sinh ra sẽ mặc định an toàn — quên khai
     * gây 401 nhìn thấy ngay, thay vì một endpoint hở im lặng mà không
     * compiler/lint/test nào bắt được.
     */
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
