# Kế hoạch — Cụm 6 trang Auth (static-first)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline,
> có chốt review với user sau Task 2 — Login là MẪU layout, duyệt rồi mới nhân rộng).

**Goal:** 6 trang auth UI (Login/Register/Forgot/Reset/Verify/2FA) dùng chung
AuthLayout split + chữ ký "tấm vé", static-first theo
[spec](../specs/2026-07-24-auth-pages-design.md).

**Architecture:** Route group `(auth)` với layout riêng (KHÔNG TopBar/navbar/
footer — chỉ logo về Home); một `AuthPanel` (nửa phải tối dùng chung, quote đổi
theo trang) + một `TicketCard` (form card mép perforation + cuống vé mono);
6 page chỉ thay ruột form.

**Tech Stack:** Next 16 App Router · @tourism/ui (input, checkbox, input-otp,
separator) · motion/react spring 320/70 · token thuần.

## Global Constraints

- Copy user-facing tiếng Anh (#7) · comment tiếng Việt (#8) · tokens-only (#6).
- Án lệ #25: không ALL-CAPS Literata; accent = italic primary.
- Cuống vé dùng `font-mono` (IBM Plex Mono) — vai chính thức đầu tiên của mono.
- Static-first: submit no-op; mock state cho các trạng thái (đã gửi mail, đếm
  ngược resend) bằng useState demo, KHÔNG gọi API.
- Server dev của user đang chạy → chỉ verify typecheck+biome, không build web.

---

### Task 1: Route group (auth) + AuthPanel + TicketCard

**Files:**
- Create: `apps/web/src/app/(auth)/layout.tsx` — layout 2 nửa, KHÔNG shell chung.
  Lưu ý: layout gốc `app/layout.tsx` render TopBar/SiteHeader/Footer/ScrollToTop
  cho MỌI trang → phải chuyển các shell đó xuống một route group `(site)` HOẶC
  điều kiện hoá. Cách chọn: tạo `app/(site)/layout.tsx` chứa shell, dời
  `page.tsx`, `about/`, `contact/` vào `(site)/`; `app/layout.tsx` chỉ còn html/
  body/fonts/theme-script/MotionProvider/Lenis. (Next: route group không đổi URL.)
- Create: `apps/web/src/components/auth/auth-panel.tsx` — props `{quote, author}`:
  panel tối (dark scope) ImagePlaceholder + scrim + logo + quote Literata italic.
- Create: `apps/web/src/components/auth/ticket-card.tsx` — props
  `{stub: string; children}`: card bg-card bo 2xl, mép trái perforation (CSS
  radial-gradient chấm đục lỗ theo token border), chân card
  `<p className="font-mono text-xs tracking-widest text-muted-foreground">{stub}</p>`
  ngăn bằng đường nét đứt.

**Interfaces (Produces):**
- `AuthLayout` route group tự áp cho mọi page con trong `(auth)/`.
- `<AuthPanel quote="..." author="..." />` · `<TicketCard stub="HN → SAPA · GATE: LOGIN">…</TicketCard>`.

- [ ] Dời page/about/contact vào `(site)/` + layout shell; typecheck.
- [ ] Viết auth-panel.tsx + ticket-card.tsx theo mô tả; biome + typecheck.
- [ ] Commit `feat(web): route group (site)/(auth) + AuthPanel + TicketCard`.

### Task 2: /login (MẪU — chốt review với user trước khi làm tiếp)

**Files:**
- Create: `apps/web/src/app/(auth)/login/page.tsx` (metadata + compose)
- Create: `apps/web/src/components/auth/login-form.tsx`

**Ruột form:** heading "Welcome back to the road." (accent italic) · nút Google
(icon G tự vẽ SVG vào `icons/social.tsx`, style outline) · separator chữ
"or continue with email" · email + password (`ContactField`-style label thường,
KHÔNG icon-in-field — auth cần tối giản; dùng `Input` shadcn nguyên bản) ·
hàng phụ: checkbox "Remember me" + link "Forgot password?" · nút submit
bg-primary full-width "Board the trip" ·
chân: "New here? Create an account" → /register. Stub vé: `HN → SAPA · SEAT 07/12 · GATE: LOGIN`.
Quote panel: "Welcome back — the valley kept your seat." — Mai, Sa Pa guide.

- [ ] Viết login-form + page; biome + typecheck.
- [ ] Screenshot 1920 (server user nếu sống, không thì 3001 + kill) — soát.
- [ ] Commit `feat(web): /login mẫu AuthLayout vé tàu` → **DỪNG chờ user duyệt layout**.

### Task 3: /register

- Create: `(auth)/register/page.tsx` + `components/auth/register-form.tsx` —
  name/email/password + checkbox "I agree to the Terms" + Google + link Login.
  Stub: `NEW TRAVELLER · GATE: REGISTER`. Quote đổi (câu minivan 2014).
- [ ] Viết, verify, screenshot, commit.

### Task 4: /forgot-password + /reset-password

- forgot: 1 field email + nút "Send the reset link"; mock state `sent` →
  đổi thân card thành thông báo "Check your inbox" + nút gửi lại (useState demo).
  Stub: `LOST TICKET DESK`.
- reset: password ×2 + thanh độ mạnh (div 4 vạch đổi màu theo độ dài mock).
  Stub: `REISSUE TICKET`.
- [ ] Viết cả hai, verify, screenshot, commit.

### Task 5: /verify-email + /two-factor (dùng chung OtpForm)

- Create: `components/auth/otp-form.tsx` — props `{title, description, stub…}`
  dùng `input-otp` 6 ô + đếm ngược resend 60s (useState + useEffect demo).
- verify-email: "We mailed you six digits." Stub: `BOARDING CHECK · EMAIL`.
- two-factor: "Open your authenticator app." + link "Use a recovery code"
  (toggle input text mock). Stub: `BOARDING CHECK · TOTP`.
- [ ] Viết OtpForm + 2 page, verify, screenshot, commit.

### Task 6: Nối link + chốt cụm

- UserMenu "/login" đã trỏ đúng; rà cross-link 6 trang (login↔register↔forgot→reset,
  register→verify note); mobile menu "Log in" ok.
- [ ] Toàn bộ: typecheck + test + biome; screenshot lượt cuối cả 6.
- [ ] gate:int (cổng rảnh) + push branch CI + chờ user duyệt merge + docs sweep
  (CHANGELOG, README map: thêm spec+plan này, trạng thái P3b).

## Self-review

- Spec coverage: 6 trang ✔ layout chung ✔ vé ✔ Google ✔ TOTP ✔ mock states ✔
  nợ API ghi trong spec ✔. Route-group move là việc kiến trúc thật cần Task 1.
- Không placeholder mơ hồ: các stub/quote/copy đã cho nguyên văn ở từng task.
- Interface nhất quán: AuthPanel/TicketCard props cố định từ Task 1, các task
  sau chỉ compose.
