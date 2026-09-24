# Plan thi công P4e-2 — danh mục tour và điểm đến

**Spec:** [2026-09-22-p4e-2-categories-destinations-design.md](../specs/2026-09-22-p4e-2-categories-destinations-design.md)
**ADR:** [0045 — từ vựng vùng miền ở contract](../adr/0045-region-vocabulary-in-contract.md)

Mười task thi công (gồm Task 9a thêm sau vòng review F14) cộng hai lượt dọn
tài liệu, hai nhánh. F14 thi công **trong cùng một session** (chốt 22/09). F15
chạy ở một session MỚI, session gốc review (chốt 24/09): mục "Bài học vòng
review F14" ở đầu phần F15 là thứ bàn giao — session mới đọc nó trước khi viết
dòng code nào. Prompt dán vào session ấy nằm ở cuối file.

| Tính năng | Nhánh | Task | Phụ thuộc |
| --- | --- | --- | --- |
| **F14** danh mục tour | `feat/p4e-2-categories` | 1–5 | không |
| **F15** điểm đến | `feat/p4e-2-destinations` | 6–9, cộng 9a | F14 đã merge 23/09 (`892de4e8`) |

## Ràng buộc toàn cục

Áp cho **mọi** task, không nhắc lại ở từng chỗ:

- **TDD trên logic thuần** (luật 4): viết test trước, chạy cho ĐỎ, rồi mới cài.
- **Gate trước khi khai một task xong** (luật 11), chạy theo mục *Quy trình
  gate* ngay dưới — không chạy `pnpm gate:int` trần.
- **Comment code tiếng Việt** (luật 8); **copy người dùng thấy bằng tiếng Anh**
  và nằm trong `@tourism/i18n` (luật 7).
- **Không hex** ở frontend — chỉ token (luật 6).
- **Commit Conventional, tiếng Việt CÓ DẤU**, không AI attribution — không dòng
  `Co-Authored-By` (luật 12). Stage theo **đường dẫn tường minh**, không
  `git add -A`. Chạy `pnpm lint:fix` trước khi stage.
- **Bust cache sau commit transaction**, fire-and-forget (ADR-0016 §3).
- Mã lỗi: `NOT_FOUND` 404 · `SLUG_TAKEN` 409 · `CANNOT_MOVE` 409.
- Trần cột phải gương đúng: slug 60 (danh mục) / 80 (điểm đến) · name 120 ·
  description 500 (danh mục) / 2000 (điểm đến) · country 60 · region 80.
- **Contract và i18n được đọc từ `dist`** (thêm 24/09): sửa hai gói ấy xong phải
  build lại trước khi test api/admin/web thấy thay đổi —
  `pnpm turbo run build --filter=@tourism/contract --filter=@tourism/i18n --output-logs=errors-only`.
- **Không đụng** (thêm 24/09, cho F15): `apps/api/prisma/` (F15 không có
  migration — bảng `destinations` đã đủ cột), `apps/mobile`, module
  bookings/payments, code departures của F16.
- **Không hạ tầng sống** (luật 15). F15 không cần gì từ hạ tầng.
- **Tài liệu `.md`:** không để dòng bắt đầu bằng `+` ở cột 0; `git diff` file
  `.md` trước khi stage; không sửa entry CHANGELOG cũ.

### Quy trình gate (luật 11) — dùng ở cuối MỖI task

Thêm 24/09, chép từ plan F16 kèm một chỉnh: unit test chạy 4 worker mỗi gói.

`pnpm gate:int` trần chạy song song 10 luồng và từng làm máy phình RAM, nên chạy
tách bước, hãm song song. Build web prerender gọi API thật, nên phải có API sống.
Chạy từ gốc repo bằng **Git Bash**, Docker Postgres phải đang chạy:

