import type { AdminReview } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatDateTime } from './bookings-view';

/**
 * Mapper hiển thị hàng đợi moderation (spec P4b §3-F4) — THUẦN, nằm ngoài
 * React nên test được từng nhánh; bảng và dialog chỉ render VM có sẵn.
 *
 * Mốc thời gian mượn thẳng `formatDateTime` của `bookings-view` (in theo UTC,
 * cùng khung giờ với audit trail của API) — một luật đọc thời gian cho cả
 * back-office, không chép bản thứ hai.
 */

const t = messages.admin.reviews;

/**
 * Variant Badge — luật màu là DỮ LIỆU, không rải trong JSX. Đã duyệt nổi bật
 * (review ĐANG hiện với công chúng, một sự thật đang chạy ngoài site), chờ
 * duyệt nhạt (đang đợi người quyết — cùng giọng với REQUESTED của
 * cancellations và PENDING của bookings).
 */
export function reviewStateBadgeVariant(
  approved: boolean,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  return approved ? 'default' : 'secondary';
}

/** Một tấm ảnh khách đính kèm, đã sẵn sàng cho thẻ ảnh (ADR-0021). */
export interface ReviewPhotoVM {
  url: string;
  alt: string;
}

/** Một hàng của bảng `/reviews`. */
export interface ReviewRowVM {
  id: string;
  rating: number;
  /** Cụm sao đọc thành một câu cho trình đọc màn hình. */
  ratingLabel: string;
  title: string | null;
  body: string;
  photos: ReviewPhotoVM[];
  /** `null` khi review không có ảnh — không in "0 photos". */
  photosLabel: string | null;
  /** Tên tác giả ĐÃ xử null: tài khoản bị xoá thì đây là "Deleted account". */
  authorLabel: string;
  authorDeleted: boolean;
  source: AdminReview['source'];
  sourceLabel: string;
  /** `null` khi review không gắn tour (CURATED) — bảng tự chọn câu thay thế. */
  tourTitle: string | null;
  approved: boolean;
  stateLabel: string;
  submitted: string;
  /** Dấu vết lần duyệt gần nhất; `null` khi chưa ai đụng tới review này. */
  moderated: string | null;
  /** `null` khi không biết ai duyệt (admin cũ đã bị xoá — FK SetNull). */
  moderatedBy: string | null;
}

/**
 * URL Cloudinary gốc → thumbnail vuông 128px (đủ cho ô 32/64px kể cả retina).
 * `buildCloudinaryUrl` phía API chỉ gắn `f_auto,q_auto` KHÔNG giới hạn cỡ —
 * ảnh khách chụp điện thoại tới 10MB/tấm, trang 50 hàng × 5 ảnh từng kéo
 * hàng trăm MB chỉ để vẽ ô 32px (review F4 31/08). URL không theo khuôn
 * (host lạ/dữ liệu cũ) thì trả nguyên vẹn — thà nặng còn hơn vỡ ảnh.
 */
const CLOUDINARY_UPLOAD_MARKER = '/upload/f_auto,q_auto/';

export function reviewPhotoThumb(url: string): string {
  return url.includes(CLOUDINARY_UPLOAD_MARKER)
    ? url.replace(CLOUDINARY_UPLOAD_MARKER, '/upload/f_auto,q_auto,w_128,h_128,c_fill/')
    : url;
}

/** Review của contract → hàng bảng đã format sẵn (server component gọi). */
export function toReviewRow(review: AdminReview): ReviewRowVM {
  return {
    id: review.id,
    rating: review.rating,
    ratingLabel: t.list.ratingLabel(review.rating),
    title: review.title,
    body: review.body,
    photos: review.media.map((photo) => ({
      url: reviewPhotoThumb(photo.url),
      alt: photo.alt ?? '',
    })),
    photosLabel: review.media.length > 0 ? t.list.photos(review.media.length) : null,
    // Tài khoản đã xoá → API trả `authorName` null (GDPR erasure, audit H5b).
    // Một ô trống trơn ở cột tác giả đọc ra như render hỏng, nên nói thẳng.
    authorLabel: review.authorName ?? t.list.deletedAuthor,
    authorDeleted: review.authorDeleted,
    source: review.source,
    sourceLabel: t.source[review.source],
    tourTitle: review.tourTitle,
    approved: review.isApproved,
    stateLabel: review.isApproved ? t.state.approved : t.state.pending,
    submitted: formatDateTime(review.createdAt),
    // Hai dấu vết TÁCH nhau: `moderatedBy` là FK SetNull nên có thể null
    // trong khi `moderatedAt` vẫn có — mất tên người duyệt không được phép
    // làm mất luôn mốc thời gian.
    moderated: review.moderatedAt ? t.list.moderated(formatDateTime(review.moderatedAt)) : null,
    moderatedBy: review.moderatedBy ? t.list.moderatedBy(review.moderatedBy) : null,
  };
}
