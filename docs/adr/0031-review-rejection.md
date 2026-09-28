# ADR-0031 — Từ chối một review là một quyết định CHUNG CUỘC, tách khỏi việc gỡ đăng

- **Trạng thái:** Accepted (2026-09-05)
- **Bối cảnh thi hành:** nhánh `fix/p4c-backend-logic`, đi trước code theo luật
  CLAUDE.md #5
- **Liên quan:** [ADR-0028](0028-bookings-stats-follow-filter.md) §AMEND 2
  (ADR này **đổi nghĩa** card `Pending` vừa dựng ở đó) · spec P4b §3-F4 ·
  [ADR-0016](0016-web-data-layer.md) (bust cache web sau moderate)

## Bối cảnh

Vòng rà 05/09 (user hỏi) đo được ba sự thật trong code, không phải đọc lướt:

**1. Model chỉ có `isApproved: boolean`.** Không có trạng thái "đã xem và từ
chối". Một review bị bỏ qua và một review bị người duyệt cân nhắc rồi bác trông
**giống hệt nhau** trong DB.

**2. Vì thế hàng đợi KHÔNG BAO GIỜ dọn sạch được.** Card `Pending` vừa dựng
xong ở ADR-0028 §AMEND 2 đếm `is_approved = false`, tức đếm gộp:

| Thứ thật sự đang đếm | Có phải việc phải làm không |
| --- | --- |
| chưa ai xem | **có** |
| đã xem, đã bác | không |
| từng duyệt rồi bị gỡ xuống | không rõ |

Một con số chỉ có thể phình ra, và card ấy là thứ vừa được dựng để đo khối
lượng công việc. Đây là lập luận mạnh nhất cho ADR này, và nó là hệ quả trực
tiếp của đợt trước chứ không phải một tính năng rời.

**3. Gỡ duyệt đưa review NGƯỢC về hàng đợi.** Đo được ở int test hiện có
(`stats.int.spec`: *"review 8 vừa bị gỡ duyệt nên quay lại hàng đợi"*). Nghĩa
là admin vừa quyết "cái này không nên đăng" thì nó lập tức hiện lại như "cần
một quyết định". Hàng đợi tự bơm chính nó.

Cộng thêm hai thứ **đã có sẵn mà không ai đọc**, tìm ra ở cùng vòng rà:

- `ReviewModerationEvent.note` (500 ký tự) được ghi mỗi lần moderate nhưng
  **không nơi nào đọc** — write-only từ ngày đầu.
- Email `REVIEW_APPROVED` chỉ bắn khi `false→true`. Gỡ duyệt hay bác bỏ thì
  khách **không được báo gì cả**.

## Quyết định

### 1. HAI trục, không phải một

Chỗ sai của model hiện tại là ép hai câu hỏi khác nhau vào một cột:

| Câu hỏi | Cột trả lời |
| --- | --- |
| Review này **có đang trên site** không? | `is_approved` — giữ NGUYÊN nghĩa |
| Đã có người **ra phán quyết chung cuộc** chưa? | `rejected_at` — MỚI |

Ba trạng thái suy từ hai cột:

| `is_approved` | `rejected_at` | Trạng thái |
| --- | --- | --- |
| `true` | `NULL` | **Approved** — đang hiện công khai |
| `false` | `NULL` | **Pending** — việc phải làm |
| `false` | có | **Rejected** — đã bác, chung cuộc |

Bất biến "không thể vừa đăng vừa bị bác" do **CHECK constraint ở DB** canh, chứ
không phải do code nhớ:

```sql
CHECK (NOT (is_approved AND rejected_at IS NOT NULL))
```

### 2. Vì sao KHÔNG thay boolean bằng enum `ReviewStatus`

Đó là phương án sạch hơn về mô hình, và bị loại vì **bán kính sát thương**:
`is_approved` đang được đọc ở đường CÔNG KHAI của site đang chạy —
`listByTour` lọc `isApproved: true` ở ba chỗ (danh sách, breakdown, lọc ảnh),
công thức recompute `Tour.ratingAvg` dùng nó, và công thức ấy được **chép tay**
sang `prisma/seed.ts` (JSDoc `moderate()` đã cảnh báo sẵn). Cộng ba index và 23
điểm đọc trong service.

ADR-0024: push `main` là Vercel/Render tự deploy. Đổi tên một cột trên đường
đọc công khai của site đang chạy, để phục vụ một tính năng back-office, là đánh
đổi sai. Thêm một cột nullable thì đường công khai **không đổi một dòng nào**.

