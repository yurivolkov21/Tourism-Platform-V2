import { cloudinaryUrl } from './cloudinary-url';

describe('cloudinaryUrl', () => {
  it('chèn w_<width> vào URL đã có f_auto,q_auto (dạng API dựng)', () => {
    expect(
      cloudinaryUrl(
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/hero',
        640,
      ),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640/v1/tourism/hero');
  });

  it('idempotent: đã có w_ thì THAY chứ không chồng thêm', () => {
    const once = cloudinaryUrl(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/hero',
      640,
    );
    const twice = cloudinaryUrl(once, 1280);
    expect(twice).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_1280/v1/tourism/hero',
    );
    expect(twice.match(/w_/g)?.length).toBe(1);
  });

  it('URL không có segment transformation → chèn đủ f_auto,q_auto,w_', () => {
    expect(cloudinaryUrl('https://res.cloudinary.com/demo/image/upload/v1/tourism/hero', 320)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_320/v1/tourism/hero',
    );
  });

  it('quality truyền vào thay q_auto', () => {
    expect(
      cloudinaryUrl(
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/hero',
        640,
        80,
      ),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_80,w_640/v1/tourism/hero');
  });

  it('publicId phẳng có gạch dưới (my_photo.jpg) KHÔNG bị nuốt vào segment transform', () => {
    expect(cloudinaryUrl('https://res.cloudinary.com/demo/image/upload/my_photo.jpg', 640)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640/my_photo.jpg',
    );
  });

  it('thư mục đầu kiểu ab_cd/ giữ nguyên, chèn segment MỚI trước nó', () => {
    expect(
      cloudinaryUrl('https://res.cloudinary.com/demo/image/upload/ab_cd/folder/pic.jpg', 640),
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640/ab_cd/folder/pic.jpg');
  });

  it('URL ký (s--…--) trả NGUYÊN — chèn gì cũng làm chữ ký sai (401)', () => {
    const signed = 'https://res.cloudinary.com/demo/image/upload/s--AbCdEf12--/v1/tourism/hero';
    expect(cloudinaryUrl(signed, 640)).toBe(signed);
  });

  it('giữ tham số khác (c_limit) ở đuôi khi merge', () => {
    expect(
      cloudinaryUrl(
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_1600,c_limit/v1/tourism/hero',
        640,
      ),
    ).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640,c_limit/v1/tourism/hero',
    );
  });

  it('URL ngoài Cloudinary trả NGUYÊN', () => {
    for (const src of [
      'https://images.example.com/photo.jpg',
      '/local/static.png',
      'https://res.cloudinary.com/demo/video/upload/f_auto,q_auto/clip',
    ]) {
      expect(cloudinaryUrl(src, 640)).toBe(src);
    }
  });
});
