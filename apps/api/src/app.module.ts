import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ORPCModule, onError } from '@orpc/nest';
import { experimental_ZodSmartCoercionPlugin as ZodSmartCoercionPlugin } from '@orpc/zod/zod4';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { PUBLIC_WRITE_THROTTLE } from './config/throttle.js';
import { AllExceptionsFilter } from './lib/all-exceptions.filter.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { EnquiriesModule } from './modules/enquiries/enquiries.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { NewsletterModule } from './modules/newsletter/newsletter.module.js';
import { PostsModule } from './modules/posts/posts.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { SiteMediaModule } from './modules/site-media/site-media.module.js';
import { WishlistModule } from './modules/wishlist/wishlist.module.js';

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
    /**
     * Rate limiting (lỗ #5 trong infra-parity). Đăng ký module ở đây nhưng
     * KHÔNG gắn ThrottlerGuard toàn cục — từng controller công khai tự gắn
     * `@UseGuards(ThrottlerGuard)`, xem `config/throttle.ts`.
     *
     * Đếm theo `req.ip`, mà `trustProxy: true` đã bật ở `main.ts` — thiếu nó
     * thì mọi client dùng chung IP của proxy và trần này khoá sạch cả site.
     */
    ThrottlerModule.forRoot([PUBLIC_WRITE_THROTTLE]),
    HealthModule,
    AuthModule,
    CatalogModule,
    BookingsModule,
    ReviewsModule,
    WishlistModule,
    EnquiriesModule,
    NewsletterModule,
    PostsModule,
    SiteMediaModule,
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
    /**
     * ADR-0010: chuẩn hoá mọi lỗi rơi vào pipeline Nest (guard 401/403, route
     * Nest thuần, lỗi bất ngờ) về envelope oRPC `{defined, code, status,
     * message, data}` — FE một parser. oRPC procedure-error tự format nên không
     * bị đụng.
     */
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
