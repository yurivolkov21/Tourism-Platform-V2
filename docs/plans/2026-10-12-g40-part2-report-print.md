# G40 Phần 2 — Bản in báo cáo tháng C2 (admin) — Implementation Plan

> Thi công: chính thread cloud viết plan này (12/10), làm tuần tự từng task, TDD. Không có prompt
> thi công riêng — Yuri chốt 12/10 "thêm một thread mới để xử lí phần 2 luôn".

**Goal:** In `/reports` ra đúng một tờ A4 theo bản thảo C2 đã duyệt: đầu trang nội bộ, bốn ô số,
thác nước từ doanh thu tới lãi ròng cạnh bảng lãi lỗ kế toán, thanh 100% trạng thái booking, lưới
tám chỉ số vận hành, bảy chú giải, chân trang nội bộ — với dữ liệu thật của mọi tháng.

**Architecture:** Cùng khuôn Phần 1 (ADR-0057 §1): một component chỉ-in `ReportPrint` đặt cạnh nội
dung màn hình trong `(admin)/reports/page.tsx`, dựng trên khung `print-doc` của `@tourism/ui`. Mọi
con số, chữ và hình học (toạ độ SVG của thác nước, đoạn của thanh trạng thái) tính ở view-model
THUẦN `lib/report-print.ts`; component chỉ vẽ. Biểu đồ là SVG tĩnh, không thư viện.

**Tech Stack:** Next.js 16 (server component) · React 19 · Tailwind v4 (token qua `@theme inline`)
· Vitest 4 (project `node` cho `src/lib/**/*.spec.ts`, `dom` cho `src/components/**/*.spec.tsx`) ·
`@tourism/ui` print-doc · `@tourism/i18n` · Biome.

**Spec:** [docs/specs/2026-10-10-print-and-export-redesign-design.md](../specs/2026-10-10-print-and-export-redesign-design.md)
§2 (khung chung), §5 (báo cáo C2), §8 (chữ), §9 (kiểm thử), §10 bước 4 (thử tay production).
Quyết định: [ADR-0057](../adr/0057-print-documents.md). Bản thảo đã duyệt (bất biến, chỉ đọc):
[print-report.src.html](../design/mockups/print-report.src.html), phương án C2.

## Global Constraints

- **Phạm vi:** `apps/admin` và `libs/shared/i18n` (CHỈ khối `admin.*`). Không đổi API, contract,
  DB, `apps/web`, `apps/mobile`, `libs/shared/ui`, `libs/shared/tokens`. Không thêm dependency
  (freeze 15/10).
- **Phần 3 chạy song song** (nhánh `claude/g40-part3-excel-report-a7944d`, đang review trên máy
  Yuri) và sửa cùng `messages.ts`, cùng thư mục `apps/admin/src/lib`. Không format lại, không di
  chuyển khối nào ngoài chỗ cần thêm. Chi tiết ở §Phụ thuộc Phần 3.
- **Không chạm hạ tầng sống** (luật 15). Thread cloud này không chạm máy Yuri. Push CHỈ nhánh
  `claude/g40-part2-report-print`; merge vào `main` là deploy production (Render, Vercel) nên phải
  hỏi Yuri trước.
- **TDD** (luật 4) trên `lib/report-print.ts`: test trước, thấy ĐỎ đúng lý do, code tối thiểu,
  thấy XANH; mỗi ca mới thử đột biến một lần và ghi kết quả vào CHANGELOG lúc merge.
- **Comment tiếng Việt** (luật 8); chữ người dùng thấy — kể cả `aria-label` của SVG và nhãn hai
  dòng dưới trục thác nước — tiếng Anh trong `@tourism/i18n` (luật 7).
- **Tokens-only** (luật 6): không hex, không `rgb()` trong TSX. Màu SVG bằng class Tailwind
  (`fill-chart-gain`, `stroke-border`…). Ngoại lệ có sẵn của `globals.css` admin giữ nguyên.
