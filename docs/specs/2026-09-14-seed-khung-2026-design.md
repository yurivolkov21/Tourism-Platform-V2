# Spec — Seed trọn năm 2026: khung thời gian, mốc "hôm nay" và vá hình dạng dữ liệu

14/09/2026 · bổ sung cho [spec 10/09](2026-09-10-seed-lich-van-hanh-2026-design.md)
(nhánh `chore/seed-buoc1-snapshot`, chưa merge). Mọi quyết định dưới đây đã
được user duyệt từng phần trong phiên brainstorming ngày 14/09.

Spec này chỉ mô tả **sẽ xây gì**. Các bước thực thi nằm ở plan đi kèm.

**Phần của spec 10/09 bị thay thế:** §4.1 (phân bố chuyến — nay tính từ mốc H),
§5.2 (luật đặt trước), §5.3 (hình dạng chuyến công ty huỷ), §9 mục "Ngày viết
cứng theo năm 2026" (nay có mốc qua biến môi trường). Các bất biến §7 của spec
10/09 vẫn giữ; §6 dưới đây bổ sung.

## 1. Vấn đề — đo trên Supabase prod ngày 14/09

User muốn dữ liệu mới nằm trong 01/2026–12/2026 nhưng vẫn thấy mốc 2025. Đó
KHÔNG phải dữ liệu cũ sót lại: đợt dọn 10/09 đã xoá sạch tầng vận hành. Chính bộ
sinh trên nhánh đẻ ra các mốc lệch:

| Dữ liệu | Lệch | Nguồn |
| --- | --- | --- |
| `users` / `accounts.created_at` | 72/120 khách giả ở 01/09–28/12/2025 | `people/customers.ts` — `TY_LE_CU = 0.6` |
| `bookings.paid_at` / `created_at` | 51 booking ở 13/10–31/12/2025 | `operations/bookings.ts` — đặt trước 0–90 ngày nên chuyến tháng 1–3 lùi về cuối 2025 |
| `payment_events` | 55 dòng ở 10–12/2025 | như trên |
| `refunds`, `cancellation_requests`, `bookings.cancelled_at` | 4 dòng ngày 23–24/12/2025 | công ty huỷ 14 ngày trước các chuyến đầu tháng 1 |
| `tour_departures.created_at` | 103/261 ở 09–12/2025; 13 dòng ở 10–11/2026 (tương lai) | `catalog/departures-2026.ts` — mở bán trước 120–240 ngày, sàn 01/09/2025 |
| `tour_departures.start_date` | 50 chuyến 01–03/2027 (OPEN) và 81 booking trên chúng | `THANG_BAN_DUOC` có ba tháng của 2027 |
| `reviews.moderated_at`, `review_moderation_events` | 1 dòng ngày 16/09, sau "hôm nay" 10/09 của bộ dữ liệu | `operations/reviews-verified.ts` không chặn theo mốc |

**Nơi user nhìn thấy:** menu tháng của `/reports` (12 tháng gần nhất, tức
10/2025 → 9/2026); "Traveler since" ở `/account` (năm của booking đầu tiên);
`/cancellations` và `/payment-events` (không lọc ngày mặc định);
`/bookings?dates=all`; trang chi tiết booking; bộ chọn ngày ở trang tour (hiện
chuyến 2027). Docker local đang mang seed CŨ của `main` (134 chuyến, 84 review
CURATED) vì nhánh chưa merge.

**Đo thêm cùng đợt — bốn hình dạng dữ liệu mà app thật không tạo ra được**
(đối chiếu `docs/conventions/booking-states.md` và
`libs/shared/contract/src/schemas/refund-policy.ts`):

1. 16 booking seed ở trạng thái PENDING bị job `pending-sweep` (TTL 65′) quét
   thành CANCELLED lúc 08:30:22 ngày 10/09 — bảy phút sau khi seed, cùng một
   mili-giây.
2. 10 booking đã trả tiền mang CANCELLED mà không có refund, không có yêu cầu
   huỷ, huỷ trước khởi hành 9–213 ngày. App không có đường này (khách phải gửi
   yêu cầu, admin duyệt), và `refundPercentForRequest` cho 100% ở cả 10 ca.
3. 5 yêu cầu DENIED ghi "trong cửa sổ huỷ miễn phí nên không hoàn" trong khi cả
   5 đủ điều kiện hoàn 100%.
4. 31 booking của chuyến công ty huỷ mang REFUNDED kèm `cancelled_at` và yêu cầu
   huỷ REFUNDED. Luồng duyệt huỷ luôn đặt CANCELLED; luồng hoàn tiền của admin
   không có yêu cầu huỷ và không đặt `cancelled_at`. Không luồng nào ra tổ hợp
   này.

Dữ liệu giữ lại (tours, destinations, blog, media, site slots) không có mốc
2025, trừ 6 dòng `tour_categories.created_at = 2025-12-23`.

