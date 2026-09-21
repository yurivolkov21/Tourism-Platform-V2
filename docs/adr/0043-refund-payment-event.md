# ADR-0043 — Hoàn tiền để lại vết ở sổ `payment_events`

- **Trạng thái:** Accepted (2026-09-21, phiên brainstorming; ADR đi trước code)
- **Bối cảnh:** hai khoản hoàn THẬT trên prod (18/09, nghiệm thu sandbox) không
  có dòng nào ở `payment_events`, nên trang `/payment-events` của admin không
  bao giờ thấy tiền đi ra.
- **Liên quan:** [ADR-0002](0002-payment-gateway-refund-ledger.md) (sổ hoàn tiền
  append-only — giữ nguyên, ADR này KHÔNG đụng vào `refunds`) ·
  [ADR-0006](0006-pending-lifecycle.md) (vòng đời PENDING, các nhánh auto-refund
  AMEND 1b/1d/2a) · [ADR-0009](0009-refund-correctness.md) (advisory lock và
  trigger `SUM ≤ total` — mọi thứ ở đây chạy TRONG khoá đó) ·
  [ADR-0041](0041-single-cancellation-deadline.md) (khách tự huỷ — đường sinh ra
  hai khoản hoàn nói trên)

## Bối cảnh

### Triệu chứng

Trên prod, hai booking `BK-7WKW9ESB` và `BK-PY7IZMD4` được đặt rồi huỷ bằng tay
để nghiệm thu. Cả hai đều có dòng sổ `refunds` đúng, tiền đã về thật ở Stripe
test mode, nhưng `payment_events` chỉ có mỗi event `payment.completed` của lượt
thu. Trang `/payment-events` — kính soi tiền của admin — vì vậy chỉ kể được nửa
câu chuyện.

### Ba nguyên nhân, không phải một

**1. Không đường hoàn nào ghi `payment_events`.** Đúng ba chỗ ghi dòng sổ
`refunds` — hoàn thiện chí của admin (`RefundsService.refundByAdmin`), khách tự
huỷ (`CancellationsService.cancelInLock`), và auto-refund của money-path
(`PaymentsService`, nhánh overbooked/departure-closed/capture-on-cancelled) — cả
ba chỉ ghi `refunds`. Không phải quên: sổ `refunds` vốn được thiết kế là nơi DUY
NHẤT ghi tiền đi ra (ADR-0002), còn `payment_events` được hiểu là sổ webhook.

**2. Bật `charge.refunded` ở dashboard KHÔNG cứu được.** Với Stripe,
`data.object` của `charge.refunded` là một **Charge**. Ta chỉ đặt
`metadata[bookingId]` trên Checkout Session, không bao giờ đặt
`payment_intent_data[metadata]`, nên Charge không mang metadata đó.
`mapStripeEvent` đọc `object.metadata?.bookingId` và `object.amount_total` —
Charge không có cả hai. Row nhận được sẽ là `type: 'other'`, `bookingId: null`,
`amount: null`: đúng hình dạng hai row "Other / Not linked" mà prod đã ghi hôm
18/09. Tức hướng "bật thêm event" một mình chỉ đẻ thêm rác, không giải quyết gì.

**3. Seed và code thật ghi cột `type` theo hai quy ước khác nhau.** Đây là chỗ
đau nhất và là thứ khiến hai nguyên nhân trên không thể vá riêng lẻ:

- Code thật: `PaymentsService.beginEvent` ghi `type: verified.type`, tức **type
  TRUNG LẬP** (`payment.completed` / `payment.failed` / `payment.expired` /
  `other`) — rừng event của provider đã bị gateway gom lại trước đó.
- Seed: `apps/api/prisma/fixtures/operations/bookings.ts` ghi **type THÔ của
  provider** (`checkout.session.completed`, `charge.refunded`,
  `PAYMENT.CAPTURE.REFUNDED`).

Hệ quả: không chỉ dòng hoàn lệch — cả dòng thu cũng lệch, và mọi row seed nằm
NGOÀI bộ lọc type của admin (`PAYMENT_EVENT_TYPES` chỉ có bốn giá trị trung lập)
nên không lọc được và không có nhãn i18n. Bất biến nghiệm thu seed
(`verify-seed.mjs`, mục "refund không có đúng một payment event hoàn") đòi
`type in ('charge.refunded', 'PAYMENT.CAPTURE.REFUNDED')` — hai chuỗi mà đường
thật không bao giờ ghi. **Bất biến ấy không thể đúng với dữ liệu thật dù chọn
hướng nào**, nên sửa vết hoàn mà bỏ qua từ vựng type là vá nửa vời.

