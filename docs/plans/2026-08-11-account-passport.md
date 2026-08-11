# Plan thi công — Đập-xây-lại khu Account "Hộ chiếu"

> **For agentic workers:** REQUIRED SUB-SKILL: dùng
> superpowers:subagent-driven-development (khuyến nghị) hoặc
> superpowers:executing-plans. Checkbox (`- [ ]`) để track.

**Goal:** Đập tầng trình bày toàn khu `/account/**` và dựng lại theo thế giới
"Hộ chiếu" đúng bộ 4 màn user đã duyệt
([spec 2026-08-11](../specs/2026-08-11-account-passport-redesign.md)).

**Architecture:** `/account` thành trang hộ chiếu (thay hub + Trips), settings
lùi về `/account/settings`, booking detail thành trang visa, saved khoác giấy.
Logic cũ (session, BookingActions, review, profile handlers, saved) giữ nguyên
— chỉ thay khung. Hai nền móng mới: cặp token `paper`/`ink` và contract
`Booking.tourDestinations`; toàn bộ tem/stats/bản đồ là hàm thuần TDD.

**Tech Stack:** Next 16.3 RSC · Tailwind v4 qua `@tourism/tokens` (Style
Dictionary) · shadcn `@tourism/ui` · Vitest · oRPC contract-first.

## Global Constraints (áp cho MỌI task)

- **PATH trước mọi lệnh node/pnpm:** `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`
  (shell mặc định dính pnpm Windows — đã vấp 2 lần).
- Branch: `feat/account-passport` (T0). Commit Conventional Commits **tiếng
  Việt CÓ DẤU**, KHÔNG AI-trailer — sau mỗi commit
  `git log -1 --format='%(trailers)'`, có `Co-Authored-By` thì amend gỡ.
- Comment/JSDoc tiếng Việt; copy user-facing English trong
  `libs/shared/i18n/src/lib/messages.ts` (khối mới đặt tên `passport*`) —
  KHÔNG hardcode chuỗi trong JSX.
- **Tokens-only, không hex trong component** — mực/giấy dùng token mới của T1
  (`bg-paper`, `text-ink`, biến thể mờ bằng opacity modifier `text-ink/55`).
- Ảnh `<img>` thuần + `biome-ignore lint/performance/noImgElement:` lý do ghi
  NGAY TRÊN DÒNG ignore (tiền lệ `trip-card.tsx`). Tem/mộc/MRZ = CSS + chữ,
  KHÔNG vector minh hoạ tự vẽ.
- KHÔNG `next build`/`next dev`/`pnpm gate` TRẦN trong repo chính (dev server
  user). Lệnh kiểm per-task:
  `pnpm turbo run typecheck test --filter=@tourism/web --filter=@tourism/i18n`
  (+ filter khác khi task đụng) + `biome check .`. Int test: CHỈ T2 và T9.
- `git add` ĐÍCH DANH (CẤM `-A` — tree có `apps/web/AGENTS.md` dở của user).
- KHÔNG đụng: `apps/api/prisma/migrations/**`, trang public/checkout/auth,
  giá trị token hiện có, entry cũ CHANGELOG.
- Deterministic-only: cấm `Math.random`/`Date.now` trong render tem/mã — mọi
  "ngẫu nhiên thủ công" sinh từ booking.code/userId (test được).

## File Structure (toàn cụm)

