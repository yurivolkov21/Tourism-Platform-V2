# Spec P4e-4 — Quản trị bài viết

- **Ngày:** 2026-10-02 · **Trạng thái:** thiết kế duyệt qua bốn phần trong chat cùng ngày;
  spec user duyệt cùng ngày. Plan thi công
  [2026-10-02-p4e-4-posts-admin.md](../plans/2026-10-02-p4e-4-posts-admin.md) sửa tám đoạn cho
  khớp code — mỗi đoạn ghi "plan, quyết định N" ngay tại chỗ đã sửa.
- **Quyết định kiến trúc:** [ADR-0051](../adr/0051-posts-admin.md)
- **Nền:** [ADR-0004](../adr/0004-post-visibility-helper.md) (luật "đã đăng") ·
  [ADR-0047](../adr/0047-tour-editor-sections.md) (phiên bản, cổng "đủ mới được bán") ·
  [ADR-0048](../adr/0048-tour-photos.md) (tải ảnh, thư viện, hàng dọn) ·
  [ADR-0035](../adr/0035-media-lifecycle.md) (bộ dọn media) ·
  spec blog cũ [2026-07-31-blog-api-design.md](2026-07-31-blog-api-design.md)
- **Đóng:** G9 (bài viết nhúng tour không được làm tươi), một phần G15 (đường tải ảnh trùng).

## 1. Mục tiêu & phạm vi

### Vấn đề

Chín bài seed sống trên `/blog`, nhưng admin không sửa được một chữ nào: không có endpoint
ghi, mục Posts của sidebar còn "Soon". Muốn đổi một bài phải sửa fixture rồi seed lại.

### Trong phạm vi

- Danh sách bài, tạo, sửa, xoá; nháp, đăng, hẹn giờ đăng.
- Trình soạn markdown có hàng nút định dạng và tab xem trước.
- Tag gõ thẳng trong form; ảnh bìa tải lên hoặc chọn từ thư viện; tối đa 3 tour liên quan.
- Web: khối "Tours in this story", trang bài viết tươi khi tour đổi (G9), danh sách bài
  không dừng ở 50.
- Xoá cache web sau mọi lệnh ghi bài.

### Ngoài phạm vi, cố ý

- Ảnh trong thân bài (cần CSP, vòng đời media, parser mobile).
- `metaTitle`, `metaDescription` (có cột, web không đọc; để nguyên).
- Trang quản lý tag riêng (đổi tên, gộp, xoá tag).
- Trang xem trước nháp trên web.
- Soạn thảo trực quan (WYSIWYG).

## 2. Luật nghiệp vụ

Hằng số mới ở `libs/shared/contract/src/schemas/admin-posts.ts`:

| Hằng | Giá trị | Vì sao |
| --- | --- | --- |
| `POST_SLUG_MAX` | 80 | cột `slug VarChar(80)` |
| `POST_TITLE_MAX` | 160 | cột `title VarChar(160)` |
| `POST_EXCERPT_MAX` | 300 | cột `excerpt VarChar(300)` |
| `POST_CONTENT_MAX` | 20000 | bài seed dài nhất chưa tới 5000; trần chặn dán nhầm cả file |
| `POST_TAGS_MAX` | 5 | bài seed có tối đa 2 tag |
| `POST_TAG_NAME_MAX` | 60 | cột `post_tags.name/slug VarChar(60)` |
| `POST_RELATED_TOURS_MAX` | 3 | như Nexora |
| `POST_COVER_ALT_MAX` | 300 | cột `media_assets.alt VarChar(300)` (thêm ở plan, quyết định 18) |

### 2.1 Slug

Đặt một lần lúc tạo, `slugSchema(POST_SLUG_MAX)`, gợi ý từ tiêu đề bằng
`slugifyVietnamese`; trùng thì `SLUG_TAKEN` 409. Không có lệnh đổi slug.

### 2.2 Trạng thái

`status` vẫn `DRAFT | PUBLISHED`. Trạng thái hiển thị suy bằng MỘT hàm thuần
`postDisplayStatus(status, publishedAt, now)` ở contract:

| status | publishedAt | Hiển thị |
| --- | --- | --- |
| DRAFT | bất kỳ | `draft` |
| PUBLISHED | `> now` | `scheduled` |
| PUBLISHED | `<= now` | `published` |

- PUBLISHED thì `publishedAt` bắt buộc (refine của schema → 400). Form tự điền "bây giờ" khi
  chuyển sang Published; chọn ngày tương lai là hẹn giờ.
