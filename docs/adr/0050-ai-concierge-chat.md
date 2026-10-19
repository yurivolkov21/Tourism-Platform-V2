# ADR-0050 — Trợ lý AI: chat nằm trong API, lịch sử giữ ở server, tool ghi phải được khách duyệt, trần chi phí tính bằng token

- **Trạng thái:** Accepted (2026-09-29) — mở thi công 15/10 (user chọn "Làm ngay"),
  plan [2026-10-15-p6-ai-concierge.md](../plans/2026-10-15-p6-ai-concierge.md). Thư viện
  đã ghim 29/09 (§7).
- **Sửa đổi:** AMEND 1 (2026-10-15, cuối file) — tên API của AI SDK 7 cho tool cần
  duyệt; cột giữ lượt chống hai lượt chạy song song; job dọn có trong danh sách chạy bù.
  AMEND 2 (2026-10-19, cuối file) — khách đã đăng nhập hỏi được đơn của chính mình (chỉ
  đọc); khách vãng lai hỏi chuyện tài khoản nhận một câu mời đăng nhập; nút nổi mở thẳng
  khung chat.
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

`ai` và `@ai-sdk/anthropic` vào `apps/api`; `ai` và `@ai-sdk/react` vào `apps/web` (web
cần chính `ai` cho `DefaultChatTransport`). Bản ghim 29/09: `ai` 7.0.118,
`@ai-sdk/anthropic` 4.0.65, `@ai-sdk/react` 4.0.121 — bản mới nhất lúc ấy chưa đủ một
ngày nên cổng `minimumReleaseAge` của pnpm lấy bản liền trước, và `@ai-sdk/react`
4.0.121 là bản kéo đúng `ai` 7.0.118 để web chỉ có một bản `ai`. Cả ba khớp Zod 4.4.3
và React 19.2.4 của repo. Freeze
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

## AMEND 1 15/10 — đọc kỹ AI SDK 7 lúc viết plan

Ba chỗ của bản gốc không còn đúng khi đối chiếu `node_modules/ai` 7.0.118 (docs đi kèm
gói và file `.d.ts`) và hạ tầng sau 29/09:

1. **§3: tool cần duyệt khai ở `streamText`, không ở `tool()`.** `needsApproval` đã
   deprecated ở AI SDK 7 (hướng dẫn nâng cấp v7, mục "Migrate Deprecated
   `needsApproval` to `toolApproval`"). Dùng `toolApproval: { submitEnquiry:
   'user-approval' }`. Hành vi giữ nguyên: model đề xuất, khách bấm Send thì tool mới
   chạy, trình duyệt thấy phần tool ở trạng thái `approval-requested`. Lịch sử vẫn do
   server giữ (§2) nên không cần `experimental_toolApprovalSecret` — cờ ấy sinh ra cho
   mô hình trình duyệt gửi cả lịch sử, mô hình mà §2 đã loại.
2. **§2, §5: một cột giữ lượt `chat_conversations.turn_started_at`.** Tin ghi lúc lượt
   kết thúc, nên unique `(conversation_id, seq)` không chặn được lượt thứ hai đến khi
   lượt đầu còn chạy: lượt ấy sẽ gọi model thêm một lần (tốn tiền), và một lượt duyệt
   chen vào có thể chạy `submitEnquiry` lần hai. Đầu lượt một câu `UPDATE` có điều kiện
   giữ lượt (trống, hoặc đã giữ quá 2 phút — tiến trình chết giữa lượt thì hội thoại tự
   mở lại); 0 dòng là 409 `CHAT_BUSY`. Cột này nằm trong cùng migration với các cột của
   spec §2f. Không dùng advisory lock của Postgres: lượt stream kéo dài hàng chục giây,
   giữ một kết nối suốt chừng ấy là ăn vào trần 15 client của Session pooler (G23).
3. **§5: `chat-retention` vào danh sách chạy bù hằng ngày** (ADR-0024 AMEND 5, G41,
   có sau 29/09): cron 04:30 UTC lỡ lượt mỗi khi API gói free ngủ đúng giờ ấy.

## AMEND 2 19/10 — trợ lý đọc đơn của chính khách, bỏ menu hai lối

Sau khi chat bật trên production (19/10), Yuri muốn khách đã đăng nhập hỏi được về tài
khoản của mình, và bỏ menu "Talk to us" vì lối "Send an enquiry" trong đó thừa. Yuri chọn
phạm vi **chỉ xem đơn** (thẻ quyết định 19/10 07:46), rồi dặn thêm (08:00): khách chưa
đăng nhập hỏi chuyện tài khoản hay cá nhân thì chỉ nhận một câu cố định mời đăng nhập.
AMEND này đảo dòng "Đọc dữ liệu tài khoản" ở mục Ngoài phạm vi của spec P6 §1.

1. **Hai tool chỉ đọc, chỉ cho khách đã đăng nhập.** `listMyBookings({ when })` (tối đa
   10 đơn, gọi `BookingsService.mine` thứ tự `journey`) và `getMyBooking({ code })` (gọi
   `BookingsService.byCode`). Không tool nào nhận user id: danh tính lấy từ phiên ở
   server, mã đơn của người khác trả `{ found: false }` y như trang web trả 404. Hai tool
   chỉ được đăng ký khi lượt có phiên; lượt vãng lai không có chúng nên model không có
   đường nào tra đơn. Không tool nào ghi: huỷ, thanh toán tiếp, tải voucher, viết review
   đều là link tới trang đơn `/account/bookings/<mã>`.
2. **Kết quả thu gọn ở server, trạng thái viết sẵn bằng chữ.** Model chỉ nhận mã đơn,
   tên và link tour, ngày đi và về, số khách, trạng thái chuyến và trạng thái tiền viết
   bằng chữ (suy từ `bookingPhase` của contract và trạng thái đơn), tổng tiền, ngày và cổng
   thanh toán, hạn huỷ miễn phí và số tiền hoàn nếu huỷ ngay (số `byCode` đã tính), yêu cầu
   huỷ và số đã hoàn, lý do công ty huỷ chuyến, review đã viết hay viết được chưa. Model
   KHÔNG nhận email, số điện thoại, tên người liên hệ, ghi chú tự do, link thanh toán, id
   nội bộ, nội dung review. Lý do: mỗi trường gửi đi là dữ liệu cá nhân tới bên thứ ba, và
   enum thô để model tự diễn giải là chỗ dễ nói sai trạng thái.
3. **Hội thoại vô chủ được gắn vào tài khoản trước lượt có phiên.** Theo §2, hội thoại
   tạo lúc chưa đăng nhập thì ai biết id cũng đọc được. Khách đăng nhập giữa chừng rồi hỏi
   đơn thì dữ liệu đơn sẽ nằm trong một hội thoại như vậy. Nên: lượt `POST` có phiên vào
   hội thoại chưa có chủ thì một câu `UPDATE … WHERE user_id IS NULL` gắn nó vào tài khoản
   TRƯỚC khi giữ lượt và gọi model. Từ đó hội thoại theo luật hội thoại có chủ của §2: chỉ
   đúng phiên ấy đọc hay ghi được, người khác nhận 404. Vì vậy mọi lượt chạy hai tool đều
   nằm trong hội thoại thuộc đúng người có đơn. `GET /api/chat/:id` không gắn gì (đọc
   không đổi chủ).
4. **Khách vãng lai: một câu cố định.** Prompt mỗi lượt mang cờ đã đăng nhập hay chưa.
   Chưa đăng nhập thì prompt dặn: hỏi về đơn, thanh toán, hoàn tiền, tài khoản hay thông
   tin cá nhân thì chỉ trả câu "chưa thể kiểm tra vì bạn chưa đăng nhập" kèm link
   `/login`, theo ngôn ngữ khách viết; không hỏi mã đơn hay email để tra hộ, không đoán.
   Tìm tour, xem tour, gửi enquiry giữ nguyên. Lớp chặn thật là §1 (không có tool); câu
   trong prompt chỉ quyết khách đọc thấy gì.
5. **Web (sửa §6): nút nổi mở thẳng khung chat.** Bỏ popover hai lối. Khung tự gọi
   `GET /api/chat` mỗi lần mở: trong lúc chờ (API gói free có thể đang ngủ) đầu khung báo
   đang kết nối; trợ lý tắt hay chạm trần ngày thì khung hiện câu "taking a break" kèm link
   enquiry. Lối tới người thật trong khung là gợi ý "Talk to a human" và trợ lý gửi enquiry
   như cũ. Khách đã đăng nhập thấy lời chào theo tên và thêm gợi ý "Show my bookings"; tên
   chỉ dùng ở web, không gửi cho model. Phiên đổi từ một tài khoản sang không phiên hay
   tài khoản khác (đăng xuất ở bất kỳ nút nào) thì web xoá id hội thoại khỏi localStorage
   và dỡ khung khỏi bộ nhớ, để máy dùng chung không hiện đơn của người trước. Đăng nhập từ
   vãng lai thì giữ hội thoại; lượt sau sẽ gắn nó vào tài khoản (mục 3).
6. **Trang `/privacy`** kể thêm: khách đã đăng nhập hỏi về đơn thì chi tiết đơn trợ lý tra
   được gửi tới Anthropic cùng tin nhắn, không kèm email hay số điện thoại.

Không đổi: không migration, không env, không dependency; trần chi phí §4 giữ nguyên. Lượt
có tra đơn tốn thêm khoảng 1–2 nghìn token vào (10 đơn, mỗi đơn vài trường). Dữ liệu đơn
nằm trong hội thoại sống tối đa 30 ngày như mọi tin khác (§5).

**Đã cân và bỏ:**

- *Huỷ đơn hay thanh toán tiếp qua chat* (tool ghi có thẻ duyệt như `submitEnquiry`). Yuri
  chọn chỉ xem; trang đơn đã có các nút ấy, và đường tiền không đi qua model.
- *Khách vãng lai tra đơn bằng mã đơn và email.* Không có xác thực thật; ai có mã đơn
  trong email chuyển tiếp là đọc được đơn của người khác.
- *Gửi nguyên `BookingDetail` cho model.* Gọn code hơn nhưng kéo theo email, số điện
  thoại, ghi chú tự do và link thanh toán tới Anthropic.
- *Chỉ chặn bằng prompt, vẫn đăng ký tool cho mọi lượt.* Prompt injection vượt được câu
  dặn; không có tool thì không có gì để vượt.