- **Không class `dark:` nào trong cây in** (ADR-0057 §5, có test canh như web).
- **`@tourism/i18n` đọc từ `dist`:** sửa xong build lại trước khi test admin.
- **Biome** là formatter, linter duy nhất (`pnpm exec biome check --write <file…>`); không
  `--no-verify`; stage bằng đường dẫn tường minh (có ngoặc thì đặt trong nháy kép). Môi trường
  cloud có hook ngoài repo chạy Prettier sau mỗi lần công cụ Write/Edit ghi file: ghi file bằng
  shell, và luôn `biome check --write` trước khi stage.
- **Commit Conventional, tiếng Việt có dấu, KHÔNG dòng `Co-Authored-By` hay attribution AI**
  (luật 12, thắng mọi mặc định của công cụ).
- **Không sửa** `docs/design/mockups/*`, entry CHANGELOG cũ; không dòng `.md` nào bắt đầu bằng `+`;
  `git diff` file `.md` trước khi stage.
- **Không merge, không commit** gì từ `origin/backup/g40-tam-dung-2026-10-10` (ghi chú bàn giao,
  công cụ tạm, file agent) — chỉ đọc bằng `git show`.
- **Next.js 16** (`apps/admin/AGENTS.md`): đọc doc liên quan trong
  `apps/admin/node_modules/next/dist/docs/` trước khi sửa page.

## Điều kiện bắt đầu

1. Nhánh `claude/g40-part2-report-print` tách từ `main` ở `ae727bc` (sau Phần 1 và bản thử tay
   production của nó). Phần 3 chưa merge.
2. Môi trường cloud do `.claude/hooks/session-start.sh` dựng (Node 24, pnpm 11.9.0, `.env.local`,
   Postgres 17). Docker Hub trả 429 thì kéo `mirror.gcr.io/library/postgres:17-alpine`, gắn tag
   `postgres:17-alpine`, rồi `docker compose up -d postgres`.
3. Build gói admin đọc từ dist:
   `pnpm turbo run build --filter="@tourism/admin^..." --output-logs=errors-only`.

## Lệnh hay dùng

```bash
pnpm --filter @tourism/admin exec vitest run <file…> --maxWorkers=2
pnpm --filter @tourism/i18n exec vitest run src/lib/messages.spec.ts
pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only
pnpm --filter @tourism/admin typecheck
pnpm exec biome check --write <file…>
```

## Phụ thuộc Phần 3

Phần 2 dùng chữ mà Phần 3 thêm vào `messages.ts`. Để hai nhánh không chờ nhau, nhánh này chép
NGUYÊN VĂN (cùng chữ, cùng comment, cùng vị trí) ba khối thêm của commit `f9caca0` trên nhánh Phần 3:

| Khoá | Chữ | Dùng ở bản in |
| --- | --- | --- |
| `admin.reports.reportTitle(month)` | `Monthly report — {month}` | Tiêu đề tờ |
| `admin.reports.periodLine(period, currency, rate)` | `{period} · all amounts in {currency} · tax on margin {rate}` | Dòng kỳ |
| `admin.reports.waterfallHeading` | `From revenue to net profit` | Tên khối thác nước |
| `admin.reports.cards.recognizedCaption` | `Trips that finished this month` | Dòng phụ ô 1 |
| `admin.reports.cards.netCaption` | `After tax and payment fees` | Dòng phụ ô 3 |
| `admin.reports.cards.paidCaption(count)` | `{n} paid booking(s)` | Dòng phụ ô 4 |
| `admin.exportFile.backOffice` | `Nexora back office` | Chân trang, chữ đậm |
| `admin.exportFile.internal` | `Internal — not for distribution` | Chân trang |

Khối `admin.exportFile` chép đủ sáu khoá (cả bốn khoá bản in không dùng) để hunk của hai nhánh
giống hệt nhau: git ghép hai thay đổi giống hệt nhau không xung đột, nhánh nào merge trước cũng
được. Khi Phần 3 merge (session gốc báo): rebase nhánh này lên `main`; nếu review Phần 3 đã đổi
chữ hay comment của các khoá trên thì lấy bản của `main`, chạy lại test bản in, và đối chiếu bảng
trên với `main` một lần nữa trước khi merge.

## Quyết định của plan