Còn một lý do về ngữ nghĩa, và nó mới là lý do chính: `is_approved` KHÔNG phải
một trạng thái trong máy trạng thái moderation — nó là **câu trả lời cho "có
đang hiện không"**. Gộp nó với phán quyết là lý do ta đang ở đây.

### 3. Gỡ duyệt và từ chối là HAI việc khác nhau

`moderate` hiện nhận `approve: boolean`. Nay nhận ba động từ:

| Động từ | `is_approved` | `rejected_at` | Ý nghĩa |
| --- | --- | --- | --- |
| `approve` | `true` | xoá về `NULL` | đăng lên site |
| `reject` | `false` | `now()` | bác bỏ, chung cuộc — RỜI hàng đợi |
| `unpublish` | `false` | giữ `NULL` | gỡ xuống, CHƯA quyết — Ở LẠI hàng đợi |

`approve` **xoá** `rejected_at` có chủ đích: một phán quyết chung cuộc vẫn được
phép đảo khi người duyệt nhận ra mình sai, và lúc ấy review trở lại đúng một
trạng thái sạch chứ không mang theo dấu vết mâu thuẫn. Lịch sử thì không mất —
nó nằm ở `ReviewModerationEvent`, append-only.

`unpublish` giữ nguyên hành vi của nút "Remove" hôm nay, chỉ đổi tên cho đúng
việc nó làm. Nó hiếm (gỡ tạm để điều tra), nhưng gộp nó vào `reject` là ép
người duyệt tuyên một phán quyết chung cuộc khi họ chỉ muốn tạm gỡ.

**AMEND lúc nghiệm thu 05/09 — `unpublish` hiện ra ở hàng ĐÃ BỊ BÁC, dưới tên
`Reopen`.** Bản đầu chỉ cho hàng ấy đúng một nút (`approve`), với lý do "một
nút thứ ba trên MỌI hàng là cái giá sai". Lý do ấy đúng nhưng kết luận thì sai:
nút thứ hai chỉ mọc ở **hàng đã bác**, không phải mọi hàng. Và user đọc nhầm
ngay lần đầu — một pill xanh "Approve" đứng MỘT MÌNH trong cột tên
"Moderation", trông hệt badge `Approved` ở cột State ngay bên, đọc ra như một
lời khẳng định chứ không phải lời mời. Một CẶP nút thì đọc ra là một lựa chọn.

Cùng lúc, thứ tự trong ô đổi: **dấu vết đứng TRƯỚC nút**. Cột tên là một danh
từ, nên nó phải trả lời "chuyện gì đã xảy ra" trước, rồi mới tới "còn làm được
gì".

`Reopen` là CÙNG động từ `unpublish` (cùng đưa về `is_approved = false,
rejected_at = null`), chỉ khác chỗ đứng nhìn — và vì thế phải khác tên: từ một
review đã bị bác, "Unpublish" nói sai, review vốn đã không ở trên site. Giao
diện giữ khái niệm `ModerateActionKind` (bốn việc bấm được) tách khỏi
`ReviewVerdict` (ba động từ contract nhận).

### 4. Audit trail: thêm `to_rejected`, KHÔNG sửa dòng cũ

`ReviewModerationEvent` có `from_approved`/`to_approved`. Thêm
`to_rejected Boolean @default(false)`. Dòng lịch sử cũ mặc định `false` — đúng,
vì trước ADR này không tồn tại hành vi từ chối. Sổ vẫn append-only, không dòng
nào bị viết lại (cùng luật `migration.sql` và entry CHANGELOG).

Và **`note` cuối cùng có người đọc**: nó thành LÝ DO từ chối, hiện ở dialog chi
tiết (bước 1 vừa xong) và đi vào email cho khách.

### 5. Card `Pending` đổi nghĩa — và đó là điểm chính

`pending` chuyển từ `is_approved = false` sang `is_approved = false AND
rejected_at IS NULL`. Từ nay nó đo ĐÚNG thứ nó hứa: việc còn phải làm, và dọn
sạch được.

Kèm theo, phép dựng lại hàng đợi tại một mốc (`pendingReviewsAt`) phải tính cả
`rejected_at`: một review bị bác hôm nay thì tại mốc tháng trước nó VẪN đang
chờ. Ghi rõ vì ADR-0028 §AMEND 2 §3 đã nói phép dựng lại này là XẤP XỈ, và mục
này làm nó thêm một nhánh chứ không sửa được cái xấp xỉ ấy.

