# Thiết kế lại Saved và Settings của khách — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/account/saved` thành lưới thẻ ảnh có tim nổi trên ảnh, ngày lưu và số tour ở hero
cập nhật sau khi bỏ lưu; `/account/settings` thành bố cục thẻ danh tính trái, các thẻ thông tin
phải; hai hero có nút tròn quay lại Passport — chỉ đổi giao diện.

**Architecture:** Mỗi trang tách thân (kể cả hero) thành một view component có test
(`SavedView`, `SettingsView`, nếp `BookingsListView`), `page.tsx` chỉ còn gác phiên và đọc dữ
liệu. Saved dùng thẻ mới `SavedTourCard` và ngày lưu thuần `formatSavedDate` (lịch Việt Nam, có
test); bỏ lưu thành công thì lưới gọi `router.refresh()` để hero (server in) đếm lại. Settings
dựng từ `IdentityCard` (bọc `AvatarUpload`), hai thẻ `ProfileSummary` và `PasswordCard` chung
khuôn `SettingsCard`/`SettingsRow`, và `DeleteAccount` khoác khung Danger zone mới — logic ghi
không đổi một dòng.

**Tech Stack:** Next.js 16 (App Router) · React 19 · Base UI qua `@tourism/ui` · Tailwind 4.3 ·
Vitest 4 + Testing Library (jsdom) · `@tourism/i18n` · Biome.

**Spec:** [docs/specs/2026-10-09-account-saved-settings-redesign-design.md](../specs/2026-10-09-account-saved-settings-redesign-design.md)
— HỢP ĐỒNG của việc này; plan chỉ nói cách làm. Bản ghi wireframe (bất biến):
[account-saved-settings.src.html](../design/mockups/account-saved-settings.src.html) — phương án
được chọn: Settings **C**, Saved **A**.

## Global Constraints

- **Chỉ đổi giao diện** (spec §1): không đổi API, contract (`libs/shared/contract`), DB,
  `apps/api`, `apps/admin`, `apps/mobile`; không thêm sắp xếp, lọc, tuỳ chọn thông báo hay đổi
  email.
- **Không sửa component của `@tourism/ui`** (kit dùng chung với admin) — chỉ dùng.
- **Không chạm hạ tầng sống** (CLAUDE.md luật 15): không deploy, không Supabase, Render, Vercel,
  Cloudinary, webhook hay env. Việc này không cần gì từ hạ tầng. Không push, không merge — session
  gốc làm sau review.
- **TDD** (luật 4): viết test trước, chạy thấy ĐỎ đúng lý do ghi ở bước, code tối thiểu, chạy
  thấy XANH. Mỗi ca test mới **thử đột biến** một lần (sửa mã cho sai, thấy ca ấy đỏ, trả lại) và
  ghi kết quả vào báo cáo task. Không khôi phục đột biến bằng `git checkout`/`git restore` khi còn
  thay đổi chưa commit.
- **Comment code tiếng Việt** (luật 8), cả `//` lẫn JSDoc; tên biến, hàm, identifier tiếng Anh.
  Comment không khai trạng thái tương lai ("task sau sẽ…").
- **Chữ khách thấy: tiếng Anh, nằm trong `@tourism/i18n`** (luật 7) — không viết chuỗi giao diện
  thẳng trong TSX (dữ liệu như tên tour, email thì được).
- **Tokens-only, không hex** (luật 6): màu qua class token (`bg-card`, `text-primary-emphasis`,
  `text-ink`, `fill-rating`, `border-destructive/30`…), bóng qua `shadow-(--shadow-card)`.
- **Biome là formatter và linter DUY NHẤT**: `pnpm exec biome check --write <các file của task>`
  trước khi stage; không thêm Prettier hay ESLint; không `--no-verify`.
- **Commit Conventional, message tiếng Việt CÓ DẤU, KHÔNG dòng `Co-Authored-By` hay attribution
  AI nào** (luật 12). Stage bằng đường dẫn tường minh (đường dẫn có ngoặc thì đặt trong nháy kép),
  không `git add -A`.
- **`@tourism/i18n` được web đọc từ `dist`**: sửa `messages.ts` xong phải build lại trước khi
  chạy test hay typecheck của web —
  `pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only`.
- **Hãm tài nguyên**: vitest chạy `--maxWorkers=2`; KHÔNG chạy `pnpm gate`/`pnpm gate:int` trong
  các task — session gốc chạy một lượt đầy đủ sau thi công (mục cuối).
- **Next.js 16 khác dữ liệu huấn luyện**: trước khi dùng API của Next, đọc đúng file doc mà task
  chỉ trong `apps/web/node_modules/next/dist/docs/`.
- **Một `h1` mỗi trang**: `ContentHero` giữ `h1`; tiêu đề thẻ là `h2`; tên tour trong thẻ là `h3`.
- **Test khớp chữ chính xác**, không `/…/i` ở ca mới; Base UI mở hộp xong thì chờ bằng `findBy…`.
- **Ngày**: "hôm nay" là ngày lịch Việt Nam do server tính (`todayDateString`), so bằng chuỗi
  `YYYY-MM-DD`; không đọc đồng hồ trình duyệt.
- **Tài liệu**: không sửa `docs/design/mockups/*.src.html`; không để dòng `.md` nào bắt đầu bằng
  `+` ở cột 0; `git diff` file `.md` trước khi stage.
- Thấy mình sắp cần sửa file ngoài "Bản đồ file" thì DỪNG và hỏi session gốc.

---

## Điều kiện bắt đầu

- Làm trong worktree `C:\Programming\Devs\Projects\Tourism-Platform-V2\.claude\worktrees\account-saved-settings`
  (nhánh `feat/account-saved-settings`). `git log --oneline -3` phải thấy commit của plan này nằm
  trên `afae5d49` (spec và bản ghi wireframe); `git status` sạch.
- `node_modules` đã cài. Build một lần các gói web đọc từ `dist` (contract, core, i18n, tokens):

  ```bash
  pnpm turbo run build --filter="@tourism/web^..." --concurrency=1 --output-logs=errors-only
  ```

- Mốc xanh trước khi sửa (đo 09/10 trong worktree này: 3 file, 35 ca xanh; typecheck xanh):

  ```bash
  pnpm --filter @tourism/web exec vitest run src/components/account/saved-grid.spec.tsx src/components/account/profile-summary.spec.tsx src/lib/wishlist.spec.ts --maxWorkers=2
  pnpm --filter @tourism/web typecheck
  ```

- Các task KHÔNG cần `.env.local`, Docker hay API chạy nền — chỉ bước gate cuối của session gốc
  cần.
- Plan đã được chạy thử trọn bảy task ngày 09/10 trong một worktree tạm (đã gỡ): mọi bước đỏ và
  xanh ra đúng số ca ghi ở từng task, typecheck và Biome sạch, toàn bộ test web xanh sau Task 7.
  Lệch thì DỪNG và báo — đừng sửa test cho khớp mã.

## Lệnh hay dùng

```bash
pnpm --filter @tourism/web exec vitest run <file…> --maxWorkers=2
pnpm --filter @tourism/i18n exec vitest run src/lib/messages.spec.ts
pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only
pnpm --filter @tourism/web typecheck
pnpm exec biome check --write <file…>
```

## Quyết định của plan

Chỗ spec để ngỏ, hoặc gợi ý chia task phải chỉnh theo mã thật, plan chốt như sau.

1. **Không có task "chỉ thêm chữ i18n".** Một task chỉ thêm khoá không có deliverable test riêng,
   nên mỗi khoá đi cùng task dùng nó: `accountSaved.savedOn` cùng hàm ngày lưu (Task 1),
   `accountProfile.password.blurb` cùng thẻ Password (Task 5), dọn khoá mồ côi ở task ráp trang
   nào làm chúng mồ côi (Task 3, 4, 5, 7).
2. **Khoá nút quay lại GIỮ NGUYÊN chỗ `accountBookings.backToPassport`**, ba trang cùng đọc; chỉ
   sửa JSDoc nói ai dùng. Không dời sang khối chung: nhánh P7 B (`feat/booking-pages-redesign`) và
   C (`feat/booking-voucher`) đang đọc đúng đường dẫn ấy ở `bookings/page.tsx` — dời khoá là buộc
   hai nhánh đó sửa theo khi rebase.
3. **Hero đếm lại bằng `router.refresh()` sau khi bỏ THÀNH CÔNG**, không đưa số đếm vào state
   client. Lý do: (a) spec §3 nói "cập nhật sau khi bỏ thành công"; (b) đúng nếp ghi-xong-đọc-lại
   của khu account (`ProfileSummary`, `AvatarUpload`, `BookingActions`); (c) số ở hero là sự thật
   của server, kể cả khi tab khác vừa lưu thêm; (d) Next 16 gộp payload server mới mà giữ
   `useState` của client (`use-router.md`, dòng `router.refresh()`), nên thẻ đã rời không quay
   lại. Đánh đổi: mỗi lần bỏ thêm một lượt đọc wishlist ở server; bỏ dồn nhiều thẻ thì số đúng sau
   lượt làm mới cuối. Lỗi hay 401 thì không làm mới.
4. **Thân trang thành `SavedView` và `SettingsView`, gồm cả hero** — spec §5 đòi test nút quay
   lại trong hero của hai trang, mà Vitest của web không quét `src/app/**`
   (`apps/web/vitest.config.ts`). `page.tsx` chỉ còn phiên, cookie, lời gọi API.
5. **Một component thẻ cho cả hai nhánh**: `SavedTourCard` (file riêng) thay `SavedTourCard` và
   `UnavailableCard` trong `saved-grid.tsx`. `UnavailableCard` không còn ai import (khối "3 saved"
   của dashboard đã bỏ 11/08) — gỡ hẳn.
6. **Thẻ `unavailable` chỉ khác bốn chỗ spec §3 kể**: ảnh xám, nhãn "No longer available", tên
   muted, không giá và không link. Dòng "Saved {ngày}" và dòng số ngày (sao theo luật chung) giữ.
   Bản vẽ máy bàn in thêm "Not on sale" — spec ghi "không giá" nên không in chữ thay.
7. **"Giá như thẻ hiện tại"**: `formatMoney(basePrice, currency)` chữ serif đậm — không tiền tố
   "from" của bản vẽ.
8. **Ngày lưu là `formatSavedDate(addedAt, today)` ở `lib/wishlist.ts`**: đổi mốc giờ ISO sang
   ngày lịch Việt Nam (`vietnamToday`), cùng năm thì `formatChipDate` ("3 Oct"), khác năm thì
   `formatDate` ("3 Oct 2025"). `today` do trang server tính (`todayDateString`) rồi truyền
   xuống: thẻ là Client Component, đọc đồng hồ ở đó là HTML server và lần hydrate có thể lệch nhau.
9. **"Chưa có đánh giá" là `ratingAvg === null`** — cùng luật `TourCard`, `TourListCard`; sao vẽ
   như `TourCard` (`StarIcon` `fill-rating`, một số lẻ, số lượt `toLocaleString('en-US')`).
10. **Trạng thái trống theo bản vẽ**: khung viền ĐỨT `bg-card`, rộng tối đa 520px (phần "chung
    cho mọi phương án Saved"); spec §3 chỉ nói "khối giữa trang". Khác hộp viền liền đã gỡ 11/08.
11. **`AvatarUpload` dựng dọc, ảnh 96px, nhận `children`** chèn giữa ảnh và dòng gợi ý — đúng thứ
    tự spec §2 (ảnh → tên → email → gợi ý). Bỏ dòng chữ "Upload avatar / Avatar selected": tên đọc
    "Upload avatar" vẫn ở nút ảnh, dòng gợi ý đã nói "Click or drop a photo."; gỡ khoá
    `avatar.selected`. **Session gốc chỉnh 09/10:** GIỮ một nút viền "Upload avatar" nhìn thấy được
    dưới ảnh như bản vẽ C user đã duyệt (điện thoại không có hover để lộ ảnh bấm được) — xem đầu Task 4.
12. **Connected accounts trong thẻ danh tính** chỉ có nhãn nhỏ và dòng "Email & password" kèm
    icon thư — không dòng phụ "Sign-in method" của bản vẽ (spec §2 không có, §4 không thêm khoá);
    gỡ `connected.subtitle`.
13. **Mô tả thẻ Personal information đổi chữ thành "Your name and contact details."** (giá trị của
    `details.blurb`, khoá giữ nguyên): câu cũ "…, and password." nói sai khi mật khẩu đã sang thẻ
    riêng; câu mới là chữ của bản vẽ C.
14. **Khung thẻ và dòng dùng chung** `SettingsCard`, `SettingsRow`, `EditButton`
    (`settings-card.tsx`) cho Personal information và Password. Danger zone tự mang khung (viền và
    nền đỏ khác hẳn).
15. **Dòng mật khẩu khi mở vẫn mang nhãn "Password"** (bản vẽ C đổi thành "Change password",
    spec không nói); khoá mồ côi `password.heading` gỡ, thay bằng `password.blurb`.
16. **Gợi ý của Phone đứng dưới nhãn ở cả lúc xem lẫn lúc sửa** (spec §2 "Phone (kèm gợi ý …)"),
    không còn chỉ hiện trong form.
17. **Lề trang 16px dưới `lg` cho cả hai trang** (`px-4 lg:px-8`; spec §2 "Gutter 16px") — khác
    `px-4 md:px-8` của My bookings ở dải 768–1023px. Khung: Saved `max-w-6xl` (1152px), Settings
    `max-w-5xl` (1024px).
18. **Ô của `SettingsRow` đặt chỗ tường minh** (`col-*`, `row-*` của Tailwind 4.3): DOM giữ thứ
    tự đọc nhãn → giá trị → hành động, mắt vẫn thấy hành động lên cạnh nhãn ở khổ hẹp.
19. **Dọn mọi khoá mồ côi của ba khối `accountSaved`, `passportSettings`, `accountProfile`** —
    kể cả khoá đã mồ côi từ trước (`accountSaved.listHeading`, `accountSaved.blurb`,
    `details.emailHint`, `details.save`, `password.heading`), vì việc này gỡ "các khoá chữ không
    còn ai đọc"; grep đo trước khi gỡ (chỉ còn định nghĩa trong `messages.ts`), mobile chỉ đọc
    `danger.errors`.
20. **Nút mở hộp xoá thành `Button variant="destructive" size="sm"`** có viền đỏ nhạt; câu giải
    thích trong dòng là `danger.dialogBody` có sẵn.
21. **Thẻ danh tính dính `lg:sticky lg:top-28`** — cùng mốc với rail đặt tour, FAQ, bài viết;
    lưới bọc `lg:items-start` để ô không giãn cao bằng cột phải (giãn thì sticky hết chỗ trượt).
22. **Giữa chừng trang vẫn đổi được mật khẩu**: Task 5 chèn `<PasswordCard />` vào trang Settings
    cũ. Bố cục trang cũ giữa Task 4 và Task 7 có thể lệch (tiêu đề lặp) — chấp nhận, nhánh không
    deploy giữa chừng; Task 7 dựng lại trọn trang.

> **Sau review 09/10:** nút tim bỏ `aria-pressed` (nút hành động thuần "Remove {tour} from saved tours"),
> bỏ lưu bằng bàn phím dời focus sang tim kế tiếp — spec §3 đã sửa; các khối code Task 2–3 bên dưới là bản lúc
> thi công, mã thật ở commit `213006e8`.

## Bản đồ file

| File | Trách nhiệm | Task |
| --- | --- | --- |
| `apps/web/src/lib/wishlist.ts` (có spec) | `formatSavedDate` | 1 |
| `libs/shared/i18n/src/lib/messages.ts` | `savedOn` (1) · gỡ `accountSaved.back`, `listHeading`, `blurb`, JSDoc `backToPassport` (3) · gỡ `avatar.selected` (4) · `details.blurb`, `password.blurb`, gỡ `password.heading` (5) · gỡ `passportSettings.back`, `details.emailHint`, `details.save`, `connected.subtitle`, comment khối, JSDoc `backToPassport` (7) | 1, 3, 4, 5, 7 |
| `libs/shared/i18n/src/lib/messages.spec.ts` | Ca `savedOn` | 1 |
| `apps/web/src/test/fixtures/wishlist.ts` (mới) | `makeWishlistItem` | 2 |
| `apps/web/src/components/account/saved-tour-card.tsx` (mới, có spec) | Thẻ một tour đã lưu | 2 |
| `apps/web/src/components/account/saved-grid.tsx` (có spec) | Lưới 1/2/3 cột, prop `today` (2) · `router.refresh()`, trạng thái trống (3) | 2, 3 |
| `apps/web/src/app/(site)/account/saved/page.tsx` | Truyền `today` (2) · viết lại quanh `SavedView` (3) | 2, 3 |
| `apps/web/src/components/account/saved-view.tsx` (mới, có spec) | Hero có nút quay lại, khung lưới | 3 |
| `apps/web/src/test/fixtures/account.ts` (mới) | `makeSessionUser` | 4 |
| `apps/web/src/components/account/avatar-upload.tsx` (có spec) | Dựng dọc 96px, `children` | 4 |
| `apps/web/src/components/account/identity-card.tsx` (mới, có spec) | Thẻ danh tính | 4 |
| `apps/web/src/components/account/settings-card.tsx` (mới, có spec) | `SettingsCard`, `SettingsRow`, `EditButton` | 5 |
| `apps/web/src/components/account/profile-summary.tsx` (có spec) | Thẻ Personal information | 5 |
| `apps/web/src/components/account/password-card.tsx` (mới, có spec) | Thẻ Password | 5 |
| `apps/web/src/app/(site)/account/settings/page.tsx` | Chèn `PasswordCard` (5) · viết lại quanh `SettingsView` (7) | 5, 7 |
| `apps/web/src/components/account/delete-account.tsx` (có spec) | Khung Danger zone mới | 6 |
| `apps/web/src/components/account/settings-view.tsx` (mới, có spec) | Hero có nút quay lại, hai cột từ `lg` | 7 |

Không đụng: `content-hero.tsx` (prop `back` đã có từ P7 A), `change-password-form.tsx`,
`slot-image.tsx`, `lib/tours.ts`, `lib/account-stats.ts` (chỉ dùng).

## Giao diện dùng chung

Tên và kiểu dưới đây là cố định — task sau dùng ĐÚNG như vậy, review sẽ grep đúng chữ.

```ts
// apps/web/src/lib/wishlist.ts (Task 1)
export function formatSavedDate(addedAt: string, today: string): string;
// libs/shared/i18n — messages.accountSaved (Task 1)
savedOn: (date: string) => string; // "Saved 3 Oct"

// apps/web/src/test/fixtures/wishlist.ts (Task 2)
export function makeWishlistItem(overrides?: Partial<WishlistItem>): WishlistItem;
// apps/web/src/components/account/saved-tour-card.tsx (Task 2)
export function SavedTourCard(props: { item: WishlistItem; today: string; onRemove: () => void }): JSX.Element;
// apps/web/src/components/account/saved-grid.tsx (Task 2; Task 3 thêm refresh)
export function SavedGrid(props: { initialItems: WishlistItem[]; today: string }): JSX.Element; // lưới mang data-slot="saved-grid"
// apps/web/src/components/account/saved-view.tsx (Task 3)
export function SavedView(props: { items: WishlistItem[]; today: string }): JSX.Element;

// apps/web/src/test/fixtures/account.ts (Task 4)
export function makeSessionUser(overrides?: Partial<SessionUser>): SessionUser;
// apps/web/src/components/account/avatar-upload.tsx (Task 4)
export function AvatarUpload(props: { initial: string; image: string | null; children?: ReactNode }): JSX.Element;
// apps/web/src/components/account/identity-card.tsx (Task 4)
export function IdentityCard(props: { profile: SessionUser; className?: string }): JSX.Element; // data-slot="identity-card"

// apps/web/src/components/account/settings-card.tsx (Task 5)
export function SettingsCard(props: { title: string; description: string; children: ReactNode }): JSX.Element;
export function SettingsRow(props: {
  label: string;
  hint?: string;
  value?: ReactNode;
  action?: ReactNode;
  editing?: boolean;
  children?: ReactNode;
}): JSX.Element;
export function EditButton(props: { field: string; onClick: () => void }): JSX.Element;
// apps/web/src/components/account/profile-summary.tsx (Task 5) — chữ ký không đổi
export function ProfileSummary(props: { profile: SessionUser }): JSX.Element;
// apps/web/src/components/account/password-card.tsx (Task 5)
export function PasswordCard(): JSX.Element;
// libs/shared/i18n — messages.accountProfile.password (Task 5)
blurb: string; // "Change the password you sign in with."

// apps/web/src/components/account/settings-view.tsx (Task 7)
export function SettingsView(props: { profile: SessionUser }): JSX.Element; // khung mang data-slot="settings-layout"
```

`WishlistItem` từ `@tourism/contract`; `SessionUser` từ `@/lib/api/session`; `ReactNode` từ
`react`. Nhãn nút quay lại của cả hai trang: `messages.accountBookings.backToPassport`
("Back to Passport"), đích `/account`.

---

### Task 1: Ngày lưu theo lịch Việt Nam (`formatSavedDate`) và chữ "Saved {date}"

**Files:**

- Modify: `apps/web/src/lib/wishlist.ts` (JSDoc đầu file dòng 1–6; thêm import và hàm cuối file)
- Modify: `apps/web/src/lib/wishlist.spec.ts` (import dòng 2; thêm describe cuối file)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `accountSaved`, ngay sau dòng `savedCount`)
- Modify: `libs/shared/i18n/src/lib/messages.spec.ts` (thêm describe cuối file)

