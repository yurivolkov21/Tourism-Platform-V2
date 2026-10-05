import { describe, expect, it } from 'vitest';
import { contract } from '../contract.js';
import {
  AdminPostCreateInputSchema,
  AdminPostDetailSchema,
  AdminPostsListQuerySchema,
  AdminPostUpdateInputSchema,
  normalizePostTags,
  POST_CONTENT_MAX,
  POST_COVER_ALT_MAX,
  POST_EXCERPT_MAX,
  POST_RELATED_TOURS_MAX,
  POST_SLUG_MAX,
  POST_TAG_NAME_MAX,
  POST_TAGS_MAX,
  POST_TITLE_MAX,
  postContentIssue,
  postDisplayStatus,
  postReadiness,
} from './admin-posts.js';

/**
 * Contract quản trị bài viết (spec P4e-4 §2–3, ADR-0051). Mỗi trần có đúng hai ca: N
 * (qua) và N+1 (bị bắt) — trần lệch một đơn vị là thứ bảng ca này sinh ra để bắt.
 */
const ID = '11111111-1111-4111-8111-111111111111';
const VERSION = '2026-10-02T10:11:12.345Z';
const NOW = new Date('2026-10-02T12:00:00.000Z');
const tourId = (n: number) => `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;
const text = (length: number) => 'x'.repeat(length);
const many = <T>(length: number, make: (index: number) => T) =>
  Array.from({ length }, (_, index) => make(index));

const UPLOAD = { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 };
const COVER = { publicId: `tourism/posts/${ID}/cover`, alt: null };
const UPDATE = {
  id: ID,
  version: VERSION,
  title: 'Eating your way through Hội An',
  excerpt: 'Five stalls before noon.',
  content: '## Morning\n\nBánh mì first, coffee second.',
  status: 'PUBLISHED',
  publishedAt: '2026-10-01T08:00:00.000Z',
  tags: ['Food', 'Hội An'],
  relatedTourIds: [tourId(2), tourId(1)],
  cover: COVER,
};
const update = (patch: Record<string, unknown>) =>
  AdminPostUpdateInputSchema.safeParse({ ...UPDATE, ...patch });

describe('postDisplayStatus (spec §2.2)', () => {
  it('DRAFT là draft, kể cả khi còn giữ ngày đăng cũ', () => {
    expect(postDisplayStatus('DRAFT', '2026-09-01T00:00:00.000Z', NOW)).toBe('draft');
  });

  it('PUBLISHED, ngày ở tương lai là scheduled', () => {
    expect(postDisplayStatus('PUBLISHED', '2026-10-02T12:00:00.001Z', NOW)).toBe('scheduled');
  });

  it('PUBLISHED, ngày đúng bằng bây giờ là published — biên `lte` của publishedPostWhere', () => {
    expect(postDisplayStatus('PUBLISHED', '2026-10-02T12:00:00.000Z', NOW)).toBe('published');
  });

  it('PUBLISHED mà thiếu ngày là draft: web không hiện bài ấy', () => {
    expect(postDisplayStatus('PUBLISHED', null, NOW)).toBe('draft');
  });
});

describe('postReadiness (spec §2.3)', () => {
  const READY = { content: '## A\n\nB', excerpt: 'C', hasCover: true };

  it('đủ ba thứ thì rỗng', () => {
    expect(postReadiness(READY)).toEqual([]);
  });

  it('thiếu cả ba thì liệt kê đúng thứ tự form bày', () => {
    expect(postReadiness({ content: '', excerpt: null, hasCover: false })).toEqual([
      'content',
      'excerpt',
      'cover',
    ]);
  });

  it('chỉ có khoảng trắng tính là thiếu', () => {
    expect(postReadiness({ ...READY, content: ' \n\t ', excerpt: '   ' })).toEqual([
      'content',
      'excerpt',
    ]);
  });
});

describe('postContentIssue (spec §2.4)', () => {
  it.each([
    ['ảnh nhúng', 'Look ![Ha Long](https://example.com/bay.jpg) here', 'image'],
    // Vòng review P4e-4: regex cũ chỉ bắt dạng `![alt](url)` — bốn dạng dưới lọt qua mà
    // react-markdown vẫn vẽ `<img>`.
    ['ảnh dạng tham chiếu', '![Ha Long][bay]\n\n[bay]: https://example.com/bay.jpg', 'image'],
    ['ảnh dạng tắt', '![bay]\n\n[bay]: https://example.com/bay.jpg', 'image'],
    ['alt lồng ngoặc', '![a [b] c](https://example.com/bay.jpg)', 'image'],
    ['alt có ngoặc thoát', '![a\\]b](https://example.com/bay.jpg)', 'image'],
    ['thẻ mở và đóng', 'Hello <b>world</b>', 'html'],
    ['thẻ đóng đứng một mình', 'end of line</p>', 'html'],
    ['thẻ tự đóng', 'line<br/>break', 'html'],
    ['thẻ có thuộc tính', '<a href="https://example.com">x</a>', 'html'],
    ['chú thích HTML', 'a <!-- note --> b', 'html'],
  ])('bắt %s', (_, content, issue) => {
    expect(postContentIssue(content)).toBe(issue);
  });

  it.each([
    ['dấu < đứng một mình', 'a < b and c > d'],
    ['"<3"', 'we <3 pho'],
    ['autolink', 'see <https://example.com>'],
    ['link markdown', 'see [the map](https://example.com)'],
    ['dấu chấm than trước link, có cách', 'Wow! [the map](https://example.com)'],
    ['đậm và nghiêng', '**bold** and *italic*'],
  ])('cho qua %s', (_, content) => {
    expect(postContentIssue(content)).toBeNull();
  });
});

describe('normalizePostTags (spec §2.5)', () => {
  it('trim, bỏ trùng theo slug và giữ cách viết của lần đầu', () => {
    expect(normalizePostTags(['Hội An', ' Hoi An ', 'Food'])).toEqual([
      { slug: 'hoi-an', name: 'Hội An' },
      { slug: 'food', name: 'Food' },
    ]);
  });

  it('bỏ tên rỗng và tên chỉ có ký hiệu', () => {
    expect(normalizePostTags(['', '!!!', 'Food'])).toEqual([{ slug: 'food', name: 'Food' }]);
  });
});

describe('AdminPostUpdateInputSchema (spec §3.2)', () => {
  it('nhận một lần lưu đủ trường; tóm tắt chỉ có khoảng trắng thành null', () => {
    const parsed = update({ excerpt: '   ' });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.excerpt).toBeNull();
  });

  it('PUBLISHED phải có ngày đăng; DRAFT thì không', () => {
    const missing = update({ publishedAt: null });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(['publishedAt']);
    expect(update({ status: 'DRAFT', publishedAt: null }).success).toBe(true);
  });

  it.each([
    ['tiêu đề', { title: text(POST_TITLE_MAX) }, { title: text(POST_TITLE_MAX + 1) }],
    ['tóm tắt', { excerpt: text(POST_EXCERPT_MAX) }, { excerpt: text(POST_EXCERPT_MAX + 1) }],
    ['thân bài', { content: text(POST_CONTENT_MAX) }, { content: text(POST_CONTENT_MAX + 1) }],
    [
      'số tag',
      { tags: many(POST_TAGS_MAX, (i) => `Tag ${i}`) },
      { tags: many(POST_TAGS_MAX + 1, (i) => `Tag ${i}`) },
    ],
    ['tên tag', { tags: [text(POST_TAG_NAME_MAX)] }, { tags: [text(POST_TAG_NAME_MAX + 1)] }],
    [
      'số tour',
      { relatedTourIds: many(POST_RELATED_TOURS_MAX, tourId) },
      { relatedTourIds: many(POST_RELATED_TOURS_MAX + 1, tourId) },
    ],
    [
      'alt ảnh bìa',
      { cover: { ...COVER, alt: text(POST_COVER_ALT_MAX) } },
      { cover: { ...COVER, alt: text(POST_COVER_ALT_MAX + 1) } },
    ],
  ])('trần %s: N qua, N+1 bị bắt', (_, atMax, overMax) => {
    expect(update(atMax).success).toBe(true);
    expect(update(overMax).success).toBe(false);
  });

  it('một tour chỉ được có mặt một lần', () => {
    expect(update({ relatedTourIds: [tourId(1), tourId(1)] }).success).toBe(false);
  });

  it('tag chỉ có ký hiệu bị bắt', () => {
    expect(update({ tags: ['!!!'] }).success).toBe(false);
  });

  it('thân bài quá trần: dừng ở lỗi độ dài, không quét tiếp luật nội dung', () => {
    // Zod 4 mặc định vẫn chạy refine sau lỗi `max` — chuỗi dán nhầm cả file bị quét thêm
    // hai lượt. `abort` cắt ở đây nên chỉ còn MỘT lỗi.
    const content = '![x](y)'.repeat(Math.ceil(POST_CONTENT_MAX / 7) + 1);
    expect(postContentIssue(content)).toBe('image');
    const result = update({ content });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.code)).toEqual(['too_big']);
  });

  it('thân bài có ảnh nhúng hay HTML thô bị bắt', () => {
    expect(update({ content: '![x](https://example.com/x.jpg)' }).success).toBe(false);
    expect(update({ content: '<div>x</div>' }).success).toBe(false);
  });

  it('ảnh bìa mới tải mang metadata Cloudinary; cột INT4 không nhận số vượt 2^31', () => {
    expect(update({ cover: { ...COVER, upload: UPLOAD } }).success).toBe(true);
    expect(
      update({ cover: { ...COVER, upload: { ...UPLOAD, width: 2_147_483_648 } } }).success,
    ).toBe(false);
  });

  it('nháp không ảnh bìa gửi `cover: null`', () => {
    expect(update({ status: 'DRAFT', cover: null }).success).toBe(true);
  });
});

describe('AdminPostCreateInputSchema (spec §2.1)', () => {
  it('slug: trần 80 và đúng hình dạng', () => {
    const create = (slug: string) => AdminPostCreateInputSchema.safeParse({ title: 'A', slug });
    expect(create(text(POST_SLUG_MAX)).success).toBe(true);
    expect(create(text(POST_SLUG_MAX + 1)).success).toBe(false);
    expect(create('Bad Slug').success).toBe(false);
  });
});

describe('AdminPostsListQuerySchema', () => {
  it('mặc định: mọi trạng thái, trang 1, 20 dòng', () => {
    expect(AdminPostsListQuerySchema.parse({})).toEqual({ page: 1, limit: 20, status: 'all' });
  });

  it('trạng thái lạ bị bắt', () => {
    expect(AdminPostsListQuerySchema.safeParse({ status: 'archived' }).success).toBe(false);
  });
});

describe('AdminPostDetailSchema', () => {
  it('nhận bài không ảnh bìa, tác giả không tên', () => {
    const detail = {
      id: ID,
      slug: 'a',
      title: 'A',
      excerpt: null,
      content: '',
      status: 'DRAFT',
      publishedAt: null,
      displayStatus: 'draft',
      readiness: ['content', 'excerpt', 'cover'],
      tags: [],
      relatedTours: [],
      cover: null,
      author: { name: null },
      version: VERSION,
      createdAt: VERSION,
    };
    expect(AdminPostDetailSchema.safeParse(detail).success).toBe(true);
  });
});

describe('contract.admin.posts (spec §3.1)', () => {
  type Procedure = { '~orpc': { errorMap?: object } };
  const codes = (procedure: Procedure) => Object.keys(procedure['~orpc'].errorMap ?? {}).sort();
  const status = (procedure: Procedure, code: string) =>
    (procedure['~orpc'].errorMap as Record<string, { status?: number }> | undefined)?.[code]
      ?.status;
  const p = contract.admin.posts;

  it('route của bảy thao tác', () => {
    expect(p.list['~orpc'].route).toMatchObject({ method: 'GET', path: '/api/admin/posts' });
    expect(p.get['~orpc'].route).toMatchObject({ method: 'GET', path: '/api/admin/posts/{slug}' });
    expect(p.create['~orpc'].route).toMatchObject({ method: 'POST', path: '/api/admin/posts' });
    expect(p.update['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/api/admin/posts/{id}',
    });
    expect(p.delete['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/api/admin/posts/{id}/delete',
    });
    expect(p.signCoverUpload['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/api/admin/posts/{id}/cover-upload',
    });
    expect(p.tags['~orpc'].route).toMatchObject({ method: 'GET', path: '/api/admin/post-tags' });
  });

  it('mỗi thao tác khai ĐÚNG tập mã của spec', () => {
    expect(codes(p.list)).toEqual([]);
    expect(codes(p.get)).toEqual(['NOT_FOUND']);
    expect(codes(p.create)).toEqual(['SLUG_TAKEN']);
    expect(codes(p.update)).toEqual([
      'NOT_FOUND',
      'PHOTO_NOT_ALLOWED',
      'POST_NOT_READY',
      'RELATED_TOUR_NOT_FOUND',
      'STALE_POST',
    ]);
    expect(codes(p.delete)).toEqual(['NOT_FOUND', 'STALE_POST']);
    expect(codes(p.signCoverUpload)).toEqual(['MEDIA_UPLOAD_NOT_CONFIGURED', 'NOT_FOUND']);
    expect(codes(p.tags)).toEqual([]);
  });

  it('status của từng mã như spec §3.2', () => {
    expect(status(p.update, 'STALE_POST')).toBe(409);
    expect(status(p.update, 'POST_NOT_READY')).toBe(409);
    expect(status(p.update, 'PHOTO_NOT_ALLOWED')).toBe(400);
    expect(status(p.update, 'RELATED_TOUR_NOT_FOUND')).toBe(404);
    expect(status(p.create, 'SLUG_TAKEN')).toBe(409);
    expect(status(p.signCoverUpload, 'MEDIA_UPLOAD_NOT_CONFIGURED')).toBe(503);
  });
});
