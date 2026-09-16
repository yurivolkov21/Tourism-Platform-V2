/**
 * Package nào được phép đứng trong `import` của `@tourism/core` (ADR-0042 §3).
 * Thêm tên vào đây là một quyết định kiến trúc — sửa ADR trước, sửa dòng này sau.
 */
const ALLOWED_PACKAGES = new Set(['@tourism/contract', '@tourism/i18n']);

const IMPORT_SPECIFIER = /(?:from|import)\s+'([^']+)'/g;

/**
 * Trả về danh sách specifier KHÔNG được phép trong một file nguồn. Import tương
 * đối luôn hợp lệ; còn lại phải nằm trong `ALLOWED_PACKAGES`. Nhờ luật "cho phép
 * theo danh sách" nên react, react-native, next và `node:*` đều rơi ra mà không
 * phải liệt kê từng cái — danh sách cấm thì luôn thiếu, danh sách cho phép thì không.
 */
export function forbiddenImports(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1];
    if (specifier === undefined) continue;
    if (specifier.startsWith('.')) continue;
    if (ALLOWED_PACKAGES.has(specifier)) continue;
    found.push(specifier);
  }
  return found;
}
