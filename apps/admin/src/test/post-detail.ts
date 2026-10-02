import {
  type AdminPostDetail,
  AdminPostDetailSchema,
  postDisplayStatus,
  postReadiness,
} from '@tourism/contract';

/**
 * Fixture `AdminPostDetail` DÙNG CHUNG cho mọi spec admin của P4e-4 — cùng nếp
 * `tour-detail.ts`: contract thêm một field là sửa đúng một chỗ.
 *
 * Gốc là một bài ĐÃ ĐĂNG, đủ để đăng, ảnh bìa tải lên, một tag, một tour liên quan. Ca test
 * đè đúng thứ nó cần bằng `patch`. `displayStatus` và `readiness` là phần SUY RA — fixture
 * tính bằng CHÍNH hàm của contract sau khi đè (trừ khi ca test đè thẳng chúng), rồi parse
 * qua schema để một fixture lệch hình dạng đỏ ngay ở đây.
 */
export const POST_ID = '7a1b2c3d-0000-4000-8000-0000000000b1';
export const POST_VERSION = '2026-10-02T10:11:12.345Z';
/** Mốc "bây giờ" mà fixture dùng để suy `displayStatus`. */
export const FIXTURE_NOW = new Date('2026-10-02T12:00:00.000Z');
export const TOUR_A = {
  id: '7a1b2c3d-0000-4000-8000-0000000000e1',
  slug: 'hoi-an-food-walk',
  title: 'Hoi An Food Walk',
  isPublished: true,
};
export const TOUR_B = {
  id: '7a1b2c3d-0000-4000-8000-0000000000e2',
  slug: 'my-son-sunrise',
  title: 'My Son Sunrise',
  isPublished: false,
};

export function postDetailFixture(patch: Partial<AdminPostDetail> = {}): AdminPostDetail {
  const base: Omit<AdminPostDetail, 'displayStatus' | 'readiness'> = {
    id: POST_ID,
    slug: 'eating-your-way-through-hoi-an',
    title: 'Eating your way through Hội An',
    excerpt: 'Five stalls before noon.',
    content: '## Morning\n\nBánh mì first.',
    status: 'PUBLISHED',
    publishedAt: '2026-10-01T08:00:00.000Z',
    tags: [{ slug: 'food', name: 'Food' }],
    relatedTours: [TOUR_A],
    cover: {
      publicId: `tourism/posts/${POST_ID}/cover`,
      url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/posts/${POST_ID}/cover`,
      alt: 'Lanterns over the river',
      source: 'UPLOAD',
    },
    author: { name: 'Seed Admin' },
    version: POST_VERSION,
    createdAt: '2026-09-30T00:00:00.000Z',
    // `patch` có thể mang cả `displayStatus`/`readiness` — chúng đè phần suy ra bên dưới.
    ...patch,
  };
  return AdminPostDetailSchema.parse({
    displayStatus: postDisplayStatus(base.status, base.publishedAt, FIXTURE_NOW),
    readiness: postReadiness({
      content: base.content,
      excerpt: base.excerpt,
      hasCover: base.cover !== null,
    }),
    ...base,
  });
}
