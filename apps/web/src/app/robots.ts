import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

/**
 * Nexora có robots.txt + sitemap.xml, v2 thì chưa — trang catalogue vô hình với
 * crawler là một trong bảy thụt lùi "Quan trọng" ở
 * docs/analysis/2026-07-27-tours-parity-nexora.md. Đây là chỗ trả nó.
 *
 * Danh sách `disallow` ghi sẵn cả đường dẫn CHƯA tồn tại (`/account/`,
 * `/checkout/`): thêm bây giờ rẻ hơn nhớ ra sau khi trang đã lên và đã bị index.
 * `/api/` chặn luôn vì oRPC handler không có gì để index.
 *
 * KHÔNG chặn `/login` và các trang auth: chúng chỉ không có mặt trong sitemap.
 * Chặn hẳn thì crawler không đọc được `noindex` trên trang, và một trang bị chặn
 * vẫn có thể lên kết quả tìm kiếm nếu nơi khác trỏ tới nó.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account/', '/checkout/', '/api/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
