# CLAUDE.md — tourism-v2

Quy ước cho AI agent (và người) làm việc trong repo này. Kế thừa hợp đồng vận
hành đã chứng minh ở Nexora, cập nhật cho toolchain mới.

> **Code là nguồn sự thật.** Doc lệch code thì sửa doc.

## Dự án là gì

Capstone tốt nghiệp (bảo vệ dự kiến sau ~10/11/2026) — nền tảng đặt tour vận
hành như trang thương mại thật nhưng **không doanh thu**: Stripe/PayPal luôn ở
test/sandbox mode. Rebuild nâng cấp từ Nexora. **Bản sao Nexora không còn trên
máy** (user chốt 14/09/2026 không clone lại) — mọi đối chiếu từ nay đọc các bản
ghi đã có trong [`docs/analysis/`](docs/analysis/), đừng đi tìm thư mục cũ.

Stack đã chốt + lý do: [docs/adr/0001-tech-stack.md](docs/adr/0001-tech-stack.md).
Roadmap: P0 khung xương ✅ → P1 API lõi ✅ → P2 money-path ✅ → P3a API khách ✅
→ P3b web ✅ → **deploy v1 ✅ 20/08** (site sống tại `www.nexora-travel.agency`,
ADR-0024 — push main là Vercel/Render tự deploy, sửa gì cũng là sửa đồ ĐANG
CHẠY) → P4 admin (a–d ✅ sống trên `admin.nexora-travel.agency`; **P4e catalog
CRUD + P4f media/users chưa làm**) → P5 mobile (P5a khung ✅ · P5b-1 auth ✅ ·
P5b-2…5 mới có bản vẽ, thành viên khác dựng màn) → P6 AI concierge → P7 polish
UI → freeze 15/10. Việc còn nợ gom ở [docs/open-items.md](docs/open-items.md).

## Quy ước làm việc (bất di bất dịch trừ khi user nói khác)

1. **One feature = one branch.** Branch → implement → user review → merge →
   xóa branch. Docs/meta nhỏ được vào thẳng `main`.
   **Merge kiểu rebase + fast-forward** (quy ước 18/07): trước khi merge, rebase
   branch lên `main` mới nhất rồi `git merge --ff-only` — lịch sử tuyến tính,
   không merge commit.
2. **Hỏi trước khi bắt đầu feature/phase mới; xác nhận trước mọi merge/push.**
3. **Spec → plan → execute** cho feature nhiều bước; spec đặt trong `docs/`.
4. **TDD trên logic thuần** — test trước, ≥80% trên logic mới.
5. **ADR đi TRƯỚC code** cho mọi quyết định kiến trúc (sửa lỗi ADR-retroactive
   của Nexora). ADR đánh số trong `docs/adr/`.
6. **Frontend: tokens-only, không hex** — dùng `@tourism/tokens`.
7. **English-only** cho copy user-facing (text sản phẩm — nút, nhãn, email,
   thông báo), tập trung trong `@tourism/i18n`.
8. **Comment code: tiếng Việt** (developer-facing — khác luật 7). Mọi comment
   `//` và JSDoc `/** */` viết bằng tiếng Việt, kể cả code do subagent sinh ra
   (brief subagent phải dặn điều này). Tên biến/hàm/identifier vẫn tiếng Anh.
9. **Ưu tiên skill có sẵn hơn tự chế.** Trước khi bắt tay, rà danh sách skill
   xem có cái nào phủ đúng việc này không (xem [docs/skills.md](docs/skills.md)
   để biết có gì và dùng khi nào). Có thì gọi qua Skill tool; đừng dựng lại thứ
   đã có. Brief cho subagent cũng phải nhắc điều này: lời nhắc tự động hiện có
   là hook SessionStart của plugin `superpowers` (bơm `using-superpowers` vào
   session chính; plugin cài global nên máy chưa cài thì không có), mà skill đó
   có khối `SUBAGENT-STOP` dặn subagent bỏ qua. Hook nhắc-skill riêng trước đây
   mất theo `~/.claude/settings.json` cũ khi reset máy (14/09), không dựng lại.
