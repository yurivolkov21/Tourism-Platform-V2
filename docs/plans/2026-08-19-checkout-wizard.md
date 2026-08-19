# Kế hoạch: wizard 4 bước cho trang đặt chỗ + tách route hỏi báo giá

> **For agentic workers:** dùng `superpowers:executing-plans` để thi công từng
> task. Các bước dùng checkbox (`- [ ]`) để theo dõi. **KHÔNG dispatch subagent**
> — user chốt 13/08 là làm inline.

**Goal:** Dựng lại `/tours/[slug]/book` thành wizard 4 bước (Dates → Travellers →
Review → Pay) đúng bằng bốn wireframe đã duyệt, và tách nhánh "chuyến riêng" sang
route CÔNG KHAI `/tours/[slug]/enquire`.

**Architecture:** Giữ `lib/booking-form.ts` làm tầng thuần và mở rộng nó bằng
logic bước (danh sách bước, lỗi theo bước, điều kiện đi tiếp) để TDD ở môi trường
node. `BookingForm` biến thành `BookingWizard` — MỘT client island giữ toàn bộ
state của cả bốn bước cộng cột tóm tắt dùng chung; đổi bước chỉ là đổi phần thân
render, không đổi state. `BookingModes` bị xoá: hai nhánh không còn đứng chung
trang nên không còn công tắc. `PrivateTripForm` chuyển sang trang mới, giữ nguyên
nội dung.

**Tech Stack:** Next 16 App Router (RSC + client island), Base UI qua
`@tourism/ui`, Tailwind v4 + token `@tourism/tokens`, Vitest.

## Global Constraints

- **Nguồn sự thật cho markup là bốn wireframe đã duyệt**, KHÔNG chép lại số đo
  vào plan này (một số đo hai nơi là hai nguồn sẽ lệch nhau):
  [bước 1](../design/mockups/checkout-step1-dates.src.html) ·
  [bước 2](../design/mockups/checkout-step2-travellers.src.html) ·
  [bước 3](../design/mockups/checkout-step3-review.src.html) ·
  [bước 4](../design/mockups/checkout-step4-pay.src.html)
- **Tokens-only, KHÔNG hex** (luật 6). Wireframe viết bằng giá trị thô vì nó nằm
  ngoài app; khi dựng phải ánh xạ sang token: `--border` cho đường kẻ và viền
  thẻ, `--muted-foreground` cho chữ phụ, `--foreground`/`--background` cho nền
  nút chính, `--price-compare` cho giá gạch, `--input` cho viền ô nhập.
- **Comment code bằng tiếng Việt** (luật 8); identifier tiếng Anh.
- **Copy user-facing English-only, đặt trong `@tourism/i18n`** (luật 7). Không
  hardcode chuỗi trong component.
- **Commit Conventional Commits, message tiếng Việt CÓ DẤU, KHÔNG trailer AI**
  (luật 12). Kiểm `git log` sau mỗi commit.
- **`pnpm gate:int` trước khi khai xong** (luật 11). `pnpm gate` chỉ cho vòng TDD.
- **KHÔNG đụng schema.** Cả 8 trường của `CreateBookingInputSchema` đã đủ cho bốn
  bước; `TourDetailSchema.included/excluded` đã có sẵn ở cả 29 tour.
- **KHÔNG thêm `/enquire` vào `proxy.ts` matcher** — để công khai là chủ đích:
  `enquiries.create` vốn gọi browser-direct KHÔNG kèm auth (ADR-0016 §2).
- **Trẻ em tính CÙNG giá người lớn** — quyết định 18/08, ghi ở bản đồ docs. Giao
  diện phải nói rõ, không im lặng.

---

## Task 1: Logic bước — tầng thuần (TDD)

**Files:**
- Modify: `apps/web/src/lib/booking-form.ts`
- Test: `apps/web/src/lib/booking-form.spec.ts`

**Interfaces:**
- Consumes: `BookingFormState`, `BookingFormErrors`, `validateBookingForm` (đã có)
- Produces:
  - `type BookingStep = 'dates' | 'travellers' | 'review' | 'pay'`
  - `const BOOKING_STEPS: readonly BookingStep[]`
  - `stepOf(field: keyof BookingFormState): BookingStep`
  - `stepErrors(step: BookingStep, state: BookingFormState): BookingFormErrors`
  - `canLeaveStep(step: BookingStep, state: BookingFormState): boolean`

- [ ] **Step 1: Viết test thất bại** — thêm vào `booking-form.spec.ts`:

```ts
describe('logic bước của wizard', () => {
  it('mỗi trường thuộc đúng một bước', () => {
    expect(stepOf('departureId')).toBe('dates');
    expect(stepOf('numAdults')).toBe('travellers');
    expect(stepOf('contactEmail')).toBe('travellers');
    expect(stepOf('paymentProvider')).toBe('pay');
  });

  it('stepErrors chỉ trả lỗi của bước đó', () => {
    const broken = { ...base, departureId: null, contactEmail: '' };
    expect(Object.keys(stepErrors('dates', broken))).toEqual(['departureId']);
    expect(Object.keys(stepErrors('travellers', broken))).toEqual(['contactEmail']);
  });

  it('canLeaveStep chặn khi bước hiện tại còn lỗi', () => {
    expect(canLeaveStep('dates', { ...base, departureId: null })).toBe(false);
    expect(canLeaveStep('dates', base)).toBe(true);
  });

  it('bước review không có trường riêng nên luôn qua được', () => {
    expect(canLeaveStep('review', base)).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy để chắc là ĐỎ**

Run: `pnpm turbo run test --filter=@tourism/web -- booking-form`
Expected: FAIL — `stepOf is not a function`

- [ ] **Step 3: Cài đặt tối thiểu** trong `booking-form.ts` — một bảng
  `FIELD_STEP: Record<keyof BookingFormState, BookingStep>` làm NGUỒN DUY NHẤT,
  `stepOf` tra bảng, `stepErrors` lọc `validateBookingForm` theo bảng,
  `canLeaveStep` là `Object.keys(stepErrors(...)).length === 0`.

  Lý do dùng bảng thay vì bốn mảng rời: thêm một trường mới mà quên xếp bước thì
  TypeScript báo ngay (Record đủ khoá), còn mảng rời thì im lặng.

- [ ] **Step 4: Chạy lại, phải XANH**

- [ ] **Step 5: Commit** — `test(web): logic bước cho wizard đặt chỗ`

---

## Task 2: Copy i18n cho wizard

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts`
- Test: `libs/shared/i18n/src/lib/messages.spec.ts` (nếu file đó đang canh shape)

**Interfaces:**
- Produces: `messages.booking.wizard` gồm `stepLabels` (4 nhãn), `dates`,
  `travellers`, `review`, `pay` (mỗi cái có `heading` + `sub`), `back`,
  `continue`, `payCta(total)`, `secureNote`, `childRateNote`, `includedHeading`,
  `notIncludedHeading`, `testModeNote`, `soldOut` (`heading`/`body`/`cta`).

- [ ] **Step 1** — đọc `messages.spec.ts` xem có test canh shape không; nếu có,
  thêm case cho khoá mới TRƯỚC.
- [ ] **Step 2** — thêm cụm `wizard` vào `messages.booking`. Copy tiếng Anh lấy
  ĐÚNG chữ trong wireframe (đã duyệt), không viết lại.
- [ ] **Step 3** — `pnpm turbo run test --filter=@tourism/i18n`, phải xanh.
- [ ] **Step 4: Commit** — `feat(i18n): copy cho wizard đặt chỗ 4 bước`

---

## Task 3: Route công khai `/tours/[slug]/enquire`

**Files:**
- Create: `apps/web/src/app/(site)/tours/[slug]/enquire/page.tsx`
- Test: `apps/web/src/components/booking/private-trip-form.spec.tsx` (đã có, giữ)
- Đọc để KHÔNG sửa: `apps/web/src/proxy.ts`

**Interfaces:**
- Consumes: `PrivateTripForm` (giữ nguyên nội dung), `fetchTourDetail`
- Produces: route `/tours/[slug]/enquire`

- [ ] **Step 1** — dựng page: `fetchTourDetail(slug)`, `notFound()` nếu không có,
  header giống `/book` (breadcrumb + tên tour + route chain), rồi `PrivateTripForm`.
- [ ] **Step 2** — **KHÔNG gọi `requireSession`**. Tên/email để rỗng thay vì lấy
  từ session; khách vãng lai phải dùng được. `metadata.robots` = noindex như `/book`.
- [ ] **Step 3** — xác nhận `proxy.ts` matcher KHÔNG chứa `/enquire`:
  `grep -n "matcher" apps/web/src/proxy.ts` → vẫn `['/account/:path*', '/tours/:slug/book', '/checkout/:path*']`.
- [ ] **Step 4** — smoke bằng curl khi server đang chạy:
  `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/tours/hanoi-heritage-day/enquire` → mong đợi `200` KHI CHƯA đăng nhập.
- [ ] **Step 5: Commit** — `feat(web): route công khai /enquire cho chuyến riêng`

---

