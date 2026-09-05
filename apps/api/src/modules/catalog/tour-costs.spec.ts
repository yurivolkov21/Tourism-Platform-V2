import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { TourCostBasis } from '../../generated/prisma/enums.js';
import { derivedCostPrice, perDepartureTotal, perPersonTotal } from './tour-costs.js';

/**
 * Phép cộng giá vốn của một tour (ADR-0033 §2) — THUẦN, nên mọi biên làm tròn
 * test được mà không cần DB.
 *
 * Ba hàm chứ không một, và bộ test này canh đúng chỗ phân biệt ấy:
 * `perPersonTotal`/`perDepartureTotal` là hai vế mà BÁO CÁO dùng tách riêng
 * (chi phí cố định ở lại khi khách huỷ, chi phí biến đổi đi theo khách —
 * ADR-0033 §4), còn `derivedCostPrice` là con số BÁN HÀNG gộp cả hai.
 */
const d = (v: string) => new Prisma.Decimal(v);
const perPerson = (v: string) => ({ amount: d(v), basis: TourCostBasis.PER_PERSON });
const perDeparture = (v: string) => ({ amount: d(v), basis: TourCostBasis.PER_DEPARTURE });

describe('tour-costs', () => {
  it('danh sách rỗng cho 0, không phải null', () => {
    expect(perPersonTotal([]).toFixed(2)).toBe('0.00');
    expect(perDepartureTotal([]).toFixed(2)).toBe('0.00');
    expect(derivedCostPrice([], 20).toFixed(2)).toBe('0.00');
  });

  it('mỗi hàm CHỈ cộng dòng thuộc cờ của nó', () => {
    // Gộp hai vế là mất đúng cái phân biệt khiến luật huỷ (§4) nói được thành
    // câu — nên đây là bất biến, không phải chi tiết cài đặt.
    const items = [perPerson('30.00'), perDeparture('400.00'), perPerson('85.50')];

    expect(perPersonTotal(items).toFixed(2)).toBe('115.50');
    expect(perDepartureTotal(items).toFixed(2)).toBe('400.00');
  });

  it('costPrice = biến đổi + cố định chia số khách tối đa', () => {
    // Công thức operator thật: chi phí cố định ÷ số khách + biến đổi mỗi khách.
    // 30.00 + 85.50 + 400/20 = 135.50
    const items = [perPerson('30.00'), perPerson('85.50'), perDeparture('400.00')];

    expect(derivedCostPrice(items, 20).toFixed(2)).toBe('135.50');
  });

  it('làm tròn HALF_UP về 2 chữ số, khớp Decimal(14,2) của cột', () => {
    // 100/3 = 33.333… → 33.33
    expect(derivedCostPrice([perDeparture('100.00')], 3).toFixed(2)).toBe('33.33');
    // 100/8 = 12.5, cộng 0.005 để chạm đúng biên làm tròn → 12.51
    expect(derivedCostPrice([perPerson('0.005'), perDeparture('100.00')], 8).toFixed(2)).toBe(
      '12.51',
    );
  });

  it('maxGroupSize <= 0 thì BỎ phần cố định thay vì chia cho 0', () => {
    // Tour cấu hình sai không được phép làm chết đường TẠO BOOKING. Hỏng an
    // toàn là con số thấp hơn sự thật, không phải một exception giữa
    // transaction đang giữ advisory lock.
    const items = [perPerson('30.00'), perDeparture('400.00')];

    expect(derivedCostPrice(items, 0).toFixed(2)).toBe('30.00');
    expect(derivedCostPrice(items, -5).toFixed(2)).toBe('30.00');
  });

  it('không đụng tới mảng của caller', () => {
    const items = [perPerson('30.00'), perDeparture('400.00')];
    perPersonTotal(items);
    derivedCostPrice(items, 20);

    expect(items).toHaveLength(2);
    expect(items[0]?.amount.toFixed(2)).toBe('30.00');
  });
});
