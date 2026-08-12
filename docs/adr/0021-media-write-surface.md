# ADR-0021 — Media ghi: signed direct upload cho khách (avatar + ảnh review)

- **Trạng thái:** Accepted (2026-08-12)
- **Bối cảnh:** hai feature user đặt hàng ở vòng quét 12/08 (avatar trong
  Settings, ảnh chuyến đi kèm review) đang dừng ở **static-first** — UI đã
  chốt, preview chạy thật nhưng chưa lưu, vì API v2 tới nay chỉ có bề mặt
  media **ĐỌC** (ADR-0005). Đây là quyết định mở bề mặt **GHI** đầu tiên.

## Bối cảnh

ADR-0005 chốt: `MediaAsset` lưu `publicId` Cloudinary, URL delivery dựng lúc
đọc bằng `buildCloudinaryUrl` (chỉ cần `CLOUDINARY_CLOUD_NAME` công khai);
"upload/GC là P4" được ghi rõ là ngoài phạm vi lúc đó. Nay nhu cầu ghi đến
sớm hơn P4, từ phía **khách** (không phải admin):

1. **Avatar** — `User.image` (varchar 500) của Better Auth đang bỏ trống;
   UI Settings đã có khối upload chờ nối.
2. **Ảnh review** — tối đa 5 ảnh/review, UI dropzone + sortable đã chốt;
   review sẵn vòng duyệt `isApproved` nên ảnh có thể ăn theo mà không cần
   flow kiểm duyệt riêng.

Đối chiếu Nexora (luật 10): Nexora giải bài này bằng `UploadsService` —
**signed direct upload**: API tính chữ ký từ `api_secret` (không bao giờ rời
server), browser POST file **thẳng lên Cloudinary** (bytes không đi qua
Nest — giữ upload lớn khỏi worker); server quyết WHO (guard) và WHERE
(folder suy từ purpose enum, client không được chọn); FE nhận `publicId` từ
response của Cloudinary rồi gửi về API như dữ liệu thuần (`MediaInputDto`
"never carries an upload signature"). Khác biệt duy nhất: Nexora chỉ mở cho
**admin**; v2 cần mở cho **customer** với quyền hẹp theo mục đích.

## Quyết định

Port mô hình signed direct upload của Nexora, thu hẹp quyền theo purpose:

1. **Procedure oRPC mới `media.signUpload({ purpose, ext })`** (authed,
   rate-limit như các endpoint ghi khác) trả `SignedUploadParams`
   (`signature · timestamp · apiKey · cloudName · folder · publicId ·
   uploadUrl`). **`publicId` do server sinh** (uuid trong folder theo
   purpose) — client không được đặt tên; đuôi file whitelist ảnh
   (`jpg/jpeg/png/webp/avif/gif`), không nhận video ở cụm này.
2. **Hai purpose, hai luật quyền:**
   - `AVATAR` — mọi user đăng nhập; folder `<root>/avatars/<userId>`; trần
     2MB (một hằng chia sẻ với `lib/avatar.ts` của web).
   - `REVIEW_PHOTO` — chỉ user có booking **đủ điều kiện review** (một luật
     với `REVIEW_NOT_ELIGIBLE` của `reviews.create`, nhận `bookingCode` để
     kiểm); folder `<root>/reviews/<bookingCode>`; trần 5 ảnh · 10MB (chia
     sẻ với `lib/review-photos.ts`).
3. **Gắn avatar qua procedure riêng `account.setAvatar({ publicId | null })`**
   — server tự dựng URL delivery rồi ghi `User.image` bằng Prisma. CỐ Ý
   không cho client set `image` tự do qua `authClient.updateUser`: field đó
   nhận chuỗi bất kỳ, mở từ client là cho phép trỏ avatar tới URL ngoài
   không kiểm soát. `null` = gỡ avatar, về chữ-cái-đầu.