```bash
# 1. API sống cho bước build web
pnpm turbo run build --filter=@tourism/api --output-logs=errors-only
(cd apps/api && node dist/main.js > /tmp/f15-api.log 2>&1 &)
for i in $(seq 1 30); do curl -sf http://localhost:3001/api/health > /dev/null && echo "API sống" && break; sleep 2; done

# 2. build + typecheck
NEXT_PUBLIC_API_URL=http://localhost:3001 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm turbo run build typecheck --concurrency=2 --output-logs=errors-only

# 3. unit test — 16 worker làm ca zod-config.spec.ts của contract hết giờ (đo 23/09)
pnpm turbo run test --concurrency=2 --output-logs=errors-only -- --maxWorkers=4

# 4. lint + luật tokens của mobile
pnpm lint && node scripts/check-mobile-tokens-only.mjs

# 5. integration test
pnpm test:int --concurrency=2
```

Tắt API sau khi xong (PowerShell) — chỉ giết đúng tiến trình đang nghe cổng 3001:

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Cả năm bước xanh mới được khai task xong. Máy chậm bất thường thì dừng và báo.

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
| `apps/admin/src/app/(admin)/destinations/page.tsx` · `actions.ts` | Trang + server action |
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

## Bài học vòng review F14 — đọc TRƯỚC khi viết dòng code nào

Vòng review F14 (22/09) tìm ra 15 lỗi, cả 15 là thật. F15 là bản song sinh
của F14, nên nếu không áp những bài học này ngay từ đầu thì nó sẽ đi lại đúng
những lỗi ấy. Bản kể đầy đủ nằm ở entry "Vòng review F14" trong
`docs/CHANGELOG.md`. Mục ghi dưới đây đã đo lại trên code ngày 23/09.

**Tầng API**

1. **Slug trùng thì bắt `P2002`, không kiểm trước bằng SELECT.** Ở mức READ
   COMMITTED, một câu `findUnique` trong transaction không chặn được hai lệnh
   INSERT chạy song song. `P2002` lọt ra ngoài thành 500, và admin mất cả form
   vừa gõ. F15 không có cột `order` nên KHÔNG cần khoá advisory như F14 — chỉ
   cần bắt `P2002` rồi đổi thành `SlugTakenError` ở `create`.
2. **Không `assertExists` rồi mới `update`.** Bắt `P2025` ngay từ câu `update`
   rồi đổi thành lỗi NOT_FOUND. Kiểm-trước-ghi-sau để hở một cửa sổ giữa hai
   câu, và lỗi ở cửa sổ ấy ra thành 500.
3. **`tourCount` đếm trong CÙNG câu với lệnh ghi** (`_count` nằm trong
   `select`). Đếm bằng một câu riêng sau đó là đọc từ một ảnh chụp khác.
4. **Rút `mapError` về một chỗ chung** ở `apps/api/src/lib/` khi thêm bản thứ
   ba (nợ G3 trong `open-items.md`). Bản của departures giải gọn hơn: lỗi mang
   `code`, nên ba mã gập lại thành một nhánh.
5. **Khối guard của int spec phải kể ĐỦ mọi đường, cộng một ca 401.** Khối
   guard của F14 từng bỏ sót `update`.

**Tầng contract**

6. **Dùng chung một khuôn slug.** Đổi `CATEGORY_SLUG_PATTERN` thành
   `SLUG_PATTERN`, chuyển nó về `slug.ts` (khuôn ấy không riêng gì danh mục),
   rồi cho cả hai bảng dùng. Gạch nối chỉ được nằm GIỮA hai cụm chữ-số.
7. **Mô tả rỗng phải thành `null` bằng `.transform`.** Viết
   `.nullable().default(null)` suông thì chuỗi rỗng vẫn lọt. Nên rút
   `CategoryDescriptionSchema` thành một hàm dựng theo trần độ dài (danh mục
   500, điểm đến 2000).
8. **Câu báo lỗi khuôn slug phải khớp với khuôn đã siết.** ĐÃ SỬA 23/09 sau
   lượt thử tay F14: `slugShape` nay nói "single hyphens between words" kèm
   một ví dụ hợp lệ, và ô slug đã tắt soát chính tả / tự viết hoa / tự sửa
   chữ. Form điểm đến dùng lại ĐÚNG câu và đúng ba thuộc tính ấy — chép lại
   bằng tay là lại sinh ra một câu lỗi lệch luật.

**Tầng web — bước mà bản plan đầu THIẾU (xem Task 9a)**

