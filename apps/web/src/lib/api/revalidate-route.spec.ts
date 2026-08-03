import { describe, expect, it, vi } from 'vitest';
import {
  DEV_REVALIDATE_SECRET,
  handleRevalidatePost,
  parseRevalidateBody,
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
});
