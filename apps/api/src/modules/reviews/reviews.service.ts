import { Injectable } from '@nestjs/common';
import type { AdminReview, CreateReviewInputSchema, PublicReview } from '@tourism/contract';
import type { z } from 'zod';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { EmailType, ReviewSource } from '../../generated/prisma/enums.js';
import { checkReviewEligibility } from './review-eligibility.js';

/**
 * Lỗi domain — MỘT class cho MỖI lỗi, theo đúng pattern đã có ở
 * `bookings/refunds.service.ts`. Cố ý KHÔNG dùng một class chung mang string
 * code: `instanceof` cho type-safety lúc compile, còn string code gõ sai thì
 * chỉ chết lúc chạy.
 */
export class BookingNotFoundError extends Error {}
export class BookingForbiddenError extends Error {}
export class ReviewNotEligibleError extends Error {}
export class ReviewTripNotCompletedError extends Error {}
export class ReviewAlreadyExistsError extends Error {}
export class ReviewNotFoundError extends Error {}
export class TourNotFoundError extends Error {}

/** Row Prisma → shape công khai. Không bao giờ trả thẳng row (tránh rò userId). */
export function toPublicReview(row: {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  authorDeleted: boolean;
  createdAt: Date;
}): PublicReview {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    // Tác giả đã xoá tài khoản → giấu tên đã scrub, FE hiện "Deleted account".
    authorName: row.authorDeleted ? null : row.authorName,
    authorDeleted: row.authorDeleted,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Row + tour slug → shape admin. Admin thấy cả review chưa duyệt. */
export function toAdminReview(row: {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  authorDeleted: boolean;
  createdAt: Date;
  isApproved: boolean;
  source: ReviewSource;
  moderatedAt: Date | null;
  tour: { slug: string } | null;
}): AdminReview {
  return {
    ...toPublicReview(row),
    isApproved: row.isApproved,
    source: row.source,
    tourSlug: row.tour?.slug ?? null,
    moderatedAt: row.moderatedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class ReviewsService {
  async create(
    callerId: string,
    input: z.infer<typeof CreateReviewInputSchema>,
  ): Promise<PublicReview> {
    const booking = await prisma.booking.findUnique({
      where: { code: input.bookingCode },
      select: {
        id: true,
        userId: true,
        tourId: true,
        status: true,
        departureEndDate: true,
        user: { select: { name: true } },
      },
    });
    if (!booking) throw new BookingNotFoundError();

    const eligibility = checkReviewEligibility({
      bookingStatus: booking.status,
      departureEndDate: booking.departureEndDate,
      now: new Date(),
      ownerId: booking.userId,
      callerId,
    });
    if (!eligibility.ok) {
      if (eligibility.reason === 'NOT_OWNER') throw new BookingForbiddenError();
      if (eligibility.reason === 'TRIP_NOT_COMPLETED') throw new ReviewTripNotCompletedError();
      throw new ReviewNotEligibleError();
    }

    try {
      const row = await prisma.review.create({
        data: {
          source: ReviewSource.VERIFIED,
          tourId: booking.tourId,
          userId: booking.userId,
          bookingId: booking.id,
          // Snapshot tên lúc tạo — review vẫn đọc được sau khi user đổi tên.
          authorName: booking.user.name ?? 'Anonymous',
          rating: input.rating,
          title: input.title ?? null,
          body: input.body,
          isApproved: false,
        },
      });
      return toPublicReview(row);
    } catch (err) {
      // unique(bookingId) → mỗi booking đúng một review.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ReviewAlreadyExistsError();
      }
      throw err;
    }
  }

  /**
   * Duyệt / bỏ duyệt review — MỘT transaction gồm 4 việc:
   *   ① flip isApproved + dấu vết người duyệt
   *   ② ghi ReviewModerationEvent (append-only, audit A8)
   *   ③ recompute Tour.ratingAvg/ratingCount
   *   ④ enqueue outbox REVIEW_APPROVED, CHỈ khi false→true
   *
   * ③ nằm trong transaction nên rating không bao giờ lệch với trạng thái
   * duyệt — Nexora tính live mỗi page load (scan toàn bảng reviews).
   *
   * Review CURATED có tourId null (testimonial admin viết) nên BỎ QUA ③:
   * nó là social proof, không phải đánh giá chuyến đi.
   */
  async moderate(
    actorId: string,
    input: { id: string; approve: boolean; note?: string },
  ): Promise<AdminReview> {
    const existing = await prisma.review.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        isApproved: true,
        tourId: true,
        // Cần cho payload email ở bước ④ — ResendDeliverer throw nếu payload
        // thiếu `email` (xem resend.deliverer.ts). Review CURATED không có
        // user thật (userId null) nên không email được — bước ④ tự bỏ qua.
        user: { select: { email: true, name: true } },
        tour: { select: { title: true } },
      },
    });
    if (!existing) throw new ReviewNotFoundError();

    const justApproved = !existing.isApproved && input.approve;

    return prisma.$transaction(async (tx) => {
      // ① trạng thái + dấu vết
      await tx.review.update({
        where: { id: input.id },
        data: {
          isApproved: input.approve,
          moderatedById: actorId,
          moderatedAt: new Date(),
        },
      });

      // ② lịch sử append-only
      await tx.reviewModerationEvent.create({
        data: {
          reviewId: input.id,
          actorId,
          fromApproved: existing.isApproved,
          toApproved: input.approve,
          note: input.note ?? null,
        },
      });

      // ③ recompute rating của ĐÚNG tour đó (bỏ qua nếu là CURATED)
      if (existing.tourId) {
        const agg = await tx.review.aggregate({
          where: { tourId: existing.tourId, isApproved: true },
          _avg: { rating: true },
          _count: { _all: true },
        });
        await tx.tour.update({
          where: { id: existing.tourId },
          data: {
            ratingAvg: agg._avg.rating ?? null,
            ratingCount: agg._count._all,
          },
        });
      }

      // ④ email — chỉ ở lần chuyển false→true; dedupeKey chặn gửi lại khi
      // unapprove rồi approve lần nữa (quy ước <event>:<entityId>). Bỏ qua
      // khi review không gắn với user thật (CURATED) vì không có ai để gửi.
      if (justApproved && existing.user?.email) {
        await tx.outbox.createMany({
          data: [
            {
              type: EmailType.REVIEW_APPROVED,
              payload: {
                reviewId: input.id,
                email: existing.user.email,
                name: existing.user.name ?? null,
                title: existing.tour?.title ?? null,
              },
              dedupeKey: `review-approved:${input.id}`,
            },
          ],
          skipDuplicates: true,
        });
      }

      // Trả LUÔN shape admin từ trong transaction — không gọi lại query
      // ngoài tx (tránh đọc trạng thái đã cũ và tránh một round-trip thừa).
      const fresh = await tx.review.findUniqueOrThrow({
        where: { id: input.id },
        include: { tour: { select: { slug: true } } },
      });
      return toAdminReview(fresh);
    });
  }

  /** Hàng đợi moderation cho admin. Mặc định không lọc — admin thấy tất cả. */
  async adminList(query: { page: number; pageSize: number; isApproved?: boolean }): Promise<{
    items: AdminReview[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const where = query.isApproved === undefined ? {} : { isApproved: query.isApproved };
    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { tour: { select: { slug: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.review.count({ where }),
    ]);
    return {
      items: rows.map(toAdminReview),
      page: query.page,
      // Output contract dùng `limit` (PagedSchema chung), input query dùng
      // `pageSize` (PageQuerySchema chung) — hai schema khác tên field, map
      // tay ở đây.
      limit: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }
}
