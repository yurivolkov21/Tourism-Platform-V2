# Plan — Bước 7: 6 trang auth + session Better Auth ở web

> **For agentic workers:** REQUIRED SUB-SKILL: dùng
> `superpowers:subagent-driven-development` (khuyến nghị) hoặc
> `superpowers:executing-plans`. Step dùng checkbox (`- [ ]`).

**Goal:** 5/6 trang auth hoạt động thật (login · register · forgot · reset ·
verify-email OTP; two-factor PARK) + navbar biết trạng thái đăng nhập — theo
[spec](../specs/2026-08-03-auth-pages-api-design.md) (Approved 03/08) trên nền
[ADR-0017](../adr/0017-web-session-better-auth.md).

**Architecture:** cookie Better Auth thẳng browser↔API (`createAuthClient`
baseURL :3001, CORS credentials đã sẵn); API bật plugin `emailOTP`
(verify-lúc-signup ra OTP thay link, hook promote admin PHẢI sống — int test
trước, có điều khoản DỪNG); UI đã duyệt không đổi pixel, chỉ handler/state/
lỗi-inline; `useSession` island cho user-menu.

**Tech Stack:** `better-auth@1.6.23` (GHIM đúng version API, không caret) —
đã đối chiếu `.d.mts` 03/08: plugin options `otpLength`/`expiresIn`/
`sendVerificationOnSignUp`/`overrideDefaultEmailVerification`/
`allowedAttempts` đều tồn tại (`dist/plugins/email-otp/types.d.mts:21-94`),
type OTP `'email-verification'`, client có `requestPasswordReset`
(`dist/api/routes/password.d.mts`).

## Global Constraints (áp cho MỌI task)

- **Branch `feat/auth-pages-api`** từ `main`. Conventional Commits.
  ⚠️ SAU MỖI COMMIT chạy `git log -1 --format='%B'`; NẾU chứa
  "Co-Authored-By" THÌ `git commit --amend` message sạch rồi kiểm lại; NẾU
  không thì xong (lệnh một chiều).
- Comment/JSDoc **tiếng Việt**; copy user-facing TIẾNG ANH, CHỈ trong
  `@tourism/i18n` (khối `authForms` mới); tokens-only; web import không đuôi,
  API import đuôi `.js`.
- **KHÔNG đổi visual** 6 trang đã duyệt (diff khoanh handler/state/lỗi);
  KHÔNG `loading.tsx`; KHÔNG sửa migration cũ (migration MỚI được phép —
  Task 1); KHÔNG đụng contract oRPC.
- Mọi tên method/option Better Auth khi lệch `.d.mts` thực tế → tin `.d.mts`,
  ghi lại lệch trong report (bài học `revalidateTag 'max'`).
- TDD logic thuần; jsdom ADR-0014 (`src/components/**/*.spec.tsx`); node
  project cho `src/lib/**/*.spec.ts`. `pnpm gate:int` trước khi khai xong cụm.
- Cổng 3000/3001 sạch; DB đọc qua `docker exec … psql`; container để nguyên.

---

### Task 1: API — plugin emailOTP + migration `EMAIL_OTP` + template + int test SEC-1

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (enum `EmailType` thêm `EMAIL_OTP` cuối danh sách)
- Create: `apps/api/prisma/migrations/<timestamp>_email_otp_enum/migration.sql` (sinh bằng CLI — KHÔNG viết tay)
- Modify: `apps/api/src/auth/auth.config.ts`
- Modify: `apps/api/src/worker/resend.deliverer.ts` (+ case template) và `resend.deliverer.spec.ts`
- Modify: `apps/api/src/auth/auth.int.spec.ts` (describe mới)

**Interfaces (Produces):** flow HTTP mà web (Task 3/5) sẽ gọi qua client BA:
`POST /api/auth/email-otp/verify-email` `{email, otp}` ·
`POST /api/auth/email-otp/send-verification-otp` `{email, type: 'email-verification'}`
(path do BA tự mount — không cần biết chính xác ở web, client SDK lo).

