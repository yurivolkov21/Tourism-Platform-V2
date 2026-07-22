# Vòng đời PENDING (BK-1 · BK-2 · PAY-1 · WRK-1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans, task-by-task. Steps dùng checkbox `- [ ]`.

**Goal:** Đưa booking PENDING mồ côi về terminal theo [ADR-0006](../adr/0006-pending-lifecycle.md) (Accepted) —
webhook expired→CANCELLED, cron sweep backstop, checkout phục hồi được (CHECKOUT_FAILED + re-checkout), khách tự hủy PENDING.

**Architecture:** Ba lớp phòng thủ đưa PENDING→CANCELLED, **đều gate `status='PENDING'`** nên idempotent với nhau:
(1) webhook `payment.expired`, (2) cron sweep TTL 30′, (3) khách tự hủy. Cộng checkout-resilience ở đường create.
Không đụng `seats_booked` (PENDING không giữ ghế). Không migration (dùng cột/enum sẵn có).

**Tech Stack:** oRPC contract (zod) · NestJS 11 · Prisma 7 · pg-boss (worker process) · Vitest int (PG `tourism_test`, FakeGateway).

## Global Constraints (áp cho MỌI task)

- Comment tiếng Việt (#8); Conventional Commits KHÔNG AI attribution (#12); TDD (#4).
- Không migration. Mọi cancel gate `status='PENDING'` (idempotent 3 lớp).
- `pnpm gate:int` 1 lần cuối branch (#11); docs sweep #13 khi merge. Branch: `feat/pending-lifecycle`.

## File Structure

- `apps/api/src/modules/payments/gateway.ts` — `VerifiedEvent.type` +`'payment.expired'`.
- `apps/api/src/modules/payments/stripe.gateway.ts` — tách `checkout.session.expired`.
- `apps/api/src/modules/payments/fake.gateway.ts` — `emitCheckoutExpired`.
- `apps/api/src/modules/payments/payments.service.ts` — `handleEvent` route `payment.expired` → cancel.
- `apps/api/src/worker/pending-sweep.service.ts` (MỚI) — sweep abandoned PENDING.
- `apps/api/src/worker/worker.module.ts` + `apps/api/src/worker.ts` — queue `booking-sweep`.
- `libs/shared/contract/src/contract.ts` — `bookings.create` +CHECKOUT_FAILED; +`bookings.checkout`, +`bookings.cancelPending`.
- `apps/api/src/modules/bookings/bookings.service.ts` — try/catch create; `reCheckout`, `cancelPending`.
- `apps/api/src/modules/bookings/bookings.controller.ts` — 2 procedure mới + map error.
- Tests: `payments.int.spec.ts`, `pending-sweep.int.spec.ts` (MỚI), `bookings.int.spec.ts`.

---

### Task 1 (PT1): PAY-1 — `payment.expired` → cancel PENDING

**Files:** `gateway.ts`, `stripe.gateway.ts`, `fake.gateway.ts`, `payments.service.ts`; Test `payments.int.spec.ts`.

**Interfaces produces:** `VerifiedEvent.type` gồm `'payment.expired'`; `FakeGateway.emitCheckoutExpired(bookingId, opts?)`.

- [ ] **Step 1: Viết test đỏ** (`payments.int.spec.ts`) — PENDING + webhook expired → CANCELLED:
```ts
it('PAY-1: checkout.session.expired trên PENDING → CANCELLED, không đụng ghế', async () => {
  const cookie = await signUpUser('expire@example.com');
  const booking = await createBooking(cookie); // PENDING, party 3
  const res = await postWebhook(fake.emitCheckoutExpired(booking.id));
  expect(res.statusCode).toBe(200);
  expect(res.json()).toMatchObject({ status: 'processed', outcome: 'expired' });
  const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
  expect(row.status).toBe(BookingStatus.CANCELLED);
  expect(row.cancelledAt).not.toBeNull();
  expect(await seatsOf(depMain.id)).toBe(3); // seatsBooked ban đầu, không đổi
  // Idempotent: gửi lại eventId mới → vẫn CANCELLED, không lỗi.
  const again = await postWebhook(fake.emitCheckoutExpired(booking.id, { eventId: 'evt_exp_2' }));
  expect(again.statusCode).toBe(200);
  expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(BookingStatus.CANCELLED);
});
```
- [ ] **Step 2: Run → FAIL** (chưa có type/route). Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/payments/payments.int.spec.ts -t "PAY-1"`
- [ ] **Step 3: Thêm type** (`gateway.ts`): `type: 'payment.completed' | 'payment.failed' | 'payment.expired' | 'other';`
- [ ] **Step 4: Tách map Stripe** (`stripe.gateway.ts:210-216`):
```ts
    case 'checkout.session.expired':
      return { ...base, type: 'payment.expired', ...(bookingId ? { bookingId } : {}) };
    case 'payment_intent.payment_failed':
      return { ...base, type: 'payment.failed', ...(bookingId ? { bookingId } : {}) };
```
- [ ] **Step 5: FakeGateway** (`fake.gateway.ts`) — thêm helper:
```ts
  emitCheckoutExpired(bookingId: string, opts: FakeEmitOptions = {}): VerifiedEvent {
    return this.emit('payment.expired', bookingId, opts);
  }
```
  (Mở rộng union tham số `type` của private `emit` để nhận `'payment.expired'`.)
- [ ] **Step 6: Route handler** (`payments.service.ts` `handleEvent`, thêm case sau `payment.failed`):
```ts
      case 'payment.expired': {
        if (verified.bookingId) {
          outcome = await this.cancelExpiredPending(verified.bookingId);
        }
        break;
      }
```
  Thêm method (gate `status='PENDING'`, một statement nguyên tử, không đụng seats):
```ts
  /** PAY-1: PENDING hết hạn checkout → CANCELLED. Gate status='PENDING' nên
   * idempotent với cron sweep + retry (booking đã CANCELLED → 0 row → no-op). */
  private async cancelExpiredPending(bookingId: string): Promise<ClaimOutcome> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE bookings SET status = 'CANCELLED'::"BookingStatus", cancelled_at = now(), updated_at = now()
      WHERE id = ${bookingId}::uuid AND status = 'PENDING'::"BookingStatus"
      RETURNING id
    `);
    if (rows.length > 0) this.logger.log(`Booking ${bookingId} expired → CANCELLED`);
    return 'expired';
  }
```
  (Thêm `'expired'` vào type `ClaimOutcome` ở `bookings.service.ts`.)
- [ ] **Step 7: Run → PASS.**
- [ ] **Step 8: Commit:** `feat(api): webhook payment.expired → hủy PENDING (PAY-1, ADR-0006)`

---

### Task 2 (PT2): WRK-1 — cron sweep abandoned PENDING

**Files:** Create `apps/api/src/worker/pending-sweep.service.ts`; Modify `worker.module.ts`, `worker.ts`; Create Test `apps/api/src/worker/pending-sweep.int.spec.ts`.

**Interfaces produces:** `PendingSweepService.sweepAbandoned(ttlMinutes: number): Promise<number>` (số booking bị hủy).

- [ ] **Step 1: Viết test đỏ** (`pending-sweep.int.spec.ts`) — PENDING cũ >30′ bị hủy, mới thì không:
```ts
it('WRK-1: hủy PENDING cũ hơn TTL, giữ PENDING mới + không đụng PAID', async () => {
  // seed: 1 PENDING createdAt 40′ trước, 1 PENDING mới, 1 PAID cũ (raw insert đặt created_at)
  const old = await seedPending({ minutesAgo: 40 });
  const fresh = await seedPending({ minutesAgo: 5 });
  const paid = await seedPaid({ minutesAgo: 60 });
  const n = await app.get(PendingSweepService).sweepAbandoned(30);
  expect(n).toBe(1);
  expect((await status(old)).status).toBe('CANCELLED');
  expect((await status(fresh)).status).toBe('PENDING');
  expect((await status(paid)).status).toBe('PAID');
});
```
  *(Helper `seedPending`/`seedPaid` set `created_at` bằng `$executeRaw` để test độc lập thời gian thực; mượn pattern seed của reviews.int.spec.)*
- [ ] **Step 2: Run → FAIL** (chưa có service).
- [ ] **Step 3: Viết service** (`pending-sweep.service.ts`):
```ts
import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../auth/auth.config.js';
import { Prisma } from '../generated/prisma/client.js';

/** WRK-1 (ADR-0006): backstop khi webhook expired rớt. Hủy mọi PENDING quá TTL
 * (mặc định 30′ = hạn Stripe Checkout). Gate status='PENDING' → idempotent với
 * webhook cancel; không đụng seats_booked (PENDING không giữ ghế). */
@Injectable()
export class PendingSweepService {
  private readonly logger = new Logger(PendingSweepService.name);
  async sweepAbandoned(ttlMinutes: number): Promise<number> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE bookings SET status = 'CANCELLED'::"BookingStatus", cancelled_at = now(), updated_at = now()
      WHERE status = 'PENDING'::"BookingStatus"
        AND created_at < now() - make_interval(mins => ${ttlMinutes})
      RETURNING id
    `);
    if (rows.length > 0) this.logger.log(`Swept ${rows.length} abandoned PENDING booking(s) → CANCELLED`);
    return rows.length;
  }
}
```
- [ ] **Step 4: Provide** (`worker.module.ts`): thêm `PendingSweepService` vào `providers` + `exports`.
- [ ] **Step 5: Wire queue** (`worker.ts`): thêm hằng + queue (mẫu giống outbox):
```ts
const BOOKING_SWEEP_QUEUE = 'booking-sweep';
const BOOKING_SWEEP_CRON = '*/10 * * * *'; // mỗi 10′
const PENDING_TTL_MINUTES = 30; // khớp hạn Stripe Checkout
// … trong bootstrap, sau outbox-purge:
const sweep = app.get(PendingSweepService);
await boss.createQueue(BOOKING_SWEEP_QUEUE, { policy: 'short' });
await boss.work(BOOKING_SWEEP_QUEUE, async () => { await sweep.sweepAbandoned(PENDING_TTL_MINUTES); });
await boss.schedule(BOOKING_SWEEP_QUEUE, BOOKING_SWEEP_CRON);
```
- [ ] **Step 6: Run → PASS.**
- [ ] **Step 7: Commit:** `feat(api): cron sweep hủy PENDING bỏ hoang >30′ (WRK-1, ADR-0006)`

---

### Task 3 (PT3): BK-1 — CHECKOUT_FAILED + re-checkout

**Files:** `contract.ts`, `bookings.service.ts`, `bookings.controller.ts`; Test `bookings.int.spec.ts`.

**Interfaces produces:** contract error `CHECKOUT_FAILED` (502) trên `bookings.create`; procedure `bookings.checkout`.

- [ ] **Step 1: Viết test đỏ** — gateway lỗi lúc create → 502 CHECKOUT_FAILED (không 500); re-checkout mint lại:
```ts
it('BK-1: gateway lỗi lúc create → 502 CHECKOUT_FAILED, booking PENDING; re-checkout mint session', async () => {
  const cookie = await signUpUser('bk1@example.com');
  fake.failCheckout = true; // toggle mới trên FakeGateway
  const res = await createBookingRaw(cookie); // không assert 200
  expect(res.statusCode).toBe(502);
  expect(res.json()).toMatchObject({ code: 'CHECKOUT_FAILED' });
  // Booking PENDING đã tồn tại (owner thấy được) nhưng chưa có session.
  const list = await app.inject({ method: 'GET', url: '/api/bookings', headers: { cookie } });
  const code = list.json().items[0].code;
  fake.failCheckout = false;
  const retry = await app.inject({ method: 'POST', url: `/api/bookings/${code}/checkout`, headers: { cookie } });
  expect(retry.statusCode).toBe(200);
  expect(retry.json().checkoutUrl).toMatch(/^https:\/\/checkout\.fake\.local\//);
});
```
  *(Thêm `FakeGateway.failCheckout` + ném trong `createCheckoutSession`; reset trong `reset()`.)*
- [ ] **Step 2: Run → FAIL** (create ném 500; không procedure checkout).
- [ ] **Step 3: Contract** (`contract.ts`) — thêm vào `bookings.create.errors`:
```ts
        CHECKOUT_FAILED: { status: 502, message: 'Checkout could not be started, please retry' },
```
  Thêm procedure `bookings.checkout` (sau `byCode`):
```ts
    checkout: oc
      .route({ method: 'POST', path: '/api/bookings/{code}/checkout', summary: 'Re-mint checkout session for an own PENDING booking (authed)' })
      .input(z.object({ code: BookingCodeSchema }))
      .errors({
        NOT_FOUND: { message: 'Booking not found' },
        NOT_PENDING: { status: 422, message: 'Only a PENDING booking can be checked out' },
        CHECKOUT_FAILED: { status: 502, message: 'Checkout could not be started, please retry' },
      })
      .output(BookingSchema),
```
- [ ] **Step 4: Service** (`bookings.service.ts`) — bọc create try/catch + tách helper mint + `reCheckout`:
```ts
  // trong create(): thay await trần bằng
    let session: CheckoutSession;
    try {
      session = await gateway.createCheckoutSession({ /* như cũ */ });
    } catch (err) {
      this.logger.error(`Checkout mint failed for ${booking.code}: ${err instanceof Error ? err.message : 'unknown'}`);
      throw new CheckoutFailedError(); // booking ở lại PENDING không session — re-checkout phục hồi
    }
  // method mới:
  async reCheckout(userId: string, code: string): Promise<Booking> {
    const booking = await prisma.booking.findUnique({ where: { code } });
    if (!booking || booking.userId !== userId) throw new BookingNotFoundError(code);
    if (booking.status !== BookingStatus.PENDING) throw new BookingNotPendingError();
    const gateway = resolveGateway(this.gateways, booking.paymentProvider);
    let session: CheckoutSession;
    try {
      session = await gateway.createCheckoutSession({ bookingId: booking.id, code: booking.code, amount: booking.totalAmount.toFixed(2), currency: booking.currency, description: `${booking.tourTitle} …`, successUrl: `${env.FRONTEND_URL}/checkout/success?code=${booking.code}`, cancelUrl: `${env.FRONTEND_URL}/checkout/cancel?code=${booking.code}` });
    } catch { throw new CheckoutFailedError(); }
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { providerSessionId: session.sessionId } });
    return toBooking(updated, session.checkoutUrl);
  }
