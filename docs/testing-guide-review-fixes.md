# Hướng dẫn test các lỗi đã sửa — nhánh fix/mobile-review-screens

Nguồn lỗi: [review-feat-mobile-review-screens.md](review-feat-mobile-review-screens.md) (V1–V9, Q1–Q3).
Nhánh nằm ở worktree `C:\capstone\Tourism-Platform-v2\Tourism-Platform-V2-review` (thư mục gốc `Tourism-Platform-V2` vẫn ở `fix/mobile-booking-screens`).
> **Trạng thái 2026-10-10:** phần A (test tự động) đã chạy xanh (08/10). Phần B (test tay) đã chạy bằng adb trên Galaxy S24 Ultra ngày 10/10, kết quả ở mục B0. Còn nợ: Q1 (viết lại message hai commit đã push), V5, một nửa V9 và V6 (xem B0), rồi rebase.

## B0. Kết quả chạy phần B (10/10/2026, adb + Expo Go)

Chạy trên worktree review: Metro cổng 8082, API cổng 3001 chạy từ worktree (có sửa V5/V6), tài khoản Nghia.

| Mục | Kết quả | Đã quan sát |
| --- | --- | --- |
| V1 | Đạt | R5 và R6 (id không tồn tại): "We couldn’t find that review." + Try again. R1 (`BK-ZZZZZZZZ`): "Couldn't load this booking." + Try again. R4 khi tắt API: "Couldn’t load your reviews." + Try again, không hiện "chưa review"; bật API rồi bấm Try again thì danh sách hiện lại |
| V2 | Đạt | Thêm 21 review tạm (tổng 22 bài). Cuộn xuống cuối My reviews vẫn thấy "Abcd" (bài thứ 22, cũ nhất); trước sửa chỉ lấy 20 |
| V3 | Đạt | Bấm "Help & FAQ" mở Chrome ở `192.168.0.143:3000/faq`, không phải `www.nexora-travel.agency` |
| V4 | Đạt | Account có Saved tours, My reviews, Travel stories, Password và năm dòng link; không có sheet "Help & legal". Personal details không còn Password. Password mở màn đổi mật khẩu. My reviews mở R4 |
| V5 | Chưa kiểm | Import vòng và N query không quan sát được trên máy; dựa vào typecheck và int test |
| V6 | Đạt (một phần qua code) | Gửi lại ở R5 (`reviews.update`) ra R3 "Pending review"; rút ở R7 ra thẻ "Retracted". App không hiện `tourImage` trong phản hồi nên không quan sát được; xác nhận qua code: `update` (`reviews.service.ts:463`) và `retract` (`:557`) đều truyền `this.tourCover(...)` vào `toMyReview`, và `update` có int test mới |
| V7 | Đạt | R1 khi API tắt: "Something went wrong. Please try again." và không tạo review. Review đã bị bác hai lần, bấm "Send for review again": "This review can’t be edited any more." (mã trong bảng, không phải câu chung). Bấm liên tục (28 lần trong ~15 giây) ở R5: "Too many requests — please wait a minute and try again." (429). R1 cho chuyến chưa đi (`BK-RVNBYZLR`): chuyển sang màn "Review this trip when you’re back". Chỉ còn `REVIEW_PHOTO_INVALID` không gây ra được bằng tay (test tự động `review-form.spec`) |
| R5 thêm ảnh mới | Đạt | Gỡ 2 ảnh cũ, thêm 1 ảnh từ thư viện (tải thẳng Cloudinary), bấm "Send for review again": ra R3 "Pending review"; DB có `public_id` mới `tourism/reviews/BK-E5EE0905/…` và 4 ảnh, API không báo `REVIEW_PHOTO_INVALID`. Lưu ý: lần đầu bấm gửi mà chưa thêm được ảnh thì bộ ảnh không đổi (do thao tác, không phải lỗi app) |
| R1 chọn ảnh thư viện | Đạt | Form `BK-B3C32C67`, 4 sao, chọn 5 ảnh từ thư viện: cả 5 ô tải xong (có ô quay tải vài giây), Submit sáng, gửi ra R3 "Pending review"; DB có review mới với 5 ảnh |
| V8 | Đạt | R6: tiêu đề "We’ve looked at this review twice", lý do cuối, dòng "Your trip and booking are not affected.". "Contact us" mở enquiry đã có tên và ảnh tour. "Back to my trip" về `/trips/BK-E5EE0905` |
| V9 | Đạt (một phần qua code) | R5 hiện đủ 5 thumbnail và ảnh bìa tour (`tourImage`). URL có `w_216` không quan sát được (app không ghi log request); xác nhận qua code: `rewrite.tsx:54` gọi `cloudinaryUrl(media.url, 216)` và `cloudinary-url.spec.ts` kiểm hàm chèn `w_<width>` |

