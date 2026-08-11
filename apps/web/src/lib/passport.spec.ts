import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  journeySlugs,
  mapDots,
  memberNumber,
  mrzLine,
  passportStamps,
  passportStats,
} from './passport';

// Mốc "hôm nay" cố định cho mọi ca — hàm nhận tham số today (chuỗi
// `YYYY-MM-DD`, so lexicographic như `account-stats.ts`) nên không cần fake
// timer; 15/08/2026 nằm giữa mùa fixture (chuyến tháng 7 đã qua, tháng 9 chưa).
const TODAY = '2026-08-15';

/** Booking PAID đã đi xong trước TODAY — nguyên liệu chuẩn cho tem/stats. */
const doneTrip = (over: Partial<Parameters<typeof makeBooking>[0]> = {}) =>
  makeBooking({
    code: 'BK-DONEAAAA',
    departureStartDate: '2026-07-21',
    departureEndDate: '2026-07-23',
    ...over,
  });

describe('passportStats', () => {
  it('đếm chuyến hoàn thành, places distinct, % catalog và ngày trên đường', () => {
    const bookings = [
      doneTrip(), // Hạ Long Bay (fixture mặc định), 3 ngày
      doneTrip({
        code: 'BK-DONEBBBB',
        departureStartDate: '2026-06-01',
        departureEndDate: '2026-06-01',
        tourDestinations: [
          { slug: 'hoi-an', name: 'Hội An', isPrimary: true },
          // Trùng Hạ Long với chuyến trên — places phải distinct theo slug.
          { slug: 'ha-long-bay', name: 'Hạ Long Bay', isPrimary: false },
        ],
      }),
      // PAID nhưng CHƯA đi — không tính trips/places/days.
      makeBooking({
        code: 'BK-FUTUREAA',
        departureStartDate: '2026-09-01',
        departureEndDate: '2026-09-03',
      }),
      // PENDING quá khứ — chưa trả tiền thì không phải chuyến đã đi.
      makeBooking({
        code: 'BK-PENDPAST',
        status: 'PENDING',
        departureStartDate: '2026-07-01',
        departureEndDate: '2026-07-02',
      }),
    ];
    const stats = passportStats(bookings, 19, TODAY);
    expect(stats.trips).toBe(2);
    expect(stats.places).toBe(2); // ha-long-bay + hoi-an, distinct
    // 2/19 = 10.5% → floor 10
    expect(stats.exploredPct).toBe(10);
    expect(stats.daysOnRoad).toBe(4); // 3 ngày + 1 ngày
  });

  it('REFUNDED không tính là chuyến đã đi (tiền đã hoàn thì không đóng tem)', () => {
    const stats = passportStats([doneTrip({ status: 'REFUNDED' })], 19, TODAY);
    expect(stats.trips).toBe(0);
    expect(stats.places).toBe(0);
    expect(stats.daysOnRoad).toBe(0);
  });

  it('0 chuyến → exploredPct 0; có chuyến nhưng tỉ lệ nhỏ → tối thiểu 1', () => {
    expect(passportStats([], 19, TODAY).exploredPct).toBe(0);
    // 1/200 = 0.5% → floor 0 nhưng đã có chuyến → kẹp sàn 1.
    expect(passportStats([doneTrip()], 200, TODAY).exploredPct).toBe(1);
  });

  // Biên đóng (fix 11/08): chuyến kết thúc ĐÚNG HÔM NAY chưa "xong" — so
  // CHUỖI ngày UTC (như `account-stats.ts`) nên tránh được lệch giờ-trong-
  // ngày mà so `Date` object cũ mắc phải.
  it('kết thúc ĐÚNG HÔM NAY chưa tính là chuyến đã đi (biên đóng)', () => {
    const stats = passportStats(
      [doneTrip({ departureStartDate: '2026-08-13', departureEndDate: '2026-08-15' })],
      19,
      TODAY,
    );
    expect(stats.trips).toBe(0);
  });

  // RED trước fix 11/08 (controller chốt): PARTIALLY_REFUNDED = đi thật rồi
  // mới hoàn MỘT PHẦN — có tem, khác REFUNDED toàn phần (test ở trên, loại).
  it('PARTIALLY_REFUNDED đã kết thúc vẫn tính là chuyến đã đi (đi thật rồi mới hoàn một phần)', () => {
    const stats = passportStats([doneTrip({ status: 'PARTIALLY_REFUNDED' })], 19, TODAY);
    expect(stats.trips).toBe(1);
    expect(stats.places).toBe(1);
  });
});

