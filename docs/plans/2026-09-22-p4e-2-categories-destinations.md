# Plan thi công P4e-2 — danh mục tour và điểm đến

**Spec:** [2026-09-22-p4e-2-categories-destinations-design.md](../specs/2026-09-22-p4e-2-categories-destinations-design.md)
**ADR:** [0045 — từ vựng vùng miền ở contract](../adr/0045-region-vocabulary-in-contract.md)

Chín task thi công cộng hai lượt dọn tài liệu, hai nhánh. Thi công **trong cùng một session** (chốt 22/09), nên plan
này không kèm prompt bàn giao — nó là danh sách việc để làm tuần tự và tick.

| Tính năng | Nhánh | Task | Phụ thuộc |
| --- | --- | --- | --- |
| **F14** danh mục tour | `feat/p4e-2-categories` | 1–5 | không |
| **F15** điểm đến | `feat/p4e-2-destinations` | 6–9 | F14 đã merge (dùng chung `slugifyVietnamese`) |

## Ràng buộc toàn cục

Áp cho **mọi** task, không nhắc lại ở từng chỗ:

- **TDD trên logic thuần** (luật 4): viết test trước, chạy cho ĐỎ, rồi mới cài.
- **`pnpm gate:int`** trước khi khai một task xong (luật 11). Build web cần API
  sống — dựng bằng `node dist/main.js` rồi mới `turbo run build`.
- **Comment code tiếng Việt** (luật 8); **copy người dùng thấy bằng tiếng Anh**
  và nằm trong `@tourism/i18n` (luật 7).
- **Không hex** ở frontend — chỉ token (luật 6).
- **Commit Conventional, tiếng Việt CÓ DẤU**, không AI attribution (luật 12).
- **Bust cache sau commit transaction**, fire-and-forget (ADR-0016 §3).
- Mã lỗi: `NOT_FOUND` 404 · `SLUG_TAKEN` 409 · `CANNOT_MOVE` 409.
- Trần cột phải gương đúng: slug 60 (danh mục) / 80 (điểm đến) · name 120 ·
  description 500 (danh mục) / 2000 (điểm đến) · country 60 · region 80.

## Bản đồ file

**F14 — danh mục**

| File | Trách nhiệm |
| --- | --- |
| `libs/shared/contract/src/schemas/slug.ts` | `slugifyVietnamese(value, maxLength)` — thuần |
| `libs/shared/contract/src/schemas/admin-categories.ts` | Schema hàng + bốn input |
| `libs/shared/contract/src/contract.ts` | Năm procedure `admin.categories.*` |
| `apps/api/src/modules/catalog/admin-categories.service.ts` | Năm thao tác + bust cache |
| `apps/api/src/modules/catalog/admin-categories.controller.ts` | Guard + `mapError` |
| `apps/admin/src/lib/categories-view.ts` | VM thuần (gồm `canMoveUp`/`canMoveDown`) |
| `apps/admin/src/lib/categories-write.ts` | Codec lỗi + hợp đồng server action |
| `apps/admin/src/lib/api/categories.ts` | Client oRPC |
| `apps/admin/src/app/(admin)/categories/{page,actions}.tsx` | Trang + server action |
| `apps/admin/src/components/categories/*.tsx` | Bảng, form dialog, row actions |
| `apps/web/src/lib/api/tours.ts` | `fetchCategories()` |
| `apps/web/src/app/(site)/tours/(listing)/page.tsx` | Chip lọc đọc endpoint |

**F15 — điểm đến**

| File | Trách nhiệm |
| --- | --- |
| `libs/shared/contract/src/schemas/regions.ts` | Ba vùng + `RegionNameSchema` |
| `apps/web/src/mocks/regions.ts` | Chỉ còn tái xuất khẩu từ contract |
| `libs/shared/contract/src/schemas/admin-destinations.ts` | Schema hàng + ba input |
| `apps/api/src/modules/catalog/admin-destinations.service.ts` | Bốn thao tác |
| `apps/api/src/modules/catalog/admin-destinations.controller.ts` | Guard + `mapError` |
| `apps/admin/src/lib/destinations-view.ts` · `destinations-write.ts` · `api/destinations.ts` | Cùng khuôn F14 |
| `apps/admin/src/app/(admin)/destinations/{page,actions}.tsx` | Trang + server action |
| `apps/admin/src/components/destinations/*.tsx` | Bảng, form dialog, row actions |

---

# F14 — Danh mục tour

> Mở nhánh: `git checkout -b feat/p4e-2-categories`

