import {
  formatDepartureDate,
  formatDepartureMonth,
  formatDepartureRange,
  formatFullDate,
  groupDeparturesByMonth,
} from './departures';

describe('formatDepartureDate', () => {
  it('"Sat 26 Sep" — thứ + ngày + tháng viết tắt, không năm', () => {
    expect(formatDepartureDate('2026-09-26')).toBe('Sat 26 Sep');
  });
});

describe('formatDepartureRange', () => {
  it('cùng tháng: chỉ in tháng ở ngày cuối', () => {
    expect(formatDepartureRange('2026-09-23', '2026-09-26')).toBe('Wed 23 – Sat 26 Sep');
  });

  it('khác tháng: in tháng ở CẢ hai đầu', () => {
    expect(formatDepartureRange('2026-09-29', '2026-10-02')).toBe('Tue 29 Sep – Fri 2 Oct');
  });
});

describe('formatDepartureMonth', () => {
  it('"September 2026" — tên tháng đầy đủ + năm', () => {
    expect(formatDepartureMonth('2026-09-23')).toBe('September 2026');
  });
});

describe('formatFullDate', () => {
  it('"21 Sep 2026" — ngày + tháng viết tắt + năm, không thứ', () => {
    expect(formatFullDate('2026-09-21')).toBe('21 Sep 2026');
  });

  it('chuỗi ISO datetime — chỉ đọc 10 ký tự đầu', () => {
    expect(formatFullDate('2026-09-21T10:15:00.000Z')).toBe('21 Sep 2026');
  });
});

describe('groupDeparturesByMonth', () => {
  const departures = [
    { startDate: '2026-09-23' },
    { startDate: '2026-10-03' },
    { startDate: '2026-10-10' },
    { startDate: '2026-10-17' },
  ];

  it('gom đúng nhóm, giữ nguyên thứ tự API trả', () => {
    expect(groupDeparturesByMonth(departures)).toEqual([
      { monthLabel: 'September 2026', departures: [departures[0]] },
      { monthLabel: 'October 2026', departures: [departures[1], departures[2], departures[3]] },
    ]);
  });

  it('rỗng: mảng rỗng', () => {
    expect(groupDeparturesByMonth([])).toEqual([]);
  });
});
