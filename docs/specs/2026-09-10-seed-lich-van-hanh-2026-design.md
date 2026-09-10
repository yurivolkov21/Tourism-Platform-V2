# Spec — Dựng lại lịch khởi hành + tầng vận hành cho trọn năm 2026

10/09/2026 · nối tiếp đợt làm mới dữ liệu seed (bước 1 snapshot `fd738d68`,
bước 2 script reset `642e3add`, bước 3 làm giàu nội dung tour). Đầu vào là đợt
rà soát 9 agent ngày 10/09 (76 phát hiện) và hai quyết định user đã chốt trong
phiên: **chuyến bị huỷ là do CÔNG TY huỷ → hoàn 100%**, và **`freeCancellationDays`
được dùng làm ngưỡng hoàn tiền thật** (đã triển khai ở `52047520`).

Spec này chỉ mô tả **sẽ xây gì**. Các bước thực thi để lên `plans/` sau khi user duyệt.

## 1. Vấn đề

Ba thứ đo được trên prod hôm nay:

| Đo được | Con số | Hệ quả |
| --- | --- | --- |
| Chuyến đã qua ngày mà vẫn `OPEN` | 51/144 | Trạng thái nói sai sự thật |
| Booking thiếu `cost_per_person` | 159/159 | P&L đọc chi phí = 0, lãi = 100% doanh thu |
| Màn admin không có dữ liệu | 6 | Enquiries · Subscribers · Payment events · Cancellations · Refunds · Moderation |

Và một phân rã theo lịch: mỗi tour chỉ có **một** đợt giảm giá, đều rơi vào nửa
đầu năm, nên tới **11/11/2026 — đúng khoảng bảo vệ — chỉ còn 3/29 tour hiện giá
giảm**; tới 15/12 thì 17/29 tour hết sạch chuyến bán được.

Nguyên nhân chung: lịch khởi hành hiện tại là 134 ngày **viết cứng rời rạc**,
không sinh từ một mô hình nào, nên không ai canh được độ phủ theo tháng.

## 2. Mục tiêu

Một năm 2026 **đủ 12 tháng** dữ liệu vận hành, sinh từ một mô hình kiểm được:

- Mỗi tháng **≥10 chuyến khởi hành**, trải trên cả 29 tour.
- Tháng đã qua: phần lớn chuyến đã chạy xong, một phần nhỏ bị công ty huỷ và hoàn tiền đủ.
- Tháng còn lại trong năm: chuyến `OPEN`, còn ghế, site đặt được bình thường.
- Mỗi chuyến đã chạy có booking thật phía sau → dashboard, P&L và báo cáo có
  đường xu hướng 12 tháng thay vì một cột.

## 3. Ràng buộc đã đo — không phải giả định

Bốn điều dưới đây định hình toàn bộ thiết kế; mỗi cái đã kiểm bằng số hoặc bằng code.

**`DepartureStatus` không có `COMPLETED`** — chỉ `OPEN | CLOSED | CANCELLED`
(`schema.prisma:32`). "Đã chạy xong" **suy ra** từ `startDate < hôm nay` cộng
`CLOSED`; không thêm giá trị enum vì đó là đổi schema, theo CLAUDE.md §5 phải có
ADR đi trước, mà báo cáo doanh thu không hề đọc trạng thái chuyến.

**Doanh thu neo trên `bookings.paid_at`**, chỉ đếm `PAID` và `PARTIALLY_REFUNDED`
(`stats-aggregates.ts:350`). Chuyến không tự sinh doanh thu — seed chuyến mà
không seed booking thì dashboard vẫn trống.

**`cost_per_person` là SNAPSHOT** chụp lúc tạo booking từ `tour.costItems`
(`bookings.service.ts:395-396`). Prod đang có **0 dòng** cost item. Tạo booking
trước khi seed giá vốn thì cả 12 tháng lịch sử mang `NULL` — và **không tự lành**,
vì bước 8 của seed chỉ điền chỗ null trên `tours`/`tour_departures`, không đụng
booking đã tạo.

