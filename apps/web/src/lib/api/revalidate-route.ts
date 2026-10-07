import { timingSafeEqual } from 'node:crypto';
import { POST_SLUG_MAX, TOUR_SLUG_MAX } from '@tourism/contract';

/**
 * Lõi thuần của route POST /api/revalidate (spec 03/08 §2, ADR-0016 §3 khối
 * "Chốt 2026-08-03"). Tách khỏi route.ts để test được ở project node —
 * vitest của web không include src/app/**. Whitelist PHẢI gương đúng
 * taxonomy lib/api/tags.ts: 'posts' | 'tours' | 'site-media' | post:<slug>
 * | tour:<slug> ('site-media' bổ sung W3-O5 — whitelist từng lệch taxonomy).
 * Gương taxonomy KHÔNG có nghĩa API đã bust đủ: `site-media` chưa có producer
 * phía API (CÒN TREO ở CHANGELOG W3 merge).
 *
 * Trần độ dài slug lấy từ hằng của contract (gương cột DB), không ghi tay: bản
 * `{1,100}` cũ lệch `TOUR_SLUG_MAX` = 120, và một tour slug 101–120 ký tự làm
 * route từ chối NGUYÊN lệnh, kể cả `tours` (review A1-2).
 */
const TAG_RE = new RegExp(
  `^(posts|tours|site-media|post:[a-z0-9-]{1,${POST_SLUG_MAX}}|tour:[a-z0-9-]{1,${TOUR_SLUG_MAX}})$`,
);

/**
 * Trần tag mỗi call. API chia lô theo `REVALIDATE_TAGS_PER_CALL` (gương con số
 * này, `apps/api/src/modules/web-revalidation/web-revalidation.service.ts`) vì
 * sửa một điểm đến bust `tours` cộng trang của MỌI tour gắn nó — có thể quá 20.
 * Đổi một bên thì phải đổi bên kia.
 */
export const MAX_TAGS = 20;

/** Cùng chuỗi với DEV_REVALIDATE_SECRET phía API — hai bên phải khớp. */
export const DEV_REVALIDATE_SECRET = 'dev-revalidate-secret-change-me';

/**
 * Secret của route theo môi trường (W3-O5, ADR-0016 AMEND 1 §3 — gương
 * fail-fast của env.ts API): production thiếu/rỗng là lỗi cấu hình phải NỔ,
 * không được âm thầm sống bằng secret dev hard-code (audit cụm 5, mức Cao —
 * ai biết chuỗi này là hard-bust được toàn site). Chuỗi rỗng là "không khai".
 *
 * Production đặt ĐÚNG chuỗi dev cũng là "chưa cấu hình", cùng nhánh ném (Ruling F-d): chuỗi ấy
 * nằm công khai trong `.env.example`, chép nguyên file ra production là ai cũng bust được cache.
 * Từ chối thì không làm gãy gì: API production không khởi động được với chuỗi này (`env.ts`),
 * nên web production mang nó vốn đã không khớp API nào.
 */
export function resolveRevalidateSecret(env: {
  REVALIDATE_SECRET?: string;
  NODE_ENV?: string;
}): string {
  const secret = env.REVALIDATE_SECRET;
  if (env.NODE_ENV === 'production' && (!secret || secret === DEV_REVALIDATE_SECRET)) {
    throw new Error(
      'REVALIDATE_SECRET is missing or still the public dev value in production — /api/revalidate refuses every request',
    );
  }
  return secret || DEV_REVALIDATE_SECRET;
}

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

/**
 * Header gắn lên MỌI response của route (W3-H4, ADR-0016 AMEND 1 §3): route
 * server-to-server không có gì để cache/index — header rẻ, cắt luôn.
 */
const ROUTE_HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } as const;

/** Trần bust mỗi phút MỖI INSTANCE (W4 R4) — moderate thật bust 2 tag/lượt,
 * 30 call/phút là ~15 phán quyết/phút, quá mức tay người. */
