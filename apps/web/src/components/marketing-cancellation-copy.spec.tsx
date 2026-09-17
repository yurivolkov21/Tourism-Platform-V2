import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AboutCtaVideo } from './about/about-cta-video';
import { AboutValues } from './about/about-values';
import { TrustStrip } from './home/trust-strip';
import { TopBar } from './top-bar';

/**
 * Bốn bề mặt quảng bá nói về chuyện huỷ: thanh trên cùng (MỌI trang), dải cam
 * kết trang chủ, hai khối trang About. Chúng không có spec riêng và đã hai lần
 * nói sai chính sách — "48 hours" hứa hoàn 100% ở đúng mốc bảng bậc trả 0%
 * (vá 04/09), rồi "on most tours" cộng "refund schedule" trỏ về một bảng nay đã
 * bị ADR-0041 gỡ. Spec này khoá cả hai chiều: câu đúng phải có mặt, câu đã gỡ
 * không được lẻn về.
 */
beforeAll(() => {
  // `motion.div` với `whileInView` cần IntersectionObserver; jsdom không có.
  // Spec này không quan sát animation nên stub rỗng là đủ.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

/** Lời hứa đã gỡ — không bề mặt nào được mang bất kỳ mẫu nào. */
const FORBIDDEN = [
  /most tours/i,
  /most departures/i,
  /refund schedule/i,
  /\b48 hours\b/i,
  /\b24 hours\b/i,
  /move dates/i,
  /change your dates/i,
];

const SURFACES: Array<[string, () => ReactElement]> = [
  ['thanh trên cùng', () => <TopBar />],
  ['dải cam kết trang chủ', () => <TrustStrip />],
  ['khối lời hứa trang About', () => <AboutValues />],
  ['dải CTA trang About', () => <AboutCtaVideo />],
];

describe.each(SURFACES)('%s', (_name, ui) => {
  it('nói "Free cancellation" — một câu đúng cho mọi tour', () => {
    const { container } = render(ui());
    expect(container.textContent).toMatch(/Free cancellation/i);
  });

  it('không còn lời hứa đã gỡ (bảng bậc, ân hạn theo giờ, đổi ngày, "most tours")', () => {
    const { container } = render(ui());
    for (const pattern of FORBIDDEN) expect(container.textContent).not.toMatch(pattern);
  });
});

describe('dải cam kết trang chủ', () => {
  it('dẫn thẳng sang trang chính sách, dùng CHUNG nhãn link với trang booking', () => {
    render(<TrustStrip />);
    expect(screen.getByRole('link', { name: 'Read the cancellation policy' })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );
  });

  it('không hứa một con số ngày nào — N khác nhau theo độ dài chuyến', () => {
    const { container } = render(<TrustStrip />);
    expect(container.textContent).not.toMatch(/\d+ days before/);
  });
});
