# Plan — On-demand revalidation: API bust cache-tag của web

> **For agentic workers:** REQUIRED SUB-SKILL: dùng
> `superpowers:subagent-driven-development` (khuyến nghị) hoặc
> `superpowers:executing-plans`. Step dùng checkbox (`- [ ]`).

**Goal:** Duyệt review là trang tour tươi NGAY (không đợi hết cửa sổ ISR
300s) — theo [spec](../specs/2026-08-03-on-demand-revalidation-design.md)
(Approved 03/08; cơ chế chốt trong ADR-0016 §3 khối "Chốt 2026-08-03").

**Architecture:** web thêm route handler `POST /api/revalidate` (secret
constant-time + whitelist tag, lõi là hàm thuần test được ở project node);
API thêm `WebRevalidationService` fire-and-forget (3s timeout, lỗi chỉ warn)
móc vào `reviews.moderate` SAU khi transaction commit. ISR 300s vẫn là lưới
đúng đắn — đường này chết thì site chỉ kém tươi, không kém đúng.

**Tech Stack:** như hiện trạng — không dep mới. Web: Next 16 route handler +
`next/cache`. API: `fetch` toàn cục Node + env singleton `config/env.ts`.

## Global Constraints (áp cho MỌI task)

- **Branch `feat/on-demand-revalidation`** từ `main`. Conventional Commits.
  ⚠️ SAU MỖI COMMIT chạy `git log -1 --format='%B'`; NẾU output chứa
  "Co-Authored-By" THÌ `git commit --amend` message sạch rồi kiểm lại; NẾU
  không thì xong (lệnh một chiều).
- Comment/JSDoc **tiếng Việt**; identifier tiếng Anh; import không đuôi ở
  web, CÓ đuôi `.js` ở API (nếp ESM sẵn có — nhìn file cạnh bên).
- TDD hàm thuần trước (skill `superpowers:test-driven-development`); KHÔNG
  đụng contract/migrations; KHÔNG thêm `loading.tsx`; KHÔNG đổi visual.
- Trước khi khai xong cụm: `pnpm gate:int` (không phải `pnpm gate` trần).
- Cổng 3000/3001 sạch trước build/dev; kill đúng PID mình mở.

---

### Task 1: Web — lõi thuần + route `POST /api/revalidate`

**Files:**
- Create: `apps/web/src/lib/api/revalidate-route.ts`
- Create: `apps/web/src/lib/api/revalidate-route.spec.ts` (project node —
  glob `src/lib/**/*.spec.ts` đã cover, KHÔNG sửa vitest.config)
- Create: `apps/web/src/app/api/revalidate/route.ts` (vỏ mỏng)
- Modify: `apps/web/.env.example` (thêm `REVALIDATE_SECRET=`)

**Interfaces (Produces):**
- `parseRevalidateBody(raw: unknown): { ok: true; tags: string[] } | { ok: false; error: string; rejected?: string[] }`
- `secretMatches(provided: string | null, expected: string): boolean`
- `handleRevalidatePost(request: Request, deps: { expectedSecret: string; revalidateTag: (tag: string) => void }): Promise<Response>`
- `DEV_REVALIDATE_SECRET = 'dev-revalidate-secret-change-me'` (export — Task 2
  dùng CÙNG chuỗi phía API; hai bên phải bằng nhau từng ký tự)

- [ ] **Step 1 (RED):** viết `revalidate-route.spec.ts` phủ:
  - `parseRevalidateBody`: hợp lệ `{tags:['tours']}` / `['posts','post:ha-noi']`;
    dedupe (`['tours','tours']` → 1 tag); rỗng → error; >20 tag → error;
    không phải mảng / phần tử không phải string → error; tag lạ
    (`'users'`, `'tour:UPPER'`, `'tour:'`, slug >100 ký tự) → `rejected` kể tên.
  - `secretMatches`: đúng → true; sai cùng độ dài → false; lệch độ dài →
    false (không throw); `null` → false.
  - `handleRevalidatePost` (Request thật, `revalidateTag` là `vi.fn()`):
    thiếu/sai header `x-revalidate-secret` → 401, `revalidateTag` KHÔNG được
    gọi; body không phải JSON → 400; tag lạ → 400 body có `rejected`;
    hợp lệ 2 tag → 200 `{revalidated: 2}`, `revalidateTag` gọi đúng 2 lần
    đúng thứ tự.

