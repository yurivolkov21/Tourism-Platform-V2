import { z } from 'zod';
import { AdminPageQuerySchema, EmailSchema } from './common.js';

/**
 * Form liên hệ công khai (spec §4.3) — endpoint GHI đầu tiên khách CHƯA đăng
 * nhập gọi được. `tourId` optional: enquiry có thể gắn với một tour cụ thể
 * hoặc là câu hỏi chung chung.
 */
export const CreateEnquiryInputSchema = z.object({
  // min 2: chặn tên 1 ký tự — giữ parity Nexora `@MinLength(2)`.
  name: z.string().trim().min(2).max(120),
  email: EmailSchema,
  phone: z.string().trim().max(30).optional(),
  // min 10: chặn "hi"/"test" — ngưỡng Nexora dùng, giữ nguyên.
  message: z.string().trim().min(10).max(2000),
  tourId: z.uuid().optional(),
  nationality: z.string().trim().max(80).optional(),
  travelDate: z.iso.date().optional(),
  groupSize: z.int().min(1).max(100).optional(),
  budgetTier: z.string().trim().max(40).optional(),
  interests: z.array(z.string().trim().max(40)).max(20).default([]),
  /**
   * HONEYPOT — field ẩn trong form, người thật không bao giờ điền.
   *
   * Cố ý `.optional()` KHÔNG refine reject: nếu trả lỗi validate thì bot
   * biết ngay mình bị phát hiện rồi đổi chiến thuật. Controller sẽ trả 200
   * giả và KHÔNG ghi DB — bot tưởng thành công, ta không tốn một dòng nào.
   *
   * CẮT NGẮN 200 ký tự, CỐ Ý KHÔNG `.max()` reject. Đây là chuỗi do kẻ tấn
   * công điều khiển và là field user-controlled DUY NHẤT từng không có trần
   * (mọi field anh em đều có: `name` 120, `message` 2000) — không chặn thì
   * bot bơm được ~1 MB text tự chọn, kèm CR/LF giả mạo cả dòng log.
   *
   * Vì sao cắt chứ không reject: Fastify đã parse TOÀN BỘ body (tới trần
   * 1 MiB mặc định) TRƯỚC khi zod chạy, nên reject không tiết kiệm được byte
   * băng thông hay công parse nào — nó chỉ biến một 200-giả thành 400, tức
   * dựng lại đúng tín hiệu phân biệt mà honeypot sinh ra để xoá (xem
   * `EnquiryResultSchema`). Cắt ngắn chặn phơi nhiễm log y hệt mà response
   * vẫn không phân biệt được với thành công.
   */
  website: z
    .string()
    .transform((value) => value.slice(0, 200))
    .optional(),
});

export type CreateEnquiryInput = z.infer<typeof CreateEnquiryInputSchema>;

/**
 * LUÔN là một uuid — KHÔNG nullable. Nhánh honeypot cũng trả uuid (sinh bằng
 * `randomUUID()`, không bao giờ ghi xuống DB) đúng bằng lý do tồn tại của cái
 * bẫy: response phải giống hệt nhánh thành công tới từng shape, không chỉ
 * status. Trước đây field này `.nullable()` để chở `id: null` của honeypot —
 * chính chỗ đó tự khai với bot rằng nó bị bắt. Giờ `null` không còn xảy ra
 * được nữa, nên giữ `.nullable()` sẽ là hợp đồng nói dối: buộc mọi client
 * xử lý một nhánh vĩnh viễn không tồn tại.
 */
export const EnquiryResultSchema = z.object({ id: z.uuid() });

