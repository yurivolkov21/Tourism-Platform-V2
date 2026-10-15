import { BookingsListQuerySchema, PageQuerySchema } from '@tourism/contract';
import {
  AWAITING_REVIEW_BOOKINGS_INPUT,
  type AwaitingReviewTripInput,
  MY_REVIEWS_INPUT,
  type MyReviewModerationState,
  myReviewNextStep,
  myReviewTone,
  tripsAwaitingReview,
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

describe('tripsAwaitingReview — khối "chờ viết bài" đầu R4', () => {
  // Cổng API so theo ngày UTC (cùng `canWriteReview`): 17/10 00:00 UTC là 07:00 giờ Việt Nam.
  const NOW = new Date('2026-10-17T00:00:00.000Z');

  function trip(
    code: string,
    over: Partial<AwaitingReviewTripInput> = {},
  ): AwaitingReviewTripInput {
    return {
      code,
      status: 'PAID',
      departureCancelled: false,
      departureEndDate: '2026-10-10',
      ...over,
    };
  }

  it('chuyến PAID đã về mà chưa có bài → mời viết, chuyến về gần nhất đứng đầu', () => {
    const result = tripsAwaitingReview(
      [
        trip('OLD', { departureEndDate: '2026-09-01' }),
        trip('TODAY', { departureEndDate: '2026-10-17' }),
      ],
      [],
      NOW,
    );

    expect(result.map((item) => item.code)).toEqual(['TODAY', 'OLD']);
  });

  it('đơn đã có bài ở My reviews, ở trạng thái nào cũng vậy → không mời lần hai', () => {
    const result = tripsAwaitingReview(
      [trip('REVIEWED'), trip('OPEN')],
      [{ bookingCode: 'REVIEWED' }, { bookingCode: null }],
      NOW,
    );

    expect(result.map((item) => item.code)).toEqual(['OPEN']);
  });

  it('cùng cổng với hoá đơn: chưa về theo ngày UTC, công ty huỷ chuyến, đơn không PAID → không mời', () => {
    const result = tripsAwaitingReview(
      [
        trip('NOT_BACK', { departureEndDate: '2026-10-18' }),
        trip('OPERATOR_CANCELLED', { departureCancelled: true }),
        trip('PART_REFUNDED', { status: 'PARTIALLY_REFUNDED' }),
      ],
      [],
      NOW,
    );

    expect(result).toEqual([]);
  });
});

describe('AWAITING_REVIEW_BOOKINGS_INPUT', () => {
  it('qua schema giữ nguyên mọi bộ lọc (Zod bỏ khoá lạ, sai một chữ là mất bộ lọc)', () => {
    expect(BookingsListQuerySchema.parse(AWAITING_REVIEW_BOOKINGS_INPUT)).toEqual(
      AWAITING_REVIEW_BOOKINGS_INPUT,
    );
  });
});
