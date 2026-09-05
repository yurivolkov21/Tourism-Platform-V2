# Plan — Mô hình tài chính cho báo cáo tháng, và xuất Excel

> Thi công **inline trong session này**, KHÔNG subagent (user chốt 13/08).
> Nhánh `fix/p4c-backend-logic`. **KHÔNG merge, KHÔNG push** — site đang chạy
> production.

**Mục tiêu:** `/reports` trả lời được *"tháng này lãi bao nhiêu"* — có giá vốn,
thuế, doanh thu ghi nhận theo ngày chuyến chạy — và xuất ra một file Excel có
định dạng thay cho CSV hai cột.

**Nguồn sự thật:** [ADR-0033](../adr/0033-financial-model.md) (mô hình tài
chính) và [ADR-0034](../adr/0034-excel-report-export.md) (Excel). Plan này chỉ
nói **làm thế nào**; mọi câu "vì sao" tra ở hai ADR đó.

**Kiến trúc:** Báo cáo mọc thêm một cột số liệu neo `departure_end_date`, đứng
cạnh cột dòng tiền neo `paid_at` đang có — không đổi định nghĩa nào đang chạy.
Giá vốn khai ở bảng mới `tour_cost_items` với cờ `PER_PERSON`/`PER_DEPARTURE`,
đóng băng vào `bookings.cost_per_person` (lúc đặt) và
`tour_departures.fixed_cost_amount` (lúc tạo chuyến). Phép tính tài chính là
hàm THUẦN trong `finance-math.ts`, test không cần DB; hai câu aggregate mới đi
đường `$queryRaw` như `enquiryWonCount` đã làm.

**Tech stack:** Prisma 7 · Zod v4 · NestJS + oRPC · Next 16 App Router ·
**ExcelJS** (dep mới, ADR-0034 §1) · Vitest.

## Ràng buộc toàn cục

- **Luật 4 — TDD** trên logic thuần: test TRƯỚC, ≥80% trên logic mới.
- **Luật 6** — tokens-only, không hex.
- **Luật 7** — mọi copy user-facing ở `@tourism/i18n`, tiếng Anh.
- **Luật 8** — comment và JSDoc **tiếng Việt**; identifier tiếng Anh.
- **Luật 11** — `pnpm gate:int` xanh trước khi khai xong (không phải `gate` trần).
- **Luật 12** — Conventional Commits, message **tiếng Việt có dấu**, KHÔNG AI
  attribution. Sau MỖI commit chạy
  `git log -1 --format=%B | grep -i "co-authored\|generated"` — có thì amend bỏ.
- **Luật 13** — docs sweep ở Task 10: CHANGELOG + bản đồ `docs/README.md`.
- **Migration chỉ THÊM file mới.** Không sửa `migration.sql` đã apply, kể cả
  comment (checksum → drift). `prisma migrate dev` **chỉ áp docker local**;
  Supabase cần `migrate deploy` tường minh và **chỉ chạy khi user yêu cầu**.
- **Dev/prod dùng chung Supabase.** Không seed/xoá dữ liệu thật, không in giá
  trị env.
- **Không tự chạy dev server** — user giữ `:3000`/`:3001`/`:3002`.
- **Tiền không bao giờ đi qua float.** `Prisma.Decimal` trong bộ nhớ, chuỗi
  decimal trên contract. Chỗ `Number()` duy nhất được phép là lớp ghi ô Excel
  (ADR-0034 §2).
- Docker Postgres `tourism-v2-postgres-1` cho int test; `docker start` nếu ngủ.

## Cạm bẫy đã biết (đọc trước khi gõ)

1. **`DecimalStringSchema` KHÔNG nhận dấu trừ** (`/^\d+(\.\d+)?$/`).
   `grossProfit` và `netProfit` **có thể âm**. Task 2 thêm
   `SignedDecimalStringSchema` — dùng nhầm cái cũ là runtime 500 ở tháng lỗ.
2. **OOM khi nhét schema vào base schema dùng rộng.** `InferContractRouterInputs/
   Outputs` suy kiểu cho TOÀN router; vòng review 05/09 đã làm `contract.spec.ts`
   OOM vì nhúng `MyReviewSchema` vào `BookingSchema`. Field mới của plan này
   **chỉ** vào `AdminMonthlyReportSchema` (một route dùng) — không đụng
   `BookingSchema`/`TourCardSchema`.
3. **`.refine()` phải giữ `.shape`** của ZodObject (điều kiện sống của
   `ZodSmartCoercionPlugin`) — không đụng tới ở plan này, nhưng đừng phá.
4. **`/tours` trong admin `enabled: false`** — chưa có form nhập giá vốn. Dữ
   liệu giá vốn ở plan này đến từ **seed** (Task 7). Màn nhập liệu là việc của
   phase `/tours`; §7 ADR-0033 (ghế hoà vốn) hoãn cùng phase đó vì hôm nay
   không có màn nào hiển thị nó.
5. **Turbo cache che test đỏ.** Nghi ngờ thì `pnpm turbo run test --force`.

## Bản đồ file

| File | Vai trò sau đợt này |
| --- | --- |
| `apps/admin/src/lib/reviews-query.ts` | thêm `source`/`rating` vào `ReviewsQuery`, patch, và input contract |
| `apps/admin/src/components/reviews/reviews-toolbar.tsx` | thêm `ReviewsSourceFilter` + `ReviewsRatingFilter` |
| `apps/admin/src/app/(admin)/reviews/page.tsx` | lắp hai ô lọc mới vào khe toolbar |
| `libs/shared/contract/src/schemas/catalog.ts` | thêm `SignedDecimalStringSchema` |
| `libs/shared/contract/src/schemas/reports.ts` | `AdminMonthlyReportSchema` mọc 12 field tài chính |
| `apps/api/prisma/schema.prisma` | 2 enum + model `TourCostItem` + 2 cột snapshot |
| `apps/api/prisma/migrations/<ts>_tour_cost_model/migration.sql` | migration MỚI |
| `apps/api/src/modules/catalog/tour-costs.ts` | **MỚI** — hàm thuần cộng giá vốn |
| `apps/api/src/config/env.ts` | 3 biến tỉ lệ tài chính |
| `apps/api/src/modules/stats/finance-math.ts` | **MỚI** — thuế trên margin, phí, biên gộp |
| `apps/api/src/modules/stats/stats-aggregates.ts` | 2 câu aggregate mới |
| `apps/api/src/modules/stats/reports.service.ts` | ghép cột kết quả kinh doanh |
| `apps/api/src/modules/bookings/bookings.service.ts` | snapshot `costPerPerson` lúc tạo booking |
| `apps/api/prisma/fixtures/catalog/tour-costs.ts` | **MỚI** — giá vốn seed cho 30 tour |
| `apps/api/prisma/seed.ts` | insert cost item, set `costPrice` + `fixedCostAmount` |
| `libs/shared/i18n/src/lib/messages.ts` | copy P&L + nhãn sheet Excel |
| `apps/admin/src/lib/reports-view.ts` | hàng P&L + stat card mới |
| `apps/admin/src/components/reports/report-tables.tsx` | bảng P&L thứ ba |
| `apps/admin/src/lib/xlsx.ts` | **MỚI** — dựng workbook, thuần |
| `apps/admin/src/lib/export-route.ts` | thêm `xlsxExportResponse` |
| `apps/admin/src/app/(admin)/reports/export/route.ts` | trả `.xlsx` |
| `apps/admin/src/lib/csv.ts` | JSDoc bỏ vế "không thêm thư viện xlsx" (đã sai) |

---

### Task 0: Trả nợ `/reviews` — hai ô lọc `source` và `rating` ✅ *(xong 05/09)*

Server đã lọc được cả hai (`AdminReviewsQuerySchema` khai `source`/`rating`,
service lọc thật) nhưng toolbar không có ô nào bấm. Task này **chỉ đụng admin**
— không contract, không API.

**Files:**
- Modify: `apps/admin/src/lib/reviews-query.ts`
- Modify: `apps/admin/src/components/reviews/reviews-toolbar.tsx`
- Modify: `apps/admin/src/app/(admin)/reviews/page.tsx`
- Test: `apps/admin/src/lib/reviews-query.spec.ts`

**Interfaces:**
- Consumes: `ToolbarFilterMenu` (kit đã có, 4 consumer), `ALL_FILTER_VALUE`.
- Produces: `ReviewsQuery.source?: 'VERIFIED' | 'CURATED'`,
  `ReviewsQuery.rating?: number`; `ReviewsHrefPatch` nhận cả hai với `null` = xoá.

- [ ] **Bước 1: test đỏ cho parse + href**

Thêm vào `apps/admin/src/lib/reviews-query.spec.ts`:

```ts
describe('source và rating', () => {
  it('đọc source hợp lệ, bỏ giá trị lạ', () => {
    expect(parseReviewsSearchParams({ source: 'CURATED' }).source).toBe('CURATED');
    expect(parseReviewsSearchParams({ source: 'curated' }).source).toBeUndefined();
    expect(parseReviewsSearchParams({ source: 'NOPE' }).source).toBeUndefined();
  });

  it('rating chỉ nhận số nguyên 1..5', () => {
    expect(parseReviewsSearchParams({ rating: '4' }).rating).toBe(4);
    expect(parseReviewsSearchParams({ rating: '0' }).rating).toBeUndefined();
    expect(parseReviewsSearchParams({ rating: '6' }).rating).toBeUndefined();
    expect(parseReviewsSearchParams({ rating: '4.5' }).rating).toBeUndefined();
  });

  it('đổi source đặt lại trang về 1 và giữ filter khác', () => {
    const current = { page: 3, limit: 20, state: 'pending' as const, rating: 5 };
    const href = reviewsHref(current, { source: 'VERIFIED' });
    expect(href).toContain('source=VERIFIED');
    expect(href).toContain('rating=5');
    expect(href).not.toContain('page=');
  });

  it('null xoá filter khỏi URL', () => {
    const href = reviewsHref({ page: 1, limit: 20, source: 'CURATED' }, { source: null });
    expect(href).not.toContain('source=');
  });
});
```

- [ ] **Bước 2: chạy để thấy đỏ**

```bash
pnpm turbo run test --filter=@tourism/admin -- reviews-query
```
Kỳ vọng: FAIL — `source`/`rating` chưa tồn tại trên `ReviewsQuery`.

- [ ] **Bước 3: cài đặt trong `reviews-query.ts`**

Thêm parser thuần cạnh `parseReviewState`:

```ts
/** Hai nguồn review của contract; giá trị lạ → null (cùng khoan dung `parseReviewState`). */
export type ReviewSourceFilter = 'VERIFIED' | 'CURATED';
const REVIEW_SOURCES: readonly ReviewSourceFilter[] = ['VERIFIED', 'CURATED'];

export function parseReviewSource(value: string | undefined): ReviewSourceFilter | null {
  return REVIEW_SOURCES.find((source) => source === value) ?? null;
}

/**
 * `RatingSchema` của contract là `z.int().min(1).max(5)` — parse ở đây phải
 * khoá ĐÚNG chừng ấy, không rộng hơn: một `?rating=6` lọt lên API là 400 ném
 * vào mặt admin cho một chữ gõ nhầm trên URL.
 */
export function parseReviewRating(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return null;
  return parsed;
}
```

`ReviewsQuery` thêm `source?: ReviewSourceFilter; rating?: number;`
`ReviewsHrefPatch` thêm `source?: ReviewSourceFilter | null; rating?: number | null;`

Trong `parseReviewsSearchParams`, sau khối `state`:

```ts
  const source = parseReviewSource(firstParam(raw.source));
  const rating = parseReviewRating(firstParam(raw.rating));
```
rồi spread `...(source ? { source } : {})` và `...(rating ? { rating } : {})`.

