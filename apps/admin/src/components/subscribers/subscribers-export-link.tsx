'use client';

import { messages } from '@tourism/i18n';
import { ExportButton } from '@/components/kit/export-button';
import { EXPORT_MAX_ROWS } from '@/lib/export-pages';
import { type SubscribersQuery, subscribersExportHref } from '@/lib/subscribers-query';

/**
 * Nút Export CSV của `/subscribers` (spec P4c §3-F10) — kit `ExportButton`
 * (user chốt 01/09: nút sống trong ô tiêu đề bảng, và hai vùng có export thì
 * phải là cùng một nút).
 *
 * Khác `/bookings` đúng một điều: KHÔNG có xuất theo-lựa-chọn. Vùng này không
 * có cột checkbox — spec F10 chỉ hứa "tập đang lọc", và việc chọn tay từng
 * địa chỉ trong một danh sách gửi thư không phải câu hỏi ai đang hỏi (chọn
 * tập bằng tab + nguồn + ô tìm mới là cách người ta cắt danh sách này).
 *
 * Tập vượt trần thì nút TẮT kèm lý do, không để admin bấm rồi bị đá sang một
 * trang 413 — `total` đến từ chính response của list nên nó là con số của
 * đúng bộ lọc đang xem.
 */
const t = messages.admin.subscribers.list;

export function SubscribersExportLink({
  query,
  total,
}: {
  query: SubscribersQuery;
  total: number;
}) {
  const tooLarge = total > EXPORT_MAX_ROWS;

  return (
    <ExportButton
      label={t.exportCsv}
      href={tooLarge ? undefined : subscribersExportHref(query)}
      disabledReason={tooLarge ? t.exportTooLarge(total, EXPORT_MAX_ROWS) : undefined}
    />
  );
}
