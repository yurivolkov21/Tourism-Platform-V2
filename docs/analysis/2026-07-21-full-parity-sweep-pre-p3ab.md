# Đối chiếu parity toàn bộ code TRƯỚC P3a-B (21/07/2026)

Mở rộng đợt [đối chiếu P3a-B](2026-07-21-p3a-b-parity-recheck.md) sang **mọi module
đã xây trước P3a-B**: catalog · reviews · bookings · payments · cancellations+refunds
· auth/account · worker/outbox. Mục tiêu: bắt chỗ v2 (bản nâng cấp) THỤT LÙI so với
Nexora — thiếu quy tắc, code kém hơn, lỗi tiềm ẩn Nexora không mắc.

Cách làm: 7 agent song song, mỗi agent một vùng, tự đọc code hai bên + `schema.prisma`

+ migrations + contract + docs tracked (A1–A11, api-parity, infra-parity) TRƯỚC khi
kết luận (kỷ luật chống dương tính giả, CLAUDE.md #10). **KHÔNG chạy int test** (DB
`tourism_test` dùng chung với session P3a-C — tránh giẫm test-state); chỉ chạy unit
thuần. Hai finding nặng nhất (catalog destinations, bookings orphan) đã được **kiểm
chứng độc lập** lần hai bằng đọc thẳng code v2.

## Kết luận một dòng

**Không có finding chạm bất biến money/security lõi** — mọi bất biến tiền/ghế/idempotency
đều giữ hoặc vượt Nexora. Thụt lùi tập trung ở **độ đầy đủ dữ liệu đọc-ra** và **vòng
đời booking PENDING**. **1 Quan trọng · 4 Nên có · 3 Nhỏ · 3 nợ-tương-lai (chưa live).**
cancellations+refunds, worker/outbox, auth (phạm vi đang sống) **sạch**.

## Bảng tổng — theo mức

| # | Vùng | Phát hiện | Mức |
| --- | --- | --- | --- |
| C1 | catalog | Card + detail chỉ trả `primaryDestination` — mất destination phụ | **Quan trọng** |
| B1 | bookings | Gateway lỗi lúc create → PENDING mồ côi + 500 opaque + không error typed / re-checkout | **Nên có** |
| P1 | payments | `checkout.session.expired` không hủy booking PENDING (Nexora có) | **Nên có** |
| R1 | reviews | `reviews.mine` mất danh tính tour (`tourSlug/tourTitle`) | **Nên có** |
| R2 | reviews | `admin.reviews.list` mất search + filter source/rating + `moderatedBy` | **Nên có** |
| B2 | bookings | `contactPhone` nới `min(1)` (Nexora `@Length(6,30)`) | Nhỏ |
| C2 | catalog | Mất endpoint departures lọc được (from/to/status) | Nhỏ |
| C3 | catalog | Bỏ sort key `updatedAt` | Nhỏ |
| D1 | auth | EMAIL_CHANGED chưa có điểm enqueue | Nợ (chưa live) |
| D2 | auth | Tombstone không dọn avatar MediaAsset | Nợ (chưa live) |
| D3 | auth | Bootstrap promote không self-heal | Nợ (Nhỏ) |
| D4 | reviews | Không revalidate cache sau moderate | Nợ (chưa chốt, P3b) |

**Sạch (không finding):** cancellations+refunds · worker/outbox · auth (live).
Chi tiết P3a-B (`name` min, mất log) ở [doc kia](2026-07-21-p3a-b-parity-recheck.md).

---

## C1 — [Quan trọng] Catalog chỉ trả destination primary, mất destination phụ

**Kịch bản hỏng:** Tour M:N "Central Vietnam Explorer" gắn Hội An (primary) + Huế +
Đà Nẵng. `GET /tours/central-vietnam-explorer` chỉ trả `primaryDestination: Hội An`;
Huế + Đà Nẵng **biến mất** khỏi cả card lẫn detail. **Mâu thuẫn nội tại:** list CHO
lọc tour theo BẤT KỲ destination link nào (`some`), nên tour này hiện dưới filter
"Huế" — nhưng mở detail lại không hề nhắc Huế. FE không render nổi "Tour đi qua: Hội
An · Huế · Đà Nẵng".

