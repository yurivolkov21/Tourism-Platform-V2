# Plan thi công P4e-4 — Quản trị bài viết

> **Cho agent thi công:** làm tuần tự từng task bằng skill
> `superpowers:executing-plans`. Bước dùng checkbox `- [ ]`. Prompt bàn giao ở
> cuối file KHÔNG cho dùng subagent.

**Mục tiêu:** admin có danh sách, tạo, sửa, xoá, đăng và hẹn giờ bài viết — trình soạn
markdown có hàng nút và tab Preview, ảnh bìa tải lên hoặc chọn từ thư viện, tag gõ thẳng,
tối đa 3 tour liên quan. Web có khối "Tours in this story", trang bài tươi lại khi tour đổi
(G9), danh sách bài không còn dừng ở 50.

**Kiến trúc (ADR-0051):** contract khai `admin.posts.*` cùng ba hàm thuần
(`postDisplayStatus`, `postReadiness`, `postContentIssue`) mà API và admin cùng gọi. API ghi
trong một transaction có phiên bản (`STALE_POST`) rồi bust `posts` + `post:<slug>` sau
commit. Admin là một trang hai cột với MỘT nút Save, dùng lại đường tải ảnh và hộp thư viện
của F18. Bộ render markdown dời sang `@tourism/ui` để web và tab Preview vẽ cùng một bản.
Không migration: bốn bảng bài viết có từ migration init.

**Stack:** NestJS 11 + Prisma 7 + oRPC (API) · Next.js 16 + React 19 + Base UI (admin, web) ·
Tailwind v4 · Vitest + Testing Library.

**Spec:** [2026-10-02-p4e-4-posts-admin-design.md](../specs/2026-10-02-p4e-4-posts-admin-design.md)
— HỢP ĐỒNG của việc này; plan chỉ nói cách làm. Chỗ plan chốt khác chữ cũ của spec nằm ở
"Quyết định của plan"; spec đã sửa cho khớp trong cùng commit với plan này.
**ADR:** [0051 — quản trị bài viết](../adr/0051-posts-admin.md) · nền:
[0004](../adr/0004-post-visibility-helper.md) · [0016](../adr/0016-web-data-layer.md) ·
[0035](../adr/0035-media-lifecycle.md) · [0047](../adr/0047-tour-editor-sections.md) ·
[0048](../adr/0048-tour-photos.md)

| Tính năng | Nhánh | Task |
| --- | --- | --- |
| **P4e-4** quản trị bài viết | `feat/p4e-4-posts-admin` | 1–14 |

## Điều kiện bắt đầu

- `git log --oneline -3 main` phải thấy commit plan này và `51b17a4e` (ADR-0051 + spec).
- `git status` sạch, đang ở `main`. Docker Postgres chạy (`docker ps`; tắt thì mở Docker
  Desktop rồi `docker start tourism-v2-postgres-1`).
- Không có migration nào: `posts`, `post_tags`, `post_tag_links`, `post_tours` và giá trị
  `POST` của `media_owner_type` đều đã có. Thấy mình sắp cần sửa `schema.prisma` thì DỪNG
  và hỏi.

## Quyết định của plan

Spec để ngỏ hay nói chưa khớp code ở các chỗ dưới đây; plan chốt như sau. Chỗ nào chữ
cũ của spec lệch (1–7, 18, 19), spec đã sửa cho khớp trong cùng commit, ghi "plan, quyết
định N" tại đoạn sửa.

1. **Ô chọn tour liên quan không gọi `?search=`**: `AdminToursListQuerySchema` KHÔNG có
   `search` (đo ở `admin-catalog.ts`). Trang sửa bài nạp MỌI tour một lần ở server
   (`fetchPostTourOptions`, trang 100 dòng, tối đa 10 trang — 29 tour hiện tại là một lượt
   gọi) rồi lọc theo tiêu đề ở trình duyệt. Không đổi contract của tour.
2. **Hộp xoá không có câu "bài seed sẽ quay lại"**: admin không có cách nào biết bài nào
   đến từ seed (tác giả của bài seed là chính admin, không có cột đánh dấu), còn nhét danh
   sách slug seed vào code chạy thật là đem dữ liệu demo vào sản phẩm. Hệ quả seed lại đã
   ghi ở ADR-0051 "Giới hạn đã biết" 4 và spec §9 — chỗ người vận hành đọc.
3. **Ảnh bìa trống alt thì web vẫn vẽ `alt=""`**, không lấy tiêu đề bài: `SlotImage` cố ý
   coi ảnh không alt là ảnh trang trí, và ở cả card lẫn phần đầu bài, tiêu đề in ngay cạnh
   ảnh — lấy tiêu đề làm alt là bắt trình đọc màn hình đọc tiêu đề hai lần. Web không đổi;
   câu gợi ý dưới ô alt của admin nói đúng điều này.
4. **`author` không bao giờ `null`**: `posts.author_id` NOT NULL, khoá ngoại `Restrict`.
   Hình dạng là `author: { name: string | null }`.
5. **`readiness` là danh sách mục CÒN THIẾU** (`'content' | 'excerpt' | 'cover'`), rỗng là
   đủ — đúng thứ `postReadiness` trả.
6. **Ảnh bìa mang `source` (`UPLOAD` · `LIBRARY` · `CATALOG`) thay cho `uploaded`**: chín
   bài seed có ảnh bìa CATALOG (do `media:upload` gắn), gỡ ra là không chọn lại được — như
   ảnh tour ở ADR-0048 AMEND 1. Card Cover nói điều đó ngay trên ảnh. Tốn một câu `count`.
7. **Không đổi tên kiểu tải lên**: `TourPhotoUploadSchema` và `UploadedPhoto`
   (`lib/photo-upload.ts`) vốn đã không phụ thuộc tour; ảnh bìa dùng nguyên. Chỉ sửa JSDoc.
8. **`PhotoLibraryDialog` dời sang `components/kit/`**, copy của nó sang
   `messages.admin.photoLibrary`, hai kiểu `PhotoLibraryResult`/`LoadPhotoLibraryAction` và
   `libraryLoadErrorCopy` sang `lib/photo-library.ts`; `tourDestinationIds` thành tuỳ chọn
   (mặc định rỗng — code hiện có đã xử đúng ca rỗng). Test F18 chỉ được đổi ĐƯỜNG IMPORT và
   chỗ tham chiếu copy; không đổi một assertion nào, số ca giữ nguyên.
9. **`useTourFormState` tách lõi thành `useVersionedForm` (generic)** ở
   `lib/use-versioned-form.ts`; `useTourFormState` thành vỏ một dòng gọi lõi. Hành vi không
   đổi, spec của nó xanh nguyên. Form bài viết gọi thẳng lõi.
10. **API dùng chung một định nghĩa thư viện**: `LIBRARY_PHOTO` và `STORED_PHOTO_SELECT` ở
    `admin-tours.service.ts` được `export` (thêm một chữ mỗi dòng), service bài viết import.
    Ký upload gom thành `signUploads` ở `lib/upload-signing.ts`, tour và bài viết cùng gọi
    (một phần G15 phía API). Đường ký của khách (`UploadSigningService`) không đổi.
11. **Form chặn Save trước khi gửi khi chọn Published mà còn thiếu** — cùng hàm
    `postReadiness` server dùng, nên server không bao giờ thấy ca ấy từ một form đúng. Mã
    `POST_NOT_READY` vẫn được xử (cùng một dải báo).
12. **Bảng `/posts`: tiêu đề là link**, không phải cả hàng bấm được — cùng nếp bảng Tours.
13. **Tag và ô tìm tour là ô nhập kèm danh sách nút gợi ý**, không phải Combobox nổi: kit
    `Combobox` chưa app nào dùng (rủi ro jsdom mới sát freeze), còn danh sách chỉ vài chục
    mục.
14. **Vùng xoá nằm ngoài `<form>`**; nút Save ở cột phải gắn form bằng thuộc tính `form`.
    Xoá xong → `/posts`; `STALE_POST` khi xoá → ở lại, refresh (khác vùng xoá tour vốn luôn
    về danh sách).
15. **Test của `ArticleMarkdown` ở lại web**, import từ `@tourism/ui`: `libs/shared/ui` chạy
    Vitest môi trường `node`, không có Testing Library. `slugify` dời sang
    `@tourism/ui/lib/slug`, `apps/web/src/lib/slug.ts` re-export để bốn chỗ import của web
    không đổi.
16. **Tag trong chi tiết admin sắp theo tên** (bảng nối không có cột thứ tự). Web không đổi.
17. **Tab Drafts gồm cả bài PUBLISHED thiếu ngày** — cùng luật `postDisplayStatus`.
18. **Hằng mới `POST_COVER_ALT_MAX = 300`** (cột `media_assets.alt`), thêm vào bảng hằng
    của spec §2.
19. **Chip Scheduled không kèm ngày**: ngày hẹn đã in ở cột Published ngay cạnh — lặp lại
    trong chip làm cột Status rộng gấp đôi mà không thêm thông tin.

## Ràng buộc toàn cục

Áp cho **mọi** task, không nhắc lại ở từng chỗ:

- **TDD** (luật 4): viết test trước, chạy cho ĐỎ đúng lý do, rồi mới cài. Mỗi ca test
  mới phải **thử đột biến**: sửa code cho sai, thấy ca ấy đỏ, trả lại — ghi kết quả vào
  báo cáo bàn giao. Đột biến KHÔNG khôi phục bằng `git checkout`/`git restore` khi còn
  thay đổi chưa commit — giữ bản gốc trong bộ nhớ hay một bản sao, rồi ghi lại.
- **Comment code tiếng Việt** (luật 8); **copy người dùng thấy bằng tiếng Anh**, nằm
  trong `@tourism/i18n` (luật 7). **Tokens-only**, không hex (luật 6).
- **Commit Conventional, tiếng Việt CÓ DẤU, không AI attribution** — không dòng
  `Co-Authored-By` (luật 12). Stage theo **đường dẫn tường minh**, không `git add -A`.
  Chạy `pnpm lint:fix` trước khi stage.
- **Không đụng**: `apps/mobile`, `apps/api/prisma/` (schema, migration, seed),
  `apps/web` ngoài đúng các file Task 5 kể tên. Ở `libs/shared/ui` chỉ THÊM
  `src/components/article-markdown.tsx`, `src/lib/slug.ts` và hai dependency trong
  `package.json`. Code tour chỉ được chạm đúng các chỗ Quyết định 8, 9, 10 kể tên và
  `lib/nav.ts`. Thấy mình sắp cần sửa chỗ khác thì DỪNG và hỏi.
- **Không hạ tầng sống** (luật 15): không Supabase, Cloudinary, webhook, env hay
  redeploy Render/Vercel. P4e-4 không cần gì từ hạ tầng — cặp khoá Cloudinary đã có từ F18.
- **Tên cố định** (review sẽ grep đúng chữ): route API như spec §3.1; route admin `/posts`
  và `/posts/[slug]`; khối i18n `messages.admin.posts` và `messages.admin.photoLibrary`;
  file đúng như "Bản đồ file".
- **Contract và i18n được đọc từ `dist`**: sửa xong phải build lại trước khi test gói
  khác thấy thay đổi —
  `pnpm turbo run build --filter=@tourism/contract --filter=@tourism/i18n --output-logs=errors-only`.
- **Next.js 16** (`apps/admin/AGENTS.md`): trước khi thêm route mới ở Task 6 và Task 8,
  đọc hướng dẫn trong `apps/admin/node_modules/next/dist/docs/` và theo khuôn các trang
  `app/(admin)/tours/`.
- **Tài liệu `.md`:** không để dòng bắt đầu bằng `+` ở cột 0; `git diff` file `.md`
  trước khi stage; không sửa entry CHANGELOG cũ.

### Quy trình gate (luật 11) — dùng ở cuối MỖI task

`pnpm gate:int` trần chạy song song 10 luồng và từng làm máy phình RAM, nên chạy tách
bước, hãm song song. Build web prerender gọi API thật, nên phải có API sống. Chạy từ gốc
repo bằng **Git Bash**.

```powershell
# 0. (PowerShell) Liếc commit memory trống — dưới 6 GB thì DỪNG, báo session gốc, đừng tự giết tiến trình nào.
"{0:N1} GB commit trống" -f ((Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory / 1MB)
```

```bash
# 1. API sống cho bước build web
pnpm turbo run build --filter=@tourism/api --output-logs=errors-only
(cd apps/api && node --env-file-if-exists=.env.local dist/main.js > /tmp/p4e4-api.log 2>&1 &)
for i in $(seq 1 30); do curl -sf http://localhost:3001/api/health > /dev/null && echo "API sống" && break; sleep 2; done

# 2. build + typecheck
NEXT_PUBLIC_API_URL=http://localhost:3001 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm turbo run build --concurrency=1 --output-logs=errors-only
pnpm turbo run typecheck --concurrency=3 --output-logs=errors-only

# 3. unit test — concurrency 1: đợt F18 một lượt concurrency 2 làm commit trống tụt còn 1,6 GB
pnpm turbo run test --concurrency=1 --output-logs=errors-only -- --maxWorkers=4

# 4. lint + luật tokens của mobile
pnpm lint && node scripts/check-mobile-tokens-only.mjs

# 5. integration test
pnpm test:int --concurrency=2
```

Tắt API sau khi xong (PowerShell) — chỉ giết đúng tiến trình đang nghe cổng 3001:

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Cả năm bước xanh mới được khai task xong. Trước bước 5, xem `git worktree list` và cổng
3001: một session khác đang chạy `test:int` thì chờ nó xong — int dùng chung DB
`tourism_test`. Máy chậm bất thường thì dừng và báo.

## Bài học mang sang — đọc TRƯỚC dòng code đầu tiên

Vòng review F17 tìm ra 24 lỗi thật; F14, F15, F16, F18, F19 lần lượt 15, 27, 15, 15, 15.
P4e-4 đi qua đúng các vùng từng hỏng: lệnh ghi có phiên bản, ảnh và hàng dọn, cache web,
form lớn.

**Test**

1. **Mỗi ca test mới thử đột biến.** F14 có ba ca xanh giả, F15 có năm.
2. **Fixture phải phân biệt được kết quả đúng với kết quả lười.** Ca "tag đã có giữ tên
   cũ" phải gửi chữ hoa thường KHÁC tên đang lưu; ca "thứ tự tour liên quan" phải gửi thứ
   tự KHÁC thứ tự id; ca "ảnh thư viện chép ghi công" phải có ghi công mà client không gửi.
3. **Khớp chữ chính xác, không `/…/i`.**
4. **Base UI trong jsdom:** mở Select, Tabs, Dialog xong thì CHỜ bằng `findByRole`, không
   `getByRole` ngay sau cú bấm (ca như vậy của F18 đỏ chập chờn khi máy tải nặng).
5. **Bố cục không đo được bằng jsdom** — Task 13 soi bằng CSS build thật.

**API**

6. **Lỗi DB bắt ngay tại câu ghi**, không SELECT kiểm trước (bài học 1–2 của vòng review
   F14): slug trùng → `P2002`, tour liên quan không có → `P2003` ở chính câu `createMany`.
7. **Phiên bản so trong CÙNG câu `UPDATE`** (`claimPost`), mọi câu ghi sau trong
   transaction đặt `updatedAt` bằng phiên bản vừa giành — thiếu thì Prisma tự đặt `now()`
   và phiên bản trả về lệch thứ đã so.
8. **Chỉ ảnh trong thư mục tải lên của CHÍNH bài vào lại hàng dọn** — ảnh thư viện và ảnh
   catalog không bao giờ (ADR-0048 §6). Ca test phải có cả ba nguồn.
9. **Bust SAU commit, fire-and-forget**, và KHÔNG bust khi lệnh hỏng.

**Admin**

10. **Tiêu điểm không bao giờ rơi về `<body>`**: gỡ tag cuối → ô nhập tag; gỡ tour cuối →
    ô tìm tour; gỡ ảnh bìa → nút Upload.
11. **Mọi câu copy hứa hệ quả phải đo trên code trước khi viết.** Copy của plan đã đo (ghi
    cạnh từng câu); thêm câu nào mới thì đo trước.
12. **Dùng lại, đừng chép:** `FormField`, `FormSelect`, `ListEditor`, `StepColumns`,
    `StateMark`, `ConfirmWriteDialog`, `useConfirmWrite`, `createWriteErrorCodec`,
    `DataTableFrame`, `StatusFilterTabs`, `TableSearchForm`, `ToolbarClearFilters`,
    `TablePagination`, `uploadPhoto`, `PhotoLibraryDialog`, `formatDateTime`,
    `withDeliveryTransform`, `cloudinaryImageUrl`, `slugifyVietnamese`.
13. **Không sửa component nào của `@tourism/ui`** — kit dùng chung với web đang chạy; chỉ
    THÊM hai file của Task 5.

**Quy trình**

14. **Comment không khai trạng thái tương lai** ("Task X sẽ…").
15. **Entry CHANGELOG viết theo ngày viết**; session review thêm entry merge.

## Bản đồ file

| File | Trách nhiệm | Task |
| --- | --- | --- |
| `libs/shared/contract/src/schemas/admin-posts.ts` (mới, + spec) | Hằng, schema, `postDisplayStatus`, `postReadiness`, `postContentIssue`, `normalizePostTags` | 1 |
| `libs/shared/contract/src/contract.ts`, `src/index.ts` | Khối `admin.posts`; export | 1 |
| `apps/api/src/lib/upload-signing.ts` (+ spec) | `postCoverFolder`, `isPostUploadPublicId` (Task 2); `signUploads` (Task 4) | 2, 4 |
| `apps/api/src/modules/posts/admin-post-errors.ts` (mới) | Bảy lớp `ContractError` | 2–4 |
| `apps/api/src/modules/posts/admin-post-rules.ts` (mới, + spec) | `postStatusWhere`, select, mapper, `coverSource`, `planPostCover` | 2, 3 |
| `apps/api/src/modules/posts/admin-posts.service.ts` (mới) | list · get · create · tags · update · delete · signCoverUpload | 2–4 |
| `apps/api/src/modules/posts/admin-posts.controller.ts` (mới) | Bảy route | 2–4 |
| `apps/api/src/modules/posts/posts.module.ts` | Import `WebRevalidationModule`, khai controller/service | 2 |
| `apps/api/src/modules/posts/admin-posts.int.spec.ts` (mới) | Int test | 2–4 |
| `apps/api/src/modules/web-revalidation/revalidation-decision.ts` (+ spec) | `postRevalidationTags` | 3 |
| `apps/api/src/modules/catalog/admin-tours.service.ts` | `export` hai hằng; ký bằng `signUploads` | 2, 3, 4 |
| `libs/shared/ui/package.json`, `src/components/article-markdown.tsx` (mới), `src/lib/slug.ts` (mới) | Bộ render markdown dùng chung | 5 |
| `apps/web/src/lib/slug.ts`, `components/content/article-markdown.tsx` (xoá), `components/content/article-markdown.spec.tsx` | Re-export; test theo đường mới | 5 |
| `apps/web/src/lib/api/posts.ts` (+ spec) | `relatedTours`, tag `tours`, `collectAllPages` | 5 |
| `apps/web/src/components/blog/post-tours.tsx` (mới, + spec), `app/(site)/blog/[slug]/page.tsx` | Khối "Tours in this story" | 5 |
| `libs/shared/i18n/src/lib/messages.ts` | `admin.posts` (Task 6), `admin.photoLibrary` (Task 7) | 6, 7 |
| `apps/admin/src/lib/nav.ts`, `nav.spec.ts`, `components/nav-main.spec.tsx` | Bật Posts; hai test đổi ví dụ mục tắt | 6 |
| `apps/admin/src/lib/posts-query.ts` (mới, + spec) | Trạng thái bảng trên URL | 6 |
| `apps/admin/src/lib/posts-view.ts` (mới, + spec) | VM hàng bảng, nhãn trạng thái, href | 6 |
| `apps/admin/src/lib/posts-write.ts` (mới, + spec) | Codec lỗi, kiểu kết quả và action, form New post | 6, 8, 12 |
| `apps/admin/src/lib/api/posts.ts` (mới) | Bọc `admin.posts.*` | 6, 8 |
| `apps/admin/src/lib/site.ts` (+ spec) | `postPageUrl` | 8 |
| `apps/admin/src/app/(admin)/posts/page.tsx`, `actions.ts` (mới) | Trang danh sách; tạo bài | 6 |
| `apps/admin/src/components/posts/posts-table.tsx` (+ spec), `posts-toolbar.tsx`, `new-post-dialog.tsx` (+ spec) (mới) | Bảng, thanh công cụ, hộp New post | 6 |
| `apps/admin/src/components/kit/photo-library-dialog.tsx` (+ spec) | Dời từ `components/tours/editor/` | 7 |
| `apps/admin/src/lib/photo-library.ts` (mới) | Kiểu lệnh tải kho ảnh, câu lỗi tải | 7 |
| `apps/admin/src/lib/tour-photos.ts`, `components/tours/editor/tour-photos-form.tsx` (+ spec), `app/(admin)/tours/[slug]/actions.ts` | Đổi đường import | 7 |
| `apps/admin/src/lib/use-versioned-form.ts` (mới), `lib/use-tour-form-state.ts` | Lõi form có phiên bản | 7 |
| `apps/admin/src/lib/post-form.ts` (mới, + spec) | Giá trị form, kiểm, payload, độ đủ, giờ UTC, ảnh bìa | 8, 10 |
| `apps/admin/src/test/post-detail.ts` (mới) | Fixture `AdminPostDetail` | 8 |
| `apps/admin/src/app/(admin)/posts/[slug]/page.tsx`, `actions.ts` (mới) | Trang sửa; bốn action | 8 |
| `apps/admin/src/components/posts/editor/post-editor.tsx` (+ spec) (mới) | Khung trang sửa, luồng Save | 8–12 |
| `apps/admin/src/components/posts/editor/post-editor-header.tsx`, `post-banner.tsx`, `post-publish-card.tsx` (+ spec) (mới) | Phần đầu, dải báo, card Publish | 8 |
| `apps/admin/src/lib/markdown-actions.ts` (mới, + spec) | `applyMarkdownAction` | 9 |
| `apps/admin/src/components/posts/editor/markdown-editor.tsx` (+ spec) (mới) | Hàng nút, Write/Preview | 9 |
| `apps/admin/src/components/posts/editor/post-cover-card.tsx` (+ spec) (mới) | Card Cover | 10 |
| `apps/admin/src/lib/post-pickers.ts` (mới, + spec) | Thêm tag, gợi ý tag, lọc tour | 11 |
| `apps/admin/src/components/posts/editor/post-tags-card.tsx`, `post-tours-card.tsx` (+ spec) (mới) | Card Tags, card Related tours | 11 |
| `apps/admin/src/components/posts/editor/delete-post-zone.tsx` (+ spec) (mới) | Vùng xoá và hộp xác nhận | 12 |
| `docs/handoff/mobile-account-handoff.md`, `docs/CHANGELOG.md`, `docs/open-items.md` | Ghi chú mobile, entry, dòng P4e, G9/G15/G16 | 14 |

Mọi file `.tsx`/`.ts` mới có spec cạnh nó trừ trang (`app/**` — Vitest của admin không quét
`src/app/**`), `posts-toolbar.tsx` (phủ qua spec của bảng) và file chỉ khai kiểu.

## Task 1 — Contract: khối `admin.posts` và luật bài viết dùng chung

**Files:**

- Create: `libs/shared/contract/src/schemas/admin-posts.ts`
- Test: `libs/shared/contract/src/schemas/admin-posts.spec.ts`
- Modify: `libs/shared/contract/src/contract.ts` (import + khối `posts` cuối `admin`)
- Modify: `libs/shared/contract/src/index.ts`

**Interfaces:**

- Produces: hằng `POST_SLUG_MAX` 80 · `POST_TITLE_MAX` 160 · `POST_EXCERPT_MAX` 300 ·
  `POST_CONTENT_MAX` 20000 · `POST_TAGS_MAX` 5 · `POST_TAG_NAME_MAX` 60 ·
  `POST_RELATED_TOURS_MAX` 3 · `POST_COVER_ALT_MAX` 300; kiểu `PostStatus`
  (`'DRAFT' | 'PUBLISHED'`), `PostDisplayStatus` (`'draft' | 'scheduled' | 'published'`),
  `PostReadinessItem` (`'content' | 'excerpt' | 'cover'`), `PostContentIssue`
  (`'image' | 'html'`), `PostCoverSource` (`'UPLOAD' | 'LIBRARY' | 'CATALOG'`),
  `AdminPostStatusFilter` (`'all' | 'published' | 'scheduled' | 'draft'`); hàm
  `postDisplayStatus(status, publishedAt: string | null, now: Date)`,
  `postReadiness({ content, excerpt, hasCover }): PostReadinessItem[]`,
  `postContentIssue(content): PostContentIssue | null`,
  `normalizePostTags(names): { slug; name }[]`; schema và kiểu `AdminPostsListQuery`,
  `AdminPostRow`, `AdminPostDetail`, `AdminPostGetInput`, `AdminPostTag`,
  `AdminPostCreateInput`, `AdminPostCreateResult`, `AdminPostCoverInput`,
  `AdminPostUpdateInput`, `AdminPostDeleteInput`, `AdminPostDeleteResult`,
  `AdminPostSignCoverUploadInput`;
  `contract.admin.posts.{list,get,create,update,delete,signCoverUpload,tags}`.

- [ ] **B1. Test trước.** Tạo `admin-posts.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contract } from '../contract.js';
import {
  AdminPostCreateInputSchema,
  AdminPostDetailSchema,
  AdminPostsListQuerySchema,
  AdminPostUpdateInputSchema,
  normalizePostTags,
  POST_CONTENT_MAX,
  POST_COVER_ALT_MAX,
  POST_EXCERPT_MAX,
  POST_RELATED_TOURS_MAX,
  POST_SLUG_MAX,
  POST_TAG_NAME_MAX,
  POST_TAGS_MAX,
  POST_TITLE_MAX,
  postContentIssue,
  postDisplayStatus,
  postReadiness,
} from './admin-posts.js';

/**
 * Contract quản trị bài viết (spec P4e-4 §2–3, ADR-0051). Mỗi trần có đúng hai ca: N
 * (qua) và N+1 (bị bắt) — trần lệch một đơn vị là thứ bảng ca này sinh ra để bắt.
 */
const ID = '11111111-1111-4111-8111-111111111111';
const VERSION = '2026-10-02T10:11:12.345Z';
const NOW = new Date('2026-10-02T12:00:00.000Z');
const tourId = (n: number) => `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;
const text = (length: number) => 'x'.repeat(length);
const many = <T>(length: number, make: (index: number) => T) =>
  Array.from({ length }, (_, index) => make(index));

const UPLOAD = { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 };
const COVER = { publicId: `tourism/posts/${ID}/cover`, alt: null };
const UPDATE = {
  id: ID,
  version: VERSION,
  title: 'Eating your way through Hội An',
  excerpt: 'Five stalls before noon.',
  content: '## Morning\n\nBánh mì first, coffee second.',
  status: 'PUBLISHED',
  publishedAt: '2026-10-01T08:00:00.000Z',
  tags: ['Food', 'Hội An'],
  relatedTourIds: [tourId(2), tourId(1)],
  cover: COVER,
};
const update = (patch: Record<string, unknown>) =>
  AdminPostUpdateInputSchema.safeParse({ ...UPDATE, ...patch });

describe('postDisplayStatus (spec §2.2)', () => {
  it('DRAFT là draft, kể cả khi còn giữ ngày đăng cũ', () => {
    expect(postDisplayStatus('DRAFT', '2026-09-01T00:00:00.000Z', NOW)).toBe('draft');
  });

  it('PUBLISHED, ngày ở tương lai là scheduled', () => {
    expect(postDisplayStatus('PUBLISHED', '2026-10-02T12:00:00.001Z', NOW)).toBe('scheduled');
  });

  it('PUBLISHED, ngày đúng bằng bây giờ là published — biên `lte` của publishedPostWhere', () => {
    expect(postDisplayStatus('PUBLISHED', '2026-10-02T12:00:00.000Z', NOW)).toBe('published');
  });

  it('PUBLISHED mà thiếu ngày là draft: web không hiện bài ấy', () => {
    expect(postDisplayStatus('PUBLISHED', null, NOW)).toBe('draft');
  });
});

describe('postReadiness (spec §2.3)', () => {
  const READY = { content: '## A\n\nB', excerpt: 'C', hasCover: true };

  it('đủ ba thứ thì rỗng', () => {
    expect(postReadiness(READY)).toEqual([]);
  });

  it('thiếu cả ba thì liệt kê đúng thứ tự form bày', () => {
    expect(postReadiness({ content: '', excerpt: null, hasCover: false })).toEqual([
      'content',
      'excerpt',
      'cover',
    ]);
  });

  it('chỉ có khoảng trắng tính là thiếu', () => {
    expect(postReadiness({ ...READY, content: ' \n\t ', excerpt: '   ' })).toEqual([
      'content',
      'excerpt',
    ]);
  });
});

describe('postContentIssue (spec §2.4)', () => {
  it.each([
    ['ảnh nhúng', 'Look ![Ha Long](https://example.com/bay.jpg) here', 'image'],
    ['thẻ mở và đóng', 'Hello <b>world</b>', 'html'],
    ['thẻ đóng đứng một mình', 'end of line</p>', 'html'],
    ['thẻ tự đóng', 'line<br/>break', 'html'],
    ['thẻ có thuộc tính', '<a href="https://example.com">x</a>', 'html'],
    ['chú thích HTML', 'a <!-- note --> b', 'html'],
  ])('bắt %s', (_, content, issue) => {
    expect(postContentIssue(content)).toBe(issue);
  });

  it.each([
    ['dấu < đứng một mình', 'a < b and c > d'],
    ['"<3"', 'we <3 pho'],
    ['autolink', 'see <https://example.com>'],
    ['link markdown', 'see [the map](https://example.com)'],
    ['đậm và nghiêng', '**bold** and *italic*'],
  ])('cho qua %s', (_, content) => {
    expect(postContentIssue(content)).toBeNull();
  });
});

describe('normalizePostTags (spec §2.5)', () => {
  it('trim, bỏ trùng theo slug và giữ cách viết của lần đầu', () => {
    expect(normalizePostTags(['Hội An', ' Hoi An ', 'Food'])).toEqual([
      { slug: 'hoi-an', name: 'Hội An' },
      { slug: 'food', name: 'Food' },
    ]);
  });

  it('bỏ tên rỗng và tên chỉ có ký hiệu', () => {
    expect(normalizePostTags(['', '!!!', 'Food'])).toEqual([{ slug: 'food', name: 'Food' }]);
  });
});

describe('AdminPostUpdateInputSchema (spec §3.2)', () => {
  it('nhận một lần lưu đủ trường; tóm tắt chỉ có khoảng trắng thành null', () => {
    const parsed = update({ excerpt: '   ' });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.excerpt).toBeNull();
  });

  it('PUBLISHED phải có ngày đăng; DRAFT thì không', () => {
    const missing = update({ publishedAt: null });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(['publishedAt']);
    expect(update({ status: 'DRAFT', publishedAt: null }).success).toBe(true);
  });

  it.each([
    ['tiêu đề', { title: text(POST_TITLE_MAX) }, { title: text(POST_TITLE_MAX + 1) }],
    ['tóm tắt', { excerpt: text(POST_EXCERPT_MAX) }, { excerpt: text(POST_EXCERPT_MAX + 1) }],
    ['thân bài', { content: text(POST_CONTENT_MAX) }, { content: text(POST_CONTENT_MAX + 1) }],
    [
      'số tag',
      { tags: many(POST_TAGS_MAX, (i) => `Tag ${i}`) },
      { tags: many(POST_TAGS_MAX + 1, (i) => `Tag ${i}`) },
    ],
    ['tên tag', { tags: [text(POST_TAG_NAME_MAX)] }, { tags: [text(POST_TAG_NAME_MAX + 1)] }],
    [
      'số tour',
      { relatedTourIds: many(POST_RELATED_TOURS_MAX, tourId) },
      { relatedTourIds: many(POST_RELATED_TOURS_MAX + 1, tourId) },
    ],
    [
      'alt ảnh bìa',
      { cover: { ...COVER, alt: text(POST_COVER_ALT_MAX) } },
      { cover: { ...COVER, alt: text(POST_COVER_ALT_MAX + 1) } },
    ],
  ])('trần %s: N qua, N+1 bị bắt', (_, atMax, overMax) => {
    expect(update(atMax).success).toBe(true);
    expect(update(overMax).success).toBe(false);
  });

  it('một tour chỉ được có mặt một lần', () => {
    expect(update({ relatedTourIds: [tourId(1), tourId(1)] }).success).toBe(false);
  });

  it('tag chỉ có ký hiệu bị bắt', () => {
    expect(update({ tags: ['!!!'] }).success).toBe(false);
  });

  it('thân bài có ảnh nhúng hay HTML thô bị bắt', () => {
    expect(update({ content: '![x](https://example.com/x.jpg)' }).success).toBe(false);
    expect(update({ content: '<div>x</div>' }).success).toBe(false);
  });

  it('ảnh bìa mới tải mang metadata Cloudinary; cột INT4 không nhận số vượt 2^31', () => {
    expect(update({ cover: { ...COVER, upload: UPLOAD } }).success).toBe(true);
    expect(
      update({ cover: { ...COVER, upload: { ...UPLOAD, width: 2_147_483_648 } } }).success,
    ).toBe(false);
  });

  it('nháp không ảnh bìa gửi `cover: null`', () => {
    expect(update({ status: 'DRAFT', cover: null }).success).toBe(true);
  });
});

describe('AdminPostCreateInputSchema (spec §2.1)', () => {
  it('slug: trần 80 và đúng hình dạng', () => {
    const create = (slug: string) => AdminPostCreateInputSchema.safeParse({ title: 'A', slug });
    expect(create(text(POST_SLUG_MAX)).success).toBe(true);
    expect(create(text(POST_SLUG_MAX + 1)).success).toBe(false);
    expect(create('Bad Slug').success).toBe(false);
  });
});

describe('AdminPostsListQuerySchema', () => {
  it('mặc định: mọi trạng thái, trang 1, 20 dòng', () => {
    expect(AdminPostsListQuerySchema.parse({})).toEqual({ page: 1, limit: 20, status: 'all' });
  });

  it('trạng thái lạ bị bắt', () => {
    expect(AdminPostsListQuerySchema.safeParse({ status: 'archived' }).success).toBe(false);
  });
});

describe('AdminPostDetailSchema', () => {
  it('nhận bài không ảnh bìa, tác giả không tên', () => {
    const detail = {
      id: ID,
      slug: 'a',
      title: 'A',
      excerpt: null,
      content: '',
      status: 'DRAFT',
      publishedAt: null,
      displayStatus: 'draft',
      readiness: ['content', 'excerpt', 'cover'],
      tags: [],
      relatedTours: [],
      cover: null,
      author: { name: null },
      version: VERSION,
      createdAt: VERSION,
    };
    expect(AdminPostDetailSchema.safeParse(detail).success).toBe(true);
  });
});

describe('contract.admin.posts (spec §3.1)', () => {
  type Procedure = { '~orpc': { errorMap?: object } };
  const codes = (procedure: Procedure) => Object.keys(procedure['~orpc'].errorMap ?? {}).sort();
  const status = (procedure: Procedure, code: string) =>
    (procedure['~orpc'].errorMap as Record<string, { status?: number }> | undefined)?.[code]
      ?.status;
  const p = contract.admin.posts;

  it('route của bảy thao tác', () => {
    expect(p.list['~orpc'].route).toMatchObject({ method: 'GET', path: '/api/admin/posts' });
    expect(p.get['~orpc'].route).toMatchObject({ method: 'GET', path: '/api/admin/posts/{slug}' });
    expect(p.create['~orpc'].route).toMatchObject({ method: 'POST', path: '/api/admin/posts' });
    expect(p.update['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/api/admin/posts/{id}',
    });
    expect(p.delete['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/api/admin/posts/{id}/delete',
    });
    expect(p.signCoverUpload['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/api/admin/posts/{id}/cover-upload',
    });
    expect(p.tags['~orpc'].route).toMatchObject({ method: 'GET', path: '/api/admin/post-tags' });
  });

  it('mỗi thao tác khai ĐÚNG tập mã của spec', () => {
    expect(codes(p.list)).toEqual([]);
    expect(codes(p.get)).toEqual(['NOT_FOUND']);
    expect(codes(p.create)).toEqual(['SLUG_TAKEN']);
    expect(codes(p.update)).toEqual([
      'NOT_FOUND',
      'PHOTO_NOT_ALLOWED',
      'POST_NOT_READY',
      'RELATED_TOUR_NOT_FOUND',
      'STALE_POST',
    ]);
    expect(codes(p.delete)).toEqual(['NOT_FOUND', 'STALE_POST']);
    expect(codes(p.signCoverUpload)).toEqual(['MEDIA_UPLOAD_NOT_CONFIGURED', 'NOT_FOUND']);
    expect(codes(p.tags)).toEqual([]);
  });

  it('status của từng mã như spec §3.2', () => {
    expect(status(p.update, 'STALE_POST')).toBe(409);
    expect(status(p.update, 'POST_NOT_READY')).toBe(409);
    expect(status(p.update, 'PHOTO_NOT_ALLOWED')).toBe(400);
    expect(status(p.update, 'RELATED_TOUR_NOT_FOUND')).toBe(404);
    expect(status(p.create, 'SLUG_TAKEN')).toBe(409);
    expect(status(p.signCoverUpload, 'MEDIA_UPLOAD_NOT_CONFIGURED')).toBe(503);
  });
});
```

- [ ] **B2.** `pnpm --filter @tourism/contract exec vitest run src/schemas/admin-posts.spec.ts`
  — ĐỎ vì chưa có module `./admin-posts.js`.

- [ ] **B3. Cài.** Tạo `admin-posts.ts`:

```ts
import { z } from 'zod';
import { TourPhotoUploadSchema } from './admin-tours.js';
import { AdminPageQuerySchema, descriptionSchema } from './common.js';
import { MediaPublicIdSchema } from './media.js';
import { slugifyVietnamese, slugSchema } from './slug.js';

/**
 * Quản trị bài viết (spec P4e-4, ADR-0051) — bảy thao tác của `admin.posts.*` cộng ba
 * hàm thuần mà API và admin cùng gọi: trạng thái hiển thị, độ đủ để đăng, luật nội dung.
 * Một bản cho cả hai đầu nên form không thể cho qua thứ server sẽ chặn.
 *
 * Trần của từng field gương cột DB (spec §2). Export để admin đếm ký tự bằng CHÍNH các
 * con số này.
 */
export const POST_SLUG_MAX = 80;
export const POST_TITLE_MAX = 160;
export const POST_EXCERPT_MAX = 300;
/** Bài seed dài nhất chưa tới 5000 ký tự; trần chặn dán nhầm cả một file. */
export const POST_CONTENT_MAX = 20_000;
export const POST_TAGS_MAX = 5;
/** Cột `post_tags.name` và `post_tags.slug` đều `VarChar(60)`. */
export const POST_TAG_NAME_MAX = 60;
export const POST_RELATED_TOURS_MAX = 3;
/** Cột `media_assets.alt VarChar(300)` — cùng cột với alt của ảnh tour. */
export const POST_COVER_ALT_MAX = 300;

/** Phiên bản = `updatedAt` dạng ISO có mili-giây (ADR-0051 §2, khuôn ADR-0047 §3). */
const VersionSchema = z.iso.datetime();
const TitleSchema = z.string().trim().min(1).max(POST_TITLE_MAX);

export const PostSlugSchema = slugSchema(POST_SLUG_MAX);

/** Hai giá trị lưu ở DB. Lịch hẹn nằm ở `publishedAt`, không ở đây (ADR-0051 §3). */
export const PostStatusSchema = z.enum(['DRAFT', 'PUBLISHED']);
export type PostStatus = z.output<typeof PostStatusSchema>;

/** Ba trạng thái HIỂN THỊ của admin — suy ra, không lưu. */
export const PostDisplayStatusSchema = z.enum(['draft', 'scheduled', 'published']);
export type PostDisplayStatus = z.output<typeof PostDisplayStatusSchema>;

/**
 * Trạng thái hiển thị — MỘT hàm cho chip của admin và bộ lọc của API (spec §2.2).
 *
 * PUBLISHED mà thiếu `publishedAt` là `draft`: web không hiện bài ấy
 * (`publishedPostWhere` đòi `publishedAt <= now`), nên gọi nó "đã đăng" là nói sai. Đường
 * ghi không tạo được trạng thái ấy (refine của `AdminPostUpdateInputSchema`); nó chỉ có
 * khi ai đó sửa tay DB.
 */
export function postDisplayStatus(
  status: PostStatus,
  publishedAt: string | null,
  now: Date,
): PostDisplayStatus {
  if (status === 'DRAFT' || publishedAt === null) return 'draft';
  return Date.parse(publishedAt) > now.getTime() ? 'scheduled' : 'published';
}

/** Ba thứ card trên `/blog` và trang chủ cần (ADR-0051 §4), theo thứ tự form bày. */
export const PostReadinessItemSchema = z.enum(['content', 'excerpt', 'cover']);
export type PostReadinessItem = z.output<typeof PostReadinessItemSchema>;

/** Các mục CÒN THIẾU để đăng — rỗng là đủ. Chỉ có khoảng trắng tính là chưa viết. */
export function postReadiness(post: {
  content: string;
  excerpt: string | null;
  hasCover: boolean;
}): PostReadinessItem[] {
  const missing: PostReadinessItem[] = [];
  if (post.content.trim() === '') missing.push('content');
  if ((post.excerpt ?? '').trim() === '') missing.push('excerpt');
  if (!post.hasCover) missing.push('cover');
  return missing;
}

/** Ảnh nhúng `![…](…)` — ngoài phạm vi (spec §2.4): cần CSP, vòng đời media, parser mobile. */
const EMBEDDED_IMAGE = /!\[[^\]]*\]\([^)]*\)/;
/**
 * Thẻ HTML thô: `<tên …>`, `</tên>`, `<tên/>` và chú thích `<!--`. Tên thẻ phải mở đầu
 * bằng chữ cái nên "a < b" và "<3" lọt qua; autolink `<https://…>` cũng lọt, vì sau tên
 * thẻ chỉ được là khoảng trắng, `/` hay `>`. Bắt cả trong khối code — bài du lịch không có
 * code, luật đơn giản đáng hơn một parser.
 */
const RAW_HTML = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>|<!--/;

export type PostContentIssue = 'image' | 'html';

/** Chỗ sai ĐẦU TIÊN của thân bài, hoặc `null`. Form admin và refine của contract cùng gọi. */
export function postContentIssue(content: string): PostContentIssue | null {
  if (EMBEDDED_IMAGE.test(content)) return 'image';
  if (RAW_HTML.test(content)) return 'html';
  return null;
}

export const PostContentSchema = z
  .string()
  .max(POST_CONTENT_MAX)
  .refine((content) => postContentIssue(content) !== 'image', {
    message: 'images inside the post body are not supported',
  })
  .refine((content) => postContentIssue(content) !== 'html', {
    message: 'raw HTML is not allowed in the post body',
  });

/**
 * Chuẩn hoá danh sách tên tag (spec §2.5): trim, slug sinh bằng `slugifyVietnamese`, bỏ
 * trùng THEO SLUG và giữ lần đầu — "Hội An" và "Hoi An" là một tag. Tên rỗng hay chỉ có
 * ký hiệu (slug rỗng) bị bỏ; schema đã từ chối chúng trước khi tới API.
 */
export function normalizePostTags(names: readonly string[]): { slug: string; name: string }[] {
  const seen = new Set<string>();
  const tags: { slug: string; name: string }[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const slug = slugifyVietnamese(name, POST_TAG_NAME_MAX);
    if (slug === '' || seen.has(slug)) continue;
    seen.add(slug);
    tags.push({ slug, name });
  }
  return tags;
}

const PostTagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(POST_TAG_NAME_MAX)
  .refine((name) => slugifyVietnamese(name, POST_TAG_NAME_MAX) !== '', {
    message: 'a tag needs at least one letter or digit',
  });

const PostTagRefSchema = z.object({ slug: z.string(), name: z.string() });

// ── Đọc ─────────────────────────────────────────────────────────────────────

export const AdminPostStatusFilterSchema = z.enum(['all', 'published', 'scheduled', 'draft']);
export type AdminPostStatusFilter = z.output<typeof AdminPostStatusFilterSchema>;

/** Phân trang dùng chung `AdminPageQuerySchema` (`page`/`limit`) như mọi bảng admin. */
export const AdminPostsListQuerySchema = AdminPageQuerySchema.extend({
  status: AdminPostStatusFilterSchema.default('all'),
  /** Tìm theo tiêu đề, không phân biệt hoa thường. */
  search: z.string().trim().max(POST_TITLE_MAX).optional(),
});
export type AdminPostsListQuery = z.output<typeof AdminPostsListQuerySchema>;

export const AdminPostRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  status: PostStatusSchema,
  publishedAt: z.iso.datetime().nullable(),
  displayStatus: PostDisplayStatusSchema,
  coverUrl: z.url().nullable(),
  tags: z.array(PostTagRefSchema),
  updatedAt: z.iso.datetime(),
});
export type AdminPostRow = z.output<typeof AdminPostRowSchema>;

/**
 * Nguồn của ảnh bìa — như ảnh tour (ADR-0048 AMEND 1): `UPLOAD` là thư mục tải lên của
 * chính bài, `LIBRARY` là ảnh có dòng thư viện địa danh, `CATALOG` là ảnh còn lại (ảnh bìa
 * của bài seed) — gỡ ra thì không chọn lại được.
 */
export const PostCoverSourceSchema = z.enum(['UPLOAD', 'LIBRARY', 'CATALOG']);
export type PostCoverSource = z.output<typeof PostCoverSourceSchema>;

export const AdminPostDetailSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string().nullable(),
  content: z.string(),
  status: PostStatusSchema,
  publishedAt: z.iso.datetime().nullable(),
  displayStatus: PostDisplayStatusSchema,
  /** Các mục còn thiếu để đăng (`postReadiness`) — rỗng là đủ. */
  readiness: z.array(PostReadinessItemSchema),
  tags: z.array(PostTagRefSchema),
  /** Theo thứ tự lưu (`post_tours.order`); có cả tour đang tắt bán. */
  relatedTours: z.array(
    z.object({ id: z.uuid(), slug: z.string(), title: z.string(), isPublished: z.boolean() }),
  ),
  cover: z
    .object({
      publicId: z.string(),
      url: z.url(),
      alt: z.string().nullable(),
      source: PostCoverSourceSchema,
    })
    .nullable(),
  /** `posts.author_id` NOT NULL, khoá ngoại `Restrict` — tác giả luôn có, chỉ tên có thể trống. */
  author: z.object({ name: z.string().nullable() }),
  version: VersionSchema,
  createdAt: z.iso.datetime(),
});
export type AdminPostDetail = z.output<typeof AdminPostDetailSchema>;

export const AdminPostGetInputSchema = z.object({ slug: z.string().min(1).max(POST_SLUG_MAX) });
export type AdminPostGetInput = z.output<typeof AdminPostGetInputSchema>;

/** Một tag kèm số bài dùng nó, CẢ nháp — nguồn gợi ý của ô Tags. */
export const AdminPostTagSchema = PostTagRefSchema.extend({ count: z.int().nonnegative() });
export type AdminPostTag = z.output<typeof AdminPostTagSchema>;

// ── Ghi ─────────────────────────────────────────────────────────────────────

/** Hộp New post (spec §4.3) — bài sinh ra là nháp, thân bài rỗng. */
export const AdminPostCreateInputSchema = z.object({ title: TitleSchema, slug: PostSlugSchema });
export type AdminPostCreateInput = z.output<typeof AdminPostCreateInputSchema>;

export const AdminPostCreateResultSchema = z.object({ id: z.uuid(), slug: z.string() });
export type AdminPostCreateResult = z.output<typeof AdminPostCreateResultSchema>;

export const AdminPostCoverInputSchema = z.object({
  publicId: MediaPublicIdSchema,
  /** Tuỳ chọn: trống là ảnh trang trí — web vẽ `alt=""`, tiêu đề bài in ngay cạnh ảnh. */
  alt: descriptionSchema(POST_COVER_ALT_MAX),
  /** Metadata Cloudinary của ảnh MỚI tải (ADR-0048 §5) — cùng hình với ảnh tour. */
  upload: TourPhotoUploadSchema.optional(),
});
export type AdminPostCoverInput = z.output<typeof AdminPostCoverInputSchema>;

/**
 * MỘT lệnh cho cả form (spec §3.2): tag, tour liên quan và ảnh bìa thay trọn. Không có
 * `slug` — slug đặt một lần lúc tạo (ADR-0051 §2); Zod bỏ field lạ nên gửi thừa cũng không
 * đổi được gì.
 */
export const AdminPostUpdateInputSchema = z
  .object({
    id: z.uuid(),
    version: VersionSchema,
    title: TitleSchema,
    excerpt: descriptionSchema(POST_EXCERPT_MAX),
    content: PostContentSchema,
    status: PostStatusSchema,
    publishedAt: z.iso.datetime().nullable(),
    tags: z.array(PostTagNameSchema).max(POST_TAGS_MAX),
    relatedTourIds: z
      .array(z.uuid())
      .max(POST_RELATED_TOURS_MAX)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'a tour can only be listed once',
      }),
    cover: AdminPostCoverInputSchema.nullable(),
  })
  .refine((input) => input.status === 'DRAFT' || input.publishedAt !== null, {
    message: 'a published post needs a publish date',
    path: ['publishedAt'],
  });
export type AdminPostUpdateInput = z.output<typeof AdminPostUpdateInputSchema>;

export const AdminPostDeleteInputSchema = z.object({ id: z.uuid(), version: VersionSchema });
export type AdminPostDeleteInput = z.output<typeof AdminPostDeleteInputSchema>;

export const AdminPostDeleteResultSchema = z.object({ slug: z.string() });
export type AdminPostDeleteResult = z.output<typeof AdminPostDeleteResultSchema>;

export const AdminPostSignCoverUploadInputSchema = z.object({ id: z.uuid() });
export type AdminPostSignCoverUploadInput = z.output<typeof AdminPostSignCoverUploadInputSchema>;
```

- [ ] **B4.** `index.ts`: thêm `export * from './schemas/admin-posts.js';` ngay sau dòng
  `export * from './schemas/admin-destinations.js';`.

- [ ] **B5.** `contract.ts`: thêm khối import ngay sau khối import của
  `./schemas/admin-destinations.js`:

```ts
import {
  AdminPostCreateInputSchema,
  AdminPostCreateResultSchema,
  AdminPostDeleteInputSchema,
  AdminPostDeleteResultSchema,
  AdminPostDetailSchema,
  AdminPostGetInputSchema,
  AdminPostRowSchema,
  AdminPostSignCoverUploadInputSchema,
  AdminPostsListQuerySchema,
  AdminPostTagSchema,
  AdminPostUpdateInputSchema,
} from './schemas/admin-posts.js';
```

  rồi chèn khối `posts` ngay sau dấu `},` đóng khối `departures` — khối CUỐI của `admin`,
  ngay trước hai dòng `  },` và `};` ở cuối file:

```ts
    /**
     * Bài viết phía admin (spec P4e-4, ADR-0051). Đọc theo slug, ghi theo `id` kèm
     * `version` (`updatedAt`) — slug đặt một lần lúc tạo. `update` là MỘT lệnh cho cả
     * form: thay trọn tag, tour liên quan và ảnh bìa.
     *
     * Bust cache web (`posts` + `post:<slug>`) SAU commit của `update` và `delete`;
     * `create` sinh nháp nên web không có gì để bust. Guard `AuthGuard` + `@Roles(ADMIN)`
     * ở controller như mọi endpoint admin; mọi lệnh ghi là `POST` (CORS chỉ mở GET/POST).
     */
    posts: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/admin/posts',
          summary: 'List every post (admin, paged, status and title filters)',
        })
        .input(AdminPostsListQuerySchema)
        .output(PagedSchema(AdminPostRowSchema)),
      get: oc
        .route({
          method: 'GET',
          path: '/api/admin/posts/{slug}',
          summary: 'One post with everything the editor needs — drafts and scheduled posts too',
        })
        .input(AdminPostGetInputSchema)
        .errors({ NOT_FOUND: { status: 404, message: 'Post not found' } })
        .output(AdminPostDetailSchema),
      create: oc
        .route({
          method: 'POST',
          path: '/api/admin/posts',
          summary: 'Create a post — it starts as a draft',
        })
        .input(AdminPostCreateInputSchema)
        .errors({ SLUG_TAKEN: { status: 409, message: 'Another post already uses this slug' } })
        .output(AdminPostCreateResultSchema),
      update: oc
        .route({
          method: 'POST',
          path: '/api/admin/posts/{id}',
          summary: 'Save the whole post form: text, status, tags, related tours and cover',
        })
        .input(AdminPostUpdateInputSchema)
        .errors({
          STALE_POST: { status: 409, message: 'This post changed since it was opened' },
          POST_NOT_READY: {
            status: 409,
            message: 'A published post needs content, an excerpt and a cover photo',
          },
          PHOTO_NOT_ALLOWED: {
            status: 400,
            message: 'The cover is not from this post, its uploads or the destination library',
          },
          RELATED_TOUR_NOT_FOUND: { status: 404, message: 'A related tour no longer exists' },
          NOT_FOUND: { status: 404, message: 'Post not found' },
        })
        .output(AdminPostDetailSchema),
      delete: oc
        .route({
          method: 'POST',
          path: '/api/admin/posts/{id}/delete',
          summary: 'Delete a post with its tag links, tour links and media rows',
        })
        .input(AdminPostDeleteInputSchema)
        .errors({
          STALE_POST: { status: 409, message: 'This post changed since it was opened' },
          NOT_FOUND: { status: 404, message: 'Post not found' },
        })
        .output(AdminPostDeleteResultSchema),
      signCoverUpload: oc
        .route({
          method: 'POST',
          path: '/api/admin/posts/{id}/cover-upload',
          summary: 'Sign one direct-to-Cloudinary upload for the cover of a post',
        })
        .input(AdminPostSignCoverUploadInputSchema)
        .errors({
          // 503 chứ không 500: thiếu cặp khoá là trạng thái cấu hình hợp lệ (ADR-0021 §6).
          MEDIA_UPLOAD_NOT_CONFIGURED: { status: 503, message: 'Uploads are not configured' },
          NOT_FOUND: { status: 404, message: 'Post not found' },
        })
        .output(SignedUploadParamsSchema),
      // Route KHÔNG nằm dưới `/api/admin/posts/…`: `GET /api/admin/posts/{slug}` sẽ nuốt
      // nó, và một bài có slug `tags` là hợp lệ.
      tags: oc
        .route({
          method: 'GET',
          path: '/api/admin/post-tags',
          summary: 'Every post tag with how many posts use it, drafts included',
        })
        .output(z.array(AdminPostTagSchema)),
    },
```

- [ ] **B6.** Chạy lại spec — XANH. **Đột biến** (mỗi cái một lần, thấy đỏ, trả lại):
  `>` thành `>=` trong `postDisplayStatus`; bỏ vế `publishedAt === null`; bỏ `.trim()` của
  `content` trong `postReadiness`; bỏ `\/?` đầu `RAW_HTML`; bỏ `|<!--`; đổi
  `(?:\s[^<>]*)?` thành `[^>]*` (ca autolink phải đỏ); `seen.has(slug)` thành
  `seen.has(name)`; bỏ refine của `relatedTourIds`; đổi vế refine cuối thành
  `input.publishedAt !== null` (ca DRAFT phải đỏ); đổi status `PHOTO_NOT_ALLOWED` thành 409.
- [ ] **B7.** Build contract (lệnh ở Ràng buộc toàn cục), Quy trình gate, rồi commit:
  `feat(contract): khối admin.posts và luật bài viết dùng chung`

## Task 2 — API: đọc, tạo bài, danh sách tag

**Files:**

- Modify: `apps/api/src/lib/upload-signing.ts` + `upload-signing.spec.ts`
- Create: `apps/api/src/modules/posts/admin-post-errors.ts`
- Create: `apps/api/src/modules/posts/admin-post-rules.ts` + `admin-post-rules.spec.ts`
- Create: `apps/api/src/modules/posts/admin-posts.service.ts`
- Create: `apps/api/src/modules/posts/admin-posts.controller.ts`
- Modify: `apps/api/src/modules/posts/posts.module.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.service.ts` (một chữ `export`)
- Create: `apps/api/src/modules/posts/admin-posts.int.spec.ts`

**Interfaces:**

- Consumes: mọi thứ của Task 1.
- Produces: `postCoverFolder(root, postId)`, `isPostUploadPublicId(root, postId, publicId)`;
  bảy lớp lỗi `AdminPostNotFoundError(ref)`, `PostSlugTakenError(slug)`, `StalePostError()`,
  `PostNotReadyError(missing)`, `PostPhotoNotAllowedError(publicId)`,
  `RelatedTourNotFoundError()`, `PostCoverUploadsNotConfiguredError()`;
  `postStatusWhere(filter, now)`, `ADMIN_POST_ROW_SELECT`, `ADMIN_POST_SELECT`,
  `AdminPostRowRecord`, `AdminPostRecord`, `toAdminPostRow(row, coverUrl, now)`,
  `toAdminPostDetail(row, cover, now)`, `ResolvedCover`,
  `coverSource(publicId, { rootFolder, postId, inLibrary })`;
  `AdminPostsService.{list, get, create, tags}` cùng `private toDetail(row, now)`;
  `LIBRARY_PHOTO` export từ `admin-tours.service.ts`.

- [ ] **B1. Test trước — thư mục ảnh bìa.** Trong `upload-signing.spec.ts`, thêm
  `isPostUploadPublicId` và `postCoverFolder` vào khối import, rồi thêm cuối file:

```ts
describe('postCoverFolder / isPostUploadPublicId (ADR-0051 §7)', () => {
  const POST = '0199a000-0000-7000-8000-000000000001';

  it('thư mục ảnh bìa của một bài nằm dưới <root>/posts/<postId>', () => {
    expect(postCoverFolder('tourism', POST)).toBe(`tourism/posts/${POST}`);
  });

  it('chỉ ảnh trong ĐÚNG thư mục của bài — so theo tiền tố có `/` chốt đuôi', () => {
    expect(isPostUploadPublicId('tourism', POST, `tourism/posts/${POST}/abc`)).toBe(true);
    expect(isPostUploadPublicId('tourism', POST, `tourism/posts/${POST}-evil/abc`)).toBe(false);
    expect(isPostUploadPublicId('tourism', POST, `tourism/tours/${POST}/abc`)).toBe(false);
    expect(isPostUploadPublicId('tourism', POST, `tourism/posts/${POST}`)).toBe(false);
  });
});
```

  `pnpm --filter @tourism/api exec vitest run src/lib/upload-signing.spec.ts` — ĐỎ. Cài
  ngay sau `isTourUploadPublicId` trong `upload-signing.ts`:

```ts
/** Thư mục ảnh bìa admin tải lên cho MỘT bài viết (ADR-0051 §7) — server quyết, client không chọn. */
export function postCoverFolder(rootFolder: string, postId: string): string {
  return `${rootFolder}/posts/${postId}`;
}

/**
 * publicId có nằm trong thư mục tải lên của ĐÚNG bài này không — so theo tiền tố có `/`
 * chốt đuôi, cùng nếp `isTourUploadPublicId`. Chỉ ảnh khớp ở đây mới vào lại hàng dọn khi
 * bị thay hay khi bài bị xoá; ảnh thư viện và ảnh catalog thì không bao giờ.
 */
export function isPostUploadPublicId(
  rootFolder: string,
  postId: string,
  publicId: string,
): boolean {
  return publicId.startsWith(`${postCoverFolder(rootFolder, postId)}/`);
}
```

  Chạy lại — XANH. Đột biến: bỏ `/` chốt đuôi (ca `-evil` phải đỏ).

- [ ] **B2. Lỗi.** Tạo `admin-post-errors.ts`:

```ts
import type { PostReadinessItem } from '@tourism/contract';
import { ContractError } from '../../lib/contract-error.js';

/**
 * Lỗi nghiệp vụ của quản trị bài viết (spec P4e-4 §3). Controller đổi chúng thành lỗi
 * contract bằng `toContractError` — chỉ mã mà procedure KHAI mới đi qua.
 *
 * Tên có tiền tố riêng như lỗi của khu làm việc tour: repo có nhiều lớp
 * `…NotFoundError` ở nhiều module (bài học vòng hai F12).
 */

export class AdminPostNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor(ref: string) {
    super('NOT_FOUND', `Post not found: ${ref}`, false);
  }
}

/** Slug đã có bài khác dùng. 409: input đúng, thế giới đã đổi. */
export class PostSlugTakenError extends ContractError<'SLUG_TAKEN'> {
  constructor(slug: string) {
    super('SLUG_TAKEN', `Another post already uses the slug ${slug}`);
  }
}

/** Phiên bản trong form không còn khớp hàng bài viết (ADR-0051 §2). */
export class StalePostError extends ContractError<'STALE_POST'> {
  constructor() {
    super('STALE_POST', 'This post changed since it was opened.');
  }
}

/**
 * Bài đăng thiếu thứ card cần (ADR-0051 §4). Câu liệt kê chỗ thiếu để API đọc được một
 * mình; admin tự dựng câu của nó từ `postReadiness`.
 */
export class PostNotReadyError extends ContractError<'POST_NOT_READY'> {
  constructor(readonly missing: readonly PostReadinessItem[]) {
    super('POST_NOT_READY', `This post is missing: ${missing.join(', ')}.`);
  }
}

/**
 * Ảnh bìa không thuộc nguồn nào trong ba (spec §3.2). 400: client đúng không bao giờ gửi
 * — nhưng chuỗi này là đối số của lệnh destroy sau này, nên từ chối cả lệnh.
 */
export class PostPhotoNotAllowedError extends ContractError<'PHOTO_NOT_ALLOWED'> {
  constructor(publicId: string) {
    super('PHOTO_NOT_ALLOWED', `Cover not allowed for this post: ${publicId}`, false);
  }
}

/** Khoá ngoại `post_tours.tour_id` hỏng ngay ở câu ghi (`P2003`). */
export class RelatedTourNotFoundError extends ContractError<'RELATED_TOUR_NOT_FOUND'> {
  constructor() {
    super('RELATED_TOUR_NOT_FOUND', 'A related tour no longer exists', false);
  }
}

/** Thiếu cặp khoá Cloudinary — trạng thái cấu hình hợp lệ (ADR-0021 §6), 503. */
export class PostCoverUploadsNotConfiguredError extends ContractError<'MEDIA_UPLOAD_NOT_CONFIGURED'> {
  constructor() {
    super('MEDIA_UPLOAD_NOT_CONFIGURED', 'Uploads are not configured', false);
  }
}
```

- [ ] **B3. Test trước — luật thuần.** Tạo `admin-post-rules.spec.ts`:

```ts
import { AdminPostDetailSchema, AdminPostRowSchema, type MediaItem } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { PostStatus } from '../../generated/prisma/enums.js';
import {
  type AdminPostRecord,
  coverSource,
  postStatusWhere,
  toAdminPostDetail,
  toAdminPostRow,
} from './admin-post-rules.js';
import { publishedPostWhere } from './published-post.where.js';

const NOW = new Date('2026-10-02T12:00:00.000Z');
const ROOT = 'tourism';
const POST_ID = '0199a000-0000-7000-8000-000000000001';

/** Ngày đăng ở TƯƠNG LAI, hai tour theo thứ tự KHÁC thứ tự id — bắt mapper lười. */
const RECORD: AdminPostRecord = {
  id: POST_ID,
  slug: 'eating-your-way-through-hoi-an',
  title: 'Eating your way through Hội An',
  status: PostStatus.PUBLISHED,
  publishedAt: new Date('2026-10-03T08:00:00.000Z'),
  updatedAt: new Date('2026-10-02T10:11:12.345Z'),
  tags: [{ tag: { slug: 'food', name: 'Food' } }],
  excerpt: 'Five stalls before noon.',
  content: '## Morning',
  createdAt: new Date('2026-09-30T00:00:00.000Z'),
  author: { name: null },
  relatedTours: [
    { tour: { id: '0199a000-0000-7000-8000-0000000000b2', slug: 'b', title: 'B', isPublished: false } },
    { tour: { id: '0199a000-0000-7000-8000-0000000000a1', slug: 'a', title: 'A', isPublished: true } },
  ],
};

const ITEM: MediaItem = {
  publicId: `${ROOT}/posts/${POST_ID}/cover`,
  url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/${ROOT}/posts/${POST_ID}/cover`,
  type: 'IMAGE',
  role: 'hero',
  posterUrl: null,
  width: 2000,
  height: 1333,
  alt: null,
  sortOrder: 0,
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
};

describe('postStatusWhere — cùng luật với postDisplayStatus', () => {
  it('published chính là publishedPostWhere: tab liệt kê đúng những bài web đang hiện', () => {
    expect(postStatusWhere('published', NOW)).toEqual(publishedPostWhere(NOW));
  });

  it('scheduled: PUBLISHED, ngày SAU bây giờ', () => {
    expect(postStatusWhere('scheduled', NOW)).toEqual({
      status: PostStatus.PUBLISHED,
      publishedAt: { gt: NOW },
    });
  });

  it('draft gồm cả bài PUBLISHED thiếu ngày (Quyết định 17)', () => {
    expect(postStatusWhere('draft', NOW)).toEqual({
      OR: [{ status: PostStatus.DRAFT }, { publishedAt: null }],
    });
  });

  it('all không lọc', () => {
    expect(postStatusWhere('all', NOW)).toEqual({});
  });
});

describe('toAdminPostRow / toAdminPostDetail', () => {
  it('hàng bảng khớp contract, trạng thái hiển thị tính theo `now`', () => {
    const row = toAdminPostRow(RECORD, ITEM.url, NOW);
    expect(AdminPostRowSchema.parse(row)).toEqual(row);
    expect(row.displayStatus).toBe('scheduled');
    expect(row.coverUrl).toBe(ITEM.url);
  });

  it('chi tiết: phiên bản là updatedAt, tour giữ thứ tự lưu, tác giả không tên vẫn là object', () => {
    const detail = toAdminPostDetail(RECORD, { item: ITEM, source: 'UPLOAD' }, NOW);
    expect(AdminPostDetailSchema.parse(detail)).toEqual(detail);
    expect(detail.version).toBe('2026-10-02T10:11:12.345Z');
    expect(detail.relatedTours.map((tour) => tour.slug)).toEqual(['b', 'a']);
    expect(detail.author).toEqual({ name: null });
    expect(detail.cover).toEqual({
      publicId: ITEM.publicId,
      url: ITEM.url,
      alt: null,
      source: 'UPLOAD',
    });
    expect(detail.readiness).toEqual([]);
  });

  it('không ảnh bìa thì readiness thiếu cover', () => {
    expect(toAdminPostDetail(RECORD, null, NOW).readiness).toEqual(['cover']);
  });
});

describe('coverSource', () => {
  const at = (publicId: string, inLibrary: boolean) =>
    coverSource(publicId, { rootFolder: ROOT, postId: POST_ID, inLibrary });

  it('thư mục tải lên của chính bài là UPLOAD, kể cả khi có dòng thư viện trùng', () => {
    expect(at(`${ROOT}/posts/${POST_ID}/x`, true)).toBe('UPLOAD');
  });

  it('có dòng thư viện là LIBRARY; còn lại là CATALOG', () => {
    expect(at(`${ROOT}/catalog/destination/hoi-an/1`, true)).toBe('LIBRARY');
    expect(at(`${ROOT}/catalog/post/eating`, false)).toBe('CATALOG');
  });

  it('thư mục của bài KHÁC không phải UPLOAD', () => {
    expect(at(`${ROOT}/posts/${POST_ID}-evil/x`, false)).toBe('CATALOG');
  });
});
```

  `pnpm --filter @tourism/api exec vitest run src/modules/posts/admin-post-rules.spec.ts`
  — ĐỎ (chưa có module).

- [ ] **B4. Cài.** Tạo `admin-post-rules.ts`:

```ts
import {
  type AdminPostDetail,
  type AdminPostRow,
  type AdminPostStatusFilter,
  type MediaItem,
  type PostCoverSource,
  postDisplayStatus,
  postReadiness,
} from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';
import { PostStatus } from '../../generated/prisma/enums.js';
import { isPostUploadPublicId } from '../../lib/upload-signing.js';
import { publishedPostWhere } from './published-post.where.js';

/**
 * Logic THUẦN của quản trị bài viết (spec P4e-4) — bộ lọc trạng thái, hình dạng admin,
 * nguồn ảnh bìa, kế hoạch thay ảnh bìa. Ngoài DB nên test được từng nhánh; service chỉ
 * còn orchestration.
 */

/**
 * Điều kiện của tab lọc — CÙNG luật với `postDisplayStatus` của contract: bài PUBLISHED
 * thiếu ngày đăng là nháp (web không hiện nó). `published` chính là `publishedPostWhere`,
 * nên tab ấy liệt kê đúng những bài web đang hiện.
 */
export function postStatusWhere(filter: AdminPostStatusFilter, now: Date): Prisma.PostWhereInput {
  switch (filter) {
    case 'published':
      return publishedPostWhere(now);
    case 'scheduled':
      return { status: PostStatus.PUBLISHED, publishedAt: { gt: now } };
    case 'draft':
      return { OR: [{ status: PostStatus.DRAFT }, { publishedAt: null }] };
    case 'all':
      return {};
  }
}

export const ADMIN_POST_ROW_SELECT = {
  id: true,
  slug: true,
  title: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  // Bảng nối không có cột thứ tự — sắp theo tên để thứ tự đứng yên giữa hai lần đọc.
  tags: {
    select: { tag: { select: { slug: true, name: true } } },
    orderBy: { tag: { name: 'asc' } },
  },
} satisfies Prisma.PostSelect;

export type AdminPostRowRecord = Prisma.PostGetPayload<{ select: typeof ADMIN_POST_ROW_SELECT }>;

export const ADMIN_POST_SELECT = {
  ...ADMIN_POST_ROW_SELECT,
  excerpt: true,
  content: true,
  createdAt: true,
  author: { select: { name: true } },
  relatedTours: {
    orderBy: { order: 'asc' },
    select: { tour: { select: { id: true, slug: true, title: true, isPublished: true } } },
  },
} satisfies Prisma.PostSelect;

export type AdminPostRecord = Prisma.PostGetPayload<{ select: typeof ADMIN_POST_SELECT }>;

/** Một hàng của bảng `/posts`. `coverUrl` do service dựng từ dòng `hero` (một câu cho cả trang). */
export function toAdminPostRow(
  row: AdminPostRowRecord,
  coverUrl: string | null,
  now: Date,
): AdminPostRow {
  const publishedAt = row.publishedAt?.toISOString() ?? null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    publishedAt,
    displayStatus: postDisplayStatus(row.status, publishedAt, now),
    coverUrl,
    tags: row.tags.map((link) => link.tag),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Ảnh bìa đã dựng URL, kèm nguồn — `null` khi bài chưa có dòng `hero`. */
export interface ResolvedCover {
  item: MediaItem;
  source: PostCoverSource;
}

/** Chi tiết cho trang sửa. Phiên bản là `updatedAt` (ADR-0051 §2). */
export function toAdminPostDetail(
  row: AdminPostRecord,
  cover: ResolvedCover | null,
  now: Date,
): AdminPostDetail {
  const base = toAdminPostRow(row, null, now);
  return {
    id: base.id,
    slug: base.slug,
    title: base.title,
    excerpt: row.excerpt,
    content: row.content,
    status: base.status,
    publishedAt: base.publishedAt,
    displayStatus: base.displayStatus,
    readiness: postReadiness({
      content: row.content,
      excerpt: row.excerpt,
      hasCover: cover !== null,
    }),
    tags: base.tags,
    relatedTours: row.relatedTours.map((link) => link.tour),
    cover:
      cover === null
        ? null
        : {
            publicId: cover.item.publicId,
            url: cover.item.url,
            alt: cover.item.alt,
            source: cover.source,
          },
    author: { name: row.author.name },
    version: base.updatedAt,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Nguồn của ảnh bìa (ADR-0048 AMEND 1 áp cho bài viết): thư mục tải lên của chính bài là
 * `UPLOAD`; có dòng thư viện địa danh là `LIBRARY`; còn lại — ảnh catalog của bài seed —
 * là `CATALOG`, gỡ ra thì không chọn lại được.
 */
export function coverSource(
  publicId: string,
  args: { rootFolder: string; postId: string; inLibrary: boolean },
): PostCoverSource {
  if (isPostUploadPublicId(args.rootFolder, args.postId, publicId)) return 'UPLOAD';
  return args.inLibrary ? 'LIBRARY' : 'CATALOG';
}
```

  Chạy lại — XANH. Đột biến: `gt` thành `gte`; bỏ vế `{ publishedAt: null }`;
  `toAdminPostRow` trả `displayStatus: 'published'` cứng; `relatedTours` sắp lại theo id;
  `coverSource` xét `inLibrary` trước thư mục.

- [ ] **B5.** `admin-tours.service.ts`: đổi `const LIBRARY_PHOTO = {` thành
  `export const LIBRARY_PHOTO = {`, và thêm một dòng cuối JSDoc của nó:
  `* Bài viết (P4e-4) dùng chung định nghĩa này cho ảnh bìa chọn từ thư viện.` Không đổi gì
  khác.

- [ ] **B6. Service.** Tạo `admin-posts.service.ts` với bốn phương thức đọc/tạo (Task 3 và
  Task 4 thêm phần ghi vào chính file này):

```ts
import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminPostCreateInput,
  AdminPostCreateResult,
  AdminPostDetail,
  AdminPostRow,
  AdminPostsListQuery,
  AdminPostTag,
  Paged,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { MediaOwnerType, MediaRole, PostStatus } from '../../generated/prisma/enums.js';
import { escapeLike } from '../../lib/like.js';
import { toPaged } from '../../lib/paged.js';
import { LIBRARY_PHOTO, prismaCode } from '../catalog/admin-tours.service.js';
import { MediaService } from '../media/media.service.js';
import { AdminPostNotFoundError, PostSlugTakenError } from './admin-post-errors.js';
import {
  ADMIN_POST_ROW_SELECT,
  ADMIN_POST_SELECT,
  type AdminPostRecord,
  coverSource,
  postStatusWhere,
  toAdminPostDetail,
  toAdminPostRow,
} from './admin-post-rules.js';

/**
 * Quản trị bài viết (spec P4e-4, ADR-0051) — các thao tác của `admin.posts.*`.
 *
 * Mọi lỗi DB bắt NGAY tại câu ghi, không SELECT kiểm trước (bài học F14): slug trùng là
 * `P2002`.
 */
@Injectable()
export class AdminPostsService {
  private readonly logger = new Logger(AdminPostsService.name);

  constructor(private readonly media: MediaService) {}

  /** Một trang bài, sửa gần nhất trước. Ảnh bìa nhỏ: MỘT câu media cho cả trang. */
  async list(query: AdminPostsListQuery, now: Date = new Date()): Promise<Paged<AdminPostRow>> {
    const where: Prisma.PostWhereInput = {
      ...postStatusWhere(query.status, now),
      // escapeLike (cùng luật danh sách công khai): `%`/`_` gõ vào ô tìm là chữ, không phải wildcard.
      ...(query.search
        ? { title: { contains: escapeLike(query.search), mode: 'insensitive' } }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        select: ADMIN_POST_ROW_SELECT,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    const covers = await this.media.resolveForOwners(
      MediaOwnerType.POST,
      rows.map((row) => row.id),
      [MediaRole.hero],
    );
    const items = rows.map((row) =>
      toAdminPostRow(row, covers.get(row.id)?.[0]?.url ?? null, now),
    );
    return toPaged(items, { page: query.page, limit: query.limit, total });
  }

  /** Một bài, mọi trạng thái — nháp và bài hẹn giờ chính là bài đang được soạn. */
  async get(slug: string, now: Date = new Date()): Promise<AdminPostDetail> {
    const row = await prisma.post.findUnique({ where: { slug }, select: ADMIN_POST_SELECT });
    if (!row) throw new AdminPostNotFoundError(slug);
    return this.toDetail(row, now);
  }

  /** Bài mới là nháp, thân bài rỗng; tác giả là admin đang tạo. Không bust: web chưa thấy nháp. */
  async create(input: AdminPostCreateInput, authorId: string): Promise<AdminPostCreateResult> {
    const created = await prisma.post
      .create({
        data: {
          slug: input.slug,
          title: input.title,
          content: '',
          status: PostStatus.DRAFT,
          authorId,
        },
        select: { id: true, slug: true },
      })
      .catch((error: unknown) => {
        if (prismaCode(error) === 'P2002') throw new PostSlugTakenError(input.slug);
        throw error;
      });
    this.logger.log(`[admin] post created ${JSON.stringify(created)}`);
    return created;
  }

  /** Mọi tag kèm số bài dùng nó, CẢ nháp — tag không còn bài nào vẫn có mặt với số 0. */
  async tags(): Promise<AdminPostTag[]> {
    const rows = await prisma.postTag.findMany({
      orderBy: { name: 'asc' },
      select: { slug: true, name: true, _count: { select: { posts: true } } },
    });
    return rows.map((row) => ({ slug: row.slug, name: row.name, count: row._count.posts }));
  }

  /** Chi tiết kèm ảnh bìa và nguồn của nó — một câu media, một câu đếm thư viện. */
  private async toDetail(row: AdminPostRecord, now: Date): Promise<AdminPostDetail> {
    const media = await this.media.resolveForOwners(MediaOwnerType.POST, [row.id], [
      MediaRole.hero,
    ]);
    const item = media.get(row.id)?.[0] ?? null;
    if (item === null) return toAdminPostDetail(row, null, now);
    const inLibrary =
      (await prisma.mediaAsset.count({ where: { ...LIBRARY_PHOTO, publicId: item.publicId } })) >
      0;
    const source = coverSource(item.publicId, {
      rootFolder: env.CLOUDINARY_UPLOAD_FOLDER,
      postId: row.id,
      inLibrary,
    });
    return toAdminPostDetail(row, { item, source }, now);
  }
}
```

  Hàng dọn và bust cache vào constructor ở Task 3, khi có lệnh ghi đầu tiên dùng chúng —
  inject sớm là thuộc tính private không ai đọc (TS và Biome đều báo).

- [ ] **B7. Controller.** Tạo `admin-posts.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { toContractError } from '../../lib/contract-error.js';
import { AdminPostsService } from './admin-posts.service.js';

/**
 * Bề mặt bài viết cho admin (spec P4e-4 §3). Controller RIÊNG, không đắp vào
 * `PostsController`: cái kia là đọc công khai cache được — một route admin sống trong đó
 * có thể bị cache công khai, rò bài nháp qua proxy.
 *
 * Ẩn danh → 401, không phải admin → 403, cả hai trước khi oRPC parse input. Trần ghi
 * của ADR-0037 tự áp cho route ghi có session admin.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminPostsController {
  constructor(private readonly posts: AdminPostsService) {}

  @Implement(contract.admin.posts.list)
  list() {
    return implement(contract.admin.posts.list).handler(({ input }) => this.posts.list(input));
  }

  @Implement(contract.admin.posts.get)
  get() {
    return implement(contract.admin.posts.get).handler(async ({ input, errors }) => {
      try {
        return await this.posts.get(input.slug);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.posts.create)
  create(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.posts.create).handler(async ({ input, errors }) => {
      try {
        return await this.posts.create(input, user.id);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.posts.tags)
  tags() {
    return implement(contract.admin.posts.tags).handler(() => this.posts.tags());
  }
}
```

- [ ] **B8. Module.** Thay toàn bộ `posts.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { WebRevalidationModule } from '../web-revalidation/web-revalidation.module.js';
import { AdminPostsController } from './admin-posts.controller.js';
import { AdminPostsService } from './admin-posts.service.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  // P4e-4: lệnh ghi bài bust cache web sau commit (ADR-0051 §6) nên cần
  // WebRevalidationModule; MediaModule export cả MediaGarbageModule (hàng dọn).
  imports: [MediaModule, WebRevalidationModule],
  controllers: [PostsController, AdminPostsController],
  providers: [PostsService, AdminPostsService],
})
export class PostsModule {}
```

- [ ] **B9. Int test.** Tạo `admin-posts.int.spec.ts` — khung và các ca đọc/tạo. Task 3 và
  Task 4 thêm `describe` vào CÙNG file, dùng chung khung này:

```ts
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminPostCreateResultSchema,
  AdminPostDetailSchema,
  AdminPostRowSchema,
  AdminPostTagSchema,
} from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';

/**
 * Integration (Docker PG, db `tourism_test`) — quản trị bài viết (spec P4e-4, ADR-0051).
 * Bốn ca đắt nhất:
 *
 *  ① Hai lệnh sửa cùng một `version` bắn cùng lúc: ĐÚNG MỘT lệnh qua (`claimPost`).
 *  ② Bài đăng không bao giờ thành thiếu: lệnh làm thiếu bị từ chối và rollback trọn.
 *  ③ Thay ảnh bìa: chỉ ảnh tải lên của chính bài vào lại hàng dọn, ảnh thư viện và
 *    catalog thì không.
 *  ④ Xoá kéo theo đúng liên kết và dòng media, giữ tag.
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test';
const CUSTOMER_EMAIL = 'posts-admin-customer@example.com';

const uuid = (prefix: string, n: number) =>
  `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const postId = (n: number) => uuid('f4e40001', n);
const tourId = (n: number) => uuid('f4e40002', n);
const CATEGORY_ID = uuid('f4e40003', 1);
const DEST_ID = uuid('f4e40004', 1);
const DAY_MS = 86_400_000;

const ROOT = 'tourism';
const mine = (n: number, name: string) => `${ROOT}/posts/${postId(n)}/${name}`;
const LIB = `${ROOT}/catalog/destination/hoi-an/1`;
const CATALOG = `${ROOT}/catalog/post/p4e4-post-1`;

function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = (Array.isArray(raw) ? raw : [raw]).filter(
    (c): c is string => typeof c === 'string',
  );
  const session = cookies.find((c) => c.includes('session_token'));
  if (!session) throw new Error(`No session cookie in: ${JSON.stringify(raw)}`);
  const pair = session.split(';')[0];
  if (!pair) throw new Error('Malformed set-cookie');
  return pair;
}

describe('admin posts integration (P4e-4)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let adminId: string;
  let web: WebRevalidationService;

  beforeAll(async () => {
    // Int spec chạy tuần tự (`fileParallelism: false`), nên dọn ở đây không giẫm spec khác.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, tour_categories, destinations, media_assets, posts, post_tags CASCADE',
    );

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    web = moduleRef.get(WebRevalidationService);

    for (const email of [ADMIN_EMAIL, CUSTOMER_EMAIL]) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email, password: PASSWORD, name: 'Test User' },
      });
      await prisma.user.update({
        where: { email },
        data: { emailVerified: true, ...(email === ADMIN_EMAIL ? { role: 'ADMIN' } : {}) },
      });
    }
    const signIn = (email: string) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email, password: PASSWORD },
      });
    adminCookie = sessionCookie(await signIn(ADMIN_EMAIL));
    customerCookie = sessionCookie(await signIn(CUSTOMER_EMAIL));
    adminId = (await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } })).id;
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    // Xoá bài kéo theo post_tag_links và post_tours (Cascade). media_assets là bảng đa
    // chủ, không khoá ngoại — xoá riêng, không thì id dùng lại nhặt nhầm ảnh của ca trước.
    await prisma.post.deleteMany();
    await prisma.postTag.deleteMany();
    await prisma.mediaAsset.deleteMany();
    await prisma.mediaGarbage.deleteMany();
    await prisma.tour.deleteMany();
    await prisma.destination.deleteMany();
    await prisma.tourCategory.deleteMany();
    await prisma.tourCategory.create({
      data: { id: CATEGORY_ID, slug: 'day-trips', name: 'Day trips', order: 1 },
    });
    await prisma.destination.create({
      data: { id: DEST_ID, slug: 'hoi-an', name: 'Hội An', region: 'Central Vietnam' },
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const makeTour = (n: number, isPublished = true) =>
    prisma.tour.create({
      data: {
        id: tourId(n),
        slug: `p4e4-tour-${n}`,
        title: `P4e-4 Tour ${n}`,
        summary: 'A day out.',
        categoryId: CATEGORY_ID,
        durationDays: 1,
        maxGroupSize: 10,
        basePrice: '10.00',
        isPublished,
      },
    });

  /** Một bài ĐỦ để đăng, đã đăng từ hôm qua — ca nào cần khác thì đè bằng `patch`. */
  const makePost = (n: number, patch: Partial<Prisma.PostUncheckedCreateInput> = {}) =>
    prisma.post.create({
      data: {
        id: postId(n),
        slug: `p4e4-post-${n}`,
        title: `P4e-4 Post ${n}`,
        excerpt: 'A short story.',
        content: '## Morning\n\nCoffee first.',
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - DAY_MS),
        authorId: adminId,
        ...patch,
      },
    });

  const makeCover = (n: number, publicId: string) =>
    prisma.mediaAsset.create({
      data: {
        ownerType: 'POST',
        ownerId: postId(n),
        publicId,
        type: 'IMAGE',
        role: 'hero',
        sortOrder: 0,
        alt: 'Old cover',
        version: '1700000000',
      },
    });

  /** Ảnh thư viện CÓ đủ ghi công — ca "chép ghi công" cần nó KHÁC thứ client gửi. */
  const makeLibrary = () =>
    prisma.mediaAsset.create({
      data: {
        ownerType: 'DESTINATION',
        ownerId: DEST_ID,
        publicId: LIB,
        type: 'IMAGE',
        role: 'gallery',
        sortOrder: 1,
        alt: 'Lanterns over the river',
        version: '1700000001',
        author: 'Jane Doe',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lanterns.jpg',
      },
    });

  const get = (slug: string, cookie = adminCookie) =>
    app.inject({ method: 'GET', url: `/api/admin/posts/${slug}`, headers: { cookie } });
  const list = (query = '', cookie = adminCookie) =>
    app.inject({ method: 'GET', url: `/api/admin/posts${query}`, headers: { cookie } });
  const post = (url: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    app.inject({ method: 'POST', url, headers: { cookie }, payload });
  const create = (payload: Record<string, unknown>, cookie = adminCookie) =>
    post('/api/admin/posts', payload, cookie);
  const tags = (cookie = adminCookie) =>
    app.inject({ method: 'GET', url: '/api/admin/post-tags', headers: { cookie } });

  describe('quyền', () => {
    it('ẩn danh 401, khách 403 — trên cả đường đọc lẫn đường ghi', async () => {
      await makePost(1);
      expect((await list('', '')).statusCode).toBe(401);
      expect((await get('p4e4-post-1', '')).statusCode).toBe(401);
      expect((await list('', customerCookie)).statusCode).toBe(403);
      expect((await get('p4e4-post-1', customerCookie)).statusCode).toBe(403);
      expect((await create({ title: 'X', slug: 'x' }, customerCookie)).statusCode).toBe(403);
      expect((await tags(customerCookie)).statusCode).toBe(403);
    });
  });

  describe('list', () => {
    it('bốn tab theo trạng thái hiển thị; bài PUBLISHED thiếu ngày nằm ở Drafts', async () => {
      await makePost(1);
      await makePost(2, { publishedAt: new Date(Date.now() + DAY_MS) });
      await makePost(3, { status: 'DRAFT' });
      await makePost(4, { publishedAt: null });

      const slugs = async (status: string) =>
        (await list(`?status=${status}`))
          .json()
          .items.map((row: { slug: string }) => row.slug)
          .sort();

      expect(await slugs('all')).toEqual([
        'p4e4-post-1',
        'p4e4-post-2',
        'p4e4-post-3',
        'p4e4-post-4',
      ]);
      expect(await slugs('published')).toEqual(['p4e4-post-1']);
      expect(await slugs('scheduled')).toEqual(['p4e4-post-2']);
      expect(await slugs('draft')).toEqual(['p4e4-post-3', 'p4e4-post-4']);
    });

    it('hàng khớp contract: chip, ảnh bìa nhỏ, tag sắp theo tên; sửa gần nhất trước', async () => {
      await makePost(1);
      await makePost(2, { publishedAt: new Date(Date.now() + DAY_MS) });
      await makeCover(2, mine(2, 'cover'));
      await prisma.postTag.createMany({
        data: [
          { slug: 'zen', name: 'Zen' },
          { slug: 'art', name: 'Art' },
        ],
      });
      const [zen, art] = await Promise.all([
        prisma.postTag.findUniqueOrThrow({ where: { slug: 'zen' } }),
        prisma.postTag.findUniqueOrThrow({ where: { slug: 'art' } }),
      ]);
      await prisma.postTagLink.createMany({
        data: [
          { postId: postId(2), tagId: zen.id },
          { postId: postId(2), tagId: art.id },
        ],
      });

      const res = await list();

      expect(res.statusCode).toBe(200);
      const [first, second] = res.json().items;
      expect(AdminPostRowSchema.parse(first)).toEqual(first);
      expect(first.slug).toBe('p4e4-post-2');
      expect(first.displayStatus).toBe('scheduled');
      expect(first.coverUrl).toContain(`/v1700000000/${mine(2, 'cover')}`);
      expect(first.tags.map((tag: { name: string }) => tag.name)).toEqual(['Art', 'Zen']);
      expect(second.coverUrl).toBeNull();
    });

    it('tìm theo tiêu đề, không phân biệt hoa thường; `%` là chữ, không phải wildcard', async () => {
      await makePost(1, { title: 'Hoi An by night' });
      await makePost(2, { title: '100% Saigon' });

      const titles = async (q: string) =>
        (await list(`?search=${encodeURIComponent(q)}`))
          .json()
          .items.map((row: { title: string }) => row.title);

      expect(await titles('hoi an')).toEqual(['Hoi An by night']);
      expect(await titles('%')).toEqual(['100% Saigon']);
    });
  });

  describe('get', () => {
    it('đọc được nháp; thiếu ảnh bìa thì readiness nói ra; tour giữ thứ tự lưu', async () => {
      await makePost(1, { status: 'DRAFT', excerpt: null });
      await makeTour(1);
      await makeTour(2, false);
      await prisma.postTour.createMany({
        data: [
          { postId: postId(1), tourId: tourId(2), order: 0 },
          { postId: postId(1), tourId: tourId(1), order: 1 },
        ],
      });

      const res = await get('p4e4-post-1');

      expect(res.statusCode).toBe(200);
      const detail = AdminPostDetailSchema.parse(res.json());
      expect(detail.displayStatus).toBe('draft');
      expect(detail.readiness).toEqual(['excerpt', 'cover']);
      expect(detail.relatedTours.map((tour) => [tour.slug, tour.isPublished])).toEqual([
        ['p4e4-tour-2', false],
        ['p4e4-tour-1', true],
      ]);
      expect(detail.author.name).toBe('Test User');
    });

    it.each([
      ['UPLOAD', mine(1, 'cover')],
      ['LIBRARY', LIB],
      ['CATALOG', CATALOG],
    ])('nguồn ảnh bìa %s', async (source, publicId) => {
      await makePost(1);
      await makeLibrary();
      await makeCover(1, publicId);

      const detail = AdminPostDetailSchema.parse((await get('p4e4-post-1')).json());

      expect(detail.cover?.source).toBe(source);
      expect(detail.readiness).toEqual([]);
    });

    it('slug không có thì 404 NOT_FOUND', async () => {
      const res = await get('no-such-post');
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('create', () => {
    it('sinh nháp rỗng, tác giả là admin đang tạo; không bust', async () => {
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await create({ title: '  Street food in Hội An  ', slug: 'street-food-hoi-an' });

      expect(res.statusCode).toBe(200);
      const created = AdminPostCreateResultSchema.parse(res.json());
      const row = await prisma.post.findUniqueOrThrow({ where: { id: created.id } });
      expect(row).toMatchObject({
        slug: 'street-food-hoi-an',
        title: 'Street food in Hội An',
        content: '',
        status: 'DRAFT',
        publishedAt: null,
        authorId: adminId,
      });
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('slug trùng thì 409 SLUG_TAKEN; slug sai hình dạng thì 400', async () => {
      await makePost(1);
      const taken = await create({ title: 'Again', slug: 'p4e4-post-1' });
      expect(taken.statusCode).toBe(409);
      expect(taken.json()).toMatchObject({ code: 'SLUG_TAKEN' });
      expect((await create({ title: 'Bad', slug: 'Bad Slug' })).statusCode).toBe(400);
    });
  });

  describe('tags', () => {
    it('đếm cả bài nháp; tag không còn bài nào có mặt với số 0; sắp theo tên', async () => {
      await makePost(1, { status: 'DRAFT' });
      await prisma.postTag.createMany({
        data: [
          { slug: 'food', name: 'Food' },
          { slug: 'art', name: 'Art' },
        ],
      });
      const food = await prisma.postTag.findUniqueOrThrow({ where: { slug: 'food' } });
      await prisma.postTagLink.create({ data: { postId: postId(1), tagId: food.id } });

      const res = await tags();

      expect(res.statusCode).toBe(200);
      expect(res.json().map((row: unknown) => AdminPostTagSchema.parse(row))).toEqual([
        { slug: 'art', name: 'Art', count: 0 },
        { slug: 'food', name: 'Food', count: 1 },
      ]);
    });
  });
});
```

- [ ] **B10.** Chạy riêng file int:
  `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/posts/admin-posts.int.spec.ts`
  — XANH. Đột biến: bỏ `escapeLike` (ca `%` phải đỏ); `orderBy` thành `updatedAt: 'asc'`;
  bỏ `@Roles(UserRole.ADMIN)` (ca 403 phải đỏ); `create` thôi bắt `P2002` (thành 500).
- [ ] **B11.** Quy trình gate, rồi commit:
  `feat(api): đọc, tạo bài và danh sách tag cho admin`

## Task 3 — API: lưu cả form (`update`)

**Files:**

- Modify: `apps/api/src/modules/posts/admin-post-rules.ts` + `admin-post-rules.spec.ts`
- Modify: `apps/api/src/modules/web-revalidation/revalidation-decision.ts` + `revalidation-decision.spec.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.service.ts` (một chữ `export`)
- Modify: `apps/api/src/modules/posts/admin-posts.service.ts`, `admin-posts.controller.ts`
- Modify: `apps/api/src/modules/posts/admin-posts.int.spec.ts`

**Interfaces:**

- Consumes: Task 1, Task 2; `StoredPhoto` (`catalog/tour-photos.ts`), `nextTourVersion`
  (`catalog/tour-editor-rules.ts`), `STORED_PHOTO_SELECT`.
- Produces: `planPostCover({ postId, rootFolder, cover, current, library }): PostCoverPlan`,
  `PlannedCoverRow`, `PostCoverPlan`; `postRevalidationTags(slug)`;
  `AdminPostsService.update(input)` và hàm module `claimPost(tx, id, version, now)` (Task 4
  dùng lại), `private bust(slug)`.

- [ ] **B1. Test trước — kế hoạch ảnh bìa.** Trong `admin-post-rules.spec.ts`, thêm
  `planPostCover` vào import từ `./admin-post-rules.js`, thêm
  `import type { StoredPhoto } from '../catalog/tour-photos.js';`, rồi thêm cuối file:

```ts
describe('planPostCover (spec §3.2, ADR-0051 §7)', () => {
  const stored = (publicId: string): StoredPhoto => ({
    publicId,
    type: 'IMAGE',
    posterId: null,
    format: 'jpg',
    width: 1600,
    height: 1067,
    durationSec: null,
    bytes: 400000,
    version: '1700000000',
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
  });
  const OLD_UPLOAD = `${ROOT}/posts/${POST_ID}/old`;
  const NEW_UPLOAD = `${ROOT}/posts/${POST_ID}/new`;
  const LIBRARY_ID = `${ROOT}/catalog/destination/hoi-an/1`;
  const CATALOG_ID = `${ROOT}/catalog/post/eating`;
  const META = { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 };
  const plan = (
    cover: { publicId: string; alt: string | null; upload?: typeof META } | null,
    current: StoredPhoto | null,
    library: StoredPhoto | null = null,
  ) => planPostCover({ postId: POST_ID, rootFolder: ROOT, cover, current, library });

  it('giữ ảnh hiện có, chỉ đổi alt: không gì vào hàng dọn', () => {
    expect(plan({ publicId: OLD_UPLOAD, alt: 'New alt' }, stored(OLD_UPLOAD))).toEqual({
      ok: true,
      row: { ...stored(OLD_UPLOAD), alt: 'New alt' },
      requeue: [],
    });
  });

  it('ảnh tải lên mới thay ảnh tải lên cũ: metadata lấy từ upload, ảnh cũ vào lại hàng dọn', () => {
    expect(plan({ publicId: NEW_UPLOAD, alt: null, upload: META }, stored(OLD_UPLOAD))).toEqual({
      ok: true,
      row: {
        publicId: NEW_UPLOAD,
        type: 'IMAGE',
        posterId: null,
        format: 'jpg',
        width: 2000,
        height: 1333,
        durationSec: null,
        bytes: 523000,
        version: '1759000000',
        author: null,
        license: null,
        licenseUrl: null,
        sourceUrl: null,
        alt: null,
      },
      requeue: [OLD_UPLOAD],
    });
  });

  it('ảnh thư viện thay ảnh catalog: chép ghi công của thư viện; ảnh catalog KHÔNG vào hàng dọn', () => {
    const library = { ...stored(LIBRARY_ID), author: 'Jane Doe', license: 'CC BY-SA 4.0' };
    expect(plan({ publicId: LIBRARY_ID, alt: null }, stored(CATALOG_ID), library)).toEqual({
      ok: true,
      row: { ...library, alt: null },
      requeue: [],
    });
  });

  it('gỡ ảnh bìa: ảnh tải lên cũ vào hàng dọn; ảnh thư viện cũ thì không', () => {
    expect(plan(null, stored(OLD_UPLOAD))).toEqual({ ok: true, row: null, requeue: [OLD_UPLOAD] });
    expect(plan(null, stored(LIBRARY_ID))).toEqual({ ok: true, row: null, requeue: [] });
    expect(plan(null, null)).toEqual({ ok: true, row: null, requeue: [] });
  });

  it.each([
    ['ảnh tải lên thiếu metadata', { publicId: NEW_UPLOAD, alt: null }],
    [
      'thư mục của bài khác',
      { publicId: `${ROOT}/posts/${POST_ID}-evil/x`, alt: null, upload: META },
    ],
    ['ảnh lạ không có dòng thư viện', { publicId: CATALOG_ID, alt: null }],
  ])('từ chối %s', (_, cover) => {
    expect(plan(cover, null)).toEqual({ ok: false, rejected: cover.publicId });
  });

  it('dòng thư viện của publicId KHÁC không cứu được ảnh lạ', () => {
    expect(plan({ publicId: CATALOG_ID, alt: null }, null, stored(LIBRARY_ID))).toEqual({
      ok: false,
      rejected: CATALOG_ID,
    });
  });
});
```

  Chạy spec — ĐỎ (`planPostCover` chưa có).

- [ ] **B2. Cài.** Cuối `admin-post-rules.ts` (thêm `type AdminPostCoverInput` vào import
  từ `@tourism/contract` và `import type { StoredPhoto } from '../catalog/tour-photos.js';`):

```ts
/** Một dòng ảnh bìa sẽ ghi — cột chép từ nguồn, `alt` theo form (trống là `null`). */
export interface PlannedCoverRow extends StoredPhoto {
  alt: string | null;
}

export type PostCoverPlan =
  | { ok: true; row: PlannedCoverRow | null; requeue: string[] }
  | { ok: false; rejected: string };

/**
 * Ảnh bìa gửi lên → dòng sẽ ghi và ảnh phải vào lại hàng dọn (spec §3.2, ADR-0051 §7).
 *
 * Ảnh bìa thuộc đúng MỘT nguồn, xét theo thứ tự: ảnh bìa HIỆN CÓ (giữ, chỉ đổi alt) →
 * ảnh TẢI LÊN trong thư mục của bài, có metadata (mới) → dòng THƯ VIỆN (mượn, chép ghi
 * công). Không thuộc nguồn nào là từ chối cả lệnh.
 *
 * Ảnh bìa cũ bị thay hay bị gỡ chỉ vào lại hàng dọn khi nó nằm trong thư mục tải lên của
 * chính bài — ảnh thư viện đã kiểm giấy phép, ảnh catalog thì không chọn lại được.
 */
export function planPostCover(args: {
  postId: string;
  rootFolder: string;
  cover: AdminPostCoverInput | null;
  /** Dòng `hero` hiện có của bài. */
  current: StoredPhoto | null;
  /** Dòng `DESTINATION` của publicId gửi lên, nếu có. */
  library: StoredPhoto | null;
}): PostCoverPlan {
  const kept = args.cover?.publicId ?? null;
  const requeue =
    args.current !== null &&
    args.current.publicId !== kept &&
    isPostUploadPublicId(args.rootFolder, args.postId, args.current.publicId)
      ? [args.current.publicId]
      : [];
  if (args.cover === null) return { ok: true, row: null, requeue };

  const source =
    (args.current?.publicId === args.cover.publicId ? args.current : null) ??
    uploadedCover(args.rootFolder, args.postId, args.cover) ??
    (args.library?.publicId === args.cover.publicId ? args.library : null);
  if (source === null) return { ok: false, rejected: args.cover.publicId };
  return { ok: true, row: { ...source, alt: args.cover.alt }, requeue };
}

/** Ảnh tải lên MỚI: đúng thư mục của bài VÀ có metadata Cloudinary — thiếu một là không nhận. */
function uploadedCover(
  rootFolder: string,
  postId: string,
  cover: AdminPostCoverInput,
): StoredPhoto | null {
  if (cover.upload === undefined) return null;
  if (!isPostUploadPublicId(rootFolder, postId, cover.publicId)) return null;
  return {
    publicId: cover.publicId,
    type: 'IMAGE',
    posterId: null,
    format: cover.upload.format,
    width: cover.upload.width,
    height: cover.upload.height,
    durationSec: null,
    bytes: cover.upload.bytes,
    version: cover.upload.version,
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
  };
}
```

  Chạy lại — XANH. Đột biến: bỏ vế `isPostUploadPublicId` của `requeue` (ca catalog/thư
  viện phải đỏ); đảo thứ tự nguồn thư viện lên trước ảnh hiện có (ca "giữ ảnh, đổi alt"
  vẫn xanh — ghi vào báo cáo là đột biến tương đương, vì cùng publicId thì cùng dòng); bỏ
  kiểm `cover.upload === undefined` (ca "thiếu metadata" phải đỏ); bỏ vế so publicId của
  thư viện (ca cuối phải đỏ).

- [ ] **B3. Tag cache của bài.** Test trước trong `revalidation-decision.spec.ts` (thêm
  `postRevalidationTags` vào import):

```ts
describe('postRevalidationTags', () => {
  it('luôn là cặp [danh sách, bài đó] — đúng taxonomy của apps/web/src/lib/api/tags.ts', () => {
    expect(postRevalidationTags('eating-your-way-through-hoi-an')).toEqual([
      'posts',
      'post:eating-your-way-through-hoi-an',
    ]);
  });
});
```

  ĐỎ, rồi cài cuối `revalidation-decision.ts`:

```ts
/**
 * Hai tag của một bài viết (ADR-0051 §6): danh sách `/blog` (kèm khối Journal của trang
 * chủ) và trang của chính bài. Gọi sau commit của lệnh sửa và lệnh xoá bài. Trang bài
 * viết còn mang tag `tours` ở phía web (G9) — lệnh ghi tour vốn đã bust nó.
 */
export function postRevalidationTags(slug: string): string[] {
  return ['posts', `post:${slug}`];
}
```

  XANH.

- [ ] **B4.** `admin-tours.service.ts`: đổi `const STORED_PHOTO_SELECT = {` thành
  `export const STORED_PHOTO_SELECT = {`. Không đổi gì khác.

- [ ] **B5. Int test trước.** Trong `admin-posts.int.spec.ts`:
  - thêm hai hằng cạnh `CATALOG` ở đầu file:

```ts
const MISSING = uuid('f4e400ff', 1);
const UPLOAD_META = { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 };
```

  - thêm các helper ngay sau `const tags = …` (`AdminPostDetailSchema` đã có trong import):

```ts
  const save = (n: number, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/posts/${postId(n)}`, payload, cookie);
  const versionOf = async (n: number) =>
    (await prisma.post.findUniqueOrThrow({ where: { id: postId(n) } })).updatedAt.toISOString();
  const coverRows = (n: number) =>
    prisma.mediaAsset.findMany({ where: { ownerType: 'POST', ownerId: postId(n) } });

  /** Lệnh lưu ĐỦ để đăng cho bài `n`, ở phiên bản hiện tại — ca nào cần khác thì đè. */
  const fullSave = async (n: number, patch: Record<string, unknown> = {}) => ({
    id: postId(n),
    version: await versionOf(n),
    title: `P4e-4 Post ${n} edited`,
    excerpt: 'A new excerpt.',
    content: '## Afternoon\n\nTea by the river.',
    status: 'PUBLISHED',
    publishedAt: new Date(Date.now() - DAY_MS).toISOString(),
    tags: [],
    relatedTourIds: [],
    cover: { publicId: mine(n, 'new'), alt: null, upload: UPLOAD_META },
    ...patch,
  });
```

  - thêm `describe` dưới đây ngay trước dấu `});` đóng `describe('admin posts integration …')`:

```ts
  describe('update', () => {
    it('lưu đủ trường: tag mới và tag sẵn có, tour theo thứ tự gửi, ảnh bìa tải lên; bust đúng hai tag', async () => {
      await makePost(1, { status: 'DRAFT', publishedAt: null });
      await makeTour(1);
      await makeTour(2, false);
      await prisma.postTag.create({ data: { slug: 'food', name: 'Food' } });
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);
      const payload = await fullSave(1, {
        tags: ['FOOD', 'Hội An', 'Hoi An'],
        relatedTourIds: [tourId(2), tourId(1)],
        cover: { publicId: mine(1, 'new'), alt: '  Lanterns at dusk  ', upload: UPLOAD_META },
      });

      const res = await save(1, payload);

      expect(res.statusCode).toBe(200);
      const detail = AdminPostDetailSchema.parse(res.json());
      expect(detail).toMatchObject({
        title: 'P4e-4 Post 1 edited',
        excerpt: 'A new excerpt.',
        status: 'PUBLISHED',
        displayStatus: 'published',
        readiness: [],
      });
      expect(detail.version).not.toBe(payload.version);
      // Tag sẵn có giữ tên cũ dù gửi "FOOD"; "Hội An" và "Hoi An" là một tag.
      expect(detail.tags).toEqual([
        { slug: 'food', name: 'Food' },
        { slug: 'hoi-an', name: 'Hội An' },
      ]);
      expect(detail.relatedTours.map((tour) => tour.id)).toEqual([tourId(2), tourId(1)]);
      expect(detail.cover).toMatchObject({
        publicId: mine(1, 'new'),
        alt: 'Lanterns at dusk',
        source: 'UPLOAD',
      });
      const [row] = await coverRows(1);
      expect(row).toMatchObject({
        role: 'hero',
        sortOrder: 0,
        version: '1759000000',
        width: 2000,
        bytes: 523000,
        format: 'jpg',
      });
      expect(revalidate).toHaveBeenCalledWith(['posts', 'post:p4e4-post-1']);
    });

    it('phiên bản cũ: 409 STALE_POST, không đổi gì, không bust', async () => {
      await makePost(1);
      const stale = await fullSave(1);
      expect((await save(1, await fullSave(1, { title: 'First writer' }))).statusCode).toBe(200);
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await save(1, { ...stale, title: 'Second writer' });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_POST' });
      const row = await prisma.post.findUniqueOrThrow({ where: { id: postId(1) } });
      expect(row.title).toBe('First writer');
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('hai lệnh cùng version bắn cùng lúc: đúng MỘT lệnh qua', async () => {
      await makePost(1);
      const payload = await fullSave(1);

      const [a, b] = await Promise.all([
        save(1, { ...payload, title: 'Writer A' }),
        save(1, { ...payload, title: 'Writer B' }),
      ]);

      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      const winner = a.statusCode === 200 ? 'Writer A' : 'Writer B';
      const row = await prisma.post.findUniqueOrThrow({ where: { id: postId(1) } });
      expect(row.title).toBe(winner);
    });

    it('bài không có: 404 NOT_FOUND; khách: 403', async () => {
      const ghost = {
        id: MISSING,
        version: new Date().toISOString(),
        title: 'Ghost',
        excerpt: null,
        content: '',
        status: 'DRAFT',
        publishedAt: null,
        tags: [],
        relatedTourIds: [],
        cover: null,
      };
      const res = await post(`/api/admin/posts/${MISSING}`, ghost);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
      expect((await post(`/api/admin/posts/${MISSING}`, ghost, customerCookie)).statusCode).toBe(
        403,
      );
    });

    it('đăng mà thiếu: 409 POST_NOT_READY, rollback trọn; nháp thiếu mọi thứ vẫn lưu được', async () => {
      await makePost(1, { status: 'DRAFT', publishedAt: null, excerpt: null, content: '' });
      const before = await versionOf(1);

      const res = await save(1, await fullSave(1, { excerpt: null, cover: null }));

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'POST_NOT_READY' });
      expect(await versionOf(1)).toBe(before);
      const draft = await save(
        1,
        await fullSave(1, {
          status: 'DRAFT',
          publishedAt: null,
          excerpt: null,
          content: '',
          cover: null,
        }),
      );
      expect(draft.statusCode).toBe(200);
      expect(AdminPostDetailSchema.parse(draft.json()).readiness).toEqual([
        'content',
        'excerpt',
        'cover',
      ]);
    });

    it('bài đang đăng không thể lưu thành thiếu — cùng cổng của tour đang bán', async () => {
      await makePost(1);
      await makeCover(1, mine(1, 'old'));

      const res = await save(
        1,
        await fullSave(1, { cover: { publicId: mine(1, 'old'), alt: null }, excerpt: '   ' }),
      );

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'POST_NOT_READY' });
      const row = await prisma.post.findUniqueOrThrow({ where: { id: postId(1) } });
      expect(row.excerpt).toBe('A short story.');
    });

    it('hẹn giờ: chip Scheduled, bài chưa lên đường công khai trước giờ đăng', async () => {
      await makePost(1, { status: 'DRAFT', publishedAt: null });

      const res = await save(
        1,
        await fullSave(1, { publishedAt: new Date(Date.now() + DAY_MS).toISOString() }),
      );

      expect(res.statusCode).toBe(200);
      expect(AdminPostDetailSchema.parse(res.json()).displayStatus).toBe('scheduled');
      expect((await app.inject({ method: 'GET', url: '/api/posts/p4e4-post-1' })).statusCode).toBe(
        404,
      );
      const publicList = await app.inject({ method: 'GET', url: '/api/posts' });
      expect(publicList.json().items.map((item: { slug: string }) => item.slug)).not.toContain(
        'p4e4-post-1',
      );
    });

    it('ảnh tải lên cũ đổi sang ảnh thư viện: dòng cũ đi, chép ghi công, ảnh cũ vào hàng dọn', async () => {
      await makePost(1);
      await makeCover(1, mine(1, 'old'));
      await makeLibrary();

      const res = await save(1, await fullSave(1, { cover: { publicId: LIB, alt: null } }));

      expect(res.statusCode).toBe(200);
      const rows = await coverRows(1);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        publicId: LIB,
        role: 'hero',
        alt: null,
        author: 'Jane Doe',
        license: 'CC BY-SA 4.0',
        version: '1700000001',
      });
      expect((await prisma.mediaGarbage.findMany()).map((row) => row.publicId)).toEqual([
        mine(1, 'old'),
      ]);
    });

    it('thay ảnh catalog: ảnh catalog KHÔNG vào hàng dọn', async () => {
      await makePost(1);
      await makeCover(1, CATALOG);

      expect((await save(1, await fullSave(1))).statusCode).toBe(200);

      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it('giữ ảnh hiện có, đổi alt: dòng giữ version cũ, không gì vào hàng dọn', async () => {
      await makePost(1);
      await makeCover(1, mine(1, 'old'));

      const res = await save(
        1,
        await fullSave(1, { cover: { publicId: mine(1, 'old'), alt: 'Better alt' } }),
      );

      expect(res.statusCode).toBe(200);
      expect((await coverRows(1))[0]).toMatchObject({
        publicId: mine(1, 'old'),
        alt: 'Better alt',
        version: '1700000000',
      });
      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it.each([
      ['ảnh lạ', { publicId: `${ROOT}/catalog/post/unknown`, alt: null }],
      ['ảnh tải lên thiếu metadata', { publicId: mine(1, 'new'), alt: null }],
      ['thư mục của bài khác', { publicId: mine(2, 'x'), alt: null, upload: UPLOAD_META }],
    ])('ảnh bìa %s: 400 PHOTO_NOT_ALLOWED, rollback trọn', async (_, cover) => {
      await makePost(1);
      await makeCover(1, mine(1, 'old'));
      const before = await versionOf(1);

      const res = await save(1, await fullSave(1, { cover }));

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'PHOTO_NOT_ALLOWED' });
      expect(await versionOf(1)).toBe(before);
      expect((await coverRows(1)).map((row) => row.publicId)).toEqual([mine(1, 'old')]);
      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it('tour không có: 404 RELATED_TOUR_NOT_FOUND, rollback trọn', async () => {
      await makePost(1);
      await makeTour(1);
      const before = await versionOf(1);

      const res = await save(1, await fullSave(1, { relatedTourIds: [tourId(1), MISSING] }));

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'RELATED_TOUR_NOT_FOUND' });
      expect(await versionOf(1)).toBe(before);
      expect(await prisma.postTour.count()).toBe(0);
    });

    it('danh sách rỗng gỡ hết tag và tour; tag không còn bài nào vẫn ở lại', async () => {
      await makePost(1);
      await makeTour(1);
      await save(1, await fullSave(1, { tags: ['Food'], relatedTourIds: [tourId(1)] }));

      const res = await save(1, await fullSave(1, { tags: [], relatedTourIds: [] }));

      expect(res.statusCode).toBe(200);
      expect(await prisma.postTagLink.count()).toBe(0);
      expect(await prisma.postTour.count()).toBe(0);
      expect(await prisma.postTag.count()).toBe(1);
    });

    it('thân bài có ảnh nhúng: 400 từ contract, chưa chạm DB', async () => {
      await makePost(1);
      const before = await versionOf(1);
      const res = await save(
        1,
        await fullSave(1, { content: '![x](https://example.com/x.jpg)' }),
      );
      expect(res.statusCode).toBe(400);
      expect(await versionOf(1)).toBe(before);
    });
  });
```

  Chạy riêng file int — các ca `update` ĐỎ (route chưa có → 404 cho mọi lệnh).

- [ ] **B6. Cài service.** Trong `admin-posts.service.ts`:
  - thêm import: `type AdminPostCoverInput`, `type AdminPostUpdateInput`, `normalizePostTags`,
    `postReadiness` từ `@tourism/contract`; `nextTourVersion` từ
    `../catalog/tour-editor-rules.js`; `STORED_PHOTO_SELECT` cạnh `LIBRARY_PHOTO`;
    `postRevalidationTags` từ `../web-revalidation/revalidation-decision.js`; thêm
    `PostNotReadyError`, `PostPhotoNotAllowedError`, `RelatedTourNotFoundError`,
    `StalePostError` vào import lỗi; `planPostCover` vào import luật;
    `MediaGarbageService` từ `../media/media-garbage.service.js`; `WebRevalidationService`
    từ `../web-revalidation/web-revalidation.service.js`.
  - constructor thành:

```ts
  constructor(
    private readonly media: MediaService,
    private readonly garbage: MediaGarbageService,
    private readonly webRevalidation: WebRevalidationService,
  ) {}
```

  - đoạn thứ hai của JSDoc class thành:

```ts
 * Mọi lỗi DB bắt NGAY tại câu ghi, không SELECT kiểm trước (bài học F14): slug trùng →
 * `P2002`, tour liên quan không có → `P2003`. Bust cache web SAU commit, fire-and-forget;
 * lệnh ghi hỏng thì không bust.
```

  - thêm bốn hàm module NGAY TRƯỚC `@Injectable()`:

```ts
/**
 * Câu ĐẦU TIÊN của lệnh sửa và lệnh xoá: so phiên bản và giành hàng bài trong MỘT câu
 * `UPDATE … WHERE id = ? AND updated_at = ?` — khuôn `claimTour` (ADR-0047 §3). Hai lệnh
 * cùng phiên bản xếp hàng trên khoá hàng; lệnh đến sau đếm được 0.
 *
 * Đếm 0 thì câu thứ hai chỉ để chọn MÃ: hàng còn là phiên bản cũ, mất là bài không còn.
 * Trả phiên bản mới để câu ghi sau trong transaction đặt đúng giá trị ấy — không truyền
 * thì Prisma tự đặt `now()` và phiên bản trả về lệch thứ vừa so.
 */
async function claimPost(
  tx: Prisma.TransactionClient,
  id: string,
  version: string,
  now: Date,
): Promise<Date> {
  // Cùng luật nhích phiên bản với tour: hai lần lưu trong một mili-giây vẫn ra hai phiên bản.
  const next = nextTourVersion(version, now);
  const { count } = await tx.post.updateMany({
    where: { id, updatedAt: new Date(version) },
    data: { updatedAt: next },
  });
  if (count === 0) {
    const exists = await tx.post.findUnique({ where: { id }, select: { id: true } });
    throw exists ? new StalePostError() : new AdminPostNotFoundError(id);
  }
  return next;
}

/** Thay trọn tag (spec §2.5): tag chưa có thì tạo; có rồi thì giữ tên của người tạo đầu tiên. */
async function replaceTags(
  tx: Prisma.TransactionClient,
  postId: string,
  names: readonly string[],
): Promise<void> {
  await tx.postTagLink.deleteMany({ where: { postId } });
  const tags = normalizePostTags(names);
  if (tags.length === 0) return;
  // `skipDuplicates` = ON CONFLICT DO NOTHING: tag đã có không bị đổi tên, hai admin cùng
  // tạo một tag cũng không đụng nhau.
  await tx.postTag.createMany({ data: tags, skipDuplicates: true });
  const rows = await tx.postTag.findMany({
    where: { slug: { in: tags.map((tag) => tag.slug) } },
    select: { id: true },
  });
  await tx.postTagLink.createMany({ data: rows.map((row) => ({ postId, tagId: row.id })) });
}

/** Thay trọn tour liên quan; thứ tự là thứ tự gửi lên (`post_tours.order`). */
async function replaceRelatedTours(
  tx: Prisma.TransactionClient,
  postId: string,
  tourIds: readonly string[],
): Promise<void> {
  await tx.postTour.deleteMany({ where: { postId } });
  if (tourIds.length === 0) return;
  await tx.postTour
    .createMany({ data: tourIds.map((tourId, order) => ({ postId, tourId, order })) })
    .catch((error: unknown) => {
      // Khoá ngoại bắt tại câu ghi (bài học F14) — không SELECT kiểm trước.
      if (prismaCode(error) === 'P2003') throw new RelatedTourNotFoundError();
      throw error;
    });
}

/** Thay dòng ảnh bìa (role `hero`); trả các publicId phải vào lại hàng dọn. */
async function replaceCover(
  tx: Prisma.TransactionClient,
  postId: string,
  cover: AdminPostCoverInput | null,
): Promise<string[]> {
  const heroOf = { ownerType: MediaOwnerType.POST, ownerId: postId, role: MediaRole.hero };
  const current = await tx.mediaAsset.findFirst({
    where: heroOf,
    select: STORED_PHOTO_SELECT,
    orderBy: { createdAt: 'asc' },
  });
  const library =
    cover === null || cover.publicId === current?.publicId
      ? null
      : await tx.mediaAsset.findFirst({
          where: { ...LIBRARY_PHOTO, publicId: cover.publicId },
          select: STORED_PHOTO_SELECT,
          orderBy: { createdAt: 'asc' },
        });
  const plan = planPostCover({
    postId,
    rootFolder: env.CLOUDINARY_UPLOAD_FOLDER,
    cover,
    current,
    library,
  });
  if (!plan.ok) throw new PostPhotoNotAllowedError(plan.rejected);
  await tx.mediaAsset.deleteMany({ where: heroOf });
  if (plan.row !== null) {
    await tx.mediaAsset.create({
      data: { ...plan.row, ownerType: MediaOwnerType.POST, ownerId: postId, role: MediaRole.hero, sortOrder: 0 },
    });
  }
  return plan.requeue;
}
```

  - thêm vào class, ngay sau `create`:

```ts
  /**
   * Lưu cả form (spec §3.2). Thứ tự trong transaction: giành hàng bài → cổng "đủ mới được
   * đăng" (tính từ chính input — mọi thứ nó xét đều do lệnh này thay) → ghi cột → thay
   * tag → thay tour liên quan → thay ảnh bìa → ảnh tải lên bị thay vào lại hàng dọn.
   */
  async update(input: AdminPostUpdateInput): Promise<AdminPostDetail> {
    const now = new Date();
    const slug = await prisma.$transaction(async (tx) => {
      const version = await claimPost(tx, input.id, input.version, now);
      if (input.status === 'PUBLISHED') {
        const missing = postReadiness({
          content: input.content,
          excerpt: input.excerpt,
          hasCover: input.cover !== null,
        });
        if (missing.length > 0) throw new PostNotReadyError(missing);
      }
      const saved = await tx.post.update({
        where: { id: input.id },
        data: {
          title: input.title,
          excerpt: input.excerpt,
          content: input.content,
          status: input.status,
          publishedAt: input.publishedAt === null ? null : new Date(input.publishedAt),
          updatedAt: version,
        },
        select: { slug: true },
      });
      await replaceTags(tx, input.id, input.tags);
      await replaceRelatedTours(tx, input.id, input.relatedTourIds);
      const requeue = await replaceCover(tx, input.id, input.cover);
      // Cùng transaction (ADR-0035 §7): rollback thì hàng dọn không giữ dấu vết nào.
      await this.garbage.requeue(tx, requeue);
      return saved.slug;
    });

    this.logger.log(`[admin] post saved ${JSON.stringify({ id: input.id, status: input.status })}`);
    this.bust(slug);
    return this.get(slug, now);
  }
```

  - thêm cuối class:

```ts
  /**
   * Bust cache web SAU khi lệnh ghi đã xong (ADR-0016 §3). `void` có chủ đích — đường này
   * chết thì site chỉ kém tươi, còn lệnh ghi đã ăn rồi.
   */
  private bust(slug: string): void {
    void this.webRevalidation.revalidate(postRevalidationTags(slug));
  }
```

- [ ] **B7. Controller.** Thêm vào `AdminPostsController`, sau `create`:

```ts
  @Implement(contract.admin.posts.update)
  update() {
    return implement(contract.admin.posts.update).handler(async ({ input, errors }) => {
      try {
        return await this.posts.update(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }
```

- [ ] **B8.** Chạy riêng file int — XANH. `pnpm lint:fix` sẽ gói dòng `data: { ...plan.row, … }`
  cho đúng 100 cột. Đột biến (thấy đỏ, trả lại): bỏ `updatedAt: new Date(version)` khỏi
  `where` của `claimPost` (ca hai lệnh song song phải đỏ); bỏ cổng `postReadiness`; bỏ
  `skipDuplicates` (ca tag sẵn có thành 500); thay `tourIds.map((tourId, order) …)` bằng
  `[...tourIds].reverse().map(…)`; bỏ `deleteMany({ where: heroOf })` (ca đổi sang thư viện
  phải thấy hai dòng); bỏ `this.garbage.requeue` (ca đổi sang thư viện phải đỏ); dời
  `this.bust(slug)` vào TRONG transaction, trước `claimPost` (ca STALE phải đỏ vì bust đã
  bị gọi).
- [ ] **B9.** Quy trình gate, rồi commit:
  `feat(api): lưu cả form bài viết — tag, tour liên quan, ảnh bìa, cổng đăng`

## Task 4 — API: xoá bài, ký upload ảnh bìa, gom đường ký (một phần G15)

**Files:**

- Modify: `apps/api/src/lib/upload-signing.ts` + `upload-signing.spec.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.service.ts` (`signPhotoUploads` gọi `signUploads`)
- Modify: `apps/api/src/modules/posts/admin-posts.service.ts`, `admin-posts.controller.ts`
- Modify: `apps/api/src/modules/posts/admin-posts.int.spec.ts`

**Interfaces:**

- Consumes: `claimPost`, `bust`, `isPostUploadPublicId`, `postCoverFolder`.
- Produces: `signUploads(cfg, folder, count, now, newBasename?): { params; publicIds }`;
  `AdminPostsService.delete(input)`, `AdminPostsService.signCoverUpload(input)`.

- [ ] **B1. Test trước.** Trong `upload-signing.spec.ts` thêm `signUploads` vào import và
  thêm cuối file:

```ts
describe('signUploads (một phần G15 — một bản cho ảnh tour và ảnh bìa bài viết)', () => {
  it('ký đúng số lượt, cùng một timestamp, tên file do server sinh; publicId đầy đủ cho hàng dọn', () => {
    const names = ['a', 'b'];
    const { params, publicIds } = signUploads(
      CFG,
      'tourism/posts/p1',
      2,
      new Date('2026-10-02T00:00:10.900Z'),
      () => names.shift() ?? 'unexpected',
    );

    expect(params.map((signed) => [signed.folder, signed.publicId, signed.timestamp])).toEqual([
      ['tourism/posts/p1', 'a', 1790899210],
      ['tourism/posts/p1', 'b', 1790899210],
    ]);
    expect(params[0]?.signature).toBe(
      buildSignedUploadParams(CFG, 'tourism/posts/p1', 'a', 1790899210).signature,
    );
    expect(publicIds).toEqual(['tourism/posts/p1/a', 'tourism/posts/p1/b']);
  });
});
```

  ĐỎ, rồi cài cuối `upload-signing.ts` (thêm `import { randomUUID } from 'node:crypto';` đầu
  file):

```ts
/**
 * Ký `count` lượt tải vào `folder`, tên file do server sinh (ADR-0021 §1) — MỘT bản cho ảnh
 * tour (F18) và ảnh bìa bài viết (P4e-4), một phần G15. Trả kèm publicId ĐẦY ĐỦ
 * `<folder>/<basename>` để nơi gọi đưa vào hàng dọn NGAY lúc ký (ADR-0035 §3): Cloudinary
 * lưu asset ở dạng ấy và `destroy` nhận đúng dạng ấy.
 */
export function signUploads(
  cfg: UploadSigningConfig,
  folder: string,
  count: number,
  now: Date,
  newBasename: () => string = randomUUID,
): { params: SignedUploadParams[]; publicIds: string[] } {
  const timestamp = Math.floor(now.getTime() / 1000);
  const params = Array.from({ length: count }, () =>
    buildSignedUploadParams(cfg, folder, newBasename(), timestamp),
  );
  return { params, publicIds: params.map((signed) => `${signed.folder}/${signed.publicId}`) };
}
```

  XANH. Đột biến: `Math.floor` thành `Math.round` (timestamp 1790899211 phải đỏ); publicIds
  thiếu `${signed.folder}/`.

- [ ] **B2. Tour đi qua `signUploads`.** Trong `signPhotoUploads` của
  `admin-tours.service.ts`, thay đoạn từ `const folder = …` tới hết lời gọi
  `await this.garbage.enqueueQuietly(…)` (kể cả comment "Ghi `${folder}/${basename}` ĐẦY
  ĐỦ…" ở giữa — `signUploads` giờ giữ lời dặn ấy) bằng:

```ts
    const { params, publicIds } = signUploads(
      cfg,
      tourPhotoFolder(cfg.rootFolder, input.id),
      input.count,
      new Date(),
    );
    await this.garbage.enqueueQuietly(publicIds);
```

  và đổi `return signed;` thành `return params;`. Gỡ import `randomUUID` và
  `buildSignedUploadParams` (giờ thừa), thêm `signUploads` vào import từ
  `../../lib/upload-signing.js`. Int test ảnh tour hiện có phải xanh nguyên — đó là test của
  bước này.

- [ ] **B3. Int test trước.** Thêm helper sau `fullSave`, và `SignedUploadParamsSchema` vào
  import từ `@tourism/contract`:

```ts
  const remove = (n: number, version: string, cookie = adminCookie) =>
    post(`/api/admin/posts/${postId(n)}/delete`, { id: postId(n), version }, cookie);
  const signCover = (n: number, cookie = adminCookie) =>
    post(`/api/admin/posts/${postId(n)}/cover-upload`, { id: postId(n) }, cookie);
```

  rồi thêm hai `describe` trước dấu `});` cuối:

```ts
  describe('delete', () => {
    it('xoá bài: liên kết tag và tour đi theo, dòng media đi theo, tag ở lại; ảnh tải lên vào hàng dọn; bust', async () => {
      await makePost(1);
      await makeTour(1);
      await save(1, await fullSave(1, { tags: ['Food'], relatedTourIds: [tourId(1)] }));
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await remove(1, await versionOf(1));

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ slug: 'p4e4-post-1' });
      expect(await prisma.post.findUnique({ where: { id: postId(1) } })).toBeNull();
      expect(await prisma.postTagLink.count()).toBe(0);
      expect(await prisma.postTour.count()).toBe(0);
      expect(await prisma.postTag.count()).toBe(1);
      expect(await prisma.mediaAsset.count({ where: { ownerType: 'POST' } })).toBe(0);
      expect((await prisma.mediaGarbage.findMany()).map((row) => row.publicId)).toEqual([
        mine(1, 'new'),
      ]);
      expect(revalidate).toHaveBeenCalledWith(['posts', 'post:p4e4-post-1']);
    });

    it('ảnh bìa thư viện: dòng của bài đi, dòng thư viện ở lại, không gì vào hàng dọn', async () => {
      await makePost(1);
      await makeLibrary();
      await makeCover(1, LIB);

      expect((await remove(1, await versionOf(1))).statusCode).toBe(200);

      expect(await prisma.mediaGarbage.count()).toBe(0);
      expect(await prisma.mediaAsset.count({ where: { ownerType: 'DESTINATION', publicId: LIB } })).toBe(1);
    });

    it('phiên bản cũ: 409 STALE_POST, bài còn nguyên, không bust', async () => {
      await makePost(1);
      const stale = await versionOf(1);
      await save(1, await fullSave(1));
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await remove(1, stale);

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_POST' });
      expect(await prisma.post.count()).toBe(1);
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('bài không có: 404 NOT_FOUND; khách: 403', async () => {
      const ghost = { id: MISSING, version: new Date().toISOString() };
      const res = await post(`/api/admin/posts/${MISSING}/delete`, ghost);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
      await makePost(1);
      expect((await remove(1, await versionOf(1), customerCookie)).statusCode).toBe(403);
    });
  });

  describe('signCoverUpload', () => {
    it('ký một lượt vào thư mục của bài; publicId vào hàng dọn ngay lúc ký', async () => {
      await makePost(1);

      const res = await signCover(1);

      expect(res.statusCode).toBe(200);
      const signed = SignedUploadParamsSchema.parse(res.json());
      expect(signed.folder).toBe(`${ROOT}/posts/${postId(1)}`);
      expect((await prisma.mediaGarbage.findMany()).map((row) => row.publicId)).toEqual([
        `${signed.folder}/${signed.publicId}`,
      ]);
    });

    it('bài không có: 404 NOT_FOUND; khách: 403', async () => {
      const res = await post(`/api/admin/posts/${MISSING}/cover-upload`, { id: MISSING });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
      await makePost(1);
      expect((await signCover(1, customerCookie)).statusCode).toBe(403);
    });
  });
```

  Chạy riêng file int — các ca mới ĐỎ.

- [ ] **B4. Cài service.** Thêm import `type AdminPostDeleteInput`,
  `type AdminPostDeleteResult`, `type AdminPostSignCoverUploadInput`,
  `type SignedUploadParams` từ `@tourism/contract`; `isPostUploadPublicId`, `postCoverFolder`,
  `resolveUploadConfig`, `signUploads` từ `../../lib/upload-signing.js`;
  `PostCoverUploadsNotConfiguredError` vào import lỗi. Thêm vào class, sau `update`:

```ts
  /**
   * Xoá bài (spec §2.7). Một transaction: giành hàng bài (phiên bản) → đọc dòng media →
   * xoá bài (Cascade kéo `post_tag_links`, `post_tours`) → xoá dòng media (bảng đa chủ,
   * không khoá ngoại) → ảnh tải lên của chính bài vào lại hàng dọn. Tag ở lại. Bust sau
   * commit.
   */
  async delete(input: AdminPostDeleteInput): Promise<AdminPostDeleteResult> {
    const now = new Date();
    const deleted = await prisma.$transaction(async (tx) => {
      await claimPost(tx, input.id, input.version, now);
      const owned = { ownerType: MediaOwnerType.POST, ownerId: input.id };
      const media = await tx.mediaAsset.findMany({ where: owned, select: { publicId: true } });
      const removed = await tx.post.delete({ where: { id: input.id }, select: { slug: true } });
      await tx.mediaAsset.deleteMany({ where: owned });
      await this.garbage.requeue(
        tx,
        media
          .map((row) => row.publicId)
          .filter((publicId) =>
            isPostUploadPublicId(env.CLOUDINARY_UPLOAD_FOLDER, input.id, publicId),
          ),
      );
      return removed;
    });

    this.logger.log(`[admin] post deleted ${JSON.stringify({ id: input.id, slug: deleted.slug })}`);
    this.bust(deleted.slug);
    return { slug: deleted.slug };
  }

  /**
   * Ký MỘT lượt tải ảnh bìa vào thư mục của bài (ADR-0051 §7). publicId vào hàng dọn NGAY
   * lúc ký (ADR-0035 §3): tải lên rồi không lưu thì bảy ngày sau tự được dọn.
   */
  async signCoverUpload(input: AdminPostSignCoverUploadInput): Promise<SignedUploadParams> {
    const cfg = resolveUploadConfig(env);
    if (!cfg) throw new PostCoverUploadsNotConfiguredError();
    const exists = await prisma.post.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!exists) throw new AdminPostNotFoundError(input.id);

    const { params, publicIds } = signUploads(
      cfg,
      postCoverFolder(cfg.rootFolder, input.id),
      1,
      new Date(),
    );
    await this.garbage.enqueueQuietly(publicIds);
    const [signed] = params;
    if (signed === undefined) throw new Error('signUploads trả rỗng cho một lượt ký');
    this.logger.log(`[admin] post cover upload signed ${JSON.stringify({ id: input.id })}`);
    return signed;
  }
```

- [ ] **B5. Controller.** Thêm hai phương thức, sau `update`:

```ts
  @Implement(contract.admin.posts.delete)
  delete() {
    return implement(contract.admin.posts.delete).handler(async ({ input, errors }) => {
      try {
        return await this.posts.delete(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.posts.signCoverUpload)
  signCoverUpload() {
    return implement(contract.admin.posts.signCoverUpload).handler(async ({ input, errors }) => {
      try {
        return await this.posts.signCoverUpload(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }
```

- [ ] **B6.** Chạy riêng file int và `admin-tours.int.spec.ts` — XANH cả hai. Đột biến: bỏ
  `filter(isPostUploadPublicId…)` (ca thư viện phải đỏ); bỏ `deleteMany` dòng media; bỏ
  `claimPost` khỏi `delete` (ca STALE phải đỏ); `enqueueQuietly` nhận `[signed.publicId]`
  thiếu thư mục.
- [ ] **B7.** Quy trình gate, rồi commit:
  `feat(api): xoá bài, ký ảnh bìa và gom đường ký upload của tour`

## Task 5 — Web: bộ render dùng chung, khối tour liên quan, G9, hết trần 50

**Files:**

- Modify: `libs/shared/ui/package.json`
- Create (git mv): `libs/shared/ui/src/lib/slug.ts`, `libs/shared/ui/src/lib/slug.spec.ts`
- Create: `apps/web/src/lib/slug.ts` (re-export, thay file vừa dời)
- Create (git mv): `libs/shared/ui/src/components/article-markdown.tsx`
- Modify: `apps/web/src/components/content/article-markdown.spec.tsx` (đường import)
- Modify: `apps/web/src/lib/api/posts.ts` + `posts.spec.ts`
- Create: `apps/web/src/components/blog/post-tours.tsx` + `post-tours.spec.tsx`
- Modify: `apps/web/src/app/(site)/blog/[slug]/page.tsx`

**Interfaces:**

- Produces: `@tourism/ui/components/article-markdown` → `ArticleMarkdown({ markdown })`;
  `@tourism/ui/lib/slug` → `slugify(value)`; `JournalPostDetail.relatedTours: TourCardVM[]`;
  `PostTours({ tours })`. Admin (Task 9) import `ArticleMarkdown` từ `@tourism/ui`.

- [ ] **B1. Hai dependency cho `@tourism/ui`.** Trong `libs/shared/ui/package.json`, mục
  `dependencies`, thêm đúng phiên bản web đang dùng, giữ thứ tự chữ cái:
  `"react-markdown": "^10.1.0",` ngay sau `"react-day-picker"`, và `"remark-gfm": "^4.0.1",`
  ngay sau `"recharts"`. Chạy `pnpm install`. `git diff pnpm-lock.yaml` chỉ được THÊM hai
  dòng phụ thuộc vào importer `libs/shared/ui` — không có gói hay phiên bản mới nào (cả hai
  đã nằm trong lockfile, ADR-0051 §1). Thấy phiên bản mới thì DỪNG và hỏi.

- [ ] **B2. Dời `slugify`.**

```bash
git mv apps/web/src/lib/slug.ts libs/shared/ui/src/lib/slug.ts
git mv apps/web/src/lib/slug.spec.ts libs/shared/ui/src/lib/slug.spec.ts
```

  `slug.spec.ts` import `./slug.js` — giữ nguyên, Vitest của `ui` (môi trường `node`) chạy
  được. Thêm câu JSDoc cho hàm ở `libs/shared/ui/src/lib/slug.ts` (thay dòng JSDoc cũ):

```ts
/**
 * Slug chữ thường nối gạch ngang — id của heading trong bài và anchor của mục lục. Ở
 * `@tourism/ui` từ P4e-4 vì bộ render markdown dùng chung (web và tab Preview của admin)
 * cần nó; web re-export ở `apps/web/src/lib/slug.ts` để mục lục và heading cùng một hàm.
 */
```

  Tạo lại `apps/web/src/lib/slug.ts`:

```ts
/**
 * `slugify` sống ở `@tourism/ui` từ P4e-4 — bộ render markdown dùng chung cần nó. Bốn chỗ
 * của web (mục lục, FAQ, thân bài pháp lý) giữ đường import cũ qua file này, nên id
 * heading và anchor của mục lục luôn ra từ CÙNG một hàm.
 */
export { slugify } from '@tourism/ui/lib/slug';
```

- [ ] **B3. Dời `ArticleMarkdown`.**

```bash
git mv apps/web/src/components/content/article-markdown.tsx libs/shared/ui/src/components/article-markdown.tsx
```

  Trong file vừa dời: đổi `import { slugify } from '@/lib/slug';` thành
  `import { slugify } from '@tourism/ui/lib/slug';`, và thêm đoạn cuối vào JSDoc của
  `ArticleMarkdown`:

```ts
 *
 * Ở `@tourism/ui` từ P4e-4 (ADR-0051 §1): web vẽ bài bằng nó, tab Preview của admin cũng
 * vậy — hai nơi một bản, nên thứ admin xem trước là thứ khách sẽ đọc.
```

  Sửa hai chỗ import cũ của web:
  - `apps/web/src/components/content/article-markdown.spec.tsx`:
    `import { ArticleMarkdown } from './article-markdown';` →
    `import { ArticleMarkdown } from '@tourism/ui/components/article-markdown';`
    (test ở lại web — Quyết định 15). Không đổi ca nào.
  - `apps/web/src/app/(site)/blog/[slug]/page.tsx`:
    `import { ArticleMarkdown } from '@/components/content/article-markdown';` →
    `import { ArticleMarkdown } from '@tourism/ui/components/article-markdown';`

  `grep -rn "content/article-markdown" apps/web/src` phải rỗng. Chạy
  `pnpm --filter @tourism/web exec vitest run src/components/content/article-markdown.spec.tsx`
  và `pnpm --filter @tourism/ui exec vitest run` — xanh nguyên.

- [ ] **B4. Test trước — dữ liệu bài.** Trong `apps/web/src/lib/api/posts.spec.ts`:
  - đổi dòng import vitest thành `import { beforeEach, describe, expect, it, vi } from 'vitest';`
    và dòng import posts thành
    `import { deriveReadMinutes, fetchPostDetail, fetchPosts, toJournalPost, toJournalPostDetail } from './posts';`;
  - thêm ngay sau các import:

```ts
import type { TourCardVM } from './tours';

// Mock client oRPC — chỉ soi procedure, input và tag cache; không gọi API thật.
const { list, bySlug } = vi.hoisted(() => ({ list: vi.fn(), bySlug: vi.fn() }));
vi.mock('./client', () => ({ api: { posts: { list, bySlug } } }));

beforeEach(() => {
  list.mockReset();
  bySlug.mockReset();
});

function tour(slug: string): TourCardVM {
  return {
    id: `id-${slug}`,
    slug,
    title: slug,
    summary: null,
    basePrice: '199.00',
    priceFrom: '199.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 3,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [{ slug: 'hoi-an', name: 'Hoi An', isPrimary: true }],
    category: { slug: 'food', name: 'Food' },
    ratingAvg: 4.5,
    ratingCount: 20,
    cover: null,
  };
}
```

  - thêm cuối file (sau khối `deriveReadMinutes`):

```ts
const DETAIL = {
  ...dto,
  content: '## Layers\n\nBody',
  metaTitle: null,
  metaDescription: null,
  media: [],
  relatedTours: [tour('b-tour'), tour('a-tour')],
};

describe('toJournalPostDetail', () => {
  it('giữ tour liên quan theo ĐÚNG thứ tự API trả (ADR-0051 §5)', () => {
    expect(toJournalPostDetail(DETAIL).relatedTours.map((t) => t.slug)).toEqual([
      'b-tour',
      'a-tour',
    ]);
  });
});

describe('fetchPostDetail (G9)', () => {
  it('mang thêm tag `tours` cạnh `post:<slug>` — sửa hay xoá tour làm tươi trang bài', async () => {
    bySlug.mockResolvedValue(DETAIL);

    await fetchPostDetail(dto.slug);

    expect(bySlug).toHaveBeenCalledWith(
      { slug: dto.slug },
      { context: { next: { revalidate: 300, tags: [`post:${dto.slug}`, 'tours'] } } },
    );
  });
});

describe('fetchPosts (khuôn G10)', () => {
  it('đi hết các trang, giữ thứ tự, bỏ bài trùng giữa hai trang', async () => {
    const card = (n: number) => ({
      ...dto,
      id: `0198c9c4-0000-7000-8000-00000000000${n}`,
      slug: `post-${n}`,
    });
    list
      .mockResolvedValueOnce({ items: [card(1), card(2)], page: 1, limit: 50, total: 3, totalPages: 2 })
      .mockResolvedValueOnce({ items: [card(2), card(3)], page: 2, limit: 50, total: 3, totalPages: 2 });

    const posts = await fetchPosts();

    expect(posts.map((post) => post.slug)).toEqual(['post-1', 'post-2', 'post-3']);
    expect(list).toHaveBeenNthCalledWith(
      2,
      { page: 2, pageSize: 50, sort: 'publishedAt', order: 'desc' },
      { context: { next: { revalidate: 300, tags: ['posts'] } } },
    );
  });
});
```

  `pnpm --filter @tourism/web exec vitest run src/lib/api/posts.spec.ts` — ĐỎ ở ba ca mới
  (`relatedTours` undefined, tag thiếu `tours`, chỉ một trang).

- [ ] **B5. Cài.** Trong `apps/web/src/lib/api/posts.ts`:
  - thêm `import { collectAllPages } from './collect-pages';` và
    `import type { TourCardVM } from './tours';`;
  - `JournalPostDetail` thêm field:

```ts
export interface JournalPostDetail extends JournalPost {
  contentMarkdown: string;
  /** Tour admin gắn với bài, theo thứ tự admin xếp; API đã bỏ tour đang tắt bán (ADR-0051 §5). */
  relatedTours: TourCardVM[];
}
```

  - trong `toJournalPostDetail`, thêm `relatedTours: dto.relatedTours,` sau
    `contentMarkdown: dto.content,`;
  - thay nguyên `fetchPosts` (cả JSDoc) bằng:

```ts
/** Cỡ trang của danh sách bài — trần `PageQuerySchema.pageSize` là 100; 50 như danh sách tour. */
const POSTS_PAGE_SIZE = 50;

/**
 * Trần số trang `fetchPosts` đi qua: 20 × 50 = 1000 bài, xa hơn mọi con số dự án chạm tới.
 * Chỉ để một `totalPages` hỏng từ API không kéo build đi vô tận.
 */
const MAX_POST_PAGES = 20;

/**
 * MỌI bài đã đăng, mới nhất trước — đi hết các trang (khuôn G10 của tour). Trước P4e-4 chỉ
 * lấy trang 1 với 50 bài: admin đăng bài thứ 51 là bài cũ nhất lặng lẽ rời `/blog`, sitemap
 * và điều hướng cuối bài. Mỗi trang gắn `TAGS.POSTS` để revalidate theo taxonomy chung.
 */
export async function fetchPosts(): Promise<JournalPost[]> {
  const { items, totalPages } = await collectAllPages(
    (page) =>
      api.posts.list(
        { page, pageSize: POSTS_PAGE_SIZE, sort: 'publishedAt', order: 'desc' },
        { context: { next: { revalidate: REVALIDATE_SEC, tags: [TAGS.POSTS] } } },
      ),
    { maxPages: MAX_POST_PAGES, key: (post) => post.id },
  );
  // Chạm trần thì nói ra, đừng lặng lẽ cắt — lặng lẽ cắt chính là lỗi G10.
  if (totalPages > MAX_POST_PAGES) {
    console.warn(`[fetchPosts] có ${totalPages} trang bài, chỉ lấy ${MAX_POST_PAGES} trang đầu`);
  }
  return items.map(toJournalPost);
}
```

  - trong `fetchPostDetail`, đổi `tags: [postTag(slug)]` thành `tags: [postTag(slug), TAGS.TOURS]`
    và thêm đoạn cuối vào JSDoc của nó:

```ts
 *
 * Tag `tours` đóng G9 (ADR-0051 §6): mọi lệnh ghi tour vốn đã bust tag này, nên tắt bán
 * hay xoá một tour gắn trong bài thì trang bài cũng tươi lại — API không phải tra
 * `post_tours` trước khi xoá tour.
```

  Chạy lại spec — XANH. Đột biến: bỏ `TAGS.TOURS`; `key: (post) => post.slug` vẫn xanh
  (slug cũng duy nhất — ghi là đột biến tương đương); bỏ `relatedTours` khỏi mapper.

- [ ] **B6. Test trước — khối tour.** Tạo `apps/web/src/components/blog/post-tours.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { TourCardVM } from '@/lib/api/tours';
import { PostTours } from './post-tours';

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function tour(slug: string, title: string): TourCardVM {
  return {
    id: `id-${slug}`,
    slug,
    title,
    summary: null,
    basePrice: '199.00',
    priceFrom: '199.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 3,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [{ slug: 'hoi-an', name: 'Hoi An', isPrimary: true }],
    category: { slug: 'food', name: 'Food' },
    ratingAvg: 4.5,
    ratingCount: 20,
    cover: null,
  };
}

describe('PostTours', () => {
  it('có tour: tiêu đề "Tours in this story" và card theo ĐÚNG thứ tự admin xếp', () => {
    render(<PostTours tours={[tour('b-tour', 'Boat tour'), tour('a-tour', 'Alley tour')]} />);

    expect(
      screen.getByRole('heading', { level: 2, name: messages.blog.toursHeading }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Boat tour', 'Alley tour']);
  });

  it('rỗng: không vẽ gì, kể cả tiêu đề', () => {
    const { container } = render(<PostTours tours={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

  ĐỎ (chưa có component), rồi tạo `post-tours.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import { RelatedTours } from '@/components/tours/related-tours';
import type { TourCardVM } from '@/lib/api/tours';

/**
 * Khối "Tours in this story" cuối bài (ADR-0051 §5): tour admin gắn với bài, theo thứ tự
 * admin xếp — API công khai đã bỏ tour đang tắt bán. Rỗng thì không vẽ gì, kể cả tiêu đề:
 * một tiêu đề không có card nào bên dưới là lời hứa suông. Khung và tiêu đề cùng khuôn khối
 * "More from the journal" ngay dưới nó.
 */
export function PostTours({ tours }: { tours: TourCardVM[] }) {
  if (tours.length === 0) return null;

  return (
    <section
      aria-labelledby="post-tours-heading"
      className="w-full px-4 pb-16 md:px-16 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <h2
          id="post-tours-heading"
          className="mb-8 font-heading text-2xl font-medium text-foreground"
        >
          {messages.blog.toursHeading}
        </h2>
        <RelatedTours tours={tours} />
      </div>
    </section>
  );
}
```

  XANH. Đột biến: bỏ `if (tours.length === 0) return null;` (ca rỗng phải đỏ).

- [ ] **B7. Gắn vào trang bài.** Trong `app/(site)/blog/[slug]/page.tsx`: thêm
  `import { PostTours } from '@/components/blog/post-tours';`, rồi chèn
  `<PostTours tours={post.relatedTours} />` giữa thẻ `</div>` đóng khối thân bài (khối
  `w-full px-4 py-16 …`) và `<section` của "More from the journal". Thêm một comment ngay
  trên nó: `{/* Tour gắn với bài (ADR-0051 §5) — sau thân bài, trước "More from the journal". */}`

- [ ] **B8. Gate.** Bước build web của Quy trình gate prerender trang bài thật từ API cổng
  3001 — đó là phép thử của B7. Không đụng `post-card.tsx`, `post-hero.tsx` (Quyết định 3).
- [ ] **B9.** Commit:
  `feat(web): bộ render markdown dùng chung, khối tour liên quan, trang bài tươi khi tour đổi`

## Task 6 — Admin: copy, bật mục Posts, bảng `/posts`, hộp New post

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `admin.posts` trọn vẹn — các task sau
  chỉ đọc)
- Modify: `apps/admin/src/lib/nav.ts`, `lib/nav.spec.ts`, `components/nav-main.spec.tsx`
- Create: `apps/admin/src/lib/posts-query.ts` + spec
- Create: `apps/admin/src/lib/posts-view.ts` + spec
- Create: `apps/admin/src/lib/posts-write.ts` + spec
- Create: `apps/admin/src/lib/api/posts.ts`
- Create: `apps/admin/src/app/(admin)/posts/page.tsx`, `apps/admin/src/app/(admin)/posts/actions.ts`
- Create: `apps/admin/src/components/posts/posts-toolbar.tsx`
- Create: `apps/admin/src/components/posts/posts-table.tsx` + spec
- Create: `apps/admin/src/components/posts/new-post-dialog.tsx` + spec

**Interfaces:**

- Consumes: contract của Task 1.
- Produces: `messages.admin.posts.{list, status, create, editor, delete}`;
  `PostsStatusTab`, `PostsQuery`, `parsePostsStatus`, `parsePostsSearchParams`,
  `PostsHrefPatch`, `postsHref`, `toPostsListInput`; `POSTS_LIST_HREF`,
  `postEditorHref(slug)`, `postStatusLabel(status)`, `POST_STATUS_VARIANT`, `PostRowVM`,
  `toPostRowVM(row)`;
  `CreatePostContractCode`, `CREATE_POST_CONTRACT_CODES`, `classifyCreatePostError`,
  `createPostErrorCopy`, `CreatePostResult`, `CreatePostAction`, `PostCreateFormValues`,
  `PostCreateFormErrors`, `validatePostCreateForm`, `postCreatePayload`;
  `fetchAdminPosts(cookie, query)`, `createAdminPost(cookie, input)`; `createPostAction`;
  `PostsStatusTabs`, `PostsSearch`, `PostsClearFilters`, `PostsTable`, `NewPostDialog`.

- [ ] **B1. Copy.** Trong `messages.ts`, chèn khối dưới ngay TRƯỚC khối JSDoc mở đầu
  `* Vùng outbox (spec P4c §3-F7)` (tức ngay sau dấu `},` đóng khối `tours` của `admin`).
  Mọi câu hứa hệ quả đã đo — nguồn ghi ở JSDoc cạnh câu (bài học 11):

```ts
    /**
     * Vùng bài viết (spec P4e-4, ADR-0051) — bảng `/posts`, hộp New post, trang sửa một
     * bài, vùng xoá. Mã lỗi dưới `errors`/`signErrors` của từng khối là NGUỒN tập mã phía
     * admin (`createWriteErrorCodec` derive từ keys) — phải đủ mọi mã contract khai.
     */
    posts: {
      list: {
        statusLabel: 'Post status',
        statusAll: 'All',
        statusPublished: 'Published',
        statusScheduled: 'Scheduled',
        statusDraft: 'Drafts',
        searchLabel: 'Search posts',
        searchPlaceholder: 'Title',
        columns: {
          post: 'Post',
          status: 'Status',
          published: 'Published',
          tags: 'Tags',
          updated: 'Updated',
        },
        empty: 'No posts match these filters.',
        noImage: 'No cover photo yet',
        /** Ô trống của cột Tags — cùng dấu gạch với ô trống của mọi bảng admin. */
        noTags: '—',
      },
      /** Ba trạng thái HIỂN THỊ (`postDisplayStatus`) — chip ở bảng và ở phần đầu trang sửa. */
      status: { draft: 'Draft', scheduled: 'Scheduled', published: 'Published' },
      create: {
        errors: {
          SLUG_TAKEN: 'Another post already uses this slug. Pick a different one.',
        },
        action: 'New post',
        dialog: {
          title: 'New post',
          /** Đo: `create` sinh bài DRAFT, thân bài rỗng (`admin-posts.service.ts`). */
          body: 'It starts as a draft. Write it, add an excerpt and a cover photo, then publish it.',
          submit: 'Create post',
          submitting: 'Creating…',
          cancel: 'Cancel',
        },
        title: 'Title',
        slug: 'Slug',
        slugHint: SLUG_HINT_COPY,
        toast: { title: 'Post created', body: 'It stays a draft until you publish it.' },
      },
      editor: {
        back: 'Back to posts',
        viewOnSite: 'View on site',
        lastSaved: (when: string) => `Last saved ${when}`,
        saved: 'Post saved',
        save: 'Save',
        saving: 'Saving…',
        /** Còn ảnh bìa đang tải lên: lưu lúc này là lưu thiếu đúng ảnh ấy. */
        busyUploading: 'Wait for the cover photo to finish uploading.',
        fields: {
          title: 'Title',
          excerpt: 'Excerpt',
          /** Đo: card `/blog` in excerpt (`post-card.tsx`); trang bài in nó làm câu mở đầu (`blog/[slug]/page.tsx`). */
          excerptHint: 'Shows on the post card and as the opening line of the post.',
          count: (n: number, max: number) => `${n} / ${max}`,
          content: 'Content',
        },
        markdown: {
          toolbar: 'Formatting',
          heading: 'Heading',
          bold: 'Bold',
          italic: 'Italic',
          bullet: 'Bulleted list',
          link: 'Link',
          write: 'Write',
          preview: 'Preview',
          /** Đúng luật của contract (`postContentIssue`): không ảnh, không HTML. */
          syntax:
            'Use ## for headings, **bold**, *italic*, - for lists and [text](https://…) for links. Images and HTML are not allowed.',
          previewEmpty: 'Nothing to preview yet.',
        },
        publish: {
          title: 'Publish',
          statusLabel: 'Status',
          draft: 'Draft',
          published: 'Published',
          /** Đo: mọi đường công khai lọc `publishedPostWhere` — nháp không lên web. */
          draftHint: 'Drafts stay off the site.',
          dateLabel: 'Publish date (UTC)',
          /** Đo: ISR 300 giây của `/blog` và trang bài (`REVALIDATE_SEC`, `apps/web/src/lib/api/posts.ts`). */
          dateHint:
            'Pick a future time to schedule it. A scheduled post appears on the site within about 5 minutes of that time.',
          checklist: 'Before publishing',
          missing: 'Missing — required to publish',
          readiness: { content: 'Content', excerpt: 'An excerpt', cover: 'A cover photo' },
        },
        cover: {
          title: 'Cover photo',
          /** Đo: card `/blog` (`post-card.tsx`) và phần đầu trang bài (`post-hero.tsx`) cùng vẽ ảnh bìa. */
          intro: 'Shows on the post card and across the top of the post.',
          empty: 'No cover photo yet.',
          upload: 'Upload',
          library: 'Choose from library',
          remove: 'Remove',
          formats: 'JPG, PNG, WebP, AVIF or GIF, up to 10 MB.',
          alt: 'Alt text',
          /** Quyết định 3 của plan P4e-4: trống thì web vẽ `alt=""`, tiêu đề in ngay cạnh ảnh. */
          altHint:
            'Optional. Describe the photo for people who can’t see it — leave it empty if it only decorates the post.',
          /** Khoá đúng tên giá trị `PostCoverSource` của contract — `source[cover.source]` gõ kiểu được. */
          source: {
            UPLOAD: 'Uploaded',
            LIBRARY: 'From the library',
            CATALOG: 'Catalogue photo',
          },
          /** ADR-0048 AMEND 1 áp cho bài viết: ảnh catalog không có trong kho thư viện. */
          catalogueWarning: 'It can’t be chosen again once replaced or removed.',
          uploading: (percent: number) => `Uploading ${percent}%`,
          uploadFailed: 'The photo didn’t upload. Try again.',
          skipped: {
            type: (name: string) => `${name} isn’t a JPG, PNG, WebP, AVIF or GIF.`,
            size: (name: string) => `${name} is larger than 10 MB.`,
          },
        },
        tags: {
          title: 'Tags',
          inputLabel: 'Add a tag',
          /** Đo: tag mới tạo lúc lưu (`replaceTags`); trần `POST_TAGS_MAX`. */
          hint: (max: number) =>
            `Press Enter to add. New tags are created when you save. Up to ${max}.`,
          add: 'Add',
          remove: (name: string) => `Remove tag ${name}`,
          suggestions: 'Existing tags',
          useSuggestion: (name: string) => `Add tag ${name}`,
          full: (max: number) => `A post can have up to ${max} tags.`,
          duplicate: (name: string) => `${name} is already on this post.`,
          invalid: 'A tag needs at least one letter or number.',
          tooLong: (max: number) => `Keep a tag to ${max} characters or fewer.`,
        },
        tours: {
          title: 'Related tours',
          /** Đo: trang bài in khối "Tours in this story" theo `post_tours.order` (`PostTours`). */
          intro: 'Shown under the post as “Tours in this story”, in this order.',
          searchLabel: 'Find a tour',
          searchPlaceholder: 'Tour title',
          add: (title: string) => `Add ${title}`,
          noMatch: 'No tour matches that title.',
          full: (max: number) => `A post can have up to ${max} related tours.`,
          empty: 'No related tours yet.',
          itemName: (n: number) => `tour ${n}`,
          offSale: 'Off sale',
          /** Đo: `getPostBySlug` lọc `tour.isPublished`. */
          offSaleNote: 'Tours that are off sale stay hidden on the site until they go back on sale.',
        },
        banners: {
          stale:
            'Someone else saved this post while you were editing. Reload to see their version — your changes here will be lost.',
          reload: 'Reload',
          notReady: 'A published post needs these before it can be saved:',
        },
        form: {
          errors: {
            required: 'Fill this in.',
            tooLong: (max: number) => `Keep it to ${max} characters or fewer.`,
            image: 'Images can’t go inside the post. Use the cover photo instead.',
            html: 'HTML isn’t allowed. Use the formatting buttons instead.',
            publishDate: 'Pick a date and time.',
            slugShape: SLUG_SHAPE_COPY,
          },
        },
        /** Mã CONTRACT của `admin.posts.update`. */
        errors: {
          STALE_POST: 'Someone else saved this post while you were editing.',
          POST_NOT_READY: 'A published post needs content, an excerpt and a cover photo.',
          /** Ca thật duy nhất: ảnh thư viện mất dòng địa danh giữa lúc chọn và lúc lưu. */
          PHOTO_NOT_ALLOWED:
            'This cover photo is no longer available. Choose another one, then save again.',
          RELATED_TOUR_NOT_FOUND: 'A tour you picked no longer exists. Remove it, then save again.',
          NOT_FOUND: 'This post no longer exists.',
        },
        /** Mã CONTRACT của `admin.posts.signCoverUpload`. */
        signErrors: {
          MEDIA_UPLOAD_NOT_CONFIGURED: 'Uploads are not set up on this server.',
          NOT_FOUND: 'This post no longer exists.',
        },
        signFailed: 'The upload could not start. Try again in a moment.',
      },
      delete: {
        /** Cả hai là mã trạng-thái-cũ: đóng hộp, toast, refresh (hoặc về danh sách). */
        errors: {
          STALE_POST: 'Someone else saved this post while you were editing. Reload, then try again.',
          NOT_FOUND: 'This post no longer exists.',
        },
        title: 'Delete this post',
        body: 'Removes the post from the site and from the back office.',
        action: 'Delete post',
        dialog: {
          title: 'Delete this post?',
          /**
           * Đo trên `admin-posts.service.ts` (`delete`) và `schema.prisma`: Cascade kéo
           * `post_tag_links`, `post_tours`; dòng media xoá trong cùng transaction; bust ngay
           * sau commit; ảnh tải lên của bài vào hàng dọn — bộ dọn xoá sau 7 ngày (ADR-0035,
           * cron 04:00 UTC); tag và ảnh thư viện ở lại.
           */
          body: 'This removes the post for good, with its tag and tour links, and its page stops working. A cover photo you uploaded for it is deleted from storage about a week later; library photos and the tags themselves stay.',
          warning: 'This cannot be undone.',
          submit: 'Delete post',
          submitting: 'Deleting…',
          cancel: 'Cancel',
        },
        rows: { post: 'Post', status: 'Status' },
        toast: {
          title: 'Post deleted',
          body: (title: string) => `${title} is gone from the site.`,
        },
      },
    },
```

  Build lại i18n (lệnh ở Ràng buộc toàn cục).

- [ ] **B2. Bật mục Posts.** `lib/nav.ts`: thay dòng
  `{ key: 'posts', label: t.posts, href: '/posts', enabled: false, icon: FileText },` bằng:

```ts
      // Vùng thứ tư của P4e (P4e-4) — bài viết. Href TRƠN: không có "việc cần làm"
      // mặc định, tab All là câu hỏi thường ngày (bài nào sửa gần nhất).
      { key: 'posts', label: t.posts, href: '/posts', enabled: true, icon: FileText },
```

  Hai test đang dùng Posts làm ví dụ mục tắt chuyển sang Media library (vẫn tắt):
  - `lib/nav.spec.ts`, ca "mục chưa mở": `item('posts')` → `item('media')`;
    `soonItem('Posts')` → `soonItem('Media library')`; `'Posts · Soon'` →
    `'Media library · Soon'`.
  - `components/nav-main.spec.tsx`, ca "mục chưa mở tiêu điểm được": `const posts = …
    { name: 'Posts' }` → `const media = … { name: 'Media library' }` (đổi cả ba chỗ dùng
    biến) và `'Posts · Soon'` → `'Media library · Soon'`.

  Chạy hai spec — xanh. Đột biến: để `enabled: false` cho Posts — không ca nào đỏ (ghi vào
  báo cáo; Task 6 B7 có ca của bảng, còn sidebar thật soi ở bước thử tay).

- [ ] **B3. Test trước — trạng thái trên URL.** Tạo `lib/posts-query.spec.ts`:

```ts
import { POST_TITLE_MAX } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { parsePostsSearchParams, parsePostsStatus, postsHref, toPostsListInput } from './posts-query';

describe('parsePostsSearchParams', () => {
  it('rác trên URL rơi về mặc định an toàn, không ném lên API', () => {
    expect(parsePostsSearchParams({ status: 'archived', q: '   ', page: 'x' })).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it('đọc tab, ô tìm (trim) và trang', () => {
    expect(parsePostsSearchParams({ status: 'scheduled', q: '  Hoi An ', page: '2' })).toEqual({
      page: 2,
      limit: 20,
      status: 'scheduled',
      search: 'Hoi An',
    });
  });

  it('ô tìm cắt đúng trần tiêu đề của contract', () => {
    const query = parsePostsSearchParams({ q: 'x'.repeat(POST_TITLE_MAX + 5) });
    expect(query.search).toHaveLength(POST_TITLE_MAX);
  });
});

describe('parsePostsStatus', () => {
  it('chỉ ba tab; "all" và chữ hoa là không hợp lệ (URL dùng chữ thường)', () => {
    expect(parsePostsStatus('draft')).toBe('draft');
    expect(parsePostsStatus('all')).toBeNull();
    expect(parsePostsStatus('DRAFT')).toBeNull();
  });
});

describe('postsHref', () => {
  const base = { page: 3, limit: 20, status: 'draft' as const, search: 'tea' };

  it('đổi tab đặt lại trang về 1', () => {
    expect(postsHref(base, { status: 'published' })).toBe('/posts?status=published&q=tea');
  });

  it('`null` xoá bộ lọc; về mặc định thì không còn dấu `?`', () => {
    expect(postsHref(base, { status: null, search: null })).toBe('/posts');
  });

  it('đổi trang giữ bộ lọc, thứ tự param cố định', () => {
    expect(postsHref({ ...base, page: 1 }, { page: 2 })).toBe('/posts?status=draft&q=tea&page=2');
  });
});

describe('toPostsListInput', () => {
  it('vắng tab là all; vắng ô tìm thì không gửi', () => {
    expect(toPostsListInput({ page: 1, limit: 20 })).toEqual({ page: 1, limit: 20, status: 'all' });
  });
});
```

  ĐỎ, rồi tạo `lib/posts-query.ts`:

```ts
import { type AdminPostsListQuery, POST_TITLE_MAX } from '@tourism/contract';
import {
  appendPaging,
  clampSearch,
  firstParam,
  parsePaging,
  pickPatch,
  type RawSearchParams,
  resolvePagePatch,
  tableHref,
} from './table-query';

/**
 * Trạng thái bảng `/posts` sống TRÊN URL (spec P4e-4 §4.2) — cùng khuôn
 * `enquiries-query.ts`: `?status=published|scheduled|draft`, `?q=` tìm theo tiêu đề, phân
 * trang của kit. Vắng `status` là tab All — mặc định thì không cần viết ra URL.
 */
export type PostsStatusTab = Exclude<AdminPostsListQuery['status'], 'all'>;

const STATUS_TABS: readonly PostsStatusTab[] = ['published', 'scheduled', 'draft'];

export interface PostsQuery {
  page: number;
  limit: number;
  status?: PostsStatusTab;
  search?: string;
}

/** Chữ bất kỳ → tab hợp lệ hoặc `null` — dùng cho cả URL lẫn giá trị của dải tab. */
export function parsePostsStatus(value: string | undefined): PostsStatusTab | null {
  return STATUS_TABS.find((tab) => tab === value) ?? null;
}

/** URL là thứ NGƯỜI gõ được: rác rơi về mặc định an toàn, không thành 400 ở API. */
export function parsePostsSearchParams(raw: RawSearchParams): PostsQuery {
  const status = parsePostsStatus(firstParam(raw.status));
  const search = clampSearch(firstParam(raw.q), POST_TITLE_MAX);
  return {
    ...parsePaging(raw),
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
  };
}

/** `undefined` = giữ nguyên, `null` = xoá bộ lọc (luật chung ở kit `pickPatch`). */
export interface PostsHrefPatch {
  page?: number;
  limit?: number;
  status?: PostsStatusTab | null;
  search?: string | null;
}

/** Đổi tab, ô tìm hay số dòng đều đặt lại trang về 1 (kit `resolvePagePatch`). */
export function postsHref(current: PostsQuery, patch: PostsHrefPatch): string {
  const scopeChanged =
    patch.status !== undefined || patch.search !== undefined || patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);
  const status = pickPatch(patch.status, current.status);
  const search = clampSearch(pickPatch(patch.search, current.search), POST_TITLE_MAX);

  const params = new URLSearchParams();
  // Thứ tự param CỐ ĐỊNH để href ổn định giữa hai lần render.
  if (status) params.set('status', status);
  if (search) params.set('q', search);
  appendPaging(params, paging);
  return tableHref('/posts', params);
}

/** Input của `admin.posts.list`: vắng tab là `all`. */
export function toPostsListInput(query: PostsQuery): AdminPostsListQuery {
  return {
    page: query.page,
    limit: query.limit,
    status: query.status ?? 'all',
    ...(query.search ? { search: query.search } : {}),
  };
}
```

  XANH. Đột biến: `scopeChanged` bỏ vế `status`; đảo thứ tự `status`/`q`.

- [ ] **B4. Test trước — hàng bảng.** Tạo `lib/posts-view.spec.ts`:

```ts
import type { AdminPostRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { postEditorHref, toPostRowVM } from './posts-view';

const ROW: AdminPostRow = {
  id: '7a1b2c3d-0000-4000-8000-0000000000b1',
  slug: 'eating-your-way-through-hoi-an',
  title: 'Eating your way through Hội An',
  status: 'PUBLISHED',
  publishedAt: '2026-10-05T09:30:00.000Z',
  displayStatus: 'scheduled',
  coverUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/posts/x/cover',
  tags: [
    { slug: 'art', name: 'Art' },
    { slug: 'zen', name: 'Zen' },
  ],
  updatedAt: '2026-10-02T10:11:12.345Z',
};

describe('toPostRowVM', () => {
  it('bài hẹn giờ: chip Scheduled, ngày đăng theo UTC, tag nối dấu phẩy, ảnh 160px', () => {
    expect(toPostRowVM(ROW)).toEqual({
      id: ROW.id,
      slug: ROW.slug,
      title: ROW.title,
      editorHref: '/posts/eating-your-way-through-hoi-an',
      displayStatus: 'scheduled',
      statusLabel: 'Scheduled',
      published: '5 Oct 2026, 09:30 UTC',
      tags: 'Art, Zen',
      updated: '2 Oct 2026, 10:11 UTC',
      thumbUrl:
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_160/v1/tourism/posts/x/cover',
    });
  });

  it('nháp còn giữ ngày đăng cũ trong DB: KHÔNG in ngày ấy; không tag, không ảnh', () => {
    const vm = toPostRowVM({
      ...ROW,
      status: 'DRAFT',
      displayStatus: 'draft',
      tags: [],
      coverUrl: null,
    });
    expect(vm.statusLabel).toBe(messages.admin.posts.status.draft);
    expect(vm.published).toBe('—');
    expect(vm.tags).toBe('—');
    expect(vm.thumbUrl).toBeNull();
  });
});

describe('postEditorHref', () => {
  it('trang sửa nằm dưới /posts', () => {
    expect(postEditorHref('a-b')).toBe('/posts/a-b');
  });
});
```

  ĐỎ, rồi tạo `lib/posts-view.ts`:

```ts
import type { AdminPostRow, PostDisplayStatus } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatDateTime } from './bookings-view';
import { withDeliveryTransform } from './cloudinary-url';

/**
 * Mapper hiển thị vùng `/posts` (spec P4e-4 §4.2) — THUẦN, ngoài React nên test được
 * từng nhánh; bảng chỉ render VM có sẵn. Giờ in theo UTC bằng `formatDateTime` — một khuôn
 * giờ cho cả back office.
 */
const t = messages.admin.posts;

/** Trang danh sách — đích của nút Back và của lệnh xoá. */
export const POSTS_LIST_HREF = '/posts';

/** Trang sửa một bài. */
export function postEditorHref(slug: string): string {
  return `/posts/${encodeURIComponent(slug)}`;
}

/** Nhãn chip trạng thái — một bản cho bảng và phần đầu trang sửa. */
export function postStatusLabel(status: PostDisplayStatus): string {
  return t.status[status];
}

/**
 * Kiểu chip của từng trạng thái — một bản cho bảng và phần đầu trang sửa. Ba mức khác nhau
 * bằng cả mắt lẫn chữ: nháp viền, hẹn giờ nền phụ, đã đăng nền chính.
 */
export const POST_STATUS_VARIANT = {
  draft: 'outline',
  scheduled: 'secondary',
  published: 'default',
} as const satisfies Record<PostDisplayStatus, 'outline' | 'secondary' | 'default'>;

export interface PostRowVM {
  id: string;
  slug: string;
  title: string;
  editorHref: string;
  displayStatus: PostDisplayStatus;
  statusLabel: string;
  /** Ngày đăng đã format; nháp in "—" dù DB còn giữ ngày cũ (spec §2.2). */
  published: string;
  tags: string;
  updated: string;
  thumbUrl: string | null;
}

export function toPostRowVM(row: AdminPostRow): PostRowVM {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    editorHref: postEditorHref(row.slug),
    displayStatus: row.displayStatus,
    statusLabel: postStatusLabel(row.displayStatus),
    published: formatDateTime(row.displayStatus === 'draft' ? null : row.publishedAt),
    tags: row.tags.length === 0 ? t.list.noTags : row.tags.map((tag) => tag.name).join(', '),
    updated: formatDateTime(row.updatedAt),
    // Ô 40px — bản rộng 160px đủ nét cả màn mật độ cao, không tải nguyên ảnh 2400px.
    thumbUrl: row.coverUrl === null ? null : withDeliveryTransform(row.coverUrl, 'w_160'),
  };
}
```

  XANH. Đột biến: bỏ vế `displayStatus === 'draft'` (ca nháp phải đỏ).

- [ ] **B5. Test trước — lớp ghi của hộp New post.** Tạo `lib/posts-write.spec.ts`:

```ts
import { contract, POST_SLUG_MAX, POST_TITLE_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  CREATE_POST_CONTRACT_CODES,
  postCreatePayload,
  validatePostCreateForm,
} from './posts-write';

const fe = messages.admin.posts.editor.form.errors;
const codes = (errorMap: object) => Object.keys(errorMap).sort();

describe('tập mã lỗi khớp contract (codec derive từ i18n, không từ contract)', () => {
  it('hộp New post phủ ĐÚNG các mã `admin.posts.create` khai', () => {
    expect([...CREATE_POST_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.posts.create['~orpc'].errorMap),
    );
  });
});

describe('hộp New post', () => {
  it('trống thì cả hai ô báo "Fill this in"', () => {
    expect(validatePostCreateForm({ title: '  ', slug: '' })).toEqual({
      title: fe.required,
      slug: fe.required,
    });
  });

  it('trần tiêu đề và slug của contract', () => {
    expect(
      validatePostCreateForm({ title: 'x'.repeat(POST_TITLE_MAX + 1), slug: 'a'.repeat(POST_SLUG_MAX + 1) }),
    ).toEqual({ title: fe.tooLong(POST_TITLE_MAX), slug: fe.tooLong(POST_SLUG_MAX) });
    expect(
      validatePostCreateForm({ title: 'x'.repeat(POST_TITLE_MAX), slug: 'a'.repeat(POST_SLUG_MAX) }),
    ).toEqual({});
  });

  it('slug sai hình dạng', () => {
    expect(validatePostCreateForm({ title: 'A', slug: 'Bad Slug' }).slug).toBe(fe.slugShape);
  });

  it('payload cắt khoảng trắng hai ô', () => {
    expect(postCreatePayload({ title: '  Tea  ', slug: ' tea ' })).toEqual({
      title: 'Tea',
      slug: 'tea',
    });
  });
});
```

  ĐỎ, rồi tạo `lib/posts-write.ts`:

```ts
import {
  type AdminPostCreateInput,
  type AdminPostCreateResult,
  POST_SLUG_MAX,
  POST_TITLE_MAX,
  SLUG_PATTERN,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';

/**
 * Lớp ghi của vùng bài viết (spec P4e-4) — codec lỗi, hợp đồng vận chuyển của server
 * action, form hộp New post. THUẦN để test được; server action chỉ re-parse và gọi.
 */
const t = messages.admin.posts;
const fe = t.editor.form.errors;

// ── Codec ───────────────────────────────────────────────────────────────────

const createCodec = createWriteErrorCodec(t.create.errors);

export type CreatePostContractCode = keyof typeof t.create.errors;
export const CREATE_POST_CONTRACT_CODES = createCodec.codes;
export const classifyCreatePostError = createCodec.classify;
export const createPostErrorCopy = createCodec.copy;

// ── Hợp đồng vận chuyển của server action ──────────────────────────────────

export type CreatePostResult =
  | { ok: true; created: AdminPostCreateResult }
  | { ok: false; code: CreatePostContractCode | TransportFailureCode };

export type CreatePostAction = (input: AdminPostCreateInput) => Promise<CreatePostResult>;

// ── Hộp New post ────────────────────────────────────────────────────────────

export interface PostCreateFormValues {
  title: string;
  slug: string;
}

export interface PostCreateFormErrors {
  title?: string;
  slug?: string;
}

/** Kiểm bằng CHÍNH các trần của contract — form không cho qua thứ server sẽ trả 400. */
export function validatePostCreateForm(values: PostCreateFormValues): PostCreateFormErrors {
  const errors: PostCreateFormErrors = {};
  const title = values.title.trim();
  if (title === '') errors.title = fe.required;
  else if (title.length > POST_TITLE_MAX) errors.title = fe.tooLong(POST_TITLE_MAX);

  const slug = values.slug.trim();
  if (slug === '') errors.slug = fe.required;
  else if (slug.length > POST_SLUG_MAX) errors.slug = fe.tooLong(POST_SLUG_MAX);
  else if (!SLUG_PATTERN.test(slug)) errors.slug = fe.slugShape;
  return errors;
}

export function postCreatePayload(values: PostCreateFormValues): AdminPostCreateInput {
  return { title: values.title.trim(), slug: values.slug.trim() };
}
```

  XANH. Đột biến: bỏ kiểm `SLUG_PATTERN`; bỏ `.trim()` của payload.

- [ ] **B6. Đường API, server action, trang.** Tạo `lib/api/posts.ts`:

```ts
import type {
  AdminPostCreateInput,
  AdminPostCreateResult,
  AdminPostRow,
  Paged,
} from '@tourism/contract';
import { type PostsQuery, toPostsListInput } from '@/lib/posts-query';
import { api, withAdminAuth } from './client';

/**
 * Các đường của vùng bài viết — bọc mỏng `admin.posts.*` (spec P4e-4 §3). KHÔNG nuốt lỗi
 * ở đường ghi: mã contract phải tới server action nguyên vẹn để đổi thành mã UI.
 *
 * KHÔNG cache: bài đổi ngay dưới tay admin, `router.refresh()` sau mỗi lần lưu phải kéo
 * về sự thật mới.
 */

/** Một trang bài; input là kết quả `parsePostsSearchParams`, tức đã clamp. */
export async function fetchAdminPosts(
  cookie: string,
  query: PostsQuery,
): Promise<Paged<AdminPostRow>> {
  return api.admin.posts.list(toPostsListInput(query), { context: withAdminAuth(cookie) });
}

export async function createAdminPost(
  cookie: string,
  input: AdminPostCreateInput,
): Promise<AdminPostCreateResult> {
  return api.admin.posts.create(input, { context: withAdminAuth(cookie) });
}
```

  Tạo `app/(admin)/posts/actions.ts`:

```ts
'use server';

import {
  type AdminPostCreateInput,
  AdminPostCreateInputSchema,
  type AdminPostCreateResult,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { createAdminPost } from '@/lib/api/posts';
import { type CreatePostResult, classifyCreatePostError } from '@/lib/posts-write';

/**
 * Hành vi GHI của trang `/posts` — cùng khuôn `tours/actions.ts`: re-parse bằng CHÍNH
 * schema contract (hỏng là `INVALID_INPUT`), `cookies()` gọi ngoài `try`, `try` chỉ ôm
 * đúng lời gọi API. Quyền gác ở `AuthGuard` + `@Roles(ADMIN)` của API. Client tự điều
 * hướng vào trang sửa của bài mới.
 */
export async function createPostAction(input: AdminPostCreateInput): Promise<CreatePostResult> {
  const parsed = AdminPostCreateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let created: AdminPostCreateResult;
  try {
    created = await createAdminPost(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action — phân loại tại đây.
    return { ok: false, code: classifyCreatePostError(error) };
  }
  return { ok: true, created };
}
```

  Tạo `app/(admin)/posts/page.tsx` (đọc hướng dẫn Next 16 trước — Ràng buộc toàn cục):

```tsx
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { PostsTable } from '@/components/posts/posts-table';
import { fetchAdminPosts } from '@/lib/api/posts';
import { getServerSession } from '@/lib/api/session';
import { parsePostsSearchParams, postsHref } from '@/lib/posts-query';
import { toPostRowVM } from '@/lib/posts-view';
import { orphanPageHref, type RawSearchParams } from '@/lib/table-query';
import { createPostAction } from './actions';

/**
 * `/posts` — bảng bài viết (spec P4e-4 §4.2). Server component đúng nếp `/tours`:
 * `searchParams` → input contract → fetch oRPC kèm cookie forward → một trang đã format
 * xuống bảng client. Hộp New post nhận server action qua prop (test được với hàm giả).
 */
export const metadata: Metadata = {
  title: 'Posts — Nexora back office',
};

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parsePostsSearchParams(await searchParams);
  const cookie = (await cookies()).toString();
  const [session, paged] = await Promise.all([getServerSession(), fetchAdminPosts(cookie, query)]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở lần điều hướng kế.
  if (!session) return null;

  // Trang mồ côi: tab co lại sau khi xoá hay gỡ đăng — về trang cuối còn thật.
  const orphan = orphanPageHref(paged, query, (page) => postsHref(query, { page }));
  if (orphan) redirect(orphan);

  return (
    <AdminShell user={session}>
      <PostsTable
        rows={paged.items.map(toPostRowVM)}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
        create={createPostAction}
      />
    </AdminShell>
  );
}
```

- [ ] **B7. Test trước — bảng.** Tạo `components/posts/posts-table.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { PostsQuery } from '@/lib/posts-query';
import type { PostRowVM } from '@/lib/posts-view';
import { PostsTable } from './posts-table';

/**
 * Bảng `/posts` (spec P4e-4 §4.2) — soi phần RIÊNG của vùng, không soi lại kit: tiêu đề
 * là link sang trang sửa, chip nói đúng trạng thái hiển thị, ô ảnh trống vẫn có chữ.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const t = messages.admin.posts.list;

const row = (patch: Partial<PostRowVM> = {}): PostRowVM => ({
  id: '7a1b2c3d-0000-4000-8000-0000000000b1',
  slug: 'eating-your-way-through-hoi-an',
  title: 'Eating your way through Hội An',
  editorHref: '/posts/eating-your-way-through-hoi-an',
  displayStatus: 'scheduled',
  statusLabel: messages.admin.posts.status.scheduled,
  published: '5 Oct 2026, 09:30 UTC',
  tags: 'Art, Zen',
  updated: '2 Oct 2026, 10:11 UTC',
  thumbUrl: null,
  ...patch,
});

const QUERY: PostsQuery = { page: 1, limit: 20 };

function renderTable(rows: PostRowVM[]) {
  return render(
    <PostsTable rows={rows} query={QUERY} total={rows.length} totalPages={1} create={vi.fn()} />,
  );
}

describe('PostsTable', () => {
  it('tiêu đề là link sang trang sửa; slug in ngay dưới', () => {
    renderTable([row()]);
    expect(
      screen.getByRole('link', { name: 'Eating your way through Hội An' }),
    ).toHaveAttribute('href', '/posts/eating-your-way-through-hoi-an');
    expect(screen.getByText('eating-your-way-through-hoi-an')).toBeInTheDocument();
  });

  it('chip trạng thái, ngày đăng, tag và lần sửa cuối in đúng chữ của VM', () => {
    renderTable([row()]);
    expect(screen.getByText(messages.admin.posts.status.scheduled)).toBeInTheDocument();
    expect(screen.getByText('5 Oct 2026, 09:30 UTC')).toBeInTheDocument();
    expect(screen.getByText('Art, Zen')).toBeInTheDocument();
    expect(screen.getByText('2 Oct 2026, 10:11 UTC')).toBeInTheDocument();
  });

  it('ô ảnh: có ảnh thì in đúng URL; chưa có thì ô giữ chỗ CÓ chữ cho trình đọc màn hình', () => {
    const thumbUrl =
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_160/v1/tourism/posts/x/cover';
    const { container } = renderTable([row({ thumbUrl }), row({ id: 'b2', slug: 'b', title: 'B', editorHref: '/posts/b' })]);
    expect(container.querySelector('img')).toHaveAttribute('src', thumbUrl);
    expect(screen.getByText(t.noImage)).toBeInTheDocument();
  });

  it('thanh công cụ có nút New post', () => {
    renderTable([row()]);
    expect(
      screen.getByRole('button', { name: messages.admin.posts.create.action }),
    ).toBeInTheDocument();
  });

  it('danh sách rỗng nói đúng câu của vùng', () => {
    renderTable([]);
    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });
});
```

  ĐỎ. Tạo `components/posts/posts-toolbar.tsx`:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { CalendarClockIcon, CircleCheckIcon, ListIcon, PencilLineIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL } from '@/components/kit/filter-value';
import { StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { clearFiltersHref, ToolbarClearFilters } from '@/components/kit/toolbar-clear-filters';
import { type PostsQuery, parsePostsStatus, postsHref } from '@/lib/posts-query';

/**
 * Ba mẩu điều khiển của `/posts` (spec P4e-4 §4.2). Cả ba chỉ đổi URL; server component
 * đọc lại `searchParams` rồi fetch — không có state danh sách nào ở client.
 */
const t = messages.admin.posts.list;

const TAB_ITEMS = [
  { label: t.statusAll, value: ALL, icon: ListIcon },
  { label: t.statusPublished, value: 'published', icon: CircleCheckIcon },
  { label: t.statusScheduled, value: 'scheduled', icon: CalendarClockIcon },
  { label: t.statusDraft, value: 'draft', icon: PencilLineIcon },
];

export function PostsStatusTabs({ query }: { query: PostsQuery }) {
  const router = useRouter();
  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={query.status ?? ALL}
      label={t.statusLabel}
      selectId="posts-status-selector"
      // Giá trị lạ (ALL, hay value bị reset) rơi êm về tab All — nếp bảng Tours.
      onSelect={(next) => router.push(postsHref(query, { status: parsePostsStatus(next) }))}
    />
  );
}

export function PostsSearch({ query }: { query: PostsQuery }) {
  const router = useRouter();
  return (
    <TableSearchForm
      inputId="posts-search"
      label={t.searchLabel}
      placeholder={t.searchPlaceholder}
      value={query.search}
      onSearch={(term) => router.push(postsHref(query, { search: term }))}
    />
  );
}

/**
 * Nút xoá bộ lọc — vỏ mỏng quanh kit `ToolbarClearFilters`. KHÔNG đụng dải tab: nó tự có
 * mục All, cùng lý do với `/tours`. Hai href ghim `page: 1` để nút tự ẩn khi không lọc.
 */
export function PostsClearFilters({ query }: { query: PostsQuery }) {
  const router = useRouter();
  return (
    <ToolbarClearFilters
      label={messages.admin.table.clearFilters}
      href={clearFiltersHref(
        postsHref(query, { search: null, page: 1 }),
        postsHref(query, { page: 1 }),
      )}
      onNavigate={router.push}
    />
  );
}
```

  Tạo `components/posts/posts-table.tsx`:

```tsx
'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { CalendarIcon, ClockIcon, FileTextIcon, TagIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { NewPostDialog } from '@/components/posts/new-post-dialog';
import { PostsClearFilters, PostsSearch, PostsStatusTabs } from '@/components/posts/posts-toolbar';
import { type PostsQuery, postsHref } from '@/lib/posts-query';
import { POST_STATUS_VARIANT, type PostRowVM } from '@/lib/posts-view';
import type { CreatePostAction } from '@/lib/posts-write';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Bảng `/posts` (spec P4e-4 §4.2) — dựng trọn trên kit như mọi bảng admin (user chốt
 * 31/08). Trang và bộ lọc sống trên URL. Cột Post không ẩn được — nó là danh tính của hàng.
 *
 * Tiêu đề là link sang trang sửa, không phải cả hàng bấm được (Quyết định 12 của plan) —
 * cùng nếp bảng Tours. Component KHÔNG tự tính gì: mọi con chữ đã được `toPostRowVM` nấu.
 */
const t = messages.admin.posts.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, PostRowVM>();

const COLUMN_LABELS: Record<string, string> = {
  status: t.columns.status,
  published: t.columns.published,
  tags: t.columns.tags,
  updated: t.columns.updated,
};

const COLUMN_ICONS = {
  status: FileTextIcon,
  published: CalendarIcon,
  tags: TagIcon,
  updated: ClockIcon,
};

const COLUMNS = columnHelper.columns([
  columnHelper.accessor('title', {
    header: t.columns.post,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <PostThumb row={row.original} />
        <div className="grid min-w-0 gap-0.5">
          <Link
            href={row.original.editorHref}
            className="max-w-80 truncate font-medium text-foreground underline-offset-4 hover:underline"
            title={row.original.title}
          >
            {row.original.title}
          </Link>
          <span className="max-w-80 truncate text-xs text-muted-foreground">
            {row.original.slug}
          </span>
        </div>
      </div>
    ),
    enableHiding: false,
  }),
  columnHelper.accessor('statusLabel', {
    id: 'status',
    header: t.columns.status,
    cell: ({ row }) => (
      <Badge variant={POST_STATUS_VARIANT[row.original.displayStatus]}>
        {row.original.statusLabel}
      </Badge>
    ),
  }),
  columnHelper.accessor('published', {
    header: t.columns.published,
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-muted-foreground">
        {row.original.published}
      </span>
    ),
  }),
  columnHelper.accessor('tags', {
    header: t.columns.tags,
    cell: ({ row }) => (
      <div className="max-w-56 truncate text-muted-foreground" title={row.original.tags}>
        {row.original.tags}
      </div>
    ),
  }),
  columnHelper.accessor('updated', {
    header: t.columns.updated,
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-muted-foreground">
        {row.original.updated}
      </span>
    ),
  }),
]);

/**
 * Ô ảnh bìa 40px — cùng khuôn `TourThumb`: chưa có ảnh thì ô giữ chỗ mang chữ `sr-only`
 * (ô câm đọc thành "ảnh hỏng"); `<img>` thuần vì URL Cloudinary đã mang sẵn `f_auto,q_auto`.
 */
function PostThumb({ row }: { row: PostRowVM }) {
  if (!row.thumbUrl) {
    return (
      <div className="size-10 shrink-0 rounded-md border border-dashed bg-muted">
        <span className="sr-only">{t.noImage}</span>
      </div>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: URL Cloudinary đã tối ưu sẵn (ADR-0005)
    <img
      src={row.thumbUrl}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      className="size-10 shrink-0 rounded-md object-cover"
    />
  );
}

export interface PostsTableProps {
  rows: PostRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: PostsQuery;
  total: number;
  totalPages: number;
  create: CreatePostAction;
}

export function PostsTable({ rows, query, total, totalPages, create }: PostsTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns: COLUMNS,
    // KHÔNG có pagination state ở table: trang/limit sống trên URL.
    state: { columnVisibility },
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <DataTableFrame
      views={<PostsStatusTabs query={query} />}
      actions={
        <>
          <PostsSearch query={query} />
          <PostsClearFilters query={query} />
          <ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} icons={COLUMN_ICONS} />
          <NewPostDialog create={create} />
        </>
      }
      footer={
        <TablePagination
          page={query.page}
          totalPages={totalPages}
          total={total}
          pageSize={query.limit}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          hrefForPage={(page) => postsHref(query, { page })}
          hrefForPageSize={(limit) => postsHref(query, { limit })}
        />
      }
    >
      <DataTableBody table={table} empty={t.empty} />
    </DataTableFrame>
  );
}
```

- [ ] **B8. Test trước — hộp New post.** Tạo `components/posts/new-post-dialog.spec.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreatePostAction } from '@/lib/posts-write';
import { NewPostDialog } from './new-post-dialog';

/**
 * Hộp New post (spec P4e-4 §4.3): tiêu đề và slug; slug tự điền theo tiêu đề tới khi admin
 * chạm vào nó; bài sinh ra là nháp rồi mở thẳng trang sửa.
 */
const t = messages.admin.posts.create;
const fe = messages.admin.posts.editor.form.errors;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href), refresh: () => refresh() }),
}));

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  push.mockReset();
  refresh.mockReset();
});

/** "Breakfast in Hội An" — chữ "ộ" dựng từ mã số để slug phải đi qua slugifyVietnamese thật. */
const TITLE = `Breakfast in H${String.fromCodePoint(0x1ed9)}i An`;

async function openDialog(create: CreatePostAction = vi.fn()) {
  const user = userEvent.setup();
  render(<NewPostDialog create={create} />);
  await user.click(screen.getByRole('button', { name: t.action }));
  const dialog = await screen.findByRole('dialog', { name: t.dialog.title });
  return { user, dialog };
}

describe('NewPostDialog', () => {
  it('slug chạy theo tiêu đề tới khi admin tự gõ vào ô slug', async () => {
    const { user, dialog } = await openDialog();
    const slug = within(dialog).getByLabelText(t.slug);

    await user.type(within(dialog).getByLabelText(t.title), TITLE);
    expect(slug).toHaveValue('breakfast-in-hoi-an');

    await user.clear(slug);
    await user.type(slug, 'hoi-an-breakfast');
    await user.type(within(dialog).getByLabelText(t.title), ' again');
    expect(slug).toHaveValue('hoi-an-breakfast');
  });

  it('tạo xong: gửi bản đã trim, toast, mở trang sửa của bài mới', async () => {
    const create = vi.fn<CreatePostAction>().mockResolvedValue({
      ok: true,
      created: { id: '7a1b2c3d-0000-4000-8000-0000000000aa', slug: 'breakfast-in-hoi-an' },
    });
    const { user, dialog } = await openDialog(create);

    await user.type(within(dialog).getByLabelText(t.title), `  ${TITLE}  `);
    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/posts/breakfast-in-hoi-an'));
    expect(create).toHaveBeenCalledWith({ title: TITLE, slug: 'breakfast-in-hoi-an' });
    expect(success).toHaveBeenCalledWith(t.toast.title, { description: t.toast.body });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('SLUG_TAKEN báo ngay dưới ô slug; hộp vẫn mở, chữ còn nguyên', async () => {
    const create = vi.fn<CreatePostAction>().mockResolvedValue({ ok: false, code: 'SLUG_TAKEN' });
    const { user, dialog } = await openDialog(create);

    await user.type(within(dialog).getByLabelText(t.title), 'Breakfast');
    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    expect(await within(dialog).findByText(t.errors.SLUG_TAKEN)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(t.slug)).toHaveValue('breakfast');
    expect(within(dialog).getByLabelText(t.slug)).toHaveAccessibleDescription(
      `${t.slugHint} ${t.errors.SLUG_TAKEN}`,
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('bấm tạo khi trống: hai ô báo "Fill this in", lệnh không chạy', async () => {
    const create = vi.fn<CreatePostAction>();
    const { user, dialog } = await openDialog(create);

    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    expect(within(dialog).getAllByText(fe.required)).toHaveLength(2);
    expect(create).not.toHaveBeenCalled();
  });

  it('lệnh ném (kết cục không rõ): đóng hộp, toast lỗi chung, làm mới bảng', async () => {
    const create = vi.fn<CreatePostAction>().mockRejectedValue(new Error('network'));
    const { user, dialog } = await openDialog(create);

    await user.type(within(dialog).getByLabelText(t.title), 'Breakfast');
    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith(messages.admin.errors.write.GENERIC),
    );
    expect(refresh).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
```

  ĐỎ, rồi tạo `components/posts/new-post-dialog.tsx`:

```tsx
'use client';

import { POST_SLUG_MAX, slugifyVietnamese } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tourism/ui/components/dialog';
import { Input } from '@tourism/ui/components/input';
import { cn } from '@tourism/ui/lib/utils';
import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import { FormField } from '@/components/kit/form-field';
import { hasFormErrors } from '@/lib/form-errors';
import { postEditorHref } from '@/lib/posts-view';
import {
  type CreatePostAction,
  type CreatePostContractCode,
  createPostErrorCopy,
  type PostCreateFormValues,
  postCreatePayload,
  validatePostCreateForm,
} from '@/lib/posts-write';
import { useConfirmWrite } from '@/lib/use-confirm-write';

/**
 * Hộp New post ở trang `/posts` (spec P4e-4 §4.3) — khuôn `NewTourDialog`: vòng đời lệnh
 * ghi của kit qua `useConfirmWrite`, mỗi ô một `FormField`.
 *
 * - Slug chạy theo tiêu đề bằng `slugifyVietnamese(title, 80)` tới khi admin chạm vào ô
 *   slug; câu "Set once" nói thẳng vì sao phải chọn kỹ (ADR-0051 §2).
 * - `SLUG_TAKEN` là lỗi của Ô SLUG: hiện dưới ô ấy, hộp vẫn mở, chữ còn nguyên.
 * - Thành công: mở thẳng trang sửa của bài mới — nó sinh ra là nháp.
 */
const t = messages.admin.posts.create;
const FORM_ID = 'new-post';
const EMPTY: PostCreateFormValues = { title: '', slug: '' };

export function NewPostDialog({ create }: { create: CreatePostAction }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        {t.action}
      </Button>
      {open ? <NewPostForm create={create} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function NewPostForm({ create, onClose }: { create: CreatePostAction; onClose: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<PostCreateFormValues>(EMPTY);
  /** Admin đã tự gõ ô slug chưa — gõ rồi thì tiêu đề thôi ghi đè nó. */
  const [slugTouched, setSlugTouched] = useState(false);
  /** Chỉ báo lỗi SAU lần bấm tạo đầu tiên; lỗi là DERIVED nên sửa xong là tự biến. */
  const [showValidation, setShowValidation] = useState(false);
  /** Trang sửa của bài vừa tạo — điều hướng SAU lệnh, không nằm trong `try` của kit (bài học F17). */
  const createdHref = useRef<string | null>(null);

  const errors = showValidation ? validatePostCreateForm(values) : {};

  const { pending, failure, onOpenChange, run, clearFailure } =
    useConfirmWrite<CreatePostContractCode>({
      isStale: () => false,
      errorCopy: createPostErrorCopy,
      onClose,
      onSettled: () => {
        const href = createdHref.current;
        createdHref.current = null;
        if (href) router.push(href);
        else router.refresh();
      },
    });

  function patch(next: Partial<PostCreateFormValues>) {
    setValues((current) => ({ ...current, ...next }));
    clearFailure();
  }

  function submit() {
    setShowValidation(true);
    if (hasFormErrors(validatePostCreateForm(values))) return;
    void run(async () => {
      const result = await create(postCreatePayload(values));
      if (!result.ok) return { ok: false, code: result.code };
      createdHref.current = postEditorHref(result.created.slug);
      return { ok: true, toast: { title: t.toast.title, description: t.toast.body } };
    });
  }

  const slugError = failure === 'SLUG_TAKEN' ? createPostErrorCopy('SLUG_TAKEN') : errors.slug;
  const footerFailure = failure !== null && failure !== 'SLUG_TAKEN' ? failure : null;
  const field = (name: string) => `${FORM_ID}-${name}`;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_FRAME, 'sm:max-w-lg')} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t.dialog.title}</DialogTitle>
          <DialogDescription>{t.dialog.body}</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4">
            <FormField id={field('title')} label={t.title} error={errors.title}>
              {(describedBy) => (
                <Input
                  id={field('title')}
                  value={values.title}
                  disabled={pending}
                  aria-invalid={errors.title !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => {
                    const title = event.target.value;
                    patch({
                      title,
                      slug: slugTouched ? values.slug : slugifyVietnamese(title, POST_SLUG_MAX),
                    });
                  }}
                />
              )}
            </FormField>

            <FormField id={field('slug')} label={t.slug} hint={t.slugHint} error={slugError}>
              {(describedBy) => (
                <Input
                  id={field('slug')}
                  value={values.slug}
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={pending}
                  aria-invalid={slugError !== undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => {
                    setSlugTouched(true);
                    patch({ slug: event.target.value });
                  }}
                />
              )}
            </FormField>
          </div>

          {footerFailure ? (
            <p role="alert" className="mt-4 text-sm text-destructive-emphasis">
              {createPostErrorCopy(footerFailure)}
            </p>
          ) : null}

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t.dialog.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t.dialog.submitting : t.dialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **B9.** Build i18n + contract, chạy spec admin của task — XANH. Đột biến: `slugTouched`
  luôn `false` (ca đầu phải đỏ); `onSettled` luôn `router.refresh()` (ca tạo xong phải đỏ);
  bỏ nhánh `failure === 'SLUG_TAKEN'` của `slugError`.
- [ ] **B10.** Quy trình gate, rồi commit:
  `feat(admin): bảng bài viết, hộp New post, bật mục Posts`

## Task 7 — Admin: tách phần dùng chung của F18 và F17 (hộp thư viện, lõi form có phiên bản)

Task này KHÔNG thêm hành vi mới cho tour. Phép thử chính là test F17/F18 hiện có xanh
nguyên sau khi tách (Quyết định 8, 9); chỉ có MỘT ca mới cho đường bài viết sẽ dùng.

**Files:**

- Move: `apps/admin/src/components/tours/editor/photo-library-dialog.tsx` (+ spec) →
  `apps/admin/src/components/kit/`
- Create: `apps/admin/src/lib/photo-library.ts`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (dời `photos.dialog` thành `admin.photoLibrary`)
- Modify: `apps/admin/src/lib/tour-photos.ts`, `components/tours/editor/tour-photos-form.tsx`
  (+ spec), `app/(admin)/tours/[slug]/actions.ts` — chỉ đường import và tham chiếu copy
- Modify: `apps/admin/src/lib/photo-upload.ts` — chỉ JSDoc
- Create: `apps/admin/src/lib/use-versioned-form.ts`; Modify: `lib/use-tour-form-state.ts`

**Interfaces:**

- Produces: `PhotoLibraryDialog` ở `@/components/kit/photo-library-dialog` với
  `tourDestinationIds?: readonly string[]` (mặc định rỗng); `messages.admin.photoLibrary`;
  `PhotoLibraryResult`, `LoadPhotoLibraryAction`, `libraryLoadErrorCopy(code)` ở
  `@/lib/photo-library`; `useVersionedForm<Detail extends { version: string }, Values>(detail,
  toValues)` trả `{ base, values, setValues, version, dirty, showValidation,
  setShowValidation, adopt, reload, serverChanged }`, `isNewerVersion` ở
  `@/lib/use-versioned-form`.

- [ ] **B1. Dời file.**

```bash
git mv apps/admin/src/components/tours/editor/photo-library-dialog.tsx apps/admin/src/components/kit/photo-library-dialog.tsx
git mv apps/admin/src/components/tours/editor/photo-library-dialog.spec.tsx apps/admin/src/components/kit/photo-library-dialog.spec.tsx
```

- [ ] **B2. Copy dùng chung.** Trong `messages.ts`: CẮT nguyên khối `dialog: { … }` ra khỏi
  `admin.tours.editor.photos` (từ `dialog: {` với `title: 'Add from library'` tới `},` đóng
  của nó, kể cả JSDoc bên trong) và dán thành khối cấp `admin`, ngay sau dấu `},` đóng khối
  `unsavedChanges`, đổi tên khoá thành `photoLibrary` và thêm JSDoc mở đầu:

```ts
    /**
     * Hộp chọn ảnh từ kho địa danh (kit `PhotoLibraryDialog`) — ảnh tour (F18) và ảnh bìa
     * bài viết (P4e-4) dùng chung. Dời nguyên văn từ `tours.editor.photos.dialog`.
     */
    photoLibrary: {
```

  Không đổi một chữ nào bên trong khối. Build lại i18n.

- [ ] **B3. Lớp lệnh tải kho ảnh.** Tạo `lib/photo-library.ts`, rồi CẮT khỏi
  `lib/tour-photos.ts` ba thứ tương ứng (`PhotoLibraryResult`, `LoadPhotoLibraryAction`,
  `libraryLoadErrorCopy` kèm JSDoc của chúng):

```ts
import type { AdminPhotoLibrary } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { TransportFailureCode } from './api/write-error';

/**
 * Lệnh tải kho ảnh địa danh cho hộp chọn ảnh dùng chung (kit `PhotoLibraryDialog`) — ảnh
 * tour (F18) và ảnh bìa bài viết (P4e-4). Tách khỏi `tour-photos.ts` ở P4e-4.
 */
export type PhotoLibraryResult =
  | { ok: true; library: AdminPhotoLibrary }
  | { ok: false; code: TransportFailureCode };

export type LoadPhotoLibraryAction = () => Promise<PhotoLibraryResult>;

/**
 * Câu lỗi tải kho ảnh theo mã — giọng ĐỌC (vòng review F18). Thủ tục không có input nên
 * INVALID_INPUT không thể tới; nếu tới thì cũng chỉ là lỗi chung.
 */
export function libraryLoadErrorCopy(code: TransportFailureCode): string {
  return messages.admin.photoLibrary.loadErrors[code === 'INVALID_INPUT' ? 'GENERIC' : code];
}
```

  Gỡ import thành thừa trong `tour-photos.ts` (`AdminPhotoLibrary` nếu không còn ai dùng —
  Biome báo).

- [ ] **B4. Đổi đường import, không đổi hành vi.**
  - `components/kit/photo-library-dialog.tsx`: `const t = messages.admin.photoLibrary;`;
    `import { type LoadPhotoLibraryAction, libraryLoadErrorCopy } from '@/lib/photo-library';`;
    thay `tourPhotoThumb(photo.url)` bằng `withDeliveryTransform(photo.url, 'w_320')` với
    `import { withDeliveryTransform } from '@/lib/cloudinary-url';` và gỡ import
    `tourPhotoThumb` — kit không còn phụ thuộc tour, URL ra y hệt (`tourPhotoThumb` chính
    là dòng ấy).
  - `components/kit/photo-library-dialog.spec.tsx`: `const t = messages.admin.photoLibrary;`;
    `import type { LoadPhotoLibraryAction } from '@/lib/photo-library';`.
  - `components/tours/editor/tour-photos-form.tsx`: `PhotoLibraryDialog` import từ
    `@/components/kit/photo-library-dialog`; `LoadPhotoLibraryAction` import từ
    `@/lib/photo-library` (gỡ khỏi khối import `@/lib/tour-photos`).
  - `components/tours/editor/tour-photos-form.spec.tsx`: `LoadPhotoLibraryAction` import từ
    `@/lib/photo-library`; `t.dialog.add(1)` → `messages.admin.photoLibrary.add(1)`,
    `t.dialog.cancel` → `messages.admin.photoLibrary.cancel` (và mọi `t.dialog.` khác nếu
    `grep -n "t\.dialog\." tour-photos-form.spec.tsx` còn thấy).
  - `app/(admin)/tours/[slug]/actions.ts`: `PhotoLibraryResult` import từ `@/lib/photo-library`.

  `grep -rn "photos\.dialog\|editor/photo-library-dialog" apps/admin/src` phải rỗng.

- [ ] **B5. Test trước — hộp không có địa danh ưu tiên.** Thêm vào CUỐI
  `describe('PhotoLibraryDialog', …)` của spec vừa dời:

```tsx
  it('không có địa danh ưu tiên (ảnh bìa bài viết): không có mục "của tour", mở ở địa danh đầu', async () => {
    const user = userEvent.setup();
    const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: true, library: LIBRARY });
    function NoPreferred() {
      const [library, setLibrary] = useState<AdminPhotoLibrary | null>(null);
      return (
        <PhotoLibraryDialog
          open
          onOpenChange={vi.fn()}
          library={library}
          onLoaded={setLibrary}
          load={load}
          existing={new Set()}
          capacity={1}
          onAdd={vi.fn()}
        />
      );
    }
    render(<NoPreferred />);

    expect(await screen.findByRole('checkbox', { name: 'Bay at dawn' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: t.destination }));
    expect(await screen.findByRole('option', { name: 'Hạ Long' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: t.thisTour })).not.toBeInTheDocument();
  });
```

  Chạy spec — ca mới ĐỎ (`tourDestinationIds.includes` trên `undefined`).

- [ ] **B6. Cài.** Trong `components/kit/photo-library-dialog.tsx`:
  - kiểu prop thành `tourDestinationIds?: readonly string[];` và tham số
    `tourDestinationIds = NO_PREFERRED,` với hằng module
    `const NO_PREFERRED: readonly string[] = [];` (hằng chứ không `[]` tại chỗ — mảng mới
    mỗi lần render là phụ thuộc đổi liên tục nếu sau này ai đưa nó vào effect);
  - đoạn đầu JSDoc của component đổi thành:

```ts
/**
 * Hộp chọn ảnh từ kho địa danh (ADR-0048 §9) — kit dùng chung: tab Photos của tour (F18)
 * và card Cover của bài viết (P4e-4, ADR-0051 §8).
 *
 * - Thư viện tải MỘT lần khi hộp mở lần đầu; nơi dùng giữ nó (`library`/`onLoaded`) cho
 *   các lần mở sau.
 * - `tourDestinationIds` (tuỳ chọn): có thì mặc định bày ảnh các địa danh ấy, kèm mục "This
 *   tour's destinations"; vắng (ảnh bìa bài viết) thì mở ở địa danh đầu tiên.
 * - Ảnh đã có hiện "Added" và khoá; không cho tích quá sức chứa.
```

    (giữ nguyên phần "Vòng review F18" bên dưới).

  Chạy cả spec — XANH, đủ số ca cũ cộng một. Đột biến: bỏ giá trị mặc định (ca mới phải đỏ).

- [ ] **B7. `photo-upload.ts` — chỉ JSDoc.** Trong `UploadedPhoto`, chú thích của `publicId`
  thành dòng dưới, và thêm vào cuối JSDoc của `uploadPhoto` câu
  "Dùng chung cho ảnh tour (F18) và ảnh bìa bài viết (P4e-4) — không phụ thuộc tour.":

```ts
  /** publicId ĐẦY ĐỦ `<folder>/<basename>` — đúng chuỗi API nhận lại ở `setPhotos` (tour) và `update` (ảnh bìa bài viết). */
```

- [ ] **B8. Lõi form có phiên bản.** Tạo `lib/use-versioned-form.ts`: chép NGUYÊN JSDoc và
  thân hàm `useTourFormState` cùng `isNewerVersion` từ `lib/use-tour-form-state.ts`, chỉ đổi:
  - tên hàm thành `useVersionedForm`;
  - chữ ký thành
    `export function useVersionedForm<Detail extends { version: string }, Values>(detail: Detail, toValues: (detail: Detail) => Values)`;
  - `function adopt(next: AdminTourDetail)` thành `function adopt(next: Detail)`;
  - bỏ import `AdminTourDetail`;
  - thêm đoạn này vào đầu JSDoc của hàm:

```ts
 * Lõi dùng chung (tách ở P4e-4): khu sửa tour gọi qua `useTourFormState`, form bài viết
 * gọi thẳng. Hành vi giữ nguyên từng dòng.
 *
```

  Thay toàn bộ `lib/use-tour-form-state.ts` bằng:

```ts
'use client';

import type { AdminTourDetail } from '@tourism/contract';
import { useVersionedForm } from './use-versioned-form';

export { isNewerVersion } from './use-versioned-form';

/**
 * Bộ giữ form của một bước trong khu sửa tour (ADR-0047) — lõi ở `useVersionedForm`, tách
 * ra ở P4e-4 để form bài viết dùng chung. Hành vi không đổi; test của file này canh nó.
 */
export function useTourFormState<Values>(
  detail: AdminTourDetail,
  toValues: (detail: AdminTourDetail) => Values,
) {
  return useVersionedForm(detail, toValues);
}
```

  `pnpm --filter @tourism/admin exec vitest run src/lib/use-tour-form-state.spec.tsx` — xanh
  nguyên (đó là test của bước này).

- [ ] **B9.** Chạy TOÀN BỘ test admin: `pnpm --filter @tourism/admin exec vitest run --maxWorkers=4`
  — số ca = số ca trước task cộng ĐÚNG MỘT. Ghi hai con số vào báo cáo.
- [ ] **B10.** Quy trình gate, rồi commit:
  `refactor(admin): tách hộp thư viện ảnh và lõi form có phiên bản để bài viết dùng chung`

## Task 8 — Admin: trang sửa bài — khung, luồng Save, card Publish

Trang chạy được trọn từ task này: sửa tiêu đề, tóm tắt, thân bài (ô chữ thường — Task 9 thay
bằng trình soạn), trạng thái và ngày đăng, rồi Save. Ảnh bìa, tag, tour liên quan đi theo
NGUYÊN trong payload (giá trị form dựng từ bài đang lưu) cho tới khi Task 10–11 có card để
sửa chúng.

**Files:**

- Create: `apps/admin/src/test/post-detail.ts`
- Create: `apps/admin/src/lib/post-form.ts` + spec
- Modify: `apps/admin/src/lib/posts-write.ts` + spec (codec `update`, kiểu action)
- Modify: `apps/admin/src/lib/api/posts.ts` (`fetchAdminPost`, `updateAdminPost`)
- Modify: `apps/admin/src/lib/site.ts` + spec (`postPageUrl`)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (một câu của `unsavedChanges`)
- Create: `apps/admin/src/app/(admin)/posts/[slug]/page.tsx`, `apps/admin/src/app/(admin)/posts/[slug]/actions.ts`
- Create: `apps/admin/src/components/posts/editor/post-banner.tsx`
- Create: `apps/admin/src/components/posts/editor/post-editor-header.tsx` + spec
- Create: `apps/admin/src/components/posts/editor/post-publish-card.tsx` + spec
- Create: `apps/admin/src/components/posts/editor/post-editor.tsx` + spec

**Interfaces:**

- Consumes: `useVersionedForm`, `isNewerVersion` (Task 7); `StepColumns`
  (`components/tours/editor/editor-form-frame.tsx`); `StateMark`
  (`components/tours/editor/step-aside.tsx`); `StableLabel`; `POSTS_LIST_HREF`,
  `postStatusLabel`, `POST_STATUS_VARIANT` (Task 6).
- Produces: `POST_FORM_ID`, `PostTourOption`, `PostTourDraft`, `PostCoverDraft`,
  `PostFormValues`, `PostFormErrors`, `postFormValues(detail)`,
  `postPayload(id, version, values)`, `validatePostForm(values)`,
  `projectedPostReadiness(values)`, `withStatus(values, status, now)`,
  `toUtcInputValue`, `fromUtcInputValue`, `nowUtcInputValue`; `UpdatePostContractCode`,
  `UPDATE_POST_CONTRACT_CODES`, `classifyUpdatePostError`, `updatePostErrorCopy`,
  `UpdatePostResult`, `UpdatePostAction`; `fetchAdminPost`, `updateAdminPost`;
  `postPageUrl(slug)`; `updatePostAction`; `PostBannerState`, `PostBanner`,
  `PostEditorHeader`, `PostPublishCard`, `PostEditor` (props `detail`, `update` — Task 10–12
  thêm prop).

- [ ] **B1. Fixture.** Tạo `test/post-detail.ts`:

```ts
import {
  type AdminPostDetail,
  AdminPostDetailSchema,
  postDisplayStatus,
  postReadiness,
} from '@tourism/contract';

/**
 * Fixture `AdminPostDetail` DÙNG CHUNG cho mọi spec admin của P4e-4 — cùng nếp
 * `tour-detail.ts`: contract thêm một field là sửa đúng một chỗ.
 *
 * Gốc là một bài ĐÃ ĐĂNG, đủ để đăng, ảnh bìa tải lên, một tag, một tour liên quan. Ca test
 * đè đúng thứ nó cần bằng `patch`. `displayStatus` và `readiness` là phần SUY RA — fixture
 * tính bằng CHÍNH hàm của contract sau khi đè (trừ khi ca test đè thẳng chúng), rồi parse
 * qua schema để một fixture lệch hình dạng đỏ ngay ở đây.
 */
export const POST_ID = '7a1b2c3d-0000-4000-8000-0000000000b1';
export const POST_VERSION = '2026-10-02T10:11:12.345Z';
/** Mốc "bây giờ" mà fixture dùng để suy `displayStatus`. */
export const FIXTURE_NOW = new Date('2026-10-02T12:00:00.000Z');
export const TOUR_A = {
  id: '7a1b2c3d-0000-4000-8000-0000000000e1',
  slug: 'hoi-an-food-walk',
  title: 'Hoi An Food Walk',
  isPublished: true,
};
export const TOUR_B = {
  id: '7a1b2c3d-0000-4000-8000-0000000000e2',
  slug: 'my-son-sunrise',
  title: 'My Son Sunrise',
  isPublished: false,
};

export function postDetailFixture(patch: Partial<AdminPostDetail> = {}): AdminPostDetail {
  const base: Omit<AdminPostDetail, 'displayStatus' | 'readiness'> = {
    id: POST_ID,
    slug: 'eating-your-way-through-hoi-an',
    title: 'Eating your way through Hội An',
    excerpt: 'Five stalls before noon.',
    content: '## Morning\n\nBánh mì first.',
    status: 'PUBLISHED',
    publishedAt: '2026-10-01T08:00:00.000Z',
    tags: [{ slug: 'food', name: 'Food' }],
    relatedTours: [TOUR_A],
    cover: {
      publicId: `tourism/posts/${POST_ID}/cover`,
      url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/posts/${POST_ID}/cover`,
      alt: 'Lanterns over the river',
      source: 'UPLOAD',
    },
    author: { name: 'Seed Admin' },
    version: POST_VERSION,
    createdAt: '2026-09-30T00:00:00.000Z',
    // `patch` có thể mang cả `displayStatus`/`readiness` — chúng đè phần suy ra bên dưới.
    ...patch,
  };
  return AdminPostDetailSchema.parse({
    displayStatus: postDisplayStatus(base.status, base.publishedAt, FIXTURE_NOW),
    readiness: postReadiness({
      content: base.content,
      excerpt: base.excerpt,
      hasCover: base.cover !== null,
    }),
    ...base,
  });
}
```

- [ ] **B2. Test trước — giá trị form.** Tạo `lib/post-form.spec.ts`:

```ts
import {
  AdminPostUpdateInputSchema,
  POST_CONTENT_MAX,
  POST_COVER_ALT_MAX,
  POST_EXCERPT_MAX,
  POST_TITLE_MAX,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { POST_ID, POST_VERSION, postDetailFixture, TOUR_A } from '@/test/post-detail';
import {
  fromUtcInputValue,
  nowUtcInputValue,
  postFormValues,
  postPayload,
  projectedPostReadiness,
  toUtcInputValue,
  validatePostForm,
  withStatus,
} from './post-form';

const fe = messages.admin.posts.editor.form.errors;
const UPLOAD = { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 };

describe('giờ UTC của ô datetime-local', () => {
  it('ISO → giá trị ô, đọc như giờ UTC; giây bị bỏ', () => {
    expect(toUtcInputValue('2026-10-05T09:30:45.123Z')).toBe('2026-10-05T09:30');
  });

  it('giá trị ô → ISO UTC; trống, sai dạng hay ngày không có thật là null', () => {
    expect(fromUtcInputValue('2026-10-05T09:30')).toBe('2026-10-05T09:30:00.000Z');
    expect(fromUtcInputValue('')).toBeNull();
    expect(fromUtcInputValue('2026-10-05 09:30')).toBeNull();
    expect(fromUtcInputValue('2026-02-31T10:00')).toBeNull();
  });

  it('"bây giờ" làm tròn xuống phút', () => {
    expect(nowUtcInputValue(new Date('2026-10-02T12:34:56.789Z'))).toBe('2026-10-02T12:34');
  });
});

describe('postFormValues / postPayload', () => {
  it('mở ra rồi lưu nguyên: payload hợp lệ với contract và nói đúng bài đang lưu', () => {
    const detail = postDetailFixture();
    const payload = postPayload(detail.id, detail.version, postFormValues(detail));
    expect(AdminPostUpdateInputSchema.parse(payload)).toEqual(payload);
    expect(payload).toEqual({
      id: POST_ID,
      version: POST_VERSION,
      title: 'Eating your way through Hội An',
      excerpt: 'Five stalls before noon.',
      content: '## Morning\n\nBánh mì first.',
      status: 'PUBLISHED',
      publishedAt: '2026-10-01T08:00:00.000Z',
      tags: ['Food'],
      relatedTourIds: [TOUR_A.id],
      cover: { publicId: `tourism/posts/${POST_ID}/cover`, alt: 'Lanterns over the river' },
    });
  });

  it('ô trống thành null; alt chỉ có khoảng trắng thành null; ảnh vừa tải mang metadata', () => {
    const values = {
      ...postFormValues(postDetailFixture()),
      excerpt: '   ',
      cover: {
        publicId: `tourism/posts/${POST_ID}/new`,
        url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1759000000/x',
        alt: '  ',
        source: 'UPLOAD' as const,
        upload: UPLOAD,
      },
    };
    const payload = postPayload(POST_ID, POST_VERSION, values);
    expect(payload.excerpt).toBeNull();
    expect(payload.cover).toEqual({
      publicId: `tourism/posts/${POST_ID}/new`,
      alt: null,
      upload: UPLOAD,
    });
  });

  it('nháp chưa từng đăng: ô ngày trống, tóm tắt null thành chuỗi rỗng, không ảnh bìa', () => {
    const values = postFormValues(
      postDetailFixture({ status: 'DRAFT', publishedAt: null, excerpt: null, cover: null }),
    );
    expect(values).toMatchObject({ status: 'DRAFT', publishAt: '', excerpt: '', cover: null });
  });
});

describe('validatePostForm', () => {
  const values = () => postFormValues(postDetailFixture());

  it('bài đủ thì không lỗi', () => {
    expect(validatePostForm(values())).toEqual({});
  });

  it('tiêu đề trống; các trần của contract', () => {
    expect(validatePostForm({ ...values(), title: '  ' }).title).toBe(fe.required);
    expect(validatePostForm({ ...values(), title: 'x'.repeat(POST_TITLE_MAX + 1) }).title).toBe(
      fe.tooLong(POST_TITLE_MAX),
    );
    expect(
      validatePostForm({ ...values(), excerpt: 'x'.repeat(POST_EXCERPT_MAX + 1) }).excerpt,
    ).toBe(fe.tooLong(POST_EXCERPT_MAX));
    expect(
      validatePostForm({ ...values(), content: 'x'.repeat(POST_CONTENT_MAX + 1) }).content,
    ).toBe(fe.tooLong(POST_CONTENT_MAX));
  });

  it('thân bài có ảnh nhúng hay HTML: câu riêng từng loại', () => {
    expect(validatePostForm({ ...values(), content: 'a ![b](https://x.io/y.jpg)' }).content).toBe(
      fe.image,
    );
    expect(validatePostForm({ ...values(), content: 'a <b>c</b>' }).content).toBe(fe.html);
  });

  it('Published phải có ngày giờ hợp lệ; Draft thì không cần', () => {
    expect(validatePostForm({ ...values(), publishAt: '' }).publishAt).toBe(fe.publishDate);
    expect(validatePostForm({ ...values(), status: 'DRAFT', publishAt: '' })).toEqual({});
  });

  it('alt ảnh bìa vượt trần', () => {
    const v = values();
    const cover = v.cover && { ...v.cover, alt: 'x'.repeat(POST_COVER_ALT_MAX + 1) };
    expect(validatePostForm({ ...v, cover }).coverAlt).toBe(fe.tooLong(POST_COVER_ALT_MAX));
  });
});

describe('projectedPostReadiness', () => {
  it('đọc bản ĐANG SOẠN, không phải bản đã lưu', () => {
    const detail = postDetailFixture();
    expect(detail.readiness).toEqual([]);
    expect(
      projectedPostReadiness({ ...postFormValues(detail), content: ' ', cover: null }),
    ).toEqual(['content', 'cover']);
  });
});

describe('withStatus', () => {
  const NOW = new Date('2026-10-02T12:34:56.000Z');

  it('sang Published mà ô ngày trống: tự điền "bây giờ" (spec §2.2)', () => {
    const draft = postFormValues(postDetailFixture({ status: 'DRAFT', publishedAt: null }));
    expect(withStatus(draft, 'PUBLISHED', NOW)).toMatchObject({
      status: 'PUBLISHED',
      publishAt: '2026-10-02T12:34',
    });
  });

  it('đã có ngày thì giữ; về Draft cũng giữ — bài về nháp không mất ngày cũ', () => {
    const published = postFormValues(postDetailFixture());
    expect(withStatus(published, 'PUBLISHED', NOW).publishAt).toBe('2026-10-01T08:00');
    expect(withStatus(published, 'DRAFT', NOW)).toMatchObject({
      status: 'DRAFT',
      publishAt: '2026-10-01T08:00',
    });
  });
});
```

  `pnpm --filter @tourism/admin exec vitest run src/lib/post-form.spec.ts` — ĐỎ.

- [ ] **B3. Cài.** Tạo `lib/post-form.ts`:

```ts
import {
  type AdminPostDetail,
  type AdminPostUpdateInput,
  POST_CONTENT_MAX,
  POST_COVER_ALT_MAX,
  POST_EXCERPT_MAX,
  POST_TITLE_MAX,
  type PostCoverSource,
  type PostReadinessItem,
  type PostStatus,
  postContentIssue,
  postReadiness,
  type TourPhotoUpload,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { Keyed } from './list-editor';

/**
 * Logic THUẦN của trang sửa bài (spec P4e-4 §4.4): giá trị form, kiểm trước khi gửi, payload,
 * độ đủ để đăng trên bản đang soạn, giờ UTC của ô ngày. Một bài là MỘT form — không chia
 * theo bước như tour.
 */
const fe = messages.admin.posts.editor.form.errors;

/** `id` của `<form>` — nút Save ở cột phải gắn vào nó bằng thuộc tính `form` (Quyết định 14). */
export const POST_FORM_ID = 'post-editor-form';

/** Một tour chọn được làm tour liên quan — cả tour đang tắt bán (ADR-0051 §5). */
export interface PostTourOption {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
}

/** Một dòng của danh sách tour liên quan; `key` là id tour (một tour chỉ có mặt một lần). */
export interface PostTourDraft extends PostTourOption, Keyed {}

/** Ảnh bìa đang soạn — `upload` chỉ có ở ảnh VỪA tải, gửi kèm lúc lưu (ADR-0048 §5). */
export interface PostCoverDraft {
  publicId: string;
  url: string;
  alt: string;
  source: PostCoverSource;
  upload?: TourPhotoUpload;
}

export interface PostFormValues {
  title: string;
  excerpt: string;
  content: string;
  status: PostStatus;
  /** `YYYY-MM-DDTHH:mm` đọc như giờ UTC (ô `datetime-local`), hoặc `''`. */
  publishAt: string;
  tags: string[];
  relatedTours: PostTourDraft[];
  cover: PostCoverDraft | null;
}

export interface PostFormErrors {
  title?: string;
  excerpt?: string;
  content?: string;
  publishAt?: string;
  coverAlt?: string;
}

const INPUT_VALUE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** ISO → giá trị ô `datetime-local` đọc như giờ UTC (mọi giờ của admin là UTC). Giây bị bỏ. */
export function toUtcInputValue(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

/** Giá trị ô → ISO UTC; `null` khi trống, sai dạng, hay không phải một thời điểm có thật. */
export function fromUtcInputValue(value: string): string | null {
  if (!INPUT_VALUE.test(value)) return null;
  const date = new Date(`${value}:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  // `2026-02-31` tự lăn sang tháng 3 — so lại để bắt ngày không có thật.
  return iso.slice(0, 16) === value ? iso : null;
}

/** "Bây giờ" làm tròn xuống phút — giá trị tự điền khi chuyển sang Published. */
export function nowUtcInputValue(now: Date): string {
  return now.toISOString().slice(0, 16);
}

/** Bài server → giá trị form. Ô trống của DB thành chuỗi rỗng để ô nhập luôn được kiểm soát. */
export function postFormValues(detail: AdminPostDetail): PostFormValues {
  return {
    title: detail.title,
    excerpt: detail.excerpt ?? '',
    content: detail.content,
    status: detail.status,
    publishAt: detail.publishedAt === null ? '' : toUtcInputValue(detail.publishedAt),
    tags: detail.tags.map((tag) => tag.name),
    relatedTours: detail.relatedTours.map((tour) => ({ key: tour.id, ...tour })),
    cover:
      detail.cover === null
        ? null
        : {
            publicId: detail.cover.publicId,
            url: detail.cover.url,
            alt: detail.cover.alt ?? '',
            source: detail.cover.source,
          },
  };
}

/** Kiểm bằng CHÍNH các trần và luật nội dung của contract — form không gửi thứ server trả 400. */
export function validatePostForm(values: PostFormValues): PostFormErrors {
  const errors: PostFormErrors = {};
  const title = values.title.trim();
  if (title === '') errors.title = fe.required;
  else if (title.length > POST_TITLE_MAX) errors.title = fe.tooLong(POST_TITLE_MAX);

  if (values.excerpt.trim().length > POST_EXCERPT_MAX) {
    errors.excerpt = fe.tooLong(POST_EXCERPT_MAX);
  }

  if (values.content.length > POST_CONTENT_MAX) {
    errors.content = fe.tooLong(POST_CONTENT_MAX);
  } else {
    const issue = postContentIssue(values.content);
    if (issue !== null) errors.content = fe[issue];
  }

  if (values.status === 'PUBLISHED' && fromUtcInputValue(values.publishAt) === null) {
    errors.publishAt = fe.publishDate;
  }

  if (values.cover !== null && values.cover.alt.trim().length > POST_COVER_ALT_MAX) {
    errors.coverAlt = fe.tooLong(POST_COVER_ALT_MAX);
  }
  return errors;
}

/** Mục còn thiếu tính trên bản ĐANG SOẠN — cùng hàm server dùng ở cổng đăng (Quyết định 11). */
export function projectedPostReadiness(values: PostFormValues): PostReadinessItem[] {
  return postReadiness({
    content: values.content,
    excerpt: values.excerpt,
    hasCover: values.cover !== null,
  });
}

/**
 * Đổi trạng thái. Sang Published mà ô ngày trống thì tự điền "bây giờ" (spec §2.2); về
 * Draft thì GIỮ ngày — bài về nháp không mất ngày đăng cũ.
 */
export function withStatus(values: PostFormValues, status: PostStatus, now: Date): PostFormValues {
  const publishAt =
    status === 'PUBLISHED' && values.publishAt === '' ? nowUtcInputValue(now) : values.publishAt;
  return { ...values, status, publishAt };
}

/** Giá trị form → input `admin.posts.update`. Gửi cả form: tag, tour, ảnh bìa thay trọn. */
export function postPayload(
  id: string,
  version: string,
  values: PostFormValues,
): AdminPostUpdateInput {
  const excerpt = values.excerpt.trim();
  const cover = values.cover;
  return {
    id,
    version,
    title: values.title.trim(),
    excerpt: excerpt === '' ? null : excerpt,
    content: values.content,
    status: values.status,
    publishedAt: fromUtcInputValue(values.publishAt),
    tags: values.tags,
    relatedTourIds: values.relatedTours.map((tour) => tour.id),
    cover:
      cover === null
        ? null
        : {
            publicId: cover.publicId,
            alt: cover.alt.trim() === '' ? null : cover.alt.trim(),
            ...(cover.upload ? { upload: cover.upload } : {}),
          },
  };
}
```

  XANH. Đột biến: `withStatus` điền "bây giờ" cả khi đã có ngày; `fromUtcInputValue` bỏ
  phép so lại (ca 31/02 phải đỏ); `validatePostForm` kiểm ngày cả khi Draft; payload bỏ
  `upload`.

- [ ] **B4. Lớp ghi — codec lưu bài.** Trong `lib/posts-write.spec.ts`, thêm
  `UPDATE_POST_CONTRACT_CODES` vào import và ca vào `describe('tập mã lỗi khớp contract …')`:

```ts
  it('lưu bài phủ ĐÚNG các mã `admin.posts.update` khai', () => {
    expect([...UPDATE_POST_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.posts.update['~orpc'].errorMap),
    );
  });
```

  ĐỎ, rồi trong `lib/posts-write.ts` thêm `type AdminPostDetail`, `type AdminPostUpdateInput`
  vào import contract và:
  - dưới `const createCodec = …`: `const updateCodec = createWriteErrorCodec(t.editor.errors);`
  - dưới nhóm export của create:

```ts
export type UpdatePostContractCode = keyof typeof t.editor.errors;
export const UPDATE_POST_CONTRACT_CODES = updateCodec.codes;
export const classifyUpdatePostError = updateCodec.classify;
export const updatePostErrorCopy = updateCodec.copy;
```

  - dưới `CreatePostAction`:

```ts
/** Lệnh lưu trả NGUYÊN bài server vừa ghi — form lấy phiên bản mới từ đây. */
export type UpdatePostResult =
  | { ok: true; detail: AdminPostDetail }
  | { ok: false; code: UpdatePostContractCode | TransportFailureCode };

export type UpdatePostAction = (input: AdminPostUpdateInput) => Promise<UpdatePostResult>;
```

  XANH.

- [ ] **B5. Link sang site.** `lib/site.spec.ts` thêm `postPageUrl` vào import và:

```ts
describe('postPageUrl', () => {
  it('trang bài trên site khách; slug được mã hoá', () => {
    expect(postPageUrl('eating-in-hoi-an')).toBe(
      'https://www.nexora-travel.agency/blog/eating-in-hoi-an',
    );
    expect(postPageUrl('a b')).toBe('https://www.nexora-travel.agency/blog/a%20b');
  });
});
```

  ĐỎ, rồi cài cuối `lib/site.ts`:

```ts
/** Trang bài trên site khách — chỉ mở được khi bài đã đăng (nháp và bài hẹn giờ là 404). */
export function postPageUrl(slug: string): string {
  return `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
}
```

  XANH.

- [ ] **B6. Một câu copy chung.** `messages.admin.unsavedChanges.body` hiện nói "You changed
  this step…" — sai ở trang sửa bài (không có bước nào). Đổi thành câu đúng cho cả hai:

```ts
      /** Chung cho bước của khu sửa tour và trang sửa bài viết (P4e-4) — bản cũ nói "this step". */
      body: 'You have changes here that you have not saved. Leaving now throws them away.',
```

  `grep -rn "changed this step" apps libs` phải rỗng (test chỉ tra `title` — đo ở
  `editor-form-frame.spec.tsx`, `tour-photos-form.spec.tsx`). Build lại i18n.

- [ ] **B7. Đường API.** Trong `lib/api/posts.ts` thêm import `isDefinedError, safe` từ
  `@orpc/client`, `type AdminPostDetail`, `AdminPostGetInputSchema`,
  `type AdminPostUpdateInput` từ `@tourism/contract`, rồi:

```ts
/**
 * Một bài cho trang sửa; `null` khi slug không có (trang gọi `notFound()`). Slug sai hình
 * dạng của contract cũng `null`, không gọi API — khuôn `fetchAdminTour` (vòng review F17):
 * URL rác thành 404 chứ không thành trang lỗi của app.
 */
export async function fetchAdminPost(cookie: string, slug: string): Promise<AdminPostDetail | null> {
  if (!AdminPostGetInputSchema.safeParse({ slug }).success) return null;
  const [error, data] = await safe(
    api.admin.posts.get({ slug }, { context: withAdminAuth(cookie) }),
  );
  if (error) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  return data;
}

export async function updateAdminPost(
  cookie: string,
  input: AdminPostUpdateInput,
): Promise<AdminPostDetail> {
  return api.admin.posts.update(input, { context: withAdminAuth(cookie) });
}
```

- [ ] **B8. Server action và trang.** Tạo `app/(admin)/posts/[slug]/actions.ts`:

```ts
'use server';

import {
  type AdminPostDetail,
  type AdminPostUpdateInput,
  AdminPostUpdateInputSchema,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { updateAdminPost } from '@/lib/api/posts';
import { classifyUpdatePostError, type UpdatePostResult } from '@/lib/posts-write';

/**
 * Hành vi GHI của trang sửa bài (spec P4e-4 §4.4) — cùng khuôn
 * `tours/[slug]/actions.ts`: re-parse bằng CHÍNH schema contract (hỏng là `INVALID_INPUT`),
 * `cookies()` gọi ngoài `try`, `try` chỉ ôm đúng lời gọi API. KHÔNG `revalidatePath`: client
 * tự `router.refresh()`; cache WEB do API tự bust sau commit.
 */
export async function updatePostAction(input: AdminPostUpdateInput): Promise<UpdatePostResult> {
  const parsed = AdminPostUpdateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let detail: AdminPostDetail;
  try {
    detail = await updateAdminPost(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyUpdatePostError(error) };
  }
  return { ok: true, detail };
}
```

  Tạo `app/(admin)/posts/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { UnsavedChangesProvider } from '@/components/kit/unsaved-changes';
import { PostEditor } from '@/components/posts/editor/post-editor';
import { fetchAdminPost } from '@/lib/api/posts';
import { getServerSession } from '@/lib/api/session';
import { updatePostAction } from './actions';

/**
 * `/posts/[slug]` — trang sửa một bài (spec P4e-4 §4.4). Server component đọc bài kèm cookie
 * forward rồi trao cho form client; mọi server action đi xuống như prop (form test được với
 * hàm giả). Slug không có → `notFound()`.
 */
export const metadata: Metadata = {
  title: 'Edit post — Nexora back office',
};

export default async function PostEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookie = (await cookies()).toString();
  const [session, post] = await Promise.all([getServerSession(), fetchAdminPost(cookie, slug)]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở lần điều hướng kế.
  if (!session) return null;
  if (!post) notFound();

  return (
    <AdminShell user={session}>
      <UnsavedChangesProvider>
        <PostEditor detail={post} update={updatePostAction} />
      </UnsavedChangesProvider>
    </AdminShell>
  );
}
```

- [ ] **B9. Test trước — phần đầu và card Publish.** Tạo
  `components/posts/editor/post-editor-header.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { postDetailFixture } from '@/test/post-detail';
import { PostEditorHeader } from './post-editor-header';

const t = messages.admin.posts.editor;

describe('PostEditorHeader', () => {
  it('bài đã đăng: chip Published, View on site mở trang bài ở tab mới, Last saved theo UTC', () => {
    render(<PostEditorHeader detail={postDetailFixture()} />);

    expect(screen.getByText(messages.admin.posts.status.published)).toBeInTheDocument();
    const view = screen.getByRole('link', { name: t.viewOnSite });
    expect(view).toHaveAttribute(
      'href',
      'https://www.nexora-travel.agency/blog/eating-your-way-through-hoi-an',
    );
    expect(view).toHaveAttribute('target', '_blank');
    expect(
      screen.getByText(t.lastSaved('2 Oct 2026, 10:11 UTC'), { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.back })).toHaveAttribute('href', '/posts');
  });

  it('bài hẹn giờ: chip Scheduled, không có View on site (trang bài còn 404)', () => {
    render(<PostEditorHeader detail={postDetailFixture({ publishedAt: '2026-10-09T08:00:00.000Z' })} />);

    expect(screen.getByText(messages.admin.posts.status.scheduled)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t.viewOnSite })).not.toBeInTheDocument();
  });
});
```

  Tạo `components/posts/editor/post-publish-card.spec.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PostReadinessItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { PostPublishCard, type PostPublishCardProps } from './post-publish-card';

const t = messages.admin.posts.editor;
const p = t.publish;

function renderCard(patch: Partial<PostPublishCardProps> = {}) {
  const props: PostPublishCardProps = {
    status: 'PUBLISHED',
    publishAt: '2026-10-01T08:00',
    missing: [],
    publishAtError: undefined,
    pending: false,
    dirty: true,
    onStatusChange: vi.fn(),
    onPublishAtChange: vi.fn(),
    ...patch,
  };
  render(<PostPublishCard {...props} />);
  return props;
}

describe('PostPublishCard', () => {
  it('Draft: radio Draft chọn sẵn, câu nhắc nháp không lên web, không có ô ngày', () => {
    renderCard({ status: 'DRAFT', publishAt: '' });
    expect(screen.getByRole('radio', { name: p.draft })).toBeChecked();
    expect(screen.getByText(p.draftHint)).toBeInTheDocument();
    expect(screen.queryByLabelText(p.dateLabel)).not.toBeInTheDocument();
  });

  it('bấm Published báo lên đúng trạng thái đích', async () => {
    const user = userEvent.setup();
    const props = renderCard({ status: 'DRAFT', publishAt: '' });
    await user.click(screen.getByRole('radio', { name: p.published }));
    expect(props.onStatusChange).toHaveBeenCalledWith('PUBLISHED');
  });

  it('Published: ô ngày giờ UTC mang giá trị; đổi thì báo lên', () => {
    const props = renderCard();
    const date = screen.getByLabelText(p.dateLabel);
    expect(date).toHaveValue('2026-10-01T08:00');
    fireEvent.change(date, { target: { value: '2026-10-09T08:00' } });
    expect(props.onPublishAtChange).toHaveBeenCalledWith('2026-10-09T08:00');
  });

  it('danh sách kiểm tra: dòng thiếu ghi "Missing — required to publish", dòng đủ thì không', () => {
    const missing: PostReadinessItem[] = ['excerpt', 'cover'];
    renderCard({ missing });
    expect(screen.getAllByText(p.missing)).toHaveLength(2);
    expect(screen.getByText(p.readiness.content)).toBeInTheDocument();
  });

  it('Save khoá khi chưa có thay đổi; khoá kèm lý do khi đang tải ảnh bìa', () => {
    renderCard({ dirty: false });
    expect(screen.getByRole('button', { name: t.save })).toHaveAttribute('aria-disabled', 'true');
  });

  it('đang tải ảnh bìa: Save khoá và nói vì sao', () => {
    renderCard({ blockedNote: t.busyUploading });
    expect(screen.getByRole('button', { name: t.save })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(t.busyUploading)).toBeInTheDocument();
  });
});
```

  ĐỎ (chưa có component).

- [ ] **B10. Cài ba component nhỏ.** Tạo `components/posts/editor/post-banner.tsx`:

```tsx
'use client';

import type { PostReadinessItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import { CircleAlertIcon } from 'lucide-react';

/**
 * Dải báo của một lần Save hỏng (spec P4e-4 §4.4) — cùng dáng `FormBanner` của khu sửa tour:
 * giọng cảnh báo cho phiên bản cũ và cho "chưa đủ để đăng", đỏ cho lỗi. Mục thiếu là link
 * tới đúng ô của nó.
 */
const t = messages.admin.posts.editor;

export type PostBannerState =
  | { kind: 'stale' }
  | { kind: 'notReady'; missing: readonly PostReadinessItem[] }
  | { kind: 'error'; message: string; uncertain: boolean };

/** Đích của từng mục thiếu — `id` của ô tương ứng trên trang. */
const FIELD_ANCHOR: Record<PostReadinessItem, string> = {
  content: '#post-content',
  excerpt: '#post-excerpt',
  cover: '#post-cover',
};

export function PostBanner({
  banner,
  onReload,
}: {
  banner: PostBannerState;
  onReload: () => void;
}) {
  const reload = (
    <Button type="button" variant="outline" size="sm" onClick={onReload}>
      {t.banners.reload}
    </Button>
  );

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-sm',
        banner.kind === 'error'
          ? 'border-destructive/40 bg-destructive/10 text-destructive-emphasis'
          : 'border-warning/50 bg-warning/10',
      )}
    >
      <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="grid flex-1 gap-2">
        {banner.kind === 'stale' ? (
          <>
            <p>{t.banners.stale}</p>
            <div>{reload}</div>
          </>
        ) : null}
        {banner.kind === 'notReady' ? (
          <>
            <p>{t.banners.notReady}</p>
            <ul className="grid list-disc gap-0.5 pl-4">
              {banner.missing.map((item) => (
                <li key={item}>
                  <a
                    href={FIELD_ANCHOR[item]}
                    className="underline underline-offset-4 hover:no-underline"
                  >
                    {t.publish.readiness[item]}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {banner.kind === 'error' ? (
          <>
            <p>{banner.message}</p>
            {banner.uncertain ? <div>{reload}</div> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
```

  Tạo `components/posts/editor/post-editor-header.tsx`:

```tsx
'use client';

import type { AdminPostDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { ChevronLeftIcon, ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { formatDateTime } from '@/lib/bookings-view';
import { POST_STATUS_VARIANT, POSTS_LIST_HREF, postStatusLabel } from '@/lib/posts-view';
import { postPageUrl } from '@/lib/site';

/**
 * Phần đầu trang sửa bài (spec P4e-4 §4.4) — cùng dáng phần đầu khu sửa tour: Back, tiêu đề,
 * chip trạng thái, View on site, lần lưu cuối. Đọc bản ĐÃ LƯU, không phải bản đang soạn: chip
 * "Published" không được sáng trước khi admin bấm Save.
 *
 * View on site chỉ hiện khi bài ĐÃ đăng — nháp và bài hẹn giờ mở ra là 404.
 */
const t = messages.admin.posts.editor;

export function PostEditorHeader({ detail }: { detail: AdminPostDetail }) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href={POSTS_LIST_HREF}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {t.back}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{detail.title}</h2>
          <p className="text-sm text-muted-foreground">
            /blog/{detail.slug} · {t.lastSaved(formatDateTime(detail.version))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={POST_STATUS_VARIANT[detail.displayStatus]} className="h-7 px-2.5 text-sm">
            {postStatusLabel(detail.displayStatus)}
          </Badge>
          {detail.displayStatus === 'published' ? (
            <ButtonLink
              variant="outline"
              href={postPageUrl(detail.slug)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
              {t.viewOnSite}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

  Tạo `components/posts/editor/post-publish-card.tsx`:

```tsx
'use client';

import {
  PostReadinessItemSchema,
  type PostReadinessItem,
  type PostStatus,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@tourism/ui/components/card';
import { Input } from '@tourism/ui/components/input';
import { RadioGroup, RadioGroupItem } from '@tourism/ui/components/radio-group';
import { useId } from 'react';
import { FormField } from '@/components/kit/form-field';
import { StableLabel } from '@/components/kit/stable-label';
import { StateMark } from '@/components/tours/editor/step-aside';
import { POST_FORM_ID } from '@/lib/post-form';

/**
 * Card Publish ở đầu cột phải (spec P4e-4 §4.4): chọn Draft hay Published, ngày giờ đăng
 * theo UTC, danh sách ba mục cần để đăng, và nút Save DUY NHẤT của trang (gắn vào form bằng
 * thuộc tính `form` — Quyết định 14).
 *
 * Danh sách đọc bản ĐANG SOẠN (`projectedPostReadiness` do trang truyền xuống), nên xoá tóm
 * tắt là dòng ấy chuyển "Missing" ngay, trước khi lưu.
 */
const t = messages.admin.posts.editor;
const p = t.publish;
const SAVE_LABELS = [t.save, t.saving] as const;
const STATUSES: readonly PostStatus[] = ['DRAFT', 'PUBLISHED'];

export interface PostPublishCardProps {
  status: PostStatus;
  /** Giá trị ô ngày (`YYYY-MM-DDTHH:mm`, UTC). */
  publishAt: string;
  missing: readonly PostReadinessItem[];
  publishAtError: string | undefined;
  pending: boolean;
  dirty: boolean;
  /** Lý do Save khoá dù form có thay đổi (ảnh bìa đang tải lên). */
  blockedNote?: string;
  onStatusChange: (status: PostStatus) => void;
  onPublishAtChange: (value: string) => void;
}

export function PostPublishCard({
  status,
  publishAt,
  missing,
  publishAtError,
  pending,
  dirty,
  blockedNote,
  onStatusChange,
  onPublishAtChange,
}: PostPublishCardProps) {
  const ids = useId();

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{p.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <span id={`${ids}-status`} className="text-sm font-medium">
            {p.statusLabel}
          </span>
          <RadioGroup
            aria-labelledby={`${ids}-status`}
            value={status}
            onValueChange={(value) => onStatusChange(value === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT')}
            className="grid gap-2"
          >
            {STATUSES.map((option) => (
              <label
                key={option}
                htmlFor={`${ids}-${option}`}
                className="flex items-center gap-2 text-sm"
              >
                <RadioGroupItem id={`${ids}-${option}`} value={option} />
                {option === 'DRAFT' ? p.draft : p.published}
              </label>
            ))}
          </RadioGroup>
          {status === 'DRAFT' ? (
            <p className="text-xs text-muted-foreground">{p.draftHint}</p>
          ) : null}
        </div>

        {status === 'PUBLISHED' ? (
          <FormField id="post-publish-at" label={p.dateLabel} hint={p.dateHint} error={publishAtError}>
            {(describedBy) => (
              <Input
                id="post-publish-at"
                type="datetime-local"
                value={publishAt}
                aria-invalid={publishAtError !== undefined}
                aria-describedby={describedBy}
                onChange={(event) => onPublishAtChange(event.target.value)}
              />
            )}
          </FormField>
        ) : null}

        <div className="grid gap-2">
          <p className="text-sm font-medium">{p.checklist}</p>
          <ul className="grid gap-2">
            {PostReadinessItemSchema.options.map((item) => {
              const ok = !missing.includes(item);
              return (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <StateMark state={ok ? 'ok' : 'warn'} className="mt-0.5" />
                  <span className="grid gap-0.5">
                    <span>{p.readiness[item]}</span>
                    {ok ? null : <span className="text-xs text-muted-foreground">{p.missing}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="grid gap-2">
          {blockedNote ? <p className="text-xs text-muted-foreground">{blockedNote}</p> : null}
          <Button
            type="submit"
            form={POST_FORM_ID}
            focusableWhenDisabled
            disabled={!dirty || pending || blockedNote !== undefined}
          >
            <StableLabel label={pending ? t.saving : t.save} reserve={SAVE_LABELS} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

  Chạy hai spec — XANH. Đột biến: header bỏ điều kiện `=== 'published'` của View on site;
  card bỏ `!dirty` khỏi `disabled`.

- [ ] **B11. Test trước — trang sửa.** Tạo `components/posts/editor/post-editor.spec.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesProvider } from '@/components/kit/unsaved-changes';
import type { UpdatePostAction } from '@/lib/posts-write';
import { POST_ID, POST_VERSION, postDetailFixture, TOUR_A } from '@/test/post-detail';
import { PostEditor, type PostEditorProps } from './post-editor';

/**
 * Trang sửa bài (spec P4e-4 §4.4): MỘT form, MỘT nút Save gửi cả form; chặn đăng khi còn
 * thiếu TRƯỚC khi gửi; dải báo theo mã lỗi; phần đầu đọc bản đã lưu.
 */
const t = messages.admin.posts.editor;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href), refresh: () => refresh() }),
}));

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  push.mockReset();
  refresh.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Props tối thiểu của task này; Task 10–12 thêm prop thì sửa ĐÚNG hàm này. */
function props(patch: Partial<PostEditorProps> = {}): PostEditorProps {
  return { detail: postDetailFixture(), update: vi.fn<UpdatePostAction>(), ...patch };
}

function renderEditor(patch: Partial<PostEditorProps> = {}) {
  const user = userEvent.setup();
  const all = props(patch);
  render(<PostEditor {...all} />);
  return { user, ...all };
}

const saveButton = () => screen.getByRole('button', { name: t.save });

describe('PostEditor — lưu cả form', () => {
  it('chưa sửa gì thì Save khoá; sửa tiêu đề rồi lưu: gửi cả form, toast, refresh, Save khoá lại', async () => {
    const saved = postDetailFixture({
      title: 'Eating your way through Hội An, again',
      version: '2026-10-02T10:20:00.000Z',
    });
    const update = vi.fn<UpdatePostAction>().mockResolvedValue({ ok: true, detail: saved });
    const { user } = renderEditor({ update });
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');

    await user.type(screen.getByLabelText(t.fields.title), ', again');
    await user.click(saveButton());

    await waitFor(() => expect(success).toHaveBeenCalledWith(t.saved));
    expect(update).toHaveBeenCalledWith({
      id: POST_ID,
      version: POST_VERSION,
      title: 'Eating your way through Hội An, again',
      excerpt: 'Five stalls before noon.',
      content: '## Morning\n\nBánh mì first.',
      status: 'PUBLISHED',
      publishedAt: '2026-10-01T08:00:00.000Z',
      tags: ['Food'],
      relatedTourIds: [TOUR_A.id],
      cover: { publicId: `tourism/posts/${POST_ID}/cover`, alt: 'Lanterns over the river' },
    });
    expect(refresh).toHaveBeenCalled();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Eating your way through Hội An, again' }),
    ).toBeInTheDocument();
  });

  it('chọn Published khi còn thiếu: KHÔNG gửi lệnh; dải báo liệt kê mục thiếu, mỗi mục link tới ô', async () => {
    const update = vi.fn<UpdatePostAction>();
    const { user } = renderEditor({
      detail: postDetailFixture({ status: 'DRAFT', publishedAt: null, excerpt: null, cover: null }),
      update,
    });

    await user.click(screen.getByRole('radio', { name: t.publish.published }));
    await user.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(t.banners.notReady)).toBeInTheDocument();
    expect(within(alert).getByRole('link', { name: t.publish.readiness.excerpt })).toHaveAttribute(
      'href',
      '#post-excerpt',
    );
    expect(within(alert).getByRole('link', { name: t.publish.readiness.cover })).toHaveAttribute(
      'href',
      '#post-cover',
    );
    expect(
      within(alert).queryByRole('link', { name: t.publish.readiness.content }),
    ).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('chuyển sang Published khi ô ngày trống: tự điền giờ hiện tại theo UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-02T12:34:56.000Z'));
    const { user } = renderEditor({
      detail: postDetailFixture({ status: 'DRAFT', publishedAt: null }),
    });

    await user.click(screen.getByRole('radio', { name: t.publish.published }));

    expect(screen.getByLabelText(t.publish.dateLabel)).toHaveValue('2026-10-02T12:34');
  });

  it('STALE_POST: dải báo có Reload; bấm Reload làm mới trang', async () => {
    const update = vi.fn<UpdatePostAction>().mockResolvedValue({ ok: false, code: 'STALE_POST' });
    const { user } = renderEditor({ update });

    await user.type(screen.getByLabelText(t.fields.title), '!');
    await user.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(t.banners.stale)).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: t.banners.reload }));
    expect(refresh).toHaveBeenCalled();
  });

  it('NOT_FOUND: toast lỗi, về danh sách bài', async () => {
    const update = vi.fn<UpdatePostAction>().mockResolvedValue({ ok: false, code: 'NOT_FOUND' });
    const { user } = renderEditor({ update });

    await user.type(screen.getByLabelText(t.fields.title), '!');
    await user.click(saveButton());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/posts'));
    expect(errorToast).toHaveBeenCalledWith(t.errors.NOT_FOUND);
  });

  it('lệnh ném: dải đỏ nói kết cục không rõ, kèm Reload', async () => {
    const update = vi.fn<UpdatePostAction>().mockRejectedValue(new Error('network'));
    const { user } = renderEditor({ update });

    await user.type(screen.getByLabelText(t.fields.title), '!');
    await user.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(messages.admin.errors.write.GENERIC)).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: t.banners.reload })).toBeInTheDocument();
  });

  it('thân bài có ảnh nhúng: câu lỗi ngay dưới ô Content, lệnh không chạy', async () => {
    const update = vi.fn<UpdatePostAction>();
    const { user } = renderEditor({ update });
    const content = screen.getByLabelText(t.fields.content);

    await user.clear(content);
    await user.click(content);
    // `paste` chứ không `type`: user-event coi `[` là mở đầu tên phím.
    await user.paste('![x](https://example.com/x.jpg)');
    await user.click(saveButton());

    expect(await screen.findByText(t.form.errors.image)).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('rời trang khi còn thay đổi chưa lưu: hộp hỏi lại bật', async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider>
        <PostEditor {...props()} />
      </UnsavedChangesProvider>,
    );

    await user.type(screen.getByLabelText(t.fields.title), '!');
    await user.click(screen.getByRole('link', { name: t.back }));

    expect(
      await screen.findByRole('alertdialog', { name: messages.admin.unsavedChanges.title }),
    ).toBeInTheDocument();
  });
});
```

  ĐỎ (chưa có component).

- [ ] **B12. Cài trang sửa.** Tạo `components/posts/editor/post-editor.tsx`:

```tsx
'use client';

import { type AdminPostDetail, POST_EXCERPT_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Card, CardContent } from '@tourism/ui/components/card';
import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/kit/form-field';
import { useReportUnsaved } from '@/components/kit/unsaved-changes';
import { StepColumns } from '@/components/tours/editor/editor-form-frame';
import { isUncertainOutcome } from '@/lib/api/write-error';
import { hasFormErrors } from '@/lib/form-errors';
import {
  POST_FORM_ID,
  type PostFormValues,
  postFormValues,
  postPayload,
  projectedPostReadiness,
  validatePostForm,
  withStatus,
} from '@/lib/post-form';
import { POSTS_LIST_HREF } from '@/lib/posts-view';
import { type UpdatePostAction, type UpdatePostResult, updatePostErrorCopy } from '@/lib/posts-write';
import { isNewerVersion, useVersionedForm } from '@/lib/use-versioned-form';
import { PostBanner, type PostBannerState } from './post-banner';
import { PostEditorHeader } from './post-editor-header';
import { PostPublishCard } from './post-publish-card';

/**
 * Trang sửa một bài (spec P4e-4 §4.4, ADR-0051 §8) — MỘT form, MỘT nút Save gửi cả form
 * (`admin.posts.update`). Không dùng khung bước của tour (`EditorFormFrame`): một bài viết
 * không có phần nào nặng tới mức phải lưu riêng; chỉ mượn lưới hai cột `StepColumns`.
 *
 * - Giá trị đang soạn, bản gốc, phiên bản: `useVersionedForm` (lõi chung với tour).
 * - Chọn Published mà còn thiếu thì chặn TRƯỚC khi gửi bằng chính hàm server dùng
 *   (Quyết định 11); mã `POST_NOT_READY` từ server vẫn được xử, cùng một dải báo.
 * - Dải báo và câu lỗi của card chỉ sống cùng phiên bản đã sinh ra chúng — Reload nạp bản
 *   mới là chúng tự tắt.
 * - Phần đầu đọc bản ĐÃ LƯU, cột phải đọc bản ĐANG SOẠN.
 */
const t = messages.admin.posts.editor;

const STALE: PostBannerState = { kind: 'stale' };

export interface PostEditorProps {
  detail: AdminPostDetail;
  update: UpdatePostAction;
}

export function PostEditor({ detail, update }: PostEditorProps) {
  const router = useRouter();
  const form = useVersionedForm(detail, postFormValues);
  const { values, version } = form;
  /** Bản server mới nhất form biết — lần lưu vừa xong, hay `detail` mới hơn sau Reload. */
  const [lastSaved, setLastSaved] = useState(detail);
  const saved = isNewerVersion(detail.version, lastSaved.version) ? detail : lastSaved;

  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [banner, setBanner] = useState<{ state: PostBannerState; version: string } | null>(null);

  useReportUnsaved(form.dirty);

  const errors = form.showValidation ? validatePostForm(values) : {};
  const missing = projectedPostReadiness(values);
  const shownBanner =
    banner !== null && banner.version === version
      ? banner.state
      : form.serverChanged
        ? STALE
        : null;

  function patch(next: Partial<PostFormValues>) {
    form.setValues((current) => ({ ...current, ...next }));
  }

  async function save() {
    if (inFlight.current) return;
    form.setShowValidation(true);
    if (hasFormErrors(validatePostForm(values))) return;
    if (values.status === 'PUBLISHED' && missing.length > 0) {
      setBanner({ state: { kind: 'notReady', missing }, version });
      return;
    }

    inFlight.current = true;
    setPending(true);
    setBanner(null);
    let result: UpdatePostResult;
    try {
      result = await update(postPayload(detail.id, version, values));
    } catch {
      // Action ném (mạng đứt, redeploy) ⇒ không biết lệnh đã đi tới đâu — như `useSectionSave`.
      result = { ok: false, code: 'GENERIC' };
    }
    inFlight.current = false;
    setPending(false);

    if (result.ok) {
      form.adopt(result.detail);
      setLastSaved(result.detail);
      toast.success(t.saved);
      router.refresh();
      return;
    }
    const { code } = result;
    if (code === 'STALE_POST') {
      setBanner({ state: STALE, version });
    } else if (code === 'POST_NOT_READY') {
      // Server tính từ chính input nên hai bên luôn khớp; danh sách rỗng chỉ khi có lỗi lạ.
      setBanner({
        state:
          missing.length > 0
            ? { kind: 'notReady', missing }
            : { kind: 'error', message: updatePostErrorCopy(code), uncertain: false },
        version,
      });
    } else if (code === 'NOT_FOUND') {
      toast.error(updatePostErrorCopy(code));
      router.push(POSTS_LIST_HREF);
    } else {
      // Mọi mã còn lại hiện ở dải đỏ, kèm Reload khi không rõ lệnh đã đi tới đâu.
      setBanner({
        state: { kind: 'error', message: updatePostErrorCopy(code), uncertain: isUncertainOutcome(code) },
        version,
      });
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      <PostEditorHeader detail={saved} />
      <StepColumns
        aside={
          <PostPublishCard
            status={values.status}
            publishAt={values.publishAt}
            missing={missing}
            publishAtError={errors.publishAt}
            pending={pending}
            dirty={form.dirty}
            onStatusChange={(status) =>
              form.setValues((current) => withStatus(current, status, new Date()))
            }
            onPublishAtChange={(publishAt) => patch({ publishAt })}
          />
        }
      >
        <div className="flex min-w-0 flex-col gap-6">
          <form
            id={POST_FORM_ID}
            noValidate
            className="flex min-w-0 flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (form.dirty && !pending) void save();
            }}
          >
            {shownBanner ? <PostBanner banner={shownBanner} onReload={form.reload} /> : null}

            <Card>
              <CardContent className="grid gap-4">
                <FormField id="post-title" label={t.fields.title} error={errors.title}>
                  {(describedBy) => (
                    <Input
                      id="post-title"
                      value={values.title}
                      aria-invalid={errors.title !== undefined}
                      aria-describedby={describedBy}
                      onChange={(event) => patch({ title: event.target.value })}
                    />
                  )}
                </FormField>
                <div className="grid gap-1">
                  <FormField
                    id="post-excerpt"
                    label={t.fields.excerpt}
                    hint={t.fields.excerptHint}
                    error={errors.excerpt}
                  >
                    {(describedBy) => (
                      <Textarea
                        id="post-excerpt"
                        rows={3}
                        value={values.excerpt}
                        aria-invalid={errors.excerpt !== undefined}
                        aria-describedby={describedBy}
                        onChange={(event) => patch({ excerpt: event.target.value })}
                      />
                    )}
                  </FormField>
                  <p className="text-right text-xs tabular-nums text-muted-foreground">
                    {t.fields.count(values.excerpt.length, POST_EXCERPT_MAX)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <FormField id="post-content" label={t.fields.content} error={errors.content}>
                  {(describedBy) => (
                    <Textarea
                      id="post-content"
                      rows={18}
                      className="font-mono text-sm"
                      value={values.content}
                      aria-invalid={errors.content !== undefined}
                      aria-describedby={describedBy}
                      onChange={(event) => patch({ content: event.target.value })}
                    />
                  )}
                </FormField>
              </CardContent>
            </Card>
          </form>
        </div>
      </StepColumns>
    </div>
  );
}
```

  Chạy spec — XANH. Đột biến: bỏ chặn `missing.length > 0` trước khi gửi (ca "khi còn thiếu" phải đỏ); `adopt`
  trước `toast` bị bỏ (ca đầu: Save phải khoá lại — đỏ); dải báo không gắn `version` (không
  ca nào ở đây đỏ — ghi là chưa phủ; Task 13 thử tay Reload).
- [ ] **B13.** Quy trình gate, rồi commit:
  `feat(admin): trang sửa bài — một nút Save, cổng đăng, dải báo theo mã lỗi`

## Task 9 — Admin: trình soạn markdown (hàng nút, Write/Preview)

**Files:**

- Create: `apps/admin/src/lib/markdown-actions.ts` + spec
- Create: `apps/admin/src/components/posts/editor/markdown-editor.tsx` + spec
- Modify: `apps/admin/src/components/posts/editor/post-editor.tsx` (ô Content dùng trình soạn)

**Interfaces:**

- Consumes: `ArticleMarkdown` từ `@tourism/ui/components/article-markdown` (Task 5).
- Produces: `MarkdownAction` (`'heading' | 'bold' | 'italic' | 'bullet' | 'link'`),
  `TextSelection { start; end }`, `MarkdownEdit { text; selection }`,
  `applyMarkdownAction(text, selection, action): MarkdownEdit`;
  `MarkdownEditor({ id, value, onChange, invalid, describedBy })`.

- [ ] **B1. Test trước — hàm thuần.** Tạo `lib/markdown-actions.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyMarkdownAction } from './markdown-actions';

describe('applyMarkdownAction — Bold, Italic', () => {
  it('bọc vùng chọn và giữ chọn đúng chữ cũ', () => {
    expect(applyMarkdownAction('eat pho now', { start: 4, end: 7 }, 'bold')).toEqual({
      text: 'eat **pho** now',
      selection: { start: 6, end: 9 },
    });
  });

  it('không chọn gì: chèn cặp dấu, con trỏ ở giữa', () => {
    expect(applyMarkdownAction('ab', { start: 1, end: 1 }, 'italic')).toEqual({
      text: 'a**b',
      selection: { start: 2, end: 2 },
    });
  });

  it('vùng chọn ngược chiều (kéo từ phải sang trái) vẫn bọc đúng', () => {
    expect(applyMarkdownAction('eat pho now', { start: 7, end: 4 }, 'italic')).toEqual({
      text: 'eat *pho* now',
      selection: { start: 5, end: 8 },
    });
  });
});

describe('applyMarkdownAction — Heading, Bullet list', () => {
  it('thêm `## ` cho dòng chứa con trỏ; vùng chọn mới phủ trọn dòng', () => {
    expect(applyMarkdownAction('intro\nMorning\nend', { start: 9, end: 9 }, 'heading')).toEqual({
      text: 'intro\n## Morning\nend',
      selection: { start: 6, end: 16 },
    });
  });

  it('bấm lại thì gỡ', () => {
    expect(applyMarkdownAction('## Morning', { start: 4, end: 4 }, 'heading')).toEqual({
      text: 'Morning',
      selection: { start: 0, end: 7 },
    });
  });

  it('nhiều dòng: thêm cho mỗi dòng có chữ, bỏ qua dòng trống', () => {
    expect(applyMarkdownAction('rice\n\nnoodles', { start: 0, end: 13 }, 'bullet')).toEqual({
      text: '- rice\n\n- noodles',
      selection: { start: 0, end: 17 },
    });
  });

  it('mọi dòng đã có tiền tố thì gỡ hết; chỉ một phần có thì thêm cho phần còn thiếu', () => {
    expect(applyMarkdownAction('- a\n- b', { start: 0, end: 7 }, 'bullet').text).toBe('a\nb');
    expect(applyMarkdownAction('- a\nb', { start: 0, end: 5 }, 'bullet').text).toBe('- a\n- b');
  });

  it('chọn trọn dòng kèm ký tự xuống dòng: dòng sau không bị tính', () => {
    expect(applyMarkdownAction('a\nb', { start: 0, end: 2 }, 'heading').text).toBe('## a\nb');
  });

  it('con trỏ trên dòng trống: vẫn thêm cho dòng ấy — bắt đầu một tiêu đề mới', () => {
    expect(applyMarkdownAction('a\n\nb', { start: 2, end: 2 }, 'heading')).toEqual({
      text: 'a\n## \nb',
      selection: { start: 2, end: 5 },
    });
  });

  it('con trỏ ở đầu văn bản mở đầu bằng dòng trống', () => {
    expect(applyMarkdownAction('\nb', { start: 0, end: 0 }, 'bullet').text).toBe('- \nb');
  });
});

describe('applyMarkdownAction — Link', () => {
  it('bọc vùng chọn thành [chữ](https://) và chọn sẵn phần URL để gõ đè', () => {
    expect(applyMarkdownAction('see the map', { start: 4, end: 11 }, 'link')).toEqual({
      text: 'see [the map](https://)',
      selection: { start: 14, end: 22 },
    });
  });

  it('không chọn gì: chèn [](https://), con trỏ vào trong ngoặc vuông để gõ chữ trước', () => {
    expect(applyMarkdownAction('see ', { start: 4, end: 4 }, 'link')).toEqual({
      text: 'see [](https://)',
      selection: { start: 5, end: 5 },
    });
  });
});
```

  ĐỎ, rồi tạo `lib/markdown-actions.ts`:

```ts
/**
 * Hàng nút của trình soạn bài (spec P4e-4 §4.4, ADR-0051 §1) — THUẦN: nhận chữ và vùng
 * chọn, trả chữ mới và vùng chọn mới. Component chỉ đọc `selectionStart/End` của ô rồi
 * ghi kết quả lại. Nút chỉ CHÈN cú pháp markdown — không có định dạng ẩn nào ngoài chữ.
 */
export type MarkdownAction = 'heading' | 'bold' | 'italic' | 'bullet' | 'link';

export interface TextSelection {
  start: number;
  end: number;
}

export interface MarkdownEdit {
  text: string;
  selection: TextSelection;
}

const LINE_PREFIX = { heading: '## ', bullet: '- ' } as const;
const WRAP_MARK = { bold: '**', italic: '*' } as const;
const LINK_URL = 'https://';

export function applyMarkdownAction(
  text: string,
  selection: TextSelection,
  action: MarkdownAction,
): MarkdownEdit {
  // Kéo chọn từ phải sang trái cho `start > end` — chuẩn hoá trước.
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  switch (action) {
    case 'bold':
    case 'italic':
      return wrap(text, start, end, WRAP_MARK[action]);
    case 'link':
      return link(text, start, end);
    case 'heading':
    case 'bullet':
      return togglePrefix(text, start, end, LINE_PREFIX[action]);
  }
}

/** Bọc vùng chọn; không chọn gì thì chèn cặp dấu và đặt con trỏ giữa. Vùng chọn mới giữ đúng chữ cũ. */
function wrap(text: string, start: number, end: number, mark: string): MarkdownEdit {
  return {
    text: `${text.slice(0, start)}${mark}${text.slice(start, end)}${mark}${text.slice(end)}`,
    selection: { start: start + mark.length, end: end + mark.length },
  };
}

/** `[chữ](https://)`, chọn sẵn phần URL; không chọn gì thì con trỏ vào trong `[]` để gõ chữ trước. */
function link(text: string, start: number, end: number): MarkdownEdit {
  const label = text.slice(start, end);
  const next = `${text.slice(0, start)}[${label}](${LINK_URL})${text.slice(end)}`;
  if (label === '') return { text: next, selection: { start: start + 1, end: start + 1 } };
  const urlStart = start + label.length + 3;
  return { text: next, selection: { start: urlStart, end: urlStart + LINK_URL.length } };
}

/**
 * Thêm tiền tố cho MỖI dòng chạm vào vùng chọn; mọi dòng (có chữ) đã có rồi thì gỡ — bấm
 * lại là bỏ. Dòng trống bị bỏ qua để chọn ba đoạn không sinh ra gạch đầu dòng rỗng; con trỏ
 * đứng trên một dòng trống thì vẫn thêm cho dòng ấy. Chọn trọn dòng (vùng chọn dừng ngay
 * đầu dòng sau) thì dòng sau không tính. Vùng chọn mới phủ trọn các dòng đã sửa.
 */
function togglePrefix(text: string, start: number, end: number, prefix: string): MarkdownEdit {
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end;
  // `lastIndexOf('\n', -1)` vẫn xét vị trí 0 — chặn riêng ca con trỏ ở đầu văn bản.
  const blockStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', last);
  const blockEnd = nextBreak === -1 ? text.length : nextBreak;

  const lines = text.slice(blockStart, blockEnd).split('\n');
  const filled = lines.filter((line) => line.trim() !== '');
  const remove = (filled.length > 0 ? filled : lines).every((line) => line.startsWith(prefix));
  const edited = lines.map((line) => {
    if (filled.length > 0 && line.trim() === '') return line;
    if (remove) return line.slice(prefix.length);
    return line.startsWith(prefix) ? line : `${prefix}${line}`;
  });
  const block = edited.join('\n');
  return {
    text: `${text.slice(0, blockStart)}${block}${text.slice(blockEnd)}`,
    selection: { start: blockStart, end: blockStart + block.length },
  };
}
```

  XANH. Đột biến: bỏ chặn `start === 0` (ca dòng trống đầu văn bản phải đỏ); bỏ `last`
  (dùng `end`) — ca "chọn trọn dòng" phải đỏ; `urlStart` lệch một; bỏ nhánh bỏ qua dòng
  trống.

- [ ] **B2. Test trước — component.** Tạo `components/posts/editor/markdown-editor.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MarkdownEditor } from './markdown-editor';

/**
 * Trình soạn thân bài (spec P4e-4 §4.4): hàng nút chèn cú pháp và giữ tiêu điểm ở ô; tab
 * Preview vẽ bằng CHÍNH bộ render của web.
 */
const t = messages.admin.posts.editor.markdown;

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <MarkdownEditor
      id="post-content"
      value={value}
      onChange={setValue}
      invalid={false}
      describedBy={undefined}
    />
  );
}

function textarea(): HTMLTextAreaElement {
  const node = screen.getByRole('textbox');
  if (!(node instanceof HTMLTextAreaElement)) throw new Error('Không thấy ô chữ');
  return node;
}

function select(start: number, end: number) {
  textarea().focus();
  textarea().setSelectionRange(start, end);
}

describe('MarkdownEditor', () => {
  it('Bold bọc vùng chọn, giữ tiêu điểm ở ô và chọn lại đúng chữ cũ', async () => {
    const user = userEvent.setup();
    render(<Harness initial="eat pho now" />);
    select(4, 7);

    await user.click(screen.getByRole('button', { name: t.bold }));

    expect(textarea()).toHaveValue('eat **pho** now');
    expect(textarea()).toHaveFocus();
    expect([textarea().selectionStart, textarea().selectionEnd]).toEqual([6, 9]);
  });

  it('Heading thêm `## ` cho dòng chứa con trỏ; bấm lần nữa thì gỡ', async () => {
    const user = userEvent.setup();
    render(<Harness initial={'intro\nMorning'} />);
    select(9, 9);

    await user.click(screen.getByRole('button', { name: t.heading }));
    expect(textarea()).toHaveValue('intro\n## Morning');

    await user.click(screen.getByRole('button', { name: t.heading }));
    expect(textarea()).toHaveValue('intro\nMorning');
  });

  it('Link bọc vùng chọn và chọn sẵn đúng phần URL để gõ đè', async () => {
    const user = userEvent.setup();
    render(<Harness initial="see the map" />);
    select(4, 11);

    await user.click(screen.getByRole('button', { name: t.link }));

    expect(textarea()).toHaveValue('see [the map](https://)');
    expect(textarea()).toHaveFocus();
    expect(
      textarea().value.slice(textarea().selectionStart, textarea().selectionEnd),
    ).toBe('https://');
  });

  it('hàng nút là một toolbar có tên, trỏ tới ô chữ', () => {
    render(<Harness initial="" />);
    expect(screen.getByRole('toolbar', { name: t.toolbar })).toHaveAttribute(
      'aria-controls',
      'post-content',
    );
  });

  it('Preview vẽ bằng bộ render của web (id heading như trang bài); hàng nút ẩn đi', async () => {
    const user = userEvent.setup();
    render(<Harness initial={'## Morning\n\nBánh mì first.'} />);

    await user.click(screen.getByRole('tab', { name: t.preview }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Morning' })).toHaveAttribute(
      'id',
      'morning',
    );
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('Preview khi thân bài còn trống', async () => {
    const user = userEvent.setup();
    render(<Harness initial="   " />);

    await user.click(screen.getByRole('tab', { name: t.preview }));

    expect(await screen.findByText(t.previewEmpty)).toBeInTheDocument();
  });
});
```

  ĐỎ (chưa có component).

- [ ] **B3. Cài.** Tạo `components/posts/editor/markdown-editor.tsx`:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { ArticleMarkdown } from '@tourism/ui/components/article-markdown';
import { Button } from '@tourism/ui/components/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@tourism/ui/components/tabs';
import { Textarea } from '@tourism/ui/components/textarea';
import {
  BoldIcon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  type LucideIcon,
} from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  applyMarkdownAction,
  type MarkdownAction,
  type TextSelection,
} from '@/lib/markdown-actions';

/**
 * Trình soạn thân bài (spec P4e-4 §4.4, ADR-0051 §1): ô markdown, hàng nút CHÈN cú pháp, tab
 * Preview vẽ bằng CHÍNH bộ render của web (`ArticleMarkdown` ở `@tourism/ui`) — thứ admin
 * xem trước là thứ khách đọc.
 *
 * Nút giữ tiêu điểm ở ô (`onMouseDown` chặn mặc định), rồi đặt lại vùng chọn SAU khi React
 * vẽ chữ mới: ô kiểm soát nhận `value` mới thì trình duyệt đẩy con trỏ về cuối.
 */
const t = messages.admin.posts.editor.markdown;

const ACTIONS: readonly { action: MarkdownAction; label: string; icon: LucideIcon }[] = [
  { action: 'heading', label: t.heading, icon: Heading2Icon },
  { action: 'bold', label: t.bold, icon: BoldIcon },
  { action: 'italic', label: t.italic, icon: ItalicIcon },
  { action: 'bullet', label: t.bullet, icon: ListIcon },
  { action: 'link', label: t.link, icon: LinkIcon },
];

export function MarkdownEditor({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  /** `id` của ô chữ — nhãn của `FormField` và link "Content" của dải báo trỏ vào nó. */
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy: string | undefined;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  /** Vùng chọn chờ đặt lại sau lần vẽ kế — chỉ có sau một cú bấm nút. */
  const pendingSelection = useRef<TextSelection | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  useLayoutEffect(() => {
    const next = pendingSelection.current;
    const node = textarea.current;
    if (next === null || node === null) return;
    pendingSelection.current = null;
    node.focus();
    node.setSelectionRange(next.start, next.end);
  });

  function run(action: MarkdownAction) {
    const node = textarea.current;
    if (node === null) return;
    const edit = applyMarkdownAction(
      value,
      { start: node.selectionStart, end: node.selectionEnd },
      action,
    );
    pendingSelection.current = edit.selection;
    onChange(edit.text);
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next === 'preview' ? 'preview' : 'write')}
      className="gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="write">{t.write}</TabsTrigger>
          <TabsTrigger value="preview">{t.preview}</TabsTrigger>
        </TabsList>
        {tab === 'write' ? (
          <div role="toolbar" aria-label={t.toolbar} aria-controls={id} className="flex gap-1">
            {ACTIONS.map(({ action, label, icon: Icon }) => (
              <Button
                key={action}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={label}
                title={label}
                // Giữ tiêu điểm (và vùng chọn) ở ô chữ khi bấm nút.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(action)}
              >
                <Icon aria-hidden="true" />
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      <TabsContent value="write">
        <Textarea
          ref={textarea}
          id={id}
          rows={18}
          className="font-mono text-sm"
          value={value}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      </TabsContent>
      <TabsContent value="preview">
        <div className="min-h-64 rounded-lg border p-4">
          {value.trim() === '' ? (
            <p className="text-sm text-muted-foreground">{t.previewEmpty}</p>
          ) : (
            <ArticleMarkdown markdown={value} />
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
```

  Chạy spec — XANH (Tabs của Base UI mở bất đồng bộ — đã dùng `findBy…`, bài học 4).
  Đột biến: bỏ `onMouseDown` (ca Bold: `toHaveFocus` vẫn có thể xanh trong jsdom — ghi lại
  nếu vậy); bỏ `useLayoutEffect` (ca Bold, ca Link phải đỏ).

- [ ] **B4. Gắn vào trang sửa.** Trong `post-editor.tsx`, thay khối `FormField` của
  `post-content` (đang chứa `Textarea`) bằng:

```tsx
                <FormField
                  id="post-content"
                  label={t.fields.content}
                  hint={t.markdown.syntax}
                  error={errors.content}
                >
                  {(describedBy) => (
                    <MarkdownEditor
                      id="post-content"
                      value={values.content}
                      invalid={errors.content !== undefined}
                      describedBy={describedBy}
                      onChange={(content) => patch({ content })}
                    />
                  )}
                </FormField>
```

  và thêm `import { MarkdownEditor } from './markdown-editor';`. Spec của trang sửa (Task 8)
  phải xanh nguyên — ca "ảnh nhúng" đi qua chính ô chữ trong trình soạn.
- [ ] **B5.** Quy trình gate, rồi commit:
  `feat(admin): trình soạn markdown có hàng nút định dạng và xem trước`

## Task 10 — Admin: card Cover (tải lên, thư viện, alt)

**Files:**

- Modify: `apps/admin/src/lib/post-form.ts` + spec (`coverFileProblem`, `uploadedCoverDraft`, `libraryCoverDraft`)
- Modify: `apps/admin/src/lib/posts-write.ts` + spec (codec ký upload)
- Modify: `apps/admin/src/lib/api/posts.ts` (`signAdminPostCoverUpload`)
- Modify: `apps/admin/src/app/(admin)/posts/[slug]/actions.ts`, `page.tsx`
- Create: `apps/admin/src/components/posts/editor/post-cover-card.tsx` + spec
- Modify: `apps/admin/src/components/posts/editor/post-editor.tsx` + spec

**Interfaces:**

- Consumes: `uploadPhoto`, `UploadedPhoto` (`lib/photo-upload.ts`); `PhotoLibraryDialog`,
  `LoadPhotoLibraryAction` (Task 7); `cloudinaryImageUrl`, `withDeliveryTransform`.
- Produces: `coverFileProblem(file): 'type' | 'size' | null`,
  `uploadedCoverDraft(uploaded, cloudName)`, `libraryCoverDraft(photo)`;
  `SignCoverContractCode`, `SIGN_COVER_CONTRACT_CODES`, `classifySignCoverError`,
  `signCoverErrorCopy`, `SignCoverResult`, `SignCoverAction`; `signAdminPostCoverUpload`;
  `signPostCoverUploadAction`, `loadPostCoverLibraryAction`; `PostCoverCard`; prop mới của
  `PostEditor`: `signCover: SignCoverAction`, `loadLibrary: LoadPhotoLibraryAction`.

- [ ] **B1. Test trước — phần thuần.** Thêm vào `lib/post-form.spec.ts` (import thêm
  `coverFileProblem`, `libraryCoverDraft`, `uploadedCoverDraft`):

```ts
describe('ảnh bìa', () => {
  it('file nhận được: đuôi ảnh cho phép, tối đa 10 MB — cùng luật tab Photos của tour', () => {
    expect(coverFileProblem({ name: 'lanterns.JPG', size: 10 * 1024 * 1024 })).toBeNull();
    expect(coverFileProblem({ name: 'notes.pdf', size: 10 })).toBe('type');
    expect(coverFileProblem({ name: 'huge.jpg', size: 10 * 1024 * 1024 + 1 })).toBe('size');
  });

  it('ảnh vừa tải: URL có phiên bản, alt trống, mang metadata để lưu', () => {
    expect(
      uploadedCoverDraft(
        { publicId: `tourism/posts/${POST_ID}/pid-1`, upload: UPLOAD },
        'demo',
      ),
    ).toEqual({
      publicId: `tourism/posts/${POST_ID}/pid-1`,
      url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1759000000/tourism/posts/${POST_ID}/pid-1`,
      alt: '',
      source: 'UPLOAD',
      upload: UPLOAD,
    });
  });

  it('ảnh thư viện: alt chép từ ảnh gốc (null thành chuỗi rỗng), không metadata', () => {
    const photo = {
      publicId: 'lib/a1',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/a1',
      alt: null,
      width: 2400,
      height: 1600,
      author: null,
      license: null,
    };
    expect(libraryCoverDraft(photo)).toEqual({
      publicId: 'lib/a1',
      url: photo.url,
      alt: '',
      source: 'LIBRARY',
    });
  });
});
```

  ĐỎ, rồi thêm vào `lib/post-form.ts` (import `type AdminLibraryPhoto`,
  `TOUR_PHOTO_MAX_BYTES` từ contract; `cloudinaryImageUrl` từ `./cloudinary-url`;
  `imageExtensionOf`, `type UploadedPhoto` từ `./photo-upload`):

```ts
/**
 * Lý do một file không được nhận làm ảnh bìa, hoặc `null` — cùng luật tab Photos của tour:
 * đuôi trong whitelist ký của Cloudinary, tối đa 10 MB (trần gói, `TOUR_PHOTO_MAX_BYTES`).
 */
export function coverFileProblem(file: { name: string; size: number }): 'type' | 'size' | null {
  if (imageExtensionOf(file.name) === null) return 'type';
  if (file.size > TOUR_PHOTO_MAX_BYTES) return 'size';
  return null;
}

/** Ảnh vừa tải → ảnh bìa đang soạn; alt để trống (tuỳ chọn — Quyết định 3). */
export function uploadedCoverDraft(uploaded: UploadedPhoto, cloudName: string): PostCoverDraft {
  return {
    publicId: uploaded.publicId,
    url: cloudinaryImageUrl(cloudName, uploaded.publicId, uploaded.upload.version),
    alt: '',
    source: 'UPLOAD',
    upload: uploaded.upload,
  };
}

/** Ảnh thư viện → ảnh bìa đang soạn; alt chép từ ảnh gốc, sửa được. */
export function libraryCoverDraft(photo: AdminLibraryPhoto): PostCoverDraft {
  return { publicId: photo.publicId, url: photo.url, alt: photo.alt ?? '', source: 'LIBRARY' };
}
```

  XANH.

- [ ] **B2. Codec ký.** `lib/posts-write.spec.ts` thêm `SIGN_COVER_CONTRACT_CODES` vào import
  và:

```ts
  it('ký ảnh bìa phủ ĐÚNG các mã `admin.posts.signCoverUpload` khai', () => {
    expect([...SIGN_COVER_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.posts.signCoverUpload['~orpc'].errorMap),
    );
  });
```

  ĐỎ, rồi trong `lib/posts-write.ts` (import thêm `type AdminPostSignCoverUploadInput`,
  `type SignedUploadParams`):

```ts
/**
 * Ký là lệnh chưa đụng gì: kết cục không rõ ở đây không có gì để "lỡ đi qua", nên câu
 * GENERIC là câu riêng thay vì giọng ghi chung — khuôn `signCodec` của tab Photos.
 */
const signCodec = createWriteErrorCodec(t.editor.signErrors, {
  transportCopy: { GENERIC: t.editor.signFailed },
});

export type SignCoverContractCode = keyof typeof t.editor.signErrors;
export const SIGN_COVER_CONTRACT_CODES = signCodec.codes;
export const classifySignCoverError = signCodec.classify;
export const signCoverErrorCopy = signCodec.copy;

export type SignCoverResult =
  | { ok: true; params: SignedUploadParams }
  | { ok: false; code: SignCoverContractCode | TransportFailureCode };

export type SignCoverAction = (input: AdminPostSignCoverUploadInput) => Promise<SignCoverResult>;
```

  XANH.

- [ ] **B3. Đường API và hai action.** `lib/api/posts.ts` (import thêm
  `type AdminPostSignCoverUploadInput`, `type SignedUploadParams`):

```ts
/** Ký một lượt tải ảnh bìa — bộ tham số cho TRÌNH DUYỆT POST thẳng lên Cloudinary. */
export async function signAdminPostCoverUpload(
  cookie: string,
  input: AdminPostSignCoverUploadInput,
): Promise<SignedUploadParams> {
  return api.admin.posts.signCoverUpload(input, { context: withAdminAuth(cookie) });
}
```

  `app/(admin)/posts/[slug]/actions.ts` thêm (import thêm `type AdminPhotoLibrary`,
  `type AdminPostSignCoverUploadInput`, `AdminPostSignCoverUploadInputSchema`,
  `type SignedUploadParams`; `signAdminPostCoverUpload`; `fetchTourPhotoLibrary` từ
  `@/lib/api/tours`; `classifyWriteError` từ `@/lib/api/write-error`;
  `type PhotoLibraryResult` từ `@/lib/photo-library`; `classifySignCoverError`,
  `type SignCoverResult`):

```ts
/**
 * Ký một lượt tải ảnh bìa — bộ tham số không mang api_secret (ADR-0021 §1), chữ ký sống
 * mười phút. publicId vào hàng dọn ngay lúc ký (phía API).
 */
export async function signPostCoverUploadAction(
  input: AdminPostSignCoverUploadInput,
): Promise<SignCoverResult> {
  const parsed = AdminPostSignCoverUploadInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let params: SignedUploadParams;
  try {
    params = await signAdminPostCoverUpload(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifySignCoverError(error) };
  }
  return { ok: true, params };
}

/**
 * Kho ảnh địa danh cho hộp chọn ảnh bìa — CÙNG endpoint thư viện của ảnh tour (spec §3.1).
 * Thủ tục không khai mã lỗi, nên chỉ còn lỗi vận chuyển.
 */
export async function loadPostCoverLibraryAction(): Promise<PhotoLibraryResult> {
  const cookie = (await cookies()).toString();
  let library: AdminPhotoLibrary;
  try {
    library = await fetchTourPhotoLibrary(cookie);
  } catch (error) {
    return { ok: false, code: classifyWriteError(error, new Set<never>()) };
  }
  return { ok: true, library };
}
```

- [ ] **B4. Test trước — card Cover.** Tạo `components/posts/editor/post-cover-card.spec.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminPhotoLibrary, SignedUploadParams } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';
import { uploadPhoto } from '@/lib/photo-upload';
import type { PostCoverDraft } from '@/lib/post-form';
import type { SignCoverAction } from '@/lib/posts-write';
import { POST_ID } from '@/test/post-detail';
import { PostCoverCard } from './post-cover-card';

/**
 * Card Cover (spec P4e-4 §4.4): tải lên hoặc chọn từ thư viện, alt tuỳ chọn, ảnh catalog
 * nói không chọn lại được, đang tải thì báo "bận" lên trang để Save khoá.
 */
// Giữ phần thuần thật (đuôi file…), chỉ thay đường XHR — khuôn spec tab Photos.
vi.mock('@/lib/photo-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/photo-upload')>()),
  uploadPhoto: vi.fn(),
}));
const uploadMock = uploadPhoto as unknown as Mock;

const c = messages.admin.posts.editor.cover;

const PARAMS: SignedUploadParams = {
  signature: 'sig',
  timestamp: 1_760_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: `tourism/posts/${POST_ID}`,
  publicId: 'pid-1',
  allowedFormats: 'jpg,jpeg,png,webp,avif,gif',
  transformation: 'c_limit,w_2400,h_2400,fl_force_strip',
  overwrite: false,
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
};
const UPLOADED = {
  publicId: `tourism/posts/${POST_ID}/pid-1`,
  upload: { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 1000 },
};
const CURRENT: PostCoverDraft = {
  publicId: `tourism/posts/${POST_ID}/cover`,
  url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/posts/x/cover',
  alt: 'Lanterns',
  source: 'UPLOAD',
};
const LIBRARY: AdminPhotoLibrary = [
  {
    destination: { id: '7a1b2c3d-0000-4000-8000-0000000000d1', name: 'Hội An' },
    photos: [
      {
        publicId: 'lib/a1',
        url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/a1',
        alt: 'Old town at dusk',
        width: 2400,
        height: 1600,
        author: null,
        license: null,
      },
    ],
  },
];

beforeEach(() => {
  uploadMock.mockReset();
});

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const file = (name: string, bytes = 10) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });

/** Giữ ảnh bìa trong state như trang sửa — card chỉ báo lên, không tự giữ. */
function Harness({
  initial,
  sign = vi.fn<SignCoverAction>(),
  loadLibrary = vi.fn<LoadPhotoLibraryAction>(),
  onBusyChange = vi.fn(),
  serverError = null,
}: {
  initial: PostCoverDraft | null;
  sign?: SignCoverAction;
  loadLibrary?: LoadPhotoLibraryAction;
  onBusyChange?: (busy: boolean) => void;
  serverError?: string | null;
}) {
  const [cover, setCover] = useState<PostCoverDraft | null>(initial);
  return (
    <>
      <PostCoverCard
        postId={POST_ID}
        cover={cover}
        altError={undefined}
        serverError={serverError}
        onChange={setCover}
        onBusyChange={onBusyChange}
        sign={sign}
        loadLibrary={loadLibrary}
      />
      <output data-testid="cover">
        {cover === null
          ? 'none'
          : `${cover.publicId}|${cover.alt}|${cover.source}|${cover.upload ? 'meta' : 'no-meta'}`}
      </output>
    </>
  );
}

describe('PostCoverCard', () => {
  it('tải lên: ký đúng bài, báo bận trong lúc tải, ảnh mới thành ảnh bìa kèm metadata', async () => {
    let finish: (value: typeof UPLOADED) => void = () => {};
    uploadMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const sign = vi.fn<SignCoverAction>().mockResolvedValue({ ok: true, params: PARAMS });
    const onBusyChange = vi.fn();
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness initial={null} sign={sign} onBusyChange={onBusyChange} />);

    await user.upload(fileInput(), file('lanterns.jpg'));

    await waitFor(() => expect(uploadMock).toHaveBeenCalled());
    expect(sign).toHaveBeenCalledWith({ id: POST_ID });
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('button', { name: c.upload })).toHaveAttribute('aria-disabled', 'true');

    finish(UPLOADED);

    await waitFor(() =>
      expect(screen.getByTestId('cover')).toHaveTextContent(`${UPLOADED.publicId}||UPLOAD|meta`),
    );
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('file sai loại hay quá 10 MB: báo ngay, không ký', async () => {
    const sign = vi.fn<SignCoverAction>();
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness initial={CURRENT} sign={sign} />);

    await user.upload(fileInput(), file('notes.pdf'));

    expect(await screen.findByText(c.skipped.type('notes.pdf'))).toBeInTheDocument();
    expect(sign).not.toHaveBeenCalled();
  });

  it('ký hỏng: câu theo mã, không tải, hết bận', async () => {
    const sign = vi
      .fn<SignCoverAction>()
      .mockResolvedValue({ ok: false, code: 'MEDIA_UPLOAD_NOT_CONFIGURED' });
    const onBusyChange = vi.fn();
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness initial={null} sign={sign} onBusyChange={onBusyChange} />);

    await user.upload(fileInput(), file('lanterns.jpg'));

    expect(
      await screen.findByText(messages.admin.posts.editor.signErrors.MEDIA_UPLOAD_NOT_CONFIGURED),
    ).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('tải hỏng: câu báo, ảnh bìa cũ giữ nguyên', async () => {
    uploadMock.mockRejectedValue(new Error('Cloudinary upload failed (500)'));
    const sign = vi.fn<SignCoverAction>().mockResolvedValue({ ok: true, params: PARAMS });
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness initial={CURRENT} sign={sign} />);

    await user.upload(fileInput(), file('lanterns.jpg'));

    expect(await screen.findByText(c.uploadFailed)).toBeInTheDocument();
    expect(screen.getByTestId('cover')).toHaveTextContent(`${CURRENT.publicId}|Lanterns|UPLOAD|no-meta`);
  });

  it('chọn từ thư viện: ảnh thay ảnh bìa, alt chép từ ảnh gốc, nguồn LIBRARY', async () => {
    const user = userEvent.setup();
    const loadLibrary = vi
      .fn<LoadPhotoLibraryAction>()
      .mockResolvedValue({ ok: true, library: LIBRARY });
    render(<Harness initial={CURRENT} loadLibrary={loadLibrary} />);

    await user.click(screen.getByRole('button', { name: c.library }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Old town at dusk' }));
    await user.click(
      within(dialog).getByRole('button', { name: messages.admin.photoLibrary.add(1) }),
    );

    expect(screen.getByTestId('cover')).toHaveTextContent('lib/a1|Old town at dusk|LIBRARY|no-meta');
  });

  it('gỡ ảnh bìa: tiêu điểm về nút Upload, không rơi về body', async () => {
    const user = userEvent.setup();
    render(<Harness initial={CURRENT} />);

    await user.click(screen.getByRole('button', { name: c.remove }));

    expect(screen.getByTestId('cover')).toHaveTextContent('none');
    expect(screen.getByRole('button', { name: c.upload })).toHaveFocus();
  });

  it('ảnh catalog: nói ngay trên ảnh rằng gỡ ra là không chọn lại được', () => {
    render(<Harness initial={{ ...CURRENT, source: 'CATALOG' }} />);
    expect(screen.getByText(c.catalogueWarning, { exact: false })).toBeInTheDocument();
  });

  it('alt sửa được; lỗi lần lưu trước (PHOTO_NOT_ALLOWED) hiện tại card', async () => {
    const user = userEvent.setup();
    render(<Harness initial={CURRENT} serverError="This cover photo is no longer available." />);

    await user.clear(screen.getByLabelText(c.alt));
    await user.type(screen.getByLabelText(c.alt), 'Paper lanterns');

    expect(screen.getByTestId('cover')).toHaveTextContent('|Paper lanterns|');
    expect(screen.getByRole('alert')).toHaveTextContent('This cover photo is no longer available.');
  });
});
```

  ĐỎ (chưa có component).

- [ ] **B5. Cài card.** Tạo `components/posts/editor/post-cover-card.tsx`:

```tsx
'use client';

import {
  type AdminPhotoLibrary,
  ALLOWED_IMAGE_EXTENSIONS,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { Input } from '@tourism/ui/components/input';
import { Progress } from '@tourism/ui/components/progress';
import { ImagesIcon, UploadIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FormField } from '@/components/kit/form-field';
import { PhotoLibraryDialog } from '@/components/kit/photo-library-dialog';
import { withDeliveryTransform } from '@/lib/cloudinary-url';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';
import { uploadPhoto } from '@/lib/photo-upload';
import {
  coverFileProblem,
  libraryCoverDraft,
  type PostCoverDraft,
  uploadedCoverDraft,
} from '@/lib/post-form';
import { type SignCoverAction, type SignCoverResult, signCoverErrorCopy } from '@/lib/posts-write';

/**
 * Card Cover ở cột phải trang sửa bài (spec P4e-4 §4.4, ADR-0051 §7): một ảnh bìa, tải lên
 * (ký → POST thẳng Cloudinary qua `uploadPhoto` của F18) hoặc chọn từ kho địa danh (hộp
 * thư viện dùng chung). Card không tự giữ ảnh — báo lên trang qua `onChange`.
 *
 * - Đang tải thì báo "bận" lên trang (`onBusyChange`): Save khoá kèm lý do, rời trang bị
 *   hỏi lại — lưu lúc này là lưu thiếu đúng ảnh ấy.
 * - Rời trang giữa lúc tải: huỷ XHR, không đụng state của component đã gỡ.
 * - Gỡ ảnh: tiêu điểm về nút Upload (bài học 10).
 * - Ảnh catalog (bìa của bài seed) gỡ ra là không chọn lại được — nói ngay trên ảnh.
 */
const c = messages.admin.posts.editor.cover;
const ACCEPT = ALLOWED_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(',');

export interface PostCoverCardProps {
  postId: string;
  cover: PostCoverDraft | null;
  altError: string | undefined;
  /** Câu báo `PHOTO_NOT_ALLOWED` của lần lưu vừa rồi — `null` khi không có. */
  serverError: string | null;
  onChange: (cover: PostCoverDraft | null) => void;
  onBusyChange: (busy: boolean) => void;
  sign: SignCoverAction;
  loadLibrary: LoadPhotoLibraryAction;
}

export function PostCoverCard({
  postId,
  cover,
  altError,
  serverError,
  onChange,
  onBusyChange,
  sign,
  loadLibrary,
}: PostCoverCardProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const abort = useRef<AbortController | null>(null);
  /** Phần trăm đã tải; `null` = không có lượt tải nào. */
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<AdminPhotoLibrary | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  function setBusy(next: number | null) {
    setProgress(next);
    onBusyChange(next !== null);
  }

  async function upload(file: File) {
    setProblem(null);
    const issue = coverFileProblem(file);
    if (issue !== null) {
      setProblem(c.skipped[issue](file.name));
      return;
    }
    setBusy(0);
    let signed: SignCoverResult;
    try {
      signed = await sign({ id: postId });
    } catch {
      // Lệnh ký ném (mạng đứt, redeploy) — coi như lỗi chung, như tab Photos.
      signed = { ok: false, code: 'GENERIC' };
    }
    if (!signed.ok) {
      setBusy(null);
      setProblem(signCoverErrorCopy(signed.code));
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    try {
      const uploaded = await uploadPhoto(file, signed.params, setProgress, controller.signal);
      onChange(uploadedCoverDraft(uploaded, signed.params.cloudName));
    } catch {
      if (controller.signal.aborted) return;
      setProblem(c.uploadFailed);
    } finally {
      abort.current = null;
      if (!controller.signal.aborted) setBusy(null);
    }
  }

  const busy = progress !== null;

  return (
    <Card size="sm" id="post-cover">
      <CardHeader>
        <CardTitle>{c.title}</CardTitle>
        <CardDescription>{c.intro}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {cover === null ? (
          <div className="grid aspect-[3/2] place-items-center rounded-md border border-dashed bg-muted text-sm text-muted-foreground">
            {c.empty}
          </div>
        ) : (
          <figure className="grid gap-1.5">
            {/* biome-ignore lint/performance/noImgElement: URL Cloudinary đã tối ưu sẵn (ADR-0005) */}
            <img
              src={withDeliveryTransform(cover.url, 'w_640')}
              alt=""
              className="aspect-[3/2] w-full rounded-md bg-muted object-cover"
            />
            <figcaption className="text-xs text-muted-foreground">
              {cover.source === 'CATALOG'
                ? `${c.source.CATALOG} · ${c.catalogueWarning}`
                : c.source[cover.source]}
            </figcaption>
          </figure>
        )}

        {progress !== null ? (
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">{c.uploading(progress)}</p>
            <Progress aria-label={c.uploading(progress)} value={progress} />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            ref={uploadButton}
            type="button"
            variant="outline"
            size="sm"
            focusableWhenDisabled
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <UploadIcon aria-hidden="true" />
            {c.upload}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            focusableWhenDisabled
            disabled={busy}
            onClick={() => setLibraryOpen(true)}
          >
            <ImagesIcon aria-hidden="true" />
            {c.library}
          </Button>
          {cover !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                onChange(null);
                uploadButton.current?.focus();
              }}
            >
              {c.remove}
            </Button>
          ) : null}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Chọn lại đúng file ấy lần nữa vẫn phải bắn `change`.
            event.target.value = '';
            if (file) void upload(file);
          }}
        />
        <p className="text-xs text-muted-foreground">{c.formats}</p>

        {problem ? (
          <p role="alert" className="text-sm text-destructive-emphasis">
            {problem}
          </p>
        ) : null}
        {serverError ? (
          <p role="alert" className="text-sm text-destructive-emphasis">
            {serverError}
          </p>
        ) : null}

        {cover !== null ? (
          <FormField id="post-cover-alt" label={c.alt} hint={c.altHint} error={altError}>
            {(describedBy) => (
              <Input
                id="post-cover-alt"
                value={cover.alt}
                aria-invalid={altError !== undefined}
                aria-describedby={describedBy}
                onChange={(event) => onChange({ ...cover, alt: event.target.value })}
              />
            )}
          </FormField>
        ) : null}
      </CardContent>

      <PhotoLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        library={library}
        onLoaded={setLibrary}
        load={loadLibrary}
        existing={new Set(cover === null ? [] : [cover.publicId])}
        capacity={1}
        onAdd={(photos) => {
          const [photo] = photos;
          if (photo) onChange(libraryCoverDraft(photo));
          setLibraryOpen(false);
        }}
      />
    </Card>
  );
}
```

  Chạy spec — XANH. Đột biến: bỏ `onBusyChange(next !== null)` (ca đầu phải đỏ); bỏ
  `uploadButton.current?.focus()`; `capacity={1}` thành `0`; bỏ nhánh `CATALOG` của
  figcaption.

- [ ] **B6. Gắn vào trang sửa.** Trong `post-editor.tsx`:
  - import thêm `type LoadPhotoLibraryAction` (`@/lib/photo-library`), `type SignCoverAction`
    (`@/lib/posts-write`), `PostCoverCard` (`./post-cover-card`);
  - `PostEditorProps` thêm `signCover: SignCoverAction;` và `loadLibrary: LoadPhotoLibraryAction;`
    (và nhận chúng ở tham số);
  - thêm state, ngay dưới state `banner`:

```tsx
  /** Ảnh bìa đang tải lên — việc chưa lưu không nằm trong giá trị form (khuôn `busy` của F18). */
  const [uploading, setUploading] = useState(false);
  /**
   * Câu báo của lần lưu vừa rồi nói về MỘT card cụ thể — hiện ngay tại card ấy (spec §4.4),
   * sống cùng phiên bản đã sinh ra nó như dải báo.
   */
  const [cardError, setCardError] = useState<{ code: 'PHOTO_NOT_ALLOWED'; version: string } | null>(
    null,
  );
```

  - đổi `useReportUnsaved(form.dirty);` thành `useReportUnsaved(form.dirty || uploading);`;
  - thêm dưới `shownBanner`:
    `const shownCardError = cardError !== null && cardError.version === version ? cardError.code : null;`
  - trong `save`: thêm `setCardError(null);` ngay sau `setBanner(null);`, và chèn nhánh dưới
    ngay TRƯỚC nhánh `else` cuối (nhánh dải đỏ):

```tsx
    } else if (code === 'PHOTO_NOT_ALLOWED') {
      setCardError({ code, version });
```
  - `aside` của `StepColumns` thành:

```tsx
        aside={
          <>
            <PostPublishCard
              status={values.status}
              publishAt={values.publishAt}
              missing={missing}
              publishAtError={errors.publishAt}
              pending={pending}
              dirty={form.dirty}
              blockedNote={uploading ? t.busyUploading : undefined}
              onStatusChange={(status) =>
                form.setValues((current) => withStatus(current, status, new Date()))
              }
              onPublishAtChange={(publishAt) => patch({ publishAt })}
            />
            <PostCoverCard
              postId={detail.id}
              cover={values.cover}
              altError={errors.coverAlt}
              serverError={
                shownCardError === 'PHOTO_NOT_ALLOWED'
                  ? updatePostErrorCopy('PHOTO_NOT_ALLOWED')
                  : null
              }
              onChange={(cover) => patch({ cover })}
              onBusyChange={setUploading}
              sign={signCover}
              loadLibrary={loadLibrary}
            />
          </>
        }
```

  - trang `page.tsx`: import thêm `loadPostCoverLibraryAction`, `signPostCoverUploadAction` và
    truyền `signCover={signPostCoverUploadAction} loadLibrary={loadPostCoverLibraryAction}`.
  - spec trang sửa: hàm `props()` thêm `signCover: vi.fn<SignCoverAction>(),
    loadLibrary: vi.fn<LoadPhotoLibraryAction>(),` (import kiểu tương ứng), rồi thêm ca:

```tsx
  it('PHOTO_NOT_ALLOWED: câu báo nằm ở card Cover, không ở dải đầu form', async () => {
    const update = vi
      .fn<UpdatePostAction>()
      .mockResolvedValue({ ok: false, code: 'PHOTO_NOT_ALLOWED' });
    const { user } = renderEditor({ update });

    await user.type(screen.getByLabelText(t.fields.title), '!');
    await user.click(saveButton());

    const cover = document.getElementById('post-cover') as HTMLElement;
    expect(await within(cover).findByText(t.errors.PHOTO_NOT_ALLOWED)).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
```

  Chạy hai spec — XANH. Đột biến: bỏ nhánh `PHOTO_NOT_ALLOWED` (câu sang dải đỏ — ca mới
  phải đỏ).
- [ ] **B7.** Quy trình gate, rồi commit:
  `feat(admin): card ảnh bìa — tải lên, chọn từ thư viện, alt`

## Task 11 — Admin: card Tags và card Related tours

**Files:**

- Create: `apps/admin/src/lib/post-pickers.ts` + spec
- Modify: `apps/admin/src/lib/api/posts.ts` (`fetchPostTagOptions`, `fetchPostTourOptions`)
- Create: `apps/admin/src/components/posts/editor/post-tags-card.tsx` + spec
- Create: `apps/admin/src/components/posts/editor/post-tours-card.tsx` + spec
- Modify: `apps/admin/src/components/posts/editor/post-editor.tsx` + spec,
  `apps/admin/src/app/(admin)/posts/[slug]/page.tsx`

**Interfaces:**

- Consumes: `normalizePostTags`, `foldAccents`, `slugifyVietnamese`, các hằng `POST_*`
  (contract); `PostTourOption`, `PostTourDraft` (Task 8); `ListEditor` (kit).
- Produces: `AddTagResult`, `addTag(tags, raw)`, `TAG_SUGGESTIONS_MAX`,
  `tagSuggestions(all, current, query)`, `TOUR_MATCHES_MAX`,
  `tourMatches(options, selected, query)`, `addTour(selected, tour)`;
  `fetchPostTagOptions(cookie)`, `fetchPostTourOptions(cookie)`; `PostTagsCard`,
  `PostToursCard`; prop mới của `PostEditor`: `tagOptions: AdminPostTag[]`,
  `tourOptions: PostTourOption[]`.

- [ ] **B1. Test trước — phần thuần.** Tạo `lib/post-pickers.spec.ts`:

```ts
import type { AdminPostTag } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import type { PostTourDraft, PostTourOption } from './post-form';
import {
  addTag,
  addTour,
  TAG_SUGGESTIONS_MAX,
  tagSuggestions,
  tourMatches,
} from './post-pickers';

describe('addTag', () => {
  it('thêm tên đã trim vào cuối', () => {
    expect(addTag(['Food'], '  Hội An ')).toEqual({ ok: true, tags: ['Food', 'Hội An'] });
  });

  it('trùng THEO SLUG là trùng — "Hoi An" đụng "Hội An"', () => {
    expect(addTag(['Hội An'], 'Hoi An')).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('rỗng, chỉ ký hiệu, quá dài', () => {
    expect(addTag([], '   ')).toEqual({ ok: false, reason: 'empty' });
    expect(addTag([], '!!!')).toEqual({ ok: false, reason: 'invalid' });
    expect(addTag([], 'x'.repeat(61))).toEqual({ ok: false, reason: 'tooLong' });
  });

  it('đủ 5 thì không thêm nữa; gõ lại tag đã có vẫn nói là trùng', () => {
    const five = ['A1', 'B2', 'C3', 'D4', 'E5'];
    expect(addTag(five, 'F6')).toEqual({ ok: false, reason: 'full' });
    expect(addTag(five, 'a1')).toEqual({ ok: false, reason: 'duplicate' });
  });
});

describe('tagSuggestions', () => {
  const ALL: AdminPostTag[] = [
    { slug: 'hoi-an', name: 'Hội An', count: 3 },
    { slug: 'food', name: 'Food', count: 5 },
    { slug: 'hue', name: 'Huế', count: 1 },
    { slug: 'markets', name: 'Markets', count: 5 },
  ];

  it('ô trống: tag dùng nhiều trước, cùng số thì theo tên; bỏ tag bài đã có', () => {
    expect(tagSuggestions(ALL, ['Food'], '').map((tag) => tag.name)).toEqual([
      'Markets',
      'Hội An',
      'Huế',
    ]);
  });

  it('gõ không dấu vẫn khớp tên có dấu, không phân biệt hoa thường', () => {
    expect(tagSuggestions(ALL, [], 'HU').map((tag) => tag.name)).toEqual(['Huế']);
    expect(tagSuggestions(ALL, [], 'hoi').map((tag) => tag.name)).toEqual(['Hội An']);
  });

  it(`tối đa ${TAG_SUGGESTIONS_MAX} gợi ý`, () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ slug: `t${i}`, name: `Tag ${i}`, count: 1 }));
    expect(tagSuggestions(many, [], '')).toHaveLength(TAG_SUGGESTIONS_MAX);
  });
});

describe('tourMatches / addTour', () => {
  const FOOD: PostTourOption = { id: 'a', slug: 'hoi-an-food-walk', title: 'Hội An Food Walk', isPublished: true };
  const MY_SON: PostTourOption = { id: 'b', slug: 'my-son-sunrise', title: 'Mỹ Sơn Sunrise', isPublished: false };
  const HUE: PostTourOption = { id: 'c', slug: 'hue-citadel', title: 'Huế Citadel', isPublished: true };
  const OPTIONS = [FOOD, MY_SON, HUE];
  const draft = (option: PostTourOption): PostTourDraft => ({ key: option.id, ...option });

  it('ô trống thì không gợi ý; gõ không dấu khớp tiêu đề có dấu; bỏ tour đã chọn', () => {
    expect(tourMatches(OPTIONS, [], '  ')).toEqual([]);
    expect(tourMatches(OPTIONS, [], 'my son').map((tour) => tour.id)).toEqual(['b']);
    expect(tourMatches(OPTIONS, [draft(FOOD)], 'h').map((tour) => tour.id)).toEqual(['c']);
  });

  it('thêm vào cuối kèm key; đã có hay đã đủ 3 thì giữ nguyên', () => {
    expect(addTour([draft(FOOD)], HUE).map((tour) => tour.id)).toEqual(['a', 'c']);
    expect(addTour([draft(FOOD)], FOOD).map((tour) => tour.id)).toEqual(['a']);
    expect(addTour([draft(FOOD), draft(MY_SON), draft(HUE)], { ...HUE, id: 'd' })).toHaveLength(3);
  });
});
```

  ĐỎ, rồi tạo `lib/post-pickers.ts`:

```ts
import {
  type AdminPostTag,
  foldAccents,
  normalizePostTags,
  POST_RELATED_TOURS_MAX,
  POST_TAG_NAME_MAX,
  POST_TAGS_MAX,
  slugifyVietnamese,
} from '@tourism/contract';
import type { PostTourDraft, PostTourOption } from './post-form';

/**
 * Logic THUẦN của hai card chọn ở cột phải trang sửa bài (spec P4e-4 §4.4): thêm tag, gợi ý
 * tag, lọc tour. Ô nhập kèm danh sách nút, không Combobox nổi (Quyết định 13). So chữ bằng
 * `foldAccents` của contract — gõ "hoi an" khớp "Hội An".
 */

export type AddTagResult =
  | { ok: true; tags: string[] }
  | { ok: false; reason: 'empty' | 'invalid' | 'tooLong' | 'duplicate' | 'full' };

/** Thêm một tag theo luật của contract (spec §2.5): trim, trùng THEO SLUG là trùng, tối đa 5. */
export function addTag(tags: readonly string[], raw: string): AddTagResult {
  const name = raw.trim();
  if (name === '') return { ok: false, reason: 'empty' };
  if (name.length > POST_TAG_NAME_MAX) return { ok: false, reason: 'tooLong' };
  const slug = slugifyVietnamese(name, POST_TAG_NAME_MAX);
  if (slug === '') return { ok: false, reason: 'invalid' };
  // Trùng xét TRƯỚC trần: gõ lại một tag đã có thì "đã có" đúng hơn "đã đủ".
  if (normalizePostTags(tags).some((tag) => tag.slug === slug)) {
    return { ok: false, reason: 'duplicate' };
  }
  if (tags.length >= POST_TAGS_MAX) return { ok: false, reason: 'full' };
  return { ok: true, tags: [...tags, name] };
}

/** Số gợi ý tối đa dưới ô Tags. */
export const TAG_SUGGESTIONS_MAX = 8;

/**
 * Gợi ý tag: tag đã có (chưa gắn bài này) mà tên chứa chữ đang gõ; ô trống thì gợi ý tag
 * dùng nhiều nhất. Dùng nhiều trước, cùng số thì theo tên — gợi ý dùng lại tag cũ để không
 * mọc ra "Food" và "Foods" song song.
 */
export function tagSuggestions(
  all: readonly AdminPostTag[],
  current: readonly string[],
  query: string,
): AdminPostTag[] {
  const taken = new Set(normalizePostTags(current).map((tag) => tag.slug));
  const needle = foldAccents(query.trim());
  return all
    .filter((tag) => !taken.has(tag.slug) && foldAccents(tag.name).includes(needle))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, TAG_SUGGESTIONS_MAX);
}

/** Số tour tối đa dưới ô tìm tour. */
export const TOUR_MATCHES_MAX = 5;

/** Tour khớp chữ đang gõ, chưa có trong bài; ô trống thì không gợi ý gì. */
export function tourMatches(
  options: readonly PostTourOption[],
  selected: readonly PostTourDraft[],
  query: string,
): PostTourOption[] {
  const needle = foldAccents(query.trim());
  if (needle === '') return [];
  const taken = new Set(selected.map((tour) => tour.id));
  return options
    .filter((tour) => !taken.has(tour.id) && foldAccents(tour.title).includes(needle))
    .slice(0, TOUR_MATCHES_MAX);
}

/** Thêm một tour vào CUỐI (thứ tự là thứ tự web hiện); đã có hay đã đủ thì giữ nguyên. */
export function addTour(selected: readonly PostTourDraft[], tour: PostTourOption): PostTourDraft[] {
  if (selected.length >= POST_RELATED_TOURS_MAX || selected.some((item) => item.id === tour.id)) {
    return [...selected];
  }
  return [...selected, { key: tour.id, ...tour }];
}
```

  XANH. Đột biến: bỏ `foldAccents` ở `tagSuggestions` (ca "HU" phải đỏ); đảo thứ tự kiểm
  trùng và trần (ca "a1" phải đỏ); `addTour` thêm vào ĐẦU.

- [ ] **B2. Hai đường đọc.** `lib/api/posts.ts` (import thêm `type AdminPostTag`;
  `type PostTourOption` từ `@/lib/post-form`):

```ts
/**
 * Gợi ý của ô Tags — hỏng thì RỖNG: mất gợi ý là phiền, mất trang sửa là hỏng việc. Không
 * có gợi ý thì admin vẫn gõ được tag mới.
 */
export async function fetchPostTagOptions(cookie: string): Promise<AdminPostTag[]> {
  return api.admin.posts
    .tags(undefined, { context: withAdminAuth(cookie) })
    .catch(() => [] as AdminPostTag[]);
}

/** Trang 100 dòng (trần `limit` của contract), tối đa 10 trang = 1000 tour. */
const TOUR_OPTION_PAGE_SIZE = 100;
const TOUR_OPTION_PAGES_MAX = 10;

/**
 * MỌI tour, cả tắt bán, cho ô chọn tour liên quan (Quyết định 1): danh sách tour của admin
 * không có ô tìm, nên nạp một lần rồi lọc ở trình duyệt — 29 tour là một lượt gọi. Bỏ trùng
 * theo id (phân trang offset trôi khi có tour mới chen vào).
 *
 * KHÔNG nuốt lỗi — cùng luật `fetchTourEditorOptions`: trang sửa thiếu danh sách thì trang
 * lỗi của app, không phải một ô chọn lặng lẽ rỗng.
 */
export async function fetchPostTourOptions(cookie: string): Promise<PostTourOption[]> {
  const context = { context: withAdminAuth(cookie) };
  const options = new Map<string, PostTourOption>();
  for (let page = 1; page <= TOUR_OPTION_PAGES_MAX; page += 1) {
    const result = await api.admin.tours.list({ page, limit: TOUR_OPTION_PAGE_SIZE }, context);
    for (const row of result.items) {
      options.set(row.id, {
        id: row.id,
        slug: row.slug,
        title: row.title,
        isPublished: row.isPublished,
      });
    }
    if (page >= result.totalPages) break;
  }
  return [...options.values()];
}
```

- [ ] **B3. Test trước — card Tags.** Tạo `components/posts/editor/post-tags-card.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminPostTag } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PostTagsCard } from './post-tags-card';

/** Card Tags (spec P4e-4 §4.4): gõ thẳng, Enter để thêm, gợi ý từ tag sẵn có, tối đa 5. */
const g = messages.admin.posts.editor.tags;

function Harness({ initial, options = [] }: { initial: string[]; options?: AdminPostTag[] }) {
  const [tags, setTags] = useState(initial);
  return (
    <>
      <PostTagsCard tags={tags} options={options} onChange={setTags} />
      <output data-testid="tags">{tags.join('|')}</output>
    </>
  );
}

const input = () => screen.getByLabelText(g.inputLabel);

describe('PostTagsCard', () => {
  it('Enter thêm tag mới; ô nhập trống lại và giữ tiêu điểm', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Food']} />);

    await user.type(input(), 'Street food{Enter}');

    expect(screen.getByTestId('tags')).toHaveTextContent('Food|Street food');
    expect(input()).toHaveValue('');
    expect(input()).toHaveFocus();
  });

  it('gợi ý tag sẵn có chưa gắn bài này; bấm gợi ý thì thêm', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={['Food']}
        options={[
          { slug: 'food', name: 'Food', count: 5 },
          { slug: 'hoi-an', name: 'Hội An', count: 2 },
        ]}
      />,
    );

    expect(screen.queryByRole('button', { name: g.useSuggestion('Food') })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: g.useSuggestion('Hội An') }));

    expect(screen.getByTestId('tags')).toHaveTextContent('Food|Hội An');
  });

  it('trùng theo slug: báo ngay dưới ô, không thêm', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Hội An']} />);

    await user.type(input(), 'hoi an{Enter}');

    expect(await screen.findByText(g.duplicate('hoi an'))).toBeInTheDocument();
    expect(screen.getByTestId('tags')).toHaveTextContent('Hội An');
  });

  it('đủ 5: thêm nữa thì báo trần; gợi ý ẩn', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={['A1', 'B2', 'C3', 'D4', 'E5']}
        options={[{ slug: 'food', name: 'Food', count: 5 }]}
      />,
    );

    expect(screen.queryByRole('button', { name: g.useSuggestion('Food') })).not.toBeInTheDocument();
    await user.type(input(), 'F6{Enter}');

    expect(await screen.findByText(g.full(5))).toBeInTheDocument();
  });

  it('gỡ tag: tiêu điểm về ô nhập, không rơi về body', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Food']} />);

    await user.click(screen.getByRole('button', { name: g.remove('Food') }));

    expect(screen.getByTestId('tags')).toHaveTextContent('');
    expect(input()).toHaveFocus();
  });
});
```

  ĐỎ, rồi tạo `components/posts/editor/post-tags-card.tsx`:

```tsx
'use client';

import { type AdminPostTag, POST_TAG_NAME_MAX, POST_TAGS_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@tourism/ui/components/card';
import { Input } from '@tourism/ui/components/input';
import { XIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { FormField } from '@/components/kit/form-field';
import { type AddTagResult, addTag, tagSuggestions } from '@/lib/post-pickers';

/**
 * Card Tags (spec P4e-4 §4.4, ADR-0051 §5): tag gõ thẳng, Enter để thêm; tag chưa có được
 * tạo lúc LƯU (phía API). Gợi ý là nút bấm, không Combobox nổi (Quyết định 13).
 *
 * Ô nhập KHÔNG bao giờ bị khoá, kể cả khi đủ 5 — khoá ô đang có tiêu điểm là đẩy tiêu điểm
 * về `<body>`; thay vào đó lần thêm thứ sáu nói rõ trần (bài học 10).
 */
const g = messages.admin.posts.editor.tags;

function problemCopy(reason: Exclude<AddTagResult, { ok: true }>['reason'], name: string): string | null {
  switch (reason) {
    case 'empty':
      return null;
    case 'invalid':
      return g.invalid;
    case 'tooLong':
      return g.tooLong(POST_TAG_NAME_MAX);
    case 'duplicate':
      return g.duplicate(name.trim());
    case 'full':
      return g.full(POST_TAGS_MAX);
  }
}

export function PostTagsCard({
  tags,
  options,
  onChange,
}: {
  tags: string[];
  /** Mọi tag sẵn có kèm số bài (`admin.posts.tags`); hỏng thì rỗng. */
  options: readonly AdminPostTag[];
  onChange: (tags: string[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const suggestions = tags.length >= POST_TAGS_MAX ? [] : tagSuggestions(options, tags, draft);

  function add(name: string) {
    const result = addTag(tags, name);
    if (!result.ok) {
      setProblem(problemCopy(result.reason, name));
      return;
    }
    onChange(result.tags);
    setDraft('');
    setProblem(null);
    input.current?.focus();
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{g.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((name, index) => (
              <li key={name}>
                <Badge variant="secondary" className="gap-1 pr-1">
                  {name}
                  <button
                    type="button"
                    aria-label={g.remove(name)}
                    className="rounded-sm p-0.5 hover:bg-muted"
                    onClick={() => {
                      onChange(tags.filter((_, other) => other !== index));
                      input.current?.focus();
                    }}
                  >
                    <XIcon className="size-3" aria-hidden="true" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}

        <FormField
          id="post-tag-input"
          label={g.inputLabel}
          hint={g.hint(POST_TAGS_MAX)}
          error={problem ?? undefined}
        >
          {(describedBy) => (
            <div className="flex gap-2">
              <Input
                ref={input}
                id="post-tag-input"
                value={draft}
                aria-describedby={describedBy}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setProblem(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  add(draft);
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => add(draft)}>
                {g.add}
              </Button>
            </div>
          )}
        </FormField>

        {suggestions.length > 0 ? (
          <div className="grid gap-1.5">
            <p className="text-xs text-muted-foreground">{g.suggestions}</p>
            <ul className="flex flex-wrap gap-1.5">
              {suggestions.map((tag) => (
                <li key={tag.slug}>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    aria-label={g.useSuggestion(tag.name)}
                    onClick={() => add(tag.name)}
                  >
                    {tag.name}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

  XANH. Đột biến: bỏ `input.current?.focus()` ở nút gỡ; bỏ `event.preventDefault()` (không ca
  nào ở đây đỏ vì card nằm ngoài `<form>` — ghi lại); gợi ý không ẩn khi đủ 5.

- [ ] **B4. Test trước — card Related tours.** Tạo
  `components/posts/editor/post-tours-card.spec.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { PostTourDraft, PostTourOption } from '@/lib/post-form';
import { TOUR_A, TOUR_B } from '@/test/post-detail';
import { PostToursCard } from './post-tours-card';

/** Card Related tours (spec P4e-4 §4.4): tối đa 3, có thứ tự, thêm bằng ô tìm. */
const r = messages.admin.posts.editor.tours;
const l = messages.admin.listEditor;

const HUE: PostTourOption = {
  id: '7a1b2c3d-0000-4000-8000-0000000000e3',
  slug: 'hue-citadel',
  title: 'Hue Citadel',
  isPublished: true,
};
const OPTIONS: PostTourOption[] = [TOUR_A, TOUR_B, HUE];

function Harness({
  initial,
  serverError = null,
}: {
  initial: PostTourOption[];
  serverError?: string | null;
}) {
  const [tours, setTours] = useState<PostTourDraft[]>(
    initial.map((tour) => ({ key: tour.id, ...tour })),
  );
  return (
    <>
      <PostToursCard tours={tours} options={OPTIONS} serverError={serverError} onChange={setTours} />
      <output data-testid="tours">{tours.map((tour) => tour.slug).join('|')}</output>
    </>
  );
}

const search = () => screen.getByLabelText(r.searchLabel);

describe('PostToursCard', () => {
  it('gõ tìm: bấm một tour thì thêm vào cuối, ô tìm trống lại và giữ tiêu điểm', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[TOUR_A]} />);

    await user.type(search(), 'hue');
    await user.click(screen.getByRole('button', { name: r.add('Hue Citadel') }));

    expect(screen.getByTestId('tours')).toHaveTextContent('hoi-an-food-walk|hue-citadel');
    expect(search()).toHaveValue('');
    expect(search()).toHaveFocus();
  });

  it('không khớp tour nào: nói ra', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} />);

    await user.type(search(), 'zzz');

    expect(screen.getByText(r.noMatch)).toBeInTheDocument();
  });

  it('tour đang tắt bán: nhãn Off sale và câu nhắc web không hiện nó', () => {
    render(<Harness initial={[TOUR_B]} />);
    expect(screen.getByText(r.offSale)).toBeInTheDocument();
    expect(screen.getByText(r.offSaleNote)).toBeInTheDocument();
  });

  it('đủ 3: ô tìm chỉ còn đọc và nói trần, không gợi ý thêm', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[TOUR_A, TOUR_B, HUE]} />);

    expect(search()).toHaveAttribute('readonly');
    expect(screen.getByText(r.full(3))).toBeInTheDocument();
    await user.type(search(), 'h');
    expect(screen.queryByRole('button', { name: r.add('Hue Citadel') })).not.toBeInTheDocument();
  });

  it('xuống một bậc đổi thứ tự — thứ tự là thứ tự web hiện', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[TOUR_A, TOUR_B]} />);

    await user.click(screen.getByRole('button', { name: l.moveDown(r.itemName(1)) }));

    expect(screen.getByTestId('tours')).toHaveTextContent('my-son-sunrise|hoi-an-food-walk');
  });

  it('gỡ dòng cuối cùng: tiêu điểm về ô tìm, không rơi về body', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[TOUR_A]} />);

    await user.click(screen.getByRole('button', { name: l.remove(r.itemName(1)) }));

    expect(screen.getByTestId('tours')).toHaveTextContent('');
    await waitFor(() => expect(search()).toHaveFocus());
  });

  it('lỗi lần lưu trước (RELATED_TOUR_NOT_FOUND) hiện tại card', () => {
    render(<Harness initial={[TOUR_A]} serverError="A tour you picked no longer exists." />);
    expect(screen.getByRole('alert')).toHaveTextContent('A tour you picked no longer exists.');
  });
});
```

  ĐỎ, rồi tạo `components/posts/editor/post-tours-card.tsx`:

```tsx
'use client';

import { POST_RELATED_TOURS_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { Input } from '@tourism/ui/components/input';
import { PlusIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { FormField } from '@/components/kit/form-field';
import { ListEditor } from '@/components/kit/list-editor';
import type { PostTourDraft, PostTourOption } from '@/lib/post-form';
import { addTour, tourMatches } from '@/lib/post-pickers';

/**
 * Card Related tours (spec P4e-4 §4.4, ADR-0051 §5): tối đa 3, có thứ tự (lên/xuống/gỡ của
 * kit `ListEditor`), thêm bằng ô tìm theo tiêu đề. Tour đang tắt bán vẫn chọn được, mang
 * nhãn Off sale — web chỉ hiện tour đang bán.
 *
 * Đủ 3 thì ô tìm chỉ còn ĐỌC chứ không biến mất hay bị khoá: thêm tour thứ ba xong tiêu
 * điểm còn đứng ở ô ấy (bài học 10). Gỡ dòng cuối thì tiêu điểm về ô tìm (`emptyFocus`).
 */
const r = messages.admin.posts.editor.tours;

export function PostToursCard({
  tours,
  options,
  serverError,
  onChange,
}: {
  tours: PostTourDraft[];
  /** Mọi tour (cả tắt bán) — `fetchPostTourOptions` nạp một lần ở server. */
  options: readonly PostTourOption[];
  /** Câu báo `RELATED_TOUR_NOT_FOUND` của lần lưu vừa rồi — `null` khi không có. */
  serverError: string | null;
  onChange: (tours: PostTourDraft[]) => void;
}) {
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const full = tours.length >= POST_RELATED_TOURS_MAX;
  const matches = full ? [] : tourMatches(options, tours, query);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{r.title}</CardTitle>
        <CardDescription>{r.intro}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ListEditor
          items={tours}
          onChange={onChange}
          max={POST_RELATED_TOURS_MAX}
          itemName={(index) => r.itemName(index + 1)}
          empty={r.empty}
          emptyFocus={search}
          renderItem={(tour) => (
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm">{tour.title}</span>
              {tour.isPublished ? null : <Badge variant="outline">{r.offSale}</Badge>}
            </div>
          )}
        />
        {tours.some((tour) => !tour.isPublished) ? (
          <p className="text-xs text-muted-foreground">{r.offSaleNote}</p>
        ) : null}
        {serverError ? (
          <p role="alert" className="text-sm text-destructive-emphasis">
            {serverError}
          </p>
        ) : null}

        <FormField
          id="post-tour-search"
          label={r.searchLabel}
          hint={full ? r.full(POST_RELATED_TOURS_MAX) : undefined}
        >
          {(describedBy) => (
            <Input
              ref={search}
              id="post-tour-search"
              type="search"
              placeholder={r.searchPlaceholder}
              readOnly={full}
              value={query}
              aria-describedby={describedBy}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
        </FormField>
        {query.trim() !== '' && !full ? (
          matches.length === 0 ? (
            <p className="text-xs text-muted-foreground">{r.noMatch}</p>
          ) : (
            <ul className="grid gap-1">
              {matches.map((tour) => (
                <li key={tour.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    aria-label={r.add(tour.title)}
                    onClick={() => {
                      onChange(addTour(tours, tour));
                      setQuery('');
                      search.current?.focus();
                    }}
                  >
                    <PlusIcon aria-hidden="true" />
                    <span className="truncate">{tour.title}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
```

  XANH. Đột biến: bỏ `emptyFocus` (ca gỡ dòng cuối phải đỏ); `readOnly={full}` thành
  `disabled={full}` (ca đủ 3 phải đỏ); `addTour` thay bằng thêm vào đầu.

- [ ] **B5. Gắn vào trang sửa.** Trong `post-editor.tsx`:
  - import `type AdminPostTag` (contract), `type PostTourOption` (`@/lib/post-form`),
    `PostTagsCard`, `PostToursCard`;
  - `PostEditorProps` thêm `tagOptions: AdminPostTag[];` và `tourOptions: PostTourOption[];`;
  - kiểu `code` của `cardError` thành `'PHOTO_NOT_ALLOWED' | 'RELATED_TOUR_NOT_FOUND'`, nhánh
    trong `save` thành
    `} else if (code === 'PHOTO_NOT_ALLOWED' || code === 'RELATED_TOUR_NOT_FOUND') {`;
  - thêm hai card cuối `aside`, sau `PostCoverCard`:

```tsx
            <PostTagsCard
              tags={values.tags}
              options={tagOptions}
              onChange={(tags) => patch({ tags })}
            />
            <PostToursCard
              tours={values.relatedTours}
              options={tourOptions}
              serverError={
                shownCardError === 'RELATED_TOUR_NOT_FOUND'
                  ? updatePostErrorCopy('RELATED_TOUR_NOT_FOUND')
                  : null
              }
              onChange={(relatedTours) => patch({ relatedTours })}
            />
```

  - `page.tsx`: import `fetchPostTagOptions`, `fetchPostTourOptions`; nạp cùng lúc:
    `const [session, post, tagOptions, tourOptions] = await Promise.all([getServerSession(), fetchAdminPost(cookie, slug), fetchPostTagOptions(cookie), fetchPostTourOptions(cookie)]);`
    và truyền `tagOptions={tagOptions} tourOptions={tourOptions}`.
  - spec trang sửa: thêm `TOUR_B` vào import từ `@/test/post-detail`; `props()` thêm
    `tagOptions: [], tourOptions: [TOUR_A, TOUR_B],`, rồi thêm:

```tsx
  it('RELATED_TOUR_NOT_FOUND: câu báo nằm ở card Related tours', async () => {
    const update = vi
      .fn<UpdatePostAction>()
      .mockResolvedValue({ ok: false, code: 'RELATED_TOUR_NOT_FOUND' });
    const { user } = renderEditor({ update });

    await user.type(screen.getByLabelText(t.fields.title), '!');
    await user.click(saveButton());

    const card = screen.getByText(t.tours.title).closest('[data-slot="card"]') as HTMLElement;
    expect(await within(card).findByText(t.errors.RELATED_TOUR_NOT_FOUND)).toBeInTheDocument();
  });

  it('thêm tag và tour rồi lưu: payload mang đúng thứ tự đã soạn', async () => {
    const update = vi.fn<UpdatePostAction>().mockResolvedValue({ ok: true, detail: postDetailFixture() });
    const { user } = renderEditor({ update });

    await user.type(screen.getByLabelText(t.tags.inputLabel), 'Street food{Enter}');
    await user.type(screen.getByLabelText(t.tours.searchLabel), 'my son');
    await user.click(screen.getByRole('button', { name: t.tours.add(TOUR_B.title) }));
    await user.click(saveButton());

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      tags: ['Food', 'Street food'],
      relatedTourIds: [TOUR_A.id, TOUR_B.id],
    });
  });
```

  Chạy spec — XANH.
- [ ] **B6.** Quy trình gate, rồi commit:
  `feat(admin): card tag và card tour liên quan của bài viết`

## Task 12 — Admin: vùng xoá bài

**Files:**

- Modify: `apps/admin/src/lib/posts-write.ts` + spec (codec xoá)
- Modify: `apps/admin/src/lib/api/posts.ts` (`deleteAdminPost`)
- Modify: `apps/admin/src/app/(admin)/posts/[slug]/actions.ts`, `page.tsx`
- Create: `apps/admin/src/components/posts/editor/delete-post-zone.tsx` + spec
- Modify: `apps/admin/src/components/posts/editor/post-editor.tsx` + spec

**Interfaces:**

- Produces: `DeletePostContractCode`, `DELETE_POST_CONTRACT_CODES`, `classifyDeletePostError`,
  `deletePostErrorCopy`, `isDeletePostStale`, `DeletePostResult`, `DeletePostAction`;
  `deleteAdminPost`; `deletePostAction`; `DeletePostZone({ detail, version, remove })`; prop
  mới của `PostEditor`: `remove: DeletePostAction`.

- [ ] **B1. Codec xoá.** `lib/posts-write.spec.ts` thêm `DELETE_POST_CONTRACT_CODES`,
  `isDeletePostStale` vào import và:

```ts
  it('xoá bài phủ ĐÚNG các mã `admin.posts.delete` khai', () => {
    expect([...DELETE_POST_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.posts.delete['~orpc'].errorMap),
    );
  });

  it('xoá: cả hai mã đều là trạng-thái-cũ; lỗi vận chuyển thì không', () => {
    expect(isDeletePostStale('STALE_POST')).toBe(true);
    expect(isDeletePostStale('NOT_FOUND')).toBe(true);
    expect(isDeletePostStale('GENERIC')).toBe(false);
  });
```

  ĐỎ, rồi trong `lib/posts-write.ts` (import thêm `type AdminPostDeleteInput`,
  `type AdminPostDeleteResult`):

```ts
/**
 * Xoá đi qua `ConfirmWriteDialog`: cả hai mã là trạng-thái-cũ — thế giới đã đổi dưới chân
 * hộp (người khác vừa lưu, hay vừa xoá). Kit đóng hộp, toast, rồi để vùng xoá quyết refresh
 * hay về danh sách.
 */
const deleteCodec = createWriteErrorCodec(t.delete.errors, { stale: ['STALE_POST', 'NOT_FOUND'] });

export type DeletePostContractCode = keyof typeof t.delete.errors;
export const DELETE_POST_CONTRACT_CODES = deleteCodec.codes;
export const classifyDeletePostError = deleteCodec.classify;
export const deletePostErrorCopy = deleteCodec.copy;
export const isDeletePostStale = deleteCodec.isStale;

export type DeletePostResult =
  | { ok: true; deleted: AdminPostDeleteResult }
  | { ok: false; code: DeletePostContractCode | TransportFailureCode };

export type DeletePostAction = (input: AdminPostDeleteInput) => Promise<DeletePostResult>;
```

  XANH.

- [ ] **B2. Đường API và action.** `lib/api/posts.ts`:

```ts
export async function deleteAdminPost(
  cookie: string,
  input: AdminPostDeleteInput,
): Promise<AdminPostDeleteResult> {
  return api.admin.posts.delete(input, { context: withAdminAuth(cookie) });
}
```

  `app/(admin)/posts/[slug]/actions.ts`:

```ts
/** Xoá bài — mang phiên bản form đang cầm (ADR-0051 §2): người khác vừa lưu thì `STALE_POST`. */
export async function deletePostAction(input: AdminPostDeleteInput): Promise<DeletePostResult> {
  const parsed = AdminPostDeleteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let deleted: AdminPostDeleteResult;
  try {
    deleted = await deleteAdminPost(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyDeletePostError(error) };
  }
  return { ok: true, deleted };
}
```

  (import thêm `type AdminPostDeleteInput`, `AdminPostDeleteInputSchema`,
  `type AdminPostDeleteResult`, `deleteAdminPost`, `classifyDeletePostError`,
  `type DeletePostResult`.)

- [ ] **B3. Test trước — vùng xoá.** Tạo `components/posts/editor/delete-post-zone.spec.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeletePostAction } from '@/lib/posts-write';
import { POST_ID, postDetailFixture } from '@/test/post-detail';
import { DeletePostZone } from './delete-post-zone';

/** Vùng xoá bài (spec P4e-4 §2.7, §4.6): hộp xác nhận nói đúng hệ quả, mang phiên bản form. */
const d = messages.admin.posts.delete;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href), refresh: () => refresh() }),
}));

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  push.mockReset();
  refresh.mockReset();
});

/** Phiên bản form đang cầm — KHÁC `version` của fixture, để bắt vùng xoá đọc nhầm nguồn. */
const FORM_VERSION = '2026-10-02T10:20:00.000Z';

async function openDialog(remove: DeletePostAction) {
  const user = userEvent.setup();
  render(<DeletePostZone detail={postDetailFixture()} version={FORM_VERSION} remove={remove} />);
  await user.click(screen.getByRole('button', { name: d.action }));
  const dialog = await screen.findByRole('dialog', { name: d.dialog.title });
  return { user, dialog };
}

describe('DeletePostZone', () => {
  it('hộp nói đúng hệ quả; xoá xong: gửi id và phiên bản form đang cầm, toast, về /posts', async () => {
    const remove = vi
      .fn<DeletePostAction>()
      .mockResolvedValue({ ok: true, deleted: { slug: 'eating-your-way-through-hoi-an' } });
    const { user, dialog } = await openDialog(remove);

    expect(within(dialog).getByText(d.dialog.body)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: d.dialog.submit }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/posts'));
    expect(remove).toHaveBeenCalledWith({ id: POST_ID, version: FORM_VERSION });
    expect(success).toHaveBeenCalledWith(d.toast.title, {
      description: d.toast.body('Eating your way through Hội An'),
    });
  });

  it('STALE_POST: đóng hộp, toast, ở lại trang và làm mới', async () => {
    const remove = vi.fn<DeletePostAction>().mockResolvedValue({ ok: false, code: 'STALE_POST' });
    const { user, dialog } = await openDialog(remove);

    await user.click(within(dialog).getByRole('button', { name: d.dialog.submit }));

    await waitFor(() => expect(errorToast).toHaveBeenCalledWith(d.errors.STALE_POST));
    expect(refresh).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('NOT_FOUND (người khác đã xoá trước): đóng hộp, toast, về /posts', async () => {
    const remove = vi.fn<DeletePostAction>().mockResolvedValue({ ok: false, code: 'NOT_FOUND' });
    const { user, dialog } = await openDialog(remove);

    await user.click(within(dialog).getByRole('button', { name: d.dialog.submit }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/posts'));
    expect(errorToast).toHaveBeenCalledWith(d.errors.NOT_FOUND);
  });

  it('Cancel: không gửi lệnh', async () => {
    const remove = vi.fn<DeletePostAction>();
    const { user, dialog } = await openDialog(remove);

    await user.click(within(dialog).getByRole('button', { name: d.dialog.cancel }));

    expect(remove).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
```

  ĐỎ, rồi tạo `components/posts/editor/delete-post-zone.tsx`:

```tsx
'use client';

import type { AdminPostDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import { POSTS_LIST_HREF, postStatusLabel } from '@/lib/posts-view';
import {
  type DeletePostAction,
  type DeletePostContractCode,
  deletePostErrorCopy,
  isDeletePostStale,
} from '@/lib/posts-write';

/**
 * Vùng xoá bài ở cuối cột trái trang sửa (spec P4e-4 §2.7, §4.6). Xoá được mọi bài, qua kit
 * `ConfirmWriteDialog` giọng đỏ; câu thân hộp kể đúng từng thứ mất theo (đo trên
 * `admin-posts.service.ts` và `schema.prisma` — xem JSDoc của copy).
 *
 * Nằm NGOÀI `<form>` của trang (Quyết định 14). Lệnh mang phiên bản form ĐANG cầm: người
 * khác vừa lưu thì `STALE_POST` — ở lại và làm mới; bài đã rời DB (xoá xong, hay người khác
 * xoá trước) thì về danh sách.
 */
const t = messages.admin.posts.delete;

export function DeletePostZone({
  detail,
  version,
  remove,
}: {
  detail: AdminPostDetail;
  /** Phiên bản form đang cầm — không phải `detail.version` của lần đọc đầu. */
  version: string;
  remove: DeletePostAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /** Bài đã rời DB — về danh sách thay vì làm mới một trang sẽ 404. */
  const leave = useRef(false);

  return (
    <section
      aria-labelledby="post-delete-title"
      className="grid gap-3 rounded-lg border border-destructive/40 p-4"
    >
      <div className="grid gap-1">
        <h3 id="post-delete-title" className="text-base font-semibold">
          {t.title}
        </h3>
        <p className="text-sm text-muted-foreground">{t.body}</p>
      </div>
      <div>
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          {t.action}
        </Button>
      </div>

      {open ? (
        <ConfirmWriteDialog<DeletePostContractCode>
          copy={{
            title: t.dialog.title,
            body: t.dialog.body,
            warning: t.dialog.warning,
            submit: t.dialog.submit,
            submitting: t.dialog.submitting,
            cancel: t.dialog.cancel,
          }}
          rows={[
            { label: t.rows.post, value: detail.title },
            { label: t.rows.status, value: postStatusLabel(detail.displayStatus) },
          ]}
          submitVariant="destructive"
          warningTone="destructive"
          isStale={isDeletePostStale}
          errorCopy={deletePostErrorCopy}
          onSubmit={async () => {
            const result = await remove({ id: detail.id, version });
            if (!result.ok) {
              if (result.code === 'NOT_FOUND') leave.current = true;
              return { ok: false, code: result.code };
            }
            leave.current = true;
            return {
              ok: true,
              toast: { title: t.toast.title, description: t.toast.body(detail.title) },
            };
          }}
          onClose={() => setOpen(false)}
          onSettled={() => {
            if (leave.current) router.push(POSTS_LIST_HREF);
            else router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
```

  XANH. Đột biến: gửi `detail.version` thay `version` (ca đầu phải đỏ); `onSettled` luôn
  `push` (ca STALE phải đỏ).

- [ ] **B4. Gắn vào trang sửa.** Trong `post-editor.tsx`: import `type DeletePostAction`,
  `DeletePostZone`; `PostEditorProps` thêm `remove: DeletePostAction;`; chèn ngay SAU thẻ
  `</form>` (vẫn trong `div.flex.min-w-0.flex-col.gap-6` của cột trái):

```tsx
          {/* NGOÀI form (Quyết định 14): hộp xác nhận không bao giờ bắn Save của trang. */}
          <DeletePostZone detail={saved} version={version} remove={remove} />
```

  `page.tsx` import `deletePostAction` và truyền `remove={deletePostAction}`. Spec trang sửa:
  `props()` thêm `remove: vi.fn<DeletePostAction>(),`, và thêm:

```tsx
  it('vùng xoá nằm NGOÀI form của trang', () => {
    renderEditor();
    expect(
      screen.getByRole('button', { name: messages.admin.posts.delete.action }).closest('form'),
    ).toBeNull();
  });
```

  XANH.
- [ ] **B5.** Quy trình gate, rồi commit:
  `feat(admin): xoá bài viết qua hộp xác nhận`

## Task 13 — Soi bố cục bằng CSS build thật

jsdom không có bố cục (bài học 5). Cách làm của F19 Task 10: DOM của CHÍNH các component,
đổ ra trang tĩnh, nối với CSS mà `next build` của admin vừa sinh, rồi đo bằng trình duyệt ở
hai khổ. Không commit gì — trừ khi phải sửa lỗi bố cục tìm ra.

**Files (tạm, xoá ở B6):**

- Create: `apps/admin/src/components/__layout-check__/render.spec.tsx`
- Output: `apps/admin/.next/layout-check/*.html` (`.next/` đã nằm trong `.gitignore`)

- [ ] **B1.** Build admin (đã có nếu vừa chạy gate):
  `pnpm turbo run build --filter=@tourism/admin --output-logs=errors-only`.
  `ls apps/admin/.next/static/chunks/*.css` phải ra ít nhất hai file.

- [ ] **B2.** Tạo spec tạm `render.spec.tsx`:

```tsx
// TẠM — soi bố cục P4e-4 bằng CSS build thật (plan P4e-4, Task 13). KHÔNG commit.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import type * as React from 'react';
import { describe, it, vi } from 'vitest';
import { AdminShell } from '@/components/admin-shell';
import { PostEditor } from '@/components/posts/editor/post-editor';
import { PostsTable } from '@/components/posts/posts-table';
import type { PostRowVM } from '@/lib/posts-view';
import { postDetailFixture, TOUR_A, TOUR_B } from '@/test/post-detail';

vi.mock('next/navigation', () => ({
  usePathname: () => '/posts',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// cwd của vitest là apps/admin.
const CHUNKS = '.next/static/chunks';
const CSS = readdirSync(CHUNKS).filter((name) => name.endsWith('.css'));
const FONT_CLASSES = [
  ...new Set(
    CSS.flatMap((name) =>
      [...readFileSync(`${CHUNKS}/${name}`, 'utf8').matchAll(/\.([\w-]+__variable)\b/g)].map(
        (match) => match[1],
      ),
    ),
  ),
];
const OUT = '.next/layout-check';
mkdirSync(OUT, { recursive: true });

const USER = {
  id: 'u-1',
  name: 'Admin Nexora',
  email: 'admin@nexora-travel.agency',
  role: 'ADMIN',
  image: null,
};
const noop = vi.fn();

/** Tiêu đề dài, ba tag, hai tour (một tắt bán) — bày đủ thứ dễ tràn. */
const DETAIL = postDetailFixture({
  title: 'Eating your way through Hội An: bánh mì at dawn, cao lầu at noon, lanterns by night',
  tags: [
    { slug: 'food', name: 'Food' },
    { slug: 'hoi-an', name: 'Hội An' },
    { slug: 'street-food', name: 'Street food' },
  ],
  relatedTours: [TOUR_A, TOUR_B],
});

const row = (n: number, patch: Partial<PostRowVM>): PostRowVM => ({
  id: `row-${n}`,
  slug: `post-${n}`,
  title: DETAIL.title,
  editorHref: `/posts/post-${n}`,
  displayStatus: 'published',
  statusLabel: 'Published',
  published: '1 Oct 2026, 08:00 UTC',
  tags: 'Food, Hội An, Street food',
  updated: '2 Oct 2026, 10:11 UTC',
  thumbUrl: null,
  ...patch,
});

function page(name: string, body: React.ReactNode) {
  render(
    <div data-admin-surface style={{ display: 'contents' }}>
      <AdminShell user={USER}>{body}</AdminShell>
    </div>,
  );
  const links = CSS.map((file) => `<link rel="stylesheet" href="/static/chunks/${file}">`).join('');
  writeFileSync(
    `${OUT}/${name}.html`,
    `<!doctype html><html lang="en" class="${FONT_CLASSES.join(' ')} h-full antialiased"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${links}</head><body class="min-h-full bg-background text-foreground">${document.body.innerHTML}</body></html>`,
  );
}

describe('layout-check', () => {
  it('posts-list', () =>
    page(
      'posts-list',
      <PostsTable
        rows={[
          row(1, {}),
          row(2, { displayStatus: 'scheduled', statusLabel: 'Scheduled' }),
          row(3, { displayStatus: 'draft', statusLabel: 'Draft', published: '—', tags: '—' }),
        ]}
        query={{ page: 1, limit: 20 }}
        total={3}
        totalPages={1}
        create={noop}
      />,
    ));
  it('post-editor', () =>
    page(
      'post-editor',
      <PostEditor
        detail={DETAIL}
        update={noop}
        signCover={noop}
        loadLibrary={noop}
        tagOptions={[{ slug: 'markets', name: 'Markets', count: 4 }]}
        tourOptions={[TOUR_A, TOUR_B]}
        remove={noop}
      />,
    ));
});
```

  Chạy: `pnpm --filter @tourism/admin exec vitest run src/components/__layout-check__/render.spec.tsx`
  — hai ca xanh, hai file trong `apps/admin/.next/layout-check/`.

- [ ] **B3.** Mở máy chủ tĩnh ở nền (Git Bash, từ gốc repo):
  `python -m http.server 8766 --directory apps/admin/.next` — rồi mở
  `http://localhost:8766/layout-check/post-editor.html` trong Browser pane (`preview_start`
  với `url`). Chữ phải ra đúng font của admin; không có thì B2 thiếu file CSS font.

- [ ] **B4. Đo ở 1600px.** `resize_window` 1600×1000. Ở `post-editor.html` chạy bằng
  `javascript_tool`:

```js
(() => {
  const aside = document.querySelector('[data-slot="step-aside"]');
  const main = aside.previousElementSibling;
  const box = (el) => el.getBoundingClientRect();
  const firstCard = (el) => el.querySelector('[data-slot="card"]');
  const toolbar = document.querySelector('[role="toolbar"]');
  return {
    viewport: innerWidth,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    twoColumns: box(aside).left >= box(main).right,
    topDelta: Math.round(box(firstCard(aside)).top - box(firstCard(main)).top),
    toolbarOverflow: toolbar.scrollWidth - toolbar.clientWidth,
  };
})()
```

  Đạt khi: `overflowX` 0, `twoColumns` true, `topDelta` trong ±1 (card Publish ngang hàng
  card tiêu đề), `toolbarOverflow` 0. Ở `posts-list.html` chỉ đo
  `document.documentElement.scrollWidth - innerWidth` — phải 0 (bảng tự cuộn trong khung của
  kit, trang không được cuộn ngang). Chụp một ảnh màn trang sửa để ghi vào bàn giao.

- [ ] **B5. Đo ở 390px.** `resize_window` 390×844, chạy lại đoạn đo cho trang sửa. Đạt khi:
  `overflowX` 0, `twoColumns` false, cột phải nằm DƯỚI form
  (`box(aside).top >= box(main).bottom`), `toolbarOverflow` 0. Ở `posts-list.html`:
  `overflowX` 0. Trả khổ về `desktop` khi xong.

- [ ] **B6. Dọn.** Tắt máy chủ tĩnh (PowerShell):
  `Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`;
  xoá `apps/admin/src/components/__layout-check__/` và `apps/admin/.next/layout-check/`.
  `git status` phải sạch.

- [ ] **B7.** Có phép đo trượt: sửa đúng chỗ (TDD nếu sửa logic), gate, commit
  `fix(admin): …` mô tả lỗi bố cục; rồi đo lại. Ghi mọi số đo (cả lần trượt) vào bàn giao.

## Task 14 — Gate cuối, docs, bàn giao

**Files:**

- Modify: `docs/handoff/mobile-account-handoff.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/open-items.md`

- [ ] **B1.** `git log --oneline main..HEAD` — mười hai commit của Task 1–12 (cộng commit
  `fix` của Task 13 nếu có), không commit lạ. `git diff --stat main..HEAD` không chạm file
  nào ngoài "Bản đồ file" và các chỗ Quyết định 8, 9, 10 cho phép.
- [ ] **B2.** Các phép grep phải rỗng:
  `grep -rn "photos\.dialog\|editor/photo-library-dialog\|content/article-markdown\|changed this step" apps libs --include=*.ts --include=*.tsx`.
  Quy trình gate trên đỉnh nhánh; ghi số test từng gói (Vitest) và số int (ca, file).
- [ ] **B3. Ghi chú cho mobile.** `docs/handoff/mobile-account-handoff.md`, mục 6 ý 1 ("Markdown
  phải tự vẽ"): thêm đoạn này ngay sau câu kết thúc bằng "không in ký hiệu thô kiểu
  `**đậm**` ra giữa bài." (dòng mới, thụt hai dấu cách như các dòng trong ý):

```markdown
   Từ P4e-4 (02/10) điều ấy không còn là "sau này": trình soạn bài của admin có hàng nút
   chèn `**đậm**`, `*nghiêng*` và link `[chữ](https://…)`. Bộ vẽ mobile phải xử ĐỦ ba cú pháp
   này — vẽ ra, hoặc ít nhất bóc ký hiệu để còn chữ thường. Ảnh và HTML thì không bao giờ
   tới: contract từ chối chúng ngay lúc lưu (`postContentIssue`).
```

  `git diff docs/handoff/mobile-account-handoff.md` chỉ được có phần thêm.
- [ ] **B4. Entry CHANGELOG** — chèn ngay dưới khối `> **File này chỉ giữ đợt đang chạy**…`,
  TRÊN entry mới nhất. Ngày là ngày chạy bước này. Khuôn:

```markdown
## 2026-MM-DD — P4e-4 quản trị bài viết (nhánh `feat/p4e-4-posts-admin`)

Admin quản trị được bài viết: bảng `/posts` (tab Published · Scheduled · Drafts, tìm theo
tiêu đề), hộp New post, trang sửa một bài với một nút Save — trình soạn markdown có hàng nút
và tab Preview, card Publish (nháp, đăng, hẹn giờ theo UTC, danh sách ba mục cần để đăng),
ảnh bìa tải lên hoặc chọn từ thư viện, tag gõ thẳng, tối đa 3 tour liên quan, vùng xoá.
Quyết định ở ADR-0051, hợp đồng ở spec 02/10. Không migration, không env.

(Một đoạn cho API: bảy route, phiên bản, cổng đăng, vòng đời ảnh bìa, bust. Một đoạn cho
web: bộ render dời sang `@tourism/ui`, khối "Tours in this story", G9, hết trần 50. Một đoạn
cho phần dùng chung tách từ F17/F18. Một đoạn chỗ lệch plan nếu có, kèm lý do; một đoạn số
đo Task 13.)

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **N** (web …, api …, admin …, contract …, core …, ui …, tokens …,
i18n …), int **N ở N file**. Liệt kê số ca mới theo gói và các đột biến đã thử.
```

  Không để dòng nào bắt đầu bằng `+`; tổng số test gói trọn trong một dòng hoặc nối bằng chữ
  "và". `git diff docs/CHANGELOG.md` phải chỉ có phần thêm.
- [ ] **B5. `docs/open-items.md`:**
  - dòng P4e: thay đoạn "Còn **P4e-4** bài viết: … chờ plan" bằng "**P4e-4** (bài viết) xong
    trên nhánh `feat/p4e-4-posts-admin`, chờ review. Còn **P4f** (media, users)";
  - G9: thêm cuối ô mô tả "ĐÓNG ở P4e-4 (trên nhánh): trang bài viết mang thêm tag `tours`.";
  - G15: thêm "Một phần đóng ở P4e-4: phía API `signUploads` dùng chung cho tour và bài viết;
    admin dùng chung `uploadPhoto` và hộp thư viện. Còn bản chép XHR giữa web và admin.";
  - G16: thêm "P4e-4: đường bài viết chỉ đưa ảnh trong thư mục tải lên của chính bài vào hàng
    dọn (vị từ ở nơi gọi). Vị từ chung cho bộ dọn vẫn để P4f."

  `git diff docs/open-items.md` trước khi stage.
- [ ] **B6.** `./scripts/docs-freshness.sh` (Git Bash) — xanh.
- [ ] **B7. Commit:** `docs: entry CHANGELOG cho P4e-4 quản trị bài viết`
- [ ] **B8.** Tắt API (lệnh PowerShell ở Quy trình gate), xoá `/tmp/p4e4-api.log`. Không còn
  tiến trình nào nghe cổng 3001 hay 8766. Xoá `apps/*/.turbo`, `.turbo` gốc và `apps/*/.next`
  nếu còn; báo dung lượng ổ C trước và sau.
- [ ] **B9. Bàn giao** — KHÔNG merge. Báo cho session gốc: danh sách commit · kết quả gate
  (số test từng gói, int) · đột biến đã thử và kết quả (kể cả cái không giết được, kèm lý
  do) · số đo Task 13 ở hai khổ · chỗ lệch plan và vì sao · việc cần hạ tầng (dự kiến:
  không có).

## Sau khi bàn giao — việc của session gốc

1. Review nhánh ở mức max effort, vá TRỌN phát hiện trên chính nhánh này (nếp F14–F19).
   Đọc kỹ: `claimPost` và mọi câu ghi sau nó đặt `updatedAt` bằng phiên bản vừa giành; ba
   nguồn ảnh bìa và hàng dọn (chỉ thư mục của chính bài); tag `createMany skipDuplicates`
   giữ tên người tạo đầu tiên; bust sau commit và không bust khi lỗi; G9 ở web; trang
   `/posts/[slug]` khi slug rác; tiêu điểm của ba card; copy hứa hệ quả (bài học 11).
2. Hỏi user trước khi merge; rebase lên `main`, `git merge --ff-only`, push bằng SHA đích
   danh; `gh run list --branch main --limit 1` phải xanh.
3. Deploy: không migration, không env. Vercel đưa admin và web lên TRƯỚC Render — trong
   khe ấy `/posts` ra trang lỗi (route mới chưa có ở API cũ). Kiểm Render bằng MCP
   (`list_deploys` của service `srv-da36lvgu01pc7381cv10`), không bằng uptime; thấy
   `update_failed` kiểu EMAXCONNSESSION (G23) thì hỏi user trước khi kích deploy lại.
4. Entry CHANGELOG ngày merge; dòng roadmap P4e trong `CLAUDE.md` (P4e-4 ✅) và
   `docs/open-items.md` (G9 đóng hẳn).
5. Thử tay trên production theo spec §8, TỪNG BƯỚC, chờ user xác nhận mỗi bước; session gốc
   kiểm DB bằng SQL chỉ-đọc (`posts`, `post_tag_links`, `post_tours`, `media_assets`,
   `media_garbage`) và log Render khi cần.
6. Sau thử tay: bài thử đã xoá ở bước 8; tag mới tạo trong lượt thử còn trong `post_tags` —
   đưa user câu SQL chính xác để TỰ xoá (session không tự xoá dữ liệu prod), rồi kiểm lại;
   ảnh bìa thử nằm trong hàng dọn, bộ dọn xoá sau 7 ngày — ghi vào bản nhớ "dữ liệu thử tay
   còn sót" để kiểm sau.

---

## Prompt bàn giao cho session thi công P4e-4

Dán nguyên khối dưới đây vào một session Claude Code MỚI mở tại
`C:\Programming\Devs\Projects\Tourism-Platform-V2`.

```text
Bạn là session THI CÔNG của tourism-v2, làm việc NGAY TRONG checkout gốc
C:\Programming\Devs\Projects\Tourism-Platform-V2 (không tạo worktree). Đọc
theo thứ tự:
  CLAUDE.md                                                (15 luật + gotcha)
  docs/README.md                                           (bản đồ tài liệu)
  docs/adr/0051-posts-admin.md                             (quyết định)
  docs/specs/2026-10-02-p4e-4-posts-admin-design.md        (spec — HỢP ĐỒNG)
  docs/plans/2026-10-02-p4e-4-posts-admin.md               (plan — làm theo)

VIỆC: tính năng P4e-4 — quản trị bài viết: bảng /posts, hộp New post, trang sửa một
bài với một nút Save (trình soạn markdown có hàng nút và Preview, đăng và hẹn giờ, ảnh
bìa, tag, tối đa 3 tour liên quan, xoá); API bảy route admin.posts.*; web có khối
"Tours in this story", trang bài tươi khi tour đổi (G9), danh sách bài hết trần 50.
Làm Task 1 → 14 đúng thứ tự, mỗi task một commit (Task 13 chỉ commit khi phải sửa lỗi
bố cục). Không làm gì ngoài plan; thấy plan sai hay mâu thuẫn spec thì DỪNG và hỏi tôi.

TRƯỚC DÒNG CODE ĐẦU TIÊN: đọc "Điều kiện bắt đầu", cả 19 mục "Quyết định của plan" và
các bài học ở đầu plan. Vòng review F17 tìm ra 24 lỗi thật; F18 và F19 mỗi vòng 15.

MỞ ĐẦU
- `git status` phải sạch và đang ở `main`.
- `git log --oneline -3 main` phải thấy commit "docs: plan thi công P4e-4…" và commit
  ADR-0051 + spec. Rồi: git checkout -b feat/p4e-4-posts-admin
- Docker Postgres phải đang chạy (`docker ps`) — integration test cần nó.

LUẬT BẤT DI BẤT DỊCH CỦA SESSION NÀY
- KHÔNG merge, KHÔNG push, KHÔNG rebase, KHÔNG dùng subagent.
- KHÔNG chạm hạ tầng sống (CLAUDE.md §15): không Supabase, Cloudinary, webhook, env hay
  redeploy Render/Vercel. P4e-4 không cần gì từ hạ tầng.
- KHÔNG sửa apps/mobile, apps/api/prisma/ (không migration nào), component có sẵn của
  libs/shared/ui (chỉ THÊM hai file của Task 5). Code tour chỉ được chạm đúng các chỗ
  Quyết định 8, 9, 10 kể tên. Thấy mình sắp cần sửa chỗ khác thì DỪNG và hỏi tôi.
- TDD (luật 4): test đỏ đúng lý do trước, rồi mới cài. Ca test mới nào cũng phải kiểm
  bằng đột biến — làm thật (sửa code cho sai, thấy đỏ, trả lại), ghi kết quả, kể cả
  đột biến không giết được và vì sao.
- Gate cuối mỗi task theo mục "Quy trình gate" của plan: liếc commit memory trước, chạy
  tách bước, hãm song song, cần API sống cho build web; xong thì tắt API bằng lệnh
  PowerShell trong plan.
- Comment code TIẾNG VIỆT (luật 8); copy người dùng thấy bằng TIẾNG ANH trong
  @tourism/i18n (luật 7). Tokens-only, không hex (luật 6).
- Commit Conventional Commits, message TIẾNG VIỆT CÓ DẤU, KHÔNG AI attribution —
  không dòng Co-Authored-By (luật 12). Stage theo đường dẫn tường minh, không
  `git add -A`. Chạy `pnpm lint:fix` trước khi stage.
- Contract và i18n được đọc từ dist: sửa xong phải build lại trước khi test gói khác
  (lệnh ở Ràng buộc toàn cục của plan).
- Rà docs/skills.md trước khi bắt tay (luật 9).

TÁM CHỖ DỄ SAI (plan có đủ chi tiết)
1. Phiên bản so trong CÙNG câu UPDATE (`claimPost`), và câu ghi bài sau đó đặt
   `updatedAt` bằng phiên bản vừa giành (Task 3).
2. Chỉ ảnh trong thư mục tải lên của CHÍNH bài vào lại hàng dọn — int test phải có đủ
   ba nguồn: tải lên, thư viện, catalog (Task 3, 4).
3. Bust `posts` + `post:<slug>` SAU commit; lệnh hỏng thì không bust (Task 3, 4).
4. Form chặn đăng thiếu TRƯỚC khi gửi bằng chính `postReadiness` của contract
   (Quyết định 11, Task 8).
5. Tách phần dùng chung của F17/F18 (Task 7): test cũ chỉ đổi đường import và chỗ tham
   chiếu copy, số ca giữ nguyên cộng đúng một.
6. Vùng xoá nằm NGOÀI `<form>`; nút Save ở cột phải gắn form bằng thuộc tính `form`
   (Quyết định 14, Task 12).
7. user-event coi `[` và `{` là ký hiệu phím — markdown có ngoặc thì dùng `paste`; mở
   popup Base UI (Tabs, Select, Dialog) xong thì chờ bằng `findByRole`.
8. Tiêu điểm không bao giờ rơi về <body>: gỡ tag → ô nhập tag; gỡ tour cuối → ô tìm
   tour; gỡ ảnh bìa → nút Upload (Task 10, 11).

BÀN GIAO KHI XONG
Không merge. Viết cho tôi: danh sách commit; kết quả gate (số test từng gói, số int);
đột biến đã thử và kết quả; số đo bố cục của Task 13 ở 1600px và 390px; chỗ lệch plan
và vì sao; việc cần hạ tầng (dự kiến: không có).
```