**Interfaces:**

- Consumes: `vietnamToday(now: Date): string` (`@tourism/contract`, `refund-policy.ts:170`);
  `formatChipDate(date: string): string` ("14 Sep") và `formatDate(date: string): string`
  ("14 Sep 2026") ở `apps/web/src/lib/tours.ts`.
- Produces: `formatSavedDate(addedAt: string, today: string): string`;
  `messages.accountSaved.savedOn: (date: string) => string`.

- [ ] **Step 1: Viết test hỏng**

Trong `apps/web/src/lib/wishlist.spec.ts`, dòng 2 thành:

```ts
import { formatSavedDate, signInHref, toggleWished } from './wishlist';
```

Thêm vào CUỐI file:

```ts
describe('formatSavedDate — dòng "Saved …" trên thẻ đã lưu (spec 09/10 §3)', () => {
  /** "Hôm nay" theo lịch Việt Nam, do trang server tính (`todayDateString`). */
  const TODAY = '2026-10-09';

  it('cùng năm với hôm nay: ngày + tháng viết tắt, không năm', () => {
    expect(formatSavedDate('2026-10-03T05:00:00.000Z', TODAY)).toBe('3 Oct');
  });

  it('khác năm: thêm năm', () => {
    expect(formatSavedDate('2025-12-20T03:00:00.000Z', TODAY)).toBe('20 Dec 2025');
  });

  it('cắt ngày theo lịch VIỆT NAM: 18:30Z là 01:30 sáng hôm sau ở Việt Nam', () => {
    expect(formatSavedDate('2026-10-02T18:30:00.000Z', TODAY)).toBe('3 Oct');
  });

  it('năm cũng theo lịch Việt Nam: 31/12 lúc 18:00Z đã là 1/1 ở Việt Nam, cùng năm với hôm nay', () => {
    expect(formatSavedDate('2025-12-31T18:00:00.000Z', TODAY)).toBe('1 Jan');
  });

  it('so năm với `today` truyền vào, không đọc đồng hồ máy', () => {
    expect(formatSavedDate('2026-10-03T05:00:00.000Z', '2027-01-02')).toBe('3 Oct 2026');
  });
});
```

Thêm vào CUỐI `libs/shared/i18n/src/lib/messages.spec.ts` (gói i18n bật `globals`, không import
`describe`):

```ts
describe('messages: accountSaved (trang /account/saved, spec 09/10)', () => {
  it('savedOn ghép đúng chữ của bản vẽ: "Saved 3 Oct"', () => {
    expect(messages.accountSaved.savedOn('3 Oct')).toBe('Saved 3 Oct');
  });
});
```

- [ ] **Step 2: Chạy thấy đỏ**

Run:

```bash
pnpm --filter @tourism/web exec vitest run src/lib/wishlist.spec.ts --maxWorkers=2
pnpm --filter @tourism/i18n exec vitest run src/lib/messages.spec.ts
```

Expected: FAIL đúng 5 ca `formatSavedDate` (TypeError: `formatSavedDate` is not a function — chưa
có export) và ca `savedOn` (TypeError: `messages.accountSaved.savedOn` is not a function). Mọi ca
cũ xanh.

- [ ] **Step 3: Code tối thiểu**

Trong `apps/web/src/lib/wishlist.ts`, thay JSDoc đầu file (dòng 1–6) bằng JSDoc dưới đây và hai
dòng import ngay sau nó:

```ts
/**
 * Logic thuần cho wishlist: nút tim (cụm B, nửa 1) và thẻ đã lưu ở `/account/saved`.
 *
 * Tách khỏi component để test được mà không cần dựng DOM: các hàm ở đây quyết định (a) khách
 * chưa đăng nhập bị đưa đi đâu, (b) trạng thái tim đổi ra sao và (c) ngày lưu in thế nào.
 */
import { vietnamToday } from '@tourism/contract';
import { formatChipDate, formatDate } from './tours';
```

Thêm vào CUỐI file:

```ts
/**
 * Ngày lưu trên thẻ `/account/saved` (spec 09/10 §3): "3 Oct"; khác năm với hôm nay thì
 * "3 Oct 2025".
 *
 * `addedAt` là mốc giờ ISO (`…Z`), nên đổi sang NGÀY LỊCH VIỆT NAM trước (`vietnamToday`) rồi
 * mới in — lưu lúc 01:30 sáng giờ Việt Nam là ngày hôm ấy, dù theo UTC vẫn là hôm trước; năm
 * cũng so theo chính ngày ấy.
 *
 * `today` là ngày lịch Việt Nam do trang server tính (`todayDateString`), KHÔNG đọc đồng hồ ở
 * đây: thẻ là Client Component, đọc đồng hồ thì HTML của server và lần hydrate có thể in khác
 * nhau ngay đêm giao thừa, và máy khách để sai giờ là in sai năm.
 */
export function formatSavedDate(addedAt: string, today: string): string {
  const day = vietnamToday(new Date(addedAt));
  return day.slice(0, 4) === today.slice(0, 4) ? formatChipDate(day) : formatDate(day);
}
```

Trong `libs/shared/i18n/src/lib/messages.ts`, khối `accountSaved`, thay:

```ts
    savedCount: (n: number) => (n === 1 ? '1 tour' : `${n} tours`),
    removeAria: (title: string) => `Remove ${title} from saved tours`,
```

bằng:

```ts
    savedCount: (n: number) => (n === 1 ? '1 tour' : `${n} tours`),
    /** Dòng nhỏ trên thẻ đã lưu, trước tên tour: "Saved 3 Oct" (ngày từ `formatSavedDate`). */
    savedOn: (date: string) => `Saved ${date}`,
    removeAria: (title: string) => `Remove ${title} from saved tours`,
```

- [ ] **Step 4: Chạy thấy xanh**

Run:

```bash
pnpm --filter @tourism/web exec vitest run src/lib/wishlist.spec.ts --maxWorkers=2
pnpm --filter @tourism/i18n exec vitest run src/lib/messages.spec.ts
pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only
pnpm --filter @tourism/web typecheck
```

Expected: PASS toàn bộ (wishlist 13 ca: 8 cũ, 5 mới); typecheck xanh.

Đột biến (mỗi cái một lần, ghi kết quả): `vietnamToday(new Date(addedAt))` → `addedAt.slice(0, 10)`
(ca 3 và 4 đỏ); `today.slice(0, 4)` → `String(new Date().getFullYear())` (ca 5 đỏ); đổi chỗ
`formatChipDate` và `formatDate` (ca 1, 2 đỏ); `savedOn` trả `` `Saved: ${date}` `` (ca i18n đỏ).

- [ ] **Step 5: Commit**

```bash
pnpm exec biome check --write apps/web/src/lib/wishlist.ts apps/web/src/lib/wishlist.spec.ts libs/shared/i18n/src/lib/messages.ts libs/shared/i18n/src/lib/messages.spec.ts
git add apps/web/src/lib/wishlist.ts apps/web/src/lib/wishlist.spec.ts libs/shared/i18n/src/lib/messages.ts libs/shared/i18n/src/lib/messages.spec.ts
git commit -m 'feat(web): ngày lưu tour theo lịch Việt Nam cho thẻ Saved, thêm chữ "Saved {date}"'
```

---

### Task 2: Thẻ tour đã lưu `SavedTourCard` và lưới 1/2/3 cột

**Files:**

- Create: `apps/web/src/test/fixtures/wishlist.ts`
- Create: `apps/web/src/components/account/saved-tour-card.tsx`
- Create: `apps/web/src/components/account/saved-tour-card.spec.tsx`
- Modify: `apps/web/src/components/account/saved-grid.tsx` (viết lại trọn file)
- Modify: `apps/web/src/components/account/saved-grid.spec.tsx` (viết lại trọn file)
- Modify: `apps/web/src/app/(site)/account/saved/page.tsx` (import và prop `today` của `SavedGrid`)

**Interfaces:**

- Consumes: `formatSavedDate`, `messages.accountSaved.savedOn` (Task 1); có sẵn
  `messages.accountSaved.removeAria(title)`, `.unavailable`, `.emptyState`,
  `.removeErrorToast`, `messages.toursPage.durationValue(n)`, `formatMoney(amount, currency)`,
  `SlotImage({ image, label, className, sizes })`, `Button` (`size="icon-lg"` = 36px),
  `todayDateString()` (`apps/web/src/lib/account-stats.ts`).
- Produces: `makeWishlistItem(overrides?: Partial<WishlistItem>): WishlistItem`;
  `SavedTourCard(props: { item: WishlistItem; today: string; onRemove: () => void })`;
  `SavedGrid(props: { initialItems: WishlistItem[]; today: string })` — prop `today` mới, bắt
  buộc; lưới mang `data-slot="saved-grid"`. Gỡ: `UnavailableCard`.

- [ ] **Step 1: Viết fixture và test hỏng**

Tạo `apps/web/src/test/fixtures/wishlist.ts`:

```ts
import type { WishlistItem } from '@tourism/contract';

/**
 * Fixture `WishlistItem` dùng chung cho test trang `/account/saved` — trước đây
 * `saved-grid.spec.tsx` tự chép một bản `makeItem`, nay ba spec (thẻ, lưới, trang) cùng dùng.
 *
 * Mặc định: tour còn bán, có đánh giá, CHƯA có ảnh bìa (nhánh ô giữ chỗ là nhánh dễ vỡ hơn nên để
 * test chạy qua nó theo mặc định), lưu lúc 12:00 trưa 3/10 giờ Việt Nam — thẻ in "Saved 3 Oct".
 */
export function makeWishlistItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    tourId: '604041ef-3601-43cb-8a46-cf91f2c9b53a',
    slug: 'ninh-binh-trang-an-day',
    title: 'Ninh Bình: Tràng An, Múa Cave & Rice Fields',
    basePrice: '79.00',
    currency: 'USD',
    durationDays: 1,
    destinationName: 'Ninh Bình',
    ratingAvg: 4.8,
    ratingCount: 132,
    cover: null,
    addedAt: '2026-10-03T05:00:00.000Z',
    unavailable: false,
    ...overrides,
  };
}
```

Tạo `apps/web/src/components/account/saved-tour-card.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WishlistItem } from '@tourism/contract';
import { describe, expect, it, vi } from 'vitest';
import { makeWishlistItem } from '@/test/fixtures/wishlist';
import { SavedTourCard } from './saved-tour-card';

/** Thẻ một tour đã lưu (spec 09/10 §3, phương án A). */
const TODAY = '2026-10-09';
const TITLE = 'Ninh Bình: Tràng An, Múa Cave & Rice Fields';
const COVER: NonNullable<WishlistItem['cover']> = {
  publicId: 'tourism/catalog/tours/ninh-binh',
  url: 'https://res.cloudinary.com/demo/image/upload/v1/tourism/catalog/tours/ninh-binh',
  type: 'IMAGE',
  role: 'hero',
  posterUrl: null,
  width: 1600,
  height: 1200,
  alt: null,
  sortOrder: 0,
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
};

function renderCard(overrides: Partial<WishlistItem> = {}) {
  const onRemove = vi.fn();
  const view = render(
    <SavedTourCard item={makeWishlistItem(overrides)} today={TODAY} onRemove={onRemove} />,
  );
  return { ...view, onRemove };
}

describe('SavedTourCard — tour còn bán', () => {
  it('cả thẻ là MỘT link tới trang tour, tên tour là chữ của link', () => {
    renderCard();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/tours/ninh-binh-trang-an-day');
    expect(links[0]).toHaveTextContent(TITLE);
  });

  it('dòng "Saved {ngày}" theo lịch Việt Nam, cùng năm thì không in năm', () => {
    renderCard({ addedAt: '2026-10-02T18:30:00.000Z' });
    expect(screen.getByText('Saved 3 Oct')).toBeInTheDocument();
  });

  it('lưu từ năm trước thì in cả năm', () => {
    renderCard({ addedAt: '2025-12-20T03:00:00.000Z' });
    expect(screen.getByText('Saved 20 Dec 2025')).toBeInTheDocument();
  });

  it('số ngày, điểm sao một số lẻ, số lượt có dấu phẩy ngăn nghìn, và giá', () => {
    renderCard({ ratingAvg: 4.8, ratingCount: 1320 });
    expect(screen.getByText('1 day')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('(1,320)')).toBeInTheDocument();
    expect(screen.getByText('$79')).toBeInTheDocument();
  });

  it('chưa ai đánh giá: bỏ hẳn phần sao — không "Not yet reviewed", không "★ null"', () => {
    renderCard({ ratingAvg: null, ratingCount: 0 });
    expect(screen.getByText('1 day').closest('p')?.textContent).toBe('1 day');
    expect(screen.queryByText('Not yet reviewed')).not.toBeInTheDocument();
  });

  it('tim là nút bật/tắt đang BẬT, tên đọc có tên tour, nằm NGOÀI link; bấm thì gọi onRemove', async () => {
    const user = userEvent.setup();
    const { onRemove } = renderCard();
    const heart = screen.getByRole('button', { name: `Remove ${TITLE} from saved tours` });
    expect(heart).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link')).not.toContainElement(heart);
    await user.click(heart);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('ảnh bìa 4:3 bo góc, `sizes` theo số cột của lưới', () => {
    const { container } = renderCard({ cover: COVER });
    const img = container.querySelector('img');
    expect(img).toHaveAttribute(
      'sizes',
      '(min-width: 1024px) 368px, (min-width: 640px) 50vw, 100vw',
    );
    expect(img?.parentElement).toHaveClass('aspect-4/3', 'rounded-xl');
  });

  it('chỉ dựng đúng dữ liệu có — không chip chuyên mục rỗng', () => {
    const { container } = renderCard();
    expect(container.querySelectorAll('[class*="chip"]')).toHaveLength(0);
  });
});

describe('SavedTourCard — tour không còn bán (`unavailable`)', () => {
  it('ảnh xám, nhãn "No longer available", tên muted, không giá, KHÔNG link', () => {
    const { container } = renderCard({ unavailable: true });
    expect(screen.getByText('No longer available')).toBeInTheDocument();
    expect(container.querySelector('.grayscale')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: TITLE })).toHaveClass(
      'text-muted-foreground',
    );
    expect(screen.queryByText('$79')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('tim vẫn bỏ lưu được; dòng "Saved {ngày}" vẫn còn', async () => {
    const user = userEvent.setup();
    const { onRemove } = renderCard({ unavailable: true });
    await user.click(screen.getByRole('button', { name: `Remove ${TITLE} from saved tours` }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Saved 3 Oct')).toBeInTheDocument();
  });
});
```

Thay TRỌN `apps/web/src/components/account/saved-grid.spec.tsx` bằng (ca thẻ chuyển sang
`saved-tour-card.spec.tsx`; ca lỗi nay đo cả THỨ TỰ sau khi thẻ quay lại):

