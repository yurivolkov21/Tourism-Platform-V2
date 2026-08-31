import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import type { ReviewRowVM } from './reviews-view';

/**
 * Logic THUẦN của moderation review (spec P4b §3-F4) — đứng ngoài React và có
 * test riêng, đúng khuôn `refund.ts` (F2) và `cancellations-decide.ts` (F3).
 */

const t = messages.admin.reviews.moderate;

/**
 * Codec lỗi từ khối i18n `moderate.errors` (nguồn DUY NHẤT của tập mã contract
 * — test đối chiếu với `errorMap` thật của contract).
 */
const codec = createWriteErrorCodec(t.errors);

export const MODERATE_CONTRACT_CODES = codec.codes;

export type ModerateContractCode = keyof typeof t.errors;
export type ModerateFailureCode = ModerateContractCode | TransportFailureCode;

export const classifyModerateError = codec.classify;
export const moderateErrorCopy = codec.copy;

/**
 * Mã TRẠNG-THÁI-CŨ: lệnh không sửa được tại chỗ vì thế giới đã đổi dưới chân
 * dialog. Vùng này chỉ có MỘT (review đã biến mất — tài khoản tác giả hoặc
 * tour bị xoá đều cascade xuống review). UI xử: đóng dialog + toast + refresh
 * hàng đợi — copy hứa "the queue has been refreshed" nên UI PHẢI làm thật
 * (bài học review F3 31/08).
 */
export function isStaleStateCode(code: ModerateFailureCode): boolean {
  return code === 'REVIEW_NOT_FOUND';
}

/**
 * Phần review mà dialog thật sự cần — bảng cắt ĐÚNG các field này từ
 * `ReviewRowVM` (không truyền cả hàng: dialog không cần ngày gửi hay dấu vết
 * duyệt cũ, và cắt hẹp thì đọc code là biết dialog dựa vào gì để nói).
 */
export type ModerateTarget = Pick<
  ReviewRowVM,
  | 'id'
  | 'rating'
  | 'ratingLabel'
  | 'title'
  | 'body'
  | 'photos'
  | 'authorLabel'
  | 'authorDeleted'
  | 'source'
  | 'tourTitle'
  | 'approved'
>;

/**
 * Hệ quả THẬT của một lần bấm, theo `ReviewsService.moderate` (transaction
 * 4-trong-1: flip + audit + recompute rating + enqueue email). Trả về danh
 * sách câu để dialog chỉ việc in — KHÔNG có ternary nào rải trong JSX.
 *
 * Hai trong bốn việc CÓ ĐIỀU KIỆN, và cả hai điều kiện đọc được từ chính
 * `AdminReviewSchema`:
 *
 * - ③ recompute rating chỉ chạy khi review gắn tour (`locked.tourId`) — ở đây
 *   soi qua `tourTitle`, thứ admin thấy trên bảng.
 * - ④ email chỉ enqueue ở lần false→true VÀ chỉ khi review có user thật.
 *   CURATED không có tài khoản nào sau lưng; tác giả đã xoá tài khoản thì
 *   email trong DB là địa chỉ tombstone (`deleted+…@tombstone.local`, xem
 *   `AccountService`) — thư có được enqueue cũng không tới ai. Cả hai ca đều
 *   phải nói ra: hứa "khách sẽ nhận email" rồi không ai nhận là nói dối chính
 *   operator vừa bấm nút.
 */
export function moderateConsequences(target: ModerateTarget, approve: boolean): string[] {
  const copy = approve ? t.approveDialog.consequences : t.unapproveDialog.consequences;
  const rating = target.tourTitle ? copy.rating(target.tourTitle) : copy.noRating;

  if (!approve) {
    return [t.unapproveDialog.consequences.hide, rating, t.unapproveDialog.consequences.noEmail];
  }

  const email = target.authorDeleted
    ? t.approveDialog.consequences.noEmailDeleted
    : target.source === 'CURATED'
      ? t.approveDialog.consequences.noEmailCurated
      : t.approveDialog.consequences.email;

  return [t.approveDialog.consequences.publish, rating, email];
}

/**
 * Kết quả server action moderate. Sống ở LIB (không phải trong component) vì
 * nó là hợp đồng vận chuyển giữa `actions.ts` (server) và dialog (client) —
 * tầng server không import từ tầng trình bày (review F2 31/08).
 *
 * Nhánh thành công chỉ trả `approved` — đọc từ RESPONSE của server, không từ
 * input đã gửi. Tên tác giả cho toast lấy từ chính hàng đang mở (cùng review
 * id nên cùng tác giả), không cần server nhắc lại; dữ liệu bảng thì
 * `router.refresh()` kéo về, client KHÔNG giữ bản sao trạng thái nào.
 */
export type ModerateActionResult =
  | { ok: true; approved: boolean }
  | { ok: false; code: ModerateFailureCode };

export type ModerateAction = (input: {
  id: string;
  approve: boolean;
  note?: string;
}) => Promise<ModerateActionResult>;
