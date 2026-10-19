import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AdminShell } from '@/components/admin-shell';
import { MediaLibrary } from '@/components/media/media-library';
import { fetchAdminMedia, fetchAdminMediaQueue } from '@/lib/api/media';
import { getServerSession } from '@/lib/api/session';
import { updateMediaAction } from './actions';

/**
 * `/media` — Media library (spec P4f Media §6, ADR-0060): mọi ảnh đang dùng và hàng dọn, đọc trọn
 * một lần. Lọc, tìm và đổi tab chạy trên trình duyệt (URL đổi bằng `history.pushState`), nên trang
 * không đọc `searchParams`; client đọc lại URL. Ba thủ tục là bậc Staff (ADR-0052), cùng bậc sửa
 * tour và bài viết, nên không có cổng `requirePageAccess` của trang chỉ Owner.
 */
export const metadata: Metadata = {
  title: 'Media library — Nexora back office',
};

export default async function MediaPage() {
  const cookie = (await cookies()).toString();
  const [session, items, queue] = await Promise.all([
    getServerSession(),
    fetchAdminMedia(cookie),
    fetchAdminMediaQueue(cookie),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở lần điều hướng kế.
  if (!session) return null;

  return (
    <AdminShell user={session}>
      <MediaLibrary items={items} queue={queue} update={updateMediaAction} />
    </AdminShell>
  );
}
