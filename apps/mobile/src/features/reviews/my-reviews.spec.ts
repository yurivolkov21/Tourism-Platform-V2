import { PageQuerySchema } from '@tourism/contract';
import {
  MY_REVIEWS_INPUT,
  type MyReviewModerationState,
  myReviewNextStep,
  myReviewTone,
} from './my-reviews';

describe('myReviewNextStep', () => {
  it('đã đăng → rút', () => {
    expect(myReviewNextStep({ moderationState: 'approved', rejectionCount: 0 })).toBe('retract');
  });

  it('bị bác lần đầu (còn lượt) → viết lại', () => {
    expect(myReviewNextStep({ moderationState: 'rejected', rejectionCount: 1 })).toBe('rewrite');
  });

  it('bị bác hai lần (hết lượt) → giải thích', () => {
    expect(myReviewNextStep({ moderationState: 'rejected', rejectionCount: 2 })).toBe('exhausted');
  });

  it('chờ duyệt và đã rút → không có nút', () => {
    expect(myReviewNextStep({ moderationState: 'pending', rejectionCount: 0 })).toBe('none');
    expect(myReviewNextStep({ moderationState: 'retracted', rejectionCount: 0 })).toBe('none');
  });
});

describe('myReviewTone', () => {
  it.each<[MyReviewModerationState, string]>([
    ['approved', 'success'],
    ['pending', 'warning'],
    ['rejected', 'destructive'],
    ['retracted', 'muted'],
  ])('%s → %s', (state, tone) => {
    expect(myReviewTone(state)).toBe(tone);
  });
});

describe('MY_REVIEWS_INPUT', () => {
  it('chỉ dùng khoá có trong PageQuerySchema (Zod bỏ khoá lạ → mặc định 20 bài)', () => {
    for (const key of Object.keys(MY_REVIEWS_INPUT)) {
      expect(Object.keys(PageQuerySchema.shape)).toContain(key);
    }
  });

  it('qua schema vẫn giữ nguyên 100 bài/trang, không rơi về mặc định 20', () => {
    expect(PageQuerySchema.parse(MY_REVIEWS_INPUT).pageSize).toBe(100);
  });
});
