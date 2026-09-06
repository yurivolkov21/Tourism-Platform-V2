# ADR-0029 — Approve một yêu cầu huỷ với mức hoàn tiền theo chính sách

- **Trạng thái:** Accepted (2026-09-04)
- **Bối cảnh thi hành:** nhánh `fix/p4c-backend-logic`, đi trước code theo luật
  CLAUDE.md #5
- **Liên quan:** [ADR-0030](0030-refund-policy-tiers.md) (bảng bậc quyết SỐ TIỀN; ADR này quyết CƠ CHẾ) · [ADR-0009](0009-refund-correctness.md) (advisory lock + trigger
  `SUM(refunds) ≤ total` — ADR này **dựa vào**, không nới) ·
  [ADR-0002](0002-payment-gateway-refund-ledger.md) (sổ refund append-only) ·
  spec P2 §4 W3/W4 · [docs/conventions/booking-states.md](../conventions/booking-states.md)
  (ADR này **sửa một phần** — xem §3)

## Bối cảnh

Vòng rà refund 04/09 đo được ba sự thật, cả ba bằng probe chạy trên Postgres
thật chứ không phải đọc code:

**1. Hoàn đủ tiền bằng đường W3 (`Issue refund`) làm rò ghế vĩnh viễn.**

| Bước | Đo được |
| --- | --- |
| Khách trả tiền | `seats_booked` = 3 |
| W3 hoàn đủ | booking → `REFUNDED`, ghế **vẫn 3** |
| Bấm Approve | **422 NOT_REFUNDABLE** |
| Buộc phải Deny | request `DENIED`, `cancelled_at` **null**, ghế **vẫn 3** |

Toàn API chỉ có **hai** chỗ ghi `seats_booked`: cộng khi trả tiền
(`bookings.service.ts`) và trừ khi **approve** (`cancellations.service.ts`).
Không cron, không reconciler. Nên approve là lối thoát DUY NHẤT của một chiếc
ghế, và một booking đi vòng W3 rồi Deny thì ghế mất không đường lấy lại.

**2. Approve luôn hoàn TRỌN phần dư.** `approve` gọi
`classifyRefundAmount({ requested: null })`, tức không có cách nào duyệt một
yêu cầu huỷ với mức hoàn 50% — dù `Tour.freeCancellationDays` tồn tại từ
ADR-0023, tức khái niệm chính sách huỷ theo mốc thời gian là có thật.

**3. Booking `CANCELLED` còn dư tiền là ngõ cụt.** Dựng thẳng trạng thái ấy
rồi thử hoàn tiếp:

```
422 NOT_REFUNDABLE
"Booking is CANCELLED; only a PAID or PARTIALLY_REFUNDED booking can be refunded"
```

Hôm nay trạng thái đó **bất khả** (approve luôn hoàn trọn), nên (3) chưa phải
bug. Nhưng nó trở thành có thật ngay khi ta làm (2).

## Quyết định

### 1. `approve` nhận `refundAmount` tuỳ chọn

`DecideCancellationInputSchema` thêm `refundAmount?: DecimalString`, chỉ có
nghĩa khi `approve: true`. Vắng = hoàn trọn phần dư, tức **hành vi cũ y
nguyên** — mọi caller hiện tại không phải đổi gì.

Số tiền đi thẳng vào `classifyRefundAmount` — hàm đã nhận sẵn `requested` và
đã canh đủ ba lỗi (≤ 0, vượt phần dư, sổ đã settle). Không có phép tính tiền
MỚI nào ra đời; ADR này chỉ thôi ghim `requested` thành `null`.

Vì sao đặt ở `decide` chứ không mở một endpoint riêng: hoàn tiền khi duyệt huỷ
**không phải** một lệnh tiền độc lập — nó là một phần của quyết định, cùng
transaction, cùng advisory lock, cùng lượt nhả ghế. Tách ra là tái lập đúng ca
W3/W4 chồng lấn đã sinh ra bug ở trên.

### 2. `approve` chịu được phần dư BẰNG 0

Approve nghĩa là *"tôi chấp thuận yêu cầu huỷ"*. Hoàn tiền chỉ là một bước
trong đó, và nếu tiền đã hoàn hết từ trước thì bước ấy **không còn gì để làm**
— chứ không phải lý do từ chối cả lệnh.

