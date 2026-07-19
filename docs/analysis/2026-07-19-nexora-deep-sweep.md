# Quét sâu Nexora — kết quả đầy đủ (19/07/2026)

Đọc kỹ 1.377 file của Nexora chia 4 mũi: `common/lib/config/app/prisma` ·
15 module nghiệp vụ · `libs/` · `apps/web`. Nối tiếp
[infra-parity](2026-07-19-infra-parity-nexora.md) (8 lỗ hạ tầng, #1–#4 đã vá
ở `b407c68`).

## A. Lỗ trong code v2 ĐÃ xây — cần vá

Xếp theo giá trị / chi phí.

| # | Lỗ | Chi tiết | Mức |
| --- | --- | --- | --- |
| A1 | **Rating đã có nhưng chưa "cắm dây"** | P3a xây `Tour.ratingAvg/ratingCount` + transaction duyệt review xử lý race rất kỹ — nhưng `toTourCard()`/`getTourBySlug()` (`catalog.service.ts:42-58,108-158`) **không select, không trả**, và `TourCardSchema`/`TourDetailSchema` không khai trường rating nào. Dữ liệu nằm sẵn trong DB mà FE không đọc được | **Quan trọng** — sửa rẻ, giá trị cao |
| A2 | **Tour card thiếu next-departure** | Nexora `attachNextDeparture` (`tours.service.ts:268-302`) đưa `nextDepartureDate`/`nextDepartureSeatsLeft` lên MỌI card, phục vụ badge "Chỉ còn N chỗ". v2 chỉ có `departures[]` trong detail, card không có tín hiệu nào | Quan trọng |
| A3 | **Khách không tự huỷ được booking PENDING** | Nexora `cancelOwnPending` (`bookings.service.ts:552-567`) flip thẳng CANCELLED, không cần admin (chưa trả tiền nên không refund). v2 route `bookings.cancel` đi thẳng vào `CancellationsService.request` — chặn cứng `!== PAID` → 422. Khách đổi ý trước khi trả tiền không có đường dọn | Nên có |
| A4 | **Không có Admin Outbox** | Nexora có `GET /admin/outbox`, `POST /:id/retry` (chỉ FAILED→PENDING), `DELETE /:id` (chặn xoá SENT). v2 không có gì. Một row FAILED (hết `MAX_ATTEMPTS=5`) — ví dụ email xác nhận booking — **kẹt vĩnh viễn**, chỉ phát hiện được bằng cách đọc log hoặc vào DB tay | Quan trọng (P4) |
| A5 | **Guard mặc định fail-OPEN** | Nexora đăng ký `APP_GUARD` toàn cục + `@Public()` opt-out → route mới sinh ra mặc định AN TOÀN. v2 auth là opt-in từng controller. Hiện 10 controller đều đúng, nhưng sang P4/P5/P6 chỉ cần quên một `@UseGuards` là route nhạy cảm public hoàn toàn — không compiler/lint/test nào bắt | Quan trọng (trước P4) |
| A6 | **Admin thiếu công cụ điều tra** | Không lọc được booking theo `tourId`/`departureId`/`userId`; detail thiếu `otherBookings` + `paymentEvents`; **không có admin payment-events viewer nào** — webhook lỗi chỉ tra được bằng query DB tay | Nên có (P4) |
| A7 | **Prisma nằm ngoài lifecycle Nest** | `export const prisma = new PrismaClient()` module-level, không phải Nest provider → không `$connect()` eager (DATABASE_URL sai chỉ vỡ ở request đầu thay vì lúc boot), không `$disconnect()` khi SIGTERM (pool ~10 connection, redeploy liên tục dễ áp trần) | Nên có |
| A8 | **Không có `EMAIL_REPLY_TO`** | Nexora gắn `replyTo` vào mọi email; template mời khách "trả lời email này". v2 không có → khách reply bay vào `noreply@` | Nhỏ |
| A9 | **Category list thiếu `toursCount`** | Destination CÓ `tourCount`, category thì không — bất đối xứng giữa hai lookup cùng loại | Nhỏ |
| A10 | **`numAdults`/`numChildren` không có cận trên** | Nexora `@Max(20)`. v2 chỉ `.min(1)`/`.min(0)`, không CHECK bù. Chỉ bị chặn gián tiếp qua sức chứa departure | Nhỏ |
| A11 | **`EMAIL_FROM` không validate định dạng** | Nexora có regex bắt `addr@domain` hoặc `Name <addr@domain>` fail-fast lúc boot. v2 chỉ `.min(1)` → gõ sai chỉ vỡ ở lần gửi mail thật đầu tiên | Nhỏ |

### Dương tính giả — đã kiểm chứng và BÁC BỎ

`seatsLeft` không clamp về 0 (`catalog.service.ts:153`). Agent báo Quan
trọng vì `TourDepartureSchema.seatsLeft` khai `nonnegative()` nên giá trị âm
sẽ làm oRPC reject cả response. **Nhưng CHECK constraint
`departures_seats_within_total`** (migration `hardening`, P1) khiến
`seats_booked > seats_total` không thể tồn tại — đã thử UPDATE trực tiếp
trên DB và bị chặn. Nexora cần clamp runtime vì thiếu ràng buộc đó; v2 ép ở
tầng DB nên chặt hơn. Thêm `Math.max(0, …)` sẽ là code chết và còn che mất
vi phạm bất biến nếu có.

## B. Ghi chú cho phase sau

