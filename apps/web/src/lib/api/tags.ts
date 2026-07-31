/**
 * Taxonomy cache-tag DUY NHẤT của web (ADR-0016 §3) — mỗi fetch public gắn tag
 * từ đây để bước on-demand revalidation (sau bước nối 1–4) chỉ còn thêm
 * endpoint, không phải đi cắm lại tag. Mẫu theo lib/revalidate.ts của Nexora.
 */
export const TAGS = {
  POSTS: 'posts',
} as const;

/** Tag theo từng bài — bust một bài không đụng cache list. */
export function postTag(slug: string): string {
  return `post:${slug}`;
}
