import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { PhotoCover } from './photo-cover';

const COVER = {
  heightClass: 'h-[62mm]',
  titleClass: 'text-[27pt]',
  docType: 'Trip voucher',
  meta: 'Issued 9 Oct 2026',
  kicker: 'Hội An · 1 day · Thu 29 Oct 2026',
  title: 'Hội An Old Town & Lantern Evening',
};

describe('PhotoCover', () => {
  it('có ảnh: <img> tải ngay (in được khi tắt nền, không hoãn tải khi đang ẩn)', () => {
    const { container } = render(
      <PhotoCover
        {...COVER}
        photo={{ url: 'https://res.cloudinary.com/x.jpg', alt: 'Lanterns' }}
      />,
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('alt', 'Lanterns');
    // Ưu tiên thấp: React vẫn tải ngay (eager) nhưng thôi đẩy preload ưu tiên cao vào <head> cho một
    // ảnh chỉ dùng khi in, giành băng thông với ảnh màn hình ở mọi lượt xem.
    expect(img).toHaveAttribute('fetchpriority', 'low');
  });

  // `text-[27pt]` đứng sau `leading-[1.1]` trong `cn` thì tailwind-merge xoá dãn dòng (cỡ chữ và
  // dãn dòng xung đột) — tên hai dòng dãn 1.45 tràn đáy bìa 46 mm của hoá đơn.
  it('tên tour giữ dãn dòng 1.1 của bản thảo, cạnh cỡ chữ nơi gọi truyền', () => {
    render(<PhotoCover {...COVER} photo={null} titleClass="text-[22pt]" />);
    const title = screen.getByRole('heading', { level: 2 });
    expect(title.classList).toContain('text-[22pt]');
    expect(title.classList).toContain('leading-[1.1]');
  });

  it('không ảnh: không <img> vỡ, nền hero', () => {
    const { container } = render(<PhotoCover {...COVER} photo={null} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-slot="print-cover"]')?.className).toContain('bg-hero');
  });

  it('tên tour là h2, kicker, đầu trang tông ảnh có thương hiệu và chỉ còn website', () => {
    const { container } = render(<PhotoCover {...COVER} photo={null} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(COVER.title);
    expect(screen.getByText(COVER.kicker)).toBeInTheDocument();
    const letterhead = container.querySelector('[data-slot="doc-letterhead"]');
    expect(letterhead).toHaveAttribute('data-tone', 'photo');
    expect(letterhead?.querySelector('[data-slot="print-brand"] svg')).not.toBeNull();
    expect(screen.getByText(messages.printDoc.website)).toBeInTheDocument();
  });
});
