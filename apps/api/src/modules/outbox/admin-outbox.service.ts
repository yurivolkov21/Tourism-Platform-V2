import { Injectable, Logger } from '@nestjs/common';
import type { AdminOutboxListQuery, OutboxRow, Paged } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { OutboxStatus } from '../../generated/prisma/enums.js';
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
   * `search` khớp `dedupeKey` contains, phân biệt hoa/thường — key là chuỗi
   * máy sinh theo quy ước cố định, không phải văn bản người gõ.
   */
  async list(query: AdminOutboxListQuery): Promise<Paged<OutboxRow>> {
    const { page, limit, status, type, search } = query;
    const where: Prisma.OutboxWhereInput = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(search ? { dedupeKey: { contains: search } } : {}),
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
    return {
      items: rows.map(toOutboxRow),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * FAILED → PENDING, `attempts = 0`, GIỮ `lastError` (worker ghi đè ở lượt
   * kế; xoá đi là mất manh mối duy nhất nếu lần gửi lại cũng hỏng).
   *
   * Guard `status: FAILED` nằm trên chính câu UPDATE (`updateMany`, nếp
   * worker): hai admin bấm retry cùng lúc thì chỉ một câu ăn, câu kia thấy
   * 0 row. 0 row có hai nghĩa — tra lại để nói đúng: không có hàng →
   * NOT_FOUND; có nhưng không còn FAILED → NOT_FAILED (kèm trạng thái thật).
   *
   * Log có cấu trúc quy về NGƯỜI (spec §2.2) — KHÔNG log payload (§2.3: có
   * thể chứa email khách).
   */
  async retry(adminId: string, id: string): Promise<OutboxRow> {
    const { count } = await prisma.outbox.updateMany({
      where: { id, status: OutboxStatus.FAILED },
      data: { status: OutboxStatus.PENDING, attempts: 0 },
    });
    if (count === 0) {
      const existing = await prisma.outbox.findUnique({ where: { id }, select: { status: true } });
      if (!existing) throw new OutboxRowNotFoundError(id);
      throw new OutboxRowNotFailedError(existing.status);
    }
    const row = await prisma.outbox.findUniqueOrThrow({ where: { id } });
    this.logger.log(
      `[admin] outbox retry ${JSON.stringify({ adminId, outboxId: row.id, type: row.type })}`,
    );
    return toOutboxRow(row);
  }
}
