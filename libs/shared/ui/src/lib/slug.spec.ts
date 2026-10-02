import { describe, expect, it } from 'vitest';
import { slugify } from './slug.js';

describe('slugify', () => {
  it('hạ chữ thường và nối bằng gạch ngang', () => {
    expect(slugify('Booking and your contract')).toBe('booking-and-your-contract');
  });

  it('gộp ký tự không phải chữ/số thành một gạch', () => {
    expect(slugify('Prices, inclusions & payment')).toBe('prices-inclusions-payment');
  });

  it('cắt gạch thừa ở hai đầu', () => {
    expect(slugify('— Travel insurance —')).toBe('travel-insurance');
  });

  it('trả chuỗi rỗng khi không còn ký tự hợp lệ', () => {
    expect(slugify('———')).toBe('');
  });
});