+ **v2** ([catalog.service.ts:24-31](apps/api/src/modules/catalog/catalog.service.ts:24)):
  `cardInclude.destinations` có `where:{isPrimary:true}, take:1`;
  [:55](apps/api/src/modules/catalog/catalog.service.ts:55) `primaryDestination: tour.destinations[0]?.destination`;
  [:116](apps/api/src/modules/catalog/catalog.service.ts:116) detail tái dùng chính
  `cardInclude`; contract [catalog.ts:54](libs/shared/contract/src/schemas/catalog.ts:54)
  `primaryDestination` (đơn), `TourDetailSchema` [:102-115](libs/shared/contract/src/schemas/catalog.ts:102)
  **không có** mảng `destinations[]`.
+ **Nexora**: `LIST_INCLUDE` lấy TẤT CẢ destinations (`tours.service.ts:36-44`);
  `TourSummaryDto.destinations: TourDestinationLinkDto[]` kèm cờ `isPrimary`; detail
  extends summary → cả card lẫn detail mang đủ danh sách.
+ **Đã kiểm chứng độc lập (2 lần):** đọc thẳng `catalog.service.ts` + `catalog.ts` —
  read-path chỉ có `primaryDestination`; schema M:N cho phép nhiều
  (`schema.prisma:346,367-378`); deep-sweep + CHANGELOG **không** ghi quyết định cố ý
  bỏ destination phụ (khác media — media là gap toàn app đã biết). → regression thật.
+ **Vá gợi ý:** thêm `destinations: DestinationLinkSchema[]` (kèm `isPrimary`) vào
  `TourCardSchema`/`TourDetailSchema`; đổi `cardInclude` bỏ `where isPrimary/take:1`,
  map cả mảng. Giữ `primaryDestination` để tương thích hoặc derive từ mảng.

## B1 — [Nên có] Gateway lỗi lúc create → PENDING mồ côi + 500 opaque + không đường phục hồi

**Kịch bản hỏng:** Stripe/PayPal sandbox chớp lỗi/rate-limit đúng lúc khách bấm "Đặt".
Row booking đã **commit PENDING** ([bookings.service.ts:162-183](apps/api/src/modules/bookings/bookings.service.ts:162))
với `providerSessionId=null`; lời gọi `gateway.createCheckoutSession`
([:197](apps/api/src/modules/bookings/bookings.service.ts:197)) là `await` **trần,
không try/catch** → ném ra. Contract `bookings.create` chỉ khai `DEPARTURE_NOT_AVAILABLE`

+ `SEATS_UNAVAILABLE` ([contract.ts:296,300](libs/shared/contract/src/contract.ts:296));
controller chỉ bắt 2 error đó → lỗi gateway thành **500 INTERNAL_SERVER_ERROR opaque**.
Khách nhận 500 mù, có một booking PENDING **không trả được tiền** (không procedure
re-checkout — grep rỗng) và **không tự hủy được** (`cancel` đòi PAID → 422 = A3 đã
tracked). Comment [:192-195](apps/api/src/modules/bookings/bookings.service.ts:192)
trấn an "pending-expiry (W2) sẽ quét" nhưng sweep đó **không tồn tại**.

+ **Nexora**: tách `create` (luôn thành công, chưa mint session) khỏi `startCheckout`
  (`bookings.service.ts:370-461`) — lời gọi provider bọc try/catch → ném **502 typed
  `CHECKOUT_FAILED`** ("please retry"); `POST /:code/checkout` **retry được**.
+ **Đã kiểm chứng độc lập:** đọc `bookings.service.ts:150-215` (xác nhận không try/catch),
  contract (chỉ 2 error), controller (chỉ bắt 2 error). grep `CHECKOUT_FAILED` / re-checkout
  procedure / `@Cron|@Interval|ScheduleModule` = rỗng.
