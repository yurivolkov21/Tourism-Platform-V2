import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { reviewSlot } from './review';

const TODAY = '2026-08-04';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
});
afterEach(() => {
  vi.useRealTimers();
});

const done = { status: 'PAID' as const, departureEndDate: '2026-08-01' };

describe('reviewSlot — trang chi tiết booking hiện gì ở chỗ đánh giá', () => {
  it('đã viết rồi → "done", KHÔNG hiện form nữa', () => {
    // Trước cụm B, cách duy nhất để biết là POST rồi ăn 409 — tức khách gõ
    // xong cả bài mới được báo là không viết được.
    expect(reviewSlot(makeBooking({ ...done, reviewedAt: '2026-08-02T00:00:00.000Z' }))).toBe(
      'done',
    );
  });

  it('đủ điều kiện → "form"', () => {
    expect(reviewSlot(makeBooking({ ...done, reviewedAt: null }))).toBe('form');
  });

  it('chuyến kết thúc ĐÚNG HÔM NAY vẫn viết được — biên đóng', () => {
    // Mirror `checkReviewEligibility` phía API: `end > now` mới bị chặn.
    expect(reviewSlot(makeBooking({ status: 'PAID', departureEndDate: TODAY }))).toBe('form');
  });

  it('chuyến CHƯA kết thúc → "tooEarly", không phải ẩn hẳn', () => {
    // Ẩn hẳn thì khách tưởng site không có tính năng đánh giá.
    expect(reviewSlot(makeBooking({ status: 'PAID', departureEndDate: '2026-12-01' }))).toBe(
      'tooEarly',
    );
  });

  it('chưa trả tiền → "hidden": chưa đi thì chưa có gì để kể', () => {
    expect(reviewSlot(makeBooking({ status: 'PENDING', departureEndDate: '2026-08-01' }))).toBe(
      'hidden',
    );
  });

  it('đã huỷ hoặc đã hoàn tiền → "hidden"', () => {
    for (const status of ['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const) {
      expect(reviewSlot(makeBooking({ status, departureEndDate: '2026-08-01' }))).toBe('hidden');
    }
  });

  it('CHƯA trả tiền thắng CHƯA kết thúc — cùng thứ tự ưu tiên với API', () => {
    // API kiểm PAID trước ngày kết thúc; web phải nói cùng một câu, không thì
    // khách thấy "chưa tới lúc" rồi trả tiền xong lại thấy nút biến mất.
    expect(reviewSlot(makeBooking({ status: 'PENDING', departureEndDate: '2026-12-01' }))).toBe(
      'hidden',
    );
  });
});
