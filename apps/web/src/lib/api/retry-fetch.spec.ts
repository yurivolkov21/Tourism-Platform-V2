import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { describe, expect, it, vi } from 'vitest';
import {
  BUILD_RETRY_DELAYS_MS,
  createRetryingFetch,
  isTransientError,
  isTransientStatus,
  RETRY_DELAYS_MS,
  retryDelaysFor,
} from './retry-fetch';

/**
 * Luật thử lại của ADR-0044. Spec bám đúng bốn ràng buộc của ADR: chỉ GET, chỉ
 * phía server, chỉ lỗi tạm thời, và số lượt theo lịch chờ — ba lượt lúc chạy,
 * sáu lượt lúc `next build` (AMEND 1).
 *
 * `sleep` được tiêm nên spec không chờ đồng hồ thật — cùng khuôn với
 * `warm-api.spec.ts`.
 */

/** Response giả chỉ cần `status`; thân không ai đọc trong các ca này. */
const res = (status: number) => new Response(null, { status });
const get = () => new Request('https://api.example.test/api/posts?page=2', { method: 'GET' });
const post = () =>
  new Request('https://api.example.test/api/bookings', { method: 'POST', body: '{}' });

/** Bộ đếm lượt ngủ và dòng log để khẳng định đúng nhịp giãn của ADR. */
function harness(
  responder: (attempt: number) => Promise<Response>,
  opts: { isServer?: boolean; delaysMs?: readonly number[] } = {},
) {
  const slept: number[] = [];
  const logged: string[] = [];
  let attempt = 0;
  const fetchMock = vi.fn(() => {
    attempt += 1;
    return responder(attempt);
  });
  const run = createRetryingFetch({
    fetch: fetchMock,
    sleep: async (ms: number) => {
      slept.push(ms);
    },
    isServer: () => opts.isServer ?? true,
    log: (line) => {
      logged.push(line);
    },
    ...(opts.delaysMs ? { delaysMs: opts.delaysMs } : {}),
  });
  return { run, fetchMock, slept, logged };
}

describe('retryDelaysFor', () => {
  // Lấy hằng từ chính Next chứ không gõ lại chuỗi: Next đổi tên pha thì ca này
  // đỏ, thay vì lặng lẽ rơi về lịch ngắn đúng lúc build cần lịch dài.
  it('lúc next build dùng lịch dài: 1s, 2s, 4s, 8s, 15s — sáu lượt, chờ tổng 30 giây', () => {
    expect(retryDelaysFor(PHASE_PRODUCTION_BUILD)).toEqual([1000, 2000, 4000, 8000, 15_000]);
  });

  it.each([undefined, '', 'phase-production-server', 'phase-development-server'])(
    'pha %s giữ lịch ngắn 400ms rồi 1200ms',
    (phase) => {
      expect(retryDelaysFor(phase)).toEqual([400, 1200]);
    },
  );
});

describe('isTransientStatus', () => {
  it.each([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524])(
    '%i là tạm thời',
    (status) => {
      expect(isTransientStatus(status)).toBe(true);
    },
  );

  // 404 phải đi thẳng: `POST_NOT_FOUND` cần tới được nhánh notFound() của page,
  // thử lại nó là ba lần chậm rồi vẫn 404 (ADR-0044 §Quyết định 1.3).
  it.each([200, 201, 400, 401, 403, 404, 409, 422])('%i KHÔNG tạm thời', (status) => {
    expect(isTransientStatus(status)).toBe(false);
  });
});

describe('isTransientError', () => {
  it('nhận TimeoutError của AbortSignal.timeout()', () => {
    expect(isTransientError(new DOMException('aborted', 'TimeoutError'))).toBe(true);
  });

  it('nhận lỗi mạng của fetch (TypeError)', () => {
    expect(isTransientError(new TypeError('fetch failed'))).toBe(true);
  });

  it('KHÔNG nhận lỗi thường', () => {
    expect(isTransientError(new Error('boom'))).toBe(false);
  });
});