- Chuyển về DRAFT giữ nguyên `publishedAt` trong DB; web không đọc nó khi DRAFT.
- Giờ tính theo UTC, như mọi mốc giờ khác của admin.

### 2.3 Điều kiện đăng

`postReadiness({ content, excerpt, cover })` ở contract trả danh sách mục thiếu trong
`content` (rỗng sau trim), `excerpt` (rỗng sau trim), `cover` (không có). Lệnh `update` mà
`status` đích là PUBLISHED và còn thiếu thì `POST_NOT_READY` 409 — áp cả khi bài đang
PUBLISHED và lần lưu này làm nó thiếu (cùng cổng của tour).

### 2.4 Nội dung

- Tối đa `POST_CONTENT_MAX` ký tự; nháp được để trống.
- Từ chối (refine → 400, câu báo riêng từng loại):
  - ảnh nhúng: mẫu `![…](…)`;
  - thẻ HTML thô: `<tên-thẻ …>`, `</tên-thẻ>` và chú thích `<!-- -->`.
  Dấu `<` đứng một mình (ví dụ "a < b") không bị bắt.
- Link: web chỉ giữ `http`, `https`, `mailto` (`defaultUrlTransform` của react-markdown);
  không kiểm thêm ở đây.

### 2.5 Tag

Form gửi danh sách TÊN (0–`POST_TAGS_MAX`). Server chuẩn hoá: trim, bỏ trùng theo slug
(`slugifyVietnamese`), tên rỗng hay slug rỗng là 400. Tag chưa có thì tạo (slug từ tên, tên
giữ cách viết của người tạo đầu tiên — đúng chú thích của schema). Tag không còn bài nào thì
để nguyên (endpoint công khai vốn ẩn tag không có bài đã đăng).

### 2.6 Tour liên quan

Danh sách id tour (0–3, không trùng), thứ tự là thứ tự gửi lên (`post_tours.order`). Id không
tồn tại → `RELATED_TOUR_NOT_FOUND` 404. Tour đang tắt bán vẫn chọn được; web chỉ hiện tour
đang bán (API công khai đã lọc).

### 2.7 Xoá

Xoá được mọi bài, qua hộp xác nhận. Một transaction: kiểm phiên bản, xoá dòng `media_assets`
(owner POST, ownerId = bài), xoá bài (cascade `post_tag_links`, `post_tours`), đưa ảnh bìa tải
lên của chính bài vào lại hàng dọn. Sau commit: bust cache.

### 2.8 Tác giả

`authorId` = admin tạo bài, không sửa được. Web hiện tên tác giả, rơi về "Nexora guides" khi
không có (sẵn có).

## 3. Contract & API

### 3.1 Route mới (`contract.admin.posts`)

| Lệnh | Route | Ghi chú |
| --- | --- | --- |
| `list` | `GET /api/admin/posts` | `AdminPageQuery` + `status` (`all`/`published`/`scheduled`/`draft`) + `search` (tiêu đề) |
| `get` | `GET /api/admin/posts/{slug}` | đọc cả nháp và bài hẹn giờ; `NOT_FOUND` |
| `create` | `POST /api/admin/posts` | `{ title, slug }` → bài DRAFT; `SLUG_TAKEN` |
| `update` | `POST /api/admin/posts/{id}` | MỘT lệnh cho cả form, xem §3.2 |
| `delete` | `POST /api/admin/posts/{id}/delete` | `{ version }`; `STALE_POST`, `NOT_FOUND` |
| `signCoverUpload` | `POST /api/admin/posts/{id}/cover-upload` | một bộ tham số ký; `MEDIA_UPLOAD_NOT_CONFIGURED` 503 |
| `tags` | `GET /api/admin/post-tags` | mọi tag kèm số bài (cả nháp); route ngoài `/api/admin/posts/…` để `{slug}` không nuốt nó |

Thư viện ảnh dùng lại `GET /api/admin/tour-photo-library` của F18 (ảnh địa danh). Ô chọn tour
liên quan nạp MỌI tour qua `GET /api/admin/tours` (trang 100 dòng) một lần ở server rồi lọc
theo tiêu đề ở trình duyệt — danh sách tour của admin không có ô tìm (sửa ở plan, quyết định 1).

### 3.2 `update`

Đầu vào:

```text
{ id, version, title, excerpt | null, content, status, publishedAt | null,
  tags: string[], relatedTourIds: uuid[],
  cover: { publicId, alt | null, upload? } | null }
```

