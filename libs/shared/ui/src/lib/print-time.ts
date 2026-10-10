/**
 * Giờ trên tài liệu in (G40, ADR-0057 §3): "9 Oct 2026, 17:59" — 24 giờ, theo múi giờ truyền vào.
 *
 * Tên tháng lấy từ en-US: luôn "Sep". en-GB của ICU mới in "Sept", lệch mọi ngày khác của site
 * (`formatDate` của web in "Sep"). Ghép từ `formatToParts` để thứ tự cố định "ngày tháng năm" thay vì
 * thứ tự Mỹ; `hourCycle: 'h23'` để nửa đêm là "00", không phải "24".
 */
function parts(at: Date, timeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const out: Record<string, string> = {};
  for (const part of formatter.formatToParts(at)) out[part.type] = part.value;
  return out;
}

/** "9 Oct 2026, 17:59" — mốc đặt đơn, giờ in. */
export function formatPrintDateTime(at: Date, timeZone: string): string {
  const p = parts(at, timeZone);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/** "9 Oct 2026". */
export function formatPrintDate(at: Date, timeZone: string): string {
  const p = parts(at, timeZone);
  return `${p.day} ${p.month} ${p.year}`;
}

/** "19:04". */
export function formatPrintTime(at: Date, timeZone: string): string {
  const p = parts(at, timeZone);
  return `${p.hour}:${p.minute}`;
}

/** "9 Oct" — ngày của dòng "Pay by". */
export function formatPrintDayMonth(at: Date, timeZone: string): string {
  const p = parts(at, timeZone);
  return `${p.day} ${p.month}`;
}
