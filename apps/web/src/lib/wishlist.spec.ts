import { describe, expect, it } from 'vitest';
import { signInHref, toggleWished } from './wishlist';

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
