import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { TourDetailVM } from '@/lib/api/tours';
import { GoodToKnowPanel } from './good-to-know-panel';

const TOUR = {
  policies: [
    {
      kind: 'CANCELLATION',
      title: 'Cancellation',
      body: 'Free cancellation up to 24 hours before pickup.',
    },
    {
      kind: 'BOOKING',
      title: 'A 30% deposit secures your seat',
      body: 'The remainder is due before pickup on the day of the tour.',
    },
  ],
  faqs: [
    { question: 'Do I need to know how to ride a motorbike?', answer: 'No — you ride pillion.' },
    { question: 'How physically demanding is the loop?', answer: 'Moderate. Four days on a bike.' },
    { question: "What's the accommodation like?", answer: 'Homestays with shared bathrooms.' },
  ],
} as unknown as TourDetailVM;

describe('GoodToKnowPanel', () => {
  it('mỗi FAQ là một thẻ riêng, dùng CHUNG một icon', () => {
    // `TourFaqSchema` không có trường icon. Gán icon theo từ khoá câu hỏi là thứ
    // sẽ đoán sai ở tour thứ 40 — một icon cho tất cả là câu trả lời trung thực.
    render(<GoodToKnowPanel tour={TOUR} />);
    const icons = screen.getAllByTestId('faq-icon');
    expect(icons).toHaveLength(TOUR.faqs.length);
    expect(new Set(icons.map((i) => i.dataset.icon)).size).toBe(1);
  });

  it('mở một FAQ thì hiện câu trả lời của đúng mục đó', async () => {
    render(<GoodToKnowPanel tour={TOUR} />);
    await userEvent.click(screen.getByRole('button', { name: /ride a motorbike/i }));
    expect(screen.getByText('No — you ride pillion.')).toBeInTheDocument();
  });

  it('nhãn nhóm policy đi qua i18n, KHÔNG in thẳng giá trị enum', () => {
    render(<GoodToKnowPanel tour={TOUR} />);
    expect(screen.getByText('Booking & payment')).toBeInTheDocument();
    expect(screen.queryByText('BOOKING')).toBeNull();
  });

  it('bỏ nhãn nhóm khi nó lặp lại đúng tiêu đề policy', () => {
    // Fixture thật đặt `title` bằng chính tên nhóm ("Cancellation"), in cả hai
    // là nói cùng một từ hai lần trên hai dòng liền nhau.
    render(<GoodToKnowPanel tour={TOUR} />);
    expect(screen.getAllByText(/^Cancellation$/)).toHaveLength(1);
  });

  it('tour không có faq lẫn policy thì panel không render khung rỗng', () => {
    const { container } = render(
      <GoodToKnowPanel tour={{ ...TOUR, faqs: [], policies: [] } as unknown as TourDetailVM} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
