import type { Booking } from '@tourism/contract';
import { todayDateString } from '@/lib/account-stats';
import { bookingView } from '@/lib/booking-vm';
import { foldAccents } from '@/lib/text';

/**
 * Hàm thuần cho khu account "Hộ chiếu" (spec 2026-08-11 §3.2) — mọi thứ
 * deterministic, KHÔNG Math.random/Date.now: "ngẫu nhiên thủ công" của tem
 * (xoay lệch, tròn/vuông) sinh từ hash mã booking để test được và không nhảy
 * lung tung giữa hai lần render.
 */

const MS_PER_DAY = 86_400_000;

/** Hash chuỗi → số nguyên không âm, deterministic (FNV-1a rút gọn). */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * "Chuyến đã hoàn thành" = ngày kết thúc đã qua VÀ (ĐÃ TRẢ TIỀN — tone
 * success của bookingView, tức PAID — HOẶC hoàn MỘT PHẦN). Fix 11/08
 * (controller chốt): `PARTIALLY_REFUNDED` tính là đã đi — đi thật rồi mới
 * hoàn một phần, có tem. `REFUNDED` toàn phần vẫn loại: tiền đã hoàn hết thì
 * không đóng tem.
 *
 * So NGÀY bằng SO CHUỖI `YYYY-MM-DD` (như `account-stats.ts`), KHÔNG parse
 * `Date`: so trực tiếp hai `Date` object trộn giờ-trong-ngày thật của
 * `today` với midnight-UTC của `departureEndDate` — một chuyến kết thúc
 * ĐÚNG HÔM NAY bị tính nhầm "đã xong" ngay khi đồng hồ qua khỏi nửa đêm.
 * So chuỗi thì biên đóng đúng: kết thúc hôm nay vẫn "đang đi".
 */
function isCompleted(b: Booking, today: string): boolean {
  const ended = b.departureEndDate < today;
  return ended && (bookingView(b).tone === 'success' || b.status === 'PARTIALLY_REFUNDED');
}

/**
 * Slug đích đến cho bản đồ chấm: `visited` = chuyến hoàn thành; `upcoming` =
 * chuyến còn phía trước ĐÃ hoặc SẮP trả tiền (tone success/warning chưa kết
 * thúc). Trả mảng distinct — `mapDots` tự xử phần visited-thắng-upcoming.
 *
 * `today` mặc định `todayDateString()` — cùng một luật "đã xong" với
 * `isCompleted`/`account-stats.ts` (so chuỗi ngày UTC).
 */
export function journeySlugs(
  bookings: Booking[],
  today: string = todayDateString(),
): { visited: string[]; upcoming: string[] } {
  const visited = new Set<string>();
  const upcoming = new Set<string>();
  for (const b of bookings) {
    const tone = bookingView(b).tone;
    const ended = b.departureEndDate < today;
    if (tone === 'success' && ended) {
      for (const d of b.tourDestinations) visited.add(d.slug);
    } else if ((tone === 'success' || tone === 'warning') && !ended) {
      for (const d of b.tourDestinations) upcoming.add(d.slug);
    }
  }
  return { visited: [...visited], upcoming: [...upcoming] };
}

export interface PassportStats {
  trips: number;
  places: number;
  /** % catalog đã đặt chân — 0 khi chưa có chuyến; có chuyến thì sàn 1. */
  exploredPct: number;
  daysOnRoad: number;
}

export function passportStats(
  bookings: Booking[],
  catalogTotal: number,
  today: string = todayDateString(),
): PassportStats {
  const done = bookings.filter((b) => isCompleted(b, today));
  const placeSlugs = new Set(done.flatMap((b) => b.tourDestinations.map((d) => d.slug)));
  const places = placeSlugs.size;
  const exploredPct =
    places === 0 || catalogTotal === 0 ? 0 : Math.max(1, Math.floor((places / catalogTotal) * 100));
  const daysOnRoad = done.reduce(
    (sum, b) =>
      sum +
      Math.round(
        (new Date(b.departureEndDate).getTime() - new Date(b.departureStartDate).getTime()) /
          MS_PER_DAY,
      ) +
      1,
    0,
  );
  return { trips: done.length, places, exploredPct, daysOnRoad };
}

