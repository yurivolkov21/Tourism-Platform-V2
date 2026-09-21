import { cancellationDeadline, isWithinDeadline } from '@tourism/contract';

/**
 * Ba luật của một chuyến khởi hành (spec P4e-1 §2b, §2c, F12) — THUẦN, không
 * chạm Prisma, nên mọi biên kiểm được mà không cần DB.
 *
 * ## Quy ước trả về: `null` hoặc một CÂU
 *
 * `null` = cho đi; chuỗi = lý do từ chối, đã thành câu đọc được và mang sẵn
 * con số thật. Không trả `boolean`: cả ba chỗ gọi đều phải kể lý do, nên một
 * cờ trần chỉ dời việc ghép câu sang ba nơi khác nhau.
 *
 * Câu ở đây là message của LỖI API (`errors.<CODE>({ message })`) — tức phần
 * chi tiết đi kèm mã, không phải copy hiển thị. Copy admin đọc trên màn hình
 * vẫn nằm ở `@tourism/i18n` tra theo mã (luật 7), đúng nếp mọi lỗi ghi khác
 * của back office.
 *
 * ## Vì sao ở `apps/api` chứ không ở contract
 *
 * Cùng lý lẽ với `tour-costs.ts`: hôm nay CHỈ api áp ba luật này (chúng là
 * CỔNG của ba lệnh ghi admin). Màn hình soi gương bằng dữ liệu nó đã có trong
 * tay — `seatsBooked`, `liveBookingCount`, `cancellationDeadline` đều nằm sẵn
 * trên hàng đang sửa — nên chưa có bên thứ hai đọc chung LUẬT. Ngày nào có,
 * đó là lúc nâng lên contract.
 *
 * Riêng hạn chót thì KHÔNG tự tính: `cancellationDeadline` của contract là
 * nguồn duy nhất cho cả văn bản lẫn phép tính (ADR-0041 §8).
 */

/**
 * Hạ `seatsTotal` xuống dưới số ghế ĐÃ ĐẶT (spec §2c).
 *
 * Bằng nhau là HỢP LỆ — "khoá lại đúng con số đang có, không nhận thêm ai" là
 * thao tác thật, và CHECK `departures_seats_within_total` cũng cho phép bằng.
 * Chặn ở đây là API nghiêm hơn chính dữ liệu, vô cớ.
 *
 * Tồn tại để lỗi 23514 của CHECK không phơi lên màn hình: mã SQLSTATE là câu
 * trả lời đúng cho một cái backstop, không phải cho người đang sửa lịch.
 */
export function seatsChangeBlocker(seatsTotal: number, seatsBooked: number): string | null {
  if (seatsTotal >= seatsBooked) return null;
  return `This departure already has ${seatsBooked} seats booked — the total cannot go below ${seatsBooked}.`;
}

/**
 * Đổi ngày chuyến khi đã có booking SỐNG (spec §2b).
 *
 * `Booking` lưu BẢN SAO `departureStartDate`/`departureEndDate` tại lúc đặt,
 * và ADR-0041 tính hạn huỷ từ bản sao ấy chứ không từ chuyến. Đổi ngày mà
 * không đồng bộ xuống booking là tạo hai sự thật: web hiện ngày mới, hạn huỷ
 * của khách neo theo ngày cũ. Đồng bộ xuống thì dời sớm lên là âm thầm rút
 * ngắn quyền huỷ của người ĐÃ TRẢ TIỀN — cái spec đã cân nhắc rồi loại.
 *
 * Bất biến: hạn huỷ không bao giờ xấu đi sau khi khách đã trả tiền.
 *
 * "Sống" = `PENDING`, `PAID`, `PARTIALLY_REFUNDED` — tập do chỗ gọi đếm; hàm
 * này chỉ biết con số, và con số ấy phải đọc TRONG cùng transaction với phép
 * ghi (`docs/conventions/read-then-write-races.md`).
 */
