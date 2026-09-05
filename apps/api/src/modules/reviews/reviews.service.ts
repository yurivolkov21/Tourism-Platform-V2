import { Injectable } from '@nestjs/common';
import type {
  AdminReview,
  CreateReviewInputSchema,
  MediaItem,
  MyReview,
  PublicReview,
  ReviewBreakdown,
  ReviewModerationState,
  ReviewSortSchema,
  ReviewVerdict,
} from '@tourism/contract';
import type { z } from 'zod';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  EmailType,
  MediaOwnerType,
  MediaRole,
  MediaType,
  ReviewSource,
} from '../../generated/prisma/enums.js';
import { createdAtRange } from '../../lib/created-at-range.js';
import { uploadFolderFor } from '../../lib/upload-signing.js';
import { MediaService } from '../media/media.service.js';
import { moderationRevalidationTags } from '../web-revalidation/revalidation-decision.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
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
/** Ảnh gửi kèm KHÔNG nằm trong folder booking đang review (ADR-0021 §4). */
export class ReviewPhotoInvalidError extends Error {}

/** Row Prisma → shape công khai. Không bao giờ trả thẳng row (tránh rò userId).
 * `media` truyền TỪ NGOÀI vào (resolve theo lô ở nơi gọi, chống N+1) — hàm
 * này thuần, không tự query. */
export function toPublicReview(
  row: {
    id: string;
    rating: number;
    title: string | null;
    body: string;
    authorName: string;
    authorDeleted: boolean;
    createdAt: Date;
  },
  media: MediaItem[] = [],
): PublicReview {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    // Tác giả đã xoá tài khoản → giấu tên đã scrub, FE hiện "Deleted account".
    authorName: row.authorDeleted ? null : row.authorName,
    authorDeleted: row.authorDeleted,
    createdAt: row.createdAt.toISOString(),
    media,
  };
}

/** Row + tour slug → shape admin. Admin thấy cả review chưa duyệt. */
/**
 * Hai cột → MỘT trạng thái (ADR-0031 §1). Ở ĐÂY, một chỗ duy nhất: mỗi nơi tự
 * ghép `isApproved` với `rejectedAt` là một nơi có thể ghép sai, và cái sai ấy
 * im lặng (một review bị bác hiện ra như đang chờ duyệt).
 *
 * Ca "vừa đăng vừa bị bác" không cần xử ở đây — CHECK `reviews_verdict_shape`
 * của DB không cho nó tồn tại.
 */
/**
 * Include cho MỌI đường đọc trả `AdminReview`. Ba chỗ từng chép tay cùng một
 * object; nay còn phải kèm sự kiện moderation gần nhất (lý do bác), nên chép
 * tay là chắc chắn sót một chỗ và ở đó lý do biến mất im lặng.
 *
 * `take: 1` chứ không đọc cả lịch sử: cái cần là quyết định GẦN NHẤT, và một
 * review moderate nhiều lần thì kéo hết về là tốn băng thông cho dữ liệu
 * không ai in ra.
 */
/**
 * Ba trạng thái → mệnh đề `where`, khai MỘT chỗ (ADR-0031 §1).
 *
 * `pending` là chỗ dễ sai nhất và cũng là lý do ADR-0031 tồn tại: nó KHÔNG
 * phải "chưa đăng" mà là "chưa có phán quyết" — thiếu `rejectedAt: null` thì
 * hàng đợi lại nuốt cả những review đã bị bác, đúng bug vừa chữa.
 */
const MODERATION_STATE_WHERE: Record<ReviewModerationState, Prisma.ReviewWhereInput> = {
  pending: { isApproved: false, rejectedAt: null },
  approved: { isApproved: true },
  rejected: { rejectedAt: { not: null } },
};

export const REVIEW_ADMIN_INCLUDE = {
  tour: { select: { slug: true, title: true } },
  moderatedBy: { select: { name: true } },
  moderationEvents: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { note: true },
  },
} as const satisfies Prisma.ReviewInclude;

