# G40 Phần 3 — Excel báo cáo tháng D1 và danh sách xuất Excel thay CSV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** File Excel báo cáo tháng của admin trình bày theo bản thảo D1 (Summary dạng dashboard có
thanh `REPT`, khung in A4 có đầu và chân trang, metadata, ngày ép tiếng Anh), và hai nút xuất danh
sách (`/bookings`, `/subscribers`) trả `.xlsx` thay cho CSV — mở đúng bằng bấm đúp trên máy Windows
tiếng Việt.

**Architecture:** Một bộ đồ nghề chung `lib/xlsx-style.ts` (màu dẫn xuất từ token, font, định
dạng số và ngày, khung trang in, ghi ô tiền và giờ Việt Nam, hàng tiêu đề, hàng `SUBTOTAL`) cho cả
ba workbook. `lib/xlsx.ts` dựng lại báo cáo tháng theo D1; `lib/bookings-xlsx.ts` và
`lib/subscribers-xlsx.ts` thay `bookings-csv.ts` và `subscribers-csv.ts`. Ba route handler giữ
nguyên hạ tầng xuất (gác quyền, audit, trần 2000 hàng, chọn hàng, `maxDuration`), chỉ đổi phần dựng
file. Mọi builder THUẦN: nhận dữ liệu, trả `ArrayBuffer`; test mở lại chính buffer bằng ExcelJS.

**Tech Stack:** Next.js 16 route handlers · ExcelJS 4.4.0 (đã có, ghim cứng) · Vitest 4 (project
`node` cho `src/lib/**/*.spec.ts`, `dom` cho `src/components/**/*.spec.tsx`) · `@tourism/i18n` ·
`@tourism/contract` · Biome.

**Spec:** [docs/specs/2026-10-10-print-and-export-redesign-design.md](../specs/2026-10-10-print-and-export-redesign-design.md)
§6 (Excel D1), §7 (danh sách xuất), §8 (chữ), §9 (kiểm thử) — HỢP ĐỒNG của việc này. Quyết định:
[ADR-0034](../adr/0034-excel-report-export.md) AMEND 3 (và AMEND 1–2 còn hiệu lực: tiền là số, màu
dẫn xuất từ token, `maxDuration`, vùng lọc tới hàng cuối). Bản vẽ đã duyệt (bất biến, chỉ đọc):
[excel-report-d1.xlsx](../design/mockups/excel-report-d1.xlsx). Bố cục ô của Summary trong plan chép
từ chính script đã dựng file ấy (cột, hàng, cỡ chữ, viền, công thức).

## Global Constraints

- **Phạm vi Phần 3:** `apps/admin` và `libs/shared/i18n` (CHỈ khối `admin.*`). Không đổi API,
  contract, DB, `apps/web`, `apps/mobile`, `libs/shared/ui`, `libs/shared/tokens`. Phần 1 (bản in web)
  chạy SONG SONG ở nhánh khác và cũng sửa `messages.ts` (khối `printDoc`, `booking.success`) —
  đừng format lại, đừng di chuyển khối nào ngoài `admin.*`, để hai nhánh ghép không xung đột.
- **Không thêm dependency** (freeze 15/10). `exceljs@4.4.0` đã có trong `apps/admin`.
- **Không chạm hạ tầng sống** (luật 15): không deploy, không Supabase, Render, Vercel, env.
  Không push, không merge — session gốc làm sau review.
- **TDD** (luật 4): test trước, thấy ĐỎ đúng lý do, code tối thiểu, thấy XANH. Mỗi ca test mới
  **thử đột biến** một lần (sửa mã cho sai, thấy ca đỏ, trả lại bằng tay) và ghi kết quả vào báo cáo.
  Không trả đột biến bằng `git checkout`/`git restore` khi còn thay đổi chưa commit.
- **Comment tiếng Việt** (luật 8); identifier tiếng Anh. Chữ người dùng thấy — kể cả nhãn cột, tên
  sheet, đầu và chân trang của file — tiếng Anh trong `@tourism/i18n` (luật 7).
- **Hex ARGB chỉ được sống ở `lib/xlsx-style.ts`**, mỗi hằng hoặc là token quy đổi (ghi `oklch`
  gốc), hoặc dẫn xuất từ token có công thức (ADR-0034 AMEND 1b, 2d) — ngoại lệ có chủ đích của luật
  tokens-only vì `.xlsx` không có CSS. Không bịa màu.
- **Tiền:** `Number()` CHỈ ở lớp ghi ô (`money`, `sumMoney` trong `xlsx-style.ts`) — không phép tính
  tiền nào ở chỗ khác (CLAUDE.md: tiền không đi qua float).
- **Không merge ô trong vùng dữ liệu** (ADR-0034 §4): merge chỉ ở Summary dạng dashboard và dòng ghi
  chú của sheet Detail.
- **Biome là formatter và linter DUY NHẤT** (`pnpm exec biome check --write <file>`); không
  Prettier, ESLint; không `--no-verify`.
- **Commit Conventional, tiếng Việt CÓ DẤU, KHÔNG dòng `Co-Authored-By` hay attribution AI**
  (luật 12). Stage bằng đường dẫn tường minh (có ngoặc thì đặt trong nháy kép), không `git add -A`.
- **`@tourism/i18n` đọc từ `dist`:** sửa xong phải build lại trước khi test admin.
- **Hãm tài nguyên:** vitest admin `--maxWorkers=2`; KHÔNG chạy `pnpm gate`/`gate:int` trong task.
- **Next.js 16** (`apps/admin/AGENTS.md`): đọc doc route handler trong
  `apps/admin/node_modules/next/dist/docs/` trước khi sửa `route.ts`.
- **Test khớp chữ chính xác** (không `/…/i`); chữ đến từ i18n thì so bằng chính khoá i18n.
- **Không sửa** `docs/design/mockups/*`; không dòng `.md` nào bắt đầu bằng `+`.

---

## Điều kiện bắt đầu

1. Worktree `.claude/worktrees/admin-excel`, nhánh `feat/admin-excel` — session gốc tạo sẵn từ `main`
   (ở commit [prompt thi công](2026-10-10-g40-part3-admin-excel-prompt.md)); session thi công mở ngay
   tại đó, không tạo worktree mới.
2. Chép `apps/admin/.env.local` (và `apps/api/.env.local` nếu có) DEV từ checkout gốc vào worktree;
   không bao giờ đọc hay chép `.env.production`.
3. `pnpm install --frozen-lockfile`, rồi build gói admin đọc từ dist:
   `pnpm turbo run build --filter="@tourism/admin^..." --concurrency=1 --output-logs=errors-only`.
4. Chạy thử: `pnpm --filter @tourism/admin exec vitest run src/lib/xlsx.spec.ts --maxWorkers=2` — xanh.

## Lệnh hay dùng

```bash
pnpm --filter @tourism/admin exec vitest run <file…> --maxWorkers=2
pnpm --filter @tourism/i18n exec vitest run src/lib/messages.spec.ts
pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only
pnpm --filter @tourism/admin typecheck
pnpm exec biome check --write <file…>
```

## Quyết định của plan

1. **Bố cục Summary chép từ script dựng bản thảo D1** (cột A–I rộng `2,14,14,13,14,13,13,13,14`;
   tiêu đề B2:I2 Cambria 20; dòng kỳ B3:I3; bốn ô số hàng 5–7; "From revenue to net profit" từ hàng 9;
   "Bookings created this month"; "Money and operations" hai cột; dòng chỉ sang Definitions). Ảnh chụp
   bản thảo đã duyệt nằm ở scratchpad của session gốc — session gốc đối chiếu khi review.
2. **Bảy dòng thác nước** (không có "Total cost of sales"): Revenue recognised · Cost of sales — per
   traveller · per departure · Gross profit · Tax on margin (x%) · Payment processing · Net profit. Dòng
   chi phí ghi SỐ ÂM (`money(…, { negate: true })`) để cột đọc như sổ kế toán.
3. **Công thức thanh** đúng spec §6.2, thêm chốt chia cho 0: thác nước
   `IF($E$11=0,"",REPT("█",MAX(1,ROUND(ABS(E{r})/$E$11*30,0))))`; trạng thái
   `IF(C{r}=0,"",REPT("█",MAX(1,ROUND(D{r}*40,0))))` và Share `IF($C${tổng}=0,0,C{r}/$C${tổng})`.
   Mỗi ô công thức ghi kèm `result` (giá trị đệm cho trình xem không tự tính) và workbook bật
   `fullCalcOnLoad`.
4. **Màu thanh:** dòng chi phí `COST`; dòng tổng, tổng phụ, lãi ròng `GAIN` — trừ khi số ÂM (tháng
   lỗ) thì `COST` (cùng luật "lãi âm" của bản in, spec §5.2). Trạng thái: Paid `GAIN`, Cancelled `COST`,
   còn lại `DIM`. Chữ "Cancelled" ở Detail và danh sách booking màu `COST`.
5. **Cảnh báo thiếu giá vốn giữ trong file:** `costWarning(report)` khác `null` thì thêm một dòng
   nghiêng màu `COST` ngay dưới dòng "n departures ran this month" — bản cũ có hai ô đếm, D1 không có
   chỗ cho chúng, mà bỏ hẳn là để file nói "lãi gộp $X" khi giá vốn thiếu.
6. **Ô số đầu có ký hiệu `$` khi `currency` là USD** (`"$"#,##0.00;("$"#,##0.00)`), đơn vị khác thì
   định dạng tiền thường — dòng kỳ đã nói "all amounts in {currency}" (ADR-0034 giới hạn 3).
7. **Sheet dữ liệu (Bookings, Operations, Detail, hai danh sách):** hiện lưới, hàng tiêu đề nền thương
   hiệu chữ trắng canh trái, sọc nền `BAND` ở hàng chẵn, đóng băng hàng 1, KHÔNG kẻ viền từng ô (D1
   dùng lưới thay viền). Viền bốn cạnh của AMEND 1b thôi áp — AMEND 3 mục 5 chốt D1.
8. **Dòng ghi chú của Detail dời xuống DƯỚI bảng** (sau hàng Total, cách một hàng): luật AMEND 2b
   (file phải tự nói vì sao thiếu hàng hay lệch số) giữ nguyên, nhưng dòng ấy không còn nằm TRONG vùng
   lọc — ô merge trong vùng lọc làm Excel từ chối sắp xếp, còn ô không merge thì bị sắp xếp lẫn vào dữ
   liệu. Khi bảng trống (vượt trần, tập đổi) dòng ghi chú vẫn là hàng 2, ngay dưới tiêu đề như cũ.
9. **Vùng `autoFilter` tới hàng DỮ LIỆU cuối, không gồm hàng Total** — gồm thì sắp xếp kéo hàng tổng
   lên giữa bảng. Bảng trống thì không có hàng Total.
10. **Giờ Việt Nam:** mốc ISO cộng 7 giờ rồi ghi `Date` (ExcelJS ghi theo UTC, Excel không có múi giờ),
    định dạng `[$-409]d mmm yyyy hh:mm`; tiêu đề cột ghi "(Vietnam time)". Ngày lịch (`YYYY-MM-DD`)
    ghi nửa đêm UTC, định dạng `[$-409]d mmm yyyy`.
11. **Mã đơn là hyperlink** `{origin admin}/bookings/{code}` — origin lấy từ `request.nextUrl.origin`
    của route (dev `http://localhost:3002`, prod `https://admin.nexora-travel.agency`), truyền vào
    builder; builder không đoán domain.
12. **Đầu và chân trang khi in** của mọi sheet: `&L Nexora back office &C {tên tài liệu} &R Internal —
    not for distribution`; `&L Generated {giờ tạo, UTC} &R Page &P of &N`. Chữ có `&` thì nhân đôi;
    phần giữa dài quá 100 ký tự thì cắt kèm `…` (Excel giới hạn 255 ký tự cả mã).
13. **Tab:** Summary `BRAND`, Definitions `RULE` (xám nhạt), sheet còn lại và hai danh sách `DIM`.
14. **Khoá i18n dùng chung với Phần 2 (bản in C2):** `admin.reports.reportTitle`, `periodLine`,
    `waterfallHeading`, `cards.recognizedCaption`, `cards.netCaption`, `cards.paidCaption` khai ở cấp
    `admin.reports` để bản in giấy dùng lại; khung file chung ở namespace mới `admin.exportFile`.
15. **Xoá khoá cũ đúng lúc consumer cuối biến mất:** `admin.reports.xlsx.{title, period, generatedAt,
    currency, taxRate, cashHeading, grossMargin, departuresRun, costDataMissing,
    departuresCostMissing}` ở Task 4; `admin.bookings.csv`, `admin.subscribers.csv` ở Task 7;
    `admin.bookings.list.exportCsv`, `admin.subscribers.list.exportCsv` ở Task 8.
16. **`isoDay` và `exportFilename` dời từ `csv.ts` sang `export-route.ts`** (cùng test), vì
    `xlsxExportResponse` dùng chúng và `csv.ts` bị gỡ.
17. **Xuất theo lựa chọn:** đầu trang ghi thêm "{n} selected row(s)" sau tóm tắt bộ lọc.

## Bản đồ file

| File | Việc |
| --- | --- |
| `libs/shared/i18n/src/lib/messages.ts`, `messages.spec.ts` | Khoá mới `admin.*` (Task 1); xoá khoá cũ (Task 4, 7, 8) |
| `apps/admin/src/lib/xlsx-style.ts` (+ spec) | Bộ đồ nghề Excel dùng chung (Task 2) |
| `apps/admin/src/lib/xlsx.ts`, `xlsx-summary.spec.ts` | Workbook báo cáo: metadata, khung, Summary D1 (Task 3) |
| `apps/admin/src/lib/xlsx.ts`, `xlsx.spec.ts`, `app/(admin)/reports/export/route.ts` | Bốn sheet còn lại, hyperlink, route truyền origin (Task 4) |
| `apps/admin/src/lib/bookings-xlsx.ts` (+ spec) | Danh sách booking (Task 5) |
| `apps/admin/src/lib/subscribers-xlsx.ts` (+ spec) | Danh sách subscriber (Task 6) |
| `app/(admin)/bookings/export/route.ts`, `app/(admin)/subscribers/export/route.ts`, `lib/export-route.ts` (+ spec), `lib/export-route-xlsx.spec.ts`; XOÁ `lib/csv.ts`, `lib/bookings-csv.ts`, `lib/subscribers-csv.ts` và spec | Route trả Excel, gỡ CSV (Task 7) |
| `components/bookings/bookings-toolbar.tsx`, `components/subscribers/subscribers-export-link.tsx`, `components/kit/export-button.tsx`, 4 spec component, các comment còn nhắc CSV | Nhãn "Export Excel", quét chữ CSV (Task 8) |

## Giao diện dùng chung

```ts
// apps/admin/src/lib/xlsx-style.ts
export const INK, DIM, RULE, BAND, BRAND, BRAND_SOFT, PAPER, GAIN, COST, WHITE: string; // ARGB
export const BODY_FONT = 'Calibri', HEAD_FONT = 'Cambria', MONO_FONT = 'Consolas';
export const MONEY_FMT = '#,##0.00;(#,##0.00)', COUNT_FMT = '#,##0', PCT_FMT = '0.0%';
export const DATE_FMT = '[$-409]d mmm yyyy', DATETIME_FMT = '[$-409]d mmm yyyy hh:mm';
export function fill(argb: string): ExcelJS.FillPattern;
export function thin(argb?: string): Partial<ExcelJS.Border>;
export function bodyFont(overrides?: Partial<ExcelJS.Font>): Partial<ExcelJS.Font>;
export function money(cell: ExcelJS.Cell, decimal: string, options?: { negate?: boolean }): void;
export function count(cell: ExcelJS.Cell, value: number): void;
export function sumMoney(values: readonly string[]): number;
export function calendarDate(ymd: string): Date;
export function vietnamDateTime(iso: string): Date;
export function headerText(text: string): string;
export function printFrame(center: string, generatedAt: string): Partial<ExcelJS.HeaderFooter>;
export interface SheetOptions { tab: string; grid: boolean; landscape?: boolean; frame: Partial<ExcelJS.HeaderFooter> }
export function addSheet(book: ExcelJS.Workbook, name: string, options: SheetOptions): ExcelJS.Worksheet;
export function freezeHeader(sheet: ExcelJS.Worksheet, grid: boolean): void;
export function headerRow(sheet: ExcelJS.Worksheet, labels: readonly string[]): void;
export function stripe(row: ExcelJS.Row, columns: number, index: number): void;
export function stampWorkbook(book: ExcelJS.Workbook, meta: { title: string; subject: string; created: Date }): void;
export function bookingLink(cell: ExcelJS.Cell, code: string, adminOrigin: string): void;
export interface SubtotalColumn { column: number; result: number; numFmt: string }
export function subtotalRow(sheet: ExcelJS.Worksheet, label: string, range: { first: number; last: number }, width: number, columns: readonly SubtotalColumn[]): void;

// apps/admin/src/lib/xlsx.ts
export async function buildReportWorkbook(
  report: AdminMonthlyReport,
  bookings: readonly Booking[],
  options: { detailNote?: string; adminOrigin: string }, // Task 4 (Task 3 còn tham số thứ ba là detailNote)
): Promise<ArrayBuffer>;

// apps/admin/src/lib/bookings-xlsx.ts
export const BOOKINGS_XLSX_HEADER: readonly string[]; // 18 cột
export function bookingsFilterSummary(query: BookingsQuery, selected: number): string;
export async function buildBookingsWorkbook(
  bookings: readonly Booking[],
  options: { query: BookingsQuery; selected: number; adminOrigin: string; generatedAt: string },
): Promise<ArrayBuffer>;

// apps/admin/src/lib/subscribers-xlsx.ts
export const SUBSCRIBERS_XLSX_HEADER: readonly string[]; // 6 cột
export function subscriberStatus(row: Pick<SubscriberRow, 'confirmedAt' | 'unsubscribedAt'>): string;
export function subscribersFilterSummary(query: SubscribersQuery): string;
export async function buildSubscribersWorkbook(
  rows: readonly SubscriberRow[],
  options: { query: SubscribersQuery; generatedAt: string },
): Promise<ArrayBuffer>;

// apps/admin/src/lib/export-route.ts (thêm, dời từ csv.ts)
export function isoDay(now: Date): string;
export function exportFilename(name: string, day: string, extension: string): string;
```

