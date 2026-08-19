# Kế hoạch: receipt thay tấm vé ở `/checkout/success`

> **For agentic workers:** dùng `superpowers:executing-plans`. **KHÔNG dispatch
> subagent** — user chốt 13/08 là làm inline.

**Goal:** Thay tấm vé boarding-pass ở `/checkout/success` bằng receipt hợp nhất
đã duyệt ([wireframe](../design/mockups/receipt-ticket.src.html)), giữ nguyên
`CheckoutShell` cho `/checkout/cancel`.

**Architecture:** Component mới `BookingReceipt` nhận `Booking` + `mood`, render
đúng khung wireframe. `CheckoutShell` KHÔNG đụng tới ngoài phần barcode dùng
chung. Trang success giữ `ContentHero` (nó là thứ cho navbar nền tối) và thay
phần thân.

**Tech Stack:** Next 16 RSC, Base UI qua `@tourism/ui`, Tailwind v4 + token, Vitest.

## Global Constraints

- **Nguồn sự thật cho markup là wireframe đã duyệt**, không chép số đo vào đây.
- **Tokens-only, KHÔNG hex** (luật 6). Ánh xạ từ wireframe: `--line` → `border`,
  `--muted` → `muted-foreground`, `--band` → `muted/40`, `--ink` → `foreground`,
  `--tone-success/warning/muted` → `success`/`warning`/`muted-foreground`.
- **Comment tiếng Việt** (luật 8); copy user-facing English trong `@tourism/i18n`
  (luật 7).
- **Commit Conventional, message tiếng Việt CÓ DẤU, KHÔNG trailer AI** (luật 12).
- **`pnpm gate:int` trước khi khai xong** (luật 11) — cần hỏi user để tắt cổng 3000.
- **KHÔNG đụng schema.** Mọi trường cần đã có trong `BookingSchema`.

---

## Task 1: Barcode dày hơn, dùng chung hai nơi

**Files:** `apps/web/src/lib/checkout.ts` · `apps/web/src/lib/checkout.spec.ts` ·
`apps/web/src/components/checkout/checkout-shell.tsx`

⚠ **Đây là task RỦI RO NHẤT của cụm** vì nó đụng code `/checkout/cancel` đang
dùng. Làm trước để có thời gian nghiệm thu.

- [ ] **Step 1** — test trước: `ticketBarcodeWidths` trả **64** phần tử, vẫn
  deterministic theo mã, giá trị vẫn trong 1–4.
- [ ] **Step 2** — chạy, phải ĐỎ (hiện là 28).
- [ ] **Step 3** — đổi `TICKET_BARCODE_BAR_COUNT` 28 → 64. Công thức giữ nguyên.
- [ ] **Step 4** — `TicketBarcode` trong `checkout-shell.tsx`: **bỏ `gap-px`**.
  Lý do bỏ: mã vạch thật thì vạch và khoảng trắng dính liền; khe đều chen giữa
  làm nó đọc thành dãy sọc trang trí. Bỏ gap cũng là điều kiện để 64 vạch vừa
  cuống: 64 vạch dính liền ≈ 164px, còn có gap thì ≈ 227px và **tràn** cuống
  rộng ~200px của vé dọc.
- [ ] **Step 5** — chạy test, phải XANH.
- [ ] **Step 6** — **nghiệm thu `/checkout/cancel` bằng mắt** (nó là consumer
  còn lại). Barcode phải nằm gọn trong cuống, không tràn.
- [ ] **Step 7: Commit** — `refactor(web): mã vạch dày 64 vạch, bỏ khe giữa vạch`

---

## Task 2: Copy i18n cho receipt

**Files:** `libs/shared/i18n/src/lib/messages.ts`

- [ ] **Step 1** — thêm vào `booking.success` những khoá MỚI: `receiptSentTo`,
  `travellersLabel` (đã có), `tripLabel`, `paidAtLabel`, `perTraveller`,
  `adultsRow`/`childrenRow`, `taxNote`, `departsOn`, `printLabel`, `needHelp`.
  Khoá nào `booking.success` hoặc `booking.form` đã có thì DÙNG LẠI, không khai
  trùng — cùng luật đã áp ở cụm wizard.
- [ ] **Step 2** — `pnpm turbo run build --filter=@tourism/i18n` rồi test.
- [ ] **Step 3: Commit** — `feat(i18n): copy cho receipt trang success`

