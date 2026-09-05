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

**3. Badge "Free until N days" dừng nửa chừng.** Đo trên seed thật, 30 tour:
15 tour `freeCancellationDays = null`, 15 tour có mốc **3 · 5×4 · 7×3 · 10 ·
14×3 · 21 · 30**. Badge nói rõ hạn chót nhưng KHÔNG nói sau hạn thì sao, nên
khách lỡ một ngày bị bất ngờ. (Bản đầu ADR này gọi đây là "vực 100 điểm" và
định chữa bằng cách sửa seed — sai, xem §3.)

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

### 3. `freeCancellationDays` NÂNG ngưỡng 100% — và đó là toàn bộ luật

Tour có badge thì **ngưỡng hoàn 100% của tour ấy là `freeCancellationDays`**,
thay cho mốc 30 ngày mặc định. Dưới ngưỡng thì bảng bậc áp bình thường. Đúng
điều `/cancellation-policy` đã hứa: *"where they differ, the tour-specific terms
apply"*.

Bất biến duy nhất cần canh, và nó đã có test:

> Với MỌI số ngày, tour có badge hoàn **≥** tour không badge.
> Badge chỉ NÂNG, không bao giờ HẠ.

**Sửa lỗi của bản đầu ADR này.** Bản đầu khai một sàn
`MIN_FREE_CANCELLATION_DAYS = 7` với lý do "chặn vực 100 điểm ở tour hứa mốc 3
hoặc 5", và bắt sửa 5 tour trong seed. Cả hai vế đều sai, phát hiện khi viết
test:

1. **Sàn 7 không xoá được vực.** Đo thật: badge 7 thì ngày 6 vẫn rơi vào bậc
   `<7` = 0%, tức vực vẫn 100 điểm. Phải từ **8** trở lên ngày trước hạn mới
   chạm dải 25%.
2. **Nâng sàn là SIẾT quyền của khách, không phải nới.** `freeCancellationDays`
   là số ngày TỐI THIỂU để được miễn phí, nên nâng 5 → 8 lấy mất của khách
   quyền huỷ miễn phí ở ngày 5, 6 và 7 — trên 8 tour. Đó đúng thứ §2 vừa cấm:
   *chỉ nới rộng hơn, không siết ở đâu.*

Và cái gọi là "vực" thực ra **không phải mâu thuẫn với chính sách** — nó là
**hạn chót**. Khách lỡ hạn rơi về đúng bậc chuẩn của ngày hôm đó, tức bằng
đúng thứ một tour KHÔNG có badge sẽ trả. Họ không thiệt hơn ai; họ chỉ mất
phần thưởng thêm. Áp tư duy "thang bậc" lên một lời hứa vốn nhị phân là chỗ
suy luận đã trượt.

Nên: **không có ràng buộc sàn, không đụng seed.**

### 3b. Cái đáng chữa là BẤT NGỜ, không phải con số

Rủi ro thật không nằm ở mức %, mà ở chỗ khách không biết trước. Chữa ở đúng
hai nơi khách đọc, và không đổi một con số nào:

- **Badge trên trang tour nói nốt vế sau.** Hiện chỉ có *"Free until 5 days
  out"*, dừng ngay chỗ dễ hiểu nhầm là "sau đó thì sao?". Thêm một câu dẫn về
  `/cancellation-policy`.
- **Màn khách gửi yêu cầu huỷ hiện luôn kết quả**: còn bao nhiêu ngày, bậc nào
  áp dụng, hoàn bao nhiêu phần trăm và bao nhiêu tiền — TRƯỚC khi bấm gửi.

Việc thứ hai dùng lại đúng `refundPercentForBooking` + `daysBeforeDeparture` mà
màn admin dùng, nên khách và admin **không thể** nhìn hai con số khác nhau.
Đây cũng là lý do §6 đặt bảng bậc ở contract chứ không ở i18n.

### 3c. AMEND 04/09 — cửa sổ ÂN HẠN 24 giờ sau khi thanh toán

**Lỗ user phát hiện lúc nghiệm thu:** người đặt muộn không bao giờ với tới bậc
100%.

| Đặt | Khởi hành | Huỷ | Hoàn |
| --- | --- | --- | --- |
| 1/7 | 19/9 | 2/7 | **100%** |
| 4/9 | 19/9 | 5/9 | **50%** |

Cùng một hành vi — đổi ý ngay hôm sau — khác nhau 50 điểm, và khách **không
làm gì sai**: họ chỉ tình cờ đặt gần ngày khởi hành hơn. Với tour khởi hành
trong 15 ngày thì bậc 100% là **bất khả** với mọi khách, kể cả người đổi ý sau
một phút.

Gốc rễ: bảng bậc chỉ đo MỘT chiều — còn bao xa tới khởi hành. Nó không đo
**khách đã giữ chỗ bao lâu**, mà đó mới là thứ nói lên họ có làm mình thiệt hay
không. Người giữ chỗ mười phút rồi trả lại không gây tổn thất cho ai.

**Luật thêm:** huỷ trong vòng **24 giờ** kể từ `paidAt` → hoàn **100%**, bất kể
còn bao nhiêu ngày tới khởi hành.

Ba điều làm nó đứng vững:

- **Trong 24 giờ đầu chưa có gì được cam kết.** Mà "chi phí đã cam kết với nhà
  cung cấp" chính là lý do bảng bậc tồn tại. Không tổn thất thì không có cơ sở
  giữ tiền.
