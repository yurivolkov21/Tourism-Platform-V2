import { AdminPostDetailSchema, AdminPostRowSchema, type MediaItem } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { PostStatus } from '../../generated/prisma/enums.js';
import {
  type AdminPostRecord,
  coverSource,
  postStatusWhere,
  toAdminPostDetail,
  toAdminPostRow,
} from './admin-post-rules.js';
import { publishedPostWhere } from './published-post.where.js';

const NOW = new Date('2026-10-02T12:00:00.000Z');
const ROOT = 'tourism';
const POST_ID = '0199a000-0000-7000-8000-000000000001';

/** Ngày đăng ở TƯƠNG LAI, hai tour theo thứ tự KHÁC thứ tự id — bắt mapper lười. */
const RECORD: AdminPostRecord = {
  id: POST_ID,
  slug: 'eating-your-way-through-hoi-an',
  title: 'Eating your way through Hội An',
  status: PostStatus.PUBLISHED,
  publishedAt: new Date('2026-10-03T08:00:00.000Z'),
  updatedAt: new Date('2026-10-02T10:11:12.345Z'),
  tags: [{ tag: { slug: 'food', name: 'Food' } }],
  excerpt: 'Five stalls before noon.',
  content: '## Morning',
  createdAt: new Date('2026-09-30T00:00:00.000Z'),
  author: { name: null },
  relatedTours: [
    {
      tour: {
        id: '0199a000-0000-7000-8000-0000000000b2',
        slug: 'b',
        title: 'B',
        isPublished: false,
      },
    },
    {
      tour: {
        id: '0199a000-0000-7000-8000-0000000000a1',
        slug: 'a',
        title: 'A',
        isPublished: true,
      },
    },
  ],
};

const ITEM: MediaItem = {
  publicId: `${ROOT}/posts/${POST_ID}/cover`,
  url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/${ROOT}/posts/${POST_ID}/cover`,
  type: 'IMAGE',
  role: 'hero',
  posterUrl: null,
  width: 2000,
  height: 1333,
  alt: null,
  sortOrder: 0,
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
};

describe('postStatusWhere — cùng luật với postDisplayStatus', () => {
  it('published chính là publishedPostWhere: tab liệt kê đúng những bài web đang hiện', () => {
    expect(postStatusWhere('published', NOW)).toEqual(publishedPostWhere(NOW));
  });

  it('scheduled: PUBLISHED, ngày SAU bây giờ', () => {
    expect(postStatusWhere('scheduled', NOW)).toEqual({
      status: PostStatus.PUBLISHED,
      publishedAt: { gt: NOW },
    });
  });

  it('draft gồm cả bài PUBLISHED thiếu ngày (Quyết định 17)', () => {
    expect(postStatusWhere('draft', NOW)).toEqual({
      OR: [{ status: PostStatus.DRAFT }, { publishedAt: null }],
    });
  });

  it('all không lọc', () => {
    expect(postStatusWhere('all', NOW)).toEqual({});
  });
});

describe('toAdminPostRow / toAdminPostDetail', () => {
  it('hàng bảng khớp contract, trạng thái hiển thị tính theo `now`', () => {
    const row = toAdminPostRow(RECORD, ITEM.url, NOW);
    expect(AdminPostRowSchema.parse(row)).toEqual(row);
    expect(row.displayStatus).toBe('scheduled');
    expect(row.coverUrl).toBe(ITEM.url);
  });

  it('chi tiết: phiên bản là updatedAt, tour giữ thứ tự lưu, tác giả không tên vẫn là object', () => {
    const detail = toAdminPostDetail(RECORD, { item: ITEM, source: 'UPLOAD' }, NOW);
    expect(AdminPostDetailSchema.parse(detail)).toEqual(detail);
    expect(detail.version).toBe('2026-10-02T10:11:12.345Z');
    expect(detail.relatedTours.map((tour) => tour.slug)).toEqual(['b', 'a']);
    expect(detail.author).toEqual({ name: null });
    expect(detail.cover).toEqual({
      publicId: ITEM.publicId,
      url: ITEM.url,
      alt: null,
      source: 'UPLOAD',
    });
    expect(detail.readiness).toEqual([]);
  });

  it('không ảnh bìa thì readiness thiếu cover', () => {
    expect(toAdminPostDetail(RECORD, null, NOW).readiness).toEqual(['cover']);
  });
});

describe('coverSource', () => {
  const at = (publicId: string, inLibrary: boolean) =>
    coverSource(publicId, { rootFolder: ROOT, postId: POST_ID, inLibrary });

  it('thư mục tải lên của chính bài là UPLOAD, kể cả khi có dòng thư viện trùng', () => {
    expect(at(`${ROOT}/posts/${POST_ID}/x`, true)).toBe('UPLOAD');
  });

  it('có dòng thư viện là LIBRARY; còn lại là CATALOG', () => {
    expect(at(`${ROOT}/catalog/destination/hoi-an/1`, true)).toBe('LIBRARY');
    expect(at(`${ROOT}/catalog/post/eating`, false)).toBe('CATALOG');
  });

  it('thư mục của bài KHÁC không phải UPLOAD', () => {
    expect(at(`${ROOT}/posts/${POST_ID}-evil/x`, false)).toBe('CATALOG');
  });
});
