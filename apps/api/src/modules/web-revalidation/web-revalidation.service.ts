import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env.js';

/**
 * Trần tag của MỘT lệnh POST — gương `MAX_TAGS` của route web
 * (`apps/web/src/lib/api/revalidate-route.ts`). Route ấy từ chối NGUYÊN lệnh khi vượt
 * trần, kể cả tag `tours`, nên một điểm đến gắn từ 20 tour trở lên từng không bust được
 * trang nào (review A1-2). Đổi trần ở một bên thì phải đổi bên kia.
 */
export const REVALIDATE_TAGS_PER_CALL = 20;

/**
 * Bắn tín hiệu bust cache-tag sang web (ADR-0016 §3 "Chốt 2026-08-03").
 * Fire-and-forget ĐÚNG NGHĨA: mọi lỗi (non-200, network, timeout 3s) chỉ
 * warn — ISR 300s là lưới đúng đắn, đường này chết thì site chỉ KÉM TƯƠI
 * chứ không kém đúng; nghiệp vụ gốc (moderate) không được phép fail theo.
 * Call-site gọi `void service.revalidate(...)` SAU khi transaction commit
 * (bust trước commit = web regenerate đọc data cũ rồi cache lại 300s).
 */
@Injectable()
export class WebRevalidationService {
  private readonly logger = new Logger(WebRevalidationService.name);

  /**
   * Chia lô `REVALIDATE_TAGS_PER_CALL` tag, gửi TUẦN TỰ theo đúng thứ tự nhận: lô đầu mang
   * tag đầu (thường là `tours`). Mỗi lô tự nuốt lỗi của nó, nên một lô hỏng không chặn lô sau.
   */
  async revalidate(tags: string[]): Promise<void> {
    for (let start = 0; start < tags.length; start += REVALIDATE_TAGS_PER_CALL) {
      await this.post(tags.slice(start, start + REVALIDATE_TAGS_PER_CALL));
    }
  }

  /** Một lệnh POST tới route web; không bao giờ ném — lỗi chỉ thành một dòng warn. */
  private async post(tags: string[]): Promise<void> {
    const url = `${env.FRONTEND_URL.replace(/\/+$/, '')}/api/revalidate`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': env.REVALIDATE_SECRET,
        },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        this.logger.warn(`bust [${tags.join(', ')}] -> HTTP ${res.status} tu web`);
      }
    } catch (err) {
      this.logger.warn(`bust [${tags.join(', ')}] that bai: ${(err as Error).message}`);
    }
  }
}