```
  Thêm error class `CheckoutFailedError`, `BookingNotPendingError` (cạnh các error booking hiện có).
- [ ] **Step 5: Controller** (`bookings.controller.ts`) — map `CheckoutFailedError`→`CHECKOUT_FAILED` trên create; thêm `@Implement(contract.bookings.checkout)` gọi `reCheckout`, map `BookingNotFoundError`→NOT_FOUND, `BookingNotPendingError`→NOT_PENDING, `CheckoutFailedError`→CHECKOUT_FAILED.
- [ ] **Step 6: Run → PASS.**
- [ ] **Step 7: Commit:** `feat(api): CHECKOUT_FAILED typed + re-checkout PENDING (BK-1, ADR-0006)`

---

### Task 4 (PT4): BK-2 — `bookings.cancelPending`

**Files:** `contract.ts`, `bookings.service.ts`, `bookings.controller.ts`; Test `bookings.int.spec.ts`.

- [ ] **Step 1: Viết test đỏ** — chủ hủy PENDING → CANCELLED; PAID → 422; người khác → 404:
```ts
it('BK-2: chủ tự hủy PENDING → CANCELLED (không refund); PAID → 422; non-owner → 404', async () => {
  const alice = await signUpUser('bk2@example.com');
  const booking = await createBooking(alice); // PENDING
  const res = await app.inject({ method: 'POST', url: `/api/bookings/${booking.code}/cancel-pending`, headers: { cookie: alice } });
  expect(res.statusCode).toBe(200);
  expect(res.json().status).toBe('CANCELLED');
  const paid = await createPaidBooking(alice);
  expect((await app.inject({ method: 'POST', url: `/api/bookings/${paid.code}/cancel-pending`, headers: { cookie: alice } })).statusCode).toBe(422);
  const mallory = await signUpUser('mallory-bk2@example.com');
  expect((await app.inject({ method: 'POST', url: `/api/bookings/${booking.code}/cancel-pending`, headers: { cookie: mallory } })).statusCode).toBe(404);
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Contract** — procedure `bookings.cancelPending`:
```ts
    cancelPending: oc
      .route({ method: 'POST', path: '/api/bookings/{code}/cancel-pending', summary: 'Owner cancels an unpaid PENDING booking (authed)' })
      .input(z.object({ code: BookingCodeSchema }))
      .errors({ NOT_FOUND: { message: 'Booking not found' }, NOT_PENDING: { status: 422, message: 'Only a PENDING booking can be cancelled this way' } })
      .output(BookingSchema),
```
- [ ] **Step 4: Service** (`bookings.service.ts`):
```ts
  /** BK-2: chủ hủy PENDING chưa trả (không refund — chưa charge). Gate owner +
   * status='PENDING' (atomic); PAID/CANCELLED → 0 row → NOT_PENDING. */
  async cancelPending(userId: string, code: string): Promise<Booking> {
    const booking = await prisma.booking.findUnique({ where: { code } });
    if (!booking || booking.userId !== userId) throw new BookingNotFoundError(code);
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE bookings SET status='CANCELLED'::"BookingStatus", cancelled_at=now(), updated_at=now()
      WHERE id=${booking.id}::uuid AND status='PENDING'::"BookingStatus" RETURNING id
    `);
    if (rows.length === 0) throw new BookingNotPendingError();
    const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    return toBooking(updated, null);
  }
