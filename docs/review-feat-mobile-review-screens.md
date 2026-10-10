# Review nhánh feat/mobile-review-screens

Ngày 2026-10-05 · @Yuri Volkov

**Chưa nên merge.** Nhánh gồm trọn nhánh booking (có cả account bên trong) cộng 5 commit riêng, nên dính đủ lỗi của hai nhánh đó. Phần riêng không có lỗi chặn mới, nhưng đã đổi màn Account khác mockup đã duyệt và phải quay lại.

Phạm vi: 64 commit `80e36099..475042b9`, gồm 59 commit của `feat/mobile-booking-screens` và 5 commit riêng của Nghia ngày 04/10. Tổ hợp với main mới nhất chạy xanh; chưa thử trên máy thật.

> **Cập nhật 2026-10-08:** V1–V9, Q2, Q3 đã sửa trên nhánh `fix/mobile-review-screens` (worktree `Tourism-Platform-V2-review`, chưa commit). Còn lại: Q1 (viết lại message hai commit đã push), rebase lên main sau khi account và booking vào main, và kiểm trên máy thật (R4, R5, R6, R1).

## Phần thừa hưởng từ nhánh account và booking

59 commit đầu trùng hẳn nhánh booking (`4f9def36` là tổ tiên trực tiếp), nên mọi mục trong "Review nhánh feat/mobile-account-screens" và "Review nhánh feat/mobile-booking-screens" đều áp dụng ở đây. Nặng nhất là 3 lỗi chặn B1–B3 và lỗi đặt trùng booking K1.

Sửa các mục đó trên hai nhánh kia là đủ. Doc này chỉ bàn 5 commit riêng.

## Quyết định: quay về mockup A1/A2 đã duyệt

@Yuri Volkov quyết định ngày 05/10/2026: màn Account và Personal details quay về đúng mockup A1/A2 đã duyệt (chốt 21/09, phản hồi 26/09).

Commit `8e9b79f5` đã gom năm link trợ giúp và pháp lý vào một sheet "Help & legal", và chuyển Password sang Personal details. Commit `475042b9` sửa test để khẳng định Help & FAQ và About không còn ở A2, ngược với phản hồi 26/09. Mockup và handoff chưa được cập nhật theo.

Cần làm:

1. Trả năm dòng mở trình duyệt về menu Account, mỗi trang một dòng như mockup; bỏ sheet "Help & legal".
2. Trả Password về menu Account.
3. Khôi phục assertion của test 26/09 trong `routes.spec.tsx`: Help & FAQ và About phải hiện ở A2.

Muốn đổi bố cục sau này thì sửa mockup và xin duyệt trước, rồi mới code.

## Lỗi riêng của nhánh

12 mục từ 5 commit riêng, xếp theo mức độ. Đường dẫn không ghi gốc thì tính từ `apps/mobile/src/`. "Đọc code, chưa xác minh lại" nghĩa là mới qua một lượt đọc code.

