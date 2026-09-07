import type { NextConfig } from 'next';
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
          apiOrigin: (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(
            /\/+$/,
            '',
          ),
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
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' }],
  },
};

export default nextConfig;
