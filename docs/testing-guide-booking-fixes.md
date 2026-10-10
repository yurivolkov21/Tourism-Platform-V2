# Hướng dẫn test các lỗi đã sửa — nhánh fix/mobile-booking-screens

Nguồn lỗi: [review-feat-mobile-booking-screens.md](review-feat-mobile-booking-screens.md) (K1–K15, Q1).
Phạm vi: chỉ các mục K1–K15 trong 3 commit riêng của nhánh booking. B1–B3 (nhánh account) không nằm ở đây.

> **Trạng thái 2026-10-08:** phần A (test tự động) xanh: mobile 95 suite / 623 test, Biome sạch, tsc sạch. Phần B đã chạy trên điện thoại thật cho phần lớn mục (kết quả ở mục E). K10 đã chạy xong 01:10 ngày 9/10 giờ VN (đạt, mục E). K15 và K2 đã đạt trên máy ảo Android ngày 9/10. iOS không kiểm (quyết định 9/10: máy dev là Windows, không có Mac/iPhone). Còn lại: PayPal sandbox thật, `pnpm gate:int` chưa chạy.

## A. Test tự động

```bash
cd apps/mobile
npx jest --ci                 # toàn bộ mobile
npx tsc --noEmit -p .         # typecheck
cd ../.. && npx biome check apps/mobile/src libs/shared/i18n/src
pnpm gate:int                 # gate đầy đủ trước khi khai xong (luật 11) — CHƯA chạy
```

Sau khi sửa `libs/shared/i18n`, build lại để mobile thấy kiểu mới: `pnpm turbo run build --filter=@tourism/i18n`.

| Mục | File test | Test khẳng định |
| --- | --- | --- |
| K1 | `features/booking/booking-draft.spec.ts` | Đổi số khách / liên hệ / cổng thanh toán thì quên `bookingCode` (Pay sau tạo booking mới đúng nội dung); ghi lại giá trị cũ thì giữ; `completeBookingDraft` xoá draft và chỉ giữ bản chụp cho B8 |
| K2 | `lib/use-server-clock.spec.tsx` | Đồng hồ server nhích đúng 60s khi giờ máy qua 60s (trước sửa: đứng yên — đã thử lại, test đỏ với code cũ) |
| K3 | `features/trip-tracker/trip-tracker.spec.ts` (`tripLoadState`) | `byCode` lỗi + query tour tắt (pending mãi) vẫn ra `error`, không kẹt `loading` |
| K5 | `features/booking/booking-detail.spec.ts` (`payErrorAction`) | `DEPARTURE_NOT_AVAILABLE` → đóng, `NOT_PENDING` → đọc lại, còn lại → hiện câu lỗi |
| K9 | `features/booking/booking-form.spec.ts` (`verifyOutcome`) | PAID → paid; CANCELLED/REFUNDED/PARTIALLY_REFUNDED → ended; PENDING → chờ tiếp |
| K12 | `features/booking/enquiry-form.spec.ts` | Email có khoảng trắng đầu/cuối vẫn hợp lệ |
| K13 | `features/booking/cancel-sheet.spec.tsx` | Ô lý do có `maxLength` 1000 |
| K14 | `features/booking/booking-draft.spec.ts` | Bản chụp B8 mang `totalAmount` do server trả |
| K15 | `features/booking/open-checkout.spec.ts` | `openCheckout` trả `false` khi trình duyệt ném lỗi (không còn nuốt lỗi) |

K4, K6, K7, K8, K10, K11 nằm trong file route/JSX nên chưa có test tự động riêng — kiểm tay ở phần B.

## B. Test tay (máy thật hoặc emulator)

Chuẩn bị: API local + Postgres chạy, mobile trỏ vào API (`pnpm dev` theo README), đăng nhập một tài khoản khách, Stripe ở **test mode** (thẻ `4242 4242 4242 4242`, hạn và CVC bất kỳ). Local không cấu hình PayPal nên PayPal luôn báo lỗi phiên thanh toán. Theo dõi log API hoặc đếm booking trong DB để biết request nào được gọi.

