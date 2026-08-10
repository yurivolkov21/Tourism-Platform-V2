import { redirect } from 'next/navigation';

/** Hub gỡ theo spec 2026-08-10 (4 mục < ngưỡng 6 của khảo sát) — Trips là cửa
 *  chính của khu account. Giữ route để mọi link/bookmark cũ không gãy. */
export default function AccountPage() {
  redirect('/account/bookings');
}
