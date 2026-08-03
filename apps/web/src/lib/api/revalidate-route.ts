import { timingSafeEqual } from 'node:crypto';

/**
 * Lõi thuần của route POST /api/revalidate (spec 03/08 §2, ADR-0016 §3 khối
 * "Chốt 2026-08-03"). Tách khỏi route.ts để test được ở project node —
 * vitest của web không include src/app/**. Whitelist PHẢI gương đúng
 * taxonomy lib/api/tags.ts: 'posts' | 'tours' | post:<slug> | tour:<slug>.
 */
const TAG_RE = /^(posts|tours|post:[a-z0-9-]{1,100}|tour:[a-z0-9-]{1,100})$/;

/** Trần tag mỗi call — đủ cho mọi kịch bản thật (moderate bust 2 tag). */
export const MAX_TAGS = 20;

/** Cùng chuỗi với DEV_REVALIDATE_SECRET phía API — hai bên phải khớp. */
export const DEV_REVALIDATE_SECRET = 'dev-revalidate-secret-change-me';

type ParseOk = { ok: true; tags: string[] };
type ParseErr = { ok: false; error: string; rejected?: string[] };

export function parseRevalidateBody(raw: unknown): ParseOk | ParseErr {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as { tags?: unknown }).tags)) {
    return { ok: false, error: 'body must be { tags: string[] }' };
  }
  const list = (raw as { tags: unknown[] }).tags;
  if (list.length === 0) return { ok: false, error: 'tags must not be empty' };
  if (list.length > MAX_TAGS) return { ok: false, error: `tags exceeds max ${MAX_TAGS}` };
  const rejected = list.filter((t) => typeof t !== 'string' || !TAG_RE.test(t));
  if (rejected.length > 0) {
    return { ok: false, error: 'unknown tags', rejected: rejected.map(String) };
  }
  // Dedupe — bust một tag hai lần là vô nghĩa, đếm revalidated cũng gọn.
  return { ok: true, tags: [...new Set(list as string[])] };
}

export function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Vẫn đi qua một lần so sánh để nhánh lệch-độ-dài không nhanh hơn hẳn.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function handleRevalidatePost(
  request: Request,
  deps: { expectedSecret: string; revalidateTag: (tag: string) => void },
): Promise<Response> {
  if (!secretMatches(request.headers.get('x-revalidate-secret'), deps.expectedSecret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = parseRevalidateBody(raw);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error, rejected: parsed.rejected ?? [] }, { status: 400 });
  }
  for (const tag of parsed.tags) deps.revalidateTag(tag);
  return Response.json({ revalidated: parsed.tags.length });
}
