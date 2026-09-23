# Plan thi công F16 — Giai đoạn của chuyến khởi hành

> **Cho agent thi công:** làm tuần tự từng task bằng skill
> `superpowers:executing-plans`. Bước dùng checkbox `- [ ]`. Prompt bàn giao ở
> cuối file KHÔNG cho dùng subagent.

**Mục tiêu:** màn Departures của admin in đúng giai đoạn của chuyến (On sale ·
Deadline passed · Closed · Departed · Completed · Cancelled), tự đổi theo ngày,
lọc theo nhóm giai đoạn, và báo khi tour chưa đăng.

**Kiến trúc:** một hàm thuần `departurePhase` ở `@tourism/contract` là nơi DUY
NHẤT giữ luật. API tính `phase` cho từng hàng và lọc bằng chính hàm ấy; admin
chỉ in ra. Không migration, không job, không đổi cổng tiền.

**Stack:** Zod 4 (contract) · NestJS 11 + Prisma 7 (api) · Next.js 16 + React +
TanStack Table (admin) · Vitest.

**Spec:** [2026-09-23-departure-phase-design.md](../specs/2026-09-23-departure-phase-design.md)
— HỢP ĐỒNG của việc này; plan chỉ nói cách làm.
**ADR:** [0046 — giai đoạn chuyến suy từ ngày](../adr/0046-departure-phase-derived.md)

| Tính năng | Nhánh | Task |
| --- | --- | --- |
| **F16** giai đoạn chuyến | `feat/departure-phase` | 1–6 |

## Ràng buộc toàn cục

Áp cho **mọi** task, không nhắc lại ở từng chỗ:

- **TDD** (luật 4): viết test trước, chạy cho ĐỎ đúng lý do, rồi mới cài.
- **Comment code tiếng Việt** (luật 8); **copy người dùng thấy bằng tiếng Anh**,
  nằm trong `@tourism/i18n` (luật 7). **Tokens-only**, không hex (luật 6).
- **Commit Conventional, tiếng Việt CÓ DẤU, không AI attribution** — không dòng
  `Co-Authored-By` (luật 12). Stage theo **đường dẫn tường minh**, không
  `git add -A`. Chạy `pnpm lint:fix` trước khi stage.
- **Không đụng**: `apps/api/src/modules/bookings/bookings.service.ts` (cổng tạo
  booking và câu SQL claim), `apps/api/src/modules/catalog/catalog.service.ts`,
  `apps/web`, `apps/mobile`, `apps/api/prisma/`. Diff chạm vào chúng là lý do
  trả review (spec §4 mục 7).
- **Không hạ tầng sống** (luật 15). F16 không cần gì từ hạ tầng.
- **Tên cố định:** giai đoạn `on-sale` · `deadline-passed` · `closed` ·
  `departed` · `completed` · `cancelled`; nhóm lọc `upcoming` · `departed` ·
  `completed` · `cancelled`; tham số URL `?phase=`.
- **Contract và i18n được đọc từ `dist`**: sửa hai gói ấy xong phải build lại
  trước khi test api/admin thấy thay đổi —
  `pnpm turbo run build --filter=@tourism/contract --filter=@tourism/i18n --output-logs=errors-only`.
- **Tài liệu `.md`:** không để dòng bắt đầu bằng `+` ở cột 0; `git diff` file
  `.md` trước khi stage; không sửa entry CHANGELOG cũ.

### Quy trình gate (luật 11) — dùng ở cuối MỖI task

`pnpm gate:int` trần chạy song song 10 luồng và từng làm máy phình RAM, nên chạy
tách bước, hãm song song. Build web prerender gọi API thật, nên phải có API sống.
Chạy từ gốc repo bằng **Git Bash**, Docker Postgres phải đang chạy:

```bash
# 1. API sống cho bước build web
pnpm turbo run build --filter=@tourism/api --output-logs=errors-only
(cd apps/api && node dist/main.js > /tmp/f16-api.log 2>&1 &)
for i in $(seq 1 30); do curl -sf http://localhost:3001/api/health > /dev/null && echo "API sống" && break; sleep 2; done

# 2. build + typecheck + unit test
NEXT_PUBLIC_API_URL=http://localhost:3001 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm turbo run build typecheck test --concurrency=2 --output-logs=errors-only

# 3. lint + luật tokens của mobile
pnpm lint && node scripts/check-mobile-tokens-only.mjs

# 4. integration test
pnpm test:int --concurrency=2
```

Tắt API sau khi xong (PowerShell) — chỉ giết đúng tiến trình đang nghe cổng 3001:

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Cả bốn bước xanh mới được khai task xong. Máy chậm bất thường thì dừng và báo.

## Bản đồ file

| File | Trách nhiệm | Task |
| --- | --- | --- |
| `libs/shared/contract/src/schemas/departure-phase.ts` | `departurePhase`, `DeparturePhaseSchema`, `DeparturePhaseFilterSchema`, `DEPARTURE_PHASE_FILTER_GROUPS` | 1 |
| `libs/shared/contract/src/schemas/admin-departures.ts` | Hàng mang `phase`, tour mang `isPublished`, query lọc `phase` | 2 |
| `apps/api/src/modules/catalog/admin-departures.service.ts` | Tính `phase`, lọc theo nhóm, trả `isPublished` | 2 |
| `apps/admin/src/test/departure-row.ts` | Helper fixture `withPhase` — chỗ DUY NHẤT của admin gọi `departurePhase` | 2 |
| `apps/admin/src/lib/departures-query.ts` | URL `?phase=` | 3 |
| `apps/admin/src/components/departures/departures-table.tsx` | Năm tab (Task 3), huy hiệu giai đoạn (Task 4) | 3, 4 |
| `apps/admin/src/lib/departures-view.ts` | Cờ VM theo giai đoạn, biến thể huy hiệu | 4 |
| `apps/admin/src/components/departures/departure-row-actions.tsx` | Ẩn nút đóng/mở, ô giữ chỗ | 4 |
| `apps/admin/src/components/departures/tour-unpublished-notice.tsx` | Dòng báo tour chưa đăng | 5 |
| `apps/admin/src/app/(admin)/tours/[slug]/departures/page.tsx` | Gắn dòng báo | 5 |
| `libs/shared/i18n/src/lib/messages.ts` | Copy tab (3), nhãn giai đoạn (4), dòng báo (5) | 3, 4, 5 |

---

> Mở nhánh: `git checkout -b feat/departure-phase` (từ `main` đã có commit docs
> F16).

## Task 1 — `departurePhase` (contract, hàm thuần)

**Files:**
- Create: `libs/shared/contract/src/schemas/departure-phase.ts`
- Create: `libs/shared/contract/src/schemas/departure-phase.spec.ts`
- Modify: `libs/shared/contract/src/index.ts`

**Interfaces — Produces:**
- `DeparturePhaseSchema`, `type DeparturePhase` =
  `'on-sale' | 'deadline-passed' | 'closed' | 'departed' | 'completed' | 'cancelled'`
- `departurePhase(input: { status: AdminDepartureStatus; startDate: string; endDate: string; now: Date }): DeparturePhase`
- `DeparturePhaseFilterSchema`, `type DeparturePhaseFilter` =
  `'upcoming' | 'departed' | 'completed' | 'cancelled'`
- `DEPARTURE_PHASE_FILTER_GROUPS: Readonly<Record<DeparturePhaseFilter, readonly DeparturePhase[]>>`

- [ ] **B1. Viết spec TRƯỚC** — `departure-phase.spec.ts` (contract bật
  `globals`, không import `describe`/`it`):

