import { isDefinedError, safe } from '@orpc/client';
import type { PostCard, PostDetail, PostTag } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cache } from 'react';
import { api } from './client';
import { postTag, TAGS } from './tags';

/**
 * VM listing — GIỮ TÊN FIELD của MockJournalPost (mocks/types.ts) để component
 * đổi tối thiểu khi gắn API (Task 7–9). `tags` là mảng ĐẦY ĐỦ từ DTO — chip
 * lọc phụ (`filterPostsByTag`) cần phủ CẢ tag không phải category hiển thị.
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
  tags: { slug: string; name: string }[];
}

export interface JournalPostDetail extends JournalPost {
  contentMarkdown: string;
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
  };
}

const REVALIDATE_SEC = 300; // ADR-0016 §3 — con số Nexora đã vận hành

/** Danh sách bài published, mới nhất trước. Gắn tag TAGS.POSTS để revalidate
    theo taxonomy chung (ADR-0016 §3). */
export async function fetchPosts(): Promise<JournalPost[]> {
  // pageSize 50: đủ cho khối lượng hiện tại (9 bài mock); server-side
  // pagination là nợ có điều kiện kích hoạt ghi ở spec §2C.
  const page = await api.posts.list(
    { page: 1, pageSize: 50, sort: 'publishedAt', order: 'desc' },
    { context: { next: { revalidate: REVALIDATE_SEC, tags: [TAGS.POSTS] } } },
  );
  return page.items.map(toJournalPost);
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
 */
export const fetchPostDetail = cache(async (slug: string): Promise<JournalPostDetail | null> => {
  const [error, data] = await safe(
    api.posts.bySlug(
      { slug },
      { context: { next: { revalidate: REVALIDATE_SEC, tags: [postTag(slug)] } } },
    ),
  );
  if (error) {
    if (isDefinedError(error) && error.code === 'POST_NOT_FOUND') return null;
    throw error;
  }
  return toJournalPostDetail(data);
});