```tsx
import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeWishlistItem } from '@/test/fixtures/wishlist';
import { SavedGrid } from './saved-grid';

// jsdom không có IntersectionObserver — lưới bọc từng thẻ trong `RevealItem` (motion
// `whileInView`). Stub CỤC BỘ theo quy ước ở `reveal-item.spec.tsx`: dời lên vitest.setup.ts là
// gãy test ở file khác.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// Mock client oRPC — chỉ kiểm gọi ĐÚNG payload `wishlist.set`, không gọi API thật.
const { set } = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  api: { wishlist: { set } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

// Lưới CHỈ toast khi LỖI (rollback) — thành công đã tự hiện qua thẻ rời lưới.
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError } }));

/** Ngày lịch Việt Nam do trang server tính. */
const TODAY = '2026-10-09';
const NINH_BINH = makeWishlistItem();
const HA_GIANG = makeWishlistItem({
  tourId: 'ded599f0-df12-43a3-9b3d-bbe5d26764dc',
  slug: 'ha-giang-loop-4d',
  title: 'Hà Giang Loop by Easyrider 4D3N',
  basePrice: '189.00',
});
const HOI_AN = makeWishlistItem({
  tourId: '3c1e8a52-6f0b-4d7e-9a14-2b5f7c9d1e03',
  slug: 'hoi-an-lantern-walk',
  title: 'Hoi An Lantern Walk & Cooking Class',
});

/** Nút tim của một thẻ — tên đọc là khoá có sẵn `accountSaved.removeAria`. */
const heartOf = (title: string) =>
  screen.getByRole('button', { name: `Remove ${title} from saved tours` });

describe('SavedGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    set.mockResolvedValue({ tourId: NINH_BINH.tourId, wished: false });
  });

  it('rỗng ngay từ đầu → trạng thái trống với nút Browse tours, không thẻ nào', () => {
    render(<SavedGrid initialItems={[]} today={TODAY} />);
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveAttribute('href', '/tours');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('rỗng → câu dạy hành vi bấm tim', () => {
    render(<SavedGrid initialItems={[]} today={TODAY} />);
    expect(screen.getByText('Nothing saved yet')).toBeInTheDocument();
    expect(
      screen.getByText('Tap the heart on any tour to keep it here for later.'),
    ).toBeInTheDocument();
  });

  it('dựng đủ N thẻ (tên + giá), thẻ nào cũng có dòng ngày lưu', () => {
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG]} today={TODAY} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('$79')).toBeInTheDocument();
    expect(screen.getByText('$189')).toBeInTheDocument();
    expect(screen.getAllByText('Saved 3 Oct')).toHaveLength(2);
  });

  it('lưới: 1 cột dưới sm, 2 cột từ sm, 3 cột từ lg; khe ngang 24px, dọc 32px', () => {
    const { container } = render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG]} today={TODAY} />);
    expect(container.querySelector('[data-slot="saved-grid"]')).toHaveClass(
      'grid',
      'grid-cols-1',
      'sm:grid-cols-2',
      'lg:grid-cols-3',
      'gap-x-6',
      'gap-y-8',
    );
  });

  it('bấm tim trên MỘT thẻ → thẻ đó rời lưới NGAY, thẻ còn lại vẫn còn', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));
    expect(screen.queryByText(NINH_BINH.title)).not.toBeInTheDocument();
    expect(screen.getByText(HA_GIANG.title)).toBeInTheDocument();
  });

  it('bỏ lưu đến hết → chuyển sang trạng thái trống', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveAttribute('href', '/tours');
  });

  it('bấm tim → gọi wishlist.set({ tourId, wished: false }) đúng payload', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith(
        { tourId: NINH_BINH.tourId, wished: false },
        expect.anything(),
      ),
    );
  });

  it('wishlist.set lỗi → thẻ quay lại ĐÚNG chỗ cũ (không xuống cuối) + toast lỗi', async () => {
    set.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG, HOI_AN]} today={TODAY} />);

    await user.click(heartOf(HA_GIANG.title));

    // Biến mất NGAY lúc bấm đã có ca riêng ở trên; reject có thể xử lý xong trước khi
    // `user.click` trả điều khiển, nên không đo trạng thái "giữa chừng" ở đây.
    expect(await screen.findByText(HA_GIANG.title)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      NINH_BINH.title,
      HA_GIANG.title,
      HOI_AN.title,
    ]);
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});

describe('SavedGrid — session hết hạn', () => {
  // `beforeEach` của describe trên nằm TRONG khối đó, không áp cho đây — thiếu thì mock cộng dồn
  // lượt gọi từ test trước và `not.toHaveBeenCalled` đọc sai.
  beforeEach(() => {
    vi.clearAllMocks();
    set.mockResolvedValue({ tourId: NINH_BINH.tourId, wished: false });
  });

  it('401 → thông báo RIÊNG kèm link đăng nhập lại, KHÔNG toast lỗi chung', async () => {
    set.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: false,
        code: 'UNAUTHORIZED',
        status: 401,
        message: 'Unauthorized',
        data: null,
      }),
    );
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));

    expect(await screen.findByText('Your session has expired.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in again' })).toHaveAttribute(
      'href',
      '/login?redirect=/account/saved',
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it('lỗi KHÔNG phải 401 vẫn dùng toast như cũ', async () => {
    set.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.queryByText('Your session has expired.')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy thấy đỏ**

Run:
`pnpm --filter @tourism/web exec vitest run src/components/account/saved-tour-card.spec.tsx src/components/account/saved-grid.spec.tsx --maxWorkers=2`

Expected: `saved-tour-card.spec.tsx` FAIL cả file (Failed to resolve import `./saved-tour-card`);
`saved-grid.spec.tsx` FAIL hai ca — "dựng đủ N thẻ…" (thẻ cũ là `div`, không có role `article`,
chưa có dòng "Saved 3 Oct") và "lưới: 1 cột…" (chưa có `data-slot="saved-grid"`). Các ca còn lại
xanh ngay (canh hồi quy, kể cả ca thứ tự sau lỗi — `splice` cũ đã đúng).

- [ ] **Step 3: Code tối thiểu**

Tạo `apps/web/src/components/account/saved-tour-card.tsx`:

```tsx
import type { WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import { ClockIcon, HeartIcon, StarIcon } from 'lucide-react';
import { SlotImage } from '@/components/slot-image';
import { formatMoney } from '@/lib/tours';
import { formatSavedDate } from '@/lib/wishlist';

/**
 * `sizes` của ảnh bìa theo số cột của `SavedGrid`: từ `lg` ba cột trong khung tối đa 1152px, khe
 * 24px → mỗi ảnh tối đa 368px; từ `sm` hai cột ≈ nửa màn hình; dưới `sm` một cột trọn bề ngang.
 */
const COVER_SIZES = '(min-width: 1024px) 368px, (min-width: 640px) 50vw, 100vw';

/**
 * Thẻ MỘT tour đã lưu (spec 09/10 §3, phương án A) — không viền, ảnh trên chữ dưới như thẻ tour
 * của site.
 *
 * - Ảnh bìa 4:3 bo góc; nút tim 36px LUÔN hiện ở góc phải trên ảnh (cả điện thoại, nơi không có
 *   hover), tim đặc màu chủ đạo, `aria-pressed="true"`, tên đọc "Remove {tour} from saved tours".
 *   Nút là ANH EM của ảnh và mang `z-10`: lớp phủ bấm-cả-thẻ (`after:` của link tiêu đề) nằm sau
 *   trong DOM nên mặc định vẽ đè lên nó; còn ảnh xám mang `filter` (tạo stacking context), nên
 *   nút và nhãn không được nằm TRONG khung ảnh.
 * - Dưới ảnh: "Saved {ngày}" (ngày lịch Việt Nam của `addedAt`) → tên tour (tối đa 2 dòng, giữ
 *   chỗ 2 dòng để hàng thẻ thẳng nhau) → số ngày kèm sao và số lượt (chưa ai đánh giá thì bỏ hẳn
 *   phần sao, không in nhãn thay) → giá.
 * - Tour không còn bán (`unavailable`): ảnh xám, nhãn "No longer available" góc trái trên ảnh,
 *   tên muted, không giá, KHÔNG link — trang tour đã gỡ, link chết còn tệ hơn thẻ không bấm
 *   được; tim vẫn bỏ lưu được.
 *
 * Vì sao không dùng `TourCard`: `WishlistItemSchema` chỉ mang tên, giá, số ngày, sao và ảnh bìa
 * — nhét vào `TourCardVM` là phải BỊA chuyên mục, cỡ nhóm, cờ nổi bật. Thẻ riêng chỉ dựng đúng
 * thứ dữ liệu có.
 */
export function SavedTourCard({
  item,
  today,
  onRemove,
}: {
  item: WishlistItem;
  /** Ngày lịch Việt Nam do server tính (`todayDateString`) — quyết có in năm hay không. */
  today: string;
  onRemove: () => void;
}) {
  const t = messages.accountSaved;
  const tc = messages.toursPage;
  const off = item.unavailable;

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative">
        <SlotImage
          image={item.cover}
          label={item.destinationName ?? undefined}
          className={cn('aspect-4/3 w-full rounded-xl', off && 'opacity-75 grayscale')}
          sizes={COVER_SIZES}
        />
        {off ? (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-background px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
            {t.unavailable}
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-pressed="true"
          aria-label={t.removeAria(item.title)}
          onClick={onRemove}
          className="absolute top-2.5 right-2.5 z-10 rounded-full bg-background/80 text-primary-emphasis shadow-(--shadow-card) backdrop-blur-sm hover:bg-background hover:text-primary-emphasis dark:hover:bg-background"
        >
          <HeartIcon aria-hidden="true" className="fill-current" />
        </Button>
      </div>

      <div className="pt-3">
        <p className="text-[0.625rem] font-bold tracking-[0.15em] text-muted-foreground uppercase">
          {t.savedOn(formatSavedDate(item.addedAt, today))}
        </p>
        <h3
          className={cn(
            'mt-1.5 line-clamp-2 min-h-[2lh] font-heading text-lg leading-snug font-medium',
            off
              ? 'text-muted-foreground'
              : 'text-foreground transition-colors group-hover:text-primary-emphasis',
          )}
        >
          {off ? (
            item.title
          ) : (
            // Cả thẻ là MỘT vùng bấm qua `after:inset-0`, cùng thủ thuật `TourCard`.
            <a href={`/tours/${item.slug}`} className="after:absolute after:inset-0">
              {item.title}
            </a>
          )}
        </h3>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon aria-hidden="true" className="size-3.5" />
            {tc.durationValue(item.durationDays)}
          </span>
          {/* `ratingAvg` null = CHƯA AI đánh giá, khác hẳn 0 điểm — bỏ hẳn phần sao. */}
          {item.ratingAvg === null ? null : (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <StarIcon aria-hidden="true" className="size-3.5 fill-rating text-rating" />
              <span className="font-medium text-foreground">{item.ratingAvg.toFixed(1)}</span>
              <span>({item.ratingCount.toLocaleString('en-US')})</span>
            </span>
          )}
        </p>
        {off ? null : (
          <p className="mt-1.5 font-heading text-lg font-semibold text-foreground tabular-nums">
            {formatMoney(item.basePrice, item.currency)}
          </p>
        )}
      </div>
    </article>
  );
}
```

Thay TRỌN `apps/web/src/components/account/saved-grid.tsx` bằng:

```tsx
'use client';

import { ORPCError } from '@orpc/client';
import type { WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { SavedTourCard } from '@/components/account/saved-tour-card';
import { RevealItem } from '@/components/motion/reveal-item';
import { api, withBrowserAuth } from '@/lib/api/client';
import { STAGGER } from '@/lib/motion';

/**
 * Hướng A: bỏ khung hộp (`border`/`bg-card`) — trước đây nhốt copy dạy-hành-vi
 * trong một hộp trông như thông báo lỗi. Giờ chỉ căn giữa, khoảng trắng rộng
 * tự làm việc, cùng nhịp "không hộp" với empty-state Trips.
 */
function EmptyState() {
  const t = messages.accountSaved.emptyState;
  return (
    <div className="py-16 text-center">
      <h2 className="font-heading text-2xl font-medium text-balance text-foreground">
        {t.heading}
      </h2>
      <p className="mt-3 text-pretty text-muted-foreground">{t.body}</p>
      <ButtonLink href="/tours" className="mt-6">
        {t.cta}
      </ButtonLink>
    </div>
  );
}

/**
 * Lưới `/account/saved` (spec 09/10 §3, phương án A): 1 cột dưới `sm`, 2 cột từ `sm`, 3 cột từ
 * `lg`; khe ngang 24px, dọc 32px. Mỗi ô là một `SavedTourCard` (tim nổi trên ảnh).
 *
 * Bấm tim → xoá OPTIMISTIC khỏi mảng rồi mới gọi `wishlist.set({ tourId, wished: false })`
 * (idempotent, cùng route nút tim ở `/tours` dùng để lưu). Lỗi → chèn lại ĐÚNG vị trí cũ (không
 * đẩy xuống cuối) + toast lỗi; KHÔNG toast khi thành công — thẻ rời lưới đã là xác nhận đủ.
 *
 * 401 giữa chừng có thông báo RIÊNG kèm link đăng nhập lại: toast biến mất sau vài giây, còn tin
 * "phải đăng nhập lại" phải nằm lại trên trang. 429 có câu "chờ một phút" riêng.
 *
 * `today` là ngày lịch Việt Nam do server tính, truyền xuống thẻ để in "Saved {ngày}".
 */
export function SavedGrid({
  initialItems,
  today,
}: {
  initialItems: WishlistItem[];
  today: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [expired, setExpired] = useState(false);
  const t = messages.accountSaved;

  async function handleRemove(tourId: string) {
    const index = items.findIndex((item) => item.tourId === tourId);
    if (index === -1) return;
    const removed = items[index] as WishlistItem;
    setItems((current) => current.filter((item) => item.tourId !== tourId));
    try {
      await api.wishlist.set({ tourId, wished: false }, { context: withBrowserAuth() });
    } catch (error) {
      // Rollback ĐÚNG vị trí cũ (splice), không phải push cuối mảng — tránh
      // thứ tự "mới nhất trước" (server) nhảy lộn xộn chỉ vì một request lỗi.
      setItems((current) => {
        const next = [...current];
        next.splice(index, 0, removed);
        return next;
      });
      // Hết phiên là chuyện KHÁC hẳn "thao tác hỏng": khách cần biết phải đăng
      // nhập lại, không phải thử bấm lại.
      if (error instanceof ORPCError && error.status === 401) {
        setExpired(true);
        return;
      }
      if (error instanceof ORPCError && error.status === 429) {
        toast.error(messages.accountActionErrors.throttle);
        return;
      }
      toast.error(t.removeErrorToast.title, { description: t.removeErrorToast.body });
    }
  }

  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      {expired ? (
        <AccountActionError expired redirectTo="/account/saved" fallback={null} className="mb-4" />
      ) : null}
      <div
        data-slot="saved-grid"
        className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
      >
        {items.map((item, index) => (
          // Thẻ đã lưu trồi lên bậc thang — cùng nhịp lưới /tours (nhóm motion 3, 19/08).
          <RevealItem
            key={item.tourId}
            enter="rise"
            delay={Math.min(index, 5) * STAGGER.grid}
            className="h-full"
          >
            <SavedTourCard item={item} today={today} onRemove={() => handleRemove(item.tourId)} />
          </RevealItem>
        ))}
      </div>
    </>
  );
}
```

Trong `apps/web/src/app/(site)/account/saved/page.tsx`: thêm import
`import { todayDateString } from '@/lib/account-stats';` ngay sau dòng import `ContentHero`, và
thay `<SavedGrid initialItems={wishlist} />` bằng
`<SavedGrid initialItems={wishlist} today={todayDateString()} />`.

- [ ] **Step 4: Chạy thấy xanh**

Run:

```bash
pnpm --filter @tourism/web exec vitest run src/components/account/saved-tour-card.spec.tsx src/components/account/saved-grid.spec.tsx --maxWorkers=2
pnpm --filter @tourism/web typecheck
grep -rn "UnavailableCard" apps/web/src
```

Expected: PASS (thẻ 10 ca, lưới 10 ca); typecheck xanh; `grep` rỗng.

Đột biến: bỏ `aria-pressed` (ca tim đỏ); in `tc.notRated` khi `ratingAvg === null` (ca chưa
đánh giá đỏ); giữ link cho nhánh `unavailable` (ca unavailable đỏ); bỏ `off ? null :` trước giá
(ca unavailable đỏ); đổi `COVER_SIZES` (ca ảnh đỏ); `next.splice(index, 0, removed)` →
`next.push(removed)` (ca thứ tự sau lỗi đỏ); `gap-y-8` → `gap-y-6` (ca lưới đỏ).

- [ ] **Step 5: Commit**

```bash
pnpm exec biome check --write apps/web/src/test/fixtures/wishlist.ts apps/web/src/components/account/saved-tour-card.tsx apps/web/src/components/account/saved-tour-card.spec.tsx apps/web/src/components/account/saved-grid.tsx apps/web/src/components/account/saved-grid.spec.tsx "apps/web/src/app/(site)/account/saved/page.tsx"
git add apps/web/src/test/fixtures/wishlist.ts apps/web/src/components/account/saved-tour-card.tsx apps/web/src/components/account/saved-tour-card.spec.tsx apps/web/src/components/account/saved-grid.tsx apps/web/src/components/account/saved-grid.spec.tsx "apps/web/src/app/(site)/account/saved/page.tsx"
git commit -m 'feat(web): thẻ tour đã lưu kiểu mới — tim nổi trên ảnh, ngày lưu theo lịch Việt Nam, lưới 1/2/3 cột'
```

---

### Task 3: Bỏ lưu làm mới số ở hero, trạng thái trống mới, trang Saved có nút quay lại (`SavedView`)

**Files:**

- Modify: `apps/web/src/components/account/saved-grid.tsx` (viết lại trọn file)
- Modify: `apps/web/src/components/account/saved-grid.spec.tsx` (mock `next/navigation`; ca trống
  mới; ca làm mới)
- Create: `apps/web/src/components/account/saved-view.tsx`
- Create: `apps/web/src/components/account/saved-view.spec.tsx`
- Modify: `apps/web/src/app/(site)/account/saved/page.tsx` (viết lại trọn file)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `accountSaved`: comment, gỡ `back`,
  `listHeading`, `blurb`; JSDoc `accountBookings.backToPassport`)

**Interfaces:**

- Consumes: `SavedGrid({ initialItems, today })`, `makeWishlistItem` (Task 2); `ContentHero` prop
  `back?: { href: string; label: string }`; `messages.accountBookings.backToPassport`;
  `messages.accountSaved.{heroBreadcrumb,title,subtitle,savedCount,emptyState}`;
  `useRouter().refresh()` của `next/navigation`.
- Produces: `SavedView(props: { items: WishlistItem[]; today: string })`; khối trống mang
  `data-slot="saved-empty"`. Gỡ khoá: `accountSaved.back`, `accountSaved.listHeading`,
  `accountSaved.blurb`.

- [ ] **Step 1: Đọc doc của Next 16**

Đọc `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`
(mục `router.refresh()`): làm mới route hiện tại, dựng lại Server Component, gộp payload mới mà
KHÔNG mất `useState` của client.

- [ ] **Step 2: Viết test hỏng**

Trong `apps/web/src/components/account/saved-grid.spec.tsx`:

1. Ngay SAU khối mock `sonner` (dòng `vi.mock('sonner', …)`), thêm:

```tsx
// Bỏ lưu thành công thì lưới làm mới trang để hero (server in) đếm lại — spec 09/10 §3.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
```

2. Thay TRỌN ca `it('rỗng → câu dạy hành vi bấm tim', …)` bằng:

```tsx
  it('rỗng → khối trống giữa trang: icon tim trong vòng tròn, tiêu đề, câu dạy bấm tim, nút chính', () => {
    const { container } = render(<SavedGrid initialItems={[]} today={TODAY} />);
    const empty = container.querySelector('[data-slot="saved-empty"]');
    expect(empty).toHaveClass('mx-auto', 'max-w-130', 'border-dashed', 'text-center');
    expect(empty?.querySelector('svg')).not.toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Nothing saved yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Tap the heart on any tour to keep it here for later.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveClass('bg-primary');
  });
```

3. Thêm vào CUỐI describe `SavedGrid` (ngay sau ca "wishlist.set lỗi → thẻ quay lại ĐÚNG chỗ cũ"):

```tsx
  it('bỏ lưu THÀNH CÔNG → làm mới trang đúng một lần để hero đếm lại', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('bỏ lưu LỖI → KHÔNG làm mới: hero giữ số cũ, thẻ đã quay lại', async () => {
    set.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));
    expect(await screen.findByText(NINH_BINH.title)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
```

4. Trong ca `401 → thông báo RIÊNG…`, ngay dưới dòng `expect(toastError).not.toHaveBeenCalled();`
   thêm `expect(refresh).not.toHaveBeenCalled();`.

Tạo `apps/web/src/components/account/saved-view.spec.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeWishlistItem } from '@/test/fixtures/wishlist';
import { SavedView } from './saved-view';

// Lưới bọc thẻ trong `RevealItem` (motion `whileInView`) — jsdom không có IntersectionObserver.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const { set } = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  api: { wishlist: { set } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

/** Trang `/account/saved` (spec 09/10 §1, §3). */
const TODAY = '2026-10-09';
const FIRST = makeWishlistItem();
const SECOND = makeWishlistItem({
  tourId: 'ded599f0-df12-43a3-9b3d-bbe5d26764dc',
  slug: 'ha-giang-loop-4d',
  title: 'Hà Giang Loop by Easyrider 4D3N',
});

describe('SavedView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    set.mockResolvedValue({ tourId: FIRST.tourId, wished: false });
  });

  it('hero giữ chữ cũ, in số tour, có nút tròn "Back to Passport" về /account; không còn link chữ "← Passport"', () => {
    render(<SavedView items={[FIRST, SECOND]} today={TODAY} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tucked inside' })).toBeInTheDocument();
    expect(screen.getByText('Tours you’ve bookmarked to plan later.')).toBeInTheDocument();
    expect(screen.getByText('2 tours')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Passport' })).toHaveAttribute(
      'href',
      '/account',
    );
    expect(screen.queryByText('← Passport')).not.toBeInTheDocument();
  });

  it('lưới nằm trong khung tối đa 1152px, lề 16px dưới lg', () => {
    const { container } = render(<SavedView items={[FIRST]} today={TODAY} />);
    const frame = container.querySelector('[data-slot="saved-grid"]')?.parentElement;
    expect(frame).toHaveClass('mx-auto', 'max-w-6xl');
    expect(frame?.parentElement).toHaveClass('px-4', 'lg:px-8');
  });

  it('bỏ lưu thành công: thẻ rời ngay, trang được làm mới, server trả danh sách mới thì hero đếm lại', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SavedView items={[FIRST, SECOND]} today={TODAY} />);

    await user.click(
      screen.getByRole('button', { name: `Remove ${FIRST.title} from saved tours` }),
    );
    expect(screen.queryByText(FIRST.title)).not.toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    // `router.refresh()` dựng lại trang ở server: SavedView nhận danh sách đã bỏ FIRST.
    rerender(<SavedView items={[SECOND]} today={TODAY} />);
    expect(screen.getByText('1 tour')).toBeInTheDocument();
    expect(screen.getByText(SECOND.title)).toBeInTheDocument();
    expect(screen.queryByText(FIRST.title)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Chạy thấy đỏ**

Run:
`pnpm --filter @tourism/web exec vitest run src/components/account/saved-grid.spec.tsx src/components/account/saved-view.spec.tsx --maxWorkers=2`

Expected: `saved-view.spec.tsx` FAIL cả file (Failed to resolve import `./saved-view`);
`saved-grid.spec.tsx` FAIL hai ca — "khối trống giữa trang…" (chưa có `data-slot="saved-empty"`)
và "bỏ lưu THÀNH CÔNG → làm mới…" (`refresh` chưa được gọi — ca này đỏ sau ~5 giây chờ của
`waitFor`). Ca "bỏ lưu LỖI → KHÔNG làm mới" và
ca 401 xanh ngay (canh hồi quy).

- [ ] **Step 4: Code tối thiểu**

Thay TRỌN `apps/web/src/components/account/saved-grid.tsx` bằng:

```tsx
'use client';

import { ORPCError } from '@orpc/client';
import type { WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { HeartIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { SavedTourCard } from '@/components/account/saved-tour-card';
import { RevealItem } from '@/components/motion/reveal-item';
import { api, withBrowserAuth } from '@/lib/api/client';
import { STAGGER } from '@/lib/motion';

/**
 * Trạng thái trống (spec 09/10 §3): khối giữa trang — icon tim trong vòng tròn nền muted, câu
 * dạy hành vi bấm tim, nút chính "Browse tours".
 *
 * Khung viền ĐỨT, nền thẻ, rộng tối đa 520px theo bản vẽ 09/10 (phần chung của mọi phương án
 * Saved). Khác hộp viền liền đã gỡ ngày 11/08 vì trông như thông báo lỗi: viền đứt đọc ra là ô
 * còn trống chờ lấp, và icon tim nói luôn phải bấm vào đâu.
 */
function EmptyState() {
  const t = messages.accountSaved.emptyState;
  return (
    <div
      data-slot="saved-empty"
      className="mx-auto max-w-130 rounded-2xl border border-dashed bg-card px-5 py-9 text-center"
    >
      <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted text-ink">
        <HeartIcon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="font-heading text-xl font-semibold text-balance text-foreground">
        {t.heading}
      </h2>
      <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{t.body}</p>
      <ButtonLink href="/tours" className="mt-4">
        {t.cta}
      </ButtonLink>
    </div>
  );
}

/**
 * Lưới `/account/saved` (spec 09/10 §3, phương án A): 1 cột dưới `sm`, 2 cột từ `sm`, 3 cột từ
 * `lg`; khe ngang 24px, dọc 32px. Mỗi ô là một `SavedTourCard` (tim nổi trên ảnh).
 *
 * Bấm tim → xoá OPTIMISTIC khỏi mảng rồi mới gọi `wishlist.set({ tourId, wished: false })`
 * (idempotent, cùng route nút tim ở `/tours` dùng để lưu). Lỗi → chèn lại ĐÚNG vị trí cũ (không
 * đẩy xuống cuối) + toast lỗi; KHÔNG toast khi thành công — thẻ rời lưới đã là xác nhận đủ.
 *
 * Bỏ THÀNH CÔNG thì `router.refresh()`: số tour ở hero do server in (trang → `SavedView`), làm
 * mới là hero đếm lại theo đúng dữ liệu server. Next 16 gộp payload mới mà GIỮ `useState` của
 * lưới, nên thẻ vừa bỏ không quay lại và thứ tự không xáo. Lỗi hay 401 thì không làm mới.
 *
 * 401 giữa chừng có thông báo RIÊNG kèm link đăng nhập lại: toast biến mất sau vài giây, còn tin
 * "phải đăng nhập lại" phải nằm lại trên trang. 429 có câu "chờ một phút" riêng.
 *
 * `today` là ngày lịch Việt Nam do server tính, truyền xuống thẻ để in "Saved {ngày}".
 */
export function SavedGrid({
  initialItems,
  today,
}: {
  initialItems: WishlistItem[];
  today: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [expired, setExpired] = useState(false);
  const router = useRouter();
  const t = messages.accountSaved;

  async function handleRemove(tourId: string) {
    const index = items.findIndex((item) => item.tourId === tourId);
    if (index === -1) return;
    const removed = items[index] as WishlistItem;
    setItems((current) => current.filter((item) => item.tourId !== tourId));
    try {
      await api.wishlist.set({ tourId, wished: false }, { context: withBrowserAuth() });
      // Hero đếm lại SAU khi bỏ thành công (spec 09/10 §3) — xem JSDoc ở trên.
      router.refresh();
    } catch (error) {
      // Rollback ĐÚNG vị trí cũ (splice), không phải push cuối mảng — tránh
      // thứ tự "mới nhất trước" (server) nhảy lộn xộn chỉ vì một request lỗi.
      setItems((current) => {
        const next = [...current];
        next.splice(index, 0, removed);
        return next;
      });
      // Hết phiên là chuyện KHÁC hẳn "thao tác hỏng": khách cần biết phải đăng
      // nhập lại, không phải thử bấm lại.
      if (error instanceof ORPCError && error.status === 401) {
        setExpired(true);
        return;
      }
      if (error instanceof ORPCError && error.status === 429) {
        toast.error(messages.accountActionErrors.throttle);
        return;
      }
      toast.error(t.removeErrorToast.title, { description: t.removeErrorToast.body });
    }
  }

  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      {expired ? (
        <AccountActionError expired redirectTo="/account/saved" fallback={null} className="mb-4" />
      ) : null}
      <div
        data-slot="saved-grid"
        className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
      >
        {items.map((item, index) => (
          // Thẻ đã lưu trồi lên bậc thang — cùng nhịp lưới /tours (nhóm motion 3, 19/08).
          <RevealItem
            key={item.tourId}
            enter="rise"
            delay={Math.min(index, 5) * STAGGER.grid}
            className="h-full"
          >
            <SavedTourCard item={item} today={today} onRemove={() => handleRemove(item.tourId)} />
          </RevealItem>
        ))}
      </div>
    </>
  );
}
```

Tạo `apps/web/src/components/account/saved-view.tsx`:

```tsx
import type { WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { SavedGrid } from '@/components/account/saved-grid';
import { ContentHero } from '@/components/content/content-hero';

/**
 * Thân trang `/account/saved` (spec 09/10 §1, §3) — tách khỏi `page.tsx` để test được: Vitest
 * của web không quét `src/app/**` (nếp `BookingsListView`). Trang lo phiên và đọc wishlist;
 * component này lo hero và lưới.
 *
 * - Hero giữ chữ cũ; `meta` là số tour đã lưu. Bỏ lưu thành công thì `SavedGrid` gọi
 *   `router.refresh()`: trang dựng lại ở server, component này nhận danh sách mới nên hero đếm
 *   lại, còn lưới giữ state của nó.
 * - Nút tròn quay lại Passport (`ContentHero.back`) thay link chữ "← Passport" cũ — cùng khoá
 *   nhãn với My bookings.
 * - Khung rộng tối đa 1152px; lề 16px dưới `lg`, 32px từ `lg`.
 */
export function SavedView({
  items,
  today,
}: {
  items: WishlistItem[];
  /** Ngày lịch Việt Nam do server tính (`todayDateString`). */
  today: string;
}) {
  const t = messages.accountSaved;
  return (
    <div>
      <ContentHero
        breadcrumb={t.heroBreadcrumb}
        title={t.title}
        subtitle={t.subtitle}
        meta={t.savedCount(items.length)}
        back={{ href: '/account', label: messages.accountBookings.backToPassport }}
      />
      <div className="px-4 pt-10 pb-16 md:pb-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SavedGrid initialItems={items} today={today} />
        </div>
      </div>
    </div>
  );
}
```

Thay TRỌN `apps/web/src/app/(site)/account/saved/page.tsx` bằng:

```tsx
import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SavedView } from '@/components/account/saved-view';
import { todayDateString } from '@/lib/account-stats';
import { requireSession } from '@/lib/api/session';
import { fetchMyWishlist } from '@/lib/api/wishlist';

/**
 * `/account/saved` — tour đã lưu (spec 09/10 §3, phương án A). Trang chỉ gác phiên và đọc
 * wishlist; hero và lưới nằm ở `SavedView`. `today` (ngày lịch Việt Nam) tính ở server để thẻ in
 * "Saved {ngày}" không phụ thuộc đồng hồ trình duyệt.
 */
export const metadata: Metadata = {
  title: `${messages.accountSaved.title} — Nexora`,
  description: messages.accountSaved.subtitle,
};

export default async function AccountSavedPage() {
  // Chỉ cần GATE (defense-in-depth, `proxy.ts` đã chặn sớm — ADR-0017 §3).
  await requireSession('/account/saved');
  const cookie = (await cookies()).toString();
  const wishlist = await fetchMyWishlist(cookie);
  return <SavedView items={wishlist} today={todayDateString()} />;
}
```

Trong `libs/shared/i18n/src/lib/messages.ts`:

1. Thay:

```ts
  // Trang `/account/saved` — grid tour đã lưu (wishlist), nút ✕ bỏ lưu (A1:
  // state cục bộ optimistic trên mock, A2 nối `wishlist.set`).
  accountSaved: {
```

bằng:

```ts
  // Trang `/account/saved` — lưới thẻ tour đã lưu (spec 09/10 §3): tim nổi trên ảnh bỏ lưu
  // optimistic qua `wishlist.set`; hero đếm lại sau khi bỏ thành công.
  accountSaved: {
```

2. Thay (đúng đoạn này của khối `accountSaved` — hai khối khác cũng có `back: '← Passport'`, đừng
   đụng):

```ts
    subtitle: 'Tours you’ve bookmarked to plan later.',
    back: '← Passport',
    /** Tiêu đề MỤC ở cột trái — cố ý KHÁC `title` của trang. Đặt trùng thì cột
     *  trái và H1 thành hai dòng chữ y hệt nhau cách nhau vài chục px. */
    listHeading: 'Your list',
    blurb: 'Ready whenever you are.',
    savedCount: (n: number) => (n === 1 ? '1 tour' : `${n} tours`),
```

bằng:

```ts
    subtitle: 'Tours you’ve bookmarked to plan later.',
    savedCount: (n: number) => (n === 1 ? '1 tour' : `${n} tours`),
```

3. Trong khối `accountBookings`, thay dòng JSDoc ngay trên `backToPassport: 'Back to Passport',`:

```ts
    /** Nút tròn quay lại ở hero của My bookings (`ContentHero.back`). */
```

bằng:

```ts
    /** Nút tròn quay lại Passport ở hero (`ContentHero.back`) — một khoá cho My bookings và Saved. */
```

- [ ] **Step 5: Chạy thấy xanh**

Run:

```bash
pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only
pnpm --filter @tourism/web exec vitest run src/components/account/saved-grid.spec.tsx src/components/account/saved-view.spec.tsx src/components/account/saved-tour-card.spec.tsx --maxWorkers=2
pnpm --filter @tourism/web typecheck
grep -rn "listHeading\|accountSaved\.back\|accountSaved\.blurb" apps libs --include=*.ts --include=*.tsx
```

Expected: PASS (lưới 12 ca, trang 3 ca, thẻ 10 ca); typecheck xanh (nó bắt mọi chỗ còn đọc
`accountSaved.back`); `grep` rỗng.

Đột biến: bỏ `router.refresh()` (ca "làm mới" của lưới và ca cuối của trang đỏ); gọi THÊM
`router.refresh()` ở cuối `catch` (ca "bỏ lưu LỖI → KHÔNG làm mới" đỏ); bỏ prop `back` (ca hero
đỏ); `border-dashed` → `border` (ca trống đỏ); `meta` đếm theo một hằng `2` thay vì
`items.length` (ca cuối của trang đỏ).

- [ ] **Step 6: Commit**

```bash
pnpm exec biome check --write apps/web/src/components/account/saved-grid.tsx apps/web/src/components/account/saved-grid.spec.tsx apps/web/src/components/account/saved-view.tsx apps/web/src/components/account/saved-view.spec.tsx "apps/web/src/app/(site)/account/saved/page.tsx" libs/shared/i18n/src/lib/messages.ts
git add apps/web/src/components/account/saved-grid.tsx apps/web/src/components/account/saved-grid.spec.tsx apps/web/src/components/account/saved-view.tsx apps/web/src/components/account/saved-view.spec.tsx "apps/web/src/app/(site)/account/saved/page.tsx" libs/shared/i18n/src/lib/messages.ts
git commit -m 'feat(web): trang Saved có nút quay lại ở hero, số tour cập nhật sau khi bỏ lưu, trạng thái trống mới'
```

---

### Task 4: Thẻ danh tính `IdentityCard` (AvatarUpload dựng dọc 96px, Connected accounts)

> **Điều chỉnh của session gốc (09/10), thắng phần code bên dưới:** dưới ảnh 96px có thêm MỘT nút
> `variant="outline" size="sm"` chữ `t.upload` ("Upload avatar"), bấm mở cùng ô chọn file với ảnh — bản vẽ C
> user duyệt có nút này, và điện thoại không có hover để lộ rằng ảnh bấm được. Ảnh vẫn bấm và thả được như
> plan viết. Test thêm: có nút tên "Upload avatar" nhìn thấy được, bấm thì gọi `click()` của ô file. Nút
> bị khoá khi đang tải (cùng cờ `busy`). Không thêm khoá chữ mới.

**Files:**

- Create: `apps/web/src/test/fixtures/account.ts`
- Modify: `apps/web/src/components/account/avatar-upload.tsx` (import `react` dòng 9; JSDoc gạch
  đầu tiên dòng 18–20; tham số và kiểu dòng 36–43; khối `return` dòng 142–227)
- Modify: `apps/web/src/components/account/avatar-upload.spec.tsx` (thêm describe cuối file)
- Create: `apps/web/src/components/account/identity-card.tsx`
- Create: `apps/web/src/components/account/identity-card.spec.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (gỡ `accountProfile.avatar.selected`)

**Interfaces:**

- Consumes: `AvatarUpload` có sẵn (luồng ký, tải, lưu, gỡ không đổi); `Separator`
  (`@tourism/ui/components/separator`); `messages.accountProfile.connected.{heading,emailPassword}`,
  `messages.accountProfile.avatar.{upload,remove,hint}`.
- Produces: `makeSessionUser(overrides?: Partial<SessionUser>): SessionUser`;
  `AvatarUpload(props: { initial: string; image: string | null; children?: ReactNode })`;
  `IdentityCard(props: { profile: SessionUser; className?: string })`, gốc mang
  `data-slot="identity-card"`. Gỡ khoá: `accountProfile.avatar.selected`.

- [ ] **Step 1: Viết fixture và test hỏng**

Tạo `apps/web/src/test/fixtures/account.ts`:

```ts
import type { SessionUser } from '@/lib/api/session';

/**
 * Fixture `SessionUser` cho test khu Settings (`/account/settings`) — trước đây mỗi spec chép tay
 * một bản `PROFILE`. Mặc định: khách có tên, có số điện thoại, chưa có ảnh đại diện.
 */
export function makeSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    name: 'Minh Anh',
    email: 'minh.anh@example.com',
    role: 'CUSTOMER',
    phone: '0901234567',
    image: null,
    ...overrides,
  };
}
```

Thêm vào CUỐI `apps/web/src/components/account/avatar-upload.spec.tsx`:

```tsx
describe('AvatarUpload — dựng dọc cho thẻ danh tính (spec 09/10 §2)', () => {
  it('ảnh 96px; `children` nằm GIỮA ảnh và dòng gợi ý; không còn dòng chữ "Upload avatar" riêng', () => {
    render(
      <AvatarUpload initial="A" image={null}>
        <p>Minh Anh</p>
      </AvatarUpload>,
    );
    const avatar = screen.getByRole('button', { name: 'Upload avatar' });
    const name = screen.getByText('Minh Anh');
    const hint = screen.getByText('PNG, JPG up to 2 MB. Click or drop a photo.');
    expect(avatar).toHaveClass('size-24');
    expect(avatar.compareDocumentPosition(name)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(name.compareDocumentPosition(hint)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    // Tên đọc "Upload avatar" chỉ còn là `aria-label` của nút ảnh, không lặp thành dòng chữ.
    expect(screen.queryByText('Upload avatar')).not.toBeInTheDocument();
  });

  it('có ảnh: không in dòng "Avatar selected"', () => {
    render(<AvatarUpload initial="A" image="https://res.cloudinary.com/demo/avatars/user-1.png" />);
    expect(screen.queryByText('Avatar selected')).not.toBeInTheDocument();
  });
});
```

Tạo `apps/web/src/components/account/identity-card.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { makeSessionUser } from '@/test/fixtures/account';
import { IdentityCard } from './identity-card';

// `AvatarUpload` bên trong gọi `useRouter` và client oRPC — ở đây không tải ảnh nào.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({
  api: { media: { signUpload: vi.fn() }, account: { setAvatar: vi.fn() } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

/** Thẻ danh tính — cột trái của Settings (spec 09/10 §2, phương án C). */
const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

describe('IdentityCard', () => {
  it('ảnh 96px → tên (h2) → email → dòng gợi ý cỡ ảnh, đúng thứ tự', () => {
    render(<IdentityCard profile={makeSessionUser()} />);
    const avatar = screen.getByRole('button', { name: 'Upload avatar' });
    const name = screen.getByRole('heading', { level: 2, name: 'Minh Anh' });
    const email = screen.getByText('minh.anh@example.com');
    const hint = screen.getByText(messages.accountProfile.avatar.hint('2 MB'));
    expect(avatar).toHaveClass('size-24');
    expect(name).toHaveClass('font-heading');
    expect(avatar.compareDocumentPosition(name)).toBe(FOLLOWING);
    expect(name.compareDocumentPosition(email)).toBe(FOLLOWING);
    expect(email.compareDocumentPosition(hint)).toBe(FOLLOWING);
  });

  it('chưa có ảnh: chữ cái đầu của tên; tên trống thì chữ cái đầu của email', () => {
    const { unmount } = render(<IdentityCard profile={makeSessionUser()} />);
    expect(screen.getByRole('button', { name: 'Upload avatar' })).toHaveTextContent('M');
    unmount();
    render(<IdentityCard profile={makeSessionUser({ name: '', email: 'linh@example.com' })} />);
    expect(screen.getByRole('button', { name: 'Upload avatar' })).toHaveTextContent('L');
  });

  it('có ảnh: hiện ảnh đã lưu và nút gỡ ảnh', () => {
    const image = 'https://res.cloudinary.com/demo/avatars/user-1.png';
    const { container } = render(<IdentityCard profile={makeSessionUser({ image })} />);
    expect(container.querySelector('img')).toHaveAttribute('src', image);
    expect(screen.getByRole('button', { name: 'Remove avatar' })).toBeInTheDocument();
  });

  it('dưới vạch ngăn: nhãn nhỏ "Connected accounts" và dòng "Email & password"', () => {
    render(<IdentityCard profile={makeSessionUser()} />);
    const separator = screen.getByRole('separator');
    const label = screen.getByRole('heading', { level: 3, name: 'Connected accounts' });
    expect(separator.compareDocumentPosition(label)).toBe(FOLLOWING);
    expect(screen.getByText('Email & password')).toBeInTheDocument();
  });

  it('nhận className của trang (dính ở lg) và mang móc data-slot cho bố cục', () => {
    const { container } = render(
      <IdentityCard profile={makeSessionUser()} className="lg:sticky lg:top-28" />,
    );
    expect(container.querySelector('[data-slot="identity-card"]')).toHaveClass(
      'rounded-2xl',
      'lg:sticky',
      'lg:top-28',
    );
  });
});
```

- [ ] **Step 2: Chạy thấy đỏ**

Run:
`pnpm --filter @tourism/web exec vitest run src/components/account/avatar-upload.spec.tsx src/components/account/identity-card.spec.tsx --maxWorkers=2`

Expected: `identity-card.spec.tsx` FAIL cả file (Failed to resolve import `./identity-card`);
`avatar-upload.spec.tsx` FAIL hai ca mới (nút ảnh còn `size-20`, `children` chưa được dựng nên
không thấy "Minh Anh", còn dòng chữ "Upload avatar" / "Avatar selected"). Bốn ca cũ xanh.

- [ ] **Step 3: Code tối thiểu**

Trong `apps/web/src/components/account/avatar-upload.tsx`:

1. Dòng 9 thành `import { type ReactNode, useEffect, useRef, useState } from 'react';`.
2. Trong JSDoc đầu component, thay gạch đầu tiên:

```tsx
 * - Vòng tròn avatar viền đứt: bấm hoặc kéo-thả ảnh vào; có ảnh → preview
 *   phủ tròn + nút X gỡ; chưa có → chữ cái đầu (đồng bộ ngôn ngữ initial
 *   của khung hộ chiếu, thay UserIcon của mẫu).
```

bằng:

```tsx
 * - Vòng tròn avatar 96px viền đứt, dựng DỌC và căn giữa (thẻ danh tính, spec
 *   09/10 §2): ảnh → `children` (tên, email do thẻ truyền vào) → dòng gợi ý hay
 *   tiến độ → khối lỗi. Bấm hoặc kéo-thả ảnh vào; có ảnh → preview phủ tròn +
 *   nút X gỡ; chưa có → chữ cái đầu (đồng bộ ngôn ngữ initial của khung hộ
 *   chiếu). Tên đọc "Upload avatar" nằm ở nút ảnh, dòng gợi ý đã nói "Click or
 *   drop a photo." — nên không còn dòng chữ "Upload avatar / Avatar selected".
```

3. Thay tham số và kiểu của component:

```tsx
export function AvatarUpload({
  initial,
  image,
}: {
  initial: string;
  /** Avatar đã lưu (URL Cloudinary) — `null` = chưa có, tạm hiện chữ cái đầu. */
  image: string | null;
}) {
```

bằng:

```tsx
export function AvatarUpload({
  initial,
  image,
  children,
}: {
  initial: string;
  /** Avatar đã lưu (URL Cloudinary) — `null` = chưa có, tạm hiện chữ cái đầu. */
  image: string | null;
  /** Nội dung chèn GIỮA ảnh và dòng gợi ý — thẻ danh tính đặt tên và email ở đây. */
  children?: ReactNode;
}) {
```

4. Thay TRỌN khối `return ( … );` cuối component (từ `  return (` tới `  );` ngay trước `}` đóng
   hàm) bằng:

```tsx
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <button
          type="button"
          aria-label={t.upload}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            onPick(e.dataTransfer.files);
          }}
          className={`group/avatar relative size-24 cursor-pointer overflow-hidden rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
            displaySrc
              ? 'border-solid border-border'
              : isDragging
                ? 'border-dashed border-primary bg-primary/5'
                : 'border-dashed border-muted-foreground/25 bg-muted hover:border-muted-foreground/50'
          }`}
        >
          {displaySrc ? (
            // biome-ignore lint/performance/noImgElement: preview là Object URL cục bộ hoặc URL Cloudinary ngoài — next/image chưa khai remotePatterns (nợ ADR-0020).
            <img src={displaySrc} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center font-heading text-4xl font-semibold text-ink/70">
              {initial.toUpperCase()}
            </span>
          )}
        </button>
        {displaySrc ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={removeAvatar}
            disabled={busy}
            aria-label={t.remove}
            // Vòng 96px: tâm nút gỡ ở 2px trong góc hộp thì nằm đúng trên mép tròn.
            className="absolute top-0.5 right-0.5 z-10 size-6 rounded-full shadow-sm"
          >
            <XIcon className="size-3.5" />
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {children}

      {/* Gợi ý cỡ ảnh, hay tiến độ lúc đang tải — cùng một dòng như trước. */}
      <p className="mt-3 text-xs text-muted-foreground">
        {busy ? t.uploading(pct) : t.hint(formatBytes(MAX_AVATAR_BYTES))}
      </p>
      {errors.length > 0 ? (
        <Alert variant="destructive" className="mt-3 text-left">
          <CircleAlertIcon />
          <AlertTitle>{t.errorsTitle}</AlertTitle>
          <AlertDescription>
            {errors.map((error) => (
              <p key={error} className="last:mb-0">
                {error}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
```

Tạo `apps/web/src/components/account/identity-card.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import { Separator } from '@tourism/ui/components/separator';
import { cn } from '@tourism/ui/lib/utils';
import { MailIcon } from 'lucide-react';
import { AvatarUpload } from '@/components/account/avatar-upload';
import type { SessionUser } from '@/lib/api/session';

/**
 * Thẻ danh tính — cột trái của Settings (spec 09/10 §2, phương án C): ảnh đại diện 96px dùng lại
 * `AvatarUpload` (bấm hoặc kéo thả, tiến độ, lỗi, nút gỡ — hành vi không đổi), tên chữ serif,
 * email muted, dòng gợi ý cỡ ảnh; dưới vạch ngăn là Connected accounts (mục riêng cũ gộp vào
 * đây): nhãn nhỏ và dòng "Email & password" có icon thư.
 *
 * Dính khi cuộn chỉ từ `lg` — trang truyền `className` (`lg:sticky lg:top-28`), thẻ không tự quyết
 * vị trí của mình.
 */
export function IdentityCard({ profile, className }: { profile: SessionUser; className?: string }) {
  const t = messages.accountProfile;
  return (
    <section
      data-slot="identity-card"
      className={cn('rounded-2xl border bg-card px-6 py-6.5 text-center', className)}
    >
      <AvatarUpload initial={(profile.name || profile.email).charAt(0)} image={profile.image}>
        <h2 className="mt-3 font-heading text-xl leading-tight font-semibold text-foreground">
          {profile.name}
        </h2>
        <p className="mt-0.5 text-sm break-words text-muted-foreground">{profile.email}</p>
      </AvatarUpload>
      <Separator className="my-4.5" />
      <div className="text-left">
        <h3 className="text-[0.625rem] font-bold tracking-[0.15em] text-muted-foreground uppercase">
          {t.connected.heading}
        </h3>
        <div className="mt-2.5 flex items-center gap-2.5">
          <span className="grid size-9.5 shrink-0 place-items-center rounded-full bg-muted text-ink">
            <MailIcon aria-hidden="true" className="size-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">{t.connected.emailPassword}</span>
        </div>
      </div>
    </section>
  );
}
```

Trong `libs/shared/i18n/src/lib/messages.ts`, khối `accountProfile.avatar`, xoá dòng
`      selected: 'Avatar selected',` (nằm giữa `upload: 'Upload avatar',` và `hint: …`).

- [ ] **Step 4: Chạy thấy xanh**

Run:

```bash
pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only
pnpm --filter @tourism/web exec vitest run src/components/account/avatar-upload.spec.tsx src/components/account/identity-card.spec.tsx --maxWorkers=2
pnpm --filter @tourism/web typecheck
grep -rn "selected: 'Avatar selected'\|t\.selected" apps/web/src/components/account libs/shared/i18n/src
```

Expected: PASS (avatar 6 ca: 4 cũ, 2 mới; thẻ danh tính 5 ca); typecheck xanh; `grep` rỗng.

Đột biến: dựng `{children}` TRƯỚC khối nút ảnh (ca thứ tự của cả hai spec đỏ); `size-24` →
`size-20` (hai ca đỏ); bỏ `<Separator>` (ca Connected accounts đỏ); bỏ `className` khỏi `cn(…)`
(ca className đỏ); `profile.name || profile.email` → `profile.name` (ca chữ cái đầu đỏ).

- [ ] **Step 5: Commit**

```bash
pnpm exec biome check --write apps/web/src/test/fixtures/account.ts apps/web/src/components/account/avatar-upload.tsx apps/web/src/components/account/avatar-upload.spec.tsx apps/web/src/components/account/identity-card.tsx apps/web/src/components/account/identity-card.spec.tsx libs/shared/i18n/src/lib/messages.ts
git add apps/web/src/test/fixtures/account.ts apps/web/src/components/account/avatar-upload.tsx apps/web/src/components/account/avatar-upload.spec.tsx apps/web/src/components/account/identity-card.tsx apps/web/src/components/account/identity-card.spec.tsx libs/shared/i18n/src/lib/messages.ts
git commit -m 'feat(web): thẻ danh tính cho Settings — ảnh 96px dựng dọc, tên, email và Connected accounts'
```

---

### Task 5: Tách `ProfileSummary` thành thẻ Personal information và thẻ Password (`SettingsCard`, `SettingsRow`)

**Files:**

- Create: `apps/web/src/components/account/settings-card.tsx`
- Create: `apps/web/src/components/account/settings-card.spec.tsx`
- Modify: `apps/web/src/components/account/profile-summary.tsx` (viết lại trọn file)
- Modify: `apps/web/src/components/account/profile-summary.spec.tsx` (viết lại trọn file)
- Create: `apps/web/src/components/account/password-card.tsx`
- Create: `apps/web/src/components/account/password-card.spec.tsx`
- Modify: `apps/web/src/app/(site)/account/settings/page.tsx` (import và `<PasswordCard />`)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (`details.blurb`; `password.heading` →
  `password.blurb`)

**Interfaces:**

- Consumes: `makeSessionUser` (Task 4); `ChangePasswordForm({ onDone })` có sẵn;
  `messages.accountProfile.details.{heading,blurb,nameLabel,phoneLabel,emailLabel}`,
  `.summary.{edit,editAria,cancelEdit,saveName,savePhone,passwordLabel,passwordMask,emailLocked,phoneHint,notSet}`.
- Produces: `SettingsCard(props: { title: string; description: string; children: ReactNode })`;
  `SettingsRow(props: { label: string; hint?: string; value?: ReactNode; action?: ReactNode; editing?: boolean; children?: ReactNode })`;
  `EditButton(props: { field: string; onClick: () => void })`;
  `ProfileSummary(props: { profile: SessionUser })` — nay là thẻ ba dòng Full name, Phone, Email;
  `PasswordCard()`; `messages.accountProfile.password.blurb: string`. Gỡ khoá:
  `accountProfile.password.heading` (mồ côi từ trước — grep ở Step 5).

- [ ] **Step 1: Viết test hỏng**

Tạo `apps/web/src/components/account/settings-card.spec.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditButton, SettingsCard, SettingsRow } from './settings-card';

/**
 * Khung thẻ và dòng của Settings (spec 09/10 §2). jsdom không có bố cục: ở đây canh thứ tự DOM và
 * class đặt chỗ; bố cục thật đo bằng CSS build ở bước soi bố cục sau thi công.
 */
describe('SettingsCard', () => {
  it('tiêu đề h2 chữ serif kèm một dòng mô tả; thân là danh sách dòng', () => {
    render(
      <SettingsCard title="Password" description="Change the password you sign in with.">
        <SettingsRow label="Password" value="••••••••••" />
      </SettingsCard>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Password' })).toHaveClass('font-heading');
    expect(screen.getByText('Change the password you sign in with.')).toBeInTheDocument();
    expect(screen.getByRole('list')).toContainElement(screen.getByRole('listitem'));
  });
});

describe('SettingsRow', () => {
  const row = (editing = false) =>
    render(
      <ul>
        <SettingsRow
          label="Phone"
          hint="So the guide can reach you on the day."
          value="0901234567"
          action={<button type="button">Edit</button>}
          editing={editing}
        >
          <form aria-label="Edit phone" />
        </SettingsRow>
      </ul>,
    );

  it('đang xem: DOM theo thứ tự nhãn → giá trị → hành động; gợi ý nằm trong ô nhãn', () => {
    row();
    const cells = [...screen.getByRole('listitem').children];
    expect(cells.map((cell) => cell.textContent)).toEqual([
      'PhoneSo the guide can reach you on the day.',
      '0901234567',
      'Edit',
    ]);
    expect(
      within(cells[0] as HTMLElement).getByText('So the guide can reach you on the day.'),
    ).toBeInTheDocument();
  });

  it('từ lg ba cột một hàng; dưới lg giá trị xuống hàng dưới, hành động lên cạnh nhãn', () => {
    row();
    const item = screen.getByRole('listitem');
    const [, value, action] = [...item.children];
    expect(item).toHaveClass(
      'grid-cols-[minmax(0,1fr)_auto]',
      'lg:grid-cols-[10rem_minmax(0,1fr)_auto]',
      'items-center',
    );
    expect(value).toHaveClass('col-span-full', 'row-2', 'lg:col-2', 'lg:row-1');
    expect(action).toHaveClass('col-2', 'row-1', 'lg:col-3');
    expect(item).not.toHaveClass('bg-primary/5');
  });

  it('đang sửa: nền nhạt, form THAY giá trị và hành động, nhãn chỉ hiện một lần', () => {
    row(true);
    const item = screen.getByRole('listitem');
    expect(item).toHaveClass('bg-primary/5', 'items-start');
    expect(screen.queryByText('0901234567')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Phone')).toHaveLength(1);
    expect(screen.getByRole('form', { name: 'Edit phone' }).parentElement).toHaveClass(
      'col-span-full',
      'lg:col-[2/-1]',
    );
  });
});

describe('EditButton', () => {
  it('chữ "Edit", tên đọc mang tên trường; bấm thì gọi onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EditButton field="Full name" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Edit Full name' });
    expect(button).toHaveTextContent('Edit');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

Thay TRỌN `apps/web/src/components/account/profile-summary.spec.tsx` bằng (ba ca mật khẩu chuyển
sang `password-card.spec.tsx`):

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSessionUser } from '@/test/fixtures/account';
import { ProfileSummary } from './profile-summary';

const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({ authClient: { updateUser } }));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

const PROFILE = makeSessionUser();

beforeEach(() => {
  vi.clearAllMocks();
  updateUser.mockResolvedValue({ error: null });
});

describe('ProfileSummary — thẻ Personal information (spec 09/10 §2)', () => {
  it('tiêu đề h2, mô tả, đúng ba dòng Full name · Phone · Email — mật khẩu đã sang thẻ riêng', () => {
    render(<ProfileSummary profile={PROFILE} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Personal information' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Your name and contact details.')).toBeInTheDocument();
    expect(
      screen.getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent),
    ).toEqual(['Full name', 'Phone', 'Email']);
    expect(screen.queryByText('••••••••••')).not.toBeInTheDocument();
  });

  it('mặc định KHÔNG có ô nhập nào — trang này để XEM là chính', () => {
    render(<ProfileSummary profile={PROFILE} />);
    expect(screen.getByText('Minh Anh')).toBeInTheDocument();
    expect(screen.getByText('0901234567')).toBeInTheDocument();
    expect(screen.getByText('minh.anh@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('gợi ý của Phone hiện ngay cả khi chưa sửa', () => {
    render(<ProfileSummary profile={PROFILE} />);
    expect(screen.getByText('So the guide can reach you on the day.')).toBeInTheDocument();
  });

  it('email KHÔNG có nút sửa — nói thẳng "chưa đổi được"', () => {
    render(<ProfileSummary profile={PROFILE} />);
    expect(screen.getByText('Can’t be changed yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Email' })).not.toBeInTheDocument();
  });

  it('phone rỗng → "Not set", không phải ô trống trơn', () => {
    render(<ProfileSummary profile={{ ...PROFILE, phone: null }} />);
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });
});

describe('ProfileSummary — sửa từng dòng', () => {
  // Sweep 19/08: tên trống / phone ngắn bắt ở client, không gọi updateUser.
  it('xoá trắng tên rồi Save → required inline, KHÔNG gọi updateUser', async () => {
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    await user.clear(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText(messages.formErrors.name.required)).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('phone 3 ký tự → phone.invalid inline, KHÔNG gọi updateUser', async () => {
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Phone' }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '123');
    await user.click(screen.getByRole('button', { name: 'Save phone' }));

    expect(await screen.findByText(messages.formErrors.phone.invalid)).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('bấm Edit ở dòng tên → mở ĐÚNG một ô nhập', async () => {
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('dòng đang sửa tô nền nhạt; ô nhập và Save/Cancel nằm TRONG dòng đó', async () => {
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Phone' }));
    const item = screen.getByRole('textbox', { name: 'Phone' }).closest('li');
    expect(item).toHaveClass('bg-primary/5');
    expect(item).toContainElement(screen.getByRole('button', { name: 'Save phone' }));
    expect(item).toContainElement(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('mở dòng khác thì dòng đang mở ĐÓNG lại — trong thẻ mỗi lúc chỉ một', async () => {
    // Mở nhiều dòng cùng lúc thì không rõ nút Save nào thuộc về đâu.
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    await user.click(screen.getByRole('button', { name: 'Edit Phone' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Save phone' })).toBeInTheDocument();
  });

  it('lưu tên gửi CHỈ field đó, không gửi kèm phone', async () => {
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Minh Anh Nguyễn');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ name: 'Minh Anh Nguyễn' }));
    expect(toastSuccess).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('Cancel TRẢ LẠI giá trị đã lưu — chữ gõ dở không được giữ lại', async () => {
    // Mở lại mà vẫn thấy chữ vừa gõ thì người dùng tưởng nó đã được lưu.
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    await user.type(screen.getByRole('textbox'), ' TẠM');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    expect(screen.getByRole('textbox')).toHaveValue('Minh Anh');
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('401 giữa chừng → message riêng + link đăng nhập lại, KHÔNG auto-signout', async () => {
    updateUser.mockResolvedValueOnce({ error: { status: 401 } });
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Phone' }));
    await user.click(screen.getByRole('button', { name: 'Save phone' }));

    expect(await screen.findByText('Your session has expired.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in again' })).toHaveAttribute(
      'href',
      '/login?redirect=/account/profile',
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
```

Tạo `apps/web/src/components/account/password-card.spec.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSessionUser } from '@/test/fixtures/account';
import { PasswordCard } from './password-card';
import { ProfileSummary } from './profile-summary';

const { updateUser, changePassword } = vi.hoisted(() => ({
  updateUser: vi.fn(),
  changePassword: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { updateUser, changePassword } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

beforeEach(() => {
  vi.clearAllMocks();
  updateUser.mockResolvedValue({ error: null });
  changePassword.mockResolvedValue({ error: null });
});

/** Thẻ Password tách khỏi Personal information (spec 09/10 §2). */
describe('PasswordCard', () => {
  it('tiêu đề "Password", mô tả, MỘT dòng mật khẩu che chấm tròn CỐ ĐỊNH và nút Edit', () => {
    render(<PasswordCard />);
    expect(screen.getByRole('heading', { level: 2, name: 'Password' })).toBeInTheDocument();
    expect(screen.getByText('Change the password you sign in with.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    // Hiện đúng số ký tự là rò rỉ một mẩu thông tin về mật khẩu.
    expect(screen.getByText('••••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Password' })).toBeInTheDocument();
  });

  it('bấm Edit → form ba ô nằm TRONG dòng của thẻ; GIỮ ô "Current password" (Better Auth bắt buộc)', async () => {
    const user = userEvent.setup();
    render(<PasswordCard />);
    await user.click(screen.getByRole('button', { name: 'Edit Password' }));
    const item = screen.getByLabelText('Current password').closest('li');
    expect(item).toHaveClass('bg-primary/5');
    expect(item).toContainElement(screen.getByLabelText('New password'));
    expect(item).toContainElement(screen.getByLabelText('Confirm new password'));
    expect(screen.queryByText('••••••••••')).not.toBeInTheDocument();
  });

  it('đổi mật khẩu xong thì ĐÓNG dòng lại — để mở với ba ô rỗng trông như chưa lưu', async () => {
    const user = userEvent.setup();
    render(<PasswordCard />);
    await user.click(screen.getByRole('button', { name: 'Edit Password' }));
    await user.type(screen.getByLabelText('Current password'), 'OldPass!2026');
    await user.type(screen.getByLabelText('New password'), 'NewPass!2026');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPass!2026');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => expect(changePassword).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Edit Password' })).toBeInTheDocument();
  });

  it('Cancel → về tĩnh, KHÔNG gọi changePassword', async () => {
    const user = userEvent.setup();
    render(<PasswordCard />);
    await user.click(screen.getByRole('button', { name: 'Edit Password' }));
    await user.type(screen.getByLabelText('Current password'), 'OldPass!2026');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Password' })).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('mở cùng lúc với dòng tên của Personal information — mỗi thẻ giữ trạng thái mở riêng', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ProfileSummary profile={makeSessionUser()} />
        <PasswordCard />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    await user.click(screen.getByRole('button', { name: 'Edit Password' }));
    expect(screen.getByRole('textbox', { name: 'Full name' })).toHaveValue('Minh Anh');
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy thấy đỏ**

Run:
`pnpm --filter @tourism/web exec vitest run src/components/account/settings-card.spec.tsx src/components/account/profile-summary.spec.tsx src/components/account/password-card.spec.tsx --maxWorkers=2`

Expected: `settings-card.spec.tsx` và `password-card.spec.tsx` FAIL cả file (Failed to resolve
import `./settings-card` / `./password-card`); `profile-summary.spec.tsx` FAIL ba ca — "tiêu đề
h2…" (chưa có tiêu đề, còn bốn dòng gồm Password), "gợi ý của Phone hiện ngay…" (gợi ý chỉ nằm
trong form), "dòng đang sửa tô nền nhạt…" (chưa có `bg-primary/5`). Các ca còn lại xanh.

- [ ] **Step 3: Code tối thiểu**

Tạo `apps/web/src/components/account/settings-card.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import type { ReactNode } from 'react';

/**
 * Khung thẻ của trang Settings (spec 09/10 §2, phương án C): tiêu đề serif kèm một dòng mô tả
 * muted, thân là danh sách dòng ngăn bằng vạch mảnh. Dùng cho Personal information và Password;
 * Danger zone tự mang khung viền đỏ riêng (`DeleteAccount`).
 */
export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b px-4 pt-4 pb-3 sm:px-6 sm:pt-4.5 sm:pb-3.5">
        <h2 className="font-heading text-lg leading-tight font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <ul className="divide-y">{children}</ul>
    </section>
  );
}

/**
 * Một dòng "nhãn trái — giá trị — hành động phải" (spec 09/10 §2).
 *
 * - Từ `lg`: ba cột `10rem | giá trị | hành động` trên MỘT hàng.
 * - Dưới `lg`: hai hàng — nhãn và hành động ở hàng trên, giá trị ở hàng dưới chiếm trọn bề ngang.
 * - Đang sửa: nền primary nhạt; `children` (form) THAY giá trị và hành động, không xếp chồng dưới
 *   giá trị — bản 10/08 xếp chồng thì nhãn hiện hai lần và có hai nút Cancel cạnh nhau.
 *
 * Mọi ô đặt chỗ TƯỜNG MINH (`col-*`, `row-*`): DOM giữ thứ tự nhãn → giá trị → hành động cho trình
 * đọc màn hình, còn mắt thấy hành động lên cạnh nhãn ở khổ hẹp.
 */
export function SettingsRow({
  label,
  hint,
  value,
  action,
  editing = false,
  children,
}: {
  label: string;
  /** Dòng gợi ý dưới nhãn (vd Phone) — hiện ở cả lúc xem lẫn lúc sửa. */
  hint?: string;
  value?: ReactNode;
  action?: ReactNode;
  editing?: boolean;
  /** Form THAY giá trị và hành động khi đang sửa dòng này. */
  children?: ReactNode;
}) {
  return (
    <li
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3.5 sm:px-6 lg:grid-cols-[10rem_minmax(0,1fr)_auto] lg:gap-x-4.5',
        editing ? 'items-start bg-primary/5' : 'items-center',
      )}
    >
      <div className="col-1 row-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {editing ? (
        <div className="col-span-full row-2 min-w-0 lg:col-[2/-1] lg:row-1">{children}</div>
      ) : (
        <>
          <div className="col-span-full row-2 min-w-0 text-sm break-words text-foreground lg:col-2 lg:row-1">
            {value}
          </div>
          <div className="col-2 row-1 justify-self-end lg:col-3">{action}</div>
        </>
      )}
    </li>
  );
}