- [ ] **Step 1:** schema.prisma thêm `EMAIL_OTP` vào enum `EmailType` (kèm
  doc-comment `///` tiếng Việt: mã OTP verify email — ADR-0017 §5a). Sinh
  migration: `pnpm --filter @tourism/api exec prisma migrate dev --name email_otp_enum`
  (đọc script package.json nếu có wrapper sẵn). ⚠️ NẾU Prisma AI-safety guard
  chặn lệnh → DỪNG, báo BLOCKED kèm đúng lệnh cần chạy để controller đưa
  user chạy tay (nếp cụm tours 31/07); KHÔNG bypass guard, KHÔNG viết tay
  file migration.
- [ ] **Step 2 (RED):** `auth.int.spec.ts` thêm describe "verify email bằng OTP
  (ADR-0017 §5a — SEC-1 phải sống)" — dùng đúng bootstrap/inject sẵn có của
  file (đọc 2 test admin-promote `:95-104`/`:120-127` làm khuôn):
  1. sign-up email `ADMIN_EMAILS` → đọc outbox row mới nhất `type='EMAIL_OTP'`
     lấy `payload.otp` → inject POST verify-email `{email, otp}` → đọc DB:
     `email_verified=true` VÀ `role='ADMIN'`;
  2. sign-up email thường → verify OTP → `role='CUSTOMER'` (không promote);
  3. sau sign-up outbox CÓ row `EMAIL_OTP` và KHÔNG có row
     `EMAIL_VERIFICATION` mới (override link hoạt động);
  4. OTP sai 1 ký tự → verify fail, `email_verified` vẫn false.
  Chạy đỏ (plugin chưa bật). ⚠️ **Điều khoản DỪNG:** nếu sau khi bật plugin
  (Step 3) test 1 fail Ở PHẦN role (verify ok nhưng không promote — hook
  `afterEmailVerification` không fire đường OTP) → BLOCKED, báo controller
  hỏi user; KHÔNG tự chế workaround.
- [ ] **Step 3 (GREEN):** `auth.config.ts`:

```typescript
import { emailOTP } from 'better-auth/plugins/email-otp';
// ... trong betterAuth({ ... }):
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 phút — khớp copy "code expires" nếu UI có
      sendVerificationOnSignUp: true,
      // Đè flow link mặc định: sendOnSignUp từ nay ra OTP (ADR-0017 §5a).
      // Khối emailVerification bên dưới GIỮ NGUYÊN — afterEmailVerification
      // (promote admin SEC-1) phải fire cả ở đường OTP; int test canh.
      overrideDefaultEmailVerification: true,
      allowedAttempts: 5,
      async sendVerificationOTP({ email, otp }) {
        await prisma.outbox.create({
          data: {
            type: EmailType.EMAIL_OTP,
            payload: { email, otp },
            dedupeKey: `email-otp:${email}:${otp}`.slice(0, 200),
          },
        });
      },
    }),
  ],
```

- [ ] **Step 4:** template worker: `resend.deliverer.ts` thêm
  `case EmailType.EMAIL_OTP` (subject "Your verification code", thân hiện
  `payload.otp` to-rõ + câu hết hạn 10 phút — copy tiếng Anh, theo đúng nếp
  các case sẵn có trong file); `resend.deliverer.spec.ts` thêm dòng vào bảng
  test render (khuôn `[EmailType.PASSWORD_RESET, /reset your password/i]`
  tại `:46`) + 1 test render OTP hiện đúng mã.
- [ ] **Step 5:** chạy GREEN: unit deliverer + `pnpm test:int -- auth` (đọc
  package.json cách filter — `vitest run -- <file>` KHÔNG filter, gotcha).
  Toàn bộ int cũ của auth phải vẫn xanh (flow link cũ đổi hành vi là ĐÚNG
  thiết kế — nếu test cũ nào assert link-verify thì cập nhật CÓ ghi chú
  trong report, không xoá lặng lẽ).
- [ ] **Step 6:** typecheck + biome; commit
  `feat(api): verify email bang OTP — plugin emailOTP + EmailType.EMAIL_OTP + SEC-1 int` .

---

### Task 2: Web nền — dep + `auth-client.ts` + `safeRedirect` + `mapAuthError`

**Files:**
- Modify: `apps/web/package.json` (dep `"better-auth": "1.6.23"` — GHIM, không `^`)
- Create: `apps/web/src/lib/auth-client.ts`
- Create: `apps/web/src/lib/safe-redirect.ts` + `safe-redirect.spec.ts`
- Create: `apps/web/src/lib/auth-errors.ts` + `auth-errors.spec.ts`