**Chưa thêm card thứ năm cho "Rejected".** ADR-0028 §AMEND 2 §4 đã loại "lượt
gỡ duyệt" khỏi vị trí card thứ tư vì hành vi hiếm, card sẽ đứng yên ở 0; lý do
ấy áp y nguyên ở đây. Bốn card hiện tại vẫn kể trọn câu chuyện, và giờ kể
ĐÚNG hơn.

### 6. Bác bỏ mà KHÔNG báo cho khách là không chấp nhận được

Đây là đúng thứ vừa bị vá ở đường hoàn tiền (mail duyệt huỷ im lặng về khoản 0
đồng): im lặng thì người ta tự đoán, rồi đợi một thứ không bao giờ tới.

Thêm `REVIEW_REJECTED` vào outbox, mang `note` làm lý do. Và `MyReviewSchema`
(khách xem review của chính mình) thêm trạng thái bị bác — hiện tại nó chỉ có
`isApproved: boolean`, nên khách bị bác vẫn thấy "đang chờ duyệt" vĩnh viễn.

`unpublish` thì KHÔNG gửi mail: nó chưa phải một phán quyết, và báo cho khách
một thứ còn chưa quyết xong là gây hoang mang không vì gì.

### 7. Lý do bác là BẮT BUỘC (chốt lúc thi công)

§6 nói `note` thành lý do và đi vào email. Kéo theo một luật §6 chưa nói ra:
**không có lý do thì không bác được.** Một mail "review của bạn không được
đăng" với khối *WHY* trống là đúng thứ §6 sinh ra để chặn, chỉ khác ở chỗ nó
trống vì người duyệt bỏ qua chứ vì hệ thống im lặng.

Cùng khuôn với đường vượt bậc hoàn tiền (ADR-0030 §5 — muốn khác bậc thì phải
ghi lý do). Ràng buộc gác ở kit `ConfirmWriteDialog` (`noteRequired`) chứ không
ở từng vùng, vì lệnh ghi nào có ghi chú đi thẳng cho người ngoài đọc cũng cần
đúng luật này.

Hai chuỗi nhãn/gợi ý của ô ghi chú cũng đổi theo nhánh: bản mặc định nói *"the
author never sees it"*, và ở nhánh bác thì câu ấy **nói ngược sự thật**.

## Hệ quả

### Việc phải làm cùng đợt

| Tầng | Việc |
| --- | --- |
| Prisma | migration MỚI: `rejected_at`, `rejected_by`, `to_rejected`, CHECK constraint, index hàng đợi |
| Contract | `ModerateReviewInputSchema` đổi `approve: boolean` → động từ; `AdminReviewSchema` + `MyReviewSchema` mang trạng thái mới |
| API | `moderate()` ba nhánh; `pendingReviewsAt` + `adminList` lọc theo trạng thái mới; outbox `REVIEW_REJECTED` |
| Admin | nút thứ ba, bộ lọc tab thêm "Rejected", dialog chi tiết hiện lý do bác |
| Web | *(không có gì để làm — xem ghi chú ngay dưới)* |
| i18n | copy cho trạng thái, nút, mail |

### Đo lúc thi công: KHÔNG có trang "Đánh giá của tôi"

`reviews.mine` tồn tại như một endpoint và có int test, nhưng **không trang
web nào gọi nó** — `apps/web` chỉ dùng `reviews.listByTour` và `reviews.create`.
Nên vế "khách thấy trạng thái trong sản phẩm" của §6 không có bề mặt nào để
đặt lên.

Điều đó KHÔNG làm §6 hụt: lời hứa của nó là khách **được biết và biết vì sao**,
và `REVIEW_REJECTED` giao đúng điều ấy. Endpoint nay đã mang `moderationState`
và `moderationNote`, nên ngày nào trang ấy ra đời thì dữ liệu đã sẵn.

### Điều KHÔNG được suy ra

ADR này **không** cho khách viết lại review đã bị bác. Ràng buộc
`booking_id @unique` vẫn nguyên, và toàn hệ thống vẫn KHÔNG có route sửa hay
xoá review. Nên sau đợt này, một review bị bác là review của booking ấy **mất
hẳn**, chỉ khác trước ở chỗ khách được BIẾT và biết VÌ SAO.

Đường quay lại là việc riêng (bước 3 trong kế hoạch user chốt 05/09), và nó là
quyết định chính sách chứ không có mặc định hiển nhiên: cho sửa một review ĐÃ
DUYỆT nghĩa là nội dung trên site đổi sau lưng kiểm duyệt, nên sửa xong phải
rơi về chờ duyệt lại.