/**
 * Nút "Edit" của một dòng. Tên đọc mang tên trường ("Edit Full name"): ba chữ "Edit" trần nghe y
 * hệt nhau với trình đọc màn hình. `px-0`: variant link vẫn mang padding ngang của size, 10px đó
 * đẩy chữ lệch khỏi mép phải thẻ. Nút chỉ hiện khi dòng đang ĐÓNG — lúc mở, form thay chỗ nó.
 */
export function EditButton({ field, onClick }: { field: string; onClick: () => void }) {
  const s = messages.accountProfile.summary;
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto px-0"
      aria-expanded={false}
      aria-label={s.editAria(field)}
      onClick={onClick}
    >
      {s.edit}
    </Button>
  );
}
```

Thay TRỌN `apps/web/src/components/account/profile-summary.tsx` bằng:

```tsx
'use client';

import {
  type AuthErrorKey,
  mapAuthError,
  validateProfileName,
  validateProfilePhone,
} from '@tourism/core';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { LockIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { EditButton, SettingsCard, SettingsRow } from '@/components/account/settings-card';
import { FieldError, invalidProps } from '@/components/auth/field-error';
import type { SessionUser } from '@/lib/api/session';
import { authClient } from '@/lib/auth-client';

type EditableField = 'name' | 'phone';
type ProfileErrorKind = 'sessionExpired' | AuthErrorKey;

/**
 * Thẻ Personal information của Settings (spec 09/10 §2, phương án C): Full name, Phone, Email
 * dạng đọc-trước (kiểu GOV.UK, redesign 10/08) — đa số lần vào trang này người ta chỉ muốn XEM
 * lại thông tin; mở sẵn ô nhập là bắt họ đọc form thay vì đọc dữ liệu.
 *
 * Mật khẩu đã tách sang thẻ riêng (`PasswordCard`): mỗi thẻ giữ trạng thái mở của riêng nó, nên
 * một dòng ở đây và dòng mật khẩu mở cùng lúc được. TRONG thẻ này mỗi lần chỉ MỘT dòng mở — mở
 * nhiều dòng thì không rõ nút "Save" nào thuộc về đâu, và người dùng dễ tưởng một nút lưu tất cả.
 *
 * Email không có nút sửa — đó là email đăng nhập, tính năng đổi chưa làm (PARK). Nói thẳng "chưa
 * đổi được" kèm icon khoá tử tế hơn là dựng một nút rồi báo lỗi khi bấm.
 */
export function ProfileSummary({ profile }: { profile: SessionUser }) {
  const t = messages.accountProfile;
  const s = t.summary;
  const router = useRouter();

  const [open, setOpen] = useState<EditableField | null>(null);
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [pending, setPending] = useState(false);
  const [errorKind, setErrorKind] = useState<ProfileErrorKind | null>(null);
  // Sweep 19/08: lỗi của ô đang mở (tên trống/quá dài, phone 6–30) — kiểm ở
  // client trước khi gọi `updateUser`; mỗi lần chỉ MỘT dòng mở nên một slot đủ.
  const [fieldError, setFieldError] = useState<string | undefined>();

  function startEdit(field: EditableField) {
    setFieldError(undefined);
    setOpen(field);
  }

  function close() {
    setOpen(null);
    setErrorKind(null);
    setFieldError(undefined);
    // Trả ô nhập về giá trị đã lưu — bấm Cancel rồi mở lại mà vẫn thấy chữ
    // vừa gõ dở thì người dùng tưởng nó đã được lưu.
    setName(profile.name);
    setPhone(profile.phone ?? '');
  }

  async function save(event: FormEvent<HTMLFormElement>, patch: { name?: string; phone?: string }) {
    event.preventDefault();
    setErrorKind(null);
    const found =
      patch.name !== undefined
        ? validateProfileName(patch.name)
        : patch.phone !== undefined
          ? validateProfilePhone(patch.phone)
          : undefined;
    setFieldError(found);
    if (found) return;
    setPending(true);
    // @better-fetch reject promise khi fetch throw thật (API sập/offline) —
    // KHÁC error envelope ({error}) ở nhánh dưới.
    try {
      const { error } = await authClient.updateUser(patch);
      if (error) {
        setErrorKind(error.status === 401 ? 'sessionExpired' : mapAuthError(error));
        return;
      }
      toast.success(t.toast.profileSavedTitle);
      setOpen(null);
      router.refresh();
    } catch {
      setErrorKind('generic');
    } finally {
      setPending(false);
    }
  }

  const errorNode = errorKind ? (
    <AccountActionError
      expired={errorKind === 'sessionExpired'}
      redirectTo="/account/profile"
      className="mt-2"
      // Nhánh null không bao giờ chạy (component đã hiện UI riêng khi
      // `expired`) nhưng cần để TypeScript thu hẹp `errorKind`.
      fallback={errorKind === 'sessionExpired' ? null : messages.authForms.errors[errorKind]}
    />
  ) : null;

  return (
    <SettingsCard title={t.details.heading} description={t.details.blurb}>
      <SettingsRow
        label={t.details.nameLabel}
        value={profile.name}
        editing={open === 'name'}
        action={<EditButton field={t.details.nameLabel} onClick={() => startEdit('name')} />}
      >
        {open === 'name' ? (
          /* `noValidate`: nếu sau này thêm `required`/`type=email` mà quên cái
             này thì validate GỐC của trình duyệt chặn submit trước khi
             `onSubmit` kịp chạy — đúng bug đã dính ở form đặt chỗ (4959455). */
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => save(e, { name: name.trim() })}
          >
            <div className="flex flex-col gap-1.5">
              {/* Nhãn nhìn thấy đã nằm ở cột trái của dòng; giữ <Label> cho
                  trình đọc màn hình nhưng ẩn khỏi thị giác để khỏi lặp. */}
              <Label htmlFor="profile-name" className="sr-only">
                {t.details.nameLabel}
              </Label>
              <Input
                id="profile-name"
                value={name}
                autoComplete="name"
                className="max-w-80"
                onChange={(event) => {
                  setName(event.target.value);
                  setFieldError(undefined);
                }}
                {...invalidProps('profile-name-error', fieldError)}
              />
              <FieldError id="profile-name-error">{fieldError}</FieldError>
            </div>
            {errorNode}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {s.saveName}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={close}>
                {s.cancelEdit}
              </Button>
            </div>
          </form>
        ) : null}
      </SettingsRow>

      <SettingsRow
        label={t.details.phoneLabel}
        hint={s.phoneHint}
        value={
          profile.phone ? (
            <span className="tabular-nums">{profile.phone}</span>
          ) : (
            <span className="text-muted-foreground">{s.notSet}</span>
          )
        }
        editing={open === 'phone'}
        action={<EditButton field={t.details.phoneLabel} onClick={() => startEdit('phone')} />}
      >
        {open === 'phone' ? (
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => save(e, { phone: phone.trim() })}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-phone" className="sr-only">
                {t.details.phoneLabel}
              </Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                autoComplete="tel"
                className="max-w-80"
                onChange={(event) => {
                  setPhone(event.target.value);
                  setFieldError(undefined);
                }}
                {...invalidProps('profile-phone-error', fieldError)}
              />
              <FieldError id="profile-phone-error">{fieldError}</FieldError>
            </div>
            {errorNode}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {s.savePhone}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={close}>
                {s.cancelEdit}
              </Button>
            </div>
          </form>
        ) : null}
      </SettingsRow>

      <SettingsRow
        label={t.details.emailLabel}
        value={profile.email}
        action={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <LockIcon aria-hidden="true" className="size-3.5" />
            {s.emailLocked}
          </span>
        }
      />
    </SettingsCard>
  );
}
```

Tạo `apps/web/src/components/account/password-card.tsx`:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import { EditButton, SettingsCard, SettingsRow } from '@/components/account/settings-card';

/**
 * Thẻ Password của Settings (spec 09/10 §2): tách khỏi Personal information thành thẻ riêng.
 * Một dòng mật khẩu che bằng chấm tròn CỐ ĐỊNH (hiện đúng số ký tự là rò rỉ một mẩu thông tin về
 * mật khẩu) và nút Edit; mở thì `ChangePasswordForm` (ba ô; đổi xong hay Cancel thì đóng) nằm
 * ngay trong dòng. Trạng thái mở là của riêng thẻ này — mở cùng lúc với một dòng của Personal
 * information được.
 */
export function PasswordCard() {
  const t = messages.accountProfile;
  const s = t.summary;
  const [open, setOpen] = useState(false);

  return (
    <SettingsCard title={s.passwordLabel} description={t.password.blurb}>
      <SettingsRow
        label={s.passwordLabel}
        value={<span className="font-mono text-muted-foreground">{s.passwordMask}</span>}
        editing={open}
        action={<EditButton field={s.passwordLabel} onClick={() => setOpen(true)} />}
      >
        {open ? (
          // Ba ô xếp dọc rộng tối đa 360px như bản vẽ C — trải hết cột giá trị thì ô dài lê thê.
          <div className="max-w-90">
            <ChangePasswordForm onDone={() => setOpen(false)} />
          </div>
        ) : null}
      </SettingsRow>
    </SettingsCard>
  );
}
```

