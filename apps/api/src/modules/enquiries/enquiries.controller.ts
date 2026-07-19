import { Controller, Logger, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Public } from '../../auth/public.decorator.js';
import { EnquiriesService, TourNotFoundError } from './enquiries.service.js';

// Form liên hệ công khai: khách chưa đăng nhập PHẢI gửi được (ADR-0003) —
// AuthGuard chạy toàn cục nên thiếu @Public() ở đây là 401 chết form ngay.
// ThrottlerGuard riêng (PUBLIC_WRITE_THROTTLE, config/throttle.ts) chống spam
// vì endpoint này không có auth để dựa vào.
@Public()
@UseGuards(ThrottlerGuard)
@Controller()
export class EnquiriesController {
  private readonly logger = new Logger(EnquiriesController.name);

  constructor(private readonly enquiries: EnquiriesService) {}

  @Implement(contract.enquiries.create)
  create() {
    return implement(contract.enquiries.create).handler(async ({ input, errors }) => {
      // Honeypot: trả 200 GIẢ (CÙNG status với nhánh thành công) và không ghi
      // gì. Không reject để bot không biết mình bị phát hiện rồi đổi chiến
      // thuật — status khác đi là dấu hiệu lộ ngay cho bot phân biệt. Đổi lại,
      // log warn kèm email + nội dung honeypot (KHÔNG log toàn bộ payload —
      // bỏ qua message/phone/...) để phía ta vẫn lần dấu được, vì response
      // giống hệt thành công là tín hiệu DUY NHẤT phân biệt nhánh này.
      if (input.website && input.website.length > 0) {
        this.logger.warn(`Honeypot triggered — email=${input.email}, website=${input.website}`);
        return { id: null };
      }
      try {
        return await this.enquiries.create(input);
      } catch (err) {
        if (err instanceof TourNotFoundError) throw errors.TOUR_NOT_FOUND();
        throw err;
      }
    });
  }
}