⚠️ Cho tới khi bước 3 xong, **nút Reject nên dùng dè**: nó dứt điểm cho hàng
đợi nhưng dứt luôn tiếng nói của khách về chuyến đi đó. `unpublish` là lựa chọn
đúng khi còn phân vân.

## Phương án đã cân nhắc rồi loại

| Phương án | Vì sao loại |
| --- | --- |
| Enum `ReviewStatus` thay hẳn boolean | Sạch hơn về mô hình nhưng đụng đường đọc CÔNG KHAI của site đang chạy (`listByTour` ×3, recompute rating, công thức chép tay ở seed, 3 index, 23 điểm đọc). Đổi tên cột ở đó để phục vụ một tính năng back-office là đánh đổi sai — và `is_approved` vốn trả lời câu "có đang hiện không", không phải một trạng thái moderation. |
| Gộp `reject` vào `unpublish` hiện có | Ép người duyệt tuyên một phán quyết chung cuộc khi họ chỉ muốn gỡ tạm. Hai ý định khác nhau thì hai động từ. |
| Chỉ dựa vào `moderated_at != null` để loại khỏi hàng đợi | Sai ngay từ dữ liệu đang có: seed tạo 84 testimonial CURATED `is_approved = true` với `moderated_at` null (đã ghi ở `pendingReviewsAt`). Và nó vẫn không phân biệt được gỡ-tạm với bác-bỏ. |
| Thêm card thứ năm "Rejected" | Hành vi hiếm, card đứng yên ở 0 gần như mọi lúc — cùng lý do đã loại "lượt gỡ duyệt" ở ADR-0028 §AMEND 2 §4. Số liệu vẫn nằm đủ trong audit trail. |
| Xoá thẳng review bị bác | Mất bằng chứng. Sổ moderation là thứ trả lời "vì sao review này không lên site" khi khách hỏi lại — xoá đi là không trả lời được. Và `booking_id @unique` khiến xoá trở thành một đường lách ngầm cho việc gửi lại, tức quyết định của bước 3 bị lấy mất mà không ai bàn. |

## AMEND 1 — 28/09/2026: lý do bác chọn từ danh sách cố định; dialog và email nói đúng đường sửa

### Bối cảnh

Giáo viên hướng dẫn góp ý (qua user, 28/09): lý do bác gõ tay thì mỗi admin
một kiểu, và câu gửi cho khách không đồng nhất. §7 bắt buộc CÓ lý do nhưng
không nói gì về câu chữ của nó.

Rà lúc thiết kế tìm ra thêm ba chỗ nói SAI kể từ khi ADR-0032 (cùng ngày
05/09) mở đường sửa cho tác giả, mà copy của dialog Reject không theo kịp:

- Câu cảnh báo *"The author cannot rewrite this review — one review per
  booking, and there is no way to edit it. Unapprove instead if you are
  unsure."* Lần bác đầu tác giả VẪN sửa được (ADR-0032 §2, §5); và nút tên
  `Unpublish`, không có nút `Unapprove` nào.
- *"closes the review for good"* và *"Takes the review out of the moderation
  queue for good"*: chỉ đúng ở lần bác chung cuộc. Lần đầu, tác giả sửa xong
  thì review quay lại hàng đợi (ADR-0032 §4).
- Email `REVIEW_REJECTED` chỉ mời *"reply to this email"*, không nói khách
  còn một cơ hội sửa. Trang booking có form sửa (ADR-0032 §7), nhưng khách
  không có lý do gì để mở lại trang ấy.

### Quyết định

**1. Lý do bác = một câu chuẩn chọn từ danh sách, cộng một câu chi tiết tuỳ
chọn.** Câu chuẩn KHOÁ: admin không sửa chữ, nên hai admin bác cùng một lỗi
thì khách đọc cùng một câu. Chi tiết là chỗ cho điều riêng của từng ca (tấm
ảnh nào, đoạn nào). Mục `Other` bắt buộc có chi tiết, vì câu chuẩn của nó
không tự nói được gì.

Câu chữ sống ở `@tourism/i18n` (câu gửi khách, luật 7 của repo). Thứ tự danh
sách và luật "mục nào bắt buộc chi tiết" sống ở admin (`lib/reject-reasons.ts`)
— đó là hành vi, không phải câu chữ.