## Quyết định

### 1. `payment_events` là sổ sự kiện tiền của cổng, không chỉ là sổ webhook

Đổi nghĩa bảng một cách tường minh: nó ghi **mọi sự kiện tiền giữa ta và cổng
thanh toán**, chiều vào (webhook đã verify chữ ký) lẫn chiều ra (khoản hoàn ta
chủ động phát). Row hoàn KHÔNG phải dữ liệu bịa: Stripe/PayPal thật sự có phát
event hoàn cho mỗi lệnh refund — ta chỉ ghi nó **từ response của API refund**
thay vì ngồi đợi webhook echo về.

### 2. Type thứ năm: `payment.refunded`

`VerifiedEvent['type']` thêm `payment.refunded`, và JSDoc của union đổi nghĩa
theo: nó là **từ vựng của cột `payment_events.type`**, không còn là "thứ
`verifyWebhook` phát ra". Hôm nay `verifyWebhook` phát bốn giá trị đầu; giá trị
thứ năm do lõi hoàn tiền ghi — và sẽ là đích map của `charge.refunded` nếu về
sau làm phần đối soát webhook (§6).

Kéo theo, tất cả đã có lưới bằng máy:

- `PAYMENT_EVENT_TYPES` ở `@tourism/contract`;
- nhãn i18n `'payment.refunded': 'Refund issued'` (luật 7: copy tiếng Anh);
- một icon trong `TYPE_ICONS` của menu lọc admin — `Undo2`, chưa icon nào trên
  trang đó dùng;
- `payment-event-row.spec.ts` đã ép hai chiều tuple ⊆ union và union ⊆ tuple,
  nên quên chỗ nào là đỏ typecheck.

**Không có migration.** Cột `type` là `varchar(100)` tự do, không phải enum
Prisma — không có gì phải deploy lên Supabase.

### 3. Lõi hoàn tiền tự ghi row, nguyên tử với dòng sổ

Một builder THUẦN (`apps/api/src/modules/payments/refund-event.ts`) dựng data
row; ba call-site gọi nó TRONG đúng transaction đang ghi dòng `refunds` — tức
vẫn trong advisory lock của ADR-0009.

| Cột | Giá trị |
| --- | --- |
| `provider` | `paymentProvider` của booking |
| `eventId` | `providerRefundId` (`re_…` / id refund PayPal) |
| `type` | `payment.refunded` |
| `amount` / `currency` | đúng dòng sổ |
| `bookingId` | booking được hoàn |
| `processed_at` = `received_at` | `refunds.created_at` |
| `payload` | `{ source: 'refund-core', cause, refundId, providerRefundId, providerPaymentId, amount, currency }` |
| `note` | null |

`eventId` lấy `providerRefundId` vì nó unique ở phía provider và không đụng dải
id event (`evt_…` / `WH-…`) — khoá `@@unique([provider, eventId])` vì vậy vẫn là
lớp chống trùng thật, không phải khoá trang trí.

Mốc thời gian khớp CHÍNH XÁC, không phải xấp xỉ: hai nhánh Prisma lấy
`refundRow.createdAt` mà `create` trả về; nhánh CTE của đường huỷ cho
`refund_insert` `RETURNING id, created_at` rồi một CTE `pe_insert` đọc từ đó —
cùng `now()` của một transaction.

`payload` CỐ Ý không chứa response thô của cổng: lấy được nó phải mở rộng
`PaymentGateway.refund` trả thêm body, kéo theo cả hai gateway thật + FakeGateway
+ spec, mà thứ nhận về chỉ là tiếng vọng của chính lệnh ta vừa gửi. Khoá `source`
nói thẳng row này do ta ghi — đọc drawer không bị hiểu nhầm là webhook.

### 4. Ba khoản hoàn NGOÀI sổ không sinh row

Ba nhánh hoàn không ghi `refunds` — capture lệch tiền (ADR-0006 AMEND 1d),
capture trùng trên booking đã settle (AMEND 1b), và nhánh off-ledger của
auto-refund — giữ nguyên như cũ. Chúng đã để lại vết bằng cột `note` trên chính
event capture (AMEND 2a), và chúng vốn KHÔNG được ghi sổ vì tiền ấy nằm ngoài
`total_amount` (ghi vào là phá trigger `SUM ≤ total`). Giữ luật gọn: **một dòng
`refunds` ↔ đúng một row `payment.refunded`**.

