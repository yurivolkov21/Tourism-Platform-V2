import type { PostReadinessItem } from '@tourism/contract';
import { ContractError } from '../../lib/contract-error.js';

/**
 * Lỗi nghiệp vụ của quản trị bài viết (spec P4e-4 §3). Controller đổi chúng thành lỗi
 * contract bằng `toContractError` — chỉ mã mà procedure KHAI mới đi qua.
 *
 * Tên có tiền tố riêng như lỗi của khu làm việc tour: repo có nhiều lớp
 * `…NotFoundError` ở nhiều module (bài học vòng hai F12).
 */

export class AdminPostNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor(ref: string) {
    super('NOT_FOUND', `Post not found: ${ref}`, false);
  }
}

/** Slug đã có bài khác dùng. 409: input đúng, thế giới đã đổi. */
export class PostSlugTakenError extends ContractError<'SLUG_TAKEN'> {
  constructor(slug: string) {
    super('SLUG_TAKEN', `Another post already uses the slug ${slug}`);
  }
}

/** Phiên bản trong form không còn khớp hàng bài viết (ADR-0051 §2). */
export class StalePostError extends ContractError<'STALE_POST'> {
  constructor() {
    super('STALE_POST', 'This post changed since it was opened.');
  }
}

/**
 * Bài đăng thiếu thứ card cần (ADR-0051 §4). Câu liệt kê chỗ thiếu để API đọc được một
 * mình; admin tự dựng câu của nó từ `postReadiness`.
 */
export class PostNotReadyError extends ContractError<'POST_NOT_READY'> {
  constructor(readonly missing: readonly PostReadinessItem[]) {
    super('POST_NOT_READY', `This post is missing: ${missing.join(', ')}.`);
  }
}

/**
 * Ảnh bìa không thuộc nguồn nào trong ba (spec §3.2). 400: client đúng không bao giờ gửi
 * — nhưng chuỗi này là đối số của lệnh destroy sau này, nên từ chối cả lệnh.
 */
export class PostPhotoNotAllowedError extends ContractError<'PHOTO_NOT_ALLOWED'> {
  constructor(publicId: string) {
    super('PHOTO_NOT_ALLOWED', `Cover not allowed for this post: ${publicId}`, false);
  }
}

/**
 * Khoá ngoại `post_tours.tour_id` hỏng ngay ở câu ghi (`P2003`). `tourIds` là các tour đã
 * mất — rỗng khi chưa biết (lúc ném từ trong transaction); service điền sau khi rollback.
 */
export class RelatedTourNotFoundError extends ContractError<'RELATED_TOUR_NOT_FOUND'> {
  constructor(readonly tourIds: readonly string[] = []) {
    super('RELATED_TOUR_NOT_FOUND', 'A related tour no longer exists', false);
  }
}

/** Thiếu cặp khoá Cloudinary — trạng thái cấu hình hợp lệ (ADR-0021 §6), 503. */
export class PostCoverUploadsNotConfiguredError extends ContractError<'MEDIA_UPLOAD_NOT_CONFIGURED'> {
  constructor() {
    super('MEDIA_UPLOAD_NOT_CONFIGURED', 'Uploads are not configured', false);
  }
}
