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

/** Đoạn transform mà `buildCloudinaryUrl` phía API gắn cho ảnh (ADR-0005). */
const CLOUDINARY_IMAGE_TRANSFORM = '/upload/f_auto,q_auto/';

/**
 * Thumbnail 320px cho dòng ảnh của tab Photos. `w_` thu nhỏ giữ tỉ lệ; khung 3:2
 * do CSS `object-fit: cover` lo. KHÔNG `c_fill` như `reviewPhotoThumb`: cắt cúp ảnh
 * CC BY-SA tạo tác phẩm phái sinh (ADR-0020 §4). URL không theo khuôn trả nguyên.
 */
export function tourPhotoThumb(url: string): string {
  return url.includes(CLOUDINARY_IMAGE_TRANSFORM)
    ? url.replace(CLOUDINARY_IMAGE_TRANSFORM, '/upload/f_auto,q_auto,w_320/')
    : url;
}

/** URL delivery của ảnh VỪA tải lên — đúng khuôn `buildCloudinaryUrl` phía API. */
export function cloudinaryImageUrl(cloudName: string, publicId: string, version: string): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/v${version}/${publicId}`;
}

/** Nhãn một mục trong ô chọn danh mục/điểm đến — mục đã ẩn mang dấu "(hidden)". */
export function optionLabel(option: { name: string; isActive: boolean }): string {
  return option.isActive ? option.name : messages.admin.tours.list.categoryHidden(option.name);
}
