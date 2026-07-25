import { describe, expect, it } from 'vitest';
import { filterFaqCategories } from './faq-filter.js';

const CATEGORIES = [
  {
    title: 'Booking & payment',
    items: [
      { question: 'How do I book a tour?', answer: 'Browse our tours and send an enquiry.' },
      { question: 'Do I pay a deposit?', answer: 'Most tours are held with a deposit.' },
    ],
  },
  {
    title: 'Guides & on-trip',
    items: [{ question: 'Do guides speak English?', answer: 'Every guide leads in English.' }],
  },
];

describe('filterFaqCategories', () => {
  it('query rỗng trả nguyên danh sách', () => {
    expect(filterFaqCategories(CATEGORIES, '   ')).toEqual(CATEGORIES);
  });

  it('lọc theo câu hỏi, không phân biệt hoa thường', () => {
    const result = filterFaqCategories(CATEGORIES, 'DEPOSIT');
    expect(result).toHaveLength(1);
    expect(result[0]?.items).toHaveLength(1);
    expect(result[0]?.items[0]?.question).toBe('Do I pay a deposit?');
  });

  it('lọc được cả theo nội dung câu trả lời', () => {
    const result = filterFaqCategories(CATEGORIES, 'enquiry');
    expect(result[0]?.items[0]?.question).toBe('How do I book a tour?');
  });

  it('bỏ hẳn nhóm không còn câu nào khớp', () => {
    const result = filterFaqCategories(CATEGORIES, 'english');
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Guides & on-trip');
  });

  it('không khớp gì thì trả mảng rỗng', () => {
    expect(filterFaqCategories(CATEGORIES, 'submarine')).toEqual([]);
  });
});
