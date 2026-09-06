# ADR-0009 — Đúng đắn refund: advisory-lock serialize + trigger `SUM ≤ total` + gate re-derive orphan

- **Trạng thái:** Accepted (2026-07-21)
- **Sửa đổi (2026-07-21, lúc thực thi RT4):** Quyết định #3 đổi cơ chế gate PAY-R1 từ
  `paid_at IS NOT NULL` sang **fresh-refund guard**. Lý do: `paid_at` KHÔNG phân biệt được
  overbook-retry với orphan thật — cả hai đều `paid_at` NULL (capture tới *sau* khi hủy nên
  booking chưa từng PAID), nên gate `paid_at` (a) phá test orphan đang xanh
  [payments.int.spec.ts:312](../../apps/api/src/modules/payments/payments.int.spec.ts) và
  (b) bỏ sót ca W4-cancelled bị capture-redelivery sống dậy thành REFUNDED. Xem #3 + "Đã loại".
- **Bối cảnh:** BK-R1 · PAY-R1 · BK-R2/PAY-R2/TQ-3 trong
  [rà soát độc lập 21/07](../analysis/2026-07-21-independent-review.md).

> Sub-project B của "chùm refund". Sub-project A (vòng đời PENDING — BK-1/BK-2/PAY-1/WRK-1)
> ở [ADR-0006](0006-pending-lifecycle.md) (Proposed), làm sau. Số: 0007 reserve outbox,
> 0008 admin-bootstrap → ADR này dùng `0009`.

> **Cập nhật 2026-08-03 (đại tu docs — đối chiếu code):** tham chiếu "ADR-0006
> Proposed, làm sau" ở trên đã lỗi thời — [ADR-0006](0006-pending-lifecycle.md)
> nay **Accepted và đã thi hành trọn 22/07** (`apps/api/src/worker/pending-sweep.service.ts`
> chạy thật qua pg-boss). Điều này đổi bản chất đánh đổi #3 ở Quyết định: câu
> "nguồn orphan-thật duy nhất là pending-expiry của sub-project A **chưa dựng**"
> không còn đúng — pending-sweep giờ **đang chạy sống**, nên khe crash giữa
> `refund.create` và CTE flip (chấp nhận ở #3) chuyển từ **giả định lý thuyết**
> thành **rủi ro sống, đáng canh** khi P4/monitoring vào — bất kỳ orphan thật
> nào sweep tạo ra đều có thể trúng đúng khe đó. Quyết định gốc giữ nguyên văn
> (đánh đổi vẫn được chấp nhận); đây là nâng cấp mức độ rủi ro cần theo dõi,
> không phải đảo quyết định.

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

3. **PAY-R1 — gate re-derive theo fresh-refund.** `refundOrphanedCapture` (nhánh
   `claimSeatsForPaid = 'cancelled'`) chỉ re-derive REFUNDED khi `issueFullAutoRefund` trả
   **`'refunded'`** (vừa phát refund MỚI — booking chưa có refund trước đó → capture này là
   tiền orphan thật). Khi trả **`'already-refunded'`** (booking đã có refund từ path khác:
   overbook auto-refund HOẶC W4 cancel-approve) → **giữ nguyên terminal (CANCELLED)**, KHÔNG
   re-derive, KHÔNG email lần hai. Discriminator đúng là "refund này của CHÍNH orphan-flow hay
   của path khác", không phải `paid_at` (cả hai ca đều NULL). Đồng thời vá luôn ca W4-cancelled
   bị capture-redelivery sống dậy thành REFUNDED — điều `paid_at` bỏ sót.
   *Đánh đổi:* crash đúng khe giữa `refund.create` và CTE flip của một orphan *thật* → booking
   kẹt CANCELLED thay vì REFUNDED (tiền vẫn hoàn đủ; nguồn orphan-thật duy nhất là pending-expiry
   của sub-project A chưa dựng). Chấp nhận.

4. **TOCTOU (BK-R2/PAY-R2/TQ-3).** Bọc `issueFullAutoRefund` (check→gateway→ledger) bằng
   cùng advisory lock per-booking của W3 → duplicate delivery đồng thời bị serialize; re-check
   **existing-Refund** trong lock trước khi gọi gateway (dùng existing-Refund thay `status='PENDING'`
   vì nó là idempotency-signal tổng quát cho CẢ overbook-PENDING lẫn orphan-CANCELLED).

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
  PAY-R1 overbook-cancelled + duplicate webhook → giữ CANCELLED (gỡ fresh-refund guard → REFUNDED ĐỎ) ·
  TOCTOU concurrent auto-refund → 1 refund. Không đụng đường claim/oversell (giữ nguyên).

## AMEND 1 06/09 — claim PAID gate thêm trạng thái CHUYẾN: departure đóng/đã đi thì không xác nhận, đi đường auto-refund

Đợt vá W1 (audit web 05/09, cụm 2 — mục Thấp "bẫy chờ phase /tours"): CTE claim
chỉ gate `bookings.status='PENDING'`, không nhìn `tour_departures` — một capture
đến muộn (webhook trễ, PayPal order sống ~3h) vẫn xác nhận được chỗ trên chuyến
đã **CLOSED/CANCELLED** hoặc đã **khởi hành**. Nay `claim` thêm qual

```sql
EXISTS (SELECT 1 FROM tour_departures d
        WHERE d.id = b.departure_id
          AND d.status = 'OPEN' AND d.start_date >= current_date)
```

Zero row + booking vẫn PENDING + departure không còn OPEN/tương lai → outcome
MỚI **`departure-closed`** → caller đi đúng đường auto-refund sẵn có của
overbook (refund toàn phần, booking → CANCELLED, outbox
`departure-closed-refund:<bookingId>`, email BOOKING_REFUNDED) — cùng lý lẽ:
booking chưa từng rời PENDING, chưa từng là doanh thu.

Ghi chú EPQ: qual này nằm trong subquery nên KHÔNG được re-evaluate tươi như
qual trên UPDATE target — chấp nhận, vì race "admin đóng chuyến ĐÚNG lúc
capture về" không phải race tiền (đóng chuyến là thao tác vận hành hiếm; kẹt
lại phía nào thì hoặc booking PAID trên chuyến vừa đóng — xử tay như trước
AMEND — hoặc refund một booking lẽ ra vào được, nghiêng về phía khách). Race
quyết-định-tiền (double claim) vẫn gate trên `b.status` như cũ.

