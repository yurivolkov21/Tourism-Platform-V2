import { randomUUID } from 'node:crypto';
import { Controller, Logger, Req } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest } from 'fastify';
import { auth } from '../../auth/auth.config.js';
import { Public } from '../../auth/public.decorator.js';
import { EnquiriesService, TourNotFoundError } from './enquiries.service.js';

// Form liên hệ công khai: khách chưa đăng nhập PHẢI gửi được (ADR-0003) —
// AuthGuard chạy toàn cục nên thiếu @Public() ở đây là 401 chết form ngay.
// ThrottlerGuard riêng (PUBLIC_WRITE_THROTTLE, config/throttle.ts) chống spam
// vì endpoint này không có auth để dựa vào.
@Public()
@Controller()
export class EnquiriesController {
  private readonly logger = new Logger(EnquiriesController.name);

  constructor(private readonly enquiries: EnquiriesService) {}

  @Implement(contract.enquiries.create)
  create(@Req() req: FastifyRequest) {
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
        // W4 E8 (ADR-0039 §6): route @Public nên AuthGuard KHÔNG gắn
        // sessionUser — tự đọc session (nếu có) để ghi `enquiries.user_id`:
        // deleteAccount anonymize được ngay lead của chính chủ. Khách ẩn
        // danh giữ null — email form tự do không chứng minh sở hữu.
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        const userId =
          session && session.user.deletedAt == null ? (session.user.id as string) : null;
        return await this.enquiries.create(input, userId);
      } catch (err) {
        if (err instanceof TourNotFoundError) throw errors.TOUR_NOT_FOUND();
        throw err;
      }
    });
  }
}
