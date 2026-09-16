/**
 * Ảnh của cụm auth cho đợt dựng giao diện tĩnh (P5b-1).
 *
 * Lấy thẳng từ các khe site-media mà web đang dùng trên Cloudinary, kèm phép cắt
 * đúng tỉ lệ từng chỗ để máy không phải tải ảnh 2400px về rồi thu nhỏ.
 *
 * Khi nối API thật, người làm hạ tầng đổi chỗ này sang dữ liệu khe site-media
 * (xem `docs/conventions/mobile-auth-handoff.md`) — màn không phải sửa, vì màn
 * chỉ nhận `{ uri }`.
 */
const BASE = 'https://res.cloudinary.com/dbkgeehow/image/upload';

export const AUTH_PHOTOS = {
  /** Thung lũng Hà Giang — ảnh đầu trang màn Sign in. */
  signIn: {
    uri: `${BASE}/c_fill,w_648,h_600,q_auto,f_auto/v1787055535/tourism/catalog/site/moment-hagiang-valley`,
  },
  /** Khe ảnh trang auth của web (Sa Pa) — màn Create account, dải ảnh thấp hơn. */
  register: {
    uri: `${BASE}/c_fill,w_648,h_460,q_auto,f_auto/v1786976718/tourism/catalog/site/auth-panel`,
  },
  /** Ruộng lúa — nền của màn kết quả. */
  result: {
    uri: `${BASE}/c_fill,w_648,h_600,q_auto,f_auto/v1786710835/tourism/catalog/site/cta-band`,
  },
  /** Ba ảnh dọc cho ba trang onboarding, đúng thứ tự trang. */
  onboarding: [
    {
      uri: `${BASE}/c_fill,w_648,h_1400,q_auto,f_auto/v1787055538/tourism/catalog/site/moment-hoian-river`,
    },
    {
      uri: `${BASE}/c_fill,w_648,h_1400,q_auto,f_auto/v1787055544/tourism/catalog/site/moment-lanha-kayak`,
    },
    {
      uri: `${BASE}/c_fill,w_648,h_1400,q_auto,f_auto/v1787055534/tourism/catalog/site/moment-bentre-canal`,
    },
  ],
} as const;
