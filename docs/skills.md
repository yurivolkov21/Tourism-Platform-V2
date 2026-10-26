# Skill dùng trong dự án

Dự án được làm cùng trợ lý lập trình AI (Claude Code). *Skill* là bộ hướng dẫn đóng
gói sẵn giúp trợ lý làm đúng một loại việc, ví dụ sửa cấu hình Turborepo hay viết
ADR. Trang này liệt kê các skill nằm sẵn trong repo, cách cài lại, và những công cụ
đã cân nhắc nhưng không dùng. Người không dùng trợ lý AI có thể bỏ qua trang này.

## Skill trong repo

Mười một skill dưới đây nằm ở `.claude/skills/<tên>/` dưới dạng file thật, đi theo
git, nên ai clone repo cũng có. Phiên bản được khoá trong `skills-lock.json`. Riêng
`turborepo` có thêm một bản sao giống hệt ở `.agents/skills/turborepo/` theo quy ước
của chính skill đó.

| Skill | Nguồn | Dùng khi |
| --- | --- | --- |
| `turborepo` | vercel/turborepo | Sửa `turbo.json`, thứ tự task, cache, `--filter`, `--affected`, CI |
| `shadcn` | shadcn-ui/ui | Thêm hoặc sửa component giao diện, form, registry. Bản trong repo đã được vá tay: lệnh `info --json` thêm `-c apps/web` và `-c libs/shared/ui`, vì bản gốc lỗi `monorepo_root` khi chạy từ thư mục gốc. Khi cập nhật từ nguồn, giữ lại bản vá này (ghi chú nằm trong `SKILL.md`) |
| `nextjs` · `next-cache-components` · `react-best-practices` | vercel/vercel-plugin | Next.js 16 App Router, Server Components, Cache Components cho `apps/web` và `apps/admin`; `react-best-practices` là danh sách kiểm tra khi review file TSX |
| `prisma-cli` · `prisma-client-api` · `prisma-database-setup` | prisma/skills | Migration, API truy vấn, cấu hình cơ sở dữ liệu |
| `api-and-interface-design` | addyosmani | Thiết kế contract oRPC, ranh giới module, kiểu dữ liệu dùng chung giữa client và server |
| `documentation-and-adrs` | addyosmani | Viết ADR |
| `domain-modeling` | mattpocock | Thống nhất từ vựng nghiệp vụ (đơn, tour, chuyến) |

### Cài lại, thêm và gỡ

```bash
npx skills experimental_install                                     # cài lại mọi skill theo skills-lock.json
npx skills add <owner>/<repo> --skill <tên> -a claude-code --copy   # thêm lẻ một skill
npx skills remove <tên> -y                                          # gỡ cả thư mục lẫn dòng trong lockfile
```

Đặt `DISABLE_TELEMETRY=1` để tắt telemetry của CLI. Đừng sửa tay `skills-lock.json`.

### Đã gỡ ngày 14/09/2026

| Skill | Lý do |
| --- | --- |
| `prisma-upgrade-v7` | Hết việc: repo đã ở Prisma 7.8.0 |
| `migrate-radix-to-base` | Hết việc: không còn `@radix-ui` trong mã nguồn, `libs/shared/ui` đã dùng `@base-ui/react` |
| `prisma-postgres` · `prisma-postgres-setup` | Nói về dịch vụ cơ sở dữ liệu riêng của Prisma, trong khi dự án dùng Supabase; dễ dẫn sai hướng |
| `prisma-driver-adapter-implementation` | Chỉ cần khi tự viết driver adapter; dự án dùng `@prisma/adapter-pg` có sẵn |
| `prisma-compute` · `prisma-mongodb-upgrade` | Dòng thừa trong lockfile, chưa từng có thư mục trên đĩa |

## Plugin cài trên máy người phát triển

Ngoài skill trong repo, máy người phát triển cài plugin `superpowers` (brainstorming,
viết plan, TDD, gỡ lỗi có hệ thống, kiểm chứng trước khi báo xong). Plugin cài theo
máy chứ không theo repo, nên người clone muốn dùng thì tự cài qua lệnh `/plugin`
trong Claude Code. Trước mốc đóng băng 31/10/2026, tắt tự cập nhật của marketplace
`claude-plugins-official` (`/plugin` → Marketplaces → Disable auto-update) để công cụ
không đổi trong giai đoạn bảo vệ.

## Lưu ý khi nối trợ lý AI với dịch vụ thật

Trợ lý AI có thể được nối với Supabase, Vercel, Render, Resend qua connector, và các
connector này có lệnh ghi. Hai điều cần giữ:

- Không để trợ lý chạy migration hay sửa schema thẳng qua connector Supabase
  (`apply_migration`, `execute_sql`). Migration của dự án đi qua
  `pnpm prisma migrate deploy` để Prisma giữ đúng lịch sử; ghi thẳng sẽ làm cơ sở dữ
  liệu lệch khỏi `prisma/migrations/`.
- Khi trợ lý đang làm trên một nhánh chưa được duyệt, tắt các connector có lệnh ghi
  lên hạ tầng thật (deploy, đổi biến môi trường, tạo webhook). Luật 15 trong
  [CLAUDE.md](../CLAUDE.md) cấm việc đó; tắt connector là lớp chặn cứng đi kèm luật.

## Đã cân nhắc và không dùng

| Công cụ | Lý do |
| --- | --- |
| `github/spec-kit` | Ghi đè `CLAUDE.md`, và trùng nhiều với `superpowers` |
| `Leonxlnx/taste-skill` | Tự loại trừ giao diện sản phẩm và dashboard, nên không hợp trang quản trị và luồng đặt tour |
| `nexu-io/open-design` · `nextlevelbuilder/ui-ux-pro-max` | Sinh hệ màu hoặc `DESIGN.md` riêng, cạnh tranh với token ở `@tourism/tokens` |
| Nhóm skill TDD, plan, review của mattpocock và addyosmani | `superpowers` đã phủ; cài thêm thì các bộ hướng dẫn mâu thuẫn nhau |
| Plugin `mattpocock-skills` | Có `setup-pre-commit` cài Prettier, mà repo chỉ dùng Biome |
| Plugin `vercel` | Mang theo một bản `shadcn` không có bản vá monorepo ở trên; dự án chỉ lấy lẻ ba skill cần dùng |
| `thedotmack/claude-mem` · `rebelytics/one-skill-to-rule-them-all` · `affaan-m/ECC` | Chạy ngầm hoặc gắn hook trên mọi thao tác, tự ghi file vào repo, trùng với công cụ có sẵn |
| Plugin `context7` · `playwright` · `code-review` · `commit-commands` | Trùng tính năng có sẵn hoặc connector đã dùng; `commit-commands` còn tự tạo nhánh, push và mở PR mà không hỏi |

Lúc rà ngày 14/09/2026, NestJS, oRPC, Vitest, Docker và SEO chưa có skill chính chủ.
Với các thư viện này, tra tài liệu trực tiếp (ví dụ qua Context7) thay vì cài skill
không rõ nguồn.
