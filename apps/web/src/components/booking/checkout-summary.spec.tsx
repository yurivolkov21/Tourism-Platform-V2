import { render, screen } from '@testing-library/react';
import type { MediaItem } from '@tourism/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DepartureVM } from '@/lib/api/tours';
import {
  CheckoutSummary,
  type CheckoutSummaryTour,
  computeCancellationAssurance,
} from './checkout-summary';

function makeDeparture(over: Partial<DepartureVM> = {}): DepartureVM {
  return {
    id: 'e9000001-0000-4000-8000-000000000001',
    startDate: '2026-09-12',
    endDate: '2026-09-23',
    seatsLeft: 9,
    effectivePrice: '1290.00',
    compareAtPrice: null,
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

  // Final review (Critical + §2.2): "Free cancellation" bị GỠ vì ngụ ý hoàn
  // 100% vô điều kiện — sai với chính sách thật. Chip trung tính thay thế,
  // "Instant confirmation" giữ nguyên vì đúng sự thật (booking PAID xác nhận
  // ngay).
  it('chip Flexible cancellation (trung tính) + Instant confirmation luôn hiển thị', () => {
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
    expect(screen.getByText('Flexible cancellation')).toBeInTheDocument();
    expect(screen.queryByText('Free cancellation')).not.toBeInTheDocument();
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

// Final review (Critical + §2.2): hàm THUẦN tính mốc trấn an hủy/hoàn tiền,
// đối chiếu đúng ba mốc thật của `legal/cancellation.ts` (30 ngày → hoàn đủ ·
// 15 ngày → hoàn 50% · dưới đó → xét duyệt tay, không hứa số).
describe('computeCancellationAssurance', () => {
  const START = '2026-09-30';

  it('hôm nay đúng 30 ngày trước departure → full, cutoff = start - 30d', () => {
    // 2026-08-31 → 2026-09-30 = đúng 30 ngày.
    const result = computeCancellationAssurance(START, new Date('2026-08-31T12:00:00.000Z'));
    expect(result).toEqual({ kind: 'full', percent: 100, cutoffDate: '2026-08-31' });
  });

  it('hôm nay 29 ngày trước departure (vừa lọt mốc) → partial 50%, cutoff = start - 15d', () => {
    // 2026-09-01 → 2026-09-30 = 29 ngày, dưới 30 nên rơi vào nhánh 50%.
    const result = computeCancellationAssurance(START, new Date('2026-09-01T12:00:00.000Z'));
    expect(result).toEqual({ kind: 'partial', percent: 50, cutoffDate: '2026-09-15' });
  });

  it('hôm nay đúng 15 ngày trước departure → partial 50% (biên dưới của khoảng 15–29)', () => {
    // 2026-09-15 → 2026-09-30 = đúng 15 ngày.
    const result = computeCancellationAssurance(START, new Date('2026-09-15T12:00:00.000Z'));
    expect(result).toEqual({ kind: 'partial', percent: 50, cutoffDate: '2026-09-15' });
  });

  it('NGÀY 14 nay có bậc riêng 25% — bản cũ đẩy nó vào closeWindow', () => {
    // Trước ADR-0030 hàm này hardcode 30/15 nên dải 7–14 hoàn toàn vô hình:
    // khách còn 14 ngày đọc "This departure is close" trong khi chính sách nói
    // rõ họ được hoàn 25%.
    const result = computeCancellationAssurance(START, new Date('2026-09-16T12:00:00.000Z'));
    expect(result).toEqual({ kind: 'partial', percent: 25, cutoffDate: '2026-09-23' });
  });

  it('hôm nay 6 ngày trước departure → closeWindow, KHÔNG cutoffDate', () => {
    // Bậc 0% mới thật sự là "không hứa gì" — nhánh này nay đúng nghĩa của nó.
    const result = computeCancellationAssurance(START, new Date('2026-09-24T12:00:00.000Z'));
    expect(result).toEqual({ kind: 'closeWindow', percent: 0, cutoffDate: null });
  });

  it('departure đã qua (diff âm) → vẫn closeWindow, không ném lỗi', () => {
    const result = computeCancellationAssurance(START, new Date('2026-10-05T12:00:00.000Z'));
    expect(result.kind).toBe('closeWindow');
  });
});

describe('CheckoutSummary — dòng trấn an hủy/hoàn tiền dưới CTA', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('departure: null → KHÔNG render dòng trấn an nào', () => {
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'));
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
    expect(screen.queryByRole('link', { name: 'cancellation policy' })).not.toBeInTheDocument();
  });

  it('≥30 ngày trước departure → "Full refund available until …" kèm link cancellation policy', () => {
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'));
    render(
      <CheckoutSummary
        tour={makeTour()}
        departure={makeDeparture({ startDate: '2026-09-30', endDate: '2026-10-05' })}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(screen.getByText(/Full refund available until 31 Aug 2026/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'cancellation policy' });
    expect(link).toHaveAttribute('href', '/cancellation-policy');
  });

  it('15–29 ngày trước departure → "50% refund available until …" kèm link', () => {
    vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
    render(
      <CheckoutSummary
        tour={makeTour()}
        departure={makeDeparture({ startDate: '2026-09-30', endDate: '2026-10-05' })}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(screen.getByText(/50% refund available until 15 Sep 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'cancellation policy' })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );
  });

  it('<15 ngày trước departure → "This departure is close…" kèm link, KHÔNG hứa số', () => {
    vi.setSystemTime(new Date('2026-09-25T12:00:00.000Z'));
    render(
      <CheckoutSummary
        tour={makeTour()}
        departure={makeDeparture({ startDate: '2026-09-30', endDate: '2026-10-05' })}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(screen.getByText(/This departure is close/)).toBeInTheDocument();
    expect(screen.getByText(/before booking\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'cancellation policy' })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );
  });
});