10. **Đối chiếu Nexora TRƯỚC mỗi phase — chủ động, không đợi được nhắc.**
    v2 là bản *nâng cấp*; thứ gì Nexora có mà đây thiếu là thụt lùi. Rà ở
    CẢ HAI tầng: (a) endpoint/feature, (b) **hạ tầng xuyên suốt** —
    bootstrap, middleware, interceptor/filter/guard, cron, retry/timeout,
    observability, security header. Bài học 19/07: API parity map chỉ đếm
    endpoint nên bỏ lọt CORS, rate limit, HTTP timeout, health-check DB —
    user phải tự phát hiện. Phân loại mỗi khác biệt: thụt lùi cần vá / cố
    ý bỏ (ghi lý do) / làm khác mà tương đương / v2 tốt hơn.
11. **`pnpm gate:int` trước khi khai một task/feature là xong** — nó chạy
    `gate` (build + typecheck + unit test + lint) CỘNG integration test.
    `pnpm gate` trần chỉ dùng cho vòng lặp TDD nhanh; nó KHÔNG đụng tới
    integration test, nên "gate xanh" một mình không đủ để khai hoàn thành.
    Lý do tách: int test cần Postgres và chậm hơn ~6x. Lý do bắt buộc chạy:
    một int spec từng hỏng suốt 4 task mà không ai biết vì không có gì canh.
12. **Commits: Conventional Commits.** KHÔNG AI attribution (quy ước user).
    Message viết **tiếng Việt CÓ DẤU đầy đủ** (chốt 04/08 — trước đó hay bỏ
    dấu; type/scope giữ tiếng Anh theo Conventional: `fix(api): sửa …`).
    Brief cho subagent có commit phải nhắc luật này.
13. **Docs sweep sau mỗi feature merge**: 1 entry vào `docs/CHANGELOG.md`
    (ngày · hash · nội dung · review findings · số test) + cập nhật doc
    hiện-trạng bị ảnh hưởng + **thêm doc mới vào bản đồ `docs/README.md`**
    (đó là cửa vào duy nhất; doc không nằm trong bản đồ coi như không tồn tại).
    Luật này từng bị bỏ qua 8 merge liên tiếp (19/07) nên giờ có
    `scripts/docs-freshness.sh` chạy trong CI **trên nhánh main**: còn commit
    `feat`/`fix` mới hơn entry CHANGELOG mới nhất là CI đỏ. Chạy tay bất cứ
    lúc nào bằng `./scripts/docs-freshness.sh`.

14. **Liếc đèn CI sau MỖI push lên main** (chốt 04/08): chạy
    `gh run list --branch main --limit 1` và xác nhận run mới nhất
    success (chờ nếu đang chạy) trước khi khai xong việc push. Lý do:
    main từng đỏ ÂM THẦM suốt 31/07→04/08 (build web thiếu API sống
    trong CI) vì flow rebase+ff không chờ check và không ai nhìn đèn —
    ruleset `gate` bị bypass bằng quyền admin mỗi lần push là bình
    thường, nhưng bypass ≠ miễn nhìn. Luật này áp cho cả agent lẫn
    người; brief subagent nào có bước push phải nhắc.

15. **Session thi công KHÔNG chạm hạ tầng sống** (chốt 08/09, sau W4):
    nhánh chưa qua review thì KHÔNG deploy migration lên Supabase, không
    tạo/sửa webhook ở Resend/Stripe/PayPal, không set env hay redeploy
    Render/Vercel, không đổi thiết lập Cloudinary. Mọi việc đó thuộc bước
    merge ở session gốc, SAU review — vì review có thể đổi chính migration
    (W4: backfill sai phải sửa bằng migration thứ hai vì migration đầu đã
    chạy prod) và vì hạ tầng đổi trước code là một khoảng "lệch pha" không
    ai canh. Prompt cho session thi công phải nhắc luật này; việc cần hạ
    tầng thì ghi thành checklist trong CHANGELOG mục CÒN TREO cho session gốc.

