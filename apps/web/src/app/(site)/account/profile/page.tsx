import { permanentRedirect } from 'next/navigation';

/**
 * `/account/profile` — nội dung đã DI CƯ sang `/account/settings` (spec
 * 2026-08-11, M3: form là tầng sau của hộ chiếu). Route giữ lại làm redirect
 * vĩnh viễn cho link/bookmark cũ — "đủ route không đủ trang", cùng lối với
 * `/account/security` từ vòng trước.
 */
export default function AccountProfileRedirect() {
  permanentRedirect('/account/settings');
}
