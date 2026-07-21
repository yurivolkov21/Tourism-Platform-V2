# ADR-0009 — Đúng đắn refund: advisory-lock serialize + trigger `SUM ≤ total` + gate `paid_at`

- **Trạng thái:** Accepted (2026-07-21)
- **Bối cảnh:** BK-R1 · PAY-R1 · BK-R2/PAY-R2/TQ-3 trong
  [rà soát độc lập 21/07](../analysis/2026-07-21-independent-review.md).

> Sub-project B của "chùm refund". Sub-project A (vòng đời PENDING — BK-1/BK-2/PAY-1/WRK-1)
> ở [ADR-0006](0006-pending-lifecycle.md) (Proposed), làm sau. Số: 0007 reserve outbox,
> 0008 admin-bootstrap → ADR này dùng `0009`.

## Bối cảnh

Hệ tiền-VÀO (claim ghế, oversell CHECK, idempotency webhook) chắc; **tiền-RA (refund /
cancellation / webhook-retry) là chỗ tụ lỗ** — ba gốc:

- **BK-R1 (High, money):** `refundByAdmin` ([refunds.service.ts:97-177](../../apps/api/src/modules/bookings/refunds.service.ts))
  và `cancellations.approve` ([cancellations.service.ts:384](../../apps/api/src/modules/bookings/cancellations.service.ts))
  làm **read-ledger → gateway (NGOÀI transaction) → ghi-ledger** không nguyên tử, với
  idempotency key KHÁC cấu trúc (`refund:<id>:<sum>` vs `cancel-refund:<reqId>`), và
  KHÔNG có DB constraint `SUM(refunds) ≤ total` (chỉ `refunds_amount_positive`). Hai
  admin thao tác đồng thời trên cùng booking PAID → **hoàn tiền hai lần** + ledger vượt total.
- **PAY-R1 (High):** webhook `payment.completed` route theo outcome tạm thời của
  `claimSeatsForPaid`; booking overbook-cancelled (`paid_at` NULL) bị retry → vào
  `refundOrphanedCapture` → **re-derive `CANCELLED → REFUNDED` + email lần 2**, vi phạm
  invariant W3 ([payments.service.ts:227-236](../../apps/api/src/modules/payments/payments.service.ts)).
- **BK-R2/PAY-R2/TQ-3 (Low):** TOCTOU — `issueFullAutoRefund` không re-check `PENDING`
  trong cửa sổ giữa read và gateway dưới duplicate delivery.

Ràng buộc thiết kế: gateway HTTP gọi **cố ý ngoài transaction** (không giữ DB connection
lúc HTTP — nguyên tắc money-path).

## Quyết định

1. **BK-R1 — serialize refund per-booking bằng advisory lock.** Bọc `refundByAdmin`
   VÀ nhánh refund của `cancellations.approve` bằng **`pg_advisory_lock(hash(bookingId))`**
   giữ suốt `read-ledger → gateway → ghi-ledger`, release ở `finally`. Flow thứ hai block
   → đọc ledger đã cập nhật → refund đúng phần còn lại hoặc ném `RefundNothingLeftError`.
   Đây là **ngoại lệ CÓ CHỦ ĐÍCH** của nguyên tắc "gateway ngoài transaction", giới hạn
   cho đường **admin-refund hiếm** (không phải claim-path tần suất cao): giữ một connection
   lúc HTTP (≤15s timeout) là chi phí chấp nhận được để đổi lấy money-integrity.

2. **Trigger `SUM(refunds) ≤ total`** (migration mới, cùng khuôn `hardening.sql`).
   `BEFORE INSERT ON refunds`: chặn nếu `SUM(refunds hiện có) + NEW.amount > booking.total_amount`.
   Defense-in-depth — bắt mọi path lách khóa (bao gồm auto-refund + admin đồng thời).

3. **PAY-R1 — gate re-derive theo `paid_at`.** `refundOrphanedCapture` (nhánh
   `claimSeatsForPaid = 'cancelled'`) chỉ re-derive REFUNDED khi **`paid_at IS NOT NULL`**
   (orphan paid-thật). `paid_at IS NULL` (overbook-cancelled bị retry) → giữ CANCELLED,
   KHÔNG re-derive, KHÔNG email lần hai. Gate trong CTE.

4. **TOCTOU (BK-R2/PAY-R2/TQ-3).** Áp cùng advisory lock per-booking cho nhánh webhook
   auto-refund → duplicate delivery bị serialize; `issueFullAutoRefund` re-check
   `status='PENDING'` trong lock trước khi gọi gateway.

Cơ chế giữ lock qua HTTP (Prisma pool ~10) — interactive-tx bao gateway (timeout > 15s)
hoặc raw-connection session-lock — chốt ở plan; cả hai đều serialize đúng.

## Hệ quả

- Refund/cancel đồng thời trên cùng booking bị **serialize** → không double-refund, ledger
  không vượt total; flow thua cuộc nhận error rõ ràng (`RefundNothingLeftError`), không im lặng.
- Trigger là lưới cứng ở tầng DB: dù code tương lai quên lock, ledger vẫn không thể vượt total.
- Overbook-cancelled không còn "sống dậy" thành REFUNDED khi provider retry; email refund đúng một lần.
- **Chi phí:** đường admin-refund giữ 1 connection pool lúc HTTP. Chấp nhận (hiếm + serialize).
- **Test bắt buộc (mutation-aware):** BK-R1 concurrent refund‖cancel (2 connection) → đúng 1
  full refund + cái thứ 2 error (gỡ lock → double-refund ĐỎ) · trigger chặn insert vượt total ·
  PAY-R1 overbook-cancelled + duplicate webhook → giữ CANCELLED (gỡ gate paid_at → REFUNDED ĐỎ) ·
  TOCTOU concurrent auto-refund → 1 refund. Không đụng đường claim/oversell (giữ nguyên).

## Đã cân nhắc và loại

- **Two-phase reservation** (TX1 `FOR UPDATE` + placeholder reserve → gateway → TX2 finalize):
  không giữ connection lúc HTTP, "sạch" hơn về nguyên tắc — nhưng phức tạp đáng kể (placeholder
  row + dọn khi gateway fail + trạng thái trung gian). Với admin-refund hiếm, advisory lock đơn
  giản hơn nhiều mà vẫn robust. Loại vì phức tạp không tương xứng lợi ích.
- **Chỉ trigger `SUM≤total`, không lock:** đơn giản nhất nhưng KHÔNG đủ — ca partial-vs-full
  đồng thời, provider dedup theo key làm amount ghi-nhận lệch số thực refund (ledger nói dối);
  và trigger chặn ledger thứ hai NHƯNG provider đã bị gọi hai lần (tiền đã ra). Lock là bắt buộc.
- **Unify idempotency key hai path (không lock):** ca partial-vs-full vẫn hỏng (provider trả
  refund đầu cho key trùng nhưng amount khác). Loại.