9. **Điểm đến có đúng cái lỗ mà danh mục vừa vá.** `listDestinations` lọc
   `isActive`, còn lọc tour theo điểm đến thì không. Hệ quả là link cũ vẫn lọc
   đúng, nhưng chip đang bật in slug thô (nhánh `?? value` ở
   `tours-explorer.tsx`) và thẻ facet không có ô nào để bỏ tick. Hôm nay lỗi
   này đang ngủ vì chưa ai ẩn được điểm đến; F15 thêm nút Hide là nó thức dậy.
10. **`fetchDestinations` có 11 chỗ gọi trên web**, không phải ba như spec §4.6
    kể (trang vùng, tile, facet). Còn trang chủ, trang About (cả khối con số),
    blog (`splitTagFamilies` xếp tag theo slug điểm đến), và trang Account (hộ
    chiếu của khách). Đo xem ẩn một điểm đến gây ra gì ở TỪNG chỗ, rồi mới viết
    câu cảnh báo trong hộp xác nhận. Cả hai câu copy nói sai của F14 đều sinh
    ra vì viết trước, đo sau.

**Tầng admin**

11. `FormField` đã nằm ở kit — dùng lại, đừng chép. `hasFormErrors` đang có hai
    bản (departures và categories); tới bản thứ ba thì rút chung.
12. Cờ bận của bảng truyền qua context (nếp `BusyContext`), không nhét vào deps
    của `useMemo` dựng cột.
13. **Nút Hide/Show dùng kit `StableLabel`** (có từ lượt thử tay F14, 23/09):
    hai nhãn rộng khác nhau, cụm nút canh phải, nên thiếu nó thì cụm nút của
    các hàng lệch cột. Nút nào chỉ có ở MỘT số hàng thì giữ một ô trống cùng
    cỡ — xem ô giữ chỗ nút huỷ ở `departure-row-actions.tsx`.
14. **Câu cảnh báo nào là câu TRẤN AN thì xin `warningTone="neutral"`** ở kit
    `ConfirmWriteDialog`. Hộp ẩn danh mục từng tô đỏ cả câu "tour vẫn bán,
    link vẫn chạy" — màu nói ngược với chữ.

**Test và quy trình**

15. **Mỗi ca test mới phải kiểm bằng đột biến.** F14 có ba ca xanh giả: một ca
    đua bắn hai lệnh thực chất là CÙNG một phép đổi chỗ; một ca khẳng định
    "không gọi" mà chẳng bấm gì; một ca contract xanh vì thiếu khoá bắt buộc,
    chứ không vì cái luật nó định ghim.
16. **Khớp tên CHÍNH XÁC, đừng dùng `/…/i`** khi slug và tên chỉ khác nhau ở
    chữ hoa — regex bỏ qua hoa-thường xanh cả khi chip in slug.
17. **Ký tự Unicode trong regex hay trong test thì dựng từ mã số**
    (`String.fromCodePoint`) hoặc dùng lớp `\p{…}`. Công cụ ghi file đổi escape
    `\uXXXX` thành ký tự thô (đo 22/09 bằng `cat -A`).
18. **Comment không khai trạng thái tương lai** kiểu "Task X sẽ…" — merge xong
    là nó thành lời nói sai.
19. **Entry CHANGELOG viết vào đúng ngày merge.** `docs-freshness.sh` lọc theo
    ngày commit, mà rebase thì đổi ngày commit — CI đỏ ngày 23/09 là vì thế.
    Session thi công ghi entry theo ngày nó viết; session review thêm entry
    merge vào đúng ngày merge.

**Hai bài học từ vòng review F16 (23/09)**

20. **Một chữ cho mỗi khái niệm.** Điểm đến ẩn/hiện bằng đúng cặp chữ của danh
    mục (Hide/Show, dấu "(hidden)") — đọc `messages.admin.categories` trước khi
    viết copy mới. "On sale"/"Off sale" là chữ của công tắc đăng TOUR, còn
    "Bookable" là của chuyến; F16 từng để "On sale" nói hai nghĩa trên hai màn
    cạnh nhau.