Trong `reviewsHref`, cạnh `state`:

```ts
  const source = pickPatch(patch.source, current.source);
  const rating = pickPatch(patch.rating, current.rating);
```
thêm hai vế vào `scopeChanged` (`patch.source !== undefined || patch.rating !== undefined`)
và ghi lên params: `if (source) params.set('source', source);` ·
`if (rating) params.set('rating', String(rating));`

Trong `toReviewsListInput`, thêm hai dòng map tường minh:
```ts
    ...(query.source ? { source: query.source } : {}),
    ...(query.rating ? { rating: query.rating } : {}),
```

- [ ] **Bước 4: test xanh**

```bash
pnpm turbo run test --filter=@tourism/admin -- reviews-query
```
Kỳ vọng: PASS.

- [ ] **Bước 5: hai ô lọc trong toolbar**

Copy cho `libs/shared/i18n/src/lib/messages.ts`, trong khối
`admin.reviews.list`:

```ts
      sourceLabel: 'Source',
      sourceAll: 'All sources',
      sourceVerified: 'From a booking',
      sourceCurated: 'Written by staff',
      ratingLabel: 'Rating',
      ratingAll: 'All ratings',
      ratingStars: (n: number) => `${n} ${n === 1 ? 'star' : 'stars'}`,
```

Trong `reviews-toolbar.tsx`, thêm hai component dùng kit `ToolbarFilterMenu`
(cùng khuôn `/subscribers`):

```tsx
export function ReviewsSourceFilter({ query }: { query: ReviewsQuery }) {
  const router = useRouter();
  return (
    <ToolbarFilterMenu
      label={t.sourceLabel}
      value={query.source ?? ALL}
      allItem={{ value: ALL, label: t.sourceAll }}
      groups={[
        {
          key: 'source',
          items: [
            { value: 'VERIFIED', label: t.sourceVerified, icon: BadgeCheckIcon },
            { value: 'CURATED', label: t.sourceCurated, icon: PenLineIcon },
          ],
        },
      ]}
      onSelect={(next) => router.push(reviewsHref(query, { source: parseReviewSource(next) }))}
    />
  );
}

export function ReviewsRatingFilter({ query }: { query: ReviewsQuery }) {
  const router = useRouter();
  return (
    <ToolbarFilterMenu
      label={t.ratingLabel}
      value={query.rating ? String(query.rating) : ALL}
      allItem={{ value: ALL, label: t.ratingAll }}
      groups={[
        {
          key: 'rating',
          // 5 sao trước: người duyệt tìm bài khen giả nhiều hơn tìm bài 1 sao.
          items: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: t.ratingStars(n) })),
        },
      ]}
      onSelect={(next) => router.push(reviewsHref(query, { rating: parseReviewRating(next) }))}
    />
  );
}
```

Trong `page.tsx`, lắp hai component vào cùng khe với `ReviewsStateTabs`.

- [ ] **Bước 6: gate nhanh**

```bash
pnpm turbo run test typecheck --filter=@tourism/admin && pnpm lint
```
Kỳ vọng: tất cả xanh.

- [ ] **Bước 7: commit**

```bash
git add apps/admin/src libs/shared/i18n/src
git commit -m "feat(admin+i18n): /reviews có ô lọc nguồn và số sao

Hai tham số này server đã lọc thật từ đầu (AdminReviewsQuerySchema khai
source/rating, service lọc trên cả hai) nhưng toolbar không có ô nào để
bấm — ngược đúng cái luật mà JSDoc của chính toolbar viện ra."
git log -1 --format=%B | grep -i "co-authored\|generated"
```
Kỳ vọng: grep không in gì. Có in thì `git commit --amend` bỏ dòng đó.

---

### Task 1: Hàm thuần cộng giá vốn ✅ *(xong 05/09)*

**Files:**
- Create: `apps/api/src/modules/catalog/tour-costs.ts`
- Test: `apps/api/src/modules/catalog/tour-costs.spec.ts`

**Interfaces:**
- Produces: `perPersonTotal(items)`, `perDepartureTotal(items)`,
  `derivedCostPrice(items, maxGroupSize)` — cả ba nhận
  `readonly { amount: Prisma.Decimal; basis: TourCostBasis }[]`, trả
  `Prisma.Decimal`. Task 5/7 và seed đều gọi.

- [ ] **Bước 1: viết test đỏ**

```ts
import { Prisma } from '../../generated/prisma/client.js';
import { TourCostBasis } from '../../generated/prisma/enums.js';
import { derivedCostPrice, perDepartureTotal, perPersonTotal } from './tour-costs.js';

const d = (v: string) => new Prisma.Decimal(v);
const perPerson = (v: string) => ({ amount: d(v), basis: TourCostBasis.PER_PERSON });
const perDeparture = (v: string) => ({ amount: d(v), basis: TourCostBasis.PER_DEPARTURE });

describe('tour-costs', () => {
  it('danh sách rỗng cho 0, không phải null', () => {
    expect(perPersonTotal([]).toFixed(2)).toBe('0.00');
    expect(perDepartureTotal([]).toFixed(2)).toBe('0.00');
  });

  it('mỗi hàm chỉ cộng dòng thuộc cờ của nó', () => {
    const items = [perPerson('30.00'), perDeparture('400.00'), perPerson('85.50')];
    expect(perPersonTotal(items).toFixed(2)).toBe('115.50');
    expect(perDepartureTotal(items).toFixed(2)).toBe('400.00');
  });

  it('costPrice = biến đổi + cố định chia số khách tối đa', () => {
    // 115.50 + 400/20 = 135.50
    const items = [perPerson('30.00'), perPerson('85.50'), perDeparture('400.00')];
    expect(derivedCostPrice(items, 20).toFixed(2)).toBe('135.50');
  });

  it('làm tròn HALF_UP về 2 chữ số, khớp Decimal(14,2) của cột', () => {
    // 100/3 = 33.333… → 33.33
    expect(derivedCostPrice([perDeparture('100.00')], 3).toFixed(2)).toBe('33.33');
    // 100/8 = 12.5 → giữ nguyên; +0.005 để chạm biên làm tròn
    expect(derivedCostPrice([perPerson('0.005'), perDeparture('100.00')], 8).toFixed(2)).toBe('12.51');
  });

  it('maxGroupSize <= 0 thì bỏ qua phần cố định thay vì chia cho 0', () => {
    const items = [perPerson('30.00'), perDeparture('400.00')];
    expect(derivedCostPrice(items, 0).toFixed(2)).toBe('30.00');
  });
});
```

- [ ] **Bước 2: chạy để thấy đỏ**

```bash
pnpm turbo run test --filter=@tourism/api -- tour-costs
```
Kỳ vọng: FAIL — `Cannot find module './tour-costs.js'`.

- [ ] **Bước 3: cài đặt**

```ts
import { Prisma } from '../../generated/prisma/client.js';
import { TourCostBasis } from '../../generated/prisma/enums.js';

/**
 * Cộng giá vốn của một tour — THUẦN, không đụng Prisma client, nên mọi biên
 * làm tròn test được mà không cần DB (ADR-0033 §2).
 *
 * Ba hàm chứ không một: `perPersonTotal` và `perDepartureTotal` là hai vế mà
 * BÁO CÁO dùng tách riêng (chi phí cố định ở lại khi khách huỷ, chi phí biến
 * đổi đi theo khách — ADR-0033 §4), còn `derivedCostPrice` là con số BÁN HÀNG
 * gộp cả hai. Gộp ba thành một là mất đúng cái phân biệt khiến §4 nói được
 * thành câu.
 */

/** Chỉ hai field này là đủ để cộng — nhận rộng để seed và service cùng gọi được. */
export interface CostItemLike {
  amount: Prisma.Decimal;
  basis: TourCostBasis;
}

const ZERO = new Prisma.Decimal(0);

function sumWhere(items: readonly CostItemLike[], basis: TourCostBasis): Prisma.Decimal {
  return items.reduce((sum, item) => (item.basis === basis ? sum.add(item.amount) : sum), ZERO);
}

/** Σ dòng theo ĐẦU KHÁCH — tiền nhân với số ghế của một booking. */
export function perPersonTotal(items: readonly CostItemLike[]): Prisma.Decimal {
  return sumWhere(items, TourCostBasis.PER_PERSON);
}

/** Σ dòng theo CHUYẾN — tính MỘT lần cho mỗi chuyến đã chạy, không nhân ghế. */
export function perDepartureTotal(items: readonly CostItemLike[]): Prisma.Decimal {
  return sumWhere(items, TourCostBasis.PER_DEPARTURE);
}

/**
 * `Tour.costPrice` — công thức operator thật: *chi phí cố định ÷ số khách +
 * chi phí biến đổi mỗi khách*. Mẫu số là `maxGroupSize`, tức cách đọc LẠC
 * QUAN (chuyến bán nửa ghế thì giá vốn thật cao hơn) — giới hạn đã ghi ở
 * ADR-0033 "Giới hạn đã biết" #1.
 *
 * `maxGroupSize <= 0` không thể xảy ra với dữ liệu hợp lệ, nhưng chia cho 0
 * trong `Prisma.Decimal` ném lỗi — và một tour cấu hình sai không được phép
 * làm chết đường TẠO BOOKING. Bỏ qua phần cố định là cách hỏng an toàn: con
 * số thấp hơn sự thật, không phải một exception giữa transaction.
 */
export function derivedCostPrice(
  items: readonly CostItemLike[],
  maxGroupSize: number,
): Prisma.Decimal {
  const variable = perPersonTotal(items);
  if (maxGroupSize <= 0) return variable.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const fixedShare = perDepartureTotal(items).div(maxGroupSize);
  return variable.add(fixedShare).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
```

- [ ] **Bước 4: test xanh**

```bash
pnpm turbo run test --filter=@tourism/api -- tour-costs
```
Kỳ vọng: PASS 5/5.

⚠️ Test này import `TourCostBasis` từ Prisma client sinh ra — **Task 3 phải
chạy `prisma generate` trước khi test xanh được**. Nếu chạy Task 1 trước Task 3
thì để test đỏ và commit chung ở Task 3.

- [ ] **Bước 5: commit** (nếu Task 3 đã xong; ngược lại gộp vào commit Task 3)

```bash
git add apps/api/src/modules/catalog/tour-costs.ts apps/api/src/modules/catalog/tour-costs.spec.ts
git commit -m "feat(api): hàm thuần cộng giá vốn tour theo hai cờ cố định và biến đổi"
git log -1 --format=%B | grep -i "co-authored\|generated"
```

---

### Task 2: Contract — 12 field tài chính cho báo cáo tháng ✅ *(xong 05/09)*

**Files:**
- Modify: `libs/shared/contract/src/schemas/catalog.ts` (thêm `SignedDecimalStringSchema`)
- Modify: `libs/shared/contract/src/schemas/reports.ts`
- Test: `libs/shared/contract/src/schemas/reports.spec.ts`

**Interfaces:**
- Produces: `AdminMonthlyReportSchema` có thêm `recognizedRevenue`,
  `cogsVariable`, `cogsFixed`, `cogsTotal`, `grossProfit`, `grossMarginPct`,
  `taxRate`, `taxAmount`, `paymentFees`, `netProfit`, `departuresRun`,
  `costDataMissing`. Task 6 (API) và Task 8/9 (admin) đều đọc.

⚠️ **KHÔNG nhúng schema nào của task này vào `BookingSchema`/`TourCardSchema`**
— xem Cạm bẫy #2.

- [ ] **Bước 1: test đỏ**

Thêm vào `libs/shared/contract/src/schemas/reports.spec.ts`:

```ts
const base = {
  month: '2026-09', from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z',
  generatedAt: '2026-09-30T12:00:00.000Z', currency: 'USD',
  revenue: '1000.00', paidBookings: 4, newBookings: 4,
  bookingsByStatus: BookingStatusSchema.options.map((status) => ({ status, count: 0 })),
  refundedTotal: '0.00', refunds: 0,
  cancellationsApproved: 0, cancellationsDenied: 0, reviewsApproved: 0,
  recognizedRevenue: '1000.00', cogsVariable: '400.00', cogsFixed: '200.00',
  cogsTotal: '600.00', grossProfit: '400.00', grossMarginPct: 0.4,
  taxRate: 0.1, taxAmount: '36.36', paymentFees: '30.20', netProfit: '333.44',
  departuresRun: 2, costDataMissing: 0,
};

it('nhận lợi nhuận ÂM — tháng lỗ là một tháng hợp lệ', () => {
  const parsed = AdminMonthlyReportSchema.safeParse({
    ...base, grossProfit: '-150.00', netProfit: '-186.36', grossMarginPct: -0.15,
  });
  expect(parsed.success).toBe(true);
});

it('doanh thu và giá vốn KHÔNG được âm', () => {
  expect(AdminMonthlyReportSchema.safeParse({ ...base, cogsTotal: '-1.00' }).success).toBe(false);
  expect(AdminMonthlyReportSchema.safeParse({ ...base, recognizedRevenue: '-1.00' }).success).toBe(false);
});

it('grossMarginPct null khi không có chuyến nào chạy', () => {
  const parsed = AdminMonthlyReportSchema.safeParse({ ...base, grossMarginPct: null });
  expect(parsed.success).toBe(true);
});

it('taxRate không âm', () => {
  expect(AdminMonthlyReportSchema.safeParse({ ...base, taxRate: -0.1 }).success).toBe(false);
});
```

- [ ] **Bước 2: chạy để thấy đỏ**

```bash
pnpm turbo run test --filter=@tourism/contract -- reports
```
Kỳ vọng: FAIL — schema chưa có field mới nên `-150.00` bị strip chứ không lỗi;
test "âm hợp lệ" có thể pass giả, còn test "cogsTotal âm bị chặn" FAIL. Đọc kỹ
dòng nào đỏ.

- [ ] **Bước 3: `SignedDecimalStringSchema` trong `catalog.ts`**

Đặt ngay dưới `DecimalStringSchema`:

```ts
/**
 * Decimal chuỗi CÓ THỂ ÂM — cho những con số mà dấu trừ là một câu trả lời
 * hợp lệ, không phải lỗi dữ liệu: lợi nhuận gộp và lợi nhuận ròng của một
 * tháng lỗ (ADR-0033).
 *
 * Tách khỏi `DecimalStringSchema` chứ không nới lỏng nó: tiền THU và giá VỐN
 * âm là dữ liệu hỏng và phải bị chặn ở biên. Hai khái niệm, hai schema.
 */
export const SignedDecimalStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'expected a decimal string');
```

- [ ] **Bước 4: 12 field trong `reports.ts`**

Import `SignedDecimalStringSchema` cạnh `DecimalStringSchema`, rồi thêm vào
`AdminMonthlyReportSchema` sau `reviewsApproved`:

```ts
  // ── Kết quả kinh doanh (ADR-0033 §1) — neo NGÀY CHUYẾN KẾT THÚC, khác hẳn
  // mọi field ở trên (neo `paid_at`). Hai cách đọc đứng cạnh nhau, không thay
  // nhau; đọc §1 của ADR trước khi sửa bất cứ field nào dưới đây.
  /** Σ (`totalAmount` − đã hoàn) của booking đã đi, chuyến KẾT THÚC trong kỳ. */
  recognizedRevenue: DecimalStringSchema,
  /** Giá vốn theo đầu khách của chính tập booking ấy. */
  cogsVariable: DecimalStringSchema,
  /** Giá vốn theo chuyến — MỘT lần mỗi chuyến đã chạy, không nhân số ghế. */
  cogsFixed: DecimalStringSchema,
  /** `cogsVariable + cogsFixed`, in ra để hai vế kiểm chéo được trên giấy. */
  cogsTotal: DecimalStringSchema,
  /** `recognizedRevenue − cogsTotal`. **ÂM được** — tháng lỗ là tháng thật. */
  grossProfit: SignedDecimalStringSchema,
  /**
   * `grossProfit ÷ recognizedRevenue`, dạng tỉ lệ (0.4 = 40%).
   *
   * **`null` khi `recognizedRevenue` = 0** — không phải 0. Một tháng không có
   * chuyến nào chạy có biên gộp KHÔNG XÁC ĐỊNH; in `0.0%` là nói tháng ấy hoà
   * vốn trắng, một câu sai hoàn toàn khác.
   */
  grossMarginPct: z.number().nullable(),
  /**
   * Thuế suất đã dùng để ra `taxAmount`, dạng tỉ lệ. Đi kèm response vì biến
   * môi trường không có ngày hiệu lực (ADR-0033 §5): tờ báo cáo phải tự khai
   * nó được tính bằng mức nào, kẻo đọc lại sau khi đổi suất là một con số
   * khác mà không ai biết vì sao.
   */
  taxRate: z.number().nonnegative(),
  /** Thuế trên MARGIN, `max(0, grossProfit) × rate/(1+rate)` — margin âm thì 0. */
  taxAmount: DecimalStringSchema,
  /** Phí cổng thanh toán ước tính trên chính tập booking được ghi nhận. */
  paymentFees: DecimalStringSchema,
  /** `grossProfit − taxAmount − paymentFees`. CHƯA trừ chi phí vận hành. */
  netProfit: SignedDecimalStringSchema,
  /** Số chuyến đã chạy trong kỳ — mẫu số của `cogsFixed`, để kiểm chéo. */
  departuresRun: z.int().nonnegative(),
  /**
   * Số booking trong kỳ KHÔNG có `cost_per_person`. Hiện trên màn hình và
   * trong file: một báo cáo in "Lợi nhuận gộp $8,400" trong khi 12 booking
   * chưa khai giá vốn là một báo cáo nói dối (ADR-0033 §6).
   */
  costDataMissing: z.int().nonnegative(),
```

- [ ] **Bước 5: test xanh + kiểm OOM**

```bash
pnpm turbo run test typecheck --filter=@tourism/contract
```
Kỳ vọng: PASS, và **không** có `JavaScript heap out of memory`. Nếu OOM →
xem Cạm bẫy #2: có schema mới lọt vào một base schema dùng rộng.

- [ ] **Bước 6: commit**

```bash
git add libs/shared/contract/src
git commit -m "feat(contract): báo cáo tháng khai 12 field kết quả kinh doanh

DecimalStringSchema chặn dấu trừ nên lợi nhuận phải đi qua
SignedDecimalStringSchema mới — tháng lỗ là một tháng hợp lệ. Field mới
chỉ vào AdminMonthlyReportSchema (một route dùng), không đụng
BookingSchema: nhúng vào base schema dùng rộng là đường dẫn tới OOM của
contract.spec đã đo được ở vòng review 05/09."
git log -1 --format=%B | grep -i "co-authored\|generated"
```

---

### Task 3: Schema Prisma + migration ✅ *(xong 05/09)*

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_tour_cost_model/migration.sql` (Prisma sinh)

**Interfaces:**
- Produces: enum `TourCostBasis`/`TourCostCategory`, model `TourCostItem`,
  `Booking.costPerPerson`, `TourDeparture.fixedCostAmount` — Task 1, 5, 6, 7 dùng.

- [ ] **Bước 1: hai enum, đặt cạnh `TourDifficulty`**

```prisma
/// Một dòng giá vốn tính theo ĐẦU KHÁCH hay theo CHUYẾN (ADR-0033 §2).
/// Chính cờ này khiến luật huỷ nói được thành câu: xe vẫn chạy khi khách huỷ,
/// suất ăn của người ấy thì không ai gọi (§4).
enum TourCostBasis {
  PER_PERSON
  PER_DEPARTURE
}

/// Hạng mục giá vốn. Enum ĐÓNG chứ không chuỗi tự do: báo cáo sau này nhóm
/// theo hạng mục, mà nhóm theo chữ người gõ thì "Meals"/"meals"/"Ăn uống" là
/// ba nhóm.
enum TourCostCategory {
  TRANSPORT
  ACCOMMODATION
  MEALS
  GUIDE
  ACTIVITIES
  PERMITS
  INSURANCE
  OTHER
}
```

- [ ] **Bước 2: model + hai cột snapshot**

Thêm model sau `Tour`:

```prisma
/// Danh mục giá vốn của một tour (ADR-0033 §2). Tiền theo currency của TOUR —
/// cố ý không có cột currency riêng: thêm nó là mở cửa cho quy đổi ngoại tệ,
/// một hệ khác hẳn có tỉ giá và ngày hiệu lực.
model TourCostItem {
  id        String           @id @default(uuid()) @db.Uuid
  tourId    String           @map("tour_id") @db.Uuid
  category  TourCostCategory
  label     String           @db.VarChar(120)
  amount    Decimal          @db.Decimal(14, 2)
  basis     TourCostBasis
  sortOrder Int              @default(0) @map("sort_order")
  createdAt DateTime         @default(now()) @map("created_at")
  updatedAt DateTime         @updatedAt @map("updated_at")

  tour Tour @relation(fields: [tourId], references: [id], onDelete: Cascade)

  @@index([tourId, sortOrder])
  @@map("tour_cost_items")
}
```

`Tour` thêm quan hệ: `costItems TourCostItem[]`

`Booking` thêm, ngay dưới `unitPrice` (cùng khối snapshot audit H3):

```prisma
  /// Giá vốn theo ĐẦU KHÁCH, đóng băng lúc tạo booking (ADR-0033 §3). Null =
  /// tour chưa khai giá vốn lúc ấy — báo cáo phải NÓI RA là thiếu, không im
  /// lặng coi bằng 0. Cùng lý do `unit_price` ở trên: join sống thì sửa giá
  /// vốn hôm nay sẽ viết lại lợi nhuận của báo cáo tháng trước.
  costPerPerson      Decimal?        @map("cost_per_person") @db.Decimal(14, 2)
```

`TourDeparture` thêm, dưới `priceOverride`:

```prisma
  /// Giá vốn CỐ ĐỊNH của chuyến này, đóng băng lúc tạo chuyến từ tổng các
  /// dòng PER_DEPARTURE của tour; admin sửa đè được (mùa cao điểm xe đắt
  /// hơn). Ở đây chứ không cộng vào booking vì báo cáo tính nó MỘT lần cho
  /// mỗi chuyến đã chạy, bất kể bán được bao nhiêu ghế (ADR-0033 §4).
  fixedCostAmount Decimal? @map("fixed_cost_amount") @db.Decimal(14, 2)
```

- [ ] **Bước 3: sinh migration trên docker local**

```bash
docker start tourism-v2-postgres-1
cd apps/api && pnpm prisma migrate dev --name tour_cost_model
```
Kỳ vọng: tạo thư mục migration mới và in "Your database is now in sync with
your schema." ⚠️ Lệnh này **chỉ chạm docker local** (`prisma.config.ts` đọc
`.env`, không đọc `.env.local`) — Supabase KHÔNG tự nhận.

- [x] **Bước 4: CHECK đi một migration RIÊNG, KHÔNG nối vào file vừa sinh**

⚠️ **Bản đầu của plan này viết "nối vào cuối `migration.sql`" — SAI, và người
thi công đã dẫm phải.** `migrate dev` ở bước 3 đã APPLY file ấy, mà Prisma lưu
checksum từng migration; thêm một dòng là drift và lệnh kế tiếp đòi
`migrate reset` (mất sạch DB local). Đây đúng cái bẫy CLAUDE.md đã ghi thành
luật — plan không được dạy ngược lại nó.

Đường đúng:

```bash
cd apps/api && pnpm prisma migrate dev --create-only --name tour_cost_checks
```

rồi viết vào file MỚI ấy:

```sql
-- Giá vốn âm không có nghĩa nào, và một dấu trừ gõ nhầm sẽ làm lợi nhuận
-- PHÌNH LÊN chứ không nổ ra — kiểu sai không ai soi thấy trên một tờ báo cáo.
ALTER TABLE "tour_cost_items" ADD CONSTRAINT "tour_cost_items_amount_nonneg"
  CHECK (amount >= 0);

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cost_per_person_nonneg"
  CHECK (cost_per_person IS NULL OR cost_per_person >= 0);