**Bảng con dùng `createMany({ skipDuplicates })`** nên sửa dòng đã có không bao
giờ tới DB. Đây là lý do phải **reset rồi seed**, không thể vá tại chỗ.

## 4. Mô hình sinh lịch

Sinh bằng code trong fixture, không gõ tay — cùng nếp `tour-costs.ts` (một mô
hình kiểm được bằng một bộ test, thay cho 144 con số rời không ai đối chiếu nổi).

### 4.1 Phân bố

| Khoảng | Số chuyến | Trạng thái |
| --- | --- | --- |
| 01–08/2026 (8 tháng đã qua) | 12/tháng = 96 | `CLOSED` ~87% · `CANCELLED` ~13% |
| 09/2026 | 12 (5 trước ngày 10, 7 sau) | 5 như trên · 7 `OPEN` |
| 10–12/2026 | 12/tháng = 36 | `OPEN` |
| **Tổng** | **144** | ~101 đã qua · ~43 mở bán |

Trên 29 tour → trung bình 5 chuyến/tour, không tour nào dưới 3.

### 4.2 Luật cho từng chuyến

- `seatsTotal = tour.maxGroupSize` **luôn luôn**. Điều này tự vá lỗi
  `phu-quoc-honeymoon-4d` đang có `seatsTotal 8 > maxGroupSize 6` (site in
  "8 of 6 seats left").
- `seatsBooked` **tính từ booking thật**, không đặt tay. Hiện fixture khai 438
  ghế đã đặt mà chỉ 2 booking đứng sau — seed lại kiểu cũ là đếm hai lần.
- `endDate = startDate + durationDays − 1`.
- `fixedCostAmount` để `null` trong fixture — bước 8 của seed dẫn xuất từ các
  dòng `PER_DEPARTURE`. Một nguồn sự thật.
- `id` là uuid v5 từ `departure:${tourId}:${isoDate}`, dùng lại hàm `stableId`.
  Chạy seed lại là ghi đè đúng dòng cũ, không nhân bản.

### 4.3 Khuyến mãi trải đều

Mỗi tour có **1–2 chuyến mang `priceOverride`**, và **ít nhất một chuyến giảm giá
phải có `startDate ≥ 15/11/2026`** để chip giảm giá còn sống trong khoảng bảo vệ.
`compareAtPrice` của chuyến = `basePrice` của tour; mức giảm giữ dải 10–20% như hiện tại.

Bất biến: `priceOverride < compareAtPrice` ở mọi chuyến có khuyến mãi.

## 5. Booking, huỷ và hoàn tiền

### 5.1 Khách giả

**40 tài khoản** `CUSTOMER`, chung một mật khẩu, hash ghi vào `accounts` của
Better Auth. Booking rải trên cả 40 để báo cáo "khách quay lại" có nghĩa.

Đây là **phụ thuộc bắt buộc**: booking cần `userId`, nên khách giả phải seed trước.

### 5.2 Booking

| Chuyến | Số booking | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| `CLOSED` (~88) | 2–6, trung bình 4 | `PAID` | `paidAt` = ngày khởi hành − 7…60 ngày; con số 4 do §8.1 quyết, không phải chọn bừa |
| `CANCELLED` (~13) | 1–3 | `REFUNDED` | kèm refund + yêu cầu huỷ |
| `OPEN` tương lai | ~15 chuyến có 1–2 | `PAID` | để khu account và màn "chuyến sắp tới" có dữ liệu |

Tổng ≈ **400 booking**, trong đó ≈ 372 `PAID` trải đều 12 tháng theo `paidAt`.
Con số nhích lên từ 310 vì §8.1: cần ~352 booking đã hoàn thành để ~116 review
rơi vào tỉ lệ ~33% thay vì 44%.

Mỗi booking:
- `code` khớp `^BK-[A-Z0-9]{8}$`, sinh tất định từ hash của `departureId` + chỉ số.
- Các cột snapshot (`tourTitle`, `departureStartDate/EndDate`, `unitPrice`) chụp
  đúng lúc seed, như service thật làm.