Trong `apps/web/src/app/(site)/account/settings/page.tsx`: thêm
`import { PasswordCard } from '@/components/account/password-card';` ngay TRÊN dòng import
`ProfileSummary`; thay dòng `            <ProfileSummary profile={profile} />` bằng:

```tsx
            <ProfileSummary profile={profile} />
            {/* Mật khẩu là thẻ riêng (`PasswordCard`), không còn là một dòng của `ProfileSummary`. */}
            <PasswordCard />
```

Trong `libs/shared/i18n/src/lib/messages.ts`, khối `accountProfile`:

1. Thay:

```ts
      /** Mô tả cột trái (redesign 11/08). Mọi mục trong khu account đều có một
       *  dòng như thế này — mục im lặng cạnh mục đang nói đọc như lỗi tải. */
      blurb: 'Your name, contact details, and password.',
```

bằng:

```ts
      /** Dòng mô tả dưới tiêu đề thẻ Personal information (spec 09/10 §2) — mật khẩu đã sang
       *  thẻ riêng nên câu không nhắc nó nữa. Mọi thẻ trong khu account đều có một dòng như
       *  thế này: thẻ im lặng cạnh thẻ đang nói đọc như lỗi tải. */
      blurb: 'Your name and contact details.',
```

2. Thay:

