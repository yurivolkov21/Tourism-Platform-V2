# ADR-0004 — Post visibility qua helper bắt buộc `publishedPostWhere()`

- **Trạng thái:** Accepted (2026-07-21)
- **Bối cảnh:** phần Blog (§4.6) của
  [spec P3a](../specs/2026-07-19-p3a-customer-api.md); quy tắc nghiệp vụ W5
  trong [quét sâu Nexora](../analysis/2026-07-19-nexora-deep-sweep.md)

## Bối cảnh

`Post` có **hai trục hiển thị độc lập**: `status` (`DRAFT` | `PUBLISHED`) và
`publishedAt DateTime?` (nullable). Một bài chỉ được xuất hiện trước công chúng
khi **cả hai** thoả: `status = PUBLISHED` **và** `publishedAt <= now()`. Tách
hai trục cho phép hẹn giờ đăng (đặt `PUBLISHED` trước, `publishedAt` ở tương
lai) — nhưng chính vì tách nên sinh ra ca "bài đã `PUBLISHED` mà `publishedAt`
còn ở tương lai" phải bị ẩn.

Nexora không có cổng chặn tập trung: mỗi path đọc post tự mang điều kiện lọc.
Mô hình đó **dễ sót** — thêm một path mới mà quên mang `publishedAt <= now()`
là lộ bài chưa tới giờ đăng, và **không có gì bắt được**: compiler không biết,
Biome không biết, một test chỉ phủ path cũ cũng không biết. Đây cùng họ với
lỗ mà ADR-0003 xử cho auth: sai kiểu âm thầm.

So sánh: `Tour` (catalog) chỉ có **một cờ** `isPublished: true`, không hẹn
giờ, và `catalog.service` rải cờ đó tay ở 5 chỗ. Post phức tạp hơn Tour (thêm
trục thời gian) nên rải tay càng rủi ro.

P3a chỉ mở path **đọc công khai** (`posts.list`, `posts.bySlug`, `posts.tags`).
Admin CRUD — nơi cần đọc cả `DRAFT` và bài hẹn giờ để preview — thuộc P4.

## Quyết định

Gom điều kiện hiển thị vào **một hàm thuần** dùng chung ở mọi path public:

```ts
// apps/api/src/modules/posts/published-post.where.ts
import type { Prisma } from '../../generated/prisma/client.js';
import { PostStatus } from '../../generated/prisma/enums.js';

/**
 * Điều kiện "bài đã công bố và tới giờ hiển thị" cho MỌI path public đọc Post.
 * Nhận `now` để test bơm mốc thời gian cố định (mặc định là thời điểm gọi).
 * `publishedAt: null` tự bị loại vì null không thoả `lte` — bài PUBLISHED mà
 * chưa đặt ngày sẽ KHÔNG hiện (chủ đích, xem Hệ quả).
 */
export function publishedPostWhere(now: Date = new Date()): Prisma.PostWhereInput {
  return { status: PostStatus.PUBLISHED, publishedAt: { lte: now } };
}
```

- **Cả 3 path public phải** spread fragment này vào `where`; không path nào tự
  chế điều kiện hiển thị riêng.
- **Không có cổng chặn tự động** (không Prisma extension, không middleware).
  "Bắt buộc" được cưỡng chế bằng **convention + integration test mỗi path** —
  xem Hệ quả về vì sao không chọn cổng chặn.
- Đặt trong module `posts` (chỉ posts dùng), **không** đưa vào shared.

Cách dùng ở từng path:

| Path | `where` | Không khớp |
| --- | --- | --- |
| `list` | `{ ...publishedPostWhere() }` + phân trang/sort | — |
| `bySlug` | `{ slug, ...publishedPostWhere() }` | → `POST_NOT_FOUND` (404) |
| `tags` | tag có ≥1 bài thoả helper (lọc qua relation cùng fragment) | tag rỗng không liệt kê |

