import { render, screen } from '@testing-library/react';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { JournalPost } from '@/lib/api/posts';
import { PostCard } from './post-card';

// Ép tiến trình test sang múi giờ ÂM TRƯỚC khi `post-card` được import: hằng
// `Intl.DateTimeFormat` của module chốt múi giờ lúc dựng, nên đặt TZ trong `it`
// là quá muộn. Khách ở Mỹ là múi giờ âm — đúng chỗ ngày đăng từng lùi một ngày.
const originalTz = vi.hoisted(() => {
  const tz = process.env.TZ;
  process.env.TZ = 'America/New_York';
  return tz;
});

afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const POST: JournalPost = {
  slug: 'ha-giang-loop-notes',
  title: 'Ha Giang loop notes',
  excerpt: '',
  cover: null,
  // `date` là chuỗi YYYY-MM-DD cắt từ `publishedAt` — `new Date()` đọc nó là
  // nửa đêm UTC, tức 19:00 ngày HÔM TRƯỚC ở New York.
  date: '2026-01-05',
  readMinutes: 5,
  category: 'Culture',
  author: 'Guide',
  tags: [],
};

describe('PostCard — ngày đăng', () => {
  it('in đúng ngày của chuỗi YYYY-MM-DD dù máy khách ở múi giờ âm', () => {
    render(<PostCard post={POST} />);
    const time = screen.getByText('Jan 5, 2026');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('dateTime', '2026-01-05');
  });
});
