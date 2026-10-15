# ADR-0058 — Thẻ tour mang đợt kế tiếp đặt được và badge; sắp theo rating; bộ lọc ở lại web

- **Trạng thái:** Accepted (2026-10-15)
- **Bối cảnh thi hành:** mục E3 của [sổ nợ kỹ thuật](../analysis/2026-08-06-backlog-no-ky-thuat.md)
  (nợ contract #2–#5 của [spec Tours 27/07](../specs/2026-07-27-tours-pages-design.md) §8), trong
  đợt hoàn thiện open-items trước mốc freeze 31/10. Đi trước code theo luật CLAUDE.md #5. Câu
  "đưa bộ lọc lên API hay không" do Yuri chọn trên thẻ quyết định ngày 15/10: giữ ở web.
- **Liên quan:** [ADR-0041](0041-single-cancellation-deadline.md) (hạn chót, cờ `bookable`) ·
  [ADR-0016](0016-web-data-layer.md) §3 (ISR 300 giây, cache-tag) ·
  [ADR-0020](0020-real-images-sourcing.md) (ảnh bìa trên card — nợ #1 đã trả) · đối chiếu Nexora
  [2026-07-19](../analysis/nexora-parity/2026-07-19-nexora-deep-sweep.md) mục A2 và
  [2026-07-27](../analysis/nexora-parity/2026-07-27-tours-parity-nexora.md)

## Bối cảnh

Bảy sự thật đo được ở `main` ngày 15/10 (`16ca003`):

1. `TourCardSchema` không có ngày khởi hành, số chỗ hay badge; `badges` chỉ nằm ở
   `TourDetailSchema`. Nexora đưa `nextDepartureDate` và `nextDepartureSeatsLeft` lên mọi card
   (`attachNextDeparture`), v2 chưa có tín hiệu đợt nào ở trang danh sách.
2. `TourSortKeySchema` có `createdAt`, `updatedAt`, `basePrice`, `durationDays`, `title`. Rating đã
   denormalize sẵn ở `tours.rating_avg` và `tours.rating_count` nhưng không sắp được.
3. Trang `/tours` của web tải MỌI tour đang bán (G10: `fetchTours` đi hết các trang qua
   `collectAllPages`, trần 20 × 50) rồi tìm, lọc, sắp và phân trang ở trình duyệt. Số đếm cạnh
   mỗi lựa chọn của bộ lọc (`facetOptionCounts`) cần cả tập tour. Nỗi lo của spec §8 #4 — lọc ở
   trình duyệt "gãy im lặng" khi web phân trang ở server — dựa trên một hướng web không đi.
4. Màn Explore của app mobile gọi MỘT trang `limit: 50` rồi lọc vùng, thời lượng, giá, độ khó và
   từ khoá ở máy (`apps/mobile/src/features/explore/tour-filters.ts`). Prod có 29 tour đang bán.
5. Web lệch giá với chính nó: thẻ in `priceFrom`, nhưng sort "Price" và nhóm giá của bộ lọc đọc
   `basePrice` (`apps/web/src/lib/tours.ts`). Mobile lọc giá theo `priceFrom`.
6. Hai tập "đợt đặt được" lệch nhau: API tính `priceFrom` trên đợt OPEN còn hạn đặt, KỂ CẢ đợt
   đã hết chỗ; hero trang tour (`heroPrice`) và mọi chỗ chọn đợt của web dùng `isDepartureOpen`
   = còn hạn đặt VÀ còn chỗ. Đợt rẻ nhất mà hết chỗ thì thẻ và hero in hai giá "from" khác nhau.
7. Đặt chỗ không bust cache nào của web: trang tour lẫn `/tours` tươi lại theo ISR 300 giây.
   Lệnh ghi đợt của admin chỉ bust tag `tours` khi giá "from" có thể đổi
   (`departureRevalidationTags`), vì card chưa in số chỗ.

## Quyết định

### 1. Một tập "đợt đặt được" cho mọi con số trên thẻ

Đợt nuôi thẻ tour là đợt `OPEN`, chưa khởi hành theo ngày Việt Nam, còn trong hạn đặt
(`isWithinDeadline`, ADR-0041) và còn chỗ (`seatsTotal − seatsBooked > 0`) — đúng vị từ
`isDepartureOpen` của web. Cả `priceFrom` lẫn `nextDeparture` tính trên tập này, từ MỘT query đợt
cho cả lô (danh sách tour, tour liên quan của bài viết) và từ các đợt đã nạp ở trang chi tiết.

Thay đổi so với trước: `priceFrom` không còn tính đợt hết chỗ, nên thẻ và hero trang tour luôn
in cùng một giá "from" (sửa sự thật 6).

### 2. `TourCardSchema.nextDeparture`

`{ startDate: 'YYYY-MM-DD', seatsLeft: số nguyên ≥ 1 } | null` — đợt sớm nhất trong tập §1; hai đợt
cùng ngày thì lấy đợt còn nhiều chỗ hơn, để thẻ không báo "sắp hết chỗ" khi cùng ngày ấy còn đợt
khác rộng. `null` nghĩa là không còn đợt nào đặt được. Trường này có mặt ở mọi chỗ trả card: danh
sách, chi tiết (kế thừa card) và tour liên quan của bài viết.

Thẻ `/tours` của web in một băng riêng, ngay trên đường kẻ chân thẻ: "Next departure Tue 14 Nov";
còn từ 3 chỗ trở xuống (ngưỡng `departureStatus` mà trang tour đã dùng) thì thêm "Only N seats
left" bằng mực cảnh báo. `null` in "Dates on request". Băng luôn có mặt nên mọi thẻ cao bằng nhau,
đúng hợp đồng số dòng của thẻ.

### 3. `badges` lên card

`badges` chuyển từ `TourDetailSchema` lên `TourCardSchema`; hình dạng của detail không đổi. Góc
trái ảnh của thẻ `/tours` hiện tối đa HAI chip: suất đầu giữ luật cũ (có giảm giá thì −N%, không
giảm mà tour được chọn nổi bật thì "Featured"), badge lấp các suất còn lại theo thứ tự admin lưu.
Thẻ không có chip "+N": phần dư vẫn hiện đủ ở trang tour.

`suitableFor` KHÔNG lên card: thẻ không có chỗ nào đọc nó, và một bộ lọc "Good for" là tính năng
mới chưa ai đặt.

### 4. Sort `rating`

`TourSortKeySchema` thêm `rating`: xếp theo `ratingAvg` theo chiều `order`; tour chưa có đánh giá
luôn đứng cuối ở cả hai chiều (chưa ai chấm không có nghĩa là bị chấm thấp nhất); hoà điểm thì
tour nhiều đánh giá hơn đứng trước, rồi tới `id`. Web thêm lựa chọn "Rating: high to low" và sắp ở
trình duyệt theo cùng luật, vì web đã giữ cả tập (sự thật 3). Phía API mở sẵn cho app mobile, nơi
sort chạy ở server.

### 5. Bộ lọc giá, thời lượng, độ khó ở lại web

Không thêm tham số lọc nào vào `ToursListQuerySchema`. Web sửa sự thật 5: sort "Price" và nhóm
giá của bộ lọc đọc `priceFrom`, con số in trên thẻ. Sort `basePrice` của API giữ nguyên cho người
gọi khác.

### 6. Bust cache khi đợt đổi

`departureRevalidationTags` bust `tours` khi một đợt bước vào hoặc rời tập §1, hoặc vẫn ở trong
tập mà giá, ngày hay số chỗ còn lại đã đổi: thẻ nay in ngày và số chỗ. Đặt chỗ vẫn không bust:
thẻ tươi lại theo ISR 300 giây, cùng nhịp với bảng đợt của trang tour hôm nay.

## Hệ quả

- Trang danh sách có lại tín hiệu đợt mà Nexora có (ngày, "sắp hết chỗ"), cộng badge và sort theo
  rating. Thẻ, hero trang tour và sort giá cùng đọc một giá "from".
- Contract đổi theo kiểu cộng thêm: hai trường mới trong output và một giá trị sort mới. Bản app
  mobile đã build không đọc hai trường ấy nên không vỡ; fixture test của contract, API, web và
  mobile phải khai thêm hai trường.
- Số chỗ trên thẻ có thể cũ tới 300 giây sau một lượt đặt, cùng độ tươi với trang tour; bước đặt
  chỗ vẫn kiểm chỗ thật ở server.
- Admin đổi số ghế của một đợt đang bán nay dựng lại cả `/tours`, trước đây chỉ trang tour.
- Mobile chưa đổi gì trong đợt này: vẫn sắp giá theo `basePrice` của API, chưa dùng sort `rating`,
  và chỉ đọc 50 tour đầu — quá 50 tour đang bán thì bộ lọc ở máy thiếu tour mà không báo. Đường sửa
  là đi hết các trang như web (G10). Ghi lại cho nhóm mobile.

## Phương án đã loại

- **Lọc giá, thời lượng, độ khó ở API** (`minDays`/`maxDays`/`minPrice`/`maxPrice`/`difficulty`):
  khách không thấy gì khác; số đếm của bộ lọc cần thêm một endpoint đếm; mỗi cú tích thành một
  lượt gọi API thay vì tức thì; và lựa chọn nhiều nhóm không liền nhau ("Under $100" cùng "$300+")
  không viết được bằng một cặp min/max.
- **Hai trường phẳng như Nexora** (`nextDepartureDate`, `nextDepartureSeatsLeft`): hai trường luôn
  cùng có hoặc cùng vắng; một object nullable nói điều đó ngay trong kiểu.
- **Đợt kế tiếp tính cả đợt hết chỗ:** thẻ hứa một ngày khách không đặt được.
- **In ngày khởi hành đè lên ảnh:** góc ảnh đã có chip và nút tim, còn chữ trên ảnh đọc được hay
  không tuỳ màu của từng ảnh.
- **Sort `priceFrom` ở API:** giá "from" phụ thuộc luật hạn chót N chỉ sống ở Node; sắp bằng SQL
  là chép luật ấy sang câu truy vấn.
- **Sort "Most popular":** không có tín hiệu độ phổ biến nào trung thực trong dữ liệu (badge
  `POPULAR` là nhãn biên tập, số đánh giá không phải số người đặt).