---

### Task 1: Chữ của file Excel và hai danh sách (thêm, chưa xoá gì)

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts` — khối `admin.reports` (~3630–3800), `admin.bookings`
  (~3900–3960), `admin.subscribers` (~4300–4360), và namespace mới `admin.exportFile` đặt ngay TRƯỚC
  khối `errors: {` của `admin` (~3807)
- Test: `libs/shared/i18n/src/lib/messages.spec.ts`

**Interfaces:**
- Produces: các khoá ở Step 3, đúng tên.

- [ ] **Step 1: Viết test đỏ** — thêm cuối `messages.spec.ts`:

```ts
describe('messages: file Excel của admin (G40 Phần 3)', () => {
  const a = messages.admin;
  const walk = (node: unknown): string[] => {
    if (typeof node === 'string') return [node];
    if (typeof node === 'function' || node === null) return [];
    return Object.values(node as object).flatMap(walk);
  };

  it('mọi chuỗi của ba khối mới đều có chữ', () => {
    for (const value of [...walk(a.exportFile), ...walk(a.bookings.xlsx), ...walk(a.subscribers.xlsx)]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('chân trang giữ nguyên mã số trang của Excel', () => {
    expect(a.exportFile.pageOf).toBe('Page &P of &N');
    expect(a.exportFile.generated('30 Sep 2026, 12:00 UTC')).toBe('Generated 30 Sep 2026, 12:00 UTC');
  });

  it('tiêu đề, dòng kỳ và chú thích ô số của báo cáo', () => {
    const r = a.reports;
    expect(r.reportTitle('September 2026')).toBe('Monthly report — September 2026');
    expect(r.periodLine('1 Sep 2026 – 30 Sep 2026', 'USD', '10.0%')).toBe(
      '1 Sep 2026 – 30 Sep 2026 · all amounts in USD · tax on margin 10.0%',
    );
    expect(r.cards.paidCaption('1')).toBe('1 paid booking');
    expect(r.cards.paidCaption('70')).toBe('70 paid bookings');
    expect(r.xlsx.headerCenter('September 2026')).toBe('Monthly report · September 2026');
    expect(r.xlsx.docTitle('2026-09')).toBe('Nexora — monthly report 2026-09');
  });

  it('cột thời gian của hai danh sách nói rõ giờ Việt Nam', () => {
    expect(a.bookings.xlsx.columns.bookedAt).toBe('Booked at (Vietnam time)');
    expect(a.subscribers.xlsx.columns.unsubscribedAt).toBe('Unsubscribed at (Vietnam time)');
    expect(a.bookings.xlsx.selected(1)).toBe('1 selected row');
    expect(a.bookings.xlsx.selected(3)).toBe('3 selected rows');
  });

  it('nút xuất ghi Excel', () => {
    expect(a.bookings.list.exportExcel).toBe('Export Excel');
    expect(a.subscribers.list.exportExcel).toBe('Export Excel');
  });
});
```

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/i18n exec vitest run src/lib/messages.spec.ts`
  (thuộc tính `exportFile`, `xlsx`… chưa có).

- [ ] **Step 3: Thêm chữ.**

  a) Trong `admin.reports`, ngay sau dòng `generatedAt: (at: string) => \`Generated ${at}\`,`:

```ts
      /**
       * Tiêu đề, dòng kỳ và tên khối của báo cáo dạng dashboard (G40: file Excel D1, bản in C2 dùng
       * chung — spec 2026-10-10 §5.1, §6.2). `month` là "September 2026" (`formatMonthLabel`).
       */
      reportTitle: (month: string) => `Monthly report — ${month}`,
      periodLine: (period: string, currency: string, rate: string) =>
        `${period} · all amounts in ${currency} · tax on margin ${rate}`,
      waterfallHeading: 'From revenue to net profit',
```

  b) Trong `admin.reports.cards`, sau `marginCaption`:

```ts
        /** Dòng phụ của ba ô số còn lại trên dashboard (bản thảo D1). */
        recognizedCaption: 'Trips that finished this month',
        netCaption: 'After tax and payment fees',
        paidCaption: (count: string) => `${count} paid ${count === '1' ? 'booking' : 'bookings'}`,
```

  c) Trong `admin.reports.xlsx`, ngay sau `xlsx: {` (khoá cũ để nguyên tới Task 4):

```ts
        /** Metadata của workbook và phần giữa đầu trang khi in (spec §6.1). */
        docTitle: (month: string) => `Nexora — monthly report ${month}`,
        subject: (month: string) => `Monthly report, ${month}`,
        headerCenter: (month: string) => `Monthly report · ${month}`,
        shareOfRevenue: 'Share of revenue',
        share: 'Share',
        seeDefinitions: 'How to read these numbers: see the Definitions sheet.',
```

  d) Namespace mới, đặt ngay TRƯỚC `errors: {` của `admin`:

```ts
    /**
     * Khung chung của mọi file Excel admin xuất (G40, spec §6.1, §7): metadata của workbook, đầu và
     * chân trang khi in, chú thích của ô mã đơn. `pageOf` mang mã của Excel (`&P` số trang, `&N` tổng
     * trang) — giữ nguyên hai mã ấy khi sửa chữ.
     */
    exportFile: {
      backOffice: 'Nexora back office',
      company: 'Nexora Travel',
      internal: 'Internal — not for distribution',
      generated: (at: string) => `Generated ${at}`,
      pageOf: 'Page &P of &N',
      openBooking: 'Open in back office',
    },
```

  e) `admin.bookings.list`: thêm ngay dưới `exportCsv: 'Export CSV',`
  `exportExcel: 'Export Excel',` (kèm comment "Xuất ĐÚNG tập đang lọc — file Excel từ G40 (ADR-0034
  AMEND 3)"). Thêm khối mới ngay SAU khối `csv: { … },` của `admin.bookings`:

```ts
      /**
       * File Excel của `/bookings/export` (G40, ADR-0034 AMEND 3 — thay CSV). Ô mang KIỂU thật: tiền là
       * số, ngày là ngày, mốc thời gian là ngày-giờ theo giờ Việt Nam (tiêu đề cột nói rõ).
       */
      xlsx: {
        sheet: 'Bookings',
        docTitle: 'Nexora — bookings',
        headerCenter: (summary: string) => `Bookings · ${summary}`,
        allBookings: 'All bookings',
        dateFrom: (date: string) => `from ${date}`,
        dateUntil: (date: string) => `until ${date}`,
        search: (query: string) => `search “${query}”`,
        selected: (n: number) => `${n} selected ${n === 1 ? 'row' : 'rows'}`,
        total: 'Total',
        columns: {
          code: 'Booking code',
          status: 'Status',
          tour: 'Tour',
          departureStart: 'Departure start',
          departureEnd: 'Departure end',
          adults: 'Adults',
          children: 'Children',
          guests: 'Guests',
          unitPrice: 'Price per person',
          total: 'Total',
          refunded: 'Refunded',
          currency: 'Currency',
          customer: 'Customer',
          email: 'Email',
          phone: 'Phone',
          bookedAt: 'Booked at (Vietnam time)',
          paidAt: 'Paid at (Vietnam time)',
          cancelledAt: 'Cancelled at (Vietnam time)',
        },
      },
```

  f) `admin.subscribers.list`: thêm `exportExcel: 'Export Excel',` dưới `exportCsv`. Khối mới ngay SAU
  `csv: { … },` của `admin.subscribers`:

```ts
      /**
       * File Excel của `/subscribers/export` (G40, ADR-0034 AMEND 3). Trạng thái dùng nhãn của bảng
       * (`list.active`, `list.awaitingConfirmation`, `list.unsubscribed`); nguồn ghi nguyên văn.
       */
      xlsx: {
        sheet: 'Subscribers',
        docTitle: 'Nexora — newsletter subscribers',
        headerCenter: (summary: string) => `Subscribers · ${summary}`,
        source: (source: string) => `source “${source}”`,
        search: (query: string) => `search “${query}”`,
        columns: {
          email: 'Email',
          source: 'Source',
          status: 'Status',
          subscribedAt: 'Subscribed at (Vietnam time)',
          confirmedAt: 'Confirmed at (Vietnam time)',
          unsubscribedAt: 'Unsubscribed at (Vietnam time)',
        },
      },
```

- [ ] **Step 4: Chạy, thấy XANH**, rồi build: `pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only`.
- [ ] **Step 5: Thử đột biến** — đổi `pageOf` thành `'Page &p of &n'`, thấy ca chân trang đỏ; trả lại.
- [ ] **Step 6: Commit**

```bash
pnpm exec biome check --write libs/shared/i18n/src/lib/messages.ts libs/shared/i18n/src/lib/messages.spec.ts
git add libs/shared/i18n/src/lib/messages.ts libs/shared/i18n/src/lib/messages.spec.ts
git commit -m "feat(i18n): chữ của file Excel báo cáo tháng D1 và hai danh sách xuất Excel"
```

---

### Task 2: Bộ đồ nghề Excel dùng chung (`lib/xlsx-style.ts`)

**Files:**
- Create: `apps/admin/src/lib/xlsx-style.ts`, `apps/admin/src/lib/xlsx-style.spec.ts`

**Interfaces:**
- Consumes: `messages.admin.exportFile` (Task 1); `formatDateTime` (`./bookings-view`).
- Produces: toàn bộ khối `xlsx-style.ts` ở "Giao diện dùng chung".

- [ ] **Step 1: Viết test đỏ** `xlsx-style.spec.ts`:

```ts
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  addSheet,
  BRAND,
  calendarDate,
  DATE_FMT,
  DATETIME_FMT,
  headerText,
  MONEY_FMT,
  money,
  printFrame,
  subtotalRow,
  sumMoney,
  vietnamDateTime,
} from './xlsx-style';

const f = messages.admin.exportFile;
const AT = '2026-09-30T12:00:00.000Z';

async function reload(book: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const copy = new ExcelJS.Workbook();
  await copy.xlsx.load(await book.xlsx.writeBuffer());
  return copy;
}

describe('định dạng (spec G40 §6.1, ADR-0034 AMEND 3)', () => {
  it('ngày ép tiếng Anh bằng [$-409] — máy vi-VN không ra "Thg10"', () => {
    expect(DATE_FMT).toBe('[$-409]d mmm yyyy');
    expect(DATETIME_FMT).toBe('[$-409]d mmm yyyy hh:mm');
  });

  it('tiền âm trong ngoặc, không tô đỏ (bản thảo D1)', () => {
    expect(MONEY_FMT).toBe('#,##0.00;(#,##0.00)');
  });
});

describe('ngày và giờ', () => {
  it('mốc ISO → ô ngày-giờ hiện đúng giờ Việt Nam (UTC+7, không giờ mùa hè)', () => {
    expect(vietnamDateTime('2026-10-09T17:30:00.000Z').toISOString()).toBe('2026-10-10T00:30:00.000Z');
  });

  it('ngày lịch → nửa đêm UTC, không trôi theo giờ máy', () => {
    expect(calendarDate('2026-11-03').toISOString()).toBe('2026-11-03T00:00:00.000Z');
  });
});

describe('tiền', () => {
  it('money ghi SỐ kèm định dạng; negate đổi dấu dòng chi phí; 0 không thành -0', () => {
    const sheet = new ExcelJS.Workbook().addWorksheet('x');
    money(sheet.getCell('A1'), '210.50', { negate: true });
    money(sheet.getCell('A2'), '0.00', { negate: true });
    money(sheet.getCell('A3'), '-186.36');
    expect(sheet.getCell('A1').value).toBe(-210.5);
    expect(Object.is(sheet.getCell('A2').value, -0)).toBe(false);
    expect(sheet.getCell('A3').value).toBe(-186.36);
    expect(sheet.getCell('A1').numFmt).toBe(MONEY_FMT);
  });

  it('sumMoney cộng theo xu — 0.10 + 0.20 ra đúng 0.3, không 0.30000000000000004', () => {
    expect(sumMoney(['0.10', '0.20'])).toBe(0.3);
    expect(sumMoney([])).toBe(0);
  });
});

describe('đầu và chân trang khi in (spec §6.1)', () => {
  it('ba ô đầu trang; chân trang giờ tạo (UTC) và số trang', () => {
    const frame = printFrame('Monthly report · September 2026', AT);
    expect(frame.oddHeader).toBe(
      `&L&"Calibri,Bold"${f.backOffice}&C&"Calibri,Regular"Monthly report · September 2026&R&"Calibri,Regular"${f.internal}`,
    );
    expect(frame.oddFooter).toBe(
      `&L&"Calibri,Regular"${f.generated('30 Sep 2026, 12:00 UTC')}&R&"Calibri,Regular"${f.pageOf}`,
    );
  });

  it('dấu & trong chữ được nhân đôi — & là mã điều khiển của Excel', () => {
    expect(headerText('Old Town & Lanterns')).toBe('Old Town && Lanterns');
    expect(printFrame('A & B', AT).oddHeader).toContain('A && B');
  });

  it('phần giữa dài quá 100 ký tự thì cắt kèm dấu …', () => {
    const header = printFrame('x'.repeat(150), AT).oddHeader ?? '';
    expect(header).toContain(`${'x'.repeat(99)}…`);
    expect(header).not.toContain('x'.repeat(100));
  });
});

describe('addSheet — khung trang chung', () => {
  it('A4, vừa một trang ngang, căn giữa, lề 0.5″ / 0.8″, tab màu, lưới theo cờ — đọc lại từ file', async () => {
    const book = new ExcelJS.Workbook();
    addSheet(book, 'S', { tab: BRAND, grid: false, frame: printFrame('X', AT) });
    const sheet = (await reload(book)).getWorksheet('S');
    expect(sheet?.pageSetup.paperSize).toBe(9);
    expect(sheet?.pageSetup.fitToWidth).toBe(1);
    expect(sheet?.pageSetup.horizontalCentered).toBe(true);
    expect(sheet?.pageSetup.margins).toMatchObject({ left: 0.5, right: 0.5, top: 0.8, bottom: 0.8 });
    expect(sheet?.properties.tabColor).toEqual({ argb: BRAND });
    expect(sheet?.views[0]?.showGridLines).toBe(false);
    expect(sheet?.headerFooter.oddFooter).toContain(f.pageOf);
  });
});

describe('subtotalRow', () => {
  it('SUBTOTAL(109, …) trên đúng vùng dữ liệu, kèm giá trị đệm; bảng trống thì không có hàng tổng', () => {
    const sheet = new ExcelJS.Workbook().addWorksheet('x');
    subtotalRow(sheet, 'Total', { first: 2, last: 4 }, 3, [{ column: 2, result: 12, numFmt: '#,##0' }]);
    expect(sheet.getCell('A5').value).toBe('Total');
    expect(sheet.getCell('B5').value).toEqual({ formula: 'SUBTOTAL(109,B2:B4)', result: 12 });
    const empty = new ExcelJS.Workbook().addWorksheet('y');
    subtotalRow(empty, 'Total', { first: 2, last: 1 }, 3, [{ column: 2, result: 0, numFmt: '#,##0' }]);
    expect(empty.getCell('A2').value).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/admin exec vitest run src/lib/xlsx-style.spec.ts --maxWorkers=2`.

- [ ] **Step 3: Viết `xlsx-style.ts`**:

```ts
import { messages } from '@tourism/i18n';
import type ExcelJS from 'exceljs';
import { formatDateTime } from './bookings-view';

/**
 * Bộ đồ nghề chung của mọi file Excel admin xuất (G40, ADR-0034 AMEND 3, spec §6.1): bảng màu, font,
 * định dạng số và ngày, khung trang in, và vài hàm ghi ô. Báo cáo tháng và hai danh sách dùng chung
 * để ba file trông cùng một nhà.
 *
 * Bảng màu là NGOẠI LỆ có chủ đích của luật tokens-only (CLAUDE.md #6): `.xlsx` không có CSS custom
 * property, ExcelJS đòi hex tuyệt đối. Mỗi hằng hoặc là token quy đổi (`oklch` → ARGB, ghi gốc cạnh
 * nó), hoặc dẫn xuất từ token có công thức (ADR-0034 AMEND 2d) — không có loại thứ ba.
 */
export const INK = 'FF1F252B'; // oklch(0.262 0.014 250) — --foreground của admin
export const DIM = 'FF5F646B'; // oklch(0.502 0.012 250) — --muted-foreground
export const RULE = 'FFDCDFE2'; // oklch(0.902 0.005 250) — --border
export const BAND = 'FFF0F3F5'; // oklch(0.962 0.004 250) — --muted
export const BRAND = 'FF2E6E66'; // oklch(0.494 0.067 184.3) — --primary
// DẪN XUẤT: 0.85·#FFFFFF + 0.15·#2E6E66 (ADR-0034 AMEND 2d) — đổi `--primary` thì tính lại.
export const BRAND_SOFT = 'FFDFE9E8';
export const PAPER = 'FFEEF5F3'; // oklch(0.965 0.008 174) — token `paper` (nền ô số đầu, như bản in)
export const GAIN = 'FF00897B'; // oklch(0.566 0.101 182.5) — token `chart-gain` (ADR-0057 §5)
export const COST = 'FFE0703A'; // oklch(0.667 0.155 44.4) — token `chart-cost` (ADR-0057 §5)
export const WHITE = 'FFFFFFFF';

export const BODY_FONT = 'Calibri';
export const HEAD_FONT = 'Cambria';
export const MONO_FONT = 'Consolas';

/** Âm trong NGOẶC — quy ước báo cáo tài chính (bản thảo D1 bỏ tô đỏ: thanh đã nói chiều âm). */
export const MONEY_FMT = '#,##0.00;(#,##0.00)';
export const COUNT_FMT = '#,##0';
export const PCT_FMT = '0.0%';
/**
 * `[$-409]` ép tên tháng tiếng Anh: không ép thì Excel lấy theo Windows — máy vi-VN ra "5 Thg10 2026"
 * (đo 10/10, ADR-0034 AMEND 3 mục 4).
 */
export const DATE_FMT = '[$-409]d mmm yyyy';
export const DATETIME_FMT = '[$-409]d mmm yyyy hh:mm';

/** Giờ Việt Nam: UTC+7, không có giờ mùa hè. */
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Phần giữa đầu trang tối đa — Excel giới hạn cả đầu trang 255 ký tự, kể cả mã định dạng. */
const HEADER_CENTER_MAX = 100;

export function fill(argb: string): ExcelJS.FillPattern {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

export function thin(argb: string = RULE): Partial<ExcelJS.Border> {
  return { style: 'thin', color: { argb } };
}

/** Font thân (Calibri 10.5, mực INK); đè từng thuộc tính khi cần. */
export function bodyFont(overrides: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> {
  return { name: BODY_FONT, size: 10.5, color: { argb: INK }, ...overrides };
}

/**
 * Chỗ `Number()` DUY NHẤT được phép cho tiền (CLAUDE.md: tiền không đi qua float) — Excel không có
 * kiểu decimal. Nằm SAU mọi phép cộng của server. `negate` chỉ đổi dấu để dòng chi phí đọc là số âm;
 * số 0 giữ là 0 (không ghi -0).
 */
export function money(cell: ExcelJS.Cell, decimal: string, { negate = false } = {}): void {
  const value = Number(decimal);
  cell.value = negate && value !== 0 ? -value : value;
  cell.numFmt = MONEY_FMT;
}

export function count(cell: ExcelJS.Cell, value: number): void {
  cell.value = value;
  cell.numFmt = COUNT_FMT;
}

/**
 * Giá trị đệm (`result`) của ô tổng tiền: cộng theo XU nguyên để không trôi số lẻ của float. Excel
 * tính lại công thức khi mở; giá trị này chỉ cho trình xem không tự tính.
 */
export function sumMoney(values: readonly string[]): number {
  return values.reduce((cents, value) => cents + Math.round(Number(value) * 100), 0) / 100;
}

/** Ngày lịch `YYYY-MM-DD` → ô ngày: nửa đêm UTC (ExcelJS ghi `Date` theo UTC). */
export function calendarDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/**
 * Mốc ISO → ô ngày-giờ theo GIỜ VIỆT NAM (ADR-0034 AMEND 3 mục 3). Excel không có múi giờ và ExcelJS
 * ghi `Date` theo UTC, nên cộng 7 giờ trước khi ghi: ô hiện đúng giờ đồng hồ ở Việt Nam.
 */
export function vietnamDateTime(iso: string): Date {
  return new Date(Date.parse(iso) + VIETNAM_OFFSET_MS);
}

/** `&` trong chữ của đầu, chân trang là mã điều khiển của Excel — chữ thật phải nhân đôi. */
export function headerText(text: string): string {
  return text.replaceAll('&', '&&');
}

/**
 * Đầu và chân trang khi in (spec §6.1, §7.1): trái "Nexora back office", giữa tên tài liệu, phải
 * "Internal — not for distribution"; chân trái giờ tạo (UTC — mọi mốc của back-office in UTC), chân
 * phải "Page &P of &N" (mã của Excel, không nhân đôi).
 */
export function printFrame(center: string, generatedAt: string): Partial<ExcelJS.HeaderFooter> {
  const f = messages.admin.exportFile;
  const middle =
    center.length > HEADER_CENTER_MAX ? `${center.slice(0, HEADER_CENTER_MAX - 1)}…` : center;
  return {
    oddHeader: `&L&"${BODY_FONT},Bold"${headerText(f.backOffice)}&C&"${BODY_FONT},Regular"${headerText(middle)}&R&"${BODY_FONT},Regular"${headerText(f.internal)}`,
    oddFooter: `&L&"${BODY_FONT},Regular"${headerText(f.generated(formatDateTime(generatedAt)))}&R&"${BODY_FONT},Regular"${f.pageOf}`,
  };
}

export interface SheetOptions {
  tab: string;
  grid: boolean;
  landscape?: boolean;
  frame: Partial<ExcelJS.HeaderFooter>;
}

/** Sheet theo khung chung (spec §6.1): A4, vừa một trang ngang, căn giữa ngang, lề 0.5″ / 0.8″. */
export function addSheet(
  book: ExcelJS.Workbook,
  name: string,
  { tab, grid, landscape = false, frame }: SheetOptions,
): ExcelJS.Worksheet {
  return book.addWorksheet(name, {
    properties: { tabColor: { argb: tab }, defaultRowHeight: 18 },
    views: [{ showGridLines: grid }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: landscape ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.5, right: 0.5, top: 0.8, bottom: 0.8, header: 0.3, footer: 0.3 },
    },
    headerFooter: frame,
  });
}

/** Đóng băng hàng 1, GIỮ cờ lưới — gán `views` mới là ghi đè cả `showGridLines` của `addSheet`. */
export function freezeHeader(sheet: ExcelJS.Worksheet, grid: boolean): void {
  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: grid }];
}

/** Hàng tiêu đề bảng dữ liệu (spec §6.3): nền thương hiệu, chữ trắng đậm, canh trái. */
export function headerRow(sheet: ExcelJS.Worksheet, labels: readonly string[]): void {
  const row = sheet.getRow(1);
  labels.forEach((label, index) => {
    const cell = row.getCell(index + 1);
    cell.value = label;
    cell.font = bodyFont({ size: 10, bold: true, color: { argb: WHITE } });
    cell.fill = fill(BRAND);
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  });
  row.height = 22;
}

/** Sọc xen kẽ: hàng dữ liệu thứ hai, thứ tư… (`index` lẻ, đếm từ 0) nền `BAND`. */
export function stripe(row: ExcelJS.Row, columns: number, index: number): void {
  if (index % 2 === 0) return;
  for (let column = 1; column <= columns; column += 1) row.getCell(column).fill = fill(BAND);
}

/** Metadata của workbook (spec §6.1); bật tính lại công thức khi mở (REPT, SUBTOTAL, SUM). */
export function stampWorkbook(
  book: ExcelJS.Workbook,
  { title, subject, created }: { title: string; subject: string; created: Date },
): void {
  const f = messages.admin.exportFile;
  book.creator = f.backOffice;
  book.lastModifiedBy = f.backOffice;
  book.company = f.company;
  book.title = title;
  book.subject = subject;
  book.created = created;
  book.modified = created;
  book.calcProperties.fullCalcOnLoad = true;
}

/** Ô mã đơn bấm được, mở trang đơn trong admin (spec §6.3, §7.1); chữ Consolas như mọi mã. */
export function bookingLink(cell: ExcelJS.Cell, code: string, adminOrigin: string): void {
  cell.value = {
    text: code,
    hyperlink: `${adminOrigin}/bookings/${encodeURIComponent(code)}`,
    tooltip: messages.admin.exportFile.openBooking,
  };
  cell.font = { name: MONO_FONT, size: 10, color: { argb: BRAND }, underline: true };
}

export interface SubtotalColumn {
  column: number;
  result: number;
  numFmt: string;
}

/**
 * Hàng Total ngay dưới bảng: `SUBTOTAL(109, …)` tự đổi theo bộ lọc (ADR-0034 AMEND 3 mục 3); viền
 * trên mực đậm. Bảng trống (`last < first`) thì không có hàng tổng.
 */
export function subtotalRow(
  sheet: ExcelJS.Worksheet,
  label: string,
  { first, last }: { first: number; last: number },
  width: number,
  columns: readonly SubtotalColumn[],
): void {
  if (last < first) return;
  const row = sheet.getRow(last + 1);
  row.getCell(1).value = label;
  row.getCell(1).font = bodyFont({ size: 10, bold: true });
  for (const { column, result, numFmt } of columns) {
    const cell = row.getCell(column);
    const letter = sheet.getColumn(column).letter;
    cell.value = { formula: `SUBTOTAL(109,${letter}${first}:${letter}${last})`, result };
    cell.numFmt = numFmt;
    cell.font = bodyFont({ name: MONO_FONT, size: 10, bold: true });
  }
  for (let column = 1; column <= width; column += 1) row.getCell(column).border = { top: thin(INK) };
}
```

- [ ] **Step 4: Chạy, thấy XANH.**
- [ ] **Step 5: Thử đột biến** — bỏ `+ VIETNAM_OFFSET_MS`, thấy ca giờ Việt Nam đỏ; bỏ `headerText(middle)`
  (ghi `middle` trần), thấy ca `&` đỏ; đổi `Math.round(Number(value) * 100)` thành `Number(value)` và
  bỏ `/ 100`, thấy ca sumMoney đỏ; trả lại.
- [ ] **Step 6: Typecheck và commit**

```bash
pnpm --filter @tourism/admin typecheck
pnpm exec biome check --write apps/admin/src/lib/xlsx-style.ts apps/admin/src/lib/xlsx-style.spec.ts
git add apps/admin/src/lib/xlsx-style.ts apps/admin/src/lib/xlsx-style.spec.ts
git commit -m "feat(admin): bộ đồ nghề Excel dùng chung — màu từ token, định dạng ngày [$-409], giờ Việt Nam, khung in A4"
```

---

### Task 3: Workbook báo cáo — metadata, khung in và Summary dạng dashboard D1

**Files:**
- Modify: `apps/admin/src/lib/xlsx.ts` (thay `writeHeader`, `sectionRow`, `labelRow`, `buildSummary`;
  thêm metadata và khung; bốn sheet còn lại để nguyên tới Task 4)
- Create: `apps/admin/src/lib/xlsx-summary.spec.ts`
- Modify: `apps/admin/src/lib/xlsx.spec.ts` (xoá các ca của Summary cũ — liệt kê ở Step 1)

**Interfaces:**
- Consumes: Task 1 (`admin.reports.reportTitle`, `periodLine`, `waterfallHeading`, `cards.*Caption`,
  `xlsx.docTitle|subject|headerCenter|shareOfRevenue|share|seeDefinitions`), Task 2; `formatMonthLabel`
  (`./month-options`); `costWarning`, `formatMarginPct`, `reportPeriodLabel` (`./reports-view`);
  `formatCount` (`./stats-view`); `statusLabel` (`./bookings-view`).
- Produces: `buildReportWorkbook(report, bookings, detailNote?)` (chữ ký cũ, Task 4 đổi); hàm nội bộ
  `operationsMetrics(report)` cho Task 4 dùng lại.

- [ ] **Step 1: Xoá ca cũ của Summary** trong `xlsx.spec.ts` — chúng canh bố cục cũ (khối đầu nhãn ·
  giá trị, hai dải "Cash flow" và "Profit and loss", viền tổng đậm teal). Xoá đúng các `it` có tên:
  "tiền là SỐ kèm định dạng — nếu không thì mọi phép SUM chết", "tháng LỖ ghi số ÂM thật, không phải
  chuỗi có dấu trừ", "biên gộp là TỈ LỆ kèm định dạng %, không phải chuỗi \"75.6%\"", "biên KHÔNG XÁC
  ĐỊNH ghi dấu gạch, không ghi 0", "dòng Period của tháng đang chạy nói \"(to date)\" như trên màn hình
  (ADR-0033 AMEND 3)", "khối đầu khai THUẾ SUẤT — env không có ngày hiệu lực", "dòng TỔNG có viền trên
  đậm màu thương hiệu", "hai khối tiền trong Summary có dải tiêu đề riêng", "dòng thành phần thụt lề,
  dòng kết quả thì không". Ý của từng ca được viết lại ở Step 2 theo bố cục D1.

- [ ] **Step 2: Viết test đỏ** `xlsx-summary.spec.ts`:

```ts
import type { AdminMonthlyReport } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildReportWorkbook } from './xlsx';
import { COST, GAIN, MONEY_FMT, PAPER, PCT_FMT } from './xlsx-style';

/**
 * Summary dạng dashboard (bản thảo D1, spec G40 §6.2) và khung workbook. Mở LẠI chính buffer — thứ
 * người dùng nhận là file. Điều đáng canh nhất vẫn là KIỂU ô: tiền là số kèm định dạng, tỉ lệ là số
 * kèm %, thanh là công thức tham chiếu đúng ô.
 */
const t = messages.admin.reports;

const report: AdminMonthlyReport = {
  month: '2026-09',
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-10-01T00:00:00.000Z',
  generatedAt: '2026-09-30T12:00:00.000Z',
  currency: 'USD',
  revenue: '1240.50',
  paidBookings: 8,
  newBookings: 11,
  bookingsByStatus: [
    { status: 'PENDING', count: 2 },
    { status: 'PAID', count: 6 },
    { status: 'CANCELLED', count: 1 },
    { status: 'REFUNDED', count: 1 },
    { status: 'PARTIALLY_REFUNDED', count: 1 },
  ],
  refundedTotal: '120.00',
  refunds: 2,
  cancellationsWithinDeadline: 1,
  cancellationsAfterDeadline: 3,
  reviewsApproved: 5,
  recognizedThrough: '2026-09-30',
  recognizedRevenue: '2500.00',
  cogsVariable: '210.00',
  cogsFixed: '400.00',
  cogsTotal: '610.00',
  grossProfit: '1890.00',
  grossMarginPct: 0.756,
  taxRate: 0.1,
  taxAmount: '171.82',
  paymentFees: '30.20',
  netProfit: '1687.98',
  departuresRun: 1,
  costDataMissing: 1,
  departuresCostMissing: 0,
};

async function open(report_: AdminMonthlyReport): Promise<ExcelJS.Workbook> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await buildReportWorkbook(report_, []));
  return book;
}

async function summaryOf(report_: AdminMonthlyReport): Promise<ExcelJS.Worksheet> {
  const sheet = (await open(report_)).getWorksheet(t.xlsx.sheets.summary);
  if (!sheet) throw new Error('Không có sheet Summary');
  return sheet;
}

/** Hàng có nhãn ấy ở cột B (thác nước, trạng thái, vận hành). */
function rowLabelled(sheet: ExcelJS.Worksheet, label: string): ExcelJS.Row {
  let found: ExcelJS.Row | undefined;
  sheet.eachRow((row) => {
    if (row.getCell(2).value === label) found = row;
  });
  if (!found) throw new Error(`Không có hàng "${label}" ở cột B`);
  return found;
}

describe('workbook báo cáo — metadata (spec §6.1)', () => {
  it('creator, tiêu đề, chủ đề, công ty, giờ tạo', async () => {
    const book = await open(report);
    expect(book.creator).toBe(messages.admin.exportFile.backOffice);
    expect(book.lastModifiedBy).toBe(messages.admin.exportFile.backOffice);
    expect(book.title).toBe(t.xlsx.docTitle('2026-09'));
    expect(book.subject).toBe(t.xlsx.subject('September 2026'));
    expect(book.company).toBe(messages.admin.exportFile.company);
    expect(book.created?.toISOString()).toBe(report.generatedAt);
  });
});

describe('Summary D1', () => {
  it('tab màu thương hiệu, ẩn lưới, đầu trang nói tên báo cáo', async () => {
    const sheet = await summaryOf(report);
    expect(sheet.properties.tabColor).toEqual({ argb: 'FF2E6E66' });
    expect(sheet.views[0]?.showGridLines).toBe(false);
    expect(sheet.headerFooter.oddHeader).toContain(t.xlsx.headerCenter('September 2026'));
  });

  it('tiêu đề và dòng kỳ — kỳ, đơn vị tiền, thuế suất', async () => {
    const sheet = await summaryOf(report);
    expect(sheet.getCell('B2').value).toBe(t.reportTitle('September 2026'));
    expect(sheet.getCell('B3').value).toBe(
      t.periodLine('1 Sep 2026 – 30 Sep 2026', 'USD', '10.0%'),
    );
  });

  it('tháng đang chạy: dòng kỳ nói "(to date)" như màn hình (ADR-0033 AMEND 3)', async () => {
    const sheet = await summaryOf({
      ...report,
      month: '2026-10',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
      recognizedThrough: '2026-10-15',
    });
    expect(sheet.getCell('B3').value).toBe(
      t.periodLine(t.periodToDate('1 Oct 2026', '15 Oct 2026'), 'USD', '10.0%'),
    );
  });

  it('bốn ô số: nhãn mono viết hoa, số là SỐ có ký hiệu $, dòng phụ; ô đầu nền giấy', async () => {
    const sheet = await summaryOf(report);
    expect(sheet.getCell('B5').value).toBe(t.cards.recognizedRevenue.toUpperCase());
    expect(sheet.getCell('B6').value).toBe(2500);
    expect(sheet.getCell('B6').numFmt).toBe('"$"#,##0.00;("$"#,##0.00)');
    expect(sheet.getCell('B7').value).toBe(t.cards.recognizedCaption);
    expect(sheet.getCell('B6').fill).toMatchObject({ fgColor: { argb: PAPER } });
    expect(sheet.getCell('D7').value).toBe(t.cards.marginCaption('75.6%'));
    expect(sheet.getCell('F6').value).toBe(1687.98);
    expect(sheet.getCell('H6').value).toBe(1240.5);
    expect(sheet.getCell('H7').value).toBe(t.cards.paidCaption('8'));
  });

  it('biên KHÔNG XÁC ĐỊNH ra dấu gạch, không ra 0%', async () => {
    const sheet = await summaryOf({ ...report, grossMarginPct: null });
    expect(sheet.getCell('D7').value).toBe(t.cards.marginCaption(t.pnlTable.marginUnknown));
  });

  it('đơn vị khác USD: ô số dùng định dạng tiền thường', async () => {
    const sheet = await summaryOf({ ...report, currency: 'EUR' });
    expect(sheet.getCell('B6').numFmt).toBe(MONEY_FMT);
  });

  it('thác nước: bảy dòng đúng thứ tự, chi phí là số ÂM, tổng phụ không thụt', async () => {
    const sheet = await summaryOf(report);
    const p = t.pnlTable;
    const labels = [
      p.recognizedRevenue,
      p.cogsVariable,
      p.cogsFixed,
      p.grossProfit,
      p.taxAmount('10.0%'),
      p.paymentFees,
      p.netProfit,
    ];
    labels.forEach((label, index) => {
      expect(sheet.getCell(`B${11 + index}`).value, label).toBe(label);
    });
    expect(sheet.getCell('E11').value).toBe(2500);
    expect(sheet.getCell('E12').value).toBe(-210);
    expect(sheet.getCell('E12').numFmt).toBe(MONEY_FMT);
    expect(sheet.getCell('B12').alignment?.indent).toBe(2);
    expect(sheet.getCell('B14').alignment?.indent ?? 0).toBe(0);
    expect(sheet.getCell('E17').value).toBe(1687.98);
  });

  it('thanh REPT tham chiếu dòng doanh thu, có chốt chia 0; màu theo dòng', async () => {
    const sheet = await summaryOf(report);
    const bar = sheet.getCell('F12').value as ExcelJS.CellFormulaValue;
    expect(bar.formula).toBe('IF($E$11=0,"",REPT("█",MAX(1,ROUND(ABS(E12)/$E$11*30,0))))');
    expect(bar.result).toBe('█'.repeat(3)); // 210 / 2500 × 30 = 2,52 → 3
    expect(sheet.getCell('F11').font?.color?.argb).toBe(GAIN);
    expect(sheet.getCell('F12').font?.color?.argb).toBe(COST);
  });

  it('tháng LỖ: lãi ròng là số âm và thanh đổi sang màu chi phí', async () => {
    const sheet = await summaryOf({ ...report, grossProfit: '-150.00', netProfit: '-186.36' });
    expect(sheet.getCell('E17').value).toBe(-186.36);
    expect(sheet.getCell('F17').font?.color?.argb).toBe(COST);
  });

  it('chưa có doanh thu: thanh để trống chứ không #DIV/0!', async () => {
    const sheet = await summaryOf({ ...report, recognizedRevenue: '0.00' });
    expect((sheet.getCell('F11').value as ExcelJS.CellFormulaValue).result).toBe('');
  });

  it('dưới bảng: số chuyến đã chạy, rồi cảnh báo thiếu giá vốn khi có', async () => {
    const sheet = await summaryOf(report);
    expect(sheet.getCell('B18').value).toBe(t.pnlTable.departuresRun('1'));
    expect(sheet.getCell('B19').value).toBe(t.pnlTable.costMissing('1'));
    expect(sheet.getCell('B19').font?.color?.argb).toBe(COST);
  });

  it('trạng thái: số, Share là công thức %, thanh, Total là SUM khớp newBookings', async () => {
    const sheet = await summaryOf(report);
    const paid = rowLabelled(sheet, messages.admin.bookings.status.PAID);
    expect(paid.getCell(3).value).toBe(6);
    const share = paid.getCell(4).value as ExcelJS.CellFormulaValue;
    expect(share.formula).toMatch(/^IF\(\$C\$\d+=0,0,C\d+\/\$C\$\d+\)$/);
    expect(share.result).toBeCloseTo(6 / 11, 6);
    expect(paid.getCell(4).numFmt).toBe(PCT_FMT);
    expect(paid.getCell(5).font?.color?.argb).toBe(GAIN);
    const total = rowLabelled(sheet, t.bookingsTable.total);
    expect((total.getCell(3).value as ExcelJS.CellFormulaValue).result).toBe(11);
  });

  it('trạng thái có 0 đơn: thanh trống, không một ký tự giả', async () => {
    const sheet = await summaryOf({
      ...report,
      bookingsByStatus: report.bookingsByStatus.map((row) =>
        row.status === 'REFUNDED' ? { ...row, count: 0 } : row,
      ),
    });
    const refunded = rowLabelled(sheet, messages.admin.bookings.status.REFUNDED);
    expect((refunded.getCell(5).value as ExcelJS.CellFormulaValue).result).toBe('');
  });

  it('Money and operations: tám chỉ số hai cột, là Ô SỐ; dòng cuối chỉ sang Definitions', async () => {
    const sheet = await summaryOf(report);
    const o = t.operationsTable;
    const revenue = rowLabelled(sheet, o.revenue);
    expect(revenue.getCell(5).value).toBe(1240.5);
    let rightLabel: ExcelJS.CellValue = null;
    sheet.eachRow((row) => {
      if (row.getCell(6).value === o.cancellationsAfterDeadline) rightLabel = row.getCell(9).value;
    });
    expect(rightLabel).toBe(3);
    let footnote = false;
    sheet.eachRow((row) => {
      if (row.getCell(2).value === t.xlsx.seeDefinitions) footnote = true;
    });
    expect(footnote).toBe(true);
  });
});
```