21. **Khe deploy.** Vercel thường xong trước Render. Trong vài phút ấy màn
    `/destinations` mới gọi `admin.destinations.*` mà API cũ chưa có — chấp
    nhận được với một trang MỚI: page ném lỗi và boundary `app/error.tsx` hiện
    trang báo lỗi kèm nút thử lại, cùng cách `/categories` xử lỗi fetch. Nhưng
    KHÔNG thêm field bắt buộc vào response của endpoint CŨ
    mà trang đang chạy đọc, trừ khi phía đọc có đường lùi: F16 từng làm trang
    Departures sập 500 đúng vì thế.

## Task 6 — Từ vựng vùng miền về contract (ADR-0045)

**Files:**
- Create: `libs/shared/contract/src/schemas/regions.ts` (+ `.spec.ts`)
- Modify: `apps/web/src/mocks/regions.ts`, `libs/shared/contract/src/index.ts`
- Test: spec ghim `generateStaticParams` của `/destinations/[region]`

**Produces:** `REGIONS` (ba mục `key`/`slug`/`name`) · `RegionNameSchema`
(enum ba `name`) · type `RegionKey`

- [x] **B1.** Spec TRƯỚC ở contract: đúng ba vùng · slug là
      `northern-vietnam`/`central-vietnam`/`southern-vietnam` · `RegionNameSchema`
      nhận đúng ba `name` và từ chối `'North'`.
- [x] **B2.** Spec TRƯỚC ở web: `generateStaticParams()` trả đúng ba slug ấy.
      Đây là lưới của rủi ro spec §6 — dời sai là ba trang vùng biến khỏi build.
- [x] **B3.** Chạy ĐỎ cả hai.
      *Ghi khi thi công:* ca `generateStaticParams` là lưới ghim nên XANH từ
      trước khi dời (mock cũ đã có đủ ba slug). Cái ĐỎ ở web là ca thứ hai:
      `REGIONS` của web phải là CHÍNH mảng của contract (so tham chiếu). Ca
      ghim được kiểm bằng đột biến — cắt một vùng ở contract, hay cắt lát
      `REGIONS` trong page, đều đỏ.
- [x] **B4.** Viết `regions.ts` ở contract; `apps/web/src/mocks/regions.ts` chỉ
      còn `export { REGIONS } from '@tourism/contract'` (giữ đường import cũ để
      các trang vùng không phải sửa).
      *Ghi khi thi công:* luật so khớp của `regionOf` cũng dời về contract
      thành `findRegion` — admin cần CÙNG luật ấy để chọn sẵn ô vùng của form
      sửa (spec §5 "chuẩn hoá `region`"), và hai bản luật là một hàng web xếp
      vào miền Bắc mà admin báo "chưa có vùng". `regionOf` giữ nguyên chữ ký,
      chỉ gọi sang. `MockRegion`/`MockRegionKey` thành bí danh của `Region`/
      `RegionKey` ở contract, để web không còn bản khai kiểu thứ hai.
- [x] **B5.** Xác nhận `regionOf` vẫn ghép được dữ liệu prod (`Northern Vietnam`).
      *Ghi khi thi công:* đo trên DB dev (seed cùng fixture với prod 18/09, không
      chạm Supabase theo luật 15) — ba giá trị `Central/Northern/Southern
      Vietnam` của 18 hàng đều ra đúng vùng qua `findRegion`.
- [x] **B6.** `pnpm gate:int` xanh.
- [x] **B7.** Commit: `refactor(contract): ba vùng miền về contract theo ADR-0045`

## Task 7 — Contract `admin.destinations`

**Files:**
- Create: `libs/shared/contract/src/schemas/admin-destinations.ts` (+ `.spec.ts`)
- Modify: `libs/shared/contract/src/contract.ts`, `index.ts`

**Produces:** `AdminDestinationRowSchema` (`id` · `slug` · `name` · `country` ·
`region` · `description` · `isActive` · `tourCount`) và ba input.

