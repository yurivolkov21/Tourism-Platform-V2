# Plan — Stat card `/bookings` ăn theo bộ lọc ngày (+ 3 mục kit còn treo)

> Thi công **inline trong session này**, KHÔNG subagent (user chốt 13/08).
> Nhánh `fix/p4c-backend-logic`. KHÔNG merge, KHÔNG push.

**Mục tiêu:** bốn stat card của `/bookings` tính đúng khoảng ngày admin đang
lọc ở bảng bên dưới, thay vì cửa sổ trượt 28 ngày cố định. Kèm ba mục kit nhỏ
để lại từ vòng chỉnh UI 04/09.

**Nguồn sự thật:** [ADR-0028](../adr/0028-bookings-stats-follow-filter.md)
(quyết định + lý do). Plan này chỉ nói **làm thế nào**; mọi câu "vì sao" tra
ở ADR.

**Kiến trúc:** `admin.stats.bookings` mọc `.input({ from?, to? })` dùng đúng
`CalendarDateSchema` của `admin.bookings.list`. Phép cắt cửa sổ là một hàm
THUẦN mới (`statsWindowFromRange`) đứng cạnh `statsWindow` trong
`stats-math.ts` — test được mọi biên mà không cần DB. `StatsPeriod` thêm
`currentTo` để client dựng được câu chữ mà không tự tính kỳ.

## Ràng buộc toàn cục

- **Luật 4 — TDD** trên logic thuần: test trước, ≥80% trên logic mới.
- **Luật 7** — mọi copy user-facing ở `@tourism/i18n`, tiếng Anh.
- **Luật 8** — comment và JSDoc **tiếng Việt**; identifier tiếng Anh.
- **Luật 12** — Conventional Commits, message **tiếng Việt có dấu**, KHÔNG AI
  attribution. Sau MỖI commit chạy
  `git log -1 --format=%B | grep -i "co-authored\|generated"` — có thì amend bỏ.
- **Luật 11** — `pnpm gate:int` xanh trước khi khai xong (không phải `gate` trần).
- **Không migration.** Không đụng Supabase, không seed/xoá dữ liệu thật.
- **Biên nửa-mở** `[00:00:00.000, +1 ngày 00:00:00.000)` — không bao giờ
  `23:59:59` (ADR-0028 §3).
- Docker Postgres `tourism-v2-postgres-1` cho int test; `docker start` nếu ngủ.

## Bản đồ file

| File | Vai trò sau đợt này |
| --- | --- |
| `libs/shared/contract/src/schemas/stats.ts` | thêm `AdminBookingsStatsQuerySchema`; `StatsPeriodSchema` thêm `currentTo` |
| `libs/shared/contract/src/contract.ts` | `admin.stats.bookings` gắn `.input()`, sửa `summary` |
| `libs/shared/contract/src/schemas/reports.ts` | JSDoc trỏ về ADR-0028 (vế "stats không nhận `{from,to}`" nay sai) |
| `apps/api/src/lib/calendar-date.ts` | nhận thêm `startOfDayUtc` (dùng chung cho bookings + stats) |
| `apps/api/src/modules/bookings/bookings-date-range.ts` | `startOfDayUtc` chuyển sang import từ `lib/` |
| `apps/api/src/modules/stats/stats-math.ts` | thêm `statsWindowFromRange`; `statsPeriod` trả `currentTo` |
| `apps/api/src/modules/stats/stats.service.ts` | `adminBookings(query)`; JSDoc khai định nghĩa cửa sổ mới |
| `apps/api/src/modules/stats/admin-stats.controller.ts` | handler `bookings` chuyển input xuống service |
| `apps/admin/src/lib/api/stats.ts` | `fetchAdminBookingsStats(cookie, range)` |
| `apps/admin/src/lib/stats-view.ts` | caption hai chế độ + `statsRangeLabel` |
| `apps/admin/src/components/kit/stat-card.tsx` | `StatCardRow` nhận `period?` — một dòng khoảng ngày cho cả hàng |
| `apps/admin/src/app/(admin)/bookings/page.tsx` | truyền `{from,to}` xuống fetcher stats |
| `libs/shared/i18n/src/lib/messages.ts` | `comparisonRange`, `rangeLabel`, `periodLabel` |
| `apps/admin/src/components/kit/toolbar-filter-menu.tsx` | nhận `unknownItem` |
| `apps/admin/src/components/kit/label-value-row.tsx` | **mới** — một dòng `dt/dd`, thay 6 bản chép |