- **`costPerPerson` do SEED tính** từ `perPersonTotal(tour.costItems)` — không
  khai trong fixture. Cùng một hàm mà `bookings.service.ts` dùng, nên số liệu
  lịch sử và số liệu tương lai sinh ra từ một công thức.
- `paymentProvider` chia Stripe/PayPal ≈ 70/30.

### 5.3 Chuyến bị huỷ (công ty huỷ)

Theo quyết định của user: công ty huỷ → **hoàn 100%**, không phụ thuộc ngày huỷ,
không vướng bậc `30/15/7/0`. Mỗi booking trên chuyến bị huỷ sinh đủ bộ:

1. `Booking.status = REFUNDED`, `cancelledAt` đặt ≈ 14 ngày trước ngày khởi hành.
2. Một `Refund` — `amount = totalAmount`, `reason` nói rõ công ty huỷ chuyến,
   `adminId` trỏ về admin duy nhất còn lại.
3. Một `CancellationRequest` — `status = REFUNDED`, `decidedById` = admin,
   `decidedAt` cùng ngày, `freeCancellationDays` chụp giá trị của tour.
4. `PaymentEvent`: một sự kiện thu tiền lúc `paidAt`, một sự kiện hoàn tiền lúc huỷ.

Chuyến `PAID` bình thường sinh một `PaymentEvent` thu tiền.

## 6. Dọn sạch TRƯỚC, rồi seed theo thứ tự ưu tiên

Quyết định của user (10/09): **dọn dữ liệu cũ đi trước, rồi seed lại rõ ràng** —
không seed chồng lên nền cũ. Lý do đúng: seed chồng lên thì không ai phân biệt
được dòng nào là mới, dòng nào là tàn dư của lượt seed trước, và khách hàng cũ
dễ bị dùng lại một cách vô tình.

### 6.1 Bước 0 — dọn (`reset-operational-data.mjs`)

Đo trên prod ngày 10/09: **xoá 1025 dòng / 19 bảng · giữ 982 dòng / 16 bảng**.

| Xoá | Dòng | | Giữ | Dòng |
| --- | --- | --- | --- | --- |
| `users` · `accounts` · `sessions` | 63 · 63 · 86 | | `tours` + 8 bảng con | 373 |
| `bookings` · `tour_departures` | 159 · 144 | | `media_assets` · `site_media_slots` | 517 · 52 |
| `payment_events` · `refunds` | 197 · 13 | | `posts` + 3 bảng blog | 40 |
| `reviews` · `review_moderation_events` | 85 · 5 | | `email_suppressions` · `media_garbage` | 0 · 0 |
| `cancellation_requests` · `wishlist` | 16 · 51 | | | |
| `outbox` · `enquiries` · `subscribers` · `verifications` | 137 · 3 · 2 · 1 | | | |

Giữ đúng **một admin** (email trong `keep-list.json`); `posts.author_id` của cả
9 bài chuyển về admin đó trước khi xoá user, nếu không khoá ngoại `RESTRICT` chặn.

**Điều kiện bắt buộc trước khi bấm:** xuất snapshot + backup MỚI. Bản 09/09 đã
cũ — prod từ đó đã nhận alt text cho 517 ảnh và có thêm booking.

### 6.2 Thứ tự seed — sai thứ tự là xoá làm lại

```
1. giá vốn (tour_cost_items)      ← 131 dòng; PHẢI trước booking,
                                     không thì cost_per_person = NULL vĩnh viễn
2. khách giả (users + accounts)   ← 40 tài khoản, chung một mật khẩu; booking cần userId
3. chuyến khởi hành                ← 144 dòng theo mô hình §4
4. booking + payment events        ← ~310 + ~310
5. refund + cancellation requests  ← ~26 + ~26, cho các chuyến bị huỷ
6. reviews                         ← xem §8, làm SAU cùng vì cần booking có sẵn
```