- [ ] **Step 3: Chạy, thấy ĐỎ** —
  `pnpm --filter @tourism/admin exec vitest run src/lib/xlsx-summary.spec.ts src/lib/xlsx.spec.ts --maxWorkers=2`
  (`xlsx-summary` đỏ; các ca còn lại của `xlsx.spec.ts` vẫn xanh).

- [ ] **Step 4: Viết lại phần Summary của `xlsx.ts`.** Import mới (giữ các import đang dùng cho bốn sheet
  cũ tới Task 4):

```ts
import type { AdminMonthlyReport, Booking, BookingStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { formatDateTime, statusLabel } from './bookings-view';
import { formatMonthLabel } from './month-options';
import { costWarning, formatMarginPct, reportPeriodLabel } from './reports-view';
import { formatCount } from './stats-view';
import {
  addSheet,
  BRAND,
  bodyFont,
  COST,
  COUNT_FMT,
  count,
  DIM,
  fill,
  GAIN,
  HEAD_FONT,
  INK,
  MONEY_FMT,
  MONO_FONT,
  money,
  PAPER,
  PCT_FMT,
  printFrame,
  stampWorkbook,
  thin,
} from './xlsx-style';
```

  (Các hằng màu và định dạng cũ trong file — `MONEY_FMT`, `INK`, `BRAND`… — gỡ, dùng bản của
  `xlsx-style.ts`; `dressRow`, `dressHeader`, `CELL_BORDER`, `TOP_RULE`, `BAND`, `BRAND_SOFT` còn phục vụ
  bốn sheet cũ thì import `BAND`, `BRAND_SOFT`, `RULE`, `WHITE` từ `xlsx-style` thay cho hằng cũ, đổi
  `PAPER` cũ — trắng — thành `WHITE`. Bốn sheet ấy viết lại trọn ở Task 4.)

  Thay `writeHeader`, `sectionRow`, `labelRow`, `buildSummary` bằng:

```ts
/** Cột A là lề; nội dung B:I (bản thảo D1). */
const SUMMARY_WIDTHS = [2, 14, 14, 13, 14, 13, 13, 13, 14];
const LAST = 'I';
/** Thanh dài nhất của thác nước (bằng doanh thu ghi nhận) là 30 ký tự — spec §6.2. */
const BAR_UNITS = 30;
/** Thanh tỉ trọng trạng thái: 100% là 40 ký tự (bản thảo D1). */
const SHARE_UNITS = 40;
const BLOCK = '█';

type LineKind = 'total' | 'cost' | 'subtotal' | 'net';

function put(
  cell: ExcelJS.Cell,
  value: ExcelJS.CellValue,
  font: Partial<ExcelJS.Font> = {},
): ExcelJS.Cell {
  cell.value = value;
  cell.font = bodyFont(font);
  return cell;
}

/** Nhãn nhỏ mono viết hoa: tiêu đề cột và nhãn ô số của dashboard. */
function smallLabel(cell: ExcelJS.Cell, text: string): void {
  put(cell, text.toUpperCase(), { name: MONO_FONT, size: 8, color: { argb: DIM } });
}

function section(sheet: ExcelJS.Worksheet, row: number, text: string): void {
  put(sheet.getCell(`B${row}`), text, { name: HEAD_FONT, size: 12.5, bold: true });
  sheet.getRow(row).height = 24;
}

/** Chuỗi █ làm giá trị đệm của ô REPT — đúng con số công thức sẽ tính khi Excel mở file. */
function bar(ratio: number, units: number): string {
  return BLOCK.repeat(Math.max(1, Math.round(ratio * units)));
}

/** Ô số đầu có ký hiệu khi là USD — đơn vị duy nhất của dự án (ADR-0034 giới hạn 3). */
function tileMoneyFmt(currency: string): string {
  return currency === 'USD' ? '"$"#,##0.00;("$"#,##0.00)' : MONEY_FMT;
}

/**
 * Tám chỉ số "Money and operations" — MỘT danh sách cho khối của Summary và sheet Operations, cùng
 * thứ tự với bảng trên màn hình (`toReportSummaryRows`).
 */
function operationsMetrics(
  report: AdminMonthlyReport,
): Array<[label: string, write: (cell: ExcelJS.Cell) => void]> {
  const o = t.operationsTable;
  return [
    [o.revenue, (cell) => money(cell, report.revenue)],
    [o.paidBookings, (cell) => count(cell, report.paidBookings)],
    [o.newBookings, (cell) => count(cell, report.newBookings)],
    [o.refundedTotal, (cell) => money(cell, report.refundedTotal)],
    [o.refunds, (cell) => count(cell, report.refunds)],
    [o.cancellationsWithinDeadline, (cell) => count(cell, report.cancellationsWithinDeadline)],
    [o.cancellationsAfterDeadline, (cell) => count(cell, report.cancellationsAfterDeadline)],
    [o.reviewsApproved, (cell) => count(cell, report.reviewsApproved)],
  ];
}

/** Màu thanh trạng thái: đã trả là phần "được", đã huỷ là phần mất, còn lại mực mờ. */
function statusColor(status: BookingStatusValue): string {
  if (status === 'PAID') return GAIN;
  return status === 'CANCELLED' ? COST : DIM;
}

function writeTiles(sheet: ExcelJS.Worksheet, report: AdminMonthlyReport): void {
  const c = t.cards;
  const tiles = [
    {
      from: 'B',
      to: 'C',
      label: c.recognizedRevenue,
      amount: report.recognizedRevenue,
      caption: c.recognizedCaption,
      tint: true,
    },
    {
      from: 'D',
      to: 'E',
      label: c.grossProfit,
      amount: report.grossProfit,
      caption: c.marginCaption(formatMarginPct(report.grossMarginPct)),
      tint: false,
    },
    { from: 'F', to: 'G', label: c.netProfit, amount: report.netProfit, caption: c.netCaption, tint: false },
    {
      from: 'H',
      to: 'I',
      label: c.revenue,
      amount: report.revenue,
      caption: c.paidCaption(formatCount(report.paidBookings)),
      tint: false,
    },
  ];
  for (const tile of tiles) {
    for (const row of [5, 6, 7]) sheet.mergeCells(`${tile.from}${row}:${tile.to}${row}`);
    smallLabel(sheet.getCell(`${tile.from}5`), tile.label);
    const value = sheet.getCell(`${tile.from}6`);
    money(value, tile.amount);
    value.numFmt = tileMoneyFmt(report.currency);
    value.font = bodyFont({ size: 17, bold: true });
    put(sheet.getCell(`${tile.from}7`), tile.caption, { size: 9, color: { argb: DIM } });
    for (const row of [5, 6, 7]) {
      const cell = sheet.getCell(`${tile.from}${row}`);
      if (tile.tint) cell.fill = fill(PAPER);
      cell.alignment = { vertical: 'middle', indent: 1 };
      cell.border = {
        left: thin(),
        right: thin(),
        ...(row === 5 ? { top: thin() } : {}),
        ...(row === 7 ? { bottom: thin() } : {}),
      };
    }
  }
  sheet.getRow(5).height = 20;
  sheet.getRow(6).height = 28;
  sheet.getRow(7).height = 18;
}

/** "From revenue to net profit" từ hàng `start`; trả hàng cuối đã dùng (ghi chú, cảnh báo). */
function writeWaterfall(sheet: ExcelJS.Worksheet, report: AdminMonthlyReport, start: number): number {
  const p = t.pnlTable;
  section(sheet, start, t.waterfallHeading);
  const head = start + 1;
  sheet.mergeCells(`B${head}:D${head}`);
  sheet.mergeCells(`F${head}:${LAST}${head}`);
  smallLabel(sheet.getCell(`B${head}`), p.metric);
  smallLabel(sheet.getCell(`E${head}`), p.value);
  sheet.getCell(`E${head}`).alignment = { horizontal: 'right' };
  smallLabel(sheet.getCell(`F${head}`), x.shareOfRevenue);
  for (const column of 'BCDEFGHI') sheet.getCell(`${column}${head}`).border = { bottom: thin(INK) };

  const lines: Array<{ label: string; amount: string; kind: LineKind }> = [
    { label: p.recognizedRevenue, amount: report.recognizedRevenue, kind: 'total' },
    { label: p.cogsVariable, amount: report.cogsVariable, kind: 'cost' },
    { label: p.cogsFixed, amount: report.cogsFixed, kind: 'cost' },
    { label: p.grossProfit, amount: report.grossProfit, kind: 'subtotal' },
    { label: p.taxAmount(formatMarginPct(report.taxRate)), amount: report.taxAmount, kind: 'cost' },
    { label: p.paymentFees, amount: report.paymentFees, kind: 'cost' },
    { label: p.netProfit, amount: report.netProfit, kind: 'net' },
  ];
  const revenueRow = head + 1;
  const revenue = Number(report.recognizedRevenue);
  lines.forEach((line, index) => {
    const row = revenueRow + index;
    const cost = line.kind === 'cost';
    const value = Number(line.amount);
    sheet.mergeCells(`B${row}:D${row}`);
    sheet.mergeCells(`F${row}:${LAST}${row}`);
    put(sheet.getCell(`B${row}`), line.label, { bold: !cost }).alignment = {
      vertical: 'middle',
      indent: cost ? 2 : 0,
    };
    const amount = sheet.getCell(`E${row}`);
    money(amount, line.amount, { negate: cost });
    amount.font = bodyFont({ name: MONO_FONT, size: 10, bold: !cost });
    put(
      sheet.getCell(`F${row}`),
      {
        formula: `IF($E$${revenueRow}=0,"",REPT("${BLOCK}",MAX(1,ROUND(ABS(E${row})/$E$${revenueRow}*${BAR_UNITS},0))))`,
        result: revenue === 0 ? '' : bar(Math.abs(value) / revenue, BAR_UNITS),
      },
      { size: 10, color: { argb: cost || value < 0 ? COST : GAIN } },
    ).alignment = { vertical: 'middle' };
    sheet.getRow(row).height = 20;
    if (line.kind === 'subtotal') {
      for (const column of 'BCDE') sheet.getCell(`${column}${row}`).border = { top: thin(INK) };
    }
    if (line.kind === 'net') {
      for (const column of 'BCDE') {
        sheet.getCell(`${column}${row}`).border = {
          top: thin(INK),
          bottom: { style: 'double', color: { argb: INK } },
        };
      }
    }
  });

  let last = revenueRow + lines.length;
  put(sheet.getCell(`B${last}`), p.departuresRun(formatCount(report.departuresRun)), {
    size: 9,
    italic: true,
    color: { argb: DIM },
  });
  // Quyết định 5 của plan: thiếu giá vốn thì file phải tự nói, không để "lãi gộp" đứng một mình.
  const warning = costWarning(report);
  if (warning !== null) {
    last += 1;
    put(sheet.getCell(`B${last}`), warning, { size: 9, italic: true, color: { argb: COST } });
  }
  return last;
}

/** "Bookings created this month" từ hàng `start`; trả hàng Total. */
function writeStatusShare(sheet: ExcelJS.Worksheet, report: AdminMonthlyReport, start: number): number {
  section(sheet, start, t.bookingsTable.heading);
  const head = start + 1;
  smallLabel(sheet.getCell(`B${head}`), t.bookingsTable.status);
  smallLabel(sheet.getCell(`C${head}`), t.bookingsTable.count);
  smallLabel(sheet.getCell(`D${head}`), x.share);
  for (const column of 'BCDEFGHI') sheet.getCell(`${column}${head}`).border = { bottom: thin(INK) };

  const first = head + 1;
  const total = first + report.bookingsByStatus.length;
  report.bookingsByStatus.forEach(({ status, count: bookings }, index) => {
    const row = first + index;
    put(sheet.getCell(`B${row}`), statusLabel(status));
    const countCell = sheet.getCell(`C${row}`);
    count(countCell, bookings);
    countCell.font = bodyFont({ name: MONO_FONT, size: 10 });
    const share = sheet.getCell(`D${row}`);
    share.value = {
      formula: `IF($C$${total}=0,0,C${row}/$C$${total})`,
      result: report.newBookings === 0 ? 0 : bookings / report.newBookings,
    };
    share.numFmt = PCT_FMT;
    share.font = bodyFont({ name: MONO_FONT, size: 10 });
    sheet.mergeCells(`E${row}:${LAST}${row}`);
    put(
      sheet.getCell(`E${row}`),
      {
        formula: `IF(C${row}=0,"",REPT("${BLOCK}",MAX(1,ROUND(D${row}*${SHARE_UNITS},0))))`,
        result: bookings === 0 ? '' : bar(bookings / report.newBookings, SHARE_UNITS),
      },
      { color: { argb: statusColor(status) } },
    );
  });
  put(sheet.getCell(`B${total}`), t.bookingsTable.total, { bold: true });
  const sum = sheet.getCell(`C${total}`);
  sum.value = { formula: `SUM(C${first}:C${total - 1})`, result: report.newBookings };
  sum.numFmt = COUNT_FMT;
  sum.font = bodyFont({ name: MONO_FONT, size: 10, bold: true });
  for (const column of 'BCD') sheet.getCell(`${column}${total}`).border = { top: thin(INK) };
  return total;
}

/** "Money and operations" hai cột từ hàng `start`; trả hàng của dòng chỉ sang Definitions. */
function writeOperations(sheet: ExcelJS.Worksheet, report: AdminMonthlyReport, start: number): number {
  section(sheet, start, t.operationsTable.heading);
  operationsMetrics(report).forEach(([label, write], index) => {
    const row = start + 1 + (index % 4);
    const left = index < 4;
    sheet.mergeCells(left ? `B${row}:D${row}` : `F${row}:H${row}`);
    put(sheet.getCell(`${left ? 'B' : 'F'}${row}`), label);
    const value = sheet.getCell(`${left ? 'E' : 'I'}${row}`);
    write(value);
    value.font = bodyFont({ name: MONO_FONT, size: 10, bold: true });
    for (const column of left ? 'BCDE' : 'FGHI') {
      sheet.getCell(`${column}${row}`).border = { bottom: thin() };
    }
  });
  return start + 6;
}

function buildSummary(
  book: ExcelJS.Workbook,
  report: AdminMonthlyReport,
  frame: Partial<ExcelJS.HeaderFooter>,
): void {
  const sheet = addSheet(book, x.sheets.summary, { tab: BRAND, grid: false, frame });
  sheet.columns = SUMMARY_WIDTHS.map((width) => ({ width }));

  sheet.mergeCells(`B2:${LAST}2`);
  put(sheet.getCell('B2'), t.reportTitle(formatMonthLabel(report.month)), {
    name: HEAD_FONT,
    size: 20,
    bold: true,
  });
  sheet.getRow(2).height = 34;
  sheet.mergeCells(`B3:${LAST}3`);
  put(
    sheet.getCell('B3'),
    t.periodLine(reportPeriodLabel(report), report.currency, formatMarginPct(report.taxRate)),
    { color: { argb: DIM } },
  );

  writeTiles(sheet, report);
  const waterfallEnd = writeWaterfall(sheet, report, 9);
  const statusEnd = writeStatusShare(sheet, report, waterfallEnd + 2);
  const footnote = writeOperations(sheet, report, statusEnd + 2);
  put(sheet.getCell(`B${footnote}`), x.seeDefinitions, { size: 9, italic: true, color: { argb: DIM } });
  sheet.pageSetup.printArea = `A1:${LAST}${footnote}`;
}
```

  Và đầu `buildReportWorkbook`:

```ts
  const book = new ExcelJS.Workbook();
  const monthLabel = formatMonthLabel(report.month);
  stampWorkbook(book, {
    title: x.docTitle(report.month),
    subject: x.subject(monthLabel),
    created: new Date(report.generatedAt),
  });
  const frame = printFrame(x.headerCenter(monthLabel), report.generatedAt);

  buildSummary(book, report, frame);
  buildBookings(book, report);
  buildOperations(book, report);
  buildDetail(book, bookings, detailNote);
  buildDefinitions(book);
```

  (`book.created = …` cũ bỏ — `stampWorkbook` đã ghi. `formatDateTime` nếu không còn ai dùng sau khi gỡ
  `writeHeader` thì bỏ khỏi import để Biome không báo.)

- [ ] **Step 5: Chạy, thấy XANH** (lệnh Step 3 — cả `xlsx.spec.ts` còn lại).
- [ ] **Step 6: Thử đột biến** — đổi `negate: cost` thành `negate: false`, thấy ca "chi phí là số ÂM"
  đỏ; bỏ `value < 0 ||` khỏi màu thanh, thấy ca tháng LỖ đỏ; đổi `revenue === 0 ? ''` thành luôn
  `bar(…)`, thấy ca chưa có doanh thu đỏ (hoặc NaN); trả lại.
- [ ] **Step 7: Typecheck và commit**

```bash
pnpm --filter @tourism/admin typecheck
pnpm exec biome check --write apps/admin/src/lib/xlsx.ts apps/admin/src/lib/xlsx-summary.spec.ts apps/admin/src/lib/xlsx.spec.ts
git add apps/admin/src/lib/xlsx.ts apps/admin/src/lib/xlsx-summary.spec.ts apps/admin/src/lib/xlsx.spec.ts
git commit -m "feat(admin): Summary của Excel báo cáo tháng thành dashboard D1 — ô số, thác nước REPT, metadata, khung in"
```

---

### Task 4: Bốn sheet còn lại theo D1, hyperlink mã đơn, route truyền origin

**Files:**
- Modify: `apps/admin/src/lib/xlsx.ts` (thay `buildBookings`, `buildOperations`, `buildDetail`,
  `buildDefinitions`, gỡ `dressRow`, `dressHeader`, `CELL_BORDER`, `TOP_RULE`; đổi chữ ký
  `buildReportWorkbook`)
- Modify: `apps/admin/src/lib/xlsx.spec.ts` (viết lại trọn)
- Modify: `apps/admin/src/app/(admin)/reports/export/route.ts` (truyền `adminOrigin`)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (xoá khoá cũ của `admin.reports.xlsx`)

**Interfaces:**
- Consumes: Task 2, Task 3 (`operationsMetrics`, `put`, `statusColor`, `bar`).
- Produces: `buildReportWorkbook(report, bookings, { detailNote?, adminOrigin })`.

- [ ] **Step 1: Viết lại `xlsx.spec.ts`** (thay trọn file — các ca Summary đã ở `xlsx-summary.spec.ts`):

```ts
import type { AdminMonthlyReport, Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildReportWorkbook } from './xlsx';
import { BAND, BRAND, COST, DATE_FMT, DIM, MONEY_FMT, RULE } from './xlsx-style';

/**
 * File Excel của báo cáo tháng (ADR-0034, D1 theo AMEND 3): bốn sheet sau Summary và khung chung.
 * Mở LẠI chính buffer — thứ người dùng nhận là file.
 */
const t = messages.admin.reports;
const x = t.xlsx;
const ORIGIN = 'https://admin.example.com';

const report: AdminMonthlyReport = {
  month: '2026-09',
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-10-01T00:00:00.000Z',
  generatedAt: '2026-09-30T12:00:00.000Z',
  currency: 'USD',
  revenue: '1240.50',
  paidBookings: 8,
  newBookings: 11,
  bookingsByStatus: [
    { status: 'PENDING', count: 2 },
    { status: 'PAID', count: 6 },
    { status: 'CANCELLED', count: 1 },
    { status: 'REFUNDED', count: 1 },
    { status: 'PARTIALLY_REFUNDED', count: 1 },
  ],
  refundedTotal: '120.00',
  refunds: 2,
  cancellationsWithinDeadline: 1,
  cancellationsAfterDeadline: 3,
  reviewsApproved: 5,
  recognizedThrough: '2026-09-30',
  recognizedRevenue: '2500.00',
  cogsVariable: '210.00',
  cogsFixed: '400.00',
  cogsTotal: '610.00',
  grossProfit: '1890.00',
  grossMarginPct: 0.756,
  taxRate: 0.1,
  taxAmount: '171.82',
  paymentFees: '30.20',
  netProfit: '1687.98',
  departuresRun: 1,
  costDataMissing: 1,
  departuresCostMissing: 0,
};

const paid = {
  code: 'BK-ABCD1234',
  tourTitle: 'Hội An Lantern Evening',
  departureEndDate: '2026-09-20',
  numAdults: 2,
  numChildren: 1,
  totalAmount: '900.00',
  refundedTotal: '100.00',
  status: 'PAID',
} as unknown as Booking;

const cancelled = {
  ...paid,
  code: 'BK-WXYZ5678',
  numAdults: 1,
  numChildren: 0,
  totalAmount: '0.10',
  refundedTotal: '0.20',
  status: 'CANCELLED',
} as unknown as Booking;

async function open(bookings: Booking[] = [paid, cancelled], detailNote?: string) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await buildReportWorkbook(report, bookings, { detailNote, adminOrigin: ORIGIN }));
  return book;
}

function sheetNamed(book: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const sheet = book.getWorksheet(name);
  if (!sheet) {
    throw new Error(`Không có sheet "${name}" — đang có: ${book.worksheets.map((s) => s.name).join(', ')}`);
  }
  return sheet;
}

/** Ô cột B của hàng có nhãn ấy ở cột A. */
function valueFor(sheet: ExcelJS.Worksheet, label: string): ExcelJS.Cell | undefined {
  let found: ExcelJS.Cell | undefined;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === label) found = row.getCell(2);
  });
  return found;
}

describe('buildReportWorkbook — cấu trúc', () => {
  it('đủ năm sheet, đúng thứ tự đọc', async () => {
    expect((await open()).worksheets.map((sheet) => sheet.name)).toEqual([
      x.sheets.summary,
      x.sheets.bookings,
      x.sheets.operations,
      x.sheets.detail,
      x.sheets.definitions,
    ]);
  });

  it('mọi sheet: A4, vừa một trang ngang, căn giữa, đầu và chân trang khi in', async () => {
    for (const sheet of (await open()).worksheets) {
      expect(sheet.pageSetup.paperSize, sheet.name).toBe(9);
      expect(sheet.pageSetup.fitToWidth, sheet.name).toBe(1);
      expect(sheet.pageSetup.horizontalCentered, sheet.name).toBe(true);
      expect(sheet.headerFooter.oddHeader, sheet.name).toContain(x.headerCenter('September 2026'));
      expect(sheet.headerFooter.oddFooter, sheet.name).toContain(
        messages.admin.exportFile.generated('30 Sep 2026, 12:00 UTC'),
      );
    }
  });

  it('tab: Summary thương hiệu, Definitions xám nhạt, còn lại xám; lưới chỉ ở sheet dữ liệu', async () => {
    const book = await open();
    expect(sheetNamed(book, x.sheets.summary).properties.tabColor).toEqual({ argb: BRAND });
    expect(sheetNamed(book, x.sheets.definitions).properties.tabColor).toEqual({ argb: RULE });
    expect(sheetNamed(book, x.sheets.detail).properties.tabColor).toEqual({ argb: DIM });
    expect(sheetNamed(book, x.sheets.definitions).views[0]?.showGridLines).toBe(false);
    expect(sheetNamed(book, x.sheets.detail).views[0]?.showGridLines).toBe(true);
  });

  it('tháng VẮNG vẫn đủ năm sheet — cấu trúc không đổi theo dữ liệu', async () => {
    const book = await open([]);
    const detail = sheetNamed(book, x.sheets.detail);
    expect(book.worksheets).toHaveLength(5);
    expect(detail.getCell('A1').value).toBe(x.detail.code);
    expect(detail.getCell('A2').value).toBeNull();
  });
});

describe('sheet Bookings và Operations', () => {
  it('Bookings: tiêu đề nền thương hiệu chữ trắng; Share là %, Total là SUM khớp newBookings', async () => {
    const sheet = sheetNamed(await open(), x.sheets.bookings);
    expect(sheet.getCell('A1').fill).toMatchObject({ fgColor: { argb: BRAND } });
    expect(sheet.getCell('A1').font).toMatchObject({ bold: true, color: { argb: 'FFFFFFFF' } });
    expect(sheet.getCell('C1').value).toBe(x.share);
    expect((valueFor(sheet, t.bookingsTable.total)?.value as ExcelJS.CellFormulaValue).result).toBe(11);
    expect(sheet.views[0]?.state).toBe('frozen');
  });

  it('Operations: tám chỉ số, là Ô SỐ, hai loại huỷ theo hạn chót (ADR-0041 §9)', async () => {
    const sheet = sheetNamed(await open(), x.sheets.operations);
    expect(valueFor(sheet, t.operationsTable.revenue)?.value).toBe(1240.5);
    expect(valueFor(sheet, t.operationsTable.cancellationsWithinDeadline)?.value).toBe(1);
    expect(valueFor(sheet, t.operationsTable.cancellationsAfterDeadline)?.value).toBe(3);
    expect(sheet.rowCount).toBe(9);
  });
});

describe('sheet Detail (created this month)', () => {
  it('mã đơn là hyperlink tới trang đơn admin; ngày là Ô NGÀY ép tiếng Anh; tiền là số', async () => {
    const sheet = sheetNamed(await open(), x.sheets.detail);
    expect(sheet.getCell('A2').value).toEqual({
      text: 'BK-ABCD1234',
      hyperlink: `${ORIGIN}/bookings/BK-ABCD1234`,
    });
    expect(sheet.getCell('C2').value).toBeInstanceOf(Date);
    expect(sheet.getCell('C2').numFmt).toBe(DATE_FMT);
    expect(sheet.getCell('D2').value).toBe(3);
    expect(sheet.getCell('E2').value).toBe(900);
    expect(sheet.getCell('E2').numFmt).toBe(MONEY_FMT);
    expect(sheet.getCell('G2').value).toBe(messages.admin.bookings.status.PAID);
  });

  it('"Cancelled" chữ màu chi phí; hàng chẵn có sọc', async () => {
    const sheet = sheetNamed(await open(), x.sheets.detail);
    expect(sheet.getCell('G3').font?.color?.argb).toBe(COST);
    expect(sheet.getCell('B3').fill).toMatchObject({ fgColor: { argb: BAND } });
  });

  it('hàng Total dùng SUBTOTAL(109) và cộng tiền theo xu', async () => {
    const sheet = sheetNamed(await open(), x.sheets.detail);
    expect(sheet.getCell('A4').value).toBe(t.bookingsTable.total);
    expect(sheet.getCell('D4').value).toEqual({ formula: 'SUBTOTAL(109,D2:D3)', result: 4 });
    expect(sheet.getCell('E4').value).toEqual({ formula: 'SUBTOTAL(109,E2:E3)', result: 900.1 });
    expect(sheet.getCell('F4').value).toEqual({ formula: 'SUBTOTAL(109,F2:F3)', result: 100.2 });
  });

  it('vùng lọc tới hàng DỮ LIỆU cuối, không gồm hàng Total; đóng băng; khổ ngang; lặp tiêu đề', async () => {
    const sheet = sheetNamed(await open(), x.sheets.detail);
    expect(sheet.autoFilter).toBe('A1:G3');
    expect(sheet.views[0]?.state).toBe('frozen');
    expect(sheet.pageSetup.orientation).toBe('landscape');
    expect(sheet.pageSetup.printTitlesRow).toBe('1:1');
  });

  it('thiếu hàng (vượt trần): câu ghi chú ngay dưới tiêu đề, không hàng Total', async () => {
    const note = x.detail.omittedTooLarge(2000);
    const sheet = sheetNamed(await open([], note), x.sheets.detail);
    expect(sheet.getCell('A2').value).toBe(note);
    expect(sheet.getCell('A3').value).toBeNull();
  });

  it('lệch số: câu ghi chú nằm DƯỚI hàng Total, ngoài vùng lọc (quyết định 8)', async () => {
    const note = x.detail.countMismatch(2, 11);
    const sheet = sheetNamed(await open([paid, cancelled], note), x.sheets.detail);
    expect(sheet.getCell('A4').value).toBe(t.bookingsTable.total);
    expect(sheet.getCell('A6').value).toBe(note);
    expect(sheet.autoFilter).toBe('A1:G3');
  });
});

describe('sheet Definitions', () => {
  it('tiêu đề và bảy chú giải đánh số 1–7, chữ xuống dòng', async () => {
    const sheet = sheetNamed(await open(), x.sheets.definitions);
    expect(sheet.getCell('B2').value).toBe(t.definitions.heading);
    const lines = [
      t.definitions.revenue,
      t.definitions.recognised,
      t.definitions.costs,
      t.definitions.netProfit,
      t.definitions.refunds,
      t.definitions.statuses,
      t.definitions.cancellations,
    ];
    lines.forEach((line, index) => {
      expect(sheet.getCell(`B${4 + index}`).value).toBe(index + 1);
      expect(sheet.getCell(`C${4 + index}`).value).toBe(line);
      expect(sheet.getCell(`C${4 + index}`).alignment?.wrapText).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/admin exec vitest run src/lib/xlsx.spec.ts --maxWorkers=2`
  (tham số thứ ba còn là chuỗi; sheet chưa theo D1).

- [ ] **Step 3: Viết lại bốn sheet** trong `xlsx.ts`: gỡ `dressRow`, `dressHeader`, `labelRow`,
  `CELL_BORDER`, `TOP_RULE` và mọi import không còn dùng; thêm import `bookingLink`, `calendarDate`,
  `DATE_FMT`, `freezeHeader`, `headerRow`, `RULE`, `stripe`, `subtotalRow`, `sumMoney` từ
  `./xlsx-style` và `guestCount` từ `./bookings-view`:

```ts
const DATA_TAB = DIM;

function buildBookings(
  book: ExcelJS.Workbook,
  report: AdminMonthlyReport,
  frame: Partial<ExcelJS.HeaderFooter>,
): void {
  const sheet = addSheet(book, x.sheets.bookings, { tab: DATA_TAB, grid: true, frame });
  sheet.columns = [24, 14, 12].map((width) => ({ width }));
  headerRow(sheet, [t.bookingsTable.status, t.bookingsTable.count, x.share]);

  const first = 2;
  const total = first + report.bookingsByStatus.length;
  report.bookingsByStatus.forEach(({ status, count: bookings }, index) => {
    const row = sheet.getRow(first + index);
    put(row.getCell(1), statusLabel(status), { size: 10 });
    count(row.getCell(2), bookings);
    row.getCell(2).font = bodyFont({ name: MONO_FONT, size: 10 });
    row.getCell(3).value = {
      formula: `IF($B$${total}=0,0,B${first + index}/$B$${total})`,
      result: report.newBookings === 0 ? 0 : bookings / report.newBookings,
    };
    row.getCell(3).numFmt = PCT_FMT;
    row.getCell(3).font = bodyFont({ name: MONO_FONT, size: 10 });
    stripe(row, 3, index);
  });
  const totalRow = sheet.getRow(total);
  put(totalRow.getCell(1), t.bookingsTable.total, { size: 10, bold: true });
  totalRow.getCell(2).value = { formula: `SUM(B${first}:B${total - 1})`, result: report.newBookings };
  totalRow.getCell(2).numFmt = COUNT_FMT;
  totalRow.getCell(2).font = bodyFont({ name: MONO_FONT, size: 10, bold: true });
  for (let column = 1; column <= 3; column += 1) totalRow.getCell(column).border = { top: thin(INK) };

  freezeHeader(sheet, true);
  sheet.pageSetup.printTitlesRow = '1:1';
}

function buildOperations(
  book: ExcelJS.Workbook,
  report: AdminMonthlyReport,
  frame: Partial<ExcelJS.HeaderFooter>,
): void {
  const sheet = addSheet(book, x.sheets.operations, { tab: DATA_TAB, grid: true, frame });
  sheet.columns = [34, 16].map((width) => ({ width }));
  headerRow(sheet, [t.operationsTable.metric, t.operationsTable.value]);
  operationsMetrics(report).forEach(([label, write], index) => {
    const row = sheet.getRow(2 + index);
    put(row.getCell(1), label, { size: 10 });
    write(row.getCell(2));
    row.getCell(2).font = bodyFont({ name: MONO_FONT, size: 10 });
    stripe(row, 2, index);
  });
  freezeHeader(sheet, true);
  sheet.pageSetup.printTitlesRow = '1:1';
}

/**
 * Từng booking TẠO trong tháng (ADR-0034 AMEND 1a) — thứ khiến báo cáo kiểm chéo được. Tập này KHÔNG
 * phải tập của khối lãi lỗ (neo ngày chuyến kết thúc); tên sheet nói thẳng điều đó.
 *
 * Dòng ghi chú (AMEND 2b) nằm DƯỚI hàng Total (quyết định 8 của plan): ô merge trong vùng lọc làm
 * Excel từ chối sắp xếp. Bảng trống thì nó là hàng 2, ngay dưới tiêu đề.
 */
function buildDetail(
  book: ExcelJS.Workbook,
  bookings: readonly Booking[],
  { note, adminOrigin, frame }: { note?: string; adminOrigin: string; frame: Partial<ExcelJS.HeaderFooter> },
): void {
  const sheet = addSheet(book, x.sheets.detail, { tab: DATA_TAB, grid: true, landscape: true, frame });
  sheet.columns = [16, 46, 19, 14, 15, 15, 14].map((width) => ({ width }));
  const d = x.detail;
  headerRow(sheet, [d.code, d.tour, d.departureEnds, d.travellers, d.total, d.refunded, d.status]);
  const columns = 7;

  const first = 2;
  bookings.forEach((booking, index) => {
    const row = sheet.getRow(first + index);
    bookingLink(row.getCell(1), booking.code, adminOrigin);
    put(row.getCell(2), booking.tourTitle, { size: 10 });
    const ends = row.getCell(3);
    ends.value = calendarDate(booking.departureEndDate);
    ends.numFmt = DATE_FMT;
    ends.font = bodyFont({ size: 10 });
    count(row.getCell(4), guestCount(booking));
    money(row.getCell(5), booking.totalAmount);
    money(row.getCell(6), booking.refundedTotal);
    for (const column of [4, 5, 6]) row.getCell(column).font = bodyFont({ name: MONO_FONT, size: 10 });
    put(row.getCell(7), statusLabel(booking.status), {
      size: 10,
      color: { argb: booking.status === 'CANCELLED' ? COST : INK },
    });
    stripe(row, columns, index);
  });

  const last = first + bookings.length - 1;
  subtotalRow(sheet, t.bookingsTable.total, { first, last }, columns, [
    {
      column: 4,
      result: bookings.reduce((sum, booking) => sum + guestCount(booking), 0),
      numFmt: COUNT_FMT,
    },
    { column: 5, result: sumMoney(bookings.map((booking) => booking.totalAmount)), numFmt: MONEY_FMT },
    { column: 6, result: sumMoney(bookings.map((booking) => booking.refundedTotal)), numFmt: MONEY_FMT },
  ]);

  if (note) {
    const noteRow = bookings.length === 0 ? 2 : last + 3;
    sheet.mergeCells(noteRow, 1, noteRow, columns);
    const cell = put(sheet.getCell(noteRow, 1), note, { size: 10, italic: true, color: { argb: DIM } });
    cell.alignment = { wrapText: true, vertical: 'middle' };
    sheet.getRow(noteRow).height = 30;
  }

  freezeHeader(sheet, true);
  // Vùng lọc tới hàng DỮ LIỆU cuối (AMEND 2c), không gồm hàng Total (quyết định 9).
  sheet.autoFilter = { from: 'A1', to: { row: Math.max(1, last), column: columns } };
  sheet.pageSetup.printTitlesRow = '1:1';
}

/** Khối "How to read these numbers" — đi kèm MỌI bản xuất: file rời màn hình thì không còn tooltip. */
function buildDefinitions(book: ExcelJS.Workbook, frame: Partial<ExcelJS.HeaderFooter>): void {
  const sheet = addSheet(book, x.sheets.definitions, { tab: RULE, grid: false, frame });
  sheet.columns = [2, 5, 100].map((width) => ({ width }));
  put(sheet.getCell('B2'), t.definitions.heading, { name: HEAD_FONT, size: 15, bold: true });
  sheet.getRow(2).height = 28;
  const d = t.definitions;
  [d.revenue, d.recognised, d.costs, d.netProfit, d.refunds, d.statuses, d.cancellations].forEach(
    (line, index) => {
      const row = 4 + index;
      put(sheet.getCell(`B${row}`), index + 1, {
        name: MONO_FONT,
        size: 10,
        bold: true,
        color: { argb: BRAND },
      }).alignment = { vertical: 'top' };
      put(sheet.getCell(`C${row}`), line).alignment = { wrapText: true, vertical: 'top' };
      // Excel không tự giãn hàng khi mở file: ước ~95 ký tự một dòng ở cột rộng 100.
      sheet.getRow(row).height = Math.max(30, Math.ceil(line.length / 95) * 15 + 4);
    },
  );
}

/**
 * Toàn bộ workbook. `bookings` là tập của sheet Detail; mảng rỗng thì sheet vẫn có mặt với hàng tiêu
 * đề — một sheet BIẾN MẤT khi tháng vắng làm hai file cùng tháng khác cấu trúc. `adminOrigin` dựng
 * hyperlink mã đơn (quyết định 11 của plan).
 */
export async function buildReportWorkbook(
  report: AdminMonthlyReport,
  bookings: readonly Booking[],
  { detailNote, adminOrigin }: { detailNote?: string; adminOrigin: string },
): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  const monthLabel = formatMonthLabel(report.month);
  stampWorkbook(book, {
    title: x.docTitle(report.month),
    subject: x.subject(monthLabel),
    created: new Date(report.generatedAt),
  });
  const frame = printFrame(x.headerCenter(monthLabel), report.generatedAt);

  buildSummary(book, report, frame);
  buildBookings(book, report, frame);
  buildOperations(book, report, frame);
  buildDetail(book, bookings, { note: detailNote, adminOrigin, frame });
  buildDefinitions(book, frame);

  // ExcelJS khai kiểu trả về là `Buffer` của RIÊNG nó, không phải `Buffer` của Node — ép sang kiểu
  // Node là typecheck đỏ. `ArrayBuffer` là thứ nó thật sự trả, và `Response` nhận thẳng làm body.
  return (await book.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
```

  Cập nhật JSDoc đầu file `xlsx.ts`: bỏ đoạn "Vì sao Excel chứ không CSV" nói về `reportCsvRows` (đã
  không còn), thay bằng một câu: "File theo bản thảo D1 (ADR-0034 AMEND 3, spec G40 §6); đồ nghề chung ở
  `xlsx-style.ts`." Bảng năm sheet giữ.

- [ ] **Step 4: Route truyền origin** — `app/(admin)/reports/export/route.ts`, dòng cuối:

```ts
  return xlsxExportResponse(
    `nexora-report-${report.month}`,
    await buildReportWorkbook(report, rows, {
      detailNote,
      // Hyperlink mã đơn trỏ về CHÍNH admin đang chạy (dev hay prod) — builder không đoán domain.
      adminOrigin: request.nextUrl.origin,
    }),
  );
```

- [ ] **Step 5: Xoá khoá cũ** của `admin.reports.xlsx` không còn ai dùng: `title`, `period`,
  `generatedAt`, `currency`, `taxRate`, `cashHeading`, `grossMargin`, `departuresRun`,
  `costDataMissing`, `departuresCostMissing` (giữ `sheets`, `detail` và khoá mới của Task 1). Trước khi
  xoá: `rg -n "xlsx\.(title|period|generatedAt|currency|taxRate|cashHeading|grossMargin|departuresRun|costDataMissing|departuresCostMissing)\b" apps libs`
  phải ra rỗng ngoài chính `messages.ts`. Build lại i18n.

- [ ] **Step 6: Chạy** `pnpm --filter @tourism/admin exec vitest run src/lib/xlsx.spec.ts src/lib/xlsx-summary.spec.ts src/lib/export-route-gate.spec.ts --maxWorkers=2`
  — XANH. Typecheck admin.
- [ ] **Step 7: Thử đột biến** — đổi `to: { row: Math.max(1, last)` thành `last + 1`, thấy ca vùng lọc đỏ;
  đổi `bookings.length === 0 ? 2 : last + 3` thành luôn `2`, thấy ca lệch số đỏ; bỏ `encodeURIComponent`
  — ghi nhận không ca nào đỏ (mã đơn chỉ có `[A-Z0-9-]`), giữ lại vì đúng luật dựng URL; trả lại.
- [ ] **Step 8: Commit**

```bash
pnpm exec biome check --write apps/admin/src/lib/xlsx.ts apps/admin/src/lib/xlsx.spec.ts "apps/admin/src/app/(admin)/reports/export/route.ts" libs/shared/i18n/src/lib/messages.ts
git add apps/admin/src/lib/xlsx.ts apps/admin/src/lib/xlsx.spec.ts "apps/admin/src/app/(admin)/reports/export/route.ts" libs/shared/i18n/src/lib/messages.ts
git commit -m "feat(admin): bốn sheet còn lại của Excel báo cáo theo D1 — mã đơn bấm được, SUBTOTAL, ghi chú ngoài vùng lọc"
```

---

### Task 5: File Excel danh sách booking (`lib/bookings-xlsx.ts`)

**Files:**
- Create: `apps/admin/src/lib/bookings-xlsx.ts`, `apps/admin/src/lib/bookings-xlsx.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`admin.bookings.xlsx`), Task 2; `BookingsQuery` (`./bookings-query`);
  `formatCalendarDate`, `formatDateRange`, `guestCount`, `statusLabel` (`./bookings-view`).
- Produces: `BOOKINGS_XLSX_HEADER`, `bookingsFilterSummary`, `buildBookingsWorkbook`.

- [ ] **Step 1: Viết test đỏ** `bookings-xlsx.spec.ts`:

```ts
import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { BookingsQuery } from './bookings-query';
import {
  BOOKINGS_XLSX_HEADER,
  bookingsFilterSummary,
  buildBookingsWorkbook,
} from './bookings-xlsx';
import { COST, DATE_FMT, DATETIME_FMT, MONEY_FMT } from './xlsx-style';

/**
 * File Excel của `/bookings/export` (G40, ADR-0034 AMEND 3): ô mang KIỂU thật để người mở lọc, cộng,
 * dựng pivot — tiền là số, ngày là ngày, mốc thời gian là ngày-giờ theo giờ Việt Nam.
 */
const x = messages.admin.bookings.xlsx;
const ORIGIN = 'https://admin.example.com';
const AT = '2026-10-10T02:30:00.000Z';

const booking: Booking = {
  id: 'a0000001-0000-4000-8000-000000000001',
  code: 'BK-7Q2M9XKD',
  status: 'PAID',
  tourTitle: 'Hội An Ancient Town Walking Tour',
  tourSlug: 'hoi-an-ancient-town-walking-tour',
  tourImage: null,
  tourDestinations: [],
  departureStartDate: '2026-09-18',
  departureEndDate: '2026-09-20',
  cancellationDeadline: '2026-09-15',
  departureCancelled: false,
  unitPrice: '39.00',
  totalAmount: '117.00',
  currency: 'USD',
  numAdults: 2,
  numChildren: 1,
  contactName: 'Alice Nguyen',
  contactEmail: 'alice@example.com',
  contactPhone: '+84 90 123 4567',
  specialRequests: null,
  paymentProvider: 'STRIPE',
  checkoutUrl: null,
  paidAt: '2026-07-18T10:15:00.000Z',
  cancelledAt: null,
  createdAt: '2026-07-18T09:00:00.000Z',
  cancellationStatus: null,
  cancellationRequestedAt: null,
  cancellationDecidedAt: null,
  refundedTotal: '0.00',
  reviewedAt: null,
};

const cancelled: Booking = {
  ...booking,
  code: 'BK-CANCEL01',
  status: 'CANCELLED',
  contactPhone: null,
  paidAt: null,
  cancelledAt: '2026-07-19T17:30:00.000Z',
  totalAmount: '39.00',
  refundedTotal: '39.00',
  numAdults: 1,
  numChildren: 0,
};

const QUERY: BookingsQuery = { page: 1, limit: 20, from: '2026-07-01', to: '2026-07-31' };

async function open(
  rows: readonly Booking[] = [booking, cancelled],
  options: { query?: BookingsQuery; selected?: number } = {},
): Promise<ExcelJS.Worksheet> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    await buildBookingsWorkbook(rows, {
      query: options.query ?? QUERY,
      selected: options.selected ?? 0,
      adminOrigin: ORIGIN,
      generatedAt: AT,
    }),
  );
  const sheet = book.getWorksheet(x.sheet);
  if (!sheet) throw new Error('Không có sheet Bookings');
  return sheet;
}

describe('BOOKINGS_XLSX_HEADER', () => {
  it('18 cột đúng thứ tự spec §7.1, nhãn từ i18n', () => {
    const c = x.columns;
    expect(BOOKINGS_XLSX_HEADER).toEqual([
      c.code, c.status, c.tour, c.departureStart, c.departureEnd, c.adults, c.children, c.guests,
      c.unitPrice, c.total, c.refunded, c.currency, c.customer, c.email, c.phone, c.bookedAt,
      c.paidAt, c.cancelledAt,
    ]);
  });
});

describe('bookingsFilterSummary — đầu trang khi in', () => {
  it('URL trần (tháng hiện tại): khoảng ngày', () => {
    expect(bookingsFilterSummary(QUERY, 0)).toBe('1 Jul 2026 – 31 Jul 2026');
  });

  it('trạng thái · khoảng ngày · từ khoá · số hàng chọn', () => {
    expect(
      bookingsFilterSummary({ ...QUERY, status: 'PAID', search: 'hoi an' }, 3),
    ).toBe(
      [messages.admin.bookings.status.PAID, '1 Jul 2026 – 31 Jul 2026', x.search('hoi an'), x.selected(3)].join(' · '),
    );
  });

  it('một đầu ngày; không lọc gì thì "All bookings"', () => {
    expect(bookingsFilterSummary({ page: 1, limit: 20, from: '2026-07-01' }, 0)).toBe(x.dateFrom('1 Jul 2026'));
    expect(bookingsFilterSummary({ page: 1, limit: 20, to: '2026-07-31' }, 0)).toBe(x.dateUntil('31 Jul 2026'));
    expect(bookingsFilterSummary({ page: 1, limit: 20, allDates: true }, 0)).toBe(x.allBookings);
  });
});

describe('buildBookingsWorkbook', () => {
  it('hàng tiêu đề ở hàng 1, đóng băng, lọc tới hàng dữ liệu cuối, khổ ngang', async () => {
    const sheet = await open();
    expect(sheet.getCell('A1').value).toBe(x.columns.code);
    expect(sheet.getCell('R1').value).toBe(x.columns.cancelledAt);
    expect(sheet.views[0]?.state).toBe('frozen');
    expect(sheet.autoFilter).toBe('A1:R3');
    expect(sheet.pageSetup.orientation).toBe('landscape');
    expect(sheet.headerFooter.oddHeader).toContain(x.headerCenter('1 Jul 2026 – 31 Jul 2026'));
  });

  it('một hàng: mã là hyperlink, nhãn trạng thái admin, ngày là ngày, tiền là số', async () => {
    const sheet = await open();
    expect(sheet.getCell('A2').value).toEqual({ text: 'BK-7Q2M9XKD', hyperlink: `${ORIGIN}/bookings/BK-7Q2M9XKD` });
    expect(sheet.getCell('B2').value).toBe(messages.admin.bookings.status.PAID);
    expect(sheet.getCell('D2').value).toEqual(new Date('2026-09-18T00:00:00.000Z'));
    expect(sheet.getCell('D2').numFmt).toBe(DATE_FMT);
    expect(sheet.getCell('H2').value).toBe(3);
    expect(sheet.getCell('I2').value).toBe(39);
    expect(sheet.getCell('J2').value).toBe(117);
    expect(sheet.getCell('J2').numFmt).toBe(MONEY_FMT);
    expect(sheet.getCell('K2').value).toBe(0);
    expect(sheet.getCell('L2').value).toBe('USD');
    expect(sheet.getCell('O2').value).toBe('+84 90 123 4567');
  });

  it('mốc thời gian là ngày-giờ theo giờ VIỆT NAM; mốc vắng là ô trống', async () => {
    const sheet = await open();
    expect(sheet.getCell('P2').value).toEqual(new Date('2026-07-18T16:00:00.000Z')); // 09:00Z = 16:00 VN
    expect(sheet.getCell('P2').numFmt).toBe(DATETIME_FMT);
    expect(sheet.getCell('R2').value).toBeNull();
    expect(sheet.getCell('O3').value).toBeNull(); // không có điện thoại
    expect(sheet.getCell('R3').value).toEqual(new Date('2026-07-20T00:30:00.000Z'));
  });

  it('"Cancelled" chữ màu chi phí', async () => {
    expect((await open()).getCell('B3').font?.color?.argb).toBe(COST);
  });

  it('hàng Total: SUBTOTAL(109) cho Guests, Total, Refunded', async () => {
    const sheet = await open();
    expect(sheet.getCell('A4').value).toBe(x.total);
    expect(sheet.getCell('H4').value).toEqual({ formula: 'SUBTOTAL(109,H2:H3)', result: 4 });
    expect(sheet.getCell('J4').value).toEqual({ formula: 'SUBTOTAL(109,J2:J3)', result: 156 });
    expect(sheet.getCell('K4').value).toEqual({ formula: 'SUBTOTAL(109,K2:K3)', result: 39 });
  });

  it('tập rỗng vẫn có hàng tiêu đề, không hàng Total', async () => {
    const sheet = await open([]);
    expect(sheet.getCell('A1').value).toBe(x.columns.code);
    expect(sheet.getCell('A2').value).toBeNull();
    expect(sheet.autoFilter).toBe('A1:R1');
  });

  it('chữ bắt đầu bằng "=" là CHUỖI, không thành công thức (không có CSV injection ở .xlsx)', async () => {
    const sheet = await open([{ ...booking, contactName: '=HYPERLINK("http://x")' }]);
    expect(sheet.getCell('M2').value).toBe('=HYPERLINK("http://x")');
  });
});
```

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/admin exec vitest run src/lib/bookings-xlsx.spec.ts --maxWorkers=2`.

