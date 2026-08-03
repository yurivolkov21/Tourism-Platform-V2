import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env.js';

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

  async revalidate(tags: string[]): Promise<void> {
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
