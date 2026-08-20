import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Transpile gói UI dùng chung (source .tsx, không build dist) — ADR-0011,
  // cùng nếp apps/web.
  transpilePackages: ['@tourism/ui'],
  images: {
    // Avatar admin trong nav-user do Cloudinary phục vụ (ADR-0005/0021).
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' }],
  },
};

export default nextConfig;
