# G40 Phần 1 — Bản in voucher và hoá đơn chờ ở web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In voucher (`/checkout/success`, đơn đã trả) ra tờ A4 theo bản thảo 5b và in hoá đơn
chờ (đơn chưa trả, `/checkout/success` và `/checkout/cancel`) ra tờ A4 theo B1 — đúng một trang,
không còn ngày giờ và URL của trình duyệt, in từ giao diện tối vẫn ra giấy sáng.

**Architecture:** Mỗi trang render thêm một tài liệu chỉ-in (`hidden print:flex`, `data-print-doc`)
cạnh nội dung màn hình (bọc `print:hidden`), cùng view-model với màn hình (ADR-0057 §1). Khung chung
(tờ A4, đầu trang, chân trang, giờ in, mộc) ở `@tourism/ui/components/print-doc/*`, chữ truyền qua
props; trang in tên `doc` lề 0 khai ở CSS chung của ui. Logic thuần (helper vé, `voucherPrintView`,
`receiptPrintView`) ở `apps/web/src/lib/print/`, component ở `apps/web/src/components/print/`. Giấy
luôn sáng nhờ phạm vi màu `.light` mới do bộ build token sinh ra; bìa ảnh dùng scope `dark` sẵn có
của repo cho chữ và logo trên nền tối.

**Tech Stack:** Next.js 16 (App Router, Server Components) · React 19 · Tailwind 4.3 · Vitest 4 +
Testing Library (jsdom ở web; node ở ui, dựng HTML bằng `renderToStaticMarkup`) · `@tourism/i18n` ·
`@tourism/tokens` (style-dictionary) · Biome.

**Spec:** [docs/specs/2026-10-10-print-and-export-redesign-design.md](../specs/2026-10-10-print-and-export-redesign-design.md)
§2 (khung chung), §3 (voucher 5b), §4 (hoá đơn chờ B1), §8 (chữ, token), §9 (kiểm thử) — HỢP ĐỒNG
của việc này. Kiến trúc: [ADR-0057](../adr/0057-print-documents.md). Bản vẽ đã duyệt (bất biến, chỉ
đọc): [print-voucher.src.html](../design/mockups/print-voucher.src.html) — khối `data-opt="5b"`
(CSS `.ticket`, `.t-*`, `.mag`, `.p5`, `.p5b`); [print-receipt.src.html](../design/mockups/print-receipt.src.html)
— khối `data-opt="B1"` (CSS `.rb`, `.void`, `.inv`). Mọi kích thước mm, pt trong plan chép từ hai
file ấy.

## Global Constraints

- **Phạm vi Phần 1:** chỉ `apps/web`, `libs/shared/ui`, `libs/shared/tokens`, `libs/shared/i18n`.
  Không đổi API, contract, DB, `apps/admin`, `apps/mobile`. Báo cáo in và Excel là Phần 2, 3.
- **Không thêm dependency** (freeze 15/10). In là CSS; mã vạch dùng `TicketBarcode` sẵn có.
- **Không chạm hạ tầng sống** (luật 15): không deploy, không Supabase, Render, Vercel, Cloudinary,
  webhook hay env. Không push, không merge — session gốc làm sau review.
- **TDD** (luật 4): test trước, thấy ĐỎ đúng lý do ghi ở bước, code tối thiểu, thấy XANH. Mỗi ca test
  mới **thử đột biến** một lần (sửa mã cho sai, thấy ca đỏ, trả lại) và ghi kết quả vào báo cáo task.
  Trả đột biến bằng tay (Edit), không bằng `git checkout`/`git restore` khi còn thay đổi chưa commit.
- **Comment tiếng Việt** (luật 8) cho cả `//` lẫn JSDoc; identifier tiếng Anh. Comment không khai
  trạng thái tương lai ("task sau sẽ…").
- **Chữ khách thấy: tiếng Anh, trong `@tourism/i18n`** (luật 7). `@tourism/ui` không phụ thuộc i18n —
  chữ vào ui qua props. Ngoại lệ có sẵn của repo: wordmark "Nex" + "ora" viết thẳng như `Logo`.
- **Tokens-only, không hex** (luật 6): màu qua class token (`bg-primary`, `text-pending`,
  `border-muted-foreground/60`, `fill-on-media`…) hay `var(--token)` trong giá trị tuỳ ý. Kích thước
  in dùng giá trị tuỳ ý theo mm/pt (`w-[210mm]`, `text-[9.5pt]`) — đó là kích thước, không phải màu.
- **Không dùng biến thể `dark:` trong tài liệu in**: tài liệu nằm dưới `<html class="dark">` khi
  khách đang ở giao diện tối, `dark:` vẫn bắt. Class `dark` (scope, không phải biến thể) chỉ dùng
  đúng một chỗ có chủ đích: đầu trang trên bìa ảnh (quyết định 3).
- **IBM Plex Mono chỉ nạp 400 và 500** (`apps/web/src/app/layout.tsx`): chữ mono dùng `font-medium`,
  không `font-semibold` (bản thảo ghi 600 — sẽ ra đậm giả).
- **Biome là formatter và linter DUY NHẤT**: `pnpm exec biome check --write <file của task>` trước khi
  stage; không Prettier, ESLint; không `--no-verify`.
- **Commit Conventional, tiếng Việt CÓ DẤU, KHÔNG dòng `Co-Authored-By` hay attribution AI** (luật 12).
  Stage bằng đường dẫn tường minh (đường dẫn có ngoặc thì đặt trong nháy kép), không `git add -A`.
- **Gói đọc từ `dist`:** `@tourism/i18n`, `@tourism/contract`, `@tourism/tokens` — sửa xong phải build
  lại gói trước khi chạy test hay typecheck của web (lệnh ở "Lệnh hay dùng").
- **Hãm tài nguyên:** vitest web `--maxWorkers=2`; KHÔNG chạy `pnpm gate`/`pnpm gate:int` trong task —
  session gốc chạy một lượt đầy đủ sau thi công.
- **Next.js 16 khác dữ liệu huấn luyện** (`apps/web/AGENTS.md`): trước khi dùng API của Next, đọc doc
  tương ứng trong `apps/web/node_modules/next/dist/docs/`. Component client chỉ nhận props tuần tự hoá
  được (không truyền hàm từ Server Component).
- **Một `h1` mỗi trang:** `ContentHero` giữ `h1`; tên tour trong tài liệu in là `h2`, mục con `h3`.
- **Test khớp chữ chính xác** (không `/…/i`); chữ đến từ i18n thì so bằng chính khoá i18n.
- **Tài liệu:** không sửa `docs/design/mockups/*.src.html`; không dòng `.md` nào bắt đầu bằng `+`.

---

## Điều kiện bắt đầu

1. Worktree `.claude/worktrees/print-web`, nhánh `feat/print-web` — session gốc tạo sẵn từ `main`
   (ở commit [prompt thi công](2026-10-10-g40-part1-web-print-prompt.md)); session thi công mở
   ngay tại đó, không tạo worktree mới.
2. Chép `apps/web/.env.local` và `apps/api/.env.local` từ checkout gốc vào worktree (memory
   "Worktree agent thiếu .env.local"); không đọc `.env.production`.
3. `pnpm install --frozen-lockfile`, rồi build các gói web đọc từ dist:
   `pnpm turbo run build --filter="@tourism/web^..." --concurrency=1 --output-logs=errors-only`.
4. Chạy thử một spec web để chắc môi trường xanh:
   `pnpm --filter @tourism/web exec vitest run src/lib/voucher.spec.ts --maxWorkers=2`.

## Lệnh hay dùng

```bash
pnpm --filter @tourism/web exec vitest run <file…> --maxWorkers=2
pnpm --filter @tourism/ui exec vitest run <file…>
pnpm --filter @tourism/tokens exec vitest run src/lib/tokens.spec.ts
pnpm --filter @tourism/i18n exec vitest run src/lib/messages.spec.ts
pnpm turbo run build --filter=@tourism/tokens --output-logs=errors-only
pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only
pnpm --filter @tourism/web typecheck
pnpm --filter @tourism/ui typecheck
pnpm exec biome check --write <file…>
```

## Quyết định của plan

Ghi sẵn để người thi công không phải đoán; spec là hợp đồng, đây là cách đọc nó.

1. **Nền dải cuối là token `paper`** (`oklch(0.965 0.008 174)` ≈ `#eef5f3` của bản thảo).
2. **Phạm vi `.light`:** bộ build token sinh thêm khối `.light { …giá trị sáng của mọi màu… }` sau
   khối `.dark`. `DocPage` mang class `light` và `scheme-light`. Đây là cách duy nhất để một phần tử
   dưới `<html class="dark">` lấy lại màu sáng mà không chép tay hàng chục biến. ADR-0057 §5 đã ghi
   (bổ sung cùng commit với plan này).
3. **Bìa ảnh dùng scope `dark` sẵn có** — cùng lối hero trang About, hero bài viết, màn đăng nhập
   (`className="dark …"`). `DocLetterhead` tông `photo` tự gắn `dark`: trong scope ấy
   `primary-emphasis` là teal nhạt (`oklch(0.76 0.076 181.3)`) — đúng "viên sau teal nhạt", chữ
   "ora" và loại tài liệu teal nhạt của bản thảo (spec §2.2) mà không thêm token nào ngoài bốn token
   của ADR. Chữ còn lại trên bìa là `on-media`.
4. **Bốn token mới có dark = light** (giấy luôn sáng, theo lối `on-media`): `chart-gain`, `chart-cost`,
   `pending`, `pending-soft` (giá trị ở ADR-0057 §5). `chart-*` cho Phần 2; `pending-soft` chưa có
   chỗ dùng ở B1 — ADR khai thì thêm cả bốn.
5. **Mộc in đổi tông** (`stampTone`): `success` → `confirmed` (teal `primary`, KHÔNG `success` — G32:
   xanh lá 2,8:1), `warning` → `pending`, `muted`/`destructive` → `muted`. Mộc chờ nghiêng −2°, mộc
   khác +3° (bản thảo B1, 5b).
6. **`PrintedAt` nhận `prefix` và `timeZone` (chuỗi)**, không nhận hàm. Giờ định dạng bằng
   `@tourism/ui/lib/print-time` (en-US cho tên tháng: luôn "Sep", không "Sept" như en-GB của ICU mới).
7. **Không "Page x of y"** trong tài liệu HTML (ADR-0057 §2) — bản thảo có, khi dựng thì bỏ.
8. **`DocPage` là `print:flex` cột dọc** (chân trang `mt-auto` dính đáy) — ADR-0057 §1 sửa
   `print:block` thành `print:flex` cùng commit với plan này.
9. **In thì `body` thành khối thường** (`display: block`): `body` của web là `flex flex-col`, mà trang
   in tên (`page: doc`) chắc ăn nhất khi tài liệu nằm trong luồng khối — đừng gỡ dòng ấy.
10. **`voucherMeetingPoint` đổi thành `voucherTourData`** (trả `BookingTourData`, cùng luật chỉ đọc tour
    khi `showMeetingPoint`): bản in cần lịch trình và mục bao gồm; ô Meeting point của màn hình lấy
    bằng `tourMeetingPoint(tour)`. Không thêm vòng API.
11. **Kicker bìa luôn là ngày đi có thứ** — "{nơi} · {N} day(s) · {Ddd D Mon YYYY}" (spec §3.1), kể cả
    chuyến nhiều ngày; khoảng ngày đã có ở tấm vé.
12. **Giờ hẹn** = giờ của mục đầu ngày 1 theo `parseItineraryStops` — cùng bộ tách với cột giờ của
    lịch trình (dòng phải theo khuôn `HH:MM — …`).
13. **Tên tour trên bìa**: voucher 27 pt, dài hơn `LONG_TITLE_CHARS` (56 ký tự) thì 22 pt; hoá đơn chờ
    luôn 22 pt (B1); cả hai cắt ở hai dòng (`line-clamp-2`). Ngưỡng 56 ước theo khổ chữ — ma trận đo
    của session gốc có ca tên dài để kiểm.
