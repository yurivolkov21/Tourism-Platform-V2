import { STATS_WINDOW_DAYS, type StatsPeriod } from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';
import { startOfDayUtc } from '../../lib/calendar-date.js';

/**
 * Phần THUẦN của stats (spec P4b §3-F5): cắt cửa sổ hai kỳ và biến kết quả
 * aggregate của Prisma thành đúng chuỗi contract. Đứng ngoài service để test
 * được từng nhánh mà không cần DB — aggregate thật ở `stats.int.spec.ts`.
 */

const DAY_MS = 86_400_000;

/** Ba mốc cắt + thời điểm chốt sổ, đơn vị `Date` để đưa thẳng vào Prisma. */
export interface StatsWindow {
  /** Đầu kỳ NÀY — TÍNH VÀO. Kỳ này là `[currentFrom, currentTo)`. */
  currentFrom: Date;
  /**
   * Cuối kỳ NÀY — KHÔNG tính vào. Với cửa sổ TRƯỢT nó đúng bằng `generatedAt`;
   * với kỳ do admin chọn (`statsWindowFromRange`) nó là mốc chặn của khoảng
   * ngày, có thể nằm sâu trong quá khứ hoặc ở tương lai gần. Query phải dùng
   * mốc này chứ KHÔNG dùng `generatedAt` — nhầm hai cái là kỳ tháng 7 âm thầm
   * kéo dài tới hôm nay.
   */
  currentTo: Date;
  /** Đầu kỳ TRƯỚC. Kỳ trước là `[previousFrom, currentFrom)`, dài bằng kỳ này. */
  previousFrom: Date;
  /** Thời điểm chốt sổ — mọi query của MỘT response dùng chung một mốc. */
  generatedAt: Date;
  /**
   * Kỳ do ADMIN chọn (có ít nhất một ô ngày) hay cửa sổ TRƯỢT mặc định.
   * Cờ TƯỜNG MINH từ ADR-0028 AMEND 3: client từng suy nó từ
   * `currentTo !== generatedAt`, mà nhánh chỉ-`from` (và nay cả kỳ bị cắt ở
   * `now`) cho hai mốc trùng nhau — dấu hiệu ấy nói sai.
   */
  picked: boolean;
}

/**
 * Cắt hai cửa sổ 28 ngày KHÍT NHAU và DÀI BẰNG NHAU, neo vào thời điểm gọi.
 *
 * Vì sao neo vào `now` chứ không căn nửa đêm UTC: căn nửa đêm thì kỳ này là
 * "27 ngày trọn + phần đã trôi của hôm nay" trong khi kỳ trước là 28 ngày
 * trọn — mọi metric sẽ trông như đang tụt, mỗi sáng lại tụt sâu nhất. Hai cửa
 * sổ bằng nhau là điều kiện để pill delta nói thật.
 *
 * Múi giờ: phép tính chạy trên epoch millisecond nên không có múi giờ nào
 * tham gia; mọi mốc phơi ra ngoài đều là ISO UTC. Cột thời gian trong Postgres
 * là `timestamp` (không tz) và mọi đường ghi đều ghi UTC (`now()` với session
 * TimeZone=UTC ở cả docker lẫn Supabase, hoặc `Date` của JS qua Prisma) — nên
 * so sánh ở đây là so sánh cùng một thước.
 */
export function statsWindow(now: Date): StatsWindow {
  const end = now.getTime();
  const span = STATS_WINDOW_DAYS * DAY_MS;
  return {
    // `new Date(now)` chứ không dùng lại tham chiếu: caller giữ Date của họ,
    // hàm này không được phép sửa nó.
    generatedAt: new Date(end),
    // Cửa sổ TRƯỢT kết đúng lúc chốt sổ — hai mốc trùng nhau, và chính sự
    // trùng ấy là dấu hiệu client đọc để biết kỳ này đang trôi (ADR-0028 §4).
    currentTo: new Date(end),
    currentFrom: new Date(end - span),
    previousFrom: new Date(end - 2 * span),
    picked: false,
  };
}

