# ADR-0033 — Báo cáo có KẾT QUẢ KINH DOANH, không chỉ dòng tiền

- **Trạng thái:** Accepted (2026-09-05)
- **Bối cảnh thi hành:** nhánh `fix/p4c-backend-logic`, đi trước code theo luật
  CLAUDE.md #5
- **Liên quan:** [ADR-0028](0028-bookings-stats-follow-filter.md) (định nghĩa
  doanh thu neo `paid_at` — ADR này **giữ nguyên** nó và dựng một cách đọc THỨ
  HAI bên cạnh) · [ADR-0009](0009-refund-correctness.md) (sổ cái `refunds`) ·
  [ADR-0030](0030-refund-policy-tiers.md) (bậc hoàn tiền sinh ra dòng tiền ra) ·
  spec P4b §3-F6 · [ADR-0034](0034-excel-report-export.md) (form Excel in ra
  chính những con số quyết ở đây)

## Bối cảnh

Góp ý của giảng viên nhắm vào ĐỊNH DẠNG file xuất, nhưng vòng rà 05/09 mở file
ra thì thấy vấn đề nằm sâu hơn một tầng: **không có con số nào để mà xuất cho
đẹp**. Bốn sự thật đo được trong code, không phải đọc lướt:

**1. Không có khái niệm giá vốn nào đang sống — nhưng móng thì có sẵn.**
`Tour.costPrice` nằm trong `schema.prisma` từ migration `init`, comment ghi rõ
*"Chi phí trên mỗi traveller theo currency của tour (margin analytics)"*. Grep
toàn repo (trừ `src/generated/`): **không một dòng code nào đọc hay ghi nó.**
Cột chết từ ngày đầu, port nguyên từ Nexora.

**2. Không có thuế, ở đâu cả.** `grep -in 'tax\|vat' schema.prisma` trả về đúng
hai kết quả, cả hai là chữ *taxonomy* trong comment của bảng tag blog.
`Booking.totalAmount` là MỘT con số phẳng — không có phần thuế, không có phí,
không có gì tách ra được.

**3. Hoàn tiền cố ý KHÔNG trừ vào doanh thu.** Contract nói thẳng:

> *"KHÔNG trừ vào `revenue` … đây là dòng tiền ĐI RA của tháng, không phải một
> phép hiệu chỉnh doanh thu."*

Đúng — cho một báo cáo DÒNG TIỀN. Nhưng đó là bảng duy nhất đang có, nên trang
`/reports` chỉ có một cách đọc, và cách đọc đó không trả lời được câu hỏi mà
mọi người mở một báo cáo tháng ra để hỏi: *tháng này lãi hay lỗ.*

**4. `revenue` neo `paid_at` — đó là tiền VÀO, không phải doanh thu.** Ngành
tour ghi nhận doanh thu khi chuyến CHẠY; tiền thu trước ngày khởi hành là **nợ
phải trả** (deferred revenue) chứ chưa phải doanh thu. Hôm nay mình đang gọi
tiền đặt cọc của một chuyến tháng 12 là doanh thu tháng 9.

Bốn thứ cộng lại: bốn stat card của `/reports` (Revenue · Paid bookings · New
bookings · Refunded) **không có card nào nói được lãi lỗ**, và không thể có
chừng nào chưa có giá vốn.

## Quyết định

### 1. HAI cách đọc, đặt cạnh nhau — không thay cái cũ

Báo cáo tháng mọc thêm một cột, không sửa cột đang có:

| | Neo vào | Trả lời câu hỏi |
| --- | --- | --- |
| **Dòng tiền** (đang có) | `paid_at` · `refunds.created_at` | Tháng này tiền vào ra bao nhiêu |
| **Kết quả kinh doanh** (MỚI) | `departure_end_date` | Những chuyến CHẠY trong tháng này lãi bao nhiêu |