```ts
import {
  DEPARTURE_PHASE_FILTER_GROUPS,
  DeparturePhaseFilterSchema,
  DeparturePhaseSchema,
  departurePhase,
} from './departure-phase.js';

/**
 * Giai đoạn của chuyến (spec F16, ADR-0046) — hàm thuần duy nhất quyết định
 * nhãn vòng đời mà màn admin in ra và tab lọc gom theo.
 *
 * Bộ này canh ĐÚNG từng mốc biên: đảo thứ tự hai luật hay lệch một dấu so sánh
 * đều cho ra một bảng trông hợp lý mà sai đúng vào ngày người vận hành cần.
 * Nửa đêm Việt Nam là 17:00 UTC hôm trước.
 */

/** Chuyến 5 ngày 10/10 → 14/10: N = 7, hạn chót 03/10. */
const TRIP = { startDate: '2026-10-10', endDate: '2026-10-14' } as const;

describe('departurePhase — chuyến OPEN đi qua từng mốc', () => {
  it.each([
    ['2026-10-03T16:59:59.999Z', 'on-sale', '23:59 ngày hạn chót — vẫn còn bán'],
    ['2026-10-03T17:00:00.000Z', 'deadline-passed', '00:00 ngày sau hạn chót'],
    ['2026-10-09T16:59:59.999Z', 'deadline-passed', '23:59 hôm trước ngày đi'],
    ['2026-10-09T17:00:00.000Z', 'departed', '00:00 ngày đi — đã tính là đi'],
    ['2026-10-14T16:59:59.999Z', 'departed', '23:59 ngày về — vẫn đang đi'],
    ['2026-10-14T17:00:00.000Z', 'completed', '00:00 ngày sau ngày về'],
  ] as const)('%s → %s (%s)', (now, expected) => {
    // Giết: lật dấu luật 5 · `>` ở vế ngày đi · `>=` ở luật 2 · đảo luật 2 và 3.
    expect(departurePhase({ status: 'OPEN', ...TRIP, now: new Date(now) })).toBe(expected);
  });
});

describe('departurePhase — công tắc CLOSED chỉ thắng ở chuyến CHƯA đi', () => {
  it.each([
    ['2026-10-01T05:00:00.000Z', 'closed', 'còn hạn'],
    ['2026-10-05T05:00:00.000Z', 'closed', 'quá hạn chót — Closed thắng Deadline passed'],
    ['2026-10-10T05:00:00.000Z', 'departed', 'ngày đi — Departed thắng Closed'],
    ['2026-10-20T05:00:00.000Z', 'completed', 'đã về'],
  ] as const)('%s → %s (%s)', (now, expected) => {
    // Giết: bỏ luật 4 · đưa luật 4 lên trên luật 3 · đưa luật 4 xuống dưới luật 5.
    expect(departurePhase({ status: 'CLOSED', ...TRIP, now: new Date(now) })).toBe(expected);
  });
});

describe('departurePhase — CANCELLED thắng mọi ngày', () => {
  it.each([
    '2026-10-01T05:00:00.000Z',
    '2026-10-12T05:00:00.000Z',
    '2026-10-20T05:00:00.000Z',
  ])('%s → cancelled', (now) => {
    // Giết: bỏ luật 1 · đưa luật 1 xuống dưới luật 2 hoặc 3.
    expect(departurePhase({ status: 'CANCELLED', ...TRIP, now: new Date(now) })).toBe(
      'cancelled',
    );
  });
});

describe('departurePhase — chuyến MỘT ngày', () => {
  /** 10/10 → 10/10: N = 1, hạn chót 09/10. */
  const DAY_TRIP = { startDate: '2026-10-10', endDate: '2026-10-10' } as const;

  it.each([
    ['2026-10-09T05:00:00.000Z', 'on-sale'],
    ['2026-10-10T05:00:00.000Z', 'departed'],
    ['2026-10-11T05:00:00.000Z', 'completed'],
  ] as const)('%s → %s', (now, expected) => {
    expect(departurePhase({ status: 'OPEN', ...DAY_TRIP, now: new Date(now) })).toBe(expected);
  });
});

describe('departurePhase — đầu vào hỏng', () => {
  it('`now` là Invalid Date thì ném RangeError, không đoán bừa một giai đoạn', () => {
    expect(() =>
      departurePhase({ status: 'CANCELLED', ...TRIP, now: new Date('not a date') }),
    ).toThrow(RangeError);
  });
});

describe('DEPARTURE_PHASE_FILTER_GROUPS', () => {
  it('mỗi giai đoạn nằm trong ĐÚNG MỘT tab — không mồ côi, không trùng', () => {
    const placed = DeparturePhaseFilterSchema.options.flatMap(
      (filter) => DEPARTURE_PHASE_FILTER_GROUPS[filter],
    );

    expect([...placed].sort()).toEqual([...DeparturePhaseSchema.options].sort());
  });

  it('Upcoming gom đúng ba giai đoạn chưa đi — tập chuyến còn thao tác được', () => {
    expect(DEPARTURE_PHASE_FILTER_GROUPS.upcoming).toEqual([
      'on-sale',
      'deadline-passed',
      'closed',
    ]);
  });
});
```

  Ca Invalid Date cố ý dùng `CANCELLED`: nó ép hàm tính "hôm nay" TRƯỚC khi xét
  công tắc, để đầu vào hỏng luôn ném dù công tắc là gì.

- [ ] **B2. Chạy cho ĐỎ:**
  `pnpm --filter @tourism/contract exec vitest run src/schemas/departure-phase.spec.ts`
  — mong đợi: đỏ vì không resolve được `./departure-phase.js`.

- [ ] **B3. Cài** — `departure-phase.ts`:

```ts
import { z } from 'zod';
import type { AdminDepartureStatus } from './admin-departures.js';
import { isWithinDeadline, vietnamToday } from './refund-policy.js';

/**
 * Giai đoạn của một chuyến khởi hành (ADR-0046, spec F16) — SUY từ công tắc
 * bán hàng (`status`) và hai ngày của chuyến, KHÔNG lưu ở đâu cả.
 *
 * Cột `status` chỉ là ý muốn của người vận hành (bán, tạm ngừng, đã huỷ).
 * Chuyến đang ở đâu trong vòng đời thì ngày đi và ngày về đã nói sẵn; lưu thêm
 * một bản là thêm một nguồn sự thật phải canh cho khỏi lệch.
 *
 * Viết thường, nối gạch ngang — nếp của giá trị SUY RA
 * (`ReviewModerationStateSchema`, mã lý do `departure-closed` của claim), để
 * không ai nhầm với giá trị enum trong DB (viết hoa).
 */
export const DeparturePhaseSchema = z.enum([
  'on-sale',
  'deadline-passed',
  'closed',
  'departed',
  'completed',
  'cancelled',
]);
export type DeparturePhase = z.output<typeof DeparturePhaseSchema>;

/**
 * Tính giai đoạn theo lịch Việt Nam. Luật xét từ trên xuống, dòng khớp đầu
 * tiên thắng — THỨ TỰ là một phần của luật (spec F16 §2a):
 *
 *  1. công tắc `CANCELLED` → `cancelled` (đã huỷ thì ngày tháng hết nghĩa);
 *  2. hôm nay SAU ngày về → `completed`;
 *  3. hôm nay từ ngày đi trở đi → `departed` (luật 2 đã loại phần sau ngày về,
 *     nên ngày về vẫn là `departed`);
 *  4. công tắc `CLOSED` → `closed` (ý muốn admin thắng hạn chót, nhưng chỉ ở
 *     chuyến chưa đi vì luật 2–3 đứng trên);
 *  5. quá hạn chót → `deadline-passed` — CÙNG vị từ `isWithinDeadline` mà cổng
 *     tạo booking dùng, nên `on-sale` đúng nghĩa "khách còn đặt được";
 *  6. còn lại → `on-sale`.
 *
 * Ngày khởi hành đã là `departed`, khớp hai cổng huỷ (hôm nay < ngày đi). Cổng
 * claim vẫn nhận khoản trả trễ trong chính ngày ấy — cố ý (ADR-0046); đừng
 * sửa hàm này cho "khớp" cổng claim.
 *
 * Tham số là MỘT object: `startDate` và `endDate` cùng kiểu chuỗi, truyền theo
 * vị trí thì tráo nhau mà không ai biết.
 */
export function departurePhase(input: {
  status: AdminDepartureStatus;
  /** Ngày lịch Việt Nam `YYYY-MM-DD`. */
  startDate: string;
  /** Ngày lịch Việt Nam `YYYY-MM-DD`. */
  endDate: string;
  now: Date;
}): DeparturePhase {
  const { status, startDate, endDate, now } = input;
  // Tính TRƯỚC khi xét công tắc: `now` hỏng thì `vietnamToday` ném RangeError
  // với MỌI công tắc, thay vì lọt qua ở nhánh `CANCELLED`.
  const today = vietnamToday(now);

  if (status === 'CANCELLED') return 'cancelled';
  // So CHUỖI ISO: thứ tự từ điển của `YYYY-MM-DD` trùng thứ tự thời gian.
  if (today > endDate) return 'completed';
  if (today >= startDate) return 'departed';
  if (status === 'CLOSED') return 'closed';
  if (!isWithinDeadline(now, startDate, endDate)) return 'deadline-passed';
  return 'on-sale';
}

/**
 * Bốn tab lọc của màn chuyến (All = không lọc). `upcoming` gom ba giai đoạn
 * CHƯA ĐI — đúng tập chuyến admin còn thao tác được (đóng/mở, huỷ); huy hiệu
 * trên từng hàng nói chi tiết.
 */
export const DeparturePhaseFilterSchema = z.enum(['upcoming', 'departed', 'completed', 'cancelled']);
export type DeparturePhaseFilter = z.output<typeof DeparturePhaseFilterSchema>;

/** Nhóm lọc → các giai đoạn thuộc nhóm. Mỗi giai đoạn nằm ĐÚNG MỘT nhóm (có test). */
export const DEPARTURE_PHASE_FILTER_GROUPS: Readonly<
  Record<DeparturePhaseFilter, readonly DeparturePhase[]>
> = {
  upcoming: ['on-sale', 'deadline-passed', 'closed'],
  departed: ['departed'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};
```

  `import type` với `admin-departures.ts` là BẮT BUỘC: Task 2 cho file ấy
  import giá trị từ đây, và import giá trị hai chiều là vòng lặp module.

- [ ] **B4. Export** — `libs/shared/contract/src/index.ts`, chèn đúng thứ tự
  chữ cái, giữa `common.js` và `enquiries.js`:

```ts
export * from './schemas/departure-phase.js';
```

- [ ] **B5. Chạy cho XANH** — lệnh ở B2; mong đợi tất cả xanh.
- [ ] **B6. Thử đột biến** (sửa tạm, thấy đỏ, trả lại): bỏ luật 1 · đổi chỗ hai
  dòng `completed`/`departed` · `today > endDate` thành `>=` · `today >= startDate`
  thành `>` · đưa dòng `closed` lên trên dòng `departed` · bỏ dòng `closed` · bỏ
  dấu `!` ở luật 5 · đưa `vietnamToday` xuống sau dòng `cancelled`. Cả tám phải
  làm spec đỏ.
- [ ] **B7.** Quy trình gate.
- [ ] **B8. Commit:** `feat(contract): hàm departurePhase — giai đoạn chuyến suy từ ngày (F16)`

## Task 2 — Hàng mang `phase`, tour mang `isPublished`; API tính và lọc

**Files:**
- Modify: `libs/shared/contract/src/schemas/admin-departures.ts`
- Modify: `libs/shared/contract/src/schemas/admin-departures.spec.ts`
- Modify: `apps/api/src/modules/catalog/admin-departures.service.ts`
- Modify: `apps/api/src/modules/catalog/admin-departures.int.spec.ts`
- Create: `apps/admin/src/test/departure-row.ts`
- Modify (chỉ fixture): `apps/admin/src/lib/departures-view.spec.ts`,
  `apps/admin/src/components/departures/departure-row-actions.spec.tsx`,
  `apps/admin/src/components/departures/departure-form-dialog.spec.tsx`

**Interfaces:**
- Consumes: mọi thứ Task 1 produces.
- Produces: `AdminDepartureRow.phase: DeparturePhase` ·
  `AdminDepartureTour.isPublished: boolean` · `AdminDeparturesListQuery.phase?: DeparturePhaseFilter`
  (thay `status`) · `type DepartureRowFixture = Omit<AdminDepartureRow, 'phase'>`,
  `noonInVietnam(day: string): Date`,
  `withPhase(row: DepartureRowFixture, today: string): AdminDepartureRow`.

