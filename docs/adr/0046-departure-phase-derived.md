# ADR-0046 — Giai đoạn của chuyến suy từ ngày; cột `status` chỉ là công tắc bán hàng

- **Ngày:** 23/09/2026
- **Trạng thái:** Chấp nhận
- **Bối cảnh:** [Spec F16 — giai đoạn chuyến khởi hành](../specs/2026-09-23-departure-phase-design.md)

## Bối cảnh

`tour_departures.status` có ba giá trị — `OPEN`, `CLOSED`, `CANCELLED` — và màn
Departures của admin in thẳng nó ra làm "trạng thái" của chuyến. Lượt thử tay
F14 trên production (23/09) cho thấy người đọc hiểu nhầm nó theo hai cách:

- **Chuyến 22/09 đã khởi hành mà vẫn ghi `Open`**, đứng ngay cạnh hạn chót
  15/09 ghi "Passed". Người xem tưởng chuyến còn đang bán.
- **124 chuyến đã về ghi `Closed`**, nên người xem tưởng hệ thống tự đóng chuyến
  khi nó kết thúc. Thật ra không có gì tự đóng cả: đo trên DB production, cả
  124 hàng đều được ghi `CLOSED` trong cùng **12 giây, 03:29 UTC ngày 18/09** —
  đó là lượt chạy seed, và script seed sinh chuyến lịch sử với trạng thái ấy
  ngay từ đầu (`apps/api/prisma/fixtures/catalog/departures-2026.ts`). Chuyến
  nào không ai bấm Close thì ghi `OPEN` mãi mãi.

Trong khi đó, **mọi cổng thật đã quyết theo ngày** chứ không theo cột này:

| Cổng | Điều kiện |
| --- | --- |
| Tạo booking (`assertDepartureBookable`) | `OPEN` **và** còn trong hạn chót |
| Claim thanh toán (ADR-0009 AMEND 1, 3) | `OPEN` **và** ngày đi ≥ hôm nay (lịch VN) |
| Danh sách chuyến trên web | `OPEN` **và** ngày đi ≥ hôm nay (lịch VN) |
| Cờ `bookable` trên web | còn trong hạn chót |

Tức cột `status` chưa bao giờ quyết vòng đời của chuyến — nó chỉ *trông như*
đang quyết. Một cột đang gánh hai nghĩa: **ý muốn của người vận hành** (bán hay
ngừng bán) và **chuyến đang ở đâu trong vòng đời** (chưa đi, đang đi, đã về).
Nghĩa thứ hai vốn đã nằm sẵn trong ngày đi và ngày về.

## Quyết định

1. **`status` chỉ là công tắc bán hàng.** `OPEN` = admin cho bán, `CLOSED` =
   admin tạm ngừng bán (mở lại được), `CANCELLED` = công ty huỷ chuyến (điểm
   cuối, ADR-0041 §6). Không gì khác ghi vào cột này ngoài hành động tường minh
   của admin.
2. **Giai đoạn của chuyến được SUY RA**, không lưu. Một hàm thuần duy nhất,
   `departurePhase({ status, startDate, endDate, now })`, đặt ở
   `@tourism/contract`, tính theo lịch Việt Nam bằng các hàm đã có
   (`vietnamToday`, `isWithinDeadline`). Sáu giá trị, xét theo thứ tự ưu tiên:

   | # | Điều kiện | Giai đoạn |
   | --- | --- | --- |
   | 1 | `status = CANCELLED` | `cancelled` |
   | 2 | hôm nay > ngày về | `completed` |
   | 3 | ngày đi ≤ hôm nay ≤ ngày về | `departed` |
   | 4 | `status = CLOSED` | `closed` |
   | 5 | đã qua hạn chót | `deadline_passed` |
   | 6 | còn lại | `on_sale` |

3. **Server tính, client hiển thị.** API trả `phase` kèm từng hàng chuyến của
   admin, và lọc theo giai đoạn bằng CHÍNH hàm ấy — luật chỉ tồn tại ở một chỗ.
