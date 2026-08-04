# Spec — Bước 7 nối API: 6 trang auth + session Better Auth ở web (2026-08-03)

- **Trạng thái:** Approved 03/08
- **Nền:** [ADR-0017](../adr/0017-web-session-better-auth.md) (Accepted 03/08
  — cookie thẳng browser↔API · `useSession` island · emailOTP cho verify ·
  2FA PARK). UI 6 trang đã duyệt 24–25/07
  ([spec design](2026-07-24-auth-pages-design.md)) — **không đổi một pixel**,
  chỉ nối dây.
- **Branch:** `feat/auth-pages-api`.

## 1. Phạm vi

| # | Bề mặt | Nối gì | Ghi chú |
| --- | --- | --- | --- |
| A | API: plugin `emailOTP` + EmailType `EMAIL_OTP` | verify email chuyển link → OTP | Migration MỚI (ALTER TYPE) + template worker |
| B | Web: nền auth client | dep `better-auth@1.6.23` + `lib/auth-client.ts` | `createAuthClient` (react) + plugin emailOTP client |
| C | 5/6 form nối thật | login · register · forgot · reset · verify-email | two-factor **PARK** (ADR-0017 §5b) — giữ tĩnh, không nối |
| D | `user-menu` + signOut | `useSession` island thay `MOCK_SESSION` | `mocks/auth.ts` khai tử |
| E | `safe-redirect` + `?redirect=` | port whitelist local-only từ Nexora | chống open-redirect |
| F | Nút Google (UI có sẵn) | wire `signIn.social` | không đổi visual; dev chưa bật Google → lỗi envelope hiện inline thân thiện |

Số đếm để khỏi lẫn: **6 trang** tồn tại, **5 nối thật**, **1 PARK** — mọi chỗ
khác trong spec nhắc số phải khớp bộ (6/5/1) này.

## 2. A — API: emailOTP + outbox

- `auth.config.ts` thêm `plugins: [emailOTP({...})]` — cấu hình để flow
  verify-lúc-signup gửi **OTP thay link** (đọc option thật của BA 1.6.23 khi
  thi công — `overrideDefaultEmailVerification`/`sendVerificationOnSignUp`
  hay tương đương; KHÔNG đoán tên option, đọc `.d.ts`). `sendVerificationOTP`
  ghi outbox đúng nếp AUTH-2:
  `{ type: EMAIL_OTP, payload: { email, otp }, dedupeKey: 'email-otp:<userId|email>:<otp>' }`
  (slice 200 như các dedupeKey khác).
- **Migration MỚI** thêm giá trị enum `EMAIL_OTP` (không đụng migration cũ —
  luật bất biến). Chạy `prisma migrate dev` tạo file mới.
- Worker: template email OTP mới trong deliverer (đọc map template hiện có
  của Resend/Console deliverer, thêm đúng nếp — copy tiếng Anh vào i18n nếu
  template đang lấy từ đó, còn không thì theo nếp template hiện hành).
- **Bất biến SEC-1 phải sống:** hook `afterEmailVerification` (promote admin
  — ADR-0008) phải chạy cả khi verify bằng OTP. **Int test bắt buộc**: user
  trong `ADMIN_EMAILS` sign-up → verify qua `emailOtp.verifyEmail` → role
  thành ADMIN; user thường verify OTP → role giữ CUSTOMER. Nếu đo được hook
  KHÔNG fire ở đường OTP → **DỪNG, hỏi lại** (điều khoản ADR-0017 §5a),
  không tự chế workaround.
- Reset password + Google: **không đổi gì phía API** (đã có từ P1/P3a).

## 3. B — Web: nền auth client

- `apps/web` thêm dep `better-auth@1.6.23` (ghim đúng version API — hai bên
  lệch minor là lệch protocol).
- `apps/web/src/lib/auth-client.ts`:
  `createAuthClient({ baseURL: apiOrigin(), plugins: [emailOTPClient()] })`
  từ `better-auth/react` — dùng lại `apiOrigin()` của `lib/api/env.ts`
  (không lặp base-URL, đúng bài học Nexora-8-file). Export `authClient` +
  re-export `useSession`.
- KHÔNG đụng `lib/api/client.ts` (oRPC): bước 7 chưa có call oRPC nào cần
  cookie — `credentials: 'include'` cho nhóm wishlist/booking là việc bước
  8–10 (ADR-0017 Hệ quả ghi rồi).

