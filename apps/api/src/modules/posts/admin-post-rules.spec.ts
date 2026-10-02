import { AdminPostDetailSchema, AdminPostRowSchema, type MediaItem } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { PostStatus } from '../../generated/prisma/enums.js';
import type { StoredPhoto } from '../catalog/tour-photos.js';
import {
  type AdminPostRecord,
  coverSource,
  planPostCover,
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

describe('planPostCover (spec §3.2, ADR-0051 §7)', () => {
  const stored = (publicId: string): StoredPhoto => ({
    publicId,
    type: 'IMAGE',
    posterId: null,
    format: 'jpg',
    width: 1600,
    height: 1067,
    durationSec: null,
    bytes: 400000,
    version: '1700000000',
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
  });
  const OLD_UPLOAD = `${ROOT}/posts/${POST_ID}/old`;
  const NEW_UPLOAD = `${ROOT}/posts/${POST_ID}/new`;
  const LIBRARY_ID = `${ROOT}/catalog/destination/hoi-an/1`;
  const CATALOG_ID = `${ROOT}/catalog/post/eating`;
  const META = { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 };
  const plan = (
    cover: { publicId: string; alt: string | null; upload?: typeof META } | null,
    current: StoredPhoto | null,
    library: StoredPhoto | null = null,
  ) => planPostCover({ postId: POST_ID, rootFolder: ROOT, cover, current, library });

  it('giữ ảnh hiện có, chỉ đổi alt: không gì vào hàng dọn', () => {
    expect(plan({ publicId: OLD_UPLOAD, alt: 'New alt' }, stored(OLD_UPLOAD))).toEqual({
      ok: true,
      row: { ...stored(OLD_UPLOAD), alt: 'New alt' },
      requeue: [],
    });
  });

  it('ảnh tải lên mới thay ảnh tải lên cũ: metadata lấy từ upload, ảnh cũ vào lại hàng dọn', () => {
    expect(plan({ publicId: NEW_UPLOAD, alt: null, upload: META }, stored(OLD_UPLOAD))).toEqual({
      ok: true,
      row: {
        publicId: NEW_UPLOAD,
        type: 'IMAGE',
        posterId: null,
        format: 'jpg',
        width: 2000,
        height: 1333,
        durationSec: null,
        bytes: 523000,
        version: '1759000000',
        author: null,
        license: null,
        licenseUrl: null,
        sourceUrl: null,
        alt: null,
      },
      requeue: [OLD_UPLOAD],
    });
  });

  it('ảnh thư viện thay ảnh catalog: chép ghi công của thư viện; ảnh catalog KHÔNG vào hàng dọn', () => {
    const library = { ...stored(LIBRARY_ID), author: 'Jane Doe', license: 'CC BY-SA 4.0' };
    expect(plan({ publicId: LIBRARY_ID, alt: null }, stored(CATALOG_ID), library)).toEqual({
      ok: true,
      row: { ...library, alt: null },
      requeue: [],
    });
  });

  it('gỡ ảnh bìa: ảnh tải lên cũ vào hàng dọn; ảnh thư viện cũ thì không', () => {
    expect(plan(null, stored(OLD_UPLOAD))).toEqual({ ok: true, row: null, requeue: [OLD_UPLOAD] });
    expect(plan(null, stored(LIBRARY_ID))).toEqual({ ok: true, row: null, requeue: [] });
    expect(plan(null, null)).toEqual({ ok: true, row: null, requeue: [] });
  });

  it.each([
    ['ảnh tải lên thiếu metadata', { publicId: NEW_UPLOAD, alt: null }],
    [
      'thư mục của bài khác',
      { publicId: `${ROOT}/posts/${POST_ID}-evil/x`, alt: null, upload: META },
    ],
    ['ảnh lạ không có dòng thư viện', { publicId: CATALOG_ID, alt: null }],
  ])('từ chối %s', (_, cover) => {
    expect(plan(cover, null)).toEqual({ ok: false, rejected: cover.publicId });
  });

  it('dòng thư viện của publicId KHÁC không cứu được ảnh lạ', () => {
    expect(plan({ publicId: CATALOG_ID, alt: null }, null, stored(LIBRARY_ID))).toEqual({
      ok: false,
      rejected: CATALOG_ID,
    });
  });
});