```text
libs/shared/tokens/style-dictionary/tokens.mjs      # T1: +paper +ink (2 theme)
libs/shared/contract/src/schemas/bookings.ts        # T2: +tourDestinations
apps/api/src/modules/bookings/…                     # T2: select/map + int test
apps/web/src/test/fixtures/booking.ts               # T2: fixture +field mới
apps/web/src/lib/passport.ts (+.spec.ts)            # T3: stats/stamps/mrz/dots
apps/web/src/components/passport/passport-header.tsx# T4 (mới, +spec)
apps/web/src/components/passport/stamp-row.tsx      # T4 (mới, +spec)
apps/web/src/components/passport/stat-row.tsx       # T4 (mới)
apps/web/src/components/passport/dot-map.tsx        # T4 (mới, +spec)
apps/web/src/components/passport/journey-row.tsx    # T4 (mới, +spec 5 status)
apps/web/src/components/passport/saved-tuck.tsx     # T4 (mới)
apps/web/src/app/(site)/account/page.tsx            # T5: trang hộ chiếu M1+M4
apps/web/src/app/(site)/account/layout.tsx          # T5: bỏ AccountNav, bleed
apps/web/src/app/(site)/account/bookings/page.tsx   # T5: → redirect /account
apps/web/src/components/account/account-nav.tsx     # T5: XOÁ (+spec)
apps/web/src/components/account/trip-card.tsx       # T5: XOÁ (+spec — ca 5
                                                    #   status chuyển journey-row)
apps/web/src/app/(site)/account/settings/page.tsx   # T6 (mới)
apps/web/src/app/(site)/account/profile/page.tsx    # T6: → redirect settings
apps/web/src/app/(site)/account/security/page.tsx   # T6: → redirect settings
apps/web/src/app/(site)/account/bookings/[code]/    # T7: trang visa
apps/web/src/app/(site)/account/saved/page.tsx      # T8: giấy + tuck header
libs/shared/i18n/src/lib/messages.ts                # T3–T8: khối passport*
```

---

### Task 0: Mở branch + neo baseline

- [ ] `git checkout main && git pull && git checkout -b feat/account-passport`
- [ ] Xác nhận đèn CI main mới nhất success (`gh run list --branch main --limit 1`)
      — đó là baseline, KHÔNG chạy gate local. Đỏ thì DỪNG báo controller.

### Task 1: Token `paper` + `ink`

**Files:** Modify `libs/shared/tokens/style-dictionary/tokens.mjs` · Test:
build+test tokens.

**Interfaces (Produces):** class Tailwind `bg-paper`, `text-paper`,
`text-ink`, `border-ink`… cho mọi task sau; biến thể mờ dùng modifier
(`text-ink/55`, `border-ink/30`), KHÔNG thêm token soft riêng.

- [ ] **Bước 1:** đọc khối màu trong `tokens.mjs` (pattern `c('light','dark')`
      + nơi khai token semantic). Thêm cạnh nhóm `hero`:

```js
    // Cặp "ấn phẩm du lịch" cho khu account Hộ chiếu (spec 11/08) + tái dùng
    // được cho vé checkout về sau. paper = nền giấy ngà; ink = mực dấu ngọc
    // bích. Biến thể mờ dùng opacity modifier (`text-ink/55`) — KHÔNG token
    // soft riêng. Đo tay: ink/paper light ≈ 5.9:1, dark ≈ 6.4:1 — dư AA text.
    paper: c('oklch(0.965 0.008 174)', 'oklch(0.32 0.02 178)'),
    ink: c('oklch(0.42 0.06 184)', 'oklch(0.78 0.05 181)'),
```

- [ ] **Bước 2:** `pnpm turbo run build test --filter=@tourism/tokens` → PASS;
      grep `generated/tokens.css` thấy `--paper`/`--ink` cả 2 theme.
- [ ] **Bước 3:** kiểm contrast bằng script đo sẵn có của repo nếu tìm thấy
      (grep `contrast` trong `scripts/`/scratchpad) — không có thì ghi số ước
      lượng vào report và note cho T9 soi mắt.
- [ ] **Bước 4:** commit `feat(tokens): thêm cặp paper và ink cho ấn phẩm hộ chiếu`.

### Task 2: Contract + API — `Booking.tourDestinations`

**Files:** Modify `libs/shared/contract/src/schemas/bookings.ts` (+spec) ·
`apps/api/src/modules/bookings/bookings.service.ts` (type `toBooking` + các
select) · int spec bookings · `apps/web/src/test/fixtures/booking.ts`.

**Interfaces (Produces):**
`Booking.tourDestinations: Array<{ slug: string; name: string; isPrimary: boolean }>`
— **tái dùng `DestinationLinkSchema`** từ `./catalog` (KHÔNG khai schema mới;
spec §3.1 ghi `{name, region}` — quyết định plan: `region` không cần trên
booking vì bản đồ join catalog theo slug; ghi chú AMENDED một dòng vào spec
§3.1 trong task này). Sắp xếp: primary đứng đầu.

