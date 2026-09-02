import { describe, expect, it } from 'vitest';
import { formatDateLabel, parseIsoDate, parseTypedDate, toIsoDate } from './date-field';

/**
 * Cầu nối giữa HAI cách viết một ngày: chuỗi ISO `YYYY-MM-DD` mà URL và
 * contract nói, và chuỗi người đọc ("September 01, 2026") mà ô nhập kiểu
 * `date-picker-04` hiển thị.
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

describe('formatDateLabel', () => {
  it('đúng dạng en-US mà date-picker-04 hiển thị', () => {
    expect(formatDateLabel(new Date(2026, 8, 1))).toBe('September 01, 2026');
  });

  it('không có ngày thì ô rỗng, không phải chữ "Invalid Date"', () => {
    expect(formatDateLabel(undefined)).toBe('');
  });
});

describe('parseTypedDate', () => {
  it('đọc lại được đúng chuỗi mà chính nó hiển thị', () => {
    const typed = parseTypedDate('September 01, 2026');

    expect(typed && toIsoDate(typed)).toBe('2026-09-01');
  });

  it('gõ ISO cũng nhận, và vẫn là ngày địa phương', () => {
    const typed = parseTypedDate('2026-09-01');

    expect(typed && toIsoDate(typed)).toBe('2026-09-01');
  });

  it('khoan dung với dạng viết tắt', () => {
    const typed = parseTypedDate('Sep 1 2026');

    expect(typed && toIsoDate(typed)).toBe('2026-09-01');
  });

  it('bỏ khoảng trắng thừa', () => {
    const typed = parseTypedDate('  September 01, 2026  ');

    expect(typed && toIsoDate(typed)).toBe('2026-09-01');
  });

  it('chuỗi rác không thành ngày', () => {
    expect(parseTypedDate('')).toBeUndefined();
    expect(parseTypedDate('linh tinh')).toBeUndefined();
  });

  it('ISO MỘT PHẦN không rơi xuống new Date — ECMA-262 parse dạng ấy theo UTC', () => {
    // Vòng vá review 02/09: '2026-09' ở New York từng thành 31/08 địa phương,
    // '2026' thành 31/12 năm trước — đúng cái lệch một ngày file này sinh ra
    // để trị, chỉ là qua cửa sau. Mọi dáng ISO chỉ có một đường: parseIsoDate.
    expect(parseTypedDate('2026')).toBeUndefined();
    expect(parseTypedDate('2026-09')).toBeUndefined();
    expect(parseTypedDate('2026-09-01T00:00:00Z')).toBeUndefined();
    expect(parseTypedDate('2026-09-01T00:00:00.000Z')).toBeUndefined();
  });

  it('mẩu gõ dở KHÔNG được đoán thành một ngày nào đó', () => {
    // Không có năm 4 chữ số thì chưa gõ xong. Thiếu chốt này, một cú blur
    // giữa chừng sẽ chốt đại một bộ lọc mà admin không hề chọn.
    expect(parseTypedDate('September')).toBeUndefined();
    expect(parseTypedDate('September 01')).toBeUndefined();
    expect(parseTypedDate('20')).toBeUndefined();
  });
});
