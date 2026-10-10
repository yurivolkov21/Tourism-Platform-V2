import { VIETNAM_TIME_ZONE } from '@tourism/contract';

/**
 * Logic thuần của cụm P (W7/W8, handoff mục 3 "luật vào màn" + mục 4). Mọi
 * mốc "hôm nay" nhận qua tham số (chuỗi `YYYY-MM-DD` giờ Việt Nam, từ
 * `useServerToday()`) — hàm KHÔNG tự đọc đồng hồ, để test được xác định.
 */

export type TripPhase = 'upcoming' | 'imminent' | 'onTour' | 'ended';

/** Ngưỡng đổi giọng P1→P2 (handoff: "ngưỡng đổi giọng là ≤ 3 ngày"). */
const IMMINENT_THRESHOLD_DAYS = 3;

function dayIndex(date: string): number {
  return Math.round(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000);
}

/** Số ngày lịch giữa hai mốc `YYYY-MM-DD` (`to − from`, có thể âm). */
export function daysBetween(from: string, to: string): number {
  return dayIndex(to) - dayIndex(from);
}

/** `from + n` ngày, dạng `YYYY-MM-DD`. */
export function addDays(from: string, n: number): string {
  return new Date(dayIndex(from) * 86_400_000 + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Bốn nhánh của luật vào màn (handoff mục 3): trước khởi hành (xa/sát ngày),
 * trong khoảng đi–về, hoặc đã về. Chỉ gọi với booking `PAID` — route lọc
 * trạng thái khác (PENDING/CANCELLED/REFUNDED) TRƯỚC khi tới đây.
 */
export function tripPhase(today: string, startDate: string, endDate: string): TripPhase {
  if (today > endDate) return 'ended';
  if (today >= startDate) return 'onTour';
  return daysBetween(today, startDate) <= IMMINENT_THRESHOLD_DAYS ? 'imminent' : 'upcoming';
}

/** Ngày đang đi (P5) = `today − start + 1`, kẹp `[1, durationDays]`. */
export function currentTripDay(today: string, startDate: string, durationDays: number): number {
  const day = daysBetween(startDate, today) + 1;
  return Math.min(Math.max(day, 1), durationDays);
}

/** % thanh tiến trình `createdDate → startDate` (P1 `.meter`), kẹp [0, 100]. */
export function bookingProgressPercent(
  today: string,
  createdDate: string,
  startDate: string,
): number {
  const total = daysBetween(createdDate, startDate);
  if (total <= 0) return 100;
  const elapsed = daysBetween(createdDate, today);
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

/** Ngày lịch của ngày thứ `dayNumber` trong lịch trình (P4/P5). */
export function itineraryCalendarDate(startDate: string, dayNumber: number): string {
  return addDays(startDate, dayNumber - 1);
}

/**
 * "What to bring" (P3) = toàn bộ dòng của policy `kind: GENERAL`, chẻ theo
 * `\n` — cùng khuôn `parseItineraryDescription` (seed viết nhiều ý trong một
 * cột `body`, không phải mảng riêng).
 */
export function whatToBringLines(policyBody: string | undefined): string[] {
  if (policyBody === undefined) return [];
  return policyBody
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Danh sách đồ P2 (checklist rút gọn) = TOÀN BỘ dòng policy GENERAL + hai
 * dòng ĐẦU của `excluded[]` (handoff mục 6: ghép từ hai nguồn có thật, không
 * bịa cột mới). `ponytail: cắt cứng 2 dòng excluded — nếu seed đổi excluded
 * dài/ngắn khác hẳn, soi lại mockup trước khi đổi con số này.`
 */
export function packingChecklistItems(
  policyBody: string | undefined,
  excluded: readonly string[],
): string[] {
  return [...whatToBringLines(policyBody), ...excluded.slice(0, 2)];
}

/** Cắt `included[]` hiện 3 dòng + đếm phần ẩn (P3 "Show all {n}"). */
export function visibleIncluded(
  included: readonly string[],
  cap = 3,
): { visible: string[]; hiddenCount: number } {
  return { visible: included.slice(0, cap), hiddenCount: Math.max(0, included.length - cap) };
}

let vnTimeFormatter: Intl.DateTimeFormat | undefined;

/** Giờ:phút Việt Nam của `now`, dạng `HH:MM` 24h — khuôn riêng `vietnamToday`
 *  (contract) không có, chỉ cần cho P5 (tô đậm việc đang/đã qua trong ngày). */
export function vietnamTimeOfDay(now: Date): string {
  vnTimeFormatter ??= new Intl.DateTimeFormat('en-GB', {
    timeZone: VIETNAM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = vnTimeFormatter.formatToParts(now);
  const part = (type: 'hour' | 'minute') => parts.find((p) => p.type === type)?.value ?? '00';
  return `${part('hour')}:${part('minute')}`;
}

export type StopState = 'done' | 'active' | 'upcoming';

/**
 * Trạng thái mỗi mốc có giờ trong "Today" (P5) — mốc CUỐI CÙNG có giờ ≤ bây
 * giờ là `active` (đang/vừa làm), mốc trước nó `done` (gạch mờ), mốc sau
 * `upcoming` (chữ thường, không gạch không tô). Chưa tới mốc đầu thì không
 * mốc nào `active`.
 */
export function timedStopStates(times: readonly string[], nowTime: string): StopState[] {
  let activeIndex = -1;
  times.forEach((time, index) => {
    if (time <= nowTime) activeIndex = index;
  });
  return times.map((_, index) =>
    index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'upcoming',
  );
}

export type TripLoadState = 'loading' | 'error' | 'ready';

/**
 * Lỗi phải thắng "đang tải": query tour chỉ chạy khi đã có booking nên nếu
 * `byCode` lỗi, query tour tắt và `isPending` mãi mãi — xét pending trước thì
 * màn kẹt ở khung chờ, không bao giờ tới nút thử lại.
 */
export function tripLoadState(q: {
  detailPending: boolean;
  detailError: boolean;
  tourPending: boolean;
  tourError: boolean;
}): TripLoadState {
  if (q.detailError || q.tourError) return 'error';
  if (q.detailPending || q.tourPending) return 'loading';
  return 'ready';
}
