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
    // Admin KHÔNG dùng `next/image` ở bất kỳ đâu: avatar nav-user là
    // `AvatarImage` (`<img>` của @tourism/ui), thumbnail review cố ý `<img>`
    // trần vì next/image NÉM khi src ở host lạ. Nên `remotePatterns` cũ là cấu
    // hình CHẾT mà vẫn mở sẵn `/_next/image` — trong khi `proxy.ts` cố ý loại
    // đường đó khỏi cổng gác đăng nhập, tức optimizer chạy VÔ DANH; và
    // `pathname: '/**'` trên host dùng chung nghĩa là tài khoản Cloudinary của
    // BẤT KỲ ai cũng khớp. Đúng bề mặt "proxy ảnh cho cloud lạ" mà audit 05/09
    // cụm 5 nêu và ADR-0016 AMEND 2 §7 đã đóng cho apps/web — admin bị sót
    // trong chính đợt đó (ADR-0026 AMEND 5).
    //
    // `unoptimized` đóng cả hai phía: Next trả 404 cho `/_next/image`
    // (`next-server.js`: `loader !== 'default' || unoptimized → render404`), và
    // khối images không được ghi vào build output nên `/_vercel/image` của
    // Vercel cũng 404. Đúng dưới CẢ HAI giả thuyết về việc ai phục vụ đường ảnh
    // — không phụ thuộc vào việc optimizer nào đang chạy ở prod.
    unoptimized: true,
  },
};

export default nextConfig;
