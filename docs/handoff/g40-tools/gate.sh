#!/usr/bin/env bash
# Gate đầy đủ G40 Phần 1, tách bước theo memory "Hãm tài nguyên": int → build api → API 3001 → build → typecheck → unit → biome.
set -u
export PATH="/c/Users/yuriv/AppData/Local/pnpm/package-manager-store/v11/links/@pnpm/exe/11.9.0/9f525feb2a3c3316f7728838f4359993f9f783000a9bf5c38fb86f5e4021310c/bin:$PATH"
cd /c/Programming/Devs/Projects/Tourism-Platform-V2/.claude/worktrees/g40-print-web-part1-2ac874 || exit 1
step() { echo "=== $(date +%H:%M:%S) $1"; }
kill_api() { powershell.exe -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }" >/dev/null 2>&1; }
fail() { echo "GATE ĐỎ ở bước: $1"; kill_api; exit 1; }
step "test:int"; pnpm test:int --concurrency=2 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |Test Files|FAIL|failed|Tasks:" ; [ "${PIPESTATUS[0]}" = 0 ] || fail test:int
step "migrate DB dev local (docker)"; (cd apps/api && pnpm exec prisma migrate deploy 2>&1 | tail -2); [ "${PIPESTATUS[0]}" = 0 ] || fail migrate
step "build api"; pnpm turbo run build --filter=@tourism/api --concurrency=1 --output-logs=errors-only 2>&1 | tail -3; [ "${PIPESTATUS[0]}" = 0 ] || fail "build api"
step "API 3001"; (cd apps/api && node --env-file-if-exists=.env.local dist/main.js > ../../api-gate.log 2>&1) & API_PID=$!
for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:3001/health && break; sleep 1; done; curl -sf -o /dev/null http://localhost:3001/health || { tail -20 api-gate.log; fail "API 3001 không lên"; }
step "build"; pnpm turbo run build --concurrency=1 --output-logs=errors-only 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | tail -6; [ "${PIPESTATUS[0]}" = 0 ] || fail build
step "typecheck"; pnpm turbo run typecheck --concurrency=3 --output-logs=errors-only 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | tail -4; [ "${PIPESTATUS[0]}" = 0 ] || fail typecheck
step "unit"; pnpm turbo run test --concurrency=1 -- --maxWorkers=4 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |Tests:|Test Files|FAIL|Tasks:" ; [ "${PIPESTATUS[0]}" = 0 ] || fail unit
step "biome"; pnpm exec biome check . 2>&1 | tail -2; [ "${PIPESTATUS[0]}" = 0 ] || fail biome
step "mobile tokens"; node scripts/check-mobile-tokens-only.mjs 2>&1 | tail -2; [ "${PIPESTATUS[0]}" = 0 ] || fail "mobile tokens"
kill_api
step "GATE XANH"
