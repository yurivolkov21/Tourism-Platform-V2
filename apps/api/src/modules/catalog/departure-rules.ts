import {
  canCancelOnline,
  cancellationDeadline,
  isWithinDeadline,
  tripLengthDays,
} from '@tourism/contract';
import { feedsTourCard } from './card-departures.js';

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
 * Cùng lý lẽ đã giữ ba hàm giá vốn ở api cho tới khi màn Costs của admin cần
 * tính đúng con số ấy (F17 dời chúng lên contract — ADR-0047 §8): hôm nay CHỈ
 * api áp ba luật này (chúng là CỔNG của ba lệnh ghi admin). Màn hình soi gương bằng dữ liệu nó đã có trong
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
 * Đổi ngày chuyến khi GHẾ đã bị giữ (spec §2b).
 *
 * `Booking` lưu BẢN SAO `departureStartDate`/`departureEndDate` tại lúc đặt,
 * và ADR-0041 tính hạn huỷ từ bản sao ấy chứ không từ chuyến. Đổi ngày mà
 * không đồng bộ xuống booking là tạo hai sự thật: web hiện ngày mới, hạn huỷ
 * của khách neo theo ngày cũ. Đồng bộ xuống thì dời sớm lên là âm thầm rút
 * ngắn quyền huỷ của người ĐÃ TRẢ TIỀN — cái spec đã cân nhắc rồi loại.
 *
 * Bất biến: hạn huỷ không bao giờ xấu đi sau khi khách đã trả tiền.
 *
 * **Thước là `seats_booked`, KHÔNG phải tập trạng thái booking** (chốt lại ở
 * vòng review 21/09). Bản đầu đếm `PENDING`/`PAID`/`PARTIALLY_REFUNDED` và loại
 * `REFUNDED` với lý do "kết cục đã đóng, không giữ ghế" — nhưng
 * `booking-states.md` nói ngược đúng chỗ đó: hoàn thiện chí trọn tiền KHÔNG trả
 * ghế, khách VẪN đi tour. Chỉ lõi huỷ mới trừ ghế. Nên một booking `REFUNDED`
 * kiểu ấy để lại `seats_booked > 0` mà đếm-theo-trạng-thái đọc ra 0, và ô ngày
 * mở khoá cho một chuyến vẫn còn khách thật.
 *
 * Đổi thước còn xoá được một mâu thuẫn bày ngay trên màn hình: hàng hiện
 * "Seats 4 / 20" cạnh "Live bookings: 0".
 *
 * Con số phải đọc TRONG cùng transaction với phép ghi
 * (`docs/conventions/read-then-write-races.md`) — ở đây nó đến thẳng từ hàng
 * vừa `SELECT … FOR UPDATE`, nên không có khoảng hở nào.
 */
