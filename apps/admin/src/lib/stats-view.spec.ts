import type {
  AdminBookingsStats,
  AdminCancellationsStats,
  AdminReviewsStats,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  type StatCardVM,
  toBookingsStatCards,
  toCancellationsStatCards,
  toReviewsStatCards,
} from './stats-view';

/**
 * TDD suite (spec P4b §3-F5, viết TRƯỚC) cho mapper hiển thị stat card. Đây
 * là toàn bộ phần "tính" của client: chọn chiều mũi tên, độ lớn %, và hướng
 * TỐT/XẤU. Cửa sổ thời gian thì KHÔNG — hai con số đã do server trả.
 */

const t = messages.admin.stats;

const period = {
  windowDays: 28,
  currentFrom: '2026-08-04T10:30:00.000Z',
  previousFrom: '2026-07-07T10:30:00.000Z',
  generatedAt: '2026-09-01T10:30:00.000Z',
};

const BOOKINGS: AdminBookingsStats = {
  period,
  currency: 'USD',
  revenue: { current: '1240.50', previous: '900.00' },
  paidBookings: { current: 12, previous: 9 },
  newBookings: { current: 20, previous: 20 },
  cancellationRate: { current: '8.3', previous: '5.0' },
};

const CANCELLATIONS: AdminCancellationsStats = {
  period,
  pendingQueue: { current: 5, previous: 2 },
  approved: { current: 4, previous: 8 },
  denied: { current: 1, previous: 0 },
};

const REVIEWS: AdminReviewsStats = {
  period,
  pending: { current: 3, previous: 7 },
  approved: { current: 9, previous: 4 },
  averageRating: { current: '4.60', previous: '4.20' },
};

/** Lấy một card theo khoá — test đọc theo tên chứ không theo vị trí mảng. */
function card(cards: StatCardVM[], key: string): StatCardVM {
  const found = cards.find((c) => c.key === key);
  if (!found) throw new Error(`no stat card "${key}" in [${cards.map((c) => c.key).join(', ')}]`);
  return found;
}

describe('toBookingsStatCards', () => {
  it('in tiền theo ĐÚNG đồng tiền server nói đã cộng — client không đoán', () => {
    expect(card(toBookingsStatCards(BOOKINGS), 'revenue').value).toBe('$1,240.50');
  });

  it('caption là con số KỲ TRƯỚC, định dạng cùng kiểu với số lớn', () => {
    expect(card(toBookingsStatCards(BOOKINGS), 'revenue').caption).toBe(
      t.comparison('$900.00', 28),
    );
  });

  it('pill delta mang ĐỘ LỚN phần trăm, chiều nằm ở mũi tên', () => {
    // 12 so với 9 → +33.3%. Con số % là suy ra từ HAI số server trả, không
    // phải từ một cửa sổ thời gian client tự cắt.
    const paid = card(toBookingsStatCards(BOOKINGS), 'paid');
    expect(paid.delta).toEqual({
      direction: 'up',
      percent: '33.3%',
      srLabel: t.trend.up('33.3%'),
    });
    expect(paid.deltaGood).toBe(true);
  });

  it('không đổi → chiều "flat", vẫn có pill để nói rõ là đứng yên', () => {
    const created = card(toBookingsStatCards(BOOKINGS), 'created');
    expect(created.delta?.direction).toBe('flat');
    expect(created.delta?.srLabel).toBe(t.trend.flat);
  });

  it('tỉ lệ huỷ TĂNG là XẤU — hướng tốt/xấu là thuộc tính của metric', () => {
    const rate = card(toBookingsStatCards(BOOKINGS), 'cancellationRate');
    expect(rate.value).toBe('8.3%');
    expect(rate.delta?.direction).toBe('up');
    expect(rate.deltaGood).toBe(false);
  });

  it('đếm lớn có dấu phân cách hàng nghìn', () => {
    const cards = toBookingsStatCards({
      ...BOOKINGS,
      paidBookings: { current: 12_400, previous: 9 },
    });
    expect(card(cards, 'paid').value).toBe('12,400');
  });

  it('kỳ trước bằng 0: KHÔNG có pill — phần trăm thay đổi không tồn tại', () => {
    // Caption vẫn nói "vs 0 prior 28 days", nên thông tin không mất; cái bị
    // từ chối là một con số % chia cho 0.
    const cards = toBookingsStatCards({
      ...BOOKINGS,
      paidBookings: { current: 12, previous: 0 },
    });
    const paid = card(cards, 'paid');
    expect(paid.delta).toBeUndefined();
    expect(paid.caption).toBe(t.comparison('0', 28));
  });

  it('metric không tính được: giá trị là "—" và không có pill', () => {
    const cards = toBookingsStatCards({
      ...BOOKINGS,
      cancellationRate: { current: null, previous: '5.0' },
    });
    const rate = card(cards, 'cancellationRate');
    expect(rate.value).toBe(t.noValue);
    expect(rate.delta).toBeUndefined();
  });

  it('kỳ trước không tính được: có số kỳ này nhưng vẫn KHÔNG so sánh được', () => {
    const cards = toBookingsStatCards({
      ...BOOKINGS,
      cancellationRate: { current: '8.3', previous: null },
    });
    const rate = card(cards, 'cancellationRate');
    expect(rate.value).toBe('8.3%');
    expect(rate.delta).toBeUndefined();
    expect(rate.caption).toBe(t.comparison(t.noValue, 28));
  });

  it('bốn card theo đúng thứ tự spec §3-F5', () => {
    expect(toBookingsStatCards(BOOKINGS).map((c) => c.key)).toEqual([
      'revenue',
      'paid',
      'created',
      'cancellationRate',
    ]);
  });
});

