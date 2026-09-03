import { calendarDate } from './calendar-date.js';

describe('calendarDate', () => {
  it('cột DATE (nửa đêm UTC) → "YYYY-MM-DD" theo UTC, không lùi ngày theo múi giờ máy', () => {
    expect(calendarDate(new Date('2026-12-24T00:00:00.000Z'))).toBe('2026-12-24');
    expect(calendarDate(new Date('2026-01-01T23:59:59.000Z'))).toBe('2026-01-01');
  });
});
