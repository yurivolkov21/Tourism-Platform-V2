# Review nhánh feat/mobile-booking-screens

Ngày 2026-10-05 · @Yuri Volkov

**Chưa nên merge.** Nhánh gồm trọn nhánh account cộng 3 commit riêng, nên dính 3 lỗi chặn B1–B3. Phần riêng có một lỗi phạm luật tiền: đặt trùng booking. Tổ hợp với main mới nhất vẫn chạy xanh.

Phạm vi: 59 commit `80e36099..4f9def36`, gồm 56 commit của `feat/mobile-account-screens` và 3 commit riêng của Nghia ngày 04/10 (`cc02e089`, `a1151721`, `4f9def36`). Mọi phát hiện đã xác minh qua code, API và mã nguồn thư viện; một lỗi tái hiện bằng chạy thật; chưa thử trên máy thật.

> **Cập nhật 2026-10-09:** K10 test trên điện thoại thật trong khung 00:00-07:00 giờ VN, đạt; K2 và K15 đạt trên máy ảo Android. iOS (K8, nút back từ B8) quyết định không kiểm (xem [testing-guide-booking-fixes.md](testing-guide-booking-fixes.md), mục E).

> **Cập nhật 2026-10-08:** K1–K15 và Q1 đã sửa trên nhánh `fix/mobile-booking-screens` (chưa commit). Còn lại: Q2, Q3, B1–B3 của nhánh account và rebase lên main lúc merge. Hướng dẫn và kết quả test: [testing-guide-booking-fixes.md](testing-guide-booking-fixes.md). Chú thích B9 trong mockup và dòng `PARTIALLY_REFUNDED` trong handoff đã sửa theo mục 5 của thứ tự đề xuất.

## Phần thừa hưởng từ nhánh account

56 commit đầu trùng hẳn nhánh account (`3d560bd5` là tổ tiên trực tiếp), nên mọi mục trong "Review nhánh feat/mobile-account-screens" đều áp dụng ở đây, gồm 3 lỗi chặn B1–B3 và 10 commit có `Co-Authored-By: Claude`.

Sửa các mục đó trên nhánh account là đủ. Doc này chỉ bàn 3 commit riêng.

## Lỗi riêng của nhánh

18 mục từ 3 commit riêng, xếp theo mức độ. Luồng đặt tour B1–B9, chi tiết booking, trip tracker và tab Trips nằm trong một commit 74 file (`cc02e089`). Đường dẫn không ghi gốc thì tính từ `apps/mobile/src/`.