## AMEND 2 06/09 (vòng vá review W1) — gate chuyến ở cả `reCheckout`, MỘT thước ngày UTC, lý do hoàn qua copy

- **`reCheckout` cũng gate chuyến** (cùng điều kiện với `create` và claim):
  bản AMEND 1 chỉ gate ở claim, nên booking PENDING trên chuyến vừa CLOSED vẫn
  mint được trang thanh toán — hệ thống chủ động mời khách trả một khoản nó
  đã quyết từ chối, rồi auto-refund. Nay 400 `DEPARTURE_NOT_AVAILABLE` (route
  `bookings.checkout` khai mã này), không mint.
- **Múi giờ, chốt tường minh:** `start_date` là `@db.Date` ngày lịch của điểm
  khởi hành (VN, UTC+7); mọi gate "đã đi chưa" so theo NGÀY UTC — SQL dùng
  `(now() AT TIME ZONE 'UTC')::date` (không phụ thuộc TZ session của DB), Node
  dùng một helper `todayUtc()` cho `create`/`reCheckout`/phân loại
  claim/`estimateRefund`. Hệ quả chấp nhận: chuyến chạy 06:00 VN vẫn nhận
  capture tới 07:00 VN hôm sau — cùng lề với luật walk-in cùng ngày của
  `create`; một thước cho cả hai tầng đáng hơn một thước chính xác hơn ở một
  tầng.
- **`reason` của email BOOKING_REFUNDED** là mã nội bộ (`overbooked` /
  `departure-closed` / `orphaned capture`); template dịch sang câu cho khách,
  mã lạ in nguyên. Khách từng nhận "Reason: departure-closed".
- Lock: xem ADR-0006 AMEND 2c — claim và auto-refund cùng advisory lock.

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
- **Gate PAY-R1 theo `paid_at IS NOT NULL`** (bản đầu của #3): dựa trên giả định "orphan thật
  có paid_at NOT NULL" — SAI. Orphan thật là capture tới *sau* khi hủy, nên booking chưa từng
  PAID → `paid_at` NULL y hệt overbook-retry; gate này phá test orphan đang xanh và bỏ sót ca
  W4-cancelled. Thay bằng fresh-refund guard (#3). Loại vì discriminator sai bản chất.