Task này đổi HÌNH DẠNG contract nên phải sửa luôn mọi fixture của admin, không
thì typecheck đỏ. Admin CHƯA dùng `phase` ở task này; tab ở admin tạm thời không
lọc được (API bỏ qua `status` cũ) cho tới Task 3 — chấp nhận được vì nhánh chưa
deploy.

- [ ] **B1. Test contract TRƯỚC** — trong `admin-departures.spec.ts`:
  - thêm `phase: 'on-sale',` vào `ROW`, ngay sau `status: 'OPEN',`;
  - thêm vào `describe('AdminDepartureRowSchema')`:

```ts
  it('mang GIAI ĐOẠN do server tính — thiếu hay sai giá trị đều trượt (F16)', () => {
    const { phase: _phase, ...khongPhase } = ROW;
    expect(AdminDepartureRowSchema.safeParse(khongPhase).success).toBe(false);
    // Giá trị công tắc KHÔNG phải giai đoạn: `OPEN` lọt vào đây là admin in
    // nhầm công tắc thành vòng đời — đúng lỗi F16 sinh ra để sửa.
    expect(AdminDepartureRowSchema.safeParse({ ...ROW, phase: 'OPEN' }).success).toBe(false);
  });
```

  - trong `describe('AdminDeparturesListQuerySchema')`, THAY ca
    `'lọc theo trạng thái nhận cả ba giá trị'` bằng:

```ts
  it('lọc theo NHÓM giai đoạn: nhận bốn nhóm, từ chối giá trị công tắc (F16)', () => {
    for (const phase of ['upcoming', 'departed', 'completed', 'cancelled']) {
      expect(AdminDeparturesListQuerySchema.safeParse({ slug: 'a-tour', phase }).success).toBe(
        true,
      );
    }
    expect(
      AdminDeparturesListQuerySchema.safeParse({ slug: 'a-tour', phase: 'OPEN' }).success,
    ).toBe(false);
    // Một giai đoạn lẻ không phải một nhóm lọc.
    expect(
      AdminDeparturesListQuerySchema.safeParse({ slug: 'a-tour', phase: 'on-sale' }).success,
    ).toBe(false);
  });

  it('key `status` cũ bị BỎ QUA chứ không ném — URL cũ rơi êm về All', () => {
    const parsed = AdminDeparturesListQuerySchema.parse({ slug: 'a-tour', status: 'OPEN' });

    expect(parsed).not.toHaveProperty('status');
    expect(parsed).not.toHaveProperty('phase');
  });
```

  - thêm `AdminDepartureTourSchema` vào khối import đầu file, và một describe
    mới ngay sau `describe('AdminDeparturesListQuerySchema')`:

```ts
describe('AdminDepartureTourSchema', () => {
  const TOUR = {
    id: '4f1b1f2e-0000-4000-8000-000000000009',
    slug: 'hoi-an-lantern-evening',
    title: 'Hoi An Lantern Evening',
    basePrice: '39.00',
    currency: 'USD',
  };

  it('BẮT BUỘC nói tour đang đăng hay không (F16 §2h)', () => {
    expect(AdminDepartureTourSchema.safeParse(TOUR).success).toBe(false);
    expect(AdminDepartureTourSchema.safeParse({ ...TOUR, isPublished: false }).success).toBe(true);
  });
});
```

- [ ] **B2. Chạy cho ĐỎ:**
  `pnpm --filter @tourism/contract exec vitest run src/schemas/admin-departures.spec.ts`
  — mong đợi: ba ca mới đỏ (schema chưa biết `phase`/`isPublished`).

- [ ] **B3. Cài contract** — `admin-departures.ts`:
  - import ở đầu file:

```ts
import { DeparturePhaseFilterSchema, DeparturePhaseSchema } from './departure-phase.js';
```

  - trong `AdminDepartureRowSchema`, ngay sau `status: AdminDepartureStatusSchema,`:

```ts
  /**
   * Giai đoạn của chuyến, SERVER tính bằng `departurePhase` với cùng một mốc
   * `now` cho cả lượt đọc (ADR-0046). Admin in nó ra, KHÔNG tính lại bằng đồng
   * hồ trình duyệt. `status` vẫn đi kèm: nút đóng/mở cần biết công tắc đang ở
   * đâu để gửi đúng chiều.
   */
  phase: DeparturePhaseSchema,
```

  - trong `AdminDepartureTourSchema`, sau `currency`:

```ts
  /**
   * Tour đang đăng hay không (spec F16 §2h). Chưa đăng thì khách không đặt
   * được chuyến nào của nó, kể cả chuyến `on-sale` — màn chuyến báo điều đó
   * một lần ở đầu trang thay vì trộn nó vào giai đoạn của từng chuyến.
   */
  isPublished: z.boolean(),
```

  - trong `AdminDeparturesListQuerySchema`, THAY dòng
    `status: AdminDepartureStatusSchema.optional(),` bằng:

```ts
  /**
   * Lọc theo NHÓM giai đoạn (spec F16 §2d) — thôi lọc theo công tắc `status`.
   * Server lọc bằng chính `departurePhase`, nên tab và huy hiệu không bao giờ
   * nói khác nhau.
   */
  phase: DeparturePhaseFilterSchema.optional(),
```

- [ ] **B4. Chạy lại lệnh B2** — mong đợi: xanh.

- [ ] **B5. Test int TRƯỚC** — `admin-departures.int.spec.ts`:
  - XOÁ ca `'lọc theo trạng thái'` trong `describe('list')` (nó gọi `?status=`,
    nay hết nghĩa; ca tab `cancelled` bên dưới thay nó);
  - thêm khối mới NGAY SAU `describe('list', …)`:

```ts
  describe('giai đoạn và tab lọc (F16)', () => {
    /** Đang chạy: đi hôm qua, về ngày mai. */
    const RUNNING = depId(7);
    /** Đã về mà công tắc vẫn OPEN — OPEN không giữ được một chuyến đã về. */
    const ENDED_OPEN = depId(8);
    /** 5 ngày → N = 7 → hạn chót hôm nay − 4: quá hạn nhưng chưa đi. */
    const LAST_CALL = depId(9);
    /** 3 ngày → N = 3 → hạn chót hôm nay + 17: còn hạn nhưng admin tạm ngừng. */
    const PAUSED = depId(10);

    beforeEach(async () => {
      // Chèn THÊM, không đụng bộ fixture chung — để ca "gần nhất trước" của
      // `describe('list')` giữ nguyên.
      await prisma.tourDeparture.createMany({
        data: [
          departure(RUNNING, { start: -1, end: 1 }),
          departure(ENDED_OPEN, { start: -10, end: -8 }),
          departure(LAST_CALL, { start: 3, end: 7 }),
          departure(PAUSED, { start: 20, end: 22, status: DepartureStatus.CLOSED }),
        ],
      });
    });

    it('mỗi hàng mang ĐÚNG giai đoạn — công tắc không quyết vòng đời', async () => {
      const paged = await listOk(`?slug=${PUBLISHED_SLUG}&limit=100`);
      const phaseById = Object.fromEntries(paged.items.map((item) => [item.id, item.phase]));

      expect(phaseById).toEqual({
        [FREE]: 'on-sale',
        [BOOKED]: 'on-sale',
        [CANCELLED]: 'cancelled',
        [PAUSED]: 'closed',
        [LAST_CALL]: 'deadline-passed',
        // Khởi hành HÔM NAY: ngày đi đã là `departed`, dù công tắc ghi CLOSED.
        [DEADLINE_GONE]: 'departed',
        [RUNNING]: 'departed',
        [ENDED_OPEN]: 'completed',
        [PAST]: 'completed',
      });
    });

    it.each([
      ['upcoming', [FREE, BOOKED, PAUSED, LAST_CALL]],
      ['departed', [DEADLINE_GONE, RUNNING]],
      ['completed', [ENDED_OPEN, PAST]],
      ['cancelled', [CANCELLED]],
    ] as const)('tab %s: đúng tập hàng, gần nhất trước, total đếm SAU lọc', async (phase, ids) => {
      const paged = await listOk(`?slug=${PUBLISHED_SLUG}&phase=${phase}&limit=100`);

      expect(paged.items.map((item) => item.id)).toEqual(ids);
      expect(paged.total).toBe(ids.length);
    });

    it('phân trang chạy trên tập ĐÃ lọc, không trên cả lịch của tour', async () => {
      const paged = await listOk(`?slug=${PUBLISHED_SLUG}&phase=upcoming&limit=2&page=2`);

      expect(paged.items.map((item) => item.id)).toEqual([PAUSED, LAST_CALL]);
      expect(paged.total).toBe(4);
      expect(paged.totalPages).toBe(2);
    });

    it('nhóm lạ → 400 ngay ở biên schema', async () => {
      expect((await list(`?slug=${PUBLISHED_SLUG}&phase=OPEN`, adminCookie)).statusCode).toBe(
        400,
      );
    });

    it('lệnh ghi trả hàng KÈM giai đoạn mới: đóng rồi mở lại', async () => {
      const closed = await setStatus(FREE, 'CLOSED', adminCookie);
      expect(AdminDepartureRowSchema.parse(closed.json()).phase).toBe('closed');

      const reopened = await setStatus(FREE, 'OPEN', adminCookie);
      expect(AdminDepartureRowSchema.parse(reopened.json()).phase).toBe('on-sale');
    });

    it('báo tour đang đăng hay không — và màn chuyến VẪN mở được khi tour đã ẩn', async () => {
      expect((await listOk(`?slug=${PUBLISHED_SLUG}`)).tour.isPublished).toBe(true);

      await prisma.tour.update({ where: { id: tour.id }, data: { isPublished: false } });
      try {
        expect((await listOk(`?slug=${PUBLISHED_SLUG}`)).tour.isPublished).toBe(false);
      } finally {
        await prisma.tour.update({ where: { id: tour.id }, data: { isPublished: true } });
      }
    });
  });
```

  - JSDoc đầu file: đổi `` `list` (một tour, lọc, đếm booking sống) `` thành
    `` `list` (một tour, lọc theo nhóm giai đoạn — F16, đếm booking sống) ``.