## Toolchain thống nhất (MỘT tool cho mỗi việc — không có ngoại lệ)

| Việc | Tool DUY NHẤT | Chạy ở đâu |
| --- | --- | --- |
| Format + lint (ts/tsx/js/jsx/json/css) | **Biome** | editor save · `pnpm lint:fix` · pre-commit · CI |
| Typecheck | **tsc (TypeScript 7)** | `pnpm typecheck` · CI |
| Test | **Vitest** (mobile sau này: jest-expo) | `pnpm test` · CI |
| Build/orchestrate | **Turborepo** | `pnpm build` |
| Markdown | markdownlint (Biome không format .md) | editor |
| YAML / Prisma | extension chuyên dụng tương ứng | editor |

**KHÔNG bao giờ thêm Prettier hay ESLint vào repo này** — chúng sẽ tranh format
với Biome. Repo hiện không có dependency/config nào của hai tool đó; giữ vậy.

Ba lớp bảo vệ chống lệch chuẩn (đã dựng, đừng gỡ):

1. **`.vscode/settings.json` pin formatter theo TỪNG ngôn ngữ.** Bắt buộc vì
   setting theo-ngôn-ngữ ở settings global của máy **thắng** setting chung của
   workspace — từng khiến Prettier âm thầm format lại 39 file (nháy kép/80 cột)
   và làm `biome check` fail. Ngôn ngữ nào chưa pin là hở: máy dựng lại 14/09
   có settings global pin Prettier cho `[html]` và formatter built-in cho
   `[css]`, nên workspace thêm `[css]` → Biome và tắt format-on-save cho
   `[html]` (HTML duy nhất trong repo là mockup bất biến).
2. **`.githooks/pre-commit`** chạy `biome check --staged` — chặn ngay tại máy,
   tự bật qua script `prepare` khi `pnpm install`. Bỏ qua: `--no-verify`.
3. **CI** chạy `gate` + `test:int` (có service Postgres) — lưới cuối.

## Chính sách theo lịch (capstone)

- NestJS v12: chỉ migrate nếu GA trước **30/09/2026**, sau đó ở lại v11.
- **Freeze 15/10/2026**: không nâng cấp dependency, không đổi nơi deploy.

## Lệnh

```bash
pnpm gate:int                    # gate ĐẦY ĐỦ — dùng cái này trước khi khai xong
pnpm gate                        # nhanh, KHÔNG có int test — chỉ cho vòng lặp TDD
pnpm turbo run test --filter=@tourism/tokens   # một package
pnpm lint:fix                    # biome tự sửa format + lint
```

## Gotchas

- **Máy dev chạy Windows native từ 14/09/2026** (dựng lại sau reset máy; trước
  đó repo nằm trong WSL ext4 `~/projects/tourism-v2`). Repo ở
  `C:\Programming\Devs\Projects\Tourism-Platform-V2`, Node **24** LTS ở
  `C:\Programming\Node.JS` — khớp `node-version: 24` của CI và `node:24-alpine`
  của Dockerfile. Quay lại WSL thì luật cũ vẫn giữ: repo trên ext4, không bao
  giờ làm việc qua `/mnt/c`. Bốn bẫy riêng của Windows:
  1. **pnpm phải chạy script bằng Git Bash:**
     `pnpm config set script-shell "C:\Programming\Git\bin\bash.exe"` — cấu hình
     cấp user, KHÔNG đặt trong repo (CI là Linux). Mặc định pnpm dùng cmd.exe:
     không có `sh` trên PATH nên `ci:wait` chết, và cmd không bóc quote đơn nên
     `--ignore '**/*.spec.ts'` ở `build`/`db:seed` của api mất tác dụng.
  2. **`bash` gõ trong PowerShell là launcher WSL** (`C:\Windows\system32\bash.exe`),
     không phải Git Bash — `scripts/*.sh` và lệnh `export …` ở gotcha Prisma
     bên dưới phải chạy từ Git Bash.
  3. **PATH là bản chụp lúc app mở:** cài/đổi Node xong phải khởi động lại
     Claude Desktop và VS Code, không thì tiến trình con vẫn báo
     `node: command not found` (dính 14/09).
  4. **`apps/web/scripts/guard-build.mjs` dò `/proc` nên trên Windows tự bỏ
     qua** — lớp chặn build-khi-đang-serve không còn; tắt `next dev`/`next start`
     trước khi build web.