export type EnquiryResult = z.infer<typeof EnquiryResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Vùng enquiries cho ADMIN (spec P4c §3-F9) — CRM nhỏ trên chính bảng
// `enquiries` mà form công khai ở trên ghi vào. MỞ RỘNG file này chứ không
// tách file thứ hai (spec §2.1): cùng một bảng thì cùng một nhà.
//
// HAI hành vi ghi (`setStatus`, `addNote`) — vùng đầu tiên của P4c có nhiều
// hơn một (§2.2), và cả hai đều để lại VẾT quy được về người: status vào
// bảng audit `enquiry_status_events` trong CÙNG transaction với lệnh update,
// note mang `authorId`/`authorName` của phiên.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soi gương enum `EnquiryStatus` của Prisma — vòng đời một lead. Thứ tự giữ
 * đúng `schema.prisma` để tab lọc của admin liệt kê cùng thứ tự với DB (int
 * test đối chiếu hai enum bằng `Object.values`).
 *
 * Chuyển TỰ DO giữa năm giá trị (spec §3-F9): CRM nhỏ, không ép luồng —
 * một lead gọi điện xong biết luôn là LOST thì không phải bấm qua CONTACTED
 * cho đủ lễ. Dialog xác nhận nêu rõ `from → to` thay cho luật máy.
 */
export const EnquiryStatusSchema = z.enum(['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST']);
export type EnquiryStatusValue = z.output<typeof EnquiryStatusSchema>;

/**
 * Năm trạng thái ĐANG MỞ trên bàn của sales — dùng cho metric "Open now"
 * (spec §3-F9) và cho bất cứ chỗ nào hỏi "lead này còn việc không". Khai ở
 * contract để card stat (API) và câu chữ (admin) đọc CÙNG một danh sách:
 * WON/LOST là chung cuộc, ba cái còn lại là hàng chờ.
 */
export const OPEN_ENQUIRY_STATUSES = ['NEW', 'CONTACTED', 'QUOTED'] as const;

/** Trần độ dài một note CRM — soi gương `EnquiryNote.body @db.VarChar(2000)`. */
export const ENQUIRY_NOTE_MAX_LENGTH = 2000;

/**
 * Query cho `admin.enquiries.list`. Phân trang dùng chung `AdminPageQuerySchema`
 * (field gõ kiểu THUẦN — ZodSmartCoercionPlugin bên API ép "2" → 2 của query
 * string, còn typed client gửi số thật).
 *
 * `search` khớp `name` HOẶC `email` contains, không phân biệt hoa/thường —
 * hai thứ operator đang cầm khi khách gọi lại ("chị Hằng nào ấy nhỉ").
 * `tourId` là uuid của tour gắn lead: KHÔNG có ô chọn trên toolbar (quyết
 * định tự chọn F9 — chưa có endpoint list tour cho admin tới P4e), nhưng
 * URL `?tourId=…` vẫn lọc thật để trang tour của P4e nối vào là chạy ngay.
 */
export const AdminEnquiriesListQuerySchema = AdminPageQuerySchema.extend({
  status: EnquiryStatusSchema.optional(),
  search: z.string().min(1).max(120).optional(),
  tourId: z.uuid().optional(),
});
export type AdminEnquiriesListQuery = z.output<typeof AdminEnquiriesListQuerySchema>;

/**
 * Một hàng của bảng `/enquiries`. KHÔNG mang `message`/`nationality`/
 * `interests` (spec §3-F9): message tới 2000 ký tự × 20 hàng là một trang
 * nặng để hiển thị bốn dòng đầu — trang chi tiết đọc nguyên văn.
 */
export const EnquiryRowSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(120),
  email: EmailSchema,
  /** Khách không bắt buộc để lại số — null là câu trả lời thật. */
  phone: z.string().max(30).nullable(),
  /**
   * Tour mà lead hỏi — join `tour`. null khi enquiry là câu hỏi chung HOẶC
   * tour đã bị xoá (`onDelete: SetNull` trên `Enquiry.tourId`).
   */
  tourTitle: z.string().max(200).nullable(),
  /** Đi cùng `tourTitle` (cả hai có hoặc cả hai null) — admin link sang web. */
  tourSlug: z.string().max(120).nullable(),
  /** Ngày khởi hành khách MONG MUỐN — cột `date`, không có giờ. */
  travelDate: z.iso.date().nullable(),
  groupSize: z.int().min(1).max(100).nullable(),
  /** Chuỗi TỰ DO khách/form gửi lên ("luxury", "under 1000") — không có enum. */
  budgetTier: z.string().max(40).nullable(),
  status: EnquiryStatusSchema,
  createdAt: z.iso.datetime(),
  /**
   * Lần cuối row bị ghi — dùng để đọc "chạm lần cuối bao giờ", KHÔNG dùng để
   * đếm chuyển trạng thái (đó là việc của `enquiry_status_events`, spec §2.5).
   */
  updatedAt: z.iso.datetime(),
  /** `_count` của thread note — cột "Notes" là dấu hiệu lead đã có người sờ tới. */
  notesCount: z.int().nonnegative(),
});
export type EnquiryRow = z.output<typeof EnquiryRowSchema>;

