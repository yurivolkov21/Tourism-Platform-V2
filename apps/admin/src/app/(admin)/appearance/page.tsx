import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AdminShell } from '@/components/admin-shell';
import { AppearanceBoard } from '@/components/appearance/appearance-board';
import { fetchAdminAppearance } from '@/lib/api/appearance';
import { getServerSession } from '@/lib/api/session';
import { toAppearanceBoard } from '@/lib/appearance-view';
import { loadPhotoLibraryAction } from '../photo-library-actions';
import { setSiteSlotAction, signSiteSlotUploadAction } from './actions';

/**
 * `/appearance` — ảnh 47 khe của web (spec P4f Appearance §6, ADR-0059). Server component đúng nếp
 * `/posts`: fetch oRPC kèm cookie forward → VM đã nấu xuống bảng client. Ba thủ tục là bậc Staff
 * (ADR-0052), cùng bậc sửa bài viết, nên không có cổng `requirePageAccess` của trang chỉ Owner.
 */
export const metadata: Metadata = {
  title: 'Appearance — Nexora back office',
};

export default async function AppearancePage() {
  const session = await getServerSession();
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở lần điều hướng kế.
  if (!session) return null;

  const cookie = (await cookies()).toString();
  const slots = await fetchAdminAppearance(cookie);

  return (
    <AdminShell user={session}>
      <AppearanceBoard
        groups={toAppearanceBoard(slots)}
        actions={{ setSlot: setSiteSlotAction, signUpload: signSiteSlotUploadAction }}
        loadLibrary={loadPhotoLibraryAction}
      />
    </AdminShell>
  );
}
