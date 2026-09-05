import type { ReviewModerationState, ReviewVerdict } from '@tourism/contract';
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
  | 'state'
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
 * - ③ recompute rating chỉ chạy khi review gắn tour; câu unpublish nói thẳng
 *   ca review-duy-nhất: rating tour BIẾN MẤT, không chỉ "tính lại".
 * - ④ email chỉ enqueue ở lần false→true, có user thật và tài khoản CHƯA xoá
 *   (server gate `!deletedAt` từ vòng vá F4 — không còn thư nào bay tới địa
 *   chỉ tombstone). Ca dữ liệu hiếm VERIFIED với userId null (import/backfill)
 *   sẽ không email được dù câu hứa có — chấp nhận, ghi ở đây làm dấu.
 */
export function moderateConsequences(target: ModerateTarget, verdict: ReviewVerdict): string[] {
  if (verdict === 'unpublish') {
    const c = t.unpublishDialog.consequences;
    const hide = target.tourTitle ? c.hide : c.hideNoTour;
    const rating = target.tourTitle ? c.rating(target.tourTitle) : c.noRating;
    return [hide, rating, c.noEmail];
  }

  if (verdict === 'reject') {
    const c = t.rejectDialog.consequences;
    // Câu ĐẦU là thứ phân biệt reject với unpublish — nó rời hàng đợi. Đặt
    // trước cả câu gỡ khỏi trang tour vì đó mới là điều người bấm cần cân
    // nhắc: gỡ thì đảo lại được, rời hàng đợi thì không có ai xem lại nữa.
    const lines: string[] = [c.queue, target.tourTitle ? c.hide : c.hideNoTour];
    // Rating chỉ đổi khi review ĐANG hiện — bác một review chưa từng duyệt
    // không đụng tới sao của tour nào.
    if (target.approved) lines.push(target.tourTitle ? c.rating(target.tourTitle) : c.noRating);
    lines.push(emailLine(target, c));
    return lines;
  }

  const c = t.approveDialog.consequences;
  const publish = target.tourTitle ? c.publish : c.publishNoTour;
  const rating = target.tourTitle ? c.rating(target.tourTitle) : c.noRating;
  return [publish, rating, emailLine(target, c)];
}

/**
 * Ba nhánh email dùng chung cho approve và reject: cả hai đều gửi thư, và cả
 * hai đều im lặng ở CÙNG hai ca — review CURATED (không có tài khoản nào sau
 * lưng) và tác giả đã tự xoá tài khoản (email đã tombstone hoá, gửi vào đó là
 * bounce vĩnh viễn + retry rác).
 */
function emailLine(
  target: ModerateTarget,
  copy: { email: string; noEmailCurated: string; noEmailDeleted: string },
): string {
  if (target.authorDeleted) return copy.noEmailDeleted;
  return target.source === 'CURATED' ? copy.noEmailCurated : copy.email;
}

/**
 * Kết quả server action moderate. Sống ở LIB (không phải trong component) vì
 * nó là hợp đồng vận chuyển giữa `actions.ts` (server) và dialog (client) —
 * tầng server không import từ tầng trình bày (review F2 31/08).
 *
 * Nhánh thành công trả TRẠNG THÁI cuối — đọc từ RESPONSE của server, không từ
 * input đã gửi. Từ ADR-0031 là ba trạng thái, nên một boolean `approved` không
 * còn diễn đủ: toast phải nói được cả "đã bác, và khách đã được báo". Tên tác
 * giả cho toast lấy từ chính hàng đang mở (cùng review id nên cùng tác giả),
 * không cần server nhắc lại; dữ liệu bảng thì `router.refresh()` kéo về,
 * client KHÔNG giữ bản sao trạng thái nào.
 */
export type ModerateActionResult =
  | { ok: true; state: ReviewModerationState }
  | { ok: false; code: ModerateFailureCode };

export type ModerateAction = (input: {
  id: string;
  verdict: ReviewVerdict;
  note?: string;
}) => Promise<ModerateActionResult>;
