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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface PageStamp {
  /** Khoá render — mã booking (mỗi CHUYẾN một tem, unique). */
  key: string;
  /** Tên destination primary UPPERCASE (fallback 2 từ đầu tourTitle). */
  label: string;
  /** 'Jul 2026' — tháng kết thúc chuyến; ghost thì là tháng khởi hành. */
  month: string;
  shape: 'round' | 'square' | 'oval';
  /** −9..9 độ — mộc đóng tay. */
  rotationDeg: number;
  /** Ba cỡ tem — sổ thật không có hai con dấu bằng nhau tăm tắp. */
  size: 'sm' | 'md' | 'lg';
  /** Chỉ số mực 0..2 — component map sang lớp màu (quầy biên phòng thật
   *  chỉ dăm ba màu mực). */
  ink: 0 | 1 | 2;
  /** Nấc xô dọc 0..3 — tem trôi khỏi hàng thẳng. */
  driftY: number;
  /** Lấn mép tem đứng trước (âm margin) — trang tem chen chúc. */
  overlap: boolean;
  /** Chuyến còn phía trước — dấu viền đứt "chờ đóng". */
  ghost?: boolean;
}

/** Nhãn tem: destination primary → destination đầu → 2 từ đầu tourTitle. */
function stampLabel(b: Booking): string {
  const primary = b.tourDestinations.find((d) => d.isPrimary) ?? b.tourDestinations[0];
  if (primary) return primary.name.toUpperCase();
  return b.tourTitle.split(/\s+/).slice(0, 2).join(' ').toUpperCase();
}

/** Dáng tem deterministic từ mã booking — mỗi CHUYẾN một con dấu riêng. */
function stampLook(
  code: string,
): Pick<PageStamp, 'shape' | 'rotationDeg' | 'size' | 'ink' | 'driftY' | 'overlap'> {
  const h = hash(code);
  const SHAPES = ['round', 'square', 'oval'] as const;
  const SIZES = ['sm', 'md', 'lg'] as const;
  return {
    shape: SHAPES[h % 3] ?? 'round',
    // (…% 19) − 9 → nguyên trong [−9, 9].
    rotationDeg: (Math.floor(h / 3) % 19) - 9,
    size: SIZES[Math.floor(h / 57) % 3] ?? 'md',
    ink: (Math.floor(h / 171) % 3) as 0 | 1 | 2,
    driftY: Math.floor(h / 513) % 4,
    overlap: Math.floor(h / 2052) % 2 === 1,
  };
}

/**
 * TRANG VISA MỞ (vòng 11/08 tối — thay lưới `stampSlots` bị user chê "chia ô
 * xếp hàng tầm thường"): tem đóng theo TỪNG CHUYẾN như cửa khẩu thật — đi
 * lại một nơi là THÊM con dấu mới chồng lên trang, không "làm mới" dấu cũ.
 * Chuyến đã đi (một luật `isCompleted` với stats) sort theo endDate — trang
 * tem dày lên theo trình tự thời gian; chuyến còn phía trước (ĐÃ/SẮP trả
 * tiền) thành dấu ghost viền đứt đứng cuối. Deterministic toàn phần.
 */