### K1 — không đặt trùng booking (làm đầu tiên, phạm luật tiền)

1. Chọn tour → Book now → hết B1–B3 → B4 Pay. Màn B5 hiện ("Open payment page"). Ở B5 bấm **nút back của header** về B4.
2. Bấm Pay lần nữa. **Mong đợi:** gọi `POST /api/bookings/{code}/checkout`, KHÔNG có `POST /api/bookings` mới; DB vẫn đúng MỘT booking PENDING của lượt đó.
3. Quay B1 → đổi số khách → Pay. **Mong đợi:** tạo booking MỚI đúng nội dung (booking cũ nằm lại PENDING, cron TTL dọn).
4. Đổi cổng sang PayPal ở B4 → Pay. **Mong đợi:** app gọi tạo mới cho PayPal (local: khung lỗi "We couldn't start the payment session"), KHÔNG nhảy sang B5 bằng booking Stripe cũ. Nếu có sandbox PayPal: ra booking PayPal mới.
5. Trả tiền thành công bằng thẻ test → B6 → B8. Ở B8: iOS vuốt từ mép trái, Android bấm nút back cứng. **Mong đợi:** không đi đâu; chỉ rời bằng "View" / "Browse more tours".
6. Sau B8, vào lại tour và bấm Book now. **Mong đợi:** draft mới sạch, không kế thừa dữ liệu lượt trước.

### K2 — đồng hồ server chạy tiếp

Mở P1/P5 (trip tracker) của một booking PAID đang đi, để yên 1–2 phút. **Mong đợi:** nhãn theo giờ (`timedStopStates`, mốc "hôm nay") chuyển trạng thái đúng giờ, không đứng yên tới khi tắt app.

### K3 — lỗi tải lần đầu có nút thử lại

1. Cách nhanh, không cần tắt API: mở `/trips/BK-ZZZZZZZZ` (mã không tồn tại) khi đã đăng nhập. Hoặc tắt API/bật chế độ máy bay rồi mở `/trips/{code}` của booking PAID.
2. **Mong đợi:** khung "Couldn't load this booking." + nút Try again, KHÔNG phải màn "Coming soon".
3. Bấm Try again. **Mong đợi:** nháy khung chờ rồi về lại khung lỗi (mã không tồn tại) hoặc vào đúng màn P1/P2/P5/P6 (booking thật).

### K4 — quá hạn huỷ miễn phí không hứa hoàn tiền

Dùng booking PAID mà hôm nay đã quá `cancellationDeadline` (sửa `departure_start_date` trong DB cho sát ngày nếu cần, chuyến 3 ngày bắt đầu hôm sau là đủ). Mở chi tiết booking. **Mong đợi:** khung cảnh báo "Free cancellation ended" + câu "It ended on {ngày}. You can still cancel, but this booking won't be refunded.", KHÔNG còn khiên xanh "you get $0 back". Booking còn hạn vẫn hiện khiên xanh như cũ.

### K5 — lỗi khi bấm Pay ở T5 hiện ra ngay

Dùng booking PENDING:

- **Đợt đã đóng:** đặt `tour_departures.status = 'CLOSED'` trong DB rồi bấm Pay. **Mong đợi:** khung "This date is no longer available", nút Pay biến mất, nút "Cancel this booking" còn. Nhớ trả lại `OPEN` sau khi test.
- **Lỗi chung:** tắt API rồi bấm Pay. **Mong đợi:** khung cảnh báo với câu lỗi, không im lặng.
- **`NOT_PENDING`:** mở T5 trên app, trả tiền booking đó ở web, quay lại app bấm Pay. **Mong đợi:** màn tự đọc lại và chuyển sang T4 (PAID).

### K6 — tab Trips tự làm mới

1. Mở tab Trips (để danh sách vào cache), chạm một booking PENDING, bỏ nó, bấm back. **Mong đợi:** thẻ đã là "Cancelled", không cần kéo/reload app.
2. Booking PENDING: bấm Pay, trả xong trong trình duyệt, đóng trình duyệt. **Mong đợi:** chi tiết đọc lại, tab Trips cập nhật.