### 5. Seed nói thật, bất biến đo được

- `suKienThu` → `payment.completed`; `suKienHoan` → `payment.refunded`, `eventId`
  đổi sang `maHoan(...)` để giống hình dạng thật.
- `verify-seed.mjs` đổi danh sách type của bất biến thành `('payment.refunded')`.
- Phần thưởng kèm theo: từ nay row seed lọc được bằng Select type của admin và
  có nhãn i18n — hiện tại thì không.

Hai khoản hoàn cũ trên prod **không backfill**: lượt seed lại prod khoảng 03/11
(ADR-0041 Phụ lục B Bước 8) xoá sạch chúng, nên viết migration backfill là làm
việc rồi bị xoá. Bất biến sẽ còn báo 2 cho tới lượt seed đó — ghi nhận ở
CHANGELOG, không phải lỗi mới.

### 6. Đối soát webhook: để dành, không làm bây giờ

Bật `charge.refunded` / `PAYMENT.CAPTURE.REFUNDED` ở dashboard có một giá trị mà
§3 không bao giờ có: bắt được khoản hoàn do người bấm tay thẳng trên dashboard
cổng. Nhưng nó cần sửa mapper lấy amount từ đúng field của Charge/refund
resource, cần một bước tra `bookings.provider_payment_id` mà mapper (hàm thuần,
không chạm DB theo thiết kế) không làm được nên phải nằm ở `beginEvent`, và nó
bất đồng bộ nên mốc không bao giờ khớp `refunds.created_at`. Giữ nó ở dạng **báo
cáo đối soát CHỈ ĐỌC** khi nào cần, không làm đường ghi thứ hai — hai nguồn cùng
ghi một sự thật là chỗ đẻ row trùng.

## Hệ quả

- Chỉ số `paymentEvents.received` của dashboard admin từ nay gộp cả row hoàn do
  ta ghi. **Vẫn đếm** (quyết định của user 21/09): mô tả đổi từ "thông lượng
  webhook" sang "số dòng sổ sự kiện tiền trong kỳ". Loại trừ một type ra khỏi
  một chỉ số thông lượng là đúng thứ luật-chồng-luật mà rồi không ai nhớ.
- Chỉ số `linked` tăng thật: row hoàn luôn mang `bookingId`.
- JSDoc "sổ webhook Stripe/PayPal" ở `libs/shared/contract/src/schemas/payment-events.ts`
  và ở `stats.service.ts` phải viết lại theo §1 — code là nguồn sự thật, doc
  lệch thì sửa doc.
- Nghiệm thu: huỷ một booking sandbox trên site thật → `/payment-events` có dòng
  `Refund issued` gắn đúng booking, đúng số tiền.

## Phương án đã cân nhắc và bỏ

**Chỉ bật webhook rồi map lại `booking_id`.** Bỏ vì §Bối cảnh điểm 2: với Stripe
event hoàn không mang nổi metadata lẫn amount, nên phải thêm một tầng tra DB
trong lúc vẫn phụ thuộc cấu hình dashboard mà agent không được đụng (luật 15).
Giữ lại làm đối soát (§6), không làm nguồn sự thật.

**Không đụng money-path: giữ `payment_events` thuần webhook, cho admin đọc sổ
`refunds` ở một vùng khác.** Rẻ nhất và rủi ro bằng 0 với đường tiền, và nó có
lý về mặt ngữ nghĩa — khoản hoàn ta phát không phải thứ cổng "nói với ta". Bỏ vì
nó không đạt nghiệm thu user đặt ra (dòng hoàn phải hiện ở `/payment-events`), và
vì lập luận "row là dữ liệu bịa" không đứng được: cổng THẬT SỰ có phát event
hoàn, ta chỉ ghi sớm từ response thay vì đợi echo.

**Ghi row nhưng giữ type thô `charge.refunded`.** Bỏ vì nó hợp thức hoá đúng cái
lệch pha ở §Bối cảnh điểm 3: cột `type` sẽ mang hai quy ước cùng lúc, bộ lọc
admin tiếp tục không thấy row hoàn, và mỗi lần thêm provider lại phải thêm một
chuỗi thô nữa vào bất biến.
