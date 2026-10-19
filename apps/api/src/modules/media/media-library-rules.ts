import {
  type AdminMediaItem,
  type AdminMediaUpdateInput,
  type MediaCredit,
  type MediaUsage,
  type MediaUsageOwner,
  mediaAltRequired,
  mediaAttention,
  type SiteSlotKey,
} from '@tourism/contract';
import { MediaType } from '../../generated/prisma/enums.js';
import { buildCloudinaryUrl } from '../../lib/cloudinary-url.js';
import { isUploadZonePublicId } from '../../lib/upload-signing.js';
import {
  postRevalidationTags,
  siteMediaRevalidationTags,
  tourRevalidationTags,
} from '../web-revalidation/revalidation-decision.js';

/**
 * Phần THUẦN của Media library (ADR-0060): gom dòng `media_assets` thành mục ảnh, version của
 * ảnh, thứ tự khoá chủ, dòng cần ghi và tag bust. Mọi câu DB nằm ở `admin-media.service.ts`.
 */

/** Một dòng `media_assets` loại IMAGE của bốn loại chủ — đúng các cột trang này đọc. */
export interface MediaLibraryRow {
  id: string;
  publicId: string;
  ownerType: MediaUsageOwner;
  ownerId: string;
  role: MediaUsage['role'];
  sortOrder: number;
  alt: string | null;
  author: string | null;
  license: string | null;
  licenseUrl: string | null;
  sourceUrl: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
  /** Phiên bản Cloudinary (đoạn `/v<version>/` của URL), không phải version của ảnh. */
  version: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Tên và đường link của một chủ; khe chỉ có khoá (admin dựng nhãn từ chữ Appearance). */
export interface OwnerInfo {
  label: string | null;
  slug: string | null;
  key: SiteSlotKey | null;
}

export const ownerRef = (ownerType: MediaUsageOwner, ownerId: string): string =>
  `${ownerType}:${ownerId}`;

/**
 * Version của ảnh: `<số dòng>:<updatedAt lớn nhất>` (ADR-0060 §1). Số dòng bắt được chủ mượn
 * thêm hay gỡ ảnh mà không dòng còn lại nào đổi `updatedAt`.
 */
export function mediaVersion(rows: readonly Pick<MediaLibraryRow, 'updatedAt'>[]): string {
  const latest = Math.max(0, ...rows.map((row) => row.updatedAt.getTime()));
  return `${rows.length}:${new Date(latest).toISOString()}`;
}

const byCreatedAt = (a: MediaLibraryRow, b: MediaLibraryRow): number =>
  a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

/**
 * Mỗi ảnh một nhóm: nhóm có dòng tạo gần nhất lên trước (ảnh vừa thêm hay vừa được mượn), dòng
 * trong nhóm cũ trước mới sau.
 */
export function groupByPublicId(rows: readonly MediaLibraryRow[]): MediaLibraryRow[][] {
  const groups = new Map<string, MediaLibraryRow[]>();
  for (const row of rows) {
    const group = groups.get(row.publicId);
    if (group) group.push(row);
    else groups.set(row.publicId, [row]);
  }
  const newest = (group: readonly MediaLibraryRow[]) =>
    Math.max(...group.map((row) => row.createdAt.getTime()));
  return [...groups.values()]
    .map((group) => group.sort(byCreatedAt))
    .sort(
      (a, b) => newest(b) - newest(a) || (a[0]?.publicId ?? '').localeCompare(b[0]?.publicId ?? ''),
    );
}

/**
 * Dòng mang giá trị chung khi các dòng lệch nhau: dòng thư viện (nguồn mà tab Photos chép), không
 * có thì dòng cũ nhất. `rows` đã sắp cũ trước.
 */
function canonicalRow(rows: readonly MediaLibraryRow[]): MediaLibraryRow {
  const first = rows.find((row) => row.ownerType === 'DESTINATION') ?? rows[0];
  if (!first) throw new Error('Mục ảnh không có dòng nào');
  return first;
}

/** Dòng có số đo — ưu tiên thư viện, vì dòng tour mượn không chép kích thước và dung lượng. */
function measuredRow(rows: readonly MediaLibraryRow[]): MediaLibraryRow | null {
  return (
    rows.find((row) => row.ownerType === 'DESTINATION' && row.width !== null) ??
    rows.find((row) => row.width !== null) ??
    null
  );
}

const creditOf = (row: MediaLibraryRow): MediaCredit => ({
  author: row.author,
  license: row.license,
  licenseUrl: row.licenseUrl,
  sourceUrl: row.sourceUrl,
});

const creditKey = (credit: MediaCredit): string =>
  JSON.stringify([credit.author, credit.license, credit.licenseUrl, credit.sourceUrl]);

/** Thứ tự hiển thị chỗ dùng: thư viện trước (nguồn), rồi tour, bài viết, khe. */
const OWNER_DISPLAY_ORDER: readonly MediaUsageOwner[] = ['DESTINATION', 'TOUR', 'POST', 'SITE'];

function toUsage(row: MediaLibraryRow, owners: ReadonlyMap<string, OwnerInfo>): MediaUsage {
  const owner = owners.get(ownerRef(row.ownerType, row.ownerId));
  return {
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    label: owner?.label ?? null,
    slug: owner?.slug ?? null,
    key: owner?.key ?? null,
    role: row.role,
    sortOrder: row.sortOrder,
    alt: row.alt,
  };
}

function compareUsages(a: MediaUsage, b: MediaUsage): number {
  return (
    OWNER_DISPLAY_ORDER.indexOf(a.ownerType) - OWNER_DISPLAY_ORDER.indexOf(b.ownerType) ||
    (a.label ?? a.key ?? '').localeCompare(b.label ?? b.key ?? '') ||
    a.ownerId.localeCompare(b.ownerId)
  );
}

/** Một nhóm dòng của cùng publicId → một mục ảnh (ADR-0060 §2). */
export function toMediaItem(
  group: readonly MediaLibraryRow[],
  ctx: { cloudName: string; rootFolder: string; owners: ReadonlyMap<string, OwnerInfo> },
): AdminMediaItem {
  const rows = [...group].sort(byCreatedAt);
  const canonical = canonicalRow(rows);
  const measured = measuredRow(rows);
  const cloudinaryVersion =
    measured?.version ?? rows.find((row) => row.version !== null)?.version ?? null;
  const { url } = buildCloudinaryUrl(ctx.cloudName, {
    type: MediaType.IMAGE,
    publicId: canonical.publicId,
    version: cloudinaryVersion,
  });

  const credit = creditOf(canonical);
  const credits = new Map<string, MediaCredit>([[creditKey(credit), credit]]);
  for (const row of rows) {
    const other = creditOf(row);
    if (!credits.has(creditKey(other))) credits.set(creditKey(other), other);
  }
  const creditVaries = credits.size > 1;
  const altRequired = mediaAltRequired(rows.map((row) => row.ownerType));

  return {
    publicId: canonical.publicId,
    url,
    width: measured?.width ?? null,
    height: measured?.height ?? null,
    bytes: measured?.bytes ?? null,
    format: measured?.format ?? null,
    alt: canonical.alt,
    altVaries: new Set(rows.map((row) => row.alt)).size > 1,
    altRequired,
    ...credit,
    creditVaries,
    creditVariants: creditVaries ? [...credits.values()] : [],
    source: isUploadZonePublicId(ctx.rootFolder, canonical.publicId) ? 'UPLOAD' : 'CATALOG',
    usages: rows.map((row) => toUsage(row, ctx.owners)).sort(compareUsages),
    attention: mediaAttention({
      altRequired,
      alts: rows.map((row) => row.alt),
      author: credit.author,
      license: credit.license,
      licenseUrl: credit.licenseUrl,
    }),
    version: mediaVersion(rows),
  };
}

/**
 * Thứ tự khoá chủ (ADR-0060 §3): tour, điểm đến, bài viết, khe; trong mỗi loại theo id. Mọi
 * trình sửa đang có giành hàng chủ trước rồi mới ghi dòng ảnh — khoá theo đúng chiều ấy và theo
 * một thứ tự cố định thì hai lệnh lưu cùng lúc không deadlock.
 */
const OWNER_LOCK_ORDER: readonly MediaUsageOwner[] = ['TOUR', 'DESTINATION', 'POST', 'SITE'];

export function ownersInLockOrder(
  rows: readonly Pick<MediaLibraryRow, 'ownerType' | 'ownerId'>[],
): { ownerType: MediaUsageOwner; ids: string[] }[] {
  return OWNER_LOCK_ORDER.flatMap((ownerType) => {
    const ids = [
      ...new Set(rows.filter((row) => row.ownerType === ownerType).map((row) => row.ownerId)),
    ].sort();
    return ids.length === 0 ? [] : [{ ownerType, ids }];
  });
}

export type MediaValues = Pick<
  AdminMediaUpdateInput,
  'alt' | 'author' | 'license' | 'licenseUrl' | 'sourceUrl'
>;

/** Dòng đang khác giá trị mới ở ít nhất một trong năm ô — chỉ chúng được ghi (ADR-0060 §3 bước 4). */
export function rowsToWrite<Row extends MediaValues>(
  rows: readonly Row[],
  values: MediaValues,
): Row[] {
  return rows.filter(
    (row) =>
      row.alt !== values.alt ||
      row.author !== values.author ||
      row.license !== values.license ||
      row.licenseUrl !== values.licenseUrl ||
      row.sourceUrl !== values.sourceUrl,
  );
}

/**
 * Tag bust sau commit theo các chủ có dòng vừa đổi, gộp trùng: tour như lệnh sửa tour; điểm đến
 * như lệnh sửa điểm đến (`tours` và trang của các tour gắn nó, xem `writtenTags`); bài viết; khe.
 */
export function mediaUpdateTags(changed: {
  tourSlugs: readonly string[];
  destinationTourSlugs: readonly (readonly string[])[];
  postSlugs: readonly string[];
  site: boolean;
}): string[] {
  return [
    ...new Set([
      ...changed.tourSlugs.flatMap(tourRevalidationTags),
      ...changed.destinationTourSlugs.flatMap((slugs) => [
        'tours',
        ...slugs.flatMap(tourRevalidationTags),
      ]),
      ...changed.postSlugs.flatMap(postRevalidationTags),
      ...(changed.site ? siteMediaRevalidationTags() : []),
    ]),
  ];
}
