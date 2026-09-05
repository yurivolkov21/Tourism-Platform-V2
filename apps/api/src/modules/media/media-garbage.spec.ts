import { describe, expect, it } from 'vitest';
import { classifyDestroyResult, dueBefore, GC_MAX_ATTEMPTS, shouldRetry } from './media-garbage.js';

/**
 * Phần THUẦN của bộ dọn ảnh mồ côi (ADR-0035) — không đụng DB, không đụng
 * Cloudinary, nên mọi biên test được mà không có gì bị xoá thật.
 *
 * Hai hằng ở đây là LƯỚI AN TOÀN, không phải tham số điều chỉnh: destroy của
 * Cloudinary không hoàn tác được (ADR-0035 §1), nên chúng có test riêng khoá
 * lại thay vì để ai đó hạ xuống 0 trong một lần "tối ưu".
 */
describe('hằng an toàn', () => {
  // Độ trễ 7 ngày sống ở env (`MEDIA_GC_GRACE_DAYS`) và được khoá ở
  // `env.spec.ts` — nơi production thật sự đọc. Không khoá một hằng ở đây nữa.
  it('trần thử lại là 5 — hỏng mãi thì để lại làm vết, không quay vòng vô hạn', () => {
    expect(GC_MAX_ATTEMPTS).toBe(5);
  });
});

describe('dueBefore', () => {
  it('lùi đúng số ngày khỏi mốc hiện tại', () => {
    const now = new Date('2026-09-30T12:00:00.000Z');

    expect(dueBefore(now, 7).toISOString()).toBe('2026-09-23T12:00:00.000Z');
  });

  it('bắc qua giao tháng và giao năm bằng phép trừ epoch, không đụng lịch', () => {
    expect(dueBefore(new Date('2026-01-03T00:00:00.000Z'), 7).toISOString()).toBe(
      '2025-12-27T00:00:00.000Z',
    );
  });

  it('KHÔNG sửa `now` của caller', () => {
    const now = new Date('2026-09-30T12:00:00.000Z');
    dueBefore(now, 7);

    expect(now.toISOString()).toBe('2026-09-30T12:00:00.000Z');
  });

  it('KHÔNG BAO GIỜ trả mốc muộn hơn `now` — số âm bị kẹp về 0', () => {
    // Không phải phòng thủ thừa: `now − (−3 ngày)` là một mốc ở TƯƠNG LAI,
    // tức mọi row đều quá hạn kể cả row vừa ghi một giây trước. Một dấu trừ
    // lọt vào đây xoá sạch lưới an toàn 7 ngày và biến bộ dọn thành
    // xoá-ngay-lập-tức.
    const now = new Date('2026-09-30T12:00:00.000Z');
    expect(dueBefore(now, 0).getTime()).toBe(now.getTime());
    expect(dueBefore(now, -3).getTime()).toBe(now.getTime());
  });
});

describe('classifyDestroyResult', () => {
  it('`ok` là xoá thật', () => {
    expect(classifyDestroyResult({ result: 'ok' })).toBe('destroyed');
  });

  it('`not found` CŨNG là xong, không phải lỗi — nhưng phải PHÂN BIỆT được với xoá thật', () => {
    // Ca thường gặp nhất của ADR-0035 §3: publicId được ghi vào hàng đợi ngay
    // lúc KÝ, nên phần lớn row là những lần khách bỏ dở — file chưa bao giờ
    // lên CDN. Coi đó là lỗi thì hàng đợi tự bơm `attempts` và không bao giờ
    // sạch. Nhưng gộp với `ok` thì log lượt chạy đầu không nói được bộ dọn có
    // xoá THẬT không (publicId sai dạng → mọi row đều `not found`).
    expect(classifyDestroyResult({ result: 'not found' })).toBe('absent');
  });

  it('mọi phán quyết khác là hỏng — để lại thử lần sau', () => {
    expect(classifyDestroyResult({ result: 'error' })).toBe('failed');
    expect(classifyDestroyResult({})).toBe('failed');
    expect(classifyDestroyResult({ result: 'rate limited' })).toBe('failed');
  });
});

describe('shouldRetry', () => {
  it('còn dưới trần thì thử tiếp', () => {
    expect(shouldRetry(0)).toBe(true);
    expect(shouldRetry(GC_MAX_ATTEMPTS - 1)).toBe(true);
  });

  it('chạm trần thì thôi — row ở lại như một vết cần người xem', () => {
    expect(shouldRetry(GC_MAX_ATTEMPTS)).toBe(false);
    expect(shouldRetry(GC_MAX_ATTEMPTS + 3)).toBe(false);
  });
});