1. **Tên namespace là `admin.reports.printDoc`**, không phải `admin.reports.print` như spec §8:
   khoá `print` đã là nhãn nút "Print" của thanh công cụ. Đổi tên nút là churn không ai được lợi;
   `printDoc` song song với namespace `printDoc` chung của Phần 1. Khoá mới:
   `contact(website)` → `Back office · {website}` (spec §2.2), `docRef(month)` →
   `Monthly report {YYYY-MM}` (chân trang), `waterfall` — bảy nhãn hai dòng dưới trục (bộ đôi chữ,
   tách sẵn theo bản thảo: "Revenue / recognised", "Cost per / traveller", "Cost per / departure",
   "Gross / profit", "Tax on / margin", "Payment / fees", "Net / profit"), `waterfallLabel(month)`
   → `Profit and loss waterfall, {Month YYYY}` (`aria-label` của SVG), `noFigures` →
   `No figures for this month yet.` (spec §5.2). Mọi chữ khác dùng lại khoá sẵn có:
   `admin.reports.title` (loại tài liệu), `generatedAt`, `cards.*`, `pnlTable.*`,
   `bookingsTable.*`, `operationsTable.*`, `definitions.*`, `admin.bookings.status.*`,
   `printDoc.website`, `printDoc.printedPrefix`.
2. **Tờ in dùng bảng màu trung tính của admin**, không phải của web: thêm
   `[data-admin-surface] [data-print-doc]` vào selector của bề mặt admin trong `globals.css`
   (specificity 0,2,0 thắng `.light` 0,1,0 mà `DocPage` gắn). Mực của bản thảo C2 chính là token
   admin (`#1f252b` = `foreground`, `#5f646b` = `muted-foreground`, `#dcdfe2` = `border`) và file
   Excel Phần 3 dẫn xuất màu từ cùng các token ấy — giấy và file đọc cùng một bộ màu.
3. **Khối `@media print` chung của admin chỉ áp khi trang KHÔNG có tài liệu in:** mọi quy tắc trong
   khối (trừ biến `:root` và `@page`) mang tiền tố `:root:not(:has([data-print-doc]))`. Không thì
   `!important` của nó tô đen chữ phụ, nét bảng của tờ báo cáo (ghi chú bàn giao Phần 2). Trang
   admin khác in như cũ (ADR-0057 §Hệ quả). Một test node đọc CSS canh luật này.
4. **Bảng lãi lỗ cạnh thác nước** dùng lại `toReportPnlRows` (khoá, nhãn có thuế suất, thụt, đậm)
   nhưng số in theo lối kế toán của bản thảo: không ký hiệu tiền (dòng kỳ đã nói đơn vị), hai số
   lẻ, số âm trong ngoặc; năm dòng chi phí in âm, `(25,737.54)`; lãi gộp, lãi ròng âm thì trong
   ngoặc. Dòng cộng gạch trên 0.6 pt; lãi ròng gạch kép dưới. Dòng chú thích dùng
   `pnlTable.departuresRun`. Chuỗi số lấy từ `Intl.NumberFormat` trên CHÍNH chuỗi thập phân của
   API (không qua float).