export interface PassportStamp {
  /** Nhãn in trên tem — destination primary, UPPERCASE. */
  label: string;
  /** 'Jul 2026' — tháng kết thúc chuyến. */
  month: string;
  shape: 'round' | 'square';
  /** −7..7 độ — "đóng tay hơi lệch", deterministic từ mã booking. */
  rotationDeg: number;
  ghost?: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Nhãn tem: destination primary → destination đầu → 2 từ đầu tourTitle. */
function stampLabel(b: Booking): string {
  const primary = b.tourDestinations.find((d) => d.isPrimary) ?? b.tourDestinations[0];
  if (primary) return primary.name.toUpperCase();
  return b.tourTitle.split(/\s+/).slice(0, 2).join(' ').toUpperCase();
}

export function passportStamps(
  bookings: Booking[],
  today: string = todayDateString(),
): PassportStamp[] {
  const done = bookings
    .filter((b) => isCompleted(b, today))
    .sort((a, b) => a.departureEndDate.localeCompare(b.departureEndDate));
  const stamps: PassportStamp[] = done.map((b) => {
    const h = hash(b.code);
    const end = new Date(b.departureEndDate);
    return {
      label: stampLabel(b),
      month: `${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`,
      shape: h % 2 === 0 ? 'round' : 'square',
      // (h % 15) − 7 → nguyên trong [−7, 7].
      rotationDeg: (Math.floor(h / 2) % 15) - 7,
    };
  });
  // Tem ghost "chờ chuyến kế" LUÔN đứng cuối — lời mời, không phải dữ liệu.
  stamps.push({ label: '?', month: '', shape: 'round', rotationDeg: 3, ghost: true });
  return stamps;
}

/** Số hội viên trang trí — 6 chữ số deterministic từ userId, nhóm 3. */
export function memberNumber(userId: string): string {
  const n = hash(userId) % 1_000_000;
  const s = String(n).padStart(6, '0');
  return `NO. ${s.slice(0, 3)} ${s.slice(3)}`;
}

const MRZ_LENGTH = 44;

/**
 * Dòng MRZ trang trí typography (đúng 44 ký tự như hộ chiếu thật) — CHỈ mang
 * tên hiển thị + số hội viên + năm, không dữ liệu nhạy cảm. Dấu tiếng Việt
 * fold về ASCII (máy đọc MRZ thật cũng vậy), khoảng trắng thành '<'.
 */
export function mrzLine(name: string, memberNo: string, sinceYear: number): string {
  const parts = foldAccents(name).toUpperCase().split(/\s+/).filter(Boolean);
  // Họ đứng cuối theo tên kiểu Á đông hiển thị "Bosco Wong" → 'WONG<<BOSCO'.
  const last = parts.pop() ?? '';
  const mrzName = [last, parts.join('<')].filter(Boolean).join('<<');
  const digits = memberNo.replace(/\D/g, '');
  const raw = `P<TOURISM<<${mrzName}`;
  const tail = `${digits}<<${sinceYear}<<<`;
  const room = MRZ_LENGTH - tail.length;
  const head = raw.length > room ? raw.slice(0, room) : raw.padEnd(room, '<');
  return `${head}${tail}`;
}

export interface MapDot {
  /** Khoá render ổn định (fix 11/08) — `name` KHÔNG đảm bảo unique giữa các
   *  destination, `slug` thì có (đúng nguồn `journeySlugs`). */
  slug: string;
  region: 'north' | 'central' | 'south' | 'other';
  visited: boolean;
  upcoming: boolean;
  name: string;
}

/** Giá trị `Destination.region` thật của catalog → cụm miền của bản đồ chấm. */
const REGION_CLUSTER: Record<string, MapDot['region']> = {
  'Northern Vietnam': 'north',
  'Central Vietnam': 'central',
  'Southern Vietnam': 'south',
};

const CLUSTER_ORDER: Record<MapDot['region'], number> = {
  north: 0,
  central: 1,
  south: 2,
  other: 3,
};

/**
 * Bản đồ CHẤM cách điệu — mỗi destination catalog một chấm, gom cụm theo miền
 * (bắc trên cùng như bản đồ thật), KHÔNG phải toạ độ địa lý. `visited` thắng
 * `upcoming` khi một nơi có cả hai (đã đến rồi thì thôi mờ).
 */
export function mapDots(
  catalog: Array<{ slug: string; name: string; region: string | null }>,
  visitedSlugs: string[],
  upcomingSlugs: string[],
): MapDot[] {
  const visited = new Set(visitedSlugs);
  const upcoming = new Set(upcomingSlugs);
  return catalog
    .map((d) => {
      const isVisited = visited.has(d.slug);
      return {
        slug: d.slug,
        region: (d.region && REGION_CLUSTER[d.region]) || 'other',
        visited: isVisited,
        upcoming: !isVisited && upcoming.has(d.slug),
        name: d.name,
      } satisfies MapDot;
    })
    .sort((a, b) => CLUSTER_ORDER[a.region] - CLUSTER_ORDER[b.region]);
}
