import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SlotImage } from './slot-image';

/**
 * Bất biến quan trọng nhất ở đây là cái CUỐI: URL ngoài `res.cloudinary.com`
 * phải rơi về `<img>` thường chứ KHÔNG được đi vào `next/image`.
 *
 * Lý do: `buildCloudinaryUrl` có escape-hatch cố ý (ADR-0005 §2) trả nguyên URL
 * tuyệt đối khi `publicId` bắt đầu bằng `http`, còn `next.config.ts` chỉ khai
 * `remotePatterns` cho `res.cloudinary.com`. Một row dữ liệu dùng escape-hatch
 * đó mà lọt vào `next/image` sẽ ném `Invalid src prop … hostname is not
 * configured` — trang chết lúc prerender (build đỏ) hoặc 500 khi ISR. Mất tối
 * ưu ảnh thì phiền; sập trang vì một row thì hỏng.
 */
const CLOUDINARY = {
  publicId: 'tourism/catalog/site/home-hero',
  url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/catalog/site/home-hero',
  type: 'IMAGE',
  role: 'hero',
  posterUrl: null,
  width: 2400,
  height: 1350,
  alt: 'Sunrise over the city',
  sortOrder: 0,
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
} as const;

describe('SlotImage', () => {
  it('khe chưa có ảnh → giữ chỗ, KHÔNG render <img>', () => {
    const { container } = render(<SlotImage image={null} label="Chỗ này chưa có ảnh" />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('ảnh Cloudinary → render <img> mang alt thật', () => {
    const { container } = render(<SlotImage image={{ ...CLOUDINARY }} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(screen.getByAltText('Sunrise over the city')).toBeInTheDocument();
  });

  it('alt null → alt RỖNG (ảnh trang trí), không bịa mô tả', () => {
    const { container } = render(<SlotImage image={{ ...CLOUDINARY, alt: null }} />);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('URL NGOÀI res.cloudinary.com → vẫn hiện ảnh, không để next/image ném lỗi', () => {
    const outside = { ...CLOUDINARY, url: 'https://images.unsplash.com/photo-123' };
    const { container } = render(<SlotImage image={outside} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    // `next/image` viết lại src thành `/_next/image?url=…`; nhánh rơi-về thì giữ
    // nguyên URL gốc. Đó là cách phân biệt hai nhánh mà không cần mock.
    expect(img?.getAttribute('src')).toBe('https://images.unsplash.com/photo-123');
  });
});

describe('SlotImage — hợp đồng định vị', () => {
  const cloudinary = {
    url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/x',
    alt: null,
  } as never;

  it('ảnh THẬT: bọc ngoài luôn có relative + overflow-hidden', () => {
    // `next/image` với `fill` bám tổ tiên có position gần nhất. Thiếu
    // `relative` thì ảnh trải kín viewport — lỗi đã dính ở /about §Team.
    const { container } = render(
      <SlotImage image={cloudinary} label="x" className="h-80 w-full" />,
    );
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.className).toContain('relative');
    expect(wrap.className).toContain('overflow-hidden');
  });

  it('caller vẫn ghi đè được bằng absolute (twMerge)', () => {
    const { container } = render(
      <SlotImage image={cloudinary} label="x" className="absolute inset-0" />,
    );
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.className).toContain('absolute');
    expect(wrap.className).not.toContain('relative');
  });
});
