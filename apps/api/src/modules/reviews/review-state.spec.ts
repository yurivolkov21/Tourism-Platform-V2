import { describe, expect, it } from 'vitest';
import { NOT_REJECTED, REVIEW_STATE_WHERE, reviewModerationState } from './review-state.js';

/**
 * Logic THUẦN của trạng thái review (ADR-0031 §1 + ADR-0032 AMEND 1) — test
 * không cần DB, và đây là chỗ duy nhất phép suy "ba cột → bốn trạng thái"
 * tồn tại.
 */

describe('reviewModerationState', () => {
  it('đang đăng → approved', () => {
    expect(reviewModerationState({ isApproved: true, rejectedAt: null, retractedAt: null })).toBe(
      'approved',
    );
  });

  it('chưa đăng, CHƯA có phán quyết → pending', () => {
    expect(reviewModerationState({ isApproved: false, rejectedAt: null, retractedAt: null })).toBe(
      'pending',
    );
  });

  it('chưa đăng, ĐÃ bị bác → rejected (không phải pending)', () => {
    // Cả lý do ADR-0031 tồn tại: trước đó hai ca này trông giống hệt nhau, nên
    // hàng đợi moderation không bao giờ dọn sạch được.
    expect(
      reviewModerationState({ isApproved: false, rejectedAt: new Date(), retractedAt: null }),
    ).toBe('rejected');
  });

  it('W4 U2: tác giả đã RÚT → retracted, thắng mọi trục khác', () => {
    // retract() set isApproved=false, nhưng luật khai tường minh: một row dị
    // dạng nào đó vẫn phải đọc ra "retracted" chứ không lẻn thành pending.
    expect(
      reviewModerationState({ isApproved: false, rejectedAt: null, retractedAt: new Date() }),
    ).toBe('retracted');
    expect(
      reviewModerationState({ isApproved: true, rejectedAt: null, retractedAt: new Date() }),
    ).toBe('retracted');
  });

  it('trục ĐĂNG thắng khi cả hai cột phán quyết cùng có giá trị — dù DB không cho ca ấy tồn tại', () => {
    // `reviews_verdict_shape` chặn ở tầng DB. Hàm vẫn phải trả một giá trị
    // xác định thay vì rơi vào nhánh ngầm: một `undefined` lọt lên UI sẽ hiện
    // ra dưới dạng badge trống, không phải một lỗi ai đó nhìn thấy.
    expect(
      reviewModerationState({ isApproved: true, rejectedAt: new Date(), retractedAt: null }),
    ).toBe('approved');
  });
});

describe('REVIEW_STATE_WHERE', () => {
  it('pending đòi CẢ BA cột — "chưa có phán quyết và chưa rút", không phải "chưa đăng"', () => {
    // Thiếu `rejectedAt: null` là hàng đợi nuốt lại review đã bác; thiếu
    // `retractedAt: null` (W4 U2) là nuốt cả review tác giả đã rút — người
    // duyệt đọc một bài không còn được phép duyệt.
    expect(REVIEW_STATE_WHERE.pending).toEqual({
      isApproved: false,
      rejectedAt: null,
      retractedAt: null,
    });
  });

  it('approved chỉ hỏi trục ĐĂNG — approve đã xoá `rejected_at` nên không cần hỏi lại', () => {
    expect(REVIEW_STATE_WHERE.approved).toEqual({ isApproved: true });
  });

  it('rejected hỏi trục PHÁN QUYẾT, kèm `isApproved: false` để khớp prefix index', () => {
    // CHECK `reviews_verdict_shape` đã bảo đảm bị bác ⇒ không đăng, nhưng
    // planner không suy được — thiếu vế này tab Rejected seq scan (vòng vá 05/09).
    expect(REVIEW_STATE_WHERE.rejected).toEqual({ isApproved: false, rejectedAt: { not: null } });
  });

  it('W4 U2: retracted hỏi đúng trục Ý CHÍ TÁC GIẢ', () => {
    expect(REVIEW_STATE_WHERE.retracted).toEqual({ retractedAt: { not: null } });
  });

  it('bốn mệnh đề KHÔNG chồng lấn nhau — mỗi review rơi vào đúng một tab', () => {
    // Bảng lọc theo bốn tab phải chia trọn tập, không thì một review hiện ở
    // hai chỗ hoặc biến mất khỏi cả bốn.
    const rows = [
      { isApproved: true, rejectedAt: null, retractedAt: null },
      { isApproved: false, rejectedAt: null, retractedAt: null },
      { isApproved: false, rejectedAt: new Date(), retractedAt: null },
      { isApproved: false, rejectedAt: null, retractedAt: new Date() },
    ];
    const states = rows.map(reviewModerationState);

    expect(new Set(states).size).toBe(rows.length);
  });
});

describe('NOT_REJECTED', () => {
  it('chỉ loại review ĐÃ BỊ BÁC, KHÔNG loại review đang chờ duyệt', () => {
    // Khác hẳn lọc theo `isApproved`: một review đang chờ vẫn là ý kiến thật
    // của khách, chỉ là chưa ai kịp đọc — lọc nó ra sẽ làm hàng đợi tồn đọng
    // tự bóp méo điểm trung bình.
    // Vòng vá review W4 (chính sách A): review tác giả đã rút cũng rời phép đo ý kiến.
    expect(NOT_REJECTED).toEqual({ rejectedAt: null, retractedAt: null });
    expect(NOT_REJECTED).not.toHaveProperty('isApproved');
  });
});
