import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { mrzCheckDigit, mrzLines, passportNo, passportStats, stampSlots } from './passport';

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

describe('stampSlots', () => {
  // Bộ sưu tập tem hợp nhất (addendum §7 — thay passportStamps + mapDots):
  // mỗi destination catalog một Ô, trạng thái theo booking của user.
  const CATALOG = [
    { slug: 'ha-long-bay', name: 'Hạ Long Bay', region: 'Northern Vietnam' },
    { slug: 'sa-pa', name: 'Sa Pa', region: 'Northern Vietnam' },
    { slug: 'hoi-an', name: 'Hội An', region: 'Central Vietnam' },
    { slug: 'can-tho', name: 'Cần Thơ', region: 'Southern Vietnam' },
    { slug: 'noi-la', name: 'Nơi Lạ', region: null },
  ];

  it('stamped = đã đi (kèm tháng), awaiting = chuyến còn phía trước, còn lại unexplored; sort theo miền', () => {
    const slots = stampSlots(
      CATALOG,
      [
        doneTrip(), // ha-long-bay xong 23/07
        makeBooking({
          code: 'BK-FUTUREAA',
          departureStartDate: '2026-09-01',
          departureEndDate: '2026-09-03',
          tourDestinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
        }),
      ],
      TODAY,
    );
    expect(slots).toHaveLength(5);
    // Sort cụm miền bắc→trung→nam→other như bản đồ cũ.
    expect(slots.map((s) => s.slug)).toEqual([
      'ha-long-bay',
      'sa-pa',
      'hoi-an',
      'can-tho',
      'noi-la',
    ]);
    const haLong = slots.find((s) => s.slug === 'ha-long-bay');
    expect(haLong?.state).toBe('stamped');
    expect(haLong?.month).toBe('Jul 2026');
    expect(slots.find((s) => s.slug === 'hoi-an')?.state).toBe('awaiting');
    expect(slots.find((s) => s.slug === 'sa-pa')?.state).toBe('unexplored');
  });

  it('hai chuyến cùng nơi → tháng của chuyến kết thúc MUỘN nhất; đã đến thắng sắp-quay-lại', () => {
    const slots = stampSlots(
      CATALOG,
      [
        doneTrip({
          code: 'BK-DONEBBBB',
          departureStartDate: '2026-05-01',
          departureEndDate: '2026-05-02',
        }),
        doneTrip(), // cùng ha-long-bay, kết thúc 23/07 — muộn hơn
        makeBooking({
          // sắp quay lại ha-long-bay — vẫn stamped, không tụt về awaiting.
          code: 'BK-FUTUREAA',
          departureStartDate: '2026-09-01',
          departureEndDate: '2026-09-03',
        }),
      ],
      TODAY,
    );
    const haLong = slots.find((s) => s.slug === 'ha-long-bay');
    expect(haLong?.state).toBe('stamped');
    expect(haLong?.month).toBe('Jul 2026');
  });

  it('PARTIALLY_REFUNDED đã kết thúc vẫn stamped — MỘT luật với tem/stats cũ', () => {
    const slots = stampSlots(CATALOG, [doneTrip({ status: 'PARTIALLY_REFUNDED' })], TODAY);
    expect(slots.find((s) => s.slug === 'ha-long-bay')?.state).toBe('stamped');
  });

  it('hình/độ xoay deterministic theo SLUG — không đổi khi mã booking đổi', () => {
    const a = stampSlots(CATALOG, [doneTrip()], TODAY).find((s) => s.slug === 'ha-long-bay');
    const b = stampSlots(CATALOG, [doneTrip({ code: 'BK-KHACAAAA' })], TODAY).find(
      (s) => s.slug === 'ha-long-bay',
    );
    expect(a?.shape).toBe(b?.shape);
    expect(a?.rotationDeg).toBe(b?.rotationDeg);
    expect(a && ['round', 'square'].includes(a.shape ?? '')).toBe(true);
    expect(a && (a.rotationDeg ?? 0) >= -7 && (a.rotationDeg ?? 0) <= 7).toBe(true);
  });

  it('không booking nào → toàn bộ unexplored, không ô nào mang month/shape', () => {
    const slots = stampSlots(CATALOG, [], TODAY);
    expect(slots.every((s) => s.state === 'unexplored')).toBe(true);
    expect(slots.every((s) => s.month === undefined)).toBe(true);
  });
});