export const REVALIDATE_BUDGET_LIMIT = 30;

/**
 * Bộ đếm in-memory theo INSTANCE (W4 R4 — nợ W3, ADR-0016 AMEND 3): route
 * có secret nhưng không trần — ai cầm secret (hoặc một bug phía API gọi
 * lặp) bust được cache toàn site liên tục, mỗi lượt là một cơn regenerate
 * ISR đổ vào API Render free.
 *
 * Nói thẳng giới hạn: web chạy serverless nên trần thật là 30 × số instance
 * đang ấm — đây là lớp GIẢM NHIỄU chống vòng lặp lỗi, KHÔNG phải rate-limit
 * thật (thứ đó cần store chung, chưa cần cho một route server-to-server có
 * secret). Cửa sổ cố định 60s, thuần để test không đợi đồng hồ thật.
 */
export class RevalidateBudget {
  private windowStart = 0;
  private used = 0;

  constructor(
    private readonly limit = REVALIDATE_BUDGET_LIMIT,
    private readonly windowMs = 60_000,
  ) {}

  /** Còn quota → đếm và trả null; hết → trả SỐ GIÂY Retry-After (≥1). */
  consume(now = Date.now()): number | null {
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now;
      this.used = 0;
    }
    if (this.used < this.limit) {
      this.used += 1;
      return null;
    }
    return Math.max(1, Math.ceil((this.windowStart + this.windowMs - now) / 1000));
  }
}

export async function handleRevalidatePost(
  request: Request,
  deps: {
    expectedSecret: string;
    revalidateTag: (tag: string) => void;
    /** W4 R4 — route.ts truyền singleton cấp module; test truyền bản riêng. */
    budget?: RevalidateBudget;
  },
): Promise<Response> {
  if (!secretMatches(request.headers.get('x-revalidate-secret'), deps.expectedSecret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: ROUTE_HEADERS });
  }
  // Đếm SAU bước secret: call không secret là 401 rẻ — đếm nó là cho kẻ lạ
  // đốt quota của chính API thật (tự tay biến trần thành cửa DoS).
  const retryAfter = deps.budget?.consume();
  if (retryAfter != null) {
    return Response.json(
      { error: 'revalidate budget exhausted' },
      { status: 429, headers: { ...ROUTE_HEADERS, 'Retry-After': String(retryAfter) } },
    );
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400, headers: ROUTE_HEADERS });
  }
  const parsed = parseRevalidateBody(raw);
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error, rejected: parsed.rejected ?? [] },
      { status: 400, headers: ROUTE_HEADERS },
    );
  }
  for (const tag of parsed.tags) deps.revalidateTag(tag);
  return Response.json({ revalidated: parsed.tags.length }, { headers: ROUTE_HEADERS });
}

/**
 * Cửa vào của `route.ts`: đọc secret theo môi trường NGAY trong lượt xử lý request rồi giao cho
 * `handleRevalidatePost` (Ruling F-d). Không đọc ở cấp module: cấu hình sai chỉ làm route từ chối
 * mọi request, web production vẫn lên.
 *
 * Từ chối bằng cách NÉM, như nhánh thiếu secret xưa nay: Next ghi lỗi ném ra từ route handler
 * bằng `console.error` một lần mỗi request (`onRequestError` của route module) rồi trả 500, nên
 * lý do đã nằm trong log — ghi thêm ở đây là mỗi request hai dòng cùng một chuyện.
 */
export async function handleRevalidateRequest(
  request: Request,
  deps: {
    env: { REVALIDATE_SECRET?: string; NODE_ENV?: string };
    revalidateTag: (tag: string) => void;
    budget?: RevalidateBudget;
  },
): Promise<Response> {
  return handleRevalidatePost(request, {
    expectedSecret: resolveRevalidateSecret(deps.env),
    revalidateTag: deps.revalidateTag,
    budget: deps.budget,
  });
}
