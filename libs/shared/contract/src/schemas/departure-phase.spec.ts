import {
  DEPARTURE_PHASE_FILTER_GROUPS,
  DeparturePhaseFilterSchema,
  DeparturePhaseSchema,
  departurePhase,
} from './departure-phase.js';

/**
 * Giai đoạn của chuyến (spec F16, ADR-0046) — hàm thuần duy nhất quyết định
 * nhãn vòng đời mà màn admin in ra và tab lọc gom theo.
 *
 * Bộ này canh ĐÚNG từng mốc biên: đảo thứ tự hai luật hay lệch một dấu so sánh
 * đều cho ra một bảng trông hợp lý mà sai đúng vào ngày người vận hành cần.
 * Nửa đêm Việt Nam là 17:00 UTC hôm trước.
 */

/** Chuyến 5 ngày 10/10 → 14/10: N = 7, hạn chót 03/10. */
const TRIP = { startDate: '2026-10-10', endDate: '2026-10-14' } as const;

describe('departurePhase — chuyến OPEN đi qua từng mốc', () => {
  it.each([
    ['2026-10-03T16:59:59.999Z', 'on-sale', '23:59 ngày hạn chót — vẫn còn bán'],
    ['2026-10-03T17:00:00.000Z', 'deadline-passed', '00:00 ngày sau hạn chót'],
    ['2026-10-09T16:59:59.999Z', 'deadline-passed', '23:59 hôm trước ngày đi'],
    ['2026-10-09T17:00:00.000Z', 'departed', '00:00 ngày đi — đã tính là đi'],
    ['2026-10-14T16:59:59.999Z', 'departed', '23:59 ngày về — vẫn đang đi'],
    ['2026-10-14T17:00:00.000Z', 'completed', '00:00 ngày sau ngày về'],
  ] as const)('%s → %s (%s)', (now, expected, _why) => {
    // Giết: lật dấu luật 5 · `>` ở vế ngày đi · `>=` ở luật 2 · đảo luật 2 và 3.
    expect(departurePhase({ status: 'OPEN', ...TRIP, now: new Date(now) })).toBe(expected);
  });
});

describe('departurePhase — công tắc CLOSED chỉ thắng ở chuyến CHƯA đi', () => {
  it.each([
    ['2026-10-01T05:00:00.000Z', 'closed', 'còn hạn'],
    ['2026-10-05T05:00:00.000Z', 'closed', 'quá hạn chót — Closed thắng Deadline passed'],
    ['2026-10-10T05:00:00.000Z', 'departed', 'ngày đi — Departed thắng Closed'],
    ['2026-10-20T05:00:00.000Z', 'completed', 'đã về'],
  ] as const)('%s → %s (%s)', (now, expected, _why) => {
    // Giết: bỏ luật 4 · đưa luật 4 lên trên luật 3 · đưa luật 4 xuống dưới luật 5.
    expect(departurePhase({ status: 'CLOSED', ...TRIP, now: new Date(now) })).toBe(expected);
  });
});

describe('departurePhase — CANCELLED thắng mọi ngày', () => {
  it.each(['2026-10-01T05:00:00.000Z', '2026-10-12T05:00:00.000Z', '2026-10-20T05:00:00.000Z'])(
    '%s → cancelled',
    (now) => {
      // Giết: bỏ luật 1 · đưa luật 1 xuống dưới luật 2 hoặc 3.
      expect(departurePhase({ status: 'CANCELLED', ...TRIP, now: new Date(now) })).toBe(
        'cancelled',
      );
    },
  );
});

describe('departurePhase — chuyến MỘT ngày', () => {
  /** 10/10 → 10/10: N = 1, hạn chót 09/10. */
  const DAY_TRIP = { startDate: '2026-10-10', endDate: '2026-10-10' } as const;

  it.each([
    ['2026-10-09T05:00:00.000Z', 'on-sale'],
    ['2026-10-10T05:00:00.000Z', 'departed'],
    ['2026-10-11T05:00:00.000Z', 'completed'],
  ] as const)('%s → %s', (now, expected) => {
    expect(departurePhase({ status: 'OPEN', ...DAY_TRIP, now: new Date(now) })).toBe(expected);
  });
});

describe('departurePhase — đầu vào hỏng', () => {
  it('`now` là Invalid Date thì ném RangeError, không đoán bừa một giai đoạn', () => {
    expect(() =>
      departurePhase({ status: 'CANCELLED', ...TRIP, now: new Date('not a date') }),
    ).toThrow(RangeError);
  });
});

describe('DEPARTURE_PHASE_FILTER_GROUPS', () => {
  it('mỗi giai đoạn nằm trong ĐÚNG MỘT tab — không mồ côi, không trùng', () => {
    const placed = DeparturePhaseFilterSchema.options.flatMap(
      (filter) => DEPARTURE_PHASE_FILTER_GROUPS[filter],
    );

    expect([...placed].sort()).toEqual([...DeparturePhaseSchema.options].sort());
  });

  it('Upcoming gom đúng ba giai đoạn chưa đi — tập chuyến còn thao tác được', () => {
    expect(DEPARTURE_PHASE_FILTER_GROUPS.upcoming).toEqual([
      'on-sale',
      'deadline-passed',
      'closed',
    ]);
  });
});