5. **Thác nước — hình học thuần, viewBox 480 × 236** (khung bản thảo: trên 20, dưới 42, trái và
   phải 6), cộng ba luật bản thảo chưa có vì nó chỉ vẽ một tháng lãi:
   - Miền `[lo, hi]` = `[min(0, mọi mức), max(0, mọi mức)]` — tháng lỗ có cột dưới trục 0.
   - **Chừa chỗ cho nhãn dưới:** nhãn nằm dưới một điểm (cột trừ, cột tổng âm) phải ở trên hàng
     nhãn hạng mục. Tỉ lệ `s = min(174 / (hi − lo), 167 / (hi − p))` với `p` là điểm thấp nhất có
     nhãn bên dưới — đóng dạng, không vòng lặp.
   - **Lề phải 30 đơn vị cho nhãn trục** (bản thảo đặt nhãn trục ở mép phải, đè lên dải của cột
     cuối khi lãi ròng gần một vạch lưới).
   - Dải `band = (480 − 6 − 6 − 30) / 7`, cột rộng `min(46, band × 0.62)`; cột tổng từ 0, cột trừ
     từ mức đang chạy; đầu dữ liệu bo `min(4, h/2)` (cột tổng dương bo trên, âm bo dưới, cột trừ
     bo dưới), chân vuông; cao tối thiểu 1.5; nối bậc bằng nét chấm ở mức đang chạy.
   - Vạch lưới: bước "đẹp" `{1, 2, 2.5, 5} × 10^k`, chọn bước cho số vạch (kể cả 0) gần 3 nhất,
     hoà thì bước nhỏ hơn; vạch nằm trong `[lo × 1.02, hi × 1.02]` (bản thảo: 0, 20k, 40k với đỉnh
     39.6k). Vạch 0 đậm màu mực.
   - Nhãn giá trị: cột tổng dương ở trên (`y − 5`), cột tổng âm và cột trừ ở dưới (`y + 11`). Chữ
     ngắn: làm tròn đồng trước; dưới 1,000 → `$992`; tới dưới 999,950 → `$39.6k`; từ đó → `$1.2M`;
     âm thêm `−` (U+2212); 0 → `$0`. Nhãn trục bỏ `.0`: `$0`, `$20k`, `$2.5k`. Ký hiệu tiền lấy từ
     `Intl` theo `currency`; mã lạ thì in mã.
   - Màu: cột tổng dương `chart-gain`; cột trừ và cột tổng âm `chart-cost` kèm vân 45° (mọi fill
     `chart-cost` mang vân — in trắng đen vẫn tách, spec §2.4).
   - Cả bảy giá trị bằng 0 (tháng chưa bắt đầu hay chưa có chuyến kết thúc) → không vẽ, in
     `noFigures`; bảng lãi lỗ vẫn in số 0 (spec §5.2).
6. **Thanh trạng thái đủ năm trạng thái**, thứ tự PAID · PARTIALLY_REFUNDED · PENDING · REFUNDED ·
   CANCELLED, màu `chart-gain` · `chart-3` · `pending` · `info` kèm vân 135° · `chart-cost` kèm vân
   45°. Đã chạy `validate_palette.js` của skill dataviz (light, trên `card`): tách màu khi mù màu
   xấu nhất 15.0, mắt thường 20.1, tương phản ≥ 3:1 — ALL PASS. Bản thảo chỉ có Paid và Cancelled;
   ba trạng thái còn lại là chỗ ghi chú bàn giao dặn plan chốt.
   - Viewbox 600 × 16 giãn ngang (`preserveAspectRatio="none"`), khe 2 giữa hai đoạn, bo 3.
   - Chỉ vẽ và chú thích trạng thái có số khác 0 (bảng màn hình vẫn đủ năm hàng); % làm tròn số
     nguyên, khác 0 mà tròn ra 0 thì in `<1%`; cuối hàng chú thích "Total {n}".
   - Không booking nào → câu `bookingsTable.empty` thay cho thanh.
7. **Bốn ô số theo spec §5.1:** Revenue recognised (nền `paper`, dòng phụ `recognizedCaption`) ·
   Gross profit (`marginCaption`) · Net profit (`netCaption`) · Cash collected (`paidCaption`). Tiền
   qua `formatAmount` như màn hình. Chuỗi dài hơn 12 ký tự (từ `$1,000,000.00`) hạ cỡ 15 pt → 12 pt
   để không tràn ô (đo lại ở ma trận).
8. **Bảy chú giải theo thứ tự sheet Definitions của file Excel** (Phần 3): revenue, recognised,
   costs, netProfit, refunds, statuses, cancellations — giấy và file đọc cùng một thứ tự. Đánh số
   bằng phần tử thật (không dùng CSS counter), hai cột, 7.2 pt.
9. **Cảnh báo thiếu giá vốn** (`costWarning`) là một đoạn rộng hết khổ ngay dưới hàng biểu đồ,
   cùng màu `destructive-emphasis` của màn hình.
