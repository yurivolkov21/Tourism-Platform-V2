# ADR-0017 — Session Better Auth ở web: cookie thẳng browser ↔ API, client island, proxy matcher hẹp

- **Trạng thái:** **Accepted (2026-08-03)** — user duyệt toàn văn cùng ngày;
  2 điểm §5 (emailOTP · PARK 2FA) user chốt qua hỏi-đáp trước khi Accept.
  **Đã thi hành phần bước 7 cùng ngày** (`ec33797..9a0c30a` — 5/6 form +
  `useSession` island + emailOTP; SEC-1 đo sống đường OTP). Phần bước 8–10
  (`proxy.ts`, `credentials: 'include'` cho oRPC, trang account) còn mở.
  Lưu ý thi công đã đo: Better Auth merge option plugin bằng `defu` — tự
  khai `sendVerificationEmail` là override OTP của plugin bị nuốt im lặng,
  phải bỏ field đó (chi tiết CHANGELOG 03/08).
- **Bối cảnh:** ADR-0016 §2 cố ý chốt non ("chi tiết CHỐT Ở BƯỚC 7"). Bước 7
  (6 trang auth) + 8–10 (khu tài khoản) cần cơ chế session. Khảo sát 3 mũi
  03/08: Better Auth phía API (`auth.config.ts`, guard, CORS) · Nexora tầng
  web (Supabase Auth — luật parity 10, hai tầng) · 6 trang auth tĩnh v2.

## Bối cảnh đã đo (con số từ code, không đoán)

- API: `better-auth@1.6.23` mount `/api/auth/*` trên :3001
  (`auth.controller.ts:19-44`); session/cookie toàn **default BA**: cookie
  `better-auth.session_token`, `httpOnly`, `sameSite: lax`, `secure` khi
  baseURL https, expiresIn 7 ngày/updateAge 1 ngày, KHÔNG cookieCache,
  KHÔNG plugin nào (`auth.config.ts:31-98`). `AuthGuard` đọc session từ
  **cookie header** qua `auth.api.getSession()` gọi trong-process
  (`auth.guard.ts:44-49`).
- CORS đã sẵn cho cookie cross-origin: `origin: trustedOrigins,
  credentials: true` (`bootstrap.ts:44-49`; default localhost:3000+3002).
- Web: 6 trang auth là server page mỏng bọc `AuthScreen` client; form no-op;
  `user-menu.tsx` gate bằng `MOCK_SESSION`; **không có** `proxy.ts`/
  middleware; **không có** dep auth client nào trong `apps/web`.
- SameSite thực tế: `localhost:3000 → localhost:3001` là **same-site**
  (site = scheme + registrable domain, KHÔNG tính port) → dev mọi fetch kèm
  cookie chạy với `lax`. Prod hai **domain khác nhau** thì `lax` CHẶN cookie
  trên fetch cross-site — đây là ràng buộc deploy, xem Quyết định 4.

## Quyết định

### 1. Cookie Better Auth thẳng browser ↔ API — không proxy, không Bearer

Web dùng `createAuthClient` (`better-auth/react`) trỏ `NEXT_PUBLIC_API_URL`
(:3001), mọi call auth + mọi call cần session từ browser đi thẳng API với
`credentials: 'include'` (client `lib/api/client.ts` thêm option này cho
nhóm procedure cần auth). Không route auth nào đi qua server Next: giữ
nguyên lý per-IP của ADR-0016 §2, không thêm hop, và cookie `httpOnly` do
API phát — JS không bao giờ chạm token (hơn hẳn Bearer trong storage).
Điểm cấu trúc quyết định lựa chọn này: **API chính là auth server** —
không có "đồng bộ user" giữa hai hệ như Nexora (Supabase ↔ backend), cả
lớp bug `USER_NOT_SYNCED` + retry-sync-once của họ không tồn tại ở v2.

### 2. Trạng thái đăng nhập trên UI: client island `useSession`

`user-menu.tsx` (đã là client) thay `MOCK_SESSION` bằng `useSession()` của
auth client — navbar phản ứng ngay khi login/logout (bài học Nexora: login/
sign-out chạy client-side để `onAuthStateChange` cập nhật navbar; BA client
có store tương đương). **Cấm đọc session trong layout/page server của trang
public** — một `await getSession()` ở layout là kéo cả site khỏi static/ISR.
Trang public giữ nguyên mô hình render hiện tại, session chỉ là island.

### 3. Trang bảo vệ (bước 8–10): `proxy.ts` matcher hẹp + defense-in-depth

Port nguyên pattern Nexora đã vận hành: `apps/web/src/proxy.ts` (Next 16
đổi tên từ middleware) với matcher **chỉ** `['/account/:path*',
'/tours/:slug/book']` — trang public không bao giờ đi qua proxy; proxy
kiểm cookie session (gọi `GET /api/auth/get-session` forward cookie, hoặc
chỉ kiểm cookie tồn tại rồi để page xác thực thật) → chưa đăng nhập thì
redirect `/login?redirect=<path>` qua **safe-redirect whitelist local-only**
(port `safe-redirect.ts` của Nexora — chống open-redirect). Mỗi page account
vẫn tự đọc session server-side và redirect (defense-in-depth — Nexora làm ở
cả 2 lớp, giữ). Server đọc session bằng fetch `get-session` kèm
`headers: { cookie: (await cookies()).toString() }` — bọc helper MỘT chỗ
`lib/api/session.ts`, React `cache()` chống double-fetch.

