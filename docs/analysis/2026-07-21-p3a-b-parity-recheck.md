# Đối chiếu song song P3a-B — wishlist · enquiry · newsletter (21/07/2026)

Rà lại 3 module vừa hoàn thành ở P3a-B để bắt chỗ v2 (bản nâng cấp) **thụt lùi**
so với Nexora — code kém hơn, thiếu quy tắc nghiệp vụ, hoặc lỗi tiềm ẩn Nexora
không mắc. Dùng làm CHECKLIST: mục B của
[deep-sweep](2026-07-19-nexora-deep-sweep.md) + lỗi đã vá ở CHANGELOG P3a-B.

Cách làm: 3 agent song song, mỗi agent một module, mỗi agent tự đọc code hai bên
+ `schema.prisma` + migrations + contract Zod TRƯỚC khi kết luận (kỷ luật chống
dương tính giả, luật CLAUDE.md #10). Wishlist chạy thật `test:int` (114/114),
newsletter chạy `unsubscribe-token.spec` (4/4).

## Kết luận một dòng

**Không có phát hiện Quan trọng, không có Nên có.** Path ghi công khai của cả 3
module giữ ĐỦ mọi quy tắc nghiệp vụ công khai của Nexora và vượt ở nhiều điểm.
Chỉ còn **2 điểm Nhỏ** (1 quy tắc validate bị nới, 1 pattern observability) — có
thể vá gộp hoặc bỏ qua, không chặn gì. Không cần user quyết định gì trước khi
code (vì không có mục Quan trọng nào).

## Bảng phát hiện — theo mức

| # | Module | Phát hiện | Mức |
| --- | --- | --- | --- |
| N1 | enquiry | `name` nới `min 2` (Nexora `@MinLength(2)`) → `min 1` ở contract Zod | **Nhỏ** |
| N2 | cả 3 | Mất dòng log nghiệp vụ (`logger.log`) ở nhánh ghi thành công | **Nhỏ** (observability) |

Không có mục nào khác. Chi tiết + các dương tính giả đã bác ở dưới.

## N1 — enquiry `name` nới min 2 → min 1

- **Kịch bản hỏng**: `POST /api/enquiries {name:"A", email, message≥10}` → Nexora
  trả **400** (`@MinLength(2)`); v2 **nhận và lưu** lead tên 1 ký tự.
- **v2**: `libs/shared/contract/src/schemas/enquiries.ts:9` —
  `z.string().trim().min(1).max(120)`
- **Nexora**: `apps/api/src/modules/enquiry/dto/create-enquiry.dto.ts:28-29` —
  `@MinLength(2) @MaxLength(120)`
- **Đã loại trừ tầng khác**: grep `prisma/migrations/` — KHÔNG có CHECK độ dài
  `name`; rule này chỉ sống ở Zod, không bị lo trùng ở DB. Đúng là rule bị nới
  thật.
- **Tác hại**: thấp. Tên 1 ký tự vô hại về bảo mật/tiền; chỉ là một ràng buộc
  chất lượng dữ liệu Nexora có mà v2 mất. Vá nếu muốn giữ parity: đổi `.min(1)`
  → `.min(2)`.

## N2 — mất log nghiệp vụ ở nhánh ghi thành công (cross-cutting)

Cả 3 service đều bỏ dòng `logger.log(...)` Nexora ghi khi ghi thành công:

| Module | Nexora ghi gì | v2 |
| --- | --- | --- |
| wishlist | `logger.log(...)` khi add — `wishlist.service.ts:49` | không log |
| enquiry | `New enquiry {id} from {email}` — `enquiry.service.ts:86` | không log (chỉ `logger.warn` cho honeypot) |
| newsletter | `Newsletter subscribe: {email}` — `newsletter.service.ts:69` | chỉ `logger.warn` cho honeypot |

- **Kịch bản**: truy vết một lead/subscriber "mất tích" trên production — Nexora
  có dòng log tương quan `id + email` để đối soi; v2 phải query DB tay.
- **Caveat trung thực**: access-log tầng Fastify vẫn ghi `POST /api/... 200`, nên
  đây là mất log **nghiệp vụ** (id+email correlation), KHÔNG phải mất dấu request
  hoàn toàn. Vì vậy xếp **Nhỏ**, không phải Nên có.
- **Bối cảnh capstone**: không doanh thu thật, observability ưu tiên thấp. Nếu vá
  thì nên làm gộp một lần khi dựng chuẩn logging (P4/hardening), không vá lẻ.

## Dương tính giả — đã cân nhắc và BÁC BỎ (theo kỷ luật chống DTG)

- **Ảnh/thumbnail trên wishlist card** (wishlist). Nexora batch media Cloudinary
  vào mỗi wishlist row (`wishlist.service.ts:87-91`). v2 `list` không trả media.
  **Bác**: đã grep toàn contract — KHÔNG DTO nào của v2 trả ảnh, kể cả
  `TourCardSchema` của catalog (đã build). Bảng `MediaAsset` tồn tại
  (`schema.prisma:751`) nhưng chưa service nào đọc. → read-path media là **khoảng
  trống toàn app**, đồng đều catalog↔wishlist, không phải wishlist bị hạ cấp
  riêng. Ghi nhớ: khi dựng read-path media, nối lại cho wishlist bằng batch
  (tránh N+1, như `attachToOwners` của Nexora).
- **Honeypot không `.trim()`** (enquiry + newsletter). Nexora coi `website="   "`
  (toàn khoảng trắng) là rỗng → vẫn subscribe; v2 coi là bot → im lặng bỏ. **Bác**:
  field ẩn (`display:none`), form thật luôn gửi `""` → `"".length>0` là `false` ở
  CẢ HAI; ca "toàn khoảng trắng" không sinh ra được từ form → không có kịch bản
  hỏng. Thực ra v2 bắt SIÊU TẬP bot của Nexora, không bỏ sót ca nào.
- **Deep-offset pagination** (wishlist). `PageQuerySchema` chặn `pageSize` max 100
  nhưng `page` không có max. **Bác**: `skip` chỉ áp trong wishlist của CHÍNH user
  (tập nhỏ), không phải toàn bảng → không khai thác được.

## v2 tốt hơn Nexora (ghi nhận, giữ nguyên)

**wishlist**
- Cờ ngữ nghĩa `unavailable` thay vì tuồn raw `isPublished` (Nexora
  `dto/wishlist-item.dto.ts:34`) → FE không phải tự suy diễn, item chết bấm vào 404.
- Phân trang thật (page/pageSize + `total`/`totalPages`) thay `take:100` cứng
  không đếm tổng của Nexora.
- Tie-breaker `tourId` trong orderBy — Nexora chỉ `createdAt desc`, hai item trùng
  millisecond thứ tự trang không ổn định.
- `check` batch (hỏi 1 lần cho cả trang, chống N+1) — Nexora không có.
- Fail-closed auth qua guard toàn cục thay vì `if(!user)` lặp từng handler.

**enquiry**
- `email = citext` — Nexora VarChar không lowercase khiến repeat-lead
  `groupBy(['email'])` coi `Jane@x.com ≠ jane@x.com` (bug A2). v2 sửa tận DB →
  khi P4 xây repeat-lead sẽ chính xác hơn Nexora.
- Outbox kép: thêm `ENQUIRY_ADMIN_ALERT` trong CÙNG transaction (Nexora chỉ ack
  khách → admin không biết có lead cho tới khi mở CRM); `to: primaryAdminEmail`
  thắng `payload.email`, env.ts fail-fast khi `ADMIN_EMAILS` rỗng.
- Honeypot indistinguishable chặt hơn: trả uuid giả + cắt `website` 200 ký tự
  chống log-injection (Nexora `@MaxLength(200)` → reject 400 làm LỘ honeypot).

**newsletter**
- Honeypot quá dài không còn rò rỉ: Nexora `@MaxLength(200)` trên `website` → bot
  gửi >200 ký tự bị **400**, lộ chính honeypot cần giấu; v2 **cắt ngắn** → luôn
  byte-identical với ca thành công (int spec `newsletter.int.spec.ts:209-230`).
- Chống dò email mở rộng sang unsubscribe: token sai / id không tồn tại đều ném
  CÙNG `INVALID_UNSUBSCRIBE_TOKEN` → không biến endpoint thành máy dò subscriberId.
- HMAC token timing-safe + tách GET/POST chống email-client prefetch + worker
  guard bỏ qua subscriber đã huỷ nhưng VẪN gửi email giao dịch — Nexora không có.

## Kiểm chứng đã chạy

- Đọc trực tiếp code 2 bên cả 3 module (service/controller/spec/dto/module +
  admin-controller Nexora).
- Contract Zod: `libs/shared/contract/src/schemas/{wishlist,enquiries,newsletter}.ts`
  + `honeypot.spec.ts` — xác nhận `.min(10)`/`.max(20)` (enquiry), `email.max(200)`
  + `website.transform(slice 200)` (newsletter), `z.uuid()` (wishlist).
- `schema.prisma` + `grep prisma/migrations/` — xác nhận citext, composite PK
  wishlist, `Outbox.dedupeKey @unique`, và KHÔNG có CHECK độ dài `name`/`message`.
- `config/throttle.ts` (5/60s), `app.module.ts` (AuthGuard fail-closed +
  throttler default), `config/env.ts`, `worker/outbox.service.ts` (guard
  `NEWSLETTER_EMAIL_TYPES`).
- wishlist: `pnpm test:int` → **114/114 pass**, wishlist spec **6/6**.
- newsletter: `pnpm vitest run unsubscribe-token.spec.ts` → **4/4 pass**.

## Ghi chú P4 (không phải phát hiện — chuẩn bị port)

- **enquiry admin**: Nexora có `findAllForAdmin`, `updateStatus` (pipeline CRM),
  notes CRM snapshot `authorName`, repeat-lead `groupBy`. v2 đã có hạ tầng
  (`EnquiryNote`, enum `EnquiryStatus`, index `[status,createdAt]`/`[email]`,
  `email citext`) — khi P4 xây, repeat-lead chính xác hơn Nexora.
- **newsletter admin**: Nexora sort `subscribedAt` + hard-delete; v2 đổi tên cột
  `createdAt` + soft `unsubscribedAt` → admin list/delete phải viết lại theo mô
  hình mới, KHÔNG port thẳng.
