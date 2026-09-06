import { Logger, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ORPCModule, onError } from '@orpc/nest';
import { experimental_ZodSmartCoercionPlugin as ZodSmartCoercionPlugin } from '@orpc/zod/zod4';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { DefaultWriteThrottlerGuard } from './config/default-write-throttler.guard.js';
import { PUBLIC_WRITE_THROTTLE } from './config/throttle.js';
import { AllExceptionsFilter } from './lib/all-exceptions.filter.js';
import { captureException } from './lib/observability.js';
import { describeOrpcError, isUnexpectedOrpcError } from './lib/orpc-error-log.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { EnquiriesModule } from './modules/enquiries/enquiries.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { NewsletterModule } from './modules/newsletter/newsletter.module.js';
import { OutboxModule } from './modules/outbox/outbox.module.js';
import { PostsModule } from './modules/posts/posts.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { SiteMediaModule } from './modules/site-media/site-media.module.js';
import { StatsModule } from './modules/stats/stats.module.js';
import { WishlistModule } from './modules/wishlist/wishlist.module.js';

@Module({
  imports: [
    /**
     * Config runtime oRPC cho mọi controller `@Implement` (docs: openapi/
     * integrations/implement-contract-in-nest). ZodSmartCoercionPlugin biến
     * query string HTTP ("2", "true") thành number/boolean của schema để các
     * schema contract giữ đúng bản chất (không cần z.coerce) cho typed client.
     * Lỗi rơi vào onError được log MỘT DÒNG code/message (W2 mục 6 — dump
     * nguyên object là chép `cause` của OUTPUT_VALIDATION_FAILED, tức PII
     * response bị từ chối, ra stdout platform) + đẩy Sentry seam khi bất ngờ
     * (5xx / không phải ORPCError); oRPC vẫn trả envelope JSON của nó.
     */
    ORPCModule.forRoot({
      plugins: [new ZodSmartCoercionPlugin()],
      interceptors: [
        onError((error) => {
          const logger = new Logger('oRPC');
          if (isUnexpectedOrpcError(error)) {
            logger.error(describeOrpcError(error));
            captureException(error);
          } else {
            logger.warn(describeOrpcError(error));
          }
        }),
      ],
    }),
    /**
     * Rate limiting — từ W2 là guard TOÀN CỤC (ADR-0037, đảo mô hình opt-in
     * của ADR-0010): default module vẫn là PUBLIC_WRITE_THROTTLE, logic chọn
     * trần authed/public sống trong DefaultWriteThrottlerGuard bên dưới.
     *
     * Đếm theo `req.ip` cho public, mà `trustProxy` (danh sách proxy được
     * tin, xem `bootstrap.ts`) đã bật ở adapter — thiếu nó thì mọi client
     * dùng chung IP của proxy và trần này khoá sạch cả site.
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
    // ADR-0021: media giờ có controller riêng (MediaController, endpoint
    // media.signUpload) nên phải đứng tên ở đây — trước đây MediaModule chỉ
    // export MediaService để CatalogModule/PostsModule import ké, không tự
    // mount route nào nên không cần khai trong AppModule.
    MediaModule,
    // F5: số liệu vùng admin (spec P4b §3-F5) — module riêng vì cửa sổ
    // 28-ngày-đôi là khái niệm dùng chung cho ba vùng và cho dashboard P4d.
    StatsModule,
    // F7 (spec P4c): vùng outbox admin — list + retry, KHÔNG kéo WorkerModule
    // (retry chỉ đưa hàng về PENDING, worker tự nhặt ở lượt drain kế).
    OutboxModule,
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
     * ADR-0037: trần ghi MẶC ĐỊNH — đứng SAU AuthGuard (guard toàn cục chạy
     * theo thứ tự đăng ký) để đọc được `sessionUser`. GET không đếm; route
     * ghi mới không khai gì vẫn có trần; `@Throttle` per-route thắng.
     */
    { provide: APP_GUARD, useClass: DefaultWriteThrottlerGuard },
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
