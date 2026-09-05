import { Module } from '@nestjs/common';
import { MediaGarbageService } from './media-garbage.service.js';

/**
 * Module RIÊNG cho hàng đợi dọn ảnh (ADR-0035) — cố ý **không có controller**.
 *
 * Vì sao không để chung `MediaModule`: worker process cần service này cho cron
 * `media-gc`, nhưng `MediaModule` khai `MediaController`, và controller ấy
 * mang `ThrottlerGuard`. Kéo cả `MediaModule` vào `WorkerModule` làm worker
 * chết lúc dựng context — *"Nest can't resolve dependencies of the
 * ThrottlerGuard … in the MediaModule"* — vì worker không dựng tầng HTTP nên
 * không có `THROTTLER:MODULE_OPTIONS`. (Đo được: ba int spec của worker đỏ
 * ngay lượt chạy đầu.)
 *
 * Tách ra là đường đúng chứ không phải đường vòng: thứ hai bên dùng chung là
 * một service không trạng thái, không phải một bề mặt HTTP. Cả `MediaModule`
 * lẫn `WorkerModule` cùng import module này thay vì mỗi bên tự khai provider —
 * hai bản khai là hai vòng đời cho cùng một thứ.
 */
@Module({
  providers: [MediaGarbageService],
  exports: [MediaGarbageService],
})
export class MediaGarbageModule {}
