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
        }),
      },
    ];
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
