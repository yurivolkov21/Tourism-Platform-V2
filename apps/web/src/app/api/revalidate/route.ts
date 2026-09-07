import { revalidateTag as nextRevalidateTag } from 'next/cache';
import { handleRevalidatePost, resolveRevalidateSecret } from '@/lib/api/revalidate-route';

/**
 * Bề mặt on-demand revalidation (ADR-0016 §3) — chỉ API NestJS gọi (server-
 * to-server, secret header), browser không bao giờ đụng. Chỉ export POST:
 * method khác Next tự trả 405. Route handler không vào sitemap.
 * Secret theo môi trường: production thiếu là throw (W3-O5), dev fallback
 * DEV_REVALIDATE_SECRET — luật + lý do ở lib/api/revalidate-route.ts.
 */
export async function POST(request: Request): Promise<Response> {
  return handleRevalidatePost(request, {
    expectedSecret: resolveRevalidateSecret({
      REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
      NODE_ENV: process.env.NODE_ENV,
    }),
    // Next 16 đổi signature revalidateTag thành (tag, profile) — thiếu arg 2
    // vẫn chạy nhưng deprecated (xem node_modules/next .../revalidate.js).
    // { expire: 0 } = hard-bust (đường cacheLife.expire === 0 trong revalidate.js
    // của Next, cùng logic với legacy no-profile) — thay cho 'max' (SWR mềm)
    // vì spec đòi thay đổi phải thấy NGAY. Bọc lại thành 1 tham số để lõi thuần
    // (revalidate-route.ts) không phụ thuộc signature Next — deps.revalidateTag
    // giữ đúng interface Task 2 cần khớp.
    revalidateTag: (tag) => {
      nextRevalidateTag(tag, { expire: 0 });
    },
  });
}
