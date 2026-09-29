# ADR-0050 — Trợ lý AI: chat nằm trong API, lịch sử giữ ở server, tool ghi phải được khách duyệt, trần chi phí tính bằng token

- **Trạng thái:** Accepted (2026-09-29) — **chưa thi công**. Mở sau khi admin xong
  (P4e-3c, P4e-4, P4f); riêng bước ghim thư viện làm trước freeze 15/10 (§7).
- **Bối cảnh thi hành:** P6, đi trước code theo luật CLAUDE.md #5. Thiết kế chốt qua
  brainstorm 29/09, từng câu một.
- **Liên quan:** [ADR-0001](0001-tech-stack.md) (AMEND 2: AI SDK 7 thay 6) ·
  [ADR-0037](0037-default-write-throttle.md) (trần ghi) ·
  [ADR-0038](0038-web-shell-security-headers.md) (CSP `connect-src`) ·
  [ADR-0039](0039-inbound-channels-outbound-email.md) (enquiry: ack, suppression) ·
  [ADR-0035](0035-media-lifecycle.md) (khuôn cờ tắt mặc định và job cron) ·
  spec [2026-09-29-p6-ai-concierge-design.md](../specs/2026-09-29-p6-ai-concierge-design.md)

## Bối cảnh

Nexora có trợ lý chat tư vấn tour với ba tool `searchTours`, `getTourDetails`,
`submitEnquiry`; v2 thiếu nó là thụt lùi (luật 10). Hai bảng `chat_conversations` và
`chat_messages` đã có từ migration init, `payload` định sẵn là UIMessage của AI SDK.
Copy `chatBot` và `contactLauncher` đã port từ Nexora nhưng chưa có nơi dùng.

Ba điều làm bài toán khác một form thường:

1. **Mỗi lượt trả lời tốn tiền thật.** Dự án không doanh thu; khoá Anthropic là tiền
   nạp trước của chủ dự án. Một kẻ lạ lặp lại câu hỏi là đốt tiền trực tiếp.
2. **Chat công khai là kênh vào mới** cùng lớp với form liên hệ: khách vãng lai gõ
   được, và nội dung họ gõ đi thẳng vào prompt.
3. **API ở gói free của Render**, ngủ sau 15 phút không có request; web ở Vercel.

## Quyết định

### 1. Chat là một module của API NestJS, không phải route handler của web

Module `chat` trong `apps/api`, ba endpoint công khai **ngoài oRPC** (giống webhook):
`POST /api/chat` trả stream theo giao thức UI message của AI SDK; `GET /api/chat/:id`
trả lại hội thoại để hiển thị; `GET /api/chat` báo chat đang mở hay không. Schema
request dùng chung đặt ở `@tourism/contract` (không phải procedure oRPC).

Ba tool gọi thẳng service trong cùng tiến trình (`CatalogService`,
`EnquiriesService`). Nhờ vậy enquiry do trợ lý gửi đi qua đúng transaction, outbox,
dedupe ack và suppression của form; trần theo IP tính trên IP thật của khách; lưu tin
và đếm token làm bằng Prisma ngay tại chỗ; khoá Anthropic chỉ nằm trên Render.

### 2. Lịch sử là của server; trình duyệt chỉ gửi một trong hai thứ

Mỗi request mang `conversationId` — UUID trình duyệt sinh ở tin đầu; chưa có trong DB
thì API tạo hội thoại với id ấy — và **đúng một** trong hai:

- một tin chữ mới của khách;
- một quyết định duyệt `{ approvalId, approved }` cho tool đang chờ.

API nạp lịch sử từ DB, tự áp quyết định duyệt vào tin đã lưu, rồi mới gọi model.
Trình duyệt không bao giờ gửi cả lịch sử — gửi được là sửa được, và một "kết quả
tool" giả trong lịch sử là cửa nhồi dữ liệu sai vào câu trả lời (giá, chỗ trống).

`GET /api/chat/:id` trả hội thoại theo id là UUID ngẫu nhiên chỉ trình duyệt đó giữ.
Hội thoại gắn tài khoản (khách đăng nhập lúc tạo) thì đòi đúng phiên người đó.

### 3. Tool ghi phải được khách bấm duyệt

`submitEnquiry` khai `needsApproval` của AI SDK: model chỉ đề xuất (tên, email, lời
nhắn), trình duyệt hiện thẻ xác nhận, khách bấm Send thì API mới chạy. Tối đa **một**
enquiry mỗi hội thoại, giữ bằng cột `chat_conversations.enquiry_id` (unique). Hai tool
đọc không cần duyệt.

### 4. Trần chi phí: bốn lớp, lớp nào cũng đứng một mình được

