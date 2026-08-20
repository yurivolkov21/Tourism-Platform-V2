# Spec — P4a: scaffold `apps/admin` + gate đăng nhập + shell

- **Ngày:** 2026-08-20 · **ADR đi trước:** [ADR-0026](../adr/0026-p4-admin-app.md)
- **Phạm vi:** đúng bước 1 của thứ tự thi công §5 ADR-0026. CHƯA có vùng
  nghiệp vụ nào — sản phẩm của spec này là một app admin ĐĂNG NHẬP ĐƯỢC,
  có shell điều hướng, deploy sống trên `admin.nexora-travel.agency`.

## 0. Nghiệm thu

1. `pnpm dev` trong `apps/admin` chạy cổng 3002; `pnpm gate:int` xanh
   (app mới có test + typecheck + lint vào turbo pipeline).
2. Chưa đăng nhập mà mở bất kỳ đường dẫn nào → về `/login?redirect=<path>`;
   đăng nhập bằng tài khoản CUSTOMER → màn "Not authorized" (không im lặng,
   không lộ shell); tài khoản ADMIN → vào shell.
3. Shell: sidebar đủ 18 vùng (nhóm như khảo sát — vùng chưa làm hiện trạng
   thái "coming soon", KHÔNG phải link chết), nav-user (avatar/tên/sign out).
4. Deploy: project Vercel mới root `apps/admin`, domain
   `admin.nexora-travel.agency`, đăng nhập THẬT bằng cookie chung với
   `www.` (đăng nhập ở www rồi mở admin — session nhận luôn, và ngược lại);
   `TRUSTED_ORIGINS` trên Render đã thêm origin admin.

## 1. Scaffold (⌨)

- `apps/admin`: Next 16.3.0 · React 19.2.4 (workspace override) · Tailwind 4
  \+ `@tourism/tokens` (tokens-only, luật #6) · `@tourism/ui` · Biome/tsconfig
  kế thừa base (`noUncheckedIndexedAccess`) · Vitest + Testing Library theo
  nếp web (ADR-0014) · cổng dev 3002.
- Env theo chuẩn tên file 19/07: `.env.local` (dev) · `.env.production`
  (gitignored, import lên Vercel) · `.env.example` (commit). Biến:
  `API_URL` + `NEXT_PUBLIC_API_URL` · `NEXT_PUBLIC_SITE_URL`
  (= URL admin) — KHÔNG cần `REVALIDATE_SECRET` (admin không ISR nội dung
  khách; mọi màn admin là dynamic/no-store).
- Turbo: thêm pipeline `@tourism/admin` (build cần API sống? — KHÔNG cho
  P4a: mọi trang admin là dynamic, không SSG gọi API lúc build → guard kiểu
  `guard-build.mjs` của web chưa cần; xem lại khi có trang đầu tiên fetch
  lúc build).

## 2. Gate đăng nhập (⌨) — đường CHUẨN ADR-0026 §2

- `middleware.ts`: mọi path ngoài `/login` + asset → đòi session. Kiểm bằng
  gọi `GET /api/auth/get-session` (Better Auth) với cookie chuyển tiếp —
  KHÔNG tự giải mã cookie (không nhân đôi logic verify của Better Auth).
  Không session → redirect `/login?redirect=`; session mà `role !== 'ADMIN'`
  → rewrite màn `/not-authorized` (403, có nút sign out + về www).
- `/login`: form email/password gọi `authClient.signIn.email` (client trỏ
  `NEXT_PUBLIC_API_URL`), thành công → theo `redirect` param (chỉ nhận path
  nội bộ — cùng hàm `safeRedirect` nếp web). KHÔNG có register/forgot ở
  admin — link sang `www.` cho hai việc đó.
- Test logic thuần: hàm quyết định của middleware (session × role × path →
  allow/redirect/deny) tách pure function, TDD ≥80% (luật #4).

## 3. Shell (⌨ + 🖱 user duyệt visual)

- `AppShell`: sidebar trái (collapsible, nhóm vùng: Vận hành · Nội dung ·
  Hệ thống — 18 mục theo khảo sát, mục chưa có trang gắn badge "soon" và
  disabled) + topbar (breadcrumb, nav-user).
- Thẩm mỹ: tokens + shadcn hiện có, motion tái dùng vocabulary web ở mức
  tiết chế (admin là công cụ — không rebuild hệ visual). Có MỘT vòng demo
  tĩnh cho user duyệt bố cục shell trước khi khoá (nếp design-by-demo),
  dùng dữ liệu giả cho khung — KHÔNG chờ vùng thật.
- Trang `/` (dashboard placeholder): card "chưa có số liệu — P4d" + liên kết
  nhanh 3 vùng sẽ sống đầu tiên ở P4b.

## 4. Deploy sớm (🖱 tay theo hướng dẫn, như deploy v1)

1. Vercel: New Project → repo → root `apps/admin` → import `.env.production`.
2. Domains: thêm `admin.nexora-travel.agency` (DNS ở Vercel, một record).
3. Render → Environment: `TRUSTED_ORIGINS` thêm origin admin (redeploy).
4. Smoke §0.4. Ghi kết quả vào CHANGELOG khi khép P4a.

## 5. Ngoài phạm vi P4a

Mọi vùng nghiệp vụ (P4b–P4f theo ADR-0026 §5), CRUD kit (mở ở P4b cùng vùng
thật đầu tiên), chart, admin-stats API. Không đụng schema DB.
