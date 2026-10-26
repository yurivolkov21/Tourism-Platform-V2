# Khoá chống gửi trùng email (`dedupeKey`)

Mọi email của hệ thống đi qua hàng đợi outbox (xem [thuật ngữ](../glossary.md)),
và mỗi thư mang một `dedupeKey` để không bị gửi hai lần. Trang này quy định cách
đặt khoá đó.

Nguồn gốc: một lỗi ở dự án tiền nhiệm Nexora ngày 16/07/2026. Khoá đặt theo địa chỉ
email làm thông báo `EMAIL_CHANGED` bị nuốt vĩnh viễn khi người dùng đổi email qua
lại A→B→A→B. Nguyên nhân là quy ước chỉ nằm ngầm trong đầu người viết, nên nay được
ghi thành văn ở đây.

## Quy tắc

Dòng `SENT` được giữ lại 30 ngày và `dedupeKey` là `@unique`, nên một khoá đã
dùng sẽ chặn mọi lần xếp hàng trùng khoá cho tới khi dòng đó bị dọn. Chọn dạng
khoá theo đúng cách sự kiện có thể lặp lại:

| Dạng key | Nghĩa | Dùng khi |
| --- | --- | --- |
| `<event>:<entityId>` | Một lần cho mỗi entity | Sự kiện chỉ xảy ra một lần trong đời entity |
| `<event>:<entityId>:<id phụ>` | Một lần cho mỗi bản ghi con | Mỗi lần xảy ra sinh ra một dòng riêng để neo vào |
| `<event>:<email>` | Một lần **vĩnh viễn** cho mỗi địa chỉ | Rất hiếm — chỉ khi đó đúng là ý định |
| `<event>:<email>:<ngày UTC>` | Tối đa một lần mỗi địa chỉ mỗi ngày | Thư gửi lại được có chủ đích nhưng không được thành máy gửi thư |
| `<event>:<entityId>:<giá trị dùng một lần>` | Một lần cho mỗi mã/link phát ra | Mỗi lần phát sinh một bí mật mới thì đó là thư mới |
| `<event>:<entityId>:<uuid ngẫu nhiên>` | Luôn khác nhau | Event **hợp lệ khi lặp** — mỗi lần là một thông báo mới |

## Đang dùng thật (đo 14/10/2026)

| Key | Nơi sinh | Dạng |
| --- | --- | --- |
| `booking-confirmed:<bookingId>` | `bookings.service.ts` | một lần mỗi booking |
| `enquiry-admin-alert:<enquiryId>` | `enquiries.service.ts` | một lần mỗi câu hỏi |
| `refund:<bookingId>:<refundRowId>` | `refunds.service.ts` | một lần mỗi dòng hoàn — sổ append-only nên mỗi lần hoàn có một id riêng để neo |
| `booking-cancelled:<bookingId>` | `cancellations.service.ts` (ghép trong SQL) | một lần mỗi booking — huỷ chỉ xảy ra một lần |
| `overbook-refund:<bookingId>` · `departure-closed-refund:<bookingId>` · `departure-moved-refund:<bookingId>` | `payments.service.ts` (`DEDUPE_PREFIX` theo nguyên nhân) | một lần mỗi booking — hoàn tự động trọn đơn khi claim trượt |
| `orphan-refund:<bookingId>` | `payments.service.ts` | một lần mỗi booking — hoàn khoản thu mồ côi |
| `review-approved:<reviewId>` | `reviews.service.ts` | một lần mỗi review |
| `review-rejected:<reviewId>:<lần bác thứ mấy>` | `reviews.service.ts` | mỗi lần bác là một thư — review sửa rồi gửi lại có thể bị bác lần nữa, nên neo theo số lần |
| `newsletter-welcome:<email>` | `newsletter.service.ts` | một lần vĩnh viễn mỗi địa chỉ (chủ đích) |
| `newsletter-confirm:<email>:<ngày UTC>` | `newsletter.service.ts` | gửi lại thư xác nhận khi chưa confirm sau 24 giờ |
| `enquiry-received:<email>:<ngày UTC>` | `enquiries.service.ts` | ACK cho người gửi (ADR-0039 §1) |
| `pwreset:<userId>:<url>` | `auth.config.ts` | mỗi link đặt lại mật khẩu là một thư |
| `email-otp:<email>:<mã>` | `auth.config.ts` | mỗi mã OTP là một thư |

Hai lưu ý đọc được từ bảng:

- **Email trong key phải normalize lowercase.** `dedupe_key` là `varchar`
  thường, không phải `citext` — `Jane@X.com` và `jane@x.com` cho ra hai key
  khác nhau, tức hai thư.
- **Key bị cắt ở 200 ký tự** (`VarChar(200)`). Dạng có `url` bên trong
  (`pwreset`) gọi `.slice(0, 200)` ngay tại call-site.

`EmailType.EMAIL_CHANGED` đã khai nhưng **chưa có luồng nào enqueue**. Khi nào
làm, nó là ví dụ mẫu của dạng "lặp hợp lệ": `email-changed:<userId>:<uuid>` —
đúng chỗ lỗi ngày 16/07 của Nexora đã vấp khi khoá theo địa chỉ.

## Cấm

- ❌ Key theo email cho event có thể lặp (chính là lỗi ngày 16/07)
- ❌ Key theo timestamp tự sinh lúc enqueue — mất tính idempotent khi retry
  transaction: cùng một event enqueue hai lần ra hai key khác nhau
- ❌ Tái dùng một key cho hai loại event khác nhau

## Kiểm tra khi review

Mỗi call-site enqueue mới phải trả lời được: *"nếu transaction này retry, và
nếu event này xảy ra lần thứ hai một cách hợp lệ, key này cho ra kết quả đúng
ở cả hai tình huống chứ?"* — retry ⇒ cùng key (dedupe), lặp hợp lệ ⇒ khác key.
