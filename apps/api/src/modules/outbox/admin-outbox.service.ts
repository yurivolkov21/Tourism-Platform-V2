import { Injectable, Logger } from '@nestjs/common';
import type { AdminOutboxListQuery, OutboxRow, Paged } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { OutboxStatus } from '../../generated/prisma/enums.js';
import { toPaged } from '../../lib/paged.js';
import { toOutboxRow } from './outbox-row.js';

export class OutboxRowNotFoundError extends Error {
  constructor(id: string) {
    super(`Outbox row ${id} not found`);
    this.name = 'OutboxRowNotFoundError';
  }
}

export class OutboxRowNotFailedError extends Error {
  constructor(status: OutboxStatus) {
    super(`Outbox row is ${status}, not FAILED — only a FAILED row can be retried`);
    this.name = 'OutboxRowNotFailedError';
  }
}

/** Mã Prisma "record to update not found" — câu UPDATE có guard trượt. */
const PRISMA_NOT_FOUND = 'P2025';

/**
 * Bề mặt outbox cho admin (spec P4c §3-F7): đọc bảng `outbox` và MỘT hành vi
 * ghi — đưa hàng FAILED trở lại hàng đợi.
 *
 * KHÔNG gọi worker: `retry` chỉ đổi trạng thái, lượt drain kế (pg-boss mỗi
 * phút — `worker/start-worker.ts`) tự nhặt hàng PENDING cũ nhất trước. API và
 * worker là hai vòng đời khác nhau (ADR-0007/0024); gọi chéo là gieo hạt cho
 * hai tiến trình cùng gửi một email.
 */
@Injectable()
export class AdminOutboxService {
  private readonly logger = new Logger(AdminOutboxService.name);

  /**
   * Một trang outbox, MỚI NHẤT trước (`createdAt desc` — spec §3-F7; `id`
   * phụ để thứ tự ổn định khi hai row cùng mốc). Bỏ trống filter → mọi row.
   *
   * `search` (vòng vá review F7) khớp KHÔNG phân biệt hoa/thường trên bốn
   * chỗ: `dedupeKey`, `payload.code` (mã booking `BK-XXXX`), `payload.email`,
   * `payload.to`. Bản đầu chỉ khớp dedupeKey — mà key thật là
   * `<event>:<uuid>`, không mang mã người đọc — nên đúng câu hỏi "email của
   * đơn BK-XXXX đâu rồi" (vụ 20/08) lại tra không ra. Bốn vế `contains` trên
   * cột không index (JSON path + LIKE) — ghi sổ: outbox có retention 30 ngày
   * nên bảng nhỏ; vượt ~10k row thì xem `pg_trgm`.
   */
  async list(query: AdminOutboxListQuery): Promise<Paged<OutboxRow>> {
    const { page, limit, status, type, search } = query;
    const where: Prisma.OutboxWhereInput = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { dedupeKey: { contains: search, mode: 'insensitive' } },
              { payload: { path: ['code'], string_contains: search, mode: 'insensitive' } },
              { payload: { path: ['email'], string_contains: search, mode: 'insensitive' } },
              { payload: { path: ['to'], string_contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.outbox.count({ where }),
      prisma.outbox.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return toPaged(rows.map(toOutboxRow), { page, limit, total });
  }

  /**
   * FAILED → PENDING, `attempts = 0`, GIỮ `lastError` (worker ghi đè ở lượt
   * kế; xoá đi là mất manh mối duy nhất nếu lần gửi lại cũng hỏng — và cũng
   * là dấu vết duy nhất rằng row từng được retry, xem JSDoc contract).
   *
   * MỘT câu `update` có guard `status: FAILED` ngay trong `where` (vòng vá
   * review F7 — bản đầu là `updateMany` + đọc lại, hai câu không nguyên tử:
   * worker có thể gửi xong giữa hai câu và response trả về một row SENT kèm
   * toast "đã xếp lại"; row bị purge ở khe đó thì `findUniqueOrThrow` nổ
   * P2025 thành 500). Hai admin bấm cùng lúc: chỉ một câu ăn, câu kia nhận
   * P2025 → tra lại để nói đúng: không có hàng → NOT_FOUND; có nhưng không
   * còn FAILED → NOT_FAILED (kèm trạng thái thật).
   *
   * Log có cấu trúc quy về NGƯỜI (spec §2.2) — KHÔNG log payload (§2.3: có
   * thể chứa email khách, và với email auth là cả credential).
   */
  async retry(adminId: string, id: string): Promise<OutboxRow> {
    let row: Prisma.OutboxGetPayload<Record<string, never>>;
    try {
      row = await prisma.outbox.update({
        where: { id, status: OutboxStatus.FAILED },
        data: { status: OutboxStatus.PENDING, attempts: 0 },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_NOT_FOUND
      ) {
        const existing = await prisma.outbox.findUnique({
          where: { id },
          select: { status: true },
        });
        if (!existing) throw new OutboxRowNotFoundError(id);
        throw new OutboxRowNotFailedError(existing.status);
      }
      throw error;
    }
    this.logger.log(
      `[admin] outbox retry ${JSON.stringify({ adminId, outboxId: row.id, type: row.type })}`,
    );
    return toOutboxRow(row);
  }
}
