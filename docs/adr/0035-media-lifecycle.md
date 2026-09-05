# ADR-0035 — Ảnh có đường CHẾT, và nó đi qua một hàng đợi có độ trễ

- **Trạng thái:** Accepted (2026-09-05)
- **Bối cảnh thi hành:** nhánh `fix/p4c-backend-logic`, đi trước code theo luật
  CLAUDE.md #5
- **Liên quan:** [ADR-0021](0021-media-write-surface.md) (đường GHI media —
  ADR này bổ sung đường XOÁ mà nó thiếu) · [ADR-0032](0032-review-author-edit.md)
  (sửa review thay trọn ảnh — nguồn ảnh mồ côi lớn nhất trong các nguồn ĐÃ
  BIẾT) · [ADR-0020](0020-real-images-sourcing.md) (ghi công nguồn ảnh — lý do
  không được xoá nhầm) · `apps/api/src/worker/start-worker.ts`
  (khuôn cron pg-boss mà ADR này dùng lại — ba job `outbox-drain`,
  `outbox-purge`, `booking-sweep` đang chạy theo đúng hình dạng ấy)

> ⚠️ Ghi nhận lúc viết ADR này: `schema.prisma` trích dẫn **ADR-0007** cho
> outbox ở ba chỗ, nhưng `docs/adr/` nhảy thẳng 0006 → 0008 — **ADR ấy chưa bao
> giờ được viết.** Không phải việc của ADR này để chữa, nhưng cũng không nên
> để phát hiện ấy rơi mất: xem §Giới hạn #4.

## Bối cảnh

Rà 05/09 (user hỏi khi khép vòng `/reviews`) đo được: **hệ thống có bốn đường
tạo ảnh và KHÔNG có đường nào xoá.**

`MediaService` chỉ có đúng một phương thức, `resolveForOwners`. Không có
`destroy`, và grep toàn repo không thấy một lời gọi Cloudinary destroy nào.
Ảnh lên CDN rồi thì ở đó vĩnh viễn, kể cả khi mọi dấu vết của nó trong DB đã
biến mất.

**Móng thì có sẵn, và cũng chết y như `costPrice`.** Bảng `media_garbage` nằm
trong `schema.prisma` từ migration `init`:

```prisma
model MediaGarbage {
  publicId     String   @unique @map("public_id")
  /// resource_type của Cloudinary ('image' | 'video') — destroy cần nó.
  resourceType String   @default("image") @map("resource_type")
  attempts     Int      @default(0)
  lastError    String?  @map("last_error")
  createdAt    DateTime @default(now())
}
```

Có `attempts`, có `lastError`, có cả comment giải thích vì sao cần
`resource_type` — tức nó được thiết kế như một **hàng đợi xoá có retry**. Bật
cả RLS ở `hardening-v2.sql`. Và **không một dòng code nào chạm vào nó**, từ
ngày đầu tới nay.

### Ảnh mồ côi đến từ đâu

| Nguồn | Cơ chế | Biết publicId không |
| --- | --- | --- |
| **Ký upload rồi bỏ dở** | Client upload thẳng lên Cloudinary bằng chữ ký; bỏ trang trước khi gửi form thì asset có mà DB **chưa bao giờ** có row | ⚠️ Không — trừ khi ta ghi lại lúc ký |
| **Sửa review** | `mediaAsset.deleteMany` rồi `createMany` (ADR-0032) — ảnh tác giả gỡ ra mất row | Có |
| **Đổi avatar** | `setAvatar` ghi đè `User.image`; publicId cũ rơi | Có |
| **Xoá tài khoản** | Hook tombstone dọn session/account, avatar ở lại | Có |
| **Thay ảnh tour/post** | Chưa có đường ghi nào trong admin — sẽ có ở phase `/tours` | Có |