describe('mrzCheckDigit', () => {
  // Ba vector chính chủ từ worked example của ICAO Doc 9303 Part 3 —
  // trọng số 7-3-1, A=10..Z=35, '<'=0, mod 10.
  it('đúng ba vector mẫu của ICAO 9303', () => {
    expect(mrzCheckDigit('L898902C3')).toBe(6);
    expect(mrzCheckDigit('740812')).toBe(2);
    expect(mrzCheckDigit('120415')).toBe(9);
  });

  it("filler '<' đóng góp 0 — chuỗi toàn filler có check digit 0", () => {
    expect(mrzCheckDigit('<'.repeat(14))).toBe(0);
  });
});

describe('passportNo', () => {
  it('deterministic, đúng format TV + 6 chữ số, khác userId khác số', () => {
    const a = passportNo('user-abc');
    expect(a).toBe(passportNo('user-abc'));
    expect(a).toMatch(/^TV\d{6}$/);
    expect(passportNo('user-khac')).not.toBe(a);
  });
});

describe('mrzLines', () => {
  it('hai dòng đúng 44 ký tự, chỉ [A-Z0-9<], không khoảng trắng', () => {
    const [l1, l2] = mrzLines('Bosco Wong', 'user-abc', 2026);
    expect(l1).toHaveLength(44);
    expect(l2).toHaveLength(44);
    expect(l1).toMatch(/^[A-Z0-9<]{44}$/);
    expect(l2).toMatch(/^[A-Z0-9<]{44}$/);
  });

  it('dòng 1 đúng ngữ pháp TD3: P< + mã TRV + SURNAME<<GIVEN, pad bằng <', () => {
    const [l1] = mrzLines('Bosco Wong', 'user-abc', 2026);
    expect(l1.startsWith('P<TRVWONG<<BOSCO<')).toBe(true);
    expect(l1.endsWith('<')).toBe(true);
  });

  it('dòng 2 mở bằng số hộ chiếu + check digit, các check digit tự nhất quán', () => {
    const [, l2] = mrzLines('Bosco Wong', 'user-abc', 2026);
    const doc = passportNo('user-abc').padEnd(9, '<');
    expect(l2.startsWith(doc)).toBe(true);
    // Check digit của từng trường đứng ngay sau trường đó — tự đối chiếu.
    expect(Number(l2[9])).toBe(mrzCheckDigit(doc));
    expect(l2.slice(10, 13)).toBe('TRV');
    const issue = l2.slice(13, 19);
    expect(Number(l2[19])).toBe(mrzCheckDigit(issue));
    expect(issue.startsWith('26')).toBe(true); // sinceYear 2026 → YYMMDD
    const expiry = l2.slice(21, 27);
    expect(Number(l2[27])).toBe(mrzCheckDigit(expiry));
    // Composite check digit cuối cùng: tính trên docNo+check + issue+check +
    // expiry+check + optional+check — đúng các vị trí TD3 quy định.
    const composite = l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43);
    expect(Number(l2[43])).toBe(mrzCheckDigit(composite));
  });

  it('tên có dấu/tên là email: fold ASCII, ký tự ngoài A-Z thành <, không vỡ 44', () => {
    const [l1] = mrzLines('Nguyễn Thị Minh Khai Đặng Trần', 'user-abc', 2026);
    expect(l1).toHaveLength(44);
    expect(l1).toMatch(/^[A-Z0-9<]{44}$/);
    expect(l1).toContain('TRAN<<NGUYEN');
    const [e1] = mrzLines('demo-178@tourism.test', 'user-abc', 2026);
    expect(e1).toHaveLength(44);
    expect(e1).toMatch(/^P<TRV[A-Z<]+$/); // @, chấm, số trong tên đều thành <
  });
});

// `journeySlugs`/`mapDots`/`passportStamps` đã nghỉ hưu cùng bản đồ chấm +
// dãy tem rời (addendum §7) — vai trò gộp vào `stampSlots` phía trên.

describe('stampSlots — PENDING/CANCELLED', () => {
  it('PENDING tương lai vẫn awaiting; CANCELLED không tạo trạng thái nào', () => {
    const slots = stampSlots(
      [
        { slug: 'sa-pa', name: 'Sa Pa', region: 'Northern Vietnam' },
        { slug: 'can-tho', name: 'Cần Thơ', region: 'Southern Vietnam' },
      ],
      [
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
    expect(slots.find((s) => s.slug === 'sa-pa')?.state).toBe('awaiting');
    expect(slots.find((s) => s.slug === 'can-tho')?.state).toBe('unexplored');
  });
});
