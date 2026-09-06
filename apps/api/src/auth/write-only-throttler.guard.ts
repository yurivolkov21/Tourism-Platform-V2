import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { env } from '../config/env.js';

/**
 * ThrottlerGuard chỉ đếm request GHI (non-GET) — GET/HEAD/OPTIONS đi qua tự
 * do, đúng bảng ADR-0037. Tracker giữ mặc định theo IP (dùng cho bề mặt
 * public như /api/auth/* — có session hay không đều phải đếm được).
 *
 * Vì sao không đếm GET, cụ thể với auth: `get-session` được SSR của web gọi
 * cho MỌI trang account — từ egress IP dùng chung của Vercel, tức một trần
 * theo IP trên GET là cả site chia nhau một bucket.
 *
 * LOOPBACK cũng không đếm, nhưng CHỈ ngoài production và đo bằng địa chỉ
 * SOCKET thô (`req.socket.remoteAddress` — không bao giờ chịu ảnh hưởng
 * X-Forwarded-For, khác `req.ip` vốn đi qua phép resolve trustProxy): đây là
 * traffic từ CHÍNH máy chạy API (int/e2e test, smoke script, curl chẩn
 * đoán) — không có vế này thì chính int suite tự khoá mình qua trần sign-up
 * (đo được: 42 test đỏ). Prod không có traffic ghi loopback hợp lệ nào
 * (worker inline chạy trong tiến trình, health check là GET) nên đếm tất —
 * một lớp giả định ít hơn.
 */
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

@Injectable()
export class WriteOnlyThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<{ method?: string; socket?: { remoteAddress?: string } }>();
    const method = req.method?.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
    if (env.NODE_ENV === 'production') return false;
    const raw = req.socket?.remoteAddress;
    return raw !== undefined && LOOPBACK_IPS.has(raw);
  }
}
