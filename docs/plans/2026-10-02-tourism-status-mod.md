# Mod `tourism-status` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: dùng superpowers:executing-plans (khuyên dùng
> cho plan này vì Task 0, 6, 7, 8 có bước thử tay trên Code tab) hoặc
> superpowers:subagent-driven-development cho Task 1–5 (logic thuần). Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** dựng mod `tourism-status`: một dải trạng thái trên ô prompt, tự canh CI sau mỗi lần
Claude push, và kiểm docs-freshness ba chốt, cho các phiên Claude Code làm việc trên
Tourism-Platform-V2.

**Architecture:** một plugin function-hooks nằm ngoài repo. `src/collect` gọi lệnh qua `$`,
`src/logic` (thuần, có test) biến output thành dữ liệu, kết quả ghi vào `$.state`, `src/band.tsx`
đọc `$.state` để vẽ. `src/ci-watch.ts` nghe `tool.call` của Bash/PowerShell để nhận ra push và
merge, canh CI bằng `gh`, báo bằng toast, ghi chú (`$.session.append`) và lượt mới
(`$.prompt.submit`) khi đỏ.

**Tech Stack:** Claude Code function hooks (early access, bản 2.1.286) · TypeScript/TSX chạy
trong môi trường riêng của engine (không DOM, không Node) · `git`, `gh`, `docker`, `pwsh` gọi qua
`$.process.run` · bộ test `claude-code/testing` chạy bằng `claude.exe plugin test`.

**Spec:** [docs/specs/2026-10-02-tourism-status-mod-design.md](../specs/2026-10-02-tourism-status-mod-design.md)

## Global Constraints

- Mod nằm NGOÀI repo. Khi thi công không sửa, commit hay push file nào của Tourism-Platform-V2.
- Không push lên GitHub của repo, không tạo nhánh để thử; luồng CI thử bằng lệnh replay (Task 7).
  `git push --dry-run` ở Task 7 thì được, vì nó không gửi gì lên GitHub.
- Không sửa `~/.claude/settings.json` trước Task 8; ở Task 8 chỉ sửa sau khi user duyệt.
- Comment code tiếng Việt (luật 8). Chữ trên dải, toast, ghi chú, lượt đánh thức: tiếng Việt.
- Mod chỉ đọc: không trả `{ deny }`, không sửa input của tool; chỉ thêm `context` vào kết quả.
- Hook `tool.call` không bao giờ ném lỗi sau `next(e)`: mọi xử lý sau đó bọc `try/catch`.
- Mọi lệnh `git` kèm `--no-optional-locks`; lệnh ghi duy nhất là
  `git fetch --quiet --no-tags origin main`.
- Không bao giờ đọc nội dung `.env*`; chỉ `$.fs.exists`.
- Ngưỡng: RAM commit trống vàng < 6 GB, đỏ < 3 GB · ổ C vàng < 30 GB, đỏ < 15 GB · freeze
  `2026-10-15` theo giờ Việt Nam (UTC+7), vàng khi còn ≤ 3 ngày và từ ngày freeze.
- Nhịp: nhóm nhanh 60 giây · CI main 2 phút · 15 phút không có lượt thì giãn 5 phút · canh push
  15 giây (chờ run) rồi 30 giây (đang chạy) · 3 phút không thấy run hoặc quá 30 phút thì thôi canh.
- Đánh thức: tối đa 1 lần mỗi SHA, tối đa 3 lần mỗi 60 phút mỗi phiên.
- Commit trong git riêng của mod: Conventional Commits, tiếng Việt có dấu, KHÔNG AI attribution
  (luật 12), stage đường dẫn tường minh.
- TDD cho `src/logic` (luật 4): test trước, chạy thấy đỏ, rồi mới viết code.
- Thử tay từng bước: mỗi lượt một bước, user báo kết quả xong mới sang bước kế.

## Quyết định của plan (bổ sung hoặc sửa spec)

1. **Không dùng `.catch` của registration** (spec §5 nói có). Chưa rõ engine có chạy lại chuỗi
   hook khi hook ném lỗi sau `next(e)` hay không; nếu có thì một `git push` có thể chạy hai lần.
   Thay vào đó bọc `try/catch` ngay trong hook và luôn trả nguyên kết quả gốc khi lỗi.
2. **Màu dùng tên thô `yellow`, `red`.** Tài liệu ghi "theme key hoặc màu thô" nhưng chưa tra được
   danh sách theme key; Task 0 kiểm trên Code tab. Sai thì chỉ sửa hằng `COLOR` trong `band.tsx`.
3. **So sánh trong test bằng helper `eq`** (JSON với khoá đã sắp xếp), vì mới chắc kit có `toBe`.
   Task 0 kiểm thêm `toEqual`.
4. **Test mount giao diện** (spec §6) chỉ thêm ở Task 6 nếu Task 0 cho thấy `$.ui.mount` chạy được
   với props tối thiểu; nếu không, giao diện kiểm bằng thử tay.
5. **docs-freshness chạy `git log` với `TZ=UTC`**, vì CI chạy script trên Ubuntu giờ UTC và
   `--since` đọc giờ theo `TZ`. Spec chưa nói điều này.
6. **`.env.local` đủ thì không hiện mục** (ví dụ trong spec cũng không có mục này); nhóm môi trường
   lỗi thì hiện `môi trường ?`.
7. **"Cùng cây" so bằng `git rev-parse --show-toplevel`**, không so thư mục làm việc (phiên có thể
   đứng ở thư mục con).
8. **Push không được canh:** `--dry-run`/`-n`, `--delete`/`-d`, `--tags`, `--all`, `--mirror`.
   Riêng `--dry-run` vẫn chạy kiểm docs-freshness, để Task 7 thử chốt 2 mà không đẩy gì.
9. **Canh lại một SHA giữ `wokeAt` cũ**, nên mỗi SHA chỉ đánh thức một lần, kể cả khi replay.
10. **Lùi nhịp khi GitHub lỗi:** nhóm CI giãn 5 phút sau 3 lần lỗi liền; canh push 30 giây → 2 phút
    (≥ 3 lỗi) → 5 phút (≥ 6 lỗi); thành công một lần là về nhịp thường.
11. **Code dựng trong dev-mods của phiên thi công, có `git init` từ Task 1**; Task 8 `git clone`
    sang `C:\Programming\Devs\claude-mods\tourism-status\` để giữ lịch sử (spec nói "chép").
12. **Lượt khởi động chạy nền**, không chặn prompt đầu tiên của phiên.
13. **Lệnh replay nhận nhánh tuỳ chọn**: `/tourism-status-replay <sha> [nhánh]`, mặc định `main`.

## Cấu trúc file

`<DEV>` là thư mục dev-mods mà skill `plugin-authoring` in ra cho phiên thi công
(dạng `C:\Users\<user>\.claude\dev-mods\<id phiên>`); `<MOD>` = `<DEV>\tourism-status`. Trong Git
Bash viết `/c/Users/<user>/.claude/dev-mods/<id phiên>/tourism-status`.

| File | Trách nhiệm |
| --- | --- |
| `.claude-plugin/plugin.json` | tên, version, trỏ `types` |
| `hooks/hooks.json` | `{ "modules": ["./register.tsx"] }` |
| `hooks/register.tsx` | nối dây: đăng ký hook, không chứa logic |
| `types/index.d.ts` | hợp đồng `$.state` và các kiểu dữ liệu dùng chung |
| `src/config.ts` | ngưỡng, nhịp, đường dẫn, ngày freeze |
| `src/context.ts` | ngữ cảnh chạy của phiên (biến module, mất khi hot reload) |
| `src/state.ts` | ba atom `snapshot`, `watches`, `wakes` |
| `src/run.ts` | chạy lệnh bằng argv; `git` luôn kèm `--no-optional-locks` |
| `src/gh.ts` | gọi `gh`, đếm lỗi GitHub liền nhau |
| `src/logic/*.ts` | logic thuần: `paths`, `git`, `ci`, `push`, `freshness`, `messages`, `wake`, `machine`, `peers`, `classify` |
| `src/collect/*.ts` | thu dữ liệu: `git`, `ci`, `env`, `machine`, `peers` |
| `src/refresh.ts` | chạy từng nhóm, nhịp chủ 15 giây |
| `src/boot.ts` | nhận diện repo, khởi động nhịp |
| `src/band.tsx` | vẽ dải |
| `src/ci-watch.ts` | canh CI, kiểm trước push, xử lý sau lệnh shell, replay |
| `src/shell-hook.ts` | hook `tool.call` dùng chung cho Bash và PowerShell |
| `tests/eq.ts`, `tests/*.test.ts` | helper so sánh và test cho `src/logic` |
| `dev.sh` | chạy `plugin test` / `plugin validate` bằng `claude.exe` của app |
| `.gitignore` | bỏ qua file engine tự ghi |

Chạy test và validate (CLI `claude` không có trên PATH; `dev.sh` tự dò bản `claude.exe` mới nhất):

```bash
bash "<MOD>/dev.sh" test
```

```bash
bash "<MOD>/dev.sh" validate
```

---

### Task 0: Thử khả thi trên Code tab (spike, vứt đi)

Cổng đi tiếp hay dừng của cả plan (spec §7 bước 0, §8). Code ở task này **không giữ lại**.

**Files:**
- Create: `<DEV>/tourism-status-spike/.claude-plugin/plugin.json`
- Create: `<DEV>/tourism-status-spike/hooks/hooks.json`
- Create: `<DEV>/tourism-status-spike/hooks/register.tsx`
- Create: `<DEV>/tourism-status-spike/types/index.d.ts`
- Create: `<DEV>/tourism-status-spike/tests/spike.test.ts`

**Interfaces:**
- Consumes: không.
- Produces: biên bản 8 mục ở Step 6; Task 6 đọc mục 2 (màu) và mục 8 (mount).

- [ ] **Step 1: Nạp skill và lấy `<DEV>`**

Gọi Skill `plugin-authoring`. Nó in đường dẫn dev-mods của phiên (mục "WHERE TO WRITE IT") và bắt
đầu canh thư mục đó. Ghi lại đường dẫn này làm `<DEV>`.

- [ ] **Step 2: Viết manifest, hooks.json và hợp đồng state của spike**

`<DEV>/tourism-status-spike/.claude-plugin/plugin.json`:

```json
{
  "name": "tourism-status-spike",
  "version": "0.0.1",
  "description": "Thử khả thi API mod trên Code tab; vứt sau Task 0",
  "types": "./types/index.d.ts"
}
```

`<DEV>/tourism-status-spike/hooks/hooks.json`:

```json
{ "modules": ["./register.tsx"] }
```

`<DEV>/tourism-status-spike/types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    'tourism-status-spike': { results: string[]; ticks: number }
  }
}
```

File đầu tiên ghi vào `<DEV>` làm app hỏi *"Enable hot reloading for this session?"*. Nhờ user chọn
**Enable for this session**.

- [ ] **Step 3: Viết module dò**

`<DEV>/tourism-status-spike/hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// Kết quả dò và bộ đếm nhịp để thấy hẹn giờ có vẽ lại dải không
const results = atom({ plugin: 'tourism-status-spike', key: 'results' } as const, [] as string[])
const ticks = atom({ plugin: 'tourism-status-spike', key: 'ticks' } as const, 0)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    void (async () => {
      const out: string[] = []
      // Chạy một lệnh và ghi dòng đầu output, hoặc lỗi nếu không chạy được
      const probe = async (label: string, argv: string[]) => {
        try {
          const r = await $.process.run(argv, { timeoutMs: 20_000 })
          const first = r.stdout.trim().split(/\r?\n/)[0] ?? ''
          out.push(`${label}: exit ${r.exitCode} ${first.slice(0, 60)}`)
        } catch (err) {
          out.push(`${label}: LỖI ${String(err).slice(0, 80)}`)
        }
      }
      await probe('git', ['git', '--version'])
      await probe('gh', ['gh', 'run', 'list', '--workflow', 'ci.yml', '--commit', '3053745e', '--limit', '1', '--json', 'databaseId,conclusion'])
      await probe('pwsh', ['pwsh', '-NoProfile', '-NonInteractive', '-Command', '(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory'])
      await probe('docker', ['docker', 'ps', '--all', '--filter', 'name=tourism-v2-postgres', '--format', '{{.Status}}'])
      try {
        const r = await $.http.fetch('http://localhost:3001/')
        out.push(`http: ${r.status}`)
      } catch (err) {
        out.push(`http: từ chối (${String(err).slice(0, 60)})`)
      }
      try {
        const home = (await $.env.get('USERPROFILE')) ?? ''
        const dir = `${home}/.claude/mods-state/spike`
        await $.process.run(['pwsh', '-NoProfile', '-NonInteractive', '-Command', `New-Item -ItemType Directory -Force -Path '${dir}' | Out-Null`])
        await $.fs.write(`${dir}/probe.json`, JSON.stringify({ at: await $.clock.now() }))
        const list = await $.fs.list(dir)
        out.push(`fs: ${list.map(f => `${f.name}(${f.kind})`).join(', ')}`)
      } catch (err) {
        out.push(`fs: LỖI ${String(err).slice(0, 80)}`)
      }
      out.push(`session: ${(await $.session.id()).slice(0, 8)} · cwd: ${e.cwd}`)
      await update($, results, () => out)
      $.ui.toast('spike: xong lượt dò, xem dải trên ô prompt')
      await $.command.register({ name: 'spike-note', description: 'Spike: ghi một dòng ẩn cho Claude' })
      await $.command.register({ name: 'spike-wake', description: 'Spike: tự mở một lượt mới' })
      $.clock.every(5_000, () => void update($, ticks, n => n + 1))
    })()
    return started
  })

  on('command.run', { command: 'spike-note' }, async $ => {
    await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: '[spike] Mật mã ghi chú là CAM-42.' }] } })
    return { text: 'Đã ghi một dòng ẩn.' }
  })

  on('command.run', { command: 'spike-wake' }, async $ => {
    void $.prompt.submit({ text: 'Spike: đây là lượt do mod mở. Trả lời đúng một câu: "đã nhận lượt từ mod".' })
    return { text: 'Đã xếp một prompt.' }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (!e.command.includes('spike-ctx') || ran.deny !== undefined || ran.isError) return ran
    return { ...ran, context: [...(ran.context ?? []), '[spike] Mật mã context là LAM-7.'] }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const lines = await read($, results)
    const n = await read($, ticks)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="yellow">thô-vàng</Text>
          <Text> · </Text>
          <Text color="red">thô-đỏ</Text>
          <Text> · </Text>
          <Text color="warning">key-warning</Text>
          <Text> · </Text>
          <Text color="error">key-error</Text>
          <Text> · </Text>
          <Text dimColor>mờ · nhịp {n}</Text>
        </Box>
        {lines.map(l => (
          <Text dimColor>{l}</Text>
        ))}
      </Box>
    )
  })
}
```

- [ ] **Step 4: Viết test dò bộ kit**

`<DEV>/tourism-status-spike/tests/spike.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'

describe('spike', () => {
  test('kit chạy được và có toBe', () => {
    expect(1 + 1).toBe(2)
  })

  test('kit có toEqual (chỉ để ghi biên bản)', () => {
    expect({ a: 1 }).toEqual({ a: 1 })
  })

  test('kit mount được dải trên desktop với props tối thiểu (chỉ để ghi biên bản)', async $ => {
    const ui = await $.ui.mount({
      plugin: 'tourism-status-spike',
      surface: 'desktop',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 160 },
    })
    expect(await ui.find({ type: 'Text', text: /nhịp/ })).toBeDefined()
    await ui.unmount()
  })
})
```

- [ ] **Step 5: Chạy validate và test của spike bằng `claude.exe`**

```bash
CLAUDE_EXE=$(ls -d "$(cygpath -u "$LOCALAPPDATA")"/Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude/claude-code/*/*/claude.exe | sort -V | tail -1); echo "$CLAUDE_EXE"; "$CLAUDE_EXE" plugin validate "<DEV>/tourism-status-spike"; "$CLAUDE_EXE" plugin test "<DEV>/tourism-status-spike"
```

Expected: `validate` liệt kê các hook (`session.start`, `command.run` ×2, `tool.call`, `ui.render`)
và state `tourism-status-spike.results`, `.ticks`; `test` báo ít nhất test `toBe` xanh. Hai test còn
lại xanh hay đỏ đều được, chỉ ghi lại.

- [ ] **Step 6: Thử tay theo biên bản, mỗi lượt một bước**

Kết thúc lượt để mod nạp, rồi đi từng mục, chờ user báo:

| # | Việc | Đạt khi |
| --- | --- | --- |
| 1 | Hot reload | user đã chọn Enable, mod nạp không báo lỗi (dòng mờ trong transcript nếu có lỗi) |
| 2 | Dải | thấy dải; ghi lại ô nào có màu: `thô-vàng`/`thô-đỏ` hay `key-warning`/`key-error`; số `nhịp` tăng mỗi 5 giây |
| 3 | `$.process.run` | các dòng `git`, `gh`, `pwsh`, `docker` có `exit 0`; dòng `gh` có `databaseId` |
| 4 | `$.http`, `$.fs`, `$.env` | dòng `http` có mã HTTP hoặc "từ chối"; dòng `fs` có `probe.json(file)` |
| 5 | `$.session.append` | user gõ `/spike-note`, rồi hỏi Claude "mật mã ghi chú là gì"; Claude trả `CAM-42` |
| 6 | `$.prompt.submit` | user gõ `/spike-wake`; một lượt mới tự chạy và Claude trả "đã nhận lượt từ mod" |
| 7 | `context` của `tool.call` | Claude chạy Bash `echo spike-ctx`; Claude thấy được `LAM-7` mà không cần ai nói |
| 8 | Bộ kit | ghi kết quả Step 5: `toEqual` có không, `mount` có chạy không |

**Cổng:** mục 1–7 phải đạt (mục 2 cần ít nhất một cặp màu hiện đúng). Có mục hỏng thì DỪNG, báo
user mục nào, kèm dòng lỗi, và chờ quyết định chỉnh thiết kế. Đặc biệt nếu mục 3 hỏng (`$.process`
"CLI only"), phần lớn dải không làm được.

- [ ] **Step 7: Ghi biên bản, gỡ spike**

Ghi kết quả 8 mục vào `<DEV>/spike-report.md` (Task 6 đọc mục 2 và 8). Gỡ spike và thư mục dò:

```powershell
Remove-Item -LiteralPath '<DEV>\tourism-status-spike' -Recurse -Force
```

```powershell
Remove-Item -LiteralPath "$env:USERPROFILE\.claude\mods-state\spike" -Recurse -Force
```

Không commit gì ở task này.

---

### Task 1: Khung mod, hợp đồng, đường dẫn và đọc output git

**Files:**
- Create: `<MOD>/.claude-plugin/plugin.json`
- Create: `<MOD>/hooks/hooks.json`
- Create: `<MOD>/hooks/register.tsx` (tạm, rỗng)
- Create: `<MOD>/types/index.d.ts`
- Create: `<MOD>/src/config.ts`
- Create: `<MOD>/src/logic/paths.ts`
- Create: `<MOD>/src/logic/git.ts`
- Create: `<MOD>/tests/eq.ts`
- Create: `<MOD>/tests/git.test.ts`
- Create: `<MOD>/dev.sh`
- Create: `<MOD>/.gitignore`

**Interfaces:**
- Consumes: biên bản Task 0 (đã qua cổng).
- Produces:
  - `types/index.d.ts`: `Level`, `Section<T>`, `GitInfo`, `CiInfo`, `DbState`, `EnvInfo`,
    `MachineInfo`, `PeersInfo`, `TourismSnapshot`, `CiWatch`, và `PluginState['tourism-status']`.
  - `CONFIG` (src/config.ts).
  - `normalizePath(p: string): string`.
  - `type GitStatus = { branch: string; upstream?: string; dirty: number }`,
    `parseGitStatus(out: string): GitStatus`,
    `parseAheadBehind(out: string): { ahead: number; behind: number }`.
  - `eq(actual: unknown, expected: unknown): void` (tests/eq.ts).

- [ ] **Step 1: Viết khung, hợp đồng, cấu hình và công cụ chạy test**

`<MOD>/.claude-plugin/plugin.json`:

```json
{
  "name": "tourism-status",
  "version": "0.1.0",
  "description": "Dải trạng thái, canh CI sau push và docs-freshness cho Tourism-Platform-V2",
  "types": "./types/index.d.ts"
}
```

`<MOD>/hooks/hooks.json`:

```json
{ "modules": ["./register.tsx"] }
```

`<MOD>/hooks/register.tsx` (tạm, Task 6 viết thật):

```tsx
import type { Register } from 'claude-code'

