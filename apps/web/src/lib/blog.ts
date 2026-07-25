import type { MockJournalPost } from '@/mocks/types';

/** Sắp xếp mới-nhất-trước. Trả mảng MỚI — mock là hằng số dùng chung, sửa tại
    chỗ là làm hỏng dữ liệu của mọi trang khác. */
export function sortPostsByDate(posts: readonly MockJournalPost[]): MockJournalPost[] {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date));
}

/** Lọc theo chuyên mục; không truyền thì trả nguyên danh sách. */
export function filterPostsByCategory(
  posts: readonly MockJournalPost[],
  category?: string,
): MockJournalPost[] {
  if (!category) return [...posts];
  return posts.filter((post) => post.category === category);
}

/** Chuyên mục duy nhất, giữ thứ tự xuất hiện — nguồn cho hàng chip lọc. */
export function postCategories(posts: readonly MockJournalPost[]): string[] {
  return [...new Set(posts.map((post) => post.category))];
}

/** Bài liền kề theo dòng thời gian (mới hơn / cũ hơn) của bài đang đọc. */
export function adjacentPosts(
  posts: readonly MockJournalPost[],
  slug: string,
): { newer?: MockJournalPost; older?: MockJournalPost } {
  const sorted = sortPostsByDate(posts);
  const index = sorted.findIndex((post) => post.slug === slug);
  if (index === -1) return { newer: undefined, older: undefined };
  return { newer: sorted[index - 1], older: sorted[index + 1] };
}

/** Bài gợi ý cuối trang: cùng chuyên mục trước, thiếu thì bù bài mới nhất. */
export function relatedPosts(
  posts: readonly MockJournalPost[],
  slug: string,
  limit: number,
): MockJournalPost[] {
  const sorted = sortPostsByDate(posts).filter((post) => post.slug !== slug);
  const current = posts.find((post) => post.slug === slug);
  const sameCategory = current ? sorted.filter((post) => post.category === current.category) : [];
  const filler = sorted.filter((post) => !sameCategory.includes(post));
  return [...sameCategory, ...filler].slice(0, limit);
}

/** Bỏ dấu tiếng Việt để gõ "bun cha" vẫn tìm ra "bún chả" — khách nước ngoài
    không gõ được dấu, mà tên món trong bài thì có dấu đầy đủ. */
function foldAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Tìm theo tiêu đề + excerpt, bỏ dấu cả hai phía. */
export function searchPosts(posts: readonly MockJournalPost[], query: string): MockJournalPost[] {
  const q = foldAccents(query.trim());
  if (!q) return [...posts];
  return posts.filter((post) => foldAccents(`${post.title} ${post.excerpt}`).includes(q));
}

/** Số bài blog hiện ở teaser trang Home — lưới Home là 3 cột. */
export const HOME_TEASER_COUNT = 3;

/**
 * Bài cho teaser Journal trên trang Home: 3 bài mới nhất. Tách thành hàm
 * riêng thay vì `.slice(0, 3)` viết thẳng trong component, để quy tắc này
 * nằm trong vùng có test canh — trước đây sửa số 3 thành 5 mà không test nào
 * đỏ, và Home âm thầm hiện 5 card trong lưới 3 cột.
 */
export function homeTeaserPosts(posts: readonly MockJournalPost[]): MockJournalPost[] {
  return sortPostsByDate(posts).slice(0, HOME_TEASER_COUNT);
}