### K7 — ngày hoàn tiền và PARTIALLY_REFUNDED

- Hoàn tiền bằng admin (goodwill, không qua đơn xin huỷ) rồi mở chi tiết khách. **Mong đợi:** "{số tiền} refunded", KHÔNG in ngày đặt chỗ. Dựng bằng SQL: chèn một dòng vào `refunds` (`amount`, `currency`, `booking_id`) và đặt booking `PARTIALLY_REFUNDED`.
- Khách tự huỷ (có `cancellationDecidedAt`/`cancelledAt`): **mong đợi** "{số tiền} refunded on {ngày huỷ}".
- Booking `PARTIALLY_REFUNDED` còn `cancellation.canCancel`: **mong đợi** còn nút huỷ ở T8. Cần `provider_payment_id` khác null thì nút huỷ mới hiện.

### K8 — "Contact us" trong tấm huỷ

Booking PAID quá hạn → Cancel booking → tấm T7 → "Something serious happened? Contact us". **Mong đợi:** tấm đóng và form enquiry hiện đầy đủ (kiểm thêm trên iOS, nơi trước đây tấm đè lên form). Quay lại bằng back: tấm không còn mở.

### K9 — vòng xác nhận thanh toán

- **Rời màn:** vào B6 rồi bấm back ngay. **Mong đợi:** log API ngừng gọi `GET bookings/{code}`.
- **Booking đã chết:** ở B6, đặt booking `CANCELLED` trong DB. **Mong đợi:** "This booking is no longer active" + nút "View booking", KHÔNG có lời mời trả lại.

### K10 — "hôm nay" theo giờ Việt Nam

Chỉ kiểm được trong khung 00:00–07:00 giờ Việt Nam (17:00–24:00 UTC). Cho một booking PAID khởi hành đúng hôm nay (giờ VN; `departure_start_date` = ngày VN trừ 1 ngày lúc 17:00Z), mở tab Trips. **Mong đợi:** thẻ "On tour now" và nhóm Upcoming/Past đúng theo ngày Việt Nam. Task lịch `k10-trips-today-vn-test` làm đúng việc này.

### K11 — chữ cứng đã vào i18n

Không đổi giao diện tiếng Anh. Soát: lịch trình ("1 day · Hà Nội"), P6 ("{giá} paid"), "Tours near A and B".

### K12 — enquiry

- Gõ email có dấu cách thừa cuối chuỗi → Send. **Mong đợi:** gửi được, email lưu đã cắt. Lưu ý: nếu `RESEND_API_KEY` có giá trị thì enquiry gửi email thật.
- Mở enquiry từ booking (có `tourSlug`), bấm Send ngay khi mạng chậm. **Mong đợi:** nút ở trạng thái đang gửi tới khi tour tải xong; hàng `enquiries` có `tour_id`.

### K13 — giới hạn lý do huỷ

Dán chuỗi >1000 ký tự vào ô lý do ở T6. **Mong đợi:** bị cắt ở 1000 ký tự (không bấm xác nhận nếu đang dùng booking thật).

### K14 — tổng tiền ở B8

Sau khi trả tiền, so tổng ở B8 với "Total paid" trong chi tiết booking. **Mong đợi:** khớp (B8 dùng số server).

### K15 — không mở được trang thanh toán

Emulator Android không có trình duyệt (hoặc vô hiệu mọi trình duyệt/Custom Tabs trên máy thật) → B5 bấm "Open payment page". **Mong đợi:** dòng "Couldn't open the payment page. Please try again." thay vì im lặng. Tương tự ở B7 và nút Pay của T5. Nhớ bật lại trình duyệt sau khi test.

## C. Điều khiển điện thoại bằng adb (cách đã dùng)

