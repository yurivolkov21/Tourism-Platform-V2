'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { CircleAlertIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Tab Photos khi `photos` của tour là bản lùi khe deploy (vòng review F18): admin lên
 * trước API nên danh sách rỗng ấy là BỊA. `setPhotos` thay trọn, nên dựng form từ nó
 * rồi lưu sau khi API lên là xoá sạch ảnh thật — ở đây không có form nào để lưu, chỉ
 * một câu nói vì sao và nút tải lại. API đã lên thì lượt tải lại dựng form từ danh
 * sách thật.
 */
const e = messages.admin.tours.editor;

export function TourPhotosUnavailable() {
  const router = useRouter();
  return (
    <div className="px-4 pb-8 lg:px-6">
      <div
        role="status"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm"
      >
        <CircleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
        <p className="min-w-0 flex-1">{e.photos.unavailable}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
          {e.banners.reload}
        </Button>
      </div>
    </div>
  );
}
