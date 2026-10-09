import { describe, expect, it } from 'vitest';
import { formatSavedDate, signInHref, toggleWished } from './wishlist';

describe('signInHref — khách chưa đăng nhập bấm tim', () => {
  it('đưa về /login kèm đường quay lại', () => {
    expect(signInHref('/tours', '')).toBe('/login?redirect=%2Ftours');
  });

  it('GIỮ NGUYÊN bộ lọc đang mở — mất filter khi quay lại là mất công khách đã chọn', () => {
    expect(signInHref('/tours', 'destinations=hue&sort=basePrice')).toBe(
      '/login?redirect=%2Ftours%3Fdestinations%3Dhue%26sort%3DbasePrice',
    );
  });

  it('chấp nhận query đã có dấu ? ở đầu', () => {
    expect(signInHref('/tours', '?page=2')).toBe('/login?redirect=%2Ftours%3Fpage%3D2');
  });

  it('KHÔNG BAO GIỜ nhả ra đích ngoài site — chặn open redirect', () => {
    // `safeRedirect` phía trang login là lớp chặn thứ hai; chặn từ đây là lớp
    // thứ nhất, để URL người dùng nhìn thấy cũng đã sạch.
    for (const bad of ['//evil.test', 'https://evil.test/x', 'http://evil.test']) {
      expect(signInHref(bad, '')).toBe('/login?redirect=%2F');
    }
  });

  it('đường dẫn rỗng rơi về gốc, không sinh redirect rỗng', () => {
    expect(signInHref('', '')).toBe('/login?redirect=%2F');
  });
});

describe('toggleWished', () => {
  const ID = 'd0000002-0000-4000-8000-000000000001';

  it('thêm khi chưa có, bỏ khi đã có', () => {
    const empty = new Set<string>();
    expect(toggleWished(empty, ID).has(ID)).toBe(true);
    expect(toggleWished(new Set([ID]), ID).has(ID)).toBe(false);
  });

  it('trả về Set MỚI, không sửa cái cũ — React so sánh bằng tham chiếu', () => {
    const before = new Set([ID]);
    const after = toggleWished(before, ID);
    expect(after).not.toBe(before);
    expect(before.has(ID)).toBe(true);
  });

  it('không đụng các id khác', () => {
    const other = 'd0000002-0000-4000-8000-000000000002';
    const after = toggleWished(new Set([other]), ID);
    expect(after.has(other)).toBe(true);
    expect(after.has(ID)).toBe(true);
  });
});

describe('formatSavedDate — dòng "Saved …" trên thẻ đã lưu (spec 09/10 §3)', () => {
  /** "Hôm nay" theo lịch Việt Nam, do trang server tính (`todayDateString`). */
  const TODAY = '2026-10-09';

  it('cùng năm với hôm nay: ngày + tháng viết tắt, không năm', () => {
    expect(formatSavedDate('2026-10-03T05:00:00.000Z', TODAY)).toBe('3 Oct');
  });

  it('khác năm: thêm năm', () => {
    expect(formatSavedDate('2025-12-20T03:00:00.000Z', TODAY)).toBe('20 Dec 2025');
  });

  it('cắt ngày theo lịch VIỆT NAM: 18:30Z là 01:30 sáng hôm sau ở Việt Nam', () => {
    expect(formatSavedDate('2026-10-02T18:30:00.000Z', TODAY)).toBe('3 Oct');
  });

  it('năm cũng theo lịch Việt Nam: 31/12 lúc 18:00Z đã là 1/1 ở Việt Nam, cùng năm với hôm nay', () => {
    expect(formatSavedDate('2025-12-31T18:00:00.000Z', TODAY)).toBe('1 Jan');
  });

  it('so năm với `today` truyền vào, không đọc đồng hồ máy', () => {
    expect(formatSavedDate('2026-10-03T05:00:00.000Z', '2027-01-02')).toBe('3 Oct 2026');
  });
});
