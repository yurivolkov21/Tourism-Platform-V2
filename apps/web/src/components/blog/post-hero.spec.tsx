import { render, screen } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { JournalPost } from '@/lib/api/posts';
import { PostHero } from './post-hero';

// Cùng lý do `post-card.spec.tsx`: TZ phải đổi TRƯỚC khi module dựng hằng
// `Intl.DateTimeFormat`, nên đặt trong `vi.hoisted` chứ không trong `it`.
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
  date: '2026-01-05',
  readMinutes: 5,
  category: 'Culture',
  author: 'Guide',
  tags: [],
};

describe('PostHero — ngày đăng', () => {
  it('in đúng ngày của chuỗi YYYY-MM-DD dù máy khách ở múi giờ âm', () => {
    render(
      <MotionConfig reducedMotion="always">
        <PostHero post={POST} />
      </MotionConfig>,
    );
    const time = screen.getByText('January 5, 2026');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('dateTime', '2026-01-05');
  });
});
