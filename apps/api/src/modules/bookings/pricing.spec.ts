import { Prisma } from '../../generated/prisma/client.js';
import { effectiveUnitPrice, totalAmount } from './pricing.js';

const d = (value: string) => new Prisma.Decimal(value);

describe('effectiveUnitPrice', () => {
  it('uses the departure priceOverride when set', () => {
    expect(effectiveUnitPrice(d('39.00'), d('59.00')).toString()).toBe('59');
  });

  it('falls back to the tour basePrice when the override is null', () => {
    expect(effectiveUnitPrice(d('39.00'), null).toString()).toBe('39');
  });

  it('an override of 0 is a real price, not a missing one', () => {
    expect(effectiveUnitPrice(d('39.00'), d('0')).toString()).toBe('0');
  });
});

describe('totalAmount', () => {
  it('multiplies unit price by seat count on Decimal (never floats)', () => {
    expect(totalAmount(d('39.00'), 3).toFixed(2)).toBe('117.00');
    expect(totalAmount(d('59.99'), 2).toFixed(2)).toBe('119.98');
  });

  it('survives the classic float trap (0.1 + 0.2 territory)', () => {
    // 19.99 * 3 = 59.97 chính xác trên Decimal; trên IEEE754 lại là 59.970000000000006.
    expect(totalAmount(d('19.99'), 3).toString()).toBe('59.97');
  });

  it('rounds to 2 decimal places, half up (DB column is Decimal(14,2))', () => {
    // Unit price dưới một cent không thể đến từ DB của ta (14,2) nhưng helper
    // vẫn phải cho ra 2dp với mọi caller.
    expect(totalAmount(d('10.005'), 1).toFixed(2)).toBe('10.01');
    expect(totalAmount(d('33.335'), 3).toFixed(2)).toBe('100.01'); // 100.005 → làm tròn half-up
    expect(totalAmount(d('0.004'), 1).toFixed(2)).toBe('0.00');
  });

  it('zero seats yields zero (defensive — schema forbids it upstream)', () => {
    expect(totalAmount(d('39.00'), 0).toFixed(2)).toBe('0.00');
  });
});
