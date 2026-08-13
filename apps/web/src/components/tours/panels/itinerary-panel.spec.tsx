import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { DepartureSelectionProvider } from '@/components/tours/departure-selection';
import type { DepartureVM, TourDetailVM } from '@/lib/api/tours';
import { ItineraryPanel } from './itinerary-panel';

const DEPARTURES = [
  {
    id: 'd1',
    startDate: '2026-09-14',
    endDate: '2026-09-17',
    seatsLeft: 6,
    effectivePrice: '329.00',
    compareAtPrice: null,
  },
] as unknown as DepartureVM[];

const TOUR = {
  durationDays: 4,
  meetingPoint: 'Hotel pickup, Hà Giang city',
  included: ['Fuel and helmet', 'Support vehicle for luggage'],
  excluded: ['Travel insurance'],
  itinerary: [
    {
      dayNumber: 1,
      title: 'Hà Giang city to the Đồng Văn plateau',
      description: '07:30 — Gear check\n12:30 — **Lunch** in **Yên Minh**\n18:30 — Dinner',
    },
    { dayNumber: 2, title: 'Lũng Cú and the pass', description: '07:00 — Ride out' },
    { dayNumber: 3, title: 'Back over the plateau', description: '07:30 — Head south' },
    { dayNumber: 4, title: 'Buffer morning', description: '11:00 — Drop-off' },
  ],
} as unknown as TourDetailVM;

function wrap(ui: ReactNode, departures: DepartureVM[] = DEPARTURES) {
  return render(
    <DepartureSelectionProvider departures={departures}>{ui}</DepartureSelectionProvider>,
  );
}

const AUG = new Date('2026-08-13T00:00:00Z');

describe('ItineraryPanel', () => {
  it('ngày mỗi mục = ngày khởi hành + (N-1) của đợt đang chọn', () => {
    wrap(<ItineraryPanel tour={TOUR} live={false} today={AUG} />);
    expect(screen.getByText('Mon 14 Sep')).toBeInTheDocument();
    expect(screen.getByText('Thu 17 Sep')).toBeInTheDocument();
  });

  it('khách CHƯA đặt: không tick, không Today, node hiện SỐ NGÀY', () => {
    // Trang tour là trang công khai và đợt khách chọn thường ở tương lai. Làm mờ
    // cả 4 ngày của một chuyến chưa đi khiến trang trông như hỏng.
    wrap(<ItineraryPanel tour={TOUR} live={false} today={new Date('2026-09-15T00:00:00Z')} />);
    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.queryByText('Done')).toBeNull();
    expect(screen.getByText('01')).toBeInTheDocument();
  });

  it('đã đặt và đang trong chuyến: ngày qua = Done, hôm nay = Today', () => {
    wrap(<ItineraryPanel tour={TOUR} live today={new Date('2026-09-15T00:00:00Z')} />);
    expect(screen.getAllByText('Done')).toHaveLength(1);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('mô tả render markdown: **đậm** thành <strong>, KHÔNG in ra dấu sao', () => {
    wrap(<ItineraryPanel tour={TOUR} live={false} today={AUG} />);
    expect(screen.getByText('Yên Minh').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it('mốc giờ nằm cột riêng, tách khỏi phần việc', () => {
    wrap(<ItineraryPanel tour={TOUR} live={false} today={AUG} />);
    expect(screen.getByText('07:30')).toBeInTheDocument();
    expect(screen.getByText(/Gear check/)).toBeInTheDocument();
  });

  it('dòng tóm tắt đếm đúng số mốc và khoảng giờ đầu–cuối', () => {
    wrap(<ItineraryPanel tour={TOUR} live={false} today={AUG} />);
    expect(screen.getByText('Day 1 · 3 stops · 07:30–18:30')).toBeInTheDocument();
  });

  it('ngày ĐANG MỞ vẫn đóng lại được khi bấm', async () => {
    // Nếu state chỉ ghi "những ngày đang mở", ngày tự xổ không nằm trong đó nên
    // bấm vào chẳng thay đổi gì — nút bấm chết mà không báo lỗi.
    const user = userEvent.setup();
    wrap(<ItineraryPanel tour={TOUR} live={false} today={AUG} />);
    const toggle = screen.getAllByRole('button', { expanded: true })[0];
    expect(toggle).toBeDefined();
    if (!toggle) return;
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('07:30')).toBeNull();
  });

  it('không có đợt nào thì vẫn render lịch trình, chỉ là không có ngày cụ thể', () => {
    wrap(<ItineraryPanel tour={TOUR} live={false} today={AUG} />, []);
    expect(screen.getByText('Buffer morning')).toBeInTheDocument();
    expect(screen.queryByText(/14 Sep/)).toBeNull();
  });

  it('điểm hẹn và dòng meta nằm trên cùng, included/excluded ở cuối', () => {
    wrap(<ItineraryPanel tour={TOUR} live={false} today={AUG} />);
    expect(screen.getByText('Hotel pickup, Hà Giang city')).toBeInTheDocument();
    expect(screen.getByText(/Departing Mon 14 Sep · 4 days, 3 nights/)).toBeInTheDocument();
    expect(screen.getByText('Fuel and helmet')).toBeInTheDocument();
    expect(screen.getByText('Travel insurance')).toBeInTheDocument();
  });

  it('tour không có meetingPoint thì bỏ hẳn khối đó', () => {
    wrap(
      <ItineraryPanel
        tour={{ ...TOUR, meetingPoint: null } as unknown as TourDetailVM}
        live={false}
        today={AUG}
      />,
    );
    expect(screen.queryByText(/Hotel pickup/)).toBeNull();
  });
});