| # | Mức | Vị trí | Lỗi | Cơ sở | Trạng thái |
|---|-----|--------|-----|-------|------------|
| K1 | Trung bình | `app/bookings/new/review.tsx:50` | Trả tiền xong, bấm back 2 lần từ màn thành công là về B4 với nút Pay còn bật; `pay()` bỏ qua `draft.bookingCode` và server không chặn, nên tạo được booking thứ hai và trả tiền lần hai (trái quy tắc #2 của handoff) | Đọc code, API, thư viện | Đã sửa · kiểm máy thật (Stripe, back từ B8, đổi số khách/cổng) |
| K2 | Trung bình | `lib/use-server-clock.ts:19` | `select` viết inline nên offset tính lại mỗi lần render; đồng hồ server đứng yên, đếm ngược, "hôm nay" và timeline P5 kẹt tới khi tắt app | Tái hiện bằng chạy thật | Đã sửa · test tự động (đỏ với code cũ) |
| K3 | Trung bình | `app/trips/[code]/index.tsx:108` | Lần tải đầu lỗi thì màn hiện "Coming soon — still building" mãi, không tới được nút thử lại (query phụ thuộc bị tắt nên luôn `isPending`) | Đọc code, thư viện | Đã sửa · kiểm máy |
| K4 | Trung bình | `app/bookings/[code].tsx:264` | Quá hạn huỷ vẫn hiện khiên xanh "Free cancellation… you get $0 back"; không đọc `withinDeadline` (quy tắc #5) | Đọc code, API | Đã sửa · kiểm máy |
| K5 | Trung bình | `app/bookings/[code].tsx:181` | Lỗi khi bấm Pay ở T5 bị nuốt (chỉ hiện trong sheet huỷ đang ẩn); `NOT_PENDING`, `DEPARTURE_NOT_AVAILABLE` không xử lý; copy "date closed" không dùng | Đọc code | Đã sửa · kiểm máy (đợt đóng) |
| K6 | Thấp | `app/bookings/[code].tsx:167` | Huỷ hoặc trả tiền xong, tab Trips vẫn hiện trạng thái cũ (`bookings.mine` không được làm mới) | Đọc code, thư viện | Đã sửa · kiểm máy |
| K7 | Thấp | `app/bookings/[code].tsx:313` | Ngày hoàn tiền in ra ngày đặt (`cancelledAt ?? createdAt`) với mọi lần admin hoàn tiền; `PARTIALLY_REFUNDED` bị coi là kết thúc: handoff ngược với `booking-states.md` và API, cần sửa handoff | Đọc code, seed | Đã sửa · kiểm máy; handoff đã sửa |
| K8 | Thấp | `app/bookings/[code].tsx:389` | "Contact us" trong sheet huỷ đẩy màn enquiry mà không đóng sheet; trên iOS sheet đè lên form | Đọc code, thư viện | Đã sửa · kiểm máy |
| K9 | Thấp | `app/bookings/new/verify.tsx:48` | Vòng hỏi trạng thái chạy cả sau khi rời màn; `CANCELLED`, `REFUNDED` bị coi là chưa trả và mời trả lại | Đọc code | Đã sửa · kiểm máy |
| K10 | Thấp | `app/(tabs)/trips.tsx:68` | Tính "hôm nay" theo UTC thay vì giờ Việt Nam; mỗi ngày có 7 tiếng nhãn "On tour now" và nhóm Upcoming/Past bị sai | Đọc code | Đã sửa · test máy đạt 01:10 ngày 9/10 (All hiện "On tour now", Upcoming có, Past không) |
| K11 | Nhỏ | `app/trips/[code]/itinerary.tsx:64`, `index.tsx:209` | Chữ viết cứng ngoài i18n: `day` / `days`, `paid`, `and` (luật 7) | Đọc code | Đã sửa · kiểm máy |
| K12 | Nhỏ | `features/booking/enquiry-form.ts:33`, `app/enquiry.tsx:69` | Email bị kiểm trước khi cắt khoảng trắng; `tourId` bị bỏ nếu tour chưa tải xong | Đọc code | Đã sửa · kiểm máy |
| K13 | Nhỏ | `features/booking/cancel-sheet.tsx:116` | Lý do huỷ không giới hạn 1000 ký tự như contract và web | Đọc code | Đã sửa · kiểm máy |
| K14 | Nhỏ | `app/bookings/new/success.tsx:26` | B8 hiện tổng tiền do điện thoại tính, bỏ `totalAmount` server trả về | Đọc code | Đã sửa · kiểm máy |
| K15 | Nhỏ | `app/bookings/new/checkout.tsx:33` | Lỗi của `openBrowserAsync` không được bắt; nút mở trang thanh toán im lặng khi không mở được | Đọc code, thư viện | Đã sửa · test tự động; kiểm máy ảo Android đạt 9/10 |
| Q1 | Quy ước | `booking-draft.ts`, `use-server-clock.ts` | Không có test, đúng hai chỗ chứa K1 và K2 (luật 4) | Cây file | Đã sửa (`booking-draft.spec.ts`, `use-server-clock.spec.tsx`) |
| Q2 | Quy ước | `4f9def36` | Vá test admin khác cách main đã vá; git gộp thành hai lớp ghim ngày, nên bỏ commit này khi rebase | Merge thử, chạy test | Chưa · làm lúc rebase |
| Q3 | Quy ước | `docs/PROGRESS.md` | Doc tạm vẫn còn và còn được sửa thêm ở commit này | Cây file | Chưa · làm trước khi merge |

## Sửa lỗi đặt trùng booking (K1)

B6 xác nhận PAID bằng `router.replace`, nhưng lệnh này chỉ thay màn trong stack đặt tour, nên sau B8 stack vẫn còn `travellers, contact, review, checkout, success`. B8 chỉ ẩn header, vuốt back (iOS) hoặc nút back cứng (Android) vẫn đi được. Về tới B4, nút Pay chỉ khoá trong lúc request đang chạy, và `pay()` luôn gọi `bookings.create`. API tạo booking PENDING mới mà không kiểm booking cũ của cùng khách và cùng chuyến (`bookings.service.ts:399-431`).

Cần làm cả ba việc:

1. Draft đã có `bookingCode` thì gọi `bookings.checkout` của booking đó, không tạo booking mới.
2. Chặn back ở B8 (tắt cử chỉ vuốt và nút back cứng), hoặc cho back dẫn về chi tiết booking.
3. Xoá draft ngay khi B6 xác nhận PAID, không đợi người dùng bấm nút ở B8.

> Một chỗ lệch tài liệu: chú thích B9 trong mockup ghi lỗi `CHECKOUT_FAILED` là "booking chưa được tạo", nhưng contract nói booking đã tạo ở trạng thái PENDING. Bấm "Try again" vì thế để lại một booking mồ côi; cron TTL sẽ dọn nên rủi ro thấp, nhưng chú thích nên sửa cho khớp API. Muốn chặn hẳn ở server là đổi API, cần ADR riêng trước.

## Đồng bộ với main

Nhánh chậm main 212 commit (main tại `163c348b`). Thử đồng bộ trên máy, không push: có 5 xung đột, gồm 4 file như nhánh account (`apps/api/package.json`, `pnpm-lock.yaml`, `docs/README.md`, `docs/CHANGELOG.md`) và thêm `docs/open-items.md`.

Kết quả trên cây tổ hợp: `test:int` 749/749, gate 28/28 task với 5800 unit test (mobile 599), Biome sạch 1649 file, tokens-only và bundle mobile đạt. CI của đỉnh nhánh (run #373) cũng xanh.

Test admin `bookings-date-range.spec.tsx` được git tự gộp thành hai lớp ghim ngày mà không báo xung đột. Hai lớp ghim cùng một thời điểm nên 13/13 test vẫn qua; chỉ là thừa (Q2).

## Thứ tự đề xuất

Nhánh booking chứa trọn nhánh account, nên phải đợi account vào main trước.

1. Sửa B1–B3 trên nhánh account theo doc account, rồi merge nhánh account.
2. Chuyển 3 commit riêng sang main mới bằng `git rebase --onto origin/main 3d560bd5 feat/mobile-booking-screens`, khỏi gỡ lại 56 commit chung; bỏ commit `4f9def36` (Q2) và gỡ xung đột docs.
3. Sửa K1 theo ba việc ở mục trên, kèm test cho `booking-draft.ts`; sửa K2 kèm test cho `use-server-clock.ts` (Q1). **Đã làm.**
4. Sửa K3–K5, rồi các mục còn lại theo bảng. **Đã làm (K3–K15).**
5. Sửa chú thích B9 trong mockup và chỗ handoff nói về `PARTIALLY_REFUNDED` cho khớp API (K7). **Đã làm.**
6. Chạy `pnpm gate:int` trên đỉnh đã rebase (luật 11), rồi thử trên máy thật luồng trả tiền và nút back từ B8.
7. Xoá `docs/PROGRESS.md` trước khi merge (Q3).