- [ ] **B6. Build contract rồi chạy cho ĐỎ:**
  `pnpm turbo run build --filter=@tourism/contract --output-logs=errors-only` rồi
  `pnpm --filter @tourism/api run test:int admin-departures` — mong đợi: đỏ vì
  hàng chưa có `phase` (schema kết quả trượt) và tour chưa có `isPublished`.

- [ ] **B7. Cài API** — `admin-departures.service.ts`:
  - import: thêm `DeparturePhase` vào khối `import type { … } from '@tourism/contract'`;
    thêm `DEPARTURE_PHASE_FILTER_GROUPS` và `departurePhase` vào khối import giá
    trị cạnh `cancellationDeadline`, `vietnamToday`.
  - `TOUR_SELECT`, sau `maxGroupSize: true,`:

```ts
  /** Màn chuyến báo một dòng khi tour chưa đăng (spec F16 §2h). */
  isPublished: true,
```

  - THAY trọn method `list` (cả JSDoc) bằng:

```ts
  /**
   * Một trang chuyến của MỘT tour, GẦN NHẤT trước (`startDate desc`, `id` phụ
   * để thứ tự ổn định khi hai chuyến cùng ngày).
   *
   * Lọc theo NHÓM giai đoạn TRONG BỘ NHỚ bằng chính `departurePhase` (spec F16
   * §2d): dịch luật sang SQL là để nó sống ở hai nơi, và chỉ cần lệch một dấu
   * so sánh là tab nói khác huy hiệu. Mỗi tour chỉ có vài chục chuyến nên đọc
   * hết là rẻ; tour nào tiến tới hàng nghìn chuyến thì phải xét lại.
   *
   * MỘT mốc `now` cho cả lượt đọc — lọc và giai đoạn in ra nhìn cùng một
   * khoảnh khắc. `total` đếm SAU khi lọc. `liveBookingCount` vẫn là MỘT câu gom
   * nhóm, chỉ cho các hàng của trang.
   */
  async list(query: AdminDeparturesListQuery): Promise<AdminDeparturesListResult> {
    const { slug, phase, page, limit } = query;
    const tour = await prisma.tour.findUnique({ where: { slug }, select: TOUR_SELECT });
    if (!tour) throw new TourNotFoundError(slug);

    const now = new Date();
    const all = await prisma.tourDeparture.findMany({
      where: { tourId: tour.id },
      select: DEPARTURE_SELECT,
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
    });
    const wanted = phase ? DEPARTURE_PHASE_FILTER_GROUPS[phase] : null;
    const matching = wanted ? all.filter((row) => wanted.includes(phaseOf(row, now))) : all;
    const rows = matching.slice((page - 1) * limit, page * limit);
    const counts = await bookingCounts(rows.map((row) => row.id));

    return {
      ...toPaged(
        rows.map((row) => toRow(row, tour, counts.get(row.id) ?? ZERO_COUNTS, now)),
        { page, limit, total: matching.length },
      ),
      tour: toTour(tour),
    };
  }
```

  - `create`: `toRow(created, tour, ZERO_COUNTS)` → `toRow(created, tour, ZERO_COUNTS, now)`.
  - `update` và `setStatus`: `toRow(row, tour, counts.get(row.id) ?? ZERO_COUNTS)`
    → thêm `, now` vào cuối (cả hai đã có sẵn `const now = new Date()`).
  - `rowById`: chữ ký thành `async rowById(id: string, now: Date = new Date())`,
    dòng cuối thành `return toRow(row, tour, counts.get(row.id) ?? ZERO_COUNTS, now);`,
    và thêm vào JSDoc của nó: "`now` mặc định là lúc gọi — đường huỷ chuyến F13
    gọi nó sau khi commit, và cần giai đoạn của đúng khoảnh khắc ấy."
  - thêm helper ngay TRÊN `function toRow`:

```ts
/** Giai đoạn của một hàng DB ở mốc `now` — một chỗ duy nhất đổi `Date` sang ngày lịch. */
function phaseOf(row: DepartureRowData, now: Date): DeparturePhase {
  return departurePhase({
    status: row.status,
    startDate: calendarDate(row.startDate),
    endDate: calendarDate(row.endDate),
    now,
  });
}
```

  - `toRow`: thêm tham số thứ tư `now: Date`, thêm JSDoc
    "`now` do CHỖ GỌI đưa vào, không tự gọi `new Date()`: cả lượt đọc hay ghi
    phải nhìn cùng một khoảnh khắc (spec F16 §2c).", và ngay sau
    `status: row.status,` thêm:

```ts
    phase: phaseOf(row, now),
```

  - `toTour`: thêm `isPublished: tour.isPublished,` sau `currency`.

- [ ] **B8. Chạy lại lệnh int ở B6** — mong đợi: xanh, kể cả mọi ca cũ.

- [ ] **B9. Helper fixture admin** — tạo `apps/admin/src/test/departure-row.ts`:

```ts
import { type AdminDepartureRow, departurePhase } from '@tourism/contract';

/**
 * Fixture hàng chuyến cho test admin (spec F16 §4 mục 10).
 *
 * Từ F16 mỗi `AdminDepartureRow` chở `phase` do SERVER tính. Điền tay thì rất
 * dễ ghép một `phase` với một `today` nói khác nó — vd `'on-sale'` cho một hàng
 * mà `today` đã qua ngày đi — rồi ghim một hành vi không bao giờ xảy ra thật.
 * Helper tính `phase` bằng CHÍNH hàm của server, ở giữa trưa giờ Việt Nam của
 * `today`, xa cả hai mốc nửa đêm.
 *
 * Đây là chỗ DUY NHẤT trong `apps/admin` được gọi `departurePhase`: code thật
 * của admin chỉ đọc `row.phase`.
 */
export type DepartureRowFixture = Omit<AdminDepartureRow, 'phase'>;

/** 12:00 giờ Việt Nam (05:00 UTC) của một ngày lịch. */
export function noonInVietnam(day: string): Date {
  return new Date(`${day}T05:00:00.000Z`);
}

export function withPhase(row: DepartureRowFixture, today: string): AdminDepartureRow {
  return {
    ...row,
    phase: departurePhase({
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      now: noonInVietnam(today),
    }),
  };
}
```

- [ ] **B10. Chuyển fixture admin sang helper** (VM chưa đọc `phase`, nên mọi ca
  cũ phải XANH nguyên trạng — đỏ ca nào là chuyển sai):
  - `departures-view.spec.ts`: `ROW` đổi kiểu thành `DepartureRowFixture`
    (import `type DepartureRowFixture, withPhase` từ `@/test/departure-row`, bỏ
    import `AdminDepartureRow` nếu hết dùng); thêm ngay dưới `AFTER`:

```ts
/** VM của một hàng ở ngày `today`, `phase` do chính hàm server tính. */
const vmAt = (row: DepartureRowFixture, today: string) =>
  toDepartureRowVM(withPhase(row, today), today);
```

    rồi trong THÂN các ca test, đổi mọi `toDepartureRowVM(` thành `vmAt(`.
  - `departure-row-actions.spec.tsx`: cùng import, cùng helper `vmAt` (đặt dưới
    `AFTER_DEADLINE`); `ROW` và `BUSY` đổi kiểu thành `DepartureRowFixture`; rồi:
    - `renderActions(row: DepartureRowFixture, today: string, setStatus = vi.fn(async () => ({ ok: true as const, row: withPhase({ ...row, status: 'CLOSED' as const }, today) })))`,
      trong thân dùng `row={vmAt(row, today)}` và `dates: vmAt(row, today).dates`;
    - ca "chuyến đã khởi hành": `t.cancel.actionLabel(vmAt(ROW, '2026-10-10').dates)`;
    - ca token phiên bản: `update = vi.fn(async () => ({ ok: true as const, row: withPhase(ROW, BEFORE_DEADLINE) }))`,
      `const vm = vmAt(ROW, BEFORE_DEADLINE)`, và `rerender` dùng
      `row={vmAt({ ...ROW, version: '2026-09-21T09:00:00.000Z' }, BEFORE_DEADLINE)}`;
    - `renderCancellable(row: DepartureRowFixture, cancel = vi.fn())`, hai chỗ
      `toDepartureRowVM(row, BEFORE_DEADLINE)` thành `vmAt(row, BEFORE_DEADLINE)`;
    - `cancelFn` trả `row: withPhase({ ...BUSY, status: 'CANCELLED' as const }, BEFORE_DEADLINE)`.
  - `departure-form-dialog.spec.tsx`: thêm vào `SAVED`, sau `status: 'OPEN',`:

```ts
  // Chuyến tháng 12 nhìn từ tháng 9: còn bán. Đây là RESPONSE giả, không gắn
  // với `today` nào, nên điền thẳng thay vì qua `withPhase`.
  phase: 'on-sale',
```

- [ ] **B11. Chạy admin:** `pnpm --filter @tourism/admin exec vitest run` và
  `pnpm --filter @tourism/admin run typecheck` — mong đợi: xanh, số ca KHÔNG đổi.
- [ ] **B12. Thử đột biến** (sửa tạm, thấy đỏ, trả lại): trong `list`, đổi
  `total: matching.length` thành `total: all.length` → ca tab và ca phân trang
  phải đỏ; cắt trang TRƯỚC rồi mới lọc (lọc trên `all.slice(…)`) → ca phân trang
  phải đỏ; trong `toTour` gán cứng `isPublished: true` → ca "tour đã ẩn" phải đỏ.
- [ ] **B13.** Quy trình gate.
- [ ] **B14. Commit:** `feat(api): hàng chuyến admin mang giai đoạn, lọc theo nhóm giai đoạn, báo tour chưa đăng (F16)`

