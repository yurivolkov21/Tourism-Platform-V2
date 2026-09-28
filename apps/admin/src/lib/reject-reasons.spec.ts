import { REVIEW_MODERATION_NOTE_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  composeRejectNote,
  filterRejectReasons,
  REJECT_DETAIL_MAX,
  REJECT_REASONS,
  rejectFormProblem,
} from './reject-reasons';

/**
 * Lý do bác chọn từ danh sách cố định (ADR-0031 AMEND 1): câu chuẩn KHOÁ nên hai
 * admin bác cùng một lỗi thì khách đọc cùng một câu; chi tiết là tuỳ chọn, trừ
 * mục "Other" — câu chuẩn của nó không tự nói được gì.
 */
const copy = messages.admin.reviews.moderate.rejectReasons;

const reason = (key: string) => {
  const found = REJECT_REASONS.find((entry) => entry.key === key);
  if (!found) throw new Error(`Không có lý do ${key}`);
  return found;
};

describe('REJECT_REASONS', () => {
  it('phủ ĐÚNG mọi mục có câu chữ ở i18n — không mục mồ côi ở bên nào, "Other" đứng cuối', () => {
    expect(REJECT_REASONS.map((entry) => entry.key).sort()).toEqual(Object.keys(copy).sort());
    expect(REJECT_REASONS.at(-1)?.key).toBe('other');
  });

  it('chỉ "Other" bắt buộc chi tiết', () => {
    expect(
      REJECT_REASONS.filter((entry) => entry.detailRequired).map((entry) => entry.key),
    ).toEqual(['other']);
  });

  it('câu khách đọc chỉ nói VÌ SAO — không hứa sửa hay gửi lại (lần bác thứ hai khách không sửa được)', () => {
    for (const entry of REJECT_REASONS) {
      expect(entry.text, entry.key).toMatch(/\.$/);
      expect(entry.text, entry.key).not.toMatch(
        /\b(edit|resubmit|send it (again|back)|try again)\b/i,
      );
    }
  });
});

describe('REJECT_DETAIL_MAX', () => {
  it('ghép với câu nào cũng vừa trần note của contract — đổi lý do sau khi gõ không bao giờ vượt', () => {
    for (const entry of REJECT_REASONS) {
      expect(
        composeRejectNote(entry, 'x'.repeat(REJECT_DETAIL_MAX)).length,
        entry.key,
      ).toBeLessThanOrEqual(REVIEW_MODERATION_NOTE_MAX);
    }
  });

  it('không siết thừa: đúng câu DÀI NHẤT ghép với chi tiết tối đa là chạm trần', () => {
    const longest = Math.max(...REJECT_REASONS.map((entry) => entry.text.length));
    expect(REJECT_DETAIL_MAX).toBe(REVIEW_MODERATION_NOTE_MAX - longest - 1);
  });
});

describe('composeRejectNote', () => {
  it('câu chuẩn nguyên văn, chi tiết đã trim theo sau một dấu cách', () => {
    const entry = reason('peopleInPhotos');
    expect(composeRejectNote(entry, '  The second photo.  ')).toBe(
      `${entry.text} The second photo.`,
    );
  });

  it('chi tiết trống → chỉ câu chuẩn, không dấu cách thừa', () => {
    const entry = reason('offensive');
    expect(composeRejectNote(entry, '   ')).toBe(entry.text);
  });
});

describe('filterRejectReasons', () => {
  it('ô tìm trống → đủ danh sách, giữ thứ tự', () => {
    expect(filterRejectReasons(REJECT_REASONS, '  ')).toEqual(REJECT_REASONS);
  });

  it('tìm theo cả tên lẫn câu khách đọc, không phân biệt hoa thường', () => {
    expect(filterRejectReasons(REJECT_REASONS, 'REFUND').map((entry) => entry.key)).toEqual([
      'bookingIssue',
    ]);
    // "phone" chỉ có trong câu khách đọc, không có trong tên.
    expect(filterRejectReasons(REJECT_REASONS, 'phone').map((entry) => entry.key)).toEqual([
      'personalDetails',
    ]);
  });

  it('nhiều từ: mục phải chứa ĐỦ mọi từ, thứ tự từ không quan trọng', () => {
    expect(filterRejectReasons(REJECT_REASONS, 'photos other').map((entry) => entry.key)).toEqual([
      'peopleInPhotos',
    ]);
  });

  it('không mục nào khớp → mảng rỗng', () => {
    expect(filterRejectReasons(REJECT_REASONS, 'zzz')).toEqual([]);
  });
});

describe('rejectFormProblem', () => {
  it('chưa chọn lý do → "reason"', () => {
    expect(rejectFormProblem(null, 'anything')).toBe('reason');
  });

  it('"Other" mà chi tiết trống (kể cả toàn khoảng trắng) → "detail"', () => {
    expect(rejectFormProblem(reason('other'), '  ')).toBe('detail');
  });

  it('lý do thường không cần chi tiết; "Other" có chi tiết thì đủ', () => {
    expect(rejectFormProblem(reason('copied'), '')).toBeNull();
    expect(rejectFormProblem(reason('other'), 'Written in another language.')).toBeNull();
  });
});