ALTER TABLE "tour_departures" ADD CONSTRAINT "tour_departures_fixed_cost_nonneg"
  CHECK (fixed_cost_amount IS NULL OR fixed_cost_amount >= 0);
```

Rồi áp:
```bash
cd apps/api && pnpm prisma migrate dev
```
Kỳ vọng: apply `tour_cost_checks`, in "Your database is now in sync with your
schema."

⚠️ Sau khi một migration đã apply thì **KHÔNG bao giờ sửa file `migration.sql`
của nó nữa**, kể cả sửa comment — checksum. Muốn đổi gì thì viết migration MỚI.

*(Đợt thi công 05/09 đã chạy xong hai bước này: `20260905054148_tour_cost_model`
và `20260905054229_tour_cost_checks`.)*

- [ ] **Bước 5: generate + test Task 1 xanh**

```bash
cd apps/api && pnpm prisma generate
cd ../.. && pnpm turbo run test --filter=@tourism/api -- tour-costs
```
Kỳ vọng: PASS 5/5 (test Task 1 giờ mới có enum để import).

- [ ] **Bước 6: commit**

```bash
git add apps/api/prisma apps/api/src/modules/catalog
git commit -m "feat(api): bảng giá vốn tour và hai cột snapshot cho báo cáo

tour_cost_items khai từng hạng mục kèm cờ PER_PERSON/PER_DEPARTURE;
bookings.cost_per_person đóng băng vế biến đổi lúc đặt, còn
tour_departures.fixed_cost_amount giữ vế cố định ở cấp chuyến vì báo cáo
tính nó một lần mỗi chuyến đã chạy. CHECK không-âm ở cả ba cột: một dấu
trừ gõ nhầm làm lợi nhuận phình lên chứ không nổ ra."
git log -1 --format=%B | grep -i "co-authored\|generated"
```

Migration KHÔNG deploy lên Supabase ở bước này — chờ user yêu cầu tường minh.

---

### Task 4: Env + phép tính tài chính thuần ✅ *(xong 05/09)*

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/config/env.spec.ts`
- Create: `apps/api/src/modules/stats/finance-math.ts`
- Test: `apps/api/src/modules/stats/finance-math.spec.ts`

**Interfaces:**
- Produces: `env.MARGIN_TAX_RATE`, `env.PAYMENT_FEE_RATE`,
  `env.PAYMENT_FEE_FIXED` (đều `number`); `taxOnMargin(grossProfit, rate)`,
  `paymentFees(grossCollected, transactions, rate, fixed)`,
  `grossMarginPct(grossProfit, revenue)` — Task 6 gọi cả ba.

- [ ] **Bước 1: test đỏ cho `finance-math`**

```ts
import { Prisma } from '../../generated/prisma/client.js';
import { grossMarginPct, paymentFees, taxOnMargin } from './finance-math.js';

const d = (v: string) => new Prisma.Decimal(v);

describe('taxOnMargin', () => {
  it('20% ra đúng một phần sáu của margin (quy tắc TOMS)', () => {
    expect(taxOnMargin(d('600.00'), 0.2).toFixed(2)).toBe('100.00');
  });

  it('margin ÂM thì không có thuế — luật của scheme, không phải làm tròn', () => {
    expect(taxOnMargin(d('-500.00'), 0.2).toFixed(2)).toBe('0.00');
  });

  it('suất 0 thì thuế 0', () => {
    expect(taxOnMargin(d('600.00'), 0).toFixed(2)).toBe('0.00');
  });

  it('làm tròn HALF_UP về 2 chữ số', () => {
    // 400 × 0.1/1.1 = 36.3636… → 36.36
    expect(taxOnMargin(d('400.00'), 0.1).toFixed(2)).toBe('36.36');
  });
});

describe('paymentFees', () => {
  it('cộng phần trăm với phí cố định mỗi giao dịch', () => {
    // 1000 × 0.029 + 4 × 0.30 = 29.00 + 1.20 = 30.20
    expect(paymentFees(d('1000.00'), 4, 0.029, 0.3).toFixed(2)).toBe('30.20');
  });

  it('không giao dịch nào thì không phí nào', () => {
    expect(paymentFees(d('0.00'), 0, 0.029, 0.3).toFixed(2)).toBe('0.00');
  });
});

describe('grossMarginPct', () => {
  it('null khi doanh thu 0 — biên gộp KHÔNG XÁC ĐỊNH, không phải 0', () => {
    expect(grossMarginPct(d('0.00'), d('0.00'))).toBeNull();
  });

  it('trả tỉ lệ, không phải phần trăm', () => {
    expect(grossMarginPct(d('400.00'), d('1000.00'))).toBeCloseTo(0.4, 10);
  });

  it('lỗ ra tỉ lệ âm', () => {
    expect(grossMarginPct(d('-150.00'), d('1000.00'))).toBeCloseTo(-0.15, 10);
  });
});
```

- [ ] **Bước 2: chạy để thấy đỏ**

```bash
pnpm turbo run test --filter=@tourism/api -- finance-math
```
Kỳ vọng: FAIL — `Cannot find module './finance-math.js'`.

- [ ] **Bước 3: cài đặt `finance-math.ts`**

```ts
import { Prisma } from '../../generated/prisma/client.js';

/**
 * Phần THUẦN của mô hình tài chính (ADR-0033) — không đụng DB, nên mọi biên
 * làm tròn và mọi ca lỗ test được mà không cần Postgres. Aggregate thật ở
 * `stats-aggregates.ts`, ghép ở `reports.service.ts`.
 *
 * Tỉ lệ vào là `number` (đọc từ env, luôn là hằng nhỏ), tiền vào-ra là
 * `Prisma.Decimal` — tiền không bao giờ đi qua float.
 */

const ZERO = new Prisma.Decimal(0);

/**
 * Thuế trên MARGIN theo Tour Operators' Margin Scheme (ADR-0033 §5): giá bán
 * đã bao gồm thuế, nên phần thuế nằm TRONG margin và phải bóc ra bằng
 * `rate/(1+rate)`, không phải nhân thẳng `rate`.
 *
 * `max(0, …)` là LUẬT của scheme chứ không phải phòng thủ: margin âm thì
 * không có thuế nào phải nộp. Bỏ nó đi là sinh ra một khoản thuế ÂM cộng vào
 * lợi nhuận của một tháng lỗ.
 */
export function taxOnMargin(grossProfit: Prisma.Decimal, rate: number): Prisma.Decimal {
  if (rate <= 0 || grossProfit.lte(ZERO)) return ZERO;
  return grossProfit
    .mul(rate)
    .div(1 + rate)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Phí cổng thanh toán ước tính: mỗi booking là MỘT giao dịch, nên phần cố
 * định nhân với số booking chứ không tính một lần cho cả kỳ.
 *
 * Ước tính chứ không phải phí thật: phí thật nằm trong `balance_transaction`
 * của Stripe, tức thêm một lượt gọi API cho mỗi payment và một cột để lưu
 * (ADR-0033 §6 ghi đường nâng cấp).
 */
export function paymentFees(
  grossCollected: Prisma.Decimal,
  transactions: number,
  rate: number,
  fixedPerTransaction: number,
): Prisma.Decimal {
  return grossCollected
    .mul(rate)
    .add(new Prisma.Decimal(fixedPerTransaction).mul(transactions))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Biên gộp dạng TỈ LỆ (0.4 = 40%) — client nhân 100 khi in.
 *
 * `null` khi mẫu số 0, KHÔNG phải 0: một tháng không có chuyến nào chạy có
 * biên gộp không xác định, và `0.0%` là một câu khác hẳn — nó nói tháng ấy
 * hoà vốn trắng.
 */
export function grossMarginPct(
  grossProfit: Prisma.Decimal,
  revenue: Prisma.Decimal,
): number | null {
  if (revenue.isZero()) return null;
  return grossProfit.div(revenue).toNumber();
}
```

- [ ] **Bước 4: test xanh**

```bash
pnpm turbo run test --filter=@tourism/api -- finance-math
```
Kỳ vọng: PASS 9/9.

- [ ] **Bước 5: ba biến env**

Trong `EnvSchema` của `apps/api/src/config/env.ts`, sau khối payment provider:

```ts
    // ── Tỉ lệ tài chính cho báo cáo tháng (ADR-0033 §5, §6) ──
    // Mặc định 0 = tắt sạch: một dự án chưa khai thuế vẫn cho ra báo cáo
    // đúng, chỉ là dòng thuế bằng 0. Trần 1 chặn lỗi gõ "10" khi ý là "0.10"
    // — một suất 1000% sẽ nuốt trọn lợi nhuận mà không lỗi nào đỏ.
    MARGIN_TAX_RATE: z.coerce.number().min(0).max(1).default(0),
    PAYMENT_FEE_RATE: z.coerce.number().min(0).max(1).default(0),
    PAYMENT_FEE_FIXED: z.coerce.number().min(0).default(0),
```

Thêm vào `apps/api/src/config/env.spec.ts`:

```ts
it('tỉ lệ tài chính mặc định 0 và chặn suất vô lý', () => {
  const defaults = parseEnv({});
  expect(defaults.MARGIN_TAX_RATE).toBe(0);
  expect(defaults.PAYMENT_FEE_RATE).toBe(0);
  expect(defaults.PAYMENT_FEE_FIXED).toBe(0);
  expect(parseEnv({ MARGIN_TAX_RATE: '0.1' }).MARGIN_TAX_RATE).toBeCloseTo(0.1, 10);
  // "10" là lỗi gõ kinh điển của "0.10" — phải chết ở boot, không im lặng.
  expect(() => parseEnv({ MARGIN_TAX_RATE: '10' })).toThrow();
});
```

Và khai mẫu trong `apps/api/.env.example`:
```
MARGIN_TAX_RATE=0
PAYMENT_FEE_RATE=0
PAYMENT_FEE_FIXED=0
```

- [ ] **Bước 6: test env xanh**

```bash
pnpm turbo run test --filter=@tourism/api -- env
```
Kỳ vọng: PASS.

- [ ] **Bước 7: commit**

```bash
git add apps/api/src/config apps/api/src/modules/stats/finance-math.ts apps/api/src/modules/stats/finance-math.spec.ts apps/api/.env.example
git commit -m "feat(api): phép tính thuế trên margin, phí cổng và biên gộp

Thuế bóc theo rate/(1+rate) vì giá bán đã gồm thuế, và margin âm thì
không có thuế — luật của margin scheme chứ không phải làm tròn. Biên gộp
trả null khi không có chuyến nào chạy: 0.0% là một câu khác hẳn, nó nói
tháng ấy hoà vốn trắng. Trần env 1 chặn lỗi gõ 10 khi ý là 0.10."
git log -1 --format=%B | grep -i "co-authored\|generated"
```

---

### Task 5: Hai câu aggregate mới ✅ *(xong 05/09)*

