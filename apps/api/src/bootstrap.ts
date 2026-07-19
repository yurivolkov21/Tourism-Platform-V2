import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { trustedOrigins } from './config/env.js';

/**
 * Adapter Fastify dùng chung cho `main.ts` VÀ test — một nguồn sự thật.
 *
 * `trustProxy`: deploy nằm sau reverse proxy của nền tảng (Render/Railway).
 * Không bật thì `req.ip` là IP của proxy — MỌI client dùng chung một địa
 * chỉ, nên rate limit theo IP sẽ khoá sạch cả site sau vài request của một
 * người.
 *
 * Vì sao là factory chứ không hard-code hai nơi: trước đây `main.ts` và
 * file test mỗi bên tự dựng adapter riêng, nên gỡ `trustProxy` khỏi
 * `main.ts` mà cả suite vẫn xanh (đã tái hiện được). Đúng loại lỗ mà
 * `configureHttp` bên dưới sinh ra để tránh — lặp lại lần hai thì phải
 * chữa tận gốc.
 */
export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({ trustProxy: true });
}

/**
 * Cấu hình tầng HTTP dùng chung cho cả `main.ts` (production) lẫn test e2e.
 *
 * Vì sao tách khỏi `main.ts`: những thứ ở đây là **bề mặt bảo mật** (CORS).
 * Nếu để nguyên trong `bootstrap()` của `main.ts` thì không test nào chạm
 * tới được — app trong test dựng thẳng từ `AppModule` nên bỏ qua sạch. Đó
 * đúng là kiểu lỗ mà đợt mutation-test 19/07 đã vạch ra: xoá guard đi mà
 * cả suite vẫn xanh.
 */
export async function configureHttp(app: NestFastifyApplication): Promise<void> {
  // `TRUSTED_ORIGINS` trước đây CHỈ nuôi CSRF check nội bộ của Better Auth —
  // nó không hề set `Access-Control-Allow-Origin`, nên trình duyệt chặn mọi
  // call từ web/admin sang API. Dùng lại đúng danh sách origin đó để không
  // phải bảo trì hai nguồn sự thật cho cùng một tập origin.
  //
  // `credentials: true` bắt buộc: session Better Auth đi bằng cookie, thiếu
  // nó thì trình duyệt không gửi cookie kèm request cross-origin.
  await app.register(import('@fastify/cors'), {
    // Spread: `trustedOrigins` là readonly, @fastify/cors nhận mảng thường.
    origin: [...trustedOrigins],
    credentials: true,
  });
}