`bySlug` trả về **`POST_NOT_FOUND` y như bài không tồn tại** cho bài `DRAFT`
hoặc hẹn-giờ-tương-lai — không phân biệt "chưa công bố" với "không có", để
không lộ sự tồn tại của bài chưa tới giờ (cùng nếp chống-dò của
reviews/newsletter).

## Hệ quả

- **`now()` là app-side (`new Date()`).** Prisma không nhúng được SQL `NOW()`
  vào `PostWhereInput`; muốn mốc thời gian của DB thì phải raw SQL, mâu thuẫn
  với việc helper là fragment dùng chung cho query builder chuẩn. Lệch clock
  giữa app process và DB thường dưới một giây — chấp nhận được cho hẹn giờ đăng
  bài (không phải bề mặt tính-tiền-theo-giây). Nếu về sau cần độ chính xác
  DB-time, đây là điểm phải đổi hình thức (known tradeoff).
- **`publishedAt = null` luôn ẩn.** `{ lte: now }` tự loại null, nên bài
  `PUBLISHED` mà chưa đặt ngày sẽ không hiện. Đây là mặc định phòng thủ có chủ
  đích: không công bố thứ chưa có mốc công bố rõ ràng. Ràng buộc kéo theo cho
  **admin P4**: khi chuyển một bài sang `PUBLISHED` nên **ép đặt `publishedAt`**
  (mặc định `now()` nếu người viết không nhập) — ngoài phạm vi ADR này, ghi lại
  để P4 không tạo ra bài "PUBLISHED mà vô hình".
- **"Bắt buộc" không được compiler cưỡng chế** → dựa vào review + test. Một
  path public **mới** trong tương lai vẫn có thể quên gọi helper. Giảm thiểu:
  (a) integration test mỗi path (seed bài quá-khứ / tương-lai / draft, khẳng
  định chỉ bài đầu hiện); (b) **mutation-test hai chiều** — gỡ helper khỏi một
  path thì test path đó phải đỏ, vì đây là bề mặt lộ-nội-dung-chưa-công-bố;
  (c) câu khẳng định rõ trong ADR này để review có chỗ neo.
- **Không cản admin P4.** Vì helper là fragment opt-in chứ không phải cổng
  chặn, admin đọc `DRAFT`/bài hẹn giờ bằng `where` riêng, không phải luồn qua
  một cơ chế bypass. Đây là ưu điểm chính khiến loại phương án Prisma extension.
- **Index đã sẵn sàng.** `@@index([status, publishedAt])` trên `Post` đỡ đúng
  hình dạng query này; không cần thêm index.

## Đã cân nhắc và loại

- **Prisma Client extension trên model `Post`** (chặn tự động mọi
  `findMany/findUnique`). Ưu: *không thể quên*. Loại vì: (1) phải mở đường
  bypass cho admin P4 đọc `DRAFT` — biến "không thể quên" thành "một cơ chế
  bypass nữa phải nhớ dùng đúng"; (2) phức tạp hơn hẳn và khó test; (3) đi
  ngược nếp v2 hiện tại (chưa có extension nào). Cái giá không đáng cho 3 call
  site.
- **Repository wrapper** (`postsRepo` chỉ expose method đã-lọc-sẵn, cấm gọi
  `prisma.post` thô trong module). Ở giữa hàm-thuần và extension. Loại vì thêm
  một tầng cho một module nhỏ mà lợi ích chống-quên chỉ nhỉnh hơn convention +
  test một chút; nếu số path đọc post tăng mạnh về sau thì cân nhắc lại.
- **Thời gian của DB qua raw SQL** (`publishedAt <= NOW()`). Loại vì đánh mất
  fragment dùng-chung-với-query-builder — mỗi path lại tự viết raw, đúng thứ
  "rải tay" mà ADR này muốn xoá. Độ chính xác giây không phải yêu cầu của hẹn
  giờ đăng bài.
