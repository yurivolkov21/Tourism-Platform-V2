# Báo cáo tiến độ 04/08 — mốc trước bước 8–10 + đối chiếu Nexora toàn cục

Chụp tại `b3fbb99` (main). Số liệu đo lại trong ngày, KHÔNG lấy từ trí nhớ:
route đếm bằng `find page.tsx`, endpoint đếm trong `contract.ts`, test chạy
thật, bề mặt Nexora quét lại bằng khảo sát read-only cùng ngày. Phần parity
tổng hợp từ 4 bản chuyên sâu ([infra 19/07](2026-07-19-infra-parity-nexora.md)
· [backend 22/07](2026-07-22-backend-readiness-vs-nexora.md) ·
[tours 27/07](2026-07-27-tours-parity-nexora.md) ·
[data-layer 31/07](2026-07-31-web-data-layer-parity-nexora.md)) + bảng auth
trong [ADR-0017](../adr/0017-web-session-better-auth.md).

## 1. Đã hoàn thành

### Backend (P0–P3a + vá dọc đường)

**33 endpoint** contract-first (oRPC/OpenAPILink), 15 module: catalogue ·
posts · reviews (moderation + recompute rating atomic — bất biến đảo 31/07) ·
wishlist · bookings · payments Stripe/PayPal sandbox · refund ledger
(advisory-lock + trigger `SUM≤total`, ADR-0009) · vòng đời PENDING (cron
sweep pg-boss, ADR-0006) · enquiries + newsletter (throttle per-IP, honeypot,
HMAC unsubscribe) · outbox email + dedupe-key · Better Auth (fail-closed
ADR-0003, admin bootstrap gated verify ADR-0008, emailOTP từ 03/08) · health ·
media URL (ADR-0005, chưa consumer). Hạ tầng: envelope lỗi một khuôn
(ADR-0010), helmet, CORS credentials, env chặn misconfig ở boot,
`minimumReleaseAge` + overrides scoped (audit 0 vuln, 1 dismissed có hồ sơ).

### Web (P3b — bước 1–7 + on-demand revalidation)

**20 route sống, 0 mock catalogue**: 14 trang public đọc API thật (ISR 300s +
cache-tag; 30 tour/19 destination/84 review seed thương phẩm; blog 9 bài +
RSS; robots/sitemap 52 URL; 404 thật — luật
[soft-404](../conventions/soft-404-loading-tsx.md)); hành vi GHI (contact ·
newsletter · unsubscribe — anti-enumeration); **on-demand revalidation**
(moderate → bust `['tours','tour:<slug>']` sau commit, hard-bust
`{expire: 0}`); **auth end-to-end** (5/6 trang, OTP verify + SEC-1 sống,
cookie httpOnly, `useSession` island, safe-redirect; 2FA PARK).

### Kỷ luật & chất lượng

17 ADR (đi trước code) · 9 spec + 8 plan đã thi công subagent-driven ·
CHANGELOG 46 entry + CI docs-freshness · test **805 web + 199 api unit +
55 contract + 153 int** — gate:int xanh trên main · Dependabot 0 alert mở.

## 2. Còn lại

### Lộ trình

1. **Bước 8–10 (P3b cuối):** khu tài khoản — wishlist (nút tim +
   `/account/saved`) · reviews của tôi + form viết review · bookings +
   **flow đặt tour/checkout** (`/tours/[slug]/book` → success/cancel) ·
   account/profile/security. Cần `proxy.ts` matcher hẹp +
   `credentials: 'include'` cho oRPC (ADR-0017 đã vẽ). ⚠️ Nexora còn có
   **đổi email · xoá tài khoản · upload avatar** trong account — spec bước
   8–10 phải nhớ, kẻo lọt (API xoá tài khoản ĐÃ có: `DELETE /api/account`).
2. **P4 Admin:** Nexora có **38 trang** back-office (bookings · tours CRUD +
   departures · reviews · posts editor · media · users · cancellations ·
   payment-events · outbox · subscribers · categories · destinations ·
   appearance). API admin v2 mới ~6 endpoint — phần lớn contract admin chưa
   viết. Khối lớn nhất còn lại.
3. **P5 Mobile:** Nexora Expo ~15 màn (5 tab + auth + booking + sheets).
4. **P6 AI concierge:** Nexora có thật — chat SSE (`@ai-sdk/anthropic`
   streamText), conversation lưu DB, tools phía API.