export function dateChangeBlocker(liveBookingCount: number): string | null {
  if (liveBookingCount <= 0) return null;
  const plural = liveBookingCount === 1 ? 'booking' : 'bookings';
  return `This departure already has ${liveBookingCount} live ${plural} — its dates can no longer change.`;
}

/**
 * Mở lại một chuyến đã đóng sau khi hạn chót đã trôi qua.
 *
 * Hạn chót vừa là lúc hết huỷ miễn phí vừa là lúc NGỪNG NHẬN ĐẶT (ADR-0041
 * §3), nên mở lại sau mốc đó là bày ra một chuyến không ai đặt được — web
 * dựng `bookable` từ chính mốc này. Đóng thì lúc nào cũng được: đóng sớm
 * không hứa gì với ai.
 *
 * Mốc lấy từ `cancellationDeadline` và so bằng `isWithinDeadline` (ngày lịch
 * VIỆT NAM, hết lúc 23:59:59) — không viết lại luật N (ADR-0041 §8).
 */
export function reopenBlocker(startDate: string, endDate: string, now: Date): string | null {
  if (isWithinDeadline(now, startDate, endDate)) return null;
  const deadline = cancellationDeadline(startDate, endDate);
  return `The booking deadline for this departure passed on ${deadline} — it can no longer reopen.`;
}

/** Đúng những field của một chuyến mà CARD `/tours` của web nhìn thấy gián tiếp. */
export interface DepartureCardInput {
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  priceOverride: string | null;
}

/**
 * Chuyến này có nuôi giá "from" trên card không: đang `OPEN` và CÒN nhận đặt.
 * Cùng bộ lọc mà `CatalogService` dùng để tính `priceFrom` (ADR-0041 §3) —
 * chuyến qua hạn đặt không bán được nên không được kéo giá xuống.
 */
function feedsCardPrice(departure: DepartureCardInput, now: Date): boolean {
  return (
    departure.status === 'OPEN' && isWithinDeadline(now, departure.startDate, departure.endDate)
  );
}

/**
 * Tag cache-web cần bust sau một lệnh ghi lên chuyến (spec §2g).
 *
 * `tour:<slug>` LUÔN có: trang chi tiết in danh sách chuyến, mọi thay đổi đều
 * thấy được ở đó. `tours` thì CÓ ĐIỀU KIỆN, vì card danh sách chỉ nhìn thấy
 * chuyến qua đúng một con số — `priceFrom` = min giá trên các chuyến còn đặt
 * được. Đổi số GHẾ của một chuyến không đụng tới con số ấy, mà bust `tours` là
 * bắt cả trang danh sách dựng lại.
 *
 * `before: null` = vừa tạo chuyến.
 *
 * Hàm THUẦN và tách riêng đúng nếp `moderationRevalidationTags`: quyết định
 * "bust cái gì" là thứ đáng có test, còn service thì chỉ gọi `void revalidate`
 * SAU commit.
 */
export function departureRevalidationTags(args: {
  tourSlug: string;
  before: DepartureCardInput | null;
  after: DepartureCardInput;
  now: Date;
}): string[] {
  const tourTag = `tour:${args.tourSlug}`;
  const fedBefore = args.before !== null && feedsCardPrice(args.before, args.now);
  const feedsAfter = feedsCardPrice(args.after, args.now);
  // Giá "from" đổi được khi: chuyến bước vào/rời khỏi tập còn-đặt-được, hoặc
  // vẫn ở trong tập mà giá (hay ngày, thứ quyết định còn-đặt-được) đã khác.
  const priceMoved =
    feedsAfter &&
    (args.before === null ||
      args.before.priceOverride !== args.after.priceOverride ||
      args.before.startDate !== args.after.startDate ||
      args.before.endDate !== args.after.endDate);
  return fedBefore !== feedsAfter || priceMoved ? ['tours', tourTag] : [tourTag];
}
