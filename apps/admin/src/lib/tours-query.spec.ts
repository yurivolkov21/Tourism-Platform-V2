import { describe, expect, it } from 'vitest';
import {
  departureMonthOptions,
  departuresHref,
  parseToursSearchParams,
  toursHref,
} from './tours-query';

/**
 * URL-state của `/tours` (spec P4e-1 §3-F11). Hai thứ được pin kỹ nhất ở đây
 * vì chúng là chỗ vùng này KHÁC các bảng khác:
 *
 * 1. `month` KHÔNG lọc bớt hàng, nhưng VẪN đặt lại trang về 1 — nó đổi con số
 *    người ta đang đọc trên mọi hàng.
 * 2. Tháng ĐÃ QUA là giá trị hợp lệ (khác `/reports`, nơi có sàn dữ liệu).
 */

const CATEGORY = 'b0000001-0000-4000-8000-000000000001';
const NOW = new Date('2026-09-21T10:00:00.000Z');

describe('parseToursSearchParams', () => {
  it('URL trần → trang 1, 20 dòng, không filter nào', () => {
    expect(parseToursSearchParams({})).toEqual({ page: 1, limit: 20 });
  });

  it('đọc đủ ba filter', () => {
    expect(
      parseToursSearchParams({ category: CATEGORY, published: 'false', month: '2026-11' }),
    ).toMatchObject({ categoryId: CATEGORY, isPublished: false, month: '2026-11' });
  });

  it('`published` CHỈ nhận "true"/"false" — mọi thứ khác là "mọi tour"', () => {
    // Một cờ ba trạng thái mà mỗi người viết URL một kiểu ("1"/"yes"/"on") là
    // chỗ hai người đọc cùng một link ra hai bảng khác nhau.
    for (const raw of ['1', 'yes', 'on', 'TRUE', '']) {
      expect(parseToursSearchParams({ published: raw }).isPublished, raw).toBeUndefined();
    }
    expect(parseToursSearchParams({ published: 'true' }).isPublished).toBe(true);
    expect(parseToursSearchParams({ published: 'false' }).isPublished).toBe(false);
  });

  it('category không phải uuid rơi im lặng — không ném 400 lên API', () => {
    expect(parseToursSearchParams({ category: 'day-tours' }).categoryId).toBeUndefined();
    expect(parseToursSearchParams({ category: '' }).categoryId).toBeUndefined();
  });

  it('month rác rơi im lặng, month ĐÃ QUA thì KHÔNG', () => {
    expect(parseToursSearchParams({ month: '2026-13' }).month).toBeUndefined();
    expect(parseToursSearchParams({ month: '2026-11-01' }).month).toBeUndefined();
    // "Tháng trước còn chuyến nào tôi quên đóng không" là câu hỏi thật, và cửa
    // sổ đếm bên API là tuyệt đối nên nó trả lời được.
    expect(parseToursSearchParams({ month: '2026-01' }).month).toBe('2026-01');
  });

  it('param lặp lấy giá trị ĐẦU, đúng nếp Next đọc query', () => {
    expect(parseToursSearchParams({ published: ['false', 'true'] }).isPublished).toBe(false);
  });
});

describe('toursHref', () => {
  const base = { page: 3, limit: 20 };

  it('giữ trang khi không đổi phạm vi gì', () => {
    expect(toursHref(base, { page: 4 })).toBe('/tours?page=4');
  });

  it('đổi BẤT KỲ filter nào cũng đặt lại trang về 1 — kể cả `month`', () => {
    // `month` không lọc bớt hàng, nhưng nó đổi con số trên MỌI hàng: ở lại
    // trang 3 của bộ lọc cũ là giữ đúng cái trang không ai đang nhìn.
    expect(toursHref(base, { month: '2026-11' })).toBe('/tours?month=2026-11');
    expect(toursHref(base, { categoryId: CATEGORY })).toBe(`/tours?category=${CATEGORY}`);
    expect(toursHref(base, { isPublished: false })).toBe('/tours?published=false');
  });

  it('`false` là một GIÁ TRỊ, `null` mới là xoá', () => {
    const current = { ...base, isPublished: false };
    expect(toursHref(current, { page: 2 })).toBe('/tours?published=false&page=2');
    expect(toursHref(current, { isPublished: null })).toBe('/tours');
  });

  it('thứ tự param cố định — href ổn định giữa hai lần render', () => {
    const current = {
      page: 1,
      limit: 20,
      categoryId: CATEGORY,
      isPublished: true,
      month: '2026-11',
    };
    expect(toursHref(current, {})).toBe(`/tours?category=${CATEGORY}&published=true&month=2026-11`);
  });

  it('mặc định (trang 1, 20 dòng) không viết ra URL', () => {
    expect(toursHref({ page: 1, limit: 20 }, {})).toBe('/tours');
  });
});

describe('departuresHref', () => {
  it('trỏ màn chuyến khởi hành của tour đó', () => {
    expect(departuresHref('hoi-an-lantern-evening')).toBe(
      '/tours/hoi-an-lantern-evening/departures',
    );
  });
});

describe('departureMonthOptions', () => {
  it('bắt đầu từ tháng NÀY rồi đi tới tương lai — ngược chiều ô tháng của /reports', () => {
    const options = departureMonthOptions(NOW, 3);
    expect(options.map((option) => option.value)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(options[0]?.label).toBe('September 2026');
  });

  it('vắt qua năm đúng chỗ', () => {
    expect(
      departureMonthOptions(new Date('2026-12-01T00:00:00.000Z'), 3).map((o) => o.value),
    ).toEqual(['2026-12', '2027-01', '2027-02']);
  });

  it('tháng đang chọn ngoài dải được CHÈN lên đầu', () => {
    // Thiếu bước này thì ô chọn hiện một tháng còn con số trong bảng đếm theo
    // một tháng khác — hai thứ cãi nhau ngay trên cùng màn hình.
    const options = departureMonthOptions(NOW, 3, '2026-01');
    expect(options[0]).toEqual({ value: '2026-01', label: 'January 2026' });
    expect(options).toHaveLength(4);
  });

  it('tháng đang chọn ĐÃ nằm trong dải thì không nhân đôi', () => {
    const options = departureMonthOptions(NOW, 3, '2026-10');
    expect(options.filter((option) => option.value === '2026-10')).toHaveLength(1);
  });
});
