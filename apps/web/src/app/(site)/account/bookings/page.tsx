import { permanentRedirect } from 'next/navigation';

/**
 * Trang Trips cũ đã NHẬP vào trang hộ chiếu `/account` (spec 2026-08-11 §2 —
 * "Your journey" chính là danh sách booking). Route giữ lại làm redirect vĩnh
 * viễn để mọi link/bookmark cũ không gãy; trang visa `/account/bookings/[code]`
 * vẫn sống bình thường bên dưới prefix này.
 */
export default function AccountBookingsRedirect() {
  permanentRedirect('/account');
}
