# Mobile Auth — Tình trạng hiện tại (2026-09-24)

Phạm vi: `apps/mobile`, `libs/shared/core`, `libs/shared/i18n`, backend `apps/api/src/auth`.

## 0. Lưu ý quan trọng: code chưa commit, doc cũ đang sai

`git status` cho thấy toàn bộ hạ tầng auth thật nằm ở **working tree, chưa track**:

```
?? apps/mobile/src/features/auth/better-auth-actions.ts
?? apps/mobile/src/features/auth/better-auth-actions.spec.ts
?? apps/mobile/src/lib/auth-client.ts
?? apps/mobile/src/features/auth/auth-gate-sheet.tsx / .spec.tsx
 M apps/api/src/auth/auth.config.ts   (thêm plugin expo(), chưa commit)
```

Các doc sau đang **lệch code** (code đã tiến xa hơn doc mô tả), cần cập nhật lại:
- [docs/CHANGELOG.md](../CHANGELOG.md) — entry 2026-09-18 vẫn ghi "nối API thật" ở mục CÒN TREO.
- [docs/handoff/mobile-auth-handoff.md](../handoff/mobile-auth-handoff.md) — vẫn mô tả `createMockAuthActions()` là provider đang chạy.
- [docs/analysis/auth-flow-simple.md](auth-flow-simple.md) — dòng 7 ghi "App mobile hiện chưa kết nối hệ thống thật, đang dùng dữ liệu giả để demo giao diện" — không còn đúng.

Theo quy ước repo ("Code là nguồn sự thật. Doc lệch code thì sửa doc."), ba doc trên cần sửa lại sau khi phần auth này được commit/review.

## 1. Đã làm (IMPLEMENTED)

| Flow | File chính | Ghi chú |
|---|---|---|
| Đăng nhập email/password | [login.tsx](../../apps/mobile/src/app/(auth)/login.tsx), [sign-in-flow.ts](../../apps/mobile/src/features/auth/sign-in-flow.ts), [better-auth-actions.ts:17-32](../../apps/mobile/src/features/auth/better-auth-actions.ts) | Gọi `signIn.email` thật qua Better Auth client. `EMAIL_NOT_VERIFIED` tự resend OTP rồi điều hướng qua verify. |
| Đăng ký | [register.tsx](../../apps/mobile/src/app/(auth)/register.tsx), [better-auth-actions.ts:46-53](../../apps/mobile/src/features/auth/better-auth-actions.ts) | Luôn trả verify screen kể cả email đã tồn tại (chống dò email). |
| Xác thực OTP email | [verify-email.tsx](../../apps/mobile/src/app/(auth)/verify-email.tsx), [better-auth-actions.ts:55-74](../../apps/mobile/src/features/auth/better-auth-actions.ts) | Backend dùng plugin `emailOTP` (auth.config.ts:196-218). Resend cooldown 60s. |
| Quên mật khẩu | [forgot-password.tsx](../../apps/mobile/src/app/(auth)/forgot-password.tsx), [better-auth-actions.ts:78-88](../../apps/mobile/src/features/auth/better-auth-actions.ts) | Luôn trả `ok:true` trừ lỗi mạng thật (chống dò email). |
| Đặt lại mật khẩu | [reset-password.tsx](../../apps/mobile/src/app/(auth)/reset-password.tsx), [better-auth-actions.ts:90-97](../../apps/mobile/src/features/auth/better-auth-actions.ts) | Đọc token từ deep link `nexora://reset-password?token=…`. Token hỏng/hết hạn → màn full-screen báo lỗi riêng. |
| Đăng nhập Google | [google-flow.ts](../../apps/mobile/src/features/auth/google-flow.ts), [better-auth-actions.ts:34-44](../../apps/mobile/src/features/auth/better-auth-actions.ts) | Backend chỉ bật provider `google` khi có đủ `GOOGLE_CLIENT_ID`/`SECRET` (auth.config.ts:141-151). Chưa có Apple Sign-In. |
| Lưu token | [auth-client.ts:17-32](../../apps/mobile/src/lib/auth-client.ts) | Dùng `expo-secure-store` (Keychain/EncryptedSharedPreferences) qua `expoClient`, **không** phải AsyncStorage — đúng chuẩn bảo mật. |
| Auth-gate sheet (mời đăng nhập khi khách chạm tính năng cần login) | [auth-gate-sheet.tsx](../../apps/mobile/src/features/auth/auth-gate-sheet.tsx) | Component UI hoàn chỉnh, có test, nhưng chỉ là gợi ý mềm — không phải route guard. |
| Test đơn vị | `better-auth-actions.spec.ts` (14 test) + spec cho từng flow/screen | Coverage tốt, mock `getAuthClient()`. Chưa có integration/E2E test phía mobile chạy với server thật. |

## 2. Chưa làm (MISSING / NOT STARTED)