**Files:**
- Modify: `apps/api/src/modules/stats/stats-aggregates.ts`
- Test: `apps/api/src/modules/stats/reports.int.spec.ts` (mở rộng ở Task 6)

**Interfaces:**
- Consumes: không gì từ task trước.
- Produces:
  `recognizedRevenueSlice(from, to): Promise<{ revenue: Prisma.Decimal; cogsVariable: Prisma.Decimal; grossCollected: Prisma.Decimal; bookings: number; costMissing: number }>`
  và `fixedCostSlice(from, to): Promise<{ total: Prisma.Decimal; departures: number }>`.
  Task 6 gọi cả hai.

- [ ] **Bước 1: `recognizedRevenueSlice`**

Thêm vào cuối `stats-aggregates.ts`:

```ts
/**
 * Cột KẾT QUẢ KINH DOANH của báo cáo (ADR-0033 §1) — neo `departure_end_date`,
 * tức những chuyến KẾT THÚC trong kỳ, chứ không phải tiền vào trong kỳ.
 *
 * Chỉ đếm booking ĐÃ ĐI (`PAID`/`PARTIALLY_REFUNDED`): khách huỷ thì không ăn
 * suất ăn nào, nên cả doanh thu lẫn giá vốn biến đổi của họ đều biến mất
 * (§4). Chi phí CỐ ĐỊNH của chuyến ấy thì không — nó nằm ở `fixedCostSlice`.
 *
 * Một câu SQL trả năm con số vì chúng phải chụp CÙNG một khoảnh khắc: năm
 * query rời sẽ cho `costMissing` thuộc một tập booking còn `revenue` thuộc
 * một tập khác (cùng bài học đã ghi ở `subscribersStats`).
 *
 * `LEFT JOIN` gộp refund theo booking thay vì subquery tương quan: một booking
 * có thể có NHIỀU dòng hoàn (hoàn một phần nhiều lần — ADR-0029), và cộng
 * trong `SUM` ngoài sẽ nhân đôi doanh thu theo số dòng hoàn.
 */
export async function recognizedRevenueSlice(from: Date, to: Date) {
  const [row] = await prisma.$queryRaw<
    {
      revenue: Prisma.Decimal | null;
      cogs_variable: Prisma.Decimal | null;
      gross_collected: Prisma.Decimal | null;
      bookings: bigint;
      cost_missing: bigint;
    }[]
  >(Prisma.sql`
    SELECT
      COALESCE(SUM(b.total_amount - COALESCE(r.refunded, 0)), 0) AS revenue,
      COALESCE(SUM(COALESCE(b.cost_per_person, 0) * (b.num_adults + b.num_children)), 0)
        AS cogs_variable,
      COALESCE(SUM(b.total_amount), 0) AS gross_collected,
      COUNT(*) AS bookings,
      COUNT(*) FILTER (WHERE b.cost_per_person IS NULL) AS cost_missing
    FROM bookings b
    LEFT JOIN (
      SELECT booking_id, SUM(amount) AS refunded FROM refunds GROUP BY booking_id
    ) r ON r.booking_id = b.id
    WHERE b.status IN (${BookingStatus.PAID}::"BookingStatus",
                       ${BookingStatus.PARTIALLY_REFUNDED}::"BookingStatus")
      AND b.departure_end_date >= ${from} AND b.departure_end_date < ${to}
  `);

  return {
    revenue: row?.revenue ?? new Prisma.Decimal(0),
    cogsVariable: row?.cogs_variable ?? new Prisma.Decimal(0),
    // Tiền GỐC trước khi trừ hoàn — phí cổng đã trả trên toàn bộ số này.
    grossCollected: row?.gross_collected ?? new Prisma.Decimal(0),
    bookings: Number(row?.bookings ?? 0),
    costMissing: Number(row?.cost_missing ?? 0),
  };
}
```

- [ ] **Bước 2: `fixedCostSlice`**

```ts
/**
 * Giá vốn CỐ ĐỊNH của các chuyến đã chạy trong kỳ (ADR-0033 §4) — cộng MỘT
 * lần cho mỗi chuyến, bất kể bán được bao nhiêu ghế. Xe vẫn chạy.
 *
 * "Đã chạy" phải có ĐỦ hai vế: chuyến không bị huỷ, VÀ có ít nhất một khách
 * thật sự đi. Thiếu vế `EXISTS` thì mọi chuyến ế trong lịch đều bị tính tiền
 * xe — một tour đăng 52 chuyến cả năm mà bán được 6 sẽ báo lỗ nặng từ hư
 * không.
 */
export async function fixedCostSlice(from: Date, to: Date) {
  const [row] = await prisma.$queryRaw<{ total: Prisma.Decimal | null; departures: bigint }[]>(
    Prisma.sql`
      SELECT COALESCE(SUM(d.fixed_cost_amount), 0) AS total, COUNT(*) AS departures
      FROM tour_departures d
      WHERE d.status <> ${DepartureStatus.CANCELLED}::"DepartureStatus"
        AND d.end_date >= ${from} AND d.end_date < ${to}
        AND EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.departure_id = d.id
            AND b.status IN (${BookingStatus.PAID}::"BookingStatus",
                             ${BookingStatus.PARTIALLY_REFUNDED}::"BookingStatus")
        )
    `,
  );

  return {
    total: row?.total ?? new Prisma.Decimal(0),
    departures: Number(row?.departures ?? 0),
  };
}
```

Thêm `DepartureStatus` vào khối import enum ở đầu file.

- [ ] **Bước 3: typecheck**

```bash
pnpm turbo run typecheck --filter=@tourism/api
```
Kỳ vọng: PASS. (Int test của hai hàm này nằm ở Task 6, nơi có response để soi.)

- [ ] **Bước 4: commit**

```bash
git add apps/api/src/modules/stats/stats-aggregates.ts
git commit -m "feat(api): aggregate doanh thu ghi nhận và giá vốn cố định theo kỳ

Doanh thu ghi nhận neo departure_end_date và chỉ đếm booking đã đi. Giá
vốn cố định cộng một lần mỗi chuyến ĐÃ CHẠY — vế EXISTS là bắt buộc,
thiếu nó thì mọi chuyến ế trong lịch đều bị tính tiền xe. LEFT JOIN gộp
refund theo booking vì một booking hoàn nhiều lần được (ADR-0029), cộng
trong SUM ngoài sẽ nhân đôi doanh thu theo số dòng hoàn."
git log -1 --format=%B | grep -i "co-authored\|generated"
```

---

### Task 6: `ReportsService` ghép cột kết quả kinh doanh ✅ *(xong 05/09)*

**Files:**
- Modify: `apps/api/src/modules/stats/reports.service.ts`
- Test: `apps/api/src/modules/stats/reports.int.spec.ts`

**Interfaces:**
- Consumes: `recognizedRevenueSlice`, `fixedCostSlice` (Task 5);
  `taxOnMargin`, `paymentFees`, `grossMarginPct` (Task 4); `env` (Task 4).
- Produces: `admin.reports.monthly` trả đủ 12 field của Task 2.

- [ ] **Bước 1: int test đỏ**

Thêm vào `reports.int.spec.ts` (giữ nguyên nếp NGÀY CỐ ĐỊNH tháng 5/2026 của
file; mỗi mốc phải có hàng xóm ở tháng trước và tháng sau):

```ts
it('ghi nhận doanh thu theo chuyến KẾT THÚC trong tháng, không theo ngày trả tiền', async () => {
  const report = await fetchReport('2026-05');
  // Chuyến kết thúc 20/05, khách trả tiền từ 12/04 — thuộc tháng 5, không phải 4.
  expect(report.recognizedRevenue).toBe('900.00');
  expect(report.departuresRun).toBe(1);
});

it('booking đã huỷ không góp doanh thu lẫn giá vốn biến đổi', async () => {
  const report = await fetchReport('2026-05');
  // Ghế huỷ: 2 khách × 30.00 giá vốn biến đổi KHÔNG được cộng.
  expect(report.cogsVariable).toBe('180.00');
});

it('giá vốn cố định tính MỘT lần cho chuyến đã chạy', async () => {
  const report = await fetchReport('2026-05');
  expect(report.cogsFixed).toBe('400.00');
  expect(report.cogsTotal).toBe('580.00');
});

it('chuyến không ai đặt thì không tốn giá vốn cố định', async () => {
  // Tháng 6/2026 chỉ có một chuyến ế, không booking nào.
  const report = await fetchReport('2026-06');
  expect(report.cogsFixed).toBe('0.00');
  expect(report.departuresRun).toBe(0);
});

it('tháng không có chuyến nào chạy có biên gộp null, không phải 0', async () => {
  const report = await fetchReport('2026-06');
  expect(report.recognizedRevenue).toBe('0.00');
  expect(report.grossMarginPct).toBeNull();
});

it('đếm booking thiếu giá vốn thay vì im lặng coi bằng 0', async () => {
  const report = await fetchReport('2026-05');
  expect(report.costDataMissing).toBe(1);
});

it('response khớp contract kể cả khi lợi nhuận âm', async () => {
  const report = await fetchReport('2026-05');
  expect(AdminMonthlyReportSchema.safeParse(report).success).toBe(true);
});
```

Seed cho các test trên: một tour có `costItems` (`PER_PERSON` 30.00 ·
`PER_DEPARTURE` 400.00, `maxGroupSize` 20), một chuyến `end_date` 20/05/2026 với
`fixed_cost_amount = '400.00'`, ba booking trên chuyến ấy — hai booking PAID
(3 ghế và 3 ghế, `cost_per_person = '30.00'`), một booking CANCELLED (2 ghế),
cộng một booking PAID `cost_per_person = null` để `costDataMissing` có gì mà
đếm. Chuyến tháng 6 tạo không kèm booking nào.

- [ ] **Bước 2: chạy để thấy đỏ**

```bash
docker start tourism-v2-postgres-1
pnpm turbo run test:int --filter=@tourism/api -- reports
```
Kỳ vọng: FAIL — `recognizedRevenue` là `undefined`.

- [ ] **Bước 3: ghép vào service**

Trong `reports.service.ts`, thêm import và mở rộng `Promise.all`:

```ts
import { env } from '../../config/env.js';
import { grossMarginPct, paymentFees, taxOnMargin } from './finance-math.js';
import { fixedCostSlice, recognizedRevenueSlice } from './stats-aggregates.js';
```

```ts
    const [paid, created, paidCurrency, refunds, refundsCurrency, decisions, reviewsApproved,
           recognised, fixedCost] = await Promise.all([
      // … bảy lời gọi cũ giữ nguyên …
      recognizedRevenueSlice(from, to),
      fixedCostSlice(from, to),
    ]);

    // Cột KẾT QUẢ KINH DOANH (ADR-0033 §1) — mọi phép trừ chỉ xảy ra ở đây;
    // `revenue`/`refundedTotal` bên trên vẫn là dòng tiền gross, không đụng.
    const cogsTotal = recognised.cogsVariable.add(fixedCost.total);
    const grossProfit = recognised.revenue.sub(cogsTotal);
    const taxAmount = taxOnMargin(grossProfit, env.MARGIN_TAX_RATE);
    const fees = paymentFees(
      recognised.grossCollected,
      recognised.bookings,
      env.PAYMENT_FEE_RATE,
      env.PAYMENT_FEE_FIXED,
    );
```

Rồi thêm vào object trả về:

```ts
      recognizedRevenue: grossAmount(recognised.revenue),
      cogsVariable: grossAmount(recognised.cogsVariable),
      cogsFixed: grossAmount(fixedCost.total),
      cogsTotal: grossAmount(cogsTotal),
      grossProfit: grossProfit.toFixed(2),
      grossMarginPct: grossMarginPct(grossProfit, recognised.revenue),
      taxRate: env.MARGIN_TAX_RATE,
      taxAmount: grossAmount(taxAmount),
      paymentFees: grossAmount(fees),
      netProfit: grossProfit.sub(taxAmount).sub(fees).toFixed(2),
      departuresRun: fixedCost.departures,
      costDataMissing: recognised.costMissing,
```

