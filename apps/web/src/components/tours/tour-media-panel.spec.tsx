import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DepartureSelectionProvider } from '@/components/tours/departure-selection';
import type { DepartureVM, TourDetailVM } from '@/lib/api/tours';
import { TourMediaPanel } from './tour-media-panel';

// Mock next/navigation — khuôn giống user-menu.spec.tsx: `Reserve` điều hướng
// bằng `router.push()` thay vì `ButtonLink` (xem lý do trong component: nút
// này phải là role="button" thật, không phải anchor đội lốt).
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

/**
 * Departures CỐ ĐỊNH cho mọi test — component đọc đợt khởi hành qua
 * `useDepartureSelection()` (context), KHÔNG qua `tour.departures`, nên
 * `wrapper` bơm departures một lần, độc lập với `mediaCount` của từng test.
 * Đợt đầu CÒN CHỖ (`d1`, 6 ghế) sẽ là đợt được chọn sẵn — khớp giả định
 * `DepartureSelectionProvider` chọn đợt còn chỗ ĐẦU TIÊN.
 */
const DEPARTURES: DepartureVM[] = [
  {
    id: 'd1',
    startDate: '2026-09-14',
    endDate: '2026-09-17',
    seatsLeft: 6,
    effectivePrice: '329.00',
    compareAtPrice: null,
  },
  {
    id: 'd2',
    startDate: '2026-09-28',
    endDate: '2026-10-01',
    seatsLeft: 9,
    effectivePrice: '329.00',
    compareAtPrice: null,
  },
  {
    id: 'd3',
    startDate: '2026-10-12',
    endDate: '2026-10-15',
    seatsLeft: 3,
    effectivePrice: '349.00',
    compareAtPrice: null,
  },
];

function wrapper({ children }: { children: ReactNode }) {
  return (
    <DepartureSelectionProvider departures={DEPARTURES} currency="USD">
      {children}
    </DepartureSelectionProvider>
  );
}

/** Tour giả với đúng `mediaCount` ảnh, phần còn lại là dữ liệu hợp lệ tối
    thiểu. `departures: []` CỐ Ý — component không đọc field này, đọc qua
    context (xem `DEPARTURES` + `wrapper` ở trên); để rỗng để lộ ngay nếu
    implementation lỡ đọc nhầm `tour.departures`. */
function tourWith(mediaCount: number): TourDetailVM {
  return {
    id: 'tour-1',
    slug: 'ha-giang-loop-4d3n',
    title: 'Ha Giang Loop — 4 days 3 nights',
    summary: 'A scenic motorbike loop through karst mountains and terraced rice fields.',
    basePrice: '329.00',
    compareAtPrice: '379.00',
    currency: 'USD',
    durationDays: 4,
    difficulty: 'MODERATE',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [{ slug: 'ha-giang', name: 'Hà Giang', isPrimary: true }],
    category: { slug: 'adventure', name: 'Adventure' },
    ratingAvg: 4.8,
    ratingCount: 120,
    cover: null,
    suitableFor: [],
    badges: [],
    included: [],
    excluded: [],
    highlights: [],
    meetingPoint: null,
    itinerary: [],
    faqs: [],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 48h',
        body: 'Full refund up to 48h before departure.',
      },
      {
        kind: 'BOOKING',
        title: 'Pay a 20% deposit',
        body: 'Reserve your seat with a 20% deposit.',
      },
      {
        kind: 'GENERAL',
        title: 'Bring your own gear',
        body: 'A rain jacket and sturdy shoes are recommended.',
      },
    ],
    departures: [],
    media: Array.from({ length: mediaCount }, (_, i) => ({
      publicId: `p${i}`,
      url: `https://res.cloudinary.com/demo/image/upload/v1/tours/${i}.jpg`,
      type: 'IMAGE' as const,
      role: (i === 0 ? 'hero' : 'gallery') as 'hero' | 'gallery',
      posterUrl: null,
      width: 1600,
      height: 1067,
      alt: `Photo ${i}`,
      sortOrder: i,
      author: null,
      license: null,
      licenseUrl: null,
      sourceUrl: null,
    })),
  };
}

describe('TourMediaPanel — gallery', () => {
  it('hiện tối đa 7 thumb và gắn "+N" lên ô cuối khi còn ảnh ẩn', () => {
    render(<TourMediaPanel tour={tourWith(10)} />, { wrapper });
    expect(screen.getAllByRole('button', { name: /photo/i })).toHaveLength(7);
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('bấm ô "+N" mở lightbox tại đúng ảnh đang bị ẩn', async () => {
    const user = userEvent.setup();
    render(<TourMediaPanel tour={tourWith(10)} />, { wrapper });
    await user.click(screen.getByText('+3'));
    expect(screen.getByText('7 / 10')).toBeInTheDocument();
  });

  it('không có ảnh thì KHÔNG render khung gallery rỗng', () => {
    const { container } = render(<TourMediaPanel tour={tourWith(0)} />, { wrapper });
    expect(container.querySelector('[data-slot="tour-gallery"]')).toBeNull();
  });
});

describe('TourMediaPanel — panel đặt chỗ', () => {
  it('nút Reserve nói đúng số ghế của đợt đang chọn', () => {
    render(<TourMediaPanel tour={tourWith(3)} />, { wrapper });
    expect(screen.getByRole('button', { name: /Reserve — 6 seats left/ })).toBeInTheDocument();
  });
});