```typescript
// trích khung test — điền đủ các case trên
import { describe, expect, it, vi } from 'vitest';
import {
  DEV_REVALIDATE_SECRET,
  handleRevalidatePost,
  parseRevalidateBody,
  secretMatches,
} from './revalidate-route';

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

it('401 khi sai secret — không bust gì', async () => {
  const revalidateTag = vi.fn();
  const res = await handleRevalidatePost(makeRequest({ tags: ['tours'] }, 'sai'), {
    expectedSecret: DEV_REVALIDATE_SECRET,
    revalidateTag,
  });
  expect(res.status).toBe(401);
  expect(revalidateTag).not.toHaveBeenCalled();
});
```

- [ ] **Step 2:** chạy RED: `pnpm turbo run test --filter=@tourism/web -- run src/lib/api/revalidate-route.spec.ts` → FAIL (module chưa tồn tại).
- [ ] **Step 3 (GREEN):** viết `revalidate-route.ts`:

```typescript
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
```

- [ ] **Step 4:** viết vỏ `apps/web/src/app/api/revalidate/route.ts`:

```typescript
import { revalidateTag } from 'next/cache';
import { DEV_REVALIDATE_SECRET, handleRevalidatePost } from '@/lib/api/revalidate-route';

/**
 * Bề mặt on-demand revalidation (ADR-0016 §3) — chỉ API NestJS gọi (server-
 * to-server, secret header), browser không bao giờ đụng. Chỉ export POST:
 * method khác Next tự trả 405. Route handler không vào sitemap.
 * `|| default`: chuỗi rỗng = "không khai" (gotcha CLAUDE.md §env).
 */
export async function POST(request: Request): Promise<Response> {
  return handleRevalidatePost(request, {
    expectedSecret: process.env.REVALIDATE_SECRET || DEV_REVALIDATE_SECRET,
    revalidateTag,
  });
}
```

- [ ] **Step 5:** `.env.example` web thêm (cạnh các biến sẵn có, comment
  tiếng Việt ngắn: secret route /api/revalidate, prod đặt thật):
  `REVALIDATE_SECRET=`
- [ ] **Step 6:** chạy GREEN cả file spec; rồi `pnpm turbo run typecheck --filter=@tourism/web` + biome. Commit:
  `feat(web): route POST /api/revalidate — secret constant-time + whitelist tag`

---

### Task 2: API — env + `WebRevalidationService` + hàm quyết định thuần

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Create: `apps/api/src/modules/web-revalidation/revalidation-decision.ts` + `revalidation-decision.spec.ts`
- Create: `apps/api/src/modules/web-revalidation/web-revalidation.service.ts` + `web-revalidation.service.spec.ts`
- Create: `apps/api/src/modules/web-revalidation/web-revalidation.module.ts`
- Modify: `apps/api/.env.example` (thêm `REVALIDATE_SECRET=`)

**Interfaces:**
- Consumes: `env` singleton (`config/env.js`) — `FRONTEND_URL` sẵn có
  (AMENDED spec §4: KHÔNG thêm `WEB_URL`).
- Produces:
  - `moderationRevalidationTags(args: { tourSlug: string | null; fromApproved: boolean; toApproved: boolean }): string[] | null`
  - `WebRevalidationService.revalidate(tags: string[]): Promise<void>` —
    KHÔNG BAO GIỜ throw/reject.
  - `WebRevalidationModule` exports service (Task 3 import).

- [ ] **Step 1 (RED):** `revalidation-decision.spec.ts`: không slug → null;
  approve giữ nguyên trạng thái (`true→true`, `false→false`) → null;
  `false→true` và `true→false` (có slug `vung-tau-2n1d`) →
  `['tours', 'tour:vung-tau-2n1d']`.
- [ ] **Step 2 (GREEN):**

```typescript
/**
 * Quyết định bust cache web sau moderate (spec 03/08 §3): chỉ khi review
 * GẮN tour và isApproved THỰC SỰ đổi — hai chiều (duyệt lần đầu, bỏ duyệt)
 * đều đổi bề mặt public (khu reviews + ratingAvg trên card/list/detail).
 * Hàm thuần, tách khỏi service để TDD (luật 4).
 */
export function moderationRevalidationTags(args: {
  tourSlug: string | null;
  fromApproved: boolean;
  toApproved: boolean;
}): string[] | null {
  if (!args.tourSlug) return null;
  if (args.fromApproved === args.toApproved) return null;
  return ['tours', `tour:${args.tourSlug}`];
}
```

- [ ] **Step 3:** `env.ts` — cạnh `DEV_UNSUBSCRIBE_SECRET` thêm const +
  comment tiếng Việt (secret route /api/revalidate của web; cùng chuỗi
  default với phía web để dev chạy liền):

