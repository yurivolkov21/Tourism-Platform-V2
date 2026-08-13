import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DepartureSelectionProvider } from '@/components/tours/departure-selection';
import type { TourDetailVM } from '@/lib/api/tours';
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
] as unknown as TourDetailVM['departures'];

const TOUR = {
  durationDays: 4,
  meetingPoint: 'Hotel pickup, Hà Giang city',
  departures: DEPARTURES,
  included: ['Fuel and helmet'],
  excluded: ['Travel insurance'],
  itinerary: [
    {
      dayNumber: 1,
      title: 'Hà Giang city to the Đồng Văn plateau',
      description: '07:30 — Gear check\n12:30 — **Lunch** in **Yên Minh**',
    },
    { dayNumber: 2, title: 'Lũng Cú and the pass', description: '07:00 — Ride out' },
    { dayNumber: 3, title: 'Back over the plateau', description: '07:30 — Head south' },
    { dayNumber: 4, title: 'Buffer morning', description: '11:00 — Drop-off' },
  ],
} as unknown as TourDetailVM;

function wrap(ui: React.ReactNode) {
  return render(
    <DepartureSelectionProvider departures={DEPARTURES}>{ui}</DepartureSelectionProvider>,
  );
}

describe('ItineraryPanel', () => {
  it('ngày mỗi mục = ngày khởi hành + (N-1) của đợt đang chọn', () => {
    wrap(<ItineraryPanel tour={TOUR} live={false} today={new Date('2026-08-13T00:00:00Z')} />);
    expect(screen.getByText(/14 Sep/)).toBeInTheDocument();
    expect(screen.getByText(/17 Sep/)).toBeInTheDocument();
  });

  it('khách CHƯA đặt: không tick, không Today — node hiện số ngày', () => {
    // Trang tour là trang công khai, đợt khách chọn thường ở tương lai. Làm mờ
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
    wrap(<ItineraryPanel tour={TOUR} live={false} today={new Date('2026-08-13T00:00:00Z')} />);
    expect(screen.getByText('Yên Minh').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it('mốc giờ nằm ở cột riêng, tách khỏi phần việc', () => {
    wrap(<ItineraryPanel tour={TOUR} live={false} today={new Date('2026-08-13T00:00:00Z')} />);
    expect(screen.getByText('07:30')).toBeInTheDocument();
    expect(screen.getByText(/Gear check/)).toBeInTheDocument();
  });

  it('không có đợt nào thì vẫn render lịch trình, chỉ là không có ngày cụ thể', () => {
    render(
      <DepartureSelectionProvider departures={[]}>
        <ItineraryPanel
          tour={{ ...TOUR, departures: [] } as unknown as TourDetailVM}
          live={false}
          today={new Date('2026-08-13T00:00:00Z')}
        />
      </DepartureSelectionProvider>,
    );
    expect(screen.getByText('Buffer morning')).toBeInTheDocument();
    expect(screen.queryByText(/14 Sep/)).toBeNull();
  });

  it('mục TỰ XỔ vẫn đóng lại được khi bấm', async () => {
    // Nếu state chỉ ghi "những ngày đang mở", ngày tự xổ không nằm trong đó nên
    // bấm vào chẳng thay đổi gì — nút bấm chết mà không báo lỗi.
    wrap(<ItineraryPanel tour={TOUR} live={false} today={new Date('2026-08-13T00:00:00Z')} />);
    const toggle = screen.getAllByRole('button', { expanded: true })[0];
    expect(toggle).toBeDefined();
    if (!toggle) return;
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('07:30')).toBeNull();
  });

  it('hiện included và excluded ở cuối', () => {
    wrap(<ItineraryPanel tour={TOUR} live={false} today={new Date('2026-08-13T00:00:00Z')} />);
    expect(screen.getByText('Fuel and helmet')).toBeInTheDocument();
    expect(screen.getByText('Travel insurance')).toBeInTheDocument();
  });
});
