# ADR-0049 — Khu sửa tour thành thanh bước, mỗi bước form một bên và cột phải một bên

- **Trạng thái:** Accepted (2026-09-28)
- **Bối cảnh thi hành:** nhánh `feat/p4e-3c-tour-workspace-steps` (F19, P4e-3c), đi
  trước code theo luật CLAUDE.md #5. Thi công SAU khi F18 merge.
- **Liên quan:** [ADR-0047](0047-tour-editor-sections.md) (ADR này **đổi** §§ về
  hàng tab và vị trí công tắc đăng; giữ nguyên mọi luật ghi) ·
  [ADR-0048](0048-tour-photos.md) (bước Photos) · spec
  [2026-09-28-p4e-3c-tour-workspace-steps-design.md](../specs/2026-09-28-p4e-3c-tour-workspace-steps-design.md)

## Bối cảnh

Khu làm việc `/tours/[slug]` của F17 là một hàng tab chữ (Details · Photos ·
Itinerary · FAQ & policies · Costs · Departures), trên đó là tên tour, công tắc On
sale và khung readiness; mỗi tab là một form MỘT cột xếp các khung chồng nhau.

User góp ý 28/09 sau khi dùng thật: trang dài, phải cuộn nhiều, và muốn một bố cục
kiểu "multi-step form" như mẫu shadcnstudio multi-step-form-05. Qua ba vòng mockup
(dựng bằng chính component của admin, CSS sinh từ đúng cấu hình Tailwind của app),
user chốt bản thứ bảy. Đo trên cùng dữ liệu mẫu ở khổ 1600px: trang Details hôm nay
dài 2607px; bản có cột phải dài khoảng 2300px. Bản bỏ cột phải ngắn hơn nhiều (1877px)
nhưng user chọn giữ cột phải vì nó mang ngữ cảnh của từng bước.

## Quyết định

### 1. Hàng tab thành THANH BƯỚC chỉ có icon

Sáu bước, chia đều một hàng, nối bằng vạch mảnh: **Details · Photos · Itinerary ·
FAQ & policies · Costs · Review & publish**. Tên bước và một dòng trạng thái nằm
trong tooltip (kit `Tooltip`); `aria-label` của link mang đủ chữ ấy cho trình đọc
màn hình. Bấm thẳng bước nào cũng được — không có luồng bắt buộc đi tuần tự.

Chữ bị bỏ khỏi hàng vì đo được: sáu bước có tên và dòng phụ thì ở khổ 1600px dòng
phụ đã bị cắt "…"; user chọn icon cộng tooltip để hàng gọn và các icon cách đều.

### 2. Trạng thái của bước suy từ readiness, MỘT hàm thuần

- **Đủ** (dấu xanh): mọi điều kiện readiness thuộc bước ấy đạt — Details (tóm tắt,
  điểm đến chính), Photos (ảnh bìa), Itinerary (đủ ngày).
- **Thiếu** (dấu vàng): còn điều kiện chưa đạt.
- **Tuỳ chọn** (viền nét đứt): FAQ & policies, Costs — tour lên bán được mà không cần.
- **Chốt** (không dấu): Review & publish.

Một hàm `tourSteps(detail)` ở `lib/tour-editor-view.ts` là nguồn DUY NHẤT cho cả thanh
bước lẫn danh sách kiểm tra của bước cuối — hai chỗ không được nói khác nhau (nếp
`canAuthorEdit`, ADR-0032 §6). Thanh bước đọc readiness ĐÃ LƯU (cập nhật sau mỗi lần
lưu qua `usePublishSavedDetail`); cột phải của từng bước đọc giá trị ĐANG SOẠN.

### 3. Bước cuối "Review & publish" gom việc quyết số phận tour

Route mới `/tours/[slug]/review`: danh sách kiểm tra theo từng bước (dòng thiếu có
link mở thẳng chỗ cần sửa), **công tắc On sale** (dời từ phần đầu xuống đây), và
**vùng xoá tour** (dời từ cuối bước Details xuống đây).

Công tắc nằm cạnh danh sách kiểm tra thì thấy ngay vì sao chưa bật được. Cái giá: gỡ
bán gấp phải bấm thêm một icon — chấp nhận được vì bảng `/tours` vẫn có công tắc ở
mỗi hàng, và luật cũ giữ nguyên: gỡ bán không bao giờ bị chặn (ADR-0047 §4).

### 4. Phần đầu chỉ còn TRẠNG THÁI, không còn điều khiển

Link về danh sách · tên tour · dòng đường dẫn và lần lưu cuối · chip **On sale / Not
on sale** · nút **View on site** (chỉ khi đang bán — tour tắt bán thì trang web 404)
· nút **Departures**. Khung readiness ở đầu trang bỏ đi: vai của nó chia cho dấu trên
thanh bước, khối "This step" của từng bước và bước cuối.

### 5. Departures ra khỏi thanh bước

