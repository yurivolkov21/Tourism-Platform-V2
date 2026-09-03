import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminEnquiriesListQuery,
  AdminEnquiryAddNoteInput,
  AdminEnquirySetStatusInput,
  EnquiryDetail,
  EnquiryRow,
  Paged,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { EnquiryStatus } from '../../generated/prisma/enums.js';
import { toPaged } from '../../lib/paged.js';
import { type EnquiryDetailRow, toEnquiryDetail, toEnquiryRow } from './enquiry-row.js';

export class EnquiryNotFoundError extends Error {
  constructor(id: string) {
    super(`Enquiry ${id} not found`);
    this.name = 'EnquiryNotFoundError';
  }
}

/** SQLSTATE Prisma cho "vi phạm khoá ngoại" — note trỏ tới enquiry không còn. */
const PRISMA_FOREIGN_KEY_VIOLATION = 'P2003';

/**
 * Cột của một hàng bảng. KHÔNG kéo `message` (tới 2000 ký tự × 20 hàng chỉ để
 * hiện bốn dòng đầu) lẫn `interests` — trang chi tiết đọc nguyên văn.
 * `_count.notes` là cột "Notes": dấu hiệu lead đã có người sờ tới.
 */
const LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  tour: { select: { title: true, slug: true } },
  travelDate: true,
  groupSize: true,
  budgetTier: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { notes: true } },
} satisfies Prisma.EnquirySelect;

/**
 * Thêm phần chỉ trang chi tiết cần. Cả hai danh sách sắp CŨ TRƯỚC
 * (`createdAt asc`, `id` phụ cho hai row cùng mili-giây): thread note đọc như
 * một cuộc trò chuyện, còn lịch sử trạng thái đọc như một dòng thời gian —
 * đảo lại là bắt người đọc dựng ngược câu chuyện trong đầu.
 */
const DETAIL_SELECT = {
  ...LIST_SELECT,
  message: true,
  nationality: true,
  interests: true,
  notes: {
    select: { id: true, authorName: true, body: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
  statusEvents: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      createdAt: true,
      // `adminName` đọc qua JOIN chứ không snapshot — xem JSDoc `enquiry-row.ts`.
      admin: { select: { name: true, email: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.EnquirySelect;

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
   * nó thành `ILIKE`, cần cho CẢ HAI cột. LIKE hai đầu không dùng được index
   * nào; bảng này lớn theo số lead nên ghi sổ cùng ngưỡng ~10k của
   * `StatsService` (JSDoc mục Index).
   */
  async list(query: AdminEnquiriesListQuery): Promise<Paged<EnquiryRow>> {
    const { page, limit, status, search, tourId } = query;
    const where: Prisma.EnquiryWhereInput = {
      ...(status ? { status } : {}),
      ...(tourId ? { tourId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
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
   * "có người bấm nút").
   */
  async setStatus(
    admin: { id: string; name: string | null },
    input: AdminEnquirySetStatusInput,
  ): Promise<EnquiryDetail> {
    const detail = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ status: EnquiryStatus }[]>(Prisma.sql`
        SELECT status FROM enquiries WHERE id = ${input.id}::uuid FOR UPDATE
      `);
      if (!locked) throw new EnquiryNotFoundError(input.id);

      if (locked.status !== input.status) {
        await tx.enquiry.update({ where: { id: input.id }, data: { status: input.status } });
        await tx.enquiryStatusEvent.create({
          data: {
            enquiryId: input.id,
            adminId: admin.id,
            fromStatus: locked.status,
            toStatus: input.status,
          },
        });
      }
      // Đọc lại TRONG transaction: detail trả về chắc chắn đã mang dòng vừa
      // nối, không phụ thuộc một request refresh nào chạy sau.
      return this.detailRow(tx, input.id);
    });

    this.logger.log(
      `[admin] enquiry status ${JSON.stringify({
        adminId: admin.id,
        enquiryId: input.id,
        toStatus: input.status,
      })}`,
    );
    return toEnquiryDetail(detail);
  }

  /**
   * Nối một note vào thread APPEND-ONLY. `authorId`/`authorName` lấy từ PHIÊN,
   * không bao giờ từ input — một client tự khai tên người viết là một audit
   * trail vô nghĩa. `authorName` là SNAPSHOT (cột riêng) để dòng vẫn đọc được
   * sau khi tài khoản bị xoá (`authorId` khi đó thành null qua SetNull); tên
   * vắng thì rơi về email — thread không bao giờ có dòng "ai đó đã viết".
   *
   * MỘT câu `create`, không đọc-rồi-ghi: enquiry biến mất giữa hai câu là
   * P2003 (vi phạm khoá ngoại) chứ không phải một note mồ côi — cùng tinh
   * thần "single-statement atomic claim" của ADR-0009. Không có bất biến nào
   * khác để canh nên không cần transaction.
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
  ): Promise<EnquiryDetail> {
    try {
      await prisma.enquiryNote.create({
        data: {
          enquiryId: input.id,
          authorId: admin.id,
          authorName: admin.name ?? admin.email,
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
    return this.byId(input.id);
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