- [x] **B1.** Spec TRƯỚC: slug ≤ 80 · country ≤ 60 mặc định `'Vietnam'` ·
      `region` dùng `RegionNameSchema` (từ chối chuỗi lạ) · description ≤ 2000 ·
      `update` KHÔNG có slug.
      *Ghi khi thi công:* mặc định `'Vietnam'` CHỈ ở lệnh tạo; lệnh sửa bắt
      buộc gửi `country`, vì một client quên ô này mà schema tự điền là âm thầm
      đổi dữ liệu người ta không chạm. Schema HÀNG để `slug` và `region` lỏng
      (mô tả thứ DB đang giữ): output mà chặt thì một hàng kiểu cũ làm cả bảng
      sập 500 đúng lúc admin cần mở nó ra sửa.
- [x] **B2.** Chạy ĐỎ, rồi viết schema + bốn procedure.
      *Ghi khi thi công:* bài học 6 và 7 làm ở đây — `SLUG_PATTERN` và
      `slugSchema(max)` về `slug.ts`, `descriptionSchema(max)` về `common.ts`,
      danh mục đổi sang dùng cả hai (hành vi không đổi, câu lỗi không đổi).
- [x] **B3.** `pnpm gate:int` xanh.
- [x] **B4.** Commit: `feat(contract): thêm admin.destinations với bốn thao tác`

## Task 8 — API điểm đến

**Files:**
- Create: `apps/api/src/modules/catalog/admin-destinations.service.ts`,
  `admin-destinations.controller.ts`, `admin-destinations.int.spec.ts`
- Modify: `apps/api/src/modules/catalog/catalog.module.ts`

- [x] **B1.** Int spec TRƯỚC: `list` trả cả hàng đã tắt kèm `tourCount` ·
      slug trùng → 409 · `update` đổi được `region` và **không** đổi slug ·
      `setActive` không đụng liên kết `tour_destinations` (đếm trước/sau bằng
      nhau — đây là chốt của quyết định "không xoá", spec §2a) · khách → 403.
      *Ghi khi thi công:* lượt chạy đỏ lộ ba ca xanh giả — một route CHƯA tồn
      tại cũng trả 404 kèm `NOT_FOUND`, và "slug không đổi" đúng sẵn khi lệnh
      sửa không chạy. Hai ca 404 nay khớp CÂU của contract, ca slug đòi lệnh sửa
      trả 200 trước.
- [x] **B2.** Chạy ĐỎ, rồi viết service + controller đúng khuôn Task 3.
      *Ghi khi thi công:* KHÔNG có khoá advisory (bảng không có `order`) — mỗi
      lệnh ghi là một câu, bắt `P2002`/`P2025` ngay tại câu ấy (bài học 1–2).
      Bài học 4 làm ở đây: `apps/api/src/lib/contract-error.ts` (`ContractError`
      mang mã + `toContractError`), danh mục chuyển sang dùng nó. `mapError`
      của departures GIỮ NGUYÊN — code departures của F16 nằm ngoài phạm vi
      F15 — nên nợ G3 mới đóng được hai trên ba bản.
- [x] **B3.** Bust `TAGS.TOURS` sau commit.
      *Ghi khi thi công:* có ca int canh thứ tự — cờ theo dõi đọc DB ngay lúc
      bust được gọi và phải thấy giá trị mới; lệnh ghi hỏng thì không bust.
- [x] **B4.** `pnpm gate:int` xanh.
- [x] **B5.** Commit: `feat(api): bốn endpoint quản trị điểm đến`

## Task 9a — Web chịu được điểm đến đã ẩn (THÊM sau vòng review F14)

Phải merge **cùng một lượt** với Task 9: nút Hide không được phép có mặt khi
phía web chưa chịu được nó. Xem bài học 9 và 10 ở đầu phần F15.

**Files:**
- Modify: `apps/web/src/lib/tours.ts` — tổng quát `resolveCategoryOptions` để
  dùng được cho cả hai facet (hoặc viết bản điểm đến song song, nếu tổng quát
  làm hàm khó đọc hơn)
- Modify: `apps/web/src/components/tours/tours-explorer.tsx`,
  `apps/web/src/app/(site)/tours/(listing)/page.tsx`
- Test: `apps/web/src/lib/tours.spec.ts`, `tours-explorer.spec.tsx`

