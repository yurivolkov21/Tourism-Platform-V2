'use client';

import { messages } from '@tourism/i18n';
import { ExportButton } from '@/components/kit/export-button';
import { EXPORT_MAX_ROWS } from '@/lib/export-pages';
import { type SubscribersQuery, subscribersExportHref } from '@/lib/subscribers-query';

/**
 * Nút Export Excel của `/subscribers` (spec P4c §3-F10) — kit `ExportButton`
 * (user chốt 01/09: nút sống trong ô tiêu đề bảng, và hai vùng có export thì
 * phải là cùng một nút).
 *
 * Hai chế độ như `/bookings` từ G43 (13/10), và nhãn nói rõ đang ở chế độ nào
 * TRƯỚC cú bấm:
 *
 * - **Không tích gì** → xuất CẢ TẬP đang lọc. Tập vượt trần thì nút TẮT kèm lý
 *   do, không để admin bấm rồi bị đá sang một trang 413 — `total` đến từ chính
 *   response của list nên nó là con số của đúng bộ lọc đang xem.
 * - **Có tích** → xuất đúng các hàng ấy. Trần KHÔNG áp: việc chọn khoá trong
 *   trang đang xem nên số hàng ≤ `limit` (tối đa 100).
 *
 * Bản đầu (F10) cố ý không có chế độ thứ hai vì "chọn tay từng địa chỉ không
 * phải câu hỏi ai đang hỏi". User hỏi đúng câu ấy ở lượt thử tay production
 * G40 Phần 3 (12/10), nên G43 thêm vào.
 */
const t = messages.admin.subscribers.list;

export function SubscribersExportLink({
  query,
  total,
  selected,
}: {
  query: SubscribersQuery;
  total: number;
  /** Id các hàng đã tích trên TRANG ĐANG XEM; rỗng nghĩa là xuất cả tập lọc. */
  selected: readonly string[];
}) {
  const label = selected.length ? t.exportSelected(selected.length) : t.exportExcel;
  const tooLarge = selected.length === 0 && total > EXPORT_MAX_ROWS;

  return (
    <ExportButton
      label={label}
      href={tooLarge ? undefined : subscribersExportHref(query, selected)}
      disabledReason={tooLarge ? t.exportTooLarge(total, EXPORT_MAX_ROWS) : undefined}
    />
  );
}
