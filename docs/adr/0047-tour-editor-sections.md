# ADR-0047 — Sửa tour theo từng khối: thay nguyên danh sách, khoá phiên bản, cổng đăng tour

- **Ngày:** 24/09/2026
- **Trạng thái:** Chấp nhận
- **Bối cảnh:** [Spec F17 — tạo và sửa tour (P4e-3a)](../specs/2026-09-24-p4e-3a-tour-editor-design.md)

## Bối cảnh

P4e-3 là phần cuối của bề mặt ghi catalog. Nexora có đủ tạo, sửa và xoá tour;
v2 tới hôm nay chỉ có danh sách tour kèm công tắc đăng (F11) và lịch chạy của
từng tour (F12, F13, F16). Theo luật 10, thiếu tạo và sửa tour là thụt lùi cần
vá (`docs/analysis/2026-08-20-admin-parity-nexora.md`).

Tour là thực thể lớn nhất của catalog: 26 cột trên bảng `tours` cùng năm bảng
con (điểm đến, lịch trình theo ngày, FAQ, chính sách, dòng chi phí), chưa kể
chuyến khởi hành và ảnh. Đo trên DB production ngày 24/09:

- 29 tour, cả 29 đều đang bán và **đều đã có booking**.
- Cả 29 khớp nhau ở ba chỗ: số ngày của tour = số mục lịch trình = độ dài của
  mọi chuyến (262 chuyến). Không có gì trong code ép sự khớp ấy.
- Cả 29 đều có tóm tắt, đúng một điểm đến chính, lịch trình đủ ngày, điểm nổi
  bật và ảnh bìa.
- Bảng chính sách chỉ còn loại `BOOKING` và `GENERAL`; chính sách huỷ đã tính
  lúc chạy từ độ dài chuyến (ADR-0041).

Và năm ràng buộc đã có sẵn trong code:

| Ràng buộc | Ở đâu |
| --- | --- |
| Booking trỏ tới tour bằng khoá ngoại `Restrict` | `schema.prisma`, model `Booking` |
| Số ghế của chuyến không vượt số khách tối đa của tour | `seatsAboveTourMaxBlocker` (F12) |
| `costPrice` là số suy ra từ dòng chi phí, chỉ `apps/api` tính | `tour-costs.ts` (ADR-0033) |
| `setPublished` chỉ khai `NOT_FOUND`, gỡ đăng không bao giờ bị chặn | contract `admin.tours` (F11) |
| Seed upsert nội dung tour kèm cập nhật | `apps/api/prisma/seed.ts` |

## Quyết định

1. **Mỗi tour một khu làm việc chia tab; mỗi tab một lệnh ghi.** Bảy thao tác
   mới dưới `admin.tours`: `create`, `get`, `updateDetails`, `setItinerary`,
   `setFaqsPolicies`, `setCosts`, `delete`. Không có endpoint cho từng hàng.
2. **Khối danh sách thay nguyên.** Lịch trình, FAQ, chính sách và dòng chi phí
   được gửi nguyên cả danh sách đã sắp; server xoá hết hàng cũ rồi chèn danh
   sách mới theo đúng thứ tự, trong một transaction. Không có thao tác đổi thứ
   tự riêng, nên không có đua ghi thứ tự như danh mục ở F14.
3. **Một mã phiên bản cho cả tour, so và ghi trong một câu.** `version` là
   `updatedAt` của tour. Mọi lệnh sửa bắt đầu bằng một câu cập nhật hàng
   `tours` có điều kiện `updated_at = version`; câu ấy vừa so, vừa khoá hàng tour
   tới hết transaction. Lệch thì trả `STALE_TOUR` (409). Lệnh chỉ đổi bảng con
   cũng đẩy `updatedAt` lên.
4. **Cổng đăng tour, và bất biến "đang bán thì luôn đủ để bán".** Một hàm thuần
   `tourReadiness` ở `@tourism/contract` nói tour còn thiếu gì: tóm tắt, điểm
   đến chính, ngày lịch trình (3b thêm ảnh bìa). `setPublished(true)` từ chối
   bằng `TOUR_NOT_READY` (409) khi còn thiếu. `setPublished(false)` vẫn không bao
   giờ bị chặn — lý do của F11 giữ nguyên. Lệnh sửa nào làm một tour ĐANG BÁN
   trở nên thiếu cũng bị từ chối bằng mã ấy; muốn làm vậy thì gỡ đăng trước.
5. **Chỉ xoá được tour chưa từng có booking.** Server xoá thẳng; khoá ngoại
   `Restrict` của booking chặn thì đổi lỗi khoá ngoại thành `TOUR_HAS_BOOKINGS`
   (409). Không đếm trước rồi mới xoá.
