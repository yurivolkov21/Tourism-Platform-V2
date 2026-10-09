import { render, screen, within } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeBooking, makeCancellation, makeReview, makeTourData } from '@/test/fixtures/booking';
import { BookingDetailView } from './booking-detail-view';

/**
 * Cây tiêu đề của thân trang chi tiết đơn trên render THẬT — không mock khối con nào, chỉ mock hạ
 * tầng (router, API client, toast). Hero của trang (`page.tsx`) giữ h1 DUY NHẤT (spec P7 §5.2), mọi
 * khối trong thân trang mở bằng h2.
 *
 * Spec khung (`booking-detail-view.spec.tsx`) mock cả tám khối con thành `<div>`, nên phép đếm h1 ở
 * đó không thể đỏ: đổi số đếm ngược của Get ready hay "Day d of D" của Today's plan sang h1 vẫn xanh
 * (review P7 S3).
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/api/client', () => ({ api: {}, withBrowserAuth: () => ({}) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

// jsdom không có IntersectionObserver — mộc của vé vào bằng `RevealItem` (motion `whileInView`).
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
});

const TODAY = '2026-10-05';
const TOUR = makeTourData();
const at = (patch: Partial<BookingDetail>) => makeBooking({ code: 'BK-B6VCOQNW', ...patch });
const withCancel = (booking: BookingDetail, withinDeadline = true) => ({
  ...booking,
  cancellation: makeCancellation(booking, { withinDeadline }),
});
/** Chuyến một ngày 11/02 — đã đi từ lâu theo cả ngày VN lẫn ngày UTC. */
const FEB_TRIP = { departureStartDate: '2026-02-11', departureEndDate: '2026-02-11' };
const approved = makeReview({ isApproved: true, moderationState: 'approved' });

/** [ca, đơn, giờ máy (cổng review đọc ngày UTC), tiêu đề h2 của cột phải theo thứ tự]. */
const CASES: [string, BookingDetail, string, string[]][] = [
  [
    'chờ trả',
    at({
      status: 'PENDING',
      paidAt: null,
      departureStartDate: '2026-10-20',
      departureEndDate: '2026-10-22',
    }),
    '2026-10-05T03:00:00.000Z',
    ['Awaiting payment'],
  ],
  [
    'sắp đi',
    withCancel(at({ departureStartDate: '2026-11-03', departureEndDate: '2026-11-05' })),
    '2026-10-05T03:00:00.000Z',
    ['Get ready'],
  ],
  [
    'đang đi',
    withCancel(at({ departureStartDate: '2026-10-04', departureEndDate: '2026-10-06' }), false),
    '2026-10-05T03:00:00.000Z',
    ['Today’s plan'],
  ],
  [
    'ngày về sau 07:00 giờ VN: Today’s plan rồi khu review',
    withCancel(at({ departureStartDate: '2026-10-03', departureEndDate: '2026-10-05' }), false),
    '2026-10-05T13:00:00.000Z',
    ['Today’s plan', 'Your review'],
  ],
  ['đã đi, viết review', at(FEB_TRIP), '2026-10-05T03:00:00.000Z', ['Your review']],
  [
    'đã đi, không viết review được',
    at({ ...FEB_TRIP, status: 'PARTIALLY_REFUNDED', refundedTotal: '2.00' }),
    '2026-10-05T03:00:00.000Z',
    ['Thanks for travelling with us.'],
  ],
  [
    'đã huỷ có review: khối đóng rồi khu review',
    at({
      ...FEB_TRIP,
      status: 'REFUNDED',
      cancelledAt: '2026-02-20T02:00:00.000Z',
      refundedTotal: '10.00',
      review: approved,
      reviewedAt: approved.createdAt,
    }),
    '2026-10-05T03:00:00.000Z',
    ['Cancelled', 'Your review'],
  ],
  [
    'qua hạn chót mà chưa trả',
    at({
      status: 'PENDING',
      paidAt: null,
      departureStartDate: '2026-10-01',
      departureEndDate: '2026-10-03',
    }),
    '2026-10-05T03:00:00.000Z',
    ['Payment not completed'],
  ],
];

describe('BookingDetailView — cây tiêu đề trên render thật (review P7 S3)', () => {
  it.each(CASES)('%s: không có h1; mỗi khối cột phải mở bằng h2', (_, booking, now, panels) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(now));
    const { container } = render(<BookingDetailView booking={booking} tour={TOUR} today={TODAY} />);
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
    const column = container.querySelector<HTMLElement>('[data-slot="phase-panel"]');
    expect(column).not.toBeNull();
    expect(
      within(column as HTMLElement)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(panels);
  });
});