describe('toCancellationsStatCards', () => {
  it('hàng đợi là ẢNH CHỤP nên caption nói "N days ago", không phải "prior N days"', () => {
    const queue = card(toCancellationsStatCards(CANCELLATIONS), 'pendingQueue');
    expect(queue.caption).toBe(t.snapshotComparison('2', 28));
  });

  it('hàng đợi PHÌNH ra là xấu', () => {
    const queue = card(toCancellationsStatCards(CANCELLATIONS), 'pendingQueue');
    expect(queue.delta?.direction).toBe('up');
    expect(queue.deltaGood).toBe(false);
  });

  it('approved/denied là thông lượng — không tô tốt/xấu', () => {
    const cards = toCancellationsStatCards(CANCELLATIONS);
    // Duyệt nhiều hơn = làm việc nhiều hơn NHƯNG cũng là tiền đi ra; từ chối
    // nhiều hơn cũng vậy. Tô màu một chiều là đặt lời phán quyết vào chỗ
    // không có phán quyết nào.
    expect(card(cards, 'approved').deltaGood).toBeUndefined();
    expect(card(cards, 'denied').deltaGood).toBeUndefined();
  });

  it('nhãn approved/denied mang số ngày của server, không viết cứng 28', () => {
    const cards = toCancellationsStatCards({
      ...CANCELLATIONS,
      period: { ...period, windowDays: 7 },
    });
    expect(card(cards, 'approved').label).toBe(t.cancellations.approved(7));
  });

  it('ba card theo đúng thứ tự spec §3-F5', () => {
    expect(toCancellationsStatCards(CANCELLATIONS).map((c) => c.key)).toEqual([
      'pendingQueue',
      'approved',
      'denied',
    ]);
  });
});

describe('toReviewsStatCards', () => {
  it('hàng đợi moderation VƠI đi là tốt', () => {
    const pending = card(toReviewsStatCards(REVIEWS), 'pending');
    expect(pending.delta?.direction).toBe('down');
    expect(pending.deltaGood).toBe(true);
    expect(pending.caption).toBe(t.snapshotComparison('7', 28));
  });

  it('điểm trung bình in hai chữ số thập phân, tăng là tốt', () => {
    const rating = card(toReviewsStatCards(REVIEWS), 'averageRating');
    expect(rating.value).toBe('4.60');
    expect(rating.deltaGood).toBe(true);
    expect(rating.caption).toBe(t.comparison('4.20', 28));
  });

  it('kỳ không có review nào: "—" chứ không phải 0 sao', () => {
    const cards = toReviewsStatCards({
      ...REVIEWS,
      averageRating: { current: null, previous: null },
    });
    const rating = card(cards, 'averageRating');
    expect(rating.value).toBe(t.noValue);
    expect(rating.caption).toBe(t.comparison(t.noValue, 28));
  });

  it('ba card theo đúng thứ tự spec §3-F5', () => {
    expect(toReviewsStatCards(REVIEWS).map((c) => c.key)).toEqual([
      'pending',
      'approved',
      'averageRating',
    ]);
  });
});
