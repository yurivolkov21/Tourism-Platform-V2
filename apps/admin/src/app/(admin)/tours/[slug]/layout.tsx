import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { UnsavedChangesProvider } from '@/components/kit/unsaved-changes';
import { TourReadinessPanel } from '@/components/tours/editor/tour-readiness-panel';
import { TourTabs } from '@/components/tours/editor/tour-tabs';
import { TourWorkspaceHeader } from '@/components/tours/editor/tour-workspace-header';
import { getServerSession } from '@/lib/api/session';
import { setTourPublishedAction } from '../actions';
import { loadAdminTour } from './load-tour';

/**
 * Khu làm việc của MỘT tour (spec F17 §2g): phần đầu dùng chung cho năm tab —
 * Back to tours · tên tour · công tắc On sale · khung readiness · thanh tab.
 *
 * `AdminShell` dời từ từng trang lên đây: các trang con chỉ còn phần thân của
 * tab. `UnsavedChangesProvider` bọc CẢ phần đầu lẫn thân, vì link rời trang nằm ở
 * cả hai chỗ.
 *
 * Slug rác → `notFound()` ngay ở đây, trước khi trang con nào chạy.
 */
export default async function TourWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [session, detail] = await Promise.all([getServerSession(), loadAdminTour(slug)]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout của vùng
  // admin xử lý ở lần điều hướng kế (cùng nếp các trang vùng khác).
  if (!session) return null;
  if (!detail) notFound();

  return (
    <AdminShell user={session}>
      <UnsavedChangesProvider>
        <div className="flex flex-col gap-4 px-4 lg:px-6">
          <TourWorkspaceHeader detail={detail} setPublished={setTourPublishedAction} />
          <TourReadinessPanel readiness={detail.readiness} slug={detail.slug} />
          <TourTabs slug={detail.slug} />
        </div>
        {children}
      </UnsavedChangesProvider>
    </AdminShell>
  );
}
