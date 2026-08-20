# Spec — Deploy v1: domain `nexora-travel.agency` · API+worker Render · web Vercel · email Resend

- **Ngày:** 2026-08-19 · **ADR đi trước:** [ADR-0024](../adr/0024-deploy-targets.md)
- **Cách chạy:** từng bước, **dừng chờ user xác nhận** sau mỗi bước (user yêu cầu).
  Bước có "⌨ code" là việc trong repo (branch + gate + merge); bước "🖱 tay" là
  việc user làm trên dashboard/registrar, mình hướng dẫn và kiểm bằng lệnh.

## 0. Mục tiêu nghiệm thu (smoke cuối)

1. `https://www.nexora-travel.agency/` 200, trang tour SSG có ảnh Cloudinary.
2. Đăng ký → nhận **OTP qua email thật** (Resend, from `@nexora-travel.agency`) →
   verify → đăng nhập → `/account` thấy session (cookie `.nexora-travel.agency`).
3. Đặt tour → Stripe Checkout sandbox → webhook về API → booking PAID → receipt.
4. Form contact / newsletter gửi được (throttle theo IP vẫn chạy sau proxy Render).
5. `GET https://api.nexora-travel.agency/health` = 200, DB ok; worker drain outbox.

## 1. Kiểm kê & tài khoản (🖱 tay) — BƯỚC 1

Cần sẵn: tài khoản Vercel (có project Nexora cũ), Render, Supabase (tạo project
**mới** cho prod hoặc tái dùng project dev — quyết ở bước 2), Resend, Cloudinary
(đang dùng), Stripe + PayPal sandbox (đã có key dev), registrar của domain.
Việc duy nhất của bước 1: **gỡ domain khỏi project Vercel cũ** (Settings →
Domains → Remove) — Vercel không cho một domain gắn hai project cùng account.

> **Cập nhật 20/08 (bước 1–2 đã xong):** (a) domain do **Vercel quản DNS**
> (nameservers Vercel, mua qua Vercel, hạn 07/2027) — mọi record (api CNAME,
> SPF/DKIM Resend) thêm ở trang Domains của Vercel, KHÔNG phải registrar ngoài;
> đã gỡ domain khỏi 2 project Nexora cũ (web + admin; `admin.` giữ chờ P4).
> (b) DB prod = **dùng chung Supabase `tourism-platform-v2`** (session pooler
> 5432, 29 tour · 52 khe · 12 migration — kiểm 20/08). ⚠ Dev/prod chung DB:
> seed/reset từ máy dev đụng thẳng dữ liệu chạy thật. (c) Render **free** +
> `WORKER_INLINE=true` — chấp nhận ngủ 15′/thức ~50s.

## 2. DB prod (🖱 tay + ⌨) — BƯỚC 2 ✅ (kiểm 20/08, không cần seed thêm)

Quyết: project Supabase **riêng** cho prod (khuyến nghị — dev seed/reset không
đụng prod) hay dùng chung project dev (nhanh, rủi ro). Sau quyết:
`DATABASE_URL` = **Session pooler, cổng 5432**, user `postgres.<ref>`;
từ `apps/api`: `DATABASE_URL=… pnpm prisma migrate deploy` rồi `pnpm db:seed`
(catalog + 52 khe site + 2 user overlay). Kiểm: đếm tour = 29, khe = 52.
Media: `media:upload` đã upsert theo publicId → chạy lại với `DATABASE_URL` prod
để ghi `media_assets` (file trên CDN dùng chung, không upload lại bản mới).

## 3. Code chuẩn bị prod (⌨) — BƯỚC 3 (một nhánh, gate đầy đủ, user duyệt merge)

