import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