## 2. Quyết định đã chốt

| # | Quyết định | Lý do |
| --- | --- | --- |
| Q1 | Mọi dòng seed nằm trong 01/01–31/12/2026 theo lịch UTC; bỏ hẳn chuyến 2027 | Yêu cầu của user. Hệ quả chấp nhận: từ khoảng giữa 12/2026 hết chuyến để bán — sau ngày bảo vệ |
| Q2 | Giao dịch (thanh toán, huỷ, hoàn, review, duyệt, enquiry, subscriber) không mang mốc sau H | Tiền ghi ở tương lai là dữ liệu sai; thống kê đọc đồng hồ thật |
| Q3 | H đặt qua `SEED_HOM_NAY`; mặc định ghim `2026-09-20`; bắt buộc truyền khi nhắm prod | Mặc định theo đồng hồ máy làm seed không tất định: hai ngày chạy đẻ hai bộ id, `skipDuplicates` không bắt |
| Q4 | Seed prod ngay sau review; reset và seed lại khoảng 03/11 với H mới | Seed tĩnh một lần thì tới 11/11 cửa sổ 7/28/90 ngày và báo cáo tháng 11 trống |
| Q5 | Cách A: module khung thời gian, bộ sinh là hàm thuần nhận H, test cho hai mốc 20/09 và 03/11 | Lượt seed lại trước bảo vệ không phải sửa code |
| Q6 | Vá luôn bốn hình dạng ở §1 trong đợt này | Cùng file `bookings.ts`, cùng một lượt reset prod |
| Q7 | Thêm enquiries và subscribers | Hai màn admin đang bật mà trống từ đợt dọn 10/09 |
| Q8 | Không đụng dữ liệu giữ lại; `tour_categories.created_at` (2025) và `tours.created_at` (31/07) để nguyên | Không màn nào hiển thị hai cột này dưới dạng ngày; `tours.created_at` còn là khoá sắp xếp mặc định của `/tours` (`sort=createdAt`), đổi nó là đổi thứ tự trang |
| Q9 | Ngoài phạm vi: chat (P6 chưa xây); bug enquiry ẩn danh làm vỡ `/enquiries` (task riêng) | Khác vùng code, không cần reset dữ liệu |
| Q10 | (15/09, sau lượt prod 1) Menu tháng `/reports` có sàn cố định 01/2026: không bày tháng trước mốc, `?month=` trước mốc rơi về tháng hiện tại (`REPORTS_FIRST_MONTH` ở `apps/admin/src/lib/reports-query.ts`) | Bản cũ bày 12 tháng lùi từ hôm nay (10/2025 → 9/2026); tháng trống vẫn là lựa chọn tồn đọng, trái yêu cầu thống kê bắt đầu từ 01/2026 |

Không cần ADR: thay đổi nằm trong công cụ seed, không đổi schema hay contract;
không có migration. Hành vi sản phẩm chỉ đổi đúng một chỗ ở Q10 (dải tháng của
menu `/reports` trong admin).

## 3. Khung thời gian và mốc H

File mới `apps/api/prisma/fixtures/khung-thoi-gian.ts`:

- `DAU_KHUNG = 2026-01-01T00:00:00Z`, `CUOI_KHUNG = 2026-12-31`.
- `docMocHomNay(giaTri: string): Date` — hàm thuần. Nhận `YYYY-MM-DD`, trả nửa
  đêm UTC của ngày đó. Ném lỗi nếu sai định dạng hoặc ngoài [2026-06-01,
  2026-12-01]: sớm hơn thì lịch sử quá mỏng cho các bất biến, muộn hơn thì cửa
  sổ còn bán quá hẹp.
- `HOM_NAY_MAC_DINH = '2026-09-20'` — chỉ dùng cho Docker và test.
- `HOM_NAY = docMocHomNay(process.env.SEED_HOM_NAY ?? HOM_NAY_MAC_DINH)`.
- `kiemTraMocChoProd({ laProd, coEnv, homNay, homNayThat })` — hàm thuần trả
  `ok | canh-bao | tu-choi` kèm thông điệp:
  - đích Supabase mà không có `SEED_HOM_NAY` → từ chối;
  - H sau hôm nay thật quá 1 ngày → từ chối;
  - H cũ hơn hôm nay thật quá 3 ngày → cảnh báo, vẫn chạy.
- `seed.ts` gọi chốt chặn này ngay sau chốt `--toi-biet-day-la-production` và
  in ra H đã dùng.
- **Hai chốt chặn đọc DB** (review cuối nhánh 14/09) trong
  `apps/api/prisma/fixtures/chot-chan-seed.ts`; `seed.ts` gọi ở đầu `main()`,
  trước mọi lệnh ghi:
  - `kiemTraAdminChoProd` — đích prod phải có đúng MỘT admin và
    `ADMIN_EMAILS[0]` phải là admin đó; seed không bao giờ tạo thêm admin trên
    prod (user chốt 14/09 chỉ giữ một tài khoản admin).
  - `kiemTraTheHeLich` — `tour_departures` đã có chuyến không thuộc bộ fixture
    của H hiện tại (dữ liệu của một H khác) thì từ chối, bắt reset trước.
