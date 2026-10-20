import { afterAll, describe, expect, it, vi } from 'vitest';
import { formatReviewDate } from './tours';

// Ép tiến trình test sang múi giờ ÂM TRƯỚC khi `./tours` được import: hằng
// `Intl.DateTimeFormat` của module chốt múi giờ lúc dựng, nên đặt TZ trong `it`
// là quá muộn. Tách file riêng thay vì thêm vào `tours.spec.ts` để múi giờ giả
// không lan sang các case khác của file đó.
const originalTz = vi.hoisted(() => {
  const tz = process.env.TZ;
  process.env.TZ = 'America/New_York';
  return tz;
});

afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('formatReviewDate — máy xem ở múi giờ âm', () => {
  it('đánh giá viết lúc 03:00 UTC ngày 1/10 vẫn in "October 2026" ở New York', () => {
    // 03:00 UTC ngày 1/10 là 23:00 ngày 30/9 ở New York. Server render ở UTC in
    // "October"; trình duyệt mà in theo giờ máy thì ra "September" và lệch HTML lúc hydrate.
    expect(formatReviewDate('2026-10-01T03:00:00.000Z')).toBe('October 2026');
  });
});
