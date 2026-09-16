import { vietnamToday } from '@tourism/contract';
import { prisma } from '../auth/auth.config.js';
import { Prisma } from '../generated/prisma/client.js';
import { vietnamDateSql } from './vietnam-date-sql.js';

/**
 * Thước ngày Việt Nam phía SQL (ADR-0041 §7) phải trùng từng ngày với
 * `vietnamToday` phía Node: hai thước lệch nhau là claim nhận một chuyến mà
 * `create` đã coi là khởi hành, hoặc ngược lại. Chạy trên Postgres thật vì phép
 * đổi múi giờ do DB làm chứ không phải Node.
 */
describe('vietnamDateSql — thước ngày Việt Nam phía SQL (ADR-0041 §7)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Ngày (text `YYYY-MM-DD`) mà Postgres tính cho một biểu thức mốc thời gian. */
  async function sqlDay(instant: Prisma.Sql): Promise<string> {
    const [row] = await prisma.$queryRaw<{ day: string }[]>(
      Prisma.sql`SELECT (${vietnamDateSql(instant)})::text AS day`,
    );
    if (!row) throw new Error('vietnamDateSql: truy vấn không trả dòng nào');
    return row.day;
  }

  it.each([
    '2026-10-19T16:59:59.000Z', // 23:59:59 ngày 19/10 giờ VN
    '2026-10-19T17:00:00.000Z', // 00:00 ngày 20/10 giờ VN
    '2026-10-19T23:30:00.000Z', // 06:30 ngày 20/10 giờ VN, UTC vẫn là 19/10
    '2026-12-31T17:00:00.000Z', // giao thừa giờ VN
  ])('mốc %s: ngày SQL trùng vietnamToday', async (iso) => {
    // Chuỗi ISO có `Z` rồi ép `timestamptz` ở SQL — không phụ thuộc cách adapter
    // tuần tự hoá một `Date`.
    expect(await sqlDay(Prisma.sql`${iso}::timestamptz`)).toBe(vietnamToday(new Date(iso)));
  });

  it('không phụ thuộc TimeZone của session DB', async () => {
    const iso = '2026-10-19T17:00:00.000Z';
    const day = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE 'America/Los_Angeles'`);
      const instant = Prisma.sql`${iso}::timestamptz`;
      const [row] = await tx.$queryRaw<{ day: string }[]>(
        Prisma.sql`SELECT (${vietnamDateSql(instant)})::text AS day`,
      );
      return row?.day;
    });
    // 10:00 ngày 19/10 ở Los Angeles, nhưng đã là 00:00 ngày 20/10 giờ Việt Nam.
    expect(day).toBe('2026-10-20');
  });

  it('now() của DB ra đúng ngày Việt Nam hiện tại', async () => {
    const before = vietnamToday(new Date());
    const day = await sqlDay(Prisma.sql`now()`);
    const after = vietnamToday(new Date());
    // Chạy đúng lúc nửa đêm giờ VN thì hai đầu có thể khác ngày — nhận cả hai.
    expect([before, after]).toContain(day);
  });
});
