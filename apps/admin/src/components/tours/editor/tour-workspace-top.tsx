'use client';

import type { SetPublishedAction } from '@/lib/tours-publish';
import { useWorkspaceDetail } from './tour-detail-context';
import { TourReadinessPanel } from './tour-readiness-panel';
import { TourTabs } from './tour-tabs';
import { TourWorkspaceHeader } from './tour-workspace-header';

/**
 * Phần đầu dùng chung của năm tab (spec F17 §2g): Back to tours · tên tour ·
 * công tắc On sale · khung readiness · thanh tab.
 *
 * Đọc bản tour MỚI NHẤT từ `TourDetailProvider` chứ không từ props của layout
 * (vòng review F17): layout không render lại khi đổi tab, nên bản của nó có thể
 * là bản trước lần lưu vừa xong. Ba component bên dưới vẫn nhận props thuần.
 */
export function TourWorkspaceTop({ setPublished }: { setPublished: SetPublishedAction }) {
  const detail = useWorkspaceDetail();
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <TourWorkspaceHeader detail={detail} setPublished={setPublished} />
      <TourReadinessPanel readiness={detail.readiness} slug={detail.slug} />
      <TourTabs slug={detail.slug} />
    </div>
  );
}
