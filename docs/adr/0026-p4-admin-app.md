# ADR-0026 — P4 Admin: app riêng `apps/admin`, dùng chung session Better Auth qua subdomain

- **Ngày:** 2026-08-20
- **Trạng thái:** Chấp nhận (user duyệt 20/08; P4a merge `a59381b` cùng ngày)
- **Liên quan:** [khảo sát admin Nexora 20/08](../analysis/2026-08-20-admin-parity-nexora.md)
  (đầu vào chính), [ADR-0017 §4](0017-web-session-better-auth.md) (cookie
  cùng registrable domain), [ADR-0024](0024-deploy-targets.md) (subdomain
  `admin.` đã chừa), [ADR-0021](0021-media-write-surface.md) (nợ media
  garbage "để P4"), [ADR-0001](0001-tech-stack.md).

## Bối cảnh

P3b + deploy v1 đã khép; mảng lớn duy nhất còn thiếu so với Nexora là
back-office (bản cũ: 40 trang, 18 vùng, ~60 endpoint admin — xem khảo sát).
User chốt 20/08: app admin **riêng**, thứ tự thi công **setup khung trước,
phân tích từng vùng sau**.

## Quyết định

### 1. Hình hài: app riêng `apps/admin`, KHÔNG phải khu `/admin` trong web

- Next.js **16.3.0** + React **19.2.4** — đúng bản workspace đang ghim.
  KHÔNG đuổi "mới nhất tuyệt đối": override MỘT React cho cả monorepo là
  quyết định đã đo (27/07 — hai React trong store làm Vitest `dispatcher
  null` hàng loạt); nâng React là việc đồng bộ toàn workspace, không thuộc
  P4, và freeze 15/10 đang tới.
- Deploy: Vercel project riêng, root `apps/admin`, domain
  `admin.nexora-travel.agency` (đã chừa từ bước 1 deploy v1). Dev chạy cổng
  **3002** (web 3000 · API 3001).
- Vì sao app riêng thắng `/admin`-trong-web: tách bundle/deploy (đổi admin
  không rebuild site khách), tách bề mặt tấn công (site khách không mang
  code admin), giữ nguyên kiến trúc đã chứng minh ở Nexora, và cookie chung
  subdomain đã sẵn nên chi phí auth — lý do lớn nhất để gộp — không còn.

### 2. Auth: dùng CHUNG hệ Better Auth hiện có, không dựng gì mới

- Session đọc qua cookie `.nexora-travel.agency` (crossSubDomainCookies đã
  bật trên prod — ADR-0024); dev cùng `localhost` khác cổng nên cookie tự
  chung, không cần cấu hình thêm.
- Middleware admin app: không có session → redirect `/login?redirect=…`
  (trang login riêng của admin, gọi cùng `authClient` trỏ API); có session
  nhưng role ≠ ADMIN → chặn bằng màn "không đủ quyền" (không im lặng).
- Phía API giữ nguyên `AuthGuard` + `@Roles(UserRole.ADMIN)` đang chạy;
  endpoint admin mới đều đi cửa này. `TRUSTED_ORIGINS` (API, Render) phải
  thêm `https://admin.nexora-travel.agency` khi deploy.

### 3. Nền UI & kit

- Tái dùng `@tourism/tokens` + `@tourism/ui` (shadcn) + vocabulary motion
  của web — admin không mở hệ thẩm mỹ mới, chỉ mở **CRUD kit** (khối hạ tầng
  lớn nhất, học cấu trúc kit 19 component của bản cũ): table shell (TanStack
  Table qua pattern data-table shadcn) · facet filter · pagination server ·
  columns menu · row actions · media picker · form kit.
- Chart dashboard: recharts (qua shadcn charts) — cùng lib bản cũ đã dùng ổn.
- Test: Vitest + Testing Library, TDD trên logic thuần (luật #4), theo nếp
  per-spec IntersectionObserver stub của web (ADR-0014).

### 4. API: contract-first như mọi phase

Endpoint admin mới khai trong `@tourism/contract` nhóm `admin.*` (đã có sẵn
bookings/cancellations/reviews), triển khai theo vùng — KHÔNG viết REST rời
ngoài contract. Vùng nào đụng schema mới (ví dụ ghi catalog) thì migration
đi trong vòng spec của vùng đó.

### 5. Thứ tự thi công (chốt với user 20/08)

1. **P4a — scaffold**: dựng `apps/admin` (Next 16.3 + tokens/ui/biome/vitest/
   turbo) + **gate đăng nhập ngay từ trang trắng đầu tiên** + shell (sidebar
   18 vùng, nav-user) + deploy sớm lên `admin.` để đường ống sống từ đầu.
2. **P4b — CRUD kit** trên 3 vùng API ăn sẵn: bookings · cancellations ·
   review moderation (kit trưởng thành bằng vùng thật, không dựng chay).
3. **P4c — vận hành**: outbox (nhu cầu chứng minh 20/08) · payment events ·
   enquiries + notes · subscribers.
4. **P4d — dashboard** (admin-stats + chart).
5. **P4e — catalog CRUD** (nặng nhất: tours/departures/categories/
   destinations/posts + media picker).
6. **P4f — media library + garbage reconcile (trả nợ ADR-0021) + appearance
   + users**.
   Mỗi vùng một vòng spec nhỏ → demo → user duyệt → thi công (nếp P3b).

## Hệ quả

- Monorepo thêm một app Next (turbo/CI thêm pipeline tương ứng); CI build
  admin cần API sống giống web (ADR-0016 §3 áp dụng lại) — cân nhắc trong
  spec P4a.
- Preview deploy admin không đăng nhập được (origin động) — cùng hạn chế đã
  chấp nhận ở web (F3).
- Bản cũ có trang mà controller thiếu endpoint (posts KHÔNG có `@Post`
  create) — v2 sẽ làm ĐỦ ở vùng posts, ghi rõ trong spec P4e.
- SEC-1 auto-promote (ADMIN_EMAILS) giữ nguyên là đường lên admin duy nhất
  cho tới vùng users (P4f) — lúc đó mới quyết `PATCH role` thủ công có tồn
  tại song song không.

## Lựa chọn đã bỏ

- **Khu `/admin` trong apps/web**: rẻ lúc đầu, nhưng trộn bundle + deploy +
  bề mặt tấn công; lợi thế cookie chung của nó nay không còn là lợi thế
  riêng (subdomain đã chung cookie).
- **React/Next "mới nhất tuyệt đối"**: xem §1 — trái override một-React và
  sát freeze.
- **Template admin dựng sẵn (shadcn admin kit, refine.dev…)**: kéo hệ quản
  lý state/data riêng vào monorepo đang thuần oRPC + fetch; kit cũ của
  Nexora đã chứng minh đủ và ta có nó làm tham chiếu chi tiết.
