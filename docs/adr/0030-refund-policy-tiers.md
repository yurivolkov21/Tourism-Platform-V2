# ADR-0030 — Chính sách hoàn tiền thành bậc CƯỠNG CHẾ, một nguồn cho cả văn bản lẫn phép tính

- **Trạng thái:** Accepted (2026-09-04)
- **Bối cảnh thi hành:** nhánh `fix/p4c-backend-logic`, đi trước code theo luật
  CLAUDE.md #5
- **Liên quan:** [ADR-0029](0029-cancellation-approve-partial-refund.md) (cơ chế
  approve nhận số tiền; ADR này quyết SỐ TIỀN là bao nhiêu) ·
  [ADR-0023](0023-tour-merchandising-fields.md) (`freeCancellationDays`) ·
  `libs/shared/i18n/src/lib/legal/cancellation.ts` và `legal/terms.ts` (văn bản
  công khai — ADR này **sửa nội dung**)

## Bối cảnh

Site đã công bố bậc hoàn tiền ở **hai** trang, trùng khớp nhau
(`/cancellation-policy` và `/terms`):

> ≥ 30 ngày: hoàn toàn phần, trừ chi phí nhà cung cấp không thu hồi được ·
> 15–29 ngày: khoảng 50% · dưới 14 ngày: thường không hoàn · no-show: không hoàn

Rà 04/09 tìm ra bốn lỗ:

**1. Mất hẳn ngày 14.** `15–29` và `fewer than 14 days` không phủ ngày 14 chẵn.
Có ở **cả hai** văn bản.

**2. Công cụ admin mù chính sách.** Bậc chỉ tồn tại dưới dạng **văn xuôi trong
i18n** — không có dạng máy đọc được. Màn quyết định không hiện ngày còn lại,
không hiện bậc nào áp dụng. Hai admin xử hai ca giống hệt nhau ra hai con số
khác nhau, và không ai đối chiếu được với thứ đã hứa.

**3. Badge "Free until N days" của tour tạo vực 100 điểm.** Đo trên seed thật,
30 tour: 15 tour `freeCancellationDays = null`, 15 tour có mốc **3 · 5×4 · 7×3 ·
10 · 14×3 · 21 · 30**. Một tour hứa "Free until 5 days" thì ngày 5 hoàn 100%,
ngày 4 rơi vào bậc "dưới 14 ngày" = 0%. **Rơi trọn 100 điểm trong một ngày.**
Vực này tồn tại từ trước; hôm nay con người đang lấp nó.

**4. Quyết định không lưu căn cứ.** Admin duyệt 50% thì hệ thống không ghi vì
sao 50%. Khách khiếu nại sáu tháng sau thì không dựng lại được.

## Quyết định

### 1. Bậc trở thành CƯỠNG CHẾ — văn bản phải đổi lời

Hệ thống **tính** số tiền hoàn từ bảng bậc và **khoá** nó trên màn hình. Admin
không gõ số. Lý do (user chốt 04/09): một ô nhập tự do là một ô gõ nhầm được,
và tiền gõ nhầm thì khách chịu.

Hệ quả bắt buộc: hai câu sau trong văn bản công khai nay thành nói dối và
**phải sửa**:

- *"the amounts below are general guidelines rather than fixed rules"* → lời văn
  dứt khoát. Máy đã quyết thì đừng bảo khách rằng nó là gợi ý.
- *"less any non-recoverable supplier costs"* → **bỏ**. Đây là điều khoản
  **bất khả thi hành**: hệ thống không biết chi phí nhà cung cấp, nên nó chỉ
  làm con số công bố mập mờ mà không ai trừ được thật.

Đổi văn bản pháp lý là việc phải làm cùng lúc, không phải việc dọn sau — nếu
không thì trang web hứa một đằng, máy trả một nẻo.

### 2. Bảng bậc: 100 / 50 / 25 / 0

| Trước khởi hành | Hoàn | So với bản cũ |
| --- | --- | --- |
| ≥ 30 ngày | **100%** | giữ nguyên |
| 15–29 ngày | **50%** | giữ nguyên |
| 7–14 ngày | **25%** | MỚI (cũ: 0%, và ngày 14 không thuộc bậc nào) |
| < 7 ngày | **0%** | giữ nguyên |

Ba lý do cho dải 25% mới:

- **Vá lỗ ngày 14.**
- **Hạ vực từ 50 xuống 25 điểm.** Bản cũ có HAI vực 50 điểm (30↔29 và 15↔14);
  nay cú rơi thứ hai thành 50 → 25 → 0.
- **Chỉ NỚI RỘNG hơn, không siết ở đâu.** Ngày 7–14 đi từ 0% lên 25%, các mốc
  khác giữ nguyên. Nên **không booking nào đã đặt bị thiệt** so với điều khoản
  khách đã đọc lúc mua — đây là điều kiện để sửa văn bản công khai mà không
  phải xử lý riêng cho booking cũ. Nếu ngày nào cần SIẾT một mốc thì đó là một
  quyết định khác hẳn, cần đường xử lý cho booking đã tồn tại.

### 3. `freeCancellationDays` nâng ngưỡng 100%, và không được thấp hơn biên 0%

Tour có badge thì **ngưỡng hoàn 100% của tour ấy là `freeCancellationDays`**,
thay cho mốc 30 ngày mặc định. Dưới ngưỡng thì bảng bậc áp bình thường. Đây
đúng điều `/cancellation-policy` đã hứa: *"where they differ, the tour-specific
terms apply"*.

⚠️ Nhưng badge là lời hứa **nhị phân**, còn bậc là **thang** — ghép hai thứ ấy
sinh ra vực ở §Bối cảnh (3). Chữa bằng một **ràng buộc dữ liệu**, không phải
bằng code:

> `freeCancellationDays` **không được nhỏ hơn 7** — biên của bậc 0%.

Một tour hứa miễn phí huỷ tới trước 3 ngày, trong khi site nói dưới 7 ngày
không hoàn, là **tự mâu thuẫn ngay từ lúc nhập liệu**. Ràng buộc này khiến mọi
tour có badge rơi từ 100% xuống 25% chứ không xuống 0%.

Seed hiện có **5 tour vi phạm** (một tour mốc 3, bốn tour mốc 5) — nâng lên 7.

### 4. Đếm ngày từ lúc KHÁCH GỬI yêu cầu, theo NGÀY LỊCH

**Mốc đếm là `CancellationRequest.createdAt`, không phải lúc admin quyết.**
Khách gửi ở ngày 20 mà admin duyệt chậm tới ngày 12 thì không được rớt từ 50%
xuống 25% vì mình xử chậm. Chính sách cũng đã hứa *"the sooner you tell us, the
more we are usually able to refund"* — tức là tính theo lúc họ báo.

**Đếm bằng NGÀY LỊCH UTC, không phải hiệu millisecond.** Đây là chỗ dễ sai một
ngày: yêu cầu gửi lúc `2026-09-04T23:00Z`, khởi hành `2026-10-04` — hiệu
millisecond là 29,04 ngày, làm tròn xuống thành **29** và rơi nhầm sang bậc 50%,
trong khi lịch nói đúng **30** ngày và phải hoàn 100%. Một giờ trong ngày không
được phép làm khách mất một nửa số tiền.

`departureStartDate` vốn là `@db.Date`, nên phép trừ phải chạy trên ngày lịch
hai đầu — cùng thước UTC mà `calendarDate` và `startOfDayUtc` đang dùng.

### 5. Đường vượt bậc: có, nhưng phải ghi lý do

Số tiền mặc định **khoá**. Muốn khác thì bật một công tắc riêng và **bắt buộc
nhập lý do**.

Vì sao không khoá tuyệt đối: chính văn bản đã hứa *"If we cancel a confirmed
tour for reasons within our control, you may choose... a full refund"*. Một cỗ
máy khoá cứng **không thực hiện được lời hứa đó** — nó sẽ trả 0% cho một chuyến
mà chính công ty huỷ. Bất khả kháng, lỗi vận hành, và ca supplier hoàn lại
được đều cần đường này.

Lý do vượt bậc lưu vào `decisionNote` — trường đã có, đã hiện trên hàng đợi và
trang chi tiết.

### 6. MỘT nguồn sinh cả văn bản lẫn phép tính

Bảng bậc là **hằng máy đọc được trong `@tourism/contract`**, và nó sinh ra:

- gạch đầu dòng ở `/cancellation-policy`
- đoạn tương ứng ở `/terms`
- con số mà màn quyết định của admin tính

