import type { ActivityDetails, AdminActivityItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount, formatCalendarDate, formatDateTime } from './bookings-view';
import { formatMonthLabel } from './month-options';
import { roleLabel } from './role-label';
import { type BadgeVariant, userRoleBadgeVariant } from './users-view';

/**
 * Logic THUẦN của trang `/activity` (ADR-0061, spec 2026-10-19 §6): nhãn thao tác, câu tóm tắt
 * từ `details`, nhãn và link của đối tượng. Component không tự tính gì.
 *
 * Dòng nhật ký là bản ghi lịch sử: khoá thao tác hay loại đối tượng lạ (thao tác đã bỏ ở bản sau)
 * vẫn phải in được, nên mọi tra cứu ở đây có đường lui chứ không ném.
 */

const t = messages.admin.activity;

const ACTION_LABELS: Record<string, string> = t.actions;
const AREA_LABELS: Record<string, string> = t.areas;
const FALLBACK_ITEMS: Record<string, string> = t.fallbackItem;
const ENQUIRY_STATUS: Record<string, string> = messages.admin.enquiries.status;
const EMAIL_TYPES: Record<string, string> = messages.admin.outbox.type;
const VERDICTS: Record<string, string> = t.summary.verdict;
const POST_STATUS: Record<string, string> = t.summary.postStatus;
const MOVED: Record<string, string> = t.summary.moved;

// ── Đọc `details` an toàn: dòng cũ có thể thiếu khoá hay sai kiểu ────────────────────────────

function str(details: ActivityDetails, key: string): string | undefined {
  const value = details[key];
  return typeof value === 'string' ? value : undefined;
}

function num(details: ActivityDetails, key: string): number | undefined {
  const value = details[key];
  return typeof value === 'number' ? value : undefined;
}

function bool(details: ActivityDetails, key: string): boolean | undefined {
  const value = details[key];
  return typeof value === 'boolean' ? value : undefined;
}

/** Chọn nhãn theo chiều của cờ; thiếu cờ thì về nhãn trung tính của thao tác. */
function toggle(flag: boolean | undefined, on: string, off: string, neutral: string): string {
  if (flag === undefined) return neutral;
  return flag ? on : off;
}

/** Nhãn thao tác (cột What). Thao tác bật/tắt đọc chiều từ `details` (spec §3). */
export function activityActionLabel(action: string, details: ActivityDetails): string {
  const neutral = ACTION_LABELS[action] ?? action;
  switch (action) {
    case 'tours.setPublished':
      return toggle(
        bool(details, 'published'),
        t.toggles.putOnSale,
        t.toggles.tookOffSale,
        neutral,
      );
    case 'categories.setActive':
      return toggle(
        bool(details, 'active'),
        t.toggles.showedCategory,
        t.toggles.hidCategory,
        neutral,
      );
    case 'destinations.setActive':
      return toggle(
        bool(details, 'active'),
        t.toggles.showedDestination,
        t.toggles.hidDestination,
        neutral,
      );
    case 'departures.setStatus': {
      const status = str(details, 'status');
      if (status === 'OPEN') return t.toggles.openedDeparture;
      if (status === 'CLOSED') return t.toggles.closedDeparture;
      return neutral;
    }
    case 'users.setRole': {
      const role = str(details, 'role');
      if (role === 'STAFF') return t.toggles.grantedStaff;
      if (role === 'CUSTOMER') return t.toggles.removedStaff;
      return neutral;
    }
    default:
      return neutral;
  }
}

function departs(details: ActivityDetails): string | null {
  const date = str(details, 'startDate');
  return date ? t.summary.departs(formatCalendarDate(date)) : null;
}

function exportSummary(details: ActivityDetails): string | null {
  const rows = num(details, 'rows');
  if (rows === undefined) return null;
  const scope =
    str(details, 'mode') === 'selection'
      ? t.summary.exportScope.selection
      : bool(details, 'filtered')
        ? t.summary.exportScope.filtered
        : t.summary.exportScope.all;
  return `${t.summary.exportRows(rows)} · ${scope}`;
}

function counted(value: number | undefined, format: (n: number) => string): string | null {
  return value === undefined ? null : format(value);
}

