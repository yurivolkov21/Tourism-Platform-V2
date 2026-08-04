# ADR-0006 — Vòng đời booking PENDING: hết hạn, tự hủy, và checkout phục hồi được

- **Trạng thái:** **Accepted (2026-07-22).** (Proposed 2026-07-21.) — **đã thi
  hành trọn 22/07 (5/5 mục)**.
- **Bối cảnh:** [rà soát độc lập 21/07](../analysis/2026-07-21-independent-review.md)
  (gói pending-expiry BK-1/BK-2/PAY-1/WRK-1); nối tiếp
  [infra-parity #8](../analysis/2026-07-19-infra-parity-nexora.md),
  [booking-states.md](../conventions/booking-states.md),
  [ADR-0002](0002-payment-gateway-refund-ledger.md),
  [độ sẵn sàng backend 22/07](../analysis/2026-07-22-backend-readiness-vs-nexora.md).

> **Cập nhật 2026-08-04 (cụm capture ADR-0002):** TTL cron WRK-1 nâng
> **30′ → 65′** (`9aa338f`) — hạn Stripe Checkout đã lên 60′ (fix floor+skew
> cùng ngày), bất biến đúng là **TTL > hạn session dài nhất của mọi
> gateway**; nay có unit khoá `PENDING_TTL_MINUTES*60 > SESSION_EXPIRY_SECONDS`
> trong `pending-sweep.spec.ts`. Câu "khớp hạn Stripe 30′" ở Quyết định 3
> dưới đây là giá trị lịch sử lúc Accept — đọc hằng trong
> `pending-sweep.service.ts` làm sự thật.

> **Cập nhật 2026-08-03 (đại tu docs — đối chiếu code):** cả 5 mục Quyết định
> đều có code chạy thật: BK-1 (`f5b546a`), PAY-1 (`d40597b`), WRK-1
> (`988e8b8` — `apps/api/src/worker/pending-sweep.service.ts`), BK-2
> (`3e17568`), dọn 2 comment nói dối (`bb3bd8d`). Quyết định gốc giữ nguyên
> văn — đây chỉ là xác nhận đã thi hành.

> **Chốt khi Accept (2026-07-22):**
> - **Phạm vi thu gọn:** đề xuất cũ "mở rộng bao BK-R1/PAY-R1/TQ-1" giờ **moot** — ba defect
>   refund đó đã đóng ở [ADR-0009](0009-refund-correctness.md) + batch P0. ADR này thuần cụm
>   **vòng đời PENDING** (BK-1/BK-2/PAY-1/WRK-1).
> - **BK-2 ĐƯA VÀO** (user chốt 22/07) — procedure RIÊNG `bookings.cancelPending`, tách khỏi
>   cancellation-request (vốn cho PAID).
> - Anchor `file:line` xác nhận lại lúc code (`main@80c2fd3`); branch: `feat/pending-lifecycle`.

## Bối cảnh

Ba agent độc lập lần ra **một gốc chung** với bốn triệu chứng — và **hai comment
tự hứa một cơ chế chưa bao giờ tồn tại**:

| id | Triệu chứng | Anchor |
| --- | --- | --- |
| BK-1 | `create` mint checkout bằng `await` trần → gateway lỗi ném **500 opaque**; contract chỉ khai 2 error; **không đường re-checkout** → PENDING mồ côi không trả được tiền | `bookings.service.ts:162-183,197`; `contract.ts:296,300` |
| BK-2 | `cancel` chỉ nhận PAID → hủy PENDING nhận **422**; `cancelOwnPending` của Nexora bị bỏ | bookings cancel path |
| PAY-1 | `checkout.session.expired` → `payment.failed` rồi **chỉ log** "stays PENDING"; Nexora flip CANCELLED | `stripe.gateway.ts:210-216`; `payments.service.ts:145-151` |
| WRK-1 | **Không cron** dọn abandoned PENDING; Nexora có `cancelAbandonedBookings` 15′ | `worker.ts` |

**Comment nói dối:** `bookings.service.ts:192-195` + `payments.service.ts:110-111`
trấn an một "pending-expiry (W2) sweep" — nhưng `grep @Cron|@Interval|ScheduleModule`
= **rỗng cả hai repo**. Chưa từng port.

**Không hỏng:** PENDING **không giữ ghế** (claim chỉ khi PAID, có CHECK
`departures_seats_within_total`). Bốn triệu chứng **không chạm oversell/tiền/idempotency**
— là lỗ **độ tin cậy / UX / API-contract**. Xếp Should, không Critical.

## Quyết định

Định nghĩa **hợp đồng vòng đời PENDING** trọn vẹn, phòng thủ nhiều lớp:

1. **Checkout phục hồi được (BK-1).** Bọc `createCheckoutSession` bằng try/catch → ném
   `CheckoutFailedError` → contract-error typed **`CHECKOUT_FAILED` (502, "please retry")**
   thay vì 500 opaque; booking ở lại PENDING không session (vô hại — không giữ ghế). Thêm
   procedure **`bookings.checkout`** (`POST /bookings/:code/checkout`) mint lại session cho
   PENDING của CHÍNH CHỦ — idempotent (gọi lại trả session hiện có / mint mới nếu chưa có).
2. **Webhook-driven cancel (PAY-1).** Thêm `VerifiedEvent.type = 'payment.expired'`; Stripe
   `checkout.session.expired` (TÁCH khỏi `payment.failed`) + PayPal voided → `handleEvent`
   route → flip PENDING → **CANCELLED** (gate `status='PENDING'`, adminId NULL), ghi PaymentEvent.
   Không đụng `seats_booked`. (`payment_intent.payment_failed` VẪN là `payment.failed` — chỉ log.)
3. **Backstop cron (WRK-1).** Job pg-boss `cancel-abandoned` TTL **30′** (khớp hạn Stripe
   Checkout), lịch ~10′. `status='PENDING' AND createdAt < now()-30′` → CANCELLED. Lưới an toàn
   khi webhook rớt. Idempotent với (2) (cùng gate PENDING).
4. **Khách tự hủy PENDING (BK-2).** Procedure RIÊNG **`bookings.cancelPending`** — chủ booking
   chuyển PENDING → CANCELLED (không refund — chưa charge), gate owner + `status='PENDING'`.
   Tách khỏi cancellation-request (PAID). Khôi phục parity `cancelOwnPending`.
5. **Dọn hai comment nói dối** (`bookings.service.ts:194-195` + `payments.service.ts`) cho khớp cơ chế thật.

**Bất biến giữ nguyên:** PENDING không giữ ghế; chỉ PAID mới claim (CHECK oversell).
Không đụng đường tiền/ghế.

## Hệ quả

- Lỗi gateway → khách nhận **502 typed re-try-able** + re-checkout, thay vì 500 mù + booking kẹt.
  Contract `bookings.create` thêm `CHECKOUT_FAILED`; FE phải xử lý.
- Bảng `Booking` không phình PENDING vô hạn; thống kê "chờ thanh toán" trung thực.
- Ba lớp (typed-error · webhook · cron) chồng nhau cố ý — phải test **cả ba nhánh độc lập**.
- **TDD bắt buộc** (#4, ≥80%): unit cho transition thuần; integration cho webhook-expired
  → CANCELLED và cron-sweep (PG thật). Webhook-cancel phải **idempotent** với cron và
  capture-đến-muộn (orphaned = REFUNDED theo `booking-states.md`).
- Cập nhật `booking-states.md`: thêm hàng "PENDING expired/abandoned → CANCELLED".

## Đã cân nhắc và loại

- **Chỉ cron, bỏ webhook.** Loại: khách nhìn "đang chờ" cả 30′ sau khi Stripe đã báo expired ngay.
- **Chỉ webhook, bỏ cron.** Loại: webhook rớt/không tới → PENDING kẹt vĩnh viễn (đúng lỗ hiện tại). Cần backstop.
- **Giữ 500 opaque (không typed error).** Loại: FE không phân biệt "hết ghế" vs "gateway lỗi" → không hiện nút re-try đúng; booking mồ côi không phục hồi được.
- **`expiresAt` cột + lọc query, không cron.** Loại: booking "hết hạn ngầm" vẫn PENDING trong DB, thống kê vẫn sai, phải nhớ lọc ở MỌI query đọc — dễ sót.

## Kế hoạch triển khai

Soạn chi tiết (task-by-task, TDD + mutation-test) khi Accepted → `docs/plans/`. Chỉ
bắt đầu code sau khi ADR này Accepted và trên branch riêng `feat/pending-lifecycle`
*(sửa 03/08 — lỗi copy-paste từ ADR-0009, branch thật ghi trong
[CHANGELOG](../changelog/2026-07-p0-p3a-backend.md#2026-07-22--vòng-đời-pending-đóng-lỗ-mồ-côi-branch-featpending-lifecycle))*.