// Tạm thời chưa đăng ký hook nào; Task 6 nối dây thật
export const register: Register = () => {}
```

`<MOD>/types/index.d.ts`:

```ts
// Hợp đồng dữ liệu $.state của mod tourism-status và các kiểu dùng chung
export type Level = 'ok' | 'warn' | 'error' | 'unknown'

// Một nhóm mục của dải: giá trị gần nhất, giờ cập nhật, lỗi của lượt gần nhất
export type Section<T> = { value?: T; updatedAt: number; error?: string }

export type GitInfo = { branch: string; ahead: number; behind: number; dirty: number; onMain: boolean }

export type CiInfo = {
  runId: number
  status: string
  conclusion: string | null
  sha: string
  url: string
  medianMinutes: number
}

export type DbState = 'up' | 'unhealthy' | 'down'

export type EnvInfo = { db: DbState; api: 'up' | 'down'; envMissing: string[] }

export type MachineInfo = { commitFreeGB: number; diskFreeGB: number }

export type PeersInfo = { others: number; sameTree: number }

export type TourismSnapshot = {
  git: Section<GitInfo>
  ci: Section<CiInfo>
  env: Section<EnvInfo>
  machine: Section<MachineInfo>
  peers: Section<PeersInfo>
}

// Một lần canh CI cho một SHA; wokeAt có giá trị là SHA này đã đánh thức Claude
export type CiWatch = {
  sha: string
  branch: string
  pushedAt: number
  runId?: number
  phase: 'waiting' | 'running' | 'done'
  outcome?: string
  wokeAt?: number
  isReplay?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'tourism-status': {
      snapshot: TourismSnapshot
      watches: Record<string, CiWatch>
      wakes: number[]
    }
  }
}
```

`<MOD>/src/config.ts`:

```ts
// Cấu hình của mod: ngưỡng, nhịp, đường dẫn. Sửa file này là mod tự nạp lại.
export const CONFIG = {
  // .git chung của repo (checkout gốc và mọi worktree), đã chuẩn hoá bằng normalizePath
  repoCommonDir: 'c:/programming/devs/projects/tourism-platform-v2/.git',
  freezeDate: '2026-10-15',
  utcOffsetHours: 7,
  ramWarnGB: 6,
  ramErrorGB: 3,
  diskWarnGB: 30,
  diskErrorGB: 15,
  masterTickMs: 15_000,
  fastEveryMs: 60_000,
  ciEveryMs: 120_000,
  idleAfterMs: 15 * 60_000,
  idleEveryMs: 5 * 60_000,
  watchAppearEveryMs: 15_000,
  watchRunEveryMs: 30_000,
  watchAppearTimeoutMs: 3 * 60_000,
  watchMaxMs: 30 * 60_000,
  wakeMaxPerHour: 3,
  ghFailSlowAfter: 3,
  ghFailSlowerAfter: 6,
  peerFreshMs: 3 * 60_000,
  peerPruneDays: 7,
  dbContainer: 'tourism-v2-postgres',
  apiUrl: 'http://localhost:3001/',
  envApps: ['api', 'web', 'admin', 'mobile'],
  ciWorkflow: 'ci.yml',
  timeouts: { git: 10_000, gh: 20_000, pwsh: 15_000, docker: 10_000, fetch: 30_000 },
} as const
```

`<MOD>/tests/eq.ts`:

```ts
import { expect } from 'claude-code/testing'

// Sắp khoá object để JSON so được bất kể thứ tự khoá
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable)
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return Object.fromEntries(Object.keys(o).sort().map(k => [k, stable(o[k])]))
  }
  return v
}

// So sánh cấu trúc chỉ bằng matcher toBe (matcher chắc chắn có trong kit)
export function eq(actual: unknown, expected: unknown): void {
  expect(JSON.stringify(stable(actual))).toBe(JSON.stringify(stable(expected)))
}
```

`<MOD>/dev.sh`:

```bash
#!/usr/bin/env bash
# Chạy test hoặc validate của mod bằng claude.exe đi kèm app (CLI không có trên PATH)
set -euo pipefail
MOD="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_EXE=$(ls -d "$(cygpath -u "$LOCALAPPDATA")"/Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude/claude-code/*/*/claude.exe | sort -V | tail -1)
case "${1:-test}" in
  test) "$CLAUDE_EXE" plugin test "$MOD" ;;
  validate) "$CLAUDE_EXE" plugin validate "$MOD" ;;
  *) echo "dùng: bash dev.sh test|validate"; exit 2 ;;
esac
```

`<MOD>/.gitignore`:

```gitignore
# File engine tự ghi mỗi lần nạp mod
.claude-plugin/types/
tsconfig.json
```

- [ ] **Step 2: Viết test cho đường dẫn và output git (chưa có code)**

`<MOD>/tests/git.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'
import { parseAheadBehind, parseGitStatus } from '../src/logic/git'
import { normalizePath } from '../src/logic/paths'
import { eq } from './eq'

describe('normalizePath', () => {
  test('đổi gạch ngược, chữ thường, bỏ gạch cuối và xuống dòng', () => {
    expect(normalizePath('C:\\Programming\\Devs\\Projects\\Tourism-Platform-V2\\.git')).toBe(
      'c:/programming/devs/projects/tourism-platform-v2/.git',
    )
    expect(normalizePath('C:/Programming/Devs/Projects/Tourism-Platform-V2/.git/\n')).toBe(
      'c:/programming/devs/projects/tourism-platform-v2/.git',
    )
  })
})

describe('parseGitStatus', () => {
  test('nhánh có upstream, cây bẩn: đếm file sửa, đổi tên, xung đột, chưa theo dõi; bỏ file ignore', () => {
    const out = [
      '# branch.oid 09f0201',
      '# branch.head feat/p4e-4-posts-admin',
      '# branch.upstream origin/feat/p4e-4-posts-admin',
      '# branch.ab +0 -0',
      '1 .M N... 100644 100644 100644 aaa bbb apps/web/a.tsx',
      '2 R. N... 100644 100644 100644 ccc ddd R100 b.ts\tc.ts',
      'u UU N... 100644 100644 100644 100644 e f g h d.ts',
      '? apps/web/new.tsx',
      '! ignored.log',
    ].join('\n')
    eq(parseGitStatus(out), { branch: 'feat/p4e-4-posts-admin', upstream: 'origin/feat/p4e-4-posts-admin', dirty: 4 })
  })

  test('nhánh chưa có upstream, cây sạch', () => {
    eq(parseGitStatus('# branch.oid abc\n# branch.head main\n'), { branch: 'main', dirty: 0 })
  })

  test('detached HEAD giữ nguyên chữ git trả', () => {
    expect(parseGitStatus('# branch.head (detached)\n').branch).toBe('(detached)')
  })
})

describe('parseAheadBehind', () => {
  test('trái là số commit HEAD đang thiếu (behind), phải là số commit HEAD dư (ahead)', () => {
    eq(parseAheadBehind('2\t5\n'), { ahead: 5, behind: 2 })
  })

  test('output lạ thì ném lỗi để nhóm git hiện "?"', () => {
    let thrown = false
    try {
      parseAheadBehind('fatal: bad revision')
    } catch {
      thrown = true
    }
    expect(thrown).toBe(true)
  })
})
```

- [ ] **Step 3: Chạy test, thấy đỏ**

Run: `bash "<MOD>/dev.sh" test`
Expected: FAIL — không import được `../src/logic/git` và `../src/logic/paths` (file chưa có).

- [ ] **Step 4: Viết code tối thiểu**

`<MOD>/src/logic/paths.ts`:

```ts
// Chuẩn hoá đường dẫn Windows để so sánh: gạch chéo xuôi, chữ thường, bỏ gạch cuối
export function normalizePath(p: string): string {
  return p.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}
```

`<MOD>/src/logic/git.ts`:

```ts
// Đọc output của git thành dữ liệu sạch; không gọi $, test được bằng chuỗi mẫu
export type GitStatus = { branch: string; upstream?: string; dirty: number }

// Output của `git status --porcelain=v2 --branch`
export function parseGitStatus(out: string): GitStatus {
  let branch = '(không rõ)'
  let upstream: string | undefined
  let dirty = 0
  for (const line of out.split(/\r?\n/)) {
    if (line.startsWith('# branch.head ')) branch = line.slice('# branch.head '.length).trim()
    else if (line.startsWith('# branch.upstream ')) upstream = line.slice('# branch.upstream '.length).trim()
    else if (/^[12u?] /.test(line)) dirty += 1
  }
  return upstream === undefined ? { branch, dirty } : { branch, upstream, dirty }
}

// Output của `git rev-list --left-right --count origin/main...HEAD` dạng "trái<TAB>phải":
// trái = commit chỉ origin/main có (HEAD đang thiếu), phải = commit chỉ HEAD có
export function parseAheadBehind(out: string): { ahead: number; behind: number } {
  const m = out.trim().match(/^(\d+)\s+(\d+)$/)
  if (!m) throw new Error(`rev-list trả output lạ: ${out.trim().slice(0, 60)}`)
  return { ahead: Number(m[2]), behind: Number(m[1]) }
}
```

- [ ] **Step 5: Chạy test và validate, thấy xanh**

Run: `bash "<MOD>/dev.sh" test` → Expected: PASS, 6 test xanh.
Run: `bash "<MOD>/dev.sh" validate` → Expected: không lỗi; state `tourism-status` có `snapshot`,
`watches`, `wakes`.

- [ ] **Step 6: Khởi tạo git của mod và commit**

```bash
cd "<MOD>" && git init -q && git add .gitignore .claude-plugin/plugin.json hooks/hooks.json hooks/register.tsx types/index.d.ts src/config.ts src/logic/paths.ts src/logic/git.ts tests/eq.ts tests/git.test.ts dev.sh && git commit -q -m "feat: khung mod tourism-status, hợp đồng state và đọc output git"
```

---

### Task 2: Đọc output `gh` (run CI, trung vị, kết cục, bước hỏng)

**Files:**
- Create: `<MOD>/src/logic/ci.ts`
- Create: `<MOD>/tests/ci.test.ts`

**Interfaces:**
- Consumes: `eq` (Task 1).
- Produces:
  - `type CiRun = { id: number; status: string; conclusion: string | null; sha: string; createdAt: string; updatedAt: string; url: string }`
  - `type Outcome = 'success' | 'failure' | 'cancelled' | 'running' | 'other'`
  - `parseRuns(json: string): CiRun[]`, `runMinutes(run: CiRun): number`,
    `medianMinutes(runs: CiRun[], fallback?: number): number`, `outcomeOf(run: CiRun): Outcome`,
    `failedStep(jobsJson: string): string | undefined`.

- [ ] **Step 1: Viết test**

`<MOD>/tests/ci.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'
import { failedStep, medianMinutes, outcomeOf, parseRuns } from '../src/logic/ci'
import { eq } from './eq'

// Một run dạng gh trả, mặc định xanh và mất 9 phút
const gh = (o: Record<string, unknown> = {}) => ({
  databaseId: 1,
  status: 'completed',
  conclusion: 'success',
  headSha: 'a'.repeat(40),
  createdAt: '2026-10-02T04:00:00Z',
  updatedAt: '2026-10-02T04:09:00Z',
  url: 'https://github.com/o/r/actions/runs/1',
  ...o,
})

describe('parseRuns', () => {
  test('đổi tên trường và coi conclusion rỗng (run đang chạy) là null', () => {
    const runs = parseRuns(JSON.stringify([gh({ databaseId: 7, status: 'in_progress', conclusion: '' })]))
    expect(runs.length).toBe(1)
    expect(runs[0]?.id).toBe(7)
    expect(runs[0]?.conclusion).toBe(null)
    expect(runs[0]?.sha).toBe('a'.repeat(40))
  })

  test('mảng rỗng', () => {
    eq(parseRuns('[]'), [])
  })

  test('JSON hỏng hoặc không phải mảng thì ném lỗi', () => {
    let a = false
    let b = false
    try {
      parseRuns('not json')
    } catch {
      a = true
    }
    try {
      parseRuns('{"x":1}')
    } catch {
      b = true
    }
    expect(a).toBe(true)
    expect(b).toBe(true)
  })
})

describe('medianMinutes', () => {
  test('số run chẵn lấy trung bình hai số giữa; bỏ run chưa xong', () => {
    const mins = [7, 8, 9, 9, 10, 10, 10, 11]
    const runs = parseRuns(
      JSON.stringify([
        ...mins.map((m, i) => gh({ databaseId: i, updatedAt: `2026-10-02T04:${String(m).padStart(2, '0')}:00Z` })),
        gh({ databaseId: 99, status: 'in_progress', conclusion: '' }),
      ]),
    )
    expect(medianMinutes(runs)).toBe(9.5)
  })

  test('chưa có run nào xong thì trả fallback', () => {
    expect(medianMinutes([], 10)).toBe(10)
  })
})

describe('outcomeOf', () => {
  test('phân đủ năm nhóm', () => {
    const one = (o: Record<string, unknown>) => outcomeOf(parseRuns(JSON.stringify([gh(o)]))[0] ?? ({} as never))
    expect(one({})).toBe('success')
    expect(one({ conclusion: 'failure' })).toBe('failure')
    expect(one({ conclusion: 'timed_out' })).toBe('failure')
    expect(one({ conclusion: 'startup_failure' })).toBe('failure')
    expect(one({ conclusion: 'cancelled' })).toBe('cancelled')
    expect(one({ conclusion: 'skipped' })).toBe('other')
    expect(one({ status: 'in_progress', conclusion: '' })).toBe('running')
  })
})

describe('failedStep', () => {
  test('trả "job › bước" hỏng đầu tiên', () => {
    const json = JSON.stringify({
      jobs: [
        {
          name: 'gate',
          conclusion: 'failure',
          steps: [
            { name: 'Checkout', conclusion: 'success' },
            { name: 'Unit tests', conclusion: 'failure' },
          ],
        },
      ],
    })
    expect(failedStep(json)).toBe('gate › Unit tests')
  })

  test('job hỏng mà không bước nào hỏng thì trả tên job', () => {
    expect(failedStep(JSON.stringify({ jobs: [{ name: 'gate', conclusion: 'failure', steps: [] }] }))).toBe('gate')
  })

  test('không có gì hỏng thì undefined', () => {
    expect(failedStep(JSON.stringify({ jobs: [{ name: 'gate', conclusion: 'success' }] }))).toBe(undefined)
  })
})
```

- [ ] **Step 2: Chạy test, thấy đỏ**

Run: `bash "<MOD>/dev.sh" test`
Expected: FAIL — không import được `../src/logic/ci`.

- [ ] **Step 3: Viết code**

`<MOD>/src/logic/ci.ts`:

```ts
// Đọc output của gh thành dữ liệu sạch
export type CiRun = {
  id: number
  status: string
  conclusion: string | null
  sha: string
  createdAt: string
  updatedAt: string
  url: string
}

