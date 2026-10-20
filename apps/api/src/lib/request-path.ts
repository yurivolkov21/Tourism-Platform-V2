/**
 * Path mà router của Fastify (find-my-way 9) thực sự khớp route, tính từ
 * `req.url` thô (review F1-01).
 *
 * Router cắt path ở `?` hoặc `#` đầu tiên rồi giải mã percent-encoding bằng
 * `decodeURI` (ký tự dành riêng như `%2F`, `%3F` giữ nguyên; `%25` giữ nguyên
 * để khỏi giải mã hai lần). Mọi phép so path ở tầng HTTP (CORS, cổng JSON và
 * cross-site, tầng throttle) phải dùng hàm này: so `req.url` thô thì
 * `/api/%61dmin/bookings` chạy đúng handler admin mà không bị nhận ra là
 * vùng admin.
 *
 * Chuỗi mã hoá hỏng thì trả path thô: router trả 400 cho nó, không route nào chạy.
 */
export function routingPath(url: string | undefined): string {
  const raw = url ?? '';
  const end = raw.search(/[?#]/);
  const path = end === -1 ? raw : raw.slice(0, end);
  if (!path.includes('%')) return path;
  try {
    return decodeURI(path.replaceAll('%25', '%2525'));
  } catch {
    return path;
  }
}

/** Vùng admin (`/api/admin` và mọi thứ dưới nó), so trên path router khớp. */
export function isAdminSurfacePath(url: string | undefined): boolean {
  const path = routingPath(url);
  return path === '/api/admin' || path.startsWith('/api/admin/');
}
