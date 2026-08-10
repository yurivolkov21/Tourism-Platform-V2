# Plan thi công — Redesign Checkout (B) + khu Account (A)

> **For agentic workers:** REQUIRED SUB-SKILL: dùng
> superpowers:subagent-driven-development (khuyến nghị) hoặc
> superpowers:executing-plans để thi công từng task. Checkbox (`- [ ]`) để track.

**Goal:** Thay tầng trình bày của checkout (`/tours/[slug]/book`,
`/checkout/success`, `/checkout/cancel`) theo hướng B "Quảng trường" và toàn khu
`/account/**` theo hướng A "Tĩnh viện", theo
[spec 2026-08-10](../specs/2026-08-10-checkout-account-redesign.md) user đã duyệt.

**Architecture:** Logic giữ nguyên (session, `booking-vm`, flow capture-on-approved,
`BookingActions` — đã có sẵn textarea lý do hủy). Một thay đổi contract/API duy
nhất: `BookingSchema` thêm `tourSlug` + `tourImage` để Trips hiển thị ảnh. Còn lại
là component trình bày mới + i18n copy mới.

**Tech Stack:** Next 16.3 App Router (RSC + client components) · Tailwind v4 qua
`@tourism/tokens` · shadcn primitives trong `@tourism/ui` · Vitest (node + jsdom)
· oRPC contract-first.

## Global Constraints (áp cho MỌI task)

- Branch: `feat/redesign-checkout-account` (đã tạo ở T0). Mỗi task ≥1 commit,
  message **Conventional Commits, tiếng Việt CÓ DẤU đầy đủ**, **KHÔNG
  AI-attribution/trailer Co-Authored-By** — sau mỗi commit chạy
  `git log -1 --format='%(trailers)'` xác nhận rỗng, có trailer thì
  `git commit --amend` gỡ.
- Comment code + JSDoc **tiếng Việt**; identifier tiếng Anh. Copy user-facing
  **English-only**, đặt trong `libs/shared/i18n/src/lib/messages.ts` — KHÔNG
  hardcode chuỗi trong JSX.
- **Tokens-only, không hex**: màu qua class Tailwind ánh xạ token
  (`bg-success/15`, `text-muted-foreground`…). KHÔNG thêm token mới.
- KHÔNG dark-pattern: không đồng hồ đếm ngược giả, không "only X left" giả.
- **KHÔNG chạy `next build`/`next dev` cho `apps/web` trong repo chính** (dev
  server của user có thể đang chạy). Việc cần build/chạy thật → git worktree
  (T11). Vòng TDD chỉ dùng `pnpm gate` (build+typecheck+unit+lint); int test để
  T1 và T11 (`pnpm gate:int`).
- KHÔNG đụng: `apps/api/prisma/migrations/**` (bất biến), trang public ngoài
  scope, trang auth, giá trị token màu/font, entry cũ `docs/CHANGELOG.md`.
- Vitest theo nếp repo: file spec cạnh file nguồn (`*.spec.ts(x)`), jsdom cho
  component (xem các spec sẵn có trong `apps/web/src/components/account/`).
- Lệnh test nhanh một package: `pnpm turbo run test --filter=@tourism/web`
  (tương tự `@tourism/contract`, `@tourism/api`, `@tourism/ui`).

## File Structure (toàn cụm)

```text
libs/shared/contract/src/schemas/bookings.ts        # T1: +tourSlug +tourImage
apps/api/src/modules/bookings/…                     # T1: select/map 2 field mới
apps/web/src/components/booking/checkout-summary.tsx# T2: card summary B (mới)
apps/web/src/components/booking/booking-form.tsx    # T3: layout lưới 2 cột B
apps/web/src/components/booking/booking-modes.tsx   # T3: nhận props tour visual
apps/web/src/app/(site)/tours/[slug]/book/page.tsx  # T3: steps + truyền tour
apps/web/src/components/checkout/checkout-shell.tsx # T4: voucher-first
apps/web/src/app/(site)/checkout/{success,cancel}/  # T4
apps/web/src/components/account/account-nav.tsx     # T5: 3 tab
apps/web/src/app/(site)/account/page.tsx            # T5: redirect
apps/web/src/components/account/trip-card.tsx       # T6: card Trips A (mới)
apps/web/src/app/(site)/account/bookings/page.tsx   # T6: nhóm Upcoming/past A
apps/web/src/app/(site)/account/bookings/[code]/    # T7: detail A
apps/web/src/components/account/profile-summary.tsx # T8: hàng-nở-inline
apps/web/src/components/account/danger-zone.tsx     # T8: → text-link (đổi tên)
apps/web/src/components/account/saved-grid.tsx      # T9: empty-state dạy hành vi
libs/shared/ui/src/components/button.tsx            # T10: viền dark cho primary
libs/shared/i18n/src/lib/messages.ts                # T3–T9: copy mới
```