export type Outcome = 'success' | 'failure' | 'cancelled' | 'running' | 'other'

type GhRun = {
  databaseId: number
  status: string
  conclusion: string | null
  headSha: string
  createdAt: string
  updatedAt: string
  url: string
}

// JSON của `gh run list --json databaseId,status,conclusion,headSha,createdAt,updatedAt,url`
export function parseRuns(json: string): CiRun[] {
  const data: unknown = JSON.parse(json)
  if (!Array.isArray(data)) throw new Error('gh run list không trả mảng')
  return (data as GhRun[]).map(r => ({
    id: r.databaseId,
    status: r.status,
    conclusion: r.conclusion === '' ? null : r.conclusion,
    sha: r.headSha,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    url: r.url,
  }))
}

// Số phút từ lúc tạo tới lần cập nhật cuối của run
export function runMinutes(run: CiRun): number {
  return Math.max(0, Math.round((Date.parse(run.updatedAt) - Date.parse(run.createdAt)) / 60_000))
}

// Trung vị số phút của các run đã xong; chưa có run nào xong thì trả fallback
export function medianMinutes(runs: CiRun[], fallback = 10): number {
  const mins = runs
    .filter(r => r.status === 'completed')
    .map(runMinutes)
    .sort((a, b) => a - b)
  if (mins.length === 0) return fallback
  const mid = Math.floor(mins.length / 2)
  const hi = mins[mid] ?? fallback
  const lo = mins[mid - 1] ?? hi
  return mins.length % 2 === 1 ? hi : (lo + hi) / 2
}

export function outcomeOf(run: CiRun): Outcome {
  if (run.status !== 'completed') return 'running'
  if (run.conclusion === 'success') return 'success'
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'startup_failure') return 'failure'
  if (run.conclusion === 'cancelled') return 'cancelled'
  return 'other'
}

type GhJobs = {
  jobs?: { name: string; conclusion: string | null; steps?: { name: string; conclusion: string | null }[] }[]
}

// JSON của `gh run view <id> --json jobs`: "job › bước" đầu tiên hỏng
export function failedStep(jobsJson: string): string | undefined {
  const data = JSON.parse(jobsJson) as GhJobs
  for (const job of data.jobs ?? []) {
    const step = (job.steps ?? []).find(s => s.conclusion === 'failure')
    if (step) return `${job.name} › ${step.name}`
    if (job.conclusion === 'failure') return job.name
  }
  return undefined
}
```

- [ ] **Step 4: Chạy test, thấy xanh**

Run: `bash "<MOD>/dev.sh" test` → Expected: PASS (6 test cũ và 9 test mới).

- [ ] **Step 5: Commit**

```bash
cd "<MOD>" && git add src/logic/ci.ts tests/ci.test.ts && git commit -q -m "feat: đọc run CI từ gh, trung vị thời gian, kết cục và bước hỏng"
```

---

### Task 3: Nhận ra push, ref được đẩy và ff-merge

**Files:**
- Create: `<MOD>/src/logic/push.ts`
- Create: `<MOD>/tests/push.test.ts`

**Interfaces:**
- Consumes: `eq` (Task 1).
- Produces:
  - `type PushRef = { src: string; dst: string; newSha?: string }`
  - `isGitPush(cmd: string): boolean`, `isWatchablePush(cmd: string): boolean`,
    `parsePushOutput(text: string): PushRef[]`,
    `parsePushTargets(cmd: string, currentBranch: string): PushRef[]`,
    `isFfMergeIntoMain(cmd: string, branchAfter: string): boolean`.

- [ ] **Step 1: Viết test**

`<MOD>/tests/push.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'
import { isFfMergeIntoMain, isGitPush, isWatchablePush, parsePushOutput, parsePushTargets } from '../src/logic/push'
import { eq } from './eq'

describe('isGitPush', () => {
  test('nhận ra push trong lệnh ghép, kể cả git -C và chuyển hướng', () => {
    expect(isGitPush('cd "C:/x" && git push origin c6da3c7f:main 2>&1 | tail -2')).toBe(true)
    expect(isGitPush('git -C /c/repo push -q origin main')).toBe(true)
  })

  test('không nhầm chữ push nằm ở chỗ khác', () => {
    expect(isGitPush('git log --grep=push')).toBe(false)
    expect(isGitPush('echo "git push sau"')).toBe(false)
    expect(isGitPush('pnpm gate:int')).toBe(false)
  })
})

describe('isWatchablePush', () => {
  test('push thường thì canh', () => {
    expect(isWatchablePush('git push origin abc1234:main')).toBe(true)
  })

  test('dry-run, xoá nhánh, tags, all, mirror thì không canh', () => {
    expect(isWatchablePush('git push --dry-run origin abc1234:main')).toBe(false)
    expect(isWatchablePush('git push -n origin main')).toBe(false)
    expect(isWatchablePush('git push origin --delete feat/x')).toBe(false)
    expect(isWatchablePush('git push -d origin feat/x')).toBe(false)
    expect(isWatchablePush('git push --tags')).toBe(false)
    expect(isWatchablePush('git push --all origin')).toBe(false)
    expect(isWatchablePush('git push --mirror origin')).toBe(false)
  })
})

describe('parsePushTargets', () => {
  test('refspec <nguồn>:<đích>', () => {
    eq(parsePushTargets('git push origin c6da3c7f:main', 'feat/x'), [{ src: 'c6da3c7f', dst: 'main' }])
    eq(parsePushTargets('git push origin HEAD:main', 'feat/x'), [{ src: 'HEAD', dst: 'main' }])
  })

  test('chỉ tên nhánh, kèm cờ -u', () => {
    eq(parsePushTargets('git push -u origin feat/x', 'main'), [{ src: 'feat/x', dst: 'feat/x' }])
  })

  test('push trần hoặc chỉ có remote thì là nhánh hiện tại', () => {
    eq(parsePushTargets('git push', 'main'), [{ src: 'main', dst: 'main' }])
    eq(parsePushTargets('git push origin', 'feat/y'), [{ src: 'feat/y', dst: 'feat/y' }])
  })

  test('bỏ dấu + và tiền tố refs/heads/', () => {
    eq(parsePushTargets('git push -q origin +feat/x:refs/heads/feat/x', 'main'), [{ src: 'feat/x', dst: 'feat/x' }])
  })

  test('cờ có giá trị như -o không bị nhầm thành remote', () => {
    eq(parsePushTargets('git push -o ci.skip origin main', 'feat/x'), [{ src: 'main', dst: 'main' }])
  })

  test('không phải push thì rỗng', () => {
    eq(parsePushTargets('git status', 'main'), [])
  })
})

describe('parsePushOutput', () => {
  test('dòng cập nhật thường: lấy SHA mới', () => {
    const text = 'To https://github.com/o/r.git\n   c921bf76..a9544671  a9544671a5a30847ec9930fd1bded88934a8cf72 -> main'
    eq(parsePushOutput(text), [{ src: 'a9544671a5a30847ec9930fd1bded88934a8cf72', dst: 'main', newSha: 'a9544671' }])
  })

  test('nhánh mới: chưa có SHA, lấy nguồn', () => {
    eq(parsePushOutput(' * [new branch]      feat/x -> feat/x'), [{ src: 'feat/x', dst: 'feat/x' }])
  })

  test('cập nhật ép (forced update) dùng ba chấm', () => {
    eq(parsePushOutput(' + 1111111...2222222 feat/x -> feat/x (forced update)'), [{ src: 'feat/x', dst: 'feat/x', newSha: '2222222' }])
  })

  test('không có gì được đẩy thì rỗng', () => {
    eq(parsePushOutput('Everything up-to-date'), [])
    eq(parsePushOutput(' ! [rejected]        main -> main (fetch first)'), [])
  })
})

describe('isFfMergeIntoMain', () => {
  test('ff-merge khi đang ở main', () => {
    expect(isFfMergeIntoMain('git switch main && git merge --ff-only feat/x', 'main')).toBe(true)
  })

  test('ở nhánh khác, hoặc merge không ff-only, thì không', () => {
    expect(isFfMergeIntoMain('git merge --ff-only feat/x', 'feat/y')).toBe(false)
    expect(isFfMergeIntoMain('git merge feat/x', 'main')).toBe(false)
  })
})
```

- [ ] **Step 2: Chạy test, thấy đỏ**

Run: `bash "<MOD>/dev.sh" test`
Expected: FAIL — không import được `../src/logic/push`.

- [ ] **Step 3: Viết code**

`<MOD>/src/logic/push.ts`:

```ts
// Nhận ra lệnh git push / merge và các ref được đẩy; không gọi $
export type PushRef = { src: string; dst: string; newSha?: string }

// Tách lệnh ghép thành từng đoạn theo && || ; | và xuống dòng
function segments(cmd: string): string[] {
  return cmd
    .split(/&&|\|\||;|\||\n/)
    .map(s => s.trim())
    .filter(Boolean)
}