Nguồn ĐẦU là nguồn nhiều nhất về số lượng và là nguồn duy nhất hoàn toàn vô
hình: mỗi lần khách mở form đánh giá, kéo ảnh vào rồi đổi ý, một file nằm lại
mà không ai trên đời biết tên nó.

### Vì sao chuyện này đáng sửa, không phải chỉ tốn dung lượng

Ảnh của một review **bị bác** vẫn mở được bằng URL với bất kỳ ai có link. Nội
dung bị người duyệt từ chối — có thể vì chính tấm ảnh — vẫn nằm công khai trên
CDN. Đó là một lỗ về nội dung, không phải một hoá đơn lưu trữ.

## Quyết định

### 1. Xoá đi qua HÀNG ĐỢI có độ trễ, không xoá thẳng

`destroy` của Cloudinary là **không hoàn tác**. Không có thùng rác, không có
undo, và ảnh nguồn thì phần lớn là CC BY / CC BY-SA lấy từ Commons (ADR-0020) —
mất là phải đi xin lại và ghi công lại.

Vì thế đường xoá KHÔNG bao giờ gọi thẳng. Nơi phát hiện "ảnh này có thể đã mồ
côi" chỉ **ghi một row vào `media_garbage`**; một worker riêng mới quyết định
và thi hành, sau một **thời gian chờ 7 ngày**.

Bảy ngày là con số để CON NGƯỜI kịp phát hiện, không phải để máy: một bug làm
enqueue nhầm cả gallery sẽ hiện ra ở trang tour trước rất lâu, và tuần ấy là
khoảng thời gian gỡ ngòi (dừng worker, xoá sạch bảng) trước khi mất gì. Xoá
ngay thì lần đầu ai đó biết là lúc ảnh đã không còn.

### 2. Chỉ xoá khi KHÔNG CÒN AI tham chiếu — kiểm lại lúc XOÁ, không lúc xếp hàng

`MediaAsset` khai `@@unique([ownerType, ownerId, publicId])` — **per-owner, cố
ý không global**, đúng như comment trong schema ghi ("reuse picker"). Nghĩa là
**một publicId được phép gắn cho nhiều owner**: một bộ ảnh Hội An phục vụ cả
trang địa danh lẫn sáu tour đi qua đó (luật rơi-về của `media-scan`).

Hệ quả: "một owner buông ảnh" **không** đồng nghĩa "ảnh mồ côi". Worker phải
hỏi lại trước mỗi lần xoá:

```sql
SELECT 1 FROM media_assets WHERE public_id = $1 LIMIT 1
```

Còn row → **bỏ hàng đợi, không xoá**. Đây cũng chính là thứ chữa ca gỡ-rồi-gắn-
lại: tác giả sửa review, bỏ một tấm ra, đổi ý gắn lại — `deleteMany`/`createMany`
của ADR-0032 đã enqueue nó, nhưng lúc worker chạy thì row đã có lại.

Kiểm ở lúc XOÁ chứ không lúc xếp hàng là toàn bộ giá trị của độ trễ 7 ngày.

### 3. Ký upload là ĐĂNG KÝ THEO DÕI, không phải cấp phép rồi quên

`UploadSigningService` tự sinh publicId bằng `randomUUID()` (ADR-0021 §1 —
client không được đặt tên file). Tận dụng điều đó: **ngay khi ký, ghi luôn
publicId vào `media_garbage`.**

Nghe ngược đời — đánh dấu rác một thứ chưa tồn tại — nhưng đó đúng là ngữ
nghĩa của bảng này sau ADR: nó không phải danh sách "chắc chắn phải xoá" mà là
**danh sách những publicId chưa rõ số phận**. Quy tắc §2 tự phán quyết:

- Upload xong và được đăng ký thành `MediaAsset` → có tham chiếu → worker bỏ
  hàng đợi.
- Bỏ dở → không có tham chiếu → sau 7 ngày worker destroy. Nếu file thật sự
  chưa từng lên CDN thì destroy là một no-op vô hại.