## Task 1 — `slugifyVietnamese` (hàm thuần, TDD)

**Files:**
- Create: `libs/shared/contract/src/schemas/slug.ts`
- Create: `libs/shared/contract/src/schemas/slug.spec.ts`
- Modify: `libs/shared/contract/src/index.ts`

**Produces:** `slugifyVietnamese(value: string, maxLength: number): string`

- [x] **B1.** Viết spec TRƯỚC, các ca:
      `'Đà Lạt' → 'da-lat'` · `'Hà Nội' → 'ha-noi'` (đề xuất, KHÁC slug thật
      `hanoi` — ghi comment nói rõ đây là gợi ý) · `'Cần Thơ' → 'can-tho'` ·
      `'  Hạ  Long  ' → 'ha-long'` · `'Việt Nam 2026!' → 'viet-nam-2026'` ·
      chuỗi dài hơn `maxLength` bị cắt và **không để gạch ở cuối** ·
      `'' → ''`.
- [x] **B2.** Chạy cho ĐỎ: `pnpm --filter @tourism/contract exec vitest run src/schemas/slug.spec.ts`
      — mong "is not a function".
- [x] **B3.** Cài: `normalize('NFD')` bỏ dấu phụ, `đ/Đ → d` TRƯỚC khi normalize
      (NFD không tách `đ`), lowercase, gom mọi ký tự ngoài `[a-z0-9]` thành một
      gạch, cắt `maxLength`, rồi mới trim gạch hai đầu.
- [x] **B4.** Export ở `index.ts`. Chạy XANH.
- [x] **B5.** JSDoc tiếng Việt nói rõ: đây là GỢI Ý, không phải luật — dẫn bảng
      đo trong spec §2c (`Hà Nội` → `hanoi` do người chọn).
- [x] **B6.** `pnpm gate:int` xanh.
- [x] **B7.** Commit: `feat(contract): slugifyVietnamese bỏ dấu, cắt theo trần cột`

## Task 2 — Contract `admin.categories`

**Files:**
- Create: `libs/shared/contract/src/schemas/admin-categories.ts`
- Create: `libs/shared/contract/src/schemas/admin-categories.spec.ts`
- Modify: `libs/shared/contract/src/contract.ts`, `index.ts`

**Produces:**
`AdminCategoryRowSchema` (`id` · `slug` · `name` · `description` · `order` ·
`isActive` · `tourCount`) · `AdminCategoryCreateInput` · `AdminCategoryUpdateInput` ·
`AdminCategorySetActiveInput` · `AdminCategoryMoveInput` (`{ id, direction: 'up' | 'down' }`)

- [x] **B1.** Spec TRƯỚC: slug đúng khuôn `^[a-z0-9-]+$` và ≤ 60 · name 1..120 ·
      description ≤ 500 và nullable · `direction` chỉ nhận hai giá trị ·
      `update` KHÔNG có trường `slug`. Repo KHÔNG dùng `.strict()` ở đâu cả
      (đã kiểm 22/09), nên ca test là: `safeParse` một input có `slug` thừa vẫn
      `success`, và `parsed.data` KHÔNG mang `slug` — tức server không bao giờ
      nhìn thấy nó.
- [x] **B2.** Chạy ĐỎ.
- [x] **B3.** Viết schema. Mỗi trần cột một hằng export (`CATEGORY_SLUG_MAX = 60`…)
      để admin dùng lại, không chép số.
- [x] **B4.** Thêm năm procedure vào `contract.ts` dưới `admin.categories`, đủ
      `errorMap` theo bảng mã lỗi ở Ràng buộc toàn cục.
- [x] **B5.** Spec thêm: tập mã lỗi của mỗi procedure đúng như spec §3.
- [x] **B6.** `pnpm gate:int` xanh.
- [x] **B7.** Commit: `feat(contract): thêm admin.categories với năm thao tác`

## Task 3 — API danh mục (service + controller + int spec)

**Files:**
- Create: `apps/api/src/modules/catalog/admin-categories.service.ts`
- Create: `apps/api/src/modules/catalog/admin-categories.controller.ts`
- Create: `apps/api/src/modules/catalog/admin-categories.int.spec.ts`
- Modify: `apps/api/src/modules/catalog/catalog.module.ts`

**Consumes:** contract từ Task 2.

