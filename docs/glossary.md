# Thuật ngữ

> Tra nhanh những từ xuất hiện khắp mã nguồn và tài liệu. Mỗi mục một hai câu;
> chỗ nào cần sâu thì có link. Bối cảnh chung ở [tổng quan](overview.md).

## Nghiệp vụ

| Từ | Nghĩa trong dự án này |
| --- | --- |
| **Tour** | Sản phẩm bày bán, ví dụ "Hạ Long 3 ngày 2 đêm". Bản thân tour không có ngày cụ thể. |
| **Chuyến** (*departure*) | Một lần chạy cụ thể của tour, có ngày đi, ngày về và số chỗ riêng. Khách đặt **chuyến**. |
| **Đơn** (*booking*) | Một lần đặt chỗ của một khách cho một chuyến. Có mã riêng để tra cứu. |
| **Điểm đến** (*destination*) | Địa danh, ví dụ Hội An. Một tour đi qua nhiều điểm đến, một trong số đó là điểm chính. |
| **Chỗ** (*seat*) | Suất cho một người trên một chuyến. Đặt thì trừ, huỷ thì trả lại. |
| **Hạn chót** (*cancellation deadline*) | Mốc duy nhất mỗi chuyến: qua mốc đó thì vừa ngừng nhận đặt, vừa hết huỷ-miễn-phí. Tự tính theo độ dài chuyến — [ADR-0041](adr/0041-single-cancellation-deadline.md). |
| **Hoàn thiện chí** (*goodwill refund*) | Khoản hoàn do nhân viên quyết cho trường hợp ngoại lệ, bắt buộc ghi số tiền và lý do. |
| **Sổ hoàn tiền** (*refund ledger*) | Bảng chỉ-ghi-thêm, mỗi dòng là một lần hoàn thật. Không bao giờ sửa hay xoá dòng cũ. |
| **Đánh giá đã xác thực** (*verified review*) | Đánh giá gắn với một đơn đã thanh toán — bằng chứng người viết đã thực sự đi. |
| **Câu hỏi khách** (*enquiry*) | Tin nhắn khách gửi qua form. Có vòng trạng thái để nhân viên theo dõi. |
| **Bản tin** (*newsletter*) | Danh sách email đăng ký nhận tin. Bỏ đăng ký bằng link trong mail. |

## Trạng thái

| Trạng thái | Của cái gì | Nghĩa |
| --- | --- | --- |
| `PENDING` | Đơn | Đã tạo, chưa trả tiền. Giữ chỗ tạm, hết hạn thì tự huỷ. |
| `PAID` | Đơn | Đã trả tiền đủ. |
| `PARTIALLY_REFUNDED` | Đơn | Đã hoàn một phần, vẫn còn hiệu lực. |
| `REFUNDED` | Đơn | Đã hoàn hết tiền. |
| `CANCELLED` | Đơn | Đã huỷ. Có thể kèm hoàn tiền hoặc không. |
| `OPEN` / `CLOSED` / `CANCELLED` | Chuyến | Còn nhận khách / đã đóng / công ty huỷ chuyến. |
| `NEW → CONTACTED → QUOTED → WON` / `LOST` | Câu hỏi khách | Vòng đời một lead. |
| `DRAFT` / `PUBLISHED` | Bài blog | Nháp / đã đăng. |

Vì sao đơn đã huỷ lại có nhiều trạng thái khác nhau: [booking-states](conventions/booking-states.md).

## Dựng web

| Từ | Nghĩa |
| --- | --- |
| **SSG** | Trang được dựng sẵn thành HTML lúc build, ai vào cũng nhận bản giống nhau. Nhanh nhất. |
| **ISR** | Như SSG nhưng tự dựng lại sau một khoảng thời gian (ở đây 300 giây), để nội dung không cũ quá. |
| **On-demand revalidation** | Bảo trang dựng lại **ngay** khi dữ liệu đổi, thay vì đợi hết 300 giây. |
| **Server Component / Client Component** | Phần giao diện chạy ở máy chủ (không gửi JavaScript xuống) và phần chạy trong trình duyệt (bấm được, gõ được). |
| **Prerender** | Bước lúc build, máy dựng sẵn từng trang một. Nếu máy chủ API lúc đó chết thì build đỏ — xem [ADR-0044](adr/0044-prerender-retry-transient-api.md). |
| **Token thiết kế** | Giá trị màu / phông / khoảng cách đặt tên sẵn, khai một chỗ ở `@tourism/tokens` rồi cả bốn app dùng chung. Luật repo: **không viết mã màu trực tiếp**. |
| **Mockup** | Bản vẽ HTML của một vòng thiết kế đã được duyệt. Là ảnh chụp lịch sử — **không sửa**. |