// Tách token, bỏ ngoặc bao quanh, bỏ phần chuyển hướng như 2>&1 hay >/dev/null
function tokens(segment: string): string[] {
  return (segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? [])
    .map(t => t.replace(/^["']|["']$/g, ''))
    .filter(t => !/^\d*[<>]/.test(t))
}

const isGitExe = (t: string): boolean => t === 'git' || /[\\/]git(\.exe)?$/i.test(t) || /^git\.exe$/i.test(t)

// Các token sau chữ "push" của đoạn dạng git [-C dir] [-c k=v] [--cờ-chung] push ...
function pushArgs(cmd: string): string[] | undefined {
  for (const seg of segments(cmd)) {
    const t = tokens(seg)
    const gi = t.findIndex(isGitExe)
    if (gi < 0) continue
    let i = gi + 1
    while (i < t.length && (t[i] === '-C' || t[i] === '-c')) i += 2
    while (i < t.length && (t[i] ?? '').startsWith('--')) i += 1
    if (t[i] === 'push') return t.slice(i + 1)
  }
  return undefined
}

export function isGitPush(cmd: string): boolean {
  return pushArgs(cmd) !== undefined
}

const NO_WATCH = new Set(['--dry-run', '-n', '--delete', '-d', '--tags', '--all', '--mirror'])

// Push có tạo commit mới trên GitHub để CI chạy không (dry-run, xoá, tags… thì không)
export function isWatchablePush(cmd: string): boolean {
  const args = pushArgs(cmd)
  return args !== undefined && !args.some(a => NO_WATCH.has(a))
}

const VALUE_FLAGS = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec'])
const stripHeads = (r: string): string => r.replace(/^refs\/heads\//, '')

// Ref đích đọc từ chính câu lệnh (dùng khi push không in output, ví dụ có -q)
export function parsePushTargets(cmd: string, currentBranch: string): PushRef[] {
  const args = pushArgs(cmd)
  if (!args) return []
  const positional: string[] = []
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i] ?? ''
    if (VALUE_FLAGS.has(a)) {
      i += 1
      continue
    }
    if (a.startsWith('-')) continue
    positional.push(a)
  }
  const refspecs = positional.slice(1) // positional[0] là remote
  if (refspecs.length === 0) return [{ src: currentBranch, dst: currentBranch }]
  return refspecs.map(spec => {
    const [src = '', dst] = spec.replace(/^\+/, '').split(':')
    return { src: stripHeads(src), dst: stripHeads(dst ?? src) }
  })
}

// Output của git push (git in ra stderr; tool Bash gộp hai luồng)
export function parsePushOutput(text: string): PushRef[] {
  const refs: PushRef[] = []
  for (const line of text.split(/\r?\n/)) {
    const upd = line.match(/^\s*[+ ]?\s*([0-9a-f]{7,40})\.{2,3}([0-9a-f]{7,40})\s+(\S+)\s+->\s+(\S+)/)
    if (upd) {
      refs.push({ src: upd[3] ?? '', dst: stripHeads(upd[4] ?? ''), newSha: upd[2] ?? '' })
      continue
    }
    const fresh = line.match(/^\s*\*\s+\[new branch\]\s+(\S+)\s+->\s+(\S+)/)
    if (fresh) refs.push({ src: fresh[1] ?? '', dst: stripHeads(fresh[2] ?? '') })
  }
  return refs
}

// Lệnh vừa chạy có ff-merge vào main không (dùng để nhắc docs sweep)
export function isFfMergeIntoMain(cmd: string, branchAfter: string): boolean {
  return branchAfter === 'main' && segments(cmd).some(seg => /(^|\s)git\b.*\bmerge\b.*--ff-only/.test(seg))
}
```

- [ ] **Step 4: Chạy test, thấy xanh**

Run: `bash "<MOD>/dev.sh" test` → Expected: PASS (thêm 15 test của push).

- [ ] **Step 5: Commit**

```bash
cd "<MOD>" && git add src/logic/push.ts tests/push.test.ts && git commit -q -m "feat: nhận ra git push, ref được đẩy và ff-merge vào main"
```

---

### Task 4: Docs-freshness theo commit, câu chữ thông báo, bộ chống đánh thức lặp

**Files:**
- Create: `<MOD>/src/logic/freshness.ts`
- Create: `<MOD>/src/logic/messages.ts`
- Create: `<MOD>/src/logic/wake.ts`
- Create: `<MOD>/tests/freshness.test.ts`
- Create: `<MOD>/tests/messages.test.ts`
- Create: `<MOD>/tests/wake.test.ts`

**Interfaces:**
- Consumes: `Outcome` (Task 2), `CiWatch` (Task 1), `eq` (Task 1).
- Produces:
  - `type FreshnessVerdict = { ok: boolean; date?: string; unlogged: string[] }`,
    `latestChangelogDate(text: string): string | undefined`,
    `freshnessLogArgs(sha: string, date: string): string[]`,
    `freshnessVerdict(date: string | undefined, logOut: string): FreshnessVerdict`.
  - `type OutcomeReport = { sha: string; branch: string; outcome: Outcome | 'missing' | 'timeout'; runId?: number; minutes?: number; step?: string; conclusion?: string | null }`,
    `sha7`, `watchNote`, `MERGE_NOTE`, `freshnessNote`, `freshnessToast`, `outcomeNote`,
    `outcomeToast`, `wakePrompt`.
  - `pruneWakes(wakes: number[], nowMs: number): number[]`,
    `canWake(watch: CiWatch, wakes: number[], nowMs: number, maxPerHour: number): boolean`.

- [ ] **Step 1: Viết test**

`<MOD>/tests/freshness.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'
import { freshnessLogArgs, freshnessVerdict, latestChangelogDate } from '../src/logic/freshness'
import { eq } from './eq'

describe('latestChangelogDate', () => {
  test('lấy ngày của entry "## YYYY-MM-DD" đầu tiên, như grep -m1 của script', () => {
    const md = '# CHANGELOG\n\nGhi chú đầu file.\n\n## 2026-10-01 — G21\n\n- a\n\n## 2026-09-30 — F19\n'
    expect(latestChangelogDate(md)).toBe('2026-10-01')
  })

  test('không có entry thì undefined', () => {
    expect(latestChangelogDate('# CHANGELOG\n\nchưa có gì\n')).toBe(undefined)
  })
})

describe('freshnessLogArgs', () => {
  test('khớp từng cờ của scripts/docs-freshness.sh, thêm SHA cần kiểm', () => {
    eq(freshnessLogArgs('abc1234', '2026-10-01'), [
      'log',
      'abc1234',
      '--since=2026-10-01 23:59:59',
      '--pretty=format:%h %s',
      '--grep=^feat',
      '--grep=^fix',
      '--extended-regexp',
    ])
  })
})

describe('freshnessVerdict', () => {
  test('không còn commit chưa kể thì xanh', () => {
    eq(freshnessVerdict('2026-10-01', ''), { ok: true, date: '2026-10-01', unlogged: [] })
  })

  test('còn commit feat/fix chưa kể thì đỏ, giữ danh sách', () => {
    eq(freshnessVerdict('2026-10-01', 'a1b2c3d feat(api): x\n9f8e7d6 fix(web): y\n'), {
      ok: false,
      date: '2026-10-01',
      unlogged: ['a1b2c3d feat(api): x', '9f8e7d6 fix(web): y'],
    })
  })

  test('CHANGELOG không có entry thì đỏ, như script', () => {
    eq(freshnessVerdict(undefined, ''), { ok: false, unlogged: [] })
  })
})
```

`<MOD>/tests/messages.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'
import { freshnessNote, freshnessToast, outcomeNote, outcomeToast, wakePrompt, watchNote } from '../src/logic/messages'

const SHA = 'aede381d'.padEnd(40, '0')

describe('câu chữ cho Claude và cho user', () => {
  test('ghi chú sau push dặn không tự poll', () => {
    expect(watchNote(SHA, 'main')).toBe(
      'tourism-status đang canh CI cho aede381 (main) và sẽ ghi chú vào hội thoại khi xong; không cần tự gọi gh run list.',
    )
  })

  test('kết cục xanh và đỏ', () => {
    expect(outcomeNote({ sha: SHA, branch: 'main', outcome: 'success', runId: 5, minutes: 9 })).toBe(
      '[tourism-status] CI xanh: aede381 trên main (run 5, 9 phút).',
    )
    expect(outcomeNote({ sha: SHA, branch: 'main', outcome: 'failure', runId: 5, step: 'gate › Unit tests' })).toBe(
      '[tourism-status] CI đỏ: aede381 trên main (run 5, bước hỏng: gate › Unit tests).',
    )
    expect(outcomeToast({ sha: SHA, branch: 'main', outcome: 'success', runId: 5, minutes: 9 })).toBe('CI xanh · aede381 · 9 phút')
    expect(outcomeToast({ sha: SHA, branch: 'main', outcome: 'failure', runId: 5 })).toBe('CI đỏ · aede381')
  })

  test('bị huỷ, không thấy run, quá giờ, kết cục khác', () => {
    expect(outcomeNote({ sha: SHA, branch: 'feat/x', outcome: 'cancelled' })).toBe(
      '[tourism-status] CI của aede381 bị huỷ vì có push mới hơn trên feat/x.',
    )
    expect(outcomeNote({ sha: SHA, branch: 'main', outcome: 'missing' })).toBe('[tourism-status] Không thấy CI cho aede381 sau 3 phút; mod thôi canh.')
    expect(outcomeNote({ sha: SHA, branch: 'main', outcome: 'timeout' })).toBe('[tourism-status] CI của aede381 chạy quá 30 phút; mod thôi canh.')
    expect(outcomeNote({ sha: SHA, branch: 'main', outcome: 'other', conclusion: 'skipped' })).toBe(
      '[tourism-status] CI của aede381 kết thúc với trạng thái skipped.',
    )
  })

  test('lượt đánh thức dặn chưa sửa, chưa push', () => {
    expect(wakePrompt({ sha: SHA, branch: 'main', outcome: 'failure', runId: 5, step: 'gate › Unit tests' })).toBe(
      'CI đỏ ở aede381 (main, run 5, bước gate › Unit tests). Đọc log bằng `gh run view 5 --log-failed`, tóm tắt nguyên nhân và đề xuất cách vá. Chưa sửa code, chưa push.',
    )
  })

  test('docs-freshness: có và không có entry', () => {
    const red = { ok: false, date: '2026-10-01', unlogged: ['a1b2c3d feat(api): x'] }
    expect(freshnessNote(red)).toBe('docs-freshness sẽ đỏ trên CI: entry CHANGELOG mới nhất 2026-10-01, còn commit feat/fix chưa kể: a1b2c3d feat(api): x.')
    expect(freshnessToast(red)).toBe('docs-freshness sẽ đỏ: còn 1 commit feat/fix chưa kể')
    expect(freshnessToast({ ok: false, unlogged: [] })).toBe('docs-freshness sẽ đỏ: CHANGELOG không có entry')
  })
})
```

`<MOD>/tests/wake.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'
import type { CiWatch } from '../types'
import { canWake, pruneWakes } from '../src/logic/wake'
import { eq } from './eq'

const NOW = 10 * 60 * 60_000
const W: CiWatch = { sha: 'a'.repeat(40), branch: 'main', pushedAt: NOW - 600_000, phase: 'done' }

describe('chống đánh thức lặp', () => {
  test('chưa đánh thức lần nào thì được', () => {
    expect(canWake(W, [], NOW, 3)).toBe(true)
  })

  test('SHA đã đánh thức thì thôi', () => {
    expect(canWake({ ...W, wokeAt: NOW - 1000 }, [], NOW, 3)).toBe(false)
  })

  test('đủ 3 lần trong 60 phút thì thôi; lần cũ hơn 60 phút không tính', () => {
    expect(canWake(W, [NOW - 1000, NOW - 2000, NOW - 3000], NOW, 3)).toBe(false)
    expect(canWake(W, [NOW - 1000, NOW - 2000, NOW - 61 * 60_000], NOW, 3)).toBe(true)
  })

  test('pruneWakes bỏ mốc cũ hơn một giờ', () => {
    eq(pruneWakes([NOW - 61 * 60_000, NOW - 5000], NOW), [NOW - 5000])
  })
})
```

- [ ] **Step 2: Chạy test, thấy đỏ**

Run: `bash "<MOD>/dev.sh" test`
Expected: FAIL — không import được `freshness`, `messages`, `wake`.

- [ ] **Step 3: Viết code**

`<MOD>/src/logic/freshness.ts`:

```ts
// Kiểm giống scripts/docs-freshness.sh nhưng trên một commit cụ thể (spec §4.5 chốt 2)
export type FreshnessVerdict = { ok: boolean; date?: string; unlogged: string[] }

// Ngày của entry đầu tiên dạng "## YYYY-MM-DD", như `grep -m1` của script
export function latestChangelogDate(changelog: string): string | undefined {
  return changelog.match(/^## (\d{4}-\d{2}-\d{2})/m)?.[1]
}

// argv cho git log, khớp từng cờ với script; nơi gọi chạy với TZ=UTC như máy CI
export function freshnessLogArgs(sha: string, date: string): string[] {
  return ['log', sha, `--since=${date} 23:59:59`, '--pretty=format:%h %s', '--grep=^feat', '--grep=^fix', '--extended-regexp']
}

export function freshnessVerdict(date: string | undefined, logOut: string): FreshnessVerdict {
  if (date === undefined) return { ok: false, unlogged: [] }
  const unlogged = logOut
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
  return { ok: unlogged.length === 0, date, unlogged }
}
```

`<MOD>/src/logic/messages.ts`:

```ts
import type { Outcome } from './ci'
import type { FreshnessVerdict } from './freshness'

// Mọi câu chữ mod gửi cho user (toast) và cho Claude (ghi chú, context, lượt đánh thức)
export type OutcomeReport = {
  sha: string
  branch: string
  outcome: Outcome | 'missing' | 'timeout'
  runId?: number
  minutes?: number
  step?: string
  conclusion?: string | null
}

export const sha7 = (sha: string): string => sha.slice(0, 7)

export function watchNote(sha: string, branch: string): string {
  return `tourism-status đang canh CI cho ${sha7(sha)} (${branch}) và sẽ ghi chú vào hội thoại khi xong; không cần tự gọi gh run list.`
}

export const MERGE_NOTE =
  'Vừa ff-merge vào main. Luật 13: thêm entry docs/CHANGELOG.md (ngày · hash · nội dung · review findings · số test), cập nhật doc hiện trạng bị ảnh hưởng, thêm doc mới vào docs/README.md.'

export function freshnessNote(v: FreshnessVerdict): string {
  if (v.date === undefined) return 'docs-freshness sẽ đỏ trên CI: docs/CHANGELOG.md của commit này không có entry dạng "## YYYY-MM-DD".'
  return `docs-freshness sẽ đỏ trên CI: entry CHANGELOG mới nhất ${v.date}, còn commit feat/fix chưa kể: ${v.unlogged.join('; ')}.`
}

export function freshnessToast(v: FreshnessVerdict): string {
  if (v.date === undefined) return 'docs-freshness sẽ đỏ: CHANGELOG không có entry'
  return `docs-freshness sẽ đỏ: còn ${v.unlogged.length} commit feat/fix chưa kể`
}

const runPart = (r: OutcomeReport): string => `run ${r.runId ?? '?'}`

export function outcomeNote(r: OutcomeReport): string {
  const s = sha7(r.sha)
  switch (r.outcome) {
    case 'success':
      return `[tourism-status] CI xanh: ${s} trên ${r.branch} (${runPart(r)}, ${r.minutes ?? '?'} phút).`
    case 'failure':
      return `[tourism-status] CI đỏ: ${s} trên ${r.branch} (${runPart(r)}${r.step ? `, bước hỏng: ${r.step}` : ''}).`
    case 'cancelled':
      return `[tourism-status] CI của ${s} bị huỷ vì có push mới hơn trên ${r.branch}.`
    case 'missing':
      return `[tourism-status] Không thấy CI cho ${s} sau 3 phút; mod thôi canh.`
    case 'timeout':
      return `[tourism-status] CI của ${s} chạy quá 30 phút; mod thôi canh.`
    default:
      return `[tourism-status] CI của ${s} kết thúc với trạng thái ${r.conclusion ?? 'không rõ'}.`
  }
}

export function outcomeToast(r: OutcomeReport): string {
  const s = sha7(r.sha)
  switch (r.outcome) {
    case 'success':
      return `CI xanh · ${s} · ${r.minutes ?? '?'} phút`
    case 'failure':
      return `CI đỏ · ${s}${r.step ? ` · ${r.step}` : ''}`
    case 'cancelled':
      return `CI ${s} bị huỷ (có push mới hơn)`
    case 'missing':
      return `CI ${s}: thôi canh (không thấy run)`
    case 'timeout':
      return `CI ${s}: thôi canh (quá 30 phút)`
    default:
      return `CI ${s}: ${r.conclusion ?? 'không rõ'}`
  }
}

export function wakePrompt(r: OutcomeReport): string {
  const id = r.runId ?? 0
  return `CI đỏ ở ${sha7(r.sha)} (${r.branch}, run ${id}${r.step ? `, bước ${r.step}` : ''}). Đọc log bằng \`gh run view ${id} --log-failed\`, tóm tắt nguyên nhân và đề xuất cách vá. Chưa sửa code, chưa push.`
}
```

`<MOD>/src/logic/wake.ts`:

```ts
import type { CiWatch } from '../../types'

const HOUR = 60 * 60_000

// Bỏ các mốc đánh thức cũ hơn một giờ
export function pruneWakes(wakes: number[], nowMs: number): number[] {
  return wakes.filter(t => nowMs - t < HOUR)
}

// Mỗi SHA đánh thức tối đa một lần; mỗi phiên tối đa maxPerHour lần trong 60 phút
export function canWake(watch: CiWatch, wakes: number[], nowMs: number, maxPerHour: number): boolean {
  return watch.wokeAt === undefined && pruneWakes(wakes, nowMs).length < maxPerHour
}
```

- [ ] **Step 4: Chạy test, thấy xanh**

Run: `bash "<MOD>/dev.sh" test` → Expected: PASS (thêm 6 test freshness, 5 test messages,
4 test wake).

- [ ] **Step 5: Commit**

```bash
cd "<MOD>" && git add src/logic/freshness.ts src/logic/messages.ts src/logic/wake.ts tests/freshness.test.ts tests/messages.test.ts tests/wake.test.ts && git commit -q -m "feat: kiểm docs-freshness theo commit, câu chữ thông báo và chống đánh thức lặp"
```

---

### Task 5: Máy, Docker, phiên song song và quy tắc lên màu của dải

**Files:**
- Create: `<MOD>/src/logic/machine.ts`
- Create: `<MOD>/src/logic/peers.ts`
- Create: `<MOD>/src/logic/classify.ts`
- Create: `<MOD>/tests/machine.test.ts`
- Create: `<MOD>/tests/peers.test.ts`
- Create: `<MOD>/tests/classify.test.ts`

**Interfaces:**
- Consumes: `normalizePath` (Task 1), `sha7` (Task 4), các kiểu ở `types/index.d.ts`, `CONFIG`.
- Produces:
  - `parseMachine(json: string): MachineInfo`, `parseDocker(out: string): DbState`.
  - `type Heartbeat = { sessionId: string; tree: string; commonDir: string; branch: string; lastSeen: number; ended?: boolean }`,
    `freshPeers(beats: Heartbeat[], me: { sessionId: string; tree: string; commonDir: string }, nowMs: number, freshMs: number): PeersInfo`.
  - `type Segment = { id: string; text: string; level: Level }`, `formatGB(n: number): string`,
    `freezeLabel(nowMs: number, freezeDate: string, utcOffsetHours: number): Segment`,
    `classify(snap: TourismSnapshot, watches: CiWatch[], nowMs: number): Segment[]`,
    `fitSegments(segs: Segment[], columns: number): Segment[]`.

- [ ] **Step 1: Viết test**

`<MOD>/tests/machine.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'
import { parseDocker, parseMachine } from '../src/logic/machine'

describe('parseMachine', () => {
  test('đổi KB và byte sang GB', () => {
    const m = parseMachine(JSON.stringify({ commitFreeKB: 8_493_465, diskFreeBytes: 152_471_339_008 }))
    expect(Math.round(m.commitFreeGB * 10) / 10).toBe(8.1)
    expect(Math.round(m.diskFreeGB)).toBe(142)
  })

  test('thiếu trường thì ném lỗi', () => {
    let thrown = false
    try {
      parseMachine('{"commitFreeKB":1}')
    } catch {
      thrown = true
    }
    expect(thrown).toBe(true)
  })
})

describe('parseDocker', () => {
  test('đọc cột Status của docker ps', () => {
    expect(parseDocker('Up 2 hours (healthy)')).toBe('up')
    expect(parseDocker('Up 10 minutes')).toBe('up')
    expect(parseDocker('Up 5 seconds (health: starting)')).toBe('unhealthy')
    expect(parseDocker('Up 3 minutes (unhealthy)')).toBe('unhealthy')
    expect(parseDocker('Exited (0) 2 hours ago')).toBe('down')
    expect(parseDocker('')).toBe('down')
  })

  test('nhiều dòng thì lấy dòng đầu', () => {
    expect(parseDocker('Up 1 hour (healthy)\nExited (1) 3 days ago')).toBe('up')
  })
})
```

`<MOD>/tests/peers.test.ts`:

```ts
import { test } from 'claude-code/testing'
import { freshPeers, type Heartbeat } from '../src/logic/peers'
import { eq } from './eq'

const NOW = 1_000_000_000
const ROOT = 'C:/Programming/Devs/Projects/Tourism-Platform-V2'
const COMMON = `${ROOT}/.git`
const beat = (o: Partial<Heartbeat>): Heartbeat => ({ sessionId: 'x', tree: ROOT, commonDir: COMMON, branch: 'main', lastSeen: NOW - 30_000, ...o })

test('đếm phiên khác cùng repo còn tươi; tách riêng phiên cùng cây', () => {
  const beats = [
    beat({ sessionId: 'me' }),
    beat({ sessionId: 'a' }),
    beat({ sessionId: 'b', tree: `${ROOT}-review` }),
    beat({ sessionId: 'c', lastSeen: NOW - 4 * 60_000 }),
    beat({ sessionId: 'd', ended: true }),
    beat({ sessionId: 'e', tree: 'C:/khac', commonDir: 'C:/khac/.git' }),
    beat({ sessionId: 'f', tree: ROOT.toLowerCase().replace(/\//g, '\\'), commonDir: COMMON.replace(/\//g, '\\') }),
  ]
  eq(freshPeers(beats, { sessionId: 'me', tree: ROOT, commonDir: COMMON }, NOW, 3 * 60_000), { others: 3, sameTree: 2 })
})
```

`<MOD>/tests/classify.test.ts`:

```ts
import { describe, expect, test } from 'claude-code/testing'
import type { CiWatch, TourismSnapshot } from '../types'
import { classify, fitSegments, freezeLabel } from '../src/logic/classify'
import { eq } from './eq'

const NOW = Date.parse('2026-10-02T05:00:00Z') // 12:00 giờ Việt Nam
const SHA = '3053745e'.padEnd(40, '0')

const SNAP: TourismSnapshot = {
  git: { value: { branch: 'feat/x', ahead: 4, behind: 0, dirty: 13, onMain: false }, updatedAt: NOW },
  ci: { value: { runId: 1, status: 'completed', conclusion: 'success', sha: SHA, url: 'u', medianMinutes: 9.5 }, updatedAt: NOW },
  env: { value: { db: 'up', api: 'down', envMissing: [] }, updatedAt: NOW },
  machine: { value: { commitFreeGB: 8.1, diskFreeGB: 142 }, updatedAt: NOW },
  peers: { value: { others: 1, sameTree: 0 }, updatedAt: NOW },
}

const texts = (snap: TourismSnapshot, watches: CiWatch[] = []) => classify(snap, watches, NOW).map(s => s.text)
const levelOf = (snap: TourismSnapshot, id: string, watches: CiWatch[] = []) => classify(snap, watches, NOW).find(s => s.id === id)?.level

describe('classify', () => {
  test('ảnh chụp bình thường ra đúng dòng ví dụ của spec', () => {
    eq(texts(SNAP), ['feat/x ↑4 ↓0', '13 file chưa commit', 'CI main ✓ 3053745', 'DB ✓', 'API —', 'RAM 8,1 GB', 'C 142 GB', '1 phiên khác', 'freeze còn 13 ngày'])
  })

  test('nhánh khác main bị main bỏ xa thì vàng; main còn commit chưa push thì vàng', () => {
    expect(levelOf({ ...SNAP, git: { value: { branch: 'feat/x', ahead: 4, behind: 2, dirty: 0, onMain: false }, updatedAt: NOW } }, 'git')).toBe('warn')
    expect(levelOf({ ...SNAP, git: { value: { branch: 'main', ahead: 1, behind: 0, dirty: 0, onMain: true }, updatedAt: NOW } }, 'git')).toBe('warn')
    expect(levelOf(SNAP, 'git')).toBe('ok')
  })

  test('biên ngưỡng RAM 6/3 GB và ổ C 30/15 GB', () => {
    const m = (commitFreeGB: number, diskFreeGB: number): TourismSnapshot => ({ ...SNAP, machine: { value: { commitFreeGB, diskFreeGB }, updatedAt: NOW } })
    expect(levelOf(m(6, 30), 'ram')).toBe('ok')
    expect(levelOf(m(5.9, 30), 'ram')).toBe('warn')
    expect(levelOf(m(3, 30), 'ram')).toBe('warn')
    expect(levelOf(m(2.9, 30), 'ram')).toBe('error')
    expect(levelOf(m(6, 30), 'disk')).toBe('ok')
    expect(levelOf(m(6, 29.9), 'disk')).toBe('warn')
    expect(levelOf(m(6, 15), 'disk')).toBe('warn')
    expect(levelOf(m(6, 14.9), 'disk')).toBe('error')
  })

  test('CI: đang chạy vàng, thất bại đỏ, có lần canh đang chạy thì hiện tiến độ', () => {
    const ci = (status: string, conclusion: string | null): TourismSnapshot => ({ ...SNAP, ci: { value: { runId: 1, status, conclusion, sha: SHA, url: 'u', medianMinutes: 9.5 }, updatedAt: NOW } })
    expect(levelOf(ci('in_progress', null), 'ci')).toBe('warn')
    expect(levelOf(ci('completed', 'failure'), 'ci')).toBe('error')
    const watch: CiWatch = { sha: 'abcdef1'.padEnd(40, '0'), branch: 'main', pushedAt: NOW - 4 * 60_000, phase: 'running' }
    expect(classify(SNAP, [watch], NOW).find(s => s.id === 'ci')?.text).toBe('⟳ CI abcdef1 · 4/10 phút')
  })

  test('DB không chạy vàng, thiếu .env.local đỏ, phiên cùng cây vàng', () => {
    expect(levelOf({ ...SNAP, env: { value: { db: 'down', api: 'down', envMissing: [] }, updatedAt: NOW } }, 'db')).toBe('warn')
    const missing = classify({ ...SNAP, env: { value: { db: 'up', api: 'up', envMissing: ['web', 'admin'] }, updatedAt: NOW } }, [], NOW).find(s => s.id === 'dotenv')
    expect(missing?.text).toBe('.env.local thiếu: web, admin')
    expect(missing?.level).toBe('error')
    expect(levelOf({ ...SNAP, peers: { value: { others: 2, sameTree: 1 }, updatedAt: NOW } }, 'peers')).toBe('warn')
  })

  test('nhóm lỗi hiện "?" mờ, các nhóm khác vẫn có', () => {
    const t = texts({ ...SNAP, git: { updatedAt: NOW, error: 'git chết' }, machine: { updatedAt: NOW, error: 'pwsh chết' } })
    expect(t.includes('git ?')).toBe(true)
    expect(t.includes('RAM ?')).toBe(true)
    expect(t.includes('DB ✓')).toBe(true)
  })
})

describe('freezeLabel', () => {
  test('đếm theo ngày giờ Việt Nam', () => {
    expect(freezeLabel(Date.parse('2026-10-12T05:00:00Z'), '2026-10-15', 7).text).toBe('freeze còn 3 ngày')
    expect(freezeLabel(Date.parse('2026-10-12T05:00:00Z'), '2026-10-15', 7).level).toBe('warn')
    expect(freezeLabel(Date.parse('2026-10-11T05:00:00Z'), '2026-10-15', 7).level).toBe('ok')
    // 17:30 UTC ngày 14 đã là 00:30 ngày 15 ở Việt Nam
    expect(freezeLabel(Date.parse('2026-10-14T17:30:00Z'), '2026-10-15', 7).text).toBe('đang freeze')
    expect(freezeLabel(Date.parse('2026-11-01T05:00:00Z'), '2026-10-15', 7).text).toBe('đang freeze')
  })
})

describe('fitSegments', () => {
  test('đủ chỗ thì giữ hết; thiếu chỗ thì giữ mục đầu và mục vàng/đỏ', () => {
    const segs = classify({ ...SNAP, env: { value: { db: 'down', api: 'down', envMissing: [] }, updatedAt: NOW } }, [], NOW)
    expect(fitSegments(segs, 500).length).toBe(segs.length)
    eq(
      fitSegments(segs, 20).map(s => s.id),
      ['git', 'db'],
    )
  })
})
```

- [ ] **Step 2: Chạy test, thấy đỏ**

Run: `bash "<MOD>/dev.sh" test`
Expected: FAIL — không import được `machine`, `peers`, `classify`.

- [ ] **Step 3: Viết code**

`<MOD>/src/logic/machine.ts`:

```ts
import type { DbState, MachineInfo } from '../../types'

const GB = 1024 ** 3

// JSON của lệnh pwsh trong collect/machine.ts: { commitFreeKB, diskFreeBytes }
export function parseMachine(json: string): MachineInfo {
  const d = JSON.parse(json) as { commitFreeKB?: unknown; diskFreeBytes?: unknown }
  if (typeof d.commitFreeKB !== 'number' || typeof d.diskFreeBytes !== 'number') throw new Error('pwsh trả thiếu trường')
  return { commitFreeGB: (d.commitFreeKB * 1024) / GB, diskFreeGB: d.diskFreeBytes / GB }
}

// Cột Status của `docker ps --format {{.Status}}`; nhiều dòng thì lấy dòng đầu
export function parseDocker(out: string): DbState {
  const s = (out.trim().split(/\r?\n/)[0] ?? '').trim()
  if (!s.startsWith('Up')) return 'down'
  if (/\(health: starting\)|\(unhealthy\)/.test(s)) return 'unhealthy'
  return 'up'
}
```

`<MOD>/src/logic/peers.ts`:

```ts
import type { PeersInfo } from '../../types'
import { normalizePath } from './paths'

// Nội dung một file nhịp tim; tree là gốc cây làm việc (git rev-parse --show-toplevel)
export type Heartbeat = {
  sessionId: string
  tree: string
  commonDir: string
  branch: string
  lastSeen: number
  ended?: boolean
}

// Đếm phiên khác cùng repo còn tươi, và trong đó bao nhiêu phiên cùng cây làm việc
export function freshPeers(
  beats: Heartbeat[],
  me: { sessionId: string; tree: string; commonDir: string },
  nowMs: number,
  freshMs: number,
): PeersInfo {
  const myCommon = normalizePath(me.commonDir)
  const myTree = normalizePath(me.tree)
  let others = 0
  let sameTree = 0
  for (const b of beats) {
    if (b.sessionId === me.sessionId || b.ended === true) continue
    if (nowMs - b.lastSeen > freshMs) continue
    if (normalizePath(b.commonDir) !== myCommon) continue
    others += 1
    if (normalizePath(b.tree) === myTree) sameTree += 1
  }
  return { others, sameTree }
}
```

`<MOD>/src/logic/classify.ts`:

```ts
import type { CiWatch, Level, TourismSnapshot } from '../../types'
import { CONFIG } from '../config'
import { sha7 } from './messages'

export type Segment = { id: string; text: string; level: Level }

const DAY = 86_400_000

// Số GB kiểu Việt Nam: một chữ số thập phân, dấu phẩy
export function formatGB(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

// Đếm ngày tới freeze theo ngày của giờ Việt Nam
export function freezeLabel(nowMs: number, freezeDate: string, utcOffsetHours: number): Segment {
  const today = new Date(nowMs + utcOffsetHours * 3_600_000).toISOString().slice(0, 10)
  const days = Math.round((Date.parse(`${freezeDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY)
  if (days <= 0) return { id: 'freeze', text: 'đang freeze', level: 'warn' }
  return { id: 'freeze', text: `freeze còn ${days} ngày`, level: days <= 3 ? 'warn' : 'ok' }
}

function byThreshold(value: number, warnBelow: number, errorBelow: number): Level {
  if (value < errorBelow) return 'error'
  if (value < warnBelow) return 'warn'
  return 'ok'
}

// Biến ảnh chụp trạng thái thành các mục của dải, theo đúng thứ tự spec §3
export function classify(snap: TourismSnapshot, watches: CiWatch[], nowMs: number): Segment[] {
  const segs: Segment[] = []
  const { git, ci, env, machine, peers } = snap

  if (git.error !== undefined || git.value === undefined) segs.push({ id: 'git', text: 'git ?', level: 'unknown' })
  else {
    const g = git.value
    const warn = (!g.onMain && g.behind > 0) || (g.onMain && g.ahead > 0)
    segs.push({ id: 'git', text: `${g.branch} ↑${g.ahead} ↓${g.behind}`, level: warn ? 'warn' : 'ok' })
    segs.push({ id: 'dirty', text: g.dirty > 0 ? `${g.dirty} file chưa commit` : 'cây sạch', level: 'ok' })
  }

  const active = watches.filter(w => w.phase !== 'done').sort((a, b) => b.pushedAt - a.pushedAt)[0]
  const median = Math.round(ci.value?.medianMinutes ?? 10)
  if (active !== undefined) {
    const elapsed = Math.floor((nowMs - active.pushedAt) / 60_000)
    segs.push({ id: 'ci', text: `⟳ CI ${sha7(active.sha)} · ${elapsed}/${median} phút`, level: 'warn' })
  } else if (ci.error !== undefined || ci.value === undefined) segs.push({ id: 'ci', text: 'CI ?', level: 'unknown' })
  else {
    const c = ci.value
    const s = sha7(c.sha)
    if (c.status !== 'completed') segs.push({ id: 'ci', text: `CI main ⟳ ${s}`, level: 'warn' })
    else if (c.conclusion === 'success') segs.push({ id: 'ci', text: `CI main ✓ ${s}`, level: 'ok' })
    else if (c.conclusion === 'cancelled') segs.push({ id: 'ci', text: `CI main ⊘ ${s}`, level: 'ok' })
    else segs.push({ id: 'ci', text: `CI main ✗ ${s}`, level: 'error' })
  }

  if (env.error !== undefined || env.value === undefined) segs.push({ id: 'env', text: 'môi trường ?', level: 'unknown' })
  else {
    const e = env.value
    segs.push({ id: 'db', text: e.db === 'up' ? 'DB ✓' : 'DB ✗', level: e.db === 'up' ? 'ok' : 'warn' })
    segs.push({ id: 'api', text: e.api === 'up' ? 'API ✓' : 'API —', level: 'ok' })
    if (e.envMissing.length > 0) segs.push({ id: 'dotenv', text: `.env.local thiếu: ${e.envMissing.join(', ')}`, level: 'error' })
  }

  if (machine.error !== undefined || machine.value === undefined) segs.push({ id: 'machine', text: 'RAM ?', level: 'unknown' })
  else {
    const m = machine.value
    segs.push({ id: 'ram', text: `RAM ${formatGB(m.commitFreeGB)} GB`, level: byThreshold(m.commitFreeGB, CONFIG.ramWarnGB, CONFIG.ramErrorGB) })
    segs.push({ id: 'disk', text: `C ${Math.round(m.diskFreeGB)} GB`, level: byThreshold(m.diskFreeGB, CONFIG.diskWarnGB, CONFIG.diskErrorGB) })
  }

  if (peers.value !== undefined && peers.value.others > 0) {
    const p = peers.value
    segs.push({
      id: 'peers',
      text: `${p.others} phiên khác${p.sameTree > 0 ? ` (${p.sameTree} cùng cây)` : ''}`,
      level: p.sameTree > 0 ? 'warn' : 'ok',
    })
  }

  segs.push(freezeLabel(nowMs, CONFIG.freezeDate, CONFIG.utcOffsetHours))
  return segs
}

const SEP = ' · '
const width = (segs: Segment[]): number => segs.reduce((n, s, i) => n + s.text.length + (i > 0 ? SEP.length : 0), 0)

// Đủ chỗ thì giữ hết; thiếu chỗ thì giữ mục đầu (nhánh) và các mục vàng/đỏ
export function fitSegments(segs: Segment[], columns: number): Segment[] {
  if (width(segs) <= columns) return segs
  return segs.filter((s, i) => i === 0 || s.level === 'warn' || s.level === 'error')
}
```

- [ ] **Step 4: Chạy test, thấy xanh**

Run: `bash "<MOD>/dev.sh" test` → Expected: PASS (thêm 4 test machine, 1 test peers,
8 test classify/freeze/fit).

- [ ] **Step 5: Thử đột biến tay, rồi hoàn lại**

Lần lượt sửa từng chỗ dưới đây, chạy `bash "<MOD>/dev.sh" test`, thấy **đỏ**, rồi hoàn lại:
`value < errorBelow` → `value <= errorBelow` (classify.ts) · `days <= 3` → `days < 3` ·
`b.ended === true` → `false` (peers.ts) · `watch.wokeAt === undefined` → `true` (wake.ts) ·
`r.conclusion === '' ? null` → bỏ (ci.ts). Mỗi đột biến phải làm ít nhất một test đỏ; đột biến nào
không làm test đỏ thì thêm test cho đúng biên đó trước khi đi tiếp.

- [ ] **Step 6: Commit**

```bash
cd "<MOD>" && git add src/logic/machine.ts src/logic/peers.ts src/logic/classify.ts tests/machine.test.ts tests/peers.test.ts tests/classify.test.ts && git commit -q -m "feat: đọc máy, Docker, phiên song song và quy tắc lên màu của dải"
```

---

### Task 6: Thu dữ liệu, nhịp làm mới, nhịp tim và vẽ dải

**Files:**
- Create: `<MOD>/src/context.ts`
- Create: `<MOD>/src/state.ts`
- Create: `<MOD>/src/run.ts`
- Create: `<MOD>/src/gh.ts`
- Create: `<MOD>/src/collect/git.ts`
- Create: `<MOD>/src/collect/ci.ts`
- Create: `<MOD>/src/collect/env.ts`
- Create: `<MOD>/src/collect/machine.ts`
- Create: `<MOD>/src/collect/peers.ts`
- Create: `<MOD>/src/refresh.ts`
- Create: `<MOD>/src/boot.ts`
- Create: `<MOD>/src/band.tsx`
- Modify: `<MOD>/hooks/register.tsx` (thay toàn bộ)
- Test: thử tay (Step 4); `tests/band.test.ts` chỉ khi biên bản Task 0 mục 8 cho thấy mount chạy được.

**Interfaces:**
- Consumes: mọi hàm của `src/logic` (Task 1–5), `CONFIG`, kiểu ở `types/index.d.ts`; biên bản
  Task 0 mục 2 (màu) và mục 8 (mount).
- Produces (Task 7 dùng):
  - `ctx` và `type Group = 'git' | 'ci' | 'env' | 'machine' | 'peers'` (src/context.ts).
  - `snapshotAtom`, `watchesAtom`, `wakesAtom` (src/state.ts).
  - `run($, argv, opts?)`, `git($, args, opts?)`, `gitOut($, args, opts?): Promise<string>` (src/run.ts).
  - `RUN_FIELDS`, `ghJson($, args): Promise<string>`, `noteGhFailure($): void`,
    `noteGhSuccess(): void` (src/gh.ts).
  - `currentBranch($): Promise<string>`, `revParse($, ref): Promise<string | undefined>`,
    `repoPaths($, cwd): Promise<{ commonDir: string; top: string } | undefined>` (src/collect/git.ts).
  - `tick($): Promise<void>` gọi `pollWatches($)` từ `src/ci-watch.ts` (Task 7 tạo; ở task này
    `tick` chưa gọi, Task 7 thêm một dòng).

- [ ] **Step 1: Viết ngữ cảnh, state, chạy lệnh, gh**

`<MOD>/src/context.ts`:

```ts
import type { Timer } from 'claude-code'

// Ngữ cảnh chạy của phiên. Là biến module nên mất khi hot reload; session.start dựng lại.
export type Group = 'git' | 'ci' | 'env' | 'machine' | 'peers'

export const ctx = {
  active: false,
  cwd: '',
  top: '',
  commonDir: '',
  home: '',
  lastActivity: 0,
  lastRun: { git: 0, ci: 0, env: 0, machine: 0, peers: 0 } as Record<Group, number>,
  running: new Set<Group>(),
  ghFailures: 0,
  ghToasted: false,
  lastPolled: new Map<string, number>(),
  timer: undefined as Timer | undefined,
}
```

`<MOD>/src/state.ts`:

```ts
import { atom } from 'claude-code'
import type { CiWatch, TourismSnapshot } from '../types'

// Ảnh chụp rỗng: mọi nhóm chưa cập nhật lần nào
export const EMPTY_SNAPSHOT: TourismSnapshot = {
  git: { updatedAt: 0 },
  ci: { updatedAt: 0 },
  env: { updatedAt: 0 },
  machine: { updatedAt: 0 },
  peers: { updatedAt: 0 },
}

export const snapshotAtom = atom({ plugin: 'tourism-status', key: 'snapshot' } as const, EMPTY_SNAPSHOT)
export const watchesAtom = atom({ plugin: 'tourism-status', key: 'watches' } as const, {} as Record<string, CiWatch>)
export const wakesAtom = atom({ plugin: 'tourism-status', key: 'wakes' } as const, [] as number[])
```

`<MOD>/src/run.ts`:

```ts
import type { EngineInterface } from 'claude-code'
import { CONFIG } from './config'
import { ctx } from './context'

type Opts = { cwd?: string; timeoutMs?: number; env?: Record<string, string> }

// Chạy lệnh bằng argv (không qua shell); mặc định chạy ở gốc cây làm việc
export async function run($: EngineInterface, argv: string[], opts: Opts = {}) {
  return $.process.run(argv, {
    cwd: opts.cwd ?? (ctx.top !== '' ? ctx.top : undefined),
    timeoutMs: opts.timeoutMs,
    env: opts.env,
  })
}

// git luôn kèm --no-optional-locks để không giữ index.lock khi phiên khác đang add/commit
export async function git($: EngineInterface, args: string[], opts: Opts = {}) {
  return run($, ['git', '--no-optional-locks', ...args], { timeoutMs: CONFIG.timeouts.git, ...opts })
}

// Như git nhưng ném lỗi khi thoát khác 0, trả stdout
export async function gitOut($: EngineInterface, args: string[], opts: Opts = {}): Promise<string> {
  const r = await git($, args, opts)
  if (r.exitCode !== 0) throw new Error(`git ${args[0] ?? ''} thoát ${r.exitCode}: ${r.stderr.trim().slice(0, 120)}`)
  return r.stdout
}
```

`<MOD>/src/gh.ts`:

```ts
import type { EngineInterface } from 'claude-code'
import { CONFIG } from './config'
import { ctx } from './context'
import { run } from './run'

export const RUN_FIELDS = 'databaseId,status,conclusion,headSha,createdAt,updatedAt,url'

// Gọi gh, trả stdout; thoát khác 0 thì ném lỗi
export async function ghJson($: EngineInterface, args: string[]): Promise<string> {
  const r = await run($, ['gh', ...args], { timeoutMs: CONFIG.timeouts.gh })
  if (r.exitCode !== 0) throw new Error(`gh thoát ${r.exitCode}: ${r.stderr.trim().slice(0, 120)}`)
  return r.stdout
}

// Đếm lỗi GitHub liền nhau; đủ ngưỡng thì toast đúng một lần
export function noteGhFailure($: EngineInterface): void {
  ctx.ghFailures += 1
  if (ctx.ghFailures >= CONFIG.ghFailSlowAfter && !ctx.ghToasted) {
    ctx.ghToasted = true
    $.ui.toast('tourism-status: không hỏi được GitHub, sẽ thử lại thưa hơn')
  }
}

export function noteGhSuccess(): void {
  ctx.ghFailures = 0
  ctx.ghToasted = false
}
```

- [ ] **Step 2: Viết các bộ thu dữ liệu**

`<MOD>/src/collect/git.ts`:

```ts
import type { EngineInterface } from 'claude-code'
import type { GitInfo } from '../../types'
import { parseAheadBehind, parseGitStatus } from '../logic/git'
import { git, gitOut } from '../run'

export async function collectGit($: EngineInterface): Promise<GitInfo> {
  const status = parseGitStatus(await gitOut($, ['status', '--porcelain=v2', '--branch']))
  const counts = parseAheadBehind(await gitOut($, ['rev-list', '--left-right', '--count', 'origin/main...HEAD']))
  return { branch: status.branch, ahead: counts.ahead, behind: counts.behind, dirty: status.dirty, onMain: status.branch === 'main' }
}

export async function currentBranch($: EngineInterface): Promise<string> {
  return (await gitOut($, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
}

// SHA đầy đủ của một ref hay SHA rút gọn; không có thì undefined
export async function revParse($: EngineInterface, ref: string): Promise<string | undefined> {
  const r = await git($, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])
  const out = r.stdout.trim()
  return r.exitCode === 0 && /^[0-9a-f]{40}$/.test(out) ? out : undefined
}

// .git chung và gốc cây làm việc của một thư mục; không phải repo git thì undefined
export async function repoPaths($: EngineInterface, cwd: string): Promise<{ commonDir: string; top: string } | undefined> {
  const r = await git($, ['rev-parse', '--path-format=absolute', '--git-common-dir', '--show-toplevel'], { cwd })
  if (r.exitCode !== 0) return undefined
  const [commonDir = '', top = ''] = r.stdout.trim().split(/\r?\n/)
  return { commonDir: commonDir.trim(), top: top.trim() }
}
```

`<MOD>/src/collect/ci.ts`:

```ts
import type { EngineInterface } from 'claude-code'
import type { CiInfo } from '../../types'
import { CONFIG } from '../config'
import { ctx } from '../context'
import { RUN_FIELDS, ghJson } from '../gh'
import { medianMinutes, parseRuns } from '../logic/ci'
import { git } from '../run'

export async function collectCi($: EngineInterface): Promise<CiInfo> {
  const runs = parseRuns(await ghJson($, ['run', 'list', '--workflow', CONFIG.ciWorkflow, '--branch', 'main', '--limit', '8', '--json', RUN_FIELDS]))
  const latest = runs[0]
  if (latest === undefined) throw new Error('main chưa có run CI nào')
  // main có commit mới mà máy chưa có thì fetch một lần để số ↓ đúng (lệnh ghi duy nhất của mod)
  const known = await git($, ['merge-base', '--is-ancestor', latest.sha, 'origin/main'])
  if (known.exitCode !== 0) {
    const f = await git($, ['fetch', '--quiet', '--no-tags', 'origin', 'main'], { timeoutMs: CONFIG.timeouts.fetch })
    if (f.exitCode === 0) ctx.lastRun.git = 0
  }
  return { runId: latest.id, status: latest.status, conclusion: latest.conclusion, sha: latest.sha, url: latest.url, medianMinutes: medianMinutes(runs) }
}
```

`<MOD>/src/collect/env.ts`:

```ts
import type { EngineInterface } from 'claude-code'
import type { EnvInfo } from '../../types'
import { CONFIG } from '../config'
import { ctx } from '../context'
import { parseDocker } from '../logic/machine'
import { run } from '../run'

export async function collectEnv($: EngineInterface): Promise<EnvInfo> {
  const d = await run($, ['docker', 'ps', '--all', '--filter', `name=${CONFIG.dbContainer}`, '--format', '{{.Status}}'], { timeoutMs: CONFIG.timeouts.docker })
  const db = d.exitCode === 0 ? parseDocker(d.stdout) : 'down'
  // Có trả HTTP (mã nào cũng được) là API sống; bị từ chối kết nối là tắt
  let api: EnvInfo['api'] = 'down'
  try {
    await $.http.fetch(CONFIG.apiUrl)
    api = 'up'
  } catch {
    api = 'down'
  }
  // Chỉ hỏi file có tồn tại, không bao giờ đọc nội dung
  const envMissing: string[] = []
  for (const app of CONFIG.envApps) {
    if (!(await $.fs.exists(`${ctx.top}/apps/${app}/.env.local`))) envMissing.push(app)
  }
  return { db, api, envMissing }
}
```

`<MOD>/src/collect/machine.ts`:

```ts
import type { EngineInterface } from 'claude-code'
import type { MachineInfo } from '../../types'
import { CONFIG } from '../config'
import { parseMachine } from '../logic/machine'
import { run } from '../run'

// Một lệnh pwsh đọc commit trống và ổ C; script không có ngoặc kép để khỏi lo escape argv
const SCRIPT =
  "$o = Get-CimInstance Win32_OperatingSystem; $d = Get-CimInstance Win32_LogicalDisk | Where-Object DeviceID -eq 'C:'; @{ commitFreeKB = [int64]$o.FreeVirtualMemory; diskFreeBytes = [int64]$d.FreeSpace } | ConvertTo-Json -Compress"

export async function collectMachine($: EngineInterface): Promise<MachineInfo> {
  const r = await run($, ['pwsh', '-NoProfile', '-NonInteractive', '-Command', SCRIPT], { timeoutMs: CONFIG.timeouts.pwsh })
  if (r.exitCode !== 0) throw new Error(`pwsh thoát ${r.exitCode}: ${r.stderr.trim().slice(0, 120)}`)
  return parseMachine(r.stdout)
}
```

`<MOD>/src/collect/peers.ts`:

```ts
import type { EngineInterface } from 'claude-code'
import { read } from 'claude-code'
import type { PeersInfo } from '../../types'
import { CONFIG } from '../config'
import { ctx } from '../context'
import { freshPeers, type Heartbeat } from '../logic/peers'
import { run } from '../run'
import { snapshotAtom } from '../state'

export const peersDir = (): string => `${ctx.home}/.claude/mods-state/tourism-status/peers`

const ps = (script: string): string[] => ['pwsh', '-NoProfile', '-NonInteractive', '-Command', script]

export async function ensurePeersDir($: EngineInterface): Promise<void> {
  await run($, ps(`New-Item -ItemType Directory -Force -Path '${peersDir()}' | Out-Null`), { timeoutMs: CONFIG.timeouts.pwsh })
}

// $.fs không có lệnh xoá: dọn file nhịp tim cũ bằng pwsh, chỉ trong đúng thư mục peers
export async function prunePeers($: EngineInterface): Promise<void> {
  await run(
    $,
    ps(`Get-ChildItem -LiteralPath '${peersDir()}' -Filter *.json | Where-Object LastWriteTime -lt (Get-Date).AddDays(-${CONFIG.peerPruneDays}) | Remove-Item -Force`),
    { timeoutMs: CONFIG.timeouts.pwsh },
  )
}

async function writeBeat($: EngineInterface, sessionId: string, ended: boolean): Promise<void> {
  const snap = await read($, snapshotAtom)
  const beat: Heartbeat = {
    sessionId,
    tree: ctx.top,
    commonDir: ctx.commonDir,
    branch: snap.git.value?.branch ?? '',
    lastSeen: await $.clock.now(),
    ended,
  }
  await $.fs.write(`${peersDir()}/${sessionId}.json`, JSON.stringify(beat))
}

// Ghi nhịp tim của mình rồi đếm phiên khác; id phiên đọc lại mỗi lần vì /clear đổi id
export async function collectPeers($: EngineInterface): Promise<PeersInfo> {
  const sessionId = await $.session.id()
  await writeBeat($, sessionId, false)
  const beats: Heartbeat[] = []
  for (const entry of await $.fs.list(peersDir())) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    try {
      beats.push(JSON.parse(await $.fs.read(`${peersDir()}/${entry.name}`)) as Heartbeat)
    } catch {
      // file đang được phiên khác ghi dở: bỏ qua ở lượt này
    }
  }
  return freshPeers(beats, { sessionId, tree: ctx.top, commonDir: ctx.commonDir }, await $.clock.now(), CONFIG.peerFreshMs)
}

export async function markEnded($: EngineInterface, sessionId: string): Promise<void> {
  await writeBeat($, sessionId, true)
}
```

- [ ] **Step 3: Viết nhịp làm mới, khởi động, dải và nối dây**

`<MOD>/src/refresh.ts`:

```ts
import type { EngineInterface } from 'claude-code'
import { update } from 'claude-code'
import type { TourismSnapshot } from '../types'
import { collectCi } from './collect/ci'
import { collectEnv } from './collect/env'
import { collectGit } from './collect/git'
import { collectMachine } from './collect/machine'
import { collectPeers } from './collect/peers'
import { CONFIG } from './config'
import { ctx, type Group } from './context'
import { noteGhFailure, noteGhSuccess } from './gh'
import { snapshotAtom } from './state'

const COLLECT: Record<Group, ($: EngineInterface) => Promise<unknown>> = {
  git: collectGit,
  ci: collectCi,
  env: collectEnv,
  machine: collectMachine,
  peers: collectPeers,
}

// Chạy một nhóm, ghi giá trị (hoặc lỗi, giữ giá trị cũ) vào $.state; nhóm đang chạy thì bỏ qua
export async function runGroup($: EngineInterface, group: Group): Promise<void> {
  if (ctx.running.has(group)) return
  ctx.running.add(group)
  try {
    const now = await $.clock.now()
    ctx.lastRun[group] = now
    try {
      const value = await COLLECT[group]($)
      await update($, snapshotAtom, s => ({ ...s, [group]: { value, updatedAt: now } }) as TourismSnapshot)
      if (group === 'ci') noteGhSuccess()
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await update($, snapshotAtom, s => ({ ...s, [group]: { ...s[group], updatedAt: now, error } }) as TourismSnapshot)
      if (group === 'ci') noteGhFailure($)
      $.ui.log(`tourism-status: nhóm ${group} lỗi: ${error}`, { to: 'debug' })
    }
  } finally {
    ctx.running.delete(group)
  }
}

const due = (group: Group, every: number, now: number): boolean => !ctx.running.has(group) && now - ctx.lastRun[group] >= every

// Nhịp chủ mỗi 15 giây: nhóm nào đến hạn thì chạy; rảnh lâu hoặc GitHub lỗi liền thì giãn nhịp
export async function tick($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const idle = now - ctx.lastActivity > CONFIG.idleAfterMs
  const fast = idle ? CONFIG.idleEveryMs : CONFIG.fastEveryMs
  const slowCi = idle || ctx.ghFailures >= CONFIG.ghFailSlowAfter
  const ciEvery = slowCi ? CONFIG.idleEveryMs : CONFIG.ciEveryMs
  for (const g of ['git', 'env', 'machine', 'peers'] as const) if (due(g, fast, now)) void runGroup($, g)
  if (due('ci', ciEvery, now)) void runGroup($, 'ci')
}
```

`<MOD>/src/boot.ts`:

```ts
import type { EngineInterface } from 'claude-code'
import { repoPaths } from './collect/git'
import { ensurePeersDir, prunePeers } from './collect/peers'
import { CONFIG } from './config'
import { ctx } from './context'
import { normalizePath } from './logic/paths'
import { runGroup, tick } from './refresh'

// Nhận diện repo; chỉ khi đúng Tourism-Platform-V2 (gốc hoặc worktree) mới bật mod
export async function boot($: EngineInterface, cwd: string): Promise<void> {
  const paths = await repoPaths($, cwd)
  ctx.active = paths !== undefined && normalizePath(paths.commonDir) === CONFIG.repoCommonDir
  if (paths === undefined || !ctx.active) return
  ctx.cwd = cwd
  ctx.top = paths.top
  ctx.commonDir = paths.commonDir
  ctx.home = (await $.env.get('USERPROFILE')) ?? ''
  ctx.lastActivity = await $.clock.now()
  await ensurePeersDir($)
  void prunePeers($).catch(() => undefined)
  await Promise.all((['git', 'ci', 'env', 'machine', 'peers'] as const).map(g => runGroup($, g)))
  ctx.timer?.cancel()
  ctx.timer = $.clock.every(CONFIG.masterTickMs, () => {
    void tick($).catch(err => $.ui.log(`tourism-status: nhịp chủ lỗi: ${String(err)}`, { to: 'debug' }))
  })
}
```

`<MOD>/src/band.tsx` — `COLOR` lấy theo biên bản Task 0 mục 2: nếu chỉ cặp `key-warning`/`key-error`
có màu thì đổi `'yellow'` → `'warning'`, `'red'` → `'error'`:

```tsx
import type { Hook } from 'claude-code'
import { read } from 'claude-code'
import type { Level } from '../types'
import { ctx } from './context'
import { classify, fitSegments } from './logic/classify'
import { snapshotAtom, watchesAtom } from './state'

// Màu cho mục vàng/đỏ; mục bình thường và "?" để mờ
const COLOR: Record<Level, string | undefined> = { ok: undefined, unknown: undefined, warn: 'yellow', error: 'red' }

export const renderBand: Hook<'ui.render'> = async ($, e, next) => {
  if (!ctx.active || e.component !== 'AbovePrompt' || e.props.hasSurvey) return next(e)
  const snap = await read($, snapshotAtom)
  const watches = Object.values(await read($, watchesAtom))
  const segs = fitSegments(classify(snap, watches, await $.clock.now()), e.props.bodyColumns)
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box>
      {segs.map((s, i) => {
        const color = COLOR[s.level]
        return (
          <Text {...(color === undefined ? { dimColor: true } : { color })} wrap="truncate-end">
            {i > 0 ? ' · ' : ''}
            {s.text}
          </Text>
        )
      })}
    </Box>
  )
}
```

`<MOD>/hooks/register.tsx` (thay toàn bộ; Task 7 thêm hook `tool.call` và lệnh replay):

```tsx
import type { Register } from 'claude-code'
import { renderBand } from '../src/band'
import { boot } from '../src/boot'
import { markEnded } from '../src/collect/peers'
import { ctx } from '../src/context'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    // Khởi động chạy nền để không chặn prompt đầu tiên
    void boot($, e.cwd).catch(err => $.ui.log(`tourism-status: khởi động lỗi: ${String(err)}`, { to: 'debug' }))
    return started
  })

  on('session.end', async ($, e, next) => {
    if (ctx.active) {
      try {
        await markEnded($, e.sessionId)
      } catch {
        // đóng phiên không được chậm hay hỏng vì mod
      }
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (ctx.active && e.agentId === undefined) {
      ctx.lastActivity = await $.clock.now()
      ctx.lastRun.git = 0 // nhóm git làm mới ở nhịp chủ kế tiếp
    }
    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, renderBand)
}
```

- [ ] **Step 4: Validate, test, rồi thử tay từng bước**

Run: `bash "<MOD>/dev.sh" validate` → Expected: liệt kê hook `session.start`, `session.end`,
`turn.complete`, `ui.render`; state `tourism-status.snapshot`, `.watches`, `.wakes`; không lỗi.
Run: `bash "<MOD>/dev.sh" test` → Expected: PASS (mọi test cũ).

Kết thúc lượt để mod nạp lại, rồi đi từng mục, chờ user báo. Mỗi mục có sửa `src/config.ts` thì
hoàn lại ngay sau khi thấy kết quả:

| # | Việc | Đạt khi |
| --- | --- | --- |
| 1 | Dải hiện | có đủ mục; nhánh, ↑↓, số file khớp `git status -sb` và `git rev-list --left-right --count origin/main...HEAD` |
| 2 | CI main | khớp `gh run list --workflow ci.yml --branch main --limit 1` |
| 3 | DB vàng | đổi `dbContainer` thành `khong-co-container` → `DB ✗` vàng trong ≤ 75 giây (không tắt container thật vì phiên khác có thể đang dùng) |
| 4 | RAM vàng | đổi `ramWarnGB` thành `64` → mục RAM vàng |
| 5 | `.env.local` đỏ | thêm `'khong-co-app'` vào `envApps` → `.env.local thiếu: khong-co-app` đỏ |
| 6 | Phiên cùng cây | ghi tay một file nhịp tim giả (lệnh dưới bảng) → `1 phiên khác (1 cùng cây)` vàng; xoá file giả → mục biến mất sau ≤ 3 phút |
| 7 | Freeze | đổi `freezeDate` thành `2026-10-04` → `freeze còn 2 ngày` vàng |
| 8 | Hẹp | thu hẹp cửa sổ app → dải chỉ còn nhánh và mục vàng/đỏ |
| 9 | Làm mới sau lệnh git | Claude chạy `git status`; số file chưa commit cập nhật trong ≤ 15 giây khi cây làm việc đổi |

Lệnh ghi file nhịp tim giả cho mục 6 (PowerShell; `lastSeen` lấy giờ hiện tại):

```powershell
$dir = "$env:USERPROFILE\.claude\mods-state\tourism-status\peers"; $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); @{ sessionId = 'gia-thu-tay'; tree = 'C:/Programming/Devs/Projects/Tourism-Platform-V2'; commonDir = 'C:/Programming/Devs/Projects/Tourism-Platform-V2/.git'; branch = 'main'; lastSeen = $now } | ConvertTo-Json -Compress | Set-Content -LiteralPath "$dir\gia-thu-tay.json" -Encoding utf8
```

```powershell
Remove-Item -LiteralPath "$env:USERPROFILE\.claude\mods-state\tourism-status\peers\gia-thu-tay.json"
```

- [ ] **Step 5 (chỉ khi biên bản Task 0 mục 8 cho thấy mount chạy): test dải trên hai surface**

`<MOD>/tests/band.test.ts`:

```ts
import { expect, test } from 'claude-code/testing'

// Mod chưa khởi động trong môi trường test (không có process), nên dải nhường engine:
// test chỉ chứng minh hook không ném lỗi và cây hợp lệ trên cả hai surface
test('dải không làm hỏng AbovePrompt trên terminal lẫn desktop', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'tourism-status',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 160 },
    })
    expect(ui).toBeDefined()
    await ui.unmount()
  }
})
```

Run: `bash "<MOD>/dev.sh" test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd "<MOD>" && git add src/context.ts src/state.ts src/run.ts src/gh.ts src/collect/git.ts src/collect/ci.ts src/collect/env.ts src/collect/machine.ts src/collect/peers.ts src/refresh.ts src/boot.ts src/band.tsx hooks/register.tsx && git commit -q -m "feat: thu dữ liệu, nhịp làm mới, nhịp tim và vẽ dải trạng thái"
```

Nếu có Step 5 thì thêm `tests/band.test.ts` vào lệnh `git add`.

---

### Task 7: Canh CI sau push, docs-freshness ba chốt, lệnh replay

**Files:**
- Create: `<MOD>/src/ci-watch.ts`
- Create: `<MOD>/src/shell-hook.ts`
- Modify: `<MOD>/src/refresh.ts` (thêm import và một dòng cuối `tick`)
- Modify: `<MOD>/hooks/register.tsx` (thêm hook `tool.call` ×2 và `command.run`, đăng ký lệnh)

**Interfaces:**
- Consumes: `ctx`, atom, `run`/`git`, `ghJson`/`noteGhFailure`/`noteGhSuccess`/`RUN_FIELDS`,
  `currentBranch`/`revParse` (Task 6); `parseRuns`/`outcomeOf`/`runMinutes`/`failedStep` (Task 2);
  push (Task 3); freshness/messages/wake (Task 4).
- Produces: `startWatch`, `pollWatches`, `prePushCheck`, `afterShell`, `replay` (src/ci-watch.ts);
  `shellHook: Hook<'tool.call'>` (src/shell-hook.ts).

- [ ] **Step 1: Viết bộ canh CI**

`<MOD>/src/ci-watch.ts`:

```ts
import type { EngineInterface } from 'claude-code'
import { read, update } from 'claude-code'
import type { CiWatch } from '../types'
import { currentBranch, revParse } from './collect/git'
import { CONFIG } from './config'
import { ctx } from './context'
import { RUN_FIELDS, ghJson, noteGhFailure, noteGhSuccess } from './gh'
import { failedStep, outcomeOf, parseRuns, runMinutes } from './logic/ci'
import { type FreshnessVerdict, freshnessLogArgs, freshnessVerdict, latestChangelogDate } from './logic/freshness'
import { MERGE_NOTE, type OutcomeReport, freshnessNote, freshnessToast, outcomeNote, outcomeToast, wakePrompt, watchNote } from './logic/messages'
import { isFfMergeIntoMain, isGitPush, isWatchablePush, parsePushOutput, parsePushTargets } from './logic/push'
import { canWake, pruneWakes } from './logic/wake'
import { git } from './run'
import { wakesAtom, watchesAtom } from './state'

// Bắt đầu canh một SHA; canh lại SHA cũ thì giữ wokeAt để mỗi SHA chỉ đánh thức một lần
export async function startWatch($: EngineInterface, sha: string, branch: string, isReplay = false): Promise<void> {
  const now = await $.clock.now()
  await update($, watchesAtom, all => {
    const prev = all[sha]
    const watch: CiWatch = {
      sha,
      branch,
      pushedAt: now,
      phase: 'waiting',
      ...(prev?.wokeAt !== undefined ? { wokeAt: prev.wokeAt } : {}),
      ...(isReplay ? { isReplay: true } : {}),
    }
    return { ...all, [sha]: watch }
  })
  ctx.lastPolled.delete(sha)
}

// Khoảng hỏi GitHub cho một lần canh, lùi dần khi GitHub lỗi liền
function pollEvery(w: CiWatch): number {
  if (ctx.ghFailures >= CONFIG.ghFailSlowerAfter) return 5 * 60_000
  if (ctx.ghFailures >= CONFIG.ghFailSlowAfter) return 2 * 60_000
  return w.phase === 'waiting' ? CONFIG.watchAppearEveryMs : CONFIG.watchRunEveryMs
}

// Gọi từ nhịp chủ (hoặc ép ngay từ lệnh replay): hỏi GitHub cho các SHA đến hạn
export async function pollWatches($: EngineInterface, force = false): Promise<void> {
  const now = await $.clock.now()
  const all = await read($, watchesAtom)
  for (const w of Object.values(all)) {
    if (w.phase === 'done') continue
    const last = ctx.lastPolled.get(w.sha) ?? 0
    if (!force && now - last < pollEvery(w)) continue
    ctx.lastPolled.set(w.sha, now)
    void pollOne($, w, now).catch(err => $.ui.log(`tourism-status: canh ${w.sha.slice(0, 7)} lỗi: ${String(err)}`, { to: 'debug' }))
  }
}

async function pollOne($: EngineInterface, w: CiWatch, now: number): Promise<void> {
  let runs
  try {
    runs = parseRuns(await ghJson($, ['run', 'list', '--workflow', CONFIG.ciWorkflow, '--commit', w.sha, '--limit', '1', '--json', RUN_FIELDS]))
    noteGhSuccess()
  } catch {
    noteGhFailure($)
    return
  }
  const run = runs[0]
  if (run === undefined) {
    if (now - w.pushedAt > CONFIG.watchAppearTimeoutMs) await finish($, w, { sha: w.sha, branch: w.branch, outcome: 'missing' })
    return
  }
  const outcome = outcomeOf(run)
  if (outcome === 'running') {
    if (now - w.pushedAt > CONFIG.watchMaxMs) {
      await finish($, w, { sha: w.sha, branch: w.branch, outcome: 'timeout', runId: run.id })
      return
    }
    await update($, watchesAtom, all => {
      const cur = all[w.sha]
      return cur === undefined || cur.phase === 'done' ? all : { ...all, [w.sha]: { ...cur, phase: 'running', runId: run.id } }
    })
    return
  }
  const report: OutcomeReport = { sha: w.sha, branch: w.branch, outcome, runId: run.id, minutes: runMinutes(run), conclusion: run.conclusion }
  if (outcome === 'failure') {
    try {
      report.step = failedStep(await ghJson($, ['run', 'view', String(run.id), '--json', 'jobs']))
    } catch {
      // thiếu tên bước vẫn báo được
    }
  }
  await finish($, w, report)
}

// Kết thúc một lần canh: toast cho user, ghi chú cho Claude; đỏ thì đánh thức (có chống lặp)
async function finish($: EngineInterface, w: CiWatch, report: OutcomeReport): Promise<void> {
  const now = await $.clock.now()
  let isNew = false
  await update($, watchesAtom, all => {
    isNew = false
    const cur = all[w.sha]
    if (cur === undefined || cur.phase === 'done') return all
    isNew = true
    return { ...all, [w.sha]: { ...cur, phase: 'done', outcome: report.outcome } }
  })
  if (!isNew) return
  $.ui.toast(outcomeToast(report), { timeoutMs: report.outcome === 'failure' ? 10_000 : 6_000 })
  try {
    await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: outcomeNote(report) }] } })
  } catch (err) {
    $.ui.log(`tourism-status: ghi chú lỗi: ${String(err)}`, { to: 'debug' })
  }
  if (report.outcome !== 'failure') return
  const cur = (await read($, watchesAtom))[w.sha] ?? w
  if (!canWake(cur, await read($, wakesAtom), now, CONFIG.wakeMaxPerHour)) return
  await update($, wakesAtom, list => [...pruneWakes(list, now), now])
  await update($, watchesAtom, all => {
    const c = all[w.sha]
    return c === undefined ? all : { ...all, [w.sha]: { ...c, wokeAt: now } }
  })
  void $.prompt.submit({ text: wakePrompt(report) }).catch(() => undefined)
}

// Kiểm như scripts/docs-freshness.sh nhưng trên chính commit sắp đẩy; TZ=UTC như máy CI
async function checkFreshness($: EngineInterface, sha: string): Promise<FreshnessVerdict> {
  const show = await git($, ['show', `${sha}:docs/CHANGELOG.md`])
  const date = show.exitCode === 0 ? latestChangelogDate(show.stdout) : undefined
  if (date === undefined) return freshnessVerdict(undefined, '')
  const log = await git($, freshnessLogArgs(sha, date), { env: { TZ: 'UTC' } })
  return freshnessVerdict(date, log.exitCode === 0 ? log.stdout : '')
}

// Chốt 2: trước push lên main; đỏ thì toast ngay và trả ghi chú để gắn vào kết quả push
export async function prePushCheck($: EngineInterface, cmd: string): Promise<string | undefined> {
  const branch = await currentBranch($)
  const toMain = parsePushTargets(cmd, branch).find(t => t.dst === 'main')
  if (toMain === undefined) return undefined
  const sha = await revParse($, toMain.src)
  if (sha === undefined) return undefined
  const verdict = await checkFreshness($, sha)
  if (verdict.ok) return undefined
  $.ui.toast(freshnessToast(verdict), { timeoutMs: 10_000 })
  return freshnessNote(verdict)
}

// Sau một lệnh shell thành công: nhắc docs sweep (chốt 1), bắt đầu canh CI; trả ghi chú cho Claude
export async function afterShell($: EngineInterface, cmd: string, outputText: string, preNote: string | undefined): Promise<string[]> {
  const notes: string[] = []
  if (!/\bgit\b/.test(cmd)) return notes
  ctx.lastRun.git = 0
  const branch = await currentBranch($)
  if (isFfMergeIntoMain(cmd, branch)) notes.push(MERGE_NOTE)
  if (isGitPush(cmd) && preNote !== undefined) notes.push(preNote)
  if (!isWatchablePush(cmd)) return notes
  const fromOutput = parsePushOutput(outputText)
  const refs = fromOutput.length > 0 ? fromOutput : parsePushTargets(cmd, branch)
  for (const ref of refs) {
    const sha = await revParse($, ref.newSha ?? ref.src)
    if (sha === undefined) continue
    await startWatch($, sha, ref.dst)
    notes.push(watchNote(sha, ref.dst))
  }
  return notes
}

// Lệnh chỉ dùng khi dựng: chạy trọn luồng canh trên một run có sẵn
export async function replay($: EngineInterface, args: string): Promise<string> {
  const [ref = '', branch = 'main'] = args.trim().split(/\s+/)
  if (!/^[0-9a-f]{7,40}$/i.test(ref)) return 'Cú pháp: /tourism-status-replay <sha> [nhánh]'
  const sha = (await revParse($, ref)) ?? ref
  await startWatch($, sha, branch, true)
  void pollWatches($, true).catch(() => undefined)
  return `Đang chạy lại luồng canh CI cho ${sha.slice(0, 7)} (${branch}).`
}
```

`<MOD>/src/shell-hook.ts`:

```ts
import type { Hook } from 'claude-code'
import { afterShell, prePushCheck } from './ci-watch'
import { ctx } from './context'
import { isGitPush } from './logic/push'

// Hook tool.call cho Bash và PowerShell. Không bao giờ ném lỗi sau next(e): lỗi thì trả nguyên kết quả.
export const shellHook: Hook<'tool.call'> = async ($, e, next) => {
  const cmd = String((e as { command?: unknown }).command ?? '')
  let preNote: string | undefined
  if (ctx.active && isGitPush(cmd)) {
    try {
      preNote = await prePushCheck($, cmd)
    } catch (err) {
      $.ui.log(`tourism-status: kiểm trước push lỗi: ${String(err)}`, { to: 'debug' })
    }
  }
  const ran = await next(e)
  if (!ctx.active) return ran
  try {
    ctx.lastActivity = await $.clock.now()
    if (ran.deny !== undefined || ran.isError) return ran
    const notes = await afterShell($, cmd, ran.text ?? '', preNote)
    return notes.length > 0 ? { ...ran, context: [...(ran.context ?? []), ...notes] } : ran
  } catch (err) {
    $.ui.log(`tourism-status: xử lý sau lệnh lỗi: ${String(err)}`, { to: 'debug' })
    return ran
  }
}
```

- [ ] **Step 2: Nối vào nhịp chủ và register**

`<MOD>/src/refresh.ts` — thêm import ở đầu file:

```ts
import { pollWatches } from './ci-watch'
```

và thêm dòng cuối cùng trong thân hàm `tick`:

```ts
  void pollWatches($).catch(err => $.ui.log(`tourism-status: canh CI lỗi: ${String(err)}`, { to: 'debug' }))
```

`<MOD>/hooks/register.tsx` — thay toàn bộ bằng:

```tsx
import type { Register } from 'claude-code'
import { renderBand } from '../src/band'
import { boot } from '../src/boot'
import { replay } from '../src/ci-watch'
import { markEnded } from '../src/collect/peers'
import { ctx } from '../src/context'
import { shellHook } from '../src/shell-hook'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    // Khởi động chạy nền để không chặn prompt đầu tiên; lệnh replay chỉ có ở phiên trong repo
    void boot($, e.cwd)
      .then(async () => {
        if (ctx.active) {
          await $.command.register({ name: 'tourism-status-replay', description: 'Chạy lại luồng canh CI trên một run có sẵn (chỉ dùng khi dựng mod)' })
        }
      })
      .catch(err => $.ui.log(`tourism-status: khởi động lỗi: ${String(err)}`, { to: 'debug' }))
    return started
  })

  on('session.end', async ($, e, next) => {
    if (ctx.active) {
      try {
        await markEnded($, e.sessionId)
      } catch {
        // đóng phiên không được chậm hay hỏng vì mod
      }
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (ctx.active && e.agentId === undefined) {
      ctx.lastActivity = await $.clock.now()
      ctx.lastRun.git = 0 // nhóm git làm mới ở nhịp chủ kế tiếp
    }
    return done
  })

  on('tool.call', { tool: 'Bash' }, shellHook)
  on('tool.call', { tool: 'PowerShell' }, shellHook)

  on('ui.render', { component: 'AbovePrompt' }, renderBand)

  on('command.run', { command: 'tourism-status-replay' }, async ($, e) => ({ text: await replay($, e.args) }))
}
```

- [ ] **Step 3: Validate và test**

Run: `bash "<MOD>/dev.sh" validate` → Expected: thêm `tool.call` (Bash, PowerShell) và
`command.run`; không lỗi.
Run: `bash "<MOD>/dev.sh" test` → Expected: PASS.

- [ ] **Step 4: Thử tay từng bước**

| # | Việc | Đạt khi |
| --- | --- | --- |
| 1 | Replay xanh | user gõ `/tourism-status-replay 3053745e` → toast `CI xanh · 3053745 · … phút`; rồi hỏi Claude "ghi chú CI mới nhất nói gì" → Claude trích đúng dòng `[tourism-status] CI xanh: …` |
| 2 | Replay đỏ | `/tourism-status-replay aede381d` → toast đỏ có tên bước hỏng; một lượt mới tự mở; Claude đọc `gh run view … --log-failed`, báo nguyên nhân, không sửa code, không push |
| 3 | Chống lặp theo SHA | gõ lại `/tourism-status-replay aede381d` → có toast và ghi chú, KHÔNG có lượt mới |
| 4 | Dải trong lúc canh | ngay sau mục 1 hoặc 2, mục CI hiện `⟳ CI …` rồi trở về `CI main …` khi xong |
| 5 | Chốt 2, xanh | Claude chạy `git push --dry-run origin main` → không toast docs-freshness; không có lần canh nào (dry-run) |
| 6 | Chốt 2, đỏ (cần user gật) | Claude tạo commit giả CHỈ trên máy bằng lệnh dưới bảng, rồi chạy `git push --dry-run origin <sha giả>:main` → toast `docs-freshness sẽ đỏ: còn 1 commit feat/fix chưa kể`; Claude thấy ghi chú trong kết quả push. Dry-run không gửi gì lên GitHub; commit giả là object treo, git tự dọn |
| 7 | Chốt 1 | không thử bằng merge thật (đụng nhánh của phiên khác); logic đã có test ở Task 3 |

Lệnh tạo commit giả cho mục 6 (Git Bash, trong repo; không đổi nhánh, không đổi file):

```bash
cd /c/Programming/Devs/Projects/Tourism-Platform-V2 && git commit-tree "$(git rev-parse main^{tree})" -p main -m "feat: commit giả để thử chốt docs-freshness"
```

- [ ] **Step 5: Commit**

```bash
cd "<MOD>" && git add src/ci-watch.ts src/shell-hook.ts src/refresh.ts hooks/register.tsx && git commit -q -m "feat: canh CI sau push, kiểm docs-freshness ba chốt và lệnh replay"
```

---

### Task 8: Chuyển sang dùng thật

**Files:**
- Modify: `<MOD>/hooks/register.tsx` (gỡ lệnh replay)
- Modify: `<MOD>/src/ci-watch.ts` (gỡ hàm `replay`)
- Create: `C:\Programming\Devs\claude-mods\tourism-status\` (bản clone)
- Create: `C:\Programming\Devs\claude-mods\tools\mine-transcripts.mjs` (Phụ lục A)
- Modify: `~/.claude/settings.json` (khối `env`, sau khi user duyệt)
- Create: một file memory mới và một dòng trong `MEMORY.md`

**Interfaces:**
- Consumes: mod đã qua thử tay Task 6 và 7.
- Produces: mod nạp ở mọi phiên mới của app; số đo nền cho Task 9.

- [ ] **Step 1: Gỡ lệnh replay (spec §6)**

Trong `<MOD>/src/ci-watch.ts`: xoá cả hàm `replay` và dòng chú thích ngay trên nó. Thay toàn bộ
`<MOD>/hooks/register.tsx` bằng:

```tsx
import type { Register } from 'claude-code'
import { renderBand } from '../src/band'
import { boot } from '../src/boot'
import { markEnded } from '../src/collect/peers'
import { ctx } from '../src/context'
import { shellHook } from '../src/shell-hook'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    // Khởi động chạy nền để không chặn prompt đầu tiên
    void boot($, e.cwd).catch(err => $.ui.log(`tourism-status: khởi động lỗi: ${String(err)}`, { to: 'debug' }))
    return started
  })

  on('session.end', async ($, e, next) => {
    if (ctx.active) {
      try {
        await markEnded($, e.sessionId)
      } catch {
        // đóng phiên không được chậm hay hỏng vì mod
      }
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (ctx.active && e.agentId === undefined) {
      ctx.lastActivity = await $.clock.now()
      ctx.lastRun.git = 0 // nhóm git làm mới ở nhịp chủ kế tiếp
    }
    return done
  })

  on('tool.call', { tool: 'Bash' }, shellHook)
  on('tool.call', { tool: 'PowerShell' }, shellHook)

  on('ui.render', { component: 'AbovePrompt' }, renderBand)
}
```

Run: `bash "<MOD>/dev.sh" validate` → Expected: không còn `command.run`; không lỗi.
Run: `bash "<MOD>/dev.sh" test` → Expected: PASS.

```bash
cd "<MOD>" && git add hooks/register.tsx src/ci-watch.ts && git commit -q -m "chore: gỡ lệnh replay trước khi dùng thật"
```

- [ ] **Step 2: Clone sang thư mục cố định, chép script đo**

```bash
mkdir -p /c/Programming/Devs/claude-mods/tools && git clone -q "<MOD>" /c/Programming/Devs/claude-mods/tourism-status && git -C /c/Programming/Devs/claude-mods/tourism-status log --oneline
```

Expected: 8 commit (Task 1–7 và commit gỡ replay). Ghi Phụ lục A ra
`C:\Programming\Devs\claude-mods\tools\mine-transcripts.mjs`.

Gỡ bản dựng trong dev-mods để phiên này không nạp hai bản:

```powershell
Remove-Item -LiteralPath '<DEV>\tourism-status' -Recurse -Force
```

- [ ] **Step 3: Đo nền trước khi bật (để Task 9 so)**

```bash
node /c/Programming/Devs/claude-mods/tools/mine-transcripts.mjs /c/Programming/Devs/claude-mods/tools/baseline 2026-09-14 > /dev/null && head -40 /c/Programming/Devs/claude-mods/tools/baseline/summary.md
```

Expected: các dòng `gh run`, `git log`, `git status`… giống bảng ở spec §1 (sai lệch nhỏ vì có
thêm phiên mới).

- [ ] **Step 4: Xin user duyệt và sửa settings**

Hỏi user, chờ câu đồng ý rõ ràng: *"Thêm vào khối `env` của `~/.claude/settings.json` hai biến
`CLAUDE_CODE_PLUGIN_DIRS = C:\Programming\Devs\claude-mods\tourism-status` và
`CLAUDE_CODE_PLUGIN_DIR_WATCH = 1`; sau đó bạn khởi động lại Claude Desktop. Đồng ý chứ?"*

Đồng ý thì gọi Skill `update-config` để thêm đúng hai biến đó (giữ nguyên mọi khoá khác).
Kết quả mong đợi trong file:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "C:\\Programming\\Devs\\claude-mods\\tourism-status",
    "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1"
  }
}
```

- [ ] **Step 5: Kiểm ở phiên mới**

User khởi động lại app, mở một phiên mới trong repo. Đạt khi: dải hiện trong ≤ 30 giây; mở một phiên
thứ hai trong cùng repo thì cả hai phiên hiện `1 phiên khác (1 cùng cây)` trong ≤ 75 giây.

- [ ] **Step 6: Ghi memory**

Tạo `C:\Users\<user>\.claude\projects\C--Programming-Devs-Projects-Tourism-Platform-V2\memory\mod-tourism-status.md`:

```markdown
---
name: mod-tourism-status
description: Mod tourism-status canh CI sau push và hiện dải trạng thái; có mod thì sau push đừng tự poll CI
metadata:
  type: project
---

Từ <ngày bật> mod `tourism-status` (C:\Programming\Devs\claude-mods\tourism-status, nạp qua
CLAUDE_CODE_PLUGIN_DIRS trong ~/.claude/settings.json) chạy ở mọi phiên trong repo: dải trạng thái
trên ô prompt, tự canh CI sau mỗi `git push` của Claude, kiểm docs-freshness trước push lên main.

**Why:** đo 14/09–02/10 thấy `gh run` bị gọi 209 lần trong 11 phiên để canh CI (luật 14); spec
docs/specs/2026-10-02-tourism-status-mod-design.md.

**How to apply:** sau push, thấy ghi chú "tourism-status đang canh CI" trong kết quả lệnh thì KHÔNG
tự poll `gh run list`; kết thúc lượt, chờ ghi chú `[tourism-status] CI xanh/đỏ`. CI đỏ thì mod tự mở
lượt mới: đọc log, báo nguyên nhân, chưa sửa, chưa push. Sau mỗi lần app cập nhật thì chạy
`bash C:/Programming/Devs/claude-mods/tourism-status/dev.sh validate` và `… dev.sh test` (API mod
đang early access). Dải hỏng hay mod lạ thì tắt bằng cách xoá hai biến env.
Liên quan [[session-song-song-chung-worktree]], [[heavy-runs-resource-guard]].
```

Thêm một dòng vào `MEMORY.md`:

```markdown
- [Mod tourism-status](mod-tourism-status.md) — dải trạng thái + tự canh CI sau push; có mod thì đừng tự poll gh run
```

---

### Task 9: Đo sau khoảng một tuần (spec §7 bước 5)

**Files:**
- Không tạo file trong repo. Kết quả báo cho user trong chat.

**Interfaces:**
- Consumes: số đo nền ở Task 8 Step 3; Phụ lục A.
- Produces: đề xuất giữ, chỉnh hay gỡ, và nhóm kế tiếp.

- [ ] **Step 1: Đo các phiên từ ngày bật mod**

```bash
node /c/Programming/Devs/claude-mods/tools/mine-transcripts.mjs /c/Programming/Devs/claude-mods/tools/after <ngày bật dạng YYYY-MM-DD> > /dev/null && head -60 /c/Programming/Devs/claude-mods/tools/after/summary.md
```

- [ ] **Step 2: Đếm CI main đỏ ở bước docs-freshness kể từ ngày bật**

```bash
cd /c/Programming/Devs/Projects/Tourism-Platform-V2 && for id in $(gh run list --workflow ci.yml --branch main --status failure --created ">=<ngày bật>" --json databaseId --jq '.[].databaseId'); do gh run view "$id" --json jobs --jq '.jobs[].steps[] | select(.conclusion=="failure") | .name'; done | sort | uniq -c
```

- [ ] **Step 3: Báo user theo ba tiêu chí của spec §1**

So `after/summary.md` với `baseline/summary.md`: (1) tỉ lệ lệnh `gh run` trên mỗi `git push` của
Claude, (2) lệnh định hướng trong 15 lệnh đầu phiên, (3) số run đỏ ở bước docs-freshness. Kèm nhận
xét của user về độ phiền. Đề xuất giữ, chỉnh ngưỡng hay gỡ, và hỏi user chọn nhóm kế tiếp (Rào chắn,
Phối hợp, Việc nặng), mỗi nhóm một spec riêng.

---

## Phụ lục A — script khai thác transcript

Ghi ở Task 8 Step 2. Chỉ đọc transcript; bỏ qua bí mật dạng chuỗi kết nối, khoá, token. Đối số:
`<thư mục ra> [từ ngày YYYY-MM-DD] [id phiên cần bỏ qua]`.

```js
// Khai thác hành động lặp lại từ transcript các phiên của repo (chỉ đọc, không sửa gì)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

const DIR = path.join(os.homedir(), '.claude', 'projects', 'C--Programming-Devs-Projects-Tourism-Platform-V2')
const [OUT = './mined', SINCE_ARG, SKIP_ID] = process.argv.slice(2)
const SINCE = SINCE_ARG ? Date.parse(`${SINCE_ARG}T00:00:00+07:00`) : 0
fs.mkdirSync(OUT, { recursive: true })

const redact = s =>
  s
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '<PG_URL>')
    .replace(/\b(?:sk|pk|rk|whsec|re|rnd)_[A-Za-z0-9_-]{8,}/g, '<KEY>')
    .replace(/\b(?:ghp|gho|github_pat)_[A-Za-z0-9_]{10,}/g, '<GH_TOKEN>')
    .replace(/((?:password|passwd|secret|token|api[_-]?key|client[_-]?secret)\s*[=:]\s*)[^\s'"]+/gi, '$1<REDACTED>')
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '<JWT>')
const oneLine = (s, n) => redact(s).replace(/\s+/g, ' ').slice(0, n)

const PATTERNS = {
  'CI: gh run list/watch/view': /\bgh run (list|watch|view)\b/,
  'git push (mọi kiểu)': /\bgit (-C \S+ )?push\b/,
  'pnpm gate:int': /\bgate:int\b/,
  'docs-freshness.sh': /docs-freshness/,
  'đụng CHANGELOG': /CHANGELOG/,
  'git status': /\bgit (-C \S+ )?status\b/,
  'git log': /\bgit (-C \S+ )?log\b/,
  'docker ps': /\bdocker ps\b/,
  'kiểm RAM': /Win32_OperatingSystem|FreePhysicalMemory|FreeVirtualMemory|Get-Counter/,
  'kiểm ổ đĩa': /Get-PSDrive|Get-Volume|FreeSpace|df -h/,
  'đụng .env.local': /\.env\.local/,
}
const ORIENT = {
  log: /git (-C \S+ )?log/,
  status: /git (-C \S+ )?status/,
  docker: /docker ps/,
  env: /\.env\.local/,
  ci: /gh run list/,
}

const patternCount = new Map()
const orient = {}
let sessions = 0
let prompts = 0
let commands = 0
const bump = (key, sid) => {
  const v = patternCount.get(key) ?? { n: 0, s: new Set() }
  v.n += 1
  v.s.add(sid)
  patternCount.set(key, v)
}

for (const f of fs.readdirSync(DIR).filter(n => n.endsWith('.jsonl'))) {
  const sid = f.replace('.jsonl', '')
  if (SKIP_ID && sid.startsWith(SKIP_ID)) continue
  const first = []
  let seen = false
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(DIR, f)), crlfDelay: Number.POSITIVE_INFINITY })
  for await (const line of rl) {
    let o
    try {
      o = JSON.parse(line)
    } catch {
      continue
    }
    const ts = o.timestamp ? Date.parse(o.timestamp) : 0
    if (ts < SINCE || o.isSidechain) continue
    seen = true
    const c = o.message?.content
    if (o.type === 'user' && !o.isMeta && (typeof c === 'string' || (Array.isArray(c) && !c.some(b => b.type === 'tool_result')))) prompts += 1
    if (o.type !== 'assistant' || !Array.isArray(c)) continue
    for (const b of c) {
      if (b.type !== 'tool_use' || (b.name !== 'Bash' && b.name !== 'PowerShell')) continue
      const cmd = String(b.input?.command ?? '')
      commands += 1
      if (first.length < 15) first.push(cmd)
      for (const [k, re] of Object.entries(PATTERNS)) if (re.test(cmd)) bump(k, sid)
    }
  }
  if (!seen) continue
  sessions += 1
  const head = first.join('\n')
  for (const [k, re] of Object.entries(ORIENT)) if (re.test(head)) orient[k] = (orient[k] ?? 0) + 1
}

const L = []
L.push(`# ${sessions} phiên, ${prompts} prompt, ${commands} lệnh shell${SINCE ? ` (từ ${SINCE_ARG})` : ''}`)
L.push('\n## Mẫu lệnh (số phiên, số lần)')
for (const [k, v] of [...patternCount.entries()].sort((a, b) => b[1].s.size - a[1].s.size)) L.push(`- ${k}: ${v.s.size} phiên, ${v.n} lần`)
const pushes = patternCount.get('git push (mọi kiểu)')?.n ?? 0
const ghRuns = patternCount.get('CI: gh run list/watch/view')?.n ?? 0
L.push(`\n## gh run trên mỗi git push: ${pushes === 0 ? 'chưa có push' : (ghRuns / pushes).toFixed(1)}`)
L.push(`\n## Định hướng trong 15 lệnh đầu phiên: ${JSON.stringify(orient)}`)
fs.writeFileSync(path.join(OUT, 'summary.md'), L.join('\n'))
console.log(L.join('\n'))
```

## Prompt bàn giao (dán vào phiên thi công)

```text
Bạn là phiên THI CÔNG mod `tourism-status` cho repo Tourism-Platform-V2
(C:\Programming\Devs\Projects\Tourism-Platform-V2, Windows native, Git Bash cho script).
Đọc theo thứ tự: CLAUDE.md (luật 8 comment tiếng Việt, luật 12 commit, luật 15 hạ tầng) →
docs/specs/2026-10-02-tourism-status-mod-design.md → docs/plans/2026-10-02-tourism-status-mod.md.
Làm đúng plan, từng task, theo superpowers:executing-plans.

Luật cứng của đợt này:
- Mod nằm NGOÀI repo. Không sửa, commit hay push file nào của Tourism-Platform-V2; không tạo nhánh;
  không push gì lên GitHub. Luồng CI thử bằng lệnh replay (Task 7), không bằng push thật.
- Bước đầu tiên: gọi Skill `plugin-authoring` để có thư mục dev-mods của phiên (<DEV>); file đầu tiên
  ghi vào đó làm app hỏi bật hot reload — nhờ user chọn "Enable for this session".
- Task 0 là cổng: mục nào hỏng thì DỪNG và báo user, không tự chỉnh thiết kế.
- TDD cho src/logic: test trước, chạy thấy đỏ, rồi mới code; test chạy bằng `bash <MOD>/dev.sh test`
  (claude.exe của app; CLI không có trên PATH). Thử đột biến ở Task 5 Step 5.
- Hook tool.call không bao giờ ném lỗi sau next(e); mod không trả { deny }, chỉ thêm context.
- Comment code tiếng Việt; chữ trên dải và thông báo tiếng Việt.
- Commit trong git riêng của mod: Conventional Commits, tiếng Việt CÓ DẤU, KHÔNG AI attribution,
  stage đường dẫn tường minh.
- Thử tay từng bước: mỗi lượt một bước, chờ user báo kết quả rồi mới sang bước kế.
- Không chạm hạ tầng sống (Supabase, Render, Vercel, Stripe, PayPal, Resend, Cloudinary).
- Không sửa ~/.claude/settings.json trước Task 8; ở Task 8 phải hỏi user và chờ đồng ý rõ ràng.
- Không dùng subagent cho Task 0, 6, 7, 8 (có bước thử tay trên Code tab).
```