Departures là việc vận hành chuyến (bảng, tạo, đổi giai đoạn, huỷ), không phải nội
dung tour, và readiness không phụ thuộc nó. Đặt nó trong thanh bước là nói sai rằng
"làm xong sáu bước là xong tour". Nó thành một nút ở phần đầu; ở trang Departures nút
mang `aria-current="page"` và thanh bước không bước nào sáng.

### 6. Bố cục bước: form bên trái, cột phải dính khi cuộn

`EditorFormFrame` nhận thêm `aside` (cột phải), `lead` (dòng trải hết bề ngang trên
hai cột) và `next` (link "Next: …" cạnh nút Save). Từ `xl` (1280px) hai cột
`minmax(0,1fr) 20rem`, cột phải `sticky`; hẹp hơn thì một cột, cột phải xuống dưới
form.

Cột phải do CHÍNH form dựng (truyền qua `aside`), vì nó phải đọc giá trị đang soạn:
khối "This step" dùng `projectedReadiness` nên tích xanh ngay khi gõ, và khung Totals
của Costs vẫn tính khi gõ như F17.

### 7. Luật ghi KHÔNG đổi

Mỗi bước vẫn một lệnh ghi, một nút Save, khoá phiên bản bằng `version` (ADR-0047
§2–§3); hộp hỏi lại khi rời trang vẫn chặn mọi link (thanh bước, "Next", Departures)
ở pha capture như hàng tab cũ. Không đổi API, contract, DB, web, mobile.

## Hệ quả

| Tầng | Việc |
| --- | --- |
| Admin lib | `TOUR_EDITOR_STEPS`, `tourStepHref`, `activeTourStep`, `tourSteps` thay bộ tên "tab"; `readinessIssues` giữ nguyên đích link |
| Admin components | thanh bước mới; phần đầu mới; `EditorFormFrame` thêm `aside`/`lead`/`next`; khối cột phải dùng chung; sáu bước xếp lại bố cục; bỏ `TourTabs`, `TourReadinessPanel` |
| Admin route | thêm `/tours/[slug]/review` |
| i18n | chữ của thanh bước, phần đầu, cột phải, bước cuối |
| API · contract · DB · web · mobile | không đổi |

## Phương án đã cân nhắc rồi loại

| Phương án | Vì sao loại |
| --- | --- |
| Form nhiều bước có Back/Next BÊN TRONG từng tab | Hai tầng điều hướng chồng nhau; trang chủ yếu để SỬA nên admin phải tìm ô ở bước nào; lỗi server rơi vào bước đang ẩn; Itinerary N ngày thành N bước. |
| Giữ tab, chỉ nén bố cục | Không có cảm giác "đi theo từng bước" user muốn, và khung readiness vẫn phải nằm đầu trang. |
| Bản không cột phải (đo 1877px, ngắn hơn ~28%) | User chọn giữ cột phải vì ngữ cảnh của bước (việc cần làm, tổng chi phí, danh mục ngày) nằm trong tầm mắt. |
| Thanh bước có chữ | Dòng phụ bị cắt ở khổ màn thường gặp (đo được); user chọn icon cộng tooltip. |
| Departures nằm trong thanh bước | Nói sai rằng xong sáu bước là xong tour; nó là việc vận hành, readiness không phụ thuộc. |
| Công tắc On sale ở lại phần đầu | Hai chỗ cùng quyết một việc; đặt cạnh danh sách kiểm tra thì lý do bị chặn hiện ngay bên cạnh. Gỡ bán gấp vẫn có công tắc ở bảng `/tours`. |

## AMEND 1 — Vòng review F19 (30/09)

Vòng review max trước merge (15 phát hiện, vá cả trên nhánh) đổi ba chỗ của quyết định
gốc; sáu bước, thứ tự, luật suy trạng thái và vị trí công tắc giữ nguyên.

- **§4, chip trạng thái:** "Off sale" thay "Not on sale" — cùng chữ với tab lọc của bảng
  Tours, toast và dòng báo Departures (bài học 20 của P4e-2: một chữ mỗi khái niệm). Lý do
  gốc (không phải "Draft") vẫn đứng.
- **§6, cột phải:** hộp `sticky` cao hơn cửa sổ ghim theo mép trên và giấu phần dưới tới
  hết form, không "cuộn theo trang" như spec §4.6 tưởng — cột phải nay có trần bằng cửa sổ
  và tự cuộn bên trong. Link nhảy của cột phải không đổi `#hash`: mục lịch sử do trình
  duyệt tạo mang `state` null, Next 16 bỏ qua popstate của nó, nên Back hỏng và hộp hỏi
  lại bị lách; link cuộn tới đích và dời tiêu điểm thay vào đó.
- **§3, bước Review:** đọc bản trang vừa đọc, không đọc bản layout đang giữ — layout không
  render lại khi chuyển bước phía client, và hộp xoá từng đếm sai số chuyến sẽ mất theo.
  Bản ấy và kết quả bật/tắt bán được đẩy lên `TourDetailProvider`. Vùng xoá tự lo tour đã
  có booking.