Vì sao không đổi định nghĩa cũ mà lại thêm cột: `revenue` neo `paid_at` đang
nuôi stat card `/bookings`, `admin.stats.bookings`, và chính bất biến "kỳ trước
dài bằng kỳ này" của ADR-0028. Đổi nghĩa nó là đổi ý nghĩa của một pill delta
đang hiển thị trên ba trang — trong khi thứ ta cần chỉ là một cách đọc nữa.
Hai cột đứng cạnh nhau còn dạy được người đọc sự khác nhau, thứ mà một cột đổi
nghĩa trong im lặng thì không.

**Mốc ghi nhận là `departure_end_date`, không phải `departure_start_date`.**
Chuẩn ngành cho bên bán tour với tư cách chủ thể (principal) là ghi nhận **theo
tiến độ chuyến chạy**; chia doanh thu một chuyến 5 ngày vắt qua hai tháng là
đúng nhất nhưng đắt và khó kiểm. Chốt **ghi nhận trọn vẹn khi chuyến KẾT
THÚC** — thời điểm nghĩa vụ hoàn tất, và là **đúng cái mốc `reviewSlot()` bên
web đã dùng** để quyết "chuyến đã xong chưa". Một mốc, hai nơi.

### 2. Danh mục giá vốn ở cấp tour, mỗi dòng mang cờ cố-định / biến-đổi

```prisma
enum TourCostBasis {
  /// Tiền cho MỖI khách — ăn uống, vé vào cửa, giường khách sạn.
  PER_PERSON
  /// Tiền cho MỘT CHUYẾN, không đổi theo số khách — thuê xe, công hướng dẫn,
  /// giấy phép. Đây là cờ khiến mọi luật bên dưới nói được thành câu.
  PER_DEPARTURE
}

enum TourCostCategory {
  TRANSPORT
  ACCOMMODATION
  MEALS
  GUIDE
  ACTIVITIES
  PERMITS
  INSURANCE
  OTHER
}

model TourCostItem {
  id        String           @id @default(uuid()) @db.Uuid
  tourId    String           @map("tour_id") @db.Uuid
  category  TourCostCategory
  label     String           @db.VarChar(120)
  amount    Decimal          @db.Decimal(14, 2)
  basis     TourCostBasis
  sortOrder Int              @default(0) @map("sort_order")
  createdAt DateTime         @default(now()) @map("created_at")
  updatedAt DateTime         @updatedAt @map("updated_at")

  tour Tour @relation(fields: [tourId], references: [id], onDelete: Cascade)

  @@index([tourId, sortOrder])
  @@map("tour_cost_items")
}
```

Kèm CHECK `amount >= 0` ở migration — giá vốn âm không có nghĩa nào, và một
dấu trừ gõ nhầm sẽ làm lợi nhuận phình lên chứ không nổ ra.

**Tiền theo currency của TOUR, không có cột currency riêng từng dòng.** Thêm
currency ở đây là mở cửa cho quy đổi ngoại tệ — một hệ khác hẳn, có tỉ giá và
ngày hiệu lực. Nền tảng hiện một-đồng-tiền (cảnh báo group-by đã ghi ở
`schemas/stats.ts`); giới hạn này đi cùng giới hạn ấy, không mở rộng nó.

**`Tour.costPrice` sống lại như một giá trị DẪN XUẤT**, tính lại trong CÙNG
transaction mỗi lần danh mục đổi:

```
costPrice = Σ(PER_PERSON.amount) + Σ(PER_DEPARTURE.amount) ÷ maxGroupSize
```

Đây đúng công thức operator thật dùng (*chi phí cố định ÷ số khách trung bình +
chi phí biến đổi mỗi khách*), và đúng khuôn denormalize mà repo đã có:
`Tour.ratingAvg`/`ratingCount` cũng là số dẫn xuất cập nhật trong cùng
transaction duyệt review, chính vì thế nó không bao giờ lệch. Không bịa khuôn
mới.

