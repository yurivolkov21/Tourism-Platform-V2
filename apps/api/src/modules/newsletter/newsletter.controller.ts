import { Controller, Logger, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Public } from '../../auth/public.decorator.js';
import { NewsletterService } from './newsletter.service.js';

// Form đăng ký bản tin công khai: khách chưa đăng nhập PHẢI gửi được (ADR-0003)
// — AuthGuard chạy toàn cục nên thiếu @Public() ở đây là 401 chết form ngay.
// ThrottlerGuard riêng (PUBLIC_WRITE_THROTTLE, config/throttle.ts) chống spam,
// cùng khuôn với EnquiriesController.
@Public()
@UseGuards(ThrottlerGuard)
@Controller()
export class NewsletterController {
  private readonly logger = new Logger(NewsletterController.name);

  constructor(private readonly newsletter: NewsletterService) {}

  @Implement(contract.newsletter.subscribe)
  subscribe() {
    return implement(contract.newsletter.subscribe).handler(async ({ input }) => {
      // Honeypot: trả kết quả GIẢ (giống hệt nhánh thành công), KHÔNG ghi gì.
      // Không reject để bot không biết mình bị phát hiện. Log warn để phía ta
      // vẫn lần dấu được — response giống hệt thành công là tín hiệu DUY NHẤT
      // phân biệt nhánh này.
      if (input.website && input.website.length > 0) {
        this.logger.warn(`Honeypot triggered — email=${input.email}, website=${input.website}`);
        return { subscribed: true as const };
      }
      await this.newsletter.subscribe(input.email, input.source);
      // Luôn `true` — kể cả email đã tồn tại. Response khác nhau giữa "mới"
      // và "đã có" biến endpoint này thành máy dò email (xem JSDoc contract).
      return { subscribed: true as const };
    });
  }
}
