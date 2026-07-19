import { randomUUID } from 'node:crypto';
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
      // Honeypot: trả 200 GIẢ và không ghi gì. Không reject để bot không biết
      // mình bị phát hiện rồi đổi chiến thuật.
      //
      // `randomUUID()` chứ KHÔNG phải `null`: cùng status thôi chưa đủ — bot
      // đọc được body, nên `{id: null}` cạnh `{id: <uuid>}` của nhánh thành
      // công là tấm biển báo "mày bị bắt rồi", vô hiệu hoá đúng cái bẫy này
      // sinh ra để giăng. uuid trả về hợp lệ về cú pháp nhưng KHÔNG BAO GIỜ
      // được ghi xuống DB — không tra ra row nào, không rò rỉ id thật.
      //
      // Log warn để phía ta vẫn lần dấu được (đây là tín hiệu DUY NHẤT phân
      // biệt nhánh này). Giữ `email` — tín hiệu forensic hữu ích và là thứ
      // vẫn log thường ngày — nhưng TUYỆT ĐỐI không nội suy `website` thô:
      // đó là chuỗi do kẻ tấn công điều khiển, nội suy thẳng cho phép chèn
      // CR/LF giả mạo cả dòng log (xem `.max(200)` ở contract).
      if (input.website && input.website.length > 0) {
        this.logger.warn(`Honeypot triggered — email=${input.email}, website field non-empty`);
        return { id: randomUUID() };
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
