import { dateNames } from './date-names.js';

describe('dateNames', () => {
  it('tháng xếp theo `getUTCMonth()`: phần tử 0 là tháng 1, phần tử 11 là tháng 12', () => {
    expect(dateNames.monthShort).toHaveLength(12);
    expect(dateNames.monthShort[new Date(Date.UTC(2026, 0, 15)).getUTCMonth()]).toBe('Jan');
    expect(dateNames.monthShort[new Date(Date.UTC(2026, 8, 14)).getUTCMonth()]).toBe('Sep');
    expect(dateNames.monthShort[11]).toBe('Dec');
  });

  it('thứ xếp theo `getUTCDay()`: phần tử 0 là Chủ nhật', () => {
    expect(dateNames.weekdayShort).toHaveLength(7);
    // 14/09/2026 là thứ Hai, 13/09/2026 là Chủ nhật.
    expect(dateNames.weekdayShort[new Date(Date.UTC(2026, 8, 14)).getUTCDay()]).toBe('Mon');
    expect(dateNames.weekdayShort[new Date(Date.UTC(2026, 8, 13)).getUTCDay()]).toBe('Sun');
  });
});
