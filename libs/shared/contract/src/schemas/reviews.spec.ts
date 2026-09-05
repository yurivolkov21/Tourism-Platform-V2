import { describe, expect, it } from 'vitest';
import { ModerateReviewInputSchema } from './reviews.js';

const ID = '11111111-1111-4111-8111-111111111111';

/**
 * ADR-0031 §7: bác là phán quyết chung cuộc, và nó phải có lý do vì lý do đi
 * thẳng vào email cho khách. Luật gác ở CONTRACT để không caller nào — dialog
 * admin hay bất kỳ ai cầm JWT admin — bác được mà không nói vì sao.
 */
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
});
