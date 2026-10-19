import {
  type AdminMediaItem,
  type AdminMediaQueue,
  type AdminMediaQueueRow,
  type MediaAttention,
  type MediaQueueState,
  type MediaUsage,
  type MediaUsageOwner,
  type SiteSlotKey,
  siteSlot,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatDateTime } from './bookings-view';
import { tableCoverThumb, withDeliveryTransform } from './cloudinary-url';
import type { MediaQuery, MediaUsedFilter } from './media-query';
import { formatCount, type StatCardVM } from './stats-view';

/**
 * Mapper hiển thị của `/media` (spec P4f Media §6, ADR-0060) — THUẦN, ngoài React nên test được
 * từng nhánh. API trả mỗi ảnh một mục với mọi chỗ dùng; ở đây dựng nhãn, link trình sửa, chữ tìm
 * kiếm, và lọc ngay trên trình duyệt (danh sách đọc trọn một lần, không phân trang).
 */
const t = messages.admin.media;
const appearance = messages.admin.appearance;

/** Nhãn khe đúng như thẻ của `/appearance`: "Home · Hero". */
export function slotLabel(key: SiteSlotKey): string {
  return appearance.slotName(appearance.groups[siteSlot(key).group], appearance.slots[key]);
}

/** "900 B", "512 KB", "3.2 MB" — dung lượng lưu ở Cloudinary, đơn vị 1024. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Chữ để so khi tìm: chữ thường, bỏ dấu tiếng Việt — gõ "hoi an" hay "Hội An" đều ra. */
export function searchKey(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase();
}

export interface MediaUsageVM {
  /** Khoá React: một chủ chỉ dùng một ảnh một lần ở mỗi vai. */
  key: string;
  ownerType: MediaUsageOwner;
  /** "Tour", "Library", "Post", "Site". */
  kind: string;
  name: string;
  /** Trình sửa nơi đổi hay gỡ ảnh; `null` khi chủ đã xoá. */
  href: string | null;
  /** "Cover" với ảnh bìa của tour, thư viện hay bài viết. */
  note: string | null;
  deleted: boolean;
  alt: string | null;
}

/** Link tới trình sửa của từng loại chủ (spec §6.2): thư viện tới trang Photos của điểm đến (Media B). */
function usageHref(usage: MediaUsage): string | null {
  switch (usage.ownerType) {
    case 'TOUR':
      return usage.slug === null ? null : `/tours/${usage.slug}/photos`;
    case 'DESTINATION':
      return usage.slug === null ? null : `/destinations/${usage.slug}/photos`;
    case 'POST':
      return usage.slug === null ? null : `/posts/${usage.slug}`;
    case 'SITE':
      return usage.key === null ? null : `/appearance#${usage.key}`;
  }
}

function toUsageVM(usage: MediaUsage): MediaUsageVM {
  const name =
    usage.ownerType === 'SITE' && usage.key !== null ? slotLabel(usage.key) : usage.label;
  return {
    key: `${usage.ownerType}:${usage.ownerId}:${usage.role}:${usage.sortOrder}`,
    ownerType: usage.ownerType,
    kind: t.owner[usage.ownerType],
    name: name ?? t.deletedOwner[usage.ownerType],
    href: usageHref(usage),
    note: usage.role === 'hero' && usage.ownerType !== 'SITE' ? t.cover : null,
    deleted: name === null,
    alt: usage.alt,
  };
}

/** "Library · 5 tours · 1 post" — đếm theo loại chủ, thứ tự cố định. */
function usageSummary(usages: readonly MediaUsage[]): string {
  const count = (type: MediaUsageOwner) =>
    usages.filter((usage) => usage.ownerType === type).length;
  const parts = [
    count('DESTINATION') > 0 ? t.usageSummary.library : null,
    count('TOUR') > 0 ? t.usageSummary.tours(count('TOUR')) : null,
    count('POST') > 0 ? t.usageSummary.posts(count('POST')) : null,
    count('SITE') > 0 ? t.usageSummary.site(count('SITE')) : null,
  ];
  return parts.filter((part): part is string => part !== null).join(' · ');
}

const USED_OWNER: Record<MediaUsedFilter, MediaUsageOwner> = {
  tours: 'TOUR',
  library: 'DESTINATION',
  posts: 'POST',
  site: 'SITE',
};