*(Thi công 05/09: `grossAmount` hoá ra KHÔNG ép về không-âm — nó chỉ là
`value ? value.toFixed(2) : '0.00'`. Vẫn dùng `.toFixed(2)` trực tiếp cho hai
field này vì chúng không bao giờ null và cái tên nói về tiền gross, không về
lợi nhuận. Ngoài ra Task 6 KHÔNG chạy được nếu chưa có Task 2 — thứ tự đánh số
trong plan không phải thứ tự thi công.)*

⚠️ `grossProfit`/`netProfit` dùng `.toFixed(2)` **chứ không** `grossAmount()`
— nếu `grossAmount` ép về không-âm hoặc trả `'0.00'` cho null thì nó sẽ nuốt
mất dấu trừ. Đọc thân hàm `grossAmount` trong `stats-math.ts` trước khi gõ; nó
nhận `Decimal | null`, còn hai giá trị này không bao giờ null.

Cập nhật JSDoc đầu class: thêm mục "Cột thứ hai — kết quả kinh doanh" trỏ về
ADR-0033 §1.

- [ ] **Bước 4: int test xanh**

```bash
pnpm turbo run test:int --filter=@tourism/api -- reports
```
Kỳ vọng: PASS toàn bộ file (7 test mới + các test cũ).

- [ ] **Bước 5: commit**

```bash
git add apps/api/src/modules/stats
git commit -m "feat(api): báo cáo tháng trả cột kết quả kinh doanh

Doanh thu ghi nhận neo ngày chuyến kết thúc, trừ giá vốn hai vế, trừ thuế
trên margin và phí cổng — đặt CẠNH cột dòng tiền chứ không thay nó, nên
mọi stat card đang ăn định nghĩa paid_at không phải đổi gì. grossProfit
và netProfit đi qua toFixed thay vì grossAmount để không nuốt dấu trừ của
một tháng lỗ."
git log -1 --format=%B | grep -i "co-authored\|generated"
```

---

### Task 7: Snapshot giá vốn lúc tạo booking, và giá vốn trong seed ✅ *(xong 05/09)*

**Files:**
- Modify: `apps/api/src/modules/bookings/bookings.service.ts`
- Create: `apps/api/prisma/fixtures/catalog/tour-costs.ts`
- Modify: `apps/api/prisma/fixtures/catalog/index.ts`
- Modify: `apps/api/prisma/seed.ts`
- Test: `apps/api/src/modules/bookings/bookings.int.spec.ts`

**Interfaces:**
- Consumes: `perPersonTotal`, `perDepartureTotal`, `derivedCostPrice` (Task 1).
- Produces: mọi booking mới có `costPerPerson`; seed ghi `tour_cost_items`,
  `Tour.costPrice`, `TourDeparture.fixedCostAmount`.

- [ ] **Bước 1: int test đỏ cho snapshot**

```ts
it('booking mới đóng băng giá vốn theo đầu khách của tour', async () => {
  const created = await createBooking({ numAdults: 2, numChildren: 1 });
  const row = await prisma.booking.findUniqueOrThrow({
    where: { id: created.id },
    select: { costPerPerson: true },
  });
  // Tour fixture: PER_PERSON 30.00 + 55.00 = 85.00; phần PER_DEPARTURE KHÔNG
  // vào đây (nó ở cấp chuyến).
  expect(row.costPerPerson?.toFixed(2)).toBe('85.00');
});

it('sửa giá vốn tour SAU khi đặt không đổi snapshot của booking cũ', async () => {
  const created = await createBooking({ numAdults: 1, numChildren: 0 });
  await prisma.tourCostItem.updateMany({
    where: { tourId: TOUR_ID, basis: 'PER_PERSON' },
    data: { amount: '999.00' },
  });
  const row = await prisma.booking.findUniqueOrThrow({
    where: { id: created.id },
    select: { costPerPerson: true },
  });
  expect(row.costPerPerson?.toFixed(2)).toBe('85.00');
});

it('tour chưa khai giá vốn thì snapshot null, không phải 0', async () => {
  const created = await createBooking({ tourSlug: TOUR_WITHOUT_COSTS });
  const row = await prisma.booking.findUniqueOrThrow({
    where: { id: created.id },
    select: { costPerPerson: true },
  });
  expect(row.costPerPerson).toBeNull();
});
```

- [ ] **Bước 2: chạy để thấy đỏ**

```bash
pnpm turbo run test:int --filter=@tourism/api -- bookings
```
Kỳ vọng: FAIL — `costPerPerson` là `null` ở cả ba test.

- [ ] **Bước 3: đọc cost item trong đường tạo booking**

Trong `bookings.service.ts`, khối `include` đang nạp `departure.tour` thêm:

```ts
        // Giá vốn PER_PERSON để đóng băng vào booking (ADR-0033 §3). Đọc ở
        // đây chứ không query riêng: đường này đã nạp `tour` cho `basePrice`,
        // và một join thêm trên FK có index rẻ hơn một round-trip nữa trong
        // transaction giữ advisory lock.
        costItems: { select: { amount: true, basis: true } },
```

Sau `const total = totalAmount(unitPrice, seats);`:

```ts
    // Tour chưa khai giá vốn → null, KHÔNG phải 0: báo cáo đếm số booking
    // thiếu dữ liệu và nói ra (ADR-0033 §6). `0.00` sẽ tự nhận là "tour này
    // không tốn gì" và biến một lỗ hổng dữ liệu thành lợi nhuận.
    const costItems = departure.tour.costItems;
    const costPerPerson = costItems.length > 0 ? perPersonTotal(costItems) : null;
```

Rồi thêm `costPerPerson,` vào object `data` của `prisma.booking.create`.

- [ ] **Bước 4: int test xanh**

```bash
pnpm turbo run test:int --filter=@tourism/api -- bookings
```
Kỳ vọng: PASS 3/3 test mới, không test cũ nào đỏ.

- [ ] **Bước 5: fixture giá vốn cho 30 tour**

Tạo `apps/api/prisma/fixtures/catalog/tour-costs.ts`. Dữ liệu sinh theo MỘT mô
hình khai tường minh trong file, không phải 150 dòng gõ tay — mô hình nhìn
thấy được thì kiểm được, còn số gõ tay thì không:

```ts
import type { TourCostItemFixture } from './types.js';
import { tours as centralTours } from './tours-central.js';
import { tours as northTours } from './tours-north.js';
import { tours as southTours } from './tours-south.js';

/**
 * Giá vốn seed cho 30 tour (ADR-0033 §2).
 *
 * ⚠️ Đây là dữ liệu DỰNG, không phải báo giá nhà cung cấp thật. Nó được sinh
 * từ một mô hình khai ngay dưới đây thay vì gõ tay 150 dòng, vì một mô hình
 * nhìn thấy được thì đối chiếu được — còn 150 con số rời thì không ai kiểm
 * nổi khi biên gộp trông lạ.
 *
 * Tỉ lệ chọn để biên gộp rơi vào dải ngành thật: tour NGÀY 40–50%, tour nhiều
 * ngày 25–35%.
 */
const DAY_TOUR_VARIABLE_RATIO = 0.42; // phần giá bán đi vào chi phí theo khách
const MULTI_DAY_VARIABLE_RATIO = 0.55;
/** Chi phí cố định mỗi chuyến, quy theo số ghế tối đa — xe + hướng dẫn. */
const FIXED_PER_SEAT = 6.5;

function itemsForTour(tour: {
  id: string;
  basePrice: string;
  durationDays: number;
  maxGroupSize: number;
}): TourCostItemFixture[] {
  const price = Number(tour.basePrice);
  const multiDay = tour.durationDays > 1;
  const variable = price * (multiDay ? MULTI_DAY_VARIABLE_RATIO : DAY_TOUR_VARIABLE_RATIO);
  const fixed = tour.maxGroupSize * FIXED_PER_SEAT * (multiDay ? tour.durationDays : 1);
  const money = (v: number) => v.toFixed(2);

  const rows: TourCostItemFixture[] = [
    { tourId: tour.id, category: 'TRANSPORT', label: 'Vehicle hire and fuel',
      amount: money(fixed * 0.62), basis: 'PER_DEPARTURE', sortOrder: 0 },
    { tourId: tour.id, category: 'GUIDE', label: 'Guide fee',
      amount: money(fixed * 0.38), basis: 'PER_DEPARTURE', sortOrder: 1 },
    { tourId: tour.id, category: 'MEALS', label: 'Meals and drinks',
      amount: money(variable * (multiDay ? 0.34 : 0.55)), basis: 'PER_PERSON', sortOrder: 2 },
    { tourId: tour.id, category: 'ACTIVITIES', label: 'Entrance and activity tickets',
      amount: money(variable * (multiDay ? 0.2 : 0.45)), basis: 'PER_PERSON', sortOrder: 3 },
  ];
  if (multiDay) {
    rows.push({ tourId: tour.id, category: 'ACCOMMODATION', label: 'Hotel nights',
      amount: money(variable * 0.46), basis: 'PER_PERSON', sortOrder: 4 });
  }
  return rows;
}

export const tourCostItems: TourCostItemFixture[] = [
  ...northTours, ...centralTours, ...southTours,
].flatMap(itemsForTour);
```

`types.ts` thêm interface:

```ts
/** Một dòng giá vốn của tour (ADR-0033 §2). `amount` là chuỗi decimal. */
export interface TourCostItemFixture {
  tourId: string;
  category:
    | 'TRANSPORT' | 'ACCOMMODATION' | 'MEALS' | 'GUIDE'
    | 'ACTIVITIES' | 'PERMITS' | 'INSURANCE' | 'OTHER';
  label: string;
  amount: string;
  basis: 'PER_PERSON' | 'PER_DEPARTURE';
  sortOrder: number;
}
```

`index.ts` re-export `tourCostItems`.

- [ ] **Bước 6: seed ghi ba thứ**

Trong `seed.ts`, sau khi insert tours và trước khi insert departures:

```ts
  // Giá vốn (ADR-0033). Ba lượt ghi vì ba đích khác nhau: bảng danh mục, số
  // dẫn xuất trên tour, và snapshot cố định trên từng chuyến.
  await prisma.tourCostItem.createMany({
    data: tourCostItems as unknown as Prisma.TourCostItemCreateManyInput[],
  });

  for (const tour of allTours) {
    const items = tourCostItems
      .filter((item) => item.tourId === tour.id)
      .map((item) => ({ amount: new Prisma.Decimal(item.amount), basis: item.basis }));
    await prisma.tour.update({
      where: { id: tour.id },
      data: { costPrice: derivedCostPrice(items, tour.maxGroupSize) },
    });
    // Snapshot cố định cho MỌI chuyến của tour — đúng thứ đường tạo chuyến
    // trong admin sẽ làm khi phase `/tours` tới.
    await prisma.tourDeparture.updateMany({
      where: { tourId: tour.id },
      data: { fixedCostAmount: perDepartureTotal(items) },
    });
  }
```

- [ ] **Bước 7: chạy seed trên docker local và soi số**

```bash
cd apps/api && pnpm db:seed
```
Kỳ vọng: seed chạy hết, không lỗi. ⚠️ `db:seed` đọc `.env.local` nếu có —
**kiểm `DATABASE_URL` đang trỏ docker local trước khi chạy**, tuyệt đối không
seed vào Supabase.

- [ ] **Bước 8: commit**

