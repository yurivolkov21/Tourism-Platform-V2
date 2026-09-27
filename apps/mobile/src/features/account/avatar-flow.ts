import type { ALLOWED_IMAGE_EXTENSIONS, SignedUploadParams } from '@tourism/contract';
import { AVATAR_MAX_BYTES } from '@tourism/contract';
import { messages } from '@tourism/i18n';

type AllowedExt = (typeof ALLOWED_IMAGE_EXTENSIONS)[number];

const MIME_TO_EXT: Record<string, AllowedExt> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

/** MIME của asset chọn từ `expo-image-picker` → đuôi whitelist contract, hoặc
 * `null` nếu MIME thiếu/lạ (kể cả `image/heic` — Cloudinary lưu nhưng browser
 * không decode, cùng lý do web loại heic ở `ALLOWED_IMAGE_EXTENSIONS`). */
export function imageExtensionOfMime(mimeType: string | null | undefined): AllowedExt | null {
  if (mimeType === null || mimeType === undefined) return null;
  return MIME_TO_EXT[mimeType] ?? null;
}

export type AvatarPickError = 'notImage' | 'tooLarge';

/** Một asset đã chọn: đúng MIME whitelist → trần dung lượng (ADR-0021 §2 —
 * enforce thật nằm ở client, bytes không qua Nest nên server không cân được).
 * `fileSize` thiếu (một số máy Android không trả) → bỏ qua kiểm dung lượng,
 * không chặn khách vì một trường tuỳ chọn thiếu. */
export function validateAvatarAsset(asset: {
  mimeType?: string | null;
  fileSize?: number | null;
}): AvatarPickError | null {
  if (imageExtensionOfMime(asset.mimeType) === null) return 'notImage';
  if (typeof asset.fileSize === 'number' && asset.fileSize > AVATAR_MAX_BYTES) return 'tooLarge';
  return null;
}

export interface AvatarActions {
  signUpload: (input: { purpose: 'AVATAR'; ext: AllowedExt }) => Promise<SignedUploadParams>;
  uploadFile: (uri: string, ext: AllowedExt, params: SignedUploadParams) => Promise<string>;
  /** `null` = gỡ avatar (account.setAvatar({ publicId: null })). */
  setAvatar: (publicId: string | null) => Promise<{ image: string | null }>;
}

export type AvatarOutcome =
  | { kind: 'done'; image: string | null }
  | { kind: 'error'; text: string };

/**
 * A4 (spec P5b-4 §4, ADR-0040 AMEND 5) — một lần chọn ảnh (camera/thư viện).
 * Luồng ĐÚNG (đối chiếu ADR-0021 §3, KHÔNG `authClient.updateUser`): ký chữ ký
 * → PUT Cloudinary → `account.setAvatar` ghi server-side. Route gọi hàm này
 * rồi tự `refetch()` session — refetch KHÔNG nằm ở đây vì đó là chi tiết của
 * `useSession()`, ngoài phạm vi orchestration thuần.
 */
export async function applyAvatarPick(
  asset: { uri: string; mimeType?: string | null; fileSize?: number | null },
  actions: AvatarActions,
): Promise<AvatarOutcome> {
  const { avatar } = messages.mobile.account;
  const validationError = validateAvatarAsset(asset);
  if (validationError !== null) {
    return {
      kind: 'error',
      text: validationError === 'notImage' ? avatar.errNotImage : avatar.errTooLarge,
    };
  }
  // An toàn kiểu: `validateAvatarAsset` đã xác nhận MIME hợp lệ ở trên nên
  // `ext` không thể null tới đây — nhưng tsc không tự suy ra qua lời gọi hàm
  // khác, giữ guard rõ để không ép `as`.
  const ext = imageExtensionOfMime(asset.mimeType);
  if (ext === null) return { kind: 'error', text: avatar.errNotImage };

  try {
    const params = await actions.signUpload({ purpose: 'AVATAR', ext });
    const publicId = await actions.uploadFile(asset.uri, ext, params);
    const result = await actions.setAvatar(publicId);
    return { kind: 'done', image: result.image };
  } catch {
    // Mọi lỗi (ORPCError của signUpload/setAvatar, hay lỗi mạng của
    // uploadToCloudinary) gộp về một thông báo chung — cùng luật web.
    return { kind: 'error', text: avatar.errUpload };
  }
}

/** Gỡ avatar về chữ-cái-đầu — `publicId: null` (ADR-0021 §3). */
export async function removeAvatar(
  actions: Pick<AvatarActions, 'setAvatar'>,
): Promise<AvatarOutcome> {
  try {
    const result = await actions.setAvatar(null);
    return { kind: 'done', image: result.image };
  } catch {
    return { kind: 'error', text: messages.mobile.account.avatar.errUpload };
  }
}
