import { z } from 'zod';
import { PagedSchema } from './catalog.js';
import { AdminPageQuerySchema, EmailSchema } from './common.js';

/**
 * Đăng ký nhận bản tin (spec §4.4, nửa đầu) — endpoint GHI công khai thứ hai
 * khách CHƯA đăng nhập gọi được, cùng khuôn chống spam với enquiry (Task 4):
 * honeypot không reject, throttle riêng theo IP.
 */
export const SubscribeInputSchema = z.object({
  email: EmailSchema,
  source: z.string().trim().max(40).optional(),
  /**
   * HONEYPOT — cùng cơ chế với enquiry: không reject, controller trả kết quả
   * GIẢ giống hệt thành công để bot không phân biệt được.
   *
   * CẮT NGẮN 200 ký tự (KHÔNG `.max()` reject) — cùng lý do như `website` bên
   * enquiry: Fastify đã parse hết body trước khi zod chạy nên reject không
   * tiết kiệm gì, chỉ biến 200-giả thành 400 và dựng lại đúng tín hiệu phân
   * biệt mà honeypot sinh ra để xoá. Cắt ngắn chặn phơi nhiễm log y hệt.
   */
  website: z
    .string()
    .transform((value) => value.slice(0, 200))
    .optional(),
});

export type SubscribeInput = z.infer<typeof SubscribeInputSchema>;

/**
 * Output LUÔN `{subscribed: true}`, kể cả email đã tồn tại hoặc bị honeypot
 * bắt. Đây là chống dò email: nếu response khác nhau giữa "mới" và "đã có",
 * ai cũng dùng endpoint này để kiểm tra một địa chỉ có trong hệ thống hay
 * không.
 */
export const SubscribeResultSchema = z.object({ subscribed: z.literal(true) });

export type SubscribeResult = z.infer<typeof SubscribeResultSchema>;

/**
 * Huỷ đăng ký bản tin (spec §4.4, nửa sau) — v2 làm hơn Nexora (Nexora không
 * có unsubscribe công khai, rủi ro pháp lý GDPR/CAN-SPAM). Input DÙNG CHUNG
 * cho cả GET xác nhận lẫn POST thực thi: `id` (subscriberId) + `token` (HMAC
 * tự xác thực, xem `unsubscribe-token.ts`) — cả hai đều lấy thẳng từ link
 * trong email, không cần đăng nhập.
 */
export const UnsubscribeInputSchema = z.object({
  id: z.uuid(),
  token: z.string().min(1).max(200),
});

export type UnsubscribeInput = z.infer<typeof UnsubscribeInputSchema>;

/**
 * Output của GET — dữ liệu cho trang xác nhận, KHÔNG tự huỷ đăng ký (email
 * client như Gmail/Outlook prefetch mọi link trong thư để quét virus; nếu GET
 * tự huỷ thì khách bị huỷ mà chưa hề bấm gì). `alreadyUnsubscribed` cho FE đổi
 * copy nút khi khách bấm lại link cũ sau khi đã huỷ rồi.
 */
export const UnsubscribeConfirmResultSchema = z.object({
  email: z.string(),
  alreadyUnsubscribed: z.boolean(),
});

export type UnsubscribeConfirmResult = z.infer<typeof UnsubscribeConfirmResultSchema>;

/** Output của POST — luôn `true` khi thành công, kể cả gọi lần hai (idempotent). */
export const UnsubscribeResultSchema = z.object({ unsubscribed: z.literal(true) });

export type UnsubscribeResult = z.infer<typeof UnsubscribeResultSchema>;

/**
 * Đăng ký LẠI sau khi đã huỷ (vá review Task 6 — Khoản 1: "đăng ký lại sau
 * khi huỷ là ngõ cụt câm lặng"). Kịch bản: khách huỷ → đổi ý → tự điền lại
 * form subscribe → `subscribe()` cố tình KHÔNG reset `unsubscribedAt` (chống
 * đăng ký hộ người lạ khi hệ thống chưa có double opt-in, xem JSDoc
 * `NewsletterService.subscribe`) → khách không bao giờ nhận gì và không có
 * đường tự sửa.
 *
 * Input DÙNG LẠI NGUYÊN `UnsubscribeInputSchema` (không tạo schema mới trùng
 * shape): chính token HMAC của unsubscribe (`id` + `token`) chứng minh người
 * bấm thật sự cầm link gửi tới hộp thư đó — thay thế cho double opt-in mà v2
 * chưa xây.
 */
export const ResubscribeInputSchema = UnsubscribeInputSchema;

export type ResubscribeInput = z.infer<typeof ResubscribeInputSchema>;

/**
 * Output — LUÔN `{subscribed:true}` sau khi token hợp lệ, DÙNG LẠI đúng
 * `SubscribeResultSchema` (cùng shape, cùng tinh thần chống dò: không tiết lộ
 * subscriber đang active hay vừa được reset).
 */