- [ ] **Bước 1 — RED contract:** thêm ca vào `bookings.spec.ts`: booking hợp
      lệ có `tourDestinations` 2 phần tử (1 primary) parse OK; mảng rỗng hợp
      lệ; thiếu field → fail strict. Chạy
      `pnpm turbo run test --filter=@tourism/contract` → FAIL.
- [ ] **Bước 2:** thêm vào `BookingSchema` cạnh `tourImage`:

```ts
  /** Snapshot đích đến của tour lúc ĐỌC (primary đứng đầu) — nguồn cho tem
   *  hộ chiếu, stats "places visited" và bản đồ chấm. Tái dùng
   *  DestinationLinkSchema, không schema mới. */
  tourDestinations: z.array(DestinationLinkSchema),
```

      (import từ `./catalog`) → filter contract PASS.
- [ ] **Bước 3 — API:** `toBooking` đang ép kiểu `row: BookingRow & { tour:
      { slug: string } }` — mở rộng thêm quan hệ destinations theo ĐÚNG cách
      catalog select `DestinationLinkSchema` (đọc `catalog.service.ts` chỗ
      dựng `destinations` của TourCard, tái dùng helper nếu nó export); map
      primary-first. Compile error sẽ chỉ đúng các call site phải sửa select
      (đường batch dùng chung select với đường đơn — soi cả `resolveForOwners`
      path). Sửa mock/fixture unit API nếu shape đổi.
- [ ] **Bước 4 — fixture web:** thêm `tourDestinations: [{ slug: 'ha-long-bay',
      name: 'Hạ Long Bay', isPrimary: true }]` vào
      `apps/web/src/test/fixtures/booking.ts` (bài học T1 cụm trước: quên là
      typecheck web gãy — chạy `pnpm turbo run typecheck --filter=@tourism/web`
      xác nhận ngay trong task này).
- [ ] **Bước 5 — int:** mở rộng int spec bookings: list + byCode assert
      `tourDestinations` khớp seed (tên + isPrimary). Chạy
      `pnpm turbo run test:int --filter=@tourism/api` (Postgres:
      `docker compose up -d postgres`) → PASS.
- [ ] **Bước 6:** spec §3.1 thêm dòng
      `> AMENDED (plan T2): tái dùng DestinationLinkSchema {slug,name,isPrimary}; region lấy từ catalog khi vẽ bản đồ.`
- [ ] **Bước 7:** commit
      `feat(api): booking mang tourDestinations cho tem và bản đồ hộ chiếu`.

### Task 3: Hàm thuần `lib/passport.ts`

**Files:** Create `apps/web/src/lib/passport.ts` + `passport.spec.ts` · Modify
`messages.ts` (khối `passportHome` phần copy stats — giá trị ở T4/T5 dùng).

**Interfaces (Produces — chữ ký CHÍNH XÁC, task sau import):**

```ts
export interface PassportStats { trips: number; places: number; exploredPct: number; daysOnRoad: number; }
export function passportStats(bookings: Booking[], catalogTotal: number, today?: Date): PassportStats;

export interface PassportStamp { label: string; month: string; shape: 'round' | 'square'; rotationDeg: number; ghost?: boolean; }
export function passportStamps(bookings: Booking[], today?: Date): PassportStamp[]; // completed-only, primary-dest label, LUÔN kết thúc bằng 1 ghost

export function memberNumber(userId: string): string;           // 'NO. 000214' — 6 số deterministic
export function mrzLine(name: string, memberNo: string, sinceYear: number): string; // 'P<TOURISM<<WONG<<BOSCO<<<...' độ dài cố định 44 ký tự

export interface MapDot { region: 'north' | 'central' | 'south' | 'other'; visited: boolean; upcoming: boolean; name: string; }
export function mapDots(catalog: Destination[], visitedSlugs: string[], upcomingSlugs: string[]): MapDot[];
```

Quy tắc (viết thành test TRƯỚC):
- "Hoàn thành" = `bookingView(b).tone === 'success' && departureEndDate < today`
  HOẶC tone `destructive` (REFUNDED sau chuyến) có endDate < today — thực tế:
  dùng `b.status === 'PAID'` qua bookingView cho nhánh chính; REFUNDED
  KHÔNG tính là chuyến đã đi (tiền đã trả lại — không tem). Ghi JSDoc.