10. **Đầu trang:** `ReportPrintBrand` của admin — `LOGO_MARK` rộng 11 mm (viên sau `primary`, viên
    trước `foreground`), wordmark "Nex**ora**" 17 pt ("ora" `primary-emphasis`), dòng
    `printDoc.contact`; `DocLetterhead` tông `paper`: loại `admin.reports.title`, số `YYYY-MM`, mốc
    `generatedAt(formatDateTime(…))` ("Generated 10 Oct 2026, 02:30 UTC"); gạch mực 0.8 pt dưới.
11. **Chân trang:** trái **Nexora back office** · Monthly report 2026-09 · Internal — not for
    distribution; phải `PrintedAt` giờ Việt Nam. Không "Page x of y" (ADR-0057 §2).
12. **Thẻ tiêu đề:** tiêu đề tờ là `h2` (vỏ admin đã có `h1` ở topbar), tên khối `h3` với
    `PRINT_SECTION`. SVG thác nước `role="img"` + `aria-label`; bảng lãi lỗ bên cạnh là bản "table
    view" của nó. Thanh trạng thái `aria-hidden`, chú thích là chữ thật.
13. **Một trang:** ngân sách dọc của bản thảo chỉ còn ~13 mm (đo bản thảo bằng font thật), mà chú
    giải thật dài hơn bản thảo ~7 mm, cảnh báo giá vốn và chú thích năm trạng thái có thể thêm một
    hai dòng. Nếu ma trận đo có ca tràn thì thêm cờ `dense` tính ở view-model (điều kiện và số đo
    chốt khi đo) để siết khoảng cách dọc — không cắt chữ, không hạ cỡ chữ thân.
14. **Trang màn hình:** bọc toàn bộ nội dung màn hình trong `<div className="contents print:hidden">`
    (luật cô lập của `@tourism/ui` là lưới, ADR-0057 §1); gỡ class in đã chết ở `report-tables.tsx`
    (`print:grid-cols-2`, `print:col-span-2`); sửa comment "Trang này được thiết kế để IN" của
    `page.tsx` và đầu khối in của `globals.css` cho đúng hiện trạng.

## Bản đồ file

| File | Việc |
| --- | --- |
| `libs/shared/i18n/src/lib/messages.ts` | Chép khoá Phần 3; thêm `admin.reports.printDoc` |
| `libs/shared/i18n/src/lib/messages.spec.ts` | Ca cho `printDoc` của báo cáo |
| `apps/admin/src/lib/report-print.ts` (mới) | Định dạng tiền ngắn và kế toán, vạch lưới, hình học thác nước, thanh trạng thái, `reportPrintView` |
| `apps/admin/src/lib/report-print.spec.ts` (mới) | Unit, TDD |
| `apps/admin/src/components/reports/report-print-brand.tsx` (mới) | Logo, wordmark, dòng liên hệ nội bộ |
| `apps/admin/src/components/reports/waterfall.tsx` (mới) | SVG thác nước từ hình học |
| `apps/admin/src/components/reports/status-bar.tsx` (mới) | SVG thanh 100% và chú thích |
| `apps/admin/src/components/reports/report-print.tsx` (mới) | Tờ C2 trên `DocPage` |
| `apps/admin/src/components/reports/report-print.spec.tsx` (mới) | Cấu trúc tờ in |
| `apps/admin/src/app/(admin)/reports/page.tsx` | Bọc màn hình `print:hidden`, thêm `ReportPrint` |
| `apps/admin/src/components/reports/report-tables.tsx` | Gỡ class in đã chết, sửa comment |
| `apps/admin/src/app/globals.css` | Bảng màu admin cho tờ in; khoanh khối in chung |
| `apps/admin/src/lib/admin-print-css.spec.ts` (mới) | Canh hai luật CSS trên |

## Giao diện dùng chung

