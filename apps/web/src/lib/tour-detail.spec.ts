import { describe, expect, it } from 'vitest';
import {
  defaultOpenMonth,
  departureMonths,
  galleryThumbs,
  itineraryDayDate,
  itineraryDayState,
  monthDateSpan,
  monthLabel,
  monthNotice,
  monthSeason,
  orderPolicies,
  parseItineraryStops,
  policyEyebrow,
  ratingHistogram,
  reviewRange,
  toggleStarFilter,
  visibleDepartureChips,
} from './tour-detail';

describe('galleryThumbs', () => {
  const media = Array.from({ length: 10 }, (_, i) => ({ publicId: `p${i}` }));
  it('7 là trần: 7×64 + 6×8 = 496 ≤ 541 (cạnh ảnh vuông)', () => {
    const { thumbs, hiddenCount } = galleryThumbs(media);
    expect(thumbs).toHaveLength(7);
    expect(hiddenCount).toBe(3);
  });
  it('ít hơn trần thì không có ảnh ẩn', () => {
    expect(galleryThumbs(media.slice(0, 4)).hiddenCount).toBe(0);
  });
  it('rỗng thì không ném', () => {
    expect(galleryThumbs([])).toEqual({ thumbs: [], hiddenCount: 0 });
  });
});

describe('visibleDepartureChips', () => {
  const deps = [
    { id: 'a', seatsLeft: 6 },
    { id: 'b', seatsLeft: 9 },
    { id: 'c', seatsLeft: 3 },
    { id: 'd', seatsLeft: 0 },
    { id: 'e', seatsLeft: 8 },
    { id: 'f', seatsLeft: 5 },
  ];
  it('chỉ lấy đợt CÒN CHỖ, tối đa 4', () => {
    expect(visibleDepartureChips(deps, 'a').map((d) => d.id)).toEqual(['a', 'b', 'c', 'e']);
  });
  it('đợt đang chọn nằm ngoài 4 ô thì chen vào thay ô cuối', () => {
    // nếu không, panel hiện một đằng còn nút Reserve nói một nẻo
    expect(visibleDepartureChips(deps, 'f').map((d) => d.id)).toEqual(['a', 'b', 'c', 'f']);
  });
  it('đợt đang chọn đã hết chỗ thì KHÔNG chen vào', () => {
    expect(visibleDepartureChips(deps, 'd').map((d) => d.id)).toEqual(['a', 'b', 'c', 'e']);
  });
});

describe('itineraryDayDate', () => {
  it('Day N = ngày khởi hành + (N-1)', () => {
    expect(itineraryDayDate('2026-09-14', 1).toISOString().slice(0, 10)).toBe('2026-09-14');
    expect(itineraryDayDate('2026-09-14', 4).toISOString().slice(0, 10)).toBe('2026-09-17');
  });
  it('nhảy qua ranh giới tháng đúng', () => {
    expect(itineraryDayDate('2026-09-28', 4).toISOString().slice(0, 10)).toBe('2026-10-01');
  });
});

describe('itineraryDayState', () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  it('không có booking thì LUÔN là preview, kể cả khi chuyến đang chạy', () => {
    // khách vãng lai không được thấy tick trên chuyến họ không đi
    expect(itineraryDayState(d('2026-09-14'), d('2026-09-15'), false)).toBe('preview');
  });
  it('có booking: ngày đã qua = done, hôm nay = active, chưa tới = upcoming', () => {
    expect(itineraryDayState(d('2026-09-14'), d('2026-09-15'), true)).toBe('done');
    expect(itineraryDayState(d('2026-09-15'), d('2026-09-15'), true)).toBe('active');
    expect(itineraryDayState(d('2026-09-16'), d('2026-09-15'), true)).toBe('upcoming');
  });
});