Lệch so với hướng dẫn:

- V2, V8, V9 dựng bằng cách sửa DB local, không đi qua admin web. Dữ liệu tạm: 21 review `ZZV2 test` (mỗi review gắn một booking chưa review của Nghia), một sự kiện bác trong `review_moderation_events`, một dòng ảnh mẫu, và đặt review "Abcd" sang trạng thái bị bác rồi published để thử rút.
- Cột `rejectionCount` lấy từ số dòng `review_moderation_events`. "Abcd" vốn đã có một lần bác từ 04/10, nên chỉ cần thêm một sự kiện là thành hết lượt (R6). Dòng sự kiện `to_rejected = true` của tôi đã xoá sau khi test.
- V7: mã `REVIEW_NOT_EDITABLE` thử bằng "đã bác hai lần", 429 thử bằng bấm lặp ở R5 (trần 20 request ghi mỗi phút theo user); `REVIEW_PHOTO_INVALID` vẫn chỉ có test tự động.
- Chụp màn hình lúc bộ chọn ảnh hệ thống mở sẽ lộ ảnh cá nhân (đã xoá file ngay); ảnh chụp bằng `adb screencap` lưu ở `/sdcard/s.png` hiện trong thư viện máy nên cần `adb shell rm` sau mỗi lần chụp.
- Cảnh báo LogBox "Cannot connect to Expo CLI" hiện thoáng qua trên máy; không ảnh hưởng chức năng, chưa tìm nguyên nhân.

Đã hoàn lại DB local sau test. Review "Abcd" về đúng trạng thái cũ (published, không bị bác hay rút, ba mốc thời gian khớp bản sao lưu). 21 review tạm, review thử R1 (`BK-B3C32C67`) cùng ảnh và các sự kiện kiểm duyệt của tôi đã xoá; tổng 120 review như trước. 5 dòng `media_assets` của "Abcd" bị app xoá rồi tạo lại mỗi lần gửi lại, nên đã chèn lại từ bản sao lưu: `public_id` và thứ tự đúng bản gốc, `id` và giờ tạo khác. Rút review qua app tính lại điểm tour Phú Quốc (còn 3 review) nên đã tính lại bằng SQL về 4,8 điểm / 4 review khớp số review đã duyệt. Không có bản ghi `outbox` phát sinh từ các lần thử (không gửi email). Ảnh đã tải lên Cloudinary (cloud `difh…`) trong lúc thử vẫn còn trên đó, không xoá được từ đây. Bản sao lưu nằm ngoài repo ở `C:\capstone\Tourism-Platform-v2\backup-*.json`.

## A. Test tự động

Chạy trong worktree review:

```bash
cd C:\capstone\Tourism-Platform-v2\Tourism-Platform-V2-review
pnpm turbo run build typecheck test --filter=@tourism/mobile --filter=@tourism/api --filter="./libs/**"
npx biome check .
node scripts/check-mobile-tokens-only.mjs
cd apps/api && npx vitest run --config vitest.int.config.ts src/modules/reviews src/modules/bookings   # int, DB riêng tourism_test
```

Kết quả lần chạy: 22 task xanh, API 978 test, mobile 96 suite, Biome sạch, tokens-only đạt, int reviews + bookings xanh (130 test, thêm 1 test mới). `pnpm gate` đầy đủ không chạy được trong worktree vì web/admin cần file `.env` (gitignored, chỉ có ở thư mục gốc); `pnpm gate:int` đầy đủ nên chạy ở thư mục gốc sau khi rebase.

Worktree mới cần: `pnpm install --frozen-lockfile`, `pnpm turbo run build --filter="./libs/**"`, và `cd apps/api && DATABASE_URL=postgresql://x:x@localhost:5432/x pnpm prisma generate`.