---

## Task 1 — `StatsPeriod` phơi `currentTo`

Đứng riêng vì nó chạm **cả bảy** endpoint stats và mọi fixture test; gộp với
Task 2 thì một lỗi biên sẽ lẫn vào một diff 20 file.

**Files:**
- Modify: `libs/shared/contract/src/schemas/stats.ts` (`StatsPeriodSchema`)
- Modify: `apps/api/src/modules/stats/stats-math.ts` (`statsPeriod`)
- Test: `apps/api/src/modules/stats/stats-math.spec.ts`,
  `libs/shared/contract/src/schemas/stats.spec.ts` và ba spec contract khác có
  fixture `period` (`enquiries` · `outbox` · `payment-events`), `stats.int.spec.ts`,
  `apps/admin/src/lib/stats-view.spec.ts`

**Interfaces — Produces:**
```ts
StatsPeriod = {
  windowDays: number; currentFrom: string; currentTo: string;
  previousFrom: string; generatedAt: string;
}
```

- [ ] **B1.** Sửa `stats-math.spec.ts`: `statsPeriod` phải trả `currentTo` bằng
  `generatedAt` (cửa sổ trượt kết ở lúc chốt sổ).
- [ ] **B2.** Chạy `pnpm turbo run test --filter=@tourism/api -- stats-math` → FAIL.
- [ ] **B3.** Thêm `currentTo: z.iso.datetime()` vào `StatsPeriodSchema` kèm
  JSDoc (vì sao tách khỏi `generatedAt`: có bộ lọc thì hai mốc khác nhau).
- [ ] **B4.** `statsPeriod` trả `currentTo: window.currentTo.toISOString()`;
  `StatsWindow` thêm field `currentTo: Date`; `statsWindow` đặt
  `currentTo = generatedAt`.
- [ ] **B5.** Vá 5 fixture `period` trong các spec (thêm `currentTo`).
- [ ] **B6.** `pnpm gate` xanh.
- [ ] **B7.** Commit: `feat(contract+api): StatsPeriod phơi currentTo — tách cuối kỳ khỏi lúc chốt sổ`.
- [ ] **B8.** Kiểm trailer.

---

## Task 2 — `statsWindowFromRange` (hàm thuần, TDD)

**Files:**
- Modify: `apps/api/src/lib/calendar-date.ts` (nhận `startOfDayUtc`)
- Modify: `apps/api/src/modules/bookings/bookings-date-range.ts` (import lại)
- Modify: `apps/api/src/modules/stats/stats-math.ts`
- Test: `apps/api/src/modules/stats/stats-math.spec.ts`

**Interfaces — Produces:**
```ts
export function statsWindowFromRange(
  from: string | undefined, to: string | undefined, now: Date,
): StatsWindow
```

- [ ] **B1.** Viết test cho **năm** nhánh:

```ts
describe('statsWindowFromRange', () => {
  const now = new Date('2026-09-04T10:30:00.000Z');

  it('hai đầu: kỳ này trọn tháng, kỳ trước dài BẰNG NHAU lùi liền kề', () => {
    const w = statsWindowFromRange('2026-09-01', '2026-09-30', now);
    expect(w.currentFrom.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    // Trọn ngày 30 → chặn ở 00:00 ngày 1 tháng sau, KHÔNG 23:59:59.
    expect(w.currentTo.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    // 30 ngày lùi liền kề, khít với currentFrom.
    expect(w.previousFrom.toISOString()).toBe('2026-08-02T00:00:00.000Z');
    expect(w.generatedAt).toEqual(now);
  });

  it('chỉ from: kỳ này kết ở now, kỳ trước cùng độ dài', () => {
    const w = statsWindowFromRange('2026-09-01', undefined, now);
    expect(w.currentFrom.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(w.currentTo).toEqual(now);
    // span = 3d10h30m → previousFrom = currentFrom − span.
    expect(w.previousFrom.toISOString()).toBe('2026-08-28T13:30:00.000Z');
  });

  it('chỉ to: lấy đúng STATS_WINDOW_DAYS kết ở to', () => {
    const w = statsWindowFromRange(undefined, '2026-09-30', now);
    expect(w.currentTo.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(w.currentFrom.toISOString()).toBe('2026-09-03T00:00:00.000Z');
    expect(w.previousFrom.toISOString()).toBe('2026-08-06T00:00:00.000Z');
  });

  it('không đầu nào: y hệt statsWindow (cửa sổ trượt 28 ngày)', () => {
    expect(statsWindowFromRange(undefined, undefined, now)).toEqual(statsWindow(now));
  });

  it('một ngày duy nhất: kỳ này 1 ngày, kỳ trước là ngày liền trước', () => {
    const w = statsWindowFromRange('2026-09-04', '2026-09-04', now);
    expect(w.currentFrom.toISOString()).toBe('2026-09-04T00:00:00.000Z');
    expect(w.currentTo.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(w.previousFrom.toISOString()).toBe('2026-09-03T00:00:00.000Z');
  });
});
```