## Task 4: CTA ở trang chi tiết trỏ đúng hai nhánh

**Files:**
- Modify: `apps/web/src/components/tours/booking-rail.tsx` (2 chỗ: ~dòng 73 và ~108)
- Modify: `apps/web/src/components/tours/tour-media-panel.tsx` (~dòng 294)
- Test: spec tương ứng của hai file (nếu có)

- [ ] **Step 1** — viết/ sửa test: rail phải render link `/tours/{slug}/book` VÀ
  link `/tours/{slug}/enquire`.
- [ ] **Step 2** — thêm link phụ "Request a private trip" dưới CTA chính, dùng
  copy từ i18n. CTA chính giữ nguyên `Reserve`.
- [ ] **Step 3** — chạy test, phải xanh.
- [ ] **Step 4: Commit** — `feat(web): tách CTA đặt chỗ và hỏi chuyến riêng`

---

## Task 5: Vỏ wizard — stepper, đổi bước, thanh chân

**Files:**
- Create: `apps/web/src/components/booking/booking-wizard.tsx`
- Create: `apps/web/src/components/booking/wizard-stepper.tsx`
- Test: `apps/web/src/components/booking/booking-wizard.spec.tsx`

**Interfaces:**
- Consumes: `BOOKING_STEPS`, `canLeaveStep`, `stepErrors` (Task 1);
  `messages.booking.wizard` (Task 2)
- Produces: `<BookingWizard>` nhận đúng prop mà `BookingForm` đang nhận, cộng
  `included: string[]` và `excluded: string[]`

- [ ] **Step 1: Test thất bại** — render wizard, khẳng định:
  chỉ thân bước hiện tại có mặt; bấm `Continue` khi chưa chọn đợt thì KHÔNG sang
  bước 2 và hiện lỗi; chọn đợt rồi bấm thì sang bước 2; bấm `Back` quay lại và
  **giữ nguyên** dữ liệu đã nhập.
- [ ] **Step 2** — chạy, phải ĐỎ.
- [ ] **Step 3** — dựng `wizard-stepper.tsx` (4 vạch + nhãn, vạch của bước đã qua
  và bước hiện tại đều tô đậm — hành vi "tô dần" đã đo ở mẫu gốc) và
  `booking-wizard.tsx` giữ `useState<BookingStep>`. State form dùng lại nguyên
  `BookingFormState`, KHÔNG tách theo bước — đó là thứ làm `Back` giữ được dữ liệu.
- [ ] **Step 4** — chạy, phải XANH.
- [ ] **Step 5: Commit** — `feat(web): vỏ wizard 4 bước cho trang đặt chỗ`

---

## Task 6: Bốn thân bước

**Files:**
- Create: `apps/web/src/components/booking/steps/step-dates.tsx`
- Create: `apps/web/src/components/booking/steps/step-travellers.tsx`
- Create: `apps/web/src/components/booking/steps/step-review.tsx`
- Create: `apps/web/src/components/booking/steps/step-pay.tsx`
- Test: một spec cho mỗi file
- Đọc: bốn wireframe (nguồn markup)

**Interfaces:**
- Mỗi step nhận `{ state, errors, set, ... }` từ wizard; KHÔNG tự giữ state.

- [ ] **Step 1** — `step-dates.tsx`: chuyển nguyên list thẻ đợt đang có trong
  `booking-form.tsx` (dòng ~131–192) sang, đổi vỏ theo wireframe. Test: đợt hết
  chỗ phải `disabled`; bấm đợt đổi `departureId`.
- [ ] **Step 2** — `step-travellers.tsx`: hai `Stepper` + 4 ô liên hệ. Test: dòng
  `childRateNote` phải có mặt (không được im lặng về giá trẻ em); `+` bị chặn khi
  chạm `partyCap`.
- [ ] **Step 3** — `step-review.tsx`: bốn khối chỉ-đọc + khối
  What's included / Not included + dòng hạn huỷ. Test: `included`/`excluded` rỗng
  thì KHÔNG render khối rỗng; link `Edit` đưa về đúng bước.
- [ ] **Step 4** — `step-pay.tsx`: đúng HAI thẻ Stripe/PayPal, **không ô thẻ nào**.
  Test: khẳng định không có `input` nào trong thân bước này (chốt chặn cho quyết
  định của user, để lần sửa sau không lén thêm form thẻ vào).
- [ ] **Step 5** — chạy toàn bộ spec của cụm booking, phải xanh.
- [ ] **Step 6: Commit** — `feat(web): bốn thân bước của wizard đặt chỗ`

---

## Task 7: Cột tóm tắt + nối vào trang, gỡ `BookingModes`