- `upload` là metadata Cloudinary của ảnh MỚI tải (dùng lại `TourPhotoUploadSchema`).
- Ảnh bìa hợp lệ khi: nằm trong thư mục tải lên của chính bài (`isPostUploadPublicId`), hoặc
  có trong thư viện địa danh, hoặc chính là ảnh bìa hiện tại. Khác đi → `PHOTO_NOT_ALLOWED` 400.
- Lỗi: `STALE_POST` 409, `POST_NOT_READY` 409, `PHOTO_NOT_ALLOWED` 400,
  `RELATED_TOUR_NOT_FOUND` 404, `NOT_FOUND` 404.
- Một transaction: kiểm phiên bản (`updatedAt`), ghi bài, thay trọn tag và tour liên quan,
  thay dòng media bìa (role hero), đưa ảnh bìa cũ vào lại hàng dọn nếu nó thuộc thư mục tải
  lên của bài.
- Trả về chi tiết bài sau lưu (cùng hình với `get`).

### 3.3 Hình dạng chi tiết (`AdminPostDetail`)

`id, slug, title, excerpt, content, status, publishedAt, displayStatus, readiness,
tags [{ slug, name }], relatedTours [{ id, slug, title, isPublished }],
cover { publicId, url, alt, source } | null, author { name }, version, createdAt`.

`displayStatus` và `readiness` do server tính bằng hai hàm thuần ở §2; `readiness` là danh
sách mục CÒN THIẾU (rỗng là đủ). `source` của ảnh bìa là `UPLOAD` (thư mục của chính bài),
`LIBRARY` (có dòng thư viện địa danh) hay `CATALOG` (ảnh bìa của bài seed — gỡ ra là không
chọn lại được, như ảnh tour ở ADR-0048 AMEND 1). `author` luôn có (`author_id` NOT NULL),
chỉ `name` có thể trống. (Sửa ở plan, quyết định 4, 5, 6.)

### 3.4 Ký upload và thư mục

- `postCoverFolder(root, postId)` = `<root>/posts/<postId>`; `isPostUploadPublicId` so tiền
  tố có `/` chốt đuôi, cùng nếp `isTourUploadPublicId`.
- Ký thì enqueue publicId vào `media_garbage` (ảnh tải mà không lưu tự bị dọn sau 7 ngày).
- Phần ký chung với tour tách thành một hàm dùng chung (một phần G15).

### 3.5 Xoá cache web

`postRevalidationTags(slug)` = `['posts', \`post:${slug}\`]`, gọi sau commit của `update` và
`delete` (`create` tạo nháp, web không thấy). `PostsModule` (hoặc module admin mới) import
`WebRevalidationModule`.

## 4. Admin

### 4.1 Sidebar

Bật mục Posts (`/posts`). Sửa hai test đang dùng Posts làm ví dụ mục tắt (`nav.spec.ts`,
`nav-main.spec.tsx`) sang một mục khác còn tắt (Media library).

### 4.2 Danh sách `/posts`

- Thanh công cụ: `StatusFilterTabs` (All / Published / Scheduled / Drafts), ô tìm, nút New post.
- Bảng (kit `DataTableFrame`): Post (ảnh bìa nhỏ, tiêu đề, slug) · Status (chip) · Published
  (ngày đăng; bài hẹn giờ in ngày hẹn ở đây, chip không lặp lại — plan, quyết định 19) · Tags ·
  Updated. Tiêu đề là link mở trang sửa, như bảng Tours. Phân trang và trạng thái trên URL theo
  `table-query.ts`.

### 4.3 Hộp New post

Tiêu đề và slug (tự điền từ tiêu đề, câu "Set once" dùng lại `SLUG_HINT_COPY`). Tạo xong
chuyển sang `/posts/[slug]`. `SLUG_TAKEN` báo ngay dưới ô slug.

### 4.4 Trang sửa `/posts/[slug]`

Phần đầu: Back to posts, tiêu đề, chip trạng thái, View on site (chỉ khi published), lần lưu
cuối.

Cột trái:

1. Tiêu đề; tóm tắt (đếm ký tự).
2. Trình soạn: hàng nút H2 · Bold · Italic · Bullet list · Link; tab Write / Preview; một dòng
   nhắc cú pháp hỗ trợ. Hành vi hàng nút là hàm thuần
   `applyMarkdownAction(text, selection, action)` trả `{ text, selection }`:
   - Bold/Italic bọc vùng chọn (`**…**`, `*…*`), không chọn gì thì chèn cặp dấu và đặt con trỏ
     giữa.
   - H2 và Bullet list thêm tiền tố `## ` / `- ` cho mỗi dòng của vùng chọn; bấm lại thì gỡ.
   - Link bọc vùng chọn thành `[…](https://)` và chọn sẵn phần URL.