/**
 * Cắt cửa sổ theo KHOẢNG NGÀY admin đang lọc ở bảng `/bookings` (ADR-0028).
 *
 * Luật duy nhất, áp cho cả bốn nhánh: **kỳ trước dài đúng bằng kỳ này và lùi
 * liền kề**. Đó là bất biến khiến pill delta nói thật (`schemas/stats.ts`
 * luật #1) — và nó giữ được với MỌI khoảng admin kéo ra, kể cả khoảng lẻ.
 * Kỳ trước KHÔNG phải "tháng lịch liền trước": lọc 05/09–12/09 mà so với 31
 * ngày của tháng 8 là một pill `↓74%` bịa từ hư không.
 *
 * | Đầu vào | Kỳ này | Kỳ trước |
 * | --- | --- | --- |
 * | `from` + `to` | `[from 00:00, to+1d 00:00)` | dài bằng, lùi liền kề |
 * | chỉ `from` | `[from 00:00, now)` | dài bằng, lùi liền kề |
 * | chỉ `to` | `STATS_WINDOW_DAYS` ngày kết ở `to+1d` | dài bằng, lùi liền kề |
 * | không có gì | y hệt `statsWindow` — cửa sổ TRƯỢT 28 ngày | |
 *
 * Biên NỬA-MỞ, cùng công thức `createdAtRange` mà bảng dùng, nên card và bảng
 * cắt CÙNG MỘT NHÁT: `to` tính TRỌN NGÀY nên mốc chặn là 00:00 hôm sau với
 * dấu `lt`. KHÔNG bao giờ `23:59:59` — cột thời gian là `timestamp`
 * microsecond, `lte 23:59:59` bỏ rơi gần trọn một giây cuối ngày (ADR-0028
 * §3 có bảng đối chiếu).
 *
 * Ca "chỉ `to`" không có đầu nào để đo độ dài, nên lấy đúng
 * `STATS_WINDOW_DAYS` kết ở `to` — một mặc định khai báo được, thay vì một
 * cửa sổ mở vô hạn về quá khứ. Hai ca một-đầu tồn tại thật:
 * `parseBookingsSearchParams` giữ `from` và bỏ `to` khi khoảng ngược, và
 * admin gõ được một ô.
 *
 * Múi giờ: mốc UTC như mọi cửa sổ khác của module — xem `statsWindow`.
 */
export function statsWindowFromRange(
  from: string | undefined,
  to: string | undefined,
  now: Date,
): StatsWindow {
  if (!from && !to) return statsWindow(now);

  // Trọn ngày `to`: chặn ở 00:00 ngày kế tiếp. Không có `to` thì kỳ chạy tới
  // đúng lúc chốt sổ.
  //
  // CẮT Ở `now` (ADR-0028 AMEND 3): `/bookings` độn trọn tháng hiện tại, nên
  // đọc ngày 05/09 thì `to = 30/09` là một mốc ở TƯƠNG LAI. Để nguyên là kỳ
  // này mới trôi 5 ngày bị đem so với kỳ trước ĐÃ HOÀN TẤT 30 ngày — pill in
  // "↓ ~83%" trên màn hình mặc định gần trọn tháng, đúng cú sụt bịa mà §2 viện
  // ra để bác phương án "tháng lịch liền trước". Kỳ này chỉ dài tới đâu đã
  // trôi tới đó, và kỳ trước dài đúng bằng phần ấy — cùng luật với `statsWindow`
  // ("hai cửa sổ bằng nhau là điều kiện để pill delta nói thật").
  const requestedTo = to ? startOfDayUtc(to).getTime() + DAY_MS : now.getTime();
  const currentToMs = Math.min(requestedTo, now.getTime());
  const requestedFrom = from
    ? startOfDayUtc(from).getTime()
    : currentToMs - STATS_WINDOW_DAYS * DAY_MS;
  // `from` ở tương lai (URL gõ tay, contract chỉ chặn `from > to`): kỳ RỖNG
  // chứ không phải kỳ ÂM — span âm làm previousFrom nhảy ra sau currentFrom và
  // mọi mốc tự mâu thuẫn mà không mã lỗi nào nói ra.
  const currentFromMs = Math.min(requestedFrom, currentToMs);
  const span = currentToMs - currentFromMs;

  return {
    // `new Date(now)` chứ không dùng lại tham chiếu — cùng lý do ở `statsWindow`.
    generatedAt: new Date(now.getTime()),
    currentTo: new Date(currentToMs),
    currentFrom: new Date(currentFromMs),
    previousFrom: new Date(currentFromMs - span),
    picked: true,
  };
}

