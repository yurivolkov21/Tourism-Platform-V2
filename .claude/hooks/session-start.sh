#!/bin/bash
# SessionStart hook — dựng môi trường cho session Claude Code trên web (cloud).
#
# Container cloud clone repo mới tinh: Node chỉ có 20/21/22 (repo đòi >=24),
# chưa có node_modules, không Postgres nào đang chạy và không có `.env.local`.
# Hook đưa nó về đúng trạng thái một máy dev vừa clone xong để `pnpm gate:int`
# chạy được (CLAUDE.md luật 11) — KHÔNG cần khai biến môi trường hay secret ở
# cài đặt environment của cloud.
#
# Chỉ chạy trên cloud (CLAUDE_CODE_REMOTE=true): máy dev Windows native tự dựng
# môi trường theo CLAUDE.md §Gotchas nên hook thoát ngay ở đó.
#
# Idempotent: chạy lại ở resume/clear/compact chỉ kiểm rồi bỏ qua phần đã có.
# Output dài dồn vào log; stdout chỉ in vài dòng tóm tắt vì stdout của
# SessionStart được đưa thẳng vào ngữ cảnh của Claude.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

LOG="${TMPDIR:-/tmp}/tourism-session-start.log"
DOCKERD_LOG="${TMPDIR:-/tmp}/tourism-dockerd.log"
: >"$LOG"

# Lỗi ở phần bắt buộc (Node, pnpm, install): in đuôi log ra stderr rồi thoát 2
# — với SessionStart, exit 2 hiện stderr cho người dùng và session vẫn mở.
fail() {
  echo "session-start: $1 — log đầy đủ ở $LOG" >&2
  tail -n 30 "$LOG" >&2
  exit 2
}

# ── Node 24 ── khớp `engines` (>=24), `node-version: 24` của CI và
# `node:24-alpine` của Dockerfile. Image cloud có sẵn nvm ở /opt/nvm.
NODE_MAJOR=24
export NVM_DIR="${NVM_DIR:-/opt/nvm}"
[ -s "$NVM_DIR/nvm.sh" ] || fail "không thấy nvm ở $NVM_DIR"
# nvm.sh đọc biến chưa khai báo nên phải tạm tắt `set -u`; `--no-use` để nó
# không tự chuyển sang alias default (chưa đặt thì trả mã lỗi).
set +u
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh" --no-use
# Chỉ tải khi chưa có bản 24.x nào: `nvm install 24` luôn hỏi nodejs.org bản
# mới nhất, chạy mỗi lần mở session là lệ thuộc mạng vô ích.
if ! nvm which "$NODE_MAJOR" >/dev/null 2>&1; then
  nvm install "$NODE_MAJOR" >>"$LOG" 2>&1 || fail "nvm install $NODE_MAJOR lỗi"
fi
NODE_BIN="$(dirname "$(nvm which "$NODE_MAJOR")")"
set -u
export PATH="$NODE_BIN:$PATH"

# Ghi PATH cho mọi lệnh Bash về sau trong session — thiếu dòng này thì `node`
# vẫn trỏ /opt/node22 của image. Kiểm trùng vì hook chạy lại ở resume.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  path_line="export PATH=\"$NODE_BIN:\$PATH\""
  grep -qxF "$path_line" "$CLAUDE_ENV_FILE" 2>/dev/null || echo "$path_line" >>"$CLAUDE_ENV_FILE"
fi

# ── pnpm ── đúng bản ghim ở `packageManager` (CI dùng pnpm/action-setup đọc
# cùng trường này). Cài vào thư mục bin của Node 24 để đi chung PATH ở trên.
PNPM_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]")"
if [ "$("$NODE_BIN/pnpm" --version 2>/dev/null || true)" != "$PNPM_VERSION" ]; then
  npm install -g "pnpm@$PNPM_VERSION" >>"$LOG" 2>&1 || fail "cài pnpm@$PNPM_VERSION lỗi"
fi

# ── Dependency ── `--frozen-lockfile` như CI: lock lệch package.json là lỗi
# thật cần thấy ngay, không âm thầm sửa lock trên nhánh đang review.
pnpm install --frozen-lockfile >>"$LOG" 2>&1 || fail "pnpm install --frozen-lockfile lỗi"

# ── File env dev ── `.env.local` là file DUY NHẤT script pnpm tự đọc (CLAUDE.md
# §Gotchas). Clone mới không có nên chép từ `.env.example`: toàn giá trị dev trỏ
# localhost, không secret, không chạm Supabase/Stripe/Resend thật (luật 15).
# File đã có thì để nguyên.
for example in apps/*/.env.example; do
  target="${example%.example}.local"
  [ -e "$target" ] || cp "$example" "$target"
done

# ── Postgres 17 cho test:int ── dựng bằng chính compose.yaml như máy dev, cùng
# image postgres:17-alpine với CI. Không dùng Postgres 16 có sẵn trong image:
# test khác major version với dev/CI là lỗi chỉ lộ ở một phía. Phần này KHÔNG
# bắt buộc — review code hay chạy unit test không cần DB, nên lỗi chỉ cảnh báo.
start_postgres() {
  command -v docker >/dev/null 2>&1 || return 1
  if ! docker info >/dev/null 2>&1; then
    # Container cloud không chạy sẵn dockerd. /run không phải tmpfs nên pid file
    # có thể sót lại từ ảnh chụp container và làm dockerd từ chối khởi động.
    rm -f /var/run/docker.pid
    # setsid và đổi hướng mọi fd: dockerd phải sống tiếp sau khi hook kết thúc
    # và không được giữ stdout của hook (giữ thì hook treo tới timeout).
    setsid dockerd >>"$DOCKERD_LOG" 2>&1 </dev/null &
    for _ in $(seq 1 30); do
      docker info >/dev/null 2>&1 && break
      sleep 1
    done
  fi
  docker compose up -d --wait --wait-timeout 120 postgres >>"$LOG" 2>&1
}

if start_postgres; then
  db_status="Postgres 17 (docker compose) ở localhost:5432"
else
  db_status="CẢNH BÁO: Postgres KHÔNG lên được — test:int/gate:int sẽ đỏ (log: $LOG)"
fi

echo "session-start: Node $(node -v), pnpm $(pnpm --version), dependency đã cài, .env.local dev đủ; $db_status."
echo "session-start: build web trong \`pnpm gate\` cần API sống ở :3001 — dựng như bước \"Migrate + seed\" của .github/workflows/ci.yml."