3. Vùng Delete this post ở cuối cột.

Cột phải (dính khi cuộn, trần chiều cao như cột phải của F19):

1. **Publish:** chọn Draft / Published; ô ngày giờ (UTC) khi Published; danh sách kiểm tra ba
   mục (dòng thiếu ghi "Missing — required to publish"); nút **Save** duy nhất.
2. **Cover:** ảnh xem trước kèm nguồn (ảnh catalog nói gỡ ra là không chọn lại được); Upload
   và Choose from library; ô alt tuỳ chọn — trống là ảnh trang trí: web vẽ `alt=""` vì tiêu đề
   bài in ngay cạnh ảnh (plan, quyết định 3).
3. **Tags:** ô gõ có gợi ý từ `post-tags`; Enter tạo tag mới; tối đa 5.
4. **Related tours:** tối đa 3; thêm bằng ô tìm tour; lên/xuống/xoá; câu nhắc tour tắt bán
   không hiện trên web.

Hành vi chung:

- Một nút Save gửi cả form (`update`); thành công thì cập nhật phiên bản và giờ lưu.
- Rời trang khi còn thay đổi → hộp hỏi lại (kit `UnsavedChangesProvider`).
- `STALE_POST` → dải báo kèm Reload; `POST_NOT_READY` → dải liệt kê mục thiếu;
  `PHOTO_NOT_ALLOWED` / `RELATED_TOUR_NOT_FOUND` → câu báo tại card tương ứng.
- Màn hẹp: một cột, cột phải xuống dưới.

### 4.5 Ảnh: phần dùng chung tách từ F18

- `lib/photo-upload.ts`: dùng nguyên `uploadPhoto` và `UploadedPhoto` — chúng vốn không phụ
  thuộc tour, `upload` của ảnh bìa cùng hình `TourPhotoUploadSchema`; chỉ sửa chú thích (plan,
  quyết định 7).
- `PhotoLibraryDialog`: dời sang `components/kit/`, bỏ phụ thuộc tour (`tourDestinationIds`
  và bộ lọc `THIS_TOUR` thành prop tuỳ chọn; copy chuyển sang khối dùng chung
  `messages.admin.photoLibrary`). Khu sửa tour truyền đúng prop cũ nên hành vi không đổi —
  test F18 hiện có xanh nguyên, chỉ đổi đường import.

### 4.6 Hộp xoá

Nói rõ: bài rời web; mất liên kết tag và tour; ảnh bìa tự tải lên vào hàng dọn; ảnh thư viện
giữ nguyên. Không có câu riêng cho bài seed: admin không phân biệt được bài nào đến từ seed —
hệ quả của lượt seed lại ghi ở §9 và ADR-0051 (plan, quyết định 2).

### 4.7 Copy

Khối mới `messages.admin.posts` ở `@tourism/i18n` (English). Nhãn trạng thái, câu "Set once",
câu hiển thị "Missing — required to …" dùng lại hằng có sẵn khi trùng nghĩa.

## 5. Web

1. **Bộ render chung.** `ArticleMarkdown` (cùng hàm `slugify` của id heading) chuyển sang
   `@tourism/ui/components/article-markdown`; `libs/shared/ui` thêm `react-markdown` và
   `remark-gfm` đúng phiên bản web đang dùng. Web đổi import; test hiện có chuyển theo.
2. **Tour liên quan.** `toJournalPostDetail` giữ `relatedTours`; trang `/blog/[slug]` thêm
   khối "Tours in this story" (copy `blog.toursHeading` sẵn có) bằng `RelatedTours`, đặt sau
   thân bài, trước "More from the journal"; ẩn khi danh sách rỗng.
3. **G9.** `fetchPostDetail` mang thêm tag `tours` cạnh `post:<slug>`.
4. **Hết trần 50.** `fetchPosts` đi hết các trang bằng `collectAllPages` (khuôn G10).
5. Bài mới có slug mới: trang dựng khi có người mở lần đầu (`dynamicParams` mặc định).
6. Ảnh bìa không có alt: KHÔNG đổi. Đã kiểm `SlotImage` (`post-card.tsx`, `post-hero.tsx`) —
   nó cố ý vẽ `alt=""` cho ảnh trang trí, và ở cả hai chỗ tiêu đề bài in ngay cạnh ảnh; lấy
   tiêu đề làm alt là bắt trình đọc màn hình đọc hai lần (plan, quyết định 3).

