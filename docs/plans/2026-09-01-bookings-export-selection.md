# Export theo lựa chọn cho `/bookings` — kế hoạch thi công

> **Cho người thi công:** spec nguồn là
> [2026-09-01-bookings-export-selection-design](../specs/2026-09-01-bookings-export-selection-design.md).
> Các bước dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Đưa nút Export vào trong bảng `/bookings` dưới dạng một cột, thêm cột
checkbox chọn hàng, và cho phép xuất CSV đúng các hàng đã tích thay vì luôn cả
tập.

**Architecture:** Việc chọn hàng khoá trong TRANG đang xem (phân trang là điều
hướng thật nên state client không sống qua trang). Nhờ vậy `page`+`limit` chính
là phạm vi của tập đã tích, và route export chỉ cần lấy một trang rồi giao theo
mã — không đụng contract, không đi bộ qua 2000 hàng.

**Tech Stack:** Next 16 App Router · TanStack Table v9 (`rowSelectionFeature`) ·
Tailwind v4 · Vitest + Testing Library · Biome.

## Global Constraints

- Comment code **tiếng Việt**; identifier tiếng Anh (CLAUDE.md #8).
- Copy user-facing **English**, gom trong `@tourism/i18n` (#7). Sửa i18n xong
  phải `pnpm turbo run build --filter=@tourism/i18n` thì test mới thấy key mới.
- **Tokens-only**, không hex (#6).
- Bảng admin đồng bộ một kiểu — sửa ở kit, cấm fork rút gọn (user chốt 31/08).
- Chạy `pnpm gate:int` trước khi khai xong (#11). `pnpm gate` trần không đủ.
- Không thêm dependency mới (freeze 15/10). *(Thực tế vòng này kéo `motion`
  — cùng bản với web — vào `apps/admin`; lý do và nợ ghi ở ADR-0027 §AMEND
  02/09.)*

## File Structure

| File | Trách nhiệm |
| --- | --- |
| `apps/admin/src/app/globals.css` | Thêm 2 token `--sidebar-cta*` + khai `@theme` |
| `apps/admin/src/components/nav-main.tsx` | Quick Create trắng → hover teal |
| `apps/admin/src/components/kit/table-features.ts` | Đăng ký thêm `rowSelectionFeature` |
| `apps/admin/src/lib/bookings-query.ts` | `bookingsExportHref` nhận thêm mã đã chọn |
| `apps/admin/src/lib/bookings-query.spec.ts` | Test href |
| `apps/admin/src/components/bookings/bookings-table.tsx` | Hai cột mới + state chọn |
| `apps/admin/src/components/bookings/bookings-toolbar.tsx` | Gỡ Export khỏi `actions`; nút nhận số đã chọn |
| `apps/admin/src/components/bookings/bookings-export-link.spec.tsx` | Test nhãn đếm |
| `apps/admin/src/components/bookings/bookings-selection.spec.tsx` | **Mới** — test cột checkbox |
| `apps/admin/src/app/(admin)/bookings/export/route.ts` | Nhánh `sel` + 409 |
| `libs/shared/i18n/src/lib/messages.ts` | Nhãn đếm, nhãn checkbox, câu 409 |

---

### Task 1: Quick Create trắng, hover teal

**Files:**
- Modify: `apps/admin/src/app/globals.css` (khối `[data-admin-surface]`)
- Modify: `apps/admin/src/components/nav-main.tsx`

**Interfaces:**
- Produces: token `--sidebar-cta`, `--sidebar-cta-foreground` và utility
  `bg-sidebar-cta` / `text-sidebar-cta-foreground`.

- [ ] **Step 1: Thêm token vào lớp đè admin**

Trong `globals.css`, ngay dưới khối `--sidebar-primary`:

```css
  /* Nút CTA trong sidebar: TRẮNG lúc nghỉ, teal khi hover (user chốt 01/09).
   * Không tái dùng `--sidebar-primary` vì nó đang nhuộm viên kim cương sau của
   * logo — đổi nó thành trắng là mất thế hai tông của mark (ADR-0027).
   * Đo: trắng/vỏ 14.19 · mực/trắng 15.43 · teal/vỏ 5.11 · mực/teal 5.55 —
   * một màu chữ DUY NHẤT dùng được cho cả hai trạng thái. */
  --sidebar-cta: oklch(1 0 0);
  --sidebar-cta-foreground: oklch(0.262 0.014 250);
```

- [ ] **Step 2: Khai `@theme` để Tailwind sinh utility**

Cuối `globals.css`, TRƯỚC khối `@media print`:

```css
/* Tailwind v4 chỉ sinh utility cho biến nằm trong `@theme`. Hai token trên là
 * của riêng admin nên `@tourism/tokens` không khai hộ. */
@theme inline {
  --color-sidebar-cta: var(--sidebar-cta);
  --color-sidebar-cta-foreground: var(--sidebar-cta-foreground);
}
```

- [ ] **Step 3: Đổi class nút**

Trong `nav-main.tsx`, thay className của `SidebarMenuButton` "Quick Create":

```tsx
className="min-w-8 bg-sidebar-cta text-sidebar-cta-foreground duration-200 ease-linear hover:bg-sidebar-primary hover:text-sidebar-primary-foreground active:bg-sidebar-primary active:text-sidebar-primary-foreground"
```

- [ ] **Step 4: Kiểm**

Run: `pnpm lint && pnpm turbo run typecheck --filter=@tourism/admin`
Expected: sạch, 4/4 task.
Nghiệm thu bằng mắt trên `:3002` — nút trắng, rê chuột thành teal.

---

### Task 2: Đăng ký `rowSelectionFeature`

**Files:**
- Modify: `apps/admin/src/components/kit/table-features.ts`

**Interfaces:**
- Produces: `serverTableFeatures` nay có `rowSelectionFeature`, nên
  `table.getIsAllPageRowsSelected()`, `getIsSomePageRowsSelected()`,
  `toggleAllPageRowsSelected(value)`, `row.getIsSelected()`,
  `row.toggleSelected(value)`, `table.getSelectedRowModel()` dùng được.

- [ ] **Step 1: Thêm feature và sửa chú thích**

```ts
import { columnVisibilityFeature, rowSelectionFeature, tableFeatures } from '@tanstack/react-table';

/**
 * Bộ feature TanStack v9 cho bảng admin ĐỌC TỪ SERVER (spec P4b §2.2).
 *
 * - `columnVisibilityFeature`: menu ẩn/hiện cột, thuần client.
 * - `rowSelectionFeature` (01/09): cột checkbox của `/bookings` để xuất CSV
 *   đúng các hàng đã tích.
 *
 * Chú thích cũ ghi "chỉ đăng ký ĐÚNG MỘT feature" — luật thật đằng sau nó là
 * "đừng đăng ký thứ không ai đọc" (review 31/08 gỡ `rowPaginationFeature` vì
 * nó thành state controlled chết không handler). Lần này KHÁC: cột checkbox
 * đọc thật `getIsAllPageRowsSelected`/`toggleSelected`.
 *
 * CỐ Ý vẫn KHÔNG có pagination lẫn row model filtered/sorted: trạng thái trang
 * sống TRÊN URL, lọc/sắp xếp/cắt trang là việc của API — row model client chỉ
 * nhìn thấy đúng một trang nên mọi phép nó làm đều sai phạm vi.
 */
export const serverTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
});
```

- [ ] **Step 2: Kiểm không vỡ ba bảng đang dùng**

Run: `pnpm turbo run typecheck test --filter=@tourism/admin`
Expected: 31 file · 362 test pass.

---

### Task 3: `bookingsExportHref` nhận mã đã chọn (TDD)

**Files:**
- Modify: `apps/admin/src/lib/bookings-query.ts:172`
- Test: `apps/admin/src/lib/bookings-query.spec.ts`

**Interfaces:**
- Produces: `bookingsExportHref(query: BookingsQuery, selected?: readonly string[]): string`
- Produces: `EXPORT_SELECTION_PARAM = 'sel'`

- [ ] **Step 1: Viết test đỏ**

```ts
describe('bookingsExportHref — chọn hàng (01/09)', () => {
  it('không chọn gì: URL như cũ — cả tập đang lọc, KHÔNG mang page/limit', () => {
    const href = bookingsExportHref({ page: 3, limit: 20, status: 'PAID' });

    expect(href).toBe('/bookings/export?status=PAID');
  });

  it('có chọn: mang page+limit+sel để route khoanh đúng trang đang xem', () => {
    const href = bookingsExportHref({ page: 3, limit: 20, status: 'PAID' }, ['BK-A', 'BK-B']);

    expect(href).toBe('/bookings/export?status=PAID&page=3&limit=20&sel=BK-A%2CBK-B');
  });

  it('mảng chọn RỖNG cũng là "không chọn gì" — đừng đẻ ra sel= trống', () => {
    expect(bookingsExportHref({ page: 1, limit: 20 }, [])).toBe('/bookings/export');
  });
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd apps/admin && pnpm vitest run src/lib/bookings-query.spec.ts`
Expected: FAIL — hàm hiện chỉ nhận một tham số.

- [ ] **Step 3: Sửa hàm**

```ts
/** Tên tham số mang danh sách mã đã tích — dùng chung với route export. */
export const EXPORT_SELECTION_PARAM = 'sel';

/**
 * URL tải CSV. KHÔNG mang `page`/`limit` ở ca export-all: file là CẢ tập lọc,
 * không phải trang đang xem.
 *
 * Có `selected` thì NGƯỢC LẠI — phải mang cả hai. Việc chọn hàng khoá trong
 * trang đang xem (phân trang là điều hướng thật nên tích không sống qua trang),
 * nên `page`+`limit` chính là phạm vi của tập đã tích, và route chỉ cần lấy
 * đúng một trang rồi giao theo mã.
 */
export function bookingsExportHref(
  query: BookingsQuery,
  selected?: readonly string[],
): string {
  const params = new URLSearchParams();
  appendFilters(params, query);
  if (selected?.length) {
    params.set('page', String(query.page));
    params.set('limit', String(query.limit));
    params.set(EXPORT_SELECTION_PARAM, selected.join(','));
  }
  return tableHref('/bookings/export', params);
}
```

- [ ] **Step 4: Chạy lại**

Run: `cd apps/admin && pnpm vitest run src/lib/bookings-query.spec.ts`
Expected: PASS.

---

### Task 4: Copy i18n

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `admin.bookings.list`)

**Interfaces:**
- Produces: `t.exportCsv` (đã có), `t.exportSelected(n)`, `t.selectAllRows`,
  `t.selectRow(code)`, và `messages.admin.errors.exportSelectionStale`.

- [ ] **Step 1: Thêm key**

Cạnh `exportCsv` trong `admin.bookings.list`:

```ts
        /**
         * Nhãn nút khi ĐANG có hàng được tích. Nói rõ số hàng vì người bấm
         * phải biết mình sắp tải về cái gì TRƯỚC cú bấm — "Export CSV" trong
         * lúc tích 3 hàng là một lời hứa mơ hồ.
         */
        exportSelected: (n: number) => `Export ${n} ${n === 1 ? 'row' : 'rows'}`,
        /** Checkbox ở hàng tiêu đề. Nói "on this page" vì đó là SỰ THẬT: tích
         * không sống qua trang (phân trang là điều hướng thật). */
        selectAllRows: 'Select all rows on this page',
        selectRow: (code: string) => `Select booking ${code}`,
```

Trong `admin.errors`:

```ts
      /**
       * BODY của response 409 khi `sel` không khớp hàng nào. Trả CSV chỉ có
       * dòng tiêu đề là nói dối — người tải tưởng tập rỗng là sự thật.
       */
      exportSelectionStale:
        'Those rows are no longer on this page — the list changed since you selected them. Go back, pick the rows again, then export.',
```

- [ ] **Step 2: Build lại i18n**

Run: `pnpm turbo run build --filter=@tourism/i18n`
Expected: thành công. (Bỏ bước này thì test đọc key mới sẽ thấy `undefined`.)

---

### Task 5: Hai cột mới + state chọn (TDD)

**Files:**
- Modify: `apps/admin/src/components/bookings/bookings-table.tsx`
- Modify: `apps/admin/src/components/bookings/bookings-toolbar.tsx`
- Test: `apps/admin/src/components/bookings/bookings-selection.spec.tsx` (mới)

**Interfaces:**
- Consumes: `bookingsExportHref(query, selected)` từ Task 3;
  `serverTableFeatures` có row selection từ Task 2.
- Produces: `BookingsExportLink` đổi chữ ký thành
  `{ query, total, selected }` với `selected: readonly string[]`.

- [ ] **Step 1: Viết test đỏ**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { BookingsTable } from './bookings-table';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const t = messages.admin.bookings.list;

const ROWS = [
  { code: 'BK-A', tourTitle: 'Ha Long', statusLabel: 'Paid', status: 'PAID',
    guests: '2 adults', amount: '$49.00', customerName: 'Ada', customerEmail: 'a@x.test' },
  { code: 'BK-B', tourTitle: 'Sapa', statusLabel: 'Paid', status: 'PAID',
    guests: '1 adult', amount: '$29.00', customerName: 'Bob', customerEmail: 'b@x.test' },
];

function view() {
  return render(
    <BookingsTable rows={ROWS} query={{ page: 1, limit: 20 }} total={2} totalPages={1} />,
  );
}

describe('BookingsTable — chọn hàng để export', () => {
  it('chưa tích gì: nút xuất CẢ TẬP đang lọc', () => {
    view();
    const link = screen.getByRole('link', { name: new RegExp(t.exportCsv) });

    expect(link).toHaveAttribute('href', '/bookings/export');
  });

  it('tích một hàng: nhãn đếm đúng và href mang sel', async () => {
    const user = userEvent.setup();
    view();

    await user.click(screen.getByRole('checkbox', { name: t.selectRow('BK-A') }));

    const link = screen.getByRole('link', { name: new RegExp(t.exportSelected(1)) });
    expect(link).toHaveAttribute('href', '/bookings/export?page=1&limit=20&sel=BK-A');
  });

  it('checkbox tiêu đề chọn CẢ TRANG, bấm lại thì bỏ hết', async () => {
    const user = userEvent.setup();
    view();
    const all = screen.getByRole('checkbox', { name: t.selectAllRows });

    await user.click(all);
    expect(screen.getByRole('link', { name: new RegExp(t.exportSelected(2)) })).toBeInTheDocument();

    await user.click(all);
    expect(screen.getByRole('link', { name: new RegExp(t.exportCsv) })).toBeInTheDocument();
  });

  it('tích lẻ: checkbox tiêu đề ở trạng thái MỘT PHẦN, không phải đã-chọn', async () => {
    const user = userEvent.setup();
    view();

    await user.click(screen.getByRole('checkbox', { name: t.selectRow('BK-A') }));

    expect(screen.getByRole('checkbox', { name: t.selectAllRows })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
  });
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd apps/admin && pnpm vitest run src/components/bookings/bookings-selection.spec.tsx`
Expected: FAIL — chưa có checkbox nào.

- [ ] **Step 3: Thêm hai cột hiển thị**

Trong `bookings-table.tsx`, `columns` thêm ĐẦU danh sách:

```tsx
  columnHelper.display({
    id: 'select',
    // Tiêu đề chọn CẢ TRANG — đúng phạm vi sống của việc tích: phân trang là
    // điều hướng thật nên state này chết mỗi lần sang trang.
    header: ({ table }) => (
      <Checkbox
        aria-label={t.selectAllRows}
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={t.selectRow(row.original.code)}
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
  }),
```

và CUỐI danh sách (sau `customerName`):

```tsx
  columnHelper.display({
    id: 'export',
    // Ô thân TRỐNG: cột tồn tại để nút ở hàng tiêu đề có chỗ đứng cố định,
    // không trôi theo độ rộng cột Customer (user chốt 01/09).
    header: () => null,
    cell: () => null,
  }),
```

Nút thật được lắp ở Step 4 — `header` cần `query`/`total` mà `columns` ở cấp
module không có.

- [ ] **Step 4: Nối state chọn và bơm nút vào header cột `export`**

Trong `BookingsTable`:

```tsx
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns,
    state: { columnVisibility, rowSelection },
    getRowId: (row) => row.code,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
  });

  // Khoá chọn CHÍNH LÀ mã booking (`getRowId` ở trên), nên không phải ánh xạ
  // gì thêm để dựng `sel`.
  const selected = Object.keys(rowSelection).filter((code) => rowSelection[code]);
```

Truyền `selected` xuống `BookingsExportLink`, và render nút trong ô tiêu đề
cột `export` bằng `meta` của table — hoặc đơn giản hơn: giữ `header: () => null`
ở cấp module rồi bọc `DataTableBody` như hiện tại, và đặt nút bằng cách cho
`columns` nhận tham số. Chọn cách thứ hai để không thêm khái niệm `meta`:

```tsx
// Đổi `columns` ở cấp module thành factory nhận phần nút — cùng nếp
// `buildColumns(decide)` của cancellations/reviews.
function buildColumns(exportAction: React.ReactNode) { /* … */ }
```

- [ ] **Step 5: Sửa `BookingsExportLink` nhận `selected`**

```tsx
export function BookingsExportLink({
  query,
  total,
  selected,
}: {
  query: BookingsQuery;
  total: number;
  /** Mã các hàng đã tích trên TRANG ĐANG XEM; rỗng nghĩa là xuất cả tập lọc. */
  selected: readonly string[];
}) {
  const label = selected.length ? t.exportSelected(selected.length) : t.exportCsv;

  // Trần 2000 chỉ áp cho ca export-all: có tích thì số hàng ≤ limit (tối đa
  // 100), nút không bao giờ đáng bị tắt.
  if (!selected.length && total > EXPORT_MAX_ROWS) {
    return (
      <span title={t.exportTooLarge(total, EXPORT_MAX_ROWS)}>
        <Button type="button" variant="outline" className={TOOLBAR_BUTTON} disabled>
          <DownloadIcon data-icon="inline-start" aria-hidden="true" />
          {label}
        </Button>
      </span>
    );
  }
  return (
    <ButtonLink
      variant="outline"
      className={TOOLBAR_BUTTON}
      href={bookingsExportHref(query, selected)}
    >
      <DownloadIcon data-icon="inline-start" aria-hidden="true" />
      {label}
    </ButtonLink>
  );
}
```

- [ ] **Step 6: Gỡ Export khỏi khe `actions`**

Trong `bookings-table.tsx`, khe `actions` chỉ còn search + date range +
`ColumnVisibilityMenu`.

- [ ] **Step 7: Chạy test**

Run: `cd apps/admin && pnpm vitest run src/components/bookings/`
Expected: PASS toàn bộ, kể cả `bookings-export-link.spec.tsx` cũ (đã sửa cho
chữ ký mới).

---

### Task 6: Route export xử `sel` + 409

**Files:**
- Modify: `apps/admin/src/app/(admin)/bookings/export/route.ts`

**Interfaces:**
- Consumes: `EXPORT_SELECTION_PARAM` từ Task 3;
  `messages.admin.errors.exportSelectionStale` từ Task 4.

- [ ] **Step 1: Đọc `sel` và rẽ nhánh**

Ngay sau khi có `query`:

```ts
  // Mã đã tích trên trang đang xem. Có nó thì đây là cú xuất CÓ CHỌN: chỉ lấy
  // ĐÚNG MỘT trang (query đã mang page/limit) rồi giao theo mã — không đi bộ
  // qua cả tập như đường export-all.
  const selected = (request.nextUrl.searchParams.get(EXPORT_SELECTION_PARAM) ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
```

- [ ] **Step 2: Nhánh có chọn**

```ts
  if (selected.length) {
    let page: Awaited<ReturnType<typeof fetchAdminBookings>>;
    try {
      page = await fetchAdminBookings(cookie, query);
    } catch (error) {
      console.error('[admin] bookings export (selection) failed', error);
      return new Response(messages.admin.errors.exportFailed, { status: 502 });
    }

    const wanted = new Set(selected);
    const rows = page.items.filter((item) => wanted.has(item.code));

    // Không khớp hàng nào: trang đã đổi dưới chân admin. Trả CSV chỉ có dòng
    // tiêu đề là nói dối — người tải tưởng tập rỗng là sự thật.
    if (!rows.length) {
      return new Response(messages.admin.errors.exportSelectionStale, { status: 409 });
    }

    console.info(
      '[admin] bookings export',
      JSON.stringify({
        adminId: session?.id ?? null,
        rows: rows.length,
        mode: 'selection',
        filters: {
          status: query.status ?? null,
          search: query.search ? '<set>' : null,
          from: query.from ?? null,
          to: query.to ?? null,
        },
      }),
    );

    const filename = csvFilename('nexora-bookings', isoDay(new Date()));
    return new Response(csvDocument(bookingsCsvRows(rows)), {
      headers: csvAttachmentHeaders(filename),
    });
  }
```

Phần export-all bên dưới giữ nguyên không đụng.

- [ ] **Step 2b: Kiểm kiểu hàng trả về**

`fetchAdminBookings` trả trang có `items: AdminBooking[]`, còn
`bookingsCsvRows` nhận mảng booking của đường export (`includeMedia: false`).
Nếu hai kiểu lệch, ép về đúng kiểu `bookingsCsvRows` cần — KHÔNG nới kiểu của
`bookingsCsvRows`.

- [ ] **Step 3: Kiểm**

Run: `pnpm turbo run typecheck --filter=@tourism/admin`
Expected: 4/4 task.

---

### Task 7: Gate đầy đủ + nghiệm thu tay

- [ ] **Step 1: Gate**

Run: `pnpm lint && pnpm turbo run typecheck test`
Expected: 18/18 task, biome sạch.

- [ ] **Step 2: `gate:int`** (cần dừng dev server của user trước)

Run: `pnpm gate:int`
Expected: xanh.

- [ ] **Step 3: Nghiệm thu tay trên `:3002`** — theo §7 của spec

- [ ] Hàng điều khiển `/bookings` không xuống dòng ở 1280px khi bật lọc ngày
- [ ] Không tích gì → file y hệt hành vi cũ
- [ ] Tích 2 hàng → file đúng 2 hàng, kể cả khi đang lọc trạng thái + ngày
- [ ] Sang trang → tích reset, nút quay về `Export CSV`
- [ ] Quick Create trắng, hover teal

## Tự soát kế hoạch

**Phủ spec:** §3.1 → Task 5 Step 6 · §3.2 → Task 5 Step 3 · §3.3 → Task 4 +
Task 5 Step 5 · §3.4 → Task 1 · §4.1 → Task 3 · §4.2 → Task 6 (không đụng
contract) · §4.3 → Task 5 Step 5 · §5 → Task 6 Step 2 · §6 → Task 3 Step 1 và
Task 5 Step 1 · §7 → Task 7.

**Chỗ còn hở đã biết:** Task 5 Step 4 có hai cách lắp nút vào header
(`meta` của table vs factory `buildColumns`) — chốt dùng factory cho khớp nếp
`cancellations`/`reviews` đã có. Người thi công không được tự chọn cách khác.

**Nhất quán tên:** `bookingsExportHref(query, selected)` ·
`EXPORT_SELECTION_PARAM` · `t.exportSelected(n)` · `t.selectAllRows` ·
`t.selectRow(code)` · `exportSelectionStale` — dùng đúng các tên này ở mọi task.
