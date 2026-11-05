import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/public.decorator.js';

/**
 * Trang gốc `GET /` của API. Trước đây path này 404, nên ai mở thẳng
 * `api.nexora-travel.agency` trên trình duyệt (hội đồng, người chấm) tưởng
 * API chết dù `/health` vẫn xanh.
 *
 * Cố ý TĨNH, không chạm DB: đây chỉ là bảng chỉ đường, nói "tiến trình đang
 * chạy" rồi trỏ tới hai probe thật. Readiness (có `SELECT 1`) là việc của
 * `/health`; để trang gốc query DB là nhân đôi probe và mở thêm một đường đốt
 * pool kết nối vốn có trần (`config/db-pool.ts`).
 *
 * Không khai `@Throttle`: GET public rơi vào bucket đọc chung theo IP như mọi
 * route đọc khác (`DefaultThrottlerGuard`), HEAD không bao giờ bị đếm.
 */
// Bảng chỉ đường công khai: người lạ mở bằng trình duyệt, không bao giờ có session.
@Public()
@Controller()
export class RootController {
  @Get()
  index() {
    return {
      service: 'nexora-api',
      status: 'ok' as const,
      links: { health: '/health', liveness: '/api/health' },
    };
  }
}