- **Chốt chặn mật khẩu khách giả** (15/09, cùng file): `kiemTraMatKhauKhachChoProd`
  — đích prod mà `SEED_CUSTOMER_PASSWORD` trống hoặc trùng mật khẩu mặc định
  công khai trong code thì từ chối, trước khi Prisma kết nối. Mặc định đó đã lộ
  trên GitHub từ 10/09 nên chỉ dùng cho Docker; giá trị thật cho prod chỉ nằm
  trong `apps/api/.env.production` (gitignored).

Bộ sinh thành hàm thuần nhận H: `sinhKhach(homNay)`, `sinhLich(homNay)`,
`sinhVanHanh(homNay, lich, khach)`, `sinhReview(homNay, lich, vanHanh)`, và hai
bộ sinh mới `sinhEnquiry(homNay, khach)`, `sinhSubscriber(homNay, khach)`. Các
tên export cũ (`khachGia`, `tourDepartures`, `bookingsGia`, …) giữ nguyên và tính
từ `HOM_NAY`, nên `seed.ts` đổi ít. `HOM_NAY` chuyển từ `departures-2026.ts`
sang file khung.

**Giờ trong ngày:** mọi mốc có giờ rải trong 08:00–22:00 giờ Việt Nam
(01:00–15:00 UTC) thay cho đúng 00:00 UTC như hiện nay, vẫn giữ mọi thứ tự nhân
quả. Cột `@db.Date` (ngày khởi hành, `travel_date`) vẫn là nửa đêm UTC.

**Id:** tiền tố `idTinh` giữ nguyên. Id dẫn xuất từ ngày (chuyến, booking,
review) đổi theo H, nên đổi H thì BẮT BUỘC reset trước khi seed — đúng quy trình
§8.

## 4. Luật ngày theo bảng

"≤ H" nghĩa là trước nửa đêm UTC của ngày H. Mọi khoảng tính theo lịch UTC.

### 4.1 Khách giả (120)

- `created_at` ∈ [01/01, H − 7 ngày]: 30% trong 01–07/01 (đợt ra mắt), 70% rải
  đều phần còn lại.
- `accounts.created_at` = `users.created_at`; `updated_at` đặt tường minh bằng
  `created_at`.

### 4.2 Lịch khởi hành

- **Lịch sử:** `start_date` ≥ 08/01; `end_date` ≤ H − 2 ngày. CLOSED ~87%,
  CANCELLED ~13%. Số chuyến mỗi tour = max(3, làm tròn(0,6 × số tháng lịch sử))
  — khoảng 5 với H = 20/09, khoảng 6 với H = 03/11. Rải theo khe thời gian đều
  nhau, lệch pha giữa các tour để tổng theo tháng phẳng.
- **Sàn chuyến đã chạy** (ruling 14/09 khi thi công): mỗi tour giữ ≥ 3 chuyến
  lịch sử CLOSED — chuyến bị huỷ chỉ lấy phần vượt 3, nên với H sớm (tour có đúng
  3 chuyến lịch sử) không chuyến nào bị huỷ. Các chuyến của một tour cách nhau
  ít nhất 28 ngày, nên tối đa một chuyến kết thúc trong 3 ngày sát H và luôn còn ≥ 2
  chuyến cho sàn booking đã đi (§4.3).
- **Còn bán:** `start_date` ≥ H + 2 ngày; `end_date` ≤ 31/12. OPEN, 4 chuyến mỗi
  tour.
- **Mở bán** (`created_at`) = khởi hành − 120…240 ngày, kẹp vào [01/01, H].
- **Khuyến mãi** giữ luật spec 10/09: ~45% tour có một chuyến còn bán giảm
  10–20%, ưu tiên khởi hành từ 15/11; ~33% tour có một đợt giảm trong lịch sử;
  `compare_at_price` = giá gốc của tour.
- `seats_total` = `max_group_size`; `seats_booked` = tổng ghế của booking PAID
  (dẫn xuất, seed đặt lại).

### 4.3 Booking và thanh toán

- `paid_at` ∈ [max(`created_at` của khách + 1 ngày, `created_at` của chuyến),
  min(khởi hành − 1 ngày, H)]. Khách có khoảng này rỗng bị loại ngay lúc bốc
  khách; bốc không ra ai thì bỏ lượt đặt đó.
- Đặt trước 0–90 ngày, **co theo khoảng khả dụng**:
  `muộn nhất − u × min(90 ngày, muộn nhất − sớm nhất)` với `u` ∈ [0, 1), thay
  cho `max(sớm nhất, …)` hiện nay — không dồn về ngày sớm nhất, không có đỉnh
  giả đầu tháng 1.
