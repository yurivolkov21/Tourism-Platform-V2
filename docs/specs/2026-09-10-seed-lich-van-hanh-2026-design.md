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
| `CLOSED` (~88) | 1–5, trung bình 3 | `PAID` | `paidAt` = ngày khởi hành − 7…60 ngày |
| `CANCELLED` (~13) | 1–3 | `REFUNDED` | kèm refund + yêu cầu huỷ |
| `OPEN` tương lai | ~15 chuyến có 1–2 | `PAID` | để khu account và màn "chuyến sắp tới" có dữ liệu |

Tổng ≈ **310 booking**, trong đó ≈ 284 `PAID` trải đều 12 tháng theo `paidAt`.

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

## 6. Thứ tự bắt buộc

Sai thứ tự là phải xoá làm lại, không vá được:

```
1. giá vốn (tour_cost_items)     ← phải có TRƯỚC, không thì cost_per_person = NULL vĩnh viễn
2. khách giả (users + accounts)  ← booking cần userId
3. chuyến khởi hành
4. booking + payment events
5. refund + cancellation requests
```

Trước cả năm bước: user sửa `ADMIN_EMAILS` trên Render, vì seed upsert admin
theo `ADMIN_EMAILS[0]` và sẽ đẻ admin thứ hai nếu biến chưa đúng.

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

## 8. Ngoài phạm vi

- **Review bằng user giả.** CHECK `reviews_source_shape` cấm `CURATED` mang
  `user_id`; muốn gắn user phải chuyển sang `VERIFIED`, mà `VERIFIED` đòi cả
  `booking_id`. Sau spec này thì 284 booking `PAID` mới **mở khoá** được việc đó
  — nhưng nó là một đợt riêng.
- Enquiries, subscribers, chat, wishlist — bốn màn admin còn lại vẫn trống sau spec này.
- Ảnh: `media_assets` không nằm trong seed, đợt này không chạm.

## 9. Rủi ro đã biết

**Ngày viết cứng theo năm 2026.** Sang 2027 toàn bộ lịch thành quá khứ. Chấp nhận
được vì freeze 15/10/2026 và bảo vệ ~11/11/2026; đổi sang ngày tương đối sẽ làm
seed không tất định, mất khả năng chạy lại cho cùng kết quả. Ghi lại ở đây để
người sau không tưởng là bỏ sót.

**Khối lượng.** ~144 chuyến + ~310 booking + ~26 refund + ~26 yêu cầu huỷ +
~310 payment event ≈ 800 dòng mới. Không nặng với Postgres, nhưng seed sẽ lâu hơn
rõ rệt — cần đo lại thời gian chạy sau khi dựng.

**Cửa sổ site trống.** Giữa `reset` và `seed` không có chuyến nào để đặt. Phải
chạy liền một mạch, và xuất snapshot mới trước khi reset (bản 09/09 đã cũ: prod
đã đổi alt và có thêm booking).