## 4. C — Năm form nối thật (UI giữ nguyên, chỉ handler/state/lỗi)

Nếp chung cả 5 form: lỗi hiển thị **inline** trong form theo khuôn lỗi của
từng form đã dựng (toast CHỈ cho kết quả thao tác rời trang — nếp đã chốt);
nút submit disable + trạng thái đang-gửi; mọi copy mới vào `@tourism/i18n`
khối `authForms` (tiếng Anh — luật 7); lỗi từ BA client map qua MỘT hàm
thuần `mapAuthError(error): string-key` (TDD) — không rải chuỗi trong
component.

- **Login:** `authClient.signIn.email({ email, password, rememberMe? })` —
  checkbox remember của UI (nếu form có) map vào `rememberMe`, không có thì
  bỏ qua (kiểm form thật khi thi công, đừng thêm checkbox mới). Thành công →
  `router.push(safeRedirect(searchParams.redirect, '/'))` + `router.refresh()`;
  user chưa verify vẫn đăng nhập được (`requireEmailVerification: false` —
  giữ nguyên). Sai credentials → inline "Invalid email or password" (một
  thông điệp mù — không phân biệt email tồn tại).
- **Register:** `authClient.signUp.email({ name, email, password, phone? })`
  → thành công (BA tự đăng nhập — autoSignIn default) → push
  `/verify-email?email=<email>` để nhập OTP vừa được gửi (sendOnSignUp nay
  ra OTP theo §2). Checkbox Terms là gate client thuần (đã có trong UI).
- **Forgot password:** `authClient.requestPasswordReset({ email, redirectTo:
  '<webOrigin>/reset-password' })` (tên method đọc từ `.d.ts` 1.6.23 — có
  thể là `forgetPassword`; KHÔNG đoán). Response mù chống enumeration: UI
  luôn chuyển sang trạng thái `sent` sẵn có của form, bất kể email tồn tại
  hay không (cùng nguyên tắc newsletter).
- **Reset password:** trang đọc `?token=` (link trong email PASSWORD_RESET
  hiện hành); `authClient.resetPassword({ newPassword, token })`; thiếu/hỏng
  token → panel lỗi thân thiện + link về `/forgot-password` (KHÔNG 404 —
  nếp trang unsubscribe). PasswordStrengthField giữ nguyên vai trò checklist
  client, chốt cuối là BA (min 8 default).
- **Verify email (OTP):** đọc `?email=`; `authClient.emailOtp.verifyEmail({
  email, otp })`; nút resend dùng lại đúng countdown 60s sẵn có của
  `OtpForm`, gọi `authClient.emailOtp.sendVerificationOtp({ email, type:
  'email-verification' })`. Thành công → toast success + push `/` (hoặc
  `?redirect=`). Không có `?email=` (vào trang tay không) → panel hướng dẫn
  + link login — không crash.
- **Two-factor:** KHÔNG nối (PARK) — thêm đúng MỘT comment đầu file page ghi
  nợ + trỏ ADR-0017 §5b. Không đổi UI.
- **Nút Google (login + register):** `authClient.signIn.social({ provider:
  'google', callbackURL: safeRedirect(...) })`. Dev không cấu hình Google →
  API trả lỗi → inline "Google sign-in is not available yet" (i18n). Không
  ẩn nút (không đổi visual đã duyệt); demo thật cần cặp env Google phía API.

## 5. D — user-menu + signOut + khai tử mock

- `user-menu.tsx`: thay `MOCK_SESSION` bằng `const { data: session } =
  useSession()` — component đã client sẵn; trạng thái đang-tải render đúng
  nhánh logged-out (không nhấp nháy layout — kiểm bằng mắt lúc nghiệm thu).
  Menu links "My account/My bookings" GIỮ placeholder `#top` (trang account
  là bước 8 — đừng tạo link chết mới).
- Sign out: `authClient.signOut()` (client-side — bài học Nexora giữ navbar
  phản ứng ngay qua store của BA client) rồi `router.push('/')` +
  `router.refresh()`.
- `apps/web/src/mocks/auth.ts` xoá; `user-menu.spec.tsx` chuyển sang mock
  module `lib/auth-client` (khuôn mock module như các spec đã làm với
  `lib/api/client`).

## 6. E — safe-redirect