- `.gitattributes` ép LF toàn repo — bài học 797-file CRLF churn của Nexora. Git
  for Windows cài sẵn `core.autocrlf=true` ở cấp system nhưng `.gitattributes`
  vẫn thắng (đo 14/09: 0 file CRLF sau clone).
- tsconfig bật `noUncheckedIndexedAccess` (nghiêm hơn Nexora) — code port từ
  Nexora có thể cần chỉnh nhỏ kiểu destructure-with-default.
- `libs/shared/tokens/generated/` là build artifact (gitignored) — build bằng
  `pnpm turbo run build --filter=@tourism/tokens`, không sửa tay.
- Postgres: kết nối direct/session với pool ~10 — **cấm transaction pooler**
  (nguồn gốc mọi contortion của Nexora). Với Supabase: dùng **Session pooler**
  (host `…pooler.supabase.com`, cổng **5432**, user `postgres.<ref>`). Cổng
  **6543** là transaction pooler — cấm. Direct `db.<ref>.supabase.co` chỉ có
  IPv6, WSL không tới được (đã đo).
- **Tên file env — chốt 19/07, áp cho mọi app sinh ra về sau:** `.env.local`
  (dev, file DUY NHẤT script pnpm tự đọc) · `.env.production` (deploy thật,
  CÓ secret, phải trỏ tường minh `--env-file`) · `.env.example` (mẫu, file env
  duy nhất được commit). Đặt env ở root repo là vô tác dụng — script chạy với
  cwd `apps/api` nên chỉ thấy `apps/api/.env.local`.
- Biến env để trống (`KEY=`) là **chuỗi rỗng**, không phải undefined —
  `parseEnv` strip nó để `.default()` vẫn chạy. Nền tảng deploy cũng gửi chuỗi
  rỗng khi ô bị bỏ trống, nên đừng gỡ bước strip này.
- **`prisma.config.ts` chỉ đọc `.env` (qua `dotenv/config`) — KHÔNG đọc
  `.env.local`.** Vì repo không có `.env` nên mọi lệnh `prisma migrate/status`
  rơi về Postgres docker local; Supabase KHÔNG tự nhận migration. Đã dính
  12/08: enum `REVIEW` thiếu trên Supabase → web build SSG chết 500. Sau mỗi
  migration mới, deploy tường minh từ `apps/api` (Git Bash):
  `export DATABASE_URL="$(grep '^DATABASE_URL=' .env.production | cut -d= -f2- | tr -d '\r')" && pnpm prisma migrate deploy`.
  (`tr -d '\r'`: `.env.production` sửa trên Windows có thể mang CRLF — đo 15/09;
  thiếu nó thì giá trị export dính `\r` ở cuối.)
  Từ 14/09 `.env.local` trỏ Postgres Docker đúng như `.env.example` dặn; chuỗi
  Supabase CHỈ nằm ở `.env.production`. Trước reset máy `.env.local` từng trỏ
  thẳng Supabase prod, nên `pnpm dev`/`db:seed`/`db:migrate` ở máy đều chạm prod.
