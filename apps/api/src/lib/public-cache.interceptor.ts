import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Cache-Control cho đường ĐỌC CÔNG KHAI (W4 R2, ADR-0037 AMEND 2) — lớp giảm
 * tải cho browser/proxy đứng TRƯỚC Render, song song với trần đọc R1 (web đã
 * ISR nên đây là lớp cho client gọi thẳng API).
 *
 * Gắn bằng `@UseInterceptors` trên ĐÚNG ba controller catalog/posts/
 * site-media — cố ý KHÔNG toàn cục: cache công khai một response cá nhân hoá
 * (`/api/auth`, `/api/account`, wishlist…) là rò dữ liệu người này sang
 * người kia qua proxy chung, nên mặc định an toàn là KHÔNG cache, route đọc
 * thuần phải điểm danh tường minh.
 *
 * Header đặt trong `tap` (chỉ nhánh THÀNH CÔNG): một 404/500 bị proxy cache
 * 60 giây là một tour vừa publish bị "mất" thêm một phút không ai hiểu vì sao.
 */
export const PUBLIC_READ_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

const SKIP_PUBLIC_CACHE = 'publicCache:skip';

/**
 * Miễn cache cho một method trong controller đã gắn interceptor ở cấp class
 * (vòng vá review W4): `health.check` nằm trong CatalogController từng nhận
 * `s-maxage=60` — một probe liveness bị proxy giữ 60 giây là probe nói dối.
 */
export const SkipPublicCache = () => SetMetadata(SKIP_PUBLIC_CACHE, true);

@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const method = http.getRequest<FastifyRequest>().method?.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return next.handle();
    if (this.reflector.get<boolean>(SKIP_PUBLIC_CACHE, context.getHandler())) return next.handle();
    http.getResponse<FastifyReply>().header('cache-control', PUBLIC_READ_CACHE_CONTROL);
    return next.handle().pipe(
      tap({
        error: () => {
          // Nhánh lỗi Nest thuần — gỡ header đã đặt sẵn. Lỗi oRPC (bySlug
          // NOT_FOUND) không đi qua đây: oRPC gửi reply bên trong handler,
          // xem ghi chú hook onSend ở bootstrap.
          http.getResponse<FastifyReply>().removeHeader('cache-control');
        },
      }),
    );
  }
}
