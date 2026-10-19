import { ContractError } from '../../lib/contract-error.js';

/**
 * Lỗi nghiệp vụ của Appearance (ADR-0059). Controller đổi chúng thành lỗi contract bằng
 * `toContractError` — chỉ mã mà thủ tục KHAI mới đi qua. Tên có tiền tố riêng như lỗi của
 * bài viết: repo có nhiều lớp `…PhotoNotAllowedError` ở nhiều module.
 */

/** Phiên bản trong thẻ khe không còn khớp dòng khe (ADR-0059 §3). 409: thế giới đã đổi. */
export class StaleSlotError extends ContractError<'STALE_SLOT'> {
  constructor() {
    super('STALE_SLOT', 'This slot changed since it was opened.');
  }
}

/**
 * Ảnh không thuộc nguồn nào trong bốn (ADR-0059 §2). 400: client đúng không bao giờ gửi —
 * nhưng chuỗi này là đối số của lệnh destroy sau này, nên từ chối cả lệnh.
 */
export class SlotPhotoNotAllowedError extends ContractError<'PHOTO_NOT_ALLOWED'> {
  constructor(publicId: string) {
    super('PHOTO_NOT_ALLOWED', `Photo not allowed for this slot: ${publicId}`, false);
  }
}