Giá vốn không nằm trong thứ tự user nêu, nhưng phải chèn vào vị trí số 1: nó là
ràng buộc đã đo ở §3, không phải sở thích.

Trước cả sáu bước: user sửa `ADMIN_EMAILS` trên Render, vì seed upsert admin
theo `ADMIN_EMAILS[0]` và sẽ đẻ admin thứ hai nếu biến chưa đúng.

### 6.3 Vì sao dọn được mà không mất nội dung tour vừa sửa

Bước dọn giữ nguyên `tours` và `tour_policies`, còn seed dùng **upsert** cho hai
bảng ấy — nên 15 chính sách đặt cọc, 15 chính sách huỷ và 15 giá trị
`freeCancellationDays` vừa sửa đều tới được DB. `tour_faqs` và
`tour_destinations` dùng `createMany({ skipDuplicates })` nhưng 25 FAQ + 9 link
mới đều mang id mới nên vẫn vào. Không mục nào trong đợt làm giàu nội dung bị kẹt.

## 7. Bất biến phải kiểm được bằng test

Mỗi dòng dưới đây là một `expect`, không phải một lời hứa:

1. Mỗi tháng của 2026 có ≥10 chuyến; không tháng nào 0.
2. Mọi tour có ≥3 chuyến, và ≥1 chuyến `OPEN` còn ghế sau 15/12/2026.
3. `seatsBooked` của mỗi chuyến = tổng ghế của booking trên chuyến đó, và ≤ `seatsTotal`.
4. `seatsTotal ≤ tour.maxGroupSize` ở mọi chuyến.
5. Không chuyến nào `startDate < hôm nay` mà còn `OPEN`.
6. Mọi booking `PAID`/`REFUNDED` có `costPerPerson` khác null.
7. Mọi booking `REFUNDED` có đúng một `Refund` với `amount = totalAmount`, và
   đúng một `CancellationRequest` trạng thái `REFUNDED`.
8. `SUM(refunds.amount) ≤ booking.totalAmount` ở mọi booking.
9. Mỗi tháng có ≥1 booking `paidAt` → biểu đồ 12 tháng không có cột rỗng.
10. Mọi chuyến có `priceOverride` thì `priceOverride < compareAtPrice`.
11. ≥1 tour có chuyến giảm giá với `startDate ≥ 15/11/2026`.
12. Seed chạy hai lần cho ra cùng số dòng (id tất định + `skipDuplicates`).

Bảy cái nữa cho bước review (§8):

13. **29/29 tour có `ratingAvg` khác null** — mỗi tour ≥3 review ĐÃ DUYỆT.
14. Mọi review có `userId` bằng đúng `userId` của booking nó neo vào — người
    review phải là người đã đi.
15. Mọi review có `tourId` bằng đúng `tourId` của booking đó.
16. Mọi review có `createdAt > booking.departureEndDate` — không ai review
    chuyến chưa đi.
17. Không review nào là `CURATED`; mọi dòng đều `VERIFIED` và có đủ bộ ba
    `tourId` + `userId` + `bookingId` (nếu thiếu, CHECK `reviews_source_shape`
    của DB sẽ chặn — bất biến này chỉ để hỏng SỚM ở test thay vì lúc INSERT).
18. Hàng đợi moderation có ≥5 dòng chờ duyệt, và ≥1 dòng bị bác — hai màn admin
    không được rỗng.
19. Trung bình sao toàn site ∈ [4,1 ; 4,6] và ≥50% review là 5★ — canh phân bố
    hình chữ J, không để nó trôi về phân bố đều.

## 8. Reviews — bước 6, và ràng buộc định hình nó

User xếp reviews vào cuối chuỗi ưu tiên. Đó là chỗ đúng, vì DB **bắt buộc** vậy:

```
CHECK reviews_source_shape:
  VERIFIED ⇒ tour_id, user_id, booking_id đều NOT NULL
  CURATED  ⇒ booking_id IS NULL AND user_id IS NULL
```

