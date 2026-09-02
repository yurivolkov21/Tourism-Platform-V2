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
// Mã trạng-thái-cũ khai NGAY trong codec (vòng vá review F7) — hết predicate tay.
const codec = createWriteErrorCodec(t.errors, { stale: ['REVIEW_NOT_FOUND'] });

export const MODERATE_CONTRACT_CODES = codec.codes;

export type ModerateContractCode = keyof typeof t.errors;
export type ModerateFailureCode = ModerateContractCode | TransportFailureCode;

export const classifyModerateError = codec.classify;
export const moderateErrorCopy = codec.copy;

/**
 * Mã TRẠNG-THÁI-CŨ: lệnh không sửa được tại chỗ vì thế giới đã đổi dưới chân
 * dialog. Vùng này chỉ có MỘT — review đã biến mất khỏi DB (hard-delete row
 * user hoặc xoá tour mới cascade xuống review; LƯU Ý: khách tự xoá tài khoản
 * là SOFT-delete tombstone, review Ở LẠI queue với `authorDeleted` — xem
 * `AccountService`, đừng tưởng nó biến mất). UI xử: đóng dialog + toast +
 * refresh hàng đợi — copy hứa "the queue has been refreshed" nên UI PHẢI làm
 * thật (bài học review F3 31/08).
 */
export const isStaleStateCode = codec.isStale;

/**
 * Phần review mà dialog thật sự cần — bảng cắt ĐÚNG các field này từ
 * `ReviewRowVM` (không truyền cả hàng: dialog không cần ngày gửi hay dấu vết
 * duyệt cũ, và cắt hẹp thì đọc code là biết dialog dựa vào gì để nói).
 */
export type ModerateTarget = Pick<
  ReviewRowVM,
  | 'id'
  | 'ratingLabel'
  | 'title'
  | 'body'
  | 'photos'
  | 'photosLabel'
  | 'authorLabel'
  | 'authorDeleted'
  | 'source'
  | 'tourTitle'
  | 'approved'
>;

/**
 * Hệ quả THẬT của một lần bấm, theo `ReviewsService.moderate` (flip + audit +
 * recompute rating + enqueue email + bust cache web sau commit). Trả về danh
 * sách câu để dialog chỉ việc in — KHÔNG có ternary nào rải trong JSX.
 *
 * MỌI dòng đều có điều kiện đọc được từ chính `AdminReviewSchema`:
 *
 * - publish/hide: chỉ nói "trang tour" khi review GẮN tour — review mồ côi
 *   không hiện ở đâu trên site, hứa "lên trang tour" là nói dối (review F4).
 * - ③ recompute rating chỉ chạy khi review gắn tour; câu unapprove nói thẳng
 *   ca review-duy-nhất: rating tour BIẾN MẤT, không chỉ "tính lại".
 * - ④ email chỉ enqueue ở lần false→true, có user thật và tài khoản CHƯA xoá
 *   (server gate `!deletedAt` từ vòng vá F4 — không còn thư nào bay tới địa
 *   chỉ tombstone). Ca dữ liệu hiếm VERIFIED với userId null (import/backfill)
 *   sẽ không email được dù câu hứa có — chấp nhận, ghi ở đây làm dấu.
 */
export function moderateConsequences(target: ModerateTarget, approve: boolean): string[] {
  const copy = approve ? t.approveDialog.consequences : t.unapproveDialog.consequences;
  const rating = target.tourTitle ? copy.rating(target.tourTitle) : copy.noRating;

  if (!approve) {
    const hide = target.tourTitle
      ? t.unapproveDialog.consequences.hide
      : t.unapproveDialog.consequences.hideNoTour;
    return [hide, rating, t.unapproveDialog.consequences.noEmail];
  }

  const publish = target.tourTitle
    ? t.approveDialog.consequences.publish
    : t.approveDialog.consequences.publishNoTour;
  const email = target.authorDeleted
    ? t.approveDialog.consequences.noEmailDeleted
    : target.source === 'CURATED'
      ? t.approveDialog.consequences.noEmailCurated
      : t.approveDialog.consequences.email;

  return [publish, rating, email];
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
