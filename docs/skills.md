# Skill đang dùng trong dự án

Hai kênh phân phối khác nhau — đừng lẫn:

| Kênh | Nằm ở đâu | Cập nhật | Ghi chú |
| --- | --- | --- | --- |
| **skills.sh** (`npx skills add`) | `.agents/skills/` + link sang `.claude/skills/`, khoá version trong `skills-lock.json` | Thủ công (`skills update`) | **Nằm trong repo, đi theo git** — ai clone cũng có, repo gốc chết cũng không ảnh hưởng. Hợp chính sách freeze 15/10 |
| **plugin** (`claude plugin install`) | Global máy (`~/.claude/plugins/`) | Tự động | Không theo repo — người khác clone phải tự cài |

Cài lại toàn bộ skill trong repo sau khi clone: `npx skills experimental_install`.

## Skill trong repo (15 — kênh skills.sh)

| Skill | Nguồn | Dùng khi |
| --- | --- | --- |
| `turborepo` | vercel/turborepo (chính chủ) | Sửa `turbo.json`, task deps/outputs, caching, `--filter`, `--affected`, CI |
| `shadcn` | shadcn-ui/ui (chính chủ) | Thêm/sửa component UI, styling, form, registry |
| `migrate-radix-to-base` | shadcn-ui/ui | Chuyển component Radix → **Base UI** (ta đã chọn Base UI) |
| `prisma-upgrade-v7` | prisma/skills (chính chủ) | ⭐ Breaking change Prisma 7: ESM config, driver adapter bắt buộc, `prisma.config.ts` |
| `prisma-cli` · `prisma-client-api` · `prisma-database-setup` · `prisma-postgres-setup` · `prisma-postgres` · `prisma-driver-adapter-implementation` | prisma/skills | Migration, query API, cấu hình DB |
| `prisma-compute` · `prisma-mongodb-upgrade` | prisma/skills | Đi kèm bundle `prisma/skills`, **KHÔNG dùng** — serverless compute + Mongo không thuộc stack Postgres của ta. Còn trong `skills-lock.json`; prune nếu muốn gọn |
| `api-and-interface-design` | addyosmani | Thiết kế contract oRPC, ranh giới module, hợp đồng type FE↔BE |
| `documentation-and-adrs` | addyosmani | ⭐ Viết ADR — thứ hội đồng capstone chấm |
| `domain-modeling` | mattpocock | Ubiquitous language cho domain tourism (booking/tour/departure) |

## Plugin global (14)

`context7` (tra docs thư viện — dùng nhiều) · `prisma` (MCP tool) · `superpowers`
(brainstorming, writing-plans, TDD, systematic-debugging,
verification-before-completion) · `vercel` (nextjs, next-cache-components,
shadcn, ai-sdk, performance-optimizer) · `supabase` · `expo` · `playwright` ·
`security-guidance` · `frontend-design` · `typescript-lsp` · `commit-commands` ·
`understand-anything` · **`auth-skills`** (Better Auth chính chủ) ·
**`document-skills`** (docx/pptx/xlsx — báo cáo + slide bảo vệ 11/2026).

## Đã cân nhắc và LOẠI (đừng cài lại)

| Nguồn | Lý do loại |
| --- | --- |
| `github/spec-kit` | **Chiếm quyền ghi `CLAUDE.md`** (hợp đồng vận hành của ta) + trùng nặng `superpowers` |
| `Leonxlnx/taste-skill` | SKILL.md tự loại trừ *"not dashboards, not product UI"* → admin + UI booking nằm ngoài phạm vi; 87KB/lần nạp; xung đột icon với shadcn |
| `nexu-io/open-design` | App Electron 1.6GB sinh HTML rời, không sinh code React vào monorepo; áp `DESIGN.md` riêng **xung đột** với token oklch của ta |
| `nextlevelbuilder/ui-ux-pro-max` | Nội dung tốt nhưng `colors.csv` toàn hex + `--persist` đẻ `design-system/MASTER.md` cạnh tranh với token của ta. Cân nhắc lại ở P7 nếu cần, kèm luật cấm `--persist` |
| supabase ai-skills (docs) | Trùng 100% plugin `supabase` đã cài |
| Nhóm TDD/plan/review của mattpocock & addyosmani | `superpowers` đã phủ; cài thêm gây xung đột hướng dẫn |

## Khoảng trống — KHÔNG có skill chính chủ

**NestJS · oRPC · Vitest · Docker · SEO.** Đã kiểm tận repo: `nestjs/nest` và
`unnoq/orpc` không ship `SKILL.md`; các repo cá nhân tên kêu không verify được
chất lượng. Cách xoay: dùng `context7` (tra docs live) + tự viết skill nội bộ
bằng `skill-creator` khi pattern đã ổn định.
