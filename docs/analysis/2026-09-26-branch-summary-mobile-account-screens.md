# Tóm tắt nhánh `feat/mobile-account-screens` (P5b-4) — 2026-09-26

Đọc nhanh cho người chưa theo dõi nhánh. Nhánh này RẼ TỪ `feat/mobile-browse-screens`
(chứa nguyên 35 commit của nhánh đó + 24 commit riêng lên trên) — nên đọc
[tóm tắt browse-screens](2026-09-26-branch-summary-mobile-browse-screens.md)
trước nếu cần nền. Nguồn: `git log`, [`docs/handoff/mobile-account-handoff.md`](../handoff/mobile-account-handoff.md),
`docs/PROGRESS.md` (bản cuối 25/09, working-doc không còn trên `main`),
[`docs/open-items.md`](../open-items.md). Diff so `main`: **149 file,
+15776/-770 dòng** (riêng so browse-screens: 53 file, +3547/-300).

## Đã làm xong

Theo spec [`2026-09-25-mobile-account-screens.md`](../plans/2026-09-25-mobile-account-screens.md),
chạy bằng SDD (subagent-driven development):

1. **Plan A — return-to-auth + AuthGateScreen (mục 1).** Hộp nhớ "quay lại
   đúng chỗ sau đăng nhập" dùng chung mọi nơi (`return-to.ts`), component chặn
   tab dùng chung Saved/Account (`AuthGateScreen`). Đóng nợ D6 cũ: bấm tim khi
   chưa đăng nhập ở tour detail → đăng nhập xong → tự quay lại đúng tour VÀ
   tim tự đặc, không cần bấm lại.
2. **Saved (mục 2, S1–S3).** `wishlist.list`/`wishlist.set`, chưa đăng nhập →
   `AuthGateScreen`, rỗng → `EmptyState`, có dữ liệu → thẻ tour luôn `favorited`,
   bỏ lưu lạc quan. Cờ `unavailable` (tour đã gỡ publish) → thẻ mờ + pill
   "No longer available", khoá bấm, KHÔNG ẩn thẻ.
3. **Account hub + A3/A5/A6 (mục 3).** A1 hồ sơ (avatar/tên/email, 8 dòng menu
   theo tần suất, Sign out tách khoảng trắng) · A3 sửa tên (`EditNameSheet`,
   `authClient.updateUser`) · A5 đăng xuất (`SignOutSheet`, biến thể Button
   MỚI `"destructive"`) · A6 đổi mật khẩu (route riêng header native,
   `authClient.changePassword` kèm `revokeOtherSessions:true`).
4. **Loạt fix UI polish 26/09** (sau khi PROGRESS.md ghi lần cuối, chưa có
   tài liệu tổng hợp riêng — liệt từ commit log): bỏ tiêu đề "Account" thừa ở
   A1 khi đã đăng nhập (yêu cầu 26/09) · sửa icon nút sửa tên (`edit` đúng
   mockup, trước dùng nhầm `edit-2`) · A3 thêm heading/câu giải thích còn
   thiếu, sửa icon TextField sai khuôn Account · TextField (mobile-ui) thêm
   padding dọc riêng, tránh chữ sát gạch chân · nối `onboardingStore` thật
   bằng `expo-secure-store` (trước là bản giả lập RAM) · sửa
   `EXPO_PUBLIC_WEB_URL` tự thay `localhost` → IP LAN giống `API_URL` (thiếu
   thì 5 link mở-ngoài — FAQ/About/pháp lý — chết trên máy thật cùng mạng) ·
   ô avatar Home bo góc vuông thay vì tròn · thêm test API xác nhận
   `change-password` sai mật khẩu hiện tại trả đúng `INVALID_PASSWORD`.

**Chưa làm trong nhánh (đã lên lịch, chưa tới lượt — không phải lỗi):**
- **Travel stories (mục 4 spec)** — cụm bài viết, độc lập hoàn toàn không cần
  đăng nhập, spec đã có, CHƯA bắt đầu code.
- **A4 avatar** — cần ADR mới (AMEND vào ADR-0040) cho `expo-image-picker`
  TRƯỚC khi thêm dependency, CHƯA hỏi user.
- **A7 xoá tài khoản** — CỜ ĐỎ: `deleteUser` chưa tồn tại ở cả API lẫn web,
  cần vòng brainstorm/ADR riêng cho phần cascade booking/review/wishlist
  TRƯỚC khi động client. Việc riêng, đụng cả `apps/api`.

