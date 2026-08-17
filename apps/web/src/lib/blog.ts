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

// ─────────────────────────────────────────────────────────────────────────
// Lọc HAI TRỤC cho filter sidebar /blog (17/08)
//
// Contract chỉ trả MỘT mảng `tags` phẳng, không có trường nào nói tag đó
// thuộc họ nào. Nhưng đo trên 9 bài thật: mỗi bài có đúng một tag chủ đề và
// 8/9 bài có một tag địa danh — hai họ rõ rệt đang bị đổ chung một hàng chip
// xếp theo bảng chữ cái, nên "Culture" nằm cạnh "Da Nang".
//
// Cách phân họ (user chốt 17/08): đối chiếu slug tag với slug ĐỊA DANH lấy từ
// API, thay vì hardcode danh sách ở web — thêm địa danh mới thì không phải sửa
// code. Nhược điểm đã đo được và vá bằng `PLACE_TAGS_NOT_DESTINATIONS` bên
// dưới. Lời giải triệt để là thêm trường `family` cho tag ở contract, nhưng đó
// là đổi schema nên để ADR riêng.
// ─────────────────────────────────────────────────────────────────────────

/** Tag ở dạng tối thiểu — dùng chung cho `PostTag` (có count) lẫn tag trên bài. */
export interface TagLike {
  slug: string;
  name: string;
}

/**
 * Tag ĐỊA DANH không phải slug destination.
 *
 * `lan-ha-bay` là vịnh cạnh Cát Bà; catalog có `cat-ba` và `ha-long` nhưng
 * không có nó, nên chỉ đối chiếu destinations là xếp nhầm nó sang Topic và
 * hiện ngay cạnh "Food" trong sidebar. Giữ danh sách này NGẮN và có lý do:
 * mỗi dòng thêm vào đây là một chỗ dữ liệu và catalog lệch nhau.
 */
const PLACE_TAGS_NOT_DESTINATIONS: ReadonlySet<string> = new Set(['lan-ha-bay']);

/** Tách tag thành hai họ. `destinationSlugs` rỗng (API lỗi) → dồn hết về Topic. */
export function splitTagFamilies<T extends TagLike>(
  tags: readonly T[],
  destinationSlugs: readonly string[],
): { topics: T[]; places: T[] } {
  const dests = new Set(destinationSlugs);
  const isPlace = (slug: string) => dests.has(slug) || PLACE_TAGS_NOT_DESTINATIONS.has(slug);
  return {
    topics: tags.filter((t) => !isPlace(t.slug)),
    places: tags.filter((t) => isPlace(t.slug)),
  };
}

/** Lựa chọn đang bật ở mỗi trục. */
export interface Facets {
  topics?: readonly string[];
  places?: readonly string[];
}

const hasAnyTag = (post: JournalPost, slugs: readonly string[]) =>
  post.tags.some((t) => slugs.includes(t.slug));

/**
 * Lọc theo nhiều trục: trong CÙNG một trục là OR, giữa hai trục là AND.
 *
 * Đây là ngữ nghĩa chuẩn của faceted search và cũng là thứ người dùng chờ đợi:
 * chọn thêm "Markets" cạnh "Food" là NỚI kết quả ra, còn chọn thêm một địa
 * danh là THU hẹp lại.
 */
export function filterPostsByFacets(posts: readonly JournalPost[], facets: Facets): JournalPost[] {
  const topics = facets.topics ?? [];
  const places = facets.places ?? [];
  return posts.filter(
    (post) =>
      (topics.length === 0 || hasAnyTag(post, topics)) &&
      (places.length === 0 || hasAnyTag(post, places)),
  );
}

/**
 * Số bài cho từng tag, tính TRONG tập kết quả — nhưng BỎ QUA lựa chọn của
 * chính trục đang đếm.
 *
 * Vì sao bỏ qua: nếu áp cả lựa chọn của chính nó thì mọi mục chưa chọn trong
 * nhóm đó đều ra 0, và người dùng không bao giờ chọn thêm được giá trị thứ hai
 * cùng nhóm. Trục KIA thì có áp — đó chính là chỗ `PostTagSchema.count` của
 * API nói dối: nó là tổng TOÀN CỤC, giữ nguyên sau khi lọc thì người dùng bấm
 * vào một con số khác 0 rồi nhận về màn hình trống.
 */
export function facetCounts(
  posts: readonly JournalPost[],
  facets: Facets,
  group: 'topics' | 'places',
): FacetCounts {
  const others: Facets = group === 'topics' ? { places: facets.places } : { topics: facets.topics };
  const counts = new Map<string, number>();
  for (const post of filterPostsByFacets(posts, others)) {
    for (const t of post.tags) counts.set(t.slug, (counts.get(t.slug) ?? 0) + 1);
  }
  // Trả bọc mỏng thay vì Map trần: tag chưa xuất hiện phải ra 0 chứ không
  // `undefined` — chỗ gọi in thẳng con số ra giao diện, `undefined` sẽ render
  // thành chữ "undefined". Bọc bằng object hiển nhiên, KHÔNG dùng Proxy: một
  // Map bị Proxy chặn `get` là thứ người đọc sau không đoán được.
  return { get: (slug) => counts.get(slug) ?? 0 };
}

/** Tra số đếm theo slug; tag chưa xuất hiện trả 0. */
export interface FacetCounts {
  get(slug: string): number;
}

/** Trạng thái lọc đọc từ URL, kèm tag của link CŨ nếu có. */
export interface ParsedFacets {
  topics: string[];
  places: string[];
  /** `?tag=` của link cũ — chỉ dùng khi CHƯA có topic/place mới. */
  legacyTag: string | undefined;
}

const splitList = (raw?: string): string[] =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Đọc trạng thái lọc từ query. Giữ `?tag=` của link cũ chạy được — /blog đã
 * phát hành link dạng đó (chip, RSS, chia sẻ), đổi sang `?topic=`/`?place=`
 * mà bỏ rơi nó là làm chết mọi link đã tồn tại.
 */
export function parseFacetParams(params: {
  topic?: string;
  place?: string;
  tag?: string;
}): ParsedFacets {
  const topics = splitList(params.topic);
  const places = splitList(params.place);
  // Có trục mới thì bỏ qua tag cũ — để cả hai cùng chạy sẽ thành hai bộ lọc
  // chồng nhau mà giao diện chỉ hiển thị được một.
  const legacyTag = topics.length === 0 && places.length === 0 ? params.tag?.trim() : undefined;
  return { topics, places, legacyTag: legacyTag || undefined };
}

/** Ngược lại của `parseFacetParams` — trục rỗng thì bỏ hẳn khỏi URL cho sạch. */
export function serializeFacetParams(facets: {
  topics: readonly string[];
  places: readonly string[];
}): { topic?: string; place?: string } {
  const out: { topic?: string; place?: string } = {};
  if (facets.topics.length > 0) out.topic = facets.topics.join(',');
  if (facets.places.length > 0) out.place = facets.places.join(',');
  return out;
}
