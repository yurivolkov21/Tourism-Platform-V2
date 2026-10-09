import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getReadySteps } from '@/lib/get-ready';
import { makeBooking, makeCancellation, makeTourData } from '@/test/fixtures/booking';
import { GetReadyPanel } from './get-ready-panel';

const TODAY = '2026-10-05';

const TRIP = makeBooking({
  code: 'BK-B6VCOQNW',
  tourSlug: 'hanoi-heritage-day',
  tourDestinations: [{ slug: 'ha-noi', name: 'Hà Nội', isPrimary: true }],
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
  cancellationDeadline: '2026-10-31',
});
const BOOKING = { ...TRIP, cancellation: makeCancellation(TRIP) };

const DAY_ONE = [
  '08:00 — Hotel pickup',
  '08:30 — Ba Đình Square',
  '09:15 — One Pillar Pagoda',
].join('\n');

const TOUR = makeTourData({
  itinerary: [{ dayNumber: 1, title: 'Ba Đình to the Old Quarter', description: DAY_ONE }],
});

function renderPanel(today = TODAY) {
  return render(
    <GetReadyPanel view={getReadySteps(BOOKING, TOUR, today)} bookingCode={BOOKING.code} />,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('GetReadyPanel', () => {
  it('đầu khối: h2 "Get ready", số ngày cỡ lớn, dòng Departs', () => {
    renderPanel();
    expect(screen.getByRole('heading', { level: 2, name: 'Get ready' })).toBeInTheDocument();
    expect(screen.getByText('29')).toBeInTheDocument();
    expect(screen.getByText('days to go')).toBeInTheDocument();
    expect(screen.getByText('Departs Tue 3 Nov 2026 · Hà Nội')).toBeInTheDocument();
  });

  it('còn một ngày: "Tomorrow" thay cho con số', () => {
    renderPanel('2026-11-02');
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    expect(screen.queryByText('days to go')).toBeNull();
  });

  it('bốn bước theo thứ tự, số 01–04; bước hạn huỷ còn hạn được làm nổi', () => {
    const { container } = renderPanel();
    const items = [...container.querySelectorAll('li[data-step]')];
    expect(items.map((li) => li.getAttribute('data-step'))).toEqual([
      'freeCancellation',
      'budget',
      'pickup',
      'dayOne',
    ]);
    expect(items.map((li) => li.querySelector('[data-slot="step-number"]')?.textContent)).toEqual([
      '01',
      '02',
      '03',
      '04',
    ]);
    expect(items[0]).toHaveAttribute('data-open');
    // Chỉ bước hạn huỷ còn hạn được nổi — các bước khác không mang cờ.
    for (const li of items.slice(1)) expect(li).not.toHaveAttribute('data-open');
    expect(
      screen.getByText(
        'Free cancellation until 31 Oct, 11:59 pm Vietnam time. No refund after that.',
      ),
    ).toBeInTheDocument();
  });

  /**
   * Cờ server nói đã qua hạn huỷ (`withinDeadline: false` — đơn sắp đi nằm giữa hạn chót và ngày
   * đi, trạng thái thường gặp): bước hạn huỷ KHÔNG được làm nổi — việc ấy khách không còn làm được.
   * Ca này giết đột biến bỏ `&& step.open` mà fixture còn hạn duy nhất ở trên để sống (review P7 B23).
   */
  it('đã qua hạn huỷ: bước hạn huỷ vẫn có nhưng không được làm nổi', () => {
    const late = { ...TRIP, cancellation: makeCancellation(TRIP, { withinDeadline: false }) };
    const { container } = render(
      <GetReadyPanel view={getReadySteps(late, TOUR, '2026-11-01')} bookingCode={late.code} />,
    );
    const step = container.querySelector('li[data-step="freeCancellation"]');
    expect(step).not.toBeNull();
    expect(step).not.toHaveAttribute('data-open');
    expect(
      screen.getByText('The free-cancellation deadline (31 Oct) has passed.'),
    ).toBeInTheDocument();
  });

  it('bước Budget: một ô tích cho từng mục, kèm câu "saved on this device"', () => {
    renderPanel();
    expect(screen.getByText('Budget for what’s not included')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Lunch (own arrangement)' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Tips' })).toBeInTheDocument();
    expect(screen.getByText('Tick them off — saved on this device.')).toBeInTheDocument();
  });

  it('bước Pickup in nguyên văn điểm hẹn', () => {
    renderPanel();
    expect(screen.getByText('Pickup on Tue 3 Nov')).toBeInTheDocument();
    expect(screen.getByText('Hotel pickup — Hoàn Kiếm, Ba Đình or Tây Hồ')).toBeInTheDocument();
  });

  it('bước Day 1: mô tả in nguyên văn giữ xuống dòng, cắt 4 dòng; link Full itinerary', () => {
    const { container } = renderPanel();
    const text = container.querySelector('[data-step="dayOne"] [data-slot="day-text"]');
    expect(text?.textContent).toBe(DAY_ONE);
    expect(text).toHaveClass('whitespace-pre-line', 'line-clamp-4');
    expect(screen.getByRole('link', { name: 'Full itinerary →' })).toHaveAttribute(
      'href',
      '/tours/hanoi-heritage-day#itinerary',
    );
  });

  it('chân khối nói ngày mở review', () => {
    renderPanel();
    expect(screen.getByText('Your review opens on Thu 5 Nov.')).toBeInTheDocument();
  });

  it('đơn không viết review được (hoàn một phần): không có chân khối', () => {
    const partial = { ...BOOKING, status: 'PARTIALLY_REFUNDED' as const, refundedTotal: '20.00' };
    render(<GetReadyPanel view={getReadySteps(partial, TOUR, TODAY)} bookingCode={partial.code} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Get ready' })).toBeInTheDocument();
    expect(screen.queryByText(/Your review opens/)).toBeNull();
  });
});