| Mục | File test | Khẳng định |
| --- | --- | --- |
| V1 | `features/reviews/review-load-state.spec.tsx` | Đang tải: có vòng quay, không có nút thử lại; lỗi: hiện câu lỗi, nút Try again gọi `onRetry` |
| V2 | `features/reviews/my-reviews.spec.ts` | `MY_REVIEWS_INPUT` chỉ dùng khoá có trong `PageQuerySchema`; qua schema vẫn là 100 bài/trang, không rơi về 20 |
| V4 | `routes.spec.tsx` | Gate Account (A2) hiện lại "Help & FAQ" và "About Nexora" (assertion 26/09 được khôi phục). Dòng Password ở Personal details và sheet bị bỏ chỉ kiểm tay |
| V6 | `apps/api/.../reviews.int.spec.ts` | `PATCH /api/reviews/:id` trả `tourImage` (ảnh hero của tour), không null |
| V7 | `features/reviews/review-form.spec.ts` | 429 → câu chờ; mã trong bảng (`REVIEW_NOT_EDITABLE`, `REVIEW_PHOTO_INVALID`…) → câu riêng; mã lạ → câu chung |
| Q2 | `features/reviews/my-reviews.spec.ts` | `myReviewNextStep` (rút / viết lại / hết lượt / không nút) và `myReviewTone` |

V3, V5, V8, V9 không có test tự động riêng (V3 và V4 là hoàn lại commit cũ, V5 kiểm bằng typecheck và int test không hỏng, V8/V9 nằm trong JSX route) — kiểm tay ở B.

## B. Test tay (điện thoại)

### Chuẩn bị

1. Metro của thư mục gốc (nhánh booking) đang chiếm cổng 8081 và task K10 lúc 00:30 ngày 9/10 cần nó. Chạy Metro riêng cho worktree review ở cổng khác:
   - Chép `apps/mobile/.env.local` từ thư mục gốc sang `…-review/apps/mobile/`.
   - `cd …-review/apps/mobile && npx expo start --port 8082`, rồi mở `exp://<IP-PC>:8082` trong Expo Go.
2. API local (cổng 3001) dùng chung. Lưu ý: API đang chạy là code của thư mục gốc, **chưa có** sửa V5/V6. Muốn thử V6 trên máy thật thì dừng API cũ và chạy API từ worktree (chép `apps/api/.env.local` sang, chạy `pnpm dev` trong `apps/api`).
3. Điều khiển điện thoại bằng adb như mục C của [testing-guide-booking-fixes.md](testing-guide-booking-fixes.md) (deep link `exp://<IP>:8082/--/<đường dẫn>`).
4. Đăng nhập sẵn một tài khoản khách có ít nhất một booking đã đi xong. Admin web dùng để duyệt/bác review.

### V4 + V3 — Account về mockup A1/A2, link mở đúng web

1. Chưa đăng nhập (đăng xuất): màn Account hiện nút đăng nhập và **năm dòng** link: Help & FAQ, About Nexora, Cancellation & refund policy, Privacy policy, Terms of service. **Mong đợi:** không có dòng "Help & legal".
2. Đã đăng nhập, tab Account. **Mong đợi:** menu có Saved tours, My reviews, Travel stories, **Password**, rồi năm dòng link ở trên (không có sheet).
3. Bấm "Help & FAQ". **Mong đợi:** trình duyệt mở `<EXPO_PUBLIC_WEB_URL>/faq` (máy dev: địa chỉ LAN của web), **không** phải `www.nexora-travel.agency`.
4. Vào Personal details. **Mong đợi:** không có dòng Password; vẫn có tên, email, Delete account.
5. Bấm "Password" ở menu Account. **Mong đợi:** mở màn đổi mật khẩu.
6. Bấm "My reviews". **Mong đợi:** mở R4 (đường dẫn `/reviews/mine`).

### V1 — chờ và lỗi có khung riêng