```ts
// apps/admin/src/lib/report-print.ts
export type WaterfallKey =
  | 'recognizedRevenue' | 'cogsVariable' | 'cogsFixed' | 'grossProfit'
  | 'taxAmount' | 'paymentFees' | 'netProfit';

export interface WaterfallBar {
  key: WaterfallKey;
  kind: 'total' | 'down';
  tone: 'gain' | 'cost';
  path: string;                       // `d` của path, đầu dữ liệu bo, chân vuông
  label: { x: number; y: number; text: string };
  category: { x: number; lines: readonly [string, string] };
}
export interface WaterfallView {
  width: 480; height: 236;
  bars: readonly WaterfallBar[];
  connectors: readonly { x1: number; x2: number; y: number }[];
  grid: readonly { y: number; label: string; base: boolean }[];
  categoryY: readonly [number, number];
  label: string;                       // aria-label
}
export interface StatusBarView {
  segments: readonly { status: BookingStatus; x: number; width: number; tone: StatusTone }[];
  legend: readonly { status: BookingStatus; tone: StatusTone; label: string; count: string; share: string }[];
  total: string;
}
export interface ReportPrintView {
  docNumber: string;  meta: string;  title: string;  periodLine: string;
  tiles: readonly { key: string; label: string; value: string; caption: string; hero: boolean; long: boolean }[];
  waterfall: WaterfallView | null;
  pnl: readonly { key: string; label: string; value: string; indent: boolean; rule: 'none' | 'sub' | 'net' }[];
  departuresNote: string;
  costWarning: string | null;
  statusBar: StatusBarView | null;     // null → `bookingsTable.empty`
  ops: readonly { key: string; label: string; value: string }[];
  definitions: readonly string[];
  footerRef: string;
}
export function reportPrintView(report: AdminMonthlyReport): ReportPrintView;
```

## Tasks

### Task 1 — Chữ (i18n)

- [ ] Chép ba khối của Phần 3 (§Phụ thuộc Phần 3) đúng vị trí.
- [ ] Thêm `admin.reports.printDoc` (quyết định 1) ngay sau khối `definitions`.
- [ ] Ca test: bảy nhãn thác nước đủ hai dòng có chữ; `contact`, `docRef`, `waterfallLabel` ghép
  đúng chữ.
- [ ] Build `@tourism/i18n`; commit `feat(i18n): chữ của bản in báo cáo tháng C2 …`.

### Task 2 — Định dạng tiền của bản in (TDD)

- [ ] `shortMoney`: `$992`, `$39.6k`, `−$25.7k`, `$0`, `$1.2M`, biên 999.5 → `$1.0k`,
  999,950 → `$1.0M`, mã tiền lạ.
- [ ] `axisMoney`: `$0`, `$20k`, `$2.5k`, `−$10k`, `$500`.
- [ ] `accountingAmount`: `39,607.80`, `(25,737.54)`, `0.00`, chuỗi âm từ API.

### Task 3 — Vạch lưới và hình học thác nước (TDD)

- [ ] `niceTicks(lo, hi)`: số liệu bản thảo ra 0, 20k, 40k; tháng lỗ có vạch âm; hoà chọn bước nhỏ.
- [ ] `waterfallView(report)`: bảy cột đúng thứ tự, loại, tông; đỉnh cột tổng dương và đáy cột
  trừ khớp tỉ lệ; nối bậc ở mức đang chạy; tháng lỗ — cột tổng âm dưới trục, tông `cost`, nhãn có
  `−`; nhãn dưới không chạm hàng hạng mục (mọi nhãn dưới có `y ≤ 198`); mọi cột nằm trái lề phải
  30; cột 0 cao 1.5; cả bảy giá trị 0 → `null`.

### Task 4 — Thanh trạng thái (TDD)

- [ ] Thứ tự và tông năm trạng thái; bỏ trạng thái 0; tổng chiều rộng cộng khe bằng 600; `<1%`;
  tổng 0 → `null`.

### Task 5 — `reportPrintView` (TDD)

- [ ] Số tài liệu, mốc, tiêu đề, dòng kỳ (tháng đang chạy có "(to date)", tháng chưa bắt đầu).
- [ ] Bốn ô số (thứ tự, ô đầu `hero`, dòng phụ, `long`), biên gộp không xác định in `—`.
- [ ] Bảng lãi lỗ kế toán (dấu, gạch), dòng chú thích, cảnh báo giá vốn, tám chỉ số, bảy chú giải
  theo thứ tự Excel, chân trang.

