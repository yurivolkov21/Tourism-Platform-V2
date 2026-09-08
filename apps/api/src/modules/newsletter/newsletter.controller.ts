import { Controller, Logger } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Public } from '../../auth/public.decorator.js';
import {
  InvalidConfirmTokenError,
  InvalidUnsubscribeTokenError,
  NewsletterService,
} from './newsletter.service.js';

// Mọi endpoint trong controller này công khai: khách gọi subscribe() chưa
// đăng nhập (ADR-0003), khách bấm link unsubscribe trong email cũng chưa
// chắc đã đăng nhập. AuthGuard chạy toàn cục nên thiếu @Public() ở class là
// 401 chết cả ba endpoint.
@Public()
@Controller()
export class NewsletterController {
  private readonly logger = new Logger(NewsletterController.name);

  constructor(private readonly newsletter: NewsletterService) {}

  // ThrottlerGuard riêng (PUBLIC_WRITE_THROTTLE, config/throttle.ts) chống
  // spam — gắn ở METHOD (không phải class) vì chỉ áp cho endpoint GHI công
  // khai, cùng khuôn với EnquiriesController. `unsubscribeConfirm` (GET) bên
  // dưới cố ý KHÔNG có guard này — đọc thuần, không cần trần tần suất.
  @Implement(contract.newsletter.subscribe)
  subscribe() {
    return implement(contract.newsletter.subscribe).handler(async ({ input }) => {
      // Honeypot: trả kết quả GIẢ (giống hệt nhánh thành công tới từng byte —
      // cả hai nhánh cùng `{subscribed: true}`), KHÔNG ghi gì. Không reject để
      // bot không biết mình bị phát hiện. Log warn để phía ta vẫn lần dấu được
      // — response giống hệt thành công là tín hiệu DUY NHẤT phân biệt nhánh
      // này.
      //
      // KHÔNG nội suy `website` thô vào log: chuỗi do kẻ tấn công điều khiển,
      // chèn CR/LF là giả mạo được cả dòng log (xem `.max(200)` ở contract).
      if (input.website && input.website.length > 0) {
        this.logger.warn(`Honeypot triggered — email=${input.email}, website field non-empty`);
        return { subscribed: true as const };
      }
      await this.newsletter.subscribe(input.email, input.source);
      // Luôn `true` — kể cả email đã tồn tại. Response khác nhau giữa "mới"
      // và "đã có" biến endpoint này thành máy dò email (xem JSDoc contract).
      return { subscribed: true as const };
    });
  }

  /**
   * GET — dữ liệu cho trang xác nhận. KHÔNG được có side effect: email client
   * (Gmail, Outlook) prefetch mọi link trong thư để quét virus, nếu GET này
   * tự huỷ đăng ký thì khách bị huỷ mà chưa hề bấm gì (spec §4.4).
   */
  @Implement(contract.newsletter.unsubscribeConfirm)
  unsubscribeConfirm() {
    return implement(contract.newsletter.unsubscribeConfirm).handler(async ({ input, errors }) => {
      try {
        return await this.newsletter.confirm(input.id, input.token);
      } catch (err) {
        if (err instanceof InvalidUnsubscribeTokenError) throw errors.INVALID_UNSUBSCRIBE_TOKEN();
        throw err;
      }
    });
  }

  /**
   * POST — thực thi huỷ đăng ký thật. Idempotent: gọi lại lần hai vẫn 200.
   * `resubscribeToken` CHỈ có ở lượt vừa claim được (nút "đổi ý" 30 ngày của
   * panel) — lượt sau không phát lại (vòng vá review W4).
   */
  @Implement(contract.newsletter.unsubscribe)
  unsubscribe() {
    return implement(contract.newsletter.unsubscribe).handler(async ({ input, errors }) => {
      try {
        const { resubscribeToken } = await this.newsletter.unsubscribe(input.id, input.token);
        return { unsubscribed: true as const, ...(resubscribeToken ? { resubscribeToken } : {}) };
      } catch (err) {
        if (err instanceof InvalidUnsubscribeTokenError) throw errors.INVALID_UNSUBSCRIBE_TOKEN();
        throw err;
      }
    });
  }

  /**
   * W4 E3 — double opt-in. GET: dữ liệu trang xác nhận, KHÔNG side effect
   * (mail client prefetch — cùng bài học với `unsubscribeConfirm`).
   */
  @Implement(contract.newsletter.confirmInfo)
  confirmInfo() {
    return implement(contract.newsletter.confirmInfo).handler(async ({ input, errors }) => {
      try {
        return await this.newsletter.confirmInfo(input.id, input.token);
      } catch (err) {
        if (err instanceof InvalidConfirmTokenError) throw errors.INVALID_CONFIRM_TOKEN();
        throw err;
      }
    });
  }

  /** POST — claim xác nhận thật, idempotent (bấm lần hai vẫn 200). */
  @Implement(contract.newsletter.confirm)
  confirm() {
    return implement(contract.newsletter.confirm).handler(async ({ input, errors }) => {
      try {
        await this.newsletter.confirmSubscription(input.id, input.token);
        return { confirmed: true as const };
      } catch (err) {
        if (err instanceof InvalidConfirmTokenError) throw errors.INVALID_CONFIRM_TOKEN();
        throw err;
      }
    });
  }

  /**
   * Vá review Task 6 — Khoản 1, siết W4 E4 + vòng vá review W4. POST — đăng
   * ký lại NGAY sau khi huỷ bằng token mục đích `resubscribe` (phát duy nhất
   * ở POST huỷ vừa thành công, hạn 30 ngày); token unsubscribe trong email
   * KHÔNG mở được cửa này.
   *
   * BẮT BUỘC POST, TUYỆT ĐỐI KHÔNG được thêm biến thể GET (xem JSDoc route
   * trong contract.ts): email client (Gmail, Outlook) prefetch mọi link
   * trong thư để quét virus — một GET resubscribe sẽ tự đăng ký lại đúng
   * người VỪA huỷ, y hệt cái bẫy mà việc tách GET/POST của `unsubscribe` ở
   * trên sinh ra để tránh. Idempotent: gọi lại lần hai vẫn 200.
   */
  @Implement(contract.newsletter.resubscribe)
  resubscribe() {
    return implement(contract.newsletter.resubscribe).handler(async ({ input, errors }) => {
      try {
        await this.newsletter.resubscribe(input.id, input.token);
        return { subscribed: true as const };
      } catch (err) {
        if (err instanceof InvalidUnsubscribeTokenError) throw errors.INVALID_UNSUBSCRIBE_TOKEN();
        throw err;
      }
    });
  }
}