- **`docs/design/mockups/*.src.html` bị loại khỏi Biome** (`biome.json` →
  `files.includes`). Đó là BẢN GHI NGUYÊN VĂN của một vòng thiết kế user đã
  duyệt — cùng luật bất biến với `migration.sql` và entry CHANGELOG cũ, không
  được sửa để lint xanh. `tour-detail.src.html` là *mảnh* HTML từ skill
  brainstorming (không `<!doctype>`, thẻ không cân) nên Biome 2 parse HTML báo
  lỗi ở EOF. Lý do phải ghi ở đây vì `biome.json` là JSON nghiêm ngặt, không
  nhận comment.
- **TUYỆT ĐỐI không sửa file `migration.sql` đã được apply** — kể cả sửa
  comment. Prisma lưu checksum từng migration; đổi một ký tự là drift, và
  `migrate dev` từ chối chạy tiếp. Đã dính 19/07 khi đợt dịch comment sang
  tiếng Việt quét cả `prisma/migrations/`. Migration đã chạy là **bản ghi lịch
  sử bất biến**; muốn đổi gì thì viết migration MỚI. (Khi chạy công cụ sửa
  hàng loạt, luôn loại trừ `apps/api/prisma/migrations/`.) Hệ quả (dính
  08/09, W4): **comment trong `migration.sql` KHÔNG được khai trạng thái
  deploy** ("CHƯA deploy Supabase") — trạng thái đổi theo thời gian còn
  comment thì khoá vĩnh viễn bằng checksum, thành lời nói sai không sửa được;
  trạng thái deploy sống ở `docs/CHANGELOG.md`.
- **`docs/CHANGELOG.md` có dòng bắt đầu bằng `+` là PHÉP CỘNG, không phải bullet**
  — ví dụ một tổng số test bị ngắt dòng thành `… + 5 ui + 76 web` / `+ 188 api)`.
  Mọi formatter markdown (MD004 ul-style) sẽ đổi `+` đầu dòng thành `-`, biến
  một số hạng thành gạch đầu dòng và **nói sai con số đã ghi**; MD032 chèn thêm
  dòng trắng quanh nó. Đã dính 28/07: 9 dấu + 27 dòng trắng bị đổi trong **entry
  cũ** chỉ vì mở CHANGELOG ra rồi save (`.vscode/settings.json` pin formatter
  markdown = extension markdownlint). Các chỗ như vậy nay nằm TRỌN trong
  `docs/changelog/*.md` (archive tách 03/08 — 4 dòng cột 0, cùng luật bất
  biến); file `docs/CHANGELOG.md` chính hiện KHÔNG còn dòng `+` cột 0 nào,
  giữ vậy. **Nhưng đo lại 21/09: rủi ro rộng hơn changelog — 11 file có dòng
  `+` ở cột 0 ngoài code fence**, gồm 4 ADR (0017 · 0032 · 0042 · 0043), 2 bản
  phân tích (`2026-07-21-full-parity-sweep` một mình 37 dòng), 2 plan, 1 spec,
  archive `p3b-static`, và `libs/shared/tokens/README.md`. Tất cả là dòng tiếp
  nối hoặc phép cộng bị ngắt dòng, không phải bullet — mở-rồi-save bất kỳ file
  nào trong số đó là làm sai nghĩa. Vì vậy:
  entry mới **không bao giờ** để `+` ở đầu dòng (viết `và`, hoặc gói cả tổng vào
  một dòng), và **luôn `git diff` file .md trước khi stage** — churn kiểu này
  không hiện ở `pnpm gate` vì Biome bỏ qua `.md` hoàn toàn (đo được:
  `biome check docs/CHANGELOG.md` → "0 files, path ignored"). Entry cũ là **bản
  ghi lịch sử**, cùng luật với `migration.sql`: đừng sửa, kể cả cho lint xanh.
