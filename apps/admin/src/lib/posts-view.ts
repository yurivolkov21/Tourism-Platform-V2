import type { AdminPostRow, PostDisplayStatus } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatDateTime } from './bookings-view';
import { withDeliveryTransform } from './cloudinary-url';

/**
 * Mapper hiển thị vùng `/posts` (spec P4e-4 §4.2) — THUẦN, ngoài React nên test được
 * từng nhánh; bảng chỉ render VM có sẵn. Giờ in theo UTC bằng `formatDateTime` — một khuôn
 * giờ cho cả back office.
 */
const t = messages.admin.posts;

/** Trang danh sách — đích của nút Back và của lệnh xoá. */
export const POSTS_LIST_HREF = '/posts';

/** Trang sửa một bài. */
export function postEditorHref(slug: string): string {
  return `/posts/${encodeURIComponent(slug)}`;
}

/** Nhãn chip trạng thái — một bản cho bảng và phần đầu trang sửa. */
export function postStatusLabel(status: PostDisplayStatus): string {
  return t.status[status];
}

/**
 * Kiểu chip của từng trạng thái — một bản cho bảng và phần đầu trang sửa. Ba mức khác nhau
 * bằng cả mắt lẫn chữ: nháp viền, hẹn giờ nền phụ, đã đăng nền chính.
 */
export const POST_STATUS_VARIANT = {
  draft: 'outline',
  scheduled: 'secondary',
  published: 'default',
} as const satisfies Record<PostDisplayStatus, 'outline' | 'secondary' | 'default'>;

export interface PostRowVM {
  id: string;
  slug: string;
  title: string;
  editorHref: string;
  displayStatus: PostDisplayStatus;
  statusLabel: string;
  /** Ngày đăng đã format; nháp in "—" dù DB còn giữ ngày cũ (spec §2.2). */
  published: string;
  tags: string;
  updated: string;
  thumbUrl: string | null;
}

export function toPostRowVM(row: AdminPostRow): PostRowVM {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    editorHref: postEditorHref(row.slug),
    displayStatus: row.displayStatus,
    statusLabel: postStatusLabel(row.displayStatus),
    published: formatDateTime(row.displayStatus === 'draft' ? null : row.publishedAt),
    tags: row.tags.length === 0 ? t.list.noTags : row.tags.map((tag) => tag.name).join(', '),
    updated: formatDateTime(row.updatedAt),
    // Ô 40px — bản rộng 160px đủ nét cả màn mật độ cao, không tải nguyên ảnh 2400px.
    thumbUrl: row.coverUrl === null ? null : withDeliveryTransform(row.coverUrl, 'w_160'),
  };
}