- Mỗi booking đã trả có đúng một payment event thu tiền tại `paid_at`.
- Giữ nguyên các luật đã có: không khách nào chồng lịch, một khách một booking
  trên mỗi chuyến, chừa ghế cho chuyến khuyến mãi còn bán, giá theo `pricing.ts`,
  `cost_per_person` do seed tính bằng `perPersonTotal`.
- **Sàn booking đã đi** (ruling 14/09 khi thi công): sau bước duyệt huỷ (§4.4),
  mỗi tour ≥ 3 booking PAID trên chuyến CLOSED kết thúc ≤ H − 3 ngày — đúng loại
  booking bước bù review (§4.5) nhận. Thiếu thì đặt bù bằng chính các luật trên.
- **Không seed booking PENDING:** job `pending-sweep` huỷ chúng trong 65 phút.
- **Không seed `outbox`.**

### 4.4 Hình dạng huỷ và hoàn tiền

| Ca | Hình dạng seed | Mô phỏng luồng |
| --- | --- | --- |
| Giỏ bỏ dở (~16, rải khắp năm) | CANCELLED; `paid_at` null; không payment event, không refund; `cancelled_at` = `created_at` + 65–80′; chuyến còn mở tại lúc tạo | job `pending-sweep` |
| Khách xin huỷ, admin duyệt (~12) | Yêu cầu huỷ REFUNDED: `created_at` sau `paid_at` và trước khởi hành; `decided_at` sau 0–3 ngày, ≤ khởi hành và ≤ H; `free_cancellation_days` chụp của tour. Booking CANCELLED, `cancelled_at` = `decided_at`. % hoàn = `refundPercentForRequest`, số tiền = `policyRefundAmount` (hàm của contract). Số tiền > 0 thì 1 refund (`admin_id`, `reason` null) và 1 payment event hoàn tại `decided_at`; bằng 0 thì không có. Phủ cả bốn bậc 100/50/25/0, mỗi bậc ≥ 2 — bậc 50% và 25% chỉ xảy ra khi số ngày còn lại nhỏ hơn `free_cancellation_days` của tour, nên phải chọn tour có ngưỡng lớn (10, 14, 21, 30) | `cancellations.service` approve |
| Yêu cầu bị từ chối (~5) | DENIED; `created_at` sau `paid_at` và trước khởi hành; khách xin đổi ngày, `decision_note` nói rõ xử lý như đổi lịch; `decided_at` sau 1–3 ngày và ≤ H; booking giữ PAID | `cancellations.service` deny |
| Yêu cầu đang chờ (~9) | REQUESTED; `created_at` trong 25 ngày trước H và sau `paid_at`; chuyến khởi hành sau H; booking PAID | khách gửi, chưa ai quyết |
| Công ty huỷ chuyến | Mọi booking đã trả trên chuyến CANCELLED thành REFUNDED; 1 refund = `total_amount` có `reason` và `admin_id`; 1 payment event hoàn cùng mốc; mốc hoàn = max(`paid_at` + 1 ngày, khởi hành − 14 ngày), ≤ khởi hành và ≤ H; **không** yêu cầu huỷ; `cancelled_at` null | hoàn tiền từ admin (booking-states.md, dòng goodwill refund full) |

Mọi booking huỷ hoặc hoàn không giữ ghế, nên không vào `seats_booked`.

### 4.5 Review

- Chỉ booking PAID trên chuyến CLOSED được review.
- `created_at` = kết thúc chuyến + 1–21 ngày, co về ≤ H − 1 ngày.
- Duyệt 1–3 ngày sau khi viết. Mốc duyệt vượt H thì review ở trạng thái chờ
  duyệt (`is_approved = false`, `moderated_at` null) — review mới nhất tự nằm
  trong hàng đợi.
- Mốc rút lại ≤ H; không vừa thì không rút.
- `review_moderation_events.created_at` = `moderated_at`.
- Giữ phân bố sao hình chữ J, giữ chữ của 84 review cũ, giữ bước bù đủ ≥ 3 review
  đã duyệt mỗi tour (bước bù chỉ chọn booking mà mốc duyệt vẫn ≤ H).

## 5. Enquiries và subscribers

**Nguyên tắc:** DB không có CHECK hay trigger nào cho bốn bảng này, nhưng
response admin được validate theo contract — một dòng sai làm cả trang
`/enquiries` hoặc `/subscribers` lỗi. Mỗi dòng mô phỏng đúng thứ luồng hiện tại
ghi ra. Không `outbox` (worker quét PENDING mỗi phút và gửi mail thật). Không dòng
ẩn danh (retention 18 tháng nên năm 2026 vốn không có; và dính bug Q9). `id`,
`updated_at` đặt tường minh vì hai cột này không có default ở DB.

### 5.1 Enquiries (~70 với H = 20/09, tăng dần theo tháng)

