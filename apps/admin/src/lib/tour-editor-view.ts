import {
  type AdminTourDetail,
  type CostItemLike,
  derivedCostPrice,
  fromCents,
  perDepartureTotal,
  perPersonTotal,
  type TourReadiness,
  toCents,
  tourReadiness,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * VM THUẦN của khu làm việc tour (spec F17 §2g–§2i) — mọi phép tính mà component
 * cần mà không phải chuyện hiển thị: đường của tab, danh sách thiếu của khung
 * readiness, ngày lịch trình sẽ bị xoá, tổng chi phí tính ngay khi gõ.
 */
const t = messages.admin.tours.editor;

export type TourEditorTab = 'details' | 'itinerary' | 'content' | 'costs' | 'departures';

export const TOUR_EDITOR_TABS: readonly TourEditorTab[] = [
  'details',
  'itinerary',
  'content',
  'costs',
  'departures',
];

export function tourTabHref(slug: string, tab: TourEditorTab): string {
  const base = `/tours/${encodeURIComponent(slug)}`;
  return tab === 'details' ? base : `${base}/${tab}`;
}

export function activeTourTab(pathname: string, slug: string): TourEditorTab {
  const rest = pathname.slice(tourTabHref(slug, 'details').length).replace(/^\//, '');
  const segment = rest.split('/')[0] ?? '';
  return (TOUR_EDITOR_TABS as readonly string[]).includes(segment)
    ? (segment as TourEditorTab)
    : 'details';
}

/** [2, 4, 5, 6] → "2, 4–6". Đầu vào đã sắp tăng dần (như `missingDays`). */
export function formatDayList(days: readonly number[]): string {
  const parts: string[] = [];
  let start = days[0];
  let previous = days[0];
  for (const day of [...days.slice(1), Number.NaN]) {
    if (previous !== undefined && day === previous + 1) {
      previous = day;
      continue;
    }
    if (start !== undefined && previous !== undefined) {
      parts.push(start === previous ? `${start}` : `${start}–${previous}`);
    }
    start = day;
    previous = day;
  }
  return parts.join(', ');
}

export interface ReadinessIssue {
  key: 'summary' | 'primaryDestination' | 'days';
  label: string;
  /** Tab cần sửa, kèm `#id` của ô (ô tóm tắt, khung điểm đến, thẻ ngày đầu tiên thiếu). */
  href: string;
}

export function readinessIssues(readiness: TourReadiness, slug: string): ReadinessIssue[] {
  const details = tourTabHref(slug, 'details');
  const issues: ReadinessIssue[] = [];
  if (!readiness.summary) {
    issues.push({ key: 'summary', label: t.readiness.summary, href: `${details}#tour-summary` });
  }
  if (!readiness.primaryDestination) {
    issues.push({
      key: 'primaryDestination',
      label: t.readiness.primaryDestination,
      href: `${details}#tour-destinations`,
    });
  }
  const [firstMissing] = readiness.missingDays;
  if (firstMissing !== undefined) {
    issues.push({
      key: 'days',
      label: t.readiness.days(formatDayList(readiness.missingDays), readiness.missingDays.length),
      href: `${tourTabHref(slug, 'itinerary')}#day-${firstMissing}`,
    });
  }
  return issues;
}

/** Ngày ĐANG có hàng sẽ bị xoá khi hạ số ngày xuống `nextDurationDays` (spec §2b.1). */
export function removedItineraryDays(
  itinerary: readonly { dayNumber: number }[],
  nextDurationDays: number,
): number[] {
  return itinerary
    .map((day) => day.dayNumber)
    .filter((dayNumber) => dayNumber > nextDurationDays)
    .sort((a, b) => a - b);
}

export interface CostBreakdown {
  perPerson: string;
  perDeparture: string;
  /** Giá vốn mỗi khách khi đủ đoàn; `null` khi chưa có dòng chi phí nào. */
  costPrice: string | null;
  /** Giá gốc − giá vốn, kèm phần trăm của giá gốc (làm tròn số nguyên); có thể âm. */
  margin: { amount: string; percent: number } | null;
}

/** Tổng chi phí tính NGAY khi gõ, bằng chính ba hàm của contract mà API gọi lúc lưu. */
export function costBreakdown(
  items: readonly CostItemLike[],
  basePrice: string,
  maxGroupSize: number,
): CostBreakdown {
  const costPrice = items.length > 0 ? derivedCostPrice(items, maxGroupSize) : null;
  const base = toCents(basePrice);
  const margin =
    costPrice === null || base <= 0
      ? null
      : (() => {
          const cents = base - toCents(costPrice);
          return { amount: signedCents(cents), percent: Math.round((cents / base) * 100) };
        })();
  return {
    perPerson: perPersonTotal(items),
    perDeparture: perDepartureTotal(items),
    costPrice,
    margin,
  };
}

/** `fromCents` chỉ nhận số không âm theo nghĩa tiền; biên lời thì có thể âm. */
function signedCents(cents: number): string {
  return cents < 0 ? `-${fromCents(-cents)}` : fromCents(cents);
}

/**
 * Readiness NẾU lệnh sửa đang soạn đi qua — nuôi dải TOUR_NOT_READY và luật "tour
 * đang bán" phía form. Giảm số ngày thì ngày vượt bị xoá theo (spec §2b.1) nên
 * không còn được đếm.
 */
export function projectedReadiness(
  detail: AdminTourDetail,
  patch: {
    summary?: string | null;
    destinations?: readonly { isPrimary: boolean }[];
    durationDays?: number;
    itineraryDays?: readonly number[];
  },
): TourReadiness {
  const durationDays = patch.durationDays ?? detail.durationDays;
  const days = patch.itineraryDays ?? detail.itinerary.map((day) => day.dayNumber);
  return tourReadiness({
    summary: patch.summary === undefined ? detail.summary : patch.summary,
    destinations: patch.destinations ?? detail.destinations,
    durationDays,
    itineraryDays: days.filter((day) => day <= durationDays),
  });
}

/** Nhãn một mục trong ô chọn danh mục/điểm đến — mục đã ẩn mang dấu "(hidden)". */
export function optionLabel(option: { name: string; isActive: boolean }): string {
  return option.isActive ? option.name : messages.admin.tours.list.categoryHidden(option.name);
}