- adb ở `C:\platform-tools\adb.exe`; trong Git Bash đặt `export MSYS_NO_PATHCONV=1`. Điện thoại tự hiện qua wifi (gỡ lỗi không dây bật, `adb devices` thấy `adb-<serial>._adb-tls-connect._tcp`).
- App chạy trong Expo Go; Metro `:8081` và API `:3001` trên PC. Mở thẳng một màn: `adb shell am start -a android.intent.action.VIEW -d "exp://<IP-PC>:8081/--/bookings/BK-XXXX" host.exp.exponent`. Tour: `/tours/<slug>?tab=dates`, enquiry: `/enquiry?tourSlug=<slug>&tripTitle=...`.
- Đọc màn hình: `adb exec-out screencap -p > a.png`, hoặc `adb shell uiautomator dump /sdcard/u.xml` rồi `adb pull`. Toạ độ chạm tính trên ảnh gốc 1080x2340 (ảnh hiển thị nhân 1.17).
- Gõ: `adb shell input text "a%sb"` (`%s` là dấu cách); nút back cứng: `input keyevent KEYCODE_BACK`; vuốt: `input swipe 3 1200 700 1200 250`.
- DB local (Postgres `localhost:5432`, không có `psql`): dùng node với gói `pg` của `apps/api`, đọc `DATABASE_URL` từ `apps/api/.env.local`. Cột dạng snake_case (`departure_start_date`, `provider_payment_id`, `paid_at`).
- Không tự động hoá: nhập thẻ trên trang Stripe và đổi cấu hình hệ thống điện thoại (tắt trình duyệt) — để người test làm.

## D. Dữ liệu thử đã tạo trong DB local

- Các booking thử nay đều `CANCELLED`: `BK-GP9VJFKF`, `BK-7LJV4SY3`, `BK-Y4NF5HGE`, `BK-O78UILIL`. Task K10 đã tạm biến `BK-7LJV4SY3` thành PAID rồi trả lại CANCELLED.
- `BK-JZ1AA3NC` còn `PENDING` (mồ côi do đổi cổng, cron TTL dọn).
- `BK-R2Y2P1KU` là booking PAID thật từ lần thanh toán Stripe test.
- Một enquiry K12 (`K12 retest trim email and tour link`) đã ghi vào `enquiries`.
- Đợt 14/11 của tour Hanoi Old Quarter đã trả về `OPEN` sau khi test K5.

## E. Kết quả chạy thật trên điện thoại (2026-10-08)

Máy: Galaxy S24 Ultra (Android 16) qua adb wifi, Expo Go, API và Postgres local. Một số trạng thái được dựng bằng SQL trên DB local rồi khôi phục (đợt đóng, booking PAID quá hạn, hoàn một phần, đánh dấu PAID để vào B8 mà không cần thẻ).

