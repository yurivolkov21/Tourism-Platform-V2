# tourism-v2

Nền tảng đặt tour du lịch — **capstone project**, rebuild nâng cấp từ Nexora
(`tourism-platform`). Monorepo **pnpm + Turborepo**, chạy trong WSL.

> Tên/brand chính thức: chưa chốt — scope `@tourism/*` là codename tạm,
> đổi một lần bằng find-replace trước khi deploy public.

| Project | Đường dẫn | Stack | Trạng thái |
| --- | --- | --- | --- |
| `@tourism/api` | `apps/api` | NestJS 11→12 · Prisma 7 · oRPC · Better Auth · pg-boss | ✅ P1 |
| `@tourism/web` | `apps/web` | Next.js 16 (Cache Components) · React 19 · Tailwind 4 | ⬜ P3 |
| `@tourism/admin` | `apps/admin` | Vite · TanStack Router/Query SPA | ⬜ P4 |
| `@tourism/mobile` | `apps/mobile` | Expo SDK 56 · RN 0.85 (New Arch) | ⬜ P5 |
| `@tourism/tokens` | `libs/shared/tokens` | Style Dictionary · oklch → CSS vars + RN hex theme | ✅ ported |
| `@tourism/i18n` | `libs/shared/i18n` | EN copy + legal docs | ✅ ported |
| `@tourism/contract` | `libs/shared/contract` | Zod 4 schemas + oRPC contract (types end-to-end) | ✅ P1 |
| `@tourism/core` | `libs/shared/core` | domain logic thuần (khi cần ở P2+) | ⬜ |

## Yêu cầu

- **Node ≥ 24** · **pnpm 11** (`corepack enable`) · chạy trong **WSL** (repo nằm trên ext4, không phải `/mnt/c`)

## Lệnh thường dùng (từ repo root)

```bash
pnpm install
pnpm build          # turbo run build (cache)
pnpm test           # turbo run test
pnpm typecheck      # turbo run typecheck (TypeScript 7 / tsgo-native)
pnpm lint           # biome check
pnpm gate           # build + typecheck + test + lint — chạy trước khi khai "xanh"
```

## Tài liệu

- **[docs/README.md](docs/README.md)** — bản đồ tài liệu
- **[docs/adr/0001-tech-stack.md](docs/adr/0001-tech-stack.md)** — toàn bộ quyết định stack + lý do
- **[CLAUDE.md](CLAUDE.md)** — quy ước làm việc (hợp đồng vận hành)

Repo tham chiếu (chỉ đọc): Nexora tại `/mnt/c/Dev Program Files/Dev/Projects/Tourism-Platform`.
