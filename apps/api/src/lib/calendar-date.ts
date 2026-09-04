/**
 * Prisma `@db.Date` (Date lúc 00:00 UTC) → ngày lịch "YYYY-MM-DD".
 *
 * MỘT bản cho cả API (vòng vá review F9: bookings, catalog, reviews và
 * enquiries từng mỗi nơi một bản `toISOString().slice(0, 10)`). Cắt theo UTC
 * là ĐÚNG với cột DATE: Prisma đọc nó thành nửa đêm UTC, nên đi qua
 * `getDate()`/`toLocaleDateString` sẽ lùi một ngày trên mọi máy ở múi giờ âm
 * — server capstone chạy UTC còn máy dev thì không. Ngày nào đổi luật (ví dụ
 * đọc theo giờ VN) thì đổi ở đây, bốn nơi cùng theo.
 */
export const calendarDate = (value: Date): string => value.toISOString().slice(0, 10);

/**
 * Ngày lịch "YYYY-MM-DD" → mốc 00:00:00.000 UTC của ngày đó — phép NGƯỢC của
 * `calendarDate`.
 *
 * MỘT bản cho cả API (ADR-0028): bộ lọc ngày của `/bookings` và cửa sổ stat
 * card cùng vùng ấy phải cắt CÙNG MỘT NHÁT, và hai bản chép là hai nhát sẽ
 * trôi lệch. Người tiêu thụ: `created-at-range.ts` (where của bảng) và
 * `stats-math.ts` (cửa sổ của card).
 *
 * Luôn `.000` chứ KHÔNG `00:00:01`: một giây trễ ở đầu kỳ bỏ rơi mọi row rơi
 * vào giây đầu tiên của ngày. Cặp mốc đúng là nửa-mở — xem `createdAtRange` ở `created-at-range.ts`.
 */
export const startOfDayUtc = (date: string): Date => new Date(`${date}T00:00:00.000Z`);
