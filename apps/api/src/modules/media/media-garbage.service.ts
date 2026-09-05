import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { destroyAsset } from '../../lib/cloudinary-destroy.js';
import { resolveUploadConfig } from '../../lib/upload-signing.js';
import { classifyDestroyResult, dueBefore, GC_MAX_ATTEMPTS, shouldRetry } from './media-garbage.js';

/**
 * Hàng đợi xoá ảnh mồ côi trên Cloudinary (ADR-0035).
 *
 * Bảng `media_garbage` có từ migration `init` với đủ `attempts`/`lastError`/
 * `resource_type` — tức nó đã được thiết kế đúng như một hàng đợi có retry —
 * và chưa dòng code nào chạm vào cho tới đợt này.
 *
 * ## Bảng này KHÔNG phải danh sách "chắc chắn phải xoá"
 *
 * Nó là danh sách những publicId **chưa rõ số phận** (ADR-0035 §3). Đường ký
 * upload ghi vào đây ngay lúc ký, trước cả khi file tồn tại — vì upload bỏ dở
 * là nguồn mồ côi lớn nhất và là nguồn DUY NHẤT mà DB không bao giờ có row để
 * mà biết. Phán quyết thuộc về `sweep`, không thuộc về nơi enqueue.
 */
@Injectable()
export class MediaGarbageService {
  private readonly logger = new Logger(MediaGarbageService.name);

  /**
   * Xếp một hoặc nhiều publicId vào hàng đợi.
   *
   * `skipDuplicates` chứ không upsert: `created_at` của row CŨ là mốc bắt đầu
   * đếm 7 ngày, và ghi đè nó mỗi lần enqueue lại là gia hạn vô thời hạn cho
   * chính thứ ta đang cố dọn. Row đã có nghĩa là đồng hồ đã chạy.
   *
   * Nhận `tx` để nơi gọi đã có transaction thì ghi CÙNG transaction ấy (sửa
   * review), còn nơi không có thì truyền `prisma` (ADR-0035 §7).
   */
  async enqueue(
    tx: Prisma.TransactionClient,
    publicIds: readonly string[],
    resourceType = 'image',
  ): Promise<number> {
    if (publicIds.length === 0) return 0;

    const result = await tx.mediaGarbage.createMany({
      data: publicIds.map((publicId) => ({ publicId, resourceType })),
      skipDuplicates: true,
    });
    return result.count;
  }