## Task 3 — Admin: năm tab lọc theo nhóm giai đoạn

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts`
- Modify: `apps/admin/src/lib/departures-query.ts`
- Modify: `apps/admin/src/lib/departures-query.spec.ts`
- Modify: `apps/admin/src/components/departures/departures-table.tsx`
- Create: `apps/admin/src/components/departures/departures-table.spec.tsx`

**Interfaces:**
- Consumes: `DeparturePhaseFilterSchema`, `type DeparturePhaseFilter` (Task 1);
  `withPhase`, `DepartureRowFixture` (Task 2).
- Produces: `DeparturesQuery.phase?: DeparturePhaseFilter` (thay `status`) ·
  `DeparturesHrefPatch.phase?: DeparturePhaseFilter | null` ·
  `messages.admin.departures.list.phaseFilter` · helper test `renderTable` trong
  `departures-table.spec.tsx` (Task 4 dùng lại).

- [ ] **B1. Copy** — `messages.ts`, khối `admin.departures.list`, ngay sau
  `all: 'All',`:

```ts
        /** Bốn tab lọc theo NHÓM giai đoạn (spec F16 §2d) — "All" ở ngay trên. */
        phaseFilter: {
          upcoming: 'Upcoming',
          departed: 'Departed',
          completed: 'Completed',
          cancelled: 'Cancelled',
        },
```

  Build: `pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only`.

- [ ] **B2. Test query TRƯỚC** — `departures-query.spec.ts`: THAY ca
  `'status ngoài enum thì bỏ filter, trong enum thì giữ'` bằng:

```ts
  it('phase ngoài bốn nhóm thì bỏ filter, trong nhóm thì giữ', () => {
    // `on-sale` là một GIAI ĐOẠN, không phải một nhóm lọc.
    expect(parseDeparturesSearchParams('a-tour', { phase: 'on-sale' }).phase).toBeUndefined();
    expect(parseDeparturesSearchParams('a-tour', { phase: 'completed' }).phase).toBe('completed');
  });

  it('URL cũ `?status=OPEN` rơi êm về All — không còn nghĩa, không ném', () => {
    expect(parseDeparturesSearchParams('a-tour', { status: 'OPEN' })).toEqual({
      slug: 'a-tour',
      page: 1,
      limit: 20,
    });
  });
```

  và trong `describe('departuresHref')`, đổi ba ca đang dùng `status` sang
  `phase`:

```ts
  it('đổi filter ĐẶT LẠI trang về 1', () => {
    const onPage5 = { ...QUERY, page: 5 };

    expect(departuresHref(onPage5, { phase: 'upcoming' })).toBe(
      '/tours/ha-long-bay-cruise/departures?phase=upcoming',
    );
  });

  it('đổi trang thì giữ filter', () => {
    const filtered = { ...QUERY, phase: 'departed' as const };

    expect(departuresHref(filtered, { page: 3 })).toBe(
      '/tours/ha-long-bay-cruise/departures?phase=departed&page=3',
    );
  });

  it('`null` xoá filter, `undefined` giữ nguyên', () => {
    const filtered = { ...QUERY, phase: 'completed' as const };

    expect(departuresHref(filtered, { phase: null })).toBe('/tours/ha-long-bay-cruise/departures');
    expect(departuresHref(filtered, {})).toContain('phase=completed');
  });
```

- [ ] **B3. Chạy cho ĐỎ:**
  `pnpm --filter @tourism/admin exec vitest run src/lib/departures-query.spec.ts`
  — mong đợi: đỏ ở ca `phase` (typecheck của vitest không chặn; ca trả sai giá trị).

- [ ] **B4. Cài** — `departures-query.ts`:
  - import: thay `type AdminDepartureStatus, AdminDepartureStatusSchema` bằng
    `type DeparturePhaseFilter, DeparturePhaseFilterSchema`;
  - JSDoc đầu file: câu "MỘT filter duy nhất: `status`." thành
    "MỘT filter duy nhất: `phase` — NHÓM giai đoạn của chuyến (spec F16 §2d),
    không còn là công tắc `status`.";
  - `DeparturesQuery.status?: AdminDepartureStatus` thành `phase?: DeparturePhaseFilter`;
  - thân `parseDeparturesSearchParams`:

```ts
  const phase = DeparturePhaseFilterSchema.safeParse(firstParam(raw.phase));

  return {
    slug,
    ...parsePaging(raw),
    ...(phase.success ? { phase: phase.data } : {}),
  };
```

  - JSDoc của nó: "`status` ngoài enum thì bỏ filter" thành "`phase` ngoài bốn
    nhóm (kể cả `status` của URL cũ) thì bỏ filter";
  - `DeparturesHrefPatch.status?: AdminDepartureStatus | null` thành
    `phase?: DeparturePhaseFilter | null`;
  - thân `departuresHref`:

```ts
  const phase = pickPatch(patch.phase, current.phase);
  const scopeChanged = patch.phase !== undefined || patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (phase) params.set('phase', phase);
  appendPaging(params, paging);

  return tableHref(departuresPath(current.slug), params);
```

- [ ] **B5. Chạy lại lệnh B3** — mong đợi: xanh.

- [ ] **B6. Test bảng TRƯỚC** — tạo `departures-table.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeparturesQuery } from '@/lib/departures-query';
import { toDepartureRowVM } from '@/lib/departures-view';
import { type DepartureRowFixture, withPhase } from '@/test/departure-row';
import { DeparturesTable } from './departures-table';

/**
 * Bảng `/tours/[slug]/departures` (spec F16) — soi phần RIÊNG của F16, không
 * soi lại kit: tab lọc theo NHÓM giai đoạn (task 3) và cột Status in GIAI ĐOẠN
 * thay vì công tắc (task 4).
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const t = messages.admin.departures;

const QUERY: DeparturesQuery = { slug: 'hoi-an-lantern-evening', page: 1, limit: 20 };

/** Chuyến 5 ngày 10/10 → 14/10, hạn chót 03/10. */
const ROW: DepartureRowFixture = {
  id: '4f1b1f2e-0000-4000-8000-000000000001',
  startDate: '2026-10-10',
  endDate: '2026-10-14',
  price: '129.00',
  priceOverride: null,
  currency: 'USD',
  seatsBooked: 4,
  seatsTotal: 20,
  status: 'OPEN',
  cancellationDeadline: '2026-10-03',
  liveBookingCount: 2,
  pendingBookingCount: 0,
  version: '2026-09-20T08:00:00.000Z',
};

function renderTable({
  query = QUERY,
  today = '2026-10-01',
  row = ROW,
}: { query?: DeparturesQuery; today?: string; row?: DepartureRowFixture } = {}) {
  const rows = [toDepartureRowVM(withPhase(row, today), today)];
  return render(
    <DeparturesTable
      rows={rows}
      query={query}
      total={rows.length}
      totalPages={1}
      tour={{ slug: QUERY.slug, basePriceLabel: '$129.00' }}
      today={today}
      create={vi.fn()}
      update={vi.fn()}
      setStatus={vi.fn()}
      cancel={vi.fn()}
    />,
  );
}

beforeEach(() => {
  push.mockReset();
});

describe('DeparturesTable — tab lọc theo NHÓM giai đoạn', () => {
  it('năm tab theo đúng thứ tự: All rồi bốn nhóm', () => {
    renderTable();

    // Nút tab mang `aria-pressed`; nút hàng và nút công cụ thì không.
    const tabs = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('aria-pressed'));
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      t.list.all,
      t.list.phaseFilter.upcoming,
      t.list.phaseFilter.departed,
      t.list.phaseFilter.completed,
      t.list.phaseFilter.cancelled,
    ]);
  });

  it('tab đang lọc là tab được nhấn', () => {
    renderTable({ query: { ...QUERY, phase: 'upcoming' } });

    expect(
      screen.getByRole('button', { name: t.list.phaseFilter.upcoming, pressed: true }),
    ).toBeInTheDocument();
  });

  it('bấm một tab đẩy URL mang NHÓM giai đoạn và về trang 1', async () => {
    const user = userEvent.setup();
    renderTable({ query: { ...QUERY, page: 3 } });

    await user.click(screen.getByRole('button', { name: t.list.phaseFilter.completed }));

    expect(push).toHaveBeenCalledWith('/tours/hoi-an-lantern-evening/departures?phase=completed');
  });

  it('bấm All thì xoá tham số', async () => {
    const user = userEvent.setup();
    renderTable({ query: { ...QUERY, phase: 'departed' } });

    await user.click(screen.getByRole('button', { name: t.list.all }));

    expect(push).toHaveBeenCalledWith('/tours/hoi-an-lantern-evening/departures');
  });
});
```

- [ ] **B7. Chạy cho ĐỎ:**
  `pnpm --filter @tourism/admin exec vitest run src/components/departures/departures-table.spec.tsx`
  — mong đợi: đỏ vì tab vẫn là ba giá trị công tắc.

- [ ] **B8. Cài** — `departures-table.tsx`:
  - import: bỏ `AdminDepartureStatusSchema`, thêm
    `type DeparturePhaseFilter, DeparturePhaseFilterSchema` từ `@tourism/contract`;
    thêm `CalendarClockIcon`, `FlagIcon`, `PlaneIcon` từ `lucide-react`; bỏ
    `LockIcon` nếu hết dùng (Task 4 sẽ import lại);
  - THAY khối `STATUSES` · `STATUS_ICONS` · `TAB_ITEMS` bằng:

```tsx
/** Icon theo tab — `Record` trên enum để quên một nhóm là đỏ typecheck. */
const PHASE_FILTER_ICONS: Record<DeparturePhaseFilter, typeof ListIcon> = {
  upcoming: CalendarClockIcon,
  departed: PlaneIcon,
  completed: FlagIcon,
  cancelled: BanIcon,
};

/** All rồi bốn NHÓM giai đoạn (spec F16 §2d) — thôi lọc theo công tắc `status`. */
const TAB_ITEMS = [
  { label: t.list.all, value: ALL, icon: ListIcon },
  ...DeparturePhaseFilterSchema.options.map((filter) => ({
    label: t.list.phaseFilter[filter],
    value: filter,
    icon: PHASE_FILTER_ICONS[filter],
  })),
];
```

  - THAY `goStatus` bằng:

```tsx
  function goPhase(next: string) {
    // `safeParse` chứ không `parse`: value lạ (kể cả "All") rơi êm về không
    // lọc thay vì ném ZodError giữa event handler (nếp bookings, review F1).
    const parsed = DeparturePhaseFilterSchema.safeParse(next);
    router.push(departuresHref(query, { phase: parsed.success ? parsed.data : null }));
  }
