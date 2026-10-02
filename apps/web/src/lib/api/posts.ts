import { isDefinedError, safe } from '@orpc/client';
import type { MediaItem, PostCard, PostDetail, PostTag } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cache } from 'react';
import { api } from './client';
import { collectAllPages } from './collect-pages';
import { postTag, TAGS } from './tags';
import type { TourCardVM } from './tours';

/**
 * VM listing — GIỮ TÊN FIELD của mock journal cũ (đã khai tử Task 10) để
 * component đổi tối thiểu khi gắn API (Task 7–9). `tags` là mảng ĐẦY ĐỦ từ
 * DTO — chip lọc phụ (`filterPostsByTag`) cần phủ CẢ tag không phải category
 * hiển thị.
 */
export interface JournalPost {
  slug: string;
  title: string;
  excerpt: string;
  /** YYYY-MM-DD — cắt từ `publishedAt` (ISO datetime). */
  date: string;
  /** Dẫn xuất từ nội dung — contract không trả field này. */
  readMinutes: number;
  /** Tên tag ĐẦU TIÊN — chip hiển thị trên card/hero. */
  category: string;
  /** `author.name` DTO, hoặc `messages.blog.fallbackAuthor` khi null. */
  author: string;
  /** Ảnh bìa — `null` khi bài chưa có ảnh; card/hero tự rơi về giữ chỗ. */
  cover: MediaItem | null;
  tags: { slug: string; name: string }[];
}

export interface JournalPostDetail extends JournalPost {
  contentMarkdown: string;
  /** Tour admin gắn với bài, theo thứ tự admin xếp; API đã bỏ tour đang tắt bán (ADR-0051 §5). */
  relatedTours: TourCardVM[];
}

/** ~200 từ/phút (chuẩn ngành, Nexora dùng cùng số), làm tròn lên, tối thiểu 1 phút. */
export function deriveReadMinutes(content: string): number {
  const wordCount = content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

/** Map field chung cho cả card và detail — tránh lặp giữa toJournalPost/toJournalPostDetail. */
function mapCommon(dto: PostCard): JournalPost {
  const firstTag = dto.tags[0];
  return {
    slug: dto.slug,
    title: dto.title,
    // publishedAt là ISO datetime ('2026-07-22T08:00:00.000Z') → cắt 10 ký tự
    // đầu ra YYYY-MM-DD, KHÔNG dựng new Date() (tránh lệch múi giờ).
    excerpt: dto.excerpt ?? '',
    date: dto.publishedAt.slice(0, 10),
    readMinutes: deriveReadMinutes(dto.excerpt ?? ''),
    category: firstTag?.name ?? messages.blog.fallbackCategory,
    author: dto.author.name ?? messages.blog.fallbackAuthor,
    cover: dto.cover,
    tags: dto.tags,
  };
}

export function toJournalPost(dto: PostCard): JournalPost {
  return mapCommon(dto);
}

export function toJournalPostDetail(dto: PostDetail): JournalPostDetail {
  return {
    ...mapCommon(dto),
    // Detail có content thật → readMinutes tính lại trên content đầy đủ thay
    // vì excerpt (mapCommon chỉ có excerpt vì PostCard không có content).
    readMinutes: deriveReadMinutes(dto.content),
    contentMarkdown: dto.content,
    relatedTours: dto.relatedTours,
  };
}

const REVALIDATE_SEC = 300; // ADR-0016 §3 — con số Nexora đã vận hành

/** Cỡ trang của danh sách bài — trần `PageQuerySchema.pageSize` là 100; 50 như danh sách tour. */
const POSTS_PAGE_SIZE = 50;

/**
 * Trần số trang `fetchPosts` đi qua: 20 × 50 = 1000 bài, xa hơn mọi con số dự án chạm tới.
 * Chỉ để một `totalPages` hỏng từ API không kéo build đi vô tận.
 */
const MAX_POST_PAGES = 20;

/**
 * MỌI bài đã đăng, mới nhất trước — đi hết các trang (khuôn G10 của tour). Trước P4e-4 chỉ
 * lấy trang 1 với 50 bài: admin đăng bài thứ 51 là bài cũ nhất lặng lẽ rời `/blog`, sitemap
 * và điều hướng cuối bài. Mỗi trang gắn `TAGS.POSTS` để revalidate theo taxonomy chung.
 */
export async function fetchPosts(): Promise<JournalPost[]> {
  const { items, totalPages } = await collectAllPages(
    (page) =>
      api.posts.list(
        { page, pageSize: POSTS_PAGE_SIZE, sort: 'publishedAt', order: 'desc' },
        { context: { next: { revalidate: REVALIDATE_SEC, tags: [TAGS.POSTS] } } },
      ),
    { maxPages: MAX_POST_PAGES, key: (post) => post.id },
  );
  // Chạm trần thì nói ra, đừng lặng lẽ cắt — lặng lẽ cắt chính là lỗi G10.
  if (totalPages > MAX_POST_PAGES) {
    console.warn(`[fetchPosts] có ${totalPages} trang bài, chỉ lấy ${MAX_POST_PAGES} trang đầu`);
  }
  return items.map(toJournalPost);
}

/** Tag toàn cục kèm số bài published — nguồn chip lọc /blog. */
export async function fetchPostTags(): Promise<PostTag[]> {
  return api.posts.tags(undefined, {
    context: { next: { revalidate: REVALIDATE_SEC, tags: [TAGS.POSTS] } },
  });
}

/**
 * Chi tiết một bài theo slug. Bọc React `cache()`: `generateMetadata` và thân
 * trang gọi hàm này TRONG CÙNG MỘT REQUEST chỉ tốn một fetch (ADR-0016 §2).
 * Trả `null` CHỈ khi lỗi định danh POST_NOT_FOUND (nhánh 404 hợp lệ, page gọi
 * `notFound()`); mọi lỗi khác ném lại để error boundary xử lý.
 *
 * Tag `tours` đóng G9 (ADR-0051 §6): mọi lệnh ghi tour vốn đã bust tag này, nên tắt bán
 * hay xoá một tour gắn trong bài thì trang bài cũng tươi lại — API không phải tra
 * `post_tours` trước khi xoá tour.
 */
export const fetchPostDetail = cache(async (slug: string): Promise<JournalPostDetail | null> => {
  const [error, data] = await safe(
    api.posts.bySlug(
      { slug },
      { context: { next: { revalidate: REVALIDATE_SEC, tags: [postTag(slug), TAGS.TOURS] } } },
    ),
  );
  if (error) {
    if (isDefinedError(error) && error.code === 'POST_NOT_FOUND') return null;
    throw error;
  }
  return toJournalPostDetail(data);
});