export function dateChangeBlocker(seatsBooked: number): string | null {
  if (seatsBooked <= 0) return null;
  const plural = seatsBooked === 1 ? 'seat' : 'seats';
  return `This departure already has ${seatsBooked} ${plural} booked — its dates can no longer change.`;
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

/**
 * Ghế của chuyến vượt cỡ nhóm TỐI ĐA mà tour công bố (F12 vòng hai) — chuỗi lý
 * do, hoặc `null` khi hợp lệ.
 *
 * `tours.max_group_size` không phải một con số trang trí: nó là lời hứa bán
 * hàng in trên chính trang tour ("Small groups, always led by local guides"), và
 * nó quyết cỡ xe với số hướng dẫn viên. Một chuyến 40 ghế trên một tour công bố
 * tối đa 12 là bán thứ không giao được — và không có tầng nào bên dưới bắt:
 * CHECK của DB chỉ canh `seats_booked <= seats_total`, không biết gì về tour.
 *
 * 422 chứ không 409: người gõ sửa được ngay tại ô, khác hẳn họ nhóm 409 nơi thứ
 * đã đổi nằm ngoài tầm tay họ.
 */
export function seatsAboveTourMaxBlocker(seatsTotal: number, maxGroupSize: number): string | null {
  if (seatsTotal <= maxGroupSize) return null;
  return `This tour runs groups of at most ${maxGroupSize} travellers, so a departure cannot have ${seatsTotal} seats.`;
}

/**
 * Chuyến dài khác số ngày tour công bố (review A2, M3-13) — chuỗi lý do, hoặc `null` khi khớp.
 *
 * `durationDays` không chỉ là chữ "5 days" trên thẻ tour: web in luật huỷ miễn phí theo nó
 * (`windowDaysForTripLength(durationDays)`), app đếm "Day n of N" theo nó, còn hạn huỷ thật của
 * từng chuyến tính từ chính ngày đi và ngày về (ADR-0041 §8). Chuyến 7 ngày trên tour 5 ngày là
 * khách đọc hạn N = 7 ở dòng chuyến mà thẻ chính sách hứa theo 5 ngày. Seed đã giữ luật này
 * (`departures-2026.spec.ts`); chỉ form admin phá được nó, nên server canh ở `create`, và ở
 * `update` khi ngày đổi.
 *
 * Gọi SAU `assertDateRange`: `tripLengthDays` ném khi ngày về trước ngày đi.
 */
export function tripLengthBlocker(
  startDate: string,
  endDate: string,
  durationDays: number,
): string | null {
  const length = tripLengthDays(startDate, endDate);
  if (length === durationDays) return null;
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
  return `This tour runs ${days(durationDays)}, but a departure from ${startDate} to ${endDate} runs ${days(length)}.`;
}

/**
 * Công ty huỷ chuyến được không lúc `now` (F13, ADR-0041 §6) — `null` = được.
 *
 * Thước là NGÀY KHỞI HÀNH, không phải hạn nhận đặt. Khác biệt ấy là chủ đích:
 * hạn nhận đặt là luật cho việc BÁN (`reopenBlocker`), còn một chuyến quá hạn
 * đặt mà hướng dẫn viên gãy chân vẫn phải huỷ được — đó đúng là lúc người ta
 * cần nút này nhất.
 *
 * Chặn ở đây là chặn SỚM: `cancellationBlocker` của từng booking cũng từ chối
 * sau ngày khởi hành, nhưng lúc ấy nửa hàng đợi đã đi và admin chỉ thấy một
 * cột tiến độ đứng im. Cùng thước (`canCancelOnline`, ngày lịch Việt Nam) nên
 * hai tầng không bao giờ nói ngược nhau.
 *
 * Chỉ nhận `startDate` — khác `reopenBlocker` vốn cần cả hai ngày để suy ra N.
 * Ở đây độ dài chuyến không nói gì: chuyến đã bắt đầu là đã bắt đầu.
 */
export function departureCancelBlocker(startDate: string, now: Date): string | null {
  if (canCancelOnline(now, startDate)) return null;
  return `This departure has already started on ${startDate} — it can no longer be cancelled.`;
}

/**
 * Đúng những field của một chuyến mà CARD `/tours` của web nhìn thấy gián tiếp: giá "from",
 * ngày và số chỗ còn lại của đợt kế tiếp (ADR-0058).
 */
export interface DepartureCardInput {
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  priceOverride: string | null;
  /** `seatsTotal − seatsBooked` của hàng. */
  seatsLeft: number;
}

/**
 * Tag cache-web cần bust sau một lệnh ghi lên chuyến (spec §2g).
 *
 * `tour:<slug>` LUÔN có: trang chi tiết in danh sách chuyến, mọi thay đổi đều
 * thấy được ở đó. `tours` thì CÓ ĐIỀU KIỆN: card danh sách chỉ nhìn thấy những
 * chuyến nuôi thẻ (`feedsTourCard` — OPEN, còn hạn đặt, còn chỗ; ADR-0058 §1),
 * qua giá "from" và qua ngày cùng số chỗ của đợt kế tiếp. Lệnh ghi không đổi gì
 * trong ba thứ ấy mà bust `tours` là bắt cả trang danh sách dựng lại cho vui.
 *
 * Từ ADR-0058 §6 số chỗ còn lại nằm trong phép so: trước đó card không in số
 * ghế nên đổi ghế chỉ bust trang tour.
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
  const fedBefore = args.before !== null && feedsTourCard(args.before, args.now);
  const feedsAfter = feedsTourCard(args.after, args.now);
  // Thẻ đổi được khi: chuyến bước vào/rời khỏi tập nuôi thẻ, hoặc vẫn ở trong
  // tập mà giá, ngày hay số chỗ còn lại đã khác.
  const cardMoved =
    feedsAfter &&
    (args.before === null ||
      args.before.priceOverride !== args.after.priceOverride ||
      args.before.startDate !== args.after.startDate ||
      args.before.endDate !== args.after.endDate ||
      args.before.seatsLeft !== args.after.seatsLeft);
  return fedBefore !== feedsAfter || cardMoved ? ['tours', tourTag] : [tourTag];
}
