import { VIETNAM_TIME_ZONE } from '@tourism/contract';
import { Prisma } from '../generated/prisma/client.js';

/**
 * Biểu thức SQL ra NGÀY LỊCH Việt Nam của một mốc thời gian — bản SQL của
 * `vietnamToday` ở contract (ADR-0041 §7). Ví dụ: `vietnamDateSql(Prisma.sql`now()`)`.
 *
 * `timestamptz AT TIME ZONE '<vùng>'` cho giờ đồng hồ treo tường ở vùng đó rồi
 * `::date` cắt lấy ngày, nên kết quả KHÔNG phụ thuộc TimeZone của session DB.
 * Tên vùng lấy từ hằng của contract để Node và SQL đọc chung MỘT nguồn; chèn
 * bằng `Prisma.raw` vì đó là hằng trong mã nguồn chứ không phải dữ liệu người
 * dùng, và câu SQL ra đúng nguyên văn `AT TIME ZONE 'Asia/Ho_Chi_Minh'` của
 * spec §4.1.
 *
 * SQL chỉ dùng thước này cho phép so "chưa khởi hành"; luật N của hạn chót chỉ
 * sống ở Node (spec §4.1), không viết lại ở đây.
 */
export function vietnamDateSql(instant: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((${instant}) AT TIME ZONE ${Prisma.raw(`'${VIETNAM_TIME_ZONE}'`)})::date`;
}
