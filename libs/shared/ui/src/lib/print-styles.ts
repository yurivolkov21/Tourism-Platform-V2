/**
 * Lớp chữ dùng lại trong tài liệu in (G40, spec §2.1) — chung cho voucher, hoá đơn chờ của web và
 * báo cáo tháng của admin. Cả hai app chỉ nạp IBM Plex Mono 400/500 nên nhãn dùng `font-medium`,
 * không 600 như bản thảo — tránh đậm giả. Nơi gọi đổi màu bằng `cn(PRINT_LABEL, 'text-…')`.
 */
export const PRINT_LABEL =
  'font-mono text-[6.8pt] font-medium tracking-[0.14em] text-muted-foreground uppercase';

/** Tiêu đề mục ("Your day …", "Included", "Summary"). */
export const PRINT_SECTION = 'font-heading text-[11pt] font-semibold';
