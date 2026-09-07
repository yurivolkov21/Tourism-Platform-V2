import { describe, expect, it, vi } from 'vitest';
import {
  DEV_REVALIDATE_SECRET,
  handleRevalidatePost,
  parseRevalidateBody,
  REVALIDATE_BUDGET_LIMIT,
  RevalidateBudget,
  resolveRevalidateSecret,
  secretMatches,
} from './revalidate-route';

/** Dựng Request thật cho POST /api/revalidate — không mock Request/Headers. */
function makeRequest(body: unknown, secret?: string): Request {
  return new Request('http://web.test/api/revalidate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { 'x-revalidate-secret': secret } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('parseRevalidateBody', () => {
  it('hợp lệ một tag chuẩn (posts)', () => {
    const res = parseRevalidateBody({ tags: ['tours'] });
    expect(res).toEqual({ ok: true, tags: ['tours'] });
  });

  it('hợp lệ nhiều tag, trộn taxonomy list + detail', () => {
    const res = parseRevalidateBody({ tags: ['posts', 'post:ha-noi'] });
    expect(res).toEqual({ ok: true, tags: ['posts', 'post:ha-noi'] });
  });

  it('dedupe tag trùng — bust hai lần một tag chỉ tính một', () => {
    const res = parseRevalidateBody({ tags: ['tours', 'tours'] });
    expect(res).toEqual({ ok: true, tags: ['tours'] });
  });

  it('mảng rỗng → error', () => {
    const res = parseRevalidateBody({ tags: [] });
    expect(res.ok).toBe(false);
  });

  it('quá 20 tag → error', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tour:t${i}`);
    const res = parseRevalidateBody({ tags });
    expect(res.ok).toBe(false);
  });

  it('tags không phải mảng → error', () => {
    const res = parseRevalidateBody({ tags: 'tours' });
    expect(res.ok).toBe(false);
  });

  it('body không có field tags → error', () => {
    const res = parseRevalidateBody({});
    expect(res.ok).toBe(false);
  });

  it('body null → error', () => {
    const res = parseRevalidateBody(null);
    expect(res.ok).toBe(false);
  });

  it('phần tử không phải string → error', () => {
    const res = parseRevalidateBody({ tags: ['tours', 42] });
    expect(res.ok).toBe(false);
  });

  it('site-media qua whitelist — taxonomy tags.ts có nó từ trước, whitelist từng lệch (W3-O5)', () => {
    expect(parseRevalidateBody({ tags: ['site-media'] })).toEqual({
      ok: true,
      tags: ['site-media'],
    });
  });

  it('tag lạ ngoài whitelist → rejected kể tên (users)', () => {
    const res = parseRevalidateBody({ tags: ['users'] });
    expect(res).toMatchObject({ ok: false, rejected: ['users'] });
  });

  it('tag detail viết hoa → rejected (chỉ chấp nhận a-z0-9-)', () => {
    const res = parseRevalidateBody({ tags: ['tour:UPPER'] });
    expect(res).toMatchObject({ ok: false, rejected: ['tour:UPPER'] });
  });

  it('tag detail thiếu slug (tour: rỗng) → rejected', () => {
    const res = parseRevalidateBody({ tags: ['tour:'] });
    expect(res).toMatchObject({ ok: false, rejected: ['tour:'] });
  });

  it('slug detail quá 100 ký tự → rejected', () => {
    const longSlug = `tour:${'a'.repeat(101)}`;
    const res = parseRevalidateBody({ tags: [longSlug] });
    expect(res).toMatchObject({ ok: false, rejected: [longSlug] });
  });
});

describe('secretMatches', () => {
  it('đúng secret → true', () => {
    expect(secretMatches('correct-secret', 'correct-secret')).toBe(true);
  });

  it('sai secret cùng độ dài → false', () => {
    expect(secretMatches('wrong-secretx', 'correct-secret'.slice(0, 13))).toBe(false);
  });

  it('lệch độ dài → false, không throw', () => {
    expect(() => secretMatches('short', 'a-much-longer-secret')).not.toThrow();
    expect(secretMatches('short', 'a-much-longer-secret')).toBe(false);
  });

  it('provided null → false', () => {
    expect(secretMatches(null, 'correct-secret')).toBe(false);
  });
});

// ADR-0016 AMEND 1 §3 — gương fail-fast của env.ts API: production không
// được sống bằng secret dev hard-code (audit cụm 5, mức Cao).
describe('resolveRevalidateSecret', () => {
  it('có REVALIDATE_SECRET → dùng đúng nó, mọi môi trường', () => {
    expect(
      resolveRevalidateSecret({ REVALIDATE_SECRET: 'prod-secret', NODE_ENV: 'production' }),
    ).toBe('prod-secret');
  });

  it('production thiếu/rỗng → throw nêu tên biến', () => {
    expect(() => resolveRevalidateSecret({ NODE_ENV: 'production' })).toThrow(/REVALIDATE_SECRET/);
    expect(() =>
      resolveRevalidateSecret({ REVALIDATE_SECRET: '', NODE_ENV: 'production' }),
    ).toThrow(/REVALIDATE_SECRET/);
  });

  it('ngoài production thiếu → fallback DEV_REVALIDATE_SECRET (khớp phía API)', () => {
    expect(resolveRevalidateSecret({ NODE_ENV: 'development' })).toBe(DEV_REVALIDATE_SECRET);
    expect(resolveRevalidateSecret({ REVALIDATE_SECRET: '', NODE_ENV: 'test' })).toBe(
      DEV_REVALIDATE_SECRET,
    );
  });
});

describe('handleRevalidatePost', () => {
  it('thiếu header secret → 401, revalidateTag không được gọi', async () => {
    const revalidateTag = vi.fn();
    const res = await handleRevalidatePost(makeRequest({ tags: ['tours'] }), {
      expectedSecret: DEV_REVALIDATE_SECRET,
      revalidateTag,
    });
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('sai header secret → 401, revalidateTag không được gọi', async () => {
    const revalidateTag = vi.fn();
    const res = await handleRevalidatePost(makeRequest({ tags: ['tours'] }, 'sai'), {
      expectedSecret: DEV_REVALIDATE_SECRET,
      revalidateTag,
    });
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('body không phải JSON → 400', async () => {
    const revalidateTag = vi.fn();
    const res = await handleRevalidatePost(makeRequest('not-json{{{', DEV_REVALIDATE_SECRET), {
      expectedSecret: DEV_REVALIDATE_SECRET,
      revalidateTag,
    });
    expect(res.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('tag lạ → 400, body có rejected', async () => {
    const revalidateTag = vi.fn();
    const res = await handleRevalidatePost(
      makeRequest({ tags: ['users'] }, DEV_REVALIDATE_SECRET),
      {
        expectedSecret: DEV_REVALIDATE_SECRET,
        revalidateTag,
      },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.rejected).toEqual(['users']);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('hợp lệ 2 tag → 200 {revalidated: 2}, revalidateTag gọi đúng 2 lần đúng thứ tự', async () => {
    const revalidateTag = vi.fn();
    const res = await handleRevalidatePost(
      makeRequest({ tags: ['tours', 'post:ha-noi'] }, DEV_REVALIDATE_SECRET),
      { expectedSecret: DEV_REVALIDATE_SECRET, revalidateTag },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ revalidated: 2 });
    expect(revalidateTag).toHaveBeenNthCalledWith(1, 'tours');
    expect(revalidateTag).toHaveBeenNthCalledWith(2, 'post:ha-noi');
    expect(revalidateTag).toHaveBeenCalledTimes(2);
  });

  it('mọi response (200 lẫn 401) mang Cache-Control no-store + X-Robots-Tag noindex (W3-H4)', async () => {
    const revalidateTag = vi.fn();
    const ok = await handleRevalidatePost(makeRequest({ tags: ['tours'] }, DEV_REVALIDATE_SECRET), {
      expectedSecret: DEV_REVALIDATE_SECRET,
      revalidateTag,
    });
    const denied = await handleRevalidatePost(makeRequest({ tags: ['tours'] }), {
      expectedSecret: DEV_REVALIDATE_SECRET,
      revalidateTag,
    });
    for (const res of [ok, denied]) {
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('x-robots-tag')).toBe('noindex');
    }
  });
});

// W4 R4 (ADR-0016 AMEND 3, nợ W3): bộ đếm in-memory theo INSTANCE — lớp
// "giảm nhiễu" chống vòng lặp lỗi/lạm dụng thô, không phải rate-limit thật
// (serverless nhân trần theo instance — nói thẳng, không giả vờ hơn).
describe('RevalidateBudget (W4 R4)', () => {
  const T0 = 1_757_000_000_000;

  it('30 call trong một phút qua, call 31 bị chặn kèm số giây Retry-After', () => {
    const budget = new RevalidateBudget();
    for (let i = 0; i < REVALIDATE_BUDGET_LIMIT; i++) {
      expect(budget.consume(T0 + i * 1000)).toBeNull();
    }
    const retryAfter = budget.consume(T0 + 30_000);
    expect(retryAfter).not.toBeNull();
    // Cửa sổ mở tại T0, đã trôi 30s → còn 30s.
    expect(retryAfter).toBe(30);
  });

  it('Retry-After tối thiểu 1 giây — không bao giờ trả 0 mời retry ngay lập tức', () => {
    const budget = new RevalidateBudget();
    for (let i = 0; i < REVALIDATE_BUDGET_LIMIT; i++) budget.consume(T0);
    expect(budget.consume(T0 + 59_900)).toBe(1);
  });

  it('sang cửa sổ mới thì quota tự hồi', () => {
    const budget = new RevalidateBudget();
    for (let i = 0; i <= REVALIDATE_BUDGET_LIMIT; i++) budget.consume(T0);
    expect(budget.consume(T0 + 60_001)).toBeNull();
  });
});

describe('handleRevalidatePost — budget 429 (W4 R4)', () => {
  it('hết quota → 429 + Retry-After, revalidateTag KHÔNG được gọi', async () => {
    const revalidateTag = vi.fn();
    const budget = new RevalidateBudget();
    const deps = { expectedSecret: DEV_REVALIDATE_SECRET, revalidateTag, budget };
    for (let i = 0; i < REVALIDATE_BUDGET_LIMIT; i++) {
      const ok = await handleRevalidatePost(
        makeRequest({ tags: ['tours'] }, DEV_REVALIDATE_SECRET),
        deps,
      );
      expect(ok.status).toBe(200);
    }
    const res = await handleRevalidatePost(
      makeRequest({ tags: ['tours'] }, DEV_REVALIDATE_SECRET),
      deps,
    );
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expect(revalidateTag).toHaveBeenCalledTimes(REVALIDATE_BUDGET_LIMIT);
  });

  it('call KHÔNG có secret không ăn quota — kẻ lạ không đốt được budget của API thật', async () => {
    const revalidateTag = vi.fn();
    const budget = new RevalidateBudget();
    const deps = { expectedSecret: DEV_REVALIDATE_SECRET, revalidateTag, budget };
    for (let i = 0; i < REVALIDATE_BUDGET_LIMIT + 10; i++) {
      expect((await handleRevalidatePost(makeRequest({ tags: ['tours'] }), deps)).status).toBe(401);
    }
    // Quota còn nguyên cho lời gọi hợp lệ.
    expect(
      (await handleRevalidatePost(makeRequest({ tags: ['tours'] }, DEV_REVALIDATE_SECRET), deps))
        .status,
    ).toBe(200);
  });
});