```typescript
const DEV_REVALIDATE_SECRET = 'dev-revalidate-secret-change-me';
```

  Trong `EnvSchema` (cạnh `NEWSLETTER_UNSUBSCRIBE_SECRET`, ghi chú: đích web
  dùng lại `FRONTEND_URL` — không thêm WEB_URL):

```typescript
    REVALIDATE_SECRET: z.string().min(1).default(DEV_REVALIDATE_SECRET),
```

  Trong `superRefine`, sau khối `NEWSLETTER_UNSUBSCRIBE_SECRET` (cùng khuôn):

```typescript
    if (cfg.REVALIDATE_SECRET === DEV_REVALIDATE_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['REVALIDATE_SECRET'],
        message: 'REVALIDATE_SECRET must be set explicitly in production',
      });
    }
```

- [ ] **Step 4 (RED):** `web-revalidation.service.spec.ts` — stub `fetch`
  (`vi.stubGlobal('fetch', vi.fn())`): (a) happy: gọi đúng URL
  `${FRONTEND_URL}/api/revalidate`, method POST, header secret + content-type,
  body `{tags}`; (b) non-200 → resolve bình thường (không throw), có
  `logger.warn`; (c) fetch reject (network) → không throw; (d) timeout: kiểm
  `signal` là AbortSignal (không cần đo 3s thật). Spy warn:
  `vi.spyOn(Logger.prototype, 'warn')` hoặc spy instance logger — nhìn nếp
  spec unit sẵn có trong `apps/api` trước, dùng cùng cách.
- [ ] **Step 5 (GREEN):**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env.js';

/**
 * Bắn tín hiệu bust cache-tag sang web (ADR-0016 §3 "Chốt 2026-08-03").
 * Fire-and-forget ĐÚNG NGHĨA: mọi lỗi (non-200, network, timeout 3s) chỉ
 * warn — ISR 300s là lưới đúng đắn, đường này chết thì site chỉ KÉM TƯƠI
 * chứ không kém đúng; nghiệp vụ gốc (moderate) không được phép fail theo.
 * Call-site gọi `void service.revalidate(...)` SAU khi transaction commit
 * (bust trước commit = web regenerate đọc data cũ rồi cache lại 300s).
 */
@Injectable()
export class WebRevalidationService {
  private readonly logger = new Logger(WebRevalidationService.name);

  async revalidate(tags: string[]): Promise<void> {
    const url = `${env.FRONTEND_URL.replace(/\/+$/, '')}/api/revalidate`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': env.REVALIDATE_SECRET,
        },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        this.logger.warn(`bust [${tags.join(', ')}] -> HTTP ${res.status} tu web`);
      }
    } catch (err) {
      this.logger.warn(`bust [${tags.join(', ')}] that bai: ${(err as Error).message}`);
    }
  }
}
```

  Module (nhìn khuôn module nhỏ sẵn có, ví dụ `newsletter.module.ts`):

```typescript
import { Module } from '@nestjs/common';
import { WebRevalidationService } from './web-revalidation.service.js';

@Module({
  providers: [WebRevalidationService],
  exports: [WebRevalidationService],
})
export class WebRevalidationModule {}
```

- [ ] **Step 6:** `.env.example` API thêm `REVALIDATE_SECRET=` (comment ngắn).
  GREEN toàn bộ; `pnpm turbo run typecheck --filter=@tourism/api` + biome.
  Commit: `feat(api): WebRevalidationService fire-and-forget + env REVALIDATE_SECRET`

---

### Task 3: Móc vào `reviews.moderate` sau commit + int test

**Files:**
- Modify: `apps/api/src/modules/reviews/reviews.service.ts` (hàm `moderate`)
- Modify: `apps/api/src/modules/reviews/reviews.module.ts`
- Modify: `apps/api/src/modules/reviews/reviews.int.spec.ts` (thêm describe)

**Interfaces:**
- Consumes: `WebRevalidationModule`/`WebRevalidationService` +
  `moderationRevalidationTags` (Task 2 — chữ ký ở đó).
- Ràng buộc CỨNG: KHÔNG đổi hành vi/chữ ký public của `moderate` (vẫn trả
  `Promise<AdminReview>`); KHÔNG gọi service TRONG transaction.

- [ ] **Step 1:** `reviews.module.ts` thêm `imports: [WebRevalidationModule]`;
  constructor `ReviewsService` nhận `private readonly webRevalidation: WebRevalidationService`.
- [ ] **Step 2:** tái cấu trúc ĐUÔI `moderate()` — hiện là
  `return prisma.$transaction(async (tx) => { …; return toAdminReview(fresh); });`
  Đổi thành (giữ nguyên TOÀN BỘ thân transaction ①–④, chỉ thêm biến bắt +
  3 dòng sau commit; comment tiếng Việt giải thích vì-sao-sau-commit):

```typescript
    // Bắt fromApproved từ trong closure — cần cho quyết định bust SAU commit.
    let fromApprovedForRevalidate = false;
    const result = await prisma.$transaction(async (tx) => {
      // … thân transaction giữ NGUYÊN VĂN, chỉ thêm một dòng ngay sau khi
      // tính fromApproved:
      //   fromApprovedForRevalidate = fromApproved;
      // … phần còn lại ①②③④ + return toAdminReview(fresh) không đổi.
    });

    // Bust cache web SAU khi transaction đã commit (spec 03/08 §3): bust
    // trước commit là race — web regenerate đọc data cũ rồi cache 300s.
    // `void`: fire-and-forget, moderate không đợi và không fail theo.
    const tags = moderationRevalidationTags({
      tourSlug: result.tourSlug,
      fromApproved: fromApprovedForRevalidate,
      toApproved: input.approve,
    });
    if (tags) void this.webRevalidation.revalidate(tags);
    return result;
