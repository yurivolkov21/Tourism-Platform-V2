# Spec — Export theo lựa chọn cho `/bookings`

01/09/2026 · nhánh `fix/p4b-ui-polish` · tiếp nối
[ADR-0027](../adr/0027-admin-surface-palette.md) (bề mặt admin) và vòng polish
UI cùng ngày. Đầu vào: user quan sát hàng điều khiển `/bookings` bị tràn sau
khi mọi control lên 44px.

## 1. Mục tiêu & phạm vi

Ba việc, một nhánh nguyên nhân:

1. **Giải toả hàng điều khiển.** Kéo control lên 44px làm khe `actions` của
   `/bookings` tràn — nút "Clear dates" chỉ hiện khi có lọc ngày nên nó là
   giọt nước cuối. Đưa nút Export **vào trong bảng**.
2. **Chọn hàng để export.** Thêm cột checkbox; không tích gì thì xuất cả tập
   đang lọc như hôm nay, có tích thì chỉ xuất các hàng ấy.
3. **Quick Create trắng, hover teal** (user chốt 01/09).

**Chỉ `/bookings`.** `/cancellations` và `/reviews` không có export.
`/reports` có export nhưng không có bảng hàng — bộ lọc tháng của nó đã chảy
đúng sẵn.

### Thứ ĐÃ đúng, không phải làm

"Export phải nằm trong khoảng đang filter" — `bookingsExportHref` vốn mang
`status`/`search`/`from`/`to` và cố ý bỏ `page`/`limit`, nên file luôn là *cả
tập đang lọc*. Ghi ra đây để không ai tính lại công cho nó.

## 2. Ràng buộc quyết định thiết kế

**Phân trang là điều hướng THẬT.** `TablePagination` dùng `<Link>` (spec P4b
§2.2 — trạng thái sống trên URL). Nên mọi state chọn hàng ở client bị xoá sạch
mỗi lần sang trang. Với 147 booking chia 15 trang, "tích rải rác rồi export"
là thứ không tồn tại được.

**Quyết định (user chốt 01/09): việc chọn KHOÁ trong trang đang xem.** Đã cân
nhắc rồi loại hai đường khác:

| | Vì sao loại |
| --- | --- |
| Nhét mã đã tích vào URL (`?sel=…`) | Sống xuyên trang, nhưng URL phình rất nhanh (mỗi mã ~11 ký tự) và phải đặt trần số hàng chọn được. |
| `sessionStorage` | Sống xuyên trang, URL sạch — nhưng là state VÔ HÌNH: admin quay lại sau 10 phút, bấm Export và nhận một file 40 hàng không hiểu vì đâu. |

Đổi lại, giới hạn ấy mở ra một đường thi công gọn hẳn — xem §4.

## 3. Giao diện

### 3.1 Hàng điều khiển

Gỡ `BookingsExportLink` khỏi khe `actions`. Còn lại: ô tìm kiếm · hai ô ngày ·
Clear dates. Hết tràn.

### 3.2 Hai cột mới

```
☐ │ Code        │ Tour       │ Status │ Guests │ Amount │ Customer │ [↓ Export]
──┼─────────────┼────────────┼────────┼────────┼────────┼──────────┼───────────
☑ │ BK-4RTG57J3 │ Ninh Bình… │  Paid  │   1    │ $49.00 │ Admin…   │
☐ │ BK-5IKNXFTE │ Hanoi…     │  Paid  │   7    │$343.00 │ NayuD    │
```

- **`select`** (cột hiển thị, trước `code`) — tiêu đề là checkbox "chọn cả
  trang" với trạng thái *một phần* khi tích lẻ; ô thân là checkbox từng hàng.
- **`export`** (cột hiển thị, sau `customerName`) — tiêu đề chứa nút, **ô thân
  để trống** (user chốt: cột tồn tại để nút có chỗ đứng cố định).

Cả hai **tự động vắng mặt** trong menu Columns: menu lọc theo
`typeof column.accessorFn !== 'undefined'`, mà cột hiển thị thì không có
`accessorFn`. Không phải khai `enableHiding: false`.

### 3.3 Nhãn nút

`Export CSV` khi không tích gì → `Export 3 rows` khi có tích. Người bấm phải
biết mình sắp tải về cái gì trước khi bấm.

