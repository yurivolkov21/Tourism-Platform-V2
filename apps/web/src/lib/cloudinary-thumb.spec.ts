import { describe, expect, it } from 'vitest';
import { thumbnailSrc } from './cloudinary-thumb';

// W-10: avatar và ảnh review hiển thị 64–112px nhưng từng tải bản gốc
// `f_auto,q_auto` (ảnh chụp điện thoại vài megabyte). Thẻ `<img>` thường không đi
// qua loader của next/image nên phải tự xin cỡ.
describe('thumbnailSrc', () => {
  it('xin bề ngang gấp ba khung hiển thị trên URL dạng API dựng', () => {
    expect(
      thumbnailSrc(
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v7/reviews/a.jpg',
        64,
      ),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_192/v7/reviews/a.jpg');
  });

  it('URL ngoài Cloudinary trả nguyên: ảnh xem trước blob: và avatar Google', () => {
    expect(thumbnailSrc('blob:http://localhost:3000/5f1c', 96)).toBe(
      'blob:http://localhost:3000/5f1c',
    );
    expect(thumbnailSrc('https://lh3.googleusercontent.com/a/abc=s96-c', 112)).toBe(
      'https://lh3.googleusercontent.com/a/abc=s96-c',
    );
  });
});
