import type { NextConfig } from 'next';
import { browserApiOrigin } from './src/lib/api/env';
import { buildSecurityHeaders } from './src/lib/security-headers';

/**
 * Pathname cho remotePatterns: `/<cloud>/**` khi NEXT_PUBLIC_CLOUDINARY_
 * CLOUD_NAME có (siết optimizer về đúng cloud của mình), fallback '/**' kèm
 * warn lúc build — đừng chết build vì thiếu một env SEO-cứng-hoá.
 */
function cloudinaryPathname(): string {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  if (cloud) return `/${cloud}/**`;
  console.warn(
    '[next.config] NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME chưa đặt — remotePatterns mở /** cho mọi cloud Cloudinary (W3-S4)',
  );
  return '/**';
}

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
    // Khai host để next/image tối ưu được; trước đây thiếu nên nhiều nơi
    // (avatar-upload.tsx, tour-reviews.tsx…) phải dùng thẻ <img> thường kèm
    // chú thích bỏ qua lint riêng. TourMediaPanel (Task 4) là nơi đầu tiên
    // dùng next/image thật với host này.
    //
    // W3-S4 (ADR-0016 AMEND 1 §7): pathname siết theo cloud name — '/**' là
    // mở optimizer cho MỌI cloud Cloudinary của người lạ (audit cụm 5).
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: cloudinaryPathname() },
    ],
    // Ảnh media bất biến theo publicId — cache derive một ngày là an toàn.
    minimumCacheTTL: 86_400,
    // Chèn f_auto,q_auto,w_<width> để Cloudinary co ảnh đúng cỡ (ADR-0020
    // §Hệ quả đòi từ 14/08) — logic + hợp đồng idempotent ở lib, có test.
    loader: 'custom',
    loaderFile: './src/lib/cloudinary-loader.ts',
  },
};

export default nextConfig;