```

  - trong `StatusFilterTabs`: `value={query.phase ?? ALL}` và `onSelect={goPhase}`.

- [ ] **B9. Chạy lại lệnh B7** — mong đợi: xanh.
- [ ] **B10. Thử đột biến:** đảo thứ tự hai nhóm trong `DeparturePhaseFilterSchema`
  (không đổi test) → ca "đúng thứ tự" phải đỏ; trong `goPhase` đổi
  `parsed.data` thành `null` → ca "bấm một tab" phải đỏ.
- [ ] **B11.** Quy trình gate.
- [ ] **B12. Commit:** `feat(admin): màn chuyến lọc theo nhóm giai đoạn — Upcoming, Departed, Completed, Cancelled (F16)`

## Task 4 — Admin: huy hiệu giai đoạn và nút theo giai đoạn

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts`
- Modify: `apps/admin/src/lib/departures-view.ts`
- Modify: `apps/admin/src/lib/departures-view.spec.ts`
- Modify: `apps/admin/src/components/departures/departures-table.tsx`
- Modify: `apps/admin/src/components/departures/departures-table.spec.tsx`
- Modify: `apps/admin/src/components/departures/departure-row-actions.tsx`
- Modify: `apps/admin/src/components/departures/departure-row-actions.spec.tsx`

**Interfaces:**
- Consumes: `DEPARTURE_PHASE_FILTER_GROUPS`, `type DeparturePhase` (Task 1);
  `vmAt`/`withPhase` (Task 2); `renderTable` (Task 3).
- Produces: `DepartureRowVM.phase`, `.phaseLabel`, `.showToggle` (bỏ
  `statusLabel`) · `departurePhaseBadgeVariant(phase: DeparturePhase)` (thay
  `departureStatusBadgeVariant`) · `messages.admin.departures.phase`.

- [ ] **B1. Copy** — `messages.ts`: THAY khối `status: { OPEN…, CLOSED…, CANCELLED… }`
  của `admin.departures` (cùng JSDoc phía trên nó) bằng:

```ts
      /**
       * Nhãn của sáu GIAI ĐOẠN (ADR-0046) — thứ cột Status in ra. Công tắc
       * `OPEN`/`CLOSED`/`CANCELLED` không còn nhãn riêng: nó chỉ quyết nút
       * đóng/mở gửi chiều nào.
       */
      phase: {
        'on-sale': 'On sale',
        'deadline-passed': 'Deadline passed',
        closed: 'Closed',
        departed: 'Departed',
        completed: 'Completed',
        cancelled: 'Cancelled',
      },
```

  Trước khi xoá, `grep -rn "departures.status\|t\.status\[" apps/admin/src`
  phải chỉ còn chỗ ở `departures-view.ts` (sắp bỏ ở B4). Build i18n như Task 3 B1.

- [ ] **B2. Test VM TRƯỚC** — `departures-view.spec.ts`:
  - import `departurePhaseBadgeVariant` thay `departureStatusBadgeVariant`;
  - THAY `describe('departureStatusBadgeVariant', …)` bằng:

```ts
describe('departurePhaseBadgeVariant', () => {
  it('xanh đặc ĐÚNG MỘT chỗ — còn nhận tiền được; đỏ chỉ cho chuyến đã huỷ', () => {
    expect(departurePhaseBadgeVariant('on-sale')).toBe('default');
    expect(departurePhaseBadgeVariant('deadline-passed')).toBe('outline');
    expect(departurePhaseBadgeVariant('closed')).toBe('secondary');
    expect(departurePhaseBadgeVariant('departed')).toBe('outline');
    expect(departurePhaseBadgeVariant('completed')).toBe('secondary');
    expect(departurePhaseBadgeVariant('cancelled')).toBe('destructive');
  });
});
```

  - thêm describe mới ở cuối file:

```ts
describe('toDepartureRowVM — cờ theo GIAI ĐOẠN (F16)', () => {
  // Chuyến 10/10 → 14/10, hạn chót 03/10. Mỗi ca chọn `status` và `today` để
  // server ra đúng giai đoạn cần thử.
  it.each([
    // giai đoạn, status, today, showToggle, canClose, canReopen, canCancel, canEdit
    ['on-sale', 'OPEN', '2026-10-01', true, true, false, true, true],
    ['deadline-passed', 'OPEN', '2026-10-05', true, true, false, true, true],
    ['closed', 'CLOSED', '2026-10-01', true, false, true, true, true],
    ['departed', 'OPEN', '2026-10-12', false, false, false, false, true],
    ['completed', 'CLOSED', '2026-10-20', false, false, false, false, true],
    ['cancelled', 'CANCELLED', '2026-10-01', false, false, false, false, false],
  ] as const)('%s', (phase, status, today, showToggle, canClose, canReopen, canCancel, canEdit) => {
    const vm = vmAt({ ...ROW, status }, today);

    expect(vm.phase).toBe(phase);
    expect(vm.phaseLabel).toBe(t.phase[phase]);
    expect({
      showToggle: vm.showToggle,
      canClose: vm.canClose,
      canReopen: vm.canReopen,
      canCancel: vm.canCancel,
      canEdit: vm.canEdit,
    }).toEqual({ showToggle, canClose, canReopen, canCancel, canEdit });
  });

  it('closed ĐÃ QUA hạn chót: còn chỗ cho nút Reopen nhưng nút tắt', () => {
    const vm = vmAt({ ...ROW, status: 'CLOSED' }, '2026-10-05');

    expect(vm.phase).toBe('closed');
    expect(vm.showToggle).toBe(true);
    expect(vm.canReopen).toBe(false);
  });

  it('VM TIN `phase` của server, không tự tính lại từ `today`', () => {
    // Server nói `departed` trong khi `today` của trang còn trước ngày đi —
    // chuyện có thật khi hai đồng hồ đứng hai bên mốc nửa đêm. Huy hiệu, nút
    // đóng/mở và nút huỷ phải cùng nghe server.
    const vm = toDepartureRowVM({ ...withPhase(ROW, '2026-10-01'), phase: 'departed' }, '2026-10-01');

    expect(vm.showToggle).toBe(false);
    expect(vm.canCancel).toBe(false);
  });
});
```

- [ ] **B3. Chạy cho ĐỎ:**
  `pnpm --filter @tourism/admin exec vitest run src/lib/departures-view.spec.ts`
  — mong đợi: đỏ vì chưa có `departurePhaseBadgeVariant` / `phaseLabel` / `showToggle`.

- [ ] **B4. Cài VM** — `departures-view.ts`:
  - import từ `@tourism/contract`: thêm `DEPARTURE_PHASE_FILTER_GROUPS` và
    `type DeparturePhase`;
  - JSDoc đầu file: câu về "Ba lá cờ `canEdit`/`canClose`/`canReopen`" thêm ý:
    "Từ F16 các cờ vòng đời đọc `phase` của server (ADR-0046); chỉ hai thứ gắn
    với hạn chót còn đọc `today`: dòng "Passed" và nút Reopen.";
  - trong `DepartureRowVM`: XOÁ `statusLabel`; thêm sau `status`:

```ts
  /** Giai đoạn do SERVER tính (ADR-0046) — VM chỉ chở, không tính lại. */
  phase: DeparturePhase;
  /** Nhãn của giai đoạn — thứ cột Status in ra. */
  phaseLabel: string;
```

    và thêm trước `canClose`:

```ts
  /**
   * Hàng còn nút đóng/mở không — chỉ chuyến CHƯA ĐI (nhóm Upcoming). Từ ngày
   * khởi hành, Reopen đã bị chặn vì quá hạn chót, còn Close chỉ còn một hậu
   * quả thật là hoàn tiền một khách đặt đúng luật ngay ngày đi (ADR-0046). Ẩn
   * nút thì ô vẫn giữ chỗ — xem `DepartureRowActions`.
   */
  showToggle: boolean;
```

  - trong `toDepartureRowVM`, thay dòng `const cancelled = row.status === 'CANCELLED';` bằng:

```ts
  const cancelled = row.phase === 'cancelled';
  // Chuyến còn thao tác được = đúng tập của tab Upcoming — một định nghĩa, hai
  // chỗ dùng (nút đóng/mở và nút huỷ).
  const upcoming = DEPARTURE_PHASE_FILTER_GROUPS.upcoming.includes(row.phase);
```

    rồi trong object trả về, thay đoạn từ dòng `status: row.status,` tới hết
    dòng `canCancel: …` (kể cả comment của nó) bằng:

```ts
    status: row.status,
    phase: row.phase,
    phaseLabel: t.phase[row.phase],
    canEdit: !cancelled,
    showToggle: upcoming,
    canClose: row.phase === 'on-sale' || row.phase === 'deadline-passed',
    canReopen: row.phase === 'closed' && !deadlinePassed,
    // Cùng mốc với huy hiệu vì cả hai đọc `phase` của server — trước F16 là
    // `today < startDate` của trang, một đồng hồ thứ hai.
    canCancel: upcoming,
```

    (giữ `refundOutstanding` như cũ — nó đã đọc `cancelled`);
  - THAY `departureStatusBadgeVariant` bằng:

```ts
/** Biến thể Badge theo giai đoạn — `Record` để thêm giai đoạn là đỏ typecheck. */
const PHASE_BADGE_VARIANTS: Record<
  DeparturePhase,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  // Xanh đặc ĐÚNG MỘT chỗ: còn nhận tiền được.
  'on-sale': 'default',
  'deadline-passed': 'outline',
  closed: 'secondary',
  departed: 'outline',
  completed: 'secondary',
  cancelled: 'destructive',
};

export function departurePhaseBadgeVariant(
  phase: DeparturePhase,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  return PHASE_BADGE_VARIANTS[phase];
}
```

- [ ] **B5. Chạy lại lệnh B3** — mong đợi: xanh (cả ca cũ).

