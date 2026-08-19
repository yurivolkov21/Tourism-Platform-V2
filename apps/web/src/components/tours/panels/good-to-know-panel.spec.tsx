import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { TourDetailVM } from '@/lib/api/tours';
import { GoodToKnowPanel } from './good-to-know-panel';

// jsdom không có IntersectionObserver — panel nay bọc `RevealItem` (motion
// `whileInView`, nhóm motion 1 — 19/08). Stub CỤC BỘ theo quy ước đã ghi ở
// `reveal-item.spec.tsx`/`gallery.spec.tsx`: dời lên vitest.setup.ts là gãy
// test ở file khác.
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

const TOUR = {
  policies: [
    { kind: 'GENERAL', title: 'Good to know', body: 'Long sleeves and closed shoes are required.' },
    { kind: 'CANCELLATION', title: 'Cancellation', body: 'Free up to 10 days before departure.' },
    { kind: 'BOOKING', title: 'Booking & payment', body: 'A 30% deposit secures your driver.' },
  ],
  faqs: [
    { question: 'Do I need to know how to ride a motorbike?', answer: 'No — you ride pillion.' },
    { question: 'How physically demanding is the loop?', answer: 'Long days, cool nights.' },
  ],
} as unknown as TourDetailVM;

describe('GoodToKnowPanel', () => {
  it('ba thẻ policy xếp Cancellation → Booking → General bất kể API trả thứ tự nào', () => {
    render(<GoodToKnowPanel tour={TOUR} />);
    // Hỏi trong phạm vi thẻ policy: `AccordionTrigger` của Base UI cũng bọc
    // câu hỏi trong <h3>, nên `getAllByRole('heading')` gom cả FAQ vào.
    const titles = screen
      .getAllByTestId('policy-card')
      .map((card) => within(card).getByRole('heading', { level: 3 }).textContent);
    expect(titles).toEqual(['Cancellation', 'Booking & payment', 'Good to know']);
  });

  it('nhãn nhóm TRÙNG tiêu đề thì bỏ nhãn, không in cùng một chuỗi hai lần', () => {
    render(<GoodToKnowPanel tour={TOUR} />);
    // Fixture đặt title "Cancellation" cho kind CANCELLATION.
    expect(screen.getAllByText('Cancellation')).toHaveLength(1);
  });

  it('nhãn nhóm KHÁC tiêu đề thì giữ cả hai', () => {
    render(<GoodToKnowPanel tour={TOUR} />);
    const card = screen
      .getAllByTestId('policy-card')
      .find((c) => within(c).queryByRole('heading', { name: 'Good to know' }));
    expect(card && within(card).getByText('General')).toBeInTheDocument();
  });

  it('mỗi câu hỏi là một nút xổ, câu đầu mở sẵn', () => {
    render(<GoodToKnowPanel tour={TOUR} />);
    const first = screen.getByRole('button', { name: /ride a motorbike/ });
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /physically demanding/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('bấm một câu đang đóng thì mở ra đúng câu trả lời của nó', async () => {
    const user = userEvent.setup();
    render(<GoodToKnowPanel tour={TOUR} />);
    await user.click(screen.getByRole('button', { name: /physically demanding/ }));
    expect(await screen.findByText('Long days, cool nights.')).toBeVisible();
  });

  it('câu đang mở vẫn đóng lại được', async () => {
    const user = userEvent.setup();
    render(<GoodToKnowPanel tour={TOUR} />);
    const first = screen.getByRole('button', { name: /ride a motorbike/ });
    await user.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  it('tour không có policy thì bỏ hẳn hàng thẻ, KHÔNG để lưới rỗng', () => {
    render(<GoodToKnowPanel tour={{ ...TOUR, policies: [] } as unknown as TourDetailVM} />);
    expect(screen.queryByTestId('policy-card')).toBeNull();
    expect(screen.getByRole('button', { name: /ride a motorbike/ })).toBeInTheDocument();
  });

  it('tour không có FAQ thì bỏ hẳn khối hỏi–đáp, kể cả dòng tiêu đề', () => {
    render(<GoodToKnowPanel tour={{ ...TOUR, faqs: [] } as unknown as TourDetailVM} />);
    expect(screen.queryByText('Questions travellers ask')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('mọi câu hỏi dùng CHUNG một icon — không có field nào phân loại câu hỏi', () => {
    const { container } = render(<GoodToKnowPanel tour={TOUR} />);
    const icons = [...container.querySelectorAll('button svg.size-4')];
    expect(icons).toHaveLength(2);
    expect(icons[0]?.getAttribute('class')).toBe(icons[1]?.getAttribute('class'));
  });
});
