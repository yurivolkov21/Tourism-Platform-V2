import type { NextConfig } from 'next';
import { browserApiOrigin } from './src/lib/api/env';

// Fail-fast env NGAY LÚC BUILD (vòng vá review W3, ADR-0026 AMEND 4): admin
// không có chỗ nào gọi resolver ở module scope nữa (đều lười), nên thiếu
// NEXT_PUBLIC_API_URL / không https ở production sẽ chỉ lộ ở runtime — login
// chết im trong browser, không log server. Gọi một lần ở đây để build đỏ với
// message nêu tên biến, cùng nếp `headers()` của apps/web. Build local/CI với
// http://localhost vẫn qua (resolver miễn ép https cho loopback).
browserApiOrigin();

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
