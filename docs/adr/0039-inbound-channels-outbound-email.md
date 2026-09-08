# ADR-0039 — Kênh vào & email đi ra: ack, consent hai bước, token có mục đích, outbox bền, suppression, retention

- **Trạng thái:** Accepted (2026-09-07, đợt W4 `fix/inbound-channels`, ADR đi trước code)
- **Bối cảnh:** [Rà bảo mật 05/09](../analysis/2026-09-05-web-security-audit.md)
  cụm 4 (trọn) + [spec W4](../specs/2026-09-07-w4-inbound-channels-design.md).
  W4 là bề mặt **không cần tài khoản**: form liên hệ và form newsletter là hai
  endpoint ghi công khai duy nhất mà người lạ điều khiển được NỘI DUNG lẫn
  NGƯỜI NHẬN của email hệ thống gửi đi. Ba đợt trước (W1 tiền, W2 phiên,
  W3 vỏ Next) vá thứ kẻ tấn công đã có tài khoản; đợt này vá máy-gửi-thư.
- **Liên quan:** [ADR-0007](0007-transactional-outbox.md) (outbox),
  [ADR-0025](0025-transactional-email-react-email.md) (render), ADR-0037
  (throttle), [quy ước dedupe-key](../conventions/outbox-dedupe-key.md).

## Quyết định

### 1. Ack liên hệ KHÔNG lặp nội dung khách, một ack mỗi địa chỉ mỗi ngày

Template `ENQUIRY_RECEIVED` **bỏ khối "YOUR MESSAGE"** in nguyên `message`:
khách viết gì họ tự biết, còn với kẻ lạ thì đó là một máy gửi thư có nội dung
tự chọn tới địa chỉ tự chọn (điền email nạn nhân + message tuỳ ý → hệ thống
gửi hộ một bức thư mang thương hiệu của ta). Alert cho ADMIN giữ nguyên đầy
đủ message — người nhận là chính ta.

`dedupeKey` của ack đổi khuôn: `enquiry-received:<email>:<yyyy-mm-dd>` (ngày
lịch UTC như ADR-0030) — **một ack mỗi địa chỉ mỗi ngày**, spam 50 form một
buổi không thành 50 email tới nạn nhân. Key theo email có chủ đích ở đây
(ghi vào bảng ngoại lệ của quy ước dedupe-key); alert admin GIỮ key theo id
(`enquiry-admin-alert:<id>`) — admin phải thấy đủ mọi lead.

### 2. Consent hai bước cho newsletter (double opt-in)

Row `Subscriber` chưa confirm nghĩa là "đã xin", **không phải "đã đồng ý"**:

- Cột mới `subscribers.confirmed_at` (null = chưa xác nhận).
- Email đầu tiên sau subscribe là thư **XÁC NHẬN** (cùng khung template
  welcome, khác CTA — link HMAC mục đích `confirm`), không phải welcome.
- `confirmedAt` set khi khách bấm link: GET hiện trang xác nhận (đọc thuần,
  chống prefetch của mail client), POST claim atomic — đúng khuôn
  unsubscribe.
- **Mọi đợt gửi hàng loạt tương lai chỉ tới subscriber có `confirmedAt` khác
  null** — hôm nay chưa có campaign nào, ghi thành bất biến để ngày có
  campaign không phải bàn lại.
- Admin subscribers list/CSV thêm cột confirmed.
- Web thêm link `/privacy` ngay dưới form đăng ký.

**Backfill một lần:** người đã subscribe TRƯỚC W4 (chưa có cột) được
migration set `confirmed_at = created_at` — họ đã nhận welcome và đã có
consent theo luật cũ (một bước); đòi họ xác nhận lại là mất sạch danh sách vì
một thay đổi kỹ thuật. Đây là quyết định MỘT LẦN nằm trong chính file
migration, không phải luật chạy lại.

### 3. Token có mục đích + phiên bản

