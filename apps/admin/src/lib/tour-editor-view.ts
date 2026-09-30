import {
  type AdminTourDetail,
  type CostItemLike,
  derivedCostPrice,
  fromCents,
  perDepartureTotal,
  perPersonTotal,
  TourBasePriceSchema,
  type TourReadiness,
  toCents,
  tourReadiness,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount } from './bookings-view';
import { withDeliveryTransform } from './cloudinary-url';

/**
 * VM THUẦN của khu làm việc tour (spec F17 §2g–§2i) — mọi phép tính mà component
 * cần mà không phải chuyện hiển thị: đường và trạng thái của bước, danh sách
 * thiếu, ngày lịch trình sẽ bị xoá, tổng chi phí tính ngay khi gõ.
 */
const t = messages.admin.tours.editor;

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

/**
 * Link "Next:" ở chân form của một bước — bước liền sau trong `TOUR_EDITOR_STEPS`,
 * đường dẫn và nhãn đi cùng nhau. Bước cuối không có bước kế (vòng review F19: trước
 * đây năm form tự gõ bước kế, đổi thứ tự bước thì các link này đi sai mà test vẫn xanh).
 */
export function nextTourStep(
  slug: string,
  step: TourEditorStep,
): { href: string; label: string } | undefined {
  const after = TOUR_EDITOR_STEPS[TOUR_EDITOR_STEPS.indexOf(step) + 1];
  return after === undefined
    ? undefined
    : { href: tourStepHref(slug, after), label: t.tabs[after] };
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

/** Ba bước mà readiness đòi — hai bước còn lại tuỳ chọn, bước cuối là bước duyệt. */
type RequiredStep = 'details' | 'photos' | 'itinerary';

/**
 * Bước SỞ HỮU từng mục readiness — nguồn duy nhất cho cả đường sửa (`readinessIssues`)
 * lẫn việc chia mục về bước (`tourSteps`). Khoá theo MỤC nên thêm một mục readiness mà
 * quên gán bước là lỗi typecheck, không phải một hàng Review xanh nằm cạnh công tắc bị
 * khoá (vòng review F19).
 */
const ISSUE_STEP: Record<ReadinessIssue['key'], RequiredStep> = {
  summary: 'details',
  primaryDestination: 'details',
  days: 'itinerary',
  cover: 'photos',
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
  const vm = (
    step: TourEditorStep,
    status: TourStepStatus,
    summary: string,
    fixHref: string | null = null,
  ): TourStepVM => ({
    step,
    href: tourStepHref(detail.slug, step),
    title: t.tabs[step],
    status,
    summary,
    fixHref,
  });
  const required = (step: RequiredStep, ready: string): TourStepVM => {
    const own = issues.filter((issue) => ISSUE_STEP[issue.key] === step);
    const [first] = own;
    return first === undefined
      ? vm(step, 'ok', ready)
      : vm(
          step,
          'warn',
          s.missing(own.map((issue) => lowerFirst(issue.label)).join(', ')),
          first.href,
        );
  };
  const review = detail.isPublished
    ? s.reviewOnSale
    : issues.length === 0
      ? s.reviewReady
      : s.reviewToFix(issues.length);
  // Khoá theo bước nên thiếu một bước là lỗi typecheck; thứ tự lấy từ TOUR_EDITOR_STEPS.
  const byStep: Record<TourEditorStep, () => TourStepVM> = {
    details: () => required('details', s.detailsReady),
    photos: () => required('photos', s.photosReady(detail.photos.length)),
    itinerary: () => required('itinerary', s.itineraryReady),
    content: () =>
      vm('content', 'optional', s.optionalContent(detail.faqs.length, detail.policies.length)),
    costs: () => vm('costs', 'optional', s.optionalCosts(detail.costItems.length)),
    review: () => vm('review', 'final', review),
  };
  return TOUR_EDITOR_STEPS.map((step) => byStep[step]());
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
  /** Bước cần sửa, kèm `#id` của ô (ô tóm tắt, khung điểm đến, thẻ ngày đầu tiên thiếu). */
  href: string;
}

export function readinessIssues(readiness: TourReadiness, slug: string): ReadinessIssue[] {
  // Đường sửa = bước sở hữu mục (ISSUE_STEP) + `#id` của ô cần sửa.
  const at = (key: ReadinessIssue['key'], hash = '') =>
    `${tourStepHref(slug, ISSUE_STEP[key])}${hash}`;
  const issues: ReadinessIssue[] = [];
  if (!readiness.summary) {
    issues.push({
      key: 'summary',
      label: t.readiness.summary,
      href: at('summary', '#tour-summary'),
    });
  }
  if (!readiness.primaryDestination) {
    issues.push({
      key: 'primaryDestination',
      label: t.readiness.primaryDestination,
      href: at('primaryDestination', '#tour-destinations'),
    });
  }
  const [firstMissing] = readiness.missingDays;
  if (firstMissing !== undefined) {
    issues.push({
      key: 'days',
      label: t.readiness.days(formatDayList(readiness.missingDays), readiness.missingDays.length),
      href: at('days', `#day-${firstMissing}`),
    });
  }
  if (!readiness.cover) {
    issues.push({ key: 'cover', label: t.readiness.cover, href: at('cover') });
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

/** Thẻ xem trước card /tours ở cột phải bước Details (spec F19 §2d.1). */
export interface TourCardPreviewVM {
  coverUrl: string | null;
  title: string;
  summary: string;
  featured: boolean;
  /** "Hạ Long · 3 days · Max 12" — như băng dữ kiện của card web; mẩu đang gõ dở thì bỏ. */
  facts: string;
  /** Sao như card web: "4.7" và "(1,280)"; `null` = chưa ai đánh giá (KHÁC 0). */
  rating: { value: string; count: string } | null;
  /** Giá gốc ĐANG GÕ, định dạng tiền; chưa thành giá gốc hợp lệ thì "—" (không in NaN). */
  price: string;
}

/**
 * Card /tours của tour với giá trị ĐANG GÕ ở bước Details — chữ lấy từ
 * `messages.toursPage` như card web. `days`, `groupSize` là số đã parse (`NaN` khi ô
 * gõ dở); nhận số chứ không nhận chữ vì `parseWholeNumber` nằm ở `tour-editor-write`,
 * mà file đó đã import file này.
 */
export function tourCardPreview(
  detail: Pick<AdminTourDetail, 'photos' | 'ratingAvg' | 'ratingCount' | 'currency'>,
  draft: {
    title: string;
    summary: string;
    isFeatured: boolean;
    days: number;
    groupSize: number;
    basePrice: string;
    primaryDestination: string | null;
  },
): TourCardPreviewVM {
  const tp = messages.toursPage;
  const title = draft.title.trim();
  const price = draft.basePrice.trim();
  return {
    coverUrl: detail.photos[0]?.url ?? null,
    title: title === '' ? t.aside.preview.untitled : title,
    summary: draft.summary.trim(),
    featured: draft.isFeatured,
    facts: [
      draft.primaryDestination,
      draft.days > 0 ? tp.durationValue(draft.days) : null,
      draft.groupSize > 0 ? tp.maxGroup(draft.groupSize) : null,
    ]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · '),
    // `ratingAvg` của contract là chuỗi thập phân ("4.66"), không phải số như ở web.
    rating:
      detail.ratingAvg === null
        ? null
        : {
            value: Number(detail.ratingAvg).toFixed(1),
            count: detail.ratingCount.toLocaleString('en-US'),
          },
    price: TourBasePriceSchema.safeParse(price).success
      ? formatCardPrice(price, detail.currency)
      : t.aside.preview.noPrice,
  };
}

const CARD_PRICE_FORMATTERS = new Map<string, Intl.NumberFormat>();

/**
 * Giá như card web in (`formatMoney` của apps/web: đô tròn, không số lẻ) — thẻ xem
 * trước phải đọc giống card thật; `formatAmount` hai số lẻ là chữ của sổ sách admin.
 * Currency lạ thì rơi về `formatAmount` (có sẵn đường lùi của nó), không để RangeError
 * nổ trong render.
 */
function formatCardPrice(amount: string, currency: string): string {
  let formatter = CARD_PRICE_FORMATTERS.get(currency);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      });
    } catch {
      return formatAmount(amount, currency);
    }
    CARD_PRICE_FORMATTERS.set(currency, formatter);
  }
  return formatter.format(Number(amount));
}