- **Form private trip (~60%):** có `tour_id`; `group_size` = người lớn + trẻ em
  (1–10); `travel_date` ∈ [tạo + 14 ngày, 31/12/2026]; ~50% có `phone`;
  `interests` rỗng.
- **Form liên hệ (~40%):** `tour_id` null (admin hiện "General enquiry");
  `interests` rỗng hoặc một trong `north | central | south`; `group_size` tuỳ
  chọn; lời nhắn có thể kèm dòng `Preferred dates: …`.
- `nationality`, `budget_tier` null — không form nào gửi hai trường này.
- ~35% gửi khi đăng nhập: `user_id` cùng tên, email của khách giả, sau ngày họ
  đăng ký. Còn lại là khách vãng lai `@example.com`, tên ghép theo cùng nhóm ngôn
  ngữ, không trùng email khách giả.
- Lời nhắn tiếng Anh, 10–2000 ký tự, nói về một chuyến cụ thể.
- **Trạng thái theo tuổi so với H:** ≤ 7 ngày phần lớn NEW; 7–30 ngày
  CONTACTED hoặc QUOTED; cũ hơn WON ~30%, LOST ~35%, còn lại treo ở QUOTED hoặc
  CONTACTED.
- **`enquiry_status_events`:** chuỗi bắt đầu từ NEW; `from_status` = `to_status`
  của bước trước; không bước nào `from = to`; bước cuối = `status`; `admin_id` =
  admin; mốc tăng dần và ≤ H; bước nào vượt H thì chuỗi dừng ở bước trước đó.
- `updated_at` = mốc sự kiện cuối, hoặc `created_at` nếu không có sự kiện.
- **`enquiry_notes`:** 0–3 ghi chú cho enquiry đã rời NEW; `author_id` = admin;
  `author_name` chụp lúc seed bằng `admin.name` (trống thì email) như service
  làm; mốc ≥ `created_at` và ≤ H; không đổi `updated_at`.
- Ít nhất 1 sự kiện WON và ≥ 3 enquiry mới trong 28 ngày trước H; ≥ 5 enquiry
  đang NEW.

### 5.2 Subscribers (~180, tăng dần theo tháng)

- `source` null — footer web chỉ gửi email.
- **Trạng thái:** đã xác nhận, còn nhận tin ~75% · chờ xác nhận ~10% · xác nhận
  rồi huỷ ~10% · huỷ khi chưa từng xác nhận ~5%.
- `welcome_sent_at` = `created_at` + vài giây ở mọi dòng; `confirmed_at` sau 3
  phút–2 ngày; `unsubscribed_at` sau 2–120 ngày (và sau `confirmed_at` nếu có);
  mọi mốc ≤ H.
- `updated_at` = mốc mới nhất trong các cột trên.
- Email không trùng (không phân biệt hoa thường); ~30% trùng email khách giả.
- Ít nhất 1 lượt huỷ và vài đăng ký mới trong 28 ngày trước H.

### 5.3 Thứ tự trong `seed.ts`

catalog → site slots → admin → khách giả → vận hành (booking, payment event,
refund, yêu cầu huỷ, đặt lại ghế) → blog → review và tính lại rating →
**enquiries** (kèm notes, status events) → **subscribers** → giá vốn dẫn xuất.

Script reset đã xoá sẵn cả bốn bảng này — không phải sửa.

## 6. Test và bất biến

| Tầng | Chạy ở đâu | Vai trò |
| --- | --- | --- |
| Unit fixture — `apps/api/prisma/fixtures/**/*.spec.ts` | `pnpm gate` (vitest unit đã quét thư mục này) | Bất biến chi tiết chạy ở hai mốc 20/09 và 03/11; `khung-ngay.spec.ts` quét 30 mốc (mỗi 7 ngày từ 01/06 tới 01/12, gồm cả hai mốc cố định) cho khung ngày và các sàn cấu trúc. Sàn booking đã đi và sàn review ném lỗi lúc import nếu hụt, nên seed dừng trước mọi lệnh ghi. Viết TRƯỚC, phải đỏ trên bộ sinh hiện tại |
| Nghiệm thu SQL — `apps/api/scripts/verify-seed.mjs` (chỉ đọc, §7) | Docker sau khi seed; prod sau mỗi lượt chạy | Bất biến trên dữ liệu thật trong DB, gồm cả thứ seed tính lúc chèn (`cost_per_person`, `seats_booked`, rating) |
| Smoke giao diện | Admin và web local trỏ Docker | `/enquiries`, `/subscribers`, `/cancellations`, `/payment-events`, `/reports`, `/account` tải được, không lỗi validate |

Bất biến ở tầng unit:

1. **Mốc:** `docMocHomNay` nhận và từ chối đúng; `kiemTraMocChoProd` cho đủ ba
   kết cục.
2. **Khung ngày, quét tổng quát:** mọi trường tên `…At` hoặc `…Date` của mọi
   fixture nằm trong [01/01/2026, H]; riêng ngày khởi hành của chuyến còn bán
   nằm trong [H + 2 ngày, 31/12]. Quét theo tên trường nên cột thêm về sau cũng
   tự được canh.
