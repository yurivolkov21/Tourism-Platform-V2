import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { costItemsOf } from './tour-cost-items.js';

describe('costItemsOf', () => {
  it('đổi Decimal ra chuỗi ĐỦ hai chữ số lẻ và giữ nguyên cách tính', () => {
    const rows = [
      { amount: new Prisma.Decimal('12.5'), basis: 'PER_PERSON' as const },
      { amount: new Prisma.Decimal('400'), basis: 'PER_DEPARTURE' as const },
    ];

    expect(costItemsOf(rows)).toEqual([
      { amount: '12.50', basis: 'PER_PERSON' },
      { amount: '400.00', basis: 'PER_DEPARTURE' },
    ]);
  });
});