- [x] **B1.** Đo 11 chỗ gọi `fetchDestinations` (bài học 10): ẩn một điểm đến
      thì mỗi chỗ đổi ra sao. Ghi kết quả vào spec §4.6 TRƯỚC khi viết code —
      bảng đo ấy chính là nguồn cho câu cảnh báo ở Task 9.
      *Ghi khi thi công:* 7 lời gọi ở 7 trang (số 11 của bài học 10 tính cả 4
      component nhận danh sách qua prop), tỏa ra 14 hệ quả — bảng ở spec §4.6.
      Hai hệ quả không nằm trong file của task này (`/blog` đổi trục tag,
      hộ chiếu của khách mất mục) nên KHÔNG vá ở đây; hộp xác nhận nói thẳng.
- [x] **B2.** Spec TRƯỚC: điểm đến đã ẩn mà đang lọc thì chip in TÊN, và thẻ
      facet có ô đang tích để bỏ · endpoint hỏng (`null`) thì suy từ tour, khác
      với mảng rỗng.
- [x] **B3.** Chạy ĐỎ, cài, rồi kiểm đột biến từng ca mới.
      *Ghi khi thi công:* tổng quát thành `resolveFacetOptions` riêng tư, hai
      hàm bọc `resolveCategoryOptions` (chữ ký giữ nguyên) và
      `resolveDestinationOptions` (tên tra từ MỌI điểm dừng, không riêng điểm
      chính). Endpoint hỏng thì eyebrow "across n destinations" đếm điểm đến
      suy từ tour — nhánh cũ in "across 0 destinations". Mười đột biến đều bị
      giết; ca component ban đầu không canh số tour trên ô được bù, đã siết.
- [x] **B4.** Trang listing truyền `destinationsRes.ok ? data : null`, không
      phải `data ?? []`.
- [x] **B5.** `pnpm gate:int` xanh.
- [x] **B6.** Commit: `fix(web): điểm đến đã ẩn vẫn có tên và vẫn bỏ tick được`

## Task 9 — Màn `/destinations`

**Files:**
- Create: `apps/admin/src/lib/destinations-view.ts` · `destinations-write.ts` ·
  `api/destinations.ts` (+ spec)
- Create: `apps/admin/src/app/(admin)/destinations/page.tsx`, `actions.ts`
- Create: `apps/admin/src/components/destinations/*.tsx` (+ spec)
- Modify: `apps/admin/src/lib/nav.ts`, `libs/shared/i18n/src/lib/messages.ts`

- [x] **B1.** Component spec TRƯỚC: ô `region` là **danh sách chọn ba mục**,
      không phải ô chữ · ô slug mở khi tạo, vắng khi sửa · hộp xác nhận tắt in
      đúng `tourCount` và nói đủ hệ quả. Các hệ quả lấy từ bảng đo của Task 9a
      B1, KHÔNG lấy từ danh sách ba mục của spec §4.6 bản đầu — danh sách ấy
      thiếu trang chủ, About, blog và hộ chiếu của khách.
      *Ghi khi thi công:* hộp Hide có thân (ba chỗ điểm đến rời khỏi), một
      danh sách bốn hệ quả không hiển nhiên (hai dòng trang vùng — vắng khi
      điểm đến chưa có vùng — hộ chiếu của khách, tag blog) và câu trấn an
      giọng trung tính.
- [x] **B2.** Chạy ĐỎ, rồi dựng theo đúng khuôn Task 4.
      *Ghi khi thi công:* ô vùng là `<select>` gốc đọc `REGIONS` của contract;
      form sửa chọn sẵn tên CHUẨN qua `findRegion`, nên một hàng lưu kiểu cũ
      (`central`) lưu lại là thành `Central Vietnam`. Cột Region báo "No region"
      khi chuỗi trong DB không khớp vùng nào. Bài học 11: `hasFormErrors` về
      `lib/form-errors.ts`, danh mục đổi sang dùng; bản của departures GIỮ
      NGUYÊN (code F16). Bài học 20: Hide/Show/Visible/Hidden, câu lỗi và câu
      gợi ý slug thành hằng dùng chung ở `messages.ts`, danh mục đọc cùng hằng.
