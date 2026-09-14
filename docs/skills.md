# Skill đang dùng trong dự án

Bốn kênh phân phối khác nhau — đừng lẫn:

| Kênh | Nằm ở đâu | Cập nhật | Ghi chú |
| --- | --- | --- | --- |
| **skills.sh** (`npx skills add`) | `.claude/skills/<tên>/` (file thật, không symlink); riêng `turborepo` có thêm bản sao y hệt ở `.agents/skills/turborepo/` (cùng blob git — quy ước riêng của skill đó, không áp cho skill khác), khoá version trong `skills-lock.json` | Thủ công (`skills update`) | **Nằm trong repo, đi theo git** — ai clone cũng có, repo gốc chết cũng không ảnh hưởng. Hợp chính sách freeze 15/10. **Kênh ưu tiên**, kể cả khi chỉ cần vài skill trong repo của một plugin |
| **plugin CLI** (`/plugin`, `claude plugin install`) | Global máy (`~/.claude/plugins/`) | Tự động (marketplace `claude-plugins-official` bật auto-update mặc định) | Không theo repo — người khác clone phải tự cài. Một plugin kéo theo cả skill, hook và MCP; không tắt lẻ được skill nào của plugin (`skillOverrides` không áp cho skill plugin) |
| **plugin Desktop App** (Customize → Plugins) | Do app quản lý, KHÔNG nằm trong `~/.claude/settings.json` | Theo marketplace của app | Nạp vào cả Cowork lẫn tab Code. Nguồn trùng lặp dễ bỏ sót (bổ sung 14/09) |
| **skill tài khoản claude.ai** (Customize → Skills) | Trên tài khoản, không có file nào trên đĩa | Anthropic tự cập nhật | Theo TÀI KHOẢN nên có mặt ở cả Desktop App, web lẫn session Claude Code remote — kể cả session không nhìn thấy `~/.claude/plugins/`. Nguồn trùng lặp dễ bỏ sót (bổ sung 14/09, xem mục rà soát cuối file) |

Cài lại toàn bộ skill trong repo sau khi clone: `npx skills experimental_install`.
Lấy lẻ một skill: `npx skills add <owner>/<repo> --skill <tên> -a claude-code --copy`
(đặt `DISABLE_TELEMETRY=1` để tắt telemetry của CLI).

## Skill trong repo (11 — kênh skills.sh)