**Interfaces (Produces — Task 3/4/5/6 dùng nguyên văn):**
- `authClient` + `useSession` từ `@/lib/auth-client`
- `safeRedirect(raw: unknown, fallback?: string): string`
- `mapAuthError(error: { status?: number; code?: string } | null | undefined): AuthErrorKey`
  với `type AuthErrorKey = 'invalidCredentials' | 'emailExists' | 'tooManyRequests' | 'invalidOtp' | 'invalidToken' | 'notAvailable' | 'generic'`

- [ ] **Step 1:** `pnpm add better-auth@1.6.23 --filter @tourism/web`
  (kiểm lockfile chỉ thêm, không nâng gì khác — `git diff pnpm-lock.yaml --stat`).
- [ ] **Step 2:** `auth-client.ts`:

```typescript
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { apiOrigin } from '@/lib/api/env';

/**
 * Client Better Auth DUY NHẤT của web (ADR-0017 §1) — cookie httpOnly do API
 * phát, browser gọi thẳng origin API (không proxy, không Bearer). baseURL
 * dùng lại apiOrigin() — không lặp base-URL (bài học Nexora 8 file).
 */
export const authClient = createAuthClient({
  baseURL: apiOrigin(),
  plugins: [emailOTPClient()],
});

export const { useSession } = authClient;
```

  (import path `better-auth/client/plugins` — NẾU `.d.mts` web bảo khác thì
  theo `.d.mts`, ghi report.)
- [ ] **Step 3 (RED→GREEN):** `safe-redirect.spec.ts` case ác đủ bộ:
  hợp lệ `/tours?x=1`; loại `//evil.example`, `https://evil.example`,
  `javascript:alert(1)`, `\` trong path, ký tự điều khiển ` `, chuỗi
  rỗng, không phải string, dài >512 → tất cả về fallback `'/'` (hoặc
  fallback truyền vào). Impl:

```typescript
/** Chống open-redirect (port ngữ nghĩa safe-redirect.ts của Nexora):
    chỉ nhận path local một dấu `/` đầu, còn lại về fallback. */