Format mới `v1.<purpose>.<hmac>` với `purpose ∈ unsubscribe | confirm |
resubscribe`; HMAC ký trên `<subscriberId>.<purpose>[.<exp>]` bằng
`NEWSLETTER_UNSUBSCRIBE_SECRET` như cũ. Vì sao: token v0 là HMAC trần của
riêng subscriberId — MỘT chuỗi dùng được cho MỌI hành vi, nên link huỷ trong
một email cũ cũng chính là link resubscribe và (từ W4) link confirm; mỗi mục
đích một chữ ký thì cầm token này không đổi được sang cửa khác.

- `resubscribe` mang `exp` 30 ngày (epoch giây trong phần ký): quyền "đăng
  ký lại không cần double opt-in" không được sống vĩnh viễn trong một hộp
  thư bị bán lại. `unsubscribe` và `confirm` không hết hạn (huỷ đăng ký phải
  luôn chạy — CAN-SPAM; confirm hết hạn chỉ tạo ngõ cụt).
- **Token v0 (HMAC trần) vẫn được nhận cho DUY NHẤT `unsubscribe`** — mọi
  email đã gửi trước W4 in token dạng đó, và link huỷ trong email cũ phải
  chạy. Ngày ngừng nhận v0: **31/12/2026** — outbox purge 30 ngày nghĩa là
  không còn hàng đợi nào chứa token cũ từ lâu, nhưng khách vẫn giữ email
  trong hộp thư; sau ngày đó nhánh v0 gỡ thẳng (một lần đổi mã có chủ đích,
  không cần migration).

### 4. Outbox bền: backoff luỹ thừa + 4xx-không-retry + suppression

- Cột mới `outbox.next_attempt_at`; drain chỉ lấy row PENDING có
  `next_attempt_at <= now` (null = tới hạn ngay). Lỗi tạm (5xx / 429 / lỗi
  mạng) → `attempts + 1`, `next_attempt_at = now + 2^attempts phút`, trần
  60 phút. `MAX_ATTEMPTS` giữ nguyên. Trước đây mọi row lỗi quay lại ĐẦU
  batch của lượt drain kế (mỗi phút) — một sự cố Resend 5 phút là đốt sạch
  attempts của cả hàng đợi.
- **Lỗi 4xx (trừ 429) → FAILED ngay, không retry:** thư sai địa chỉ, payload
  hỏng, key bị thu hồi — gửi lại y nguyên chỉ ra y kết quả.
  `resend.deliverer` ném lỗi MANG `status` để drain phân loại được.
- `admin.outbox.retry` reset cả `next_attempt_at` — operator bấm retry là
  muốn gửi NGAY, không phải xếp lại cuối backoff.
- **Bảng mới `email_suppressions`** (`email citext PK, reason, source,
  created_at`, bật RLS trong cùng migration): nguồn sự thật THỨ HAI bên cạnh
  `unsubscribedAt`. Ghi bởi webhook `POST /api/webhooks/resend` (svix verify
  bằng `RESEND_WEBHOOK_SECRET`; sự kiện `email.bounced` hard-bounce và
  `email.complained` → upsert). Drain SKIP mọi row gửi tới địa chỉ
  suppressed — trạng thái SKIPPED, lý do vào `lastError` để admin outbox
  thấy. Thiếu env → controller trả 503 + log MỘT dòng lúc boot (không chặn
  boot — dev không cần tài khoản Resend).
- **Không tự xoá suppression:** bounce cứng/complaint chỉ hết hiệu lực khi
  operator xác nhận địa chỉ sống trở lại và gỡ tay (SQL/console — chưa cần
  UI). Tự động gỡ theo thời gian là tự động gửi lại vào một hộp thư đã nói
  "đừng".

### 5. Redact rộng hơn

`redactDeep` (một máy che dùng chung từ vòng vá F8) khớp khoá **không phân
biệt hoa/thường** và che thêm theo **hậu tố** `token`/`secret`/`password`:
`unsubscribeToken`, `confirmToken`, `clientSecret`… tự được che mà không
phải nhớ thêm vào danh sách — đúng lý do tồn tại của máy che chung.

### 6. Retention enquiry: 18 tháng, anonymize chứ không xoá