Phần dư = 0 thì: bỏ qua gateway, KHÔNG ghi row refund nào (sổ append-only chỉ
ghi tiền thật sự chuyển), nhưng **vẫn** flip request → `REFUNDED`, booking →
`CANCELLED`, **nhả ghế**, gửi mail.

Đây là thứ chữa hai record đang kẹt của user: bấm Approve là chúng tự lành,
không cần SQL tay. Và nó xoá luôn cái 422 khó hiểu mà JSDoc cũ phải dặn "admin
deny nó thay vào đó" — lời dặn ấy nay sai và bị gỡ.

### 3. Gate W3 nới cho booking `CANCELLED` còn dư — và KHÔNG được ghi đè `CANCELLED`

Cho phép `refundByAdmin` chạy trên booking `CANCELLED` khi sổ còn dư.

Vì sao an toàn: bất biến tiền do **trigger** của ADR-0009 canh
(`SUM(refunds) ≤ total_amount`), không phải do cái gate này. Sổ vẫn
append-only, vẫn qua cùng advisory lock, vẫn không thể over-refund. Gate chỉ
đang nói "booking này còn nợ khách bao nhiêu" — và một booking đã huỷ mà chưa
hoàn hết thì đúng là còn nợ.

⚠️ **Bẫy phải chặn ngay từ ADR:** `refundByAdmin` kết thúc bằng
`deriveStatusAfterRefund(...)` → `PARTIALLY_REFUNDED | REFUNDED`. Áp thẳng nó
lên một booking `CANCELLED` là **ghi đè travel story bằng money story** —
khách hết huỷ, `cancelled_at` mồ côi, và ghế đã nhả thì không ai biết nữa.
Nên: booking đang `CANCELLED` thì **giữ nguyên `CANCELLED`**, không re-derive.
Đúng luật đã ghi ở `booking-states.md` — `CANCELLED` là trạng thái TƯỜNG MINH,
không phải projection của sổ.

Ghế: `refundByAdmin` vốn không đụng `seats_booked` và ADR này không đổi điều
đó. Ghế đã nhả lúc approve; nhả lần hai là hỏng bộ đếm.

### 4. Số tiền hoàn do CHÍNH SÁCH quyết, không phải admin gõ

Bản đầu của ADR này định để admin tự nhập số tiền và hệ thống chỉ bày dữ kiện.
User bác (04/09), và bác đúng: một ô nhập tự do là một ô gõ nhầm được, mà tiền
gõ nhầm thì khách chịu.

Nên `refundAmount` mà `decide` nhận **không phải thứ admin gõ ra** — nó là số
mà bảng bậc chính sách tính, khoá sẵn trên màn hình. Bảng bậc, cách đếm ngày,
và luật vượt bậc nằm ở **[ADR-0030](0030-refund-policy-tiers.md)**; ADR này chỉ
giữ phần cơ chế: `decide` nhận một số tiền, và mọi lỗi tiền vẫn do
`classifyRefundAmount` canh như cũ.

Ranh giới giữa hai ADR: 0030 quyết **hoàn bao nhiêu**, 0029 quyết **hoàn thì
chuyện gì xảy ra** (đóng request, huỷ booking, nhả ghế, kể cả khi số tiền là
0).

### 5. Stepper là XÁC NHẬN CÓ Ý THỨC, không phải ô nhập

Luồng approve chuyển thành dialog nhiều bước (user chốt 04/09): xem yêu cầu →
đối chiếu chính sách → thấy số tiền chính sách đã tính → xác nhận ba hệ quả.

Bước "chọn mức hoàn" vì thế KHÔNG phải một ô trống. Nó bày con số đã khoá cùng
căn cứ sinh ra nó (còn bao nhiêu ngày tới khởi hành, bậc nào áp dụng), và
đường vượt bậc là một công tắc riêng bắt buộc ghi lý do — xem ADR-0030 §5.

Deny KHÔNG đi stepper: nó không đụng tiền, không đụng ghế. Một xác nhận có ô
ghi chú là đủ — bắt bốn bước cho một lệnh vô hại là dạy người dùng bấm Next mà
không đọc.

## Hệ quả

### Bất biến bị nới, và bất biến được giữ