export function reviewModerationState(row: {
  isApproved: boolean;
  rejectedAt: Date | null;
}): ReviewModerationState {
  if (row.isApproved) return 'approved';
  return row.rejectedAt ? 'rejected' : 'pending';
}

/**
 * Ghi chú của lần quyết định GẦN NHẤT. Query gọi kèm
 * `moderationEvents: { orderBy desc, take: 1 }`, nên mảng có nhiều nhất một
 * phần tử; ở review bị bác đây chính là LÝ DO.
 */
function latestNote(row: { moderationEvents?: { note: string | null }[] }): string | null {
  return row.moderationEvents?.[0]?.note ?? null;
}

export function toAdminReview(
  row: {
    id: string;
    rating: number;
    title: string | null;
    body: string;
    authorName: string;
    authorDeleted: boolean;
    createdAt: Date;
    isApproved: boolean;
    rejectedAt: Date | null;
    source: ReviewSource;
    moderatedAt: Date | null;
    tour: { slug: string; title: string } | null;
    moderatedBy: { name: string | null } | null;
    moderationEvents?: { note: string | null }[];
  },
  media: MediaItem[] = [],
): AdminReview {
  return {
    ...toPublicReview(row, media),
    isApproved: row.isApproved,
    moderationState: reviewModerationState(row),
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    moderationNote: latestNote(row),
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
    rejectedAt: Date | null;
    tour: { slug: string; title: string } | null;
    moderationEvents?: { note: string | null }[];
  },
  media: MediaItem[] = [],
): MyReview {
  return {
    ...toPublicReview(row, media),
    isApproved: row.isApproved,
    // ADR-0031 §6: `isApproved: false` phủ cả "đang chờ" lẫn "đã bị bác", nên
    // trước đây khách bị bác vẫn đọc thấy "đang chờ duyệt" vĩnh viễn.
    moderationState: reviewModerationState(row),
    moderationNote: latestNote(row),
    // R1: danh tính tour (nullable — review curated có thể không gắn tour).
    tourSlug: row.tour?.slug ?? null,
    tourTitle: row.tour?.title ?? null,
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly webRevalidation: WebRevalidationService,
    private readonly media: MediaService,
  ) {}

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

    // Ảnh phải nằm trọn trong folder ĐÚNG booking này (ADR-0021 §4) — ký cho
    // booking nào chỉ đính được vào review của booking đó.
    //
    // Dedupe TRƯỚC validate/insert, giữ nguyên thứ tự xuất hiện đầu tiên
    // (Set giữ insertion order → sortOrder "ảnh đầu = đại diện" vẫn đúng).
    // Contract KHÔNG cấm publicId trùng nhau trong `photos` (double-click nút
    // Đăng, hoặc client gửi lại do lỗi mạng), nhưng MediaAsset có
    // `@@unique([ownerType, ownerId, publicId])` — createMany với publicId
    // trùng sẽ ném P2002. Khối catch bên dưới tóm MỌI P2002 và map thành
    // ReviewAlreadyExistsError (409) vì lý do phổ biến nhất là unique(bookingId)
    // — nếu không dedupe ở đây, P2002 do ảnh trùng bị map NHẦM thành
    // REVIEW_ALREADY_EXISTS dù review vừa tạo đã bị transaction rollback.
    const photos = [...new Set(input.photos ?? [])];
    const reviewFolder = `${uploadFolderFor(env.CLOUDINARY_UPLOAD_FOLDER, {
      purpose: 'REVIEW_PHOTO',
      bookingCode: input.bookingCode,
    })}/`;
    if (photos.some((publicId) => !publicId.startsWith(reviewFolder))) {
      throw new ReviewPhotoInvalidError();
    }

    try {
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
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
        if (photos.length > 0) {
          // sortOrder = vị trí trong mảng — ảnh đầu là ảnh đại diện.
          await tx.mediaAsset.createMany({
            data: photos.map((publicId, idx) => ({
              publicId,
              type: MediaType.IMAGE,
              ownerType: MediaOwnerType.REVIEW,
              ownerId: created.id,
              role: MediaRole.gallery,
              sortOrder: idx,
            })),
          });
        }
        return created;
      });
      const media = (await this.media.resolveForOwners(MediaOwnerType.REVIEW, [row.id])).get(
        row.id,
      );
      return toPublicReview(row, media ?? []);
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
    input: { id: string; verdict: ReviewVerdict; note?: string },
  ): Promise<AdminReview> {
    // Ba động từ → cặp trạng thái đích, khai thành DỮ LIỆU (ADR-0031 §3).
    // Rải if/else theo verdict trong một transaction dài là cách chắc chắn để
    // một nhánh quên xoá `rejected_at` — và ca ấy thì CHECK của DB bắt được,
    // nhưng bắt bằng một lỗi 500 giữa money-path của người duyệt.
    const TARGET = {
      approve: { isApproved: true, rejected: false },
      reject: { isApproved: false, rejected: true },
      unpublish: { isApproved: false, rejected: false },
    } as const;
    const target = TARGET[input.verdict];
    const existing = await prisma.review.findUnique({
      where: { id: input.id },
      select: {
        // Cần cho payload email ở bước ④ — ResendDeliverer throw nếu payload
        // thiếu `email` (xem resend.deliverer.ts). Review CURATED không có
        // user thật (userId null) nên không email được — bước ④ tự bỏ qua.
        // CHỈ dùng cho metadata email, KHÔNG dùng cho gate ③ (xem `locked`
        // trong transaction bên dưới) — không cần nhất quán atomic với phần
        // ghi rating.
        user: { select: { email: true, name: true, deletedAt: true } },
        tour: { select: { title: true } },
      },
    });
    if (!existing) throw new ReviewNotFoundError();

    // Bắt fromApproved từ trong closure — cần cho quyết định bust SAU commit
    // (xem cuối hàm). KHÔNG dùng `existing` (snapshot đọc TRƯỚC transaction,
    // có thể cũ) — gán lại đúng giá trị đọc dưới FOR UPDATE ngay khi có nó.
    let fromApprovedForRevalidate = false;
    const result = await prisma.$transaction(async (tx) => {
      // Khoá đúng row review NÀY trước khi đọc isApproved/tourId/source. Đọc
      // thường (không FOR UPDATE) dưới Read Committed có thể trả về snapshot
      // đã cũ nếu một request khác trên CÙNG review đang chờ commit (TOCTOU)
      // — `FOR UPDATE` buộc câu SELECT này BLOCK tới khi lock giải phóng rồi
      // đọc lại giá trị mới nhất đã commit. Gộp CẢ BA cột vào MỘT câu SELECT
      // (không chỉ isApproved) để `tourId`/`source` dùng ở gate ③ cũng luôn
      // nhất quán với đúng review vừa bị khoá.
      const [locked] = await tx.$queryRaw<
        {
          isApproved: boolean;
          rejectedAt: Date | null;
          tourId: string | null;
          source: ReviewSource;
        }[]
      >(Prisma.sql`
        SELECT is_approved AS "isApproved", rejected_at AS "rejectedAt",
               tour_id AS "tourId", source AS "source"
        FROM reviews WHERE id = ${input.id}::uuid FOR UPDATE
      `);
      if (!locked) throw new ReviewNotFoundError();

      const fromApproved = locked.isApproved;
      const fromRejected = locked.rejectedAt !== null;
      fromApprovedForRevalidate = fromApproved;

      // Guard trạng-thái-trùng (review F4 31/08): tab cũ bấm approve lên
      // review ĐÃ approved (hoặc unapprove lên đã unapproved) là lệnh không
      // mang thông tin — no-op trả trạng thái hiện tại, KHÔNG ghi đè
      // moderatedBy thành người-không-quyết-gì, KHÔNG đẩy event from===to
      // vào audit trail append-only, không email, không đụng rating.
      // So CẢ HAI trục, không chỉ `isApproved` (ADR-0031 §1): trước đây
      // `unpublish` lên một review ĐANG BỊ BÁC trông như no-op vì cả hai đều
      // có `isApproved = false`, trong khi nó thật sự là một thay đổi — đưa
      // review trở lại hàng đợi.
      if (fromApproved === target.isApproved && fromRejected === target.rejected) {
        return await tx.review.findUniqueOrThrow({
          where: { id: input.id },
          include: REVIEW_ADMIN_INCLUDE,
        });
      }

      const justApproved = !fromApproved && target.isApproved;
      const justRejected = !fromRejected && target.rejected;
      const decidedAt = new Date();

      // ① trạng thái + dấu vết. `approve` XOÁ `rejected_at` (ADR-0031 §3):
      // phán quyết đảo được, và lúc ấy review phải về một trạng thái sạch chứ
      // không mang theo dấu vết mâu thuẫn — đó cũng là thứ CHECK của DB đòi.
      await tx.review.update({
        where: { id: input.id },
        data: {
          isApproved: target.isApproved,
          rejectedAt: target.rejected ? decidedAt : null,
          rejectedById: target.rejected ? actorId : null,
          moderatedById: actorId,
          moderatedAt: decidedAt,
        },
      });

      // ② lịch sử append-only
      await tx.reviewModerationEvent.create({
        data: {
          reviewId: input.id,
          actorId,
          fromApproved,
          toApproved: target.isApproved,
          toRejected: target.rejected,
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
      // khi review không gắn user thật (CURATED — không có ai để gửi) VÀ khi
      // tài khoản đã tự xoá: soft-delete chỉ tombstone hoá email
      // (`deleted+…@tombstone.local`, xem account.service) — gửi vào đó là
      // bounce vĩnh viễn + retry rác, và UI đã hứa "No email goes out"
      // (review F4 31/08).
      if (justApproved && existing.user?.email && !existing.user.deletedAt) {
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

      // ④b bác bỏ thì cũng phải BÁO (ADR-0031 §6) — im lặng là để khách đợi
      // một thứ không bao giờ tới, đúng thứ vừa vá ở mail duyệt huỷ. Mang
      // theo `note` làm lý do. `unpublish` KHÔNG gửi: nó chưa phải phán quyết.
      // Cùng ba điều kiện bỏ qua với ④: không user thật (CURATED), hoặc tài
      // khoản đã tự xoá (email đã tombstone hoá, gửi vào đó là bounce + retry).
      if (justRejected && existing.user?.email && !existing.user.deletedAt) {
        await tx.outbox.createMany({
          data: [
            {
              type: EmailType.REVIEW_REJECTED,
              payload: {
                reviewId: input.id,
                email: existing.user.email,
                name: existing.user.name ?? null,
                title: existing.tour?.title ?? null,
                note: input.note ?? null,
              },
              dedupeKey: `review-rejected:${input.id}`,
            },
          ],
          skipDuplicates: true,
        });
      }

      // Trả LUÔN row thô từ trong transaction — không gọi lại query ngoài tx
      // (tránh đọc trạng thái đã cũ và tránh một round-trip thừa). Dựng shape
      // AdminReview ở NGOÀI tx (sau dòng dưới) vì còn cần media, resolve bằng
      // MediaService (không chạy trong tx — chỉ đọc, không cần nhất quán
      // atomic với phần ghi rating ở trên).
      return await tx.review.findUniqueOrThrow({
        where: { id: input.id },
        include: REVIEW_ADMIN_INCLUDE,
      });
    });

    const media = (await this.media.resolveForOwners(MediaOwnerType.REVIEW, [result.id])).get(
      result.id,
    );
    const review = toAdminReview(result, media ?? []);

    // Bust cache web SAU khi transaction đã commit (spec 03/08 §3): bust
    // trước commit là race — web regenerate đọc data cũ rồi cache 300s.
    // `void`: fire-and-forget, moderate không đợi và không fail theo.
    const tags = moderationRevalidationTags({
      tourSlug: review.tourSlug,
      fromApproved: fromApprovedForRevalidate,
      toApproved: target.isApproved,
    });
    if (tags) void this.webRevalidation.revalidate(tags);
    return review;
  }

  /**
   * Review đã duyệt của một tour — nuôi cả trang tour (vài review đầu) lẫn
   * modal "xem tất cả review" (sort/lọc sao/lọc có ảnh + breakdown theo sao).
   *
   * Khoá CHÍNH của MỌI kiểu sort luôn là `authorDeleted asc` (luật sản phẩm:
   * review khuyết danh luôn trôi xuống cuối, kể cả khi rating của nó cao nhất
   * ở sort=highest) — vẫn chạy thẳng trên index
   * [tourId, isApproved, authorDeleted, createdAt desc] khi sort=newest/oldest
   * (index không phủ `rating` nên highest/lowest phải scan/sort thêm).
   * Khoá CUỐI luôn `id desc` làm tie-breaker: `createdAt`/`rating` có thể
   * trùng giữa nhiều review nên thứ tự giữa chúng không ổn định qua các lần
   * query nếu thiếu tie-breaker — phân trang có thể lặp một item ở hai trang
   * hoặc bỏ sót một item. `id` (UUID) là duy nhất nên chốt được thứ tự tuyệt
   * đối.
   *
   * `breakdown` (số review theo từng mức sao) LUÔN tính trên tập CHƯA lọc
   * theo `rating` (nhưng CÓ áp `withPhotos` nếu bật) — tính sau khi đã lọc
   * theo sao thì bấm 5★ xong các mức khác về 0, người dùng không bấm lại
   * được các nút sao khác nữa.
   */
  async listByTour(query: {
    tourSlug: string;
    page: number;
    pageSize: number;
    sort: z.infer<typeof ReviewSortSchema>;
    rating?: number;
    withPhotos?: boolean;
  }): Promise<{
    items: PublicReview[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    breakdown: ReviewBreakdown;
  }> {
    const tour = await prisma.tour.findFirst({
      where: { slug: query.tourSlug, isPublished: true },
      select: { id: true },
    });
    // 404 thay vì "200 rỗng": 200-rỗng che mất bug routing của FE.
    if (!tour) throw new TourNotFoundError();

    const sortKey = {
      newest: { createdAt: 'desc' },
      oldest: { createdAt: 'asc' },
      highest: { rating: 'desc' },
      lowest: { rating: 'asc' },
    }[query.sort] as Prisma.ReviewOrderByWithRelationInput;

    // MediaAsset là bảng ĐA HÌNH (ownerType/ownerId) — Review KHÔNG có quan
    // hệ Prisma nào sang nó nên `media: { some: {} }` không compile được.
    // Lấy trước tập id review CÓ ảnh của ĐÚNG tour này (giới hạn trong review
    // đã duyệt — không quét toàn bảng media_assets), rồi lọc bằng
    // `id: { in: ... } }`.
    const idsWithPhotos = query.withPhotos
      ? (
          await prisma.mediaAsset.findMany({
            where: {
              ownerType: MediaOwnerType.REVIEW,
              ownerId: {
                in: (
                  await prisma.review.findMany({
                    where: { tourId: tour.id, isApproved: true },
                    select: { id: true },
                  })
                ).map((r) => r.id),
              },
            },
            select: { ownerId: true },
            distinct: ['ownerId'],
          })
        ).map((m) => m.ownerId)
      : null;

    const where: Prisma.ReviewWhereInput = {
      tourId: tour.id,
      isApproved: true,
      ...(query.rating ? { rating: query.rating } : {}),
      ...(idsWithPhotos ? { id: { in: idsWithPhotos } } : {}),
    };
    // breakdown dùng where RIÊNG — KHÔNG áp `rating` (xem doc-comment đầu hàm)
    // nhưng VẪN áp `withPhotos` nếu bật, vì đó là phạm vi review người dùng
    // đang thật sự xem, khác `rating` (chỉ là một lát cắt của breakdown).
    const breakdownWhere: Prisma.ReviewWhereInput = {
      tourId: tour.id,
      isApproved: true,
      ...(idsWithPhotos ? { id: { in: idsWithPhotos } } : {}),
    };

    const [rows, total, grouped] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: [{ authorDeleted: 'asc' }, sortKey, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.review.count({ where }),
      prisma.review.groupBy({ by: ['rating'], where: breakdownWhere, _count: { _all: true } }),
    ]);

    const breakdown: ReviewBreakdown = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const g of grouped) breakdown[String(g.rating) as keyof ReviewBreakdown] = g._count._all;

    // MỘT query media cho cả trang (chống N+1) — cùng khuôn catalog/posts.
    const mediaMap = await this.media.resolveForOwners(
      MediaOwnerType.REVIEW,
      rows.map((r) => r.id),
    );

    return {
      items: rows.map((row) => toPublicReview(row, mediaMap.get(row.id) ?? [])),
      page: query.page,
      // Output contract dùng `limit` (PagedSchema chung), không phải
      // `pageSize` — cùng gotcha đã ghi ở adminList() bên dưới.
      limit: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      breakdown,
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
        // R1: kèm danh tính tour cho trang "Đánh giá của tôi". Từ ADR-0031
        // kèm cả ghi chú quyết định gần nhất — ở review bị bác đó là LÝ DO,
        // và khách có quyền biết vì sao review của mình không lên site.
        include: {
          tour: { select: { slug: true, title: true } },
          moderationEvents: { orderBy: { createdAt: 'desc' }, take: 1, select: { note: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.review.count({ where }),
    ]);

    // MỘT query media cho cả trang (chống N+1) — cùng khuôn catalog/posts.
    const mediaMap = await this.media.resolveForOwners(
      MediaOwnerType.REVIEW,
      rows.map((r) => r.id),
    );

    return {
      items: rows.map((row) => toMyReview(row, mediaMap.get(row.id) ?? [])),
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
    state?: ReviewModerationState;
    source?: ReviewSource;
    rating?: number;
    search?: string;
    from?: string;
    to?: string;
  }): Promise<{
    items: AdminReview[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    // R2: cộng dồn các filter tùy chọn — source + rating khớp chính xác, search
    // là free-text không phân biệt hoa thường trên body/title/tên tác giả.
    //
    // ADR-0028 §AMEND 2 thêm khoảng ngày theo `createdAt` — ngày review được
    // GỬI, cùng cột `orderBy` bên dưới. Biên NỬA-MỞ (lý do đầy đủ ở
    // `created-at-range.ts`), dùng CHUNG hàm với bảng bookings và bảng
    // cancellations nên ba vùng không thể hiểu "trọn ngày `to`" khác nhau.
    const createdAt = createdAtRange(query.from, query.to);
    const where: Prisma.ReviewWhereInput = {
      ...(query.state ? MODERATION_STATE_WHERE[query.state] : {}),
      ...(createdAt ? { createdAt } : {}),
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
        include: REVIEW_ADMIN_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.review.count({ where }),
    ]);
    // MỘT query media cho cả trang (chống N+1) — cùng khuôn catalog/posts.
    const mediaMap = await this.media.resolveForOwners(
      MediaOwnerType.REVIEW,
      rows.map((r) => r.id),
    );
    return {
      items: rows.map((row) => toAdminReview(row, mediaMap.get(row.id) ?? [])),
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
