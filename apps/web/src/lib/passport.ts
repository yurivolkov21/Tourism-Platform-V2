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
      // Tròn/vuông đan xen theo hash — bộ tem user đã duyệt từ vòng đầu;
      // vòng tu sửa 11/08 từng thử chữ nhật Schengen đồng loạt và bị bác
      // (mắt user chấm bộ cũ duyên hơn, chỉ giữ lại chất mực `.stamp-ink`).
      shape: h % 2 === 0 ? 'round' : 'square',
      // (h % 15) − 7 → nguyên trong [−7, 7].
      rotationDeg: (Math.floor(h / 2) % 15) - 7,
    };
  });
  // Tem ghost "chờ chuyến kế" LUÔN đứng cuối — lời mời, không phải dữ liệu.
  stamps.push({ label: '?', month: '', shape: 'round', rotationDeg: 3, ghost: true });
  return stamps;
}

const MRZ_LENGTH = 44;
/** Mã "nước phát hành" 3 ký tự của hộ chiếu du lịch — Traveler. */
const MRZ_ISSUER = 'TRV';

/**
 * Check digit MRZ theo đúng ICAO Doc 9303: giá trị 0-9 giữ nguyên, A=10..Z=35,
 * filler '<' = 0; nhân trọng số lặp 7-3-1 rồi lấy mod 10. Có thật để dòng MRZ
 * "đọc được bằng máy" đúng nghĩa — MRZ sai ngữ pháp là thứ lộ "giả" nhanh nhất
 * với mắt đã quen giấy tờ thật (nghiên cứu 11/08).
 */
export function mrzCheckDigit(field: string): number {
  const WEIGHTS = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const c = field.charCodeAt(i);
    // '0'-'9' → 0-9; 'A'-'Z' → 10-35; mọi thứ khác (thực tế chỉ '<') → 0.
    const value = c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 90 ? c - 55 : 0;
    sum += value * (WEIGHTS[i % 3] ?? 0);
  }
  return sum % 10;
}

/** Số hộ chiếu trang trí — TV + 6 chữ số deterministic từ userId. */
export function passportNo(userId: string): string {
  return `TV${String(hash(userId) % 1_000_000).padStart(6, '0')}`;
}

/** Tên → trường name MRZ: fold dấu, UPPERCASE, họ đứng cuối tên hiển thị kiểu
 *  Á đông ("Bosco Wong" → 'WONG<<BOSCO'), mọi ký tự ngoài A-Z thành '<'
 *  (email/số/gạch nối đều bị máy đọc thật loại y như vậy). */
function mrzNameField(name: string): string {
  const parts = foldAccents(name)
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.replace(/[^A-Z]/g, '<'));
  const last = parts.pop() ?? '';
  return [last, parts.join('<')].filter(Boolean).join('<<');
}

/**
 * Cặp dòng MRZ chuẩn TD3 (gói tu sửa 11/08) — 2 dòng × đúng 44 ký tự, filler
 * '<' lấp kín, check digit 7-3-1 thật ở đúng vị trí quy định. CHỈ mang dữ
 * liệu trang trí đã công khai trên trang (tên hiển thị, số hộ chiếu sinh từ
 * hash userId, năm gia nhập) — KHÔNG ngày sinh/giới tính thật: hai ô đó điền
 * năm gia nhập (01/01) và '<' (unspecified — hợp lệ theo chuẩn).
 *
 * Dòng 1: `P<` + TRV + tên (39 ký tự).
 * Dòng 2: số hộ chiếu(9) +cd+ TRV + ngày cấp YYMMDD +cd+ '<' + hết hạn
 * (+10 năm) +cd+ optional(14) +cd+ composite cd — cộng đúng 44.
 */
export function mrzLines(name: string, userId: string, sinceYear: number): [string, string] {
  // Trường tên chiếm phần còn lại của 44 ký tự sau tiền tố `P<` + mã 3 ký tự.
  const nameRoom = MRZ_LENGTH - 5;
  const nameField = mrzNameField(name).padEnd(nameRoom, '<').slice(0, nameRoom);
  const line1 = `P<${MRZ_ISSUER}${nameField}`;

  const doc = passportNo(userId).padEnd(9, '<');
  const issue = `${String(sinceYear).slice(2)}0101`;
  const expiry = `${String(sinceYear + 10).slice(2)}0101`;
  const optional = '<'.repeat(14);
  // Composite tính trên docNo+cd, issue+cd, expiry+cd, optional+cd — đúng
  // dải vị trí TD3 (1-10, 14-20, 22-43) của Doc 9303.
  const head = `${doc}${mrzCheckDigit(doc)}${MRZ_ISSUER}${issue}${mrzCheckDigit(issue)}<${expiry}${mrzCheckDigit(expiry)}${optional}${mrzCheckDigit(optional)}`;
  const composite = mrzCheckDigit(head.slice(0, 10) + head.slice(13, 20) + head.slice(21, 43));
  return [line1, `${head}${composite}`];
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
