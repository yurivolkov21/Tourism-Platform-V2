# Bàn giao cụm auth mobile — nối hạ tầng vào giao diện tĩnh

> Viết cho người làm hạ tầng auth của app mobile. Đợt P5b-1 đã dựng xong **17
> khung giao diện** và một **hợp đồng giả lập**; việc còn lại là thay bản giả lập
> bằng Better Auth thật. **Không màn nào phải sửa.**

Spec thiết kế: [../specs/2026-09-16-p5b-auth-wireframe-design.md](../specs/2026-09-16-p5b-auth-wireframe-design.md) ·
Bản mockup user đã duyệt: `docs/design/mockups/mobile-auth-screens.src.html` ·
Quyết định nền: [ADR-0040](../adr/0040-mobile-app-expo.md), [ADR-0042](../adr/0042-shared-client-rules-core.md),
[ADR-0017](../adr/0017-web-session-better-auth.md) §9.

## 1. Đổi đúng hai dòng

Cả cụm auth chạm hạ tầng qua **một** interface: `AuthActions`
(`apps/mobile/src/features/auth/auth-actions.ts`). Bản đang chạy là
`createMockAuthActions()`.

```ts
// apps/mobile/src/app/_layout.tsx
const authActions = createMockAuthActions();          // ← đổi dòng này
const onboardingStore = createMemoryOnboardingStore(); // ← và dòng này (mục 5)
```

Viết `createBetterAuthActions()` cùng hình dạng, đổi giá trị truyền vào
`<AuthActionsProvider>`. Hết. Màn hình không biết Better Auth tồn tại.

## 2. Bảy method sang lệnh Better Auth

| Method của `AuthActions` | Lệnh Better Auth tương ứng |
| --- | --- |
| `signInWithEmail({ email, password })` | `authClient.signIn.email({ email, password })`; nếu `error.code === 'EMAIL_NOT_VERIFIED'` thì gọi `authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' })` rồi trả `{ ok: false, error: 'emailNotVerified' }` |
| `signInWithGoogle()` | `authClient.signIn.social({ provider: 'google', callbackURL })` |
| `signUpWithEmail({ name, email, password })` | `authClient.signUp.email({ name, email, password })` |
| `verifyEmail({ email, otp })` | `authClient.emailOtp.verifyEmail({ email, otp })` |
| `resendVerificationCode({ email })` | `authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' })` |
| `requestPasswordReset({ email })` | `authClient.requestPasswordReset({ email, redirectTo: 'nexora://reset-password' })` |
| `resetPassword({ token, newPassword })` | `authClient.resetPassword({ newPassword, token })` |

Ba luật bắt buộc khi viết bản thật:

1. **Mọi lỗi đi qua `mapAuthError` của `@tourism/core`.** Đó là chỗ duy nhất dịch
   mã lỗi Better Auth sang khoá lỗi của app; web đang dùng chính hàm đó. Đừng tự
   đọc `error.code` trong màn.
2. **`fetch` ném thì trả `{ ok: false, error: 'generic' }`.** Mất mạng là một câu
   đọc được, không phải một promise reject chạy xuyên lên `ErrorBoundary`.
3. **`emailNotVerified` KHÔNG phải câu để hiện ra** — nó là lệnh chuyển sang màn
   Verify. Giữ nguyên ý đó; đừng gộp nó vào nhánh lỗi chung.

## 3. Việc phía API (ADR-0017 §9)

- Bật plugin `expo()` của Better Auth ở server.
- Thêm `nexora://` vào danh sách trusted origin.
- Rà lại trần request và CORS cho origin mới.
- `redirectTo` của reset password trỏ `nexora://reset-password?token=…` — route
  `(auth)/reset-password` đã đọc sẵn `token` từ query.

## 4. Lỗi hiện ở đâu — đừng quyết lại

Ba kênh, và **màn không tự chọn kênh**: `placeAuthError(key, screen)`
(`features/auth/error-channel.ts`) quyết hết.

| Kênh | Chỗ hiện | Khi nào |
| --- | --- | --- |
| 1 | ngay dưới ô sai | lỗi quy được về một ô (`fieldOfAuthError` của `@tourism/core`) |
| 2 | một khung ngay trên nút chính | lỗi không quy về ô nào mà màn vẫn thử lại được |
| 3 | thay cả thân màn | màn hết đường dùng: link đặt lại hỏng, thiếu email ở màn xác minh |

Màn Sign in cố ý **không** nói email hay mật khẩu sai (chống dò tài khoản), còn
đăng ký trùng email vẫn dẫn sang màn Verify vì API cố ý trả thành công. Hai chỗ
đó là **thiết kế**, không phải thiếu sót.

## 5. Hai seam còn lại và một chỗ tạm

| Chỗ tạm | Thay bằng gì |
| --- | --- |
| `createMemoryOnboardingStore()` (`features/onboarding/onboarding-store.ts`) | `expo-secure-store` hoặc AsyncStorage, **giữ nguyên interface** (`hasSeen`/`markSeen`, cả hai bất đồng bộ sẵn) |
| `AUTH_PHOTOS` (`features/auth/auth-media.ts`) | ảnh từ khe site-media như web đang dùng; màn chỉ nhận `{ uri }` nên không phải sửa |
| Nút Google | bản giả lập trả `notAvailable` đúng như web khi provider chưa cấu hình |

## 6. Bảng kịch bản của bản giả lập

Dùng để bấm ra từng nhánh trên máy thật mà không cần API sống — và để kiểm tra
bản thật có cư xử giống không.

| Nhập | Kết quả |
| --- | --- |
| `unverified@example.com` | `emailNotVerified` → chuyển sang màn Verify |
| mật khẩu `wrong-password` | `invalidCredentials` |
| `busy@example.com` | `tooManyRequests` |
| `offline@example.com` | `generic` |
| mã `000000` | `invalidOtp` |
| token `expired` | `invalidToken` → kênh 3 |
| nút Google | `notAvailable` |

Xem đủ 17 khung trên máy: mở `/dev/gallery` (chỉ có ở bản dev — xem
[mobile-dev-loop.md](../conventions/mobile-dev-loop.md) §5).

## 7. KHÔNG được sửa khi nối hạ tầng

- **Màn hình** (`*-screen.tsx`): chúng chỉ vẽ, mọi giá trị đến từ props. Cần dữ
  liệu khác thì sửa route, không sửa màn.
- **Luật kiểm ô nhập**: `validateLogin`, `validateRegister`, `validateOtp`,
  `validateResetPassword`, `validateForgotPassword` nằm ở `@tourism/core` và
  **dùng chung với web** (ADR-0042). Sửa ở đó là sửa cho cả hai app — và đó là
  điều phải cân nhắc, không phải tiện tay.
- **Copy**: mọi chữ user-facing nằm ở `@tourism/i18n` (`messages.mobile.auth`,
  `messages.authForms`). Không viết chuỗi thẳng vào màn (CLAUDE.md #7).
- **Màu**: token qua `useTheme()`, không hex (CLAUDE.md #6, có lưới
  `scripts/check-mobile-tokens-only.mjs`).