| Mục | Kết quả | Ghi chú |
| --- | --- | --- |
| K1 | Đạt | Pay lần 2 ở B4 không tạo booking mới (DB vẫn 1 PENDING); đổi số khách thì tạo booking mới; B8 chặn cả back cứng lẫn vuốt từ mép (kiểm bằng luồng mô phỏng PAID). **Tìm ra và sửa 1 lỗi:** `pay()` dùng `draft` cũ nên đổi cổng thanh toán vẫn checkout nhầm booking cũ |
| K1 đổi cổng PayPal | Đạt (sau khi sửa) | Tạo booking Stripe, quay lại B4, chọn PayPal, Pay: app gọi `create` cho PayPal (khung lỗi vì local không cấu hình PayPal), không còn checkout nhầm booking Stripe cũ. Chưa thử với sandbox PayPal thật |
| K1 trả tiền Stripe thật | Đạt | Người test nhập thẻ test: `BK-R2Y2P1KU` thành PAID lúc 12:35:27 UTC, có `provider_payment_id` (webhook local chạy), tab Trips hiện Paid. Nút back từ B8 chưa kiểm lại trong lượt này, đã kiểm ở dòng K1 |
| K2 | Đạt (máy ảo Android) | 2026-10-09: chỉnh giờ máy ảo lệch +3 ngày (12/10), tắt tự cập nhật giờ. Chi tiết `BK-R2Y2P1KU` vẫn hiện "DEPARTING IN 36 days" (tính theo giờ server; theo giờ máy sẽ ra 33). Chưa kiểm đồng hồ nhích theo thời gian trên máy — phần này chỉ có test tự động |
| K3 | Đạt | Mở `/trips/<mã không tồn tại>`: "Couldn't load this booking." + Try again (không còn "Coming soon"); bấm Try again chỉ nháy khung chờ rồi về lại khung lỗi. Không cần tắt API |
| K4 | Đạt | Quá hạn: "Free cancellation ended", không còn khiên xanh; còn hạn: khiên xanh như cũ |
| K5 | Đạt (đợt đóng) | Hiện "This date is no longer available", mất nút Pay, còn nút bỏ booking. Chưa thử `NOT_PENDING` và lỗi mạng |
| K6 | Đạt | Bỏ booking trong chi tiết, về Trips thấy ngay "Cancelled". Chưa thử nhánh trả tiền xong rồi đóng trình duyệt |
| K7 | Đạt | "$10 refunded" không in ngày; `PARTIALLY_REFUNDED` còn nút Cancel booking. Chưa thử nhánh có ngày huỷ |
| K8 | Đạt | "Contact us" đóng tấm, form enquiry hiện đủ, quay lại không còn tấm. Không kiểm trên iOS (bỏ qua theo quyết định 9/10) |
| K9 | Đạt (booking chết) | Huỷ trong lúc ở B6 → "This booking is no longer active" + View booking. Chưa soi log API cho nhánh rời màn |
| K10 | Đạt | Chạy 2026-10-09 01:10-01:15 giờ VN (USB, `adb reverse`). `BK-7LJV4SY3` PAID, ngày khởi hành 2026-10-09: chip All hiện "On tour now", Upcoming có thẻ này, Past không có. Lưu ý: cột `departure_*_date` là kiểu DATE nên phải đặt `'2026-10-09'` (đặt `T17:00:00Z` bị cắt thành 8/10, không ra nhãn). Ảnh: `docs/evidence/k10-*.png`. Booking đã khôi phục CANCELLED. |
| K11 | Đạt | "1 day · Hà Nội" ở lịch trình. Chưa soi P6 và "Tours near" |
| K12 | Đạt | Email có 3 dấu cách cuối được lưu đã cắt, `tour_id` có giá trị. Có gửi enquiry thật (Resend có key) |
| K13 | Đạt | Gõ 1100 ký tự, ô giữ đúng 1000 |
| K14 | Đạt | B8 hiện $35 khớp "Total paid" |
| K15 | Đạt (máy ảo Android) | 2026-10-09: máy ảo Android 14 đã tắt Chrome (không còn trình duyệt). Đặt tour tới B5, bấm "Open payment page": hiện "Couldn't open the payment page. Please try again.". Ảnh `docs/evidence/k15-emulator.png`. Booking thử `BK-2XM7CD6Z` đã chuyển CANCELLED. Máy ảo đã xoá |

## F. Còn mở

- `docs/PROGRESS.md` (Q3) và bỏ commit `4f9def36` (Q2): xử lý lúc rebase/merge, không phải lúc sửa lỗi.
- `pnpm gate:int` trên đỉnh nhánh sau khi rebase (luật 11).
- Doc đã sửa theo review: dòng `PARTIALLY_REFUNDED` trong `docs/handoff/mobile-booking-handoff.md`, chú thích B9 trong `docs/design/mockups/mobile-booking-screens.src.html` (mockup là bản ghi đã duyệt — cần reviewer xác nhận chỗ sửa này).
- Chưa kiểm: đồng hồ K2 nhích theo thời gian trên máy.
- Bỏ qua, không kiểm: iOS (K8, K1-back) — quyết định 9/10, rủi ro chấp nhận.
- Còn 4 file sửa dở trong `stash@{0}` (nhãn "Refunded" cho CANCELLED có sổ hoàn). Khi `git stash pop` có thể xung đột với `bookings/[code].tsx` và `(tabs)/trips.tsx` vì cùng vùng code.