/** Cửa sổ → khối `period` của contract (ISO UTC, kèm độ dài cửa sổ). */
export function statsPeriod(window: StatsWindow): StatsPeriod {
  return {
    windowDays: windowDays(window),
    currentFrom: window.currentFrom.toISOString(),
    currentTo: window.currentTo.toISOString(),
    previousFrom: window.previousFrom.toISOString(),
    generatedAt: window.generatedAt.toISOString(),
    picked: window.picked,
  };
}

/**
 * Độ dài kỳ này theo NGÀY, làm tròn, tối thiểu 1.
 *
 * Đo từ chính cửa sổ chứ không trả hằng `STATS_WINDOW_DAYS`: kỳ do admin chọn
 * dài bao nhiêu là do hai ô ngày quyết (ADR-0028). Cửa sổ trượt mặc định vẫn
 * ra đúng 28 vì span của nó đúng bằng hằng số ấy.
 *
 * Sàn 1 là bắt buộc chứ không phải cẩn tắc: contract khai `z.int().positive()`,
 * mà lọc `?from=` bằng ngày HÔM NAY cho một span vài giờ → làm tròn thành 0 →
 * response tự nó không parse nổi. Kỳ ngắn hơn một ngày vẫn là "một ngày" khi
 * đếm bằng đơn vị ngày.
 */
function windowDays(window: StatsWindow): number {
  const span = window.currentTo.getTime() - window.currentFrom.getTime();
  return Math.max(1, Math.round(span / DAY_MS));
}

/**
 * `_sum` tiền của Prisma → chuỗi thập phân contract. `null` (kỳ không có row
 * nào) thành '0.00' chứ không null: "không thu được đồng nào" là một câu trả
 * lời thật, khác hẳn "không tính được".
 *
 * Tên KHÔNG phải `money` (đổi ở vòng vá review F5): `payments/money.ts` đã
 * có `toAmountValue(amount, currency)` — bản CHUẨN biết currency zero-decimal
 * (JPY/VND). Hàm này cứng 2 số lẻ, đủ cho nền tảng một-đồng-USD hiện tại;
 * ngày có đồng thứ hai thì chuyển sang bản payments, đừng vá thêm ở đây.
 */
export function grossAmount(value: Prisma.Decimal | null): string {
  return value ? value.toFixed(2) : '0.00';
}

/**
 * Tỉ lệ dạng PHẦN TRĂM 0..100, một chữ số thập phân ('8.3').
 *
 * Mẫu số 0 → `null`, KHÔNG phải '0.0': không có booking nào để mà huỷ thì tỉ
 * lệ huỷ không tồn tại, và vẽ "0%" cạnh một pill delta sẽ bịa ra một cú cải
 * thiện không có thật.
 */
export function ratePercent(part: number, whole: number): string | null {
  if (whole <= 0) return null;
  return ((part / whole) * 100).toFixed(1);
}

/**
 * `_avg` của Prisma (Int → `number`) → chuỗi hai chữ số thập phân. `null` (kỳ
 * không có row nào) đi thẳng ra `null` — điểm trung bình của tập rỗng không
 * phải 0 sao.
 */
export function average(value: number | null): string | null {
  return value === null ? null : value.toFixed(2);
}

/**
 * Cửa sổ của MỘT tháng lịch (spec P4b §3-F6) — `[00:00 ngày 1, 00:00 ngày 1
 * tháng sau)`, mốc UTC, biên nửa-mở như mọi khoảng khác của module này.
 *
 * KHÔNG neo vào "bây giờ" (khác `statsWindow`): tháng 7 là tháng 7 dù đọc lúc
 * nào, nên cùng một `?month=` phải cho cùng một khoảng mãi mãi — đó là điều
 * kiện để hai bản in cùng tháng ở hai ngày khác nhau đọc ra cùng con số.
 *
 * Độ dài tháng do chính lịch quyết (28/29/30/31): `Date.UTC` với tháng +1 tự
 * cuộn sang năm sau, nên tháng 12 không cần ca riêng.
 */
export interface MonthWindow {
  /** 00:00 ngày đầu tháng — TÍNH VÀO. */
  from: Date;
  /** 00:00 ngày đầu tháng sau — KHÔNG tính vào. */
  to: Date;
}

/** `YYYY-MM` (đã qua `ReportMonthSchema`) → cửa sổ tháng. */
export function monthWindow(month: string): MonthWindow {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return {
    from: new Date(Date.UTC(year, monthNumber - 1, 1)),
    // Tháng 13 tự cuộn thành tháng 1 năm sau — đúng theo spec Date.UTC.
    to: new Date(Date.UTC(year, monthNumber, 1)),
  };
}