```ts
    password: {
      heading: 'Change password',
```

bằng:

```ts
    password: {
      /** Dòng mô tả dưới tiêu đề thẻ Password (spec 09/10 §2). */
      blurb: 'Change the password you sign in with.',
```

- [ ] **Step 4: Chạy thấy xanh**

Run:

```bash
pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only
pnpm --filter @tourism/web exec vitest run src/components/account/settings-card.spec.tsx src/components/account/profile-summary.spec.tsx src/components/account/password-card.spec.tsx src/components/account/change-password-form.spec.tsx --maxWorkers=2
pnpm --filter @tourism/web typecheck
```

Expected: PASS (khung 5 ca, Personal information 13 ca, Password 5 ca, `change-password-form` 8
ca không đổi); typecheck xanh (nó bắt mọi chỗ còn đọc `password.heading`).

Đột biến: bỏ `'items-start bg-primary/5'` (ca đang sửa của khung và ca nền nhạt của hai thẻ đỏ);
xếp `{children}` CHỒNG dưới giá trị thay vì thay nó (ca "đang sửa" đỏ); `lg:col-2` → `col-2` ở ô
giá trị (ca bố cục đỏ); bỏ prop `hint` của dòng Phone (ca gợi ý đỏ); gom `open` của PasswordCard
vào `ProfileSummary` bằng một state chung truyền xuống (ca "mở cùng lúc" đỏ).

- [ ] **Step 5: Commit**

```bash
pnpm exec biome check --write apps/web/src/components/account/settings-card.tsx apps/web/src/components/account/settings-card.spec.tsx apps/web/src/components/account/profile-summary.tsx apps/web/src/components/account/profile-summary.spec.tsx apps/web/src/components/account/password-card.tsx apps/web/src/components/account/password-card.spec.tsx "apps/web/src/app/(site)/account/settings/page.tsx" libs/shared/i18n/src/lib/messages.ts
git add apps/web/src/components/account/settings-card.tsx apps/web/src/components/account/settings-card.spec.tsx apps/web/src/components/account/profile-summary.tsx apps/web/src/components/account/profile-summary.spec.tsx apps/web/src/components/account/password-card.tsx apps/web/src/components/account/password-card.spec.tsx "apps/web/src/app/(site)/account/settings/page.tsx" libs/shared/i18n/src/lib/messages.ts
git commit -m 'feat(web): tách Personal information và Password thành hai thẻ, dòng nhãn trái giá trị phải sửa ngay tại dòng'
```

---

### Task 6: Khối Danger zone kiểu mới (`DeleteAccount` giữ logic)

**Files:**

- Modify: `apps/web/src/components/account/delete-account.tsx` (hai đoạn đầu JSDoc dòng 63–74;
  khối `return` dòng 115–194)
- Modify: `apps/web/src/components/account/delete-account.spec.tsx` (thêm describe cuối file)

**Interfaces:**

- Consumes: `Button` variant `destructive` (`bg-destructive/10 text-destructive-emphasis …`) của
  `@tourism/ui`; `messages.accountProfile.danger.{heading,subtitle,deleteCta,dialogBody}`.
- Produces: `DeleteAccount()` — chữ ký và toàn bộ logic dialog không đổi; khung `section` viền
  `border-destructive/30`, tiêu đề `h2`, dòng tô `bg-destructive/5`.

- [ ] **Step 1: Viết test hỏng**

Thêm vào CUỐI `apps/web/src/components/account/delete-account.spec.tsx`:

```tsx
describe('DeleteAccount — khối Danger zone kiểu mới (spec 09/10 §2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('khung viền đỏ nhạt; tiêu đề h2 serif màu đỏ kèm dòng mô tả', () => {
    render(<DeleteAccount />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Danger zone' });
    expect(heading).toHaveClass('font-heading', 'text-destructive-emphasis');
    expect(heading.closest('section')).toHaveClass('rounded-2xl', 'border-destructive/30');
    expect(screen.getByText('Irreversible account actions.')).toBeInTheDocument();
  });

  it('CHỈ dòng Delete account tô nền đỏ rất nhạt: câu giải thích và nút mở hộp nằm trong dòng ấy', () => {
    render(<DeleteAccount />);
    const row = screen.getByRole('button', { name: 'Delete account' }).parentElement;
    expect(row).toHaveClass('bg-destructive/5');
    expect(row).toHaveTextContent(messages.accountProfile.danger.dialogBody);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Danger zone' }).parentElement,
    ).not.toHaveClass('bg-destructive/5');
  });

  it('nút mở hộp là nút đỏ nhỏ (variant destructive), không còn kiểu chữ link', () => {
    render(<DeleteAccount />);
    const trigger = screen.getByRole('button', { name: 'Delete account' });
    expect(trigger).toHaveClass('bg-destructive/10', 'text-destructive-emphasis');
    expect(trigger).not.toHaveClass('underline-offset-4');
  });
});
```

- [ ] **Step 2: Chạy thấy đỏ**

Run:
`pnpm --filter @tourism/web exec vitest run src/components/account/delete-account.spec.tsx --maxWorkers=2`

Expected: FAIL đúng ba ca mới — tiêu đề còn `text-sm font-medium` và không có `section` cha; dòng
chưa có `bg-destructive/5` và chưa có câu giải thích; nút còn `variant="link"`
(`underline-offset-4`). Mười một ca cũ xanh.

- [ ] **Step 3: Code tối thiểu**

