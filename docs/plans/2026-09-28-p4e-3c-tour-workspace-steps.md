# Plan thi công F19 — Khu sửa tour dạng thanh bước (P4e-3c)

> **Cho agent thi công:** làm tuần tự từng task bằng skill
> `superpowers:executing-plans`. Bước dùng checkbox `- [ ]`. Prompt bàn giao ở
> cuối file KHÔNG cho dùng subagent.

**Mục tiêu:** khu sửa tour `/tours/[slug]` bỏ hàng tab chữ, thay bằng thanh bước chỉ
có icon; mỗi bước là form một bên và cột phải dính khi cuộn một bên; bước cuối
Review & publish gom danh sách kiểm tra, công tắc On sale và vùng xoá tour — không
đổi một luật ghi nào.

**Kiến trúc (ADR-0049):** một hàm thuần `tourSteps(detail)` suy trạng thái sáu bước
từ readiness ĐÃ LƯU và nuôi cả thanh bước lẫn bước Review; `EditorFormFrame` thêm
`lead`, `aside`, `next` và dựng lưới hai cột; cột phải do chính form dựng nên đọc được
giá trị ĐANG SOẠN (`projectedReadiness`, tổng chi phí). Chỉ admin — API, contract, DB,
web, mobile không đổi một dòng.

**Stack:** Next.js 16 + React 19 + Base UI (admin) · Tailwind v4 · Vitest + Testing
Library.

**Spec:** [2026-09-28-p4e-3c-tour-workspace-steps-design.md](../specs/2026-09-28-p4e-3c-tour-workspace-steps-design.md)
— HỢP ĐỒNG của việc này; plan chỉ nói cách làm.
**ADR:** [0049 — khu sửa tour dạng thanh bước](../adr/0049-tour-workspace-steps.md) ·
nền: [0047](../adr/0047-tour-editor-sections.md) · [0048](../adr/0048-tour-photos.md)
**Mockup user đã duyệt (v7):** `C:\Programming\Devs\Assets\mockups\2026-09-28-tour-workspace-steps\index.html`
(mở bằng Edge; mã nguồn ở `workspace-steps-mockup.tsx.txt` cùng thư mục — THAM KHẢO bố
cục và class, không chép nguyên: spec §9 liệt kê chỗ cố ý khác mockup).

| Tính năng | Nhánh | Task |
| --- | --- | --- |
| **F19** khu sửa tour dạng thanh bước | `feat/p4e-3c-tour-workspace-steps` | 1–11 |

## Điều kiện bắt đầu

F19 sửa đúng những file F18 vừa sửa (`editor-form-frame.tsx`, `tour-editor-view.ts`,
`list-editor.tsx`, form Photos, vùng xoá tour). **Chỉ bắt đầu khi F18 đã merge vào
`main`**:

```bash
git log --oneline main -- apps/admin/src/components/tours/editor/tour-photos-form.tsx
```

phải in ít nhất một commit. Không in gì → DỪNG, báo session gốc.

Plan viết theo F18 ở đỉnh nhánh `9fa7baea`. Vòng review F18 có thể đổi form Photos,
`EditorFormFrame` hay `ListEditor` — gặp chỗ code thật khác đoạn "trước" trong plan,
giữ nguyên Ý ĐỒ của bước (spec §2d) và ghi chỗ lệch vào báo cáo bàn giao.

### Cập nhật 29/09 — code thật đã khác plan ở đâu

F18 merge sau vòng review (15 phát hiện), rồi thêm hai nhánh nhỏ: G12/G13 và góp ý của
lượt thử tay (`fix/f18-thu-tay-gop-y`). Các chỗ dưới đây đoạn "trước" của plan KHÔNG còn
khớp; giữ nguyên hành vi mới, chỉ làm đúng ý đồ của bước:

- **`editor-form-frame.tsx` (Task 2):** đã có prop `busy?: boolean` →
  `useReportUnsaved(dirty || busy)` (còn file đang tải = có thay đổi chưa lưu). Thêm
  `lead`/`aside`/`next` mà không làm mất `busy`; ca busy trong spec phải còn xanh.
- **`tour-photos-form.tsx` (Task 6 — chỉ dời JSX vào Card):** dòng tải giữ chỗ TRƯỚC
  khi ký; `signSafely` coi lệnh ký ném là GENERIC; AbortController huỷ lượt tải khi
  unmount; đang lưu thì thả file và Retry bị chặn (`photos.busySaving`); tiêu điểm
  Retry/Remove/Make cover đi qua `focusId` và id của nút Upload, thanh tiến độ, nút
  Retry, nút Remove; `busy={uploads.length > 0}` truyền vào `EditorFormFrame`;
  `onFieldError` đặt lại thư viện khi PHOTO_NOT_ALLOWED. Thanh tiến độ nay là `Progress`
  của `@tourism/ui` (vẫn mang `id` và `tabIndex={-1}` — hai thứ ấy giữ tiêu điểm Retry).
  Giữ nguyên mọi id và nhánh; cả 23 ca của spec phải xanh như cũ.
- **`photos/page.tsx` (Task 6 chỉ sửa JSDoc):** có nhánh khe deploy
  `if (!hasKnownPhotos(detail)) return <TourPhotosUnavailable />;` — giữ nguyên.
- **`tour-editor-view.ts`:** `cloudinaryImageUrl` đã dời sang `lib/cloudinary-url.ts`
  (cùng `withDeliveryTransform`); `tourPhotoThumb` VẪN ở `tour-editor-view` như plan dùng.
- **`photo-library-dialog.tsx`** (plan không đụng): "Added" là huy hiệu trên ảnh.
- **`messages.ts`:** khối `admin.tours.editor.photos` thêm `unavailable`, `duplicate`,
  `busySaving`, `catalogue`, `catalogueWarning`, `dialog.loadErrors` và bỏ
  `dialog.failed`; `editor.form.errors` thêm `tooManyPhotos`. Chữ của
  `editor.banners.notReady` đổi thành "…Saved like this, it would be missing:" — B9 chỉ
  sửa JSDoc của nó, không đụng chữ. Nguồn ảnh có thêm `CATALOG` (ADR-0048 AMEND 1–2).
- **Gate:** bước unit chạy `--concurrency=1 -- --maxWorkers=4`, không phải 2 như mục
  "Quy trình gate" ghi — đợt F18 có lượt `--concurrency=2` làm commit memory trống tụt
  còn 1,6 GB.
- **Bài học 13:** test mở Select hay Popover rồi tìm option thì CHỜ bằng `findByRole`,
  không `getByRole` ngay sau cú bấm — ca như vậy của F18 đỏ chập chờn khi máy tải nặng.
- **Session song song:** trước bước int của gate, xem `git worktree list` và cổng 3001;
  một session khác đang chạy test:int thì chờ nó xong — int dùng chung DB
  `tourism_test`. Chỉ tắt tiến trình nghe cổng 3001 của mình.

## Quyết định của plan

Spec để ngỏ hay nói chưa khớp code ở mười ba chỗ dưới đây; plan chốt như sau. Ở ba chỗ
(6 — chữ "Max M" của card web, 10, 11) chữ cũ của spec lệch code thật; spec đã sửa cho
khớp trong cùng commit với plan này.

1. **Tên cũ sống song song tới Task 4.** Task 1 THÊM bộ tên step
   (`TourEditorStep`, `TOUR_EDITOR_STEPS`, `tourStepHref`, `activeTourStep`,
   `departuresHref`, `tourSteps`); Task 4 — khi thanh bước thay hàng tab — mới gỡ
   `TourEditorTab`, `TOUR_EDITOR_TABS`, `tourTabHref`, `activeTourTab` và đổi nốt chỗ
   gọi. Commit nào giữa chừng cũng chạy trọn.
2. **Bước Review ra đời TRƯỚC khi công tắc và vùng xoá rời chỗ cũ.** Task 3 thêm bước
   Review có công tắc On sale và vùng xoá; Task 4 gỡ công tắc khỏi phần đầu; Task 5 gỡ
   vùng xoá khỏi Details. Không commit nào mất chỗ bật bán hay xoá tour; giữa Task 3 và
   Task 4/5 hai thứ ấy tạm có ở hai chỗ.
3. **`DeleteTourZone` không đổi nội dung** — chỉ đổi chỗ đặt. `TourDetailsForm` bỏ prop
   `remove`; trang Details thôi truyền `deleteTourAction`.
4. **Phần đầu thành client component**: cần `usePathname` cho `aria-current` của nút
   Departures.
5. **Nút Upload photos giữ `variant="outline"` như F18** (mockup vẽ nền đặc): một bước
   chỉ một nút chính là Save.
6. **Thẻ xem trước dùng lại chữ của web** — `messages.toursPage.featuredBadge`
   ("Featured"), `notRated` ("Not yet reviewed"), `durationValue(n)` ("3 days"),
   `maxGroup(n)` ("Max 12") — nên đọc đúng chữ khách thấy trên card. `ratingAvg` của
   `AdminTourDetail` là CHUỖI thập phân ("4.66"), không phải số như ở web.
7. **Link cùng trang không bị hộp hỏi lại chặn** (`#day-N`, `#faq`, `#policies`):
   `leaveTarget` trả `null` khi chỉ đổi `#hash` (đã đo ở `lib/unsaved-changes.ts:36`).
   Không cần gì thêm.
8. **Giữ vai trò ARIA mà test hiện có tra theo**: thẻ ngày Itinerary là `role="group"`
   có tên "Day N" (`aria-labelledby` trỏ tiêu đề thẻ); Totals của Costs giữ `section
   aria-labelledby` + `aria-live`; hai nhóm ô tích của Details vẫn là `fieldset` có mô tả.
9. **"Last saved …" dùng `formatDateTime` của `lib/bookings-view.ts`** — cùng khuôn giờ
   UTC với mọi bảng admin ("28 Sep 2026, 14:27 UTC").
10. **Không có `departuresHref` mới** (spec §2f cũ ghi thêm một hàm): `lib/tours-query.ts`
    đã có `departuresHref(slug)` cho đúng việc ấy (bảng `/tours` đang dùng), còn
    `lib/departures-query.ts` có `departuresHref(query, patch)` khác chữ ký — hàm thứ ba
    cùng tên là bẫy import. Phần đầu dùng lại hàm của `tours-query`; "đang ở Departures"
    đọc từ `activeTourStep(...) === null`, nên nút Departures và thanh bước không thể
    cùng sáng.
11. **`SITE_URL` gom về `lib/site.ts` ở cả bốn chỗ** đang tự khai (`nav-user.tsx`,
    `app/login/page.tsx`, `app/not-authorized/page.tsx`, `components/auth/login-form.tsx`)
    — spec chỉ nêu `nav-user`; module chung ra đời thì ba bản còn lại là trùng lặp.
12. **Toast `TOUR_NOT_READY` ở bảng `/tours` vẫn mở bước Details** (spec §1: bảng giữ
    nguyên) — thanh bước ở đầu mọi bước đã chỉ bước nào thiếu.
13. **Câu `publish.workspace.notReady` đổi "the list below" thành "the checklist"**: ở bước
    Review danh sách nằm bên TRÁI công tắc (màn hẹp thì bên TRÊN), không ở dưới.

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
- **Không đụng**: `apps/web`, `apps/mobile`, `apps/api`, `libs/shared/contract`,
  `libs/shared/ui` (kit dùng chung với web đang chạy — dùng, không sửa), Prisma.
  Thấy mình sắp cần sửa một trong số đó thì DỪNG và hỏi.
- **Không hạ tầng sống** (luật 15): không Supabase, Cloudinary, webhook, env hay
  redeploy Render/Vercel. F19 không cần gì từ hạ tầng.
- **Tên cố định** (review sẽ grep đúng chữ): như spec §2f; route admin
  `/tours/[slug]/review`; khối i18n `messages.admin.tours.editor.{steps,header,next,aside,review}`.
- **Contract và i18n được đọc từ `dist`**: sửa i18n xong phải build lại trước khi test
  admin thấy thay đổi —
  `pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only`.
- **Next.js 16** (`apps/admin/AGENTS.md`): trước khi thêm route mới ở Task 3, đọc hướng
  dẫn trong `apps/admin/node_modules/next/dist/docs/` và theo khuôn các trang cùng thư
  mục `app/(admin)/tours/[slug]/`.
- **Tài liệu `.md`:** không để dòng bắt đầu bằng `+` ở cột 0; `git diff` file `.md`
  trước khi stage; không sửa entry CHANGELOG cũ.

### Quy trình gate (luật 11) — dùng ở cuối MỖI task

`pnpm gate:int` trần chạy song song 10 luồng và từng làm máy phình RAM, nên chạy tách
bước, hãm song song. Build web prerender gọi API thật, nên phải có API sống. Chạy từ gốc
repo bằng **Git Bash**, Docker Postgres phải đang chạy (`docker ps`; tắt thì mở Docker
Desktop rồi `docker start tourism-v2-postgres-1`):

```bash
# 1. API sống cho bước build web
pnpm turbo run build --filter=@tourism/api --output-logs=errors-only
(cd apps/api && node --env-file-if-exists=.env.local dist/main.js > /tmp/f19-api.log 2>&1 &)
for i in $(seq 1 30); do curl -sf http://localhost:3001/api/health > /dev/null && echo "API sống" && break; sleep 2; done

# 2. build + typecheck
NEXT_PUBLIC_API_URL=http://localhost:3001 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm turbo run build typecheck --concurrency=2 --output-logs=errors-only

# 3. unit test — 16 worker làm ca zod-config.spec.ts của contract hết giờ (đo 23/09)
pnpm turbo run test --concurrency=2 --output-logs=errors-only -- --maxWorkers=4

# 4. lint + luật tokens của mobile
pnpm lint && node scripts/check-mobile-tokens-only.mjs

# 5. integration test (F19 không có int test mới, nhưng luật 11 vẫn đòi chạy)
pnpm test:int --concurrency=2
```

Tắt API sau khi xong (PowerShell) — chỉ giết đúng tiến trình đang nghe cổng 3001:

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Cả năm bước xanh mới được khai task xong. Chạy gate trong một tác vụ nền thì tác vụ ấy
KHÔNG báo xong chừng nào API cổng 3001 còn sống — tắt API là nó xong. Máy chậm bất
thường thì dừng và báo.

## Bài học mang sang — đọc TRƯỚC dòng code đầu tiên

Vòng review F17 tìm ra 24 lỗi thật; F14, F15, F16 lần lượt 15, 27, 15. F19 là việc giao
diện, nhưng đi qua đúng các vùng từng hỏng.

**Test**

1. **Mỗi ca test mới thử đột biến.** F14 có ba ca xanh giả, F15 có năm.
2. **Fixture phải phân biệt được kết quả đúng với kết quả lười.** Ca "cột phải đọc giá
   trị đang soạn" phải GÕ một giá trị khác bản đã lưu rồi mới đọc cột phải; ca "thanh
   bước đọc bản đã lưu" phải có giá trị đang soạn KHÁC bản đã lưu.
3. **Khớp chữ chính xác, không `/…/i`.**
4. **Bố cục không đo được bằng jsdom** — Task 10 soi bằng CSS build thật.

**Admin**

5. **Đích link readiness phải còn nguyên**: `#tour-summary` (id của ô tóm tắt),
   `#tour-destinations` (id của card Destinations), `#day-N` (id của thẻ ngày). Đổi
   `fieldset` thành `Card` là chỗ dễ đánh rơi id.
6. **Cột phải đọc giá trị ĐANG SOẠN, thanh bước đọc bản ĐÃ LƯU.** Trộn hai thứ là thanh
   bước nhảy xanh khi admin chưa lưu.
7. **Tiêu điểm không bao giờ rơi về `<body>`** — form Photos có `emptyFocus` (gỡ dòng
   cuối → nút Upload photos) và Make cover → ô alt; xếp lại bố cục không được làm mất.
8. **Mọi câu copy hứa hệ quả phải đo trên code trước khi viết.** Hai vòng review liền bắt
   được câu copy nói sai. Copy của F19 đã đo ở spec §2g; thêm câu nào mới thì đo trước.
9. **Dùng lại, đừng chép:** `FormField`, `FormSelect`, `ListEditor`, `EditorFormFrame`,
   `PublishToggle`, `DeleteTourZone`, `useWorkspaceDetail`, `projectedReadiness`,
   `readinessIssues`, `costBreakdown`, `tourPhotoThumb`, `formatAmount`, `formatDateTime`.
10. **Không sửa `@tourism/ui`** — kit dùng chung với web đang chạy.

**Quy trình**

11. **Comment không khai trạng thái tương lai** ("Task X sẽ…").
12. **Entry CHANGELOG viết theo ngày viết**; session review thêm entry merge.

## Bản đồ file

| File | Trách nhiệm | Task |
| --- | --- | --- |
| `libs/shared/i18n/src/lib/messages.ts` | Toàn bộ copy F19 (`steps`, `header`, `next`, `aside`, `review`, `tabs.review`); gỡ copy chết của khung readiness | 1, 4 |
| `apps/admin/src/lib/tour-editor-view.ts` | Bộ tên step, `tourSteps`; gỡ bộ tên tab; `tourCardPreview` | 1, 4, 5 |
| `apps/admin/src/lib/site.ts` (mới) | `SITE_URL`, `tourPageUrl(slug)` | 4 |
| `apps/admin/src/components/nav-user.tsx`, `app/login/page.tsx`, `app/not-authorized/page.tsx`, `components/auth/login-form.tsx` | `SITE_URL` từ `lib/site.ts` | 4 |
| `apps/admin/src/components/tours/editor/editor-form-frame.tsx` | `lead`, `aside`, `next`; `StepColumns` | 2 |
| `apps/admin/src/components/tours/editor/step-aside.tsx` (mới) | `StateMark`, `StepChecklist`, `StepTips`, `CoverFrame`, `CoverPreviewCard`, `TourCardPreview` | 2, 5 |
| `apps/admin/src/components/tours/editor/step-icons.ts` (mới) | Icon của từng bước — thanh bước và bước Review dùng chung | 3 |
| `apps/admin/src/components/tours/editor/tour-review-step.tsx` (mới) | Bước Review & publish | 3 |
| `apps/admin/src/app/(admin)/tours/[slug]/review/page.tsx` (mới) | Route bước Review | 3 |
| `apps/admin/src/components/tours/editor/tour-step-nav.tsx` (mới) | Thanh bước | 4 |
| `apps/admin/src/components/tours/editor/tour-workspace-header.tsx` | Phần đầu mới | 4 |
| `apps/admin/src/components/tours/editor/tour-workspace-top.tsx` | Phần đầu + thanh bước | 4 |
| `apps/admin/src/app/(admin)/tours/[slug]/layout.tsx` | Thôi truyền `setPublished` cho phần đầu | 4 |
| `apps/admin/src/components/tours/publish-toggle.tsx`, `…/editor/delete-tour-zone.tsx` | Chỉ JSDoc: chỗ đặt mới | 4, 5 |
| `apps/admin/src/lib/tours-view.ts`, `components/tours/editor/new-tour-dialog.tsx` | `tourTabHref` → `tourStepHref` | 4 |
| `apps/admin/src/components/tours/editor/tour-tabs.tsx` (+ spec), `tour-readiness-panel.tsx` (+ spec) | Xoá | 4 |
| `apps/admin/src/components/tours/editor/tour-details-form.tsx` + `app/(admin)/tours/[slug]/page.tsx` | Bước Details | 5 |
| `apps/admin/src/components/tours/editor/tour-photos-form.tsx` | Bước Photos | 6 |
| `apps/admin/src/components/tours/editor/tour-itinerary-form.tsx` | Bước Itinerary | 7 |
| `apps/admin/src/components/tours/editor/tour-content-form.tsx` | Bước FAQ & policies | 8 |
| `apps/admin/src/components/tours/editor/tour-costs-form.tsx` | Bước Costs | 9 |
| `apps/admin/src/app/(admin)/tours/[slug]/{photos,itinerary,content,costs}/page.tsx` | Chỉ JSDoc: "Tab" → "Bước" | 6–9 |
| `docs/CHANGELOG.md`, `docs/open-items.md` | Entry F19, dòng P4e | 11 |

