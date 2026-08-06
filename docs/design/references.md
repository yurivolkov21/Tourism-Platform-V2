# Khảo sát mẫu thiết kế — khu account + luồng booking (06/08/2026)

> Phục vụ đợt thiết kế lại 6 route account và 3 màn booking. Mọi link đã được mở
> thật; mọi template đã kiểm `package.json` để biết Radix hay Base UI, và kiểm
> giấy phép. Thứ cần mượn là **bố cục và cách tổ chức thông tin** — màu, chữ,
> primitive đã chốt ở [claude-design-brief](claude-design-brief.md).

## 0. Phát hiện đảo ngược giả định

**Base UI nay là mặc định của chính shadcn/ui** (từ 07/2026). Không còn phải đi
tìm template Base UI hiếm hoi — registry chính chủ phục vụ đúng style
`base-nova`, trùng khít `apps/web/components.json`.

Đo tại nguồn: `curl https://ui.shadcn.com/r/styles/base-nova/dashboard-01.json`
→ 89 KB, **0** lần `radix`, **0** lần `asChild`, **9** lần `render={`.

Hệ quả: có code chép được thật, không chỉ ảnh để ngắm.

## 1. Nguồn code dùng được — đã kiểm nền tảng và giấy phép

| Nguồn | Nền tảng | Giấy phép | Mượn được gì |
| --- | --- | --- | --- |
| [shadcn blocks chính chủ](https://ui.shadcn.com/blocks) | Base UI (`base-nova`) | MIT | Khung điều hướng: 16 biến thể `sidebar-*`, `dashboard-01`. **Không có** block settings/account/billing/orders — chỉ hiến được cái vỏ |
| [`@7ovr` registry](https://7ovr.com/blocks) | Base UI | MIT-0 | Phần ruột: `settings-1..4` · `table-2` · `timeline-1` · `billing-2` · `empty-states-1..5` |
| [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) | `@base-ui/react ^1.6.0`, `style: base-nova` | MIT | Cấu trúc app + mẫu form. 6.7k sao, push 04/08/2026 |
| [coss ui](https://coss.com/ui) (design system Cal.com) | `@base-ui/react 1.6.0`, 0 Radix | MIT | Component chuẩn mực để đối chiếu cách viết |

**Đã kiểm và LOẠI** (đều Radix, hoặc trả phí, hoặc không giấy phép):
`satnaing/shadcn-admin` (18 gói Radix) · BigCommerce Catalyst (14 gói Radix) ·
Medusa Next.js Starter (Radix qua `@medusajs/ui`) · `vercel/platforms` (không có
LICENSE) · Tailwind Plus, shadcnblocks (trả phí) · `baseui-cn` (Base UI thật
nhưng không có block nào ta cần).

## 2. Sản phẩm thật — bài toán trung tâm

Khảo sát 9 sàn: GetYourGuide · Booking.com · Airbnb · Klook · Intrepid ·
G Adventures · Much Better Adventures · TourRadar · Viator.

**Kết luận quan trọng nhất: không sàn nào giải tốt ca "hoàn tiền một phần mà
chuyến vẫn chạy."** Nhóm bán vé lẻ đều rút xuống MỘT từ trạng thái trộn lẫn đời
sống chuyến đi với đời sống dòng tiền. Airbnb né bằng cách đẩy tiền sang màn
khác (Account settings → Payments → "Refund status"), buộc khách đi tìm. Klook
đẩy hẳn ra email và **không có khái niệm hoàn một phần trong UI**.

→ Chủ trương hai ô **Trip / Payment** của ta không phải cầu kỳ, mà là chỗ trống
thật của thị trường.

### G Adventures — bằng chứng mạnh nhất

[developers.gadventures.com/docs/booking.html](https://developers.gadventures.com/docs/booking.html)

Một booking của họ **không có field status ở cấp booking**. Không hề có enum
CONFIRMED/CANCELLED/REFUNDED. Thay vào đó:

- Bốn con số tiền song song: `amount_paid` · `amount_owing` · `amount_pending` ·
  `balance_due_date`
- Ba collection riêng: `payments` · `refunds` · `invoices`
- Trạng thái nằm ở **từng dịch vụ**, không ở booking

Đáng mượn: ô Payment nên trình bày theo **bộ số** (đã trả / còn nợ / đang treo)
thay vì một tính từ — nó chịu được mọi tổ hợp, kể cả hoàn một phần. Và
`balance_due_date` cho thấy hạn tiền là một **ngày hiển thị**, không phải badge.

### Bốn việc lẻ đáng mượn

- **Booking.com** — thêm nhóm "đang diễn ra" vào danh sách đặt chỗ.
- **Much Better Adventures** — khối "Your options": nêu khách còn làm được gì và
  mất bao nhiêu. Họ có ca một lần hủy sinh **hai kết cục tiền** (cọc thành
  credit, phần dư hoàn về thẻ) mà không badge nào nói nổi.
- **Viator** — dialog hủy nói đủ *bao nhiêu / về đâu / bao lâu* trước khi bấm.
- **Intrepid** — khối traveller details sửa được riêng.

> Độ tin cậy: Airbnb, G Adventures, Much Better Adventures, TourRadar, Klook,
> Intrepid đã mở được trang thật. Viator, GetYourGuide, Booking.com chặn 403 —
> phần của ba cái này chỉ dựa trên tóm tắt tìm kiếm, **phải kiểm lại trước khi
> đưa vào spec**.

## 3. Settings / profile / dashboard khách

- **Medusa starter** — hình dạng đúng với ta nhất: Overview = lời chào + đúng
  **hai con số** + danh sách 5 dòng. Profile = hàng `nhãn / giá trị / Edit` mở
  ra input kèm Save riêng.
- **[GOV.UK summary list](https://design-system.service.gov.uk/components/summary-list/)**
  — profile mặc định ở **chế độ ĐỌC** với link "Change" từng hàng, thay vì một
  cột input xám. Hợp với khu account ít nội dung: trang không trông như form bỏ
  trống.
- **[Primer](https://primer.style/)** — không trộn control auto-save với control
  có nút Save trong cùng một form. Buộc tách Notifications khỏi Personal details.
- **Danger zone** — ba sản phẩm đồng thuận: đặt làm khối **cuối trang settings**,
  không tách route. Vercel dùng câu "scroll to the Delete Team section"; GitHub
  đặt đáy trang Account với dialog gõ-để-xác-nhận.
  → Ta nên rút còn **một trường** gõ xác nhận, và **tránh hộp viền đỏ dày** vì nó
  phá luật liều lượng màu (đỏ chỉ vài %).

## 4. Wishlist và trạng thái rỗng

**Wishlist** — hai code base sản xuất độc lập (BigCommerce Catalyst,
MarcosCamara01) làm giống hệt nhau:

- Lưới **đúng card của trang danh sách**, không chế card riêng
- Bỏ lưu tại chỗ bằng **nút X tròn góc card**, không phải toggle trái tim (tim ở
  trang saved dễ bấm nhầm và mơ hồ)
- **Không** nhóm/thư mục

**Về nhóm kiểu Airbnb: khuyến nghị KHÔNG**, có số bảo vệ — case study
Booking.com đo được chỉ ~20% người dùng từng lưu và **1,8%** đặt từ wishlist;
trong khi hệ nhiều-list của Catalyst tốn 41 file (~116 KB, 5 modal, 6 server
action, share public/private). Dồn ngân sách đó vào vị trí nút tim và độ đầy đủ
thông tin trên card đã lưu thì đúng chỗ hỏng hơn.

**Trạng thái rỗng** — món quý nhất là kỹ thuật **"bóng ma nội dung"** của
Catalyst: render lưới skeleton của chính card, phủ mask gradient mờ dần, đặt một
dòng chữ đè lên. Không một nét illustration nào → ăn khớp một-một với chính sách
ô placeholder sọc chéo của ta.

Luật viết copy, gom từ các design system:

- **Carbon** — "Image (optional)"; nếu chật thì chỉ dùng chữ
- **GitLab** — title ≤ ~5 chữ, không dấu chấm
- **Polaris** — nhãn nút theo mẫu **verb + noun**
- Câu mẫu hay nhất tìm được, của DataDog (qua NN/g):
  > "Star your favorites to list them here"

  Vừa nói trống, vừa dạy luôn thao tác.

## 5. Cạm bẫy đã đo được

1. **Đừng `shadcn add @7ovr/...` mù.** Registry đó mang `registry:style` có
   `cssVars` — có thể **ghi đè bảng màu Wuling đã chốt**. Hãy `curl` JSON rồi
   chép tay phần markup.
2. **`profile-1` của 7ovr sống nhờ ảnh bìa lớn** → vô dụng với chính sách
   placeholder. Bỏ thẳng.
3. **Kiranism và shadcn dashboard đều là dashboard ADMIN** đầy chart/kanban/
   data-table. Chỉ mượn cái vỏ trang và mẫu form — **tuyệt đối không mượn trang
   overview**; khu account của ta là của khách, không phải bảng điều khiển.
4. **Medusa order-card có bug thật** trong chính chi tiết đáng khen ("+ N more"):
   lưới `slice(0, 3)` render 3 thumbnail nhưng cổng hiện ô overflow lại là `> 4`
   → đúng 4 sản phẩm thì món thứ 4 **biến mất im lặng**; và số hiển thị là
   `numberOfLines - 4` (tổng số lượng) trong khi cổng đếm số dòng sản phẩm.
   Mượn ý tưởng thì được, **không copy code**.
5. Class của Medusa (`text-large-semi`, `text-ui-fg-base`) là của
   `@medusajs/ui-preset`, không phải Tailwind gốc — chép markup nguyên si sẽ ra
   chữ không style. Và `divide-gray-200` là màu cứng, vi phạm luật tokens-only.
