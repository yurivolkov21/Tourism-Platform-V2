# Plan thi công P6 — Trợ lý AI tư vấn tour (concierge)

> **Cho agent thi công:** làm tuần tự từng task, test trước ở logic thuần (luật 4).
> Bước dùng checkbox `- [ ]`. Comment code tiếng Việt, copy người dùng tiếng Anh
> trong `@tourism/i18n` (luật 7, 8).

**Mục tiêu:** khách (kể cả vãng lai) bấm nút "Plan your trip" ở mọi trang web, hỏi
trợ lý về tour, được trả lời từ catalogue thật, bấm link tới trang tour hay trang
đặt, và gửi được enquiry qua chat sau khi tự bấm Send trên thẻ xác nhận. Chi phí bị
chặn ở bốn lớp, cờ tắt mặc định.

**Kiến trúc ([ADR-0050](../adr/0050-ai-concierge-chat.md) + AMEND 1):** module `chat`
trong API NestJS, ba endpoint Nest thuần ngoài oRPC; lịch sử ở server, trình duyệt
chỉ gửi một tin mới hoặc một quyết định duyệt; ba tool gọi thẳng `CatalogService` và
`EnquiriesService`; stream theo giao thức UI message của AI SDK 7 qua `reply.raw`.
Web có nút nổi và khung chat dùng `useChat` gọi thẳng API.

**Stack:** AI SDK 7 (`ai` 7.0.118, `@ai-sdk/anthropic` 4.0.65, `@ai-sdk/react`
4.0.121, đã ghim 29/09) · NestJS 11, Fastify, Prisma 7 và pg-boss (api) · Next.js 16
và React 19 (web) · Vitest.

**Spec:** [2026-09-29-p6-ai-concierge-design.md](../specs/2026-09-29-p6-ai-concierge-design.md)
— hợp đồng của việc này; plan chỉ nói cách làm.

| Phần | Nhánh | Task |
| --- | --- | --- |
| P6 trợ lý AI (api, contract, web) | `feat/p6-ai-concierge-3xp4sq` | 1–13 |

**Điểm dừng 19/10:** xong cả 13 task, chờ review. Nhánh rebase lên `68f65ef` (có G25);
migration thật `20261019024540_chat_tokens_enquiry_turn` sinh bằng `prisma migrate diff`
trên DB đã có mọi migration của main, SQL trùng khớp bản tạm dùng lúc thi công. Thẻ
tour của ADR-0058 đổi kiểu `TourCard`, nên `searchTours` thêm sort `top-rated` và trả
`nextDeparture`. Web: 20 test component, kiểm đột biến tay; thử bằng Chromium với API
chạy model giả ở 375, 768 và 1440 (stream qua CORS, thẻ duyệt gửi enquiry thật vào DB
local, Esc trả tiêu điểm, nạp lại sau khi tải trang). Những chỗ lệch spec lúc thi công
đã sửa thẳng vào spec (§2a, §2b, §2c, §2f, §2h, §4). Còn lại là checklist hạ tầng bên
dưới, làm ở bước merge.

## Quyết định của plan

Spec viết trước khi đọc kỹ AI SDK 7 và trước G41, nên có sáu chỗ phải chốt lại. Spec
§2b, §2c, §2f, §3 và ADR-0050 (AMEND 1) được sửa trong cùng commit với plan.

1. **Tên API của AI SDK 7.** `needsApproval` trên `tool()` đã deprecated: dùng
   `toolApproval: { submitEnquiry: 'user-approval' }` trên `streamText`. Cũng đổi
   `system` → `instructions`, `onFinish` → `onEnd`, `stepCountIs` → `isStepCount`.
   Hành vi y như spec: model chỉ đề xuất, khách bấm Send thì tool mới chạy.
2. **Phát hiện lượt đang chạy bằng một cột "giữ lượt", không bằng unique `seq`.**
   Spec §2f dựa vào unique `(conversation_id, seq)`, nhưng tin chỉ được ghi lúc lượt
   KẾT THÚC, nên lượt thứ hai đến khi lượt đầu còn chạy sẽ không đụng unique nào và
   gọi model lần nữa (tốn tiền, và lượt duyệt có thể chạy tool hai lần). Migration
   thêm `chat_conversations.turn_started_at TIMESTAMP(3) NULL` (cùng kiểu các cột
   thời gian khác): đầu lượt một `updateMany` của Prisma `WHERE id = … AND
   (turn_started_at IS NULL OR turn_started_at < mốc − 2 phút)` với mốc là đồng hồ
   của tiến trình API (một instance); 0 dòng là 409 `CHAT_BUSY`.
   Cuối lượt (xong, lỗi, hay khách đóng tab) trả về `NULL`. Hạn 2 phút khớp
   `connectionTimeout` 120 giây: tiến trình chết giữa lượt thì hội thoại tự mở lại.
   Unique `seq` vẫn giữ làm lưới cuối.