1. **Theo IP:** `@Throttle({ default: CHAT_THROTTLE })`, 20 lượt POST mỗi giờ.
2. **Mỗi hội thoại:** 20 tin của khách; tin tối đa 1000 ký tự; mỗi lượt tối đa 5 bước
   gọi tool và 800 token trả lời.
3. **Toàn hệ thống mỗi ngày:** `CHAT_DAILY_BUDGET_USD` (mặc định 1). Chi phí ngày UTC
   bằng token đã ghi nhân bảng giá của model; chạm trần thì 503 tới hết ngày.
4. **Tiền nạp trước ở Anthropic**, tắt tự nạp: trần cứng cuối cùng nằm ngoài code.

Cờ `CHAT_ENABLED` mặc định `false` (cùng khuôn `MEDIA_GC_ENABLED`): tắt thì 503
`CHAT_UNAVAILABLE`. Bật mà thiếu `ANTHROPIC_API_KEY` là lỗi env lúc khởi động. Model
lấy từ `CHAT_MODEL` (mặc định `claude-haiku-4-5`); model ngoài bảng giá trong code
cũng là lỗi env — không đoán giá.

### 5. Lưu hội thoại, dọn sau 30 ngày

Mỗi lượt ghi tin khách và câu trả lời (UIMessage nguyên văn) kèm `input_tokens`,
`output_tokens` trên tin trả lời. Job pg-boss `chat-retention` (`30 4 * * *`) trong
worker xoá hội thoại không hoạt động quá 30 ngày. Log mỗi lượt chỉ ghi id hội thoại,
token, thời gian, tên tool — không ghi nội dung tin.

### 6. Web: nút nổi mọi trang, gọi thẳng API

Nút "Plan your trip" ở `(site)` mở hai lựa chọn: chat, hoặc gửi enquiry. `useChat` gọi
thẳng API (CORS và `connect-src` của API đã có); đang ở trang tour thì gửi kèm slug.
Mở nút nổi là gọi `GET /api/chat`: vừa biết có hiện lựa chọn chat không, vừa đánh
thức API trước khi khách gõ tin đầu. Câu trả lời render markdown
**không nhận HTML**, và chỉ link nội bộ (bắt đầu bằng `/`) mới thành link bấm được.

### 7. Thư viện: AI SDK 7, ghim trước freeze

`ai` 7.x và `@ai-sdk/anthropic` 4.x vào `apps/api`, `@ai-sdk/react` 4.x vào `apps/web`
(đo 29/09: 7.0.122, 4.0.68, 4.0.125; khớp Zod 4.4.3 và React 19.2.4 của repo). Freeze
15/10 cấm thêm dependency mà admin dự kiến xong sát ngày đó, nên ba gói được **ghim
bằng một commit riêng ngay sau khi spec duyệt**, code viết sau. Test dùng
`MockLanguageModelV4` của `ai/test`; CI không bao giờ gọi Anthropic.

## Hệ quả

- Chat chịu chung số phận API: API ngủ thì lượt đầu chậm (đánh thức lúc mở khung),
  API sập thì chat sập cùng trang đặt tour — một chỗ để canh thay vì hai.
- Endpoint stream nằm ngoài oRPC nên không có client sinh sẵn; web gọi bằng transport
  của AI SDK, schema chung ở contract giữ hai đầu khớp nhau.
- Chi phí xấu nhất một ngày là trần cộng các lượt đang chạy dở lúc chạm trần (mỗi lượt
  khoảng 1 cent), không phụ thuộc kẻ tấn công gửi bao nhiêu sau đó.
- Hội thoại có thể chứa tên và email khách gõ vào, sống tối đa 30 ngày, đọc được bằng
  id hội thoại. Chấp nhận vì id là UUID ngẫu nhiên chỉ trình duyệt giữ.

## Đã cân và bỏ

- **Route handler Next.js trên Vercel.** Đúng mẫu docs, cùng origin; nhưng web không
  có DB nên lưu, đếm token, trần ngày đều phải mở thêm endpoint API; enquiry gửi từ
  Vercel mang IP của Vercel, trần theo IP khách mất tác dụng; logic tách hai nơi.
- **Không dùng thư viện AI** (fetch thẳng Messages API). Né được freeze nhưng tự viết
  stream, vòng lặp tool và hook chat — rủi ro cao nhất cho lợi ích duy nhất đã có
  cách khác (ghim sớm).
- **Trình duyệt gửi cả lịch sử** (mặc định của `useChat`). Khách sửa được kết quả tool.
- **Chỉ khách đăng nhập được chat.** Chặn đúng người cần tư vấn trước khi mua.
- **Model miễn phí (Gemini).** Lệch ADR-0001, hạn mức thấp, dữ liệu gói miễn phí có
  thể bị dùng để huấn luyện.
- **Màn admin xem hội thoại.** Hữu ích khi soi lạm dụng, nhưng thêm một màn lúc admin
  còn dở; để sau P6.