---

### Task 0: Mở branch + neo hiện trạng

- [ ] **Bước 1:** `git checkout main && git pull && git checkout -b feat/redesign-checkout-account`
- [ ] **Bước 2:** `pnpm gate` — phải XANH trước khi sửa gì (neo baseline; nếu đỏ,
      DỪNG và báo, đừng sửa lỗi không thuộc cụm).

### Task 1: Contract + API — `BookingSchema` thêm `tourSlug` + `tourImage`

**Files:**
- Modify: `libs/shared/contract/src/schemas/bookings.ts` (khối `BookingSchema`)
- Test: `libs/shared/contract/src/schemas/bookings.spec.ts`
- Modify: `apps/api/src/modules/bookings/` — service map booking→DTO (tìm nơi
  dựng object trả về có `tourTitle`, thêm 2 field cạnh đó; thêm
  `tour: { select: { slug, cover… } }` vào các câu Prisma select tương ứng
  của list/byCode)
- Test: int spec bookings hiện có của API (mở rộng assertion)

**Interfaces (Produces):** `Booking` từ `@tourism/contract` có thêm
`tourSlug: string` và `tourImage: MediaItem | null` (đúng `MediaItemSchema`
trong `schemas/media.ts` — snapshot `tour.cover` tại thời điểm ĐỌC, không phải
cột DB mới, không migration). T6/T7 dùng để render ảnh + link về trang tour.

- [ ] **Bước 1 — test contract fail trước:** thêm vào `bookings.spec.ts` ca
      parse một booking hợp lệ CÓ `tourSlug`/`tourImage` (và `tourImage: null`
      hợp lệ). Chạy
      `pnpm turbo run test --filter=@tourism/contract` → FAIL (unrecognized key
      hoặc thiếu field tùy strict).
- [ ] **Bước 2 — sửa schema:**

```ts
// Trong BookingSchema, ngay dưới tourTitle:
  /** Slug tour để link ngược về trang tour — snapshot lúc đọc, join từ quan hệ. */
  tourSlug: z.string().min(1).max(160),
  /** Ảnh cover tour cho card Trips (hướng A) — null khi tour chưa có media. */
  tourImage: MediaItemSchema.nullable(),
```

  (import `MediaItemSchema` từ `./media`.) Nếu `AdminBookingDetailSchema` extend
  từ `BookingSchema` thì tự hưởng, không sửa thêm.
- [ ] **Bước 3:** chạy lại filter contract → PASS.
- [ ] **Bước 4 — API:** trong service bookings, các query nuôi `list` + `byCode`
      thêm quan hệ tour (slug + cover theo đúng cách các module khác select
      media — xem cách `catalog` dựng `cover`); chỗ map DTO thêm
      `tourSlug: b.tour.slug, tourImage: <cover đã map> ?? null`. Sửa cả
      fixture/mock trong unit spec API nếu có shape booking.
- [ ] **Bước 5:** `pnpm gate:int` (cần Docker Postgres — máy dev CÓ, cứ chạy) —
      int spec bookings mở rộng: assert response list item có `tourSlug` đúng
      slug seed và `tourImage.url` khớp cover seed (hoặc null nếu seed không
      media). PASS toàn bộ.
- [ ] **Bước 6:** commit
      `feat(api): booking mang tourSlug và tourImage cho khu Trips`.

### Task 2: `CheckoutSummary` — card tóm tắt đơn (hướng B)

**Files:**
- Create: `apps/web/src/components/booking/checkout-summary.tsx`
- Test: `apps/web/src/components/booking/checkout-summary.spec.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts` — thêm khối `checkoutSummary`

**Interfaces:**
- Consumes: `DepartureVM` (`@/lib/api/tours`), `formatMoney`/`formatDateRange`
  (`@/lib/tours`), `MediaItem` (`@tourism/contract`).
- Produces: component client-safe (KHÔNG `'use client'` — thuần render, để
  form client import):

```ts
export interface CheckoutSummaryTour {
  title: string;
  cover: MediaItem | null;
  durationDays: number;
  destinationNames: string[];
  ratingAvg: number | null;
  ratingCount: number;
}
export function CheckoutSummary(props: {
  tour: CheckoutSummaryTour;
  departure: DepartureVM | null; // null → chưa chọn: breakdown hiện dấu —
  numAdults: number;
  numChildren: number;
  currency: string;
  cta: ReactNode; // nút submit của form đặt vào đây (nằm trong <form> cha)
}): ReactNode;
```

