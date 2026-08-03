# ADR-0005 — Media đọc: API dựng & trả Cloudinary URL (chỉ cần cloud name)

- **Trạng thái:** Accepted (2026-07-21)
- **Bối cảnh:** P3a-C (W5 posts, W6 site-media) là nơi **đầu tiên** ở v2 trả
  media ra API; cần chốt hợp đồng trước khi các module media sau (tour media,
  admin CRUD ở P4) kế thừa

> **Cập nhật 2026-08-03 (đại tu docs — đối chiếu code):**
> - **Hợp đồng chạy đúng phía API, nhưng web CHƯA có consumer nào.** `JournalPost`
>   (VM blog) không có field media —
>   [apps/web/src/lib/api/posts.ts:14-27](../../apps/web/src/lib/api/posts.ts);
>   `post-card.tsx` và mọi component ảnh khác của web (28 file) dùng
>   `ImagePlaceholder` thay ảnh thật; `siteMedia.list` — 0 nơi gọi trong
>   `apps/web/src`.
> - Mốc "web render `url` (P3b/P4)" ở Hệ quả nay chỉ còn đúng **P4** — P3b đã
>   merge hết cụm Blog/Tours/Destinations mà không gắn media thật (chính sách
>   ảnh hiện hành: toàn site `ImagePlaceholder`, xem `docs/README.md` dòng P3b).
>
> Quyết định gốc giữ nguyên văn — hợp đồng vẫn đúng như thiết kế, chỉ chưa có
> ai tiêu thụ ở web.

## Bối cảnh

`MediaAsset` lưu `publicId` của Cloudinary (polymorphic theo
`ownerType, ownerId, role`); URL delivery không lưu trong DB mà **suy ra lúc
đọc** (comment schema đã ghi chủ đích này). Tới P3a-C, hai câu hỏi hợp đồng
phải trả lời dứt điểm vì mọi module đọc media về sau sẽ noi theo:

1. API trả **URL đã dựng** hay **`publicId` thô** để client tự dựng?
2. Nếu dựng URL thì dựng **ở đâu** — API hay web?

Ràng buộc: catalog (tour) ở P1 **chưa trả media ở đâu cả** — nên P3a-C thực sự
là điểm đặt nền. Chọn sai bây giờ nghĩa là đổi shape contract sau này (tốn, vì
P3b web đã tiêu thụ).

Đối chiếu Nexora: API **dựng URL tại read-time và trả cả `url` lẫn `publicId`**
kèm metadata; web hoàn toàn "dumb" về Cloudinary, chỉ render `item.url`. API chỉ
đọc **`CLOUDINARY_CLOUD_NAME`** (giá trị **công khai** — không phải secret
upload) để dựng URL.

## Quyết định

v2 giữ mô hình Nexora: **API dựng & trả URL Cloudinary lúc đọc.**

1. **Một env công khai** `CLOUDINARY_CLOUD_NAME`. Chỉ dùng để dựng URL delivery
   — **không** kéo `CLOUDINARY_URL`/API secret (upload/GC là P4) vào P3a.
2. **Một helper thuần** `buildCloudinaryUrl(cloudName, asset)` (không phụ thuộc
   DB/Nest) → TDD được:
   - ảnh: base `https://res.cloudinary.com/<cloud>/...` + transform
     `f_auto,q_auto`.
   - video: URL video + `posterUrl` riêng (từ `posterId`, hoặc frame đầu).
   - **escape-hatch:** nếu `publicId` đã là URL tuyệt đối (`^https?://`) thì
     **trả nguyên, không bọc transform** — cho seed/placeholder (ảnh Unsplash).
3. **Resolve theo batch trong service:** một `findMany` cho toàn bộ owner của
   một trang (`ownerId in [...]`), map ra `MediaItem[]` — **không N+1**. Trả
   object mới, không mutate.
4. **Contract `MediaItem`** trả cả `url` (đã dựng) **và** `publicId` (thô) kèm
   `type · role · width? · height? · alt? · sortOrder · posterUrl?`. `url` là
   thứ web render; `publicId` giữ để admin (P4) re-submit item không đổi.
5. **Enum owner: `MediaOwnerType.SITE`** (không phải `SITE_MEDIA`) và `POST` —
   dùng đúng giá trị schema.

## Hệ quả

- **Web dumb, contract ổn định.** P3b render thẳng `url`, không cần
  `next-cloudinary`/`CldImage`, không cần biết Cloudinary. Đổi transform về sau
  chỉ sửa helper phía API — **không migrate DB, không đổi shape contract**.
- **Chi phí P3a thấp.** Chỉ thêm một env công khai + một hàm thuần (test không
  cần mạng/DB nhờ escape-hatch URL tuyệt đối cho fixture). Không đụng
  upload/secret/GC.
- **Env fail-fast.** `CLOUDINARY_CLOUD_NAME` theo pattern env v2: có default ở
  dev, bắt buộc ở production (thiếu là chết boot, không âm thầm trả URL hỏng).
- **Related tours vẫn KHÔNG media.** `posts.bySlug` trả related tours bằng đúng
  tour-summary v2 hiện có (P1) — **không** mở rộng catalog để nhét media, tránh
  scope creep vào module P1. Khi catalog thêm media (P3b/P4) thì related tự có.
  Đây là điểm v2 **tạm khác Nexora** (Nexora related tour có ảnh), nhất quán với
  việc toàn bộ catalog v2 chưa có ảnh — không phải thụt lùi riêng của blog.
- **`publicId` lộ ra public.** Chấp nhận: publicId chỉ là định danh asset trong
  cloud công khai, không phải bí mật; giữ nó cho phép admin re-submit và giữ
  parity với Nexora.

## Đã cân nhắc và loại

- **API trả `publicId` thô, web tự dựng URL** (dùng `next-cloudinary`). Loại:
  đổi hướng so Nexora, bắt web "biết" Cloudinary, đẩy quyết định dựng sang P3b
  chưa tồn tại, mất escape-hatch URL tuyệt đối cho seed, và contract kém ổn định
  hơn (`publicId` + luật-dựng-ngầm thay vì một `url` tường minh).
- **Hoãn media hẳn sang P4** (posts chỉ text, bỏ W6). Loại: `siteMedia.list`
  "chỉ trả slot có media" thành vô nghĩa, blog không ảnh demo kém, và W6 vốn nằm
  trong phạm vi P3a theo spec.
- **Lưu sẵn URL trong DB.** Loại: đổi transform/cloud phải migrate toàn bảng;
  mô hình "lưu publicId, dựng lúc đọc" linh hoạt hơn với chi phí một hàm thuần.
