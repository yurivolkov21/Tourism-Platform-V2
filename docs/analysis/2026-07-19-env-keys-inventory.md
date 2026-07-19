# Kiểm kê biến môi trường — v2 đối chiếu Nexora (19/07/2026)

Đối chiếu `apps/api/src/config/env.ts` của v2 với 4 file `.env.example` của
Nexora, sau khi user phát hiện Cloudinary bị bỏ sót.

## Đã lấy và verify (19/07)

| Key | Cách verify | Kết quả |
| --- | --- | --- |
| `DATABASE_URL` | migrate deploy + seed + pg-boss lifecycle | Supabase Session pooler, 33 bảng |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | 44 ký tự, khác giá trị dev |
| `RESEND_API_KEY` | POST `/emails` thiếu field → 422 | Auth qua, chưa verify domain |
| `STRIPE_SECRET_KEY` | GET `/v1/balance` | 200, `livemode: false` |
| `PAYPAL_CLIENT_ID/SECRET` | OAuth sandbox 200 · OAuth live 401 | Sandbox thuần |

Hoãn tới lúc deploy (cần URL public): `STRIPE_WEBHOOK_SECRET`,
`PAYPAL_WEBHOOK_ID`. Guard `superRefine` yêu cầu **bộ ĐẦY ĐỦ** nên
production chưa boot được cho tới khi có một trong hai — đúng thiết kế:
gateway thiếu webhook secret sẽ nhận tiền mà không biết đã nhận, booking
kẹt PENDING vĩnh viễn.

## Nexora có, v2 CHƯA có

| Key | Dùng cho | Cần ở phase |
| --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME`/`_API_KEY`/`_API_SECRET`/`_UPLOAD_FOLDER` | Upload media | **P4** — bảng `MediaAsset`/`MediaGarbage`/`SiteMediaSlot` đã có sẵn, chỉ thiếu tầng upload |
| `THROTTLE_TTL_SECONDS`/`THROTTLE_LIMIT` | Rate limiting | **Xem mục dưới** |
| `SENTRY_DSN` | Error tracking (ADR-0001 có ghi) | Trước deploy |
| `ANTHROPIC_API_KEY`/`CHAT_MODEL` | AI concierge | P6 |
| `RESEND_REPLY_TO_EMAIL` | Reply-to cho email | Tuỳ chọn |
| `REVALIDATE_SECRET` | ISR revalidation | P3b — v2 dùng Cache Components nên có thể không cần |

## Nexora có, v2 KHÔNG cần nữa

- `SUPABASE_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY`/`JWT_SECRET`/`JWKS_URL` +
  các bản `NEXT_PUBLIC_`/`EXPO_PUBLIC_` — Better Auth thay Supabase Auth;
  Supabase giờ chỉ là Postgres thuần.
- `DIRECT_URL` — Nexora cần vì transaction pooler; v2 cấm pooler nên một
  `DATABASE_URL` là đủ.
- `PAYPAL_MODE` — v2 hardcode `api-m.sandbox.paypal.com`
  (`paypal.gateway.ts:16`), không có đường ra live. **Nâng cấp so với
  Nexora**: đồ án không thể lỡ tay bật live.

## Đã có dưới tên khác

`CORS_ORIGINS`→`TRUSTED_ORIGINS` · `RESEND_FROM_EMAIL`→`EMAIL_FROM` ·
`STRIPE_DEFAULT_CURRENCY`→ default `USD` trong schema · `API_PREFIX`→ path
khai trong contract oRPC.

## ⚠️ Thụt lùi so với Nexora: KHÔNG có rate limiting

Nexora có `THROTTLE_TTL_SECONDS`/`THROTTLE_LIMIT` (ThrottlerModule). v2
grep ra **không có gì** — không ThrottlerModule, không rate-limit nào.

Hệ quả khi deploy: mọi endpoint công khai gọi được không giới hạn —
`POST /api/enquiries`, đăng ký newsletter, tạo review, và `POST
/api/auth/*` (brute-force đăng nhập). Một script đơn giản đủ làm ngập
bảng `enquiries`.

Đây là **thụt lùi** so với bản cũ, mà v2 lẽ ra là bản nâng cấp — và với
tiêu chí "vận hành như trang thương mại thật" thì đáng kể.

**Đề xuất:** gộp vào P3a W2. W3 (enquiry) và W4 (newsletter) chính là hai
endpoint dễ spam nhất; làm rate limit lúc viết chúng là đúng chỗ nhất.
Không cần key gì — chỉ là config số.

## Rủi ro ngày bảo vệ (chưa xử lý)

1. **Supabase free pause sau 7 ngày không hoạt động.** Bảo vệ sau
   10/11/2026 — nếu tuần trước đó không ai đụng, hôm ra hội đồng trang web
   chết. Cần cơ chế giữ sống hoặc quy trình đánh thức.
2. **Resend chưa verify domain → chỉ gửi được tới email chủ tài khoản.**
   Hội đồng đặt tour bằng email của họ sẽ KHÔNG nhận được mail xác nhận.
   Muốn gửi tới địa chỉ bất kỳ phải mua domain + thêm 5 DNS record
   (MX, SPF TXT, 3× DKIM CNAME trên subdomain `send.<domain>`).