`costPrice` là số để **bán hàng** (một con số cho mỗi khách, đủ để đặt giá và
xem biên); nó KHÔNG phải số dùng cho báo cáo — báo cáo dùng hai vế tách riêng ở
§3.

### 3. Đóng băng vào giao dịch, không join sống

| Cột mới | Ở đâu | Chụp cái gì, lúc nào |
| --- | --- | --- |
| `cost_per_person` `Decimal(14,2)?` | `bookings` | Σ `PER_PERSON` của tour, tại lúc **tạo booking** |
| `fixed_cost_amount` `Decimal(14,2)?` | `tour_departures` | Σ `PER_DEPARTURE` của tour, tại lúc **tạo chuyến**; admin sửa đè được |

Lý do là lý do đã có sẵn trong chính bảng `bookings`: nó đang snapshot
`unit_price`, `tour_title`, `departure_start_date`, `departure_end_date` (audit
H3 — *"thứ khách đã mua không bao giờ render lại khi tour bị sửa"*). Giá vốn
cùng hạng: join sống thì sửa giá thuê xe hôm nay sẽ **viết lại lợi nhuận của
báo cáo tháng trước**, và một báo cáo đọc lại ra số khác là một báo cáo vô
dụng.

`fixed_cost_amount` để trên `tour_departures` chứ không cộng vào booking là
điều kiện để §4 nói được thành câu — và nó cho không khả năng đè giá vốn riêng
cho một chuyến (mùa cao điểm xe đắt hơn) mà **không** bắt admin nhập gì thêm:
ô đã điền sẵn từ tour.

Cả hai **nullable**. Tour chưa khai giá vốn thì null, và báo cáo phải **nói ra
là thiếu** (§6) chứ không im lặng coi bằng 0 — đúng bài học `money` của email
hoàn tiền, nơi `'0.00'` truthy đã hứa với khách một khoản tiền không tồn tại.

### 4. Khách huỷ: chi phí cố định Ở LẠI, chi phí biến đổi ĐI THEO KHÁCH

Xe vẫn chạy dù một khách huỷ; suất ăn của người ấy thì không ai gọi. Nên:

- **Giá vốn biến đổi** chỉ cộng cho booking **thật sự đã đi** — trạng thái
  `PAID` hoặc `PARTIALLY_REFUNDED`. `CANCELLED`/`REFUNDED` không góp đồng nào.
- **Giá vốn cố định** cộng **một lần cho mỗi chuyến ĐÃ CHẠY**, bất kể bán được
  bao nhiêu ghế. "Đã chạy" = `status != CANCELLED` **và** có ít nhất một
  booking đã đi. Chuyến không ai đặt thì không chạy, nên không tốn gì.

Đây là luật mà một cột giá vốn gộp **không diễn đạt được**, và là lý do cờ
`basis` đáng giá cả một bảng mới.

### 5. Thuế tính trên MARGIN, không trên giá bán

Thuế của ngành lữ hành tính trên **phần chênh giữa giá bán và giá vốn dịch vụ
mua vào**, không trên toàn bộ giá bán — đó là Tour Operators' Margin Scheme mà
EU/UK áp cho chính loại hình này. Giá bán đã bao gồm thuế, nên:

```
taxAmount = max(0, grossProfit) × rate ÷ (1 + rate)
```

`max(0, …)` không phải phòng thủ thừa: **margin âm thì không có thuế** — đó là
luật của scheme, không phải một cách làm tròn. (Ở mức 20% công thức này ra đúng
*một phần sáu của margin*, con số nghề nghiệp hay nói.)

**Thuế suất khai bằng biến môi trường `MARGIN_TAX_RATE`** (mặc định `0`, đi qua
`EnvSchema` như mọi biến khác). Không dựng bảng cấu hình: chưa có bảng setting
nào trong schema, và dựng một bảng cho một con số là dựng sai kích cỡ.

