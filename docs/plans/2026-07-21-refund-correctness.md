# Refund correctness (BK-R1 / PAY-R1 / TOCTOU) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development hoặc
> superpowers:executing-plans, task-by-task. Steps dùng checkbox `- [ ]`.

**Goal:** Chống double-refund đồng thời (BK-R1) + overbook re-derive khi retry (PAY-R1) +
TOCTOU auto-refund — theo [ADR-0009](../adr/0009-refund-correctness.md).

**Architecture:** Serialize refund per-booking bằng `pg_advisory_xact_lock` trong interactive
transaction bao `read→gateway→ledger` (ngoại lệ có chủ đích của "gateway ngoài tx", cho
admin-refund hiếm). Trigger DB `SUM(refunds) ≤ total` làm lưới cứng. Gate `refundOrphanedCapture`
trên `paid_at IS NOT NULL`.

**Tech Stack:** NestJS 11 · Prisma 7 (driver adapter pg, pool ~10) · Postgres (advisory lock +
plpgsql trigger) · Vitest int (PG `tourism_test`).

## Global Constraints (áp cho MỌI task)

- Comment tiếng Việt (#8); Conventional Commits KHÔNG AI attribution (#12).
- **TDD** + mutation-test cho logic money (gỡ lock/gate → test ĐỎ).
- **KHÔNG sửa migration.sql đã apply** — `prisma migrate dev --create-only` tạo file mới cho SQL thuần (trigger).
- Postgres session pooler (advisory lock OK); pool ~10.
- Không chạy `gate:int` sau mỗi step; 1 lần cuối branch (#11).
- Money = Decimal; ledger append-only; không đụng đường claim/oversell (giữ nguyên).

## File Structure

- `apps/api/prisma/migrations/<ts>_refunds_sum_trigger/migration.sql` (MỚI) — trigger SUM≤total.
- `apps/api/src/modules/bookings/refund-lock.ts` (MỚI) — helper `withBookingRefundLock(fn)` gói interactive-tx + advisory lock.
- `apps/api/src/modules/bookings/refunds.service.ts` — `refundByAdmin` dùng lock; ledger vào tx.
- `apps/api/src/modules/bookings/cancellations.service.ts` — nhánh approve-refund dùng lock.
- `apps/api/src/modules/payments/payments.service.ts` — `refundOrphanedCapture` gate `paid_at`.
- Tests: `refunds.int.spec.ts`, `cancellations.int.spec.ts`, `payments.int.spec.ts`, + `refund-lock` int.

---

### Task 1: Migration — trigger `SUM(refunds) ≤ total`

**Files:** Create `apps/api/prisma/migrations/<ts>_refunds_sum_trigger/migration.sql`.

- [ ] **Step 1: Viết test đỏ** (thêm vào `refunds.int.spec.ts`) — insert refund vượt total bị chặn:
```ts
it('trigger: insert refund làm SUM > total → bị chặn (BK-R1 defense)', async () => {
  const booking = await createPaidBooking(await signUpUser('sum@example.com', 'S')); // total 117.00
  await prisma.refund.create({ data: { bookingId: booking.id, amount: '100.00', currency: 'USD', providerRefundId: 'r1' } });
  await expect(
    prisma.refund.create({ data: { bookingId: booking.id, amount: '50.00', currency: 'USD', providerRefundId: 'r2' } }),
  ).rejects.toThrow(); // 100+50 > 117
});
```
- [ ] **Step 2: Run → FAIL** (chưa có trigger, insert thứ 2 thành công).
Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/bookings/refunds.int.spec.ts -t "trigger"`
- [ ] **Step 3: Tạo migration rỗng + viết SQL:**
Run: `pnpm --filter @tourism/api exec prisma migrate dev --create-only --name refunds_sum_trigger`
Rồi viết vào `migration.sql`:
```sql
-- BK-R1 (ADR-0009): SUM(refunds) mỗi booking không được vượt total_amount. Lưới
-- cứng ở tầng DB — dù code quên advisory lock, ledger vẫn không thể vượt total.
CREATE OR REPLACE FUNCTION refunds_sum_within_total() RETURNS trigger AS $$
DECLARE
  booking_total numeric(14,2);
  refunded_sum  numeric(14,2);
BEGIN
  SELECT total_amount INTO booking_total FROM bookings WHERE id = NEW.booking_id;
  SELECT COALESCE(SUM(amount), 0) INTO refunded_sum FROM refunds WHERE booking_id = NEW.booking_id;
  IF refunded_sum + NEW.amount > booking_total THEN
    RAISE EXCEPTION 'refunds SUM %.2f + %.2f exceeds booking total %.2f (booking %)',
      refunded_sum, NEW.amount, booking_total, NEW.booking_id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refunds_sum_within_total BEFORE INSERT ON refunds
  FOR EACH ROW EXECUTE FUNCTION refunds_sum_within_total();
```
- [ ] **Step 4: Apply + run → PASS.**
Run: `pnpm --filter @tourism/api exec prisma migrate dev` (apply); rồi lại vitest -t "trigger" → PASS.
- [ ] **Step 5: Commit:** `git commit -am "feat(api): trigger SUM(refunds) ≤ total (BK-R1, ADR-0009)"`

---

### Task 2: `withBookingRefundLock` helper + BK-R1 trong `refundByAdmin`

**Files:** Create `apps/api/src/modules/bookings/refund-lock.ts`; Modify `refunds.service.ts:97-177`; Test `refunds.int.spec.ts`.

**Interfaces:**
- Produces: `withBookingRefundLock<T>(bookingId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>`
  — interactive tx (timeout 20s), lấy `pg_advisory_xact_lock(hashtextextended(bookingId,0))` TRƯỚC rồi chạy `fn(tx)`; lock tự nhả lúc commit.

- [ ] **Step 1: Viết test đỏ** (concurrent refund‖refund → không vượt total; cái thứ 2 error):
```ts
it('BK-R1: hai admin refund full ĐỒNG THỜI → đúng 1 refund, cái thứ 2 báo hết phần (advisory lock)', async () => {
  const admin = await signUpAdmin();
  const booking = await createPaidBooking(await signUpUser('bk-r1@example.com', 'A')); // 117.00
  const [r1, r2] = await Promise.allSettled([
    postRefund(admin, booking.code, {}), // full
    postRefund(admin, booking.code, {}), // full, đồng thời
  ]);
  const codes = [r1, r2].map((r) => (r.status === 'fulfilled' ? r.value.statusCode : 0)).sort();
  expect(codes).toEqual([200, 422]); // một thành công, một RefundNothingLeft
  const refunds = await prisma.refund.findMany({ where: { bookingId: booking.id } });
  expect(refunds).toHaveLength(1);
  expect(fake.refunds).toHaveLength(1); // gateway gọi ĐÚNG một lần
});
```
- [ ] **Step 2: Run → FAIL** (không lock → 2 refund / [200,200], fake.refunds length 2).
- [ ] **Step 3: Viết `refund-lock.ts`:**
```ts
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Serialize refund/cancel per-booking (BK-R1, ADR-0009). Interactive tx bao advisory
 * xact-lock + toàn bộ read→gateway→ledger; lock tự nhả lúc commit. Timeout 20s > 15s
 * HTTP timeout. NGOẠI LỆ có chủ đích của "gateway ngoài tx" — chỉ đường refund hiếm.
 */
export async function withBookingRefundLock<T>(
  bookingId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${bookingId}, 0))`;
      return fn(tx);
    },
    { timeout: 20_000, maxWait: 5_000 },
  );
}
```
- [ ] **Step 4: Refactor `refundByAdmin`** — bọc read+classify+gateway+ledger trong `withBookingRefundLock`, dùng `tx` cho MỌI query (findUnique/aggregate/refund.create/booking.update/outbox.create), re-đọc ledger SAU khi có lock:
```ts
  async refundByAdmin(adminUserId, bookingCode, input): Promise<AdminRefundResult> {
    const pre = await prisma.booking.findUnique({ where: { code: bookingCode }, select: { id: true } });
    if (!pre) throw new BookingNotFoundError(bookingCode);
    const updated = await withBookingRefundLock(pre.id, async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: pre.id } });
      // ... status gates (REFUNDED/refundable) như cũ ...
      const ledger = await tx.refund.aggregate({ where: { bookingId: booking.id }, _sum: { amount: true } });
      const alreadyRefunded = ledger._sum.amount ?? new Prisma.Decimal(0);
      const { kind, amount } = classifyRefundAmount({ requested: input.amount ?? null, total: booking.totalAmount, alreadyRefunded });
      const providerRefundId = await this.executeGatewayRefund({ ...booking, providerPaymentId: booking.providerPaymentId! }, amount, `refund:${booking.id}:${alreadyRefunded.toFixed(2)}`);
      const nextStatus = deriveStatusAfterRefund(alreadyRefunded.add(amount), booking.totalAmount);
      const refundRow = await tx.refund.create({ data: { bookingId: booking.id, amount, currency: booking.currency, providerRefundId, adminId: adminUserId } });
      const row = await tx.booking.update({ where: { id: booking.id }, data: { status: nextStatus } });
      await tx.outbox.create({ data: { type: EmailType.BOOKING_REFUNDED, payload: { /* như cũ */ }, dedupeKey: `refund:${booking.id}:${refundRow.id}` } });
      return row;
    });
    return { booking: toBooking(updated, null), refunds: await this.historyForBooking(bookingCode) };
  }
```
*(Giữ nguyên `classifyRefundAmount`/`deriveStatusAfterRefund`/`executeGatewayRefund`. `executeGatewayRefund` gọi HTTP — chạy trong tx là ngoại lệ ADR-0009. Status gates giữ nguyên thứ tự.)*
- [ ] **Step 5: Run → PASS** ([200,422], 1 refund, 1 gateway call).
- [ ] **Step 6: Mutation-test** — tạm thay `withBookingRefundLock(pre.id, fn)` bằng `fn(prisma)` (bỏ lock) → test BK-R1 phải ĐỎ ([200,200]/2 refunds). Khôi phục.
- [ ] **Step 7: Commit:** `git commit -am "feat(api): advisory-lock serialize refundByAdmin (BK-R1, ADR-0009)"`

---

### Task 3: BK-R1 trong `cancellations.approve` (nhánh refund)

**Files:** Modify `cancellations.service.ts` (nhánh approve gọi `executeGatewayRefund` ~360-400); Test `cancellations.int.spec.ts`.

**Interfaces:** Consumes `withBookingRefundLock` (Task 2).

- [ ] **Step 1: Viết test đỏ** — refundByAdmin ‖ cancel-approve ĐỒNG THỜI trên cùng booking → đúng 1 full refund:
```ts
it('BK-R1 cross-path: admin refund ‖ cancel-approve đồng thời → đúng 1 refund, không vượt total', async () => {
  const admin = await signUpAdmin();
  const cust = await signUpUser('cross@example.com', 'C');
  const booking = await createPaidBooking(cust); // 117.00
  const reqId = await createCancellationRequest(cust, booking.code); // W4 request
  const [a, b] = await Promise.allSettled([
    postRefund(admin, booking.code, {}),                 // admin full refund
    postCancellationDecide(admin, reqId, 'approve'),     // cancel-approve (cũng full refund)
  ]);
  const refunds = await prisma.refund.findMany({ where: { bookingId: booking.id } });
  expect(refunds).toHaveLength(1);       // đúng một refund
  expect(fake.refunds).toHaveLength(1);  // gateway một lần
  // một trong hai thất bại (RefundNothingLeft / NOT_CANCELLABLE tùy thứ tự)
  const oks = [a, b].filter((r) => r.status === 'fulfilled' && r.value.statusCode === 200);
  expect(oks).toHaveLength(1);
});
```
*(Dùng helper tạo cancellation-request + decide có sẵn trong spec; nếu chưa có, mượn từ pattern cancellations.int.spec hiện tại.)*
- [ ] **Step 2: Run → FAIL** (không lock trên cancel-path → 2 refund).
- [ ] **Step 3: Bọc nhánh refund của `approve`** trong `withBookingRefundLock(booking.id, async (tx) => {...})` — đọc booking+ledger, re-check còn refund được, `executeGatewayRefund`, ghi Refund+update+outbox qua `tx`. Nếu ledger đã đủ total → ném `RefundNothingLeftError` (không gọi gateway).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit:** `git commit -am "feat(api): advisory-lock serialize cancel-approve refund (BK-R1, ADR-0009)"`

---

### Task 4: PAY-R1 — gate `refundOrphanedCapture` trên `paid_at`

**Files:** Modify `payments.service.ts:246-295` (`refundOrphanedCapture`); Test `payments.int.spec.ts`.

**Interfaces:** không mới.

- [ ] **Step 1: Viết test đỏ** — overbook-cancelled (paid_at NULL) + capture retry → GIỮ CANCELLED, không refund/email lần 2:
```ts
it('PAY-R1: overbook-cancelled rồi capture retry → GIỮ CANCELLED, không refund/email lần 2', async () => {
  // dựng booking overbooked: create party vừa soft-check, đổ đầy depTight, rồi completed → overbook auto-refund → CANCELLED (paid_at NULL)
  // ... (theo pattern test overbook hiện có) ...
  const first = await postWebhook(fake.emitPaymentCompleted(bookingId));   // → overbook → CANCELLED + 1 refund
  const retry = await postWebhook(fake.emitPaymentCompleted(bookingId, { eventId: 'evt-new' })); // eventId MỚI → không dedup
  const row = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  expect(row.status).toBe('CANCELLED');  // KHÔNG re-derive REFUNDED
  const refunds = await prisma.refund.findMany({ where: { bookingId } });
  expect(refunds).toHaveLength(1);       // đúng một refund (overbook), không thêm orphan
  const emails = await prisma.outbox.count({ where: { type: EmailType.BOOKING_REFUNDED } });
  expect(emails).toBe(1);                // email refund một lần
});
```
- [ ] **Step 2: Run → FAIL** (retry vào orphan → re-derive REFUNDED + refund/email lần 2).
- [ ] **Step 3: Gate re-derive theo fresh-refund** (ADR-0009 sửa đổi — KHÔNG dùng `paid_at`, nó không phân biệt được overbook-retry với orphan thật, cả hai đều NULL). Chỉ re-derive khi `issueFullAutoRefund` trả `'refunded'` (phát MỚI); `'already-refunded'` → giữ terminal, không re-derive/email:
```ts
  private async refundOrphanedCapture(provider, bookingId, providerPaymentId): Promise<void> {
    const refund = await this.issueFullAutoRefund(provider, bookingId, providerPaymentId, { cause: 'orphaned capture', idempotencyKey: `orphan-refund:${bookingId}` });
    if (refund !== 'refunded') {
      // 'failed' → operator; 'already-refunded' → booking đã có refund từ path KHÁC
      // (overbook auto-refund / W4 cancel-approve): terminal của nó KHÔNG phải orphan
      // này quản → giữ nguyên (CANCELLED), không re-derive REFUNDED, không email (PAY-R1).
      return;
    }
    // ... phần còn lại giữ nguyên (đọc ledger + CTE re-derive REFUNDED) ...
  }
```
- [ ] **Step 4: Run → PASS.** Chạy full payments.int.spec — ca orphaned-capture THẬT (refund fresh) vẫn REFUNDED; PAY-R1 (overbook + duplicate webhook) giữ CANCELLED.
- [ ] **Step 5: Mutation-test** — tạm đổi `if (refund !== 'refunded') return` thành `if (refund === 'failed') return` (re-derive cả trên already-refunded, tức bug cũ) → test PAY-R1 phải ĐỎ. Khôi phục.
- [ ] **Step 6: Commit:** `git commit -m "fix(api): gate orphan re-derive theo fresh-refund — overbook/W4-cancelled không sống dậy (PAY-R1, ADR-0009)"`

---

### Task 5: TOCTOU auto-refund + docs sweep

**Files:** `payments.service.ts` (`issueFullAutoRefund` re-check); docs.

- [ ] **Step 1:** Xác nhận `issueFullAutoRefund` + CTE đã gate trên `status='PENDING'`/`'CANCELLED'` (idempotent). PAY-R1 (Task 4) đã đóng ca chính. Nếu còn cửa sổ: thêm re-check `status` claimable ngay trước gateway (đọc code hiện tại quyết định — KHÔNG thêm nếu đã idempotent). Test concurrent duplicate auto-refund → 1 refund (nếu chưa có).
- [ ] **Step 2:** `pnpm gate:int` toàn repo → xanh.
- [ ] **Step 3:** Docs sweep #13: CHANGELOG (ngày · hash range · BK-R1/PAY-R1/TOCTOU · số test). ADR-0009 + README-map đã có.
- [ ] **Step 4:** Rebase main → `merge --ff-only` → push (xác nhận user, #2). Cập nhật ADR-0006 nếu sub-project A làm sau.

## Self-Review (đã chạy)

- **Spec coverage:** BK-R1 (Task 1 trigger + Task 2/3 lock) · PAY-R1 (Task 4 gate) · TOCTOU (Task 5) · money-integrity không đụng claim/oversell. ✓
- **Placeholder scan:** helper `createCancellationRequest`/`postCancellationDecide` (Task 3) mượn pattern spec hiện có — không phải logic-placeholder; mọi logic core có code. ✓
- **Type consistency:** `withBookingRefundLock(bookingId, fn)` nhất quán Task 2→3; `paidAt` (camelCase Prisma) Task 4. ✓
