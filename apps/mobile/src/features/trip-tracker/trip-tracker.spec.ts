import {
  addDays,
  bookingProgressPercent,
  currentTripDay,
  daysBetween,
  itineraryCalendarDate,
  packingChecklistItems,
  timedStopStates,
  tripLoadState,
  tripPhase,
  vietnamTimeOfDay,
  visibleIncluded,
  whatToBringLines,
} from './trip-tracker';

describe('daysBetween / addDays', () => {
  it('số ngày lịch giữa hai mốc', () => {
    expect(daysBetween('2026-10-01', '2026-10-05')).toBe(4);
    expect(daysBetween('2026-10-05', '2026-10-01')).toBe(-4);
    expect(daysBetween('2026-10-01', '2026-10-01')).toBe(0);
  });

  it('cộng ngày', () => {
    expect(addDays('2026-10-01', 4)).toBe('2026-10-05');
    expect(addDays('2026-10-01', 0)).toBe('2026-10-01');
  });
});

describe('tripPhase', () => {
  const start = '2026-10-10';
  const end = '2026-10-13';

  it('còn > 3 ngày thì upcoming', () => {
    expect(tripPhase('2026-10-01', start, end)).toBe('upcoming');
    expect(tripPhase('2026-10-06', start, end)).toBe('upcoming');
  });

  it('còn ≤ 3 ngày thì imminent', () => {
    expect(tripPhase('2026-10-07', start, end)).toBe('imminent');
    expect(tripPhase('2026-10-09', start, end)).toBe('imminent');
  });

  it('trong khoảng đi–về (cả hai đầu mút) thì onTour', () => {
    expect(tripPhase('2026-10-10', start, end)).toBe('onTour');
    expect(tripPhase('2026-10-12', start, end)).toBe('onTour');
    expect(tripPhase('2026-10-13', start, end)).toBe('onTour');
  });

  it('qua departureEndDate thì ended', () => {
    expect(tripPhase('2026-10-14', start, end)).toBe('ended');
  });
});

describe('currentTripDay', () => {
  it('ngày đầu = 1, ngày cuối = durationDays', () => {
    expect(currentTripDay('2026-10-10', '2026-10-10', 4)).toBe(1);
    expect(currentTripDay('2026-10-13', '2026-10-10', 4)).toBe(4);
  });

  it('kẹp trong [1, durationDays] dù today lệch ngoài khoảng', () => {
    expect(currentTripDay('2026-10-01', '2026-10-10', 4)).toBe(1);
    expect(currentTripDay('2026-10-20', '2026-10-10', 4)).toBe(4);
  });
});

describe('bookingProgressPercent', () => {
  it('ngay lúc đặt = 0%, đúng ngày khởi hành = 100%', () => {
    expect(bookingProgressPercent('2026-09-21', '2026-09-21', '2026-10-03')).toBe(0);
    expect(bookingProgressPercent('2026-10-03', '2026-09-21', '2026-10-03')).toBe(100);
  });

  it('giữa đường ra số tròn, kẹp không vượt 100', () => {
    expect(bookingProgressPercent('2026-09-23', '2026-09-21', '2026-10-03')).toBe(17);
    expect(bookingProgressPercent('2026-10-10', '2026-09-21', '2026-10-03')).toBe(100);
  });

  it('createdDate === startDate (đặt đúng ngày đi) thì 100%, không chia 0', () => {
    expect(bookingProgressPercent('2026-10-03', '2026-10-03', '2026-10-03')).toBe(100);
  });
});

describe('itineraryCalendarDate', () => {
  it('ngày 1 = departureStartDate, ngày N = start + (N-1)', () => {
    expect(itineraryCalendarDate('2026-10-03', 1)).toBe('2026-10-03');
    expect(itineraryCalendarDate('2026-10-03', 4)).toBe('2026-10-06');
  });
});

describe('whatToBringLines', () => {
  it('chẻ policy body theo dòng, bỏ dòng rỗng', () => {
    expect(whatToBringLines('ID or passport\n\nModest dress\n')).toEqual([
      'ID or passport',
      'Modest dress',
    ]);
  });

  it('vắng policy GENERAL (undefined) thì rỗng', () => {
    expect(whatToBringLines(undefined)).toEqual([]);
  });
});

describe('packingChecklistItems', () => {
  it('ghép toàn bộ dòng policy + 2 dòng đầu excluded', () => {
    expect(
      packingChecklistItems('ID or passport\nModest dress', [
        'Travel insurance',
        'Tips',
        'International flights',
      ]),
    ).toEqual(['ID or passport', 'Modest dress', 'Travel insurance', 'Tips']);
  });
});

describe('vietnamTimeOfDay', () => {
  it('quy giờ UTC về giờ Việt Nam (UTC+7)', () => {
    // 03:00 UTC = 10:00 giờ Việt Nam.
    expect(vietnamTimeOfDay(new Date('2026-10-04T03:00:00.000Z'))).toBe('10:00');
  });
});

describe('timedStopStates', () => {
  const times = ['08:00', '09:00', '11:00', '12:30', '19:00'];

  it('bây giờ giữa 11:00 và 12:30 — hai mốc đầu done, 11:00 active, còn lại upcoming', () => {
    expect(timedStopStates(times, '11:45')).toEqual([
      'done',
      'done',
      'active',
      'upcoming',
      'upcoming',
    ]);
  });

  it('chưa tới mốc đầu tiên — không mốc nào active', () => {
    expect(timedStopStates(times, '07:00')).toEqual([
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('qua mốc cuối — mốc cuối active, không có upcoming', () => {
    expect(timedStopStates(times, '20:00')).toEqual(['done', 'done', 'done', 'done', 'active']);
  });

  it('đúng giờ một mốc thì mốc đó active (biên ≤, không phải <)', () => {
    expect(timedStopStates(times, '11:00')).toEqual([
      'done',
      'done',
      'active',
      'upcoming',
      'upcoming',
    ]);
  });
});

describe('visibleIncluded', () => {
  it('ít hơn trần thì hiện hết, hiddenCount = 0', () => {
    expect(visibleIncluded(['a', 'b'])).toEqual({ visible: ['a', 'b'], hiddenCount: 0 });
  });

  it('nhiều hơn trần thì cắt 3 + đếm phần ẩn', () => {
    expect(visibleIncluded(['a', 'b', 'c', 'd', 'e'])).toEqual({
      visible: ['a', 'b', 'c'],
      hiddenCount: 2,
    });
  });
});

describe('tripLoadState', () => {
  const idle = { detailPending: false, detailError: false, tourPending: false, tourError: false };

  it('byCode lỗi lần đầu: query tour tắt nên pending mãi — vẫn phải ra error, không kẹt loading', () => {
    expect(tripLoadState({ ...idle, detailError: true, tourPending: true })).toBe('error');
  });

  it('tour lỗi → error', () => {
    expect(tripLoadState({ ...idle, tourError: true })).toBe('error');
  });

  it('đang tải → loading', () => {
    expect(tripLoadState({ ...idle, detailPending: true, tourPending: true })).toBe('loading');
  });

  it('xong cả hai → ready', () => {
    expect(tripLoadState(idle)).toBe('ready');
  });
});