⚠️ **Giới hạn phải biết:** biến môi trường không có ngày hiệu lực, nên đổi thuế
suất sẽ đổi luôn số thuế của MỌI báo cáo cũ khi đọc lại. Vá bằng cách rẻ nhất
có tác dụng: **in thuế suất lên chính báo cáo** (trên màn hình và trong khối
đầu file Excel), để một tờ báo cáo tự nói nó được tính bằng mức nào. Ngày nào
thuế suất thật sự đổi thì đường đi đúng là một bảng tỉ lệ có ngày hiệu lực —
cùng loại việc mà `subscribersStats` đã ghi nợ cho consent.

### 6. Phí cổng thanh toán, và sự trung thực về dữ liệu thiếu

**Phí:** `PAYMENT_FEE_RATE` + `PAYMENT_FEE_FIXED` (mặc định `0`), tính trên
đúng tập booking được ghi nhận trong kỳ — mỗi booking là một giao dịch:

```
paymentFees = Σ (totalAmount × PAYMENT_FEE_RATE) + (số booking × PAYMENT_FEE_FIXED)
```

Không đọc phí thật từ webhook provider: Stripe để phí trong
`balance_transaction`, tức thêm một lượt gọi API cho mỗi payment và một cột
nữa để lưu. Tỉ lệ cấu hình đủ đúng cho một báo cáo tháng, và đường nâng cấp sau
này là thêm cột `fee_amount` trên `payment_events` — cộng thêm, không phải viết
lại.

**Dữ liệu thiếu:** báo cáo trả về `costDataMissing` = **số booking trong kỳ
không có `cost_per_person`**. Con số ấy hiện trên màn hình và trong file. Một
báo cáo có 12 booking thiếu giá vốn mà vẫn in "Lợi nhuận gộp $8,400" là một báo
cáo nói dối; in kèm *"12 booking chưa khai giá vốn"* thì nó chỉ là chưa đầy đủ.

### 7. Số ghế hoà vốn — có sẵn, không tốn dữ liệu nào

Có cờ `basis` rồi thì:

```
ghế hoà vốn = ⌈ Σ PER_DEPARTURE ÷ (unitPrice − Σ PER_PERSON) ⌉
```

Không cần bảng nào, cột nào. Hiện trên màn tour trong admin cạnh
`seatsTotal`/`seatsBooked` — con số mà mọi operator thật đều biết cho từng
chuyến, và là thứ khiến giả định `÷ maxGroupSize` ở §2 nhìn thấy được thay vì
nằm im.

Mẫu số `≤ 0` (giá bán không bù nổi chi phí biến đổi) → không có điểm hoà vốn,
hiện chữ chứ không hiện `∞`.

### 8. Cái KHÔNG đổi

- Định nghĩa `revenue` neo `paid_at`, gross — nguyên vẹn, cùng mọi stat card
  đang ăn nó.
- `refundedTotal` vẫn là **dòng tiền ra của kỳ**, vẫn KHÔNG trừ vào `revenue`.
  Phép trừ hoàn tiền chỉ xảy ra ở cột kết quả kinh doanh, trên tập booking đã
  đi.
- **Stat card `/bookings` giữ nguyên.** Đó là trang vận hành, câu hỏi của nó là
  dòng booking; phần tài chính thuộc về `/reports`. Ranh giới này là quyết
  định, không phải sự bỏ sót.
- Không có bảng deferred-revenue, không có bút toán, không có sổ cái kế toán.
  Hai cách đọc là hai câu SQL trên dữ liệu đang có — không phải một hệ kế toán.

## AMEND 1 05/09 (vòng vá review) — ba chỗ §3/§4 chưa khép, và hai giới hạn mới

