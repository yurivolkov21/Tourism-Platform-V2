/**
 * Lớp chữ dùng lại trong tài liệu in (G40). Mono chỉ nạp 400/500 (`layout.tsx`) nên nhãn dùng
 * `font-medium`, không 600 như bản thảo — tránh đậm giả.
 */
export const PRINT_LABEL =
  'font-mono text-[6.8pt] font-medium tracking-[0.14em] text-muted-foreground uppercase';

/** Tiêu đề mục ("Your day …", "Included", "Summary"). */
export const PRINT_SECTION = 'font-heading text-[11pt] font-semibold';
