# Spec F19 — Khu sửa tour dạng thanh bước (P4e-3c)

- **Ngày:** 2026-09-28 · **Trạng thái:** user đã duyệt mockup v7; spec chờ user đọc
- **Quyết định kiến trúc:** [ADR-0049](../adr/0049-tour-workspace-steps.md)
- **Nền:** [ADR-0047](../adr/0047-tour-editor-sections.md) (khu làm việc, luật ghi) ·
  [ADR-0048](../adr/0048-tour-photos.md) (bước Photos)
- **Mockup đã duyệt:** `C:\Programming\Devs\Assets\mockups\2026-09-28-tour-workspace-steps\`
  (`index.html` mở thẳng bằng trình duyệt; mã nguồn mockup ở
  `workspace-steps-mockup.tsx.txt` cùng thư mục). Mockup dựng bằng chính component
  của admin; §9 liệt kê chỗ spec cố ý khác mockup.
- **Thi công:** SAU khi F18 merge — F18 sửa đúng các file này (`editor-form-frame`,
  `tour-editor-view`, hàng tab, vùng xoá).

## 1. Mục tiêu & phạm vi

### Vấn đề

Khu làm việc tour của F17 là hàng tab chữ + các form MỘT cột xếp khung chồng nhau.
User dùng thật và thấy trang dài, phải cuộn nhiều (trang Details đo 2607px ở khổ
1600px); khung readiness chiếm đầu trang ở mọi tab; công tắc On sale nằm tách khỏi
lý do vì sao nó bị khoá.

### Trong phạm vi

- Thanh bước chỉ có icon thay hàng tab; tooltip mang tên bước và trạng thái.
- Phần đầu mới: trạng thái (chip), View on site, Departures, lần lưu cuối.
- Bố cục hai cột cho mọi bước có form: form bên trái, cột phải dính khi cuộn.
- Bước mới Review & publish (route `/tours/[slug]/review`): danh sách kiểm tra, công
  tắc On sale, vùng xoá tour.
- Xếp lại bố cục trong từng bước theo mockup v7.

### Ngoài phạm vi, cố ý

- Mọi luật ghi (lệnh ghi, phiên bản, readiness, cổng đăng) — giữ nguyên (ADR-0047).
- API, contract, DB, web, mobile — không đổi một dòng.
- Bảng `/tours` và công tắc On sale ở mỗi hàng của nó — giữ nguyên.
- Nội dung trang Departures — chỉ đổi phần đầu phía trên nó.
- Số chuyến "sắp tới" trên nút Departures (cần field mới ở contract).

## 2. Quyết định thiết kế

### 2a. Thanh bước

Sáu bước theo thứ tự: `details` · `photos` · `itinerary` · `content` · `costs` ·
`review`. Đường dẫn: `details` là `/tours/[slug]`, các bước khác là
`/tours/[slug]/<bước>` (bước mới: `/review`).

**Hình:** một thẻ viền (`rounded-xl border bg-card`), trong đó sáu vòng tròn 40px
(`size-10`) chia đều một hàng, nối bằng vạch 1px (`h-px flex-1 bg-border`).

| Trạng thái | Vòng tròn | Dấu góc dưới-phải |
| --- | --- | --- |
| bước đang mở | nền `primary`, chữ `primary-foreground`, `ring-4 ring-primary/15` | giữ dấu của trạng thái bên dưới |
| đủ (`ok`) | viền thường | chấm `bg-success` có dấu ✓ |
| thiếu (`warn`) | viền thường | chấm `bg-warning` có dấu "!" |
| tuỳ chọn (`optional`) | viền nét đứt | không |
| chốt (`final`, Review & publish) | viền thường | không |

Icon (lucide): Details `FileTextIcon` · Photos `ImageIcon` · Itinerary `MapIcon` ·
FAQ & policies `CircleHelpIcon` · Costs `ReceiptIcon` · Review & publish `RocketIcon`.

**Trạng thái suy từ readiness ĐÃ LƯU** (`detail.readiness`, cập nhật sau mỗi lần lưu
qua `usePublishSavedDetail`) bằng MỘT hàm thuần `tourSteps(detail)`:

| Bước | ok khi | Dòng trạng thái (tooltip) |
| --- | --- | --- |
| details | `summary && primaryDestination` | ok: "Summary and primary destination set" · warn: "Missing: " + các mục thiếu |
| photos | `cover` | ok: "N photos · cover set" · warn: "Missing: a cover photo" |
| itinerary | `missingDays` rỗng | ok: "Every day planned" · warn: "Missing: an itinerary for day …" |
| content | luôn `optional` | "Optional · N questions · M policies" |
| costs | luôn `optional` | "Optional · N cost lines" / "Optional · no cost lines" |
| review | luôn `final` | đang bán: "On sale" · đủ mà chưa bán: "Ready to go on sale" · thiếu: "N things to fix" |

Mục thiếu dùng lại nhãn của `readinessIssues` (hạ chữ đầu: "Missing: a summary, a
primary destination"). Không có đường thứ hai tính trạng thái.

**Hành vi:**

- Mỗi vòng tròn là `next/link` thật; hộp hỏi lại khi rời trang có thay đổi chưa lưu
  vẫn chặn ở pha capture như hàng tab cũ.
- Tooltip bằng kit `Tooltip` (`side="bottom"`), bọc cả thanh trong `TooltipProvider`
  (trễ 0). Hiện khi rê chuột VÀ khi focus bằng bàn phím.
- Chữ cho trình đọc màn hình nằm TRONG link (`sr-only`): "Details: Summary and
  primary destination set". Bước đang mở mang `aria-current="step"`.
- `nav aria-label="Tour steps"`, danh sách là `<ol>` (có thứ tự).
- Trang Departures: không bước nào `aria-current`.

### 2b. Phần đầu

Từ trên xuống:

1. Link "Back to tours" (giữ nguyên).
2. Hàng tên: `h2` tên tour (giữ class hiện tại); dưới tên một dòng nhỏ
   `/tours/<slug> · Last saved 28 Sep 2026, 14:27 UTC` (`formatDateTime(detail.version)`).
   Bên phải cùng hàng:
   - chip trạng thái (`Badge variant="outline"`, chấm tròn `bg-success` / `bg-muted-foreground`):
     **On sale** hoặc **Not on sale**;
   - nút **View on site** (`ExternalLinkIcon`), link `https://www.nexora-travel.agency/tours/<slug>`
     mở tab mới — CHỈ khi đang bán (tắt bán thì trang web 404);
   - nút **Departures** (`CalendarDaysIcon`), link `/tours/<slug>/departures`,
     `aria-current="page"` khi đang ở trang ấy.