- [ ] **B2.** Test `statsPeriod` với cửa sổ do range sinh ra: `windowDays` là
  span đã làm tròn, **tối thiểu 1** (ca `from` = hôm nay, span vài giờ).

```ts
it('windowDays của kỳ ngắn hơn một ngày vẫn là 1, không phải 0', () => {
  const w = statsWindowFromRange('2026-09-04', undefined,
    new Date('2026-09-04T02:00:00.000Z'));
  expect(statsPeriod(w).windowDays).toBe(1);
});
```

- [ ] **B3.** Chạy → FAIL (`statsWindowFromRange is not a function`).
- [ ] **B4.** Chuyển `startOfDayUtc` từ `bookings-date-range.ts` sang
  `apps/api/src/lib/calendar-date.ts` (export), `bookings-date-range.ts`
  import lại — một bản duy nhất của phép đổi ngày → mốc.
- [ ] **B5.** Viết `statsWindowFromRange` + JSDoc tiếng Việt (bảng bốn nhánh,
  trỏ ADR-0028 §2/§3); `statsPeriod` tính `windowDays` từ span thật
  (`Math.max(1, Math.round(span / DAY_MS))`).
- [ ] **B6.** Chạy test → PASS. `pnpm gate` xanh.
- [ ] **B7.** Commit: `feat(api): statsWindowFromRange — cắt cửa sổ theo khoảng ngày, kỳ trước lùi liền kề`.
- [ ] **B8.** Kiểm trailer.

---

## Task 3 — Contract `.input()` + service + controller + int spec

Contract, API và consumer admin phải **cùng một commit**: `.input()` đổi chữ
ký client, thiếu vế nào là typecheck đỏ (luật đụng-contract của user).

**Files:**
- Modify: `libs/shared/contract/src/schemas/stats.ts`, `contract.ts`, `schemas/reports.ts`
- Modify: `apps/api/src/modules/stats/stats.service.ts`, `admin-stats.controller.ts`
- Modify: `apps/admin/src/lib/api/stats.ts`, `app/(admin)/bookings/page.tsx`
- Test: `libs/shared/contract/src/schemas/stats.spec.ts`, `contract.spec.ts`,
  `apps/api/src/modules/stats/stats.int.spec.ts`

**Interfaces — Produces:**
```ts
AdminBookingsStatsQuery = { from?: string; to?: string }   // YYYY-MM-DD
StatsService.adminBookings(query?: AdminBookingsStatsQuery): Promise<AdminBookingsStats>
fetchAdminBookingsStats(cookie: string, range?: { from?: string; to?: string })
```

- [ ] **B1.** Test contract schema:

```ts
it('nhận khoảng ngày lịch, cả hai optional', () => {
  expect(AdminBookingsStatsQuerySchema.parse({})).toEqual({});
  expect(AdminBookingsStatsQuerySchema.parse({ from: '2026-09-01', to: '2026-09-30' }))
    .toEqual({ from: '2026-09-01', to: '2026-09-30' });
});

it('từ chối khoảng ngược — cùng luật admin.bookings.list', () => {
  expect(AdminBookingsStatsQuerySchema.safeParse({ from: '2026-09-30', to: '2026-09-01' }).success)
    .toBe(false);
});

it('từ chối mốc có giờ: hợp đồng chỉ nhận ngày lịch', () => {
  expect(AdminBookingsStatsQuerySchema.safeParse({ from: '2026-09-01T00:00:00Z' }).success)
    .toBe(false);
});
```

- [ ] **B2.** Chạy `pnpm turbo run test --filter=@tourism/contract` → FAIL.
- [ ] **B3.** Khai `AdminBookingsStatsQuerySchema` trong `schemas/stats.ts`
  (`CalendarDateSchema` import từ `bookings.js`, `.refine(from <= to)` giống
  `AdminBookingsListQuerySchema`), gắn `.input()` vào
  `contract.admin.stats.bookings` + sửa `summary` thành
  `'Bookings KPIs for a date range (defaults to the last 28 days)'`, sửa JSDoc
  §stats (khối "KHÔNG có input" nay chỉ còn đúng với sáu endpoint kia) và JSDoc
  đầu `schemas/reports.ts` trỏ ADR-0028.