### 4. Cookie cross-domain ở prod: cùng registrable domain là RÀNG BUỘC deploy

Dev: default `lax` chạy sẵn (same-site). Prod: web + API PHẢI ở dưới cùng
một registrable domain (vd `tourism.example` + `api.tourism.example`) +
bật `advanced.crossSubDomainCookies` phía API khi tới lúc deploy. Phương án
`sameSite: 'none'` (cho phép 2 domain rời, vd *.vercel.app + *.railway.app)
là **fallback có chủ đích** — một dòng config, nhưng mất lớp phòng thủ CSRF
của lax nên chỉ dùng nếu ràng buộc domain không khả thi. Ghi vào checklist
deploy cùng chỗ `REVALIDATE_SECRET`/`FRONTEND_URL`.

### 5. Hai vênh UI-tĩnh ↔ API (user quyết 03/08)

- **(a) Verify email bằng OTP — bật plugin `emailOTP` phía API.** Trang
  `verify-email` đã duyệt theo UI OTP 6 số trong khi flow hiện tại là link
  (`sendOnSignUp`); user chọn giữ UI, API bật `emailOTP` cho verification
  (mã đi qua outbox email như link hiện tại). **Điều kiện nghiệm thu bắt
  buộc:** hook `afterEmailVerification` (promote admin — ADR-0008) phải
  chạy cả ở đường OTP — canh bằng int test, không tin doc; nếu đo được hook
  KHÔNG chạy với OTP thì DỪNG hỏi lại trước khi chế workaround.
- **(b) 2FA: PARK.** Bước 7 không bật plugin `twoFactor` (YAGNI — capstone
  không doanh thu, freeze 15/10); trang `two-factor` giữ tĩnh + ghi nợ có
  kế hoạch trong spec bước 7. Bật plugin (schema + TOTP/recovery flow) là
  ADR/spec riêng khi thật cần.

## Hệ quả

- `apps/web` thêm dep `better-auth` (client-only import) — bám version API
  1.6.23; nhóm procedure cần auth trong `lib/api/client.ts` gọi với
  `credentials: 'include'`; thêm `lib/api/session.ts` (server read) +
  `proxy.ts` + `safe-redirect.ts`.
- 6 form auth nối `authClient.signUp.email / signIn.email / signOut /
  requestPasswordReset / resetPassword` (+ OTP nếu §5a chọn emailOTP);
  redirect sau login theo `?redirect=` whitelist; lỗi auth hiện inline theo
  nếp form (toast chỉ cho kết quả thao tác — nếp đã chốt).
- Google OAuth: API đã điều kiện hoá theo cặp env; web chỉ hiện nút khi
  được bật — cùng redirect flow `/api/auth/*` của BA, không code riêng.
- Mock chết theo trang: `mocks/auth.ts` khai tử khi user-menu nối thật
  (danh sách mock sống của ADR-0016 cập nhật ở docs sweep).
- KHÔNG bật `cookieCache` bước 7 (YAGNI — một round-trip get-session mỗi
  SSR trang account là chấp nhận được; bật sau nếu đo thấy cần).

## Đối chiếu Nexora (luật 10 — phân loại)

| Mảnh Nexora | v2 | Phân loại |
| --- | --- | --- |
| `proxy.ts` matcher hẹp 2 route + per-page redirect | Port nguyên pattern | tương đương (kế thừa) |
| Bearer per-call từ session Supabase | Cookie httpOnly thẳng API | làm khác — tiền đề đổi (API là auth server), **v2 tốt hơn** (không token trong JS) |
| `syncUser` + retry `USER_NOT_SYNCED` | Không tồn tại (một user table) | **v2 tốt hơn** — cả lớp bug biến mất |
| 2 route confirm (PKCE + token-hash, mở khác trình duyệt) | BA verify link/OTP tự xử tại API origin; web chỉ nhận redirect | làm khác mà tương đương; nghiệm thu phải đo ca "mở link ở trình duyệt khác" |
| safe-redirect whitelist + `?redirect=` | Port | tương đương (kế thừa) |
| Login/sign-out client-side cho navbar reactivity | `useSession` island | tương đương (kế thừa) |
| Không security header ở web Nexora | v2 web cũng chưa — việc của P7 polish, ghi nợ | cố ý hoãn (ghi lý do) |
| 401 giữa chừng: retry-sync rồi báo lỗi form | Không cần retry-sync; 401 → thông điệp form + link login | làm khác — đơn giản hơn nhờ tiền đề |

## Đã cân nhắc và loại

1. **Proxy toàn bộ auth qua route handler Next** — thêm hop, cookie hai
   tầng domain, phá per-IP (ADR-0016 §2), và AuthGuard đã đọc cookie thẳng.
2. **Bearer token (plugin `bearer`) như Nexora** — token phải sống trong
   JS/storage (XSS surface), thêm plugin + bề mặt test; cookie httpOnly
   rẻ hơn và BA thiết kế cookie-first.
3. **Đọc session ở root layout cho tiện** — giết static/ISR toàn site; đã
   có bài học matcher-hẹp của chính Nexora chống lại điều này.
4. **Bật `cookieCache` ngay** — tối ưu sớm; chưa có số đo nào nói cần.