3. **Ghi tin một lần ở cuối lượt.** Lượt chữ chèn tin khách (`seq` n) và tin trả lời
   (`seq` n+1, kèm token) trong một transaction, chạm `updated_at` của hội thoại (mốc
   của job dọn) và nhả cột giữ lượt. Lượt duyệt ghi đè chính tin trả lời đang chờ
   (cùng `seq`, AI SDK nối phần tiếp vào cùng UIMessage) và CỘNG token của lượt vào
   tin ấy. Trần ngày cộng theo `created_at` của tin, nên phần tiếp của một lượt duyệt
   bắc qua nửa đêm UTC được tính vào hôm trước; chấp nhận.
4. **Lỗi giữa stream không ghi gì.** Khách thấy Retry, web gửi lại đúng tin cũ, lịch
   sử sạch. Token của lượt hỏng (nếu Anthropic đã tính) không vào trần ngày; khách
   không gây ra được loại lỗi này, và tiền nạp trước ở Anthropic vẫn là trần cứng.
   Khách đóng tab thì KHÁC: nhánh stream của server (tee) giữ lượt chạy trọn và được
   ghi (spec §4).
5. **503 trước stream.** `streamText` lười, lỗi Anthropic chỉ hiện trong stream. API
   đọc trước các chunk tới chunk nội dung đầu tiên rồi mới gửi header; gặp chunk lỗi
   trước đó thì trả 503 `CHAT_UNAVAILABLE` dạng JSON, chưa ghi gì.
6. **`chat-retention` vào danh sách chạy bù của G41** (ADR-0024 AMEND 5): API gói
   free ngủ đúng 04:30 UTC thì cron lỡ, như ba job dọn khác.

Hai chỗ chốt thêm, không đổi spec:

- **Model:** giữ `claude-haiku-4-5` (1 USD / 5 USD mỗi triệu token) như spec. Bảng
  giá chỉ có dòng ấy; đổi model là thêm dòng và đổi `CHAT_MODEL`.
- **Danh sách slug trong prompt** đọc qua `CatalogService.listDestinations` và
  `listCategories`, cache trong tiến trình 5 phút; tour đang xem chỉ đưa slug vào
  prompt, nội dung tour vẫn phải lấy qua tool.

## Bản đồ file

| Vùng | File |
| --- | --- |
| Contract | `libs/shared/contract/src/schemas/chat.ts` + spec, export ở `index.ts` |
| API | `apps/api/src/modules/chat/` — `chat.module.ts`, `chat.controller.ts`, `chat.service.ts`, `chat-config.ts`, `chat-pricing.ts`, `chat-budget.ts`, `chat-prompt.ts`, `chat-tools.ts`, `chat-history.ts`, `chat-stream.ts`, spec đơn vị, `chat.int.spec.ts` |
| API chung | `config/env.ts`, `config/throttle.ts`, `app.module.ts`, `worker/start-worker.ts`, `worker/worker.module.ts`, `worker/chat-retention.service.ts` (+ int spec) |
| DB | `prisma/schema.prisma`, một thư mục migration mới |
| Web | `src/components/concierge/` — `contact-launcher.tsx`, `chat-panel.tsx`, `chat-message.tsx`, `chat-markdown.tsx`, `enquiry-confirm-card.tsx`, `use-concierge.ts`, `concierge-request.ts` (+ spec); sửa `site-chrome.tsx`, `scroll-to-top.tsx`, `tours/booking-rail.tsx` |
| Copy | `libs/shared/i18n/src/lib/messages.ts` (khối `chatBot`, `contactLauncher`) |
| Hạ tầng | `render.yaml`, `apps/api/.env.example`, `apps/api/scripts/reset-operational-data.mjs` (chỉ ghi chú) |

## Tasks

### Task 1 — Contract `ChatRequestSchema`

- [x] Test trước `chat.spec.ts`: `conversationId` phải là uuid; `tourSlug` theo luật
  slug sẵn có; `input.text` trim, 1..1000; `input` là đúng một trong hai dạng
  `message`/`approval`; body thừa field bị bỏ.
