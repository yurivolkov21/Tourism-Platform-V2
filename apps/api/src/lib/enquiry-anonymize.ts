import type { PrismaClient } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';

/**
 * Anonymize enquiry (W4 E8, ADR-0039 §6) — MỘT nguồn sự thật cho cả hai
 * caller: job retention hằng ngày (theo tuổi) và `deleteAccount` (theo
 * userId, trong CÙNG transaction tombstone). Anonymize chứ không xoá: thống
 * kê lead (đếm, nguồn, tour, status) còn nguyên, PII thì không.
 *
 * Một câu UPDATE raw vì email thay bằng `anon-<id>@invalid` — cần id của
 * TỪNG row trong biểu thức, thứ `updateMany` của Prisma không diễn tả được.
 * `message` là cột NOT NULL → về chuỗi rỗng; `phone` nullable → NULL.
 */

/** Tên hiển thị sau khi anonymize — hằng để test/admin đối chiếu. */
export const ANONYMIZED_NAME = '[anonymized]';

/** Client Prisma hoặc transaction client — hai caller, hai bối cảnh. */
type Db = Pick<PrismaClient, '$executeRaw'>;

/**
 * Mốc "createdAt cũ hơn thì tới hạn": lùi `months` tháng theo ngày lịch UTC
 * (cùng nếp đếm theo ngày của ADR-0030), giờ về 00:00. Date.UTC tự chuẩn hoá
 * tháng âm và ngày tràn (31/03 lùi 1 tháng → 03/03) — lệch vài ngày không
 * đổi bản chất một mốc retention.
 */
export function retentionCutoff(now: Date, months: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate()));
}

/** Job retention: mọi enquiry cũ hơn `cutoff` chưa anonymize. Trả số row. */
export function anonymizeEnquiriesOlderThan(db: Db, cutoff: Date): Promise<number> {
  return db.$executeRaw(anonymizeSql(Prisma.sql`created_at < ${cutoff}`));
}

/** deleteAccount: mọi enquiry của user — quyền được xoá mạnh hơn lịch. */
export function anonymizeEnquiriesOfUser(db: Db, userId: string): Promise<number> {
  return db.$executeRaw(anonymizeSql(Prisma.sql`user_id = ${userId}::uuid`));
}

function anonymizeSql(where: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    UPDATE enquiries
    SET name = ${ANONYMIZED_NAME},
        email = 'anon-' || id || '@invalid',
        phone = NULL,
        message = '',
        anonymized_at = now(),
        updated_at = now()
    WHERE anonymized_at IS NULL AND ${where}
  `;
}