Đây là cách DUY NHẤT bắt được nguồn mồ côi lớn nhất mà không phải quét ngược
toàn bộ Cloudinary. Đường quét-ngược (Admin API liệt kê theo folder rồi diff
với `media_assets`) bị bỏ ở §Phương án đã cân nhắc.

### 4. Ba nơi enqueue, và MỘT nơi cố ý không

| Nơi | Enqueue khi |
| --- | --- |
| `UploadSigningService.sign` | luôn luôn (§3) |
| `ReviewsService.update` | mỗi publicId bị `deleteMany` cuốn đi |
| `AccountService.setAvatar` | publicId cũ, khi nó thật sự đổi |

**Bác một review thì KHÔNG enqueue.** Bác là quyết định có đường quay lại
(ADR-0032): tác giả còn hai lượt sửa, và sửa được nghĩa là **gắn lại ảnh
được** — bác vì tấm ảnh mà không đổi được ảnh thì đường quay lại là đồ giả.
Xoá ảnh lúc bác là bịt chính đường ấy. Khi tác giả sửa và bỏ tấm ảnh ra, hàng
`ReviewsService.update` ở trên mới là nơi bắt.

Review hết lượt sửa (`rejectedFinal`) cũng KHÔNG enqueue ở đợt này — xem §Giới
hạn.

### 5. Worker: một cron pg-boss nữa, không phải một hệ mới

Đúng khuôn ba job đang chạy (`outbox-drain`, `outbox-purge`, `booking-sweep` —
xem `start-worker.ts`): một queue `policy: 'short'`, một `boss.schedule`, một
service có phương thức sweep trả về số row xử lý.

Nhịp **mỗi ngày một lần**, không phải mỗi phút: hàng đợi này không có ai chờ ở
đầu kia, và mỗi lần chạy là gọi API ra ngoài. `attempts`/`lastError` của bảng
dùng đúng như tên — hỏng thì tăng `attempts`, ghi lỗi, để lại cho lần sau; quá
**5 lượt** thì thôi thử và để row nằm đó như một vết cần người xem.

### 6. ⚠️ Mặc định TẮT, và đây là mục quan trọng nhất của ADR

Dev và prod dùng **chung một Cloudinary cloud** (chỉ có một `CLOUDINARY_CLOUD_NAME`
trong env schema). Một worker GC chạy trên máy dev sẽ destroy ảnh của
**www.nexora-travel.agency đang sống**.

Nên: job này chỉ chạy khi `MEDIA_GC_ENABLED=true`, mặc định **false**, và chỉ
được bật trên worker production. Không có cờ thì `start-worker.ts` không đăng
ký queue — không phải "đăng ký rồi bên trong return sớm", mà **không tồn tại**.

Cùng họ với luật đã có của repo: *"Dev/prod dùng chung Supabase … không
seed/xoá dữ liệu thật"*. Ở đây hậu quả nặng hơn vì Cloudinary không có
migration để dựng lại.

### 7. Enqueue không bao giờ được làm hỏng việc chính

Ghi `media_garbage` là việc **phụ**. Một lỗi ở đó không được phép làm rớt lệnh
sửa review, đổi avatar hay ký upload — đấy là những việc người dùng đang đứng
chờ.

Enqueue vì thế: nằm TRONG cùng transaction khi việc chính vốn đã có transaction
(sửa review), và bọc try/catch ghi log khi không (ký upload). Không bao giờ để
một `INSERT` dọn rác ném ra tận mặt người dùng.

## Hệ quả

- `media_garbage` sống lại đúng như nó được thiết kế, không cần migration nào
  cho phần lõi. Chỉ thêm **một cột** `resolved_at` để phân biệt "đã xử xong"
  với "chưa tới lượt" — hoặc xoá thẳng row khi xong, quyết lúc thi công.
