import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminEnquiriesListQuery,
  AdminEnquiryAddNoteInput,
  AdminEnquiryAddNoteResult,
  AdminEnquirySetStatusInput,
  AdminEnquirySetStatusResult,
  EnquiryDetail,
  EnquiryRow,
  Paged,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { EnquiryStatus } from '../../generated/prisma/enums.js';
import { escapeLike } from '../../lib/like.js';
import { toPaged } from '../../lib/paged.js';
import {
  accountDisplayName,
  DETAIL_SELECT,
  type EnquiryDetailRow,
  LIST_SELECT,
  toEnquiryDetail,
  toEnquiryRow,
} from './enquiry-row.js';

export class EnquiryNotFoundError extends Error {
  constructor(id: string) {
    super(`Enquiry ${id} not found`);
    this.name = 'EnquiryNotFoundError';
  }
}

/** SQLSTATE Prisma cho "vi phạm khoá ngoại" — note trỏ tới enquiry không còn. */
const PRISMA_FOREIGN_KEY_VIOLATION = 'P2003';

/**
 * Bề mặt enquiries cho admin (spec P4c §3-F9) — CRM nhỏ trên bảng `enquiries`
 * mà form công khai ghi vào, cộng thread note nội bộ.
 *
 * Service RIÊNG chứ không thêm method vào `EnquiriesService` (cùng khuôn
 * `AdminOutboxService`/`AdminPaymentEventsService`): `EnquiriesService` canh
 * bất biến "enquiry + hai outbox cùng một transaction" của đường KHÁCH và bị
 * `enquiries.int.spec.ts` pin từng nhánh (kể cả honeypot); bốn method admin
 * chen vào đó là mở rộng bề mặt của thứ không nên đụng. Cùng module theo §2.1
 * — không mở module thứ hai cho cùng một bảng.
 */
@Injectable()
export class AdminEnquiriesService {
  private readonly logger = new Logger(AdminEnquiriesService.name);

  /**
   * Một trang lead, MỚI NHẤT trước (`createdAt desc`; `id` phụ để thứ tự ổn
   * định khi hai form gửi cùng mili-giây — index sẵn `[status, createdAt]`
   * phủ khi có filter status). Bỏ trống filter → mọi row.
   *
   * `search` khớp `name` HOẶC `email` contains không phân biệt hoa/thường.
   * `email` là cột `citext` nên vốn đã không phân biệt hoa/thường ở phép so
   * bằng, nhưng `contains` sinh `LIKE` — `mode: 'insensitive'` là thứ biến
   * nó thành `ILIKE`, cần cho CẢ HAI cột. Chuỗi gõ đi qua `escapeLike`
   * (vòng vá review F9): Prisma không tự escape `%`/`_`, mà email có `_` là
   * chuyện thường. LIKE hai đầu không dùng được index nào; bảng này lớn theo
   * số lead nên ghi sổ cùng ngưỡng ~10k của `StatsService` (JSDoc mục Index).
   */
  async list(query: AdminEnquiriesListQuery): Promise<Paged<EnquiryRow>> {
    const { page, limit, status, search, tourId } = query;
    const term = search ? escapeLike(search) : undefined;
    const where: Prisma.EnquiryWhereInput = {
      ...(status ? { status } : {}),
      ...(tourId ? { tourId } : {}),
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.enquiry.count({ where }),
      prisma.enquiry.findMany({
        where,
        select: LIST_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return toPaged(rows.map(toEnquiryRow), { page, limit, total });
  }

  /** Một lead đầy đủ: message nguyên văn + thread note + lịch sử trạng thái. */
  async byId(id: string): Promise<EnquiryDetail> {
    return toEnquiryDetail(await this.detailRow(prisma, id));
  }

  /**
   * Đổi trạng thái + nối MỘT dòng audit trong CÙNG một transaction (spec
   * §2.5): "Won 28d" đếm trên `enquiry_status_events`, nên một lệnh update
   * ghi được mà event không ghi được là con số đó bắt đầu nói dối.
   *
   * `SELECT … FOR UPDATE` trước khi đọc `status` (nếp `ReviewsService.moderate`,
   * điểm concurrency đã trả giá ở review F4): đọc thường dưới Read Committed
   * có thể trả snapshot cũ khi một admin khác đang commit trên CÙNG row — hai
   * người bấm gần như đồng thời thì dòng audit thứ hai sẽ ghi `fromStatus`
   * SAI (kể "NEW→WON" trong khi thực tế là "CONTACTED→WON"), mà audit trail
   * append-only thì không sửa lại được.
   *
   * Trùng trạng thái → NO-OP CÓ CHỦ ĐÍCH (nếp F4): tab cũ bấm lại đúng trạng
   * thái đang có là lệnh không mang thông tin — không đẩy event `from === to`
   * vào lịch sử (nó sẽ đếm thành một "lượt chuyển sang WON" bịa trên stat
   * card) và KHÔNG đụng `updatedAt` (cột đó là "chạm lần cuối", không phải
   * "có người bấm nút"). Response nói rõ `changed: false` để UI không toast
   * "đã đổi" cho một lệnh không để lại dấu vết (vòng vá review F9).
   *
   * Transaction chỉ giữ ĐÚNG hai câu ghi (vòng vá review F9): tên/trạng thái
   * cho toast đọc luôn từ row đã khoá, không đọc lại cả detail (thread note +
   * lịch sử + join users) trong lúc còn cầm `FOR UPDATE` — trang chi tiết
   * `router.refresh()` sau đó là nguồn sự thật của màn hình.
   */
  async setStatus(
    admin: { id: string },
    input: AdminEnquirySetStatusInput,
  ): Promise<AdminEnquirySetStatusResult> {
    const result = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ status: EnquiryStatus; name: string }[]>(Prisma.sql`
        SELECT status, name FROM enquiries WHERE id = ${input.id}::uuid FOR UPDATE
      `);
      if (!locked) throw new EnquiryNotFoundError(input.id);
      if (locked.status === input.status) {
        return { id: input.id, name: locked.name, status: locked.status, changed: false };
      }

      await tx.enquiry.update({ where: { id: input.id }, data: { status: input.status } });
      await tx.enquiryStatusEvent.create({
        data: {
          enquiryId: input.id,
          adminId: admin.id,
          fromStatus: locked.status,
          toStatus: input.status,
        },
      });
      return { id: input.id, name: locked.name, status: input.status, changed: true };
    });

    // Chỉ log khi có chuyển thật — log nói "đã chuyển" cho một no-op là log
    // nói khác với bảng audit.
    if (result.changed) {
      this.logger.log(
        `[admin] enquiry status ${JSON.stringify({
          adminId: admin.id,
          enquiryId: input.id,
          toStatus: input.status,
        })}`,
      );
    }
    return result;
  }

