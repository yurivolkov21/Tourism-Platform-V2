import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Transpile gói UI dùng chung (source .tsx, không build dist) — ADR-0011.
  transpilePackages: ['@tourism/ui'],
};

export default nextConfig;