- [ ] **Bước 1 — i18n:** thêm `checkoutSummary` vào `messages.ts` (English):
      `heading: 'Order summary'`, `freeCancellation: 'Free cancellation'`,
      `instantConfirmation: 'Instant confirmation'`,
      `adultsLine: (n: number) => …`, `childrenLine: (n: number) => …`,
      `totalLabel: 'Total'`, `taxesNote: 'Includes all taxes and fees.'`,
      `trustRow: 'Stripe & PayPal · SSL encrypted · 24/7 support'`,
      `pickDeparture: 'Select a departure to see your total'`.
- [ ] **Bước 2 — test fail trước** (jsdom, theo khuôn spec account sẵn có):
      (a) có departure + 2 adults 1 child → thấy 2 dòng breakdown đúng số tiền
      (`effectivePrice × n`, trẻ em CÙNG đơn giá — luật hệ thống) + total đúng;
      (b) `numChildren: 0` → không render dòng children;
      (c) `departure: null` → hiện `pickDeparture`, không hiện total;
      (d) badge Free cancellation + Instant confirmation luôn hiển thị;
      (e) `cover: null` → không render `<img>` (không vỡ layout).
      Chạy `pnpm turbo run test --filter=@tourism/web` → FAIL.
- [ ] **Bước 3 — implement:** card `rounded-2xl border bg-card overflow-hidden`:
      ảnh `cover.url` (nếu có, `aspect-[16/9] object-cover`, alt từ
      `cover.alt`), thân: title đậm, meta một dòng
      (`{durationDays} days · {destinationNames.join(' · ')}` + rating
      `★ {ratingAvg} ({ratingCount})` khi `ratingAvg !== null`, sao dùng
      `text-rating`), hàng badge chip (`bg-success/15 text-success`,
      `bg-info/10 text-info`), divider, breakdown (`tabular-nums`), dòng total
      đậm `text-lg`, `taxesNote` nhỏ, rồi `{cta}` full-width, dưới cùng
      `trustRow` chữ nhỏ `text-muted-foreground` ngăn cách `border-t`. Tiền
      luôn qua `formatMoney(String(x), currency)`.
- [ ] **Bước 4:** chạy lại filter web → PASS. `pnpm gate` xanh.
- [ ] **Bước 5:** commit
      `feat(web): card tóm tắt đơn CheckoutSummary cho checkout hướng B`.

### Task 3: Trang book — lưới 2 cột B + step indicator

**Files:**
- Modify: `apps/web/src/app/(site)/tours/[slug]/book/page.tsx`
- Modify: `apps/web/src/components/booking/booking-modes.tsx`
- Modify: `apps/web/src/components/booking/booking-form.tsx`
- Test: `apps/web/src/components/booking/booking-form.spec.tsx` (mở rộng, giữ
  các ca cũ xanh)
- Modify: `libs/shared/i18n/src/lib/messages.ts` — khối `booking.page` thêm
  `steps: { trip: 'Trip details', payment: 'Payment' }`,
  `paymentStepNote: 'Payment happens on the next screen, hosted by your provider.'`

**Interfaces:**
- Consumes: `CheckoutSummary` + `CheckoutSummaryTour` (T2). `TourDetailVM` có
  `cover`, `ratingAvg`, `ratingCount`, `destinations[].name`.
- Produces: `BookingModes` nhận thêm prop
  `summaryTour: CheckoutSummaryTour`; `BookingForm` cũng vậy và tự render lưới.

- [ ] **Bước 1 — test fail trước:** thêm ca vào `booking-form.spec.tsx`:
      (a) render step indicator: thấy `Trip details` (bước hiện tại) và
      `Payment` (bước tới, mờ); (b) tổng tiền hiển thị TRONG summary card
      (`Order summary` heading có mặt); (c) đổi stepper adults → total trong
      summary đổi theo (re-dùng cách ca cũ đang tương tác stepper). FAIL.
- [ ] **Bước 2 — `booking-form.tsx`:** giữ NGUYÊN toàn bộ state/submit/validate;
      đổi phần return: bọc `<form>` là
      `grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start`;
      cột trái = 3 card `rounded-2xl border bg-card p-6` theo thứ tự
      **Trip details** (departure picker + steppers hiện có),
      **Lead traveler** (ô name/email hiện có), **Payment method** (2 tile
      Stripe/PayPal hiện có — giữ logic `ProviderChoice`, khoác skin tile
      `border rounded-xl` + `sel` viền primary như pattern `a-payopt`);
      cột phải = `<div className="lg:sticky lg:top-24"><CheckoutSummary …
      cta={<Button type="submit" …>{copy CTA hiện có} · {total}</Button>}/></div>`.
      Khối tổng-tiền cũ ở chân form GỠ (summary thay thế). Mobile: summary
      nằm TRÊN form (`order-first lg:order-none` cho cột phải).
