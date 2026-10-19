# ADR-0010 — Infra hardening trước P3b: exception filter · helmet · Sentry

- **Trạng thái:** Accepted (2026-07-22) · AMEND 1 (2026-10-19): §3 nối Sentry thật
- **Bối cảnh:** [độ sẵn sàng backend 22/07](../analysis/nexora-parity/2026-07-22-backend-readiness-vs-nexora.md) §hạ tầng —
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
3. **Sentry — đặt SEAM, hoãn kích hoạt (cần key + dep nặng).** Reserve env `SENTRY_DSN` (optional) + hàm
   `captureException(error)` (seam) mà exception filter GỌI cho lỗi 500. Hiện `captureException` NO-OP khi
   thiếu DSN — interim capture là `Logger.error` của filter (Render/Railway bắt stdout/stderr, không mất
   ngay lập tức). Cài `@sentry/node` + `Sentry.init/captureException` là follow-up một-hàm khi provision DSN
   (đúng tiêu chí "trừ phần cần key"). Không thêm dep nặng khi chưa dùng.

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

## AMEND 1 — 19/10/2026: §3 nối Sentry thật cho API

Yuri chốt 19/10 bật Sentry (mục 4 của bản rà việc còn thiếu ở api, web, admin cùng ngày).
Phải vào trước freeze 31/10 vì là dependency mới ([ADR-0001 AMEND 3](0001-tech-stack.md)).
AMEND này thay phần "hoãn kích hoạt" của §3; env-gate và hai call-site giữ nguyên.

1. **Gói:** `@sentry/node` ghim đúng `10.76.2` (dòng 10, bản vá 08/10), chỉ ở `apps/api`.
   Không lấy dòng 11: major ra 23/09, mới bốn tuần khi còn 12 ngày tới freeze. Web và
   admin không thêm Sentry, ngoài phạm vi ADR này.
2. **Khởi động:** `initObservability({ dsn, environment })` gọi một lần ở đầu `main.ts`
   (trước khi Nest dựng app) và đầu `worker.ts`. Thiếu `SENTRY_DSN` thì không init và
   `captureException` vẫn no-op, nên dev, test và CI không đổi. Hai call-site như cũ:
   exception filter (500) và `onError` của oRPC (lỗi bất ngờ).
3. **Chỉ bắt lỗi, không đo hiệu năng:** không đặt `tracesSampleRate`, nên SDK không thêm
   integration hiệu năng. `registerEsmLoaderHooks: false`: không tracing thì không cần móc
   ESM, mà móc ấy bọc mọi `import()` động về sau.
4. **Dữ liệu cá nhân tối thiểu:** `sendDefaultPii: false` (không IP, cookie, user).
   `beforeSend` bỏ header, cookie, body, query string và `user`, chỉ giữ method và đường
   dẫn của request; breadcrumb từ console bị bỏ; `includeLocalVariables` để mặc định tắt.
   `/privacy` kể Sentry trong danh sách nhà cung cấp.
5. **Tiến trình vẫn chết như Node khi có promise bị reject không ai bắt.** Integration
   `OnUnhandledRejection` mặc định của Sentry ở chế độ `warn`: ghi log rồi chạy tiếp, tức
   gắn Sentry vào là đổi hành vi mặc định của Node 15+ mà không ai thấy. Thay bằng
   `mode: 'strict'`: gửi lên Sentry, xả hàng đợi rồi `exit(1)`. `OnUncaughtException` mặc
   định đã thoát tiến trình.
6. **`SENTRY_DSN` siết thành URL** (`z.url()`): DSN sai thì Sentry tự tắt im lặng, nên ép
   ở boot là chỗ duy nhất người deploy thấy lỗi gõ, cùng nếp `RESEND_WEBHOOK_SECRET`.
7. **Release** lấy từ `RENDER_GIT_COMMIT` Render cấp sẵn (SDK tự đọc), không thêm env.
8. **Lockfile:** `@sentry/node` kéo `@opentelemetry/api`, và pnpm dùng luôn nó cho peer tuỳ
   chọn của `next`, `better-auth`, `@orpc/*` ở mọi app. Web, admin và mobile không đăng ký
   provider OTel nào nên các gói ấy vẫn chạy nhánh no-op; gate (build web và admin, bundle
   mobile) là phép đo.
9. **Kiểm sau khi đặt DSN:** script `sentry:test` của `apps/api` build rồi gửi một sự kiện
   thử qua chính `initObservability` của API; log boot của Render có dòng báo Sentry đã bật.

Hạ tầng (luật 15, làm sau merge): tạo project Sentry kiểu Node, đặt `SENTRY_DSN` trên
Render và trong `apps/api/.env.production`. Chưa đặt thì API chạy y như trước.
