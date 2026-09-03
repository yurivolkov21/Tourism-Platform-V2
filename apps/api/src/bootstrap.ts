import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { trustedOrigins, trustProxy } from './config/env.js';

/**
 * Adapter Fastify dùng chung cho `main.ts` VÀ test — một nguồn sự thật.
 *
 * `trustProxy`: deploy nằm sau reverse proxy của nền tảng (Render/Railway).
 * Không bật thì `req.ip` là IP của proxy — MỌI client dùng chung một địa
 * chỉ, nên rate limit theo IP sẽ khoá sạch cả site sau vài request của một
 * người.
 *
 * Luật là DANH SÁCH ĐỊA CHỈ proxy được tin (`TRUST_PROXY`, mặc định các dải
 * nội bộ), KHÔNG phải `true` và KHÔNG phải hop-count:
 * - `true` tin toàn bộ chuỗi `X-Forwarded-For` do client gửi → `req.ip` là
 *   entry trái nhất mà kẻ tấn công tự đặt được → throttle chống spam bị
 *   bypass bằng cách đổi header mỗi request.
 * - `1` (hop-count, dùng tới 02/09) chỉ đếm số hop mà không nhìn địa chỉ:
 *   fastify 5.12.1 (GHSA-3m5p-2c4r-xxw2) chứng minh guard chống spoof của nó
 *   luôn đúng với mọi hop ≥ 1, và BỎ HẲN dạng số khỏi option.
 * Với danh sách địa chỉ, XFF chỉ được tin khi hop đang xét đến TỪ một proxy
 * trong danh sách; một client nối thẳng từ IP công khai mà tự gửi XFF thì
 * `req.ip` vẫn là địa chỉ socket của nó (test ở `bootstrap.spec.ts`).
 *
 * Vì sao là factory chứ không hard-code hai nơi: trước đây `main.ts` và
 * file test mỗi bên tự dựng adapter riêng, nên gỡ `trustProxy` khỏi
 * `main.ts` mà cả suite vẫn xanh (đã tái hiện được). Đúng loại lỗ mà
 * `configureHttp` bên dưới sinh ra để tránh — lặp lại lần hai thì phải
 * chữa tận gốc.
 */
export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({ trustProxy });
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
  //
  // `methods` PHẢI khai tường minh — `@fastify/cors` 11.x mặc định
  // `'GET,HEAD,POST'` (đối chiếu `node_modules/@fastify/cors/index.js`,
  // KHÔNG đoán theo docs online của bản `cors` npm cũ), thiếu `DELETE` thì
  // route DUY NHẤT dùng verb này (`AccountController.deleteOwnAccount`, Task
  // 7/A2 — xoá tài khoản) bị trình duyệt chặn NGAY tại preflight, server
  // không bao giờ thấy request tới (đo sống bằng Playwright thật mới lộ ra —
  // bootstrap.e2e.spec.ts canh lại để không tái phát, bài học hạ tầng xuyên
  // suốt CLAUDE.md §10). Danh sách khớp ĐÚNG tập verb toàn contract hiện có
  // (`grep "method: '" contract.ts` = GET/POST + đúng 1 PATCH) cộng 1 route
  // DELETE thuần REST — thêm verb mới thì cập nhật cả đây lẫn test canh.
  //
  // `PATCH` vào danh sách 12/08 vì ĐÚNG lớp lỗi cũ tái phát: cụm ADR-0021
  // thêm `account.setAvatar` (`PATCH /api/account/avatar`) mà quên chỗ này,
  // nên avatar upload xong 100% lên Cloudinary rồi chết ở bước ghi
  // `User.image` — kèm theo là nút gỡ avatar (cùng route). Bài học lặp: mọi
  // verb mới đều vô hình với int/e2e test vì `app.inject()` không enforce
  // CORS; chỉ trình duyệt thật (hoặc case preflight tường minh) mới thấy.
  await app.register(import('@fastify/cors'), {
    // Spread: `trustedOrigins` là readonly, @fastify/cors nhận mảng thường.
    origin: [...trustedOrigins],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
  });

  // Security headers (ADR-0010) — đặt ở đây (không main.ts) để test e2e phủ
  // được, đúng bài học mutation 19/07. CSP CỐ Ý tắt: API JSON không serve HTML,
  // CSP là hợp đồng của web P3b; bật mù dễ chặn nhầm asset. Các header còn lại
  // (HSTS, X-Content-Type-Options, frameguard, referrer-policy…) giữ nguyên.
  await app.register(import('@fastify/helmet'), {
    contentSecurityPolicy: false,
  });
}