### 3.4 Quick Create

| | nền | chữ | đo |
| --- | --- | --- | --- |
| nghỉ | trắng tuyệt đối | mực tối | bề mặt 14.19 · chữ 15.43 |
| hover | teal 0.68 | mực tối | bề mặt 5.11 · chữ 5.55 |

Một màu chữ DUY NHẤT dùng được cho cả hai trạng thái.

Cần hai token mới trong lớp đè admin: `--sidebar-cta` /
`--sidebar-cta-foreground`, kèm khai `@theme` để Tailwind sinh utility. **Không
tái dùng `--sidebar-primary`** vì nó đang nhuộm viên kim cương sau của logo
(ADR-0027 §Hệ quả) — đổi nó thành trắng là mất thế hai tông của mark.

## 4. Đường dữ liệu

### 4.1 URL export

| Trạng thái | URL | Nghĩa |
| --- | --- | --- |
| không tích | lọc, **bỏ** `page`/`limit` | cả tập đang lọc *(y như hôm nay)* |
| có tích | lọc **+ `page` + `limit`** + `sel=MÃ1,MÃ2` | đúng các hàng đã tích |

Vì việc chọn khoá trong trang đang xem, `page`+`limit` **chính là phạm vi
đúng** của tập đã tích. Đây là chỗ ràng buộc §2 trả công: route chỉ cần lấy
**một trang** rồi giữ những hàng có mã trong `sel` — không đi bộ qua tối đa
2000 hàng như đường export-all.

Bộ lọc vẫn áp vì nó nằm trong cùng query. Một hàng đã tích mà không còn khớp
lọc thì đơn giản không có trong trang server trả về, nên không lọt vào file.

### 4.2 Không đụng contract

`AdminBookingsListQuerySchema` **giữ nguyên** — không thêm filter `codes`. Việc
giao nhau theo mã làm ở route handler, sau khi API đã trả đúng một trang. Đổi
contract cho một tiện ích UI là mua một vòng đổi API + service + test mà đường
trên đã đủ nhanh.

### 4.3 Trần 2000 hàng

`EXPORT_MAX_ROWS` chỉ còn áp cho ca export-all. Có tích thì số hàng ≤ `limit`
(tối đa 100), nên nút không bao giờ ở trạng thái tắt và nhánh 413 không chạy.

## 5. Lỗi

Giữ nguyên 401 · 403 · 413 · 502 của route hiện tại. Thêm đúng một nhánh:

| Ca | Mã | Vì sao |
| --- | --- | --- |
| `sel` có mã nhưng không khớp hàng nào trong trang | **409** | Trang đã đổi dưới chân admin (hàng bị huỷ, bộ lọc khác). Trả CSV chỉ có dòng tiêu đề là **nói dối** — người tải tưởng tập rỗng là sự thật. Câu trả về phải bảo họ chọn lại. |

## 6. Test

| Nơi | Ca |
| --- | --- |
| `bookings-query.spec.ts` | `bookingsExportHref` không tích → URL như cũ (không `page`/`limit`/`sel`) · có tích → mang đủ `page`+`limit`+`sel` · mã được mã hoá URL an toàn |
| `bookings-export-link.spec.tsx` | nhãn đếm đúng theo số hàng tích · trần 2000 chỉ tắt nút ở ca export-all |
| spec mới cho cột `select` | tích một hàng · "chọn cả trang" · trạng thái *một phần* khi tích lẻ · bỏ tích cả trang |

Route handler không có test đơn vị ở repo này (nếp sẵn có) — nhánh 409 nghiệm
thu bằng tay.

## 7. Definition of done

- `pnpm gate:int` xanh.
- Hàng điều khiển `/bookings` không còn xuống dòng ở màn 1280px khi bật lọc
  ngày.
- Không tích gì → file y hệt hành vi hôm nay.
- Tích 2 hàng → file đúng 2 hàng đó, kể cả khi đang bật lọc trạng thái + ngày.
- Sang trang → tích reset, nút quay về `Export CSV`.
- Quick Create trắng, hover teal, chữ đọc được ở cả hai.
- CHANGELOG + `docs/README.md` cập nhật khi merge (luật 13).