- Job pg-boss hằng ngày anonymize enquiry có `createdAt` quá
  `ENQUIRY_RETENTION_MONTHS` (env, mặc định 18): `name → '[anonymized]'`,
  `email → anon-<id>@invalid`, `phone/message → null`, set `anonymizedAt`.
  Anonymize chứ không xoá: thống kê lead (đếm, nguồn, tour) còn nguyên,
  PII thì không. Đếm theo ngày lịch UTC như ADR-0030.
- Cột mới `enquiries.user_id` (nullable, ghi khi form gửi lúc ĐANG có
  session): xoá tài khoản (`deleteAccount`, W2) kéo theo anonymize NGAY mọi
  enquiry của user trong cùng transaction — quyền được xoá mạnh hơn lịch
  retention. Enquiry gửi lúc chưa đăng nhập không truy ngược theo email
  (email form tự do không chứng minh sở hữu).

## Hệ quả

- Migration MỘT file: `subscribers.welcome_sent_at` + `confirmed_at`
  (backfill), `outbox.next_attempt_at`, bảng `email_suppressions` (kèm RLS),
  `enquiries.user_id` + `anonymized_at`, `reviews.retracted_at`
  (ADR-0032 AMEND 1).
- Env mới (chỉ key, giá trị điền dashboard): `RESEND_WEBHOOK_SECRET`,
  `ENQUIRY_RETENTION_MONTHS`.
- Copy mới (thư xác nhận, trang confirm, privacy link) vào `@tourism/i18n`
  theo luật 7.
- `welcome_sent_at` set trong CÙNG tx subscribe: outbox purge 30 ngày không
  còn làm welcome/confirm lặp lại mỗi tháng (outbox không phải bằng chứng
  "đã từng gửi" — nó bị purge theo lịch).

## Đã cân nhắc và loại

| Phương án | Vì sao loại |
| --- | --- |
| Turnstile/captcha cho hai form public | Đổi UX form — quyết riêng khi thấy spam thật; ack-không-lặp-nội-dung + throttle + suppression đã tước vũ khí chính |
| Xoá hẳn enquiry quá hạn thay vì anonymize | Mất thống kê lead của chính mình; anonymize đạt cùng mục tiêu PII |
| Token JWT thay HMAC tự chế | Kéo thêm dependency + bề mặt parse phức tạp cho ba purpose cố định; HMAC có purpose trong phần ký là đủ và giữ tương thích v0 dễ |
| Suppression tự hết hạn | Gửi lại vào hộp thư đã bounce cứng là đốt reputation domain — gỡ phải là hành vi có người chịu trách nhiệm |

## AMEND 1 — 08/09/2026 (vòng vá review W4): consent theo thế hệ, token đổi ý chỉ từ POST huỷ, suppression theo lý do, lỗi 4xx của TA là tạm

Review 8 mũi ở session gốc (10 findings) chỉ ra bản gốc §2–§4 để hở ba chỗ và
tả sai một chỗ; chốt lại như sau — code là nguồn sự thật, ADR ghi lý do:

- **§2 — `confirmedAt` không đứng một mình.** Bản gốc `confirmSubscription`
  chỉ guard `confirmedAt: null` nên sinh được row "đã xác nhận × đã huỷ" — tập
  mà một campaign lọc `confirmedAt` sẽ gửi tới người đã rút; backfill
  `confirmed_at = created_at` cũng không loại người đã unsubscribe và **đã
  chạy trên Supabase** trước review. Nay: predicate mailable là MỘT
  (`MAILABLE_SUBSCRIBER_WHERE` = `unsubscribedAt null ∧ confirmedAt ≠ null`,
  `newsletter/mailable.ts`) cho worker (mọi bản tin ngoài thư xác nhận) và
  campaign tương lai; confirm là compare-and-set ghi `confirmedAt = now` VÀ
  xoá `unsubscribedAt`; migration mới `20260908120000_w4_review_fixups` bỏ
  `confirmed_at` của đúng những row backfill đang huỷ.
