# ADR-0031 — Từ chối một review là một quyết định CHUNG CUỘC, tách khỏi việc gỡ đăng

- **Trạng thái:** Proposed (2026-09-05)
- **Bối cảnh thi hành:** nhánh `fix/p4c-backend-logic`, đi trước code theo luật
  CLAUDE.md #5
- **Liên quan:** [ADR-0028](0028-bookings-stats-follow-filter.md) §AMEND 2
  (ADR này **đổi nghĩa** card `Pending` vừa dựng ở đó) · spec P4b §3-F4 ·
  [ADR-0016](0016-web-revalidation.md) (bust cache web sau moderate)

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

## Hệ quả

### Việc phải làm cùng đợt

| Tầng | Việc |
| --- | --- |
| Prisma | migration MỚI: `rejected_at`, `rejected_by`, `to_rejected`, CHECK constraint, index hàng đợi |
| Contract | `ModerateReviewInputSchema` đổi `approve: boolean` → động từ; `AdminReviewSchema` + `MyReviewSchema` mang trạng thái mới |
| API | `moderate()` ba nhánh; `pendingReviewsAt` + `adminList` lọc theo trạng thái mới; outbox `REVIEW_REJECTED` |
| Admin | nút thứ ba, bộ lọc tab thêm "Rejected", dialog chi tiết hiện lý do bác |
| Web | trang "Đánh giá của tôi" nói rõ bị bác + lý do |
| i18n | copy cho trạng thái, nút, mail |

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
