import { describe, expect, it } from 'vitest';
import { NOT_REJECTED, REVIEW_STATE_WHERE, reviewModerationState } from './review-state.js';

/**
 * Logic THUẦN của trạng thái review (ADR-0031 §1) — test không cần DB, và đây
 * là chỗ duy nhất phép suy "hai cột → ba trạng thái" tồn tại.
 */

describe('reviewModerationState', () => {
  it('đang đăng → approved', () => {
    expect(reviewModerationState({ isApproved: true, rejectedAt: null })).toBe('approved');
  });

  it('chưa đăng, CHƯA có phán quyết → pending', () => {
    expect(reviewModerationState({ isApproved: false, rejectedAt: null })).toBe('pending');
  });

  it('chưa đăng, ĐÃ bị bác → rejected (không phải pending)', () => {
    // Cả lý do ADR-0031 tồn tại: trước đó hai ca này trông giống hệt nhau, nên
    // hàng đợi moderation không bao giờ dọn sạch được.
    expect(reviewModerationState({ isApproved: false, rejectedAt: new Date() })).toBe('rejected');
  });

  it('trục ĐĂNG thắng khi cả hai cột cùng có giá trị — dù DB không cho ca ấy tồn tại', () => {
    // `reviews_verdict_shape` chặn ở tầng DB. Hàm vẫn phải trả một giá trị
    // xác định thay vì rơi vào nhánh ngầm: một `undefined` lọt lên UI sẽ hiện
    // ra dưới dạng badge trống, không phải một lỗi ai đó nhìn thấy.
    expect(reviewModerationState({ isApproved: true, rejectedAt: new Date() })).toBe('approved');
  });
});

describe('REVIEW_STATE_WHERE', () => {
  it('pending đòi CẢ HAI cột — "chưa có phán quyết", không phải "chưa đăng"', () => {
    // Thiếu `rejectedAt: null` là hàng đợi nuốt lại review đã bác, tức con số
    // trên card Pending chỉ có thể phình ra.
    expect(REVIEW_STATE_WHERE.pending).toEqual({ isApproved: false, rejectedAt: null });
  });

  it('approved chỉ hỏi trục ĐĂNG — approve đã xoá `rejected_at` nên không cần hỏi lại', () => {
    expect(REVIEW_STATE_WHERE.approved).toEqual({ isApproved: true });
  });

  it('rejected chỉ hỏi trục PHÁN QUYẾT', () => {
    expect(REVIEW_STATE_WHERE.rejected).toEqual({ rejectedAt: { not: null } });
  });

  it('ba mệnh đề KHÔNG chồng lấn nhau — mỗi review rơi vào đúng một tab', () => {
    // Bảng lọc theo ba tab phải chia trọn tập, không thì một review hiện ở
    // hai chỗ hoặc biến mất khỏi cả ba.
    const rows = [
      { isApproved: true, rejectedAt: null },
      { isApproved: false, rejectedAt: null },
      { isApproved: false, rejectedAt: new Date() },
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
    expect(NOT_REJECTED).toEqual({ rejectedAt: null });
    expect(NOT_REJECTED).not.toHaveProperty('isApproved');
  });
});
