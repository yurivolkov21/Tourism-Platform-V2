import type { RawSearchParams } from '@/lib/table-query';

/**
 * Tham số URL mà menu Quick Create gắn vào để trang vùng mở sẵn hộp tạo (spec 2026-10-05
 * §2.5). Trang đọc nó ở server rồi truyền prop `openCreate`; `StripCreateParam` gỡ nó khỏi
 * URL ngay sau đó để F5 hay Back không mở lại hộp.
 */
export const CREATE_PARAM = 'create';

export function createHref(path: string): string {
  return `${path}?${CREATE_PARAM}=1`;
}

/** `?create=1` đúng một lần, đúng giá trị `1` — mảng hay giá trị khác đều không tính. */
export function wantsCreate(params: RawSearchParams): boolean {
  return params[CREATE_PARAM] === '1';
}

export function withoutCreateParam(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(CREATE_PARAM);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