| Bất biến | Sau ADR này |
| --- | --- |
| `SUM(refunds) ≤ total_amount` (trigger ADR-0009) | **giữ nguyên** |
| Sổ refund append-only | **giữ nguyên** |
| Một advisory lock cho mọi đường refund của một booking | **giữ nguyên** |
| Ghế chỉ nhả ở approve, đúng một lần | **giữ nguyên** |
| `CANCELLED` là trạng thái tường minh, không derive từ sổ | **giữ nguyên**, và §3 phải chủ động bảo vệ |
| "Approve luôn hoàn trọn phần dư" | **NỚI** (§1) |
| "Booking đã hoàn đủ thì không approve được" | **NỚI** (§2) |
| "Chỉ PAID/PARTIALLY_REFUNDED mới hoàn được" | **NỚI** cho `CANCELLED` còn dư (§3) |

### Ba chỗ tài liệu nay đã sai, phải sửa cùng commit

- JSDoc `approve` ở `cancellations.service.ts` — đoạn "một booking đã fully
  refund qua W3 trong lúc request còn mở thì không approve được; admin deny nó
  thay vào đó".
- Copy i18n `decide.errors.NOT_REFUNDABLE` — nó đang dặn admin đi deny.
- `booking-states.md` — thêm ca "CANCELLED còn dư tiền, hoàn tiếp được".

### Điều KHÔNG được suy ra

ADR này **không** cho hoàn tiền tự do trên booking đã huỷ vì bất kỳ lý do gì.
Nó cho hoàn **phần dư** của chính booking ấy, trần vẫn là `total_amount`, vẫn
do trigger canh. Không có đường nào ở đây trả cho khách nhiều hơn số họ đã trả.

### AMEND 04/09 — chốt câu hỏi hoàn tiền THIỆN CHÍ: GIỮ, nhưng ẩn khi có request mở

Bản đầu để ngỏ. Nay chốt khi thi công: **`Issue refund` ở `/bookings/[code]`
được GIỮ, nhưng TỰ ẨN khi booking đang có yêu cầu huỷ chờ xử lý.**

Vì sao phải chốt bây giờ chứ không hoãn thêm: §1–§3 chỉ **CHỮA** ca đã lỡ —
approve chịu được dư 0 nên record kẹt tự lành, gate W3 nới nên phần dư hoàn
tiếp được. Nhưng không mục nào **CHẶN** ca mới. Vá xong mà để nguyên nút ấy là
để nguyên cái bẫy: admin vẫn hoàn đủ tiền bằng đường W3 trên một booking đang
có request mở, và ghế lại rò y như cũ.

Vì sao ẩn chứ không gỡ hẳn: hoàn thiện chí là nghiệp vụ THẬT (khách phàn nàn
chất lượng, hoàn một phần, khách vẫn đi tour) và nó chỉ mâu thuẫn với đường W4
đúng một ca — khi có request đang mở. Ẩn đúng ca ấy thì hết chồng lấn mà không
mất nghiệp vụ nào.

Gán theo TRẠNG THÁI, không theo trang: điều kiện là "booking có
`cancellationRequests` nào đang `REQUESTED`", thứ không giả mạo được và đã nằm
sẵn trong `AdminBookingDetail`. Gán theo "đến từ trang nào" là một tham số URL
ai cũng gõ được, không phải một ranh giới thật.

Đường đúng ở ca ấy là **Approve** trên `/cancellations/[code]` — vì chỉ nó mới
đóng request, huỷ booking và nhả ghế.

### AMEND 2 04/09 — approve một phần là MỘT LẦN, và UI phải nói ra điều đó

§3 mở cho `refundByAdmin` chạy trên booking `CANCELLED` còn dư. Nhưng client
admin gác nút `Issue refund` bằng `canRefund(status)` = `PAID |
PARTIALLY_REFUNDED`, nên sau một approve một phần booking thành `CANCELLED` và
**nút biến mất**: phần dư không còn đường hoàn từ back-office.

Chốt: **giữ nguyên như vậy, và nói thẳng ra ở bước chọn số tiền.**

Vì sao giữ chứ không nới `canRefund`: nới ra là dựng lại hai cửa cùng chuyển
tiền trên một booking — đúng thứ §AMEND vừa đóng lại. Còn ở phía nghiệp vụ,
approve *là* quyết định cuối cùng về yêu cầu huỷ ấy: nó đóng request, huỷ
booking và nhả ghế. Một con số "tạm" cho một quyết định chung cuộc là mâu thuẫn
tự thân.

Vì sao phải NÓI RA chứ không để im: một giới hạn không được công bố là một cái
bẫy. Bước Amount của stepper vì thế mang đúng một câu — *"Approving happens
once… the rest cannot be refunded from the back office afterwards"* — và đó là
câu quan trọng nhất của cả dialog.