Trong `apps/web/src/components/account/delete-account.tsx`:

1. Trong JSDoc của `DeleteAccount`, thay hai đoạn đầu:

```tsx
 * Xoá tài khoản — Task 8: không còn là một MỤC riêng (`AccountSection`
 * "Danger zone" với title/description do page.tsx cấp), mà là khối CUỐI
 * TRANG, đứng NGOÀI mọi section, ngăn với nội dung phía trên bằng một
 * `border-t`. Component nay TỰ mang heading nhỏ + một câu mô tả (trước đây
 * page.tsx truyền vào qua `AccountSection`) vì không còn khung section nào
 * cấp hộ nữa.
 *
 * Nút mở dialog hạ cấp từ `Button variant="destructive" size="lg"` xuống
 * text-link (`variant="link"` + `text-destructive-emphasis`, cùng khuôn
 * `booking-actions.tsx` dùng cho "Cancel booking") — sức nặng cảnh báo do
 * CHỮ mang (dialog xác nhận gõ-để-chắc), không do một nút to màu đỏ nằm lẻ
 * cuối trang.
```

   bằng:

```tsx
 * Xoá tài khoản — khối Danger zone cuối cột phải của Settings (spec 09/10 §2,
 * phương án C): viền đỏ nhạt, tiêu đề serif màu đỏ kèm một dòng mô tả, chỉ
 * dòng "Delete account" tô nền đỏ rất nhạt. Component TỰ mang khung và tiêu đề
 * — trang chỉ xếp nó vào cột.
 *
 * Nút mở dialog là nút đỏ NHỎ (`variant="destructive" size="sm"`) nằm trong
 * dòng ấy, thay text-link của bản 11/08: dòng đã có khung đỏ riêng nên nút
 * không còn "nằm lẻ cuối trang" như lý do hạ cấp hồi đó. Sức nặng cảnh báo vẫn
 * do dialog gõ-để-chắc mang.
```

   Các đoạn sau (dialog gõ `CONFIRM_WORD`, Task 7/A2) giữ nguyên.

2. Thay TRỌN khối `return ( … );` của `DeleteAccount` bằng:

```tsx
  return (
    <section className="overflow-hidden rounded-2xl border border-destructive/30 bg-card">
      <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-4.5 sm:pb-3.5">
        <h2 className="font-heading text-lg leading-tight font-semibold text-destructive-emphasis">
          {t.heading}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{t.subtitle}</p>
      </div>

      {/* Dòng DUY NHẤT tô nền đỏ: nhãn và câu giải thích trái, nút mở hộp phải; dưới `sm` nút
          xuống hàng dưới. */}
      <div className="flex flex-col items-start gap-3 border-t border-destructive/20 bg-destructive/5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4.5 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-destructive-emphasis">{t.deleteCta}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.dialogBody}</p>
        </div>
        <AlertDialog
          onOpenChange={(open) => {
            if (!open) {
              setConfirmText('');
              setPassword('');
              setErrorKind(null);
            }
          }}
        >
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="shrink-0 border-destructive/30"
              >
                {t.deleteCta}
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.dialogTitle}</AlertDialogTitle>
              <AlertDialogDescription>{t.dialogBody}</AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-account-confirm">{t.typeToConfirm(CONFIRM_WORD)}</Label>
              <Input
                id="delete-account-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-account-password">{t.passwordLabel}</Label>
              <Input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {errorKind ? (
              <AccountActionError
                expired={errorKind === 'sessionExpired'}
                redirectTo="/account/profile"
                fallback={
                  errorKind === 'sessionExpired' || errorKind === 'generic'
                    ? messages.accountActionErrors.generic
                    : t.errors[errorKind]
                }
              />
            ) : null}

            <AlertDialogFooter>
              <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={!isUnlocked || pending}
                onClick={handleConfirm}
              >
                {t.confirmCta}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
```

- [ ] **Step 4: Chạy thấy xanh**

Run:

```bash
pnpm --filter @tourism/web exec vitest run src/components/account/delete-account.spec.tsx --maxWorkers=2
pnpm --filter @tourism/web typecheck
```

Expected: PASS 14 ca (11 cũ, 3 mới — mọi ca dialog, mã lỗi, 401, signOut giữ nguyên xanh);
typecheck xanh.

Đột biến: `variant="destructive"` → `variant="link"` (ca nút đỏ); bỏ `bg-destructive/5` khỏi
dòng (ca dòng đỏ); thêm `bg-destructive/5` vào khối tiêu đề (ca "CHỈ dòng" đỏ); bỏ câu
`t.dialogBody` khỏi dòng (ca dòng đỏ).

- [ ] **Step 5: Commit**

```bash
pnpm exec biome check --write apps/web/src/components/account/delete-account.tsx apps/web/src/components/account/delete-account.spec.tsx
git add apps/web/src/components/account/delete-account.tsx apps/web/src/components/account/delete-account.spec.tsx
git commit -m 'feat(web): khối Danger zone viền đỏ nhạt, chỉ dòng Delete account tô nền đỏ nhạt, nút mở hộp màu đỏ'
```

---

### Task 7: Ráp trang Settings (`SettingsView`): hero có nút quay lại, hai cột từ `lg`, dọn khoá mồ côi

**Files:**

- Create: `apps/web/src/components/account/settings-view.tsx`
- Create: `apps/web/src/components/account/settings-view.spec.tsx`
- Modify: `apps/web/src/app/(site)/account/settings/page.tsx` (viết lại trọn file)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (comment trên `passportSettings`; gỡ
  `passportSettings.back`, `accountProfile.details.emailHint`, `accountProfile.details.save`,
  `accountProfile.connected.subtitle`; JSDoc `accountBookings.backToPassport`)

**Interfaces:**

- Consumes: `IdentityCard({ profile, className })`, `makeSessionUser` (Task 4);
  `ProfileSummary({ profile })`, `PasswordCard()` (Task 5); `DeleteAccount()` (Task 6);
  `ContentHero` prop `back`; `messages.passportSettings.{heroBreadcrumb,title,subtitle}`,
  `messages.accountBookings.backToPassport`.
- Produces: `SettingsView(props: { profile: SessionUser })`, khung hai cột mang
  `data-slot="settings-layout"`. Gỡ khoá: `passportSettings.back`, `details.emailHint`,
  `details.save`, `connected.subtitle`.

- [ ] **Step 1: Đọc doc của Next 16**

Đọc `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
(Server Component mặc định, `async` được) — trang mới chỉ `await` phiên, cookie, hồ sơ rồi trả
`SettingsView`.

- [ ] **Step 2: Viết test hỏng**

Tạo `apps/web/src/components/account/settings-view.spec.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeSessionUser } from '@/test/fixtures/account';
import { SettingsView } from './settings-view';

