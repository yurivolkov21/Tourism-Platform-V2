import { Injectable } from '@nestjs/common';
import type {
  AdminReview,
  CreateReviewInputSchema,
  MyReview,
  PublicReview,
} from '@tourism/contract';
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
  tour: { slug: string; title: string } | null;
  moderatedBy: { name: string | null } | null;
}): AdminReview {
  return {
    ...toPublicReview(row),
    isApproved: row.isApproved,
    source: row.source,
    tourSlug: row.tour?.slug ?? null,
    // R2: tên tour + ai duyệt lần cuối (null khi chưa duyệt).
    tourTitle: row.tour?.title ?? null,
    moderatedAt: row.moderatedAt?.toISOString() ?? null,
    moderatedBy: row.moderatedBy?.name ?? null,
  };
}

/** Row → shape trả về ở `mine()`: chỉ thêm `isApproved` lên trên
 * `toPublicReview` (không cần source/tourSlug/moderatedAt như admin) — tách
 * hàm riêng thay vì mở rộng `toAdminReview` để khỏi kéo theo `tour.slug`
 * (query của `mine()` không include quan hệ `tour`, ít trùng lặp hơn phải
 * thêm include chỉ để phục vụ một field không dùng tới). */
export function toMyReview(
  row: Parameters<typeof toPublicReview>[0] & {
    isApproved: boolean;
    tour: { slug: string; title: string } | null;
  },
): MyReview {
  return {
    ...toPublicReview(row),
    isApproved: row.isApproved,
    // R1: danh tính tour (nullable — review curated có thể không gắn tour).
    tourSlug: row.tour?.slug ?? null,
    tourTitle: row.tour?.title ?? null,
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
   * Quyết định 31/07 (ĐẢO bất biến cũ): MỌI review đã duyệt CÓ `tourId` —
   * kể cả CURATED — đều tính vào ③. CURATED không gắn tour (`tourId` null)
   * vẫn không tính, gate chỉ cần `tourId` khác null là đủ. Trước đây gate ③
   * còn kiểm thêm `source === VERIFIED` để loại CURATED, với lý do "rating
   * phải đại diện khách đã thật sự đi tour, trộn nội dung marketing vào là
   * thổi phồng điểm". Đảo lại vì: capstone không có khách thật nên CURATED
   * là nguồn sao DUY NHẤT hiện có — giữ filter cũ thì rating tour gần như
   * luôn rỗng; một công thức DUY NHẤT giữa seed (bước 6b) và service ở đây
   * khử hẳn lớp bug "hai công thức lệch nhau ngủ yên tới lúc phát hiện"; và
   * nhất quán UI — review CURATED vẫn hiện công khai trên trang tour đó
   * (`listByTour`), tách riêng khỏi rating hiển thị cùng trang gây khó hiểu
   * cho người xem hơn là giúp gì.
   *
   * `prisma/seed.ts` (bước 6b) SAO CHÉP TAY đúng công thức recompute ③ bên
   * dưới — KHÔNG có shared helper giữa hai file; sửa công thức ở đây mà quên
   * sửa seed.ts thì rating seed ra và rating `moderate()` tính sẽ lệch nhau.
   *
   * Ba điểm concurrency đã fix (code review):
   *   - `fromApproved`/`justApproved` được tính từ giá trị `isApproved` đọc
   *     LẠI TRONG transaction (khoá bằng `FOR UPDATE`) chứ không dùng
   *     snapshot đọc trước transaction — tránh TOCTOU khi hai admin bấm
   *     duyệt cùng review gần như đồng thời (audit trail ghi sai
   *     `fromApproved`, email có thể gửi/không-gửi sai).
   *   - `tourId` dùng ở gate ③ CŨNG đọc TRONG transaction dưới CÙNG
   *     `FOR UPDATE` đó (không phải snapshot trước tx) — nhánh chưa có
   *     endpoint sửa review nên hiện tại vô hại, nhưng P4 (admin CRUD review)
   *     sẽ có request có thể đổi cột này; đọc trước tx thì moderate() chạy
   *     song song với request sửa đó có thể tính rating cho SAI tour.
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
        // Cần cho payload email ở bước ④ — ResendDeliverer throw nếu payload
        // thiếu `email` (xem resend.deliverer.ts). Review CURATED không có
        // user thật (userId null) nên không email được — bước ④ tự bỏ qua.
        // CHỈ dùng cho metadata email, KHÔNG dùng cho gate ③ (xem `locked`
        // trong transaction bên dưới) — không cần nhất quán atomic với phần
        // ghi rating.
        user: { select: { email: true, name: true } },
        tour: { select: { title: true } },
      },
    });
    if (!existing) throw new ReviewNotFoundError();

    return prisma.$transaction(async (tx) => {
      // Khoá đúng row review NÀY trước khi đọc isApproved/tourId/source. Đọc
      // thường (không FOR UPDATE) dưới Read Committed có thể trả về snapshot
      // đã cũ nếu một request khác trên CÙNG review đang chờ commit (TOCTOU)
      // — `FOR UPDATE` buộc câu SELECT này BLOCK tới khi lock giải phóng rồi
      // đọc lại giá trị mới nhất đã commit. Gộp CẢ BA cột vào MỘT câu SELECT
      // (không chỉ isApproved) để `tourId`/`source` dùng ở gate ③ cũng luôn
      // nhất quán với đúng review vừa bị khoá.
      const [locked] = await tx.$queryRaw<
        { isApproved: boolean; tourId: string | null; source: ReviewSource }[]
      >(Prisma.sql`
        SELECT is_approved AS "isApproved", tour_id AS "tourId", source AS "source"
        FROM reviews WHERE id = ${input.id}::uuid FOR UPDATE
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

      // ③ recompute rating của ĐÚNG tour đó — mọi review (kể cả CURATED) chỉ
      // cần CÓ `tourId` là tính (quyết định 31/07, xem doc-comment đầu hàm).
      // `locked.tourId` đọc TRONG transaction dưới CÙNG `FOR UPDATE` với
      // `isApproved` ở trên (không phải snapshot `existing` đọc trước tx) —
      // xem "Ba điểm concurrency" ở doc-comment đầu hàm.
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
      if (locked.tourId) {
        const [lockedTour] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id FROM tours WHERE id = ${locked.tourId}::uuid FOR UPDATE
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
              WHERE tour_id = ${locked.tourId}::uuid
                AND is_approved = true
            ) s
            WHERE t.id = ${locked.tourId}::uuid
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
        include: {
          tour: { select: { slug: true, title: true } },
          moderatedBy: { select: { name: true } },
        },
      });
      return toAdminReview(fresh);
    });
  }

  /**
   * Review đã duyệt của một tour. Sort [authorDeleted asc, createdAt desc]
   * chạy thẳng trên index [tourId, isApproved, authorDeleted, createdAt desc]
   * — review khuyết danh tự trôi xuống dưới, review có danh tính lên trước.
   * Thêm `id desc` làm tie-breaker cuối: `createdAt` là `timestamp(3)` (độ
   * phân giải millisecond) nên hai review trùng millisecond thì thứ tự giữa
   * chúng không ổn định qua các lần query — phân trang có thể lặp một item ở
   * hai trang hoặc bỏ sót một item. `id` (UUID) là duy nhất nên chốt được thứ
   * tự tuyệt đối.
   */
  async listByTour(
    tourSlug: string,
    page: number,
    pageSize: number,
  ): Promise<{
    items: PublicReview[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const tour = await prisma.tour.findFirst({
      where: { slug: tourSlug, isPublished: true },
      select: { id: true },
    });
    // 404 thay vì "200 rỗng": 200-rỗng che mất bug routing của FE.
    if (!tour) throw new TourNotFoundError();

    const where = { tourId: tour.id, isApproved: true };
    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: [{ authorDeleted: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.review.count({ where }),
    ]);

    return {
      items: rows.map(toPublicReview),
      page,
      // Output contract dùng `limit` (PagedSchema chung), không phải
      // `pageSize` — cùng gotcha đã ghi ở adminList() bên dưới.
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Review của CHÍNH user gọi API — khác `listByTour` ở chỗ KHÔNG lọc
   * `isApproved`: đây là review của chính họ nên họ có quyền thấy cả review
   * đang chờ duyệt. Output dùng `MyReviewSchema`/`toMyReview` (có thêm
   * `isApproved` so với `PublicReviewSchema`) để FE hiện badge "đang chờ
   * duyệt" — thiếu field này khách không phân biệt được review nào đã lên
   * trang tour, dễ tưởng gửi thất bại rồi gửi lại và ăn
   * `REVIEW_ALREADY_EXISTS`.
   *
   * Sort createdAt desc — mới nhất trước, không cần đẩy authorDeleted xuống
   * cuối như `listByTour` (review của chính mình thì tác giả luôn là mình).
   * Tie-breaker `id desc` cùng lý do đã ghi ở `listByTour`: `createdAt` chỉ
   * chính xác tới millisecond nên cần `id` (UUID, duy nhất) để thứ tự ổn định
   * qua các trang.
   */
  async mine(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{
    items: MyReview[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const where = { userId };
    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        // R1: kèm danh tính tour cho trang "Đánh giá của tôi".
        include: { tour: { select: { slug: true, title: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.review.count({ where }),
    ]);

    return {
      items: rows.map(toMyReview),
      page,
      // Output contract dùng `limit` (PagedSchema chung), không phải
      // `pageSize` — cùng gotcha đã ghi ở listByTour()/adminList() bên dưới.
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Hàng đợi moderation cho admin. Mặc định không lọc — admin thấy tất cả.
   * Tie-breaker `id desc` cùng lý do đã ghi ở `listByTour()`/`mine()`:
   * `createdAt` chỉ chính xác tới millisecond nên hai review trùng millisecond
   * thì thứ tự giữa chúng không ổn định qua các lần query — phân trang hàng
   * đợi moderation có thể lặp/bỏ sót item.
   */
  async adminList(query: {
    page: number;
    pageSize: number;
    isApproved?: boolean;
    source?: ReviewSource;
    rating?: number;
    search?: string;
  }): Promise<{
    items: AdminReview[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    // R2: cộng dồn các filter tùy chọn — source + rating khớp chính xác, search
    // là free-text không phân biệt hoa thường trên body/title/tên tác giả.
    const where: Prisma.ReviewWhereInput = {
      ...(query.isApproved === undefined ? {} : { isApproved: query.isApproved }),
      ...(query.source ? { source: query.source } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
      ...(query.search
        ? {
            OR: [
              { body: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              { authorName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          tour: { select: { slug: true, title: true } },
          moderatedBy: { select: { name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
