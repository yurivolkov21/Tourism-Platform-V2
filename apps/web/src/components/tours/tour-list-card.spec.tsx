import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TourCardVM } from '@/lib/api/tours';
import { TourListCard } from './tour-list-card';

/**
 * Thẻ tour lưới — canh hai bất biến mà wireframe user chốt 17/08 đặt ra
 * (`docs/design/mockups/tours-card-grid.src.html`):
 *
 *   1. HỢP ĐỒNG SỐ DÒNG — tiêu đề đúng 1 dòng, tóm tắt đúng 2 dòng, CỐ ĐỊNH.
 *   2. HAI NHÁNH HUY HIỆU — giảm giá thắng "Featured", không bao giờ hiện cả hai.
 */

const CARD: TourCardVM = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'ha-long-bay-cruise',
  title: 'Ha Long Bay Cruise',
  summary: 'Two days on the water.',
  basePrice: '2400000.00',
  compareAtPrice: null,
  currency: 'VND',
  durationDays: 2,
  difficulty: 'EASY',
  maxGroupSize: 12,
  isFeatured: false,
  destinations: [{ slug: 'ha-long', name: 'Ha Long', isPrimary: true }],
  category: { slug: 'cruise', name: 'Cruise' },
  ratingAvg: 4.6,
  ratingCount: 14,
  cover: null,
};

const card = (over: Partial<TourCardVM> = {}): TourCardVM => ({ ...CARD, ...over });

describe('hợp đồng số dòng — thẻ không bao giờ giãn theo độ dài chữ', () => {
  /**
   * Vì sao ở ĐÂY được phép ghim chuỗi class, trong khi `link-cta.spec.tsx` cấm:
   * ở kia chuỗi class là CÁCH HIỆN THỰC của một hành vi (nút trông thế nào),
   * còn ở đây chính chiều cao cố định LÀ yêu cầu user chốt. jsdom không có
   * layout nên không đo được pixel; thứ gần nhất với "đo" là khẳng định phần tử
   * vẫn mang cả hai vế — GHIM CHỖ (`h-*`) và CẮT CHỮ (`truncate`/`line-clamp`).
   * Thiếu vế nào cũng làm thẻ giãn trở lại, đúng thứ user yêu cầu chặn.
   */
  it('tiêu đề: ghim đúng 1 dòng và cắt phần thừa', () => {
    render(<TourListCard tour={card()} />);
    const h3 = screen.getByRole('heading', { level: 3 });
    expect(h3.className).toContain('h-[1lh]');
    expect(h3.className).toContain('truncate');
  });

  it('tiêu đề dài KHÔNG làm thẻ cao thêm — vẫn đúng một dòng giữ chỗ', () => {
    render(
      <TourListCard
        tour={card({
          title: 'Ha Long Bay Cruise — Bai Tu Long, Sung Sot Cave and an overnight on deck',
        })}
      />,
    );
    const h3 = screen.getByRole('heading', { level: 3 });
    expect(h3.className).toContain('h-[1lh]');
    expect(h3.className).not.toContain('line-clamp-2');
  });

  it('tóm tắt: ghim đúng 2 dòng', () => {
    const { container } = render(<TourListCard tour={card()} />);
    const summary = container.querySelector('p');
    expect(summary?.className).toContain('line-clamp-2');
    expect(summary?.className).toContain('h-[2lh]');
  });

  it('tóm tắt rỗng vẫn GIỮ CHỖ — thẻ cạnh nó không được cao hơn', () => {
    const { container } = render(<TourListCard tour={card({ summary: null })} />);
    const summary = container.querySelector('p');
    // Phần tử phải còn đó, chỉ là không có chữ. Trả về `null` thì mất 2 dòng.
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toBe('');
    expect(summary?.className).toContain('h-[2lh]');
  });
});

describe('hai nhánh huy hiệu', () => {
  it('có giá gạch → hiện phần trăm giảm', () => {
    render(<TourListCard tour={card({ compareAtPrice: '3000000.00' })} />);
    expect(screen.getByText('−20%')).toBeInTheDocument();
    expect(screen.queryByText('Featured')).not.toBeInTheDocument();
  });

  it('không giảm giá nhưng isFeatured → hiện Featured', () => {
    render(<TourListCard tour={card({ isFeatured: true })} />);
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('vừa giảm giá vừa isFeatured → CHỈ hiện giảm giá, sự thật về giá thắng nhãn tiếp thị', () => {
    render(<TourListCard tour={card({ compareAtPrice: '3000000.00', isFeatured: true })} />);
    expect(screen.getByText('−20%')).toBeInTheDocument();
    expect(screen.queryByText('Featured')).not.toBeInTheDocument();
  });

  it('không giảm giá, không nổi bật → không huy hiệu nào', () => {
    render(<TourListCard tour={card()} />);
    expect(screen.queryByText('Featured')).not.toBeInTheDocument();
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });
});

describe('rating', () => {
  it('chưa ai đánh giá → bỏ hẳn dòng sao thay vì hiện 0.0', () => {
    render(<TourListCard tour={card({ ratingAvg: null, ratingCount: 0 })} />);
    expect(screen.getByText(/no reviews yet|not yet reviewed/i)).toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });

  it('có đánh giá → hiện điểm và số lượt', () => {
    render(<TourListCard tour={card()} />);
    expect(screen.getByText('4.6')).toBeInTheDocument();
    expect(screen.getByText('(14)')).toBeInTheDocument();
  });
});
