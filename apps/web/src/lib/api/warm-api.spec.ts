import { describe, expect, it, vi } from 'vitest';
import { resolveOrigin, waitForApi } from '../../../scripts/warm-api.mjs';

/**
 * Bước đánh thức API trước `next build` (ADR-0024 AMEND 1): logic chờ tách
 * khỏi tiến trình để spec chạy không cần đồng hồ thật — `now`/`sleep`/`fetch`
 * đều tiêm.
 */

/** Đồng hồ giả: mỗi `sleep(ms)` đẩy `now` lên đúng ms. */
function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
  };
}

const ok = () => Promise.resolve({ ok: true, status: 200 } as Response);
const down = () => Promise.reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));

describe('resolveOrigin', () => {
  it('cùng thứ tự ưu tiên với resolveApiOrigin của client: API_URL → NEXT_PUBLIC_API_URL → localhost', () => {
    expect(resolveOrigin({ API_URL: 'http://api/', NEXT_PUBLIC_API_URL: 'http://pub' })).toBe(
      'http://api',
    );
    expect(resolveOrigin({ NEXT_PUBLIC_API_URL: 'http://pub' })).toBe('http://pub');
    expect(resolveOrigin({})).toBe('http://localhost:3001');
  });
});

describe('waitForApi', () => {
  it('trả ok ngay ở lần gọi đầu khi API đã tỉnh — không ngủ', async () => {
    const clock = fakeClock();
    const fetch = vi.fn(ok);
    const result = await waitForApi({ origin: 'http://api', fetch, ...clock });
    expect(result).toEqual({ ok: true, attempts: 1, waitedMs: 0, lastError: '' });
    expect(fetch).toHaveBeenCalledWith('http://api/api/health', expect.anything());
  });

  it('gọi lại theo intervalMs cho tới khi API thức (cold start ~50s trong hạn 90s)', async () => {
    const clock = fakeClock();
    // 16 lần đầu (48s) chết timeout, lần 17 tỉnh.
    const fetch = vi.fn(async () => (fetch.mock.calls.length <= 16 ? down() : ok()));
    const log = vi.fn();
    const result = await waitForApi({ origin: 'http://api', fetch, log, ...clock });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(17);
    expect(result.waitedMs).toBe(16 * 3_000);
    expect(log).toHaveBeenCalledTimes(16);
    expect(log.mock.calls[0]?.[0]).toContain('TimeoutError');
  });

  it('hết hạn thì trả ok=false kèm lỗi cuối — KHÔNG ném, để next build tự quyết', async () => {
    const clock = fakeClock();
    const fetch = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
    const result = await waitForApi({ origin: 'http://api', fetch, deadlineMs: 10_000, ...clock });
    expect(result.ok).toBe(false);
    expect(result.lastError).toBe('HTTP 503');
    // 0s, 3s, 6s, 9s — bốn lần trong hạn 10s.
    expect(result.attempts).toBe(4);
    expect(result.waitedMs).toBe(12_000);
  });
});