### Task 6 — Component tờ in

- [ ] `ReportPrintBrand`, `Waterfall`, `StatusBar`, `ReportPrint`.
- [ ] Ca DOM: `data-print-doc`, `hidden` + `print:flex`; không class `dark:`; `h2` tiêu đề, `h3`
  sáu khối; SVG `role="img"` + `aria-label`; vân 45° và 135° có `pattern` riêng id; `noFigures`
  khi không có số; câu trống khi không booking; cảnh báo chỉ hiện khi có.

### Task 7 — Nối trang và CSS

- [ ] `page.tsx`: bọc màn hình, thêm `<ReportPrint view={reportPrintView(report)} />`, sửa comment.
- [ ] `globals.css`: selector bảng màu admin cho tờ in; tiền tố cho khối in chung; sửa comment.
- [ ] `admin-print-css.spec.ts`: mọi quy tắc trong `@media print` (trừ `:root`, `@page`) có tiền
  tố; selector bề mặt có `[data-admin-surface] [data-print-doc]`.
- [ ] `report-tables.tsx`: gỡ `print:grid-cols-2`, `print:col-span-2`, sửa comment.

### Task 8 — Đo bố cục (§Đo bố cục), chỉnh, chụp ảnh cho Yuri duyệt

### Task 9 — Review max, `pnpm gate:int`, push nhánh, báo Yuri

## Đo bố cục

Chromium headless của môi trường cloud qua CDP (`Page.printToPDF` với `preferCSSPageSize`, đếm
`/Type /Page`), cùng cách đo của Phần 1. Admin local (`next build && next start`) trỏ API local có
dữ liệu seed; đăng nhập bằng phiên tạo trực tiếp cho admin seed trong một script tạm. Ma trận:

1. **Dữ liệu thật:** `/reports?month=` mọi tháng seed từ 2026-01 tới tháng hiện tại (gồm tháng đang
   chạy có "(to date)").
2. **Fixture** qua một route tạm `apps/admin/src/app/zz-print/` (KHÔNG commit, ghi vào
   `.git/info/exclude`): tháng lỗ (lãi gộp và lãi ròng âm); tháng chưa có số; cả hai cảnh báo giá
   vốn cùng năm trạng thái khác 0; số dài (hàng triệu đô) ở mọi ô.
3. **Phần tử lạ sau tờ** (giả lập tiện ích trình duyệt, bài học thử tay Phần 1): vẫn một trang.

Mỗi ca kiểm: đúng một trang PDF; tờ không tràn (`scrollHeight ≤ clientHeight`); chân trang nằm
trong tờ; không nhãn nào của SVG chồng nhau (hộp `getBBox` của nhãn giá trị, nhãn trục, nhãn hạng
mục rời nhau); màu tính được của chữ phụ, nét bảng trong tờ KHÔNG phải đen (khối in chung không lọt
vào). Ảnh chụp tháng 9, tháng lỗ và ca nặng nhất đặt cạnh bản thảo C2 gửi Yuri duyệt bằng mắt
(spec §9).

## Sau khi thi công

1. Review max (skill code-review), sửa hết phát hiện còn hiệu lực.
2. `pnpm gate:int` xanh theo công thức cloud (Postgres docker, API sống cho build web).
3. Push nhánh `claude/g40-part2-report-print`; báo Yuri: link plan, các mặc định đã chọn, ảnh để
   duyệt; hỏi trước khi merge.
4. Khi Yuri đồng ý merge: chờ Phần 3 merge trước nếu nó sắp xong (hoặc merge trước, hunk chữ giống
   hệt nên không xung đột); fetch `main`, rebase, chạy lại test admin và i18n, `git merge --ff-only`;
   docs sweep cùng đợt: entry CHANGELOG (số test, kết quả đột biến, phát hiện review), spec §11
   Phần 2 "Xong", `docs/open-items.md` mục G40; liếc đèn CI (`gh run list --branch main --limit 1`).
5. Thử tay production spec §10 bước 4: in `/reports` tháng 9 và tháng hiện tại.
