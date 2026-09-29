import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { UnsavedChangesProvider } from '@/components/kit/unsaved-changes';
import { TourDetailProvider } from '@/components/tours/editor/tour-detail-context';
import { TourWorkspaceTop } from '@/components/tours/editor/tour-workspace-top';
import { getServerSession } from '@/lib/api/session';
import { settleWorkspaceTour } from '@/lib/workspace-tour';
import { loadAdminTour } from './load-tour';

/**
 * Khu làm việc của MỘT tour (spec F17 §2g): phần đầu dùng chung cho sáu bước và
 * Departures — Back to tours · tên tour · trạng thái · thanh bước (ADR-0049).
 *
 * `AdminShell` dời từ từng trang lên đây: các trang con chỉ còn phần thân của
 * bước. `UnsavedChangesProvider` bọc CẢ phần đầu lẫn thân, vì link rời trang nằm ở
 * cả hai chỗ.
 *
 * Slug rác → `notFound()` ngay ở đây, trước khi trang con nào chạy.
 *
 * Phần đầu đọc bản tour mới nhất qua `TourDetailProvider`: form đẩy bản vừa lưu
 * lên đó, vì layout không render lại khi đổi tab (vòng review F17).
 *
 * Không đọc được tour (API lỗi, hay khe deploy khi admin lên trước API) thì vẫn
 * dựng thân tab trong `AdminShell`, bỏ phần đầu: tab Departures tự đọc dữ liệu
 * và phải sống qua khe ấy (`settleWorkspaceTour`).
 */
export default async function TourWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [session, tour] = await Promise.all([
    getServerSession(),
    settleWorkspaceTour(loadAdminTour(slug)),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout của vùng
  // admin xử lý ở lần điều hướng kế (cùng nếp các trang vùng khác).
  if (!session) return null;
  if (tour.kind === 'missing') notFound();
  if (tour.kind === 'unavailable') return <AdminShell user={session}>{children}</AdminShell>;

  return (
    <AdminShell user={session}>
      <UnsavedChangesProvider>
        <TourDetailProvider detail={tour.detail}>
          <TourWorkspaceTop />
          {children}
        </TourDetailProvider>
      </UnsavedChangesProvider>
    </AdminShell>
  );
}
