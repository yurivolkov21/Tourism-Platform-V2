# Prompt — thiết kế luồng Booking

> Cách dùng: đảm bảo `docs/design/claude-design-brief.md` đã được upload vào
> project Claude Design, rồi dán **toàn bộ khối dưới đây** vào ô chat.
>
> Prompt viết bằng tiếng Anh vì nó mô tả sản phẩm user-facing — giữ nguyên,
> đừng dịch. Phần hướng dẫn tiếng Việt chỉ nằm ngoài khối.

---

```
Design the booking flow for the Vietnam tour platform described in the design
brief already in this project. Follow that brief exactly — the colour values,
the three typefaces, the 63 existing primitives, and the layout patterns. Do not
introduce colours or components outside it.

Design four screens, plus the states listed for each. Light and dark for every
screen.

## Screen 1 — Departure & party selection

The traveller has arrived from a tour detail page with a departure already in
mind. Show:
- A compact summary of the tour they are booking: title, the chain of
  destinations it passes through, duration in days, and the star rating.
- The list of available departures as selectable rows: date range, price per
  person, and seats remaining. Seats remaining has three visual levels — plenty,
  few left, sold out. Sold-out rows are visible but not selectable.
- A party size control, capped by the tour's maximum group size.
- A running total that updates with party size, showing price per person and the
  total, plus the original price struck through when the departure is discounted.
- A primary action to continue.

States to show: default · a sold-out departure selected is impossible (show how
the row looks) · party size at the maximum with the cap explained.

## Screen 2 — Traveller details

A form collecting who is travelling. Use the field primitive — label, input,
helper text, and error message as one block.
- Lead traveller: full name, email, phone.
- One block per additional traveller: full name and date of birth.
- An optional notes field for dietary or accessibility requirements.
- A checkbox to accept the cancellation policy, with the policy summarised in one
  line and a link to the full page.

States to show: empty · filled correctly · a validation error on the email field
and on the unchecked policy box.

## Screen 3 — Payment

Payment runs in test mode — say so plainly and without embarrassment. This is a
student capstone; no real money moves.
- A clear, calm notice that this is a sandbox payment and no card will be charged.
- Card details form.
- An order summary that stays visible: tour, departure dates, party size, price
  per person, total.
- A deposit explanation: a 20% deposit confirms the booking, the balance is due
  48 hours before departure. Show both figures.
- Primary action to pay.

States to show: ready to pay · submitting (the button in a pending state) ·
payment declined, with the error surfaced near the action and the form still
filled in.

## Screen 4 — Booking detail (also used from the account area)

One booking, viewed after the fact. This screen carries a status, and the status
vocabulary is fixed — use exactly these five and nothing else:

- PENDING — placed but not paid yet. Holds no seat. Expires 30 minutes after it
  is created; show the remaining time plainly, without a ticking countdown bar.
- PAID — confirmed, seat held, the trip is on.
- CANCELLED — the trip is off. Seats released. May or may not have money
  refunded against it; never infer the refund state from this status.
- PARTIALLY_REFUNDED — some money has been returned but the traveller is still
  going on the tour.
- REFUNDED — all money has been returned. The traveller may still be going on
  the tour: a goodwill refund does not cancel a trip.

That last point matters and is easy to get wrong: refund status and trip status
are two separate stories. Design the screen so a traveller reading it cannot
confuse "I got my money back" with "my trip is cancelled". Show them as two
distinct pieces of information, not one badge.

Include on this screen:
- The booking reference, in the monospace face.
- Status, per the vocabulary above.
- Tour, departure dates, party size, and the travellers' names.
- A payment section: amount paid, and any refunds as a list of separate entries
  with date and amount — refunds accumulate, so there can be several.
- Actions available depending on status: pay now (PENDING), request cancellation
  (PAID), download nothing at all if there is nothing to download.

States to show: all five statuses.

## Also design

- The empty state for "no bookings yet", pointing back to browsing tours.
- A confirmation screen shown immediately after a successful payment, with the
  booking reference prominent.

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

Ba chỗ đáng soi kỹ trước khi coi là chốt:

1. **Năm status có bị vẽ thành một dãy badge cùng kiểu không?** Nếu có thì
   mockup đã trộn chuyện tiền với chuyện chuyến đi — đúng cái bẫy prompt đã cảnh
   báo. Đây là quy ước có thật trong `docs/conventions/booking-states.md`, không
   phải chi tiết trang trí.
2. **Liều lượng màu ngọc bích.** Nếu trang phủ đầy primary thì sai tỷ lệ
   62/16/12/6, dù mã màu đúng.
3. **Có component nào ngoài danh sách 63 không?** Mỗi cái phát sinh là một khoản
   phải viết mới — không phải cấm, nhưng phải biết trước khi gật.
