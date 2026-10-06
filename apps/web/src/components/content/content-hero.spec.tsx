import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContentHero } from './content-hero';

/**
 * Nút quay lại của hero (spec P7 §4.1). Mười bảy trang đang dùng hero không truyền `back`,
 * nên ca thứ hai canh DOM của chúng không đổi.
 */
describe('ContentHero — nút quay lại', () => {
  it('có `back`: link tròn đứng TRƯỚC breadcrumb, tên đọc và tooltip là nhãn', () => {
    render(
      <ContentHero
        breadcrumb="Bookings"
        title="My bookings"
        back={{ href: '/account', label: 'Back to Passport' }}
      />,
    );
    const back = screen.getByRole('link', { name: 'Back to Passport' });
    expect(back).toHaveAttribute('href', '/account');
    expect(back).toHaveAttribute('title', 'Back to Passport');
    // Chỉ có icon — không chữ nào thấy được.
    expect(back.textContent).toBe('');
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(back.compareDocumentPosition(crumb)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('không có `back`: breadcrumb đứng thẳng trong hàng như cũ, link duy nhất là Home', () => {
    render(<ContentHero breadcrumb="Terms" title="Terms of service" />);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Home']);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).parentElement).toHaveClass(
      'justify-between',
    );
  });
});