## Kiểm đã chạy — xanh (tính tới bản ghi PROGRESS 25/09)

57 suite / 354 test xanh, `tsc --noEmit` sạch, biome sạch, tokens-only sạch
(loạt fix UI 26/09 sau đó không có ghi số test mới trong tài liệu, chỉ có
trong commit message riêng lẻ).

## Chưa làm / còn treo

1. **Chưa kiểm tay trên máy thật cho TOÀN BỘ nhánh** — mọi mục (return-to,
   Saved, Account hub) đều ghi "phiên AI không có thiết bị". Quan trọng nhất:
   bấm tim chưa đăng nhập → Sign in → xác nhận quay đúng tour + tim tự đặc;
   VÀ nhánh "bấm X bỏ dở rồi đăng nhập lại từ chỗ khác" PHẢI không bị dạt về
   tour cũ (đây là bug quan trọng vừa vá, chưa xác nhận thật). Xem
   [`docs/open-items.md`](../open-items.md) mục "Cần thử lại bằng máy thật".
2. **`pnpm gate:int` CHƯA chạy trọn** — thử 25/09 bị chặn ở
   `@tourism/admin#build` (`Missing API origin: NEXT_PUBLIC_API_URL`), xác
   nhận KHÔNG do nhánh này (lỗi y hệt trên `main` sạch). Đã chạy RIÊNG phần
   mobile (typecheck/test/i18n) xanh, nhưng build web/admin + api int test
   đầy đủ vẫn thiếu — cần ai đó set biến môi trường build trước (việc hạ
   tầng, không tự set trong session thi công theo luật 15 CLAUDE.md).
3. **`pnpm turbo run bundle --filter=@tourism/mobile` chưa chạy** cho nhánh
   này (browse-screens đã chạy xanh, nhưng account-screens thêm code mới
   sau đó chưa re-run).
4. **`expo-doctor` chưa chạy riêng cho nhánh này** (kế thừa 20/21 từ
   browse-screens, chưa xác nhận lại).
5. **Ba nợ nhỏ đã ghi vào `docs/open-items.md`** (không chặn merge):
   - Explore-tab wishlist gate chưa gọi `setPendingReturn` — bấm tim ở thẻ
     tour trên Explore rồi đăng nhập xong thì về Home, KHÔNG về đúng Explore
     (spec §1b bỏ sót nơi này, chỉ tour-detail có).
   - `login.tsx`'s nút X đóng màn luôn về Home, kể cả khi mở từ một tour cụ
     thể — sửa để về đúng tour là việc nhỏ, chưa làm.
   - `router.replace` khi quay lại tour đã mount sẵn dưới modal login CÓ THỂ
     đẩy thêm bản sao vào stack thay vì đóng modal đúng cách — nghi đổi sang
     `router.back()` đúng hơn nhưng CẦN test tay máy thật trước khi đổi (rủi
     ro đổi sai điều hướng nếu không kiểm chứng được).
6. **Chưa soi nền sáng/tối trên máy thật** cho các màn mới (Saved, Account
   hub) — kế thừa nợ tương tự từ browse-screens.
7. **Chưa push/hỏi merge** tính tới bản ghi PROGRESS cuối (25/09) — cần xác
   nhận lại vì loạt commit 26/09 có thể đã đổi tình trạng này (ảnh chụp màn
   hình cho thấy nhánh đã có mặt trên remote/GitHub "4 giờ trước").

## Quyết định kỹ thuật đáng chú ý (đừng hỏi lại)

- Ba tab chặn (Saved/Trips/Account) khi chưa đăng nhập dùng CHUNG một
  component, KHÔNG viết ba lần và KHÔNG đá khách sang màn Sign in rời (phải
  quay lại đúng tab).
- Hồ sơ/mật khẩu đi qua Better Auth (`authClient.*`), KHÔNG qua oRPC.
- Đổi mật khẩu LUÔN kèm `revokeOtherSessions: true` (khớp web, ADR-0017 §7a).
- Xoá tài khoản đặt ở "Personal details", KHÔNG đặt cạnh nút đăng xuất (dễ
  bấm nhầm) — nhưng bản thân tính năng CHƯA làm (xem A7 ở trên).