- [x] **B3.** Ô slug điền sẵn bằng `slugifyVietnamese(name, 80)`.
- [x] **B4.** Bật mục `destinations` ở `nav.ts`.
- [x] **B5.** `pnpm gate:int` xanh.
- [x] **B6.** Commit: `feat(admin): màn quản trị điểm đến`

## Task 9b — Docs sweep F15

- [x] **B1.** Entry `docs/CHANGELOG.md`.
- [x] **B2.** Gạch mục P4e-2 ở `docs/open-items.md`; đóng nợ G3 nếu đã rút
      `mapError` về một chỗ (bài học 4).
      *Ghi khi thi công:* G3 CHƯA đóng — `mapError` và `hasFormErrors` của
      departures còn bản riêng (code F16, ngoài phạm vi F15); hàng G3 ghi lại
      phần còn thiếu. Thêm G4 (hai hệ quả phía web của nút Hide chưa vá) và G5
      (trang chi tiết tour giữ tên điểm đến cũ tới hết lượt ISR). Luật 13: cập
      nhật `glossary.md` (thêm Vùng, trạng thái Visible/Hidden) và
      `overview.md` (mục catalog của trang quản trị).
- [x] **B3.** `./scripts/docs-freshness.sh` xanh. **KHÔNG merge** (sửa 24/09):
      dừng ở đây và bàn giao cho session review — merge, CI và nghiệm thu tay
      là việc của session ấy.

---

## Nghiệm thu cuối (sau khi cả hai merge)

> **Đổi thứ tự 23/09:** F14 được thử tay RIÊNG ngay sau khi merge, không đợi
> F15 — F14 đã chạy thật trên production, còn F15 sẽ chép lại cách làm của nó,
> nên lỗi tìm được ở F14 lúc này là lỗi F15 khỏi phải lặp. Kết quả ghi ở
> `docs/CHANGELOG.md`. Phần dưới đây còn lại cho F15.

- [ ] `pnpm gate:int` trọn xanh trên `main`.
- [ ] Liếc đèn CI sau push (luật 14).
- [ ] **Chạy thử tay trên production, mỗi lượt một bước** (nếp đã chốt 17/09):
      tạo một danh mục → sắp lên đầu → xem `/tours` đổi thứ tự chip → tắt nó →
      xem chip biến mất mà tour vẫn còn → bật lại. Rồi đổi vùng của một điểm đến
      và xem nó nhảy sang trang vùng khác.
- [ ] Ghi vào `open-items.md` bất cứ thứ gì lượt thử tay phát hiện — lượt thử
      tay của F13 tìm ra một câu copy nói dối mà 3.877 test không thấy.

---

## Prompt bàn giao cho session thi công F15

Dán nguyên khối dưới đây vào một session Claude Code MỚI mở tại
`C:\Programming\Devs\Projects\Tourism-Platform-V2`.