export interface MediaItemVM {
  publicId: string;
  /** Đoạn cuối của publicId — thứ người ta nhận ra trong dashboard Cloudinary. */
  fileName: string;
  thumbUrl: string;
  previewUrl: string;
  /** Alt, hay chữ thay thế khi trống — ô ảnh và tiêu đề ngăn vẫn cần một cái tên. */
  name: string;
  summary: string;
  uploaded: boolean;
  sourceLabel: string;
  sizeLabel: string;
  bytesLabel: string | null;
  formatLabel: string | null;
  attention: MediaAttention[];
  needsAttention: boolean;
  /** Không tác giả, giấy phép hay link nào — bộ lọc riêng, không phải "cần chú ý" (ADR-0060 §1). */
  noCredit: boolean;
  usages: MediaUsageVM[];
  ownerTypes: ReadonlySet<MediaUsageOwner>;
  /** Alt, tác giả, đường dẫn và tên mọi chỗ dùng, đã qua `searchKey`. */
  searchText: string;
  version: string;
  /** Mục gốc — form của ngăn chi tiết đọc giá trị và cờ lệch ở đây. */
  item: AdminMediaItem;
}

export function toMediaItemVM(item: AdminMediaItem): MediaItemVM {
  const usages = item.usages.map(toUsageVM);
  const noCredit =
    item.author === null &&
    item.license === null &&
    item.licenseUrl === null &&
    item.sourceUrl === null;
  return {
    publicId: item.publicId,
    fileName: item.publicId.split('/').at(-1) ?? item.publicId,
    // Rộng 320 như ô ảnh của tab Photos (`tourPhotoThumb`): nét ở ô ~160px màn mật độ cao.
    thumbUrl: withDeliveryTransform(item.url, 'w_320'),
    previewUrl: withDeliveryTransform(item.url, 'w_640'),
    name: item.alt ?? t.untitled,
    summary: usageSummary(item.usages),
    uploaded: item.source === 'UPLOAD',
    sourceLabel: t.drawer.source[item.source],
    sizeLabel:
      item.width !== null && item.height !== null
        ? t.drawer.size(item.width, item.height)
        : t.drawer.sizeUnknown,
    bytesLabel: item.bytes === null ? null : formatBytes(item.bytes),
    formatLabel: item.format === null ? null : item.format.toUpperCase(),
    attention: item.attention,
    needsAttention: item.attention.length > 0,
    noCredit,
    usages,
    ownerTypes: new Set(item.usages.map((usage) => usage.ownerType)),
    searchText: searchKey(
      [item.alt, item.author, item.publicId, ...usages.map((usage) => usage.name)]
        .filter((part): part is string => part !== null)
        .join('\n'),
    ),
    version: item.version,
    item,
  };
}

/** Lọc lưới theo URL: Used in, Show, rồi ô tìm (mọi điều kiện phải cùng đúng). */
export function filterMedia(items: readonly MediaItemVM[], query: MediaQuery): MediaItemVM[] {
  const term = query.search ? searchKey(query.search) : null;
  return items.filter(
    (item) =>
      (!query.used || item.ownerTypes.has(USED_OWNER[query.used])) &&
      (query.show !== 'attention' || item.needsAttention) &&
      (query.show !== 'nocredit' || item.noCredit) &&
      (term === null || item.searchText.includes(term)),
  );
}

export interface MediaStats {
  photos: number;
  attention: number;
  /** Dòng hàng dọn sẽ bị xoá ở một lượt dọn sắp tới. */
  waiting: number;
}

export function mediaStats(items: readonly MediaItemVM[], queue: AdminMediaQueue): MediaStats {
  return {
    photos: items.length,
    attention: items.filter((item) => item.needsAttention).length,
    waiting: queue.rows.filter((row) => row.state === 'WAITING').length,
  };
}

/**
 * Ba thẻ đầu trang (spec §6.1). Cả ba là ảnh chụp, không có kỳ trước nên không có pill xu hướng.
 * Thẻ cần chú ý không gắn pill đỏ: nhãn pill sẽ lặp đúng tên thẻ (đo Chromium 19/10); con số
 * và chú thích đổi theo trạng thái đã đủ nói có việc hay không.
 */
