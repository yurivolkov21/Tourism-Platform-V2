import { render, screen, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { EnquiryCta } from './enquiry-cta';

/**
 * Khối "Plan your trip" cuối trang nội dung (sổ nợ E1). Copy sống ở `messages.enquiryCta`
 * từ lúc port Nexora; trang truyền biến thể tiêu đề của mình.
 */
describe('EnquiryCta', () => {
  const t = messages.enquiryCta;

  it('là một khu có tên: tiêu đề h2 của trang gọi đặt tên cho region', () => {
    render(<EnquiryCta heading={t.headings.faq} />);
    const region = screen.getByRole('region', { name: t.headings.faq });
    expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent(t.headings.faq);
    expect(within(region).getByText(t.subtitle)).toBeInTheDocument();
  });

  it('kể đủ ba lợi ích thành một danh sách', () => {
    render(<EnquiryCta heading={t.headings.faq} />);
    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual([...t.benefits]);
  });

  it('CTA là LINK sang /contact, không phải nút (bất biến của link-cta.spec)', () => {
    render(<EnquiryCta heading={t.headings.faq} />);
    expect(screen.getByRole('link', { name: t.cta })).toHaveAttribute('href', '/contact');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