  /**
   * Nối một note vào thread APPEND-ONLY. `authorId`/`authorName` lấy từ PHIÊN,
   * không bao giờ từ input — một client tự khai tên người viết là một audit
   * trail vô nghĩa. `authorName` là SNAPSHOT (cột riêng) để dòng vẫn đọc được
   * sau khi tài khoản bị xoá (`authorId` khi đó thành null qua SetNull); tên
   * vắng HOẶC RỖNG thì rơi về email (`accountDisplayName`, vòng vá review F9:
   * `??` cho `''` lọt qua, mà contract `authorName` là `min(1)` — một note
   * ghi được với tên rỗng là mọi lần đọc detail sau đó vỡ validate, vĩnh
   * viễn, vì thread không xoá được).
   *
   * MỘT câu `create`, không đọc-rồi-ghi, và trả ĐÚNG id vừa nối (vòng vá
   * review F9 — bản đầu đọc lại cả detail NGOÀI transaction, nên một
   * `NOT_FOUND` ở bước đọc biến note ĐÃ LƯU thành "the note was not saved").
   * Enquiry biến mất giữa chừng là P2003 (vi phạm khoá ngoại) chứ không phải
   * một note mồ côi — cùng tinh thần "single-statement atomic claim" của
   * ADR-0009. Không có bất biến nào khác để canh nên không cần transaction.
   *
   * Row này có HAI khoá ngoại, nên P2003 về lý thuyết cũng nổ được nếu tài
   * khoản admin bị xoá ĐÚNG giữa lúc phiên còn sống — khi đó câu trả lời
   * `NOT_FOUND` sẽ hơi lệch. Chấp nhận: phiên đã qua `AuthGuard` (đọc role
   * tươi từ DB) ngay trước đó, nên cửa sổ ấy tính bằng mili-giây, và cái giá
   * của việc nói chính xác hơn là một câu SELECT trên MỌI note được thêm.
   */
  async addNote(
    admin: { id: string; name: string | null; email: string },
    input: AdminEnquiryAddNoteInput,
  ): Promise<AdminEnquiryAddNoteResult> {
    let note: { id: string };
    try {
      note = await prisma.enquiryNote.create({
        data: {
          enquiryId: input.id,
          authorId: admin.id,
          authorName: accountDisplayName(admin),
          body: input.body,
        },
        select: { id: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_FOREIGN_KEY_VIOLATION
      ) {
        throw new EnquiryNotFoundError(input.id);
      }
      throw error;
    }

    // KHÔNG log nội dung note (spec §2.3, cùng luật payload): nó có thể chép
    // lại thông tin khách mà admin vừa gõ vào.
    this.logger.log(
      `[admin] enquiry note ${JSON.stringify({ adminId: admin.id, enquiryId: input.id })}`,
    );
    return { id: note.id };
  }

  /** Đọc detail bằng client HOẶC transaction client — service tự dùng lại. */
  private async detailRow(
    client: Pick<typeof prisma, 'enquiry'>,
    id: string,
  ): Promise<EnquiryDetailRow> {
    const row = await client.enquiry.findUnique({ where: { id }, select: DETAIL_SELECT });
    if (!row) throw new EnquiryNotFoundError(id);
    return row;
  }
}