- [ ] **B4.** `StatsService.adminBookings(query)` dùng
  `statsWindowFromRange(query?.from, query?.to, new Date())`; các slice đổi
  `window.generatedAt` → `window.currentTo`. JSDoc lớp: thêm mục "Cửa sổ" nói
  bookings ăn theo bộ lọc còn sáu vùng kia cố định, và §6 ADR (một khoảng, vẫn
  hai cột neo).
- [ ] **B5.** Controller: `.handler(({ input }) => this.stats.adminBookings(input))`.
- [ ] **B6.** Admin: `fetchAdminBookingsStats(cookie, range)` gọi
  `api.admin.stats.bookings(range ?? {}, …)`; `bookings/page.tsx` truyền
  `{ from: query.from, to: query.to }`.
- [ ] **B7.** Int spec — ba test mới trong `describe('stats.bookings')`:
  khoảng ngày cắt đúng tập (booking ngoài khoảng không vào `revenue`); kỳ
  trước dài bằng kỳ này; `period.currentTo` là 00:00 ngày sau `to`.
- [ ] **B8.** `docker start tourism-v2-postgres-1` (nếu ngủ) rồi
  `pnpm turbo run test:int --filter=@tourism/api` → PASS.
- [ ] **B9.** `pnpm gate` xanh (typecheck cả monorepo).
- [ ] **B10.** Commit: `feat(contract+api+admin): admin.stats.bookings nhận khoảng ngày — stat card ăn theo bộ lọc`.
- [ ] **B11.** Kiểm trailer.

---

## Task 4 — Caption in ngày thật + dòng khoảng ngày trên hàng card

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `admin.stats`)
- Modify: `apps/admin/src/lib/stats-view.ts`
- Modify: `apps/admin/src/components/kit/stat-card.tsx`
- Modify: `apps/admin/src/app/(admin)/bookings/page.tsx`
- Test: `apps/admin/src/lib/stats-view.spec.ts`, `components/kit/stat-card.spec.tsx`

**Interfaces — Produces:**
```ts
// stats-view.ts
/** '2026-09-01T00:00:00Z' + '2026-10-01T00:00:00Z' → 'Sep 1 – Sep 30, 2026' */
export function statsRangeLabel(fromIso: string, toIso: string): string
/** Dòng khoảng ngày cho cả hàng card; `undefined` khi kỳ là cửa sổ TRƯỢT
 *  (currentTo === generatedAt) — lúc đó in ngày cụ thể sẽ cũ đi từng phút. */
export function statsPeriodLabel(period: StatsPeriod): string | undefined
// i18n
messages.admin.stats.comparisonRange(previous: string, range: string): string
messages.admin.stats.periodLabel(range: string): string
```

- [ ] **B1.** Test `stats-view`:

```ts
it('có bộ lọc: caption in ngày thật thay vì "prior 28 days"', () => {
  const cards = toBookingsStatCards({
    ...bookingsStats,
    period: {
      windowDays: 30,
      previousFrom: '2026-08-02T00:00:00.000Z',
      currentFrom: '2026-09-01T00:00:00.000Z',
      currentTo: '2026-10-01T00:00:00.000Z',
      generatedAt: '2026-09-04T10:30:00.000Z',
    },
  });
  expect(cards[0]?.caption).toBe('vs $900.00 · Aug 2 – Aug 31');
});

it('không lọc (currentTo === generatedAt): giữ câu "prior N days"', () => {
  const cards = toBookingsStatCards(bookingsStats);
  expect(cards[0]?.caption).toBe('vs $900.00 prior 28 days');
});
```

- [ ] **B2.** Test `statsRangeLabel`: `('2026-09-01T00:00:00.000Z',
  '2026-10-01T00:00:00.000Z')` → `'Sep 1 – Sep 30, 2026'` (mốc cuối **trừ một
  ngày** để in ngày cuối TÍNH VÀO, không phải 00:00 ngày kế); ca kỳ vắt qua
  năm in đủ hai năm.
- [ ] **B3.** Chạy `pnpm turbo run test --filter=@tourism/admin -- stats-view` → FAIL.
- [ ] **B4.** i18n: thêm `comparisonRange` và `periodLabel`; JSDoc tiếng Việt
  nói rõ khi nào dùng câu nào.