- [ ] **Step 3: Viết `bookings-xlsx.ts`**:

```ts
import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import type { BookingsQuery } from './bookings-query';
import { formatCalendarDate, formatDateRange, guestCount, statusLabel } from './bookings-view';
import {
  addSheet,
  bodyFont,
  bookingLink,
  COST,
  COUNT_FMT,
  calendarDate,
  count,
  DATE_FMT,
  DATETIME_FMT,
  DIM,
  freezeHeader,
  headerRow,
  INK,
  MONEY_FMT,
  MONO_FONT,
  money,
  printFrame,
  stampWorkbook,
  stripe,
  subtotalRow,
  sumMoney,
  vietnamDateTime,
} from './xlsx-style';

/**
 * File Excel của `/bookings/export` (G40, ADR-0034 AMEND 3 — thay `bookings-csv.ts`). THUẦN: nhận
 * booking, trả `ArrayBuffer`. Mỗi ô mang KIỂU thật — tiền là số, ngày là ngày, mốc thời gian là
 * ngày-giờ theo giờ Việt Nam — nên file mở đúng bằng bấm đúp ở mọi máy (CSV dồn một cột trên Windows
 * tiếng Việt, đo 10/10).
 *
 * Không còn khâu chống "CSV injection": ô chữ của `.xlsx` lưu kiểu chuỗi, Excel không bao giờ chạy nó
 * như công thức — chỉ ô `{ formula }` mới là công thức.
 */
const x = messages.admin.bookings.xlsx;
const c = x.columns;

export const BOOKINGS_XLSX_HEADER: readonly string[] = [
  c.code,
  c.status,
  c.tour,
  c.departureStart,
  c.departureEnd,
  c.adults,
  c.children,
  c.guests,
  c.unitPrice,
  c.total,
  c.refunded,
  c.currency,
  c.customer,
  c.email,
  c.phone,
  c.bookedAt,
  c.paidAt,
  c.cancelledAt,
];

/** Độ rộng 18 cột, cùng thứ tự `BOOKINGS_XLSX_HEADER`. */
const WIDTHS = [16, 18, 36, 14, 14, 9, 9, 9, 14, 13, 13, 10, 22, 30, 18, 20, 20, 20];

/**
 * Tóm tắt bộ lọc cho đầu trang khi in (spec §7.1): trạng thái · khoảng ngày · từ khoá · số hàng chọn,
 * hoặc "All bookings". Ngày tách CHUỖI (`formatCalendarDate`), không qua `Date` — không trôi múi giờ.
 */
export function bookingsFilterSummary(query: BookingsQuery, selected: number): string {
  const parts: string[] = [];
  if (query.status) parts.push(statusLabel(query.status));
  if (query.from && query.to) parts.push(formatDateRange(query.from, query.to));
  else if (query.from) parts.push(x.dateFrom(formatCalendarDate(query.from)));
  else if (query.to) parts.push(x.dateUntil(formatCalendarDate(query.to)));
  if (query.search) parts.push(x.search(query.search));
  if (selected > 0) parts.push(x.selected(selected));
  return parts.length === 0 ? x.allBookings : parts.join(' · ');
}

/** Ô ngày-giờ theo giờ Việt Nam, hoặc để TRỐNG khi mốc vắng — ô trống là "không có giá trị". */
function vietnamTime(cell: ExcelJS.Cell, iso: string | null): void {
  if (iso === null) return;
  cell.value = vietnamDateTime(iso);
  cell.numFmt = DATETIME_FMT;
}

export async function buildBookingsWorkbook(
  bookings: readonly Booking[],
  {
    query,
    selected,
    adminOrigin,
    generatedAt,
  }: { query: BookingsQuery; selected: number; adminOrigin: string; generatedAt: string },
): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  const summary = bookingsFilterSummary(query, selected);
  stampWorkbook(book, { title: x.docTitle, subject: summary, created: new Date(generatedAt) });
  const sheet = addSheet(book, x.sheet, {
    tab: DIM,
    grid: true,
    landscape: true,
    frame: printFrame(x.headerCenter(summary), generatedAt),
  });
  sheet.columns = WIDTHS.map((width) => ({ width }));
  headerRow(sheet, BOOKINGS_XLSX_HEADER);
  const columns = BOOKINGS_XLSX_HEADER.length;

  const first = 2;
  bookings.forEach((booking, index) => {
    const row = sheet.getRow(first + index);
    bookingLink(row.getCell(1), booking.code, adminOrigin);
    row.getCell(2).value = statusLabel(booking.status);
    row.getCell(3).value = booking.tourTitle;
    row.getCell(4).value = calendarDate(booking.departureStartDate);
    row.getCell(5).value = calendarDate(booking.departureEndDate);
    count(row.getCell(6), booking.numAdults);
    count(row.getCell(7), booking.numChildren);
    count(row.getCell(8), guestCount(booking));
    money(row.getCell(9), booking.unitPrice);
    money(row.getCell(10), booking.totalAmount);
    money(row.getCell(11), booking.refundedTotal);
    row.getCell(12).value = booking.currency;
    row.getCell(13).value = booking.contactName;
    row.getCell(14).value = booking.contactEmail;
    if (booking.contactPhone !== null) row.getCell(15).value = booking.contactPhone;
    vietnamTime(row.getCell(16), booking.createdAt);
    vietnamTime(row.getCell(17), booking.paidAt);
    vietnamTime(row.getCell(18), booking.cancelledAt);

    for (let column = 2; column <= columns; column += 1) {
      const numeric = column >= 6 && column <= 11;
      row.getCell(column).font = bodyFont({
        size: 10,
        ...(numeric ? { name: MONO_FONT } : {}),
        color: { argb: column === 2 && booking.status === 'CANCELLED' ? COST : INK },
      });
    }
    row.getCell(4).numFmt = DATE_FMT;
    row.getCell(5).numFmt = DATE_FMT;
    stripe(row, columns, index);
  });

  const last = first + bookings.length - 1;
  subtotalRow(sheet, x.total, { first, last }, columns, [
    { column: 8, result: bookings.reduce((sum, b) => sum + guestCount(b), 0), numFmt: COUNT_FMT },
    { column: 10, result: sumMoney(bookings.map((b) => b.totalAmount)), numFmt: MONEY_FMT },
    { column: 11, result: sumMoney(bookings.map((b) => b.refundedTotal)), numFmt: MONEY_FMT },
  ]);

  freezeHeader(sheet, true);
  // Lọc tới hàng DỮ LIỆU cuối, không gồm hàng Total (sắp xếp sẽ kéo nó lên giữa bảng).
  sheet.autoFilter = { from: 'A1', to: { row: Math.max(1, last), column: columns } };
  sheet.pageSetup.printTitlesRow = '1:1';

  // Kiểu `Buffer` riêng của ExcelJS — xem `buildReportWorkbook`.
  return (await book.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
```

- [ ] **Step 4: Chạy, thấy XANH.** (Ca giờ VN của hàng huỷ: `2026-07-19T17:30Z` + 7h = `2026-07-20T00:30Z`.)
- [ ] **Step 5: Thử đột biến** — đổi `vietnamDateTime` thành `new Date(iso)` ở `vietnamTime`, thấy ca giờ
  VN đỏ; bỏ nhánh `else if (query.from)`, thấy ca một đầu ngày đỏ; trả lại.
- [ ] **Step 6: Typecheck và commit**

```bash
pnpm --filter @tourism/admin typecheck
pnpm exec biome check --write apps/admin/src/lib/bookings-xlsx.ts apps/admin/src/lib/bookings-xlsx.spec.ts
git add apps/admin/src/lib/bookings-xlsx.ts apps/admin/src/lib/bookings-xlsx.spec.ts
git commit -m "feat(admin): file Excel danh sách booking — ô đúng kiểu, giờ Việt Nam, mã đơn bấm được, SUBTOTAL"
```

---

### Task 6: File Excel danh sách subscriber (`lib/subscribers-xlsx.ts`)

**Files:**
- Create: `apps/admin/src/lib/subscribers-xlsx.ts`, `apps/admin/src/lib/subscribers-xlsx.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`admin.subscribers.xlsx`), Task 2; `SubscribersQuery` (`./subscribers-query`);
  `messages.admin.subscribers.list.{all, active, unsubscribed, awaitingConfirmation}`.
- Produces: `SUBSCRIBERS_XLSX_HEADER`, `subscriberStatus`, `subscribersFilterSummary`,
  `buildSubscribersWorkbook`.

- [ ] **Step 1: Viết test đỏ** `subscribers-xlsx.spec.ts`:

```ts
import type { SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  buildSubscribersWorkbook,
  SUBSCRIBERS_XLSX_HEADER,
  subscriberStatus,
  subscribersFilterSummary,
} from './subscribers-xlsx';
import { DATETIME_FMT } from './xlsx-style';

const l = messages.admin.subscribers.list;
const x = messages.admin.subscribers.xlsx;

const active: SubscriberRow = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  email: 'ada@example.com',
  source: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  confirmedAt: '2026-09-01T10:05:00.000Z',
  unsubscribedAt: null,
};
const left: SubscriberRow = {
  ...active,
  id: '4f2a1b3c-0000-4000-8000-000000000002',
  email: 'bo@example.com',
  source: 'footer',
  unsubscribedAt: '2026-09-02T08:30:00.000Z',
};

async function open(rows: readonly SubscriberRow[] = [active, left]): Promise<ExcelJS.Worksheet> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    await buildSubscribersWorkbook(rows, {
      query: { page: 1, limit: 20, active: true },
      generatedAt: '2026-10-10T02:30:00.000Z',
    }),
  );
  const sheet = book.getWorksheet(x.sheet);
  if (!sheet) throw new Error('Không có sheet Subscribers');
  return sheet;
}

describe('subscriberStatus', () => {
  it('đã rút consent → Unsubscribed; chưa bấm link xác nhận → Awaiting confirmation; còn lại Active', () => {
    expect(subscriberStatus(left)).toBe(l.unsubscribed);
    expect(subscriberStatus({ confirmedAt: null, unsubscribedAt: null })).toBe(l.awaitingConfirmation);
    expect(subscriberStatus(active)).toBe(l.active);
  });
});

describe('subscribersFilterSummary', () => {
  it('tab · nguồn · từ khoá', () => {
    expect(subscribersFilterSummary({ page: 1, limit: 20, active: true })).toBe(l.active);
    expect(subscribersFilterSummary({ page: 1, limit: 20 })).toBe(l.all);
    expect(
      subscribersFilterSummary({ page: 1, limit: 20, active: false, source: 'footer', search: 'ada' }),
    ).toBe([l.unsubscribed, x.source('footer'), x.search('ada')].join(' · '));
  });
});

describe('buildSubscribersWorkbook', () => {
  it('sáu cột đúng thứ tự spec §7.2', async () => {
    const sheet = await open();
    const c = x.columns;
    expect(SUBSCRIBERS_XLSX_HEADER).toEqual([
      c.email, c.source, c.status, c.subscribedAt, c.confirmedAt, c.unsubscribedAt,
    ]);
    expect(sheet.getCell('A1').value).toBe(c.email);
    expect(sheet.headerFooter.oddHeader).toContain(x.headerCenter(l.active));
  });

  it('nguồn nguyên văn (vắng là ô trống), trạng thái là nhãn, mốc là giờ Việt Nam', async () => {
    const sheet = await open();
    expect(sheet.getCell('B2').value).toBeNull();
    expect(sheet.getCell('C2').value).toBe(l.active);
    expect(sheet.getCell('D2').value).toEqual(new Date('2026-09-01T17:00:00.000Z'));
    expect(sheet.getCell('D2').numFmt).toBe(DATETIME_FMT);
    expect(sheet.getCell('F2').value).toBeNull();
    expect(sheet.getCell('B3').value).toBe('footer');
    expect(sheet.getCell('C3').value).toBe(l.unsubscribed);
  });

  it('đóng băng, lọc tới hàng cuối; tập rỗng vẫn có tiêu đề', async () => {
    const sheet = await open();
    expect(sheet.views[0]?.state).toBe('frozen');
    expect(sheet.autoFilter).toBe('A1:F3');
    const empty = await open([]);
    expect(empty.getCell('A2').value).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/admin exec vitest run src/lib/subscribers-xlsx.spec.ts --maxWorkers=2`.

- [ ] **Step 3: Viết `subscribers-xlsx.ts`**:

```ts
import type { SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import type { SubscribersQuery } from './subscribers-query';
import {
  addSheet,
  bodyFont,
  DATETIME_FMT,
  DIM,
  freezeHeader,
  headerRow,
  printFrame,
  stampWorkbook,
  stripe,
  vietnamDateTime,
} from './xlsx-style';

/**
 * File Excel của `/subscribers/export` (G40, ADR-0034 AMEND 3 — thay `subscribers-csv.ts`). Danh sách
 * LIÊN LẠC, không phải bản sao lưu: không có `id`. Nguồn ghi nguyên văn (vắng là ô trống); trạng thái
 * là nhãn của bảng; mốc là ngày-giờ theo giờ Việt Nam.
 */
const l = messages.admin.subscribers.list;
const x = messages.admin.subscribers.xlsx;
const c = x.columns;

export const SUBSCRIBERS_XLSX_HEADER: readonly string[] = [
  c.email,
  c.source,
  c.status,
  c.subscribedAt,
  c.confirmedAt,
  c.unsubscribedAt,
];

const WIDTHS = [34, 18, 22, 22, 22, 22];

/**
 * Trạng thái của một địa chỉ: đã rút consent thắng mọi thứ; chưa bấm link xác nhận (double opt-in,
 * W4 E3) là "Awaiting confirmation"; còn lại đang nhận tin.
 */
export function subscriberStatus(row: Pick<SubscriberRow, 'confirmedAt' | 'unsubscribedAt'>): string {
  if (row.unsubscribedAt !== null) return l.unsubscribed;
  return row.confirmedAt === null ? l.awaitingConfirmation : l.active;
}

/** Tóm tắt bộ lọc cho đầu trang khi in: tab (Active · Unsubscribed · All) · nguồn · từ khoá. */
export function subscribersFilterSummary(query: SubscribersQuery): string {
  const parts = [query.active === undefined ? l.all : query.active ? l.active : l.unsubscribed];
  if (query.source) parts.push(x.source(query.source));
  if (query.search) parts.push(x.search(query.search));
  return parts.join(' · ');
}

function vietnamTime(cell: ExcelJS.Cell, iso: string | null): void {
  if (iso === null) return;
  cell.value = vietnamDateTime(iso);
  cell.numFmt = DATETIME_FMT;
}

export async function buildSubscribersWorkbook(
  rows: readonly SubscriberRow[],
  { query, generatedAt }: { query: SubscribersQuery; generatedAt: string },
): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  const summary = subscribersFilterSummary(query);
  stampWorkbook(book, { title: x.docTitle, subject: summary, created: new Date(generatedAt) });
  const sheet = addSheet(book, x.sheet, {
    tab: DIM,
    grid: true,
    frame: printFrame(x.headerCenter(summary), generatedAt),
  });
  sheet.columns = WIDTHS.map((width) => ({ width }));
  headerRow(sheet, SUBSCRIBERS_XLSX_HEADER);
  const columns = SUBSCRIBERS_XLSX_HEADER.length;

  rows.forEach((subscriber, index) => {
    const row = sheet.getRow(2 + index);
    row.getCell(1).value = subscriber.email;
    if (subscriber.source !== null) row.getCell(2).value = subscriber.source;
    row.getCell(3).value = subscriberStatus(subscriber);
    vietnamTime(row.getCell(4), subscriber.createdAt);
    vietnamTime(row.getCell(5), subscriber.confirmedAt);
    vietnamTime(row.getCell(6), subscriber.unsubscribedAt);
    for (let column = 1; column <= columns; column += 1) row.getCell(column).font = bodyFont({ size: 10 });
    stripe(row, columns, index);
  });

  freezeHeader(sheet, true);
  sheet.autoFilter = { from: 'A1', to: { row: Math.max(1, rows.length + 1), column: columns } };
  sheet.pageSetup.printTitlesRow = '1:1';
  return (await book.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
```

- [ ] **Step 4: Chạy, thấy XANH.**
- [ ] **Step 5: Thử đột biến** — đảo hai nhánh của `subscriberStatus` (kiểm `confirmedAt` trước), thấy ca
  đã rút consent đỏ; trả lại.
- [ ] **Step 6: Typecheck và commit**

```bash
pnpm --filter @tourism/admin typecheck
pnpm exec biome check --write apps/admin/src/lib/subscribers-xlsx.ts apps/admin/src/lib/subscribers-xlsx.spec.ts
git add apps/admin/src/lib/subscribers-xlsx.ts apps/admin/src/lib/subscribers-xlsx.spec.ts
git commit -m "feat(admin): file Excel danh sách subscriber — trạng thái bằng nhãn, giờ Việt Nam"
```

---

### Task 7: Hai route xuất trả Excel, gỡ CSV

**Files:**
- Modify: `apps/admin/src/app/(admin)/bookings/export/route.ts`, `.../subscribers/export/route.ts`
- Modify: `apps/admin/src/lib/export-route.ts` (+ `export-route.spec.ts`)
- Create: `apps/admin/src/lib/export-route-xlsx.spec.ts`
- Delete: `apps/admin/src/lib/csv.ts`, `csv.spec.ts`, `bookings-csv.ts`, `bookings-csv.spec.ts`,
  `subscribers-csv.ts`, `subscribers-csv.spec.ts`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (xoá `admin.bookings.csv`, `admin.subscribers.csv`)

**Interfaces:**
- Consumes: Task 5, Task 6.
- Produces: `isoDay`, `exportFilename` ở `@/lib/export-route`.

- [ ] **Step 1: Viết test đỏ** `export-route-xlsx.spec.ts` (đọc nếp mock của `export-route-gate.spec.ts`):

```ts
import type { Booking, SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Ba route xuất trả `.xlsx` (G40, ADR-0034 AMEND 3) mà KHÔNG đổi hạ tầng: 413 khi vượt trần, 409 khi
 * tập đổi hay hàng chọn đã trôi, header tải file đúng loại. Gate đã có ma trận riêng
 * (`export-route.spec`, `export-route-gate.spec`) — ở đây gate cho qua.
 */
const ADMIN = { id: 'a1', name: 'A', email: 'a@example.com', role: 'ADMIN', image: null };

const { guardExportAccess } = vi.hoisted(() => ({ guardExportAccess: vi.fn() }));
vi.mock('@/lib/export-route', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/export-route')>();
  return { ...actual, guardExportAccess };
});
const { fetchAdminBookings, fetchAllAdminBookings } = vi.hoisted(() => ({
  fetchAdminBookings: vi.fn(),
  fetchAllAdminBookings: vi.fn(),
}));
vi.mock('@/lib/api/bookings', () => ({ fetchAdminBookings, fetchAllAdminBookings }));
const { fetchAllAdminSubscribers } = vi.hoisted(() => ({ fetchAllAdminSubscribers: vi.fn() }));
vi.mock('@/lib/api/subscribers', () => ({ fetchAllAdminSubscribers }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ toString: (): string => '' })) }));

const booking = {
  code: 'BK-7Q2M9XKD',
  status: 'PAID',
  tourTitle: 'Hội An Ancient Town Walking Tour',
  departureStartDate: '2026-09-18',
  departureEndDate: '2026-09-20',
  unitPrice: '39.00',
  totalAmount: '117.00',
  refundedTotal: '0.00',
  currency: 'USD',
  numAdults: 2,
  numChildren: 1,
  contactName: 'Alice Nguyen',
  contactEmail: 'alice@example.com',
  contactPhone: null,
  createdAt: '2026-07-18T09:00:00.000Z',
  paidAt: '2026-07-18T10:15:00.000Z',
  cancelledAt: null,
} as unknown as Booking;

const subscriber: SubscriberRow = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  email: 'ada@example.com',
  source: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  confirmedAt: '2026-09-01T10:05:00.000Z',
  unsubscribedAt: null,
};

function requestFor(path: string): NextRequest {
  return { nextUrl: new URL(`https://admin.example.com${path}`) } as unknown as NextRequest;
}

async function sheetOf(response: Response, name: string): Promise<ExcelJS.Worksheet> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await response.arrayBuffer());
  const sheet = book.getWorksheet(name);
  if (!sheet) throw new Error(`Không có sheet ${name}`);
  return sheet;
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

