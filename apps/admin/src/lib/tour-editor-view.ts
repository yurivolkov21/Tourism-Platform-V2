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
import { withDeliveryTransform } from './cloudinary-url';

/**
 * VM THUẦN của khu làm việc tour (spec F17 §2g–§2i) — mọi phép tính mà component
 * cần mà không phải chuyện hiển thị: đường của tab, danh sách thiếu của khung
 * readiness, ngày lịch trình sẽ bị xoá, tổng chi phí tính ngay khi gõ.
 */
const t = messages.admin.tours.editor;

export type TourEditorTab = 'details' | 'photos' | 'itinerary' | 'content' | 'costs' | 'departures';

export const TOUR_EDITOR_TABS: readonly TourEditorTab[] = [
  'details',
  'photos',
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

/**
 * Sáu bước của khu sửa tour, đúng thứ tự thanh bước (ADR-0049 §1). Departures KHÔNG
 * là bước (§5): nó là việc vận hành chuyến, và readiness không phụ thuộc nó.
 */
export type TourEditorStep = 'details' | 'photos' | 'itinerary' | 'content' | 'costs' | 'review';

export const TOUR_EDITOR_STEPS: readonly TourEditorStep[] = [
  'details',
  'photos',
  'itinerary',
  'content',
  'costs',
  'review',
];

export function tourStepHref(slug: string, step: TourEditorStep): string {
  const base = `/tours/${encodeURIComponent(slug)}`;
  return step === 'details' ? base : `${base}/${step}`;
}

/** Bước đang mở theo pathname; `null` ở Departures (không bước nào sáng). Đoạn lạ → Details. */
export function activeTourStep(pathname: string, slug: string): TourEditorStep | null {
  const rest = pathname.slice(tourStepHref(slug, 'details').length).replace(/^\//, '');
  const segment = rest.split('/')[0] ?? '';
  if (segment === 'departures') return null;
  return (TOUR_EDITOR_STEPS as readonly string[]).includes(segment)
    ? (segment as TourEditorStep)
    : 'details';
}

export type TourStepStatus = 'ok' | 'warn' | 'optional' | 'final';

export interface TourStepVM {
  step: TourEditorStep;
  href: string;
  title: string;
  status: TourStepStatus;
  /** Dòng trạng thái — tooltip của thanh bước VÀ hàng của bước Review (cùng chữ). */
  summary: string;
  /** Đích sửa chỗ thiếu ĐẦU TIÊN của bước; chỉ có khi `warn`. */
  fixHref: string | null;
}

/** Mục readiness thuộc về từng bước bắt buộc. */
const STEP_ISSUES: Record<'details' | 'photos' | 'itinerary', readonly ReadinessIssue['key'][]> = {
  details: ['summary', 'primaryDestination'],
  photos: ['cover'],
  itinerary: ['days'],
};

/** "A summary" → "a summary": nhãn readiness đứng giữa câu "Missing: …". */
function lowerFirst(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/**
 * Trạng thái sáu bước từ readiness ĐÃ LƯU (ADR-0049 §2) — nguồn DUY NHẤT của thanh bước
 * và danh sách kiểm tra ở bước Review, nên hai chỗ không thể nói khác nhau. Cột phải
 * của từng bước KHÔNG dùng hàm này: nó đọc giá trị đang soạn qua `projectedReadiness`.
 */
export function tourSteps(detail: AdminTourDetail): TourStepVM[] {
  const s = t.steps;
  const issues = readinessIssues(detail.readiness, detail.slug);
  const required = (step: keyof typeof STEP_ISSUES, ready: string): TourStepVM => {
    const own = issues.filter((issue) => STEP_ISSUES[step].includes(issue.key));
    const [first] = own;
    return {
      step,
      href: tourStepHref(detail.slug, step),
      title: t.tabs[step],
      status: first === undefined ? 'ok' : 'warn',
      summary:
        first === undefined
          ? ready
          : s.missing(own.map((issue) => lowerFirst(issue.label)).join(', ')),
      fixHref: first?.href ?? null,
    };
  };
  const plain = (
    step: 'content' | 'costs' | 'review',
    status: TourStepStatus,
    summary: string,
  ): TourStepVM => ({
    step,
    href: tourStepHref(detail.slug, step),
    title: t.tabs[step],
    status,
    summary,
    fixHref: null,
  });
  const review = detail.isPublished
    ? s.reviewOnSale
    : issues.length === 0
      ? s.reviewReady
      : s.reviewToFix(issues.length);
  return [
    required('details', s.detailsReady),
    required('photos', s.photosReady(detail.photos.length)),
    required('itinerary', s.itineraryReady),
    plain('content', 'optional', s.optionalContent(detail.faqs.length, detail.policies.length)),
    plain('costs', 'optional', s.optionalCosts(detail.costItems.length)),
    plain('review', 'final', review),
  ];
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
  key: 'summary' | 'primaryDestination' | 'days' | 'cover';
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
  if (!readiness.cover) {
    issues.push({ key: 'cover', label: t.readiness.cover, href: tourTabHref(slug, 'photos') });
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
    /** Số ảnh của danh sách đang soạn ở tab Photos — ảnh đầu là ảnh bìa. */
    photoCount?: number;
  },
): TourReadiness {
  const durationDays = patch.durationDays ?? detail.durationDays;
  const days = patch.itineraryDays ?? detail.itinerary.map((day) => day.dayNumber);
  return tourReadiness({
    summary: patch.summary === undefined ? detail.summary : patch.summary,
    destinations: patch.destinations ?? detail.destinations,
    durationDays,
    itineraryDays: days.filter((day) => day <= durationDays),
    hasCover: patch.photoCount === undefined ? detail.readiness.cover : patch.photoCount > 0,
  });
}

/** Điều kiện readiness mà lệnh sửa ĐANG SOẠN làm hỏng ở một tour đang bán (G11). */
export interface OnSaleShortfalls {
  summary: boolean;
  /** Ngày đang đủ mà bản dự tính làm thiếu, tăng dần. */
  days: number[];
  cover: boolean;
}

/**
 * Chỗ thiếu DO lệnh sửa này gây ra ở một tour ĐANG BÁN — nguồn DUY NHẤT của luật
 * "tour đang bán thì luôn đủ" phía admin (G11, ADR-0048 §8). Ba tab tự gắn kết quả
 * vào ô của mình.
 *
 * Chỉ đếm điều kiện bản hiện tại ĐẠT mà bản dự tính HỎNG: đúng ba luật viết tay cũ
 * (xoá tóm tắt, thêm ngày, xoá tiêu đề ngày) cộng ảnh bìa, và không đổ cho lệnh
 * này một chỗ thiếu có từ trước. Tour tắt bán thì rỗng. Server vẫn là trọng tài cuối.
 */
export function onSaleShortfalls(
  detail: AdminTourDetail,
  projected: TourReadiness,
): OnSaleShortfalls {
  if (!detail.isPublished) return { summary: false, days: [], cover: false };
  const current = detail.readiness;
  return {
    summary: current.summary && !projected.summary,
    days: projected.missingDays.filter((day) => !current.missingDays.includes(day)),
    cover: current.cover && !projected.cover,
  };
}

/**
 * Thumbnail 320px cho dòng ảnh của tab Photos. `w_` thu nhỏ giữ tỉ lệ; khung 3:2
 * do CSS `object-fit: cover` lo. KHÔNG `c_fill` như `reviewPhotoThumb`: cắt cúp ảnh
 * CC BY-SA tạo tác phẩm phái sinh (ADR-0020 §4). URL không theo khuôn trả nguyên.
 */
export function tourPhotoThumb(url: string): string {
  return withDeliveryTransform(url, 'w_320');
}

/** Nhãn một mục trong ô chọn danh mục/điểm đến — mục đã ẩn mang dấu "(hidden)". */
export function optionLabel(option: { name: string; isActive: boolean }): string {
  return option.isActive ? option.name : messages.admin.tours.list.categoryHidden(option.name);
}