3. **Lịch:** mỗi tháng của 2026 có ≥ 10 chuyến; mỗi tour ≥ 3 chuyến lịch sử và 4
   chuyến còn bán; chuyến lịch sử kết thúc ≤ H − 2 ngày; chuyến còn bán kết thúc
   ≤ 31/12; `seats_total` = sức chứa; `seats_booked` = ghế booking PAID và ≤
   `seats_total`; `price_override` < `compare_at_price`; ≥ 1 chuyến khuyến mãi
   khởi hành từ 15/11; id không trùng.
4. **Booking và tiền:** `paid_at` sau ngày khách đăng ký và ngày mở bán, trước
   khởi hành và ≤ H; không khách nào chồng lịch; đơn giá và tổng tiền khớp hàm
   `pricing.ts`; không có PENDING; mỗi tháng từ 01 tới tháng của H có booking;
   cửa sổ 7 và 28 ngày trước H có booking.
5. **Huỷ và hoàn (§4.4):** giỏ bỏ dở đúng hình dạng; mỗi booking CANCELLED đã trả
   có đúng một yêu cầu huỷ REFUNDED và số hoàn = `policyRefundAmount(…)`; bậc 0%
   thì không có refund; đủ bốn bậc; DENIED và REQUESTED giữ booking PAID;
   REFUNDED không có yêu cầu huỷ, không có `cancelled_at`, refund bằng tổng
   tiền; mỗi refund có đúng một payment event hoàn cùng số tiền và cùng mốc; tổng
   hoàn ≤ tổng tiền.
6. **Review:** giữ bảy bất biến §7 (13–19) của spec 10/09, cộng: mốc viết,
   duyệt, rút ≤ H. Lệch đo được lúc viết plan: bất biến 19 đòi ≥ 50% review là
   5★, nhưng chữ review đang có chỉ đạt 46% (55/119 đoạn), nên ngưỡng hạ xuống
   ≥ 40%; dải trung bình [4,1; 4,6] giữ nguyên.
7. **Enquiries và subscribers:** mọi dòng qua đúng schema output của contract
   (map bằng mapper của API) nên không dòng nào làm vỡ trang admin; chuỗi trạng
   thái hợp lệ; `updated_at` đúng luật §5.1; subscriber chỉ thuộc bốn trạng thái
   §5.2; email không trùng; `source` null; các ngưỡng 28 ngày §5.1 và §5.2.
8. **Tất định:** cùng một H sinh hai lần ra kết quả y hệt.

**Hoàn thành:** `pnpm gate:int` xanh (chạy có hãm tài nguyên như lượt 14/09) ·
độ phủ ≥ 80% trên logic mới (CLAUDE.md luật 4) · `verify-seed.mjs` báo 0 vi
phạm trên Docker · seed chạy lại trên Docker thêm 0 dòng ở mọi bảng · smoke giao
diện qua.

## 7. Nghiệm thu SQL — `apps/api/scripts/verify-seed.mjs`

Chỉ đọc. Nhận `DATABASE_URL` và `SEED_HOM_NAY`; in từng bất biến kèm số vi phạm;
exit 1 nếu có vi phạm. Script mới `seed:verify` trong `apps/api/package.json`.

- **Khung ngày:** quét `information_schema` — mọi cột timestamp/date của các bảng
  seed nằm trong [01/01/2026, H]; ngày khởi hành của chuyến còn bán ≤ 31/12.
  Ngoại lệ có chủ đích: `tours.updated_at` và `tour_departures.updated_at` được
  phép tới giờ chạy seed (bước tính rating và giá vốn ghi `now()`); `users` và
  `accounts` chỉ kiểm dòng của khách giả (`@example.com`) — admin là tài khoản
  giữ lại, seed upsert nó nên `updated_at` của admin mang giờ chạy seed; bảng giữ
  lại chỉ kiểm nằm trong 2026, trừ `tour_categories` (Q8); bỏ qua `sessions`,
  `verifications`, `_prisma_migrations`.
- **14 bất biến nghiệm thu của đợt 10/09:** booking thiếu `cost_per_person` ·
  `total_amount` lệch đơn giá × ghế · huỷ trước khi trả tiền · trả tiền sau
  ngày đi · trả tiền sau H · booking trùng khách và chuyến · khách chồng lịch ·
  overbooking · ghế lệch booking PAID · chuyến khởi hành trước H còn OPEN ·
  review CURATED · review thiếu user hoặc booking · review viết trước khi chuyến
  xong · tour không có rating.
- **Hình dạng §4.4:** 0 PENDING; 0 booking CANCELLED đã trả mà thiếu yêu cầu huỷ
  REFUNDED; 0 booking REFUNDED có yêu cầu huỷ hoặc `cancelled_at`; tổng refund ≤
  tổng tiền; mỗi refund một payment event hoàn.