export const ResubscribeResultSchema = SubscribeResultSchema;

export type ResubscribeResult = z.infer<typeof ResubscribeResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Vùng subscribers cho ADMIN (spec P4c §3-F10) — bề mặt ĐỌC + MỘT hành vi ghi
// trên chính bảng `subscribers` mà form footer CÔNG KHAI ở trên ghi vào. MỞ
// RỘNG file này chứ không tách file thứ hai (spec §2.1): cùng một bảng thì
// cùng một nhà.
//
// Bảng này có BA kẻ ghi và chỉ MỘT trong ba là admin (`subscribe` của form
// footer · `unsubscribe`/`resubscribe` của đường HMAC trong email khách ·
// `admin.subscribers.unsubscribe` dưới đây). Hệ quả ghi ở đúng hai chỗ nó
// đổi hành vi: stats vùng này KHÔNG cache theo tag phía admin (JSDoc
// `fetchAdminSubscribersStats`), và metric `unsubscribed` KHÔNG bất động
// (JSDoc `AdminSubscribersStatsSchema`).
//
// KHÔNG có `resubscribe` phía admin (spec §3-F10): consent phải đến từ chính
// chủ hộp thư — đường duy nhất đăng ký lại là link HMAC trong email của họ
// (`ResubscribeInputSchema` ở trên). Không có xoá (spec §2.4): huỷ là set
// `unsubscribedAt`, giữ mốc rút consent làm bằng chứng.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trần độ dài `source` — soi gương cột `Subscriber.source @db.VarChar(40)`,
 * cùng con số mà `SubscribeInputSchema.source` đã dùng cho đường ghi. Khai
 * thành hằng vì admin cũng phải clamp ô lọc theo đúng trần ấy (chuỗi dài hơn
 * là 400 chứ không phải "không khớp hàng nào").
 */
export const SUBSCRIBER_SOURCE_MAX_LENGTH = 40;

/**
 * Query cho `admin.subscribers.list`. Phân trang dùng chung
 * `AdminPageQuerySchema` (field gõ kiểu THUẦN — ZodSmartCoercionPlugin bên
 * API ép "2" → 2 và "true" → true của query string, còn typed client gửi giá
 * trị thật).
 *
 * `active` là cờ BA TRẠNG THÁI, không phải hai: `true` = còn nhận tin
 * (`unsubscribedAt` null), `false` = đã huỷ, VẮNG = mọi row. Ba tab của trang
 * đọc thẳng ba trạng thái đó. Khác `unprocessed` của payment events (cờ bật/
 * tắt, tắt thì không ghi lên URL): ở đây "đã huỷ" là một tập người ta thật sự
 * muốn xem — danh sách người vừa rời đi — nên nó phải nói được thành URL.
 *
 * `search` khớp `email` contains, không phân biệt hoa/thường. `email` là cột
 * `citext` nên phép SO BẰNG vốn đã không phân biệt hoa/thường, nhưng
 * `contains` sinh `LIKE` — `mode: 'insensitive'` mới là thứ biến nó thành
 * `ILIKE` (xem `AdminSubscribersService.list`).
 *
 * `source` là chuỗi TỰ DO như cột (varchar): Select của admin liệt kê đúng
 * các giá trị `sources` mà chính response trả về, nhưng `?source=` gõ tay
 * ngoài danh sách ấy vẫn lọc thật — cùng luật với filter `type` của payment
 * events.
 */
export const AdminSubscribersListQuerySchema = AdminPageQuerySchema.extend({
  active: z.boolean().optional(),
  search: z.string().min(1).max(120).optional(),
  source: z.string().min(1).max(SUBSCRIBER_SOURCE_MAX_LENGTH).optional(),
  /**
   * Có tính `sources` (GROUP BY toàn bảng) không — cùng khuôn `includeMedia`
   * của bookings (vòng vá review F10): vòng export gọi list 20 lượt và vứt
   * `sources` của từng trang, mỗi lượt là một lần quét cột không index lên DB
   * dùng chung đường khách. Tắt thì `sources` là mảng rỗng. Mặc định bật cho
   * trang bảng — nơi duy nhất cần nó.
   */
  includeSources: z.boolean().default(true),
});
export type AdminSubscribersListQuery = z.output<typeof AdminSubscribersListQuerySchema>;

/**
 * Một hàng của bảng `/subscribers` — đúng năm field, không hơn.
 *
 * KHÔNG mang `updatedAt`: cột đó là `@updatedAt`, tức mọi lệnh ghi đều đè,
 * nên nó không trả lời được câu hỏi nào mà `createdAt`/`unsubscribedAt`
 * chưa trả lời rõ hơn (bài học `EnquiryRow.updatedAt` — chở một mốc "chạm
 * lần cuối" xuống bảng là mời người đọc dùng nó để đếm chuyện đã xảy ra).
 *
 * `email` dùng `EmailSchema` như `EnquiryRowSchema`: mọi kẻ ghi cột này đều
 * đã đi qua chính schema ấy ở đường công khai, và lệnh ghi của admin
 * (`unsubscribe`) KHÔNG bao giờ đụng tới `email` — nên không có đường nào để
 * admin tự tạo ra một hàng mà chính mình không đọc lại được.
 */
