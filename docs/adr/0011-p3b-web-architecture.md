# ADR-0011 — Kiến trúc web P3b: Next.js 16 + shared UI (`libs/shared/ui`)

- **Trạng thái:** Accepted (2026-07-22)
- **Bối cảnh:** Mở phase P3b (web khách hàng) sau khi backend P1–P3a + hardening (ADR-0006/0009/0010) xong.
  Nối tiếp [ADR-0001](0001-tech-stack.md) (stack + chiến lược UI), [ADR-0010](0010-infra-hardening.md)
  (error-envelope thống nhất cho FE), CLAUDE.md #6 (tokens-only) · toolchain Biome.

## Bối cảnh

`apps/web`/`apps/admin` mới là skeleton P0 (rỗng). Cần dựng nền web hiện đại, và một bộ **components/blocks
dùng chung** cho CẢ web lẫn admin (tránh dựng hai lần). `pnpm-workspace.yaml` đã reserve sẵn
`libs/shared/*` · `libs/web/*` · `libs/mobile/*` — cấu trúc share đã được tính từ P0.

## Quyết định

1. **Stack web:** **Next.js 16.2.11** (App Router · RSC · Turbopack) + **React 19** + TypeScript + **Tailwind
   CSS v4**, tại `apps/web` (`@tourism/web`). `apps/admin` sẽ mirror stack này ở P4. Chọn "mới nhất" theo yêu
   cầu user (chấp nhận rủi ro major mới; freeze 15/10 chốt ở 16.x).
2. **Bộ shared components/blocks → `libs/shared/ui` (`@tourism/ui`).** shadcn ở **monorepo mode** cài
   component/block vào package này; web VÀ admin import qua alias. Đây là "bộ legacy components/blocks" —
   dùng chung. **Custom riêng** cho một app → thư mục trong chính `apps/web`/`apps/admin`, KHÔNG nhét vào shared.
   (Cài shadcn + bộ components là bước phối hợp KẾ TIẾP; bước này chỉ scaffold web bare + Tailwind.)
3. **Toolchain parity (bất di bất dịch):** **Biome, KHÔNG ESLint/Prettier** (CLAUDE.md) — scaffold
   `--no-eslint`, gỡ mọi config ESLint Next thêm vào; format/lint tsx qua Biome. Turborepo pipeline cho
   `@tourism/web` (build/lint/typecheck/dev). Env: `.env.local` (dev) theo quy ước 19/07.
4. **Tokens-only (#6):** Tailwind theme wire vào `@tourism/tokens` (nguồn màu/spacing duy nhất) — KHÔNG hex
   rải rác. shadcn dùng CSS variables → map sang token của repo (chi tiết ở bước cài components).
5. **Gọi API:** typed oRPC client từ `@tourism/contract` (shape lỗi giờ thống nhất qua ADR-0010 nên FE một
   parser). i18n copy tiếng Anh qua `@tourism/i18n` (#7).

## Hệ quả

- Web tiêu thụ backend đã hardened + error-envelope thống nhất; contract là nguồn type chung → FE/BE không lệch.
- Một bộ UI (`@tourism/ui`) nuôi cả web lẫn admin → nhất quán thương hiệu, không nhân đôi.
- Biome phủ luôn tsx của web; ba lớp chống-lệch-chuẩn (`.vscode`, pre-commit, CI) áp cho code web.
- Scaffold KHÔNG kèm ESLint; `next lint` (nếu có) không dùng — Biome là nguồn lint duy nhất.

## Đã cân nhắc và loại

- **Next 15.x** (major cũ, dày dạn hơn): loại theo yêu cầu user "template mới nhất"; rủi ro major-mới chấp nhận.
- **Components dùng chung để trong `apps/web` rồi admin import chéo:** loại — app không nên phụ thuộc app khác;
  shared code thuộc `libs/shared/*` (ranh giới rõ, workspace đã reserve).
- **Prettier/ESLint theo default Next:** loại tuyệt đối — tranh format với Biome (CLAUDE.md, bài học 39-file 19/07).