```
- [ ] **Step 5: Controller** — `@Implement(contract.bookings.cancelPending)` → `cancelPending`, map errors.
- [ ] **Step 6: Run → PASS.**
- [ ] **Step 7: Commit:** `feat(api): bookings.cancelPending — khách tự hủy PENDING (BK-2, ADR-0006)`

---

### Task 5 (PT5): Dọn comment + booking-states + gate:int + merge

- [ ] **Step 1:** Dọn 2 comment nói dối: `bookings.service.ts:192-195` (giờ có try/catch + re-checkout thật) + comment W2-sweep trong `payments.service.ts` — sửa cho khớp cơ chế PAY-1/WRK-1.
- [ ] **Step 2:** Cập nhật `docs/conventions/booking-states.md`: thêm transition "PENDING expired/abandoned/self-cancel → CANCELLED".
- [ ] **Step 3:** `pnpm gate:int` toàn repo → xanh.
- [ ] **Step 4:** Docs sweep #13: CHANGELOG (ngày · hash range · BK-1/BK-2/PAY-1/WRK-1 · số test) + README map plan status → ✅.
- [ ] **Step 5:** Rebase main → `merge --ff-only` → push (xác nhận user, #2). Xóa branch.

## Self-Review (đã chạy)

- **Spec coverage:** PAY-1 (T1) · WRK-1 (T2) · BK-1 (T3) · BK-2 (T4) · comment+states (T5). ✓
- **Idempotency:** cả 3 đường cancel gate `status='PENDING'` → chồng nhau vô hại; capture-đến-muộn sau CANCELLED đã được PAY-R1 fresh-refund guard lo (ADR-0009). ✓
- **Type consistency:** `ClaimOutcome` +`'expired'` (T1) dùng ở handleEvent; `CheckoutFailedError`/`BookingNotPendingError` (T3) tái dùng T4; `payment.expired` (T1) map từ Stripe + Fake. ✓
- **Không migration** (enum BookingStatus.CANCELLED + cột cancelled_at sẵn có). ✓
