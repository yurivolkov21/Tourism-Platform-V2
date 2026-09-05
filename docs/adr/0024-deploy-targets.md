# ADR-0024 — Nơi deploy v1: web Vercel · API + worker Render · DB Supabase · domain `nexora-travel.agency`

- **Ngày:** 2026-08-19
- **Trạng thái:** Đã triển khai 20/08/2026 — smoke §0 của spec đạt cả 5 mục
  (web/API sống trên domain, OTP + xác minh email + cookie `.nexora-travel.agency`,
  booking Stripe sandbox PAID qua webhook, contact + newsletter gửi mail thật)
- **Liên quan:** [ADR-0001](0001-tech-stack.md) (đã dự kiến Vercel Hobby + Render/Railway),
  [ADR-0010](0010-infra-hardening.md), [ADR-0017 §4](0017-web-session-better-auth.md)
  (cookie cùng registrable domain là ràng buộc deploy), [ADR-0016](0016-web-data-layer.md)
  (web build cần API sống).

## Bối cảnh

P3b web ~95%, user muốn có bản chạy thật (domain, email, thanh toán sandbox)
TRƯỚC khi mở P4 Admin. CLAUDE.md chốt **freeze 15/10: không đổi nơi deploy** —
nên phải quyết nơi deploy bằng ADR ngay bây giờ, không để trôi tới lúc freeze.

Bản tiền nhiệm Nexora từng chạy trên domain `https://www.nexora-travel.agency/`
(đang pause). Domain chỉ là DNS, không gắn code; v2 không hardcode domain nào —
mọi URL đi qua env (`NEXT_PUBLIC_SITE_URL`, `FRONTEND_URL`, `BETTER_AUTH_URL`,
`TRUSTED_ORIGINS`, `EMAIL_FROM`).

## Quyết định

| Mảnh | Nơi | Ghi chú |
| --- | --- | --- |
| Web (Next 16) | **Vercel** (Hobby), project mới cho v2 | root `apps/web`, build qua turbo; domain `www.nexora-travel.agency` + apex redirect về `www` |
| API (NestJS) | **Render** Web Service, Docker từ `apps/api/Dockerfile` | `api.nexora-travel.agency`; health `GET /health` |
| Worker (outbox email · pending sweep · pg-boss cron) | **Render** Background Worker, **cùng image**, CMD `node dist/worker.js` | Tách tiến trình như local (`worker.ts`); free tier không có Background Worker → cần plan trả phí nhỏ HOẶC (quyết ở bước triển khai) chạy worker trong cùng tiến trình API bằng một cờ env — xem spec §3 |
| DB | **Supabase** Postgres (project riêng cho prod), **Session pooler 5432** | Cấm 6543 (transaction pooler — CLAUDE.md). `prisma migrate deploy` tường minh với `DATABASE_URL` prod |
| Email | **Resend**, domain đã xác minh (SPF/DKIM trên `nexora-travel.agency`) | `EMAIL_FROM=Nexora <noreply@nexora-travel.agency>` |
| Media | Cloudinary hiện có (cùng cloud, cùng folder `tourism/…`) | publicId đã sống, không đổi |
| Thanh toán | Stripe + PayPal **sandbox** (capstone không doanh thu) | webhook trỏ `https://api.nexora-travel.agency/…` |
| Domain / DNS | `nexora-travel.agency` tái dùng từ Nexora cũ | Gỡ khỏi project Vercel cũ trước; DNS ở registrar hiện tại |

## Cookie session — đường CHUẨN của ADR-0017 §4

Web và API cùng registrable domain (`www.` + `api.`) → bật
`advanced.crossSubDomainCookies` (`domain: .nexora-travel.agency`), giữ
`sameSite: lax` + `secure`. **Không** dùng fallback `sameSite: 'none'` — không
cần vì đã có domain chung. Đây là lý do chọn tái dùng domain thay vì cặp
`*.vercel.app` + `*.onrender.com`.

## Hệ quả

- Thêm một cờ env phía API cho cookie domain (chỉ bật ở prod); local/dev giữ
  nguyên (same-site).
- Thứ tự deploy bắt buộc: **DB → API (+migrate) → worker → DNS api → web build**
  — web build SSG gọi API thật (ADR-0016 §3), API chưa sống thì build đỏ.
- Vercel preview URL (theo branch) không nằm trong `TRUSTED_ORIGINS` → preview
  không đăng nhập được; chấp nhận (preview chỉ để nhìn UI).
- Render free tier ngủ sau 15 phút → lần build web đầu có thể timeout; mitigations
  ở spec.
- Sau freeze 15/10 mọi thứ trong bảng trên là cố định.

## Lựa chọn đã bỏ

- **Railway cho API** (ADR-0001 nêu ngang Render): Render có Docker + health
  check + cron/worker rõ ràng, tài liệu quen với user; không có lý do kỹ thuật
  phân thắng bại — chọn một để đóng.
- **Web + API cùng một host (Render cả hai)**: mất ISR/Edge của Vercel mà web
  đang dựa (Cache Components/ISR 300s), build Next trên Render chậm.
- **`sameSite: 'none'`** để chạy hai domain rời: mất lớp CSRF của `lax`, chỉ là
  fallback khi không có domain.

## AMEND 1 — 05/09/2026: build web tự đánh thức API trước khi prerender

**Hệ quả** ở trên dự báo "Render free tier ngủ sau 15 phút → lần build web
đầu có thể timeout" và trỏ mitigation sang spec (cron ping hoặc plan trả
phí). Nó xảy ra thật hai lần — 02/09 (`233c559`) và 05/09 (`03eaef9`) — cùng
một dạng: commit chỉ có docs, push sau hơn 15 phút không ai chạm site, Vercel
build web chết `TimeoutError` ở "Collecting page data for /blog/[slug]" đúng
10s sau khi bắt đầu (timeout của client oRPC, ADR-0016), trong khi CI xanh vì
CI có API riêng trên localhost. Site không sập (Vercel giữ deploy READY cũ)
nhưng commit đó không bao giờ lên web nếu không ai bấm Redeploy.

**Chốt:** `apps/web/scripts/warm-api.mjs` chạy trước `next build` trong script
`build` của web: poll `${API_URL|NEXT_PUBLIC_API_URL}/api/health` tối đa 90s
(mỗi 3s, timeout mỗi request 5s), rồi **luôn thoát 0** — cùng nguyên tắc
"thất bại thì mở" của `guard-build.mjs`: API chết thật thì `next build` tự đỏ
với lỗi thật, không có nguồn sự thật thứ hai. Luật ADR-0016 §3 "build với
API sống" giữ nguyên; script chỉ xoá đúng ca "API đang ngủ". Chọn cách này
thay cron ping/plan trả phí vì nó nằm trong repo, không tốn tiền, và cũng che
luôn CI/local khi API vừa mới bật. Bỏ qua: `SKIP_API_WARMUP=1`.

Ghi nhận, không sửa ở đây: Vercel cảnh báo `API_URL`/`REVALIDATE_SECRET` không
khai trong `turbo.json` nên bị strict env lọc lúc build — build vẫn đúng vì
client rơi về `NEXT_PUBLIC_API_URL` (framework inference cho qua), còn
`REVALIDATE_SECRET` chỉ dùng lúc runtime. Khai vào `turbo.json` là việc riêng.

