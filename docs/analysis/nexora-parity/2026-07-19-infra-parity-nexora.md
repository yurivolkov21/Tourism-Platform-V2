# Đối chiếu hạ tầng v2 ↔ Nexora (19/07/2026)

Sau khi user phát hiện thiếu rate limiting, rà lại **tầng hạ tầng xuyên
suốt** — tầng mà API parity map trước P3 đã bỏ lọt vì chỉ đếm endpoint.

## Thụt lùi cần vá — xếp theo mức gấp

| # | Lỗ | Nexora có gì | Hỏng thế nào nếu để nguyên |
| --- | --- | --- | --- |
| 1 | **CORS thiếu hoàn toàn** | `main.ts:65-68` `app.enableCors({origin: CORS_ORIGINS, credentials:true})` | v2 **không có** `@fastify/cors` hay cấu hình nào. `TRUSTED_ORIGINS` chỉ nuôi CSRF check của Better Auth, KHÔNG set `Access-Control-Allow-Origin`. Ngay khi `apps/web` gọi API từ trình duyệt → chặn sạch. **P3b là phase kế tiếp** → đây là lỗ gấp nhất |
| 2 | **HTTP outbound không timeout** | Dùng SDK `stripe` chính chủ, có timeout mặc định | `defaultHttpPost` (`lib/provider-http.ts:31-38`) gọi `fetch()` trần, không `AbortController`. Stripe/PayPal/Resend treo → request tạo booking hoặc outbox-drain treo vô hạn. **Money-path đã chạy thật từ P2** |
| 3 | **Health check không chạm DB** | `SELECT 1`, trả 503 nếu DB chết (`app.controller.ts:29-43`) | v2 `health.controller.ts:7-14` trả `{status:'ok'}` tĩnh. Postgres chết (hoặc **Supabase tự pause sau 7 ngày**) mà `/health` vẫn 200 → nền tảng không restart, không cảnh báo. Nối thẳng với rủi ro ngày bảo vệ |
| 4 | **`trust proxy` chưa set** | `app.set('trust proxy', 1)` (`main.ts:60`) | Thiếu nó thì `req.ip` = IP của proxy. Vá rate limit mà quên cái này = **mọi client chung một bucket → tự DoS toàn site**. Hai thứ phải đi cùng nhau |
| 5 | **Rate limiting** | `@nestjs/throttler` per-controller: enquiry 5/60s, newsletter 5/60s, chat 10/60s (`enquiry.controller.ts:41`, `newsletter.controller.ts:40`, `chat.controller.ts:40`) | Endpoint ghi công khai spam được tuỳ ý. *Lưu ý:* Better Auth có rate limit built-in bật sẵn ở production (100 req/60s/IP) nên đường đăng nhập KHÔNG trần trụi như tôi nói ban đầu |
| 6 | **Exception filter global** | `HttpExceptionFilter` qua `APP_FILTER` (`app.module.ts:71`), chuẩn hoá `{data,error}`, ẩn stack | oRPC `onError` chỉ phủ procedure qua contract. **4 controller Nest thuần nằm ngoài**: webhooks, auth, account, health → shape lỗi khác hẳn, FE parse `.error.code` sẽ crash. Cũng là tiền đề để gắn Sentry |
| 7 | **Helmet + Sentry** | `app.use(helmet())` (`main.ts:62`); Sentry capture mọi 5xx trong filter | Không security header; lỗi 500 production chỉ nằm trong log, mất khi restart, không ai biết |
| 8 | **Cron dọn PENDING booking** | `maintenance.service.ts:38-52` TTL 30′ + cron 15′ | Khách bỏ dở checkout → booking treo PENDING vĩnh viễn. Không giữ ghế (đúng invariant) nên không nghiêm trọng, nhưng bảng phình và thống kê "đang chờ thanh toán" sai |

## Cố ý bỏ / chưa tới lượt — KHÔNG phải thụt lùi

- Rate limit cho `chat`/`enquiry`/`newsletter`: ba module đó v2 chưa xây (P3a W3–W4), đúng lộ trình.
- Media reconcile cron (Cloudinary): module media là P4.
- Full-text/trigram search: **Nexora cũng không có** (`tours.service.ts:576` chỉ `contains`), hai bên ngang nhau.
- Redis cache: Nexora cũng không có; "cache" của nó thực chất là ISR revalidation gắn với Next.js — nhớ port khi làm content page ở P3b.
- Swagger UI: cân nhắc trước P4 nếu cần test tay.

## v2 làm khác nhưng tương đương

Better Auth cookie session thay Supabase JWT guard · Zod qua oRPC thay
`ValidationPipe` global (chỉ phủ route contract — xem lỗ #6) · oRPC error
shape thay `TransformInterceptor` · `rawBody:true` của Fastify thay
`express.raw()` mount tay · Zod `parseEnv` thay Joi.

## v2 TỐT HƠN Nexora (ghi nhận)

1. `ReviewModerationEvent` — audit trail append-only; Nexora ghi đè
   `moderatedById/At` nên mất lịch sử quyết định trước.
2. Tombstone `User.deletedAt` + `Review.authorDeleted`; Nexora xoá cứng cascade.
3. `OutboxService.purgeSent()` — Nexora không dọn outbox, bảng phình vô hạn.
4. Outbox state machine tách sent/retried/failed, test được không cần DB.
5. `enableShutdownHooks()` — **Nexora KHÔNG gọi**, nên `onModuleDestroy`
   của nó không chạy khi nhận SIGTERM. Bug tiềm ẩn bên cũ.
6. Env validation chặn giá trị mặc định dev lọt vào production; Joi của
   Nexora chỉ check định dạng.
7. PayPal hardcode sandbox — không có đường lỡ tay bật live.

## Thứ tự đề xuất

Gộp #1–#4 thành một đợt "hardening" làm TRƯỚC P3a W2, vì #1 chặn cứng
P3b và #2 ảnh hưởng money-path đang chạy. #5 làm cùng W3/W4 (đúng lúc
viết enquiry/newsletter). #6→#7 làm trước deploy. #8 rẻ, gộp vào đâu cũng được.
