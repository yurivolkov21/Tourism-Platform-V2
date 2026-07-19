# Schema Audit — Nexora (27 model) → quyết định tối ưu cho v2

- **Ngày:** 2026-07-18 · **Trạng thái:** đã audit, chờ duyệt cùng spec P1
- **Phương pháp:** 4 lượt audit độc lập theo nhóm domain (catalog · money-path ·
  CRM/content · media/infra/identity), mỗi finding đối chiếu schema với **query
  thật trong code** (where/orderBy từng module), CHANGELOG và ADR liên quan.
- **Kết luận tổng:** schema Nexora **nền tảng vững** (tiền = Decimal chuẩn, M:N
  đúng, idempotency đúng, enum có kiểu) — port làm gốc, áp các tối ưu dưới đây.

## ⚠️ Phát hiện quan trọng nhất (xuyên suốt)

**`apps/api/prisma/hardening.sql` nằm NGOÀI schema Prisma** — chứa CHECK
constraints (seats_booked ≤ seats_total, rating 1–5, total_amount ≥ 0), citext
cho email, và RLS trên 15 bảng. Prisma không biểu diễn được → **port schema mà
quên file này là mất toàn bộ bất biến chống oversell/drift một cách im lặng.**
V2: port hardening.sql thành migration đầu tiên sau schema, bổ sung RLS cho
`cancellation_requests` (Nexora sót — file viết trước khi model ra đời).

## Các thay đổi schema cho v2 (đã quyết theo audit)

### HIGH — sửa trước khi port

| # | Thay đổi | Lý do (bằng chứng) |
| --- | --- | --- |
| H1 | **Bảng `Refund` ledger mới** (bookingId · amount · currency · providerRefundId · adminId · createdAt), thay cụm 4 column nullable `refunded*` trên Booking | Auto-refund paths hiện set `REFUNDED` mà bỏ trống `refundedAmount/refundedAt` → admin hiển thị lệch (cùng lớp bug "38-vs-37" 17/07); partial refund hiện one-shot không cộng dồn; ledger sửa cả hai + thành audit trail thật |
| H2 | **CHECK ràng buộc status↔audit** trong hardening v2: `REFUNDED ⇒ refunded_at NOT NULL` (qua ledger: status suy từ SUM(refunds)) | Chặn tận DB lớp drift trên |
| H3 | **Booking snapshot thêm** `tourTitle`, `departureStartDate/EndDate`, `unitPrice` lúc create | Hiện title/ngày join LIVE → sửa tour là booking lịch sử đổi hiển thị hồi tố (giá+currency đã snapshot, title/ngày thì chưa) |
| H4 | **PaymentEvent thêm** `amount Decimal(14,2)?` · `currency?` · `bookingId? @db.Uuid` + `@@index([bookingId])`, `@@index([provider, receivedAt])`; bỏ `@@index([type])` | Forensics tiền hiện phải parse JSON payload mỗi request (cả bookingId!); index `[type]` chết vì query dùng `contains` |
| H5 | **User merge vào bảng Better Auth**: bỏ `supabaseId` + toàn bộ sync-shim; map `fullName`→`name`; giữ `phone` (nới 20→30) + `role` làm additionalFields; bỏ `locale` (column chết); cấu hình BA dùng uuid PK; EMAIL_CHANGED enqueue chuyển sang BA hook (giữ dedupeKey uuid tươi); giữ dual-grant admin (env bootstrap + role DB) | Toàn bộ plumbing Supabase chết theo auth cũ |
| H5b | **Soft delete cho User (tombstone + scrub PII)** — quyết 18/07 sau thảo luận: thêm `deletedAt DateTime?` (bảng DUY NHẤT có soft delete); BA `beforeDelete` hook → set deletedAt + scrub `name/phone → null`, `email → deleted+<uuid>@tombstone.local` (giải phóng email cho đăng ký lại, unique giữ nguyên); xóa cứng session/account BA; **mọi FK giữ nguyên Restrict/nguyên trạng** (row còn sống → hết xung đột BA-delete); KHÔNG soft-delete bảng khác (Booking/PaymentEvent không bao giờ xóa; Tour/Post đã có isPublished/status; Media có GC riêng) | Giải trọn xung đột BA user-delete vs FK Restrict; không mất dữ liệu; tôn trọng ý định ẩn danh của người xóa tài khoản |
| H6 | **Chat retention**: cron purge hội thoại cũ (ưu tiên guest `userId IS NULL`) + `@@index([updatedAt])` trên ChatConversation; ownership gate chuyển từ JWT Supabase sang BA session | Hiện không có bất kỳ cơ chế dọn nào — guest threads tích lũy vĩnh viễn |

### MED — đáng làm trong P1