/**
 * Một note CRM nội bộ. Thread APPEND-ONLY (spec §3-F9): không sửa, không xoá
 * — `authorName` là SNAPSHOT lúc ghi (cột `enquiry_notes.author_name`), nên
 * dòng vẫn đọc được sau khi tài khoản admin biến mất.
 */
export const EnquiryNoteSchema = z.object({
  id: z.uuid(),
  authorName: z.string().min(1).max(200),
  body: z.string().min(1).max(ENQUIRY_NOTE_MAX_LENGTH),
  createdAt: z.iso.datetime(),
});
export type EnquiryNoteItem = z.output<typeof EnquiryNoteSchema>;

/**
 * Một dòng audit trail đổi trạng thái (bảng `enquiry_status_events`). Khác
 * note: `adminName` đọc qua JOIN `users` chứ không snapshot (quyết định tự
 * chọn F9, cùng nếp `Review.moderatedBy`) — null khi admin đã bị xoá
 * (`adminId` SetNull) HOẶC tài khoản không có tên lẫn email đọc được.
 */
export const EnquiryStatusEventSchema = z.object({
  id: z.uuid(),
  fromStatus: EnquiryStatusSchema,
  toStatus: EnquiryStatusSchema,
  adminName: z.string().max(200).nullable(),
  createdAt: z.iso.datetime(),
});
export type EnquiryStatusEventItem = z.output<typeof EnquiryStatusEventSchema>;

/**
 * Row + phần chỉ trang chi tiết cần: nguyên văn `message`, hai field lead còn
 * lại, thread note (CŨ TRƯỚC — đọc như một cuộc trò chuyện) và lịch sử trạng
 * thái (cũ trước, cùng lý do).
 */
export const EnquiryDetailSchema = EnquiryRowSchema.extend({
  message: z.string().min(1).max(2000),
  nationality: z.string().max(80).nullable(),
  /** Multi-select TỰ DO của form công khai — mảng có thể rỗng, không có enum. */
  interests: z.array(z.string().max(40)),
  notes: z.array(EnquiryNoteSchema),
  statusEvents: z.array(EnquiryStatusEventSchema),
});
export type EnquiryDetail = z.output<typeof EnquiryDetailSchema>;

/** Input của `admin.enquiries.byId` — server action admin re-parse bằng chính schema này. */
export const AdminEnquiryByIdInputSchema = z.object({ id: z.uuid() });
export type AdminEnquiryByIdInput = z.output<typeof AdminEnquiryByIdInputSchema>;

/**
 * Input của `admin.enquiries.setStatus`. Không có ô note: audit trail ghi
 * `from → to` + ai + lúc nào, và ghi chú thì đã có thread note riêng — một ô
 * note thứ hai chỉ để "giải thích quyết định" sẽ chia đôi chỗ người ta đọc.
 */
export const AdminEnquirySetStatusInputSchema = z.object({
  id: z.uuid(),
  status: EnquiryStatusSchema,
});
export type AdminEnquirySetStatusInput = z.output<typeof AdminEnquirySetStatusInputSchema>;

/**
 * Input của `admin.enquiries.addNote`. `trim()` TRƯỚC `min(1)`: một note toàn
 * dấu cách là một dòng trống vĩnh viễn trong thread append-only, nên nó phải
 * là 400 chứ không phải một row.
 */
export const AdminEnquiryAddNoteInputSchema = z.object({
  id: z.uuid(),
  body: z.string().trim().min(1).max(ENQUIRY_NOTE_MAX_LENGTH),
});
export type AdminEnquiryAddNoteInput = z.output<typeof AdminEnquiryAddNoteInputSchema>;