| Skill | Nguồn | Dùng khi |
| --- | --- | --- |
| `turborepo` | vercel/turborepo (chính chủ) | Sửa `turbo.json`, task deps/outputs, caching, `--filter`, `--affected`, CI |
| `shadcn` | shadcn-ui/ui (chính chủ) | Thêm/sửa component UI, styling, form, registry. **Đã vá local 22/07**: khối context `info --json` thêm `-c apps/web` + `-c libs/shared/ui` (bản gốc fail `monorepo_root` khi chạy từ root — nếu cập nhật skill từ upstream, giữ lại patch, xem comment trong SKILL.md). Plugin `vercel` bundle một `shadcn` KHÔNG có patch này — một lý do không cài plugin đó (xung đột #4) |
| `nextjs` · `next-cache-components` · `react-best-practices` | vercel/vercel-plugin (lấy lẻ 14/09) | Next.js 16 App Router, Server Components, Cache Components cho `apps/web` và `apps/admin` (P4); `react-best-practices` là checklist review file TSX. Repo nguồn có bản `upstream/` của `next-cache-components` trùng tên — CLI lấy bản chính (487 dòng), khi cập nhật thì soát lại |
| `prisma-cli` · `prisma-client-api` · `prisma-database-setup` | prisma/skills | Migration, query API, cấu hình DB |
| `api-and-interface-design` | addyosmani | Thiết kế contract oRPC, ranh giới module, hợp đồng type FE↔BE |
| `documentation-and-adrs` | addyosmani | ⭐ Viết ADR — thứ hội đồng capstone chấm |
| `domain-modeling` | mattpocock | Ubiquitous language cho domain tourism (booking/tour/departure) |

### Đã gỡ 14/09/2026 — ghi lý do để khỏi cài lại nhầm

| Skill đã gỡ | Lý do |
| --- | --- |
| `prisma-upgrade-v7` | Hết việc: `apps/api` đã ở `prisma@7.8.0` và `@prisma/client@7.8.0`, cuộc nâng cấp v6 → v7 đã xong |
| `migrate-radix-to-base` | Hết việc: 0 kết quả `@radix-ui` trong toàn bộ source, `libs/shared/ui` đã ở `@base-ui/react` ^1.6.0. Cài lại nếu sau này port thêm component Radix từ Nexora |
| `prisma-postgres` · `prisma-postgres-setup` | Nói về **Prisma Postgres hosted** — sản phẩm DB riêng của Prisma, còn ta chạy **Supabase**. Không chỉ thừa mà còn dễ dẫn sai hướng (gợi provision một DB khác) |
| `prisma-driver-adapter-implementation` | Chỉ cần khi **tự viết** driver adapter. Ta tiêu thụ `@prisma/adapter-pg` có sẵn; chỗ duy nhất chạm tới hình dạng lỗi adapter (`bookings.service.ts` đọc `meta.driverAdapterError.cause.code`) được xác định bằng thực nghiệm chứ không nhờ skill này |
| `prisma-compute` · `prisma-mongodb-upgrade` | Entry rác trong `skills-lock.json` — chưa bao giờ có thư mục trên đĩa. Serverless compute và Mongo nằm ngoài stack Postgres |

Gỡ bằng `npx skills remove <tên> -y` — CLI dọn cả thư mục lẫn entry lockfile,
đừng sửa tay `skills-lock.json`. Cài lại: `npx skills add <owner>/<repo>`.

## Plugin global (1)

`superpowers` (brainstorming, writing-plans, TDD, systematic-debugging,
verification-before-completion) — khoảng 584 token luôn-bật, cộng đoạn
`using-superpowers` mà hook SessionStart bơm vào đầu mỗi session.

**Đợt dọn 14/09** (kiểm tại máy): máy nạp 39 plugin (32 CLI và 7 cài từ Desktop).
Danh sách skill mỗi session có 302 mục, vượt ngân sách listing (1% context) nên
211 mục chỉ còn tên, mất mô tả — gồm cả 14 skill `superpowers`. `remember` và
`security-guidance` fail âm thầm vì máy chưa có Python thật; MCP của 11 dịch vụ
trùng giữa plugin và connector. Đã gỡ sạch rồi cài lại đúng một plugin; lý do
từng cái không cài lại nằm ở bảng "Đã cân nhắc và LOẠI".

> Danh sách này là **khai báo bằng tay**. Kiểm tại máy bằng `/plugin` hoặc
> `claude plugin list` — session Claude Code remote không nhìn thấy
> `~/.claude/plugins/`. Chi phí token của plugin đã cài:
> `claude plugin details <tên>`.

### Cài theo phase — chưa cài sẵn

| Khi nào | Cái gì | Cách |
| --- | --- | --- |
| P5 mobile | `expo` (24 skill, khoảng 3K token luôn-bật nếu cài cả plugin) | Plugin, hoặc lấy lẻ từ `expo/skills` |
| P6 AI concierge | `ai-sdk` | Lấy lẻ từ `vercel/vercel-plugin` |
| Khi đụng thanh toán, email | `stripe-best-practices` · `paypal-best-practices` · `react-email` | Lấy lẻ từ `stripe/ai` · `paypal/AI-Toolkit` · `resend/resend-skills` |
| Khi đụng auth | Skill Better Auth chính chủ | Kiểm lại nguồn trước khi cài (trước reset máy từng dùng plugin `auth-skills`) |
| Viết báo cáo, slide bảo vệ | `tt-a1i/archify` (sơ đồ kiến trúc ra HTML) · skill tài khoản `docx`/`pptx` | skills.sh; `docx`/`pptx` chạy local cần Python và LibreOffice |
| P7 polish UI | `pbakaus/impeccable` | Chỉ khi không chạy `init`/`document` — hai lệnh đó sinh `PRODUCT.md`/`DESIGN.md` cạnh tranh `@tourism/tokens`. Cài theo repo, gỡ sau P7 |
| Tra docs thư viện | Context7 | Dùng **connector**, không cài plugin (trùng) |

Trước freeze 15/10: tắt auto-update của marketplace `claude-plugins-official`
(`/plugin` → Marketplaces → Disable auto-update).

## Connector claude.ai (15)

Kênh riêng theo tài khoản (claude.ai Customize → Connectors, hoặc Settings →
Connectors trong Desktop). Kiểm 14/09:

**Dính stack, giữ**: `Supabase` (DB — nhưng xem xung đột #1) · `Vercel` (deploy
web) · `Render` (deploy API) · `Cloudinary` (ảnh tour) · `Resend` (email) ·
`Sentry` (mới là seam ở `apps/api/src/lib/observability.ts`: chưa cài
`@sentry/node`, chưa có DSN) · `Stripe` (money-path; ở trạng thái
`needs_reconnect` lúc bắt đầu rà, **đã reconnect 14/09**) · `Context7` (tra docs
live — thay cho plugin) · `Figma` (mockup ở `docs/design/mockups/`).

**Không dính stack**: `Higgsfield` · `Topviews` · `Canva` · `Linear` · `Gmail` ·
`Google Drive`.

## Rà soát 14/09/2026 — trùng lặp & xung đột

**Session cloud kiểm**: 17 skill tài khoản (`ListSkills`), 15 connector
(`ListConnectors`), 13 skill repo (đọc đĩa), stack thật trong `apps/` + `libs/`.
**Session tại máy kiểm nốt**: 32 plugin CLI và 7 plugin Desktop (kết quả ở mục
Plugin global).

### Xung đột thật — xử lý trước

| # | Xung đột | Vì sao nguy hiểm | Cách xử lý |
| --- | --- | --- | --- |
| 1 | Connector **Supabase** có `apply_migration` / `execute_sql` ↔ quy trình Prisma của repo | CLAUDE.md bắt deploy migration bằng `pnpm prisma migrate deploy` với `DATABASE_URL` tường minh. Ghi schema thẳng qua MCP tạo drift giữa DB và `prisma/migrations/` (Prisma giữ checksum từng migration) — đúng cái đã dính 12/08 khi enum `REVIEW` thiếu trên Supabase làm web build SSG chết 500 | Tắt connector Supabase ở chat **thi công**; chỉ bật ở bước merge tại session gốc. **Còn mở** |
| 2 | Write-tool của **Render · Vercel · Resend · Supabase** ↔ **luật 15** (session thi công không chạm hạ tầng sống) | `trigger_deploy`, `update_environment_variables`, `create-webhook`, `apply_migration` — mọi việc luật 15 cấm đều cách đúng một tool call. Luật 15 là văn bản, tool đang bật là khả năng | Tắt bốn connector này ở chat thi công. Đây là lớp cứng, luật là lớp mềm. **Còn mở** |
| 3 | Plugin **`document-skills`** ↔ skill tài khoản `docx` · `pptx` · `xlsx` | Trùng 100%: cùng tên, cùng nguồn Anthropic, khác kênh phân phối | **Hết 14/09**: plugin không còn cài; giữ skill tài khoản |
| 4 | Plugin **`vercel`** bundle một skill tên `shadcn` ↔ `.claude/skills/shadcn` **đã vá tay 22/07** | Hai skill trùng tên; bản của plugin KHÔNG có patch `-c apps/web` + `-c libs/shared/ui`. Bản nào thắng thì patch mất tác dụng và `info --json` fail `monorepo_root` như trước 22/07 | **Đã xử lý 14/09**: xác minh tại máy đúng là bản plugin không có patch; không cài plugin `vercel`, lấy lẻ `nextjs` · `next-cache-components` · `react-best-practices` |
| 5 | Plugin `understand-anything` ↔ skill tài khoản `learn`; plugin `security-guidance` ↔ built-in `/security-review` | Trùng chức năng — hai bộ hướng dẫn cùng kích hoạt trên một yêu cầu | **Hết 14/09**: `security-guidance` đã gỡ, `understand-anything` không còn cài, `learn` đã tắt |
| 6 | Skill tài khoản **`brand-guidelines`** (áp màu + typography của Anthropic) ↔ **luật 6** tokens-only | Đúng lý do đã loại `open-design` và `ui-ux-pro-max` ở bảng dưới: một nguồn màu thứ hai cạnh tranh với `@tourism/tokens` | **Đã tắt 14/09** (Customize → Skills) |

### Dư thừa — hết việc hoặc không liên quan

Skill repo: **đã xử lý xong 14/09** — gỡ 5 skill (13 còn 8, sau đó lấy lẻ thêm 3
nên còn 11) và dọn nốt hai entry rác trong `skills-lock.json`. Lý do từng cái ở
bảng "Đã gỡ 14/09/2026" phía trên.

Connector: `Higgsfield` và `Topviews` trùng gần 100% (cả hai đều là AI sinh
ảnh/video/audio, cộng lại khoảng 190 tool) và không cái nào dính capstone ·
`Canva` chồng lấn `Figma` cộng skill `canvas-design`/`theme-factory` — ba kênh
cùng làm design · `Linear` không có một dòng nào trong repo hay `docs/`.

Skill tài khoản không dính dự án: **đã tắt 14/09** — còn 6: `docx` · `pptx` ·
`xlsx` · `pdf` · `skill-creator` · `doc-coauthoring`.

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
| supabase ai-skills (docs) | Trùng 100% plugin `supabase` (plugin đó cũng không cài lại 14/09 — cần thì lấy lẻ skill) |
| Nhóm TDD/plan/review của mattpocock & addyosmani | `superpowers` đã phủ; cài thêm gây xung đột hướng dẫn |
| `thedotmack/claude-mem` (đánh giá 14/09) | Worker HTTP chạy ngầm, SQLite + Chroma, tự cài Bun và uv (Python); hook trên mọi tool call; nén bằng AI nên tốn token; trùng auto-memory có sẵn và vai trò của CHANGELOG — context tự sinh dễ lệch "code là nguồn sự thật" |
| `rebelytics/one-skill-to-rule-them-all` — Task Observer (14/09) | Kích hoạt ở mọi task nhiều bước, ghi `skill-observations/` vào workspace, tác giả khuyên thêm chỉ thị vào CLAUDE.md, liên tục đề xuất sửa skill — trái chính sách khoá version trước freeze |
| `affaan-m/ECC` (14/09) | 292 skill, 68 agent, 94 command, 24 hook; rules chép vào `~/.claude/rules/` nạp cho mọi dự án; hook `config-protection` chặn sửa `biome.json`, GateGuard từ chối Edit; trùng gần hết `superpowers` |
| Skill `find-skills` của `vercel-labs/skills` (14/09) | Tự kích hoạt khi hỏi "làm X thế nào" và gợi ý `npx skills add … -g -y` — cài global, đi vòng `skills-lock.json`. CLI `npx skills` vẫn là kênh chính |
| `anthropics/skills` cài dạng plugin (14/09) | Trùng skill tài khoản claude.ai (`docx`/`pptx`/`xlsx`/`pdf`, `skill-creator`…) và `claude-api` có sẵn trong Claude Code |
| Plugin `mattpocock-skills` (14/09) | Ngoài nhóm đã loại ở trên còn có `setup-pre-commit` cài Husky + lint-staged + **Prettier** — phạm luật cấm Prettier. `domain-modeling` đã lấy lẻ vào repo |
| `Egonex-AI/Understand-Anything` cài thường trực (14/09) | Lần phân tích đầu tốn nhiều token, ghi `.understand-anything/`, hook SessionStart có thể ra lệnh cập nhật graph "không hỏi user". Cần sơ đồ cho buổi bảo vệ thì dùng một lần rồi gỡ |
| Plugin `vercel` (14/09) | 33 skill (khoảng 2,3K token luôn-bật), bundle `shadcn` không có patch monorepo — lấy lẻ 3 skill thay thế |
| Plugin `remember` · `security-guidance` (14/09) | Hook chạy bằng Python 3.10+ thật; máy dev Windows chưa có nên fail âm thầm (`remember` hỏng 71/71 lần save). `security-guidance` còn trùng `/security-review` có sẵn |
| Plugin `context7` · `playwright` · `code-review` · `commit-commands` (14/09) | `context7` trùng connector; `playwright` trùng Claude Browser có sẵn; `code-review` trùng `/code-review` có sẵn; `commit-push-pr` tự tạo branch → push → PR không hỏi (trái luật 2 và flow rebase + ff) |

## Khoảng trống — KHÔNG có skill chính chủ

**NestJS · oRPC · Vitest · Docker · SEO.** Đã kiểm tận repo: `nestjs/nest` và
`unnoq/orpc` không ship `SKILL.md`; các repo cá nhân tên kêu không verify được
chất lượng. Cách xoay: dùng connector Context7 (tra docs live) + tự viết skill nội
bộ bằng `skill-creator` khi pattern đã ổn định.