- [ ] **B6. Test nút TRƯỚC** — `departure-row-actions.spec.tsx`:
  - ca `'chuyến đã khởi hành: ô nút huỷ giữ chỗ, nhưng KHÔNG phải một nút'`: đổi
    `toHaveLength(2)` thành `toHaveLength(1)` và thêm một dòng comment:
    "Từ F16 hàng đã khởi hành chỉ còn Sửa — nút đóng/mở cũng nhường chỗ.";
  - thêm vào `describe('DepartureRowActions — nút nào được bấm')`:

```tsx
  it('QUÁ HẠN CHÓT mà chưa đi: Close VẪN bấm được — checkout mở trước hạn có thể đang dở', () => {
    const { dates } = renderActions(ROW, AFTER_DEADLINE);

    expect(screen.getByRole('button', { name: t.setStatus.closeLabel(dates) })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.cancel.actionLabel(dates) })).toBeEnabled();
  });

  it.each([
    ['đang chạy', ROW, '2026-10-12'],
    ['đã về', { ...ROW, status: 'CLOSED' as const }, '2026-10-20'],
  ] as const)('chuyến %s: chỉ còn Sửa, không Close cũng không Reopen', (_label, row, today) => {
    const { dates } = renderActions(row, today);

    expect(screen.getByRole('button', { name: t.edit.actionLabel(dates) })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: t.setStatus.closeLabel(dates) }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.setStatus.reopenLabel(dates) }),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(1);
  });

  it('ô giữ chỗ của nút đóng/mở là một vùng `aria-hidden`, không phải một nút', () => {
    // Giữ cột cho thẳng (lượt thử tay F14) mà không mời trình đọc màn hình bấm
    // một thứ không tồn tại. `getByText` không lọc cây trợ năng, nên nó tìm
    // thấy chữ nằm trong ô giữ chỗ.
    renderActions(ROW, '2026-10-12');

    const placeholder = screen.getByText(t.setStatus.close).closest('[aria-hidden="true"]');
    expect(placeholder?.tagName).toBe('SPAN');
    expect(placeholder?.closest('button')).toBeNull();
  });
```

- [ ] **B7. Chạy cho ĐỎ:**
  `pnpm --filter @tourism/admin exec vitest run src/components/departures/departure-row-actions.spec.tsx`
  — mong đợi: đỏ vì nút đóng/mở vẫn hiện ở hàng đã khởi hành.

- [ ] **B8. Cài nút** — `departure-row-actions.tsx`:
  - JSDoc đầu file, thêm đoạn: "Từ F16 hàng `departed`/`completed` chỉ còn Sửa:
    nút đóng/mở nhường chỗ cho một ô giữ chỗ cùng cỡ (spec F16 §2f).";
  - bọc nút đóng/mở hiện có (khối `<Button … onClick={() => setToggling(true)}>…</Button>`)
    trong `row.showToggle ? ( … ) : ( … )`, nhánh sai là:

```tsx
        // Ô GIỮ CHỖ cùng cỡ nút đóng/mở, cho chuyến đã khởi hành (spec F16
        // §2f): thiếu hẳn nút giữa thì cụm canh phải dồn Sửa lệch khỏi cột của
        // hàng trên. `span` mượn lớp của nút chứ không phải `Button` bị ẩn —
        // cùng lý do với ô giữ chỗ nút huỷ bên dưới. `StableLabel` với cùng
        // `reserve` để bề rộng trùng khít nút thật.
        <span
          aria-hidden="true"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'invisible')}
        >
          <LockIcon data-icon="inline-start" />
          <StableLabel
            label={t.setStatus.close}
            reserve={[t.setStatus.close, t.setStatus.reopen]}
          />
        </span>
```

- [ ] **B9. Chạy lại lệnh B7** — mong đợi: xanh.

- [ ] **B10. Test huy hiệu TRƯỚC** — `departures-table.spec.tsx`: thêm `within`
  vào import từ `@testing-library/react`, rồi thêm ở cuối file:

```tsx
describe('DeparturesTable — cột Status in GIAI ĐOẠN, không in công tắc', () => {
  /** Hàng dữ liệu duy nhất của bảng (hàng 0 là tiêu đề). */
  function bodyRow() {
    const [, row] = screen.getAllByRole('row');
    if (!row) throw new Error('bảng không có hàng dữ liệu');
    return row;
  }

  it('chuyến đang chạy mà công tắc vẫn OPEN: in Departed kèm icon máy bay', () => {
    renderTable({ today: '2026-10-12' });

    const badge = within(bodyRow()).getByText(t.phase.departed);
    expect(badge.querySelector('svg')).toHaveClass('lucide-plane');
    expect(within(bodyRow()).queryByText(t.phase['on-sale'])).not.toBeInTheDocument();
  });

  it('chuyến đã về: in Completed kèm icon cờ đích', () => {
    renderTable({ today: '2026-10-20' });

    expect(within(bodyRow()).getByText(t.phase.completed).querySelector('svg')).toHaveClass(
      'lucide-flag',
    );
  });
});
```

- [ ] **B11. Chạy cho ĐỎ** — lệnh Task 3 B7; mong đợi: đỏ vì ô Status còn in công tắc.

- [ ] **B12. Cài huy hiệu** — `departures-table.tsx`:
  - import: `departurePhaseBadgeVariant` thay `departureStatusBadgeVariant`;
    `type DeparturePhase` từ `@tourism/contract`; `ClockIcon`, `LockIcon` từ
    `lucide-react`;
  - dưới `PHASE_FILTER_ICONS`, thêm:

```tsx
/** Icon theo giai đoạn — `Record` trên enum để quên một giai đoạn là đỏ typecheck. */
const PHASE_ICONS: Record<DeparturePhase, typeof ListIcon> = {
  'on-sale': CircleCheckIcon,
  'deadline-passed': ClockIcon,
  closed: LockIcon,
  departed: PlaneIcon,
  completed: FlagIcon,
  cancelled: BanIcon,
};
```

  - `COLUMN_LABELS` và `COLUMN_ICONS`: đổi khoá `statusLabel` thành `phaseLabel`;
  - THAY cột `columnHelper.accessor('statusLabel', …)` bằng:

```tsx
        columnHelper.accessor('phaseLabel', {
          header: t.list.columns.status,
          // Nghĩa nằm ở CHỮ; icon chỉ giúp mắt tách hai cặp chung biến thể
          // (Deadline passed/Departed, Closed/Completed) — spec F16 §2e.
          cell: ({ row }) => {
            const Icon = PHASE_ICONS[row.original.phase];
            return (
              <Badge variant={departurePhaseBadgeVariant(row.original.phase)} className="px-1.5">
                <Icon data-icon="inline-start" aria-hidden="true" />
                {row.original.phaseLabel}
              </Badge>
            );
          },
        }),
```

- [ ] **B13. Chạy lại lệnh B11** — mong đợi: xanh.
- [ ] **B14. Thử đột biến:** tráo `PlaneIcon`/`FlagIcon` trong `PHASE_ICONS` →
  ca huy hiệu đỏ; `showToggle: true` gán cứng → ca "chỉ còn Sửa" đỏ; bỏ
  `aria-hidden` khỏi ô giữ chỗ → ca ô giữ chỗ đỏ; `canCancel` đọc lại
  `today < row.startDate` → ca "VM tin phase của server" đỏ; `canClose` về
  `row.status === 'OPEN'` → ca bảng cờ `departed` đỏ.
- [ ] **B15.** Quy trình gate.
- [ ] **B16. Commit:** `feat(admin): huy hiệu giai đoạn chuyến, nút đóng/mở nhường chỗ khi chuyến đã khởi hành (F16)`

## Task 5 — Admin: dòng báo tour chưa đăng

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts`
- Create: `apps/admin/src/components/departures/tour-unpublished-notice.tsx`
- Create: `apps/admin/src/components/departures/tour-unpublished-notice.spec.tsx`
- Modify: `apps/admin/src/app/(admin)/tours/[slug]/departures/page.tsx`

**Interfaces:**
- Consumes: `AdminDepartureTour.isPublished` (Task 2).
- Produces: `TourUnpublishedNotice({ isPublished }: { isPublished: boolean })` ·
  `messages.admin.departures.list.unpublished.{title, body}`.

- [ ] **B1. Copy** — `messages.ts`, khối `admin.departures.list`, ngay sau `subtitle`:

```ts
        /** Dòng báo đầu trang khi tour chưa đăng (spec F16 §2h). */
        unpublished: {
          title: 'This tour is not published',
          body: 'Travellers cannot see or book any of its departures, including those marked On sale. Publish the tour from the Tours list to start selling.',
        },
```

  Build i18n như Task 3 B1.

- [ ] **B2. Test TRƯỚC** — tạo `tour-unpublished-notice.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { TourUnpublishedNotice } from './tour-unpublished-notice';

/**
 * Dòng báo tour chưa đăng (spec F16 §2h). Giai đoạn chỉ tả chuyến, nên chuyến
 * `on-sale` của một tour đang ẩn vẫn mang huy hiệu xanh — dòng này là nơi
 * DUY NHẤT nói rằng khách không đặt được.
 */
const t = messages.admin.departures.list.unpublished;