- [x] Viết `chat.ts`: `ChatRequestSchema`, `ChatErrorCode` (`INVALID_INPUT`,
  `CHAT_NOT_FOUND`, `CHAT_TURN_LIMIT`, `CHAT_BUSY`, `CHAT_UNAVAILABLE`), hằng
  `CHAT_LIMITS` (1000 ký tự, 20 tin khách) để web và API cùng đọc.

### Task 2 — Env, trần IP, bảng giá

- [x] `env.spec.ts`: `CHAT_ENABLED` mặc định false; bật mà thiếu `ANTHROPIC_API_KEY`
  là lỗi; `CHAT_MODEL` ngoài bảng giá là lỗi; `CHAT_DAILY_BUDGET_USD` 0,1..50, mặc
  định 1.
- [x] `chat-pricing.ts` (thuần, test trước): `CHAT_PRICES` theo model, `costUsd(model,
  inputTokens, outputTokens)`.
- [x] `env.ts` thêm bốn biến; `throttle.ts` thêm `CHAT_THROTTLE = { limit: 20, ttl:
  3_600_000 }`.

### Task 3 — Cổng trần và đếm lượt (thuần)

- [x] `chat-budget.ts`: `utcDayStart(now)`, `isOverDailyBudget({ inputTokens,
  outputTokens, model, budgetUsd })`; test biên đúng bằng trần là chặn.
- [x] `chat-history.ts`: `countUserMessages(rows)`, `nextSeq(rows)`,
  `applyApproval(message, approvalId, approved)` trả tin mới hoặc lỗi "không còn chờ";
  test: approvalId lạ, phần đã `approval-responded`, phần khác tool, hai tool cùng chờ.

### Task 4 — Prompt hệ thống (thuần)

- [x] `chat-prompt.ts` `buildInstructions({ today, destinations, categories, tourSlug })`.
  Test: có và không có tour đang xem; danh sách slug; ngày theo lịch Việt Nam
  (`vietnamToday`); các câu luật của spec §2d có mặt (đột biến tay: xoá một câu thì
  test đỏ).

### Task 5 — Ba tool

- [x] `chat-tools.ts` `createChatTools({ catalog, enquiries, conversation })`; hàm thu
  gọn kết quả là thuần, test riêng: `searchTours` map sort và `limit: 8`, giữ đúng các
  field spec §2c; `getTourDetails` cắt mô tả 200, FAQ 6 câu cắt 300, chỉ đợt
  `bookable`, tối đa 6 đợt.
- [x] `submitEnquiry`: slug → id chỉ khi tour đang bán, không thì enquiry chung; đã có
  `enquiry_id` thì `{ sent: false, reason: 'already_sent' }`; gọi
  `EnquiriesService.create(input, userId)` rồi ghi `enquiry_id` (unique chặn lần hai).

### Task 6 — Migration và schema Prisma (CHỜ LƯỢT)

> Chỉ làm khi coordinator báo đến lượt (sau G25). Trước đó code của Task 7–9 viết và
> chạy test với migration tạm ở máy, KHÔNG commit migration ấy.

- [x] `schema.prisma`: `ChatMessage.inputTokens Int?`, `outputTokens Int?`,
  `@@index([createdAt])`; `ChatConversation.enquiryId String? @unique` FK
  `enquiries` `onDelete: SetNull`, `turnStartedAt DateTime?`.
- [x] `pnpm prisma migrate dev --name chat_tokens_enquiry_turn` từ `main` mới nhất;
  đọc lại SQL; `check-rls.sh` xanh (bảng không đổi, chỉ thêm cột). Lúc làm dùng
  `prisma migrate diff --from-config-datasource --to-schema` cho cùng kết quả mà không
  cần shadow DB.

### Task 7 — `ChatService`

- [x] `chat-config.ts`: provider `CHAT_CONFIG` (`enabled`, `model`, `budgetUsd`) và
  `CHAT_LANGUAGE_MODEL` (`createAnthropic({ apiKey })(model)`, `null` khi tắt) — test
  ghi đè cả hai bằng `overrideProvider`.
