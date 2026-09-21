# Prompt — thiết kế luồng Booking

> Cách dùng: đảm bảo `docs/design/claude-design-brief.md` đã được upload vào
> project Claude Design, rồi dán **toàn bộ khối dưới đây** vào ô chat.
>
> Prompt viết bằng tiếng Anh vì nó mô tả sản phẩm user-facing — giữ nguyên,
> đừng dịch. Phần hướng dẫn tiếng Việt chỉ nằm ngoài khối.
>
> **Bản 04/08 — đã đối chiếu contract thật** (thay bản 03/08): bỏ form thẻ +
> đặt cọc 20% (thanh toán là HOSTED checkout của Stripe/PayPal, trả đủ);
> bỏ khối từng-người-đi kèm ngày sinh (API chỉ nhận SỐ người lớn/trẻ em);
> PENDING hết hạn 65 phút (không phải 30); thêm chế độ Private trip →
> enquiry. Mỗi field trong prompt đều tồn tại trong `@tourism/contract`.

---

```
Design the booking flow for the Vietnam tour platform described in the design
brief already in this project. Follow that brief exactly — the colour values,
the three typefaces, the 63 existing primitives, and the layout patterns. Do not
introduce colours or components outside it.

Design three screens plus the states listed for each. Light and dark for every
screen. This platform is a student capstone running entirely on payment
sandboxes — no real money ever moves, and the design should say so calmly
where payment is concerned, without being embarrassed about it.

## Screen 1 — Book a tour (single page: departure, party, contact, payment choice)

One page, not a wizard. The traveller arrives from a tour detail page.

Top: a compact summary of the tour — title, the chain of destinations, duration
in days, star rating.

The page has two modes, switched by a single toggle:

**Scheduled departure** (default when open departures exist):
- Departure list as selectable rows: date range, price per person, and seats
  remaining with three visual levels — plenty, few left, sold out. Sold-out
  rows are visible but not selectable. When a departure is discounted, show
  the original price struck through next to the effective price.
- Party controls: adults (minimum 1) and children (minimum 0) as two separate
  steppers. The combined party is capped by whichever is smaller: the tour's
  maximum group size or the seats remaining on the chosen departure — when the
  cap bites, explain it in one quiet line.
- Contact block, using the field primitive (label, input, helper, error as one
  block): lead traveller full name, email, phone (optional). One optional
  textarea for special requests — dietary, accessibility, occasions.
- Payment method as a two-option choice: Stripe or PayPal. This is a choice of
  where the traveller will be redirected, not a card form — no card fields
  exist anywhere in this flow. A short line under the choice: payment happens
  on the provider's secure page, in sandbox mode, no card is charged.
- A running order summary that stays visible: price per person × travellers
  (children count as travellers at the same per-person price), total, and a
  quiet note that the final amount is recalculated by the server.
- Primary action: "Continue to payment" — it leads off-site to the provider.

**Private trip** (auto-selected when the tour has no open departures):
- The same tour summary, but instead of departure rows: preferred travel
  window (free-text date wishes), party steppers, the same contact block, and
  a message field. Make it plain this sends an enquiry to the team — it does
  not reserve seats and no payment happens now. Primary action: "Send enquiry".

States to show: scheduled default · sold-out row appearance · party cap
reached with the explanation line · a validation error on email and on a
missing departure selection · private mode · submitting (primary button in
its pending state).

## Screen 2 — Return from payment

Two small utility screens, same family:

**Success return:** the provider sent the traveller back. Show the booking
reference prominently in the monospace face, the tour and dates, and one of
two moods: confirmed (payment landed — celebrate quietly, mention that a
confirmation email is on its way) or still-confirming (webhook not yet
processed — a calm "we're confirming your payment" with gentle auto-refresh,
no spinner drama). Link onward to the booking detail page.

**Cancel return:** the traveller backed out on the provider page. Nothing is
lost: the booking is held unpaid and can be paid again from the booking
detail page — say exactly that, with a primary action leading there and a
secondary back to browsing. Unpaid bookings expire on their own after about
an hour; one quiet line may say so. No countdown.

States to show: confirmed · still-confirming · cancel return.

## Screen 3 — Booking detail (lives in the account area)

One booking, viewed after the fact. This screen carries a status, and the
status vocabulary is fixed — use exactly these five and nothing else:

- PENDING — placed but not paid yet. Holds no seat. Expires 65 minutes after
  creation; show remaining time plainly, no ticking countdown bar.
- PAID — confirmed, seat held, the trip is on.
- CANCELLED — the trip is off. Seats released. May or may not have money
  refunded against it; never infer the refund state from this status.
- PARTIALLY_REFUNDED — some money has been returned but the traveller is
  still going on the tour.
- REFUNDED — all money has been returned. The traveller may still be going:
  a goodwill refund does not cancel a trip.

That last point matters and is easy to get wrong: refund status and trip
status are two separate stories. Design the screen so a traveller cannot
confuse "I got my money back" with "my trip is cancelled". Two distinct
pieces of information, never one badge.

Include:
- Booking reference in the monospace face; status per the vocabulary above.
- Tour, departure date range, party size (adults + children), contact name.
- A payment section: total amount and currency, when it was paid, and — when
  any refund exists — a single "refunded to date" figure with a one-line
  explanation. No per-refund ledger here; that lives in the back office.
- Actions by status: PENDING → "Pay now" and "Cancel booking" (cancelling an
  unpaid booking is immediate and free); PAID → "Request cancellation", which
  opens a short reason box and sends a request for review — show also the
  waiting state ("requested, pending review") and the declined state with a
  resubmit option. Terminal statuses are read-only.

States to show: all five statuses, plus the PAID variants: no request yet ·
request pending review · request declined.

## Also design

- The empty state for "no bookings yet", pointing back to browsing tours.

## Reminders

- All visible copy in English. Vietnamese place names keep their diacritics
  (Hạ Long, Ninh Bình, Huế).
- Every image position is a placeholder tile, not a photograph.
- No countdown timers, no artificial scarcity, no promotional interruptions.
- The hero-style dark band, if you use one, follows the site pattern: dark
  background with a fine contour-line texture and light text.
```