- [x] **B1.** Int spec TRƯỚC, các ca:
      `list` trả CẢ hàng đã tắt kèm `tourCount` (endpoint công khai thì không) ·
      `create` slug trùng → **409 `SLUG_TAKEN`**, không phải 500 ·
      `create` đặt `order` = max + 1 ·
      `update` đổi name/description, KHÔNG đụng slug ·
      `setActive` tắt rồi bật, `tourCount` không đổi ·
      `move` đổi chỗ hai hàng liền kề ·
      `move` ở biên → **409 `CANNOT_MOVE`**, thứ tự không đổi ·
      khách thường gọi bất kỳ endpoint nào → 403.
- [x] **B2.** Chạy ĐỎ (thiếu module).
- [x] **B3.** Service: `list` · `create` · `update` · `setActive` · `move`.
      *Sửa ở vòng review 22/09:* bước này ghi `SELECT … FOR UPDATE` sắp theo
      id, và kiểm slug bằng `findUnique` TRONG transaction. **Cả hai đều
      không đủ.** Khoá đặt SAU hai lệnh đọc nên nó xếp hàng người ghi mà không
      bảo vệ giá trị đã đọc — hai lượt trên hai cặp giao nhau để lại hai hàng
      cùng `order`. Và ở READ COMMITTED, một câu SELECT không serialize được
      hai INSERT, nên `P2002` vẫn lọt ra thành 500. Bản cuối dùng **khoá
      advisory cấp bảng** (`withCategoryOrderLock`, cùng khuôn
      `withBookingRefundLock`) bọc CẢ `create` lẫn `move`, cộng lưới bắt
      `P2002`/`P2025`.
- [x] **B4.** Bust cache `TAGS.TOURS` sau commit, `void`, fire-and-forget.
- [x] **B5.** Controller đúng khuôn `AdminDeparturesController`: `@Roles(ADMIN)`
      cấp class, `mapError` dùng `instanceof` (KHÔNG so `error.name` — bài học
      vòng hai F12).
- [x] **B6.** Thêm một ca int cho đua ghi: hai lượt `move` đối đầu không sinh
      `order` trùng.
      *Sửa ở vòng review 22/09:* ca viết theo bước này bắn `move(2,'down')` +
      `move(3,'up')` — hai lệnh ấy là CÙNG MỘT phép đổi chỗ, nên không
      interleaving nào làm nó đỏ được, kể cả khi gỡ sạch khoá. Ca hiện tại
      chọn hai cặp GIAO NHAU; đo được: gỡ khoá thì đỏ 3/3 lượt.
- [x] **B7.** `pnpm gate:int` xanh.
- [x] **B8.** Commit: `feat(api): năm endpoint quản trị danh mục tour`

## Task 4 — Màn `/categories`

**Files:**
- Create: `apps/admin/src/lib/categories-view.ts` (+ `.spec.ts`)
- Create: `apps/admin/src/lib/categories-write.ts` (+ `.spec.ts`)
- Create: `apps/admin/src/lib/api/categories.ts`
- Create: `apps/admin/src/app/(admin)/categories/page.tsx`, `actions.ts`
- Create: `apps/admin/src/components/categories/categories-table.tsx`,
  `category-form-dialog.tsx`, `category-row-actions.tsx` (+ spec)
- Modify: `apps/admin/src/lib/nav.ts` (bật mục `categories`)
- Modify: `libs/shared/i18n/src/lib/messages.ts`

- [x] **B1.** Spec VM TRƯỚC: `canMoveUp` false ở hàng đầu · `canMoveDown` false
      ở hàng cuối · hàng đã tắt có nhãn riêng · `tourCount` thành nhãn đọc được.
- [x] **B2.** Chạy ĐỎ, rồi viết `categories-view.ts`.
- [x] **B3.** `categories-write.ts`: codec lỗi derive từ khối i18n (khuôn
      `departures-write.ts`), hợp đồng `DepartureWriteResult` tương đương.
- [x] **B4.** Component spec TRƯỚC cho ba thứ: ô slug **mở** ở form tạo và
      **vắng mặt** ở form sửa · nút lên/xuống **tắt** đúng ở hai biên · hộp xác
      nhận tắt danh mục in đúng `tourCount` và nói đủ BA hệ quả (chip biến khỏi
      `/tours` · tour vẫn hiện · link `/tours?categories=<slug>` vẫn lọc được).
- [x] **B5.** Dựng bảng trên kit (`DataTableFrame` + `DataTableBody`), form
      dialog theo khuôn `DepartureFormDialog` (bọc `<form>`, `aria-describedby`
      — hai thứ vòng hai F12 vừa sửa, đừng dựng lại bản cũ).
- [x] **B6.** Ô slug ở form tạo điền sẵn bằng `slugifyVietnamese(name, 60)` và
      **thôi tự điền** ngay khi admin sửa tay ô ấy.