- **Enquiries và subscribers:** chuỗi trạng thái hợp lệ; `updated_at` đúng luật;
  subscriber thuộc bốn trạng thái cho phép.
- **Tiền đề và bổ sung (review cuối 14/09):** đúng 120 khách giả; đúng 1 ADMIN;
  yêu cầu DENIED/REQUESTED trỏ booking PAID; booking REFUNDED có tổng refund
  bằng tổng tiền; yêu cầu DENIED/REFUNDED có người và mốc quyết;
  `subscribers.updated_at` là mốc mới nhất; `rating_avg`/`rating_count` khớp
  review đã duyệt. Script đặt phiên READ ONLY ngay sau khi kết nối.
- **Tác dụng phụ:** `outbox` có 0 dòng PENDING.

## 8. Vận hành

### 8.1 Nhánh và tài liệu

- Làm tiếp trên `chore/seed-buoc1-snapshot`: cùng đợt seed, cùng các file, và dữ
  liệu prod đang lấy từ nhánh này. Review phần mới tính từ `df857ad6`.
- Spec này nằm trong bản đồ `docs/README.md`; spec 10/09 có dòng trỏ sang đây.
- Plan và prompt thi công đặt ở `docs/plans/`, theo nếp P5a.

### 8.2 Thi công — session riêng, theo plan

- TDD theo §6; comment tiếng Việt; commit Conventional Commits tiếng Việt có
  dấu, không AI attribution; hỏi user trước khi push; tuyệt đối không chạm prod
  (CLAUDE.md luật 15).
- Dọn kèm: comment trong `prisma/seed.ts` và `scripts/reset-operational-data.mjs`
  còn nói `.env.local` trỏ Supabase (nay là Docker); `.env.example` ghi "40 khách
  giả" (thực tế 120) và cần thêm `SEED_HOM_NAY`.
- Khi xong: báo cáo theo tiêu chí "Hoàn thành" ở §6.

### 8.3 Lượt prod 1 — session gốc, sau review

Điều kiện: review xong và đã sửa hết phát hiện; user đã đặt
`SEED_CUSTOMER_PASSWORD` RIÊNG cho lượt prod trong `apps/api/.env.production`
(gitignored — không bao giờ ghi vào `.env.example` hay commit; mặc định trong code
đã lộ trên GitHub, seed nhắm prod mà trống hoặc trùng mặc định đó thì từ chối).
Cần cho giám khảo đăng nhập khách giả thì gửi mật khẩu riêng tay. Chạy vào giờ
vắng — site mất lịch khởi hành và sao đánh giá khoảng 5–10 phút tới khi ISR sinh
lại.

**Bước 0 — tập dượt Docker với ĐÚNG H của lượt prod** (cùng ngày chạy), trong một
shell RIÊNG mở trước và KHÔNG BAO GIỜ export `DATABASE_URL` của Supabase —
`prisma.config.ts` lấy `DATABASE_URL ?? localhost`, nên chạy `prisma migrate reset`
trong shell prod là reset nhầm prod. Trình tự: `prisma migrate reset` → `db:seed`
→ `seed:verify` 0 vi phạm. Tuỳ chọn: thử chốt chặn mà không tốn I/O mạng bằng host
giả, ví dụ `DATABASE_URL=postgresql://u:p@guard-check.supabase.co:5432/x` đặt ngay
trước lệnh (không export), cho bốn ca: thiếu cờ; có cờ mà thiếu `SEED_HOM_NAY`;
H = hôm nay + 2 ngày; H hợp lệ nhưng `SEED_CUSTOMER_PASSWORD=` trống. Cả bốn phải
dừng trước khi Prisma kết nối. Xong thì đóng shell tập dượt.

Từ `apps/api`, trong Git Bash, ở MỘT shell prod mới — dùng suốt lượt chạy, không
chạy lệnh Docker hay `prisma migrate` nào trong shell này:

```bash
# `tr -d '\r'`: `.env.production` sửa trên Windows có thể mang CRLF (đo 15/09).
export DATABASE_URL="$(grep '^DATABASE_URL=' .env.production | cut -d= -f2- | tr -d '\r')"
export ADMIN_EMAILS="$(grep '^ADMIN_EMAILS=' .env.production | cut -d= -f2- | tr -d '\r')"
export SEED_CUSTOMER_PASSWORD="$(grep '^SEED_CUSTOMER_PASSWORD=' .env.production | cut -d= -f2- | tr -d '\r')"
export SEED_HOM_NAY="$(date -u +%F)"
pnpm snapshot:export
pnpm data:reset
pnpm data:reset -- --apply --toi-biet-day-la-production
pnpm db:seed -- --toi-biet-day-la-production
pnpm seed:verify
```

