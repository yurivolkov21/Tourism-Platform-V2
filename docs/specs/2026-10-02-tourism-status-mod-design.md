# Spec — Mod `tourism-status`: dải trạng thái, canh CI, docs-freshness

- **Ngày:** 2026-10-02 · **Trạng thái:** thiết kế duyệt qua bốn phần trong chat cùng ngày;
  chờ user duyệt spec. Plan thi công chưa viết.
- **Loại việc:** công cụ làm việc trên máy dev, KHÔNG phải code sản phẩm. Mod nằm ngoài repo
  ở `C:\Programming\Devs\claude-mods\tourism-status\` (git cục bộ riêng); repo chỉ giữ spec
  và plan này để chúng có trong bản đồ tài liệu.
- **Không viết ADR:** luật 5 áp cho quyết định kiến trúc của dự án. Mod không đổi code,
  dependency, CI hay hạ tầng nào của repo, và gỡ được bằng cách xoá hai biến môi trường.
  Nếu sau này đưa mod vào repo (hướng B ở §2) thì lúc đó mới cần ADR.
- **Nền:** CLAUDE.md luật 13 (docs sweep), luật 14 (liếc CI sau push) · memory "Hãm tài
  nguyên khi chạy việc nặng" (ngưỡng RAM) · memory "Session song song dùng chung worktree" ·
  tài liệu API mod đi kèm Claude Code 2.1.286 (`plugin-authoring`).

## 1. Mục tiêu & phạm vi

### Vấn đề

Khai thác transcript của 26 phiên (14/09–02/10/2026: 546 prompt, 8.900 lệnh shell) cho thấy
ba việc Claude lặp lại ở gần như mọi phiên, toàn bằng tay:

| Việc lặp lại | Bằng chứng |
| --- | --- |
| Định hướng đầu phiên | Trong 15 lệnh đầu của 24 phiên có dùng shell: 15 phiên chạy `git log`, 12 phiên `git status`, 9 phiên `docker ps`, 6 phiên kiểm `.env.local` |
| Canh CI sau push (luật 14) | `gh run list/watch/view` 209 lần trong 11 phiên; riêng một phiên 115 lần |
| Docs sweep sau merge (luật 13) | Đụng `CHANGELOG` ở 18 phiên; chạy `docs-freshness.sh` ở 16 phiên |

Thêm một bối cảnh: ở 155 trong 466 khung 15 phút có từ hai phiên chạy cùng lúc (nhiều nhất
năm phiên), nên trạng thái đọc được vài phút trước dễ đã cũ.

### Trong phạm vi

- **Dải trạng thái** một dòng trên ô prompt, gồm bốn nhóm mục: git và CI, môi trường dev, tài
  nguyên máy, phiên song song và freeze (§3).
- **Canh CI sau mỗi lần Claude push**, báo bạn bằng toast, báo Claude bằng ghi chú; CI đỏ thì
  mod mở một lượt để Claude đọc log và báo nguyên nhân (§4).
- **Docs-freshness ba chốt:** nhắc lúc ff-merge vào `main`, kiểm trước khi push lên `main`, CI
  là lưới cuối (§4.5).

### Ngoài phạm vi, cố ý

- **Chặn lệnh** (`HEAD:main`, `git add -A`, sửa `migration.sql` đã lên `main`, lệnh đụng prod
  ở nhánh thi công, `pnpm add` sau freeze): nhóm "Rào chắn", spec riêng. Mod này chỉ đọc, kể
  cả khi biết push sắp làm CI đỏ.
- **Thử tay từng bước, tự thử lại khi lỗi API hay hết hạn mức:** nhóm "Phối hợp", spec riêng.
- **Gate có hãm và watchdog, dọn dẹp sau việc:** nhóm "Việc nặng", spec riêng.
- **Push bạn tự gõ trong terminal riêng:** mod không thấy (nó chỉ nghe tool của Claude); dải
  vẫn hiện CI của `main` nhờ lượt làm mới định kỳ.
- **Tự sửa CI đỏ, tự viết entry CHANGELOG:** việc cần phán đoán, để Claude làm khi bạn duyệt.
- **Dùng chung cho cả nhóm:** lệnh và ngưỡng theo máy Windows của bạn.

### Tiêu chí thành công (đo ở bước 5, §7)

- Số lần Claude tự gọi `gh run` sau mỗi push về gần 0.
- Số lệnh định hướng trong 15 lệnh đầu phiên giảm rõ so với bảng trên.
- Không còn lần push nào lên `main` mà CI đỏ ở bước docs-freshness.

## 2. Kiến trúc & vòng đời

### Nơi đặt (hướng A, user chọn)

| Hướng | Kết luận |
| --- | --- |
| **A. Thư mục riêng ngoài repo, nạp cho mọi phiên** | **Chọn.** Không đụng repo, CI, freeze; không ép thành viên khác |
| B. Trong repo ở `.claude/skills/<mod>/` (engine tự nạp) | Bỏ: phải qua nhánh, review, CI; lệnh `pwsh` và ngưỡng theo máy bạn sẽ lỗi ở máy khác; thêm đồ vào repo sát freeze |
| C. Chỉ trong dev-mods của một phiên | Bỏ: mất khi đóng phiên; chỉ dùng làm chỗ dựng |

### Cấu trúc một plugin

Ba việc gom một plugin vì dùng chung dữ liệu (CI vừa là mục của dải vừa là thứ được canh).
Các nhóm sau mỗi nhóm một plugin để bật tắt độc lập.

```text
tourism-status/
├── .claude-plugin/plugin.json   # name, version, "types": "./types/index.d.ts"
├── hooks/hooks.json             # { "modules": ["./register.tsx"] }
├── hooks/register.tsx           # chỉ nối dây: đăng ký hook, hẹn giờ
├── src/config.ts                # ngưỡng, nhịp, đường dẫn, ngày freeze
├── src/collect/                 # git.ts, ci.ts, env.ts, machine.ts, peers.ts — gọi $.process/$.http/$.fs
├── src/logic/                   # logic thuần (§6), không gọi $
├── src/band.tsx                 # vẽ dải từ $.state
├── src/ci-watch.ts              # canh CI, docs-freshness, thông báo
├── types/index.d.ts             # hợp đồng $.state
└── tests/*.test.ts              # claude plugin test
```

**Luồng một chiều:** `collect` chạy lệnh → `logic` biến output thành dữ liệu sạch → ghi
`$.state` → `band.tsx` đọc để vẽ; engine tự vẽ lại khi state đổi. Không file nào vừa chạy
lệnh vừa vẽ.

### Hợp đồng `$.state` (phác)

```ts
// Một lớp dữ liệu cho mỗi nhóm mục; mỗi nhóm có giờ cập nhật và lỗi riêng
type Section<T> = { value?: T; updatedAt: number; error?: string }

// Một lần canh CI cho một SHA vừa đẩy; wokeAt có giá trị là SHA này đã đánh thức Claude
type CiWatch = {
  sha: string; branch: string; pushedAt: number; runId?: number
  phase: 'waiting' | 'running' | 'done'; outcome?: string; wokeAt?: number
}

interface PluginState {
  'tourism-status': {
    snapshot: {
      git: Section<{ branch: string; ahead: number; behind: number; dirty: number; onMain: boolean }>
      ci: Section<{ status: 'queued' | 'in_progress' | 'completed'; conclusion?: string; sha: string; url: string; medianMinutes: number }>
      env: Section<{ db: 'up' | 'unhealthy' | 'down'; api: 'up' | 'down'; envMissing: string[] }>
      machine: Section<{ commitFreeGB: number; diskFreeGB: number }>
      peers: Section<{ others: number; sameTree: number }>
    }
    watches: Record<string, CiWatch> // theo SHA; sống qua hot reload
    wakes: number[] // mốc giờ các lần đánh thức, cho bộ chống lặp
  }
}
```

### Phạm vi kích hoạt

Ở `session.start`, mod chạy `git rev-parse --path-format=absolute --git-common-dir` trên
thư mục làm việc. Chỉ khi kết quả là `.git` của `C:\Programming\Devs\Projects\Tourism-Platform-V2`
(checkout gốc hoặc mọi worktree của nó; so sau khi chuẩn hoá dấu gạch chéo và chữ hoa thường,
vì git trả `C:/…`) thì mod mới bật; phiên khác mod không làm gì.

### Vòng đời

1. **Dựng:** viết trong thư mục dev-mods của phiên đang dựng (hot reload sau mỗi lượt).
2. **Dùng thật:** chép sang `C:\Programming\Devs\claude-mods\tourism-status\`, `git init`;
   thêm vào khối `env` của `~/.claude/settings.json` (user duyệt trước):
   `CLAUDE_CODE_PLUGIN_DIRS=C:\Programming\Devs\claude-mods\tourism-status` và
   `CLAUDE_CODE_PLUGIN_DIR_WATCH=1`; khởi động lại app.
3. **Gỡ:** xoá hai biến đó. Repo không dính gì.

### Ngôn ngữ

Comment code tiếng Việt (giữ luật 8 cho đồng bộ). Chữ trên dải, toast và ghi chú viết tiếng
Việt: đây là công cụ của user, không phải copy sản phẩm, nên luật 7 không áp.

## 3. Dải trạng thái

### Hình dạng

Một dòng mờ, các mục cách nhau bằng ` · `. Ví dụ minh hoạ:

```text
feat/p4e-4-posts-admin ↑4 ↓0 · 13 file chưa commit · CI main ✓ 3053745 · DB ✓ · API — · RAM 8,1 GB · C 142 GB · 1 phiên khác · freeze còn 13 ngày
```

Mục bình thường giữ màu mờ; mục có vấn đề đổi **vàng** (nên để ý) hoặc **đỏ** (nên xử lý
trước khi làm tiếp). Khi `bodyColumns` không đủ: giữ tên nhánh và các mục vàng/đỏ, bỏ mục
bình thường từ cuối lên. Đang có khảo sát (`hasSurvey`) thì nhường, gọi `next(e)`.

### Từng mục

| Mục | Lấy từ | Vàng | Đỏ |
| --- | --- | --- | --- |
| Nhánh, ↑↓ so với `origin/main` | `git --no-optional-locks status --porcelain=v2 --branch`; `git rev-list --left-right --count origin/main...HEAD` | nhánh khác `main` mà ↓ > 0 (nhớ rebase trước khi merge); đứng trên `main` mà ↑ > 0 (còn commit chưa push) | — |
| File chưa commit | cùng lệnh status | — | — (chỉ đếm) |
| CI main | `gh run list --workflow ci.yml --branch main --limit 8 --json databaseId,status,conclusion,headSha,createdAt,updatedAt,url` (bỏ workflow Audit) | đang chạy | thất bại |
| DB | `docker ps --all --filter name=tourism-v2-postgres --format {{.Status}}` | dừng hoặc chưa healthy | — |
| API | `$.http.fetch("http://localhost:3001/")`: có trả HTTP là sống, từ chối kết nối là tắt | — | — ("API —" mờ, vì API chỉ bật khi cần) |
| `.env.local` | `$.fs.exists` ở `apps/{api,web,admin,mobile}` của cây làm việc hiện tại (khớp bốn `.env.example`) | — | thiếu; ghi rõ app nào |
| RAM | commit trống: `pwsh -NoProfile -NonInteractive -Command …` đọc `Win32_OperatingSystem.FreeVirtualMemory` | < 6 GB | < 3 GB |
| Ổ C | cùng lệnh `pwsh`, đọc `Win32_LogicalDisk` `C:` | < 30 GB | < 15 GB |
| Phiên khác | file nhịp tim (dưới) | có phiên khác cùng cây làm việc (cùng cây thì cũng cùng nhánh, vì chung `HEAD`) | — |
| Freeze | đếm theo ngày giờ Việt Nam tới 2026-10-15 | còn ≤ 3 ngày; từ 15/10 hiện "đang freeze" | — |

Căn cứ ngưỡng RAM (memory "Hãm tài nguyên"): lúc rảnh còn 7–10 GB, gate tụt thấp nhất
4,3–8 GB, watchdog cắt ở 1,5 GB. Căn cứ ngưỡng ổ C: có lượt gate làm ổ giảm tới 8 GB. Mọi
ngưỡng nằm ở `src/config.ts`, sửa là nạp lại.

### An toàn với phiên song song

- Mọi lệnh `git` dùng `--no-optional-locks`, để không giữ `index.lock` đúng lúc phiên khác
  `git add` hay `commit`. (`$.process.run` vốn chạy git với hook của repo tắt.)
- Lệnh ghi duy nhất là `git fetch --quiet --no-tags origin main`: chỉ cập nhật `origin/main`,
  không đụng nhánh hay file. Chỉ fetch khi SHA đầu của CI `main` chưa có trên máy
  (`git merge-base --is-ancestor <sha> origin/main` trả khác 0).

### Nhịp tim giữa các phiên

- Mỗi phút ghi `~/.claude/mods-state/tourism-status/peers/<id phiên>.json`:
  `{ sessionId, cwd, commonDir, branch, lastSeen, ended }`.
- Dải đếm file của cùng `commonDir`, `lastSeen` ≤ 3 phút, `ended` khác `true`, trừ chính mình.
- `$.fs` không có lệnh xoá: kết thúc phiên (`session.end`) thì ghi `ended: true`. Mỗi lần mod
  khởi động thì dọn file cũ hơn 7 ngày bằng một lệnh `pwsh` `Remove-Item -LiteralPath` giới
  hạn trong đúng thư mục `peers`.
- Không dùng `$.store` cho việc này: tài liệu không nói gì về ghi đồng thời từ nhiều tiến
  trình, còn mỗi phiên một file thì không bao giờ ghi đè nhau.
- Giới hạn: chỉ thấy các phiên cũng chạy mod.

### Nhịp làm mới

| Nhóm | Nhịp |
| --- | --- |
| Tất cả | một lượt ở `session.start` |
| Git | sau mỗi `turn.complete`, sau mỗi lệnh Bash/PowerShell có chữ `git`, và mỗi 60 giây |
| CI main | mỗi 2 phút (đang canh push thì dày hơn, §4) |
| DB, API, `.env.local`, RAM, ổ C, nhịp tim | mỗi 60 giây |
| Khi rảnh | 15 phút không có lượt nào thì mọi nhịp giãn ra 5 phút; có lượt mới thì về nhịp thường |

## 4. Canh CI sau push

### 4.1 Nhận ra một lần push

Hook `tool.call` cho `Bash` và `PowerShell`: `await next(e)`, rồi nếu lệnh chứa `git push` và
kết quả không lỗi thì xác định các ref vừa đẩy:

1. Đọc output của push (`result.text`), dòng dạng `<cũ>..<mới>  <nguồn> -> <đích>` hoặc
   `* [new branch]  <nguồn> -> <đích>`.
2. Không có output (`-q`) thì đọc refspec trong câu lệnh: `<nguồn>:<đích>`, `origin <nhánh>`,
   hoặc `git push` trần thì là nhánh hiện tại.
3. `git rev-parse` ra SHA đầy đủ.

Mọi nhánh đều canh (`ci.yml` chạy trên `branches: ['**']`).

### 4.2 Ngay sau push

Gắn vào `context` của kết quả push (chỉ Claude đọc):
*"tourism-status đang canh CI cho `<sha7>` (`<nhánh>`) và sẽ ghi chú vào hội thoại khi xong;
không cần tự gọi `gh run list`."*

### 4.3 Trong lúc chạy

- Hỏi `gh run list --workflow ci.yml --commit <sha> --json …` mỗi 15 giây tới khi run xuất
  hiện, rồi mỗi 30 giây.
- Mục CI trên dải hiện `⟳ CI <sha7> · <đã chạy>/<trung vị> phút`. Trung vị lấy từ 8 run gần
  nhất của `main` (lúc viết: 7–11 phút, trung vị 9,5).
- Các lần canh nằm trong `$.state.watches`; sau hot reload, `session.start` chạy lại thì canh
  tiếp những lần chưa xong.

### 4.4 Kết cục

| Kết cục | User thấy | Claude nhận |
| --- | --- | --- |
| `success` | toast "CI xanh · `<sha7>` · `<n>` phút" | ghi chú (`$.session.append`, vai user, ẩn): "CI xanh: `<sha7>` trên `<nhánh>` (run `<id>`, `<n>` phút)"; đủ để thoả luật 14 |
| `failure`, `timed_out`, `startup_failure` | toast đỏ kèm tên bước hỏng (`gh run view <id> --json jobs`) | ghi chú, rồi `$.prompt.submit`: *"CI đỏ ở `<sha7>` (`<nhánh>`, run `<id>`, bước `<bước>`). Đọc log bằng `gh run view <id> --log-failed`, tóm tắt nguyên nhân và đề xuất cách vá. Chưa sửa code, chưa push."* |
| `cancelled` (có push mới hơn cùng nhánh, do `cancel-in-progress`) | toast nhạt | ghi chú; không đánh thức |
| 3 phút không thấy run, hoặc chạy quá 30 phút | toast vàng | ghi chú; thôi canh |

**Chống lặp:** mỗi SHA đánh thức tối đa một lần; mỗi phiên tối đa ba lần trong 60 phút (đếm
trên `wakes`). Vượt trần thì chỉ toast và ghi chú.

### 4.5 Docs-freshness (luật 13)

1. **Sau ff-merge vào `main`:** lệnh có `merge --ff-only`, chạy thành công, nhánh hiện tại là
   `main` thì gắn vào `context` của kết quả: *"Vừa ff-merge vào main. Luật 13: entry CHANGELOG
   (ngày · hash · nội dung · review findings · số test), cập nhật doc hiện trạng, thêm doc mới
   vào `docs/README.md`."*
2. **Trước khi push lên `main`:** trước `next(e)`, xác định commit sắp đẩy (§4.1 bước 2 và 3),
   rồi kiểm đúng quy tắc của `scripts/docs-freshness.sh` trên chính commit đó:
   ngày entry mới nhất từ `git show <sha>:docs/CHANGELOG.md` (dòng `## YYYY-MM-DD` đầu tiên),
   rồi `git log <sha> --since="<ngày> 23:59:59" --grep=^feat --grep=^fix --extended-regexp`.
   Có commit chưa kể thì toast vàng ngay, và sau khi push xong gắn vào `context`: *"docs-
   freshness sẽ đỏ trên CI: entry mới nhất `<ngày>`, còn chưa kể: `<danh sách>`."* Không chặn.
3. **CI là lưới cuối:** bước docs-freshness của CI hỏng thì luồng §4.4 lo.

**Đánh đổi:** chốt 2 viết lại logic của script (khoảng 20 dòng) thay vì gọi script, vì script
đọc CHANGELOG từ cây làm việc (`cd $(git rev-parse --show-toplevel)`), còn mod phải kiểm theo
commit để đúng cả khi push bằng index tạm. Script đổi thì mod phải sửa theo; CI vẫn chạy
script thật nên mod lệch thì CI vẫn bắt.

### 4.6 Sau khi dùng thật

Thêm memory (không sửa CLAUDE.md vì mod chỉ có trên máy user): có `tourism-status` thì sau
push không tự poll CI, chờ ghi chú của mod.

## 5. Lỗi & giới hạn

- **Mod lỗi thì phiên vẫn chạy:** engine bỏ qua hook ném lỗi. Hook `tool.call` có thêm
  `.catch` trả nguyên kết quả gốc, để phần xử lý của mod hỏng cũng không sửa sai kết quả lệnh.
- **Timeout từng lệnh:** git 10 giây, gh 20 giây, pwsh 15 giây (`timeoutMs`). Lệnh hỏng thì
  `error` của nhóm đó có giá trị và mục hiện "?" mờ; các nhóm khác chạy tiếp.
- **GitHub không trả lời:** ba lần liền thì toast một lần, rồi giãn nhịp hỏi (30 giây → 2 phút
  → 5 phút) tới khi trả lời lại.
- **Ngân sách hook:** việc định kỳ chạy trong `$.clock.every`, ngoài mọi dispatch. Trong hook
  `tool.call` chỉ có hai lệnh git của chốt 2; thời gian chờ `$` không tính vào ngân sách hook.
- **Hot reload huỷ hẹn giờ:** `session.start` đăng ký lại; dữ liệu sống trong `$.state`.
- **Bí mật:** chỉ kiểm `.env.local` có tồn tại, không bao giờ đọc nội dung. File nhịp tim chỉ
  có thư mục, nhánh, giờ.
- **Tải máy:** mỗi phiên mỗi phút khoảng năm tiến trình (git hai, docker, pwsh, gh mỗi hai
  phút); năm phiên song song vào khoảng 25 tiến trình mỗi phút, lúc rảnh giãn ra 5 phút.
- **API early access:** sau mỗi lần app cập nhật thì chạy lại `validate` và test; hỏng thì xoá
  biến môi trường là tắt ngay.

## 6. Kiểm thử

### Logic thuần (`src/logic/`), viết test trước (luật 4)

| Hàm | Ca phải có |
| --- | --- |
| `parseGitStatus`, `parseAheadBehind` | nhánh có và không có upstream, detached, cây sạch, cây bẩn |
| `parseRuns`, `medianMinutes` | đang chạy, xanh, đỏ, huỷ, rỗng, JSON hỏng |
| `parsePushOutput`, `parsePushTargets` | `<sha>:main`, `HEAD:main`, `origin <nhánh>`, push trần, `-q`, nhánh mới, push hỏng |
| `isFfMergeIntoMain` | thành công trên `main`, trên nhánh khác, lệnh hỏng |
| `latestChangelogDate`, `freshnessVerdict` | có và không có entry, commit cùng ngày entry, commit sau ngày entry |
| `classify` (ngưỡng → màu) | đúng biên 6/3 GB, 30/15 GB, ↓ trên nhánh tính năng, ↑ trên `main`, nhóm lỗi → "?" |
| `freezeLabel` | trước, đúng ngày, sau 15/10; tính theo giờ Việt Nam |
| `freshPeers` | file tươi, cũ, `ended`, khác repo, chính mình |
| `canWake` | SHA đã đánh thức, trần ba lần mỗi giờ, trượt cửa sổ |
| `fitSegments` | đủ chỗ, thiếu chỗ (giữ nhánh và mục vàng/đỏ) |

Sau khi xanh: thử đột biến tay (đổi ngưỡng, đảo điều kiện) để chắc test bắt được.

### Giao diện

`claude plugin test` gắn `AbovePrompt` lên cả `terminal` lẫn `desktop` với state mẫu, rồi kiểm
chữ hiện ra; một thân test lặp qua `['terminal', 'desktop']`.

### Thử luồng CI không cần push

Lệnh chỉ dùng khi dựng `/tourism-status-replay <sha>` chạy trọn §4.3–§4.4 trên một run có sẵn:
`3053745e` (xanh) và `aede381d` (đỏ, F19). Phải ra đúng toast, ghi chú, và một lượt đánh thức
cho ca đỏ. Lệnh này gỡ trước bước 4.

### Công cụ

`claude.exe` đi kèm app (`…\Claude\claude-code\<phiên bản>\<băm>\claude.exe`, lấy bản mới nhất
vì đường dẫn đổi theo mỗi lần cập nhật) chạy `plugin test` và `plugin validate`. CLI không có
trên PATH.

### Thử tay

Mỗi lượt một bước; user báo kết quả xong mới sang bước kế (cách user chốt 17/09).

## 7. Triển khai

| Bước | Việc | Cổng qua bước |
| --- | --- | --- |
| 0 | **Thử khả thi** bằng một mod tí hon, vứt đi sau khi thử: `$.process.run` với git, gh, pwsh, docker; `$.http.fetch`; vẽ `AbovePrompt` trên Code tab; toast; `$.session.append`; `$.prompt.submit`; `$.fs.write` vào `~/.claude/mods-state`; `claude.exe plugin test` và `validate` chạy được ngoài app | Có thứ hỏng thì dừng, báo user, chỉnh thiết kế |
| 1 | Khung thư mục, `types/index.d.ts`, `src/config.ts`, `src/logic` theo TDD | Test xanh, `validate` sạch |
| 2 | `src/collect`, `band.tsx`, nhịp làm mới, nhịp tim | Thử tay xong |
| 3 | `ci-watch.ts`: nhận ra push, canh, kết cục, chống lặp, docs-freshness ba chốt, lệnh replay | Replay ra đúng cả xanh lẫn đỏ |
| 4 | Dùng thật: chép sang thư mục cố định, `git init` và commit đầu; chép script khai thác transcript vào đó; thêm biến env (user duyệt); khởi động lại app; kiểm ở phiên mới; ghi memory §4.6 | Phiên mới tự hiện dải |
| 5 | Dùng thử khoảng một tuần; chạy lại script khai thác transcript, so với §1 | User quyết giữ, chỉnh hay gỡ; chọn nhóm kế tiếp |

## 8. Rủi ro đã biết

- **`$.process` ghi "CLI only".** Code tab chạy chính `claude.exe` nên nhiều khả năng dùng
  được, nhưng chưa thử. Bước 0 là cổng: không chạy được thì phần lớn dải phải bỏ, chỉ còn mục
  dùng `$.http` và `$.fs`.
- **Hiển thị trên desktop:** tài liệu API mô tả dải chủ yếu theo terminal (màu, độ rộng). Bước 0
  kiểm dải và màu trên Code tab trước khi dựng thật.
- **Đường dẫn `claude.exe` đổi theo phiên bản:** lệnh test luôn dò bản mới nhất.
- **Logic docs-freshness chép từ script:** lệch được, đã có CI làm lưới (§4.5).
