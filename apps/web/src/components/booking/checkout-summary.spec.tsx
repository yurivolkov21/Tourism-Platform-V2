import { render, screen } from '@testing-library/react';
import type { MediaItem } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import type { DepartureVM } from '@/lib/api/tours';
import { CheckoutSummary, type CheckoutSummaryTour } from './checkout-summary';

function makeDeparture(over: Partial<DepartureVM> = {}): DepartureVM {
  return {
    id: 'e9000001-0000-4000-8000-000000000001',
    startDate: '2026-09-12',
    endDate: '2026-09-23',
    seatsLeft: 9,
    effectivePrice: '1290.00',
    compareAtPrice: null,
    bookingDeadline: '2026-09-05',
    bookable: true,
    ...over,
  } as DepartureVM;
}

function makeTour(over: Partial<CheckoutSummaryTour> = {}): CheckoutSummaryTour {
  return {
    title: 'Sapa Highlands Trek',
    cover: null,
    durationDays: 4,
    destinationNames: ['Sapa', 'Lao Cai'],
    ratingAvg: 4.8,
    ratingCount: 126,
    ...over,
  };
}

describe('CheckoutSummary — breakdown giá', () => {
  it('có departure + 2 adults 1 child → hai dòng breakdown đúng tiền + total đúng (trẻ em CÙNG đơn giá)', () => {
    render(
      <CheckoutSummary
        tour={makeTour()}
        departure={makeDeparture({ effectivePrice: '1290.00' })}
        numAdults={2}
        numChildren={1}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );

    // 2 người lớn × $1,290 = $2,580.
    expect(screen.getByText('$2,580')).toBeInTheDocument();
    // 1 trẻ em × $1,290 — CÙNG đơn giá người lớn, không phải giá riêng.
    expect(screen.getByText('$1,290')).toBeInTheDocument();
    // Total = (2 + 1) × $1,290 = $3,870.
    expect(screen.getByText('$3,870')).toBeInTheDocument();
  });

  it('numChildren: 0 → không render dòng children', () => {
    render(
      <CheckoutSummary
        tour={makeTour()}
        departure={makeDeparture()}
        numAdults={2}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(screen.queryByText(/child/)).not.toBeInTheDocument();
  });

  it('departure: null → hiện pickDeparture, không hiện total', () => {
    render(
      <CheckoutSummary
        tour={makeTour()}
        departure={null}
        numAdults={2}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(screen.getByText('Select a departure to see your total')).toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
  });

  it('durationDays: 1 → hiện "1 day" (không phải "1 days")', () => {
    render(
      <CheckoutSummary
        tour={makeTour({ durationDays: 1 })}
        departure={makeDeparture()}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(screen.getByText(/1 day/)).toBeInTheDocument();
  });

  it('ratingAvg: 4 → hiện "4.0" với .toFixed(1)', () => {
    render(
      <CheckoutSummary
        tour={makeTour({ ratingAvg: 4 })}
        departure={makeDeparture()}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(screen.getByText(/4\.0/)).toBeInTheDocument();
  });

  // Chip đổi lại thành "Free cancellation" 15/09 (ADR-0041): chip trung tính
  // "Flexible cancellation" tồn tại vì bảng bậc không giữ được lời hứa hoàn
  // 100%. Luật một hạn chót giữ được — mọi tour huỷ miễn phí tới ngày chót —
  // và ngày chót cụ thể in ngay dưới CTA.
  it('chip Free cancellation + Instant confirmation luôn hiển thị', () => {
    const { container } = render(
      <CheckoutSummary
        tour={makeTour()}
        departure={null}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(screen.getByText('Free cancellation')).toBeInTheDocument();
    expect(screen.queryByText('Flexible cancellation')).not.toBeInTheDocument();
    expect(screen.getByText('Instant confirmation')).toBeInTheDocument();
    // Markup chốt: Badge outline + chấm trạng thái nhỏ (KHÔNG còn pill nền
    // màu tự chế `bg-success/15`/`bg-info/10`) — chấm là tín hiệu màu duy
    // nhất, không nhuộm cả chữ.
    expect(container.querySelector('.bg-success.rounded-full')).toBeInTheDocument();
    expect(container.querySelector('.bg-info.rounded-full')).toBeInTheDocument();
    expect(container.querySelector('.bg-success\\/15')).not.toBeInTheDocument();
  });

  it('cover: null → không render <img> (không vỡ layout)', () => {
    const { container } = render(
      <CheckoutSummary
        tour={makeTour({ cover: null })}
        departure={makeDeparture()}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('cover có ảnh → render <img> với src + alt từ cover', () => {
    const cover: MediaItem = {
      publicId: 'tourism/sapa-cover',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tourism/sapa-cover',
      type: 'IMAGE',
      role: 'hero',
      posterUrl: null,
      width: 1600,
      height: 900,
      alt: 'Terraced rice fields at sunrise',
      sortOrder: 0,
      author: 'Vincent Guth',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sapa_rice_terraces.jpg',
    };
    const { container } = render(
      <CheckoutSummary
        tour={makeTour({ cover })}
        departure={makeDeparture()}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'Terraced rice fields at sunrise');
  });
});

/**
 * Dòng hạn chót dưới CTA. KHÔNG còn `vi.useFakeTimers()`: câu này in thẳng
 * `departure.bookingDeadline` do server tính (spec §2 Q7), nên chỉnh đồng hồ
 * máy — đúng thứ giáo viên hay thử lúc bảo vệ — không đổi được chữ nào.
 */
describe('CheckoutSummary — dòng hạn chót huỷ miễn phí dưới CTA', () => {
  it('departure: null → KHÔNG render dòng hạn chót nào', () => {
    render(
      <CheckoutSummary
        tour={makeTour()}
        departure={null}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(
      screen.queryByRole('link', { name: 'Read the cancellation policy' }),
    ).not.toBeInTheDocument();
  });

  it('in NGÀY CHÓT của đợt kèm giờ Việt Nam và link chính sách', () => {
    render(
      <CheckoutSummary
        tour={makeTour()}
        departure={makeDeparture({ bookingDeadline: '2026-10-17' })}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(
      screen.getByText(
        /Free cancellation until 17 Oct, 11:59 pm Vietnam time\. No refund after that\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the cancellation policy' })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );
  });

  it('không còn câu nào theo bậc phần trăm hay theo giờ máy khách', () => {
    render(
      <CheckoutSummary
        tour={makeTour()}
        departure={makeDeparture({ bookingDeadline: '2026-09-05' })}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(screen.queryByText(/refund available until/)).toBeNull();
    expect(screen.queryByText(/This departure is close/)).toBeNull();
  });
});