## 6. Đối chiếu Nexora (luật 10)

| Nexora | v2 | Phân loại |
| --- | --- | --- |
| Danh sách, sửa, tag, thay ảnh bìa, xoá | có đủ | tương đương |
| Không có tạo bài | có hộp New post | v2 tốt hơn |
| Route admin theo slug mà PATCH đổi được slug (bookmark gãy) | slug đặt một lần | v2 tốt hơn |
| Tour liên quan tối đa 3, giữ thứ tự | như vậy | tương đương |
| Hẹn giờ bằng `publishedAt` tương lai, không cron | như vậy | tương đương |
| Tag gửi lên thì thay trọn | như vậy | tương đương |
| Cover thay trọn, giữ ảnh role `body` | không có ảnh `body` | cố ý bỏ (ngoài phạm vi) |

## 7. Kiểm thử

TDD trên logic thuần, test viết trước:

- contract: `postDisplayStatus`, `postReadiness`, luật nội dung (ảnh, HTML, `<` đứng một
  mình), refine PUBLISHED cần `publishedAt`, trần tag/tour/độ dài;
- api: `postCoverFolder`/`isPostUploadPublicId`, chuẩn hoá tag, `postRevalidationTags`;
- admin: `applyMarkdownAction` (bọc, gỡ, nhiều dòng, con trỏ), view model danh sách và trang
  sửa, query trạng thái trên URL.

Int test (`admin-posts.int.spec.ts`): tạo; trùng slug; sửa đủ trường; phiên bản cũ; đăng thiếu
điều kiện; đăng đủ; hẹn giờ (bài không lên `posts.list` công khai trước giờ); thay ảnh bìa
(dòng media cũ đi, ảnh tải lên cũ vào hàng dọn, ảnh thư viện thì không); ảnh lạ
`PHOTO_NOT_ALLOWED`; tour lạ; xoá (dòng media, liên kết, hàng dọn); lệnh bust gọi đúng tag.

Component: hàng nút và tab Preview; card Publish; card Cover (tải lên, thư viện); Tags; Related
tours; hộp xoá; hộp New post. Web: khối tour liên quan; tag cache của `fetchPostDetail`;
`fetchPosts` nhiều trang. Hồi quy F18: test ảnh tour hiện có xanh nguyên sau khi tách phần
dùng chung.

Đột biến tay trên các nhánh chính; `gate:int` trước khi khai xong.

## 8. Thử tay trên production (sau merge, từng bước)

1. Mở `/posts`: chín bài seed, tab trạng thái, tìm theo tiêu đề.
2. Tạo bài nháp `p4e-4-test-post`; thử Save khi chọn Published lúc chưa đủ → báo thiếu.
3. Viết nội dung bằng hàng nút; Preview khớp.
4. Tải ảnh bìa lên; thêm tag mới và tag sẵn có; gắn hai tour liên quan.
5. Hẹn giờ vài phút tới → chip Scheduled; web chưa thấy bài.
6. Sau giờ hẹn (≤ 5 phút ISR): bài lên `/blog`, trang bài có "Tours in this story".
7. Tắt bán một tour liên quan → trang bài bỏ card đó (G9); bật lại.
8. Xoá bài → web 404; DB không còn bài, dòng media, tag link, tour link; ảnh tải lên nằm trong
   hàng dọn. DB về đúng trạng thái gốc (tag mới tạo trong lượt thử thì xoá tay theo hướng dẫn
   của mình, vì không có trang quản lý tag).

## 9. Rủi ro và việc để sau

- **Mobile:** parser hiện chỉ hiểu `##`, đoạn văn, `- `; đậm, nghiêng, link do hàng nút chèn
  sẽ hiện thô. Ghi vào `docs/handoff/` cho thành viên dựng màn.
- **Lượt seed lại ~03/11:** bài seed đã sửa giữ nguyên (upsert `update: {}`); bài seed đã xoá
  được tạo lại, không ảnh bìa tới khi chạy `media:upload`.
- **Bài hẹn giờ** lên trễ tối đa ~5 phút.
- **Tag thừa:** tag không còn bài nào nằm lại trong `post_tags` (không có trang quản lý tag).
- **G16** chỉ khép ở đường bài viết (vị từ thư mục tải lên); vị từ chung cho bộ dọn để P4f.
