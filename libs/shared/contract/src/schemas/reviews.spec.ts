import { describe, expect, it } from 'vitest';
import {
  ModerateReviewInputSchema,
  REVIEW_MODERATION_NOTE_MAX,
  ReviewPhotoPublicIdSchema,
} from './reviews.js';

const ID = '11111111-1111-4111-8111-111111111111';

/**
 * ADR-0031 §7: bác là phán quyết chung cuộc, và nó phải có lý do vì lý do đi
 * thẳng vào email cho khách. Luật gác ở CONTRACT để không caller nào — dialog
 * admin hay bất kỳ ai cầm JWT admin — bác được mà không nói vì sao.
 */
/**
 * ADR-0035: publicId ảnh review là đối số của một lệnh destroy không hoàn
 * tác (7 ngày sau khi tác giả gỡ), nên cổng ký tự nằm ở contract.
 */
describe('ReviewPhotoPublicIdSchema', () => {
  it('nhận đúng dạng Cloudinary tự sinh: folder/…/uuid, có dấu chấm và gạch', () => {
    for (const ok of [
      'tourism/reviews/BK-1/0f9a1c2e-1234-4abc-8def-0123456789ab',
      'tourism/avatars/u_1/a.b',
      'a',
    ]) {
      expect(ReviewPhotoPublicIdSchema.safeParse(ok).success, ok).toBe(true);
    }
  });

  it('chặn `..`, dấu cách, ký tự lạ, và đầu/cuối bằng dấu phân cách', () => {
    for (const bad of [
      'tourism/reviews/BK-1/../avatars/u/x',
      'tourism/reviews/BK 1/x',
      'tourism/reviews/BK-1/x?y',
      '/tourism/reviews/x',
      'tourism/reviews/x/',
      'a//b',
      'a..b',
      '',
    ]) {
      expect(ReviewPhotoPublicIdSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe('ModerateReviewInputSchema', () => {
  it('reject KHÔNG có note → từ chối, lỗi trỏ vào `note`', () => {
    const res = ModerateReviewInputSchema.safeParse({ id: ID, verdict: 'reject' });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0]?.path).toEqual(['note']);
  });

  it('reject với note toàn khoảng trắng cũng bị từ chối (trim trước khi xét)', () => {
    expect(
      ModerateReviewInputSchema.safeParse({ id: ID, verdict: 'reject', note: '   ' }).success,
    ).toBe(false);
  });

  it('reject có note → qua; approve/unpublish không cần note', () => {
    expect(
      ModerateReviewInputSchema.safeParse({ id: ID, verdict: 'reject', note: 'Spam.' }).success,
    ).toBe(true);
    expect(ModerateReviewInputSchema.safeParse({ id: ID, verdict: 'approve' }).success).toBe(true);
    expect(ModerateReviewInputSchema.safeParse({ id: ID, verdict: 'unpublish' }).success).toBe(
      true,
    );
  });

  it('trần note là REVIEW_MODERATION_NOTE_MAX — khớp cột `review_moderation_events.note` VARCHAR(500)', () => {
    // Admin dùng hằng này để tính phần còn lại cho ô chi tiết sau câu lý do chuẩn
    // (ADR-0031 AMEND 1): lệch với schema là admin cho gõ một thứ server từ chối.
    expect(REVIEW_MODERATION_NOTE_MAX).toBe(500);
    const at = (length: number) =>
      ModerateReviewInputSchema.safeParse({ id: ID, verdict: 'reject', note: 'x'.repeat(length) })
        .success;
    expect(at(REVIEW_MODERATION_NOTE_MAX)).toBe(true);
    expect(at(REVIEW_MODERATION_NOTE_MAX + 1)).toBe(false);
  });
});
