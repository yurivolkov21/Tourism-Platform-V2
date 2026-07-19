# ADR-0001 — Tech stack cho bản rebuild (tourism-v2)

- **Trạng thái:** Accepted (2026-07-18)
- **Bối cảnh đầy đủ + nguồn kiểm chứng:** bản đề xuất tổng
  (artifact nội bộ, 18/07/2026) — tóm tắt quyết định ghi tại đây làm nguồn sự thật trong repo.

## Bối cảnh

Nexora (Nx + NestJS 11 + Prisma 7 + Supabase Auth + Next 16 + Expo 54) hoàn
thiện nhưng tech stack khởi tạo chưa tối ưu: build/test chậm trên toolchain
JS-based, chuỗi OpenAPI codegen thủ công, và **transaction pooler**
(`connection_limit=1`) bẻ cong thiết kế của auth/payments/jobs. Capstone bảo vệ
~11/2026 — ưu tiên: DX/tốc độ, ổn định, chi phí $0, tái sử dụng tối đa.

## Quyết định

| Lớp | Chọn | Thay cho (Nexora) |
| --- | --- | --- |
| Monorepo | pnpm + **Turborepo** | Nx 22 |
| Compiler | **TypeScript 7 (tsgo)** | tsc 5.9 |
| Lint/format | **Biome** (+ oxlint type-aware CI, dependency-cruiser boundaries) | ESLint 8 + Prettier |
| Test | **Vitest** (mobile giữ jest-expo) | Jest 30 |
| Backend | **NestJS 11→12** + Fastify, Node 24 | NestJS 11 + Express |
| API contract | **oRPC** (`@orpc/nest`, incremental) + Zod 4 | REST + OpenAPI codegen thủ công |
| ORM | **Prisma 7** (giữ — port schema 27 model + CTE money-path verbatim) | Prisma 7 |
| DB | Postgres **direct/session pool** (Supabase free làm PG thuần) — cấm transaction pooler | Supavisor transaction mode |
| Auth | **Better Auth** (+ Prisma adapter, Expo plugin) | Supabase Auth + user mirror |
| Queue | **pg-boss v12** + outbox, worker process riêng | pg-boss v10 chung process |
| Web | Next.js 16 **Cache Components** + Turbopack + React Compiler, Vercel Hobby | Next 16 ISR + webpack dev |
| Admin | **Vite + TanStack Router/Query SPA**, host tĩnh | Next.js 16 |
| Mobile | **Expo SDK 56** (New Arch, dev builds) + Stripe PaymentSheet | Expo 54 + hosted checkout |
| Payments | Stripe + PayPal sau **interface `PaymentGateway`** (test mode) | enum + branching |
| Media/Email/AI/Obs | Cloudinary · Resend · AI SDK 6 + claude-haiku-4-5 · Sentry | (giữ, nâng bản) |

## Lộ trình (sửa 19/07 — vertical slice)

Lộ trình ban đầu ghi "P3 = web, P4 = admin" nhưng **không phân bổ ~64 endpoint API
còn lại cho phase nào** — nhãn "web" che giấu một khối lượng API lớn (chi tiết:
[API parity map](../analysis/2026-07-19-api-parity-upgrade-map.md)). Sửa thành
**mỗi phase một lát cắt dọc, API + UI đi chung**:

| Phase | Nội dung |
| --- | --- |
| P0–P2 | ✅ Khung xương · API lõi · Money-path |
| **P3** | API khách hàng (reviews, wishlist, enquiry, newsletter, blog, site-media) **+ Web Next.js chức năng** |
| **P4** | API quản trị (CRUD catalog, departures, users, media ops, moderation, CRM, stats) **+ Admin SPA** |
| P5 | Mobile (dùng lại contract) |
| P6 | AI concierge |
| **P7** | Polish UI toàn bộ (trước freeze 15/10) |

**Chiến lược UI (chốt 19/07):** dựng chức năng trước, hoãn đánh bóng thị giác —
NHƯNG phân biệt rõ: quyết định *kiến trúc* (RSC/Client boundary, Cache Components,
cấu trúc route, dùng shadcn/Base UI + design tokens từ trang đầu tiên) làm ĐÚNG
ngay từ đầu vì hoãn = viết lại; chỉ hoãn *thị giác* (hero, ảnh, animation, tinh
chỉnh màu/khoảng cách, responsive edge case, copy marketing). Dùng component
library từ đầu tốn ~0 công thêm mà khiến P7 chỉ còn là chỉnh layout + token.

**Legacy components (chốt 19/07, áp dụng từ P3b):** ngay sau khi scaffold
Next.js, user sẽ nạp sẵn một bộ component gốc vào web. Quy tắc: **component gốc
KHÔNG sửa** — chỉ đọc và compose; chỉ đụng vào khi chính nó lỗi. Muốn khác đi
thì bọc/extend ở tầng của mình, không edit bản gốc.
⚠️ Bắt buộc **báo user trước khi scaffold Next.js** để user nạp bộ này vào.

## Hệ quả

- **ESM xuyên suốt** (Nest v12 · oRPC · Vitest) — hết dynamic-import pg-boss.
- **Một schema Zod chạy từ DTO đến form** — bỏ bước `/regen-types`.
- Port verbatim: schema Prisma, CTE atomic-claims, outbox, tokens, i18n.
- Chính sách lịch: NestJS v12 chỉ nhận nếu GA < 30/09; freeze dependency +
  hạ tầng từ 15/10 đến sau bảo vệ.
- Docker: Dockerfile API+worker từ P1 (kiêm artifact deploy Render/Railway),
  `compose.yaml` boot cả hệ; quyết định VPS trước cuối tháng 9.

## Đã cân nhắc và loại

- **Hono/Elysia** — tự xây lại DI/module/guard cho 24 module: không đáng.
- **Bun** — chưa đáng rủi ro cho money-path 2026.
- **Drizzle** — zero-codegen + PGlite hấp dẫn, nhưng thua "port money-path
  verbatim" dưới deadline. Đã cân 2 lần, chốt Prisma — không bàn lại.
- **tRPC / ts-rest** — oRPC thắng nhờ OpenAPI-first + SSE + `@orpc/nest`.
- **Neon** — pg-boss polling phá scale-to-zero: trái kinh tế serverless.
- **Microservices** — money-path cần ACID; modular monolith + outbox events,
  tách worker riêng, ranh giới sẵn để tách sau.