Đường thoát khi thật sự cần hoàn thêm: server **vẫn cho** (§3), nên ca ngoại lệ
xử được bằng công cụ vận hành mà không phải nới UI. Đó là chủ ý: dễ ở đường
ngoại lệ, khó ở đường thường ngày.

### AMEND 3 04/09 — approve với mức hoàn BẰNG 0 phải chạy được

Phát hiện khi thi công stepper. Bậc chính sách (ADR-0030) trả **0%** cho yêu
cầu gửi dưới 7 ngày trước khởi hành. Con số 0 ấy đi vào `classifyRefundAmount`
và ăn `RefundZeroOrNegativeError` → 422, tức **ca huỷ muộn — ca thường gặp nhất
— không approve được**, request kẹt ở `REQUESTED` và ghế không bao giờ được
nhả.

Đây đúng là bug mà cả ADR này sinh ra để chữa, chỉ khác đường vào: §2 chữa ca
"sổ đã settle", còn ca này là "chính sách quyết không hoàn đồng nào". Hai ca
khác nguyên nhân nhưng cùng một sự thật — **không có đồng nào phải chuyển** —
nên phải cùng một cách xử.

Quyết định: gộp hai ca thành một điều kiện `noMoneyToMove = settled ||
approvedZero`. Khi nó đúng thì bỏ qua gate trạng thái thanh toán, KHÔNG gọi
gateway, KHÔNG ghi row sổ (CTE đã có `WHERE amount > 0`), nhưng **vẫn** flip
request → `REFUNDED`, booking → `CANCELLED`, **nhả ghế**, gửi mail.

`classifyRefundAmount` KHÔNG đổi: ở đường W3 (`Issue refund` trực tiếp) một
lệnh hoàn 0 đồng vẫn vô nghĩa và vẫn phải bị từ chối. Chỉ `approve` mới có
khái niệm "duyệt với mức hoàn bằng không", vì chỉ nó còn ba việc khác để làm.

⚠️ Hệ quả cho email: `CANCELLATION_APPROVED` sẽ nói `amount: 0.00`. Mẫu mail
cần một câu riêng cho ca không hoàn đồng nào — ghi vào sổ nợ, chưa làm trong
đợt này.

### AMEND 4 05/09 (vòng vá review) — W3 bị SERVER chặn khi có yêu cầu huỷ mở; sổ settle mà gửi số ≠ 0 là lỗi

Hai lỗ do review 8 mũi ở session gốc chỉ ra:

**a. AMEND 04/09 "ẩn `Issue refund` khi có request mở" chỉ thi hành ở CLIENT.**
`refundByAdmin` không hề đọc `cancellation_requests`, nên một tab cũ, một
script, hay bất kỳ caller nào khác vẫn hoàn đủ tiền qua W3 trong lúc request
còn `REQUESTED` — và admin sau đó bấm **Deny** (đúng nghiệp vụ: "khách đã được
hoàn rồi") thì `cancelled_at` NULL, ghế rò vĩnh viễn, đúng bảng đo ở *Bối cảnh*.
§2 chỉ chữa được nếu admin chọn Approve. Nay `refundByAdmin` đếm request
`REQUESTED` của booking **trong cùng advisory lock** với `approve` và ném
`CANCELLATION_OPEN` (422, mã mới ở `admin.bookings.refund`). Hệ quả: ca "sổ đã
settle qua W3 trong lúc request còn mở" của §2 không còn tới được qua API —
§2 vẫn đúng cho dữ liệu cũ và cho khoản đối soát ghi thẳng vào sổ, int spec mô
phỏng bằng một row `refunds` chèn tay.

**b. Sổ đã settle mà client gửi `refundAmount ≠ 0` thì phải là lỗi.** Bản đầu
ép `amount = 0` bất kể con số client gửi và trả 200: admin mở trang lúc
`refundedTotal = 0.00`, một khoản hoàn đủ đi sau đó, admin submit 50.00 → toast
"Approved", sổ không có dòng nào, không log. Nay ném `NOTHING_LEFT` (map sang
`NOT_REFUNDABLE` của `decide`, nhóm trạng-thái-cũ → dialog đóng + refresh).
`refundAmount = 0.00` hoặc vắng trên sổ đã settle vẫn chạy như §2/§AMEND 3.

Kèm hai chỗ UI: bước Amount đo `nothingLeft` bằng CON SỐ SẮP GỬI chứ không
bằng phần dư (ca bậc 0% trên booking chưa hoàn gì — ca thường gặp nhất — từng
mất câu giải thích và bước Confirm in "Refunds $0.00 … through the payment
provider" trái AMEND 3); và `OVER_TOTAL` vào nhóm trạng-thái-cũ vì ở chế độ
chính sách con số bị khoá, không "nhập lại" được.

### AMEND 5 06/09 (đợt vá W1) — `refundAmount` VẮNG = MỨC CHÍNH SÁCH, không còn "trọn phần dư"

Audit web 05/09 (cụm 3, mức Cao) chỉ ra cửa hậu của §1: nhánh đối chiếu chính
sách (AMEND 4 của ADR-0030 §5b) chỉ chạy **khi client gửi `refundAmount`** —
một caller cầm JWT admin bỏ trống trường ấy là được hoàn TRỌN phần dư không
cần lý do, kể cả trên yêu cầu gửi 3 ngày trước khởi hành (bậc 0%). "Vắng =
trọn phần dư" là hành vi giữ-tương-thích của §1 khi chưa có bảng bậc; từ khi
ADR-0030 cưỡng chế ở server, nó trở thành đúng cái lỗ mà 0030 §5b vá cho
trường hợp có gửi số.

Quyết định:

- `approve` tính `refundPercentForRequest` + `policyRefundAmount` **VÔ ĐIỀU
  KIỆN** (dữ liệu tươi trong advisory lock, như 0030 §5b).
- `refundAmount` vắng → **mặc định = mức chính sách** (bậc 0% ⇒ hoàn 0, đi
  đường `noMoneyToMove` của §AMEND 3 — đóng request, huỷ booking, nhả ghế).
- **MỌI lệch** giữa số sẽ hoàn và mức chính sách đòi `decisionNote`
  (`OFF_POLICY_NOTE_REQUIRED`) — không còn phân biệt "client có gửi số hay
  không". Số bằng chính sách thì như cũ, không cần lý do.
- Stepper admin KHÔNG đổi UI (nó luôn gửi số đã khoá theo bậc); chỉ
  contract/JSDoc phải thôi hứa "vắng = hoàn trọn phần dư".

Tương thích: caller "cũ" duy nhất dựa vào vắng-=-trọn-phần-dư là int test —
sửa test theo ngữ nghĩa mới. Trong cửa sổ ân hạn 24h (ADR-0030 §3c) chính
sách là 100% nên vắng vẫn ra trọn phần dư — các flow test tạo-rồi-huỷ-ngay
không đổi kết quả.

## Phương án đã cân nhắc rồi loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ cửa một chiều, chặn bằng stepper nhiều bước | Chữ nghĩa không cứu được lỗi ngón tay. Gõ nhầm một chữ số là khoá vĩnh viễn tiền của khách, và đường sửa duy nhất là vào dashboard Stripe làm tay — tức ra ngoài mọi sổ sách của hệ thống. |
| Không cho approve một phần, giữ nguyên hiện trạng | Ít việc nhất nhưng mất hẳn nhu cầu chính sách huỷ theo mốc thời gian, thứ `freeCancellationDays` đã ngụ ý từ ADR-0023. |
| Cho `Issue refund` (W3) xuất hiện trên màn quyết định | Dựng lại đúng cái bẫy vừa đo, ở chỗ nguy hiểm nhất: hai nút cùng chuyển tiền đứng cạnh nhau, chỉ một cái đóng request và nhả ghế. |
| Để Deny nhả ghế khi booking đã hoàn đủ | Deny nghĩa là "tôi từ chối yêu cầu huỷ" → khách vẫn đi → ghế phải giữ. Bắt nó nhả ghế là làm một từ mang hai nghĩa ngược nhau. |
| Để admin tự gõ số tiền, hệ thống chỉ bày dữ kiện | Đây là bản ĐẦU của ADR này, user bác 04/09. Một ô nhập tự do là một ô gõ nhầm được; bảng bậc cố định (ADR-0030) vừa chặn gõ nhầm vừa cho hai admin xử hai ca giống nhau ra cùng con số. |
| Endpoint riêng cho "refund khi duyệt huỷ" | Hoàn tiền khi duyệt không phải lệnh độc lập — cùng transaction, cùng lock, cùng lượt nhả ghế với quyết định. Tách ra là tái lập đúng ca W3/W4 chồng lấn đã sinh ra bug. |
