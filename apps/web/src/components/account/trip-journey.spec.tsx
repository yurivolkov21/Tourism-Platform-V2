import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { JourneyView } from '@/lib/booking-journey';
import { TripJourney } from './trip-journey';

/**
 * Đơn sắp đi của bản vẽ: Today ở 41.25% vạch → 43% khung, giữa tâm mốc Paid (30%) và Free
 * cancellation (50%); vạch tô từ tâm mốc đầu (10%) tới đúng chỗ nhãn.
 */
const UPCOMING: JourneyView = {
  variant: 'standard',
  milestones: [
    { key: 'booked', label: 'Booked', detail: '13 Aug 2026', state: 'done' },
    { key: 'paid', label: 'Paid', detail: '14 Aug 2026', state: 'done' },
    {
      key: 'freeCancellation',
      label: 'Free cancellation',
      detail: 'Until Mon 2 Nov',
      state: 'now',
    },
    { key: 'departure', label: 'Departure', detail: 'Tue 3 Nov', state: 'next' },
    { key: 'tripEnds', label: 'Trip ends', detail: 'Tue 3 Nov', state: 'next' },
  ],
  today: { percent: 41.25, before: 2 },
  chip: { label: 'Departs in 29 days', tone: 'active' },
};

const TRAVELLED: JourneyView = {
  ...UPCOMING,
  milestones: UPCOMING.milestones.map((milestone) => ({ ...milestone, state: 'done' })),
  today: null,
  chip: { label: 'Completed', tone: 'done' },
};

const CANCELLED: JourneyView = {
  variant: 'cancelled',
  milestones: [
    { key: 'booked', label: 'Booked', detail: '14 Aug 2026', state: 'done' },
    { key: 'paid', label: 'Paid', detail: '15 Aug 2026', state: 'done' },
    { key: 'cancelled', label: 'Cancelled', detail: '21 Sep 2026', state: 'done' },
    { key: 'refund', label: 'Refund', detail: '$147.00', state: 'done' },
  ],
  today: null,
  chip: { label: 'Cancelled', tone: 'muted' },
};

/** Thứ tự các dòng trong danh sách: khoá mốc, hay `journey-today` cho dòng Today. */
const order = (container: HTMLElement) =>
  [...container.querySelectorAll('ol > li')].map(
    (li) => li.getAttribute('data-milestone') ?? li.getAttribute('data-slot'),
  );

describe('TripJourney', () => {
  it('tiêu đề h2 "Trip journey" và chip góc phải', () => {
    render(<TripJourney journey={UPCOMING} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Trip journey' })).toBeInTheDocument();
    expect(screen.getByText('Departs in 29 days')).toHaveAttribute('data-tone', 'active');
  });

  it('năm mốc theo thứ tự, mỗi mốc mang trạng thái; dòng Today chen giữa Paid và Free cancellation', () => {
    const { container } = render(<TripJourney journey={UPCOMING} />);
    expect(order(container)).toEqual([
      'booked',
      'paid',
      'journey-today',
      'freeCancellation',
      'departure',
      'tripEnds',
    ]);
    expect(
      [...container.querySelectorAll('li[data-milestone]')].map((li) =>
        li.getAttribute('data-state'),
      ),
    ).toEqual(['done', 'done', 'now', 'next', 'next']);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Until Mon 2 Nov')).toBeInTheDocument();
  });

  it('mốc đang tới mang `aria-current="step"`', () => {
    const { container } = render(<TripJourney journey={UPCOMING} />);
    expect(container.querySelector('[aria-current="step"]')).toHaveAttribute(
      'data-milestone',
      'freeCancellation',
    );
  });

  /**
   * Tâm nhãn ở 43% khung theo tỷ lệ ngày, nhưng kẹp cách tâm hai mốc bao quanh (30% và 50%) ít nhất
   * 48px — nửa icon 20px + nửa nhãn ~25px + khe thở. Kẹp theo px chứ không theo % đoạn: 20% đoạn
   * chỉ còn 23px ở 768px, nhãn đè icon 22px (review P7 B21). Vạch tô dừng ĐÚNG chỗ nhãn đứng.
   */
  it('Today ở 43% khung, kẹp ±48px quanh tâm hai mốc bao quanh; vạch tô từ 10% tới đúng nhãn', () => {
    const { container } = render(<TripJourney journey={UPCOMING} />);
    const today = container.querySelector<HTMLElement>('[data-slot="journey-today"]');
    const fill = container.querySelector<HTMLElement>('[data-slot="journey-fill"]');
    const at = 'clamp(calc(30% + 48px), 43%, calc(50% - 48px))';
    expect(today?.style.getPropertyValue('--today-x')).toBe(at);
    expect(fill?.style.left).toBe('10%');
    expect(fill?.style.getPropertyValue('--fill-w')).toBe(`calc(${at} - 10%)`);
  });

  it('Today ở đoạn cuối (ngày về): kẹp quanh tâm Departure (70%) và Trip ends (90%)', () => {
    const { container } = render(
      <TripJourney journey={{ ...UPCOMING, today: { percent: 100, before: 4 } }} />,
    );
    expect(
      container
        .querySelector<HTMLElement>('[data-slot="journey-today"]')
        ?.style.getPropertyValue('--today-x'),
    ).toBe('clamp(calc(70% + 48px), 90%, calc(90% - 48px))');
  });

  it('chuyến đã đi: không Today, vạch tô trọn (80% khung), chip tông "done"', () => {
    const { container } = render(<TripJourney journey={TRAVELLED} />);
    expect(container.querySelector('[data-slot="journey-today"]')).toBeNull();
    expect(
      container
        .querySelector<HTMLElement>('[data-slot="journey-fill"]')
        ?.style.getPropertyValue('--fill-w'),
    ).toBe('80%');
    expect(screen.getByText('Completed')).toHaveAttribute('data-tone', 'done');
  });

  it('biến thể huỷ bốn mốc: lưới bốn cột, vạch từ 12.5% rộng 75%', () => {
    const { container } = render(<TripJourney journey={CANCELLED} />);
    expect(container.querySelector('ol')).toHaveClass('md:grid-cols-4');
    const fill = container.querySelector<HTMLElement>('[data-slot="journey-fill"]');
    expect(fill?.style.left).toBe('12.5%');
    expect(fill?.style.getPropertyValue('--fill-w')).toBe('75%');
  });

  it('không có chip (giữ chỗ lỡ hạn) thì không vẽ chip', () => {
    const { container } = render(
      <TripJourney
        journey={{
          variant: 'lapsed',
          milestones: [
            { key: 'booked', label: 'Booked', detail: '20 Sep 2026', state: 'done' },
            {
              key: 'paymentNotCompleted',
              label: 'Payment not completed',
              detail: null,
              state: 'now',
            },
          ],
          today: null,
          chip: null,
        }}
      />,
    );
    expect(container.querySelector('[data-slot="journey-chip"]')).toBeNull();
    expect(container.querySelector('ol')).toHaveClass('md:grid-cols-2');
  });
});
