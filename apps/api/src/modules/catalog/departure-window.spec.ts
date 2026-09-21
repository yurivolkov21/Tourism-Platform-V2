import { describe, expect, it } from 'vitest';
import { departureWindow } from './departure-window.js';

/**
 * Logic THUẦN của cửa sổ đếm "chuyến còn mở" (spec P4e-1 §3-F11) — viết
 * trước service vì đây là chỗ duy nhất của F11 có phép tính thật, và int test
 * thì quá chậm để làm vòng lặp.
 */

/** 08:00 giờ VN ngày 21/09 = 01:00 UTC cùng ngày. */
const MORNING_VN = new Date('2026-09-21T01:00:00.000Z');
/** 06:30 UTC ngày 21/09 = 13:30 giờ VN cùng ngày. */
const AFTERNOON_VN = new Date('2026-09-21T06:30:00.000Z');
/** 23:30 UTC ngày 21/09 = 06:30 giờ VN NGÀY 22 — biên mà thước UTC đọc sai. */
const NIGHT_UTC = new Date('2026-09-21T23:30:00.000Z');

describe('departureWindow — không có tháng', () => {
  it('cận dưới là 00:00 UTC của ngày HÔM NAY giờ Việt Nam, không có cận trên', () => {
    expect(departureWindow(undefined, MORNING_VN)).toEqual({
      gte: new Date('2026-09-21T00:00:00.000Z'),
    });
  });

  it('mọi khoảnh khắc trong cùng một ngày VN cho cùng một cận dưới', () => {
    expect(departureWindow(undefined, AFTERNOON_VN)).toEqual(
      departureWindow(undefined, MORNING_VN),
    );
  });

  it('sau 17:00 UTC đã sang ngày mới giờ VN — cận dưới nhảy theo', () => {
    // ADR-0041 §7: `start_date` là ngày lịch VN. Thước UTC trần sẽ để một
    // chuyến khởi hành "hôm qua giờ VN" còn được đếm tới 06:59 sáng nay.
    expect(departureWindow(undefined, NIGHT_UTC)).toEqual({
      gte: new Date('2026-09-22T00:00:00.000Z'),
    });
  });
});

describe('departureWindow — có tháng', () => {
  it('là khoảng nửa-mở của đúng tháng đó, không phụ thuộc hôm nay', () => {
    expect(departureWindow('2026-11', MORNING_VN)).toEqual({
      gte: new Date('2026-11-01T00:00:00.000Z'),
      lt: new Date('2026-12-01T00:00:00.000Z'),
    });
  });

  it('tháng 12 sang năm sau đúng chỗ', () => {
    expect(departureWindow('2026-12', MORNING_VN)).toEqual({
      gte: new Date('2026-12-01T00:00:00.000Z'),
      lt: new Date('2027-01-01T00:00:00.000Z'),
    });
  });

  it('tháng 2 năm nhuận: cận trên vẫn là ngày 1 tháng 3, không phải 28/29', () => {
    // Cận trên là MỐC ĐẦU tháng sau chứ không phải "ngày cuối tháng này" —
    // đếm số ngày trong tháng là chỗ năm nhuận cắn.
    expect(departureWindow('2028-02', MORNING_VN)).toEqual({
      gte: new Date('2028-02-01T00:00:00.000Z'),
      lt: new Date('2028-03-01T00:00:00.000Z'),
    });
  });

  it('tháng ĐÃ QUA vẫn là khoảng của chính nó — không bị cắt theo hôm nay', () => {
    // "Tháng trước còn chuyến nào tôi quên đóng không?" là một câu hỏi thật.
    expect(departureWindow('2026-07', MORNING_VN)).toEqual({
      gte: new Date('2026-07-01T00:00:00.000Z'),
      lt: new Date('2026-08-01T00:00:00.000Z'),
    });
  });

  /**
   * Hàm nhận `string` trần nên KHÔNG được tin người gọi đã parse. Trước đợt
   * tách file, luật năm 1900–2099 và chỗ tiêu thụ nó nằm cùng một chỗ; giờ thì
   * không, và `Date.UTC(50, …)` ánh xạ legacy thành năm 1950 — cho ra cửa sổ
   * rỗng và MỌI tour đếm 0 mà không lỗi nào đỏ (vòng review 21/09).
   */
  it('tháng ngoài dải schema bị TỪ CHỐI thay vì âm thầm ra cửa sổ năm 1950', () => {
    // Năm 0050 là ca đắt nhất: `Date.UTC(50, …)` ánh xạ legacy thành 1950, cho
    // ra một cửa sổ hợp lệ về kiểu nhưng rỗng về nghĩa — mọi tour đếm 0 và
    // không gì đỏ. Hai ca còn lại chỉ để chốt rằng hàm KHÔNG tự đoán.
    expect(() => departureWindow('0050-06', MORNING_VN)).toThrow();
    expect(() => departureWindow('2026-13', MORNING_VN)).toThrow();
    expect(() => departureWindow('rác', MORNING_VN)).toThrow();
  });
});