- [ ] **B5.** `stats-view.ts`: `statsRangeLabel` (format UTC,
  `Intl.DateTimeFormat` cache như `COUNT_FORMATTER`) và `statsPeriodLabel`;
  `toBookingsStatCards` chọn caption theo `period.currentTo === period.generatedAt`.
- [ ] **B6.** `StatCardRow` nhận `period?: string` — render một dòng trên
  lưới card; test kit: có prop thì hiện, không có thì không thêm node nào (sáu
  vùng kia không đổi).
- [ ] **B7.** `bookings/page.tsx` truyền `period={statsPeriodLabel(stats.period)}`.
- [ ] **B8.** `pnpm gate` xanh.
- [ ] **B9.** Commit: `feat(admin+i18n): caption stat card in đúng khoảng ngày đang lọc`.
- [ ] **B10.** Kiểm trailer.

---

## Task 5 — Kit: `unknownItem` lên `ToolbarFilterMenu`

Hai vùng (`/payment-events`, `/subscribers`) đang tự dựng "nhóm mục lạ" và đặt
nó ở **hai vị trí khác nhau**. Lên kit thì phải chốt một vị trí: **cuối cùng**,
dưới separator sau mọi nhóm thật — thứ tự đọc là "tất cả → tập chính quy →
ngoại lệ". `/subscribers` vì thế đổi vị trí mục lạ (từ đầu xuống cuối); ghi
vào báo cáo vì đây là thay đổi NHÌN THẤY.

**Files:**
- Modify: `apps/admin/src/components/kit/toolbar-filter-menu.tsx`
- Modify: `apps/admin/src/components/payment-events/payment-events-type-menu.tsx`
- Modify: `apps/admin/src/components/subscribers/subscribers-source-menu.tsx`
- Test: `apps/admin/src/components/kit/toolbar-filter-menu.spec.tsx`

**Interfaces — Produces:**
```ts
ToolbarFilterMenu(props: { …, unknownItem?: ToolbarFilterMenuItem })
```

- [ ] **B1.** Test kit: `unknownItem` render sau mọi nhóm, có separator riêng;
  vắng thì không thêm separator nào; nút trigger đọc ra nhãn của `unknownItem`
  khi `value` khớp nó.
- [ ] **B2.** Chạy → FAIL.
- [ ] **B3.** Thêm prop + JSDoc (vì sao cuối, không phải đầu).
- [ ] **B4.** Hai vùng bỏ khối dựng nhóm tay, truyền `unknownItem`.
- [ ] **B5.** `pnpm gate` xanh (spec hai vùng còn xanh).
- [ ] **B6.** Commit: `refactor(admin): unknownItem lên kit ToolbarFilterMenu, mục lạ đứng một chỗ`.
- [ ] **B7.** Kiểm trailer.

---

## Task 6 — Kit: `LabelValueRow` thay 6 bản chép `dt/dd`

Sáu bản, khác nhau đúng hai thứ: **bề rộng cột nhãn** (8/9/10rem) và **có
`wrap-anywhere` ở cột nhãn hay không**. Class Tailwind phải TĨNH nên bề rộng
là biến thể khai sẵn, không phải chuỗi truyền vào (cùng cách `GRID_COLUMNS`
của `stat-card.tsx`).

**Files:**
- Create: `apps/admin/src/components/kit/label-value-row.tsx`
- Create: `apps/admin/src/components/kit/label-value-row.spec.tsx`
- Modify: `app/(admin)/bookings/[code]/page.tsx` (`Row`, 9rem → `md`),
  `app/(admin)/enquiries/[id]/page.tsx`, `components/bookings/refund-panel.tsx`
  (`ConfirmRow`), `components/kit/confirm-write-dialog.tsx`,
  `components/kit/json-drawer.tsx` (`PayloadRow` 10rem + nhãn wrap, và
  `JsonDrawerField`)

**Interfaces — Produces:**
```ts
export function LabelValueRow(props: {
  label: string;
  value: React.ReactNode;
  /** Bề rộng cột nhãn: 'sm' 8rem (mặc định) · 'md' 9rem · 'lg' 10rem. */
  width?: 'sm' | 'md' | 'lg';
  /** `wrap-anywhere` cho CẢ cột nhãn — nhãn mang đường dẫn sâu. */
  wrapLabel?: boolean;
}): React.ReactElement
```

