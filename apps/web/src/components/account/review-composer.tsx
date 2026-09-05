'use client';

import type { MyReview } from '@tourism/contract';
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
export function ReviewComposer({
  bookingCode,
  review,
}: {
  bookingCode: string;
  /** Có = chế độ SỬA (ADR-0032): ảnh cũ vào sẵn hàng, form điền sẵn nội dung. */
  review?: MyReview;
}) {
  const initialPhotos = (review?.media ?? []).map((item) => ({
    publicId: item.publicId,
    url: item.url,
  }));
  // Khởi tạo bằng chính ảnh cũ: nếu để rỗng rồi chờ panel báo lên, thì trong
  // khoảnh khắc đầu form nghĩ review không có ảnh nào — bấm gửi ngay lúc ấy là
  // gỡ sạch ảnh mà khách không hề định thế.
  const [photos, setPhotos] = useState<{ publicIds: string[]; busy: boolean }>(() => ({
    publicIds: initialPhotos.map((photo) => photo.publicId),
    busy: false,
  }));
  const onPhotosChange = useCallback(
    (next: { publicIds: string[]; busy: boolean }) => setPhotos(next),
    [],
  );
  return (
    <Frame stacked className="w-full">
      <FramePanel>
        <ReviewPhotoUpload
          bookingCode={bookingCode}
          initialPhotos={initialPhotos}
          onPhotosChange={onPhotosChange}
        />
      </FramePanel>
      <FramePanel>
        <ReviewForm
          bookingCode={bookingCode}
          review={review}
          photos={photos.publicIds}
          photosBusy={photos.busy}
        />
      </FramePanel>
    </Frame>
  );
}
