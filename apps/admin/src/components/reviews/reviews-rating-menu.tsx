'use client';

import { messages } from '@tourism/i18n';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL } from '@/components/kit/filter-value';
import {
  ToolbarFilterMenu,
  type ToolbarFilterMenuGroup,
} from '@/components/kit/toolbar-filter-menu';
import { parseReviewRating, type ReviewsQuery, reviewsHref } from '@/lib/reviews-query';

/**
 * Lọc theo SỐ SAO của `/reviews` — kit `ToolbarFilterMenu`, cùng đợt trả nợ
 * 05/09 với `ReviewsSourceMenu`.
 *
 * KHÔNG icon, kể cả mục "tất cả" — quyết định, không phải bỏ sót. Năm mục đều
 * là sao thì năm glyph giống hệt nhau là nhiễu, còn cho mỗi mục một glyph khác
 * nhau là bịa ra ý nghĩa mà "4 sao" vốn không có. Bỏ trắng cả menu thì nút
 * trông NHƯ NHAU ở mọi trạng thái; để icon riêng cho `allItem` sẽ làm nút nhấp
 * nháy có/không icon mỗi lần đổi bộ lọc.
 *
 * 5 sao đứng TRƯỚC: người duyệt đi tìm bài khen giả nhiều hơn bài một sao, và
 * thứ tự giảm dần cũng là thứ tự mọi bộ lọc đánh giá ngoài đời quen dùng.
 */
const t = messages.admin.reviews.list;

const RATING_GROUP: ToolbarFilterMenuGroup = {
  key: 'rating',
  items: [5, 4, 3, 2, 1].map((stars) => ({
    value: String(stars),
    label: t.ratingStars(stars),
  })),
};

const ALL_ITEM = { value: ALL, label: t.ratingAll };

export function ReviewsRatingMenu({ query }: { query: ReviewsQuery }) {
  const router = useRouter();

  return (
    <ToolbarFilterMenu
      label={t.ratingFilterLabel}
      value={query.rating ? String(query.rating) : ALL}
      allItem={ALL_ITEM}
      groups={[RATING_GROUP]}
      // Sentinel `'ALL'` không phải số nên `parseReviewRating` trả null — đúng
      // nghĩa "bỏ lọc". Cùng hàm đường URL dùng, một luật một bản.
      onSelect={(next) => router.push(reviewsHref(query, { rating: parseReviewRating(next) }))}
    />
  );
}