| # | Thay đổi | Lý do |
| --- | --- | --- |
| M1 | `Review` theo tombstone User (thay thế đề xuất SetNull cũ): giữ `userId` FK nguyên; thêm **`authorDeleted Boolean @default(false)`** (denormalized, bật qua `updateMany` lúc soft-delete user) + index `[tourId, isApproved, authorDeleted, createdAt desc]`; hiển thị `authorDeleted ? "Deleted account" : authorName`; sort công khai `[authorDeleted asc, createdAt desc]` — review khuyết danh tự đẩy xuống dưới, chạy trên index không cần join User | Review + rating giữ cho aggregate; danh tính ẩn đúng ý định người xóa (hơn phương án giữ authorName snapshot); UX ưu tiên review có danh tính |
| M2 | `Subscriber.email` → `@db.Citext`; `subscribedAt` → `createdAt` | Dedupe hiện chỉ nhờ service lowercase — lệch chuẩn ADR-0008 (User.email đã citext); thống nhất naming |
| M3 | **Bộ sửa index** (theo query thật): Tour +`[categoryId]`; TourDestination −`[tourId]` (trùng PK); TourDeparture −`[status]` (không ai dùng); TourPolicy `[tourId,kind]`→`[tourId,order]` (kind chưa từng là predicate); Review +`[tourId,isApproved,createdAt desc]`; Booking +`[userId,createdAt]`; MediaAsset +`[publicId]` +`[posterId]` (hot-path GC ADR-0011 đang seq-scan!) +`[ownerType,createdAt]` (admin library) | Mỗi mục đều có bằng chứng where/orderBy trong code |
| M4 | `Tour.difficulty String?` → **enum `TourDifficulty`** | DTO chỉ validate MaxLength — chuỗi 30 ký tự nào cũng lọt |
| M5 | **Outbox retention**: cron xóa `SENT` cũ hơn N ngày; giữ FAILED để triage; **văn bản hóa quy ước dedupeKey** `<event>:<entityId>[:<state>]`, uuid suffix chỉ cho event lặp hợp lệ | Bảng lớn vô hạn; bug 16/07 do quy ước ngầm |
| M6 | Money scale `Decimal(12,2)` → **`Decimal(14,2)`** | Headroom cho zero-decimal currencies (VND ~10 tỷ là chạm trần 12,2); giữ nguyên kiểu Decimal — KHÔNG đổi sang Int cents |
| M7 | CancellationRequest: giữ `@unique(bookingId)` nhưng quyết định DENIED→re-request **không ghi đè** audit cũ (child `CancellationDecision` hoặc partial unique `WHERE status='REQUESTED'`) | Hiện resubmit xóa dấu vết lần từ chối trước |
| M8 | ChatMessage thêm `tokensIn/tokensOut` (Int) nếu muốn spend-cap/analytics thật | Cap hiện chỉ đếm số message, không đo chi phí |

### LOW — tiện tay thì làm

- PK **uuidv7** cho các bảng phân trang theo thời gian (Review, Enquiry, EnquiryNote, Subscriber, Post) — Prisma 7 hỗ trợ, lợi index locality
- `Enquiry.budgetTier` → enum; enum `MediaRole` đổi UPPER_SNAKE cho nhất quán; `MediaGarbage.resourceType` align với `MediaType`
- Booking search admin (`contains`) → pg_trgm GIN khi cần; tương tự Tour search
- Destination `@@index([isActive])` giá trị thấp — cân nhắc bỏ

## Giữ nguyên có chủ đích (đừng "tối ưu nhầm")

- **Tiền = `Decimal` + currency per-row, không FX** (ADR-0010) — KHÔNG đổi sang Int cents
- **Post.content = markdown text** — KHÔNG "nâng cấp" thành Json blocks (quyết định có chủ đích của blog-v2)
- `publicId` unique **per-owner** chứ không global (reuse picker ADR-0011)
- ChatMessage ordering bằng `seq` + `@@unique([conversationId,seq])` — đúng thiết kế
- Idempotency `@@unique([provider,eventId])` + semantics `processedAt NULL` — port nguyên
- Outbox/MediaGarbage dùng `gen_random_uuid()` DB-side (phục vụ raw-SQL CTE) — giữ, verify hành vi `dbgenerated` trên Prisma 7
- ⚠️ Thứ tự alphabet enum `ReviewSource` (`CURATED < VERIFIED`) đang gánh logic sort testimonials — nếu đổi tên value phải sửa query kèm theo

## Verdict từng model (tóm tắt)

| Nhóm | PORT AS-IS | OPTIMIZE | Đặc biệt |
| --- | --- | --- | --- |
| Catalog | TourCategory · Destination · TourItineraryDay · TourFaq | Tour · TourDestination · TourDeparture · TourPolicy | — |
| Money | CancellationRequest | Booking · PaymentEvent | + bảng `Refund` mới |
| CRM/Content | Wishlist · Enquiry · EnquiryNote · Post · PostTag · PostTagLink · PostTour | Review · Subscriber | — |
| Media/Infra | Outbox · MediaGarbage · SiteMediaSlot | MediaAsset · ChatConversation · ChatMessage | User = MERGE PLAN (Better Auth) |

**Column chết duy nhất toàn schema:** `User.locale` (ghi default, không bao giờ đọc) → bỏ.
