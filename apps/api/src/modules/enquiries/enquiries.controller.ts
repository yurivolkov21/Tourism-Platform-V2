import { Controller, UseGuards } from '@nestjs/common';
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
  constructor(private readonly enquiries: EnquiriesService) {}

  @Implement(contract.enquiries.create)
  create() {
    return implement(contract.enquiries.create).handler(async ({ input, errors }) => {
      // Honeypot: trả 200 GIẢ (CÙNG status với nhánh thành công) và không ghi
      // gì. Không reject để bot không biết mình bị phát hiện rồi đổi chiến
      // thuật — status khác đi là dấu hiệu lộ ngay cho bot phân biệt.
      if (input.website && input.website.length > 0) {
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