4. **Không job, không migration, không đổi enum.** Giai đoạn đổi đúng lúc 00:00
   giờ Việt Nam vì nó được tính ngay lúc đọc.

## Hệ quả

- Thứ người vận hành nhìn thấy luôn đúng ở thời điểm đọc, không có độ trễ của
  một job chạy theo lịch, và không có chuyện job hỏng một đêm làm hai nguồn lệch
  nhau.
- **Cột `status` của chuyến đã về có thể ghi `OPEN` vĩnh viễn — đó là thiết kế.**
  Ai cần biết vòng đời thì đọc ngày tháng hoặc gọi `departurePhase`, không bao
  giờ đọc cột thô. Các câu truy vấn đã lọc `status <> CANCELLED` (báo cáo P&L)
  vẫn đúng như cũ.
- Tab lọc của màn Departures đổi từ giá trị công tắc sang nhóm giai đoạn.
- Nút Close/Reopen thôi hiện từ ngày khởi hành: Reopen lúc ấy đã bị chặn vì quá
  hạn chót, còn Close không còn việc gì đúng để làm (xem mục cuối).

## Điều này KHÔNG mở ra

- **Không cho hàm này ghi.** Đóng và mở lại vẫn là hành động tường minh của
  admin. `departurePhase` chỉ đọc.
- **Không viết lại các cổng theo giai đoạn.** Cổng tạo booking, câu SQL claim
  tiền và bộ lọc của web đã đúng, mỗi cái một vị từ hẹp đã qua review. Đừng
  "cho gọn" bằng cách bắt chúng đọc `phase`: giai đoạn là để người đọc, còn cổng
  giữ điều kiện riêng của nó — nhất là câu SQL claim, nơi một điều kiện rộng hơn
  là một lỗ tiền.
- **Web và mobile không đổi** — chúng vốn đã tính theo ngày.

## Đã cân nhắc và loại

- **Lưu giai đoạn mới (`DEPARTED`) và một job chạy mỗi đêm để chuyển trạng
  thái.** Đây là đề xuất đầu tiên, vì nó giống cách con người nghĩ về trạng
  thái. Loại vì bốn lẽ: tạo thêm một bản sao của sự thật mà ngày tháng đã giữ,
  nên job chạy trễ hay hỏng là hai bản lệch nhau; phải migration kèm backfill
  một enum nằm trong câu SQL claim tiền, sát mốc đóng băng 15/10; chữ `Closed`
  sẽ gánh hai nghĩa ("admin tạm ngừng, mở lại được" và "đã xong"); và nút
  Reopen phải có thêm luật để không mở lại một chuyến đã về.
- **Suy ra như trên, CỘNG một job dọn dẹp** chuyển chuyến đã về sang `CLOSED`
  trong DB cho gọn. Không ai nhìn thấy khác biệt, vì thứ hiển thị đã suy từ
  ngày, nên job ấy chỉ thêm một bộ phận chuyển động phải canh. Xét lại nếu có
  một nơi thật sự phải đọc cột thô.
- **Server từ chối Close sau khi chuyến khởi hành.** Cổng đặt chỗ đã đóng từ
  hạn chót. Cổng claim vẫn nhận tiền trong **chính ngày khởi hành**
  (`start_date >= hôm nay`), nhưng lúc ấy chỉ còn một loại khoản tới được: tiền
  của booking tạo trước hạn chót mà webhook về trễ. Nhận khoản ấy là đúng,
  vì khách đặt đúng luật và chuyến đang chạy. Close ở thời điểm đó chỉ còn một
  hậu quả thật: hoàn tiền người khách ấy ngay ngày đi. Từ hôm sau thì cổng claim tự
  chặn theo ngày. Vậy UI thôi mời bấm là đủ. Thêm một mã lỗi contract để chặn
  một cú bấm không ai cần là không đáng.
