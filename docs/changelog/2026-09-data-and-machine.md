# CHANGELOG — lưu trữ: dữ liệu trọn năm 2026 và dựng lại máy dev (10/09–15/09/2026)

Seed lại toàn bộ dữ liệu cho trọn năm 2026 rồi đẩy lên Supabase prod, alt text
cho 517 ảnh, dựng lại máy dev sang Windows native, dọn plugin và skill.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 21/09/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`
(đúng cách hai file lưu trữ 03/08 đã làm). Đừng mở-rồi-save bằng editor có
markdownlint: nó đổi `+` đầu dòng thành `-` và nói sai con số test đã ghi.

## 2026-09-15 — Web chỉ gạch giá khi có khuyến mãi thật, navbar hết lệch hydrate, seed-demo-visits trọn năm 2026 (ba nhánh, ff vào `main`)

Ba việc tách ra từ lượt prod 1 (entry dưới). Mỗi việc một nhánh, gộp vào `main`
bằng rebase và fast-forward:

- `766e1889` chore(api): `seed-demo-visits.ts` dời ba cửa sổ ngày, gồm hai cửa sổ
  11–12/2025 và một cửa sổ 01/2026 có `createdAt` (ngày đi − 21 ngày) rơi vào
  12/2025. Nay mọi mốc nằm trong năm 2026: `createdAt` sớm nhất là 06/01/2026, và
  không có hai cửa sổ nào chồng ngày nhau. Script chỉ dành cho dev.
- `63c1fcef` fix(web): navbar ở `/account` hết lỗi "Hydration failed".
  - Nguyên nhân: server không đọc session (ADR-0017 §2) nên HTML luôn là "Log in".
    `useStore` của `better-auth/react` 1.6.23 lại dùng cùng một getter sống làm
    snapshot server, nên island hydrate sau khi `/get-session` trả về sẽ render
    avatar đè lên HTML đó.
  - Cách sửa: `useSession` ở `lib/auth-client.ts` trả trạng thái khởi tạo trong
    lượt render server và lượt hydrate (qua `useSyncExternalStore`), hydrate xong
    mới trả session thật. Island mount khi điều hướng phía client vẫn thấy session
    ngay.
  - Mọi island dùng session đều được sửa theo: `UserMenu`, `VerifyEmailBanner`, hai
    form liên hệ và wishlist.
- `1c1f9251` fix(web): user chốt chỉ gạch giá khi có khuyến mãi thật, thay luật
  "neo cao nhất" của sweep giá 19/08.
  - Giá niêm yết cấp tour (`tour.compareAtPrice`) thôi hiển thị. API, contract và
    dữ liệu giữ nguyên.
  - Luật chung `strikePrice` (`lib/tours.ts`) gạch `basePrice` khi giá khách trả
    thấp hơn nó, hoặc gạch neo riêng của chuyến khi neo cao hơn giá trả, và lấy số
    cao nhất.
  - Card dùng `cardPrice`: chỉ gạch khi `priceFrom < basePrice`. Trang chi tiết,
    `/book` và `/enquire` áp luật qua `resolveDepartureAnchors` trong
    `fetchTourDetail`.
  - `discountPercent` tính trên số xu nguyên. Chia số thực làm (35 − 28,35)/35 ra
    18,99…, làm tròn xuống thành 18% thay vì 19%.

Commit docs kèm theo cho `.gitignore` bỏ qua `.claude/worktrees/`, nơi chứa
worktree tạm của subagent. Biome đọc `.gitignore`, nên `pnpm lint` không quét
trúng chúng nữa.

**Tác động trên dữ liệu prod** (truy vấn chỉ đọc ngày 15/09): trong 29 tour đang
bán, số tour có badge giảm giá từ 22 còn 14.

- 12 tour mất badge vì chỉ có giá niêm yết.
- 4 tour có khuyến mãi thật mà card cũ không hiện, nay có badge:
  `ben-tre-coconut-day`, `hanoi-heritage-day`, `phong-nha-paradise-cave-day`,
  `sapa-fansipan-summit-3d`.
- Card "Hanoi Old Quarter Street Food by Night" trước in "$28 was $42 −32%"; theo
  giá hôm đó sẽ in $29, gạch $35, −16%.

**Review findings:**

- Controller review cả hai nhánh web: không có lỗi nào chặn merge.
- Đã rà năm chỗ gọi `useSession`, không có hồi quy. Form liên hệ điền tên qua
  effect theo `session`, còn wishlist hỏi lại khi `signedIn` đổi, nên session về
  sau lượt hydrate vẫn chạy đúng.
- Card và trang chi tiết còn có thể lệch nhau ở ba ca, nhưng ngày 15/09 prod không
  có ca nào:
  - `priceFrom` của API tính cả chuyến OPEN đã hết chỗ, còn hero chỉ xét chuyến
    còn chỗ.
  - Chuyến rẻ nhất có neo riêng cao hơn `basePrice`.
  - Mọi chuyến có giá trên `basePrice` và mang neo riêng.

  Hai ca sau chỉ xảy ra khi admin sửa tay, seed không sinh ra.
- `region-day-trips` in `basePrice` thay vì `priceFrom`. Lỗi này có từ trước,
  chưa sửa.
- Bản sửa hydration mới kiểm trên app chạy thật với `/get-session` giả lập, chưa
  kiểm bằng đăng nhập thật.

**CÒN TREO:**

- Sau khi Vercel deploy, user đăng nhập, mở `/account` và xem Console không còn
  "Hydration failed".
- Tuỳ user quyết: sửa `priceFrom` của API để bỏ qua chuyến hết chỗ, cho card khớp
  hero.
- Còn từ entry dưới: lượt prod 2 khoảng 03/11 (nhắc việc đặt 02/11, 09:00).

Tests after: `gate:int` xanh ở `1c1f9251` dưới watchdog, commit trống thấp nhất
12,10 GB.

- Unit 3627 test (web 1518 · api 809 · admin 918 · contract 255 · mobile-ui 52 ·
  mobile 29 · ui 22 · tokens 18 · i18n 6), cùng test:int 496.
- Build 7/7 · typecheck 13/13 · tokens-only ✓.
- Biome kiểm 1130 file git theo dõi, không lỗi. Lượt `biome check .` đầu tiên đỏ,
  không phải do code: Biome quét cả hai worktree tạm của agent trong
  `.claude/worktrees/`, mỗi worktree có `biome.json` riêng.

## 2026-09-15 — Seed trọn năm 2026 xong và lượt prod 1 (nhánh `chore/seed-buoc1-snapshot`, ff vào `main`)

Thi công đủ 11 task của [plan 14/09](../plans/2026-09-14-seed-khung-2026.md) theo
[spec 14/09](../specs/2026-09-14-seed-khung-2026-design.md). Mọi dòng seed nằm trong
01/01–31/12/2026 và trước mốc "hôm nay" H (`SEED_HOM_NAY`). Bộ sinh là hàm thuần
nhận H. Hình dạng huỷ và hoàn tiền khớp luồng thật của app. Có thêm enquiries và
subscribers.

**Chốt chặn trước khi ghi:**

- mốc H hợp lệ;
- sàn booking đã đi và sàn review, ném lỗi lúc import;
- prod có đúng một admin trùng `ADMIN_EMAILS[0]`;
- không seed chồng thế hệ H khác;
- mật khẩu khách giả trên prod phải là giá trị riêng, đặt trong `.env.production`.

`data:reset` kiểm admin prod trước khi xoá. `seed:verify` là script chỉ đọc, kiểm
100 bất biến.

**Lượt prod 1 (H = 2026-09-15), user xác nhận từng bước:**

- Tập dượt trên database Docker tạm với đúng H.
- `snapshot:export` sinh `docs/snapshots/2026-09-15/`; bản sao có PII nằm ở
  `backups/`, gitignored.
- `data:reset --apply` xoá 1992 dòng trong một transaction, 01:05:29–01:05:39
  UTC; không ảnh mồ côi, giữ nguyên admin.
- `db:seed` chạy 01:05:39–01:07:53 UTC, ghi:
  - 120 khách giả, 689 booking, 709 payment event, 36 refund, 26 yêu cầu huỷ;
  - 119 review, 66 enquiry kèm 93 ghi chú và 141 sự kiện trạng thái;
  - 174 subscriber.
- `seed:verify` báo 0 vi phạm trên 100 bất biến.
- Truy vấn chỉ đọc: 1 admin, outbox 0 PENDING, 0 dòng lệch khung năm.
- Web và api trả 200; admin trả 307 sang trang đăng nhập.
- User tự kiểm các trang admin trên prod: ổn.

**Review findings:**

- Review từng task, kèm ba phần bổ sung cho Task 9. Sàn review và sàn booking đỏ
  ở các mốc H sớm; nguyên nhân gốc là bốc khách không loại người đăng ký muộn.
- Review cuối cả nhánh báo 1 Critical: admin ma trên prod, vì `db:seed` đọc
  `ADMIN_EMAILS` của `.env.local`. Kèm 2 Important: seed chồng thế hệ H, và tài
  liệu vận hành chưa ghi hành vi fail-closed.
- Rà độ phủ nhánh được 90,3%, sau đó thêm test cho các nhánh ép được. Còn 5 vặt
  ở vòng dư (R1–R5), trong đó runbook phải tách shell tập dượt Docker khỏi shell
  prod.
- Tất cả đã vá, kèm re-review.
- Sau lượt prod, user bắt được menu tháng `/reports` còn bày 10–12/2025. Đã vá bằng
  sàn cố định 01/2026 (`REPORTS_FIRST_MONTH`, spec Q10); `?month=` trước mốc rơi
  về tháng hiện tại.
- `.env.production` mang CRLF, nên lệnh export trong runbook và `CLAUDE.md` thêm
  `tr -d '\r'`.
- Hash `736d1a68` trong entry 10/09 là bản trước rebase, nay là `1e000074`.

**Ngoài phạm vi, đã tách task:** `seed-demo-visits.ts` còn cửa sổ 11–12/2025;
hydration mismatch ở `UserMenu` khi đã đăng nhập. Badge "−32%" trên card tour là
do `tours.compare_at_price` của catalog chồng lên khuyến mãi của chuyến, để user
quyết định.

**CÒN TREO:**

- Lượt prod 2 khoảng 03/11 theo spec §8.5, entry riêng.
- Menu `/reports` trên prod đổi sau khi Vercel deploy `main`.
- Mật khẩu demo mặc định cũ vẫn nằm trong lịch sử git, nhưng prod đã dùng mật
  khẩu riêng.

Tests after: `gate:int` xanh ở `ce576894` dưới watchdog, commit trống thấp nhất
13,74 GB. Unit 3610 test (api 809 · web 1501 · admin 918 · contract 255 · mobile-ui
52 · mobile 29 · ui 22 · tokens 18 · i18n 6), cùng test:int 496. Build 7/7 ·
typecheck 13/13 · Biome 1129 file · RLS ✓ · tokens-only ✓.

## 2026-09-14 — Luật 9 bỏ viện dẫn hook nhắc-skill đã mất

Đợt dọn plugin (entry dưới) để lại một chỗ doc lệch thực tế: **CLAUDE.md luật 9**
vẫn viện dẫn "hook nhắc-skill chỉ chạy khi user gửi tin" — hook đó mất theo
`~/.claude/settings.json` cũ khi reset máy. User chọn sửa luật thay vì dựng lại
hook: lời nhắc tự động hiện có là hook SessionStart của plugin `superpowers` (bơm
`using-superpowers`), mà skill đó có khối `SUBAGENT-STOP` dặn subagent bỏ qua, nên
vế "brief subagent phải nhắc" vẫn giữ nguyên lý do.

Soát thêm doc còn trỏ tới plugin đã gỡ: chỉ prompt P5a
(`docs/plans/2026-09-08-p5a-prompt-thi-cong.md`) dặn dùng skill `expo:*`, nhưng P5a
đã merge 09/09 nên để nguyên như bản ghi; phần P5 còn lại cài `expo` theo bảng
"Cài theo phase" của `docs/skills.md`.

**Đóng từ entry dưới:** hook nhắc-skill của luật 9 (sửa luật); `superpowers` đã nạp
(session hiện tại liệt kê đủ 14 skill kèm mô tả; danh sách skill còn 54 mục, không
mục nào mất mô tả).

**Vẫn CÒN TREO:** tắt auto-update marketplace trước freeze 15/10 · xung đột
connector #1 và #2 · plugin Desktop "Plugin Management" còn sót · các mục chưa đóng
của entry "Dựng lại máy dev" (doc Nexora và luật 10, dev loop WSL ở
`docs/conventions/mobile-dev-loop.md` và ADR-0040, workflow Audit đỏ).

Tests after: chỉ đổi file `.md`; `docs-freshness` xanh.

## 2026-09-14 — Dọn sạch plugin/skill rồi cài lại có chọn lọc (nhánh cloud `claude/tender-heisenberg-4tdw2k` vào `main` thành `a1eb1e68`)

Rà tại máy (không phải từ session remote) cho thấy máy nạp 39 plugin: 32 cài qua
CLI và 7 cài từ Desktop App. Danh sách skill mỗi session có 302 mục, vượt ngân
sách listing (1% context), nên 211 mục chỉ còn tên, mất mô tả — gồm cả 14 skill
`superpowers` mà quy trình dựa vào. `remember` và `security-guidance` fail âm thầm
vì máy chưa có Python thật (`remember` hỏng 71/71 lần save); MCP của 11 dịch vụ bị
trùng giữa plugin và connector claude.ai. User chốt gỡ sạch rồi cài lại chỉ thứ dự
án cần, đi từng bước có xác nhận.

**Ngoài repo (máy):** gỡ 32 plugin CLI; user gỡ 6 plugin Desktop (còn Plugin
Management) và tắt 11 skill tài khoản (còn `docx`, `pptx`, `xlsx`, `pdf`,
`skill-creator`, `doc-coauthoring`); dọn tay cache plugin, thư mục data và
`.remember/`; khởi động lại Claude Desktop để nhận PATH có Node 24; cài lại đúng
một plugin là `superpowers` 6.3.0.

**Trong repo:**

- `a1eb1e68` — commit của session cloud trên nhánh `claude/tender-heisenberg-4tdw2k`
  (mục CÒN TREO của entry dưới), rebase lên `main` rồi `--ff-only`: gỡ 5 skill hết
  việc và 2 entry rác trong lockfile.
- Commit này: thêm `nextjs`, `next-cache-components`, `react-best-practices` lấy lẻ
  từ `vercel/vercel-plugin` bằng `npx skills@1.5.26 add … -a claude-code --copy`,
  repo còn 11 skill. Không cài plugin `vercel` vì 33 skill tốn khoảng 2,3K token mỗi
  session và bundle một `shadcn` không có patch monorepo. `docs/skills.md` ghi lại
  bốn kênh phân phối, plugin còn lại, lịch cài theo phase và kết quả đánh giá 10
  repo user đề xuất.

**Review findings:** `docs/skills.md` cũ ghi Sentry "nối thật" nhưng
`observability.ts` mới là seam, chưa cài `@sentry/node` — đã sửa. Repo nguồn có bản
`upstream/` của `next-cache-components` trùng tên; CLI chọn bản chính (487 dòng),
đã đối chiếu. Auto mode chặn việc chuyển cache vào Thùng rác nên user xoá tay.

**Đóng từ entry dưới:** review nhánh cloud (merge `a1eb1e68`), `gh` đã đăng nhập,
Claude Desktop đã khởi động lại.

**CÒN TREO:** tắt auto-update marketplace `claude-plugins-official` trước freeze
15/10 · xung đột #1 và #2 trong `docs/skills.md` (write-tool của connector
Supabase, Render, Vercel, Resend ở chat thi công) vẫn mở · hook nhắc-skill của
luật 9 vẫn chưa có lại · mở session mới để xác nhận `superpowers` nạp.

Tests after: không đụng `apps/` hay `libs/` nên không chạy gate:int; `biome check`
lockfile sạch, `docs-freshness` xanh, lockfile khớp 11 thư mục skill.

## 2026-09-14 — Dựng lại máy dev sau reset: Windows native, `.env.local` về Docker, ghim tên project compose

Máy dev bị reset (~12/09) nên cài lại từ đầu; clone mới nằm ở
`C:\Programming\Devs\Projects\Tourism-Platform-V2`, KHÔNG còn trong WSL. User chốt
ở lại Windows native và Node 24 LTS (khớp CI và Dockerfile). Đợt này chỉ làm
setup, chưa đụng việc seed. Trước đó một session cloud chạy nhầm đã đẩy
`11b49d6d` (rà soát skill/connector) và để nhánh `claude/tender-heisenberg-4tdw2k`
gỡ 5 skill, chờ review.

**Công việc seed tuần trước KHÔNG mất:** `origin/chore/seed-buoc1-snapshot` còn đủ
35 commit (09/09 → 10/09 15:44) và vẫn chưa merge; các mục CÒN TREO trong ba entry
10/09 của nhánh đó giữ nguyên.

**Sửa trong repo:**

- `compose.yaml` ghim `name: tourism-v2`. Compose lấy tên THƯ MỤC clone làm tiền
  tố, nên clone `Tourism-Platform-V2` sinh container `tourism-platform-v2-postgres-1`,
  và `scripts/check-rls.sh` (máy không có `psql` thì `docker exec tourism-v2-postgres-1`)
  làm đỏ 2 test của `check-rls.int.spec.ts`. Ghim ở gốc giữ đúng tên mà script và
  7 plan/spec đang gọi; spec chạy lại 2/2 xanh.
- `.vscode/settings.json` pin thêm `[css]` → Biome và tắt format-on-save cho
  `[html]`: settings global của máy mới pin Prettier cho html (mockup `*.src.html`
  là bản ghi bất biến) và formatter built-in cho css (lệch `biome check`).
  `.vscode/extensions.json` bỏ `remote-wsl`, gợi ý đủ bốn extension mà settings
  đang pin, khai Prettier và ESLint là không mong muốn.
- CLAUDE.md: gotcha WSL thành gotcha Windows native kèm bốn bẫy đo được
  (script-shell Git Bash, `bash` trong PowerShell là launcher WSL, PATH chụp lúc
  app mở, `guard-build.mjs` tự bỏ qua ngoài Linux); gotcha Prisma trỏ
  `.env.production` thay cho `.env.local`. README cập nhật mục Yêu cầu.

**Ngoài repo (máy):** `pnpm config set script-shell` sang Git Bash;
`apps/api/.env.local` đổi `DATABASE_URL` về Postgres Docker đúng như `.env.example`
dặn. Bản khôi phục đang trỏ thẳng Supabase prod, tức `pnpm dev`, `db:seed`,
`db:migrate` ở máy đều chạm prod; chuỗi Supabase nay chỉ còn ở `.env.production`.

**Tài nguyên:** user báo máy từng phình RAM và ổ đĩa khi chạy gate:int. Máy 31,6 GB
RAM nhưng commit trống lúc thường chỉ ~7–10 GB, pagefile để Windows tự quản. Lượt
gate:int dưới đây chạy theo thứ tự CI, API tạm cho build web trỏ Postgres Docker
(không nạp `.env.local`), hãm song song (build 1, typecheck 3, test 2 với
`--maxWorkers=4`) và có watchdog: xanh sau 8,5 phút, commit trống thấp nhất
4,48 GB, pagefile đứng yên 5120 MB, ổ C giảm 0,6 GB.

**Ba phát hiện ngoài phạm vi, nêu để khỏi rơi:**

- Workflow **Audit** (lịch thứ Hai) đỏ 14/09 trên `11b49d6d`: 2 high `image-size`
  ≤2.0.2 (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq) và 1 moderate
  `decode-uri-component` ≤0.4.2 (GHSA-vcc3-ghjq-m6fr), đều bắc cầu qua
  `apps/mobile` và `libs/mobile/ui`. CI của `11b49d6d` xanh.
- `biome check` còn 3 chẩn đoán không chặn (1 warning, 2 info) có từ trước:
  `isValidDate` không dùng ở `apps/admin/src/lib/date-field.ts`, `useIndexOf` ở
  `wizard-steps.tsx`, một khoá deprecated ở `biome.json:39`.
- `gh` chưa đăng nhập trên máy mới; đèn CI của đợt này đọc qua API công khai của
  GitHub.

**CÒN TREO:** `gh auth login` · khởi động lại Claude Desktop và VS Code để nhận PATH
có Node 24 · review nhánh `claude/tender-heisenberg-4tdw2k` · chỉnh doc Nexora
(luật 10, đường dẫn `/mnt/c/...`) vì user chốt không clone lại repo tham chiếu ·
hook nhắc-skill của luật 9 mất theo `~/.claude/settings.json` cũ ·
`docs/conventions/mobile-dev-loop.md` và ADR-0040 vẫn mô tả dev loop trong WSL.

Tests after (Node 24.21.0): test:int 5/5 task, api 496 int · build 7/7 · typecheck
13/13 · test 13/13 gồm web 1501, admin 913, api 463 unit, contract 255, mobile-ui
52, mobile 29, ui 22, tokens 18, i18n 6 · biome 1085 file · tokens-only và
admin-prerender xanh. Mobile `bundle` không nằm trong gate, chưa chạy.

## 2026-09-10 — Seed toàn bộ dữ liệu mới lên Supabase PROD (nhánh `chore/seed-buoc1-snapshot`, **CHƯA merge**)

**ĐÃ CHẠY THẬT TRÊN PROD**, 132 giây, exit 0. Nối tiếp đợt dọn cùng ngày.

Chèn **1.864 dòng**: 120 khách giả + 120 credential account · 261 chuyến khởi
hành · 567 booking · 582 payment event · 31 refund · 45 yêu cầu huỷ · 120 review
`VERIFIED` · 111 sự kiện duyệt · 131 dòng giá vốn. Cộng 25 FAQ và 9 link địa
danh mà bản prod cũ còn thiếu (120→145, 43→52).

**Thứ tự bắt buộc, không phải sở thích:** giá vốn → khách → chuyến → booking +
thanh toán → hoàn tiền/huỷ → review. `cost_per_person` là SNAPSHOT chụp lúc tạo
booking; seed booking trước khi có giá vốn thì cả 567 dòng mang NULL vĩnh viễn
và không tự lành. Review đứng cuối vì CHECK `reviews_source_shape` cấm review
`CURATED` mang `user_id`, nên review đứng tên khách phải là `VERIFIED`, mà
`VERIFIED` đòi một booking thật phía sau.

**Đợt rà 8 chiều trước khi đẩy** (8 agent song song trên docker, 69 phát hiện,
13 nặng). Hai agent phản biện chết vì hết hạn mức phiên nên từng khẳng định nặng
được kiểm chứng lại bằng SQL tay: 6 đúng, 1 sai (byline blog — seed chỉ
`update: { role }` nên không ghi đè tên tác giả). Bảy lỗ hổng đã vá trước khi
chạy prod, trong đó ba cái sẽ hỏng đúng buổi bảo vệ nếu để nguyên:

- Dữ liệu tiền dừng ở 03/09, cách "hôm nay" đúng 7 ngày — sàn lead time 7 ngày
  cộng trần HOM_NAY. Cửa sổ 7 ngày của dashboard rỗng ngay hôm nay, và tới
  11/11 thì cửa sổ 28 ngày về 0 ở mọi ô.
- 4 booking huỷ và hoàn tiền TRƯỚC khi trả tiền; sổ webhook hiện sự kiện hoàn
  nằm trên sự kiện thu của cùng một đơn.
- 5 booking trùng y hệt (cùng khách, cùng chuyến, cùng ngày, cả hai PAID) và 20
  cặp khách đi hai tour ở hai đầu đất nước cùng một hôm.
- `phu-quoc-honeymoon-4d` rao "from $480.57, −26%" trong khi chuyến đó đã 6/6;
  giá mua được thật là $579.
- Chỉ 2/5 trạng thái booking và hàng đợi huỷ trống (0 REQUESTED, 0 DENIED).
- `db:seed` ghi thẳng lên prod không chốt chặn, khác hẳn `data:reset` và
  `media:alt`. Nay đòi cờ `--toi-biet-day-la-production`.

**Nghiệm thu trên chính prod sau khi seed — 14/14 bất biến bằng 0:** booking
thiếu `cost_per_person` · `total` lệch đơn-giá×ghế · huỷ trước khi trả tiền ·
trả tiền sau ngày đi · trả tiền ở tương lai · booking trùng khách+chuyến · khách
chồng lịch · overbooking · ghế lệch booking PAID · chuyến quá khứ còn OPEN ·
review CURATED còn lại · review thiếu user/booking · review viết trước khi chuyến
xong · tour không có rating.

`tour_cost_items` trên prod đúng **131** — 131 dòng rác chỉ có trên docker không
lan sang. Đúng một admin còn lại. P&L có đủ 12 tháng liên tục, biên gộp 38–42%.
29/29 tour còn chuyến bán được. Rating 3,6–4,8 (trung bình 4,39).

**Rò rỉ review chưa duyệt: KHÔNG.** Đối chiếu API với DB trên cả 9 tour có review
chưa duyệt — API trả đúng số đã duyệt ở từng tour, 11 dòng chưa duyệt không lọt
ra ngoài dòng nào.

**Trang thật:** 10/10 trang HTTP 200, alt còn đủ, "No departures" biến mất. ISR
`revalidate = 300` tự sinh lại, không cần redeploy — nhưng phải gọi mỗi URL hai
lần vì stale-while-revalidate trả bản cũ ở lần đầu.

**CÒN TREO:** nhánh `chore/seed-buoc1-snapshot` vẫn chưa merge, nên prod đang
mang dữ liệu mà nguồn của nó còn nằm ngoài `main`. Mật khẩu chung của 120 khách
giả đọc từ `SEED_CUSTOMER_PASSWORD`. Bốn màn admin vẫn trống (enquiries,
subscribers, wishlist, chat) vì không bước seed nào dựng lại chúng.

Tests after: typecheck + test api 6/6 xanh; seed chạy lại trên docker +0 mọi bảng.

## 2026-09-10 — Dọn sạch tầng vận hành trên Supabase PROD (nhánh `chore/seed-buoc1-snapshot`, **CHƯA merge**)

**ĐÃ CHẠY THẬT TRÊN PROD.** User chốt dọn trước rồi seed lại, không seed chồng
lên nền cũ — vì seed chồng thì không phân biệt được dòng nào mới, dòng nào là
tàn dư, và khách hàng cũ dễ bị dùng lại một cách vô tình.

Xoá **1010 dòng / 19 bảng** trong MỘT transaction, thứ tự con-trước-cha suy từ
`pg_constraint`: payment_events 197 · outbox 137 · bookings 159 · tour_departures
144 · reviews 85 · sessions 74 · users 62 · accounts 61 · wishlist 51 ·
cancellation_requests 16 · refunds 13 · review_moderation_events 5 · enquiries 3
· subscribers 2 · verifications 1. Không xoá `users` đầu tiên được: ba khoá
RESTRICT `bookings.user_id`, `cancellation_requests.user_id`, `posts.author_id`
chặn — nên 9 bài blog được `UPDATE author_id` sang admin giữ lại TRƯỚC, giữ
nguyên uuid để 9 ảnh hero không mồ côi.

Giữ nguyên **982 dòng / 16 bảng**: 517 media_assets (alt còn đủ 517/517), 29
tour và 8 bảng con, 9 bài blog, 52 khe site media. Sau khi xoá: 0 ảnh mồ côi ·
1 admin · 9 bài blog cùng một tác giả · 0 tour còn rating mồ côi.

**Hai bản vá công cụ đi kèm** (`1e000074`). `export-snapshot.mjs` chưa bao giờ
sinh `keep-list.json` — file ấy viết tay một lần hồi 09/09 — trong khi
`reset-operational-data.mjs` trỏ CỨNG vào thư mục `2026-09-09/`. Ghép hai lỗi:
xuất snapshot mới bao nhiêu lần thì bước xoá vẫn im lặng đọc bản cũ. Nay export
sinh keep-list, reset đọc thư mục mới nhất.

Bản nháp đầu của khối chọn admin dùng heuristic "ADMIN cũ nhất" và chọn NHẦM
`admin@tourism.test` (rác của seed) thay vì tài khoản gmail thật — chạy reset
với nó là xoá đúng tài khoản đang dùng, và không có lỗi nào được ném ra. Thay
bằng chuỗi quyết định tường minh: `GIU_ADMIN_EMAIL` → `ADMIN_EMAILS[0]` →
keep-list lần trước nếu admin đó còn → đúng một ADMIN thì lấy nó → không thì
DỪNG và in danh sách để người chọn.

Backup trước khi xoá: `docs/snapshots/2026-09-10/` (631 dòng, commit được) và
`backups/2026-09-10/` (1065 dòng có PII, gitignored). 84 review curated không
mất chữ nào — prose đã nằm sẵn trong `prisma/fixtures/catalog/reviews.ts`.

**Trạng thái site sau khi dọn:** mọi trang HTTP 200, alt đủ, trang tour hiện
"No departures" đúng kiểu trạng thái rỗng có xử lý. Site KHÔNG đặt được tour và
không có sao đánh giá cho tới khi seed xong — đây là cái giá đã ghi ở spec §9.

**CÒN TREO:** `ADMIN_EMAILS` trên Render phải khớp email admin trong keep-list
TRƯỚC khi chạy seed, nếu không seed đẻ ra admin thứ hai. Thứ tự seed ở
[spec §6.2](../specs/2026-09-10-seed-lich-van-hanh-2026-design.md): giá vốn → khách
giả → chuyến → booking + payment → refund + huỷ → reviews.

Tests after: không chạy test (thao tác dữ liệu, không đổi code sản phẩm); script
reset đã đo 5 kịch bản trên docker trước đó, kèm 2 test âm.

## 2026-09-10 — Alt text cho toàn bộ 517 ảnh, đã ÁP LÊN SUPABASE PROD (nhánh `chore/seed-buoc1-snapshot`, **CHƯA merge**)

Trước đợt này cả **517 dòng `media_assets` đều có `alt = NULL`**. Web có đường
rơi-về `alt={image.alt ?? ''}` nên trang không vỡ, nhưng trình đọc màn hình chỉ
nghe được tiêu đề cạnh ảnh chứ không biết trong ảnh có gì — và Google cũng vậy.

**Nguồn sự thật là fixture, không phải DB.**
`apps/api/prisma/fixtures/media/alt-text.ts` giữ **241 câu khoá theo `publicId`**.
Khoá theo publicId chứ không theo id dòng vì gallery tour MƯỢN ảnh địa danh: 276
dòng tour dùng chung 137 publicId với gallery địa danh. Alt tả NỘI DUNG ảnh, mà
nội dung giống nhau dù treo ở trang tour hay trang địa danh — nên 241 câu phủ
trọn 517 dòng, và không bao giờ lệch nhau giữa hai chỗ.

**Mỗi câu viết sau khi NHÌN ảnh thật**, tải từ Cloudinary ở `w_500,q_auto,f_jpg`
rồi mở ra xem, không suy từ slug hay tiêu đề tour. Đây không phải câu nệ: ba hero
tour nói một đằng ảnh một nẻo — `vietnam-grand-journey-12d` là đường đèo cua tay
áo trong sương, `red-river-craft-villages-day` là gian xưởng gốm tối đầy kệ mộc
chưa nung, `saigon-cu-chi-day` là Dinh Độc Lập chứ không phải địa đạo. Alt suy từ
tiêu đề sẽ nói sai cả ba, mà người dùng trình đọc màn hình không có cách nào
kiểm chứng. Alt đoán mò hại hơn alt trống.

**Script áp: `apps/api/scripts/apply-alt-text.mjs`** (`pnpm --filter @tourism/api
media:alt`). Chạy khô là mặc định. Bốn chốt chặn: alt ngắn dưới 20 hoặc dài quá
300 thì dừng; key không khớp dòng nào trong `media_assets` thì dừng (fixture lệch
DB thì thà không áp còn hơn áp nửa vời); đích Supabase đòi cờ tường minh
`--toi-biet-day-la-production`; số dòng có alt mà GIẢM sau khi chạy thì rollback.
`alt IS DISTINCT FROM` nên chạy lại ghi 0 dòng.

**Đã deploy Supabase 10/09.** User chủ động yêu cầu bỏ qua §15 cho bước này —
§15 nằm trong nhóm "bất di bất dịch trừ khi user nói khác", và đây là UPDATE một
cột đang toàn NULL, có transaction, có đường lùi một câu `SET alt = NULL`.
Đo trên prod: chạy khô 517 → áp 517 → chạy lại 0. Đối chiếu lại từng dòng với
fixture: **0/517 lệch**, 0 publicId có alt không đồng nhất giữa các dòng.

**Trang thật đã ăn mà KHÔNG cần redeploy** — các trang catalogue khai
`revalidate = 300` nên ISR tự sinh lại. Bẫy đo: stale-while-revalidate trả bản
CŨ ở lần gọi đầu sau khi hết hạn rồi mới sinh lại ở nền, nên lần gọi thứ nhất
vẫn thấy `alt=""` và tưởng hỏng; lần thứ hai mới ra bản mới. Quét 13 trang sau
khi ổn định: **145 thẻ alt có chữ, 0 thẻ rỗng**.

Hai thứ chỉ lộ ra khi ngồi xem hết ảnh, ghi lại để quyết sau chứ đợt này không sửa:
bốn slot `about-team-*` là avatar robot pixel-art chứ không phải ảnh người (trang
About đang giới thiệu đội ngũ bằng robot), và `about-story` là ảnh xe camper van
cổ bên bờ biển hoàng hôn, không có chi tiết nào của Việt Nam.

**CÒN TREO:** nhánh `chore/seed-buoc1-snapshot` chưa merge, nên prod hiện mang dữ
liệu mà nguồn của nó còn nằm ngoài `main` — đúng khoảng "lệch pha" §15 cảnh báo.
Merge sớm để đóng lại. Các bước seed còn lại (xoá tầng vận hành, người dùng giả,
`ADMIN_EMAILS`) vẫn chưa chạy.

Tests after: gate xanh 25/25 task (build + typecheck + unit + lint, có API tạm
trên docker cho build web); script áp đo 5 kịch bản trên docker gồm 2 test âm
(đích Supabase không cờ, key không khớp DB) đều chặn đúng.