Review **không thể vừa mang user vừa là `CURATED`**. Muốn review đứng tên khách
giả thì phải là `VERIFIED`, mà `VERIFIED` đòi một booking thật phía sau. Nên
reviews chỉ làm được SAU khi có ~284 booking `PAID` từ bước 4.

Hình dạng đề xuất: mỗi review `VERIFIED` neo vào một booking đã `PAID` trên một
chuyến **đã khởi hành**, `createdAt` sau `departureEndDate`. Tỉ lệ ~25–30%
booking đã đi có review — con số thật của ngành, và đủ để 29/29 tour có sao.

`ratingAvg`/`ratingCount` vẫn để seed tính lại ở bước 6b bằng câu SQL sẵn có,
không khai trong fixture.

**User chốt 10/09: thay TRỌN — bỏ hết 84 review `CURATED`, mọi review mới đều
`VERIFIED` đứng tên khách giả.** Lý do: đồng bộ, cũ xoá hết thì mới cũng thay hết.

Kiểm trước khi làm, và cả hai đều thuận:

- **Card review chỉ đọc `authorName` + `authorDeleted`** (`review-card.tsx:50`) —
  không đọc `authorLocation`, `tripLabel` hay `source`. Ba cột chỉ-dành-cho-curated
  ấy không xuất hiện ở đâu trên web, nên bỏ `CURATED` **không mất gì về hiển thị**.
- `bookingId` là `@unique` → DB tự ép **một review cho một booking**. Fixture chỉ
  cần không cố tạo trùng; không cần bất biến tay.

### 8.1 Thiết kế: lái từ ĐÍCH, không lái từ tỉ lệ

Cách hiển nhiên là "cho x% booking đã đi để lại review". Cách đó sai ở chỗ:
booking không rải đều giữa 29 tour, nên tour ít khách sẽ rơi về 0 review và mất
sao — đúng vấn đề hiện tại (5 tour đang 0 review).

Nên đi ngược: **chốt số review mỗi tour trước (3–6, trung bình 4 → ~116 review),
rồi mới bảo đảm đủ booking đã hoàn thành để chứa chúng.** Kéo theo một điều
chỉnh ở §5.2: mỗi chuyến `CLOSED` mang trung bình **4** booking thay vì 3
(88 × 4 ≈ 352), để tỉ lệ review/booking-đã-đi rơi vào **~33%** — sát thực tế
ngành, thay vì 44% nếu giữ con số cũ.

### 8.2 Phân bố sao — hình chữ J, không phải đều

| 5★ | 4★ | 3★ | 2★ | 1★ | ⌀ |
| --- | --- | --- | --- | --- | --- |
| 55% | 30% | 10% | 4% | 1% | ≈ 4,34 |

Phân bố đều cho trung bình bám quanh 3,0 và trông giả ngay. Hình chữ J là dạng
thật của review du lịch, và cho ra trung bình khớp con số 4,5 prod đang có.

### 8.3 Thời điểm

`createdAt` ∈ [`departureEndDate` + 1 ngày, + 21 ngày]. Không ai review chuyến
chưa đi. Ràng buộc này tự rải review khắp 12 tháng — màn moderation và mọi widget
"review gần đây" đều có dữ liệu quanh năm mà không cần luật riêng.

### 8.4 Trạng thái duyệt — lấp luôn hàng đợi đang trống

Review có ba trục (ADR-0031/0032): `isApproved` · `rejectedAt` · `retractedAt`.
Seed hiện tại để cả 84 dòng `isApproved=true, moderatedAt=null` — hàng đợi
moderation của admin vì thế trống trơn. Chia lại trên ~116 review:

| Trạng thái | Số | Tác dụng |
| --- | --- | --- |
| Đã duyệt (`moderatedAt` + `moderatedById` = admin) | ~104 | Tính vào `ratingAvg` |
| Chờ duyệt (`isApproved=false`, `moderatedAt=null`) | ~8 | **Lấp hàng đợi moderation** |
| Bị bác (`rejectedAt` + `rejectedById`) | ~3 | Phủ nhánh phán quyết |
| Tác giả rút (`retractedAt`) | ~1 | Phủ đường W4 U2 |

