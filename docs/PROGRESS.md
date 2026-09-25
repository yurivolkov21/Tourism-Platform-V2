# Tiến độ nhánh `feat/mobile-account-screens` (P5b-4) — cập nhật 2026-09-25

> File này KHÔNG phải doc thường trực — chỉ để nối phiên nếu context AI bị mất
> giữa chừng. Xoá khi nhánh đã merge/xong. Đè lên nội dung cũ (browse-screens)
> kế thừa từ lúc rẽ nhánh — bản browse-screens vẫn nguyên trên chính nhánh đó.

## Worktree — ĐỌC TRƯỚC KHI LÀM GÌ

Session này chạy trong **worktree riêng**, KHÔNG phải checkout gốc:

- Worktree: `C:\capstone\Tourism-Platform-v2\Tourism-Platform-V2-account-screens`
  (branch `feat/mobile-account-screens`)
- Checkout gốc: `C:\capstone\Tourism-Platform-v2\Tourism-Platform-V2` — hiện
  đang đứng ở `main` (đổi vậy để nhường nhánh cho worktree, `git worktree`
  không cho 2 nơi cùng checkout 1 nhánh).
- Muốn tiếp tục: mở worktree trên, KHÔNG mở checkout gốc rồi `git checkout
  feat/mobile-account-screens` (sẽ xung đột với worktree đang giữ nhánh đó —
  phải `git worktree remove` worktree cũ trước nếu muốn gộp lại một chỗ, hoặc
  cứ tiếp tục làm trong worktree này).
- `node_modules` + build artifact (`@tourism/tokens`, `@tourism/i18n`,
  `@tourism/contract`, `@tourism/core` dist) đã cài/build sẵn trong worktree
  này — khỏi làm lại trừ khi lỗi.

## Đã xong — Plan A (return-to-auth + AuthGateScreen)

Chạy bằng SDD (subagent-driven development, skill
`superpowers:subagent-driven-development`) — 4 task + 1 fix wave, TẤT CẢ đã
review sạch hoặc park có ruling. Ledger đầy đủ (không commit, gitignored, còn
trên đĩa worktree này):
`.superpowers/sdd/2026-09-25-mobile-account-return-to-auth/progress.md`

Commit trên nhánh (từ base `359c2577` — commit spec/plan — tới hiện tại):

```
a079ece0  feat(mobile): hộp nhớ return-to sau đăng nhập
457f28f3  feat(mobile): AuthGateScreen — khối chặn tab dùng chung Saved/Account
fadb3144  feat(mobile): đăng nhập/đăng ký xong quay lại đúng chỗ đã bấm Sign in
85bc012b  fix(mobile): đóng nợ D6 — tim tự lưu lại sau khi đăng nhập từ tour detail
44da1555  fix(mobile): dọn pending return khi bỏ dở đăng nhập + tránh wishlist-check đè lên save
7a27a079  docs(mobile): ghi 3 nợ nhỏ phát sinh từ final review
```

Kết quả cuối: 57 suite / 354 test xanh, tsc sạch, biome sạch.

**Sản phẩm dùng được ngay:**
- `apps/mobile/src/features/auth/return-to.ts` — `setPendingReturn`,
  `consumeReturnPath`, `consumePendingReplay`, `clearPendingReturn`.
- `apps/mobile/src/features/auth/auth-gate-screen.tsx` — `AuthGateScreen`,
  component full-screen, **CHƯA nối vào màn nào** (đúng phạm vi plan A — nối
  vào `saved.tsx`/`account.tsx` là việc TIẾP THEO, xem dưới).
- Tour detail (`[slug].tsx`): tim khi chưa đăng nhập giờ tự nhớ + tự lưu lại
  sau khi đăng nhập xong (đóng nợ D6 cũ).

**Nợ nhỏ đã ghi vào `docs/open-items.md`** (không chặn, không phải việc gấp):
Explore-tab wishlist gate chưa gọi `setPendingReturn`; `login.tsx`'s nút X
luôn về Home; `router.replace` vs `router.back()` khi tour đích đã mount sẵn
dưới modal (cần test tay máy thật trước khi đổi).

**Chưa làm — kiểm tay máy thật** (plan's Step 6, phiên AI không có thiết bị):
bấm tim chưa đăng nhập → Sign in → xác nhận quay đúng tour + tim tự đặc; thử
cả nhánh "bấm X bỏ dở rồi đăng nhập lại từ chỗ khác" → PHẢI không bị dạt về
tour cũ (đây chính là bug Important #1 vừa vá, cần xác nhận thật trên máy).

## Tiếp theo (theo spec `docs/plans/2026-09-25-mobile-account-screens.md`)

Thứ tự đề xuất trong spec mục "Thứ tự implement":

1. ~~return-to.ts + AuthGateScreen + đóng nợ D6~~ ✅ XONG (Plan A ở trên).
2. **Saved (mục 2 spec)** — viết `apps/mobile/src/app/(tabs)/saved.tsx` (hiện
   còn stub P5a, CHƯA đọc trước khi viết đè). Dùng `AuthGateScreen` (đã có,
   Plan A) khi `!signedIn`. `wishlist.list`, tái dùng `TourListCard` (đã có
   từ nhánh browse-screens, worktree này kế thừa sẵn).
3. **Account hub + A3/A5/A6 (mục 3 spec)** — viết lại `account.tsx` (GIỮ 2
   link dev-gallery hiện có). Dùng `AuthGateScreen` cho A2 (`legalLinks` đã
   hỗ trợ sẵn trong component, xem props). A3 (sửa tên)/A5 (đăng xuất) sheet,
   A6 (đổi mật khẩu) màn riêng.
4. **Travel stories (mục 6 spec)** — độc lập hoàn toàn, không cần đăng nhập,
   không phụ thuộc Plan A ngoài 1 dòng dẫn vào ở `account.tsx`.
5. **A4 (avatar)** — CẦN ADR mới (AMEND vào `docs/adr/0040-mobile-app-expo.md`)
   cho dependency `expo-image-picker` TRƯỚC khi thêm — hỏi user trước (luật 5
   CLAUDE.md). Chưa hỏi ở phiên này.
6. **A7 (xoá tài khoản)** — CỜ ĐỎ đã ghi trong spec mục 5: `deleteUser` CHƯA
   TỒN TẠI ở cả API lẫn web. Cần vòng brainstorm/ADR riêng cho phần API
   (cascade booking/review/wishlist) TRƯỚC khi động tới client — việc RIÊNG,
   đụng cả `apps/api`, hỏi user khi tới lượt.

Mục 2-4 (Saved/Account hub/Blog) đã CHỐT làm thẳng theo spec, KHÔNG cần plan
bite-sized riêng (giống T1-T7 của browse-screens) — port pattern có sẵn.

## Cổng trước khi báo xong toàn cụm (chưa chạy — còn dở)

`pnpm gate:int` · `pnpm turbo run bundle --filter=@tourism/mobile` ·
`expo-doctor` (trong `apps/mobile`) · tokens-only · soi nền sáng/tối máy thật.
Xem lại `docs/PROGRESS.md` của nhánh browse-screens (trong lịch sử git nhánh
đó) nếu cần đối chiếu cách né port-forward VS Code — vấn đề đó CÓ THỂ vẫn còn
trên máy này.

## Chưa commit lên đâu cả, chưa hỏi push

Chưa push nhánh này lên origin. Chưa hỏi user merge/review. Dừng ở đây vì hết
giờ phiên — session sau đọc file này + ledger SDD (nếu còn trên đĩa) để nối
tiếp mà không mất ngữ cảnh.