Mọi file `.tsx`/`.ts` ở trên có spec cạnh nó; task nào sửa component thì sửa luôn spec.

## Task 1 — Bước là dữ liệu: copy và `tourSteps`

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts`
- Modify: `apps/admin/src/lib/tour-editor-view.ts`
- Test: `apps/admin/src/lib/tour-editor-view.spec.ts`

**Interfaces:**

- Produces: `type TourEditorStep`, `TOUR_EDITOR_STEPS`, `tourStepHref(slug, step)`,
  `activeTourStep(pathname, slug): TourEditorStep | null`,
  `type TourStepStatus = 'ok' | 'warn' | 'optional' | 'final'`, `interface TourStepVM
  { step; href; title; status; summary; fixHref }`, `tourSteps(detail): TourStepVM[]`.
  Copy: `messages.admin.tours.editor.{tabs.review, steps, header, next, aside, review}`.

- [ ] **B1. Copy.** Trong `messages.admin.tours.editor`:
  - đổi `tabsLabel: 'Tour sections'` thành `tabsLabel: 'Tour steps'`;
  - trong `tabs`, thêm dòng `review: 'Review & publish',` sau `departures: 'Departures',`;
  - ngay sau dòng `toggleBlocked: 'Fill in what is missing to put it on sale.',` chèn
    NGUYÊN khối dưới (mọi câu hứa hệ quả đã đo ở spec §2g):

```ts
        /**
         * F19 (ADR-0049) — khu sửa tour dạng thanh bước. Dòng trạng thái của thanh
         * bước và của bước Review là CÙNG chữ: một hàm `tourSteps` nuôi cả hai.
         */
        steps: {
          detailsReady: 'Summary and primary destination set',
          photosReady: (n: number) => (n === 1 ? '1 photo · cover set' : `${n} photos · cover set`),
          itineraryReady: 'Every day planned',
          /** `items`: các mục thiếu đã hạ chữ đầu, nối bằng dấu phẩy. */
          missing: (items: string) => `Missing: ${items}`,
          optionalContent: (faqs: number, policies: number) =>
            `Optional · ${faqs === 1 ? '1 question' : `${faqs} questions`} · ${
              policies === 1 ? '1 policy' : `${policies} policies`
            }`,
          optionalCosts: (lines: number) =>
            lines === 0
              ? 'Optional · no cost lines'
              : `Optional · ${lines === 1 ? '1 cost line' : `${lines} cost lines`}`,
          reviewOnSale: 'On sale',
          reviewReady: 'Ready to go on sale',
          reviewToFix: (n: number) => (n === 1 ? '1 thing to fix' : `${n} things to fix`),
          /** Tên đọc-màn-hình của một icon trên thanh bước: tên bước kèm dòng trạng thái. */
          stepLabel: (title: string, summary: string) => `${title}: ${summary}`,
          /** Chữ cho trình đọc màn hình thay cho dấu trạng thái (icon ẩn). */
          state: { ok: 'Done', warn: 'Needs attention', optional: 'Optional' },
        },
        header: {
          onSale: 'On sale',
          /** Không phải "Draft": tour gỡ bán không phải bản nháp (spec §9). */
          offSale: 'Not on sale',
          viewOnSite: 'View on site',
          lastSaved: (when: string) => `Last saved ${when}`,
        },
        /** Link đi tiếp ở chân form, cạnh nút Save. */
        next: (step: string) => `Next: ${step}`,
        aside: {
          thisStep: 'This step',
          thisStepBody: 'What this step needs before the tour can go on sale.',
          required: 'Required to go on sale',
          optionalStep: 'Optional — the tour can go on sale without it.',
          /** Tiêu đề card cột phải của hai bước tuỳ chọn (FAQ & policies, Costs). */
          onThisStep: 'On this step',
          tips: 'Tips',
          details: {
            basicsBody:
              'What travellers see first — the card on /tours and the top of the tour page.',
            sellingBody:
              'Shown on the tour page: who it suits, badges, highlights, what’s included and practical notes.',
            sellingOptional: 'Highlights, lists and meeting point',
            shownWhenFilled: 'Optional — shown on the tour page when filled',
            tips: [
              'Lead the summary with the one thing people remember.',
              'Two or three highlights read better than eight.',
              '“Limited offer” only while a date has a real discount.',
            ],
          },
          preview: {
            title: 'Card on /tours',
            body: 'How the card reads with what you have now.',
            noCover: 'No cover photo yet',
            untitled: 'Untitled tour',
            /** Luật của card web: chip giảm giá thắng nhãn Featured (tour-list-card.tsx). */
            featuredNote: 'The Featured label shows unless the card shows a discount.',
            basePrice: 'Base price',
            /** Card web in giá của chuyến rẻ nhất sắp tới (`cardPrice`), admin không có số ấy. */
            priceNote: 'The site shows the cheapest upcoming departure.',
          },
          photos: {
            altAll: 'Alt text on every photo',
            altDone: 'Required to save',
            altMissing: (n: number) =>
              n === 1 ? '1 photo still needs it' : `${n} photos still need it`,
            coverTitle: 'Cover on /tours',
            coverBody: 'The first photo, cropped the way tour cards show it.',
            drop: 'Or drop photos here.',
            saveNote: 'Saving replaces the tour’s photos in this order.',
            tips: [
              'Landscape photos crop best on tour cards.',
              'Describe what is in the photo — skip “photo of”.',
            ],
          },
          itinerary: {
            daysTitle: 'Days',
            daysBody: 'Jump to a day. Stays in view while you scroll.',
            needed: 'Needed before going on sale',
          },
          content: {
            faqBody: 'Questions travellers ask before booking. Shown on the tour page.',
            policiesBody: 'Booking and general rules shown on the tour page.',
            faqCount: (n: number) => (n === 1 ? '1 question' : `${n} questions`),
            policyCount: (n: number) => (n === 1 ? '1 policy' : `${n} policies`),
            cancellationTitle: 'Cancellation policy',
          },
          costs: {
            title: 'Cost lines',
            body: 'Internal only — travellers never see these. They make up the tour’s cost price.',
          },
        },
        review: {
          title: 'Ready to go on sale?',
          body: 'Every required step has to be green before the tour can go on sale.',
          fix: 'Fix',
          visibility: {
            title: 'Visibility',
            onSale: 'On sale — travellers can find and book it.',
            offSale: 'Not on sale — hidden from the site.',
            always: 'Taking a tour off sale is always allowed.',
          },
          after: {
            title: 'When it goes on sale',
            items: [
              'It appears on /tours and on the region pages of its destinations.',
              'Travellers can book the departures marked Bookable.',
            ],
          },
          deleteBlocked: {
            title: 'Delete this tour',
            body: 'Tours that have been booked can’t be deleted. Take it off sale instead.',
          },
        },
```

  Build lại: `pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only`.

- [ ] **B2. Test đỏ.** Thêm vào `apps/admin/src/lib/tour-editor-view.spec.ts` (thêm
  `activeTourStep`, `tourStepHref`, `tourSteps` vào import từ `./tour-editor-view`;
  import `@tourism/contract` thành `{ type AdminTourDetail, tourReadiness }`; thêm
  `import { messages } from '@tourism/i18n';`):

```ts
/**
 * Bước là DỮ LIỆU (ADR-0049 §1–§2): thứ tự, đường dẫn, và trạng thái suy từ readiness
 * ĐÃ LƯU — nguồn duy nhất của thanh bước lẫn bước Review.
 */
describe('tourStepHref', () => {
  it('Details là gốc của tour; bước khác nối tên bước; slug được mã hoá', () => {
    expect(tourStepHref('ha long', 'details')).toBe('/tours/ha%20long');
    expect(tourStepHref('ha-long', 'review')).toBe('/tours/ha-long/review');
  });
});

describe('activeTourStep', () => {
  it.each([
    ['/tours/ha-long', 'details'],
    ['/tours/ha-long/photos', 'photos'],
    ['/tours/ha-long/costs', 'costs'],
    ['/tours/ha-long/review', 'review'],
    ['/tours/ha-long/khong-co', 'details'],
  ] as const)('%s → %s', (pathname, step) => {
    expect(activeTourStep(pathname, 'ha-long')).toBe(step);
  });

  it('Departures không phải bước — không bước nào sáng', () => {
    expect(activeTourStep('/tours/ha-long/departures', 'ha-long')).toBeNull();
  });
});

describe('tourSteps', () => {
  const s = messages.admin.tours.editor.steps;
  const byStep = (detail: AdminTourDetail) =>
    Object.fromEntries(tourSteps(detail).map((step) => [step.step, step]));

  it('đúng thứ tự thanh bước, đường dẫn và tên bước', () => {
    const steps = tourSteps(detailFixture());
    expect(steps.map((step) => step.step)).toEqual([
      'details',
      'photos',
      'itinerary',
      'content',
      'costs',
      'review',
    ]);
    expect(steps.map((step) => step.href)).toEqual([
      '/tours/ha-long-bay-cruise',
      '/tours/ha-long-bay-cruise/photos',
      '/tours/ha-long-bay-cruise/itinerary',
      '/tours/ha-long-bay-cruise/content',
      '/tours/ha-long-bay-cruise/costs',
      '/tours/ha-long-bay-cruise/review',
    ]);
    expect(steps.map((step) => step.title)).toEqual([
      'Details',
      'Photos',
      'Itinerary',
      'FAQ & policies',
      'Costs',
      'Review & publish',
    ]);
  });

  it('tour đủ và đang bán: ba bước bắt buộc xanh, hai tuỳ chọn, bước cuối nói "On sale"', () => {
    const detail = detailFixture();
    expect(tourSteps(detail).map((step) => step.status)).toEqual([
      'ok',
      'ok',
      'ok',
      'optional',
      'optional',
      'final',
    ]);
    const steps = byStep(detail);
    expect(steps.details?.summary).toBe(s.detailsReady);
    expect(steps.photos?.summary).toBe('1 photo · cover set');
    expect(steps.itinerary?.summary).toBe(s.itineraryReady);
    expect(steps.review?.summary).toBe('On sale');
    expect(tourSteps(detail).every((step) => step.fixHref === null)).toBe(true);
  });

  it('thiếu tóm tắt và điểm đến chính: Details vàng, kể cả hai mục, sửa từ ô tóm tắt', () => {
    const details = byStep(detailFixture({ isPublished: false, summary: null, destinations: [] }))
      .details;
    expect(details?.status).toBe('warn');
    expect(details?.summary).toBe('Missing: a summary, a primary destination');
    expect(details?.fixHref).toBe('/tours/ha-long-bay-cruise#tour-summary');
  });

  it('thiếu ngày: Itinerary vàng kèm dải ngày, sửa từ ngày thiếu đầu tiên', () => {
    const itinerary = byStep(
      detailFixture({
        isPublished: false,
        itinerary: [{ dayNumber: 1, title: 'Board the boat', description: null }],
      }),
    ).itinerary;
    expect(itinerary?.status).toBe('warn');
    expect(itinerary?.summary).toBe('Missing: an itinerary for days 2–3');
    expect(itinerary?.fixHref).toBe('/tours/ha-long-bay-cruise/itinerary#day-2');
  });

  it('không có ảnh: Photos vàng, sửa ở bước Photos', () => {
    const photos = byStep(detailFixture({ isPublished: false, photos: [] })).photos;
    expect(photos?.status).toBe('warn');
    expect(photos?.summary).toBe('Missing: a cover photo');
    expect(photos?.fixHref).toBe('/tours/ha-long-bay-cruise/photos');
  });

  it('bước cuối: tắt bán mà đủ → "Ready to go on sale"; thiếu hai mục → "2 things to fix"', () => {
    expect(byStep(detailFixture({ isPublished: false })).review?.summary).toBe(
      'Ready to go on sale',
    );
    expect(
      byStep(detailFixture({ isPublished: false, summary: null, photos: [] })).review?.summary,
    ).toBe('2 things to fix');
  });

  it('bước tuỳ chọn đếm đúng số ít, số nhiều và số không', () => {
    const empty = byStep(detailFixture());
    expect(empty.content?.summary).toBe('Optional · 0 questions · 0 policies');
    expect(empty.costs?.summary).toBe('Optional · no cost lines');
    const one = byStep(
      detailFixture({
        faqs: [{ question: 'Q?', answer: 'A.' }],
        policies: [{ kind: 'GENERAL', title: 'Weather', body: 'We move you.' }],
        costItems: [{ category: 'MEALS', label: 'Lunch', amount: '9.00', basis: 'PER_PERSON' }],
      }),
    );
    expect(one.content?.summary).toBe('Optional · 1 question · 1 policy');
    expect(one.costs?.summary).toBe('Optional · 1 cost line');
  });
});
```

  `pnpm --filter @tourism/admin exec vitest run src/lib/tour-editor-view.spec.ts` —
  đỏ vì các hàm chưa có.

- [ ] **B3. Cài.** Trong `apps/admin/src/lib/tour-editor-view.ts`, ngay SAU hàm
  `activeTourTab`, thêm:

```ts
/**
 * Sáu bước của khu sửa tour, đúng thứ tự thanh bước (ADR-0049 §1). Departures KHÔNG
 * là bước (§5): nó là việc vận hành chuyến, và readiness không phụ thuộc nó.
 */
export type TourEditorStep = 'details' | 'photos' | 'itinerary' | 'content' | 'costs' | 'review';

export const TOUR_EDITOR_STEPS: readonly TourEditorStep[] = [
  'details',
  'photos',
  'itinerary',
  'content',
  'costs',
  'review',
];

export function tourStepHref(slug: string, step: TourEditorStep): string {
  const base = `/tours/${encodeURIComponent(slug)}`;
  return step === 'details' ? base : `${base}/${step}`;
}