6. **Hai luật giữ dữ liệu khớp.** Số ngày bị khoá khi tour đã có ít nhất một
   chuyến (`DURATION_LOCKED`). Số khách tối đa không được hạ dưới số ghế lớn nhất
   của các chuyến chưa về và chưa huỷ (`GROUP_SIZE_BELOW_SEATS`), giai đoạn lấy
   từ `departurePhase` (ADR-0046).
7. **Slug khoá sau khi tạo**, cùng luật danh mục và điểm đến (spec P4e-2 §2c).
   Với tour lý do còn mạnh hơn: slug là đường dẫn `/tours/<slug>` và là thẻ cache
   `tour:<slug>`.
8. **Hàm giá vốn dời lên contract** (ADR-0033 §2 đổi chỗ, không đổi công thức).
   `perPersonTotal`, `perDepartureTotal`, `derivedCostPrice` viết lại trên cent
   nguyên như `refund-policy.ts`. API bỏ bản `Prisma.Decimal` và gọi bản contract
   ở cả ba chỗ: tạo booking, tạo chuyến, seed. `costPrice` không có ô nhập tay.

## Hệ quả

- **F11 đổi một điểm:** `setPublished` có thêm mã `TOUR_NOT_READY`, chỉ ở chiều
  bật bán. Công tắc ở trang Tours hiện thông báo kèm link mở tour.
- **Khe deploy** (Vercel xong trước Render): trong vài phút, khu làm việc và nút
  New tour gọi thao tác API chưa có, nên hiện trang lỗi của app; admin cũ gặp
  mã `TOUR_NOT_READY` thì rơi về thông báo lỗi chung. Chấp nhận; thử tay chỉ
  bắt đầu khi cả hai đã lên.
- **Hai người sửa hai tab khác nhau của cùng một tour vẫn chặn nhau**, vì chỉ có
  một phiên bản cho cả tour. Chấp nhận: luật "đủ để bán" đọc từ nhiều tab cùng
  lúc, và admin của dự án là một người.
- **Xoá tour kéo theo** chuyến, lịch trình, FAQ, chính sách, chi phí, liên kết
  điểm đến, wishlist và liên kết bài viết (khoá ngoại `Cascade` sẵn có); câu hỏi
  của khách (`Enquiry`) còn lại, mất liên kết tour (`SetNull`). Ảnh của tour
  không có khoá ngoại — 3b thêm bước đưa chúng vào hàng đợi xoá trễ (ADR-0035).
- **Đường tạo booking đổi chỗ gọi hàm giá vốn.** Không đổi công thức; một test
  đối chiếu chạy với bản `Prisma.Decimal` cũ trước khi xoá nó.
- Không migration: mọi cột và bảng đã có.

## Điều này KHÔNG mở ra

- **Không có bản nháp riêng hay xem trước trên web.** "Tắt bán" là trạng thái
  nháp duy nhất; chữ "Draft" không xuất hiện trên giao diện.
- **Không đổi slug sau khi tạo, không có redirect slug.**
- **Không sửa chuyến ở khu này** — chuyến vẫn là F12, chỉ chuyển thành một tab.
- **Không đổi tiền tệ** (USD cố định) và không có ô giá gạch cấp tour (web thôi
  hiện nó từ 15/09).
- **Không có nhật ký thao tác** — `AdminAuditLog` vẫn là việc của P4f.

## Đã cân nhắc và loại

- **Một form lớn, một nút Lưu.** Một thao tác API, nhưng form nặng, một ô sai
  chặn cả trang, và hai người cùng mở tour dễ ghi đè nhau hơn.
- **CRUD từng hàng** (mỗi ngày, mỗi FAQ, mỗi dòng chi phí có tạo, sửa, xoá, lên,
  xuống). Khoảng hai mươi endpoint, và đổi thứ tự cần khoá như F14 — quá nặng so
  với ba tuần tới freeze.
- **Cột `version` số nguyên riêng.** Cần migration; `updated_at` là
  `timestamp(3)`, đủ chính xác tới mili-giây cho phép so bằng.
- **Mỗi tab một phiên bản riêng.** Cần thêm cột, trong khi luật "đủ để bán" đọc
  từ nhiều tab cùng lúc — hai phiên bản không bảo vệ được luật đọc chéo.
- **Chặn đăng ở phía giao diện.** Công tắc ở trang Tours vẫn gọi thẳng
  `setPublished`; luật phải sống ở server.
- **Trạng thái Lưu trữ (Archived).** Cần migration và thêm một trạng thái chạy
  song song với On sale, trái hướng ưu tiên luật gọn.
- **Cho xoá mọi tour, xoá luôn booking.** Mất lịch sử tiền và hoàn tiền.
- **Đổi số ngày của tour đã có chuyến rồi tự sửa chuyến theo.** Chuyến đã có
  booking không đổi ngày được (F12), nên sẽ lệch vĩnh viễn.