- **§3 — token `confirm` khoá vào THẾ HỆ consent.** Token confirm không hết
  hạn (bản gốc: hết hạn chỉ tạo ngõ cụt), nên một thư xác nhận cũ bị forward
  mà còn mở lại được consent SAU khi khách đã huỷ là lỗ. Payload ký thêm
  `consentGeneration` = mốc `unsubscribedAt` hiện tại (`initial` khi chưa
  huỷ): huỷ là mọi thư cũ chết, thư gửi sau lần huỷ mang thế hệ mới và mở
  được. Verifier phải đọc row trước khi verify — chấp nhận lệch nếp "verify
  trước DB" vì id là uuid v7 tra theo PK.
- **§3 — token `resubscribe` CHỈ phát từ POST huỷ vừa claim được.** Bản thi
  công cho GET `unsubscribeConfirm` mint nó từ token huỷ không hết hạn (nhận
  cả v0) — hạn 30 ngày và việc khoá v0 thành hư cấu, ai cầm link huỷ cũ cũng
  bật lại consent mãi. Nay `resubscribe` là nút "đổi ý" trong 30 ngày sau
  lần huỷ; bấm lại link cũ không có nút đăng ký lại; đường quay lại sau cửa
  sổ đó là form footer → thư xác nhận mới (double opt-in thật). Ngày ngừng
  nhận v0 là hằng máy thi hành `V0_ACCEPT_UNTIL = 2027-01-01`.
- **§2 — thư xác nhận gửi LẠI được.** `welcomeSentAt` set lúc enqueue và
  chặn tuyệt đối → thư FAILED/SKIPPED là khách kẹt `confirmedAt` null vĩnh
  viễn. Nay `subscribe()` gửi lại khi chưa mailable và lần trước đã hơn 24
  giờ, dedupeKey `newsletter-confirm:<email>:<yyyy-mm-dd>` (một thư/địa
  chỉ/ngày — quy ước dedupe-key thêm hàng `<event>:<email>:<ngày>`).
- **§4 — suppression theo LÝ DO, và payload Resend thật.** Resend gửi
  `bounce.type ∈ Permanent | Transient | Undetermined` (bản thi công lọc
  `'hard'` — giá trị không tồn tại — nên hard bounce thật không bao giờ được
  ghi). `Permanent`/`Undetermined` → ghi, `Transient` → bỏ. Phạm vi:
  `bounced` chặn MỌI loại (địa chỉ chết), `complained` CHỈ chặn bản tin —
  bấm spam một welcome không làm mất reset mật khẩu/OTP/xác nhận đơn của
  chính họ; bounce trên email auth ghi WARN để operator gỡ (SQL, như §4 đã
  chốt). `RESEND_WEBHOOK_SECRET` ép regex `whsec_<base64>` lúc boot.
- **§4 — 401/403/408 là lỗi TẠM.** "4xx-không-retry" bản gốc coi credential
  của TA hỏng (xoay key) là lỗi của thư: park FAILED cả batch, retry tay từng
  id. Nay chỉ 4xx còn lại là vĩnh viễn. Row FAILED không giữ vĩnh viễn nữa:
  purge sau 180 ngày theo `createdAt` (payload mang PII, không vượt retention
  §6). Admin thấy `nextAttemptAt` để phân biệt "chờ backoff" với "worker
  chết".
- **§1 — ack không CHỞ `message`.** Template đã bỏ khối in lại nhưng payload
  vẫn mang message — outbox (bảng admin, log deliverer) giữ một bản PII thừa
  30 ngày cho một thư không dùng tới. Payload ack nay `{name, email,
  tourTitle}`; alert admin giữ đủ.
- **§6 — sửa lời tả:** cột `enquiries.message` NOT NULL nên anonymize ghi
  `message → ''` (không phải null như bản gốc viết); `user_id` chỉ ghi được
  khi web GỬI cookie — ba form web nay gọi `enquiries.create` kèm
  `withBrowserAuth()` (route vẫn `@Public`, throttle theo IP); controller đọc
  session trong try/catch riêng, lỗi session không thành 500 cho form công khai.
