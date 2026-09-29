import { describe, expect, it } from 'vitest';
import { cloudinaryImageUrl, withDeliveryTransform } from './cloudinary-url';

describe('withDeliveryTransform', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v17/tourism/x';

  it('chèn transform ngay sau f_auto,q_auto của URL delivery phía API', () => {
    expect(withDeliveryTransform(url, 'w_320')).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_320/v17/tourism/x',
    );
    expect(withDeliveryTransform(url, 'w_128,h_128,c_fill')).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_128,h_128,c_fill/v17/tourism/x',
    );
  });

  it('URL không theo khuôn (host lạ, dữ liệu cũ) trả nguyên — thà nặng còn hơn vỡ ảnh', () => {
    expect(withDeliveryTransform('https://example.com/a.jpg', 'w_320')).toBe(
      'https://example.com/a.jpg',
    );
    const bare = 'https://res.cloudinary.com/demo/image/upload/v17/tourism/x';
    expect(withDeliveryTransform(bare, 'w_320')).toBe(bare);
  });
});

describe('cloudinaryImageUrl', () => {
  it('ảnh vừa tải lên dựng đúng khuôn URL của API (buildCloudinaryUrl)', () => {
    expect(cloudinaryImageUrl('demo', 'tourism/tours/t/abc', '1759000000')).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1759000000/tourism/tours/t/abc',
    );
  });
});
