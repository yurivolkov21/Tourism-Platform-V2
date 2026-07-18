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