- `exploredPct`: 0 khi places=0; ngược lại `max(1, floor(places/catalogTotal*100))`.
- `daysOnRoad`: tổng `(end − start).days + 1` các chuyến hoàn thành.
- Stamp: label = destination `isPrimary` (fallback destination đầu, fallback
  cuối: 2 từ đầu `tourTitle` UPPERCASE); month `'Jul 2026'` từ endDate;
  shape/rotation từ hash `booking.code` (rotation −7..7 nguyên, shape chẵn/lẻ);
  sort theo endDate tăng; phần tử cuối luôn `{ghost: true}`.
- `memberNumber`: hash userId → 6 chữ số, format `NO. 214 306` (nhóm 3).
- `mrzLine`: uppercase, bỏ dấu tiếng Việt (dùng normalize NFD strip — có
  helper sẵn trong repo thì tái dùng, grep `normalize`), pad `<` đủ 44 ký tự,
  cắt nếu dài.
- `mapDots`: mỗi destination catalog 1 dot; `region` map từ
  `Destination.region` (grep giá trị seed thật: 'Northern'/'Central'/
  'Southern'… — đọc seed/api trước khi map, KHÔNG đoán); visited theo slug ∈
  visitedSlugs; upcoming tương tự (visited thắng upcoming).

- [ ] **Bước 1:** viết trọn spec (≥14 ca: mỗi hàm ≥2 ca + biên hôm-nay, 0
      booking, REFUNDED không tem, deterministic same-input-same-output, mrz
      44 ký tự + strip dấu) → RED.
- [ ] **Bước 2:** implement → GREEN; filter web + biome sạch.
- [ ] **Bước 3:** commit `feat(web): hàm thuần hộ chiếu — stats, tem, mrz, bản đồ chấm`.

### Task 4: Bộ component passport (presentational)

**Files:** Create 6 file trong `apps/web/src/components/passport/` (+spec cho
header/stamp-row/dot-map/journey-row) · Modify `messages.ts` (khối
`passportHome`: `kicker: 'Traveler passport · Tourism'`,
`since: (year: number) => \`Traveler since ${year}\``,
`settingsLink: 'Settings ⚙'`, `journeyHeading: 'Your journey'`,
`mapHeading: "Where you've set foot"`,
`mapCaption: (n: number, total: number) => …`, `savedHeading: (n) => \`Tucked
inside · ${n} saved tours\``, `savedOpen: 'Open →'`, stats labels
`statTrips/statPlaces/statExplored/statDays`, journey verbs
`view: 'View →'`, `payNow: 'Pay now →'`, `review: 'Review →'`).

**Interfaces:**
- Consumes: T3 types (`PassportStats`, `PassportStamp`, `MapDot`),
  `bookingView` (`@/lib/booking-vm`), `formatDateRange`.
- Produces (props CHÍNH XÁC):

```ts
PassportHeader({ name, sinceYear, location, memberNo, mrz, settingsHref }): ReactNode // RSC-safe
StampRow({ stamps: PassportStamp[] }): ReactNode
StatRow({ stats: PassportStats }): ReactNode
DotMap({ dots: MapDot[], caption: string }): ReactNode
JourneyRow({ booking: Booking }): ReactNode // tự suy dot-màu + động từ từ bookingView
SavedTuck({ items: Array<{ slug; title; image: string | null }>, total: number }): ReactNode
```

Ngôn ngữ hình (từ demo đã duyệt — công thức, không tự chế):
- Header: nền dùng `bg-paper` + texture giấy
  (`repeating-linear-gradient(0deg, transparent 0 3px, <ink 2.5%> 3px 4px)` —
  alpha bằng modifier token, vd `oklch(from var(--ink) l c h / 0.025)` KHÔNG
  được (hex/oklch cấm trong component) → làm texture bằng lớp phủ
  `bg-ink/[0.025]` với mask repeating — nếu Tailwind v4 không cho mask gọn thì
  texture chuyển vào một class CSS trong globals dùng `var(--ink)`; QUYẾT ĐỊNH
  này ghi vào report); kicker tracking `0.3em` `text-ink/55`; tên
  `font-heading`; MRZ `font-mono text-ink/55 tracking-[0.2em]` + `border-t
  border-dashed`.
