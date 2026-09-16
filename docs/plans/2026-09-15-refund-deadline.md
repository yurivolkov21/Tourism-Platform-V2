# Hoàn tiền một hạn chót — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay bảng bậc 100/50/25/0, ân hạn 24 giờ và luồng duyệt huỷ bằng một hạn chót mỗi chuyến (N theo độ dài chuyến): khách tự huỷ ngay, ngừng nhận đặt sau hạn chót, mọi phép so ngày theo giờ Việt Nam; kèm giao diện, báo cáo, seed và tài liệu.

**Architecture:** Luật là bộ hàm thuần trong `libs/shared/contract/src/schemas/refund-policy.ts`, mọi tầng (API, web, admin, seed, email) gọi chung. API có một lõi huỷ chạy trong advisory lock của booking: gọi cổng thanh toán trước, một CTE ghi sau; hôm nay khách dùng, P4e-1 sau này dùng cho nút huỷ chuyến. Thứ tự task giữ nhánh luôn xanh: thêm cái mới, chuyển consumer, rồi mới gỡ cái cũ (Task 13); hai cột DB cũ chỉ xoá ở nhánh M2 sau khi deploy (Phụ lục A).

**Tech Stack:** TypeScript 7 (ESM, import có đuôi `.js`), NestJS 11 + oRPC (`@orpc/nest`, `@orpc/contract`), Prisma 7.8 + `@prisma/adapter-pg`, PostgreSQL, Next.js 16 + React 19 (web, admin), react-email, Zod 4, Vitest 4, Biome 2, Turborepo 2, pnpm 11.

**Spec:** [docs/specs/2026-09-15-refund-deadline-design.md](../specs/2026-09-15-refund-deadline-design.md) · [ADR-0041](../adr/0041-single-cancellation-deadline.md)

## Global Constraints

- Luật (spec §3): `L` = ngày về − ngày đi + 1; `N` = 1 khi `L` = 1, 3 khi `L` là 2 hoặc 3, 7 khi `L` ≥ 4; ngày chót `D` = ngày khởi hành − `N`; còn trong hạn ⇔ ngày hôm nay theo giờ Việt Nam ≤ `D`; huỷ online được ⇔ ngày hôm nay theo giờ Việt Nam < ngày khởi hành; trong hạn hoàn `total_amount − SUM(refunds)`, quá hạn hoàn `'0.00'`.
- Áp cho booking PAID hoặc PARTIALLY_REFUNDED; REFUNDED không huỷ online.
- Múi giờ duy nhất cho mọi phép so ngày chuyến đi: `Asia/Ho_Chi_Minh`. Node dùng `vietnamToday(now)` của contract; SQL dùng `vietnamDateSql` (Hợp đồng F), tức `(… AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`. Giữ UTC có chủ đích: chuỗi theo ngày của dashboard (ADR-0036) và `review-eligibility.ts`.
- Q7: web và admin KHÔNG so ngày bằng giờ trình duyệt để quyết "đã ngừng nhận đặt" hay "còn huỷ miễn phí"; chỉ in cờ và ngày server trả (API, hoặc server component gọi hàm contract). Checkout luôn in ngày cụ thể, không có biến thể "until today".
- Khoá chống trùng khi hoàn lúc huỷ: `cancel:<bookingId>`. Dedupe outbox: `booking-cancelled:<bookingId>`.
- Copy người dùng thấy: tiếng Anh, đặt trong `@tourism/i18n` (CLAUDE.md luật 7). Riêng email đang viết inline trong `apps/api/src/worker/emails/render-email.tsx` thì theo đúng nếp file đó.
- Comment `//` và JSDoc viết tiếng Việt có dấu (luật 8); identifier tiếng Anh.
- Frontend chỉ dùng token màu, không hex (luật 6).
- TDD trên logic thuần: viết test, chạy thấy đỏ, rồi cài đặt; logic mới phủ ≥ 80% (luật 4).
- Không sửa file `migration.sql` đã apply. Migration mới: `apps/api/prisma/migrations/YYYYMMDDHHMMSS_ten/migration.sql`.
- Chỉ Biome (`pnpm lint:fix`); không thêm Prettier/ESLint.
- Commit: Conventional Commits, message tiếng Việt có dấu, KHÔNG dòng AI attribution (luật 12). Không push.
- Không chạm hạ tầng sống (luật 15): DB duy nhất là Postgres Docker `localhost:5432`; không Supabase, Render, Vercel, Stripe, PayPal, Resend, Cloudinary; không bao giờ `export DATABASE_URL` trỏ Supabase.
- Thi công trên nhánh `feat/refund-deadline`, worktree riêng (skill `superpowers:using-git-worktrees`). Một session mobile chạy song song: không đụng `apps/mobile`, `libs/mobile` trừ khi typecheck buộc.
- Không `git add` `docs/screenshot/`; luôn add đường dẫn tường minh.
- Chạy lệnh pnpm từ Git Bash. Docker Postgres phải chạy khi chạy int test.
- Trước khi dùng một kỹ thuật, rà skill phù hợp (luật 9).
- `@tourism/contract` và `@tourism/i18n` được tiêu thụ qua `dist` (exports trỏ `./dist`; i18n phụ thuộc contract). Sau khi sửa mã nguồn của một trong hai, chạy `pnpm --filter @tourism/contract build` rồi `pnpm --filter @tourism/i18n build` trước khi chạy test hay typecheck của API, web, admin.
- Lệnh chạy một file test (từ gốc repo):
  - contract: `pnpm --filter @tourism/contract exec vitest run <đường dẫn tính từ libs/shared/contract>`
  - i18n: `pnpm --filter @tourism/i18n exec vitest run <đường dẫn tính từ libs/shared/i18n>`
  - API unit: `pnpm --filter @tourism/api exec vitest run <đường dẫn tính từ apps/api>`
  - API int: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts <đường dẫn tính từ apps/api>`
  - web: `pnpm --filter @tourism/web exec vitest run <đường dẫn tính từ apps/web>`
  - admin: `pnpm --filter @tourism/admin exec vitest run <đường dẫn tính từ apps/admin>`
- **Cổng đầy đủ** (thay `pnpm gate:int` trên máy này, theo trình tự hãm tài nguyên), chạy ở cuối MỖI task, trước commit (luật 11):

  ```bash
  pnpm test:int --concurrency=2
  pnpm turbo run build --concurrency=1
  pnpm turbo run typecheck --concurrency=3
  pnpm turbo run test --concurrency=2 -- --maxWorkers=4
  pnpm lint
  node scripts/check-mobile-tokens-only.mjs
  ```

## Thứ tự và ranh giới task

| Task | Việc | Thêm | Gỡ |
| --- | --- | --- | --- |
| 1 | Luật hạn chót: hàm thuần ở contract | Các hàm ở Hợp đồng A | — (hàm cũ giữ tới Task 13) |
| 2 | Migration mở rộng + email `BOOKING_CANCELLED` + `reason` cho phép null | Migration M1, enum, schema contract, case email, mục menu outbox admin | — |
| 3 | Thước ngày Việt Nam cho các gate hiện có | Hợp đồng F; `vietnamToday` ở `create`, `reCheckout`, claim, catalog, xoá tài khoản | `todayUtc`, `startOfTodayUtc` |
| 4 | Chốt chặn đặt chỗ ở `create` và `checkout` | `assertDepartureBookable` | — |
| 5 | Catalog: `bookingDeadline`, `bookable`, giá "from" | Hai field ở `TourDepartureSchema` | — |
| 6 | Lõi huỷ + `bookings.cancel` huỷ ngay (API, contract) | Hợp đồng B, Hợp đồng C | `CancellationsService.request` |
| 7 | Web: trang booking của khách | Nút huỷ, hộp xác nhận hai dạng | Trạng thái request/pending/resubmit, ước tính theo bậc |
| 8 | Gỡ luồng duyệt huỷ (admin + API) + hoàn thiện chí cho booking CANCELLED | Khối lịch sử huỷ mới, `canRefund` mới | Vùng Cancellations, `admin.cancellations.*`, `admin.stats.cancellations`, `CANCELLATION_OPEN` |
| 9 | Báo cáo tháng, Excel, P&L | Hợp đồng D | `decisionsSlice`, `cancellationsApproved/Denied` |
| 10 | Web: trang tour và checkout | Ngày chót từng chuyến, chuyến đóng, dòng hạn chót ở checkout | Dòng "refund available until…" theo bậc |
| 11 | Văn bản pháp lý, FAQ, câu quảng bá, dòng hạn chót trong email xác nhận | Văn bản sinh từ `CANCELLATION_WINDOW_RULES` | `legal/refund-tiers.ts`, mọi dùng `REFUND_GRACE_HOURS` ngoài contract |
| 12 | Seed theo luật mới + `seed:verify` | Ca tự huỷ trong/quá hạn, kẹp mốc | Ca DENIED/REQUESTED, `freeCancellationDays` và policy CANCELLATION trong fixture |
| 13 | Gỡ luật cũ và field thừa | — | Bậc, ân hạn, `refundEstimate`, `freeCancellationDays` ở contract/API/web/admin |
| 14 | Tài liệu hiện trạng | booking-states, AMEND ADR, seed spec, prompt P4e-1, README | — |
| 15 | Nghiệm thu cuối | — | — |

Phụ lục A: nhánh M2 (sau khi deploy). Phụ lục B: triển khai (session gốc và user, không phải session thi công).

### Ghi chú nối giữa các task

- Task 4 đổi fixture `depSoon` trong `apps/api/src/modules/bookings/cancellations.int.spec.ts` sang chuyến 1 ngày, để `create` không bị chặn trong khung 00:00–06:59 giờ Việt Nam. Task 6 viết lại file này phải giữ điều kiện đó.
- Task 5 cho giá "from" ở CẢ list lẫn detail chỉ tính chuyến `bookable`, để thẻ tour và trang tour không in hai giá khác nhau. Task 10 lọc `heroPrice` của web theo `bookable` cho khớp.
- DB không có CHECK `end_date >= start_date`; các hàm luật ném RangeError với dòng hỏng nên trang tour sẽ trả 500. Không vá ở đợt này; ghi cho P4e-1 (form sửa chuyến) thêm CHECK.
- Task 3 thêm tuỳ chọn `startDate` cho helper `createBooking` của `apps/api/src/auth/account-delete.int.spec.ts` để test chặn xoá tài khoản không đỏ trong khung 00:00–06:59 giờ Việt Nam. Bước "chạy thấy đỏ" của test `4d` trong Task 3 dựa trên đồng hồ thật, chỉ đúng tới hết 19/10/2026.
- Task 4 tự định nghĩa kiểu `BookableDepartureRow` cho tham số của `assertDepartureBookable`.
- Task 2 thêm, ngoài bảng ranh giới, để cổng xanh: nhãn `messages.admin.outbox.type.BOOKING_CANCELLED`; `outbox.spec.ts` đổi độ dài enum 14 → 15; dòng mới trong bảng `cases` của `apps/api/src/worker/resend.deliverer.spec.ts`; khoá `messages.admin.cancellations.noReason` (Task 8 xoá theo vùng Cancellations); int test mới `apps/api/src/modules/bookings/refund-deadline-migration.int.spec.ts`. `booking-detail-sections.tsx` ẩn dòng "Reason" khi `reason` là `null`; Task 8 viết lại khối lịch sử huỷ thì thay cách này.
- Task 7 tạo không gian tên i18n dùng chung `cancellationDeadline` (`full(date)`, `passed(date)`, `policyLink`); Task 10 dùng lại và thêm `short(date)`, `rule(days)`, `ruleAfter`. Task 7 tạo `accountActionErrors.bookingClosed`; Task 10 cho `booking-form.ts` dùng lại khoá này. Task 7 in tiền hoàn bằng `formatMoneyExact` và thêm hàm thuần `legacyCancellationNote` cho dòng lịch sử yêu cầu cũ.
- Task 6 tạo module thuần `apps/api/src/modules/bookings/booking-cancellation.ts`, dùng chung cho `bookings.byCode.cancellation` và lõi huỷ; Task 13 KHÔNG xoá module này cùng `refundEstimate`. `cancelInLock` là method `private`.
- Task 6 chuyển các test approve/deny/admin cũ trong `cancellations.int.spec.ts` và hai test `cancellationStatus` trong `bookings.int.spec.ts` sang tạo yêu cầu bằng helper Prisma `openRequest` (định nghĩa trong `cancellations.int.spec.ts`), vì route `bookings.cancel` không còn tạo yêu cầu chờ. Task 8 xoá các test approve/deny đó; helper nào không còn ai dùng thì xoá theo.
- Giữa Task 6 và Task 7, web vẫn hiện hộp "xin huỷ" cũ trong khi route đã huỷ ngay. Đây là trạng thái trung gian trên nhánh, không deploy.
- Từ Task 6, `toBooking` ném RangeError nếu snapshot có ngày về trước ngày đi (cùng loại rủi ro với ghi chú CHECK ở trên).
- Task 8 thêm `decidedByCustomer: z.boolean()` vào `CancellationRequestSchema` (API điền `decided_by = user_id` của chính dòng yêu cầu), vì contract không mang `userId` của booking lẫn `decidedById`. Đây là field DẪN XUẤT ở API, không phải cột DB, nên seed (Task 12) không phải ghi gì thêm; Task 14 nhắc tên này trong `booking-states.md`.
- Task 8 tính "hoàn bao nhiêu" của một yêu cầu REFUNDED bằng tổng dòng `refunds` có `createdAt` trong `[min(createdAt, decidedAt), max(createdAt, decidedAt)]` của yêu cầu, vì sổ hoàn không trỏ về yêu cầu. Điều này đúng khi lõi huỷ Task 6 ghi yêu cầu và dòng hoàn trong cùng giao dịch, dùng mốc `now()` của DB cho cả hai.
- Task 8 xoá thêm code chết: `CancellationsService.myRequests`, kit `apps/admin/src/components/kit/wizard-steps.tsx` và spec của nó; xoá import `REFUND_GRACE_HOURS` ở dòng đầu `libs/shared/i18n/src/lib/messages.ts`; thay ca khoá chéo "admin refund ‖ cancel-approve" bằng ca "admin hoàn thiện chí ‖ khách tự huỷ" trong `refunds.int.spec.ts`.
- Task 10 thêm vị từ dùng chung `isDepartureOpen(d) = d.bookable && d.seatsLeft > 0` vào `apps/web/src/lib/tours.ts` và dùng nó ở MỌI chỗ cho chọn đợt (provider, wizard, ô ngày của `TourMediaPanel`, modal `DepartureDialog`, bảng Departures, `heroPrice`, trang `/book`) — bỏ sót một chỗ là khách vẫn chọn được đợt đã đóng rồi ăn 400. Sáu spec dùng fixture ép kiểu `as unknown as DepartureVM[]` (`tour-hero`, `itinerary-panel`, `departure-dialog`, `tour-media-panel`, `departures-panel`, `booking-wizard`) không đỏ ở Task 5 nên chính Task 10 thêm `bookable`/`bookingDeadline` cho chúng.
- Task 10 gộp mọi câu "không còn đợt đặt được" về một cặp khoá `tourDetail.departures.none/noneBody` và xoá `booking.wizard.soldOut`, `booking.errors.DEPARTURE_NOT_OPEN` (không còn consumer ở web, admin, mobile, API). Thẻ chính sách huỷ từ nay LUÔN hiện vì sinh từ luật chứ không từ `policies[]`, nên hai test cũ "tour không có policy nào thì bỏ hẳn hàng thẻ" ĐỔI NGHĨA chứ không bị xoá. N của thẻ lấy theo độ dài tour (`windowDaysForTripLength(tour.durationDays)`), còn ngày chót cụ thể in trên từng hàng đợt. `monthNotice` cấp tháng giữ nguyên vì nó đo GHẾ, không đo hạn đặt.
- Task 11 thay `legal/refund-tiers.ts` bằng hai hàm sinh câu `cancellationWindowBullets` và `cancellationWindowSentence` đặt trong `legal/cancellation.ts`; `terms.ts`, nhóm `faqPage` của `messages.ts` và `apps/web/src/mocks/faq.ts` cùng gọi chúng, nên ba con số cửa sổ chỉ nằm một chỗ. `messages.ts` vì vậy import `./legal/cancellation.js` (cùng package, không tạo vòng).
- Task 11 đổi `updated` của hai trang pháp lý sang 15 September 2026 nên assertion ngày trong `legal-content.spec.ts` tách theo từng trang; thêm spec mới `apps/web/src/components/marketing-cancellation-copy.spec.tsx`; link `/cancellation-policy` chỉ thêm ở `trust-strip.tsx`. Template email `CANCELLATION_APPROVED` giữ nguyên link "refund schedule" cho tới khi Phụ lục A xoá ba template cũ.
- Task 12 phải sửa cả `apps/api/prisma/fixtures/catalog/departures-2026.ts`: với mốc H hiện tại, seed không sinh ra chuyến nào đã qua hạn chót mà chưa khởi hành, nên không có booking để demo ca "huỷ quá hạn". Task kéo chuyến còn bán đầu tiên của 6 tour từ 4 ngày trở lên về khoảng [H + 2, H + 6]. Task 12 cũng sửa sáu câu FAQ tour còn hứa mốc huỷ riêng hoặc đổi ngày miễn phí, và chuyển bước `tourFaqs` của `seed.ts` sang upsert (bước cũ `createMany` + `skipDuplicates` không bao giờ đưa nội dung sửa tới prod). Dòng hoàn khi khách tự huỷ phải có `admin_id` NULL, nên `RefundFixture` thêm cờ `issuedByAdmin`. `verify-seed.mjs` nay import luật từ contract, nên phải build contract trước khi chạy `seed:verify`.
- Task 12 ghi yêu cầu huỷ tự động với `createdAt` BẰNG `decidedAt`: Task 8 quy tiền hoàn về một yêu cầu bằng tổng dòng `refunds` nằm trong `[min(createdAt, decidedAt), max(...)]`, nên hai mốc lệch nhau sẽ kéo nhầm dòng hoàn của lần khác. Cùng lý do, dòng hoàn khi khách tự huỷ có `admin_id` NULL (`RefundFixture.issuedByAdmin`).
- Task 12: `verify-seed.mjs` phải đọc mốc thời gian bằng `to_char` — node-pg dựng `timestamp` theo giờ máy nên so ngày trực tiếp sẽ lệch trên máy không ở UTC. Ngày Việt Nam trùng ngày UTC trong seed chỉ vì `gioTrongNgay` luôn trả 01:00–15:00 UTC; bộ lọc `paid_at` vì vậy so thẳng mốc hạn chót, không cắt nửa đêm.
- Task 13 nhận thêm ba chỗ không task nào khác nhận: khối comment trong `apps/web/src/components/home/trust-strip.tsx`, và hai fixture `Booking` ở `apps/admin/src/lib/bookings-csv.spec.ts`, `apps/admin/src/lib/bookings-view.spec.ts`. Mobile không có dòng nào phải gỡ.
- Task 15 không tạo file nên không có commit; entry CHANGELOG thuộc Phụ lục B. Máy thi công không có key Stripe/PayPal và chỉ đăng ký FakeGateway khi `NODE_ENV === 'test'`, nên lượt sandbox thật (đặt, huỷ trong hạn, Stripe hoàn) chạy ở Phụ lục B sau khi API mới sống trên Render; Task 15 kiểm tay ba ca chạy được offline.

## Hợp đồng dữ liệu dùng chung

Tên và kiểu dưới đây là cố định; mọi task dùng đúng như vậy.

### Hợp đồng A — hàm luật (Task 1, file `libs/shared/contract/src/schemas/refund-policy.ts`)

```ts
/** Múi giờ của ngày khởi hành: ngày lịch Việt Nam. */
export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export type CancellationWindowDays = 1 | 3 | 7;

export interface CancellationWindowRule {
  /** Độ dài chuyến nhỏ nhất, tính vào. */
  minTripDays: number;
  /** Độ dài chuyến lớn nhất, tính vào; `null` = không giới hạn. */
  maxTripDays: number | null;
  windowDays: CancellationWindowDays;
}

export const CANCELLATION_WINDOW_RULES: readonly CancellationWindowRule[] = [
  { minTripDays: 1, maxTripDays: 1, windowDays: 1 },
  { minTripDays: 2, maxTripDays: 3, windowDays: 3 },
  { minTripDays: 4, maxTripDays: null, windowDays: 7 },
];

/** N theo độ dài chuyến. RangeError khi `tripDays` không phải số nguyên ≥ 1. */
export function windowDaysForTripLength(tripDays: number): CancellationWindowDays;
/** L = endDate − startDate + 1 (ngày lịch). RangeError khi ngày hỏng hoặc endDate < startDate. */
export function tripLengthDays(startDate: string, endDate: string): number;
export function cancellationWindowDays(startDate: string, endDate: string): CancellationWindowDays;
/** D = startDate − N, dạng `YYYY-MM-DD`. */
export function cancellationDeadline(startDate: string, endDate: string): string;
/** Ngày lịch Việt Nam của `now`, dạng `YYYY-MM-DD`. RangeError khi `now` là Invalid Date. */
export function vietnamToday(now: Date): string;
/** vietnamToday(now) <= cancellationDeadline(startDate, endDate). */
export function isWithinDeadline(now: Date, startDate: string, endDate: string): boolean;
/** vietnamToday(now) < startDate. */
export function canCancelOnline(now: Date, startDate: string): boolean;
/** Trong hạn: remainingRefundable(totalAmount, refundedTotal). Quá hạn: '0.00'. Không kiểm canCancelOnline. */
export function refundOnCancel(input: {
  now: Date;
  startDate: string;
  endDate: string;
  totalAmount: string;
  refundedTotal: string;
}): string;
```

- `vietnamToday` dùng `Intl.DateTimeFormat('en-CA', { timeZone: VIETNAM_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })`, khởi tạo lười ở lần gọi đầu (không tạo ở module scope, để app mobile import contract không nổ).
- Tính ngày trên chỉ số ngày UTC của chuỗi `YYYY-MM-DD`, không dùng giờ máy.
- Giữ nguyên `toCents`, `fromCents`, `remainingRefundable`. Các export cũ (`REFUND_POLICY_TIERS`, `REFUND_GRACE_HOURS`, `refundPercentFor*`, `isWithinGracePeriod`, `fullRefundThresholdDays`, `daysBeforeDeparture`, `percentOfAmount`, `policyRefundAmount`, `RefundPolicyTier`, `RefundRequestContext`) còn sống tới Task 13.

### Hợp đồng B — contract booking và catalog (Task 5, Task 6)

```ts
// libs/shared/contract/src/schemas/catalog.ts — Task 5, thêm vào TourDepartureSchema
bookingDeadline: z.iso.date(),
/** Server tính: chuyến còn trong hạn đặt. Còn chỗ hay không vẫn đọc `seatsLeft`. */
bookable: z.boolean(),

// libs/shared/contract/src/schemas/bookings.ts — Task 6
export const BookingCancellationSchema = z.object({
  deadline: z.iso.date(),
  withinDeadline: z.boolean(),
  refundAmount: DecimalStringSchema,
  canCancel: z.boolean(),
});
export type BookingCancellation = z.output<typeof BookingCancellationSchema>;

// BookingSchema thêm (Task 6):
cancellationDeadline: z.iso.date(),

// BookingDetailSchema thêm (Task 6); `refundEstimate` còn giữ tới Task 13:
cancellation: BookingCancellationSchema.nullable(),

export const CancelBookingInputSchema = z.object({
  code: BookingCodeSchema,
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const CancelBookingResultSchema = z.object({
  booking: BookingSchema,
  refundedAmount: DecimalStringSchema,
});
export type CancelBookingResult = z.output<typeof CancelBookingResultSchema>;

// CancellationRequestSchema (Task 2):
reason: z.string().min(1).max(1000).nullable(),

// outbox.ts EmailTypeSchema (Task 2): thêm 'BOOKING_CANCELLED' vào CUỐI mảng.
```

`bookings.byCode.cancellation`: booking PAID hoặc PARTIALLY_REFUNDED → `{ deadline: cancellationDeadline(s, e), withinDeadline: isWithinDeadline(now, s, e), refundAmount: refundOnCancel({ now, startDate: s, endDate: e, totalAmount, refundedTotal }), canCancel: canCancelOnline(now, s) && providerPaymentId !== null }`; trạng thái khác → `null`.

Route `bookings.cancel` (Task 6): method/path giữ `POST /api/bookings/{code}/cancel`; input `CancelBookingInputSchema`; output `CancelBookingResultSchema`; errors:

```ts
NOT_FOUND: { message: 'Booking not found' },
NOT_CANCELLABLE: { status: 422, message: 'This booking can no longer be cancelled online' },
REFUND_FAILED: { status: 502, message: 'Provider refund failed' },
```

### Hợp đồng C — lõi huỷ và email (Task 2, Task 6)

```ts
// apps/api/src/modules/bookings/cancellations.service.ts — Task 6
/**
 * Khách tự huỷ booking của chính mình. Ném BookingNotFoundError (không phải chủ
 * hoặc không tồn tại), BookingNotCancellableError (trạng thái sai, không có
 * capture, hoặc đã tới ngày khởi hành), ProviderRefundFailedError (cổng lỗi).
 */
async cancelByCustomer(
  userId: string,
  bookingCode: string,
  reason: string | null,
  now: Date = new Date(),
): Promise<CancelBookingResult>;

/** Đầu vào lõi — P4e-1 sẽ thêm initiator 'operator'. */
export interface CancelInLockInput {
  decidedById: string;
  refundAmount: Prisma.Decimal;
  reason: string | null;
  initiator: 'customer';
  now: Date;
}
```

Lõi chạy trong `withBookingRefundLock(bookingId)`; gọi `RefundsService.executeGatewayRefund(booking, amount, \`cancel:${booking.id}\`)` khi `amount > 0`; một CTE: booking → CANCELLED (`cancelled_at = now()`), INSERT `cancellation_requests` (status `REFUNDED`, `decided_by` = `decidedById`, `decided_at = now()`, `reason`), INSERT `refunds` khi `amount > 0` (`admin_id` NULL, `provider_payment_id` = capture của booking), trả chỗ (`seats_booked − party`, guard `seats_booked >= party`), INSERT outbox `BOOKING_CANCELLED`.

Payload outbox `BOOKING_CANCELLED` (Task 2 render, Task 6 ghi):

```ts
{
  bookingId: string;
  code: string;
  email: string;
  name: string;
  title: string;
  amount: string;      // '1200.00'; '0.00' khi quá hạn
  currency: string;
  refunded: boolean;   // amount > 0
  deadline: string;    // YYYY-MM-DD
  initiator: 'customer';
}
```

### Hợp đồng D — báo cáo (Task 9)

```ts
// libs/shared/contract/src/schemas/reports.ts: thay cancellationsApproved, cancellationsDenied bằng
cancellationsWithinDeadline: z.int().nonnegative(),
cancellationsAfterDeadline: z.int().nonnegative(),

// apps/api/src/modules/stats/stats-aggregates.ts: thay decisionsSlice
export async function cancellationOutcomesSlice(
  from: Date,
  to: Date,
): Promise<{ withinDeadline: number; afterDeadline: number }>;
// Đếm cancellation_requests status REFUNDED có decided_at ∈ [from, to);
// xếp loại bằng isWithinDeadline(request.createdAt, booking.departureStartDate, booking.departureEndDate).
```

P&L (spec §6):

- doanh thu = `SUM(total_amount − refunded)` của mọi booking có `paid_at IS NOT NULL` trên chuyến không CANCELLED, theo `departure_end_date` trong kỳ;
- giá vốn biến đổi và `cost_missing`: booking có `paid_at IS NOT NULL` và `status <> 'CANCELLED'` (khách thực đi);
- giá vốn cố định: điều kiện EXISTS dùng tập khách thực đi;
- phí cổng (tiền gốc `gross_collected` và số giao dịch `bookings`): mọi booking có `paid_at IS NOT NULL` trên chuyến không CANCELLED, vì cổng thu phí lúc thanh toán và không trả lại khi hoàn hay huỷ (ADR-0033 §Giới hạn #3). Người tổng hợp chốt 15/09 khi ghép Task 9.

### Hợp đồng E — admin (Task 8)

```ts
// apps/admin/src/lib/refund.ts
/** Nút hoàn thiện chí hiện khi còn tiền chưa hoàn trên booking PAID, PARTIALLY_REFUNDED hoặc CANCELLED. */
export function canRefund(status: BookingStatusValue, remaining: string): boolean;
```

### Hợp đồng F — tiện ích ngày phía API (Task 3, Task 4)

```ts
// apps/api/src/lib/vietnam-date-sql.ts — Task 3
/** Biểu thức SQL ra ngày lịch Việt Nam của một mốc, ví dụ `vietnamDateSql(Prisma.sql\`now()\`)`. */
export function vietnamDateSql(instant: Prisma.Sql): Prisma.Sql;

// apps/api/src/auth/account.service.ts — Task 3: thêm tham số cuối để test tất định
deleteAccount(userId, password, now: Date = new Date())

// apps/api/src/modules/bookings/bookings.service.ts — Task 4
/** Ném DepartureNotAvailableError khi tour chưa published, chuyến không OPEN, hoặc đã qua hạn chót. */
export function assertDepartureBookable(departure, now: Date): void;
```

## Bản đồ file mới và file bị xoá

Chỉ liệt kê file **tạo mới** và **bị xoá**. Danh sách đầy đủ file mỗi task đụng
tới nằm ở mục **Files:** của chính task đó.

**Tạo mới (13 file)**

| Task | File |
| --- | --- |
| 2 | `apps/api/prisma/migrations/20260915120000_refund_deadline_expand/migration.sql` |
| 2 | `apps/api/src/modules/bookings/refund-deadline-migration.int.spec.ts` |
| 3 | `apps/api/src/lib/vietnam-date-sql.ts` |
| 3 | `apps/api/src/lib/vietnam-date-sql.int.spec.ts` |
| 6 | `apps/api/src/modules/bookings/booking-cancellation.ts` |
| 6 | `apps/api/src/modules/bookings/booking-cancellation.spec.ts` |
| 8 | `apps/admin/src/lib/cancellation-history.ts` |
| 8 | `apps/admin/src/lib/cancellation-history.spec.ts` |
| 11 | `libs/shared/i18n/src/lib/legal/cancellation.spec.ts` |
| 11 | `apps/web/src/components/marketing-cancellation-copy.spec.tsx` |
| 12 | `apps/api/prisma/fixtures/catalog/chinh-sach-huy.spec.ts` |
| Phụ lục A | `apps/api/prisma/migrations/<timestamp Prisma sinh>_refund_deadline_contract/migration.sql` |

**Bị xoá (22 file)**

| Task | File |
| --- | --- |
| 8 | `apps/api/src/modules/bookings/admin-cancellations.controller.ts` |
| 8 | `apps/admin/src/app/(admin)/cancellations/page.tsx` |
| 8 | `apps/admin/src/app/(admin)/cancellations/[code]/page.tsx` |
| 8 | `apps/admin/src/app/(admin)/cancellations/actions.ts` |
| 8 | `apps/admin/src/components/cancellations/approve-stepper-dialog.tsx` |
| 8 | `apps/admin/src/components/cancellations/cancellations-table.tsx` |
| 8 | `apps/admin/src/components/cancellations/cancellations-toolbar.tsx` |
| 8 | `apps/admin/src/components/cancellations/decide-actions.tsx` |
| 8 | `apps/admin/src/components/cancellations/decide-actions.spec.tsx` |
| 8 | `apps/admin/src/components/cancellations/review-request-button.tsx` |
| 8 | `apps/admin/src/components/kit/wizard-steps.tsx` |
| 8 | `apps/admin/src/components/kit/wizard-steps.spec.tsx` |
| 8 | `apps/admin/src/lib/api/cancellations.ts` |
| 8 | `apps/admin/src/lib/approve-refund.ts` |
| 8 | `apps/admin/src/lib/approve-refund.spec.ts` |
| 8 | `apps/admin/src/lib/cancellations-decide.ts` |
| 8 | `apps/admin/src/lib/cancellations-decide.spec.ts` |
| 8 | `apps/admin/src/lib/cancellations-query.ts` |
| 8 | `apps/admin/src/lib/cancellations-query.spec.ts` |
| 8 | `apps/admin/src/lib/cancellations-view.ts` |
| 8 | `apps/admin/src/lib/cancellations-view.spec.ts` |
| 11 | `libs/shared/i18n/src/lib/legal/refund-tiers.ts` |

Task 1, 4, 5, 7, 9, 10, 13, 14, 15 và Phụ lục B chỉ sửa file đã có.

---

### Task 1: Luật hạn chót: hàm thuần ở contract

**Files:**
- Modify: `libs/shared/contract/src/schemas/refund-policy.ts` — chỉ THÊM vào cuối file, sau `refundPercentForRequest` (hết dòng 231). Không đổi dòng nào phía trên; mọi export cũ còn sống tới Task 13.
- Test: `libs/shared/contract/src/schemas/refund-policy.spec.ts` — thay khối import (dòng 1–14), thêm một `describe` mới ở cuối file (sau dòng 268).

**Interfaces:**
- Consumes: `remainingRefundable(totalAmount, refundedTotal)` có sẵn trong cùng file.
- Produces (đúng Hợp đồng A; tự ra ngoài gói qua `export * from './schemas/refund-policy.js'` ở `libs/shared/contract/src/index.ts`, không cần sửa `index.ts`):
  - `VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'`
  - `type CancellationWindowDays = 1 | 3 | 7`
  - `interface CancellationWindowRule { minTripDays: number; maxTripDays: number | null; windowDays: CancellationWindowDays }`
  - `CANCELLATION_WINDOW_RULES: readonly CancellationWindowRule[]`
  - `windowDaysForTripLength(tripDays: number): CancellationWindowDays`
  - `tripLengthDays(startDate: string, endDate: string): number`
  - `cancellationWindowDays(startDate: string, endDate: string): CancellationWindowDays`
  - `cancellationDeadline(startDate: string, endDate: string): string`
  - `vietnamToday(now: Date): string`
  - `isWithinDeadline(now: Date, startDate: string, endDate: string): boolean`
  - `canCancelOnline(now: Date, startDate: string): boolean`
  - `refundOnCancel(input: { now: Date; startDate: string; endDate: string; totalAmount: string; refundedTotal: string }): string`
  - Nội bộ, KHÔNG export: `calendarDayIndex(date: string): number`, `calendarDateFromIndex(dayIndex: number): string`.
- Đã kiểm bằng Grep: chưa file nào trong `apps/` hay `libs/` khai các tên trên, nên `export *` ở `index.ts` không đụng tên (TS2308).

- [ ] **Step 1: Viết test đỏ — khối import** — trong `libs/shared/contract/src/schemas/refund-policy.spec.ts`, thay nguyên khối dòng 1–14:

Trước:

```ts
import { describe, expect, it } from 'vitest';
import {
  daysBeforeDeparture,
  fromCents,
  fullRefundThresholdDays,
  percentOfAmount,
  policyRefundAmount,
  REFUND_GRACE_HOURS,
  REFUND_POLICY_TIERS,
  refundPercentForBooking,
  refundPercentForDays,
  refundPercentForRequest,
  toCents,
} from './refund-policy.js';
```

Sau:

```ts
import { describe, expect, it } from 'vitest';
import {
  CANCELLATION_WINDOW_RULES,
  canCancelOnline,
  cancellationDeadline,
  cancellationWindowDays,
  daysBeforeDeparture,
  fromCents,
  fullRefundThresholdDays,
  isWithinDeadline,
  percentOfAmount,
  policyRefundAmount,
  REFUND_GRACE_HOURS,
  REFUND_POLICY_TIERS,
  refundOnCancel,
  refundPercentForBooking,
  refundPercentForDays,
  refundPercentForRequest,
  toCents,
  tripLengthDays,
  VIETNAM_TIME_ZONE,
  vietnamToday,
  windowDaysForTripLength,
} from './refund-policy.js';
```

- [ ] **Step 2: Viết test đỏ — khối describe mới** — thêm vào CUỐI `libs/shared/contract/src/schemas/refund-policy.spec.ts` (sau `describe('số học tiền dùng chung (vòng vá review 05/09)', …)`):

```ts
/**
 * Hạn chót một mốc mỗi chuyến (ADR-0041) — luật THAY bảng bậc, ân hạn và badge
 * ở trên (các khối cũ còn sống tới Task 13 của plan 15/09). Mọi con số của luật
 * khoá ở đây: N theo độ dài chuyến, ngày chót, ranh giới nửa đêm giờ Việt Nam
 * và số tiền hoàn. Một sửa đổi lỡ tay ở bảng N sẽ đỏ ở đây trước khi tới khách.
 */
describe('hạn chót một mốc mỗi chuyến (ADR-0041)', () => {
  describe('CANCELLATION_WINDOW_RULES', () => {
    it('bảng ba dòng của spec §3.1 — khoá con số sẽ công bố với khách', () => {
      expect(CANCELLATION_WINDOW_RULES).toEqual([
        { minTripDays: 1, maxTripDays: 1, windowDays: 1 },
        { minTripDays: 2, maxTripDays: 3, windowDays: 3 },
        { minTripDays: 4, maxTripDays: null, windowDays: 7 },
      ]);
    });

    it('phủ KÍN mọi độ dài từ 1 ngày: dòng sau nối tiếp dòng trước, dòng cuối không trần', () => {
      // Hở một khe thì `windowDaysForTripLength` ném lỗi cho chuyến rơi vào khe đó.
      expect(CANCELLATION_WINDOW_RULES[0]?.minTripDays).toBe(1);
      CANCELLATION_WINDOW_RULES.forEach((rule, index) => {
        const next = CANCELLATION_WINDOW_RULES[index + 1];
        if (next === undefined) {
          expect(rule.maxTripDays).toBeNull();
        } else {
          expect(next.minTripDays).toBe((rule.maxTripDays ?? Number.NaN) + 1);
        }
      });
    });
  });

  describe('tripLengthDays và N', () => {
    it.each([
      ['2026-10-20', '2026-10-20', 1],
      ['2026-10-20', '2026-10-21', 2],
      ['2026-10-20', '2026-10-22', 3],
      ['2026-10-20', '2026-10-23', 4],
      ['2026-10-20', '2026-10-31', 12],
    ] as const)('L của chuyến %s → %s là %i ngày', (startDate, endDate, days) => {
      expect(tripLengthDays(startDate, endDate)).toBe(days);
    });

    it('đếm theo ngày lịch qua cuối năm và tháng 2 năm nhuận', () => {
      expect(tripLengthDays('2026-12-30', '2027-01-02')).toBe(4);
      expect(tripLengthDays('2028-02-28', '2028-03-01')).toBe(3);
    });

    it.each([
      [1, 1],
      [2, 3],
      [3, 3],
      [4, 7],
      [12, 7],
    ] as const)('chuyến %i ngày thì N = %i', (tripDays, windowDays) => {
      expect(windowDaysForTripLength(tripDays)).toBe(windowDays);
    });

    it('cancellationWindowDays tính N thẳng từ cặp ngày', () => {
      expect(cancellationWindowDays('2026-10-20', '2026-10-20')).toBe(1);
      expect(cancellationWindowDays('2026-10-20', '2026-10-22')).toBe(3);
      expect(cancellationWindowDays('2026-10-20', '2026-10-31')).toBe(7);
    });
  });

  describe('cancellationDeadline', () => {
    it.each([
      ['hanoi-heritage-day', '2026-10-20', '2026-10-20', '2026-10-19'],
      ['mekong-can-tho-2d', '2026-10-20', '2026-10-21', '2026-10-17'],
      ['ha-giang-loop-4d', '2026-10-20', '2026-10-23', '2026-10-13'],
    ] as const)(
      'ví dụ spec §3.1: %s (%s → %s) có ngày chót %s',
      (_slug, startDate, endDate, deadline) => {
        expect(cancellationDeadline(startDate, endDate)).toBe(deadline);
      },
    );

    it('lùi qua đầu tháng và đầu năm vẫn ra ngày lịch đúng', () => {
      expect(cancellationDeadline('2026-11-03', '2026-11-06')).toBe('2026-10-27');
      expect(cancellationDeadline('2027-01-02', '2027-01-03')).toBe('2026-12-30');
    });
  });

  describe('vietnamToday', () => {
    it('23:59:59 giờ Việt Nam vẫn là hôm đó, 00:00:00 đã sang ngày mới', () => {
      expect(vietnamToday(new Date('2026-10-18T16:59:59.000Z'))).toBe('2026-10-18');
      expect(vietnamToday(new Date('2026-10-18T17:00:00.000Z'))).toBe('2026-10-19');
    });

    it('khung 00:00–06:59 giờ Việt Nam: ngày UTC còn là hôm trước — đúng ca thước UTC cũ đếm lệch (spec §1)', () => {
      const at = new Date('2026-10-18T23:30:00.000Z'); // 06:30 sáng 19/10 giờ Việt Nam
      expect(at.toISOString().slice(0, 10)).toBe('2026-10-18');
      expect(vietnamToday(at)).toBe('2026-10-19');
    });

    it('không đổi giờ theo mùa: mốc đổi ngày luôn là 17:00 UTC, kể cả đêm giao thừa', () => {
      expect(vietnamToday(new Date('2026-01-15T16:59:59.000Z'))).toBe('2026-01-15');
      expect(vietnamToday(new Date('2026-07-15T17:00:00.000Z'))).toBe('2026-07-16');
      expect(vietnamToday(new Date('2026-12-31T17:00:00.000Z'))).toBe('2027-01-01');
    });

    it('VIETNAM_TIME_ZONE là Asia/Ho_Chi_Minh — cùng tên vùng mà SQL dùng', () => {
      expect(VIETNAM_TIME_ZONE).toBe('Asia/Ho_Chi_Minh');
    });
  });

  describe('isWithinDeadline — chuyến 20–21/10: N = 3, ngày chót 17/10', () => {
    const startDate = '2026-10-20';
    const endDate = '2026-10-21';

    it('trọn ngày chót, từ 00:00 tới 23:59:59 giờ Việt Nam, còn trong hạn', () => {
      expect(isWithinDeadline(new Date('2026-10-16T17:00:00.000Z'), startDate, endDate)).toBe(true);
      expect(isWithinDeadline(new Date('2026-10-17T16:59:59.000Z'), startDate, endDate)).toBe(true);
    });

    it('00:00 giờ Việt Nam ngày sau ngày chót là quá hạn, dù UTC còn là ngày chót', () => {
      expect(isWithinDeadline(new Date('2026-10-17T17:00:00.000Z'), startDate, endDate)).toBe(
        false,
      );
      expect(isWithinDeadline(new Date('2026-10-20T03:00:00.000Z'), startDate, endDate)).toBe(
        false,
      );
    });
  });

  describe('canCancelOnline — khởi hành 20/10', () => {
    it('huỷ online được tới 23:59:59 giờ Việt Nam hôm trước ngày khởi hành', () => {
      expect(canCancelOnline(new Date('2026-10-19T16:59:59.000Z'), '2026-10-20')).toBe(true);
    });

    it('từ 00:00 giờ Việt Nam ngày khởi hành thì hết — kể cả khi UTC còn là hôm trước', () => {
      expect(canCancelOnline(new Date('2026-10-19T17:00:00.000Z'), '2026-10-20')).toBe(false);
      expect(canCancelOnline(new Date('2026-10-21T02:00:00.000Z'), '2026-10-20')).toBe(false);
    });
  });

  describe('refundOnCancel — chuyến 4 ngày 20–23/10: N = 7, ngày chót 13/10', () => {
    const trip = { startDate: '2026-10-20', endDate: '2026-10-23', totalAmount: '1200.00' };

    it('trong hạn: hoàn trọn phần CHƯA hoàn, không phải cả tổng', () => {
      expect(
        refundOnCancel({ ...trip, now: new Date('2026-10-13T16:59:59.000Z'), refundedTotal: '0.00' }),
      ).toBe('1200.00');
      // Đã hoàn thiện chí 200.50 từ trước → chỉ còn 999.50.
      expect(
        refundOnCancel({
          ...trip,
          now: new Date('2026-10-01T09:00:00.000Z'),
          refundedTotal: '200.50',
        }),
      ).toBe('999.50');
    });

    it('quá hạn: 0.00 dù sổ còn tiền chưa hoàn', () => {
      expect(
        refundOnCancel({ ...trip, now: new Date('2026-10-13T17:00:00.000Z'), refundedTotal: '0.00' }),
      ).toBe('0.00');
      expect(
        refundOnCancel({
          ...trip,
          now: new Date('2026-10-15T09:00:00.000Z'),
          refundedTotal: '200.50',
        }),
      ).toBe('0.00');
    });

    it('đã hoàn đủ từ trước thì trong hạn cũng chỉ còn 0.00, không âm', () => {
      expect(
        refundOnCancel({
          ...trip,
          now: new Date('2026-10-01T09:00:00.000Z'),
          refundedTotal: '1200.00',
        }),
      ).toBe('0.00');
    });
  });

  describe('dữ liệu hỏng thì NÉM RangeError, không âm thầm ra một hạn chót sai', () => {
    const now = new Date('2026-10-01T09:00:00.000Z');

    it.each(['2026-02-31', '2026-13-01', '2026-10-2', '20/10/2026', '', 'bad'])(
      'ngày hỏng %j',
      (bad) => {
        expect(() => tripLengthDays(bad, '2026-10-20')).toThrow(RangeError);
        expect(() => tripLengthDays('2026-10-20', bad)).toThrow(RangeError);
        expect(() => cancellationDeadline(bad, '2026-10-20')).toThrow(RangeError);
        expect(() => isWithinDeadline(now, '2026-10-20', bad)).toThrow(RangeError);
        expect(() => canCancelOnline(now, bad)).toThrow(RangeError);
      },
    );

    it('ngày về trước ngày đi', () => {
      expect(() => tripLengthDays('2026-10-20', '2026-10-19')).toThrow(RangeError);
      expect(() => cancellationWindowDays('2026-10-20', '2026-10-19')).toThrow(RangeError);
      expect(() =>
        refundOnCancel({
          now,
          startDate: '2026-10-20',
          endDate: '2026-10-19',
          totalAmount: '10.00',
          refundedTotal: '0.00',
        }),
      ).toThrow(RangeError);
    });

    it('Invalid Date', () => {
      expect(() => vietnamToday(new Date('not a date'))).toThrow(RangeError);
      expect(() => isWithinDeadline(new Date(Number.NaN), '2026-10-20', '2026-10-21')).toThrow(
        RangeError,
      );
      expect(() => canCancelOnline(new Date(Number.NaN), '2026-10-20')).toThrow(RangeError);
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('độ dài chuyến %s', (tripDays) => {
      expect(() => windowDaysForTripLength(tripDays)).toThrow(RangeError);
    });
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận đỏ**

Run (Git Bash, gốc repo): `pnpm --filter @tourism/contract exec vitest run src/schemas/refund-policy.spec.ts`

Expected: FAIL — các ca trong `describe('hạn chót một mốc mỗi chuyến (ADR-0041)')` đỏ vì các export chưa có (`TypeError: … is not a function`, `Cannot read properties of undefined`, và `toThrow(RangeError)` nhận TypeError); các `describe` cũ vẫn PASS.

- [ ] **Step 4: Cài đặt** — thêm vào CUỐI `libs/shared/contract/src/schemas/refund-policy.ts` (sau hàm `refundPercentForRequest`):

```ts
// ── Hạn chót một mốc mỗi chuyến (ADR-0041) ──
//
// THAY bảng bậc, ân hạn và badge phía trên; khối cũ còn sống tới khi mọi
// consumer chuyển xong (Task 13, plan 15/09) để nhánh luôn xanh.
//
// Nguyên tắc (ADR-0041 §1): chỗ còn bán lại được thì hoàn đủ, không bán lại
// được nữa thì không tự hoàn. Vì thế hạn chót vừa là lúc hết huỷ miễn phí vừa
// là lúc ngừng nhận đặt; API, web, admin, seed và email cùng gọi bộ hàm này.

/** Múi giờ của ngày khởi hành: ngày lịch Việt Nam. */
export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** N — số ngày trước ngày khởi hành mà hạn chót rơi vào. */
export type CancellationWindowDays = 1 | 3 | 7;

/** Một dòng của bảng N theo độ dài chuyến. */
export interface CancellationWindowRule {
  /** Độ dài chuyến nhỏ nhất, tính vào. */
  minTripDays: number;
  /** Độ dài chuyến lớn nhất, tính vào; `null` = không giới hạn. */
  maxTripDays: number | null;
  windowDays: CancellationWindowDays;
}

/**
 * N theo độ dài chuyến (spec §3.1): 1 ngày → 1, 2–3 ngày → 3, từ 4 ngày → 7.
 * Nguồn của cả con số server áp lẫn bảng ba dòng ở `/cancellation-policy`.
 *
 * Xếp TĂNG DẦN, dòng sau nối tiếp dòng trước, dòng cuối không trần — test canh
 * bất biến này. Kẹp ở 7 vì bảng bậc cũ vốn coi "dưới 7 ngày" là hết hoàn, nên
 * không tour nào hoàn ít hơn trước (ADR-0041 §2). Không ai cấu hình N.
 */
export const CANCELLATION_WINDOW_RULES: readonly CancellationWindowRule[] = [
  { minTripDays: 1, maxTripDays: 1, windowDays: 1 },
  { minTripDays: 2, maxTripDays: 3, windowDays: 3 },
  { minTripDays: 4, maxTripDays: null, windowDays: 7 },
];

const CALENDAR_DAY_MS = 86_400_000;
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `YYYY-MM-DD` → chỉ số ngày (số ngày kể từ 1970-01-01), đếm thuần trên lịch,
 * không dính giờ máy hay múi giờ.
 *
 * Ngày hỏng NÉM RangeError chứ không trả NaN: NaN làm mọi phép so thành `false`,
 * tức một cột ngày lỗi âm thầm thành "quá hạn, hoàn 0" — cùng bài học của
 * `daysBeforeDeparture` (vòng vá review 05/09). Ném thì lỗi thành 500 nhìn thấy
 * được.
 */
function calendarDayIndex(date: string): number {
  const match = CALENDAR_DATE_PATTERN.exec(date);
  if (match === null) throw new RangeError(`Invalid calendar date: ${date}`);
  const [, year, month, day] = match;
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(day));
  // `Date.UTC` tự cuộn ngày không tồn tại (31/02 thành 03/03) — khứ hồi để bắt.
  if (new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Invalid calendar date: ${date}`);
  }
  return ms / CALENDAR_DAY_MS;
}

/** Chỉ số ngày → `YYYY-MM-DD`; phép ngược của `calendarDayIndex`. */
function calendarDateFromIndex(dayIndex: number): string {
  return new Date(dayIndex * CALENDAR_DAY_MS).toISOString().slice(0, 10);
}

/** N theo độ dài chuyến. RangeError khi `tripDays` không phải số nguyên ≥ 1. */
export function windowDaysForTripLength(tripDays: number): CancellationWindowDays {
  if (!Number.isInteger(tripDays) || tripDays < 1) {
    throw new RangeError(`Invalid trip length: ${tripDays}`);
  }
  const rule = CANCELLATION_WINDOW_RULES.find(
    (entry) =>
      tripDays >= entry.minTripDays && (entry.maxTripDays === null || tripDays <= entry.maxTripDays),
  );
  // Bảng phủ kín mọi độ dài ≥ 1 (có test canh); nhánh này chỉ chạy khi ai đó sửa bảng thành hở.
  if (rule === undefined) {
    throw new RangeError(`No cancellation window for trip length ${tripDays}`);
  }
  return rule.windowDays;
}

/** L = endDate − startDate + 1 (ngày lịch). RangeError khi ngày hỏng hoặc endDate < startDate. */
export function tripLengthDays(startDate: string, endDate: string): number {
  const start = calendarDayIndex(startDate);
  const end = calendarDayIndex(endDate);
  // DB chưa có CHECK end_date >= start_date (ghi cho P4e-1) — chặn ở đây để dòng
  // hỏng không sinh độ dài âm rồi lọt vào bảng N.
  if (end < start) {
    throw new RangeError(`Trip ends before it starts: ${startDate} → ${endDate}`);
  }
  return end - start + 1;
}

/** N của một chuyến, tính thẳng từ ngày đi và ngày về. */
export function cancellationWindowDays(
  startDate: string,
  endDate: string,
): CancellationWindowDays {
  return windowDaysForTripLength(tripLengthDays(startDate, endDate));
}

/**
 * D = startDate − N, dạng `YYYY-MM-DD`. Hạn chót hết lúc 23:59:59 giờ Việt Nam
 * của ngày này (spec §3.1), và đó cũng là ngày cuối nhận đặt chỗ (ADR-0041 §3).
 */
export function cancellationDeadline(startDate: string, endDate: string): string {
  return calendarDateFromIndex(
    calendarDayIndex(startDate) - cancellationWindowDays(startDate, endDate),
  );
}

/**
 * Formatter giờ Việt Nam, tạo LƯỜI ở lần gọi đầu chứ không ở module scope: app
 * mobile import contract, và một runtime thiếu dữ liệu múi giờ không được nổ
 * ngay lúc import cả gói.
 */
let vietnamDateFormatter: Intl.DateTimeFormat | undefined;

/** Ngày lịch Việt Nam của `now`, dạng `YYYY-MM-DD`. RangeError khi `now` là Invalid Date. */
export function vietnamToday(now: Date): string {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError('Invalid Date passed to vietnamToday');
  }
  if (vietnamDateFormatter === undefined) {
    vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: VIETNAM_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  // Ghép từ `formatToParts` thay vì tin chuỗi `format()`: thứ tự và dấu nối của
  // khuôn ngày `en-CA` phụ thuộc bản dữ liệu ICU của runtime, còn giá trị từng
  // phần năm/tháng/ngày thì không.
  const parts = vietnamDateFormatter.formatToParts(now);
  const part = (type: 'year' | 'month' | 'day'): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * Còn trong hạn chót: `vietnamToday(now) <= cancellationDeadline(startDate, endDate)`.
 * Trong hạn thì còn nhận đặt và huỷ còn được hoàn đủ.
 */
export function isWithinDeadline(now: Date, startDate: string, endDate: string): boolean {
  return (
    calendarDayIndex(vietnamToday(now)) <=
    calendarDayIndex(cancellationDeadline(startDate, endDate))
  );
}

/**
 * Còn huỷ online được: `vietnamToday(now) < startDate`, tức tới hết ngày trước
 * ngày khởi hành theo giờ Việt Nam (spec §3.3). Không xét hạn chót — quá hạn vẫn
 * huỷ được, chỉ là không hoàn.
 */
export function canCancelOnline(now: Date, startDate: string): boolean {
  return calendarDayIndex(vietnamToday(now)) < calendarDayIndex(startDate);
}

/**
 * Số tiền hoàn khi khách huỷ (spec §3.3): trong hạn là trọn phần CHƯA hoàn
 * (`remainingRefundable`, tức `total − SUM(refunds)`), quá hạn là `'0.00'`.
 *
 * KHÔNG kiểm `canCancelOnline`: có được huỷ hay không là việc của chỗ gọi (lõi
 * huỷ ở API); hàm này chỉ trả lời "bao nhiêu".
 */
export function refundOnCancel(input: {
  now: Date;
  startDate: string;
  endDate: string;
  totalAmount: string;
  refundedTotal: string;
}): string {
  return isWithinDeadline(input.now, input.startDate, input.endDate)
    ? remainingRefundable(input.totalAmount, input.refundedTotal)
    : '0.00';
}
```

- [ ] **Step 5: Chạy test, xác nhận xanh**

Run: `pnpm --filter @tourism/contract exec vitest run src/schemas/refund-policy.spec.ts`

Expected: PASS — toàn bộ file, gồm mọi ca cũ và mọi ca của `describe('hạn chót một mốc mỗi chuyến (ADR-0041)')`. Mọi nhánh của logic mới đều có ca đi qua (hợp lệ, ngày hỏng, về trước đi, Invalid Date, độ dài không hợp lệ, trong hạn, quá hạn), trừ nhánh `rule === undefined` là nhánh phòng thủ chỉ chạy khi bảng bị sửa hở.

- [ ] **Step 6: Typecheck contract và build hai gói tiêu thụ qua `dist`**

Run:

```bash
pnpm --filter @tourism/contract typecheck
pnpm --filter @tourism/contract build
pnpm --filter @tourism/i18n build
```

Expected: cả ba exit 0. `tsc --noEmit` của contract bao cả file spec (`include: ["src"]`), nên các `it.each([...] as const)` và phép truy cập mảng dưới `noUncheckedIndexedAccess` phải qua được ở đây.

- [ ] **Step 7: Format và soát diff**

Run:

```bash
pnpm lint:fix
git status --short
git diff libs/shared/contract/src/schemas/refund-policy.ts libs/shared/contract/src/schemas/refund-policy.spec.ts
```

Expected: `git status --short` chỉ liệt kê hai file của task (cộng các mục untracked đã có từ trước như `docs/screenshot/`, KHÔNG add chúng). Diff của `refund-policy.ts` chỉ có phần thêm ở cuối file; không dòng cũ nào đổi. Nếu Biome sắp lại thứ tự tên trong khối import của spec thì giữ bản Biome sắp.

- [ ] **Step 8: Cổng đầy đủ** (Docker Postgres đang chạy; Git Bash, gốc repo)

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu lệnh exit 0. Task này chỉ thêm export mới nên không package nào khác đổi hành vi.

- [ ] **Step 9: Commit**

```bash
git add libs/shared/contract/src/schemas/refund-policy.ts libs/shared/contract/src/schemas/refund-policy.spec.ts
git commit -m "feat(contract): luật hạn chót một mốc mỗi chuyến theo ngày Việt Nam"
```
---

### Task 2: Migration mở rộng M1, email `BOOKING_CANCELLED`, `reason` cho phép null

**Files:**
- Create: `apps/api/prisma/migrations/20260915120000_refund_deadline_expand/migration.sql`
- Create: `apps/api/src/modules/bookings/refund-deadline-migration.int.spec.ts`
- Modify: `apps/api/prisma/schema.prisma` (`enum EmailType` dòng 163–188; `model CancellationRequest`, field `reason` dòng 689)
- Modify: `libs/shared/contract/src/schemas/outbox.ts` (`EmailTypeSchema` dòng 22–42)
- Modify: `libs/shared/contract/src/schemas/bookings.ts` (`CancellationRequestSchema` dòng 366–381)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (`admin.cancellations` quanh dòng 3641–3642; `admin.outbox.type` dòng 4173–4189)
- Modify: `apps/api/src/worker/emails/render-email.tsx` (thêm case sau `CANCELLATION_DENIED`, trước `NEWSLETTER_WELCOME`, quanh dòng 437)
- Modify: `apps/admin/src/components/outbox/outbox-type-menu.tsx` (import lucide dòng 5–20; `TYPE_META` dòng 61–77)
- Modify: `apps/admin/src/lib/cancellations-view.ts` (`toCancellationRow` dòng 84)
- Modify: `apps/admin/src/app/(admin)/cancellations/[code]/page.tsx` (dòng 120)
- Modify: `apps/admin/src/components/bookings/booking-detail-sections.tsx` (`CancellationHistoryRow` dòng 182–185)
- Test: `libs/shared/contract/src/schemas/outbox.spec.ts` (dòng 37–44)
- Test: `libs/shared/contract/src/schemas/bookings.spec.ts` (import dòng 1–11; thêm describe cuối file)
- Test: `apps/api/src/worker/resend.deliverer.spec.ts` (bảng `cases` dòng 36–51; describe mới sau dòng 215)
- Test: `apps/admin/src/lib/cancellations-view.spec.ts` (thêm test trong `describe('toCancellationRow')`)
- Test (chạy, không sửa): `apps/api/src/modules/outbox/admin-outbox.int.spec.ts` (dòng 182 đối chiếu `EmailTypeSchema.options` với `Object.values(EmailType)`), `apps/admin/src/components/outbox/outbox-type-menu.spec.tsx`

**Interfaces:**
- Consumes: không cần gì từ task khác. Chỉ dùng thứ đã có trong `render-email.tsx`: `field`/`f`, `subjectText`/`s`, `formatDate`, `money` (đã chặn số 0), `manageUrl`, `policyUrl`, `bookingReason`, cùng các khối `EmailShell`, `BodyParagraph`, `DataCard`, `PillValue`, `MoneyValue`, `PlainValue`, `NoteParagraph`, `CtaButton`, `accentLink` từ `./layout.js`.
- Produces:
  - Prisma: `EmailType.BOOKING_CANCELLED` (giá trị cuối enum); `CancellationRequest.reason: string | null`.
  - Contract (Hợp đồng B): `EmailTypeSchema` có `'BOOKING_CANCELLED'` ở CUỐI mảng; `CancellationRequestSchema.reason: z.string().min(1).max(1000).nullable()`.
  - Email (Hợp đồng C): `renderEmail(EmailType.BOOKING_CANCELLED, payload)` đọc `code`, `name`, `title`, `amount`, `currency`, `refunded`, `deadline`, subject là `Booking cancelled — <code>`. Có hai biến thể: đã hoàn (`refunded === true` và số tiền lớn hơn 0) và không hoàn. Task 6 ghi payload này.
  - i18n: `messages.admin.outbox.type.BOOKING_CANCELLED = 'Booking cancelled'`; `messages.admin.cancellations.noReason = 'No reason given'`.
  - Migration M1 `20260915120000_refund_deadline_expand` (spec §4.2).

- [ ] **Step 1: Kiểm môi trường DB (chỉ Docker local)**

Từ gốc worktree, trong Git Bash:

```bash
docker compose up -d postgres
echo "DATABASE_URL=${DATABASE_URL:-<chưa đặt, prisma rơi về Docker local>}"
```

Expected: service `postgres` chạy, dòng thứ hai in `DATABASE_URL=<chưa đặt, prisma rơi về Docker local>`. Nếu in ra chuỗi có `supabase` thì DỪNG, chạy `unset DATABASE_URL` rồi kiểm lại (luật 15, Global Constraints).

- [ ] **Step 2: Viết int test đỏ cho migration**

Tạo `apps/api/src/modules/bookings/refund-deadline-migration.int.spec.ts`:

```ts
import { prisma } from '../../auth/auth.config.js';

/**
 * Integration (Docker PG, db tourism_test) — migration mở rộng M1 của đợt hoàn
 * tiền một hạn chót (ADR-0041, spec 2026-09-15 §4.2).
 *
 * Kiểm trên CATALOG của Postgres chứ không qua Prisma client: client sinh từ
 * schema.prisma nên chỉ nói được schema muốn gì, không nói được DB thật đã nhận
 * gì. `ALTER FUNCTION … SET search_path` còn không có mặt trong schema.prisma,
 * nên đây là chỗ duy nhất canh nó.
 */
describe('migration 20260915120000_refund_deadline_expand', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('enum EmailType có BOOKING_CANCELLED ở CUỐI — khớp thứ tự EmailTypeSchema', async () => {
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      SELECT unnest(enum_range(NULL::"EmailType"))::text AS value
    `;
    expect(rows.at(-1)?.value).toBe('BOOKING_CANCELLED');
  });

  it('cancellation_requests.reason cho phép NULL — khách tự huỷ không bắt buộc ghi lý do', async () => {
    const rows = await prisma.$queryRaw<{ is_nullable: string }[]>`
      SELECT is_nullable::text AS is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cancellation_requests'
        AND column_name = 'reason'
    `;
    expect(rows).toEqual([{ is_nullable: 'YES' }]);
  });

  it('trigger function refunds_sum_within_total ghim search_path (mục CÒN TREO 09/09)', async () => {
    const rows = await prisma.$queryRaw<{ config: string[] | null }[]>`
      SELECT p.proconfig AS config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'refunds_sum_within_total'
    `;
    expect(rows).toEqual([{ config: ['search_path=public, pg_temp'] }]);
  });
});
```

- [ ] **Step 3: Chạy, xác nhận đỏ**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/refund-deadline-migration.int.spec.ts`

Expected: FAIL cả 3 test. Giá trị cuối enum là `EMAIL_OTP`; `is_nullable` là `NO`; `config` là `null`.

- [ ] **Step 4: Sửa `apps/api/prisma/schema.prisma`**

Trong `enum EmailType`, trước:

```prisma
  /// Mã OTP verify email — ADR-0017 §5a (đè flow link mặc định bằng plugin
  /// `emailOTP`, giữ nguyên hook afterEmailVerification cho SEC-1).
  EMAIL_OTP
}
```

sau:

```prisma
  /// Mã OTP verify email — ADR-0017 §5a (đè flow link mặc định bằng plugin
  /// `emailOTP`, giữ nguyên hook afterEmailVerification cho SEC-1).
  EMAIL_OTP
  /// Khách tự huỷ booking đã trả (ADR-0041 §4): một email, hai biến thể — đã
  /// hoàn hoặc không hoàn (quá hạn chót). Thêm ở CUỐI để thứ tự khớp
  /// `EmailTypeSchema` của contract. Ba loại CANCELLATION_* ở lại cho dữ liệu cũ.
  BOOKING_CANCELLED
}
```

Trong `model CancellationRequest`, trước:

```prisma
  reason       String                    @db.VarChar(1000)
```

sau:

```prisma
  /// Null = khách tự huỷ mà không ghi lý do (ADR-0041); yêu cầu cũ luôn có.
  reason       String?                   @db.VarChar(1000)
```

Không đổi gì khác trong schema.prisma. M1 chưa xoá hai cột `free_cancellation_days`, việc đó là của M2 ở Phụ lục A.

- [ ] **Step 5: Để Prisma sinh khung migration, rồi đổi sang tên cố định**

```bash
pnpm --filter @tourism/api exec prisma migrate dev --create-only --name refund_deadline_expand
mv apps/api/prisma/migrations/*_refund_deadline_expand apps/api/prisma/migrations/20260915120000_refund_deadline_expand
cat apps/api/prisma/migrations/20260915120000_refund_deadline_expand/migration.sql
```

Expected: `--create-only` chỉ tạo thư mục, không apply gì. `cat` in ra đúng hai câu (có thể kèm comment `-- AlterEnum`/`-- AlterTable` do Prisma sinh):

```sql
ALTER TYPE "EmailType" ADD VALUE 'BOOKING_CANCELLED';
ALTER TABLE "cancellation_requests" ALTER COLUMN "reason" DROP NOT NULL;
```

Nếu Prisma sinh thêm câu nào khác thì DỪNG và soi lại Step 4 (chỉ được đổi đúng hai chỗ). Nếu Prisma đòi `migrate reset` vì DB dev lệch lịch sử thì cũng DỪNG và báo người điều phối, không tự reset. Tên thư mục cố định lấy theo đề bài của plan; migration chưa apply ở đâu nên đổi tên lúc này an toàn.

- [ ] **Step 6: Ghi nội dung cuối cho `migration.sql`**

Ghi đè `apps/api/prisma/migrations/20260915120000_refund_deadline_expand/migration.sql` bằng:

```sql
-- Hoàn tiền một hạn chót (ADR-0041, spec 2026-09-15 §4.2) — migration MỞ RỘNG
-- M1: chỉ thêm và nới, code đang chạy không hỏng. Hai cột free_cancellation_days
-- xoá ở migration M2 riêng, sau khi code mới đã sống.
-- Migration là bản ghi bất biến: KHÔNG khai trạng thái deploy ở đây (trạng thái
-- sống ở docs/CHANGELOG.md).

-- 1. Email khi khách tự huỷ. Giá trị mới KHÔNG được dùng trong cùng migration:
--    Postgres cấm dùng giá trị enum vừa ADD VALUE trước khi giao dịch commit.
ALTER TYPE "EmailType" ADD VALUE 'BOOKING_CANCELLED';

-- 2. Khách huỷ không bắt buộc ghi lý do; các dòng cũ giữ nguyên lý do đã có.
ALTER TABLE "cancellation_requests" ALTER COLUMN "reason" DROP NOT NULL;

-- 3. Ghim search_path của trigger function tổng hoàn (ADR-0009), đóng cảnh báo
--    function_search_path_mutable của linter Supabase — mục còn treo ghi ở
--    docs/conventions/supabase-data-api-surface.md.
ALTER FUNCTION public.refunds_sum_within_total() SET search_path = public, pg_temp;
```

- [ ] **Step 7: Áp lên Docker local và generate client**

```bash
pnpm --filter @tourism/api exec prisma migrate dev
pnpm --filter @tourism/api exec prisma migrate dev
pnpm --filter @tourism/api db:generate
```

Expected:
- Lần 1 áp `20260915120000_refund_deadline_expand` và in "Your database is now in sync with your schema."
- Lần 2 in "Already in sync, no schema change or pending migration was found.", tức SQL viết tay khớp schema.prisma, không drift.
- `db:generate` in "Generated Prisma Client".

Từ sau bước này tuyệt đối không sửa `migration.sql` này nữa, kể cả comment (checksum).

- [ ] **Step 8: Chạy int test, xác nhận xanh**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/refund-deadline-migration.int.spec.ts`

Expected: PASS 3/3. Global setup đã chạy `prisma migrate deploy` lên `tourism_test`, nên db test nhận M1.

- [ ] **Step 9: Viết test contract đỏ**

Trong `libs/shared/contract/src/schemas/outbox.spec.ts`, thay nguyên test `'EmailType phủ mọi loại email mà worker biết gửi'` (dòng 37–44) bằng:

```ts
  it('EmailType phủ mọi loại email mà worker biết gửi', () => {
    expect(EmailTypeSchema.options).toContain('BOOKING_CONFIRMATION');
    expect(EmailTypeSchema.options).toContain('EMAIL_OTP');
    // ADR-0031 §6 thêm `REVIEW_REJECTED` — bác một review mà im lặng là để
    // khách đợi một thứ không bao giờ tới.
    expect(EmailTypeSchema.options).toContain('REVIEW_REJECTED');
    // ADR-0041 thêm `BOOKING_CANCELLED` ở CUỐI cho khớp enum Prisma — int test
    // của API so hai mảng theo đúng thứ tự.
    expect(EmailTypeSchema.options.at(-1)).toBe('BOOKING_CANCELLED');
    expect(EmailTypeSchema.options).toHaveLength(15);
  });
```

Trong `libs/shared/contract/src/schemas/bookings.spec.ts`, thêm `CancellationRequestSchema` vào khối import từ `'./bookings.js'`:

```ts
import {
  AdminBookingsListQuerySchema,
  AdminCancellationsListQuerySchema,
  AdminRefundInputSchema,
  BookingSchema,
  BookingsListQuerySchema,
  CancelBookingInputSchema,
  CancellationRequestSchema,
  CreateBookingInputSchema,
  DecideCancellationInputSchema,
  PaymentProviderSchema,
} from './bookings.js';
```

rồi thêm vào CUỐI file:

```ts
/**
 * ADR-0041: khách tự huỷ không bắt buộc ghi lý do, nên dòng yêu cầu huỷ mang
 * `reason` null. Chỉ nới đúng chỗ này — chuỗi rỗng vẫn là dữ liệu hỏng.
 */
describe('CancellationRequestSchema.reason — ADR-0041', () => {
  const selfCancelled = {
    id: '4f2a1b3c-0000-4000-8000-000000000002',
    bookingCode: 'BK-7Q2M9XKD',
    reason: null,
    status: 'REFUNDED',
    freeCancellationDays: null,
    decisionNote: null,
    decidedAt: '2026-09-15T03:00:00.000Z',
    createdAt: '2026-09-15T03:00:00.000Z',
  };

  it('null hợp lệ — khách huỷ mà không ghi lý do', () => {
    expect(CancellationRequestSchema.parse(selfCancelled).reason).toBeNull();
  });

  it('vẫn nhận lý do thật, vẫn từ chối chuỗi rỗng và chuỗi quá 1000 ký tự', () => {
    expect(
      CancellationRequestSchema.parse({ ...selfCancelled, reason: 'Change of plans' }).reason,
    ).toBe('Change of plans');
    expect(CancellationRequestSchema.safeParse({ ...selfCancelled, reason: '' }).success).toBe(
      false,
    );
    expect(
      CancellationRequestSchema.safeParse({ ...selfCancelled, reason: 'x'.repeat(1001) }).success,
    ).toBe(false);
  });

  it('khoá vẫn bắt buộc có mặt — nullable chứ không optional', () => {
    const { reason: _drop, ...missing } = selfCancelled;
    expect(CancellationRequestSchema.safeParse(missing).success).toBe(false);
  });
});
```

- [ ] **Step 10: Chạy, xác nhận đỏ**

Run: `pnpm --filter @tourism/contract exec vitest run src/schemas/outbox.spec.ts src/schemas/bookings.spec.ts`

Expected: FAIL 2 test.
- `EmailType phủ mọi loại email mà worker biết gửi`: phần tử cuối là `'EMAIL_OTP'`, độ dài 14.
- `null hợp lệ — khách huỷ mà không ghi lý do`: ZodError, `reason` phải là string.

- [ ] **Step 11: Cài đặt contract**

`libs/shared/contract/src/schemas/outbox.ts`, trước:

```ts
  'EMAIL_VERIFICATION',
  'EMAIL_OTP',
]);
```

sau:

```ts
  'EMAIL_VERIFICATION',
  'EMAIL_OTP',
  // ADR-0041: khách tự huỷ — thêm ở CUỐI, cùng vị trí với enum Prisma.
  'BOOKING_CANCELLED',
]);
```

`libs/shared/contract/src/schemas/bookings.ts`, trong `CancellationRequestSchema`, trước:

```ts
  bookingCode: BookingCodeSchema,
  reason: z.string().min(1).max(1000),
  status: CancellationRequestStatusSchema,
```

sau:

```ts
  bookingCode: BookingCodeSchema,
  /**
   * Lý do khách ghi. `null` = khách tự huỷ mà không ghi (ADR-0041 — lý do không
   * bắt buộc); yêu cầu tạo trước đợt này luôn có lý do.
   */
  reason: z.string().min(1).max(1000).nullable(),
  status: CancellationRequestStatusSchema,
```

- [ ] **Step 12: Chạy, xác nhận xanh**

Run: `pnpm --filter @tourism/contract exec vitest run src/schemas/outbox.spec.ts src/schemas/bookings.spec.ts`

Expected: PASS toàn bộ.

- [ ] **Step 13: i18n, rồi build contract và i18n**

Trong `libs/shared/i18n/src/lib/messages.ts`, khối `admin.cancellations`, trước:

```ts
      /** Nhãn enum dùng CHUNG với lịch sử trên trang chi tiết booking. */
      status: CANCELLATION_STATUS_COPY,
```

sau:

```ts
      /** Nhãn enum dùng CHUNG với lịch sử trên trang chi tiết booking. */
      status: CANCELLATION_STATUS_COPY,
      /**
       * Khách tự huỷ không bắt buộc ghi lý do (ADR-0041) — hàng đợi và dialog
       * in câu này thay cho một ô trống không rõ nghĩa.
       */
      noReason: 'No reason given',
```

Khối `admin.outbox.type`, trước:

```ts
        EMAIL_VERIFICATION: 'Email verification',
        EMAIL_OTP: 'Email verification code',
      },
```

sau:

```ts
        EMAIL_VERIFICATION: 'Email verification',
        EMAIL_OTP: 'Email verification code',
        BOOKING_CANCELLED: 'Booking cancelled',
      },
```

```bash
pnpm --filter @tourism/contract build
pnpm --filter @tourism/i18n build
```

Expected: cả hai build xong không lỗi.

- [ ] **Step 14: Viết test admin đỏ**

Trong `apps/admin/src/lib/cancellations-view.spec.ts`, thêm test sau vào cuối `describe('toCancellationRow', …)`, ngay sau test `'ngày khởi hành tách CHUỖI, …'`:

```ts
  it('khách tự huỷ không ghi lý do (ADR-0041) → hàng in câu thay thế, không để ô trống', () => {
    const row = toCancellationRow({
      ...REQUESTED,
      reason: null,
      status: 'REFUNDED',
      decidedAt: '2026-09-15T03:00:00.000Z',
    });
    expect(row.reason).toBe(messages.admin.cancellations.noReason);
  });
```

- [ ] **Step 15: Chạy, xác nhận đỏ**

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/cancellations-view.spec.ts src/components/outbox/outbox-type-menu.spec.tsx`

Expected: FAIL.
- `cancellations-view.spec.ts`: test mới nhận `null` thay vì `'No reason given'`.
- `outbox-type-menu.spec.tsx`: cả file nổ lúc import với `TypeError: Cannot read properties of undefined (reading 'family')`, vì `TYPE_GROUPS` duyệt `EmailTypeSchema.options` giờ có `BOOKING_CANCELLED` mà `TYPE_META` chưa khai.

- [ ] **Step 16: Cài đặt admin**

`apps/admin/src/components/outbox/outbox-type-menu.tsx`, khối import lucide, trước:

```ts
  StarIcon,
  TicketIcon,
} from 'lucide-react';
```

sau:

```ts
  StarIcon,
  TicketIcon,
  TicketXIcon,
} from 'lucide-react';
```

`TYPE_META`, trước:

```ts
  CANCELLATION_DENIED: { family: 'cancellation', icon: ShieldXIcon },
```

sau:

```ts
  CANCELLATION_DENIED: { family: 'cancellation', icon: ShieldXIcon },
  // ADR-0041: email huỷ DUY NHẤT còn phát sinh (khách tự huỷ); ba loại trên ở
  // lại để lọc dữ liệu cũ. Luật 1 không có glyph sẵn cho "booking đã huỷ" dùng
  // được: `CircleXIcon` của tab CANCELLED bên /bookings trùng tab FAILED của
  // chính toolbar này (luật 2). Nên lấy `ticket-x` — vé (booking) bị gạch.
  BOOKING_CANCELLED: { family: 'cancellation', icon: TicketXIcon },
```

`apps/admin/src/lib/cancellations-view.ts`, trong `toCancellationRow`, trước:

```ts
    reason: request.reason,
```

sau:

```ts
    // Khách tự huỷ không bắt buộc ghi lý do (ADR-0041): in câu thay thế thay vì
    // ô trống — cột này và `title` của nó đều cần một chuỗi.
    reason: request.reason ?? t.noReason,
```

`apps/admin/src/app/(admin)/cancellations/[code]/page.tsx`, trước:

```tsx
                    reason: open.reason,
```

sau:

```tsx
                    // Yêu cầu còn MỞ luôn do luồng cũ tạo nên có lý do; vế `??`
                    // chỉ để kiểu `string | null` của contract (ADR-0041) qua được.
                    reason: open.reason ?? messages.admin.cancellations.noReason,
```

`apps/admin/src/components/bookings/booking-detail-sections.tsx`, trong `CancellationHistoryRow`, trước:

```tsx
      <p>
        <span className="text-muted-foreground">{t.cancellations.reason}: </span>
        {request.reason}
      </p>
```

sau:

```tsx
      {/* Khách tự huỷ không bắt buộc ghi lý do (ADR-0041) — vắng thì bỏ hẳn
          dòng, cùng nếp `decisionNote` ngay dưới. */}
      {request.reason ? (
        <p>
          <span className="text-muted-foreground">{t.cancellations.reason}: </span>
          {request.reason}
        </p>
      ) : null}
```

- [ ] **Step 17: Chạy, xác nhận xanh**

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/cancellations-view.spec.ts src/components/outbox/outbox-type-menu.spec.tsx`

Expected: PASS toàn bộ. Test `'mở ra có ĐỦ 13 loại email …'` giờ duyệt 15 loại và đếm 16 `menuitemradio`.

- [ ] **Step 18: Viết test email đỏ**

Trong `apps/api/src/worker/resend.deliverer.spec.ts`, bảng `cases` của `describe('renderEmail type → subject mapping')`, trước:

```ts
    [EmailType.EMAIL_OTP, /verification code/i],
  ];
```

sau:

```ts
    [EmailType.EMAIL_OTP, /verification code/i],
    [EmailType.BOOKING_CANCELLED, /Booking cancelled — BK-1/],
  ];
```

Thêm describe mới ngay SAU `describe('renderEmail — duyệt huỷ mà KHÔNG hoàn đồng nào (ADR-0029 §AMEND 3)', …)` và TRƯỚC `describe('renderEmail payload rendering', …)`:

```ts
describe('renderEmail — khách tự huỷ (BOOKING_CANCELLED, ADR-0041)', () => {
  // Payload đúng Hợp đồng C của plan 15/09 — lõi huỷ (Task 6) ghi đúng bộ khoá này.
  const REFUNDED = {
    ...BOOKING_PAYLOAD,
    amount: '117.00',
    refunded: true,
    deadline: '2026-10-17',
    initiator: 'customer',
  };
  const NOT_REFUNDED = { ...REFUNDED, amount: '0.00', refunded: false };

  it('trong hạn: in số tiền đã hoàn, nơi tiền về và thời gian tiền về', async () => {
    const { subject, html } = await renderEmail(EmailType.BOOKING_CANCELLED, REFUNDED);

    expect(subject).toBe('Booking cancelled — BK-1');
    expect(html).toContain('Refund issued');
    expect(html).toContain('117.00');
    expect(html).toContain('Original payment method');
    expect(html).toContain('business days');
    // Biến thể đã hoàn không nhắc hạn chót — khách không cần biết luật khi đã được hoàn đủ.
    expect(html).not.toContain('free-cancellation deadline');
  });

  it('quá hạn: KHÔNG in tiền, nói rõ hạn chót đã qua kèm ngày, mở cửa ngoại lệ', async () => {
    const { subject, html } = await renderEmail(
      EmailType.BOOKING_CANCELLED,
      NOT_REFUNDED,
      OPTS.frontendUrl,
    );

    expect(subject).toBe('Booking cancelled — BK-1');
    expect(html).not.toContain('Refund issued');
    expect(html).not.toContain('0.00');
    expect(html).toContain('free-cancellation deadline');
    expect(html).toContain('Oct 17, 2026');
    // Ngoại lệ đi qua đội hỗ trợ (ADR-0041 §5) — mail phải chỉ đường tới chính sách.
    expect(html).toContain('/cancellation-policy');
  });

  it('cờ refunded lệch với số tiền 0 → vẫn là biến thể không hoàn, không loan báo khoản bằng 0', async () => {
    const { html } = await renderEmail(EmailType.BOOKING_CANCELLED, {
      ...REFUNDED,
      amount: '0.00',
    });

    expect(html).not.toContain('Refund issued');
    expect(html).not.toContain('0.00');
  });
});
```

- [ ] **Step 19: Chạy, xác nhận đỏ**

Run: `pnpm --filter @tourism/api exec vitest run src/worker/resend.deliverer.spec.ts`

Expected: FAIL. Các test có `BOOKING_CANCELLED` (subject mapping, layout chung, ba test của describe mới) ném `No email template for type BOOKING_CANCELLED` từ nhánh `default` của `buildEmail`.

- [ ] **Step 20: Cài đặt case email**

Trong `apps/api/src/worker/emails/render-email.tsx`, chèn ngay sau khối `case EmailType.CANCELLATION_DENIED: …` (kết thúc bằng `};` của `return`) và trước `case EmailType.NEWSLETTER_WELCOME: {`:

```tsx
    /**
     * Khách tự huỷ (ADR-0041 §4) — email đi SAU khi mọi thứ đã xong trong một
     * giao dịch, nên không hứa "đang xem xét" gì. Hai biến thể:
     *
     * - Đã hoàn: cờ `refunded` VÀ `money` cùng có. `money` đã chặn số 0 cho mọi
     *   loại mail (xem trên), nên payload lệch (cờ true, amount '0.00') rơi về
     *   biến thể không hoàn thay vì loan báo một khoản tiền bằng không.
     * - Không hoàn (quá hạn chót): nói rõ hạn chót đã qua, kèm ngày, và mở cửa
     *   ngoại lệ qua đội hỗ trợ (§5 — hoàn thiện chí).
     *
     * P4e-1 thêm biến thể công ty huỷ chuyến theo `initiator`.
     */
    case EmailType.BOOKING_CANCELLED: {
      const refunded = payload.refunded === true && money !== undefined;
      const deadline = formatDate(f('deadline'));
      return {
        subject: `Booking cancelled — ${subjectCode}`,
        node: (
          <EmailShell
            preview={
              refunded
                ? `Booking ${code} is cancelled and your refund is on its way.`
                : `Booking ${code} is cancelled.`
            }
            heading="Your booking is cancelled"
            note={
              refunded ? (
                <NoteParagraph>
                  The refund typically appears within 5–10 business days, depending on your bank.
                </NoteParagraph>
              ) : (
                <NoteParagraph>
                  Something serious happened? Reply to this email and our team will review your
                  case.{' '}
                  {policyUrl ? (
                    <a href={policyUrl} style={accentLink}>
                      See our cancellation policy
                    </a>
                  ) : null}
                </NoteParagraph>
              )
            }
            footerReason={bookingReason}
          >
            <BodyParagraph>
              {name ? `Hi ${name}, we` : 'We'}&#39;ve cancelled your booking <strong>{code}</strong>
              {title ? ` (${title})` : ''}
              {refunded ? ' and refunded your payment' : ''}.
            </BodyParagraph>
            <DataCard
              rows={[
                ['Status', <PillValue key="v">Cancelled</PillValue>],
                ...(refunded
                  ? ([
                      ['Refund issued', <MoneyValue key="v">{money}</MoneyValue>],
                      ['Returns to', <PlainValue key="v">Original payment method</PlainValue>],
                    ] as Array<[string, ReactNode]>)
                  : ([
                      [
                        'Refund',
                        <PlainValue key="v">
                          {deadline
                            ? `None — the free-cancellation deadline (${deadline}) had passed`
                            : 'None — the free-cancellation deadline had passed'}
                        </PlainValue>,
                      ],
                    ] as Array<[string, ReactNode]>)),
              ]}
            />
            {manageUrl ? <CtaButton href={manageUrl}>View my booking</CtaButton> : null}
          </EmailShell>
        ),
      };
    }
```

- [ ] **Step 21: Chạy, xác nhận xanh (email + đối chiếu enum)**

```bash
pnpm --filter @tourism/api exec vitest run src/worker/resend.deliverer.spec.ts
pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/outbox/admin-outbox.int.spec.ts
```

Expected: PASS cả hai. Test `covers every EmailType enum value` đếm 15 dòng khớp 15 giá trị; int test dòng 182 thấy `EmailTypeSchema.options` bằng `Object.values(EmailType)` theo đúng thứ tự.

- [ ] **Step 22: Format và soát diff**

```bash
pnpm lint:fix
git status --short
git diff --stat
```

Expected: `git status` chỉ có đúng các file ở mục **Files** (client Prisma trong `apps/api/src/generated/` bị gitignore nên không hiện; `docs/screenshot/` nếu có thì bỏ qua, không add).

- [ ] **Step 23: Cổng đầy đủ**

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: tất cả xanh.

- [ ] **Step 24: Commit**

```bash
git add \
  apps/api/prisma/schema.prisma \
  apps/api/prisma/migrations/20260915120000_refund_deadline_expand/migration.sql \
  apps/api/src/modules/bookings/refund-deadline-migration.int.spec.ts \
  apps/api/src/worker/emails/render-email.tsx \
  apps/api/src/worker/resend.deliverer.spec.ts \
  libs/shared/contract/src/schemas/outbox.ts \
  libs/shared/contract/src/schemas/outbox.spec.ts \
  libs/shared/contract/src/schemas/bookings.ts \
  libs/shared/contract/src/schemas/bookings.spec.ts \
  libs/shared/i18n/src/lib/messages.ts \
  apps/admin/src/components/outbox/outbox-type-menu.tsx \
  apps/admin/src/lib/cancellations-view.ts \
  apps/admin/src/lib/cancellations-view.spec.ts \
  'apps/admin/src/app/(admin)/cancellations/[code]/page.tsx' \
  apps/admin/src/components/bookings/booking-detail-sections.tsx
git commit -m "feat(refund): migration M1, email BOOKING_CANCELLED và lý do huỷ cho phép null"
```
---

### Task 3: Thước ngày Việt Nam cho các gate hiện có

**Files:**
- Create: `apps/api/src/lib/vietnam-date-sql.ts`
- Test (Create): `apps/api/src/lib/vietnam-date-sql.int.spec.ts`
- Modify: `apps/api/src/auth/account.service.ts` — import dòng 10; chữ ký `deleteAccount` dòng 93; khối dòng 131–133.
- Test (Modify): `apps/api/src/auth/account-delete.int.spec.ts` — import dòng 1–5; helper `createBooking` dòng 69–96; test `4b` dòng 179–193; thêm test `4d` ngay sau test `4c` (hết dòng 213).
- Modify: `apps/api/src/modules/bookings/bookings.service.ts` — import dòng 12–17 và 30; `estimateRefund` dòng 228–231; khối `todayUtc` dòng 292–300; JSDoc `create` dòng 321–325 và gate dòng 366–373; gate `reCheckout` dòng 531–544; CTE claim dòng 903–910; nhánh phân loại dòng 973–978.
- Modify: `apps/api/src/modules/catalog/catalog.service.ts` — import dòng 2–14; `startOfTodayUtc` dòng 32–33; lọc list dòng 165–172; lọc detail dòng 205–211.
- KHÔNG đụng: `apps/api/src/modules/reviews/review-eligibility.ts`, chuỗi ngày dashboard (`apps/api/src/modules/stats/stats-math.ts`, `stats-aggregates.ts`), `apps/api/src/modules/bookings/cancellations.service.ts#request` (dòng 180 còn so UTC, bị xoá ở Task 6).

**Interfaces:**
- Consumes: `vietnamToday`, `VIETNAM_TIME_ZONE` từ `@tourism/contract` (Task 1, qua `dist`); `calendarDate`, `startOfDayUtc` từ `apps/api/src/lib/calendar-date.ts`; `Prisma.sql`, `Prisma.raw`, kiểu `Prisma.Sql` từ `apps/api/src/generated/prisma/client.js` (đã kiểm: `internal/prismaNamespace.ts` export `sql`, `raw`).
- Produces:
  - `vietnamDateSql(instant: Prisma.Sql): Prisma.Sql` — Hợp đồng F, `apps/api/src/lib/vietnam-date-sql.ts`.
  - `AccountService.deleteAccount(userId: string, password: string, now: Date = new Date()): Promise<void>` — Hợp đồng F; controller (`account.controller.ts:44`) và `worker/enquiry-retention.int.spec.ts:137` vẫn gọi hai tham số.
  - Helper KHÔNG export trong `catalog.service.ts`: `startOfVietnamToday(now: Date): Date` (Task 5 dùng lại).
  - Gỡ: `todayUtc` (bookings.service.ts), `startOfTodayUtc` (catalog.service.ts).

- [ ] **Step 1: Bảo đảm `dist` của contract có hàm Task 1**

Run (Git Bash, gốc repo):

```bash
pnpm --filter @tourism/contract build
pnpm --filter @tourism/i18n build
```

Expected: exit 0; `libs/shared/contract/dist/schemas/refund-policy.js` có `vietnamToday` và `VIETNAM_TIME_ZONE`.

- [ ] **Step 2: Viết int test đỏ cho thước SQL** — tạo `apps/api/src/lib/vietnam-date-sql.int.spec.ts`:

```ts
import { vietnamToday } from '@tourism/contract';
import { prisma } from '../auth/auth.config.js';
import { Prisma } from '../generated/prisma/client.js';
import { vietnamDateSql } from './vietnam-date-sql.js';

/**
 * Thước ngày Việt Nam phía SQL (ADR-0041 §7) phải trùng từng ngày với
 * `vietnamToday` phía Node: hai thước lệch nhau là claim nhận một chuyến mà
 * `create` đã coi là khởi hành, hoặc ngược lại. Chạy trên Postgres thật vì phép
 * đổi múi giờ do DB làm chứ không phải Node.
 */
describe('vietnamDateSql — thước ngày Việt Nam phía SQL (ADR-0041 §7)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Ngày (text `YYYY-MM-DD`) mà Postgres tính cho một biểu thức mốc thời gian. */
  async function sqlDay(instant: Prisma.Sql): Promise<string> {
    const [row] = await prisma.$queryRaw<{ day: string }[]>(
      Prisma.sql`SELECT (${vietnamDateSql(instant)})::text AS day`,
    );
    if (!row) throw new Error('vietnamDateSql: truy vấn không trả dòng nào');
    return row.day;
  }

  it.each([
    '2026-10-19T16:59:59.000Z', // 23:59:59 ngày 19/10 giờ VN
    '2026-10-19T17:00:00.000Z', // 00:00 ngày 20/10 giờ VN
    '2026-10-19T23:30:00.000Z', // 06:30 ngày 20/10 giờ VN, UTC vẫn là 19/10
    '2026-12-31T17:00:00.000Z', // giao thừa giờ VN
  ])('mốc %s: ngày SQL trùng vietnamToday', async (iso) => {
    // Chuỗi ISO có `Z` rồi ép `timestamptz` ở SQL — không phụ thuộc cách adapter
    // tuần tự hoá một `Date`.
    expect(await sqlDay(Prisma.sql`${iso}::timestamptz`)).toBe(vietnamToday(new Date(iso)));
  });

  it('không phụ thuộc TimeZone của session DB', async () => {
    const iso = '2026-10-19T17:00:00.000Z';
    const day = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE 'America/Los_Angeles'`);
      const instant = Prisma.sql`${iso}::timestamptz`;
      const [row] = await tx.$queryRaw<{ day: string }[]>(
        Prisma.sql`SELECT (${vietnamDateSql(instant)})::text AS day`,
      );
      return row?.day;
    });
    // 10:00 ngày 19/10 ở Los Angeles, nhưng đã là 00:00 ngày 20/10 giờ Việt Nam.
    expect(day).toBe('2026-10-20');
  });

  it('now() của DB ra đúng ngày Việt Nam hiện tại', async () => {
    const before = vietnamToday(new Date());
    const day = await sqlDay(Prisma.sql`now()`);
    const after = vietnamToday(new Date());
    // Chạy đúng lúc nửa đêm giờ VN thì hai đầu có thể khác ngày — nhận cả hai.
    expect([before, after]).toContain(day);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận đỏ** (Docker Postgres đang chạy)

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/lib/vietnam-date-sql.int.spec.ts`

Expected: FAIL — cả file không nạp được vì chưa có `./vietnam-date-sql.js` (`Failed to load url ./vietnam-date-sql.js` / `Cannot find module`).

- [ ] **Step 4: Cài đặt `vietnamDateSql`** — tạo `apps/api/src/lib/vietnam-date-sql.ts`:

```ts
import { VIETNAM_TIME_ZONE } from '@tourism/contract';
import { Prisma } from '../generated/prisma/client.js';

/**
 * Biểu thức SQL ra NGÀY LỊCH Việt Nam của một mốc thời gian — bản SQL của
 * `vietnamToday` ở contract (ADR-0041 §7). Ví dụ: `vietnamDateSql(Prisma.sql\`now()\`)`.
 *
 * `timestamptz AT TIME ZONE '<vùng>'` cho giờ đồng hồ treo tường ở vùng đó rồi
 * `::date` cắt lấy ngày, nên kết quả KHÔNG phụ thuộc TimeZone của session DB.
 * Tên vùng lấy từ hằng của contract để Node và SQL đọc chung MỘT nguồn; chèn
 * bằng `Prisma.raw` vì đó là hằng trong mã nguồn chứ không phải dữ liệu người
 * dùng, và câu SQL ra đúng nguyên văn `AT TIME ZONE 'Asia/Ho_Chi_Minh'` của
 * spec §4.1.
 *
 * SQL chỉ dùng thước này cho phép so "chưa khởi hành"; luật N của hạn chót chỉ
 * sống ở Node (spec §4.1), không viết lại ở đây.
 */
export function vietnamDateSql(instant: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((${instant}) AT TIME ZONE ${Prisma.raw(`'${VIETNAM_TIME_ZONE}'`)})::date`;
}
```

- [ ] **Step 5: Chạy test, xác nhận xanh**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/lib/vietnam-date-sql.int.spec.ts`

Expected: PASS — 6 test (4 mốc cố định, 1 session TimeZone, 1 `now()`).

- [ ] **Step 6: Viết test đỏ cho gate xoá tài khoản — import** — trong `apps/api/src/auth/account-delete.int.spec.ts`, thay khối dòng 1–5:

Trước:

```ts
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { EmailType } from '../generated/prisma/enums.js';
import { prisma } from './auth.config.js';
```

Sau:

```ts
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { vietnamToday } from '@tourism/contract';
import { AppModule } from '../app.module.js';
import { EmailType } from '../generated/prisma/enums.js';
import { startOfDayUtc } from '../lib/calendar-date.js';
import { AccountHasPaidBookingsError, AccountService } from './account.service.js';
import { prisma } from './auth.config.js';
```

- [ ] **Step 7: Viết test đỏ — helper nhận ngày khởi hành cố định** — cùng file, trong `createBooking` (dòng 69–96):

Trước:

```ts
  /** Booking tối thiểu cho user — status + ngày khởi hành cấu hình được. */
  async function createBooking(
    userId: string,
    email: string,
    opts: {
      status: 'PAID' | 'CANCELLED' | 'PARTIALLY_REFUNDED' | 'PENDING';
      departureInDays: number;
      /** Hạn session thanh toán (PENDING) — mặc định null. */
      checkoutSessionExpiresAt?: Date;
    },
  ) {
```

Sau:

```ts
  /** Booking tối thiểu cho user — status + ngày khởi hành cấu hình được. */
  async function createBooking(
    userId: string,
    email: string,
    opts: {
      status: 'PAID' | 'CANCELLED' | 'PARTIALLY_REFUNDED' | 'PENDING';
      departureInDays: number;
      /**
       * Ngày khởi hành cố định (00:00 UTC của một ngày lịch), THẮNG
       * `departureInDays`. Dùng khi test cần đúng một ngày lịch Việt Nam thay vì
       * "bây giờ + n ngày" cắt theo UTC.
       */
      startDate?: Date;
      /** Hạn session thanh toán (PENDING) — mặc định null. */
      checkoutSessionExpiresAt?: Date;
    },
  ) {
```

Và dòng 94:

Trước:

```ts
    const start = new Date(Date.now() + opts.departureInDays * 864e5);
```

Sau:

```ts
    const start = opts.startDate ?? new Date(Date.now() + opts.departureInDays * 864e5);
```

- [ ] **Step 8: Viết test đỏ — giữ test `4b` đúng ở mọi giờ chạy** — cùng file, đầu test `4b` (dòng 179–182):

Trước:

```ts
  it('4b. PAID khởi hành HÔM NAY (chuyến đang chạy) và PARTIALLY_REFUNDED đã đi xong → đều 409 (ADR-0017 §7b, câu gốc)', async () => {
    // Biên ngày: endDate = hôm nay >= hôm nay → chưa kết thúc → chặn.
    const a = await createUserAndSignIn('paid-today@example.com');
    await createBooking(a.userId, 'paid-today@example.com', { status: 'PAID', departureInDays: 0 });
```

Sau:

```ts
  it('4b. PAID khởi hành HÔM NAY (chuyến đang chạy) và PARTIALLY_REFUNDED đã đi xong → đều 409 (ADR-0017 §7b, câu gốc)', async () => {
    // Biên ngày: endDate = hôm nay >= hôm nay → chưa kết thúc → chặn. "Hôm nay"
    // là ngày Việt Nam (ADR-0041 §7): `Date.now()` cắt UTC rơi vào HÔM QUA giờ
    // VN trong khung 00:00–06:59, và test sẽ đỏ theo giờ chạy.
    const a = await createUserAndSignIn('paid-today@example.com');
    await createBooking(a.userId, 'paid-today@example.com', {
      status: 'PAID',
      departureInDays: 0,
      startDate: startOfDayUtc(vietnamToday(new Date())),
    });
```

- [ ] **Step 9: Viết test đỏ — gate so ngày Việt Nam, tất định qua `now`** — cùng file, thêm ngay sau test `4c` (sau dòng 213):

```ts
  it('4d. gate PAID so ngày về theo NGÀY VIỆT NAM, tất định qua tham số `now` (ADR-0041 §7)', async () => {
    const email = 'vietnam-day@example.com';
    const { userId } = await createUserAndSignIn(email);
    // Chuyến một ngày 19/10/2026: ngày về cũng là 19/10.
    await createBooking(userId, email, {
      status: 'PAID',
      departureInDays: 0,
      startDate: new Date('2026-10-19T00:00:00.000Z'),
    });
    const account = app.get(AccountService);

    // 16:30Z = 23:30 ngày 19/10 giờ VN: chuyến chưa hết ngày về → chặn.
    await expect(
      account.deleteAccount(userId, PASSWORD, new Date('2026-10-19T16:30:00.000Z')),
    ).rejects.toBeInstanceOf(AccountHasPaidBookingsError);

    // 17:30Z = 00:30 ngày 20/10 giờ VN: chuyến đã kết thúc → xoá được. Thước UTC
    // cũ vẫn thấy 19/10 nên chặn nhầm thêm 7 tiếng.
    await expect(
      account.deleteAccount(userId, PASSWORD, new Date('2026-10-19T17:30:00.000Z')),
    ).resolves.toBeUndefined();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.deletedAt).not.toBeNull();
  });
```

- [ ] **Step 10: Chạy test, xác nhận đỏ**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/auth/account-delete.int.spec.ts`

Expected: FAIL đúng một test — `4d`: lời gọi thứ hai `rejects` với `AccountHasPaidBookingsError` thay vì `resolves`, vì `deleteAccount` hiện bỏ qua tham số thứ ba và so bằng đồng hồ thật (hôm nay ≤ 19/10/2026). Các test khác PASS. (Vitest chạy qua SWC nên lời gọi ba tham số chưa bị typecheck chặn ở bước này.)

- [ ] **Step 11: Cài đặt tham số `now` trong `apps/api/src/auth/account.service.ts`**

Import — trước (dòng 1–10, trích phần đổi):

```ts
import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env.js';
```

```ts
import { calendarDate, startOfDayUtc } from '../lib/calendar-date.js';
```

Sau:

```ts
import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { vietnamToday } from '@tourism/contract';
import { env } from '../config/env.js';
```

```ts
import { startOfDayUtc } from '../lib/calendar-date.js';
```

Chữ ký — trước (dòng 93):

```ts
  async deleteAccount(userId: string, password: string): Promise<void> {
```

Sau:

```ts
  /**
   * `now` là tham số để test gate ngày tất định (ADR-0041 §7). Controller không
   * truyền nên production dùng đồng hồ server; mọi mốc của lần xoá (gate ngày,
   * hạn session PENDING, `deletedAt`, hàng dọn media) đọc chung mốc này.
   */
  async deleteAccount(userId: string, password: string, now: Date = new Date()): Promise<void> {
```

Khối mốc — trước (dòng 129–133):

```ts
    // Email tombstone unique-per-delete → email gốc được GIẢI PHÓNG (citext
    // unique) cho người khác (hoặc chính chủ) đăng ký lại.
    const tombstoneEmail = `deleted+${randomUUID()}@tombstone.local`;
    const today = startOfDayUtc(calendarDate(new Date()));
    const now = new Date();
```

Sau:

```ts
    // Email tombstone unique-per-delete → email gốc được GIẢI PHÓNG (citext
    // unique) cho người khác (hoặc chính chủ) đăng ký lại.
    const tombstoneEmail = `deleted+${randomUUID()}@tombstone.local`;
    // "Chuyến chưa kết thúc" so theo NGÀY VIỆT NAM (ADR-0041 §7): `departure_end_date`
    // là ngày lịch VN, thước UTC cũ giữ khách thêm tới 7 tiếng sau ngày về. 00:00
    // UTC của ngày ấy là khuôn Prisma dùng cho cột `@db.Date`.
    const today = startOfDayUtc(vietnamToday(now));
```

(Bộ đếm sai mật khẩu `failedAttempts` vẫn dùng `Date.now()` như cũ — nó không phải gate ngày chuyến.)

- [ ] **Step 12: Chạy test, xác nhận xanh**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/auth/account-delete.int.spec.ts src/worker/enquiry-retention.int.spec.ts`

Expected: PASS cả hai file (`enquiry-retention` gọi `deleteAccount` hai tham số, canh default của `now`).

- [ ] **Step 13: Chuyển các gate ở `apps/api/src/modules/bookings/bookings.service.ts`** — sáu chỗ sửa:

(a) Import — trước (dòng 12–17 và 30):

```ts
import {
  daysBeforeDeparture,
  isWithinGracePeriod,
  policyRefundAmount,
  refundPercentForRequest,
} from '@tourism/contract';
```

```ts
import { toPaged } from '../../lib/paged.js';
```

Sau:

```ts
import {
  daysBeforeDeparture,
  isWithinGracePeriod,
  policyRefundAmount,
  refundPercentForRequest,
  vietnamToday,
} from '@tourism/contract';
```

```ts
import { toPaged } from '../../lib/paged.js';
import { vietnamDateSql } from '../../lib/vietnam-date-sql.js';
```

(b) `estimateRefund` — trước (dòng 228–231):

```ts
  if (booking.status !== BookingStatus.PAID) return null;
  const now = new Date();
  const departureDay = calendarDate(booking.departureStartDate);
  if (departureDay < todayUtc()) return null; // chuyến đã đi
```

Sau:

```ts
  if (booking.status !== BookingStatus.PAID) return null;
  const now = new Date();
  const departureDay = calendarDate(booking.departureStartDate);
  // "Đã đi" so với hôm nay theo giờ Việt Nam (ADR-0041 §7).
  if (departureDay < vietnamToday(now)) return null; // chuyến đã đi
```

(c) Xoá `todayUtc` — trước (dòng 292–300):

```ts
/**
 * "Hôm nay" theo UTC — MỘT thước cho mọi gate "chuyến đã đi chưa" ở tầng Node
 * (`create`, `reCheckout`, phân loại claim, `estimateRefund`), khớp với
 * `(now() AT TIME ZONE 'UTC')::date` trong CTE claim (ADR-0009 AMEND 2).
 * `start_date` là `@db.Date` ngày lịch của điểm khởi hành (VN, UTC+7), nên
 * "đã đi" theo UTC rộng hơn đời thật đúng 7 giờ — cùng lề với luật walk-in
 * cùng ngày của `create`, chấp nhận có chủ đích.
 */
const todayUtc = (): string => new Date().toISOString().slice(0, 10);
```

Sau:

```ts
// Thước ngày của mọi gate "chuyến đã đi chưa" (`create`, `reCheckout`, phân loại
// claim, `estimateRefund`) là NGÀY VIỆT NAM (ADR-0041 §7, thay thước UTC của
// ADR-0009 AMEND 2): `vietnamToday(now)` ở Node, `vietnamDateSql` trong CTE
// claim. `start_date` là ngày lịch VN; thước UTC từng để tour một ngày còn
// "chưa đi" tới 06:59 sáng hôm sau.
```

(d) `create` — JSDoc, trước (dòng 321–325):

```ts
   * Validation (giữ nguyên semantics đã port): departure tồn tại, tour của nó
   * đã published, status OPEN, và chưa DEPARTED — same-day vẫn book được
   * (walk-in, rule Nexora); chỉ startDate strictly-past mới reject. So sánh
   * calendar-date string kiểu UTC (`@db.Date` load thành nửa đêm UTC) độc lập
   * với timezone của server.
```

Sau:

```ts
   * Validation (giữ nguyên semantics đã port): departure tồn tại, tour của nó
   * đã published, status OPEN, và chưa DEPARTED — same-day vẫn book được
   * (walk-in, rule Nexora); chỉ startDate strictly-past mới reject. "Hôm nay"
   * là ngày Việt Nam (`vietnamToday`, ADR-0041 §7); `@db.Date` load thành nửa
   * đêm UTC nên `calendarDate` ra đúng ngày lịch đã lưu, độc lập với timezone
   * của server.
```

Gate, trước (dòng 366–373):

```ts
    if (!departure) throw new DepartureNotAvailableError();
    if (
      !departure.tour.isPublished ||
      departure.status !== DepartureStatus.OPEN ||
      calendarDate(departure.startDate) < todayUtc()
    ) {
      throw new DepartureNotAvailableError();
    }
```

Sau:

```ts
    if (!departure) throw new DepartureNotAvailableError();
    if (
      !departure.tour.isPublished ||
      departure.status !== DepartureStatus.OPEN ||
      calendarDate(departure.startDate) < vietnamToday(new Date())
    ) {
      throw new DepartureNotAvailableError();
    }
```

(e) `reCheckout` — trước (dòng 531–544):

```ts
      // Cùng gate chuyến với `create` và với claim (ADR-0009 AMEND 1/2): mint
      // trang thanh toán cho một booking mà claim chắc chắn từ chối là mời
      // khách trả một khoản sẽ bị auto-refund.
      const departure = await tx.tourDeparture.findUnique({
        where: { id: booking.departureId },
        select: { status: true, startDate: true },
      });
      if (
        !departure ||
        departure.status !== DepartureStatus.OPEN ||
        calendarDate(departure.startDate) < todayUtc()
      ) {
        throw new DepartureNotAvailableError();
      }
```

Sau:

```ts
      // Cùng gate chuyến với `create` và với claim (ADR-0009 AMEND 1, thước ngày
      // Việt Nam của ADR-0041 §7): mint trang thanh toán cho một booking mà claim
      // chắc chắn từ chối là mời khách trả một khoản sẽ bị auto-refund.
      const departure = await tx.tourDeparture.findUnique({
        where: { id: booking.departureId },
        select: { status: true, startDate: true },
      });
      if (
        !departure ||
        departure.status !== DepartureStatus.OPEN ||
        calendarDate(departure.startDate) < vietnamToday(new Date())
      ) {
        throw new DepartureNotAvailableError();
      }
```

(f) CTE claim — trước (dòng 903–910):

```sql
            -- Ngày so theo UTC TƯỜNG MINH (ADR-0009 AMEND 2), cùng thước với
            -- todayUtc() phía Node — không phụ thuộc TZ session của DB.
            AND EXISTS (
              SELECT 1 FROM tour_departures dep
              WHERE dep.id = b.departure_id
                AND dep.status = 'OPEN'::"DepartureStatus"
                AND dep.start_date >= (now() AT TIME ZONE 'UTC')::date
            )
```

Sau:

```sql
            -- Ngày so theo giờ Việt Nam (ADR-0041 §7, thay thước UTC của
            -- ADR-0009 AMEND 2), cùng thước với vietnamToday() phía Node —
            -- không phụ thuộc TZ session của DB. Gate này chỉ giữ "chưa khởi
            -- hành": thanh toán dở lúc hạn chót đặt chỗ trôi qua vẫn được nhận.
            AND EXISTS (
              SELECT 1 FROM tour_departures dep
              WHERE dep.id = b.departure_id
                AND dep.status = 'OPEN'::"DepartureStatus"
                AND dep.start_date >= ${vietnamDateSql(Prisma.sql`now()`)}
            )
```

(g) Nhánh phân loại sau claim — trước (dòng 973–978):

```ts
      if (
        !departure ||
        departure.status !== DepartureStatus.OPEN ||
        calendarDate(departure.startDate) < todayUtc()
      ) {
        outcome = 'departure-closed';
```

Sau:

```ts
      if (
        !departure ||
        departure.status !== DepartureStatus.OPEN ||
        calendarDate(departure.startDate) < vietnamToday(new Date())
      ) {
        outcome = 'departure-closed';
```

- [ ] **Step 14: Chạy int test của các đường booking**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/bookings.int.spec.ts src/modules/payments/payments.int.spec.ts src/modules/bookings/cancellations.int.spec.ts`

Expected: PASS — `payments.int.spec.ts` gồm ca `departure-closed` (chuyến dời về 2 ngày trước) và các ca claim đi qua CTE vừa đổi; `bookings.int.spec.ts` gồm ca CLOSED/past/unpublished và `refundEstimate`.

- [ ] **Step 15: Chuyển hai chỗ lọc ở `apps/api/src/modules/catalog/catalog.service.ts`**

Import — trước (dòng 2–14, trích phần đổi):

```ts
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
```

```ts
import { calendarDate } from '../../lib/calendar-date.js';
```

Sau:

```ts
} from '@tourism/contract';
import { vietnamToday } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
```

```ts
import { calendarDate, startOfDayUtc } from '../../lib/calendar-date.js';
```

Helper — trước (dòng 32–33):

```ts
/** Nửa đêm UTC hôm nay — cận dưới cho departure "upcoming". */
const startOfTodayUtc = (): Date => new Date(new Date().toISOString().slice(0, 10));
```

Sau:

```ts
/**
 * Cận dưới cho chuyến "sắp tới" (chưa khởi hành): 00:00 UTC của ngày HÔM NAY
 * THEO GIỜ VIỆT NAM (ADR-0041 §7). `start_date` là ngày lịch VN, và 00:00 UTC là
 * khuôn Prisma dùng cho cột `@db.Date`. Thước UTC cũ để chuyến khởi hành hôm
 * qua (giờ VN) còn hiện tới 06:59 sáng nay.
 */
const startOfVietnamToday = (now: Date): Date => startOfDayUtc(vietnamToday(now));
```

List — trước (dòng 165–172):

```ts
      prisma.tourDeparture.findMany({
        where: {
          tourId: { in: ids },
          status: DepartureStatus.OPEN,
          startDate: { gte: startOfTodayUtc() },
        },
        select: { tourId: true, priceOverride: true },
      }),
```

Sau:

```ts
      prisma.tourDeparture.findMany({
        where: {
          tourId: { in: ids },
          status: DepartureStatus.OPEN,
          startDate: { gte: startOfVietnamToday(new Date()) },
        },
        select: { tourId: true, priceOverride: true },
      }),
```

Detail — trước (dòng 205–211):

```ts
        departures: {
          where: {
            status: DepartureStatus.OPEN,
            startDate: { gte: startOfTodayUtc() },
          },
          orderBy: { startDate: 'asc' },
        },
```

Sau:

```ts
        departures: {
          where: {
            status: DepartureStatus.OPEN,
            startDate: { gte: startOfVietnamToday(new Date()) },
          },
          orderBy: { startDate: 'asc' },
        },
```

- [ ] **Step 16: Chạy int test catalog**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/catalog/catalog.int.spec.ts`

Expected: PASS (fixture dùng chuyến +60/+90 ngày và −10 ngày, không đổi kết quả).

- [ ] **Step 17: Soát không còn thước UTC ở gate chuyến đi, typecheck, format**

Run:

```bash
git grep -n -E "todayUtc|startOfTodayUtc|AT TIME ZONE 'UTC'" -- apps/api/src
pnpm --filter @tourism/api typecheck
pnpm lint:fix
git status --short
```

Expected:
- `git grep` chỉ còn các dòng biến cục bộ `todayUtc` trong `apps/api/src/modules/stats/stats.int.spec.ts` (test chuỗi ngày dashboard, giữ UTC có chủ đích theo ADR-0036); không còn dòng nào trong `bookings.service.ts` hay `catalog.service.ts`.
- `typecheck` exit 0 (lời gọi ba tham số ở test `4d` nay hợp lệ; `calendarDate` không còn import thừa ở `account.service.ts`).
- `git status --short` chỉ liệt kê sáu file của task (cộng các mục untracked có từ trước như `docs/screenshot/`, không add).

- [ ] **Step 18: Cổng đầy đủ** (Docker Postgres đang chạy; Git Bash, gốc repo)

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu lệnh exit 0.

- [ ] **Step 19: Commit**

```bash
git add apps/api/src/lib/vietnam-date-sql.ts apps/api/src/lib/vietnam-date-sql.int.spec.ts apps/api/src/auth/account.service.ts apps/api/src/auth/account-delete.int.spec.ts apps/api/src/modules/bookings/bookings.service.ts apps/api/src/modules/catalog/catalog.service.ts
git commit -m "fix(api): so ngày chuyến đi theo giờ Việt Nam thay cho UTC"
```
---

### Task 4: Chốt chặn đặt chỗ ở `create` và `checkout`

**Files:**
- Modify: `apps/api/src/modules/bookings/bookings.service.ts` — khối import `@tourism/contract` (dòng 12–18 sau Task 3); JSDoc `DepartureNotAvailableError` (dòng 45–47); thêm `BookableDepartureRow` và `assertDepartureBookable` ngay sau class `BookingNotPendingError` (hết dòng 83); JSDoc và gate của `create`; gate của `reCheckout`. Số dòng của hai khối cuối lệch vài dòng so với bản gốc vì Task 3 — tìm theo đoạn "Trước" trích bên dưới.
- Test (Modify): `apps/api/src/modules/bookings/bookings.int.spec.ts` — import dòng 3 và dòng 14; khối fixture dòng 70–82; thêm một `describe` sau test `'CLOSED / past / unpublished-tour departures → 400 DEPARTURE_NOT_AVAILABLE'` (hết dòng 503).
- Test (Modify): `apps/api/src/modules/bookings/cancellations.int.spec.ts` — fixture `depSoon` dòng 71–79.
- Đã rà các int spec khác gọi `POST /api/bookings` hoặc `/checkout`: `payments.int.spec.ts`, `refunds.int.spec.ts`, `cancellations.int.spec.ts` (`dep`) dùng chuyến +45 ngày dài 2 ngày (N = 3) nên không bị chặn; `authed-write-throttle.int.spec.ts` gọi checkout trên mã không tồn tại (404). Chỉ `depSoon` cần sửa.

**Interfaces:**
- Consumes: `isWithinDeadline` (Task 1, `@tourism/contract`); `calendarDate` (`apps/api/src/lib/calendar-date.ts`); các gate ngày Việt Nam của Task 3; `DepartureNotAvailableError` sẵn có.
- Produces (Hợp đồng F; khung để trống kiểu của `departure`, định nghĩa tường minh ở đây):

  ```ts
  // apps/api/src/modules/bookings/bookings.service.ts
  export interface BookableDepartureRow {
    status: DepartureStatus;
    startDate: Date;
    endDate: Date;
    tour: { isPublished: boolean };
  }
  export function assertDepartureBookable(departure: BookableDepartureRow, now: Date): void;
  ```

  Chỗ gọi tự kiểm `null` trước (`if (!departure) throw new DepartureNotAvailableError();`). Claim webhook (`claimSeatsForPaid`) KHÔNG gọi hàm này. `reCheckout` thêm vế `isPublished` nhưng KHÔNG thêm soft-check ghế.
- Ghi chú phạm vi test: ngoài bốn ca của khung, task thêm hai ca cùng chốt chặn — `checkout` khi tour đã gỡ publish (hành vi mới của `reCheckout`) và claim vẫn nhận thanh toán sau hạn chót (spec §3.2, §8: canh để chốt chặn không lan sang claim).

- [ ] **Step 1: Giữ fixture `depSoon` luôn đặt được** — trong `apps/api/src/modules/bookings/cancellations.int.spec.ts`:

Trước (dòng 71–79):

```ts
  // Chuyến khởi hành +3 ngày — cho ca bậc 0% của ADR-0029 AMEND 5 (tour
  // fixture không có freeCancellationDays nên <7 ngày rơi thẳng vào bậc 0%).
  const future3 = new Date(Date.now() + 3 * 86_400_000);
  const depSoon = {
    ...dep,
    id: 'e9400001-0000-4000-8000-000000000002',
    startDate: future3,
    endDate: new Date(future3.getTime() + 86_400_000),
  } satisfies Prisma.TourDepartureCreateManyInput;
```

Sau:

```ts
  // Chuyến khởi hành +3 ngày — cho ca bậc 0% của ADR-0029 AMEND 5 (tour
  // fixture không có freeCancellationDays nên <7 ngày rơi thẳng vào bậc 0%).
  // Chuyến MỘT ngày (endDate = startDate) là có chủ đích: N = 1 nên hạn chót đặt
  // chỗ là +2 ngày và `create` không bao giờ vướng chốt chặn ADR-0041 §3. Để 2
  // ngày thì N = 3, hạn chót rơi đúng hôm nay theo UTC và `create` bị chặn trong
  // khung 00:00–06:59 giờ Việt Nam. Viết lại file này (Task 6) phải giữ điều kiện đó.
  const future3 = new Date(Date.now() + 3 * 86_400_000);
  const depSoon = {
    ...dep,
    id: 'e9400001-0000-4000-8000-000000000002',
    startDate: future3,
    endDate: future3,
  } satisfies Prisma.TourDepartureCreateManyInput;
```

- [ ] **Step 2: Viết test đỏ — import** — trong `apps/api/src/modules/bookings/bookings.int.spec.ts`:

Trước (dòng 3):

```ts
import { BookingSchema, PagedSchema } from '@tourism/contract';
```

Sau:

```ts
import { BookingSchema, PagedSchema, vietnamToday } from '@tourism/contract';
```

Trước (dòng 14):

```ts
import { FakeGateway } from '../payments/fake.gateway.js';
```

Sau:

```ts
import { FakeGateway } from '../payments/fake.gateway.js';
import { BookingsService } from './bookings.service.js';
```

- [ ] **Step 3: Viết test đỏ — fixture ba chuyến quanh hạn chót** — cùng file:

Trước (dòng 70–82):

```ts
  const future60 = new Date(Date.now() + 60 * 86_400_000);
  const future90 = new Date(Date.now() + 90 * 86_400_000);
  const past10 = new Date(Date.now() - 10 * 86_400_000);
  const depOpen = dep('1', future60);
  const depOverride = dep('2', future90, {
    priceOverride: '59.00',
    seatsTotal: 10,
    seatsBooked: 0,
  });
  const depClosed = dep('3', future60, { status: DepartureStatus.CLOSED });
  const depPast = dep('4', past10);
  const depUnpublished = dep('5', future60, { tourId: unpublishedTour.id });
  const departures = [depOpen, depOverride, depClosed, depPast, depUnpublished];
```

Sau:

```ts
  const future60 = new Date(Date.now() + 60 * 86_400_000);
  const future90 = new Date(Date.now() + 90 * 86_400_000);
  const past10 = new Date(Date.now() - 10 * 86_400_000);
  const depOpen = dep('1', future60);
  const depOverride = dep('2', future90, {
    priceOverride: '59.00',
    seatsTotal: 10,
    seatsBooked: 0,
  });
  const depClosed = dep('3', future60, { status: DepartureStatus.CLOSED });
  const depPast = dep('4', past10);
  const depUnpublished = dep('5', future60, { tourId: unpublishedTour.id });
  // Chốt chặn hạn chót (ADR-0041 §3). Ngày tính từ "hôm nay" GIỜ VIỆT NAM vì
  // `start_date` là ngày lịch VN và server so bằng đúng thước ấy; `vnDay(n)` là
  // 00:00 UTC của ngày VN hôm nay + n, khuôn Prisma dùng cho cột `@db.Date`.
  // Ba ca dưới vẫn đúng nếu file chạy vắt qua nửa đêm giờ VN (mọi ngày lùi một).
  const vnDay = (offset: number) =>
    new Date(Date.parse(`${vietnamToday(new Date())}T00:00:00.000Z`) + offset * 86_400_000);
  // L = 1 → N = 1: khởi hành hôm nay, hạn chót là hôm qua.
  const depToday1d = dep('6', vnDay(0), { endDate: vnDay(0) });
  // L = 4 → N = 7: khởi hành sau 5 ngày, hạn chót đã qua 2 ngày.
  const depLong4d = dep('7', vnDay(5), { endDate: vnDay(8) });
  // L = 2 → N = 3: khởi hành sau 4 ngày, hạn chót là ngày mai.
  const depShort2d = dep('8', vnDay(4), { endDate: vnDay(5) });
  const departures = [
    depOpen,
    depOverride,
    depClosed,
    depPast,
    depUnpublished,
    depToday1d,
    depLong4d,
    depShort2d,
  ];
```

- [ ] **Step 4: Viết test đỏ — các ca chốt chặn** — cùng file, thêm ngay sau test `'CLOSED / past / unpublished-tour departures → 400 DEPARTURE_NOT_AVAILABLE'` (sau dòng 503):

```ts
  describe('chốt chặn hạn chót đặt chỗ (ADR-0041 §3)', () => {
    const postCheckout = (cookie: string, code: string) =>
      app.inject({ method: 'POST', url: `/api/bookings/${code}/checkout`, headers: { cookie } });

    it('create chặn chuyến đã qua hạn chót: tour 1 ngày khởi hành hôm nay, tour 4 ngày còn 5 ngày', async () => {
      const cookie = await signUpUser('deadline-passed@example.com');
      for (const departureId of [depToday1d.id, depLong4d.id]) {
        const res = await createBooking(cookie, { ...createPayload, departureId });
        expect(res.statusCode, departureId).toBe(400);
        expect(res.json()).toMatchObject({ code: 'DEPARTURE_NOT_AVAILABLE' });
      }
      // Chặn TRƯỚC insert và trước khi gọi provider: không PENDING, không session.
      expect(await prisma.booking.count()).toBe(0);
      expect(fake.sessions).toHaveLength(0);
    });

    it('create vẫn nhận chuyến còn trong hạn: tour 2 ngày còn 4 ngày, hạn chót ngày mai', async () => {
      const cookie = await signUpUser('deadline-open@example.com');
      const res = await createBooking(cookie, { ...createPayload, departureId: depShort2d.id });
      expect(res.statusCode).toBe(200);
      expect(BookingSchema.parse(res.json()).status).toBe('PENDING');
    });

    it('"Pay again" trên PENDING khi chuyến đã qua hạn chót → 400, kể cả session cũ còn sống', async () => {
      const cookie = await signUpUser('deadline-checkout@example.com');
      const body = (
        await createBooking(cookie, { ...createPayload, departureId: depShort2d.id })
      ).json();
      // Như thể hai ngày đã trôi: dời chuyến lại gần thay vì chỉnh đồng hồ —
      // L = 2 → N = 3, khởi hành sau 2 ngày thì hạn chót là hôm qua.
      await prisma.tourDeparture.update({
        where: { id: depShort2d.id },
        data: { startDate: vnDay(2), endDate: vnDay(3) },
      });
      try {
        const retry = await postCheckout(cookie, body.code);
        expect(retry.statusCode).toBe(400);
        expect(retry.json()).toMatchObject({ code: 'DEPARTURE_NOT_AVAILABLE' });
        // Session của lần create chưa hết hạn, nhưng chốt chặn đứng TRƯỚC nhánh
        // trả lại session: sau hạn chót không mở lại trang thanh toán nào.
        expect(fake.sessions).toHaveLength(1);
      } finally {
        await prisma.tourDeparture.update({
          where: { id: depShort2d.id },
          data: { startDate: depShort2d.startDate, endDate: depShort2d.endDate },
        });
      }
    });

    it('"Pay again" cũng chặn khi tour đã gỡ publish — cùng một chốt chặn với create', async () => {
      const cookie = await signUpUser('unpublished-checkout@example.com');
      const body = (await createBooking(cookie)).json();
      await prisma.tour.update({ where: { id: dayTour.id }, data: { isPublished: false } });
      try {
        const retry = await postCheckout(cookie, body.code);
        expect(retry.statusCode).toBe(400);
        expect(retry.json()).toMatchObject({ code: 'DEPARTURE_NOT_AVAILABLE' });
        expect(fake.sessions).toHaveLength(1);
      } finally {
        await prisma.tour.update({ where: { id: dayTour.id }, data: { isPublished: true } });
      }
    });

    it('claim vẫn nhận thanh toán của PENDING đã qua hạn chót khi chuyến chưa khởi hành (spec §3.2)', async () => {
      // Chốt chặn chỉ đứng ở create/checkout. Thanh toán đang dở lúc hạn chót
      // trôi qua vẫn được nhận — nới cho khách thay vì thu tiền rồi tự hoàn.
      const cookie = await signUpUser('deadline-claim@example.com');
      const body = (
        await createBooking(cookie, { ...createPayload, departureId: depShort2d.id })
      ).json();
      await prisma.tourDeparture.update({
        where: { id: depShort2d.id },
        data: { startDate: vnDay(2), endDate: vnDay(3) },
      });
      try {
        const outcome = await app
          .get(BookingsService)
          .claimSeatsForPaid(body.id, 'pi_after_deadline');
        expect(outcome).toBe('claimed');
        const row = await prisma.booking.findUniqueOrThrow({ where: { id: body.id } });
        expect(row.status).toBe(BookingStatus.PAID);
      } finally {
        // Trả chuyến về nguyên trạng cho các test sau (ngày, ghế vừa claim) và gỡ
        // dòng outbox xác nhận mà claim vừa xếp — file này không truncate outbox.
        await prisma.tourDeparture.update({
          where: { id: depShort2d.id },
          data: {
            startDate: depShort2d.startDate,
            endDate: depShort2d.endDate,
            seatsBooked: depShort2d.seatsBooked,
          },
        });
        await prisma.outbox.deleteMany({ where: { dedupeKey: `booking-confirmed:${body.id}` } });
      }
    });
  });
```

- [ ] **Step 5: Chạy test, xác nhận đỏ** (Docker Postgres đang chạy; Git Bash, gốc repo)

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/bookings.int.spec.ts`

Expected: FAIL đúng ba test trong `describe('chốt chặn hạn chót đặt chỗ (ADR-0041 §3)')`:
- `create chặn chuyến đã qua hạn chót…` — nhận 200 thay vì 400 (gate hiện chỉ chặn chuyến đã khởi hành);
- `"Pay again" … qua hạn chót` — nhận 200 (trả lại session còn sống);
- `"Pay again" cũng chặn khi tour đã gỡ publish` — nhận 200 (`reCheckout` chưa kiểm `isPublished`).

Hai ca `create vẫn nhận chuyến còn trong hạn` và `claim vẫn nhận thanh toán…` PASS ngay (ca canh bất biến); mọi test cũ của file PASS.

- [ ] **Step 6: Cài đặt — import và JSDoc lỗi** — trong `apps/api/src/modules/bookings/bookings.service.ts`:

Trước (khối import sau Task 3):

```ts
import {
  daysBeforeDeparture,
  isWithinGracePeriod,
  policyRefundAmount,
  refundPercentForRequest,
  vietnamToday,
} from '@tourism/contract';
```

Sau:

```ts
import {
  daysBeforeDeparture,
  isWithinDeadline,
  isWithinGracePeriod,
  policyRefundAmount,
  refundPercentForRequest,
  vietnamToday,
} from '@tourism/contract';
```

Trước (dòng 45–47):

```ts
/** Departure không tồn tại / không OPEN / đã departed / tour unpublished — cố
 * ý gộp thành một error (contract: một code DEPARTURE_NOT_AVAILABLE duy nhất,
 * không leak sự tồn tại). */
```

Sau:

```ts
/** Departure không tồn tại / không OPEN / đã qua hạn chót đặt chỗ (ADR-0041 §3,
 * gồm cả đã departed) / tour unpublished — cố ý gộp thành một error (contract:
 * một code DEPARTURE_NOT_AVAILABLE duy nhất, không leak sự tồn tại). */
```

- [ ] **Step 7: Cài đặt — hàm chốt chặn** — cùng file, thêm ngay sau class `BookingNotPendingError` (sau dòng 83, trước `const money`):

```ts
/** Phần tối thiểu của một chuyến mà chốt chặn đặt chỗ cần đọc. */
export interface BookableDepartureRow {
  status: DepartureStatus;
  startDate: Date;
  endDate: Date;
  tour: { isPublished: boolean };
}

/**
 * Chốt chặn đặt chỗ DÙNG CHUNG cho `create` và `reCheckout` (ADR-0041 §3, spec
 * §3.2): tour đã published, chuyến OPEN, và hôm nay theo giờ Việt Nam chưa qua
 * hạn chót của chuyến. Qua hạn chót thì chỗ trả về không bán lại được nữa, nên
 * cũng không tạo hay mở lại trang thanh toán nào — kể cả trả lại session còn
 * sống. Hạn chót luôn trước ngày khởi hành nên vế này bao luôn "chưa khởi hành".
 *
 * KHÔNG kiểm ghế: `create` soft-check riêng, còn claim mới là bên quyết định chỗ
 * (bất biến #1). KHÔNG dùng ở claim webhook: thanh toán dở lúc hạn chót trôi qua
 * vẫn được nhận (gate claim chỉ giữ "OPEN và chưa khởi hành").
 *
 * Mọi lý do gộp vào MỘT lỗi — contract chỉ có mã `DEPARTURE_NOT_AVAILABLE`.
 */
export function assertDepartureBookable(departure: BookableDepartureRow, now: Date): void {
  if (
    !departure.tour.isPublished ||
    departure.status !== DepartureStatus.OPEN ||
    !isWithinDeadline(now, calendarDate(departure.startDate), calendarDate(departure.endDate))
  ) {
    throw new DepartureNotAvailableError();
  }
}
```

- [ ] **Step 8: Cài đặt — `create` dùng chốt chặn** — cùng file, trong JSDoc của `create`:

Trước (bản sau Task 3):

```ts
   * Validation (giữ nguyên semantics đã port): departure tồn tại, tour của nó
   * đã published, status OPEN, và chưa DEPARTED — same-day vẫn book được
   * (walk-in, rule Nexora); chỉ startDate strictly-past mới reject. "Hôm nay"
   * là ngày Việt Nam (`vietnamToday`, ADR-0041 §7); `@db.Date` load thành nửa
   * đêm UTC nên `calendarDate` ra đúng ngày lịch đã lưu, độc lập với timezone
   * của server.
```

Sau:

```ts
   * Validation: departure tồn tại, rồi {@link assertDepartureBookable} — tour đã
   * published, status OPEN, và hôm nay theo giờ Việt Nam chưa qua hạn chót đặt
   * chỗ (ADR-0041 §3). Luật walk-in cùng ngày port từ Nexora hết hiệu lực: tour
   * một ngày ngừng nhận đặt từ 00:00 ngày khởi hành, tour dài hơn thì sớm hơn
   * N ngày.
```

Gate — trước (bản sau Task 3):

```ts
    if (!departure) throw new DepartureNotAvailableError();
    if (
      !departure.tour.isPublished ||
      departure.status !== DepartureStatus.OPEN ||
      calendarDate(departure.startDate) < vietnamToday(new Date())
    ) {
      throw new DepartureNotAvailableError();
    }
```

Sau:

```ts
    if (!departure) throw new DepartureNotAvailableError();
    assertDepartureBookable(departure, new Date());
```

- [ ] **Step 9: Cài đặt — `reCheckout` dùng chốt chặn** — cùng file:

Trước (bản sau Task 3):

```ts
      // Cùng gate chuyến với `create` và với claim (ADR-0009 AMEND 1, thước ngày
      // Việt Nam của ADR-0041 §7): mint trang thanh toán cho một booking mà claim
      // chắc chắn từ chối là mời khách trả một khoản sẽ bị auto-refund.
      const departure = await tx.tourDeparture.findUnique({
        where: { id: booking.departureId },
        select: { status: true, startDate: true },
      });
      if (
        !departure ||
        departure.status !== DepartureStatus.OPEN ||
        calendarDate(departure.startDate) < vietnamToday(new Date())
      ) {
        throw new DepartureNotAvailableError();
      }
```

Sau:

```ts
      // Cùng chốt chặn với `create` (ADR-0041 §3): sau hạn chót không mint session
      // mới và cũng không trả lại session còn sống, nên chốt chặn đứng TRƯỚC nhánh
      // `sessionAlive`. Chặt hơn claim có chủ đích — trang thanh toán đã mở từ
      // trước hạn vẫn được claim nhận. Không soft-check ghế ở đây: claim quyết chỗ.
      const departure = await tx.tourDeparture.findUnique({
        where: { id: booking.departureId },
        select: {
          status: true,
          startDate: true,
          endDate: true,
          tour: { select: { isPublished: true } },
        },
      });
      if (!departure) throw new DepartureNotAvailableError();
      assertDepartureBookable(departure, new Date());
```

- [ ] **Step 10: Chạy test, xác nhận xanh**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/bookings.int.spec.ts`

Expected: PASS toàn file, gồm năm ca của `describe('chốt chặn hạn chót đặt chỗ (ADR-0041 §3)')` và ca cũ `ADR-0009 AMEND 2: reCheckout trên chuyến đã CLOSED → 400`.

- [ ] **Step 11: Chạy các int spec khác đi qua `create`/`checkout`/claim**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/cancellations.int.spec.ts src/modules/bookings/refunds.int.spec.ts src/modules/payments/payments.int.spec.ts src/auth/authed-write-throttle.int.spec.ts`

Expected: PASS cả bốn file (ca `AMEND 5: vắng refundAmount trên bậc 0%` tạo booking trên `depSoon` một ngày, vẫn hoàn 0 như cũ vì bậc chỉ đếm ngày tới khởi hành).

- [ ] **Step 12: Soát, typecheck, format**

Run:

```bash
git grep -n "assertDepartureBookable" -- apps/api/src
pnpm --filter @tourism/api typecheck
pnpm lint:fix
git status --short
```

Expected:
- `git grep` ra đúng các dòng trong `apps/api/src/modules/bookings/bookings.service.ts`: định nghĩa hàm, tham chiếu `{@link …}` trong JSDoc của `create`, hai lời gọi trong `create` và `reCheckout`. Không còn khối `if (… departure.status !== DepartureStatus.OPEN …)` nào trong `create` hay `reCheckout` (khối còn lại duy nhất là nhánh phân loại sau claim).
- `typecheck` exit 0 (row của `create` và `select` của `reCheckout` đều khớp `BookableDepartureRow`).
- `git status --short` chỉ liệt kê ba file của task (cộng các mục untracked có từ trước như `docs/screenshot/`, không add).

- [ ] **Step 13: Cổng đầy đủ** (Docker Postgres đang chạy; Git Bash, gốc repo)

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu lệnh exit 0.

- [ ] **Step 14: Commit**

```bash
git add apps/api/src/modules/bookings/bookings.service.ts apps/api/src/modules/bookings/bookings.int.spec.ts apps/api/src/modules/bookings/cancellations.int.spec.ts
git commit -m "feat(api): ngừng nhận đặt và thanh toán lại sau hạn chót của chuyến"
```
---

### Task 5: Catalog: `bookingDeadline`, `bookable`, giá "from"

**Files:**
- Modify: `libs/shared/contract/src/schemas/catalog.ts` — JSDoc `priceFrom` của `TourCardSchema` (dòng 72–79); `TourDepartureSchema` (dòng 130–138).
- Test (Modify): `libs/shared/contract/src/schemas/catalog.spec.ts` — tách `validDeparture` khỏi `validDetail` (dòng 33–67); thêm một `describe` ở cuối file (sau dòng 359).
- Modify: `apps/api/src/modules/catalog/catalog.service.ts` — import `@tourism/contract` (dòng Task 3 thêm); JSDoc `priceFrom` (dòng 65–69); đầu `listTours` và khối đợt/giá của nó (dòng 125–179); toàn bộ `getTourBySlug` (dòng 196–265). Số dòng là của bản gốc, lệch vài dòng sau Task 3 — tìm theo đoạn "Trước".
- Test (Modify): `apps/api/src/modules/catalog/catalog.int.spec.ts` — import dòng 3–9; khối fixture departures dòng 50–74; comment `priceFrom` của test list (dòng 209–211); đoạn departures của test detail (dòng 334–351).
- Modify (typecheck web): `apps/web/src/components/booking/steps/steps.spec.tsx` (dòng 17–24), `apps/web/src/components/tours/booking-rail.spec.tsx` (dòng 15–22), `apps/web/src/components/tours/link-cta.spec.tsx` (dòng 24–31).
- Đã rà, KHÔNG cần sửa: các spec web khác dựng departure đều ép kiểu (`booking-wizard.spec.tsx`, `checkout-summary.spec.tsx` dùng `as DepartureVM`; `departure-dialog.spec.tsx`, `departures-panel.spec.tsx`, `itinerary-panel.spec.tsx`, `tour-hero.spec.tsx`, `tour-media-panel.spec.tsx` dùng `as unknown as`), `departure-strip.spec.tsx` gõ `MockTourDeparture` (interface riêng ở `apps/web/src/mocks/types.ts`, `DepartureStrip` chỉ đọc field cũ), `lib/tour-detail.spec.ts` dùng kiểu cấu trúc tối thiểu của `resolveDepartureAnchors`/`heroPrice`; `apps/web/src/test/fixtures/catalog.ts` chỉ giữ field cấp card. `apps/admin`, `apps/mobile`, `libs/mobile`, `libs/shared/i18n` không dựng object departure nào; repo không có snapshot test.

**Interfaces:**
- Consumes: `cancellationDeadline`, `isWithinDeadline`, `vietnamToday` (Task 1, `@tourism/contract`); `startOfVietnamToday(now: Date): Date` (Task 3, hàm nội bộ của `catalog.service.ts`); `calendarDate` (`apps/api/src/lib/calendar-date.ts`).
- Produces (Hợp đồng B, phần Task 5):

  ```ts
  // libs/shared/contract/src/schemas/catalog.ts — TourDepartureSchema thêm
  bookingDeadline: z.iso.date(),
  /** Server tính: chuyến còn trong hạn đặt. Còn chỗ hay không vẫn đọc `seatsLeft`. */
  bookable: z.boolean(),
  ```

  `bookingDeadline = cancellationDeadline(startDate, endDate)`, `bookable = isWithinDeadline(now, startDate, endDate)`. `catalog.tours.bySlug` vẫn trả chuyến đã qua hạn nhưng chưa khởi hành (`bookable: false`). `priceFrom` của CẢ `catalog.tours.list` lẫn `catalog.tours.bySlug` chỉ tính chuyến `bookable`. `DepartureVM`/`TourDetailVM` của web (`apps/web/src/lib/api/tours.ts`) suy thẳng từ contract nên tự có hai field — Task 10 đọc `bookable` cho `heroPrice` và nhãn "Booking closed".

- [ ] **Step 1: Viết test contract đỏ — tách fixture chuyến** — trong `libs/shared/contract/src/schemas/catalog.spec.ts`, thêm ngay TRƯỚC `const validDetail = {` (dòng 33):

```ts
/** Chuyến một ngày 31/07: N = 1 nên hạn chót đặt chỗ là 30/07 (ADR-0041 §2). */
const validDeparture = {
  id: 'e0000001-0000-4000-8000-000000000001',
  startDate: '2026-07-31',
  endDate: '2026-07-31',
  seatsLeft: 8,
  effectivePrice: '39.00',
  compareAtPrice: null,
  bookingDeadline: '2026-07-30',
  bookable: true,
};
```

Và trong `validDetail`, trước (dòng 57–67):

```ts
  departures: [
    {
      id: 'e0000001-0000-4000-8000-000000000001',
      startDate: '2026-07-31',
      endDate: '2026-07-31',
      seatsLeft: 8,
      effectivePrice: '39.00',
      compareAtPrice: null,
    },
  ],
};
```

Sau:

```ts
  departures: [validDeparture],
};
```

- [ ] **Step 2: Viết test contract đỏ — hai field mới** — thêm vào CUỐI `libs/shared/contract/src/schemas/catalog.spec.ts`:

```ts
describe('TourDepartureSchema — hạn chót đặt chỗ (ADR-0041 §3)', () => {
  const withDeparture = (departure: object) => ({ ...validDetail, departures: [departure] });

  it('mỗi chuyến mang bookingDeadline (ngày lịch) và bookable (server tính)', () => {
    const parsed = TourDetailSchema.parse(withDeparture({ ...validDeparture, bookable: false }));
    expect(parsed.departures[0]).toMatchObject({ bookingDeadline: '2026-07-30', bookable: false });
  });

  it('thiếu một trong hai field thì từ chối — client không được tự đoán hạn chót', () => {
    const { bookable: _bookable, ...withoutBookable } = validDeparture;
    const { bookingDeadline: _deadline, ...withoutDeadline } = validDeparture;
    expect(() => TourDetailSchema.parse(withDeparture(withoutBookable))).toThrow();
    expect(() => TourDetailSchema.parse(withDeparture(withoutDeadline))).toThrow();
  });

  it('bookingDeadline phải là ngày lịch YYYY-MM-DD, bookable phải là boolean', () => {
    expect(() =>
      TourDetailSchema.parse(withDeparture({ ...validDeparture, bookingDeadline: '30/07/2026' })),
    ).toThrow();
    expect(() =>
      TourDetailSchema.parse(
        withDeparture({ ...validDeparture, bookingDeadline: '2026-07-30T00:00:00Z' }),
      ),
    ).toThrow();
    expect(() =>
      TourDetailSchema.parse(withDeparture({ ...validDeparture, bookable: 'yes' })),
    ).toThrow();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận đỏ**

Run (Git Bash, gốc repo): `pnpm --filter @tourism/contract exec vitest run src/schemas/catalog.spec.ts`

Expected: FAIL bốn test — `TourDetailSchema > parses a full detail incl. departures` (Zod bỏ hai khoá lạ nên `toEqual` lệch) và cả ba ca của `describe('TourDepartureSchema — hạn chót đặt chỗ (ADR-0041 §3)')` (khoá bị bỏ, không ném). Các test khác PASS.

- [ ] **Step 4: Cài đặt schema** — trong `libs/shared/contract/src/schemas/catalog.ts`:

Trước (dòng 130–138):

```ts
/** Upcoming OPEN departure. `effectivePrice = priceOverride ?? tour.basePrice`. */
export const TourDepartureSchema = z.object({
  id: z.uuid(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  seatsLeft: z.int().nonnegative(),
  effectivePrice: DecimalStringSchema,
  compareAtPrice: DecimalStringSchema.nullable(),
});
```

Sau:

```ts
/**
 * Chuyến OPEN chưa khởi hành (so theo ngày Việt Nam). `effectivePrice =
 * priceOverride ?? tour.basePrice`.
 *
 * Gồm cả chuyến ĐÃ QUA hạn đặt nhưng chưa khởi hành (`bookable: false`): trang
 * tour vẫn hiện chúng với nhãn "Booking closed" và lối sang form hỏi (spec §3.2).
 */
export const TourDepartureSchema = z.object({
  id: z.uuid(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  seatsLeft: z.int().nonnegative(),
  effectivePrice: DecimalStringSchema,
  compareAtPrice: DecimalStringSchema.nullable(),
  /**
   * Ngày chót đặt chỗ, cũng là ngày chót huỷ miễn phí: `cancellationDeadline(startDate,
   * endDate)` (ADR-0041 §2), hết lúc 23:59:59 giờ Việt Nam. Server tính để web in
   * đúng một ngày cụ thể mà không tự dựng luật N.
   */
  bookingDeadline: z.iso.date(),
  /**
   * Server tính: chuyến còn trong hạn đặt. Còn chỗ hay không vẫn đọc `seatsLeft`.
   * Web in theo cờ này, KHÔNG so ngày bằng giờ trình duyệt (spec Q7).
   */
  bookable: z.boolean(),
});
```

Trước (dòng 72–79, JSDoc `priceFrom` của `TourCardSchema`):

```ts
  /**
   * Giá "from" THẬT của tour = `min(effectivePrice)` trên các đợt OPEN sắp tới
   * (`effectivePrice = priceOverride ?? basePrice`); không còn đợt nào thì rơi về
   * `basePrice`. Thêm 19/08 (sổ nợ cùng ngày): thẻ /tours in `basePrice` "from
   * $129" trong khi trang chi tiết có đợt thấp điểm $119 — card không biết đợt.
   * Tính ở API (một query cho cả trang, không N+1) chứ không ở web, vì list
   * không mang `departures`. Vẫn là DecimalString — tiền không bao giờ là số.
   */
```

Sau:

```ts
  /**
   * Giá "from" THẬT của tour = `min(effectivePrice)` trên các đợt OPEN còn nhận
   * đặt (`bookable`, ADR-0041 §3; `effectivePrice = priceOverride ?? basePrice`);
   * không còn đợt nào đặt được thì rơi về `basePrice`. List và detail lọc cùng
   * một luật để thẻ tour và trang tour không in hai giá khác nhau: chuyến đã qua
   * hạn đặt không bán được nên không được kéo giá xuống. Thêm 19/08 (sổ nợ cùng
   * ngày): thẻ /tours in `basePrice` "from $129" trong khi trang chi tiết có đợt
   * thấp điểm $119 — card không biết đợt. Tính ở API (một query cho cả trang,
   * không N+1) chứ không ở web, vì list không mang `departures`. Vẫn là
   * DecimalString — tiền không bao giờ là số.
   */
```

- [ ] **Step 5: Chạy test contract, xác nhận xanh; build hai gói**

Run:

```bash
pnpm --filter @tourism/contract exec vitest run src/schemas/catalog.spec.ts
pnpm --filter @tourism/contract typecheck
pnpm --filter @tourism/contract build
pnpm --filter @tourism/i18n build
```

Expected: test PASS toàn file; typecheck, hai lệnh build exit 0.

- [ ] **Step 6: Viết int test catalog đỏ — import và fixture** — trong `apps/api/src/modules/catalog/catalog.int.spec.ts`:

Trước (dòng 3–9):

```ts
import {
  DestinationSchema,
  PagedSchema,
  TourCardSchema,
  TourCategorySchema,
  TourDetailSchema,
} from '@tourism/contract';
```

Sau:

```ts
import {
  DestinationSchema,
  PagedSchema,
  TourCardSchema,
  TourCategorySchema,
  TourDetailSchema,
  vietnamToday,
} from '@tourism/contract';
```

Trước (dòng 50–74):

```ts
  // Dynamic departures on the day tour: only `open60` + `openOverride90`
  // should surface (upcoming + OPEN).
  const dep = (id: string, start: Date, patch: Partial<Prisma.TourDepartureCreateManyInput>) => ({
    id: `e9000001-0000-4000-8000-00000000000${id}`,
    tourId: dayTour.id,
    startDate: start,
    endDate: start,
    seatsTotal: 8,
    seatsBooked: 0,
    status: DepartureStatus.OPEN,
    ...patch,
  });
  const future60 = new Date(Date.now() + 60 * 86_400_000);
  const future90 = new Date(Date.now() + 90 * 86_400_000);
  const past10 = new Date(Date.now() - 10 * 86_400_000);
  const departures = [
    dep('1', future60, { seatsBooked: 3 }), // upcoming OPEN → seatsLeft 5
    dep('2', future90, {
      priceOverride: '59.00',
      compareAtPrice: '75.00',
      seatsTotal: 10,
    }),
    dep('3', past10, {}), // past → invisible
    dep('4', future60, { status: DepartureStatus.CLOSED }), // CLOSED → invisible
  ];
```

Sau:

```ts
  // Departures động trên day tour: detail trả `open60`, `openOverride90` và
  // chuyến đã qua hạn đặt `closing` (upcoming + OPEN); chỉ hai chuyến đầu còn
  // `bookable`.
  const dep = (id: string, start: Date, patch: Partial<Prisma.TourDepartureCreateManyInput>) => ({
    id: `e9000001-0000-4000-8000-00000000000${id}`,
    tourId: dayTour.id,
    startDate: start,
    endDate: start,
    seatsTotal: 8,
    seatsBooked: 0,
    status: DepartureStatus.OPEN,
    ...patch,
  });
  const future60 = new Date(Date.now() + 60 * 86_400_000);
  const future90 = new Date(Date.now() + 90 * 86_400_000);
  const past10 = new Date(Date.now() - 10 * 86_400_000);
  // 00:00 UTC của ngày Việt Nam hôm nay — khuôn Prisma dùng cho cột `@db.Date`.
  const vnToday = Date.parse(`${vietnamToday(new Date())}T00:00:00.000Z`);
  const closingStart = new Date(vnToday + 86_400_000);
  const departures = [
    dep('1', future60, { seatsBooked: 3 }), // upcoming OPEN → seatsLeft 5
    dep('2', future90, {
      priceOverride: '59.00',
      compareAtPrice: '75.00',
      seatsTotal: 10,
    }),
    dep('3', past10, {}), // past → invisible
    dep('4', future60, { status: DepartureStatus.CLOSED }), // CLOSED → invisible
    // ADR-0041 §3: chuyến 2 ngày khởi hành NGÀY MAI giờ VN → N = 3, hạn chót đã
    // qua 2 ngày. Detail vẫn trả (`bookable: false`), còn giá RẺ NHẤT bộ này không
    // được kéo giá "from" xuống. Vẫn đúng nếu file chạy vắt qua nửa đêm giờ VN.
    dep('5', closingStart, {
      endDate: new Date(vnToday + 2 * 86_400_000),
      priceOverride: '19.00',
    }),
  ];
```

- [ ] **Step 7: Viết int test catalog đỏ — assertion list và detail** — cùng file:

Trước (dòng 209–212, trong test `'GET /api/tours returns published cards conforming to TourCardSchema'`):

```ts
    // priceFrom (19/08): min effectivePrice trên đợt OPEN sắp tới. Day tour có
    // `open60` (= basePrice 39) + `openOverride90` (59) + một đợt quá khứ → min là
    // basePrice 39.00, đợt quá khứ/override đắt hơn không kéo con số đi đâu.
    expect(card?.priceFrom).toBe(Number(dayTour.basePrice).toFixed(2));
```

Sau:

```ts
    // priceFrom (19/08, lọc `bookable` từ ADR-0041 §3): min effectivePrice trên đợt
    // OPEN còn nhận đặt. Day tour có `open60` (= basePrice 39) + `openOverride90`
    // (59) + một đợt quá khứ + chuyến 19.00 đã qua hạn đặt → min vẫn là basePrice
    // 39.00: chuyến không bán được nữa không kéo giá "from" xuống.
    expect(card?.priceFrom).toBe(Number(dayTour.basePrice).toFixed(2));
```

Trước (dòng 334–351, trong test `'GET /api/tours/{slug} returns detail with upcoming OPEN departures only'`):

```ts
    // Past + CLOSED filtered out; ordered by startDate asc.
    expect(detail.departures).toHaveLength(2);
    const [first, second] = detail.departures;
    expect(first).toMatchObject({
      id: departures[0]?.id,
      startDate: future60.toISOString().slice(0, 10),
      seatsLeft: 5, // 8 total − 3 booked
      compareAtPrice: null,
    });
    expect(Number(first?.effectivePrice)).toBe(Number(dayTour.basePrice)); // no override
    expect(second).toMatchObject({
      id: departures[1]?.id,
      startDate: future90.toISOString().slice(0, 10),
      seatsLeft: 10,
    });
    expect(Number(second?.effectivePrice)).toBe(59); // priceOverride wins
    expect(Number(second?.compareAtPrice)).toBe(75);
  });
```

Sau:

```ts
    // Past + CLOSED bị lọc; chuyến đã qua hạn đặt nhưng chưa khởi hành VẪN trả
    // về (spec §3.2); xếp theo startDate tăng dần.
    expect(detail.departures).toHaveLength(3);
    const [closing, first, second] = detail.departures;
    const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    expect(closing).toMatchObject({
      id: departures[4]?.id,
      startDate: isoDay(closingStart.getTime()),
      // L = 2 → N = 3: hạn chót = ngày mai − 3 = hôm kia (giờ VN).
      bookingDeadline: isoDay(vnToday - 2 * 86_400_000),
      bookable: false,
    });
    expect(first).toMatchObject({
      id: departures[0]?.id,
      startDate: future60.toISOString().slice(0, 10),
      seatsLeft: 5, // 8 total − 3 booked
      compareAtPrice: null,
      // Chuyến một ngày: N = 1, hạn chót là hôm trước ngày khởi hành.
      bookingDeadline: isoDay(future60.getTime() - 86_400_000),
      bookable: true,
    });
    expect(Number(first?.effectivePrice)).toBe(Number(dayTour.basePrice)); // no override
    expect(second).toMatchObject({
      id: departures[1]?.id,
      startDate: future90.toISOString().slice(0, 10),
      seatsLeft: 10,
      bookable: true,
    });
    expect(Number(second?.effectivePrice)).toBe(59); // priceOverride wins
    expect(Number(second?.compareAtPrice)).toBe(75);
    // Giá "from" của detail lọc `bookable` y như list — không in hai giá khác nhau.
    expect(detail.priceFrom).toBe(Number(dayTour.basePrice).toFixed(2));
  });
```

- [ ] **Step 8: Chạy int test, xác nhận đỏ** (Docker Postgres đang chạy)

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/catalog/catalog.int.spec.ts`

Expected: FAIL ba test —
- `GET /api/tours returns published cards…`: `priceFrom` là `'19.00'` thay vì `'39.00'` (list chưa lọc theo hạn đặt);
- `GET /api/tours/{slug} returns detail…` và `tour detail cũng trả rating…`: `TourDetailSchema.parse` ném ZodError vì response thiếu `bookingDeadline`, `bookable` (contract đã build ở Step 5).

Các test khác PASS.

- [ ] **Step 9: Cài đặt — import và JSDoc** — trong `apps/api/src/modules/catalog/catalog.service.ts`:

Trước (dòng Task 3 thêm):

```ts
import { vietnamToday } from '@tourism/contract';
```

Sau:

```ts
import { cancellationDeadline, isWithinDeadline, vietnamToday } from '@tourism/contract';
```

Trước (dòng 65–69):

```ts
/**
 * Giá "from" thật — `min(priceOverride ?? basePrice)` trên các đợt OPEN sắp tới
 * của tour; không có đợt → `basePrice`. Nhận MẢNG priceOverride (đã lọc theo
 * tour) để list tính một lần cho cả trang và detail dùng lại departures đã load.
 */
```

Sau:

```ts
/**
 * Giá "from" thật — `min(priceOverride ?? basePrice)` trên các đợt OPEN còn nhận
 * đặt (`bookable`, ADR-0041 §3) của tour; không có đợt → `basePrice`. Nhận MẢNG
 * priceOverride ĐÃ LỌC (theo tour và theo hạn đặt) để list tính một lần cho cả
 * trang và detail dùng lại departures đã load — hai bên lọc cùng một luật.
 */
```

- [ ] **Step 10: Cài đặt — `listTours` lọc giá theo hạn đặt** — cùng file, hai khối trong `listTours`:

Trước (đầu hàm):

```ts
  async listTours(query: ToursListQuery): Promise<Paged<TourCard>> {
    const { page, limit, category, destination, search, featured, sort, order } = query;

    const where: Prisma.TourWhereInput = {
```

Sau:

```ts
  async listTours(query: ToursListQuery): Promise<Paged<TourCard>> {
    const { page, limit, category, destination, search, featured, sort, order } = query;
    // MỘT mốc cho cả lượt đọc: lọc "chưa khởi hành" và luật "còn nhận đặt" nhìn
    // cùng một khoảnh khắc.
    const now = new Date();

    const where: Prisma.TourWhereInput = {
```

Trước (bản sau Task 3):

```ts
      // MỘT query đợt cho cả trang → `priceFrom` (giá "from" thật). Chỉ lấy hai
      // cột cần, lọc đúng như detail (OPEN + chưa khởi hành).
      prisma.tourDeparture.findMany({
        where: {
          tourId: { in: ids },
          status: DepartureStatus.OPEN,
          startDate: { gte: startOfVietnamToday(new Date()) },
        },
        select: { tourId: true, priceOverride: true },
      }),
    ]);
    const overridesByTour = new Map<string, (Prisma.Decimal | null)[]>();
    for (const d of upcoming) {
      const list = overridesByTour.get(d.tourId) ?? [];
      list.push(d.priceOverride);
      overridesByTour.set(d.tourId, list);
    }
```

Sau:

```ts
      // MỘT query đợt cho cả trang → `priceFrom` (giá "from" thật). Lọc đúng như
      // detail (OPEN + chưa khởi hành theo ngày Việt Nam); lấy thêm hai cột ngày vì
      // luật hạn chót N chỉ sống ở Node (spec §4.1), không viết lại trong SQL.
      prisma.tourDeparture.findMany({
        where: {
          tourId: { in: ids },
          status: DepartureStatus.OPEN,
          startDate: { gte: startOfVietnamToday(now) },
        },
        select: { tourId: true, priceOverride: true, startDate: true, endDate: true },
      }),
    ]);
    const overridesByTour = new Map<string, (Prisma.Decimal | null)[]>();
    for (const d of upcoming) {
      // Chuyến đã qua hạn đặt không bán được nữa → không kéo giá "from" xuống
      // (ADR-0041 §3) — cùng luật với cờ `bookable` của detail.
      if (!isWithinDeadline(now, calendarDate(d.startDate), calendarDate(d.endDate))) continue;
      const list = overridesByTour.get(d.tourId) ?? [];
      list.push(d.priceOverride);
      overridesByTour.set(d.tourId, list);
    }
```

- [ ] **Step 11: Cài đặt — `getTourBySlug` trả hai field và lọc giá** — cùng file, thay TOÀN BỘ hàm `getTourBySlug` (từ JSDoc `/** Detail của tour đã published…` tới hết hàm, bản sau Task 3) bằng:

```ts
  /** Detail của tour đã published, hoặc null (controller dịch thành NOT_FOUND). */
  async getTourBySlug(slug: string): Promise<TourDetail | null> {
    // MỘT mốc cho cả lượt đọc — lọc chuyến, `bookable` và giá "from" nhìn cùng
    // một khoảnh khắc.
    const now = new Date();
    const tour = await prisma.tour.findFirst({
      where: { slug, isPublished: true },
      include: {
        ...cardInclude,
        itinerary: { orderBy: { dayNumber: 'asc' } },
        faqs: { orderBy: { order: 'asc' } },
        policies: { orderBy: { order: 'asc' } },
        departures: {
          // VẪN gồm chuyến đã qua hạn đặt nhưng chưa khởi hành: trang tour hiện
          // chúng là "Booking closed" (spec §3.2), nên ở đây chỉ lọc "chưa khởi hành".
          where: {
            status: DepartureStatus.OPEN,
            startDate: { gte: startOfVietnamToday(now) },
          },
          orderBy: { startDate: 'asc' },
        },
      },
    });
    if (!tour) return null;

    // Detail cần CẢ BỘ ảnh (nuôi khảm gallery), khác list chỉ cần một tấm bìa.
    const media = (await this.media.resolveForOwners(MediaOwnerType.TOUR, [tour.id])).get(tour.id);

    // Luật hạn chót tính MỘT lần mỗi chuyến: vừa in `bookingDeadline`/`bookable`,
    // vừa lọc giá "from" — web không tự dựng luật N hay so giờ trình duyệt (Q7).
    const departureViews = tour.departures.map((row) => {
      const startDate = calendarDate(row.startDate);
      const endDate = calendarDate(row.endDate);
      return {
        row,
        startDate,
        endDate,
        bookingDeadline: cancellationDeadline(startDate, endDate),
        bookable: isWithinDeadline(now, startDate, endDate),
      };
    });

    return {
      ...toTourCard(
        tour,
        pickCover(media),
        priceFrom(
          tour.basePrice,
          departureViews.filter((view) => view.bookable).map((view) => view.row.priceOverride),
        ),
      ),
      media: media ?? [],
      suitableFor: tour.suitableFor,
      badges: tour.badges,
      included: tour.included,
      excluded: tour.excluded,
      highlights: tour.highlights,
      meetingPoint: tour.meetingPoint,
      // Nội dung bán hàng thêm ở ADR-0023. Bốn câu mô tả card dữ kiện và cửa
      // sổ huỷ miễn phí — chỉ có ở detail, KHÔNG lên `TourCardSchema`.
      factDurationNote: tour.factDurationNote,
      factGroupSizeNote: tour.factGroupSizeNote,
      factDifficultyNote: tour.factDifficultyNote,
      factGoodForNote: tour.factGoodForNote,
      freeCancellationDays: tour.freeCancellationDays,
      itinerary: tour.itinerary.map((day) => ({
        dayNumber: day.dayNumber,
        title: day.title,
        description: day.description,
      })),
      faqs: tour.faqs.map((faq) => ({
        question: faq.question,
        answer: faq.answer,
      })),
      policies: tour.policies.map((policy) => ({
        kind: policy.kind,
        title: policy.title,
        body: policy.body,
      })),
      departures: departureViews.map(({ row, startDate, endDate, bookingDeadline, bookable }) => ({
        id: row.id,
        startDate,
        endDate,
        seatsLeft: row.seatsTotal - row.seatsBooked,
        effectivePrice: money(row.priceOverride ?? tour.basePrice),
        compareAtPrice: row.compareAtPrice ? money(row.compareAtPrice) : null,
        bookingDeadline,
        bookable,
      })),
    };
  }
```

- [ ] **Step 12: Chạy int test, xác nhận xanh; typecheck API**

Run:

```bash
pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/catalog/catalog.int.spec.ts
pnpm --filter @tourism/api typecheck
```

Expected: int test PASS toàn file; typecheck exit 0 (object trả về khớp `TourDetail` mới có hai field).

- [ ] **Step 13: Typecheck web, xác nhận đỏ ở ba spec gõ `DepartureVM` trực tiếp**

Run: `pnpm --filter @tourism/web typecheck`

Expected: FAIL — lỗi thiếu thuộc tính `bookingDeadline`, `bookable` (TS2739) ở đúng ba chỗ: `src/components/booking/steps/steps.spec.tsx` (hằng `DEPARTURE: DepartureVM`), `src/components/tours/booking-rail.spec.tsx` (hằng `DEPARTURE: DepartureVM`), `src/components/tours/link-cta.spec.tsx` (literal không gõ kiểu truyền vào prop `departure: DepartureVM | undefined` của `BookingRail`).

- [ ] **Step 14: Sửa ba fixture web**

`apps/web/src/components/booking/steps/steps.spec.tsx` — trước (dòng 17–24):

```ts
const DEPARTURE: DepartureVM = {
  id: 'dep-open',
  startDate: '2026-09-12',
  endDate: '2026-09-23',
  seatsLeft: 9,
  effectivePrice: '1290.00',
  compareAtPrice: null,
};
```

Sau:

```ts
const DEPARTURE: DepartureVM = {
  id: 'dep-open',
  startDate: '2026-09-12',
  endDate: '2026-09-23',
  seatsLeft: 9,
  effectivePrice: '1290.00',
  compareAtPrice: null,
  // Chuyến 12 ngày: N = 7 (ADR-0041 §2) — fixture chỉ cần khớp kiểu contract.
  bookingDeadline: '2026-09-05',
  bookable: true,
};
```

`apps/web/src/components/tours/booking-rail.spec.tsx` — trước (dòng 15–22):

```ts
const DEPARTURE: DepartureVM = {
  id: 'd1',
  startDate: '2026-09-14',
  endDate: '2026-09-17',
  seatsLeft: 6,
  effectivePrice: '329.00',
  compareAtPrice: '369.00',
};
```

Sau:

```ts
const DEPARTURE: DepartureVM = {
  id: 'd1',
  startDate: '2026-09-14',
  endDate: '2026-09-17',
  seatsLeft: 6,
  effectivePrice: '329.00',
  compareAtPrice: '369.00',
  // Chuyến 4 ngày: N = 7 (ADR-0041 §2).
  bookingDeadline: '2026-09-07',
  bookable: true,
};
```

`apps/web/src/components/tours/link-cta.spec.tsx` — trước (dòng 24–31):

```ts
const DEPARTURE = {
  id: 'dep-1',
  startDate: '2026-08-21',
  endDate: '2026-08-22',
  seatsLeft: 4,
  effectivePrice: '2400000.00',
  compareAtPrice: null,
};
```

Sau:

```ts
const DEPARTURE = {
  id: 'dep-1',
  startDate: '2026-08-21',
  endDate: '2026-08-22',
  seatsLeft: 4,
  effectivePrice: '2400000.00',
  compareAtPrice: null,
  // Chuyến 2 ngày: N = 3 (ADR-0041 §2). `BookingRail` nhận `DepartureVM` nên
  // literal phải đủ field của contract.
  bookingDeadline: '2026-08-18',
  bookable: true,
};
```

- [ ] **Step 15: Typecheck và test web, xác nhận xanh**

Run:

```bash
pnpm --filter @tourism/web typecheck
pnpm --filter @tourism/web exec vitest run src/components/booking/steps/steps.spec.tsx src/components/tours/booking-rail.spec.tsx src/components/tours/link-cta.spec.tsx
pnpm --filter @tourism/admin typecheck
```

Expected: cả ba exit 0 / PASS. (Admin không đọc departure của catalog; lệnh cuối chỉ xác nhận contract mới không gãy nó.)

- [ ] **Step 16: Format và soát diff**

Run:

```bash
pnpm lint:fix
git status --short
```

Expected: chỉ bảy file của task đổi (cộng các mục untracked có từ trước như `docs/screenshot/`, không add).

- [ ] **Step 17: Cổng đầy đủ** (Docker Postgres đang chạy; Git Bash, gốc repo)

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu lệnh exit 0 (typecheck của `apps/mobile` không đổi vì mobile không dựng object departure).

- [ ] **Step 18: Commit**

```bash
git add libs/shared/contract/src/schemas/catalog.ts libs/shared/contract/src/schemas/catalog.spec.ts apps/api/src/modules/catalog/catalog.service.ts apps/api/src/modules/catalog/catalog.int.spec.ts apps/web/src/components/booking/steps/steps.spec.tsx apps/web/src/components/tours/booking-rail.spec.tsx apps/web/src/components/tours/link-cta.spec.tsx
git commit -m "feat(catalog): trả hạn chót đặt chỗ và cờ bookable từng chuyến, giá from chỉ tính chuyến còn nhận đặt"
```
---

### Task 6: Lõi huỷ và `bookings.cancel` huỷ ngay

**Files:**
- Create: `apps/api/src/modules/bookings/booking-cancellation.ts`
- Create: `apps/api/src/modules/bookings/booking-cancellation.spec.ts`
- Modify: `libs/shared/contract/src/schemas/bookings.ts`
  - `BookingSchema` dòng 104–105
  - sau `RefundEstimate` dòng 214
  - `BookingDetailSchema` dòng 216–233
  - `CancelBookingInputSchema` dòng 348–359
- Modify: `libs/shared/contract/src/contract.ts` (import dòng 14–15; route `bookings.cancel` dòng 522–544)
- Modify: `apps/api/src/modules/bookings/bookings.service.ts` (import; `toBooking` dòng 183–185; `byCode` return dòng 762–764)
- Modify: `apps/api/src/modules/bookings/cancellations.service.ts`
  - import dòng 1–24
  - xoá `CancellationAlreadyRequestedError` dòng 33–38
  - JSDoc lớp dòng 126–140
  - thay `request()` dòng 150–233
  - xoá `isOneLiveRequestViolation` dòng 674–694
- Modify: `apps/api/src/modules/bookings/bookings.controller.ts` (import dòng 14–19; handler `cancel` dòng 103–121)
- Modify (sửa tối thiểu cho typecheck):
  - `apps/web/src/test/fixtures/booking.ts`
  - `apps/admin/src/lib/bookings-view.spec.ts`
  - `apps/admin/src/lib/bookings-csv.spec.ts`
- Test: `libs/shared/contract/src/schemas/bookings.spec.ts`
- Test: `apps/api/src/modules/bookings/cancellations.int.spec.ts`
- Test: `apps/api/src/modules/bookings/bookings.int.spec.ts` (hai test `cancellationStatus` dòng 723–841; thêm một test)

**Interfaces:**
- Consumes:
  - Hợp đồng A (Task 1, `@tourism/contract`): `cancellationDeadline`, `isWithinDeadline`, `canCancelOnline`, `refundOnCancel`, `vietnamToday`.
  - Task 2:
    - `EmailType.BOOKING_CANCELLED` có trong DB và Prisma client.
    - `cancellation_requests.reason` nullable; `CancellationRequestSchema.reason` nullable.
    - Case email `BOOKING_CANCELLED` đọc payload Hợp đồng C.
  - Task 4: fixture `depSoon` chuyến 1 ngày trong `cancellations.int.spec.ts` (giữ nguyên); `create` vẫn tạo được booking trên chuyến còn trong hạn.
  - Có sẵn trong repo:
    - `withBookingRefundLock` (`refund-lock.ts`)
    - `RefundsService.executeGatewayRefund`, `BookingNotFoundError`, `ProviderRefundFailedError` (`refunds.service.ts`)
    - `toBooking`, `bookingTourInclude`, `resolveTourCover` (`bookings.service.ts`)
    - `calendarDate`, `startOfDayUtc` (`apps/api/src/lib/calendar-date.ts`)
    - `FakeGateway.refunds` / `.failRefunds` / `.refundDelayMs` (`apps/api/src/modules/payments/fake.gateway.ts`)
- Produces:
  - Hợp đồng B:
    - `BookingCancellationSchema` / `BookingCancellation`
    - `BookingSchema.cancellationDeadline`
    - `BookingDetailSchema.cancellation` (giữ `refundEstimate`)
    - `CancelBookingInputSchema` với `reason` optional
    - `CancelBookingResultSchema` / `CancelBookingResult`
    - route `bookings.cancel` với output và errors mới
  - Hợp đồng C:
    - `CancellationsService.cancelByCustomer(userId, bookingCode, reason, now = new Date()): Promise<CancelBookingResult>`
    - `export interface CancelInLockInput`
    - `private cancelInLock(tx: Prisma.TransactionClient, booking: Prisma.BookingModel, input: CancelInLockInput): Promise<void>`
  - Tên mới trong `apps/api/src/modules/bookings/booking-cancellation.ts`:
    - `interface CancellableBooking { status: BookingStatus; departureStartDate: Date; departureEndDate: Date; totalAmount: Prisma.Decimal; providerPaymentId: string | null }`
    - `isCancellableStatus(status: BookingStatus): boolean`
    - `cancellationBlocker(booking: CancellableBooking, now: Date): string | null`
    - `refundOnCancelForBooking(booking: CancellableBooking, refundedTotal: Prisma.Decimal | null, now: Date): string`
    - `bookingCancellation(booking: CancellableBooking, refundedTotal: Prisma.Decimal | null, now: Date): BookingCancellation | null`
  - Gỡ: `CancellationsService.request`, `CancellationAlreadyRequestedError`, `isOneLiveRequestViolation`, lỗi contract `ALREADY_REQUESTED`.

- [ ] **Step 1: Viết test contract đỏ**

Trong `libs/shared/contract/src/schemas/bookings.spec.ts`:

(a) Thay khối import đầu file bằng:

```ts
import {
  AdminBookingsListQuerySchema,
  AdminCancellationsListQuerySchema,
  AdminRefundInputSchema,
  BookingCancellationSchema,
  BookingDetailSchema,
  BookingSchema,
  BookingsListQuerySchema,
  CancelBookingInputSchema,
  CancelBookingResultSchema,
  CancellationRequestSchema,
  CreateBookingInputSchema,
  DecideCancellationInputSchema,
  PaymentProviderSchema,
} from './bookings.js';
```

(b) Trong test `'W1: free-text trim ở CONTRACT — reason/decisionNote/refund reason, một luật một chỗ'`, ngay sau dòng `expect(cancel.reason).toBe('need to cancel');` thêm:

```ts
    // ADR-0041: lý do không bắt buộc — vắng hẳn là hợp lệ; có gửi thì vẫn trim + min(1).
    expect(CancelBookingInputSchema.parse({ code: 'BK-ABCDEFGH' })).toEqual({
      code: 'BK-ABCDEFGH',
    });
```

(c) Thêm dòng `cancellationDeadline` ngay SAU dòng `departureEndDate` trong năm object booking mẫu (ngày chót tính theo spec §3.1):

| Object | Ngày | Dòng thêm |
| --- | --- | --- |
| object truyền vào `BookingSchema.parse` của test `'parses the public booking shape …'` | 18/09 → 18/09, L = 1, N = 1 | `cancellationDeadline: '2026-09-17',` |
| `withDests` của test `'carries tourDestinations as DestinationLink[] …'` | 18/09 → 18/09 | `cancellationDeadline: '2026-09-17',` |
| `base` của test `'carries the cancellation timestamps as nullable ISO datetimes'` | 12/09 → 23/09, L = 12, N = 7 | `cancellationDeadline: '2026-09-05',` |
| `base` của test `'always carries refundedTotal as a decimal string, never a float or null'` | 12/09 → 23/09 | `cancellationDeadline: '2026-09-05',` |
| `validBooking` | 18/09 → 18/09 | `cancellationDeadline: '2026-09-17',` |

(d) Thêm vào CUỐI file:

```ts
/**
 * ADR-0041 — hạn chót huỷ miễn phí do SERVER tính, web/admin chỉ in (Q7).
 */
describe('BookingSchema.cancellationDeadline — ADR-0041', () => {
  it('là ngày lịch YYYY-MM-DD và bắt buộc có mặt', () => {
    expect(BookingSchema.parse(validBooking).cancellationDeadline).toBe('2026-09-17');
    expect(
      BookingSchema.safeParse({ ...validBooking, cancellationDeadline: '2026-09-17T00:00:00.000Z' })
        .success,
    ).toBe(false);
    const { cancellationDeadline: _drop, ...missing } = validBooking;
    expect(BookingSchema.safeParse(missing).success).toBe(false);
  });
});

describe('BookingCancellationSchema / BookingDetailSchema.cancellation — ADR-0041', () => {
  const cancellation = {
    deadline: '2026-09-17',
    withinDeadline: true,
    refundAmount: '117.00',
    canCancel: true,
  };

  it('nhận đủ bốn trường; tiền là chuỗi thập phân, ngày là ngày lịch', () => {
    expect(BookingCancellationSchema.parse(cancellation)).toEqual(cancellation);
    expect(BookingCancellationSchema.safeParse({ ...cancellation, refundAmount: 117 }).success).toBe(
      false,
    );
    expect(
      BookingCancellationSchema.safeParse({ ...cancellation, deadline: '17/09/2026' }).success,
    ).toBe(false);
  });

  it('BookingDetailSchema mang cancellation nullable, không optional', () => {
    const detail = { ...validBooking, review: null, refundEstimate: null, cancellation };
    expect(BookingDetailSchema.parse(detail).cancellation).toEqual(cancellation);
    expect(BookingDetailSchema.parse({ ...detail, cancellation: null }).cancellation).toBeNull();
    const { cancellation: _drop, ...missing } = detail;
    expect(BookingDetailSchema.safeParse(missing).success).toBe(false);
  });
});

describe('CancelBookingResultSchema — ADR-0041', () => {
  it('booking sau khi huỷ kèm số tiền lần huỷ này đã hoàn', () => {
    const result = {
      booking: { ...validBooking, status: 'CANCELLED', cancelledAt: '2026-09-15T03:00:00.000Z' },
      refundedAmount: '0.00',
    };
    expect(CancelBookingResultSchema.parse(result).refundedAmount).toBe('0.00');
    expect(CancelBookingResultSchema.safeParse({ ...result, refundedAmount: 0 }).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `pnpm --filter @tourism/contract exec vitest run src/schemas/bookings.spec.ts`

Expected: FAIL.
- Test W1 trim: ZodError vì `reason` còn bắt buộc.
- `BookingSchema.cancellationDeadline — ADR-0041`: nhận `undefined`, vì Zod bỏ khoá lạ.
- Hai describe dùng `BookingCancellationSchema` / `CancelBookingResultSchema`: `TypeError … is undefined`.

- [ ] **Step 3: Cài đặt schema contract**

`libs/shared/contract/src/schemas/bookings.ts`.

(a) `BookingSchema`, trước:

```ts
  departureStartDate: z.iso.date(),
  departureEndDate: z.iso.date(),
  unitPrice: DecimalStringSchema,
```

sau:

```ts
  departureStartDate: z.iso.date(),
  departureEndDate: z.iso.date(),
  /**
   * Ngày chót huỷ miễn phí của chuyến đã mua (ADR-0041 §2): ngày khởi hành − N,
   * N theo độ dài chuyến. SERVER tính từ snapshot ngày đi/ngày về bằng
   * `cancellationDeadline` của contract; web/admin chỉ in (Q7). Có mặt ở MỌI
   * route trả booking — một ngày lịch, không tốn query nào.
   */
  cancellationDeadline: z.iso.date(),
  unitPrice: DecimalStringSchema,
```

(b) Ngay sau dòng `export type RefundEstimate = z.output<typeof RefundEstimateSchema>;` thêm:

```ts
/**
 * Trạng thái huỷ của booking lúc ĐỌC `bookings.byCode` (ADR-0041 §4) — SERVER
 * tính bằng bộ hàm luật của contract, cùng đường với lệnh huỷ thật, nên con số
 * khách thấy là con số server hoàn. Web không so ngày bằng giờ trình duyệt (Q7).
 */
export const BookingCancellationSchema = z.object({
  /** Ngày chót huỷ miễn phí, hết lúc 23:59:59 giờ Việt Nam. */
  deadline: z.iso.date(),
  /** Hôm nay (giờ Việt Nam) còn ≤ ngày chót. */
  withinDeadline: z.boolean(),
  /** Số sẽ hoàn nếu huỷ ngay: phần còn lại khi trong hạn, `'0.00'` khi quá hạn. */
  refundAmount: DecimalStringSchema,
  /** Còn nút huỷ: chưa tới ngày khởi hành và có capture để hoàn vào. */
  canCancel: z.boolean(),
});

export type BookingCancellation = z.output<typeof BookingCancellationSchema>;
```

(c) `BookingDetailSchema`, trước:

```ts
  refundEstimate: RefundEstimateSchema.nullable(),
});

export type BookingDetail = z.output<typeof BookingDetailSchema>;
```

sau:

```ts
  refundEstimate: RefundEstimateSchema.nullable(),
  /**
   * ADR-0041: trạng thái huỷ theo hạn chót — `null` khi booking không ở PAID
   * hoặc PARTIALLY_REFUNDED. Thay `refundEstimate` (còn giữ tới khi web chuyển
   * xong, plan 15/09 Task 13).
   */
  cancellation: BookingCancellationSchema.nullable(),
});

export type BookingDetail = z.output<typeof BookingDetailSchema>;
```

(d) Thay nguyên khối từ JSDoc `/** Input cho \`bookings.cancel\` …` tới hết dòng `export type CancelBookingInput = z.output<typeof CancelBookingInputSchema>;` bằng:

```ts
/**
 * Input cho `bookings.cancel` — khách huỷ NGAY (ADR-0041 §4). Lý do không bắt
 * buộc: vắng thì dòng yêu cầu huỷ ghi `null`.
 *
 * `.trim()` ở CONTRACT (W1, khuôn `reviews.ts`): luật một chỗ. Trước đây input
 * `min(1)` không trim còn service trim rồi ghi `''` — row lọt qua rồi nổ output
 * validation (500) ở chính `bookings.cancel` và `admin.cancellations.list` (cả
 * trang). Có gửi thì vẫn phải có chữ: toàn khoảng trắng là 400.
 */
export const CancelBookingInputSchema = z.object({
  code: BookingCodeSchema,
  reason: z.string().trim().min(1).max(1000).optional(),
});

export type CancelBookingInput = z.output<typeof CancelBookingInputSchema>;

/**
 * Output của `bookings.cancel`: booking sau khi huỷ kèm số tiền LẦN HUỶ NÀY đã
 * hoàn (`'0.00'` khi quá hạn chót). `booking.refundedTotal` là tổng sổ sau huỷ.
 */
export const CancelBookingResultSchema = z.object({
  booking: BookingSchema,
  refundedAmount: DecimalStringSchema,
});

export type CancelBookingResult = z.output<typeof CancelBookingResultSchema>;
```

- [ ] **Step 4: Cài đặt route contract**

`libs/shared/contract/src/contract.ts`, khối import từ `'./schemas/bookings.js'`, trước:

```ts
  CancelBookingInputSchema,
  CancellationRequestSchema,
  CreateBookingInputSchema,
```

sau (`CancellationRequestSchema` chỉ dùng ở output cũ của route này nên bỏ khỏi import):

```ts
  CancelBookingInputSchema,
  CancelBookingResultSchema,
  CreateBookingInputSchema,
```

Thay nguyên `cancel: oc … .output(CancellationRequestSchema),` trong nhóm `bookings` bằng:

```ts
    cancel: oc
      .route({
        method: 'POST',
        path: '/api/bookings/{code}/cancel',
        summary:
          'Cancel an own paid booking now; full refund before the cancellation deadline (authed, owner-only)',
      })
      .input(CancelBookingInputSchema)
      .errors({
        // Owner-or-404, cùng policy với byCode.
        NOT_FOUND: { message: 'Booking not found' },
        // ADR-0041: trạng thái ngoài PAID/PARTIALLY_REFUNDED, không có capture,
        // đã tới ngày khởi hành (giờ Việt Nam), hoặc lệnh huỷ thứ hai — gộp một
        // code: cách nào thì booking cũng không huỷ online được nữa.
        NOT_CANCELLABLE: { status: 422, message: 'This booking can no longer be cancelled online' },
        // Cổng thanh toán từ chối hoàn — không ghi gì, booking giữ nguyên, thử lại được.
        REFUND_FAILED: { status: 502, message: 'Provider refund failed' },
      })
      .output(CancelBookingResultSchema),
```

- [ ] **Step 5: Chạy, xác nhận xanh; build contract và i18n**

```bash
pnpm --filter @tourism/contract exec vitest run src/schemas/bookings.spec.ts src/contract.spec.ts
pnpm --filter @tourism/contract build
pnpm --filter @tourism/i18n build
```

Expected: PASS toàn bộ; hai build không lỗi.

- [ ] **Step 6: Viết unit test đỏ cho luật huỷ tầng API**

Tạo `apps/api/src/modules/bookings/booking-cancellation.spec.ts`:

```ts
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus } from '../../generated/prisma/enums.js';
import {
  bookingCancellation,
  type CancellableBooking,
  cancellationBlocker,
  isCancellableStatus,
  refundOnCancelForBooking,
} from './booking-cancellation.js';

/**
 * TDD (plan 15/09 Task 6) cho luật huỷ ở tầng API: bọc bộ hàm luật của contract
 * quanh SNAPSHOT ngày của booking. Chuyến mẫu 20/10 → 21/10 dài 2 ngày nên N = 3,
 * ngày chót 17/10 (spec §3.1). Mọi mốc viết bằng UTC; giờ Việt Nam = UTC + 7,
 * ghi cạnh từng mốc.
 */
function makeBooking(overrides: Partial<CancellableBooking> = {}): CancellableBooking {
  return {
    status: BookingStatus.PAID,
    departureStartDate: new Date('2026-10-20T00:00:00.000Z'),
    departureEndDate: new Date('2026-10-21T00:00:00.000Z'),
    totalAmount: new Prisma.Decimal('117.00'),
    providerPaymentId: 'pi_test_1',
    ...overrides,
  };
}

/** 10:00 ngày 10/10 giờ Việt Nam — còn xa ngày chót. */
const EARLY = new Date('2026-10-10T03:00:00.000Z');

describe('isCancellableStatus', () => {
  it('chỉ PAID và PARTIALLY_REFUNDED — REFUNDED thì khách liên hệ (spec §3.3)', () => {
    expect(isCancellableStatus(BookingStatus.PAID)).toBe(true);
    expect(isCancellableStatus(BookingStatus.PARTIALLY_REFUNDED)).toBe(true);
    expect(isCancellableStatus(BookingStatus.PENDING)).toBe(false);
    expect(isCancellableStatus(BookingStatus.CANCELLED)).toBe(false);
    expect(isCancellableStatus(BookingStatus.REFUNDED)).toBe(false);
  });
});

describe('cancellationBlocker', () => {
  it('PAID còn capture, trước ngày khởi hành → null (huỷ được)', () => {
    expect(cancellationBlocker(makeBooking(), EARLY)).toBeNull();
  });

  it('trạng thái ngoài PAID/PARTIALLY_REFUNDED → nêu trạng thái', () => {
    expect(cancellationBlocker(makeBooking({ status: BookingStatus.REFUNDED }), EARLY)).toMatch(
      /REFUNDED/,
    );
    expect(cancellationBlocker(makeBooking({ status: BookingStatus.PENDING }), EARLY)).toMatch(
      /PENDING/,
    );
  });

  it('không có capture → không có chỗ hoàn vào', () => {
    expect(cancellationBlocker(makeBooking({ providerPaymentId: null }), EARLY)).toMatch(
      /captured payment/,
    );
  });

  it('23:59:59 giờ VN hôm trước ngày khởi hành → vẫn huỷ được', () => {
    expect(cancellationBlocker(makeBooking(), new Date('2026-10-19T16:59:59.999Z'))).toBeNull();
  });

  it('00:00 giờ VN ngày khởi hành → hết huỷ online', () => {
    expect(cancellationBlocker(makeBooking(), new Date('2026-10-19T17:00:00.000Z'))).toMatch(
      /departure date/,
    );
  });

  it('06:30 giờ VN ngày khởi hành, UTC còn là hôm trước → vẫn chặn (thước UTC cũ để lọt)', () => {
    expect(cancellationBlocker(makeBooking(), new Date('2026-10-19T23:30:00.000Z'))).toMatch(
      /departure date/,
    );
  });
});

describe('refundOnCancelForBooking', () => {
  it('trong hạn: hoàn phần còn lại của sổ', () => {
    expect(refundOnCancelForBooking(makeBooking(), null, EARLY)).toBe('117.00');
    expect(refundOnCancelForBooking(makeBooking(), new Prisma.Decimal('17.00'), EARLY)).toBe(
      '100.00',
    );
  });

  it('23:59:59 giờ VN đúng ngày chót → vẫn trong hạn', () => {
    expect(
      refundOnCancelForBooking(makeBooking(), null, new Date('2026-10-17T16:59:59.999Z')),
    ).toBe('117.00');
  });

  it('00:00 giờ VN ngày sau ngày chót → hoàn 0', () => {
    expect(
      refundOnCancelForBooking(makeBooking(), null, new Date('2026-10-17T17:00:00.000Z')),
    ).toBe('0.00');
  });
});

describe('bookingCancellation', () => {
  it('PAID trong hạn → ngày chót, trong hạn, hoàn đủ, huỷ được', () => {
    expect(bookingCancellation(makeBooking(), null, EARLY)).toEqual({
      deadline: '2026-10-17',
      withinDeadline: true,
      refundAmount: '117.00',
      canCancel: true,
    });
  });

  it('PARTIALLY_REFUNDED quá hạn nhưng chưa khởi hành → hoàn 0, vẫn huỷ được', () => {
    expect(
      bookingCancellation(
        makeBooking({ status: BookingStatus.PARTIALLY_REFUNDED }),
        new Prisma.Decimal('17.00'),
        new Date('2026-10-18T03:00:00.000Z'),
      ),
    ).toEqual({ deadline: '2026-10-17', withinDeadline: false, refundAmount: '0.00', canCancel: true });
  });

  it('không có capture → canCancel false, vẫn in ngày chót và số tiền theo luật', () => {
    expect(bookingCancellation(makeBooking({ providerPaymentId: null }), null, EARLY)).toEqual({
      deadline: '2026-10-17',
      withinDeadline: true,
      refundAmount: '117.00',
      canCancel: false,
    });
  });

  it.each([BookingStatus.PENDING, BookingStatus.CANCELLED, BookingStatus.REFUNDED])(
    'trạng thái %s → null',
    (status) => {
      expect(bookingCancellation(makeBooking({ status }), null, EARLY)).toBeNull();
    },
  );

  it('chuyến 4 ngày → N = 7, ngày chót sớm hơn', () => {
    const long = makeBooking({ departureEndDate: new Date('2026-10-23T00:00:00.000Z') });
    expect(bookingCancellation(long, null, EARLY)?.deadline).toBe('2026-10-13');
  });
});
```

- [ ] **Step 7: Chạy, xác nhận đỏ**

Run: `pnpm --filter @tourism/api exec vitest run src/modules/bookings/booking-cancellation.spec.ts`

Expected: FAIL. Vitest không load được `./booking-cancellation.js` (module chưa tồn tại).

- [ ] **Step 8: Tạo `apps/api/src/modules/bookings/booking-cancellation.ts`**

```ts
import type { BookingCancellation } from '@tourism/contract';
import {
  canCancelOnline,
  cancellationDeadline,
  isWithinDeadline,
  refundOnCancel,
} from '@tourism/contract';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus } from '../../generated/prisma/enums.js';
import { calendarDate } from '../../lib/calendar-date.js';

/**
 * Luật huỷ của MỘT booking ở tầng API (ADR-0041 §4) — hàm thuần, không đọc DB.
 * Hai nơi dùng chung để con số khách THẤY là con số server HOÀN:
 * `bookings.byCode` (trường `cancellation`) và lõi huỷ trong
 * `CancellationsService` (chặn trước khi gọi cổng thanh toán).
 *
 * Ngày chuyến đọc từ SNAPSHOT của booking (`departure_start_date`,
 * `departure_end_date`), không join sống chuyến: sửa chuyến sau khi đặt không
 * đổi hạn chót đã hứa với khách.
 */

/** Phần booking mà luật huỷ cần — cắt đúng chừng này để test dựng bằng object thuần. */
export interface CancellableBooking {
  status: BookingStatus;
  departureStartDate: Date;
  departureEndDate: Date;
  totalAmount: Prisma.Decimal;
  providerPaymentId: string | null;
}

/** PAID hoặc PARTIALLY_REFUNDED — hai trạng thái luật huỷ áp dụng; REFUNDED thì khách liên hệ. */
export function isCancellableStatus(status: BookingStatus): boolean {
  return status === BookingStatus.PAID || status === BookingStatus.PARTIALLY_REFUNDED;
}

/**
 * Lý do booking KHÔNG huỷ online được lúc `now`, hoặc `null` khi huỷ được. Chuỗi
 * trả về là chi tiết cho log và thông điệp lỗi 422, không phải copy cho khách
 * (web in câu của `@tourism/i18n`).
 */
export function cancellationBlocker(booking: CancellableBooking, now: Date): string | null {
  if (!isCancellableStatus(booking.status)) {
    return `booking is ${booking.status}; only a PAID or PARTIALLY_REFUNDED booking can be cancelled online`;
  }
  if (booking.providerPaymentId === null) {
    return 'booking has no captured payment to refund against';
  }
  if (!canCancelOnline(now, calendarDate(booking.departureStartDate))) {
    return 'the departure date has been reached (Vietnam time)';
  }
  return null;
}

/**
 * Số tiền hoàn nếu huỷ lúc `now`, dạng `'117.00'`: trong hạn là phần còn lại của
 * sổ, quá hạn là `'0.00'`. `refundedTotal` là SUM(refunds); `null` = chưa hoàn
 * đồng nào. Không kiểm `cancellationBlocker` — người gọi tự quyết thứ tự.
 */
export function refundOnCancelForBooking(
  booking: CancellableBooking,
  refundedTotal: Prisma.Decimal | null,
  now: Date,
): string {
  return refundOnCancel({
    now,
    startDate: calendarDate(booking.departureStartDate),
    endDate: calendarDate(booking.departureEndDate),
    totalAmount: booking.totalAmount.toFixed(2),
    refundedTotal: (refundedTotal ?? new Prisma.Decimal(0)).toFixed(2),
  });
}

/**
 * Trường `bookings.byCode.cancellation` (plan 15/09 Hợp đồng B): `null` khi
 * trạng thái ngoài PAID/PARTIALLY_REFUNDED.
 */
export function bookingCancellation(
  booking: CancellableBooking,
  refundedTotal: Prisma.Decimal | null,
  now: Date,
): BookingCancellation | null {
  if (!isCancellableStatus(booking.status)) return null;
  const startDate = calendarDate(booking.departureStartDate);
  const endDate = calendarDate(booking.departureEndDate);
  return {
    deadline: cancellationDeadline(startDate, endDate),
    withinDeadline: isWithinDeadline(now, startDate, endDate),
    refundAmount: refundOnCancelForBooking(booking, refundedTotal, now),
    canCancel: cancellationBlocker(booking, now) === null,
  };
}
```

- [ ] **Step 9: Chạy, xác nhận xanh**

Run: `pnpm --filter @tourism/api exec vitest run src/modules/bookings/booking-cancellation.spec.ts`

Expected: PASS toàn bộ. Mọi nhánh của bốn hàm đều có ít nhất một ca: ba nhánh của `cancellationBlocker` cộng nhánh `null`, hai nhánh của `bookingCancellation`, hai vế của `refundedTotal ?? 0`.

- [ ] **Step 10: Viết int test đỏ trong `bookings.int.spec.ts`**

`apps/api/src/modules/bookings/bookings.int.spec.ts`.

(a) Import dòng 3, trước:

```ts
import { BookingSchema, PagedSchema } from '@tourism/contract';
```

sau:

```ts
import {
  BookingDetailSchema,
  BookingSchema,
  cancellationDeadline,
  PagedSchema,
  vietnamToday,
} from '@tourism/contract';
```

(b) Thay nguyên test `'GET /api/bookings/{code}: cancellationStatus null trước khi xin hủy, REQUESTED sau khi xin'` bằng:

```ts
  it('GET /api/bookings/{code}: cancellationStatus null trước khi huỷ, REFUNDED sau khi khách tự huỷ (ADR-0041)', async () => {
    const alice = await signUpUser('alice-cancel-status@example.com', 'Alice');
    const created = (await createBooking(alice)).json();
    // Mô phỏng claim PAID như webhook thật: có capture để hoàn vào (lõi huỷ chặn
    // booking không có provider_payment_id) và ghế đã được đếm — để lượt nhả
    // ghế khi huỷ trả depOpen về đúng 3 cho các test sau.
    await prisma.booking.update({
      where: { code: created.code },
      data: {
        status: BookingStatus.PAID,
        paidAt: new Date(),
        providerPaymentId: 'fake_pi_cancel_status',
      },
    });
    await prisma.tourDeparture.update({
      where: { id: depOpen.id },
      data: { seatsBooked: { increment: 3 } },
    });

    const before = BookingSchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/bookings/${created.code}`,
          headers: { cookie: alice },
        })
      ).json(),
    );
    expect(before.cancellationStatus).toBeNull();

    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/bookings/${created.code}/cancel`,
      headers: { cookie: alice },
      payload: { reason: 'Change of plans' },
    });
    expect(cancelRes.statusCode).toBe(200);

    const after = BookingSchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/bookings/${created.code}`,
          headers: { cookie: alice },
        })
      ).json(),
    );
    expect(after.status).toBe('CANCELLED');
    // Huỷ ngay vẫn ghi MỘT dòng yêu cầu đã giải quyết (REFUNDED), kể cả khi hoàn 0.
    expect(after.cancellationStatus).toBe('REFUNDED');
    const departure = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: depOpen.id } });
    expect(departure.seatsBooked).toBe(3);
  });
```

(c) Thay nguyên test `'GET /api/bookings/{code}: cancellationStatus phản ánh request MỚI NHẤT (DENIED sau khi admin quyết)'` bằng:

```ts
  it('GET /api/bookings/{code}: cancellationStatus phản ánh request MỚI NHẤT (DENIED rồi REQUESTED)', async () => {
    const alice = await signUpUser('alice-cancel-denied@example.com', 'Alice');
    const created = (await createBooking(alice)).json();
    await prisma.booking.update({
      where: { code: created.code },
      data: { status: BookingStatus.PAID },
    });
    const aliceRow = await prisma.user.findUniqueOrThrow({
      where: { email: 'alice-cancel-denied@example.com' },
    });

    // `bookings.cancel` không còn tạo yêu cầu REQUESTED/DENIED (ADR-0041), nhưng
    // dữ liệu cũ kiểu này vẫn nằm trên prod tới lượt seed lại — dựng thẳng bằng
    // Prisma. Lùi createdAt để dòng DENIED CHẮC CHẮN là dòng cũ nhất.
    const denied = await prisma.cancellationRequest.create({
      data: {
        bookingId: created.id as string,
        userId: aliceRow.id,
        reason: 'Change of plans',
        status: CancellationRequestStatus.DENIED,
        decidedAt: new Date(),
        createdAt: new Date(Date.now() - 60_000),
      },
    });

    const afterDeny = BookingSchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/bookings/${created.code}`,
          headers: { cookie: alice },
        })
      ).json(),
    );
    expect(afterDeny.cancellationStatus).toBe('DENIED');

    // Booking giờ có HAI dòng: DENIED cũ + REQUESTED mới (createdAt = now). Đây là
    // bằng chứng khoá mệnh đề `orderBy createdAt desc` trong
    // `bookings.service.ts#byCode` — đảo thành `asc` thì `findFirst` trả dòng
    // DENIED và assertion `toBe('REQUESTED')` bên dưới phải ĐỎ.
    const reopened = await prisma.cancellationRequest.create({
      data: { bookingId: created.id as string, userId: aliceRow.id, reason: 'Asking again' },
    });
    expect(reopened.id).not.toBe(denied.id);

    const rows = await prisma.cancellationRequest.findMany({
      where: { bookingId: created.id as string },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => r.status)).toEqual([
      CancellationRequestStatus.DENIED,
      CancellationRequestStatus.REQUESTED,
    ]);

    const afterReRequest = BookingSchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/bookings/${created.code}`,
          headers: { cookie: alice },
        })
      ).json(),
    );
    expect(afterReRequest.cancellationStatus).toBe('REQUESTED');
  });
```

(d) Ngay sau test vừa thay ở (c), thêm:

```ts
  it('ADR-0041: byCode trả cancellation do SERVER tính — PENDING/CANCELLED null, trong hạn hoàn đủ, PARTIALLY_REFUNDED phần còn lại, ngày khởi hành hết huỷ', async () => {
    const cookie = await signUpUser('cancellation-shape@example.com');
    const created = (await createBooking(cookie)).json() as { id: string; code: string };
    const read = async () =>
      BookingDetailSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: `/api/bookings/${created.code}`,
            headers: { cookie },
          })
        ).json(),
      );

    // Mọi booking mang ngày chót, tính từ snapshot ngày đi/ngày về.
    const pending = await read();
    expect(pending.cancellationDeadline).toBe(
      cancellationDeadline(pending.departureStartDate, pending.departureEndDate),
    );
    // PENDING: chưa trả tiền → luật huỷ không áp dụng.
    expect(pending.cancellation).toBeNull();

    // PAID trên depOpen (+60 ngày) → còn trong hạn: hoàn đủ, có nút huỷ.
    await prisma.booking.update({
      where: { id: created.id },
      data: { status: BookingStatus.PAID, paidAt: new Date(), providerPaymentId: 'fake_pi_shape' },
    });
    const paid = await read();
    expect(paid.cancellation).toEqual({
      deadline: paid.cancellationDeadline,
      withinDeadline: true,
      refundAmount: '117.00',
      canCancel: true,
    });

    // PARTIALLY_REFUNDED: số hoàn là phần CÒN LẠI của sổ, không phải tổng tiền.
    await prisma.refund.create({
      data: {
        bookingId: created.id,
        amount: '17.00',
        currency: 'USD',
        providerRefundId: 'fake_re_shape',
        providerPaymentId: 'fake_pi_shape',
      },
    });
    await prisma.booking.update({
      where: { id: created.id },
      data: { status: BookingStatus.PARTIALLY_REFUNDED },
    });
    expect((await read()).cancellation?.refundAmount).toBe('100.00');

    // Không có capture thì không có chỗ hoàn vào → không bày nút huỷ.
    await prisma.booking.update({ where: { id: created.id }, data: { providerPaymentId: null } });
    expect((await read()).cancellation?.canCancel).toBe(false);

    // Đúng ngày khởi hành theo giờ Việt Nam: quá hạn, hoàn 0, hết huỷ online.
    const today = vietnamToday(new Date());
    await prisma.booking.update({
      where: { id: created.id },
      data: {
        providerPaymentId: 'fake_pi_shape',
        departureStartDate: new Date(`${today}T00:00:00.000Z`),
        departureEndDate: new Date(`${today}T00:00:00.000Z`),
      },
    });
    expect((await read()).cancellation).toEqual({
      deadline: cancellationDeadline(today, today),
      withinDeadline: false,
      refundAmount: '0.00',
      canCancel: false,
    });

    // CANCELLED: ngoài luật huỷ online → null.
    await prisma.booking.update({
      where: { id: created.id },
      data: { status: BookingStatus.CANCELLED },
    });
    expect((await read()).cancellation).toBeNull();
  });
```

- [ ] **Step 11: Chạy, xác nhận đỏ**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/bookings.int.spec.ts`

Expected: FAIL gần như toàn file với 500 `Output validation failed`. Contract (đã build ở Step 5) đòi `cancellationDeadline` ở mọi booking và `cancellation` ở `byCode`, mà API chưa điền.

- [ ] **Step 12: Điền hai field ở `bookings.service.ts`**

`apps/api/src/modules/bookings/bookings.service.ts`:

(a) Thêm `cancellationDeadline` vào import value từ `@tourism/contract` (khối `import { … } from '@tourism/contract';` không có `type`). Giữ nguyên các tên Task 3–4 đã thêm vào khối này.

(b) Thêm import local, đặt trước dòng `import { mintBookingCode } from './booking-code.js';`:

```ts
import { bookingCancellation } from './booking-cancellation.js';
```

(c) Trong `toBooking`, trước:

```ts
    departureStartDate: calendarDate(row.departureStartDate),
    departureEndDate: calendarDate(row.departureEndDate),
    unitPrice: money(row.unitPrice),
```

sau:

```ts
    departureStartDate: calendarDate(row.departureStartDate),
    departureEndDate: calendarDate(row.departureEndDate),
    // ADR-0041: ngày chót huỷ miễn phí tính từ SNAPSHOT ngày đi/ngày về — rẻ,
    // không query, nên có mặt ở mọi đường đọc booking chứ không riêng byCode.
    cancellationDeadline: cancellationDeadline(
      calendarDate(row.departureStartDate),
      calendarDate(row.departureEndDate),
    ),
    unitPrice: money(row.unitPrice),
```

(d) Trong `byCode`, object trả về có dòng `review: review ? toMyReview(review, reviewMedia) : null,` và ngay sau là dòng `refundEstimate: estimateRefund(…),`. Chèn ngay SAU dòng `refundEstimate` (giữ nguyên tham số Task 3 có thể đã đổi):

```ts
      // ADR-0041: trạng thái huỷ theo hạn chót, cùng hàm luật với lõi huỷ — con
      // số khách thấy là con số server hoàn. Web chỉ in (Q7).
      cancellation: bookingCancellation(booking, refunded._sum.amount, new Date()),
```

- [ ] **Step 13: Chạy lại, chỉ còn đỏ ở route huỷ**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/bookings.int.spec.ts`

Expected: PASS mọi test trừ `'GET /api/bookings/{code}: cancellationStatus null trước khi huỷ, REFUNDED sau khi khách tự huỷ (ADR-0041)'`. Test đó FAIL vì `POST …/cancel` trả 500: controller vẫn gọi `request()` cũ, output không khớp `CancelBookingResultSchema`.

- [ ] **Step 14: Viết int test đỏ trong `cancellations.int.spec.ts`**

`apps/api/src/modules/bookings/cancellations.int.spec.ts`. Không đụng định nghĩa `dep`, `depSoon` (Task 4 để lại), `beforeAll`, `beforeEach`, `afterAll`.

(a) Thay khối import `@tourism/contract` (dòng 3–9) bằng:

```ts
import {
  AdminBookingDetailSchema,
  AdminCancellationRequestSchema,
  CancelBookingResultSchema,
  cancellationDeadline,
  DecideCancellationResultSchema,
  PagedSchema,
  vietnamToday,
} from '@tourism/contract';
```

và thêm, ngay sau dòng import `'../../generated/prisma/enums.js'`:

```ts
import { calendarDate, startOfDayUtc } from '../../lib/calendar-date.js';
```

(b) Thay JSDoc đầu file (khối `/** Integration (Docker PG, db tourism_test) — money-path W4 … */`) bằng:

```ts
/**
 * Integration (Docker PG, db tourism_test) — money-path huỷ booking.
 *
 * Từ ADR-0041 `bookings.cancel` là khách tự huỷ NGAY: trong một advisory lock,
 * gọi cổng thanh toán trước rồi một CTE ghi booking CANCELLED + yêu cầu REFUNDED
 * + dòng sổ (khi có tiền) + trả chỗ + outbox BOOKING_CANCELLED. Phần approve/deny
 * của D1-B (spec P2 §2) còn sống tới plan 15/09 Task 8, nên test của nó dựng yêu
 * cầu REQUESTED bằng `openRequest`. Ngữ nghĩa terminal-state được test ở đây là
 * những gì ghi trong docs/conventions/booking-states.md.
 */
```

(c) Ngay sau hàm `sessionCookie` (cấp module), thêm:

```ts
/** Cộng `days` ngày lịch vào chuỗi `YYYY-MM-DD` — tính trên UTC, không dùng giờ máy. */
function isoPlusDays(date: string, days: number): string {
  return calendarDate(new Date(startOfDayUtc(date).getTime() + days * 86_400_000));
}
```

(d) Thay helper `postCancel` bằng hai helper sau:

```ts
  /** Khách tự huỷ qua route thật (ADR-0041). `payload` vắng = không ghi lý do. */
  function postCancel(cookie: string, code: string, payload: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: `/api/bookings/${code}/cancel`,
      headers: { cookie },
      payload,
    });
  }

  /**
   * Mở một yêu cầu huỷ REQUESTED thẳng bằng Prisma. Từ ADR-0041 `bookings.cancel`
   * huỷ ngay chứ không tạo dòng này nữa, nhưng approve/deny và vùng admin còn
   * sống tới plan 15/09 Task 8 — test của chúng tự dựng dữ liệu kiểu cũ (prod vẫn
   * còn loại dòng này tới lượt seed lại). Chụp badge `freeCancellationDays` của
   * tour như `request()` cũ từng làm (ADR-0029 AMEND 6).
   */
  async function openRequest(bookingId: string, reason = 'Change of plans') {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { userId: true, tour: { select: { freeCancellationDays: true } } },
    });
    return prisma.cancellationRequest.create({
      data: {
        bookingId,
        userId: booking.userId,
        reason,
        freeCancellationDays: booking.tour.freeCancellationDays,
      },
    });
  }
```

(e) XOÁ nguyên bốn test chỉ kiểm `request()` cũ. Hành vi còn giá trị của chúng chuyển vào describe mới ở (h).
- `'request on own PAID booking → 200 REQUESTED + outbox row keyed by requestId'`
- `'duplicate request while one is live → 409 ALREADY_REQUESTED (partial unique fires), no second row'`
- `'W1: reason toàn khoảng trắng → 400 (contract trim), reason mép trắng được trim, admin list không 500'`
- `'non-owner request → 404 (no existence leak); PENDING booking → 422 NOT_CANCELLABLE'`

(f) Thay nguyên test `'re-request after deny → NEW row; DENIED history preserved — 2 rows in DB (D1-B acceptance)'` bằng:

```ts
  it('admin detail: lịch sử yêu cầu append-only — dòng DENIED cũ còn nguyên cạnh dòng mở mới, cũ nhất trước', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('alice4@example.com');
    const booking = await createPaidBooking(alice);

    const first = await openRequest(booking.id, 'first ask');
    expect((await postDecide(admin, first.id, { approve: false })).statusCode).toBe(200);

    const second = await openRequest(booking.id, 'second ask');
    expect(second.id).not.toBe(first.id); // append-only: một row MỚI, không tái dùng

    const rows = await prisma.cancellationRequest.findMany({
      where: { booking: { code: booking.code } },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.status)).toEqual([
      CancellationRequestStatus.DENIED, // audit trail của lần deny vẫn còn
      CancellationRequestStatus.REQUESTED,
    ]);
    expect(rows[0]?.reason).toBe('first ask');
    expect(rows[1]?.reason).toBe('second ask');

    // View detail của admin phơi toàn bộ trail, cũ nhất trước.
    const detail = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings/${booking.code}`,
      headers: { cookie: admin },
    });
    expect(detail.statusCode).toBe(200);
    const parsed = AdminBookingDetailSchema.parse(detail.json());
    expect(parsed.cancellationRequests.map((r) => r.status)).toEqual(['DENIED', 'REQUESTED']);
  });
```

(g) Trong mọi test còn lại, đổi cách mở yêu cầu từ route sang `openRequest`. Không đổi gì khác trong các test đó.

| Trước | Sau | Ở test |
| --- | --- | --- |
| `const request = CancellationRequestSchema.parse((await postCancel(alice, booking.code)).json());` | `const request = await openRequest(booking.id);` | `'deny → …'`, `'approve → …'`, `'decide on an already-decided request …'`, `'non-admin decide/list …'`, `'BK-R1 cross-path …'` |
| `const request = CancellationRequestSchema.parse(`<br>`  (await postCancel(alice, booking.code)).json(),`<br>`);` (ba dòng, mọi mức thụt lề) | `const request = await openRequest(booking.id);` | mọi test trong `describe('ADR-0029 — approve với mức hoàn theo chính sách')` có dòng này, kể cả bản thụt trong `try` của `'AMEND 6: …'` |
| `await postCancel(alice, booking.code);` | `await openRequest(booking.id);` | `'ADR-0029 AMEND 4: W3 \`Issue refund\` bị chặn …'` |
| `const aliceReq = CancellationRequestSchema.parse(`<br>`  (await postCancel(alice, aliceBooking.code)).json(),`<br>`);`<br>`CancellationRequestSchema.parse((await postCancel(bob, bobBooking.code)).json());` | `const aliceReq = await openRequest(aliceBooking.id);`<br>`await openRequest(bobBooking.id);` | `'admin.cancellations.list: booking context + status filter; myRequests returns own history'` |
| `const mayReq = CancellationRequestSchema.parse((await postCancel(may, mayBooking.code)).json());`<br>`const juneReq = CancellationRequestSchema.parse(`<br>`  (await postCancel(june, juneBooking.code)).json(),`<br>`);`<br>`const openReq = CancellationRequestSchema.parse(`<br>`  (await postCancel(openOld, openBooking.code)).json(),`<br>`);` | `const mayReq = await openRequest(mayBooking.id);`<br>`const juneReq = await openRequest(juneBooking.id);`<br>`const openReq = await openRequest(openBooking.id);` | `'admin.cancellations.list: lọc theo khoảng ngày tạo, hàng đang mở KHÔNG bị loại'` |

Kiểm sau khi đổi:

```bash
grep -n "CancellationRequestSchema\|postCancel(" apps/api/src/modules/bookings/cancellations.int.spec.ts
```

Expected: không còn `CancellationRequestSchema`; `postCancel(` chỉ còn ở định nghĩa helper. Describe mới ở bước (h) sẽ thêm lượt dùng.

(h) Ngay sau helper `seatsBooked()`, trước test `'deny → DENIED + audit fields + outbox; booking stays PAID, seats stay held'`, thêm:

```ts
  /**
   * ADR-0041 §4 — khách tự huỷ, xử lý ngay. Chuyến `dep` khởi hành +45 ngày, dài
   * 2 ngày nên N = 3: booking tạo qua API luôn còn trong hạn. Ca quá hạn và ca
   * đúng ngày khởi hành dời SNAPSHOT ngày trên booking (lõi huỷ đọc snapshot,
   * không join chuyến), nên ghế vẫn nhả về `dep`.
   */
  describe('ADR-0041 — bookings.cancel huỷ ngay', () => {
    it('trong hạn: hoàn đủ, booking CANCELLED, yêu cầu REFUNDED do chính khách, trả chỗ, email BOOKING_CANCELLED', async () => {
      const alice = await signUpUser('self-cancel@example.com', 'Alice');
      const booking = await createPaidBooking(alice); // 117.00, 3 ghế
      expect(await seatsBooked()).toBe(3);

      const res = await postCancel(alice, booking.code, { reason: '  Change of plans  ' });
      expect(res.statusCode).toBe(200);
      const body = CancelBookingResultSchema.parse(res.json());
      expect(body.refundedAmount).toBe('117.00');
      expect(body.booking).toMatchObject({
        code: booking.code,
        status: 'CANCELLED',
        refundedTotal: '117.00',
      });
      expect(body.booking.cancelledAt).not.toBeNull();

      // (a) Cổng: đúng một lệnh, trọn phần còn lại, khoá chống trùng theo booking.
      expect(fake.refunds).toHaveLength(1);
      expect(fake.refunds[0]).toMatchObject({
        amount: '117.00',
        currency: 'USD',
        idempotencyKey: `cancel:${booking.id}`,
      });

      // (b) Sổ: một dòng, không admin nào bấm, capture được hoàn vào (ADR-0006 AMEND 1b).
      const refunds = await prisma.refund.findMany({ where: { bookingId: booking.id } });
      expect(refunds).toHaveLength(1);
      expect(refunds[0]?.amount.toFixed(2)).toBe('117.00');
      expect(refunds[0]?.adminId).toBeNull();
      expect(refunds[0]?.providerRefundId).toBe(fake.refunds[0]?.providerRefundId);
      expect(refunds[0]?.providerPaymentId).toBe(fake.refunds[0]?.providerPaymentId);

      // (c) Một yêu cầu REFUNDED do CHÍNH khách quyết; lý do đã trim ở contract.
      const aliceRow = await prisma.user.findUniqueOrThrow({
        where: { email: 'self-cancel@example.com' },
      });
      const requests = await prisma.cancellationRequest.findMany({
        where: { bookingId: booking.id },
      });
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        status: CancellationRequestStatus.REFUNDED,
        userId: aliceRow.id,
        decidedById: aliceRow.id,
        reason: 'Change of plans',
        decisionNote: null,
      });
      expect(requests[0]?.decidedAt).not.toBeNull();

      // (d) Booking CANCELLED + ghế nhả về pool.
      const dbBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(dbBooking.status).toBe(BookingStatus.CANCELLED);
      expect(dbBooking.cancelledAt).not.toBeNull();
      expect(await seatsBooked()).toBe(0);

      // (e) Email trong CÙNG câu SQL, payload đúng Hợp đồng C, dedupe theo booking.
      const outbox = await prisma.outbox.findMany({
        where: { type: EmailType.BOOKING_CANCELLED },
      });
      expect(outbox).toHaveLength(1);
      expect(outbox[0]?.dedupeKey).toBe(`booking-cancelled:${booking.id}`);
      expect(outbox[0]?.payload).toEqual({
        bookingId: booking.id,
        code: booking.code,
        email: 'alice@example.com',
        name: 'Alice Nguyen',
        title: dbBooking.tourTitle,
        amount: '117.00',
        currency: 'USD',
        refunded: true,
        deadline: cancellationDeadline(
          calendarDate(dbBooking.departureStartDate),
          calendarDate(dbBooking.departureEndDate),
        ),
        initiator: 'customer',
      });
    });

    it('W1 + ADR-0041: lý do toàn khoảng trắng → 400, không ghi gì; vắng lý do → reason NULL, admin list vẫn 200', async () => {
      const admin = await signUpAdmin();
      const alice = await signUpUser('no-reason@example.com', 'Alice');
      const booking = await createPaidBooking(alice);

      // Có gửi lý do thì vẫn phải có chữ (trim ở CONTRACT, W1).
      const blank = await postCancel(alice, booking.code, { reason: '   ' });
      expect(blank.statusCode).toBe(400);
      expect(fake.refunds).toHaveLength(0);
      expect(await prisma.cancellationRequest.count()).toBe(0);

      // Vắng hẳn là hợp lệ: dòng yêu cầu ghi NULL.
      expect((await postCancel(alice, booking.code)).statusCode).toBe(200);
      const row = await prisma.cancellationRequest.findFirstOrThrow({
        where: { bookingId: booking.id },
      });
      expect(row.reason).toBeNull();

      // Dòng lý do NULL không được làm nổ output validation của hàng đợi admin
      // (Task 2 nới CancellationRequestSchema.reason).
      const list = await app.inject({
        method: 'GET',
        url: '/api/admin/cancellations',
        headers: { cookie: admin },
      });
      expect(list.statusCode).toBe(200);
      expect(
        PagedSchema(AdminCancellationRequestSchema).parse(list.json()).items[0]?.reason,
      ).toBeNull();
    });

    it('quá hạn chót: vẫn huỷ, hoàn 0 — không gọi cổng, không dòng sổ, email biến thể không hoàn', async () => {
      const alice = await signUpUser('late-cancel@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      // Khởi hành sau 2 ngày, chuyến 4 ngày → N = 7: hạn chót đã qua 5 ngày nhưng
      // chưa tới ngày khởi hành, nên vẫn huỷ online được.
      const start = isoPlusDays(vietnamToday(new Date()), 2);
      const end = isoPlusDays(start, 3);
      await prisma.booking.update({
        where: { id: booking.id },
        data: { departureStartDate: startOfDayUtc(start), departureEndDate: startOfDayUtc(end) },
      });

      const res = await postCancel(alice, booking.code);
      expect(res.statusCode).toBe(200);
      const body = CancelBookingResultSchema.parse(res.json());
      expect(body.refundedAmount).toBe('0.00');
      expect(body.booking.status).toBe('CANCELLED');

      // Không đồng nào phải chuyển: không gọi cổng, sổ không có dòng 0.00.
      expect(fake.refunds).toHaveLength(0);
      expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(0);
      // Vẫn MỘT yêu cầu REFUNDED (nghĩa "đã giải quyết"), vẫn nhả ghế.
      const request = await prisma.cancellationRequest.findFirstOrThrow({
        where: { bookingId: booking.id },
      });
      expect(request.status).toBe(CancellationRequestStatus.REFUNDED);
      expect(await seatsBooked()).toBe(0);

      const outbox = await prisma.outbox.findFirstOrThrow({
        where: { type: EmailType.BOOKING_CANCELLED },
      });
      expect(outbox.payload).toMatchObject({
        amount: '0.00',
        refunded: false,
        deadline: cancellationDeadline(start, end),
        initiator: 'customer',
      });
    });

    it('PARTIALLY_REFUNDED: hoàn đúng phần còn lại của sổ', async () => {
      const admin = await signUpAdmin();
      const alice = await signUpUser('partial-then-cancel@example.com', 'Alice');
      const booking = await createPaidBooking(alice); // 117.00
      expect((await postRefund(admin, booking.code, { amount: '17.00' })).statusCode).toBe(200);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
        BookingStatus.PARTIALLY_REFUNDED,
      );

      const res = await postCancel(alice, booking.code);
      expect(res.statusCode).toBe(200);
      expect(CancelBookingResultSchema.parse(res.json()).refundedAmount).toBe('100.00');

      expect(fake.refunds.map((r) => r.amount)).toEqual(['17.00', '100.00']);
      expect(fake.refunds[1]?.idempotencyKey).toBe(`cancel:${booking.id}`);
      const total = await prisma.refund.aggregate({
        where: { bookingId: booking.id },
        _sum: { amount: true },
      });
      expect(total._sum.amount?.toFixed(2)).toBe('117.00');
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
        BookingStatus.CANCELLED,
      );
    });

    it('bấm hai lần song song: một 200, một 422 NOT_CANCELLABLE — một lệnh cổng, một dòng sổ, một yêu cầu, một email', async () => {
      const alice = await signUpUser('double-click@example.com', 'Alice');
      const booking = await createPaidBooking(alice);

      fake.refundDelayMs = 100; // giữ khoá đủ lâu để lệnh thứ hai chắc chắn phải chờ
      const results = await Promise.all([
        postCancel(alice, booking.code),
        postCancel(alice, booking.code),
      ]);
      expect(results.map((r) => r.statusCode).sort((x, y) => x - y)).toEqual([200, 422]);
      expect(results.find((r) => r.statusCode === 422)?.json()).toMatchObject({
        code: 'NOT_CANCELLABLE',
      });

      // Lệnh thứ hai chờ advisory lock rồi thấy CANCELLED — không chạm cổng lần hai.
      expect(fake.refunds).toHaveLength(1);
      expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(1);
      expect(await prisma.cancellationRequest.count({ where: { bookingId: booking.id } })).toBe(1);
      expect(await prisma.outbox.count({ where: { type: EmailType.BOOKING_CANCELLED } })).toBe(1);
      expect(await seatsBooked()).toBe(0);
    });

    it('cổng thanh toán lỗi → 502 REFUND_FAILED, không ghi gì; thử lại chạy trọn với cùng khoá chống trùng', async () => {
      const alice = await signUpUser('gateway-down@example.com', 'Alice');
      const booking = await createPaidBooking(alice);

      fake.failRefunds = true;
      const res = await postCancel(alice, booking.code, { reason: 'Change of plans' });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toMatchObject({ code: 'REFUND_FAILED' });

      // Cổng TRƯỚC, sổ SAU: lỗi ở cổng thì booking nguyên vẹn, khách thử lại được.
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
        BookingStatus.PAID,
      );
      expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(0);
      expect(await prisma.cancellationRequest.count({ where: { bookingId: booking.id } })).toBe(0);
      expect(await prisma.outbox.count({ where: { type: EmailType.BOOKING_CANCELLED } })).toBe(0);
      expect(await seatsBooked()).toBe(3);

      fake.failRefunds = false;
      expect((await postCancel(alice, booking.code)).statusCode).toBe(200);
      expect(fake.refunds.map((r) => r.idempotencyKey)).toEqual([`cancel:${booking.id}`]);
    });

    it('đúng ngày khởi hành (giờ Việt Nam) → 422 NOT_CANCELLABLE, booking giữ nguyên', async () => {
      const alice = await signUpUser('departure-day@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      const today = vietnamToday(new Date());
      await prisma.booking.update({
        where: { id: booking.id },
        data: { departureStartDate: startOfDayUtc(today), departureEndDate: startOfDayUtc(today) },
      });

      const res = await postCancel(alice, booking.code);
      expect(res.statusCode).toBe(422);
      expect(res.json()).toMatchObject({ code: 'NOT_CANCELLABLE' });
      expect(fake.refunds).toHaveLength(0);
      expect(await prisma.cancellationRequest.count()).toBe(0);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
        BookingStatus.PAID,
      );
      expect(await seatsBooked()).toBe(3);
    });

    it('người khác huỷ → 404 (không lộ tồn tại); booking PENDING → 422 NOT_CANCELLABLE', async () => {
      const alice = await signUpUser('owner@example.com');
      const mallory = await signUpUser('mallory@example.com');
      const paid = await createPaidBooking(alice);

      const foreign = await postCancel(mallory, paid.code);
      expect(foreign.statusCode).toBe(404);
      expect(foreign.json()).toMatchObject({ code: 'NOT_FOUND' });

      const pending = await createBooking(alice); // chưa từng trả tiền
      const res = await postCancel(alice, pending.code);
      expect(res.statusCode).toBe(422);
      expect(res.json()).toMatchObject({ code: 'NOT_CANCELLABLE' });

      expect(fake.refunds).toHaveLength(0);
      expect(await prisma.cancellationRequest.count()).toBe(0);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: paid.id } })).status).toBe(
        BookingStatus.PAID,
      );
    });

    it('booking REFUNDED (đã hoàn thiện chí toàn bộ) → 422, không huỷ online (spec §3.3)', async () => {
      const admin = await signUpAdmin();
      const alice = await signUpUser('fully-refunded@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      expect((await postRefund(admin, booking.code, { amount: '117.00' })).statusCode).toBe(200);

      const res = await postCancel(alice, booking.code);
      expect(res.statusCode).toBe(422);
      expect(res.json()).toMatchObject({ code: 'NOT_CANCELLABLE' });

      expect(fake.refunds).toHaveLength(1); // chỉ lệnh hoàn thiện chí trước đó
      expect(await prisma.cancellationRequest.count()).toBe(0);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
        BookingStatus.REFUNDED,
      );
      expect(await seatsBooked()).toBe(3);
    });
  });
```

- [ ] **Step 15: Chạy, xác nhận đỏ**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/cancellations.int.spec.ts`

Expected:
- FAIL bảy test đầu của describe `ADR-0041 — bookings.cancel huỷ ngay` (từ `'trong hạn: …'` tới `'đúng ngày khởi hành …'`). Route còn chạy `request()` cũ nên trả 500 hoặc sai mã.
- Hai test `'người khác huỷ …'` và `'booking REFUNDED …'` có thể đã xanh, vì mã 404/422 của hai ca này trùng hành vi cũ.
- Mọi test approve/deny/admin đã đổi sang `openRequest` phải PASS; nếu cái nào đỏ thì soát lại bảng ở (g).

- [ ] **Step 16: Cài đặt lõi huỷ trong `cancellations.service.ts`**

`apps/api/src/modules/bookings/cancellations.service.ts`:

(a) Thay khối import dòng 1–24 bằng:

```ts
import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminCancellationRequest,
  AdminCancellationsListQuery,
  CancelBookingResult,
  CancellationRequest as CancellationRequestView,
  DecideCancellationResult,
  Paged,
} from '@tourism/contract';
import {
  cancellationDeadline,
  policyRefundAmount,
  refundPercentForRequest,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, CancellationRequestStatus } from '../../generated/prisma/enums.js';
import { calendarDate } from '../../lib/calendar-date.js';
import { createdAtRange } from '../../lib/created-at-range.js';
import { toPaged } from '../../lib/paged.js';
import { MediaService } from '../media/media.service.js';
import { cancellationBlocker, refundOnCancelForBooking } from './booking-cancellation.js';
import { bookingTourInclude, resolveTourCover, toBooking } from './bookings.service.js';
import { withBookingRefundLock } from './refund-lock.js';
import { classifyRefundAmount, RefundNothingLeftError } from './refund-math.js';
import {
  BookingNotFoundError,
  BookingNotRefundableError,
  RefundsService,
} from './refunds.service.js';
```

(b) Thay lớp `BookingNotCancellableError` và XOÁ lớp `CancellationAlreadyRequestedError` ngay dưới nó. Trước:

```ts
/** Booking không PAID, hoặc departure đã khởi hành — không vào flow được (422). */
export class BookingNotCancellableError extends Error {
  constructor(detail: string) {
    super(`Booking cannot be cancelled: ${detail}`);
  }
}

/** Partial unique index đã fire — đã tồn tại một REQUESTED row còn sống (409). */
export class CancellationAlreadyRequestedError extends Error {
  constructor() {
    super('A cancellation request is already open for this booking');
  }
}
```

sau:

```ts
/**
 * Booking không huỷ online được (422): trạng thái ngoài PAID/PARTIALLY_REFUNDED,
 * không có capture để hoàn vào, hoặc đã tới ngày khởi hành theo giờ Việt Nam
 * (ADR-0041 §4). Lệnh huỷ thứ hai của cùng booking cũng rơi vào đây.
 */
export class BookingNotCancellableError extends Error {
  constructor(detail: string) {
    super(`Booking cannot be cancelled: ${detail}`);
  }
}

/**
 * Đầu vào lõi huỷ dùng chung (plan 15/09 Hợp đồng C). Người gọi đã giữ advisory
 * lock của booking và tính `refundAmount` trên sổ đọc TRONG khoá. P4e-1 sẽ thêm
 * initiator 'operator' (công ty huỷ chuyến, hoàn toàn bộ phần còn lại).
 */
export interface CancelInLockInput {
  /** Người quyết: chính khách khi `initiator` là 'customer'. */
  decidedById: string;
  refundAmount: Prisma.Decimal;
  reason: string | null;
  initiator: 'customer';
  /** Đồng hồ của lượt huỷ — dùng cho phép kiểm "chưa tới ngày khởi hành". */
  now: Date;
}
```

(c) JSDoc của lớp `CancellationsService`, thay đoạn đầu và câu về terminal-state. Trước:

```ts
/**
 * Cancellation flow (spec P2 §3 W4, D1 chốt là B): một khách PAID xin hủy;
 * admin deny (booking để nguyên) hoặc approve (hoàn theo mức chính sách hoặc
 * số admin ghi lý do — ADR-0029/0030 — + booking CANCELLED + release seat). Request là history APPEND-ONLY — mỗi request
 * INSERT một row mới, DENIED row không bao giờ tái dùng (Nexora upsert đè lên
 * chúng, làm mất audit trail của denial — audit M7); "một live request mỗi
 * booking" là việc của DB qua partial unique index
 * `cancellation_requests_one_live_per_booking` (WHERE status = 'REQUESTED').
 *
 * Semantics của terminal-state nằm ở docs/conventions/booking-states.md:
 * Refund ledger ghi câu chuyện MONEY, Booking.status ghi câu chuyện
 * SEAT/TRAVEL — một cancellation được approve set CANCELLED tường minh (khách
 * ngừng du lịch, seat được trả lại), KHÔNG phải REFUNDED derive từ ledger, dù
 * ledger có cộng đủ total. Cancellation ≠ chỉ refund.
 */
```

sau:

```ts
/**
 * Huỷ booking đã trả. Từ ADR-0041 khách tự huỷ NGAY (`cancelByCustomer`, lõi
 * `cancelInLock`); không còn luồng gửi yêu cầu chờ duyệt. Phần admin deny/approve
 * yêu cầu REQUESTED cũ (spec P2 §3 W4, D1 chốt là B; ADR-0029/0030) còn sống tới
 * plan 15/09 Task 8 cho dữ liệu cũ. Request là history APPEND-ONLY — mỗi request
 * INSERT một row mới, DENIED row không bao giờ tái dùng (Nexora upsert đè lên
 * chúng, làm mất audit trail của denial — audit M7); "một live request mỗi
 * booking" là việc của DB qua partial unique index
 * `cancellation_requests_one_live_per_booking` (WHERE status = 'REQUESTED').
 *
 * Semantics của terminal-state nằm ở docs/conventions/booking-states.md:
 * Refund ledger ghi câu chuyện MONEY, Booking.status ghi câu chuyện
 * SEAT/TRAVEL — một lần huỷ set CANCELLED tường minh (khách ngừng du lịch, seat
 * được trả lại), KHÔNG phải REFUNDED derive từ ledger, dù ledger có cộng đủ
 * total. Cancellation ≠ chỉ refund.
 */
```

(d) XOÁ nguyên method `request()` cùng JSDoc của nó, tức từ `/** Khách xin hủy một PAID booking của chính mình (gate Nexora, đã port):` tới hết `}` của method, ngay trước `/** Lịch sử request của chính khách, mới nhất trước …`. Đặt vào đúng chỗ đó:

```ts
  /**
   * Khách tự huỷ booking của chính mình, xử lý NGAY (ADR-0041 §4): trong hạn chót
   * hoàn toàn bộ phần chưa hoàn, quá hạn hoàn 0; cả hai đều huỷ booking, trả chỗ,
   * ghi một yêu cầu REFUNDED do chính khách quyết và xếp email `BOOKING_CANCELLED`.
   *
   * Ném BookingNotFoundError (không phải chủ hoặc không tồn tại — 404, không lộ sự
   * tồn tại), BookingNotCancellableError (trạng thái sai, không có capture, hoặc
   * đã tới ngày khởi hành), ProviderRefundFailedError (cổng lỗi — không ghi gì,
   * khách thử lại được).
   *
   * `now` là tham số để test tất định; route truyền đồng hồ thật.
   */
  async cancelByCustomer(
    userId: string,
    bookingCode: string,
    reason: string | null,
    now: Date = new Date(),
  ): Promise<CancelBookingResult> {
    const probe = await prisma.booking.findUnique({
      where: { code: bookingCode },
      select: { id: true, userId: true },
    });
    // Chủ booking không bao giờ đổi nên kiểm ngoài khoá là đủ; mọi thứ còn lại
    // đọc TƯƠI trong khoá.
    if (!probe || probe.userId !== userId) throw new BookingNotFoundError(bookingCode);

    const refundedAmount = await withBookingRefundLock(probe.id, async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: probe.id } });
      const ledger = await tx.refund.aggregate({
        where: { bookingId: booking.id },
        _sum: { amount: true },
      });
      // Số tiền theo luật, trên sổ đọc TRONG khoá — cùng hàm với
      // `bookings.byCode.cancellation`. Admin hoàn thiện chí chen giữa thì phải
      // chờ cùng khoá, nên sổ đọc ở đây luôn là sổ mới nhất.
      const refundAmount = new Prisma.Decimal(
        refundOnCancelForBooking(booking, ledger._sum.amount, now),
      );
      await this.cancelInLock(tx, booking, {
        decidedById: userId,
        refundAmount,
        reason,
        initiator: 'customer',
        now,
      });
      return refundAmount;
    });

    const [row, refunded] = await Promise.all([
      prisma.booking.findUniqueOrThrow({
        where: { id: probe.id },
        include: { tour: bookingTourInclude },
      }),
      prisma.refund.aggregate({ where: { bookingId: probe.id }, _sum: { amount: true } }),
    ]);
    const tourImage = await resolveTourCover(this.media, row.tourId);
    this.logger.log(
      `Booking ${row.code} cancelled by its owner: refunded ${refundedAmount.toFixed(2)} ${row.currency}`,
    );
    return {
      // `refundedTotal` THẬT (như adminByCode): khách vừa huỷ cần thấy tổng đã
      // hoàn ngay trong kết quả, không phải '0.00' mặc định của toBooking.
      booking: toBooking(row, null, tourImage, { refundedTotal: refunded._sum.amount }),
      refundedAmount: refundedAmount.toFixed(2),
    };
  }

  /**
   * Lõi huỷ dùng chung (ADR-0041 §4, plan 15/09 Hợp đồng C) — CHẠY TRONG
   * `withBookingRefundLock` mà người gọi đang giữ; `tx` là giao dịch của khoá ấy.
   *
   *  1. Kiểm lại booking vừa đọc trong khoá: trạng thái PAID/PARTIALLY_REFUNDED,
   *     có capture, chưa tới ngày khởi hành (giờ Việt Nam). Lệnh huỷ thứ hai chờ
   *     khoá rồi thấy CANCELLED → BookingNotCancellableError.
   *  2. Tiền > 0 thì gọi cổng thanh toán TRƯỚC (ADR-0009: không ghi sổ thứ chưa
   *     xảy ra), khoá chống trùng `cancel:<bookingId>` — một booking chỉ huỷ được
   *     một lần nên khoá này ổn định qua mọi lần thử lại sau crash. Cổng lỗi thì
   *     ProviderRefundFailedError bay ra, giao dịch rollback, không ghi gì.
   *  3. MỘT câu SQL (CTE), mọi thứ dẫn từ lượt flip booking để guard trạng thái
   *     thua thì cả câu thành no-op:
   *       cancel        — booking → CANCELLED + cancelled_at (travel story,
   *                       docs/conventions/booking-states.md).
   *       req_insert    — một yêu cầu REFUNDED (giữ nghĩa "đã giải quyết" kể cả
   *                       khi hoàn 0), decided_by/decided_at, lý do tuỳ chọn.
   *       refund_insert — dòng sổ khi tiền > 0: admin_id NULL (không ai bấm nút
   *                       admin), provider_payment_id = capture được hoàn vào
   *                       (ADR-0006 AMEND 1b). Trigger `refunds_sum_within_total`
   *                       vẫn là lưới cuối.
   *       seat_release  — `seats_booked − party`, guard `seats_booked >= party`.
   *       outbox_insert — BOOKING_CANCELLED, dedupe `booking-cancelled:<bookingId>`.
   *
   * Guard ghế không khớp: log cho người vận hành, giao dịch vẫn commit (tiền đã đi
   * thì câu chuyện tiền phải được ghi) — giữ hành vi của approve.
   */
  private async cancelInLock(
    tx: Prisma.TransactionClient,
    booking: Prisma.BookingModel,
    input: CancelInLockInput,
  ): Promise<void> {
    const blocker = cancellationBlocker(booking, input.now);
    if (blocker) throw new BookingNotCancellableError(blocker);

    const amount = input.refundAmount;
    const amountText = amount.toFixed(2);
    const deadline = cancellationDeadline(
      calendarDate(booking.departureStartDate),
      calendarDate(booking.departureEndDate),
    );
    // `cancellationBlocker` đã loại booking không có capture, nên ép kiểu an toàn.
    const providerRefundId = amount.greaterThan(0)
      ? await this.refunds.executeGatewayRefund(
          { ...booking, providerPaymentId: booking.providerPaymentId as string },
          amount,
          `cancel:${booking.id}`,
        )
      : null;

    const written = await tx.$queryRaw<{ id: string; released: bigint }[]>(Prisma.sql`
      WITH cancel AS (
        UPDATE bookings b
        SET status = 'CANCELLED'::"BookingStatus",
            cancelled_at = now(),
            updated_at = now()
        WHERE b.id = ${booking.id}::uuid
          AND b.status IN ('PAID'::"BookingStatus", 'PARTIALLY_REFUNDED'::"BookingStatus")
        RETURNING b.id, b.user_id, b.departure_id, (b.num_adults + b.num_children) AS seats,
                  b.code, b.contact_email, b.contact_name, b.tour_title
      ),
      req_insert AS (
        INSERT INTO cancellation_requests (id, booking_id, user_id, reason, status,
                                           decided_by, decided_at, updated_at)
        SELECT gen_random_uuid(), c.id, c.user_id, ${input.reason}::text,
               'REFUNDED'::"CancellationRequestStatus", ${input.decidedById}::uuid, now(), now()
        FROM cancel c
        RETURNING id
      ),
      refund_insert AS (
        INSERT INTO refunds (id, booking_id, amount, currency, provider_refund_id,
                             provider_payment_id, admin_id)
        SELECT gen_random_uuid(), c.id, ${amountText}::numeric, ${booking.currency}::text,
               ${providerRefundId}::text, ${booking.providerPaymentId}::text, NULL
        FROM cancel c
        WHERE ${amountText}::numeric > 0
        RETURNING id
      ),
      seat_release AS (
        UPDATE tour_departures d
        SET seats_booked = d.seats_booked - c.seats,
            updated_at = now()
        FROM cancel c
        WHERE d.id = c.departure_id AND d.seats_booked >= c.seats
        RETURNING d.id
      ),
      outbox_insert AS (
        INSERT INTO outbox (type, payload, dedupe_key)
        SELECT 'BOOKING_CANCELLED'::"EmailType",
               jsonb_build_object(
                 'bookingId', c.id,
                 'code', c.code,
                 'email', c.contact_email,
                 'name', c.contact_name,
                 'title', c.tour_title,
                 'amount', ${amountText}::text,
                 'currency', ${booking.currency}::text,
                 'refunded', ${amountText}::numeric > 0,
                 'deadline', ${deadline}::text,
                 'initiator', ${input.initiator}::text
               ),
               'booking-cancelled:' || c.id::text
        FROM cancel c
        ON CONFLICT (dedupe_key) DO NOTHING
      )
      SELECT c.id, (SELECT count(*) FROM seat_release) AS released FROM cancel c
    `);

    const flip = written[0];
    if (!flip) {
      // Booking đổi trạng thái giữa lượt kiểm trong khoá và lượt flip — chỉ có thể
      // do một đường ghi NGOÀI khoá. Tiền (nếu có) ĐÃ đi mà sổ không ghi: người vận
      // hành phải đối soát.
      this.logger.error(
        `Cancel on booking ${booking.code}: status changed before the write; provider refund ` +
          `${providerRefundId ?? 'none'} (${amountText} ${booking.currency}) NOT ledgered`,
      );
      throw new BookingNotCancellableError('the booking changed state while cancelling');
    }
    if (Number(flip.released) === 0) {
      this.logger.error(
        `Cancel on booking ${booking.code}: seats NOT released ` +
          '(guard seats_booked >= party failed) — departure counter needs operator attention',
      );
    }
  }
```

(e) XOÁ nguyên hàm `isOneLiveRequestViolation` cuối file, cùng JSDoc `/** UNIQUE violation (SQLSTATE 23505) trên partial index D1-B …`. Chỉ `request()` dùng hàm này.

- [ ] **Step 17: Map lỗi ở controller**

`apps/api/src/modules/bookings/bookings.controller.ts`. Hai khối import, trước:

```ts
import {
  BookingNotCancellableError,
  CancellationAlreadyRequestedError,
  CancellationsService,
} from './cancellations.service.js';
import { BookingNotFoundError } from './refunds.service.js';
```

sau:

```ts
import { BookingNotCancellableError, CancellationsService } from './cancellations.service.js';
import { BookingNotFoundError, ProviderRefundFailedError } from './refunds.service.js';
```

Thay nguyên method `cancel` (từ `@Implement(contract.bookings.cancel)` tới hết `}` của method, giữ comment `// Đường GHI: …` phía trên) bằng:

```ts
  @Implement(contract.bookings.cancel)
  cancel(@CurrentUser() user: SessionUser) {
    return implement(contract.bookings.cancel).handler(async ({ input, errors }) => {
      try {
        // Contract đã trim; vắng lý do thì ghi null (ADR-0041 — lý do không bắt buộc).
        return await this.cancellations.cancelByCustomer(user.id, input.code, input.reason ?? null);
      } catch (error) {
        // Owner-or-404, cùng chính sách với byCode (không lộ sự tồn tại).
        if (error instanceof BookingNotFoundError) throw errors.NOT_FOUND();
        if (error instanceof BookingNotCancellableError) {
          throw errors.NOT_CANCELLABLE({ message: error.message });
        }
        // Cổng từ chối hoàn: chưa ghi gì, booking giữ nguyên — khách thử lại được.
        if (error instanceof ProviderRefundFailedError) {
          throw errors.REFUND_FAILED({ message: error.message });
        }
        throw error;
      }
    });
  }
```

- [ ] **Step 18: Chạy, xác nhận xanh (unit và int của module)**

```bash
pnpm --filter @tourism/api exec vitest run src/modules/bookings/booking-cancellation.spec.ts
pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/cancellations.int.spec.ts src/modules/bookings/bookings.int.spec.ts src/modules/bookings/refunds.int.spec.ts
```

Expected: PASS toàn bộ, gồm cả chín test của describe `ADR-0041 — bookings.cancel huỷ ngay`, ba test đã sửa hoặc thêm ở `bookings.int.spec.ts`, và `refunds.int.spec.ts` (canh `refundByAdmin`, không đổi).

- [ ] **Step 19: Typecheck, sửa tối thiểu fixture web/admin**

Run: `pnpm turbo run typecheck --concurrency=3`

Expected: FAIL đúng ba file, đều vì thiếu field mới của contract:
- `apps/web/src/test/fixtures/booking.ts`: thiếu `cancellationDeadline` và `cancellation`.
- `apps/admin/src/lib/bookings-view.spec.ts`: thiếu `cancellationDeadline`.
- `apps/admin/src/lib/bookings-csv.spec.ts`: thiếu `cancellationDeadline`.

Nếu lỗi nằm ở file khác thì DỪNG và soát lại Step 3–4 và 12. Không sửa UI ở task này.

`apps/web/src/test/fixtures/booking.ts`, trước:

```ts
    departureStartDate: '2026-09-01',
    departureEndDate: '2026-09-02',
```

sau:

```ts
    departureStartDate: '2026-09-01',
    departureEndDate: '2026-09-02',
    // ADR-0041: ngày chót do server tính — chuyến 2 ngày nên N = 3.
    cancellationDeadline: '2026-08-29',
```

và trước:

```ts
    refundEstimate: null,
    ...overrides,
```

sau:

```ts
    refundEstimate: null,
    // ADR-0041: trạng thái huỷ theo hạn chót (byCode). Mặc định null — test cần
    // hộp xác nhận huỷ thì đè overrides.
    cancellation: null,
    ...overrides,
```

`apps/admin/src/lib/bookings-view.spec.ts` (hàm `makeBooking`), trước:

```ts
    departureStartDate: '2026-09-14',
    departureEndDate: '2026-09-20',
```

sau (chuyến 7 ngày, N = 7):

```ts
    departureStartDate: '2026-09-14',
    departureEndDate: '2026-09-20',
    cancellationDeadline: '2026-09-07',
```

`apps/admin/src/lib/bookings-csv.spec.ts` (const `booking`), trước:

```ts
  departureStartDate: '2026-09-18',
  departureEndDate: '2026-09-20',
```

sau (chuyến 3 ngày, N = 3):

```ts
  departureStartDate: '2026-09-18',
  departureEndDate: '2026-09-20',
  cancellationDeadline: '2026-09-15',
```

Run lại: `pnpm turbo run typecheck --concurrency=3`

Expected: PASS mọi package.

- [ ] **Step 20: Chạy test web/admin chạm fixture, soát sót, format**

```bash
pnpm --filter @tourism/web exec vitest run src/components/account/booking-actions.spec.tsx src/lib/booking-vm.spec.ts
pnpm --filter @tourism/admin exec vitest run src/lib/bookings-view.spec.ts src/lib/bookings-csv.spec.ts
grep -rn "ALREADY_REQUESTED\|CancellationAlreadyRequestedError\|isOneLiveRequestViolation\|cancellations.request(" apps/api/src libs/shared/contract/src
pnpm lint:fix
git status --short
```

Expected:
- Hai lệnh vitest PASS.
- `grep` không in dòng nào. `CANCELLATION_ALREADY_REQUESTED` trong `libs/shared/i18n` là copy của checkout web, không thuộc phạm vi này.
- `git status` chỉ có các file ở mục **Files**; không add `docs/screenshot/`.

- [ ] **Step 21: Cổng đầy đủ**

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: tất cả xanh.

- [ ] **Step 22: Commit**

```bash
git add \
  libs/shared/contract/src/schemas/bookings.ts \
  libs/shared/contract/src/schemas/bookings.spec.ts \
  libs/shared/contract/src/contract.ts \
  apps/api/src/modules/bookings/booking-cancellation.ts \
  apps/api/src/modules/bookings/booking-cancellation.spec.ts \
  apps/api/src/modules/bookings/bookings.service.ts \
  apps/api/src/modules/bookings/cancellations.service.ts \
  apps/api/src/modules/bookings/bookings.controller.ts \
  apps/api/src/modules/bookings/cancellations.int.spec.ts \
  apps/api/src/modules/bookings/bookings.int.spec.ts \
  apps/web/src/test/fixtures/booking.ts \
  apps/admin/src/lib/bookings-view.spec.ts \
  apps/admin/src/lib/bookings-csv.spec.ts
git commit -m "feat(refund): lõi huỷ dùng chung và bookings.cancel huỷ ngay theo hạn chót"
```
---

### Task 7: Web — trang booking của khách: huỷ ngay theo hạn chót

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` — `booking.success.nextManage` (dòng 484); xoá khối `booking.detail` (dòng 537–614); thêm top-level `cancellationDeadline` (sau `checkoutSummary`, trước `common`, dòng ~647); thay khối `accountBookingDetail` (dòng 2553–2618); thay khối `accountActionErrors` (dòng 2738–2748).
- Modify: `apps/web/src/lib/booking-vm.ts` (thay toàn bộ)
- Test: `apps/web/src/lib/booking-vm.spec.ts` (thay toàn bộ)
- Modify: `apps/web/src/components/account/booking-actions.tsx` (thay toàn bộ)
- Test: `apps/web/src/components/account/booking-actions.spec.tsx` (thay toàn bộ)
- Modify: `apps/web/src/app/(site)/account/bookings/[code]/page.tsx` (dòng 17, 96–103, 233–270, 340)
- Modify: `apps/web/src/app/(site)/checkout/success/page.tsx` (dòng 11–13, 70–73, 110–114)
- Không đổi: `apps/web/src/lib/passport.ts`, `apps/web/src/components/passport/booking-accordion.tsx` — cả hai gọi `bookingView(b)` một tham số và chỉ đọc `tone`/`payNow`; chữ ký mới giữ tham số thứ hai tuỳ chọn nên hai file này không phải sửa.

**Interfaces:**

- Consumes (Task 6, `@tourism/contract`): `BookingCancellation` (`{ deadline, withinDeadline, refundAmount, canCancel }`), `BookingDetail.cancellation: BookingCancellation | null`, `Booking.cancellationDeadline`, `CancelBookingResult` (`{ booking, refundedAmount }`), route `bookings.cancel` input `{ code, reason? }`, lỗi `NOT_FOUND` / `NOT_CANCELLABLE` / `REFUND_FAILED`; `bookings.checkout` lỗi `DEPARTURE_NOT_AVAILABLE` (Task 4).
- Produces:
  - `apps/web/src/lib/booking-vm.ts`:
    - `export type BookingAction = 'payNow' | 'cancelPending' | 'cancelBooking';`
    - `export function bookingView(b: Booking, cancellation?: BookingCancellation | null): BookingView;`
    - `export function cancellationDeadlineText(cancellation: BookingCancellation | null): string | null;`
    - `export function legacyCancellationNote(b: Booking): string | null;`
    - giữ nguyên `BookingView`, `BookingViewTone`, `RefundSummary`, `refundSummary`; xoá `CancellationView`, `toCancellationView`.
  - `apps/web/src/components/account/booking-actions.tsx`: `export interface CancelDialogBooking`; `BookingActions` nhận `booking?: CancelDialogBooking` thay `refund?: RefundEstimateInput` (xoá `RefundEstimateInput`).
  - `@tourism/i18n` (Task 10 dùng): `messages.cancellationDeadline.full(date: string)`, `messages.cancellationDeadline.passed(date: string)`, `messages.cancellationDeadline.policyLink`, `messages.accountActionErrors.bookingClosed`.

- [ ] **Step 1: Kiểm tiền đề của Task 6**

Chạy (Git Bash, gốc worktree):

```bash
grep -n "BookingCancellationSchema = \|CancelBookingResultSchema = \|cancellationDeadline: z.iso.date()\|cancellation: BookingCancellationSchema.nullable()" libs/shared/contract/src/schemas/bookings.ts
grep -n "cancellationDeadline\|cancellation:" apps/web/src/test/fixtures/booking.ts
```

Expected: lệnh đầu in đủ bốn dòng; lệnh sau in hai dòng (`cancellationDeadline: …` và `cancellation: …`). Thiếu dòng nào thì dừng lại, báo session gốc: Task 6 chưa xong.

- [ ] **Step 2: Viết test đỏ cho view-model** — thay toàn bộ `apps/web/src/lib/booking-vm.spec.ts`:

```ts
import type { BookingCancellation } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  bookingView,
  cancellationDeadlineText,
  legacyCancellationNote,
  refundSummary,
} from './booking-vm';

/** Cờ huỷ SERVER trả ở `bookings.byCode` — mặc định: còn trong hạn, huỷ được. */
function cancellationOf(overrides: Partial<BookingCancellation> = {}): BookingCancellation {
  return {
    deadline: '2026-10-13',
    withinDeadline: true,
    refundAmount: '1200.00',
    canCancel: true,
    ...overrides,
  };
}

describe('bookingView', () => {
  it('PENDING → warning + [payNow, cancelPending]', () => {
    const view = bookingView(makeBooking({ status: 'PENDING', cancellation: null }));
    expect(view).toEqual({
      tone: 'warning',
      statusKey: 'PENDING',
      actions: ['payNow', 'cancelPending'],
    });
  });

  it('PAID + server cho huỷ → success + [cancelBooking]', () => {
    const view = bookingView(makeBooking({ status: 'PAID' }), cancellationOf());
    expect(view).toEqual({ tone: 'success', statusKey: 'PAID', actions: ['cancelBooking'] });
  });

  it('PAID đã quá hạn chót nhưng chưa khởi hành → vẫn có nút huỷ (huỷ không hoàn)', () => {
    // Quá hạn KHÔNG khoá nút: khách vẫn tự huỷ, chỉ là hoàn 0 (ADR-0041 §4).
    const view = bookingView(
      makeBooking({ status: 'PAID' }),
      cancellationOf({ withinDeadline: false, refundAmount: '0.00' }),
    );
    expect(view.actions).toEqual(['cancelBooking']);
  });

  it('PAID + server báo không huỷ online được (đã tới ngày khởi hành) → success + []', () => {
    const view = bookingView(
      makeBooking({ status: 'PAID' }),
      cancellationOf({ withinDeadline: false, refundAmount: '0.00', canCancel: false }),
    );
    expect(view).toEqual({ tone: 'success', statusKey: 'PAID', actions: [] });
  });

  it('PAID không kèm cờ huỷ (danh sách `mine`, hộ chiếu) → success + [], không tự đoán', () => {
    const view = bookingView(makeBooking({ status: 'PAID' }));
    expect(view).toEqual({ tone: 'success', statusKey: 'PAID', actions: [] });
  });

  it('PARTIALLY_REFUNDED + server cho huỷ → destructive + [cancelBooking]', () => {
    const view = bookingView(makeBooking({ status: 'PARTIALLY_REFUNDED' }), cancellationOf());
    expect(view).toEqual({
      tone: 'destructive',
      statusKey: 'PARTIALLY_REFUNDED',
      actions: ['cancelBooking'],
    });
  });

  it('REFUNDED → destructive + [] kể cả khi cờ nói huỷ được (spec §3.3: liên hệ)', () => {
    const view = bookingView(makeBooking({ status: 'REFUNDED' }), cancellationOf());
    expect(view).toEqual({ tone: 'destructive', statusKey: 'REFUNDED', actions: [] });
  });

  it('CANCELLED → muted + [] kể cả khi cờ nói huỷ được', () => {
    const view = bookingView(makeBooking({ status: 'CANCELLED' }), cancellationOf());
    expect(view).toEqual({ tone: 'muted', statusKey: 'CANCELLED', actions: [] });
  });
});

describe('cancellationDeadlineText', () => {
  it('server không gửi cờ huỷ → không có câu nào', () => {
    expect(cancellationDeadlineText(null)).toBeNull();
  });

  it('còn trong hạn → ngày chót cụ thể, giờ Việt Nam, và nói rõ sau đó không hoàn', () => {
    expect(cancellationDeadlineText(cancellationOf({ deadline: '2026-10-17' }))).toBe(
      'Free cancellation until 17 Oct, 11:59 pm Vietnam time. No refund after that.',
    );
  });

  it('quá hạn → câu hạn đã qua, vẫn in đúng ngày chót', () => {
    expect(
      cancellationDeadlineText(cancellationOf({ deadline: '2026-10-17', withinDeadline: false })),
    ).toBe('The free-cancellation deadline (17 Oct) has passed.');
  });
});

describe('legacyCancellationNote', () => {
  it('chưa từng gửi yêu cầu → null', () => {
    expect(legacyCancellationNote(makeBooking({ cancellationStatus: null }))).toBeNull();
  });

  it('REQUESTED của luồng duyệt cũ → kể lại ngày gửi, không hứa ai xem xét', () => {
    const b = makeBooking({
      cancellationStatus: 'REQUESTED',
      cancellationRequestedAt: '2026-09-03T08:15:00.000Z',
    });
    expect(legacyCancellationNote(b)).toBe('You sent a cancellation request on 3 Sep 2026.');
  });

  it('DENIED của luồng duyệt cũ → kể lại là đã bị từ chối', () => {
    const b = makeBooking({
      cancellationStatus: 'DENIED',
      cancellationRequestedAt: '2026-09-03T08:15:00.000Z',
    });
    expect(legacyCancellationNote(b)).toBe('Your cancellation request of 3 Sep 2026 was declined.');
  });

  it('REFUNDED (kết cục thường của mọi lần huỷ) → null', () => {
    const b = makeBooking({
      status: 'CANCELLED',
      cancellationStatus: 'REFUNDED',
      cancellationRequestedAt: '2026-09-03T08:15:00.000Z',
    });
    expect(legacyCancellationNote(b)).toBeNull();
  });
});

/**
 * Dòng tiền trên trang chi tiết booking của khách. Tới 04/09 trang ấy KHÔNG hề
 * nói số tiền đã hoàn — khách chỉ thấy chữ "Cancelled", còn con số nằm trong
 * hộp mail.
 */
describe('refundSummary', () => {
  it('chưa từng trả tiền → KHÔNG kể gì, kể cả khi đã huỷ', () => {
    // PENDING hết hạn hay khách tự huỷ trước khi trả là "chưa bao giờ có giao
    // dịch", không phải "hoàn 0 đồng".
    expect(refundSummary(makeBooking({ status: 'CANCELLED', paidAt: null }))).toBeNull();
  });

  it('đã trả tiền, chưa hoàn gì, chưa huỷ → KHÔNG kể gì', () => {
    expect(refundSummary(makeBooking({ status: 'PAID', refundedTotal: '0.00' }))).toBeNull();
  });

  it('huỷ mà KHÔNG hoàn đồng nào (huỷ quá hạn chót) → vẫn phải kể', () => {
    // Im lặng thì khách tự đoán rồi ngồi đợi một khoản không bao giờ tới.
    expect(refundSummary(makeBooking({ status: 'CANCELLED', refundedTotal: '0.00' }))).toEqual({
      kind: 'none',
    });
  });

  it('hoàn một phần → mang CẢ số đã hoàn lẫn tổng', () => {
    const summary = refundSummary(
      makeBooking({ status: 'CANCELLED', totalAmount: '29.00', refundedTotal: '10.00' }),
    );
    expect(summary).toEqual({ kind: 'partial', amount: '10.00', total: '29.00' });
  });

  it('hoàn đủ → `full`, không phải `partial`', () => {
    expect(
      refundSummary(
        makeBooking({ status: 'REFUNDED', totalAmount: '29.00', refundedTotal: '29.00' }),
      ),
    ).toEqual({ kind: 'full', amount: '29.00' });
  });

  it("'0' và '0.00' là cùng một số tiền — so bằng số, không bằng chuỗi", () => {
    expect(refundSummary(makeBooking({ status: 'CANCELLED', refundedTotal: '0' }))).toEqual({
      kind: 'none',
    });
  });

  it('lẻ cent vượt tổng vẫn là `full`, không rơi xuống `partial`', () => {
    expect(
      refundSummary(
        makeBooking({ status: 'REFUNDED', totalAmount: '29.00', refundedTotal: '29.01' }),
      ),
    ).toEqual({ kind: 'full', amount: '29.01' });
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận đỏ**

Run: `pnpm --filter @tourism/web exec vitest run src/lib/booking-vm.spec.ts`
Expected: FAIL — `cancellationDeadlineText`, `legacyCancellationNote` không phải export của `./booking-vm`; các ca `cancelBooking` nhận `['requestCancellation']` hoặc `[]`.

- [ ] **Step 4: Sửa copy ở `libs/shared/i18n/src/lib/messages.ts`** (năm chỗ)

4a. Dòng 484, trong `booking.success` — bỏ lời hứa "anytime":

```ts
      nextManage: 'View or cancel this trip anytime in Trips.',
```

thành

```ts
      nextManage: 'View or cancel this trip in Trips.',
```

4b. Xoá trọn khối `booking.detail` (dòng 537–614: ước tính theo bậc, câu ân hạn dùng `REFUND_GRACE_HOURS`, "What happens next" với "2 business days", copy xin huỷ bắt buộc lý do). Sau khi Task 7 viết lại `booking-actions.tsx`, không file nào còn đọc `messages.booking.detail` (đã grep: consumer duy nhất là `booking-actions.tsx`; admin, mobile, API không dùng). Trước:

```ts
      viewDetails: 'View details',
    },
    detail: {
      back: 'Back to my bookings',
      title: 'Booking details',
```

… (giữ nguyên nội dung ở giữa để xoá cùng) …

```ts
      refundedNote: (amount: string) => `Refunded ${amount}.`,
      partiallyRefundedNote: (amount: string) => `Partially refunded ${amount}.`,
    },
  },
  // Card tóm tắt đơn ở cột phải trang /tours/[slug]/book (checkout hướng B —
```

Sau:

```ts
      viewDetails: 'View details',
    },
  },
  // Card tóm tắt đơn ở cột phải trang /tours/[slug]/book (checkout hướng B —
```

`import { REFUND_GRACE_HOURS } from '@tourism/contract';` ở dòng 3 GIỮ NGUYÊN: khối admin cancellations (dòng ~3730, `grace:`) vẫn dùng; Task 8 gỡ khối đó.

4c. Chèn khối mới ngay trước `  common: {` (sau dấu `  },` đóng `checkoutSummary`):

```ts
  /**
   * Câu hạn chót huỷ miễn phí (ADR-0041) — MỘT nguồn cho mọi chỗ in ngày chót:
   * trang booking, trang thanh toán thành công, checkout, trang tour. `date` đã
   * định dạng sẵn ("17 Oct", `formatChipDate`). Luôn ghi "Vietnam time": hạn chót
   * là ngày lịch Việt Nam, không phải ngày trên máy khách.
   */
  cancellationDeadline: {
    full: (date: string) =>
      `Free cancellation until ${date}, 11:59 pm Vietnam time. No refund after that.`,
    passed: (date: string) => `The free-cancellation deadline (${date}) has passed.`,
    /** Nhãn link sang `/cancellation-policy` đứng cạnh các câu hạn chót — không còn "refund schedule" theo bậc. */
    policyLink: 'Read the cancellation policy',
  },
```

4d. Thay trọn khối `accountBookingDetail` (từ dòng `  accountBookingDetail: {` tới dấu `  },` ngay trước comment `  // Trang \`/account/profile\` hợp nhất (spec §3)`) bằng:

```ts
  accountBookingDetail: {
    /**
     * Chuyện gì đã xảy ra với tiền, in ngay trên giấy tờ booking. Trước 04/09
     * khách hoàn một phần chỉ thấy chữ "Cancelled" — bằng chứng duy nhất về số
     * tiền nằm trong hộp mail.
     */
    refundLine: {
      full: (amount: string) => `${amount} has been refunded to your original payment method.`,
      /** Nói CẢ hai số: chỉ in số đã hoàn thì khách dễ tưởng đó là toàn bộ. */
      partial: (amount: string, total: string) =>
        `${amount} of ${total} has been refunded to your original payment method.`,
      /** Huỷ mà không hoàn đồng nào cũng phải nói ra, kẻo khách ngồi đợi. */
      none: 'No refund was due on this booking.',
      timing: 'It can take 5–10 business days to appear on your statement.',
      // Nhãn link khi không hoàn đồng nào: dùng `cancellationDeadline.policyLink`
      // (khoá `schedule` cũ nói "refund schedule" theo bậc — đã gỡ).
    },
    // Task 7 (redesign hướng A): link cạnh H1 sang trang tour công khai
    // (`/tours/{tourSlug}`) — riêng cho namespace này, KHÔNG tái dùng
    // `view`/`viewTour` của namespace khác (đã có tiền lệ mỗi trang giữ bản
    // copy riêng dù cùng chữ, xem `accountBookings.list.viewTour`).
    viewTour: 'View tour',
    /** Trang visa (M2) chỉ còn dùng đúng hai mục còn sống của bộ ba cũ —
     *  `bookingHeading`/`contactHeading`/… (redesign 11/08) đã dọn ngày
     *  11/08 (không còn section riêng cho booking/contact/actions trên
     *  trang visa, xem `AccountBookingDetailPage`). */
    sections: {
      reviewHeading: 'Your review',
      reviewBlurb: 'Tell other travellers how it went.',
    },
    // Terminal (CANCELLED/REFUNDED/PARTIALLY_REFUNDED không còn nút huỷ) — câu
    // trạng thái; số tiền đã hoàn nằm ở `refundLine`.
    terminalNote: {
      CANCELLED: 'This booking was cancelled.',
      REFUNDED: 'This booking was refunded.',
      PARTIALLY_REFUNDED: 'Part of this booking was refunded.',
    } as Record<string, string>,
    actions: {
      payNow: 'Pay now',
      /** Nhãn nút mở hộp huỷ — chung cho booking chưa trả (PENDING) và đã trả. */
      cancel: 'Cancel booking',
      cancelConfirmTitle: 'Cancel this booking?',
      cancelConfirmBody: 'This releases your pending reservation. You can book again any time.',
      cancelConfirmCta: 'Yes, cancel it',
      cancelDismiss: 'Keep booking',
    },
    /**
     * Hộp xác nhận huỷ booking ĐÃ TRẢ (ADR-0041 §4) — hai dạng theo cờ
     * `withinDeadline` server trả. Quá hạn: câu đầu là
     * `cancellationDeadline.passed(date)`, component nối `afterBody` phía sau
     * (một câu một khoá). Số tiền định dạng bằng `formatMoneyExact` ở component.
     */
    cancelDialog: {
      withinBody: (amount: string) =>
        `Cancel and get a full refund of ${amount}? It usually reaches your original payment method in 5–10 business days.`,
      withinCta: (amount: string) => `Cancel and refund ${amount}`,
      afterBody: 'If you cancel now, you won’t be refunded.',
      /** Lối cho ca đặc biệt — form hỏi đáp của tour; admin xem xét hoàn thiện chí (spec §3.4). */
      afterContact: 'Something serious happened? Contact us',
      afterCta: 'Cancel without refund',
      // Không bắt buộc: huỷ không còn qua hàng đợi duyệt nên không ai cần lý do
      // để quyết (contract `reason` optional).
      reasonLabel: 'Why are you cancelling? (optional)',
      reasonPlaceholder: 'Anything you’d like us to know.',
      /** Trần 1000 là `max` của `CancelBookingInputSchema.reason`. */
      reasonCounter: (n: number) => `${n} / 1000`,
      submitting: 'Cancelling…',
    },
    /**
     * Yêu cầu huỷ của luồng duyệt đã gỡ (REQUESTED/DENIED) còn trên dữ liệu trước
     * lượt seed lại — chỉ kể lại sự việc, không hứa ai xem xét (spec §5.3).
     */
    legacyRequest: {
      requested: (date: string) => `You sent a cancellation request on ${date}.`,
      denied: (date: string) => `Your cancellation request of ${date} was declined.`,
    },
    policyLink: 'Read our cancellation & refund policy',
    // Chừa chỗ cụm B (form review thật) — placeholder nhẹ, không dựng logic.
    review: {
      heading: 'Your review',
      body: 'Once your trip is done, you’ll be able to leave a review here.',
    },
    // Toast SAU khi hành động ghi thành công — trang tự `router.refresh()` để
    // đọc lại trạng thái mới, toast chỉ báo kết quả.
    toast: {
      /** Tiêu đề chung cho mọi lần huỷ thành công; phần mô tả nói chuyện tiền. */
      cancelledTitle: 'Booking cancelled',
      cancelPendingBody: 'Your pending reservation has been released.',
    },
  },
```

4e. Thay trọn khối `accountActionErrors` (dòng 2738–2748) bằng:

```ts
  accountActionErrors: {
    generic: 'Something went wrong. Please try again.',
    throttle: 'Too many requests — please wait a minute and try again.',
    /** 422 `NOT_CANCELLABLE` — booking không còn huỷ online được (đã huỷ ở tab khác, đã tới ngày khởi hành…). */
    notCancellable: 'This booking can’t be cancelled online. Contact us for help.',
    /** 502 `REFUND_FAILED` — cổng thanh toán lỗi nên server không ghi gì; nói rõ booking còn nguyên để khách thử lại. */
    refundFailed:
      'We couldn’t process your refund, so your booking hasn’t changed. Please try again.',
    /** 400 `DEPARTURE_NOT_AVAILABLE` ở "Pay now" và ở wizard đặt chỗ — chuyến đã qua hạn đặt (ADR-0041 §3). */
    bookingClosed: 'Booking for this departure has closed.',
    sessionExpired: 'Your session has expired.',
    loginLink: 'Log in again',
  },
```

(Khoá `alreadyRequested` bị xoá: route không còn lỗi 409 `ALREADY_REQUESTED`.)

- [ ] **Step 5: Build contract và i18n**

```bash
pnpm --filter @tourism/contract build
pnpm --filter @tourism/i18n build
```

Expected: cả hai exit 0.

- [ ] **Step 6: Cài đặt view-model** — thay toàn bộ `apps/web/src/lib/booking-vm.ts`:

```ts
import type { Booking, BookingCancellation } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatChipDate, formatDate } from './tours';

/** Tông màu badge — token-only (spec §3), map 1-1 theo nhóm status. */
export type BookingViewTone = 'success' | 'warning' | 'muted' | 'destructive';

/**
 * Hành động khả dụng trên trang chi tiết booking.
 *
 * `cancelBooking` thay bộ ba `requestCancellation`/`viewCancellationPending`/
 * `resubmitCancellation` của luồng khách xin huỷ, admin duyệt — luồng đó gỡ
 * theo ADR-0041 §4: khách huỷ là huỷ ngay, không còn trạng thái "đang chờ".
 */
export type BookingAction = 'payNow' | 'cancelPending' | 'cancelBooking';

/**
 * Kết quả bảng quyết định — component CHỈ render `BookingView`, KHÔNG
 * if/else theo status trong JSX ngoài map action→nút (plan Task 4 cụm cũ).
 */
export interface BookingView {
  tone: BookingViewTone;
  statusKey: string;
  actions: BookingAction[];
}

/**
 * Bảng quyết định status → (tone, hành động) — hàm THUẦN:
 *
 * - `PENDING` → warning + [payNow, cancelPending].
 * - `PAID` → success; `PARTIALLY_REFUNDED` → destructive. Cả hai có
 *   [cancelBooking] khi và chỉ khi SERVER nói `cancellation.canCancel`
 *   (spec §5.3) — kể cả khi đã quá hạn chót: huỷ vẫn được, chỉ là hoàn 0.
 * - `CANCELLED` → muted + [] (terminal).
 * - `REFUNDED` → destructive + [] — đã hoàn thiện chí toàn bộ thì không huỷ
 *   online, khách liên hệ (spec §3.3).
 *
 * Web KHÔNG tự so ngày để quyết có nút huỷ hay không (ADR-0041 §7): `cancellation`
 * là cờ `bookings.byCode` trả. Vắng cờ (danh sách `mine`, hộ chiếu) thì không
 * có nút huỷ, còn tone giữ nguyên nên `passport.ts` không bị ảnh hưởng.
 */
export function bookingView(
  b: Booking,
  cancellation: BookingCancellation | null = null,
): BookingView {
  const cancel: BookingAction[] = cancellation?.canCancel ? ['cancelBooking'] : [];
  switch (b.status) {
    case 'PENDING':
      return { tone: 'warning', statusKey: b.status, actions: ['payNow', 'cancelPending'] };
    case 'PAID':
      return { tone: 'success', statusKey: b.status, actions: cancel };
    case 'CANCELLED':
      return { tone: 'muted', statusKey: b.status, actions: [] };
    case 'REFUNDED':
      return { tone: 'destructive', statusKey: b.status, actions: [] };
    case 'PARTIALLY_REFUNDED':
      return { tone: 'destructive', statusKey: b.status, actions: cancel };
  }
}

/**
 * Câu hạn chót huỷ miễn phí cho trang booking và trang thanh toán thành công —
 * `null` khi server không gửi `cancellation` (booking không ở PAID hoặc
 * PARTIALLY_REFUNDED).
 *
 * Chỉ IN cờ `withinDeadline` và ngày `deadline` server tính: trang không so
 * ngày chót với giờ trình duyệt, nên chỉnh đồng hồ máy không đổi được câu này
 * (spec §2 Q7).
 */
export function cancellationDeadlineText(
  cancellation: BookingCancellation | null,
): string | null {
  if (cancellation === null) return null;
  const t = messages.cancellationDeadline;
  const date = formatChipDate(cancellation.deadline);
  return cancellation.withinDeadline ? t.full(date) : t.passed(date);
}

/**
 * Yêu cầu huỷ của luồng duyệt đã gỡ (REQUESTED, DENIED) còn nằm trên dữ liệu
 * trước lượt seed lại — in dạng chỉ đọc, chỉ kể lại sự việc (spec §5.3).
 * REFUNDED là kết cục thường của mọi lần huỷ nên không có dòng riêng.
 */
export function legacyCancellationNote(b: Booking): string | null {
  if (b.cancellationRequestedAt === null) return null;
  const t = messages.accountBookingDetail.legacyRequest;
  // Mốc ISO đầy đủ: cắt phần ngày trước khi đưa `formatDate` (hàm đó chỉ nhận
  // `YYYY-MM-DD`, cùng lý do ở dòng "Booked …" của trang chi tiết).
  const sentOn = formatDate(b.cancellationRequestedAt.slice(0, 10));
  if (b.cancellationStatus === 'REQUESTED') return t.requested(sentOn);
  if (b.cancellationStatus === 'DENIED') return t.denied(sentOn);
  return null;
}

/**
 * Chuyện gì đã xảy ra với TIỀN của khách — `null` khi không có gì để kể.
 *
 * Có mặt vì tới 04/09 trang chi tiết booking của khách không hề nói số tiền
 * đã hoàn: khách thấy đúng chữ "Cancelled" và không gì khác, còn bằng chứng
 * duy nhất nằm trong hộp mail.
 *
 * `none` (huỷ mà không hoàn đồng nào) CŨNG là một câu chuyện phải kể: im lặng
 * thì khách tự đoán rồi ngồi đợi một khoản không bao giờ tới.
 */
export type RefundSummary =
  | { kind: 'full'; amount: string }
  | { kind: 'partial'; amount: string; total: string }
  | { kind: 'none' };

/**
 * Booking chưa từng thu tiền thì KHÔNG kể gì: PENDING hết hạn hay khách tự
 * huỷ trước khi trả là "chưa bao giờ có giao dịch", không phải "hoàn 0 đồng".
 * Đó là lý do cổng đầu tiên là `paidAt`, không phải status.
 *
 * So sánh bằng `Number` chứ không bằng chuỗi: '0' và '0.00' là cùng một số
 * tiền, và cả hai đều xuất hiện thật (API trả '0.00', sổ rỗng trả '0').
 */
export function refundSummary(b: Booking): RefundSummary | null {
  if (b.paidAt === null) return null;
  const refunded = Number(b.refundedTotal);
  const total = Number(b.totalAmount);
  if (refunded <= 0) return b.status === 'CANCELLED' ? { kind: 'none' } : null;
  // `>=` chứ không `===`: sổ chốt trần ở total (trigger ADR-0009), nhưng một
  // ca làm tròn lẻ cent không được biến "đã hoàn đủ" thành "hoàn một phần".
  if (refunded >= total) return { kind: 'full', amount: b.refundedTotal };
  return { kind: 'partial', amount: b.refundedTotal, total: b.totalAmount };
}
```

- [ ] **Step 7: Chạy test view-model, xác nhận xanh**

Run: `pnpm --filter @tourism/web exec vitest run src/lib/booking-vm.spec.ts src/lib/passport.spec.ts`
Expected: PASS — `booking-vm.spec.ts` 22 test; `passport.spec.ts` giữ nguyên số test cũ (tone không đổi).

- [ ] **Step 8: Viết test đỏ cho component** — thay toàn bộ `apps/web/src/components/account/booking-actions.spec.tsx`:

```tsx
import { createORPCErrorFromJson, ORPCError } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BookingCancellation } from '@tourism/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingView } from '@/lib/booking-vm';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingActions, type CancelDialogBooking } from './booking-actions';

/**
 * BookingActions CHỈ render theo `BookingView.actions` — spec phủ đủ ba
 * `BookingAction`, hai dạng hộp xác nhận huỷ (trong hạn / quá hạn, ADR-0041),
 * CỘNG hành động THẬT khi có `code` (describe cuối file).
 */

// Mock next/navigation — `router.refresh()` sau mutation thành công.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

// Mock client oRPC — spec chỉ kiểm gọi ĐÚNG procedure/payload, không gọi API thật.
const { checkout, cancelPending, cancel } = vi.hoisted(() => ({
  checkout: vi.fn(),
  cancelPending: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({
  api: { bookings: { checkout, cancelPending, cancel } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

// Mock sonner — toast CHỈ cho kết quả thành công.
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

const CODE = 'BK-20260904-WXYZ';

const PAID_VIEW: BookingView = {
  tone: 'success',
  statusKey: 'PAID',
  actions: ['cancelBooking'],
};

/** Cờ huỷ SERVER trả — mặc định còn hạn, hoàn 1200. */
function cancellationOf(overrides: Partial<BookingCancellation> = {}): BookingCancellation {
  return {
    deadline: '2026-10-13',
    withinDeadline: true,
    refundAmount: '1200.00',
    canCancel: true,
    ...overrides,
  };
}

/** Quá hạn chót nhưng chưa khởi hành — huỷ được, hoàn 0. */
const AFTER_DEADLINE = cancellationOf({ withinDeadline: false, refundAmount: '0.00' });

function dialogBooking(
  cancellation: BookingCancellation | null = cancellationOf(),
): CancelDialogBooking {
  return {
    code: CODE,
    tourTitle: 'Ha Long Bay Overnight Cruise',
    tourSlug: 'ha-long-bay-cruise',
    departureStartDate: '2026-10-20',
    departureEndDate: '2026-10-23',
    numAdults: 2,
    numChildren: 1,
    currency: 'USD',
    cancellation,
  };
}

const POLICY_LINK = 'Read our cancellation & refund policy';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BookingActions', () => {
  it('PENDING (payNow + cancelPending) → hai nút, bấm Pay now gọi onAction đúng tham số', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const view: BookingView = {
      tone: 'warning',
      statusKey: 'PENDING',
      actions: ['payNow', 'cancelPending'],
    };
    render(<BookingActions view={view} onAction={onAction} />);

    expect(screen.getByRole('button', { name: 'Pay now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pay now' }));
    expect(onAction).toHaveBeenCalledWith('payNow');
  });

  it('payNow-only (KHÔNG có action huỷ) → KHÔNG render policy link', () => {
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['payNow'] };
    render(<BookingActions view={view} />);

    expect(screen.getByRole('button', { name: 'Pay now' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: POLICY_LINK })).not.toBeInTheDocument();
  });

  it('cancelPending → mở dialog confirm, bấm "Yes, cancel it" gọi onAction("cancelPending")', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['cancelPending'] };
    render(<BookingActions view={view} onAction={onAction} />);

    expect(screen.getByRole('link', { name: POLICY_LINK })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(screen.getByText('Cancel this booking?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    expect(onAction).toHaveBeenCalledWith('cancelPending');
  });

  it('cancelBooking → nút "Cancel booking" cùng policy link ngay cạnh', () => {
    render(<BookingActions view={PAID_VIEW} booking={dialogBooking()} />);

    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: POLICY_LINK })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );
  });

  it('cancelBooking mà trang không truyền dữ liệu hộp xác nhận → không bày nút huỷ', () => {
    render(<BookingActions view={PAID_VIEW} />);
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
  });

  it('cancelBooking mà cờ huỷ null → không bày nút huỷ', () => {
    render(<BookingActions view={PAID_VIEW} booking={dialogBooking(null)} />);
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
  });

  it('không còn trạng thái "requested / pending / resubmit" nào', () => {
    render(<BookingActions view={PAID_VIEW} booking={dialogBooking()} />);
    expect(screen.queryByText(/pending review/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /request cancellation/i })).toBeNull();
  });

  it('actions rỗng (terminal) → không render gì', () => {
    const view: BookingView = { tone: 'muted', statusKey: 'CANCELLED', actions: [] };
    const { container } = render(<BookingActions view={view} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('KHÔNG truyền onAction lẫn code → bấm xác nhận không throw, không gọi API', async () => {
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} booking={dialogBooking()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' }));
    expect(cancel).not.toHaveBeenCalled();
  });
});

/**
 * Hộp xác nhận hai dạng (spec §5.3). Câu, số tiền và ngày đều IN từ cờ server
 * (`cancellation`) — component không tự so ngày chót với giờ trình duyệt.
 */
describe('BookingActions — hộp xác nhận huỷ', () => {
  async function openDialog(booking: CancelDialogBooking, onAction = vi.fn()) {
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} booking={booking} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    return { user, onAction };
  }

  it('trong hạn → hỏi kèm số tiền hoàn đủ và thời gian tiền về; nút nói số tiền', async () => {
    await openDialog(dialogBooking());

    expect(
      screen.getByText(
        'Cancel and get a full refund of $1,200.00? It usually reaches your original payment method in 5–10 business days.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Something serious happened? Contact us' })).toBeNull();
  });

  it('quá hạn → nói ngày chót đã qua, không hoàn, kèm link hỏi đáp của tour', async () => {
    await openDialog(dialogBooking(AFTER_DEADLINE));

    expect(
      screen.getByText(
        'The free-cancellation deadline (13 Oct) has passed. If you cancel now, you won’t be refunded.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel without refund' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Something serious happened? Contact us' }),
    ).toHaveAttribute('href', '/tours/ha-long-bay-cruise/enquire');
  });

  it('nói RÕ đang huỷ booking nào — tên tour, số khách, mã', async () => {
    await openDialog(dialogBooking());

    expect(screen.getByText('Ha Long Bay Overnight Cruise')).toBeInTheDocument();
    expect(screen.getByText('2 adults, 1 child')).toBeInTheDocument();
    expect(screen.getByText(CODE)).toBeInTheDocument();
  });

  it('bỏ hẳn ước tính theo phần trăm, số ngày, ân hạn và mục "What happens next"', async () => {
    await openDialog(dialogBooking());

    expect(screen.queryByText(/% of/)).toBeNull();
    expect(screen.queryByText(/departs in/i)).toBeNull();
    expect(screen.queryByText(/24 hours/)).toBeNull();
    expect(screen.queryByText('What happens next')).toBeNull();
  });

  it('lý do không bắt buộc: bấm xác nhận khi ô trống → onAction nhận reason undefined', async () => {
    const { user, onAction } = await openDialog(dialogBooking());

    await user.click(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' }));
    expect(onAction).toHaveBeenCalledWith('cancelBooking', undefined);
  });

  it('có gõ lý do → onAction nhận lý do đã trim', async () => {
    const { user, onAction } = await openDialog(dialogBooking(AFTER_DEADLINE));

    await user.type(screen.getByRole('textbox'), '  Plans changed  ');
    await user.click(screen.getByRole('button', { name: 'Cancel without refund' }));
    expect(onAction).toHaveBeenCalledWith('cancelBooking', 'Plans changed');
  });
});

/**
 * Hành động THẬT — page truyền `code`, KHÔNG truyền `onAction` → component tự
 * gọi oRPC (try/catch/finally; 401 giữa chừng → message + link đăng nhập; lỗi
 * khác → copy theo mã lỗi; KHÔNG mất state).
 */
describe('BookingActions — hành động thật (code, không có onAction)', () => {
  it('payNow → gọi bookings.checkout({code}), thành công → redirect tới checkoutUrl', async () => {
    // jsdom `window.location.assign` không implement và không configurable —
    // thay cả object `location` qua `vi.stubGlobal`, phục hồi ở cuối test.
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    checkout.mockResolvedValueOnce({ checkoutUrl: 'https://checkout.example/session/abc' });
    const user = userEvent.setup();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['payNow'] };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Pay now' }));

    await waitFor(() => expect(checkout).toHaveBeenCalledWith({ code: CODE }, expect.anything()));
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://checkout.example/session/abc'),
    );
    vi.unstubAllGlobals();
  });

  it('payNow gặp DEPARTURE_NOT_AVAILABLE (chuyến đã qua hạn đặt) → câu "đã ngừng nhận đặt"', async () => {
    checkout.mockRejectedValueOnce(new ORPCError('DEPARTURE_NOT_AVAILABLE', { status: 400 }));
    const user = userEvent.setup();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['payNow'] };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Pay now' }));

    expect(await screen.findByText('Booking for this departure has closed.')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('cancelPending → confirm → gọi bookings.cancelPending({code}), thành công → toast + refresh', async () => {
    cancelPending.mockResolvedValueOnce({});
    const user = userEvent.setup();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['cancelPending'] };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }));

    await waitFor(() =>
      expect(cancelPending).toHaveBeenCalledWith({ code: CODE }, expect.anything()),
    );
    expect(toastSuccess).toHaveBeenCalledWith('Booking cancelled', {
      description: 'Your pending reservation has been released.',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('cancelBooking có lý do → gọi bookings.cancel({code, reason}); toast nói số tiền ĐÃ hoàn + refresh', async () => {
    cancel.mockResolvedValueOnce({
      booking: makeBooking({ code: CODE, status: 'CANCELLED', currency: 'USD' }),
      refundedAmount: '1200.00',
    });
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} code={CODE} booking={dialogBooking()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.type(screen.getByRole('textbox'), 'Family emergency');
    await user.click(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' }));

    await waitFor(() =>
      expect(cancel).toHaveBeenCalledWith(
        { code: CODE, reason: 'Family emergency' },
        expect.anything(),
      ),
    );
    expect(toastSuccess).toHaveBeenCalledWith('Booking cancelled', {
      description: '$1,200.00 has been refunded to your original payment method.',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('cancelBooking ô lý do chỉ có khoảng trắng → input KHÔNG mang reason; hoàn 0 → toast "không hoàn"', async () => {
    cancel.mockResolvedValueOnce({
      booking: makeBooking({ code: CODE, status: 'CANCELLED', currency: 'USD' }),
      refundedAmount: '0.00',
    });
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} code={CODE} booking={dialogBooking(AFTER_DEADLINE)} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.type(screen.getByRole('textbox'), '   ');
    await user.click(screen.getByRole('button', { name: 'Cancel without refund' }));

    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    // `toHaveBeenCalledWith` coi `reason: undefined` bằng với vắng khoá — soi thẳng payload.
    const input = cancel.mock.calls[0]?.[0];
    expect(input).toEqual({ code: CODE });
    expect(input).not.toHaveProperty('reason');
    expect(toastSuccess).toHaveBeenCalledWith('Booking cancelled', {
      description: 'No refund was due on this booking.',
    });
  });

  it('REFUND_FAILED → câu "booking chưa đổi, thử lại" trong hộp; không refresh; nút bấm lại được', async () => {
    cancel.mockRejectedValueOnce(new ORPCError('REFUND_FAILED', { status: 502 }));
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} code={CODE} booking={dialogBooking()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' }));

    expect(
      await screen.findByText(
        'We couldn’t process your refund, so your booking hasn’t changed. Please try again.',
      ),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' })).toBeEnabled();
  });

  it('NOT_CANCELLABLE → câu "không huỷ online được" và làm mới trang', async () => {
    cancel.mockRejectedValueOnce(new ORPCError('NOT_CANCELLABLE', { status: 422 }));
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} code={CODE} booking={dialogBooking()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' }));

    expect(
      await screen.findByText('This booking can’t be cancelled online. Contact us for help.'),
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('lỗi chung (network/5xx) → message lỗi inline, KHÔNG mất state', async () => {
    cancelPending.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    const view: BookingView = { tone: 'warning', statusKey: 'PENDING', actions: ['cancelPending'] };
    render(<BookingActions view={view} code={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Yes, cancel it' })).toBeEnabled();
  });

  it('401 giữa chừng → message riêng + link /login?redirect=, KHÔNG auto-signout', async () => {
    cancel.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: false,
        code: 'UNAUTHORIZED',
        status: 401,
        message: 'Unauthorized',
        data: null,
      }),
    );
    const user = userEvent.setup();
    render(<BookingActions view={PAID_VIEW} code={CODE} booking={dialogBooking()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Cancel and refund $1,200.00' }));

    expect(await screen.findByText('Your session has expired.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in again' })).toHaveAttribute(
      'href',
      `/login?redirect=/account/bookings/${CODE}`,
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 9: Chạy test component, xác nhận đỏ**

Run: `pnpm --filter @tourism/web exec vitest run src/components/account/booking-actions.spec.tsx`
Expected: FAIL — `CancelDialogBooking` không tồn tại; không tìm thấy nút "Cancel and refund $1,200.00", câu `Booking for this departure has closed.`, v.v.

- [ ] **Step 10: Cài đặt component** — thay toàn bộ `apps/web/src/components/account/booking-actions.tsx`:

```tsx
'use client';

import { ORPCError } from '@orpc/client';
import type { BookingCancellation } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@tourism/ui/components/alert-dialog';
import { Button } from '@tourism/ui/components/button';
import { Label } from '@tourism/ui/components/label';
import { Textarea } from '@tourism/ui/components/textarea';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { api, withBrowserAuth } from '@/lib/api/client';
import { classifySubmitError } from '@/lib/api/submit';
import type { BookingAction, BookingView } from '@/lib/booking-vm';
import { isCheckoutUrl } from '@/lib/checkout-url';
import { formatChipDate, formatDateRange, formatMoneyExact } from '@/lib/tours';

/** Trần `reason` của contract (`CancelBookingInputSchema.max(1000)`). */
const REASON_MAX = 1000;

/**
 * Phân loại lỗi hành động. 401 giữa chừng (session hết hạn khi đang thao tác)
 * có UI RIÊNG — message + link đăng nhập lại, KHÔNG auto-signout — tách khỏi
 * `classifySubmitError` (chỉ phân throttle/lỗi chung, không biết về 401).
 *
 * Khớp theo `code` của lỗi contract chứ không theo status: 422 của
 * `bookings.checkout` là `NOT_PENDING` còn 422 của `bookings.cancel` là
 * `NOT_CANCELLABLE` — cùng status, hai chuyện khác nhau (cùng khuôn
 * `bookingSubmitErrorCopy` ở `booking-form.ts`).
 */
type ActionErrorKind =
  | 'sessionExpired'
  | 'throttle'
  | 'refundFailed'
  | 'notCancellable'
  | 'bookingClosed'
  | 'generic';

function classifyActionError(error: unknown): ActionErrorKind {
  if (error instanceof ORPCError) {
    if (error.status === 401) return 'sessionExpired';
    if (error.code === 'REFUND_FAILED') return 'refundFailed';
    if (error.code === 'NOT_CANCELLABLE') return 'notCancellable';
    if (error.code === 'DEPARTURE_NOT_AVAILABLE') return 'bookingClosed';
  }
  return classifySubmitError(error) === 'throttle' ? 'throttle' : 'generic';
}

/** Copy tương ứng cho từng loại lỗi KHÔNG phải session (session có UI riêng). */
function errorCopy(kind: ActionErrorKind): string {
  const e = messages.accountActionErrors;
  switch (kind) {
    case 'throttle':
      return e.throttle;
    case 'refundFailed':
      return e.refundFailed;
    case 'notCancellable':
      return e.notCancellable;
    case 'bookingClosed':
      return e.bookingClosed;
    default:
      return e.generic;
  }
}

/**
 * Link chính sách huỷ — đứng NGAY CẠNH nút huỷ cụ thể (chuẩn Booking.com:
 * policy gắn vào đúng hành động). Chỉ hai case có gì để huỷ (`cancelPending`,
 * `cancelBooking`) mới render nó.
 */
function PolicyLink() {
  return (
    <Link
      href="/cancellation-policy"
      className="text-sm text-primary-emphasis underline-offset-4 hover:underline"
    >
      {messages.accountBookingDetail.policyLink}
    </Link>
  );
}

/** Phần booking mà hộp xác nhận huỷ cần — cắt đúng chừng này, không nhận cả entity. */
export interface CancelDialogBooking {
  /** Mã + tên tour + đợt + số khách: người ta phải NHẬN RA thứ mình sắp huỷ. */
  code: string;
  tourTitle: string;
  /** Dựng link `/tours/{slug}/enquire` cho ca quá hạn (ngoại lệ, spec §3.4). */
  tourSlug: string;
  departureStartDate: string;
  departureEndDate: string;
  numAdults: number;
  numChildren: number;
  currency: string;
  /**
   * Cờ, ngày chót và số tiền SERVER tính lúc đọc (`bookings.byCode.cancellation`)
   * — client chỉ in, KHÔNG tự so ngày chót với giờ trình duyệt (ADR-0041 §7).
   * `null` = booking không ở trạng thái huỷ online; khi đó không có nút huỷ.
   */
  cancellation: BookingCancellation | null;
}

/**
 * Hộp xác nhận huỷ booking ĐÃ TRẢ TIỀN — hai dạng theo cờ `withinDeadline`
 * server trả (spec §5.3):
 *
 * - Trong hạn: số tiền hoàn nằm ngay trong câu hỏi và trên nút — đó là thứ
 *   người ta mở hộp này ra để biết.
 * - Quá hạn: nói thẳng không hoàn, kèm lối sang form hỏi đáp của tour cho ca
 *   đặc biệt (hoàn thiện chí do admin quyết, spec §3.4).
 *
 * Lý do KHÔNG bắt buộc: huỷ không còn qua hàng đợi duyệt nên không ai cần nó để
 * quyết. Ô trống (kể cả chỉ khoảng trắng) thì gửi `undefined` để input không
 * mang `reason`.
 *
 * `AlertDialogAction` CỐ Ý không tự đóng dialog (xem `alert-dialog.tsx`): lỗi
 * hiện ngay trong hộp và khách không mất chữ đã gõ.
 */
function CancelBookingDialog({
  booking,
  cancellation,
  pending,
  error,
  onSubmit,
}: {
  booking: CancelDialogBooking;
  cancellation: BookingCancellation;
  pending: boolean;
  /** Lỗi render BÊN TRONG dialog. Để ngoài thì nó nằm sau lớp modal: `getByText`
   *  vẫn thấy nhưng `getByRole` thì không, tức người dùng bàn phím và trình đọc
   *  màn hình KHÔNG với tới được — kể cả link "đăng nhập lại". */
  error?: ReactNode;
  onSubmit: (reason: string | undefined) => void;
}) {
  const t = messages.accountBookingDetail;
  const d = t.cancelDialog;
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const amount = formatMoneyExact(cancellation.refundAmount, booking.currency);
  const within = cancellation.withinDeadline;

  return (
    // Trigger + policy link đứng CHUNG một hàng — "gắn liền vào hành động".
    <div className="inline-flex flex-wrap items-center gap-3">
      <AlertDialog>
        <AlertDialogTrigger
          render={
            // Text-link chứ không phải Button nổi: huỷ là hành động phụ của
            // trang. `h-auto px-0` gỡ khung/đệm của size mặc định.
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 text-destructive-emphasis"
              disabled={pending}
            >
              {t.actions.cancel}
            </Button>
          }
        />
        {/* `max-h`+`overflow-y-auto`: `AlertDialogContent` neo `top-1/2` và KHÔNG
            có trần chiều cao — trên laptop màn thấp nội dung tràn ra hai đầu mà
            không cuộn được, tức mất luôn nút xác nhận. */}
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.actions.cancelConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {/* Một chuỗi duy nhất (một text node) cho cả hai dạng. */}
              {within
                ? d.withinBody(amount)
                : `${messages.cancellationDeadline.passed(formatChipDate(cancellation.deadline))} ${d.afterBody}`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Viền chứ không nền để tách khối: dialog là `bg-popover`, và
              `--card`/`--popover` trong bộ token có thể trùng nhau. */}
          <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
            <p className="font-medium text-foreground">{booking.tourTitle}</p>
            <p className="text-sm text-muted-foreground">
              {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
            </p>
            <p className="text-sm text-muted-foreground">
              {messages.accountBookings.travellers(booking.numAdults, booking.numChildren)}
            </p>
            <p className="pt-1 font-mono text-xs text-muted-foreground">{booking.code}</p>
          </div>

          {within ? null : (
            <Link
              href={`/tours/${booking.tourSlug}/enquire`}
              className="w-fit text-sm text-primary-emphasis underline-offset-4 hover:underline"
            >
              {d.afterContact}
            </Link>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="cancel-reason">{d.reasonLabel}</Label>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {d.reasonCounter(trimmed.length)}
              </span>
            </div>
            <Textarea
              id="cancel-reason"
              rows={3}
              maxLength={REASON_MAX}
              placeholder={d.reasonPlaceholder}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          {error}

          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancelDismiss}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => onSubmit(trimmed.length > 0 ? trimmed : undefined)}
            >
              {pending ? d.submitting : within ? d.withinCta(amount) : d.afterCta}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PolicyLink />
    </div>
  );
}

/**
 * Hành động trang `/account/bookings/[code]` — CHỈ render theo `view.actions`
 * (bảng quyết định `bookingView`), KHÔNG if/else theo status trong JSX.
 *
 * Hai đường gọi handler:
 * - `onAction` truyền tay (spec jsdom truyền `vi.fn()` để soi tham số, KHÔNG
 *   đụng API thật) — override, LUÔN ưu tiên nếu có.
 * - `code` mà KHÔNG có `onAction` → nút thật gọi thẳng oRPC qua client browser
 *   (`credentials: 'include'`, ADR-0017 §1). Đây là đường page (Server
 *   Component) dùng — nó không truyền được hàm client qua ranh giới RSC, nên
 *   truyền DỮ LIỆU (`code`, `booking`) để component tự dựng handler.
 * - Thiếu cả hai → bấm không làm gì, không throw.
 */
export function BookingActions({
  view,
  code,
  booking,
  onAction,
}: {
  view: BookingView;
  /** Mã booking — cần để hành động thật gọi đúng route. Optional vì spec
   *  jsdom truyền `onAction` giả lập, không cần mã thật. */
  code?: string;
  /** Dữ liệu cho hộp xác nhận huỷ booking đã trả; vắng thì không bày nút huỷ đó. */
  booking?: CancelDialogBooking;
  onAction?: (action: BookingAction, reason?: string) => void;
}) {
  const t = messages.accountBookingDetail;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorKind, setErrorKind] = useState<ActionErrorKind | null>(null);
  // Hành động nào vừa hỏng — cần biết để đặt thông báo ĐÚNG chỗ: lỗi của một
  // hành động trong dialog phải hiện trong dialog đó.
  const [errorAt, setErrorAt] = useState<BookingAction | null>(null);

  async function performAction(action: BookingAction, reason?: string) {
    if (!code || pending) return;
    setPending(true);
    setErrorKind(null);
    setErrorAt(null);
    try {
      switch (action) {
        case 'payNow': {
          const result = await api.bookings.checkout({ code }, { context: withBrowserAuth() });
          // isCheckoutUrl (W3-O4): URL không https (dev cho localhost) thì
          // coi như hỏng — không assign chuỗi lạ vào location.
          if (!result.checkoutUrl || !isCheckoutUrl(result.checkoutUrl)) {
            setErrorKind('generic');
            break;
          }
          // Rời trang ngay — KHÔNG router.refresh() (đích tiếp theo là cổng
          // thanh toán ngoài app, không phải một trang Next khác).
          window.location.assign(result.checkoutUrl);
          return;
        }
        case 'cancelPending': {
          await api.bookings.cancelPending({ code }, { context: withBrowserAuth() });
          toast.success(t.toast.cancelledTitle, { description: t.toast.cancelPendingBody });
          router.refresh();
          break;
        }
        case 'cancelBooking': {
          // Lý do chỉ đi kèm khi khách có gõ: contract để `optional`, còn một
          // chuỗi rỗng sẽ ăn 400 vì `min(1)`.
          const result = await api.bookings.cancel(reason ? { code, reason } : { code }, {
            context: withBrowserAuth(),
          });
          // Số tiền lấy từ KẾT QUẢ huỷ, không từ con số hộp xác nhận đã in: sổ
          // có thể đổi giữa lúc mở hộp và lúc bấm (admin hoàn thiện chí cùng lúc).
          const refunded = Number(result.refundedAmount) > 0;
          toast.success(t.toast.cancelledTitle, {
            description: refunded
              ? t.refundLine.full(formatMoneyExact(result.refundedAmount, result.booking.currency))
              : t.refundLine.none,
          });
          router.refresh();
          break;
        }
      }
    } catch (error) {
      const kind = classifyActionError(error);
      setErrorKind(kind);
      setErrorAt(action);
      // Server nói booking không còn huỷ online được (đã huỷ ở tab khác, đã tới
      // ngày khởi hành): đọc lại trang để nút và trạng thái khớp sự thật.
      if (kind === 'notCancellable') router.refresh();
    } finally {
      setPending(false);
    }
  }

  const handleClick = onAction ?? (code ? performAction : undefined);

  const errorNode = errorKind ? (
    <AccountActionError
      expired={errorKind === 'sessionExpired'}
      redirectTo={`/account/bookings/${code}`}
      className="mt-3"
      fallback={errorCopy(errorKind)}
    />
  ) : null;
  /** Hai hành động này sống trong dialog — lỗi của chúng đi vào trong. */
  const IN_DIALOG: BookingAction[] = ['cancelPending', 'cancelBooking'];
  const errorInDialog = errorAt !== null && IN_DIALOG.includes(errorAt);

  if (view.actions.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {view.actions.map((action) => {
          switch (action) {
            case 'payNow':
              return (
                <Button
                  key={action}
                  type="button"
                  disabled={pending}
                  onClick={() => handleClick?.(action)}
                >
                  {t.actions.payNow}
                </Button>
              );
            case 'cancelPending':
              return (
                <div key={action} className="inline-flex flex-wrap items-center gap-3">
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto px-0 text-destructive-emphasis"
                          disabled={pending}
                        >
                          {t.actions.cancel}
                        </Button>
                      }
                    />
                    {/* Khổ hẹp mặc định: booking chưa trả tiền thì không có tiền
                        để bày, dialog này chỉ là một câu hỏi có/không. */}
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t.actions.cancelConfirmTitle}</AlertDialogTitle>
                        <AlertDialogDescription>{t.actions.cancelConfirmBody}</AlertDialogDescription>
                      </AlertDialogHeader>
                      {errorInDialog ? errorNode : null}
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t.actions.cancelDismiss}</AlertDialogCancel>
                        <AlertDialogAction disabled={pending} onClick={() => handleClick?.(action)}>
                          {t.actions.cancelConfirmCta}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <PolicyLink />
                </div>
              );
            case 'cancelBooking':
              // Thiếu dữ liệu hộp xác nhận thì không bày nút: một nút huỷ đụng
              // tiền thật mà không nói được số tiền là mời khách bấm mù.
              if (!booking?.cancellation) return null;
              return (
                <CancelBookingDialog
                  key={action}
                  booking={booking}
                  cancellation={booking.cancellation}
                  pending={pending}
                  error={errorInDialog ? errorNode : null}
                  onSubmit={(reason) => handleClick?.(action, reason)}
                />
              );
            default:
              // `BookingAction` đã cạn ba nhánh ở trên — case này không bao giờ
              // chạy, chỉ để thoả `useIterableCallbackReturn` của Biome.
              return null;
          }
        })}
      </div>
      {errorInDialog ? null : errorNode}
    </>
  );
}
```

- [ ] **Step 11: Chạy test component, xác nhận xanh**

Run: `pnpm --filter @tourism/web exec vitest run src/components/account/booking-actions.spec.tsx`
Expected: PASS — 24 test.

- [ ] **Step 12: Nối trang chi tiết booking** — `apps/web/src/app/(site)/account/bookings/[code]/page.tsx`

12a. Dòng 17, trước:

```ts
import { bookingView, refundSummary, toCancellationView } from '@/lib/booking-vm';
```

sau:

```ts
import {
  bookingView,
  cancellationDeadlineText,
  legacyCancellationNote,
  refundSummary,
} from '@/lib/booking-vm';
```

12b. Dòng 98–102, trước:

```ts
  const slot = reviewSlot(booking);
  const cancellation = toCancellationView(booking.cancellationStatus);
  const view = bookingView(booking, cancellation);
  const terminalNote = t.terminalNote[view.statusKey];
  const refund = refundSummary(booking);
```

sau:

```ts
  const slot = reviewSlot(booking);
  // Nút huỷ và câu hạn chót chỉ theo cờ SERVER (`cancellation`, ADR-0041 §7) —
  // trang không tự so ngày chót với giờ máy.
  const view = bookingView(booking, booking.cancellation);
  const terminalNote = t.terminalNote[view.statusKey];
  const refund = refundSummary(booking);
  const canCancel = view.actions.includes('cancelBooking');
  const deadlineText = canCancel ? cancellationDeadlineText(booking.cancellation) : null;
  const legacyNote = legacyCancellationNote(booking);
```

12c. Dòng 233–270, trước:

```tsx
        {/* ── Dưới giấy tờ: trạng thái terminal + hành động hủy (flow cũ) ── */}
        <div className="mt-5">
          {terminalNote ? (
            <p className="mb-3 text-sm text-muted-foreground">{terminalNote}</p>
          ) : null}
          {/* cancelLead ("Need to change plans?") chỉ có nghĩa khi còn HÀNH
              ĐỘNG HỦY để câu dẫn tới — PENDING vừa có payNow vừa có
              cancelPending; nút "Pay now" + "Cancel booking" bên dưới đã tự
              nói đủ, câu dẫn hủy đứng riêng ở đây đọc lạc trọng tâm (khách
              vừa mở trang, còn chưa chắc đã hủy). Chỉ ẩn khi payNow còn mặt
              trong actions — mọi trạng thái PAID/khác vẫn giữ nguyên câu dẫn. */}
          {!view.actions.includes('payNow') ? (
            <p className="text-sm text-muted-foreground">{tv.cancelLead}</p>
          ) : null}
          <div className="mt-1.5">
            <BookingActions
              view={view}
              code={booking.code}
              // Khách thấy mình được hoàn bao nhiêu TRƯỚC khi bấm gửi
              // (ADR-0030 §3b) — con số do SERVER tính (`refundEstimate`, W1),
              // cùng phép tính mà màn quyết định của admin dùng, nên hai bên
              // không thể nói hai con số khác nhau kể cả khi đồng hồ máy khách
              // lệch.
              refund={{
                code: booking.code,
                tourTitle: booking.tourTitle,
                departureStartDate: booking.departureStartDate,
                departureEndDate: booking.departureEndDate,
                numAdults: booking.numAdults,
                numChildren: booking.numChildren,
                totalAmount: booking.totalAmount,
                refundedTotal: booking.refundedTotal,
                currency: booking.currency,
                estimate: booking.refundEstimate,
              }}
            />
          </div>
        </div>
```

sau:

```tsx
        {/* ── Dưới giấy tờ: trạng thái terminal, hạn chót huỷ, hành động ── */}
        <div className="mt-5">
          {terminalNote ? (
            <p className="mb-3 text-sm text-muted-foreground">{terminalNote}</p>
          ) : null}
          {legacyNote ? <p className="mb-3 text-sm text-muted-foreground">{legacyNote}</p> : null}
          {/* Câu dẫn và ngày chót chỉ đứng trước một nút huỷ THẬT. PENDING có
              "Pay now" + "Cancel booking" tự nói đủ; booking PAID đã khởi hành
              không còn hành động nào, câu dẫn đứng một mình là lơ lửng. */}
          {canCancel ? <p className="text-sm text-muted-foreground">{tv.cancelLead}</p> : null}
          {deadlineText ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{deadlineText}</p>
          ) : null}
          <div className="mt-1.5">
            <BookingActions
              view={view}
              code={booking.code}
              // Hộp xác nhận in số tiền và ngày chót do SERVER tính lúc đọc
              // (`bookings.byCode.cancellation`) — cùng hàm luật mà lõi huỷ
              // dùng, nên con số trong hộp là con số sẽ hoàn.
              booking={{
                code: booking.code,
                tourTitle: booking.tourTitle,
                tourSlug: booking.tourSlug,
                departureStartDate: booking.departureStartDate,
                departureEndDate: booking.departureEndDate,
                numAdults: booking.numAdults,
                numChildren: booking.numChildren,
                currency: booking.currency,
                cancellation: booking.cancellation,
              }}
            />
          </div>
        </div>
```

12d. Trong `RefundLine` (dòng 339–341), trước:

```tsx
          <Link href="/cancellation-policy" className="underline-offset-4 hover:underline">
            {t.schedule}
          </Link>
```

sau:

```tsx
          <Link href="/cancellation-policy" className="underline-offset-4 hover:underline">
            {messages.cancellationDeadline.policyLink}
          </Link>
```

- [ ] **Step 13: Trang thanh toán thành công in ngày chót** — `apps/web/src/app/(site)/checkout/success/page.tsx`

13a. Dòng 11–13, trước:

```ts
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { checkoutMood } from '@/lib/checkout';
```

sau:

```ts
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { cancellationDeadlineText } from '@/lib/booking-vm';
import { checkoutMood } from '@/lib/checkout';
```

13b. Dòng 73, trước:

```ts
  const mood = checkoutMood(booking);
```

sau:

```ts
  const mood = checkoutMood(booking);
  // Thay lời hứa "cancel anytime" bằng ngày chót thật (spec §5.2) — cờ và ngày
  // do SERVER tính, trang chỉ in.
  const deadlineText = cancellationDeadlineText(booking.cancellation);
```

13c. Dòng 110–114, trước:

```tsx
              <ul className="mt-3 flex flex-col gap-2">
                <NextStep text={t.nextEmail} />
                <NextStep text={t.nextVoucher} />
                <NextStep text={t.nextManage} />
              </ul>
```

sau:

```tsx
              <ul className="mt-3 flex flex-col gap-2">
                <NextStep text={t.nextEmail} />
                <NextStep text={t.nextVoucher} />
                {deadlineText ? <NextStep text={deadlineText} /> : null}
                <NextStep text={t.nextManage} />
              </ul>
```

- [ ] **Step 14: Typecheck web và soát dấu vết luồng cũ**

```bash
pnpm --filter @tourism/web typecheck
grep -rn "requestCancellation\|viewCancellationPending\|resubmitCancellation\|toCancellationView\|RefundEstimateInput\|alreadyRequested\|booking\.detail\|refundEstimate" apps/web/src
grep -n "cancelNextReview\|refundEstimateGrace\|requestPending\|deniedNote" libs/shared/i18n/src/lib/messages.ts
```

Expected: typecheck exit 0. Grep thứ hai chỉ còn một dòng `apps/web/src/test/fixtures/booking.ts: refundEstimate: null,` (field contract còn sống tới Task 13). Grep thứ ba không in gì.

- [ ] **Step 15: Chạy lại toàn bộ test web**

Run: `pnpm --filter @tourism/web exec vitest run --maxWorkers=4`
Expected: PASS toàn bộ (hai project `node` và `dom`).

- [ ] **Step 16: Format, soát diff**

```bash
pnpm lint:fix
git status --short
git diff --stat
```

Expected: `git status` chỉ liệt kê 7 file ở mục **Files**; không có file `.md` nào đổi.

- [ ] **Step 17: Cổng đầy đủ** (Docker Postgres đang chạy)

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu lệnh exit 0.

- [ ] **Step 18: Commit**

```bash
git add libs/shared/i18n/src/lib/messages.ts \
  apps/web/src/lib/booking-vm.ts \
  apps/web/src/lib/booking-vm.spec.ts \
  apps/web/src/components/account/booking-actions.tsx \
  apps/web/src/components/account/booking-actions.spec.tsx \
  "apps/web/src/app/(site)/account/bookings/[code]/page.tsx" \
  "apps/web/src/app/(site)/checkout/success/page.tsx"
git commit -m "feat(web): khách tự huỷ booking ngay theo hạn chót" -m "Bỏ trạng thái xin huỷ, đang chờ, gửi lại và ước tính theo bậc. Hộp xác nhận hai dạng (trong hạn hoàn đủ, quá hạn không hoàn kèm link hỏi đáp), lý do không bắt buộc, xử lý REFUND_FAILED và NOT_CANCELLABLE. Pay now gặp DEPARTURE_NOT_AVAILABLE báo đã ngừng nhận đặt. Trang booking và trang thanh toán thành công in ngày chót do server tính."
```
---

### Task 8: Gỡ luồng duyệt huỷ và mở hoàn thiện chí cho booking CANCELLED

**Files:**

Mọi số dòng trong task này, kể cả chỗ ghi "trước Task 8", tính trên repo lúc soạn (trước Task 1). Task 2–7 làm lệch dòng ở `contract.ts`, `schemas/bookings.ts`, `schemas/bookings.spec.ts`, `cancellations.service.ts`, `cancellations.int.spec.ts` và `messages.ts`, nên các bước định vị theo nội dung.

Contract (`libs/shared/contract/src/`):
- Modify: `contract.ts`
  - các import từ `./schemas/bookings.js` (dòng 3–19) và `./schemas/stats.js` (dòng 90–101);
  - `admin.bookings.refund.errors` (dòng 652–685);
  - xoá `admin.cancellations` (dòng 688–750) và `admin.stats.cancellations` (dòng 814–821);
  - JSDoc của `admin.stats` (dòng 791–799).
- Modify: `schemas/bookings.ts` — `CancellationRequestSchema` (dòng 361–381) thêm `decidedByCustomer`; xoá từ `AdminCancellationRequestSchema` tới type `DecideCancellationResult` (dòng 385–474).
- Modify: `schemas/stats.ts` — xoá `AdminCancellationsStatsSchema` (dòng 177–187); sửa ba đoạn JSDoc (dòng 6–8, 118–121, 127–129).
- Modify: `schemas/reviews.ts` — comment dòng 252–254.
- Test: `contract.spec.ts`, `schemas/bookings.spec.ts`, `schemas/stats.spec.ts`.

i18n:
- Modify: `libs/shared/i18n/src/lib/messages.ts`
  - import dòng 3; hai hằng dòng 11–26 và comment dòng 28–29;
  - `admin.shell.cancellations`; `admin.stats.cancellations`;
  - `admin.bookings.detail.cancellations`;
  - `admin.bookings.refund.unavailable`, `openCancellation`, `errors`;
  - xoá khối `admin.cancellations`.
  - Số dòng tính trước Task 7; các bước dưới định vị theo nội dung.

API (`apps/api/src/modules/`):
- Delete: `bookings/admin-cancellations.controller.ts`
- Modify: `bookings/bookings.module.ts`, `bookings/admin-bookings.controller.ts`, `bookings/cancellations.service.ts`, `bookings/refunds.service.ts`, `stats/stats.service.ts`, `stats/admin-stats.controller.ts`, `outbox/admin-outbox.controller.ts` (comment dòng 15–16).
- Test: `bookings/cancellations.int.spec.ts`, `bookings/refunds.int.spec.ts`, `stats/stats.int.spec.ts`.

Admin (`apps/admin/src/`):
- Delete:
  - `app/(admin)/cancellations/page.tsx`, `app/(admin)/cancellations/[code]/page.tsx`, `app/(admin)/cancellations/actions.ts`;
  - `components/cancellations/approve-stepper-dialog.tsx`, `cancellations-table.tsx`, `cancellations-toolbar.tsx`, `decide-actions.tsx`, `decide-actions.spec.tsx`, `review-request-button.tsx`;
  - `components/kit/wizard-steps.tsx`, `components/kit/wizard-steps.spec.tsx`;
  - `lib/api/cancellations.ts`;
  - `lib/approve-refund.ts`, `lib/approve-refund.spec.ts`;
  - `lib/cancellations-decide.ts`, `lib/cancellations-decide.spec.ts`;
  - `lib/cancellations-query.ts`, `lib/cancellations-query.spec.ts`;
  - `lib/cancellations-view.ts`, `lib/cancellations-view.spec.ts`.
- Create: `lib/cancellation-history.ts`, `lib/cancellation-history.spec.ts`.
- Modify:
  - `lib/refund.ts` (dòng 23–34), `lib/refund.spec.ts`;
  - `components/bookings/refund-panel.tsx` (dòng 58–108), `components/bookings/refund-panel.spec.tsx`;
  - `components/bookings/booking-detail-sections.tsx`, `app/(admin)/bookings/[code]/page.tsx`;
  - `lib/nav.ts`, `components/site-header.tsx`, `lib/api/stats.ts`;
  - `lib/stats-view.ts` (dòng 1–14, 347–385), `lib/stats-view.spec.ts`.
- Modify (chỉ comment nhắc tên đã xoá): `lib/table-query.ts`, `components/kit/table-search-form.tsx`, `lib/outbox-retry.ts`, `lib/reviews-moderate.ts`, `lib/reviews-query.ts`, `app/(admin)/reviews/actions.ts`, `app/(admin)/outbox/actions.ts`.

**Interfaces:**
- Consumes:
  - Hợp đồng A: `cancellationDeadline`, `isWithinDeadline`, `vietnamToday`, `toCents`, `fromCents`.
  - Hợp đồng B: `CancelBookingResultSchema`; `CancellationRequestSchema.reason` nullable (Task 2); route `bookings.cancel` huỷ ngay (Task 6).
  - Hợp đồng C: `CancellationsService.cancelByCustomer` ghi yêu cầu REFUNDED với `decided_by` = khách, dòng hoàn trong cùng CTE.
- Produces:
  - Hợp đồng E: `canRefund(status: BookingStatusValue, remaining: string): boolean`.
  - `CancellationRequestSchema.decidedByCustomer: z.boolean()` (mới).
  - `apps/admin/src/lib/cancellation-history.ts`:
    - `cancellationStatusBadgeVariant(status: CancellationRequestStatusValue): CancellationBadgeVariant`;
    - `refundedForRequest(request: Pick<CancellationRequest, 'createdAt' | 'decidedAt'>, refunds: readonly Pick<Refund, 'amount' | 'createdAt'>[]): string`;
    - `toCancellationHistoryRow(request: CancellationHistoryRequest, booking: CancellationHistoryBooking): CancellationHistoryRowVM`;
    - các type `CancellationBadgeVariant`, `CancellationHistoryRequest`, `CancellationHistoryBooking`, `CancellationHistoryRowVM`.
  - `CancellationHistoryCard({ booking }: { booking: AdminBookingDetail })` — chữ ký đổi. `RefundTarget` bỏ `hasOpenCancellation`.
  - Khoá i18n:
    - thêm `admin.bookings.detail.cancellations.{noReason, byCustomer, byStaff, withinDeadline, afterDeadline, refunded, notRefunded}`;
    - sửa `admin.bookings.detail.cancellations.{empty, status}`, `admin.bookings.refund.unavailable`, `admin.bookings.refund.errors.NOT_REFUNDABLE`;
    - xoá cả khối `admin.cancellations`, cùng `admin.stats.cancellations`, `admin.shell.cancellations`, `admin.bookings.refund.openCancellation`, `admin.bookings.refund.errors.CANCELLATION_OPEN`.
  - Cho Task 9: `decisionsSlice` ở `apps/api/src/modules/stats/stats-aggregates.ts` còn nguyên, chỉ `reports.service.ts` dùng.
  - Cho Task 13: admin và `cancellations.service.ts` không còn gọi `refundPercentForRequest` hay `policyRefundAmount`.

- [ ] **Step 1: Viết test đỏ ở contract**

Trong `libs/shared/contract/src/contract.spec.ts`, thêm import ngay dưới dòng `import { contract } from './contract.js';`:

```ts
import * as contractIndex from './index.js';
```

Thêm hai ca vào cuối `describe('contract routes', …)`, ngay sau ca `admin.stats procedures declare no business errors`:

```ts
  // ADR-0041 §4 (Task 8): khách tự huỷ ngay nên luồng duyệt huỷ không còn chỗ
  // đứng — không route, không thẻ thống kê hàng đợi, không mã chặn hoàn tiền.
  it('không còn luồng duyệt huỷ: admin.cancellations, admin.stats.cancellations, CANCELLATION_OPEN', () => {
    expect('cancellations' in contract.admin).toBe(false);
    expect('cancellations' in contract.admin.stats).toBe(false);
    expect(Object.keys(contract.admin.bookings.refund['~orpc'].errorMap).sort()).toEqual([
      'NOTHING_LEFT',
      'NOT_FOUND',
      'NOT_REFUNDABLE',
      'OVER_TOTAL',
      'REFUND_FAILED',
      'ZERO_OR_NEGATIVE',
    ]);
  });

  it('các schema chỉ luồng duyệt dùng đã rời barrel của contract', () => {
    for (const name of [
      'AdminCancellationRequestSchema',
      'AdminCancellationsListQuerySchema',
      'DecideCancellationInputSchema',
      'DecideCancellationResultSchema',
      'AdminCancellationsStatsSchema',
    ]) {
      expect(name in contractIndex).toBe(false);
    }
  });
```

Trong `libs/shared/contract/src/schemas/bookings.spec.ts`, thêm `CancellationRequestSchema,` vào khối import từ `'./bookings.js'`, rồi thêm vào CUỐI file:

```ts
describe('CancellationRequestSchema — ai quyết (ADR-0041 §4)', () => {
  /** Dòng yêu cầu của một lần khách tự huỷ: gửi và quyết cùng một mốc, không lý do. */
  const selfCancel = {
    id: '4f2a1b3c-0000-4000-8000-000000000002',
    bookingCode: 'BK-ABCDEFGH',
    reason: null,
    status: 'REFUNDED',
    freeCancellationDays: null,
    decisionNote: null,
    decidedAt: '2026-10-12T02:30:00.000Z',
    createdAt: '2026-10-12T02:30:00.000Z',
  };

  it('decidedByCustomer là BẮT BUỘC — admin in "ai huỷ" từ cờ này', () => {
    expect(CancellationRequestSchema.safeParse(selfCancel).success).toBe(false);
    expect(
      CancellationRequestSchema.parse({ ...selfCancel, decidedByCustomer: true }).decidedByCustomer,
    ).toBe(true);
    expect(
      CancellationRequestSchema.safeParse({ ...selfCancel, decidedByCustomer: 'customer' }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test contract, xác nhận đỏ**

Run: `pnpm --filter @tourism/contract exec vitest run src/contract.spec.ts src/schemas/bookings.spec.ts`

Expected: FAIL đúng ba ca:
- `không còn luồng duyệt huỷ…`: `'cancellations' in contract.admin` đang là `true`.
- `các schema chỉ luồng duyệt dùng…`: `AdminCancellationRequestSchema` còn trong barrel.
- `decidedByCustomer là BẮT BUỘC…`: `safeParse` thiếu cờ vẫn trả `success: true`.

- [ ] **Step 3: Gỡ luồng duyệt khỏi `contract.ts`**

Sửa `libs/shared/contract/src/contract.ts`:

(a) Trong khối `import { … } from './schemas/bookings.js';`, xoá đúng bốn dòng:

```ts
  AdminCancellationRequestSchema,
  AdminCancellationsListQuerySchema,
  DecideCancellationInputSchema,
  DecideCancellationResultSchema,
```

Tiếp theo chạy `grep -c "CancellationRequestSchema" libs/shared/contract/src/contract.ts`. Nếu kết quả là `1` (chỉ còn dòng import, vì Task 6 đã đổi output `bookings.cancel`), xoá luôn dòng `  CancellationRequestSchema,` trong khối import đó.

(b) Trong khối `import { … } from './schemas/stats.js';`, xoá dòng `  AdminCancellationsStatsSchema,`.

(c) Trong `admin.bookings.refund.errors`, thay:

```ts
          NOT_REFUNDABLE: {
            status: 422,
            message:
              'Only a PAID or PARTIALLY_REFUNDED booking with a captured payment is refundable',
          },
```

bằng:

```ts
          // CANCELLED nằm trong tập hoàn được (ADR-0029 §3, ADR-0041 §5): khách
          // huỷ quá hạn giữ nguyên tiền, ngoại lệ đi qua đúng lệnh này.
          NOT_REFUNDABLE: {
            status: 422,
            message:
              'Only a PAID, PARTIALLY_REFUNDED or CANCELLED booking with a captured payment is refundable',
          },
```

rồi xoá trọn khối:

```ts
          // ADR-0029 §AMEND 4 (vòng vá review 05/09): có yêu cầu huỷ ĐANG MỞ
          // thì tiền phải đi qua quyết định của nó — W3 hoàn đủ rồi Deny là
          // ghế rò vĩnh viễn. Trước đây chỉ UI ẩn nút; server nay chặn.
          CANCELLATION_OPEN: {
            status: 422,
            message:
              'A cancellation request is open on this booking — decide it instead of refunding directly',
          },
```

(d) Xoá trọn nhóm `admin.cancellations`:
- Bắt đầu từ dòng `    /**` mở JSDoc `Hàng đợi cancellation (spec P2 W4, D1-B). \`decide\` là một endpoint cho`.
- Kết thúc ở dòng `    },` đóng nhóm, ngay sau `        .output(DecideCancellationResultSchema),`.
- Tức dòng 688–750 trước Task 8. Nhóm `reviews: {` với JSDoc `Hàng đợi moderation review` giờ đứng ngay sau `bookings`.

(e) Trong `admin.stats`, xoá trọn:

```ts
      cancellations: oc
        .route({
          method: 'GET',
          path: '/api/admin/stats/cancellations',
          summary: 'Cancellation queue + decisions for a date range, against an equally long one',
        })
        .input(AdminStatsRangeQuerySchema)
        .output(AdminCancellationsStatsSchema),
```

(f) Trong JSDoc ngay trên `stats: {`, thay:

```ts
     * tham số thì rơi về cửa sổ trượt 28 ngày như cũ. Hiện là `bookings`,
     * `cancellations` và `reviews`, cùng dùng `AdminStatsRangeQuerySchema` chứ
     * không mỗi vùng một bản. Bốn endpoint vùng còn lại KHÔNG có input: trang
```

bằng:

```ts
     * tham số thì rơi về cửa sổ trượt 28 ngày như cũ. Hiện là `bookings` và
     * `reviews`, cùng dùng `AdminStatsRangeQuerySchema` chứ không mỗi vùng một
     * bản. Bốn endpoint vùng còn lại KHÔNG có input: trang
```

(g) Trong `libs/shared/contract/src/contract.spec.ts`, xoá dòng pin route:

```ts
    [contract.admin.stats.cancellations, 'GET /api/admin/stats/cancellations'],
```

- [ ] **Step 4: Gỡ schema chỉ luồng duyệt dùng, thêm `decidedByCustomer`**

Sửa `libs/shared/contract/src/schemas/bookings.ts`:

(a) Thay JSDoc ngay trên `export const CancellationRequestSchema = z.object({` bằng:

```ts
/**
 * Một dòng `cancellation_requests` (lịch sử append-only D1-B). Từ ADR-0041 mỗi
 * lần khách tự huỷ ghi đúng MỘT dòng REFUNDED, gửi và quyết cùng lúc; REQUESTED
 * và DENIED chỉ còn ở dữ liệu của luồng duyệt cũ, hiện dạng chỉ đọc.
 */
```

(b) Trong `CancellationRequestSchema`, thay:

```ts
  decidedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type CancellationRequest = z.output<typeof CancellationRequestSchema>;
```

bằng:

```ts
  decidedAt: z.iso.datetime().nullable(),
  /**
   * `true` khi người quyết CHÍNH LÀ khách đã gửi yêu cầu (`decided_by = user_id`),
   * tức khách tự huỷ (ADR-0041 §4). `false` khi chưa quyết, hoặc do nhân viên
   * quyết (dữ liệu luồng duyệt cũ). Admin in "ai huỷ" từ cờ này, nhờ vậy
   * contract không phải phơi id người dùng nào.
   */
  decidedByCustomer: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type CancellationRequest = z.output<typeof CancellationRequestSchema>;
```

(c) Xoá trọn đoạn:
- Bắt đầu từ JSDoc `/**` có dòng ` * Row cho queue admin: request kèm đủ context booking để quyết mà không cần`.
- Kết thúc ở dòng `export type DecideCancellationResult = z.output<typeof DecideCancellationResultSchema>;` cùng dòng trống ngay sau nó.
- Phạm vi gồm `AdminCancellationRequestSchema`, `AdminCancellationsListQuerySchema`, `DecideCancellationInputSchema`, `DecideCancellationResultSchema` và bốn type đi kèm.
- JSDoc `Output của \`admin.bookings.byCode\`` và `AdminBookingDetailSchema` giữ nguyên.

Sửa `libs/shared/contract/src/schemas/bookings.spec.ts`:

(a) Trong khối import, xoá `  AdminCancellationsListQuerySchema,` và `  DecideCancellationInputSchema,`.

(b) Trong ca `it('W1: free-text trim ở CONTRACT — reason/decisionNote/refund reason, một luật một chỗ'`, đổi tiêu đề thành `'W1: free-text trim ở CONTRACT — reason/refund reason, một luật một chỗ'` và xoá trọn đoạn:

```ts
    const decideId = '4f2a1b3c-0000-4000-8000-000000000001';
    expect(
      DecideCancellationInputSchema.safeParse({
        id: decideId,
        approve: false,
        decisionNote: '   ',
      }).success,
    ).toBe(false);
    expect(
      DecideCancellationInputSchema.parse({
        id: decideId,
        approve: false,
        decisionNote: '  too late  ',
      }).decisionNote,
    ).toBe('too late');

```

(c) Xoá trọn `describe('AdminCancellationsListQuerySchema — bộ lọc ngày (ADR-0028 §AMEND)', () => { … });` (dòng 529–566 trước Task 8).

Sửa `libs/shared/contract/src/schemas/stats.ts`:

(a) Xoá trọn:

```ts
/** Bộ số vùng `/cancellations`. */
export const AdminCancellationsStatsSchema = z.object({
  period: StatsPeriodSchema,
  /** Ảnh chụp hàng đợi đang mở: BÂY GIỜ so với ĐẦU kỳ này (không phải đếm trong kỳ). */
  pendingQueue: CountMetricSchema,
  /** Request được duyệt (hoàn tiền) trong kỳ. */
  approved: CountMetricSchema,
  /** Request bị từ chối trong kỳ. */
  denied: CountMetricSchema,
});
export type AdminCancellationsStats = z.output<typeof AdminCancellationsStatsSchema>;

```

(b) Thay ` * bảng của \`/bookings\`, \`/cancellations\`, \`/reviews\`. P4d nối dashboard vào` bằng ` * bảng của \`/bookings\`, \`/reviews\`. P4d nối dashboard vào`.

(c) Thay:

```ts
 * hai bản khai lại là hai luật khoan dung sẽ trôi lệch trong im lặng. Hiện có
 * ba consumer — `admin.stats.bookings`, `admin.stats.cancellations` và
 * `admin.stats.reviews` (ADR-0028 AMEND 2).
```

bằng:

```ts
 * hai bản khai lại là hai luật khoan dung sẽ trôi lệch trong im lặng. Hiện có
 * hai consumer — `admin.stats.bookings` và `admin.stats.reviews` (ADR-0028
 * AMEND 2).
```

(d) Thay:

```ts
 * `/bookings` gửi rỗng khi admin chọn `?dates=all`, còn `/cancellations` thì
 * rỗng CHÍNH LÀ mặc định của vùng. Lúc đó service rơi về cửa sổ TRƯỢT 28 ngày
```

bằng:

```ts
 * `/bookings` gửi rỗng khi admin chọn `?dates=all`, còn `/reviews` thì rỗng
 * CHÍNH LÀ mặc định của vùng. Lúc đó service rơi về cửa sổ TRƯỢT 28 ngày
```

Sửa `libs/shared/contract/src/schemas/stats.spec.ts`:
- Xoá dòng import `  AdminCancellationsStatsSchema,`.
- Xoá trọn ca test sau:

```ts
  it('cancellations carries the live queue plus decisions of the window', () => {
    const parsed = AdminCancellationsStatsSchema.parse({
      period,
      pendingQueue: { current: 3, previous: 5 },
      approved: { current: 4, previous: 2 },
      denied: { current: 1, previous: 0 },
    });
    expect(parsed.pendingQueue).toEqual({ current: 3, previous: 5 });
  });

```

Sửa comment trong `libs/shared/contract/src/schemas/reviews.ts` — thay ` * \`AdminRefundInput\`/\`DecideCancellationInput\` của bookings.ts). */` bằng ` * \`AdminRefundInput\` của bookings.ts). */`.

- [ ] **Step 5: Chạy test contract, xác nhận xanh, rồi build**

Run: `pnpm --filter @tourism/contract exec vitest run`
Expected: PASS toàn bộ suite contract.

Run: `pnpm --filter @tourism/contract build && pnpm --filter @tourism/i18n build`
Expected: cả hai build xong, không lỗi. `messages.ts` chưa đọc tên nào vừa xoá.

- [ ] **Step 6: API — xoá controller duyệt huỷ và thẻ thống kê hàng đợi**

Run: `git rm apps/api/src/modules/bookings/admin-cancellations.controller.ts`

Sửa `apps/api/src/modules/bookings/bookings.module.ts`:
- Xoá dòng `import { AdminCancellationsController } from './admin-cancellations.controller.js';`.
- Thay `  controllers: [BookingsController, AdminBookingsController, AdminCancellationsController],` bằng `  controllers: [BookingsController, AdminBookingsController],`.

Sửa `apps/api/src/modules/stats/admin-stats.controller.ts`:

(a) Thay:

```ts
 * Tám handler mỏng đúng nghĩa: không lỗi nghiệp vụ để dịch (contract không
 * khai mã nào — đọc thuần thì không có phán quyết nào để báo). Ba vùng có bộ
 * lọc ngày (`bookings`, `cancellations`, `reviews`) thì có input, và cũng chỉ
 * chuyển tiếp (ADR-0028 + AMEND 1, 2); `dashboard` nhận `?days=` (ADR-0036).
```

bằng:

```ts
 * Bảy handler mỏng đúng nghĩa: không lỗi nghiệp vụ để dịch (contract không
 * khai mã nào — đọc thuần thì không có phán quyết nào để báo). Hai vùng có bộ
 * lọc ngày (`bookings`, `reviews`) thì có input, và cũng chỉ chuyển tiếp
 * (ADR-0028 + AMEND 2); `dashboard` nhận `?days=` (ADR-0036).
```

(b) Xoá trọn:

```ts
  @Implement(contract.admin.stats.cancellations)
  cancellations() {
    return implement(contract.admin.stats.cancellations).handler(({ input }) =>
      this.stats.adminCancellations(input),
    );
  }

```

Sửa `apps/api/src/modules/stats/stats.service.ts`:

(a) Trong import từ `'@tourism/contract'`, xoá `  type AdminCancellationsStats,`. Trong import từ `'./stats-aggregates.js'`, xoá `  decisionsSlice,`.

(b) Thay:

```ts
 * **`bookings` và `cancellations` có cửa sổ do ADMIN chọn** (ADR-0028 và
 * §AMEND của nó): hai method ấy nhận `{from, to}` — đúng hai ô ngày của bảng
 * cùng vùng — và cắt bằng `statsWindowFromRange`. Kỳ trước vẫn dài BẰNG kỳ
 * này, chỉ lùi liền kề, nên bất biến trên không bị nới. Thiếu tham số thì rơi
 * về đúng cửa sổ mặc định. Năm bộ số còn lại KHÔNG nhận tham số: trang của
 * chúng chưa có bộ lọc ngày.
```

bằng:

```ts
 * **`bookings` và `reviews` có cửa sổ do ADMIN chọn** (ADR-0028 và các AMEND
 * của nó): hai method ấy nhận `{from, to}` — đúng hai ô ngày của bảng cùng
 * vùng — và cắt bằng `statsWindowFromRange`. Kỳ trước vẫn dài BẰNG kỳ này, chỉ
 * lùi liền kề, nên bất biến trên không bị nới. Thiếu tham số thì rơi về đúng
 * cửa sổ mặc định. Bốn bộ số vùng còn lại KHÔNG nhận tham số: trang của chúng
 * chưa có bộ lọc ngày.
```

(c) Trong JSDoc của lớp:
- Xoá trọn đoạn từ dòng ` * **cancellations** (cửa sổ do admin chọn được — ADR-0028 §AMEND)` tới hết dòng ` *   bookings, nhưng nhỏ hơn nhiều vì vòng đời một request rất ngắn.`, cùng dòng ` *` trống ngay sau.
- Thay:

```ts
 *   `previous` = trạng thái duyệt suy ngược về mốc đầu kỳ. ⚠️ Khác
 *   cancellations, `moderated_at` KHÔNG phải dấu "đã có quyết định" — review
```

bằng:

```ts
 *   `previous` = trạng thái duyệt suy ngược về mốc đầu kỳ. ⚠️
 *   `moderated_at` KHÔNG phải dấu "đã có quyết định" — review
```

(d) Xoá trọn method:

```ts
  /**
   * Bộ số vùng `/cancellations`, tính trên khoảng ngày admin đang lọc
   * (ADR-0028 §AMEND).
   *
   * `pendingQueue` là metric ẢNH CHỤP nên không "đếm trong kỳ" được như ba
   * card của `/bookings`; nó lấy ảnh chụp ở HAI ĐẦU kỳ — cuối kỳ so với đầu
   * kỳ — nên card đọc thành "hàng đợi đã dịch chuyển thế nào trong kỳ bạn
   * đang xem". Với cửa sổ TRƯỢT thì `currentTo === generatedAt === now`, tức
   * hành vi trước ADR không đổi một con số nào.
   */
  async adminCancellations(query?: AdminStatsRangeQuery): Promise<AdminCancellationsStats> {
    const window = statsWindowFromRange(query?.from, query?.to, new Date());
    const [pendingEnd, pendingStart, current, previous] = await Promise.all([
      this.pendingRequestsAt(window.currentTo),
      this.pendingRequestsAt(window.currentFrom),
      decisionsSlice(window.currentFrom, window.currentTo),
      decisionsSlice(window.previousFrom, window.currentFrom),
    ]);

    return {
      period: statsPeriod(window),
      pendingQueue: { current: pendingEnd, previous: pendingStart },
      approved: { current: current.approved, previous: previous.approved },
      denied: { current: current.denied, previous: previous.denied },
    };
  }

```

(e) Xoá trọn method:

```ts
  /**
   * Hàng đợi cancellation ĐANG MỞ tại mốc `at` — dựng lại từ dấu vết thời
   * gian: đã mở trước mốc đó, và tới mốc đó chưa ai quyết. `decidedAt: null`
   * là các request còn sống; `decidedAt >= at` là các request bấy giờ còn mở
   * nhưng đã được quyết sau đó.
   */
  private pendingRequestsAt(at: Date): Promise<number> {
    return prisma.cancellationRequest.count({
      where: {
        createdAt: { lt: at },
        OR: [{ decidedAt: null }, { decidedAt: { gte: at } }],
      },
    });
  }

```

(f) Trong JSDoc của `pendingReviewsAt`, thay:

```ts
   * Hàng đợi moderation tại mốc `at`. KHÔNG dựng lại được bằng riêng dấu thời
   * gian như cancellations: ở đó `decided_at` được ghi ĐÚNG KHI có quyết
   * định, còn `moderated_at` null chỉ nghĩa là "chưa ai bấm nút" — mà một
```

bằng:

```ts
   * Hàng đợi moderation tại mốc `at`. KHÔNG dựng lại được bằng riêng dấu thời
   * gian: `moderated_at` null chỉ nghĩa là "chưa ai bấm nút" — mà một
```

- [ ] **Step 7: `refundByAdmin` bỏ phép chặn theo yêu cầu huỷ đang mở**

Sửa `apps/api/src/modules/bookings/refunds.service.ts`:

(a) Thay:

```ts
import {
  BookingStatus,
  CancellationRequestStatus,
  EmailType,
  type PaymentProvider,
} from '../../generated/prisma/enums.js';
```

bằng:

```ts
import { BookingStatus, EmailType, type PaymentProvider } from '../../generated/prisma/enums.js';
```

(b) Trong JSDoc của `BookingNotRefundableError`, thay ` * Refund gate fail: status nằm ngoài PAID/PARTIALLY_REFUNDED, hoặc không có` bằng ` * Refund gate fail: status nằm ngoài PAID/PARTIALLY_REFUNDED/CANCELLED, hoặc không có`.

Trong constructor, thay chuỗi `` `Booking is ${status}; only a PAID or PARTIALLY_REFUNDED booking can be refunded` `` bằng `` `Booking is ${status}; only a PAID, PARTIALLY_REFUNDED or CANCELLED booking can be refunded` ``.

(c) Xoá trọn:

```ts
/**
 * Booking đang có yêu cầu huỷ MỞ (ADR-0029 §AMEND 4): tiền phải đi qua quyết
 * định của yêu cầu ấy. W3 hoàn đủ rồi admin Deny là ghế rò vĩnh viễn — deny
 * không đụng booking, và ADR đã loại phương án "để Deny nhả ghế".
 */
export class CancellationOpenError extends Error {
  constructor() {
    super(
      'A cancellation request is open on this booking; decide it instead of refunding directly',
    );
  }
}

```

(d) Trong JSDoc của `refundByAdmin`, thay:

```ts
   * Khác với Nexora, một FULL admin refund ở đây KHÔNG release seat hay set
   * cancelledAt: seat release thuộc về cancellation flow (W4 approve →
   * refund); một goodwill refund của admin trên booking vẫn đang du lịch không
   * được giải phóng seat của nó.
```

bằng:

```ts
   * Khác với Nexora, một FULL admin refund ở đây KHÔNG release seat hay set
   * cancelledAt: seat release thuộc về lõi huỷ của `CancellationsService`
   * (ADR-0041 §4); một goodwill refund của admin trên booking vẫn đang du lịch
   * không được giải phóng seat của nó.
```

(e) Thay:

```ts
      // `CANCELLED` NẰM TRONG danh sách hoàn được (ADR-0029 §3): approve với
      // mức hoàn một phần để lại một booking đã huỷ mà sổ còn dư, và phần dư
      // ấy vẫn là tiền mình đang nợ khách. Trước ADR-0029 trạng thái đó là ngõ
      // cụt — 422, không đường nào hoàn nốt ngoài dashboard provider.
```

bằng:

```ts
      // `CANCELLED` NẰM TRONG danh sách hoàn được (ADR-0029 §3, ADR-0041 §5):
      // khách huỷ quá hạn để lại một booking đã huỷ mà sổ còn nguyên tiền, và
      // ngoại lệ (ốm đau, việc gấp) đi qua chính lệnh hoàn thiện chí này.
```

(f) Xoá trọn:

```ts
      // Trong CÙNG advisory lock với `approve` — nên "đang mở" đọc ở đây là
      // tươi: một approve chen giữa phải chờ lock này nhả. Trước vòng vá review
      // 05/09 lưới duy nhất là UI ẩn nút `Issue refund` (refund-panel.tsx).
      const openRequests = await tx.cancellationRequest.count({
        where: { bookingId: booking.id, status: CancellationRequestStatus.REQUESTED },
      });
      if (openRequests > 0) throw new CancellationOpenError();

```

Sửa `apps/api/src/modules/bookings/admin-bookings.controller.ts`:
- Trong khối import từ `'./refunds.service.js'`, xoá `  CancellationOpenError,`.
- Xoá trọn:

```ts
        if (error instanceof CancellationOpenError) {
          throw errors.CANCELLATION_OPEN({ message: error.message });
        }
```

Sửa comment `apps/api/src/modules/outbox/admin-outbox.controller.ts` — thay ` * AdminCancellationsController: \`@Roles(ADMIN)\` ở cấp class được AuthGuard` bằng ` * AdminBookingsController: \`@Roles(ADMIN)\` ở cấp class được AuthGuard`.

- [ ] **Step 8: `CancellationsService` bỏ mọi thứ chỉ luồng duyệt dùng**

Trong `apps/api/src/modules/bookings/cancellations.service.ts`, xoá trọn các khối sau (định vị theo tên; mỗi khối gồm cả JSDoc ngay trên nó).

Lớp lỗi và kiểu dữ liệu:
- `export class CancellationRequestNotFoundError`.
- JSDoc lạc `/** Request đã DENIED/REFUNDED — decision là chung cuộc (409). D1-B: history\n * row không bao giờ được tái dùng; khách re-request thay vào đó. */` (đứng ngay trên JSDoc của `OffPolicyNoteRequiredError`).
- `export class OffPolicyNoteRequiredError`.
- `export class CancellationAlreadyDecidedError`.
- `const BOOKING_CONTEXT = { … } as const;` và `type BookingContext = { … };`.
- `function toAdminCancellationRequest(…)`.

Method của lớp:
- `async myRequests(…)`, `async adminList(…)`, `async decide(…)`;
- `private async deny(…)`, `private async approve(…)`, `private async decisionResult(…)`.

Chạy `grep -rn "CancellationAlreadyRequestedError\|isOneLiveRequestViolation" apps/api/src`. Nếu mọi dòng trúng đều nằm trong `cancellations.service.ts` (định nghĩa lớp và định nghĩa hàm), xoá luôn `export class CancellationAlreadyRequestedError` và `function isOneLiveRequestViolation` cùng JSDoc của chúng.

Chạy `grep -n "admin deny\|approve\|decide" apps/api/src/modules/bookings/cancellations.service.ts`. Nếu JSDoc của `export class CancellationsService` còn tả luồng "admin deny hoặc approve", thay trọn JSDoc đó bằng:

```ts
/**
 * Huỷ booking (ADR-0041 §4): khách tự huỷ qua lõi huỷ dùng chung, chạy trong
 * advisory lock của booking — gọi cổng thanh toán trước, một CTE ghi sau. Mỗi
 * lần huỷ để lại đúng MỘT dòng `cancellation_requests` REFUNDED (append-only,
 * D1-B). Luồng khách gửi yêu cầu, admin duyệt đã bỏ theo ADR-0041.
 *
 * Semantics của terminal-state nằm ở docs/conventions/booking-states.md:
 * Refund ledger ghi câu chuyện MONEY, Booking.status ghi câu chuyện
 * SEAT/TRAVEL — huỷ set CANCELLED tường minh (khách ngừng du lịch, ghế được trả
 * lại), KHÔNG phải REFUNDED suy từ ledger.
 */
```

Dọn import không còn dùng. Từ gốc repo, trong Git Bash:

```bash
f=apps/api/src/modules/bookings/cancellations.service.ts
for name in AdminCancellationRequest AdminCancellationsListQuery DecideCancellationResult Paged \
  policyRefundAmount refundPercentForRequest calendarDate createdAtRange toPaged \
  CancellationRequestStatus BookingStatus bookingTourInclude resolveTourCover toBooking \
  withBookingRefundLock classifyRefundAmount RefundNothingLeftError BookingNotFoundError \
  BookingNotRefundableError RefundsService MediaService Logger; do
  printf '%s %s\n' "$(grep -cw "$name" "$f")" "$name"
done
```

Tên nào in số `1` chỉ còn xuất hiện ở dòng import. Xoá tên đó khỏi khối import của nó, và xoá cả câu import nếu khối rỗng. Chạy lại vòng lặp tới khi không còn tên nào in `1`.

- [ ] **Step 9: Bỏ các int test của luồng duyệt**

`apps/api/src/modules/bookings/cancellations.int.spec.ts` (bản sau Task 6):

1. Run: `grep -n "postDecide\|/api/admin/cancellations\|AdminCancellationRequestSchema\|DecideCancellationResultSchema\|myRequests\|CANCELLATION_OPEN" apps/api/src/modules/bookings/cancellations.int.spec.ts`
2. Với mỗi dòng trúng, xoá trọn `it(…)` hoặc `describe(…)` bao nó. Ngoại lệ: nếu một `it` chỉ có một khối nhỏ gọi `GET /api/admin/cancellations` để kiểm "không 500" (như ca `W1: reason toàn khoảng trắng` ở bản trước Task 6), chỉ xoá khối gọi đó và giữ phần assert còn lại.
3. Xoá helper `function postDecide(…)`.

Ở bản trước Task 6, tập bị xoá gồm các ca:
- `deny → DENIED + audit fields + outbox; …`, `re-request after deny → NEW row; …`, `approve → gateway refund + Refund row + …`;
- `decide on an already-decided request → 409 ALREADY_DECIDED; unknown id → 404`;
- `non-admin decide/list → 403; anonymous → 401`;
- cả `describe('ADR-0029 — approve với mức hoàn theo chính sách', …)`;
- `BK-R1 cross-path: admin refund ‖ cancel-approve ĐỒNG THỜI …`;
- `admin.cancellations.list: booking context + status filter; myRequests returns own history`;
- `admin.cancellations.list: lọc theo khoảng ngày tạo, hàng đang mở KHÔNG bị loại`.

Task 6 có thể đã bỏ bớt một số ca này; lệnh grep ở trên là chuẩn.

Dọn import và helper không còn dùng:

```bash
f=apps/api/src/modules/bookings/cancellations.int.spec.ts
for name in AdminCancellationRequestSchema DecideCancellationResultSchema PagedSchema \
  CancellationsService CancellationRequestSchema CancellationRequestStatus \
  AdminBookingDetailSchema EmailType BookingStatus postRefund seatsBooked signUpAdmin; do
  printf '%s %s\n' "$(grep -cw "$name" "$f")" "$name"
done
```

Tên in `1` chỉ còn ở dòng import hoặc dòng khai helper — xoá (helper thì xoá cả thân hàm). Chạy lại tới khi không còn `1`.

Sửa `apps/api/src/modules/stats/stats.int.spec.ts`:

(a) Trong import từ `'@tourism/contract'`, xoá `  AdminCancellationsStatsSchema,`. Trong import từ `'../../generated/prisma/enums.js'`, xoá `  CancellationRequestStatus,`.

(b) Xoá trọn helper:

```ts
  function cancellation(
    n: number,
    row: {
      bookingId: string;
      status: CancellationRequestStatus;
      createdAt: Date;
      decidedAt: Date | null;
    },
  ): Prisma.CancellationRequestCreateManyInput {
    return {
      id: `e9500003-0000-4000-8000-${String(n).padStart(12, '0')}`,
      bookingId: row.bookingId,
      userId: customerId,
      reason: 'Family emergency — cannot travel.',
      status: row.status,
      createdAt: row.createdAt,
      decidedAt: row.decidedAt,
    };
  }

```

(c) Thay:

```ts
  describe('guard — cùng lớp với mọi endpoint admin còn lại, phủ CẢ TÁM path', () => {
    // Tham số hoá cả sáu (vòng vá review F5): guard đặt ở cấp class, nhưng
    // một refactor dời @Roles xuống từng handler mà sót 2/3 phải làm suite đỏ.
    for (const area of [
      'bookings',
      'cancellations',
      'reviews',
```

bằng:

```ts
  describe('guard — cùng lớp với mọi endpoint admin còn lại, phủ CẢ BẢY path', () => {
    // Tham số hoá mọi path (vòng vá review F5): guard đặt ở cấp class, nhưng
    // một refactor dời @Roles xuống từng handler mà sót một cái phải làm suite đỏ.
    for (const area of [
      'bookings',
      'reviews',
```

(d) Xoá trọn `describe('stats.cancellations', () => { … });`, JSDoc `/** ADR-0028 §AMEND — kỳ do admin chọn. \`pendingQueue\` là metric ẢNH CHỤP …*/` ngay sau nó, và `describe('stats.cancellations — khoảng ngày do admin chọn', () => { … });` (dòng 680–886 trước Task 8). `describe('stats.reviews', …)` giờ đứng ngay sau `describe('stats.dashboard — kỳ rỗng', …)`.

- [ ] **Step 10: Viết int test đỏ — hoàn thiện chí trên booking CANCELLED, khoá chéo với khách tự huỷ**

Sửa `apps/api/src/modules/bookings/refunds.int.spec.ts`:

(a) Thay:

```ts
import {
  AdminBookingDetailSchema,
  AdminRefundResultSchema,
  BookingSchema,
  PagedSchema,
} from '@tourism/contract';
```

bằng:

```ts
import {
  AdminBookingDetailSchema,
  AdminRefundResultSchema,
  BookingSchema,
  CancelBookingResultSchema,
  PagedSchema,
  vietnamToday,
} from '@tourism/contract';
```

(b) Thêm ngay sau hàm `postRefund(…)`:

```ts
  /** Khách tự huỷ qua route thật (ADR-0041 §4) — lý do để trống như đa số khách. */
  function postCancel(cookie: string, code: string) {
    return app.inject({
      method: 'POST',
      url: `/api/bookings/${code}/cancel`,
      headers: { cookie },
      payload: {},
    });
  }

  async function seatsBooked(): Promise<number> {
    const row = await prisma.tourDeparture.findUniqueOrThrow({
      where: { id: dep.id },
      select: { seatsBooked: true },
    });
    return row.seatsBooked;
  }

  /**
   * Dời chuyến `dep` (và snapshot ngày trên booking) về khởi hành sau hôm nay 2
   * ngày theo giờ Việt Nam, chuyến 2 ngày: N = 3 nên ngày chót là hôm qua, còn
   * ngày khởi hành chưa tới — đúng ca "huỷ quá hạn, không hoàn". Dời SAU khi
   * trả tiền vì `bookings.create` chặn đặt chỗ quá hạn (Task 4). Cách 2 ngày
   * chứ không 1: test chạy vắt qua nửa đêm giờ Việt Nam vẫn còn trước ngày đi.
   */
  async function moveDeparturePastDeadline(bookingId: string) {
    const start = new Date(
      Date.parse(`${vietnamToday(new Date())}T00:00:00.000Z`) + 2 * 86_400_000,
    );
    const end = new Date(start.getTime() + 86_400_000);
    await prisma.tourDeparture.update({
      where: { id: dep.id },
      data: { startDate: start, endDate: end },
    });
    await prisma.booking.update({
      where: { id: bookingId },
      data: { departureStartDate: start, departureEndDate: end },
    });
  }
```

(c) Thêm ba ca vào cuối `describe('refunds integration (admin refund ledger)', …)`, ngay sau ca `BK-R1: hai admin refund full ĐỒNG THỜI …`:

```ts
  it('ADR-0041 §5: booking CANCELLED còn nguyên tiền (khách huỷ quá hạn) → admin hoàn thiện chí được, booking GIỮ CANCELLED', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('late-cancel@example.com', 'Alice');
    const booking = await createPaidBooking(alice); // 117.00, 3 ghế
    await moveDeparturePastDeadline(booking.id);

    const cancelled = await postCancel(alice, booking.code);
    expect(cancelled.statusCode).toBe(200);
    const result = CancelBookingResultSchema.parse(cancelled.json());
    // Quá hạn: không hoàn, không gọi cổng, nhưng ghế vẫn trả về chuyến.
    expect(result.refundedAmount).toBe('0.00');
    expect(result.booking.status).toBe('CANCELLED');
    expect(fake.refunds).toHaveLength(0);
    expect(await seatsBooked()).toBe(0);

    // Ngoại lệ (ốm đau, việc gấp) đi qua hoàn thiện chí — con đường DUY NHẤT
    // từ khi luồng duyệt huỷ bị gỡ.
    const res = await postRefund(admin, booking.code, {
      amount: '40.00',
      reason: 'Medical emergency',
    });
    expect(res.statusCode).toBe(200);
    const body = AdminRefundResultSchema.parse(res.json());
    // Travel story KHÔNG bị money story ghi đè (docs/conventions/booking-states.md).
    expect(body.booking.status).toBe('CANCELLED');
    expect(body.refunds.map((r) => Number(r.amount))).toEqual([40]);
    expect(fake.refunds).toHaveLength(1);
    expect(fake.refunds[0]).toMatchObject({
      amount: '40.00',
      idempotencyKey: `refund:${booking.id}:0.00`,
    });

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(row.status).toBe(BookingStatus.CANCELLED);
    expect(row.cancelledAt).not.toBeNull();
    // Hoàn thiện chí KHÔNG nhả ghế lần hai — lõi huỷ đã nhả rồi.
    expect(await seatsBooked()).toBe(0);
  });

  it('booking CANCELLED: hoàn nốt tới đủ total thì dừng, và byCode ghi yêu cầu do CHÍNH khách quyết', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('late-cancel-cap@example.com', 'Alice');
    const booking = await createPaidBooking(alice);
    await moveDeparturePastDeadline(booking.id);
    expect((await postCancel(alice, booking.code)).statusCode).toBe(200);

    expect((await postRefund(admin, booking.code, { amount: '117.00' })).statusCode).toBe(200);
    const again = await postRefund(admin, booking.code, { amount: '1.00' });
    expect(again.statusCode).toBe(422);
    // Sổ đã settle: classifyRefundAmount báo NOTHING_LEFT trước mọi phép so số tiền.
    expect(again.json()).toMatchObject({ code: 'NOTHING_LEFT' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings/${booking.code}`,
      headers: { cookie: admin },
    });
    expect(res.statusCode).toBe(200);
    const detail = AdminBookingDetailSchema.parse(res.json());
    expect(detail.status).toBe('CANCELLED');
    expect(detail.refundedTotal).toBe('117.00');
    expect(detail.cancellationRequests).toHaveLength(1);
    expect(detail.cancellationRequests[0]).toMatchObject({
      status: 'REFUNDED',
      decidedByCustomer: true,
    });
  });

  it('BK-R1 cross-path: admin hoàn thiện chí ‖ khách tự huỷ ĐỒNG THỜI → đúng 1 lệnh hoàn tới cổng, sổ không vượt total (advisory lock)', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('cross-path-cancel@example.com', 'Alice');
    // Chuyến +45 ngày dài 2 ngày (N = 3): còn trong hạn, khách huỷ được hoàn đủ.
    const booking = await createPaidBooking(alice); // 117.00

    fake.refundDelayMs = 100; // ép hai đường cùng đọc sổ = 0 trước khi bên nào ghi
    const [a, b] = await Promise.allSettled([
      postRefund(admin, booking.code, { amount: '117.00' }),
      postCancel(alice, booking.code),
    ]);
    const codes = [a, b]
      .map((r) => (r.status === 'fulfilled' ? r.value.statusCode : 0))
      .sort((x, y) => x - y);
    // Admin thắng khoá: booking REFUNDED → khách nhận NOT_CANCELLABLE (422).
    // Khách thắng khoá: lõi huỷ hoàn đủ 117.00 → admin nhận NOTHING_LEFT (422).
    expect(codes).toEqual([200, 422]);

    // Bất biến tiền không đổi dù bên nào thắng: cổng gọi ĐÚNG một lần, sổ một dòng.
    expect(fake.refunds).toHaveLength(1);
    const refunds = await prisma.refund.findMany({ where: { bookingId: booking.id } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.amount.toFixed(2)).toBe('117.00');
  });
```

- [ ] **Step 11: Chạy int test, xác nhận đỏ**

Docker Postgres phải đang chạy.

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/refunds.int.spec.ts`

Expected: FAIL đúng ca `booking CANCELLED: hoàn nốt tới đủ total thì dừng, và byCode ghi yêu cầu do CHÍNH khách quyết`, tại dòng `expect(res.statusCode).toBe(200)`. `GET /api/admin/bookings/{code}` trả 500: server oRPC validate output theo `AdminBookingDetailSchema` vừa build, mà API chưa điền `cancellationRequests[].decidedByCustomer`.

Hai ca mới còn lại PASS ngay: chúng khoá hành vi đã có và vừa mất lưới test.

- [ ] **Step 12: API điền `decidedByCustomer`**

Trong `apps/api/src/modules/bookings/cancellations.service.ts`, hàm `toCancellationRequest`, thay:

```ts
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
```

bằng:

```ts
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    // Khách tự huỷ ghi `decided_by` = chính khách (ADR-0041 §4); luồng duyệt cũ
    // ghi id admin. So với `user_id` của CHÍNH dòng này, không tra bảng users.
    decidedByCustomer: row.decidedById !== null && row.decidedById === row.userId,
```

- [ ] **Step 13: Chạy lại int test và typecheck API, xác nhận xanh**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/refunds.int.spec.ts src/modules/bookings/cancellations.int.spec.ts src/modules/stats/stats.int.spec.ts src/modules/stats/reports.int.spec.ts`
Expected: PASS cả bốn file.

Run: `pnpm turbo run typecheck --filter=@tourism/api`
Expected: PASS.

- [ ] **Step 14: i18n — dọn khoá của luồng duyệt, viết lại khối lịch sử huỷ**

Sửa `libs/shared/i18n/src/lib/messages.ts`. Mọi chỗ định vị theo nội dung vì Task 7 đã làm lệch số dòng.

(a) Xoá dòng `import { REFUND_GRACE_HOURS } from '@tourism/contract';`. Chỗ dùng cuối cùng (`grace:` trong khối `admin.cancellations`) bị xoá ở (h).

(b) Thay:

```ts
// MỘT bộ nhãn cho enum CancellationRequestStatus, dùng ở CẢ hai chỗ in nó:
// hàng đợi `/cancellations` (F3) và lịch sử append-only trên trang chi tiết
// booking (F1). Hai bản chép tay là hai bản sẽ trôi lệch (bài học travellers).
const CANCELLATION_STATUS_COPY = {
  REQUESTED: 'Awaiting review',
  DENIED: 'Denied',
  REFUNDED: 'Approved — refunded',
} as const;

// Ba nhãn ngữ cảnh của vùng cancellations dùng ở CẢ header cột lẫn dialog
// quyết định — một khái niệm một chữ (review F3 31/08, bài học travellers).
const CANCELLATION_CONTEXT_COPY = {
  booking: 'Booking',
  tour: 'Tour',
  customer: 'Customer',
} as const;

// Bốn nhãn ngữ cảnh của vùng reviews dùng ở CẢ header cột lẫn dialog duyệt —
// cùng luật một-khái-niệm-một-chữ với CANCELLATION_CONTEXT_COPY ở trên.
```

bằng:

```ts
// Bốn nhãn ngữ cảnh của vùng reviews dùng ở CẢ header cột lẫn dialog duyệt —
// một khái niệm một chữ (review F3 31/08, bài học travellers).
```

(c) Trong `admin.shell`, xoá dòng `      cancellations: 'Cancellations',`.

(d) Trong `admin.stats`, xoá trọn:

```ts
      cancellations: {
        pendingQueue: 'Pending queue',
        approved: (days: number) => `Approved ${days}d`,
        denied: (days: number) => `Denied ${days}d`,
        /**
         * Nhãn khi kỳ do ADMIN chọn — BỎ hậu tố "Nd" (ADR-0028 §AMEND).
         * "Approved 31d" đọc thành "31 ngày gần nhất", tức một cửa sổ TRƯỢT;
         * nhưng lọc tháng 5 là một kỳ đứng yên, và khoảng ngày đã nói ở dòng
         * ngay trên hàng card rồi.
         */
        approvedInPeriod: 'Approved',
        deniedInPeriod: 'Denied',
      },
```

Trong `admin.stats.reviews`, thay `        /** Nhãn khi kỳ do ADMIN chọn — BỎ hậu tố "Nd" (cùng luật cancellations). */` bằng `        /** Nhãn khi kỳ do ADMIN chọn — BỎ hậu tố "Nd" (ADR-0028 §AMEND): kỳ đứng yên, không phải cửa sổ trượt. */`.

(e) Trong `admin.bookings.detail`, thay:

```ts
        cancellations: {
          heading: 'Cancellation history',
          empty: 'No cancellation requests for this booking.',
          reason: 'Reason',
          note: 'Decision note',
          requested: 'Requested',
          decided: 'Decided',
          // Enum CancellationRequestStatus — lịch sử append-only nên một
          // booking có thể mang nhiều dòng DENIED trước dòng cuối. Nhãn dùng
          // CHUNG với hàng đợi `/cancellations` (hằng trên đầu file).
          status: CANCELLATION_STATUS_COPY,
        },
```

bằng:

```ts
        cancellations: {
          heading: 'Cancellation history',
          empty: 'This booking has not been cancelled.',
          reason: 'Reason',
          /** Khách tự huỷ không bắt buộc ghi lý do (ADR-0041 §4) — `null` in câu này, không để trống. */
          noReason: 'No reason given',
          note: 'Decision note',
          requested: 'Requested',
          decided: 'Decided',
          /** Ai quyết — đọc cờ `decidedByCustomer` của contract. */
          byCustomer: 'By the customer',
          byStaff: 'By staff',
          /** Xếp loại trên mốc KHÁCH gửi yêu cầu, không phải hôm nay; ngày chót in theo `formatCalendarDate`. */
          withinDeadline: (deadline: string) => `Within the free-cancellation deadline (${deadline})`,
          afterDeadline: (deadline: string) => `After the free-cancellation deadline (${deadline})`,
          refunded: (amount: string) => `Refunded ${amount}`,
          notRefunded: 'No refund',
          // Enum CancellationRequestStatus. REQUESTED và DENIED chỉ còn ở dữ liệu
          // của luồng duyệt cũ (ADR-0041 bỏ luồng này), hiện chỉ đọc tới lượt seed lại.
          status: {
            REQUESTED: 'Awaiting review',
            DENIED: 'Denied',
            REFUNDED: 'Cancelled',
          },
        },
```

(f) Trong `admin.bookings.refund`, thay:

```ts
        /** Trạng thái ngoài PAID/PARTIALLY_REFUNDED — nút không hiện, câu này thay chỗ. */
        /**
         * Nút refund bị ẩn vì đang có yêu cầu huỷ chờ xử lý (ADR-0029 §AMEND).
         * Nói RÕ đường đúng thay vì chỉ tắt nút — một nút biến mất không lý do
         * là một admin đi tìm cách khác, và cách khác ở đây là cái bẫy.
         */
        openCancellation:
          'This booking has a cancellation request awaiting review. Approve it from Cancellations instead — that refunds, cancels the booking and releases the seats in one step.',
        unavailable: 'Only a paid or partially refunded booking can be refunded.',
```

bằng:

```ts
        /** Nút không hiện (Hợp đồng E: hết tiền để hoàn, hoặc PENDING/REFUNDED) — câu này thay chỗ. */
        unavailable:
          'Only a paid, partially refunded or cancelled booking with money left to refund can be refunded.',
```

(g) Trong `admin.bookings.refund.errors`, thay:

```ts
          NOT_REFUNDABLE:
            'This booking is not refundable — it needs a captured payment and a PAID or PARTIALLY REFUNDED status. Reload to see where it stands now.',
```

bằng:

```ts
          NOT_REFUNDABLE:
            'This booking is not refundable — it needs a captured payment and a PAID, PARTIALLY REFUNDED or CANCELLED status. Reload to see where it stands now.',
```

rồi xoá trọn:

```ts
          /** ADR-0029 §AMEND 4 — server chặn, không chỉ UI ẩn nút. */
          CANCELLATION_OPEN:
            'This booking has an open cancellation request. Decide that request instead — approving it handles the refund and releases the seats.',
```

(h) Xoá trọn khối `admin.cancellations`:
- Bắt đầu từ dòng `    /**` mở JSDoc ` * Vùng cancellations (spec P4b §3-F3) — hàng đợi request của khách cộng`.
- Kết thúc ở dòng `    },` đóng `cancellations: {`, ngay trước dòng `    /**` mở JSDoc ` * Vùng enquiries (spec P4c §3-F9) — CRM nhỏ trên form "Inquire Now" công`.
- Tức dòng 3592–3836 trước Task 7.

Kiểm tra: `grep -n "REFUND_GRACE_HOURS\|CANCELLATION_STATUS_COPY\|CANCELLATION_CONTEXT_COPY\|CANCELLATION_OPEN\|Approve it from Cancellations\|approveWizard" libs/shared/i18n/src/lib/messages.ts`

Expected: không dòng nào. Khoá `openCancellation` ở khối web (lỗi xoá tài khoản khi còn yêu cầu huỷ đang mở, dùng trong `apps/web/src/components/account/delete-account.tsx`) KHÔNG thuộc phạm vi Task 8 — giữ nguyên.

- [ ] **Step 15: Build i18n, chạy test i18n**

Run: `pnpm --filter @tourism/i18n build`
Expected: build xong.

Run: `pnpm turbo run test --filter=@tourism/i18n`
Expected: PASS.

- [ ] **Step 16: Admin — xoá vùng Cancellations**

Run (Git Bash, từ gốc repo):

```bash
git rm "apps/admin/src/app/(admin)/cancellations/page.tsx" \
  "apps/admin/src/app/(admin)/cancellations/[code]/page.tsx" \
  "apps/admin/src/app/(admin)/cancellations/actions.ts" \
  apps/admin/src/components/cancellations/approve-stepper-dialog.tsx \
  apps/admin/src/components/cancellations/cancellations-table.tsx \
  apps/admin/src/components/cancellations/cancellations-toolbar.tsx \
  apps/admin/src/components/cancellations/decide-actions.tsx \
  apps/admin/src/components/cancellations/decide-actions.spec.tsx \
  apps/admin/src/components/cancellations/review-request-button.tsx \
  apps/admin/src/components/kit/wizard-steps.tsx \
  apps/admin/src/components/kit/wizard-steps.spec.tsx \
  apps/admin/src/lib/api/cancellations.ts \
  apps/admin/src/lib/approve-refund.ts \
  apps/admin/src/lib/approve-refund.spec.ts \
  apps/admin/src/lib/cancellations-decide.ts \
  apps/admin/src/lib/cancellations-decide.spec.ts \
  apps/admin/src/lib/cancellations-query.ts \
  apps/admin/src/lib/cancellations-query.spec.ts \
  apps/admin/src/lib/cancellations-view.ts \
  apps/admin/src/lib/cancellations-view.spec.ts
```

Ngoài chính vùng này, file duy nhất còn import một file vừa xoá là `components/bookings/booking-detail-sections.tsx` (import `cancellations-view`, sửa ở Step 25). `lib/api/stats.ts` và `lib/stats-view.ts` không import file bị xoá nhưng mang phần stats của vùng — sửa ngay dưới (đã grep toàn `apps/admin/src`).

Sửa `apps/admin/src/lib/nav.ts`:

(a) Trong import từ `'lucide-react'`, xoá dòng `  CalendarX2,`.

(b) Xoá trọn:

```ts
      // Vùng thật thứ hai (P4b F3) — hàng đợi cancellation + quyết định.
      {
        key: 'cancellations',
        label: t.cancellations,
        // Mở thẳng HÀNG ĐỢI (?status=REQUESTED — việc cần làm), không phải
        // lịch sử trộn lẫn; tab "All" trong trang vẫn xem được tất cả (review
        // F3 31/08). Header khớp tiêu đề theo PATHNAME, bỏ query khi so.
        href: '/cancellations?status=REQUESTED',
        enabled: true,
        icon: CalendarX2,
      },
```

(c) Thay `        // nếp \`/cancellations?status=REQUESTED\`. Header khớp tiêu đề theo` bằng `        // nếp \`/outbox?status=FAILED\`. Header khớp tiêu đề theo`.

(d) Thay `      // cần làm: lead chưa ai chạm tới), cùng nếp \`/cancellations?status=REQUESTED\`` bằng `      // cần làm: lead chưa ai chạm tới), cùng nếp \`/reviews?status=pending\``.

(e) Thay `      // người), cùng nếp \`/cancellations?status=REQUESTED\`; tab "All" trong` bằng `      // người), cùng nếp \`/reviews?status=pending\`; tab "All" trong`.

Sửa comment `apps/admin/src/components/site-header.tsx`: thay `    // \`/cancellations?status=REQUESTED\` mở thẳng hàng đợi) nhưng` bằng `    // \`/reviews?status=pending\` mở thẳng hàng chờ duyệt) nhưng`.

Sửa `apps/admin/src/lib/api/stats.ts`:

(a) Trong `import type { … } from '@tourism/contract';`, xoá `  AdminCancellationsStats,`.

(b) Thay:

```ts
 * Cache theo tag CHỈ khi MỌI kẻ ghi bảng đều là server action của admin. Ba
 * vùng của P4b (bookings/cancellations/reviews) đúng như vậy nên cache 60s
```

bằng:

```ts
 * Cache theo tag CHỈ khi MỌI kẻ ghi bảng đều là server action của admin. Hai
 * vùng của P4b còn lại (bookings/reviews) đúng như vậy nên cache 60s
```

(c) Thay ` * kéo dài luôn thời gian khoá nút Approve/Deny. Cửa sổ đo là 28 ngày nên 60s` bằng ` * kéo dài luôn thời gian khoá nút ghi của trang. Cửa sổ đo là 28 ngày nên 60s`.

(d) Thay `/** Tag Data Cache của ba endpoint stats CÓ cache — action ghi nào đổi số thì update. */` bằng `/** Tag Data Cache của hai endpoint stats CÓ cache — action ghi nào đổi số thì update. */`.

(e) Xoá trọn:

```ts
/**
 * Bộ số `/cancellations` — endpoint stats thứ hai nhận khoảng ngày (ADR-0028
 * §AMEND). Khác `/bookings` ở chỗ vùng này mặc định KHÔNG lọc ngày, nên `{}`
 * là ca thường gặp chứ không phải ngoại lệ; lúc đó server dùng cửa sổ trượt
 * 28 ngày như trước.
 */
export async function fetchAdminCancellationsStats(
  cookie: string,
  range?: { from?: string; to?: string },
): Promise<AdminCancellationsStats> {
  return api.admin.stats.cancellations(range ?? {}, { context: statsContext(cookie) });
}

```

(f) Thay:

```ts
 * Bộ số `/reviews` — endpoint stats thứ BA nhận khoảng ngày (ADR-0028
 * §AMEND 2). Cùng nếp `/cancellations`: vùng này mặc định KHÔNG lọc ngày nên
```

bằng:

```ts
 * Bộ số `/reviews` — endpoint stats thứ HAI nhận khoảng ngày (ADR-0028
 * §AMEND 2). Vùng này mặc định KHÔNG lọc ngày nên
```

(g) Thay ` * F7 — KHÔNG cache (vòng vá review F7), khác ba vùng trên: hai ảnh chụp` bằng ` * F7 — KHÔNG cache (vòng vá review F7), khác hai vùng trên: hai ảnh chụp`.

Sửa `apps/admin/src/lib/stats-view.ts`:
- Xoá dòng `  type AdminCancellationsStats,` trong import.
- Xoá trọn hàm `/** Ba card của \`/cancellations\`. */ export function toCancellationsStatCards(…) { … }` (dòng 347–385 trước Task 8), cùng dòng trống sau nó.

Sửa `apps/admin/src/lib/stats-view.spec.ts`:

(a) Trong import từ `'@tourism/contract'`, xoá `  type AdminCancellationsStats,`. Trong import từ `'./stats-view'`, xoá `  toCancellationsStatCards,`.

(b) Xoá trọn fixture:

```ts
const CANCELLATIONS: AdminCancellationsStats = {
  period,
  pendingQueue: { current: 5, previous: 2 },
  approved: { current: 4, previous: 8 },
  denied: { current: 1, previous: 0 },
};

```

(c) Xoá trọn `describe('toCancellationsStatCards', () => { … });`: mở ở dòng `describe('toCancellationsStatCards', () => {`, ca đầu là `hàng đợi là ẢNH CHỤP nên caption nói "N days ago", …`, đóng ở `});` ngay trước `describe('toReviewsStatCards', () => {`.

(d) Xoá trọn khối lồng:
- Bắt đầu từ dòng `  /** \`/cancellations\` là vùng thứ hai có bộ lọc ngày (ADR-0028 §AMEND). */`.
- Gồm `  describe('toCancellationsStatCards', () => { … });` ngay sau đó, tới hết dòng `  });` đóng nó.
- Kết thúc ngay trước ca `  it('năm vùng còn lại KHÔNG đổi: chúng chưa có bộ lọc ngày nào', () => {`.

- [ ] **Step 17: Viết test đỏ cho `canRefund(status, remaining)` (Hợp đồng E)**

Trong `apps/admin/src/lib/refund.spec.ts`, thay trọn `describe('canRefund', () => { … });` (dòng 18–29) bằng:

```ts
describe('canRefund (Hợp đồng E, ADR-0041 §5)', () => {
  it('PAID, PARTIALLY_REFUNDED và CANCELLED còn tiền chưa hoàn → hiện nút', () => {
    expect(canRefund('PAID', '117.00')).toBe(true);
    expect(canRefund('PARTIALLY_REFUNDED', '87.00')).toBe(true);
    // Khách huỷ quá hạn giữ nguyên tiền — ngoại lệ đi qua hoàn thiện chí.
    expect(canRefund('CANCELLED', '117.00')).toBe(true);
    expect(canRefund('CANCELLED', '0.01')).toBe(true);
  });

  it('hết tiền để hoàn thì ẩn nút, dù trạng thái nào', () => {
    expect(canRefund('PAID', '0.00')).toBe(false);
    expect(canRefund('PARTIALLY_REFUNDED', '0.00')).toBe(false);
    // Huỷ trong hạn đã hoàn trọn phần dư.
    expect(canRefund('CANCELLED', '0.00')).toBe(false);
  });

  it('PENDING và REFUNDED không bao giờ hiện nút — chưa thu, hoặc đã hoàn đủ', () => {
    expect(canRefund('PENDING', '117.00')).toBe(false);
    expect(canRefund('REFUNDED', '0.00')).toBe(false);
  });
});
```

Thay trọn `describe('REFUND_CONTRACT_CODES', () => { … });` bằng:

```ts
describe('REFUND_CONTRACT_CODES', () => {
  it('derive từ keys khối i18n errors — một nguồn, đủ 6 mã contract', () => {
    // Khoá chống tái hiện bug review 31/08: ba danh sách chép tay từng lệch
    // nhau. Giờ tập mã LÀ tập câu — thêm/bớt một bên là bên kia tự khớp, còn
    // test này khoá đúng 6 mã của contract hiện tại (CANCELLATION_OPEN bỏ cùng
    // luồng duyệt huỷ, ADR-0041).
    expect([...REFUND_CONTRACT_CODES].sort()).toEqual([
      'NOTHING_LEFT',
      'NOT_FOUND',
      'NOT_REFUNDABLE',
      'OVER_TOTAL',
      'REFUND_FAILED',
      'ZERO_OR_NEGATIVE',
    ]);
  });
});
```

Đổi tiêu đề `'giữ NGUYÊN 7 mã contract (defined error thật của oRPC), không nuốt thành GENERIC'` thành `'giữ NGUYÊN 6 mã contract (defined error thật của oRPC), không nuốt thành GENERIC'`.

- [ ] **Step 18: Chạy test, xác nhận đỏ**

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/refund.spec.ts`

Expected: FAIL hai ca của `canRefund`:
- `PAID, PARTIALLY_REFUNDED và CANCELLED còn tiền…`: `canRefund('CANCELLED', …)` trả `false`.
- `hết tiền để hoàn thì ẩn nút…`: `canRefund('PAID', '0.00')` trả `true`.

Ca `REFUND_CONTRACT_CODES` PASS, vì i18n đã build ở Step 15.

- [ ] **Step 19: Cài `canRefund` mới, bỏ `hasOpenCancellation` khỏi panel**

Trong `apps/admin/src/lib/refund.ts`, thay trọn khối từ JSDoc ` * Trạng thái còn refund được — khớp gate của \`RefundsService.refundByAdmin\`:` tới hết hàm `canRefund` bằng:

```ts
/**
 * Nút hoàn thiện chí hiện khi còn tiền chưa hoàn trên booking PAID,
 * PARTIALLY_REFUNDED hoặc CANCELLED (Hợp đồng E, ADR-0041 §5) — khớp gate của
 * `RefundsService.refundByAdmin`. CANCELLED nằm trong danh sách vì khách huỷ
 * quá hạn giữ nguyên tiền, và ngoại lệ (ốm đau, việc gấp) đi qua đúng lệnh
 * này. REFUNDED đã hoàn đủ, PENDING chưa thu tiền.
 *
 * `remaining` là `remainingRefundable(total, refundedTotal)` tính từ số server
 * trả. Đây là điều kiện CẦN chứ chưa đủ: server còn đòi `providerPaymentId`
 * (captured payment) — thứ contract không phơi ra — nên nút vẫn có thể ăn
 * NOT_REFUNDABLE, và đó là lý do mã lỗi ấy có copy riêng.
 */
export function canRefund(status: BookingStatusValue, remaining: string): boolean {
  const refundableStatus =
    status === 'PAID' || status === 'PARTIALLY_REFUNDED' || status === 'CANCELLED';
  return refundableStatus && toCents(remaining) > 0;
}
```

Trong `apps/admin/src/components/bookings/refund-panel.tsx`, thay:

```ts
  refundedTotal: string;
  /** Có yêu cầu huỷ nào đang `REQUESTED` không — quyết định nút refund có hiện. */
  hasOpenCancellation: boolean;
  currency: string;
```

bằng:

```ts
  refundedTotal: string;
  currency: string;
```

Thay:

```tsx
  // ADR-0029 §AMEND: booking đang có yêu cầu huỷ chờ xử lý thì ĐƯỜNG ĐÚNG là
  // Approve ở `/cancellations/[code]` — chỉ nó mới đóng request, huỷ booking
  // và NHẢ GHẾ. Hoàn đủ tiền bằng nút này để lại request mở và ghế rò vĩnh
  // viễn; đó là bug đã đo được, và ẩn nút là chỗ CHẶN nó tại nguồn.
  const refundable = canRefund(booking.status) && !booking.hasOpenCancellation;
  const remaining = remainingRefundable(booking.totalAmount, booking.refundedTotal);
```

bằng:

```tsx
  const remaining = remainingRefundable(booking.totalAmount, booking.refundedTotal);
  // Hợp đồng E: còn tiền chưa hoàn trên booking PAID/PARTIALLY_REFUNDED/CANCELLED.
  // Luồng duyệt huỷ đã gỡ (ADR-0041), nên không còn trạng thái nào phải giữ
  // nút này lại cho một quyết định khác.
  const refundable = canRefund(booking.status, remaining);
```

Thay:

```tsx
        {refundable ? null : (
          <p className="text-muted-foreground">
            {booking.hasOpenCancellation ? t.openCancellation : t.unavailable}
          </p>
        )}
```

bằng:

```tsx
        {refundable ? null : <p className="text-muted-foreground">{t.unavailable}</p>}
```

Trong `apps/admin/src/components/bookings/refund-panel.spec.tsx`:
- Xoá dòng `  hasOpenCancellation: false,` trong fixture `PAID`.
- Thay trọn JSDoc `ADR-0029 §AMEND — chặn ca chồng lấn tại nguồn…` cùng `describe('RefundPanel — booking có yêu cầu huỷ đang mở', () => { … });` ở cuối file bằng:

```tsx
/**
 * ADR-0041 §5 — khách huỷ quá hạn để lại booking CANCELLED còn nguyên tiền;
 * ngoại lệ đi qua chính nút này. Hết tiền để hoàn thì nút ẩn, câu giải thích thay chỗ.
 */
describe('RefundPanel — booking CANCELLED', () => {
  it('còn tiền chưa hoàn → HIỆN nút refund', () => {
    render(<RefundPanel booking={{ ...PAID, status: 'CANCELLED' }} refund={vi.fn()} />);
    expect(screen.getByRole('button', { name: t.cta })).toBeInTheDocument();
  });

  it('đã hoàn trọn (huỷ trong hạn) → ẨN nút và nói rõ vì sao', () => {
    render(
      <RefundPanel
        booking={{ ...PAID, status: 'CANCELLED', refundedTotal: '120.00' }}
        refund={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: t.cta })).toBeNull();
    expect(screen.getByText(t.unavailable)).toBeInTheDocument();
  });
});
```

- [ ] **Step 20: Chạy test, xác nhận xanh**

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/refund.spec.ts src/components/bookings/refund-panel.spec.tsx`
Expected: PASS cả hai file.

- [ ] **Step 21: Viết test đỏ cho mapper lịch sử huỷ**

Tạo `apps/admin/src/lib/cancellation-history.spec.ts`:

```ts
import type { Refund } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { formatDateTime } from './bookings-view';
import {
  type CancellationHistoryBooking,
  type CancellationHistoryRequest,
  cancellationStatusBadgeVariant,
  refundedForRequest,
  toCancellationHistoryRow,
} from './cancellation-history';

/**
 * Khối "Cancellation history" của `/bookings/[code]` (ADR-0041, spec §6): ai
 * huỷ, lúc nào, trong hay quá hạn chót, hoàn bao nhiêu, lý do. Mọi mốc trong
 * bộ này là mốc cố định — mapper không được đọc đồng hồ (Q7).
 */
const t = messages.admin.bookings.detail.cancellations;

/** Chuyến 2 ngày 20–21/10/2026: N = 3 → ngày chót 17/10 (ADR-0041 §3.1). */
const BOOKING: CancellationHistoryBooking = {
  departureStartDate: '2026-10-20',
  departureEndDate: '2026-10-21',
  currency: 'USD',
  refunds: [],
};

function refund(n: number, amount: string, createdAt: string, adminId: string | null): Refund {
  return {
    id: `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`,
    amount,
    currency: 'USD',
    providerRefundId: `re_test_${n}`,
    adminId,
    reason: adminId ? 'Medical emergency' : null,
    createdAt,
  };
}

const ADMIN_ID = '33333333-3333-4333-8333-333333333333';

/** Lõi huỷ ghi yêu cầu và dòng hoàn trong CÙNG giao dịch: gửi = quyết = hoàn. */
function selfCancel(at: string): CancellationHistoryRequest {
  return {
    id: '22222222-2222-4222-8222-000000000001',
    status: 'REFUNDED',
    reason: null,
    decisionNote: null,
    decidedAt: at,
    decidedByCustomer: true,
    createdAt: at,
  };
}

describe('toCancellationHistoryRow — khách tự huỷ', () => {
  it('23:59:59 ngày chót theo giờ Việt Nam → trong hạn, hoàn đủ, "By the customer"', () => {
    const at = '2026-10-17T16:59:59.000Z';
    const row = toCancellationHistoryRow(selfCancel(at), {
      ...BOOKING,
      refunds: [refund(1, '117.00', at, null)],
    });

    expect(row).toEqual({
      id: '22222222-2222-4222-8222-000000000001',
      statusLabel: t.status.REFUNDED,
      badgeVariant: 'default',
      actor: t.byCustomer,
      requested: formatDateTime(at),
      decided: formatDateTime(at),
      deadline: t.withinDeadline('17 Oct 2026'),
      refund: t.refunded('$117.00'),
      reason: t.noReason,
      decisionNote: null,
    });
  });

  it('00:00 ngày hôm sau theo giờ Việt Nam (UTC vẫn là ngày chót) → QUÁ hạn, không hoàn', () => {
    const row = toCancellationHistoryRow(selfCancel('2026-10-17T17:00:00.000Z'), BOOKING);

    expect(row.deadline).toBe(t.afterDeadline('17 Oct 2026'));
    expect(row.refund).toBe(t.notRefunded);
  });

  it('hoàn thiện chí SAU lần huỷ không bị tính là tiền của lần huỷ', () => {
    const row = toCancellationHistoryRow(selfCancel('2026-10-17T17:00:00.000Z'), {
      ...BOOKING,
      refunds: [refund(2, '40.00', '2026-10-19T03:00:00.000Z', ADMIN_ID)],
    });

    expect(row.refund).toBe(t.notRefunded);
  });

  it('hoàn thiện chí TRƯỚC lần huỷ (booking PARTIALLY_REFUNDED) cũng không lẫn vào', () => {
    const at = '2026-10-10T03:00:00.000Z';
    const row = toCancellationHistoryRow(
      { ...selfCancel(at), reason: 'Change of plans' },
      {
        ...BOOKING,
        refunds: [
          refund(1, '30.00', '2026-10-01T03:00:00.000Z', ADMIN_ID),
          refund(2, '87.00', at, null),
        ],
      },
    );

    expect(row.refund).toBe(t.refunded('$87.00'));
    expect(row.reason).toBe('Change of plans');
  });
});

describe('toCancellationHistoryRow — dữ liệu của luồng duyệt cũ', () => {
  it('nhân viên duyệt → "By staff", tiền hoàn tính trong khoảng từ lúc gửi tới lúc quyết', () => {
    const row = toCancellationHistoryRow(
      {
        id: '22222222-2222-4222-8222-000000000002',
        status: 'REFUNDED',
        reason: 'Family emergency',
        decisionNote: 'Approved per policy.',
        decidedAt: '2026-10-02T03:00:00.000Z',
        decidedByCustomer: false,
        createdAt: '2026-10-01T03:00:00.000Z',
      },
      { ...BOOKING, refunds: [refund(3, '58.50', '2026-10-02T03:00:00.000Z', ADMIN_ID)] },
    );

    expect(row.actor).toBe(t.byStaff);
    expect(row.deadline).toBe(t.withinDeadline('17 Oct 2026'));
    expect(row.refund).toBe(t.refunded('$58.50'));
    expect(row.decisionNote).toBe('Approved per policy.');
  });

  it('DENIED và REQUESTED không in hạn chót lẫn số tiền — yêu cầu ấy không huỷ booking', () => {
    const denied = toCancellationHistoryRow(
      {
        id: '22222222-2222-4222-8222-000000000003',
        status: 'DENIED',
        reason: 'Changed my mind',
        decisionNote: null,
        decidedAt: '2026-10-05T03:00:00.000Z',
        decidedByCustomer: false,
        createdAt: '2026-10-04T03:00:00.000Z',
      },
      BOOKING,
    );
    expect(denied).toMatchObject({
      statusLabel: t.status.DENIED,
      badgeVariant: 'outline',
      actor: t.byStaff,
      deadline: null,
      refund: null,
    });

    const open = toCancellationHistoryRow(
      {
        id: '22222222-2222-4222-8222-000000000004',
        status: 'REQUESTED',
        reason: 'Please cancel',
        decisionNote: null,
        decidedAt: null,
        decidedByCustomer: false,
        createdAt: '2026-10-06T03:00:00.000Z',
      },
      BOOKING,
    );
    expect(open).toMatchObject({
      statusLabel: t.status.REQUESTED,
      badgeVariant: 'secondary',
      actor: null,
      decided: null,
      deadline: null,
      refund: null,
    });
  });
});

describe('refundedForRequest', () => {
  it('cộng theo cent trong khoảng [min, max] của hai mốc — mốc JS lệch vài ms vẫn đúng', () => {
    expect(
      refundedForRequest(
        { createdAt: '2026-10-10T03:00:00.005Z', decidedAt: '2026-10-10T03:00:00.000Z' },
        [
          { amount: '0.1', createdAt: '2026-10-10T03:00:00.005Z' },
          { amount: '0.2', createdAt: '2026-10-10T03:00:00.000Z' },
          { amount: '5', createdAt: '2026-10-10T03:00:00.006Z' },
        ],
      ),
    ).toBe('0.30');
  });

  it('yêu cầu chưa quyết thì chưa có đồng nào của nó', () => {
    expect(
      refundedForRequest({ createdAt: '2026-10-10T03:00:00.000Z', decidedAt: null }, [
        { amount: '10.00', createdAt: '2026-10-10T03:00:00.000Z' },
      ]),
    ).toBe('0.00');
  });
});

describe('cancellationStatusBadgeVariant', () => {
  it('REFUNDED nổi bật, REQUESTED nhạt, DENIED viền trơn', () => {
    expect(cancellationStatusBadgeVariant('REFUNDED')).toBe('default');
    expect(cancellationStatusBadgeVariant('REQUESTED')).toBe('secondary');
    expect(cancellationStatusBadgeVariant('DENIED')).toBe('outline');
  });
});
```

- [ ] **Step 22: Chạy test, xác nhận đỏ**

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/cancellation-history.spec.ts`
Expected: FAIL — `Failed to resolve import "./cancellation-history"`.

- [ ] **Step 23: Cài mapper lịch sử huỷ**

Tạo `apps/admin/src/lib/cancellation-history.ts`:

```ts
import {
  type AdminBookingDetail,
  type CancellationRequest,
  type CancellationRequestStatusValue,
  cancellationDeadline,
  fromCents,
  isWithinDeadline,
  type Refund,
  toCents,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount, formatCalendarDate, formatDateTime } from './bookings-view';

/**
 * Mapper khối "Cancellation history" của `/bookings/[code]` (ADR-0041, spec §6)
 * — THUẦN, ngoài React, nên từng câu test được. Server component gọi nó.
 *
 * Không phép tính nào ở đây đọc đồng hồ (Q7): trong hay quá hạn chót xếp loại
 * trên mốc KHÁCH gửi yêu cầu bằng đúng hàm luật mà API và báo cáo tháng dùng,
 * nên ba nơi không thể nói ba câu khác nhau về cùng một lần huỷ.
 */

const t = messages.admin.bookings.detail.cancellations;

export type CancellationBadgeVariant = 'default' | 'secondary' | 'outline';

/** Phần yêu cầu mà một dòng lịch sử cần — `Pick` để fixture không kéo field thừa. */
export type CancellationHistoryRequest = Pick<
  CancellationRequest,
  'id' | 'status' | 'reason' | 'decisionNote' | 'decidedAt' | 'decidedByCustomer' | 'createdAt'
>;

/** Phần booking mà một dòng lịch sử cần: ngày đi, ngày về (hạn chót), đồng tiền, sổ hoàn. */
export type CancellationHistoryBooking = Pick<
  AdminBookingDetail,
  'departureStartDate' | 'departureEndDate' | 'currency' | 'refunds'
>;

/** Một dòng lịch sử đã định dạng sẵn. */
export interface CancellationHistoryRowVM {
  id: string;
  statusLabel: string;
  badgeVariant: CancellationBadgeVariant;
  /** Ai quyết; `null` khi yêu cầu (dữ liệu cũ) còn chưa ai quyết. */
  actor: string | null;
  requested: string;
  decided: string | null;
  /** Câu trong/quá hạn chót — chỉ dòng REFUNDED, tức lần huỷ thật. */
  deadline: string | null;
  /** Số tiền hoàn của CHÍNH lần huỷ — chỉ dòng REFUNDED. */
  refund: string | null;
  reason: string;
  decisionNote: string | null;
}

/**
 * Variant Badge — luật màu là DỮ LIỆU. REFUNDED nổi bật (booking đã huỷ),
 * REQUESTED nhạt (dữ liệu cũ đang chờ), DENIED viền trơn: từ chối là kết cục
 * BÌNH THƯỜNG của luồng cũ, tô destructive sẽ đọc thành "có lỗi". Chuyển từ
 * `cancellations-view.ts` khi vùng Cancellations bị gỡ.
 */
export function cancellationStatusBadgeVariant(
  status: CancellationRequestStatusValue,
): CancellationBadgeVariant {
  switch (status) {
    case 'REQUESTED':
      return 'secondary';
    case 'REFUNDED':
      return 'default';
    default:
      return 'outline';
  }
}

/**
 * Tiền hoàn của CHÍNH một lần huỷ: tổng các dòng sổ có `createdAt` nằm giữa lúc
 * gửi và lúc quyết của yêu cầu, tính cả hai đầu.
 *
 * Theo mốc chứ không theo cột nối vì sổ `refunds` không trỏ về yêu cầu nào. Lõi
 * huỷ ghi yêu cầu và dòng hoàn trong CÙNG một CTE (Hợp đồng C); luồng duyệt cũ
 * cũng ghi dòng hoàn đúng lúc quyết. Hoàn thiện chí trước hoặc sau lần huỷ nằm
 * ngoài khoảng ấy. Lấy min/max của hai mốc để không phụ thuộc bên nào ghi bằng
 * `now()` của SQL, bên nào bằng mốc JS. Cộng theo cent — không float.
 */
export function refundedForRequest(
  request: Pick<CancellationRequest, 'createdAt' | 'decidedAt'>,
  refunds: readonly Pick<Refund, 'amount' | 'createdAt'>[],
): string {
  if (request.decidedAt === null) return fromCents(0);
  const sent = Date.parse(request.createdAt);
  const decided = Date.parse(request.decidedAt);
  const from = Math.min(sent, decided);
  const to = Math.max(sent, decided);
  let cents = 0;
  for (const row of refunds) {
    const at = Date.parse(row.createdAt);
    if (at >= from && at <= to) cents += toCents(row.amount);
  }
  return fromCents(cents);
}

/** Ai quyết: `null` khi chưa ai quyết (yêu cầu REQUESTED của luồng cũ). */
function actorLabel(request: CancellationHistoryRequest): string | null {
  if (request.decidedAt === null) return null;
  return request.decidedByCustomer ? t.byCustomer : t.byStaff;
}

/** Yêu cầu của contract + booking → một dòng lịch sử đã định dạng (server component gọi). */
export function toCancellationHistoryRow(
  request: CancellationHistoryRequest,
  booking: CancellationHistoryBooking,
): CancellationHistoryRowVM {
  let deadline: string | null = null;
  let refund: string | null = null;

  // Chỉ dòng REFUNDED là một lần huỷ thật; REQUESTED/DENIED cũ không huỷ gì
  // nên không có hạn chót hay số tiền nào để nói.
  if (request.status === 'REFUNDED') {
    const { departureStartDate: start, departureEndDate: end } = booking;
    const deadlineLabel = formatCalendarDate(cancellationDeadline(start, end));
    deadline = isWithinDeadline(new Date(request.createdAt), start, end)
      ? t.withinDeadline(deadlineLabel)
      : t.afterDeadline(deadlineLabel);

    const amount = refundedForRequest(request, booking.refunds);
    refund = toCents(amount) > 0 ? t.refunded(formatAmount(amount, booking.currency)) : t.notRefunded;
  }

  return {
    id: request.id,
    statusLabel: t.status[request.status],
    badgeVariant: cancellationStatusBadgeVariant(request.status),
    actor: actorLabel(request),
    requested: formatDateTime(request.createdAt),
    decided: request.decidedAt ? formatDateTime(request.decidedAt) : null,
    deadline,
    refund,
    reason: request.reason ?? t.noReason,
    decisionNote: request.decisionNote,
  };
}
```

- [ ] **Step 24: Chạy test, xác nhận xanh**

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/cancellation-history.spec.ts`
Expected: PASS 9 ca.

- [ ] **Step 25: Trang chi tiết booking dùng khối lịch sử mới**

Sửa `apps/admin/src/components/bookings/booking-detail-sections.tsx`:

(a) Thay dòng `import type { AdminBookingDetail, CancellationRequest, Refund } from '@tourism/contract';` bằng `import type { AdminBookingDetail, Refund } from '@tourism/contract';`.

Thay dòng `import { cancellationStatusBadgeVariant } from '@/lib/cancellations-view';` bằng `import { type CancellationHistoryRowVM, toCancellationHistoryRow } from '@/lib/cancellation-history';`.

(b) Thay trọn JSDoc đầu file:
- Bắt đầu từ `/**` có dòng ` * Các khối trình bày của MỘT booking, tách khỏi \`/bookings/[code]\` ở 04/09 khi`.
- Kết thúc ở ` */` ngay trên `const t = messages.admin.bookings.detail;`.

Thay bằng:

```ts
/**
 * Các khối trình bày của MỘT booking cho `/bookings/[code]` (tách khỏi trang ở
 * 04/09). Vùng Cancellations từng dùng chung các khối này; ADR-0041 gỡ vùng ấy,
 * nên trang chi tiết booking là nơi DUY NHẤT xem một lần huỷ.
 *
 * Vì sao ở `components/bookings/` chứ không phải `components/kit/`: kit là chỗ
 * của thứ KHÔNG biết miền nào (bảng, menu, dialog). Mấy khối này biết
 * `AdminBookingDetail` từ đầu tới cuối — chúng là trình bày của MIỀN booking.
 *
 * Toàn bộ file là server component thuần: không state, không handler. Phần
 * GHI (RefundPanel) do TRANG lắp vào.
 */
```

(c) Thay trọn `CancellationHistoryCard` cùng JSDoc của nó (khối `Lịch sử huỷ append-only (D1-B)…`) bằng:

```tsx
/**
 * Lịch sử huỷ append-only, cũ nhất trước: ai huỷ, lúc nào, trong hay quá hạn
 * chót, hoàn bao nhiêu, lý do (spec §6). Mọi câu dựng ở
 * `lib/cancellation-history.ts`; ở đây chỉ bày ra.
 */
export function CancellationHistoryCard({ booking }: { booking: AdminBookingDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.cancellations.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <Timeline empty={t.cancellations.empty}>
          {booking.cancellationRequests.map((request) => (
            <CancellationHistoryRow
              key={request.id}
              row={toCancellationHistoryRow(request, booking)}
            />
          ))}
        </Timeline>
      </CardContent>
    </Card>
  );
}
```

(d) Thay trọn hàm `function CancellationHistoryRow({ request }: { request: CancellationRequest }) { … }` bằng:

```tsx
function CancellationHistoryRow({ row }: { row: CancellationHistoryRowVM }) {
  return (
    <TimelineItem>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={row.badgeVariant}>{row.statusLabel}</Badge>
        {row.actor ? <span className="font-medium">{row.actor}</span> : null}
        <span className="text-muted-foreground">
          {t.cancellations.requested} {row.requested}
        </span>
        {row.decided ? (
          <span className="text-muted-foreground">
            · {t.cancellations.decided} {row.decided}
          </span>
        ) : null}
      </div>
      {row.deadline && row.refund ? (
        <p>
          {row.deadline} · {row.refund}
        </p>
      ) : null}
      <p>
        <span className="text-muted-foreground">{t.cancellations.reason}: </span>
        {row.reason}
      </p>
      {row.decisionNote ? (
        <p>
          <span className="text-muted-foreground">{t.cancellations.note}: </span>
          {row.decisionNote}
        </p>
      ) : null}
    </TimelineItem>
  );
}
```

(e) Xoá trọn hàm `RefundLedger` cùng JSDoc `Sổ cái refund dạng CARD, thuần đọc — dùng ở \`/cancellations/[code]\`…`. Người dùng duy nhất là trang `/cancellations/[code]`, đã xoá ở Step 16.

(f) Trong JSDoc của `RefundLedgerTable`, thay:

```ts
 * Ở đây (server component) chứ không ở `refund-panel.tsx` ('use client') vì
 * từ 04/09 nó có HAI người dùng: panel phát refund của `/bookings/[code]`, và
 * khối thuần-đọc của `/cancellations/[code]`. Người thứ hai không cần một byte
 * JavaScript nào để in một cái bảng.
```

bằng:

```ts
 * Người dùng duy nhất là `RefundPanel`; bảng nằm ở file này vì là trình bày
 * của miền booking, cùng họ với các khối trên.
```

Sửa `apps/admin/src/app/(admin)/bookings/[code]/page.tsx`:

(a) Thay:

```ts
 * Từ 04/09 các khối trình bày nằm ở `booking-detail-sections.tsx` — dùng
 * chung với `/cancellations/[code]`, trang chi tiết RIÊNG của vùng huỷ (user
 * chốt: hai vùng hai route, chung kiểu thiết kế). Thứ KHÁC nhau giữa hai
 * trang là phần GHI: ở đây là `RefundPanel`, bên kia là cụm quyết định.
```

bằng:

```ts
 * Các khối trình bày nằm ở `booking-detail-sections.tsx`. Từ ADR-0041 không
 * còn vùng Cancellations: một lần huỷ xem ở khối lịch sử huỷ của trang này, và
 * ngoại lệ hoàn tiền đi qua `RefundPanel`, kể cả trên booking đã huỷ.
```

(b) Xoá trọn:

```tsx
            // Suy từ TRẠNG THÁI, không từ trang nào dẫn tới (ADR-0029 §AMEND):
            // một tham số URL thì ai cũng gõ được, còn cái này thì không.
            hasOpenCancellation: booking.cancellationRequests.some(
              (request) => request.status === 'REQUESTED',
            ),
```

(c) Thay `        <CancellationHistoryCard requests={booking.cancellationRequests} />` bằng `        <CancellationHistoryCard booking={booking} />`.

- [ ] **Step 26: Sửa comment còn nhắc tên đã xoá**

- `apps/admin/src/lib/table-query.ts` — thay ` * \`AdminCancellationsListQuerySchema\` khai CÙNG một hình phân trang` bằng ` * các query admin khác khai CÙNG một hình phân trang`.
- `apps/admin/src/components/kit/table-search-form.tsx` — thay:

```ts
 * Chỉ dựng ô này cho vùng mà server THẬT SỰ đọc tham số search — bảng
 * `/cancellations` cố ý không có, vì `AdminCancellationsListQuerySchema`
 * không khai `search` và một ô tìm kiếm không lọc gì là lời hứa suông.
```

bằng:

```ts
 * Chỉ dựng ô này cho vùng mà server THẬT SỰ đọc tham số search — schema query
 * nào không khai `search` thì không có ô, vì một ô tìm kiếm không lọc gì là
 * lời hứa suông.
```

- `apps/admin/src/lib/outbox-retry.ts` — thay ` * \`cancellations-decide.ts\`: codec lỗi derive từ khối i18n, luật trạng-thái-` bằng ` * \`reviews-moderate.ts\`: codec lỗi derive từ khối i18n, luật trạng-thái-`.
- `apps/admin/src/lib/reviews-moderate.ts` — thay ` * test riêng, đúng khuôn \`refund.ts\` (F2) và \`cancellations-decide.ts\` (F3).` bằng ` * test riêng, đúng khuôn \`refund.ts\` (F2).`.
- `apps/admin/src/lib/reviews-query.ts` — thay ` * khuôn \`bookings-query.ts\`/\`cancellations-query.ts\`, phân trang dùng chung` bằng ` * khuôn \`bookings-query.ts\`, phân trang dùng chung`.
- `apps/admin/src/app/(admin)/reviews/actions.ts` — thay ` * review F2/F3 (\`bookings/[code]/actions.ts\`, \`cancellations/actions.ts\`):` bằng ` * review F2/F3 (\`bookings/[code]/actions.ts\`):`.
- `apps/admin/src/app/(admin)/outbox/actions.ts` — thay ` * \`cancellations/actions.ts\`:` bằng ` * \`reviews/actions.ts\`:`.

- [ ] **Step 27: Grep kiểm không còn tham chiếu tới thứ đã xoá**

Run (Git Bash, từ gốc repo):

```bash
grep -rnE "admin\.cancellations|stats\.cancellations|AdminCancellationRequest|AdminCancellationsListQuery|DecideCancellation|AdminCancellationsStats|CANCELLATION_OPEN|CancellationOpenError|CancellationRequestNotFoundError|CancellationAlreadyDecidedError|OffPolicyNoteRequiredError|AdminCancellationsController|adminCancellations|pendingRequestsAt|myRequests|hasOpenCancellation|toCancellationsStatCards|fetchAdminCancellations|approve-refund|cancellations-(view|query|decide)|components/cancellations|wizard-steps" \
  apps libs --include=*.ts --include=*.tsx --include=*.mjs \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=generated
```

Expected: không dòng nào.

Run: `ls "apps/admin/src/app/(admin)/cancellations" apps/admin/src/components/cancellations`
Expected: `No such file or directory` cho cả hai.

- [ ] **Step 28: Chạy test admin, typecheck bốn package**

`apps/admin/tsconfig.json` include `.next/types/**/*.ts`; bản build cũ còn type route `/cancellations` sẽ làm typecheck đỏ oan. Không có `next dev`/`next start` nào đang chạy thì mới xoá.

Run: `rm -rf apps/admin/.next`

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/refund.spec.ts src/lib/cancellation-history.spec.ts src/lib/stats-view.spec.ts src/components/bookings/refund-panel.spec.tsx`
Expected: PASS cả bốn file.

Run: `pnpm turbo run typecheck --filter=@tourism/contract --filter=@tourism/i18n --filter=@tourism/api --filter=@tourism/admin --concurrency=3`
Expected: PASS.

- [ ] **Step 29: Biome và Cổng đầy đủ**

Run: `pnpm lint:fix`
Expected: Biome sắp lại import (ví dụ `import * as contractIndex` trong `contract.spec.ts`) và không còn lỗi.

Run (Git Bash, Docker Postgres đang chạy):

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu lệnh xanh.

- [ ] **Step 30: Commit**

Các file xoá đã được stage bằng `git rm` ở Step 6 và Step 16. Stage phần còn lại bằng đường dẫn tường minh:

```bash
git add \
  libs/shared/contract/src/contract.ts \
  libs/shared/contract/src/contract.spec.ts \
  libs/shared/contract/src/schemas/bookings.ts \
  libs/shared/contract/src/schemas/bookings.spec.ts \
  libs/shared/contract/src/schemas/stats.ts \
  libs/shared/contract/src/schemas/stats.spec.ts \
  libs/shared/contract/src/schemas/reviews.ts \
  libs/shared/i18n/src/lib/messages.ts \
  apps/api/src/modules/bookings/bookings.module.ts \
  apps/api/src/modules/bookings/admin-bookings.controller.ts \
  apps/api/src/modules/bookings/cancellations.service.ts \
  apps/api/src/modules/bookings/refunds.service.ts \
  apps/api/src/modules/bookings/cancellations.int.spec.ts \
  apps/api/src/modules/bookings/refunds.int.spec.ts \
  apps/api/src/modules/stats/stats.service.ts \
  apps/api/src/modules/stats/admin-stats.controller.ts \
  apps/api/src/modules/stats/stats.int.spec.ts \
  apps/api/src/modules/outbox/admin-outbox.controller.ts \
  apps/admin/src/lib/cancellation-history.ts \
  apps/admin/src/lib/cancellation-history.spec.ts \
  apps/admin/src/lib/refund.ts \
  apps/admin/src/lib/refund.spec.ts \
  apps/admin/src/components/bookings/refund-panel.tsx \
  apps/admin/src/components/bookings/refund-panel.spec.tsx \
  apps/admin/src/components/bookings/booking-detail-sections.tsx \
  "apps/admin/src/app/(admin)/bookings/[code]/page.tsx" \
  apps/admin/src/lib/nav.ts \
  apps/admin/src/components/site-header.tsx \
  apps/admin/src/lib/api/stats.ts \
  apps/admin/src/lib/stats-view.ts \
  apps/admin/src/lib/stats-view.spec.ts \
  apps/admin/src/lib/table-query.ts \
  apps/admin/src/components/kit/table-search-form.tsx \
  apps/admin/src/lib/outbox-retry.ts \
  apps/admin/src/lib/reviews-moderate.ts \
  apps/admin/src/lib/reviews-query.ts \
  "apps/admin/src/app/(admin)/reviews/actions.ts" \
  "apps/admin/src/app/(admin)/outbox/actions.ts"
git status --short
```

Kiểm `git status --short`: không còn file nào của Task 8 ở trạng thái chưa stage, và không có `docs/screenshot/`.

```bash
git commit -F - <<'EOF'
feat(refund): gỡ luồng duyệt huỷ, mở hoàn thiện chí cho booking đã huỷ

Contract bỏ admin.cancellations.*, admin.stats.cancellations, mã CANCELLATION_OPEN
và các schema chỉ chúng dùng; CancellationRequestSchema thêm decidedByCustomer.
API bỏ controller duyệt huỷ, approve/deny/adminList/myRequests và thẻ thống kê
hàng đợi; refundByAdmin không còn chặn theo yêu cầu đang mở.
Admin gỡ vùng Cancellations; canRefund(status, remaining) mở nút cho booking
CANCELLED còn tiền; khối lịch sử huỷ ghi ai huỷ, trong hay quá hạn chót, số
tiền đã hoàn và lý do.
EOF
```
---

### Task 9: Báo cáo tháng, Excel, P&L

**Files:**
- Modify: `libs/shared/contract/src/schemas/reports.ts` — dòng 104–124, 158–165.
- Test: `libs/shared/contract/src/schemas/reports.spec.ts`
- Modify: `apps/api/src/modules/stats/stats-aggregates.ts`
  - import (dòng 1–10);
  - thay `decisionsSlice` (dòng 132–145);
  - viết lại `recognizedRevenueSlice` (dòng 294–366) và `fixedCostSlice` (dòng 368–406).
- Modify: `apps/api/src/modules/stats/reports.service.ts` — dòng 6–16, 67–103, 137–138.
- Test: `apps/api/src/modules/stats/reports.int.spec.ts`
- Modify: `libs/shared/i18n/src/lib/messages.ts` — `admin.reports.operationsTable` và `admin.reports.definitions` (dòng 3195–3222 ở bản trước Task 7; Task 7 và Task 8 làm lệch, các bước định vị theo nội dung).
- Modify: `apps/admin/src/lib/reports-view.ts` (dòng 93–102), `apps/admin/src/lib/xlsx.ts` (dòng 290–291, 394–401), `apps/admin/src/app/(admin)/reports/page.tsx` (dòng 77–85).
- Test: `apps/admin/src/lib/reports-view.spec.ts`, `apps/admin/src/lib/xlsx.spec.ts`

**Interfaces:**
- Consumes:
  - Hợp đồng A: `isWithinDeadline(now: Date, startDate: string, endDate: string): boolean`.
  - Từ Task 8: `decisionsSlice` chỉ còn `reports.service.ts` dùng.
  - Từ Task 2: `cancellation_requests.reason` cho phép null.
  - Từ Task 6: mỗi lần khách huỷ ghi đúng một yêu cầu REFUNDED.
  - Có sẵn: `calendarDate` ở `apps/api/src/lib/calendar-date.ts`.
- Produces:
  - Hợp đồng D:
    - `AdminMonthlyReportSchema.cancellationsWithinDeadline` và `cancellationsAfterDeadline` — thay `cancellationsApproved` và `cancellationsDenied`;
    - `cancellationOutcomesSlice(from: Date, to: Date): Promise<{ withinDeadline: number; afterDeadline: number }>`.
  - Định nghĩa P&L mới trong `recognizedRevenueSlice` và `fixedCostSlice`:
    - "khách thực đi" là `paid_at IS NOT NULL AND status <> 'CANCELLED'`;
    - doanh thu tính trên mọi booking có `paid_at IS NOT NULL`, chuyến không CANCELLED.
  - Khoá i18n:
    - thêm `admin.reports.operationsTable.cancellationsWithinDeadline`, `admin.reports.operationsTable.cancellationsAfterDeadline`, `admin.reports.definitions.cancellations`;
    - xoá `admin.reports.operationsTable.cancellationsApproved`, `admin.reports.operationsTable.cancellationsDenied`;
    - sửa `admin.reports.definitions.recognised`, `admin.reports.definitions.costs`.

- [ ] **Step 1: Viết int test đỏ cho định nghĩa P&L mới**

Trong `apps/api/src/modules/stats/reports.int.spec.ts`, khối `describe('kết quả kinh doanh', () => {`:

(a) Thay:

```ts
    const DEP_JUNE = 'e9600004-0000-4000-8000-000000000004';
```

bằng:

```ts
    const DEP_JUNE = 'e9600004-0000-4000-8000-000000000004';
    const DEP_GOODWILL = 'e9600004-0000-4000-8000-000000000005';
```

(b) Thay:

```ts
        `DELETE FROM tour_departures WHERE id IN ('${DEP_RAN}','${DEP_EMPTY}','${DEP_CANCELLED}','${DEP_JUNE}')`,
```

bằng:

```ts
        `DELETE FROM tour_departures WHERE id IN ('${DEP_RAN}','${DEP_EMPTY}','${DEP_CANCELLED}','${DEP_JUNE}','${DEP_GOODWILL}')`,
```

(c) Thay:

```ts
          departure(DEP_JUNE, '2026-06-15T00:00:00.000Z', '111.00'),
        ],
      });
```

bằng:

```ts
          departure(DEP_JUNE, '2026-06-15T00:00:00.000Z', '111.00'),
          // Chuyến chỉ có MỘT khách, người được hoàn thiện chí toàn bộ mà vẫn đi.
          departure(DEP_GOODWILL, '2026-05-22T00:00:00.000Z', '250.00'),
        ],
      });
```

(d) Thay `          // Khách huỷ: không đi, nên không góp doanh thu LẪN giá vốn biến đổi.` bằng:

```ts
          // Khách huỷ QUÁ hạn, không được hoàn: tiền giữ lại là doanh thu
          // (ADR-0041 §9), nhưng khách không đi nên không góp giá vốn biến đổi.
```

(e) Thay:

```ts
          pnlBooking(14, {
            departureId: DEP_CANCELLED,
            endIso: '2026-05-28T00:00:00.000Z',
            status: BookingStatus.PAID,
            total: '500.00',
            pax: 1,
            costPerPerson: '30.00',
          }),
        ],
      });
      await prisma.refund.create({
        data: {
          id: 'e9600006-0000-4000-8000-000000000001',
          bookingId: pnlBookingId(10),
          amount: '100.00',
          currency: 'USD',
          createdAt: at('2026-05-21T00:00:00.000Z'),
        },
      });
    });
```

bằng:

```ts
          pnlBooking(14, {
            departureId: DEP_CANCELLED,
            endIso: '2026-05-28T00:00:00.000Z',
            status: BookingStatus.PAID,
            total: '500.00',
            pax: 1,
            costPerPerson: '30.00',
          }),
          // Hoàn thiện chí TOÀN BỘ nhưng khách vẫn đi (REFUNDED): góp 0 doanh thu,
          // còn giá vốn biến đổi VÀ tiền xe của chuyến vẫn phải tính.
          pnlBooking(15, {
            departureId: DEP_GOODWILL,
            endIso: '2026-05-22T00:00:00.000Z',
            status: BookingStatus.REFUNDED,
            total: '300.00',
            pax: 2,
            costPerPerson: '30.00',
          }),
        ],
      });
      await prisma.refund.createMany({
        data: [
          {
            id: 'e9600006-0000-4000-8000-000000000001',
            bookingId: pnlBookingId(10),
            amount: '100.00',
            currency: 'USD',
            createdAt: at('2026-05-21T00:00:00.000Z'),
          },
          {
            id: 'e9600006-0000-4000-8000-000000000002',
            bookingId: pnlBookingId(15),
            amount: '300.00',
            currency: 'USD',
            createdAt: at('2026-05-15T00:00:00.000Z'),
          },
        ],
      });
    });
```

(f) Thay trọn các ca từ `    it('doanh thu ghi nhận neo NGÀY CHUYẾN KẾT THÚC, không ngày trả tiền', async () => {` tới hết `    it('lợi nhuận gộp và biên khớp với ba con số ở trên', async () => { … });`. Khối này hiện có bảy ca:
- hai ca `chuyến ế trong lịch…` và `đếm booking thiếu giá vốn…` được viết lại nguyên văn;
- ca `booking đã huỷ không góp doanh thu lẫn giá vốn biến đổi` bị thay;
- thêm một ca mới `khách được hoàn thiện chí TOÀN BỘ…`.

Thay bằng:

```ts
    it('doanh thu ghi nhận neo NGÀY CHUYẾN KẾT THÚC, không ngày trả tiền', async () => {
      // Cả sáu booking trả tiền tháng 4; chuyến thì kết thúc tháng 5. Cột dòng
      // tiền thấy tháng 4, cột kinh doanh thấy tháng 5 — hai cách đọc đứng
      // cạnh nhau chứ không thay nhau.
      const may = await report('2026-05');

      expect(may.revenue).toBe('0.00'); // không payment nào TRONG tháng 5
      // 900 + 900 + 600 (booking 12, tiền giữ lại) + 300 + 300 (booking 15)
      // − 100 − 300 đã hoàn = 2600.00. Booking 14 (khách vẫn PAID trên CHUYẾN
      // BỊ HUỶ) KHÔNG góp: tiền ấy đang nợ khách, không phải doanh thu
      // (ADR-0033 AMEND 1a).
      expect(may.recognizedRevenue).toBe('2600.00');
      // Và nhãn tiền lấy từ chính tập này dù tháng không có payment nào.
      expect(may.currency).toBe('USD');
    });

    it('chuyến bị HUỶ không góp doanh thu lẫn giá vốn, cùng định nghĩa với cogsFixed', async () => {
      // Trước AMEND 1a chuyến huỷ góp 500 doanh thu + 30 giá vốn biến đổi mà 0
      // tiền xe → càng huỷ nhiều chuyến báo cáo càng đẹp.
      const may = await report('2026-05');
      expect(may.cogsVariable).toBe('240.00');
      expect(may.departuresRun).toBe(2);
    });

    it('booking huỷ quá hạn (giữ 100%) vào doanh thu nhưng KHÔNG vào giá vốn biến đổi', async () => {
      const withCancelled = await report('2026-05');
      await prisma.booking.delete({ where: { id: pnlBookingId(12) } });
      const without = await report('2026-05');

      // Đúng 600.00 tiền giữ lại rời doanh thu; hai vế của khách thực đi đứng yên.
      expect(Number(withCancelled.recognizedRevenue) - Number(without.recognizedRevenue)).toBe(600);
      expect(withCancelled.cogsVariable).toBe(without.cogsVariable);
      expect(withCancelled.costDataMissing).toBe(without.costDataMissing);
    });

    it('khách được hoàn thiện chí TOÀN BỘ mà vẫn đi: giá vốn biến đổi và tiền xe vẫn tính', async () => {
      const may = await report('2026-05');
      // 30 × 3 + 30 × 3 (booking 10, 11) + 0 (booking 13 thiếu giá vốn)
      // + 30 × 2 (booking 15, REFUNDED) = 240.00.
      expect(may.cogsVariable).toBe('240.00');
      // DEP_GOODWILL chỉ có booking 15 mà vẫn là chuyến ĐÃ CHẠY: 400 + 250.
      expect(may.cogsFixed).toBe('650.00');
    });

    it('giá vốn cố định tính MỘT lần cho chuyến ĐÃ CHẠY', async () => {
      const may = await report('2026-05');

      // DEP_RAN + DEP_GOODWILL: chuyến ế không ai đặt và chuyến bị huỷ đều không tính.
      expect(may.cogsFixed).toBe('650.00');
      expect(may.departuresRun).toBe(2);
      expect(may.cogsTotal).toBe('890.00');
      // Mọi chuyến trong fixture đều khai tiền xe.
      expect(may.departuresCostMissing).toBe(0);
    });

    it('chuyến ế trong lịch KHÔNG bị tính tiền xe', async () => {
      // Thiếu vế EXISTS thì một tour đăng 52 chuyến cả năm mà bán được 6 sẽ
      // báo lỗ nặng từ hư không.
      const may = await report('2026-05');

      expect(Number(may.cogsFixed)).toBeLessThan(999);
    });

    it('đếm booking thiếu giá vốn thay vì im lặng coi bằng 0', async () => {
      expect((await report('2026-05')).costDataMissing).toBe(1);
    });

    it('lợi nhuận gộp và biên khớp với ba con số ở trên', async () => {
      const may = await report('2026-05');

      // 2600.00 − 890.00 = 1710.00
      expect(may.grossProfit).toBe('1710.00');
      expect(may.grossMarginPct).toBeCloseTo(1710 / 2600, 6);
      // Suất thuế và phí mặc định 0 ở môi trường test → ròng bằng gộp.
      expect(may.taxRate).toBe(0);
      expect(may.taxAmount).toBe('0.00');
      expect(may.paymentFees).toBe('0.00');
      expect(may.netProfit).toBe('1710.00');
    });
```

Ca `tháng không có chuyến nào chạy: biên gộp NULL, không phải 0` giữ nguyên.

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Docker Postgres phải đang chạy.

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/stats/reports.int.spec.ts`

Expected: FAIL sáu ca của khối `kết quả kinh doanh`, vì SQL cũ chỉ đếm PAID/PARTIALLY_REFUNDED:

| Ca | Mong đợi | Thực tế (SQL cũ) |
| --- | --- | --- |
| `doanh thu ghi nhận…` | `'2600.00'` | `'2000.00'` |
| `chuyến bị HUỶ…` | `'240.00'` | `'180.00'` |
| `booking huỷ quá hạn…` | chênh 600 | chênh 0 |
| `khách được hoàn thiện chí TOÀN BỘ…` | `'240.00'` | `'180.00'` |
| `giá vốn cố định…` | `'650.00'` | `'400.00'` |
| `lợi nhuận gộp…` | `'1710.00'` | `'1420.00'` |

- [ ] **Step 3: Viết lại hai câu SQL của P&L**

Trong `apps/api/src/modules/stats/stats-aggregates.ts`, thay trọn `recognizedRevenueSlice` và `fixedCostSlice`. Phạm vi: từ JSDoc `/**` có dòng ` * Cột KẾT QUẢ KINH DOANH của báo cáo (ADR-0033 §1) — neo \`departure_end_date\`,` tới hết `}` đóng `fixedCostSlice`. Thay bằng:

```ts
/**
 * Cột KẾT QUẢ KINH DOANH của báo cáo (ADR-0033 §1) — neo `departure_end_date`,
 * tức những chuyến KẾT THÚC trong kỳ, chứ không phải tiền vào trong kỳ.
 *
 * Hai tập, định nghĩa ở ADR-0041 §9 (sửa ADR-0033 §4):
 * - **Doanh thu**: MỌI booking đã trả tiền (`paid_at IS NOT NULL`), kể cả booking
 *   khách đã huỷ — tiền giữ lại của lần huỷ quá hạn là doanh thu, còn lần huỷ
 *   trong hạn đã hoàn trọn nên tự góp 0.
 * - **Khách thực đi** (cờ `travelled`): đã trả tiền VÀ trạng thái khác CANCELLED
 *   — gồm cả REFUNDED do hoàn thiện chí toàn bộ mà vẫn đi. Giá vốn biến đổi và
 *   `cost_missing` chỉ đếm tập này: khách huỷ không ăn suất ăn nào. Chi phí CỐ
 *   ĐỊNH ở `fixedCostSlice`.
 * - **Phí cổng** (`gross_collected`, `bookings`) tính trên tập DOANH THU: cổng
 *   thu phí lúc thanh toán và không trả lại khi hoàn hay huỷ (ADR-0033 §Giới
 *   hạn #3), nên booking đã huỷ vẫn phát sinh phí.
 *
 * MỘT câu SQL trả sáu con số vì chúng phải chụp CÙNG một khoảnh khắc: các câu
 * rời sẽ cho `costMissing` thuộc một tập booking còn `revenue` thuộc tập khác
 * (cùng bài học đã ghi ở `subscribersStats`). CTE `paid` dựng cờ `travelled`
 * MỘT lần, nên định nghĩa "khách thực đi" không bị chép vào từng `FILTER`.
 *
 * `LEFT JOIN` gộp refund theo booking thay vì join thẳng bảng `refunds`: một
 * booking hoàn NHIỀU lần được, và join thẳng sẽ nhân `total_amount` theo số
 * dòng hoàn.
 *
 * Chuyến bị HUỶ không góp gì (ADR-0033 AMEND 1a): tiền khách đã trả cho chuyến
 * không chạy là tiền đang NỢ khách, không phải doanh thu. Cùng vế
 * `d.status <> CANCELLED` với `fixedCostSlice`, nên "chuyến đã chạy" chỉ có MỘT
 * định nghĩa trong cả kỳ.
 *
 * ⚠️ KHÔNG BẤT ĐỘNG theo kỳ (ADR-0033 *Giới hạn* #5): `refunded` gộp MỌI dòng
 * hoàn của booking không kể `created_at`, và `status` là trạng thái HIỆN TẠI.
 * Một khoản hoàn tháng 7 làm báo cáo tháng 5 đọc lại ra số khác. Chữa thật cần
 * cột snapshot theo kỳ — ghi nợ, chưa làm.
 */
export async function recognizedRevenueSlice(from: Date, to: Date) {
  const [row] = await prisma.$queryRaw<
    {
      revenue: Prisma.Decimal | null;
      cogs_variable: Prisma.Decimal | null;
      gross_collected: Prisma.Decimal | null;
      bookings: bigint;
      cost_missing: bigint;
      currency: string | null;
    }[]
  >(Prisma.sql`
    WITH paid AS (
      SELECT b.total_amount - COALESCE(r.refunded, 0) AS kept,
             b.total_amount,
             b.cost_per_person,
             b.num_adults + b.num_children AS pax,
             b.currency,
             -- Khách thực đi (Hợp đồng D): đã trả tiền và không huỷ.
             b.status <> ${BookingStatus.CANCELLED}::"BookingStatus" AS travelled
      FROM bookings b
      JOIN tour_departures d ON d.id = b.departure_id
      LEFT JOIN (
        SELECT booking_id, SUM(amount) AS refunded FROM refunds GROUP BY booking_id
      ) r ON r.booking_id = b.id
      WHERE b.paid_at IS NOT NULL
        AND d.status <> ${DepartureStatus.CANCELLED}::"DepartureStatus"
        AND b.departure_end_date >= ${from} AND b.departure_end_date < ${to}
    )
    SELECT
      COALESCE(SUM(kept), 0) AS revenue,
      COALESCE(SUM(COALESCE(cost_per_person, 0) * pax) FILTER (WHERE travelled), 0)
        AS cogs_variable,
      COALESCE(SUM(total_amount), 0) AS gross_collected,
      COUNT(*) AS bookings,
      COUNT(*) FILTER (WHERE travelled AND cost_per_person IS NULL) AS cost_missing,
      -- Nhãn tiền của TẬP NÀY (nền tảng một-đồng-tiền, xem grossAmount):
      -- tháng không có payment/refund nào nhưng có chuyến chạy từng bị dán
      -- 'USD' mặc định lên cả khối P&L (vòng vá review 05/09).
      MAX(currency) AS currency
    FROM paid
  `);

  return {
    revenue: row?.revenue ?? new Prisma.Decimal(0),
    cogsVariable: row?.cogs_variable ?? new Prisma.Decimal(0),
    // Tiền GỐC của MỌI booking đã trả, trước khi trừ hoàn — phí cổng tính trên
    // số này, và provider không trả lại phí khi hoàn hay huỷ (ADR-0033 §Giới hạn #3).
    grossCollected: row?.gross_collected ?? new Prisma.Decimal(0),
    bookings: Number(row?.bookings ?? 0),
    costMissing: Number(row?.cost_missing ?? 0),
    currency: row?.currency ?? null,
  };
}

/**
 * Giá vốn CỐ ĐỊNH của các chuyến đã chạy trong kỳ (ADR-0033 §4) — cộng MỘT lần
 * cho mỗi chuyến, bất kể bán được bao nhiêu ghế. Xe vẫn chạy.
 *
 * "Đã chạy" phải có ĐỦ hai vế: chuyến không bị huỷ, VÀ có ít nhất một khách
 * THỰC ĐI — cùng tập `travelled` của `recognizedRevenueSlice` (đã trả tiền,
 * trạng thái khác CANCELLED; ADR-0041 §9). Thiếu vế `EXISTS` thì mọi chuyến ế
 * trong lịch đều bị tính tiền xe — một tour đăng 52 chuyến cả năm mà bán được
 * 6 sẽ báo lỗ nặng từ hư không. Chuyến mà mọi khách đều đã huỷ thì không chạy,
 * dù tiền giữ lại của họ vẫn vào doanh thu.
 */
export async function fixedCostSlice(from: Date, to: Date) {
  const [row] = await prisma.$queryRaw<
    { total: Prisma.Decimal | null; departures: bigint; cost_missing: bigint }[]
  >(
    // `cost_missing` ĐẾM chuyến chưa khai giá vốn cố định thay vì để COALESCE
    // im lặng coi bằng 0 (ADR-0033 §3: "báo cáo phải nói ra là thiếu").
    Prisma.sql`
      SELECT COALESCE(SUM(d.fixed_cost_amount), 0) AS total, COUNT(*) AS departures,
             COUNT(*) FILTER (WHERE d.fixed_cost_amount IS NULL) AS cost_missing
      FROM tour_departures d
      WHERE d.status <> ${DepartureStatus.CANCELLED}::"DepartureStatus"
        AND d.end_date >= ${from} AND d.end_date < ${to}
        AND EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.departure_id = d.id
            AND b.paid_at IS NOT NULL
            AND b.status <> ${BookingStatus.CANCELLED}::"BookingStatus"
        )
    `,
  );

  return {
    total: row?.total ?? new Prisma.Decimal(0),
    departures: Number(row?.departures ?? 0),
    costMissing: Number(row?.cost_missing ?? 0),
  };
}
```

Trong `apps/api/src/modules/stats/reports.service.ts`, thay:

```ts
    const fees = paymentFees(
      // Phí trả trên tiền GỐC, trước khi trừ hoàn — provider không trả lại phí
      // khi hoàn (ADR-0033 §Giới hạn #3).
      recognised.grossCollected,
```

bằng:

```ts
    const fees = paymentFees(
      // Phí trả trên tiền GỐC, trước khi trừ hoàn — provider không trả lại phí
      // khi hoàn hay huỷ (ADR-0033 §Giới hạn #3). Tiền gốc và số giao dịch cùng
      // là tập doanh thu (mọi booking đã trả tiền), kể cả booking đã huỷ.
      recognised.grossCollected,
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/stats/reports.int.spec.ts`
Expected: PASS toàn file.

- [ ] **Step 5: Viết test đỏ cho hai bộ đếm huỷ ở contract**

Trong `libs/shared/contract/src/schemas/reports.spec.ts`:

(a) Trong `validReport`, thay:

```ts
  cancellationsApproved: 1,
  cancellationsDenied: 3,
```

bằng:

```ts
  cancellationsWithinDeadline: 1,
  cancellationsAfterDeadline: 3,
```

(b) Thêm vào cuối `describe('AdminMonthlyReportSchema', () => { … })`, ngay sau ca `mọi phép đếm là số nguyên không âm`:

```ts
  it('ADR-0041 §9: hai bộ đếm huỷ theo hạn chót thay cặp approved/denied', () => {
    expect(Object.keys(AdminMonthlyReportSchema.shape)).toEqual(
      expect.arrayContaining(['cancellationsWithinDeadline', 'cancellationsAfterDeadline']),
    );
    // Luồng duyệt huỷ đã gỡ — không còn "được duyệt" hay "bị từ chối" để đếm.
    expect('cancellationsApproved' in AdminMonthlyReportSchema.shape).toBe(false);
    expect('cancellationsDenied' in AdminMonthlyReportSchema.shape).toBe(false);
    expect(
      AdminMonthlyReportSchema.safeParse({ ...validReport, cancellationsAfterDeadline: -1 })
        .success,
    ).toBe(false);
    expect(
      AdminMonthlyReportSchema.safeParse({ ...validReport, cancellationsWithinDeadline: 1.5 })
        .success,
    ).toBe(false);
  });
```

- [ ] **Step 6: Chạy test, xác nhận đỏ**

Run: `pnpm --filter @tourism/contract exec vitest run src/schemas/reports.spec.ts`

Expected: FAIL.
- Ca mới `ADR-0041 §9: hai bộ đếm huỷ…` đỏ: `shape` chưa có hai khoá mới.
- Các ca parse `validReport` (ví dụ `nhận một báo cáo đầy đủ`) đỏ: thiếu `cancellationsApproved`/`cancellationsDenied` bắt buộc.

- [ ] **Step 7: Đổi hai field ở contract báo cáo**

Trong `libs/shared/contract/src/schemas/reports.ts`:

(a) Thay:

```ts
  /** Request huỷ được duyệt trong tháng (theo `decided_at`). */
  cancellationsApproved: z.int().nonnegative(),
  /** Request huỷ bị từ chối trong tháng (theo `decided_at`). */
  cancellationsDenied: z.int().nonnegative(),
```

bằng:

```ts
  /**
   * Lần huỷ TRONG hạn chót trong tháng (ADR-0041 §9): yêu cầu REFUNDED có
   * `decided_at` trong kỳ, xếp loại bằng `isWithinDeadline` trên `created_at`
   * của yêu cầu cùng ngày đi, ngày về của booking. Luật N chỉ sống ở Node nên
   * phép xếp loại chạy ở API, không viết lại trong SQL.
   */
  cancellationsWithinDeadline: z.int().nonnegative(),
  /** Lần huỷ QUÁ hạn chót trong tháng — cùng tập, vế còn lại của phép xếp loại. */
  cancellationsAfterDeadline: z.int().nonnegative(),
```

(b) Thay:

```ts
  /** Σ (`totalAmount` − đã hoàn) của booking đã đi, chuyến KẾT THÚC trong kỳ. */
  recognizedRevenue: DecimalStringSchema,
  /** Giá vốn theo đầu khách của chính tập booking ấy — đi theo khách. */
  cogsVariable: DecimalStringSchema,
```

bằng:

```ts
  /**
   * Σ (`totalAmount` − đã hoàn) của MỌI booking đã trả tiền trên chuyến không
   * bị huỷ, chuyến KẾT THÚC trong kỳ — kể cả booking khách đã huỷ: tiền giữ lại
   * là doanh thu (ADR-0041 §9, sửa ADR-0033).
   */
  recognizedRevenue: DecimalStringSchema,
  /**
   * Giá vốn theo đầu khách của KHÁCH THỰC ĐI: booking đã trả tiền, trạng thái
   * khác CANCELLED — gồm cả REFUNDED do hoàn thiện chí toàn bộ mà vẫn đi.
   */
  cogsVariable: DecimalStringSchema,
```

(c) Thay:

```ts
  /**
   * Số booking trong kỳ KHÔNG có `cost_per_person`.
```

bằng:

```ts
  /**
   * Số booking của khách thực đi trong kỳ KHÔNG có `cost_per_person` — cùng tập
   * với `cogsVariable`.
```

- [ ] **Step 8: Chạy test contract, xác nhận xanh, rồi build**

Run: `pnpm --filter @tourism/contract exec vitest run src/schemas/reports.spec.ts`
Expected: PASS.

Run: `pnpm --filter @tourism/contract build && pnpm --filter @tourism/i18n build`
Expected: cả hai build xong.

- [ ] **Step 9: Viết int test đỏ cho hai bộ đếm huỷ**

Trong `apps/api/src/modules/stats/reports.int.spec.ts`:

(a) Trong ca `tháng trống là một báo cáo TOÀN SỐ 0, không phải 404`, thay:

```ts
      cancellationsApproved: 0,
      cancellationsDenied: 0,
```

bằng:

```ts
      cancellationsWithinDeadline: 0,
      cancellationsAfterDeadline: 0,
```

(b) Trong `beforeEach` của `describe('với dữ liệu ở cả ba tháng', …)`, xoá trọn lời gọi `await prisma.cancellationRequest.createMany({ data: [ … ] });` (ba yêu cầu `e9600004-…-000000000001/2/3`, dòng 329–360) cùng dòng trống sau nó.

(c) Trong cùng describe, xoá trọn ca:

```ts
    it('cancellations đếm theo decided_at — mở tháng này quyết tháng sau thuộc tháng sau', async () => {
      const may = await report();
      expect(may.cancellationsApproved).toBe(1);
      expect(may.cancellationsDenied).toBe(1);

      const june = await report('2026-06');
      expect(june.cancellationsDenied).toBe(1);
      expect(june.cancellationsApproved).toBe(0);
    });

```

(d) Thêm khối mới ngay sau `});` đóng `describe('với dữ liệu ở cả ba tháng', …)`, trước JSDoc `Cột KẾT QUẢ KINH DOANH (ADR-0033 §1)`:

```ts
  /**
   * Hai bộ đếm huỷ (ADR-0041 §9, Hợp đồng D). Mốc đem so là `created_at` của
   * yêu cầu, ngày chót suy từ ngày đi, ngày về SNAPSHOT của booking — nên mỗi
   * booking ở đây mang ngày chuyến CỐ ĐỊNH, không dùng `dep` (+45 ngày tính từ
   * hôm nay) như các khối trên.
   */
  describe('huỷ trong hạn và quá hạn chót (ADR-0041 §9)', () => {
    /** Booking với ngày chuyến đặt tay; hạn chót suy từ chính hai ngày này. */
    function tripBooking(
      n: number,
      status: BookingStatus,
      startDate: string,
      endDate: string,
    ): Prisma.BookingCreateManyInput {
      return {
        ...booking(n, {
          status,
          total: '100.00',
          createdAt: at('2026-04-01T00:00:00.000Z'),
          paidAt: at('2026-04-01T01:00:00.000Z'),
        }),
        departureStartDate: at(`${startDate}T00:00:00.000Z`),
        departureEndDate: at(`${endDate}T00:00:00.000Z`),
      };
    }

    function cancellation(
      n: number,
      row: {
        bookingN: number;
        status: CancellationRequestStatus;
        createdAt: string;
        decidedAt: string | null;
      },
    ): Prisma.CancellationRequestCreateManyInput {
      return {
        id: `e9600007-0000-4000-8000-${String(n).padStart(12, '0')}`,
        bookingId: bookingId(row.bookingN),
        userId: customerId,
        reason: null,
        status: row.status,
        createdAt: at(row.createdAt),
        decidedAt: row.decidedAt === null ? null : at(row.decidedAt),
      };
    }

    beforeEach(async () => {
      await prisma.booking.createMany({
        data: [
          // Chuyến 2 ngày 20–21/05: N = 3 → ngày chót 17/05.
          tripBooking(21, BookingStatus.CANCELLED, '2026-05-20', '2026-05-21'),
          tripBooking(22, BookingStatus.CANCELLED, '2026-05-20', '2026-05-21'),
          // Chuyến 1 ngày 26/05: N = 1 → ngày chót 25/05.
          tripBooking(23, BookingStatus.CANCELLED, '2026-05-26', '2026-05-26'),
          // Hai booking mang yêu cầu của luồng duyệt cũ — không huỷ gì.
          tripBooking(24, BookingStatus.PAID, '2026-05-20', '2026-05-21'),
          tripBooking(25, BookingStatus.PAID, '2026-05-20', '2026-05-21'),
          // Chuyến 5 ngày 20–24/06: N = 7 → ngày chót 13/06.
          tripBooking(26, BookingStatus.CANCELLED, '2026-06-20', '2026-06-24'),
        ],
      });
      await prisma.cancellationRequest.createMany({
        data: [
          // 23:59:59 ngày 17/05 giờ Việt Nam — giây CUỐI của ngày chót: trong hạn.
          cancellation(1, {
            bookingN: 21,
            status: CancellationRequestStatus.REFUNDED,
            createdAt: '2026-05-17T16:59:59.000Z',
            decidedAt: '2026-05-17T16:59:59.000Z',
          }),
          // 00:00 ngày 18/05 giờ Việt Nam: quá hạn.
          cancellation(2, {
            bookingN: 22,
            status: CancellationRequestStatus.REFUNDED,
            createdAt: '2026-05-17T17:00:00.000Z',
            decidedAt: '2026-05-17T17:00:00.000Z',
          }),
          // 01:00 ngày 26/05 giờ Việt Nam trong khi UTC vẫn là 25/05: QUÁ hạn.
          // Thước UTC cũ sẽ xếp nhầm ca này vào "trong hạn".
          cancellation(3, {
            bookingN: 23,
            status: CancellationRequestStatus.REFUNDED,
            createdAt: '2026-05-25T18:00:00.000Z',
            decidedAt: '2026-05-25T18:00:00.000Z',
          }),
          // Dữ liệu luồng duyệt cũ: DENIED quyết trong tháng 5, REQUESTED chưa quyết.
          cancellation(4, {
            bookingN: 24,
            status: CancellationRequestStatus.DENIED,
            createdAt: '2026-05-02T03:00:00.000Z',
            decidedAt: '2026-05-03T03:00:00.000Z',
          }),
          cancellation(5, {
            bookingN: 25,
            status: CancellationRequestStatus.REQUESTED,
            createdAt: '2026-05-04T03:00:00.000Z',
            decidedAt: null,
          }),
          // Gửi tháng 5 nhưng QUYẾT tháng 6 — thuộc báo cáo tháng 6; trong hạn (13/06).
          cancellation(6, {
            bookingN: 26,
            status: CancellationRequestStatus.REFUNDED,
            createdAt: '2026-05-30T03:00:00.000Z',
            decidedAt: '2026-06-02T03:00:00.000Z',
          }),
        ],
      });
    });

    it('đếm theo decided_at; xếp loại theo giờ Việt Nam trên created_at của yêu cầu', async () => {
      const may = await report('2026-05');
      expect(may.cancellationsWithinDeadline).toBe(1);
      expect(may.cancellationsAfterDeadline).toBe(2);
    });

    it('yêu cầu gửi tháng này, quyết tháng sau thuộc tháng sau', async () => {
      const june = await report('2026-06');
      expect(june.cancellationsWithinDeadline).toBe(1);
      expect(june.cancellationsAfterDeadline).toBe(0);
    });

    it('DENIED và REQUESTED của luồng duyệt cũ không phải lần huỷ nào', async () => {
      // Tháng 5 có năm yêu cầu tạo hoặc quyết trong tháng, nhưng chỉ ba lần huỷ thật.
      const may = await report('2026-05');
      expect(may.cancellationsWithinDeadline + may.cancellationsAfterDeadline).toBe(3);
      const april = await report('2026-04');
      expect(april.cancellationsWithinDeadline + april.cancellationsAfterDeadline).toBe(0);
    });
  });
```

- [ ] **Step 10: Chạy test, xác nhận đỏ**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/stats/reports.int.spec.ts`

Expected: FAIL.
- Mọi ca gọi `report()` nhận 500 thay vì 200. API vẫn trả `cancellationsApproved`/`cancellationsDenied`, nên output không qua `AdminMonthlyReportSchema` vừa build (thiếu `cancellationsWithinDeadline`).
- Hai ca guard 401/403 và `month sai định dạng → 400` vẫn PASS.

- [ ] **Step 11: Cài `cancellationOutcomesSlice`, nối vào báo cáo tháng**

Trong `apps/api/src/modules/stats/stats-aggregates.ts`:

(a) Thay khối import đầu file:

```ts
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  BookingStatus,
  CancellationRequestStatus,
  DepartureStatus,
  EnquiryStatus,
  OutboxStatus,
} from '../../generated/prisma/enums.js';
import type { DayRow } from './stats-math.js';
```

bằng:

```ts
import { isWithinDeadline } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  BookingStatus,
  CancellationRequestStatus,
  DepartureStatus,
  EnquiryStatus,
  OutboxStatus,
} from '../../generated/prisma/enums.js';
import { calendarDate } from '../../lib/calendar-date.js';
import type { DayRow } from './stats-math.js';
```

(b) Thay trọn:

```ts
/** Hai con số quyết định cancellation của MỘT khoảng (theo `decidedAt`). */
export async function decisionsSlice(from: Date, to: Date) {
  const byStatus = await prisma.cancellationRequest.groupBy({
    by: ['status'],
    where: { decidedAt: { gte: from, lt: to } },
    _count: { _all: true },
  });
  const countOf = (status: CancellationRequestStatus) =>
    byStatus.find((group) => group.status === status)?._count._all ?? 0;
  return {
    approved: countOf(CancellationRequestStatus.REFUNDED),
    denied: countOf(CancellationRequestStatus.DENIED),
  };
}
```

bằng:

```ts
/**
 * Hai bộ đếm huỷ của MỘT khoảng (Hợp đồng D, ADR-0041 §9).
 *
 * Tập đếm là các yêu cầu `REFUNDED` có `decided_at` trong `[from, to)` — mỗi
 * lần khách huỷ ghi đúng một dòng như vậy. Mỗi dòng được xếp loại trong hay
 * quá hạn chót.
 *
 * Xếp loại ở NODE bằng `isWithinDeadline` của contract chứ không trong SQL:
 * luật N chỉ sống ở một chỗ (spec §4.1). Mốc đem so là `created_at` của yêu
 * cầu, tức lúc khách bấm huỷ, trên ngày đi, ngày về SNAPSHOT của booking. Dòng
 * `REQUESTED`/`DENIED` của luồng duyệt cũ không huỷ booking nào nên không đếm.
 *
 * Kéo từng dòng về thay vì `groupBy`: một tháng chỉ vài chục lần huỷ, và
 * `select` chỉ ba cột.
 */
export async function cancellationOutcomesSlice(
  from: Date,
  to: Date,
): Promise<{ withinDeadline: number; afterDeadline: number }> {
  const rows = await prisma.cancellationRequest.findMany({
    where: {
      status: CancellationRequestStatus.REFUNDED,
      decidedAt: { gte: from, lt: to },
    },
    select: {
      createdAt: true,
      booking: { select: { departureStartDate: true, departureEndDate: true } },
    },
  });

  let withinDeadline = 0;
  for (const row of rows) {
    const within = isWithinDeadline(
      row.createdAt,
      calendarDate(row.booking.departureStartDate),
      calendarDate(row.booking.departureEndDate),
    );
    if (within) withinDeadline += 1;
  }
  return { withinDeadline, afterDeadline: rows.length - withinDeadline };
}
```

Trong `apps/api/src/modules/stats/reports.service.ts`:

(a) Trong import từ `'./stats-aggregates.js'`, thay `  decisionsSlice,` bằng `  cancellationOutcomesSlice,` rồi đưa dòng này lên ngay sau `  bookingsCreatedByStatus,`, theo thứ tự chữ cái.

(b) Thay:

```ts
    const [
      paid,
      created,
      paidCurrency,
      refunds,
      refundsCurrency,
      decisions,
      reviewsApproved,
      recognised,
      fixedCost,
    ] = await Promise.all([
      paidBookingsSlice(from, to),
      bookingsCreatedByStatus(from, to),
      revenueCurrency(from, to),
      refundsSlice(from, to),
      refundCurrency(from, to),
      decisionsSlice(from, to),
```

bằng:

```ts
    const [
      paid,
      created,
      paidCurrency,
      refunds,
      refundsCurrency,
      cancellations,
      reviewsApproved,
      recognised,
      fixedCost,
    ] = await Promise.all([
      paidBookingsSlice(from, to),
      bookingsCreatedByStatus(from, to),
      revenueCurrency(from, to),
      refundsSlice(from, to),
      refundCurrency(from, to),
      cancellationOutcomesSlice(from, to),
```

(c) Thay:

```ts
      cancellationsApproved: decisions.approved,
      cancellationsDenied: decisions.denied,
```

bằng:

```ts
      cancellationsWithinDeadline: cancellations.withinDeadline,
      cancellationsAfterDeadline: cancellations.afterDeadline,
```

- [ ] **Step 12: Chạy test, typecheck API, xác nhận xanh**

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/stats/reports.int.spec.ts src/modules/stats/stats.int.spec.ts`
Expected: PASS cả hai file.

Run: `pnpm turbo run typecheck --filter=@tourism/api`
Expected: PASS.

- [ ] **Step 13: i18n — nhãn bảng vận hành và định nghĩa báo cáo**

Trong `libs/shared/i18n/src/lib/messages.ts`, khối `admin.reports`:

(a) Trong `operationsTable`, thay:

```ts
        cancellationsApproved: 'Cancellations approved',
        cancellationsDenied: 'Cancellations denied',
```

bằng:

```ts
        /** ADR-0041 §9: đếm theo ngày huỷ, xếp loại theo hạn chót của chuyến (giờ Việt Nam). */
        cancellationsWithinDeadline: 'Cancelled within the deadline',
        cancellationsAfterDeadline: 'Cancelled after the deadline',
```

(b) Trong `definitions`, thay:

```ts
        recognised:
          'Revenue recognised counts trips that finished this month, so it differs from cash collected — money for a December trip is taken today but earned in December.',
        costs:
          'Per-traveller costs follow the travellers who went; per-departure costs are charged once for each departure that ran, whether it sold out or not.',
        netProfit:
          'Net profit is after cost of sales, tax and payment fees. It does not include salaries, rent or marketing.',
      },
```

bằng:

```ts
        recognised:
          'Revenue recognised counts trips that finished this month, so it differs from cash collected — money for a December trip is taken today but earned in December. Money kept from a cancelled booking counts as revenue too.',
        costs:
          'Per-traveller costs follow the travellers who went, including anyone given a full goodwill refund; per-departure costs are charged once for each departure that ran with at least one traveller, whether it sold out or not.',
        netProfit:
          'Net profit is after cost of sales, tax and payment fees. It does not include salaries, rent or marketing.',
        /** ADR-0041 §9 — câu cho cặp bộ đếm huỷ ở bảng vận hành. */
        cancellations:
          'Cancellations are counted on the day they were made. Within the deadline means on or before the free-cancellation deadline of the trip (Vietnam time), with the unrefunded balance returned; after the deadline means no automatic refund.',
      },
```

- [ ] **Step 14: Build i18n**

Run: `pnpm --filter @tourism/i18n build`
Expected: build xong.

- [ ] **Step 15: Viết test đỏ phía admin**

Trong `apps/admin/src/lib/reports-view.spec.ts`:

(a) Trong fixture `report`, thay:

```ts
  cancellationsApproved: 1,
  cancellationsDenied: 3,
```

bằng:

```ts
  cancellationsWithinDeadline: 1,
  cancellationsAfterDeadline: 3,
```

(b) Trong ca `bảng metric/value phủ đủ tiền + vận hành`, thay:

```ts
    expect(byLabel[messages.admin.reports.operationsTable.cancellationsApproved]).toBe('1');
    expect(byLabel[messages.admin.reports.operationsTable.cancellationsDenied]).toBe('3');
```

bằng:

```ts
    expect(byLabel[messages.admin.reports.operationsTable.cancellationsWithinDeadline]).toBe('1');
    expect(byLabel[messages.admin.reports.operationsTable.cancellationsAfterDeadline]).toBe('3');
```

Trong `apps/admin/src/lib/xlsx.spec.ts`:

(a) Trong fixture `report`, thay:

```ts
  cancellationsApproved: 1,
  cancellationsDenied: 3,
```

bằng:

```ts
  cancellationsWithinDeadline: 1,
  cancellationsAfterDeadline: 3,
```

(b) Thêm ngay sau ca `sheet Bookings có dòng Total khớp \`newBookings\` của server`:

```ts
  it('sheet Operations đếm hai loại huỷ theo hạn chót (ADR-0041 §9), là Ô SỐ', async () => {
    const sheet = sheetNamed(await open(report), 'Operations');

    expect(cellFor(sheet, t.operationsTable.cancellationsWithinDeadline)?.value).toBe(1);
    expect(cellFor(sheet, t.operationsTable.cancellationsAfterDeadline)?.value).toBe(3);
  });
```

(c) Thay trọn ca `sheet Definitions mang đủ sáu câu, kể cả ba câu của cột kinh doanh` bằng:

```ts
  it('sheet Definitions mang đủ bảy câu, kể cả ba câu của cột kinh doanh và câu về huỷ', async () => {
    const sheet = sheetNamed(await open(report), 'Definitions');
    const text = JSON.stringify(sheet.getSheetValues());

    for (const line of [
      t.definitions.revenue,
      t.definitions.recognised,
      t.definitions.costs,
      t.definitions.netProfit,
      t.definitions.refunds,
      t.definitions.statuses,
      t.definitions.cancellations,
    ]) {
      expect(text).toContain(line.slice(0, 40));
    }
  });
```

- [ ] **Step 16: Chạy test admin, xác nhận đỏ**

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/reports-view.spec.ts src/lib/xlsx.spec.ts`

Expected: FAIL ba ca:
- `bảng metric/value phủ đủ tiền + vận hành`: `byLabel['Cancelled within the deadline']` là `undefined`.
- `sheet Operations đếm hai loại huỷ…`: không có dòng mang nhãn mới.
- `sheet Definitions mang đủ bảy câu…`: thiếu câu `definitions.cancellations`.

- [ ] **Step 17: Admin hiển thị hai bộ đếm và câu định nghĩa mới**

Trong `apps/admin/src/lib/reports-view.ts`, thay:

```ts
  {
    key: 'cancellationsApproved',
    label: o.cancellationsApproved,
    display: (r) => formatCount(r.cancellationsApproved),
  },
  {
    key: 'cancellationsDenied',
    label: o.cancellationsDenied,
    display: (r) => formatCount(r.cancellationsDenied),
  },
```

bằng:

```ts
  // ADR-0041 §9: cặp approved/denied của luồng duyệt cũ thành huỷ trong/quá hạn chót.
  {
    key: 'cancellationsWithinDeadline',
    label: o.cancellationsWithinDeadline,
    display: (r) => formatCount(r.cancellationsWithinDeadline),
  },
  {
    key: 'cancellationsAfterDeadline',
    label: o.cancellationsAfterDeadline,
    display: (r) => formatCount(r.cancellationsAfterDeadline),
  },
```

Trong `apps/admin/src/lib/xlsx.ts`:

(a) Trong `buildOperations`, thay:

```ts
    [o.cancellationsApproved, (cell) => count(cell, report.cancellationsApproved)],
    [o.cancellationsDenied, (cell) => count(cell, report.cancellationsDenied)],
```

bằng:

```ts
    [o.cancellationsWithinDeadline, (cell) => count(cell, report.cancellationsWithinDeadline)],
    [o.cancellationsAfterDeadline, (cell) => count(cell, report.cancellationsAfterDeadline)],
```

(b) Trong `buildDefinitions`, thay:

```ts
    t.definitions.refunds,
    t.definitions.statuses,
  ]) {
```

bằng:

```ts
    t.definitions.refunds,
    t.definitions.statuses,
    t.definitions.cancellations,
  ]) {
```

Trong `apps/admin/src/app/(admin)/reports/page.tsx`, thay:

```tsx
        <p>{t.definitions.statuses}</p>
```

bằng:

```tsx
        <p>{t.definitions.statuses}</p>
        <p>{t.definitions.cancellations}</p>
```

- [ ] **Step 18: Chạy test admin và typecheck, xác nhận xanh**

Run: `pnpm --filter @tourism/admin exec vitest run src/lib/reports-view.spec.ts src/lib/xlsx.spec.ts`
Expected: PASS cả hai file.

Run: `pnpm turbo run typecheck --filter=@tourism/contract --filter=@tourism/i18n --filter=@tourism/api --filter=@tourism/admin --concurrency=3`
Expected: PASS.

- [ ] **Step 19: Grep kiểm không còn tên cũ**

Run (Git Bash, từ gốc repo):

```bash
grep -rnE "cancellationsApproved|cancellationsDenied|decisionsSlice" apps libs \
  --include=*.ts --include=*.tsx --include=*.mjs \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=generated
```

Expected: không dòng nào.

- [ ] **Step 20: Biome và Cổng đầy đủ**

Run: `pnpm lint:fix`
Expected: không còn lỗi.

Run (Git Bash, Docker Postgres đang chạy):

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu lệnh xanh.

- [ ] **Step 21: Commit**

```bash
git add \
  libs/shared/contract/src/schemas/reports.ts \
  libs/shared/contract/src/schemas/reports.spec.ts \
  libs/shared/i18n/src/lib/messages.ts \
  apps/api/src/modules/stats/stats-aggregates.ts \
  apps/api/src/modules/stats/reports.service.ts \
  apps/api/src/modules/stats/reports.int.spec.ts \
  apps/admin/src/lib/reports-view.ts \
  apps/admin/src/lib/reports-view.spec.ts \
  apps/admin/src/lib/xlsx.ts \
  apps/admin/src/lib/xlsx.spec.ts \
  "apps/admin/src/app/(admin)/reports/page.tsx"
git status --short
```

Kiểm `git status --short`: không còn file nào của Task 9 chưa stage, không có `docs/screenshot/`.

```bash
git commit -F - <<'EOF'
feat(reports): đếm huỷ trong và quá hạn chót, P&L tính tiền giữ lại của booking đã huỷ

Báo cáo tháng thay cancellationsApproved/Denied bằng cancellationsWithinDeadline
và cancellationsAfterDeadline, xếp loại bằng isWithinDeadline trên created_at
của yêu cầu. P&L: doanh thu gồm mọi booking đã trả trên chuyến không huỷ, kể cả
booking khách đã huỷ; giá vốn biến đổi, số booking, cost_missing và điều kiện
chuyến đã chạy chỉ tính khách thực đi (đã trả, trạng thái khác CANCELLED).
Excel, bảng vận hành và phần định nghĩa của trang báo cáo đổi theo.
EOF
```
---

### Task 10: Web — trang tour và checkout theo hạn chót

**Files:**

Không tạo file mới, không xoá file nào. 27 file bị sửa (13 mã nguồn, 14 spec).

- Modify: `libs/shared/i18n/src/lib/messages.ts` — xoá `booking.wizard.soldOut` (dòng 382–387) và `booking.errors.DEPARTURE_NOT_OPEN` (397); thay trọn khối `checkoutSummary` (618–646, gồm `flexibleCancellation` 623 và khối con `cancellationAssurance` 636–645); nối ba khoá vào khối `cancellationDeadline` Task 7 tạo (ngay sau `checkoutSummary`); thay `tourDetail.departures.none/noneBody` và thêm `closed` (1523–1525); rút gọn `tourDetail.departuresTab` còn `cardGroup` + `groupCap`, xoá `freeUntil`/`afterFreeWindow`/`viewRefundSchedule`/`readFullPolicy` (1612–1625); `tourDetail.dialogs.onlyOpen` (1694).
- Modify: `apps/web/src/lib/tours.ts` — thêm `isDepartureOpen` ngay sau `departureStatus` (sau dòng 388)
- Test: `apps/web/src/lib/tours.spec.ts` — thêm `isDepartureOpen` vào khối import (dòng 18–41) và một `describe` mới
- Modify: `apps/web/src/lib/tour-detail.ts` (dòng 1 import, 12–17 `visibleDepartureChips`, 343–347 JSDoc + chữ ký `heroPrice`)
- Test: `apps/web/src/lib/tour-detail.spec.ts` (thay khối `visibleDepartureChips` dòng 38–57; thêm `bookable` vào `PRICED_TOUR` dòng 340–366 và hai đợt `early`/`late`; thêm một test `heroPrice`)
- Modify: `apps/web/src/components/tours/departure-selection.tsx` (dòng 3–6 import, 67–72 state khởi tạo)
- Modify: `apps/web/src/components/tours/tour-media-panel.tsx` (dòng 3 import, 331–349 hàng ô "trust")
- Test: `apps/web/src/components/tours/tour-media-panel.spec.tsx` (fixture `DEPARTURES` dòng 25–49; thay test dòng 177–184; thêm một test)
- Modify: `apps/web/src/components/tours/departure-dialog.tsx` (dòng 11–14 import, 51 bộ lọc, 158–221 hàng đợt)
- Test: `apps/web/src/components/tours/departure-dialog.spec.tsx` (fixture dòng 13–37; thay test "only open" dòng 92–98; thêm hai test)
- Modify: `apps/web/src/components/tours/panels/departures-panel.tsx` (dòng 1–24 import, 85–114 `SeatBadge`, 181–183 ô thống kê, 349–361 chỗ dựng `DepartureRow`, 388–458 `BookingPolicyCards`, 494–586 `DepartureRow`)
- Test: `apps/web/src/components/tours/panels/departures-panel.spec.tsx` (fixture `DEPARTURES`/`TOUR` dòng 24–99; thay ba test thẻ chính sách dòng 211–240; thêm hai test hàng đợt)
- Modify: `apps/web/src/components/tours/panels/good-to-know-panel.tsx` (dòng 1–13 import, 27–29 thân hàm, 31–73 hàng thẻ policy)
- Test: `apps/web/src/components/tours/panels/good-to-know-panel.spec.tsx` (fixture `TOUR` dòng 22–32; thay test dòng 35–43 và 84–88; thêm một test)
- Test: `apps/web/src/components/tours/booking-rail.spec.tsx` (fixture `DEPARTURE` dòng 15–22; thêm một test copy mới). **`booking-rail.tsx` KHÔNG đổi code** — hai nhánh "không có đợt" đã đọc `departures.none/noneBody`, chỉ nội dung khoá đổi ở Step 4e.
- Test: `apps/web/src/components/tours/tour-hero.spec.tsx` (helper `dep` dòng 17–26; thêm một test)
- Test: `apps/web/src/components/tours/panels/itinerary-panel.spec.tsx` (fixture dòng 9–18)
- Modify: `apps/web/src/components/booking/checkout-summary.tsx` (dòng 1–13 import; xoá dòng 27–97 `CancellationAssuranceKind`/`CancellationAssurance`/`utcDayIndex`/`subtractDays`/`computeCancellationAssurance`; thay 99–125 `CancellationAssuranceLine` → `CancellationDeadlineLine`; dòng 217 chip; dòng 265–267 chỗ gọi)
- Test: `apps/web/src/components/booking/checkout-summary.spec.tsx` (import dòng 5–10; `makeDeparture` 11–21; thay test chip 113–138; xoá `describe('computeCancellationAssurance')` 188–227; thay `describe('… dòng trấn an …')` 229–307)
- Modify: `apps/web/src/components/booking/steps/step-review.tsx` (dòng 4 import, 60–67 khối cuối)
- Modify: `apps/web/src/components/booking/steps/step-dates.tsx` (dòng 1–6 import, 36–51 nút, 68–74 dòng phụ)
- Test: `apps/web/src/components/booking/steps/steps.spec.tsx` (fixture `DEPARTURE` dòng 17–24; thay test dòng 39–50; thêm một test)
- Modify: `apps/web/src/components/booking/booking-wizard.tsx` (dòng 22 import, 67–70 đợt chọn sẵn)
- Test: `apps/web/src/components/booking/booking-wizard.spec.tsx` (`makeDeparture` dòng 26–36; thay test dòng 81–89)
- Modify: `apps/web/src/app/(site)/tours/[slug]/book/page.tsx` (dòng 1–9 import, 39–42 điều kiện, 70–88 khối `SoldOut`)
- Modify: `apps/web/src/lib/booking-form.ts` (dòng 186)
- Test: `apps/web/src/lib/booking-form.spec.ts` (dòng 211–214)

**Interfaces:**

- Consumes:
  - Task 1 (`@tourism/contract`): `windowDaysForTripLength(tripDays: number): CancellationWindowDays`.
  - Task 5 (`@tourism/contract`, `TourDepartureSchema`): `bookingDeadline: string` (`YYYY-MM-DD`), `bookable: boolean` — đi thẳng vào `DepartureVM`.
  - Task 7 (`@tourism/i18n`): `messages.cancellationDeadline.full(date)`, `messages.cancellationDeadline.policyLink`, `messages.accountActionErrors.bookingClosed`.
- Produces:
  - `apps/web/src/lib/tours.ts`: `export function isDepartureOpen(departure: { bookable: boolean; seatsLeft: number }): boolean;`
  - `apps/web/src/components/booking/checkout-summary.tsx`: `export function CancellationDeadlineLine({ departure }: { departure: DepartureVM }): ReactNode;` (thay `CancellationAssuranceLine`; xoá `computeCancellationAssurance`, `CancellationAssurance`, `CancellationAssuranceKind`).
  - `@tourism/i18n`: `messages.cancellationDeadline.short(date: string)`, `.rule(days: number)`, `.ruleAfter`; `messages.tourDetail.departures.closed`; `messages.checkoutSummary.freeCancellation`.

- [ ] **Step 1: Kiểm tiền đề của Task 1, Task 5, Task 7**

```bash
grep -n "export function windowDaysForTripLength" libs/shared/contract/src/schemas/refund-policy.ts
grep -n "bookingDeadline: z.iso.date()\|bookable: z.boolean()" libs/shared/contract/src/schemas/catalog.ts
grep -n "cancellationDeadline: {\|policyLink: 'Read the cancellation policy'\|bookingClosed:" libs/shared/i18n/src/lib/messages.ts
```

Expected: lệnh 1 in một dòng; lệnh 2 in hai dòng; lệnh 3 in ba dòng. Thiếu dòng nào thì dừng, báo session gốc.

- [ ] **Step 2: Viết test đỏ cho logic thuần**

2a. `apps/web/src/lib/tours.spec.ts` — trong khối import từ `'./tours'` (dòng 18–41), chèn `isDepartureOpen,` ngay sau `formatTicketDate,`. Rồi chèn khối sau ngay TRƯỚC dòng `describe('formatDateRange', () => {`:

```ts
describe('isDepartureOpen — đợt chọn được để đặt', () => {
  it('còn hạn đặt và còn chỗ → chọn được', () => {
    expect(isDepartureOpen({ bookable: true, seatsLeft: 1 })).toBe(true);
  });

  it('đã qua hạn đặt → KHÔNG chọn được, dù còn chỗ', () => {
    // `bookable` do server tính theo ngày Việt Nam (ADR-0041 §7); web chỉ đọc cờ.
    expect(isDepartureOpen({ bookable: false, seatsLeft: 12 })).toBe(false);
  });

  it('hết chỗ → không chọn được, dù còn hạn đặt', () => {
    expect(isDepartureOpen({ bookable: true, seatsLeft: 0 })).toBe(false);
  });
});

```

2b. `apps/web/src/lib/tour-detail.spec.ts` — thay khối `describe('visibleDepartureChips', …)` (dòng 38–57) bằng:

```ts
describe('visibleDepartureChips', () => {
  const deps = [
    { id: 'a', seatsLeft: 6, bookable: true },
    { id: 'b', seatsLeft: 9, bookable: true },
    { id: 'c', seatsLeft: 3, bookable: true },
    { id: 'd', seatsLeft: 0, bookable: true },
    { id: 'e', seatsLeft: 8, bookable: true },
    { id: 'f', seatsLeft: 5, bookable: true },
  ];
  it('chỉ lấy đợt CÒN CHỖ, tối đa 4', () => {
    expect(visibleDepartureChips(deps, 'a').map((d) => d.id)).toEqual(['a', 'b', 'c', 'e']);
  });
  it('đợt đang chọn nằm ngoài 4 ô thì chen vào thay ô cuối', () => {
    // nếu không, panel hiện một đằng còn nút Reserve nói một nẻo
    expect(visibleDepartureChips(deps, 'f').map((d) => d.id)).toEqual(['a', 'b', 'c', 'f']);
  });
  it('đợt đang chọn đã hết chỗ thì KHÔNG chen vào', () => {
    expect(visibleDepartureChips(deps, 'd').map((d) => d.id)).toEqual(['a', 'b', 'c', 'e']);
  });
  it('đợt đã ngừng nhận đặt không chiếm ô nào, kể cả khi còn chỗ hoặc đang được chọn', () => {
    const withClosed = [{ id: 'z', seatsLeft: 10, bookable: false }, ...deps];
    expect(visibleDepartureChips(withClosed, 'z').map((d) => d.id)).toEqual(['a', 'b', 'c', 'e']);
  });
});
```

2c. Cùng file, trong `PRICED_TOUR` (dòng 340–366) thêm `bookable: true,` ngay sau dòng `seatsLeft: …,` của cả ba đợt `sep`, `oct`, `nov`. Trong test `'hoà giá thì đợt SỚM hơn (thứ tự mảng) thắng, mang giá gạch của chính nó'` thêm `bookable: true,` ngay sau `seatsLeft: 5,` của cả hai đợt `early` và `late`. Rồi chèn test sau ngay SAU test `'bỏ qua đợt hết chỗ; đợt rẻ nhất còn lại đúng giá gốc → không gạch'`:

```ts
  it('bỏ qua đợt đã ngừng nhận đặt dù rẻ nhất — khớp giá "from" của thẻ tour', () => {
    // Giá "from" của `catalog.tours.list` chỉ tính đợt còn hạn đặt; hero tính
    // khác đi là thẻ tour và trang tour in hai con số cho cùng một tour.
    const t = resolveDepartureAnchors({
      ...PRICED_TOUR,
      departures: PRICED_TOUR.departures.map((d) =>
        d.id === 'oct' ? { ...d, bookable: false } : d,
      ),
    });
    expect(heroPrice(t)).toEqual({ price: '129.00', compareAtPrice: null });
  });
```

- [ ] **Step 3: Chạy test, xác nhận đỏ**

Run: `pnpm --filter @tourism/web exec vitest run src/lib/tours.spec.ts src/lib/tour-detail.spec.ts`
Expected: FAIL — `isDepartureOpen` không phải export của `./tours`; ca `z` của `visibleDepartureChips` trả `['z', 'a', 'b', 'c']`; ca heroPrice đợt đóng trả `119.00`.

- [ ] **Step 4: Sửa copy ở `libs/shared/i18n/src/lib/messages.ts`** (bảy chỗ)

4a. `booking.wizard` — trước (dòng 379–387):

```ts
      payCta: (total: string) => `Pay ${total}`,
      // Tour hết sạch chỗ: KHÔNG dựng wizard rỗng. Thay hành vi tự-rơi-về-Private
      // của `BookingModes` (gỡ 18/08 khi hai nhánh tách trang).
      soldOut: {
        heading: 'This trip is fully booked',
        body: 'Every scheduled departure is sold out. We can still run it on your own dates — tell us when, and we’ll quote within 24h.',
        cta: 'Request a private trip',
      },
    },
```

sau:

```ts
      payCta: (total: string) => `Pay ${total}`,
    },
```

4b. `booking.errors` — xoá đúng dòng 397:

```ts
      DEPARTURE_NOT_OPEN: 'That departure is no longer open for booking.',
```

4c. Thay trọn khối `checkoutSummary` (từ `  checkoutSummary: {` tới dấu `  },` ngay trước khối `cancellationDeadline` của Task 7) bằng:

```ts
  checkoutSummary: {
    heading: 'Order summary',
    // Mọi tour huỷ miễn phí tới ngày chót của chuyến (ADR-0041), nên chip nói
    // thẳng điều đó; ngày chót cụ thể in ngay dưới CTA (`cancellationDeadline.full`).
    // Chip trung tính "Flexible cancellation" cũ tồn tại vì bảng bậc không giữ
    // được lời hứa hoàn đủ — luật một hạn chót giữ được.
    freeCancellation: 'Free cancellation',
    instantConfirmation: 'Instant confirmation',
    adultsLine: (n: number) => `${n} adult${n > 1 ? 's' : ''}`,
    childrenLine: (n: number) => `${n} child${n > 1 ? 'ren' : ''}`,
    totalLabel: 'Total',
    taxesNote: 'Includes all taxes and fees.',
    trustRow: 'Stripe & PayPal · SSL encrypted · 24/7 support',
    // Chưa chọn đợt khởi hành — breakdown hiện câu này thay vì các dòng số tiền.
    pickDeparture: 'Select a departure to see your total',
  },
```

4d. Trong khối `cancellationDeadline` (Task 7), trước:

```ts
    policyLink: 'Read the cancellation policy',
  },
```

sau:

```ts
    policyLink: 'Read the cancellation policy',
    /** Dòng ngắn trên từng đợt (tab Departures, modal All dates) — `date` từ `bookingDeadline`. */
    short: (date: string) => `Free cancellation until ${date}`,
    /** Luật N theo độ dài chuyến (`windowDaysForTripLength`: 1, 3 hoặc 7) — thẻ chính sách ở trang tour. */
    rule: (days: number) =>
      `Free cancellation until ${days} ${days === 1 ? 'day' : 'days'} before departure`,
    ruleAfter: 'After that, bookings close and cancellations aren’t refunded.',
  },
```

4e. `tourDetail.departures` — trước (dòng 1523–1525):

```ts
      /** departures[] rỗng: dải và rail đổi sang dòng này + CTA hỏi. */
      none: 'No departures scheduled yet',
      noneBody: 'Dates for this trip are still being confirmed. Ask us and we’ll tell you first.',
```

sau:

```ts
      /** Không còn đợt nào ĐẶT ĐƯỢC (chưa có đợt, hết chỗ, hoặc đã qua hạn đặt):
          MỘT câu chung cho rail, bar đáy, panel đặt chỗ và trang /book, luôn kèm
          CTA hỏi. */
      none: 'No departures are open for booking',
      noneBody:
        'Ask us about this trip — we’ll tell you when new dates open, or plan one around you.',
      /** Đợt đã qua hạn đặt (`bookable = false`, server tính): vẫn hiện, không chọn được. */
      closed: 'Booking closed',
```

4f. `tourDetail.departuresTab` — trước (dòng 1612–1625):

```ts
      cardGroup: 'Travelling as a group',
      /** Nhãn nổi bật của thẻ huỷ khi tour CÓ `freeCancellationDays`. Tour tính
          cửa sổ bằng giờ để null → rơi về `policy.title` như hai thẻ kia. */
      freeUntil: (days: number) => `Free until ${days} ${days === 1 ? 'day' : 'days'} out`,
      /**
       * Vế SAU của lời hứa miễn phí (ADR-0030 §3b). Badge cũ dừng ở đúng hạn
       * chót nên khách lỡ một ngày bị bất ngờ — mà cái họ rơi vào không phải
       * hư không, nó là bảng bậc đã công bố. Câu này nói ra điều đó, và link
       * đổi hướng về chính bảng ấy thay vì tab policy riêng của tour.
       */
      afterFreeWindow: 'After that, our standard refund schedule applies.',
      viewRefundSchedule: 'See the refund schedule',
      groupCap: (max: number) => `Up to ${max} ${max === 1 ? 'guest' : 'guests'}`,
      readFullPolicy: 'Read the full policy',
```

sau:

```ts
      cardGroup: 'Travelling as a group',
      groupCap: (max: number) => `Up to ${max} ${max === 1 ? 'guest' : 'guests'}`,
```

4g. `tourDetail.dialogs` — dòng 1694, trước:

```ts
      onlyOpen: 'Only show dates with seats left',
```

sau:

```ts
      /** Lọc theo `isDepartureOpen`: còn chỗ VÀ còn hạn đặt. */
      onlyOpen: 'Only show dates you can book',
```

- [ ] **Step 5: Build contract và i18n**

```bash
pnpm --filter @tourism/contract build
pnpm --filter @tourism/i18n build
```

Expected: cả hai exit 0.

- [ ] **Step 6: Cài đặt logic thuần**

6a. `apps/web/src/lib/tours.ts` — chèn ngay sau hàm `departureStatus` (sau dấu `}` ở dòng 388):

```ts

/**
 * Đợt CHỌN ĐƯỢC để đặt: server nói còn trong hạn đặt (`bookable`, tính theo ngày
 * Việt Nam — ADR-0041 §7) VÀ còn chỗ. Web không tự so ngày chót với giờ trình
 * duyệt; mọi chỗ chọn đợt (provider, ô ngày, bảng Departures, modal All dates,
 * wizard, trang /book) đi qua đúng hàm này để không nơi nào nói khác nơi nào.
 */
export function isDepartureOpen(departure: { bookable: boolean; seatsLeft: number }): boolean {
  return departure.bookable && departure.seatsLeft > 0;
}
```

6b. `apps/web/src/lib/tour-detail.ts` dòng 1, trước:

```ts
import { departureStatus, strikePrice } from './tours';
```

sau:

```ts
import { departureStatus, isDepartureOpen, strikePrice } from './tours';
```

6c. Cùng file, dòng 12–17, trước:

```ts
export function visibleDepartureChips<T extends { id: string; seatsLeft: number }>(
  departures: readonly T[],
  selectedId: string | null,
  slots = DEPARTURE_CHIP_SLOTS,
): T[] {
  const open = departures.filter((d) => d.seatsLeft > 0);
```

sau:

```ts
export function visibleDepartureChips<
  T extends { id: string; seatsLeft: number; bookable: boolean },
>(departures: readonly T[], selectedId: string | null, slots = DEPARTURE_CHIP_SLOTS): T[] {
  // Chỉ đợt chọn được (còn chỗ VÀ còn hạn đặt). Đợt đã ngừng nhận đặt vẫn hiện
  // ở tab Departures và modal All dates, nhưng không chiếm ô chọn nhanh.
  const open = departures.filter(isDepartureOpen);
```

6d. Cùng file, thay JSDoc + hàm `heroPrice` (dòng 343–370), trước:

```ts
/**
 * Giá "from" ở hero = đợt RẺ NHẤT còn chỗ (hoà thì đợt sớm hơn — thứ tự mảng),
```

… (giữ nguyên các dòng JSDoc ở giữa) …

```ts
export function heroPrice(tour: {
  basePrice: string;
  departures: readonly {
    effectivePrice: string;
    compareAtPrice: string | null;
    seatsLeft: number;
  }[];
}): { price: string; compareAtPrice: string | null } {
  let cheapest: { effectivePrice: string; compareAtPrice: string | null } | null = null;
  for (const d of tour.departures) {
    if (d.seatsLeft <= 0) continue;
```

sau:

```ts
/**
 * Giá "from" ở hero = đợt RẺ NHẤT còn đặt được — còn chỗ VÀ còn hạn đặt (hoà thì đợt sớm hơn — thứ tự mảng),
```

… (giữ nguyên các dòng JSDoc ở giữa) …

```ts
export function heroPrice(tour: {
  basePrice: string;
  departures: readonly {
    effectivePrice: string;
    compareAtPrice: string | null;
    seatsLeft: number;
    bookable: boolean;
  }[];
}): { price: string; compareAtPrice: string | null } {
  let cheapest: { effectivePrice: string; compareAtPrice: string | null } | null = null;
  for (const d of tour.departures) {
    // Cùng tập với giá "from" của `catalog.tours.list`: đợt đã qua hạn đặt không
    // còn là giá khách mua được, tính vào thì thẻ tour và hero nói hai con số.
    if (!isDepartureOpen(d)) continue;
```

- [ ] **Step 7: Chạy test logic thuần, xác nhận xanh**

Run: `pnpm --filter @tourism/web exec vitest run src/lib/tours.spec.ts src/lib/tour-detail.spec.ts`
Expected: PASS.

- [ ] **Step 8: Viết test đỏ cho panel đặt chỗ cạnh gallery**

8a. `apps/web/src/components/tours/tour-media-panel.spec.tsx` — fixture `DEPARTURES` (dòng 25–49): thêm hai field cho cả ba đợt. Trước:

```tsx
const DEPARTURES: DepartureVM[] = [
  {
    id: 'd1',
    startDate: '2026-09-14',
    endDate: '2026-09-17',
    seatsLeft: 6,
    effectivePrice: '329.00',
    compareAtPrice: '369.00',
  },
  {
    id: 'd2',
    startDate: '2026-09-28',
    endDate: '2026-10-01',
    seatsLeft: 9,
    effectivePrice: '329.00',
    compareAtPrice: null,
  },
  {
    id: 'd3',
    startDate: '2026-10-12',
    endDate: '2026-10-15',
    seatsLeft: 3,
    effectivePrice: '349.00',
    compareAtPrice: null,
  },
] as unknown as DepartureVM[];
```

sau:

```tsx
const DEPARTURES: DepartureVM[] = [
  {
    id: 'd1',
    startDate: '2026-09-14',
    endDate: '2026-09-17',
    seatsLeft: 6,
    effectivePrice: '329.00',
    compareAtPrice: '369.00',
    // Tour 4 ngày → N = 7 (ADR-0041 §3): ngày chót = ngày đi − 7.
    bookingDeadline: '2026-09-07',
    bookable: true,
  },
  {
    id: 'd2',
    startDate: '2026-09-28',
    endDate: '2026-10-01',
    seatsLeft: 9,
    effectivePrice: '329.00',
    compareAtPrice: null,
    bookingDeadline: '2026-09-21',
    bookable: true,
  },
  {
    id: 'd3',
    startDate: '2026-10-12',
    endDate: '2026-10-15',
    seatsLeft: 3,
    effectivePrice: '349.00',
    compareAtPrice: null,
    bookingDeadline: '2026-10-05',
    bookable: true,
  },
] as unknown as DepartureVM[];
```

8b. Cùng file, thay test `'ba thẻ điều khoản sinh từ policies và trỏ sang tab Good to know'` (dòng 177–184) bằng hai test:

```tsx
  it('ô điều khoản huỷ sinh TỪ LUẬT, KHÔNG đọc policy loại CANCELLATION nữa', () => {
    render(<TourMediaPanel tour={tourWith(3)} />, { wrapper });
    // Tour 4 ngày → N = 7. Fixture vẫn có policy CANCELLATION title "Cancellation"
    // (dữ liệu cũ) để chốt rằng trang thôi đọc nó.
    const card = screen.getByRole('link', {
      name: 'Free cancellation until 7 days before departure',
    });
    expect(card).toHaveAttribute('href', '#good-to-know');
    expect(screen.queryByRole('link', { name: 'Cancellation' })).toBeNull();
    expect(
      screen.getAllByRole('link', { name: /Free cancellation|Booking|Good to know/ }),
    ).toHaveLength(3);
  });

  it('đợt đã ngừng nhận đặt không chiếm ô ngày và không được chọn sẵn', () => {
    const closed = {
      ...DEPARTURES[0],
      id: 'd0',
      startDate: '2026-09-02',
      endDate: '2026-09-05',
      bookingDeadline: '2026-08-26',
      bookable: false,
    } as DepartureVM;
    const departures = [closed, ...DEPARTURES];
    render(
      <DepartureSelectionProvider departures={departures}>
        <TourMediaPanel tour={tourWith(3, { departures } as Partial<TourDetailVM>)} />
      </DepartureSelectionProvider>,
    );
    // Ô ngày chỉ dành cho đợt đặt được; đợt đã đóng vẫn hiện ở tab Departures
    // và modal All dates, không hiện ở đây.
    expect(screen.queryByText('2 Sep')).toBeNull();
    expect(screen.getByRole('button', { name: /14 Sep/ })).toHaveAttribute('aria-pressed', 'true');
  });
```

Run: `pnpm --filter @tourism/web exec vitest run src/components/tours/tour-media-panel.spec.tsx`
Expected: FAIL — ô "trust" vẫn in `policy.title` "Cancellation" và chưa có câu luật; đợt `d0` vẫn chiếm ô ngày "2 Sep" và đang được chọn sẵn.

- [ ] **Step 9: Cài đặt provider và ô "trust", chạy thấy xanh**

9a. `apps/web/src/components/tours/departure-selection.tsx` — khối import (dòng 3–6), trước:

```tsx
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { BookingRail } from '@/components/tours/booking-rail';
import { DepartureStrip } from '@/components/tours/departure-strip';
import type { DepartureVM } from '@/lib/api/tours';
```

sau:

```tsx
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { BookingRail } from '@/components/tours/booking-rail';
import { DepartureStrip } from '@/components/tours/departure-strip';
import type { DepartureVM } from '@/lib/api/tours';
import { isDepartureOpen } from '@/lib/tours';
```

9b. Cùng file, dòng 67–72, trước:

```tsx
  // Khởi tạo bằng đợt CÒN CHỖ đầu tiên, không phải phần tử [0]: đợt đầu có thể
  // đã hết chỗ, và mở trang ra với một đợt không đặt được là dẫn người dùng vào
  // ngõ cụt ngay từ đầu. Không đợt nào còn chỗ → undefined, rail đổi sang CTA hỏi.
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => departures.find((d) => d.seatsLeft > 0)?.id,
  );
```

sau:

```tsx
  // Khởi tạo bằng đợt ĐẶT ĐƯỢC đầu tiên — còn chỗ VÀ còn hạn đặt — không phải
  // phần tử [0]: đợt đầu có thể đã hết chỗ hoặc đã qua hạn đặt, và mở trang ra
  // với một đợt không đặt được là dẫn người dùng vào ngõ cụt ngay từ đầu (nút
  // Reserve dẫn thẳng vào lỗi 400 của `bookings.create`). Không đợt nào đặt
  // được → undefined, rail đổi sang CTA hỏi.
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => departures.find(isDepartureOpen)?.id,
  );
```

9c. `apps/web/src/components/tours/tour-media-panel.tsx` — dòng 3, trước:

```tsx
import { messages } from '@tourism/i18n';
```

sau:

```tsx
import { windowDaysForTripLength } from '@tourism/contract';
import { messages } from '@tourism/i18n';
```

9d. Cùng file, dòng 331–349, trước:

```tsx
        {/* .trust — sinh từ `policies[]`, không hardcode. Bấm sang tab Good to
            know nơi có `policy.body` đầy đủ. */}
        {tour.policies.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-2">
            {tour.policies.map((policy) => {
              const Icon = POLICY_ICON[policy.kind];
              return (
                <a
                  key={policy.kind}
                  href="#good-to-know"
                  className="flex flex-col items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-3 text-center text-foreground transition-colors hover:border-input"
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="text-xs leading-[14px]">{policy.title}</span>
                </a>
              );
            })}
          </div>
        ) : null}
```

sau:

```tsx
        {/* .trust — ô huỷ sinh TỪ LUẬT (ADR-0041), các ô còn lại vẫn từ
            `policies[]`. Trang tour KHÔNG đọc policy loại CANCELLATION nữa
            (spec §5.1): dữ liệu cũ ghi những câu kiểu "Free until 10 days out"
            trong khi N mới tối đa là 7, hai con số chỏi nhau ngay trên cùng
            một trang. Hàng ô vì vậy LUÔN có ít nhất một ô, không còn nhánh
            `policies.length > 0`. Bấm sang tab Good to know, nơi đoạn chính
            sách đầy đủ cũng sinh từ chính luật này. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-2">
          <a
            href="#good-to-know"
            className="flex flex-col items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-3 text-center text-foreground transition-colors hover:border-input"
          >
            <CalendarXIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="text-xs leading-[14px]">
              {messages.cancellationDeadline.rule(windowDaysForTripLength(tour.durationDays))}
            </span>
          </a>
          {tour.policies
            .filter((policy) => policy.kind !== 'CANCELLATION')
            .map((policy) => {
              const Icon = POLICY_ICON[policy.kind];
              return (
                <a
                  key={policy.kind}
                  href="#good-to-know"
                  className="flex flex-col items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-3 text-center text-foreground transition-colors hover:border-input"
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="text-xs leading-[14px]">{policy.title}</span>
                </a>
              );
            })}
        </div>
```

`POLICY_ICON` (dòng 37–41) GIỮ nguyên cả ba khoá: `PolicyKind` vẫn có `CANCELLATION` nên bỏ khoá đó là lỗi kiểu, và `CalendarXIcon` nay dùng cho chính ô luật.

Run: `pnpm --filter @tourism/web exec vitest run src/components/tours/tour-media-panel.spec.tsx`
Expected: PASS.

- [ ] **Step 10: Viết test đỏ cho modal "All dates"**

10a. `apps/web/src/components/tours/departure-dialog.spec.tsx` — fixture `DEPARTURES` (dòng 13–37): thêm `bookingDeadline` + `bookable: true` cho `d1` (`'2026-09-07'`), `d2` (`'2026-09-21'`), `d3` (`'2026-10-05'`), cùng khuôn như Step 8a.

10b. Cùng file, thay test `'ô lọc "only open" giấu đợt hết chỗ'` (dòng 92–98) bằng:

```tsx
  it('ô lọc "chỉ ngày đặt được" giấu CẢ đợt hết chỗ lẫn đợt đã qua hạn đặt', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'MỞ' }));
    await user.click(screen.getByRole('checkbox', { name: /only show dates you can book/i }));
    expect(screen.queryByText('Sun, 28 Sep →')).toBeNull();
    expect(screen.getByText('Mon, 14 Sep →')).toBeInTheDocument();
  });
```

10c. Cùng file, thêm hai test ngay sau test vừa thay:

```tsx
  it('mỗi hàng đợt đặt được in ngày chót huỷ miễn phí của CHÍNH đợt đó', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'MỞ' }));
    expect(screen.getByText('Free cancellation until 7 Sep')).toBeInTheDocument();
    expect(screen.getByText('Free cancellation until 5 Oct')).toBeInTheDocument();
  });

  it('đợt đã qua hạn đặt: ghi "Booking closed", KHÔNG bấm được, không hứa ngày chót', async () => {
    const user = userEvent.setup();
    const departures = [
      { ...DEPARTURES[0], bookable: false },
      DEPARTURES[2],
    ] as unknown as DepartureVM[];
    render(
      <DepartureSelectionProvider departures={departures}>
        <OpenButton />
        <DepartureDialog
          tourTitle="Hà Giang Loop"
          currency="USD"
          durationDays={4}
          maxGroupSize={10}
        />
      </DepartureSelectionProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'MỞ' }));
    const row = screen.getByRole('button', { name: /Mon, 14 Sep/ });
    expect(row).toBeDisabled();
    expect(screen.getByText(/Booking closed/)).toBeInTheDocument();
    expect(screen.queryByText('Free cancellation until 7 Sep')).toBeNull();
  });
```

Run: `pnpm --filter @tourism/web exec vitest run src/components/tours/departure-dialog.spec.tsx`
Expected: FAIL — nhãn checkbox còn là "Only show dates with seats left"; không có dòng "Free cancellation until …"; hàng `d1` vẫn bấm được và không có chữ "Booking closed".

- [ ] **Step 11: Cài đặt modal "All dates", chạy thấy xanh**

11a. `apps/web/src/components/tours/departure-dialog.tsx` — khối import (dòng 11–14), trước:

```tsx
import { useDepartureSelection } from '@/components/tours/departure-selection';
import type { DepartureVM } from '@/lib/api/tours';
import { departureMonths, monthLabel } from '@/lib/tour-detail';
import { departureStatus, formatDialogDate, formatMoney } from '@/lib/tours';
```

sau:

```tsx
import { useDepartureSelection } from '@/components/tours/departure-selection';
import type { DepartureVM } from '@/lib/api/tours';
import { departureMonths, monthLabel } from '@/lib/tour-detail';
import {
  departureStatus,
  formatChipDate,
  formatDialogDate,
  formatMoney,
  isDepartureOpen,
} from '@/lib/tours';
```

11b. Cùng file, dòng 51, trước:

```tsx
  const visible = onlyOpen ? departures.filter((d) => d.seatsLeft > 0) : departures;
```

sau:

```tsx
  const visible = onlyOpen ? departures.filter(isDepartureOpen) : departures;
```

11c. Cùng file, thân vòng lặp hàng đợt (dòng 158–221), trước:

```tsx
                {group.items.map((d) => {
                  const status = departureStatus(d.seatsLeft);
                  const soldOut = status === 'sold-out';
                  const selected = d.id === selectedId;
```

sau:

```tsx
                {group.items.map((d) => {
                  const status = departureStatus(d.seatsLeft);
                  const soldOut = status === 'sold-out';
                  // Hai lý do KHÁC NHAU để không bấm được, và khách cần đọc ra
                  // lý do nào: hết chỗ thì chờ chỗ trống, quá hạn đặt thì không
                  // còn gì để chờ. `bookable` do server tính (ADR-0041 §7).
                  const closed = !d.bookable;
                  const pickable = isDepartureOpen(d);
                  const selected = d.id === selectedId;
```

Trong cùng khối, `FramePanel` đổi `soldOut && 'opacity-55'` thành `!pickable && 'opacity-55'`; nút đổi `disabled={soldOut}` thành `disabled={!pickable}` và `soldOut && 'cursor-not-allowed'` thành `!pickable && 'cursor-not-allowed'`. Chấm màu: `DOT_TONE[closed ? 'sold-out' : status]`. Dòng meta, trước:

```tsx
                            {t.rowMeta(
                              soldOut ? t.soldOut : t.seatsOf(d.seatsLeft, maxGroupSize),
                              durationDays,
                            )}
```

sau:

```tsx
                            {t.rowMeta(
                              closed
                                ? messages.tourDetail.departures.closed
                                : soldOut
                                  ? t.soldOut
                                  : t.seatsOf(d.seatsLeft, maxGroupSize),
                              durationDays,
                            )}
```

Ngay SAU thẻ `</span>` đóng dòng meta (trước `</span>` đóng ô ngày), chèn:

```tsx
                          {/* Ngày chót huỷ miễn phí của CHÍNH đợt này — in từ
                              `bookingDeadline` server trả, không tự trừ ngày
                              bằng giờ trình duyệt (spec §2 Q7). Đợt đã đóng
                              không in: lời hứa đó đã hết hiệu lực. */}
                          {d.bookable ? (
                            <span className="mt-0.5 block text-xs leading-[14px] text-muted-foreground">
                              {messages.cancellationDeadline.short(
                                formatChipDate(d.bookingDeadline),
                              )}
                            </span>
                          ) : null}
```

Cuối cùng, cột hành động đổi `soldOut ? null :` thành `pickable ? (selected ? … : t.select) : null` — cụ thể, trước:

```tsx
                          {soldOut ? null : selected ? (
```

sau:

```tsx
                          {!pickable ? null : selected ? (
```

Run: `pnpm --filter @tourism/web exec vitest run src/components/tours/departure-dialog.spec.tsx`
Expected: PASS.

- [ ] **Step 12: Viết test đỏ cho bảng Departures**

12a. `apps/web/src/components/tours/panels/departures-panel.spec.tsx` — fixture: thêm `bookingDeadline` + `bookable: true` cho ba đợt `aug` (`'2026-08-13'`), `sep` (`'2026-09-17'`), `nov` (`'2026-10-29'`); và thêm `slug` vào `TOUR` (dòng 51–53), trước:

```tsx
const TOUR = {
  currency: 'USD',
  basePrice: '329.00',
```

sau:

```tsx
const TOUR = {
  slug: 'ha-giang-loop-4d',
  currency: 'USD',
  basePrice: '329.00',
```

12b. Cùng file, thay ba test thẻ chính sách (dòng 211–240: `'thẻ huỷ in CON SỐ khi tour có freeCancellationDays'`, `'tour tính cửa sổ bằng GIỜ (null) thì rơi về tiêu đề policy…'`, và `'tour không có policy nào thì bỏ hẳn hàng thẻ'` — GIỮ nguyên test `'thẻ nhóm suy từ maxGroupSize…'` ở giữa) bằng:

```tsx
  it('thẻ huỷ sinh TỪ LUẬT theo độ dài chuyến, KHÔNG đọc policy CANCELLATION', () => {
    render(wrap());
    // Tour 4 ngày → N = 7. Fixture vẫn mang policy CANCELLATION cũ
    // ("Free until 10 days out") để chốt rằng panel thôi đọc nó.
    expect(screen.getByText('Free cancellation until 7 days before departure')).toBeInTheDocument();
    expect(
      screen.getByText('After that, bookings close and cancellations aren’t refunded.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Free until 10 days out')).toBeNull();
    expect(screen.getByRole('link', { name: 'Read the cancellation policy' })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );
  });

  it('tour không có policy nào: vẫn còn thẻ huỷ (từ luật) và thẻ nhóm, chỉ mất thẻ đặt cọc', () => {
    render(wrap(DEPARTURES, { ...TOUR, policies: [] } as unknown as TourDetailVM));
    expect(screen.queryByText('Securing a seat')).toBeNull();
    expect(screen.getByText('Changing your mind')).toBeInTheDocument();
    expect(screen.getByText('Travelling as a group')).toBeInTheDocument();
  });
```

12c. Cùng file, thêm hai test ngay SAU test `'đợt hết chỗ: gạch ngang ngày, huy hiệu Sold out, nút bấm không được'` (dòng 155–161):

```tsx
  it('mỗi hàng đợt in ngày chót huỷ miễn phí của CHÍNH đợt đó', () => {
    render(wrap());
    expect(
      within(rowFor('20 Aug')).getByText('Free cancellation until 13 Aug'),
    ).toBeInTheDocument();
  });

  it('đợt đã qua hạn đặt: vẫn hiện, không chọn được, và mở lối hỏi thay nút Select', () => {
    // Hai đợt CÙNG tháng 8 để hàng đợt đã đóng nằm trong tháng mở sẵn — hàng
    // của tháng đóng nằm trong DOM nhưng `hidden`, và `getByRole` bỏ qua nó.
    const closed = {
      ...DEPARTURES[0],
      id: 'aug-late',
      startDate: '2026-08-28',
      endDate: '2026-08-31',
      bookingDeadline: '2026-08-21',
      bookable: false,
    } as DepartureVM;
    render(wrap([DEPARTURES[0] as DepartureVM, closed]));
    const row = rowFor('28 Aug');
    expect(within(row).getByText('Booking closed')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Select' })).toBeNull();
    expect(within(row).getByRole('link', { name: /ask about this trip/i })).toHaveAttribute(
      'href',
      '/tours/ha-giang-loop-4d/enquire',
    );
    expect(within(row).queryByText(/Free cancellation until/)).toBeNull();
  });
```

Run: `pnpm --filter @tourism/web exec vitest run src/components/tours/panels/departures-panel.spec.tsx`
Expected: FAIL — thẻ huỷ vẫn in "Free until 10 days out"; hàng đợt chưa có dòng ngày chót, chưa có nhãn "Booking closed" lẫn link hỏi.

- [ ] **Step 13: Cài đặt hàng đợt và ô thống kê của bảng Departures**

13a. `apps/web/src/components/tours/panels/departures-panel.tsx` — khối import (dòng 3–24): thêm `windowDaysForTripLength` từ `@tourism/contract` (dòng đầu, trước `@tourism/i18n`), thêm `ButtonLink` từ `@tourism/ui/components/button-link`, bỏ `orderPolicies` khỏi import `@/lib/tour-detail`, và đổi import `@/lib/tours` thành:

```tsx
import {
  departureStatus,
  formatChipDate,
  formatDialogDate,
  formatMoney,
  isDepartureOpen,
} from '@/lib/tours';
```

13b. Cùng file, `SeatBadge` (dòng 85–93): thêm tham số `bookable` và nhánh đầu tiên. Trước:

```tsx
function SeatBadge({ seatsLeft, capacity }: { seatsLeft: number; capacity: number }) {
  const t = messages.tourDetail.departuresTab;
  if (seatsLeft <= 0) {
```

sau:

```tsx
function SeatBadge({
  seatsLeft,
  capacity,
  bookable,
}: {
  seatsLeft: number;
  capacity: number;
  bookable: boolean;
}) {
  const t = messages.tourDetail.departuresTab;
  // Hạn đặt xét TRƯỚC ghế: đợt đã đóng thì còn bao nhiêu ghế cũng không mua
  // được, in "Almost full" ở đó là mời khách bấm vào chỗ không có gì.
  if (!bookable) {
    return (
      <span className={cn(BADGE_BASE, 'border-border bg-muted text-muted-foreground')}>
        {messages.tourDetail.departures.closed}
      </span>
    );
  }
  if (seatsLeft <= 0) {
```

13c. Cùng file, dòng 181–183, trước:

```tsx
  const openTotal = departures.filter((d) => d.seatsLeft > 0).length;
  const seatsTotal = departures.reduce((sum, d) => sum + d.seatsLeft, 0);
  const next = departures.find((d) => d.seatsLeft > 0) ?? departures[0];
```

sau:

```tsx
  // "Dates open" và "Next departure" đếm theo ĐẶT ĐƯỢC, cùng vị từ với mọi nơi
  // chọn đợt khác — nếu không, ô thống kê hứa 5 ngày còn bảng chỉ cho bấm 3.
  const openTotal = departures.filter(isDepartureOpen).length;
  const seatsTotal = departures.reduce((sum, d) => sum + d.seatsLeft, 0);
  const next = departures.find(isDepartureOpen) ?? departures[0];
```

13d. Cùng file, chỗ dựng `DepartureRow` (dòng 349–361): thêm prop `slug`. Trước:

```tsx
                  <DepartureRow
                    key={departure.id}
                    rowIndex={rowIndex}
                    departure={departure}
                    capacity={capacity}
```

sau:

```tsx
                  <DepartureRow
                    key={departure.id}
                    rowIndex={rowIndex}
                    departure={departure}
                    slug={tour.slug}
                    capacity={capacity}
```

13e. Cùng file, `DepartureRow` (dòng 494–586): thêm `slug` vào tham số và kiểu, đổi phần trạng thái và hai ô cuối. Trước:

```tsx
function DepartureRow({
  departure,
  capacity,
  currency,
  durationDays,
  selected,
  hidden,
  rowIndex = 0,
  onSelect,
}: {
  departure: DepartureVM;
  capacity: number;
```

sau:

```tsx
function DepartureRow({
  departure,
  slug,
  capacity,
  currency,
  durationDays,
  selected,
  hidden,
  rowIndex = 0,
  onSelect,
}: {
  departure: DepartureVM;
  /** Slug tour — dựng href `/tours/{slug}/enquire` cho hàng đã đóng. */
  slug: string;
  capacity: number;
```

Trong thân hàm, trước:

```tsx
  const t = messages.tourDetail.departuresTab;
  const soldOut = departure.seatsLeft <= 0;
```

sau:

```tsx
  const t = messages.tourDetail.departuresTab;
  const soldOut = departure.seatsLeft <= 0;
  // Đợt đã qua hạn đặt VẪN HIỆN (spec §5.1) — biến mất thì khách tưởng mình
  // nhớ nhầm ngày. Chỉ bỏ cách chọn, và thay bằng một lối đi tiếp.
  const closed = !departure.bookable;
```

Ô ngày (dòng 535–548): điều kiện gạch ngang đổi `soldOut` thành `soldOut || closed`, và chèn dòng ngày chót ngay sau `departureMeta`. Trước:

```tsx
        <span className="block text-xs leading-4 text-muted-foreground">
          {t.departureMeta(durationDays)}
        </span>
      </td>
```

sau:

```tsx
        <span className="block text-xs leading-4 text-muted-foreground">
          {t.departureMeta(durationDays)}
        </span>
        {/* Ngày chót của CHÍNH đợt này, từ `bookingDeadline` server trả — web
            không tự trừ N ngày bằng giờ trình duyệt (spec §2 Q7). */}
        {departure.bookable ? (
          <span className="block text-xs leading-4 text-muted-foreground">
            {messages.cancellationDeadline.short(formatChipDate(departure.bookingDeadline))}
          </span>
        ) : null}
      </td>
```

Ô huy hiệu (dòng 555–557), trước:

```tsx
      <td>
        <SeatBadge seatsLeft={departure.seatsLeft} capacity={capacity} />
      </td>
```

sau:

```tsx
      <td>
        <SeatBadge
          seatsLeft={departure.seatsLeft}
          capacity={capacity}
          bookable={departure.bookable}
        />
      </td>
```

Ô hành động (dòng 573–583), trước:

```tsx
      <td className="text-right">
        <Button
          type="button"
          className={PANEL_BTN_SM}
          variant={selected ? 'outline' : 'default'}
          disabled={soldOut}
          onClick={onSelect}
        >
          {soldOut ? t.statusSoldOut : selected ? t.selected : t.select}
        </Button>
      </td>
```

sau:

```tsx
      <td className="text-right">
        {closed ? (
          // Nhãn dài trong cột ghim 120px: cho XUỐNG DÒNG thay vì nới cột —
          // nới cột thì cột ngày ("Thu, 20 Aug → Sun, 23 Aug") bị bóp ở bề
          // ngang ~820px, mà đó mới là ô khách đọc.
          <ButtonLink
            variant="outline"
            className={cn(PANEL_BTN_SM, 'h-auto py-1.5 leading-4 whitespace-normal')}
            href={`/tours/${slug}/enquire`}
          >
            {messages.tourDetail.booking.ask}
          </ButtonLink>
        ) : (
          <Button
            type="button"
            className={PANEL_BTN_SM}
            variant={selected ? 'outline' : 'default'}
            disabled={soldOut}
            onClick={onSelect}
          >
            {soldOut ? t.statusSoldOut : selected ? t.selected : t.select}
          </Button>
        )}
      </td>
```

- [ ] **Step 14: Cài đặt ba thẻ chính sách cuối tab, chạy thấy xanh**

`apps/web/src/components/tours/panels/departures-panel.tsx` — thay JSDoc đoạn "Cùng dữ liệu với tab Good to know…" và trọn hàm `BookingPolicyCards` (dòng 393–458). Trước:

```tsx
 * Cùng dữ liệu với tab Good to know, đóng khung lại cho khoảnh khắc chọn ngày:
 * lúc đang cân nhắc một đợt, câu hỏi là "đặt cọc bao nhiêu, huỷ được tới khi
 * nào", không phải "mặc gì trên xe". Nên nhãn thẻ nói VAI TRÒ chứ không lặp tên
 * nhóm policy, và thẻ giữa có link sang tab Good to know cho toàn văn.
 *
 * Thẻ thứ ba KHÔNG lấy từ `policies` — nó nói về sức chứa, nên giá trị suy từ
 * `maxGroupSize` và câu mô tả dùng lại `factGroupSizeNote` (ADR-0023), vốn viết
 * đúng về chuyện đó.
 */
function BookingPolicyCards({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail.departuresTab;
  const byKind = Object.fromEntries(orderPolicies(tour.policies).map((p) => [p.kind, p]));
  const booking = byKind.BOOKING;
  const cancellation = byKind.CANCELLATION;

  // Không có policy nào thì bỏ hẳn hàng thẻ — một hàng thẻ rỗng tệ hơn không có.
  if (!booking && !cancellation) return null;
```

sau:

```tsx
 * Cùng dữ liệu với tab Good to know, đóng khung lại cho khoảnh khắc chọn ngày:
 * lúc đang cân nhắc một đợt, câu hỏi là "đặt cọc bao nhiêu, huỷ được tới khi
 * nào", không phải "mặc gì trên xe". Nên nhãn thẻ nói VAI TRÒ chứ không lặp tên
 * nhóm policy.
 *
 * Từ ADR-0041 chỉ còn THẺ ĐẦU đọc `policies` (nhóm BOOKING). Thẻ huỷ sinh từ
 * luật — `windowDaysForTripLength(durationDays)` — nên nó đúng cho mọi tour và
 * không bao giờ vắng mặt; policy loại CANCELLATION không còn được đọc ở đâu
 * trên trang tour (spec §5.1). Thẻ thứ ba vẫn suy từ `maxGroupSize` và
 * `factGroupSizeNote` (ADR-0023).
 */
function BookingPolicyCards({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail.departuresTab;
  const td = messages.cancellationDeadline;
  // `find` chứ không `orderPolicies`: chỉ lấy đúng MỘT nhóm nên thứ tự API
  // không ảnh hưởng gì.
  const booking = tour.policies.find((p) => p.kind === 'BOOKING');
```

và phần JSX, trước:

```tsx
      {cancellation ? (
        <FactCard
          icon={<RotateCcwIcon aria-hidden="true" />}
          label={t.cardChanging}
          // Con số thắng khi có: "Free until 10 days out" đọc nhanh hơn một câu.
          // Tour tính cửa sổ bằng GIỜ để `null` → rơi về tiêu đề policy.
          value={
            tour.freeCancellationDays === null
              ? cancellation.title
              : t.freeUntil(tour.freeCancellationDays)
          }
          // Có badge thì phải nói nốt VẾ SAU (ADR-0030 §3b): badge cũ dừng ở
          // đúng hạn chót, nên khách lỡ một ngày bị bất ngờ — trong khi thứ họ
          // rơi vào là bảng bậc đã công bố, không phải hư không. Link đổi
          // hướng về chính bảng ấy; tour không có badge thì giữ nguyên đường
          // cũ về policy riêng của tour.
          note={
            tour.freeCancellationDays === null
              ? cancellation.body
              : `${cancellation.body} ${t.afterFreeWindow}`
          }
          link={
            tour.freeCancellationDays === null
              ? { href: '#good-to-know', label: t.readFullPolicy }
              : { href: '/cancellation-policy', label: t.viewRefundSchedule }
          }
        />
      ) : null}
```

sau:

```tsx
      {/* Vế SAU của lời hứa nói ngay trong `note`: luật mới KHÔNG có bậc nào
          sau hạn chót, nên câu "our standard refund schedule applies" cũ giờ
          trỏ vào một bảng không còn tồn tại. */}
      <FactCard
        icon={<RotateCcwIcon aria-hidden="true" />}
        label={t.cardChanging}
        value={td.rule(windowDaysForTripLength(tour.durationDays))}
        note={td.ruleAfter}
        link={{ href: '/cancellation-policy', label: td.policyLink }}
      />
```

Run: `pnpm --filter @tourism/web exec vitest run src/components/tours/panels/departures-panel.spec.tsx`
Expected: PASS.

- [ ] **Step 15: Viết test đỏ cho tab "Good to know"**

15a. `apps/web/src/components/tours/panels/good-to-know-panel.spec.tsx` — fixture `TOUR` (dòng 22–32): thêm `durationDays: 4,` làm field đầu tiên (panel mới cần nó để tra N).

15b. Cùng file, thay test `'ba thẻ policy xếp Cancellation → Booking → General bất kể API trả thứ tự nào'` (dòng 35–43) bằng:

```tsx
  it('thẻ huỷ sinh TỪ LUẬT đứng đầu, rồi Booking → General; policy CANCELLATION cũ bị bỏ', () => {
    render(<GoodToKnowPanel tour={TOUR} />);
    // Hỏi trong phạm vi thẻ policy: `AccordionTrigger` của Base UI cũng bọc
    // câu hỏi trong <h3>, nên `getAllByRole('heading')` gom cả FAQ vào.
    const titles = screen
      .getAllByTestId('policy-card')
      .map((card) => within(card).getByRole('heading', { level: 3 }).textContent);
    expect(titles).toEqual([
      'Free cancellation until 7 days before departure',
      'Booking & payment',
      'Good to know',
    ]);
    // Câu cũ của policy CANCELLATION không còn ở đâu trên panel.
    expect(screen.queryByText('Free up to 10 days before departure.')).toBeNull();
  });

  it('vế SAU của lời hứa in ngay dưới thẻ huỷ, không hứa bảng bậc nào nữa', () => {
    render(<GoodToKnowPanel tour={TOUR} />);
    expect(
      screen.getByText('After that, bookings close and cancellations aren’t refunded.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/standard refund schedule/)).toBeNull();
  });
```

15c. Cùng file, thay test `'tour không có policy thì bỏ hẳn hàng thẻ, KHÔNG để lưới rỗng'` (dòng 84–88) bằng:

```tsx
  it('tour không có policy nào: vẫn còn ĐÚNG thẻ huỷ sinh từ luật', () => {
    render(<GoodToKnowPanel tour={{ ...TOUR, policies: [] } as unknown as TourDetailVM} />);
    expect(screen.getAllByTestId('policy-card')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /ride a motorbike/ })).toBeInTheDocument();
  });
```

Run: `pnpm --filter @tourism/web exec vitest run src/components/tours/panels/good-to-know-panel.spec.tsx`
Expected: FAIL — thẻ đầu vẫn là "Cancellation" của policy cũ; không có câu `ruleAfter`; tour không policy vẫn ra 0 thẻ.

- [ ] **Step 16: Cài đặt tab "Good to know", chạy thấy xanh**

16a. `apps/web/src/components/tours/panels/good-to-know-panel.tsx` — dòng 1, trước:

```tsx
import { messages } from '@tourism/i18n';
```

sau:

```tsx
import { windowDaysForTripLength } from '@tourism/contract';
import { messages } from '@tourism/i18n';
```

16b. Cùng file, dòng 27–29, trước:

```tsx
export function GoodToKnowPanel({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail.goodToKnow;
  const policies = orderPolicies(tour.policies);
```

sau:

```tsx
export function GoodToKnowPanel({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail.goodToKnow;
  const td = messages.cancellationDeadline;
  // Mục chính sách huỷ sinh TỪ LUẬT (spec §5.1) nên nó không đến từ `policies`;
  // policy loại CANCELLATION trên dữ liệu cũ bị bỏ hẳn, nếu không trang in hai
  // mốc khác nhau ("Free up to 10 days" cạnh N = 7) và khách tin cái sai.
  const policies = orderPolicies(tour.policies.filter((p) => p.kind !== 'CANCELLATION'));
```

16c. Cùng file, hàng thẻ policy (dòng 33–37), trước:

```tsx
      {policies.length > 0 ? (
        // `.pol` — 3 cột đều, gap 12. Xuống 1 cột ở mobile vì thẻ có văn bản
        // dài; ba cột 13px trên màn hẹp là ba cột chữ vụn.
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {policies.map((policy, index) => {
```

sau:

```tsx
      {/* `.pol` — 3 cột đều, gap 12. Xuống 1 cột ở mobile vì thẻ có văn bản
          dài; ba cột 13px trên màn hẹp là ba cột chữ vụn. Hàng thẻ LUÔN có mặt
          vì thẻ huỷ sinh từ luật, không còn nhánh `policies.length > 0`. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <RevealItem enter="rise" delay={0} className="h-full">
          <div
            data-testid="policy-card"
            className="h-full rounded-md border border-border bg-card p-4"
          >
            <p className="font-mono text-[11px] leading-4 tracking-[0.12em] text-muted-foreground uppercase">
              {t.policyKinds.CANCELLATION}
            </p>
            <h3 className="mt-1.5 mb-2 font-heading text-[17px] leading-6 font-medium text-foreground">
              {td.rule(windowDaysForTripLength(tour.durationDays))}
            </h3>
            <p className="text-[13px] leading-5 text-muted-foreground">{td.ruleAfter}</p>
          </div>
        </RevealItem>
        {policies.map((policy, index) => {
```

Trong thân `map`, `delay={index * STAGGER.grid}` đổi thành `delay={(index + 1) * STAGGER.grid}` (thẻ luật chiếm nhịp 0). Đóng khối, trước:

```tsx
            );
          })}
        </div>
      ) : null}
```

sau:

```tsx
          );
        })}
      </div>
```

Run: `pnpm --filter @tourism/web exec vitest run src/components/tours/panels/good-to-know-panel.spec.tsx`
Expected: PASS.

- [ ] **Step 17: Ba spec còn lại của trang tour — fixture và copy mới**

17a. `apps/web/src/components/tours/booking-rail.spec.tsx` — fixture `DEPARTURE` (dòng 15–22): thêm `bookingDeadline: '2026-09-07',` và `bookable: true,` sau `compareAtPrice`. Ghi tường minh để test không phụ thuộc giá trị Task 5 chọn.

17b. Cùng file, thêm test cuối `describe`:

```tsx
  /** Copy 15/09 (ADR-0041): MỘT câu chung cho mọi lý do "không đặt được" — chưa
   *  có đợt, hết chỗ, hoặc đã qua hạn đặt. Câu cũ hứa "still being confirmed",
   *  sai với tour đã có đủ ngày nhưng đã đóng cửa đặt. */
  it('không còn đợt đặt được: một câu chung, không còn "still being confirmed"', () => {
    render(<BookingRail {...BASE} departure={undefined} variant="rail" />);
    expect(screen.getByText('No departures are open for booking')).toBeInTheDocument();
    expect(screen.queryByText(/still being confirmed/i)).toBeNull();
  });
```

17c. `apps/web/src/components/tours/tour-hero.spec.tsx` — helper `dep` (dòng 17–26), trước:

```tsx
const dep = (id: string, price: string, compareAtPrice: string | null = null): DepartureVM =>
  ({
    id,
    startDate: '2026-09-19',
    endDate: '2026-09-20',
    effectivePrice: price,
    compareAtPrice,
    seatsLeft: 10,
    status: 'OPEN',
  }) as unknown as DepartureVM;
```

sau:

```tsx
const dep = (
  id: string,
  price: string,
  compareAtPrice: string | null = null,
  bookable = true,
): DepartureVM =>
  ({
    id,
    startDate: '2026-09-19',
    endDate: '2026-09-20',
    effectivePrice: price,
    compareAtPrice,
    seatsLeft: 10,
    // Chuyến 2 ngày → N = 3 (ADR-0041 §3).
    bookingDeadline: '2026-09-16',
    bookable,
    status: 'OPEN',
  }) as unknown as DepartureVM;
```

17d. Cùng file, thêm test cuối `describe` ngoài cùng:

```tsx
  it('giá "from" bỏ qua đợt đã qua hạn đặt, dù nó rẻ nhất', () => {
    // Cùng tập với giá "from" của `catalog.tours.list` (Task 5): đợt đã đóng
    // không còn là giá khách mua được, tính vào thì thẻ tour và hero in hai số.
    const tour = {
      ...TOUR,
      departures: [dep('a', '119.00', null, false), dep('b', '129.00')],
    } as unknown as TourDetailVM;
    render(<TourHero tour={tour} />);
    expect(screen.getByText(/\$129/)).toBeInTheDocument();
    expect(screen.queryByText(/\$119/)).toBeNull();
  });
```

17e. `apps/web/src/components/tours/panels/itinerary-panel.spec.tsx` — fixture `DEPARTURES` (dòng 9–18): thêm `bookingDeadline: '2026-09-07',` và `bookable: true,` sau `compareAtPrice`.

Run: `pnpm --filter @tourism/web exec vitest run src/components/tours/booking-rail.spec.tsx src/components/tours/tour-hero.spec.tsx src/components/tours/panels/itinerary-panel.spec.tsx`
Expected: PASS cả ba file.

- [ ] **Step 18: Viết test đỏ cho tóm tắt checkout**

18a. `apps/web/src/components/booking/checkout-summary.spec.tsx` — khối import (dòng 1–10), trước:

```tsx
import { render, screen } from '@testing-library/react';
import type { MediaItem } from '@tourism/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DepartureVM } from '@/lib/api/tours';
import {
  CheckoutSummary,
  type CheckoutSummaryTour,
  computeCancellationAssurance,
} from './checkout-summary';
```

sau:

```tsx
import { render, screen } from '@testing-library/react';
import type { MediaItem } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import type { DepartureVM } from '@/lib/api/tours';
import { CheckoutSummary, type CheckoutSummaryTour } from './checkout-summary';
```

18b. Cùng file, `makeDeparture` (dòng 11–21): thêm `bookingDeadline: '2026-09-05',` và `bookable: true,` sau `compareAtPrice: null,` (chuyến 12 ngày → N = 7; 12/09 − 7 = 05/09).

18c. Cùng file, thay test chip (dòng 113–138) bằng:

```tsx
  // Chip đổi lại thành "Free cancellation" 15/09 (ADR-0041): chip trung tính
  // "Flexible cancellation" tồn tại vì bảng bậc không giữ được lời hứa hoàn
  // 100%. Luật một hạn chót giữ được — mọi tour huỷ miễn phí tới ngày chót —
  // và ngày chót cụ thể in ngay dưới CTA.
  it('chip Free cancellation + Instant confirmation luôn hiển thị', () => {
    const { container } = render(
      <CheckoutSummary
        tour={makeTour()}
        departure={null}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(screen.getByText('Free cancellation')).toBeInTheDocument();
    expect(screen.queryByText('Flexible cancellation')).not.toBeInTheDocument();
    expect(screen.getByText('Instant confirmation')).toBeInTheDocument();
    // Markup chốt: Badge outline + chấm trạng thái nhỏ (KHÔNG còn pill nền
    // màu tự chế `bg-success/15`/`bg-info/10`) — chấm là tín hiệu màu duy
    // nhất, không nhuộm cả chữ.
    expect(container.querySelector('.bg-success.rounded-full')).toBeInTheDocument();
    expect(container.querySelector('.bg-info.rounded-full')).toBeInTheDocument();
    expect(container.querySelector('.bg-success\\/15')).not.toBeInTheDocument();
  });
```

18d. Cùng file, XOÁ trọn `describe('computeCancellationAssurance', …)` (dòng 188–227) và thay trọn `describe('CheckoutSummary — dòng trấn an hủy/hoàn tiền dưới CTA', …)` (dòng 229–307) bằng:

```tsx
/**
 * Dòng hạn chót dưới CTA. KHÔNG còn `vi.useFakeTimers()`: câu này in thẳng
 * `departure.bookingDeadline` do server tính (spec §2 Q7), nên chỉnh đồng hồ
 * máy — đúng thứ giáo viên hay thử lúc bảo vệ — không đổi được chữ nào.
 */
describe('CheckoutSummary — dòng hạn chót huỷ miễn phí dưới CTA', () => {
  it('departure: null → KHÔNG render dòng hạn chót nào', () => {
    render(
      <CheckoutSummary
        tour={makeTour()}
        departure={null}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(
      screen.queryByRole('link', { name: 'Read the cancellation policy' }),
    ).not.toBeInTheDocument();
  });

  it('in NGÀY CHÓT của đợt kèm giờ Việt Nam và link chính sách', () => {
    render(
      <CheckoutSummary
        tour={makeTour()}
        departure={makeDeparture({ bookingDeadline: '2026-10-17' })}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(
      screen.getByText(
        /Free cancellation until 17 Oct, 11:59 pm Vietnam time\. No refund after that\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the cancellation policy' })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );
  });

  it('không còn câu nào theo bậc phần trăm hay theo giờ máy khách', () => {
    render(
      <CheckoutSummary
        tour={makeTour()}
        departure={makeDeparture({ bookingDeadline: '2026-09-05' })}
        numAdults={1}
        numChildren={0}
        currency="USD"
        cta={<button type="submit">Continue</button>}
      />,
    );
    expect(screen.queryByText(/refund available until/)).toBeNull();
    expect(screen.queryByText(/This departure is close/)).toBeNull();
  });
});
```

Run: `pnpm --filter @tourism/web exec vitest run src/components/booking/checkout-summary.spec.tsx`
Expected: FAIL ở hai chỗ — chip vẫn in "Flexible cancellation" (khoá `freeCancellation` đã có từ Step 4c nhưng component chưa đọc), và dòng dưới CTA vẫn là "Full refund available until …", không có "11:59 pm Vietnam time". `computeCancellationAssurance` lúc này vẫn là export của module; nó bị xoá ở Step 19b, và spec đã thôi import nó từ 18a nên không có ca nào đỏ vì thiếu export.

- [ ] **Step 19: Cài đặt tóm tắt checkout, chạy thấy xanh**

19a. `apps/web/src/components/booking/checkout-summary.tsx` — khối import (dòng 1–13), trước:

```tsx
import type { MediaItem } from '@tourism/contract';
import { REFUND_POLICY_TIERS } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { motion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { DepartureVM } from '@/lib/api/tours';
import { computeBookingTotal } from '@/lib/checkout';
import { SPRING } from '@/lib/motion';
import { formatDateRange, formatMoney } from '@/lib/tours';
```

sau:

```tsx
import type { MediaItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { motion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { DepartureVM } from '@/lib/api/tours';
import { computeBookingTotal } from '@/lib/checkout';
import { SPRING } from '@/lib/motion';
import { formatChipDate, formatDateRange, formatMoney } from '@/lib/tours';
```

19b. Cùng file, XOÁ trọn dòng 27–97: `CancellationAssuranceKind`, `CancellationAssurance`, `utcDayIndex`, `subtractDays`, `computeCancellationAssurance` (cả JSDoc của chúng). Tất cả chỉ phục vụ bảng bậc đã gỡ.

19c. Cùng file, thay `CancellationAssuranceLine` (dòng 99–125) bằng:

```tsx
/**
 * Dòng hạn chót dưới CTA — in thẳng `bookingDeadline` của đợt đang chọn, do
 * server tính theo ngày Việt Nam (ADR-0041 §7). Web KHÔNG tự trừ N ngày và
 * KHÔNG so với giờ trình duyệt, nên chỉnh đồng hồ máy không đổi được câu này
 * (spec §2 Q7); cũng không có biến thể "until today" — luôn là một ngày cụ thể.
 *
 * Link `/cancellation-policy` là đích DUY NHẤT, không bịa link riêng cho từng
 * tour: chính sách thật sống ở đó.
 */
export function CancellationDeadlineLine({ departure }: { departure: DepartureVM }): ReactNode {
  const t = messages.cancellationDeadline;
  return (
    <p className="text-xs text-muted-foreground">
      {t.full(formatChipDate(departure.bookingDeadline))}{' '}
      <Link
        href="/cancellation-policy"
        className="underline underline-offset-4 hover:text-foreground"
      >
        {t.policyLink}
      </Link>
    </p>
  );
}
```

19d. Cùng file, dòng 217, trước:

```tsx
            {t.flexibleCancellation}
```

sau:

```tsx
            {t.freeCancellation}
```

19e. Cùng file, dòng 265–267, trước:

```tsx
        {/* Trấn an TRUNG THỰC ngay dưới CTA — chỉ hiện khi đã có đợt để tính
            mốc thật; `departure: null` không bịa mốc. */}
        {departure ? <CancellationAssuranceLine departure={departure} /> : null}
```

sau:

```tsx
        {/* Ngày chót ngay dưới CTA — chỉ hiện khi đã chọn đợt; `departure: null`
            không có ngày nào để in và cũng không được bịa ra. */}
        {departure ? <CancellationDeadlineLine departure={departure} /> : null}
```

Run: `pnpm --filter @tourism/web exec vitest run src/components/booking/checkout-summary.spec.tsx`
Expected: PASS.

- [ ] **Step 20: Hai thân bước của wizard — Review và Dates**

20a. `apps/web/src/components/booking/steps/step-review.tsx` — dòng 4, trước:

```tsx
import { CancellationAssuranceLine } from '../checkout-summary';
```

sau:

```tsx
import { CancellationDeadlineLine } from '../checkout-summary';
```

và dòng 63–67, trước:

```tsx
      {selected ? (
        <div className="mt-4 rounded-xl border bg-card p-3.5">
          <CancellationAssuranceLine departure={selected} />
        </div>
      ) : null}
```

sau:

```tsx
      {selected ? (
        <div className="mt-4 rounded-xl border bg-card p-3.5">
          <CancellationDeadlineLine departure={selected} />
        </div>
      ) : null}
```

20b. `apps/web/src/components/booking/steps/step-dates.tsx` — dòng 4, trước:

```tsx
import { departureStatus, formatDateRange, formatMoney } from '@/lib/tours';
```

sau:

```tsx
import { departureStatus, formatDateRange, formatMoney, isDepartureOpen } from '@/lib/tours';
```

và dòng 36–37, trước:

```tsx
        {departures.map((d) => {
          const soldOut = departureStatus(d.seatsLeft) === 'sold-out';
```

sau:

```tsx
        {departures.map((d) => {
          const soldOut = departureStatus(d.seatsLeft) === 'sold-out';
          // Đợt đã qua hạn đặt cũng vào trạng thái "hiện nhưng không bấm được",
          // cùng lý do với đợt hết chỗ: biến mất thì khách tưởng nhớ nhầm ngày.
          const pickable = isDepartureOpen(d);
```

`disabled={soldOut}` đổi thành `disabled={!pickable}`; hai class `soldOut && 'cursor-default opacity-60'` và `!soldOut && !isSelected && 'hover:bg-muted/50'` đổi `soldOut` thành `!pickable` / `pickable`. Dòng phụ (dòng 68–74), trước:

```tsx
                    {soldOut
                      ? messages.tourDetail.departures.soldOut
                      : departureStatus(d.seatsLeft) === 'limited'
                        ? messages.tourDetail.departures.seatsLimited(d.seatsLeft)
                        : messages.tourDetail.departures.seatsAvailable(d.seatsLeft)}
```

sau:

```tsx
                    {!d.bookable
                      ? messages.tourDetail.departures.closed
                      : soldOut
                        ? messages.tourDetail.departures.soldOut
                        : departureStatus(d.seatsLeft) === 'limited'
                          ? messages.tourDetail.departures.seatsLimited(d.seatsLeft)
                          : messages.tourDetail.departures.seatsAvailable(d.seatsLeft)}
```

20c. `apps/web/src/components/booking/steps/steps.spec.tsx` — fixture `DEPARTURE` (dòng 17–24): thêm `bookingDeadline: '2026-09-05',` và `bookable: true,` sau `compareAtPrice: null,`. Rồi thay test `'đợt hết chỗ vẫn HIỆN nhưng không bấm được'` (dòng 39–50) bằng:

```tsx
  it('đợt hết chỗ và đợt đã qua hạn đặt đều HIỆN nhưng không bấm được', () => {
    render(
      <StepDates
        {...SHARED}
        departures={[
          DEPARTURE,
          { ...DEPARTURE, id: 'dep-full', seatsLeft: 0 },
          { ...DEPARTURE, id: 'dep-closed', bookable: false },
        ]}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons.filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(2);
    expect(screen.getByText(messages.tourDetail.departures.closed)).toBeInTheDocument();
  });
```

Run: `pnpm --filter @tourism/web exec vitest run src/components/booking/steps/steps.spec.tsx`
Expected: PASS.

- [ ] **Step 21: Wizard đặt chỗ — đợt chọn sẵn**

21a. `apps/web/src/components/booking/booking-wizard.tsx` — dòng 22, trước:

```tsx
import { formatMoney } from '@/lib/tours';
```

sau:

```tsx
import { formatMoney, isDepartureOpen } from '@/lib/tours';
```

21b. Cùng file, dòng 67–70, trước:

```tsx
  // Chọn sẵn đợt CÒN CHỖ đầu tiên, không phải phần tử [0]: đợt đầu có thể đã hết
  // chỗ, và mở trang ra với một đợt không đặt được là dẫn vào ngõ cụt ngay.
  const [state, setState] = useState<BookingFormState>({
    departureId: departures.find((d) => d.seatsLeft > 0)?.id ?? null,
```

sau:

```tsx
  // Chọn sẵn đợt ĐẶT ĐƯỢC đầu tiên — còn chỗ VÀ còn hạn đặt — không phải phần
  // tử [0]: mở trang ra với một đợt không đặt được là dẫn vào ngõ cụt ngay, và
  // bước Pay sẽ trả `DEPARTURE_NOT_AVAILABLE` sau khi khách gõ xong cả form.
  const [state, setState] = useState<BookingFormState>({
    departureId: departures.find(isDepartureOpen)?.id ?? null,
```

21c. `apps/web/src/components/booking/booking-wizard.spec.tsx` — `makeDeparture` (dòng 26–36): thêm `bookingDeadline: '2026-09-05',` và `bookable: true,` sau `compareAtPrice: null,`. Rồi thay test `'chọn sẵn đợt CÒN CHỖ đầu tiên, không phải phần tử [0]'` (dòng 81–89) bằng:

```tsx
  it('chọn sẵn đợt ĐẶT ĐƯỢC đầu tiên — bỏ qua cả đợt hết chỗ lẫn đợt đã qua hạn đặt', () => {
    render(
      <BookingWizard
        {...BASE}
        departures={[
          makeDeparture({ id: 'dep-full', seatsLeft: 0 }),
          makeDeparture({ id: 'dep-closed', bookable: false }),
          makeDeparture({ id: 'dep-open', startDate: '2026-10-02', endDate: '2026-10-13' }),
        ]}
      />,
    );
    const pressed = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]?.textContent).toContain('2 Oct');
  });
```

> Ghi chú khi thi công: `BASE` là tên props dùng chung trong file đó — nếu file không có hằng ấy thì dựng lại đúng danh sách props như các test kế bên, đừng đổi chữ ký component.

Run: `pnpm --filter @tourism/web exec vitest run src/components/booking/booking-wizard.spec.tsx`
Expected: PASS.

- [ ] **Step 22: Trang `/tours/[slug]/book` — điều kiện đặt được và khối thay thế**

22a. `apps/web/src/app/(site)/tours/[slug]/book/page.tsx` — dòng 39–42, trước:

```tsx
  // Còn ít nhất một đợt đặt được không. `BookingModes` cũ tự rơi về nhánh Private
  // khi hết sạch chỗ; nay hai nhánh ở hai trang nên hành vi đó phải dựng lại
  // TƯỜNG MINH ở đây, nếu không khách vào đây gặp một wizard rỗng.
  const bookable = tour.departures.some((d) => d.seatsLeft > 0);
```

sau:

```tsx
  // Còn ít nhất một đợt đặt được không — còn chỗ VÀ còn hạn đặt. `BookingModes`
  // cũ tự rơi về nhánh Private khi hết sạch chỗ; nay hai nhánh ở hai trang nên
  // hành vi đó phải dựng lại TƯỜNG MINH ở đây, nếu không khách vào đây gặp một
  // wizard rỗng hoặc một wizard chỉ toàn đợt bấm không được.
  const bookable = tour.departures.some(isDepartureOpen);
```

22b. Cùng file, dòng 70–88, trước:

```tsx
/**
 * Tour đã bán hết mọi đợt — KHÔNG dựng wizard rỗng.
 *
 * Thay hành vi tự-rơi-về-Private của `BookingModes` (gỡ 19/08 khi hai nhánh
 * tách trang). Khách vẫn tới được nhánh khả thi, chỉ khác đường đi: một khối
 * giải thích cộng CTA sang `/enquire` — trang công khai, không cần đăng nhập.
 */
function SoldOut({ slug }: { slug: string }) {
  const t = messages.booking.wizard.soldOut;
  return (
    <div className="rounded-2xl border bg-card p-8 text-center">
      <h2 className="font-heading text-xl font-semibold">{t.heading}</h2>
      <p className="mx-auto mt-2 max-w-prose text-sm text-pretty text-muted-foreground">{t.body}</p>
      <ButtonLink className="mt-6" href={`/tours/${slug}/enquire`}>
        {t.cta}
      </ButtonLink>
    </div>
  );
}
```

sau:

```tsx
/**
 * Không còn đợt nào đặt được — KHÔNG dựng wizard rỗng.
 *
 * Thay hành vi tự-rơi-về-Private của `BookingModes` (gỡ 19/08 khi hai nhánh
 * tách trang). Khách vẫn tới được nhánh khả thi, chỉ khác đường đi: một khối
 * giải thích cộng CTA sang `/enquire` — trang công khai, không cần đăng nhập.
 *
 * Copy dùng CHUNG với rail, bar đáy và panel đặt chỗ (`tourDetail.departures`):
 * ba lý do khác nhau (chưa có đợt, hết chỗ, quá hạn đặt) nhưng việc khách làm
 * tiếp thì giống hệt, nên một câu là đủ và không có chỗ nào để lệch nhau.
 */
function NoOpenDepartures({ slug }: { slug: string }) {
  const t = messages.tourDetail.departures;
  return (
    <div className="rounded-2xl border bg-card p-8 text-center">
      <h2 className="font-heading text-xl font-semibold">{t.none}</h2>
      <p className="mx-auto mt-2 max-w-prose text-sm text-pretty text-muted-foreground">
        {t.noneBody}
      </p>
      <ButtonLink className="mt-6" href={`/tours/${slug}/enquire`}>
        {messages.tourDetail.booking.ask}
      </ButtonLink>
    </div>
  );
}
```

22c. Cùng file, dòng 63 đổi `<SoldOut slug={tour.slug} />` thành `<NoOpenDepartures slug={tour.slug} />`; và thêm `import { isDepartureOpen } from '@/lib/tours';` vào khối import (sau `fetchTourDetail`).

- [ ] **Step 23: Copy lỗi "Pay now" dùng lại khoá của Task 7**

23a. `apps/web/src/lib/booking-form.ts` dòng 186, trước:

```ts
    if (error.code === 'DEPARTURE_NOT_AVAILABLE') return t.DEPARTURE_NOT_OPEN;
```

sau:

```ts
    // Cùng MỘT câu với nút "Pay now" ở trang booking (Task 7):
    // `booking.errors.DEPARTURE_NOT_OPEN` đã xoá vì khai trùng câu ở hai khoá
    // là sửa một quên một. Tiền lệ: dòng throttle ngay trên cũng đọc
    // `accountActionErrors`.
    if (error.code === 'DEPARTURE_NOT_AVAILABLE') return messages.accountActionErrors.bookingClosed;
```

23b. `apps/web/src/lib/booking-form.spec.ts` dòng 211–214, trước:

```ts
  it('DEPARTURE_NOT_AVAILABLE (400) → câu đợt đã đóng', () => {
    expect(bookingSubmitErrorCopy(orpc('DEPARTURE_NOT_AVAILABLE', 400))).toBe(
      messages.booking.errors.DEPARTURE_NOT_OPEN,
    );
```

sau:

```ts
  it('DEPARTURE_NOT_AVAILABLE (400) → đúng câu "Booking for this departure has closed."', () => {
    expect(bookingSubmitErrorCopy(orpc('DEPARTURE_NOT_AVAILABLE', 400))).toBe(
      messages.accountActionErrors.bookingClosed,
    );
```

Run: `pnpm --filter @tourism/web exec vitest run src/lib/booking-form.spec.ts`
Expected: PASS.

- [ ] **Step 24: Chạy TOÀN BỘ test của web**

Run: `pnpm --filter @tourism/web exec vitest run --maxWorkers=4`
Expected: PASS cả hai project (`node` và `dom`). Đỏ thường gặp ở bước này và cách đọc:

- `Property 'bookable' is missing` ở một spec chưa liệt kê → fixture đó khai kiểu chặt; thêm hai field như Step 17a.
- `Unable to find an element with the text: No departures scheduled yet` → còn spec cũ bám copy đã đổi ở Step 4e; sửa sang `No departures are open for booking`.
- `messages.booking.wizard.soldOut is undefined` → còn chỗ đọc khối đã xoá ở Step 4a; grep `wizard.soldOut` toàn `apps/web` và chuyển sang `tourDetail.departures`.

- [ ] **Step 25: Biome và đọc lại diff**

```bash
pnpm lint:fix
git status --short
git diff --stat
```

Expected: `git status --short` chỉ liệt kê 27 file của task (cộng các mục untracked có sẵn như `docs/screenshot/` — KHÔNG add chúng). Nếu Biome sắp lại thứ tự import thì giữ bản Biome sắp. Kiểm mắt hai điểm dễ sai: không file `.md` nào trong diff, và `apps/web/src/components/tours/booking-rail.tsx` KHÔNG có mặt (chỉ spec của nó đổi).

- [ ] **Step 26: Cổng đầy đủ** (Docker Postgres đang chạy; Git Bash, gốc worktree)

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu lệnh exit 0. Hai chỗ task này có thể làm đỏ package KHÁC:

- `apps/admin` và `apps/mobile` nếu chúng còn đọc `booking.errors.DEPARTURE_NOT_OPEN`, `booking.wizard.soldOut` hoặc `checkoutSummary.cancellationAssurance` — grep ba tên đó toàn repo trước khi chạy; theo khảo sát 15/09 không còn consumer nào, nhưng đây là lưới canh rẻ hơn một vòng gate.
- `next build` của web cần API sống? Không: trang `/tours/[slug]/book` là dynamic và không nằm trong `generateStaticParams`.

- [ ] **Step 27: Commit**

```bash
git add libs/shared/i18n/src/lib/messages.ts \
  apps/web/src/lib/tours.ts apps/web/src/lib/tours.spec.ts \
  apps/web/src/lib/tour-detail.ts apps/web/src/lib/tour-detail.spec.ts \
  apps/web/src/lib/booking-form.ts apps/web/src/lib/booking-form.spec.ts \
  apps/web/src/components/tours/departure-selection.tsx \
  apps/web/src/components/tours/tour-media-panel.tsx \
  apps/web/src/components/tours/tour-media-panel.spec.tsx \
  apps/web/src/components/tours/departure-dialog.tsx \
  apps/web/src/components/tours/departure-dialog.spec.tsx \
  apps/web/src/components/tours/tour-hero.spec.tsx \
  apps/web/src/components/tours/booking-rail.spec.tsx \
  apps/web/src/components/tours/panels/departures-panel.tsx \
  apps/web/src/components/tours/panels/departures-panel.spec.tsx \
  apps/web/src/components/tours/panels/good-to-know-panel.tsx \
  apps/web/src/components/tours/panels/good-to-know-panel.spec.tsx \
  apps/web/src/components/tours/panels/itinerary-panel.spec.tsx \
  apps/web/src/components/booking/checkout-summary.tsx \
  apps/web/src/components/booking/checkout-summary.spec.tsx \
  apps/web/src/components/booking/booking-wizard.tsx \
  apps/web/src/components/booking/booking-wizard.spec.tsx \
  apps/web/src/components/booking/steps/step-dates.tsx \
  apps/web/src/components/booking/steps/step-review.tsx \
  apps/web/src/components/booking/steps/steps.spec.tsx \
  "apps/web/src/app/(site)/tours/[slug]/book/page.tsx"
git commit -m "feat(web): trang tour và checkout theo hạn chót một mốc mỗi chuyến"
```

Không push (Global Constraints).
---

### Task 11: Văn bản pháp lý, FAQ, câu quảng bá và dòng hạn chót trong email

**Files:**

- Modify: `libs/shared/i18n/src/lib/legal/cancellation.ts` (thay toàn bộ)
- Test: `libs/shared/i18n/src/lib/legal/cancellation.spec.ts` (tạo mới)
- Delete: `libs/shared/i18n/src/lib/legal/refund-tiers.ts`
- Modify: `libs/shared/i18n/src/index.ts` (xoá dòng export `refund-tiers.js`)
- Modify: `libs/shared/i18n/src/lib/legal/terms.ts` (dòng 1–3; khối `Changes by you`
  dòng 43–48; khối `Cancellations and refunds by you` dòng 49–55; đoạn thứ hai của
  `Changes or cancellation by us` dòng 60)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (thêm import ở đầu file; khối FAQ
  `Cancellations & changes` dòng 1150–1169)
- Modify: `apps/web/src/mocks/faq.ts` (dòng 1, 16–20)
- Test: `apps/web/src/mocks/mocks.spec.ts` (test `5 câu FAQ pre-sales…`, dòng 102–108)
- Test: `apps/web/src/lib/legal-content.spec.ts` (khối `DOCS` dòng 9–13, test ngày
  cập nhật dòng 31–33; thêm một `describe` ở cuối)
- Modify: `apps/web/src/components/top-bar.tsx` (dòng 19–23)
- Modify: `apps/web/src/components/about/about-cta-video.tsx` (dòng 17–18)
- Modify: `apps/web/src/components/about/about-values.tsx` (dòng 47–56)
- Modify: `apps/web/src/components/home/trust-strip.tsx` (thay toàn bộ)
- Test: `apps/web/src/components/marketing-cancellation-copy.spec.tsx` (tạo mới)
- Modify: `apps/api/src/worker/emails/render-email.tsx` (import dòng 1–4; helper mới
  sau `formatDate` dòng 79; case `BOOKING_CONFIRMATION` dòng 121–171)
- Test: `apps/api/src/worker/resend.deliverer.spec.ts` (thêm một `describe` sau khối
  `renderEmail payload rendering`)

**Interfaces:**

- Consumes:
  - Task 1 (`@tourism/contract`): `CANCELLATION_WINDOW_RULES` (`readonly CancellationWindowRule[]`,
    mỗi phần tử `{ minTripDays, maxTripDays: number | null, windowDays }`),
    `cancellationDeadline(startDate: string, endDate: string): string`.
  - Task 7 (`@tourism/i18n`): `messages.cancellationDeadline.policyLink`
    (`'Read the cancellation policy'`).
- Produces:
  - `libs/shared/i18n/src/lib/legal/cancellation.ts`, tái xuất qua `@tourism/i18n`:
    - `export function cancellationWindowBullets(): string[];`
    - `export function cancellationWindowSentence(): string;`
    - giữ `export const cancellationDoc: LegalDoc` (nội dung viết lại).
  - Không còn export `refundTierBullets`, `refundTierSentence`.

- [ ] **Step 1: Kiểm tiền đề của Task 1, Task 7, Task 8**

Chạy (Git Bash, gốc worktree):

```bash
grep -n "CANCELLATION_WINDOW_RULES\|export function cancellationDeadline" libs/shared/contract/src/schemas/refund-policy.ts
grep -n "policyLink: 'Read the cancellation policy'" libs/shared/i18n/src/lib/messages.ts
grep -n "REFUND_GRACE_HOURS" libs/shared/i18n/src/lib/messages.ts
```

Expected: lệnh 1 in ít nhất hai dòng (khai hằng và khai hàm); lệnh 2 in một dòng;
lệnh 3 KHÔNG in gì (Task 8 đã gỡ import và khối admin dùng nó). Thiếu/thừa thì dừng
lại, báo session gốc: Task 1, Task 7 hoặc Task 8 chưa xong.

- [ ] **Step 2: Viết test đỏ cho bộ sinh câu hạn chót** — tạo
`libs/shared/i18n/src/lib/legal/cancellation.spec.ts`:

```ts
import { CANCELLATION_WINDOW_RULES } from '@tourism/contract';
import {
  cancellationDoc,
  cancellationWindowBullets,
  cancellationWindowSentence,
} from './cancellation.js';

/**
 * Bảng hạn chót vừa là COPY vừa là LUẬT TIỀN, nên nó chỉ được có MỘT nguồn:
 * `CANCELLATION_WINDOW_RULES` ở contract. Bản tiền nhiệm (`refund-tiers.ts`)
 * ra đời đúng vì hai văn bản chép tay cùng một bảng rồi cả hai cùng bỏ rơi
 * ngày 14 — spec này giữ lại bài học đó cho luật mới.
 */
describe('câu hạn chót sinh từ CANCELLATION_WINDOW_RULES', () => {
  it('mỗi luật đúng một gạch đầu dòng — không thiếu, không thừa', () => {
    expect(cancellationWindowBullets()).toHaveLength(CANCELLATION_WINDOW_RULES.length);
  });

  it('in đúng ba dòng của bảng hạn chót', () => {
    expect(cancellationWindowBullets()).toEqual([
      'Day trips: free cancellation up to 1 day before departure.',
      'Trips of 2–3 days: free cancellation up to 3 days before departure.',
      'Trips of 4 days or more: free cancellation up to 7 days before departure.',
    ]);
  });

  it('gói cùng bảng ấy thành MỘT câu, cho /terms và FAQ', () => {
    expect(cancellationWindowSentence()).toBe(
      'Every tour is free to cancel until its own deadline: day trips, 1 day before departure; trips of 2–3 days, 3 days before departure; trips of 4 days or more, 7 days before departure.',
    );
  });

  it('không còn dấu vết bảng bậc cũ (100/50/25/0) trong câu sinh ra', () => {
    const all = [...cancellationWindowBullets(), cancellationWindowSentence()].join(' ');
    expect(all).not.toMatch(/%/);
    expect(all).not.toMatch(/\b30 days\b/);
  });

  it('văn bản chính sách DÙNG chính các dòng ấy, không chép tay lại', () => {
    const section = cancellationDoc.sections.find(
      (s) => s.heading === 'Your free-cancellation deadline',
    );
    expect(section?.bullets).toEqual(cancellationWindowBullets());
  });

  it('chính sách nói giờ Việt Nam — hạn chót không đọc theo đồng hồ máy khách', () => {
    expect(JSON.stringify(cancellationDoc)).toMatch(/11:59 pm Vietnam time/);
  });
});
```

- [ ] **Step 3: Chạy test i18n, xác nhận đỏ**

Run: `pnpm --filter @tourism/i18n exec vitest run src/lib/legal/cancellation.spec.ts`
Expected: FAIL — `cancellationWindowBullets`, `cancellationWindowSentence` không phải
export của `./cancellation.js`; `cancellationDoc` không có section
`Your free-cancellation deadline`.

- [ ] **Step 4: Viết test đỏ phía web cho nội dung pháp lý và FAQ mock**

4a. `apps/web/src/lib/legal-content.spec.ts` — thay khối `DOCS` (dòng 9–13):

```ts
const DOCS = [
  ['terms', termsDoc],
  ['privacy', privacyDoc],
  ['cancellation', cancellationDoc],
] as const;
```

bằng (mang theo ngày cập nhật của TỪNG doc — hai văn bản huỷ/hoàn viết lại ở
ADR-0041 nên không còn cùng ngày với privacy):

```ts
const DOCS = [
  ['terms', termsDoc, 'Last updated: 15 September 2026'],
  ['privacy', privacyDoc, 'Last updated: 25 July 2026'],
  ['cancellation', cancellationDoc, 'Last updated: 15 September 2026'],
] as const;
```

4b. Cùng file, thay test ngày cập nhật (dòng 31–33):

```ts
  it.each(DOCS)('%s ghi ngày cập nhật thống nhất', (_name, doc) => {
    expect(doc.updated).toBe('Last updated: 25 July 2026');
  });
```

bằng:

```ts
  it.each(DOCS)('%s ghi đúng ngày cập nhật của chính nó', (_name, doc, updated) => {
    expect(doc.updated).toBe(updated);
  });
```

4c. Cùng file, thêm vào CUỐI file:

```ts
/**
 * ADR-0041 để lại đúng MỘT luật huỷ cho mọi tour. Hai văn bản pháp lý là nơi
 * lời hứa cũ sống dai nhất (bảng bậc, ân hạn 24 giờ, hẹn "2 business days",
 * đổi ngày, vế "recover from suppliers"), nên khoá cả hai chiều: ý mới phải có
 * mặt, ý đã gỡ không được lẻn về.
 */
describe('chính sách huỷ một hạn chót (ADR-0041)', () => {
  const both = JSON.stringify([cancellationDoc, termsDoc]);

  it('bảng hạn chót của /cancellation-policy sinh từ luật chung, đúng ba dòng', () => {
    const section = cancellationDoc.sections.find(
      (s) => s.heading === 'Your free-cancellation deadline',
    );
    expect(section?.bullets).toEqual(cancellationWindowBullets());
    expect(section?.bullets).toHaveLength(3);
  });

  it('nói rõ chuyến ngừng nhận đặt đúng lúc hạn chót hết, và lối liên hệ khi cần đi gấp', () => {
    const section = cancellationDoc.sections.find((s) => s.heading === 'When bookings close');
    expect(JSON.stringify(section)).toMatch(/contact us/i);
  });

  it('công ty huỷ chuyến thì hoàn 100%', () => {
    expect(JSON.stringify(cancellationDoc)).toMatch(/100% of what you paid/);
  });

  it('nói thời gian tiền về và phương thức thanh toán ban đầu', () => {
    expect(JSON.stringify(cancellationDoc)).toMatch(/5–10 business days/);
    expect(JSON.stringify(cancellationDoc)).toMatch(/payment method you used at checkout/);
  });

  it('không còn bảng bậc, ân hạn 24 giờ, hẹn 2 ngày làm việc hay vế "recover from suppliers"', () => {
    for (const pattern of [
      /refund schedule/i,
      /24 hours/i,
      /2 business days/i,
      /recover from suppliers/i,
      /50% refund/i,
    ]) {
      expect(both).not.toMatch(pattern);
    }
  });

  it('không hứa đổi ngày ở cả hai văn bản', () => {
    for (const pattern of [/reschedule/i, /date change/i, /amendment fee/i, /re-arrange/i]) {
      expect(both).not.toMatch(pattern);
    }
  });
});
```

4d. Cùng file, sửa dòng import đầu tiên (dòng 1):

```ts
import { cancellationDoc, privacyDoc, termsDoc } from '@tourism/i18n';
```

thành

```ts
import { cancellationDoc, cancellationWindowBullets, privacyDoc, termsDoc } from '@tourism/i18n';
```

4e. `apps/web/src/mocks/mocks.spec.ts` — trong test `'5 câu FAQ pre-sales, câu hỏi duy nhất'`
(dòng 102–108), chèn ngay TRƯỚC dấu `});` đóng test:

```ts
    // ADR-0041: một luật cho mọi tour. Câu trả lời không được trỏ về bảng bậc
    // đã gỡ, không được hứa ân hạn theo giờ, không được hứa đổi ngày.
    const cancelItem = FAQ_ITEMS.find((f: { question: string }) => f.question.includes('cancel'));
    expect(cancelItem?.answer).toMatch(/free to cancel/i);
    expect(cancelItem?.answer).not.toMatch(/refund schedule|24 hours|move dates/i);
```

- [ ] **Step 5: Chạy test web (project node), xác nhận đỏ**

Run: `pnpm --filter @tourism/web exec vitest run src/lib/legal-content.spec.ts src/mocks/mocks.spec.ts`
Expected: FAIL — `cancellationWindowBullets` không phải export của `@tourism/i18n`;
`cancellationDoc.updated` vẫn là `'Last updated: 25 July 2026'`; câu FAQ mock vẫn
mang "refund schedule" và "24 hours".

- [ ] **Step 6: Viết lại `libs/shared/i18n/src/lib/legal/cancellation.ts`** (thay toàn bộ):

```ts
import { CANCELLATION_WINDOW_RULES } from '@tourism/contract';
import type { LegalDoc } from './legal-page.js';

/**
 * `[1, 1]` → `'day trips'`; `[2, 3]` → `'trips of 2–3 days'`;
 * `[4, null]` → `'trips of 4 days or more'`. Viết thường vì cụm này đứng GIỮA
 * câu ở `/terms` và FAQ; chỗ cần chữ hoa thì `capitalise` lo.
 */
function tripLengthPhrase(minTripDays: number, maxTripDays: number | null): string {
  if (maxTripDays === null) return `trips of ${minTripDays} days or more`;
  if (minTripDays === maxTripDays)
    return minTripDays === 1 ? 'day trips' : `${minTripDays}-day trips`;
  return `trips of ${minTripDays}–${maxTripDays} days`;
}

/** `1` → `'1 day'`; `7` → `'7 days'` — số nhiều đúng, không "1 days". */
function dayCount(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

/** Viết hoa chữ cái đầu: gạch đầu dòng mở đầu bằng cụm độ dài chuyến. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Ba gạch đầu dòng của bảng hạn chót, sinh từ CHÍNH hằng contract.
 *
 * Không gõ tay, cùng lý do đã khai tử bản bậc cũ: hai văn bản từng chép tay một
 * bảng rồi cả hai cùng bỏ rơi ngày 14. Ở đây rủi ro còn lớn hơn — hạn chót vừa
 * là câu chữ cho khách đọc vừa là mốc server dùng để khoá đặt chỗ và tính tiền
 * hoàn, nên văn bản lệch hằng là văn bản nói dối.
 */
export function cancellationWindowBullets(): string[] {
  return CANCELLATION_WINDOW_RULES.map(
    (rule) =>
      `${capitalise(tripLengthPhrase(rule.minTripDays, rule.maxTripDays))}: free cancellation up to ${dayCount(rule.windowDays)} before departure.`,
  );
}

/**
 * Cùng bảng ấy gói thành MỘT câu, cho `/terms` và FAQ — nơi luật huỷ chỉ là một
 * đoạn trong tài liệu dài, không phải chương riêng.
 */
export function cancellationWindowSentence(): string {
  const parts = CANCELLATION_WINDOW_RULES.map(
    (rule) =>
      `${tripLengthPhrase(rule.minTripDays, rule.maxTripDays)}, ${dayCount(rule.windowDays)} before departure`,
  );
  return `Every tour is free to cancel until its own deadline: ${parts.join('; ')}.`;
}

/**
 * Cancellation & Refund Policy — bản ADR-0041: MỘT hạn chót mỗi chuyến, dài
 * ngắn theo độ dài chuyến, tính theo ngày lịch Việt Nam.
 *
 * Bản trước (25/07) tả một luồng không còn tồn tại và ba thứ nay đã bị gỡ:
 *
 * - **Bảng bậc 100/50/25/0** — thay bằng nhị phân "trong hạn hoàn đủ / quá hạn
 *   không hoàn". Bậc chỉ có nghĩa khi có người ngồi duyệt từng ca; khách tự huỷ
 *   ngay thì một con số phải đúng ngay lúc bấm.
 * - **Ân hạn 24 giờ** — sinh ra để vá đúng chỗ bậc làm khách thiệt (đặt hôm nay,
 *   chuyến sau hai tuần, đổi ý ngay tối đó mà vẫn mất tiền). Bỏ bậc thì ân hạn
 *   hết lý do tồn tại; giữ lại chỉ là chồng luật lên luật.
 * - **"A cancellation request does not cancel the booking automatically"** kèm
 *   hẹn "khoảng 2 ngày làm việc" — hàng đợi duyệt đã gỡ, huỷ là huỷ ngay.
 *
 * Cũng bỏ hai câu bất khả thi hành của bản cũ: lời hứa đổi ngày (KHÔNG có luồng
 * nào làm việc đó) và vế "based on what we can recover from suppliers" (hệ thống
 * không biết chi phí nhà cung cấp, nên câu ấy chỉ làm con số công bố mập mờ).
 */
export const cancellationDoc: LegalDoc = {
  title: 'Cancellation & Refund Policy',
  breadcrumb: 'Cancellation & Refund Policy',
  updated: 'Last updated: 15 September 2026',
  reviewNote:
    'This document is sample content for a student capstone project, not legal advice. Nexora does not sell real trips here: payments run entirely in Stripe and PayPal test/sandbox mode, and no money changes hands.',
  intro: [
    'One deadline per trip, and the same rule on every tour we sell. Cancel on or before it and you get everything back; cancel after it and the booking is no longer refundable. Nothing here depends on which tour you picked or on anyone reviewing your case.',
    'This policy applies alongside our Terms & Conditions. Where the two say anything about cancelling, this page is the detailed one.',
    'Because this site runs payments in test/sandbox mode, every refund described below is simulated: nothing was charged, so nothing is returned to a real account.',
  ],
  sections: [
    {
      heading: 'Your free-cancellation deadline',
      paragraphs: [
        'Every departure has one deadline, and how long the trip runs is the only thing that sets it. Longer trips need more notice because more is committed further ahead — rooms, boats, guides who turned other work down.',
        'The deadline falls at 11:59 pm Vietnam time (GMT+7) on the day shown. That clock is the only one we use: your own time zone does not move the deadline, and neither does changing the time on your device.',
        'You never have to work the date out yourself. We print it on the tour page, at checkout, in your confirmation email, and on the booking itself.',
      ],
      bullets: cancellationWindowBullets(),
    },
    {
      heading: 'When bookings close',
      paragraphs: [
        'A departure stops taking new bookings at the same moment its deadline passes. We close it there on purpose: past that point a booking could never be cancelled for a refund, and we are not willing to sell a seat on terms we would not accept ourselves.',
        'If you want to join a trip that has already closed, contact us with the departure date and party size. We will tell you honestly whether it can still be arranged.',
      ],
    },
    {
      heading: 'Cancelling your booking',
      paragraphs: [
        'Open the booking under “My bookings” in your account and choose “Cancel booking”. It is cancelled immediately — there is no request to submit, no queue, and nobody to wait for.',
        'Cancel on or before the deadline and you are refunded in full. Cancel after it, or simply not turn up on the day, and no refund is due: by then the guide, the rooms and the transport are already paid for on your behalf.',
        'You can cancel online at any time before your departure date, even once the deadline has passed — you just will not be refunded. Once the trip has started, contact us instead.',
      ],
    },
    {
      heading: 'How refunds are processed',
      paragraphs: [
        'Refunds are returned to the payment method you used at checkout (the same card or PayPal account), in the currency you paid in. We are not able to send a refund anywhere else.',
        'The refund is issued the moment you cancel. It then usually takes 5–10 business days to appear on your statement — that part is up to your bank or card provider, not to us.',
      ],
    },
    {
      heading: 'If we cancel your departure',
      paragraphs: [
        'If we cancel a departure — for any reason at all, including weather, safety, or too few travellers — you get 100% of what you paid us back, whatever your deadline said. The deadline binds you, not us.',
        'We are not responsible for costs you arranged elsewhere, such as flights, visas, or insurance, so we recommend travel insurance that covers them.',
      ],
    },
    {
      heading: 'Unpaid (pending) bookings',
      paragraphs: [
        'If you start a booking but never complete payment, nothing is charged and nothing is owed. Unpaid bookings are released automatically after a short time, and you can release one yourself from your account at any moment.',
      ],
    },
    {
      heading: 'Special circumstances',
      paragraphs: [
        'Illness, bereavement, a refused visa — life does not keep to a deadline. If something serious happened, contact us with your booking code and tell us what it was. We cannot promise an outcome, but a person will read it and decide.',
      ],
    },
  ],
};
```

- [ ] **Step 7: Xoá `refund-tiers.ts`, sửa `index.ts`, viết lại phần huỷ/hoàn của `terms.ts`**

7a. Xoá file (lệnh này ghi luôn việc xoá vào index của git):

```bash
git rm libs/shared/i18n/src/lib/legal/refund-tiers.ts
```

7b. `libs/shared/i18n/src/index.ts` — xoá đúng dòng:

```ts
export * from './lib/legal/refund-tiers.js';
```

7c. `libs/shared/i18n/src/lib/legal/terms.ts` — dòng 1–3, trước:

```ts
import { REFUND_GRACE_HOURS } from '@tourism/contract';
import type { LegalDoc } from './legal-page.js';
import { refundTierSentence } from './refund-tiers.js';
```

sau:

```ts
import { cancellationWindowSentence } from './cancellation.js';
import type { LegalDoc } from './legal-page.js';
```

7d. Cùng file, thay trọn khối `Changes by you` (dòng 43–48), trước:

```ts
    {
      heading: 'Changes by you',
      paragraphs: [
        'If you wish to change a confirmed booking — such as dates, the itinerary, or party members — we will try to accommodate the request subject to availability. Changes may incur supplier charges and an amendment fee, which we will tell you about before any change is made.',
      ],
    },
```

sau (không còn luồng sửa booking nào tồn tại; nói đúng cách duy nhất có thật):

```ts
    {
      heading: 'Changes by you',
      paragraphs: [
        'We cannot move a confirmed booking to another departure or another party size. If your plans move, cancel the booking — free while it is still inside its deadline — and book the departure you want instead. Contact us first if that departure has already closed.',
      ],
    },
```

7e. Cùng file, thay trọn khối `Cancellations and refunds by you` (dòng 49–55), trước:

```ts
    {
      heading: 'Cancellations and refunds by you',
      paragraphs: [
        'If you need to cancel, request it from your account (open the booking under “My bookings” and choose “Request cancellation”) or contact our team. Our team reviews each request and arranges any refund to your original payment method.',
        `${refundTierSentence()} Cancel within ${REFUND_GRACE_HOURS} hours of paying and you get a full refund regardless of that schedule. Otherwise we count whole calendar days (in UTC) from the date you send the request to your departure date. Where a tour advertises free cancellation up to a set number of days before departure, that promise applies instead and can only improve on this schedule. Some payments — non-refundable deposits or third-party fees — may sit outside it; the full details are in our Cancellation & Refund Policy.`,
      ],
    },
```

sau:

```ts
    {
      heading: 'Cancellations and refunds by you',
      paragraphs: [
        'If you need to cancel, open the booking under “My bookings” in your account and choose “Cancel booking”. The booking is cancelled at once and any refund is returned to the payment method you used at checkout.',
        `${cancellationWindowSentence()} The deadline falls at 11:59 pm Vietnam time on the day shown with your booking. Cancel on or before it and you are refunded in full; cancel after it, or fail to travel, and no refund is due. A departure also stops accepting bookings once its deadline has passed. The full details are in our Cancellation & Refund Policy.`,
      ],
    },
```

7f. Cùng file, đoạn thứ hai của `Changes or cancellation by us` (dòng 60), trước:

```ts
        'If we have to cancel your tour for reasons within our control, you may choose an alternative departure of equivalent value or a full refund of what you have paid us. Except as required by law, we are not liable for incidental expenses you may have incurred (such as flights or visas).',
```

sau (không có luồng chuyển chuyến; công ty huỷ thì hoàn 100%, spec §5.5 ý 5):

```ts
        'If we have to cancel your tour, for any reason, we refund 100% of what you have paid us. Except as required by law, we are not liable for incidental expenses you may have incurred (such as flights or visas).',
```

- [ ] **Step 8: Viết lại nhóm FAQ huỷ/hoàn trong `libs/shared/i18n/src/lib/messages.ts`**

8a. Đầu file (Task 8 đã gỡ dòng `import { REFUND_GRACE_HOURS } …`), trước:

```ts
import { resilience } from './resilience.js';
```

sau:

```ts
import { cancellationWindowSentence } from './legal/cancellation.js';
import { resilience } from './resilience.js';
```

(Không có chu trình: `legal/cancellation.ts` chỉ import `@tourism/contract` và
`./legal-page.js`, không đụng `messages.ts`.)

8b. Thay trọn nhóm FAQ (dòng 1150–1169), trước:

```ts
      {
        title: 'Cancellations & changes',
        items: [
          {
            question: 'What is your cancellation policy?',
            answer:
              'Cancellation terms vary by tour and departure, and are shown on each tour page before you book. Our team is always happy to clarify the details.',
          },
          {
            question: 'Can I change my travel dates?',
            answer:
              'Date changes are usually possible subject to availability. Reach out as early as you can and we will do our best to re-arrange your trip.',
          },
          {
            question: 'What happens if you cancel a departure?',
            answer:
              'If we ever cancel a departure, you can move to another date or receive a full refund of what you paid us.',
          },
        ],
      },
```

sau:

```ts
      {
        // ADR-0041: "& changes" rời khỏi tiêu đề vì không còn luồng đổi ngày nào
        // để hứa. Câu trả lời đầu SINH từ `CANCELLATION_WINDOW_RULES` — FAQ và
        // trang chính sách không được phép nói hai con số khác nhau.
        title: 'Cancellations & refunds',
        items: [
          {
            question: 'What is your cancellation policy?',
            answer: `${cancellationWindowSentence()} Cancel on or before that deadline — 11:59 pm Vietnam time — and every dollar comes back; cancel after it and no refund is due. The exact date is shown on the tour page, at checkout, and on your booking.`,
          },
          {
            question: 'Can I change my travel dates?',
            answer:
              'Not directly — we cannot move a booking to another departure. While your booking is still inside its free-cancellation deadline, cancel it for a full refund and book the date you want instead. Past that deadline the departure is closed to new bookings anyway, so contact us and we will tell you what is possible.',
          },
          {
            question: 'What happens if you cancel a departure?',
            answer:
              'If we cancel a departure, for any reason, you get 100% of what you paid back to your original payment method. The deadline binds you, not us.',
          },
        ],
      },
```

- [ ] **Step 9: Build contract và i18n** (web/api đọc hai gói này qua `dist`)

```bash
pnpm --filter @tourism/contract build
pnpm --filter @tourism/i18n build
```

Expected: cả hai exit 0.

- [ ] **Step 10: Chạy test i18n, xác nhận xanh**

Run: `pnpm --filter @tourism/i18n exec vitest run`
Expected: PASS toàn bộ — `cancellation.spec.ts` 6 test, `messages.spec.ts` và
`i18n.spec.ts` giữ nguyên số test cũ.

- [ ] **Step 11: Sửa câu FAQ mock của web** — `apps/web/src/mocks/faq.ts`, dòng 1, trước:

```ts
import { REFUND_GRACE_HOURS } from '@tourism/contract';
import type { MockFaqItem } from './types.js';
```

sau:

```ts
import { cancellationWindowSentence } from '@tourism/i18n';
import type { MockFaqItem } from './types.js';
```

Cùng file, dòng 16–20, trước:

```ts
    question: 'What if I need to cancel?',
    // Vá 04/09 — câu cũ hứa HAI thứ site không làm được: hoàn 100% ở mốc 48
    // giờ (chính sách nói dưới 7 ngày là 0%) và "rebook you to a later date"
    // (KHÔNG có luồng đổi ngày nào tồn tại). Nay nói đúng thứ có thật, và trỏ
    // về bảng bậc thay vì nhắc lại một con số sẽ trôi lệch.
    answer: `Request it from your account and we handle it — no phone queue. How much you get back follows our published refund schedule: the earlier you tell us, the more comes back, and anything cancelled within ${REFUND_GRACE_HOURS} hours of paying is refunded in full. Want to move dates instead? Contact us and we will see what the tour allows.`,
```

sau:

```ts
    question: 'What if I need to cancel?',
    // Vá 04/09 gỡ "48 giờ" và lời hứa đổi ngày; ADR-0041 gỡ nốt bảng bậc mà bản
    // ấy trỏ về ("the earlier you tell us, the more comes back" — bảng đó không
    // còn). Câu sinh từ `CANCELLATION_WINDOW_RULES` nên không thể trôi lệch khỏi
    // trang chính sách.
    answer: `Cancel from your account in one click — no form, no phone queue. ${cancellationWindowSentence()} Cancel on or before that deadline and the full amount goes back to the card or PayPal account you paid with, usually within 5–10 business days. After it, the booking is no longer refundable.`,
```

- [ ] **Step 12: Chạy test web (project node), xác nhận xanh**

Run: `pnpm --filter @tourism/web exec vitest run src/lib/legal-content.spec.ts src/mocks/mocks.spec.ts`
Expected: PASS — `legal-content.spec.ts` 20 test (14 cũ, gồm 4 khối `it.each` × 3 doc
và 2 test lẻ, cộng 6 test mới); `mocks.spec.ts` giữ nguyên số test cũ.

- [ ] **Step 13: Viết test đỏ cho bốn bề mặt quảng bá** — tạo
`apps/web/src/components/marketing-cancellation-copy.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AboutCtaVideo } from './about/about-cta-video';
import { AboutValues } from './about/about-values';
import { TrustStrip } from './home/trust-strip';
import { TopBar } from './top-bar';

/**
 * Bốn bề mặt quảng bá nói về chuyện huỷ: thanh trên cùng (MỌI trang), dải cam
 * kết trang chủ, hai khối trang About. Chúng không có spec riêng và đã hai lần
 * nói sai chính sách — "48 hours" hứa hoàn 100% ở đúng mốc bảng bậc trả 0%
 * (vá 04/09), rồi "on most tours" cộng "refund schedule" trỏ về một bảng nay đã
 * bị ADR-0041 gỡ. Spec này khoá cả hai chiều: câu đúng phải có mặt, câu đã gỡ
 * không được lẻn về.
 */
beforeAll(() => {
  // `motion.div` với `whileInView` cần IntersectionObserver; jsdom không có.
  // Spec này không quan sát animation nên stub rỗng là đủ.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

/** Lời hứa đã gỡ — không bề mặt nào được mang bất kỳ mẫu nào. */
const FORBIDDEN = [
  /most tours/i,
  /most departures/i,
  /refund schedule/i,
  /\b48 hours\b/i,
  /\b24 hours\b/i,
  /move dates/i,
  /change your dates/i,
];

const SURFACES: Array<[string, () => ReactElement]> = [
  ['thanh trên cùng', () => <TopBar />],
  ['dải cam kết trang chủ', () => <TrustStrip />],
  ['khối lời hứa trang About', () => <AboutValues />],
  ['dải CTA trang About', () => <AboutCtaVideo />],
];

describe.each(SURFACES)('%s', (_name, ui) => {
  it('nói "Free cancellation" — một câu đúng cho mọi tour', () => {
    const { container } = render(ui());
    expect(container.textContent).toMatch(/Free cancellation/i);
  });

  it('không còn lời hứa đã gỡ (bảng bậc, ân hạn theo giờ, đổi ngày, "most tours")', () => {
    const { container } = render(ui());
    for (const pattern of FORBIDDEN) expect(container.textContent).not.toMatch(pattern);
  });
});

describe('dải cam kết trang chủ', () => {
  it('dẫn thẳng sang trang chính sách, dùng CHUNG nhãn link với trang booking', () => {
    render(<TrustStrip />);
    expect(screen.getByRole('link', { name: 'Read the cancellation policy' })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );
  });

  it('không hứa một con số ngày nào — N khác nhau theo độ dài chuyến', () => {
    const { container } = render(<TrustStrip />);
    expect(container.textContent).not.toMatch(/\d+ days before/);
  });
});
```

- [ ] **Step 14: Chạy test component, xác nhận đỏ**

Run: `pnpm --filter @tourism/web exec vitest run src/components/marketing-cancellation-copy.spec.tsx`
Expected: FAIL — thanh trên cùng và dải CTA About còn "on most tours"; dải cam kết
còn "On most departures" và không có link nào; khối About còn "published refund
schedule".

- [ ] **Step 15: Sửa bốn bề mặt quảng bá**

15a. `apps/web/src/components/top-bar.tsx`, dòng 19–23, trước:

```ts
  // KHÔNG ghi "48 hours" (vá 04/09): chính sách thật nói dưới 7 ngày là KHÔNG
  // hoàn đồng nào, nên câu cũ hứa 100% ở đúng cái mốc chính sách trả 0% — và
  // nó chạy trên MỌI trang. Cùng bài học `trust-strip.tsx` đã học: mốc huỷ
  // khác nhau theo từng tour, một con số chung là nói sai.
  'Free cancellation on most tours — see the refund schedule',
```

sau:

```ts
  // KHÔNG ghi con số nào (vá 04/09, giữ nguyên lý do): hạn chót dài 1, 3 hay 7
  // ngày tuỳ độ dài chuyến, nên một con số chung ở marquee là nói sai. Nhưng
  // cái rào "most tours" thì bỏ được từ ADR-0041: luật hạn chót áp cho MỌI
  // tour, không còn tour nào đứng ngoài. "Refund schedule" cũng đi theo bảng
  // bậc đã gỡ.
  'Free cancellation on every tour',
```

15b. `apps/web/src/components/about/about-cta-video.tsx`, dòng 17–18, trước:

```ts
  // Vá 04/09 cùng lý do `top-bar.tsx`: không mang con số giờ nào.
  'Free cancellation on most tours',
```

sau:

```ts
  // Vá 04/09 cùng lý do `top-bar.tsx`: không mang con số giờ nào. ADR-0041 bỏ
  // nốt rào "most": một luật hạn chót cho mọi tour.
  'Free cancellation on every tour',
```

15c. `apps/web/src/components/about/about-values.tsx`, dòng 47–56, trước:

```ts
  {
    icon: CalendarCheckIcon,
    title: 'Free cancellation',
    // Vá 04/09: "48 hours" hứa hoàn 100% ở mốc mà chính sách trả 0%, và "no
    // forms, no phone queue" nói sai luôn cả luồng thật — huỷ CÓ form bắt nhập
    // lý do và CÓ đội ngũ xem xét. Nay nói đúng thứ mình làm được.
    tag: 'Clear schedule',
    description:
      'Plans change. Cancel from your account and get back what our published refund schedule says — no phone queue, no haggling.',
  },
```

sau:

```ts
  {
    icon: CalendarCheckIcon,
    title: 'Free cancellation',
    // Vá 04/09 đã gỡ "48 hours" và "no forms, no phone queue" (khi ấy huỷ CÓ
    // form bắt nhập lý do và CÓ đội ngũ xem xét). ADR-0041 gỡ chính hàng đợi
    // duyệt ấy, nên "no phone queue" lại đúng — còn "published refund schedule"
    // thì hết đối tượng: bảng bậc không còn, chỉ còn một hạn chót mỗi chuyến.
    tag: 'Every tour',
    description:
      'Every tour, not a select few. Cancel from your account before your trip’s deadline and every dollar comes back — one click, no queue, no haggling.',
  },
```

15d. `apps/web/src/components/home/trust-strip.tsx` — thay toàn bộ:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { BadgeDollarSignIcon, HeadsetIcon, type LucideIcon, ShieldCheckIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { SPRING } from '@/lib/motion';

// Dải huy hiệu tin cậy — dựng 14/08 khi ba mục chính sách rời khỏi
// `why-choose-us` (xem chú thích ở đó). Chúng KHÔNG bị bỏ: chúng vẫn ảnh hưởng
// tới quyết định đặt tour, chỉ là không hợp với khối kể chuyện có ảnh lớn.
// Đặt NGAY TRƯỚC dải CTA cuối trang: đây là chỗ người dùng quyết định, nên câu
// trả lời cho ba nỗi lo phổ biến nhất nên đứng liền trước lời mời.
//
// ── Ba câu này viết theo DỮ LIỆU, không theo khẩu hiệu ──
//
// 1. Huỷ miễn phí: bản 14/08 phải rào "on most departures" vì mốc huỷ khi ấy
//    nằm rải rác trong dữ liệu từng tour (`freeCancellationDays` ở 15 tour, mốc
//    viết bằng giờ trong policy ở 15 tour còn lại) — một con số chung là nói
//    sai. ADR-0041 gỡ chính cái rải rác ấy: MỘT luật hạn chót cho mọi tour, dài
//    1/3/7 ngày theo độ dài chuyến. Nên nay nói được "every tour" — nhưng vẫn
//    KHÔNG mang con số, vì con số đổi theo chuyến; ô này dẫn sang trang chính
//    sách để đọc trọn bảng ba dòng.
//
// 2. Không phí ẩn: đây là câu MẠNH NHẤT vì đúng tuyệt đối — `computeBookingTotal`
//    chỉ nhân giá với số khách, mô hình KHÔNG có dòng phí nào. Nói được là nói.
//
// 3. Hỗ trợ: bản cũ ở `why-choose-us` ghi "Support around the clock" (24/7).
//    Chính site tự phủ nhận: `mocks/offices.ts` khai giờ làm việc
//    "Mon–Fri · 8:00 am – 6:00 pm (GMT+7)", và `contact-hero.tsx` viết "a real
//    person replies within the hour, Monday to Friday". Nên câu ở đây chép
//    đúng giờ đã khai, thay vì hứa 24/7 rồi trang Contact nói ngược lại.
const BADGES: Array<{
  icon: LucideIcon;
  title: string;
  detail: string;
  /** Chỉ ô nào có văn bản đầy đủ để dẫn sang mới mang link. */
  href?: string;
}> = [
  {
    icon: ShieldCheckIcon,
    title: 'Free cancellation',
    detail: 'On every tour. Each departure shows its own deadline before you book.',
    href: '/cancellation-policy',
  },
  {
    icon: BadgeDollarSignIcon,
    title: 'No booking fees',
    detail: 'Your total is the tour price times travellers. Nothing is added at checkout.',
  },
  {
    icon: HeadsetIcon,
    title: 'A real person replies',
    detail: 'Within the hour, Monday to Friday, 8am–6pm (GMT+7).',
  },
];

export function TrustStrip() {
  return (
    <section className="w-full border-y bg-muted/40 px-4 py-10 md:px-16 lg:px-24 xl:px-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10">
        {BADGES.map((badge, index) => (
          <motion.div
            key={badge.title}
            className="flex items-start gap-4"
            initial={{ y: 24, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ ...SPRING, delay: index * 0.1 }}
          >
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <badge.icon className="size-4.5 text-primary-emphasis" aria-hidden="true" />
            </span>
            <span className="flex flex-col items-start gap-1">
              <span className="text-sm font-medium text-foreground">{badge.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{badge.detail}</span>
              {badge.href ? (
                <Link
                  href={badge.href}
                  className="text-xs text-primary-emphasis underline-offset-4 hover:underline"
                >
                  {messages.cancellationDeadline.policyLink}
                </Link>
              ) : null}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 16: Chạy test component, xác nhận xanh**

Run: `pnpm --filter @tourism/web exec vitest run src/components/marketing-cancellation-copy.spec.tsx`
Expected: PASS — 10 test (4 bề mặt × 2, cộng 2 test riêng của dải cam kết).

- [ ] **Step 17: Viết test đỏ cho dòng hạn chót trong email xác nhận** —
`apps/api/src/worker/resend.deliverer.spec.ts`, chèn NGAY SAU dấu `});` đóng
`describe('renderEmail payload rendering', …)`:

```ts
/**
 * Mail xác nhận là tờ giấy khách giữ lại. Từ ADR-0041 nó phải mang cả hạn chót
 * huỷ miễn phí — tính tại chỗ từ `startDate`/`endDate` đã có sẵn trong payload,
 * không thêm field mới vào outbox (spec §5.4).
 */
describe('renderEmail — hạn chót huỷ trong mail xác nhận (ADR-0041)', () => {
  const DATED = { ...BOOKING_PAYLOAD, startDate: '2026-10-12', endDate: '2026-10-15' };

  it('chuyến 4 ngày → hạn chót 7 ngày trước ngày đi, kèm giờ Việt Nam', async () => {
    const { html } = await renderEmail(EmailType.BOOKING_CONFIRMATION, DATED);
    expect(html).toContain('Free cancellation until');
    expect(html).toContain('Oct 5, 2026');
    expect(html).toMatch(/11:59 pm Vietnam time/);
  });

  it('chuyến 1 ngày → hạn chót 1 ngày trước, không dùng chung con số với chuyến dài', async () => {
    const { html } = await renderEmail(EmailType.BOOKING_CONFIRMATION, {
      ...BOOKING_PAYLOAD,
      startDate: '2026-10-12',
      endDate: '2026-10-12',
    });
    expect(html).toContain('Oct 11, 2026');
  });

  it('payload cũ KHÔNG có ngày chuyến → khuyết một dòng, mail vẫn gửi được', async () => {
    // Dòng outbox ghi trước ADR-0041 vẫn nằm trong hàng đợi; một chuỗi thiếu
    // không được phép giết cả mail.
    const { html } = await renderEmail(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD);
    expect(html).not.toContain('Free cancellation until');
    expect(html).toContain('BK-1');
  });

  it('ngày hỏng (ngày về trước ngày đi) → khuyết dòng chứ KHÔNG ném', async () => {
    // `cancellationDeadline` ném RangeError với dòng hỏng; DB chưa có CHECK
    // `end_date >= start_date` nên ca này vào được thật.
    const { html } = await renderEmail(EmailType.BOOKING_CONFIRMATION, {
      ...BOOKING_PAYLOAD,
      startDate: '2026-10-12',
      endDate: '2026-10-09',
    });
    expect(html).not.toContain('Free cancellation until');
    expect(html).toContain('BK-1');
  });
});
```

- [ ] **Step 18: Chạy test email, xác nhận đỏ**

Run: `pnpm --filter @tourism/api exec vitest run src/worker/resend.deliverer.spec.ts`
Expected: FAIL — bốn test mới: hai test đầu không tìm thấy `Free cancellation until`.
(Hai test còn lại xanh sẵn vì dòng chưa tồn tại; chúng là lưới cho bước sau.)

- [ ] **Step 19: Thêm dòng hạn chót vào `apps/api/src/worker/emails/render-email.tsx`**

19a. Dòng 1–4, trước:

```tsx
import { messages } from '@tourism/i18n';
import type { ReactNode } from 'react';
```

sau:

```tsx
import { cancellationDeadline } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { ReactNode } from 'react';
```

19b. Chèn ngay SAU hàm `formatDate` (kết thúc ở dòng 79):

```tsx
/**
 * Hạn chót huỷ miễn phí của chuyến, tính TẠI CHỖ từ hai ngày đã có trong payload
 * (ADR-0041) — outbox không phải mang thêm field, và dòng cũ trong hàng đợi vẫn
 * render được.
 *
 * `undefined` khi payload thiếu ngày hoặc ngày hỏng: `cancellationDeadline` ném
 * RangeError với chuyến có ngày về trước ngày đi (DB chưa có CHECK chặn), và
 * một mail khuyết một dòng còn hơn một dòng outbox chết vĩnh viễn.
 */
function deadlineText(
  startDate: string | undefined,
  endDate: string | undefined,
): string | undefined {
  if (!startDate || !endDate) return undefined;
  try {
    return formatDate(cancellationDeadline(startDate, endDate));
  } catch {
    return undefined;
  }
}
```

19c. Trong case `EmailType.BOOKING_CONFIRMATION`, trước:

```tsx
      const dates =
        formatDate(f('startDate')) && formatDate(f('endDate'))
          ? `${formatDate(f('startDate'))} → ${formatDate(f('endDate'))}`
          : undefined;
```

sau:

```tsx
      const dates =
        formatDate(f('startDate')) && formatDate(f('endDate'))
          ? `${formatDate(f('startDate'))} → ${formatDate(f('endDate'))}`
          : undefined;
      const freeUntil = deadlineText(f('startDate'), f('endDate'));
```

19d. Cùng case, trong `rows` của `DataCard`, trước:

```tsx
                ...(money
                  ? ([['Total paid', <MoneyValue key="v">{money}</MoneyValue>]] as Array<
                      [string, ReactNode]
                    >)
                  : []),
              ]}
```

sau:

```tsx
                ...(money
                  ? ([['Total paid', <MoneyValue key="v">{money}</MoneyValue>]] as Array<
                      [string, ReactNode]
                    >)
                  : []),
                ...(freeUntil
                  ? ([
                      [
                        'Free cancellation until',
                        <PlainValue key="v">{freeUntil}, 11:59 pm Vietnam time</PlainValue>,
                      ],
                    ] as Array<[string, ReactNode]>)
                  : []),
              ]}
```

- [ ] **Step 20: Chạy test email, xác nhận xanh**

Run: `pnpm --filter @tourism/api exec vitest run src/worker/resend.deliverer.spec.ts`
Expected: PASS toàn bộ file — 4 test mới cộng số test cũ (các test cũ dùng
`BOOKING_PAYLOAD` không có ngày chuyến nên không đổi hành vi).

- [ ] **Step 21: Soát dấu vết luật cũ và typecheck**

```bash
grep -rn "refundTierBullets\|refundTierSentence\|refund-tiers" apps libs --include="*.ts" --include="*.tsx" | grep -v "/dist/"
grep -rn "most tours\|most departures\|refund schedule\|2 business days\|recover from suppliers" apps/web/src libs/shared/i18n/src --include="*.ts" --include="*.tsx"
grep -rn "REFUND_POLICY_TIERS\|REFUND_GRACE_HOURS\|refundPercentForRequest\|policyRefundAmount\|isWithinGracePeriod" apps libs --include="*.ts" --include="*.tsx" | grep -v "/dist/" | grep -v "^libs/shared/contract/src/"
pnpm --filter @tourism/i18n typecheck
pnpm --filter @tourism/web typecheck
pnpm --filter @tourism/api typecheck
```

Expected:

- grep 1: KHÔNG in gì (file đã xoá, không ai còn import).
- grep 2: KHÔNG in gì. Các dòng "refund schedule" / "2 business days" còn lại trong
  `messages.ts` nằm trọn trong những khối Task 7 (`booking.detail` 537–614,
  `accountBookingDetail` 2553–2618), Task 8 (vùng admin cancellations ~3700–3830) và
  Task 10 (`checkoutSummary` 618–646, `tourDetail.departuresTab` 1613–1625) đã thay.
  Còn sót dòng nào là sót của ba task ấy — dừng lại, báo session gốc chứ đừng vá ở đây.
- grep 3: in danh sách còn lại. Khác dự đoán thì chép nguyên danh sách vào phần
  bàn giao của Task 15 để Task 13 dọn nốt.
- ba lệnh typecheck exit 0.

- [ ] **Step 22: Format và soát diff**

```bash
pnpm lint:fix
git status --short
git diff --stat
```

Expected: `git status` liệt kê đúng 16 đường dẫn ở mục **Files** (15 sửa/tạo cộng
một `D` cho `refund-tiers.ts`); không có file `.md` nào đổi.

- [ ] **Step 23: Cổng đầy đủ** (Docker Postgres đang chạy)

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu lệnh exit 0.

- [ ] **Step 24: Commit**

```bash
git add libs/shared/i18n/src/index.ts \
  libs/shared/i18n/src/lib/legal/cancellation.ts \
  libs/shared/i18n/src/lib/legal/cancellation.spec.ts \
  libs/shared/i18n/src/lib/legal/terms.ts \
  libs/shared/i18n/src/lib/messages.ts \
  apps/web/src/lib/legal-content.spec.ts \
  apps/web/src/mocks/faq.ts \
  apps/web/src/mocks/mocks.spec.ts \
  apps/web/src/components/top-bar.tsx \
  apps/web/src/components/home/trust-strip.tsx \
  apps/web/src/components/about/about-values.tsx \
  apps/web/src/components/about/about-cta-video.tsx \
  apps/web/src/components/marketing-cancellation-copy.spec.tsx \
  apps/api/src/worker/emails/render-email.tsx \
  apps/api/src/worker/resend.deliverer.spec.ts
git commit -m "feat(i18n): viết lại chính sách huỷ, FAQ và câu quảng bá theo một hạn chót" -m "Trang /cancellation-policy và phần huỷ/hoàn của /terms sinh từ CANCELLATION_WINDOW_RULES, đủ sáu ý của spec §5.5. Xoá legal/refund-tiers.ts cùng bảng bậc, ân hạn 24 giờ, hẹn 2 ngày làm việc, lời hứa đổi ngày và vế recover-from-suppliers. FAQ, thanh trên cùng, trang About và dải cam kết dùng một câu đúng cho mọi tour kèm link chính sách. Mail xác nhận thêm dòng hạn chót tính từ ngày chuyến trong payload."
```

(`refund-tiers.ts` đã vào index từ `git rm` ở Step 7a nên không cần add lại.)

---

### Task 12: Seed theo luật mới (ADR-0041)

**Files:**
- Create: `apps/api/prisma/fixtures/catalog/chinh-sach-huy.spec.ts`
- Modify: `apps/api/prisma/fixtures/catalog/types.ts:41-44` (bỏ `freeCancellationDays`), `:76-84` (`TourPolicyFixture.kind`)
- Modify: `apps/api/prisma/fixtures/catalog/tours-north.ts` (29 dòng `freeCancellationDays` và 29 object policy CANCELLATION trải trên ba file; sáu câu FAQ; comment dải id ở đầu file)
- Modify: `apps/api/prisma/fixtures/catalog/tours-central.ts`, `apps/api/prisma/fixtures/catalog/tours-south.ts` (như trên)
- Modify: `apps/api/prisma/fixtures/catalog/departures-2026.ts:19-38, 91-102`
- Test: `apps/api/prisma/fixtures/catalog/departures-2026.spec.ts`
- Modify: `apps/api/prisma/fixtures/operations/bookings.ts` (toàn bộ phần huỷ: `:1`, `:20-51`, `:96-120`, `:146-148`, `:258-299`, `:350-365`, `:391-447`, `:449-623`, `:632-650`, `:690-703`)
- Test: `apps/api/prisma/fixtures/operations/bookings.spec.ts`, `apps/api/prisma/fixtures/khung-ngay.spec.ts`
- Modify: `apps/api/prisma/seed.ts:33-40` (import enum), `:163-182` (comment và thông điệp chốt chặn), `:285-307` (FAQ và policy), `:542-575` (refund, yêu cầu huỷ)
- Modify: `apps/api/scripts/verify-seed.mjs`

**Interfaces:**
- Consumes (Task 1, Hợp đồng A, qua `@tourism/contract`): `cancellationDeadline(startDate, endDate): string`, `isWithinDeadline(now, startDate, endDate): boolean`, `canCancelOnline(now, startDate): boolean`, `refundOnCancel({ now, startDate, endDate, totalAmount, refundedTotal }): string`, `windowDaysForTripLength(tripDays): CancellationWindowDays`, `remainingRefundable(totalAmount, refundedTotal): string`.
- Consumes (Task 2): `cancellation_requests.reason` cho phép NULL.
- Produces (Task 13, 15 và Phụ lục B dựa vào):
  - `apps/api/prisma/fixtures/operations/bookings.ts`: `export function apDungKhachTuHuy(kq: DuLieuVanHanh, H: number): void`; `export function baoDamBookingQuaHan(kq: DuLieuVanHanh, H: number, lich: TourDepartureFixture[], khach: KhachFixture[]): void`; `RefundFixture.issuedByAdmin: boolean`; `CancellationRequestFixture = { id; bookingId; userId; reason: string | null; status: 'REFUNDED'; decidedAt: string; createdAt: string; updatedAt: string }`. Không còn `apDungYeuCauHuy`, không còn trường `freeCancellationDays` hay `decisionNote` trong fixture.
  - `TourFixture` không còn `freeCancellationDays`; `TourPolicyFixture.kind: 'BOOKING' | 'GENERAL'`.
  - Lịch: mọi tour ≥ 4 ngày có ít nhất một chuyến OPEN đã qua hạn chót mà chưa khởi hành tại H.
  - `seed:verify` có thêm các bất biến theo spec §7 (tên ở Step 24 và Step 25).

- [ ] **Step 1: Build contract và i18n để fixture đọc được hàm luật của Task 1**

Run (Git Bash, gốc worktree):

```bash
pnpm --filter @tourism/contract build && pnpm --filter @tourism/i18n build
```

Expected: cả hai build xong, không lỗi. `libs/shared/contract/dist/index.d.ts` có `cancellationDeadline`, `refundOnCancel` và `windowDaysForTripLength`.

- [ ] **Step 2: Viết test đỏ cho nội dung catalog** — tạo `apps/api/prisma/fixtures/catalog/chinh-sach-huy.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { tourFaqs, tourPolicies, tours } from './index.js';

/**
 * Nội dung catalog khớp luật một hạn chót (ADR-0041, spec 2026-09-15 §7): chính sách huỷ
 * sinh từ luật chung ở `@tourism/contract`, nên fixture không còn con số hay văn bản huỷ
 * riêng của từng tour. Câu trả lời FAQ không được hứa một mốc khác với mốc trang tour in ra.
 */
describe('catalog theo luật một hạn chót', () => {
  it('không tour nào còn khoá freeCancellationDays', () => {
    for (const tour of tours) {
      expect(Object.keys(tour), tour.slug).not.toContain('freeCancellationDays');
    }
  });

  it('mỗi tour có đúng hai policy BOOKING và GENERAL, không còn CANCELLATION', () => {
    for (const tour of tours) {
      const loai = tourPolicies
        .filter((p) => p.tourId === tour.id)
        .map((p) => p.kind)
        .sort();
      expect(loai, tour.slug).toEqual(['BOOKING', 'GENERAL']);
    }
  });

  it('không câu FAQ nào còn hứa mốc huỷ riêng hoặc đổi ngày miễn phí', () => {
    for (const faq of tourFaqs) {
      expect(faq.answer, faq.id).not.toMatch(/free cancellation up to|free rebooking/i);
    }
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận đỏ**

Run: `pnpm --filter @tourism/api exec vitest run prisma/fixtures/catalog/chinh-sach-huy.spec.ts`
Expected: FAIL cả ba test. Test 1 báo tour chứa `freeCancellationDays`, test 2 nhận `['BOOKING', 'CANCELLATION', 'GENERAL']`, test 3 báo id `d2000002-0000-4000-8000-000000000021`.

- [ ] **Step 4: Rút `freeCancellationDays` và 29 policy CANCELLATION khỏi ba file miền**

Run (Git Bash, gốc worktree). Lệnh chỉ xoá đúng hai hình dạng dòng. Object policy luôn mở bằng `  {`, có `id`, `tourId`, `kind: 'CANCELLATION'` và đóng bằng `  },`:

```bash
node -e "
const fs = require('node:fs');
const dir = 'apps/api/prisma/fixtures/catalog/';
for (const ten of ['tours-north.ts', 'tours-central.ts', 'tours-south.ts']) {
  const truoc = fs.readFileSync(dir + ten, 'utf8');
  const sau = truoc
    .replace(/^    freeCancellationDays: \d+,\n/gm, '')
    .replace(/^  \{\n    id: .*\n    tourId: .*\n    kind: 'CANCELLATION',\n(?:    .*\n)*?  \},\n/gm, '');
  fs.writeFileSync(dir + ten, sau);
}
"
grep -c "freeCancellationDays\|kind: 'CANCELLATION'" apps/api/prisma/fixtures/catalog/tours-north.ts apps/api/prisma/fixtures/catalog/tours-central.ts apps/api/prisma/fixtures/catalog/tours-south.ts
grep -c "    kind: '" apps/api/prisma/fixtures/catalog/tours-north.ts apps/api/prisma/fixtures/catalog/tours-central.ts apps/api/prisma/fixtures/catalog/tours-south.ts
```

Expected: lệnh đếm thứ nhất in `:0` cho cả ba file. Lệnh đếm thứ hai in `tours-north.ts:24`, `tours-central.ts:18`, `tours-south.ts:16`, tổng 58 policy. Chạy `git diff --stat` thì chỉ thấy ba file này đổi.

- [ ] **Step 5: Sửa comment dải id policy ở đầu ba file miền** (id đầu dải là policy CANCELLATION của tour #1 nên đã rút)

`apps/api/prisma/fixtures/catalog/tours-north.ts`, trước:

```ts
 *   - `tourPolicies[].id`      d3000002-0000-4000-8000-000000000001 → …0036
```

Sau:

```ts
 *   - `tourPolicies[].id`      d3000002-0000-4000-8000-000000000002 → …0036 (id loại CANCELLATION đã rút theo ADR-0041, dải có lỗ)
```

`apps/api/prisma/fixtures/catalog/tours-central.ts`, trước:

```ts
 *   - `tourPolicies[].id`      d3000002-0000-4000-8000-000000000101 → …0127
```

Sau:

```ts
 *   - `tourPolicies[].id`      d3000002-0000-4000-8000-000000000102 → …0127 (id loại CANCELLATION đã rút theo ADR-0041, dải có lỗ)
```

`apps/api/prisma/fixtures/catalog/tours-south.ts`, trước:

```ts
 *   - `tourPolicies[].id`      d3000002-0000-4000-8000-000000000201 → …0227
```

Sau:

```ts
 *   - `tourPolicies[].id`      d3000002-0000-4000-8000-000000000202 → …0224 (id loại CANCELLATION đã rút theo ADR-0041, dải có lỗ)
```

- [ ] **Step 6: Viết lại sáu câu FAQ còn hứa luật cũ** (chữ khách đọc: tiếng Anh; không ghi số ngày, vì trang tour và email xác nhận đã in ngày chót cụ thể)

`apps/api/prisma/fixtures/catalog/tours-north.ts`, id `d2000002-0000-4000-8000-000000000021` (`halong-bay-overnight-cruise`), trước:

```ts
    answer:
      'A full refund or free rebooking to the next available departure is offered if the port authority halts sailing for that day.',
```

Sau:

```ts
    answer:
      'If the port authority halts sailing and we cancel the departure, you get a full refund. You are then free to book any other departure.',
```

Cùng file, id `d2000002-0000-4000-8000-000000000511` (`mai-chau-cycling-2d`), trước:

```ts
    answer:
      'Free cancellation up to 3 days before departure. It is a short window because the stilt-house rooms in Bản Lác are held for you individually.',
```

Sau:

```ts
    answer:
      'Every departure shows its free-cancellation deadline, and your confirmation email repeats it. Cancel online before then for a full refund; after it, bookings close and cancellations are not refunded.',
```

Cùng file, id `d2000002-0000-4000-8000-000000000523` (`sapa-terraces-homestay-2d`), trước:

```ts
    answer:
      'Free cancellation up to 5 days before departure — the homestay family shops for your meals ahead of time.',
```

Sau:

```ts
    answer:
      'Cancel online before the free-cancellation deadline shown on your departure and you get a full refund. After that, the homestay family has already shopped for your meals, so cancellations are not refunded.',
```

`apps/api/prisma/fixtures/catalog/tours-central.ts`, id `d2000002-0000-4000-8000-000000000104` (`hue-imperial-day`), trước:

```ts
    answer:
      'Free rebooking to another departure is available up to 24 hours before pickup — see the cancellation policy for the full terms.',
```

Sau:

```ts
    answer:
      'Bookings cannot be moved to another date. Cancel online before the free-cancellation deadline shown on your departure for a full refund, then book the date that suits you.',
```

Cùng file, id `d2000002-0000-4000-8000-000000000117` (`bana-hills-golden-bridge-day`), trước:

```ts
    answer:
      'Closures are rare but possible in typhoon season; if it happens on your day, we offer a free rebooking to the next available date or a full refund.',
```

Sau:

```ts
    answer:
      'Closures are rare but possible in typhoon season; if it happens on your day and we cancel the departure, you get a full refund.',
```

Cùng file, id `d2000002-0000-4000-8000-000000000503` (`central-honeymoon-5d`), trước:

```ts
    answer:
      'Free cancellation up to 21 days before departure — the longest window we offer, because this itinerary books private guides and rooms well ahead.',
```

Sau:

```ts
    answer:
      'Each departure shows its free-cancellation deadline, and your confirmation email repeats it. Dates cannot be moved: cancel online before the deadline for a full refund, then book the departure you prefer.',
```

- [ ] **Step 7: Sửa kiểu fixture** — `apps/api/prisma/fixtures/catalog/types.ts`

Xoá nguyên khối (dòng 41–44):

```ts
  // Cửa sổ huỷ miễn phí tính bằng NGÀY. `null` cho tour ghi cửa sổ bằng GIỜ
  // (15/30 tour) — ép 24 giờ thành "1 ngày" là nói sai, mốc đó tính từ giờ
  // khởi hành chứ không phải nửa đêm.
  freeCancellationDays: number | null;
```

Thay khối `TourPolicyFixture`, trước:

```ts
/** `kind` đủ 3 giá trị enum `PolicyKind`, mỗi tour cần đủ cả 3 (spec §4). */
export interface TourPolicyFixture {
  id: string;
  tourId: string;
  kind: 'CANCELLATION' | 'BOOKING' | 'GENERAL';
```

Sau:

```ts
/**
 * `kind` chỉ còn BOOKING và GENERAL, mỗi tour đủ cả hai. Loại CANCELLATION rút khỏi fixture
 * từ ADR-0041: chính sách huỷ sinh từ luật chung ở `@tourism/contract`, không còn là văn bản
 * riêng của từng tour. Enum `PolicyKind` của DB vẫn giữ giá trị ấy; `seed.ts` xoá các dòng
 * CANCELLATION cũ.
 */
export interface TourPolicyFixture {
  id: string;
  tourId: string;
  kind: 'BOOKING' | 'GENERAL';
```

- [ ] **Step 8: Chạy test catalog, xác nhận xanh**

Run: `pnpm --filter @tourism/api exec vitest run prisma/fixtures/catalog/chinh-sach-huy.spec.ts`
Expected: PASS 3/3.

- [ ] **Step 9: Viết test đỏ cho lịch khởi hành** — `apps/api/prisma/fixtures/catalog/departures-2026.spec.ts`

Thêm import ở đầu file, trước:

```ts
import { describe, expect, it } from 'vitest';
```

Sau:

```ts
import { cancellationDeadline } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
```

Thêm hai `it` vào CUỐI khối `describe.each(MOC)('lịch khởi hành với H = %s', …)`, ngay trước dấu `});` đóng khối:

```ts
  it('mỗi tour ≥ 4 ngày có chuyến OPEN đã qua hạn chót mà chưa khởi hành tại H', () => {
    // H là nửa đêm UTC của ngày mốc, tức 07:00 cùng ngày ở Việt Nam, nên ngày Việt Nam
    // của H bằng đúng `isoNgay(H)` — so hạn chót bằng mốc ms là đủ, không cần đổi múi.
    const daiNgay = tours.filter((t) => t.durationDays >= 4);
    expect(daiNgay).toHaveLength(6);
    for (const tour of daiNgay) {
      const quaHan = conBan.filter(
        (d) =>
          d.tourId === tour.id &&
          ngay(d.startDate) > H &&
          ngay(cancellationDeadline(d.startDate, d.endDate)) < H,
      );
      expect(quaHan.length, tour.slug).toBeGreaterThanOrEqual(1);
    }
  });

  it('không hai chuyến nào của cùng một tour rơi vào cùng một ngày', () => {
    const cap = lich.map((d) => `${d.tourId}:${d.startDate}`);
    expect(new Set(cap).size).toBe(cap.length);
  });
```

- [ ] **Step 10: Viết bất biến hạn chót quét 30 mốc** — `apps/api/prisma/fixtures/khung-ngay.spec.ts`

Thêm import ở đầu file, trước:

```ts
import { describe, expect, it } from 'vitest';
```

Sau:

```ts
import { cancellationDeadline, isWithinDeadline, refundOnCancel } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
```

Thêm khối mới vào CUỐI file, sau khối `describe.each(MOC)('sàn cấu trúc với H = %s', …)`:

```ts
/**
 * Sàn của luật một hạn chót (ADR-0041, spec 2026-09-15 §7 và §11). Quét CẢ 30 mốc chứ
 * không chỉ hai mốc cố định: lượt seed prod lấy ngày chạy làm H, mà cửa sổ "đã qua hạn
 * chót nhưng chưa khởi hành" hẹp — 5 ngày với tour ≥ 4 ngày — nên đây đúng là chỗ một
 * mốc lẻ dễ rơi ra ngoài mà hai mốc cố định không thấy.
 */
describe.each(MOC)('sàn hạn chót với H = %s', (giaTri) => {
  const homNay = docMocHomNay(giaTri);
  const H = homNay.getTime();
  const khach = sinhKhach(homNay);
  const lich = sinhLich(homNay);
  const vanHanh = sinhVanHanh(homNay, lich, khach);
  /** Chuyến còn bán đã qua hạn chót tại H mà chưa khởi hành — nguồn của ca demo "huỷ quá hạn". */
  const quaHan = lich.filter(
    (d) =>
      d.status === 'OPEN' &&
      Date.parse(`${d.startDate}T00:00:00.000Z`) > H &&
      Date.parse(`${cancellationDeadline(d.startDate, d.endDate)}T00:00:00.000Z`) < H,
  );

  it('mỗi tour ≥ 4 ngày có chuyến đã qua hạn chót mà chưa khởi hành; ≥ 3 booking PAID trên nhóm đó', () => {
    for (const tour of tours.filter((t) => t.durationDays >= 4)) {
      expect(quaHan.filter((d) => d.tourId === tour.id).length, tour.slug).toBeGreaterThanOrEqual(
        1,
      );
    }
    const hopLe = new Set(quaHan.map((d) => d.id));
    const daTra = vanHanh.bookings.filter(
      (b) => b.status === 'PAID' && hopLe.has(b.departureId),
    );
    expect(daTra.length).toBeGreaterThanOrEqual(3);
  });

  it('không booking nào trả tiền sau hạn chót của chuyến', () => {
    for (const b of vanHanh.bookings) {
      if (b.paidAt === null) continue;
      expect(
        isWithinDeadline(new Date(b.paidAt), b.departureStartDate, b.departureEndDate),
        `${b.id} paidAt=${b.paidAt} đi=${b.departureStartDate}`,
      ).toBe(true);
    }
  });

  it('mỗi lần khách tự huỷ hoàn đúng luật: trong hạn một dòng bằng phần còn lại, quá hạn không dòng nào', () => {
    const bangBooking = new Map(vanHanh.bookings.map((b) => [b.id, b]));
    let trongHan = 0;
    let quaHanHuy = 0;
    for (const c of vanHanh.cancellationRequests) {
      expect(c.status, c.id).toBe('REFUNDED');
      const b = bangBooking.get(c.bookingId);
      if (!b) throw new Error(`yêu cầu ${c.id} trỏ booking không có thật`);
      const canHoan = refundOnCancel({
        now: new Date(c.createdAt),
        startDate: b.departureStartDate,
        endDate: b.departureEndDate,
        totalAmount: b.totalAmount,
        refundedTotal: '0.00',
      });
      const hoan = vanHanh.refunds.filter((r) => r.bookingId === b.id);
      if (Number(canHoan) > 0) {
        trongHan++;
        expect(hoan, c.id).toHaveLength(1);
        expect(hoan[0]?.amount, c.id).toBe(canHoan);
        expect(hoan[0]?.issuedByAdmin, c.id).toBe(false);
      } else {
        quaHanHuy++;
        expect(hoan, c.id).toHaveLength(0);
      }
    }
    expect(trongHan).toBeGreaterThanOrEqual(5);
    expect(quaHanHuy).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 11: Chạy hai spec, xác nhận đỏ**

Run:

```bash
pnpm --filter @tourism/api exec vitest run prisma/fixtures/catalog/departures-2026.spec.ts prisma/fixtures/khung-ngay.spec.ts
```

Expected: FAIL. Cụ thể:

- `departures-2026.spec.ts` đỏ ở test "mỗi tour ≥ 4 ngày…" với H = 2026-09-20 — sáu tour `ha-giang-loop-4d`, `northern-highlights-5d`, `vietnam-grand-journey-12d`, `central-heritage-4d`, `central-honeymoon-5d`, `phu-quoc-honeymoon-4d` đều nhận `0` (ghi chú 1 đầu file: đo 15/09 không mốc nào trong 30 mốc có sẵn chuyến qua hạn ở 21 mốc, và 20/09 là một trong số đó). Mốc 2026-11-03 có thể đã xanh sẵn ở vài tour — chỉ cần một mốc đỏ là đủ chứng minh test có răng.
- `departures-2026.spec.ts` test "không hai chuyến cùng ngày" XANH ngay — đó là lưới canh cho Step 12, không phải test đỏ.
- `khung-ngay.spec.ts` đỏ ở cả ba test mới: sàn chuyến qua hạn (0), `paidAt` sau hạn chót (bộ sinh hiện chỉ kẹp trước ngày khởi hành 1 ngày), và huỷ (hiện còn `status` `DENIED`/`REQUESTED` nên `expect(c.status).toBe('REFUNDED')` đỏ).

- [ ] **Step 12: Kéo chuyến còn bán đầu tiên của tour ≥ 4 ngày về [H + 2, H + 6]** — `apps/api/prisma/fixtures/catalog/departures-2026.ts`

Thêm vào khối JSDoc đầu file (sau đoạn "── Rải đều theo khe ──"), trước:

```ts
 * ── Thứ KHÔNG nằm ở đây ──
```

Sau:

```ts
 * ── Một chuyến "đã qua hạn chót mà chưa khởi hành" cho mỗi tour dài ──
 * Luật một hạn chót (ADR-0041) cho tour từ 4 ngày trở lên N = 7, nên chuyến khởi hành
 * trong [H + 2, H + 6] đã đóng đặt chỗ mà chưa đi — đúng thứ spec 2026-09-15 §11 cần để
 * demo "Booking closed" và "huỷ quá hạn, không hoàn". Rải đều không bao giờ tự cho ra
 * khoảng đó: khe đầu của cửa sổ còn bán rộng vài chục ngày. Vì vậy sáu tour ≥ 4 ngày
 * được kéo RIÊNG chuyến còn bán đầu tiên về khoảng ấy, và chỉ kéo SỚM hơn — chuyến thứ
 * hai trở đi vẫn muộn hơn nên không tour nào có hai chuyến cùng ngày.
 *
 * ── Thứ KHÔNG nằm ở đây ──
```

Thêm hằng số, sau `const CHUYEN_BAN_DUOC = 4;`:

```ts
/** Tour từ chừng này ngày trở lên có N = 7 (ADR-0041) — nhóm được kéo chuyến đầu về khoảng demo. */
const CHUYEN_DAI_NGAY = 4;
/** Ngày khởi hành muộn nhất của chuyến demo, tính từ H: H + 6 vẫn qua hạn chót vì D = H + 6 − 7. */
const QUA_HAN_MUON_NHAT = 6;
```

Trong `sinhLich`, trước:

```ts
    // ── Chọn chuyến khuyến mãi ──
```

Sau (chèn vào ngay trên dòng đó, sau khi `moc` đã dựng xong):

```ts
    // ── Kéo chuyến còn bán đầu tiên của tour dài về khoảng demo ──
    // Đặt TRƯỚC bước chọn khuyến mãi để mọi bước sau (khuyến mãi, id, mốc mở bán) đọc
    // cùng một ngày khởi hành. H luôn là nửa đêm UTC (`docMocHomNay`) nên phép cộng ngày
    // ở đây vẫn ra nửa đêm, khớp khuôn của `raiDeu`.
    if (tour.durationDays >= CHUYEN_DAI_NGAY) {
      const dau = moc.find((m) => m.banDuoc);
      if (dau && dau.batDau > H + QUA_HAN_MUON_NHAT * NGAY_MS) {
        const rndQuaHan = boSinh(`lich-qua-han:${tour.slug}`);
        dau.batDau = H + nguyen(rndQuaHan, 2, QUA_HAN_MUON_NHAT) * NGAY_MS;
      }
    }

    // ── Chọn chuyến khuyến mãi ──
```

- [ ] **Step 13: Chạy lại hai spec, xác nhận phần lịch đã xanh**

Run:

```bash
pnpm --filter @tourism/api exec vitest run prisma/fixtures/catalog/departures-2026.spec.ts prisma/fixtures/khung-ngay.spec.ts
```

Expected: `departures-2026.spec.ts` PASS toàn bộ ở cả hai mốc — gồm "mỗi tháng của năm 2026 có ít nhất 10 chuyến" (kéo chuyến đổi tháng của 6 chuyến; ghi chú 1 đầu file đo được số chuyến tối thiểu mỗi tháng vẫn là 12 ở cả hai mốc) và "có chuyến giảm giá còn bán từ 15/11". `khung-ngay.spec.ts` còn đỏ hai test sau ("không booking nào trả tiền sau hạn chót", "mỗi lần khách tự huỷ…") và ĐÃ XANH vế "mỗi tour ≥ 4 ngày có chuyến đã qua hạn chót"; vế "≥ 3 booking PAID trên nhóm đó" có thể còn đỏ ở vài mốc — Step 20 mới đóng.

Nếu một mốc nào đó đỏ ở "mỗi tháng … ít nhất 10 chuyến": KHÔNG hạ ngưỡng. Sửa bằng cách kéo chuyến đầu chứ không xoá nó — nghĩa là kiểm lại rằng nhánh `if` chỉ chạy khi `dau.batDau` thật sự muộn hơn `H + 6`.

- [ ] **Step 14: Viết lại phần huỷ của `bookings.spec.ts` — hai ca tự huỷ**

`apps/api/prisma/fixtures/operations/bookings.spec.ts`, dòng 1, trước:

```ts
import { policyRefundAmount, refundPercentForRequest } from '@tourism/contract';
```

Sau:

```ts
import { cancellationDeadline, isWithinDeadline, refundOnCancel } from '@tourism/contract';
```

Khối import từ `./bookings.js`, trước:

```ts
import {
  apDungYeuCauHuy,
  type BookingFixture,
  baoDamBookingDaDi,
  type DuLieuVanHanh,
  sinhVanHanh,
  themGioBoDo,
} from './bookings.js';
```

Sau:

```ts
import {
  apDungKhachTuHuy,
  type BookingFixture,
  baoDamBookingDaDi,
  baoDamBookingQuaHan,
  type DuLieuVanHanh,
  sinhVanHanh,
  themGioBoDo,
} from './bookings.js';
```

Trong khối `describe.each(MOC)('huỷ và hoàn với H = %s', …)`:

1. Test `'giỏ bỏ dở: …'` — thêm một assertion vào cuối vòng `for`, sau dòng `expect(kq.cancellationRequests.some((c) => c.bookingId === b.id)).toBe(false);`:

```ts
      // Giỏ bỏ dở là một lượt checkout THẬT, nên nó cũng phải nằm trong hạn đặt chỗ.
      expect(
        isWithinDeadline(new Date(b.createdAt), b.departureStartDate, b.departureEndDate),
        b.id,
      ).toBe(true);
```

2. Thay TRỌN hai test `'huỷ đã duyệt: đúng một yêu cầu REFUNDED, số hoàn theo chính sách, phủ đủ bốn bậc'` và `'yêu cầu bị từ chối giữ booking PAID và có ghi chú; yêu cầu đang chờ nằm trong 25 ngày trước H'` bằng hai test dưới đây:

```ts
  it('khách tự huỷ: yêu cầu REFUNDED do chính khách, mốc gửi = mốc quyết, hoàn đúng luật', () => {
    const huyDaTra = kq.bookings.filter((b) => b.status === 'CANCELLED' && b.paidAt !== null);
    let trongHan = 0;
    let quaHan = 0;
    for (const b of huyDaTra) {
      const yeuCau = kq.cancellationRequests.filter((c) => c.bookingId === b.id);
      expect(yeuCau, b.id).toHaveLength(1);
      const c = yeuCau[0];
      if (!c) continue;
      expect(c.status).toBe('REFUNDED');
      expect(c.userId).toBe(b.userId);
      // Lõi huỷ Task 6 ghi yêu cầu và dòng hoàn bằng CÙNG một `now()`; báo cáo (Hợp đồng D)
      // xếp loại trong/quá hạn bằng `createdAt` còn tiền tính tại mốc huỷ — hai mốc lệch
      // nhau là hai câu trả lời cho cùng một lần huỷ.
      expect(c.createdAt).toBe(c.decidedAt);
      expect(c.updatedAt).toBe(c.decidedAt);
      expect(b.cancelledAt).toBe(c.decidedAt);
      expect(b.updatedAt).toBe(c.decidedAt);
      expect(ms(c.createdAt), c.id).toBeGreaterThan(ms(b.paidAt));
      expect(ms(c.createdAt), c.id).toBeLessThan(Math.min(ngay(b.departureStartDate), H));
      const canHoan = refundOnCancel({
        now: new Date(c.createdAt),
        startDate: b.departureStartDate,
        endDate: b.departureEndDate,
        totalAmount: b.totalAmount,
        refundedTotal: '0.00',
      });
      const hoan = kq.refunds.filter((r) => r.bookingId === b.id);
      if (Number(canHoan) > 0) {
        trongHan++;
        expect(canHoan, b.id).toBe(b.totalAmount);
        expect(hoan, b.id).toHaveLength(1);
        expect(hoan[0]?.amount, b.id).toBe(canHoan);
        expect(hoan[0]?.reason, b.id).toBeNull();
        expect(hoan[0]?.issuedByAdmin, b.id).toBe(false);
        expect(hoan[0]?.createdAt, b.id).toBe(c.decidedAt);
        expect(
          kq.paymentEvents.filter((e) => e.bookingId === b.id && e.payload.kind === 'refund'),
          b.id,
        ).toHaveLength(1);
      } else {
        quaHan++;
        expect(hoan, b.id).toHaveLength(0);
        expect(
          kq.paymentEvents.some((e) => e.bookingId === b.id && e.payload.kind === 'refund'),
          b.id,
        ).toBe(false);
      }
    }
    expect(trongHan).toBeGreaterThanOrEqual(5);
    expect(quaHan).toBeGreaterThanOrEqual(3);
  });

  it('không còn yêu cầu DENIED hay REQUESTED; ca quá hạn nằm sau ngày chót và trước ngày đi', () => {
    for (const c of kq.cancellationRequests) expect(c.status, c.id).toBe('REFUNDED');
    const quaHan = kq.cancellationRequests.filter((c) => {
      const b = bangBooking.get(c.bookingId);
      if (!b) throw new Error(`yêu cầu ${c.id} trỏ booking không có thật`);
      return !isWithinDeadline(new Date(c.createdAt), b.departureStartDate, b.departureEndDate);
    });
    expect(quaHan.length).toBeGreaterThanOrEqual(3);
    for (const c of quaHan) {
      const b = bangBooking.get(c.bookingId);
      if (!b) continue;
      const chot = ngay(cancellationDeadline(b.departureStartDate, b.departureEndDate));
      expect(ms(c.createdAt), c.id).toBeGreaterThan(chot);
      // Huỷ online chỉ được TRƯỚC ngày khởi hành (`canCancelOnline`).
      expect(ms(c.createdAt), c.id).toBeLessThan(ngay(b.departureStartDate));
      // Tour 1 ngày có D = ngày đi − 1 nên khoảng (D, ngày đi) rỗng: ca quá hạn chỉ rơi
      // vào tour ≥ 2 ngày. Đây là hệ quả của luật, không phải thiếu sót của bộ sinh.
      expect(ngay(b.departureEndDate), c.id).toBeGreaterThan(ngay(b.departureStartDate));
    }
  });
```

Trong test `'chuyến công ty huỷ: REFUNDED, một refund bằng tổng tiền có lý do, …'` của khối `describe.each(MOC)('tầng vận hành với H = %s', …)`, thêm một assertion cạnh chỗ đã kiểm `reason`:

```ts
      // Đường admin phát hành: seed ghi `admin_id` = admin, khác hẳn dòng hoàn khi khách tự huỷ.
      expect(hoan[0]?.issuedByAdmin, b.id).toBe(true);
```

- [ ] **Step 15: Viết test sổ tổng hợp cho `apDungKhachTuHuy` và `baoDamBookingQuaHan`** — cùng file

Thay TRỌN khối `describe('apDungYeuCauHuy trên sổ một booking tổng hợp', …)` (từ dòng `describe('apDungYeuCauHuy…` tới dấu `});` đóng khối, trước `describe('themGioBoDo…`) bằng:

```ts
describe('apDungKhachTuHuy trên sổ một booking tổng hợp', () => {
  const homNay = docMocHomNay('2026-09-20');
  const H = Date.UTC(2026, 8, 20);
  const tuNhien = sinhVanHanh(homNay, sinhLich(homNay), sinhKhach(homNay));
  // Mẫu là booking PAID trên tour 5 ngày: N = 7, đủ rộng để dựng được CẢ ca trong hạn lẫn
  // ca quá hạn chỉ bằng cách dời ngày khởi hành.
  const mau = (() => {
    const dai = new Map(tours.map((t) => [t.id, t.durationDays]));
    const b = tuNhien.bookings.find((x) => x.status === 'PAID' && (dai.get(x.tourId) ?? 0) === 5);
    if (!b) throw new Error('bộ sinh không có booking PAID trên tour 5 ngày');
    return b;
  })();
  const soNgayDi = ngay(mau.departureEndDate) - ngay(mau.departureStartDate);

  /** Sổ chỉ chứa đúng một booking PAID, clone từ `mau` rồi đổi id, ngày khởi hành và mốc trả tiền. */
  const soMotBooking = (id: string, khoiHanh: number, traLuc: number): DuLieuVanHanh => ({
    bookings: [
      {
        ...mau,
        id,
        status: 'PAID',
        cancelledAt: null,
        departureStartDate: isoNgay(khoiHanh),
        departureEndDate: isoNgay(khoiHanh + soNgayDi),
        paidAt: isoGio(traLuc),
      },
    ],
    paymentEvents: [],
    refunds: [],
    cancellationRequests: [],
  });

  it('(a) trong hạn: khởi hành H + 30 ngày, trả tiền trước 60 ngày → hoàn đủ, admin_id để trống', () => {
    const khoiHanh = H + 30 * NGAY_MS;
    const kq = soMotBooking('syn-huy-trong-han', khoiHanh, khoiHanh - 60 * NGAY_MS);
    apDungKhachTuHuy(kq, H);
    expect(kq.cancellationRequests).toHaveLength(1);
    const c = kq.cancellationRequests[0];
    expect(c?.status).toBe('REFUNDED');
    expect(c?.createdAt).toBe(c?.decidedAt);
    expect(kq.bookings[0]?.status).toBe('CANCELLED');
    expect(kq.refunds).toHaveLength(1);
    expect(kq.refunds[0]?.amount).toBe(mau.totalAmount);
    expect(kq.refunds[0]?.issuedByAdmin).toBe(false);
    expect(kq.paymentEvents).toHaveLength(1);
  });

  it('(b) quá hạn: trả tiền ĐÚNG ngày chót, khởi hành H + 3 ngày → REFUNDED mà không dòng hoàn nào', () => {
    // D = khởi hành − 7 = H − 4. Trả tiền đúng ngày D nên cửa sổ TRONG HẠN rỗng (mốc huỷ
    // sớm nhất là D + 1 ngày, đã quá hạn) và chỉ còn nhánh quá hạn: [D + 1, H − 1].
    const khoiHanh = H + 3 * NGAY_MS;
    const kq = soMotBooking('syn-huy-qua-han', khoiHanh, khoiHanh - 7 * NGAY_MS + 5 * GIO_MS);
    apDungKhachTuHuy(kq, H);
    expect(kq.cancellationRequests).toHaveLength(1);
    expect(kq.cancellationRequests[0]?.status).toBe('REFUNDED');
    expect(kq.bookings[0]?.status).toBe('CANCELLED');
    expect(kq.refunds).toEqual([]);
    expect(kq.paymentEvents).toEqual([]);
  });

  it('(c) cửa sổ rỗng: trả tiền hôm qua cho chuyến khởi hành đúng ngày H → không huỷ ai', () => {
    // Mốc huỷ sớm nhất của cả hai nhánh là ngày sau ngày trả tiền, tức chính H; mà mọi mốc
    // giao dịch phải < H và mọi lần huỷ phải trước ngày khởi hành (`canCancelOnline`). Mốc
    // trả tiền ở đây cố tình nằm ngoài trần "≤ ngày chót" của `datMotBooking`: sổ tổng hợp
    // chỉ kiểm nhánh của `apDungKhachTuHuy`, không kiểm luật đặt chỗ.
    const kq = soMotBooking('syn-huy-rong', H, H - NGAY_MS + 5 * GIO_MS);
    apDungKhachTuHuy(kq, H);
    expect(kq.cancellationRequests).toEqual([]);
    expect(kq.refunds).toEqual([]);
    expect(kq.bookings[0]?.status).toBe('PAID');
  });
});

describe.each(MOC)('sàn booking quá hạn với H = %s', (giaTri) => {
  const homNay = docMocHomNay(giaTri);
  const H = homNay.getTime();
  const khach = sinhKhach(homNay);
  const lich = sinhLich(homNay);
  /** Chuyến còn bán đã qua hạn chót tại H mà chưa khởi hành. */
  const quaHan = lich.filter(
    (d) =>
      d.status === 'OPEN' &&
      ngay(d.startDate) > H &&
      ngay(cancellationDeadline(d.startDate, d.endDate)) < H,
  );
  const soTrong = (kq: DuLieuVanHanh): number => {
    const hopLe = new Set(quaHan.map((d) => d.id));
    return kq.bookings.filter((b) => b.status === 'PAID' && hopLe.has(b.departureId)).length;
  };

  it('sổ trống: bù vừa đủ sàn, chạy lại không thêm gì', () => {
    const kq: DuLieuVanHanh = {
      bookings: [],
      paymentEvents: [],
      refunds: [],
      cancellationRequests: [],
    };
    baoDamBookingQuaHan(kq, H, lich, khach);
    expect(soTrong(kq)).toBeGreaterThanOrEqual(3);
    const soDong = kq.bookings.length;
    baoDamBookingQuaHan(kq, H, lich, khach);
    expect(kq.bookings).toHaveLength(soDong);
  });

  it('hụt sàn thì ném lỗi, không âm thầm để seed thiếu ca demo huỷ quá hạn', () => {
    const kq: DuLieuVanHanh = {
      bookings: [],
      paymentEvents: [],
      refunds: [],
      cancellationRequests: [],
    };
    expect(() => baoDamBookingQuaHan(kq, H, lich, [])).toThrow(/sàn booking quá hạn/);
  });
});
```

- [ ] **Step 16: Chạy `bookings.spec.ts`, xác nhận đỏ**

Run: `pnpm --filter @tourism/api exec vitest run prisma/fixtures/operations/bookings.spec.ts`
Expected: FAIL ngay ở khâu nạp module — `apDungKhachTuHuy` và `baoDamBookingQuaHan` chưa tồn tại (`SyntaxError: The requested module './bookings.js' does not provide an export named 'apDungKhachTuHuy'`, hoặc lỗi type tương ứng). Đó là đỏ hợp lệ: cả ba nhóm test mới đều chưa có gì để chạy.

- [ ] **Step 17: Đổi kiểu fixture và khối JSDoc đầu `bookings.ts`**

`apps/api/prisma/fixtures/operations/bookings.ts`, dòng 1, trước:

```ts
import { policyRefundAmount, refundPercentForRequest } from '@tourism/contract';
```

Sau:

```ts
import { cancellationDeadline, refundOnCancel } from '@tourism/contract';
```

Trong khối JSDoc đầu file, trước:

```ts
 * ── Mọi mốc nằm trong khung ──
 * `paidAt` ≥ ngày khách đăng ký + 1 ngày và ≥ lúc chuyến mở bán; < ngày khởi hành;
 * < H. Không mốc giao dịch nào chạm H.
 *
 * ── Hình dạng khớp luồng thật (`docs/conventions/booking-states.md`) ──
 * Mỗi hình dạng ứng với đúng một luồng của app; tổ hợp nào app không tạo ra được
 * thì seed cũng không được tạo (bản 10/09 từng có bốn tổ hợp như vậy trên prod):
 *   PAID       thanh toán thành công.
 *   REFUNDED   admin hoàn đủ cho chuyến công ty huỷ — refund kèm lý do, KHÔNG yêu cầu
 *              huỷ, KHÔNG `cancelledAt`.
 *   CANCELLED  (a) giỏ bỏ dở: chưa trả, job `pending-sweep` huỷ sau 65 phút;
 *              (b) khách xin huỷ và admin duyệt: yêu cầu REFUNDED, hoàn theo bậc chính
 *                  sách, bậc 0% thì không có refund.
 * Yêu cầu DENIED và REQUESTED giữ booking ở PAID.
 */
```

Sau:

```ts
 * ── Mọi mốc nằm trong khung ──
 * `paidAt` ≥ ngày khách đăng ký + 1 ngày và ≥ lúc chuyến mở bán; ≤ hạn chót của chuyến
 * (ADR-0041 — sau hạn chót app từ chối tạo booking, nên seed cũng không được có);
 * < H. Không mốc giao dịch nào chạm H.
 *
 * ── Ngày Việt Nam = ngày UTC trong bộ seed này ──
 * Mọi mốc dựng theo khuôn `ngayUTC(x) + gioTrongNgay(rnd)`, mà `gioTrongNgay` chỉ trả
 * 01:00–15:00 UTC, tức 08:00–22:00 giờ Việt Nam của CHÍNH ngày đó. Nhờ vậy phép so ngày
 * ở đây làm bằng mốc ms vẫn cho ra cùng kết quả với `vietnamToday` của contract. Ai đổi
 * `gioTrongNgay` phải đọc lại chỗ này trước.
 *
 * ── Hình dạng khớp luồng thật (`docs/conventions/booking-states.md`) ──
 * Mỗi hình dạng ứng với đúng một luồng của app; tổ hợp nào app không tạo ra được
 * thì seed cũng không được tạo (bản 10/09 từng có bốn tổ hợp như vậy trên prod):
 *   PAID       thanh toán thành công.
 *   REFUNDED   admin hoàn đủ cho chuyến công ty huỷ — refund kèm lý do, `admin_id` có
 *              người, KHÔNG yêu cầu huỷ, KHÔNG `cancelledAt`.
 *   CANCELLED  (a) giỏ bỏ dở: chưa trả, job `pending-sweep` huỷ sau 65 phút;
 *              (b) khách tự huỷ TRONG hạn: yêu cầu REFUNDED do chính khách quyết, đúng
 *                  một dòng hoàn bằng phần còn lại, `admin_id` NULL;
 *              (c) khách tự huỷ QUÁ hạn: yêu cầu REFUNDED, KHÔNG dòng hoàn nào.
 * Không còn DENIED hay REQUESTED: ADR-0041 gỡ luồng duyệt huỷ, app không tạo ra được
 * hai trạng thái đó nữa.
 */
```

Thay khối `RefundFixture`, trước:

```ts
export interface RefundFixture {
  id: string;
  bookingId: string;
  amount: string;
  currency: string;
  providerRefundId: string;
  providerPaymentId: string | null;
  /** Lý do NỘI BỘ: có ở hoàn tiền do admin phát hành, null ở hoàn tiền khi duyệt yêu cầu huỷ. */
  reason: string | null;
  createdAt: string;
}
```

Sau:

```ts
export interface RefundFixture {
  id: string;
  bookingId: string;
  amount: string;
  currency: string;
  providerRefundId: string;
  providerPaymentId: string | null;
  /** Lý do NỘI BỘ: có ở hoàn tiền do admin phát hành, null ở dòng hoàn sinh khi khách tự huỷ. */
  reason: string | null;
  /**
   * true = admin bấm hoàn (seed ghi `admin_id` = admin). false = lõi huỷ ghi lúc khách tự
   * huỷ, `admin_id` phải NULL (Hợp đồng C): admin không đứng sau hành động đó, và trang
   * admin dựa vào cột ấy để không gán nhầm việc của khách cho người trực.
   */
  issuedByAdmin: boolean;
  createdAt: string;
}
```

Thay khối `CancellationRequestFixture`, trước:

```ts
export interface CancellationRequestFixture {
  id: string;
  bookingId: string;
  userId: string;
  reason: string;
  freeCancellationDays: number | null;
  status: 'REFUNDED' | 'REQUESTED' | 'DENIED';
  decisionNote: string | null;
  /** Null nghĩa là CHƯA có phán quyết (REQUESTED). */
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Sau:

```ts
/**
 * Yêu cầu huỷ sau ADR-0041: app chỉ còn MỘT hình dạng — khách bấm huỷ, hệ thống chốt ngay.
 * Không còn REQUESTED hay DENIED nên `decisionNote` biến mất theo; `freeCancellationDays`
 * cũng vậy, vì hạn chót nay suy ra từ độ dài chuyến chứ không phải số ghim trên tour.
 * `createdAt` LUÔN bằng `decidedAt`: lõi huỷ (Hợp đồng C) ghi cả hai bằng cùng một `now()`
 * của DB, và báo cáo (Hợp đồng D) xếp loại trong/quá hạn bằng `createdAt` trong khi số tiền
 * tính tại mốc huỷ — để hai mốc lệch nhau là để sổ hoàn và báo cáo nói hai chuyện.
 */
export interface CancellationRequestFixture {
  id: string;
  bookingId: string;
  userId: string;
  /** Khách được phép bỏ trống ô lý do — Task 2 cho cột `reason` nhận NULL. */
  reason: string | null;
  status: 'REFUNDED';
  decidedAt: string;
  createdAt: string;
  updatedAt: string;
}
```

Trong `datMotBooking`, khối ghi refund của chuyến công ty huỷ, trước:

```ts
    reason: LY_DO_CONG_TY_HUY,
    createdAt: isoGio(hoanLuc),
  });
```

Sau:

```ts
    reason: LY_DO_CONG_TY_HUY,
    issuedByAdmin: true,
    createdAt: isoGio(hoanLuc),
  });
```

- [ ] **Step 18: Kẹp `paid_at` và giỏ bỏ dở trước hạn chót** — cùng file

Thêm hằng số, sau `const DAT_TRUOC_TOI_DA_NGAY = 90;`:

```ts
/**
 * Trần của `gioTrongNgay` (15:00 UTC = 22:00 giờ Việt Nam cùng ngày). Dùng để so mốc THẲNG
 * thay vì cắt về nửa đêm UTC: một mốc 18:00 UTC của ngày chót vẫn "đúng ngày UTC" nhưng đã
 * là hôm sau ở Việt Nam, tức đã quá hạn theo `isWithinDeadline`.
 */
const TRAN_GIO_TRONG_NGAY = 15 * GIO_MS;
```

Trong `datMotBooking`, trước:

```ts
  // Ngày trả tiền muộn nhất (nửa đêm UTC): trước khởi hành 1 ngày — 2 ngày với chuyến
  // công ty sẽ huỷ, để mốc hoàn vẫn rơi trước ngày khởi hành — và trước ngày H.
  const ngayMuonNhat = Math.min(batDau - (congTyHuy ? 2 : 1) * NGAY_MS, so.H - NGAY_MS);
```

Sau:

```ts
  // Ngày trả tiền muộn nhất (nửa đêm UTC): trước khởi hành 1 ngày — 2 ngày với chuyến
  // công ty sẽ huỷ, để mốc hoàn vẫn rơi trước ngày khởi hành — trước ngày H, và KHÔNG
  // muộn hơn ngày chót của chuyến: từ ADR-0041 app từ chối tạo booking sau hạn chót, nên
  // một `paid_at` muộn hơn là hình dạng app không bao giờ đẻ ra được.
  const hanChot = ngayCua(cancellationDeadline(dep.startDate, dep.endDate));
  const ngayMuonNhat = Math.min(
    batDau - (congTyHuy ? 2 : 1) * NGAY_MS,
    so.H - NGAY_MS,
    hanChot,
  );
```

Trong cùng hàm, vòng bốc khách, trước:

```ts
    if (ngayUTC(somNhatCua(ung)) > ngayMuonNhat) continue;
```

Sau:

```ts
    // So THẲNG mốc, không cắt về nửa đêm: mốc 17:00 UTC trở đi của ngày chót đã sang hôm
    // sau theo giờ Việt Nam, và `paidAt` lấy `max(somNhat, …)` nên mốc đó lọt thẳng ra.
    if (somNhatCua(ung) > ngayMuonNhat + TRAN_GIO_TRONG_NGAY) continue;
```

Trong `themGioBoDo`, trước:

```ts
    const batDau = ngayCua(dep.startDate);
    const tu = Math.max(Date.parse(dep.createdAt), nguoi.createdAt.getTime() + NGAY_MS);
    // Chuyến sẽ bị công ty huỷ thì không ai mở checkout trong hai tuần cuối trước ngày đi.
    const den = Math.min(batDau - (dep.status === 'CANCELLED' ? 15 : 2) * NGAY_MS, H - 2 * GIO_MS);
```

Sau:

```ts
    const batDau = ngayCua(dep.startDate);
    const tu = Math.max(Date.parse(dep.createdAt), nguoi.createdAt.getTime() + NGAY_MS);
    // Chuyến sẽ bị công ty huỷ thì không ai mở checkout trong hai tuần cuối trước ngày đi.
    // Giỏ bỏ dở là một lượt checkout THẬT nên cũng phải nằm trong hạn đặt chỗ: kẹp thêm
    // vào 22:00 giờ Việt Nam của ngày chót. Mốc huỷ sau đó 65–80 phút cùng lắm tới 16:20
    // UTC, vẫn là ngày chót ở Việt Nam (ngày chỉ nhảy từ 17:00 UTC).
    const hanChot = ngayCua(cancellationDeadline(dep.startDate, dep.endDate));
    const den = Math.min(
      batDau - (dep.status === 'CANCELLED' ? 15 : 2) * NGAY_MS,
      H - 2 * GIO_MS,
      hanChot + TRAN_GIO_TRONG_NGAY,
    );
```

- [ ] **Step 19: Thay `apDungYeuCauHuy` bằng `apDungKhachTuHuy`** — cùng file

Xoá TRỌN các khối sau (từ `const LY_DO_DOI_NGAY` tới hết hàm `apDungYeuCauHuy`, tức khối dòng 455–623 của bản gốc): `LY_DO_DOI_NGAY`, `GHI_CHU_TU_CHOI`, `BAC_HOAN`, `MOI_BAC`, `SO_TU_CHOI`, `SO_DANG_CHO`, `soNgayChoBac`, `apDungYeuCauHuy`. GIỮ `LY_DO_KHACH_HUY` và `SO_GIO_BO_DO`.

Đặt vào đúng chỗ vừa xoá:

```ts
/** Số ca huỷ mỗi loại — đủ cho hai dòng báo cáo (Hợp đồng D) và cả hai nhánh giao diện. */
const SO_HUY_TRONG_HAN = 9;
const SO_HUY_QUA_HAN = 6;
/** Tỉ lệ khách bấm huỷ mà bỏ trống ô lý do — cột `reason` nay nhận NULL (Task 2). */
const TY_LE_KHONG_LY_DO = 0.25;

/**
 * Khách TỰ huỷ booking đã trả (ADR-0041 §3.3): không ai duyệt, nên mỗi lần huỷ đẻ ra đúng
 * một yêu cầu `REFUNDED` do chính khách quyết, cộng một dòng hoàn NẾU còn trong hạn.
 *
 * ── Vì sao chọn NGÀY rồi mới gắn giờ ──
 * Mốc huỷ dựng bằng `<nửa đêm UTC của một ngày> + gioTrongNgay(rnd)`, tức 01:00–15:00 UTC
 * = 08:00–22:00 giờ Việt Nam CÙNG ngày. Nhờ vậy ngày Việt Nam của mốc đúng bằng ngày UTC
 * đã chọn, và phép so với ngày chót ở đây khớp `isWithinDeadline` của contract. Dùng
 * `mocTrongKhoang` thì không: nó kẹp về biên `tu`, mà `tu` là `paidAt` cộng vài giờ nên
 * có thể rơi ra ngoài dải giờ ban ngày.
 *
 * ── KHÔNG ném lỗi khi hụt ca ──
 * Đây là bước TẠO HÌNH, không phải sàn. Sàn demo "còn booking để huỷ quá hạn" do
 * `baoDamBookingQuaHan` giữ và chính nó mới ném; số ca huỷ chỉ là assertion trong spec.
 * Export để test nhánh.
 */
export function apDungKhachTuHuy(kq: DuLieuVanHanh, H: number): void {
  const ungVien = kq.bookings
    .filter((b) => b.status === 'PAID' && b.paidAt !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
  const daDung = new Set<string>();

  /**
   * Khoảng NGÀY (nửa đêm UTC) mà khách còn bấm huỷ được, theo loại ca. Null = khoảng rỗng.
   * Cả hai loại đều chặn trên bởi H − 1 ngày: không mốc giao dịch nào chạm H.
   */
  const cuaSoNgay = (b: BookingFixture, loai: 'trong-han' | 'qua-han'): [number, number] | null => {
    if (b.paidAt === null) return null;
    const hanChot = ngayCua(cancellationDeadline(b.departureStartDate, b.departureEndDate));
    const sauKhiTra = ngayUTC(Date.parse(b.paidAt)) + NGAY_MS;
    const truocH = H - NGAY_MS;
    // Quá hạn: sau ngày chót và TRƯỚC ngày khởi hành (`canCancelOnline`). Tour 1 ngày có
    // D = ngày đi − 1 nên khoảng này rỗng — đúng luật, không phải thiếu sót.
    const tu = loai === 'trong-han' ? sauKhiTra : Math.max(sauKhiTra, hanChot + NGAY_MS);
    const den =
      loai === 'trong-han'
        ? Math.min(hanChot, truocH)
        : Math.min(ngayCua(b.departureStartDate) - NGAY_MS, truocH);
    return den < tu ? null : [tu, den];
  };

  for (const loai of ['trong-han', 'qua-han'] as const) {
    const muon = loai === 'trong-han' ? SO_HUY_TRONG_HAN : SO_HUY_QUA_HAN;
    let soDaChon = 0;
    for (const b of ungVien) {
      if (soDaChon >= muon) break;
      if (daDung.has(b.id) || b.status !== 'PAID') continue;
      const cua = cuaSoNgay(b, loai);
      if (cua === null) continue;
      const rnd = boSinh(`huy-khach:${loai}:${b.id}`);
      const [tu, den] = cua;
      const huyLuc =
        tu + nguyen(rnd, 0, Math.round((den - tu) / NGAY_MS)) * NGAY_MS + gioTrongNgay(rnd);
      // Tính bằng CHÍNH hàm luật mà API, web và email dùng: trong hạn ra phần còn lại,
      // quá hạn ra '0.00'. Seed không bao giờ tự nhân chia lấy số tiền hoàn.
      const soTien = refundOnCancel({
        now: new Date(huyLuc),
        startDate: b.departureStartDate,
        endDate: b.departureEndDate,
        totalAmount: b.totalAmount,
        refundedTotal: '0.00',
      });

      kq.cancellationRequests.push({
        id: idTinh('huy-khach', b.id),
        bookingId: b.id,
        userId: b.userId,
        reason: rnd() < TY_LE_KHONG_LY_DO ? null : chonMot(rnd, LY_DO_KHACH_HUY),
        status: 'REFUNDED',
        decidedAt: isoGio(huyLuc),
        createdAt: isoGio(huyLuc),
        updatedAt: isoGio(huyLuc),
      });
      b.status = 'CANCELLED';
      b.cancelledAt = isoGio(huyLuc);
      b.updatedAt = isoGio(huyLuc);
      // Quá hạn KHÔNG ghi dòng hoàn nào: sổ refund chỉ kể tiền thật sự đi ra.
      if (Number(soTien) > 0) {
        kq.refunds.push({
          id: idTinh('refund', b.id),
          bookingId: b.id,
          amount: soTien,
          currency: b.currency,
          providerRefundId: maHoan(b.paymentProvider, b.id),
          providerPaymentId: b.providerPaymentId,
          reason: null,
          issuedByAdmin: false,
          createdAt: isoGio(huyLuc),
        });
        kq.paymentEvents.push(suKienHoan(b, soTien, huyLuc));
      }
      daDung.add(b.id);
      soDaChon++;
    }
  }
}
```

Nếu Biome báo `mocTrongKhoang` hoặc `GIO_MS` thành import thừa sau bước này thì gỡ khỏi khối import — `themGioBoDo` vẫn dùng cả hai nên nhiều khả năng không đổi.

- [ ] **Step 20: Thêm `baoDamBookingQuaHan` và nối vào `sinhVanHanh`** — cùng file

Thêm hằng số, cạnh `SAN_BOOKING_DA_DI`:

```ts
/** Sàn demo (spec 2026-09-15 §11): số booking PAID trên chuyến đã qua hạn chót mà chưa khởi hành. */
const SAN_BOOKING_QUA_HAN = 3;
```

Rút phần dựng trạng thái chung của `baoDamBookingDaDi` ra thành hàm dùng lại. Trong `baoDamBookingDaDi`, trước:

```ts
  const so: SoDatCho = {
    kq,
    H,
    khach,
    lichKhach: new Map(),
    daDat: new Set(),
    ghe: demGhe(kq.bookings),
  };
  // Lịch kín và cặp khách–chuyến dựng lại từ MỌI booking đang có, kể cả booking đã huỷ.
  for (const b of kq.bookings) {
    so.daDat.add(`${b.userId}:${b.departureId}`);
    const chuyenCu = so.lichKhach.get(b.userId) ?? [];
    so.lichKhach.set(b.userId, [
      ...chuyenCu,
      [ngayCua(b.departureStartDate), ngayCua(b.departureEndDate)],
    ]);
  }
```

Sau (và đặt hàm mới NGAY TRÊN `baoDamBookingDaDi`):

```ts
/**
 * Trạng thái đặt chỗ dựng lại từ sổ hiện có, để bước bù đi qua ĐÚNG luật của lượt tự nhiên.
 * Lịch kín và cặp khách–chuyến tính từ MỌI booking, kể cả booking đã huỷ.
 */
function soDatChoTuSo(kq: DuLieuVanHanh, H: number, khach: KhachFixture[]): SoDatCho {
  const so: SoDatCho = {
    kq,
    H,
    khach,
    lichKhach: new Map(),
    daDat: new Set(),
    ghe: demGhe(kq.bookings),
  };
  for (const b of kq.bookings) {
    so.daDat.add(`${b.userId}:${b.departureId}`);
    const chuyenCu = so.lichKhach.get(b.userId) ?? [];
    so.lichKhach.set(b.userId, [
      ...chuyenCu,
      [ngayCua(b.departureStartDate), ngayCua(b.departureEndDate)],
    ]);
  }
  return so;
}
```

và trong `baoDamBookingDaDi` chỉ còn:

```ts
  const so = soDatChoTuSo(kq, H, khach);
```

Thêm hàm mới ngay SAU `baoDamBookingDaDi`:

```ts
/**
 * Sàn "còn booking để demo huỷ quá hạn" (spec 2026-09-15 §7 và §11): ít nhất
 * `SAN_BOOKING_QUA_HAN` booking PAID nằm trên chuyến CÒN BÁN đã qua hạn chót tại H mà chưa
 * khởi hành. `departures-2026.ts` bảo đảm luôn có 6 chuyến như vậy (mỗi tour ≥ 4 ngày một
 * chuyến), nhưng lượt đặt tự nhiên chỉ đụng tới chuyến OPEN với xác suất 0,75 nên không có
 * gì bảo đảm chúng có khách.
 *
 * Chạy SAU `apDungKhachTuHuy` — nếu chạy trước, chính bước huỷ có thể lấy mất đúng những
 * booking này — và bù bằng chính `datMotBooking` trên chỉ số `qua-han-<n>`, nên id không đụng
 * booking tự nhiên và mọi luật đặt chỗ vẫn giữ (gồm cả trần `paid_at` ≤ ngày chót của Step 18).
 * Hụt sàn thì ném: fixture sinh lúc import, trước mọi lệnh ghi, nên seed không bao giờ ghi
 * một bộ dữ liệu thiếu ca demo. Export để test nhánh.
 */
export function baoDamBookingQuaHan(
  kq: DuLieuVanHanh,
  H: number,
  lich: TourDepartureFixture[],
  khach: KhachFixture[],
): void {
  const so = soDatChoTuSo(kq, H, khach);
  const chuyen = lich.filter(
    (d) =>
      d.status === 'OPEN' &&
      ngayCua(d.startDate) > H &&
      ngayCua(cancellationDeadline(d.startDate, d.endDate)) < H,
  );
  const hopLe = new Set(chuyen.map((d) => d.id));
  const soQuaHan = (): number =>
    kq.bookings.filter((b) => b.status === 'PAID' && hopLe.has(b.departureId)).length;
  for (let n = 0; n < LUOT_BU_TOI_DA && soQuaHan() < SAN_BOOKING_QUA_HAN; n++) {
    const dep = chuyen[n % chuyen.length];
    if (!dep) break;
    const tour = bangTour.get(dep.tourId);
    if (!tour) break;
    datMotBooking(so, dep, tour, `qua-han-${n}`);
  }
  if (soQuaHan() < SAN_BOOKING_QUA_HAN) {
    throw new Error(
      `sàn booking quá hạn: chỉ có ${soQuaHan()}/${SAN_BOOKING_QUA_HAN} booking PAID trên chuyến đã qua hạn chót với H = ${isoGio(H)}`,
    );
  }
}
```

Trong `sinhVanHanh`, trước:

```ts
  const duLieu = sinhDatCho(H, lich, khach);
  apDungYeuCauHuy(duLieu, H);
  // Sau bước duyệt huỷ: bước đó có thể lấy mất booking đã đi của một tour ít chuyến.
  baoDamBookingDaDi(duLieu, H, lich, khach);
  themGioBoDo(duLieu, H, lich, khach);
  // Đếm ghế SAU khi huỷ: booking huỷ đã duyệt trả ghế về, giỏ bỏ dở chưa từng giữ ghế.
```

Sau:

```ts
  const duLieu = sinhDatCho(H, lich, khach);
  apDungKhachTuHuy(duLieu, H);
  // Hai sàn chạy SAU bước huỷ: bước huỷ có thể lấy mất đúng booking mà sàn đang đếm.
  baoDamBookingDaDi(duLieu, H, lich, khach);
  baoDamBookingQuaHan(duLieu, H, lich, khach);
  themGioBoDo(duLieu, H, lich, khach);
  // Đếm ghế SAU khi huỷ: booking khách tự huỷ trả ghế về, giỏ bỏ dở chưa từng giữ ghế.
```

- [ ] **Step 21: Chạy `bookings.spec.ts` và `khung-ngay.spec.ts`, xác nhận xanh**

Run:

```bash
pnpm --filter @tourism/api exec vitest run prisma/fixtures/operations/bookings.spec.ts prisma/fixtures/khung-ngay.spec.ts prisma/fixtures/catalog/departures-2026.spec.ts
```

Expected: PASS toàn bộ ở cả hai mốc cố định và cả 30 mốc của `khung-ngay.spec.ts`.

Nếu một mốc lẻ đỏ ở "sàn booking quá hạn" (ném từ `baoDamBookingQuaHan`): KHÔNG hạ sàn và KHÔNG bỏ qua mốc. Hai chỗ sửa hợp lệ, theo thứ tự thử: (a) nới `QUA_HAN_MUON_NHAT` của `departures-2026.ts` lên 6 vẫn giữ (đừng vượt 6 — N = 7 nên H + 7 đã còn trong hạn), thay vào đó hạ cận dưới xuống `nguyen(rnd, 2, 5)` để chuyến qua hạn xa ngày H hơn, cho cửa sổ `paid_at` rộng ra; (b) tăng `LUOT_BU_TOI_DA` — mỗi lượt bù là một lần bốc khách và 60 lượt có thể hụt khi lịch khách đã kín.

- [ ] **Step 22: `seed.ts` — `tourFaqs` upsert, xoá policy CANCELLATION còn sót, sửa thông điệp chốt chặn**

`apps/api/prisma/seed.ts`, trong `insertCatalog`, trước:

```ts
    ['tourFaqs', () => prisma.tourFaq.createMany({ data: catalog.tourFaqs, skipDuplicates: true })],
```

Sau:

```ts
    [
      'tourFaqs',
      // UPSERT cùng lý do với `tourPolicies` (ADR-0023 §3): câu hỏi và câu trả lời là NỘI
      // DUNG BIÊN TẬP. ADR-0041 sửa sáu câu còn hứa mốc huỷ riêng hoặc đổi ngày miễn phí;
      // giữ `createMany({ skipDuplicates })` thì DB đang chạy KHÔNG BAO GIỜ thấy bản sửa —
      // đúng cái bẫy đã dính ngày 14/08 với năm cột mới của tour.
      async () => {
        for (const f of catalog.tourFaqs) {
          const data = { question: f.question, answer: f.answer, order: f.order };
          await prisma.tourFaq.upsert({
            where: { id: f.id },
            create: { id: f.id, tour: { connect: { id: f.tourId } }, ...data },
            update: data,
          });
        }
        return { count: catalog.tourFaqs.length };
      },
    ],
```

Thêm một bước NGAY SAU bước `'tourPolicies'` (trước bước `'tourDepartures'`):

```ts
    [
      'tourPoliciesHuyCu',
      // Fixture không còn policy loại CANCELLATION (ADR-0041): nội dung huỷ nay sinh từ luật
      // chung ở `@tourism/contract`. Upsert ở trên chỉ ghi đè dòng CÓ trong fixture, nên 29
      // dòng cũ trên DB đang chạy sẽ ở lại vĩnh viễn và trang tour in hai chính sách đá nhau.
      // Xoá theo `kind` nên chạy bao nhiêu lần cũng ra cùng kết quả; giá trị enum vẫn còn
      // trong `PolicyKind` của DB, chỉ fixture thôi không dùng.
      () => prisma.tourPolicy.deleteMany({ where: { kind: 'CANCELLATION' } }),
    ],
```

Sửa hai chỗ khai số policy trong chốt chặn production (fixture nay còn 58 policy, và seed xoá thêm loại CANCELLATION nên nó ĐỘNG tới nhiều hơn là ghi đè). Khối comment trên `const LA_PROD`, trước:

```ts
// biên tập của 29 tour và 87 policy (upsert), nên prod không bao giờ được là đích
```

Sau:

```ts
// biên tập của 29 tour, 58 policy và toàn bộ FAQ (upsert), đồng thời XOÁ mọi policy
// loại CANCELLATION còn lại, nên prod không bao giờ được là đích
```

Thân thông điệp từ chối, trước:

```ts
  Seed sẽ GHI ĐÈ nội dung biên tập của 29 tour và 87 policy (cả hai dùng
  upsert), và chèn toàn bộ tầng vận hành. Muốn chạy thật thì cần CẢ cờ lẫn mốc
```

Sau:

```ts
  Seed sẽ GHI ĐÈ nội dung biên tập của 29 tour, 58 policy và toàn bộ FAQ (cả ba
  dùng upsert), XOÁ mọi policy loại CANCELLATION (ADR-0041), và chèn toàn bộ
  tầng vận hành. Muốn chạy thật thì cần CẢ cờ lẫn mốc
```

- [ ] **Step 23: `seed.ts` — `admin_id` NULL khi khách tự huỷ, `decided_by` là khách**

Khối import enum, trước:

```ts
import {
  BookingStatus,
  CancellationRequestStatus,
  PaymentProvider,
  PostStatus,
  ReviewSource,
  UserRole,
} from '../src/generated/prisma/enums.js';
```

Sau (`CancellationRequestStatus` hết việc: `status` của fixture nay là literal `'REFUNDED'`, gán thẳng được):

```ts
import {
  BookingStatus,
  PaymentProvider,
  PostStatus,
  ReviewSource,
  UserRole,
} from '../src/generated/prisma/enums.js';
```

Khối chèn refund, trước:

```ts
        reason: r.reason,
        adminId: admin.id,
        createdAt: new Date(r.createdAt),
```

Sau:

```ts
        reason: r.reason,
        // Hợp đồng C: dòng hoàn sinh ra lúc KHÁCH tự huỷ không có admin đứng sau, `admin_id`
        // phải NULL. Chỉ hoàn do admin phát hành (chuyến công ty huỷ, hoàn thiện chí) mới gán.
        adminId: r.issuedByAdmin ? admin.id : null,
        createdAt: new Date(r.createdAt),
```

Khối chèn yêu cầu huỷ, trước:

```ts
  const { count: soYeuCau } = await prisma.cancellationRequest.createMany({
    data: cancellationRequestsGia.map((c) => ({
      id: c.id,
      bookingId: c.bookingId,
      userId: c.userId,
      reason: c.reason,
      freeCancellationDays: c.freeCancellationDays,
      status: c.status as CancellationRequestStatus,
      decisionNote: c.decisionNote,
      // Yêu cầu đang CHỜ chưa có ai quyết — người quyết và mốc quyết đều null.
      decidedById: c.decidedAt ? admin.id : null,
      decidedAt: c.decidedAt ? new Date(c.decidedAt) : null,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
    })) as unknown as Prisma.CancellationRequestCreateManyInput[],
    skipDuplicates: true,
  });
```

Sau:

```ts
  const { count: soYeuCau } = await prisma.cancellationRequest.createMany({
    data: cancellationRequestsGia.map((c) => ({
      id: c.id,
      bookingId: c.bookingId,
      userId: c.userId,
      reason: c.reason,
      status: c.status,
      // ADR-0041: không còn ai duyệt, chính KHÁCH là người quyết. Task 8 dựng cờ
      // `decidedByCustomer` của contract từ đúng phép so `decided_by = user_id` này, nên
      // ghi admin vào đây là nói sai ai đã huỷ. `free_cancellation_days` và `decision_note`
      // để trống — hai cột đó ra đi cùng nhánh M2 (Phụ lục A).
      decidedById: c.userId,
      decidedAt: new Date(c.decidedAt),
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
    })) as unknown as Prisma.CancellationRequestCreateManyInput[],
    skipDuplicates: true,
  });
```

- [ ] **Step 24: `verify-seed.mjs` — import luật và ba bất biến SQL mới**

`apps/api/scripts/verify-seed.mjs`, khối import, trước:

```js
import pg from 'pg';
```

Sau:

```js
import { isWithinDeadline, refundOnCancel } from '@tourism/contract';
import pg from 'pg';
```

Bổ sung vào khối JSDoc đầu file, sau dòng `* CHỈ ĐỌC: …`:

```js
 * Một số bất biến gọi thẳng hàm luật của `@tourism/contract` thay vì chép lại luật bằng SQL —
 * hai bản luật là hai chỗ để sai. Vì vậy `seed:verify` cần contract đã build
 * (`pnpm --filter @tourism/contract build`), y như `db:seed`.
```

Thêm ba mục vào CUỐI mảng `BAT_BIEN` (ngay trước mục `'outbox còn dòng PENDING…'`):

```js
  // ── Luật một hạn chót (ADR-0041, spec 2026-09-15 §7) ──
  [
    'yêu cầu huỷ còn REQUESTED hoặc DENIED (luồng duyệt đã gỡ)',
    `select count(*)::int as n from cancellation_requests where status in ('REQUESTED', 'DENIED')`,
    false,
  ],
  [
    'dòng hoàn lúc khách tự huỷ lại có admin_id',
    `select count(*)::int as n from refunds r join bookings b on b.id = r.booking_id where b.status = 'CANCELLED' and b.paid_at is not null and r.admin_id is not null`,
    false,
  ],
  [
    'yêu cầu huỷ có người quyết không phải chính khách',
    `select count(*)::int as n from cancellation_requests where decided_by is distinct from user_id`,
    false,
  ],
```

- [ ] **Step 25: `verify-seed.mjs` — ba bất biến tính bằng hàm luật**

Thêm, ngay TRƯỚC dòng `const client = new pg.Client({ connectionString: url });`:

```js
/**
 * Mốc "hôm nay" dạng `Date` để đưa vào hàm luật: 05:00 UTC = 12:00 trưa giờ Việt Nam của H,
 * nên `vietnamToday(MOC_H)` đúng bằng `homNay` bất kể máy chạy ở múi nào.
 */
const MOC_H = new Date(`${homNay}T05:00:00.000Z`);
/**
 * Lấy mốc và ngày ra dạng CHỮ. Cột `timestamp without time zone` giữ giờ UTC, nhưng node-pg
 * dựng `Date` từ nó theo giờ MÁY — đọc thẳng là lệch đúng offset của máy (ở đây UTC+7), đủ để
 * một mốc sát nửa đêm nhảy sang ngày khác và bất biến báo sai.
 */
const utc = (cot) => `to_char(${cot}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const ngayIso = (cot) => `to_char(${cot}, 'YYYY-MM-DD')`;

/**
 * Bất biến cần LUẬT: `sql` trả về NHIỀU dòng, `dem(rows)` đếm vi phạm bằng chính hàm của
 * contract; `dungMoc` (mặc định false) quyết có truyền tham số H ($1) vào câu SQL không.
 */
const BAT_BIEN_LUAT = [
  {
    ten: 'booking trả tiền sau hạn chót của chuyến',
    sql: `select b.id, ${utc('b.paid_at')} as paid_at, ${ngayIso('b.departure_start_date')} as bat_dau, ${ngayIso('b.departure_end_date')} as ket_thuc
          from bookings b where b.paid_at is not null`,
    dem: (rows) =>
      rows.filter((r) => !isWithinDeadline(new Date(r.paid_at), r.bat_dau, r.ket_thuc)).length,
  },
  {
    ten: 'lần huỷ của khách hoàn sai luật (trong hạn = phần còn lại một dòng, quá hạn = không dòng nào)',
    sql: `select c.id, ${utc('c.created_at')} as huy_luc, ${ngayIso('b.departure_start_date')} as bat_dau,
            ${ngayIso('b.departure_end_date')} as ket_thuc, b.total_amount::text as tong,
            (select coalesce(sum(r.amount), 0) from refunds r where r.booking_id = b.id)::text as da_hoan,
            (select count(*) from refunds r where r.booking_id = b.id)::int as so_dong
          from cancellation_requests c join bookings b on b.id = c.booking_id
          where c.status = 'REFUNDED' and b.status = 'CANCELLED' and b.paid_at is not null`,
    dem: (rows) =>
      rows.filter((r) => {
        // Booking đã huỷ trong seed chưa từng được hoàn phần nào trước đó, nên phần còn lại
        // là toàn bộ `total_amount`; một hàm phủ cả hai nhánh, không rẽ if theo ngày.
        const can = refundOnCancel({
          now: new Date(r.huy_luc),
          startDate: r.bat_dau,
          endDate: r.ket_thuc,
          totalAmount: r.tong,
          refundedTotal: '0.00',
        });
        return Number(r.da_hoan) !== Number(can) || r.so_dong !== (Number(can) > 0 ? 1 : 0);
      }).length,
  },
  {
    ten: 'thiếu booking đã trả trên chuyến đã qua hạn chót mà chưa khởi hành (demo §11)',
    sql: `select ${ngayIso('d.start_date')} as bat_dau, ${ngayIso('d.end_date')} as ket_thuc,
            (select count(*) from bookings b where b.departure_id = d.id and b.status = 'PAID')::int as so_booking
          from tour_departures d where d.status = 'OPEN' and d.start_date > $1::date`,
    dungMoc: true,
    dem: (rows) =>
      rows
        .filter((r) => !isWithinDeadline(MOC_H, r.bat_dau, r.ket_thuc))
        .reduce((tong, r) => tong + r.so_booking, 0) >= 3
        ? 0
        : 1,
  },
];
```

Nối vào danh sách chạy, trước:

```js
for (const [ten, sql, dungMoc] of BAT_BIEN) kiemTra.push({ ten, sql, dungMoc });
```

Sau:

```js
for (const [ten, sql, dungMoc] of BAT_BIEN) kiemTra.push({ ten, sql, dungMoc });
for (const bb of BAT_BIEN_LUAT) kiemTra.push({ ...bb, dungMoc: bb.dungMoc ?? false });
```

Vòng chạy, trước:

```js
for (const { ten, sql, dungMoc } of kiemTra) {
  const { rows } = await client.query(sql, dungMoc ? [H] : []);
  const n = rows[0]?.n ?? 0;
```

Sau:

```js
for (const { ten, sql, dungMoc, dem } of kiemTra) {
  const { rows } = await client.query(sql, dungMoc ? [H] : []);
  // Bất biến thường trả đúng một dòng có cột `n`; bất biến cần luật trả nhiều dòng và tự đếm.
  const n = dem ? dem(rows) : (rows[0]?.n ?? 0);
```

- [ ] **Step 26: Typecheck và toàn bộ test đơn vị của api**

Run:

```bash
pnpm --filter @tourism/api typecheck
pnpm --filter @tourism/api exec vitest run prisma/fixtures
```

Expected: cả hai exit 0. Typecheck bắt được các chỗ còn đọc `freeCancellationDays`/`decisionNote` nếu Step 17–23 sót; `prisma/fixtures` chạy cả `chot-chan-seed.spec.ts`, `tour-costs.spec.ts`, `khung-thoi-gian.spec.ts` để chắc các sàn khác không bị hai thay đổi ngày làm lệch.

- [ ] **Step 27: Tập dượt trên Docker với H = 2026-09-20**

Docker Postgres phải đang chạy. Git Bash, gốc repo. TUYỆT ĐỐI không `export DATABASE_URL` trỏ Supabase trong shell này (CLAUDE.md luật 15 và bẫy `prisma.config.ts`): `prisma migrate reset` lấy `DATABASE_URL ?? localhost`, nên một biến môi trường sót lại là reset nhầm prod.

```bash
env | grep -i '^DATABASE_URL=' || echo 'không có DATABASE_URL trong môi trường — đúng'
pnpm --filter @tourism/contract build && pnpm --filter @tourism/i18n build
pnpm --filter @tourism/api exec prisma migrate reset --force --skip-seed
SEED_HOM_NAY=2026-09-20 pnpm --filter @tourism/api db:seed
SEED_HOM_NAY=2026-09-20 pnpm --filter @tourism/api seed:verify
```

Expected:

- `db:seed` in `[seed] mốc hôm nay H = 2026-09-20`, trong bảng cấu trúc có dòng `tourFaqs` với số bằng tổng FAQ của fixture, `tourPolicies +58` và `tourPoliciesHuyCu +0` (DB vừa reset nên chưa có dòng CANCELLATION nào để xoá; trên prod con số đó sẽ là 29).
- `seed:verify` kết thúc bằng `✓ 0 vi phạm`, và trong danh sách có đủ sáu bất biến mới: `yêu cầu huỷ còn REQUESTED hoặc DENIED`, `dòng hoàn lúc khách tự huỷ lại có admin_id`, `yêu cầu huỷ có người quyết không phải chính khách`, `booking trả tiền sau hạn chót của chuyến`, `lần huỷ của khách hoàn sai luật…`, `thiếu booking đã trả trên chuyến đã qua hạn chót…`.

- [ ] **Step 28: Chạy lại `db:seed` lần hai, cùng H — tất định và không thêm dòng**

```bash
SEED_HOM_NAY=2026-09-20 pnpm --filter @tourism/api db:seed
SEED_HOM_NAY=2026-09-20 pnpm --filter @tourism/api seed:verify
```

Expected: mọi bước dùng `createMany` báo `+0` (booking, payment event, refund, yêu cầu huỷ, chuyến, khách), `tourPoliciesHuyCu +0`; hai bước upsert `tourFaqs` và `tourPolicies` vẫn báo đủ số dòng fixture vì upsert luôn chạm mọi dòng. `seed:verify` lại `✓ 0 vi phạm`. Đây là lượt bắt bẫy trigger `refunds_sum_within_total` (BEFORE INSERT chạy trước `ON CONFLICT DO NOTHING`) — nếu nó nổ ở đây thì lỗi nằm ở bộ lọc `refundDaCo` của `seed.ts`, không phải ở fixture.

- [ ] **Step 29: Tập dượt trên Docker với H = 2026-11-03**

```bash
pnpm --filter @tourism/api exec prisma migrate reset --force --skip-seed
SEED_HOM_NAY=2026-11-03 pnpm --filter @tourism/api db:seed
SEED_HOM_NAY=2026-11-03 pnpm --filter @tourism/api seed:verify
```

Expected: như Step 27 với `[seed] mốc hôm nay H = 2026-11-03` và `✓ 0 vi phạm`. Phải `migrate reset` trước: chốt chặn đầu `main()` của `seed.ts` từ chối ghi khi DB đang mang lịch của một mốc H khác.

- [ ] **Step 30: Format và soát diff**

```bash
pnpm lint:fix
git status --short
git diff --stat
```

Expected: `git status --short` chỉ liệt kê các file của Task 12 (ba file miền, `types.ts`, `chinh-sach-huy.spec.ts` mới, `departures-2026.ts` + spec, `bookings.ts` + spec, `khung-ngay.spec.ts`, `seed.ts`, `verify-seed.mjs`), cộng các mục untracked đã có từ trước như `docs/screenshot/` — KHÔNG add chúng. Không file nào trong `apps/api/prisma/migrations/` đổi. Soát riêng diff của ba file miền: chỉ mất dòng `freeCancellationDays`, mất 29 object policy CANCELLATION, sửa sáu `answer` và ba dòng comment dải id — không dòng nội dung nào khác đổi.

- [ ] **Step 31: Cổng đầy đủ** (Docker Postgres đang chạy; Git Bash, gốc repo)

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu lệnh exit 0. Lưu ý: Step 27–29 đã reset DB Docker, nên int test chạy lại migration từ đầu là bình thường. Task này không đụng mã nguồn API/web/admin nên không package nào khác đổi hành vi; nếu `typecheck` của `apps/api` đỏ vì `tours.freeCancellationDays`, đó là code đọc field đã gỡ và thuộc Task 13 — KHÔNG vá tạm ở đây, dừng lại báo người tổng hợp.

- [ ] **Step 32: Commit**

```bash
git add \
  apps/api/prisma/fixtures/catalog/chinh-sach-huy.spec.ts \
  apps/api/prisma/fixtures/catalog/types.ts \
  apps/api/prisma/fixtures/catalog/tours-north.ts \
  apps/api/prisma/fixtures/catalog/tours-central.ts \
  apps/api/prisma/fixtures/catalog/tours-south.ts \
  apps/api/prisma/fixtures/catalog/departures-2026.ts \
  apps/api/prisma/fixtures/catalog/departures-2026.spec.ts \
  apps/api/prisma/fixtures/operations/bookings.ts \
  apps/api/prisma/fixtures/operations/bookings.spec.ts \
  apps/api/prisma/fixtures/khung-ngay.spec.ts \
  apps/api/prisma/seed.ts \
  apps/api/scripts/verify-seed.mjs
git status --short
```

Kiểm `git status --short`: không còn file nào của Task 12 chưa stage, không có `docs/screenshot/`.

```bash
git commit -F - <<'EOF'
feat(seed): dữ liệu seed theo luật một hạn chót mỗi chuyến

Catalog bỏ freeCancellationDays và 29 policy CANCELLATION, sửa sáu câu FAQ còn
hứa mốc huỷ riêng hoặc đổi ngày miễn phí. Lịch kéo chuyến còn bán đầu tiên của
sáu tour từ bốn ngày trở lên về khoảng [H + 2, H + 6] để luôn có chuyến đã qua
hạn chót mà chưa khởi hành. Tầng vận hành thay ca duyệt theo bậc bằng hai ca
khách tự huỷ: trong hạn hoàn phần còn lại với admin_id trống, quá hạn không có
dòng hoàn; bỏ ca DENIED và REQUESTED. paid_at và giỏ bỏ dở kẹp trước hạn chót,
thêm sàn ba booking đã trả trên chuyến đã qua hạn. seed.ts ghi decided_by là
khách, chuyển tourFaqs sang upsert và xoá policy CANCELLATION còn sót trong DB.
seed:verify gọi thẳng hàm luật của contract cho sáu bất biến mới.
EOF
```
---

### Task 13: Gỡ luật cũ và field thừa

**Files:**
- Modify: `libs/shared/contract/src/schemas/refund-policy.spec.ts` (xoá năm `describe` của luật cũ và khối import tương ứng)
- Modify: `libs/shared/contract/src/schemas/refund-policy.ts` (xoá docblock đầu file, `RefundPolicyTier`, `REFUND_POLICY_TIERS`, `refundPercentForDays`, `fullRefundThresholdDays`, `refundPercentForBooking`, `daysBeforeDeparture`, `percentOfAmount`, `policyRefundAmount`, `REFUND_GRACE_HOURS`, `RefundRequestContext`, `isWithinGracePeriod`, `refundPercentForRequest`)
- Modify: `libs/shared/contract/src/schemas/bookings.ts` (`BookingSchema.freeCancellationDays`, `RefundEstimateSchema`, `RefundEstimate`, `BookingDetailSchema.refundEstimate`, `CancellationRequestSchema.freeCancellationDays`)
- Modify: `libs/shared/contract/src/schemas/bookings.spec.ts` (5 dòng fixture)
- Modify: `libs/shared/contract/src/schemas/catalog.ts` (`TourDetailSchema.freeCancellationDays`)
- Modify: `libs/shared/contract/src/schemas/catalog.spec.ts` (fixture + hai test riêng của field)
- Modify: `apps/api/src/modules/bookings/bookings.service.ts` (`estimateRefund`, `BookingTourJoin`, hai `select`, hai chỗ map, import)
- Modify: `apps/api/src/modules/bookings/bookings.int.spec.ts` (xoá test `W1: byCode trả refundEstimate…`)
- Modify: `apps/api/src/modules/catalog/catalog.service.ts` (dòng map `freeCancellationDays`)
- Modify: `apps/api/prisma/schema.prisma` (comment cột `Tour.freeCancellationDays` và `CancellationRequest.freeCancellationDays`)
- Modify: `apps/web/src/test/fixtures/booking.ts` (hai dòng fixture)
- Modify: `apps/web/src/components/home/trust-strip.tsx` (khối comment mục 1)
- Modify: `apps/admin/src/lib/bookings-csv.spec.ts`, `apps/admin/src/lib/bookings-view.spec.ts` (một dòng fixture mỗi file)

**Interfaces:**
- Gỡ khỏi `@tourism/contract` (không consumer nào còn gọi sau Task 1–12): `REFUND_POLICY_TIERS`, `RefundPolicyTier`, `refundPercentForDays`, `fullRefundThresholdDays`, `refundPercentForBooking`, `daysBeforeDeparture`, `percentOfAmount`, `policyRefundAmount`, `REFUND_GRACE_HOURS`, `RefundRequestContext`, `isWithinGracePeriod`, `refundPercentForRequest`, `RefundEstimateSchema`, `RefundEstimate`.
- Gỡ field: `BookingSchema.freeCancellationDays`, `BookingDetailSchema.refundEstimate`, `TourDetailSchema.freeCancellationDays`, `CancellationRequestSchema.freeCancellationDays`.
- GIỮ trong `refund-policy.ts`: `toCents`, `fromCents`, `remainingRefundable` và trọn Hợp đồng A của Task 1.
- GIỮ nguyên: `apps/api/src/modules/bookings/booking-cancellation.ts` (module thuần của Task 6) và `CancellationRequestSchema.decidedByCustomer` (Task 8).
- Hai cột DB `tours.free_cancellation_days` và `cancellation_requests.free_cancellation_days` **còn sống** tới nhánh M2 (Phụ lục A); task này chỉ làm code ngừng đọc và ngừng ghi chúng.

- [ ] **Step 1: Xoá các `describe` của luật cũ trong `refund-policy.spec.ts`**

Khi GỠ thì test đi trước: xoá bài kiểm của luật cũ, chạy thấy phần còn lại xanh, rồi mới rút cài đặt — như vậy nếu một test của Task 1 vô tình dựa vào hàm cũ thì nó đỏ ở Step 3 chứ không lẫn vào đây.

Trong `libs/shared/contract/src/schemas/refund-policy.spec.ts`:

(a) Thay khối import ở đầu file (khối này đã được Task 1 viết lại một lần; bản sau Task 1 vẫn giữ đủ tên cũ). Xoá mọi tên của luật cũ, chỉ chừa `fromCents`, `toCents`, `remainingRefundable` và các tên Hợp đồng A mà Task 1 đã thêm vào cùng khối. Sau Step này khối import KHÔNG được còn bất kỳ tên nào trong danh sách: `daysBeforeDeparture`, `fullRefundThresholdDays`, `percentOfAmount`, `policyRefundAmount`, `REFUND_GRACE_HOURS`, `REFUND_POLICY_TIERS`, `refundPercentForBooking`, `refundPercentForDays`, `refundPercentForRequest`.

(b) Xoá NGUYÊN năm khối `describe` dưới đây (xoá từ dòng `describe(` tới dòng `});` đóng của chính nó, kèm dòng trắng ngăn cách):

- `describe('REFUND_POLICY_TIERS', …)`
- `describe('refundPercentForDays', …)`
- `describe('fullRefundThresholdDays', …)`
- `describe('refundPercentForBooking', …)`
- `describe('daysBeforeDeparture', …)`
- `describe('refundPercentForRequest — ân hạn 24 giờ', …)`

(c) Trong `describe('số học tiền dùng chung (vòng vá review 05/09)', …)` — khối này GIỮ LẠI — xoá ba test đã mất đối tượng:

- `it('percentOfAmount làm tròn cent HALF_UP — 50% của 1199.01 là 599.51 ở MỌI bên', …)`
- `it('policyRefundAmount: phần trăm trên TỔNG, trừ đã hoàn, kẹp trong phần dư', …)`
- `it('daysBeforeDeparture NÉM với ngày hỏng thay vì âm thầm ra 0%', …)`

Giữ `it('toCents/fromCents khứ hồi, HALF_UP ở chữ số thứ ba', …)` và mọi test mà Task 1 đã thêm.

(d) Sửa docblock mở đầu file, trước:

```ts
/**
 * Chính sách hoàn tiền (ADR-0030) — đây là NGUỒN của cả văn bản công khai lẫn
 * số tiền server trả, nên mỗi bậc và mỗi biên đều được khoá bằng test. Một
 * sửa đổi "chỉ đổi chữ" mà lỡ đổi số sẽ đỏ ở đây trước khi tới khách.
 */
```

sau:

```ts
/**
 * Luật hạn chót huỷ (ADR-0041) — NGUỒN của cả văn bản công khai lẫn số tiền
 * server trả, nên mỗi biên đều được khoá bằng test. Một sửa đổi "chỉ đổi chữ"
 * mà lỡ đổi số sẽ đỏ ở đây trước khi tới khách.
 *
 * Bảng bậc 100/50/25/0 và cửa sổ ân hạn 24 giờ của ADR-0030 đã gỡ cùng file
 * nguồn; lịch sử của chúng nằm ở ADR-0030 và các entry CHANGELOG trước 15/09.
 */
```

- [ ] **Step 2: Chạy spec contract, xác nhận phần còn lại xanh**

Run: `pnpm --filter @tourism/contract exec vitest run src/schemas/refund-policy.spec.ts`
Expected: PASS. Số test giảm đúng bằng số vừa xoá; không có test nào FAIL và không có lỗi "is not defined". Nếu một test của Task 1 đỏ vì thiếu tên vừa xoá khỏi import thì tên đó là tên hàm MỚI bị gõ nhầm — sửa import, không khôi phục hàm cũ.

- [ ] **Step 3: Rút các export cũ khỏi `refund-policy.ts`**

Trong `libs/shared/contract/src/schemas/refund-policy.ts`, xoá theo TÊN (không theo số dòng — Task 1 đã nối thêm phần Hợp đồng A vào cuối file):

(a) Xoá docblock mở đầu file (khối `/** Chính sách hoàn tiền khi huỷ — NGUỒN DUY NHẤT (ADR-0030). … */`) và thay bằng:

```ts
/**
 * Luật huỷ và hoàn tiền — NGUỒN DUY NHẤT (ADR-0041).
 *
 * Một hạn chót cho mỗi chuyến, tự tính từ độ dài chuyến, sinh ra CẢ BA thứ:
 *
 * 1. ngày chót in ở trang tour, checkout, email xác nhận và trang booking,
 * 2. gạch đầu dòng ở `/cancellation-policy` và đoạn tương ứng ở `/terms`,
 * 3. số tiền server thật sự hoàn khi khách bấm huỷ.
 *
 * ## Vì sao ở CONTRACT chứ không ở i18n
 *
 * Nó vừa là **copy** vừa là **luật tiền**. Đặt ở `@tourism/i18n` thì API phải
 * import một gói copy để tính tiền — sai tầng, và mở đường cho một sửa đổi
 * "chỉ đổi chữ" âm thầm đổi số tiền trả cho khách. Đặt ở contract thì cả hai
 * đầu đọc chung một bộ hàm, và i18n chỉ lo dịch nó thành câu.
 *
 * Bản trước 15/09 là bảng bậc 100/50/25/0 cộng ân hạn 24 giờ (ADR-0030), cộng
 * badge `freeCancellationDays` nâng ngưỡng theo từng tour (ADR-0023). Cả ba đã
 * gỡ: lý do và cái giá ghi ở ADR-0041 §Hệ quả, không nhắc lại ở đây.
 */
```

(b) Xoá nguyên các khối sau, mỗi khối gồm cả docblock đứng ngay trên nó:

| Xoá | Nhận dạng |
| --- | --- |
| `export interface RefundPolicyTier { … }` | docblock mở bằng "Một bậc hoàn tiền." |
| `export const REFUND_POLICY_TIERS` | docblock có bảng "≥ 30 ngày \| 100%" |
| `export function refundPercentForDays` | docblock "Phần trăm hoàn của một kỳ hạn" |
| `export function fullRefundThresholdDays` | docblock "Ngưỡng hoàn 100% của MỘT tour." |
| `export function refundPercentForBooking` | docblock "badge của tour NÂNG ngưỡng 100%" |
| `export function daysBeforeDeparture` | docblock "Số NGÀY LỊCH từ `requestedAt`" |
| `export function percentOfAmount` | docblock "`percent` phần trăm của một số tiền" |
| `export function policyRefundAmount` | docblock "Số tiền hoàn THEO CHÍNH SÁCH" |
| `export const REFUND_GRACE_HOURS` | docblock "Cửa sổ ÂN HẠN sau khi thanh toán" |
| `export interface RefundRequestContext` | docblock "Mọi thứ cần để quyết phần trăm hoàn" |
| `export function isWithinGracePeriod` | docblock "Yêu cầu có nằm trong cửa sổ ân hạn không." |
| `export function refundPercentForRequest` | docblock "ĐIỂM VÀO DUY NHẤT mà cả khách lẫn admin" |

(c) GIỮ khối comment `// ── Số học tiền trên chuỗi thập phân — MỘT bản cho cả web, admin và API ──` cùng `toCents`, `fromCents`, `remainingRefundable`, nhưng sửa câu dẫn của nó vì ví dụ trong đó nói về phép nhân phần trăm đã gỡ. Trước:

```ts
// Trước vòng vá review 05/09 web tính `total * percent / 100` bằng float rồi
// `toFixed(2)`, còn admin làm tròn cent HALF_UP: 50% của 1199.01 là 599.50 ở
// dialog khách và 599.51 ở màn admin — đúng cái lệch một cent mà "một điểm vào
// duy nhất" (§3b) sinh ra để chặn, chỉ là ở phép nhân chứ không ở phần trăm.
// Đặt cạnh bảng bậc để ba bên gọi cùng một hàm.
```

Sau:

```ts
// Tiền đi qua ranh giới dưới dạng CHUỖI thập phân, nên mọi phép cộng trừ phải
// làm trên cent nguyên. Bài học 05/09: web tính bằng float rồi `toFixed(2)`,
// admin làm tròn cent HALF_UP, hai bên lệch một cent trên cùng một booking.
// Từ ADR-0041 luật không còn phép nhân phần trăm, nhưng phép trừ "còn hoàn
// được" vẫn phải là MỘT bản cho web, admin và API — đó là ba hàm dưới đây.
```

(d) GIỮ nguyên toàn bộ phần Task 1 đã thêm ở cuối file (`VIETNAM_TIME_ZONE` → `refundOnCancel`), kể cả hai hàm nội bộ `calendarDayIndex` và `calendarDateFromIndex`.

- [ ] **Step 4: Chạy test và typecheck contract**

Run (Git Bash, gốc worktree):

```bash
pnpm --filter @tourism/contract exec vitest run
pnpm --filter @tourism/contract exec tsc --noEmit
```

Expected: cả hai exit 0. Typecheck bắt ngay nếu còn file nào TRONG contract tham chiếu tên vừa xoá (`refund-policy.spec.ts` là file duy nhất; `bookings.ts` và `catalog.ts` không import từ `refund-policy.ts`).

- [ ] **Step 5: Gỡ `freeCancellationDays` và `RefundEstimateSchema` khỏi `libs/shared/contract/src/schemas/bookings.ts`**

(a) Trong `BookingSchema`, xoá docblock và field (docblock mở bằng "Có mặt để khách BIẾT TRƯỚC mình được hoàn bao nhiêu"):

```ts
  freeCancellationDays: z.int().nonnegative().nullable(),
```

(b) Xoá nguyên `RefundEstimateSchema` cùng docblock của nó ("Ước tính hoàn tiền nếu khách xin huỷ NGAY BÂY GIỜ — SERVER tính…") và dòng:

```ts
export type RefundEstimate = z.output<typeof RefundEstimateSchema>;
```

(c) Trong `BookingDetailSchema`, xoá docblock ("Ước tính hoàn nếu huỷ ngay — CHỈ cho booking PAID…") và field:

```ts
  refundEstimate: RefundEstimateSchema.nullable(),
```

Field `cancellation: BookingCancellationSchema.nullable()` mà Task 6 thêm GIỮ NGUYÊN — nó là bản thay thế, và ghi chú Task 6 dặn không gỡ theo.

(d) Trong `CancellationRequestSchema`, xoá docblock ("Badge `freeCancellationDays` của tour CHỤP LÚC KHÁCH GỬI (ADR-0029 AMEND 6)…") và field:

```ts
  freeCancellationDays: z.int().nonnegative().nullable(),
```

Giữ `decidedByCustomer: z.boolean()` (Task 8) và `reason: … .nullable()` (Task 2).

- [ ] **Step 6: Sửa fixture trong `libs/shared/contract/src/schemas/bookings.spec.ts`**

Run (Git Bash, gốc worktree) — năm dòng đều là `      freeCancellationDays: null,` hoặc `  freeCancellationDays: null,` trong các object dựng booking, không dòng nào mang giá trị khác:

```bash
grep -c "freeCancellationDays" libs/shared/contract/src/schemas/bookings.spec.ts
node -e "
const fs = require('node:fs');
const p = 'libs/shared/contract/src/schemas/bookings.spec.ts';
fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/^ *freeCancellationDays: null,\n/gm, ''));
"
grep -c "freeCancellationDays" libs/shared/contract/src/schemas/bookings.spec.ts || true
```

Expected: lệnh đếm đầu in `5`, lệnh đếm cuối in `0` (hoặc grep exit 1 và không in gì).

- [ ] **Step 7: Gỡ `freeCancellationDays` khỏi `catalog.ts` và `catalog.spec.ts`**

(a) `libs/shared/contract/src/schemas/catalog.ts` — trong `TourDetailSchema`, xoá docblock (mở bằng "`policies[]` vẫn giữ toàn văn chính sách; trường này chỉ tách MỘT con số…") và field:

```ts
  freeCancellationDays: z.int().nonnegative().nullable(),
```

(b) `libs/shared/contract/src/schemas/catalog.spec.ts` — bốn sửa:

- Trong object `validDetail`, xoá dòng `  freeCancellationDays: 10,`.
- Trong object dựng tour tối thiểu (khối có `factGoodForNote: null,` liền trước), xoá dòng `      freeCancellationDays: null,`.
- Trong cùng test đó, xoá dòng khẳng định `    expect(parsed.freeCancellationDays).toBeNull();` (dòng `expect(parsed.factDurationNote).toBeNull();` ngay trên GIỮ NGUYÊN).
- Xoá nguyên test `it('cửa sổ huỷ âm bị từ chối', …)`.
- Trong `it('KHÔNG lên card danh sách — thêm vào chỉ làm nặng payload /tours', …)`, xoá dòng `    expect('freeCancellationDays' in TourCardSchema.shape).toBe(false);`, giữ dòng `factDurationNote`.

- [ ] **Step 8: Chạy test contract rồi build hai gói tiêu thụ qua `dist`**

Run (Git Bash, gốc worktree):

```bash
pnpm --filter @tourism/contract exec vitest run
pnpm --filter @tourism/contract build && pnpm --filter @tourism/i18n build
```

Expected: test PASS; hai build exit 0. `libs/shared/contract/dist/index.d.ts` KHÔNG còn `RefundEstimate`, `REFUND_POLICY_TIERS`, `REFUND_GRACE_HOURS`; kiểm nhanh bằng:

```bash
grep -c "RefundEstimate\|REFUND_POLICY_TIERS\|REFUND_GRACE_HOURS" libs/shared/contract/dist/index.d.ts || true
```

in `0` hoặc không in gì.

- [ ] **Step 9: Dọn `apps/api/src/modules/bookings/bookings.service.ts`**

(a) Xoá nguyên hàm `estimateRefund` cùng docblock của nó ("Ước tính hoàn tiền nếu khách xin huỷ NGAY BÂY GIỜ (W1, audit 05/09 cụm 3 mục Thấp)…").

(b) Trong `byCode`, xoá dòng gọi nó trong object trả về:

```ts
      refundEstimate: estimateRefund(booking, refunded._sum.amount),
```

Dòng `cancellation: …` mà Task 6 chèn ngay dưới GIỮ NGUYÊN. Biến `refunded` vẫn được dùng (`refundedTotal` của `toBooking`), không xoá.

(c) Trong `bookingTourInclude`, xoá comment hai dòng và field:

```ts
    // Khách cần biết trước mình được hoàn bao nhiêu (ADR-0030 §3b) — badge
    // nâng ngưỡng 100% nên thiếu nó thì ước tính nói thấp hơn thực tế.
    freeCancellationDays: true,
```

(d) Trong `export type BookingTourJoin`, xoá dòng:

```ts
  freeCancellationDays: number | null;
```

(e) Trong `toBooking`, xoá dòng map:

```ts
    freeCancellationDays: row.tour.freeCancellationDays,
```

(f) Trong `select` của đường `create` (khối có comment "Giá vốn theo ĐẦU KHÁCH, để đóng băng vào booking (ADR-0033 §3)" ngay dưới), xoá comment hai dòng và field:

```ts
            // Cùng lý do với `bookingTourInclude` — khách phải biết trước mình
            // được hoàn bao nhiêu (ADR-0030 §3b).
            freeCancellationDays: true,
```

(g) Ở chỗ dựng `tour` cho `toBooking` sau khi tạo booking, xoá dòng:

```ts
          freeCancellationDays: departure.tour.freeCancellationDays,
```

(h) Dọn import: xoá `RefundEstimate` khỏi khối `import type { … } from '@tourism/contract';` và xoá `daysBeforeDeparture`, `isWithinGracePeriod`, `policyRefundAmount`, `refundPercentForRequest` khỏi khối `import { … } from '@tourism/contract';` (chỉ những tên nào còn trong file sau Task 3/4/6 — Biome sẽ báo tên thừa ở Step 15 nếu sót). GIỮ `calendarDate` (còn dùng ở `toBooking`).

- [ ] **Step 10: Xoá test `refundEstimate` trong `apps/api/src/modules/bookings/bookings.int.spec.ts`**

Xoá nguyên test:

```ts
  it('W1: byCode trả refundEstimate tính phía SERVER — PAID có ước tính, PENDING null', async () => {
```

tới dấu `});` đóng của chính nó, kèm khối comment `// Task 6a (A2, user duyệt 06/08): byCode trả kèm `cancellationStatus` — …` đứng ngay trên nếu comment ấy chỉ giới thiệu test này (kiểm bằng mắt: comment nói về `cancellationStatus`, mà test kế tiếp là `cancellationStatus null trước khi xin hủy…`, nên comment ĐƯỢC GIỮ và chỉ cần dời xuống ngay trên test đó).

Hành vi còn giá trị của test vừa xoá — "server tính, web chỉ in" — đã do bộ test `bookings.byCode.cancellation` của Task 6 gánh, không mất bất biến nào.

Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/bookings.int.spec.ts`
Expected: PASS, số test giảm đúng 1, không FAIL.

- [ ] **Step 11: Dọn `apps/api/src/modules/catalog/catalog.service.ts`**

Trong mapper `TourDetail`, xoá dòng:

```ts
      freeCancellationDays: tour.freeCancellationDays,
```

Nếu `select`/`include` của đường tour detail còn liệt kê `freeCancellationDays: true` thì xoá cả dòng đó. Kiểm:

```bash
grep -n "freeCancellationDays" apps/api/src/modules/catalog/catalog.service.ts || true
```

Expected: không in gì.

- [ ] **Step 12: Sửa comment hai cột trong `apps/api/prisma/schema.prisma`**

Hai cột CÒN LẠI trong schema tới nhánh M2 (Phụ lục A), nhưng từ task này không mã nào đọc chúng nữa. Comment phải nói đúng điều đó — và KHÔNG được khai trạng thái deploy (bài học 08/09: trạng thái đổi theo thời gian, comment thì ở lại).

(a) Model `Tour` — thay nguyên khối comment `//` đứng trên `freeCancellationDays` (khối mở bằng "ngày nguyên: huỷ trước 30 giờ → 1 ngày → 100%…" và kết bằng "Sửa cột này thì phải sửa câu chữ theo, và ngược lại."):

```prisma
  // KHÔNG CÒN ĐỌC (ADR-0041): luật huỷ nay là một hạn chót mỗi CHUYẾN, tự tính
  // từ độ dài chuyến bằng `cancellationDeadline` của `@tourism/contract`; không
  // tour nào mang mốc riêng nữa. Cột giữ lại một nhịp để migration xoá cột đi
  // SAU khi code mới đã sống (nhánh M2) — thứ tự bắt buộc vì API cũ còn chạy
  // vài phút cạnh code mới lúc deploy. Không ghi gì vào cột này nữa.
  freeCancellationDays Int?            @map("free_cancellation_days")
```

(b) Model `CancellationRequest` — thay khối doc comment `///` ba dòng đứng trên `freeCancellationDays`:

```prisma
  /// KHÔNG CÒN ĐỌC (ADR-0041): ảnh chụp badge của tour lúc khách gửi yêu cầu,
  /// dùng cho luồng duyệt huỷ đã gỡ. Mức hoàn nay chỉ phụ thuộc hạn chót của
  /// chuyến, nên không có gì để chụp. Xoá cột ở nhánh M2.
  freeCancellationDays Int?              @map("free_cancellation_days")
```

Không chạy `prisma migrate` ở bước này: chỉ comment đổi, schema không đổi hình dạng. `apps/api/src/generated/` bị gitignore nên cũng không cần `prisma generate`.

- [ ] **Step 13: Dọn web và admin**

(a) `apps/web/src/test/fixtures/booking.ts` — xoá dòng `    freeCancellationDays: null,` và xoá comment hai dòng cộng dòng `    refundEstimate: null,`:

```ts
    // W1: ước tính hoàn do SERVER tính (byCode). Mặc định null — test cần
    // dialog huỷ có con số thì đè overrides.
    refundEstimate: null,
```

Dòng `cancellationDeadline` và `cancellation` mà Task 6 thêm GIỮ NGUYÊN.

(b) `apps/admin/src/lib/bookings-csv.spec.ts` và `apps/admin/src/lib/bookings-view.spec.ts` — mỗi file xoá đúng một dòng `  freeCancellationDays: null,` trong object fixture booking:

```bash
node -e "
const fs = require('node:fs');
for (const p of ['apps/admin/src/lib/bookings-csv.spec.ts', 'apps/admin/src/lib/bookings-view.spec.ts']) {
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/^ *freeCancellationDays: null,\n/gm, ''));
}
"
grep -rn "freeCancellationDays" apps/admin/src || true
```

Expected: grep không in gì (vùng Cancellations đã đi cùng Task 8).

(c) `apps/web/src/components/home/trust-strip.tsx` — thay mục 1 của khối comment. Trước:

```tsx
// 1. Huỷ miễn phí: KHÔNG ghi "48h". Đo trên 30 tour: 15 tour đặt mốc bằng NGÀY
//    (`freeCancellationDays`), 15 tour còn lại viết mốc bằng GIỜ trong policy,
//    và các mốc khác nhau. Một con số chung là nói sai, nên câu này trỏ người
//    đọc về trang tour — nơi con số lấy thẳng từ dữ liệu của chính tour đó.
```

Sau:

```tsx
// 1. Huỷ miễn phí: KHÔNG ghi một con số. Từ ADR-0041 mốc huỷ là hạn chót của
//    từng CHUYẾN, tính từ độ dài chuyến (1 ngày → 1, 2–3 ngày → 3, từ 4 ngày
//    → 7), nên một tour nhiều chuyến khác độ dài có nhiều mốc khác nhau. Câu
//    này trỏ người đọc về trang tour — nơi mỗi chuyến in ngày chót của mình.
```

Câu tiếng Anh khách đọc không đổi ở bước này; câu quảng bá do Task 11 chốt.

- [ ] **Step 14: Grep xác nhận không còn tham chiếu sống**

Run (Git Bash, gốc worktree). Ba đường loại trừ là cố ý: `prisma/migrations/` là bản ghi lịch sử bất biến, `docs/changelog/` và `docs/CHANGELOG.md` cũng vậy, `docs/adr/` và `docs/specs/` kể chuyện đã xảy ra:

```bash
grep -rn "REFUND_POLICY_TIERS\|REFUND_GRACE_HOURS\|refundPercentFor\|fullRefundThresholdDays\|isWithinGracePeriod\|policyRefundAmount\|percentOfAmount\|RefundPolicyTier\|RefundRequestContext\|RefundEstimate\|refundEstimate\|estimateRefund\|freeCancellationDays\|free_cancellation_days" \
  apps libs \
  --include=*.ts --include=*.tsx --include=*.mjs --include=*.prisma \
  | grep -v "/node_modules/" | grep -v "/dist/" | grep -v "/src/generated/" \
  | grep -v "apps/api/prisma/migrations/"
```

Expected: in ĐÚNG hai dòng, cả hai là comment vừa viết ở Step 12 trong `apps/api/prisma/schema.prisma` (dòng `freeCancellationDays Int?` của `Tour` và của `CancellationRequest`). Bất kỳ dòng nào khác là sót — quay lại đúng Step tương ứng, không thêm ngoại lệ vào lệnh grep.

Riêng `daysBeforeDeparture` grep riêng vì tên ấy còn là khoá i18n/biến cục bộ hợp lệ ở chỗ khác:

```bash
grep -rn "daysBeforeDeparture" apps libs --include=*.ts --include=*.tsx \
  | grep -v "/node_modules/" | grep -v "/dist/" | grep -v "/src/generated/"
```

Expected: không in gì.

- [ ] **Step 15: Format, soát diff**

Run (Git Bash, gốc worktree):

```bash
pnpm lint:fix
git status --short
git diff --stat
```

Expected: Biome exit 0 và tự gỡ mọi import thừa còn sót ở Step 9(h). `git status` KHÔNG có `docs/screenshot/`. `git diff --stat` chỉ liệt kê đúng 14 file ở mục **Files** (cộng `apps/api/prisma/schema.prisma`), không file `.md` nào.

- [ ] **Step 16: Cổng đầy đủ** (Docker Postgres đang chạy; Git Bash, gốc worktree)

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu lệnh exit 0. Typecheck là lưới chính của task này: mọi consumer còn đọc field đã gỡ sẽ đỏ ở đây chứ không lọt ra runtime.

- [ ] **Step 17: Commit**

```bash
git add libs/shared/contract/src/schemas/refund-policy.ts \
  libs/shared/contract/src/schemas/refund-policy.spec.ts \
  libs/shared/contract/src/schemas/bookings.ts \
  libs/shared/contract/src/schemas/bookings.spec.ts \
  libs/shared/contract/src/schemas/catalog.ts \
  libs/shared/contract/src/schemas/catalog.spec.ts \
  apps/api/src/modules/bookings/bookings.service.ts \
  apps/api/src/modules/bookings/bookings.int.spec.ts \
  apps/api/src/modules/catalog/catalog.service.ts \
  apps/api/prisma/schema.prisma \
  apps/web/src/test/fixtures/booking.ts \
  apps/web/src/components/home/trust-strip.tsx \
  apps/admin/src/lib/bookings-csv.spec.ts \
  apps/admin/src/lib/bookings-view.spec.ts
git commit -m "refactor(contract): gỡ bảng bậc, ân hạn 24 giờ và freeCancellationDays khỏi code"
```

Thân commit (tuỳ chọn, dán bằng heredoc nếu muốn ghi rõ):

```text
Bảng bậc 100/50/25/0, cửa sổ ân hạn 24 giờ, ước tính refundEstimate và badge
freeCancellationDays không còn ai đọc sau Task 1-12. Gỡ ở contract, API, web và
admin; hai cột DB giữ tới nhánh M2 vì API cũ còn chạy cạnh code mới lúc deploy.
```
---

### Task 14: Tài liệu hiện trạng

**Files:**
- Modify: `docs/conventions/booking-states.md`
- Modify: `docs/adr/0029-cancellation-approve-partial-refund.md` (dòng **Trạng thái**)
- Modify: `docs/adr/0030-refund-policy-tiers.md` (dòng **Trạng thái**)
- Modify: `docs/adr/0009-refund-correctness.md` (thêm `## AMEND 3`)
- Modify: `docs/adr/0023-tour-merchandising-fields.md` (thêm `## AMEND 1`)
- Modify: `docs/adr/0033-financial-model.md` (thêm `## AMEND 2`)
- Modify: `docs/specs/2026-09-14-seed-khung-2026-design.md` (§2, §4.4, §6 mục 5, §8.5, §9)
- Modify: `docs/plans/2026-09-08-prompts-cac-phase-con-lai.md` (§1a)
- Modify: `docs/README.md` (dòng ADR-0041, dòng spec 15/09, dòng plan mới, dòng spec seed 14/09)

**Interfaces:**
- Consumes (tên đã cố định ở các task trước, phải viết ĐÚNG như vậy):
  `cancelInLock`, `cancelByCustomer`, `booking-cancellation.ts`,
  `cancellationDeadline`, `isWithinDeadline`, `canCancelOnline`, `refundOnCancel`,
  `vietnamToday`, `vietnamDateSql`, `assertDepartureBookable`,
  `CancellationRequestSchema.decidedByCustomer`,
  `cancellationsWithinDeadline` / `cancellationsAfterDeadline`,
  `cancellationOutcomesSlice`, `BOOKING_CANCELLED`.
- Produces: không có ký hiệu mã nguồn nào; chỉ tài liệu.

- [ ] **Step 1: `booking-states.md` — sửa nguyên tắc và dòng terminal đầu tiên**

Trong `docs/conventions/booking-states.md`, thay đoạn cuối mục "Nguyên tắc: hai câu chuyện, hai nơi ghi". Trước:

```markdown
Cancellation ≠ refund-only: một booking bị hủy (hết đi tour, ghế trả lại) khác
với một booking được trả tiền nhưng vẫn đi tour. Vì vậy approve-cancellation
đặt `CANCELLED` **tường minh**, không đi qua `deriveStatusAfterRefund`.
```

Sau:

```markdown
Cancellation ≠ refund-only: một booking bị hủy (hết đi tour, ghế trả lại) khác
với một booking được trả tiền nhưng vẫn đi tour. Vì vậy lõi huỷ (`cancelInLock`
trong `cancellations.service.ts`) đặt `CANCELLED` **tường minh**, không đi qua
`deriveStatusAfterRefund`.
```

- [ ] **Step 2: `booking-states.md` — thay dòng "Approved cancellation" của bảng terminal**

Thay nguyên dòng đầu tiên của bảng "Năm ngữ nghĩa terminal". Trước (dòng bắt đầu bằng `| **Approved cancellation** (W4: khách xin hủy booking PAID, admin duyệt) |`) — xoá cả dòng. Sau, một dòng duy nhất thay chỗ:

```markdown
| **Khách tự huỷ** (ADR-0041: khách bấm Cancel trên booking `PAID` hoặc `PARTIALLY_REFUNDED`, ngày hôm nay theo giờ Việt Nam còn trước ngày khởi hành) | `CANCELLED` + `cancelledAt` | 0..1 row — **1 row bằng trọn phần còn lại** khi huỷ TRONG hạn chót của chuyến; **0 row** ở hai ca: huỷ SAU hạn chót (hoàn `0.00`, không gọi cổng thanh toán), hoặc sổ đã settle từ trước. Sổ append-only chỉ kể tiền thật sự đi | **Trả lại** (`seats_booked -= party`) — BẤT KỂ hoàn bao nhiêu | Khách chủ động thôi đi tour — chuyến đi kết thúc. Tiền đã trả nằm trọn trong ledger; status kể chuyện ghế/chuyến đi, không kể chuyện tiền. `CancellationRequest` sinh ra ở trạng thái `REFUNDED` NGAY (không qua `REQUESTED`), `decided_by` = chính chủ booking — contract phơi ra thành `decidedByCustomer: true` để admin đọc được "ai huỷ" mà không cần join |
```

Bốn dòng còn lại của bảng (overbooked claim, orphaned capture, admin goodwill refund full, PENDING hết hạn) GIỮ NGUYÊN từng chữ.

- [ ] **Step 3: `booking-states.md` — viết lại khối "Ca thêm từ ADR-0029 §3"**

Thay nguyên khối từ `**Ca thêm từ ADR-0029 §3 — …**` tới hết đoạn ⚠️. Trước:

```markdown
**Ca thêm từ ADR-0029 §3 — `CANCELLED` mà ledger CÒN DƯ.** Approve với mức hoàn
một phần (bậc chính sách 50% hoặc 25%) để lại đúng trạng thái ấy: chuyến đã
huỷ, ghế đã trả, nhưng sổ chưa cộng đủ `total_amount`. Phần dư đó **vẫn hoàn
tiếp được** qua `admin.bookings.refund` — trước ADR-0029 nó là ngõ cụt 422.
```

Sau:

```markdown
**Ca `CANCELLED` mà ledger CÒN DƯ.** Từ ADR-0041 nó đến từ MỘT nguồn duy nhất
thay vì bậc chính sách: khách huỷ SAU hạn chót. Chuyến đã huỷ, ghế đã trả,
nhưng sổ không cộng thêm đồng nào — `total_amount` nằm nguyên bên công ty. Phần
dư đó **vẫn hoàn tiếp được** qua `admin.bookings.refund` (gate mở cho
`CANCELLED` từ ADR-0029 §3, trước đó là ngõ cụt 422), và từ ADR-0041 §5 đây là
**đường ngoại lệ chính thức**: mọi ca "luật nói không hoàn nhưng ta vẫn muốn
hoàn" đi qua hoàn thiện chí, có số tiền và lý do ghi vào sổ, không có bậc nào
để tranh cãi.
```

Đoạn ⚠️ ngay dưới (về `deriveStatusAfterRefund`) GIỮ NGUYÊN.

- [ ] **Step 4: `booking-states.md` — sửa "Hệ quả cho code" và thêm một bất biến mới**

Thay hai gạch đầu dòng đầu của mục "Hệ quả cho code". Trước:

```markdown
- `deriveStatusAfterRefund` chỉ dành cho các flow **refund-only** (admin refund,
  orphaned capture). Approve-cancellation và overbook set `CANCELLED` cứng.
- Chỉ W4 approve được release ghế, và chỉ bằng single-statement
```

Sau:

```markdown
- `deriveStatusAfterRefund` chỉ dành cho các flow **refund-only** (admin refund,
  orphaned capture). Lõi huỷ và overbook set `CANCELLED` cứng.
- Chỉ lõi huỷ được release ghế, và chỉ bằng single-statement
```

Rồi THÊM vào cuối mục "Hệ quả cho code" ba gạch đầu dòng:

```markdown
- **Không còn trạng thái chờ.** App không sinh `CancellationRequest` nào ở
  `REQUESTED` hay `DENIED` nữa; mỗi lần huỷ là đúng một dòng `REFUNDED`. Dòng cũ
  hai loại kia còn trên prod tới lượt seed lại (spec 15/09 §10 bước 6) và vẫn
  hiện dạng chỉ đọc trong lịch sử booking.
- **Ngày so bằng giờ Việt Nam.** "Chuyến đã đi chưa" và "còn trong hạn chót
  không" đều đo bằng `vietnamToday(now)` ở Node, `vietnamDateSql` ở SQL
  (ADR-0009 AMEND 3). Không dùng UTC, không dùng đồng hồ trình duyệt.
- **Một lõi cho hai người gọi.** `cancelInLock` hôm nay chỉ có đầu vào
  `initiator: 'customer'`; nút "Cancel departure" của P4e-1 sẽ thêm
  `'operator'` vào chính lõi ấy chứ không viết đường thứ hai — đó là lý do lõi
  nhận `decidedById` và `refundAmount` làm tham số thay vì tự đi tìm.
```

Run: `git diff --stat docs/conventions/booking-states.md`
Expected: đúng một file, không có dòng nào bị đổi ngoài bốn chỗ trên (đọc `git diff` đầy đủ một lượt: bảng markdown dài, một dấu `|` lệch là hỏng cả bảng).

- [ ] **Step 5: Dòng trạng thái ADR-0029 và ADR-0030**

`docs/adr/0029-cancellation-approve-partial-refund.md`, trước:

```markdown
- **Trạng thái:** Accepted (2026-09-04)
```

Sau:

```markdown
- **Trạng thái:** Accepted (2026-09-04) · **thay một phần bởi
  [ADR-0041](0041-single-cancellation-deadline.md) (15/09)** — luồng
  request → approve/deny, stepper duyệt và chốt chặn `CANCELLATION_OPEN` đã gỡ;
  khách tự huỷ và hệ thống xử lý ngay. GIỮ NGUYÊN và được lõi huỷ mới dùng lại:
  gọi cổng thanh toán TRONG advisory lock rồi một CTE ghi sau, hoàn 0 vẫn huỷ và
  vẫn trả ghế, gate `admin.bookings.refund` mở cho booking `CANCELLED` còn dư
  (§3), và cấm `deriveStatusAfterRefund` ghi đè `CANCELLED`.
```

`docs/adr/0030-refund-policy-tiers.md`, trước:

```markdown
- **Trạng thái:** Accepted (2026-09-04)
```

Sau:

```markdown
- **Trạng thái:** Accepted (2026-09-04) · **thay một phần bởi
  [ADR-0041](0041-single-cancellation-deadline.md) (15/09)** — bảng bậc
  100/50/25/0 (§2), ân hạn 24 giờ (§3c), badge `freeCancellationDays` nâng
  ngưỡng (§3) và đường vượt bậc `OFF_POLICY_NOTE_REQUIRED` (§5, §5b) đã gỡ khỏi
  code. GIỮ: luật "MỘT nguồn sinh cả văn bản lẫn phép tính" (§6) — nay là bộ hàm
  hạn chót ở cùng file `refund-policy.ts`; và hoàn tiền thiện chí bắt buộc
  `amount` + `reason` (AMEND 1, AMEND 2), nay là đường ngoại lệ duy nhất.
```

- [ ] **Step 6: AMEND 3 ở ADR-0009**

Chèn vào `docs/adr/0009-refund-correctness.md` NGAY TRƯỚC dòng `## Đã cân nhắc và loại` (file này xếp AMEND trước mục đó, khác ADR-0030):

```markdown
## AMEND 3 15/09 ([ADR-0041](0041-single-cancellation-deadline.md)) — thước ngày đổi từ UTC sang giờ Việt Nam

AMEND 2 chốt "MỘT thước ngày UTC" cho mọi gate *chuyến đã đi chưa*, và ghi nhận
lề bảy giờ: `start_date` là ngày lịch của điểm khởi hành (Việt Nam, UTC+7), nên
trong khung 00:00–06:59 giờ Việt Nam thì UTC vẫn đang ở hôm trước. Lề ấy chấp
nhận được khi nó chỉ NỚI RỘNG cửa walk-in cùng ngày.

ADR-0041 dùng cùng một phép so ngày để quyết hai thứ không nới được: **còn nhận
đặt chỗ không** và **hoàn bao nhiêu tiền**. Bảy giờ lệch thành một ngày hoàn
tiền sai, và sai theo hướng khách được hoàn khi luật đã công bố là không —
đúng loại lỗi mà bản thân ADR-0041 §Cái giá gọi tên là "sửa lỗi", không phải
siết quyền.

Đổi:

- **Một thước duy nhất: ngày lịch Việt Nam.** Node gọi `vietnamToday(now)` của
  `@tourism/contract`; SQL gọi `vietnamDateSql(…)`, tức
  `(… AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`. `todayUtc` và `startOfTodayUtc`
  đã gỡ khỏi `bookings.service.ts`.
- **Áp cho:** `bookings.create`, `reCheckout`, phân loại claim, gate xoá tài
  khoản, chốt chặn đặt chỗ `assertDepartureBookable`, và mọi phép so hạn chót
  huỷ.
- **Giữ UTC CÓ CHỦ ĐÍCH ở hai chỗ**, vì chúng không nói về ngày của chuyến đi:
  chuỗi theo ngày của dashboard (ADR-0036) và `review-eligibility.ts`.

KHÔNG đổi: advisory lock một khoá cho mọi đường hoàn của một booking, trigger
`SUM(refunds) ≤ total_amount`, sổ `refunds` append-only, và gate claim theo
trạng thái chuyến của AMEND 1.
```

- [ ] **Step 7: AMEND 1 ở ADR-0023**

Chèn vào CUỐI `docs/adr/0023-tour-merchandising-fields.md` (sau mục `## Hệ quả`; file này chưa có AMEND nào):

```markdown
## AMEND 1 15/09 ([ADR-0041](0041-single-cancellation-deadline.md)) — cột `free_cancellation_days` bỏ

ADR này thêm năm cột; cột thứ năm, `freeCancellationDays`, sinh ra để tách MỘT
con số khỏi văn xuôi `TourPolicy` cho thẻ giữa trong cụm ba thẻ chính sách ở tab
Departures. Hai tiền đề của nó đều không còn:

- **Con số không còn thuộc về TOUR.** ADR-0041 tính hạn chót từ ĐỘ DÀI CHUYẾN
  (1 ngày → 1, 2–3 ngày → 3, từ 4 ngày → 7), nên một tour bán cả chuyến 2 ngày
  lẫn chuyến 5 ngày có hai mốc khác nhau. Một ô nhập cấp tour không diễn đạt
  nổi điều đó, và một con số cấp tour đứng cạnh hai mốc chuyến khác nhau là nói
  sai với khách.
- **Lý do "không suy ra từ `policy.body`" mất đối tượng.** Từ ADR-0041 không còn
  `TourPolicy` loại `CANCELLATION` nào để mà suy: chính sách huỷ sinh từ luật
  chung ở `@tourism/contract`, giống nhau cho mọi tour.

Vì vậy: `TourDetailSchema.freeCancellationDays`, `BookingSchema.freeCancellationDays`
và `CancellationRequestSchema.freeCancellationDays` gỡ khỏi contract; hai cột DB
`tours.free_cancellation_days` và `cancellation_requests.free_cancellation_days`
xoá bằng migration chạy SAU khi code mới đã sống trên prod (thứ tự bắt buộc: API
cũ còn phục vụ vài phút cạnh code mới lúc deploy).

Thẻ giữa của cụm ba thẻ chính sách KHÔNG mất: nó in ngày chót của đúng chuyến
khách đang xem. Bốn cột còn lại của ADR này (`factDurationNote`,
`factGroupSizeNote`, `factDifficultyNote`, `factGoodForNote`) và kết luận
"`TourCardSchema` KHÔNG nở" đều giữ nguyên.
```

- [ ] **Step 8: AMEND 2 ở ADR-0033 — phần định nghĩa**

Chèn vào `docs/adr/0033-financial-model.md` NGAY TRƯỚC dòng `## Hình dạng câu trả lời` (ngay sau khối `## AMEND 1 05/09 …`, giữ đúng chỗ mà file này đặt AMEND):

```markdown
## AMEND 2 15/09 ([ADR-0041](0041-single-cancellation-deadline.md)) — ba tập khác nhau, gọi tên từng tập

§1 dựng cách đọc P&L trên "tập booking được ghi nhận trong kỳ"; §4 tách giá vốn
cố định khỏi giá vốn biến đổi; §6 đặt phí cổng trên "đúng tập booking được ghi
nhận". Luật một hạn chót sinh ra một loại dòng mà cả ba câu ấy chưa phân xử:
**booking đã trả tiền, khách huỷ SAU hạn chót** — công ty giữ trọn số tiền, ghế
đã nhả, và khách KHÔNG đi.

Chốt bốn định nghĩa. Chúng KHÔNG đứng trên cùng một tập, và đó là chủ ý:

1. **Doanh thu ghi nhận = tập ĐÃ TRẢ TIỀN.** `SUM(total_amount − đã hoàn)` của
   mọi booking có `paid_at IS NOT NULL` trên chuyến không `CANCELLED`, quy về kỳ
   theo `departure_end_date`. Booking huỷ quá hạn ở lại với đủ số tiền, vì đó là
   tiền công ty thật sự giữ (ADR-0041 §9). Booking hoàn một phần chỉ góp phần
   còn lại.
2. **Giá vốn biến đổi và `costDataMissing` = tập KHÁCH THỰC ĐI:**
   `paid_at IS NOT NULL` **và** `status <> 'CANCELLED'`. Khách không lên xe thì
   không ai gọi suất ăn của họ — đúng câu §4, nay nói rõ tập.
3. **Giá vốn cố định:** điều kiện EXISTS "chuyến ĐÃ CHẠY" đọc trên tập khách
   thực đi. Một chuyến mà mọi booking đều huỷ thì không chạy, dù tiền giữ lại đã
   vào doanh thu.
4. **Phí cổng thanh toán = tập ĐÃ TRẢ TIỀN**, cả tiền gốc `gross_collected` lẫn
   số giao dịch trong `paymentFees(grossCollected, bookings, rate, fixed)`. Cổng
   thu phí lúc THANH TOÁN và không trả lại khi hoàn hay khi huỷ (§Giới hạn #3),
   nên phí của một booking huỷ quá hạn là chi phí đã trả thật.

Hệ quả phải biết trước khi đọc số: mục 4 là mục DUY NHẤT ngoài mục 1 đứng trên
tập doanh thu, nên phí cổng và giá vốn biến đổi đếm hai nhóm giao dịch khác
nhau. Đã cân nhắc đặt phí cổng lên tập khách thực đi cho "cùng một nhóm" và
loại: làm vậy là khai THIẾU một khoản chi phí công ty đã trả, chỉ để hai công
thức trông giống nhau. Ở cấu hình mặc định `PAYMENT_FEE_RATE = 0` và
`PAYMENT_FEE_FIXED = 0` nên khác biệt này bằng 0 trên mọi báo cáo hiện tại —
càng phải ghi ra, vì không test nào bắt được nó.
```

- [ ] **Step 9: AMEND 2 ở ADR-0033 — phần cột báo cáo và giới hạn giữ nguyên**

Viết tiếp NGAY DƯỚI khối vừa chèn, vẫn trong `## AMEND 2`:

```markdown
**Hai cột của báo cáo tháng đổi tên theo nghĩa.** `cancellationsApproved` và
`cancellationsDenied` không còn nghĩa khi không ai duyệt gì nữa. Thay bằng
`cancellationsWithinDeadline` và `cancellationsAfterDeadline`, đếm các yêu cầu
`REFUNDED` có `decided_at` trong kỳ và xếp loại bằng
`isWithinDeadline(request.createdAt, departureStartDate, departureEndDate)`
(hàm `cancellationOutcomesSlice`). Yêu cầu `REFUNDED` do luồng duyệt CŨ để lại
cũng được xếp loại theo đúng định nghĩa ấy; sau lượt seed lại (spec 15/09 §10
bước 6) không còn dòng loại đó trên prod.

**Không chữa ở đây:** giới hạn "báo cáo đọc lại ra số khác" ở mục
§Giới hạn đã biết còn nguyên — một khoản hoàn thiện chí phát hành muộn vẫn làm
doanh thu của một tháng đã đóng tụt xuống. Chữa thật vẫn cần cột snapshot theo
kỳ, vẫn là một ADR riêng.
```

Run: `git diff docs/adr/`
Expected: đúng năm file đổi (`0009`, `0023`, `0029`, `0030`, `0033`); không file ADR nào khác; không dòng nào trong phần Quyết định của ADR cũ bị sửa (AMEND là THÊM, không viết lại thân ADR).

- [ ] **Step 10: Seed spec §2 — câu "Không cần ADR… không có migration"**

Trong `docs/specs/2026-09-14-seed-khung-2026-design.md`, THÊM ngay sau đoạn kết của §2 (đoạn "Không cần ADR: thay đổi nằm trong công cụ seed…") một khối trích dẫn, giữ nguyên câu cũ vì nó đúng với đợt 14/09:

```markdown
> **Cập nhật 15/09 —** câu trên đúng cho đợt seed 14/09 và chỉ cho đợt ấy. Một
> ngày sau, [ADR-0041](../adr/0041-single-cancellation-deadline.md) đổi luật
> huỷ: có ADR, có hai migration (M1 mở rộng, M2 xoá hai cột), và contract đổi
> hình dạng. Bộ sinh seed phải viết lại phần huỷ/hoàn theo
> [spec 15/09 §7](2026-09-15-refund-deadline-design.md#7-seed); §4.4 và §6 mục 5
> dưới đây đã cập nhật theo. Mọi quyết định Q1–Q10 giữ nguyên.
```

- [ ] **Step 11: Seed spec §4.4 — thay ba dòng bảng bằng hai dòng mới**

Trong bảng §4.4 "Hình dạng huỷ và hoàn tiền", XOÁ nguyên ba dòng:

- dòng mở bằng `| Khách xin huỷ, admin duyệt (~12) |`
- dòng mở bằng `| Yêu cầu bị từ chối (~5) |`
- dòng mở bằng `| Yêu cầu đang chờ (~9) |`

Chèn hai dòng thay chỗ, ngay sau dòng "Giỏ bỏ dở":

```markdown
| Khách tự huỷ TRONG hạn (~14) | Yêu cầu huỷ `REFUNDED` ngay từ lúc sinh: `created_at` sau `paid_at`, ≤ hạn chót của chuyến và ≤ H; `decided_at` = `created_at`; `decided_by` = chính chủ booking; `reason` có hoặc `null`. Booking `CANCELLED`, `cancelled_at` = `decided_at`. Đúng **một** refund bằng `remainingRefundable(total_amount, đã hoàn)` với `admin_id` **NULL** và một payment event hoàn cùng mốc | lõi `cancelInLock`, `initiator: 'customer'` |
| Khách tự huỷ QUÁ hạn (~6) | Như trên nhưng `created_at` nằm SAU hạn chót của chuyến và trước ngày khởi hành. **Không** dòng refund, **không** payment event hoàn — quá hạn hoàn `0.00` và lõi không gọi cổng thanh toán | lõi `cancelInLock`, nhánh `amount = 0` |
```

Dòng `| Công ty huỷ chuyến |` GIỮ NGUYÊN (spec 15/09 §7: trước P4e-1 đó là hình dạng duy nhất app làm được).

Sau bảng, thay câu chốt. Trước:

```markdown
Mọi booking huỷ hoặc hoàn không giữ ghế, nên không vào `seats_booked`.
```

Sau:

```markdown
Mọi booking huỷ hoặc hoàn không giữ ghế, nên không vào `seats_booked`. Không
sinh yêu cầu `REQUESTED` hay `DENIED` nào nữa: từ
[ADR-0041](../adr/0041-single-cancellation-deadline.md) app không tạo được hai
loại ấy, và seed chỉ được sinh hình dạng app tạo ra được. `paid_at` cùng mốc bỏ
dở giỏ cũng phải nằm TRƯỚC hạn chót của chuyến — sau hạn chót thì `create` và
`checkout` đều bị chặn.
```

- [ ] **Step 12: Seed spec §6 mục 5 — bất biến huỷ và hoàn**

Thay nguyên mục 5 của danh sách "Bất biến ở tầng unit". Trước:

```markdown
5. **Huỷ và hoàn (§4.4):** giỏ bỏ dở đúng hình dạng; mỗi booking CANCELLED đã trả
   có đúng một yêu cầu huỷ REFUNDED và số hoàn = `policyRefundAmount(…)`; bậc 0%
   thì không có refund; đủ bốn bậc; DENIED và REQUESTED giữ booking PAID;
   REFUNDED không có yêu cầu huỷ, không có `cancelled_at`, refund bằng tổng
   tiền; mỗi refund có đúng một payment event hoàn cùng số tiền và cùng mốc; tổng
   hoàn ≤ tổng tiền.
```

Sau:

```markdown
5. **Huỷ và hoàn (§4.4):** giỏ bỏ dở đúng hình dạng; mỗi booking `CANCELLED` đã
   trả có đúng một yêu cầu huỷ `REFUNDED` do CHÍNH chủ booking quyết
   (`decided_by` = `user_id`); huỷ TRONG hạn có đúng một dòng hoàn bằng
   `remainingRefundable(…)` với `admin_id` NULL, huỷ QUÁ hạn không có dòng hoàn
   nào; **không** dòng `REQUESTED` hay `DENIED` nào; có ít nhất hai booking mỗi
   loại (trong hạn, quá hạn); `REFUNDED` không có yêu cầu huỷ, không có
   `cancelled_at`, refund bằng tổng tiền; mỗi refund có đúng một payment event
   hoàn cùng số tiền và cùng mốc; tổng hoàn ≤ tổng tiền; **không booking nào có
   `paid_at` sau hạn chót của chuyến**.
```

- [ ] **Step 13: Seed spec §8.5 và §9**

(a) §8.5 — thêm một gạch đầu dòng vào đầu danh sách, trước gạch "Không sửa code":

```markdown
- Chạy bằng **code seed sau ADR-0041** (bộ sinh viết lại ở plan 15/09 Task 12).
  Lượt 1 ngày 15/09 chạy bằng bộ sinh cũ, nên prod còn dòng `REQUESTED`/`DENIED`
  và còn `free_cancellation_days` đã chụp; lượt reset ở spec 15/09 §10 bước 6
  dọn sạch chúng. Lượt này không phải làm lại việc đó.
```

(b) §9 — thay gạch đầu dòng "Lịch sử là hư cấu". Trước:

```markdown
- **Lịch sử là hư cấu theo luật hiện tại của app** (ân hạn 24 giờ, luồng W4,
  double opt-in, `enquiry_status_events`) — không mô phỏng dữ liệu kiểu cũ trước
  khi các tính năng ấy ra đời.
```

Sau:

```markdown
- **Lịch sử là hư cấu theo luật hiện tại của app** (một hạn chót mỗi chuyến,
  double opt-in, `enquiry_status_events`) — không mô phỏng dữ liệu kiểu cũ trước
  khi các tính năng ấy ra đời. Bản 14/09 của gạch này ghi "ân hạn 24 giờ, luồng
  W4"; cả hai đã gỡ ở [ADR-0041](../adr/0041-single-cancellation-deadline.md),
  nên booking seed nào sinh trước ngày ấy vẫn mang hình dạng cũ cho tới lượt
  reset kế tiếp.
```

Run: `git diff docs/specs/2026-09-14-seed-khung-2026-design.md`
Expected: đúng năm cụm thay đổi (§2, §4.4, §6 mục 5, §8.5, §9); bảng §4.4 vẫn đủ số cột `| Ca | Hình dạng seed | Mô phỏng luồng |` trên mọi dòng.

- [ ] **Step 14: Prompt P4e-1 ở `docs/plans/2026-09-08-prompts-cac-phase-con-lai.md` §1a**

Trong khối ```` ```text ```` của §1a "Tours + departures", thêm hai câu vào phần "Phạm vi cần chốt với tôi", ngay sau cụm `departures (tạo/sửa/dời lịch/đóng bán, ràng buộc ghế đã bán),`:

```text
nút "Cancel departure" — công ty huỷ chuyến, hoàn 100% cho mọi booking đã trả
BẤT KỂ hạn chót (ADR-0041 §6): KHÔNG viết đường hoàn thứ hai, mà mở lõi
`cancelInLock` của `apps/api/src/modules/bookings/cancellations.service.ts`
(hiện `private`, chỉ nhận `initiator: 'customer'`) thành dùng chung và thêm
`initiator: 'operator'`; đây là món nợ ADR-0041 để lại đúng cho phase này,
kèm theo là chuyến CANCELLED phải ngừng hiện ở web,
```

Và thêm vào cùng khối, ngay trước câu `Mọi route admin mới tự có trần (ADR-0037)…`:

```text
Nợ schema phải trả cùng đợt: DB chưa có CHECK `end_date >= start_date` trên
`tour_departures`. Các hàm luật hạn chót (`tripLengthDays` và mọi hàm gọi nó)
NÉM RangeError với dòng hỏng, nên một chuyến nhập ngược ngày làm trang tour,
trang booking và báo cáo tháng trả 500 chứ không chỉ hiện xấu. Form sửa chuyến
phải chặn ở client, service phải chặn ở server, và migration phải thêm CHECK —
cả ba, vì hai lớp đầu không bảo vệ được dữ liệu sửa tay.
```

- [ ] **Step 15: `docs/README.md` — bốn dòng**

(a) Mục "ADR — quyết định kiến trúc", dòng `| [0041](adr/0041-single-cancellation-deadline.md) | …` — đổi cụm mở đầu. Trước:

```markdown
| [0041](adr/0041-single-cancellation-deadline.md) | **Một hạn chót mỗi chuyến (15/09, CHƯA thi hành).**
```

Sau:

```markdown
| [0041](adr/0041-single-cancellation-deadline.md) | **Một hạn chót mỗi chuyến (15/09).**
```

Và ở CUỐI cùng ô đó, ngay trước ` · [spec](specs/2026-09-15-refund-deadline-design.md)`, chèn (câu này nối vào sau cụm "sửa định nghĩa doanh thu của 0033" có sẵn):

```markdown
. Thi hành trên nhánh `feat/refund-deadline` theo [plan 15 task](plans/2026-09-15-refund-deadline.md); ADR-0023 cũng có AMEND (bỏ `free_cancellation_days`)
```

(b) Mục "Specs — theo phase", dòng `| **Hoàn tiền một hạn chót** | …` — thay ô trạng thái. Trước:

```markdown
| 📝 **spec + ADR duyệt 15/09** · [plan 15 task](plans/2026-09-15-refund-deadline.md) viết xong 16/09 — chờ user duyệt plan, CHƯA thi công |
```

Sau:

```markdown
| ✅ **spec + ADR duyệt 15/09** · [plan 15 task](plans/2026-09-15-refund-deadline.md) — thi công trên nhánh `feat/refund-deadline`, **CHƯA merge**; bước triển khai (M1 lên Supabase, tắt/bật tự deploy Vercel, seed lại prod, nhánh M2) ở Phụ lục B của plan, session gốc làm sau review |
```

(c) Mục "Plans", dòng `| [Hoàn tiền một hạn chót](plans/2026-09-15-refund-deadline.md) | …` đã có sẵn (thêm lúc commit plan 16/09) — chỉ thay ô trạng thái cuối dòng. Trước:

```markdown
| 📝 **viết xong 16/09** — chờ user duyệt, CHƯA thi công |
```

Sau:

```markdown
| 🔧 **thi công 16/09** trên nhánh `feat/refund-deadline`, CHƯA merge |
```

(d) Mục "Specs", dòng seed 14/09 — thêm vào cuối ô trạng thái:

```markdown
 · ⚠️ §2, §4.4, §6 và §9 có khối cập nhật 15/09 theo ADR-0041 (bộ sinh phần huỷ/hoàn viết lại ở plan 15/09 Task 12)
```

- [ ] **Step 16: Soát toàn bộ diff `.md` trước khi stage**

Run (Git Bash, gốc worktree):

```bash
git diff --stat -- '*.md'
git diff -- '*.md' | grep -n "^[-+].*^+" || true
git diff -- '*.md' | grep -nE "^[-+]\+" || true
```

Expected: `--stat` liệt kê đúng chín file ở mục **Files**. Hai lệnh grep sau KHÔNG in gì — chúng canh gotcha CHANGELOG của CLAUDE.md: một dòng bắt đầu bằng `+` ở cột 0 trong `.md` là PHÉP CỘNG, và formatter markdown sẽ đổi nó thành `-`. Task này không viết dòng nào như vậy; nếu grep in ra thì có file lạ lọt vào diff.

Đọc `git diff` đầy đủ một lượt bằng mắt, soi ba thứ: bảng markdown còn đủ cột; không dòng nào của ADR cũ ngoài dòng **Trạng thái** bị sửa; không file `.md` nào ngoài chín file bị chạm (mở CHANGELOG ra rồi save là đủ để markdownlint sửa entry cũ — đừng mở).

- [ ] **Step 17: Cổng đầy đủ** (Docker Postgres đang chạy; Git Bash, gốc worktree)

Task này không sửa mã nguồn, nhưng cổng vẫn chạy đủ theo luật 11 — nó cũng là mốc xác nhận Task 13 để lại cây xanh:

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu exit 0. `pnpm lint` bỏ qua `.md` hoàn toàn (Biome), nên nó KHÔNG thay được bước soát mắt ở Step 16.

- [ ] **Step 18: Commit**

```bash
git add docs/conventions/booking-states.md \
  docs/adr/0009-refund-correctness.md \
  docs/adr/0023-tour-merchandising-fields.md \
  docs/adr/0029-cancellation-approve-partial-refund.md \
  docs/adr/0030-refund-policy-tiers.md \
  docs/adr/0033-financial-model.md \
  docs/specs/2026-09-14-seed-khung-2026-design.md \
  docs/plans/2026-09-08-prompts-cac-phase-con-lai.md \
  docs/README.md
git status --short
git commit -m "docs(refund): cập nhật tài liệu hiện trạng theo ADR-0041"
```

Expected: `git status --short` trước commit KHÔNG có `docs/screenshot/` và không có `docs/CHANGELOG.md` (entry CHANGELOG thuộc session gốc, Phụ lục B).
---

### Task 15: Nghiệm thu cuối

**Files:** không sửa file nào. Task này chỉ chạy lệnh, đọc kết quả và soạn báo cáo bàn giao.

**Interfaces:**
- Consumes: mọi thứ Task 1–14 đã làm.
- Produces: một **báo cáo bàn giao** dán vào cuối phiên (mẫu ở Step 15). Không merge, không push, không chạm hạ tầng sống.

- [ ] **Step 1: Grep các ký hiệu đã gỡ trên toàn repo**

Run (Git Bash, gốc worktree). Ba đường loại trừ là cố ý: `prisma/migrations/` và `docs/changelog/` là bản ghi lịch sử bất biến, `docs/` kể chuyện đã xảy ra:

```bash
grep -rn "REFUND_POLICY_TIERS\|REFUND_GRACE_HOURS\|refundPercentFor\|fullRefundThresholdDays\|isWithinGracePeriod\|policyRefundAmount\|percentOfAmount\|RefundPolicyTier\|RefundRequestContext\|RefundEstimate\|refundEstimate\|estimateRefund" \
  apps libs --include=*.ts --include=*.tsx --include=*.mjs --include=*.prisma \
  | grep -v "/node_modules/" | grep -v "/dist/" | grep -v "/src/generated/"

grep -rn "admin\.cancellations\|CANCELLATION_OPEN\|cancellationsApproved\|cancellationsDenied\|decisionsSlice\|approveRefund\|wizard-steps" \
  apps libs --include=*.ts --include=*.tsx \
  | grep -v "/node_modules/" | grep -v "/dist/" | grep -v "/src/generated/"

grep -rn "freeCancellationDays\|free_cancellation_days" \
  apps libs --include=*.ts --include=*.tsx --include=*.mjs --include=*.prisma \
  | grep -v "/node_modules/" | grep -v "/dist/" | grep -v "/src/generated/" \
  | grep -v "apps/api/prisma/migrations/"
```

Expected: hai lệnh đầu KHÔNG in gì. Lệnh thứ ba in ĐÚNG hai dòng — hai cột còn sống trong `apps/api/prisma/schema.prisma` với comment "KHÔNG CÒN ĐỌC … xoá cột ở nhánh M2" (Task 13 Step 12). Bất kỳ dòng nào khác là sót: sửa ở task chủ của file đó rồi chạy lại cổng, đừng vá lẻ ở đây.

- [ ] **Step 2: Grep phần còn lại của luồng duyệt huỷ và văn bản cũ**

```bash
ls apps/admin/src/app/\(admin\)/cancellations 2>/dev/null && echo "CÒN VÙNG CANCELLATIONS — SAI"
ls apps/admin/src/components/cancellations 2>/dev/null && echo "CÒN COMPONENT CANCELLATIONS — SAI"
ls libs/shared/i18n/src/lib/legal/refund-tiers.ts 2>/dev/null && echo "CÒN refund-tiers.ts — SAI"
grep -rn "refund schedule\|refund tiers\|24 hours of pay\|grace period" libs/shared/i18n/src \
  --include=*.ts | grep -v "/dist/"
```

Expected: ba lệnh `ls` không in gì (mỗi lệnh im lặng và không in câu "SAI"). `grep` cuối không in gì — nếu còn, đó là câu quảng bá hoặc văn bản pháp lý Task 11 bỏ sót.

- [ ] **Step 3: Cổng đầy đủ** (Docker Postgres đang chạy; Git Bash, gốc worktree)

```bash
docker compose up -d postgres
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu lệnh sau `docker compose` exit 0. Ghi lại TỔNG SỐ TEST của lượt unit và lượt int — báo cáo bàn giao cần hai con số này.

- [ ] **Step 4: Đối chiếu độ phủ logic mới (luật 4: ≥ 80%)**

Mỗi export mới phải có ít nhất một test gọi ĐÍCH DANH nó. Kiểm bằng vòng lặp, không bằng mắt:

```bash
for ten in VIETNAM_TIME_ZONE CANCELLATION_WINDOW_RULES windowDaysForTripLength \
           tripLengthDays cancellationWindowDays cancellationDeadline vietnamToday \
           isWithinDeadline canCancelOnline refundOnCancel; do
  n=$(grep -c "\b$ten\b" libs/shared/contract/src/schemas/refund-policy.spec.ts)
  printf '%-28s %s\n' "$ten" "$n"
done
for ten in vietnamDateSql assertDepartureBookable cancelByCustomer cancellationOutcomesSlice; do
  n=$(grep -rl "\b$ten\b" apps/api/src --include=*.spec.ts | wc -l)
  printf '%-28s %s file spec\n' "$ten" "$n"
done
grep -c "legacyCancellationNote" apps/web/src/components/account/*.spec.tsx
grep -rc "canRefund" apps/admin/src/lib/refund.spec.ts
```

Expected: mọi con số ≥ 1. Một số 0 nghĩa là một hàm luật đi ra sản phẩm mà không ai kiểm — quay lại task chủ của hàm đó viết test, đừng ghi chú "đã kiểm tay".

- [ ] **Step 5: `seed:verify` mốc H = 2026-09-20**

Run (Git Bash, gốc worktree). Build contract trước vì `verify-seed.mjs` và fixture đọc luật từ bản `dist` (ghi chú Task 12):

```bash
pnpm --filter @tourism/contract build && pnpm --filter @tourism/i18n build
cd apps/api
SEED_HOM_NAY=2026-09-20 pnpm prisma migrate reset --force --skip-seed
SEED_HOM_NAY=2026-09-20 pnpm db:seed
SEED_HOM_NAY=2026-09-20 pnpm seed:verify
```

Expected: `migrate reset` chạy hết mọi migration kể cả M1 của Task 2, không lỗi checksum. `db:seed` chạy xong, in các dòng đếm. `seed:verify` in **0 vi phạm** và exit 0 — gồm cả các bất biến mới của Task 12 (không `paid_at` sau hạn chót; huỷ trong hạn có đúng một dòng hoàn bằng phần còn lại; huỷ quá hạn không dòng hoàn; không `REQUESTED`, không `DENIED`).

⚠️ Không bao giờ `export DATABASE_URL` trong shell này. `prisma.config.ts` chỉ đọc `.env`, mà repo không có `.env`, nên mọi lệnh Prisma rơi về Postgres Docker `localhost:5432` — đúng ý; một lần export nhầm là reset trúng Supabase.

- [ ] **Step 6: `seed:verify` mốc H = 2026-11-03**

Vẫn trong `apps/api`:

```bash
SEED_HOM_NAY=2026-11-03 pnpm prisma migrate reset --force --skip-seed
SEED_HOM_NAY=2026-11-03 pnpm db:seed
SEED_HOM_NAY=2026-11-03 pnpm seed:verify
```

Expected: **0 vi phạm**, exit 0. Mốc này là mốc của lượt seed prod 2 (seed spec §8.5) — đỏ ở đây nghĩa là đợt seed trước bảo vệ sẽ đỏ.

- [ ] **Step 7: Dựng lượt cuối bằng H = ngày THẬT của máy, rồi bật ba tiến trình**

Từ đây trở đi đồng hồ máy và mốc seed phải trùng, nếu không "đã qua hạn chót" trên màn hình sẽ không khớp dữ liệu (xem ghi chú 2 ở đầu file).

```bash
cd apps/api
export SEED_HOM_NAY="$(date +%F)"
echo "H = $SEED_HOM_NAY"
pnpm prisma migrate reset --force --skip-seed
pnpm db:seed
pnpm seed:verify
```

Expected: `H` in ra đúng ngày hôm nay; `seed:verify` 0 vi phạm.

Rồi mở **ba** cửa sổ Git Bash riêng (đừng dùng lại shell có `SEED_HOM_NAY`):

```bash
pnpm --filter @tourism/api dev            # API  → http://localhost:3001
pnpm --filter @tourism/api dev:worker     # worker: in email ra console (không có RESEND_API_KEY)
pnpm --filter @tourism/web dev            # web  → http://localhost:3000
```

Expected: API log "Nest application successfully started"; web build xong và trả `http://localhost:3000`. Cửa sổ admin (`pnpm --filter @tourism/admin dev`, cổng 3002) mở ở Step 13.

⚠️ `apps/web/scripts/guard-build.mjs` dò `/proc` nên trên Windows KHÔNG chặn được build-khi-đang-serve. Tắt hết `next dev` trước khi chạy lại cổng ở Step 14.

- [ ] **Step 8: Tìm dữ liệu cho hai ca kiểm tay**

Chạy trong container Postgres (Git Bash):

```bash
docker exec -i tourism-v2-postgres-1 psql -U tourism -d tourism <<'SQL'
WITH d AS (
  SELECT dep.id, dep.start_date, dep.end_date, t.slug, t.title,
         dep.start_date - (CASE
           WHEN dep.end_date - dep.start_date + 1 = 1 THEN 1
           WHEN dep.end_date - dep.start_date + 1 <= 3 THEN 3
           ELSE 7 END) AS han_chot
  FROM tour_departures dep JOIN tours t ON t.id = dep.tour_id
  WHERE dep.status = 'OPEN'
)
SELECT 'CHUYEN QUA HAN' AS loai, d.slug, d.start_date, d.han_chot, NULL AS code, NULL AS email
FROM d
WHERE d.han_chot < CURRENT_DATE AND d.start_date > CURRENT_DATE
LIMIT 3;
SQL
```

```bash
docker exec -i tourism-v2-postgres-1 psql -U tourism -d tourism <<'SQL'
SELECT b.code, u.email, b.status, b.departure_start_date, b.departure_end_date,
       b.departure_start_date - (CASE
         WHEN b.departure_end_date - b.departure_start_date + 1 = 1 THEN 1
         WHEN b.departure_end_date - b.departure_start_date + 1 <= 3 THEN 3
         ELSE 7 END) AS han_chot,
       b.total_amount, b.provider_payment_id IS NOT NULL AS co_capture
FROM bookings b JOIN users u ON u.id = b.user_id
WHERE b.status = 'PAID' AND b.departure_start_date > CURRENT_DATE
ORDER BY han_chot < CURRENT_DATE DESC, b.departure_start_date
LIMIT 10;
SQL
```

Expected: truy vấn đầu trả ≥ 1 chuyến (Task 12 bảo đảm mọi tour ≥ 4 ngày có ít nhất một chuyến như vậy). Truy vấn sau trả cả hai nhóm — ghi lại **một `code` có `han_chot < hôm nay`** (ca huỷ quá hạn, Step 11) và **một `code` có `han_chot >= hôm nay`** (ca cổng lỗi, Step 12), kèm `email` của chủ booking.

Mật khẩu đăng nhập của khách seed: giá trị `SEED_CUSTOMER_PASSWORD` trong `apps/api/.env.local` nếu có, ngược lại hằng `MAT_KHAU_KHACH_MAC_DINH` trong `apps/api/prisma/fixtures/chot-chan-seed.ts` — mở file đọc, đừng đoán.

- [ ] **Step 9: Kiểm tay 1 — trang tour hiện "Booking closed"**

Mở `http://localhost:3000/tours/<slug của chuyến qua hạn ở Step 8>`, tab Departures.

Expected: chuyến ấy VẪN hiện trong danh sách nhưng không chọn được, mang nhãn **"Booking closed"**; các chuyến còn hạn chọn được bình thường. Giá "from" của trang KHÔNG lấy theo chuyến đã đóng. Dòng hạn chót của chuyến in NGÀY cụ thể, không in "24 hours".

⚠️ Trang tour cache 300 giây (spec §12). Vừa seed xong mà thấy dữ liệu cũ thì hard-reload hoặc đợi; đây không phải lỗi.

- [ ] **Step 10: Kiểm tay 2 — API chặn tạo booking trên chuyến đã qua hạn**

Lấy `id` của chuyến qua hạn từ Step 8, rồi (Git Bash):

```bash
EMAIL='<email khách seed>'; PASS='<mật khẩu ở Step 8>'; DEP='<uuid chuyến qua hạn>'
curl -s -c /tmp/ck.txt -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  http://localhost:3001/api/auth/sign-in/email > /dev/null
curl -s -o /dev/null -w '%{http_code}\n' -b /tmp/ck.txt -H 'content-type: application/json' \
  -d "{\"departureId\":\"$DEP\",\"numAdults\":1,\"numChildren\":0,\"contactName\":\"Kiem tay\",\"contactEmail\":\"$EMAIL\",\"paymentProvider\":\"STRIPE\"}" \
  http://localhost:3001/api/bookings
curl -s -b /tmp/ck.txt -H 'content-type: application/json' \
  -d "{\"departureId\":\"$DEP\",\"numAdults\":1,\"numChildren\":0,\"contactName\":\"Kiem tay\",\"contactEmail\":\"$EMAIL\",\"paymentProvider\":\"STRIPE\"}" \
  http://localhost:3001/api/bookings
rm -f /tmp/ck.txt
```

Expected: mã trạng thái **400** và thân trả về chứa `"code":"DEPARTURE_NOT_AVAILABLE"`. Đây là chốt chặn của `assertDepartureBookable` (Task 4) — nếu ra 200 thì chốt chặn không áp cho đường `create`.

- [ ] **Step 11: Kiểm tay 3 — khách tự huỷ QUÁ hạn: huỷ được, không hoàn đồng nào**

Đăng nhập web bằng `email` của booking quá hạn (Step 8), mở `http://localhost:3000/account/bookings/<code>`.

Expected trên màn hình:
- Có nút huỷ; hộp xác nhận là **dạng "không hoàn"**, nói rõ hạn chót đã qua và số tiền hoàn là `$0.00` — không có hộp nhập lý do bắt buộc, không có chữ "we will review".
- Bấm xác nhận → trang đổi sang `Cancelled` ngay trong một lượt, không có trạng thái "pending".

Rồi kiểm sổ (Git Bash):

```bash
CODE='<code quá hạn>'
docker exec -i tourism-v2-postgres-1 psql -U tourism -d tourism <<SQL
SELECT status, cancelled_at IS NOT NULL AS co_cancelled_at FROM bookings WHERE code = '$CODE';
SELECT count(*) AS so_dong_hoan FROM refunds r JOIN bookings b ON b.id = r.booking_id WHERE b.code = '$CODE';
SELECT status, decided_by = b.user_id AS khach_tu_quyet, reason IS NULL AS reason_null
  FROM cancellation_requests c JOIN bookings b ON b.id = c.booking_id WHERE b.code = '$CODE';
SELECT type, status, dedupe_key FROM outbox
  WHERE dedupe_key LIKE 'booking-cancelled:%' ORDER BY created_at DESC LIMIT 3;
SELECT seats_booked FROM tour_departures WHERE id = (SELECT departure_id FROM bookings WHERE code = '$CODE');
SQL
```

Expected: `status = CANCELLED` và `co_cancelled_at = t`; `so_dong_hoan = 0`; đúng **một** dòng `cancellation_requests` `REFUNDED` với `khach_tu_quyet = t`; một dòng outbox `BOOKING_CANCELLED`; `seats_booked` đã giảm đúng số khách của booking (so với giá trị đọc TRƯỚC khi huỷ — chạy truy vấn cuối một lần trước Step này).

Cửa sổ worker in ra email `BOOKING_CANCELLED` biến thể "không hoàn" (`ConsoleDeliverer`, vì không có `RESEND_API_KEY`) — đọc và xác nhận nó in ngày chót và KHÔNG hứa hoàn tiền.

- [ ] **Step 12: Kiểm tay 4 — huỷ TRONG hạn trên booking seed: cổng lỗi thì không ghi gì**

Đây là ca thay cho lượt Stripe sandbox (ghi chú 1 ở đầu file): máy dev không có gateway nào đăng ký, mà mã thanh toán của booking seed cũng là mã giả, nên đường này PHẢI hỏng — và cái đáng nghiệm thu là **nó hỏng sạch**.

Đăng nhập bằng chủ của booking còn trong hạn (Step 8), mở trang booking, bấm huỷ, xác nhận.

Expected trên màn hình: hộp xác nhận là **dạng "hoàn đủ"**, in đúng số tiền `remainingRefundable` và ngày chót; bấm xác nhận → hiện thông báo lỗi cho người dùng (không phải màn trắng, không phải "đã huỷ"). API log in `Provider refund failed for booking …`.

Rồi kiểm KHÔNG có gì được ghi:

```bash
CODE='<code còn trong hạn>'
docker exec -i tourism-v2-postgres-1 psql -U tourism -d tourism <<SQL
SELECT status, cancelled_at FROM bookings WHERE code = '$CODE';
SELECT count(*) FROM refunds r JOIN bookings b ON b.id = r.booking_id WHERE b.code = '$CODE';
SELECT count(*) FROM cancellation_requests c JOIN bookings b ON b.id = c.booking_id WHERE b.code = '$CODE';
SQL
```

Expected: `status` vẫn `PAID`, `cancelled_at` vẫn `NULL`, cả hai `count` bằng giá trị trước khi bấm (thường là 0). Đây chính là bất biến "gọi cổng thanh toán trước, sổ sau" của ADR-0009 mà ADR-0041 giữ nguyên. Nếu booking đã thành `CANCELLED` mà không có dòng hoàn thì lõi huỷ đã ghi trước khi cổng trả lời — lỗi nặng, dừng nghiệm thu và báo ngay.

- [ ] **Step 13: Kiểm tay 5 — admin**

Mở cửa sổ thứ tư: `pnpm --filter @tourism/admin dev` → `http://localhost:3002`, đăng nhập bằng tài khoản admin của seed (email đầu trong `ADMIN_EMAILS` của `apps/api/.env.local`).

Expected:
- Menu bên trái **không còn mục Cancellations**; gõ thẳng `http://localhost:3002/cancellations` ra 404.
- `/bookings/<code quá hạn ở Step 11>`: booking hiện `CANCELLED`; khối lịch sử huỷ mới hiện một dòng do CHÍNH khách quyết; nút **hoàn thiện chí** CÓ hiện (booking `CANCELLED` còn dư tiền) và bắt nhập số tiền + lý do.
- `/outbox`: bộ lọc loại email có mục **`BOOKING_CANCELLED`**, lọc theo nó ra đúng dòng vừa sinh.
- `/reports` tháng hiện tại: hai ô đếm huỷ mang nhãn mới (trong hạn / quá hạn), không còn "approved"/"denied"; file Excel tải về mở được và có đúng hai cột ấy.
- `/payment-events`: không có sự kiện hoàn nào sinh từ Step 11 (huỷ quá hạn không gọi cổng).

- [ ] **Step 14: Dọn và chạy lại cổng lần cuối**

Tắt cả bốn tiến trình dev (Ctrl+C từng cửa sổ) — bắt buộc trước khi build web trên Windows. Rồi (Git Bash, gốc worktree):

```bash
git status --short
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: `git status --short` KHÔNG có file mã nguồn nào đổi (kiểm tay chỉ ghi vào DB, không vào repo); `docs/screenshot/` nếu hiện thì để nguyên, không `git add`, không `git clean`. Sáu lệnh sau exit 0.

Dọn rác sinh ra trong đợt (memory `don-dep-sau-task`): `apps/api/dist-seed`, `.turbo`, `apps/web/.next`, `apps/admin/.next` đều gitignored — xoá được nếu ổ chật, báo user trước và sau.

- [ ] **Step 15: Soạn báo cáo bàn giao**

Không merge, không push, không chạm hạ tầng sống. Dán báo cáo sau vào cuối phiên, điền đủ mọi chỗ `…`:

```markdown
## Bàn giao: hoàn tiền một hạn chót (ADR-0041)

**Nhánh:** `feat/refund-deadline` · worktree `…` · base `main@…` · … commit
(`git log --oneline main..HEAD`)

**Cổng đầy đủ:** ✅ chạy lần cuối lúc … — unit … test, int … test, build,
typecheck, `biome check`, `check-mobile-tokens-only` đều xanh.

**Migration:** M1 `20260915120000_refund_deadline_expand` đã apply trên Docker,
**CHƯA chạy lên Supabase** (luật 15 — bước 2 của Phụ lục B). M2 chưa viết: nó
là nhánh riêng SAU khi prod đã seed lại (Phụ lục A).

**`seed:verify`:** 0 vi phạm ở cả ba lượt — H = 2026-09-20, H = 2026-11-03,
H = … (ngày thật của máy).

**Kiểm tay trên Docker + dev server:**
- ✅ chuyến đã qua hạn chót hiện "Booking closed" ở trang tour, không chọn được
- ✅ `POST /api/bookings` trên chuyến ấy trả 400 `DEPARTURE_NOT_AVAILABLE`
- ✅ huỷ QUÁ hạn: booking → `CANCELLED`, 0 dòng hoàn, đúng 1 yêu cầu `REFUNDED`
  do chính khách quyết, ghế trả lại, 1 dòng outbox `BOOKING_CANCELLED`
- ✅ huỷ TRONG hạn trên booking seed: 502 `REFUND_FAILED`, DB KHÔNG đổi một
  dòng nào — bất biến "cổng trước, sổ sau" còn nguyên
- ✅ admin: hết vùng Cancellations, nút hoàn thiện chí hiện trên booking
  `CANCELLED`, outbox có `BOOKING_CANCELLED`, `/reports` hai cột huỷ mới

**CÒN TREO — session gốc làm, theo Phụ lục B:**
1. Lượt sandbox Stripe THẬT (spec §11 và §14): đặt booking mới bằng thẻ test,
   huỷ trong hạn, xem tiền hoàn ở Stripe test dashboard và ở sổ. Máy dev không
   làm được: `apps/api/.env.local` không có key, và dev không đăng ký
   FakeGateway. Chạy sau bước 5 của Phụ lục B, trên site thật.
2. Tám bước triển khai của Phụ lục B (M1 lên Supabase → tắt tự deploy Vercel →
   rebase + ff + push → đèn CI → Render → bật lại và redeploy Vercel → seed lại
   prod → M2).
3. Entry `docs/CHANGELOG.md` và `./scripts/docs-freshness.sh` (Phụ lục B bước 8).
4. Nợ ghi cho P4e-1, đã chép vào prompt `docs/plans/2026-09-08-prompts-cac-phase-con-lai.md`
   §1a: nút "Cancel departure" mở `cancelInLock` cho `initiator: 'operator'`,
   và CHECK `end_date >= start_date` trên `tour_departures`.

**Rủi ro đã biết, không vá ở đợt này** (spec §12): chuyến có `end_date` trước
`start_date` làm trang tour và báo cáo 500 (không có dòng nào như vậy trong
seed); cache trang tour 300 giây trễ tối đa 5 phút quanh hạn chót; dữ liệu
`REQUESTED`/`DENIED` cũ còn trên prod giữa bước 4 và bước 7 của Phụ lục B.
```

- [ ] **Step 16: Kiểm cây sạch và danh sách commit** (thay bước commit — task này không sinh file)

```bash
git status --short
git log --oneline main..HEAD
git diff --stat main..HEAD -- ':!docs'
```

Expected: `git status --short` không có file mã nguồn nào chưa commit. `git log` liệt kê đúng **14 commit**, mỗi Task 1–14 một commit, message tiếng Việt có dấu theo Conventional Commits và **không dòng AI attribution nào** (kiểm nhanh: `git log main..HEAD --format=%B | grep -i "co-authored-by\|generated with" || true` không in gì). `git diff --stat` cho thấy diff mã nguồn khớp phạm vi plan, không file lạ.

Dừng ở đây. Merge, push và mọi thao tác hạ tầng thuộc session gốc (Phụ lục B).
---

## Phụ lục A: nhánh M2 — xoá hai cột và ba loại email của luồng duyệt

**Chạy khi nào:** SAU khi Phụ lục B đã xong tới hết bước 6 — tức M1 đã lên
Supabase, code mới đã sống trên Render và Vercel, và prod đã seed lại. Không
sớm hơn: hai cột chỉ được xoá khi chắc chắn không còn bản API nào đọc chúng, và
ba loại email chỉ được rút khỏi enum khi bảng `outbox` không còn dòng nào mang
giá trị ấy (lượt seed lại chính là thứ dọn sạch chúng — `data:reset` có `outbox`
trong danh sách bảng).

**Chạy ở đâu:** một nhánh nhỏ riêng, `chore/refund-deadline-m2`, tách từ `main`
mới nhất. Các Step 1–11 là thi công thuần trên Docker local, không chạm hạ tầng
sống (CLAUDE.md luật 15). Step 12 là merge và deploy, thuộc session gốc.

**Files:**
- Create: `apps/api/prisma/migrations/<timestamp Prisma sinh>_refund_deadline_contract/migration.sql`
- Modify: `apps/api/prisma/schema.prisma` (hai cột `freeCancellationDays`, ba giá trị `enum EmailType`)
- Modify: `libs/shared/contract/src/schemas/outbox.ts` (ba phần tử của `EmailTypeSchema`)
- Modify: `libs/shared/contract/src/schemas/outbox.spec.ts` (`toHaveLength(15)` → `12`)
- Modify: `apps/api/src/worker/emails/render-email.tsx` (ba `case`)
- Modify: `apps/api/src/worker/resend.deliverer.spec.ts` (ba dòng bảng `cases`, một `describe`, một `it`)
- Modify: `apps/admin/src/components/outbox/outbox-type-menu.tsx` (ba mục `TYPE_META`)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (ba nhãn `admin.outbox.type.*`)
- Modify: `docs/CHANGELOG.md` (entry mới), `docs/README.md` (dòng plan)

**Interfaces:**
- Gỡ: `EmailType.CANCELLATION_REQUESTED`, `CANCELLATION_APPROVED`, `CANCELLATION_DENIED` ở CẢ enum Postgres, enum Prisma và `EmailTypeSchema`; cột `tours.free_cancellation_days`, `cancellation_requests.free_cancellation_days`.
- GIỮ: `EmailType.BOOKING_CANCELLED` (Task 2) và họ `'cancellation'` của `outbox-type-menu.tsx` — sau M2 họ ấy còn đúng một thành viên là `BOOKING_CANCELLED`, nên `FAMILY_ORDER` KHÔNG đổi.
- Sau M2 `EmailTypeSchema.options` có **12** phần tử, `BOOKING_CANCELLED` vẫn ở CUỐI (int test `refund-deadline-migration.int.spec.ts` của Task 2 so thứ tự hai mảng).

- [ ] **Step 1: Tách nhánh và kiểm điều kiện vào**

```bash
git switch main && git pull --ff-only
git switch -c chore/refund-deadline-m2
git log --oneline -3
```

Expected: `main` chứa commit merge của `feat/refund-deadline`; CHANGELOG mới nhất có entry của đợt đó và ghi lượt seed lại prod đã chạy. Nếu chưa có, DỪNG — M2 chạy sớm là xoá cột khi API cũ có thể còn phục vụ.

- [ ] **Step 2: Viết migration M2**

```bash
pnpm --filter @tourism/api exec prisma migrate dev --create-only --name refund_deadline_contract
```

Expected: Prisma tạo `apps/api/prisma/migrations/<timestamp>_refund_deadline_contract/migration.sql`. Giữ nguyên timestamp Prisma sinh (nó luôn muộn hơn M1 `20260915120000`) và ghi lại tên thư mục — entry CHANGELOG ở Step 10 cần nó.

Ghi đè nội dung file bằng:

```sql
-- Hoàn tiền một hạn chót (ADR-0041, spec 2026-09-15 §4.2) — migration THU HẸP
-- M2: chạy SAU khi code mới đã sống và prod đã seed lại. Xoá hai cột badge huỷ
-- của ADR-0023 và ba loại email của luồng duyệt huỷ ADR-0029.
-- Migration là bản ghi bất biến: KHÔNG khai trạng thái deploy ở đây (trạng thái
-- sống ở docs/CHANGELOG.md).

-- 1. Hai cột badge huỷ. Không có index, FK hay CHECK nào trỏ vào chúng.
ALTER TABLE "tours" DROP COLUMN "free_cancellation_days";
ALTER TABLE "cancellation_requests" DROP COLUMN "free_cancellation_days";

-- 2. Chốt chặn: Postgres không có ALTER TYPE ... DROP VALUE, nên phải dựng lại
--    kiểu. Dựng lại mà còn dòng mang giá trị cũ thì câu USING bên dưới nổ với
--    một thông điệp khó đọc; RAISE ở đây nói thẳng phải làm gì.
DO $$
DECLARE con_lai bigint;
BEGIN
  SELECT count(*) INTO con_lai FROM "outbox"
   WHERE "type" IN ('CANCELLATION_REQUESTED', 'CANCELLATION_APPROVED', 'CANCELLATION_DENIED');
  IF con_lai > 0 THEN
    RAISE EXCEPTION
      'outbox con % dong mang EmailType cua luong duyet huy — chay lai seed hoac don cac dong do truoc khi chay M2',
      con_lai;
  END IF;
END $$;

-- 3. Dựng lại "EmailType" không còn ba giá trị ấy. Thứ tự giữ nguyên phần còn
--    lại và BOOKING_CANCELLED vẫn đứng CUỐI, khớp enum Prisma và EmailTypeSchema.
--    Cột duy nhất dùng kiểu này là "outbox"."type" (không có DEFAULT).
ALTER TYPE "EmailType" RENAME TO "EmailType_old";

CREATE TYPE "EmailType" AS ENUM (
  'BOOKING_CONFIRMATION',
  'BOOKING_REFUNDED',
  'REVIEW_APPROVED',
  'REVIEW_REJECTED',
  'ENQUIRY_RECEIVED',
  'ENQUIRY_ADMIN_ALERT',
  'NEWSLETTER_WELCOME',
  'EMAIL_CHANGED',
  'PASSWORD_RESET',
  'EMAIL_VERIFICATION',
  'EMAIL_OTP',
  'BOOKING_CANCELLED'
);

ALTER TABLE "outbox"
  ALTER COLUMN "type" TYPE "EmailType" USING ("type"::text::"EmailType");

DROP TYPE "EmailType_old";
```

- [ ] **Step 3: Dọn `schema.prisma`**

(a) Model `Tour` — xoá khối comment `// KHÔNG CÒN ĐỌC (ADR-0041): …` (Task 13 Step 12) và dòng:

```prisma
  freeCancellationDays Int?            @map("free_cancellation_days")
```

(b) Model `CancellationRequest` — xoá khối doc comment `/// KHÔNG CÒN ĐỌC (ADR-0041): …` và dòng:

```prisma
  freeCancellationDays Int?              @map("free_cancellation_days")
```

(c) `enum EmailType` — xoá ba dòng:

```prisma
  CANCELLATION_REQUESTED
  CANCELLATION_APPROVED
  CANCELLATION_DENIED
```

- [ ] **Step 4: Áp lên Docker và xác nhận không drift**

```bash
docker compose up -d postgres
pnpm --filter @tourism/api exec prisma migrate dev
pnpm --filter @tourism/api exec prisma migrate dev
pnpm --filter @tourism/api db:generate
```

Expected: lần 1 áp migration mới và in "Your database is now in sync with your schema."; lần 2 in "Already in sync, no schema change or pending migration was found." (SQL viết tay khớp `schema.prisma`); `db:generate` in "Generated Prisma Client".

Từ sau bước này tuyệt đối không sửa `migration.sql` ấy nữa, kể cả một dấu cách (checksum).

- [ ] **Step 5: Gỡ ba giá trị khỏi contract**

(a) `libs/shared/contract/src/schemas/outbox.ts` — trong mảng của `EmailTypeSchema`, xoá ba dòng:

```ts
  'CANCELLATION_REQUESTED',
  'CANCELLATION_APPROVED',
  'CANCELLATION_DENIED',
```

(b) `libs/shared/contract/src/schemas/outbox.spec.ts` — trong test `'EmailType phủ mọi loại email mà worker biết gửi'`, đổi dòng cuối. Trước:

```ts
    expect(EmailTypeSchema.options).toHaveLength(15);
```

Sau:

```ts
    // M2 (ADR-0041) rút ba loại của luồng duyệt huỷ; BOOKING_CANCELLED vẫn cuối.
    expect(EmailTypeSchema.options).not.toContain('CANCELLATION_REQUESTED');
    expect(EmailTypeSchema.options).toHaveLength(12);
```

Run: `pnpm --filter @tourism/contract exec vitest run src/schemas/outbox.spec.ts && pnpm --filter @tourism/contract build && pnpm --filter @tourism/i18n build`
Expected: PASS; hai build exit 0.

- [ ] **Step 6: Gỡ ba template khỏi `render-email.tsx`**

Trong `apps/api/src/worker/emails/render-email.tsx`, xoá nguyên ba nhánh `case` cùng phần thân và component riêng của chúng nếu component ấy không còn ai gọi:

```tsx
    case EmailType.CANCELLATION_REQUESTED:
    case EmailType.CANCELLATION_APPROVED:
    case EmailType.CANCELLATION_DENIED:
```

Sau khi xoá, grep để chắc không bỏ sót component mồ côi:

```bash
grep -n "Cancellation" apps/api/src/worker/emails/render-email.tsx
```

Expected: chỉ còn các dòng thuộc nhánh `BOOKING_CANCELLED` của Task 2 (nếu tên component ở đó có chữ "Cancel"). Mọi tên chỉ phục vụ ba `case` vừa xoá phải đi theo — Biome sẽ báo "unused" ở Step 9 nếu sót.

⚠️ Nhánh `default` của `switch` KHÔNG được nới thành nhánh nuốt: kiểm nó vẫn là `never`-exhaustive như trước (typecheck ở Step 9 là lưới).

- [ ] **Step 7: Gỡ test của ba template**

Trong `apps/api/src/worker/resend.deliverer.spec.ts`:

(a) Trong bảng `cases` của test "covers every EmailType enum value", xoá ba dòng:

```ts
    [EmailType.CANCELLATION_REQUESTED, /reviewing your cancellation request — BK-1/],
    [EmailType.CANCELLATION_APPROVED, /Cancellation approved — BK-1/],
    [EmailType.CANCELLATION_DENIED, /About your cancellation request — BK-1/],
```

(b) Xoá nguyên `describe('renderEmail — duyệt huỷ mà KHÔNG hoàn đồng nào (ADR-0029 §AMEND 3)', …)` cùng bốn test bên trong và hằng `ZERO_PAYLOAD` của nó. Hành vi "hoàn 0 thì không hứa tiền" KHÔNG mất: Task 2 đã chuyển nó sang biến thể "không hoàn" của `BOOKING_CANCELLED` trong `describe('renderEmail — khách tự huỷ (BOOKING_CANCELLED, ADR-0041)', …)`. Mở describe đó ra đọc và xác nhận có ca `amount: '0.00'` trước khi xoá describe cũ — nếu chưa có thì viết thêm ca ấy ở đây rồi mới xoá.

(c) Xoá test `it('renders the denial note when present', …)` (nó gọi `EmailType.CANCELLATION_DENIED`).

Run: `pnpm --filter @tourism/api exec vitest run src/worker/resend.deliverer.spec.ts`
Expected: PASS, không test nào FAIL, không lỗi "Cannot read properties of undefined".

- [ ] **Step 8: Gỡ nhãn ở admin và i18n**

(a) `apps/admin/src/components/outbox/outbox-type-menu.tsx` — trong `TYPE_META`, xoá ba dòng:

```tsx
  CANCELLATION_REQUESTED: { family: 'cancellation', icon: CircleDashedIcon },
  CANCELLATION_APPROVED: { family: 'cancellation', icon: ShieldCheckIcon },
  CANCELLATION_DENIED: { family: 'cancellation', icon: ShieldXIcon },
```

`FAMILY_ORDER` GIỮ NGUYÊN cả năm họ: `BOOKING_CANCELLED` của Task 2 thuộc họ `'cancellation'`, nên họ ấy vẫn có thành viên. Xoá các import icon nay mồ côi (`CircleDashedIcon`, `ShieldCheckIcon`, `ShieldXIcon`) — Biome báo ở Step 9 nếu quên.

(b) `libs/shared/i18n/src/lib/messages.ts` — trong `admin.outbox.type`, xoá ba dòng:

```ts
        CANCELLATION_REQUESTED: 'Cancellation requested',
        CANCELLATION_APPROVED: 'Cancellation approved',
        CANCELLATION_DENIED: 'Cancellation denied',
```

`type` là `Record<EmailTypeValue, string>` đủ member, nên thừa nhãn cũng là đỏ typecheck — hai bên phải rút cùng lúc.

- [ ] **Step 9: Grep sạch, format, cổng đầy đủ**

```bash
grep -rn "CANCELLATION_REQUESTED\|CANCELLATION_APPROVED\|CANCELLATION_DENIED" \
  apps libs --include=*.ts --include=*.tsx --include=*.mjs --include=*.prisma \
  | grep -v "/node_modules/" | grep -v "/dist/" | grep -v "/src/generated/" \
  | grep -v "apps/api/prisma/migrations/"
grep -rn "freeCancellationDays\|free_cancellation_days" apps libs \
  --include=*.ts --include=*.tsx --include=*.mjs --include=*.prisma \
  | grep -v "/node_modules/" | grep -v "/dist/" | grep -v "/src/generated/" \
  | grep -v "apps/api/prisma/migrations/"
pnpm lint:fix
```

Expected: cả hai grep KHÔNG in gì (migration cũ và migration M2 bị loại trừ vì là bản ghi lịch sử). Từ đây spec §14 "sau M2 không còn `freeCancellationDays`" đã thoả.

Rồi cổng đầy đủ (Docker Postgres đang chạy; Git Bash, gốc repo):

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
```

Expected: cả sáu exit 0. Int test `refund-deadline-migration.int.spec.ts` (Task 2) chạy trên DB test đã nhận M2 nên nó khoá luôn thứ tự enum mới; nếu nó đỏ thì thứ tự trong `CREATE TYPE` ở Step 2 lệch với `schema.prisma`.

- [ ] **Step 10: Tài liệu (luật 13)**

(a) `docs/CHANGELOG.md` — thêm entry MỚI ở đầu, dưới khối trích dẫn về archive. Viết theo khuôn "ngày · hash · nội dung · review findings · số test", và **không để dòng nào bắt đầu bằng `+` ở cột 0** (gotcha CLAUDE.md: formatter markdown đổi `+` thành `-` và nói sai con số):

```markdown
## <ngày> — M2 hoàn tiền một hạn chót: xoá hai cột badge huỷ và ba loại email duyệt (nhánh `chore/refund-deadline-m2`, ff vào `main`)

Migration thu hẹp đi sau M1 đúng một nhịp, theo spec 15/09 §10 bước 7 — chạy khi
code mới đã sống trên Render và Vercel và prod đã seed lại, nên không bản API nào
còn đọc hai cột.

- `<hash>` chore(api): migration `<tên thư mục migration>` xoá
  `tours.free_cancellation_days` và `cancellation_requests.free_cancellation_days`;
  dựng lại enum `EmailType` không còn `CANCELLATION_REQUESTED`,
  `CANCELLATION_APPROVED`, `CANCELLATION_DENIED` (Postgres không có
  `ALTER TYPE … DROP VALUE`). Migration mang một chốt chặn `DO $$ … RAISE $$`:
  còn dòng `outbox` mang ba giá trị ấy thì dừng, không đổi kiểu nửa chừng.
- Code theo sau: `EmailTypeSchema` còn 12 giá trị (`BOOKING_CANCELLED` vẫn cuối),
  ba `case` của `render-email.tsx` và nhãn tương ứng ở `outbox-type-menu.tsx` cùng
  `@tourism/i18n` đã gỡ. Hành vi "hoàn 0 thì không hứa tiền" đã chuyển sang biến
  thể không-hoàn của `BOOKING_CANCELLED` từ đợt trước, không mất bất biến nào.

**Trạng thái deploy:** M2 đã chạy lên Supabase ngày `<ngày>`.

**Review findings:** `<số>` — `<liệt kê, hoặc "không có">`.

Tests after: `<số unit>` unit và `<số int>` integration, `pnpm gate:int` xanh.
```

(b) `docs/README.md` — dòng plan "Hoàn tiền một hạn chót", đổi ô trạng thái sang `✅ **merge <ngày>** · M2 xong <ngày>` và bỏ chữ "CHƯA merge" ở dòng spec tương ứng.

Run: `git diff -- '*.md' | grep -nE "^[-+]\+" || true`
Expected: không in gì. Đọc `git diff docs/CHANGELOG.md` bằng mắt: KHÔNG được có dòng nào của entry CŨ bị đổi (entry cũ là bản ghi bất biến; mở file bằng editor có markdownlint là đủ để nó tự sửa).

- [ ] **Step 11: Commit**

```bash
git add apps/api/prisma/migrations apps/api/prisma/schema.prisma \
  libs/shared/contract/src/schemas/outbox.ts \
  libs/shared/contract/src/schemas/outbox.spec.ts \
  libs/shared/i18n/src/lib/messages.ts \
  apps/api/src/worker/emails/render-email.tsx \
  apps/api/src/worker/resend.deliverer.spec.ts \
  apps/admin/src/components/outbox/outbox-type-menu.tsx \
  docs/CHANGELOG.md docs/README.md
git commit -m "chore(api): xoá hai cột free_cancellation_days và ba loại email duyệt huỷ (M2)"
```

- [ ] **Step 12: Merge và deploy — session gốc, sau review**

Cùng trình tự Phụ lục B nhưng ngắn hơn, vì M2 chỉ thu hẹp thứ code mới đã ngừng dùng:

```bash
git switch main && git pull --ff-only
git switch chore/refund-deadline-m2 && git rebase main
git switch main && git merge --ff-only chore/refund-deadline-m2
```

Trước khi push, chạy M2 lên Supabase từ `apps/api`, trong Git Bash (gotcha `tr -d '\r'` của CLAUDE.md — `.env.production` sửa trên Windows mang CRLF):

```bash
cd apps/api
export DATABASE_URL="$(grep '^DATABASE_URL=' .env.production | cut -d= -f2- | tr -d '\r')"
pnpm prisma migrate deploy
pnpm prisma migrate status
```

Expected: `migrate deploy` áp đúng một migration mới; `migrate status` in "Database schema is up to date!". Nếu chốt chặn `RAISE EXCEPTION` nổ thì `outbox` prod còn dòng cũ — chạy lại lượt seed (hoặc xoá đúng các dòng ấy) rồi chạy lại, **đừng** sửa migration.

Rồi:

```bash
cd ../..
git push
gh run list --branch main --limit 1
```

Expected: run mới nhất `success` (luật 14 — chờ nếu đang chạy). Render tự deploy API; Vercel tự deploy web và admin. Ở M2 **không** cần tắt tự deploy Vercel: code mới không đọc gì từ API mà API cũ chưa có — chiều phụ thuộc ngược với M1. Kiểm cuối: mở `www.nexora-travel.agency` một trang tour và `/account/bookings`, mở trang `/outbox` của admin và lọc theo `Booking cancelled`, cả hai trả 200.

Xoá nhánh: `git branch -d chore/refund-deadline-m2`.
---

## Phụ lục B: triển khai — session gốc và user làm, KHÔNG phải session thi công

Session thi công dừng ở Task 15 với báo cáo bàn giao. Mọi bước dưới đây chạm hạ
tầng sống nên thuộc session gốc, sau review (CLAUDE.md luật 15; spec §10).

**Thứ tự là bắt buộc, không phải gợi ý.** Vercel và Render build độc lập và
Vercel gần như luôn xong trước; client oRPC KHÔNG validate response, nên web mới
đứng cạnh API cũ vài phút từng làm 500 mọi lượt vào một trang admin. Vì vậy: DB
trước (M1 chỉ thêm và nới, API cũ không hỏng) → API → mới tới web và admin.

**Shell:** Git Bash, không PowerShell (`scripts/*.sh` và cú pháp `export …` cần
nó; `bash` gõ trong PowerShell là launcher WSL, không phải Git Bash).

---

### Bước 1 — Khép nhánh: entry CHANGELOG và `docs-freshness`

Làm TRÊN nhánh `feat/refund-deadline`, trước khi rebase (rebase đổi hash, nên
entry viết trước phải sửa hash sau — xem cuối bước).

(a) Thêm entry mới vào ĐẦU `docs/CHANGELOG.md`, dưới khối trích dẫn về archive.
Khuôn "ngày · hash · nội dung · review findings · số test"; **không dòng nào bắt
đầu bằng `+` ở cột 0**:

```markdown
## <ngày merge> — Hoàn tiền một hạn chót mỗi chuyến (ADR-0041, nhánh `feat/refund-deadline`, ff vào `main`)

Thay bảng bậc 100/50/25/0, ân hạn 24 giờ và luồng duyệt huỷ bằng MỘT hạn chót
cho mỗi chuyến: ngày chót = khởi hành trừ N, với N là 1 cho tour trong ngày, 3
cho tour 2–3 ngày, 7 cho tour từ 4 ngày. Cùng một mốc vừa ngừng nhận đặt vừa hết
huỷ miễn phí. Khách tự huỷ và hệ thống xử lý ngay: trong hạn hoàn trọn phần còn
lại, quá hạn hoàn `0.00` và không gọi cổng thanh toán. Mọi phép so ngày theo giờ
Việt Nam, tính ở server. 15 task, 14 commit thi công.

- Luật là bộ hàm thuần ở `libs/shared/contract/src/schemas/refund-policy.ts`
  (`cancellationDeadline`, `isWithinDeadline`, `canCancelOnline`,
  `refundOnCancel`, `vietnamToday`); API, web, admin, seed và email gọi chung.
- Lõi huỷ `cancelInLock` chạy trong advisory lock của booking: gọi cổng thanh
  toán TRƯỚC, một CTE ghi SAU (booking CANCELLED, yêu cầu REFUNDED, dòng hoàn
  nếu có, trả ghế, outbox `BOOKING_CANCELLED`). P4e-1 dùng lại cho nút
  "Cancel departure".
- Gỡ: vùng Cancellations của admin, `admin.cancellations.*`, stepper duyệt,
  `CANCELLATION_OPEN`, `refundEstimate`, badge `freeCancellationDays`.
- Báo cáo tháng đổi cặp approved/denied thành huỷ trong hạn và huỷ quá hạn; P&L
  tính tiền giữ lại của booking huỷ quá hạn là doanh thu (ADR-0033 AMEND 2).
- Hai migration: M1 `20260915120000_refund_deadline_expand` (mở rộng) chạy cùng
  đợt này; M2 thu hẹp đi ở nhánh riêng sau khi prod đã seed lại.

**Đóng hai mục CÒN TREO:**

- Chốt chặn đặt chỗ: từ nay `create` và `checkout` bị chặn sau hạn chót của
  chuyến, thay cho đề xuất "chốt chặn 3 ngày" còn treo từ vòng rà 04/09.
- `search_path` của `refunds_sum_within_total()` đã ghim
  (`SET search_path = public, pg_temp`), đóng cảnh báo
  `function_search_path_mutable` của linter Supabase.

**Trạng thái deploy:** M1 chạy lên Supabase ngày `<ngày>`; prod seed lại ngày
`<ngày>` với H = `<ngày>`. M2 và lượt seed 2 ghi ở entry riêng.

**CÒN TREO:** M2 (xoá hai cột `free_cancellation_days`, ba loại email duyệt
huỷ) · lượt seed prod 2 khoảng 03/11 · nợ P4e-1: nút "Cancel departure" mở
`cancelInLock` cho `initiator: 'operator'` và CHECK `end_date >= start_date`
trên `tour_departures`.

**Review findings:** `<số>` — `<liệt kê, hoặc "không có">`.

Tests after: `<số unit>` unit và `<số int>` integration, `pnpm gate:int` xanh.
```

(b) Soát diff `.md` rồi commit:

```bash
git diff -- '*.md' | grep -nE "^[-+]\+" || true
git diff docs/CHANGELOG.md
git add docs/CHANGELOG.md
git commit -m "docs: CHANGELOG hoàn tiền một hạn chót"
```

Expected: lệnh `grep` không in gì; `git diff` chỉ thêm entry mới, KHÔNG đổi một ký tự nào của entry cũ (entry cũ bất biến — chỉ cần mở file trong editor có markdownlint là nó tự sửa dấu `+` và dòng trắng của entry cũ).

(c) Sau khi rebase ở Bước 4, hash trong entry sẽ đổi. Nếu entry có nhắc hash commit của nhánh thì cập nhật rồi `git commit --amend` TRƯỚC khi `merge --ff-only`. Bản mẫu trên chỉ nhắc tên migration và ngày, nên thường không phải sửa.

- [ ] **Bước 1 xong:** entry CHANGELOG đã commit trên nhánh, `git diff` sạch.

---

### Bước 2 — Chạy M1 lên Supabase

Mở MỘT shell prod riêng, dùng suốt bước này. `prisma.config.ts` chỉ đọc `.env`
(qua `dotenv/config`) và repo không có `.env`, nên nếu KHÔNG export thì mọi lệnh
Prisma trỏ Postgres Docker và Supabase không bao giờ nhận migration — đã dính
12/08. Ngược lại, một lần export nhầm trong shell đang chạy `migrate reset` là
reset trúng prod, nên shell này không bao giờ chạy `reset` hay lệnh Docker nào.

```bash
cd apps/api
# `tr -d '\r'`: .env.production sửa trên Windows có thể mang CRLF (đo 15/09) —
# thiếu nó thì giá trị export dính \r ở cuối và chuỗi kết nối hỏng.
export DATABASE_URL="$(grep '^DATABASE_URL=' .env.production | cut -d= -f2- | tr -d '\r')"
echo "${DATABASE_URL%%@*}@…"   # in phần trước @ để mắt xác nhận đúng host pooler
pnpm prisma migrate status
pnpm prisma migrate deploy
pnpm prisma migrate status
```

Expected:
- Chuỗi in ra là **Session pooler** của Supabase: host `…pooler.supabase.com`, cổng **5432**, user `postgres.<ref>`. Cổng **6543** là transaction pooler — CẤM (gốc mọi contortion của Nexora). Thấy 6543 thì dừng, sửa `.env.production`.
- `migrate status` lần đầu in đúng một migration chưa áp: `20260915120000_refund_deadline_expand`.
- `migrate deploy` áp nó, in "1 migration applied".
- `migrate status` lần sau in "Database schema is up to date!".

M1 chỉ THÊM và NỚI (`ADD VALUE` enum, `DROP NOT NULL`, `ALTER FUNCTION … SET search_path`), nên API cũ đang chạy trên Render không hỏng vì nó — đó là lý do bước này đi TRƯỚC.

- [ ] **Bước 2 xong:** `migrate status` trên Supabase in "up to date".

---

### Bước 3 — User tạm tắt tự deploy Vercel cho web và admin

Việc của USER, trên dashboard Vercel, cho CẢ HAI project (web và admin):

Settings → Git → **Ignored Build Step** → chọn *Custom* và đặt lệnh `exit 0`.
Vercel coi mã thoát 0 là "bỏ qua build", nên push vào `main` sẽ không sinh
deployment mới. Ghi lại giá trị cũ của ô đó để Bước 5 trả về đúng như trước.

⚠️ **KHÔNG dùng Pause Project hay Suspend.** Hai thứ đó tắt hẳn site đang chạy,
không phải tắt build — spec §10 nói rõ. Cũng không Disconnect Git repository.

- [ ] **Bước 3 xong:** cả hai project Vercel có Ignored Build Step = `exit 0`; giá trị cũ đã ghi lại.

---

### Bước 4 — Rebase, merge fast-forward, push, chờ CI và Render

```bash
cd <gốc repo>
git switch main && git pull --ff-only
git switch feat/refund-deadline && git rebase main
```

Nếu rebase có xung đột: sửa, `git rebase --continue`; xong thì chạy lại cổng đầy
đủ trên nhánh trước khi merge (rebase có thể làm hỏng thứ cổng cũ đã xanh):

```bash
pnpm test:int --concurrency=2
pnpm turbo run build --concurrency=1
pnpm turbo run typecheck --concurrency=3
pnpm turbo run test --concurrency=2 -- --maxWorkers=4
pnpm lint
node scripts/check-mobile-tokens-only.mjs
./scripts/docs-freshness.sh
```

Expected: bảy lệnh exit 0. `docs-freshness.sh` là lưới của luật 13 — còn commit
`feat`/`fix` mới hơn entry CHANGELOG mới nhất thì nó đỏ, và CI trên `main` cũng
sẽ đỏ vì đúng lý do ấy.

Rồi merge và push:

```bash
git switch main
git merge --ff-only feat/refund-deadline
git push
gh run list --branch main --limit 1
```

Expected: `merge --ff-only` thành công (lịch sử tuyến tính, không merge commit).
`gh run list` in run mới nhất; **chờ tới khi nó `success`** — luật 14. Ruleset
`gate` bị bypass bằng quyền admin mỗi lần push là bình thường, nhưng bypass
không miễn nhìn đèn: `main` từng đỏ âm thầm 31/07→04/08 đúng vì không ai nhìn.

Chờ Render deploy xong API (Render tự deploy khi `main` đổi):

```bash
curl -s https://api.nexora-travel.agency/health
```

Expected: `{"status":"ok","database":"up","uptimeSec":…}` với **`uptimeSec` nhỏ**
(vài chục giây) — chứng cứ tiến trình đã khởi động lại với image mới. `uptimeSec`
còn lớn nghĩa là bản cũ vẫn đang chạy; đợi và gọi lại. `"database":"up"` xác nhận
API mới nói chuyện được với Supabase đã có M1.

- [ ] **Bước 4 xong:** CI `success`, `/health` trả `uptimeSec` nhỏ và `database: up`.

---

### Bước 5 — Bật lại tự deploy Vercel và redeploy cả hai

Việc của USER:

1. Cả hai project: Settings → Git → **Ignored Build Step** → trả về giá trị cũ
   đã ghi ở Bước 3 (thường là *Automatic*).
2. Deployments → deployment mới nhất → **Redeploy**, và **bỏ tick** "Use existing
   Build Cache" — phải build lại với API mới.

Kiểm sau khi cả hai deployment xanh:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://www.nexora-travel.agency/
curl -s -o /dev/null -w '%{http_code}\n' https://www.nexora-travel.agency/tours
```

Expected: cả hai 200. Gọi mỗi URL **hai lần** — stale-while-revalidate trả bản cũ
ở lần đầu. User tự đăng nhập admin và mở `/bookings`, `/outbox`, `/reports`: cả
ba tải được, `/cancellations` ra 404 (đúng — vùng đã gỡ).

- [ ] **Bước 5 xong:** web và admin đã build lại với API mới, các trang trả 200.

---

### Bước 6 — Seed lại prod theo runbook seed spec §8.3

Chạy nguyên runbook `docs/specs/2026-09-14-seed-khung-2026-design.md` §8.3, với
**code seed mới** (Task 12). Tóm tắt để khỏi mở hai file, nhưng §8.3 vẫn là bản
gốc — đọc nó trước khi gõ:

- **Bước 0 — tập dượt Docker với ĐÚNG H của lượt prod**, trong một shell RIÊNG
  mở trước và không bao giờ export `DATABASE_URL` của Supabase: `prisma migrate
  reset` → `db:seed` → `seed:verify` 0 vi phạm. Đóng shell tập dượt khi xong.
- **Lượt prod**, từ `apps/api`, trong MỘT shell prod mới (không lệnh Docker,
  không `prisma migrate` nào trong shell này):

```bash
cd apps/api
export DATABASE_URL="$(grep '^DATABASE_URL=' .env.production | cut -d= -f2- | tr -d '\r')"
export ADMIN_EMAILS="$(grep '^ADMIN_EMAILS=' .env.production | cut -d= -f2- | tr -d '\r')"
export SEED_CUSTOMER_PASSWORD="$(grep '^SEED_CUSTOMER_PASSWORD=' .env.production | cut -d= -f2- | tr -d '\r')"
export SEED_HOM_NAY="$(date -u +%F)"
pnpm snapshot:export
pnpm data:reset
pnpm data:reset -- --apply --toi-biet-day-la-production
pnpm db:seed -- --toi-biet-day-la-production
pnpm seed:verify
```

Expected: `data:reset` chạy khô trước, soát số dòng rồi mới chạy thật;
`seed:verify` **0 vi phạm**, gồm các bất biến mới của ADR-0041 (không `paid_at`
sau hạn chót; huỷ trong hạn đúng một dòng hoàn bằng phần còn lại; huỷ quá hạn
không dòng hoàn; không `REQUESTED`, không `DENIED`); `outbox` 0 PENDING.

Lượt này cũng là thứ dọn sạch dữ liệu cũ mà spec §12 cảnh báo: các yêu cầu
`REQUESTED` còn trên prod từ trước, và các giá trị `free_cancellation_days` đã
chụp. Sau bước này M2 (Phụ lục A) mới chạy được.

**Nghiệm thu sau seed** — gọi mỗi URL hai lần (ISR):

```bash
for u in / /tours /account; do
  curl -s -o /dev/null -w "$u %{http_code}\n" "https://www.nexora-travel.agency$u"
  curl -s -o /dev/null -w "$u %{http_code}\n" "https://www.nexora-travel.agency$u"
done
```

**Nghiệm thu sandbox Stripe (mục CÒN TREO #1 của báo cáo bàn giao, spec §11 và
§14)** — làm trên site thật, bằng tài khoản khách MỚI tạo, không dùng booking
seed (mã thanh toán seed là giả nên trả `REFUND_FAILED`):

1. Đặt một booking trên chuyến còn xa, trả bằng thẻ test Stripe `4242 4242 4242 4242`.
2. Mở `/account/bookings/<code>`: dòng hạn chót in NGÀY cụ thể; bấm huỷ, hộp xác
   nhận là dạng "hoàn đủ" với đúng số tiền.
3. Sau khi xác nhận: booking `Cancelled`, dòng hoàn hiện trên trang booking và
   trên `/bookings/<code>` của admin; Stripe test dashboard có refund tương ứng;
   `/outbox` của admin có dòng `Booking cancelled` trạng thái Sent.
4. Ca không hoàn: mở một booking seed trên chuyến ĐÃ QUA hạn chót, huỷ — không
   dòng hoàn nào, không gọi cổng, email biến thể "không hoàn".
5. Chốt chặn: mở một tour có chuyến đã qua hạn, thấy "Booking closed".

- [ ] **Bước 6 xong:** `seed:verify` 0 vi phạm trên prod; năm mục nghiệm thu ở trên đều đạt.

---

### Bước 7 — Nhánh M2

Chạy nguyên **Phụ lục A** (nhánh `chore/refund-deadline-m2`): migration xoá hai
cột và ba loại email, dọn code, cổng đầy đủ, entry CHANGELOG riêng, rồi merge và
`prisma migrate deploy` lên Supabase.

Điều kiện vào của Phụ lục A chính là Bước 6 đã xong — chốt chặn `DO $$ … RAISE`
trong migration M2 sẽ dừng nếu `outbox` còn dòng mang ba giá trị cũ.

- [ ] **Bước 7 xong:** `prisma migrate status` trên Supabase in "up to date" sau M2; site vẫn 200.

---

### Bước 8 — Lượt seed prod 2, khoảng 03/11

Theo seed spec §8.5, **không sửa code**: chạy lại §8.3 với `SEED_HOM_NAY` = ngày
chạy. Mốc 03/11 đã có test phủ (Task 15 Step 6 chạy `seed:verify` cho đúng mốc
này trên Docker), và code seed lúc đó đã là bản ADR-0041 nên lượt này không phải
dọn gì thêm.

- Booking thử của Bước 6, enquiry và subscriber phát sinh giữa hai lượt sẽ bị xoá
  — đó là chủ ý.
- Freeze 15/10 chỉ cấm nâng dependency và đổi nơi deploy, không cấm thao tác dữ
  liệu.
- Entry `docs/CHANGELOG.md` riêng cho lượt này.

- [ ] **Bước 8 xong:** `seed:verify` 0 vi phạm với H của ngày chạy; entry CHANGELOG đã ghi.

---

### Nếu phải lùi

- **Giữa Bước 2 và Bước 4** (M1 đã chạy, code chưa merge): không cần làm gì. M1
  chỉ thêm một giá trị enum và nới một cột thành nullable; API cũ không đọc cả
  hai. Bỏ dở an toàn.
- **Sau Bước 4, trước Bước 5** (API mới, web/admin cũ): đây chính là khoảng mà
  Bước 3 sinh ra để rút ngắn. Web cũ gọi API mới có thể thiếu field nó chờ; xử
  lý là đi tiếp Bước 5 chứ không lùi.
- **Sau Bước 5:** lùi nghĩa là revert commit merge trên `main` rồi redeploy cả
  ba. M1 KHÔNG cần lùi (code cũ chạy được với schema đã nới). Đừng viết migration
  gỡ M1: giá trị enum đã thêm không xoá được bằng `ALTER TYPE`, và `reason`
  NOT NULL trở lại sẽ chặn chính các dòng mà code mới vừa ghi.
- **Sau Bước 7 (M2 đã chạy):** không còn đường lùi bằng code cũ — code cũ đọc
  hai cột đã xoá. Đó là lý do M2 đi sau cùng, sau khi bản mới đã sống qua một
  lượt seed và một vòng nghiệm thu.