export const SubscriberRowSchema = z.object({
  id: z.uuid(),
  email: EmailSchema,
  /**
   * Nơi địa chỉ này đăng ký. null là câu trả lời PHỔ BIẾN, không phải ca lạ:
   * form footer của web hiện gọi `subscribe({ email })` không kèm `source`,
   * nên mọi hàng có thật tới hôm nay đều null. Cột tồn tại cho các đường đăng
   * ký sau này (landing page, popup) tự khai chỗ đứng của mình.
   */
  source: z.string().max(SUBSCRIBER_SOURCE_MAX_LENGTH).nullable(),
  createdAt: z.iso.datetime(),
  /**
   * Mốc khách RÚT CONSENT — null nghĩa là còn nhận tin. Đây là bằng chứng
   * pháp lý (GDPR/CAN-SPAM), lý do v2 soft-unsubscribe thay vì xoá hàng như
   * Nexora (xem comment trên cột ở `schema.prisma`).
   */
  unsubscribedAt: z.iso.datetime().nullable(),
});
export type SubscriberRow = z.output<typeof SubscriberRowSchema>;

/**
 * Output của `admin.subscribers.list`: một trang chuẩn CỘNG danh sách nguồn.
 *
 * Vì sao `sources` đi kèm trang thay vì một Select hardcode ở admin (quyết
 * định tự chọn F10): `source` là chuỗi tự do do đường ghi tự khai, và hôm nay
 * KHÔNG đường nào khai cả — một Select viết cứng ('footer', 'popup'…) sẽ là
 * một danh sách mà mọi mục đều trả 0 hàng, tức một control nói dối ngay ngày
 * đầu. Đọc distinct từ chính bảng thì Select luôn đúng: rỗng thì trang không
 * vẽ control nào, và ngày một landing page bắt đầu gửi `source` thì mục mới
 * tự xuất hiện, không phải sửa code ở hai repo.
 *
 * Vì sao là FIELD THÊM của list chứ không phải endpoint thứ hai: nó là siêu
 * dữ liệu của CHÍNH tập đang xem, và một endpoint riêng nghĩa là trang phải
 * chờ thêm một round-trip cho một mảng vài phần tử.
 *
 * Danh sách tính trên TOÀN bảng, KHÔNG theo bộ lọc đang áp — một Select tự
 * cắt bỏ các lựa chọn khác ngay khi vừa chọn một cái là một ngõ cụt (chọn
 * xong không đổi sang nguồn khác được nữa). Hàng `source` null KHÔNG có mặt
 * ở đây: "không khai nguồn" không phải một nguồn để lọc theo.
 */
export const AdminSubscribersListResultSchema = PagedSchema(SubscriberRowSchema).extend({
  sources: z.array(z.string().min(1).max(SUBSCRIBER_SOURCE_MAX_LENGTH)),
});
export type AdminSubscribersListResult = z.output<typeof AdminSubscribersListResultSchema>;

/** Input của `admin.subscribers.unsubscribe` — server action admin re-parse bằng chính schema này. */
export const AdminSubscriberUnsubscribeInputSchema = z.object({ id: z.uuid() });
export type AdminSubscriberUnsubscribeInput = z.output<
  typeof AdminSubscriberUnsubscribeInputSchema
>;

/**
 * Kết quả `admin.subscribers.unsubscribe` — CHỈ những gì lệnh vừa sinh ra
 * (nếp F9: lệnh ghi trả kết quả gọn, không chở cả row qua dây để client ném
 * đi). Email đã nằm sẵn ở hàng bảng mà admin vừa bấm, nên đọc lại nó chỉ để
 * in vào toast là một round-trip cho một chuỗi client đang cầm.
 *
 * `unsubscribedAt` là mốc CHÍNH CÂU `updateMany` đã ghi, không phải một lượt
 * đọc lại: guard `unsubscribedAt: null` nghĩa là đúng một câu UPDATE thắng
 * được, nên giá trị nó đặt cũng là giá trị đang nằm trong hàng. Đây là dòng
 * consent vừa được ghi vào sổ — thứ duy nhất lệnh này tạo ra, và là thứ toast
 * kể lại.
 */
export const AdminSubscriberUnsubscribeResultSchema = z.object({
  id: z.uuid(),
  unsubscribedAt: z.iso.datetime(),
});
export type AdminSubscriberUnsubscribeResult = z.output<
  typeof AdminSubscriberUnsubscribeResultSchema
>;