3. Thanh bước (§2a).

Bỏ: công tắc On sale và câu `toggleBlocked` (dời xuống bước Review, §2d.6); khung
readiness (`TourReadinessPanel` — xoá component và spec của nó).

`SITE_URL` đang khai ở `nav-user.tsx` dời ra `lib/site.ts` để hai chỗ dùng chung.

### 2c. Bố cục bước

`EditorFormFrame` nhận thêm ba prop tuỳ chọn:

- `lead?: React.ReactNode` — trải hết bề ngang, TRÊN hai cột (Itinerary dùng cho dòng
  giới thiệu, để khung Days bắt đầu ngang hàng Day 1).
- `aside?: React.ReactNode` — cột phải.
- `next?: { href: string; label: string }` — link "Next: <bước>" ở chân form, cạnh Save.

Dựng (thứ tự DOM = thứ tự đọc):

```
[lead]                                    (nếu có)
[grid xl:grid-cols-[minmax(0,1fr)_20rem] items-start gap-6]
  <form>  banner · children · chân form (ghi chú · Next · Save)  </form>
  <aside class="grid gap-4 xl:sticky xl:top-4">  aside  </aside>  (nếu có)
```

- Dưới `xl` một cột; cột phải nằm SAU form.
- Chân form: ghi chú (`note`/`blockedNote`) bên trái (`mr-auto`), rồi link Next
  (`Button variant="ghost"` render `Link`, `ChevronRightIcon`), rồi nút Save.
- Khung chung `StepColumns` (cùng lưới) dùng cho bước Review, không có form.
- Khối cột phải dùng chung (`components/tours/editor/step-aside.tsx`):
  `StepChecklist` (tiêu đề "This step", mô tả, các dòng ✓ / ! / vòng nét đứt),
  `StepTips` (tiêu đề "Tips" có `LightbulbIcon`, danh sách gạch đầu dòng),
  `TourCardPreview` (§2d.1). Mọi khối là `Card size="sm"`.