- [ ] **Bước 3 — `booking-modes.tsx`:** thêm prop `summaryTour`, truyền xuyên
      xuống `BookingForm`. Nhánh `PrivateTripForm` giữ một cột như cũ (không
      summary tiền — không có giá).
- [ ] **Bước 4 — `book/page.tsx`:** trên `BookingModes` thêm step indicator
      (component nhỏ nội bộ file page, RSC): ① chấm tròn `bg-primary
      text-primary-foreground` + nhãn `steps.trip`, gạch nối `bg-border`, ② chấm
      `bg-muted text-muted-foreground` + nhãn `steps.payment`, kèm
      `paymentStepNote` chữ nhỏ. Dựng `summaryTour` từ `tour` đã fetch:
      `{ title, cover: tour.cover, durationDays, destinationNames:
      tour.destinations.map(d => d.name), ratingAvg, ratingCount }` và truyền
      vào `BookingModes`.
- [ ] **Bước 5:** filter web PASS (cả ca cũ lẫn mới) + `pnpm gate` xanh.
- [ ] **Bước 6:** commit
      `feat(web): trang đặt chỗ lưới hai cột hướng B với summary dính`.

### Task 4: Checkout success voucher-first + cancel trung thực

**Files:**
- Modify: `apps/web/src/components/checkout/checkout-shell.tsx`
- Create: `apps/web/src/components/checkout/copy-code-button.tsx`
- Modify: `apps/web/src/app/(site)/checkout/success/page.tsx`
- Modify: `apps/web/src/app/(site)/checkout/cancel/page.tsx`
- Test: `apps/web/src/components/checkout/copy-code-button.spec.tsx`
- Modify: `messages.ts` — `booking.success` thêm
  `copyCode: 'Copy code'`, `copied: 'Copied'`, `nextHeading: 'What happens next'`,
  `nextEmail: 'A confirmation email is on its way to your inbox.'`,
  `nextVoucher: 'Your booking code is your voucher — show it at the meeting point.'`,
  `nextManage: 'View or cancel this trip anytime in Trips.'`;
  `booking.cancel` (đọc key thật trong file trước khi thêm) bổ sung
  `heldNote: 'No charge was made. Your reservation is held for up to an hour — you can finish payment from Trips.'`

**Interfaces:**
- Consumes: `CheckoutShell` props hiện tại
  (`tone/title/body/code/codeLabel/children`) — GIỮ chữ ký; `checkoutMood` +
  `CheckoutAutoRefresh` giữ nguyên.
- Produces: `CopyCodeButton({ code }: { code: string })` — client, ghi
  clipboard, đổi nhãn `copyCode → copied` 2 giây.

- [ ] **Bước 1 — test fail trước:** spec `copy-code-button`: click → gọi
      `navigator.clipboard.writeText('TRV-…')` (mock) + nhãn đổi `Copied`. FAIL.
- [ ] **Bước 2 — implement `CopyCodeButton`** (`'use client'`, `useState` +
      `setTimeout` 2000ms, `Button variant="outline" size="sm"`).
- [ ] **Bước 3 — `checkout-shell.tsx`:** đọc file, giữ props; nâng khối mã
      booking thành voucher: mã `font-mono text-2xl md:text-3xl tracking-[0.2em]`
      trong khung `rounded-xl border-2 border-dashed` + `CopyCodeButton` cạnh
      bên (chỉ render khi có `code`).
- [ ] **Bước 4 — `success/page.tsx`:** giữ toàn bộ logic mood/notFound/fact;
      thêm section "What happens next" (3 dòng `nextEmail/nextVoucher/nextManage`,
      mỗi dòng chấm tròn nhỏ `bg-primary` + text-sm) — chỉ khi
      `mood === 'confirmed'`; nút chính giữ `viewBooking`.
- [ ] **Bước 5 — `cancel/page.tsx`:** đọc file, GIỮ mọi link/logic hiện có
      (kể cả đường quay lại thanh toán nếu đang có); thay copy thân bằng
      `heldNote` (trấn an + giữ chỗ TRUNG THỰC — không đếm ngược). KHÔNG thêm
      timer nào.
- [ ] **Bước 6:** filter web PASS, `pnpm gate` xanh; commit
      `feat(web): trang success kiểu voucher và trang cancel trấn an trung thực`.

