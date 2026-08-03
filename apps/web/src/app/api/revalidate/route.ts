import { revalidateTag as nextRevalidateTag } from 'next/cache';
import { DEV_REVALIDATE_SECRET, handleRevalidatePost } from '@/lib/api/revalidate-route';

/**
 * Bề mặt on-demand revalidation (ADR-0016 §3) — chỉ API NestJS gọi (server-
 * to-server, secret header), browser không bao giờ đụng. Chỉ export POST:
 * method khác Next tự trả 405. Route handler không vào sitemap.
 * `|| default`: chuỗi rỗng = "không khai" (gotcha CLAUDE.md §env).
 */
export async function POST(request: Request): Promise<Response> {
  return handleRevalidatePost(request, {
    expectedSecret: process.env.REVALIDATE_SECRET || DEV_REVALIDATE_SECRET,
    // Next 16 đổi signature revalidateTag thành (tag, profile) — thiếu arg 2
    // vẫn chạy nhưng deprecated (xem node_modules/next .../revalidate.js).
    // { expire: 0 } = hard-bust (đường cacheLife.expire === 0 trong revalidate.js
    // của Next, cùng logic với legacy no-profile) — thay cho 'max' (SWR mềm)
    // vì spec đòi thay đổi trải thấy NGAY. Bọc lại thành 1 tham số để lõi thuần
    // (revalidate-route.ts) không phụ thuộc signature Next — deps.revalidateTag
    // giữ đúng interface Task 2 cần khớp.
    revalidateTag: (tag) => {
      nextRevalidateTag(tag, { expire: 0 });
    },
  });
}