  /**
   * Enqueue KHÔNG được phép làm hỏng việc chính (ADR-0035 §7).
   *
   * Ghi hàng đợi dọn rác là việc phụ; sửa review, đổi avatar và ký upload là
   * những việc người dùng đang đứng chờ. Dùng bản này ở mọi nơi KHÔNG có
   * transaction bao quanh — nơi có thì gọi thẳng `enqueue` để nó cùng sống
   * cùng chết với việc chính.
   */
  async enqueueQuietly(publicIds: readonly string[], resourceType = 'image'): Promise<void> {
    try {
      await this.enqueue(prisma, publicIds, resourceType);
    } catch (error) {
      this.logger.warn(
        `Không xếp được ${publicIds.length} publicId vào hàng dọn: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Một lượt quét: xử mọi row đã quá hạn chờ.
   *
   * Trả về số row đã **giải quyết xong** (xoá thật hoặc bỏ hàng vì hoá ra vẫn
   * còn người dùng) — không tính row hỏng phải để lại.
   */
  async sweep(now: Date, graceDays: number, batchSize = 200): Promise<number> {
    const cfg = resolveUploadConfig(env);
    if (!cfg) {
      // Không có secret thì không xoá được gì — và im lặng trả 0 sẽ khiến một
      // worker cấu hình thiếu trông y hệt một worker không có việc để làm.
      this.logger.warn('Bỏ qua lượt dọn media: chưa cấu hình Cloudinary API key/secret');
      return 0;
    }

    const rows = await prisma.mediaGarbage.findMany({
      where: { createdAt: { lt: dueBefore(now, graceDays) }, attempts: { lt: GC_MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });
    if (rows.length === 0) return 0;

    let resolved = 0;
    let destroyed = 0;
    let stillInUse = 0;

    for (const row of rows) {
      // ⚠️ Kiểm tham chiếu ở LÚC XOÁ, không phải lúc xếp hàng (ADR-0035 §2).
      // `@@unique([ownerType, ownerId, publicId])` là per-owner CỐ Ý nên một
      // publicId gắn được nhiều owner — "một owner buông" không bằng "mồ côi".
      // Đây cũng là chỗ chữa ca tác giả gỡ ảnh ra rồi đổi ý gắn lại trong
      // tuần chờ.
      if (await this.stillReferenced(row.publicId)) {
        await prisma.mediaGarbage.delete({ where: { id: row.id } });
        resolved += 1;
        stillInUse += 1;
        continue;
      }

      try {
        const outcome = classifyDestroyResult(
          await destroyAsset(cfg, row.publicId, row.resourceType),
        );
        if (outcome === 'done') {
          await prisma.mediaGarbage.delete({ where: { id: row.id } });
          resolved += 1;
          destroyed += 1;
          continue;
        }
        await this.markFailed(row.id, row.attempts, 'Cloudinary từ chối lệnh xoá');
      } catch (error) {
        await this.markFailed(
          row.id,
          row.attempts,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    this.logger.log(
      `Dọn media: ${destroyed} xoá khỏi CDN, ${stillInUse} hoá ra vẫn còn dùng, ` +
        `${rows.length - resolved} để lại thử lần sau`,
    );
    return resolved;
  }

  /**
   * Còn ai đang dùng publicId này không.
   *
   * Hỏi HAI nơi, và vế thứ hai là một lỗ phát hiện lúc thi công ADR-0035:
   *
   * 1. `media_assets` — chỗ hiển nhiên. `@@unique([ownerType, ownerId,
   *    publicId])` là per-owner CỐ Ý nên một publicId gắn được nhiều owner;
   *    chỉ cần MỘT row còn sống là ảnh chưa mồ côi (§2).
   * 2. `users.image` — **avatar KHÔNG có row `media_assets` nào.**
   *    `AccountService.setAvatar` chỉ ghi một URL delivery vào `User.image`.
   *    Mà đường ký upload thì enqueue mọi publicId nó cấp, kể cả avatar (§3) —
   *    nên nếu chỉ hỏi `media_assets`, bộ dọn sẽ xoá đúng cái avatar khách
   *    đang dùng, bảy ngày sau khi họ đổi nó.
   *
   * `contains` chứ không so bằng vì cột lưu URL đầy đủ chứ không lưu publicId.
   * Dương tính giả (một publicId là tiền tố của cái khác) là VÔ HẠI ở đây —
   * nó chỉ khiến ta không xoá. Phép kiểm này phải luôn nghiêng về phía KHÔNG
   * xoá, vì `destroy` không hoàn tác được.
   *
   * Hình dạng đúng về lâu dài là avatar cũng có row `media_assets`
   * (`MediaOwnerType.USER` + `MediaRole.avatar` đã có sẵn trong enum từ ngày
   * đầu — schema vốn định thế). Đổi đường ghi avatar nằm ngoài ADR-0035;
   * chừng nào chưa đổi thì vế thứ hai này là thứ giữ cho avatar sống.
   */
  private async stillReferenced(publicId: string): Promise<boolean> {
    const [asset, avatarUser] = await Promise.all([
      prisma.mediaAsset.findFirst({ where: { publicId }, select: { id: true } }),
      prisma.user.findFirst({ where: { image: { contains: publicId } }, select: { id: true } }),
    ]);
    return asset !== null || avatarUser !== null;
  }

  /**
   * Ghi một lượt hỏng. Row Ở LẠI kể cả khi chạm trần: một publicId hỏng mãi là
   * triệu chứng (quyền API bị thu hồi? cloud name sai?), và xoá nó là xoá luôn
   * triệu chứng.
   */
  private async markFailed(id: string, attempts: number, message: string): Promise<void> {
    const next = attempts + 1;
    await prisma.mediaGarbage.update({
      where: { id },
      data: { attempts: next, lastError: message.slice(0, 1000) },
    });
    if (!shouldRetry(next)) {
      this.logger.error(`Bỏ cuộc với media_garbage ${id} sau ${next} lượt: ${message}`);
    }
  }
}
