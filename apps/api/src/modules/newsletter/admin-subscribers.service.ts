import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminSubscribersListQuery,
  AdminSubscribersListResult,
  AdminSubscriberUnsubscribeInput,
  AdminSubscriberUnsubscribeResult,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { escapeLike } from '../../lib/like.js';
import { toPaged } from '../../lib/paged.js';
import { LIST_SELECT, toSubscriberRow } from './subscriber-row.js';
import { claimUnsubscribe } from './unsubscribe-claim.js';

export class SubscriberNotFoundError extends Error {
  constructor(id: string) {
    super(`Subscriber ${id} not found`);
    this.name = 'SubscriberNotFoundError';
  }
}

/** Hàng còn đó nhưng đã rút consent từ trước — 409, KHÔNG đè mốc cũ. */
export class SubscriberAlreadyUnsubscribedError extends Error {
  constructor(id: string) {
    super(`Subscriber ${id} has already unsubscribed`);
    this.name = 'SubscriberAlreadyUnsubscribedError';
  }
}

/**
 * Bề mặt subscribers cho admin (spec P4c §3-F10) — danh sách nhận tin mà form
 * footer CÔNG KHAI của web ghi vào, cộng MỘT hành vi ghi.
 *
 * Service RIÊNG chứ không thêm method vào `NewsletterService` (cùng khuôn
 * `AdminEnquiriesService`): `NewsletterService` canh bất biến "subscriber +
 * outbox welcome trong CÙNG một transaction" và cả ba nhánh token HMAC của
 * đường khách, bị `newsletter.int.spec.ts` pin từng cái; hai method admin
 * chen vào đó là mở rộng bề mặt của thứ không nên đụng. Cùng module theo
 * §2.1 — không mở module thứ hai cho cùng một bảng.
 */
@Injectable()
export class AdminSubscribersService {
  private readonly logger = new Logger(AdminSubscribersService.name);

  /**
   * Một trang địa chỉ, MỚI NHẤT trước (`createdAt desc`; `id` phụ để thứ tự
   * ổn định khi hai lượt đăng ký rơi cùng mili-giây).
   *
   * `active` là cờ BA TRẠNG THÁI nên phải so `=== true` / `=== false` chứ
   * không truthy: `undefined` (tab All) và `false` (tab Unsubscribed) là hai
   * câu hỏi khác hẳn nhau, còn một phép truthy gộp chúng làm một và tab
   * "Unsubscribed" sẽ lặng lẽ trả về cả bảng.
   *
   * `search` khớp `email` contains không phân biệt hoa/thường. Cột là
   * `citext` nên phép SO BẰNG vốn đã không phân biệt, nhưng `contains` sinh
   * `LIKE` — `mode: 'insensitive'` mới biến nó thành `ILIKE`. Chuỗi gõ đi qua
   * `escapeLike` (bài học F9): Prisma không tự escape `%`/`_`, mà `_` trong
   * địa chỉ email là chuyện thường ngày. LIKE hai đầu không dùng được index
   * nào; bảng này lớn theo số người đăng ký nên ghi sổ cùng ngưỡng ~10k của
   * `StatsService` (JSDoc mục Index).
   *
   * `sources` đọc distinct TOÀN BẢNG, KHÔNG theo `where` đang áp — xem JSDoc
   * `AdminSubscribersListResultSchema` ở contract: một Select tự cắt bỏ các
   * lựa chọn khác ngay khi vừa chọn một cái là ngõ cụt. Câu này chạy SONG
   * SONG với hai câu kia (`Promise.all`) và CHỈ khi `includeSources` (vòng vá
   * review F10): vòng export gọi list 20 lượt mà không cần nó.
   */
  async list(query: AdminSubscribersListQuery): Promise<AdminSubscribersListResult> {
    const { page, limit, active, search, source, includeSources } = query;
    const term = search ? escapeLike(search) : undefined;
    const where: Prisma.SubscriberWhereInput = {
      ...(active === true ? { unsubscribedAt: null } : {}),
      ...(active === false ? { unsubscribedAt: { not: null } } : {}),
      ...(source ? { source } : {}),
      ...(term ? { email: { contains: term, mode: 'insensitive' } } : {}),
    };
    const [total, rows, sources] = await Promise.all([
      prisma.subscriber.count({ where }),
      prisma.subscriber.findMany({
        where,
        select: LIST_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      includeSources ? this.distinctSources() : Promise.resolve([]),
    ]);
    return { ...toPaged(rows.map(toSubscriberRow), { page, limit, total }), sources };
  }

  /**
   * Gỡ MỘT địa chỉ khỏi danh sách thay khách (họ trả lời email hoặc gọi điện
   * mà không tự bấm được link trong thư).
   *
   * Luật claim (MỘT `updateMany` có guard, ADR-0009; `count === 0` phân biệt
   * "đã huỷ" với "không tồn tại" bằng một `findUnique` chỉ trên nhánh hỏng)
   * DÙNG CHUNG với đường khách qua `claimUnsubscribe` (vòng vá review F10 —
   * bản đầu chép lại nguyên khối). Khác nhau chỉ ở kết cục: đường khách coi
   * "đã huỷ" là idempotent, còn với người bấm nút ở đây đó là thế giới đã đổi
   * dưới chân dialog → 409, và mốc rút consent cũ (bằng chứng pháp lý
   * GDPR/CAN-SPAM) KHÔNG bị đè bằng giờ của người bấm sau.
   *
   * Trả về mốc VỪA GHI chứ không đọc lại: `claimed` nghĩa là chính câu UPDATE
   * này thắng, nên giá trị nó đặt cũng là giá trị đang nằm trong hàng.
   */
  async unsubscribe(
    admin: { id: string },
    input: AdminSubscriberUnsubscribeInput,
  ): Promise<AdminSubscriberUnsubscribeResult> {
    const claim = await claimUnsubscribe(input.id);
    if (claim.kind === 'missing') throw new SubscriberNotFoundError(input.id);
    if (claim.kind === 'already') throw new SubscriberAlreadyUnsubscribedError(input.id);

    // KHÔNG log email (spec §2.3, cùng luật payload outbox): địa chỉ là PII và
    // dòng log này chỉ cần trả lời "ai gỡ hàng nào, lúc nào" — `subscriberId`
    // tra ngược ra hàng được, còn một dòng log mang email thì không rút lại
    // được khỏi nơi log đi tới.
    this.logger.log(
      `[admin] subscriber unsubscribe ${JSON.stringify({
        adminId: admin.id,
        subscriberId: input.id,
      })}`,
    );
    return { id: input.id, unsubscribedAt: claim.at.toISOString() };
  }

  /**
   * Các giá trị `source` CÓ THẬT trong bảng, sắp a→z. Hàng `source` null
   * không có mặt: "không khai nguồn" là sự vắng mặt của một nguồn, không
   * phải một nguồn để lọc theo — và tab đã có sẵn `active` để cắt tập.
   *
   * `groupBy` chứ không `findMany({ distinct })`: distinct của Prisma lọc ở
   * tầng client sau khi kéo hàng về, còn `groupBy` là `GROUP BY` thật ở
   * Postgres — khác nhau đúng bằng cả bảng khi danh sách dài ra.
   */
  private async distinctSources(): Promise<string[]> {
    const groups = await prisma.subscriber.groupBy({
      by: ['source'],
      where: { source: { not: null } },
      orderBy: { source: 'asc' },
    });
    return groups.flatMap((group) => (group.source === null ? [] : [group.source]));
  }
}