`apps/web/src/lib/safe-redirect.ts` + spec (TDD): nhận `unknown`, chỉ chấp
nhận path local bắt đầu `/` (loại `//`, `http(s)://`, `javascript:`, path
có `\` hoặc ký tự điều khiển), quá dài (>512) → fallback. Mặc định fallback
`'/'`. Port ngữ nghĩa từ Nexora `safe-redirect.ts` — đối chiếu file gốc khi
viết test cho đủ case ác.

## 7. Test

- **Thuần (TDD trước):** `mapAuthError` · `safeRedirect` (đủ case ác §6) ·
  logic đọc/validate param (`?email=`, `?token=`) nếu tách được thuần.
- **jsdom:** mỗi form — submit gọi đúng method client (mock module
  `lib/auth-client`), lỗi hiện inline đúng field/khối, nhánh thành công
  (push/refresh gọi đúng — mock `next/navigation`); user-menu 2 nhánh
  session null/có + signOut gọi client.
- **API int:** 2 test SEC-1 §2 (admin promote qua OTP · customer giữ role);
  test outbox có row `EMAIL_OTP` sau signup; test resend OTP không nổ khi
  spam (throttle của BA nếu có — đo thật).
- **KHÔNG snapshot visual mới** — UI không đổi.

## 8. Nghiệm thu (production build web + API + DB thật; đo bằng trình duyệt thật + curl)

1. Vòng đời trọn: register user mới (email thật trong outbox — đọc
   `select payload from outbox order by created_at desc limit 1` lấy OTP) →
   verify OTP → `user.email_verified = true` trong DB; login/logout — navbar
   đổi ngay không reload tay; cookie trong devtools: `httpOnly`, KHÔNG đọc
   được từ `document.cookie`.
2. SEC-1: sign-up bằng email nằm trong `ADMIN_EMAILS` (thêm email test qua
   biến môi trường lúc chạy — bài học task-4 cụm revalidation: KHÔNG sửa
   `.env.local`) → sau verify OTP, `role = ADMIN` trong DB; trước verify —
   vẫn CUSTOMER.
3. Forgot → email PASSWORD_RESET trong outbox → mở link `?token=` → đặt pass
   mới → login bằng pass mới OK, pass cũ 401; token dùng lại lần 2 → panel
   lỗi thân thiện.
4. `?redirect=` hoạt động (login từ `/tours?x` quay đúng lại); thử
   `?redirect=https://evil.example` và `//evil.example` → về `/`.
5. Trang public không thụt lùi render: `curl -s -o /dev/null -w '%{size_download} %{http_code}' localhost:3000/tours` trước/sau
   không đổi mô hình (vẫn ISR — kiểm `x-nextjs-cache` HIT lần hai); slug lạ
   vẫn 404 thật (khuôn soft-404). *(AMENDED 03/08 lúc nghiệm thu: `/tours`
   LISTING vốn dynamic từ trước cụm — đọc `searchParams` filter; header
   `x-nextjs-cache`/ISR đo ở `/tours/[slug]`. Hành vi có sẵn, không phải
   regression — đã đối chiếu git diff = 0.)*
6. `pnpm gate:int` xanh trọn (int mới §7 nằm trong đó).

## 9. Ngoài phạm vi

- Trang account/bookings/saved + `proxy.ts` + `credentials: 'include'` cho
  oRPC (bước 8–10 — ADR-0017 đã vẽ đường).
- 2FA (PARK — ADR-0017 §5b) · đổi email flow · xoá tài khoản UI (API có,
  UI bước 8).
- Wire nút tim wishlist trên card (bước 8).

## 10. Rủi ro

- **Hook promote không fire ở đường OTP** — điều khoản DỪNG ở §2; đây là
  rủi ro số 1 của cả cụm, int test viết TRƯỚC khi wire UI.
- Option plugin emailOTP đổi tên giữa version BA — mọi tên method/option
  trong spec này phải đối chiếu `.d.ts` của `better-auth@1.6.23` lúc thi
  công (bài học `revalidateTag(tag, 'max')`: đừng tin tên gợi ý).
- `useSession` lúc hydrate có thể nhấp nháy logged-out→logged-in trên
  navbar — chấp nhận ở bước 7 (island nhỏ), đo bằng mắt; nếu tệ thì cân
  cookieCache ở bước sau (ADR-0017 Hệ quả đã ghi YAGNI).
- Migration enum trên Postgres: `ALTER TYPE ... ADD VALUE` không chạy được
  trong transaction cùng lệnh khác — để migration MỘT lệnh duy nhất (nếp
  Prisma tự lo, nhưng đừng gộp tay thêm gì vào file đó).
