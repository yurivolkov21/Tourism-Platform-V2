import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  mrzCheckDigit,
  mrzLines,
  pageStamps,
  passportNo,
  passportStats,
  unstampedNames,
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

describe('pageStamps', () => {
  // Trang visa mở (vòng 11/08 tối): tem đóng theo TỪNG CHUYẾN — đi lại một
  // nơi là THÊM dấu mới, không làm mới dấu cũ (trả lời thẳng câu hỏi user).
  it('mỗi chuyến đã đi MỘT tem theo thứ tự thời gian; đi lại cùng nơi → HAI tem khác tháng', () => {
    const stamps = pageStamps(
      [
        doneTrip(), // Hạ Long, kết thúc 23/07
        doneTrip({
          code: 'BK-DONEBBBB',
          departureStartDate: '2026-05-01',
          departureEndDate: '2026-05-02',
        }), // Hạ Long lần TRƯỚC — tháng 5
      ],
      TODAY,
    );
    expect(stamps).toHaveLength(2);
    expect(stamps[0]?.label).toBe('HẠ LONG BAY');
    expect(stamps[0]?.month).toBe('May 2026');
    expect(stamps[1]?.label).toBe('HẠ LONG BAY');
    expect(stamps[1]?.month).toBe('Jul 2026');
    // Hai lần đóng KHÁC khoá render — không đè nhau.
    expect(stamps[0]?.key).not.toBe(stamps[1]?.key);
  });

  it('chuyến còn phía trước (PAID/PENDING) → dấu ghost viền đứt đứng CUỐI, CANCELLED bỏ qua', () => {
    const stamps = pageStamps(
      [
        doneTrip(),
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
        }),
      ],
      TODAY,
    );
    expect(stamps).toHaveLength(3);
    expect(stamps[0]?.ghost).toBeUndefined();
    expect(stamps[1]?.label).toBe('HỘI AN');
    expect(stamps[1]?.ghost).toBe(true);
    expect(stamps[2]?.label).toBe('SA PA');
    expect(stamps[2]?.ghost).toBe(true);
  });

  it('PARTIALLY_REFUNDED đã kết thúc vẫn có tem — một luật đã-đi với stats', () => {
    const stamps = pageStamps([doneTrip({ status: 'PARTIALLY_REFUNDED' })], TODAY);
    expect(stamps).toHaveLength(1);
    expect(stamps[0]?.ghost).toBeUndefined();
  });

  it('dáng tem deterministic từ mã booking, các biến trong biên: shape 3 loại, xoay [−9,9], size/mực/drift hợp lệ', () => {
    const one = pageStamps([doneTrip()], TODAY);
    const two = pageStamps([doneTrip()], TODAY);
    expect(one).toEqual(two);
    const s = one[0];
    expect(s && ['round', 'square', 'oval'].includes(s.shape)).toBe(true);
    expect(s && s.rotationDeg >= -9 && s.rotationDeg <= 9).toBe(true);
    expect(s && ['sm', 'md', 'lg'].includes(s.size)).toBe(true);
    expect(s && [0, 1, 2].includes(s.ink)).toBe(true);
    expect(s && s.driftY >= 0 && s.driftY <= 3).toBe(true);
  });

  it('tour không gắn destination → nhãn rơi về 2 từ đầu tourTitle UPPERCASE', () => {
    const stamps = pageStamps(
      [doneTrip({ tourDestinations: [], tourTitle: 'Mekong Delta Day Cruise' })],
      TODAY,
    );
    expect(stamps[0]?.label).toBe('MEKONG DELTA');
  });
});

describe('unstampedNames', () => {
  it('trả tên các destination CHƯA từng đi, theo thứ tự miền bắc→trung→nam→other', () => {
    const names = unstampedNames(
      [
        { slug: 'can-tho', name: 'Cần Thơ', region: 'Southern Vietnam' },
        { slug: 'ha-long-bay', name: 'Hạ Long Bay', region: 'Northern Vietnam' },
        { slug: 'hoi-an', name: 'Hội An', region: 'Central Vietnam' },
        { slug: 'noi-la', name: 'Nơi Lạ', region: null },
      ],
      [doneTrip()], // đã đi ha-long-bay
      TODAY,
    );
    expect(names).toEqual(['Hội An', 'Cần Thơ', 'Nơi Lạ']);
  });

  it('chuyến sắp tới CHƯA tính là đã đi — nơi đó vẫn nằm trong danh sách chưa đóng', () => {
    const names = unstampedNames(
      [{ slug: 'hoi-an', name: 'Hội An', region: 'Central Vietnam' }],
      [
        makeBooking({
          code: 'BK-FUTUREAA',
          departureStartDate: '2026-09-01',
          departureEndDate: '2026-09-03',
          tourDestinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
        }),
      ],
      TODAY,
    );
    expect(names).toEqual(['Hội An']);
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

// `stampSlots` (lưới ô đều) đã nghỉ hưu sau một vòng — user chê "chia ô xếp
// hàng tầm thường"; thay bằng `pageStamps` + `unstampedNames` phía trên
// (trang visa mở, tem theo TỪNG CHUYẾN).
