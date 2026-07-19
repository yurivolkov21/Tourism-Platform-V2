import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { prisma } from '../../auth/auth.config.js';

/**
 * Probe hạ tầng (`GET /health`) — đây là URL nền tảng deploy gọi để quyết
 * định có restart container / có định tuyến traffic vào hay không.
 *
 * KHÁC với `GET /api/health` của contract oRPC: cái kia là liveness thuần
 * ("process còn sống"), schema ép `status: 'ok'` nên không biểu diễn nổi
 * trạng thái hỏng. Cái này là **readiness** — phải chạm DB thật.
 *
 * Vì sao chạm DB: trước đây endpoint này trả `{status:'ok'}` tĩnh, nên khi
 * Postgres chết (hoặc Supabase free TỰ PAUSE sau 7 ngày không hoạt động)
 * probe vẫn xanh — nền tảng không restart, không cảnh báo, trong khi mọi
 * request thật đều 5xx. Nexora có `SELECT 1` ở đây từ đầu; v2 bỏ sót.
 */
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  async check(@Res({ passthrough: true }) reply: FastifyReply) {
    const uptimeSec = Math.round((Date.now() - this.startedAt) / 1000);
    const timestamp = new Date().toISOString();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' as const, database: 'up' as const, uptimeSec, timestamp };
    } catch {
      // 503 chứ không 500: nền tảng phân biệt "chưa sẵn sàng, đừng gửi
      // traffic vào" với "lỗi ứng dụng". Cố ý KHÔNG trả chi tiết lỗi ra
      // ngoài — endpoint này public, thông điệp lỗi DB có thể lộ host/user.
      reply.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'degraded' as const, database: 'down' as const, uptimeSec, timestamp };
    }
  }
}