- **Ghế trả lại ngay** khi approve (ADR-0029), nên chỗ không bị treo.
- **Chỉ có LỢI cho khách.** Ân hạn trả về 100%, tức trần của bảng bậc — nó
  không bao giờ hạ kết quả xuống. Bất biến này có test quét mọi tổ hợp.

Neo vào `paidAt` chứ không `createdAt`: booking PENDING chưa trả tiền thì không
có gì để hoàn, và đồng hồ chỉ nên chạy từ lúc tiền thật sự rời tay khách.

**KHÔNG chặn ân hạn theo ngày khởi hành.** Bản bàn đầu định chặn "chỉ áp khi
còn ≥ 7 ngày" để tránh ca đặt-rồi-huỷ sát ngày. Bỏ vế ấy vì đợt sau sẽ có
**chốt chặn đặt chỗ 3 ngày** (ADR riêng, user chốt tách): khách lọt vào vùng
4–6 ngày là người CỐ Ý đặt sát, và cho họ 24 giờ đổi ý là hợp lý khi ghế trả
lại ngay.

### Vì sao KHÔNG chuyển hẳn sang neo theo lúc thanh toán

Đã cân nhắc và loại. Thử mô hình thuần-neo-thanh-toán: đặt 1/1, khởi hành
1/12, huỷ 1/6 → quá 24 giờ → **0%**, trong khi mô hình hiện tại cho 100% vì
còn sáu tháng. Khách báo sớm thừa thãi thời gian bán lại chỗ mà không được
đồng nào — mô hình mới **khắc nghiệt hơn**, chỉ là với nhóm khách khác.

Hai mô hình đo hai thứ: neo khởi hành đo **tổn thất thật của mình**, neo thanh
toán đo **thời gian khách đã giữ chỗ** — thứ không liên quan tới tổn thất. Ân
hạn vì thế là **lớp phủ chỉ có lợi**, không phải vật thay thế.

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

### 5b. AMEND 05/09 (vòng vá review) — §5 cưỡng chế ở SERVER, và số học tiền là MỘT bản

Bản đầu gác luật "vượt bậc phải ghi lý do" ở prop `noteRequired` của dialog
admin; `decisionNote` ở contract vẫn `optional` và server không tính lại bậc.
Nghĩa là mọi caller cầm JWT admin approve được số bất kỳ ≤ phần dư mà không để
lại dấu vết vượt bậc nào — đúng trạng thái "hai admin xử hai ca giống nhau ra
hai con số khác nhau" mà *Bối cảnh* (2) sinh ra để xoá. Nay `approve` tính
lại `refundPercentForRequest` + `policyRefundAmount` từ dữ liệu TƯƠI trong
lock (createdAt của request, `paidAt`, `departureStartDate` snapshot,
`freeCancellationDays` của tour); con số client gửi khác mức chính sách mà
không có `decisionNote` là `OFF_POLICY_NOTE_REQUIRED` (422, mã mới). Server
**không khoá số** — đường vượt bậc vẫn hợp lệ, nó chỉ đòi đúng thứ §5 hứa.

Cùng lúc, số học tiền (`toCents`/`fromCents`/`percentOfAmount`/
`remainingRefundable`/`policyRefundAmount`) dời từ `apps/admin/src/lib/refund.ts`
lên `@tourism/contract` cạnh bảng bậc: web từng nhân float rồi `toFixed(2)`,
admin làm tròn cent HALF_UP — 50% của 1199.01 là 599.50 ở dialog khách và
599.51 ở màn admin. §3b hứa "một điểm vào duy nhất" nhưng chỉ cho phần trăm;
nay cả phép nhân cũng một.

Ba chỗ văn bản đi kèm: ân hạn 24 giờ ở `/cancellation-policy`, `/terms`, hai
câu i18n và FAQ nay sinh từ `REFUND_GRACE_HOURS` thay vì gõ tay (cùng bệnh
"lỗ ngày 14" mà §6 vừa chữa cho bảng bậc); câu "how we count the days" nói rõ
ngày lịch đo theo **UTC** (§4 đã chốt UTC nhưng văn bản không nói, khách ở
UTC−5 gửi 20:00 có thể rớt bậc ở biên); và `daysBeforeDeparture` NÉM với ngày
hỏng thay vì âm thầm trả 0%.

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

```text
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
| Seed | **KHÔNG đụng** — nâng badge là siết quyền khách (§3) |
| Web | Badge trang tour thêm câu dẫn về chính sách; màn huỷ của khách hiện % và số tiền trước khi gửi (§3b) |

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
| Bỏ badge `freeCancellationDays`, chỉ dùng bậc | Sạch nhất về khái niệm — hết hai nguồn. Loại vì 15 tour đang quảng cáo điều đó trên trang tour, và gỡ một lời hứa đã in là làm khách thiệt. |
| Đặt sàn cho `freeCancellationDays` (bản đầu ADR này khai sàn 7) | Loại sau khi ĐO: sàn 7 không xoá được vực (ngày 6 vẫn 0%), và nâng sàn là SIẾT quyền khách trên 8 tour — trái thẳng luật "chỉ nới, không siết" của §2. Xem §3. |
| Ép badge trùng biên bậc `{7, 15, 30}` | Cùng bệnh: mọi lần dịch badge đều siết quyền của khách ở ít nhất một tour, để đổi lấy một sự gọn gàng mà khách không nhìn thấy. |
| Đếm ngày từ lúc admin QUYẾT | Khách chịu hậu quả của việc mình xử chậm. Trái thẳng lời hứa "báo sớm thì hoàn nhiều" đã in trên chính trang chính sách. |
