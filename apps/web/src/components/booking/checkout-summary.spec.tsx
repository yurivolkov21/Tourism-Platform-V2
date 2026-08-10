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
    expect(screen.queryByText(/0 children/)).not.toBeInTheDocument();
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

  it('badge Free cancellation + Instant confirmation luôn hiển thị', () => {
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
    expect(screen.getByText('Free cancellation')).toBeInTheDocument();
    expect(screen.getByText('Instant confirmation')).toBeInTheDocument();
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