4. **Ảnh review tái dùng `MediaAsset` polymorphic** — KHÔNG bảng mới: thêm
   giá trị **`REVIEW`** vào enum `MediaOwnerType` (migration MỚI, không sửa
   migration cũ), role `gallery`, `ownerId = reviewId`. `reviews.create`
   nhận thêm `photos: string[]` (publicId, ≤5) và tạo asset trong CÙNG
   transaction tạo review. Chiều đọc: `PublicReviewSchema` thêm
   `media: MediaItem[]`, resolve theo batch đúng khuôn ADR-0005; bề mặt
   public **chỉ resolve media của review đã approved** — ảnh ăn theo vòng
   moderation sẵn có của review.
5. **Web nối dây, UI giữ nguyên:** `AvatarUpload` và `ReviewPhotoUpload`
   thay tiến trình mô phỏng bằng upload thật (XHR có progress lên
   `uploadUrl`), sau đó gọi `account.setAvatar` / đính `photos` vào submit
   review. Avatar hiển thị lại ở navbar (`user.image` trong session), khung
   hộ chiếu và Settings.
6. **Env:** kích hoạt `CLOUDINARY_API_KEY · CLOUDINARY_API_SECRET ·
   CLOUDINARY_UPLOAD_FOLDER` (đã có chỗ comment sẵn trong `.env.example`) —
   bắt buộc cho flow ghi, **API vẫn boot được khi thiếu** (chỉ
   `media.signUpload` trả lỗi cấu hình) để môi trường chỉ-đọc như CI không
   phải mang secret.

## Phương án đã cân nhắc

- **Unsigned upload preset** (Cloudinary preset công khai, khỏi ký): rẻ
  nhất, nhưng ai cầm preset name cũng đẩy được file vào cloud của mình,
  không gate được theo booking — loại (security-first).
- **Upload xuyên qua API** (multipart → Nest → Cloudinary): kiểm soát tuyệt
  đối từng byte, nhưng kéo file qua worker (giới hạn body, chậm, tốn RAM)
  — loại, đúng lý do Nexora đã ghi trong `UploadsService`.
- **Bảng `ReviewMedia` riêng**: rõ ràng về mặt đọc code, nhưng lặp nguyên
  shape `MediaAsset` (publicId/type/role/dims/alt) và mất luôn đường dùng
  chung `buildCloudinaryUrl`/batch-resolve — loại, polymorphic sẵn có +
  một giá trị enum là đủ.
- **Cho client set `User.image` qua `updateUser` của Better Auth**: ít code
  nhất nhưng nhận URL bất kỳ — loại như đã nêu ở Quyết định 3.

## Hệ quả

- Contract nở thêm: `media.signUpload`, `account.setAvatar`,
  `reviews.create.photos`, `PublicReviewSchema.media` — web/mobile sau này
  dùng chung.
- Migration mới: thêm `REVIEW` vào `MediaOwnerType` (an toàn — chỉ thêm
  giá trị enum).
- **Rác Cloudinary có thể tồn tại** (ký rồi bỏ, không gắn vào đâu):
  chấp nhận ở cụm này, ghi sổ nợ P4 — Nexora xử bằng cron media-reconcile
  (`CloudinaryService.destroy` đã có bản v2 chưa port). PublicId server-sinh
  trong folder cố định nên rác định vị được, dọn sau không mất gì.
- Test: chữ ký tính bằng SDK Cloudinary — unit test service với secret giả
  (deterministic); int test cho luật quyền (`REVIEW_PHOTO` với booking
  không đủ điều kiện phải bị chặn); web giữ TDD các lib thuần đã có.
- Dev cần key Cloudinary thật trong `apps/api/.env.local` để chạy flow đầu
  cuối (user cấp — không commit).

## Ngoài scope (ghi để khỏi tranh luận lại)

Video · crop/xoay ảnh phía client · admin media library + cron dọn rác
(P4) · avatar/ảnh trong email · đổi email (PARK riêng, không liên quan).