export function pageStamps(bookings: Booking[], today: string = todayDateString()): PageStamp[] {
  const monthOf = (iso: string) => {
    const d = new Date(iso);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const done = bookings
    .filter((b) => isCompleted(b, today))
    .sort((a, b) => a.departureEndDate.localeCompare(b.departureEndDate))
    .map((b) => ({
      key: b.code,
      label: stampLabel(b),
      month: monthOf(b.departureEndDate),
      ...stampLook(b.code),
    }));
  const ahead = bookings
    .filter((b) => {
      const tone = bookingView(b).tone;
      return (tone === 'success' || tone === 'warning') && !(b.departureEndDate < today);
    })
    .sort((a, b) => a.departureStartDate.localeCompare(b.departureStartDate))
    .map((b) => ({
      key: b.code,
      label: stampLabel(b),
      month: monthOf(b.departureStartDate),
      ...stampLook(b.code),
      ghost: true,
    }));
  return [...done, ...ahead];
}

/**
 * Tên các destination CHƯA TỪNG đi (chuyến sắp tới chưa tính — tem chưa
 * đóng) — dòng chữ mờ "still blank" dưới trang tem, thứ tự miền như bản đồ.
 */
export function unstampedNames(
  catalog: Array<{ slug: string; name: string; region: string | null }>,
  bookings: Booking[],
  today: string = todayDateString(),
): string[] {
  const stamped = new Set<string>();
  for (const b of bookings) {
    if (isCompleted(b, today)) for (const d of b.tourDestinations) stamped.add(d.slug);
  }
  const cluster = (region: string | null) => (region && REGION_CLUSTER[region]) || 'other';
  return [...catalog]
    .sort((a, b) => CLUSTER_ORDER[cluster(a.region)] - CLUSTER_ORDER[cluster(b.region)])
    .filter((d) => !stamped.has(d.slug))
    .map((d) => d.name);
}

export interface TravelLogTrip {
  code: string;
  tourTitle: string;
  /** Tên destination primary (fallback 2 từ đầu tourTitle) — phụ đề card. */
  destName: string;
  month: string;
  /** Độ dài chuyến tính cả hai đầu — cùng công thức daysOnRoad. */
  days: number;
}

export interface TravelLogEntry {
  slug: string;
  name: string;
  /** Số LẦN đã ghé nơi này (đếm theo chuyến — đi lại là cộng thêm). */
  visits: number;
  /** 'Jul 2026' — tháng của lần ghé gần nhất; undefined khi chưa đi lần nào
   *  (entry chỉ có chuyến sắp tới). */
  lastMonth?: string;
  /** Các chuyến đã ghé nơi này, CŨ → MỚI (lần 1 → lần n) — mỗi lần một
   *  node timeline. */
  trips: TravelLogTrip[];
  /** Chuyến ĐÃ/SẮP trả tiền còn phía trước chạm nơi này (sort theo ngày
   *  khởi hành; month = tháng khởi hành) — node "Pending" cuối timeline. */
  upcoming: TravelLogTrip[];
}

/** Booking → một mục chuyến của sổ hành trình; `monthFrom` chọn mốc tháng
 *  (chuyến đã đi lấy tháng KẾT THÚC, chuyến sắp tới lấy tháng KHỞI HÀNH). */
function tripOf(b: Booking, monthFrom: 'end' | 'start'): TravelLogTrip {
  const anchor = new Date(monthFrom === 'end' ? b.departureEndDate : b.departureStartDate);
  const primary = b.tourDestinations.find((d) => d.isPrimary) ?? b.tourDestinations[0];
  return {
    code: b.code,
    tourTitle: b.tourTitle,
    destName: primary?.name ?? b.tourTitle.split(/\s+/).slice(0, 2).join(' '),
    month: `${MONTHS[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`,
    days:
      Math.round(
        (new Date(b.departureEndDate).getTime() - new Date(b.departureStartDate).getTime()) /
          MS_PER_DAY,
      ) + 1,
  };
}

/**
 * SỔ HÀNH TRÌNH (vòng ReUI 11/08 + stepper): các địa danh ĐÃ ĐI — chỉ nơi
 * có tem, sort cụm miền như bản đồ; chuyến chạm nhiều nơi tính cho CẢ các
 * nơi đó, mỗi entry mang danh sách chuyến CŨ → MỚI của nơi mình. Ảnh cover
 * do page tự ghép từ catalog (giữ hàm thuần khỏi type Media). Một luật
 * đã-đi `isCompleted` với stats.
 */
export function travelLog(
  catalog: Array<{ slug: string; name: string; region: string | null }>,
  bookings: Booking[],
  today: string = todayDateString(),
): TravelLogEntry[] {
  const tripsBySlug = new Map<string, TravelLogTrip[]>();
  const upcomingBySlug = new Map<string, TravelLogTrip[]>();
  const push = (map: Map<string, TravelLogTrip[]>, slug: string, trip: TravelLogTrip) => {
    const list = map.get(slug) ?? [];
    list.push(trip);
    map.set(slug, list);
  };
  const done = bookings
    .filter((b) => isCompleted(b, today))
    .sort((a, b) => a.departureEndDate.localeCompare(b.departureEndDate));
  for (const b of done) {
    const trip = tripOf(b, 'end');
    for (const d of b.tourDestinations) push(tripsBySlug, d.slug, trip);
  }
  // Chuyến còn phía trước ĐÃ/SẮP trả tiền — một luật với dấu ghost trang tem.
  const ahead = bookings
    .filter((b) => {
      const tone = bookingView(b).tone;
      return (tone === 'success' || tone === 'warning') && !(b.departureEndDate < today);
    })
    .sort((a, b) => a.departureStartDate.localeCompare(b.departureStartDate));
  for (const b of ahead) {
    const trip = tripOf(b, 'start');
    for (const d of b.tourDestinations) push(upcomingBySlug, d.slug, trip);
  }
  const cluster = (region: string | null) => (region && REGION_CLUSTER[region]) || 'other';
  return [...catalog]
    .sort((a, b) => CLUSTER_ORDER[cluster(a.region)] - CLUSTER_ORDER[cluster(b.region)])
    .flatMap((d) => {
      const trips = tripsBySlug.get(d.slug) ?? [];
      const upcoming = upcomingBySlug.get(d.slug) ?? [];
      if (trips.length === 0 && upcoming.length === 0) return [];
      return [
        {
          slug: d.slug,
          name: d.name,
          visits: trips.length,
          lastMonth: trips.at(-1)?.month,
          trips,
          upcoming,
        },
      ];
    });
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

type RegionCluster = 'north' | 'central' | 'south' | 'other';

/** Giá trị `Destination.region` thật của catalog → cụm miền (sort lưới tem). */
const REGION_CLUSTER: Record<string, RegionCluster> = {
  'Northern Vietnam': 'north',
  'Central Vietnam': 'central',
  'Southern Vietnam': 'south',
};

const CLUSTER_ORDER: Record<RegionCluster, number> = {
  north: 0,
  central: 1,
  south: 2,
  other: 3,
};
