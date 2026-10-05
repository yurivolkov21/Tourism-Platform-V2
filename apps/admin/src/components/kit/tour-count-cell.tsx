/**
 * Ô "Tours" của bảng danh mục và điểm đến (spec 2026-10-05 §3.3). Tổng tour MỌI trạng thái
 * là dòng chính — chính con số quyết nút Delete (ADR-0053 §5) — còn số tour đang bán là dòng
 * mờ bên dưới. 0 tour thì một chữ mờ: hàng ấy là hàng xoá được.
 *
 * Kit chứ không nằm ở vùng: hai bảng dùng y hệt (luật kit ≥ 2 consumer). Chữ do VM nấu sẵn.
 */
export function TourCountCell({
  total,
  totalLabel,
  publishedLabel,
}: {
  total: number;
  totalLabel: string;
  publishedLabel: string | null;
}) {
  if (total === 0) {
    return <span className="whitespace-nowrap text-muted-foreground">{totalLabel}</span>;
  }
  return (
    <div className="grid leading-tight">
      <span className="whitespace-nowrap tabular-nums">{totalLabel}</span>
      {publishedLabel ? (
        <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          {publishedLabel}
        </span>
      ) : null}
    </div>
  );
}
