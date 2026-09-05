/**
 * Cầu nối giữa hai cách viết một ngày trong admin: chuỗi ISO `YYYY-MM-DD`
 * mà URL và contract nói, và chuỗi người đọc ("September 01, 2026") mà ô nhập
 * kiểu `date-picker-04` hiển thị.
 *
 * Tách khỏi component vì đây là logic THUẦN (luật 4 — TDD): mọi cái bẫy ở đây
 * là bẫy dữ liệu chứ không phải bẫy render, và bẫy nào cũng câm — sai một ngày
 * thì bảng vẫn vẽ ra bình thường, chỉ lọc nhầm.
 */

/** Dạng ngày DUY NHẤT đi trên URL (khớp `bookings-query`). */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Chưa có năm 4 chữ số nghĩa là người ta còn đang gõ dở. Không có chốt này,
 * `new Date` sẽ đoán bừa một mẩu như "September 01" thành ngày trong NĂM
 * HIỆN TẠI, và một cú blur giữa chừng chốt đại bộ lọc admin không hề chọn.
 */
const HAS_YEAR = /\d{4}/;

/** Dáng ISO — đầy đủ hay một phần — chỉ có MỘT đường parse: `parseIsoDate`. */
const ISO_LIKE = /^\d{4}(-|T|$)/;

/** Ngày hợp lệ? (`new Date` trả Invalid Date chứ không ném.) */
function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

/**
 * ISO `YYYY-MM-DD` → `Date` ở giờ ĐỊA PHƯƠNG.
 *
 * Tự tách chuỗi chứ KHÔNG đưa cho `new Date(iso)`: dạng đó được spec định
 * nghĩa là nửa đêm UTC, nên ở mọi múi giờ âm nó lùi một ngày — admin ở New
 * York lọc "từ 01/09" sẽ thấy ô khoe "August 31, 2026".
 */
export function parseIsoDate(iso: string | undefined | null): Date | undefined {
  const match = iso?.match(ISO_DATE);
  if (!match) return undefined;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  // Constructor `Date` CUỘN thầm phần dư: `new Date(2026, 1, 31)` thành 03/03
  // chứ không phải lỗi. So ngược lại từng phần là cách duy nhất bắt được
  // "31 tháng 2" — thứ mà ô nhập tự do và URL gõ tay đều đẻ ra được.
  if (date.getFullYear() !== Number(year)) return undefined;
  if (date.getMonth() !== Number(month) - 1) return undefined;
  if (date.getDate() !== Number(day)) return undefined;

  return date;
}

/** `Date` (giờ địa phương) → ISO `YYYY-MM-DD` để đắp vào URL. */
export function toIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * `Date` → chuỗi hiển thị trong ô, đúng dạng `date-picker-04` dùng
 * ("September 01, 2026"). Ghim `en-US` chứ không theo locale máy: copy
 * user-facing của repo là English-only (luật 7), và ô này còn phải ĐỌC LẠI
 * được chính chuỗi mình vừa in ra.
 */
export function formatDateLabel(date: Date | undefined): string {
  if (!date) return '';

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * `Date` → nhãn NGẮN cho nút khoảng ngày ("Sep 05, 2026"). Tháng viết tắt vì
 * nút phải chứa được HAI ngày cạnh nhau; dạng dài của `formatDateLabel` thì
 * một mình đã gần bằng chiều rộng cả nút.
 */
export function formatShortDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Khoảng ngày → chữ trên nút. Cùng NĂM thì năm chỉ in một lần ở cuối
 * ("Sep 05 – Sep 22, 2026") — một tờ báo cáo hay một bộ lọc lặp lại năm hai
 * lần chỉ tổ làm nút dài ra mà không nói thêm gì.
 *
 * Ba dạng đầu vào, ba câu khác nhau; `null` khi không lọc gì để nơi dùng in
 * nhãn "mọi ngày" của nó.
 */
export function formatDateRangeLabel(
  from: Date | undefined,
  to: Date | undefined,
): { kind: 'range' | 'from' | 'to'; text: string } | null {
  if (from && to) {
    const sameYear = from.getFullYear() === to.getFullYear();
    const start = sameYear
      ? from.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })
      : formatShortDateLabel(from);
    return { kind: 'range', text: `${start} – ${formatShortDateLabel(to)}` };
  }
  if (from) return { kind: 'from', text: formatShortDateLabel(from) };
  if (to) return { kind: 'to', text: formatShortDateLabel(to) };
  return null;
}

/**
 * Chuỗi người gõ trong ô → `Date`, hoặc `undefined` nếu chưa ra ngày.
 *
 * Khoan dung có giới hạn: nhận đúng dạng mình in ra, nhận cả ISO và các biến
 * thể viết tắt ("Sep 1 2026"), nhưng đòi một năm 4 chữ số trước khi tin. Ca
 * ISO phải đi đường `parseIsoDate` cho khỏi lệch múi giờ (xem trên).
 */
export function parseTypedDate(text: string): Date | undefined {
  const trimmed = text.trim();
  if (!trimmed || !HAS_YEAR.test(trimmed)) return undefined;

  const iso = parseIsoDate(trimmed);
  if (iso) return iso;
  // Mọi chuỗi MỞ ĐẦU bằng năm-4-chữ-số rồi `-`/`T`/hết chuỗi đều là dáng ISO
  // (vòng vá review 02/09): dạng đầy đủ mà `parseIsoDate` từ chối
  // ("2026-02-31") là ngày không tồn tại, còn dạng MỘT PHẦN ("2026",
  // "2026-09", "2026-09-01T00:00:00Z") thì ECMA-262 bảo `new Date` parse theo
  // UTC — ở múi giờ âm lùi đúng một ngày, chính cái bẫy file này sinh ra để
  // trị. Cả hai đều không được rơi xuống `new Date` bên dưới.
  if (ISO_LIKE.test(trimmed)) return undefined;

  const parsed = new Date(trimmed);

  return isValidDate(parsed) ? parsed : undefined;
}