```bash
git add apps/api/src/modules/bookings apps/api/prisma/fixtures apps/api/prisma/seed.ts
git commit -m "feat(api): đóng băng giá vốn vào booking, và giá vốn seed cho 30 tour

Booking mới chụp tổng dòng PER_PERSON của tour tại lúc đặt; tour chưa
khai giá vốn thì snapshot null chứ không 0, vì 0.00 sẽ tự nhận là tour
không tốn gì và biến một lỗ hổng dữ liệu thành lợi nhuận. Fixture sinh
từ một mô hình khai tường minh thay vì 150 dòng gõ tay — mô hình nhìn
thấy được thì đối chiếu được khi biên gộp trông lạ."
git log -1 --format=%B | grep -i "co-authored\|generated"
```

---

### Task 8: Màn hình `/reports` — bảng P&L và stat card mới ✅ *(xong 05/09)*

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts`
- Modify: `apps/admin/src/lib/reports-view.ts`
- Modify: `apps/admin/src/components/reports/report-tables.tsx`
- Test: `apps/admin/src/lib/reports-view.spec.ts`

**Interfaces:**
- Consumes: 12 field của Task 2.
- Produces: `toReportPnlRows(report): ReportSummaryRowVM[]`,
  `formatMarginPct(pct): string`, `toReportStatCards` đổi 4 card.

- [ ] **Bước 1: test đỏ**

```ts
describe('P&L', () => {
  it('in biên gộp thành phần trăm, và "—" khi không xác định', () => {
    expect(formatMarginPct(0.4)).toBe('40.0%');
    expect(formatMarginPct(-0.15)).toBe('-15.0%');
    expect(formatMarginPct(null)).toBe('—');
  });

  it('bốn card đổi sang cách đọc kinh doanh, giữ một card dòng tiền', () => {
    const cards = toReportStatCards(report);
    expect(cards.map((c) => c.key)).toEqual([
      'recognizedRevenue', 'grossProfit', 'netProfit', 'revenue',
    ]);
  });

  it('card lợi nhuận gộp mang biên % ở caption', () => {
    const card = toReportStatCards(report).find((c) => c.key === 'grossProfit');
    expect(card?.caption).toContain('40.0%');
  });

  it('hàng P&L có đủ dòng và giữ đúng thứ tự đọc', () => {
    expect(toReportPnlRows(report).map((r) => r.key)).toEqual([
      'recognizedRevenue', 'cogsVariable', 'cogsFixed', 'cogsTotal',
      'grossProfit', 'taxAmount', 'paymentFees', 'netProfit',
    ]);
  });

  it('cảnh báo thiếu giá vốn chỉ hiện khi thật sự thiếu', () => {
    expect(costWarning({ ...report, costDataMissing: 0 })).toBeNull();
    expect(costWarning({ ...report, costDataMissing: 3 })).toContain('3');
  });
});
```

- [ ] **Bước 2: chạy để thấy đỏ**

```bash
pnpm turbo run test --filter=@tourism/admin -- reports-view
```
Kỳ vọng: FAIL — `formatMarginPct` chưa tồn tại.

- [ ] **Bước 3: copy i18n**

Trong `admin.reports` của `messages.ts`:

```ts
      exportExcel: 'Export Excel',
      cards: {
        revenue: 'Cash collected',
        recognizedRevenue: 'Revenue recognised',
        grossProfit: 'Gross profit',
        netProfit: 'Net profit',
        marginCaption: (pct: string) => `Gross margin ${pct}`,
      },
      pnlTable: {
        heading: 'Profit and loss',
        metric: 'Line',
        value: 'Amount',
        recognizedRevenue: 'Revenue recognised',
        cogsVariable: 'Cost of sales — per traveller',
        cogsFixed: 'Cost of sales — per departure',
        cogsTotal: 'Total cost of sales',
        grossProfit: 'Gross profit',
        taxAmount: (rate: string) => `Tax on margin (${rate})`,
        paymentFees: 'Payment processing',
        netProfit: 'Net profit',
        departuresRun: (n: string) => `${n} departures ran this month`,
        costMissing: (n: string) =>
          `${n} bookings have no cost data, so cost of sales is understated.`,
        marginUnknown: '—',
      },
      definitions: {
        // … ba dòng cũ giữ nguyên …
        recognised:
          'Revenue recognised counts trips that finished this month, so it can differ from cash collected — money for a December trip is taken today but earned in December.',
        costs:
          'Per-traveller costs follow the travellers who went; per-departure costs are charged once for each departure that ran, whether it sold out or not.',
        netProfit:
          'Net profit is after cost of sales, tax and payment fees. It does not include salaries, rent or marketing.',
      },
```

⚠️ `cards.revenue` đổi chữ từ `'Revenue'` sang `'Cash collected'` — cùng con
số, tên đúng hơn giờ có hai cách đọc cạnh nhau.

- [ ] **Bước 4: mapper trong `reports-view.ts`**

```ts
/** Biên gộp dạng tỉ lệ → phần trăm một chữ số; `null` là KHÔNG XÁC ĐỊNH. */
export function formatMarginPct(pct: number | null): string {
  return pct === null ? t.pnlTable.marginUnknown : `${(pct * 100).toFixed(1)}%`;
}

/** Câu cảnh báo thiếu giá vốn, hoặc `null` khi đủ (ADR-0033 §6). */
export function costWarning(report: AdminMonthlyReport): string | null {
  return report.costDataMissing === 0
    ? null
    : t.pnlTable.costMissing(formatCount(report.costDataMissing));
}

/**
 * Hàng bảng P&L. KHÔNG dùng khuôn `SummaryMetric` của hai bảng kia: nhãn dòng
 * thuế phải mang CHÍNH thuế suất của báo cáo đang đọc, tức nó phụ thuộc dữ
 * liệu — mà `SummaryMetric.label` là một chuỗi hằng. Nhồi một hằng giả vào rồi
 * thay ở vòng map là để lại một cái bẫy cho người sửa sau.
 *
 * Nhãn mang thuế suất không phải trang trí: env không có ngày hiệu lực, nên
 * tờ báo cáo phải tự khai nó được tính bằng mức nào (ADR-0033 §5).
 */
export function toReportPnlRows(report: AdminMonthlyReport): ReportSummaryRowVM[] {
  const money = (amount: string) => formatAmount(amount, report.currency);

  return [
    { key: 'recognizedRevenue', label: p.recognizedRevenue, value: money(report.recognizedRevenue) },
    { key: 'cogsVariable', label: p.cogsVariable, value: money(report.cogsVariable) },
    { key: 'cogsFixed', label: p.cogsFixed, value: money(report.cogsFixed) },
    { key: 'cogsTotal', label: p.cogsTotal, value: money(report.cogsTotal) },
    { key: 'grossProfit', label: p.grossProfit, value: money(report.grossProfit) },
    {
      key: 'taxAmount',
      label: p.taxAmount(formatMarginPct(report.taxRate)),
      value: money(report.taxAmount),
    },
    { key: 'paymentFees', label: p.paymentFees, value: money(report.paymentFees) },
    { key: 'netProfit', label: p.netProfit, value: money(report.netProfit) },
  ];
}
```

Khai `const p = t.pnlTable;` cạnh `const o = t.operationsTable;` đang có ở đầu
file.

⚠️ `formatAmount` phải in được số ÂM, thứ phải in được số ÂM. Kiểm
`formatAmount('-150.00', 'USD')` ra `-$150.00` chứ không phải `NaN` — nếu nó
dựa trên một regex không dấu thì sửa ở đó, và thêm một test.

`toReportStatCards` đổi thành bốn card mới:

```ts
  return [
    { key: 'recognizedRevenue', label: t.cards.recognizedRevenue,
      value: money(report.recognizedRevenue), caption },
    { key: 'grossProfit', label: t.cards.grossProfit, value: money(report.grossProfit),
      caption: t.cards.marginCaption(formatMarginPct(report.grossMarginPct)) },
    { key: 'netProfit', label: t.cards.netProfit, value: money(report.netProfit), caption },
    { key: 'revenue', label: t.cards.revenue, value: money(report.revenue), caption },
  ];
```

- [ ] **Bước 5: bảng thứ ba trong `report-tables.tsx`**

Thêm một `<section>` P&L dùng `toReportPnlRows`, đặt **trước** hai bảng đang có
(tiền trước, vận hành sau — đúng thứ tự người dò một tờ báo cáo). Dưới bảng in
`costWarning(report)` khi khác null, và dòng `p.departuresRun(...)` làm chú
thích cho `cogsFixed`.

Bổ sung ba dòng định nghĩa mới vào khối `definitions` ở `page.tsx`.

- [ ] **Bước 6: test + gate**

```bash
pnpm turbo run test typecheck --filter=@tourism/admin && pnpm lint
```
Kỳ vọng: xanh.

- [ ] **Bước 7: commit**

```bash
git add apps/admin/src libs/shared/i18n/src
git commit -m "feat(admin+i18n): /reports có bảng P&L và bốn card đọc theo kinh doanh

Card Revenue đổi nhãn thành Cash collected — cùng con số, tên đúng hơn khi
đã có hai cách đọc cạnh nhau. Biên gộp không xác định in dấu gạch chứ
không 0.0%, và số booking thiếu giá vốn hiện thành một câu dưới bảng."
git log -1 --format=%B | grep -i "co-authored\|generated"
```

---

### Task 9: Xuất Excel

**Files:**
- Modify: `apps/admin/package.json` (thêm `exceljs`)
- Create: `apps/admin/src/lib/xlsx.ts`
- Test: `apps/admin/src/lib/xlsx.spec.ts`
- Modify: `apps/admin/src/lib/export-route.ts`
- Modify: `apps/admin/src/app/(admin)/reports/export/route.ts`
- Modify: `apps/admin/src/components/reports/reports-toolbar.tsx` (nhãn nút)
- Modify: `apps/admin/src/lib/csv.ts` (JSDoc đã sai)

**Interfaces:**
- Consumes: `AdminMonthlyReport` (Task 2), `toReportPnlRows` (Task 8).
- Produces: `buildReportWorkbook(report, bookings): Promise<Buffer>`,
  `xlsxExportResponse(prefix, buffer)`.

- [ ] **Bước 1: cài dep**

```bash
pnpm --filter @tourism/admin add exceljs
```
Kỳ vọng: `exceljs` xuất hiện trong `apps/admin/package.json`.

- [ ] **Bước 2: test đỏ**

```ts
import ExcelJS from 'exceljs';
import { buildReportWorkbook } from './xlsx';

