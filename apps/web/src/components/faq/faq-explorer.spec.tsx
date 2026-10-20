import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { FaqCategory } from '@/lib/faq-filter';
import { FaqExplorer } from './faq-explorer';

beforeAll(() => {
  // Từng câu hỏi trồi lên bằng `whileInView`; jsdom không có IntersectionObserver.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// Năm nhóm theo ĐÚNG thứ tự của catalogue thật (`messages.faqPage.categories`) —
// icon của nhóm gắn theo thứ tự đó.
const CATEGORIES: FaqCategory[] = [
  { title: 'Booking & payment', items: [{ question: 'How do I pay?', answer: 'By card.' }] },
  { title: 'Itineraries', items: [{ question: 'Can I change the route?', answer: 'Yes.' }] },
  { title: 'Guides & on-trip', items: [{ question: 'Who guides us?', answer: 'Locals.' }] },
  { title: 'Cancellations', items: [{ question: 'Can I cancel?', answer: 'Up to 7 days.' }] },
  {
    title: 'Travelling in Vietnam',
    items: [{ question: 'Do I need a visa?', answer: 'Most visitors do.' }],
  },
];

function renderFaq() {
  return render(
    <FaqExplorer
      categories={CATEGORIES}
      searchPlaceholder="Search"
      searchLabel="Search questions"
      noResults="No results"
    />,
  );
}

/** Tên icon lucide của nhóm mang tiêu đề `title` (lớp `lucide-<tên>` trên `<svg>`). */
function groupIcon(title: string): string | undefined {
  const section = screen.getByRole('heading', { level: 2, name: title }).closest('section');
  if (!section) throw new Error(`không thấy nhóm ${title}`);
  const svg = section.querySelector('svg');
  return [...(svg?.classList ?? [])].find((name) => name.startsWith('lucide-'));
}

describe('FaqExplorer — icon của nhóm', () => {
  it('mỗi nhóm một icon theo thứ tự catalogue', () => {
    renderFaq();
    expect(groupIcon('Booking & payment')).toBe('lucide-credit-card');
    expect(groupIcon('Travelling in Vietnam')).toBe('lucide-plane');
  });

  it('tìm kiếm lọc mất các nhóm đầu thì nhóm còn lại GIỮ icon của chính nó', async () => {
    renderFaq();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search questions' }), 'visa');
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Travelling in Vietnam']);
    // Đếm theo vị trí sau khi lọc thì nhóm này thành "nhóm 0" và mang icon thẻ
    // thanh toán của "Booking & payment".
    expect(groupIcon('Travelling in Vietnam')).toBe('lucide-plane');
  });
});
