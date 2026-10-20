import {
  departureStrikePrice,
  formatDepartureDate,
  formatDepartureMonth,
  formatDepartureRange,
  formatFullDate,
  groupDeparturesByMonth,
  isDepartureOpen,
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

  it('mốc thời gian ISO: in ngày lịch Việt Nam', () => {
    expect(formatFullDate('2026-09-21T10:15:00.000Z')).toBe('21 Sep 2026');
  });

  // M3-10: 18:30 UTC ngày 20 là 01:30 sáng 21 giờ Việt Nam — cắt 10 ký tự đầu
  // (ngày UTC) là in lùi một ngày so với web (`vietnamDay`).
  it('mốc thời gian từ 00:00 tới 07:00 giờ Việt Nam không lùi về hôm trước', () => {
    expect(formatFullDate('2026-09-20T18:30:00.000Z')).toBe('21 Sep 2026');
  });

  it('cuối năm theo giờ Việt Nam sang năm mới', () => {
    expect(formatFullDate('2026-12-31T17:00:00.000Z')).toBe('1 Jan 2027');
  });
});

describe('isDepartureOpen', () => {
  it('còn hạn đặt và còn chỗ: chọn được', () => {
    expect(isDepartureOpen({ bookable: true, seatsLeft: 1 })).toBe(true);
  });

  // `bookable` của API chỉ nói còn hạn đặt; đợt đã kín vẫn `bookable: true`.
  it('còn hạn đặt nhưng hết chỗ: không chọn được', () => {
    expect(isDepartureOpen({ bookable: true, seatsLeft: 0 })).toBe(false);
  });

  it('qua hạn đặt: không chọn được dù còn chỗ', () => {
    expect(isDepartureOpen({ bookable: false, seatsLeft: 5 })).toBe(false);
  });
});

describe('departureStrikePrice', () => {
  it('đợt giảm giá dưới giá gốc, không neo riêng: gạch giá gốc', () => {
    expect(departureStrikePrice({ price: '80.00', basePrice: '100.00', anchor: null })).toBe(
      '100.00',
    );
  });

  it('đợt đúng giá gốc, không neo: không gạch', () => {
    expect(departureStrikePrice({ price: '100.00', basePrice: '100.00', anchor: null })).toBeNull();
  });

  // Đợt khuyến mãi của seed (neo = giá gốc) bị admin nâng giá lên trên neo:
  // gạch neo thấp hơn giá trả là in một "khuyến mãi" ngược.
  it('neo không cao hơn giá trả: không gạch', () => {
    expect(
      departureStrikePrice({ price: '120.00', basePrice: '100.00', anchor: '100.00' }),
    ).toBeNull();
  });

  it('neo riêng cao hơn giá gốc: gạch số cao nhất', () => {
    expect(departureStrikePrice({ price: '80.00', basePrice: '100.00', anchor: '150.00' })).toBe(
      '150.00',
    );
  });

  it('giá gốc cao hơn neo: vẫn gạch giá gốc', () => {
    expect(departureStrikePrice({ price: '80.00', basePrice: '100.00', anchor: '90.00' })).toBe(
      '100.00',
    );
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
