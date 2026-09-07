import { describe, expect, it } from 'vitest';
import cloudinaryLoader from './cloudinary-loader';

// ADR-0020 §Hệ quả (đòi từ 14/08) + ADR-0016 AMEND 1 §7: không có loader thì
// next/image tải nguyên bản f_auto,q_auto rồi nén lại lần hai — thumbnail
// 64px tải cả megabyte. Loader phải KHÔNG phá URL đã mang transformation
// (API dựng sẵn f_auto,q_auto — đối chiếu slot-image.tsx).
describe('cloudinaryLoader', () => {
  it('chèn w_<width> vào URL đã có f_auto,q_auto (dạng API dựng)', () => {
    expect(
      cloudinaryLoader({
        src: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/hero',
        width: 640,
      }),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640/v1/tourism/hero');
  });

  it('idempotent: đã có w_ thì THAY chứ không chồng thêm', () => {
    const once = cloudinaryLoader({
      src: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/hero',
      width: 640,
    });
    const twice = cloudinaryLoader({ src: once, width: 1280 });
    expect(twice).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_1280/v1/tourism/hero',
    );
    expect(twice.match(/w_/g)?.length).toBe(1);
  });

  it('URL không có segment transformation → chèn đủ f_auto,q_auto,w_', () => {
    expect(
      cloudinaryLoader({
        src: 'https://res.cloudinary.com/demo/image/upload/v1/tourism/hero',
        width: 320,
      }),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_320/v1/tourism/hero');
  });

  it('quality truyền vào thay q_auto', () => {
    expect(
      cloudinaryLoader({
        src: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/hero',
        width: 640,
        quality: 80,
      }),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_80,w_640/v1/tourism/hero');
  });

  // Vòng vá review W3: regex cũ `^[a-z]{1,3}_[^/]+$` khớp cả publicId thật.
  it('publicId phẳng có gạch dưới (my_photo.jpg) KHÔNG bị nuốt vào segment transform', () => {
    expect(
      cloudinaryLoader({
        src: 'https://res.cloudinary.com/demo/image/upload/my_photo.jpg',
        width: 640,
      }),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640/my_photo.jpg');
  });

  it('thư mục đầu kiểu ab_cd/ giữ nguyên, chèn segment MỚI trước nó', () => {
    expect(
      cloudinaryLoader({
        src: 'https://res.cloudinary.com/demo/image/upload/ab_cd/folder/pic.jpg',
        width: 640,
      }),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640/ab_cd/folder/pic.jpg');
  });

  it('URL ký (s--…--) trả NGUYÊN — chèn gì cũng làm chữ ký sai (401)', () => {
    const signed = 'https://res.cloudinary.com/demo/image/upload/s--AbCdEf12--/v1/tourism/hero';
    expect(cloudinaryLoader({ src: signed, width: 640 })).toBe(signed);
  });

  it('giữ tham số khác (c_limit) ở đuôi khi merge — hợp đồng JSDoc', () => {
    expect(
      cloudinaryLoader({
        src: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_1600,c_limit/v1/tourism/hero',
        width: 640,
      }),
    ).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640,c_limit/v1/tourism/hero',
    );
  });

  it('URL ngoài Cloudinary trả NGUYÊN — escape-hatch của buildCloudinaryUrl (ADR-0005 §2)', () => {
    for (const src of [
      'https://images.example.com/photo.jpg',
      '/local/static.png',
      'https://res.cloudinary.com/demo/video/upload/f_auto,q_auto/clip',
    ]) {
      expect(cloudinaryLoader({ src, width: 640 })).toBe(src);
    }
  });
});