### Task 5: Khung khu account A — 3 tab, `/account` redirect, gỡ hub

**Files:**
- Modify: `apps/web/src/components/account/account-nav.tsx`
- Modify: `apps/web/src/app/(site)/account/page.tsx` (→ redirect, ~10 dòng)
- Delete: `apps/web/src/components/account/account-hub.tsx` + `.spec.tsx`
- Modify: `apps/web/src/lib/account-stats.ts` + `.spec.ts` — GỠ
  `dashboardStats`/`nextTrip`/`upcomingBookings`/`recentBookings` nếu sau khi
  gỡ hub không còn ai import (kiểm bằng grep); GIỮ `groupBookingsByTime`,
  `daysUntilDeparture`, `BookingGroups`.
- Modify: `messages.ts` — `accountNav` bỏ key `dashboard` (nếu không còn dùng),
  đổi nhãn `bookings` thành `'Trips'`.
- Modify: `docs/specs/2026-08-10-checkout-account-redesign.md` — chú thích
  **AMENDED**: nav 3 mục (không 4) vì vòng 10/08 trước đó đã nhập security vào
  profile bằng redirect 308 ("đủ route không đủ tab") — giữ quyết định đó,
  password + delete nằm trong Profile (khớp pattern Airbnb rows một trang).

**Interfaces:**
- Produces: `TABS` mới = `bookings (/account/bookings, nhãn 'Trips')` ·
  `saved` · `profile`. `/account` → `redirect('/account/bookings')`
  (import từ `next/navigation`). Route `/account/security` GIỮ redirect hiện có.

- [ ] **Bước 1 — test fail trước:** account-nav có spec? (grep; nếu chưa, thêm
      `account-nav.spec.tsx` jsdom, mock `usePathname`): render → thấy đúng 3
      tab `Trips/Saved/Profile`, KHÔNG thấy `Dashboard`; pathname
      `/account/bookings/TRV-X` → tab Trips mang `aria-current="page"`. FAIL.
- [ ] **Bước 2:** sửa `TABS` (bỏ mục `/account`), logic `isActive` bỏ nhánh so
      khớp riêng cho `/account`. Style giữ nguyên (gạch chân
      `primary-emphasis` — lý do contrast trong comment hiện có, ĐỪNG xoá
      comment đó).
- [ ] **Bước 3:** `account/page.tsx` thay toàn thân bằng redirect + JSDoc tiếng
      Việt ("hub gỡ theo spec 10/08 — 4 mục < ngưỡng 6, Trips là cửa chính"):

```tsx
import { redirect } from 'next/navigation';

/** Hub gỡ theo spec 2026-08-10 (4 mục < ngưỡng 6 của khảo sát) — Trips là cửa
 *  chính của khu account. Giữ route để mọi link/bookmark cũ không gãy. */
export default function AccountPage() {
  redirect('/account/bookings');
}
```

- [ ] **Bước 4:** xoá `account-hub.tsx` + spec; grep `dashboardStats\|nextTrip\|
      upcomingBookings\|recentBookings` toàn `apps/web` — không còn ai dùng thì
      gỡ khỏi `account-stats.ts` + spec tương ứng (còn dùng ở đâu thì GIỮ và ghi
      lại trong report). Grep `accountHub` trong `messages.ts` → gỡ khối copy
      chết.
- [ ] **Bước 5:** filter web PASS + `pnpm gate` xanh (typecheck bắt sạch import
      gãy); commit
      `feat(web): khu account còn ba tab, hub nhường chỗ cho Trips`.

### Task 6: Trips hướng A — `TripCard` + trang bookings

**Files:**
- Create: `apps/web/src/components/account/trip-card.tsx`
- Test: `apps/web/src/components/account/trip-card.spec.tsx`
- Modify: `apps/web/src/app/(site)/account/bookings/page.tsx`
- Delete: `apps/web/src/components/account/booking-card.tsx` + `.spec.tsx`
  (thay bằng TripCard; xoá SAU khi page hết import)
- Modify: `messages.ts` — `accountBookings`: nhóm mới
  `groups: { onTheRoad: 'On the road now', upcoming: 'Upcoming',
  past: 'Where you've been' }` (giữ key cũ nếu trùng), thêm
  `inDays: (n: number) => n === 0 ? 'Departing today' : n === 1 ?
  'In 1 day' : `In ${n} days``, `endsOn: (d: string) => `Ends ${d}``,
  `viewBooking: 'View booking'`, `contactUs: 'Contact us'`,
  `cancelledNote: 'Cancelled'`, `refundedNote: 'Cancelled · refunded'`,
  `leaveReview: 'Leave a review'`.

