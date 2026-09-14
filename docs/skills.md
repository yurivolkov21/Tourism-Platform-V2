# Skill đang dùng trong dự án

Ba kênh phân phối khác nhau — đừng lẫn:

| Kênh | Nằm ở đâu | Cập nhật | Ghi chú |
| --- | --- | --- | --- |
| **skills.sh** (`npx skills add`) | `.claude/skills/<tên>/` (file thật, không symlink); riêng `turborepo` có thêm bản sao y hệt ở `.agents/skills/turborepo/` (cùng blob git — quy ước riêng của skill đó, không áp cho skill khác), khoá version trong `skills-lock.json` | Thủ công (`skills update`) | **Nằm trong repo, đi theo git** — ai clone cũng có, repo gốc chết cũng không ảnh hưởng. Hợp chính sách freeze 15/10 |
| **plugin** (`claude plugin install`) | Global máy (`~/.claude/plugins/`) | Tự động | Không theo repo — người khác clone phải tự cài |
| **skill tài khoản claude.ai** (Settings → Capabilities) | Trên tài khoản, không có file nào trên đĩa | Anthropic tự cập nhật | Theo TÀI KHOẢN nên có mặt ở cả Desktop App, web lẫn session Claude Code remote — kể cả session không nhìn thấy `~/.claude/plugins/`. Đây là nguồn trùng lặp dễ bỏ sót nhất (bổ sung 14/09, xem mục rà soát cuối file) |

Cài lại toàn bộ skill trong repo sau khi clone: `npx skills experimental_install`.

## Skill trong repo (13 — kênh skills.sh)

| Skill | Nguồn | Dùng khi |
| --- | --- | --- |
| `turborepo` | vercel/turborepo (chính chủ) | Sửa `turbo.json`, task deps/outputs, caching, `--filter`, `--affected`, CI |
| `shadcn` | shadcn-ui/ui (chính chủ) | Thêm/sửa component UI, styling, form, registry. **Đã vá local 22/07**: khối context `info --json` thêm `-c apps/web` + `-c libs/shared/ui` (bản gốc fail `monorepo_root` khi chạy từ root — nếu cập nhật skill từ upstream, giữ lại patch, xem comment trong SKILL.md). Rà 14/09: plugin `vercel` cũng bundle một skill tên `shadcn` — xem xung đột #4 |
| `migrate-radix-to-base` | shadcn-ui/ui | Chuyển component Radix → **Base UI** (ta đã chọn Base UI). **Hết việc (rà 14/09)**: `grep @radix-ui` toàn repo = 0 kết quả, `libs/shared/ui` đã ở `@base-ui/react` ^1.6.0. Chỉ còn ích nếu port thêm component Radix từ Nexora; không thì gỡ được |
| `prisma-upgrade-v7` | prisma/skills (chính chủ) | Breaking change Prisma 7: ESM config, driver adapter bắt buộc, `prisma.config.ts`. **Hết việc (rà 14/09)**: `apps/api` đã ở `prisma@7.8.0` và `@prisma/client@7.8.0`, cuộc nâng cấp đã xong — bỏ dấu ⭐, gỡ được |
| `prisma-cli` · `prisma-client-api` · `prisma-database-setup` | prisma/skills | Migration, query API, cấu hình DB — ba cái này **giữ** |
| `prisma-postgres-setup` · `prisma-postgres` · `prisma-driver-adapter-implementation` | prisma/skills | **Gỡ được (rà 14/09)**: hai cái đầu nói về **Prisma Postgres hosted** — sản phẩm DB riêng của Prisma, còn ta chạy **Supabase**; chúng không chỉ thừa mà còn dễ dẫn sai hướng (gợi provision một DB khác). Cái thứ ba chỉ cần khi TỰ VIẾT driver adapter, ta chỉ tiêu thụ adapter có sẵn |
| `prisma-compute` · `prisma-mongodb-upgrade` | prisma/skills | **Không nằm trong 13 skill trên đĩa** — chỉ còn rác trong `skills-lock.json` (bundle `prisma/skills` khai cả hai, nhưng không có thư mục nào ở `.claude/skills/`). Serverless compute + Mongo không thuộc stack Postgres của ta; prune entry lockfile nếu muốn gọn |
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

> Danh sách này là **khai báo bằng tay, chưa có gì canh**. Session Claude Code
> remote không đọc được `~/.claude/plugins/` nên không tự đối chiếu được — mọi
> kết luận về plugin ở mục rà soát bên dưới cần xác minh tại máy bằng
> `claude plugin list`.

## Connector claude.ai (15)

Kênh thứ ba, theo tài khoản (Settings → Connectors). Kiểm 14/09:

**Dính stack, giữ**: `Supabase` (DB — nhưng xem xung đột #1) · `Vercel` (deploy
web) · `Render` (deploy API) · `Cloudinary` (ảnh tour) · `Resend` (email) ·
`Sentry` (nối thật ở `apps/api/src/lib/observability.ts`) · `Stripe`
(money-path; ở trạng thái `needs_reconnect` lúc bắt đầu rà, **đã reconnect
14/09**) · `Context7` (tra docs live) · `Figma` (mockup ở `docs/design/mockups/`).

**Không dính stack**: `Higgsfield` · `Topviews` · `Canva` · `Linear` · `Gmail` ·
`Google Drive`.

## Rà soát 14/09/2026 — trùng lặp & xung đột

**Đã kiểm trực tiếp**: 17 skill tài khoản (`ListSkills`), 15 connector
(`ListConnectors`), 13 skill repo (đọc đĩa), stack thật trong `apps/` + `libs/`.
**KHÔNG kiểm được**: 14 plugin global (lý do ở ghi chú mục trên).

### Xung đột thật — xử lý trước

| # | Xung đột | Vì sao nguy hiểm | Cách xử lý |
| --- | --- | --- | --- |
| 1 | Connector **Supabase** có `apply_migration` / `execute_sql` ↔ quy trình Prisma của repo | CLAUDE.md bắt deploy migration bằng `pnpm prisma migrate deploy` với `DATABASE_URL` tường minh. Ghi schema thẳng qua MCP tạo drift giữa DB và `prisma/migrations/` (Prisma giữ checksum từng migration) — đúng cái đã dính 12/08 khi enum `REVIEW` thiếu trên Supabase làm web build SSG chết 500 | Tắt connector Supabase ở chat **thi công**; chỉ bật ở bước merge tại session gốc |
| 2 | Write-tool của **Render · Vercel · Resend · Supabase** ↔ **luật 15** (session thi công không chạm hạ tầng sống) | `trigger_deploy`, `update_environment_variables`, `create-webhook`, `apply_migration` — mọi việc luật 15 cấm đều cách đúng một tool call. Luật 15 là văn bản, tool đang bật là khả năng | Tắt bốn connector này ở chat thi công. Đây là lớp cứng, luật là lớp mềm |
| 3 | Plugin **`document-skills`** ↔ skill tài khoản `docx` · `pptx` · `xlsx` | Trùng 100%: cùng tên, cùng nguồn Anthropic, khác kênh phân phối | Gỡ plugin, giữ skill tài khoản (Anthropic tự cập nhật) |
| 4 | Plugin **`vercel`** bundle một skill tên `shadcn` ↔ `.claude/skills/shadcn` **đã vá tay 22/07** | Hai skill trùng tên; bản của plugin KHÔNG có patch `-c apps/web` + `-c libs/shared/ui`. Bản nào thắng thì patch mất tác dụng và `info --json` fail `monorepo_root` như trước 22/07 | Xác minh tại máy; nếu đúng thì gỡ skill `shadcn` khỏi plugin `vercel`, giữ bản repo |
| 5 | Plugin `understand-anything` ↔ skill tài khoản `learn`; plugin `security-guidance` ↔ built-in `/security-review` | Trùng chức năng — hai bộ hướng dẫn cùng kích hoạt trên một yêu cầu | Gỡ plugin, giữ bản built-in / tài khoản |
| 6 | Skill tài khoản **`brand-guidelines`** (áp màu + typography của Anthropic) ↔ **luật 6** tokens-only | Đúng lý do đã loại `open-design` và `ui-ux-pro-max` ở bảng dưới: một nguồn màu thứ hai cạnh tranh với `@tourism/tokens` | Tắt trong Settings → Capabilities, hoặc chỉ bật khi làm slide bảo vệ (ngoài code) |

### Dư thừa — hết việc hoặc không liên quan

Skill repo (chi tiết ở bảng "Skill trong repo"): `prisma-upgrade-v7` ·
`migrate-radix-to-base` · `prisma-postgres` · `prisma-postgres-setup` ·
`prisma-driver-adapter-implementation`, cộng hai entry rác trong
`skills-lock.json` đã biết từ trước.

Connector: `Higgsfield` và `Topviews` trùng gần 100% (cả hai đều là AI sinh
ảnh/video/audio, cộng lại khoảng 190 tool) và không cái nào dính capstone ·
`Canva` chồng lấn `Figma` cộng skill `canvas-design`/`theme-factory` — ba kênh
cùng làm design · `Linear` không có một dòng nào trong repo hay `docs/`.

Skill tài khoản không dính dự án: `slack-gif-creator` · `algorithmic-art` ·
`morning` · `internal-comms` · `import-memory`. Vô hại, nhưng là tiền context.

### Thứ tự ưu tiên

Xử lý #1 và #2 trước, phần dư thừa để sau: hai cái đó có thể làm hỏng DB
production đang chạy tại `www.nexora-travel.agency` và không undo được, còn thừa
skill thì chỉ tốn context.

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