Kèm `review_moderation_events` cho các dòng đã có phán quyết — lấp nốt một màn
admin nữa. Chỉ ~104 dòng đã duyệt vào `ratingAvg`, đúng công thức sẵn có.

### 8.5 Đề xuất tối ưu: giữ CHỮ, thay NGƯỜI

84 review curated hiện tại viết tay riêng cho từng tour, chất lượng tốt — vứt đi
là mất công viết lại 84 đoạn văn có chi tiết thật của từng chuyến.

Đề xuất: **giữ nguyên phần chữ và số sao, gắn lại vào một khách giả + một booking
đã hoàn thành của CHÍNH tour đó**, rồi viết thêm ~32 đoạn nữa cho đủ ~116. Mọi
dòng vẫn là dòng MỚI (id mới, tác giả mới, booking mới, `VERIFIED`) nên vẫn đúng
tinh thần "cũ xoá hết, mới thay hết" — chỉ là không đốt phần chữ.

Nếu user muốn thay cả chữ thì bỏ khối này, chi phí là viết mới 116 đoạn.

### 8.6 Lỗ riêng, không thuộc phạm vi

**Testimonial trang chủ đọc `@/mocks/testimonials`, không đọc DB**
(`testimonials.tsx:7`). Thay toàn bộ review trong DB **không đổi một chữ nào**
trên trang chủ. Đây là việc riêng, ghi lại để không ai tưởng đã xong.

## 8b. Ngoài phạm vi

- Enquiries, subscribers, chat, wishlist — bốn màn admin này vẫn trống sau spec
  này. Chúng bị xoá ở bước 0 và không có bước seed nào dựng lại.
- Ảnh: `media_assets` không nằm trong seed, đợt này không chạm.

## 9. Rủi ro đã biết

**Ngày viết cứng theo năm 2026.** Sang 2027 toàn bộ lịch thành quá khứ. Chấp nhận
được vì freeze 15/10/2026 và bảo vệ ~11/11/2026; đổi sang ngày tương đối sẽ làm
seed không tất định, mất khả năng chạy lại cho cùng kết quả. Ghi lại ở đây để
người sau không tưởng là bỏ sót.

**Khối lượng.** ~144 chuyến + ~310 booking + ~26 refund + ~26 yêu cầu huỷ +
~310 payment event ≈ 800 dòng mới. Không nặng với Postgres, nhưng seed sẽ lâu hơn
rõ rệt — cần đo lại thời gian chạy sau khi dựng.

**Cửa sổ site suy giảm — dài hơn hẳn khi dọn trước.** Đây là cái giá thật của
quyết định ở §6. Từ lúc reset tới lúc seed xong, `www.nexora-travel.agency`:

| Còn nguyên | Mất tạm thời |
| --- | --- |
| 29 tour đủ nội dung + 517 ảnh | Không chuyến nào để đặt — nút Reserve vô dụng |
| 9 bài blog + toàn bộ ảnh site | Không sao đánh giá (rating về null) |
| Trang chủ, /tours, /destinations, /about | Không đăng nhập được trừ admin |

Chấp nhận được vì đây là site capstone, không có khách thật. Nhưng nó KHÔNG phải
vài phút như phương án gộp — nó kéo dài suốt quá trình dựng và thử fixture.
Hai cách rút ngắn nếu user muốn: dựng xong fixture rồi mới reset (mất lợi ích
"nền sạch" mà user đang nhắm), hoặc reset rồi seed ngay bằng bộ hiện có để site
sống, chấp nhận phải xoá lần hai.

**Backup phải mới.** Bản 09/09 đã cũ: prod từ đó đã nhận alt text cho 517 ảnh và
có thêm booking. Xuất snapshot + backup mới ngay trước khi reset, không tái dùng.
