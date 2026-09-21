import type { NextConfig } from 'next';
import { browserApiOrigin } from './src/lib/api/env';
import { buildSecurityHeaders } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  // Security header + CSP cho MỌI route (ADR-0038 §1). Không nonce — mọi
  // trang là SSG/ISR nên header tĩnh từ config là đúng tầng; logic + lý do
  // từng directive nằm trọn ở lib/security-headers.ts (thuần, có test).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders({
          // connect-src là chuyện của BROWSER nên lấy origin public, không
          // lấy API_URL (server-side, có thể là URL nội bộ).
          apiOrigin: browserApiOrigin(),
          isDev: process.env.NODE_ENV === 'development',
          // W4 C2 (ADR-0038 AMEND 2): báo cáo CSP về API — một endpoint cho
          // cả hai app, ghép từ cùng resolver với connect-src.
          reportUri: `${browserApiOrigin()}/api/webhooks/csp-report`,
        }),
      },
    ];
  },
  /**
   * `/favicon.ico` → `/icon`. Icon của site sinh động từ `app/icon.tsx` (Next
   * phục vụ nó ở `/icon` và tự chèn <link rel="icon"> vào <head>), nên tab
   * trình duyệt vẫn đúng icon mà KHÔNG cần file nào trong `public/`. Nhưng một
   * số client — trình đọc RSS, crawler, trình duyệt cũ — vẫn gọi thẳng
   * `/favicon.ico` theo quy ước, và đường đó trả 404 (đo trên prod 21/09).
   * Rewrite thay vì thêm `public/favicon.ico`: giữ MỘT nguồn sự thật cho icon,
   * không phải nhớ dựng lại file .ico mỗi lần đổi thiết kế.
   */
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/icon' }];
  },
  // Transpile gói UI dùng chung (source .tsx, không build dist) — ADR-0011.
  transpilePackages: ['@tourism/ui'],
  images: {
    // Ảnh media (tour, review, avatar) do Cloudinary phục vụ — ADR-0005/0020.
    // Loader custom chèn f_auto,q_auto,w_<width> để Cloudinary co ảnh đúng cỡ
    // (ADR-0020 §Hệ quả đòi từ 14/08) — logic + hợp đồng idempotent ở
    // lib/cloudinary-loader.ts, có test.
    //
    // KHÔNG khai remotePatterns/minimumCacheTTL (vòng vá review W3, ADR-0016
    // AMEND 2): với `loaderFile`, Next trả 404 cho /_next/image và thay nguyên
    // module kiểm host — hai khoá đó là cấu hình CHẾT, khai lại chỉ tạo ảo
    // giác có hàng rào. Không còn optimizer nên cũng không còn bề mặt "proxy
    // ảnh cho cloud lạ" (audit cụm 5); URL đến từ API của mình.
    loader: 'custom',
    loaderFile: './src/lib/cloudinary-loader.ts',
  },
};

export default nextConfig;
