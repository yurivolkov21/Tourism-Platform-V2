# ADR-0022 — Tour Details chuyển từ cuộn-dài-có-mục-lục sang 5 tab

- **Trạng thái:** Accepted (2026-08-13)
- **Bối cảnh:** vòng "trùng tu" trang Tour Details 13/08. User chọn mẫu
  `product-detail-1` của ReUI sau khi so 6 bản; quyết định ở đây là **hình
  dạng điều hướng của trang**, không phải màu mè — nên phải có ADR trước code.

## Bối cảnh

Trang hiện tại (`apps/web/src/app/(site)/tours/[slug]/page.tsx`) là **một mạch
cuộn dài**: hero tối + dải khởi hành → khảm ảnh → lưới ba cột `rail · main ·
booking`, trong đó `rail` là mục lục dính (`OnThisPage`) và `main` xếp dọc 7
section chia bằng `divide-y`. Mục lục và các `<section>` dùng chung mảng
`pageSections()` nên id không thể lệch nhau.

User đánh giá trang "vẫn giống kiểu AI hay làm" và muốn bám một thiết kế có
sẵn thay vì tự chế. Sau khi render thật 6 bản `reui.io/preview/base/
product-detail-1…6` và dựng lại từng bản bằng dữ liệu tour, user chốt bản
**tabbed PDP**.

Đối chiếu (luật 10): Nexora không có trang tour dạng tab để so; đây là bề mặt
mới, không phải chỗ v2 thụt lùi.

## Vấn đề

Mẫu gốc có **4 tab** cho 4 cụm nội dung của một đôi giày. Tour có **6 cụm**:
highlights · itinerary · departures · reviews · included/excluded · faq +
policies. Ép vào 4 tab thì phải trộn hai cụm không liên quan vào một chỗ.

Nghiêm trọng hơn: trang tour là **SSG và nằm trong sitemap**. Kiểu tab "chỉ
mount panel đang mở" sẽ khiến lịch trình — nội dung chính của một tour —
biến mất khỏi HTML mà crawler nhận được.

## Quyết định

1. **Năm tab**, không phải bốn: `Overview · Itinerary · Departures · Reviews ·
   Good to know`. Tab vẫn `flex:1` nên năm tab chia đều 1008/5 ≈ 201px, giữ
   nguyên ngôn ngữ thị giác của mẫu. `included`/`excluded` nằm **trong tab
   Itinerary**, ngay dưới ngày cuối — câu hỏi "bữa nào có sẵn, ngủ ở đâu" phát
   sinh *trong lúc* đọc lịch trình, tách sang tab riêng là bắt nhảy qua lại.

2. **Render ĐỦ năm panel, ẩn bằng CSS** — không mount có điều kiện. Đây là
   ràng buộc SEO cứng, không phải sở thích: `generateStaticParams` sinh sẵn
   ~30 slug và sitemap trỏ vào chúng.

3. **Tab đồng bộ với hash trên URL.** Trang hiện có mục lục trỏ `#itinerary`,
   `#departures`… Chuyển sang tab là gãy hết anchor cũ nếu không đồng bộ; và
   không có hash thì mất khả năng gửi link tới đúng phần.

4. **`OnThisPage` rời khỏi trang này.** Tab bar thay vai mục lục; giữ cả hai là
   hai bộ điều hướng cho cùng một tập nội dung. Component vẫn dùng ở `/blog`.

5. **Ba khối nằm NGOÀI tab**, vì chúng thuộc về cả trang chứ không thuộc một
   cụm nội dung: hero (đã có), khối gallery + panel đặt chỗ, và "You may also
   like" dưới cùng.

## Hệ quả

- **Trạng thái live của lịch trình chỉ hiện cho người đã đặt.** Luật "qua ngày
  thì tick, đang diễn ra thì quay, chưa tới thì mờ" chỉ đúng khi chuyến đang
  chạy. Trang tour là trang công khai và đợt khách chọn thường ở tương lai —
  áp luật đó nguyên xi thì cả bốn ngày đều "chưa diễn ra", toàn bộ timeline mờ
  đi và trông như trang hỏng. Nên: mặc định là **chế độ xem trước** (node hiện
  số ngày, badge hiện ngày thật suy từ đợt đang chọn); chế độ live chỉ bật khi
  session có booking `PAID` ở đúng đợt đó.
- **Bảng đợt khởi hành không lặp lại trong tab.** Danh sách ngày đi qua modal
  "All dates"; tab `Departures` chuyển sang **tổng quan** (đợt kế tiếp, số đợt
  còn mở, khoảng giá, lịch theo tháng) — mọi con số dẫn xuất từ chính mảng
  `departures`, không thêm dữ liệu mới.
- **Một nguồn cho đợt khởi hành.** Chip ở panel, tổng quan trong tab và modal
  cùng đọc `DepartureSelectionProvider` sẵn có. Đây là thứ mẫu ReUI không có
  và cũng là điểm v2 hơn Nexora (Nexora hardcode `departures: []`).
- **Nút "Write a review" biến mất khỏi trang tour**, thay bằng "Show all
  reviews" + modal. Lý do cấu trúc chứ không phải thẩm mỹ: `POST /api/reviews`
  bắt buộc `bookingCode`, mà trang tour không có mã booking nào để dựng
  request. Cửa vào thật nằm ở khu account, gắn với từng booking.

## Phương án đã cân nhắc và loại

- **Giữ 4 tab, đưa Itinerary ra thành section riêng dưới khối tab.** Giữ đúng
  hình dạng bản gốc và không giấu nội dung chính. Loại vì trang sẽ có hai cơ
  chế điều hướng song song (tab cho 4 cụm, cuộn cho cụm thứ 5) — đúng thứ
  lộn xộn mà việc bỏ `OnThisPage` đang muốn dọn.
- **Giữ nguyên cuộn dài + mục lục.** Loại theo yêu cầu user; nhưng ghi lại
  rằng nó không sai về chức năng — nó thua ở chỗ *đọc ra như một trang tự chế*.
- **Editorial cột giữa (`product-detail-6`)**, bản sang nhất trong 6. Loại vì
  phụ thuộc nặng vào ảnh đẹp, mà `MediaAsset` hiện **rỗng hoàn toàn** trên DB
  dev (script `seed-media` chưa chạy) — chọn nó là chọn một trang loang lổ chỗ
  trống cho tới khi có ảnh.

## Nợ mở kèm theo

Ghi ở đây để không thất lạc; chi tiết trong spec `2026-08-13-tour-detail-redesign.md`.

| Món | Vì sao chưa làm |
| --- | --- |
| `seed-media` cho tour | `MediaAsset` rỗng → gallery và ảnh review chưa có gì để hiện |
| `reviews.byTour` thêm `sort`/`rating`/`withPhotos` + `breakdown` | Modal review và biểu đồ sao đang cần; là đổi contract nên tách riêng |
| `freeCancellationDays` trên Tour | Muốn thẻ "Free until 10 days out" nói con số thật thay vì đọc-hiểu văn xuôi `policy.body` |
| `meals`/`accommodation` cho itinerary day | 73 row lịch trình trên 30 tour phải soạn lại; hợp lý nhất là làm cùng màn admin ở P4 |