```

- [ ] **Step 3 (RED):** int test (nếp bootstrap sẵn có của
  `reviews.int.spec.ts`; spy `vi.spyOn(webRevalidationService, 'revalidate').mockResolvedValue(undefined)`
  — lấy instance qua `moduleRef.get(WebRevalidationService)`):
  1. approve review PENDING gắn tour → spy gọi ĐÚNG 1 lần với
     `['tours', 'tour:<slug thật của fixture>']`;
  2. moderate lại CÙNG trạng thái (approve lần 2 khi vẫn approved) → spy
     KHÔNG được gọi thêm;
  3. un-approve (`approve: false` trên review đang approved) → spy gọi lại
     đúng tags;
  4. review KHÔNG gắn tour (tourId null) → spy không gọi.
  Chạy: `pnpm test:int -- reviews` (đúng cú pháp filter mà repo đang dùng —
  xem script trong package.json trước, `vitest run -- <file>` KHÔNG filter,
  gotcha đã ghi).
- [ ] **Step 4 (GREEN):** chạy lại int → pass; unit + typecheck + biome toàn
  workspace: `pnpm gate`. Commit:
  `feat(api): moderate bust cache web sau commit — chi khi doi trang thai + co tour`

---

### Task 4: Nghiệm thu sống (spec §7) + gate:int + chốt

- [ ] **Step 1:** API + DB sống; web **production build** (`rm -rf apps/web/.next`
  trước; cổng sạch). Đo và DÁN NGUYÊN VĂN đủ 5 mục spec §7:
  1. Lấy 1 review chưa duyệt gắn tour (SQL trực tiếp nếu cần:
     `UPDATE reviews SET is_approved=false, ... WHERE id=...` trên một review
     CURATED của tour ít review — hoặc INSERT một review PENDING mới bằng SQL
     theo shape fixture). `curl trang tour` ghi lại ratingAvg/khu reviews
     TRƯỚC → moderate approve qua endpoint admin thật (đăng nhập admin lấy
     cookie — nếp nghiệm thu P3a có sẵn trong CHANGELOG/int spec; nếu vướng
     auth flow quá 15′ thì DỪNG hỏi controller) → curl LẠI thấy đổi NGAY.
  2. Tắt web, moderate tiếp → API 200 bình thường + log warn; bật lại.
  3. Curl route 3 ca: sai secret 401 · tag lạ 400 kèm tên · hợp lệ 200
     `{revalidated:1}`.
  4. `GET /api/revalidate` → 405; `curl -s localhost:3000/sitemap.xml | grep revalidate` → rỗng.
  5. `pnpm gate:int` xanh TRỌN (build web trong gate cần API sống — nếp sẵn).
- [ ] **Step 2:** kill đúng PID, cổng sạch, revert mọi mồi SQL nghiệm thu
  (trả review về trạng thái cũ nếu đã mượn CURATED). Commit chốt nếu có sửa
  vụn: `test(api): nghiem thu on-demand revalidation`. DỪNG — final review →
  user quyết merge → docs sweep luật 13 (CHANGELOG entry mới nhớ luật dấu
  `+`; cập nhật ADR-0016 khối NỢ QUÁ HẠN → ĐÃ TRẢ + hàng README).
