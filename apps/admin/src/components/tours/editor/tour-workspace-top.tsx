'use client';

import { tourSteps } from '@/lib/tour-editor-view';
import { useWorkspaceDetail } from './tour-detail-context';
import { TourStepNav } from './tour-step-nav';
import { TourWorkspaceHeader } from './tour-workspace-header';

/**
 * Phần đầu dùng chung của khu sửa tour (ADR-0049 §4): phần đầu trạng thái, rồi thanh
 * bước.
 *
 * Đọc bản tour MỚI NHẤT từ `TourDetailProvider` chứ không từ props của layout (vòng
 * review F17): layout không render lại khi đổi bước, nên bản của nó có thể là bản trước
 * lần lưu vừa xong — thanh bước vì thế tích xanh ngay sau khi lưu.
 */
export function TourWorkspaceTop() {
  const detail = useWorkspaceDetail();
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <TourWorkspaceHeader detail={detail} />
      <TourStepNav slug={detail.slug} steps={tourSteps(detail)} />
    </div>
  );
}