| # | Mức | Vị trí | Lỗi | Cơ sở | Trạng thái |
|---|-----|--------|-----|-------|------------|
| V1 | Trung bình | `app/reviews/mine.tsx`, `rewrite.tsx`, `exhausted.tsx`, `app/trips/[code]/review.tsx` | Không xử lý đang tải và lỗi: R4 báo "You haven't reviewed a trip yet" cả khi đang tải lẫn khi lỗi; R1, R5, R6 ra màn trắng, không có nút thử lại | Đã kiểm code | Đã sửa · test (`review-load-state.spec`); chưa kiểm máy |
| V2 | Trung bình | `app/reviews/mine.tsx:20` | Gửi `limit: 50` nhưng schema dùng `pageSize`, Zod bỏ key lạ nên chỉ lấy 20 bài; bài cũ hơn không sửa hay rút được từ app (lặp ở `rewrite.tsx`, `exhausted.tsx`) | Tái hiện bằng chạy thật | Đã sửa · test (`my-reviews.spec`); chưa kiểm máy |
| V3 | Trung bình | `lib/open-external-path.ts` | Ghi cứng `https://www.nexora-travel.agency`, trái handoff; bản dev hiện nhãn địa chỉ LAN nhưng mở trang production | Đã kiểm code | Đã sửa (hoàn lại `EXPO_PUBLIC_WEB_URL`) |
| V4 | Trung bình | `8e9b79f5`, `routes.spec.tsx` | Đổi Account khác mockup A1/A2 đã duyệt và lật test phản hồi 26/09; quay về theo mục Quyết định | Đã kiểm diff | Đã sửa (revert `8e9b79f5`, khôi phục test 26/09); chưa kiểm máy |
| V5 | Thấp | `apps/api/src/modules/reviews/reviews.service.ts:29` | Import vòng với `bookings.service.ts:35`; ảnh bìa lấy từng tour một (N query) thay vì một lần qua `resolveForOwners` | Đã kiểm import | Đã sửa · int test reviews/bookings xanh |
| V6 | Thấp | `apps/api/src/modules/reviews/reviews.service.ts:463` | `tourImage` chỉ có ở `mine()`; update, retract và chi tiết booking trả null cho cùng review | Đọc code, chưa xác minh lại | Đã sửa · int test mới cho `update` |
| V7 | Thấp | `app/trips/[code]/review.tsx:59` | R1 chỉ xử lý 2 mã lỗi; 429 và các mã khác ra câu chung chung dù bảng thông báo đã có | Đọc code, chưa xác minh lại | Đã sửa · test (`review-form.spec`) |
| V8 | Thấp | `app/reviews/exhausted.tsx:51` | R6 thiếu câu trấn an mà mockup và handoff bắt buộc; "Back to my trip" về My reviews; enquiry không kèm tour | Đọc code, chưa xác minh lại | Đã sửa · chưa kiểm máy (cần `rejectionCount` ≥ 2) |
| V9 | Thấp | `app/reviews/rewrite.tsx:54` | Ảnh cũ tải nguyên cỡ cho ô thumbnail 72pt (không qua `cloudinaryUrl`) | Đọc code, chưa xác minh lại | Đã sửa · chưa kiểm máy |
| Q1 | Quy ước | `8b9bced3`, `475042b9` | Thêm dòng `Co-Authored-By: Claude` (luật 12); cả nhánh có 12 commit như vậy | `git log` | Chưa · cần viết lại lịch sử đã push, chờ bạn quyết |
| Q2 | Quy ước | `features/reviews/my-reviews.ts` | Logic chọn nút rút, sửa, hết lượt không có test (luật 4) | Cây file | Đã sửa (`my-reviews.spec.ts`) |
| Q3 | Quy ước | `docs/progress-review-screens-2026-10-04.md` | Doc ghi "chưa push" dù đã push; 2 doc mới chưa vào bản đồ (luật 13); comment code "CHƯA dựng" còn sót | Đọc doc, code | Đã sửa (doc tiến độ, bản đồ README, comment) |

## Đồng bộ với main

Nhánh chậm main 212 commit (main tại `163c348b`). Thử đồng bộ trên máy, không push: có 5 xung đột giống nhánh booking (`apps/api/package.json`, `pnpm-lock.yaml`, `docs/README.md`, `docs/CHANGELOG.md`, `docs/open-items.md`).

`reviews.service.ts` được git tự gộp với phần bác review bằng lý do của main mà không báo xung đột. Bản gộp build được và qua toàn bộ test: `test:int` 749/749, gate 28/28 task với 5812 unit test (mobile 611), Biome sạch 1664 file, tokens-only và bundle mobile đạt. CI của đỉnh nhánh (run #377) cũng xanh.

## Thứ tự đề xuất

Nhánh review chứa trọn nhánh booking, nên thứ tự merge là account, rồi booking, rồi review.

1. Merge nhánh account rồi nhánh booking theo hai doc trước.
2. Chuyển 5 commit riêng sang main mới bằng `git rebase --onto origin/main 4f9def36 feat/mobile-review-screens`, khỏi gỡ lại 59 commit chung.
3. Quay về mockup A1/A2 theo mục Quyết định (V4), kể cả khôi phục test 26/09.
4. Sửa V1–V3, rồi các mục còn lại; thêm test cho `my-reviews.ts` (Q2).
5. Viết lại message của `8b9bced3` và `475042b9`, bỏ dòng `Co-Authored-By` (Q1).
6. Chạy `pnpm gate:int` trên đỉnh đã rebase (luật 11), rồi thử trên máy thật luồng viết, sửa và rút đánh giá có ảnh.