describe('createRetryingFetch', () => {
  it('trả ngay khi lượt đầu thành công, không ngủ lần nào', async () => {
    const { run, fetchMock, slept } = harness(async () => res(200));
    const out = await run(get(), {});
    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(slept).toEqual([]);
  });

  it('thử lại 502 rồi lấy được 200 ở lượt hai', async () => {
    const { run, fetchMock, slept } = harness(async (n) => res(n === 1 ? 502 : 200));
    const out = await run(get(), {});
    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(slept).toEqual([RETRY_DELAYS_MS[0]]);
  });

  it('hết ba lượt vẫn 520 thì trả chính response cuối, không ném', async () => {
    const { run, fetchMock, slept } = harness(async () => res(520));
    const out = await run(get(), {});
    expect(out.status).toBe(520);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(slept).toEqual([...RETRY_DELAYS_MS]);
  });

  it('thử lại TimeoutError rồi thành công', async () => {
    const { run, fetchMock } = harness(async (n) => {
      if (n === 1) throw new DOMException('aborted', 'TimeoutError');
      return res(200);
    });
    const out = await run(get(), {});
    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('hết lượt vẫn lỗi mạng thì ném lại lỗi cuối', async () => {
    const boom = new TypeError('fetch failed');
    const { run, fetchMock } = harness(async () => {
      throw boom;
    });
    await expect(run(get(), {})).rejects.toBe(boom);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('404 KHÔNG thử lại', async () => {
    const { run, fetchMock } = harness(async () => res(404));
    const out = await run(get(), {});
    expect(out.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lỗi thường KHÔNG thử lại', async () => {
    const { run, fetchMock } = harness(async () => {
      throw new Error('boom');
    });
    await expect(run(get(), {})).rejects.toThrow('boom');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Ràng buộc đường tiền: gửi lại một POST là nguy cơ đặt trùng chỗ và thu tiền
  // hai lần (ADR-0044 §Quyết định 1.1).
  it('POST KHÔNG bao giờ thử lại, kể cả khi 502', async () => {
    const { run, fetchMock } = harness(async () => res(502));
    const out = await run(post(), {});
    expect(out.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('phía trình duyệt KHÔNG thử lại', async () => {
    const { run, fetchMock } = harness(async () => res(502), { isServer: false });
    const out = await run(get(), {});
    expect(out.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // AMEND 1: lịch build đi đủ sáu lượt với đúng nhịp giãn, rồi mới chịu thua.
  it('lịch build: hết sáu lượt vẫn ECONNRESET thì ném lại lỗi cuối', async () => {
    const boom = new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
    const { run, fetchMock, slept } = harness(
      async () => {
        throw boom;
      },
      { delaysMs: BUILD_RETRY_DELAYS_MS },
    );
    await expect(run(get(), {})).rejects.toBe(boom);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(slept).toEqual([...BUILD_RETRY_DELAYS_MS]);
  });
});

describe('createRetryingFetch — dòng cảnh báo mỗi lần thử lại (AMEND 1)', () => {
  it('status tạm thời: ghi đường dẫn (không query), lượt, nhịp chờ và mã HTTP', async () => {
    const { run, logged } = harness(async (n) => res(n === 1 ? 502 : 200));
    await run(get(), {});
    expect(logged).toEqual(['GET /api/posts — lượt 1/3 trả HTTP 502, thử lại sau 400ms']);
  });

  it('lỗi mạng: ghi tên lỗi kèm mã nguyên nhân (ECONNRESET)', async () => {
    const { run, logged } = harness(async (n) => {
      if (n < 3) throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
      return res(200);
    });
    await run(get(), {});
    expect(logged).toEqual([
      'GET /api/posts — lượt 1/3 lỗi TypeError: fetch failed (ECONNRESET), thử lại sau 400ms',
      'GET /api/posts — lượt 2/3 lỗi TypeError: fetch failed (ECONNRESET), thử lại sau 1200ms',
    ]);
  });

  it('lỗi không có mã nguyên nhân thì chỉ ghi tên lỗi', async () => {
    const { run, logged } = harness(async (n) => {
      if (n === 1) throw new DOMException('aborted', 'TimeoutError');
      return res(200);
    });
    await run(get(), {});
    expect(logged).toEqual([
      'GET /api/posts — lượt 1/3 lỗi TimeoutError: aborted, thử lại sau 400ms',
    ]);
  });

  // Lượt cuối không thử lại nữa: lỗi đi tiếp lên Next và Next tự in, ghi thêm
  // một dòng "thử lại" ở đây là nói sai.
  it('lượt cuối, thành công, hay lỗi không đáng thử lại đều KHÔNG ghi gì', async () => {
    const last = harness(async () => res(520));
    await last.run(get(), {});
    expect(last.logged).toHaveLength(2);

    const ok = harness(async () => res(200));
    await ok.run(get(), {});
    expect(ok.logged).toEqual([]);

    const notFound = harness(async () => res(404));
    await notFound.run(get(), {});
    expect(notFound.logged).toEqual([]);
  });
});
