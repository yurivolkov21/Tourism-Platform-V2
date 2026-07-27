import type { MockJournalPost } from '@/mocks/types';
import { foldAccents } from './text';

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
  // So sánh tường minh theo chuyên mục (thay vì reference-identity qua
  // `sameCategory.includes(post)`) — cùng kết quả nhưng không còn phụ thuộc
  // ngầm vào việc sameCategory/filler được lọc ra từ CÙNG mảng `sorted`.
  const sameCategory = current ? sorted.filter((post) => post.category === current.category) : [];
  const filler = current ? sorted.filter((post) => post.category !== current.category) : sorted;
  return [...sameCategory, ...filler].slice(0, limit);
}

/** Tìm theo tiêu đề + excerpt, bỏ dấu cả hai phía — gõ "bun cha" vẫn ra
    "bún chả". `foldAccents` nay ở lib/text vì tours cũng dùng. */
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
  return latestPosts(posts, HOME_TEASER_COUNT);
}

/**
 * `count` bài mới nhất — dạng tổng quát của `homeTeaserPosts`, cho chỗ nào
 * cần "vài bài gần đây" mà không phải teaser Home. Hiện chỉ `homeTeaserPosts`
 * gọi tới; giữ tách ra vì "sắp mới-nhất-trước rồi cắt" là bất biến riêng,
 * đáng có test canh độc lập với con số 3 của Home.
 */
export function latestPosts(posts: readonly MockJournalPost[], count: number): MockJournalPost[] {
  return sortPostsByDate(posts).slice(0, Math.max(0, count));
}
