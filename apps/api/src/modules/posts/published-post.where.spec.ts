import { describe, expect, it } from 'vitest';
import { PostStatus } from '../../generated/prisma/enums.js';
import { publishedPostWhere } from './published-post.where.js';

describe('publishedPostWhere', () => {
  it('trả điều kiện status PUBLISHED + publishedAt <= now đã bơm', () => {
    const now = new Date('2026-07-21T00:00:00.000Z');
    expect(publishedPostWhere(now)).toEqual({
      status: PostStatus.PUBLISHED,
      publishedAt: { lte: now },
    });
  });

  it('không truyền now → dùng thời điểm gọi (lte là Date)', () => {
    // `expect.any(Date)` khớp mọi Date mà không phải cast union filter của Prisma.
    expect(publishedPostWhere()).toEqual({
      status: PostStatus.PUBLISHED,
      publishedAt: { lte: expect.any(Date) },
    });
  });
});