- [x] **B7.** Bật `enabled: true` cho mục `categories` ở `nav.ts`.
- [x] **B8.** `pnpm gate:int` xanh.
- [x] **B9.** Commit: `feat(admin): màn quản trị danh mục tour`

## Task 5 — Web đọc endpoint danh mục

**Files:**
- Modify: `apps/web/src/lib/api/tours.ts`
- Modify: `apps/web/src/app/(site)/tours/(listing)/page.tsx`
- Modify/Delete: `apps/web/src/lib/tours.ts` (`tourCategories`)
- Test: spec của trang listing

- [x] **B1.** Spec TRƯỚC: chip lọc đọc từ endpoint · thứ tự theo `order` ·
      danh mục **chưa có tour nào vẫn hiện** (ở dạng khoá).
      *Sửa khi thi công:* bước này ban đầu ghi "trang 2 có cùng bộ chip trang
      1" như một sai lệch cần vá — **đo lại thì không có sai lệch đó**, vì
      `fetchTours()` gọi một lần `limit: 50` và explorer phân trang phía
      client. Đính chính đã ghi vào spec §2e.
- [x] **B2.** Chạy ĐỎ.
- [x] **B3.** Thêm `fetchCategories()` vào `tours.ts`, tag `TAGS.TOURS`, cùng
      `REVALIDATE_SEC` như `fetchDestinations`.
- [x] **B4.** Trang listing dùng nó thay `tourCategories(tours)`. Gỡ hàm cũ nếu
      không còn ai gọi (kiểm bằng grep trước khi xoá).
- [x] **B5.** `count` của chip: **giữ nguyên cách đếm cũ** — đếm từ danh sách
      đã lọc, KHÔNG lấy `toursCount` của endpoint.
      *Sửa khi thi công:* bước này ban đầu ghi ngược lại. `toursCount` là số
      TOÀN catalogue, in nó ra khi khách đang tìm kiếm hoặc đang bật facet
      khác là hứa nhiều hơn thực tế — đúng loại lỗi copy mà cụm này đang vá.
      Endpoint quyết định chip NÀO có mặt và theo thứ tự nào; con số vẫn do
      `facetOptionCounts` tính trên lưới đã lọc.
- [x] **B6.** Dựng web với API sống, xác nhận không hỏng prerender (rủi ro ghi
      ở spec §6).
- [x] **B7.** `pnpm gate:int` xanh.
- [x] **B8.** Commit: `fix(web): chip lọc danh mục đọc endpoint, thôi suy từ trang hiện tại`

## Task 5b — Docs sweep F14

- [x] **B1.** Entry `docs/CHANGELOG.md`: nội dung · review findings · số test.
- [x] **B2.** `./scripts/docs-freshness.sh` xanh.
- [x] **B3.** Commit `docs: entry CHANGELOG cho F14`, rồi **hỏi user trước khi
      merge** (luật 2), ff-only, xem CI (luật 14).

---

# F15 — Điểm đến

> Mở nhánh SAU khi F14 đã merge: `git checkout -b feat/p4e-2-destinations`

## Task 6 — Từ vựng vùng miền về contract (ADR-0045)

**Files:**
- Create: `libs/shared/contract/src/schemas/regions.ts` (+ `.spec.ts`)
- Modify: `apps/web/src/mocks/regions.ts`, `libs/shared/contract/src/index.ts`
- Test: spec ghim `generateStaticParams` của `/destinations/[region]`

**Produces:** `REGIONS` (ba mục `key`/`slug`/`name`) · `RegionNameSchema`
(enum ba `name`) · type `RegionKey`

- [ ] **B1.** Spec TRƯỚC ở contract: đúng ba vùng · slug là
      `northern-vietnam`/`central-vietnam`/`southern-vietnam` · `RegionNameSchema`
      nhận đúng ba `name` và từ chối `'North'`.
- [ ] **B2.** Spec TRƯỚC ở web: `generateStaticParams()` trả đúng ba slug ấy.
      Đây là lưới của rủi ro spec §6 — dời sai là ba trang vùng biến khỏi build.
- [ ] **B3.** Chạy ĐỎ cả hai.
- [ ] **B4.** Viết `regions.ts` ở contract; `apps/web/src/mocks/regions.ts` chỉ
      còn `export { REGIONS } from '@tourism/contract'` (giữ đường import cũ để
      các trang vùng không phải sửa).
