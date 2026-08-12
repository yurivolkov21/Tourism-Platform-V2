'use client';

import { Frame, FramePanel } from '@tourism/ui/components/reui/frame';
import { useCallback, useState } from 'react';
import { ReviewForm } from './review-form';
import { ReviewPhotoUpload } from './review-photo-upload';

/**
 * Cầu nối state giữa hai `FramePanel` của cụm review (Task 9, ADR-0021): page
 * cha là Server Component nên không giữ state được — ảnh upload xong ở panel
 * trên chảy xuống form ở panel dưới qua `onPhotosChange`. Đóng khung ngoài
 * bằng MỘT `<Frame stacked>` — chép nguyên className/cấu trúc từ page cũ
 * (mảnh 1+2 cụm review-ảnh 12/08).
 */
export function ReviewComposer({ bookingCode }: { bookingCode: string }) {
  const [photos, setPhotos] = useState<{ publicIds: string[]; busy: boolean }>({
    publicIds: [],
    busy: false,
  });
  const onPhotosChange = useCallback(
    (next: { publicIds: string[]; busy: boolean }) => setPhotos(next),
    [],
  );
  return (
    <Frame stacked className="w-full">
      <FramePanel>
        <ReviewPhotoUpload bookingCode={bookingCode} onPhotosChange={onPhotosChange} />
      </FramePanel>
      <FramePanel>
        <ReviewForm bookingCode={bookingCode} photos={photos.publicIds} photosBusy={photos.busy} />
      </FramePanel>
    </Frame>
  );
}
