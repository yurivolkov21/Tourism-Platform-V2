# Báo cáo tiến độ 20/08 — mốc SITE SỐNG THẬT, khép P3b + deploy v1

Chụp tại `9b5895c` (main). Số liệu đo lại trong ngày, KHÔNG lấy từ trí nhớ:
route đếm bằng `find page.tsx` (31), endpoint đếm method trong `contract.ts`
(36), test lấy từ log `gate:int` xanh cùng ngày, độ phủ ảnh query thẳng DB
prod. Bản trước: [báo cáo 04/08](2026-08-04-progress-report.md) (mốc trước
bước 8–10 — đừng sửa, ảnh chụp).

## 1. Vị trí trên roadmap

P0 ✅ → P1 ✅ → P2 ✅ → P3a ✅ → **P3b ✅ (khép 20/08)** → **deploy v1 ✅
(20/08)** → P4 admin (KẾ TIẾP) → P5 mobile → P6 AI → P7 polish → freeze
15/10 → bảo vệ ~10/11.

Điều thay đổi bản chất so với 04/08: **site không còn là đồ dev** — push main
là Vercel/Render tự deploy; mọi chỉnh sửa từ nay là chỉnh đồ ĐANG CHẠY tại
`www.nexora-travel.agency`.

## 2. Đã hoàn thành từ 04/08 → 20/08

- **P3b khép**: bước 8–10 (session + 6 route account), redesign account
  "Hộ chiếu" + checkout boarding-pass, cụm B wishlist, cụm C booking, bề mặt
  GHI media (avatar + ảnh review), trùng tu Tour Details 5 tab, Home/blog/
  3 trang vùng đủ ảnh, đợt rà 31 route 19/08 (máy + tay) và loạt fix theo sau
  (phân trang + Lenis, cột ghế, giá bám đợt, footer route thật, form Home
  nối API, checklist mật khẩu từ thật).
- **Deploy v1 (ADR-0024)**: web Vercel · API Docker Render free + worker
  inline (`WORKER_INLINE`) · DB Supabase (session pooler 5432, dev/prod
  chung) · domain `nexora-travel.agency` (DNS ở Vercel) · Resend domain
  verified · Stripe webhook Workbench. **Smoke 5/5 bằng dữ liệu prod**: OTP
  SENT + user verified + promote ADMIN (SEC-1) · booking PAID qua
  `payment_events.payment.completed` · enquiry 2 mail · newsletter welcome ·
  health/cookie/CORS. Bẫy đã ghi spec §7: Resend key tạo TRƯỚC verify domain
  → 400 toàn bộ mail.
- **Email giao dịch đẹp (ADR-0025)**: 13 loại mail render react-email v6, hệ
  Barebone port từ Nexora cũ (user duyệt 13/07 + vòng 2 20/08), màu token,
  2 part html+text, đã chạy thật trên prod (user xác nhận trong Gmail).
- **Độ phủ ảnh — đo DB 20/08**: 29/29 tour hero+gallery (276 ảnh) · 18/18
  địa danh (137 ảnh gallery) · 9/9 bài viết · 48/52 khe site (4 khe trống là
  seed-only, chưa bề mặt nào đọc). Nợ ảnh **hết chặn**; gallery lệch 1–17
  ảnh/nơi là việc nội dung tùy hứng.

## 3. Số liệu chốt

31 route web · 36 endpoint contract · test **1.947** (1408 web · 238 api ·
180 api-int · 87 contract · 22 ui · 10 tokens · 2 i18n) · 25 ADR · CI xanh.

## 4. Còn lại (theo thứ tự roadmap)

1. **P4 Admin** — mảng lớn duy nhất còn thiếu so với Nexora (38 trang
   back-office); subdomain `admin.nexora-travel.agency` đã chừa. Việc đầu:
   đối chiếu Nexora (luật #10 — cả endpoint LẪN hạ tầng xuyên suốt) → ADR +
   spec phạm vi → user duyệt.
2. P5 mobile · P6 AI concierge · P7 polish — sau P4, trước freeze 15/10.
3. Sổ nợ không-chặn: [backlog sống](2026-08-06-backlog-no-ky-thuat.md)
   (A5/A15/A16 · B2/B3 · C1–C4 · D1 input-otp trước freeze · E1–E3/E5–E7 ·
   **mục F mới**: Resend webhooks, payload mail thiếu hero/rating, preview
   origin, dev/prod chung DB, Render ngủ 15′).

## 5. Rủi ro đáng nhìn trước bảo vệ

- **Dev/prod chung DB** (F4): seed/reset từ máy dev đụng thẳng dữ liệu sống —
  cân nhắc tách project Supabase trước khi demo hội đồng.
- **Render free ngủ 15′** (F5): mở demo lần đầu có thể chờ ~50s — ping trước
  giờ bảo vệ hoặc nâng plan nhỏ trong tuần bảo vệ.
- Freeze 15/10: còn ~8 tuần cho P4+P5+P6+P7 — P4 nên mở ngay.