- Ảnh của review bị bác **và tác giả đã bỏ ra** biến mất khỏi CDN sau 7 ngày.
  Ảnh của review bị bác mà tác giả chưa đụng vào thì ở lại — đúng ý §4.
- Thư viện Cloudinary sẽ có một lượt co lại đáng kể ở lần chạy đầu trên prod
  (mọi upload bỏ dở tích từ 12/08 tới nay). Lần chạy đầu nên chạy tay và đọc
  log trước khi để cron tự chạy.
- Đây là lời gọi **API ra ngoài** đầu tiên từ server tới Cloudinary; trước nay
  server chỉ dựng URL và ký chữ ký. Cần một module `cloudinary-destroy.ts`
  cạnh `upload-signing.ts`, dùng lại đúng cách ký `sha1(params + api_secret)`.

## Phương án đã cân nhắc và bỏ

**Xoá ngay tại chỗ (`destroy` trong cùng transaction).** Đơn giản nhất, không
bảng không worker. Bỏ vì destroy không hoàn tác được và transaction thì rollback
được — một lệnh sửa review fail sau khi ảnh đã bị destroy là mất ảnh mà DB vẫn
trỏ tới nó. Chưa kể mọi lần sửa review sẽ phải chờ một round-trip ra CDN.

**Quét ngược Cloudinary rồi diff.** Gọi Admin API liệt kê theo folder, so với
`media_assets`, xoá phần thừa. Bắt được MỌI nguồn mồ côi kể cả nguồn chưa nghĩ
ra. Bỏ vì nó đảo chiều rủi ro: một lỗi phân trang hay một `ownerType` bị quên
trong câu diff sẽ xoá ảnh ĐANG DÙNG, và nó xoá nhiều cùng lúc. Cách §3 chỉ
đụng những publicId chính hệ thống này đã tự sinh ra.

**Xoá ảnh ngay khi review bị bác.** Trực giác thì hợp lý. Bỏ vì nó bịt đường
quay lại của ADR-0032 — xem §4.

**Cột `deleted_at` trên `media_assets` thay vì hàng đợi riêng.** Soft delete
quen thuộc hơn. Bỏ vì nó không biểu diễn được nguồn mồ côi LỚN NHẤT: upload bỏ
dở không có row `media_assets` nào để mà đánh dấu.

## Giới hạn đã biết

1. **Review hết lượt sửa vẫn giữ ảnh.** `rejectedFinal` là trạng thái cuối
   (ADR-0032 §5) nên về lý ảnh có thể dọn — nhưng đó là một luật NGHIỆP VỤ về
   nội dung, không phải dọn rác, và nó đáng một quyết định riêng cùng lúc với
   câu hỏi "giữ review bị bác bao lâu". Ghi nợ ở đây để không ai tưởng là bỏ
   sót.
2. **Không đếm ngược được số ảnh đã mất.** Cloudinary không cho khôi phục, và
   ADR này không giữ bản sao. Lưới an toàn duy nhất là 7 ngày cộng cờ tắt.
3. **Chưa dọn poster của video.** `MediaAsset.posterId` là một publicId thứ
   hai; quy tắc §2 hỏi theo `public_id` nên poster không tự được kiểm. Hệ hiện
   chưa có video thật nào, nhưng khi có thì đây là chỗ phải sửa trước.
4. **ADR-0007 là một trích dẫn treo.** `schema.prisma` trỏ tới nó cho `Outbox`,
   `EmailType` và `OutboxStatus`; file không tồn tại. Cơ chế thì có thật và
   đang chạy — chỉ là quyết định của nó chưa bao giờ được ghi. Việc riêng, ghi
   ở đây để khỏi mất dấu.
5. **Không có đường xoá thủ công cho admin.** Muốn gỡ một tấm ảnh cụ thể ngay
   thì vẫn phải vào dashboard Cloudinary. Màn media library của admin là phase
   `/media` (đang `enabled: false`).