async function open(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

it('có đủ năm sheet, đúng thứ tự đọc', async () => {
  const wb = await open(await buildReportWorkbook(report, []));
  expect(wb.worksheets.map((s) => s.name)).toEqual([
    'Summary', 'Bookings', 'Operations', 'Detail', 'Definitions',
  ]);
});

it('tiền ghi là SỐ kèm định dạng, không phải chuỗi — nếu không mọi phép SUM chết', async () => {
  const wb = await open(await buildReportWorkbook(report, []));
  const cell = wb.getWorksheet('Summary')!.getCell('B12');
  expect(typeof cell.value).toBe('number');
  expect(cell.numFmt).toBe('#,##0.00;(#,##0.00)');
});

it('lỗ vẫn là số âm thật, không phải chuỗi có dấu trừ', async () => {
  const wb = await open(await buildReportWorkbook({ ...report, netProfit: '-186.36' }, []));
  const found = wb.getWorksheet('Summary')!.findCell?.('B19');
  expect(Number(found?.value)).toBeCloseTo(-186.36, 2);
});

it('khối đầu khai thuế suất — env không có ngày hiệu lực', async () => {
  const wb = await open(await buildReportWorkbook({ ...report, taxRate: 0.1 }, []));
  const text = wb.getWorksheet('Summary')!.getSheetValues().flat().join(' ');
  expect(text).toContain('10.0%');
});

it('hàng tiêu đề bảng được đóng băng', async () => {
  const wb = await open(await buildReportWorkbook(report, []));
  expect(wb.getWorksheet('Detail')!.views[0]?.state).toBe('frozen');
});
```

- [ ] **Bước 3: chạy để thấy đỏ**

```bash
pnpm turbo run test --filter=@tourism/admin -- xlsx
```
Kỳ vọng: FAIL — `Cannot find module './xlsx'`.

- [ ] **Bước 4: cài đặt `xlsx.ts`**

Điểm bắt buộc (ADR-0034 §2, §4), viết JSDoc tiếng Việt cho từng điểm:

```ts
/** Định dạng số của báo cáo tài chính — âm trong ngoặc, đúng quy ước ngành. */
const MONEY_FMT = '#,##0.00;(#,##0.00)';
const PCT_FMT = '0.0%';
const COUNT_FMT = '#,##0';

/**
 * Chỗ `Number()` DUY NHẤT được phép trong toàn dự án cho tiền (ADR-0034 §2):
 * Excel không có kiểu decimal, nên giá trị phải xuống `number` ngay tại lớp
 * ghi ô. Nó đứng SAU mọi phép cộng — không một phép tính nào chạy trên
 * `number`.
 */
function money(cell: ExcelJS.Cell, decimalString: string): void {
  cell.value = Number(decimalString);
  cell.numFmt = MONEY_FMT;
}
```

Khối đầu của Summary, viết đủ để làm khuôn cho bốn sheet còn lại:

```ts
function writeSummaryHeader(sheet: ExcelJS.Worksheet, report: AdminMonthlyReport): void {
  // Merge CHỈ ở khối tiêu đề — ô merge trong vùng dữ liệu phá sort, filter và
  // mọi tham chiếu (ADR-0034 §4).
  sheet.mergeCells('A1:B1');
  const title = sheet.getCell('A1');
  title.value = t.title;
  title.font = { size: 14, bold: true };

  const rows: Array<[string, string | number, string?]> = [
    [x.period, reportPeriodLabel(report)],
    [x.generatedAt, formatDateTime(report.generatedAt)],
    [x.currency, report.currency],
    // Thuế suất đi kèm mọi bản xuất: env không có ngày hiệu lực, nên file phải
    // tự khai nó được tính bằng mức nào (ADR-0033 §5).
    [x.taxRate, report.taxRate, PCT_FMT],
  ];
  rows.forEach(([label, value, fmt], index) => {
    const row = sheet.getRow(index + 2);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
    if (fmt) row.getCell(2).numFmt = fmt;
  });

  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 18;
}
```

- Sheet **Summary**: khối đầu ở trên, rồi khối Dòng tiền, rồi khối P&L. Dòng
  tổng in đậm + `border.top = { style: 'thin' }`. Dòng chi phí thụt lề bằng
  `alignment.indent = 1`, **không** bằng khoảng trắng trong chuỗi.
- Sheet **Bookings**: `bookingsByStatus` + dòng Total.
- Sheet **Operations**: các metric vận hành đang có.
- Sheet **Detail**: một hàng mỗi booking; cột `Code · Tour · Departure ends ·
  Travellers · Total · Refunded · Cost/person · Status`; `autoFilter` trên hàng
  tiêu đề; ô `Cost/person` trống để trống (đừng ghi 0) khi null.
- Sheet **Definitions**: mọi câu trong `t.definitions`, mỗi câu một hàng,
  `alignment.wrapText = true`.
- Mọi sheet có bảng: `views = [{ state: 'frozen', ySplit: <hàng tiêu đề> }]`,
  độ rộng cột đặt tay, `pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0,
  printTitlesRow: '<hàng tiêu đề>:<hàng tiêu đề>' }`; Detail thêm
  `orientation: 'landscape'`.

- [ ] **Bước 5: test xanh**

```bash
pnpm turbo run test --filter=@tourism/admin -- xlsx
```
Kỳ vọng: PASS 5/5. Nếu địa chỉ ô trong test lệch với bố cục thật thì **sửa
test cho khớp bố cục**, đừng bẻ bố cục cho vừa test.

- [ ] **Bước 6: nối vào route**

`export-route.ts` thêm, cạnh `csvExportResponse`:

```ts
/** Content-Type chuẩn của .xlsx — thiếu nó thì trình duyệt đoán và Excel từ chối mở. */
export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Response tải file Excel — cùng ba dòng hợp đồng với trình duyệt như CSV. */
export function xlsxExportResponse(prefix: string, body: Buffer): Response {
  return new Response(body, {
    headers: {
      'content-type': XLSX_CONTENT_TYPE,
      'content-disposition': `attachment; filename="${exportFilename(prefix, isoDay(new Date()), 'xlsx')}"`,
      'cache-control': 'no-store',
    },
  });
}
```

⚠️ `csvFilename` hardcode đuôi `.csv`. Tách nó thành
`exportFilename(name, day, ext)` trong `csv.ts` và để `csvFilename` gọi lại —
hai chỗ tự làm sạch chuỗi là hai luật header injection phải giữ đồng bộ.

`route.ts` đổi dòng cuối thành:

```ts
  // Sheet Detail dùng LẠI `fetchAllAdminBookings` mà `/bookings/export` đang
  // dùng — nó đã ôm sẵn vòng lặp phân trang và luật dedupe (`lib/export-pages.ts`),
  // thứ vùng bookings đã trả giá hai vòng review để viết đúng. Khoảng ngày lấy
  // từ chính response báo cáo, không tự tính lại: `report.to` là mốc NỬA-MỞ nên
  // phải lùi 1ms rồi cắt ngày, đúng phép `reportPeriodLabel` đang làm.
  const lastDay = new Date(new Date(report.to).getTime() - 1).toISOString().slice(0, 10);
  const detail = await fetchAllAdminBookings(cookie, {
    page: 1,
    limit: BOOKINGS_PAGE_SIZE,
    from: report.from.slice(0, 10),
    to: lastDay,
  });

  return xlsxExportResponse(
    `nexora-report-${report.month}`,
    await buildReportWorkbook(report, detail.rows),
  );
```

⚠️ `fetchAllAdminBookings` có trần `EXPORT_MAX_ROWS`; đọc `detail` xem nó báo
cắt bớt thế nào và ghi `outcome: 'too-large'` vào `logExportAudit` đúng như
`/bookings/export` đang làm — một file thiếu hàng mà không để lại vết là thứ
không ai phát hiện được.

`reports-toolbar.tsx` đổi nhãn nút sang `t.exportExcel`; xoá key `exportCsv`
khỏi i18n nếu không còn ai dùng.

**KHÔNG đụng khối `@media print` của `globals.css` lẫn bố cục để-in của
`/reports`** (ADR-0034 §7): giấy để đọc và ký, Excel để cộng lại — bỏ một cái
để có cái kia là mất chứ không phải đổi. Nút *Print* ở toolbar giữ nguyên.

`csv.ts` sửa JSDoc: bỏ vế *"không thêm thư viện xlsx/PDF"* (nay sai) và trỏ
sang ADR-0034 cho ranh giới báo-cáo-thì-Excel-dữ-liệu-thì-CSV.

- [ ] **Bước 7: gate đầy đủ**

```bash
pnpm turbo run test typecheck --filter=@tourism/admin && pnpm lint
```
Kỳ vọng: xanh.

- [ ] **Bước 8: commit**

```bash
git add apps/admin package.json pnpm-lock.yaml
git commit -m "feat(admin): báo cáo tháng xuất Excel năm sheet thay cho CSV hai cột

Số ghi xuống là number kèm numFmt nên file vừa đọc như tiền vừa SUM
được — đúng cái đánh đổi mà ô CSV bắt phải chọn một. Sheet Detail có
autofilter để người đọc cộng tay kiểm chéo tổng ở Summary. Dùng lại
nguyên guardExportAccess/logExportAudit; /bookings và /subscribers giữ
CSV theo ranh giới ADR-0034."
git log -1 --format=%B | grep -i "co-authored\|generated"
```

---

### Task 10: Gate đầy đủ và docs sweep

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/README.md` (dòng trạng thái P4b F6)

- [ ] **Bước 1: gate:int đầy đủ**

⚠️ Build web/admin cần `.next` không bị dev server giữ. Nhờ user tắt
`:3000`/`:3002` trước, hoặc chạy khi máy rảnh.

```bash
docker start tourism-v2-postgres-1 && pnpm gate:int
```
Kỳ vọng: build + typecheck + unit + lint + int **tất cả xanh**. Đây là điều
kiện của luật 11 để khai xong.

- [ ] **Bước 2: entry CHANGELOG**

Một entry mới ở đầu `docs/CHANGELOG.md` theo khuôn đang có (ngày · dải hash ·
nội dung · số test). ⚠️ **KHÔNG để dấu `+` ở đầu dòng** — markdownlint sẽ đổi
nó thành `-` và biến một số hạng của phép cộng thành gạch đầu dòng. Gói cả
tổng test vào MỘT dòng.

- [ ] **Bước 3: `git diff` file .md trước khi stage**

```bash
git diff docs/CHANGELOG.md docs/README.md
```
Kỳ vọng: chỉ thấy phần mình viết. Có dòng cũ bị đổi `+`→`-` hoặc thêm dòng
trắng lạ → **revert phần đó**, entry cũ là bản ghi lịch sử bất biến.

- [ ] **Bước 4: kiểm freshness**

```bash
./scripts/docs-freshness.sh
```
Kỳ vọng: "✓ CHANGELOG cập nhật tới <hôm nay>".

- [ ] **Bước 5: commit**

```bash
git add docs
git commit -m "docs: entry CHANGELOG cho đợt mô hình tài chính và xuất Excel"
git log -1 --format=%B | grep -i "co-authored\|generated"
```

- [ ] **Bước 6: báo cáo, KHÔNG merge, KHÔNG push**

Báo user: dải hash, tổng test, và ba việc còn treo —
(1) `prisma migrate deploy` lên Supabase chờ user yêu cầu tường minh;
(2) `MARGIN_TAX_RATE`/`PAYMENT_FEE_RATE`/`PAYMENT_FEE_FIXED` mặc định 0 nên
dòng thuế và phí sẽ hiện 0.00 cho tới khi user khai giá trị thật;
(3) màn nhập giá vốn trong admin (`/tours`) và ghế hoà vốn (ADR-0033 §7) hoãn
sang phase `/tours`.

---

## Nợ để lại sau plan này

| Món | Vì sao hoãn |
| --- | --- |
| Màn nhập giá vốn trong admin | `/tours` đang `enabled: false` — dựng cả một vùng CRUD nằm ngoài đợt này. Dữ liệu tạm đến từ seed. |
| Ghế hoà vốn (ADR-0033 §7) | Tính được miễn phí nhưng chưa có màn nào hiển thị. Đi cùng phase `/tours`. |
| Vòng đời media / xoá Cloudinary | Bảng `media_garbage` có sẵn từ `init` và chưa ai chạm. ADR riêng — chạm cả tour/post/site media, và destroy là không hoàn tác. |
| Trang "My reviews" của khách | `reviews.mine` chưa có consumer nào bên web. |
| **Catalogue thiếu một tour** | Bắc 12 + Trung 9 + Nam 8 = **29**, trong khi roster spec cấp cho miền Nam dải #22–30 (9 tour) và mọi doc đều nói "30 tour". Lỗ dữ liệu CÓ TỪ TRƯỚC, phát hiện lúc viết test fixture giá vốn 05/09. |
| Phí hoàn tiền, chi phí vận hành | Ghi ở "Giới hạn đã biết" của ADR-0033. |