export function toMediaStatCards(stats: MediaStats, graceDays: number): StatCardVM[] {
  return [
    {
      key: 'photos',
      label: t.stats.photos,
      value: formatCount(stats.photos),
      caption: t.stats.photosCaption,
    },
    {
      key: 'attention',
      label: t.stats.attention,
      value: formatCount(stats.attention),
      caption: stats.attention > 0 ? t.stats.attentionSome : t.stats.attentionNone,
    },
    {
      key: 'waiting',
      label: t.stats.waiting,
      value: formatCount(stats.waiting),
      caption: stats.waiting > 0 ? t.stats.waitingSome(graceDays) : t.stats.waitingNone,
    },
  ];
}

// ── Tab Cleanup queue ───────────────────────────────────────────────────────

export interface QueueRowVM {
  publicId: string;
  /** Ảnh thu nhỏ; `null` với avatar và khi không dựng được URL. */
  thumbUrl: string | null;
  kind: string;
  owner: string;
  ownerHref: string | null;
  state: MediaQueueState;
  stateLabel: string;
  queuedLabel: string;
  avatar: boolean;
}

function queueOwner(row: AdminMediaQueueRow): { owner: string; href: string | null } {
  switch (row.zone) {
    case null:
      return { owner: t.queue.noOwner, href: null };
    case 'AVATAR':
      return { owner: t.queue.avatarOwner, href: null };
    case 'REVIEW':
      return row.ownerLabel === null
        ? { owner: t.queue.noOwner, href: null }
        : { owner: t.queue.reviewOwner(row.ownerLabel), href: `/bookings/${row.ownerLabel}` };
    case 'SITE':
      return row.slotKey === null
        ? { owner: t.queue.slotGone, href: null }
        : { owner: slotLabel(row.slotKey), href: `/appearance#${row.slotKey}` };
    case 'TOUR':
    case 'POST':
    case 'DESTINATION': {
      if (row.ownerDeleted || row.ownerLabel === null) {
        return { owner: t.deletedOwner[row.zone], href: null };
      }
      const href =
        row.ownerSlug === null
          ? null
          : row.zone === 'POST'
            ? `/posts/${row.ownerSlug}`
            : `/${row.zone === 'TOUR' ? 'tours' : 'destinations'}/${row.ownerSlug}/photos`;
      return { owner: row.ownerLabel, href };
    }
  }
}

function queueStateLabel(row: AdminMediaQueueRow): string {
  if (row.state === 'WAITING') {
    // `dueAt` luôn có với WAITING (API canh); rơi về ngày xếp hàng thay vì in rác.
    return t.queue.state.WAITING(formatDateTime(row.dueAt ?? row.queuedAt));
  }
  return t.queue.state[row.state];
}

export function toQueueRowVM(row: AdminMediaQueueRow): QueueRowVM {
  const { owner, href } = queueOwner(row);
  return {
    publicId: row.publicId,
    thumbUrl: row.url === null ? null : tableCoverThumb(row.url),
    kind: row.zone === null ? t.queue.outsideZone : t.queue.zone[row.zone],
    owner,
    ownerHref: href,
    state: row.state,
    stateLabel: queueStateLabel(row),
    queuedLabel: formatDateTime(row.queuedAt),
    avatar: row.zone === 'AVATAR',
  };
}

/** Hai dòng tóm tắt đầu tab: dọn bật hay tắt, và lượt dọn gần nhất (spec §6.3). */
export function queueSummary(queue: AdminMediaQueue): { status: string; last: string } {
  const status = queue.gcEnabled ? t.queue.on(queue.graceDays) : t.queue.off;
  const sweep = queue.lastSweep;
  if (sweep === null) return { status, last: t.queue.lastNone };
  const time = (iso: string | null) => formatDateTime(iso);
  switch (sweep.state) {
    case 'completed': {
      const at = time(sweep.finishedAt ?? sweep.startedAt);
      const report = sweep.report;
      return {
        status,
        last:
          report === null
            ? t.queue.lastDoneNoReport(at)
            : // Đã xoá gồm cả file vốn không còn trên CDN; giữ lại gồm cả dòng ngoài vùng.
              t.queue.lastDone(
                at,
                report.resolved,
                report.deferred + report.refused,
                report.failed,
              ),
      };
    }
    case 'failed':
      return { status, last: t.queue.lastFailed(time(sweep.finishedAt ?? sweep.startedAt)) };
    case 'cancelled':
      return { status, last: t.queue.lastCancelled(time(sweep.finishedAt ?? sweep.startedAt)) };
    case 'active':
      return { status, last: t.queue.lastRunning(time(sweep.startedAt)) };
    case 'created':
    case 'retry':
      return { status, last: t.queue.lastQueued };
  }
}
