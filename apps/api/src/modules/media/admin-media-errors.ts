import { ContractError } from '../../lib/contract-error.js';

/**
 * Lỗi nghiệp vụ của Media library (ADR-0060). Controller đổi chúng thành lỗi contract bằng
 * `toContractError` — chỉ mã mà thủ tục KHAI mới đi qua.
 */

/** Ảnh không còn chỗ dùng nào (bị gỡ khỏi mọi chủ giữa lúc mở và lúc lưu). */
export class MediaNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor(publicId: string) {
    super('NOT_FOUND', `Photo not in use: ${publicId}`, false);
  }
}

/**
 * Version gửi lên không còn khớp các dòng của ảnh, hay tập chỗ dùng vừa đổi (ADR-0060 §3 bước 3).
 * 409: thế giới đã đổi, admin tải lại ngăn chi tiết.
 */
export class StaleMediaError extends ContractError<'STALE_MEDIA'> {
  constructor() {
    super('STALE_MEDIA', 'This photo changed since it was opened.');
  }
}

/** Ảnh có chỗ dùng ở tour hay thư viện mà alt gửi lên trống (ADR-0060 §1). */
export class MediaAltRequiredError extends ContractError<'ALT_REQUIRED'> {
  constructor() {
    super('ALT_REQUIRED', 'Alt text is required for a photo used on a tour or a destination.');
  }
}