14. **Mã đơn**: dải vé luôn in mã (như vé trang chi tiết đơn); dưới mã vạch chỉ in khi có mã vạch.
15. **Voucher đã huỷ** dùng tông vé `closed` (viền đứt xám, cuống gạch chéo — cùng hình vé "hết hiệu
    lực" của hoá đơn đã đóng) và thân vé là dải `cancelledNotice`.
16. **Included / Not included tối đa 6 dòng mỗi cột**: hơn thì 5 mục và "+n more" (cùng lối 7 + 1 của
    lịch trình). Cột trống thì bỏ cột.
17. **Cột dải cuối chỉ có khi có dữ liệu**: Cancellation bỏ khi `cancellationDeadlineText` là `null`;
    Refund bỏ khi không có câu hoàn. Dải voucher ba cột `1.15fr 1fr 1fr` (5b); dải hoá đơn ba cột đều
    (B1).
18. **Hoá đơn chờ "đã đóng"** = trạng thái khác `PENDING`, hoặc giai đoạn `lapsed`. Đơn PENDING quá
    65 phút mà cron chưa quét vẫn in "đang chờ" — cùng cách màn hình (`checkoutMood`, câu `expiresIn`
    của trang huỷ) không khai đơn đã đóng khi API còn nhận trả. "What happened": `lapsed` →
    `bookingDetail.closed.notPaidByDeadline`; còn lại → `accountBookingDetail.terminalNote[status]`;
    bị thu rồi hoàn thì thêm `refundSentence` (spec §4.3).
19. **Màn hình `BookingReceipt`, tâm trạng `settled`**: cuống thay hai dòng "Departs …" và "This code
    becomes your voucher…" bằng câu `booking.success.stubClosed` (G37, phần chữ). Câu `heldNote` của
    `/checkout/cancel` để nguyên (G37 còn mở phần đó).
20. **Giữ luật in `[data-slot="barcode"]`** ở `globals.css` của web (vé trang chi tiết đơn in vẫn còn
    vạch); gỡ các luật in còn lại của hoá đơn và voucher. `PrintButton` giữ `print:hidden` của nó.
21. **Dùng lại khoá i18n sẵn có** (spec §8): tiêu đề dải `bookingDetail.details.cancellation`,
    `booking.success.paymentLabel`, `voucher.journal.refund`, `booking.success.refLabel`; nhãn vé
    `passportVisa.kicker`, `passportVisa.labels.travellers`, `bookingDetail.leadTraveller`,
    `bookingDetail.booked`, `bookingDetail.ticket.*`; câu dự phòng điểm hẹn
    `voucher.meetingPointContact` + `voucher.meetingPointFallback`; dòng xé hoá đơn chờ
    `booking.success.stubNotYetVoucher`; chân trang `voucher.needHelp`, `booking.success.needHelp`.

## Bản đồ file

| File | Việc |
| --- | --- |
| `libs/shared/tokens/style-dictionary/tokens.mjs`, `build.mjs`, `src/lib/tokens.spec.ts` | 4 token, khối `.light` (Task 1) |
| `libs/shared/i18n/src/lib/messages.ts`, `messages.spec.ts` | `printDoc`, `booking.success.stubClosed` (Task 2) |
| `libs/shared/ui/src/lib/print-time.ts` (+ spec) | Giờ in theo múi giờ (Task 3) |
| `apps/web/src/lib/checkout.ts` (+ spec) | `pendingDeadline` (Task 3) |
| `libs/shared/ui/src/components/print-doc/*.tsx`, `print-doc.spec.ts`, `src/styles/globals.css` | Khung chung, trang in `doc` (Task 4) |
| `apps/web/src/components/print/printed-at.spec.tsx` | Test `PrintedAt` ở jsdom (Task 4) |
| `apps/web/src/lib/get-ready.ts`, `apps/web/src/test/fixtures/booking.ts` | `BookingTourData` + `included` (Task 5) |
| `apps/web/src/lib/print/print-ticket.ts` (+ spec) | Kiểu và helper vé in dùng chung (Task 5) |
| `apps/web/src/lib/print/voucher-print.ts` (+ spec) | `voucherPrintView` (Task 6) |
| `apps/web/src/components/print/{print-styles.ts,print-brand,photo-cover,print-ticket,print-tear,print-band}.tsx` (+ 3 spec) | Mảnh in dùng chung (Task 7) |
| `apps/web/src/components/print/{print-lists,voucher-print}.tsx` (+ spec) | Voucher in 5b (Task 8) |
| `lib/voucher.ts` (+ spec), `app/(site)/checkout/success/page.tsx`, `app/globals.css`, 5 component voucher, 3 spec voucher | Nối voucher in, gỡ in cũ (Task 9) |
| `apps/web/src/lib/print/receipt-print.ts` (+ spec), `components/print/receipt-print.tsx` (+ spec) | Hoá đơn chờ in B1 (Task 10) |
| `success/page.tsx`, `cancel/page.tsx`, `booking-receipt.tsx` (+ spec), `app/globals.css` | Nối hoá đơn chờ in, cuống G37, gỡ in cũ còn lại (Task 11) |

## Giao diện dùng chung

```ts
// @tourism/ui/components/print-doc/doc-stamp
export type DocStampTone = 'confirmed' | 'pending' | 'muted';

// @tourism/ui/lib/print-time — mọi hàm nhận (at: Date, timeZone: string)
formatPrintDateTime // "9 Oct 2026, 17:59"
formatPrintDate     // "9 Oct 2026"
formatPrintTime     // "19:04"
formatPrintDayMonth // "9 Oct"

// apps/web/src/lib/print/print-ticket.ts
export type PrintTicketTone = 'active' | 'pending' | 'closed';
export interface PrintTicketDate { big: string; sub: string }
export interface PrintTicketCell { label: string; value: string }
export interface PrintTicketStub {
  band: string;                 // "Admit 3" | "Unpaid"
  tag: string | null;           // "Not yet a voucher" (hoá đơn đang chờ)
  amountLabel: string | null;   // "Total paid" (voucher); null ở hoá đơn
  amount: string;
  note: string;                 // "Taxes and fees included" | "Total · includes all taxes and fees"
  barcode: string | null;       // mã để vẽ mã vạch và in bên dưới; null = không mã vạch
  footer: { label: string; value: string | null } | null; // "Pay by" + "19:04 · 9 Oct" | "No payment was taken"
}
export interface PrintTicketView {
  tone: PrintTicketTone;
  bandStart: string;            // "Entry · Tour booking" | "Booking · payment pending" | "Booking · closed"
  bandEnd: string;              // mã đơn
  title: string;
  stamp: { label: string; tone: DocStampTone };
  departs: PrintTicketDate;
  returns: PrintTicketDate;
  routeLine: string;            // "1 day · Hội An"
  cells: PrintTicketCell[];     // 4 ô
  stub: PrintTicketStub;
  notice: string | null;        // dải hết hiệu lực thay thân vé (voucher đã huỷ)
}
export interface PrintColumn { heading: string; strong: string | null; text: string | null; reference: boolean }
export interface PrintList { items: string[]; more: string | null }
export interface PrintPhoto { url: string; alt: string }
// stampTone · ticketDate · ticketCells · printPhoto · capList · textColumn · referenceColumn

// apps/web/src/lib/print/voucher-print.ts
export interface PrintStop { time: string | null; text: string }
export interface VoucherPrintView {
  photo: PrintPhoto | null;
  issued: string;               // "Issued 18 Oct 2026"
  kicker: string;               // "Hà Nội · 1 day · Tue 3 Nov 2026"
  title: string;
  longTitle: boolean;
  ticket: PrintTicketView;
  tear: string | null;
  day: { heading: string; stops: PrintStop[]; more: string | null } | null;
  included: PrintList | null;
  excluded: PrintList | null;
  band: PrintColumn[];
}
export function voucherPrintView(booking: BookingDetail, view: VoucherView, tour: BookingTourData | null, now: Date): VoucherPrintView;

// apps/web/src/lib/print/receipt-print.ts
export interface ReceiptPrintView {
  photo: PrintPhoto | null;
  booked: string;               // "Booked 9 Oct 2026, 17:59"
  kicker: string;
  title: string;
  ticket: PrintTicketView;
  tear: string;
  line: { item: string; sub: string; travellers: string; price: string; priceNote: string; amount: string };
  total: { label: string; amount: string; note: string };
  band: PrintColumn[];
}
export function receiptPrintView(booking: Booking, now: Date): ReceiptPrintView;
```

---

### Task 1: Bốn token màu của tài liệu in và phạm vi màu sáng `.light`

**Files:**
- Modify: `libs/shared/tokens/style-dictionary/tokens.mjs` (ngay sau dòng `'chart-5'`, ~221)
- Modify: `libs/shared/tokens/style-dictionary/build.mjs` (format `tourism/tailwind-css`, ~29–78)
- Test: `libs/shared/tokens/src/lib/tokens.spec.ts`

**Interfaces:**
- Produces: utility `bg-chart-gain`, `fill-chart-cost`, `text-pending`, `border-pending`,
  `bg-pending-soft`…; class `light` đặt lại mọi biến màu về giá trị sáng.

- [ ] **Step 1: Viết test đỏ** — thêm cuối `tokens.spec.ts` (file đã import `readFileSync`,
  `fileURLToPath`, `tokens = src.default`; nguồn `.mjs` không có kiểu nên đọc trường thẳng):

```ts
// G40 (ADR-0057 §5): màu của tài liệu in. Giấy luôn sáng nên bốn token có dark = light, và bản
// build sinh phạm vi `.light` để tài liệu in dưới <html class="dark"> lấy lại màu sáng.
describe('token của tài liệu in (G40)', () => {
  it('đủ bốn token, dark = light', () => {
    for (const name of ['chart-gain', 'chart-cost', 'pending', 'pending-soft']) {
      const token = tokens.color[name];
      expect(token, name).toBeDefined();
      expect(token.darkValue, name).toBe(token.value);
    }
  });

  it('generated/tokens.css có khối .light sau .dark, mang giá trị SÁNG của mọi màu', async () => {
    await import('../../style-dictionary/build.mjs');
    const cssPath = fileURLToPath(new URL('../../generated/tokens.css', import.meta.url));
    const css = readFileSync(cssPath, 'utf-8');
    const start = css.indexOf('.light {');
    expect(start).toBeGreaterThan(css.indexOf('.dark {'));
    const block = css.slice(start, css.indexOf('}', start));
    expect(block).toContain(`--background: ${tokens.color.background.value};`);
    expect(block).toContain(`--paper: ${tokens.color.paper.value};`);
    expect(block).toContain(`--pending: ${tokens.color.pending.value};`);
    expect(block).not.toContain(tokens.color.background.darkValue);
  });
});
```

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/tokens exec vitest run src/lib/tokens.spec.ts`.
  Mong đợi: ca 1 đỏ "expected undefined to be defined" ở `chart-gain`; ca 2 đỏ vì không có `.light {`.

- [ ] **Step 3: Thêm token** vào `tokens.mjs`, ngay sau dòng `'chart-5'`:

```js
    // G40 (ADR-0057 §5) — màu của tài liệu in. Giấy luôn sáng nên dark = light (cùng lối `on-media`).
    // chart-gain / chart-cost đã qua bộ kiểm bảng màu của skill dataviz (sáng): chroma, tách màu khi
    // mù màu, tương phản; chi phí in kèm vân 45° nên in trắng đen vẫn tách.
    'chart-gain': c('oklch(0.566 0.101 182.5)', 'oklch(0.566 0.101 182.5)'),
    'chart-cost': c('oklch(0.667 0.155 44.4)', 'oklch(0.667 0.155 44.4)'),
    pending: c('oklch(0.531 0.117 63.9)', 'oklch(0.531 0.117 63.9)'),
    'pending-soft': c('oklch(0.967 0.019 80.1)', 'oklch(0.967 0.019 80.1)'),
```

- [ ] **Step 4: Thêm khối `.light`** vào `build.mjs`: cạnh `const dark = …` thêm
  `const light = colors.map((t) => \`  ${cssVar(t)}: ${t.original.value};\`);`, và trong mảng trả về,
  ngay sau khối `.dark { … }` (trước comment ADR-0015 và khối `[data-density='compact']`):

```js
      '.dark {',
      ...dark,
      '}',
      '',
      // G40 (ADR-0057 §5): phạm vi SÁNG gắn được lên một phần tử. Tài liệu in mang class `light` để
      // vẫn ra giấy sáng khi trang đang ở giao diện tối — class `dark` trên <html> còn nguyên lúc in.
      '.light {',
      ...light,
      '}',
      '',
```

  Sửa comment đầu file (`// Emits generated/tokens.css (Tailwind v4 @theme inline + :root + .dark).`)
  thành `… + :root + .dark + .light).`

- [ ] **Step 5: Chạy, thấy XANH** — lệnh Step 2; rồi build:
  `pnpm turbo run build --filter=@tourism/tokens --output-logs=errors-only`.
- [ ] **Step 6: Thử đột biến** — đổi `darkValue` của `pending` sang `oklch(0.6 0.1 63.9)`, thấy ca 1 đỏ;
  đổi `t.original.value` của khối `.light` thành `t.original.darkValue`, thấy ca 2 đỏ; trả lại cả hai.
- [ ] **Step 7: Commit**

```bash
pnpm exec biome check --write libs/shared/tokens/style-dictionary/tokens.mjs libs/shared/tokens/style-dictionary/build.mjs libs/shared/tokens/src/lib/tokens.spec.ts
git add libs/shared/tokens/style-dictionary/tokens.mjs libs/shared/tokens/style-dictionary/build.mjs libs/shared/tokens/src/lib/tokens.spec.ts
git commit -m "feat(tokens): bốn màu của tài liệu in và phạm vi màu sáng .light cho giấy in từ giao diện tối"
```

---

### Task 2: Chữ của tài liệu in (`printDoc`) và câu cuống của đơn đã đóng

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts` — `printDoc` là namespace cấp 1 đặt ngay sau khối
  `voucher: { … },` (khối ấy bắt đầu ~dòng 623); `stubClosed` thêm vào `booking.success` ngay sau
  `stubNotYetVoucher` (~dòng 517)
- Test: `libs/shared/i18n/src/lib/messages.spec.ts`

**Interfaces:**
- Produces: `messages.printDoc.*` (đúng tên ở Step 3) và `messages.booking.success.stubClosed`.

- [ ] **Step 1: Viết test đỏ** — thêm cuối `messages.spec.ts` (cùng nếp hàm `walk` của describe
  `bookingDetail`, ~dòng 178):

```ts
describe('messages: printDoc (G40 — tài liệu in của khách)', () => {
  const p = messages.printDoc;

  it('mọi chuỗi trong khối đều có chữ', () => {
    const walk = (node: unknown): string[] => {
      if (typeof node === 'string') return [node];
      if (typeof node === 'function' || node === null) return [];
      return Object.values(node as object).flatMap(walk);
    };
    for (const value of walk(p)) expect(value.trim().length).toBeGreaterThan(0);
  });

  it('kicker và đường nối của tấm vé', () => {
    expect(p.kicker('Hội An', '1 day', 'Thu 29 Oct 2026')).toBe('Hội An · 1 day · Thu 29 Oct 2026');
    expect(p.routeLine('1 day', 'Hội An')).toBe('1 day · Hội An');
  });

  it('voucher: lịch trình dài, mục dư, giờ hẹn, dòng thanh toán', () => {
    expect(p.voucher.moreDays(5, 'vietnam-grand-journey-12d')).toBe(
      '+5 more days — full itinerary at nexora-travel.agency/tours/vietnam-grand-journey-12d',
    );
    expect(p.voucher.moreItems(2)).toBe('+2 more');
    expect(p.voucher.meetGuide('15:30')).toBe('meet your guide at 15:30.');
    expect(p.voucher.paymentLine('$39.00', 'Card (Stripe)', '9 Oct 2026')).toBe(
      '$39.00 paid with Card (Stripe) on 9 Oct 2026.',
    );
  });

  it('hoá đơn chờ: nói giờ nhả cụ thể, không hứa giữ chỗ, không đếm ngược', () => {
    const released = p.receipt.releasedAt('19:04, 9 Oct 2026');
    expect(released).toBe(
      'The booking is released at 19:04, 9 Oct 2026 (Vietnam time). Seats aren’t held until you pay.',
    );
    expect(released).not.toMatch(/reserved|minutes? left/);
  });

  it('cuống của đơn chưa trả đã đóng nói thẳng, không hứa thành voucher (G37)', () => {
    expect(messages.booking.success.stubClosed).toBe(
      'This booking is closed — no payment was taken.',
    );
  });
});
```

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/i18n exec vitest run src/lib/messages.spec.ts`.
  Mong đợi: lỗi đọc thuộc tính của `undefined` (`messages.printDoc` chưa có).

- [ ] **Step 3: Thêm chữ** — vào `booking.success`, ngay sau `stubNotYetVoucher`:

```ts
      // Cuống của đơn chưa trả đã ĐÓNG (huỷ, lỡ hạn — tâm trạng `settled`): nói thẳng, không hứa
      // mã sẽ thành voucher cho một đơn không còn trả được (G37). Màn hình và bản in dùng chung.
      stubClosed: 'This booking is closed — no payment was taken.',
```

  và namespace mới ngay sau khối `voucher: { … },`:

```ts
  /**
   * Tài liệu in của khách (G40, ADR-0057, spec 2026-10-10 §3–§4): khung chung ở cấp này, chữ riêng
   * ở `voucher` (bản in 5b) và `receipt` (hoá đơn chờ B1). CỐ Ý chỉ khai thứ MỚI — nhãn tấm vé, tiền,
   * hạn huỷ, tiêu đề dải trùng nghĩa dùng lại khoá sẵn có (`passportVisa`, `bookingDetail`,
   * `booking.success`, `voucher`, `cancellationDeadline`, `checkoutSummary` — quyết định 21 của plan).
   */
  printDoc: {
    /** Dòng liên hệ của đầu trang trên ảnh bìa — chỉ còn website (spec §2.2). */
    website: 'www.nexora-travel.agency',
    printedPrefix: 'Printed',
    /** Chân trang voucher: nối sau `voucher.needHelp`, trước email in đậm. */
    replyOrWriteTo: 'Reply to your confirmation email or write to',
    /** Chân trang hoá đơn chờ: nối sau `booking.success.needHelp`, trước email in đậm. */
    writeTo: 'Write to',
    /** Dòng nhỏ trên ảnh bìa — `days` từ `bookingDetail.ticket.days`, `when` có thứ và năm. */
    kicker: (place: string, days: string, when: string) => `${place} · ${days} · ${when}`,
    /** Đường nối giữa Departs và Returns của tấm vé. */
    routeLine: (days: string, place: string) => `${days} · ${place}`,
    voucher: {
      docType: 'Trip voucher',
      issued: (date: string) => `Issued ${date}`,
      /** Đuôi dòng phụ dưới ngày đi khi tách được giờ hẹn. */
      meet: (time: string) => `meet ${time}`,
      tear: 'Show the ticket at pickup — printed or on your phone',
      yourDay: (title: string) => `Your day · ${title}`,
      /** `days` từ `bookingDetail.ticket.days`. */
      yourTrip: (days: string) => `Your trip · ${days}`,
      dayLine: (n: number, title: string) => `Day ${n} · ${title}`,
      moreDays: (n: number, slug: string) =>
        `+${n} more days — full itinerary at nexora-travel.agency/tours/${slug}`,
      moreItems: (n: number) => `+${n} more`,
      included: 'Included',
      notIncluded: 'Not included',
      whereToMeet: 'Where to meet',
      meetGuide: (time: string) => `meet your guide at ${time}.`,
      /** `amount` đủ hai số lẻ (`formatMoneyExact`): số tiền thật khách đối chiếu với sao kê. */
      paymentLine: (amount: string, provider: string, date: string) =>
        `${amount} paid with ${provider} on ${date}.`,
    },
    receipt: {
      docType: 'Booking receipt',
      booked: (when: string) => `Booked ${when}`,
      pendingBand: 'Booking · payment pending',
      closedBand: 'Booking · closed',
      stampPending: 'Payment pending',
      stampClosed: 'Closed',
      unpaid: 'Unpaid',
      notYetVoucher: 'Not yet a voucher',
      totalNote: 'Total · includes all taxes and fees',
      payBy: 'Pay by',
      noPayment: 'No payment was taken',
      summary: 'Summary',
      /** Cột Travellers dùng `passportVisa.labels.travellers`. */
      columns: { item: 'Item', price: 'Price', amount: 'Amount' },
      howToPay: 'How to pay',
      howToPayBody: 'Open My bookings on nexora-travel.agency and choose Pay now.',
      ifUnpaid: 'If it stays unpaid',
      /**
       * Giờ nhả cụ thể ("19:04, 9 Oct 2026"), KHÔNG đếm ngược; đơn chờ không giữ ghế nào
       * (invariant #1 của API) nên câu nói thẳng điều đó.
       */
      releasedAt: (when: string) =>
        `The booking is released at ${when} (Vietnam time). Seats aren’t held until you pay.`,
      whatHappened: 'What happened',
      bookAgain: 'Book again',
      bookAgainBody: (slug: string) => `Pick a new date at nexora-travel.agency/tours/${slug}.`,
      bookedBy: (email: string) => `Booked by ${email}`,
    },
  },
```

- [ ] **Step 4: Chạy, thấy XANH**, rồi build i18n:
  `pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only`.
- [ ] **Step 5: Thử đột biến** — đổi `releasedAt` thành "…seats are reserved for you…", thấy ca hoá đơn
  chờ đỏ; trả lại.
- [ ] **Step 6: Commit**

```bash
pnpm exec biome check --write libs/shared/i18n/src/lib/messages.ts libs/shared/i18n/src/lib/messages.spec.ts
git add libs/shared/i18n/src/lib/messages.ts libs/shared/i18n/src/lib/messages.spec.ts
git commit -m "feat(i18n): chữ của tài liệu in voucher và hoá đơn chờ, câu cuống cho đơn đã đóng"
```

---

### Task 3: Giờ in theo múi giờ (`print-time`) và mốc nhả đơn chờ (`pendingDeadline`)

**Files:**
- Create: `libs/shared/ui/src/lib/print-time.ts`, `libs/shared/ui/src/lib/print-time.spec.ts`
- Modify: `apps/web/src/lib/checkout.ts` (`pendingExpiry`, ~dòng 175), `apps/web/src/lib/checkout.spec.ts`

**Interfaces:**
- Produces: bốn hàm ở "Giao diện dùng chung"; `pendingDeadline(createdAt: string): Date` ở
  `@/lib/checkout`.

- [ ] **Step 1: Viết test đỏ** `print-time.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  formatPrintDate,
  formatPrintDateTime,
  formatPrintDayMonth,
  formatPrintTime,
} from './print-time';

const VN = 'Asia/Ho_Chi_Minh';

describe('giờ in theo múi giờ (G40)', () => {
  it('ngày giờ đủ, 24 giờ, giờ Việt Nam', () => {
    expect(formatPrintDateTime(new Date('2026-10-09T10:59:36.812Z'), VN)).toBe('9 Oct 2026, 17:59');
  });

  it('17:00Z là 00:00 của ngày sau theo giờ Việt Nam — không ra "24:00"', () => {
    expect(formatPrintDateTime(new Date('2026-10-09T17:00:00Z'), VN)).toBe('10 Oct 2026, 00:00');
  });

  it('tháng Chín là "Sep", không phải "Sept"', () => {
    expect(formatPrintDateTime(new Date('2026-09-14T03:12:45Z'), VN)).toBe('14 Sep 2026, 10:12');
  });

  it('các mảnh riêng cho "Pay by" và câu giờ nhả', () => {
    const at = new Date('2026-10-09T12:04:36.812Z');
    expect(formatPrintTime(at, VN)).toBe('19:04');
    expect(formatPrintDayMonth(at, VN)).toBe('9 Oct');
    expect(formatPrintDate(at, VN)).toBe('9 Oct 2026');
  });
});
```

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/ui exec vitest run src/lib/print-time.spec.ts`
  (module chưa có).

- [ ] **Step 3: Viết `print-time.ts`**:

```ts
/**
 * Giờ trên tài liệu in (G40, ADR-0057 §3): "9 Oct 2026, 17:59" — 24 giờ, theo múi giờ truyền vào.
 *
 * Tên tháng lấy từ en-US: luôn "Sep". en-GB của ICU mới in "Sept", lệch mọi ngày khác của site
 * (`formatDate` của web in "Sep"). Ghép từ `formatToParts` để thứ tự cố định "ngày tháng năm" thay vì
 * thứ tự Mỹ; `hourCycle: 'h23'` để nửa đêm là "00", không phải "24".
 */
function parts(at: Date, timeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const out: Record<string, string> = {};
  for (const part of formatter.formatToParts(at)) out[part.type] = part.value;
  return out;
}

/** "9 Oct 2026, 17:59" — mốc đặt đơn, giờ in. */
export function formatPrintDateTime(at: Date, timeZone: string): string {
  const p = parts(at, timeZone);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/** "9 Oct 2026". */
export function formatPrintDate(at: Date, timeZone: string): string {
  const p = parts(at, timeZone);
  return `${p.day} ${p.month} ${p.year}`;
}

/** "19:04". */
export function formatPrintTime(at: Date, timeZone: string): string {
  const p = parts(at, timeZone);
  return `${p.hour}:${p.minute}`;
}

/** "9 Oct" — ngày của dòng "Pay by". */
export function formatPrintDayMonth(at: Date, timeZone: string): string {
  const p = parts(at, timeZone);
  return `${p.day} ${p.month}`;
}
```

- [ ] **Step 4: Chạy, thấy XANH.**

- [ ] **Step 5: Viết test đỏ** trong `apps/web/src/lib/checkout.spec.ts` — thêm `pendingDeadline` vào
  import từ `./checkout` và một describe cạnh describe `pendingExpiry` sẵn có:

```ts
describe('pendingDeadline — mốc đơn chờ bị nhả', () => {
  it('là createdAt cộng PENDING_TTL_MINUTES', () => {
    expect(pendingDeadline('2026-10-09T10:59:36.812Z').toISOString()).toBe(
      '2026-10-09T12:04:36.812Z',
    );
  });
});
```

- [ ] **Step 6: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/web exec vitest run src/lib/checkout.spec.ts --maxWorkers=2`.

- [ ] **Step 7: Viết `pendingDeadline`** ngay trên JSDoc của `pendingExpiry`, và cho `pendingExpiry`
  dùng nó:

```ts
/**
 * Mốc đơn chờ bị nhả: `createdAt` cộng `PENDING_TTL_MINUTES`. MỘT nguồn cho `pendingExpiry` (câu
 * "released in about n minutes" của trang huỷ) và dòng "Pay by" của hoá đơn chờ in (G40).
 */
export function pendingDeadline(createdAt: string): Date {
  return new Date(new Date(createdAt).getTime() + PENDING_TTL_MINUTES * 60_000);
}
```

  Trong `pendingExpiry`, thay dòng
  `const deadline = new Date(createdAt).getTime() + PENDING_TTL_MINUTES * 60_000;` bằng
  `const deadline = pendingDeadline(createdAt).getTime();`.

- [ ] **Step 8: Chạy, thấy XANH** (cả các ca `pendingExpiry` cũ).
- [ ] **Step 9: Thử đột biến** — đổi `'en-US'` thành `'en-GB'` trong `print-time.ts`, thấy ca "Sep" đỏ
  ("Sept"); bỏ `hourCycle`, thấy ca nửa đêm đỏ nếu Node ra "24:00" (ghi kết quả thật vào báo cáo);
  đổi `60_000` thành `1000` trong `pendingDeadline`, thấy ca mới đỏ; trả lại.
- [ ] **Step 10: Commit**

```bash
pnpm exec biome check --write libs/shared/ui/src/lib/print-time.ts libs/shared/ui/src/lib/print-time.spec.ts apps/web/src/lib/checkout.ts apps/web/src/lib/checkout.spec.ts
git add libs/shared/ui/src/lib/print-time.ts libs/shared/ui/src/lib/print-time.spec.ts apps/web/src/lib/checkout.ts apps/web/src/lib/checkout.spec.ts
git commit -m "feat(ui+web): giờ in theo giờ Việt Nam và mốc nhả đơn chờ dùng chung"
```

---

### Task 4: Khung chung của tài liệu in ở `@tourism/ui` và trang in `doc`

**Files:**
- Create: `libs/shared/ui/src/components/print-doc/doc-page.tsx`, `doc-letterhead.tsx`, `doc-footer.tsx`,
  `doc-stamp.tsx`, `printed-at.tsx`, `print-doc.spec.ts`
- Modify: `libs/shared/ui/src/styles/globals.css` (cuối file)
- Test (jsdom): `apps/web/src/components/print/printed-at.spec.tsx`

**Interfaces:**
- Consumes: `formatPrintDateTime` (Task 3); token `pending`, class `light` (Task 1).
- Produces: `DocPage`, `DocLetterhead`, `DocFooter`, `DocStamp` + `DocStampTone` + `STAMP_TONE_CLASS`,
  `PrintedAt` — import qua `@tourism/ui/components/print-doc/<file>` (gói không có barrel).

- [ ] **Step 1: Viết test đỏ** `print-doc.spec.ts` (ui chạy môi trường node — dựng HTML bằng
  `renderToStaticMarkup`; file `.ts` nên dùng `createElement`):

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocFooter } from './doc-footer';
import { DocLetterhead } from './doc-letterhead';
import { DocPage } from './doc-page';
import { DocStamp, STAMP_TONE_CLASS } from './doc-stamp';

describe('DocPage', () => {
  it('là tờ A4 chỉ hiện khi in, mang data-print-doc và phạm vi màu sáng', () => {
    const html = renderToStaticMarkup(createElement(DocPage, null, 'x'));
    expect(html).toContain('data-print-doc=""');
    for (const cls of ['light', 'scheme-light', 'hidden', 'print:flex', 'h-[297mm]', 'w-[210mm]']) {
      expect(html).toContain(cls);
    }
  });
});

describe('DocLetterhead', () => {
  it('giấy: loại, số và mốc của tài liệu; không scope tối', () => {
    const html = renderToStaticMarkup(
      createElement(DocLetterhead, {
        brand: 'B',
        docType: 'Monthly report',
        docNumber: '2026-09',
        meta: 'Generated 1 Oct 2026, 08:00 UTC',
      }),
    );
    expect(html).toContain('Monthly report');
    expect(html).toContain('data-slot="doc-number"');
    expect(html).toContain('2026-09');
    expect(html).toContain('Generated 1 Oct 2026, 08:00 UTC');
    expect(html).not.toMatch(/<header[^>]*class="[^"]*\bdark\b/);
  });

  it('bìa ảnh: gắn scope dark (teal nhạt cho primary-emphasis), chữ on-media, không dòng số', () => {
    const html = renderToStaticMarkup(
      createElement(DocLetterhead, { brand: 'B', docType: 'Trip voucher', meta: 'm', tone: 'photo' }),
    );
    expect(html).toMatch(/<header[^>]*class="[^"]*\bdark\b/);
    expect(html).toContain('text-on-media/80');
    expect(html).not.toContain('data-slot="doc-number"');
  });
});

describe('DocStamp', () => {
  it('tông confirmed là teal primary, không phải success (G32); pending nghiêng ngược', () => {
    expect(STAMP_TONE_CLASS.confirmed).toContain('text-primary');
    expect(STAMP_TONE_CLASS.confirmed).not.toContain('success');
    expect(STAMP_TONE_CLASS.pending).toContain('text-pending');
    expect(STAMP_TONE_CLASS.pending).toContain('-rotate-2');
    const html = renderToStaticMarkup(createElement(DocStamp, { label: 'CONFIRMED', tone: 'confirmed' }));
    expect(html).toContain('CONFIRMED');
    expect(html).toContain('data-tone="confirmed"');
  });
});

describe('DocFooter', () => {
  it('hai đầu chân trang', () => {
    const html = renderToStaticMarkup(createElement(DocFooter, { start: 'help', end: 'printed' }));
    expect(html).toContain('data-slot="doc-footer"');
    expect(html).toContain('help');
    expect(html).toContain('printed');
  });
});
```

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/ui exec vitest run src/components/print-doc/print-doc.spec.ts`.

- [ ] **Step 3: Viết bốn component server** (không `'use client'`). Các lớp theo bản thảo: `.page`,
  `.lh`, `.doc-*`, `.foot`, `.stamp`.

`doc-page.tsx`
```tsx
import { cn } from '@tourism/ui/lib/utils';
import type * as React from 'react';

/**
 * Tờ A4 của tài liệu in (G40, ADR-0057 §1–§2): ẩn trên màn hình, hiện khi in thành cột dọc (chân
 * trang `mt-auto` dính đáy); `data-print-doc` là móc của trang in tên `doc` và của luật giấu chrome
 * ở app. Class `light` lấy lại màu sáng khi trang đang ở giao diện tối — giấy luôn sáng.
 */
export function DocPage({ className, children, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      data-print-doc=""
      className={cn(
        'light scheme-light hidden h-[297mm] w-[210mm] flex-col overflow-hidden bg-background px-[15mm] pt-[14mm] pb-[11mm] font-sans text-[9.5pt] leading-[1.45] text-foreground print:flex',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
```

`doc-letterhead.tsx`
```tsx
import { cn } from '@tourism/ui/lib/utils';
import type { ReactNode } from 'react';

/**
 * Đầu trang chung (G40, spec §2.2): trái là `brand` của app (logo, wordmark, dòng liên hệ), phải là
 * loại tài liệu, số (tuỳ) và mốc.
 *
 * Tông `photo` cho đầu trang nằm trên ảnh bìa: gắn scope `dark` — cùng lối các mảng tối cố định của
 * web (hero trang About, hero bài viết) — để `primary-emphasis` ra teal nhạt như bản thảo ("viên sau
 * teal nhạt") mà không thêm token. Chữ còn lại là `on-media`.
 */
export function DocLetterhead({
  brand,
  docType,
  docNumber,
  meta,
  tone = 'paper',
  className,
}: {
  brand: ReactNode;
  docType: string;
  docNumber?: string;
  meta: string;
  tone?: 'paper' | 'photo';
  className?: string;
}) {
  const photo = tone === 'photo';
  return (
    <header
      data-slot="doc-letterhead"
      data-tone={tone}
      className={cn('flex items-start justify-between gap-[10mm]', photo && 'dark', className)}
    >
      {brand}
      <div className="text-right">
        <p className="font-mono text-[7.5pt] font-medium tracking-[0.18em] text-primary-emphasis uppercase">
          {docType}
        </p>
        {docNumber ? (
          <p
            data-slot="doc-number"
            className={cn(
              'mt-[1mm] font-mono text-[13pt] font-medium tracking-[0.04em]',
              photo ? 'text-on-media' : 'text-foreground',
            )}
          >
            {docNumber}
          </p>
        ) : null}
        <p className={cn('mt-[0.5mm] text-[7.5pt]', photo ? 'text-on-media/80' : 'text-muted-foreground')}>
          {meta}
        </p>
      </div>
    </header>
  );
}
```

`doc-footer.tsx`
```tsx
import { cn } from '@tourism/ui/lib/utils';
import type { ReactNode } from 'react';

/** Chân trang chung (G40, spec §2.3): dính đáy tờ giấy nhờ `mt-auto` trong cột flex của `DocPage`. */
export function DocFooter({
  start,
  end,
  className,
}: {
  start: ReactNode;
  end: ReactNode;
  className?: string;
}) {
  return (
    <footer
      data-slot="doc-footer"
      className={cn(
        'mt-auto flex justify-between gap-[8mm] border-t-[0.6pt] border-border pt-[3mm] text-[7.5pt] text-muted-foreground',
        className,
      )}
    >
      <span>{start}</span>
      <span>{end}</span>
    </footer>
  );
}
```

`doc-stamp.tsx`
```tsx
import { cn } from '@tourism/ui/lib/utils';

export type DocStampTone = 'confirmed' | 'pending' | 'muted';

/**
 * Màu và độ nghiêng của mộc trên giấy (G40). `confirmed` là teal `primary`, KHÔNG `success`: mộc
 * xanh lá chỉ đạt 2,8:1 trên nền sáng (G32). `pending` là token của tài liệu in, nghiêng ngược như
 * bản thảo B1.
 */
export const STAMP_TONE_CLASS: Record<DocStampTone, string> = {
  confirmed: 'rotate-[3deg] border-primary text-primary outline-primary',
  pending: '-rotate-2 border-pending text-pending outline-pending',
  muted: 'rotate-[3deg] border-muted-foreground text-muted-foreground outline-muted-foreground',
};

export function DocStamp({
  label,
  tone,
  className,
}: {
  label: string;
  tone: DocStampTone;
  className?: string;
}) {
  return (
    <span
      data-slot="doc-stamp"
      data-tone={tone}
      className={cn(
        'inline-block shrink-0 rounded-[1.2mm] border-[1.2pt] px-[3mm] py-[1.4mm] font-heading text-[8pt] font-semibold tracking-[0.2em] uppercase outline outline-[0.5pt] outline-offset-[0.8mm]',
        STAMP_TONE_CLASS[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Chạy, thấy XANH** (lệnh Step 2).

- [ ] **Step 5: Viết test đỏ** `apps/web/src/components/print/printed-at.spec.tsx` (jsdom — ui không có
  jsdom nên ca chạy hiệu ứng nằm ở web):

```tsx
import { act, render, screen } from '@testing-library/react';
import { PrintedAt } from '@tourism/ui/components/print-doc/printed-at';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('PrintedAt — giờ in đóng dấu ở client', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('đóng dấu giờ Việt Nam lúc mount và đóng lại lúc beforeprint', () => {
    vi.useFakeTimers({ now: new Date('2026-10-10T02:31:00Z'), toFake: ['Date'] });
    render(<PrintedAt prefix="Printed" timeZone="Asia/Ho_Chi_Minh" />);
    expect(screen.getByText('Printed 10 Oct 2026, 09:31')).toBeInTheDocument();

    vi.setSystemTime(new Date('2026-10-10T03:05:00Z'));
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(screen.getByText('Printed 10 Oct 2026, 10:05')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/web exec vitest run src/components/print/printed-at.spec.tsx --maxWorkers=2`.

- [ ] **Step 7: Viết `printed-at.tsx`**:

```tsx
'use client';

import { formatPrintDateTime } from '@tourism/ui/lib/print-time';
import { useEffect, useState } from 'react';

/**
 * Giờ in (G40, ADR-0057 §3): đóng dấu ở client lúc mount và lại lúc `beforeprint` — render ở server
 * thì lệch hydration và in ra giờ TẢI trang thay cho giờ IN. Nhận chuỗi (`prefix`, `timeZone`), không
 * nhận hàm: component client nhận props từ Server Component.
 */
export function PrintedAt({ prefix, timeZone }: { prefix: string; timeZone: string }) {
  const [stamp, setStamp] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setStamp(formatPrintDateTime(new Date(), timeZone));
    update();
    window.addEventListener('beforeprint', update);
    return () => window.removeEventListener('beforeprint', update);
  }, [timeZone]);

  return <span data-slot="printed-at">{stamp === null ? null : `${prefix} ${stamp}`}</span>;
}
```

- [ ] **Step 8: Chạy, thấy XANH.**

- [ ] **Step 9: CSS trang in** — cuối `libs/shared/ui/src/styles/globals.css`:

```css
/* ── Tài liệu in (G40, ADR-0057 §2) — trang in tên `doc`: A4, lề 0. Lề 0 là cách duy nhất tắt đầu
 * và chân trang tự động của trình duyệt (ngày giờ, tiêu đề tab, URL); tài liệu tự đệm 11–15 mm bên
 * trong khổ. Chỉ phần tử `[data-print-doc]` dùng trang này — in trang khác vẫn lề mặc định.
 * `print-color-adjust` (kế thừa xuống con) giữ nền màu, ảnh phủ, mã vạch khi người in tắt
 * "Background graphics". ── */
@page doc {
  size: A4;
  margin: 0;
}

@media print {
  [data-print-doc] {
    page: doc;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

- [ ] **Step 10: Thử đột biến** — bỏ `'light'` khỏi class `DocPage`, thấy ca DocPage đỏ; bỏ
  `photo && 'dark'`, thấy ca bìa ảnh đỏ; bỏ dòng `addEventListener('beforeprint', …)`, thấy ca
  PrintedAt đỏ ở lần đóng dấu thứ hai; trả lại.
- [ ] **Step 11: Typecheck** — `pnpm --filter @tourism/ui typecheck`.
- [ ] **Step 12: Commit**

```bash
pnpm exec biome check --write libs/shared/ui/src/components/print-doc libs/shared/ui/src/styles/globals.css apps/web/src/components/print/printed-at.spec.tsx
git add libs/shared/ui/src/components/print-doc libs/shared/ui/src/styles/globals.css apps/web/src/components/print/printed-at.spec.tsx
git commit -m "feat(ui): khung chung của tài liệu in — tờ A4, đầu trang, chân trang, mộc, giờ in và trang in doc"
```

---

### Task 5: Helper vé in dùng chung và `BookingTourData` thêm mục bao gồm

**Files:**
- Modify: `apps/web/src/lib/get-ready.ts:17`, `apps/web/src/test/fixtures/booking.ts` (`makeTourData`, ~dòng 129)
- Create: `apps/web/src/lib/print/print-ticket.ts`, `apps/web/src/lib/print/print-ticket.spec.ts`

**Interfaces:**
- Consumes: `DocStampTone` (Task 4); `calendarDateParts`, `formatDate`, `formatTicketDate`
  (`@/lib/tours`); `vietnamDay`, `BookingViewTone` (`@/lib/booking-vm`); `cloudinaryLoader` (default
  export `@/lib/cloudinary-loader`).
- Produces: các kiểu ở "Giao diện dùng chung"; hàm `stampTone`, `ticketDate`, `ticketCells`,
  `printPhoto`, `capList`, `textColumn`, `referenceColumn`; hằng `PRINT_PHOTO_WIDTH = 1400`,
  `MAX_LIST_ITEMS = 6`.

- [ ] **Step 1: `BookingTourData` thêm `included`** — `get-ready.ts:17` thành
  `export type BookingTourData = Pick<TourDetailVM, 'excluded' | 'included' | 'meetingPoint' | 'itinerary'>;`
  và sửa comment ngay trên cho đủ ("… mục gồm và không gồm, điểm hẹn, lịch trình — bản in voucher G40
  đọc thêm mục gồm"). `makeTourData` thêm mặc định ngay trước `excluded`:
  `included: ['English-speaking guide', 'Entrance tickets'],`. Chạy `pnpm --filter @tourism/web typecheck`
  — phải xanh.

- [ ] **Step 2: Viết test đỏ** `print-ticket.spec.ts`:

```ts
import type { MediaItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  capList,
  printPhoto,
  referenceColumn,
  stampTone,
  textColumn,
  ticketCells,
  ticketDate,
} from './print-ticket';

describe('stampTone — mộc in đổi tông (G32)', () => {
  it('success thành confirmed, warning thành pending, còn lại muted', () => {
    expect(stampTone('success')).toBe('confirmed');
    expect(stampTone('warning')).toBe('pending');
    expect(stampTone('muted')).toBe('muted');
    expect(stampTone('destructive')).toBe('muted');
  });
});

describe('ticketDate — ngày lớn và dòng phụ của vé', () => {
  it('"29 OCT" và "Thu · 2026"', () => {
    expect(ticketDate('2026-10-29')).toEqual({ big: '29 OCT', sub: 'Thu · 2026' });
  });

  it('có giờ hẹn thì nối vào dòng phụ', () => {
    expect(ticketDate('2026-10-29', 'meet 15:30')).toEqual({
      big: '29 OCT',
      sub: 'Thu · 2026 · meet 15:30',
    });
  });
});

describe('ticketCells — bốn ô của vé', () => {
  it('Lead traveller · Travellers · Booked (ngày lịch VN) · ô cuối của nơi gọi', () => {
    const booking = makeBooking({
      contactName: 'Nora Dahl',
      numAdults: 2,
      numChildren: 1,
      createdAt: '2026-10-08T19:30:00.000Z', // 02:30 ngày 9/10 giờ Việt Nam
    });
    expect(ticketCells(booking, { label: 'Payment', value: 'PayPal' })).toEqual([
      { label: messages.bookingDetail.leadTraveller, value: 'Nora Dahl' },
      { label: messages.passportVisa.labels.travellers, value: messages.accountBookings.travellers(2, 1) },
      { label: messages.bookingDetail.booked, value: '9 Oct 2026' },
      { label: 'Payment', value: 'PayPal' },
    ]);
  });
});

describe('capList — tối đa 6 dòng mỗi cột', () => {
  const more = (n: number) => `+${n} more`;
  it('rỗng thì null — bỏ cột', () => {
    expect(capList([], more)).toBeNull();
  });
  it('6 mục giữ nguyên', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(capList(items, more)).toEqual({ items, more: null });
  });
  it('7 mục thì 5 mục và "+2 more"', () => {
    expect(capList(['a', 'b', 'c', 'd', 'e', 'f', 'g'], more)).toEqual({
      items: ['a', 'b', 'c', 'd', 'e'],
      more: '+2 more',
    });
  });
});

describe('cột của dải cuối', () => {
  it('textColumn chỉ có chữ thường; referenceColumn mang mã ở dòng riêng', () => {
    expect(textColumn('Payment', 'Paid.')).toEqual({
      heading: 'Payment',
      strong: null,
      text: 'Paid.',
      reference: false,
    });
    expect(referenceColumn('BK-EET0JBTH', 'Booked by a@b.co')).toEqual({
      heading: messages.booking.success.refLabel,
      strong: 'BK-EET0JBTH',
      text: 'Booked by a@b.co',
      reference: true,
    });
  });
});

describe('printPhoto — ảnh bìa in', () => {
  const IMAGE: MediaItem = {
    publicId: 'tourism/catalog/tour/hoi-an/hero',
    url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tourism/catalog/tour/hoi-an/hero',
    type: 'IMAGE',
    role: 'hero',
    posterUrl: null,
    width: 1600,
    height: 900,
    alt: 'Lantern street at dusk',
    sortOrder: 0,
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
  };

  it('không ảnh thì null', () => {
    expect(printPhoto(null)).toBeNull();
  });

  it('ảnh Cloudinary xin bề rộng 1400, giữ alt', () => {
    const photo = printPhoto(IMAGE);
    expect(photo?.alt).toBe('Lantern street at dusk');
    expect(photo?.url).toContain('w_1400');
  });

  it('alt trống thì chuỗi rỗng — ảnh trang trí', () => {
    expect(printPhoto({ ...IMAGE, alt: null })?.alt).toBe('');
  });
});
```

  (`MediaItem` export từ `@tourism/contract` — `libs/shared/contract/src/schemas/media.ts`.)

- [ ] **Step 3: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/web exec vitest run src/lib/print/print-ticket.spec.ts --maxWorkers=2`.

- [ ] **Step 4: Viết `print-ticket.ts`**:

```ts
import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { DocStampTone } from '@tourism/ui/components/print-doc/doc-stamp';
import { type BookingViewTone, vietnamDay } from '@/lib/booking-vm';
import cloudinaryLoader from '@/lib/cloudinary-loader';
import { calendarDateParts, formatDate, formatTicketDate } from '@/lib/tours';

/**
 * Kiểu và helper dùng chung của tài liệu in khách (G40, spec §3–§4): tấm vé có cuống của voucher
 * (5b) và tấm vé "chờ" của hoá đơn (B1) là MỘT hình, khác tông. View-model ghép sẵn mọi chuỗi;
 * component chỉ vẽ.
 */
export type PrintTicketTone = 'active' | 'pending' | 'closed';

export interface PrintTicketDate {
  big: string;
  sub: string;
}

export interface PrintTicketCell {
  label: string;
  value: string;
}

export interface PrintTicketStub {
  band: string;
  tag: string | null;
  amountLabel: string | null;
  amount: string;
  note: string;
  /** Mã để vẽ mã vạch và in bên dưới; `null` là không mã vạch (đơn chưa trả, đã đi, đã huỷ). */
  barcode: string | null;
  footer: { label: string; value: string | null } | null;
}

export interface PrintTicketView {
  tone: PrintTicketTone;
  bandStart: string;
  bandEnd: string;
  title: string;
  stamp: { label: string; tone: DocStampTone };
  departs: PrintTicketDate;
  returns: PrintTicketDate;
  routeLine: string;
  cells: PrintTicketCell[];
  stub: PrintTicketStub;
  /** Dải hết hiệu lực thay thân vé (voucher đã huỷ); `null` là vé còn thân. */
  notice: string | null;
}

/**
 * Một cột của dải cuối. Cột thường: phần đậm (điểm hẹn) rồi phần thường, nối " · ". Cột mã đơn
 * (`reference`): mã mono ở dòng riêng, dòng phụ mờ bên dưới.
 */
export interface PrintColumn {
  heading: string;
  strong: string | null;
  text: string | null;
  reference: boolean;
}

export interface PrintList {
  items: string[];
  more: string | null;
}

export interface PrintPhoto {
  url: string;
  alt: string;
}

/** Bề rộng ảnh bìa xin Cloudinary: đủ nét cho 180 mm in, không nặng hơn cần (spec §12). */
export const PRINT_PHOTO_WIDTH = 1400;
/** Số dòng tối đa của một cột Included / Not included (spec §3.4). */
export const MAX_LIST_ITEMS = 6;

/** Tông mộc in (quyết định 5 của plan): xanh lá `success` đổi sang teal — G32. */
export function stampTone(tone: BookingViewTone): DocStampTone {
  switch (tone) {
    case 'success':
      return 'confirmed';
    case 'warning':
      return 'pending';
    case 'muted':
    case 'destructive':
      return 'muted';
  }
}

/** Ngày lớn "29 OCT" và dòng phụ "Thu · 2026" (thêm "· meet 15:30" khi có giờ hẹn). */
export function ticketDate(date: string, extra: string | null = null): PrintTicketDate {
  const { weekday, year } = calendarDateParts(date);
  const sub = `${weekday} · ${year}`;
  return { big: formatTicketDate(date), sub: extra === null ? sub : `${sub} · ${extra}` };
}

/** Bốn ô của vé: ba ô chung, ô cuối do nơi gọi (Paid with của voucher, Payment của hoá đơn). */
export function ticketCells(
  booking: Pick<Booking, 'contactName' | 'numAdults' | 'numChildren' | 'createdAt'>,
  last: PrintTicketCell,
): PrintTicketCell[] {
  return [
    { label: messages.bookingDetail.leadTraveller, value: booking.contactName },
    {
      label: messages.passportVisa.labels.travellers,
      value: messages.accountBookings.travellers(booking.numAdults, booking.numChildren),
    },
    { label: messages.bookingDetail.booked, value: formatDate(vietnamDay(booking.createdAt)) },
    last,
  ];
}

export function printPhoto(image: Booking['tourImage']): PrintPhoto | null {
  if (image === null) return null;
  return {
    url: cloudinaryLoader({ src: image.url, width: PRINT_PHOTO_WIDTH }),
    alt: image.alt ?? '',
  };
}

/** Tối đa 6 dòng một cột; hơn thì 5 mục và "+n more" để giữ một trang. Rỗng thì bỏ cột. */
export function capList(items: string[], more: (n: number) => string): PrintList | null {
  if (items.length === 0) return null;
  if (items.length <= MAX_LIST_ITEMS) return { items, more: null };
  const keep = MAX_LIST_ITEMS - 1;
  return { items: items.slice(0, keep), more: more(items.length - keep) };
}

export function textColumn(heading: string, text: string): PrintColumn {
  return { heading, strong: null, text, reference: false };
}

/** Cột "Booking reference": mã đơn và một dòng phụ tuỳ chọn ("Booked by …"). */
export function referenceColumn(code: string, sub: string | null): PrintColumn {
  return { heading: messages.booking.success.refLabel, strong: code, text: sub, reference: true };
}
```

- [ ] **Step 5: Chạy, thấy XANH.**
- [ ] **Step 6: Thử đột biến** — đổi `MAX_LIST_ITEMS - 1` thành `MAX_LIST_ITEMS`, thấy ca 7 mục đỏ; đổi
  `vietnamDay(booking.createdAt)` thành `booking.createdAt.slice(0, 10)`, thấy ca ticketCells đỏ
  ("8 Oct 2026"); trả lại.
- [ ] **Step 7: Commit**

```bash
pnpm exec biome check --write apps/web/src/lib/get-ready.ts apps/web/src/test/fixtures/booking.ts apps/web/src/lib/print/print-ticket.ts apps/web/src/lib/print/print-ticket.spec.ts
git add apps/web/src/lib/get-ready.ts apps/web/src/test/fixtures/booking.ts apps/web/src/lib/print/print-ticket.ts apps/web/src/lib/print/print-ticket.spec.ts
git commit -m "feat(web): helper vé in dùng chung và dữ liệu tour thêm mục bao gồm"
```

---

### Task 6: View-model voucher in (`voucherPrintView`)

**Files:**
- Create: `apps/web/src/lib/print/voucher-print.ts`, `apps/web/src/lib/print/voucher-print.spec.ts`

**Interfaces:**
- Consumes: Task 5 (`print-ticket.ts`); `VoucherView` (`@/lib/voucher`); `bookingPhase`,
  `tripDayNumbers`, `vietnamToday`, `BookingDetail`, `BookingPhase` (`@tourism/contract`);
  `bookingTotalLabel`, `cancellationDeadlineText`, `operatorRefundPending`, `refundSentence`,
  `refundSummary` (`@/lib/booking-vm`); `formatBookingMoney` (`@/lib/checkout`); `BookingTourData`,
  `tourMeetingPoint` (`@/lib/get-ready`); `parseItineraryStops` (`@/lib/tour-detail`);
  `formatMoneyExact`, `formatWeekdayDate` (`@/lib/tours`).
- Produces: `voucherPrintView`, `VoucherPrintView`, `PrintStop`, `MAX_STOPS = 10`,
  `MAX_DAY_LINES = 8`, `LONG_TITLE_CHARS = 56`.

**Luật (spec §3.1–§3.4, quyết định 11–17):**
- Chỉ giai đoạn `upcoming` và `on_tour` mới đọc `tour`: lịch trình, Included, Not included, giờ hẹn,
  ô Where to meet. Voucher đã đi, đã huỷ bỏ hết các khối ấy kể cả khi được truyền tour.
- Lịch trình: `on_tour` → ngày đang đi (`tripDayNumbers(…).dayOfTrip`), tiêu đề `yourDay`; `upcoming`
  một ngày → ngày 1; `upcoming` nhiều ngày → `yourTrip(days)`, mỗi ngày một dòng `dayLine`, giờ
  `null`; quá 8 dòng thì 7 dòng và `moreDays(N − 7, slug)`. Mục giờ quá 10 thì 9 mục và `…`.
- Dải cuối: sắp đi, đang đi → Where to meet · Cancellation (bỏ khi không có câu) · Payment; đã đi →
  Payment · Booking reference; đã huỷ → Refund (bỏ khi không có câu) · Payment.

- [ ] **Step 1: Viết test đỏ** `voucher-print.spec.ts`:

```ts
import type { BookingDetail, MediaItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import type { BookingTourData } from '@/lib/get-ready';
import { voucherView } from '@/lib/voucher';
import { makeTourData } from '@/test/fixtures/booking';
import {
  CANCELLED_AFTER_PAYING,
  THREE_DAY_TRIP,
  VOUCHER_NOW,
  voucherBooking,
  voucherNowOn,
} from '@/test/fixtures/voucher';
import { voucherPrintView } from './voucher-print';

const p = messages.printDoc.voucher;

/** Đơn của `voucherBooking` (Hà Nội một ngày 3/11, 3 người lớn × $49, PayPal 18/10) → bản in. */
function printOf(
  overrides: Partial<BookingDetail> = {},
  tour: BookingTourData | null = makeTourData(),
  now: Date = VOUCHER_NOW,
) {
  const booking = voucherBooking(overrides);
  const view = voucherView(booking, now);
  if (view === null) throw new Error('fixture phải là đơn đã trả');
  return voucherPrintView(booking, view, tour, now);
}

const DAY_ONE = makeTourData({
  itinerary: [
    {
      dayNumber: 1,
      title: 'Temples and the Old Quarter',
      description: '08:00 — Hotel pickup\n09:30 — Temple of Literature\nFree time by the lake',
    },
  ],
  included: ['English-speaking guide', 'Entrance tickets'],
  excluded: ['Tips'],
});

describe('voucherPrintView — sắp đi, chuyến một ngày', () => {
  const v = printOf({}, DAY_ONE);

  it('bìa: mốc trả, kicker có thứ ngày năm, tên tour', () => {
    expect(v.issued).toBe(p.issued('18 Oct 2026'));
    expect(v.kicker).toBe('Hà Nội · 1 day · Tue 3 Nov 2026');
    expect(v.title).toBe('Hanoi Heritage in a Day');
    expect(v.longTitle).toBe(false);
    expect(v.photo).toBeNull();
  });

  it('vé: giờ hẹn ở ngày đi, đường nối, mộc teal, cuống có mã vạch', () => {
    expect(v.ticket.tone).toBe('active');
    expect(v.ticket.bandStart).toBe(messages.passportVisa.kicker);
    expect(v.ticket.bandEnd).toBe('BK-B6VCOQNW');
    expect(v.ticket.departs).toEqual({ big: '3 NOV', sub: 'Tue · 2026 · meet 08:00' });
    expect(v.ticket.returns).toEqual({ big: '3 NOV', sub: 'Tue · 2026' });
    expect(v.ticket.routeLine).toBe('1 day · Hà Nội');
    expect(v.ticket.stamp).toEqual({
      label: messages.passportVisa.stampByStatus.PAID,
      tone: 'confirmed',
    });
    expect(v.ticket.cells.at(-1)).toEqual({
      label: messages.bookingDetail.ticket.paidWith,
      value: messages.booking.form.paypal,
    });
    expect(v.ticket.stub).toEqual({
      band: messages.bookingDetail.ticket.admit(3),
      tag: null,
      amountLabel: messages.booking.success.totalLabel,
      amount: '$147',
      note: messages.bookingDetail.ticket.taxesIncluded,
      barcode: 'BK-B6VCOQNW',
      footer: null,
    });
    expect(v.ticket.notice).toBeNull();
    expect(v.tear).toBe(p.tear);
  });

  it('lịch trình ngày 1: tách giờ, dòng không giờ in nguyên văn; Included và Not included', () => {
    expect(v.day).toEqual({
      heading: p.yourDay('Temples and the Old Quarter'),
      stops: [
        { time: '08:00', text: 'Hotel pickup' },
        { time: '09:30', text: 'Temple of Literature' },
        { time: null, text: 'Free time by the lake' },
      ],
      more: null,
    });
    expect(v.included).toEqual({ items: ['English-speaking guide', 'Entrance tickets'], more: null });
    expect(v.excluded).toEqual({ items: ['Tips'], more: null });
  });

  it('dải cuối: Where to meet có giờ, Cancellation, Payment kèm test mode', () => {
    expect(v.band.map((c) => c.heading)).toEqual([
      p.whereToMeet,
      messages.bookingDetail.details.cancellation,
      messages.booking.success.paymentLabel,
    ]);
    expect(v.band[0]).toEqual({
      heading: p.whereToMeet,
      strong: DAY_ONE.meetingPoint,
      text: p.meetGuide('08:00'),
      reference: false,
    });
    expect(v.band[2]?.text).toBe(
      `${p.paymentLine('$147.00', messages.booking.form.paypal, '18 Oct 2026')} ${messages.tourDetail.booking.testMode}`,
    );
  });
});

describe('voucherPrintView — lịch trình dài', () => {
  const days = (n: number, description: string | null = null) =>
    makeTourData({
      itinerary: Array.from({ length: n }, (_, i) => ({
        dayNumber: i + 1,
        title: `Stop ${i + 1}`,
        description,
      })),
    });

  it('chuyến nhiều ngày: một dòng mỗi ngày; kicker vẫn là ngày đi có thứ', () => {
    const v = printOf(THREE_DAY_TRIP, days(3));
    expect(v.kicker).toBe('Hà Nội · 3 days · Tue 3 Nov 2026');
    expect(v.day?.heading).toBe(p.yourTrip('3 days'));
    expect(v.day?.stops).toEqual([
      { time: null, text: p.dayLine(1, 'Stop 1') },
      { time: null, text: p.dayLine(2, 'Stop 2') },
      { time: null, text: p.dayLine(3, 'Stop 3') },
    ]);
  });

  it('8 ngày in đủ 8 dòng; 12 ngày in 7 dòng và "+5 more days"', () => {
    const eight = printOf({ departureStartDate: '2026-11-03', departureEndDate: '2026-11-10' }, days(8));
    expect(eight.day?.stops).toHaveLength(8);
    expect(eight.day?.more).toBeNull();
    const twelve = printOf({ departureStartDate: '2026-11-03', departureEndDate: '2026-11-14' }, days(12));
    expect(twelve.day?.stops).toHaveLength(7);
    expect(twelve.day?.more).toBe(p.moreDays(5, 'hanoi-heritage-day'));
  });

  it('một ngày 12 mục giờ: 9 mục và "…"', () => {
    const description = Array.from(
      { length: 12 },
      (_, i) => `${String(8 + i).padStart(2, '0')}:00 — Stop ${i}`,
    ).join('\n');
    const v = printOf({}, makeTourData({ itinerary: [{ dayNumber: 1, title: 'Long day', description }] }));
    expect(v.day?.stops).toHaveLength(9);
    expect(v.day?.more).toBe('…');
  });

  it('7 mục gồm: 5 mục và "+2 more"', () => {
    const v = printOf({}, makeTourData({ included: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }));
    expect(v.included).toEqual({ items: ['a', 'b', 'c', 'd', 'e'], more: p.moreItems(2) });
  });

  it('tên tour dài hơn 56 ký tự thì cỡ nhỏ', () => {
    expect(printOf({ tourTitle: 'x'.repeat(56) }).longTitle).toBe(false);
    expect(printOf({ tourTitle: 'x'.repeat(57) }).longTitle).toBe(true);
  });
});

describe('voucherPrintView — theo giai đoạn', () => {
  it('đang đi: lịch trình là ngày đang đi, vẫn có mã vạch', () => {
    const tour = makeTourData({
      itinerary: [1, 2, 3].map((n) => ({
        dayNumber: n,
        title: `Stop ${n}`,
        description: `09:00 — Day ${n}`,
      })),
    });
    const v = printOf(THREE_DAY_TRIP, tour, voucherNowOn('2026-11-04'));
    expect(v.day).toEqual({
      heading: p.yourDay('Stop 2'),
      stops: [{ time: '09:00', text: 'Day 2' }],
      more: null,
    });
    expect(v.ticket.stub.barcode).toBe('BK-B6VCOQNW');
  });

  it('đã đi: không mã vạch, dòng xé, lịch trình, mục gồm; dải Payment và Booking reference', () => {
    const v = printOf({}, DAY_ONE, voucherNowOn('2026-11-10'));
    expect(v.ticket.stub.barcode).toBeNull();
    expect(v.tear).toBeNull();
    expect(v.day).toBeNull();
    expect(v.included).toBeNull();
    expect(v.excluded).toBeNull();
    expect(v.ticket.departs.sub).toBe('Tue · 2026');
    expect(v.band.map((c) => c.heading)).toEqual([
      messages.booking.success.paymentLabel,
      messages.booking.success.refLabel,
    ]);
    expect(v.band[1]).toEqual({
      heading: messages.booking.success.refLabel,
      strong: 'BK-B6VCOQNW',
      text: null,
      reference: true,
    });
  });

  it('đã huỷ: vé tông closed, thân vé là dải hết hiệu lực; dải Refund và Payment', () => {
    const v = printOf(CANCELLED_AFTER_PAYING, DAY_ONE);
    expect(v.ticket.tone).toBe('closed');
    expect(v.ticket.notice).toBe(messages.voucher.cancelledNotice);
    expect(v.ticket.stub.barcode).toBeNull();
    expect(v.tear).toBeNull();
    expect(v.day).toBeNull();
    expect(v.band.map((c) => c.heading)).toEqual([
      messages.voucher.journal.refund,
      messages.booking.success.paymentLabel,
    ]);
    expect(v.band[0]?.text).toBe(messages.accountBookingDetail.refundLine.none);
  });
});

describe('voucherPrintView — thiếu dữ liệu', () => {
  it('không có tour: bỏ lịch trình và mục gồm, Where to meet dùng câu dự phòng sẵn có', () => {
    const v = printOf({}, null);
    expect(v.day).toBeNull();
    expect(v.included).toBeNull();
    expect(v.excluded).toBeNull();
    expect(v.ticket.departs.sub).toBe('Tue · 2026');
    expect(v.band[0]).toEqual({
      heading: p.whereToMeet,
      strong: null,
      text: `${messages.voucher.meetingPointContact} ${messages.voucher.meetingPointFallback}`,
      reference: false,
    });
  });

  it('mục đầu ngày 1 không có giờ: không "meet", Where to meet chỉ có điểm hẹn', () => {
    const v = printOf(
      {},
      makeTourData({
        itinerary: [{ dayNumber: 1, title: 'Free day', description: 'Explore at your pace' }],
      }),
    );
    expect(v.ticket.departs.sub).toBe('Tue · 2026');
    expect(v.band[0]?.strong).toBe(makeTourData().meetingPoint);
    expect(v.band[0]?.text).toBeNull();
  });

  it('có ảnh tour thì bìa có ảnh rộng 1400', () => {
    const image: MediaItem = {
      publicId: 'tourism/catalog/tour/hanoi/hero',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tourism/catalog/tour/hanoi/hero',
      type: 'IMAGE',
      role: 'hero',
      posterUrl: null,
      width: 1600,
      height: 900,
      alt: 'Temple of Literature',
      sortOrder: 0,
      author: null,
      license: null,
      licenseUrl: null,
      sourceUrl: null,
    };
    expect(printOf({ tourImage: image }).photo).toEqual({
      url: expect.stringContaining('w_1400'),
      alt: 'Temple of Literature',
    });
  });
});
```

  Số kỳ vọng ("18 Oct 2026", "$147", "$147.00", "Admit 3", mã đơn, giờ VN) suy từ fixture
  `voucherBooking` sẵn có. Lệch thì đối chiếu fixture rồi sửa KỲ VỌNG cho khớp fixture — không sửa mã
  cho khớp con số đoán, và ghi lại trong báo cáo task.

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/web exec vitest run src/lib/print/voucher-print.spec.ts --maxWorkers=2`.

- [ ] **Step 3: Viết `voucher-print.ts`**:

```ts
import {
  type BookingDetail,
  type BookingPhase,
  bookingPhase,
  tripDayNumbers,
  vietnamToday,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  bookingTotalLabel,
  cancellationDeadlineText,
  operatorRefundPending,
  refundSentence,
  refundSummary,
} from '@/lib/booking-vm';
import { formatBookingMoney } from '@/lib/checkout';
import { type BookingTourData, tourMeetingPoint } from '@/lib/get-ready';
import { parseItineraryStops } from '@/lib/tour-detail';
import { formatMoneyExact, formatWeekdayDate } from '@/lib/tours';
import type { VoucherView } from '@/lib/voucher';
import {
  capList,
  type PrintColumn,
  type PrintList,
  type PrintPhoto,
  type PrintTicketView,
  printPhoto,
  referenceColumn,
  stampTone,
  textColumn,
  ticketCells,
  ticketDate,
} from './print-ticket';

/** Một mục của lịch trình in — cùng hình kết quả `parseItineraryStops`. */
export interface PrintStop {
  time: string | null;
  text: string;
}

/**
 * Voucher in — phương án 5b (G40, spec §3). MỘT nguồn với voucher màn hình (`VoucherView`) cho mộc,
 * mã vạch, dải hết hiệu lực, ngày trả, cổng thanh toán; thêm lịch trình, mục gồm và dải cuối theo giai
 * đoạn. Mọi luật cắt (spec §3.4) nằm ở đây để tờ giấy luôn vừa một trang A4.
 */
export interface VoucherPrintView {
  photo: PrintPhoto | null;
  issued: string;
  kicker: string;
  title: string;
  /** Tên dài hơn `LONG_TITLE_CHARS`: bìa in cỡ nhỏ để vẫn vừa hai dòng. */
  longTitle: boolean;
  ticket: PrintTicketView;
  tear: string | null;
  day: { heading: string; stops: PrintStop[]; more: string | null } | null;
  included: PrintList | null;
  excluded: PrintList | null;
  band: PrintColumn[];
}

/** Một ngày: tối đa 10 mục (spec §3.4). */
export const MAX_STOPS = 10;
/** Nhiều ngày: tối đa 8 dòng — hai cột × bốn (spec §3.4). */
export const MAX_DAY_LINES = 8;
/** Ngưỡng ký tự của tên tour cỡ 27 pt trên hai dòng (quyết định 13 của plan). */
export const LONG_TITLE_CHARS = 56;

export function voucherPrintView(
  booking: BookingDetail,
  view: VoucherView,
  tour: BookingTourData | null,
  now: Date,
): VoucherPrintView {
  const t = messages.printDoc.voucher;
  const today = vietnamToday(now);
  const phase = bookingPhase(booking, today);
  // Chỉ hai giai đoạn này có ô Meeting point, nên trang chỉ đọc tour ở đó (`voucherTourData`);
  // chặn lại ở đây để tour truyền nhầm cũng không làm voucher đã đi, đã huỷ in lịch trình.
  const live = phase === 'upcoming' || phase === 'on_tour';
  const liveTour = live ? tour : null;
  const days = messages.bookingDetail.ticket.days(view.tripDays);
  const firstDay = liveTour?.itinerary.find((day) => day.dayNumber === 1) ?? null;
  const meetTime =
    firstDay === null ? null : (parseItineraryStops(firstDay.description)[0]?.time ?? null);
  const dayOfTrip = phase === 'on_tour' ? tripDayNumbers(booking, today).dayOfTrip : null;

  return {
    photo: printPhoto(booking.tourImage),
    issued: t.issued(view.paidOn),
    kicker: messages.printDoc.kicker(
      view.place,
      days,
      formatWeekdayDate(booking.departureStartDate, { year: true }),
    ),
    title: booking.tourTitle,
    longTitle: booking.tourTitle.length > LONG_TITLE_CHARS,
    ticket: {
      tone: view.cancelledNotice === null ? 'active' : 'closed',
      bandStart: messages.passportVisa.kicker,
      bandEnd: booking.code,
      title: booking.tourTitle,
      stamp: { label: view.stamp.label, tone: stampTone(view.stamp.tone) },
      departs: ticketDate(booking.departureStartDate, meetTime === null ? null : t.meet(meetTime)),
      returns: ticketDate(booking.departureEndDate),
      routeLine: messages.printDoc.routeLine(days, view.place),
      cells: ticketCells(booking, {
        label: messages.bookingDetail.ticket.paidWith,
        value: view.provider,
      }),
      stub: {
        band: messages.bookingDetail.ticket.admit(booking.numAdults + booking.numChildren),
        tag: null,
        amountLabel: bookingTotalLabel(booking),
        amount: formatBookingMoney(booking, booking.totalAmount),
        note: messages.bookingDetail.ticket.taxesIncluded,
        barcode: view.showBarcode ? booking.code : null,
        footer: null,
      },
      notice: view.cancelledNotice,
    },
    tear: view.showBarcode ? t.tear : null,
    day: daySection(booking, view, liveTour, dayOfTrip),
    included: liveTour === null ? null : capList(liveTour.included, t.moreItems),
    excluded: liveTour === null ? null : capList(liveTour.excluded, t.moreItems),
    band: bandColumns(booking, view, phase, liveTour, meetTime),
  };
}

/** Lịch trình in (spec §3.4): ngày đang đi, ngày 1 của chuyến một ngày, hay danh sách ngày. */
function daySection(
  booking: BookingDetail,
  view: VoucherView,
  tour: BookingTourData | null,
  dayOfTrip: number | null,
): VoucherPrintView['day'] {
  const t = messages.printDoc.voucher;
  if (tour === null || tour.itinerary.length === 0) return null;

  if (dayOfTrip !== null || view.tripDays === 1) {
    const day = tour.itinerary.find((d) => d.dayNumber === (dayOfTrip ?? 1));
    if (!day) return null;
    const stops = parseItineraryStops(day.description);
    return stops.length <= MAX_STOPS
      ? { heading: t.yourDay(day.title), stops, more: null }
      : { heading: t.yourDay(day.title), stops: stops.slice(0, MAX_STOPS - 1), more: '…' };
  }

  const heading = t.yourTrip(messages.bookingDetail.ticket.days(view.tripDays));
  const lines: PrintStop[] = [...tour.itinerary]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => ({ time: null, text: t.dayLine(d.dayNumber, d.title) }));
  if (lines.length <= MAX_DAY_LINES) return { heading, stops: lines, more: null };
  const keep = MAX_DAY_LINES - 1;
  return {
    heading,
    stops: lines.slice(0, keep),
    more: t.moreDays(lines.length - keep, booking.tourSlug),
  };
}

/** Dải cuối theo giai đoạn (spec §3.3); cột không có dữ liệu thì bỏ (quyết định 17 của plan). */
function bandColumns(
  booking: BookingDetail,
  view: VoucherView,
  phase: BookingPhase,
  tour: BookingTourData | null,
  meetTime: string | null,
): PrintColumn[] {
  const t = messages.printDoc.voucher;
  const payment = textColumn(
    messages.booking.success.paymentLabel,
    `${t.paymentLine(formatMoneyExact(booking.totalAmount, booking.currency), view.provider, view.paidOn)} ${messages.tourDetail.booking.testMode}`,
  );

  if (phase === 'upcoming' || phase === 'on_tour') {
    const point = tourMeetingPoint(tour);
    const meet: PrintColumn =
      point === null
        ? textColumn(
            t.whereToMeet,
            `${messages.voucher.meetingPointContact} ${messages.voucher.meetingPointFallback}`,
          )
        : {
            heading: t.whereToMeet,
            strong: point,
            text: meetTime === null ? null : t.meetGuide(meetTime),
            reference: false,
          };
    const deadline = cancellationDeadlineText(booking.cancellation);
    return deadline === null
      ? [meet, payment]
      : [meet, textColumn(messages.bookingDetail.details.cancellation, deadline), payment];
  }

  if (phase === 'cancelled') {
    // Cùng chuyện tiền với mốc Refund của nhật ký voucher (`refundJournal` ở `lib/voucher.ts`).
    const summary = refundSummary(booking);
    const refund = operatorRefundPending(booking)
      ? messages.bookingDetail.closed.refundOnItsWay
      : summary === null
        ? null
        : refundSentence(summary, booking.currency);
    return refund === null
      ? [payment]
      : [textColumn(messages.voucher.journal.refund, refund), payment];
  }

  // Đã đi. (`awaiting_payment`, `lapsed` không tới đây: `voucherView` trả null cho đơn chưa trả.)
  return [payment, referenceColumn(booking.code, null)];
}
```

- [ ] **Step 4: Chạy, thấy XANH**; lệch kỳ vọng thì xử lý theo ghi chú cuối Step 1.
- [ ] **Step 5: Thử đột biến** — đổi `MAX_DAY_LINES - 1` thành `MAX_DAY_LINES`, thấy ca 12 ngày đỏ; đổi
  `live ? tour : null` thành `tour`, thấy ca "đã đi" đỏ; bỏ nhánh `deadline === null` (luôn ba cột),
  thấy typecheck hay ca test đỏ (ghi cái nào); trả lại.
- [ ] **Step 6: Typecheck** — `pnpm --filter @tourism/web typecheck`.
- [ ] **Step 7: Commit**

```bash
pnpm exec biome check --write apps/web/src/lib/print/voucher-print.ts apps/web/src/lib/print/voucher-print.spec.ts
git add apps/web/src/lib/print/voucher-print.ts apps/web/src/lib/print/voucher-print.spec.ts
git commit -m "feat(web): view-model voucher in theo giai đoạn, cắt lịch trình cho vừa một trang"
```

---

### Task 7: Các mảnh in dùng chung — thương hiệu, bìa ảnh, tấm vé, dòng xé, dải cuối

**Files:**
- Create: `apps/web/src/components/print/print-styles.ts`, `print-brand.tsx`, `photo-cover.tsx`,
  `print-ticket.tsx`, `print-tear.tsx`, `print-band.tsx`
- Test: `apps/web/src/components/print/print-ticket.spec.tsx`, `photo-cover.spec.tsx`, `print-band.spec.tsx`

**Interfaces:**
- Consumes: Task 4 (`DocLetterhead`, `DocStamp`), Task 5 (kiểu); `LOGO_MARK` (`@/components/logo`);
  `EMAIL`, `PHONE` (`@/lib/site`); `TicketBarcode` (`@/components/checkout/ticket-barcode`).
- Produces: `PRINT_LABEL`, `PRINT_SECTION`; `PrintBrand()` (thương hiệu trên bìa ảnh — hai tài liệu
  khách của Phần 1 đều mở bằng bìa ảnh, nên chưa có tông giấy); `PhotoCover({ photo, heightClass,
  titleClass, docType, meta, kicker, title })`; `PrintTicket({ view })`; `PrintTear({ text })`;
  `PrintBand({ columns, wideFirst?, className? })`.

Kích thước, màu theo CSS bản thảo: `.ticket`, `.t-band`, `.t-main` (lỗ đục `::before/::after`),
`.t-body`, `.t-title`, `.route`, `.route-line`, `.t-grid`, `.t-stub`, `.stub-body`, `.money`,
`.tiny`, `.barcode` (cao 12 mm), `.code`, `.tear`, `.band`, `.mag .hero` (lớp phủ
`55% → 5% ở 38% → 75%`), và phần B1 `.ticket.pending`, `.void`, `.not-yet`, `.payby`.

- [ ] **Step 1: Viết test đỏ** `print-ticket.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import type { PrintTicketView } from '@/lib/print/print-ticket';
import { PrintTicket } from './print-ticket';

const ACTIVE: PrintTicketView = {
  tone: 'active',
  bandStart: 'Entry · Tour booking',
  bandEnd: 'BK-EET0JBTH',
  title: 'Hội An Old Town & Lantern Evening',
  stamp: { label: 'CONFIRMED', tone: 'confirmed' },
  departs: { big: '29 OCT', sub: 'Thu · 2026 · meet 15:30' },
  returns: { big: '29 OCT', sub: 'Thu · 2026' },
  routeLine: '1 day · Hội An',
  cells: [
    { label: 'Lead traveller', value: 'Nora Dahl' },
    { label: 'Travellers', value: '1 adult' },
    { label: 'Booked', value: '9 Oct 2026' },
    { label: 'Paid with', value: 'Card (Stripe)' },
  ],
  stub: {
    band: 'Admit 1',
    tag: null,
    amountLabel: 'Total paid',
    amount: '$39',
    note: 'Taxes and fees included',
    barcode: 'BK-EET0JBTH',
    footer: null,
  },
  notice: null,
};

const ticket = (container: HTMLElement) => container.querySelector('[data-slot="print-ticket"]');

describe('PrintTicket', () => {
  it('vé còn hiệu lực: dải, tên, ngày, giờ hẹn, bốn ô, mộc, cuống có mã vạch và mã', () => {
    const { container } = render(<PrintTicket view={ACTIVE} />);
    expect(ticket(container)).toHaveAttribute('data-tone', 'active');
    expect(screen.getByText('Entry · Tour booking')).toBeInTheDocument();
    expect(screen.getByText('Hội An Old Town & Lantern Evening')).toBeInTheDocument();
    expect(screen.getByText(messages.bookingDetail.ticket.departs)).toBeInTheDocument();
    expect(screen.getByText('Thu · 2026 · meet 15:30')).toBeInTheDocument();
    expect(screen.getByText('1 day · Hội An')).toBeInTheDocument();
    expect(screen.getByText('Nora Dahl')).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="barcode"]')).not.toBeNull();
    expect(screen.getAllByText('BK-EET0JBTH')).toHaveLength(2); // dải và dưới mã vạch
  });

  it('vé chờ: viền đứt, nhãn "Not yet a voucher", hộp "Pay by", không mã vạch', () => {
    const view: PrintTicketView = {
      ...ACTIVE,
      tone: 'pending',
      stub: {
        ...ACTIVE.stub,
        band: 'Unpaid',
        tag: 'Not yet a voucher',
        amountLabel: null,
        barcode: null,
        footer: { label: 'Pay by', value: '19:04 · 9 Oct' },
      },
    };
    const { container } = render(<PrintTicket view={view} />);
    expect(ticket(container)).toHaveAttribute('data-tone', 'pending');
    expect(ticket(container)?.className).toContain('border-dashed');
    expect(screen.getByText('Not yet a voucher')).toBeInTheDocument();
    expect(screen.getByText('19:04 · 9 Oct')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
    expect(screen.getAllByText('BK-EET0JBTH')).toHaveLength(1); // chỉ ở dải
  });

  it('vé hết hiệu lực: dải thông báo thay thân vé', () => {
    const notice = 'This booking was cancelled — this voucher is no longer valid.';
    render(<PrintTicket view={{ ...ACTIVE, tone: 'closed', notice }} />);
    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.queryByText('Nora Dahl')).toBeNull();
    expect(screen.queryByText(messages.bookingDetail.ticket.departs)).toBeNull();
  });
});
```

- [ ] **Step 2: Viết test đỏ** `photo-cover.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { PhotoCover } from './photo-cover';

const COVER = {
  heightClass: 'h-[62mm]',
  titleClass: 'text-[27pt]',
  docType: 'Trip voucher',
  meta: 'Issued 9 Oct 2026',
  kicker: 'Hội An · 1 day · Thu 29 Oct 2026',
  title: 'Hội An Old Town & Lantern Evening',
};

describe('PhotoCover', () => {
  it('có ảnh: <img> tải ngay (in được khi tắt nền, không hoãn tải khi đang ẩn)', () => {
    const { container } = render(
      <PhotoCover {...COVER} photo={{ url: 'https://res.cloudinary.com/x.jpg', alt: 'Lanterns' }} />,
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('alt', 'Lanterns');
  });

  it('không ảnh: không <img> vỡ, nền hero', () => {
    const { container } = render(<PhotoCover {...COVER} photo={null} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-slot="print-cover"]')?.className).toContain('bg-hero');
  });

  it('tên tour là h2, kicker, đầu trang tông ảnh có thương hiệu và chỉ còn website', () => {
    const { container } = render(<PhotoCover {...COVER} photo={null} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(COVER.title);
    expect(screen.getByText(COVER.kicker)).toBeInTheDocument();
    const letterhead = container.querySelector('[data-slot="doc-letterhead"]');
    expect(letterhead).toHaveAttribute('data-tone', 'photo');
    expect(letterhead?.querySelector('[data-slot="print-brand"] svg')).not.toBeNull();
    expect(screen.getByText(messages.printDoc.website)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Viết test đỏ** `print-band.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PrintColumn } from '@/lib/print/print-ticket';
import { PrintBand } from './print-band';

const MEET: PrintColumn = {
  heading: 'Where to meet',
  strong: 'Ticket booth',
  text: 'meet your guide at 15:30.',
  reference: false,
};
const POLICY: PrintColumn = { heading: 'Cancellation', strong: null, text: 'Free until 28 Oct.', reference: false };
const REF: PrintColumn = { heading: 'Booking reference', strong: 'BK-EET0JBTH', text: 'Booked by a@b.co', reference: true };

const band = (container: HTMLElement) => container.querySelector('[data-slot="print-band"]');

describe('PrintBand', () => {
  it('cột thường: phần đậm rồi phần thường nối " · "', () => {
    render(<PrintBand columns={[MEET]} />);
    expect(screen.getByText('Ticket booth').tagName).toBe('B');
    expect(screen.getByText('Ticket booth').parentElement).toHaveTextContent(
      'Ticket booth · meet your guide at 15:30.',
    );
  });

  it('cột mã đơn: mã mono ở dòng riêng, dòng phụ bên dưới', () => {
    render(<PrintBand columns={[REF]} />);
    expect(screen.getByText('BK-EET0JBTH').className).toContain('font-mono');
    expect(screen.getByText('Booked by a@b.co').tagName).toBe('P');
  });

  it('ba cột: voucher cột đầu rộng hơn (5b), hoá đơn ba cột đều (B1); hai cột thì hai', () => {
    const { container, rerender } = render(<PrintBand columns={[MEET, POLICY, REF]} wideFirst />);
    expect(band(container)?.className).toContain('grid-cols-[1.15fr_1fr_1fr]');
    rerender(<PrintBand columns={[MEET, POLICY, REF]} />);
    expect(band(container)?.className).toContain('grid-cols-3');
    rerender(<PrintBand columns={[MEET, REF]} wideFirst />);
    expect(band(container)?.className).toContain('grid-cols-2');
  });
});
```

- [ ] **Step 4: Chạy, thấy ĐỎ** —
  `pnpm --filter @tourism/web exec vitest run src/components/print --maxWorkers=2` (ba spec mới đỏ vì
  thiếu module; `printed-at.spec.tsx` của Task 4 vẫn xanh).

- [ ] **Step 5: Viết `print-styles.ts`, `print-tear.tsx`, `print-band.tsx`**:

`print-styles.ts`
```ts
/**
 * Lớp chữ dùng lại trong tài liệu in (G40). Mono chỉ nạp 400/500 (`layout.tsx`) nên nhãn dùng
 * `font-medium`, không 600 như bản thảo — tránh đậm giả.
 */
export const PRINT_LABEL =
  'font-mono text-[6.8pt] font-medium tracking-[0.14em] text-muted-foreground uppercase';

/** Tiêu đề mục ("Your day …", "Included", "Summary"). */
export const PRINT_SECTION = 'font-heading text-[11pt] font-semibold';
```

`print-tear.tsx`
```tsx
/** Dòng xé giữa tấm vé và phần dưới (5b, B1): chữ giữa hai vạch đứt. */
export function PrintTear({ text }: { text: string }) {
  return (
    <p
      data-slot="print-tear"
      className="mt-[4mm] mb-[6mm] flex items-center gap-[3mm] text-[7.5pt] text-muted-foreground before:flex-1 before:border-t-[0.8pt] before:border-dashed before:border-border after:flex-1 after:border-t-[0.8pt] after:border-dashed after:border-border"
    >
      {text}
    </p>
  );
}
```

`print-band.tsx`
```tsx
import { cn } from '@tourism/ui/lib/utils';
import type { PrintColumn } from '@/lib/print/print-ticket';

/** Lưới cột của dải: voucher 5b cho cột đầu (điểm hẹn) rộng hơn; hoá đơn B1 ba cột đều. */
function gridCols(count: number, wideFirst: boolean): string {
  if (count >= 3) return wideFirst ? 'grid-cols-[1.15fr_1fr_1fr]' : 'grid-cols-3';
  return count === 2 ? 'grid-cols-2' : 'grid-cols-1';
}

/** Dải cuối nền `paper` (5b, B1). Cột mã đơn in mã mono ở dòng riêng (`PrintColumn.reference`). */
export function PrintBand({
  columns,
  wideFirst = false,
  className,
}: {
  columns: PrintColumn[];
  wideFirst?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="print-band"
      className={cn(
        'grid gap-[6mm] rounded-[2.5mm] bg-paper px-[5mm] py-[4mm]',
        gridCols(columns.length, wideFirst),
        className,
      )}
    >
      {columns.map((column) => (
        <div key={column.heading}>
          <h3 className="mb-[1mm] font-mono text-[6.8pt] font-medium tracking-[0.14em] text-primary-emphasis uppercase">
            {column.heading}
          </h3>
          {column.reference ? (
            <>
              <p className="font-mono font-medium">{column.strong}</p>
              {column.text ? <p className="text-muted-foreground">{column.text}</p> : null}
            </>
          ) : (
            <p>
              {column.strong ? <b className="font-semibold">{column.strong}</b> : null}
              {column.strong && column.text ? ' · ' : null}
              {column.text}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Viết `print-brand.tsx`, `photo-cover.tsx`**:

`print-brand.tsx`
```tsx
import { messages } from '@tourism/i18n';
import { LOGO_MARK } from '@/components/logo';

/**
 * Logo, wordmark và dòng liên hệ của đầu trang in trên ảnh bìa (G40, spec §2.2). Nằm trong scope
 * `dark` mà `DocLetterhead` tông `photo` gắn: viên sau và chữ "ora" theo `primary-emphasis` — ở scope
 * ấy là teal nhạt; viên trước, wordmark trắng `on-media`; dòng liên hệ chỉ còn website.
 */
export function PrintBrand() {
  return (
    <div data-slot="print-brand" className="flex items-center gap-[3mm]">
      <svg viewBox={LOGO_MARK.viewBox} aria-hidden="true" className="h-auto w-[11mm] shrink-0">
        <path className="fill-primary-emphasis" d={LOGO_MARK.back} />
        <path className="fill-on-media" d={LOGO_MARK.front} />
      </svg>
      <div>
        <p className="font-heading text-[17pt] leading-none font-semibold tracking-[-0.01em] text-on-media">
          Nex<span className="text-primary-emphasis">ora</span>
        </p>
        <p className="mt-[1.2mm] text-[7.5pt] text-on-media/80">{messages.printDoc.website}</p>
      </div>
    </div>
  );
}
```

`photo-cover.tsx`
```tsx
import { DocLetterhead } from '@tourism/ui/components/print-doc/doc-letterhead';
import { cn } from '@tourism/ui/lib/utils';
import type { PrintPhoto } from '@/lib/print/print-ticket';
import { PrintBrand } from './print-brand';

/**
 * Bìa ảnh của tài liệu in khách (5b, B1; ADR-0057 §4): ảnh tour, lớp phủ tối dần, đầu trang đảo
 * màu, kicker và tên tour ở đáy. Thiếu ảnh thì nền `hero`. Tên tour cắt ở hai dòng; cỡ chữ do nơi
 * gọi chọn (`titleClass`).
 */
export function PhotoCover({
  photo,
  heightClass,
  titleClass,
  docType,
  meta,
  kicker,
  title,
}: {
  photo: PrintPhoto | null;
  heightClass: string;
  titleClass: string;
  docType: string;
  meta: string;
  kicker: string;
  title: string;
}) {
  return (
    <div
      data-slot="print-cover"
      className={cn(
        'relative flex shrink-0 flex-col overflow-hidden rounded-[3mm] bg-hero px-[7mm] py-[6mm] text-on-media',
        heightClass,
      )}
    >
      {photo ? (
        // biome-ignore lint/performance/noImgElement: ảnh bìa in phải tải ngay cả khi tài liệu đang ẩn, và in được khi người in tắt "Background graphics" — next/image hoãn tải ảnh ngoài khung nhìn (ADR-0057 §4).
        <img
          src={photo.url}
          alt={photo.alt}
          loading="eager"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-b from-hero/55 via-hero/5 via-38% to-hero/75"
      />
      <DocLetterhead
        className="relative"
        tone="photo"
        brand={<PrintBrand />}
        docType={docType}
        meta={meta}
      />
      <div className="relative mt-auto">
        <p className="font-mono text-[6.8pt] font-medium tracking-[0.14em] text-on-media/85 uppercase">
          {kicker}
        </p>
        <h2
          className={cn(
            'mt-[2mm] line-clamp-2 font-heading leading-[1.1] font-semibold tracking-[-0.01em]',
            titleClass,
          )}
        >
          {title}
        </h2>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Viết `print-ticket.tsx`**:

```tsx
import { messages } from '@tourism/i18n';
import { DocStamp } from '@tourism/ui/components/print-doc/doc-stamp';
import { cn } from '@tourism/ui/lib/utils';
import { TicketBarcode } from '@/components/checkout/ticket-barcode';
import type {
  PrintTicketDate,
  PrintTicketStub,
  PrintTicketTone,
  PrintTicketView,
} from '@/lib/print/print-ticket';
import { PRINT_LABEL } from './print-styles';

/** Cuống gạch chéo của vé chờ, vé hết hiệu lực (B1): hai tông nền sáng của token. */
const STRIPES =
  'bg-[repeating-linear-gradient(135deg,var(--card)_0_2.2mm,var(--paper)_2.2mm_4.4mm)]';

/**
 * Màu theo tông vé: `active` là vé teal của voucher (5b); `pending` (hoá đơn chờ) và `closed` (đơn
 * đã đóng, voucher đã huỷ) là vé "chưa, hay không còn, hiệu lực" của B1 — viền đứt xám, dải xám,
 * cuống gạch chéo.
 */
const TONE: Record<PrintTicketTone, { frame: string; band: string; line: string; stub: string }> = {
  active: {
    frame: 'border-solid border-primary',
    band: 'bg-primary text-primary-foreground',
    line: 'border-primary',
    stub: '',
  },
  pending: {
    frame: 'border-dashed border-muted-foreground/60',
    band: 'bg-muted-foreground text-primary-foreground',
    line: 'border-muted-foreground/60',
    stub: STRIPES,
  },
  closed: {
    frame: 'border-dashed border-muted-foreground/60',
    band: 'bg-muted-foreground text-primary-foreground',
    line: 'border-muted-foreground/60',
    stub: STRIPES,
  },
};

const BAND = 'px-[5mm] py-[2.4mm] font-mono text-[7.5pt] font-medium tracking-[0.18em] uppercase';

/**
 * Tấm vé có cuống của tài liệu in (G40, spec §3.1 mục 2, §4.2 mục 2) — cùng hình tấm vé trang chi
 * tiết đơn. Cuống 52 mm; đường chấm cắt giữa thân và cuống; hai nửa lỗ đục ở hai đầu đường cắt
 * (`overflow-hidden` của vé cắt còn nửa).
 */
export function PrintTicket({ view }: { view: PrintTicketView }) {
  const tone = TONE[view.tone];
  return (
    <div
      data-slot="print-ticket"
      data-tone={view.tone}
      className={cn(
        'relative grid grid-cols-[1fr_52mm] overflow-hidden rounded-[3.5mm] border-[0.9pt] bg-background',
        tone.frame,
      )}
    >
      <div className={cn('relative border-r-[0.9pt] border-dashed', tone.line)}>
        <p className={cn('flex items-center justify-between', BAND, tone.band)}>
          <span>{view.bandStart}</span>
          <span>{view.bandEnd}</span>
        </p>
        {view.notice !== null ? (
          <p className="m-[5mm] rounded-[2mm] border-[0.8pt] border-dashed border-muted-foreground px-[4mm] py-[3mm] font-medium">
            {view.notice}
          </p>
        ) : (
          <div className="px-[6mm] pt-[3.5mm]">
            <div className="flex items-start justify-between gap-[5mm]">
              <p className="font-heading text-[14pt] leading-[1.2] font-semibold">{view.title}</p>
              <DocStamp label={view.stamp.label} tone={view.stamp.tone} />
            </div>
            <div className="my-[3mm] grid grid-cols-[auto_1fr_auto] items-center gap-[4mm]">
              <TicketDate label={messages.bookingDetail.ticket.departs} date={view.departs} />
              <p className="relative text-center text-[7.8pt] font-semibold text-primary-emphasis before:absolute before:inset-x-0 before:top-1/2 before:border-t-[0.8pt] before:border-dashed before:border-primary/40">
                <span className="relative bg-background px-[2.5mm]">{view.routeLine}</span>
              </p>
              <TicketDate label={messages.bookingDetail.ticket.returns} date={view.returns} end />
            </div>
            <dl className="-mx-[6mm] grid grid-cols-4 border-t-[0.6pt] border-border">
              {view.cells.map((cell, index) => (
                <div
                  key={cell.label}
                  className={cn(
                    'pt-[2.6mm] pb-[3mm]',
                    index === 0 ? 'pl-[6mm]' : 'border-l-[0.6pt] border-border pl-[3.5mm]',
                  )}
                >
                  <dt className={PRINT_LABEL}>{cell.label}</dt>
                  <dd className="mt-[0.8mm] font-semibold">{cell.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <span
          aria-hidden="true"
          className={cn(
            'absolute -top-[2.6mm] -right-[2.6mm] z-10 size-[4.6mm] rounded-full border-[0.9pt] bg-background',
            tone.line,
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'absolute -right-[2.6mm] -bottom-[2.6mm] z-10 size-[4.6mm] rounded-full border-[0.9pt] bg-background',
            tone.line,
          )}
        />
      </div>
      <Stub stub={view.stub} band={tone.band} background={tone.stub} />
    </div>
  );
}

function TicketDate({ label, date, end = false }: { label: string; date: PrintTicketDate; end?: boolean }) {
  return (
    <div className={end ? 'text-right' : undefined}>
      <p className={PRINT_LABEL}>{label}</p>
      <p className="mt-[1mm] font-mono text-[20pt] leading-none font-medium tracking-[0.02em]">
        {date.big}
      </p>
      <p className="mt-[1mm] text-[7.5pt] text-muted-foreground">{date.sub}</p>
    </div>
  );
}

function Stub({ stub, band, background }: { stub: PrintTicketStub; band: string; background: string }) {
  return (
    <div data-slot="print-ticket-stub" className={cn('flex flex-col', background)}>
      <p className={cn('text-center', BAND, band)}>{stub.band}</p>
      <div className="flex flex-1 flex-col px-[5mm] py-[4mm]">
        {stub.tag ? (
          <span className="self-start rounded-[1mm] border-[0.7pt] border-pending bg-background px-[1.8mm] py-[0.6mm] font-mono text-[7.5pt] font-medium tracking-[0.16em] text-pending uppercase">
            {stub.tag}
          </span>
        ) : null}
        {stub.amountLabel ? <p className={PRINT_LABEL}>{stub.amountLabel}</p> : null}
        <p className={cn('text-[20pt] leading-tight font-semibold', stub.tag ? 'mt-[2.5mm]' : 'mt-[0.5mm]')}>
          {stub.amount}
        </p>
        <p className="bg-background text-[7.3pt] text-muted-foreground">{stub.note}</p>
        {stub.barcode ? (
          <>
            <TicketBarcode code={stub.barcode} className="mt-auto h-[12mm] w-full" />
            <p className="mt-[1.5mm] text-center font-mono text-[8.5pt] font-medium tracking-[0.12em]">
              {stub.barcode}
            </p>
          </>
        ) : null}
        {stub.footer ? (
          <p className="mt-auto rounded-[1mm] bg-background px-[2mm] py-[1.5mm] text-[7.8pt]">
            {stub.footer.label}
            {stub.footer.value ? (
              <b className="block font-mono text-[9pt] font-medium">{stub.footer.value}</b>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
```

  Nền `bg-background` của nhãn, ghi chú, hộp "Pay by" là để chữ nằm trên nền trơn khi cuống gạch chéo
  (bản thảo `.void .tiny`, `.payby` nền trắng).

- [ ] **Step 8: Chạy, thấy XANH** (lệnh Step 4).
- [ ] **Step 9: Thử đột biến** — bỏ `stub.barcode ?` (luôn vẽ mã vạch), thấy ca vé chờ đỏ; đổi `<h2` thành
  `<h1` trong `PhotoCover`, thấy ca h2 đỏ; đổi `wideFirst ? … : …` thành luôn cột rộng, thấy ca B1 đỏ;
  trả lại.
- [ ] **Step 10: Typecheck** — `pnpm --filter @tourism/web typecheck`.
- [ ] **Step 11: Commit**

```bash
pnpm exec biome check --write apps/web/src/components/print
git add apps/web/src/components/print
git commit -m "feat(web): mảnh in dùng chung — bìa ảnh, tấm vé có cuống, dòng xé, dải cuối"
```

---

### Task 8: Voucher in 5b (`VoucherPrint`)

**Files:**
- Create: `apps/web/src/components/print/print-lists.tsx`, `voucher-print.tsx`
- Test: `apps/web/src/components/print/voucher-print.spec.tsx`

**Interfaces:**
- Consumes: Task 4 (`DocPage`, `DocFooter`, `PrintedAt`), Task 6 (`VoucherPrintView`), Task 7 (mảnh in);
  `VIETNAM_TIME_ZONE` (`@tourism/contract`); `EMAIL` (`@/lib/site`).
- Produces: `VoucherPrint({ view }: { view: VoucherPrintView })`; `PrintLists({ included, excluded })`.

- [ ] **Step 1: Viết test đỏ** `voucher-print.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { voucherPrintView } from '@/lib/print/voucher-print';
import { EMAIL } from '@/lib/site';
import { voucherView } from '@/lib/voucher';
import { makeTourData } from '@/test/fixtures/booking';
import { CANCELLED_AFTER_PAYING, VOUCHER_NOW, voucherBooking } from '@/test/fixtures/voucher';
import { VoucherPrint } from './voucher-print';

const p = messages.printDoc.voucher;

function renderPrint(overrides: Partial<BookingDetail> = {}) {
  const booking = voucherBooking(overrides);
  const view = voucherView(booking, VOUCHER_NOW);
  if (view === null) throw new Error('fixture phải là đơn đã trả');
  return render(<VoucherPrint view={voucherPrintView(booking, view, makeTourData(), VOUCHER_NOW)} />);
}

/**
 * Khối cấp một của tờ giấy: `data-slot` của từng con trực tiếp, hay của con đầu tiên khi con trực
 * tiếp là `div` bọc lấy khoảng cách (vé). Khoảng trống không slot thì bỏ.
 */
const blocks = (container: HTMLElement) => {
  const doc = container.querySelector('[data-print-doc]');
  return [...(doc?.children ?? [])]
    .map(
      (el) => el.getAttribute('data-slot') ?? el.firstElementChild?.getAttribute('data-slot') ?? null,
    )
    .filter((slot) => slot !== null);
};

describe('VoucherPrint', () => {
  it('là tài liệu in: data-print-doc, ẩn trên màn hình, hiện khi in', () => {
    const { container } = renderPrint();
    const doc = container.querySelector('[data-print-doc]');
    expect(doc).not.toBeNull();
    expect(doc?.classList.contains('hidden')).toBe(true);
    expect(doc?.classList.contains('print:flex')).toBe(true);
  });

  it('đủ khối của 5b theo thứ tự: bìa, vé, dòng xé, lịch trình, mục gồm, dải, chân trang', () => {
    const { container } = renderPrint();
    expect(blocks(container)).toEqual([
      'print-cover',
      'print-ticket',
      'print-tear',
      'print-day',
      'print-lists',
      'print-band',
      'doc-footer',
    ]);
    expect(screen.getByText(p.docType)).toBeInTheDocument();
    expect(screen.getByText(p.included)).toBeInTheDocument();
    expect(screen.getByText(p.whereToMeet)).toBeInTheDocument();
  });

  it('chân trang: câu hỗ trợ có email đậm, giờ in đóng dấu ở client', () => {
    const { container } = renderPrint();
    const footer = container.querySelector('[data-slot="doc-footer"]');
    expect(footer).toHaveTextContent(
      `${messages.voucher.needHelp} ${messages.printDoc.replyOrWriteTo} ${EMAIL}`,
    );
    expect(footer?.querySelector('b')).toHaveTextContent(EMAIL);
    expect(footer?.querySelector('[data-slot="printed-at"]')?.textContent).toMatch(
      new RegExp(`^${messages.printDoc.printedPrefix} `),
    );
  });

  it('tên tour là h2 — trang chỉ một h1 (ContentHero); tên dài thì cỡ nhỏ', () => {
    const { container } = renderPrint();
    expect(container.querySelector('h1')).toBeNull();
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveTextContent('Hanoi Heritage in a Day');
    expect(title.className).toContain('text-[27pt]');
  });

  it('tên dài hơn ngưỡng: bìa cỡ 22 pt', () => {
    const { container } = renderPrint({ tourTitle: 'A'.repeat(60) });
    expect(container.querySelector('h2')?.className).toContain('text-[22pt]');
  });

  it('đã huỷ: không dòng xé, không lịch trình, không mục gồm', () => {
    const { container } = renderPrint(CANCELLED_AFTER_PAYING);
    expect(container.querySelector('[data-slot="print-tear"]')).toBeNull();
    expect(container.querySelector('[data-slot="print-day"]')).toBeNull();
    expect(container.querySelector('[data-slot="print-lists"]')).toBeNull();
  });
});
```

  Ca thứ tự khối dựa vào việc mỗi khối là con trực tiếp của `DocPage` hoặc con đầu của một `div` bọc
  một lớp (vé bọc `div` lấy khoảng cách). Đổi cách bọc thì sửa `blocks` cho đúng — giữ ý của ca:
  đúng bảy khối, đúng thứ tự bản thảo.

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/web exec vitest run src/components/print/voucher-print.spec.tsx --maxWorkers=2`.

- [ ] **Step 3: Viết `print-lists.tsx`**:

```tsx
import { messages } from '@tourism/i18n';
import type { PrintList } from '@/lib/print/print-ticket';
import { PRINT_SECTION } from './print-styles';

/** Hai cột Included / Not included của voucher 5b: ✓ teal và – xám. Hai cột trống thì không vẽ. */
export function PrintLists({
  included,
  excluded,
}: {
  included: PrintList | null;
  excluded: PrintList | null;
}) {
  if (included === null && excluded === null) return null;
  const t = messages.printDoc.voucher;
  return (
    <div data-slot="print-lists" className="mt-[5mm] grid grid-cols-2 gap-[8mm]">
      <ListColumn heading={t.included} list={included} mark="✓" markClass="font-bold text-primary" />
      <ListColumn heading={t.notIncluded} list={excluded} mark="–" markClass="text-muted-foreground" />
    </div>
  );
}

function ListColumn({
  heading,
  list,
  mark,
  markClass,
}: {
  heading: string;
  list: PrintList | null;
  mark: string;
  markClass: string;
}) {
  // Cột trống vẫn giữ ô lưới để cột kia không nhảy sang trái.
  if (list === null) return <div />;
  return (
    <section>
      <h3 className={`mb-[2.5mm] ${PRINT_SECTION}`}>{heading}</h3>
      <ul>
        {list.items.map((item) => (
          <li key={item} className="relative mt-[1mm] pl-[4.5mm]">
            <span aria-hidden="true" className={`absolute left-0 ${markClass}`}>
              {mark}
            </span>
            {item}
          </li>
        ))}
        {list.more ? <li className="mt-[1mm] pl-[4.5mm] text-muted-foreground">{list.more}</li> : null}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Viết `voucher-print.tsx`**:

```tsx
import { VIETNAM_TIME_ZONE } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { DocFooter } from '@tourism/ui/components/print-doc/doc-footer';
import { DocPage } from '@tourism/ui/components/print-doc/doc-page';
import { PrintedAt } from '@tourism/ui/components/print-doc/printed-at';
import type { VoucherPrintView } from '@/lib/print/voucher-print';
import { EMAIL } from '@/lib/site';
import { PhotoCover } from './photo-cover';
import { PrintBand } from './print-band';
import { PrintLists } from './print-lists';
import { PRINT_SECTION } from './print-styles';
import { PrintTear } from './print-tear';
import { PrintTicket } from './print-ticket';

/**
 * Voucher in — phương án 5b (G40, spec §3.1): bìa ảnh 62 mm → vé có cuống → dòng xé → lịch trình hai
 * cột → Included / Not included → dải ba cột → chân trang. Chỉ hiện khi in (`DocPage`).
 */
export function VoucherPrint({ view }: { view: VoucherPrintView }) {
  const t = messages.printDoc.voucher;
  const stops = view.day?.stops ?? [];
  return (
    <DocPage className="pt-[11mm]">
      <PhotoCover
        photo={view.photo}
        heightClass="h-[62mm]"
        titleClass={view.longTitle ? 'text-[22pt]' : 'text-[27pt]'}
        docType={t.docType}
        meta={view.issued}
        kicker={view.kicker}
        title={view.title}
      />
      <div className="mt-[7mm]">
        <PrintTicket view={view.ticket} />
      </div>
      {/* Không mã vạch thì không dòng xé; giữ khoảng để phần dưới không dính vào vé. */}
      {view.tear ? <PrintTear text={view.tear} /> : <div aria-hidden="true" className="h-[6mm]" />}
      {view.day ? (
        <section data-slot="print-day" className="mt-[1mm]">
          <h3 className={`mb-[2.5mm] ${PRINT_SECTION}`}>{view.day.heading}</h3>
          {/* Hai cột đổ theo CỘT (hết cột trái mới sang phải) như bản thảo 5b, mà DOM vẫn đúng thứ
              tự thời gian: số hàng của lưới tính theo số mục — bố cục theo dữ liệu, không phải màu. */}
          <ol
            className="grid grid-flow-col grid-cols-2 gap-x-[8mm]"
            style={{ gridTemplateRows: `repeat(${Math.ceil(stops.length / 2)}, auto)` }}
          >
            {stops.map((stop) => (
              <li
                key={`${stop.time ?? ''}${stop.text}`}
                className="grid grid-cols-[3mm_12mm_1fr] items-start gap-[1.5mm] py-[1.1mm]"
              >
                <span aria-hidden="true" className="mt-[1.4mm] size-[1.8mm] rounded-full bg-primary" />
                {stop.time ? (
                  <time className="font-mono text-[8.3pt] font-medium text-primary-emphasis">
                    {stop.time}
                  </time>
                ) : (
                  <span />
                )}
                <span>{stop.text}</span>
              </li>
            ))}
          </ol>
          {view.day.more ? (
            <p className="mt-[1mm] text-[8pt] text-muted-foreground">{view.day.more}</p>
          ) : null}
        </section>
      ) : null}
      <PrintLists included={view.included} excluded={view.excluded} />
      <PrintBand columns={view.band} wideFirst className="mt-[6mm]" />
      <DocFooter
        start={
          <>
            {messages.voucher.needHelp} {messages.printDoc.replyOrWriteTo}{' '}
            <b className="font-semibold text-foreground">{EMAIL}</b>
          </>
        }
        end={<PrintedAt prefix={messages.printDoc.printedPrefix} timeZone={VIETNAM_TIME_ZONE} />}
      />
    </DocPage>
  );
}
```

- [ ] **Step 5: Chạy, thấy XANH** (cả spec của Task 7).
- [ ] **Step 6: Thử đột biến** — đổi `view.longTitle ? 'text-[22pt]' : 'text-[27pt]'` thành luôn 27 pt,
  thấy ca tên dài đỏ; đổi thứ tự `PrintLists` và `PrintBand`, thấy ca thứ tự khối đỏ; trả lại.
- [ ] **Step 7: Typecheck** — `pnpm --filter @tourism/web typecheck`.
- [ ] **Step 8: Commit**

```bash
pnpm exec biome check --write apps/web/src/components/print/print-lists.tsx apps/web/src/components/print/voucher-print.tsx apps/web/src/components/print/voucher-print.spec.tsx
git add apps/web/src/components/print/print-lists.tsx apps/web/src/components/print/voucher-print.tsx apps/web/src/components/print/voucher-print.spec.tsx
git commit -m "feat(web): voucher in 5b — lịch trình hai cột, mục gồm, dải cuối, chân trang"
```

---

### Task 9: Nối voucher in vào `/checkout/success`, gỡ CSS in cũ của voucher

**Files:**
- Modify: `apps/web/src/lib/voucher.ts:240-255` (`voucherMeetingPoint` → `voucherTourData`), `apps/web/src/lib/voucher.spec.ts:15,589-618`
- Modify: `apps/web/src/app/(site)/checkout/success/page.tsx` (nhánh voucher, ~dòng 81–137)
- Modify: `apps/web/src/app/globals.css` (~dòng 329–420)
- Modify: `apps/web/src/components/checkout/voucher-overview.tsx:29,78`, `voucher-pass.tsx:37,40,123,130`,
  `voucher-code.tsx:9,11,35`, `voucher-card.tsx:10-14`, `ticket-barcode.tsx:13-17`
- Modify (spec): `voucher-overview.spec.tsx:153-156,228-230`, `voucher-pass.spec.tsx:81-83,113,193,199-200`,
  `voucher-card.spec.tsx:59,68`

**Interfaces:**
- Consumes: Task 6 (`voucherPrintView`), Task 8 (`VoucherPrint`), `tourMeetingPoint`.
- Produces: `voucherTourData(view, loadTour): Promise<BookingTourData | null>`.

- [ ] **Step 1: Đổi test** của `voucherMeetingPoint` trong `voucher.spec.ts` sang `voucherTourData`
  (đổi cả tên trong import ở dòng 15):

```ts
describe('voucherTourData — chỉ đọc tour khi voucher có ô Meeting point', () => {
  const MEETING = 'Hotel pickup — Hoàn Kiếm, Ba Đình or Tây Hồ';

  it.each([
    [
      'đã đi',
      voucherBooking({ ...THREE_DAY_TRIP, cancellation: PASSED }),
      voucherNowOn('2026-11-10'),
    ],
    ['đã huỷ', voucherBooking(CANCELLED), VOUCHER_NOW],
  ] as const)('voucher %s: KHÔNG gọi API catalog, không có dữ liệu tour', async (_, booking, now) => {
    const loadTour = vi.fn(async () => makeTourData({ meetingPoint: MEETING }));
    expect(await voucherTourData(view(booking, now), loadTour)).toBeNull();
    expect(loadTour).not.toHaveBeenCalled();
  });

  it('voucher sắp đi: đọc tour MỘT lần, trả nguyên dữ liệu tour cho ô Meeting point và bản in', async () => {
    const tour = makeTourData({ meetingPoint: MEETING });
    const loadTour = vi.fn(async () => tour);
    expect(await voucherTourData(view(voucherBooking()), loadTour)).toBe(tour);
    expect(loadTour).toHaveBeenCalledTimes(1);
  });

  it('tour đã gỡ hay API catalog lỗi → null', async () => {
    expect(await voucherTourData(view(voucherBooking()), async () => null)).toBeNull();
  });
});
```

  Ba ca cũ "điểm hẹn null / khoảng trắng → null" bỏ: luật ấy là của `tourMeetingPoint`, đã có test ở
  `get-ready.spec.ts` (describe `tourMeetingPoint`). Chạy
  `pnpm --filter @tourism/web exec vitest run src/lib/voucher.spec.ts --maxWorkers=2`, thấy ĐỎ (hàm
  chưa có).

- [ ] **Step 2: Đổi hàm** trong `voucher.ts` (thay hàm `voucherMeetingPoint` cùng JSDoc của nó; bỏ
  `tourMeetingPoint` khỏi import ở dòng 15 nếu không còn chỗ dùng trong file):

```ts
/**
 * Dữ liệu tour của voucher — đọc CHỈ khi voucher có ô Meeting point (`showMeetingPoint`: sắp đi,
 * đang đi), như trang chi tiết đơn chỉ gọi API catalog ở hai giai đoạn cần (review P7C#6). Ô Meeting
 * point lấy điểm hẹn bằng `tourMeetingPoint`; bản in (G40) lấy thêm lịch trình và mục gồm — cùng một
 * lượt đọc, không thêm vòng API.
 *
 * `loadTour` là lượt đọc tour của trang (`fetchTourDetailOrNull`), truyền vào chứ không import: file
 * thuần này khỏi nạp lớp gọi API, và test đếm được lượt gọi. Tour đã gỡ hay API catalog lỗi ra `null`.
 */
export async function voucherTourData(
  view: Pick<VoucherView, 'showMeetingPoint'>,
  loadTour: () => Promise<BookingTourData | null>,
): Promise<BookingTourData | null> {
  return view.showMeetingPoint ? loadTour() : null;
}
```

  Sửa comment của trường `showMeetingPoint` trong `VoucherView` (~dòng 76: "…(`voucherMeetingPoint`,
  review P7C#6)") thành `voucherTourData`. Chạy lại spec — XANH.

- [ ] **Step 3: Nối trang** — `success/page.tsx`. Đọc trước
  `apps/web/node_modules/next/dist/docs/01-app/` phần Server Components nếu cần (trang vẫn là Server
  Component, không thêm `'use client'`). Import: bỏ `voucherMeetingPoint`; thêm `voucherTourData`,
  `tourMeetingPoint` (`@/lib/get-ready`), `voucherPrintView` (`@/lib/print/voucher-print`),
  `VoucherPrint` (`@/components/print/voucher-print`). Phần từ chỗ đọc đồng hồ tới cuối hàm:

```tsx
  // Đồng hồ server đọc MỘT lần: `voucherView` đo 30 phút "vừa trả" và suy hôm nay (ngày lịch
  // Việt Nam, spec P7 §2.1) từ cùng mốc này; bản in (G40) đọc cùng mốc.
  const now = new Date();
  const view = voucherView(booking, now);

  if (!view) {
    // …nhánh hoá đơn chờ GIỮ NGUYÊN ở task này (Task 11 nối bản in của nó)…
  }

  // Dữ liệu tour (cache 300 giây, tag `tour:<slug>`) CHỈ khi voucher có ô Meeting point — sắp đi, đang
  // đi (`voucherTourData`, cùng luật trang chi tiết đơn): voucher đã đi hay đã huỷ không gọi API
  // catalog. Ô Meeting point lấy điểm hẹn, bản in lấy thêm lịch trình và mục gồm. Tour đã gỡ hay lỗi
  // gọi API catalog đều rơi về null — voucher của đơn ĐÃ TRẢ không được sập vì một ô phụ.
  const tour = await voucherTourData(view, () => fetchTourDetailOrNull(booking.tourSlug));

  return (
    <div>
      {/* Màn hình bọc `print:hidden`: lúc in chỉ còn tờ `VoucherPrint` (ADR-0057 §1). Hero GIỮ (lý
          do ở nhánh trên), KHÔNG `meta` mã đơn (user chốt 08/10, D5): mã đã ở ô mã của thẻ; voucher
          đã huỷ cố ý giấu mã mà hero vẫn in ra, voucher vừa trả thì hiện mã ba lần trên một màn
          (review P7C#10). */}
      <div className="print:hidden">
        <ContentHero
          breadcrumb={t.heroBreadcrumb}
          title={booking.tourTitle}
          action={<PrintButton />}
        />
        {/* Lề ngang CHÉP của hero (`px-4 md:px-16 lg:px-24 xl:px-32`, khung `max-w-7xl` trong
            thẻ) để mép thẻ thẳng hàng tiêu đề. */}
        <div className="px-4 py-10 md:px-16 md:py-14 lg:px-24 xl:px-32">
          <VoucherCard booking={booking} view={view} meetingPoint={tourMeetingPoint(tour)} />
        </div>
      </div>
      <VoucherPrint view={voucherPrintView(booking, view, tour, now)} />
    </div>
  );
```

- [ ] **Step 4: Gỡ CSS in cũ của voucher** ở `apps/web/src/app/globals.css`:
  - Thay khối comment "THẺ VOUCHER MỘT CỘT hay CHIA ĐÔI" và hai `@custom-variant` (~329–352) bằng:

```css
/* ─────────────────────────────────────────────────────────────────────────────
 * THẺ VOUCHER MỘT CỘT hay CHIA ĐÔI (`/checkout/success`, spec P7 §6.4) — chỉ màn hình.
 *
 * Thẻ chia đôi từ `xl`. Mọi thứ đổi theo ngưỡng này (lưới hai cột, ô mã gọn của cột trái, ô mã và
 * khối mã của mảng teal) dùng MỘT trong hai biến thể bù nhau dưới đây thay vì tự ghép cặp ở nơi gọi
 * (review P7C#13):
 *
 * - `voucher-stack:` — thẻ một cột: dưới `xl`.
 * - `voucher-split:` — thẻ chia đôi: từ `xl`.
 *
 * Bản in không đi qua thẻ này: lúc in là tài liệu riêng `VoucherPrint` (G40, ADR-0057).
 * ───────────────────────────────────────────────────────────────────────────── */
@custom-variant voucher-stack (@media (width < --theme(--breakpoint-xl)));
@custom-variant voucher-split (@media (width >= --theme(--breakpoint-xl)));
```

  - Thay khối comment "IN ẤN VOUCHER `/checkout/success`…" và khối `@media print { body:has([data-slot="voucher"]) … }`
    (~354–420, tới hết file) bằng:

```css
/* ─────────────────────────────────────────────────────────────────────────────
 * IN ẤN — tài liệu in (G40, ADR-0057 §1). Trang có `[data-print-doc]` thì lúc in chỉ còn `<main>`:
 * chrome của site (top bar, navbar, footer, nút cuộn, toast) là anh em của `<main>` ngay dưới
 * `<body>` (`SiteChrome`), còn nội dung màn hình trong `<main>` bọc `print:hidden` — giấy chỉ còn
 * tài liệu.
 *
 * `display: block`: `body` là cột flex (footer dính đáy màn hình); trang in tên `doc` chắc ăn nhất
 * khi tài liệu nằm trong luồng khối thường — đừng gỡ. Nền body bỏ để giao diện tối không lọt ra
 * giấy.
 * ───────────────────────────────────────────────────────────────────────────── */
@media print {
  body:has([data-print-doc]) {
    display: block;
    background: none;
  }

  body:has([data-print-doc]) > :not(main) {
    display: none;
  }
}
```

  Khối in của hoá đơn (`[data-slot="barcode"]`, `receipt-status`, `receipt`, `stub`, ~289–327) để Task 11.

- [ ] **Step 5: Gỡ lớp in khỏi component voucher màn hình** (cả thẻ đã nằm trong `print:hidden`):
  - `voucher-overview.tsx:78` bỏ `print:min-h-44`; `voucher-pass.tsx:123,130` bỏ `print:hidden`;
    `voucher-code.tsx:35` thành `<div className="shrink-0">`; `page.tsx` bỏ `print:p-0` (đã làm ở Step 3).
  - Sửa comment còn nói chuyện in cho đúng cơ chế mới (bỏ mệnh đề về in; không viết thêm lịch sử):
    `voucher-card.tsx:10-11` bỏ câu "Khi in, cột phải hẹp còn 17rem… khối in của `globals.css`.";
    `voucher-card.tsx:13-14` "màn hình từ `xl`, và mọi bản in" → "từ `xl`"; `voucher-code.tsx:9`
    "(từ `xl`, và mọi bản in)" → "(từ `xl`)"; `voucher-code.tsx:11` bỏ câu "Nút chép giấu khi in…";
    `voucher-overview.tsx:29` "Thẻ chia đôi — từ `xl`, và khi in — thì ô gọn giấu" → "Thẻ chia đôi (từ
    `xl`) thì ô gọn giấu"; `voucher-pass.tsx:37` bỏ ", không bao giờ khi in"; `voucher-pass.tsx:40`
    "thẻ chia đôi và bản in thì có" → "thẻ chia đôi thì có". Câu kể lịch sử "từng mất…" (voucher-pass
    ~144, voucher-code ~14) giữ.
  - `ticket-barcode.tsx:13-17`: thay hai câu cuối JSDoc (từ "`data-slot="barcode"` là móc…" tới "…mà
    không cần class riêng.") bằng: "`data-slot="barcode"` là móc của luật in `print-color-adjust:
    exact` ở `globals.css` (vé trang chi tiết đơn khi in); tài liệu in G40 tự ép qua `[data-print-doc]`.
    Vạch `bg-current` trên chữ `text-foreground` — trong tài liệu in là mực tối của phạm vi `.light`."
  - Spec: `voucher-overview.spec.tsx:153` bỏ `'print:min-h-44'` khỏi mảng và `:156` thành
    `expect(photo.className).not.toMatch(/(^|\s)(md:)?h-\d+/);`; comment `:228-229` và tên ca `:230`
    bỏ "và khi in"/"(từ xl, và khi in)" → "(từ xl)". `voucher-pass.spec.tsx:81-82` bỏ ", KHÔNG bao giờ
    khi in"; tên ca `:83` bỏ ", bản in vẫn có"; `:113` "thẻ chia đôi và bản in thì có" → "thẻ chia đôi
    thì có"; tên ca `:193` bỏ "; cả hai giấu khi in" và xoá hai dòng `:199-200`. `voucher-card.spec.tsx:59`
    "(thẻ hai cột, bản in)" → "(thẻ hai cột)"; `:68` "(`voucher-split:` — từ xl, và khi in)" →
    "(`voucher-split:` — từ xl)".

- [ ] **Step 6: Chạy**
  `pnpm --filter @tourism/web exec vitest run src/lib/voucher.spec.ts src/components/checkout src/components/print --maxWorkers=2`
  — XANH; `pnpm --filter @tourism/web typecheck` — XANH. Rà còn sót:
  `rg -n "print:" apps/web/src/components/checkout --glob '!*.spec.tsx'` chỉ còn `print-button.tsx`
  (comment kể lịch sử trong spec, kiểu "bản cũ tự ghép cặp `max-xl:hidden print:flex`", giữ).
- [ ] **Step 7: Commit**

```bash
pnpm exec biome check --write apps/web/src/lib/voucher.ts apps/web/src/lib/voucher.spec.ts "apps/web/src/app/(site)/checkout/success/page.tsx" apps/web/src/app/globals.css apps/web/src/components/checkout/voucher-overview.tsx apps/web/src/components/checkout/voucher-pass.tsx apps/web/src/components/checkout/voucher-code.tsx apps/web/src/components/checkout/voucher-card.tsx apps/web/src/components/checkout/ticket-barcode.tsx apps/web/src/components/checkout/voucher-overview.spec.tsx apps/web/src/components/checkout/voucher-pass.spec.tsx apps/web/src/components/checkout/voucher-card.spec.tsx
git add apps/web/src/lib/voucher.ts apps/web/src/lib/voucher.spec.ts "apps/web/src/app/(site)/checkout/success/page.tsx" apps/web/src/app/globals.css apps/web/src/components/checkout/voucher-overview.tsx apps/web/src/components/checkout/voucher-pass.tsx apps/web/src/components/checkout/voucher-code.tsx apps/web/src/components/checkout/voucher-card.tsx apps/web/src/components/checkout/ticket-barcode.tsx apps/web/src/components/checkout/voucher-overview.spec.tsx apps/web/src/components/checkout/voucher-pass.spec.tsx apps/web/src/components/checkout/voucher-card.spec.tsx
git commit -m "feat(web): voucher in thành tài liệu riêng ở /checkout/success, gỡ CSS in ép lên markup màn hình"
```

---

### Task 10: Hoá đơn chờ in B1 — view-model và component

**Files:**
- Create: `apps/web/src/lib/print/receipt-print.ts`, `apps/web/src/lib/print/receipt-print.spec.ts`
- Create: `apps/web/src/components/print/receipt-print.tsx`, `apps/web/src/components/print/receipt-print.spec.tsx`

**Interfaces:**
- Consumes: Task 3 (`pendingDeadline`, bốn hàm giờ in), Task 5 (helper vé), Task 7 (mảnh in), Task 4
  (`DocPage`, `DocFooter`, `PrintedAt`); `bookingPhase`, `tripLengthDays`, `vietnamToday`,
  `VIETNAM_TIME_ZONE`, `Booking`, `BookingPhase` (`@tourism/contract`); `bookingTotalLabel`,
  `paymentProviderLabel`, `refundSentence`, `refundSummary` (`@/lib/booking-vm`); `formatBookingMoney`
  (`@/lib/checkout`); `formatWeekdayDate` (`@/lib/tours`); `EMAIL`, `PHONE` (`@/lib/site`).
- Produces: `receiptPrintView(booking, now): ReceiptPrintView`, `ReceiptPrint({ view })`.

**Luật (spec §4, quyết định 18):** đóng khi trạng thái khác `PENDING` hoặc giai đoạn `lapsed`. Vé tông
`pending`/`closed`; mộc `stampPending` (tông `pending`) / `stampClosed` (`muted`); ô cuối "Payment" =
`paymentProviderLabel`. Cuống: dải `unpaid`; nhãn `notYetVoucher` chỉ khi đang chờ; không mã vạch;
"Pay by HH:MM · D Mon" khi chờ, "No payment was taken" khi đóng. Dòng xé: `stubNotYetVoucher` / `stubClosed`.
Bảng một dòng. Dải: chờ → How to pay · If it stays unpaid · Booking reference; đóng → What happened ·
Book again · Booking reference.

- [ ] **Step 1: Viết test đỏ** `receipt-print.spec.ts`:

```ts
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { receiptPrintView } from './receipt-print';

const r = messages.printDoc.receipt;

/** Đơn của bản thảo B1: đặt 17:59 giờ Việt Nam 9/10, Hội An một ngày 29/10, 1 người lớn × $39. */
const pending = (overrides: Partial<BookingDetail> = {}) =>
  makeBooking({
    code: 'BK-EET0JBTH',
    status: 'PENDING',
    paidAt: null,
    createdAt: '2026-10-09T10:59:36.812Z',
    tourTitle: 'Hội An Old Town & Lantern Evening',
    tourSlug: 'hoi-an-lantern-evening',
    tourDestinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
    departureStartDate: '2026-10-29',
    departureEndDate: '2026-10-29',
    unitPrice: '39.00',
    totalAmount: '39.00',
    numAdults: 1,
    numChildren: 0,
    contactName: 'Nora Dahl',
    contactEmail: 'nora.dahl@example.com',
    paymentProvider: 'STRIPE',
    ...overrides,
  });

const AT = new Date('2026-10-09T11:02:00.000Z'); // 18:02 giờ VN, ba phút sau khi đặt

describe('receiptPrintView — đơn đang chờ trả', () => {
  const v = receiptPrintView(pending(), AT);

  it('bìa và vé chờ', () => {
    expect(v.booked).toBe(r.booked('9 Oct 2026, 17:59'));
    expect(v.kicker).toBe('Hội An · 1 day · Thu 29 Oct 2026');
    expect(v.ticket.tone).toBe('pending');
    expect(v.ticket.bandStart).toBe(r.pendingBand);
    expect(v.ticket.stamp).toEqual({ label: r.stampPending, tone: 'pending' });
    expect(v.ticket.cells.at(-1)).toEqual({
      label: messages.booking.success.paymentLabel,
      value: messages.booking.form.stripe,
    });
  });

  it('cuống: chưa là voucher, không mã vạch, hạn trả cụ thể', () => {
    expect(v.ticket.stub).toEqual({
      band: r.unpaid,
      tag: r.notYetVoucher,
      amountLabel: null,
      amount: '$39',
      note: r.totalNote,
      barcode: null,
      footer: { label: r.payBy, value: '19:04 · 9 Oct' },
    });
    expect(v.tear).toBe(messages.booking.success.stubNotYetVoucher);
  });

  it('bảng tiền một dòng và tổng', () => {
    expect(v.line).toEqual({
      item: 'Hội An Old Town & Lantern Evening',
      sub: 'Thu 29 Oct 2026 · 1 day · Hội An',
      travellers: messages.accountBookings.travellers(1, 0),
      price: '$39',
      priceNote: messages.booking.success.perTraveller,
      amount: '$39',
    });
    expect(v.total).toEqual({
      label: messages.checkoutSummary.totalLabel,
      amount: '$39',
      note: messages.checkoutSummary.taxesNote,
    });
  });

  it('dải: How to pay kèm test mode, giờ nhả (giờ trước, ngày sau), mã và người đặt', () => {
    expect(v.band).toEqual([
      {
        heading: r.howToPay,
        strong: null,
        text: `${r.howToPayBody} ${messages.tourDetail.booking.testMode}`,
        reference: false,
      },
      { heading: r.ifUnpaid, strong: null, text: r.releasedAt('19:04, 9 Oct 2026'), reference: false },
      {
        heading: messages.booking.success.refLabel,
        strong: 'BK-EET0JBTH',
        text: r.bookedBy('nora.dahl@example.com'),
        reference: true,
      },
    ]);
  });

  it('quá 65 phút mà cron chưa quét: vẫn đang chờ (API còn nhận trả — quyết định 18)', () => {
    const late = receiptPrintView(pending(), new Date('2026-10-09T15:00:00.000Z'));
    expect(late.ticket.tone).toBe('pending');
    expect(late.ticket.stub.footer).toEqual({ label: r.payBy, value: '19:04 · 9 Oct' });
  });
});

describe('receiptPrintView — đơn chưa trả đã đóng (G37)', () => {
  it('huỷ khi chưa trả: vé đóng, không hứa thành voucher, câu cancelled sẵn có', () => {
    const v = receiptPrintView(
      pending({ status: 'CANCELLED', cancelledAt: '2026-10-09T12:05:00.000Z' }),
      AT,
    );
    expect(v.ticket.tone).toBe('closed');
    expect(v.ticket.bandStart).toBe(r.closedBand);
    expect(v.ticket.stamp).toEqual({ label: r.stampClosed, tone: 'muted' });
    expect(v.ticket.stub.tag).toBeNull();
    expect(v.ticket.stub.footer).toEqual({ label: r.noPayment, value: null });
    expect(v.tear).toBe(messages.booking.success.stubClosed);
    expect(v.band.map((c) => c.heading)).toEqual([
      r.whatHappened,
      r.bookAgain,
      messages.booking.success.refLabel,
    ]);
    expect(v.band[0]?.text).toBe(messages.accountBookingDetail.terminalNote.CANCELLED);
    expect(v.band[1]?.text).toBe(r.bookAgainBody('hoi-an-lantern-evening'));
  });

  it('PENDING qua hạn chót đặt chỗ (lapsed): đóng, câu "not paid by the deadline"', () => {
    const v = receiptPrintView(pending(), new Date('2026-10-29T03:00:00.000Z'));
    expect(v.ticket.tone).toBe('closed');
    expect(v.band[0]?.text).toBe(messages.bookingDetail.closed.notPaidByDeadline);
  });

  it('bị thu rồi hoàn tự động (paidAt null): kể thêm khoản hoàn', () => {
    const v = receiptPrintView(
      pending({ status: 'REFUNDED', refundedTotal: '39.00', cancelledAt: '2026-10-09T11:30:00.000Z' }),
      AT,
    );
    expect(v.ticket.tone).toBe('closed');
    expect(v.band[0]?.text).toBe(
      `${messages.accountBookingDetail.terminalNote.REFUNDED} ${messages.accountBookingDetail.refundLine.full('$39.00')}`,
    );
  });
});
```

- [ ] **Step 2: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/web exec vitest run src/lib/print/receipt-print.spec.ts --maxWorkers=2`.

- [ ] **Step 3: Viết `receipt-print.ts`**:

```ts
import {
  type Booking,
  type BookingPhase,
  bookingPhase,
  tripLengthDays,
  VIETNAM_TIME_ZONE,
  vietnamToday,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  formatPrintDate,
  formatPrintDateTime,
  formatPrintDayMonth,
  formatPrintTime,
} from '@tourism/ui/lib/print-time';
import {
  bookingTotalLabel,
  paymentProviderLabel,
  refundSentence,
  refundSummary,
} from '@/lib/booking-vm';
import { formatBookingMoney, pendingDeadline } from '@/lib/checkout';
import { formatWeekdayDate } from '@/lib/tours';
import {
  type PrintColumn,
  type PrintPhoto,
  type PrintTicketView,
  printPhoto,
  referenceColumn,
  textColumn,
  ticketCells,
  ticketDate,
} from './print-ticket';

/**
 * Hoá đơn chờ in — B1 (G40, spec §4): cùng hình tấm vé của voucher 5b ở trạng thái chờ. Đơn chưa
 * trả không giữ ghế (invariant #1 của API): chữ nói giờ nhả cụ thể, không đếm ngược, không hứa giữ
 * chỗ. Đơn đã đóng (G37) không hứa mã sẽ thành voucher.
 */
export interface ReceiptPrintView {
  photo: PrintPhoto | null;
  booked: string;
  kicker: string;
  title: string;
  ticket: PrintTicketView;
  tear: string;
  line: {
    item: string;
    sub: string;
    travellers: string;
    price: string;
    priceNote: string;
    amount: string;
  };
  total: { label: string; amount: string; note: string };
  band: PrintColumn[];
}

export function receiptPrintView(booking: Booking, now: Date): ReceiptPrintView {
  const r = messages.printDoc.receipt;
  const zone = VIETNAM_TIME_ZONE;
  const phase = bookingPhase(booking, vietnamToday(now));
  // Quyết định 18 của plan: PENDING quá 65 phút mà cron chưa quét vẫn "đang chờ" — API còn nhận trả,
  // màn hình (`checkoutMood`) cũng chưa khai đã đóng. `lapsed` thì API đã thôi mở phiên trả.
  const closed = booking.status !== 'PENDING' || phase === 'lapsed';
  const deadline = pendingDeadline(booking.createdAt);
  const days = messages.bookingDetail.ticket.days(
    tripLengthDays(booking.departureStartDate, booking.departureEndDate),
  );
  const place = booking.tourDestinations[0]?.name ?? booking.tourTitle;
  const when = formatWeekdayDate(booking.departureStartDate, { year: true });
  const amount = formatBookingMoney(booking, booking.totalAmount);
  const reference = referenceColumn(booking.code, r.bookedBy(booking.contactEmail));

  return {
    photo: printPhoto(booking.tourImage),
    booked: r.booked(formatPrintDateTime(new Date(booking.createdAt), zone)),
    kicker: messages.printDoc.kicker(place, days, when),
    title: booking.tourTitle,
    ticket: {
      tone: closed ? 'closed' : 'pending',
      bandStart: closed ? r.closedBand : r.pendingBand,
      bandEnd: booking.code,
      title: booking.tourTitle,
      stamp: closed
        ? { label: r.stampClosed, tone: 'muted' }
        : { label: r.stampPending, tone: 'pending' },
      departs: ticketDate(booking.departureStartDate),
      returns: ticketDate(booking.departureEndDate),
      routeLine: messages.printDoc.routeLine(days, place),
      cells: ticketCells(booking, {
        label: messages.booking.success.paymentLabel,
        value: paymentProviderLabel(booking.paymentProvider),
      }),
      stub: {
        band: r.unpaid,
        tag: closed ? null : r.notYetVoucher,
        amountLabel: null,
        amount,
        note: r.totalNote,
        barcode: null,
        footer: closed
          ? { label: r.noPayment, value: null }
          : {
              label: r.payBy,
              value: `${formatPrintTime(deadline, zone)} · ${formatPrintDayMonth(deadline, zone)}`,
            },
      },
      notice: null,
    },
    tear: closed ? messages.booking.success.stubClosed : messages.booking.success.stubNotYetVoucher,
    line: {
      item: booking.tourTitle,
      sub: `${when} · ${days} · ${place}`,
      travellers: messages.accountBookings.travellers(booking.numAdults, booking.numChildren),
      price: formatBookingMoney(booking, booking.unitPrice),
      priceNote: messages.booking.success.perTraveller,
      amount,
    },
    total: { label: bookingTotalLabel(booking), amount, note: messages.checkoutSummary.taxesNote },
    band: closed
      ? [
          textColumn(r.whatHappened, closedReason(booking, phase)),
          textColumn(r.bookAgain, r.bookAgainBody(booking.tourSlug)),
          reference,
        ]
      : [
          textColumn(r.howToPay, `${r.howToPayBody} ${messages.tourDetail.booking.testMode}`),
          textColumn(
            r.ifUnpaid,
            r.releasedAt(`${formatPrintTime(deadline, zone)}, ${formatPrintDate(deadline, zone)}`),
          ),
          reference,
        ],
  };
}

/**
 * "What happened" của đơn chưa trả đã đóng (spec §4.3): câu lapsed hay câu kết cục sẵn có của trang
 * chi tiết đơn; bị thu rồi hoàn tự động (`paidAt` null mà sổ có khoản hoàn) thì kể thêm khoản hoàn.
 */
function closedReason(booking: Booking, phase: BookingPhase): string {
  const base =
    phase === 'lapsed'
      ? messages.bookingDetail.closed.notPaidByDeadline
      : (messages.accountBookingDetail.terminalNote[booking.status] ??
        messages.booking.success.settledBody);
  const refund = refundSummary(booking);
  return refund === null ? base : `${base} ${refundSentence(refund, booking.currency)}`;
}
```

- [ ] **Step 4: Chạy, thấy XANH.**

- [ ] **Step 5: Viết test đỏ** `receipt-print.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { receiptPrintView } from '@/lib/print/receipt-print';
import { EMAIL, PHONE } from '@/lib/site';
import { makeBooking } from '@/test/fixtures/booking';
import { ReceiptPrint } from './receipt-print';

const r = messages.printDoc.receipt;

function renderReceipt() {
  const booking = makeBooking({
    status: 'PENDING',
    paidAt: null,
    createdAt: '2026-10-09T10:59:36.812Z',
    departureStartDate: '2026-10-29',
    departureEndDate: '2026-10-29',
  });
  return render(<ReceiptPrint view={receiptPrintView(booking, new Date('2026-10-09T11:02:00Z'))} />);
}

describe('ReceiptPrint', () => {
  it('là tài liệu in: data-print-doc, ẩn trên màn hình', () => {
    const { container } = renderReceipt();
    const doc = container.querySelector('[data-print-doc]');
    expect(doc?.classList.contains('hidden')).toBe(true);
    expect(doc?.classList.contains('print:flex')).toBe(true);
  });

  it('đủ khối của B1: bìa 22 pt, vé chờ, dòng xé, bảng tiền, dải ba cột đều', () => {
    const { container } = renderReceipt();
    expect(screen.getByText(r.docType)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 }).className).toContain('text-[22pt]');
    expect(container.querySelector('[data-slot="print-ticket"]')).toHaveAttribute('data-tone', 'pending');
    expect(screen.getByText(messages.booking.success.stubNotYetVoucher)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: r.summary })).toBeInTheDocument();
    for (const header of [
      r.columns.item,
      messages.passportVisa.labels.travellers,
      r.columns.price,
      r.columns.amount,
    ]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    expect(container.querySelector('[data-slot="print-band"]')?.className).toContain('grid-cols-3');
    expect(screen.getByText(r.howToPay)).toBeInTheDocument();
  });

  it('chân trang hoá đơn có cả email đậm lẫn điện thoại', () => {
    const { container } = renderReceipt();
    const footer = container.querySelector('[data-slot="doc-footer"]');
    expect(footer).toHaveTextContent(
      `${messages.booking.success.needHelp} ${messages.printDoc.writeTo} ${EMAIL} · ${PHONE}`,
    );
    expect(footer?.querySelector('b')).toHaveTextContent(EMAIL);
  });
});
```

- [ ] **Step 6: Chạy, thấy ĐỎ** — `pnpm --filter @tourism/web exec vitest run src/components/print/receipt-print.spec.tsx --maxWorkers=2`.

- [ ] **Step 7: Viết `receipt-print.tsx`** (bảng theo `.inv`, dải theo `.rb .band` của B1):

```tsx
import { VIETNAM_TIME_ZONE } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { DocFooter } from '@tourism/ui/components/print-doc/doc-footer';
import { DocPage } from '@tourism/ui/components/print-doc/doc-page';
import { PrintedAt } from '@tourism/ui/components/print-doc/printed-at';
import { cn } from '@tourism/ui/lib/utils';
import type { ReceiptPrintView } from '@/lib/print/receipt-print';
import { EMAIL, PHONE } from '@/lib/site';
import { PhotoCover } from './photo-cover';
import { PrintBand } from './print-band';
import { PRINT_LABEL, PRINT_SECTION } from './print-styles';
import { PrintTear } from './print-tear';
import { PrintTicket } from './print-ticket';

const TH = cn(PRINT_LABEL, 'border-b-[0.8pt] border-foreground pb-[2mm] text-left');
const TD = 'border-b-[0.5pt] border-border py-[2.6mm] align-top';
const SUB = 'mt-[0.5mm] block text-[8pt] text-muted-foreground';

/**
 * Hoá đơn chờ in — B1 (G40, spec §4.2): bìa ảnh 46 mm → vé chờ → dòng xé → bảng tiền → dải ba cột →
 * chân trang có điện thoại. Chỉ hiện khi in (`DocPage`).
 */
export function ReceiptPrint({ view }: { view: ReceiptPrintView }) {
  const r = messages.printDoc.receipt;
  return (
    <DocPage className="pt-[11mm]">
      <PhotoCover
        photo={view.photo}
        heightClass="h-[46mm]"
        titleClass="text-[22pt]"
        docType={r.docType}
        meta={view.booked}
        kicker={view.kicker}
        title={view.title}
      />
      <div className="mt-[6mm]">
        <PrintTicket view={view.ticket} />
      </div>
      <PrintTear text={view.tear} />
      <section data-slot="print-summary" className="mt-[7mm]">
        <h3 className={cn('mb-[2mm]', PRINT_SECTION)}>{r.summary}</h3>
        <table className="w-full border-collapse text-[9pt]">
          <thead>
            <tr>
              <th className={TH}>{r.columns.item}</th>
              <th className={TH}>{messages.passportVisa.labels.travellers}</th>
              <th className={cn(TH, 'text-right')}>{r.columns.price}</th>
              <th className={cn(TH, 'text-right')}>{r.columns.amount}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={TD}>
                <b className="font-semibold">{view.line.item}</b>
                <span className={SUB}>{view.line.sub}</span>
              </td>
              <td className={TD}>{view.line.travellers}</td>
              <td className={cn(TD, 'text-right')}>
                {view.line.price}
                <span className={SUB}>{view.line.priceNote}</span>
              </td>
              <td className={cn(TD, 'text-right')}>{view.line.amount}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="text-[11pt] font-bold">
              <td colSpan={3} className="border-t-[0.8pt] border-foreground pt-[2.5mm] pb-[1.6mm]">
                {view.total.label}
              </td>
              <td className="border-t-[0.8pt] border-foreground pt-[2.5mm] pb-[1.6mm] text-right">
                {view.total.amount}
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="pb-[1.6mm] text-right text-[7.8pt] text-muted-foreground">
                {view.total.note}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
      <PrintBand columns={view.band} className="mt-[7mm]" />
      <DocFooter
        start={
          <>
            {messages.booking.success.needHelp} {messages.printDoc.writeTo}{' '}
            <b className="font-semibold text-foreground">{EMAIL}</b> · {PHONE}
          </>
        }
        end={<PrintedAt prefix={messages.printDoc.printedPrefix} timeZone={VIETNAM_TIME_ZONE} />}
      />
    </DocPage>
  );
}
```

- [ ] **Step 8: Chạy, thấy XANH.**
- [ ] **Step 9: Thử đột biến** — bỏ `|| phase === 'lapsed'`, thấy ca lapsed đỏ; đổi `closed` thành
  `booking.status !== 'PENDING' || pendingExpiry(booking.createdAt, now).expired`, thấy ca "quá 65
  phút" đỏ; đổi thứ tự giờ nhả thành "ngày, giờ", thấy ca dải đỏ; trả lại.
- [ ] **Step 10: Typecheck và commit**

```bash
pnpm --filter @tourism/web typecheck
pnpm exec biome check --write apps/web/src/lib/print/receipt-print.ts apps/web/src/lib/print/receipt-print.spec.ts apps/web/src/components/print/receipt-print.tsx apps/web/src/components/print/receipt-print.spec.tsx
git add apps/web/src/lib/print/receipt-print.ts apps/web/src/lib/print/receipt-print.spec.ts apps/web/src/components/print/receipt-print.tsx apps/web/src/components/print/receipt-print.spec.tsx
git commit -m "feat(web): hoá đơn chờ in B1 — vé ở trạng thái chờ, giờ nhả cụ thể, bảng tiền"
```

---

### Task 11: Nối hoá đơn chờ in, cuống của đơn đã đóng trên màn hình (G37), gỡ CSS in còn lại

**Files:**
- Modify: `apps/web/src/app/(site)/checkout/success/page.tsx` (nhánh `!view`), `.../checkout/cancel/page.tsx`
- Modify: `apps/web/src/components/checkout/booking-receipt.tsx` (`Stub` ~276–319, comment ~103–105), `booking-receipt.spec.tsx`
- Modify: `apps/web/src/app/globals.css` (~289–327)

**Interfaces:**
- Consumes: Task 10 (`receiptPrintView`, `ReceiptPrint`); `booking.success.stubClosed` (Task 2).

- [ ] **Step 1: Viết test đỏ** trong `booking-receipt.spec.tsx`, thêm vào describe "mã chưa phải voucher"
  (dùng helper `unpaid` của file):

```tsx
  it('đơn chưa trả đã đóng: cuống nói thẳng đã đóng — không "Departs", không hứa thành voucher (G37)', () => {
    render(<BookingReceipt booking={unpaid({ status: 'CANCELLED' })} mood="settled" />);
    expect(screen.getByText(t.stubClosed)).toBeInTheDocument();
    expect(screen.queryByText(t.stubNotYetVoucher)).toBeNull();
    expect(screen.queryByText(/^Departs /)).toBeNull();
  });
```

  Chạy `pnpm --filter @tourism/web exec vitest run src/components/checkout/booking-receipt.spec.tsx --maxWorkers=2`,
  thấy ĐỎ.

- [ ] **Step 2: Sửa `Stub`** — khối chữ trái thành:

```tsx
      <div>
        {/* Đơn đã đóng (tâm trạng `settled`: huỷ, lỡ hạn, bị thu rồi hoàn): một câu nói thẳng — không
            ngày đi, không hứa mã sẽ thành voucher cho một đơn không còn trả được (G37). */}
        {mood === 'settled' ? (
          <p className="font-medium">{t.stubClosed}</p>
        ) : (
          <>
            <p className="font-medium">{departed ? t.departedOn(departure) : t.departsOn(departure)}</p>
            <p className="text-xs text-muted-foreground">{t.stubNotYetVoucher}</p>
          </>
        )}
      </div>
```

  Sửa câu cuối JSDoc của `Stub` cho khớp ("…dòng hint nói mã sẽ thành voucher khi trả xong; đơn đã
  đóng thì một câu nói thẳng đã đóng."). Comment ~103–105 "Transform-only nên bản in (`print`) và JS-tắt
  đều thấy đủ chữ." → "Transform-only nên khi tắt JS vẫn thấy đủ chữ." (hoá đơn màn hình không còn được
  in). Chạy lại spec — XANH (các ca "Departs/Departed" dùng tâm trạng `confirming`, không đổi).

- [ ] **Step 3: Nối trang `/checkout/success`** — nhánh `!view` (biến `now` đã có từ Task 9):

```tsx
  if (!view) {
    // Đơn chưa có `paidAt` — PENDING đang chờ webhook, hay giữ chỗ hết hạn/bị huỷ khi chưa
    // trả: giữ NGUYÊN hoá đơn chờ. Mã của những đơn này chưa bao giờ là voucher.
    const mood = checkoutMood(booking);
    return (
      <div>
        {/* Màn hình bọc `print:hidden`; lúc in là hoá đơn chờ B1 (G40, ADR-0057), cùng mốc `now`. */}
        <div className="print:hidden">
          {/* GIỮ `ContentHero`: … (giữ nguyên comment cũ) */}
          <ContentHero
            breadcrumb={t.heroBreadcrumb}
            title={booking.tourTitle}
            action={<PrintButton />}
          />
          <div className="py-10 md:py-14">
            <BookingReceipt booking={booking} mood={mood} />
            <div className="mx-auto mt-8 flex w-full max-w-3xl flex-wrap items-center gap-2.5 px-4">
              {/* …hai nút giữ nguyên… */}
            </div>
          </div>
        </div>
        <ReceiptPrint view={receiptPrintView(booking, now)} />
      </div>
    );
  }
```

  (Hàng nút bỏ `print:hidden` — đã nằm trong khối ẩn. Import `ReceiptPrint`, `receiptPrintView`.)

- [ ] **Step 4: Nối trang `/checkout/cancel`** — đọc đồng hồ một lần:
  `const now = new Date();` ngay sau khi có `booking`; `pendingExpiry(booking.createdAt, now)`. Bọc
  `ContentHero`, khối `py-10` (hoá đơn và hàng nút) trong `<div className="print:hidden">`, rồi thêm:

```tsx
      {/* Trang huỷ không có nút Print (spec §4.1) — Ctrl+P in hoá đơn chờ B1 (G40, ADR-0057). */}
      <ReceiptPrint view={receiptPrintView(booking, now)} />
```

  Hàng nút bỏ `print:hidden`. `heldNote` giữ nguyên (G37 còn mở phần đó).

- [ ] **Step 5: Gỡ CSS in còn lại** ở `apps/web/src/app/globals.css` — thay khối comment "IN ẤN — hoá đơn
  `BookingReceipt`…" và khối `@media print` theo sau (~289–327) bằng:

```css
/* ─────────────────────────────────────────────────────────────────────────────
 * IN ẤN — mã vạch `TicketBarcode` vẽ bằng NỀN: trình duyệt mặc định không in nền, thiếu móc này thì
 * in trang có vé (trang chi tiết đơn) là mất vạch. Tài liệu in G40 (voucher, hoá đơn chờ) tự ép
 * `print-color-adjust` qua `[data-print-doc]` (CSS chung của `@tourism/ui`, ADR-0057).
 * ───────────────────────────────────────────────────────────────────────────── */
@media print {
  [data-slot="barcode"],
  [data-slot="barcode"] span {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

- [ ] **Step 6: Chạy**
  `pnpm --filter @tourism/web exec vitest run src/components/checkout src/components/print src/lib --maxWorkers=2`
  — XANH; `pnpm --filter @tourism/web typecheck` — XANH. Rà:
  `rg -n 'data-slot="(receipt|stub|receipt-status)"' apps/web/src/app/globals.css` không còn kết quả.
- [ ] **Step 7: Commit**

```bash
pnpm exec biome check --write "apps/web/src/app/(site)/checkout/success/page.tsx" "apps/web/src/app/(site)/checkout/cancel/page.tsx" apps/web/src/components/checkout/booking-receipt.tsx apps/web/src/components/checkout/booking-receipt.spec.tsx apps/web/src/app/globals.css
git add "apps/web/src/app/(site)/checkout/success/page.tsx" "apps/web/src/app/(site)/checkout/cancel/page.tsx" apps/web/src/components/checkout/booking-receipt.tsx apps/web/src/components/checkout/booking-receipt.spec.tsx apps/web/src/app/globals.css
git commit -m "feat(web): hoá đơn chờ in ở /checkout/success và /checkout/cancel, cuống đơn đã đóng nói thẳng (G37)"
```

---

## Sau khi thi công — việc của session gốc

1. **Review max** cả nhánh (skill `code-review`), vá trọn trên nhánh.
2. **Gate đầy đủ:** `pnpm gate:int` (hãm tài nguyên theo memory "Hãm tài nguyên khi chạy việc nặng").
3. **Đo bố cục bằng Edge headless** (spec §9) — route tạm KHÔNG commit, ví dụ
   `apps/web/src/app/(site)/zz-print/page.tsx`, render `VoucherPrint`/`ReceiptPrint` từ fixture theo query:
   voucher {sắp đi, đang đi, đã đi, đã huỷ} × {một ngày, 12 ngày, không ảnh} và một ca tên tour 70 ký
   tự; hoá đơn {đang chờ, đã đóng, bị thu rồi hoàn}. In ra PDF (`--print-to-pdf`,
   `--no-pdf-header-footer`) và kiểm:
   - mỗi biến thể **đúng một trang** (`/Count 1`) — thừa một trang trắng thì soát `h-[297mm]` và luật
     `display: block` của body trước khi hạ chiều cao;
   - không phần tử nào tràn khổ (chụp ảnh: CSS tạm `[data-print-doc]{display:flex!important}`);
   - in từ giao diện tối (`<html class="dark">`) ra giấy sáng; bìa: viên sau logo, "ora", loại tài liệu
     teal nhạt;
   - chữ Việt đúng (Hội An, Phú Quốc, Nguyễn Thái Học), không "Sept".
   Gỡ route tạm, xoá `.next` của nó.
4. **User duyệt bằng mắt** (memory "Giao diện theo wireframe: user xác nhận bằng mắt") trên dev với đơn
   thật, user tự đăng nhập pane: voucher sắp đi, đã đi, đã huỷ; hoá đơn chờ; xem trước bản in sáng và
   tối. Gửi ảnh chụp cạnh bản thảo 5b/B1.
5. **Docs:** entry CHANGELOG (nội dung, findings, số test); open-items G40 ghi Phần 1 xong, G37 phần cuống
   đã đóng; spec §11 đánh dấu Phần 1.
6. Hỏi user trước khi merge và push (luật 2); sau push canh ba đèn (Actions, Render, Vercel) và thử tay
   production theo spec §10 bước 1–3.
