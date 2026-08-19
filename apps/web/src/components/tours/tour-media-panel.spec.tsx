import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DepartureSelectionProvider } from '@/components/tours/departure-selection';
import type { DepartureVM, TourDetailVM } from '@/lib/api/tours';
import { GALLERY_THUMB_SLOTS } from '@/lib/tour-detail';
import { TourMediaPanel } from './tour-media-panel';

// `next/navigation`: nút Reserve điều hướng bằng `router.push()`, còn
// `WishlistProvider` (bọc nút Wishlist) đọc thêm `usePathname`/`useSearchParams`.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/tours/ha-giang-loop-4d',
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * Departures cố định cho mọi test. Đợt đầu CÒN CHỖ (`d1`) là đợt được chọn sẵn —
 * khớp giả định của `DepartureSelectionProvider` (chọn đợt còn chỗ ĐẦU TIÊN).
 * Ba đợt có ba mức giá khác nhau để bắt được lỗi "giá đứng yên".
 */
const DEPARTURES: DepartureVM[] = [
  {
    id: 'd1',
    startDate: '2026-09-14',
    endDate: '2026-09-17',
    seatsLeft: 6,
    effectivePrice: '329.00',
    compareAtPrice: '369.00',
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
] as unknown as DepartureVM[];

function wrapper({ children }: { children: ReactNode }) {
  return (
    <DepartureSelectionProvider departures={DEPARTURES}>{children}</DepartureSelectionProvider>
  );
}

function tourWith(mediaCount: number, overrides: Partial<TourDetailVM> = {}): TourDetailVM {
  return {
    id: 'tour-1',
    slug: 'ha-giang-loop-4d',
    title: 'Hà Giang Loop by Easyrider 4D3N',
    summary: 'Four days riding pillion behind a local easyrider.',
    basePrice: '329.00',
    compareAtPrice: '369.00',
    currency: 'USD',
    durationDays: 4,
    maxGroupSize: 10,
    ratingAvg: 4.4,
    ratingCount: 5,
    category: { slug: 'trekking', name: 'Trekking & Adventure' },
    destinations: [{ slug: 'ha-giang', name: 'Hà Giang', isPrimary: true }],
    policies: [
      { kind: 'CANCELLATION', title: 'Cancellation', body: 'Free up to 24 hours.' },
      { kind: 'BOOKING', title: 'Booking & payment', body: 'A 30% deposit.' },
      { kind: 'GENERAL', title: 'Good to know', body: 'Long sleeves.' },
    ],
    departures: DEPARTURES,
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
    ...overrides,
  } as unknown as TourDetailVM;
}

describe('TourMediaPanel — gallery', () => {
  it('tối đa 7 thumb, ô cuối mang "+N" khi còn ảnh ẩn', () => {
    render(<TourMediaPanel tour={tourWith(10)} />, { wrapper });
    expect(screen.getAllByRole('button', { name: /photo \d+ of/i })).toHaveLength(
      GALLERY_THUMB_SLOTS,
    );
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('bấm ô "+N" mở lightbox tại đúng ảnh đang bị ẩn', async () => {
    const user = userEvent.setup();
    render(<TourMediaPanel tour={tourWith(10)} />, { wrapper });
    await user.click(screen.getByText('+3'));
    expect(screen.getByText('7 / 10')).toBeInTheDocument();
  });

  it('chưa có ảnh thì GIỮ khối gallery, lấp bằng placeholder', () => {
    // Chính sách static-first của repo: chưa tới bước tải ảnh thì dùng
    // placeholder, KHÔNG bỏ khối đi — bỏ là bố cục hai cột của bản duyệt biến
    // mất và panel đặt chỗ trôi sang cột trái.
    const { container } = render(<TourMediaPanel tour={tourWith(0)} />, { wrapper });
    expect(container.querySelectorAll('[data-slot="thumb-placeholder"]')).toHaveLength(
      GALLERY_THUMB_SLOTS,
    );
  });

  it('bấm placeholder VẪN mở lightbox — tương tác của bản duyệt không mất', async () => {
    // User chỉ đúng chỗ này: bản trước tắt hẳn lightbox khi chưa có ảnh, nên
    // bấm vào ô ảnh không có gì xảy ra.
    const user = userEvent.setup();
    render(<TourMediaPanel tour={tourWith(0)} />, { wrapper });
    await user.click(screen.getByRole('button', { name: /open gallery/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('chưa có ảnh thì KHÔNG in nhãn "N photos" — đó là bịa số ảnh không có', () => {
    render(<TourMediaPanel tour={tourWith(0)} />, { wrapper });
    expect(screen.queryByText(/\d+ photos?$/)).toBeNull();
  });
});

describe('TourMediaPanel — panel đặt chỗ', () => {
  it('giá đi theo ĐỢT ĐANG CHỌN, không đứng yên ở basePrice', async () => {
    // Mỗi đợt có `effectivePrice` riêng (`priceOverride ?? basePrice`) — đó là
    // giá khách thật sự trả. `BookingRail` đã đúng từ đầu; panel phải nói cùng
    // con số với nó và với nhãn trên nút Reserve.
    const user = userEvent.setup();
    render(<TourMediaPanel tour={tourWith(3)} />, { wrapper });
    expect(screen.getByText('$329')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /12 Oct/ }));
    expect(screen.getByText('$349')).toBeInTheDocument();
    expect(screen.queryByText('$329')).toBeNull();
  });

  it('badge giảm giá tính theo compareAtPrice của CHÍNH đợt đó', async () => {
    const user = userEvent.setup();
    render(<TourMediaPanel tour={tourWith(3)} />, { wrapper });
    expect(screen.getByText('10% OFF')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /12 Oct/ }));
    expect(screen.queryByText(/% OFF/)).toBeNull();
  });

  it('nút Reserve nói đúng số ghế của đợt đang chọn', async () => {
    const user = userEvent.setup();
    render(<TourMediaPanel tour={tourWith(3)} />, { wrapper });
    expect(screen.getByRole('button', { name: /Reserve — 6 seats left/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /12 Oct/ }));
    expect(screen.getByRole('button', { name: /Reserve — 3 seats left/ })).toBeInTheDocument();
  });

  it('ô ngày: tối đa 4, ngày dạng "14 Sep", ghế ≤3 đổi màu cảnh báo', () => {
    render(<TourMediaPanel tour={tourWith(3)} />, { wrapper });
    expect(screen.getByText('14 Sep')).toBeInTheDocument();
    expect(screen.getByText('12 Oct')).toBeInTheDocument();
    expect(screen.getByText('3 seats left')).toHaveClass('text-warning');
  });

  it('ba thẻ điều khoản sinh từ policies và trỏ sang tab Good to know', () => {
    render(<TourMediaPanel tour={tourWith(3)} />, { wrapper });
    const card = screen.getByRole('link', { name: 'Cancellation' });
    expect(card).toHaveAttribute('href', '#good-to-know');
    expect(screen.getAllByRole('link', { name: /Cancellation|Booking|Good to know/ })).toHaveLength(
      3,
    );
  });

  /** Đích đổi 19/08: `/contact` → `/tours/{slug}/enquire`. Form liên hệ chung
   *  không biết khách đang hỏi tour nào; route mới là form hỏi báo giá của
   *  CHÍNH tour đó, và nó công khai nên khách chưa đăng nhập vẫn gửi được. */
  it('tour không còn đợt nào: CTA hỏi trỏ /enquire của tour đó, không có nút Reserve cụt', () => {
    render(
      <DepartureSelectionProvider departures={[]}>
        <TourMediaPanel tour={tourWith(0, { departures: [] } as Partial<TourDetailVM>)} />
      </DepartureSelectionProvider>,
    );
    expect(screen.queryByRole('button', { name: /Reserve/ })).toBeNull();
    expect(screen.getByRole('link', { name: /ask about this trip/i })).toHaveAttribute(
      'href',
      '/tours/ha-giang-loop-4d/enquire',
    );
  });
});

// 19/08: trang tour từng có HAI `<h1>` (hero + panel) — panel chỉ lặp tiêu đề
// bằng mắt, không được là heading cấp một thứ hai.
describe('TourMediaPanel — không phải <h1> thứ hai', () => {
  it('tiêu đề trong panel KHÔNG phải heading (hero đã giữ <h1>)', () => {
    render(<TourMediaPanel tour={tourWith(10)} />, { wrapper });
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
});
