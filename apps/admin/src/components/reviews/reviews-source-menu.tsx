'use client';

import { messages } from '@tourism/i18n';
import { PenLineIcon, ShapesIcon, TicketIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL } from '@/components/kit/filter-value';
import {
  ToolbarFilterMenu,
  type ToolbarFilterMenuGroup,
} from '@/components/kit/toolbar-filter-menu';
import { parseReviewSource, type ReviewsQuery, reviewsHref } from '@/lib/reviews-query';

/**
 * Lọc theo NGUỒN của `/reviews` — kit `ToolbarFilterMenu`, consumer thứ năm.
 *
 * Trả nợ 05/09: `AdminReviewsQuerySchema` khai `source` và service lọc thật từ
 * F4, nhưng toolbar chưa bao giờ có ô để bấm — ngược đúng cái luật mà JSDoc
 * của chính toolbar viện ra ("đừng dựng ô tìm kiếm giả cho tham số server
 * không đọc"). Ở đây là ngược lại: server đọc mà UI không dựng.
 *
 * KHÔNG có `toFreeValue`/`unknownItem` như `/payment-events` và
 * `/subscribers`: `source` là enum ĐÓNG hai member, không phải chuỗi tự do từ
 * DB. Không có giá trị lạ nào lọt được tới đây (`parseReviewSource` vứt hết ở
 * tầng URL), và không member nào trùng sentinel `'ALL'` — nên tiền tố `v:` chỉ
 * là lớp bọc thừa che mất chính chuỗi đang nằm trên URL.
 *
 * Nhãn hai mục mượn `admin.reviews.source`, đúng chữ mà cột State của bảng
 * đang in. Bịa hai chữ mới ở đây là dạy admin hai bảng chữ cái cho một khái
 * niệm.
 */
const t = messages.admin.reviews.list;

/** Icon né hết bộ đang có trên trang: tab trạng thái (list/clock/circle-check/
 *  circle-x) và menu Columns (user/star/map-pin/tag/calendar). */
const SOURCE_GROUP: ToolbarFilterMenuGroup = {
  key: 'source',
  items: [
    // Vé: review này có một booking thật sau lưng — cùng glyph mà sidebar dùng
    // cho Bookings, vì đó đúng là thứ nó trỏ tới.
    { value: 'VERIFIED', label: messages.admin.reviews.source.VERIFIED, icon: TicketIcon },
    // Bút: người trong nhà ngồi viết, không có khách nào ở đây.
    { value: 'CURATED', label: messages.admin.reviews.source.CURATED, icon: PenLineIcon },
  ],
};

const ALL_ITEM = { value: ALL, label: t.sourceAll, icon: ShapesIcon };

export function ReviewsSourceMenu({ query }: { query: ReviewsQuery }) {
  const router = useRouter();

  return (
    <ToolbarFilterMenu
      label={t.sourceLabel}
      value={query.source ?? ALL}
      allItem={ALL_ITEM}
      groups={[SOURCE_GROUP]}
      // `parseReviewSource` trả null cho mọi thứ lạ (kể cả sentinel ALL) —
      // CHÍNH hàm đường URL dùng, nên menu và URL không thể hiểu khác nhau.
      onSelect={(next) => router.push(reviewsHref(query, { source: parseReviewSource(next) }))}
    />
  );
}
