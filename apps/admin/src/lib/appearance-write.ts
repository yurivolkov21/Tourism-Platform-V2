import type {
  AdminAppearanceSetSlotInput,
  AdminAppearanceSignUploadInput,
  AdminLibraryPhoto,
  AdminSiteSlot,
  SignedUploadParams,
  SiteImageSlotKey,
  TourPhotoUpload,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import type { SlotImageVM, SlotVM } from './appearance-view';
import { creditLine } from './appearance-view';
import { cloudinaryImageUrl, withDeliveryTransform } from './cloudinary-url';
import type { UploadedPhoto } from './photo-upload';

/**
 * Lớp ghi của Appearance (ADR-0059) — codec lỗi, hợp đồng vận chuyển của server action, ảnh
 * đang soạn của hộp Replace. THUẦN để test được; server action chỉ re-parse và gọi.
 */
const t = messages.admin.appearance;

// ── Codec ───────────────────────────────────────────────────────────────────

/**
 * `STALE_SLOT` là trạng-thái-cũ: người khác vừa đổi khe dưới chân hộp — đóng hộp, toast, tải lại
 * thẻ (spec §6.2). `PHOTO_NOT_ALLOWED` thì ở lại hộp: chọn ảnh khác là sửa được ngay.
 */
const setSlotCodec = createWriteErrorCodec(t.errors, { stale: ['STALE_SLOT'] });

export type SetSlotContractCode = keyof typeof t.errors;
export const SET_SLOT_CONTRACT_CODES = setSlotCodec.codes;
export const classifySetSlotError = setSlotCodec.classify;
export const setSlotErrorCopy = setSlotCodec.copy;
export const isSetSlotStale = setSlotCodec.isStale;

/** Ký là lệnh chưa đụng gì — câu GENERIC riêng, khuôn ảnh bìa bài viết. */
const signCodec = createWriteErrorCodec(t.signErrors, {
  transportCopy: { GENERIC: t.signFailed },
});

export type SignSlotContractCode = keyof typeof t.signErrors;
export const SIGN_SLOT_CONTRACT_CODES = signCodec.codes;
export const classifySignSlotError = signCodec.classify;
export const signSlotErrorCopy = signCodec.copy;

// ── Hợp đồng vận chuyển của server action ──────────────────────────────────

export type SetSlotResult =
  | { ok: true; slot: AdminSiteSlot }
  | { ok: false; code: SetSlotContractCode | TransportFailureCode };

export type SetSlotAction = (input: AdminAppearanceSetSlotInput) => Promise<SetSlotResult>;

export type SignSlotResult =
  | { ok: true; params: SignedUploadParams }
  | { ok: false; code: SignSlotContractCode | TransportFailureCode };

export type SignSlotAction = (input: AdminAppearanceSignUploadInput) => Promise<SignSlotResult>;

/** Hai lệnh trang truyền xuống thẻ khe — thẻ không tự import đường server nào. */
export interface AppearanceActions {
  setSlot: SetSlotAction;
  signUpload: SignSlotAction;
}

// ── Ảnh đang soạn của hộp Replace ───────────────────────────────────────────

/**
 * Ảnh hộp Replace sẽ lưu. `origin` là nó đến từ đâu TRONG HỘP — ảnh đang dùng (chỉ đổi alt), ảnh
 * vừa tải, ảnh thư viện; server tự phán nguồn lại, đây chỉ để vẽ.
 */
export interface SlotDraft {
  publicId: string;
  /** URL ảnh xem trước, đã thu về bản rộng 640. */
  previewUrl: string;
  width: number | null;
  alt: string;
  credit: string | null;
  origin: 'CURRENT' | 'UPLOAD' | 'LIBRARY';
  /** Metadata Cloudinary — chỉ ảnh MỚI tải mang (ADR-0048 §5). */
  upload?: TourPhotoUpload;
}

/** Ảnh đang dùng → ảnh mở sẵn trong hộp. Khe video hay khe trống thì không có. */
export function currentSlotDraft(image: SlotImageVM | null): SlotDraft | null {
  if (image === null || image.previewUrl === null) return null;
  return {
    publicId: image.publicId,
    previewUrl: image.previewUrl,
    width: image.width,
    alt: image.alt,
    credit: image.credit,
    origin: 'CURRENT',
  };
}

/** Ảnh vừa tải → ảnh đang soạn; alt để trống (tuỳ chọn), không ghi công. */
export function uploadedSlotDraft(uploaded: UploadedPhoto, cloudName: string): SlotDraft {
  const url = cloudinaryImageUrl(cloudName, uploaded.publicId, uploaded.upload.version);
  return {
    publicId: uploaded.publicId,
    previewUrl: withDeliveryTransform(url, 'w_640'),
    width: uploaded.upload.width,
    alt: '',
    credit: null,
    origin: 'UPLOAD',
    upload: uploaded.upload,
  };
}

/** Ảnh thư viện → ảnh đang soạn; alt và ghi công chép từ dòng địa danh, alt sửa được. */
export function librarySlotDraft(photo: AdminLibraryPhoto): SlotDraft {
  return {
    publicId: photo.publicId,
    previewUrl: withDeliveryTransform(photo.url, 'w_640'),
    width: photo.width,
    alt: photo.alt ?? '',
    credit: creditLine(photo.author, photo.license),
    origin: 'LIBRARY',
  };
}

/** Alt đúng như lệnh lưu gửi đi: cắt khoảng trắng, trống là `null`. */
const cleanAlt = (alt: string): string | null => (alt.trim() === '' ? null : alt.trim());

/**
 * Hộp chưa có gì để lưu: vẫn là ảnh đang dùng và alt (sau khi cắt) như cũ. Lưu lúc ấy vẫn nhích
 * phiên bản khe, bust cache web và ghi một dòng nhật ký thao tác — khuôn `canSaveMedia` của Media.
 */
export function isUnchangedSlotDraft(draft: SlotDraft, image: SlotImageVM | null): boolean {
  return (
    draft.origin === 'CURRENT' && image !== null && cleanAlt(draft.alt) === cleanAlt(image.alt)
  );
}

/** Lệnh lưu của hộp Replace — `version` là phiên bản thẻ đang cầm. */
export function setSlotPayload(
  key: SiteImageSlotKey,
  version: string | null,
  draft: SlotDraft,
): AdminAppearanceSetSlotInput {
  return {
    key,
    version,
    image: {
      publicId: draft.publicId,
      alt: cleanAlt(draft.alt),
      ...(draft.upload ? { upload: draft.upload } : {}),
    },
  };
}

/** Restore original: publicId và alt của bảng ảnh gốc (ADR-0059 §4). */
export function restorePayload(
  key: SiteImageSlotKey,
  slot: Pick<SlotVM, 'version' | 'original'>,
): AdminAppearanceSetSlotInput {
  return {
    key,
    version: slot.version,
    image: {
      publicId: slot.original.publicId,
      alt: slot.original.alt === '' ? null : slot.original.alt,
    },
  };
}