**Interfaces:**
- Consumes: `Booking` (đã có `tourSlug`/`tourImage` từ T1), `bookingView` +
  `toCancellationView` (`@/lib/booking-vm`), `daysUntilDeparture` +
  `groupBookingsByTime` (`@/lib/account-stats`), `formatDateRange`/`formatMoney`.
- Produces:

```ts
export function TripCard(props: { booking: Booking; variant: 'hero' | 'row' }): ReactNode;
```

  `hero` = card lớn (nhóm onTheRoad/upcoming): grid `sm:grid-cols-[240px_1fr]`,
  ảnh `tourImage.url` (null → khối `bg-muted` giữ chỗ), thân: eyebrow
  `inDays(daysUntilDeparture(...))` (onTheRoad: `endsOn(formatDate(end))`) chữ
  `text-primary-emphasis uppercase tracking-wide text-xs font-semibold`, title
  `font-heading text-xl`, dòng ngày + travellers, dòng mã
  `font-mono text-xs` + tổng `formatMoney`, hàng action link
  (`View booking` → `/account/bookings/{code}` · `Contact us` → `/contact`)
  kiểu text-link gạch chân mảnh, ngăn `border-t`.
  `row` = dòng gọn (nhóm past): ảnh 56px bo góc mờ `opacity-75`, tên + ngày,
  bên phải: `PAID đã qua` → link `leaveReview` về trang detail (anchor
  `#review`); `CANCELLED` → `cancelledNote`; `REFUNDED/PARTIALLY_REFUNDED` →
  `refundedNote` — tra qua `bookingView(b).tone` (muted/destructive), KHÔNG
  if/else status rải trong JSX.

- [ ] **Bước 1 — test fail trước:** spec TripCard: (a) hero upcoming hiện
      `In N days` đúng số + link detail đúng href; (b) hero thiếu ảnh không vỡ
      (không `<img>`); (c) row PAID quá khứ hiện `Leave a review`; (d) row
      CANCELLED hiện `Cancelled` và KHÔNG có link review. FAIL.
- [ ] **Bước 2 — implement `TripCard`** như Interfaces; ảnh dùng `next/image`
      nếu các card khác trong repo đang dùng (soi `booking-card.tsx` cũ trước
      khi xoá để theo cùng kỹ thuật ảnh + `sizes`).
- [ ] **Bước 3 — page:** giữ gate/fetch/load-more/`groupBookingsByTime` nguyên;
      thay khối render: H1 `Trips` (`font-heading text-3xl`), mỗi nhóm =
      kicker chữ hoa nhỏ (KHÔNG bọc `AccountSection` — hướng A ở trang này là
      dòng chảy dọc một cột), onTheRoad + upcoming render `TripCard hero` xếp
      dọc `gap-6`, past render `TripCard row` ngăn `divide-y`. EmptyState giữ
      nhưng đổi giọng theo copy hiện có. Load-more giữ nguyên vị trí/logic.
- [ ] **Bước 4:** xoá `booking-card.tsx` + spec, grep import sót. Filter web
      PASS + `pnpm gate`; commit
      `feat(web): trang Trips hướng A với TripCard đếm ngược ngày đi`.

### Task 7: Chi tiết booking hướng A

**Files:**
- Modify: `apps/web/src/app/(site)/account/bookings/[code]/page.tsx`
- Modify: `apps/web/src/components/account/booking-actions.tsx` (CHỈ phần trình
  bày nút trigger — logic dialog/reason/submit GIỮ NGUYÊN)
- Test: cập nhật `booking-actions.spec.tsx` nếu assert theo variant nút
- Modify: `messages.ts` — `accountBookingDetail` thêm
  `cancelLink: 'Cancel this booking'` (nếu copy hiện có chưa hợp giọng text-link)

**Interfaces:**
- Consumes: `Booking.tourImage`/`tourSlug` (T1); `bookingView`, `reviewSlot`,
  `BookingActions({ view, code })` giữ chữ ký.

- [ ] **Bước 1:** khối đầu trang thành hero A: ảnh `tourImage` bản ngang
      `aspect-[21/9] rounded-2xl` (null → bỏ, không giữ chỗ), dưới là back-link
      (giữ), H1 title link kèm `View tour →` sang `/tours/{tourSlug}`, dòng mã
      mono + status (giữ nguyên cách hiện tại). Các `AccountSection` thông
      tin/contact GIỮ cấu trúc (đã hợp hướng A).