> Triển khai 20/08 (nhánh `feat/deploy-v1-prep`): thêm `.env.production` MẪU ở
> hai app (gitignored, user điền secret rồi import — Render "Add from .env",
> Vercel "Import .env"); `render.yaml` một service duy nhất (worker inline).
> Bẫy đã đo khi làm: (1) bắt SIGTERM tay cho worker inline thì ĐUA với shutdown
> hook của Nest và thua — dừng phải đi qua hook `onClose` của Fastify để được
> await trong `app.close()`; (2) `addHook` sau `listen` ném
> FST_ERR_INSTANCE_ALREADY_LISTENING — hook đăng ký TRƯỚC listen với ref
> `stopWorker` gán SAU listen (worker khởi động sau listen để health check
> thấy cổng ngay).

- `auth.config.ts`: `advanced.crossSubDomainCookies` bật theo env
  `COOKIE_DOMAIN` (vd `.nexora-travel.agency`), chỉ khi có giá trị; dev không set.
- `env.ts`: thêm `COOKIE_DOMAIN` optional; `WORKER_INLINE` (boolean, default
  false) — nếu Render không có Background Worker (free), API tự khởi động
  worker trong cùng tiến trình. Int test cho cờ này.
- `render.yaml` (Blueprint): web service API (Docker, health `/health`, env
  khai báo không giá trị) + background worker cùng image (CMD worker). Blueprint
  là bản ghi hạ tầng trong repo — khớp luật "ADR/spec đi trước, docs = code".
- `apps/web`: `vercel.json` tối thiểu nếu cần (root dir đặt ở dashboard);
  `.env.example` web liệt kê `API_URL`, `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_SITE_URL`, `REVALIDATE_SECRET`.
- `apps/api/.env.example`: thêm `COOKIE_DOMAIN`, `WORKER_INLINE`, ghi chú prod.
- Docs: checklist env ở cuối spec này; README bản đồ.

## 4. API lên Render (🖱 tay) — BƯỚC 4

Render → New → Blueprint (từ repo) hoặc Web Service Docker, root
`apps/api/Dockerfile` (build context = repo root). Env (xem checklist §8). Deploy
→ chờ `GET /health` 200 → log API `listening on :3001 (production)`. Nếu free:
`WORKER_INLINE=true`; nếu có worker riêng: deploy Background Worker cùng image.

## 5. DNS (🖱 tay) — BƯỚC 5

Tại registrar: `api` CNAME → host Render (`<svc>.onrender.com`); Render thêm
custom domain `api.nexora-travel.agency` → cấp TLS. Kiểm:
`curl -sI https://api.nexora-travel.agency/health`.
(Web: `www` CNAME → `cname.vercel-dns.com`, apex A → Vercel IP hoặc ALIAS — làm ở
bước 6 sau khi project Vercel sẵn sàng.)

## 6. Web lên Vercel (🖱 tay) — BƯỚC 6

New project từ repo, **Root Directory `apps/web`**, framework Next, install
`pnpm install`, build mặc định (turbo nhận). Env: `API_URL` + `NEXT_PUBLIC_API_URL`
= `https://api.nexora-travel.agency`, `NEXT_PUBLIC_SITE_URL`, `REVALIDATE_SECRET`
(cùng giá trị API). Deploy → gắn domain `www` + apex → kiểm 200 và ảnh.
Lưu ý `guard-build.mjs` chỉ chặn khi có server cục bộ — không ảnh hưởng Vercel.

## 7. Email + webhook + smoke (🖱 tay) — BƯỚC 7 ✅ (smoke §0 đạt 5/5, 20/08)

> **Kết quả 20/08:** bước 4–6 xong trong ngày 19–20/08 (API
> `api.nexora-travel.agency` health 200; web `www.nexora-travel.agency` gắn
> domain, Vercel tự deploy theo push main). Bẫy ĐO ĐƯỢC ở bước 7: API key
> Resend tạo TRƯỚC khi verify domain bị Resend từ chối
> `HTTP 400 "The associated domain with your API key is not verified"` — mọi
> mail (OTP, welcome) kẹt PENDING→FAILED trong outbox dù worker inline drain
> đúng nhịp; fix = tạo key MỚI sau khi domain verified, thay trên Render.
> Hàng FAILED (hết 5 attempts) không tự sống lại — OTP thì bấm resend, welcome
> thì subscribe lại. Smoke chốt bằng dữ liệu prod: `EMAIL_OTP SENT` · user
> `email_verified:true` + promote `ADMIN` (SEC-1 chạy) · booking `PAID` +
> `payment_events` ghi `payment.completed` (webhook Stripe sống) ·
> `BOOKING_CONFIRMATION`/`ENQUIRY_RECEIVED`/`ENQUIRY_ADMIN_ALERT`/`NEWSLETTER_WELCOME`
> đều `SENT`.