export function safeRedirect(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (raw.includes('\\')) return fallback;
  // Ký tự điều khiển (\n, \r, \t, NUL…) — viết bằng escape unicode,
  // đừng dán ký tự thật vào source.
  if (/[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}
```

- [ ] **Step 4 (RED→GREEN):** `auth-errors.spec.ts` + impl `mapAuthError`:
  `401` → `invalidCredentials` · `422`/code chứa `EXISTS` → `emailExists` ·
  `429` → `tooManyRequests` · code chứa `OTP` → `invalidOtp` · code chứa
  `TOKEN` → `invalidToken` · `404`/`501` → `notAvailable` · còn lại/null →
  `generic`. (Shape error của BA client: object `{ status, code?, message? }`
  — XÁC MINH 1 lần bằng `.d.mts` `better-auth/react` khi viết, chỉnh map
  theo thực tế, test theo shape thật.)
- [ ] **Step 5:** typecheck + biome + 2 spec xanh; commit
  `feat(web): nen auth client — better-auth 1.6.23 + safeRedirect + mapAuthError`.

---

### Task 3: Login + Register + nút Google

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối MỚI `authForms` — chèn thuần)
- Modify: `apps/web/src/components/auth/login-form.tsx` (+ spec mới `login-form.spec.tsx`)
- Modify: `apps/web/src/components/auth/register-form.tsx` (+ spec mới)

**Interfaces:**
- Consumes: `authClient`, `safeRedirect`, `mapAuthError` (Task 2 — chữ ký ở đó).
- i18n `authForms` copy (tiếng Anh) tối thiểu: `errors.invalidCredentials`
  ("Invalid email or password.") · `errors.emailExists` ("An account with
  this email already exists.") · `errors.tooManyRequests` ("Too many
  attempts. Please wait a minute.") · `errors.invalidOtp` ("That code didn't
  match. Try again.") · `errors.invalidToken` ("This link has expired or was
  already used.") · `errors.notAvailable` ("Google sign-in is not available
  yet.") · `errors.generic` ("Something went wrong. Please try again.") ·
  các nhãn trạng thái submit đang-gửi nếu form chưa có.

- [ ] **Step 1:** i18n khối `authForms` (git diff chỉ hiện khối mới).
- [ ] **Step 2:** `login-form.tsx`: state email/password (+ map checkbox
  remember → `rememberMe` NẾU form đã có checkbox — KHÔNG thêm mới); submit:

```typescript
const { error } = await authClient.signIn.email({ email, password });
if (error) { setFormError(mapAuthError(error)); return; }
router.push(safeRedirect(searchParams.get('redirect')));
router.refresh();
```

  Lỗi hiện inline theo khuôn lỗi form sẵn có (đọc component trước — motion/
  markup giữ nguyên). Nút Google: `authClient.signIn.social({ provider:
  'google', callbackURL: window.location.origin + safeRedirect(searchParams.get('redirect')) })`
  — error → inline `notAvailable`.
- [ ] **Step 3:** `register-form.tsx`: `authClient.signUp.email({ name, email,
  password })` → thành công `router.push('/verify-email?email=' +
  encodeURIComponent(email))`. Checkbox Terms giữ vai trò gate client sẵn có.
  Google như login.
- [ ] **Step 4 (jsdom):** 2 spec — mock module `@/lib/auth-client` +
  `next/navigation`: submit gọi đúng method + payload; error 401 → text
  i18n `invalidCredentials` xuất hiện; thành công → push đúng đích (login:
  safeRedirect; register: `/verify-email?email=…`); Google error → text
  `notAvailable`. Mutation-bite tự kiểm 1 case (đổi key i18n → test đỏ).
- [ ] **Step 5:** test + typecheck + biome; commit
  `feat(web): login + register goi Better Auth that — loi inline + safe redirect`.

---

### Task 4: Forgot + Reset password

**Files:**
- Modify: `apps/web/src/components/auth/forgot-password-form.tsx` (+ spec mới)
- Modify: `apps/web/src/components/auth/reset-password-form.tsx` (+ spec mới)
- Modify (nếu cần đọc `?token=` từ server): `apps/web/src/app/(auth)/reset-password/page.tsx` — truyền `searchParams` xuống form qua prop, KHÔNG đổi layout

- [ ] **Step 1:** forgot: submit → `authClient.requestPasswordReset({ email,
  redirectTo: window.location.origin + '/reset-password' })` → LUÔN chuyển
  state `sent` sẵn có (anti-enumeration — không phân biệt email tồn tại; chỉ
  lỗi mạng thật sự mới hiện `generic` inline).
- [ ] **Step 2:** reset: token từ `?token=` (BA gắn khi redirect); thiếu/rỗng
  → panel lỗi thân thiện + link `/forgot-password` (khuôn panel lỗi trang
  unsubscribe — KHÔNG 404). Submit: `authClient.resetPassword({ newPassword,
  token })` → thành công: toast success (sonner — thao tác rời trang) +
  `router.push('/login')`; lỗi → inline `invalidToken`/`generic` theo map.
  PasswordStrengthField giữ nguyên vai trò checklist client.
- [ ] **Step 3 (jsdom):** 2 spec: forgot LUÔN ra `sent` (cả khi resolve
  `{error: null}` lẫn khi email lạ); reset thiếu token → panel lỗi; submit
  đúng payload; token hỏng (mock error TOKEN) → text `invalidToken`.
- [ ] **Step 4:** test + typecheck + biome; commit
  `feat(web): forgot + reset password — anti-enumeration + panel token hong`.

---

### Task 5: Verify-email OTP + PARK two-factor

**Files:**
- Modify: `apps/web/src/app/(auth)/verify-email/page.tsx` (đọc `searchParams.email` server, truyền prop)
- Modify: `apps/web/src/components/auth/otp-form.tsx` (+ spec mới `otp-form.spec.tsx`)
- Modify: `apps/web/src/app/(auth)/two-factor/page.tsx` (CHỈ 1 comment PARK đầu file)

- [ ] **Step 1:** `otp-form.tsx` nhận prop `email: string | null` (page đọc
  `searchParams`): không email → panel hướng dẫn + link `/login` (không
  crash, không đổi khung AuthScreen). Submit 6 số:
  `authClient.emailOtp.verifyEmail({ email, otp })` → thành công: toast
  success + `router.push(safeRedirect(searchParams.get('redirect')))` +
  `refresh`; lỗi → inline `invalidOtp`, KHÔNG reset countdown. Nút resend
  (đúng countdown 60s sẵn có): `authClient.emailOtp.sendVerificationOtp({
  email, type: 'email-verification' })`.
- [ ] **Step 2:** two-factor/page.tsx: thêm MỘT comment tiếng Việt đầu file:
  PARK theo ADR-0017 §5b — API chưa bật plugin twoFactor, trang giữ tĩnh làm
  UI dự phòng; nợ có kế hoạch. Không đổi gì khác.
- [ ] **Step 3 (jsdom):** spec otp-form: có email → submit gọi verifyEmail
  đúng payload; OTP sai (mock error) → text `invalidOtp` + countdown không
  reset; resend gọi sendVerificationOtp đúng type; không email → panel
  hướng dẫn hiện, không gọi client.
- [ ] **Step 4:** test + typecheck + biome; commit
  `feat(web): verify email OTP that — resend 60s + park two-factor`.

---

### Task 6: user-menu `useSession` + signOut + khai tử `mocks/auth.ts`

**Files:**
- Modify: `apps/web/src/components/user-menu.tsx` + `user-menu.spec.tsx`
- Delete: `apps/web/src/mocks/auth.ts`
- Modify: `apps/web/src/mocks/types.ts` (xoá `MockSessionUser` NẾU không còn ai import — grep trước)

- [ ] **Step 1:** `user-menu.tsx`: `const { data } = useSession()`; gate
  `if (!data?.user)` thay `MOCK_SESSION` (đang-tải → nhánh logged-out, ghi
  comment lý do); avatar/tên lấy từ `data.user.name/email` (UI giữ nguyên);
  "My account/My bookings" GIỮ `#top` (bước 8 — comment nợ đã có thì giữ).
  Sign out: `await authClient.signOut();` rồi `router.push('/')` +
  `router.refresh()` (comment: client-side để store BA cập nhật navbar ngay
  — bài học Nexora, ADR-0017 §2).
- [ ] **Step 2:** xoá `mocks/auth.ts`; grep `MOCK_SESSION|mocks/auth|MockSessionUser`
  toàn `apps/web/src` = 0 hit (trừ types.ts nếu còn dùng chỗ khác — không
  thì xoá type luôn).
- [ ] **Step 3 (jsdom):** `user-menu.spec.tsx` đổi mock sang `@/lib/auth-client`:
  session null → link Log in; có session → tên + dropdown; click Sign out →
  `signOut` được gọi rồi push `/`.
- [ ] **Step 4:** test + typecheck + biome; commit
  `feat(web): user-menu doc session that + sign out — khai tu mocks/auth`.

---

### Task 7: Nghiệm thu sống (spec §8) + gate:int + chốt

- [ ] **Step 1:** API + DB sống; `rm -rf apps/web/.next` → production build →
  `next start` (ghi PID). Đo và DÁN NGUYÊN VĂN đủ 6 mục spec §8 (vòng đời
  register→OTP-từ-outbox→verified; SEC-1 hai chiều — email admin test thêm
  qua BIẾN MÔI TRƯỜNG lúc chạy API, KHÔNG sửa `.env.local`; vòng reset trọn
  + token dùng lại → lỗi; `?redirect=` lành/ác; trang public vẫn ISR
  (`x-nextjs-cache` HIT lần 2) + slug lạ 404; `pnpm gate:int` trọn). Cookie
  kiểm `httpOnly` bằng devtools/`document.cookie` rỗng qua playwright
  headless (`npx playwright screenshot`/evaluate — máy có sẵn, memory ghi).
- [ ] **Step 2:** dọn: xoá user test khỏi DB (SQL — dán lệnh), kill đúng PID,
  cổng về `000`. Commit chốt nếu có sửa vụn:
  `test(web): nghiem thu cum auth buoc 7`. DỪNG — final review → user quyết
  merge → docs sweep luật 13 (CHANGELOG nhớ luật dấu `+`; ADR-0016 danh sách
  mock sống bỏ `mocks/auth.ts`; ADR-0017 thêm "đã thi hành"; README specs +
  plans + tracker).