// Các thẻ bên trong gọi `useRouter`, Better Auth và client oRPC — ở đây chỉ dựng, không lưu gì.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/lib/auth-client', () => ({
  authClient: { updateUser: vi.fn(), changePassword: vi.fn(), signOut: vi.fn() },
}));
vi.mock('@/lib/api/client', () => ({
  api: { media: { signUpload: vi.fn() }, account: { setAvatar: vi.fn() } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

/** Trang `/account/settings` (spec 09/10 §1, §2 — phương án C). */
const cardOf = (title: string) =>
  screen.getByRole('heading', { level: 2, name: title }).closest('section') as HTMLElement;

describe('SettingsView', () => {
  it('hero giữ chữ cũ, có nút tròn "Back to Passport" về /account; không còn link chữ "← Passport"', () => {
    render(<SettingsView profile={makeSessionUser()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Traveler details' })).toBeInTheDocument();
    expect(screen.getByText('The information printed in your passport.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Passport' })).toHaveAttribute(
      'href',
      '/account',
    );
    expect(screen.queryByText('← Passport')).not.toBeInTheDocument();
  });

  it('xếp đúng thẻ: thẻ danh tính trước, rồi Personal information, Password, Danger zone', () => {
    render(<SettingsView profile={makeSessionUser()} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Minh Anh',
      'Personal information',
      'Password',
      'Danger zone',
    ]);
  });

  it('đủ dòng: Personal information có Full name, Phone, Email; Password một dòng che chấm tròn', () => {
    render(<SettingsView profile={makeSessionUser()} />);
    expect(
      within(cardOf('Personal information'))
        .getAllByRole('listitem')
        .map((item) => item.querySelector('p')?.textContent),
    ).toEqual(['Full name', 'Phone', 'Email']);
    const password = cardOf('Password');
    expect(within(password).getAllByRole('listitem')).toHaveLength(1);
    expect(within(password).getByText('••••••••••')).toBeInTheDocument();
  });

  it('Connected accounts nằm trong thẻ danh tính, không còn mục riêng', () => {
    const { container } = render(<SettingsView profile={makeSessionUser()} />);
    const identity = container.querySelector('[data-slot="identity-card"]') as HTMLElement;
    expect(
      within(identity).getByRole('heading', { level: 3, name: 'Connected accounts' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Email & password')).toHaveLength(1);
    expect(screen.queryByText('Sign-in methods linked to your account.')).not.toBeInTheDocument();
  });

  it('bố cục: hai cột từ lg (trái 20rem, khe 24px, khung 1024px); thẻ danh tính đứng đầu, chỉ dính từ lg', () => {
    const { container } = render(<SettingsView profile={makeSessionUser()} />);
    const layout = container.querySelector('[data-slot="settings-layout"]');
    expect(layout).toHaveClass(
      'mx-auto',
      'max-w-5xl',
      'lg:grid-cols-[20rem_minmax(0,1fr)]',
      'lg:items-start',
      'lg:gap-6',
    );
    const identity = container.querySelector('[data-slot="identity-card"]');
    expect(layout?.firstElementChild).toBe(identity);
    expect(identity).toHaveClass('lg:sticky', 'lg:top-28');
    expect(identity).not.toHaveClass('sticky');
    expect(layout?.parentElement).toHaveClass('px-4', 'lg:px-8');
  });
});
```

- [ ] **Step 3: Chạy thấy đỏ**

Run:
`pnpm --filter @tourism/web exec vitest run src/components/account/settings-view.spec.tsx --maxWorkers=2`

Expected: FAIL cả file (Failed to resolve import `./settings-view`).

- [ ] **Step 4: Code tối thiểu**

Tạo `apps/web/src/components/account/settings-view.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import { DeleteAccount } from '@/components/account/delete-account';
import { IdentityCard } from '@/components/account/identity-card';
import { PasswordCard } from '@/components/account/password-card';
import { ProfileSummary } from '@/components/account/profile-summary';
import { ContentHero } from '@/components/content/content-hero';
import type { SessionUser } from '@/lib/api/session';

/**
 * Thân trang `/account/settings` (spec 09/10 §2, phương án C) — tách khỏi `page.tsx` để test
 * được: Vitest của web không quét `src/app/**` (nếp `BookingsListView`). Trang lo phiên và đọc
 * hồ sơ; component này lo mọi thứ khách thấy, kể cả hero.
 *
 * - Hero giữ chữ cũ, thêm nút tròn quay lại Passport (`ContentHero.back`) thay link chữ
 *   "← Passport" — cùng khoá nhãn với My bookings và Saved.
 * - Từ `lg`: hai cột, trái 20rem (320px) là thẻ danh tính DÍNH khi cuộn (`lg:top-28`, cùng mốc
 *   với rail đặt tour), phải là Personal information → Password → Danger zone; khung rộng tối đa
 *   1024px giữa trang. `lg:items-start` để ô lưới không giãn cao bằng cột phải — giãn thì
 *   `sticky` không còn chỗ trượt.
 * - Dưới `lg`: một cột, thẻ danh tính lên đầu và không dính; lề 16px.
 */
export function SettingsView({ profile }: { profile: SessionUser }) {
  const tp = messages.passportSettings;
  return (
    <div>
      <ContentHero
        breadcrumb={tp.heroBreadcrumb}
        title={tp.title}
        subtitle={tp.subtitle}
        back={{ href: '/account', label: messages.accountBookings.backToPassport }}
      />
      <div className="px-4 pt-10 pb-16 md:pb-20 lg:px-8">
        <div
          data-slot="settings-layout"
          className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-6"
        >
          <IdentityCard profile={profile} className="lg:sticky lg:top-28" />
          <div className="flex min-w-0 flex-col gap-5">
            <ProfileSummary profile={profile} />
            <PasswordCard />
            <DeleteAccount />
          </div>
        </div>
      </div>
    </div>
  );
}
```

Thay TRỌN `apps/web/src/app/(site)/account/settings/page.tsx` bằng:

```tsx
import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SettingsView } from '@/components/account/settings-view';
import { fetchAccountMe } from '@/lib/api/account';
import { requireSession } from '@/lib/api/session';

/**
 * `/account/settings` — tầng sau của hộ chiếu (spec 2026-08-11 M3; bố cục phương án C của spec
 * 09/10). Trang chỉ gác phiên và đọc hồ sơ (`fetchAccountMe`); hero, hai cột và các thẻ nằm ở
 * `SettingsView`. Logic sửa tại dòng, đổi mật khẩu, tải ảnh và xoá tài khoản không đổi.
 */
export const metadata: Metadata = {
  title: `${messages.passportSettings.title} — Nexora`,
  description: messages.passportSettings.subtitle,
};

export default async function AccountSettingsPage() {
  await requireSession('/account/settings');
  const cookie = (await cookies()).toString();
  const profile = await fetchAccountMe(cookie);
  return <SettingsView profile={profile} />;
}
```

Trong `libs/shared/i18n/src/lib/messages.ts`:

1. Thay ba dòng comment ngay trên JSDoc của `passportSettings`:

```ts
  // Trang `/account/profile` hợp nhất (spec §3): tên/phone + đổi mật khẩu +
  // connected accounts + xoá tài khoản. Avatar/đổi email PARK (spec §4) —
  // avatar chữ-cái tĩnh, email read-only kèm chú thích, KHÔNG dựng form ghi.
```

bằng:

```ts
  // Trang `/account/settings` (spec 09/10, phương án C): thẻ danh tính (ảnh, tên, email,
  // Connected accounts) bên trái; Personal information, Password, Danger zone bên phải.
  // Đổi email vẫn PARK — email read-only kèm chú thích, KHÔNG dựng form ghi.
```

2. Thay:

```ts
    heroBreadcrumb: 'Settings',
    back: '← Passport',
    title: 'Traveler details',
```

bằng:

```ts
    heroBreadcrumb: 'Settings',
    title: 'Traveler details',
```

3. Thay:

```ts
      emailLabel: 'Email',
      emailHint: 'Your sign-in email — changing it isn’t available yet.',
      save: 'Save changes',
    },
```

bằng:

```ts
      emailLabel: 'Email',
    },
```

4. Thay:

```ts
      heading: 'Connected accounts',
      subtitle: 'Sign-in methods linked to your account.',
      emailPassword: 'Email & password',
```

bằng:

```ts
      heading: 'Connected accounts',
      emailPassword: 'Email & password',
```

5. Trong khối `accountBookings`, thay dòng JSDoc của `backToPassport` (Task 3 đã sửa) bằng:

```ts
    /** Nút tròn quay lại Passport ở hero (`ContentHero.back`) — một khoá cho My bookings, Saved và Settings. */
```

- [ ] **Step 5: Chạy thấy xanh**

Run:

```bash
pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only
pnpm --filter @tourism/web exec vitest run src/components/account/settings-view.spec.tsx --maxWorkers=2
pnpm --filter @tourism/web exec vitest run --maxWorkers=2
pnpm --filter @tourism/i18n exec vitest run
pnpm --filter @tourism/web typecheck
grep -rn "passportSettings\.back\|tp\.back\|emailHint\|details\.save\b\|connected\.subtitle\|listHeading\|password\.heading" apps/web/src libs/shared/i18n/src --include=*.ts --include=*.tsx
grep -rn "back: '← Passport'" libs/shared/i18n/src
grep -rn "accountProfile\|accountSaved\|passportSettings" apps/mobile/src apps/admin/src
pnpm exec biome check --write apps/web/src/components/account/settings-view.tsx apps/web/src/components/account/settings-view.spec.tsx "apps/web/src/app/(site)/account/settings/page.tsx" libs/shared/i18n/src/lib/messages.ts
pnpm lint
```

Expected: `settings-view.spec.tsx` PASS 5 ca; toàn bộ test web xanh (đo khi chạy thử plan 09/10:
142 file, 1748 ca, khoảng 2 phút) và i18n xanh (24 ca); typecheck xanh; `grep` thứ nhất RỖNG;
`grep` thứ hai ra đúng MỘT dòng — `back: '← Passport',` của khối `passportVisa` (ngoài phạm vi
việc này; nhánh P7 B gỡ nó); `grep` thứ ba chỉ ra `accountProfile.danger.errors` của mobile (mobile
và admin không đọc khoá nào vừa gỡ); `pnpm lint` xanh (cảnh báo DEPRECATED của `biome.json` có từ
trước, không phải lỗi).

Đột biến: bỏ `lg:items-start` (ca bố cục đỏ); đặt `<IdentityCard>` SAU cột phải (ca thứ tự thẻ và
ca bố cục đỏ); `className="sticky top-28"` (ca bố cục đỏ — dính cả dưới `lg`); bỏ prop `back` (ca
hero đỏ).

- [ ] **Step 6: Commit**

```bash
pnpm exec biome check --write apps/web/src/components/account/settings-view.tsx apps/web/src/components/account/settings-view.spec.tsx "apps/web/src/app/(site)/account/settings/page.tsx" libs/shared/i18n/src/lib/messages.ts
git add apps/web/src/components/account/settings-view.tsx apps/web/src/components/account/settings-view.spec.tsx "apps/web/src/app/(site)/account/settings/page.tsx" libs/shared/i18n/src/lib/messages.ts
git commit -m 'feat(web): ráp trang Settings hai cột với thẻ danh tính dính, nút quay lại ở hero; gỡ khoá chữ mồ côi'
```

Hết Task 7 thì DỪNG: báo session gốc danh sách bảy commit, số ca test từng file, các đột biến đã
thử (kể cả cái không giết được và lý do), chỗ lệch plan và vì sao. Không push, không merge.

---

## Sau khi thi công — việc của session gốc

Thứ tự: review → rebase → gate đầy đủ → soi bố cục → docs → hỏi user merge → deploy → thử tay
production. Mỗi bước xanh mới sang bước sau.

### 1. Review và rebase

- [ ] Review nhánh (nếp F14–F19, P4e-4: tìm, vá TRỌN trên chính nhánh). Đọc kỹ: `formatSavedDate`
  (ngày và năm theo lịch Việt Nam, không đọc đồng hồ), `router.refresh()` chỉ sau khi `set`
  thành công, rollback đúng vị trí, tim là nút hành động "Remove…" (không `aria-pressed`, review 09/10) và lớp phủ link (`z-10`), `SettingsRow`
  đặt chỗ đúng hai khổ, `AvatarUpload` không đổi hành vi, `DeleteAccount` không đổi logic, các
  khoá i18n đã gỡ.
- [ ] Rebase lên `origin/main` mới nhất. Nếu P7 B hoặc C đã vào trước: `messages.ts` dễ đụng — khối
  `bookingDetail` của B chèn ngay trên comment khối `passportSettings`; giữ cả hai bên. Rebase
  xong chạy lại test web và i18n.

### 2. Gate đầy đủ (luật 11)

Năm bước dưới đây là `pnpm gate:int` tách ra để hãm song song (máy từng phình RAM ở `gate:int`
trần); chạy từ gốc worktree bằng Git Bash. Có
session khác đang gate ở checkout gốc thì chạy bản cô lập theo plan P7
(`docs/plans/2026-10-05-booking-pages-redesign.md`, mục "Chạy song song với session khác ở
checkout gốc") với DB `tourism_test_acct` và cổng API 3103, KHÔNG BAO GIỜ giết tiến trình theo
cổng 3001 khi đó.

```powershell
# 0. Commit memory trống — dưới 6 GB thì dừng.
"{0:N1} GB commit trống" -f ((Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory / 1MB)
```

```bash
# 1. Worktree chưa có env DEV — chép từ checkout gốc, KHÔNG BAO GIỜ chép .env.production.
for app in api web admin; do cp /c/Programming/Devs/Projects/Tourism-Platform-V2/apps/$app/.env.local apps/$app/.env.local; done
# 2. API sống cho build web (prerender gọi API thật); Docker Postgres phải chạy.
pnpm turbo run build --filter=@tourism/api --output-logs=errors-only
(cd apps/api && node --env-file-if-exists=.env.local dist/main.js > /tmp/acct-api.log 2>&1 &)
for i in $(seq 1 30); do curl -sf http://localhost:3001/api/health > /dev/null && echo "API sống" && break; sleep 2; done
grep -m1 -o '\[Nest\] [0-9]*' /tmp/acct-api.log   # PID để tắt sau
# 3. build, typecheck, test, lint
NEXT_PUBLIC_API_URL=http://localhost:3001 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm turbo run build --concurrency=1 --output-logs=errors-only
pnpm turbo run typecheck --concurrency=3 --output-logs=errors-only
pnpm turbo run test --concurrency=1 --output-logs=errors-only -- --maxWorkers=4
pnpm lint && node scripts/check-mobile-tokens-only.mjs
# 4. integration test
pnpm test:int --concurrency=2
```

Tắt API đúng PID đã ghi (PowerShell): `Get-Process -Id <pid> | Select-Object Id, ProcessName`
(phải là `node`) rồi `Stop-Process -Id <pid> -Force`. Ghi số test từng gói và số int (ca, file).

### 3. Soi bố cục bằng CSS build thật — 320/375/768/1024/1280, sáng và tối

jsdom không có bố cục. Dựng DOM của chính `SavedView`, `SettingsView` ra trang tĩnh nối với CSS
mà `next build` vừa sinh (bước 2), rồi đo trong trình duyệt. Không commit gì ở bước này — trừ bản
vá lỗi bố cục tìm ra.

- [ ] Tạo spec TẠM `apps/web/src/components/__layout-check__/render.spec.tsx`:

```tsx
// TẠM — soi bố cục Saved và Settings bằng CSS build thật (plan 09/10, "Sau khi thi công"). KHÔNG commit.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, it, vi } from 'vitest';
import { SavedView } from '@/components/account/saved-view';
import { SettingsView } from '@/components/account/settings-view';
import { makeSessionUser } from '@/test/fixtures/account';
import { makeWishlistItem } from '@/test/fixtures/wishlist';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({
  api: {
    wishlist: { set: vi.fn() },
    media: { signUpload: vi.fn() },
    account: { setAvatar: vi.fn() },
  },
  withBrowserAuth: () => ({}),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { updateUser: vi.fn(), changePassword: vi.fn(), signOut: vi.fn() },
}));

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// cwd của vitest là apps/web.
const CHUNKS = '.next/static/chunks';
const CSS = readdirSync(CHUNKS).filter((name) => name.endsWith('.css'));
const FONT_CLASSES = [
  ...new Set(
    CSS.flatMap((name) =>
      [...readFileSync(`${CHUNKS}/${name}`, 'utf8').matchAll(/\.([\w-]+__variable)\b/g)].map(
        (match) => match[1],
      ),
    ),
  ),
];
const OUT = '.next/layout-check';
mkdirSync(OUT, { recursive: true });
/** Trang tĩnh không JS: tháo `opacity: 0` mà `motion` để lại (bản sao luật `<noscript>` của layout gốc). */
const NO_JS_MOTION =
  '<style>[style*="opacity:0"],[style*="opacity: 0"]{opacity:1!important;transform:none!important}</style>';

/** Ghi DOM hiện tại ra hai trang: sáng và tối (`class="dark"` trên `<html>`, như script theme của site). */
function dump(name: string) {
  const links = CSS.map((file) => `<link rel="stylesheet" href="/static/chunks/${file}">`).join('');
  for (const theme of ['light', 'dark'] as const) {
    const html = `${FONT_CLASSES.join(' ')} h-full antialiased${theme === 'dark' ? ' dark' : ''}`;
    writeFileSync(
      `${OUT}/${name}-${theme}.html`,
      `<!doctype html><html lang="en" class="${html}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${links}${NO_JS_MOTION}</head><body class="min-h-full flex flex-col">${document.body.innerHTML}</body></html>`,
    );
  }
}

const TODAY = '2026-10-09';
/** Năm thẻ đủ kiểu: tên rất dài, chưa đánh giá, không còn bán, lưu từ năm trước. */
const ITEMS = [
  makeWishlistItem(),
  makeWishlistItem({
    tourId: 'a1000000-0000-4000-8000-000000000001',
    slug: 'mekong',
    title: 'Mekong Delta Boats & Floating Markets — two days on the river with a homestay',
    durationDays: 2,
    ratingAvg: 4.7,
    ratingCount: 54,
    basePrice: '198.00',
    addedAt: '2026-09-21T05:00:00.000Z',
  }),
  makeWishlistItem({
    tourId: 'a1000000-0000-4000-8000-000000000002',
    slug: 'sapa',
    title: 'Sapa Rice Terraces Trek',
    durationDays: 4,
    ratingAvg: null,
    ratingCount: 0,
    basePrice: '410.00',
    addedAt: '2026-09-14T05:00:00.000Z',
  }),
  makeWishlistItem({
    tourId: 'a1000000-0000-4000-8000-000000000003',
    slug: 'hue',
    title: 'Hue Imperial City Day Tour',
    unavailable: true,
    addedAt: '2026-09-02T05:00:00.000Z',
  }),
  makeWishlistItem({
    tourId: 'a1000000-0000-4000-8000-000000000004',
    slug: 'ha-long',
    title: 'Ha Long Bay Overnight Cruise',
    durationDays: 2,
    addedAt: '2025-12-20T03:00:00.000Z',
  }),
];
/** Tên và email dài để soi chỗ dễ tràn ở 320px. */
const USER = makeSessionUser({
  name: 'Nguyễn Thị Minh Anh Phương',
  email: 'nguyen.thi.minh.anh.phuong.traveller@example.com',
});

describe('layout-check Saved và Settings', () => {
  it('saved', () => {
    render(<SavedView items={ITEMS} today={TODAY} />);
    dump('saved');
  });
  it('saved-empty', () => {
    render(<SavedView items={[]} today={TODAY} />);
    dump('saved-empty');
  });
  it('settings', () => {
    render(<SettingsView profile={USER} />);
    dump('settings');
  });
  it('settings-open', async () => {
    const user = userEvent.setup();
    render(<SettingsView profile={USER} />);
    await user.click(screen.getByRole('button', { name: 'Edit Phone' }));
    await user.click(screen.getByRole('button', { name: 'Edit Password' }));
    dump('settings-open');
  });
});
```

  Chạy `pnpm --filter @tourism/web exec vitest run src/components/__layout-check__/render.spec.tsx --maxWorkers=2`
  — bốn ca xanh, tám file trong `apps/web/.next/layout-check/`.

- [ ] Máy chủ tĩnh ở nền (Git Bash, gốc worktree): `python -m http.server 8768 --directory apps/web/.next`;
  mở `http://localhost:8768/layout-check/saved-light.html` trong Browser pane (`preview_start` với
  `url`). Chữ phải ra Archivo/Literata của site. Đo sau sự kiện `load`; đổi khổ bằng
  `resize_window` rồi TẢI LẠI trang trước khi đo. Pane bị ẩn thì số đo ra 0 (pane ẩn tắt rAF) —
  đo bằng Edge headless qua CDP thay vào.
- [ ] Đoạn đo Saved (chạy bằng `javascript_tool` ở `saved-*.html`, mỗi khổ):

```js
(() => {
  const r = Math.round;
  const box = (el) => el.getBoundingClientRect();
  const grid = document.querySelector('[data-slot="saved-grid"]');
  const cells = [...grid.children];
  const firstTop = r(box(cells[0]).top);
  const firstRow = cells.filter((c) => r(box(c).top) === firstTop);
  const next = cells[firstRow.length];
  return {
    viewport: innerWidth,
    // Bề rộng nội dung KHÔNG gồm thanh cuộn dọc — breakpoint đọc `innerWidth`, khung đọc `clientWidth`.
    clientWidth: document.documentElement.clientWidth,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    gridWidth: r(box(grid).width),
    gridExpected: Math.min(document.documentElement.clientWidth - (innerWidth >= 1024 ? 64 : 32), 1152),
    columns: firstRow.length,
    colGap: firstRow.length > 1 ? r(box(firstRow[1]).left - box(firstRow[0]).right) : null,
    rowGap: next ? r(box(next).top - Math.max(...firstRow.map((c) => box(c).bottom))) : null,
    cards: cells.map((cell) => {
      const card = cell.querySelector('article');
      const img = card.querySelector('[class*="aspect-4/3"]');
      const heart = card.querySelector('button[id^="saved-heart-"]');
      const [kicker, h3, meta, price] = [
        card.querySelector('p'),
        card.querySelector('h3'),
        card.querySelectorAll('p')[1],
        card.querySelectorAll('p')[2],
      ];
      const stack = [kicker, h3, meta, price].filter(Boolean).map(box);
      return {
        ratio: Math.round((box(img).height / box(img).width) * 100) / 100,
        heart: [r(box(heart).width), r(box(heart).height), r(box(img).right - box(heart).right), r(box(heart).top - box(img).top)],
        titleLines: r(box(h3).height / Number.parseFloat(getComputedStyle(h3).lineHeight)),
        stacked: stack.every((b, i) => i === 0 || stack[i - 1].bottom <= b.top + 0.5),
      };
    }),
  };
})()
```

- [ ] Đoạn đo Settings (ở `settings-*.html` và `settings-open-*.html`):

```js
(() => {
  const r = Math.round;
  const box = (el) => el.getBoundingClientRect();
  const layout = document.querySelector('[data-slot="settings-layout"]');
  const id = document.querySelector('[data-slot="identity-card"]');
  const right = layout.children[1];
  const hit = (p, q) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
  const rows = [...layout.querySelectorAll('li')].map((li) => {
    const [a, b, c] = [...li.children].map(box);
    return {
      label: li.children[0].textContent.slice(0, 14),
      wide: c ? b.left >= a.right && c.left >= b.right : b.left >= a.right,
      narrow: c ? b.top >= a.bottom - 1 && c.bottom <= b.top + 1 : b.top >= a.bottom - 1,
      overlap: hit(a, b) || (c ? hit(a, c) || hit(b, c) : false),
    };
  });
  const abs = box(id).top + scrollY;
  scrollTo({ top: abs - 112 + 160, behavior: 'instant' });
  const stickyTop = r(box(id).top);
  scrollTo({ top: 0, behavior: 'instant' });
  return {
    viewport: innerWidth,
    clientWidth: document.documentElement.clientWidth,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    layoutWidth: r(box(layout).width),
    layoutExpected: Math.min(document.documentElement.clientWidth - (innerWidth >= 1024 ? 64 : 32), 1024),
    identity: [r(box(id).width), getComputedStyle(id).position],
    gap: r(box(right).left - box(id).right),
    identityFirst: box(id).bottom <= box(right).top + 1 || box(id).right <= box(right).left + 1,
    stickyTop,
    rows,
  };
})()
```

- [ ] Ngưỡng đạt — cả hai theme, mọi trang:

Mọi khổ, mọi trang: `overflowX` 0; Saved `gridWidth` = `gridExpected`; Settings `layoutWidth` =
`layoutExpected` (±1). Hai giá trị kỳ vọng tính từ `clientWidth` vì Chromium trên Windows có thể
dành ~15px cho thanh cuộn dọc — không có thanh cuộn thì ở 375 ra 343, ở 1024 ra 960, ở 1280 ra
1152 (Saved) và 1024 (Settings).

| Khổ | Saved (`saved-*`) | Settings (`settings-*`, `settings-open-*`) |
| --- | --- | --- |
| 320 | `columns` 1 | `identity[0]` = `layoutWidth`, `identity[1]` "static" · mọi dòng `narrow` true, `overlap` false |
| 375 | `columns` 1 | như 320 |
| 768 | `columns` 2 · `colGap` 24 · `rowGap` 32 | như 320 (một cột, không dính) |
| 1024 | `columns` 3 · `colGap` 24 · `rowGap` 32 | `identity` `[320, "sticky"]` · `gap` 24 · `stickyTop` 112 · mọi dòng `wide` true, `overlap` false |
| 1280 | `columns` 3 · `colGap` 24 | như 1024 |

  Mọi thẻ Saved ở mọi khổ: `ratio` 0.75, `heart` `[36, 36, 10, 10]`, `titleLines` 2, `stacked`
  true. Settings ở mọi khổ: `identityFirst` true. `saved-empty-*` không có lưới nên đo bằng
  `({ overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, empty: Math.round(document.querySelector('[data-slot="saved-empty"]').getBoundingClientRect().width) })`:
  `overflowX` 0 ở mọi khổ, `empty` 520 khi `clientWidth` từ 552 trở lên.
  Theme tối: thêm một ảnh chụp mỗi trang ở 375 và 1280 để soi bằng mắt — nền tim đọc được trên
  ảnh, nền đỏ nhạt của dòng Delete account thấy được, chữ muted đọc được. Đặt ảnh 1280 và 375
  cạnh bản vẽ (phương án C và A) để so dáng.
- [ ] Phép đo trượt thì vá đúng chỗ (TDD nếu là logic), chạy lại test liên quan, commit
  `fix(web): …`, đo lại; ghi mọi số đo (cả lần trượt) vào entry CHANGELOG.
- [ ] Dọn: tắt máy chủ tĩnh (PowerShell)
  `Get-NetTCPConnection -LocalPort 8768 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`;
  xoá `apps/web/src/components/__layout-check__/` và `apps/web/.next/layout-check/`; trả khổ pane
  về `desktop`. `git status` phải sạch.

### 4. Docs

- [ ] Entry `docs/CHANGELOG.md` (ngay dưới khối "File này chỉ giữ đợt đang chạy", TRÊN entry mới
  nhất; ngày là ngày viết). Không dòng nào bắt đầu bằng `+`; tổng số test gói trong một dòng hoặc
  nối bằng chữ "và"; `git diff docs/CHANGELOG.md` chỉ có phần thêm. Khuôn:

```markdown
## 2026-MM-DD — Saved và Settings của khách thiết kế lại (nhánh `feat/account-saved-settings`)

Trang `/account/saved` thành lưới thẻ ảnh 4:3 có tim nổi trên ảnh (luôn hiện, nút hành động "Remove…"),
dòng "Saved {ngày}" theo lịch Việt Nam, số tour ở hero cập nhật sau khi bỏ lưu thành công
(`router.refresh()`), trạng thái trống mới. Trang `/account/settings` theo phương án C: thẻ danh
tính bên trái (dính từ lg) gom ảnh, tên, email và Connected accounts; bên phải thẻ Personal
information, thẻ Password tách riêng, khối Danger zone viền đỏ nhạt. Hai hero có nút tròn quay
lại Passport thay link chữ. Chỉ đổi giao diện — không API, không contract, không migration, không
env. Spec 09/10, plan 09/10.

(Một đoạn chỗ lệch plan nếu có, kèm lý do; một đoạn số đo bố cục ở 320/375/768/1024/1280, sáng
và tối.)

**Review findings:** (số lỗi tìm ra và đã vá ở vòng review, theo nhóm.)

Tests after: Vitest **N** (web …, i18n …, api …, admin …, contract …, core …, ui …, tokens …,
mobile …, mobile-ui …), int **N ở N file**. Ca mới theo file; ba ca mật khẩu chuyển từ
`profile-summary.spec.tsx` sang `password-card.spec.tsx`; đột biến đã thử, kể cả cái không giết
được.

CÒN TREO: không có việc hạ tầng (không migration, không env, không webhook).
```

- [ ] `docs/README.md`: mục spec "Trang account Saved và Settings (chỉ đổi giao diện, chưa thi
  công)" đổi trạng thái theo ngày merge; mục Plans có link plan này (nếu chưa thêm lúc commit
  plan). Roadmap trong `CLAUDE.md` và `docs/open-items.md` nếu cần một dòng.
- [ ] `./scripts/docs-freshness.sh` (Git Bash) xanh.

### 5. Merge và deploy

- [ ] Hỏi user trước khi merge. Rebase lên `main`, `git merge --ff-only`, push bằng SHA đích danh
  (không `HEAD:main`); `gh run list --branch main --limit 1` phải `success` (luật 14).
- [ ] Chỉ web đổi: kiểm deploy Vercel của web xanh; Render (API) không có thay đổi mã nhưng vẫn có
  thể deploy lại theo push — kiểm bằng Render MCP (`list_deploys`), không bằng uptime; thấy
  `update_failed` kiểu EMAXCONNSESSION (G23) thì hỏi user trước khi kích lại. Redeploy production
  phải nhờ user bấm.
- [ ] Dọn worktree sau merge: `apps/*/.next`, `apps/*/.turbo`, `.turbo` gốc, `apps/*/.env.local`
  vừa chép; báo dung lượng ổ C trước và sau.

### 6. Thử tay trên production — từng bước, chờ user xác nhận mỗi bước

User tự đăng nhập (agent không nhập mật khẩu). Session gốc kiểm DB bằng SQL CHỈ ĐỌC. Không bấm xoá
tài khoản thật ở bất kỳ bước nào.

- [ ] **Bước 1 — Saved, máy bàn:** `/account/saved` của một tài khoản có từ 4 tour đã lưu. Hero:
  "Tucked inside", dòng số tour, nút tròn quay lại (bấm → `/account`, trình duyệt Back về lại).
  Lưới 3 cột, tim ở góc phải trên ảnh, "Saved {ngày}" khớp
  `SELECT t.title, w.created_at FROM wishlist w JOIN tours t ON t.id = w.tour_id JOIN users u ON u.id = w.user_id WHERE u.email = '<email user cho>' ORDER BY w.created_at DESC;`
  (ngày theo giờ Việt Nam; lưu năm trước thì có năm).
- [ ] **Bước 2 — Saved, điện thoại** (máy thật hoặc DevTools 375): một cột, tim luôn hiện, không
  cuộn ngang.
- [ ] **Bước 3 — bỏ lưu:** bấm tim một thẻ → thẻ rời ngay, số ở hero giảm một sau chốc lát; tải
  lại trang vẫn đúng; SQL đếm `wishlist` của tài khoản giảm một. Lưu lại tour đó từ `/tours` để
  trả dữ liệu.
- [ ] **Bước 4 — bỏ lưu lỗi:** DevTools → Network → Offline, bấm tim → thẻ quay về ĐÚNG chỗ cũ kèm
  toast "Couldn't remove this tour", số ở hero không đổi; bật mạng lại.
- [ ] **Bước 5 — Settings, máy bàn:** `/account/settings`. Hai cột; cuộn xuống thì thẻ danh tính
  đứng yên dưới thanh điều hướng; Connected accounts nằm trong thẻ danh tính; nút tròn quay lại.
- [ ] **Bước 6 — sửa tại dòng:** sửa Phone (dòng tô nền nhạt, Save phone) rồi trả số cũ; cùng lúc
  mở dòng Password → hai thẻ cùng mở; Cancel cả hai. Kiểm `users.phone` bằng SQL sau mỗi lần lưu.
- [ ] **Bước 7 — Danger zone:** mở hộp Delete account, thấy đủ chữ và hai ô, bấm Cancel. KHÔNG xác
  nhận.
- [ ] **Bước 8 — Settings, điện thoại:** một cột, thẻ danh tính lên đầu, mỗi dòng hai hàng (nhãn và
  Edit trên, giá trị dưới), không cuộn ngang.
- [ ] Ghi kết quả từng bước vào CHANGELOG (entry thử tay), lỗi tìm ra thì ghi `docs/open-items.md`
  hoặc vá ngay theo nếp review.