describe('passportStamps', () => {
  it('mỗi chuyến hoàn thành một tem nhãn destination primary, sort theo endDate, ghost cuối', () => {
    const stamps = passportStamps(
      [
        doneTrip({
          code: 'BK-DONEBBBB',
          departureStartDate: '2026-06-01',
          departureEndDate: '2026-06-01',
          tourDestinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
        }),
        doneTrip(), // end 23/07 — đứng SAU chuyến tháng 6
      ],
      TODAY,
    );
    expect(stamps).toHaveLength(3); // 2 tem thật + 1 ghost
    expect(stamps[0]?.label).toBe('HỘI AN');
    expect(stamps[0]?.month).toBe('Jun 2026');
    expect(stamps[1]?.label).toBe('HẠ LONG BAY');
    expect(stamps[2]?.ghost).toBe(true);
  });

  it('deterministic từ booking.code — cùng input cùng output, khác code có thể khác thế', () => {
    const one = passportStamps([doneTrip()], TODAY);
    const two = passportStamps([doneTrip()], TODAY);
    expect(one).toEqual(two);
    const s = one[0];
    expect(s && s.rotationDeg >= -7 && s.rotationDeg <= 7).toBe(true);
    expect(s && ['round', 'square'].includes(s.shape)).toBe(true);
  });

  it('tour không gắn destination → nhãn rơi về 2 từ đầu tourTitle UPPERCASE', () => {
    const stamps = passportStamps(
      [doneTrip({ tourDestinations: [], tourTitle: 'Mekong Delta Day Cruise' })],
      TODAY,
    );
    expect(stamps[0]?.label).toBe('MEKONG DELTA');
  });

  it('0 chuyến hoàn thành → chỉ còn tem ghost', () => {
    const stamps = passportStamps([], TODAY);
    expect(stamps).toHaveLength(1);
    expect(stamps[0]?.ghost).toBe(true);
  });
});

describe('memberNumber + mrzLine', () => {
  it('memberNumber deterministic, đúng format NO. XXX XXX', () => {
    const a = memberNumber('user-abc');
    expect(a).toBe(memberNumber('user-abc'));
    expect(a).toMatch(/^NO\. \d{3} \d{3}$/);
    expect(memberNumber('user-khac')).not.toBe(a);
  });

  it('mrzLine đúng 44 ký tự, uppercase, bỏ dấu tiếng Việt, pad bằng <', () => {
    const line = mrzLine('Bosco Wong', 'NO. 214 306', 2026);
    expect(line).toHaveLength(44);
    expect(line).toBe(line.toUpperCase());
    expect(line.startsWith('P<TOURISM<<WONG<<BOSCO')).toBe(true);
    expect(line).toContain('214306');
    expect(line).toContain('2026');
    // Tên có dấu + quá dài: không vỡ 44 ký tự, không còn ký tự có dấu.
    const long = mrzLine('Nguyễn Thị Minh Khai Đặng Trần', 'NO. 000 001', 2026);
    expect(long).toHaveLength(44);
    expect(long).not.toMatch(/[ỄĐẶẦỊ]/);
  });
});

describe('journeySlugs', () => {
  it('visited = chuyến xong; upcoming = PAID/PENDING chưa kết thúc; CANCELLED bỏ qua', () => {
    const { visited, upcoming } = journeySlugs(
      [
        doneTrip(), // xong → visited ha-long-bay
        makeBooking({
          code: 'BK-FUTUREAA',
          departureStartDate: '2026-09-01',
          departureEndDate: '2026-09-03',
          tourDestinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
        }),
        makeBooking({
          code: 'BK-PENDFUTU',
          status: 'PENDING',
          departureStartDate: '2026-09-10',
          departureEndDate: '2026-09-11',
          tourDestinations: [{ slug: 'sa-pa', name: 'Sa Pa', isPrimary: true }],
        }),
        makeBooking({
          code: 'BK-CANCELAA',
          status: 'CANCELLED',
          departureStartDate: '2026-09-20',
          departureEndDate: '2026-09-21',
          tourDestinations: [{ slug: 'can-tho', name: 'Cần Thơ', isPrimary: true }],
        }),
      ],
      TODAY,
    );
    expect(visited).toEqual(['ha-long-bay']);
    expect(upcoming.sort()).toEqual(['hoi-an', 'sa-pa']);
  });
});

describe('mapDots', () => {
  const catalog = [
    { slug: 'ha-long-bay', name: 'Hạ Long Bay', region: 'Northern Vietnam' },
    { slug: 'sa-pa', name: 'Sa Pa', region: 'Northern Vietnam' },
    { slug: 'hoi-an', name: 'Hội An', region: 'Central Vietnam' },
    { slug: 'can-tho', name: 'Cần Thơ', region: 'Southern Vietnam' },
    { slug: 'noi-la', name: 'Nơi Lạ', region: null },
  ];

  it('mỗi destination một dot, cluster sort bắc→trung→nam→other, cờ visited/upcoming đúng', () => {
    const dots = mapDots(catalog, ['hoi-an'], ['can-tho']);
    expect(dots).toHaveLength(5);
    // Sort theo cụm miền: 2 bắc, rồi trung, nam, other.
    expect(dots.map((d) => d.region)).toEqual(['north', 'north', 'central', 'south', 'other']);
    expect(dots.find((d) => d.name === 'Hội An')?.visited).toBe(true);
    expect(dots.find((d) => d.name === 'Cần Thơ')?.upcoming).toBe(true);
    expect(dots.find((d) => d.name === 'Sa Pa')?.visited).toBe(false);
  });

  it('visited thắng upcoming khi một nơi có cả hai', () => {
    const dots = mapDots(catalog, ['hoi-an'], ['hoi-an']);
    const hoiAn = dots.find((d) => d.name === 'Hội An');
    expect(hoiAn?.visited).toBe(true);
    expect(hoiAn?.upcoming).toBe(false);
  });
});