- Stamp: `border-[2.5px] border-ink rounded-full` (square: `rounded-2xl`),
  vòng trong `border-dashed border-ink/55`, `rotate-[{n}deg]` inline style từ
  `rotationDeg`, opacity giảm dần theo tuổi tem (style prop), ghost:
  `border-dashed opacity-30`.
- JourneyRow: chấm màu `bg-primary`/`bg-warning`/`bg-muted-foreground`
  (tone success/warning/muted-destructive) qua map tra bảng; ảnh 64×48
  `rounded-lg` (null → `bg-muted`); title serif; meta gồm đếm-ngược
  (`daysUntilDeparture` — GIỮ hành vi status-aware như trip-card cũ) hoặc
  ngày qua; động từ: PENDING → `payNow` href detail, PAID tương lai → `view`,
  PAID đã qua → `review` href `detail#review`, còn lại `view`.
- DotMap: grid 18 cột, dot `aspect-square rounded-full`, cluster theo region
  (bắc trên, trung giữa, nam dưới — bố trí bằng sort region trước khi render,
  KHÔNG toạ độ địa lý), visited `bg-primary`, upcoming `bg-primary opacity-40`,
  còn lại `bg-muted`.

- [ ] **Bước 1 — RED:** spec: (a) StampRow render đúng số tem + ghost cuối +
      style rotate đúng từ data; (b) JourneyRow 5 status → đúng động từ/href/
      màu chấm (chuyển các ca của `trip-card.spec.tsx` sang khuôn mới);
      (c) DotMap: visited/upcoming/muted class đúng theo data; (d) Header:
      MRZ + memberNo + link settings hiện diện.
- [ ] **Bước 2:** implement 6 component → GREEN + biome.
- [ ] **Bước 3:** commit `feat(web): bộ component hộ chiếu — header, tem, stats, bản đồ, journey`.

### Task 5: Trang `/account` M1+M4 + route lại + gỡ nav

**Files:** Modify `account/page.tsx` (trang thật thay redirect) ·
`account/layout.tsx` (bỏ `<AccountNav/>`, cho phép bleed:
container đổi thành full-width, `max-w` chuyển vào từng section con — đọc
comment layout hiện có về pt-36/px và GIỮ các hằng số đó cho phần nội dung
không-bleed) · `account/bookings/page.tsx` → `redirect('/account')` +
chuyển logic fetch/chunk sang page mới · Delete `account-nav.tsx`+spec,
`trip-card.tsx`+spec (sau khi hết import) · `messages.ts` khối `passportEmpty`
(`heading: 'Every passport starts blank'`, `body: "Book your first tour and
we'll ink this page — dates, places, and a stamp to prove you were there."`,
`cta: 'Browse tours'`, `ghostLabel: 'Your first stamp'`, `ghostSub: 'is waiting'`).

**Interfaces (Consumes):** T3 hàm + T4 components; `requireSession`,
`fetchMyBookings` (+`BOOKINGS_PAGE_SIZE`/`BOOKINGS_MAX_LIMIT` — pattern chunk
`?page=` GIỮ NGUYÊN, di cư từ bookings/page.tsx cũ kèm comment); danh sách
destinations catalog: dùng hàm fetch destinations ĐÃ CÓ của web (grep
`destinations` trong `apps/web/src/lib/api/` — tái dùng, không viết mới);
wishlist: `fetchMyWishlist` cho SavedTuck (3 item đầu + total).

- [ ] **Bước 1:** dựng page RSC: session (`requireSession('/account')` + đọc
      `getServerSession` lấy name/id/createdAt — grep SessionUser xem có
      createdAt không; KHÔNG có thì sinceYear lấy từ booking sớm nhất,
      fallback năm hiện tại — ghi quyết định vào report) → fetch song song
      (`Promise.all`) bookings + destinations + wishlist → tính stats/stamps/
      dots → render M1; `bookings.length === 0` → nhánh M4 empty (header đầy
      đủ + ghost stamp lớn + stats 0 + map chưa nhuộm + CTA `/tours`; SavedTuck
      ẩn khi wishlist rỗng).