Vì sao ở **contract** chứ không ở i18n: nó vừa là **copy** (khách đọc) vừa là
**luật tiền** (server tính). Đặt ở i18n thì API phải import gói copy để tính
tiền; đặt ở contract thì cả hai đầu đọc chung một bảng, và i18n chỉ lo dịch nó
thành câu.

Một nguồn là điều kiện để văn bản và công cụ **không thể** trôi lệch. Đây chính
là lỗ (2) ở §Bối cảnh: hôm nay chúng đã lệch, vì bậc chỉ sống trong văn xuôi.

### 7. Trừ phần đã hoàn

Bậc tính trên `totalAmount`, rồi **trừ những gì đã hoàn**:

```
refund = max(0, tier% × totalAmount − alreadyRefunded)
```

Không thì một booking đã hoàn thiện chí 20$ sẽ được hoàn thêm trọn bậc, tức
vượt mức chính sách. Kết quả 0 là hợp lệ và ADR-0029 §2 đã mở đường cho nó:
approve với 0đ vẫn đóng request, huỷ booking, nhả ghế.

## Hệ quả

### Bậc chỉ chi phối một nửa danh mục

15/30 tour có badge, và badge nâng ngưỡng 100% lên tận mốc của nó. Với một tour
`freeCancellationDays = 21`, bậc `15–29 → 50%` **không bao giờ chạy** — mọi lần
huỷ từ ngày 21 trở lên đều 100%, dưới đó rơi thẳng vào 7–14 hoặc <7.

Đây là hệ quả đúng của việc quảng cáo miễn phí huỷ, không phải lỗi. Nhưng nó
đáng biết khi đọc số liệu: bảng bậc thực chất là luật của 15 tour **không** có
badge.

### Việc PHẢI làm cùng đợt

| | Nội dung |
| --- | --- |
| Contract | Hằng bậc + hàm thuần tra bậc theo số ngày |
| i18n | `/cancellation-policy` và `/terms` sinh câu từ hằng; đổi lời "guidelines" → dứt khoát; bỏ "less non-recoverable supplier costs" |
| Seed | 5 tour nâng `freeCancellationDays` lên ≥ 7 |
| Ràng buộc | Chặn `freeCancellationDays` dưới biên 0% |

Phần API tính tiền và stepper là **đợt sau** (user chốt tách): văn bản pháp lý
đáng được đọc kỹ riêng, không trộn vào một diễn biến kỹ thuật.

### Điều KHÔNG được suy ra

ADR này **không** nói mọi lần huỷ đều tự động hoàn tiền. Nó nói **số tiền** của
một lần approve là bao nhiêu. Quyết định approve hay deny vẫn của con người, và
deny vẫn không hoàn đồng nào.

Nó cũng **không** đụng tới hoàn tiền THIỆN CHÍ trên booking không có yêu cầu
huỷ — đường W3 ở `/bookings`, một quyết định riêng chưa chốt.

## Phương án đã cân nhắc rồi loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ "guidelines", để admin tự gõ số | Đây là bản đầu ADR-0029, user bác 04/09. Ô nhập tự do là ô gõ nhầm được; và hai admin xử hai ca giống nhau ra hai con số khác nhau thì chính sách chỉ là chữ. |
| Giữ nguyên 100/50/0, chỉ vá lỗ ngày 14 | Ít sửa văn bản nhất, nhưng giữ nguyên hai vực 50 điểm, và tour có badge vẫn rơi thẳng 100% → 0%. |
| Thang mịn 100/75/50/25/0 | Công bằng nhất với khách, ít vực nhất. Loại vì năm bậc khó nhớ khi giải thích cho khách, và lợi ích thêm không tương xứng với độ phức tạp ở quy mô này. |
| Bỏ badge `freeCancellationDays`, chỉ dùng bậc | Sạch nhất về khái niệm — hết hai nguồn, hết vực. Loại vì 15 tour đang quảng cáo điều đó trên trang tour, và gỡ một lời hứa đã in là làm khách thiệt. |
| Để badge thắng, chấp nhận vực 100 điểm | Đúng chữ nghĩa của badge nhưng khách huỷ muộn một ngày mất trọn tiền — đúng loại ca sinh khiếu nại và chargeback. Ràng buộc dữ liệu ở §3 rẻ hơn nhiều. |
| Đếm ngày từ lúc admin QUYẾT | Khách chịu hậu quả của việc mình xử chậm. Trái thẳng lời hứa "báo sớm thì hoàn nhiều" đã in trên chính trang chính sách. |