| Flow | Trạng thái | Bằng chứng |
|---|---|---|
| **Đăng xuất (logout)** | NOT FOUND | Grep `signOut`/`logout` toàn bộ `apps/mobile/src` — không có UI, không có lời gọi `getAuthClient().signOut()` nào. |
| **UI biết trạng thái đăng nhập** | NOT FOUND | Grep `useSession`/`getSession` — 0 kết quả thật (2 kết quả khớp là "session" ở nghĩa khác, không liên quan auth). [account.tsx:14-17](../../apps/mobile/src/app/(tabs)/account.tsx) tự ghi chú là placeholder P5a, luôn hiện nút "Sign in" tĩnh bất kể đã đăng nhập hay chưa. |
| **Route guard (chặn tab khi chưa đăng nhập)** | NOT STARTED | [(tabs)/_layout.tsx](../../apps/mobile/src/app/(tabs)/_layout.tsx) render cả 5 tab vô điều kiện. Đã được [CHANGELOG.md:1418-1419](../CHANGELOG.md) ghi nhận là nợ cũ từ 2026-09-18, đến nay vẫn còn. |
| **Refresh token (rotation thủ công)** | Không tìm thấy code riêng | Mobile không tự quản lý refresh — phụ thuộc hoàn toàn vào session lifecycle mặc định của Better Auth. Chưa có test end-to-end xác nhận hành vi này với server thật. |
| **Sinh trắc học (Face ID / Touch ID)** | NOT STARTED | Không có `expo-local-authentication` trong `package.json`, không có code liên quan biometric ở đâu cả. |

## 3. Hướng giải quyết

1. **Đăng xuất**
   - Thêm `getAuthClient().signOut()` vào `better-auth-actions.ts` (đã có contract sẵn trong `auth-actions.ts`, chỉ thiếu implement + UI).
   - Thêm nút "Sign out" trong `account.tsx` khi có session.

2. **UI biết trạng thái đăng nhập**
   - Dùng hook `authClient.useSession()` (Better Auth React client đã hỗ trợ sẵn) ở `account.tsx` và root layout để biết guest/logged-in.
   - Dựa vào session để hiện đúng nội dung profile thật thay vì placeholder P5a.

3. **Route guard cho tab**
   - Bọc `(tabs)/_layout.tsx` bằng check session (dùng `useSession` ở trên), redirect sang `(auth)/login` nếu route yêu cầu đăng nhập (`saved`, `trips`, `account`) mà chưa có session.
   - Cân nhắc giữ `index`, `explore` mở cho khách (browse without login), chỉ gate hành động cụ thể qua `auth-gate-sheet.tsx` đã có sẵn.

4. **Refresh token**
   - Viết 1 integration test mobile chạy với Better Auth server thật (hoặc mock server) để xác nhận session tự refresh đúng hạn `updateAge`, không cần code thêm nếu hành vi mặc định đã đủ — chỉ cần **verify**, chưa verify là rủi ro.

5. **Sinh trắc học**
   - Thêm `expo-local-authentication`, bọc bước mở app / trước hành động nhạy cảm (thanh toán, đổi mật khẩu) bằng prompt Face ID/Touch ID, fallback về PIN hệ thống. Không cấp bách — có thể để backlog riêng, không chặn release đầu.

6. **Dọn dẹp**
   - `mock-auth-actions.ts` không còn được dùng (chỉ còn test riêng) — giữ lại cho việc test flow logic là hợp lý, nhưng cần ghi rõ trong comment là "chỉ dùng cho test, không phải provider chạy thật" để tránh nhầm lẫn như 3 doc cũ ở mục 0.
   - Commit các file auth thật (`better-auth-actions.ts`, `auth-client.ts`, `auth-gate-sheet.tsx`, `auth.config.ts` diff) — hiện đang nằm ngoài git tracking, rủi ro mất việc nếu máy hỏng hoặc `git clean` nhầm.
   - Cập nhật `docs/CHANGELOG.md`, `docs/handoff/mobile-auth-handoff.md`, `docs/analysis/auth-flow-simple.md` cho khớp code sau khi review xong phần trên.

## 4. Bối cảnh kỹ thuật (tóm tắt)

- Expo `~57` + Expo Router + React Native `0.86.3`, React `19.2.4`.
- Auth: `better-auth` `1.6.23` + `@better-auth/expo` `1.6.23` — dùng client chính thức, không tự viết lớp auth.
- Backend mount toàn bộ Better Auth handler qua 1 route catch-all: `apps/api/src/auth/auth.controller.ts:27` (`@All('api/auth/*')`).
- State: React Query cho server state, `useState` cục bộ cho từng route — không Redux/Zustand trong cụm auth.
- Validate dùng chung `@tourism/core` (`auth-form.ts`) với web.

---
*Nguồn: khảo sát code trực tiếp qua Explore agent, 2026-09-24. Không dựa vào doc cũ.*