- [x] `status()` → `{ available }`: cờ bật và chưa chạm trần ngày.
- [x] `getConversation(id, userId)` → UIMessage[]; không thấy hoặc khác chủ → `null`.
- [x] `startTurn(request, userId)` theo thứ tự spec §2a bước 3: cờ → trần ngày → tạo
  hoặc kiểm chủ hội thoại → trần 20 tin → giữ lượt → nạp lịch sử, áp quyết định duyệt
  → `validateUIMessages` với tools → `streamText({ instructions, messages:
  convertToModelMessages(...), tools, toolApproval, stopWhen: isStepCount(5),
  maxOutputTokens: 800 })` → `toUIMessageStream({ originalMessages })` rồi tee: nhánh
  khách trả về controller, nhánh server đọc tới cuối bằng `readUIMessageStream`, ghi tin
  (quyết định 3), nhả lượt, log một dòng `{ conversationId, inputTokens, outputTokens,
  ms, tools }` không có nội dung tin. (Bản plan đầu dùng `consumeStream` và `onEnd`;
  tee cho đúng UIMessage cuối cùng để ghi, kể cả khi khách đóng tab.)
- [x] Mọi nhánh thoát sớm sau khi đã giữ lượt đều nhả lượt (`try/finally`).

### Task 8 — Controller và stream qua Fastify

- [x] `chat-stream.ts`: `peekUntilContent(stream)` trả `{ ok: true, stream }` hoặc
  `{ ok: false }` khi chunk lỗi đến trước nội dung (quyết định 5); test bằng stream giả.
- [x] `chat.controller.ts` `@Public()` `@Controller('api/chat')`: `GET` → status;
  `GET :id` (uuid, sai dạng là 404) → messages; `POST` `@Throttle({ default:
  CHAT_THROTTLE })` → parse body bằng `ChatRequestSchema` (400 `INVALID_INPUT`), đọc
  phiên như `enquiries.controller.ts`, rồi `reply.hijack()` và `writeUIMessageStream(
  reply.raw, reply.getHeaders(), stream)` tự viết — chép header CORS và helmet đã đặt
  trên `reply` (spec §4). Không dùng `pipeUIMessageStreamToResponse` vì nó không nghe
  `close` của socket.
- [x] Mã lỗi theo bảng spec §2b, thân lỗi đúng dạng envelope của `AllExceptionsFilter`.
- [x] `ChatModule` vào `AppModule`; import `CatalogModule` cần export `CatalogService`,
  `EnquiriesModule` export `EnquiriesService`.

### Task 9 — Integration test (Postgres, `MockLanguageModelV4`, không gọi Anthropic)

- [x] Lượt thường ghi đủ hai tin, `seq` 1 và 2, token trên tin trả lời, `updated_at` mới.
- [x] Cờ tắt → 503; tổng token hôm nay vượt trần → 503; 21 tin khách → 409
  `CHAT_TURN_LIMIT`; đang giữ lượt → 409 `CHAT_BUSY`, giữ lượt quá 2 phút → chạy được;
  21 `POST` một giờ từ một IP → 429; model ném lỗi trước stream → 503, không ghi gì.
- [x] Hội thoại gắn tài khoản: phiên khác hoặc không phiên đọc → 404.
- [x] Tool đọc chạy trên tour seed thử (mock gọi `searchTours` rồi `getTourDetails`).
- [x] `submitEnquiry`: chưa duyệt thì 0 enquiry, tin trả lời có phần
  `approval-requested`; duyệt → đúng một enquiry, hai outbox, `enquiry_id`; gửi lại
  quyết định cũ → 400; Cancel → 0 enquiry; lần thứ hai trong hội thoại →
  `already_sent`.
- [x] Khách ngắt giữa stream (đóng socket) → lượt vẫn được ghi kèm token.
- [x] Preflight `OPTIONS /api/chat` từ origin web có `access-control-allow-origin`, và
  response stream mang header CORS (canh lỗi `reply.raw`).

### Task 10 — Job `chat-retention`

- [x] `chat-retention.service.ts` `sweep(now, days = 30)` xoá hội thoại `updated_at`
  quá hạn (tin xoá theo cascade). Int test: xoá đúng cái cũ, giữ cái mới.
- [x] `start-worker.ts`: queue `chat-retention`, cron `30 4 * * *`, `policy: 'short'`,
  `retryLimit: 0`; thêm vào danh sách chạy bù G41; dòng log khởi động.

### Task 11 — Copy

- [x] `chatBot`: sửa `disclaimer`, `unavailable` (bỏ WhatsApp, trỏ enquiry); thêm
  `closeAria`, `busy`, `rateLimited`, `turnLimit`, `confirm.{title, tour, send, cancel,
  sent, cancelled}`, `liveAnswerReady`. Xoá `contactLauncher.whatsapp`,
  `prefillGeneric`, `prefillTour`. Chỉ đụng hai khối này (thread i18n đang gom phần
  khác của file).

