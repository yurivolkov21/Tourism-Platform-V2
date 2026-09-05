import { describe, expect, it } from 'vitest';
import { parseIsoDate, toIsoDate } from './date-field';

/**
 * Cầu nối giữa HAI cách viết một ngày: chuỗi ISO `YYYY-MM-DD` mà URL và
 * contract nói, và `Date` địa phương mà lịch `ToolbarDateRange` cầm.
 *
 * Toàn bộ đám này phải làm việc ở giờ ĐỊA PHƯƠNG. `new Date('2026-09-01')`
 * của JS là nửa đêm UTC, nên ở mọi múi giờ âm nó lùi một ngày — admin ở
 * New York lọc "từ 01/09" sẽ thấy ô khoe "August 31, 2026". Đó là lý do
 * `parseIsoDate` tự tách chuỗi thay vì đưa cho `new Date`.
 */
describe('parseIsoDate', () => {
  it('chuỗi ISO thành ngày ĐỊA PHƯƠNG, không lệch múi giờ', () => {
    const date = parseIsoDate('2026-09-01');

    // So từng phần thay vì so timestamp: đây chính là thứ `new Date(iso)` làm sai.
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(8);
    expect(date?.getDate()).toBe(1);
  });

  it('rỗng / thiếu là "không lọc", không phải Invalid Date', () => {
    expect(parseIsoDate('')).toBeUndefined();
    expect(parseIsoDate(undefined)).toBeUndefined();
  });

  it('ngày không tồn tại bị loại, không cuộn sang tháng sau', () => {
    // `new Date(2026, 1, 31)` im lặng thành 03/03 — đúng cái bẫy phải chặn.
    expect(parseIsoDate('2026-02-31')).toBeUndefined();
    expect(parseIsoDate('2026-13-01')).toBeUndefined();
  });

  it('chuỗi sai dạng bị loại', () => {
    expect(parseIsoDate('01/09/2026')).toBeUndefined();
    expect(parseIsoDate('linh tinh')).toBeUndefined();
  });
});

describe('toIsoDate', () => {
  it('ngày địa phương thành ISO, có đệm số 0', () => {
    expect(toIsoDate(new Date(2026, 8, 1))).toBe('2026-09-01');
    expect(toIsoDate(new Date(2026, 11, 25))).toBe('2026-12-25');
  });

  it('khứ hồi ISO → Date → ISO giữ nguyên chuỗi', () => {
    const iso = '2026-09-30';
    const parsed = parseIsoDate(iso);

    expect(parsed && toIsoDate(parsed)).toBe(iso);
  });
});