## Máy chủ và dữ liệu

| Từ | Nghĩa |
| --- | --- |
| **Endpoint** | Một "cửa" của máy chủ, ví dụ *lấy danh sách tour* hay *tạo đơn*. |
| **Contract** | Bản mô tả mọi endpoint: gửi gì lên, nhận gì về. Cả máy chủ lẫn các app đều đọc chung bản này nên sai kiểu dữ liệu là báo lỗi ngay lúc code. |
| **oRPC** | Thư viện dùng để viết và gọi contract đó. |
| **Prisma** | Công cụ nói chuyện với cơ sở dữ liệu bằng TypeScript thay vì viết SQL tay. |
| **Migration** | Một bước thay đổi cấu trúc cơ sở dữ liệu. **Đã chạy rồi thì bất biến** — muốn đổi thì viết migration mới. |
| **Seed** | Dữ liệu mẫu bơm vào cho site trông như đang hoạt động thật (tour, chuyến, đơn, đánh giá). |
| **Advisory lock** | Khoá tạm ở cơ sở dữ liệu, bảo đảm hai việc đụng cùng một đơn không chạy chen nhau. |
| **Idempotency key** | Mã chống-làm-hai-lần. Gửi lại cùng lệnh với cùng mã thì cổng thanh toán chỉ thực hiện một lần. |
| **Webhook** | Cổng thanh toán tự gọi ngược về máy chủ để báo "đã thu tiền", thay vì máy chủ phải hỏi liên tục. |
| **Outbox** | Hàng đợi email: việc gửi mail được ghi vào bảng trước, một tiến trình riêng gửi sau — để mail không mất khi có sự cố. |
| **Cron / sweep** | Việc chạy định kỳ, ví dụ dọn các đơn chưa trả tiền đã quá hạn. |
| **Rate limit / throttle** | Chặn một người gọi quá nhiều lần trong thời gian ngắn. |
| **Soft delete** | Xoá mềm: đánh dấu đã xoá thay vì xoá hẳn, để dữ liệu liên quan không đứt. |

## Hạ tầng

| Từ | Là gì trong dự án |
| --- | --- |
| **Vercel** | Nơi chạy web khách và web quản trị. |
| **Render** | Nơi chạy máy chủ API và tiến trình gửi mail. Gói miễn phí nên **ngủ sau 15 phút** không ai gọi. |
| **Supabase** | Nơi chứa cơ sở dữ liệu Postgres thật. |
| **Cloudinary** | Nơi chứa ảnh. |
| **Resend** | Dịch vụ gửi email. |
| **Session pooler** | Kiểu kết nối tới cơ sở dữ liệu mà dự án bắt buộc dùng (cổng 5432). Cổng 6543 là kiểu khác — **cấm**. |

## Quy trình làm việc trong kho mã

| Từ | Nghĩa |
| --- | --- |
| **ADR** | *Architecture Decision Record* — một quyết định kiến trúc kèm lý do, phương án đã loại và cái giá phải trả. Viết **trước** khi code. |
| **Spec** | Mô tả sẽ xây gì trong một đợt, viết để chủ dự án duyệt trước khi bắt tay. |
| **Plan** | Chia spec đã duyệt thành từng bước thi công. |
| **AMEND** | Phần sửa bổ sung gắn vào một ADR đã chốt, thay vì viết ADR mới. Ghi rõ ngày và lý do. |
| **Gate** | Bộ kiểm tra bắt buộc: build + kiểm kiểu + test + lint. `pnpm gate:int` là bản đầy đủ, có cả integration test. |
| **Integration test** | Test chạy với cơ sở dữ liệu thật (Docker), chậm hơn nhiều nhưng bắt được lỗi mà test thường bỏ sót. |
| **TDD** | Viết test trước, code sau. |
| **Parity / thụt lùi** | So với dự án tiền nhiệm Nexora: thứ gì bên đó có mà đây thiếu thì gọi là thụt lùi, phải vá hoặc ghi rõ lý do bỏ. |
| **ff-only** | Kiểu gộp nhánh giữ lịch sử thẳng, không sinh commit gộp. |
| **Còn treo** | Việc đã biết là phải làm nhưng chưa làm. Gom ở [open-items.md](open-items.md). |