### Task 12 — Web

- [x] `lib/concierge.ts` (thuần, test trước): `toChatRequest(messages, id, tourSlug)`
  biến tin cuối thành `input` (tin chữ, hay quyết định duyệt khi tin cuối là trả lời
  có phần `approval-responded`); `errorKind(error)` đọc `APICallError` → `busy |
  rateLimited | turnLimit | unavailable | expired | generic`; `tourSlugFromPath(pathname)`.
- [x] `use-concierge.ts`: id trong localStorage, `useChat` với `DefaultChatTransport({
  api: browserApiOrigin() + '/api/chat', credentials: 'include',
  prepareSendMessagesRequest })`, `sendAutomaticallyWhen:
  lastAssistantMessageIsCompleteWithApprovalResponses`; mở khung mà có id thì nạp
  `GET /api/chat/:id` (404 thì bỏ id); Start over sinh id mới.
- [x] `chat-markdown.tsx`: `react-markdown` + `remark-gfm` trong `<Typeset
  preset="chat">`, `skipHtml`, link bắt đầu bằng `/` thành `Link`, link khác chỉ còn
  chữ. Test: link ngoài không có thẻ `<a>`.
- [x] `enquiry-confirm-card.tsx`: tên, email, lời nhắn, tên tour; Send và Cancel gọi
  `addToolApprovalResponse`.
- [x] `chat-message.tsx`, `chat-panel.tsx`: câu chào, ba gợi ý (`talkHuman` mở link
  enquiry), dòng trạng thái tool, lỗi theo `errorKind` kèm Retry; màn rộng là khung
  nổi, màn hẹp là lớp phủ; `role="dialog"`, Esc đóng và trả tiêu điểm về nút,
  `aria-live="polite"` chỉ báo khi câu trả lời xong.
- [x] `contact-launcher.tsx`: nút "Plan your trip" góc dưới phải; mở popover thì gọi
  `GET /api/chat` (vừa đánh thức API), "Chat with us" chỉ hiện khi `available`,
  "Send an enquiry" trỏ `/contact` hoặc `/tours/<slug>/enquire`.
- [x] Vị trí: `scroll-to-top.tsx` lên `bottom-20`; thanh đặt chỗ dưới `lg` gắn
  `data-booking-bar` lên `<body>` khi đang hiện, hai nút nổi và khung chat dùng biến
  thể `max-lg:in-data-booking-bar:` để đứng trên thanh; gỡ `pr-20` của thanh vì góc
  phải đã trống (đo bằng Chromium ở 375, 768 và 1440).
- [x] Test component (transport giả): popover ẩn hoặc hiện "Chat with us" theo
  `available`; gửi tin hiện tin và trạng thái tool; thẻ duyệt gọi đúng hàm; bốn mã lỗi
  ra đúng câu; khôi phục hội thoại từ localStorage.

### Task 13 — Khép lại

- [x] `render.yaml` thêm bốn key (`ANTHROPIC_API_KEY` `sync: false`, `CHAT_ENABLED`
  `false`), `apps/api/.env.example` thêm mẫu; ghi chú cột mới ở
  `reset-operational-data.mjs` (thứ tự xoá đã đúng: hội thoại trước enquiry).
- [x] Thử ở local bằng trình duyệt thật với API chạy `CHAT_ENABLED=true` và model giả
  (không có key Anthropic trong container): preflight, stream, thẻ duyệt, Esc, lớp phủ
  ở 375px. Lượt với Anthropic thật để cho bước thử tay của Yuri.
- [x] `pnpm gate:int` xanh; draft PR với checklist hạ tầng bên dưới.

## Checklist hạ tầng (vào mô tả PR, làm ở bước merge, luật 15)

1. Yuri chạy migration trên Supabase từ máy (`prisma migrate status` rồi `migrate deploy`).
2. Push main với `CHAT_ENABLED=false` (mặc định): nút nổi chỉ có enquiry.
3. Yuri tạo API key Anthropic, nạp trước một khoản nhỏ, tắt tự nạp.
4. Yuri đặt `ANTHROPIC_API_KEY`, `CHAT_MODEL`, `CHAT_DAILY_BUDGET_USD` trên Render và
   trong `apps/api/.env.production`, rồi bật `CHAT_ENABLED=true`.
5. Thử tay trên production từng bước; rồi entry CHANGELOG và cập nhật open-items P6.
