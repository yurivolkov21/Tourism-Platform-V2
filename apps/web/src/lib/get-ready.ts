import { type BookingDetail, tripDayNumbers } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { TourDetailVM } from '@/lib/api/tours';
import { cancellationDeadlineText } from './booking-vm';
import { formatWeekdayDate } from './tours';

/**
 * Khối "Get ready" của đơn sắp đi (spec P7 §2.4) — hàm thuần, component chỉ vẽ.
 *
 * Bốn bước, bước nào thiếu dữ liệu thì bỏ và các bước sau đánh số lại. Dữ liệu tour đến từ
 * `fetchTourDetailOrNull` (cache 300 giây); tour đã gỡ hay API catalog lỗi thì `tour` là `null`
 * và chỉ còn bước hạn huỷ.
 * Mô tả ngày 1 và điểm hẹn in NGUYÊN VĂN — không tách giờ ra thành dữ liệu (luật catalog).
 */

/** Phần dữ liệu tour mà cột phải và khối Details của trang chi tiết đơn đọc. */
export type BookingTourData = Pick<TourDetailVM, 'excluded' | 'meetingPoint' | 'itinerary'>;

export type GetReadyStepBody =
  | { key: 'freeCancellation'; title: string; text: string; open: boolean }
  | { key: 'budget'; title: string; items: string[]; note: string }
  | { key: 'pickup'; title: string; text: string }
  | { key: 'dayOne'; title: string; text: string | null; href: string; linkLabel: string };

/** Một bước đã đánh số "01", "02"… sau khi bỏ bước thiếu dữ liệu. */
export type GetReadyStep = GetReadyStepBody & { number: string };

export interface GetReadyView {
  /** `count: null` khi còn đúng một ngày — khi đó `label` là "Tomorrow" và đứng cỡ lớn. */
  countdown: { count: number | null; label: string };
  departs: string;
  steps: GetReadyStep[];
  footer: string;
}

/** Điểm hẹn của tour, `null` khi tour đã gỡ hay ô để trống. In nguyên văn, không cắt sửa. */
export function tourMeetingPoint(tour: BookingTourData | null): string | null {
  const point = tour?.meetingPoint ?? null;
  return point !== null && point.trim() !== '' ? point : null;
}

export function getReadySteps(
  booking: BookingDetail,
  tour: BookingTourData | null,
  today: string,
): GetReadyView {
  const t = messages.bookingDetail.getReady;
  const bodies: GetReadyStepBody[] = [];

  // Chỉ in cờ và ngày chót SERVER tính (ADR-0041 §7) — không có cờ thì không có bước này.
  const deadlineText = cancellationDeadlineText(booking.cancellation);
  if (booking.cancellation && deadlineText) {
    bodies.push({
      key: 'freeCancellation',
      title: messages.checkoutSummary.freeCancellation,
      text: deadlineText,
      open: booking.cancellation.withinDeadline,
    });
  }

  // Bỏ mục trống và mục trùng: hai mục cùng chữ là hai ô tích không phân biệt được.
  const excluded = [...new Set((tour?.excluded ?? []).filter((item) => item.trim() !== ''))];
  if (excluded.length > 0) {
    bodies.push({ key: 'budget', title: t.budget, items: excluded, note: t.budgetNote });
  }

  const meetingPoint = tourMeetingPoint(tour);
  if (meetingPoint) {
    bodies.push({
      key: 'pickup',
      title: t.pickupOn(formatWeekdayDate(booking.departureStartDate)),
      text: meetingPoint,
    });
  }

  // Tìm theo `dayNumber`, không lấy phần tử đầu: thứ tự mảng không phải thứ tự ngày.
  const dayOne = tour?.itinerary.find((day) => day.dayNumber === 1);
  if (dayOne) {
    bodies.push({
      key: 'dayOne',
      title: `${messages.tourDetail.itinerary.dayLabel(1)} · ${dayOne.title}`,
      text: dayOne.description && dayOne.description.trim() !== '' ? dayOne.description : null,
      href: `/tours/${booking.tourSlug}#itinerary`,
      linkLabel: t.fullItinerary,
    });
  }

  const { daysToGo } = tripDayNumbers(booking, today);
  const departs = messages.booking.success.departsOn(
    formatWeekdayDate(booking.departureStartDate, { year: true }),
  );
  const place = booking.tourDestinations[0]?.name;

  return {
    countdown:
      daysToGo === 1 ? { count: null, label: t.tomorrow } : { count: daysToGo, label: t.daysToGo },
    departs: place ? `${departs} · ${place}` : departs,
    steps: bodies.map((body, index) => ({ ...body, number: String(index + 1).padStart(2, '0') })),
    footer: t.reviewOpens(formatWeekdayDate(booking.departureEndDate)),
  };
}

/** Khoá `localStorage` của ô tích "Budget for…" — theo mã đơn, chỉ trên máy này (spec §2.4). */
export function prepStorageKey(code: string): string {
  return `prep:${code}`;
}

/**
 * Các mục đã tích còn có trong danh sách HIỆN TẠI, theo thứ tự danh sách. Bản lưu hỏng hay
 * sai hình (sửa tay, bản cũ) thì coi như chưa tích gì — không bao giờ ném ra ngoài.
 */
export function readPrepChecked(raw: string | null, items: readonly string[]): string[] {
  if (raw === null) return [];
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(stored)) return [];
  return items.filter((item) => stored.includes(item));
}