/** Câu tóm tắt dưới nhãn thao tác; `null` khi thao tác không có chi tiết nào đáng in. */
export function activitySummary(action: string, details: ActivityDetails): string | null {
  switch (action) {
    case 'bookings.refund': {
      const amount = str(details, 'amount');
      const currency = str(details, 'currency');
      if (!amount || !currency) return null;
      return t.summary.refund(formatAmount(amount, currency), bool(details, 'full') === true);
    }
    case 'reviews.moderate':
      return VERDICTS[str(details, 'verdict') ?? ''] ?? null;
    case 'outbox.retry': {
      const type = str(details, 'emailType');
      return type ? (EMAIL_TYPES[type] ?? type) : null;
    }
    case 'enquiries.setStatus': {
      const status = str(details, 'status');
      return status ? t.summary.enquiryStatus(ENQUIRY_STATUS[status] ?? status) : null;
    }
    case 'tours.setItinerary':
      return counted(num(details, 'days'), t.summary.days);
    case 'tours.setFaqsPolicies': {
      const faqs = num(details, 'faqs');
      const policies = num(details, 'policies');
      return faqs === undefined || policies === undefined
        ? null
        : t.summary.faqsPolicies(faqs, policies);
    }
    case 'tours.setCosts':
      return counted(num(details, 'items'), t.summary.costs);
    case 'tours.setPhotos':
    case 'destinations.setPhotos':
      return counted(num(details, 'photos'), t.summary.photos);
    case 'categories.move':
      return MOVED[str(details, 'direction') ?? ''] ?? null;
    case 'departures.create':
    case 'departures.update':
    case 'departures.setStatus':
    case 'departures.cancel':
      return departs(details);
    case 'posts.update':
      return POST_STATUS[str(details, 'status') ?? ''] ?? null;
    case 'media.update':
      return counted(num(details, 'uses'), t.summary.uses);
    case 'users.revokeSessions':
      return counted(num(details, 'sessions'), t.summary.sessions);
    case 'bookings.export':
    case 'subscribers.export':
      return exportSummary(details);
    case 'reports.export': {
      const month = str(details, 'month');
      return month ? formatMonthLabel(month) : null;
    }
    default:
      return null;
  }
}

/**
 * Link tới đối tượng khi nó còn (`ref` là khoá đường HIỆN TẠI do API đọc lúc liệt kê). Review,
 * email, danh mục, ảnh và người nhận tin không có trang riêng: không link.
 */
export function activityTargetHref(type: string, ref: string | null): string | null {
  if (!ref) return null;
  const safe = encodeURIComponent(ref);
  switch (type) {
    case 'booking':
      return `/bookings/${safe}`;
    case 'enquiry':
      return `/enquiries/${safe}`;
    case 'tour':
      return `/tours/${safe}`;
    case 'departure':
      return `/tours/${safe}/departures`;
    case 'post':
      return `/posts/${safe}`;
    case 'destination':
      return `/destinations/${safe}/photos`;
    case 'account':
      return `/users/${safe}`;
    case 'slot':
      return `/appearance#${safe}`;
    default:
      return null;
  }
}

export function activityAreaLabel(area: string): string {
  return AREA_LABELS[area] ?? area;
}

export interface ActivityItemVM {
  label: string;
  /** Nhãn chụp lúc ghi trống — in chữ thay thế ("a subscriber") bằng màu nhạt. */
  isFallback: boolean;
  href: string | null;
}

export interface ActivityRowVM {
  id: string;
  when: string;
  who: string;
  roleLabel: string;
  roleVariant: BadgeVariant;
  what: string;
  summary: string | null;
  area: string;
  item: ActivityItemVM | null;
}

export function toActivityRowVM(row: AdminActivityItem): ActivityRowVM {
  const target = row.target;
  return {
    id: row.id,
    when: formatDateTime(row.createdAt),
    who: row.actor.label,
    roleLabel: roleLabel(row.actor.role),
    roleVariant: userRoleBadgeVariant(row.actor.role),
    what: activityActionLabel(row.action, row.details),
    summary: activitySummary(row.action, row.details),
    area: activityAreaLabel(row.area),
    item: target
      ? {
          label: target.label ?? FALLBACK_ITEMS[target.type] ?? t.fallbackItem.other,
          isFallback: !target.label,
          href: activityTargetHref(target.type, target.ref),
        }
      : null,
  };
}