- [ ] **B1.** Test: mặc định ra `grid-cols-[8rem_minmax(0,1fr)]`; `width="lg"`
  ra `10rem`; `wrapLabel` thêm `wrap-anywhere` vào `<dt>`; `value` nhận
  `ReactNode` (render được một fragment có `<span>`).
- [ ] **B2.** Chạy → FAIL.
- [ ] **B3.** Viết component + JSDoc (vì sao map class tĩnh; `dd` LUÔN
  `wrap-anywhere` — bài học tràn chữ 03/09).
- [ ] **B4.** Thay 6 chỗ dùng. `PayloadRow` giữ phần `raw` bằng cách truyền
  `value` là fragment, và tự bọc `text-muted-foreground` khi `field.muted` —
  kit KHÔNG mọc thêm prop cho một consumer.
- [ ] **B5.** `pnpm gate` xanh (spec `json-drawer`/`confirm-write-dialog` còn xanh).
- [ ] **B6.** Commit: `refactor(admin): tách LabelValueRow lên kit, thay 6 bản chép dt/dd`.
- [ ] **B7.** Kiểm trailer.

---

## Task 7 — Gọt JSDoc kể lịch sử ở 5 file `*-menu.tsx`

JSDoc năm file này đang kể **trình tự các đợt** ("đợt 1 … đợt 2 cùng ngày …
đợt 3", "Trước 03/09 là `ToolbarSelect`"). Lịch sử là việc của CHANGELOG và
git; JSDoc phải nói **hiện trạng và lý do còn hiệu lực**. Giữ nguyên mọi lý do
kỹ thuật (ba chỗ registry không lo hộ, tiền tố `v:`, mục tạm, luật icon) —
chỉ cắt phần trần thuật thời gian.

**Files:** `components/kit/toolbar-filter-menu.tsx`,
`components/outbox/outbox-type-menu.tsx`,
`components/payment-events/payment-events-type-menu.tsx`,
`components/subscribers/subscribers-source-menu.tsx`,
`components/reports/reports-month-menu.tsx`

- [ ] **B1.** Gọt từng file; giữ trỏ tới `design/mockups/outbox-type-menu.src.html`
  và spec P4c §2.6 (đó là nguồn, không phải trần thuật).
- [ ] **B2.** `pnpm gate` xanh (không đổi code, chỉ comment — nhưng Biome vẫn
  phải xanh).
- [ ] **B3.** Commit: `docs(admin): gọt JSDoc kể lịch sử ở 5 menu lọc, giữ lý do còn hiệu lực`.
- [ ] **B4.** Kiểm trailer.

---

## Task 8 — Docs sweep (luật 13)

- [ ] **B1.** Entry `docs/CHANGELOG.md` cho đợt này: ngày · hash · nội dung ·
  số test. **Không dòng nào bắt đầu bằng `+`** ở cột 0 (gotcha CHANGELOG).
- [ ] **B2.** Xoá mục 3 và mục 4 khỏi "Bàn giao — còn treo" 04/09? **KHÔNG** —
  entry cũ là bản ghi lịch sử bất biến. Entry MỚI nói rõ hai mục đó nay đã
  đóng và đóng thế nào.
- [ ] **B3.** Cập nhật dòng P4c trong `docs/README.md` (trỏ nhánh này) và
  thêm **plan này** vào bảng Plans của bản đồ — doc không nằm trong bản đồ
  coi như không tồn tại (luật 13).
- [ ] **B4.** `git diff` các file `.md` TRƯỚC khi `git add` (Biome bỏ qua `.md`,
  markdownlint có thể đổi `+` cột 0 trong entry cũ).
- [ ] **B5.** `./scripts/docs-freshness.sh`.
- [ ] **B6.** Commit: `docs: entry CHANGELOG cho đợt điều chỉnh backend #1`.
- [ ] **B7.** Kiểm trailer.

---

## Nghiệm thu cuối

- [ ] `pnpm gate:int` xanh. Build web prerender cần API sống ở `:3001` — dùng
  API dev của user nếu đang chạy, không thì dựng API tạm theo công thức CI
  trên docker DB (**KHÔNG** `.env.local` — nó trỏ Supabase prod), kill sau
  bằng `kill $(cat pid)`, không `pkill`.
- [ ] Báo cáo: từng mục đổi gì/vì sao · endpoint + contract đổi · ADR/AMEND ·
  không migration nên **không cần** session gốc deploy Supabase · số test ·
  việc còn treo.
- [ ] KHÔNG merge, KHÔNG push.