**Files:**
- Modify: `apps/web/src/components/booking/checkout-summary.tsx`
- Modify: `apps/web/src/app/(site)/tours/[slug]/book/page.tsx`
- Delete: `apps/web/src/components/booking/booking-modes.tsx` + spec của nó
- Delete: `apps/web/src/components/booking/booking-form.tsx` + spec (đã bị wizard thay)
- Test: `checkout-summary.spec.tsx`

- [ ] **Step 1** — `CheckoutSummary` đổi sang dáng cột phải của wireframe: bỏ
  khung card, thêm `border-l` + `pl`, giữ nguyên phần đầu (ảnh bìa + tên + đánh
  giá) và phần tính tiền. Test cũ phải còn xanh (nội dung không đổi, chỉ vỏ).
- [ ] **Step 2** — `book/page.tsx`: bỏ `BookingModes`, render `BookingWizard`,
  truyền thêm `included`/`excluded` từ `tour`. Bỏ `BookingSteps` cũ (stepper 2
  chấm) — wizard tự có stepper.
- [ ] **Step 3** — xoá hai file cũ và spec của chúng; `grep -rn "BookingModes\|BookingForm"`
  phải không còn kết quả nào ngoài lịch sử git.

  ⚠ **Trước khi xoá `booking-form.spec.tsx`, đối chiếu từng `it()` của nó** với
  spec bước ở Task 6 và chuyển những case chưa có sang. Xoá một file test là cách
  dễ nhất để tổng số test vẫn tăng mà độ phủ lại tụt — đếm `it()` trước và sau,
  và ghi con số vào entry CHANGELOG.
- [ ] **Step 4** — chạy `pnpm gate`, phải xanh.
- [ ] **Step 5: Commit** — `feat(web): nối wizard vào trang book, gỡ công tắc hai chế độ`

---

## Task 8: Trạng thái hết chỗ

**Files:**
- Modify: `apps/web/src/app/(site)/tours/[slug]/book/page.tsx`
- Test: thêm case vào spec của page hoặc của wizard

**Bối cảnh:** `BookingModes` cũ tự rơi về Private khi không còn đợt đặt được. Gỡ
nó đi mà không thay gì là ĐÁNH RƠI hành vi — khách vào `/book` của tour hết chỗ
sẽ gặp wizard rỗng.

- [ ] **Step 1: Test thất bại** — `departures` toàn `seatsLeft: 0` thì trang
  KHÔNG render wizard, mà render khối giải thích + link `/enquire`.
- [ ] **Step 2** — chạy, ĐỎ.
- [ ] **Step 3** — thêm nhánh sớm trong `book/page.tsx` dùng copy
  `messages.booking.wizard.soldOut`.
- [ ] **Step 4** — chạy, XANH.
- [ ] **Step 5: Commit** — `feat(web): tour hết chỗ dẫn sang hỏi chuyến riêng`

---

## Task 9: Nghiệm thu và docs sweep

- [ ] **Step 1** — `pnpm gate:int` đầy đủ (luật 11). Web dev server đang chạy nên
  **phải hỏi user trước khi tắt để build** (luật quy trình, đã dính 18/08).
- [ ] **Step 2** — nghiệm thu bằng mắt trên trang thật: đi hết 4 bước, bấm `Back`
  kiểm dữ liệu còn nguyên, và `/enquire` mở được khi CHƯA đăng nhập.
- [ ] **Step 3** — 1 entry `docs/CHANGELOG.md` + cập nhật dòng 🚧 ở
  `docs/README.md` thành ✅ merge (luật 13).
- [ ] **Step 4** — kiểm dấu tiếng Việt và `grep '^+' docs/CHANGELOG.md` TRƯỚC khi
  `git add`.
- [ ] **Step 5** — hỏi user trước khi merge/push (luật 2), rồi liếc đèn CI (luật 14).

---

## Rủi ro đã biết

| Rủi ro | Xử lý |
| --- | --- |
| Gỡ `BookingModes` làm mất nhánh hết-chỗ | Task 8 dựng lại tường minh, có test |
| `/enquire` vô tình bị auth chặn | Task 3 Step 3+4 kiểm `proxy.ts` và curl khi chưa đăng nhập |
| Bước Pay lén mọc ô nhập thẻ ở lần sửa sau | Task 6 Step 4 có test khẳng định KHÔNG có `input` |
| Wizard làm mất dữ liệu khi bấm Back | Task 5 Step 1 có test riêng cho đúng chuyện đó |
| Số đo lệch khỏi wireframe | Wireframe là nguồn duy nhất; không chép số vào plan |