```text
Bạn là session THI CÔNG của tourism-v2, làm việc NGAY TRONG checkout gốc
C:\Programming\Devs\Projects\Tourism-Platform-V2 (không tạo worktree). Đọc
theo thứ tự:
  CLAUDE.md                                                      (15 luật + gotcha)
  docs/README.md                                                 (bản đồ tài liệu)
  docs/adr/0045-region-vocabulary-in-contract.md                 (quyết định)
  docs/specs/2026-09-22-p4e-2-categories-destinations-design.md  (spec — HỢP ĐỒNG)
  docs/plans/2026-09-22-p4e-2-categories-destinations.md         (plan — phần F15)

VIỆC: tính năng F15 — màn quản trị điểm đến /destinations (tạo, sửa, ẩn/hiện,
không xoá), ba vùng miền dời về @tourism/contract, và web chịu được điểm đến đã
ẩn. Làm Task 6 → 7 → 8 → 9a → 9 → 9b, đúng thứ tự ấy (9a TRƯỚC 9: bảng đo của
9a là nguồn cho câu cảnh báo ở 9), mỗi task một commit. F14 (Task 1–5b) đã
xong, đừng đụng lại. Không làm gì ngoài plan; thấy plan sai thì dừng và hỏi tôi.

TRƯỚC DÒNG CODE ĐẦU TIÊN: đọc hết 21 bài học ở đầu phần F15 của plan. F15 là
bản song sinh của F14; vòng review F14 tìm ra 15 lỗi thật, và lỗi nào cũng có
thể lặp lại ở đây.

MỞ ĐẦU
- `git status` phải sạch và đang ở `main`; `git log --oneline -3` phải thấy
  commit "docs: prompt bàn giao F15…". Rồi:
  git checkout -b feat/p4e-2-destinations
- Docker Postgres phải đang chạy (`docker ps`) — integration test cần nó.

LUẬT BẤT DI BẤT DỊCH CỦA SESSION NÀY
- KHÔNG merge, KHÔNG push, KHÔNG rebase, KHÔNG dùng subagent.
- KHÔNG chạm hạ tầng sống (CLAUDE.md §15): không Supabase, không webhook, không
  env/redeploy Render/Vercel, không Cloudinary. F15 không có migration; thấy
  mình sắp cần một cái thì DỪNG và hỏi tôi.
- KHÔNG sửa apps/api/prisma/, apps/mobile, module bookings/payments, code
  departures của F16. Diff chạm vào chúng là bị trả review.
- TDD (luật 4): test đỏ đúng lý do trước, rồi mới cài. Ca test mới nào cũng
  phải kiểm bằng đột biến (bài học 15) — làm thật (sửa code cho sai, thấy đỏ,
  trả lại), ghi kết quả.
- Gate cuối mỗi task theo mục "Quy trình gate" của plan: chạy tách bước, hãm
  song song (máy từng phình RAM khi chạy gate:int trần), cần API sống cho build
  web; xong thì tắt API bằng lệnh PowerShell trong plan.
- Comment code TIẾNG VIỆT (luật 8); copy người dùng thấy bằng TIẾNG ANH trong
  @tourism/i18n (luật 7). Tokens-only, không hex (luật 6).
- Commit Conventional Commits, message TIẾNG VIỆT CÓ DẤU, KHÔNG AI attribution —
  không dòng Co-Authored-By (luật 12). Stage theo đường dẫn tường minh, không
  `git add -A`. Chạy `pnpm lint:fix` trước khi stage.
- Contract và i18n được đọc từ dist: sửa xong phải build lại trước khi test
  api/admin/web (lệnh ở Ràng buộc toàn cục của plan).
- Rà docs/skills.md trước khi bắt tay (luật 9).

NĂM CHỖ DỄ SAI (plan có đủ 21 bài học)
1. Slug trùng: bắt P2002 ngay ở lệnh ghi rồi đổi thành SLUG_TAKEN 409; không
   SELECT kiểm trước, không assertExists rồi mới update (bài học 1–2).
2. Dời ba vùng về contract mà generateStaticParams của /destinations/[region]
   mất một slug là ba trang vùng biến khỏi build. Viết test ghim đủ ba slug
   TRƯỚC khi dời (Task 6).
3. Ẩn một điểm đến đụng 11 chỗ gọi fetchDestinations trên web. Đo từng chỗ, ghi
   vào spec §4.6, RỒI mới viết câu cảnh báo của hộp Hide (Task 9a B1 → Task 9 B1).
4. Web: điểm đến đã ẩn mà đang được lọc thì chip in TÊN chứ không in slug, và
   thẻ facet có ô đang tích để bỏ; endpoint hỏng (null) khác mảng rỗng (Task 9a).
   Test khớp tên chính xác, không dùng /…/i (bài học 16).
5. Dùng lại, đừng chép: SLUG_PATTERN chung ở slug.ts; câu lỗi slugShape và ba
   thuộc tính tắt soát chính tả của ô slug; FormField; StableLabel;
   warningTone="neutral" cho câu trấn an; chữ Hide/Show của danh mục. Tới bản
   thứ ba thì rút hasFormErrors và mapError về một chỗ (bài học 4, 6–8, 11,
   13–14, 20).

BÀN GIAO KHI XONG
Không merge. Viết cho tôi: danh sách commit; kết quả gate (số test từng gói, số
int); đột biến đã thử và kết quả; bảng đo 11 chỗ gọi fetchDestinations; chỗ lệch
plan và vì sao; việc cần hạ tầng (dự kiến: không có).
```