---

## Ghi chú khi đọc mockup trả về

Bốn chỗ đáng soi kỹ trước khi coi là chốt:

1. **Năm status có bị vẽ thành một dãy badge cùng kiểu không?** Nếu có thì
   mockup đã trộn chuyện tiền với chuyện chuyến đi — đúng cái bẫy prompt đã
   cảnh báo. Quy ước thật: `docs/conventions/booking-states.md`.
2. **Có mọc ra card-form hay chữ "deposit" không?** Thanh toán của ta là
   redirect sang trang hosted của provider, trả đủ một lần — mockup nào vẽ ô
   nhập thẻ hay cọc 20% là sai kiến trúc, loại thẳng.
3. **Liều lượng màu ngọc bích** — nếu trang phủ đầy primary thì sai tỷ lệ
   62/16/12/6, dù mã màu đúng.
4. **Component ngoài danh sách 63** — mỗi cái phát sinh là một khoản phải
   viết mới; không cấm, nhưng phải biết trước khi gật.

Chi tiết kỹ thuật đã neo vào contract (để đối chiếu khi port):
`CreateBookingInput` = departureId · numAdults ≥1 · numChildren ≥0 ·
contactName/Email (+phone 6–30 optional) · specialRequests ≤1000 ·
paymentProvider STRIPE|PAYPAL. Departure = startDate/endDate · seatsLeft ·
effectivePrice · compareAtPrice (nullable → strikethrough). Tour có
maxGroupSize. Private mode gửi `enquiries.create` (không tạo booking).
"Refunded to date" trên Screen 3 là field `refundedTotal` SẼ thêm vào
`BookingSchema` ở cụm C (đọc từ ledger — một con số, không phải list; đã
định trước, ghi vào spec cụm C).
