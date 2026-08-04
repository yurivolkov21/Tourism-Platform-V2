import { permanentRedirect } from 'next/navigation';

/**
 * `/account/security` — parity route Nexora (spec §3: "route tồn tại,
 * redirect vĩnh viễn về `/account/profile`" — plan Task 4 chốt 308). Nexora
 * có trang security riêng (đổi mật khẩu/email); v2 hợp nhất mọi thứ đó vào
 * `/account/profile` (Task 4) nên route này KHÔNG còn nội dung — chỉ giữ
 * đường dẫn sống cho link cũ/bookmark, đúng "đủ route không đủ trang" (spec
 * dòng 21). `permanentRedirect` (KHÔNG `redirect`) để phát đúng 308, không
 * phải 307 tạm thời — route này không bao giờ đổi lại.
 */
export default function AccountSecurityPage() {
  permanentRedirect('/account/profile');
}
