import {
  type AdminLibraryPhoto,
  type AdminPostDetail,
  type AdminPostUpdateInput,
  POST_CONTENT_MAX,
  POST_COVER_ALT_MAX,
  POST_EXCERPT_MAX,
  POST_TITLE_MAX,
  type PostCoverSource,
  type PostReadinessItem,
  type PostStatus,
  postContentIssue,
  postReadiness,
  TOUR_PHOTO_MAX_BYTES,
  type TourPhotoUpload,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cloudinaryImageUrl } from './cloudinary-url';
import type { Keyed } from './list-editor';
import { imageExtensionOf, type UploadedPhoto } from './photo-upload';

/**
 * Logic THUẦN của trang sửa bài (spec P4e-4 §4.4): giá trị form, kiểm trước khi gửi, payload,
 * độ đủ để đăng trên bản đang soạn, giờ UTC của ô ngày. Một bài là MỘT form — không chia
 * theo bước như tour.
 */
const fe = messages.admin.posts.editor.form.errors;

/** `id` của `<form>` — nút Save ở cột phải gắn vào nó bằng thuộc tính `form` (Quyết định 14). */
export const POST_FORM_ID = 'post-editor-form';

/** Một tour chọn được làm tour liên quan — cả tour đang tắt bán (ADR-0051 §5). */
export interface PostTourOption {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
}

/** Một dòng của danh sách tour liên quan; `key` là id tour (một tour chỉ có mặt một lần). */
export interface PostTourDraft extends PostTourOption, Keyed {}

/** Ảnh bìa đang soạn — `upload` chỉ có ở ảnh VỪA tải, gửi kèm lúc lưu (ADR-0048 §5). */
export interface PostCoverDraft {
  publicId: string;
  url: string;
  alt: string;
  source: PostCoverSource;
  upload?: TourPhotoUpload;
}

export interface PostFormValues {
  title: string;
  excerpt: string;
  content: string;
  status: PostStatus;
  /** `YYYY-MM-DDTHH:mm` đọc như giờ UTC (ô `datetime-local`), hoặc `''`. */
  publishAt: string;
  tags: string[];
  relatedTours: PostTourDraft[];
  cover: PostCoverDraft | null;
}

export interface PostFormErrors {
  title?: string;
  excerpt?: string;
  content?: string;
  publishAt?: string;
  coverAlt?: string;
}

