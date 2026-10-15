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
 *
 * Cộng hai thứ ADR-0058 thêm: badge admin lấp chỗ còn lại trên góc ảnh (§3), và băng đợt
 * kế tiếp luôn có mặt ngay trên đường kẻ chân thẻ (§2).
 */

const CARD: TourCardVM = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'ha-long-bay-cruise',
  title: 'Ha Long Bay Cruise',
  summary: 'Two days on the water.',
  basePrice: '2400000.00',
  priceFrom: '2400000.00',
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
  badges: [],
  nextDeparture: null,
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
  it('khuyến mãi thật (priceFrom dưới basePrice) → hiện phần trăm giảm', () => {
    // priceFrom 2.400.000 trên basePrice 3.000.000 → giảm đúng 20%.
    render(<TourListCard tour={card({ basePrice: '3000000.00' })} />);
    expect(screen.getByText('−20%')).toBeInTheDocument();
    expect(screen.queryByText('Featured')).not.toBeInTheDocument();
  });

  it('không giảm giá nhưng isFeatured → hiện Featured', () => {
    render(<TourListCard tour={card({ isFeatured: true })} />);
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('vừa giảm giá vừa isFeatured → CHỈ hiện giảm giá, sự thật về giá thắng nhãn tiếp thị', () => {
    render(<TourListCard tour={card({ basePrice: '3000000.00', isFeatured: true })} />);
    expect(screen.getByText('−20%')).toBeInTheDocument();
    expect(screen.queryByText('Featured')).not.toBeInTheDocument();
  });

  it('không giảm giá, không nổi bật → không huy hiệu nào', () => {
    render(<TourListCard tour={card()} />);
    expect(screen.queryByText('Featured')).not.toBeInTheDocument();
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  /**
   * Ca user báo 15/09/2026 trên /tours: thẻ "Hanoi Old Quarter Street Food by
   * Night" in "$28 was $42 −32%". $42 là giá niêm yết cấp tour — không ai trả —
   * bị sweep 19/08 chồng lên; khuyến mãi thật chỉ là $28.35 trên giá gốc $35.
   */
  it('giá niêm yết của tour KHÔNG còn là giá gạch: gạch basePrice, % theo khuyến mãi thật', () => {
    render(
      <TourListCard
        tour={card({
          currency: 'USD',
          basePrice: '35.00',
          priceFrom: '28.35',
          compareAtPrice: '42.00',
        })}
      />,
    );
    expect(screen.getByText('$28')).toBeInTheDocument();
    expect(screen.getByText('$35')).toBeInTheDocument();
    expect(screen.getByText('−19%')).toBeInTheDocument();
    expect(screen.queryByText('$42')).toBeNull();
    expect(screen.queryByText('−32%')).toBeNull();
  });

  it('chỉ có giá niêm yết, không khuyến mãi thật → không gạch, huy hiệu trả về Featured', () => {
    render(<TourListCard tour={card({ compareAtPrice: '3000000.00', isFeatured: true })} />);
    expect(screen.getByText('Featured')).toBeInTheDocument();
    expect(screen.queryByText(/−\d+%/)).toBeNull();
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

describe('badge admin trên góc ảnh (ADR-0058 §3)', () => {
  it('giảm giá giữ suất đầu, badge đầu tiên lấp suất thứ hai, phần dư không thành "+N"', () => {
    render(<TourListCard tour={card({ basePrice: '3000000.00', badges: ['POPULAR', 'NEW'] })} />);
    expect(screen.getByText('−20%')).toBeInTheDocument();
    expect(screen.getByText('Popular')).toBeInTheDocument();
    expect(screen.queryByText('New')).toBeNull();
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  it('không giảm giá mà isFeatured: "Featured" rồi tới badge đầu tiên', () => {
    render(<TourListCard tour={card({ isFeatured: true, badges: ['NEW', 'POPULAR'] })} />);
    expect(screen.getByText('Featured')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.queryByText('Popular')).toBeNull();
  });

  it('không giảm giá, không nổi bật: hai badge đầu theo thứ tự đã lưu', () => {
    render(<TourListCard tour={card({ badges: ['EXCLUSIVE', 'BEST_VALUE', 'NEW'] })} />);
    expect(screen.getByText('Exclusive')).toBeInTheDocument();
    expect(screen.getByText('Best value')).toBeInTheDocument();
    expect(screen.queryByText('New')).toBeNull();
  });

  it('Limited offer mang token cảnh báo — badge khẩn duy nhất, như hero trang tour', () => {
    render(<TourListCard tour={card({ badges: ['LIMITED_OFFER', 'NEW'] })} />);
    expect(screen.getByText('Limited offer').className).toContain('bg-warning');
    expect(screen.getByText('New').className).not.toContain('bg-warning');
  });
});

describe('băng đợt kế tiếp (ADR-0058 §2)', () => {
  const band = (container: HTMLElement) =>
    container.querySelector('[data-slot="next-departure"]') as HTMLElement | null;

  it('in "Next departure" kèm thứ, ngày, tháng của đợt', () => {
    const { container } = render(
      <TourListCard tour={card({ nextDeparture: { startDate: '2026-11-14', seatsLeft: 8 } })} />,
    );
    expect(band(container)).toHaveTextContent('Next departure');
    expect(band(container)).toHaveTextContent('Sat 14 Nov');
    // Còn 8 chỗ: chưa đáng báo.
    expect(band(container)).not.toHaveTextContent(/left/);
  });

  it('còn từ 3 chỗ trở xuống thì thêm "Only N seats left" bằng mực cảnh báo', () => {
    render(
      <TourListCard tour={card({ nextDeparture: { startDate: '2026-11-14', seatsLeft: 2 } })} />,
    );
    expect(screen.getByText('Only 2 seats left').className).toContain('text-warning-emphasis');
  });

  it('một chỗ cuối thì chữ số ít', () => {
    render(
      <TourListCard tour={card({ nextDeparture: { startDate: '2026-11-14', seatsLeft: 1 } })} />,
    );
    expect(screen.getByText('Only 1 seat left')).toBeInTheDocument();
  });

  it('không còn đợt nào đặt được: "Dates on request", không in ngày nào', () => {
    const { container } = render(<TourListCard tour={card({ nextDeparture: null })} />);
    expect(band(container)).toHaveTextContent('Dates on request');
    expect(band(container)).not.toHaveTextContent('Next departure');
  });

  it('băng luôn GIỮ CHỖ đúng một dòng — mọi thẻ cao bằng nhau', () => {
    const { container } = render(<TourListCard tour={card()} />);
    expect(band(container)?.className).toContain('h-5');
    expect(band(container)?.className).toContain('truncate');
  });

  it('API bản cũ chưa trả `nextDeparture`: băng vẫn giữ chỗ nhưng không hứa gì', () => {
    const { nextDeparture: _absent, ...legacy } = CARD;
    const { container } = render(<TourListCard tour={legacy as TourCardVM} />);
    expect(band(container)).not.toBeNull();
    expect(band(container)?.textContent).toBe('');
  });

  it('băng đứng ngay TRÊN chân thẻ (hàng giá và nút)', () => {
    const { container } = render(<TourListCard tour={card()} />);
    const footer = screen.getByRole('link', { name: 'View tour' }).parentElement;
    expect(band(container)?.nextElementSibling).toBe(footer);
  });
});