### 2d. Từng bước

Mọi khung form thành `Card` (`CardHeader` · `CardTitle` · `CardDescription` ·
`CardContent`) thay cho `fieldset/legend`. Giữ nguyên MỌI ô, id, luật kiểm và copy lỗi.

**2d.1 Details**

- Card **Basics** — mô tả "What travellers see first — the card on /tours and the top
  of the tour page." Ô: Name · Summary · hàng 2 cột Category | Difficulty · hàng 3 cột
  Days | Maximum group size | Base price · Featured · câu "Days … will be removed".
- Card **Destinations** — `id="tour-destinations"` giữ nguyên (đích link readiness);
  mô tả `destinationsHint`; ListEditor như cũ.
- Card **Selling points** — mô tả "Shown on the tour page: who it suits, badges,
  highlights, what's included and practical notes."
  - Lưới 2 cột × 2 hàng từ `lg`: hàng trên **Good for** (MỘT cột, mỗi lựa chọn một
    hàng) | **Badges** (2 cột); hàng dưới hai câu gợi ý của hai nhóm — cùng một hàng.
    Thứ tự DOM: nhóm Good for → câu của nó → nhóm Badges → câu của nó (màn hẹp đọc
    đúng); từ `lg` đặt bằng `col-start`/`row-start`.
  - Highlights · hàng 2 cột What's included | What's not included · Meeting point ·
    Tour facts (2 cột).
- **Vùng xoá tour KHÔNG còn ở đây** (dời xuống Review).
- Cột phải:
  - `StepChecklist`: "A summary" và "A primary destination" — tính bằng
    `projectedReadiness` trên giá trị ĐANG SOẠN (tích xanh ngay khi gõ); dòng tuỳ chọn
    "Highlights, lists and meeting point" (vòng nét đứt).
  - `TourCardPreview` — bám thẻ `tour-list-card.tsx` của web, đọc giá trị đang soạn:
    ảnh bìa (ảnh đầu của `detail.photos`, `tourPhotoThumb`, khung 3:2, `object-cover`;
    chưa có ảnh thì ô xám "No cover photo yet"); chip "Featured" trên ảnh khi đánh dấu
    Featured, kèm câu nhỏ "The Featured label shows unless the card shows a discount.";
    dòng dữ kiện "<điểm đến chính> · N days · up to M guests"; tên 1 dòng (cắt …);
    tóm tắt 2 dòng; sao "4.7 (128)" hoặc "Not rated yet"; dòng giá **"Base price $89"**
    kèm câu "The site shows the cheapest upcoming departure."
  - `StepTips`: "Lead the summary with the one thing people remember." · "Two or three
    highlights read better than eight." · "“Limited offer” only while a date has a real
    discount."
- Next: Photos.

**2d.2 Photos** (form của F18, chỉ xếp lại)

- Card **Photos** — mô tả `photos.intro`; `CardAction` là bộ đếm "N of 30 photos"
  (`aria-live="polite"` giữ nguyên).
- Trong card: một ô viền nét đứt (`rounded-lg border border-dashed bg-muted/30`) chứa
  `ImageIcon`, hai nút Upload photos · Add from library, và câu "Or drop photos here.
  <formats>". Vùng thả file của F18 bọc CẢ ô ấy lẫn danh sách (thả vào đâu trong card
  cũng tải lên).
- Dưới ô: dòng báo file bị loại, lỗi danh sách, danh sách ảnh, dòng đang tải — giữ
  nguyên logic và tiêu điểm của F18 (`emptyFocus`, Make cover → ô alt).
- Ghi chú chân form: "Saving replaces the tour’s photos in this order." (khi không có
  `blockedNote`).
