# ADR-0010 — Infra hardening trước P3b: exception filter · helmet · Sentry

- **Trạng thái:** Accepted (2026-07-22)
- **Bối cảnh:** [độ sẵn sàng backend 22/07](../analysis/2026-07-22-backend-readiness-vs-nexora.md) §hạ tầng —
  3 gap "độ chín production" (TB) còn mở sau khi 4/8 lỗ 19/07 đã đóng. Đóng trước khi web P3b lộ FE.

## Bối cảnh

Ba lỗ hạ tầng Nexora có mà v2 thiếu, không chặn cứng web nhưng nên đóng trước khi web checkout đi thật:

1. **Không có global exception filter** — oRPC procedure format lỗi theo envelope `{defined, code, status,
   message, data}`, NHƯNG lỗi từ **guard** (401/403 trên MỌI route, kể cả oRPC) + **route Nest thuần**
   (`/api/account/*`) + **500 bất ngờ** rơi về shape mặc định Nest `{statusCode, message, error}` — thiếu
   `code`. FE parse `.code` sẽ vấp không đồng nhất tùy nguồn lỗi.
   (Webhook đã tự ném `{code, message}` nên đã ổn; oRPC procedure-error tự format nên đã ổn.)
2. **Không helmet/security headers** — v2 không set header bảo mật nào.
3. **Không Sentry/observability** — 500 chỉ nằm trong `console.error` của oRPC `onError`, bay theo restart.

## Quyết định

1. **Global exception filter (`APP_FILTER`)** → chuẩn hoá MỌI lỗi rơi vào pipeline Nest về đúng envelope
   oRPC: `{ defined: false, code, status, message, data: null }`. FE có MỘT parser cho mọi nguồn lỗi.
   - HttpException có body object mang `code` (webhook) → giữ nguyên `code`/`message`.
   - HttpException body string (guard 401/403, v.v.) → `code` suy từ status (`statusToCode`:
     400→BAD_REQUEST, 401→UNAUTHORIZED, 403→FORBIDDEN, 404→NOT_FOUND, 409→CONFLICT,
     422→UNPROCESSABLE_ENTITY, …, mặc định HTTP_<status>).
   - Lỗi KHÔNG phải HttpException (bất ngờ) → `{ code: 'INTERNAL_SERVER_ERROR', status: 500,
     message: 'Internal server error' }` — **ẩn stack/chi tiết** (không leak), log + đẩy Sentry.
   - **KHÔNG đụng** response oRPC procedure đã tự format (chúng không propagate tới filter) — filter chỉ
     thấy guard-exception + route-Nest-thuần + lỗi bất ngờ.
2. **`@fastify/helmet`** đăng ký trong `configureHttp` (cùng chỗ CORS → test e2e phủ được, đúng bài học
   mutation 19/07). API-only (không serve HTML) nên **tắt CSP** (`contentSecurityPolicy: false`) — CSP là
   việc của web P3b; giữ các header còn lại (HSTS, X-Content-Type-Options, frameguard, …).
3. **Sentry** env-gated theo `SENTRY_DSN` (giống `RESEND_API_KEY`): DSN set → init + capture ở
   exception filter (500) và oRPC `onError`; không set → no-op (dev/test/capstone chưa có DSN).
   **Code-complete, active khi có DSN** — không verify live được (cần key), không phải blocker.

## Hệ quả

- Mọi lỗi HTTP có `code` top-level → FE web parse một kiểu. Guard 401/403 đổi shape body (thêm `code`) —
  test cũ chỉ assert `statusCode` không vỡ; test nào assert body-shape lỗi phải cập nhật (ripple có kiểm soát).
- Header bảo mật cơ bản bật cho mọi response; CSP để P3b.
- 500 được capture bền khi có Sentry DSN; ẩn stack khỏi client.
- **TDD:** filter — unit `statusToCode` + int (account 401 có `code:'UNAUTHORIZED'`; webhook `code` giữ nguyên;
  oRPC NOT_FOUND vẫn `{code:'NOT_FOUND'}` — chứng minh filter không đụng oRPC); helmet — e2e assert header
  `x-content-type-options` hiện diện; Sentry — env-gated, no-op khi thiếu DSN (không cần int).

## Đã cân nhắc và loại

- **Chỉ thêm `code` vào lỗi guard, giữ nguyên field Nest khác** (shape lai): loại — nửa vời, FE vẫn phải xử
  lý hai kiểu. Chuẩn hoá trọn về envelope oRPC sạch hơn.
- **CSP bật luôn ở API**: loại — API không serve HTML, CSP thuộc web P3b; bật mù dễ chặn nhầm.
- **Sentry bắt buộc (không env-gate)**: loại — cần DSN, chặn dev/test/capstone boot. Env-gate như RESEND.
