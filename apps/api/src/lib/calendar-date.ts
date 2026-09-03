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