**a. Chuyến bị HUỶ không góp doanh thu.** §4 định nghĩa "đã chạy" (`status !=
CANCELLED` và có khách đã đi) cho vế giá vốn cố định nhưng vế doanh thu chỉ
lọc theo trạng thái BOOKING. Khách còn `PAID` trên một chuyến bị huỷ (bão, huỷ
ngày 28, tiền chưa kịp hoàn) vì thế góp 500 doanh thu + 30 giá vốn biến đổi
mà 0 tiền xe — một chuyến không hề chạy đóng góp biên ~94%, và càng huỷ nhiều
chuyến báo cáo càng đẹp. Nay `recognizedRevenueSlice` JOIN `tour_departures`
với cùng vế `status <> CANCELLED`: **"chuyến đã chạy" chỉ có MỘT định nghĩa
trong cả kỳ.** Tiền khách đã trả cho chuyến huỷ là khoản nợ khách, không phải
doanh thu; nó ở lại cột dòng tiền (`revenue` theo `paid_at`) cho tới khi hoàn.

**b. Nhãn tiền có nguồn thứ ba.** `currency` suy từ payment rồi refund trong
kỳ — cả hai neo DÒNG TIỀN — rồi dán lên cả khối P&L vốn neo ngày chuyến kết
thúc. Tháng không có payment/refund nào nhưng có chuyến chạy (đúng ca int spec
dựng: trả tiền tháng 4, chuyến chạy tháng 5) in `$` lên số EUR. Nay
`recognizedRevenueSlice` trả `currency` của chính tập nó, và 'USD' chỉ còn khi
cả ba nguồn rỗng.

**c. `departuresCostMissing`.** §3 nói "báo cáo phải nói ra là thiếu" nhưng §6
chỉ định nghĩa `costDataMissing` cho booking; vế `tour_departures` rơi vào
`COALESCE(…, 0)` im lặng — trong khi hôm nay không đường code nào ngoài seed
ghi `fixed_cost_amount`, tức mọi chuyến tạo tay đều NULL và `netProfit` phình
đúng bằng tiền xe mà `costWarning` không hiện. Thêm một field, một dòng
Summary, một vế câu cảnh báo.

**Ràng buộc cho phase `/tours`:** kỳ của khối P&L neo `bookings.departure_end_date`
(snapshot lúc tạo) còn `cogsFixed`/`departuresRun` neo `tour_departures.end_date`
(sống). Hai cột bằng nhau cho tới khi ai đó DỜI LỊCH một chuyến — lúc ấy doanh
thu ở tháng cũ, tiền xe ở tháng mới. Form sửa chuyến, khi ra đời, **phải cập
nhật `departure_end_date` của mọi booking trong cùng transaction**, hoặc cả
hai vế cùng neo một cột. Ghi ở đây để không ai viết form ấy mà không biết.

## Hình dạng câu trả lời

`AdminMonthlyReportSchema` mọc thêm (mọi tiền là `DecimalStringSchema`):

| Field | Nghĩa |
| --- | --- |
| `recognizedRevenue` | Σ (`totalAmount` − đã hoàn) của booking đã đi, chuyến kết thúc trong kỳ |
| `cogsVariable` · `cogsFixed` · `cogsTotal` | §4 |
| `grossProfit` | `recognizedRevenue` − `cogsTotal` |
| `grossMarginPct` | `number \| null` — **null khi `recognizedRevenue` = 0**, không phải 0 |
| `taxRate` · `taxAmount` | §5 — tỉ lệ đi kèm để tờ báo cáo tự khai |
| `paymentFees` | §6 |
| `netProfit` | `grossProfit` − `taxAmount` − `paymentFees` |
| `departuresRun` | Số chuyến đã chạy trong kỳ — mẫu số của `cogsFixed`, để kiểm chéo |
| `costDataMissing` | §6 |

`grossMarginPct` null-khi-mẫu-số-0 chứ không phải `0`: một tháng không có
chuyến nào chạy có biên gộp **không xác định**, và in `0.0%` là nói tháng ấy
hoà vốn trắng.

Bốn stat card của `/reports` đổi thành **Doanh thu ghi nhận · Lợi nhuận gộp
(kèm biên %) · Lợi nhuận ròng · Tiền thu trong kỳ** — ba card kinh doanh, một
card dòng tiền giữ lại làm mỏ neo sang cách đọc cũ. Vẫn không có pill delta,
vì lý do cũ vẫn đúng: hai tháng lịch dài khác nhau.