describe('TourUnpublishedNotice', () => {
  it('tour CHƯA đăng: nói rõ khách không đặt được chuyến nào, kể cả chuyến On sale', () => {
    render(<TourUnpublishedNotice isPublished={false} />);

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(t.title);
    expect(notice).toHaveTextContent(t.body);
  });

  it('là vùng `status`, không phải `alert` — thông tin tĩnh không được ngắt lời trình đọc màn hình', () => {
    render(<TourUnpublishedNotice isPublished={false} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('tour ĐÃ đăng: không hiện gì', () => {
    const { container } = render(<TourUnpublishedNotice isPublished />);

    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **B3. Chạy cho ĐỎ:**
  `pnpm --filter @tourism/admin exec vitest run src/components/departures/tour-unpublished-notice.spec.tsx`
  — mong đợi: đỏ vì chưa có component.

- [ ] **B4. Cài** — tạo `tour-unpublished-notice.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import { Alert, AlertDescription, AlertTitle } from '@tourism/ui/components/alert';
import { EyeOffIcon } from 'lucide-react';

const t = messages.admin.departures.list.unpublished;

/**
 * Dòng báo đầu màn chuyến khi TOUR chưa đăng (spec F16 §2h).
 *
 * Giai đoạn chỉ tả chuyến, nên một chuyến `on-sale` của tour đang ẩn vẫn mang
 * huy hiệu xanh dù khách không đặt được. Nói điều đó MỘT lần ở đây, thay vì
 * trộn trạng thái tour vào hàm giai đoạn của từng chuyến.
 *
 * `role="status"` ghi đè `role="alert"` mặc định của `Alert`: đây là thông tin
 * có sẵn lúc mở trang chứ không phải sự kiện vừa xảy ra, và `alert` bắt trình
 * đọc màn hình ngắt lời người dùng mỗi lần vào trang.
 */
export function TourUnpublishedNotice({ isPublished }: { isPublished: boolean }) {
  if (isPublished) return null;

  return (
    <Alert role="status">
      <EyeOffIcon aria-hidden="true" />
      <AlertTitle>{t.title}</AlertTitle>
      <AlertDescription>{t.body}</AlertDescription>
    </Alert>
  );
}
```

- [ ] **B5. Chạy lại lệnh B3** — mong đợi: xanh.

- [ ] **B6. Gắn vào trang** — `page.tsx`:
  - import `TourUnpublishedNotice` từ `@/components/departures/tour-unpublished-notice`;
  - ngay SAU khối `<div className="grid gap-1">…</div>` (tiêu đề và phụ đề), vẫn
    trong `<div className="flex flex-col gap-4 px-4 lg:px-6">`:

```tsx
        {/* Tour chưa đăng thì khách không đặt được chuyến nào, kể cả chuyến On
            sale — nói một lần ở đây (spec F16 §2h). */}
        <TourUnpublishedNotice isPublished={paged.tour.isPublished} />
```

  - comment "Trang mồ côi: bộ lọc co lại (đóng hết chuyến OPEN chẳng hạn)" đổi
    thành "Trang mồ côi: tab đang lọc co lại (một lệnh đóng hay huỷ đẩy chuyến
    sang nhóm khác chẳng hạn)".

- [ ] **B7. Thử đột biến:** bỏ `role="status"` → hai ca đầu đỏ; đảo điều kiện
  thành `if (!isPublished) return null` → cả ba ca đỏ.
- [ ] **B8.** Quy trình gate.
- [ ] **B9. Commit:** `feat(admin): báo ở đầu màn chuyến khi tour chưa đăng (F16)`

## Task 6 — Gate cuối, entry CHANGELOG, bàn giao

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **B1.** `git log --oneline main..HEAD` — năm commit của Task 1–5, không
  commit lạ. `git diff --stat main..HEAD` không chạm file nào trong danh sách
  "Không đụng" của Ràng buộc toàn cục.
- [ ] **B2.** Quy trình gate trên đỉnh nhánh; ghi lại số test từng gói (Vitest)
  và số int (ca, file) từ output.
- [ ] **B3. Entry CHANGELOG** — chèn ngay dưới khối `> **File này chỉ giữ đợt đang chạy**…`,
  TRÊN entry mới nhất. Ngày là ngày chạy bước này. Khuôn:

```markdown
## 2026-09-DD — F16 giai đoạn chuyến khởi hành (nhánh `feat/departure-phase`)

Màn Departures của admin thôi in cột `status` làm trạng thái chuyến. Lượt thử
tay F14 (23/09) cho thấy người đọc hiểu nhầm nó theo hai cách: chuyến đang
chạy vẫn ghi Open, và chuyến đã về ghi Closed khiến người xem tưởng hệ thống tự
đóng chuyến. Quyết định ở ADR-0046: `status` chỉ là công tắc bán hàng, còn giai
đoạn SUY từ ngày bằng một hàm thuần ở contract. Không migration, không job,
không đổi cổng tiền.

(Một đoạn cho mỗi thứ thấy được: sáu huy hiệu · năm tab lọc theo nhóm ·
nút đóng/mở nhường chỗ từ ngày khởi hành · dòng báo tour chưa đăng. Một đoạn
cho chỗ lệch plan nếu có, kèm lý do.)

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **N** (web …, api …, admin …, contract …, core …, ui …,
tokens …, i18n …), int **N ở N file**. Liệt kê số ca mới theo gói và các đột
biến đã thử.
```

  Không để dòng nào bắt đầu bằng `+`; tổng số test gói trọn trong một dòng hoặc
  nối bằng chữ "và". `git diff docs/CHANGELOG.md` phải chỉ có phần thêm.
- [ ] **B4.** `./scripts/docs-freshness.sh` (Git Bash) — xanh.
- [ ] **B5. Commit:** `docs: entry CHANGELOG cho F16 giai đoạn chuyến khởi hành`
- [ ] **B6.** Tắt API (lệnh PowerShell ở Quy trình gate), xoá `/tmp/f16-api.log`.
- [ ] **B7. Bàn giao** — KHÔNG merge. Báo cho session gốc: danh sách commit ·
  kết quả gate (số test từng gói, int) · đột biến đã thử và kết quả · chỗ lệch
  plan và vì sao · việc cần hạ tầng (dự kiến: không có).

## Sau khi bàn giao — việc của session gốc

1. Review nhánh (code-review), vá phát hiện trên chính nhánh này.
2. Hỏi user trước khi merge; rebase lên `main`, `git merge --ff-only`, push
   bằng SHA đích danh; `gh run list --branch main --limit 1` phải xanh.
3. Entry CHANGELOG ngày merge (bẫy `docs-freshness` khi rebase qua ngày).
4. Thử tay trên production từng bước, chờ user xác nhận — danh sách ở spec §6.

---

## Prompt bàn giao cho session thi công

Dán nguyên khối dưới đây vào một session Claude Code MỚI mở tại
`C:\Programming\Devs\Projects\Tourism-Platform-V2`.

```text
Bạn là session THI CÔNG của tourism-v2, làm việc NGAY TRONG checkout gốc
C:\Programming\Devs\Projects\Tourism-Platform-V2 (không tạo worktree). Đọc
theo thứ tự:
  CLAUDE.md                                         (15 luật + gotcha)
  docs/README.md                                    (bản đồ tài liệu)
  docs/adr/0046-departure-phase-derived.md          (quyết định)
  docs/specs/2026-09-23-departure-phase-design.md   (spec — HỢP ĐỒNG của việc này)
  docs/plans/2026-09-23-departure-phase.md          (plan — Task 1 → 6)

VIỆC: tính năng F16 — màn Departures của admin in GIAI ĐOẠN của chuyến (suy
từ ngày) thay cho cột status, lọc theo nhóm giai đoạn, ẩn nút đóng/mở từ ngày
khởi hành, và báo khi tour chưa đăng. Làm đúng Task 1 → 6 theo thứ tự, mỗi task
một commit. Không làm gì ngoài plan; thấy plan sai thì dừng và hỏi tôi.

MỞ ĐẦU
- `git status` phải sạch và đang ở `main`; `git log --oneline -3` phải thấy
  commit docs F16 (ADR-0046, spec, plan). Rồi:
  git checkout -b feat/departure-phase
- Docker Postgres phải đang chạy (`docker ps`) — integration test cần nó.

LUẬT BẤT DI BẤT DỊCH CỦA SESSION NÀY
- KHÔNG merge, KHÔNG push, KHÔNG rebase, KHÔNG dùng subagent.
- KHÔNG chạm hạ tầng sống (CLAUDE.md §15): không Supabase, không webhook,
  không env/redeploy Render/Vercel, không Cloudinary. F16 không có migration;
  thấy mình sắp cần một cái thì DỪNG và hỏi tôi.
- KHÔNG sửa bookings.service.ts, catalog.service.ts, apps/web, apps/mobile,
  apps/api/prisma/. Diff chạm vào chúng là bị trả review.
- TDD (luật 4): test đỏ đúng lý do trước, rồi mới cài. Mỗi task có bước thử
  đột biến — làm thật (sửa code cho sai, thấy đỏ, trả lại), ghi kết quả.
- Gate cuối mỗi task theo mục "Quy trình gate" của plan: chạy tách bước, hãm
  song song (máy từng phình RAM khi chạy gate:int trần), cần API sống cho build
  web; xong thì tắt API bằng lệnh PowerShell trong plan.
- Comment code TIẾNG VIỆT (luật 8); copy người dùng thấy bằng TIẾNG ANH trong
  @tourism/i18n (luật 7). Tokens-only, không hex (luật 6).
- Commit Conventional Commits, message TIẾNG VIỆT CÓ DẤU, KHÔNG AI attribution —
  không dòng Co-Authored-By (luật 12). Stage theo đường dẫn tường minh, không
  `git add -A`. Chạy `pnpm lint:fix` trước khi stage.
- Contract và i18n được đọc từ dist: sửa xong phải build lại trước khi test
  api/admin (lệnh ở Ràng buộc toàn cục của plan).
- Rà docs/skills.md trước khi bắt tay (luật 9).

NĂM CHỖ DỄ SAI (spec §4 có đủ mười)
1. Thứ tự luật trong departurePhase là một phần của luật — plan có tám đột
   biến phải chết.
2. Nửa đêm Việt Nam là 17:00 UTC hôm trước; test biên dùng 16:59:59.999Z và
   17:00:00.000Z.
3. `total` của list đếm SAU khi lọc, và cả lượt đọc dùng MỘT `now`.
4. Admin KHÔNG gọi departurePhase — chỉ đọc row.phase. Ngoại lệ duy nhất là
   helper fixture apps/admin/src/test/departure-row.ts.
5. Ô giữ chỗ của nút đóng/mở là `span` aria-hidden mượn lớp của nút, KHÔNG
   phải Button bị ẩn.

BÀN GIAO KHI XONG
Không merge. Viết cho tôi: danh sách commit; kết quả gate (số test từng gói,
số int); đột biến đã thử và kết quả; chỗ lệch plan và vì sao; việc cần hạ tầng
(dự kiến: không có).
```