1. `snapshot:export` sinh `docs/snapshots/<ngày>/` (commit được, không PII) và
   `backups/<ngày>/` (gitignored). `ADMIN_EMAILS` export ở trên quyết định admin
   được giữ trong keep-list.
2. `data:reset` chạy khô trước; soát số dòng rồi mới chạy thật. Trên prod cả hai
   lượt đều dừng nếu admin trong keep-list không trùng `ADMIN_EMAILS[0]` — kiểm
   trước khi xoá bất cứ gì.
3. Sau seed: `seed:verify` 0 vi phạm (gồm "số tài khoản ADMIN khác 1"); đo lại
   truy vấn khung ngày của §1 (0 dòng trước 2026, 0 dòng sau 31/12); `outbox` 0
   PENDING.
4. Trang web và admin trả 200 — gọi mỗi URL hai lần vì stale-while-revalidate
   trả bản cũ ở lần đầu. User tự đăng nhập admin kiểm các trang admin (quyết định
   14/09: smoke admin làm trên prod, không nâng thêm tài khoản nào lên admin).
5. Chạy lại khi có sự cố: vẫn trong shell prod, dùng lại đúng `SEED_HOM_NAY` đã
   export, không gõ lại `date`. Seed dừng với `sàn booking đã đi` hoặc `sàn review`
   thì chưa có dòng nào bị ghi — chỉ `export SEED_HOM_NAY=<hôm qua>` rồi chạy lại
   `pnpm db:seed -- --toi-biet-day-la-production` và `pnpm seed:verify` (chốt chặn
   mốc vẫn nhận H = hôm qua). Muốn tập dượt lại với H mới thì làm ở shell tập dượt
   riêng, không bao giờ trong shell prod. Seed từ chối vì admin hoặc vì thế hệ H thì
   làm theo thông điệp, không tìm cách vượt chốt.

### 8.4 Merge

1. Entry `docs/CHANGELOG.md` trên nhánh: H đã dùng, số dòng từng bảng, phát hiện
   review, số test; mục CÒN TREO ghi lượt 2 (§8.5). Rebase đổi hash mọi commit
   của nhánh, nên các hash commit của nhánh được nhắc trong entry 10/09 (ví dụ
   `736d1a68`, nay là `1e000074`) phải cập nhật cho khớp — các entry ấy chưa vào
   `main` nên chưa thành bản ghi bất biến.
2. Rebase lên `main` mới nhất, `git merge --ff-only`, push, liếc đèn CI
   (`gh run list --branch main --limit 1`, luật 14), xoá nhánh.
3. Làm liền sau bước nghiệm thu §8.3 để khoảng lệch pha giữa dữ liệu prod và
   `main` chỉ tính bằng giờ.

### 8.5 Lượt prod 2 — khoảng 03/11, trước bảo vệ

- Không sửa code: chạy lại §8.3 với `SEED_HOM_NAY` = ngày chạy. Mốc 03/11 đã có
  test phủ.
- Booking thử, enquiry và subscriber phát sinh giữa hai lượt bị xoá.
- Freeze 15/10 chỉ cấm nâng dependency và đổi nơi deploy, không cấm thao tác dữ
  liệu.
- Entry CHANGELOG riêng cho lượt này.

## 9. Rủi ro và giới hạn đã biết

- **Khoảng trống quanh H:** không có chuyến đang diễn ra và không có giao dịch
  trong ngày H. Chấp nhận để luật trạng thái chuyến đơn giản.
- **Thời gian trôi sau khi seed:** chuyến còn bán khởi hành trước ngày thật vẫn
  OPEN. Web ẩn chúng (`catalog.service.ts` lọc `start_date ≥ hôm nay`), admin chưa
  có màn departures; lượt 2 dọn lại.
- **Cửa sổ suy giảm** giữa reset và seed xong, cộng thời gian ISR sinh lại.
- **Lịch sử là hư cấu theo luật hiện tại của app** (ân hạn 24 giờ, luồng W4,
  double opt-in, `enquiry_status_events`) — không mô phỏng dữ liệu kiểu cũ trước
  khi các tính năng ấy ra đời.
- **Dữ liệu giữ lại lệch mốc:** `tours.created_at` (31/07) muộn hơn booking đầu
  tiên của tour; `tour_categories.created_at` ở 2025. Không màn nào hiển thị (Q8).
- **2 phiên admin mang `created_at` 10/10/2026** — không do seed, reset giữ phiên
  admin; hết hạn 17/10.
- **Nếu ngày bảo vệ dời muộn:** H hợp lệ tới 01/12; muộn hơn phải nới khung ở §3.
- **Demo trên dữ liệu seed:** duyệt một yêu cầu huỷ REQUESTED có bậc hoàn > 0%
  hoặc phát hành hoàn tiền goodwill sẽ lỗi `ProviderRefundFailedError` ở gateway
  vì provider id là giả; giao dịch rollback sạch. Từ chối (DENY) và bậc 0% chạy
  được. Tránh hai luồng đó khi demo bảo vệ.