- [ ] **Bước 2:** metadata `robots: index:false` (giữ nếp khu account).
- [ ] **Bước 3:** redirect `bookings→/account`; gỡ 2 component chết + spec
      (grep import trước); layout bỏ nav.
- [ ] **Bước 4:** filter web PASS (typecheck bắt sạch import gãy) + biome.
- [ ] **Bước 5:** commit `feat(web): trang hộ chiếu thay hub và Trips, gỡ nav tab`.

### Task 6: `/account/settings` + redirect

**Files:** Create `account/settings/page.tsx` · Modify `profile/page.tsx` +
`security/page.tsx` → `permanentRedirect('/account/settings')` ·
`messages.ts` khối `passportSettings` (`back: '← Passport'`,
`title: 'Traveler details'`, `subtitle: 'The information printed in your
passport.'`, section headings `identity: 'Identity'`, `signin: 'Sign-in'`).

- [ ] **Bước 1:** page mới = nội dung profile page hiện tại DI CƯ nguyên khối
      (profile-summary + change-password inline + delete-account cuối trang —
      import y nguyên, KHÔNG sửa component), khoác: nền `bg-paper` bleed,
      back-link, heading serif + subtitle, 2 section heading Identity/Sign-in
      (profile-summary hiện gom sẵn — chỉ bọc heading nếu cấu trúc cho phép,
      KHÔNG mổ component; không chèn được thì 1 heading "Traveler details" là
      đủ, ghi report).
- [ ] **Bước 2:** 2 redirect; grep link nội bộ trỏ `/account/profile|security`
      (user-menu navbar? grep toàn `apps/web/src`) → đổi về `/account/settings`.
- [ ] **Bước 3:** filter web + biome; spec profile/delete cũ phải còn xanh
      nguyên. Commit `feat(web): settings hộ chiếu tầng sau, profile và security redirect về`.

### Task 7: Trang visa `/account/bookings/[code]`

**Files:** Modify `account/bookings/[code]/page.tsx` · `messages.ts` khối
`passportVisa` (`back: '← Passport'`, `kicker: 'Entry · Tour booking'`,
`viewTour: 'View tour'`, `labels: { dates: 'Dates', travellers: 'Travellers',
reference: 'Reference', total: 'Total paid' }`, `viewVoucher: 'View voucher'`,
`contactUs: 'Contact us'`, mộc `stampByStatus` map 5 status → chữ dấu
(`CONFIRMED`/`AWAITING PAYMENT`/`CANCELLED`/`REFUNDED`/`PARTLY REFUNDED`),
`cancelLead: 'Need to change plans?'`, fine-print builder
`fineLine: (name, email, bookedDate, provider) => …` UPPERCASE).

**Interfaces (Consumes):** `bookingView`/`toCancellationView` (mapping GIỮ),
`BookingActions({view, code})` GIỮ NGUYÊN chữ ký (đứng trong câu cancelLead
dưới doc), `reviewSlot` + `ReviewForm` giữ, `CopyCodeButton` KHÔNG cần ở đây
(voucher là trang riêng).

- [ ] **Bước 1:** dựng lại thân trang theo M2: back-link → khối `v-doc`
      (`rounded-2xl border bg-card overflow-hidden` + dải tone 6px trên đầu
      theo `bookingView.tone` map `bg-success/70 | bg-warning/70 | bg-muted`)
      → header (kicker `text-ink/55`, title serif, `View tour →`
      `/tours/{tourSlug}`, MỘC trạng thái: khối chữ đóng khung
      `border-2 rounded-xl rotate-[4deg] px-3.5 py-2 font-heading font-bold
      tracking-[0.14em]` màu mực theo tone — `text-success border-success` /
      warning / `text-muted-foreground border-muted-foreground`) → ảnh
      `tourImage` `aspect-[21/9]` (null → bỏ) → lưới IATA 4 ô (nhãn UPPERCASE
      9.5px tracking rộng TRÊN, giá trị đậm DƯỚI; Dates
      `font-mono` dạng `24 → 26 AUG` — viết helper nhỏ trong page từ
      formatter sẵn có) → hàng action (PAID: `View voucher` Button primary →
      `/checkout/success?code={code}` + `Contact us` outline → `/contact`;
      PENDING: `Pay now` primary thế chỗ — dùng đúng nút payNow của
      BookingActions nếu tách được, không thì link detail giữ hành vi cũ và
      ghi report; terminal: không nút chính) → fine print mono UPPERCASE
      (thay section Contact cũ — GỠ section đó).
