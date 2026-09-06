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
 */
@Injectable()
export class WriteOnlyThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ method?: string }>();
    const method = req.method?.toUpperCase();
    return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  }
}
