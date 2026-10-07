/**
 * Ô "Tours" của bảng danh mục và điểm đến (spec 2026-10-05 §3.3). Tổng tour MỌI trạng thái
 * là dòng chính — chính con số quyết nút Delete (ADR-0053 §5) — còn số tour đang bán là dòng
 * mờ bên dưới. Không có dòng đang bán (0 tour) thì một chữ mờ: hàng ấy là hàng xoá được.
 *
 * Kit chứ không nằm ở vùng: hai bảng dùng y hệt (luật kit ≥ 2 consumer). Chữ do VM nấu sẵn, và
 * `publishedLabel` là nguồn DUY NHẤT quyết một dòng hay hai: VM trả `null` đúng khi 0 tour, nên
 * một prop đếm riêng chỉ mã hoá lại cùng một bit — hai nguồn cho một quyết định là hai thứ có
 * thể lệch nhau (review SI7).
 */
export function TourCountCell({
  totalLabel,
  publishedLabel,
}: {
  totalLabel: string;
  publishedLabel: string | null;
}) {
  if (publishedLabel === null) {
    return <span className="whitespace-nowrap text-muted-foreground">{totalLabel}</span>;
  }
  return (
    <div className="grid leading-tight">
      <span className="whitespace-nowrap tabular-nums">{totalLabel}</span>
      <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
        {publishedLabel}
      </span>
    </div>
  );
}