describe('departureMonths', () => {
  const deps = [
    { startDate: '2026-09-14', seatsLeft: 6, effectivePrice: '329.00' },
    { startDate: '2026-09-28', seatsLeft: 9, effectivePrice: '329.00' },
    { startDate: '2026-10-12', seatsLeft: 3, effectivePrice: '349.00' },
  ];
  it('gộp theo tháng, cộng ghế, lấy khoảng giá', () => {
    const [sep, oct] = departureMonths(deps);
    expect(sep.items).toHaveLength(2);
    expect(sep.seatsLeft).toBe(15);
    expect(sep.minPrice).toBe(329);
    expect(oct.minPrice).toBe(349);
    expect(oct.maxPrice).toBe(349);
  });
});

describe('ratingHistogram', () => {
  it('phần trăm tính trên TỔNG, không chuẩn hoá theo cột cao nhất', () => {
    const rows = ratingHistogram({ '1': 0, '2': 0, '3': 2, '4': 3, '5': 18 });
    expect(rows[0]).toEqual({ star: 5, count: 18, percent: (18 / 23) * 100 });
    expect(rows.map((r) => r.star)).toEqual([5, 4, 3, 2, 1]);
    expect(rows.reduce((s, r) => s + r.percent, 0)).toBeCloseTo(100);
  });
  it('không review nào thì mọi cột 0%, không chia cho 0', () => {
    const rows = ratingHistogram({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
    expect(rows.every((r) => r.percent === 0)).toBe(true);
  });
});

describe('parseItineraryStops', () => {
  it('tách "HH:MM — việc" thành cột giờ và cột việc', () => {
    const stops = parseItineraryStops('07:30 — Gear check\n12:30 — Lunch in Yên Minh');
    expect(stops).toEqual([
      { time: '07:30', text: 'Gear check' },
      { time: '12:30', text: 'Lunch in Yên Minh' },
    ]);
  });

  it('dòng KHÔNG theo định dạng vẫn giữ nguyên, time = null', () => {
    // Người soạn nội dung không bị ép theo một khuôn cứng: dòng tự do vẫn hiện
    // đủ chữ, chỉ là không có cột giờ.
    const stops = parseItineraryStops('Một ngày thong thả, không lịch cố định');
    expect(stops).toEqual([{ time: null, text: 'Một ngày thong thả, không lịch cố định' }]);
  });

  it('bỏ dòng trống, không đẻ ra hàng rỗng', () => {
    expect(parseItineraryStops('07:30 — A\n\n\n08:00 — B')).toHaveLength(2);
  });

  it('description null hoặc rỗng thì trả mảng rỗng', () => {
    expect(parseItineraryStops(null)).toEqual([]);
    expect(parseItineraryStops('   ')).toEqual([]);
  });

  it('giữ nguyên dấu gạch trong phần việc, chỉ cắt ở dấu phân cách đầu tiên', () => {
    const [stop] = parseItineraryStops('13:30 — Boat option — paid on the day');
    expect(stop).toEqual({ time: '13:30', text: 'Boat option — paid on the day' });
  });
});

describe('monthLabel', () => {
  it('khoá tháng thành nhãn đọc được', () => {
    expect(monthLabel('2026-09')).toBe('September 2026');
    expect(monthLabel('2027-01')).toBe('January 2027');
  });

  it('tháng 1 và tháng 12 KHÔNG lệch sang năm khác vì múi giờ', () => {
    // `new Date('2026-01-01')` ở múi giờ ÂM lùi về 31/12/2025. Đây là lý do
    // hàm phải neo UTC — bẫy `formatDateRange` đã né bằng cách tách chuỗi.
    expect(monthLabel('2026-01')).toBe('January 2026');
    expect(monthLabel('2026-12')).toBe('December 2026');
  });
});

describe('monthSeason', () => {
  it('rẻ hơn giá gốc là thấp mùa, đắt hơn là cao mùa', () => {
    expect(monthSeason(309, 369, 329)).toBe('low');
    expect(monthSeason(329, 349, 329)).toBe('peak');
  });

  it('đúng bằng giá gốc thì KHÔNG gắn nhãn — nhãn ở mọi tháng là nhãn vô nghĩa', () => {
    expect(monthSeason(329, 329, 329)).toBeNull();
  });

  it('thấp mùa thắng khi tháng có cả hai đầu lệch: giá vào rẻ là thứ khách quyết định theo', () => {
    expect(monthSeason(309, 369, 329)).toBe('low');
  });
});

describe('monthNotice', () => {
  const dep = (seatsLeft: number) => ({ seatsLeft });

  it('im lặng khi cả tháng còn rộng chỗ — huy hiệu hiện ở MỌI tháng là huy hiệu vô nghĩa', () => {
    expect(monthNotice([dep(10), dep(7)])).toBeNull();
  });

  it('lấy trạng thái GẮT NHẤT trong tháng, không phải trạng thái trung bình', () => {
    // Tháng có một đợt còn 2 chỗ và một đợt còn 10: nói "còn chỗ" là nói thiếu.
    expect(monthNotice([dep(2), dep(10)])).toEqual({ kind: 'limited' });
  });

  it('đếm số đợt đã hết chỗ khi tháng còn đợt bán được', () => {
    expect(monthNotice([dep(0), dep(4), dep(0)])).toEqual({ kind: 'some-sold-out', count: 2 });
  });

  it('hết sạch cả tháng thì nói hết sạch, không phải "2 sold out"', () => {
    expect(monthNotice([dep(0), dep(0)])).toEqual({ kind: 'sold-out' });
  });

  it('hết chỗ thắng sắp hết: một đợt 0 và một đợt 2 vẫn đọc là "1 sold out"', () => {
    expect(monthNotice([dep(0), dep(2)])).toEqual({ kind: 'some-sold-out', count: 1 });
  });

  it('tháng rỗng không bao giờ tới đây, nhưng không được ném lỗi', () => {
    expect(monthNotice([])).toBeNull();
  });
});

describe('monthDateSpan', () => {
  it('một đợt thì in đúng ngày đó, KHÔNG in "20–20 Aug"', () => {
    expect(monthDateSpan([{ startDate: '2026-08-20' }])).toBe('20 Aug');
  });

  it('nhiều đợt thì in ngày đầu–ngày cuối, tháng viết một lần', () => {
    expect(
      monthDateSpan([
        { startDate: '2026-10-01' },
        { startDate: '2026-10-12' },
        { startDate: '2026-10-29' },
      ]),
    ).toBe('1–29 Oct');
  });

  it('lấy MIN và MAX chứ không lấy phần tử đầu/cuối — mảng chưa chắc đã sắp', () => {
    expect(monthDateSpan([{ startDate: '2026-10-29' }, { startDate: '2026-10-03' }])).toBe(
      '3–29 Oct',
    );
  });

  it('hai đợt trùng ngày thì gộp lại thành một ngày', () => {
    expect(monthDateSpan([{ startDate: '2026-10-08' }, { startDate: '2026-10-08' }])).toBe('8 Oct');
  });
});

describe('defaultOpenMonth', () => {
  const months = [
    { month: '2026-08', items: [{ id: 'a', seatsLeft: 0 }] },
    { month: '2026-09', items: [{ id: 'b', seatsLeft: 6 }] },
    { month: '2026-11', items: [{ id: 'c', seatsLeft: 7 }] },
  ];

  it('mở tháng chứa đợt đang chọn — bảng và panel đặt chỗ phải nói cùng một thứ', () => {
    expect(defaultOpenMonth(months, 'c')).toBe('2026-11');
  });

  it('chưa chọn gì thì mở tháng đầu tiên CÒN CHỖ, không phải tháng đầu danh sách', () => {
    // Mở sẵn một tháng đã bán hết là dẫn khách vào ngõ cụt ngay dòng đầu.
    expect(defaultOpenMonth(months, undefined)).toBe('2026-09');
  });

  it('id không khớp đợt nào thì lùi về tháng đầu tiên còn chỗ', () => {
    expect(defaultOpenMonth(months, 'khong-ton-tai')).toBe('2026-09');
  });

  it('hết chỗ toàn bộ thì vẫn mở tháng đầu — bảng trống trơn tệ hơn bảng hết chỗ', () => {
    const soldOut = [{ month: '2026-08', items: [{ id: 'a', seatsLeft: 0 }] }];
    expect(defaultOpenMonth(soldOut, undefined)).toBe('2026-08');
  });

  it('không có tháng nào thì trả undefined', () => {
    expect(defaultOpenMonth([], undefined)).toBeUndefined();
  });
});

describe('reviewRange', () => {
  it('trang 1 của 5 review, cỡ trang 6: nói 1–5, KHÔNG nói 1–6', () => {
    // Bịa ra "1–6 of 5" là in một con số không tồn tại ở hàng cuối.
    expect(reviewRange(1, 6, 5)).toEqual({ from: 1, to: 5 });
  });

  it('trang giữa lấy đúng cửa sổ', () => {
    expect(reviewRange(2, 6, 23)).toEqual({ from: 7, to: 12 });
  });

  it('trang cuối cắt theo tổng', () => {
    expect(reviewRange(4, 6, 23)).toEqual({ from: 19, to: 23 });
  });

  it('không có review nào thì trả 0–0 chứ không phải 1–0', () => {
    expect(reviewRange(1, 6, 0)).toEqual({ from: 0, to: 0 });
  });

  it('trang vượt quá tổng bị kẹp về trang cuối — server đổi bộ lọc có thể làm rơi số trang', () => {
    expect(reviewRange(9, 6, 5)).toEqual({ from: 1, to: 5 });
  });
});

describe('toggleStarFilter', () => {
  it('bấm một mức sao khi đang không lọc thì bật lọc mức đó', () => {
    expect(toggleStarFilter(undefined, 4)).toBe(4);
  });

  it('bấm lại ĐÚNG mức đang chọn thì bỏ lọc — nếu không, không có đường quay lại', () => {
    expect(toggleStarFilter(4, 4)).toBeUndefined();
  });

  it('bấm mức khác thì chuyển sang mức đó', () => {
    expect(toggleStarFilter(4, 2)).toBe(2);
  });
});

describe('orderPolicies', () => {
  const p = (kind: string) => ({ kind }) as { kind: 'CANCELLATION' | 'BOOKING' | 'GENERAL' };

  it('luôn xếp Cancellation → Booking → General bất kể API trả thứ tự nào', () => {
    // Ba thẻ policy nằm cạnh nhau trên một hàng; thứ tự đổi theo tour là hàng
    // thẻ nhảy chỗ mỗi lần sang tour khác.
    const out = orderPolicies([p('GENERAL'), p('CANCELLATION'), p('BOOKING')]);
    expect(out.map((x) => x.kind)).toEqual(['CANCELLATION', 'BOOKING', 'GENERAL']);
  });

  it('thiếu một nhóm thì chỉ bớt thẻ đó, không chèn chỗ trống', () => {
    const out = orderPolicies([p('GENERAL'), p('CANCELLATION')]);
    expect(out.map((x) => x.kind)).toEqual(['CANCELLATION', 'GENERAL']);
  });

  it('hai policy cùng nhóm thì giữ nguyên thứ tự tương đối của API', () => {
    const a = { kind: 'GENERAL' as const, title: 'A' };
    const b = { kind: 'GENERAL' as const, title: 'B' };
    expect(orderPolicies([a, b])).toEqual([a, b]);
  });

  it('mảng rỗng trả mảng rỗng', () => {
    expect(orderPolicies([])).toEqual([]);
  });
});

describe('policyEyebrow', () => {
  it('nhãn nhóm khác tiêu đề thì giữ cả hai', () => {
    expect(policyEyebrow('General', 'Good to know')).toBe('General');
  });

  it('nhãn nhóm TRÙNG tiêu đề thì bỏ nhãn — in cùng một chuỗi hai lần là nhiễu', () => {
    // Fixture thật đặt `title: "Cancellation"` cho `kind: CANCELLATION`.
    expect(policyEyebrow('Cancellation', 'Cancellation')).toBeNull();
  });

  it('so sánh bỏ qua hoa thường và khoảng trắng thừa', () => {
    expect(policyEyebrow('Booking & payment', '  booking & PAYMENT ')).toBeNull();
  });
});