- [ ] **Bước 2 — giáng cấp hành động hủy:** trong `booking-actions.tsx`, nút
      trigger cho `requestCancellation`/`resubmitCancellation`/`cancelPending`
      đổi từ `Button variant` nổi sang text-link
      `text-sm text-destructive-emphasis underline-offset-4 hover:underline`
      (dialog + textarea reason + submit GIỮ NGUYÊN); `payNow` vẫn là Button
      primary nổi. Đặt link policy (`policyLink` hiện có) NGAY CẠNH text-link
      hủy — policy gắn vào hành động (chuẩn Booking.com).
- [ ] **Bước 3:** section review thêm `id="review"` (đích anchor từ T6).
- [ ] **Bước 4:** chạy filter web (spec booking-actions phải xanh — nếu nó
      assert variant nút thì sửa assertion theo text-link, GIỮ các ca logic) +
      `pnpm gate`; commit
      `feat(web): chi tiết booking hướng A, hành động hủy giáng cấp text-link`.

### Task 8: Profile hàng-nở-inline

**Files:**
- Modify: `apps/web/src/components/account/profile-summary.tsx` (+spec)
- Modify: `apps/web/src/components/account/change-password-form.tsx` (+spec)
- Rename/Modify: `apps/web/src/components/account/danger-zone.tsx` →
  `delete-account.tsx` (+spec đổi theo)
- Modify: `apps/web/src/app/(site)/account/profile/page.tsx`
- Modify: `messages.ts` — khối account profile: `edit: 'Edit'`,
  `cancelEdit: 'Cancel'`, các label giữ key sẵn có

**Interfaces:**
- Consumes: `fetchAccountMe`, `deleteAccount`/`AccountDeleteError`
  (`@/lib/api/account`) — chữ ký giữ nguyên.
- Produces: pattern dòng dùng chung trong `profile-summary.tsx`:
  dòng tĩnh `py-4 + divide-y` gồm `label (text-sm text-muted-foreground)` /
  `giá trị (font-medium)` / nút `Edit` text-link phải; bấm Edit → dòng nở thành
  form inline (input + Save/Cancel), chỉ MỘT dòng nở tại một thời điểm
  (state cục bộ component).

- [ ] **Bước 1 — test fail trước:** spec profile-summary: (a) mặc định thấy giá
      trị tĩnh + nút Edit, KHÔNG thấy input; (b) click Edit → input hiện, giá
      trị prefill; (c) Cancel → về tĩnh. Spec delete-account: click text-link →
      dialog xác nhận hiện (logic dialog giữ từ danger-zone). FAIL.
- [ ] **Bước 2:** implement: đọc kỹ 2 component hiện có, GIỮ toàn bộ handler
      submit/validation/error hiện hành, chỉ thay khung trình bày; password là
      một dòng `Password / •••••••• / Change` nở ra `change-password-form`
      inline. `delete-account.tsx`: bỏ khung card viền destructive; thành khối
      cuối trang sau `border-t`: heading nhỏ + một câu mô tả + text-link
      `text-destructive-emphasis` mở dialog xác nhận hiện có.
- [ ] **Bước 3:** page profile: xếp `AccountSection` (giữ) → trong đó là các
      dòng; delete-account đứng CUỐI, ngoài section. Filter web PASS +
      `pnpm gate`; commit
      `feat(web): profile hàng nở inline, xoá tài khoản thành text-link`.

### Task 9: Saved hướng A

**Files:**
- Modify: `apps/web/src/components/account/saved-grid.tsx` (+spec)
- Modify: `apps/web/src/app/(site)/account/saved/page.tsx` (nếu cần)
- Modify: `messages.ts` — empty state:
  `emptyHeading: 'Nothing saved yet'`,
  `emptyBody: 'Tap the heart on any tour to keep it here for later.'`,
  `emptyCta: 'Browse tours'`

- [ ] **Bước 1:** đọc `saved-grid.tsx` hiện có; test fail trước cho 2 điểm mới:
      empty state render đúng copy dạy-hành-vi mới; card giữ hành vi bỏ-lưu
      hiện có (ca cũ phải tiếp tục xanh).
- [ ] **Bước 2:** re-skin nhẹ theo A: lưới `sm:grid-cols-2 lg:grid-cols-3
      gap-6`, card ảnh trên + tên `font-heading` + giá, KHÔNG khung viền dày
      (border mảnh `border-border/60`); empty state căn giữa thoáng, không hộp.
- [ ] **Bước 3:** filter web PASS + `pnpm gate`; commit
      `feat(web): lưới Saved hướng A và empty state dạy hành vi`.

### Task 10: Viền phân định nút primary ở dark — đóng nợ contrast

