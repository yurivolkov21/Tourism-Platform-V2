import {
  type AdminPostTag,
  foldAccents,
  normalizePostTags,
  POST_RELATED_TOURS_MAX,
  POST_TAG_NAME_MAX,
  POST_TAGS_MAX,
  slugifyVietnamese,
} from '@tourism/contract';
import type { PostTourDraft, PostTourOption } from './post-form';

/**
 * Logic THUẦN của hai card chọn ở cột phải trang sửa bài (spec P4e-4 §4.4): thêm tag, gợi ý
 * tag, lọc tour. Ô nhập kèm danh sách nút, không Combobox nổi (Quyết định 13). So chữ bằng
 * `foldAccents` của contract — gõ "hoi an" khớp "Hội An".
 */

export type AddTagResult =
  | { ok: true; tags: string[] }
  | { ok: false; reason: 'empty' | 'invalid' | 'tooLong' | 'duplicate' | 'full' };

/** Thêm một tag theo luật của contract (spec §2.5): trim, trùng THEO SLUG là trùng, tối đa 5. */
export function addTag(tags: readonly string[], raw: string): AddTagResult {
  const name = raw.trim();
  if (name === '') return { ok: false, reason: 'empty' };
  if (name.length > POST_TAG_NAME_MAX) return { ok: false, reason: 'tooLong' };
  const slug = slugifyVietnamese(name, POST_TAG_NAME_MAX);
  if (slug === '') return { ok: false, reason: 'invalid' };
  // Trùng xét TRƯỚC trần: gõ lại một tag đã có thì "đã có" đúng hơn "đã đủ".
  if (normalizePostTags(tags).some((tag) => tag.slug === slug)) {
    return { ok: false, reason: 'duplicate' };
  }
  if (tags.length >= POST_TAGS_MAX) return { ok: false, reason: 'full' };
  return { ok: true, tags: [...tags, name] };
}

/** Số gợi ý tối đa dưới ô Tags. */
export const TAG_SUGGESTIONS_MAX = 8;

/**
 * Gợi ý tag: tag đã có (chưa gắn bài này) mà tên chứa chữ đang gõ; ô trống thì gợi ý tag
 * dùng nhiều nhất. Dùng nhiều trước, cùng số thì theo tên — gợi ý dùng lại tag cũ để không
 * mọc ra "Food" và "Foods" song song.
 */
export function tagSuggestions(
  all: readonly AdminPostTag[],
  current: readonly string[],
  query: string,
): AdminPostTag[] {
  const taken = new Set(normalizePostTags(current).map((tag) => tag.slug));
  const needle = foldAccents(query.trim());
  return all
    .filter((tag) => !taken.has(tag.slug) && foldAccents(tag.name).includes(needle))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, TAG_SUGGESTIONS_MAX);
}

/** Số tour tối đa dưới ô tìm tour. */
export const TOUR_MATCHES_MAX = 5;

/** Tour khớp chữ đang gõ, chưa có trong bài; ô trống thì không gợi ý gì. */
export function tourMatches(
  options: readonly PostTourOption[],
  selected: readonly PostTourDraft[],
  query: string,
): PostTourOption[] {
  const needle = foldAccents(query.trim());
  if (needle === '') return [];
  const taken = new Set(selected.map((tour) => tour.id));
  return options
    .filter((tour) => !taken.has(tour.id) && foldAccents(tour.title).includes(needle))
    .slice(0, TOUR_MATCHES_MAX);
}

/** Thêm một tour vào CUỐI (thứ tự là thứ tự web hiện); đã có hay đã đủ thì giữ nguyên. */
export function addTour(selected: readonly PostTourDraft[], tour: PostTourOption): PostTourDraft[] {
  if (selected.length >= POST_RELATED_TOURS_MAX || selected.some((item) => item.id === tour.id)) {
    return [...selected];
  }
  return [...selected, { key: tour.id, ...tour }];
}
