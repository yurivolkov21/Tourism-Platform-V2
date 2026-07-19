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
   *
   * Hai điểm concurrency đã fix (code review):
   *   - `fromApproved`/`justApproved` được tính từ giá trị `isApproved` đọc
   *     LẠI TRONG transaction (khoá bằng `FOR UPDATE`) chứ không dùng
   *     snapshot đọc trước transaction — tránh TOCTOU khi hai admin bấm
   *     duyệt cùng review gần như đồng thời (audit trail ghi sai
   *     `fromApproved`, email có thể gửi/không-gửi sai).
   *   - Rating của tour được khoá row (`SELECT … FOR UPDATE`) TRƯỚC khi
   *     aggregate+ghi, xem chi tiết ở ③.
   */
  async moderate(
    actorId: string,
    input: { id: string; approve: boolean; note?: string },
  ): Promise<AdminReview> {
    const existing = await prisma.review.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        tourId: true,
        // Cần cho payload email ở bước ④ — ResendDeliverer throw nếu payload
        // thiếu `email` (xem resend.deliverer.ts). Review CURATED không có
        // user thật (userId null) nên không email được — bước ④ tự bỏ qua.
        user: { select: { email: true, name: true } },
        tour: { select: { title: true } },
      },
    });
    if (!existing) throw new ReviewNotFoundError();

    return prisma.$transaction(async (tx) => {
      // Khoá đúng row review NÀY trước khi đọc isApproved. Đọc thường
      // (không FOR UPDATE) dưới Read Committed có thể trả về snapshot đã cũ
      // nếu một moderate() khác trên CÙNG review đang chờ commit (TOCTOU) —
      // `FOR UPDATE` buộc câu SELECT này BLOCK tới khi lock giải phóng rồi
      // đọc lại giá trị mới nhất đã commit, nên fromApproved/justApproved
      // dưới đây luôn đúng dù hai admin bấm duyệt gần như đồng thời.
      const [locked] = await tx.$queryRaw<{ isApproved: boolean }[]>(Prisma.sql`
        SELECT is_approved AS "isApproved" FROM reviews WHERE id = ${input.id}::uuid FOR UPDATE
      `);
      if (!locked) throw new ReviewNotFoundError();

      const fromApproved = locked.isApproved;
      const justApproved = !fromApproved && input.approve;

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
          fromApproved,
          toApproved: input.approve,
          note: input.note ?? null,
        },
      });

      // ③ recompute rating của ĐÚNG tour đó (bỏ qua nếu là CURATED).
      //
      // Race đã tránh (ADR-0009 "single-statement atomic claims", áp dụng
      // TINH THẦN chứ không thể gộp mù một câu): trước đây đọc-rồi-ghi qua
      // `aggregate()` + `update()` hai round-trip riêng — dưới Read
      // Committed, hai transaction duyệt hai review KHÁC NHAU của CÙNG tour
      // đều aggregate trên snapshot KHÔNG thấy thay đổi (chưa commit) của
      // nhau rồi ghi đè lẫn nhau, ratingCount thiếu 1 (tự lành ở lần duyệt
      // kế nhưng vẫn là dữ liệu sai tạm thời).
      //
      // Gộp thẳng thành MỘT câu `UPDATE tours … FROM (SELECT AVG…) s` KHÔNG
      // đủ để fix — đã tự kiểm chứng bằng test tay hai transaction chồng
      // nhau trên Postgres thật: khi statement đó phải chờ lock trên row
      // Tour rồi chạy tiếp qua EvalPlanQual, Postgres CHỈ đọc lại đúng row
      // đích bị khoá, KHÔNG tính lại subquery aggregate — snapshot của cả
      // statement bị chốt ngay lúc statement bắt đầu chạy. Kết quả: vẫn mất
      // update y hệt bug gốc (đo được ratingCount thiếu 1).
      //
      // Cách đúng: khoá row Tour bằng `SELECT … FOR UPDATE` ở một statement
      // RIÊNG trước — statement này block tới khi transaction khác commit
      // xong. Statement UPDATE...FROM theo sau là statement MỚI nên có
      // snapshot MỚI, thấy đủ mọi thay đổi đã commit trước đó (kể cả của
      // transaction vừa nhả lock) → aggregate luôn đúng, không mất update.
      if (existing.tourId) {
        const [lockedTour] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id FROM tours WHERE id = ${existing.tourId}::uuid FOR UPDATE
        `);
        if (lockedTour) {
          await tx.$executeRaw(Prisma.sql`
            UPDATE tours t
            SET rating_avg = s.avg_rating,
                rating_count = s.cnt,
                updated_at = now()
            FROM (
              SELECT AVG(rating)::numeric(2,1) AS avg_rating, COUNT(*)::int AS cnt
              FROM reviews
              WHERE tour_id = ${existing.tourId}::uuid AND is_approved = true
            ) s
            WHERE t.id = ${existing.tourId}::uuid
          `);
        }
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