- [ ] **Bước 2:** dưới doc: câu `cancelLead` + `BookingActions` (trigger
      text-link như hiện tại) + policy link giữ; section review giữ
      `id="review"`.
- [ ] **Bước 3:** spec booking-actions cũ còn xanh; thêm ca page-level không
      có (nếp repo không spec page) — thay bằng ca component nếu tách khối
      mộc thành component nhỏ `visa-stamp.tsx` (khuyến nghị: tách, spec 5
      status).
- [ ] **Bước 4:** filter web + biome; commit
      `feat(web): trang visa có mộc trạng thái cho chi tiết booking`.

### Task 8: Saved khoác giấy

**Files:** Modify `account/saved/page.tsx` (+`saved-grid.tsx` CHỈ nếu cần
truyền class) · `messages.ts`: tái dùng khối saved hiện có, thêm
`passportSaved.back: '← Passport'`, heading đổi giá trị thành
`'Tucked inside'` (+ subtitle giữ).

- [ ] **Bước 1:** page: back-link + heading serif mới + nền `bg-paper` bleed;
      `saved-grid` logic/empty-state GIỮ NGUYÊN (empty copy hiện có đã dạy
      hành vi — không đổi).
- [ ] **Bước 2:** spec saved cũ xanh nguyên; filter + biome; commit
      `feat(web): trang saved thành ngăn kẹp trong hộ chiếu`.

### Task 9: Nghiệm thu worktree

Theo đúng runbook T11 cụm trước (worktree `../tourism-v2-review`, copy env,
API 3002 + web 3003, demo account script, `npx playwright screenshot`
`--load-storage` + `--color-scheme=dark`, ảnh về
`.superpowers/sdd/shots-passport/`):

- [ ] Chụp: `/account` (đủ dữ liệu + tài khoản MỚI 0 booking — tạo account
      thường qua sign-up API để có empty state), `/account/bookings/TRV-…`
      (PAID có mộc CONFIRMED + 1 PENDING có Pay now), `/account/settings`,
      `/account/saved` — mỗi trang light+dark; mobile 390×844 cho `/account`.
- [ ] Tự soát theo spec §4 (đủ 4 màn, tem xoay lệch, MRZ một dòng không tràn,
      map cluster, dải tone, mộc nghiêng) + redirect: curl 3 route cũ
      (`/account/bookings`, `/account/profile`, `/account/security`) xác nhận
      3xx về đích mới. Lệch layout gãy → fix ngay trong worktree.
- [ ] `pnpm gate:int` trong worktree (API sống khi build web) → XANH toàn bộ.
- [ ] Dọn: kill PID 3002/3003 (curl `000`), `git worktree remove`, Postgres để
      nguyên. Report + danh sách ảnh.

---

## Sau plan (main-flow, không thuộc task subagent)

1. Final review toàn branch (model mạnh nhất) + fix wave nếu có.
2. Controller tự soi ảnh → mời USER review giao diện thật (dev server của user).
3. User duyệt → rebase + `merge --ff-only` + push + đèn (luật 14) → docs sweep
   luật 13 (CHANGELOG — grep `^+` trước add; spec đánh dấu đã thi công; bản đồ).

## Self-review (đã chạy)

- Phủ spec: §2 route→T5/T6/T7/T8 (+redirect T5/T6) · §3.1→T2 · §3.2→T3 ·
  §3.3 copy→T3–T8 khối passport* · §4 M1/M4→T4+T5, M2→T7, M3→T6 · §5 tokens→T1,
  component chết→T5, test/nghiệm thu→T9 · §6 không task nào lấn.
- Type-consistency: `PassportStats/PassportStamp/MapDot` (T3) ↔ props T4 ↔
  page T5; `DestinationLinkSchema` (T2) ↔ stamp label/mapDots slug (T3).
- Điểm mở có chủ đích (implementer ghi report, không đoán bừa): texture giấy
  tokens-only (T4 bước 1), sinceYear nguồn (T5), tách nút payNow (T7) — đều
  có phương án fallback ghi sẵn.
