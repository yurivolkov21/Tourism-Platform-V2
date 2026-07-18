# Quy ước Outbox `dedupeKey`

Nguồn gốc: bug Nexora 2026-07-16 — dedupeKey khóa theo email làm notice
EMAIL_CHANGED bị nuốt vĩnh viễn khi đổi A→B→A→B. Nguyên nhân: quy ước chỉ tồn
tại ngầm trong đầu người viết. Văn bản hóa tại đây (audit M5).

## Quy tắc

Vì row `SENT` được giữ lại (retention 30 ngày) và `dedupeKey` là `@unique`,
một key đã dùng sẽ **chặn mọi enqueue trùng key cho đến khi row bị purge**.
Chọn dạng key theo đúng ngữ nghĩa lặp của event:

| Dạng key | Khi nào dùng | Ví dụ |
|---|---|---|
| `<event>:<entityId>` | Event chỉ được phép xảy ra **một lần cho mỗi entity** | `enquiry-received:${enquiry.id}` |
| `<event>:<entityId>:<state>` | Một lần cho mỗi **bước chuyển trạng thái** của entity | `booking-paid:${booking.id}`, `cancellation-denied:${req.id}:${decidedAt}` |
| `<event>:<email>` | Một lần **vĩnh viễn cho mỗi địa chỉ** — chỉ hợp lệ khi đó đúng là ý định (rất hiếm) | `newsletter-welcome:${email}` (chủ đích: welcome chỉ gửi 1 lần/địa chỉ) |
| `<event>:<entityId>:${randomUUID()}` | Event **hợp lệ khi lặp lại** — mỗi lần xảy ra là một thông báo mới | `email-changed:${user.id}:${randomUUID()}` |

## Cấm

- ❌ Key theo email cho event có thể lặp (chính là bug 16/07)
- ❌ Key theo timestamp tự sinh lúc enqueue (mất tính idempotent khi retry
  transaction — cùng event enqueue 2 lần ra 2 key khác nhau)
- ❌ Tái dùng một key cho 2 loại event khác nhau

## Kiểm tra khi review

Mỗi call-site enqueue mới phải trả lời được: *"nếu transaction này retry, và
nếu event này xảy ra lần thứ hai một cách hợp lệ, key này cho ra kết quả đúng
ở cả hai tình huống chứ?"* — retry ⇒ cùng key (dedupe), lặp hợp lệ ⇒ khác key.
