import { Injectable } from '@nestjs/common';
import type { WishlistItem } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { MediaOwnerType } from '../../generated/prisma/enums.js';
import { pickCover } from '../catalog/catalog.service.js';
import { MediaService } from '../media/media.service.js';

export class TourNotFoundError extends Error {}

@Injectable()
export class WishlistService {
  // `MediaService` tiêm vào để lấy ảnh bìa theo LÔ — cùng cách `catalog.service`
  // làm. Không truy vấn ảnh trong vòng lặp: một trang wishlist tới 24 item thì
  // đó là 24 lượt đi DB thay vì một.
  constructor(private readonly media: MediaService) {}

  /**
   * Idempotent theo thiết kế: `wished: true` dùng upsert (thêm lại tour đã
   * có → no-op, KHÔNG 409), `wished: false` dùng deleteMany (xoá thứ không
   * tồn tại → no-op, KHÔNG 404). Cả hai đều tránh phải "kiểm tra rồi ghi",
   * nên không có khe hở race giữa hai request song song của cùng một người.
   */
  async set(
    userId: string,
    tourId: string,
    wished: boolean,
  ): Promise<{ tourId: string; wished: boolean }> {
    if (wished) {
      // Chỉ cho lưu tour đang publish — lưu tour nháp là rò rỉ sự tồn tại
      // của nội dung chưa phát hành.
      const tour = await prisma.tour.findFirst({
        where: { id: tourId, isPublished: true },
        select: { id: true },
      });
      if (!tour) throw new TourNotFoundError();

      await prisma.wishlist.upsert({
        where: { userId_tourId: { userId, tourId } },
        create: { userId, tourId },
        update: {}, // đã có thì để yên, giữ nguyên createdAt gốc
      });
      return { tourId, wished: true };
    }

    await prisma.wishlist.deleteMany({ where: { userId, tourId } });
    return { tourId, wished: false };
  }

  async list(userId: string, page: number, pageSize: number) {
    const where = { userId };
    const [rows, total] = await Promise.all([
      prisma.wishlist.findMany({
        where,
        // Tie-breaker `tourId`: createdAt là timestamp(3), hai item lưu trùng
        // millisecond sẽ có thứ tự không ổn định giữa các trang.
        orderBy: [{ createdAt: 'desc' }, { tourId: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tour: {
            select: {
              id: true,
              slug: true,
              title: true,
              basePrice: true,
              currency: true,
              durationDays: true,
              ratingAvg: true,
              ratingCount: true,
              isPublished: true,
            },
          },
        },
      }),
      prisma.wishlist.count({ where }),
    ]);

    // Một lượt duy nhất cho cả trang, kể cả khi rỗng (`resolveForOwners` với
    // mảng rỗng trả Map rỗng, không đánh DB).
    const coverMap = await this.media.resolveForOwners(
      MediaOwnerType.TOUR,
      rows.map((row) => row.tourId),
    );

    const items: WishlistItem[] = rows.map((row) => ({
      tourId: row.tourId,
      slug: row.tour.slug,
      title: row.tour.title,
      basePrice: row.tour.basePrice.toString(),
      currency: row.tour.currency,
      durationDays: row.tour.durationDays,
      ratingAvg: row.tour.ratingAvg === null ? null : Number(row.tour.ratingAvg),
      ratingCount: row.tour.ratingCount,
      addedAt: row.createdAt.toISOString(),
      // Cờ ngữ nghĩa thay vì tuồn `isPublished` ra ngoài.
      unavailable: !row.tour.isPublished,
      cover: pickCover(coverMap.get(row.tourId)),
    }));

    return { items, page, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  /** Batch: một query cho cả trang danh sách tour, thay vì hỏi từng tour. */
  async check(userId: string, tourIds: string[]): Promise<{ wishedTourIds: string[] }> {
    const rows = await prisma.wishlist.findMany({
      where: { userId, tourId: { in: tourIds } },
      select: { tourId: true },
    });
    return { wishedTourIds: rows.map((r) => r.tourId) };
  }
}