- [ ] **B5.** Xác nhận `regionOf` vẫn ghép được dữ liệu prod (`Northern Vietnam`).
- [ ] **B6.** `pnpm gate:int` xanh.
- [ ] **B7.** Commit: `refactor(contract): ba vùng miền về contract theo ADR-0045`

## Task 7 — Contract `admin.destinations`

**Files:**
- Create: `libs/shared/contract/src/schemas/admin-destinations.ts` (+ `.spec.ts`)
- Modify: `libs/shared/contract/src/contract.ts`, `index.ts`

**Produces:** `AdminDestinationRowSchema` (`id` · `slug` · `name` · `country` ·
`region` · `description` · `isActive` · `tourCount`) và ba input.

- [ ] **B1.** Spec TRƯỚC: slug ≤ 80 · country ≤ 60 mặc định `'Vietnam'` ·
      `region` dùng `RegionNameSchema` (từ chối chuỗi lạ) · description ≤ 2000 ·
      `update` KHÔNG có slug.
- [ ] **B2.** Chạy ĐỎ, rồi viết schema + bốn procedure.
- [ ] **B3.** `pnpm gate:int` xanh.
- [ ] **B4.** Commit: `feat(contract): thêm admin.destinations với bốn thao tác`

## Task 8 — API điểm đến

**Files:**
- Create: `apps/api/src/modules/catalog/admin-destinations.service.ts`,
  `admin-destinations.controller.ts`, `admin-destinations.int.spec.ts`
- Modify: `apps/api/src/modules/catalog/catalog.module.ts`

- [ ] **B1.** Int spec TRƯỚC: `list` trả cả hàng đã tắt kèm `tourCount` ·
      slug trùng → 409 · `update` đổi được `region` và **không** đổi slug ·
      `setActive` không đụng liên kết `tour_destinations` (đếm trước/sau bằng
      nhau — đây là chốt của quyết định "không xoá", spec §2a) · khách → 403.
- [ ] **B2.** Chạy ĐỎ, rồi viết service + controller đúng khuôn Task 3.
- [ ] **B3.** Bust `TAGS.TOURS` sau commit.
- [ ] **B4.** `pnpm gate:int` xanh.
- [ ] **B5.** Commit: `feat(api): bốn endpoint quản trị điểm đến`

## Task 9 — Màn `/destinations`

**Files:**
- Create: `apps/admin/src/lib/destinations-view.ts` · `destinations-write.ts` ·
  `api/destinations.ts` (+ spec)
- Create: `apps/admin/src/app/(admin)/destinations/{page,actions}.tsx`
- Create: `apps/admin/src/components/destinations/*.tsx` (+ spec)
- Modify: `apps/admin/src/lib/nav.ts`, `libs/shared/i18n/src/lib/messages.ts`

- [ ] **B1.** Component spec TRƯỚC: ô `region` là **danh sách chọn ba mục**,
      không phải ô chữ · ô slug mở khi tạo, vắng khi sửa · hộp xác nhận tắt in
      đúng `tourCount` và nói đủ hệ quả (biến khỏi trang vùng, tile, facet; tour
      vẫn hiện).
- [ ] **B2.** Chạy ĐỎ, rồi dựng theo đúng khuôn Task 4.
- [ ] **B3.** Ô slug điền sẵn bằng `slugifyVietnamese(name, 80)`.
- [ ] **B4.** Bật mục `destinations` ở `nav.ts`.
- [ ] **B5.** `pnpm gate:int` xanh.
- [ ] **B6.** Commit: `feat(admin): màn quản trị điểm đến`

## Task 9b — Docs sweep F15

- [ ] **B1.** Entry `docs/CHANGELOG.md`.
- [ ] **B2.** Gạch mục P4e-2 ở `docs/open-items.md`.
- [ ] **B3.** `./scripts/docs-freshness.sh` xanh, hỏi user rồi merge, xem CI.

---

## Nghiệm thu cuối (sau khi cả hai merge)

- [ ] `pnpm gate:int` trọn xanh trên `main`.
- [ ] Liếc đèn CI sau push (luật 14).
- [ ] **Chạy thử tay trên production, mỗi lượt một bước** (nếp đã chốt 17/09):
      tạo một danh mục → sắp lên đầu → xem `/tours` đổi thứ tự chip → tắt nó →
      xem chip biến mất mà tour vẫn còn → bật lại. Rồi đổi vùng của một điểm đến
      và xem nó nhảy sang trang vùng khác.
- [ ] Ghi vào `open-items.md` bất cứ thứ gì lượt thử tay phát hiện — lượt thử
      tay của F13 tìm ra một câu copy nói dối mà 3.877 test không thấy.