/** Bước đang mở theo pathname; `null` ở Departures (không bước nào sáng). Đoạn lạ → Details. */
export function activeTourStep(pathname: string, slug: string): TourEditorStep | null {
  const rest = pathname.slice(tourStepHref(slug, 'details').length).replace(/^\//, '');
  const segment = rest.split('/')[0] ?? '';
  if (segment === 'departures') return null;
  return (TOUR_EDITOR_STEPS as readonly string[]).includes(segment)
    ? (segment as TourEditorStep)
    : 'details';
}

export type TourStepStatus = 'ok' | 'warn' | 'optional' | 'final';

export interface TourStepVM {
  step: TourEditorStep;
  href: string;
  title: string;
  status: TourStepStatus;
  /** Dòng trạng thái — tooltip của thanh bước VÀ hàng của bước Review (cùng chữ). */
  summary: string;
  /** Đích sửa chỗ thiếu ĐẦU TIÊN của bước; chỉ có khi `warn`. */
  fixHref: string | null;
}

/** Mục readiness thuộc về từng bước bắt buộc. */
const STEP_ISSUES: Record<'details' | 'photos' | 'itinerary', readonly ReadinessIssue['key'][]> =
  {
    details: ['summary', 'primaryDestination'],
    photos: ['cover'],
    itinerary: ['days'],
  };

/** "A summary" → "a summary": nhãn readiness đứng giữa câu "Missing: …". */
function lowerFirst(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/**
 * Trạng thái sáu bước từ readiness ĐÃ LƯU (ADR-0049 §2) — nguồn DUY NHẤT của thanh bước
 * và danh sách kiểm tra ở bước Review, nên hai chỗ không thể nói khác nhau. Cột phải
 * của từng bước KHÔNG dùng hàm này: nó đọc giá trị đang soạn qua `projectedReadiness`.
 */
export function tourSteps(detail: AdminTourDetail): TourStepVM[] {
  const s = t.steps;
  const issues = readinessIssues(detail.readiness, detail.slug);
  const required = (step: keyof typeof STEP_ISSUES, ready: string): TourStepVM => {
    const own = issues.filter((issue) => STEP_ISSUES[step].includes(issue.key));
    const [first] = own;
    return {
      step,
      href: tourStepHref(detail.slug, step),
      title: t.tabs[step],
      status: first === undefined ? 'ok' : 'warn',
      summary:
        first === undefined
          ? ready
          : s.missing(own.map((issue) => lowerFirst(issue.label)).join(', ')),
      fixHref: first?.href ?? null,
    };
  };
  const plain = (
    step: 'content' | 'costs' | 'review',
    status: TourStepStatus,
    summary: string,
  ): TourStepVM => ({
    step,
    href: tourStepHref(detail.slug, step),
    title: t.tabs[step],
    status,
    summary,
    fixHref: null,
  });
  const review = detail.isPublished
    ? s.reviewOnSale
    : issues.length === 0
      ? s.reviewReady
      : s.reviewToFix(issues.length);
  return [
    required('details', s.detailsReady),
    required('photos', s.photosReady(detail.photos.length)),
    required('itinerary', s.itineraryReady),
    plain('content', 'optional', s.optionalContent(detail.faqs.length, detail.policies.length)),
    plain('costs', 'optional', s.optionalCosts(detail.costItems.length)),
    plain('review', 'final', review),
  ];
}
```

  `readinessIssues` và `ReadinessIssue` nằm dưới trong cùng file — hàm khai bằng
  `function` nên gọi được; TS không cần sắp lại thứ tự.

- [ ] **B4.** Chạy lại spec — xanh. Đột biến tối thiểu (ghi kết quả): bỏ nhánh
  `departures` của `activeTourStep`; đổi `STEP_ISSUES.photos` thành `[]`; bỏ
  `lowerFirst`; đảo `detail.isPublished` ở dòng `review`; đổi `'optional'` của costs thành
  `'ok'`.
- [ ] **B5.** Quy trình gate.
- [ ] **B6. Commit:** `feat(admin): bước của khu sửa tour là dữ liệu — tourSteps suy trạng thái từ readiness`
  (stage `libs/shared/i18n/src/lib/messages.ts`, `apps/admin/src/lib/tour-editor-view.ts`,
  `apps/admin/src/lib/tour-editor-view.spec.ts`).

## Task 2 — Khung bước: `EditorFormFrame` hai cột và khối cột phải

**Files:**

- Modify: `apps/admin/src/components/tours/editor/editor-form-frame.tsx`
- Create: `apps/admin/src/components/tours/editor/step-aside.tsx`
- Test: `apps/admin/src/components/tours/editor/editor-form-frame.spec.tsx`,
  `apps/admin/src/components/tours/editor/step-aside.spec.tsx` (mới)

**Interfaces:**

- Consumes: copy `aside`, `next`, `steps.state` (Task 1).
- Produces:
  - `EditorFormFrame` thêm prop tuỳ chọn `lead?: React.ReactNode`,
    `aside?: React.ReactNode`, `next?: { href: string; label: string }`.
  - `StepColumns({ aside, children })` (export từ `editor-form-frame.tsx`).
  - `step-aside.tsx`: `type ChecklistState = 'ok' | 'warn' | 'optional'`,
    `interface ChecklistItem { key: string; label: string; detail: string; state: ChecklistState }`,
    `StepChecklist({ items, title?, description? })`, `StepTips({ items })`,
    `CoverPreviewCard({ url })`.

- [ ] **B1. Test đỏ — khung.** Thêm vào `editor-form-frame.spec.tsx` (dùng helper
  `frame` sẵn có):

```tsx
describe('EditorFormFrame — bố cục bước (ADR-0049 §6)', () => {
  it('có aside: cột phải là <aside> đứng SAU form trong DOM', () => {
    frame({ aside: <p>Right column</p> });
    const aside = screen.getByRole('complementary');
    expect(aside).toHaveTextContent('Right column');
    const form = screen.getByRole('button', { name: t.save }).closest('form');
    expect(form?.compareDocumentPosition(aside)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('không aside: không có <aside> nào — form giữ một cột như trước', () => {
    frame();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('lead đứng TRƯỚC form, ngoài form', () => {
    frame({ lead: <p>Intro line</p> });
    const lead = screen.getByText('Intro line');
    expect(lead.closest('form')).toBeNull();
    const form = screen.getByRole('button', { name: t.save }).closest('form');
    expect(lead.compareDocumentPosition(form as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('next: link "Next: <bước>" ở chân form, đứng trước nút Save', () => {
    frame({ next: { href: '/tours/ha-long/photos', label: 'Photos' } });
    const next = screen.getByRole('link', { name: t.next('Photos') });
    expect(next).toHaveAttribute('href', '/tours/ha-long/photos');
    expect(next.compareDocumentPosition(screen.getByRole('button', { name: t.save }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('form có thay đổi: bấm Next bật hộp hỏi lại, không điều hướng (spec §4.4)', async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider>
        <EditorFormFrame
          dirty
          pending={false}
          banner={null}
          next={{ href: '/tours/ha-long/photos', label: 'Photos' }}
          onSubmit={vi.fn()}
          onReload={onReload}
        >
          <input aria-label="Name" />
        </EditorFormFrame>
      </UnsavedChangesProvider>,
    );

    await user.click(screen.getByRole('link', { name: t.next('Photos') }));

    expect(
      screen.getByRole('alertdialog', { name: messages.admin.unsavedChanges.title }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **B2. Test đỏ — khối cột phải.** Tạo `step-aside.spec.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { CoverPreviewCard, StepChecklist, StepTips } from './step-aside';

/**
 * Khối dùng chung của cột phải (ADR-0049 §6): danh sách việc cần làm của bước, gợi ý,
 * ảnh bìa. Dấu trạng thái là icon ẩn — trình đọc màn hình nghe chữ thay cho nó.
 */
const a = messages.admin.tours.editor.aside;
const state = messages.admin.tours.editor.steps.state;

describe('StepChecklist', () => {
  it('tiêu đề mặc định "This step"; mỗi dòng nói trạng thái bằng chữ cho trình đọc màn hình', () => {
    render(
      <StepChecklist
        items={[
          { key: 'summary', label: 'A summary', detail: a.required, state: 'ok' },
          { key: 'primary', label: 'A primary destination', detail: a.required, state: 'warn' },
          { key: 'selling', label: 'Highlights', detail: 'Optional', state: 'optional' },
        ]}
      />,
    );
    expect(screen.getByText(a.thisStep)).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent(`${state.ok}A summary`);
    expect(rows[1]).toHaveTextContent(`${state.warn}A primary destination`);
    expect(rows[2]).toHaveTextContent(`${state.optional}Highlights`);
    expect(within(rows[1] as HTMLElement).getByText(a.required)).toBeInTheDocument();
  });

  it('nhận tiêu đề và mô tả riêng', () => {
    render(<StepChecklist title="On this step" description="Optional." items={[]} />);
    expect(screen.getByText('On this step')).toBeInTheDocument();
    expect(screen.getByText('Optional.')).toBeInTheDocument();
  });
});

describe('StepTips', () => {
  it('tiêu đề "Tips" và đủ từng gợi ý', () => {
    render(<StepTips items={['One.', 'Two.']} />);
    expect(screen.getByText(a.tips)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual(['One.', 'Two.']);
  });
});

describe('CoverPreviewCard', () => {
  it('có ảnh: ảnh trang trí (alt rỗng) dùng thumbnail 320px', () => {
    const { container } = render(
      <CoverPreviewCard url="https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/x" />,
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', '');
    expect(img?.getAttribute('src')).toContain('/upload/f_auto,q_auto,w_320/');
  });

  it('chưa có ảnh: nói ra thay vì để ô trống', () => {
    render(<CoverPreviewCard url={null} />);
    expect(screen.getByText(a.preview.noCover)).toBeInTheDocument();
  });
});
```

  Chạy hai spec — đỏ.

- [ ] **B3. Cài — khung.** Trong `editor-form-frame.tsx`:
  - import thêm `buttonVariants` từ `@tourism/ui/components/button` và `ChevronRightIcon`
    từ `lucide-react`;
  - khối JSDoc đầu file thêm đoạn: *"Bước (ADR-0049 §6): `lead` trải hết bề ngang trên
    hai cột; `aside` là cột phải — do CHÍNH form dựng nên đọc được giá trị đang soạn;
    `next` là link đi tiếp cạnh Save. Link là `<a>` thật nên hộp hỏi lại chặn nó như mọi
    link khác."*;
  - thêm ba prop vào chữ ký và kiểu (sau `blockedNote`):

```tsx
  /** Dòng trải hết bề ngang TRÊN hai cột (Itinerary: câu giới thiệu). */
  lead?: React.ReactNode;
  /** Cột phải của bước — dính khi cuộn từ `xl`. Vắng thì form một cột như F17. */
  aside?: React.ReactNode;
  /** Link "Next: <bước>" ở chân form, cạnh nút Save. */
  next?: { href: string; label: string };
```

  - thay khối `return (...)` bằng:

```tsx
  const form = (
    <form
      noValidate
      className="flex min-w-0 flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty && !pending && blockedNote === undefined) onSubmit();
      }}
    >
      {shown ? <FormBanner banner={shown} onReload={onReload} /> : null}
      {children}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        {(blockedNote ?? note) ? (
          <p className="mr-auto text-xs text-muted-foreground">{blockedNote ?? note}</p>
        ) : null}
        {next ? (
          <Link href={next.href} className={buttonVariants({ variant: 'ghost' })}>
            {t.next(next.label)}
            <ChevronRightIcon aria-hidden="true" />
          </Link>
        ) : null}
        <Button
          type="submit"
          focusableWhenDisabled
          disabled={!dirty || pending || blockedNote !== undefined}
        >
          <StableLabel label={pending ? t.saving : t.save} reserve={SAVE_LABELS} />
        </Button>
      </div>
    </form>
  );

  return (
    <>
      {lead}
      <StepColumns aside={aside}>{form}</StepColumns>
    </>
  );
}

/**
 * Lưới hai cột của một bước (ADR-0049 §6): nội dung chính trái, cột phải `20rem` dính
 * khi cuộn từ `xl`; hẹp hơn thì một cột, cột phải xuống dưới. Không `aside` thì trả
 * nguyên nội dung — form một cột như F17. Bước Review (không có form) dùng thẳng khung này.
 */
export function StepColumns({
  aside,
  children,
}: {
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (aside === undefined || aside === null) return <>{children}</>;
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      {children}
      {/* `data-slot`: móc cho bước soi bố cục bằng CSS build thật (plan F19, Task 10). */}
      <aside data-slot="step-aside" className="grid min-w-0 gap-4 xl:sticky xl:top-4">
        {aside}
      </aside>
    </div>
  );
}
```

- [ ] **B4. Cài — khối cột phải.** Tạo `step-aside.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { cn } from '@tourism/ui/lib/utils';
import { CircleAlertIcon, CircleCheckIcon, LightbulbIcon } from 'lucide-react';
import { tourPhotoThumb } from '@/lib/tour-editor-view';

/**
 * Khối dùng chung của cột phải mỗi bước (ADR-0049 §6). Nơi dùng truyền dữ liệu ĐANG
 * SOẠN vào — khối không tự đọc form hay server.
 */
const e = messages.admin.tours.editor;
const a = e.aside;

export type ChecklistState = 'ok' | 'warn' | 'optional';

export interface ChecklistItem {
  key: string;
  label: string;
  /** Dòng phụ dưới nhãn: "Required to go on sale", số ảnh còn thiếu alt… */
  detail: string;
  state: ChecklistState;
}

/** Dấu trạng thái: icon cho mắt, chữ cho trình đọc màn hình. */
export function StateMark({ state, className }: { state: ChecklistState; className?: string }) {
  return (
    <>
      {state === 'ok' ? (
        <CircleCheckIcon aria-hidden="true" className={cn('size-4 shrink-0 text-success', className)} />
      ) : state === 'warn' ? (
        <CircleAlertIcon aria-hidden="true" className={cn('size-4 shrink-0 text-warning', className)} />
      ) : (
        <span
          aria-hidden="true"
          className={cn('size-4 shrink-0 rounded-full border border-dashed border-muted-foreground/60', className)}
        />
      )}
      <span className="sr-only">{e.steps.state[state]}</span>
    </>
  );
}

/** "This step" — việc cần làm của bước, tính trên giá trị đang soạn. */
export function StepChecklist({
  items,
  title = a.thisStep,
  description = a.thisStepBody,
}: {
  items: readonly ChecklistItem[];
  title?: string;
  description?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-2.5 text-sm">
              <StateMark state={item.state} className="mt-0.5" />
              <div className="grid gap-0.5">
                <span className="font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** "Tips" — gợi ý viết, chữ tĩnh của từng bước. */
export function StepTips({ items }: { items: readonly string[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LightbulbIcon aria-hidden="true" className="size-4" />
          {a.tips}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid list-disc gap-1.5 pl-5 text-xs text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Ảnh bìa như card /tours cắt nó: khung 3:2, `object-cover` bằng CSS — không `c_fill`
 * ở URL (ADR-0020 §4). Ảnh là trang trí: tên tour đã nói nó là gì.
 */
export function CoverPreviewCard({ url }: { url: string | null }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{a.photos.coverTitle}</CardTitle>
        <CardDescription>{a.photos.coverBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <CoverFrame url={url} />
      </CardContent>
    </Card>
  );
}

/** Khung ảnh 3:2 dùng chung cho ảnh bìa và thẻ xem trước. */
export function CoverFrame({ url, children }: { url: string | null; children?: React.ReactNode }) {
  return (
    <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-muted">
      {url ? (
        // biome-ignore lint/performance/noImgElement: URL Cloudinary đã tối ưu sẵn (ADR-0005), như cả admin
        <img src={tourPhotoThumb(url)} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
          {a.preview.noCover}
        </span>
      )}
      {children}
    </div>
  );
}
```

  `React.ReactNode` ở `CoverFrame` cần `import type * as React from 'react';` ở đầu file.

- [ ] **B5.** Chạy hai spec — xanh; spec cũ của `EditorFormFrame` giữ xanh. Đột biến:
  bỏ `{lead}`; đặt `<aside>` TRƯỚC `{children}` trong `StepColumns`; bỏ nhánh "không
  aside"; bỏ `<span className="sr-only">`; thêm `c_fill` vào URL ảnh.
- [ ] **B6.** Quy trình gate.
- [ ] **B7. Commit:** `feat(admin): khung bước hai cột — EditorFormFrame nhận lead, aside, next`

## Task 3 — Bước Review & publish

**Files:**

- Create: `apps/admin/src/components/tours/editor/step-icons.ts`
- Create: `apps/admin/src/components/tours/editor/tour-review-step.tsx`
- Create: `apps/admin/src/app/(admin)/tours/[slug]/review/page.tsx`
- Test: `apps/admin/src/components/tours/editor/tour-review-step.spec.tsx` (mới)

**Interfaces:**

- Consumes: `tourSteps`, `TourStepVM` (Task 1); `StepColumns` (Task 2); `StateMark`,
  `ChecklistState` (Task 2); copy `review`, `steps` (Task 1); `PublishToggle`,
  `DeleteTourZone`, `useWorkspaceDetail` (có sẵn).
- Produces: `STEP_ICONS: Record<TourEditorStep, LucideIcon>`;
  `TourReviewStep({ setPublished, remove })`; route `/tours/[slug]/review`.

- [ ] **B1. Đọc hướng dẫn route của Next 16** trong `apps/admin/node_modules/next/dist/docs/`
  (phần App Router: pages, dynamic segments) — `params` là `Promise`, như các trang cùng
  thư mục `app/(admin)/tours/[slug]/`.

- [ ] **B2. Test đỏ.** Tạo `tour-review-step.spec.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { detailFixture } from '@/test/tour-detail';
import { TourDetailProvider } from './tour-detail-context';
import { TourReviewStep } from './tour-review-step';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * Bước Review & publish (ADR-0049 §3): danh sách kiểm tra dựng bằng CHÍNH `tourSteps`
 * của thanh bước, công tắc On sale khoá chiều bật khi tour còn thiếu, vùng xoá chỉ khi
 * tour chưa từng có booking.
 */
const e = messages.admin.tours.editor;
const r = e.review;
const s = e.steps;

function renderStep(detail: AdminTourDetail) {
  render(
    <TourDetailProvider detail={detail}>
      <TourReviewStep setPublished={vi.fn()} remove={vi.fn()} />
    </TourDetailProvider>,
  );
}

const rows = () => within(screen.getByRole('list', { name: r.title })).getAllByRole('listitem');
const toggle = () =>
  screen.getByRole('switch', {
    name: messages.admin.tours.publish.toggleLabel('Ha Long Bay Cruise'),
  });

describe('TourReviewStep — danh sách kiểm tra', () => {
  it('năm hàng — mọi bước trừ chính nó — cùng dòng trạng thái với thanh bước', () => {
    renderStep(detailFixture());
    expect(rows().map((row) => row.textContent)).toEqual([
      `${s.state.ok}${e.tabs.details}${s.detailsReady}`,
      `${s.state.ok}${e.tabs.photos}1 photo · cover set`,
      `${s.state.ok}${e.tabs.itinerary}${s.itineraryReady}`,
      `${s.state.optional}${e.tabs.content}Optional · 0 questions · 0 policies`,
      `${s.state.optional}${e.tabs.costs}Optional · no cost lines`,
    ]);
    expect(screen.queryByRole('link', { name: r.fix })).toBeNull();
  });

  it('bước thiếu: CHỈ hàng ấy có nút Fix, trỏ tới chỗ thiếu đầu tiên', () => {
    renderStep(
      detailFixture({
        isPublished: false,
        itinerary: [{ dayNumber: 1, title: 'Board the boat', description: null }],
      }),
    );
    const itinerary = rows()[2] as HTMLElement;
    expect(itinerary).toHaveTextContent(
      `${s.state.warn}${e.tabs.itinerary}Missing: an itinerary for days 2–3`,
    );
    expect(within(itinerary).getByRole('link', { name: r.fix })).toHaveAttribute(
      'href',
      '/tours/ha-long-bay-cruise/itinerary#day-2',
    );
    expect(screen.getAllByRole('link', { name: r.fix })).toHaveLength(1);
  });
});

describe('TourReviewStep — Visibility', () => {
  it('tắt bán mà còn thiếu: công tắc khoá, trình đọc màn hình nghe vì sao', () => {
    renderStep(detailFixture({ isPublished: false, summary: null }));
    expect(toggle()).toHaveAttribute('aria-disabled', 'true');
    expect(toggle()).toHaveAccessibleDescription(e.toggleBlocked);
    expect(screen.getByText(r.visibility.offSale)).toBeInTheDocument();
  });

  it('tắt bán mà đủ: công tắc bấm được, không có câu khoá', () => {
    renderStep(detailFixture({ isPublished: false }));
    expect(toggle()).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText(e.toggleBlocked)).toBeNull();
  });

  it('đang bán: công tắc bật, câu trạng thái và câu "gỡ bán luôn được"', () => {
    renderStep(detailFixture());
    expect(toggle()).toBeChecked();
    expect(screen.getByText(r.visibility.onSale)).toBeInTheDocument();
    expect(screen.getByText(r.visibility.always)).toBeInTheDocument();
    for (const item of r.after.items) expect(screen.getByText(item)).toBeInTheDocument();
  });
});

describe('TourReviewStep — xoá tour', () => {
  it('chưa từng có booking: vùng xoá như cũ', () => {
    renderStep(detailFixture());
    expect(screen.getByRole('button', { name: e.delete.action })).toBeInTheDocument();
    expect(screen.queryByText(r.deleteBlocked.body)).toBeNull();
  });

  it('đã có booking: không có nút xoá, một câu nói vì sao', () => {
    renderStep(detailFixture({ bookingCount: 2 }));
    expect(screen.queryByRole('button', { name: e.delete.action })).toBeNull();
    expect(screen.getByRole('region', { name: r.deleteBlocked.title })).toHaveTextContent(
      r.deleteBlocked.body,
    );
  });
});
```

  Chạy `pnpm --filter @tourism/admin exec vitest run src/components/tours/editor/tour-review-step.spec.tsx`
  — đỏ vì chưa có component.

- [ ] **B3. Cài — icon của bước.** Tạo `step-icons.ts`:

```ts
import {
  CircleHelpIcon,
  FileTextIcon,
  ImageIcon,
  type LucideIcon,
  MapIcon,
  ReceiptIcon,
  RocketIcon,
} from 'lucide-react';
import type { TourEditorStep } from '@/lib/tour-editor-view';

/** Icon của từng bước (spec F19 §2a) — thanh bước và bước Review dùng chung một bảng. */
export const STEP_ICONS: Record<TourEditorStep, LucideIcon> = {
  details: FileTextIcon,
  photos: ImageIcon,
  itinerary: MapIcon,
  content: CircleHelpIcon,
  costs: ReceiptIcon,
  review: RocketIcon,
};
```

- [ ] **B4. Cài — bước Review.** Tạo `tour-review-step.tsx`:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { buttonVariants } from '@tourism/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { cn } from '@tourism/ui/lib/utils';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { PublishToggle } from '@/components/tours/publish-toggle';
import { type TourStepVM, tourSteps } from '@/lib/tour-editor-view';
import type { DeleteTourAction } from '@/lib/tour-editor-write';
import type { SetPublishedAction } from '@/lib/tours-publish';
import { DeleteTourZone } from './delete-tour-zone';
import { StepColumns } from './editor-form-frame';
import { type ChecklistState, StateMark } from './step-aside';
import { STEP_ICONS } from './step-icons';
import { useWorkspaceDetail } from './tour-detail-context';

/**
 * Bước cuối Review & publish (ADR-0049 §3): danh sách kiểm tra từng bước, công tắc
 * On sale và vùng xoá tour — mọi việc quyết số phận tour ở một chỗ.
 *
 * Đọc bản MỚI NHẤT từ `TourDetailProvider` — đúng bản thanh bước đang đọc — và dựng
 * danh sách bằng CHÍNH `tourSteps` của thanh bước: hai chỗ không thể nói khác nhau.
 *
 * Công tắc là `PublishToggle` của F11 với `placement="workspace"`: khoá CHIỀU BẬT khi
 * tour còn thiếu, gỡ bán không bao giờ khoá (ADR-0047 §4). Không truyền
 * `notReadyHref`: danh sách thiếu gì nằm ngay cạnh công tắc.
 */
const e = messages.admin.tours.editor;
const r = e.review;
const BLOCKED_NOTE_ID = 'tour-sale-blocked-note';

type ReviewRow = TourStepVM & { status: ChecklistState };

export function TourReviewStep({
  setPublished,
  remove,
}: {
  setPublished: SetPublishedAction;
  remove: DeleteTourAction;
}) {
  const detail = useWorkspaceDetail();
  const rows = tourSteps(detail).filter((step): step is ReviewRow => step.status !== 'final');
  const blocked = !detail.readiness.ready;
  const showBlockedNote = blocked && !detail.isPublished;

  const aside = (
    <>
      <Card size="sm">
        <CardHeader>
          <CardTitle>{r.visibility.title}</CardTitle>
          <CardDescription>
            {detail.isPublished ? r.visibility.onSale : r.visibility.offSale}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <div className="flex items-center gap-2">
            <PublishToggle
              tour={detail}
              setPublished={setPublished}
              blocked={blocked}
              describedBy={showBlockedNote ? BLOCKED_NOTE_ID : undefined}
              placement="workspace"
            />
            {/* Nhãn cho mắt; tên đọc-màn-hình của công tắc đã có "On sale — <tên>". */}
            <span aria-hidden="true" className="text-sm font-medium">
              {e.onSale}
            </span>
          </div>
          {showBlockedNote ? (
            <p id={BLOCKED_NOTE_ID} className="text-xs text-muted-foreground">
              {e.toggleBlocked}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{r.visibility.always}</p>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>{r.after.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid list-disc gap-1.5 pl-5 text-xs text-muted-foreground">
            {r.after.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      <StepColumns aside={aside}>
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle id="tour-review-title">{r.title}</CardTitle>
              <CardDescription>{r.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul aria-labelledby="tour-review-title" className="grid">
                {rows.map((step) => {
                  const Icon = STEP_ICONS[step.step];
                  return (
                    <li
                      key={step.step}
                      className="flex flex-wrap items-center gap-3 border-t py-3 text-sm first:border-t-0 first:pt-0 last:pb-0"
                    >
                      <StateMark state={step.status} className="size-5" />
                      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <span className="w-36 shrink-0 font-medium">{step.title}</span>
                      <span
                        className={cn(
                          'min-w-0 flex-1',
                          step.status === 'warn' ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {step.summary}
                      </span>
                      {step.fixHref ? (
                        <Link
                          href={step.fixHref}
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          {r.fix}
                          <ChevronRightIcon aria-hidden="true" />
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Server là trọng tài thật của lệnh xoá (khoá ngoại `Restrict`); ở đây chỉ
              quyết có đưa nút ra hay không — như tab Details của F17. */}
          {detail.bookingCount === 0 ? (
            <DeleteTourZone detail={detail} remove={remove} />
          ) : (
            <section
              aria-labelledby="tour-delete-title"
              className="grid gap-1 rounded-lg border p-4"
            >
              <h3 id="tour-delete-title" className="text-base font-semibold">
                {r.deleteBlocked.title}
              </h3>
              <p className="text-sm text-muted-foreground">{r.deleteBlocked.body}</p>
            </section>
          )}
        </div>
      </StepColumns>
    </div>
  );
}
```

- [ ] **B5. Cài — route.** Tạo `app/(admin)/tours/[slug]/review/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TourReviewStep } from '@/components/tours/editor/tour-review-step';
import { setTourPublishedAction } from '../../actions';
import { deleteTourAction } from '../actions';
import { loadAdminTour } from '../load-tour';

export const metadata: Metadata = { title: 'Review & publish — Nexora back office' };

/**
 * Bước Review & publish (ADR-0049 §3). Phần đầu và `AdminShell` ở layout.
 *
 * Đọc tour chỉ để giữ đúng luật của các bước kia: không đọc được thì ra trang lỗi hay
 * 404 — cùng lượt đọc với layout nhờ React `cache()`, không tốn request. Thân bước đọc
 * bản MỚI NHẤT từ `TourDetailProvider`, đúng bản thanh bước đang đọc.
 */
export default async function TourReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await loadAdminTour(slug))) notFound();
  return <TourReviewStep setPublished={setTourPublishedAction} remove={deleteTourAction} />;
}
```

- [ ] **B6.** Chạy spec — xanh. Đột biến (ghi kết quả): bỏ `.filter` của `rows` (hàng
  Review lọt vào); hiện Fix cho mọi hàng; đảo điều kiện `bookingCount === 0`; bỏ
  `describedBy`; `blocked = detail.readiness.ready`.
- [ ] **B7.** Quy trình gate.
- [ ] **B8. Commit:** `feat(admin): bước Review & publish — danh sách kiểm tra, công tắc đăng và vùng xoá tour`
  (stage đúng bốn file trên).

## Task 4 — Thanh bước và phần đầu mới; gỡ hàng tab và khung readiness

**Files:**

- Create: `apps/admin/src/lib/site.ts`, `apps/admin/src/lib/site.spec.ts`
- Create: `apps/admin/src/components/tours/editor/tour-step-nav.tsx` (+ `tour-step-nav.spec.tsx`)
- Create: `apps/admin/src/components/tours/editor/tour-workspace-header.spec.tsx`
- Modify: `apps/admin/src/components/tours/editor/tour-workspace-header.tsx` (viết lại)
- Modify: `apps/admin/src/components/tours/editor/tour-workspace-top.tsx`
- Modify: `apps/admin/src/app/(admin)/tours/[slug]/layout.tsx`
- Modify: `apps/admin/src/lib/tour-editor-view.ts` (+ spec), `apps/admin/src/lib/tours-view.ts`,
  `apps/admin/src/components/tours/editor/new-tour-dialog.tsx`
- Modify: `apps/admin/src/components/nav-user.tsx`, `apps/admin/src/app/login/page.tsx`,
  `apps/admin/src/app/not-authorized/page.tsx`, `apps/admin/src/components/auth/login-form.tsx`
- Modify: `apps/admin/src/components/tours/publish-toggle.tsx` (chỉ JSDoc)
- Modify: `libs/shared/i18n/src/lib/messages.ts`
- Delete: `tour-tabs.tsx`, `tour-tabs.spec.tsx`, `tour-readiness-panel.tsx`,
  `tour-readiness-panel.spec.tsx` (cùng thư mục `components/tours/editor/`)

**Interfaces:**

- Consumes: `tourSteps`, `activeTourStep`, `tourStepHref`, `TourStepVM`,
  `TOUR_EDITOR_STEPS` (Task 1); `STEP_ICONS` (Task 3); `departuresHref(slug)` có sẵn ở
  `lib/tours-query.ts`; `formatDateTime` ở `lib/bookings-view.ts`.
- Produces: `SITE_URL`, `tourPageUrl(slug)`; `TourStepNav({ slug, steps })`;
  `TourWorkspaceHeader({ detail })`; `TourWorkspaceTop()` KHÔNG còn prop. Bộ tên tab
  (`TourEditorTab`, `TOUR_EDITOR_TABS`, `tourTabHref`, `activeTourTab`) biến mất.

- [ ] **B1. Test đỏ — `lib/site`.** Tạo `lib/site.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SITE_URL, tourPageUrl } from './site';

/** Địa chỉ site khách — một bản cho mọi link từ admin sang www. */
describe('tourPageUrl', () => {
  it('trang tour trên site khách; slug được mã hoá', () => {
    expect(SITE_URL).toBe('https://www.nexora-travel.agency');
    expect(tourPageUrl('ha-long-bay-cruise')).toBe(
      'https://www.nexora-travel.agency/tours/ha-long-bay-cruise',
    );
    expect(tourPageUrl('ha long')).toBe('https://www.nexora-travel.agency/tours/ha%20long');
  });
});
```

- [ ] **B2. Test đỏ — thanh bước.** Tạo `tour-step-nav.spec.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tourSteps } from '@/lib/tour-editor-view';
import { detailFixture } from '@/test/tour-detail';
import { TourStepNav } from './tour-step-nav';

let pathname = '/tours/ha-long-bay-cruise';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

beforeEach(() => {
  pathname = '/tours/ha-long-bay-cruise';
});

/**
 * Thanh bước (ADR-0049 §1): sáu link chỉ có icon; tên bước và dòng trạng thái nằm
 * trong tooltip VÀ trong chữ `sr-only` của link — máy cảm ứng không có tooltip.
 */
const e = messages.admin.tours.editor;
// Tour tắt bán, chưa có ảnh: Photos thiếu, bước cuối còn một việc.
const STEPS = tourSteps(detailFixture({ isPublished: false, photos: [] }));

function renderNav() {
  render(<TourStepNav slug="ha-long-bay-cruise" steps={STEPS} />);
  return within(screen.getByRole('navigation', { name: e.tabsLabel })).getAllByRole('link');
}

describe('TourStepNav', () => {
  it('sáu link đúng thứ tự và đúng đường; tên link là tên bước kèm dòng trạng thái', () => {
    const links = renderNav();
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/tours/ha-long-bay-cruise',
      '/tours/ha-long-bay-cruise/photos',
      '/tours/ha-long-bay-cruise/itinerary',
      '/tours/ha-long-bay-cruise/content',
      '/tours/ha-long-bay-cruise/costs',
      '/tours/ha-long-bay-cruise/review',
    ]);
    // Tên đọc-màn-hình, không phải `textContent`: dấu "!" ở góc là chữ trang trí
    // `aria-hidden` — nằm trong `textContent` nhưng không nằm trong tên của link.
    const names = [
      'Details: Summary and primary destination set',
      'Photos: Missing: a cover photo',
      'Itinerary: Every day planned',
      'FAQ & policies: Optional · 0 questions · 0 policies',
      'Costs: Optional · no cost lines',
      'Review & publish: 1 thing to fix',
    ];
    expect(links).toHaveLength(names.length);
    names.forEach((name, index) => expect(links[index]).toHaveAccessibleName(name));
  });

  it('bước đang mở mang aria-current="step"; ở Departures không bước nào sáng', () => {
    pathname = '/tours/ha-long-bay-cruise/photos';
    const links = renderNav();
    expect(
      links
        .filter((link) => link.getAttribute('aria-current') === 'step')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/tours/ha-long-bay-cruise/photos']);
  });

  it('ở trang Departures không link nào mang aria-current', () => {
    pathname = '/tours/ha-long-bay-cruise/departures';
    const links = renderNav();
    expect(links.some((link) => link.hasAttribute('aria-current'))).toBe(false);
  });

  it('dấu góc: ✓ ở bước đủ, "!" ở bước thiếu, không dấu ở bước tuỳ chọn và bước cuối', () => {
    const links = renderNav();
    const dot = (index: number) => links[index]?.querySelector('[data-slot="step-dot"]');
    expect(dot(0)?.querySelector('svg')).not.toBeNull();
    expect(dot(1)?.textContent).toBe('!');
    expect(dot(3)).toBeNull();
    expect(dot(5)).toBeNull();
    expect(links[3]).toHaveAttribute('data-status', 'optional');
  });

  it('rê chuột: tooltip hiện dòng trạng thái của bước', async () => {
    const user = userEvent.setup();
    const links = renderNav();
    expect(screen.queryByText('Missing: a cover photo')).toBeNull();
    await user.hover(links[1] as HTMLElement);
    expect(await screen.findByText('Missing: a cover photo')).toBeInTheDocument();
  });

  it('focus bằng bàn phím cũng hiện tooltip', async () => {
    const user = userEvent.setup();
    renderNav();
    await user.tab();
    expect(await screen.findByText(e.steps.detailsReady)).toBeInTheDocument();
  });
});
```

  (Đã đo 28/09 trên chính kit `Tooltip`: jsdom mở tooltip Base UI khi `user.hover` và
  khi `user.tab`; popup không mang `role="tooltip"` nên ca test tìm bằng chữ. Chữ `sr-only`
  là "Photos: Missing: a cover photo" — khác nguyên văn "Missing: a cover photo", nên
  `queryByText` trước khi rê chuột đúng là `null`.)

- [ ] **B3. Test đỏ — phần đầu.** Tạo `tour-workspace-header.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detailFixture } from '@/test/tour-detail';
import { TourWorkspaceHeader } from './tour-workspace-header';

let pathname = '/tours/ha-long-bay-cruise';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

beforeEach(() => {
  pathname = '/tours/ha-long-bay-cruise';
});

/**
 * Phần đầu khu sửa tour (ADR-0049 §4): chỉ còn trạng thái — không còn công tắc hay
 * khung readiness.
 */
const t = messages.admin.tours.editor;

describe('TourWorkspaceHeader', () => {
  it('đang bán: chip "On sale", View on site mở trang tour ở tab mới, lần lưu cuối giờ UTC', () => {
    render(<TourWorkspaceHeader detail={detailFixture()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Ha Long Bay Cruise' })).toBeInTheDocument();
    expect(
      screen.getByText('/tours/ha-long-bay-cruise · Last saved 24 Sep 2026, 10:11 UTC'),
    ).toBeInTheDocument();
    expect(screen.getByText(t.header.onSale)).toBeInTheDocument();
    const site = screen.getByRole('link', { name: t.header.viewOnSite });
    expect(site).toHaveAttribute('href', 'https://www.nexora-travel.agency/tours/ha-long-bay-cruise');
    expect(site).toHaveAttribute('target', '_blank');
    expect(site).toHaveAttribute('rel', 'noreferrer');
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('tắt bán: chip "Not on sale", KHÔNG có View on site (trang web 404)', () => {
    render(<TourWorkspaceHeader detail={detailFixture({ isPublished: false })} />);
    expect(screen.getByText(t.header.offSale)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t.header.viewOnSite })).toBeNull();
  });

  it('Departures: link tới bảng chuyến; aria-current="page" chỉ khi đang ở đó', () => {
    const view = render(<TourWorkspaceHeader detail={detailFixture()} />);
    const departures = () => screen.getByRole('link', { name: t.tabs.departures });
    expect(departures()).toHaveAttribute('href', '/tours/ha-long-bay-cruise/departures');
    expect(departures()).not.toHaveAttribute('aria-current');

    pathname = '/tours/ha-long-bay-cruise/departures';
    view.rerender(<TourWorkspaceHeader detail={detailFixture()} />);
    expect(departures()).toHaveAttribute('aria-current', 'page');
  });
});
```

  Chạy ba spec — đỏ.

- [ ] **B4. Cài — `lib/site.ts`:**

```ts
/**
 * Địa chỉ site khách (www). Admin chỉ LINK sang — một bản cho mọi chỗ: trang đăng
 * nhập, not-authorized, menu người dùng, phần đầu khu sửa tour.
 */
export const SITE_URL = 'https://www.nexora-travel.agency';

/** Trang tour trên site khách — chỉ mở được khi tour đang bán (tắt bán thì 404). */
export function tourPageUrl(slug: string): string {
  return `${SITE_URL}/tours/${encodeURIComponent(slug)}`;
}
```

  Rồi đổi bốn chỗ đang tự khai địa chỉ ấy sang import `SITE_URL` từ `@/lib/site`:
  - `components/nav-user.tsx:25`, `app/login/page.tsx:10`, `app/not-authorized/page.tsx:13`:
    xoá dòng `const SITE_URL = 'https://www.nexora-travel.agency';`, thêm
    `import { SITE_URL } from '@/lib/site';`;
  - `components/auth/login-form.tsx:16`: thay dòng khai bằng
    ``const FORGOT_PASSWORD_URL = `${SITE_URL}/forgot-password`;`` và thêm cùng import.

- [ ] **B5. Cài — thanh bước.** Tạo `tour-step-nav.tsx`:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tourism/ui/components/tooltip';
import { cn } from '@tourism/ui/lib/utils';
import { CheckIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { activeTourStep, type TourStepVM } from '@/lib/tour-editor-view';
import { STEP_ICONS } from './step-icons';

/**
 * Thanh bước của khu sửa tour (ADR-0049 §1): sáu icon chia đều một hàng, nối bằng vạch
 * mảnh. Tên bước và dòng trạng thái nằm trong tooltip VÀ trong chữ `sr-only` của link —
 * trình đọc màn hình và máy cảm ứng (không có tooltip) vẫn có tên thật của link.
 *
 * Link thật (`next/link`): hộp hỏi lại của `UnsavedChangesProvider` chặn nó ở pha
 * capture như mọi link. Trạng thái nhận từ nơi dùng (`tourSteps` trên bản ĐÃ LƯU); bước
 * đang mở đọc từ pathname — Departures không phải bước nên không bước nào sáng.
 */
const t = messages.admin.tours.editor;

export function TourStepNav({ slug, steps }: { slug: string; steps: readonly TourStepVM[] }) {
  const active = activeTourStep(usePathname(), slug);

  return (
    <TooltipProvider>
      <nav aria-label={t.tabsLabel} className="rounded-xl border bg-card px-4 py-3 sm:px-8">
        <ol className="flex items-center">
          {steps.map((step, index) => {
            const current = step.step === active;
            const last = index === steps.length - 1;
            const Icon = STEP_ICONS[step.step];
            return (
              <li key={step.step} className={cn('flex items-center', !last && 'flex-1')}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Link
                        href={step.href}
                        aria-current={current ? 'step' : undefined}
                        data-status={step.status}
                        className={cn(
                          'relative flex size-10 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground outline-none transition-colors hover:border-primary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                          step.status === 'optional' && 'border-dashed',
                          current &&
                            'border-primary bg-primary text-primary-foreground ring-4 ring-primary/15 hover:text-primary-foreground',
                        )}
                      />
                    }
                  >
                    <Icon aria-hidden="true" className="size-[18px]" />
                    <StepDot status={step.status} />
                    <span className="sr-only">{t.steps.stepLabel(step.title, step.summary)}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <span className="font-medium">{step.title}</span>
                    <span aria-hidden="true" className="opacity-70">
                      ·
                    </span>
                    <span>{step.summary}</span>
                  </TooltipContent>
                </Tooltip>
                {last ? null : (
                  <span aria-hidden="true" className="mx-2 h-px flex-1 bg-border sm:mx-3" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </TooltipProvider>
  );
}

/** Dấu góc dưới-phải: ✓ bước đủ, "!" bước thiếu. Trang trí — chữ `sr-only` đã nói trạng thái. */
function StepDot({ status }: { status: TourStepVM['status'] }) {
  const base =
    'absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border-2 border-card';
  if (status === 'ok') {
    return (
      <span aria-hidden="true" data-slot="step-dot" className={cn(base, 'bg-success text-success-foreground')}>
        <CheckIcon className="size-2.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === 'warn') {
    return (
      <span
        aria-hidden="true"
        data-slot="step-dot"
        className={cn(base, 'bg-warning text-[10px] font-bold text-warning-foreground')}
      >
        !
      </span>
    );
  }
  return null;
}
```

- [ ] **B6. Cài — phần đầu.** Viết lại `tour-workspace-header.tsx`:

```tsx
'use client';

import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { buttonVariants } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import { CalendarDaysIcon, ChevronLeftIcon, ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatDateTime } from '@/lib/bookings-view';
import { TOURS_LIST_HREF } from '@/lib/departures-query';
import { tourPageUrl } from '@/lib/site';
import { activeTourStep } from '@/lib/tour-editor-view';
import { departuresHref } from '@/lib/tours-query';

/**
 * Phần đầu khu sửa tour (ADR-0049 §4): chỉ còn TRẠNG THÁI, không còn điều khiển —
 * link về Tours, tên tour, đường dẫn và lần lưu cuối, chip On sale / Not on sale,
 * View on site và Departures.
 *
 * - Công tắc On sale dời xuống bước Review & publish (§3).
 * - View on site chỉ khi đang bán: tour tắt bán thì trang web 404.
 * - Departures không phải bước (§5): nút riêng, `aria-current="page"` ở trang của nó —
 *   đúng chỗ `activeTourStep` trả `null`, nên thanh bước và nút này không thể cùng sáng.
 */
const t = messages.admin.tours.editor;

export function TourWorkspaceHeader({ detail }: { detail: AdminTourDetail }) {
  const onDepartures = activeTourStep(usePathname(), detail.slug) === null;

  return (
    <div className="flex flex-col gap-3">
      <Link
        href={TOURS_LIST_HREF}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {t.back}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{detail.title}</h2>
          <p className="text-sm text-muted-foreground">
            /tours/{detail.slug} · {t.header.lastSaved(formatDateTime(detail.version))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-7 gap-1.5 px-2.5 text-sm">
            <span
              aria-hidden="true"
              className={cn(
                'size-2 rounded-full',
                detail.isPublished ? 'bg-success' : 'bg-muted-foreground',
              )}
            />
            {detail.isPublished ? t.header.onSale : t.header.offSale}
          </Badge>
          {detail.isPublished ? (
            <a
              href={tourPageUrl(detail.slug)}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline' })}
            >
              <ExternalLinkIcon aria-hidden="true" />
              {t.header.viewOnSite}
            </a>
          ) : null}
          <Link
            href={departuresHref(detail.slug)}
            aria-current={onDepartures ? 'page' : undefined}
            className={buttonVariants({ variant: 'outline' })}
          >
            <CalendarDaysIcon aria-hidden="true" />
            {t.tabs.departures}
          </Link>
        </div>
      </div>
    </div>
  );
}
```

  `h2` giữ nguyên class F17. Test B3 tra `getByText('/tours/… · Last saved …')`: dòng ấy
  là MỘT `<p>` gồm các mẩu chữ — Testing Library khớp theo `textContent` của `<p>`.

- [ ] **B7. Cài — ráp.** `tour-workspace-top.tsx` thành:

```tsx
'use client';

import { tourSteps } from '@/lib/tour-editor-view';
import { useWorkspaceDetail } from './tour-detail-context';
import { TourStepNav } from './tour-step-nav';
import { TourWorkspaceHeader } from './tour-workspace-header';

/**
 * Phần đầu dùng chung của khu sửa tour (ADR-0049 §4): phần đầu trạng thái, rồi thanh
 * bước.
 *
 * Đọc bản tour MỚI NHẤT từ `TourDetailProvider` chứ không từ props của layout (vòng
 * review F17): layout không render lại khi đổi bước, nên bản của nó có thể là bản trước
 * lần lưu vừa xong — thanh bước vì thế tích xanh ngay sau khi lưu.
 */
export function TourWorkspaceTop() {
  const detail = useWorkspaceDetail();
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <TourWorkspaceHeader detail={detail} />
      <TourStepNav slug={detail.slug} steps={tourSteps(detail)} />
    </div>
  );
}
```

  Trong `app/(admin)/tours/[slug]/layout.tsx`: xoá `import { setTourPublishedAction } from
  '../actions';`, đổi `<TourWorkspaceTop setPublished={setTourPublishedAction} />` thành
  `<TourWorkspaceTop />`, và sửa hai câu JSDoc đang tả phần đầu cũ: "phần đầu dùng chung
  cho năm tab — Back to tours · tên tour · công tắc On sale · khung readiness · thanh tab"
  → "phần đầu dùng chung cho sáu bước và Departures — Back to tours · tên tour · trạng
  thái · thanh bước (ADR-0049)"; "các trang con chỉ còn phần thân của tab" → "… phần thân
  của bước".

- [ ] **B8. Gỡ bộ tên tab.** Trong `lib/tour-editor-view.ts`:
  - xoá `TourEditorTab`, `TOUR_EDITOR_TABS`, `tourTabHref`, `activeTourTab`;
  - trong `readinessIssues`, ba chỗ `tourTabHref(slug, …)` thành `tourStepHref(slug, …)`;
    JSDoc field `href`: "Tab cần sửa" → "Bước cần sửa";
  - JSDoc đầu file: "đường của tab, danh sách thiếu của khung readiness" → "đường và trạng
    thái của bước, danh sách thiếu".

  `lib/tours-view.ts:5,80` và `components/tours/editor/new-tour-dialog.tsx:24,134`: đổi
  `tourTabHref` thành `tourStepHref` (import và chỗ gọi).

  `lib/tour-editor-view.spec.ts`: xoá khối `describe('tab của khu làm việc', …)`; bỏ
  `activeTourTab`, `TOUR_EDITOR_TABS`, `tourTabHref` khỏi import, thêm `TOUR_EDITOR_STEPS`;
  trong `describe('tab Photos và mục ảnh bìa (F18)')` đổi tên thành `'bước Photos và mục
  ảnh bìa (F18)'` và thay ca đầu bằng:

```ts
  it('Photos đứng ngay sau Details; Departures không phải bước', () => {
    expect(TOUR_EDITOR_STEPS).toEqual([
      'details',
      'photos',
      'itinerary',
      'content',
      'costs',
      'review',
    ]);
  });
```

  Xoá bốn file `tour-tabs.tsx`, `tour-tabs.spec.tsx`, `tour-readiness-panel.tsx`,
  `tour-readiness-panel.spec.tsx` bằng `git rm`.

- [ ] **B9. Copy.** Trong `messages.ts`:
  - `editor.readiness`: xoá `ready`, `readyBody` (kèm JSDoc của nó), `missingTitle` — không
    còn nơi dùng; giữ `summary`, `primaryDestination`, `days`, `cover`;
  - `editor.banners.notReady`: JSDoc "liệt kê chỗ thiếu như khung readiness" → "liệt kê chỗ
    thiếu như bước Review";
  - `tours.publish.workspace`: JSDoc khối → "Công tắc ở bước Review & publish của khu sửa
    tour (F19, ADR-0049 §3): người dùng đang ĐỨNG trong tour, nên không có "open it" hay
    "the list below" của bảng Tours."; JSDoc của `notReady` → "Công tắc chỉ bấm được khi
    danh sách kiểm tra nói "đủ", nên bị chặn tức trang đã cũ — trang tự tải lại và danh
    sách nói thiếu gì."; chữ `notReady` thành
    `'This tour is missing something it needs to go on sale — the checklist now shows what.'`
    (câu cũ nói "the list below": ở bước Review danh sách nằm bên TRÁI công tắc, màn hẹp
    thì bên TRÊN).

  Build lại i18n. `grep -rn "readyBody\|missingTitle\|readiness.ready\b" apps/admin/src libs/shared/i18n/src`
  phải rỗng.

- [ ] **B10. JSDoc `publish-toggle.tsx`** (không đổi code): "ở phần đầu khu làm việc tour
  (F17)" (dòng 20–21 và 38) → "ở bước Review & publish của khu sửa tour (F19)"; đoạn
  `placement="workspace"` (dòng 43–46): "ở phần đầu khu làm việc, công tắc chỉ bấm được khi
  khung readiness nói "đủ" … refresh cho khung nói thiếu gì" → "ở bước Review, công tắc chỉ
  bấm được khi danh sách kiểm tra nói "đủ" … refresh cho danh sách nói thiếu gì"; comment
  dòng 134–135 "nơi khung readiness nói thiếu gì" → "nơi thanh bước và bước Review nói
  thiếu gì".

- [ ] **B11.** Chạy ba spec mới cùng `tour-editor-view.spec.ts`, `tours-view.spec.ts`,
  `new-tour-dialog.spec.tsx`, `publish-toggle.spec.tsx` — xanh. Đột biến: bỏ `sr-only`
  label; `aria-current` luôn `'step'`; `activeTourStep` trả `'details'` thay `null` ở
  Departures (ca Departures của header VÀ của thanh bước cùng đỏ); bỏ điều kiện
  `detail.isPublished` của View on site; đổi `data-status` của bước tuỳ chọn.
- [ ] **B12.** `grep -rn "tourTabHref\|activeTourTab\|TOUR_EDITOR_TABS\|TourEditorTab\b\|TourTabs\|TourReadinessPanel" apps/admin/src`
  phải rỗng. Quy trình gate.
- [ ] **B13. Commit:** `feat(admin): thanh bước chỉ có icon, phần đầu chỉ còn trạng thái — bỏ hàng tab và khung readiness`
  (stage từng đường dẫn ở mục Files, kể cả bốn file đã `git rm`).

## Task 5 — Bước Details

**Files:**

- Modify: `apps/admin/src/lib/tour-editor-view.ts` (+ spec) — `tourCardPreview`
- Modify: `apps/admin/src/components/tours/editor/step-aside.tsx` (+ spec) — `TourCardPreview`
- Modify: `apps/admin/src/components/tours/editor/tour-details-form.tsx` (+ spec)
- Modify: `apps/admin/src/app/(admin)/tours/[slug]/page.tsx`
- Modify: `apps/admin/src/components/tours/editor/delete-tour-zone.tsx` (chỉ JSDoc)

**Interfaces:**

- Consumes: `EditorFormFrame` `aside`/`next` (Task 2); `StepChecklist`, `StepTips`,
  `CoverFrame`, `ChecklistItem` (Task 2); `tourStepHref` (Task 1); copy `aside.details`,
  `aside.preview`, `aside.required` (Task 1).
- Produces: `interface TourCardPreviewVM`, `tourCardPreview(detail, draft)`;
  `TourCardPreview({ preview })`. `TourDetailsForm` BỎ prop `remove`.

- [ ] **B1. Test đỏ — VM của thẻ xem trước.** Thêm vào `lib/tour-editor-view.spec.ts`
  (import thêm `tourCardPreview`; `COVER_PHOTO` từ `@/test/tour-detail`):

```ts
/**
 * Thẻ xem trước card /tours ở cột phải bước Details (spec F19 §2d.1): đọc giá trị ĐANG
 * GÕ, chữ và cách ghép giống card web (`tour-list-card.tsx`).
 */
describe('tourCardPreview', () => {
  const draft = {
    title: '  Ha Long Bay Cruise ',
    summary: 'Three days on the bay.',
    isFeatured: true,
    days: 3,
    groupSize: 12,
    basePrice: '199.00',
    primaryDestination: 'Hạ Long',
  };

  it('đọc bản đang gõ: tên cắt khoảng trắng, dữ kiện như card web, giá định dạng tiền', () => {
    expect(
      tourCardPreview(detailFixture({ ratingAvg: '4.66', ratingCount: 1280 }), draft),
    ).toEqual({
      coverUrl: COVER_PHOTO.url,
      title: 'Ha Long Bay Cruise',
      summary: 'Three days on the bay.',
      featured: true,
      facts: 'Hạ Long · 3 days · Max 12',
      rating: { value: '4.7', count: '1,280' },
      price: '$199.00',
    });
  });

  it('ô gõ dở thì bỏ mẩu ấy; giá chưa hợp lệ in "—"; tên trống là "Untitled tour"; chưa có ảnh', () => {
    const vm = tourCardPreview(detailFixture({ photos: [] }), {
      ...draft,
      title: '  ',
      days: Number.NaN,
      groupSize: 0,
      basePrice: '12.',
      primaryDestination: null,
    });
    expect(vm.title).toBe('Untitled tour');
    expect(vm.facts).toBe('');
    expect(vm.price).toBe('—');
    expect(vm.coverUrl).toBeNull();
    // Fixture gốc: chưa ai đánh giá (`ratingAvg: null`) — card web in "Not yet reviewed".
    expect(vm.rating).toBeNull();
  });

  it('một ngày đọc "1 day"; giá 0 không phải giá gốc hợp lệ', () => {
    const vm = tourCardPreview(detailFixture(), { ...draft, days: 1, basePrice: '0' });
    expect(vm.facts).toBe('Hạ Long · 1 day · Max 12');
    expect(vm.price).toBe('—');
  });
});
```

- [ ] **B2. Test đỏ — thẻ xem trước.** Thêm vào `step-aside.spec.tsx` (import thêm
  `TourCardPreview`; `import type { TourCardPreviewVM } from '@/lib/tour-editor-view';`):

```tsx
describe('TourCardPreview', () => {
  const tp = messages.toursPage;
  const PREVIEW: TourCardPreviewVM = {
    coverUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/x',
    title: 'Ha Long Bay Cruise',
    summary: 'Three days on the bay.',
    featured: true,
    facts: 'Hạ Long · 3 days · Max 12',
    rating: { value: '4.7', count: '128' },
    price: '$199.00',
  };

  it('Featured: chip trên ảnh kèm câu luật giảm giá; dữ kiện, tên, sao; giá GỐC kèm câu giải thích', () => {
    render(<TourCardPreview preview={PREVIEW} />);
    expect(screen.getByText(a.preview.title)).toBeInTheDocument();
    expect(screen.getByText(tp.featuredBadge)).toBeInTheDocument();
    expect(screen.getByText(a.preview.featuredNote)).toBeInTheDocument();
    expect(screen.getByText('Hạ Long · 3 days · Max 12')).toBeInTheDocument();
    expect(screen.getByText('Ha Long Bay Cruise')).toBeInTheDocument();
    expect(screen.getByText('4.7')).toBeInTheDocument();
    expect(screen.getByText('(128)')).toBeInTheDocument();
    expect(screen.getByText(a.preview.basePrice)).toBeInTheDocument();
    expect(screen.getByText('$199.00')).toBeInTheDocument();
    expect(screen.getByText(a.preview.priceNote)).toBeInTheDocument();
  });

  it('không Featured: không chip, không câu luật; chưa ai đánh giá: "Not yet reviewed"', () => {
    render(
      <TourCardPreview preview={{ ...PREVIEW, featured: false, rating: null }} />,
    );
    expect(screen.queryByText(tp.featuredBadge)).toBeNull();
    expect(screen.queryByText(a.preview.featuredNote)).toBeNull();
    expect(screen.getByText(tp.notRated)).toBeInTheDocument();
  });
});
```

- [ ] **B3. Test đỏ — form.** Trong `tour-details-form.spec.tsx`:
  - bỏ `DeleteTourAction` khỏi import; `renderForm` bỏ tham số `remove` và prop `remove`,
    trả `{ user, save }`; helper `form` của khối "không dựng lại form" bỏ `remove={vi.fn()}`;
  - JSDoc đầu file: "Tab Details (spec F17 §2h): ba khung, một nút Save, vùng xoá ở cuối."
    → "Bước Details (spec F17 §2h, F19 §2d.1): ba card, một nút Save, cột phải.";
  - thay ca `'nút Delete chỉ có khi tour chưa từng có booking'` bằng:

```tsx
  it('bước Details không còn vùng xoá tour — nó ở bước Review & publish', () => {
    renderForm(detailFixture({ bookingCount: 0 }));
    expect(screen.queryByRole('button', { name: e.delete.action })).not.toBeInTheDocument();
  });
```

  - thêm khối mới cuối file:

```tsx
describe('TourDetailsForm — bước Details (F19)', () => {
  const a = e.aside;
  const state = e.steps.state;
  const aside = () => screen.getByRole('complementary');

  it('"This step" tính trên giá trị ĐANG SOẠN: xoá tóm tắt là dòng ấy hết xanh ngay', async () => {
    const { user } = renderForm(detailFixture({ isPublished: false }));
    const rows = () => within(aside()).getAllByRole('listitem');
    expect(rows()[0]).toHaveTextContent(`${state.ok}${e.readiness.summary}${a.required}`);
    expect(rows()[1]).toHaveTextContent(`${state.ok}${e.readiness.primaryDestination}`);
    expect(rows()[2]).toHaveTextContent(`${state.optional}${a.details.sellingOptional}`);

    await user.clear(field(t.summary));

    expect(rows()[0]).toHaveTextContent(`${state.warn}${e.readiness.summary}`);
  });

  it('thẻ xem trước theo ô đang gõ: tên mới; tích Featured là chip hiện kèm câu luật', async () => {
    const { user } = renderForm();
    expect(within(aside()).getByText('Hạ Long · 3 days · Max 12')).toBeInTheDocument();
    expect(within(aside()).queryByText(messages.toursPage.featuredBadge)).toBeNull();

    await user.clear(field(t.title));
    await user.type(field(t.title), 'Lan Ha Bay Escape');
    await user.click(screen.getByRole('checkbox', { name: t.featured }));

    expect(within(aside()).getByText('Lan Ha Bay Escape')).toBeInTheDocument();
    expect(within(aside()).getByText(messages.toursPage.featuredBadge)).toBeInTheDocument();
    expect(within(aside()).getByText(a.preview.featuredNote)).toBeInTheDocument();
  });

  it('câu gợi ý của Good for và Badges đứng NGOÀI nhóm (lưới 2×2), sau nhóm của nó', () => {
    renderForm();
    const goodFor = screen.getByRole('group', { name: t.suitableFor });
    const goodForHint = screen.getByText(t.suitableForHint);
    const badges = screen.getByRole('group', { name: t.badges });
    expect(goodFor.contains(goodForHint)).toBe(false);
    expect(goodFor.compareDocumentPosition(goodForHint)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(goodForHint.compareDocumentPosition(badges)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(badges.contains(screen.getByText(t.badgesHint))).toBe(false);
  });

  it('chân form: link Next: Photos', () => {
    renderForm();
    expect(screen.getByRole('link', { name: e.next(e.tabs.photos) })).toHaveAttribute(
      'href',
      '/tours/ha-long-bay-cruise/photos',
    );
  });
});
```

  Ca "Good for, Badges và Featured có chú thích…" (`toHaveAccessibleDescription`) và ca
  "ô tóm tắt và khung điểm đến mang id…" GIỮ NGUYÊN — chúng canh `aria-describedby` và
  hai đích link readiness sau khi đổi `fieldset` thành `Card`.

  Chạy ba spec — đỏ.

- [ ] **B4. Cài — VM.** Trong `lib/tour-editor-view.ts` import thêm `TourBasePriceSchema`
  từ `@tourism/contract` và `formatAmount` từ `./bookings-view`, rồi thêm cuối file:

```ts
/** Thẻ xem trước card /tours ở cột phải bước Details (spec F19 §2d.1). */
export interface TourCardPreviewVM {
  coverUrl: string | null;
  title: string;
  summary: string;
  featured: boolean;
  /** "Hạ Long · 3 days · Max 12" — như băng dữ kiện của card web; mẩu đang gõ dở thì bỏ. */
  facts: string;
  /** Sao như card web: "4.7" và "(1,280)"; `null` = chưa ai đánh giá (KHÁC 0). */
  rating: { value: string; count: string } | null;
  /** Giá gốc ĐANG GÕ, định dạng tiền; chưa thành giá gốc hợp lệ thì "—" (không in NaN). */
  price: string;
}

/**
 * Card /tours của tour với giá trị ĐANG GÕ ở bước Details — chữ lấy từ
 * `messages.toursPage` như card web. `days`, `groupSize` là số đã parse (`NaN` khi ô
 * gõ dở); nhận số chứ không nhận chữ vì `parseWholeNumber` nằm ở `tour-editor-write`,
 * mà file đó đã import file này.
 */
export function tourCardPreview(
  detail: Pick<AdminTourDetail, 'photos' | 'ratingAvg' | 'ratingCount' | 'currency'>,
  draft: {
    title: string;
    summary: string;
    isFeatured: boolean;
    days: number;
    groupSize: number;
    basePrice: string;
    primaryDestination: string | null;
  },
): TourCardPreviewVM {
  const tp = messages.toursPage;
  const title = draft.title.trim();
  const price = draft.basePrice.trim();
  return {
    coverUrl: detail.photos[0]?.url ?? null,
    title: title === '' ? t.aside.preview.untitled : title,
    summary: draft.summary.trim(),
    featured: draft.isFeatured,
    facts: [
      draft.primaryDestination,
      draft.days > 0 ? tp.durationValue(draft.days) : null,
      draft.groupSize > 0 ? tp.maxGroup(draft.groupSize) : null,
    ]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · '),
    // `ratingAvg` của contract là chuỗi thập phân ("4.66"), không phải số như ở web.
    rating:
      detail.ratingAvg === null
        ? null
        : {
            value: Number(detail.ratingAvg).toFixed(1),
            count: detail.ratingCount.toLocaleString('en-US'),
          },
    price: TourBasePriceSchema.safeParse(price).success ? formatAmount(price, detail.currency) : '—',
  };
}
```

  (`NaN > 0` là `false` nên ô gõ dở tự rơi khỏi `facts`. `bookings-view` không import
  file này — không có vòng import.)

- [ ] **B5. Cài — thẻ xem trước.** Trong `step-aside.tsx` import thêm `StarIcon` (lucide)
  và `type TourCardPreviewVM` (cùng dòng import `tourPhotoThumb`), rồi thêm:

```tsx
/**
 * Thẻ xem trước card /tours (spec F19 §2d.1) — bám `tour-list-card.tsx` của web, dùng
 * lại chữ của nó. Hai chỗ khác card thật đều nói ra bằng chữ: giá là giá GỐC (card web
 * in giá chuyến rẻ nhất sắp tới — admin không có số ấy), và chip Featured nhường chỗ cho
 * chip giảm giá.
 */
export function TourCardPreview({ preview }: { preview: TourCardPreviewVM }) {
  const tp = messages.toursPage;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{a.preview.title}</CardTitle>
        <CardDescription>{a.preview.body}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <CoverFrame url={preview.coverUrl}>
          {preview.featured ? (
            <span className="absolute top-2 left-2 inline-flex h-5 items-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
              {tp.featuredBadge}
            </span>
          ) : null}
        </CoverFrame>
        {preview.featured ? (
          <p className="text-xs text-muted-foreground">{a.preview.featuredNote}</p>
        ) : null}
        {preview.facts ? (
          <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {preview.facts}
          </p>
        ) : null}
        <p className="truncate font-heading text-base font-medium">{preview.title}</p>
        {/* Giữ chỗ 2 dòng như card web: tóm tắt rỗng không làm thẻ co lại. */}
        <p className="line-clamp-2 h-[2lh] text-xs text-muted-foreground">{preview.summary}</p>
        <p className="flex items-center gap-1.5 text-xs">
          {preview.rating === null ? (
            <span className="text-muted-foreground">{tp.notRated}</span>
          ) : (
            <>
              <StarIcon aria-hidden="true" className="size-3.5 fill-rating text-rating" />
              <span className="font-semibold">{preview.rating.value}</span>
              <span className="text-muted-foreground">({preview.rating.count})</span>
            </>
          )}
        </p>
        <div className="flex items-baseline justify-between gap-2 border-t pt-2">
          <span className="text-xs text-muted-foreground">{a.preview.basePrice}</span>
          <span className="text-sm font-semibold tabular-nums">{preview.price}</span>
        </div>
        <p className="text-xs text-muted-foreground">{a.preview.priceNote}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **B6. Cài — form.** Trong `tour-details-form.tsx`:
  1. **Import:** bỏ `DeleteTourZone`, `DeleteTourAction`; thêm `Card, CardContent,
     CardDescription, CardHeader, CardTitle` từ `@tourism/ui/components/card`, `cn` từ
     `@tourism/ui/lib/utils`, `type ChecklistItem, StepChecklist, StepTips,
     TourCardPreview` từ `@/components/tours/editor/step-aside`; thêm `tourCardPreview`,
     `tourStepHref` vào import `@/lib/tour-editor-view`.
  2. **Props:** bỏ `remove` ở cả chữ ký lẫn kiểu. Thêm `const a = e.aside;` dưới `const fe`.
  3. **JSDoc đầu component** → "Bước Details (spec F17 §2h, F19 §2d.1): ba card — Basics,
     Destinations, Selling points — một nút Save; cột phải là việc cần làm của bước (tính
     trên giá trị ĐANG SOẠN), thẻ xem trước card /tours và gợi ý. Vùng xoá tour ở bước
     Review & publish." (đoạn thứ hai về `detail` đọc từ PROPS giữ nguyên).
  4. **Cột phải** — ngay trước `return (`:

```tsx
  // Cột phải đọc giá trị ĐANG SOẠN (ADR-0049 §6) — thanh bước mới đọc bản đã lưu. Dòng
  // điểm đến chưa chọn không tính: Save sẽ chặn nó bằng "Choose a destination.".
  const draftReadiness = projectedReadiness(detail, {
    summary: values.summary,
    destinations: values.destinations.filter((line) => line.destinationId !== ''),
  });
  const checklist: ChecklistItem[] = [
    {
      key: 'summary',
      label: e.readiness.summary,
      detail: a.required,
      state: draftReadiness.summary ? 'ok' : 'warn',
    },
    {
      key: 'primaryDestination',
      label: e.readiness.primaryDestination,
      detail: a.required,
      state: draftReadiness.primaryDestination ? 'ok' : 'warn',
    },
    {
      key: 'selling',
      label: a.details.sellingOptional,
      detail: a.details.shownWhenFilled,
      state: 'optional',
    },
  ];
  const primaryId = values.destinations.find((line) => line.isPrimary)?.destinationId;
  const preview = tourCardPreview(detail, {
    title: values.title,
    summary: values.summary,
    isFeatured: values.isFeatured,
    days,
    groupSize: parseWholeNumber(values.maxGroupSize),
    basePrice: values.basePrice,
    primaryDestination:
      options.destinations.find((option) => option.id === primaryId)?.name ?? null,
  });
```

  5. **Khung:** `EditorFormFrame` thêm hai prop:

```tsx
        aside={
          <>
            <StepChecklist items={checklist} />
            <TourCardPreview preview={preview} />
            <StepTips items={a.details.tips} />
          </>
        }
        next={{ href: tourStepHref(detail.slug, 'photos'), label: e.tabs.photos }}
```

  6. **Card Basics** thay `<fieldset className="grid gap-4 rounded-lg border p-4">` + `<legend>`:

```tsx
        <Card>
          <CardHeader>
            <CardTitle>{t.sections.basics}</CardTitle>
            <CardDescription>{a.details.basicsBody}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {/* thứ tự: ô tour-title · ô tour-summary · hàng 2 cột category | difficulty ·
                hàng 3 cột duration | group | price · câu daysRemoved · ô tour-featured */}
          </CardContent>
        </Card>
```

     Bên trong `CardContent` là NGUYÊN các khối đang có, không sửa một prop: `FormField
     id="tour-title"`, `FormField id="tour-summary"`, `div.grid.sm:grid-cols-2` (category,
     difficulty), `div.grid.sm:grid-cols-3` (duration, group, price), khối
     `removed.length > 0 ? <p aria-live="polite">…` — rồi mới đến `CheckboxRow
     id="tour-featured"` (dời từ trước hàng số xuống cuối, theo spec §2d.1; câu
     daysRemoved đứng sát hàng số vì nó nói về ô Days).
  7. **Card Destinations** thay `<fieldset id="tour-destinations" …>` + `<legend>` + `<p>`
     gợi ý:

```tsx
        <Card id="tour-destinations">
          <CardHeader>
            <CardTitle>{t.sections.destinations}</CardTitle>
            <CardDescription>{t.destinationsHint}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {/* khối errors.destinations (role="alert"), comment về radio GỐC và nguyên
                ListEditor<DestinationDraft> — giữ nguyên */}
          </CardContent>
        </Card>
```

     `id="tour-destinations"` nằm trên `Card` — đích link readiness (bài học 5).
  8. **Card Selling points** thay `<fieldset className="grid gap-5 …">` + `<legend>`:

```tsx
        <Card>
          <CardHeader>
            <CardTitle>{t.sections.selling}</CardTitle>
            <CardDescription>{a.details.sellingBody}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {/* Lưới 2 cột × 2 hàng từ lg (spec F19 §2d.1): hàng trên hai nhóm ô tích, hàng
                dưới hai câu gợi ý — hai câu luôn cùng một hàng dù hai nhóm cao khác nhau.
                Thứ tự DOM vẫn là nhóm → câu của nó, nên màn hẹp một cột đọc đúng. */}
            <div className="grid gap-x-8 gap-y-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <CheckboxGroup
                id="tour-suitable-for"
                /* label, hint, options, selected, disabled, onChange: giữ nguyên */
                className="lg:col-start-1 lg:row-start-1"
                hintClassName="mb-4 lg:col-start-1 lg:row-start-2 lg:mb-0"
              />
              <CheckboxGroup
                id="tour-badges"
                /* label, hint, options, selected, disabled, onChange: giữ nguyên */
                className="lg:col-start-2 lg:row-start-1"
                hintClassName="lg:col-start-2 lg:row-start-2"
              />
            </div>
            {/* LineList id="tour-highlights" — giữ nguyên */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* LineList id="tour-included" và LineList id="tour-excluded" — giữ nguyên */}
            </div>
            {/* FormField id="tour-meeting-point" và khối "Notes under the four fact cards" — giữ nguyên */}
          </CardContent>
        </Card>
```

     (Comment `/* … giữ nguyên */` trong khối trên là CHỈ DẪN của plan, không chép vào code:
     thay mỗi comment ấy bằng đúng khối JSX đang có.)
  9. **`CheckboxGroup`** — thay trọn hàm:

```tsx
/** Nhóm ô tích cho một mảng enum (đối tượng khách, huy hiệu) — không bao giờ gửi trùng. */
function CheckboxGroup<Value extends string>({
  id,
  label,
  hint,
  options,
  selected,
  disabled,
  onChange,
  className,
  hintClassName,
}: {
  id: string;
  label: string;
  /** Câu dưới cả nhóm nói nhóm ấy hiện ở đâu trên web (thử tay F17). */
  hint?: string;
  options: readonly { value: Value; label: string; description?: string }[];
  selected: readonly Value[];
  disabled: boolean;
  onChange: (next: Value[]) => void;
  /** Chỗ của nhóm và của câu gợi ý trong lưới của nơi dùng (bước Details: lưới 2×2). */
  className?: string;
  hintClassName?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  // Ô có chú thích riêng thì cao hai dòng — hai cột cho các cột thẳng nhau; ô chỉ có
  // nhãn thì mỗi ô một hàng (spec F19 §2d.1).
  const described = options.some((option) => option.description !== undefined);
  return (
    <>
      {/* `fieldset` + `legend` là nhóm có tên sẵn của HTML — không cần `role="group"`.
          `min-w-0`: fieldset mặc định `min-width: min-content`, làm hàng ô tích tràn ngang. */}
      <fieldset className={cn('min-w-0', className)} aria-describedby={hintId}>
        <legend className="mb-2 text-sm font-medium">{label}</legend>
        <div className={described ? 'grid gap-x-5 gap-y-3 sm:grid-cols-2' : 'grid gap-2'}>
          {options.map((option) => (
            <CheckboxRow
              key={option.value}
              id={`${id}-${option.value}`}
              label={option.label}
              description={option.description}
              checked={selected.includes(option.value)}
              disabled={disabled}
              onChange={(checked) =>
                onChange(
                  checked
                    ? // Giữ thứ tự của danh sách chọn, không phải thứ tự bấm.
                      options
                        .map((item) => item.value)
                        .filter((value) => value === option.value || selected.includes(value))
                    : selected.filter((value) => value !== option.value),
                )
              }
            />
          ))}
        </div>
      </fieldset>
      {/* Câu gợi ý đứng NGOÀI fieldset để nơi dùng xếp nó vào hàng riêng của lưới; nó vẫn
          là mô tả của nhóm qua `aria-describedby`. */}
      {hint ? (
        <p id={hintId} className={cn('text-xs text-muted-foreground', hintClassName)}>
          {hint}
        </p>
      ) : null}
    </>
  );
}
```

  10. **Cuối JSX:** xoá dòng `{detail.bookingCount === 0 ? <DeleteTourZone … /> : null}`.
  11. **`app/(admin)/tours/[slug]/page.tsx`:** import chỉ còn `updateTourDetailsAction`;
      bỏ `remove={deleteTourAction}`; JSDoc "Tab Details của khu làm việc (spec F17 §2h)"
      → "Bước Details của khu sửa tour (spec F17 §2h, F19)".
  12. **`delete-tour-zone.tsx`:** JSDoc "Vùng xoá tour ở cuối tab Details (spec F17 §2d)"
      → "Vùng xoá tour ở bước Review & publish (spec F17 §2d, F19 §2d.6)".

- [ ] **B7.** Chạy `tour-editor-view.spec.ts`, `step-aside.spec.tsx`,
  `tour-details-form.spec.tsx` — xanh, kể cả MỌI ca cũ. Đột biến: checklist đọc
  `detail.readiness` thay `draftReadiness` (ca "This step" đỏ); preview đọc `detail.title`
  (ca thẻ xem trước đỏ); đưa câu gợi ý vào lại trong `fieldset` (ca lưới đỏ); bỏ
  `.trim()` của tên trong `tourCardPreview`; đổi thứ tự `facts`.
- [ ] **B8.** Quy trình gate.
- [ ] **B9. Commit:** `feat(admin): bước Details hai cột — card, việc cần làm tính khi gõ, thẻ xem trước card /tours`

## Task 6 — Bước Photos

**Files:**

- Modify: `apps/admin/src/components/tours/editor/tour-photos-form.tsx` (+ spec)
- Modify: `apps/admin/src/app/(admin)/tours/[slug]/photos/page.tsx` (chỉ JSDoc)

**Interfaces:**

- Consumes: `EditorFormFrame` `aside`/`next`/`note` (Task 2); `StepChecklist`, `StepTips`,
  `CoverPreviewCard`, `ChecklistItem` (Task 2); copy `aside.photos` (Task 1).
- Produces: không có tên mới.

Form F18 CHỈ xếp lại bố cục: mọi logic tải lên, thư viện, lỗi, `emptyFocus`, Make cover
→ ô alt giữ nguyên (bài học 7). Đọc lại bản đã merge trước khi sửa — review F18 có thể đã
đổi form này (xem "Điều kiện bắt đầu").

- [ ] **B1. Test đỏ.** Thêm vào `tour-photos-form.spec.tsx` (import thêm `within` từ
  `@testing-library/react`):

```tsx
describe('TourPhotosForm — bước Photos (F19)', () => {
  const a = e.aside;
  const state = e.steps.state;
  const aside = () => screen.getByRole('complementary');
  const THIRD = {
    ...COVER_PHOTO,
    publicId: 'tourism/catalog/destination/ha-long/3',
    url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1700000000/tourism/catalog/destination/ha-long/3',
    alt: 'A cave lit in blue',
  };

  it('vùng thả file bọc cả hai nút lẫn danh sách; bộ đếm ở góc card', () => {
    renderForm();
    const zone = screen.getByTestId('photo-drop-zone');
    expect(within(zone).getByRole('button', { name: t.upload })).toBeInTheDocument();
    expect(within(zone).getByRole('button', { name: t.library })).toBeInTheDocument();
    expect(within(zone).getAllByRole('textbox', { name: t.alt })).toHaveLength(2);
    expect(screen.getByText(t.count(2, 30)).closest('[data-slot="card-action"]')).not.toBeNull();
  });

  it('cột phải theo danh sách ĐANG SOẠN: xoá một alt là dòng alt báo 1 ảnh còn thiếu', async () => {
    const { user } = renderForm();
    const rows = () => within(aside()).getAllByRole('listitem');
    expect(rows()[0]).toHaveTextContent(`${state.ok}${e.readiness.cover}${a.required}`);
    expect(rows()[1]).toHaveTextContent(`${state.ok}${a.photos.altAll}${a.photos.altDone}`);

    await user.clear(altInputs()[1] as HTMLElement);

    expect(rows()[1]).toHaveTextContent(`${state.warn}${a.photos.altAll}${a.photos.altMissing(1)}`);
  });

  it('Make cover: ảnh bìa ở cột phải đổi theo ngay, trước khi lưu', async () => {
    const { user } = renderForm(detailFixture({ photos: [COVER_PHOTO, THIRD] }));
    const cover = () => aside().querySelector('img')?.getAttribute('src');
    expect(cover()).toContain('/tourism/catalog/tour/ha-long');

    await user.click(screen.getByRole('button', { name: t.makeCoverFor(t.photoName(2)) }));

    expect(cover()).toContain('/destination/ha-long/3');
  });

  it('chân form: câu hệ quả của lần lưu và link Next: Itinerary', () => {
    renderForm();
    expect(screen.getByText(a.photos.saveNote)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: e.next(e.tabs.itinerary) })).toHaveAttribute(
      'href',
      '/tours/ha-long-bay-cruise/itinerary',
    );
  });
});
```

  Đổi JSDoc đầu file spec "Tab Photos (spec F18 §2g, ADR-0048)." → "Bước Photos (spec F18
  §2g, F19 §2d.2).". Chạy — đỏ.

- [ ] **B2. Cài.** Trong `tour-photos-form.tsx`:
  1. **Import:** thêm `Card, CardAction, CardContent, CardDescription, CardHeader,
     CardTitle` từ `@tourism/ui/components/card`; `ImageIcon` vào dòng lucide; `type
     ChecklistItem, CoverPreviewCard, StepChecklist, StepTips` từ
     `@/components/tours/editor/step-aside`; `tourStepHref` vào import
     `@/lib/tour-editor-view`. Thêm `const e = messages.admin.tours.editor;` và
     `const a = e.aside;` cạnh `const t` (rồi đổi `const t = messages.admin.tours.editor.photos`
     thành `const t = e.photos`).
  2. **Cột phải** — ngay trước `return (`:

```tsx
  // Cột phải đọc danh sách ĐANG SOẠN (ADR-0049 §6): ảnh đầu là ảnh bìa, alt bắt buộc
  // để lưu (`validatePhotosForm`).
  const altMissing = values.photos.filter((photo) => photo.alt.trim() === '').length;
  const checklist: ChecklistItem[] = [
    {
      key: 'cover',
      label: e.readiness.cover,
      detail: a.required,
      state: values.photos.length > 0 ? 'ok' : 'warn',
    },
    {
      key: 'alt',
      label: a.photos.altAll,
      detail: altMissing === 0 ? a.photos.altDone : a.photos.altMissing(altMissing),
      state: altMissing === 0 ? 'ok' : 'warn',
    },
  ];
```

  3. **Khung:** `EditorFormFrame` thêm `note={a.photos.saveNote}` (hiện khi không có
     `blockedNote` — luật sẵn có của khung), và:

```tsx
        aside={
          <>
            <StepChecklist items={checklist} />
            <CoverPreviewCard url={values.photos[0]?.url ?? null} />
            <StepTips items={a.photos.tips} />
          </>
        }
        next={{ href: tourStepHref(detail.slug, 'itinerary'), label: e.tabs.itinerary }}
```

  4. **Thân:** thay `<section className="grid gap-4">…</section>` bằng:

```tsx
        <Card>
          <CardHeader>
            <CardTitle>{e.tabs.photos}</CardTitle>
            <CardDescription>{t.intro}</CardDescription>
            <CardAction>
              <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                {t.count(values.photos.length, TOUR_PHOTOS_MAX)}
              </p>
            </CardAction>
          </CardHeader>
          <CardContent>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: vùng thả file chỉ là đường tắt cho chuột — bàn phím và trình đọc màn hình dùng nút Upload photos */}
            <div
              data-testid="photo-drop-zone"
              className="grid gap-4"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void startUploads([...event.dataTransfer.files]);
              }}
            >
              {/* Vùng thả file bọc CẢ ô tải lên lẫn danh sách (spec F19 §2d.2): thả vào đâu
                  trong card cũng tải lên. */}
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center">
                <ImageIcon aria-hidden="true" className="size-6 text-muted-foreground" />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {/* Button Upload photos (ref={uploadButton}), <input type="file"> ẩn,
                      Button Add from library — nguyên ba khối đang có, không đổi prop */}
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.photos.drop} {t.formats}
                </p>
              </div>
              {/* notices (role="status"), errors.list (role="alert"), ListEditor<PhotoDraft>
                  và uploads.map(…) — nguyên các khối đang có, đúng thứ tự ấy */}
            </div>
          </CardContent>
        </Card>
```

     (Comment `{/* … */}` mang chữ "nguyên … đang có" là chỉ dẫn của plan: thay bằng đúng
     khối JSX hiện có. Dòng `<p>{t.intro} {t.formats}</p>` cũ và `<p aria-live>` bộ đếm cũ
     bỏ — hai câu ấy đã sang `CardDescription` và `CardAction`.) Hai nút giữ
     `variant="outline"` (quyết định 5).
  5. JSDoc đầu component: "Tab Photos (spec F18 §2g, ADR-0048)" → "Bước Photos (spec F18
     §2g, F19 §2d.2)"; gạch đầu dòng "Ảnh vào danh sách bằng hai đường ở thanh trên" →
     "… ở ô tải lên đầu card". `photos/page.tsx`: "Tab Photos của khu làm việc" → "Bước
     Photos của khu sửa tour".

- [ ] **B3.** Chạy spec Photos — xanh, kể cả MỌI ca F18 (tiêu điểm về Upload photos khi gỡ
  dòng cuối, Make cover → ô alt, kéo thả). Đột biến: `CoverPreviewCard` đọc
  `detail.photos[0]` (ca Make cover đỏ); dòng alt luôn `'ok'`; đưa vùng thả về chỉ bọc
  danh sách (ca vùng thả đỏ); bỏ `note`.
- [ ] **B4.** Quy trình gate.
- [ ] **B5. Commit:** `feat(admin): bước Photos hai cột — ô tải lên nét đứt, việc cần làm và ảnh bìa bên phải`

## Task 7 — Bước Itinerary

**Files:**

- Modify: `apps/admin/src/components/tours/editor/tour-itinerary-form.tsx` (+ spec)
- Modify: `apps/admin/src/app/(admin)/tours/[slug]/itinerary/page.tsx` (chỉ JSDoc)

**Interfaces:**

- Consumes: `EditorFormFrame` `lead`/`aside`/`next` (Task 2); `StateMark` (Task 2); copy
  `aside.itinerary` (Task 1).
- Produces: không có tên mới.

- [ ] **B1. Test đỏ.** Thêm vào `tour-itinerary-form.spec.tsx` (import thêm `within` nếu
  chưa có):

```tsx
describe('TourItineraryForm — bước Itinerary (F19)', () => {
  const a = e.aside;
  const state = e.steps.state;
  const days = () => within(screen.getByRole('complementary'));

  it('câu giới thiệu là `lead`: ngoài form, đứng trước form', () => {
    renderForm();
    const intro = screen.getByText(t.intro(3));
    expect(intro.closest('form')).toBeNull();
    expect(intro.compareDocumentPosition(dayCard(1))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('ngày chưa có tiêu đề: nhãn trên thẻ và dấu "!" ở danh mục Days; gõ tiêu đề là hết ngay', async () => {
    const { user } = renderForm(
      offSale({ itinerary: [{ dayNumber: 1, title: 'Board the boat', description: null }] }),
    );
    expect(within(dayCard(2)).getByText(a.itinerary.needed)).toBeInTheDocument();
    expect(within(dayCard(1)).queryByText(a.itinerary.needed)).toBeNull();
    expect(
      days().getByRole('link', { name: `${t.day(1)} · Board the boat ${state.ok}` }),
    ).toHaveAttribute('href', '#day-1');
    expect(days().getByRole('link', { name: `${t.day(2)} ${state.warn}` })).toHaveAttribute(
      'href',
      '#day-2',
    );

    await user.type(dayTitle(2), 'Kayak the lagoons');

    expect(within(dayCard(2)).queryByText(a.itinerary.needed)).toBeNull();
    expect(
      days().getByRole('link', { name: `${t.day(2)} · Kayak the lagoons ${state.ok}` }),
    ).toBeInTheDocument();
  });

  it('chân form: link Next: FAQ & policies', () => {
    renderForm();
    expect(screen.getByRole('link', { name: e.next(e.tabs.content) })).toHaveAttribute(
      'href',
      '/tours/ha-long-bay-cruise/content',
    );
  });
});
```

  Ca cũ `'tour 3 ngày: ba thẻ Day 1…3 mang id="day-N"…'` GIỮ NGUYÊN: nó tra thẻ bằng
  `getByRole('group', { name: 'Day N' })` và kiểm `id="day-N"` — đích link readiness.
  Chạy — đỏ.

- [ ] **B2. Cài.** Trong `tour-itinerary-form.tsx`:
  1. **Import:** `Badge` từ `@tourism/ui/components/badge`; `Card, CardAction, CardContent,
     CardDescription, CardHeader, CardTitle` từ `@tourism/ui/components/card`; `cn` từ
     `@tourism/ui/lib/utils`; `StateMark` từ `@/components/tours/editor/step-aside`;
     `tourStepHref` vào import `@/lib/tour-editor-view`. Thêm `const e =
     messages.admin.tours.editor;` và `const a = e.aside;`, rồi `const t = e.itinerary;`.
  2. **Cột phải** — ngay trước `return (`:

```tsx
  // Danh mục ngày đọc giá trị ĐANG SOẠN (ADR-0049 §6): ngày không tiêu đề thì không
  // thành hàng khi lưu (spec F17 §2b.3), nên nó là ngày còn thiếu.
  const aside = (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{a.itinerary.daysTitle}</CardTitle>
        <CardDescription>{a.itinerary.daysBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1">
          {values.days.map((day, index) => {
            const n = index + 1;
            const title = day.title.trim();
            return (
              <li key={n}>
                {/* Link cùng trang (#day-N): hộp hỏi lại không chặn khi chỉ đổi hash. */}
                <a
                  href={`#day-${n}`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="truncate">
                    {title === '' ? t.day(n) : `${t.day(n)} · ${title}`}
                  </span>{' '}
                  <StateMark state={title === '' ? 'warn' : 'ok'} />
                </a>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
```

     (`{' '}` giữa hai phần là chủ ý: tên đọc-màn-hình của link thành "Day 2 Needs
     attention" thay vì "Day 2Needs attention"; khoảng trắng giữa hai phần tử flex không
     chiếm chỗ.)
  3. **Khung:** `EditorFormFrame` thêm:

```tsx
        lead={<p className="text-sm text-muted-foreground">{t.intro(detail.durationDays)}</p>}
        aside={aside}
        next={{ href: tourStepHref(detail.slug, 'content'), label: e.tabs.content }}
```

     và xoá dòng `<p className="text-sm text-muted-foreground">{t.intro(…)}</p>` khỏi
     children (câu ấy giờ là `lead`: một hàng riêng trải hết bề ngang, nên khung Days bên
     phải bắt đầu ngang hàng Day 1 — góp ý của user ở mockup).
  4. **Thẻ ngày** — thay `<fieldset key={n} id={`day-${n}`} …>` + `<legend>`:

```tsx
            // Thẻ ngày cố định theo vị trí (ngày thứ n) — không thêm/xoá/dời, nên
            // số ngày làm key là đúng. `role="group"` + tên "Day N": thẻ gom hai ô của
            // một ngày (Card của kit là <div>); `id="day-N"` là đích link readiness.
            <Card
              key={n}
              id={`day-${n}`}
              role="group"
              aria-labelledby={`day-${n}-heading`}
              className={cn(missing && 'ring-warning/60')}
            >
              <CardHeader>
                <CardTitle id={`day-${n}-heading`}>{t.day(n)}</CardTitle>
                {missing ? (
                  <CardAction>
                    <Badge
                      variant="outline"
                      className="border-warning/60 bg-warning/10 text-foreground"
                    >
                      {a.itinerary.needed}
                    </Badge>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="grid gap-4">
                {/* hai FormField day-N-title và day-N-description — nguyên như đang có */}
              </CardContent>
            </Card>
```

     với `const missing = day.title.trim() === '';` khai cạnh `const dayErrors`. (Comment
     `{/* … nguyên như đang có */}` là chỉ dẫn của plan: thay bằng đúng hai khối FormField
     hiện có.)
  5. JSDoc đầu component: "Tab Itinerary (spec F17 §2h)" → "Bước Itinerary (spec F17 §2h,
     F19 §2d.3)"; gạch đầu dòng về `id="day-N"`: "đích của link … trong khung readiness" →
     "… ở bước Review và danh mục Days". `itinerary/page.tsx`: "Tab Itinerary" → "Bước
     Itinerary".

- [ ] **B3.** Chạy spec — xanh, kể cả mọi ca cũ. Đột biến: bỏ `role="group"` (ca cũ tra thẻ
  đỏ); bỏ `id` của thẻ; danh mục Days đọc `detail.itinerary` thay `values.days` (ca gõ
  tiêu đề đỏ); bỏ `{' '}`; trả câu giới thiệu vào children.
- [ ] **B4.** Quy trình gate.
- [ ] **B5. Commit:** `feat(admin): bước Itinerary — thẻ ngày, danh mục Days dính bên phải`

## Task 8 — Bước FAQ & policies

**Files:**

- Modify: `apps/admin/src/components/tours/editor/tour-content-form.tsx` (+ spec)
- Modify: `apps/admin/src/app/(admin)/tours/[slug]/content/page.tsx` (chỉ JSDoc)

**Interfaces:**

- Consumes: `EditorFormFrame` `aside`/`next` (Task 2); copy `aside.content`,
  `aside.onThisStep`, `aside.optionalStep` (Task 1).
- Produces: không có tên mới.

- [ ] **B1. Test đỏ.** Thêm vào `tour-content-form.spec.tsx` (import thêm `within`):

```tsx
describe('TourContentForm — bước FAQ & policies (F19)', () => {
  const a = e.aside;
  const aside = () => within(screen.getByRole('complementary'));

  it('hai card mang id="faq" và id="policies"; cột phải đếm theo danh sách ĐANG SOẠN', async () => {
    const { user } = renderForm();
    expect(document.getElementById('faq')).toHaveTextContent(t.faqTitle);
    expect(document.getElementById('policies')).toHaveTextContent(t.policiesTitle);
    expect(
      aside().getByRole('link', { name: `${t.faqTitle} ${a.content.faqCount(0)}` }),
    ).toHaveAttribute('href', '#faq');
    expect(
      aside().getByRole('link', { name: `${t.policiesTitle} ${a.content.policyCount(0)}` }),
    ).toHaveAttribute('href', '#policies');

    await user.click(screen.getByRole('button', { name: t.addFaq }));

    expect(
      aside().getByRole('link', { name: `${t.faqTitle} ${a.content.faqCount(1)}` }),
    ).toBeInTheDocument();
  });

  it('câu chính sách huỷ chỉ còn ở card riêng bên phải — không lặp trong card Policies', () => {
    renderForm();
    expect(screen.getAllByText(t.cancellationNote)).toHaveLength(1);
    expect(aside().getByText(t.cancellationNote)).toBeInTheDocument();
    expect(aside().getByText(a.content.cancellationTitle)).toBeInTheDocument();
    expect(aside().getByText(a.optionalStep)).toBeInTheDocument();
  });

  it('chân form: link Next: Costs', () => {
    renderForm();
    expect(screen.getByRole('link', { name: e.next(e.tabs.costs) })).toHaveAttribute(
      'href',
      '/tours/ha-long-bay-cruise/costs',
    );
  });
});
```

  Chạy — đỏ.

- [ ] **B2. Cài.** Trong `tour-content-form.tsx`:
  1. **Import:** `Card, CardContent, CardDescription, CardHeader, CardTitle` từ
     `@tourism/ui/components/card`; `tourStepHref` từ `@/lib/tour-editor-view`. Thêm
     `const e = messages.admin.tours.editor;` và `const a = e.aside;`, rồi `const t = e.content;`.
  2. **Cột phải** — ngay trước `return (`:

```tsx
  // Đếm theo danh sách ĐANG SOẠN (ADR-0049 §6). Hai link cùng trang (#faq, #policies):
  // hộp hỏi lại không chặn khi chỉ đổi hash.
  const aside = (
    <>
      <Card size="sm">
        <CardHeader>
          <CardTitle>{a.onThisStep}</CardTitle>
          <CardDescription>{a.optionalStep}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1">
          <a
            href="#faq"
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <span className="font-medium">{t.faqTitle}</span>{' '}
            <span className="text-xs text-muted-foreground">
              {a.content.faqCount(values.faqs.length)}
            </span>
          </a>
          <a
            href="#policies"
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <span className="font-medium">{t.policiesTitle}</span>{' '}
            <span className="text-xs text-muted-foreground">
              {a.content.policyCount(values.policies.length)}
            </span>
          </a>
        </CardContent>
      </Card>
      {/* Chính sách huỷ sinh từ độ dài chuyến (ADR-0041), không nhập ở đây. */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>{a.content.cancellationTitle}</CardTitle>
          <CardDescription>{t.cancellationNote}</CardDescription>
        </CardHeader>
      </Card>
    </>
  );
```

  3. **Khung:** `EditorFormFrame` thêm `aside={aside}` và
     `next={{ href: tourStepHref(detail.slug, 'costs'), label: e.tabs.costs }}`.
  4. **Card FAQ** thay `<fieldset className="grid gap-3 rounded-lg border p-4">` + `<legend>`:

```tsx
        <Card id="faq">
          <CardHeader>
            <CardTitle>{t.faqTitle}</CardTitle>
            <CardDescription>{a.content.faqBody}</CardDescription>
          </CardHeader>
          <CardContent>{/* ListEditor<FaqDraft> — nguyên như đang có */}</CardContent>
        </Card>
```

  5. **Card Policies** thay fieldset thứ hai; câu `cancellationNote` BỎ khỏi đây (đã sang
     card bên phải — một câu không in hai lần trên cùng màn, spec §9):

```tsx
        <Card id="policies">
          <CardHeader>
            <CardTitle>{t.policiesTitle}</CardTitle>
            <CardDescription>{a.content.policiesBody}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {/* khối `dropped > 0 ? <p className="text-sm">{t.droppedCancellation(…)}</p>`
                và ListEditor<PolicyDraft> — nguyên như đang có */}
          </CardContent>
        </Card>
```

     (Comment `{/* … nguyên như đang có */}` là chỉ dẫn của plan: thay bằng đúng khối
     hiện có.)
  6. JSDoc đầu component: "Tab FAQ & policies (spec F17 §2h): hai khung sửa danh sách" →
     "Bước FAQ & policies (spec F17 §2h, F19 §2d.4): hai card sửa danh sách"; gạch đầu dòng
     chính sách huỷ: "một dòng ghi chú luôn nói điều đó" → "card bên phải luôn nói điều
     đó". `content/page.tsx`: "Tab FAQ & policies" → "Bước FAQ & policies".

- [ ] **B3.** Chạy spec — xanh, kể cả ca `droppedCancellation` cũ. Đột biến: đếm theo
  `detail.faqs` (ca thêm câu hỏi đỏ); để lại câu `cancellationNote` trong card Policies
  (ca "chỉ một lần" đỏ); bỏ `id="policies"`.
- [ ] **B4.** Quy trình gate.
- [ ] **B5. Commit:** `feat(admin): bước FAQ & policies — hai card, số lượng và chính sách huỷ bên phải`

## Task 9 — Bước Costs

**Files:**

- Modify: `apps/admin/src/components/tours/editor/tour-costs-form.tsx` (+ spec)
- Modify: `apps/admin/src/app/(admin)/tours/[slug]/costs/page.tsx` (chỉ JSDoc)

**Interfaces:**

- Consumes: `EditorFormFrame` `aside`/`next` (Task 2); copy `aside.costs`,
  `aside.onThisStep`, `aside.optionalStep` (Task 1).
- Produces: không có tên mới.

- [ ] **B1. Test đỏ.** Thêm vào `tour-costs-form.spec.tsx`:

```tsx
describe('TourCostsForm — bước Costs (F19)', () => {
  const a = e.aside;

  it('Totals ở cột phải, ngoài form — vẫn tính ngay khi gõ', async () => {
    const { user } = renderForm(detailFixture({ costItems: [LUNCH] }));
    expect(totals().closest('aside')).not.toBeNull();
    expect(totals().closest('form')).toBeNull();

    await user.clear(amounts()[0] as HTMLElement);
    await user.type(amounts()[0] as HTMLElement, '10');

    expect(totalPairs()[0]).toEqual([t.totals.perPerson, '$10.00']);
  });

  it('card Cost lines nói chi phí chỉ nội bộ; card bên phải nói bước tuỳ chọn; Next: Review & publish', () => {
    renderForm();
    expect(screen.getByText(a.costs.body)).toBeInTheDocument();
    expect(within(screen.getByRole('complementary')).getByText(a.optionalStep)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: e.next(e.tabs.review) })).toHaveAttribute(
      'href',
      '/tours/ha-long-bay-cruise/review',
    );
  });
});
```

  (`LUNCH` ở đầu spec là một dòng `PER_PERSON` 8.50 — ca "số tiền gõ dở" cũ đọc ra
  `[perPerson, '$8.50']`.) Các ca Totals cũ (tra `getByRole('region', { name: 'Totals' })`
  và `[aria-live="polite"]`) GIỮ NGUYÊN. Chạy — đỏ.

- [ ] **B2. Cài.** Trong `tour-costs-form.tsx`:
  1. **Import:** `Card, CardContent, CardDescription, CardHeader, CardTitle` từ
     `@tourism/ui/components/card`; `tourStepHref` vào import `@/lib/tour-editor-view`.
     Thêm `const e = messages.admin.tours.editor;` và `const a = e.aside;`, rồi
     `const t = e.costs;`.
  2. **Cột phải** — ngay trước `return (`, dời NGUYÊN ruột khung Totals sang:

```tsx
  // Totals dời sang cột phải và dính khi cuộn (spec F19 §2d.5): sửa dòng nào cũng thấy
  // ngay giá vốn và biên lời. `role="region"` + tên "Totals" như `<section>` cũ;
  // `aria-live` để trình đọc màn hình nghe tổng mới.
  const aside = (
    <>
      <Card size="sm" role="region" aria-labelledby="tour-cost-totals">
        <CardHeader>
          <CardTitle id="tour-cost-totals">{t.totals.title}</CardTitle>
        </CardHeader>
        <CardContent aria-live="polite">
          {/* nhánh `totals.costPrice === null ? <p>{t.totals.none}</p> : <dl>…</dl>` —
              nguyên như đang có trong `<div aria-live="polite">` cũ */}
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>{a.onThisStep}</CardTitle>
          <CardDescription>{a.optionalStep}</CardDescription>
        </CardHeader>
      </Card>
    </>
  );
```

     (Comment `{/* … nguyên như đang có … */}` là chỉ dẫn của plan: thay bằng đúng nhánh
     hiện có.)
  3. **Khung:** `EditorFormFrame` thêm `aside={aside}` và
     `next={{ href: tourStepHref(detail.slug, 'review'), label: e.tabs.review }}`.
  4. **Thân:** bọc `ListEditor<CostDraft>` trong card và XOÁ `<section
     aria-labelledby="tour-cost-totals">` cũ khỏi children:

```tsx
        <Card>
          <CardHeader>
            <CardTitle>{a.costs.title}</CardTitle>
            <CardDescription>{a.costs.body}</CardDescription>
          </CardHeader>
          <CardContent>{/* ListEditor<CostDraft> — nguyên như đang có */}</CardContent>
        </Card>
```

  5. JSDoc đầu component: "Tab Costs (spec F17 §2h): khung sửa danh sách dòng chi phí, và
     khung Totals tính NGAY khi gõ" → "Bước Costs (spec F17 §2h, F19 §2d.5): card sửa danh
     sách dòng chi phí, và khung Totals ở cột phải tính NGAY khi gõ"; gạch đầu dòng "Khung
     Totals có `aria-live`…" giữ. `costs/page.tsx`: "Tab Costs" → "Bước Costs".

  Biome không bắt `role="region"` trên `<Card>` (luật `useSemanticElements` chỉ xét thẻ
  HTML — đã đo 28/09: `role="group"` trên `<Card>` qua, trên `<div>` thì báo).

- [ ] **B3.** Chạy spec — xanh, kể cả mọi ca Totals cũ. Đột biến: bỏ `role="region"` (mọi
  ca Totals đỏ); bỏ `aria-live`; để Totals lại trong form (ca "ngoài form" đỏ).
- [ ] **B4.** Quy trình gate.
- [ ] **B5. Commit:** `feat(admin): bước Costs — card dòng chi phí, Totals dính bên phải`

## Task 10 — Soi bố cục bằng CSS build thật

jsdom không có bố cục (bài học 4). Bước này dựng lại cách làm mockup: DOM của CHÍNH các
component vừa sửa, đổ ra trang tĩnh, nối với CSS mà `next build` của admin vừa sinh, rồi
đo bằng trình duyệt ở hai khổ. Không commit gì — trừ khi phải sửa lỗi bố cục tìm ra.

**Files (tạm, xoá ở B6):**

- Create: `apps/admin/src/components/__layout-check__/render.spec.tsx`
- Output: `apps/admin/.next/layout-check/*.html` (`.next/` đã nằm trong `.gitignore`)

- [ ] **B1.** Build admin (đã có nếu vừa chạy gate): `pnpm turbo run build --filter=@tourism/admin --output-logs=errors-only`.
  `ls apps/admin/.next/static/chunks/*.css` phải ra ít nhất hai file (một file font nhỏ,
  một file globals ~250 KB).

- [ ] **B2.** Tạo spec tạm `render.spec.tsx` (nằm dưới `src/components/` để project `dom`
  của vitest nhặt được):

```tsx
// TẠM — soi bố cục F19 bằng CSS build thật (plan F19, Task 10). KHÔNG commit.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import type * as React from 'react';
import { describe, it, vi } from 'vitest';
import { AdminShell } from '@/components/admin-shell';
import { TourContentForm } from '@/components/tours/editor/tour-content-form';
import { TourCostsForm } from '@/components/tours/editor/tour-costs-form';
import { TourDetailProvider } from '@/components/tours/editor/tour-detail-context';
import { TourDetailsForm } from '@/components/tours/editor/tour-details-form';
import { TourItineraryForm } from '@/components/tours/editor/tour-itinerary-form';
import { TourPhotosForm } from '@/components/tours/editor/tour-photos-form';
import { TourReviewStep } from '@/components/tours/editor/tour-review-step';
import { TourWorkspaceTop } from '@/components/tours/editor/tour-workspace-top';
import { CATEGORY_ID, COVER_PHOTO, DEST_A, DEST_B, detailFixture } from '@/test/tour-detail';

let pathname = '/tours/ha-long-bay-cruise';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
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
const OPTIONS = {
  categories: [{ id: CATEGORY_ID, name: 'Day trips', isActive: true }],
  destinations: [
    { id: DEST_A, name: 'Hạ Long', isActive: true },
    { id: DEST_B, name: 'Hà Nội', isActive: true },
  ],
};
// Tour tắt bán, ngày 3 chưa có lịch trình — để thấy cả dấu thiếu lẫn dấu đủ.
const TOUR = detailFixture({
  isPublished: false,
  isFeatured: true,
  durationDays: 5,
  maxGroupSize: 15,
  basePrice: '89.00',
  ratingAvg: '4.66',
  ratingCount: 128,
  suitableFor: ['FAMILY', 'COUPLE', 'FRIENDS'],
  badges: ['POPULAR'],
  highlights: ['Cable car over the rainforest canopy', 'Golden Bridge at golden hour'],
  included: ['Cable car tickets', 'Buffet lunch'],
  excluded: ['Wax museum entry'],
  destinations: [
    { destinationId: DEST_A, isPrimary: true },
    { destinationId: DEST_B, isPrimary: false },
  ],
  itinerary: [1, 2, 4, 5].map((dayNumber) => ({
    dayNumber,
    title: `Day ${dayNumber} on the bay`,
    description: '08:00 — Pick-up at your hotel\n12:30 — Lunch on board',
  })),
  faqs: [
    { question: 'Is lunch included?', answer: 'Yes, a buffet lunch on board.' },
    { question: 'What should I wear?', answer: 'Comfortable shoes and a light jacket.' },
  ],
  policies: [
    { kind: 'BOOKING', title: 'Children', body: 'Children under 1 m ride free.' },
    { kind: 'GENERAL', title: 'Weather', body: 'Storms move you to the next free day.' },
  ],
  costItems: [
    { category: 'TRANSPORT', label: 'Coach', amount: '12.00', basis: 'PER_PERSON' },
    { category: 'GUIDE', label: 'English-speaking guide', amount: '60.00', basis: 'PER_DEPARTURE' },
  ],
  photos: [
    COVER_PHOTO,
    { ...COVER_PHOTO, publicId: 'tourism/catalog/tour/ha-long/2', alt: 'Kayaks in a lagoon' },
    { ...COVER_PHOTO, publicId: 'tourism/catalog/tour/ha-long/3', alt: 'A cave lit in blue' },
  ],
});
const noop = vi.fn();

function page(name: string, step: string, body: React.ReactNode) {
  pathname = step === 'details' ? '/tours/ha-long-bay-cruise' : `/tours/ha-long-bay-cruise/${step}`;
  render(
    <div data-admin-surface style={{ display: 'contents' }}>
      <AdminShell user={USER}>
        <TourDetailProvider detail={TOUR}>
          <TourWorkspaceTop />
          {body}
        </TourDetailProvider>
      </AdminShell>
    </div>,
  );
  const links = CSS.map((file) => `<link rel="stylesheet" href="/static/chunks/${file}">`).join('');
  writeFileSync(
    `${OUT}/${name}.html`,
    `<!doctype html><html lang="en" class="${FONT_CLASSES.join(' ')} h-full antialiased"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${links}</head><body class="min-h-full bg-background text-foreground">${document.body.innerHTML}</body></html>`,
  );
}

describe('layout-check', () => {
  it('details', () =>
    page('details', 'details', <TourDetailsForm detail={TOUR} options={OPTIONS} save={noop} />));
  it('photos', () =>
    page(
      'photos',
      'photos',
      <TourPhotosForm detail={TOUR} save={noop} sign={noop} loadLibrary={noop} />,
    ));
  it('itinerary', () =>
    page('itinerary', 'itinerary', <TourItineraryForm detail={TOUR} save={noop} />));
  it('content', () => page('content', 'content', <TourContentForm detail={TOUR} save={noop} />));
  it('costs', () => page('costs', 'costs', <TourCostsForm detail={TOUR} save={noop} />));
  it('review', () =>
    page('review', 'review', <TourReviewStep setPublished={noop} remove={noop} />));
});
```

  Chạy: `pnpm --filter @tourism/admin exec vitest run src/components/__layout-check__/render.spec.tsx`
  — sáu ca xanh, sáu file trong `apps/admin/.next/layout-check/`.

- [ ] **B3.** Mở máy chủ tĩnh ở nền (Git Bash, từ gốc repo):
  `python -m http.server 8766 --directory apps/admin/.next` — rồi mở
  `http://localhost:8766/layout-check/details.html` trong Browser pane (`preview_start`
  với `url`). Chữ phải ra đúng font Archivo; không có thì B1 thiếu file CSS font.

- [ ] **B4. Đo ở 1600px.** `resize_window` 1600×1000, với TỪNG trang trong sáu trang chạy
  bằng `javascript_tool`:

```js
(() => {
  const aside = document.querySelector('[data-slot="step-aside"]');
  const main = aside.previousElementSibling;
  const box = (el) => el.getBoundingClientRect();
  const firstCard = (el) => el.querySelector('[data-slot="card"]');
  const nav = document.querySelector('nav[aria-label="Tour steps"]');
  return {
    viewport: innerWidth,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    twoColumns: box(aside).left >= box(main).right,
    topDelta: Math.round(box(firstCard(aside)).top - box(firstCard(main)).top),
    stepperOverflow: nav.scrollWidth - nav.clientWidth,
  };
})()
```

  Đạt khi: `overflowX` 0, `twoColumns` true, `topDelta` trong ±1 (card đầu của cột phải
  ngang hàng card đầu của form — ở Itinerary là khung Days với thẻ Day 1), và
  `stepperOverflow` 0. Thêm một phép đo ở `itinerary.html` (trang dài nhất): cuộn trang —
  hoặc khung cuộn đang chứa nó — xuống 800px, `aside.getBoundingClientRect().top` phải là
  16±1 (`xl:top-4`). Chụp một ảnh màn Details để ghi vào bàn giao.

- [ ] **B5. Đo ở 390px.** `resize_window` 390×844, chạy lại đoạn đo trên cho sáu trang. Đạt
  khi: `overflowX` 0, `twoColumns` false, cột phải nằm DƯỚI form
  (`box(aside).top >= box(main).bottom`), `stepperOverflow` 0. Trả khổ về `desktop` khi
  xong.

  Tooltip KHÔNG soi được ở trang tĩnh (không có React chạy) — ca hover/focus của Task 4
  lo phần chạy; vị trí thật của tooltip ở mép thanh bước để session gốc thử tay.

- [ ] **B6. Dọn.** Tắt máy chủ tĩnh (PowerShell):
  `Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`;
  xoá `apps/admin/src/components/__layout-check__/` và `apps/admin/.next/layout-check/`.
  `git status` phải sạch.

- [ ] **B7.** Có phép đo trượt: sửa đúng chỗ (TDD nếu sửa logic), gate, commit
  `fix(admin): …` mô tả lỗi bố cục; rồi đo lại. Ghi mọi số đo (cả lần trượt) vào bàn giao.

## Task 11 — Gate cuối, docs, bàn giao

**Files:**

- Modify: `docs/CHANGELOG.md`
- Modify: `docs/open-items.md`

- [ ] **B1.** `git log --oneline main..HEAD` — chín commit của Task 1–9 (cộng commit
  `fix` của Task 10 nếu có), không commit lạ. `git diff --stat main..HEAD` không chạm file
  nào trong danh sách "Không đụng" của Ràng buộc toàn cục.
- [ ] **B2.** `grep -rn "tourTabHref\|activeTourTab\|TourTabs\|TourReadinessPanel\|readyBody\|missingTitle" apps/admin/src libs/shared/i18n/src`
  — rỗng. Quy trình gate trên đỉnh nhánh; ghi số test từng gói (Vitest) và số int (ca,
  file).
- [ ] **B3. Entry CHANGELOG** — chèn ngay dưới khối `> **File này chỉ giữ đợt đang chạy**…`,
  TRÊN entry mới nhất. Ngày là ngày chạy bước này. Khuôn:

```markdown
## 2026-MM-DD — F19 khu sửa tour dạng thanh bước (nhánh `feat/p4e-3c-tour-workspace-steps`)

Khu sửa tour `/tours/[slug]` bỏ hàng tab chữ: thanh bước chỉ có icon (tên bước và
trạng thái trong tooltip), mỗi bước là form bên trái và cột phải dính khi cuộn bên phải,
bước cuối Review & publish gom danh sách kiểm tra, công tắc On sale và vùng xoá tour.
Quyết định ở ADR-0049; mockup user duyệt (v7) ở `C:\Programming\Devs\Assets\mockups\2026-09-28-tour-workspace-steps\`.
Không đổi API, contract, DB, web, mobile; luật ghi giữ nguyên.

(Một đoạn cho mỗi thứ thấy được: thanh bước · phần đầu · khung hai cột · từng bước ·
bước Review. Một đoạn cho chỗ lệch plan nếu có, kèm lý do; một đoạn số đo Task 10.)

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **N** (web …, api …, admin …, contract …, core …, ui …, tokens …,
i18n …), int **N ở N file**. Liệt kê số ca mới theo gói và các đột biến đã thử.
```

  Không để dòng nào bắt đầu bằng `+`; tổng số test gói trọn trong một dòng hoặc nối bằng
  chữ "và". `git diff docs/CHANGELOG.md` phải chỉ có phần thêm.
- [ ] **B4. `docs/open-items.md`:** sửa dòng P4e cho đúng hiện trạng (P4e-3c xong trên
  nhánh, chờ review). `git diff docs/open-items.md` trước khi stage.
- [ ] **B5.** `./scripts/docs-freshness.sh` (Git Bash) — xanh.
- [ ] **B6. Commit:** `docs: entry CHANGELOG cho F19 khu sửa tour dạng thanh bước`
- [ ] **B7.** Tắt API (lệnh PowerShell ở Quy trình gate), xoá `/tmp/f19-api.log`. Không
  còn tiến trình nào nghe cổng 3001 hay 8766.
- [ ] **B8. Bàn giao** — KHÔNG merge. Báo cho session gốc: danh sách commit · kết quả gate
  (số test từng gói, int) · đột biến đã thử và kết quả (kể cả cái không giết được, kèm lý
  do) · số đo Task 10 ở hai khổ · chỗ lệch plan và vì sao · việc cần hạ tầng (dự kiến:
  không có).

## Sau khi bàn giao — việc của session gốc

1. Review nhánh ở mức max effort, vá TRỌN phát hiện trên chính nhánh này (nếp F14–F18).
   Đọc kỹ: `tourSteps` (đúng mục readiness cho đúng bước, đích Fix), chỗ nào đọc bản ĐÃ
   LƯU chỗ nào đọc bản ĐANG SOẠN, các đích link `#tour-summary` · `#tour-destinations` ·
   `#day-N`, tiêu điểm của form Photos, hộp hỏi lại với link thanh bước · Next ·
   Departures, `PublishToggle` và `DeleteTourZone` ở chỗ mới, copy mới (bài học 8).
2. Hỏi user trước khi merge; rebase lên `main`, `git merge --ff-only`, push bằng SHA đích
   danh; `gh run list --branch main --limit 1` phải xanh.
3. Entry CHANGELOG ngày merge; dòng roadmap P4e trong `CLAUDE.md` (P4e-3c xong) và
   `docs/open-items.md`.
4. Chờ Vercel deploy admin xong (chỉ admin đổi — không có khe deploy), rồi thử tay trên
   production TỪNG BƯỚC, chờ user xác nhận mỗi bước: mở một tour → rê chuột và Tab qua
   sáu icon (tooltip ở icon đầu và icon cuối không tràn khung) → Details: xoá tóm tắt thấy
   cột phải hết xanh ngay, thanh bước chưa đổi; lưu thì thanh bước đổi → sửa một ô rồi
   bấm icon bước khác: hộp hỏi lại bật; tương tự với Next và Departures → Itinerary: link
   Days nhảy đúng ngày → Review: tour thiếu thì công tắc khoá kèm lý do, nút Fix mở đúng
   chỗ; bật rồi tắt bán; View on site chỉ hiện khi đang bán → khổ hẹp (điện thoại) một
   cột, không tràn ngang. Không cần kiểm DB: F19 không ghi gì mới.

---

## Prompt bàn giao cho session thi công F19

Dán nguyên khối dưới đây vào một session Claude Code MỚI mở tại
`C:\Programming\Devs\Projects\Tourism-Platform-V2`.

```text
Bạn là session THI CÔNG của tourism-v2, làm việc NGAY TRONG checkout gốc
C:\Programming\Devs\Projects\Tourism-Platform-V2 (không tạo worktree). Đọc
theo thứ tự:
  CLAUDE.md                                                        (15 luật + gotcha)
  docs/README.md                                                   (bản đồ tài liệu)
  docs/adr/0049-tour-workspace-steps.md                            (quyết định)
  docs/specs/2026-09-28-p4e-3c-tour-workspace-steps-design.md      (spec — HỢP ĐỒNG)
  docs/plans/2026-09-28-p4e-3c-tour-workspace-steps.md             (plan — làm theo)
Mockup user đã duyệt: C:\Programming\Devs\Assets\mockups\2026-09-28-tour-workspace-steps\index.html
(mở bằng Edge) — tham khảo bố cục; spec §9 liệt kê chỗ cố ý khác mockup.

VIỆC: tính năng F19 — khu sửa tour thành thanh bước chỉ có icon, mỗi bước form một
bên và cột phải dính khi cuộn một bên, bước cuối Review & publish gom danh sách kiểm
tra, công tắc On sale và vùng xoá tour. Chỉ admin. Làm Task 1 → 11 đúng thứ tự, mỗi
task một commit (Task 10 chỉ commit khi phải sửa lỗi bố cục). Không làm gì ngoài plan;
thấy plan sai hay mâu thuẫn spec thì DỪNG và hỏi tôi.

TRƯỚC DÒNG CODE ĐẦU TIÊN: đọc "Điều kiện bắt đầu" (kể cả mục "Cập nhật 29/09 — code thật
đã khác plan ở đâu"), mục "Quyết định của plan" và các bài học ở đầu plan. Vòng review
F17 tìm ra 24 lỗi thật, F18 thêm 15.

MỞ ĐẦU
- `git status` phải sạch và đang ở `main`. F18 phải đã merge:
  git log --oneline main -- apps/admin/src/components/tours/editor/tour-photos-form.tsx
  in ít nhất một commit; không in gì thì DỪNG, báo tôi.
- `git log --oneline -- docs/plans/2026-09-28-p4e-3c-tour-workspace-steps.md` phải thấy
  commit "docs: plan thi công F19…". Rồi:
  git checkout -b feat/p4e-3c-tour-workspace-steps
- Docker Postgres phải đang chạy (`docker ps`) — integration test cần nó.

LUẬT BẤT DI BẤT DỊCH CỦA SESSION NÀY
- KHÔNG merge, KHÔNG push, KHÔNG rebase, KHÔNG dùng subagent.
- KHÔNG chạm hạ tầng sống (CLAUDE.md §15): không Supabase, Cloudinary, webhook,
  env hay redeploy Render/Vercel. F19 không cần gì từ hạ tầng.
- KHÔNG sửa apps/web, apps/mobile, apps/api, libs/shared/contract, libs/shared/ui
  (kit dùng chung với web đang chạy), Prisma. Thấy mình sắp cần thì DỪNG và hỏi tôi.
- TDD (luật 4): test đỏ đúng lý do trước, rồi mới cài. Ca test mới nào cũng phải kiểm
  bằng đột biến — làm thật (sửa code cho sai, thấy đỏ, trả lại), ghi kết quả, kể cả
  đột biến không giết được và vì sao.
- Gate cuối mỗi task theo mục "Quy trình gate" của plan: chạy tách bước, hãm song song
  (máy từng phình RAM khi chạy gate:int trần), cần API sống cho build web; xong thì tắt
  API bằng lệnh PowerShell trong plan.
- Comment code TIẾNG VIỆT (luật 8); copy người dùng thấy bằng TIẾNG ANH trong
  @tourism/i18n (luật 7). Tokens-only, không hex (luật 6).
- Commit Conventional Commits, message TIẾNG VIỆT CÓ DẤU, KHÔNG AI attribution —
  không dòng Co-Authored-By (luật 12). Stage theo đường dẫn tường minh, không
  `git add -A`. Chạy `pnpm lint:fix` trước khi stage.
- i18n được đọc từ dist: sửa xong phải build lại trước khi test admin (lệnh ở Ràng
  buộc toàn cục của plan).
- Rà docs/skills.md trước khi bắt tay (luật 9).

BẢY CHỖ DỄ SAI (plan có đủ chi tiết)
1. Đích link readiness phải còn nguyên khi đổi fieldset thành Card: `#tour-summary`,
   `#tour-destinations`, `#day-N` (Task 5, 7).
2. Cột phải đọc giá trị ĐANG SOẠN; thanh bước và bước Review đọc bản ĐÃ LƯU từ
   `useWorkspaceDetail` — trộn hai thứ là thanh bước nhảy xanh khi chưa lưu.
3. Công tắc On sale và vùng xoá có chỗ mới (Task 3) TRƯỚC khi rời chỗ cũ (Task 4, 5).
4. Link Departures dùng lại `departuresHref(slug)` sẵn có ở `lib/tours-query.ts` —
   không đẻ hàm trùng tên.
5. Tooltip Base UI trong jsdom mở khi hover và khi Tab, nhưng popup không có
   role="tooltip": test tìm bằng chữ; tên link so bằng `toHaveAccessibleName`.
6. Test cũ tra thẻ ngày bằng role "group" và Totals bằng role "region": giữ hai vai
   trò ấy trên Card (Biome không bắt role trên component).
7. Tiêu điểm form Photos không rơi về <body>: gỡ dòng cuối → Upload photos; Make cover
   → ô alt (Task 6 chỉ xếp lại bố cục, không đụng logic).

BÀN GIAO KHI XONG
Không merge. Viết cho tôi: danh sách commit; kết quả gate (số test từng gói, số int);
đột biến đã thử và kết quả; số đo bố cục của Task 10 ở 1600px và 390px; chỗ lệch plan
và vì sao; việc cần hạ tầng (dự kiến: không có).
```