5. **P7 Polish** → freeze 15/10.

### Sổ nợ kỹ thuật (đều có hồ sơ trong CHANGELOG/ledger)

- **Chờ đúng bước:** reviews pageSize 20 (form bước 9 phá giả định) ·
  `metaTitle/metaDescription` chưa dùng (P4) · tag bust posts detail khi P4
  có editor · media thật thay `ImagePlaceholder` (chính sách chờ user) ·
  2FA PARK · 5 nợ contract tours (spec Tours §8: JSON-LD, next-departure
  trên card, sort rating, filter, suitableFor).
- **Money-path đến hạn (ADR-0002):** PayPal capture-on-return + smoke test
  provider thật — **trả TRƯỚC bước 10** (checkout đứng trên đường này).
- **Vá nhỏ gom một đợt:** confirm-password mismatch · register chuyển tiếp
  `?redirect=` · `FRONTEND_URL` thiếu guard prod · comment `seed.ts` (~206)
  sai · `source:'footer'` newsletter · re-export toast từ `@tourism/ui` ·
  tách panel lỗi unsubscribe · roster slug chép 2 chỗ.
- **Polish/P7:** `--rating` 2.27:1 light + nút primary trên card dark <3:1
  (WCAG 1.4.11 — cần quyết định thiết kế của user) · 6 vendor component còn
  `z-50` (chưa consumer — gán z phải theo vai trò) · dedup SPRING ~40 file ·
  15 phần tử `opacity:0` khi JS tắt.
- **Điều tra riêng:** compose-service `migrate` fail FK ở seed (đường trực
  tiếp + CI sạch).

## 3. Nexora ↔ v2

### v2 tốt hơn (đo được)

| Mảng | Nexora | v2 |
| --- | --- | --- |
| Kiến trúc auth | Supabase ↔ backend 2 hệ user → lớp bug `USER_NOT_SYNCED` + retry-sync | API là auth server — lớp bug không tồn tại; cookie httpOnly, không token trong JS |
| Đúng đắn tiền/ghế | Atomic claim thế hệ 1; refund từng dính TOCTOU | Advisory-lock + trigger `SUM≤total` + gate orphan; PENDING có cron sweep |
| Contract | openapi-fetch codegen | oRPC contract-first không codegen, type end-to-end |
| Data layer web | Không timeout; base-URL lặp 8 file; pagination client-side | `AbortSignal.timeout(10s)`; một module env; pagination server-side |
| Departures | Hardcode `[]` — khối chọn ngày không bao giờ hiện | Dữ liệu thật, chọn đợt đồng bộ 3 nơi |
| Verify email | Link PKCE 2 route | OTP khớp UI một đường |
| Kỷ luật docs | ADR hồi tố, CHANGELOG bỏ đói | ADR trước code; docs-freshness CI |
| Chuỗi cung ứng | Không có | `minimumReleaseAge` + overrides scoped; audit 0 |

### Tương đương (kế thừa có chủ đích)

ISR 300s + cache-tag + on-demand revalidation (ngang từ 03/08) · matcher
middleware hẹp · safe-redirect · `settle()`/LoadErrorState · throttle per-IP
browser-direct · toast + lỗi inline · outbox email · token pipeline Style
Dictionary.

### Thụt lùi thật còn mở (trong phần ĐÃ xây)

JSON-LD Product trang tour · next-departure trên card · sort rating + filter
giá/độ dài/độ khó (đều là nợ contract spec Tours §8, cần ADR mới) · media
thật (placeholder toàn site — CÓ chủ đích, chờ user) · skeleton loading (cố
ý bỏ — đổi lấy 404 thật) · React `cache()` dedupe metadata↔body (port một
phần).

### Chưa tới lượt (lộ trình, không phải thụt lùi)

Toàn bộ mục 2.1: account/booking/checkout web · admin 38 trang · mobile ·
AI chat.

## 4. Điểm mù

- Bề mặt Nexora quét ở mức inventory (đếm route/màn hình), chưa đối chiếu
  sâu từng trang admin/mobile — việc của parity từng phase (luật 10) khi mở
  P4/P5.
- Số test là snapshot 04/08; các con số route/endpoint sẽ trôi ngay từ bước
  8.