const INPUT_VALUE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** ISO → giá trị ô `datetime-local` đọc như giờ UTC (mọi giờ của admin là UTC). Giây bị bỏ. */
export function toUtcInputValue(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

/** Giá trị ô → ISO UTC; `null` khi trống, sai dạng, hay không phải một thời điểm có thật. */
export function fromUtcInputValue(value: string): string | null {
  if (!INPUT_VALUE.test(value)) return null;
  const date = new Date(`${value}:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  // `2026-02-31` tự lăn sang tháng 3 — so lại để bắt ngày không có thật.
  return iso.slice(0, 16) === value ? iso : null;
}

/** "Bây giờ" làm tròn xuống phút — giá trị tự điền khi chuyển sang Published. */
export function nowUtcInputValue(now: Date): string {
  return now.toISOString().slice(0, 16);
}

/** Bài server → giá trị form. Ô trống của DB thành chuỗi rỗng để ô nhập luôn được kiểm soát. */
export function postFormValues(detail: AdminPostDetail): PostFormValues {
  return {
    title: detail.title,
    excerpt: detail.excerpt ?? '',
    content: detail.content,
    status: detail.status,
    publishAt: detail.publishedAt === null ? '' : toUtcInputValue(detail.publishedAt),
    tags: detail.tags.map((tag) => tag.name),
    relatedTours: detail.relatedTours.map((tour) => ({ key: tour.id, ...tour })),
    cover:
      detail.cover === null
        ? null
        : {
            publicId: detail.cover.publicId,
            url: detail.cover.url,
            alt: detail.cover.alt ?? '',
            source: detail.cover.source,
          },
  };
}

/** Kiểm bằng CHÍNH các trần và luật nội dung của contract — form không gửi thứ server trả 400. */
export function validatePostForm(values: PostFormValues): PostFormErrors {
  const errors: PostFormErrors = {};
  const title = values.title.trim();
  if (title === '') errors.title = fe.required;
  else if (title.length > POST_TITLE_MAX) errors.title = fe.tooLong(POST_TITLE_MAX);

  if (values.excerpt.trim().length > POST_EXCERPT_MAX) {
    errors.excerpt = fe.tooLong(POST_EXCERPT_MAX);
  }

  if (values.content.length > POST_CONTENT_MAX) {
    errors.content = fe.tooLong(POST_CONTENT_MAX);
  } else {
    const issue = postContentIssue(values.content);
    if (issue !== null) errors.content = fe[issue];
  }

  if (values.status === 'PUBLISHED' && fromUtcInputValue(values.publishAt) === null) {
    errors.publishAt = fe.publishDate;
  }

  if (values.cover !== null && values.cover.alt.trim().length > POST_COVER_ALT_MAX) {
    errors.coverAlt = fe.tooLong(POST_COVER_ALT_MAX);
  }
  return errors;
}

/** Mục còn thiếu tính trên bản ĐANG SOẠN — cùng hàm server dùng ở cổng đăng (Quyết định 11). */
export function projectedPostReadiness(values: PostFormValues): PostReadinessItem[] {
  return postReadiness({
    content: values.content,
    excerpt: values.excerpt,
    hasCover: values.cover !== null,
  });
}

/**
 * Đổi trạng thái. Sang Published mà ô ngày trống thì tự điền "bây giờ" (spec §2.2); về
 * Draft thì GIỮ ngày — bài về nháp không mất ngày đăng cũ. Nhưng bài CHƯA TỪNG lưu ngày
 * (`savedPublishAt` trống) về Draft thì ô ngày trống lại: ô ngày chỉ hiện khi Published, nên
 * ngày ấy là ngày tự điền hay gõ trong lúc thử đăng — giữ nó là để nó lọt vào nháp rồi bị
 * dùng lại ở lần đăng sau, bài lên web với ngày cũ (vòng review P4e-4).
 */
export function withStatus(
  values: PostFormValues,
  status: PostStatus,
  now: Date,
  savedPublishAt: string,
): PostFormValues {
  if (status === 'DRAFT') {
    return { ...values, status, publishAt: savedPublishAt === '' ? '' : values.publishAt };
  }
  const publishAt = values.publishAt === '' ? nowUtcInputValue(now) : values.publishAt;
  return { ...values, status, publishAt };
}

/** Giá trị form → input `admin.posts.update`. Gửi cả form: tag, tour, ảnh bìa thay trọn. */
export function postPayload(
  id: string,
  version: string,
  values: PostFormValues,
): AdminPostUpdateInput {
  const excerpt = values.excerpt.trim();
  const cover = values.cover;
  return {
    id,
    version,
    title: values.title.trim(),
    excerpt: excerpt === '' ? null : excerpt,
    content: values.content,
    status: values.status,
    publishedAt: fromUtcInputValue(values.publishAt),
    tags: values.tags,
    relatedTourIds: values.relatedTours.map((tour) => tour.id),
    cover:
      cover === null
        ? null
        : {
            publicId: cover.publicId,
            alt: cover.alt.trim() === '' ? null : cover.alt.trim(),
            ...(cover.upload ? { upload: cover.upload } : {}),
          },
  };
}

/**
 * Lý do một file không được nhận làm ảnh bìa, hoặc `null` — cùng luật tab Photos của tour:
 * đuôi trong whitelist ký của Cloudinary, tối đa 10 MB (trần gói, `TOUR_PHOTO_MAX_BYTES`).
 */
export function coverFileProblem(file: { name: string; size: number }): 'type' | 'size' | null {
  if (imageExtensionOf(file.name) === null) return 'type';
  if (file.size > TOUR_PHOTO_MAX_BYTES) return 'size';
  return null;
}

/** Ảnh vừa tải → ảnh bìa đang soạn; alt để trống (tuỳ chọn — Quyết định 3). */
export function uploadedCoverDraft(uploaded: UploadedPhoto, cloudName: string): PostCoverDraft {
  return {
    publicId: uploaded.publicId,
    url: cloudinaryImageUrl(cloudName, uploaded.publicId, uploaded.upload.version),
    alt: '',
    source: 'UPLOAD',
    upload: uploaded.upload,
  };
}

/** Ảnh thư viện → ảnh bìa đang soạn; alt chép từ ảnh gốc, sửa được. */
export function libraryCoverDraft(photo: AdminLibraryPhoto): PostCoverDraft {
  return { publicId: photo.publicId, url: photo.url, alt: photo.alt ?? '', source: 'LIBRARY' };
}