---

## Task 3: `BookingReceipt`

**Files:** Create `apps/web/src/components/checkout/booking-receipt.tsx` ·
Test `apps/web/src/components/checkout/booking-receipt.spec.tsx`

**Interfaces:** `<BookingReceipt booking={Booking} mood={CheckoutMood} />`

- [ ] **Step 1: Test thất bại** — khẳng định: ba cột `TRAVELLERS`/`TRIP`/`PAYMENT`
  có mặt; mã đặt chỗ hiện ở CẢ meta lẫn cuống (hai hành động khác nhau, chủ đích);
  bảng tiền in `Adults × N` và `Children × N` và tổng; **`mood` đổi thì pill và
  băng tone đổi theo**; và tour KHÔNG có `tourImage` thì không render `<img>` vỡ.
- [ ] **Step 2** — chạy, ĐỎ.
- [ ] **Step 3** — dựng component theo wireframe. Ba điểm dễ sai:
  · dải chân tràn hết bề rộng card nên nằm NGOÀI padding của card;
  · đường xé là background xếp lớp trên mép dải chân, KHÔNG phải thẻ riêng
    (thẻ riêng sẽ ăn `gap` của card — đã dính lúc dựng wireframe);
  · băng tone khai TỪNG CẠNH khi in, `border` rút gọn sẽ ghi đè nó.
- [ ] **Step 4** — chạy, XANH.
- [ ] **Step 5: Commit** — `feat(web): component receipt cho trang success`

---

## Task 4: Nối vào trang, KHÔNG để hai tiêu đề

**Files:** `apps/web/src/app/(site)/checkout/success/page.tsx`

⚠ **Bẫy đã dính một lần ở `/book`**: trang có `ContentHero` (breadcrumb + tên
tour + mã), còn wireframe có hàng thương hiệu riêng. Giữ cả hai là in tên tour
hai lần.

- [ ] **Step 1** — GIỮ `ContentHero`: nó là thứ cho navbar nền tối
  (`/checkout/success` nằm trong `HERO_LESS_EXCEPTIONS`), gỡ đi là làm hỏng
  navbar y như lỗi `/enquire` hôm qua.
- [ ] **Step 2** — hàng thương hiệu của wireframe KHÔNG bê sang; chỉ giữ hàng
  NÚT (`Copy code` · `Print`), canh phải, đặt giữa hero và card.
- [ ] **Step 3** — thay `CheckoutShell` bằng `BookingReceipt`. Giữ nguyên khối
  "What happens next" (chỉ mood confirmed) và hàng CTA phía dưới — đó là nội
  dung có thật, wireframe không phủ nhận nó.
- [ ] **Step 4** — `pnpm gate`, phải xanh.
- [ ] **Step 5: Commit** — `feat(web): trang success dùng receipt thay tấm vé`

---

## Task 5: Nghiệm thu và docs sweep

- [ ] **Step 1** — nghiệm thu bằng mắt trên trang thật CẢ BA mood. Cần một
  booking PAID: `pnpm --filter @tourism/api demo:account` tạo sẵn (script có
  thật, đã đọc).
- [ ] **Step 2** — kiểm bản IN: mã vạch còn mực khi tắt background graphics.
- [ ] **Step 3** — `pnpm gate:int` (hỏi user trước khi tắt cổng 3000).
- [ ] **Step 4** — 1 entry CHANGELOG + đổi dòng 🚧 receipt ở `docs/README.md`
  thành ✅. Kiểm dấu và `grep '^+'` TRƯỚC khi stage.
- [ ] **Step 5** — hỏi user trước khi merge/push, rồi liếc đèn CI.

---

## Rủi ro đã biết

| Rủi ro | Xử lý |
| --- | --- |
| Đổi barcode làm vỡ `/checkout/cancel` | Task 1 làm TRƯỚC và có bước nghiệm thu mắt riêng |
| Hai tiêu đề chồng nhau | Task 4 Step 1–2 nói thẳng; đã dính một lần ở `/book` |
| Gỡ `ContentHero` làm navbar tàng hình | Task 4 Step 1 cấm gỡ, kèm lý do |
| Mã vạch không in ra | Task 5 Step 2 kiểm riêng |
| Mất khối "What happens next" | Task 4 Step 3 giữ tường minh |
