import type { JournalPost } from './api/posts';
import { foldAccents } from './text';

/** Sắp xếp mới-nhất-trước. Trả mảng MỚI — mock/dữ liệu fetch là dùng chung,
    sửa tại chỗ là làm hỏng dữ liệu của mọi trang khác. */
export function sortPostsByDate(posts: readonly JournalPost[]): JournalPost[] {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Lọc theo tag; không truyền thì trả nguyên danh sách. Match trên CẢ mảng
 * `post.tags` (không chỉ `category` — tên tag đầu tiên dùng làm chip hiển
 * thị): chip lọc /blog giờ liệt kê MỌI tag từ endpoint `posts.tags`, nên một
 * bài có tag phụ (vd. "sa-pa") phải lọc ra được dù category hiển thị là
 * "Packing". Thay thế `filterPostsByCategory` cũ (chỉ so `category`).
 */
export function filterPostsByTag(posts: readonly JournalPost[], tagSlug?: string): JournalPost[] {
  if (!tagSlug) return [...posts];
  return posts.filter((post) => post.tags.some((tag) => tag.slug === tagSlug));
}

/** Bài liền kề theo dòng thời gian (mới hơn / cũ hơn) của bài đang đọc. */
export function adjacentPosts(
  posts: readonly JournalPost[],
  slug: string,
): { newer?: JournalPost; older?: JournalPost } {
  const sorted = sortPostsByDate(posts);
  const index = sorted.findIndex((post) => post.slug === slug);
  if (index === -1) return { newer: undefined, older: undefined };
  return { newer: sorted[index - 1], older: sorted[index + 1] };
}

/** Bài gợi ý cuối trang: cùng chuyên mục trước, thiếu thì bù bài mới nhất. */
export function relatedPosts(
  posts: readonly JournalPost[],
  slug: string,
  limit: number,
): JournalPost[] {
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
export function searchPosts(posts: readonly JournalPost[], query: string): JournalPost[] {
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
export function homeTeaserPosts(posts: readonly JournalPost[]): JournalPost[] {
  return latestPosts(posts, HOME_TEASER_COUNT);
}

/**
 * `count` bài mới nhất — dạng tổng quát của `homeTeaserPosts`, cho chỗ nào
 * cần "vài bài gần đây" mà không phải teaser Home. Hiện chỉ `homeTeaserPosts`
 * gọi tới; giữ tách ra vì "sắp mới-nhất-trước rồi cắt" là bất biến riêng,
 * đáng có test canh độc lập với con số 3 của Home.
 */
export function latestPosts(posts: readonly JournalPost[], count: number): JournalPost[] {
  return sortPostsByDate(posts).slice(0, Math.max(0, count));
}