**Files:**
- Modify: `libs/shared/ui/src/components/button.tsx` (variant `default`)
- Test: spec button hiện có trong `@tourism/ui` (mở rộng assertion class)
- Modify: `libs/shared/tokens/style-dictionary/tokens.mjs` — CHỈ comment
  (khối nợ primary 2.91/2.57): ghi "NỢ ĐÓNG 10/08 bằng giải pháp thay thế —
  viền `border-border` trên nút primary ở dark (không đạt được đồng thời 3:1
  nền + 4.5:1 chữ, xem ADR-0019); đo lại nếu đổi ramp".

- [ ] **Bước 1 — test fail trước:** spec button: variant default chứa class
      `dark:border dark:border-border`. FAIL.
- [ ] **Bước 2:** thêm `dark:border dark:border-border` vào variant `default`
      (KHÔNG đổi màu nền/chữ). Soi nhanh các nút primary trên trang bằng mắt ở
      T11.
- [ ] **Bước 3:** `pnpm turbo run test --filter=@tourism/ui` PASS +
      `pnpm gate`; commit
      `fix(ui): nút primary dark thêm viền phân định — đóng nợ contrast 2.91`.

### Task 11: Nghiệm thu tổng trong worktree

**Files:** không sửa code mới (chỉ fix lỗi nghiệm thu phát hiện, nếu có).

- [ ] **Bước 1:** tạo worktree riêng
      (`git worktree add ../tourism-v2-review feat/redesign-checkout-account`),
      `pnpm install` trong worktree. TUYỆT ĐỐI không build/dev trong repo chính.
- [ ] **Bước 2:** trong worktree: dựng API + web (cổng 3002/3003, KHÔNG đụng
      3000/3001 của user; cần Postgres — `docker compose up -d postgres` nếu
      chưa chạy) — dùng tài khoản demo từ script `8b37e13`
      (`apps/api` script tạo demo — đọc README script để chạy).
- [ ] **Bước 3:** `npx playwright screenshot` (đúng tool đã dùng các vòng
      trước) chụp: book page (đủ 2 cột + summary), success (mock qua booking
      demo đã PAID nếu không tiện trả tiền thật — chụp trang detail thay thế và
      ghi chú), Trips, booking detail, profile (1 dòng đang nở), saved empty +
      có đồ, MỖI TRANG CẢ light + dark (`?…` — đổi theme bằng cách set
      `data-theme` qua devtools protocol flag của lệnh screenshot đã dùng vòng
      trước, hoặc chụp với `prefers-color-scheme` emulation). Lưu vào
      `.superpowers/sdd/shots-redesign/`.
- [ ] **Bước 4:** tự soát ảnh theo checklist spec §2 (7 chuẩn ngành) + §3–4;
      lệch thì fix ngay trong task này (commit `fix(web): …`).
- [ ] **Bước 5:** `pnpm gate:int` TOÀN repo xanh (luật 11). Dọn worktree
      (`git worktree remove`), kill process cổng 3002/3003 theo PID.
- [ ] **Bước 6:** commit cuối (nếu có fix) + báo cáo nghiệm thu: số test
      trước/sau, danh sách ảnh, lệch spec đã xử.

---

## Sau khi plan chạy xong (main-flow, KHÔNG thuộc task subagent)

1. User review giao diện thật (dev server của user + tài khoản demo) — theo
   đúng yêu cầu "chờ có giao diện thật sự khi làm xong để review".
2. User duyệt → rebase lên main mới nhất, `git merge --ff-only`, push, **liếc
   đèn CI** (luật 14).
3. Docs sweep luật 13: CHANGELOG entry (nhớ luật `+` đầu dòng + grep trước add)
   · spec đánh dấu đã thi công · bản đồ `docs/README.md` cập nhật trạng thái ·
   xử 2 alert Dependabot (nanoid, js-yaml) trong commit riêng nếu user đồng ý.

## Self-review (đã chạy)

- Phủ spec: §3.1→T2+T3 · §3.2→T4 · §3.3→T4 · §4 account→T5–T9 (security nhập
  profile: AMENDED có lý do tại T5) · §5 tokens/border→T10, worktree/gate→T11,
  English-only/i18n→từng task · §6 ngoài scope: không task nào đụng.
- Ảnh tour cho Trips: spec ngầm cần → T1 bổ sung contract (tiền lệ Task 6a).
- Type-consistency: `CheckoutSummaryTour` (T2) = nguồn duy nhất, T3 tiêu thụ;
  `TripCard` variant `hero|row` dùng thống nhất T6; `BookingActions({view,code})`
  không đổi chữ ký ở T7.