Resend: Add domain `nexora-travel.agency` → thêm record SPF/DKIM/DMARC → verified →
`EMAIL_FROM` trên Render. Stripe dashboard (test mode): webhook endpoint
`https://api.nexora-travel.agency/<route>` (lấy đường dẫn từ
`payments.controller`), copy `STRIPE_WEBHOOK_SECRET` mới; PayPal sandbox tương
tự (`PAYPAL_WEBHOOK_ID`). Chạy smoke §0, ghi kết quả vào CHANGELOG.

## 8. Checklist env prod

**API (Render):** `NODE_ENV=production` · `PORT=3001` · `DATABASE_URL` (pooler 5432)
· `BETTER_AUTH_SECRET` (mới, ≥32 ký tự) · `BETTER_AUTH_URL=https://api.nexora-travel.agency`
· `FRONTEND_URL=https://www.nexora-travel.agency` · `TRUSTED_ORIGINS=https://www.nexora-travel.agency,https://nexora-travel.agency`
· `COOKIE_DOMAIN=.nexora-travel.agency` · `ADMIN_EMAILS` · `REVALIDATE_SECRET`
· `NEWSLETTER_UNSUBSCRIBE_SECRET` · `RESEND_API_KEY` · `EMAIL_FROM` ·
`CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` · `STRIPE_SECRET_KEY` +
`STRIPE_WEBHOOK_SECRET` (và/hoặc `PAYPAL_CLIENT_ID/SECRET/WEBHOOK_ID`) ·
`WORKER_INLINE` (nếu không có worker riêng).
**Web (Vercel):** `API_URL` · `NEXT_PUBLIC_API_URL` · `NEXT_PUBLIC_SITE_URL` ·
`REVALIDATE_SECRET`.

## 9. Ngoài phạm vi

Admin (P4), mobile, AI, monitoring trả phí, CDN riêng. Preview deploy có session
(cần origin động) — ghi sổ nợ.

## 10. Sổ nợ sau deploy (ghi 20/08, làm khi tới lượt)

- **Resend webhooks**: endpoint nhận `email.delivered/bounced/complained` để
  outbox biết số phận mail sau khi `SENT` (giờ SENT = "Resend nhận", không phải
  "tới inbox"). Kèm cân nhắc **Audience sync** (subscribers → Resend Audience).
- ~~**Template email in-code**~~ ✅ **trả 20/08** ([ADR-0025](../adr/0025-transactional-email-react-email.md),
  merge `6a3725b`) — react-email v6, hệ Barebone port từ Nexora cũ. Nợ con còn
  lại: payload outbox chưa mang ảnh hero tour + rating sao nên mail booking/
  review chưa có hai khối đó như bản cũ (cần mở rộng producer nếu muốn).
- **Preview deploy Vercel không đăng nhập được** (origin động ngoài
  `TRUSTED_ORIGINS`) — chấp nhận, preview chỉ xem UI.
- **Dev/prod chung DB Supabase**: seed/reset từ máy dev đụng dữ liệu chạy thật;
  nếu tách sau này thì theo §2 (project riêng + migrate deploy + seed + media
  upsert).
- **Render free ngủ 15′**: lần đầu mở site sau khoảng lặng, trang SSR/ISR gọi
  API có thể chờ ~50s; nếu thành vấn đề trước bảo vệ → cron ping hoặc plan trả
  phí nhỏ.
