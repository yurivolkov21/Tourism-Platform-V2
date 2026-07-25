/** Slug chữ thường nối gạch ngang — dùng chung cho id section và anchor TOC. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
