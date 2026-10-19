import {
  type AdminMediaQueueRow,
  type MediaQueueState,
  type MediaSweepReport,
  MediaSweepReportSchema,
  type MediaUploadZone,
} from '@tourism/contract';
import { MediaType } from '../../generated/prisma/enums.js';
import { buildCloudinaryUrl } from '../../lib/cloudinary-url.js';
import { uploadZoneOf } from '../../lib/upload-signing.js';
import { dueAt, GC_MAX_ATTEMPTS } from './media-garbage.js';
import { type OwnerInfo, ownerRef } from './media-library-rules.js';

/**
 * Phần THUẦN của tab Cleanup queue (ADR-0060 §4): vùng và chủ suy từ đường dẫn, trạng thái của
 * một dòng `media_garbage`, và output của job `media-gc`. Chỉ đọc — không gì ở đây đổi hàng dọn.
 */

/** Thư mục ký upload → vùng; `destinations` vào cùng đường ký ảnh điểm đến (Media B). */
const FOLDER_ZONES = new Map<string, MediaUploadZone>([
  ['tours', 'TOUR'],
  ['posts', 'POST'],
  ['site', 'SITE'],
  ['destinations', 'DESTINATION'],
  ['reviews', 'REVIEW'],
  ['avatars', 'AVATAR'],
]);

/** Vùng của chủ dạng uuid có bảng để tra tên — review và avatar không tra. */
export const LOOKUP_ZONES = ['TOUR', 'POST', 'SITE', 'DESTINATION'] as const;
type LookupZone = (typeof LOOKUP_ZONES)[number];
const isLookupZone = (zone: MediaUploadZone): zone is LookupZone =>
  (LOOKUP_ZONES as readonly string[]).includes(zone);

export function parseUploadZone(
  rootFolder: string,
  publicId: string,
): { zone: MediaUploadZone; owner: string } | null {
  const parsed = uploadZoneOf(rootFolder, publicId);
  const zone = parsed === null ? undefined : FOLDER_ZONES.get(parsed.folder);
  return parsed === null || zone === undefined ? null : { zone, owner: parsed.owner };
}

/**
 * Trạng thái một dòng, xét theo đúng thứ tự `sweep` xét: ngoài vùng trước (bộ dọn soi vùng trước
 * phép kiểm tham chiếu), rồi trần lượt thử, rồi còn dùng.
 */
export function queueRowState(row: {
  inZone: boolean;
  attempts: number;
  inUse: boolean;
}): MediaQueueState {
  if (!row.inZone) return 'REFUSED';
  if (row.attempts >= GC_MAX_ATTEMPTS) return 'GAVE_UP';
  if (row.inUse) return 'IN_USE';
  return 'WAITING';
}

/** Đúng các cột của `media_garbage` trang này đọc — `lastError` cố ý không có (ADR-0060 §4). */
export interface GarbageRow {
  publicId: string;
  resourceType: string;
  attempts: number;
  createdAt: Date;
}

/**
 * Một dòng của bảng hàng dọn. Ngày tới hạn là mốc sớm nhất `sweep` coi dòng là quá hạn (`dueAt`);
 * bộ dọn chỉ chạy khi API thức nên ngày thật có thể muộn hơn.
 */
export function toQueueRow(
  row: GarbageRow,
  ctx: {
    cloudName: string;
    rootFolder: string;
    graceDays: number;
    inUse: ReadonlySet<string>;
    owners: ReadonlyMap<string, OwnerInfo>;
  },
): AdminMediaQueueRow {
  const parsed = parseUploadZone(ctx.rootFolder, row.publicId);
  const zone = parsed?.zone ?? null;
  const state = queueRowState({
    inZone: parsed !== null,
    attempts: row.attempts,
    inUse: ctx.inUse.has(row.publicId),
  });
  // Chủ dạng uuid tra được tên; tra hụt nghĩa là chủ đã bị xoá.
  const lookupZone = parsed !== null && isLookupZone(parsed.zone) ? parsed.zone : null;
  const owner =
    lookupZone === null || parsed === null
      ? undefined
      : ctx.owners.get(ownerRef(lookupZone, parsed.owner));
  const { url } = buildCloudinaryUrl(ctx.cloudName, {
    type: row.resourceType === 'video' ? MediaType.VIDEO : MediaType.IMAGE,
    publicId: row.publicId,
  });

  return {
    publicId: row.publicId,
    // Avatar không lộ ảnh của khách lên admin (spec §4.3).
    url: zone === 'AVATAR' ? null : url,
    zone,
    ownerLabel: zone === 'REVIEW' ? (parsed?.owner ?? null) : (owner?.label ?? null),
    ownerSlug: owner?.slug ?? null,
    slotKey: owner?.key ?? null,
    ownerDeleted: lookupZone !== null && owner === undefined,
    state,
    queuedAt: row.createdAt.toISOString(),
    dueAt: state === 'WAITING' ? dueAt(row.createdAt, ctx.graceDays).toISOString() : null,
    attempts: row.attempts,
  };
}

/** Output của job `media-gc`: `SweepReport` từ bản này; job cũ lưu output rỗng thì `null`. */
export function parseSweepOutput(output: unknown): MediaSweepReport | null {
  const parsed = MediaSweepReportSchema.safeParse(output);
  return parsed.success ? parsed.data : null;
}