beforeEach(() => {
  vi.clearAllMocks();
  guardExportAccess.mockResolvedValue({ ok: true, session: ADMIN });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /bookings/export', () => {
  it('cả tập → .xlsx tải về, mã đơn trỏ về chính origin admin', async () => {
    fetchAllAdminBookings.mockResolvedValue({ kind: 'rows', items: [booking] });
    const { GET } = await import('@/app/(admin)/bookings/export/route');
    const response = await GET(requestFor('/bookings/export'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(XLSX);
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="nexora-bookings-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    const sheet = await sheetOf(response, messages.admin.bookings.xlsx.sheet);
    expect(sheet.getCell('A2').value).toEqual({
      text: 'BK-7Q2M9XKD',
      hyperlink: 'https://admin.example.com/bookings/BK-7Q2M9XKD',
    });
  });

  it('vượt trần → 413 kèm con số, không file', async () => {
    fetchAllAdminBookings.mockResolvedValue({ kind: 'too-large', total: 2500, max: 2000 });
    const { GET } = await import('@/app/(admin)/bookings/export/route');
    const response = await GET(requestFor('/bookings/export'));
    expect(response.status).toBe(413);
    expect(await response.text()).toBe(messages.admin.bookings.list.exportTooLarge(2500, 2000));
  });

  it('tập đổi giữa vòng gom → 409', async () => {
    fetchAllAdminBookings.mockResolvedValue({ kind: 'changed', total: 10, now: 11 });
    const { GET } = await import('@/app/(admin)/bookings/export/route');
    const response = await GET(requestFor('/bookings/export'));
    expect(response.status).toBe(409);
    expect(await response.text()).toBe(messages.admin.errors.exportListChanged);
  });

  it('xuất hàng đã chọn → .xlsx đúng các hàng ấy, đầu trang ghi số hàng chọn', async () => {
    fetchAdminBookings.mockResolvedValue({ items: [booking], total: 1, page: 1, limit: 20, totalPages: 1 });
    const { GET } = await import('@/app/(admin)/bookings/export/route');
    const response = await GET(requestFor('/bookings/export?page=1&limit=20&sel=BK-7Q2M9XKD'));
    expect(response.status).toBe(200);
    const sheet = await sheetOf(response, messages.admin.bookings.xlsx.sheet);
    expect(sheet.headerFooter.oddHeader).toContain(messages.admin.bookings.xlsx.selected(1));
    expect(fetchAllAdminBookings).not.toHaveBeenCalled();
  });

  it('hàng đã chọn không còn trên trang → 409', async () => {
    fetchAdminBookings.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    const { GET } = await import('@/app/(admin)/bookings/export/route');
    const response = await GET(requestFor('/bookings/export?page=1&limit=20&sel=BK-7Q2M9XKD'));
    expect(response.status).toBe(409);
    expect(await response.text()).toBe(messages.admin.errors.exportSelectionStale);
  });
});

describe('GET /subscribers/export', () => {
  it('cả tập → .xlsx tải về', async () => {
    fetchAllAdminSubscribers.mockResolvedValue({ kind: 'rows', items: [subscriber] });
    const { GET } = await import('@/app/(admin)/subscribers/export/route');
    const response = await GET(requestFor('/subscribers/export'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="nexora-subscribers-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    const sheet = await sheetOf(response, messages.admin.subscribers.xlsx.sheet);
    expect(sheet.getCell('A2').value).toBe('ada@example.com');
  });

  it('vượt trần → 413', async () => {
    fetchAllAdminSubscribers.mockResolvedValue({ kind: 'too-large', total: 2500, max: 2000 });
    const { GET } = await import('@/app/(admin)/subscribers/export/route');
    const response = await GET(requestFor('/subscribers/export'));
    expect(response.status).toBe(413);
  });
});
```

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/admin exec vitest run src/lib/export-route-xlsx.spec.ts --maxWorkers=2`
  (route còn trả CSV: content-type sai, ExcelJS không mở được).

- [ ] **Step 3: Đổi hai route.** `bookings/export/route.ts`: import `buildBookingsWorkbook` từ
  `@/lib/bookings-xlsx` và `xlsxExportResponse` thay `bookingsCsvRows`, `csvExportResponse`. Đọc đồng hồ
  một lần ngay sau `cookie`: `const generatedAt = new Date().toISOString();`. Hai chỗ trả file:

```ts
    return xlsxExportResponse(
      'nexora-bookings',
      await buildBookingsWorkbook(rows, {
        query,
        selected: rows.length,
        adminOrigin: request.nextUrl.origin,
        generatedAt,
      }),
    );
```

```ts
  return xlsxExportResponse(
    'nexora-bookings',
    await buildBookingsWorkbook(result.items, {
      query,
      selected: 0,
      adminOrigin: request.nextUrl.origin,
      generatedAt,
    }),
  );
```

  `subscribers/export/route.ts`: tương tự với
  `await buildSubscribersWorkbook(result.items, { query, generatedAt: new Date().toISOString() })`.
  JSDoc hai route: "tải CSV" → "tải Excel"; "headers CSV" → "headers tải file".

- [ ] **Step 4: Dời `isoDay`, `exportFilename` sang `export-route.ts`** — chép nguyên hai hàm cùng JSDoc
  từ `csv.ts` vào `export-route.ts` (đặt trên `XLSX_CONTENT_TYPE`), bỏ `import … from '@/lib/csv'`, gỡ
  `csvExportResponse`. JSDoc đầu file: "Phần CHUNG của mọi route export CSV" → "Phần CHUNG của mọi
  route export"; JSDoc `xlsxExportResponse` bỏ cụm "y hệt đường CSV". Chuyển ca test của `isoDay` và tên
  file từ `csv.spec.ts` sang `export-route.spec.ts`, thêm ca header:

```ts
import { exportFilename, isoDay, XLSX_CONTENT_TYPE, xlsxExportResponse } from './export-route';

describe('isoDay', () => {
  it('ngày UTC của một mốc — cùng thước với ngày mà API lọc', () => {
    expect(isoDay(new Date('2026-09-01T23:30:00.000Z'))).toBe('2026-09-01');
    expect(isoDay(new Date('2026-12-31T00:00:00.000Z'))).toBe('2026-12-31');
  });
});

describe('exportFilename', () => {
  it('tên + ngày xuất + đuôi; làm sạch tên vì nó đi vào header HTTP', () => {
    expect(exportFilename('nexora-bookings', '2026-09-01', 'xlsx')).toBe('nexora-bookings-2026-09-01.xlsx');
    expect(exportFilename('book"ings\r\n', '2026-09-01', 'xlsx')).toBe('book-ings-2026-09-01.xlsx');
    expect(exportFilename('Nexora Bookings', '2026-09-01', 'xlsx')).toBe('nexora-bookings-2026-09-01.xlsx');
  });
});

describe('xlsxExportResponse', () => {
  it('ép tải về đúng tên .xlsx, đúng content-type, cấm cache', () => {
    const response = xlsxExportResponse('nexora-bookings', new ArrayBuffer(0));
    expect(response.headers.get('content-type')).toBe(XLSX_CONTENT_TYPE);
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="nexora-bookings-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
```

  (Mock `@/lib/api/session` sẵn có ở đầu `export-route.spec.ts` không ảnh hưởng các ca này.)

- [ ] **Step 5: Gỡ CSV** — `git rm apps/admin/src/lib/csv.ts apps/admin/src/lib/csv.spec.ts apps/admin/src/lib/bookings-csv.ts apps/admin/src/lib/bookings-csv.spec.ts apps/admin/src/lib/subscribers-csv.ts apps/admin/src/lib/subscribers-csv.spec.ts`.
  Xoá khối `admin.bookings.csv` và `admin.subscribers.csv` trong `messages.ts` (`rg -n "\.csv\." apps libs`
  ra rỗng trước khi xoá); build lại i18n.

- [ ] **Step 6: Chạy** `pnpm --filter @tourism/admin exec vitest run src/lib --maxWorkers=2` — XANH (gồm
  `export-route-gate.spec.ts`); typecheck admin.
- [ ] **Step 7: Thử đột biến** — ở nhánh chọn hàng, đổi `selected: rows.length` thành `0`, thấy ca đầu
  trang hàng chọn đỏ; xoá dòng `if (rows.length !== wanted.size)` của route, thấy ca 409 đỏ; trả lại.
- [ ] **Step 8: Commit**

```bash
pnpm exec biome check --write "apps/admin/src/app/(admin)/bookings/export/route.ts" "apps/admin/src/app/(admin)/subscribers/export/route.ts" apps/admin/src/lib/export-route.ts apps/admin/src/lib/export-route.spec.ts apps/admin/src/lib/export-route-xlsx.spec.ts libs/shared/i18n/src/lib/messages.ts
git add "apps/admin/src/app/(admin)/bookings/export/route.ts" "apps/admin/src/app/(admin)/subscribers/export/route.ts" apps/admin/src/lib/export-route.ts apps/admin/src/lib/export-route.spec.ts apps/admin/src/lib/export-route-xlsx.spec.ts libs/shared/i18n/src/lib/messages.ts
git commit -m "feat(admin): xuất danh sách booking và subscriber bằng Excel, gỡ đường CSV"
```

  (`git rm` ở Step 5 đã stage sáu file xoá.)

---

### Task 8: Nút "Export Excel" và quét chữ CSV còn sót

**Files:**
- Modify: `apps/admin/src/components/bookings/bookings-toolbar.tsx` (dòng ~26, ~122, ~153),
  `components/subscribers/subscribers-export-link.tsx` (~9, ~35), `components/kit/export-button.tsx`
  (~9, ~29), `components/reports/reports-toolbar.tsx` (~12), `components/kit/table-features.ts` (~13)
- Modify (spec): `components/bookings/bookings-export-link.spec.tsx` (~8, 28, 37),
  `bookings-selection.spec.tsx` (~55, 79, 114, 133), `components/subscribers/subscribers-export-link.spec.tsx`
  (~8, 26, 36), `subscribers-table.spec.tsx` (~39)
- Modify (comment, test name): `lib/export-pages.ts` (~4), `lib/export-pages.spec.ts` (~11),
  `lib/api/bookings.ts` (~54), `lib/api/bookings.spec.ts` (~8), `lib/bookings-query.ts` (~261),
  `lib/bookings-query.spec.ts` (~301), `lib/subscribers-query.ts` (~110), `lib/reports-query.spec.ts`
  (~93), `lib/reports-view.ts` (~8), `lib/reports-view.spec.ts` (~17)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (xoá `exportCsv` của hai `list`)

- [ ] **Step 1: Đổi test trước** — bốn spec component: mọi `t.exportCsv` → `t.exportExcel`; comment "Nút
  Export CSV" → "Nút Export Excel". Chạy
  `pnpm --filter @tourism/admin exec vitest run src/components/bookings src/components/subscribers --maxWorkers=2`,
  thấy ĐỎ (nút còn ghi "Export CSV").
- [ ] **Step 2: Đổi nhãn** — `bookings-toolbar.tsx:153`
  `const label = selected.length ? t.exportSelected(selected.length) : t.exportExcel;`;
  `subscribers-export-link.tsx:35` `label={t.exportExcel}`. JSDoc hai file và `export-button.tsx`:
  "Nút Export CSV"/"Nút tải CSV" → "Nút Export Excel"/"Nút tải Excel"; câu về nhãn ở
  `export-button.tsx:29` → `"Export Excel"` sang `"Export 12 rows"`. Chạy lại — XANH.
- [ ] **Step 3: Quét chữ CSV** — sửa các comment, tên ca test ở danh sách Files cho đúng (CSV → Excel,
  "file CSV" → "file Excel"; tên ca `reports-query.spec.ts` "trỏ route handler CSV của đúng tháng đang
  xem" → "trỏ route handler Excel của đúng tháng đang xem"). GIỮ nguyên các câu kể lịch sử: đoạn trích
  nguyên văn quyết định F6 trong `export-pages.ts` (~14–15), `reports-view.ts` (~16, ~81–82) và JSDoc
  "Đổi từ CSV sang `.xlsx` ở ADR-0034" của `reports/export/route.ts`.
- [ ] **Step 4: Xoá khoá** `admin.bookings.list.exportCsv` và `admin.subscribers.list.exportCsv`
  (`rg -n "exportCsv" apps libs` ra rỗng ngoài `messages.ts`); build lại i18n.
- [ ] **Step 5: Rà còn sót** — `rg -n -i "csv" apps/admin/src` chỉ còn đúng các câu lịch sử ở Step 3.
- [ ] **Step 6: Chạy** `pnpm --filter @tourism/admin exec vitest run --maxWorkers=2` — XANH; typecheck admin.
- [ ] **Step 7: Commit**

```bash
pnpm exec biome check --write apps/admin/src libs/shared/i18n/src/lib/messages.ts
git add apps/admin/src/components apps/admin/src/lib libs/shared/i18n/src/lib/messages.ts
git commit -m "feat(admin): nút xuất ghi Export Excel, dọn chữ CSV còn sót"
```

  (Trước khi `git add` thư mục, `git status --short` phải chỉ liệt kê đúng các file của task này.)

---

## Sau khi thi công — việc của session gốc

1. **Review max** cả nhánh (skill `code-review`), vá trọn trên nhánh.
2. **Gate đầy đủ:** `pnpm gate:int` (hãm tài nguyên theo memory "Hãm tài nguyên khi chạy việc nặng").
3. **Mở bằng Excel thật** (spec §9, cách đã dùng 10/10: PowerShell `-STA`, Excel COM, script ASCII):
   tải ba file từ admin dev (user đăng nhập pane), chụp Summary, Detail, danh sách booking, danh sách
   subscriber; so Summary với ảnh bản thảo D1. Kiểm trên máy vi-VN: ngày ra "Sep", không "Thg9"; số
   cộng được; thanh REPT hiện; hyperlink mở đúng trang đơn; in thử (Ctrl+P) thấy đầu, chân trang và
   "Page 1 of n".
4. **User duyệt bằng mắt** ba file trước merge (memory "Giao diện theo wireframe: user xác nhận bằng
   mắt").
5. **Ghép với Phần 1:** nhánh nào merge sau thì rebase lên `main` mới, gỡ xung đột (nếu có) ở
   `messages.ts` và entry CHANGELOG.
6. **Docs:** entry CHANGELOG; open-items G40 ghi Phần 3 xong; spec §11 đánh dấu Phần 3; ADR-0034 trạng
   thái "AMEND 3 đã thi công". Phần 2 (bản in C2) dùng lại `admin.reports.reportTitle`, `periodLine`,
   `waterfallHeading`, `cards.*Caption` — ghi vào plan Phần 2 khi viết.
7. Hỏi user trước khi merge và push; sau push canh ba đèn và thử tay production theo spec §10 bước 5–6.
