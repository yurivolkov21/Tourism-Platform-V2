'use client';

import { messages } from '@tourism/i18n';
import { CircleQuestionMarkIcon, TagIcon, TagsIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, fromFreeValue, toFreeValue } from '@/components/kit/filter-value';
import {
  ToolbarFilterMenu,
  type ToolbarFilterMenuGroup,
} from '@/components/kit/toolbar-filter-menu';
import { type SubscribersQuery, subscribersHref } from '@/lib/subscribers-query';

/**
 * Lọc theo nguồn đăng ký của `/subscribers` — kit `ToolbarFilterMenu` (khuôn
 * `dropdown-menu-10`, user chốt 03/09 đợt 2). Trước 03/09 là `ToolbarSelect`.
 *
 * BA quyết định của F10 phải sống qua lần đổi control này:
 *
 * 1. Danh sách mục đến từ CHÍNH response của list (`sources` distinct toàn
 *    bảng), không phải mảng viết cứng: `source` là chuỗi tự do do đường ghi
 *    tự khai, và hôm nay KHÔNG đường nào khai cả — một danh sách viết cứng sẽ
 *    là danh sách mà mọi mục đều trả 0 hàng.
 * 2. Bảng chưa có nguồn nào thì KHÔNG render gì. Ngày một landing page bắt
 *    đầu gửi `source`, nút tự xuất hiện.
 * 3. Nguồn đang lọc mà không nằm trong danh sách (gõ tay `?source=`, hoặc
 *    hàng cuối cùng của nguồn đó vừa bị lọc mất) vẫn được thêm một mục TẠM —
 *    không có nó thì nút hiện "All sources" trong khi bảng đang lọc thật.
 *
 * Tiền tố `v:` của kit (vòng vá review F10) là bắt buộc ở đây chứ không phải
 * cẩn tắc: đường subscribe là CÔNG KHAI, nên một hàng `source = 'ALL'` trùng
 * sentinel là thứ người ngoài tạo ra được.
 *
 * Icon: `TagIcon` cho mỗi nguồn — đúng icon mà menu Columns của chính bảng
 * này đã dùng cho cột Source, nên nó mang sẵn nghĩa "nguồn" chứ không phải
 * trang trí. Nguồn là chuỗi tự do nên không có icon riêng cho từng giá trị;
 * lặp một icon ở đây là nói "mấy dòng này cùng một loại thứ", đúng sự thật.
 */
const t = messages.admin.subscribers.list;

/** Mục "tất cả": nhiều thẻ chồng nhau — cả trục nguồn, không phải một nguồn. */
const ALL_ITEM = { value: ALL, label: t.sourceAll, icon: TagsIcon };

export function SubscribersSourceMenu({
  query,
  sources,
}: {
  query: SubscribersQuery;
  sources: readonly string[];
}) {
  const router = useRouter();
  const current = query.source;
  const unknown = current !== undefined && !sources.includes(current);

  // Bảng chưa có nguồn nào VÀ không đang lọc theo nguồn lạ: không vẽ gì.
  if (sources.length === 0 && !unknown) return null;

  const groups: ToolbarFilterMenuGroup[] =
    sources.length > 0
      ? [
          {
            key: 'sources',
            items: sources.map((source) => ({
              label: source,
              value: toFreeValue(source),
              icon: TagIcon,
            })),
          },
        ]
      : [];

  return (
    <ToolbarFilterMenu
      label={t.sourceLabel}
      value={current === undefined ? ALL : toFreeValue(current)}
      allItem={ALL_ITEM}
      // Chỗ đứng của mục lạ là việc của kit (nay CUỐI danh sách, trước đây
      // vùng này tự đặt nó lên đầu); vùng chỉ nói khi nào có một cái.
      unknownItem={
        unknown && current !== undefined
          ? { label: current, value: toFreeValue(current), icon: CircleQuestionMarkIcon }
          : undefined
      }
      groups={groups}
      onSelect={(next) => router.push(subscribersHref(query, { source: fromFreeValue(next) }))}
    />
  );
}
