import { Module } from '@nestjs/common';
import { AdminSubscribersController } from './admin-subscribers.controller.js';
import { AdminSubscribersService } from './admin-subscribers.service.js';
import { NewsletterController } from './newsletter.controller.js';
import { NewsletterService } from './newsletter.service.js';

/**
 * Một module cho CẢ HAI đường của bảng `subscribers` (spec P4c §2.1): đường
 * khách (`NewsletterController`, `@Public()` + throttle + token HMAC) và
 * đường admin (`AdminSubscribersController`, guard + `@Roles(ADMIN)`). Hai
 * controller tách bạch vì hai lớp guard đối lập nhau — xem JSDoc
 * `AdminSubscribersController`.
 */
@Module({
  controllers: [NewsletterController, AdminSubscribersController],
  providers: [NewsletterService, AdminSubscribersService],
})
export class NewsletterModule {}