**2. Vẫn lưu vào `note`, như §6 và §7.** Chuỗi ghép `câu chuẩn + " " + chi
tiết`, trần 500 ký tự như contract đang nhận (hằng
`REVIEW_MODERATION_NOTE_MAX`, xuất ra từ contract để admin tính phần còn lại
cho ô chi tiết). Không thêm cột mã lý do: chưa có ai đọc thống kê theo mã, và
một cột mới là migration cộng contract cho một nhu cầu chưa tồn tại. Ngày nào
cần thống kê thì thêm `reason_code` vào `ReviewModerationEvent` — sổ ấy
append-only, dòng cũ để `NULL`, không sửa dòng nào.

**3. Câu chuẩn chỉ nói VÌ SAO, không nói "hãy sửa rồi gửi lại".** Ở lần bác
thứ hai tác giả không còn sửa được (ADR-0032 §5), nên một câu hứa đường sửa sẽ
nói sai đúng ở lần quan trọng nhất. Phần "làm gì tiếp" thuộc về email (mục 5),
nơi biết đây là lần bác thứ mấy.

**4. Danh sách KHÔNG có lý do kiểu "đánh giá tiêu cực" hay "chấm sao thấp".**
Bác một review vì nó chê là giấu ý kiến thật của khách; ở một số thị trường,
giấu đánh giá tiêu cực là vi phạm luật bảo vệ người tiêu dùng. Danh sách định
hình thói quen của người duyệt, nên nó không được gợi ý chuyện đó.

**5. Dialog và email nói theo LẦN BÁC, bằng chính `canAuthorEdit` của
contract** (ADR-0032 §6 — không chép luật sang chỗ thứ ba). Tác giả còn sửa
được sau lần bác này khi: có tài khoản còn sống (không CURATED, chưa tự xoá)
VÀ `canAuthorEdit({ moderationState: 'rejected', rejectionCount: số lần bác
đã có + 1 })`.

- Dialog: còn sửa được thì nói *"tác giả còn một cơ hội: sửa rồi gửi lại,
  review quay lại hàng đợi"*; hết đường thì nói rõ là chung cuộc. Câu chữ nói
  "thêm một cơ hội" chứ không nói "sửa một lần": luật đếm LẦN BÁC, không đếm
  lần sửa (ADR-0032 §5) — trong lúc chờ duyệt khách sửa bao nhiêu lần cũng
  được. Lời khuyên
  *"còn phân vân thì Unpublish"* chỉ hiện với review ĐANG hiện trên site —
  review đang chờ không có nút Unpublish, phân vân thì cứ để nó trong hàng
  đợi.
- Email: payload thêm `canEdit` (service tính bằng số lần bác vừa đếm TRONG
  transaction — đúng con số đã dùng cho `dedupeKey`) và mã booking (khoá
  `code`, cùng tên với mọi mail booking khác). Còn sửa
  được thì thêm câu và nút tới `/account/bookings/<code>`; hết đường thì nói
  *"đã xem lại hai lần, không sửa được nữa"*. Payload xếp hàng TRƯỚC lúc deploy
  không có hai trường này, nên worker in đúng như cũ — không hứa điều nó không
  biết chắc.

### Hệ quả

| Tầng | Việc |
| --- | --- |
| Contract | xuất hằng `REVIEW_MODERATION_NOTE_MAX` (schema dùng lại chính nó) — hình dạng input/output không đổi |
| Admin | dialog Reject riêng, dựng trên hook `useConfirmWrite` (kit `ConfirmWriteDialog` không đổi — ba lệnh kia vẫn đi qua nó); cột trái là ô tìm và danh sách lý do |
| i18n | danh sách lý do; copy dialog theo lần bác |
| API | payload `REVIEW_REJECTED` thêm `canEdit`, `code`; worker in hai nhánh, payload cũ in như trước |

KHÔNG migration. Web không đổi: trang booking đã hiện lý do và form sửa từ
ADR-0032.

### Phương án đã cân nhắc rồi loại

| Phương án | Vì sao loại |
| --- | --- |
| Bấm lý do là điền vào ô, admin vẫn sửa tự do | Đúng mô tả ban đầu của user, nhưng không trả lời được câu hỏi của giáo viên: admin vẫn gõ đè được toàn bộ câu. |
| Chỉ chọn, không có ô nào để gõ | Đồng nhất tuyệt đối, nhưng ca đặc biệt không có chỗ nói chi tiết cho khách. |
| Lưu mã lý do vào DB | Migration cộng contract cho một thống kê chưa ai đọc. Để dành đường thêm cột vào sổ append-only. |
| Danh sách lý do quản lý trong DB, có trang CRUD | Chín câu ít đổi; một trang quản trị cho chúng là tính năng không ai yêu cầu. Đổi câu là đổi i18n, đi qua review như mọi copy khác. |
