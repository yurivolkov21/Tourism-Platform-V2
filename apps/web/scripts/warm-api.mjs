/**
 * Đánh thức API trước `next build` — vá ca "Render free ngủ 15 phút".
 *
 * ── Vì sao cần ──
 * Build web gọi API THẬT lúc prerender (ADR-0016 §3: `generateStaticParams`
 * của /blog, /tours, /destinations cố ý KHÔNG `settle` lỗi — API chết thì
 * build phải đỏ). Client oRPC có timeout 10s. Render free tier ngủ sau 15
 * phút im lặng và thức dậy mất ~50s (spec deploy v1 §"Render free ngủ"), nên
 * push nào tới sau một khoảng lặng là request đầu tiên của build chết
 * `TimeoutError` ở "Collecting page data" — deploy web ERROR trong khi CI
 * xanh (CI có API riêng trên localhost). Đã dính 02/09 (`233c559`) và 05/09
 * (`03eaef9`), cả hai đều là commit docs sau >15 phút không ai chạm site.
 *
 * ── Nguyên tắc: THẤT BẠI THÌ MỞ (như guard-build.mjs) ──
 * Script chỉ CHỜ API trả lời `/api/health`, rồi luôn thoát 0. Hết hạn mà API
 * vẫn im thì `next build` chạy tiếp và tự đỏ với lỗi thật của nó — một nguồn
 * sự thật cho "API chết", không phải hai. Script này không thay đổi luật
 * "build với API sống", chỉ xoá đúng ca "API đang ngủ".
 *
 * Origin đọc giống `src/lib/api/env.ts` (`API_URL` → `NEXT_PUBLIC_API_URL` →
 * localhost:3001) để đánh thức ĐÚNG host mà build sẽ gọi. Trên Vercel turbo
 * chạy strict env nên `API_URL` bị lọc, `NEXT_PUBLIC_*` đi qua nhờ framework
 * inference — cùng lý do client build bằng biến public.
 *
 * Bỏ qua có chủ đích: `SKIP_API_WARMUP=1`. Rút ngắn khi thử tay:
 * `API_WARMUP_DEADLINE_MS=5000`.
 */
import { pathToFileURL } from 'node:url';

/** Origin API mà build sẽ gọi — cùng thứ tự ưu tiên với `resolveApiOrigin`. */
export function resolveOrigin(env) {
  const raw = env.API_URL || env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return raw.replace(/\/+$/, '');
}

/**
 * Gọi `/api/health` tới khi 2xx hoặc hết `deadlineMs`. Mọi phụ thuộc thời
 * gian/mạng tiêm được để spec chạy không cần chờ thật.
 *
 * @param {{
 *   origin: string;
 *   fetch?: typeof globalThis.fetch;
 *   sleep?: (ms: number) => Promise<void>;
 *   now?: () => number;
 *   deadlineMs?: number;
 *   intervalMs?: number;
 *   requestTimeoutMs?: number;
 *   log?: (line: string) => void;
 * }} options
 * @returns {Promise<{ ok: boolean; attempts: number; waitedMs: number; lastError: string }>}
 */
export async function waitForApi({
  origin,
  fetch = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  deadlineMs = 90_000,
  intervalMs = 3_000,
  requestTimeoutMs = 5_000,
  log = () => {},
}) {
  const url = `${origin}/api/health`;
  const start = now();
  let attempts = 0;
  let lastError = '';
  while (now() - start < deadlineMs) {
    attempts += 1;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(requestTimeoutMs) });
      if (res.ok) return { ok: true, attempts, waitedMs: now() - start, lastError: '' };
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      // `fetch failed` của undici giấu ECONNREFUSED/ENOTFOUND trong `cause` —
      // in mã đó ra thì log Vercel đọc được ngay là ngủ hay là sai host.
      lastError = errorLabel(error);
    }
    log(`  … API chưa trả lời (${lastError}), thử lại sau ${intervalMs / 1000}s`);
    await sleep(intervalMs);
  }
  return { ok: false, attempts, waitedMs: now() - start, lastError };
}

/** Tên lỗi ngắn cho log: mã của `cause` (ECONNREFUSED…) nếu có, không thì tên lỗi. */
function errorLabel(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string') {
    return `${error.name}: ${cause.code}`;
  }
  return error.name;
}

async function main() {
  if (process.env.SKIP_API_WARMUP === '1') return;
  const origin = resolveOrigin(process.env);
  const deadlineMs = Number(process.env.API_WARMUP_DEADLINE_MS) || 90_000;
  console.log(`⏳ Đánh thức API ${origin} (tối đa ${deadlineMs / 1000}s) trước next build…`);
  const result = await waitForApi({ origin, deadlineMs, log: (line) => console.log(line) });
  if (result.ok) {
    console.log(
      `✓ API trả lời sau ${result.attempts} lần gọi, ${Math.round(result.waitedMs / 1000)}s`,
    );
    return;
  }
  // Thất bại thì mở: next build tự đỏ với lỗi thật nếu API vẫn im.
  console.warn(
    `⚠ API vẫn im sau ${Math.round(result.waitedMs / 1000)}s (${result.lastError}) — cho next build tự quyết.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