- Cột phải: `StepChecklist` "A cover photo" (đang soạn: danh sách có ít nhất một ảnh)
  và "Alt text on every photo" (đang soạn; thiếu N ảnh thì dòng phụ "N photos still need
  it"); card "Cover on /tours" (ảnh đầu, 3:2, hoặc "No cover photo yet"); `StepTips`:
  "Landscape photos crop best on tour cards." · "Describe what is in the photo — skip
  “photo of”."
- Next: Itinerary.

**2d.3 Itinerary**

- `lead`: dòng `itinerary.intro(N)` — một hàng riêng trải hết bề ngang.
- Mỗi ngày một Card `id="day-N"` (giữ đích link), `CardTitle` "Day N"; ngày có tiêu đề
  trống thì `CardAction` là badge viền vàng "Needed before going on sale" và card có
  `ring-warning/60`. Ô Title · Plan for the day giữ nguyên.
- Cột phải: card **Days** "Jump to a day. Stays in view while you scroll." — mỗi ngày
  một link `#day-N` "Day N · <tiêu đề>" kèm ✓ (có tiêu đề) hoặc ! (trống), tính trên
  giá trị đang soạn.
- Next: FAQ & policies.

**2d.4 FAQ & policies**

- Card **FAQ** (`id="faq"`) — mô tả "Questions travellers ask before booking. Shown on
  the tour page."
- Card **Policies** (`id="policies"`) — mô tả "Booking and general rules shown on the
  tour page."; câu `droppedCancellation` giữ nguyên chỗ.
- Cột phải: card **On this step** "Optional — the tour can go on sale without it." với
  hai link `#faq` "FAQ · N questions" và `#policies` "Policies · M policies" (đang soạn);
  card **Cancellation policy** nội dung `content.cancellationNote`.
- Next: Costs.

**2d.5 Costs**

- Card **Cost lines** — mô tả "Internal only — travellers never see these. They make up
  the tour's cost price."; ListEditor như cũ.
- Khung **Totals** DỜI sang cột phải (card, giữ `aria-live="polite"` và nguyên cách tính).
- Cột phải thêm card **On this step** "Optional — the tour can go on sale without it."
- Next: Review & publish.

**2d.6 Review & publish** (route mới `/tours/[slug]/review`)

- Không có form. Dùng `StepColumns`.
- Card **Ready to go on sale?** — mô tả "Every required step has to be green before the
  tour can go on sale." Mỗi bước một hàng: dấu trạng thái · icon bước · tên · dòng
  trạng thái (cùng chữ với tooltip, §2a) · với hàng `warn` một nút "Fix" (link tới
  `readinessIssues` đầu tiên của bước ấy). Hàng `optional` dùng vòng nét đứt.
- Card **Delete this tour** — tour chưa từng có booking: `DeleteTourZone` (nội dung và
  hộp xác nhận giữ nguyên); đã có booking: câu "Tours that have been booked can't be
  deleted. Take it off sale instead." không có nút.
- Cột phải: card **Visibility** — dòng trạng thái ("On sale — travellers can find and
  book it." / "Not on sale — hidden from the site."), công tắc `PublishToggle`
  (`placement="workspace"`, `blocked` khi chưa đủ, `describedBy` trỏ câu `toggleBlocked`
  khi bị khoá), câu "Taking a tour off sale is always allowed."; card **When it goes on
  sale**: "It appears on /tours and on the region pages of its destinations." ·
  "Travellers can book the departures marked Bookable."
- Không có Next.

### 2e. Trang Departures

Chỉ đổi phần đầu (§2b) và thanh bước không bước nào sáng. Nội dung trang giữ nguyên.

### 2f. Tên trong code

Bộ tên "tab" đổi sang "step" cho khớp nghĩa (review sẽ grep đúng chữ):

- `TourEditorStep = 'details' | 'photos' | 'itinerary' | 'content' | 'costs' | 'review'`
- `TOUR_EDITOR_STEPS`, `tourStepHref(slug, step)`, `activeTourStep(pathname, slug)`
  (trả `null` ở Departures), `tourSteps(detail)`, `departuresHref(slug)`.
- Component: `TourStepNav` (`tour-step-nav.tsx`), `StepColumns`, `StepChecklist`,
  `StepTips`, `TourCardPreview`, `TourReviewStep` (`tour-review-step.tsx`).

### 2g. Copy (tiếng Anh, `messages.admin.tours.editor`)

Thêm (chữ chốt ở plan, giọng như F17):

- `tabs.review: 'Review & publish'`; `tabsLabel` đổi thành `'Tour steps'`.
- `steps.*` — mọi dòng trạng thái ở bảng §2a.
- `header.*` — `onSale`, `offSale`, `viewOnSite`, `lastSaved(when)`.
- `next(step)` — "Next: <step>".
- `aside.*` — "This step", mô tả, "Required to go on sale", dòng tuỳ chọn, "Tips", các
  câu gợi ý, thẻ xem trước, "Cover on /tours", "Days", "On this step", các mô tả card
  mới ở §2d.
- `review.*` — tiêu đề, mô tả, "Fix", Visibility, When it goes on sale, câu xoá bị chặn.

Mọi câu hứa hệ quả đã đo trên code (bài học 11 của F17): trang vùng của web liệt kê
một tour khi BẤT KỲ điểm đến nào của nó thuộc vùng ấy (`toursInRegion`, không chỉ điểm
đến chính); chỉ chuyến Bookable nhận booking (F16); FAQ và chính sách hiện ở tab Good to
know của trang tour; chi phí chỉ nội bộ.

## 3. Bản đồ file

| File | Việc |
| --- | --- |
| `apps/admin/src/lib/tour-editor-view.ts` | bộ tên step, `tourSteps`, `departuresHref` |
| `apps/admin/src/lib/site.ts` (mới) | `SITE_URL`, `tourPageUrl(slug)` |
| `apps/admin/src/lib/tours-view.ts`, `components/tours/editor/new-tour-dialog.tsx` | đổi `tourTabHref` → `tourStepHref` |
| `apps/admin/src/components/nav-user.tsx` | dùng `SITE_URL` từ `lib/site.ts` |
| `apps/admin/src/components/tours/editor/tour-step-nav.tsx` (mới) | thanh bước |
| `apps/admin/src/components/tours/editor/tour-workspace-header.tsx` | phần đầu mới |
| `apps/admin/src/components/tours/editor/tour-workspace-top.tsx` | phần đầu + thanh bước |
| `apps/admin/src/components/tours/editor/editor-form-frame.tsx` | `lead`, `aside`, `next`; `StepColumns` |
| `apps/admin/src/components/tours/editor/step-aside.tsx` (mới) | `StepChecklist`, `StepTips`, `TourCardPreview` |
| `apps/admin/src/components/tours/editor/tour-review-step.tsx` (mới) | bước Review |
| `apps/admin/src/app/(admin)/tours/[slug]/review/page.tsx` (mới) | route bước Review |
| `…/tour-details-form.tsx`, `tour-photos-form.tsx`, `tour-itinerary-form.tsx`, `tour-content-form.tsx`, `tour-costs-form.tsx` | xếp lại bố cục + cột phải |
| `…/tour-tabs.tsx`, `tour-readiness-panel.tsx` (+ spec) | xoá |
| `libs/shared/i18n/src/lib/messages.ts` | copy §2g |

## 4. Chỗ dễ sai

1. **Đích link readiness** (`#tour-summary`, `#tour-destinations`, `#day-N`) phải còn
   nguyên sau khi đổi `fieldset` thành `Card` — đặt `id` lên đúng phần tử.
2. **Cột phải đọc giá trị ĐANG SOẠN**, thanh bước đọc bản ĐÃ LƯU. Trộn hai thứ là thanh
   bước nhảy xanh khi chưa lưu.
3. **`DeleteTourZone` và `PublishToggle` rời chỗ cũ** — test của Details và phần đầu
   phải đổi theo; `placement="workspace"` giữ nguyên hành vi refresh / về `/tours`.
4. **Hộp hỏi lại** phải chặn cả link "Next" và nút Departures — chúng là `<a>` thật nên
   bộ nghe ở pha capture tự bắt; test một ca bằng link Next.
5. **Tooltip trên thiết bị cảm ứng không hiện** — chữ `sr-only` trong link là tên thật
   của nó; không dựa vào tooltip để truyền thông tin bắt buộc.
6. **`xl:sticky`** chỉ dính khi cột phải thấp hơn cửa sổ; cột phải cao hơn thì cuộn
   theo trang — chấp nhận, không đặt `max-h` + cuộn riêng.
7. **Form F18** có vùng thả file và `emptyFocus` — xếp lại bố cục KHÔNG được làm mất
   hai thứ ấy.

## 5. Kiểm thử

- **Logic thuần** (`tour-editor-view.spec.ts`): `tourSteps` cho mọi tổ hợp readiness;
  dòng trạng thái đúng chữ; `activeTourStep` (gốc, từng bước, Departures → `null`,
  đoạn lạ → `details`); `tourStepHref`, `departuresHref`.
- **Component**: thanh bước (sáu link, `aria-current`, chữ `sr-only`, tooltip hiện khi
  rê/focus, dấu đúng trạng thái); phần đầu (chip, View on site chỉ khi đang bán,
  Departures `aria-current`); `EditorFormFrame` (`lead` trên lưới, `aside` là
  `<aside>`, `next` là link, Save cũ vẫn đúng); khối cột phải; Review (hàng Fix đúng
  link, công tắc khoá khi thiếu, vùng xoá chỉ khi chưa có booking).
- **Từng bước**: cột phải đổi ngay khi gõ (xoá tóm tắt → dòng "A summary" hết xanh);
  Totals vẫn tính khi gõ và vẫn `aria-live`; các test cũ về lưu, lỗi, tiêu điểm giữ xanh.
- **Đột biến** cho mỗi ca mới (luật 4).
- **Soi bố cục bằng CSS build thật** (DOM từ jsdom đổ ra trang tĩnh, như cách dựng
  mockup): khổ 1600px hai cột, khung đầu của cột phải ngang hàng card đầu; khổ 390px
  một cột, không tràn ngang.
- Không có int test mới (API không đổi) nhưng gate vẫn chạy `test:int` (luật 11).

## 6. Đối chiếu Nexora (luật 10)

Theo [`2026-08-20-admin-parity-nexora.md`](../analysis/2026-08-20-admin-parity-nexora.md),
trang sửa tour của Nexora dựng bằng bộ CRUD kit có "tab pills" — cùng họ với hàng tab
F17 đang có. Thanh bước là **v2 tốt hơn**: giữ mọi khối nội dung, thêm trạng thái từng
bước và một chỗ duyệt trước khi bán. Không bỏ gì của Nexora.

## 7. Definition of done

- Sáu bước + Departures đi được bằng thanh bước và phần đầu; hộp hỏi lại chặn đủ.
- Mọi luật ghi, lỗi, tiêu điểm của F17 và F18 còn nguyên (test cũ xanh).
- Review & publish: bật/tắt bán và xoá tour chạy như trước, ở chỗ mới.
- Gate đầy đủ xanh; soi bố cục ở 1600px và 390px đạt §5.
- Entry CHANGELOG; `docs/README.md` có ADR-0049, spec, plan.

## 8. Rủi ro đã biết

- F18 đang chờ review — review có thể đổi form Photos. Plan viết theo bản trên nhánh
  F18 (`9fa7baea`); thi công đọc lại bản đã merge trước khi xếp lại.
- Đổi tên `tab` → `step` chạm nhiều file; typecheck bắt được chỗ sót.
- Mobile: tooltip không hiện khi chạm; chấp nhận vì admin dùng máy tính là chính và tên
  bước vẫn có ở chữ `sr-only` cùng tiêu đề card đầu của mỗi bước.

## 9. Khác mockup v7, cố ý

| Mockup | Spec | Lý do |
| --- | --- | --- |
| Nút "Departures · 6 upcoming" | "Departures" | `AdminTourDetail` chỉ có `departureCount` (kể cả chuyến huỷ); số sắp tới cần field mới ở contract |
| Chip "Draft" | "Not on sale" | Tour gỡ bán không phải bản nháp; khớp chữ "On sale" của công tắc |
| Thẻ xem trước: badge "Popular" trên ảnh, giá "From $89" | Không badge trên ảnh; "Base price $89" kèm câu giải thích | Card thật không in badge (badge ở cạnh giá trang tour); giá "From" của web là chuyến rẻ nhất sắp tới, admin không có số ấy |
| Gợi ý "Library photos keep their credit line" | Bỏ | Chưa đo được web hiện dòng ghi công ở đâu |
| Mô tả card Policies = câu chính sách huỷ | Câu riêng; chính sách huỷ ở card cột phải | Tránh một câu in hai lần trên cùng màn |
| Dòng trạng thái tooltip là chữ mẫu | Bảng §2a | Chữ thật suy từ readiness |
