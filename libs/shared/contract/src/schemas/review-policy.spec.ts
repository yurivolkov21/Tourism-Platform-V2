import { describe, expect, it } from 'vitest';
import { canAuthorEdit, isEditLimitReached, REVIEW_REJECTION_LIMIT } from './review-policy.js';

/**
 * Luật này là CỔNG phía API và đồng thời quyết định giao diện phía web
 * (ADR-0032 §6). Hai đầu gọi cùng một hàm, nên test ở đây phủ cho cả hai —
 * và cái phải canh chặt nhất là ranh giới `approved`.
 */

describe('canAuthorEdit', () => {
  it('review ĐÃ DUYỆT không sửa được, dù chưa từng bị bác lần nào', () => {
    // Ranh giới an toàn, không phải tiện tay: sửa nội dung ĐANG hiển thị công
    // khai là mở đường tráo một bài tử tế đã duyệt thành spam.
    expect(canAuthorEdit({ moderationState: 'approved', rejectionCount: 0 })).toBe(false);
  });

  it('đang CHỜ duyệt thì sửa được — chưa đăng, chưa quyết, nên vô hại', () => {
    expect(canAuthorEdit({ moderationState: 'pending', rejectionCount: 0 })).toBe(true);
  });

  it('bị bác một lần vẫn còn đường viết lại', () => {
    expect(canAuthorEdit({ moderationState: 'rejected', rejectionCount: 1 })).toBe(true);
  });

  it('đủ số lần bác thì ĐÓNG — kể cả khi đang ở trạng thái chờ duyệt', () => {
    // Ca này có thật: bác hai lần rồi admin bấm Reopen. Trạng thái về
    // `pending` nhưng lịch sử vẫn là hai lần bác, và trần phải đếm lịch sử
    // chứ không đếm trạng thái hiện tại.
    expect(
      canAuthorEdit({ moderationState: 'rejected', rejectionCount: REVIEW_REJECTION_LIMIT }),
    ).toBe(false);
    expect(
      canAuthorEdit({ moderationState: 'pending', rejectionCount: REVIEW_REJECTION_LIMIT }),
    ).toBe(false);
  });

  it('vượt trần (dữ liệu cũ, hoặc trần bị hạ về sau) cũng đóng', () => {
    expect(
      canAuthorEdit({ moderationState: 'rejected', rejectionCount: REVIEW_REJECTION_LIMIT + 5 }),
    ).toBe(false);
  });
});

describe('isEditLimitReached', () => {
  it('phân biệt "hết lượt" với "đã duyệt" — hai câu khác hẳn nhau với khách', () => {
    // Gộp cả hai thành `canAuthorEdit === false` là buộc mỗi nơi hiển thị tự
    // suy lại lý do, và suy sai thì khách đọc một câu vô nghĩa ("bài của bạn
    // đang hiển thị rồi" cho một bài vừa bị bác).
    expect(
      isEditLimitReached({ moderationState: 'rejected', rejectionCount: REVIEW_REJECTION_LIMIT }),
    ).toBe(true);
    expect(isEditLimitReached({ moderationState: 'approved', rejectionCount: 0 })).toBe(false);
  });

  it('chưa hết lượt thì không phải "hết lượt"', () => {
    expect(isEditLimitReached({ moderationState: 'rejected', rejectionCount: 1 })).toBe(false);
    expect(isEditLimitReached({ moderationState: 'pending', rejectionCount: 0 })).toBe(false);
  });

  it('một review ĐÃ DUYỆT không bao giờ là "hết lượt", dù lịch sử bác dài', () => {
    // Bác hai lần rồi cuối cùng được duyệt là một câu chuyện TỐT — nói với họ
    // "chúng tôi đã xem hai lần" lúc bài đang hiển thị là nói lạc đề.
    expect(
      isEditLimitReached({ moderationState: 'approved', rejectionCount: REVIEW_REJECTION_LIMIT }),
    ).toBe(false);
  });
});

describe('REVIEW_REJECTION_LIMIT', () => {
  it('là 2 — số này nói được thành câu cho khách nghe', () => {
    // "Chúng tôi đã xem lại hai lần." Một lần thì quá gắt với một hiểu lầm;
    // ba lần thì đã là kiên nhẫn giả vờ.
    expect(REVIEW_REJECTION_LIMIT).toBe(2);
  });
});