- **R5 / R6 không tìm thấy:** mở `exp://<IP>:8082/--/reviews/rewrite?id=00000000-0000-0000-0000-000000000000` và `…/reviews/exhausted?id=…` (id không tồn tại). **Mong đợi:** khung "We couldn't find that review." + nút Try again, không phải màn trắng.
- **R1 lỗi tải:** mở `…/--/trips/BK-ZZZZZZZZ/review`. **Mong đợi:** "Couldn't load this booking." + Try again.
- **R4 lỗi tải:** tắt API (hoặc ngắt mạng điện thoại nếu không dùng adb wifi) rồi mở My reviews. **Mong đợi:** "Couldn't load your reviews." + Try again, KHÔNG phải "You haven't reviewed a trip yet". Bật lại API, bấm Try again → danh sách hiện.
- **R4 đang tải:** lúc mở màn có vòng quay ngắn, không nháy dòng "chưa có đánh giá".

### V2 — hơn 20 bài vẫn thấy hết

Tạo ít nhất 21 review cho tài khoản test (review curated không gắn booking cũng được; kiểm tra tên cột trước khi chèn SQL, hoặc dùng admin/seed). Mở My reviews. **Mong đợi:** thấy đủ 21 bài (trước sửa chỉ thấy 20, bài cũ nhất không rút/sửa được). Cách kiểm nhanh hơn: log API phải ghi yêu cầu `reviews.mine` với `pageSize=100`.

### V7 — R1 báo lỗi đúng câu

Ở R1 (viết đánh giá) tắt API rồi bấm Submit. **Mong đợi:** câu chung "Something went wrong. Please try again." Với mã cụ thể (429, `REVIEW_PHOTO_INVALID`…) dựa vào test tự động, khó gây ra bằng tay.

### V8 — R6 hết lượt viết lại

Dựng bằng luồng thật, không sửa DB: gửi một review → admin bác (có lý do) → ở app mở R4 → "See why and rewrite" (R5) → gửi lại → admin bác lần hai → R4 → "See why and rewrite" mở **R6**.

1. R6 có tiêu đề "We've looked at this review twice", lý do cuối cùng, và dòng trấn an **"Your trip and booking are not affected."**
2. Bấm nút liên hệ. **Mong đợi:** mở form enquiry đã có sẵn tên tour (và ảnh nếu có) của bài, không phải form trống.
3. Bấm "Back to my trip". **Mong đợi:** về màn chuyến `/trips/<mã booking>` (không quay lại My reviews). Review curated không có booking thì nhãn đổi thành "Back to my reviews".

### V9 — ảnh cũ ở R5 không tải nguyên cỡ

Review bị bác lần đầu có ảnh: mở R5. **Mong đợi:** ô thumbnail 72pt hiện nhanh, ảnh nhẹ (URL có `w_216`). Có thể kiểm bằng cách so tốc độ trên mạng chậm, hoặc đọc log mạng của Expo.

### V5 + V6 — chỉ khi chạy API từ worktree

PATCH `reviews.update` (gửi lại bài ở R5) và retract (R7) rồi mở lại chi tiết booking của chuyến đó. **Mong đợi:** ảnh bìa tour hiện ở cả ba nơi (trước sửa chỉ `mine` có, chi tiết booking trả null). V5 (import vòng, N query) không quan sát được trên máy; int test và typecheck đủ.

## C. Việc còn mở

- **Q1:** thêm dòng `Co-Authored-By: Claude` ở `8b9bced3` và `475042b9` (luật 12). Sửa cần viết lại lịch sử và force-push, đang chờ bạn quyết.
- Phần B đã chạy xong 10/10 (xem B0), gồm R5 thêm ảnh mới và R1 chọn ảnh thư viện. Còn nợ: V5 (không quan sát được trên máy), `REVIEW_PHOTO_INVALID` của V7 (chỉ có test tự động), và hai mục V6/V9 chỉ xác nhận qua code, không quan sát trên màn hình.
- Nguồn làm `rejected_at` về null (04/10): chưa xác định. Chỉ có hai đường code đặt `rejectedAt = null`: `reviews.service.ts:413` (tác giả gửi lại ở R5, không ghi event) và `:702` (admin chuyển về pending). Khả năng cao là lần gửi lại ở R5; cần log API để chắc.
- Rebase lên main sau khi nhánh account và booking vào main (`git rebase --onto origin/main 4f9def36 feat/mobile-review-screens` theo doc review), rồi `pnpm gate:int` ở thư mục gốc.
- Nhánh chưa commit: thay đổi đang ở worktree, một phần đã staged do `git revert -n` của `8e9b79f5`.
- Doc tiến độ `docs/progress-review-screens-2026-10-04.md` nên xoá trước khi merge nếu không còn cần.