## Phương án đã cân nhắc và bỏ

**Đổi thẳng `revenue` sang neo ngày chạy tour.** Đúng về kế toán, và là điều
một hệ thật sẽ làm. Bỏ vì nó đổi nghĩa một con số đang hiển thị trên ba trang
và đang là cơ sở của pill delta ADR-0028 — cái giá nằm ngoài phạm vi đợt này,
và hai cột đứng cạnh nhau đạt được cùng mục đích mà còn dạy được người đọc.

**Năm cột giá vốn cố định trên `tours`** (`cost_transport`, `cost_meals`, …).
Rẻ nhất, không bảng mới. Bỏ vì hạng mục thứ sáu là một migration cộng sửa
contract cộng sửa form — và vì nó không chỗ nào để nhét cờ `basis`, tức không
diễn đạt được §4.

**Chi phí nhập riêng cho từng chuyến khởi hành.** Sát operator thật nhất. Bỏ vì
nó bắt admin nhập giá vốn cho MỖI chuyến, trong khi `fixed_cost_amount` điền
sẵn từ tour (§3) lấy được gần hết lợi ích với chi phí nhập liệu bằng không.

**Bảng cấu hình tài chính có ngày hiệu lực.** Đúng cho thuế suất đổi theo thời
gian. Bỏ vì chưa có bảng setting nào trong schema và một con số không đáng một
bảng; giới hạn đã ghi tường minh ở §5 kèm đường đi nếu ngày ấy tới.

## Giới hạn đã biết

1. **`÷ maxGroupSize`** ở `costPrice` là cách đọc lạc quan — chuyến bán nửa ghế
   thì giá vốn mỗi khách thật sự cao hơn. Không ảnh hưởng báo cáo (báo cáo dùng
   hai vế tách riêng ở §3, không dùng `costPrice`), chỉ ảnh hưởng con số bán
   hàng trên màn tour; §7 khiến nó nhìn thấy được.
2. **Trẻ em tính giá vốn như người lớn**, vì chúng cũng **trả tiền như người
   lớn**: `totalAmount = unitPrice × (numAdults + numChildren)`. Ngày nào có
   giá trẻ em thì giá vốn trẻ em là việc của cùng đợt đó.
3. **Phí hoàn tiền không tính.** Provider thường không trả lại phí gốc khi
   hoàn; mô hình tỉ lệ ở §6 không diễn tả được điều đó.
4. **Chi phí vận hành (overhead)** — lương, văn phòng, marketing — không có ở
   đâu cả. Nên `netProfit` ở đây là lợi nhuận **sau giá vốn, thuế và phí cổng**,
   KHÔNG phải lợi nhuận ròng của doanh nghiệp. Nhãn trên màn hình và trong file
   phải nói đúng chừng ấy, không hơn.
5. **Khối P&L của một kỳ ĐÃ ĐÓNG vẫn đổi số** (vòng vá review 05/09).
   `recognizedRevenue` trừ MỌI khoản hoàn của booking không kể tháng hoàn, và
   lọc theo trạng thái booking HIỆN TẠI: một khoản hoàn tháng 7 viết lại báo
   cáo tháng 5, hoàn đủ (→ `REFUNDED`) thì booking biến khỏi tháng 5 và nếu nó
   là booking duy nhất của chuyến, `departuresRun`/`cogsFixed` tụt về 0. Trái
   với chính câu "một báo cáo đọc lại ra số khác là một báo cáo vô dụng" ở
   §3. Chữa thật cần cột snapshot theo kỳ (hoặc chốt số vào bảng `report_months`
   lúc tháng đóng) — một ADR riêng. `subscribersStats` đã ghi cùng cảnh báo
   cho `unsubscribed`; nay ghi ở đây.