### P3a W2–W6 — quy tắc nghiệp vụ Nexora cần giữ

- **wishlist**: khoá composite `(userId, tourId)`, add là **upsert idempotent** (thêm lại → 200 no-op, không 409), remove dùng `deleteMany` (xoá thứ không tồn tại → 204). Chỉ cho thêm tour `isPublished`.
- **enquiry**: honeypot field `website` → **âm thầm trả 201 và KHÔNG lưu** (bot không biết bị chặn). `message` min 10 ký tự, `interests` max 20 phần tử. Note CRM snapshot `authorName` lúc ghi để thread còn đọc được khi admin bị xoá. Repeat-lead count degrade về 1 nếu groupBy lỗi, không làm sập list.
- **newsletter**: dedupe **silent by design** — đăng ký lại email đã có trả response GIỐNG HỆT lần đầu (chống dò email). Welcome email `dedupeKey = newsletter-welcome:<email>` → chỉ gửi MỘT LẦN trong đời địa chỉ đó. Nexora **không có** self-serve unsubscribe — v2 đã chốt thêm (spec P3a W4).
- **posts**: `publishedAt` chỉ stamp LẦN ĐẦU chuyển PUBLISHED, giữ nguyên ở các lần sửa sau. Đặt `publishedAt` tương lai = **lên lịch đăng** (reader filter `<= now`, không cần cron). Tag replace-all khi field được truyền, `undefined` thì giữ nguyên. Related tours tối đa 3, giữ thứ tự mảng input. Cover media replace-all nhưng **preserve** role `body`.
- **site-media**: 9 slot hard-code trong `slot-catalog.ts`, `single` (1 ảnh, role `hero`) vs `gallery` (max 8, role `gallery`), chỉ nhận IMAGE. Set rỗng `[]` là **hợp lệ = reset về default**. Public list chỉ trả slot CÓ media; admin list luôn trả đủ 9 slot.
- **Email chưa nối dây**: `resend.deliverer.ts` đã render đủ `ENQUIRY_RECEIVED`, `NEWSLETTER_WELCOME`, `EMAIL_CHANGED` nhưng **không nơi nào `enqueue`** — ống dẫn có, vòi chưa có. `EMAIL_CHANGED` là tín hiệu chống account-takeover, đừng quên.

### P3b — quyết định kiến trúc phải đúng ngay (hoãn = viết lại)

1. **Next 16 đổi `middleware.ts` → `proxy.ts`.** Gõ tên cũ thì không chạy gì cả. Nexora scope matcher HẸP (`/account/*`, `/tours/:slug/book`) để trang public giữ static; guard lặp lại lần nữa trong page (defence in depth).
2. **Auth state ở client, KHÔNG đọc cookie trong root layout** — đọc cookie ở layout là force-dynamic toàn site.
3. **Nexora KHÔNG có `account/layout.tsx`** — 4 page tự lặp guard, nợ kỹ thuật rõ ràng. v2 nên dùng nested layout.
4. **Taxonomy cache tag là hợp đồng API↔Web.** Nexora có allow-list strict + secret so sánh constant-time. Cache Components của Next 16 thay cơ chế nhưng *tên tag, ai gọi `updateTag`* phải chốt cùng lúc thiết kế API.
5. **Gotcha Vercel đã tốn công debug**: openapi-fetch streamed body gãy với undici trên Vercel ("expected non-null body source") — Nexora phải dùng `fetch` native + body dạng **string**. Kiểm oRPC client trên Vercel THẬT từ sớm.
6. **Tri-state `error` / `empty` / `content`** — API sập KHÔNG được hiển thị thành "0 kết quả". Pattern cốt lõi, cần từ page đầu tiên.
7. **`lib/site.ts` resolution order** cho `SITE_URL` — mọi canonical/OG/sitemap/JSON-LD build trên đó. Quên là sai domain toàn bộ, sửa lại hết.
8. **Test chỉ phủ logic thuần trong `lib/`**, không unit-test JSX — nên mọi tính toán/validate phải tách khỏi component.

### Khoảng trống không có gì để port

`libs/*/ui` của Nexora **không có** formatDate/formatCurrency/slugify/
debounce/groupBy/pagination-range nào — chỉ có `cn()` và `buildTheme()`.
Các util đó phải viết mới, không "khai quật" được. Nexora cũng **không có
dòng analytics/monitoring nào** ở web.

## C. v2 tốt hơn Nexora (tổng hợp, ghi nhận)

Refund ledger append-only · cancellation audit-trail append-only · seat
claim có thêm DB CHECK · Decimal xuyên suốt (Nexora đi qua IEEE754 một
bước) · sinh mã booking insert-and-catch thay pre-SELECT · outbox insert
atomic trong cùng CTE · payload tự chứa (không re-fetch lúc gửi) ·
`purgeSent` retention (Nexora không dọn outbox) · `ReviewModerationEvent`
(Nexora ghi đè, mất lịch sử) · tombstone user (Nexora xoá cứng cascade) ·
`enableShutdownHooks()` (**Nexora quên gọi** → `onModuleDestroy` không chạy
khi SIGTERM — bug tiềm ẩn bên cũ) · env validation chặn giá trị dev lọt
production · `costPrice` không thể rò rỉ theo cấu trúc (Nexora phải nhớ
strip runtime) · `Destination.tourCount` chỉ đếm tour đã publish (Nexora
đếm cả draft → lộ số lượng tour nháp ra public) · search cả `summary` ·
sort có tie-breaker · PayPal hardcode sandbox.