+ **Không chạm tiền/ghế:** PENDING không giữ ghế (bất biến #1); expired = chưa charge.
  Là lỗ **độ tin cậy/UX + API-contract** (500 opaque thay vì error typed).
+ **Vá gợi ý (rẻ nhất):** bọc gateway call → ném contract-error `CHECKOUT_FAILED` (502).
  Đủ hơn: khôi phục procedure re-checkout, hoặc hiện thực sweep pending-expiry.

## P1 — [Nên có] `checkout.session.expired` không hủy booking PENDING

**Kịch bản hỏng:** Khách tạo booking → PENDING + Stripe Checkout (hết hạn 30′). Khách
bỏ dở. Sau 30′ Stripe bắn `checkout.session.expired` → v2 map sang `payment.failed`
([stripe.gateway.ts:210]) rồi handler chỉ **log** "booking stays PENDING"
([payments.service.ts:145-151]). Không sweep, không self-cancel (A3) → PENDING **kẹt
vĩnh viễn**. Nexora `onCheckoutExpired` flip thẳng **CANCELLED**.

+ **Không oversell, không mất tiền** (PENDING không giữ ghế; expired = chưa charge) —
  thuần vệ sinh dữ liệu/thống kê "chờ thanh toán".
+ **Quan hệ với đã-tracked:** phần *thiếu cron sweep* CHÍNH LÀ `cancelAbandonedBookings`
  của Nexora, **đã tracked ở [infra-parity](2026-07-19-infra-parity-nexora.md) #8**
  ("không nghiêm trọng"). Điểm MỚI ở đây là: v2 cũng bỏ luôn nhánh **webhook-driven
  cancel** (Nexora có CẢ webhook lẫn cron), và comment nói dối về sweep.
+ **Cụm PENDING-lifecycle:** B1 (gateway lỗi) + P1 (expired) + A3 (không tự hủy) +
  infra #8 (không cron sweep) → v2 hiện **không có đường nào** đưa PENDING mồ côi về
  terminal. Nên xử cả cụm một lần thay vì vá lẻ.

## R1 — [Nên có] `reviews.mine` mất danh tính tour

**Kịch bản hỏng:** Khách đánh giá 2 tour ("Hạ Long", "Sapa"). Trang "Đánh giá của tôi"
trả list chỉ rating/title/body/isApproved — **không tên tour, không link**. Vì `title`
optional, hai review bỏ trống title gần như không phân biệt được.

+ **v2**: `MyReviewSchema = PublicReviewSchema + isApproved`
  ([schemas/reviews.ts:36-38]) — không `tourSlug/tourTitle`; query `mine()` không
  `include:{tour}` ([reviews.service.ts:385-416]).
+ **Nexora**: `findMine` select `tour:{slug,title}`, trả kèm (`reviews.service.ts:399,409`).
+ Contract chốt cứng output → không lo được ở tầng khác.
+ **Vá gợi ý:** thêm `tourSlug`/`tourTitle` vào `MyReviewSchema` + `include:{tour:{select:{slug,title}}}`.

## R2 — [Nên có] `admin.reviews.list` mất search + filter + `moderatedBy`

**Kịch bản hỏng:** Admin nhận khiếu nại review chứa từ tục của "Nguyễn Văn A". Nexora
search theo tên/nội dung hoặc lọc chỉ 1★ / chỉ VERIFIED. v2 chỉ lọc được
approved/chưa-approved → phải lật tay cả hàng đợi. Ngoài ra `AdminReviewSchema` có
`moderatedAt` (khi nào) nhưng **thiếu `moderatedBy` (ai)** — dù bảng append-only
`ReviewModerationEvent` tồn tại nhưng **không endpoint nào đọc ra**.

+ **v2**: `AdminReviewsQuerySchema` chỉ `isApproved` ([schemas/reviews.ts:57-59]);
  `AdminReviewSchema` [:50-55] thiếu search/source/rating filter + `moderatedBy`.
+ **Nexora**: `findAllForAdmin` filter `isApproved/source/rating` + free-text search;
  item kèm `tourTitle/userName/userEmail/moderatedBy{who}` (`reviews.service.ts:305-380`).
+ Đây là admin ĐÃ XÂY một phần (`admin-reviews.controller.ts` tồn tại), không phải
  P4-defer thuần → gap trong chức năng đang có.

## Nhỏ

+ **B2** `contactPhone: z.string().min(1).max(30)` ([schemas/bookings.ts:42]) vs Nexora
  `@Length(6,30)` — nhận phone 1–5 ký tự. Không CHECK bù ở DB. Cùng kiểu với `name`
  enquiry (N1). Vá: `.min(6)`.
+ **C2** Mất `GET /tours/:slug/departures?from&to&status` (Nexora `departures.controller.ts`);
  v2 nhúng sẵn departures upcoming OPEN trong detail, không lọc server-side được. Có
  thể là đơn giản hoá cố ý — xác nhận với owner.
+ **C3** `TourSortKeySchema` bỏ `updatedAt` (Nexora whitelist có) — FE không sort "mới
  cập nhật". Vá: thêm `updatedAt` vào enum + `SORT_COLUMN`.

## Nợ tương lai — chưa live, không cần quyết bây giờ

+ **D1 (auth) EMAIL_CHANGED chưa enqueue:** template + enum có, nhưng không call-site;
  Better Auth `changeEmail` đang TẮT → chưa có vector account-takeover đang mở. Kích
  hoạt khi phase sau bật đổi email mà quên nối. **Cách nối đúng** = hook BA
  `sendChangeEmailConfirmation` (xác nhận email CŨ TRƯỚC khi đổi — mạnh hơn Nexora báo
  sau). Đã tracked deep-sweep B.
+ **D2 (auth) Tombstone không dọn avatar:** v2 chưa có module avatar/media (enum
  `MediaOwnerType.USER`/`MediaRole.avatar` sẵn nhưng chưa code tạo). Khi bật upload
  avatar, phải mở rộng transaction tombstone garbage-queue asset — nếu quên → ảnh mồ
  côi trên CDN sau khi xóa tài khoản (lỗ GDPR-erasure). Nexora `deleteMe` đã dọn.
+ **D3 (auth) Bootstrap promote không self-heal:** v2 promote CHỈ ở hook
  `user.create.after`; nếu UPDATE đó crash, email bootstrap kẹt role CUSTOMER, không có
  đường re-promote (Nexora re-promote mọi sync). Cửa sổ hẹp. P4: guard `isEnvAdmin`
  chống demote email bootstrap.
+ **D4 (reviews) Không revalidate cache sau moderate:** grep `apps/api` rỗng; Nexora
  bust Next.js tag sau duyệt. **Chưa chốt** — phụ thuộc web P3b có dùng tag-cache
  không. Liên quan deep-sweep P3b #4 (cache tag là hợp đồng API↔Web). Xác minh ở P3b.

## v2 tốt hơn Nexora (roll-up, giữ nguyên)

+ **Money-path:** atomic seat-claim gen-2 race-safe trên pool>1 (không dựa
  connection_limit=1); PaymentEvent forensics (amount/currency/bookingId); money Decimal
  xuyên suốt (Nexora IEEE754 một bước); **auto-refund có idempotency key — bắt được bug
  double-refund của Nexora** (Nexora `refundOrphanedCapture` không truyền key); refund
  ledger append-only cộng dồn (partial refund thứ 2+); cancellation approve một CTE
  nguyên tử (Nexora không có approve-flow); verify chữ ký Stripe/PayPal có unit-test âm
  bản đầy đủ; provider-http timeout 15s.
+ **Catalog:** tie-breaker `id` pagination ổn định; search cả `summary`; tourCount/
  toursCount chỉ đếm published (Nexora lộ số draft); costPrice chặn rò theo cấu trúc.
+ **Reviews:** `ReviewModerationEvent` append-only (Nexora last-write-wins mất lịch sử);
  rating denormalize đọc rẻ; eligibility đòi chuyến đã kết thúc (Nexora chỉ PAID);
  luôn map sang shape công khai (Nexora trả nguyên Prisma row → rò PII).
+ **Bookings:** snapshot bất biến lúc create; booking-code insert-and-catch đóng TOCTOU;
  overbook ép ở DB CHECK.
+ **Auth:** tombstone thay hard-delete cascade (giữ review + rating); `role` bất khả set
  từ client (BA `input:false`); ADMIN_EMAILS fail-fast ở boot.
+ **Worker:** updateMany có guard `status:PENDING` chống resurrect; `purgeSent` retention
  (Nexora không dọn outbox); guard unsubscribe.

## Kiểm chứng đã chạy

+ 7 agent đọc code hai bên + `schema.prisma` + migrations + contract + docs tracked.
+ Unit test thuần (KHÔNG int, tránh DB chung): payments 51/51 · bookings 11/11 ·
  refund-math 24/24 · reviews eligibility 7/7 · worker 31/31 · auth bootstrap 6/6.
  auth dùng context7 xác nhận hành vi Better Auth `changeEmail`/`sendChangeEmailConfirmation`.
+ Synthesis độc lập lần hai cho C1 + B1 bằng đọc thẳng code v2.
+ Bác nhiều dương tính giả: seatsLeft clamp (CHECK), listByTour bỏ averageRating (đọc
  qua Tour.ratingAvg), admin-refund không nhả ghế (D1 cố ý), same-day cancel (chủ đích),
  totalPages=0 (schema cho phép), media trên card (gap toàn app).
