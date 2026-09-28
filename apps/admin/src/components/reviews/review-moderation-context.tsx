import type { ModerateTarget } from '@/lib/reviews-moderate';

/**
 * Phần giữa của MỌI dialog moderation: nguyên văn review, ảnh đính kèm, rồi danh
 * sách hệ quả của lệnh sắp bắn. Tách khỏi `ModerateDialog` khi dialog bác có bố
 * cục riêng (ADR-0031 AMEND 1) — hai dialog cùng in đúng một khối, không chép.
 */
export function ReviewModerationContext({
  review,
  consequences,
}: {
  review: ModerateTarget;
  /** Câu hệ quả đã chọn sẵn theo đúng hàng (`moderateConsequences`). */
  consequences: string[];
}) {
  return (
    <>
      {/* Nguyên văn review — không cắt bằng ellipsis như ở bảng: đây là thứ
          admin đang quyết có cho lên trang tour hay không. */}
      <div className="grid gap-2 rounded-md border bg-muted/40 p-3 text-sm">
        {review.title ? <p className="font-medium">{review.title}</p> : null}
        <p className="max-h-40 overflow-y-auto whitespace-pre-wrap">{review.body}</p>
        {review.photos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {/* Trình đọc màn hình phải BIẾT review kèm ảnh trước khi duyệt
                công khai chúng — alt từng ảnh thường rỗng (review F4). */}
            <span className="sr-only">{review.photosLabel}</span>
            {review.photos.map((photo) => (
              // `<img>` thường chứ không `next/image` — cùng lý do đã ghi ở
              // `review-card.tsx` của web: ảnh nhỏ cố định, không cần loader.
              // Thêm một lý do riêng cho admin: `next/image` NÉM khi src nằm
              // ngoài `remotePatterns` (xem `slot-image.spec.tsx`), và một
              // hàng dữ liệu như vậy sẽ giết cả hàng đợi moderation.
              // biome-ignore lint/performance/noImgElement: thumbnail 64px, tránh next/image ném khi host lạ
              <img
                key={photo.thumb}
                src={photo.thumb}
                alt={photo.alt}
                width={64}
                height={64}
                loading="lazy"
                decoding="async"
                className="size-16 rounded-sm border border-border object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>

      <ul className="grid list-disc gap-1 pl-5 text-sm">
        {consequences.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  );
}
