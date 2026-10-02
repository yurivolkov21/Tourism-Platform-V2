/**
 * Slug chữ thường nối gạch ngang — id của heading trong bài và anchor của mục lục. Ở
 * `@tourism/ui` từ P4e-4 vì bộ render markdown dùng chung (web và tab Preview của admin)
 * cần nó; web re-export ở `apps/web/src/lib/slug.ts` để mục lục và heading cùng một hàm.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
