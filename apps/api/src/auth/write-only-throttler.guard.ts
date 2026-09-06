import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard chỉ đếm request GHI (non-GET) — GET/HEAD/OPTIONS đi qua tự
 * do, đúng bảng ADR-0037. Tracker giữ mặc định theo IP (dùng cho bề mặt
 * public như /api/auth/* — có session hay không đều phải đếm được).
 *
 * Vì sao không đếm GET, cụ thể với auth: `get-session` được SSR của web gọi
 * cho MỌI trang account — từ egress IP dùng chung của Vercel, tức một trần
 * theo IP trên GET là cả site chia nhau một bucket.
 *
 * LOOPBACK cũng không đếm: `req.ip` là 127.0.0.1/::1 nghĩa là traffic từ
 * CHÍNH máy chạy API (int/e2e test, smoke script, curl chẩn đoán) — kẻ tấn
 * công từ ngoài không giả được vì `trustProxy` là DANH SÁCH địa chỉ (XFF tự
 * gửi từ IP công khai bị bỏ qua, xem bootstrap.spec). Không có vế này thì
 * chính int suite tự khoá mình qua trần sign-up (đo được: 42 test đỏ).
 */
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

@Injectable()
export class WriteOnlyThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ method?: string; ip?: string }>();
    const method = req.method?.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
    return req.ip !== undefined && LOOPBACK_IPS.has(req.ip);
  }
}
