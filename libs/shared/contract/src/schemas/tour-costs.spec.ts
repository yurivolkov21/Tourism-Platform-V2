import { describe, expect, it } from 'vitest';
import {
  type CostItemLike,
  derivedCostPrice,
  perDepartureTotal,
  perPersonTotal,
} from './tour-costs.js';

/**
 * Giá vốn của một tour (ADR-0033 §2), dời lên contract ở F17 (ADR-0047 §8).
 * Bộ ca chép từ bản `Prisma.Decimal` cũ ở `apps/api`, cộng ba ca làm tròn mà
 * bản cent nguyên phải giữ đúng: nửa cent đi LÊN, không làm tròn chẵn, không cắt.
 */
const perPerson = (amount: string): CostItemLike => ({ amount, basis: 'PER_PERSON' });
const perDeparture = (amount: string): CostItemLike => ({ amount, basis: 'PER_DEPARTURE' });

describe('tour-costs', () => {
  it('danh sách rỗng cho "0.00" ở cả ba hàm, không phải null', () => {
    expect(perPersonTotal([])).toBe('0.00');
    expect(perDepartureTotal([])).toBe('0.00');
    expect(derivedCostPrice([], 20)).toBe('0.00');
  });

  it('mỗi hàm CHỈ cộng dòng thuộc cách tính của nó', () => {
    const items = [perPerson('30.00'), perDeparture('400.00'), perPerson('85.50')];

    expect(perPersonTotal(items)).toBe('115.50');
    expect(perDepartureTotal(items)).toBe('400.00');
  });

  it('costPrice = theo khách + theo chuyến chia số khách tối đa', () => {
    // 30.00 + 85.50 + 400 / 20 = 135.50
    const items = [perPerson('30.00'), perPerson('85.50'), perDeparture('400.00')];

    expect(derivedCostPrice(items, 20)).toBe('135.50');
  });

  it('nửa cent làm tròn LÊN — không làm tròn chẵn', () => {
    // 100.01 / 2 = 50.005 → 50.01 (làm tròn chẵn sẽ ra 50.00)
    expect(derivedCostPrice([perDeparture('100.01')], 2)).toBe('50.01');
  });

  it('phần lẻ dưới nửa cent bỏ đi, trên nửa cent làm tròn lên — không cắt, không làm tròn trần', () => {
    // 100.00 / 3 = 33.333… → 33.33 (làm tròn trần sẽ ra 33.34)
    expect(derivedCostPrice([perDeparture('100.00')], 3)).toBe('33.33');
    // 200.00 / 3 = 66.666… → 66.67 (cắt sẽ ra 66.66)
    expect(derivedCostPrice([perDeparture('200.00')], 3)).toBe('66.67');
  });

  it('maxGroupSize <= 0 thì BỎ phần theo chuyến thay vì chia cho 0', () => {
    const items = [perPerson('30.00'), perDeparture('400.00')];

    expect(derivedCostPrice(items, 0)).toBe('30.00');
    expect(derivedCostPrice(items, -5)).toBe('30.00');
  });

  it('số tiền thiếu chữ số lẻ vẫn cộng đúng cent', () => {
    // Chặn một bản lỡ tay dùng parseFloat/Number: 12.5 + 7 phải là 19.50.
    expect(perPersonTotal([perPerson('12.5'), perPerson('7')])).toBe('19.50');
  });
});
