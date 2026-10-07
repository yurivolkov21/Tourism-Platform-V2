# Spec — Đợt sửa sạn giao diện admin

05/10/2026 · thay chỗ P4f (user hoãn P4f cùng ngày để dọn sạn admin trước freeze 15/10).
Nhánh `fix/admin-ui-polish`, tách từ `main` `163c348b`.

- **Đầu vào:** bốn sạn user gửi 05/10 và mười sạn agent tự rà trên admin production cùng
  ngày (màn 1570px và 375px, chỉ xem).
- **Quyết định đã chốt** qua brainstorm 05/10 (user chọn cả bốn phương án đề xuất, rồi duyệt
  thiết kế):
  - Dropdown: "ô như ô nhập, danh sách như menu lọc".
  - Summary: giữ 2 dòng, báo khi bị cắt.
  - Xoá: chỉ khi không còn tour nào dùng.
  - Quick Create: thành menu tạo nhanh.
- **ADR đi trước:** [ADR-0053](../adr/0053-delete-unused-categories-destinations.md) — xoá
  danh mục và điểm đến khi chưa tour nào dùng.

## 1. Phạm vi

Ba khối, mỗi khối thử tay riêng được:

- **A.** Một kiểu ô chọn cho cả admin (`Picker`), Quick Create thành menu.
- **B.** Xoá danh mục và điểm đến chưa tour nào dùng.
- **C.** Mười ba sạn nhỏ.

**Ngoài phạm vi, cố ý:**

- Ô chọn ngày native (`<input type="date">` ở lịch khởi hành, giờ đăng bài): mỗi trình duyệt
  một dáng, nhưng thay nó là một component lịch mới — không đáng ở tuần trước freeze.
- Nút "Clear filters" đỏ nhạt và nút Export chữ mono viết hoa: thiết kế có chủ đích, có ghi
  lý do trong code.
- Web khách và mobile — trừ `popover.tsx`/`tooltip.tsx` của `@tourism/ui` (§2.4), dùng chung.
- Không migration, không đổi schema DB.

## 2. A — Ô chọn chung `Picker`

### 2.1 Hiện trạng (đo 05/10)

| Họ | Dùng ở | Dáng |
| --- | --- | --- |
| `ToolbarFilterMenu` (Menu) | `/outbox`, `/payment-events`, `/subscribers`, `/reports` | Nút outline 36px; danh sách thả xuống dưới, có nhãn nhóm, vạch ngăn, icon, dấu tích phải. **Mẫu user muốn.** |
| `FormSelect` (Select) | 10 chỗ trong 6 file, liệt kê ở §2.3 | Danh sách đè lên chính ô (`alignItemWithTrigger`); không nhãn nhóm, không icon; ô không đổi màu khi rê hay khi mở; mục đã ẩn ghép chữ "(hidden)" vào tên |
| `ToolbarSelect` (Select) | Nhánh màn hẹp của `StatusFilterTabs`; ô trạng thái `/enquiries` | Như trên, và rơi mất icon mà dải tab màn rộng có |
| `Select` trần | "Rows per page" của `TablePagination` | Như trên, cỡ `sm` |

Ba chỗ lệch nhau giữa các họ:

- Chiều cao ô: 28/32/36px.
- Mũi tên: `ToolbarFilterMenu` đậm, `ToolbarDateRange` `opacity-50`, Select
  `text-muted-foreground`.
- Lớp nổi: `Popover` và `Tooltip` của `@tourism/ui` là `z-50`, trong khi Select và Menu dùng
  `z-(--z-popover)`.

### 2.2 Thiết kế

`apps/admin/src/components/kit/picker.tsx` — vẫn là **Base UI Select**, chỉ đổi dáng. Giữ
nguyên bản chất ô chọn của form: role `combobox`/`listbox`/`option`, gõ chữ để nhảy, Esc đóng,
nhãn `FormField` qua `id`, `aria-invalid`, `aria-describedby`. `kit/list-editor.tsx` đang
focus `[role="combobox"]` nên không phải sửa.

**Dữ liệu vào**

- `PickerOption`: `{ value, label, icon?, hint? }`.
- Nhận `options` (một nhóm không nhãn) **hoặc** `groups` (`{ key, label?, options }[]`, vạch
  ngăn giữa các nhóm). Kiểu TS loại trừ nhau.
- Giá trị là chuỗi; `''` = chưa chọn, trigger hiện `placeholder`.
- Giữ hai lưới an toàn của kit cũ: Base UI phát `null` khi mục bị gỡ giữa chừng → bỏ qua; giá
  trị đi ra luôn là `String(...)`.

**Ô (trigger), hai biến thể**

- `field` (mặc định, trong form): cao 32px (`h-8`) và viền `border-input` như `Input`. Thêm
  nền nhạt khi rê chuột và khi đang mở — hiện ô không đổi gì ở light mode.
- `toolbar` (hàng điều khiển bảng): dáng nút của `ToolbarFilterMenu` — `Button` outline,
  `TOOLBAR_BUTTON` (36px). Nhãn sr-only cho mục đích của ô.
- Mục đang chọn có icon thì icon hiện bên trái chữ trên ô, ở cả hai biến thể.
- Mũi tên: `ChevronDownIcon` màu `text-muted-foreground` cho cả hai biến thể. Cùng lượt,
  `ToolbarFilterMenu` và `ToolbarDateRange` cũng chuyển về đúng màu này.

**Danh sách (popup)** — chép dáng `ToolbarFilterMenu`:

- Thả **xuống dưới** ô (`alignItemWithTrigger={false}`), không đè lên ô.
  - `field`: canh trái; rộng ít nhất bằng ô và nở theo mục dài nhất, tối đa 22rem.
  - `toolbar`: canh **trái**, rộng `w-66` như menu lọc. (Sửa sau review 07/10: ô toolbar duy
    nhất là `StatusFilterTabs`, nằm khe trái ở 9/10 nơi dùng — canh phải thì popup đè lên
    sidebar. Chạm mép viewport thì Base UI tự lật canh.)
- Nhãn nhóm chữ xs, `font-medium`, màu muted như `DropdownMenuLabel`; vạch ngăn giữa nhóm;
  icon tuỳ chọn đầu mục; dấu tích bên phải (đã có).
- `hint` in chữ muted bên phải tên, **thay cho** "(hidden)" ghép vào tên. Hint hiện cả trong
  danh sách lẫn trên ô, để ô đang chọn một danh mục đã ẩn vẫn nói ra điều đó.
- Sửa sau review 07/10: MỘT component `kit/option-content.tsx` vẽ dòng lựa chọn (tên + hint)
  cho cả danh sách `Picker`, ô `Picker` lẫn mục và nút của `ToolbarFilterMenu`: tên dài cắt
  "…" và mang `title` là tên đầy đủ; tên trợ năng đọc "Tên (Hidden)" ở mọi nơi
  (`optionName`, khoá `admin.option.withHint`). Vạch ngăn giữa nhóm ra khỏi cây trợ năng.
- Hằng class của popup, nhãn nhóm và mục tách ra một file kit (`kit/menu-style.ts`), cả
  `Picker` lẫn `ToolbarFilterMenu` cùng đọc — đổi dáng ở một chỗ thì cả hai cùng đổi.

**Hai kit cũ:** `FormSelect` và `ToolbarSelect` bị gỡ khi hết consumer. Hai hàm
`fromFreeValue`/`toFreeValue` đang re-export qua `toolbar-select.tsx` thì consumer import
thẳng từ `kit/filter-value`. Spec của hai kit cũ chuyển thành spec của `Picker`.

`ToolbarFilterMenu` vẫn là Menu (chọn xong là điều hướng URL) và không đổi hành vi, chỉ đọc
hằng style chung.

### 2.3 Thay ở đâu

| Chỗ | Biến thể | Nhóm, hint, icon |
| --- | --- | --- |
| Hộp New tour — Category | `field` | Mục đã ẩn mang hint "Hidden" |
| Hộp New tour — Primary destination | `field` | Hint "Hidden" |
| Tab Details — Category | `field` | Hint "Hidden" |
| Tab Details — Difficulty | `field` | — |
| Tab Details — Destination (từng dòng) | `field` | Hint "Hidden" |
| Tab Costs — Category, Basis | `field` | — |
| Tab Content — Policy kind | `field` | — |
| Form điểm đến — Region | `field` | — |
| Hộp thư viện ảnh — lọc địa danh | `field` | Nhóm "This tour" tách vạch khỏi nhóm có nhãn "Destinations" |
| `StatusFilterTabs`, nhánh màn hẹp | `toolbar` | Icon trạng thái y như dải tab màn rộng |
| Ô trạng thái `/enquiries` | `field` | Icon trạng thái; cao 32px cho bằng nút "Change status" đứng cạnh |
| Rows per page | `field` | Mở lên trên (`side="top"`); 32px bằng các nút phân trang |

Copy "Hidden" vào `@tourism/i18n`. Hàm `optionLabel` ở `lib/tour-editor-view.ts` thôi ghép
"(hidden)" vào tên. Mọi spec đang tìm option theo tên có "(hidden)" sửa theo. (Sửa sau review
07/10: chữ NHÌN THẤY tách thành hint, còn tên trợ năng vẫn mang "(Hidden)" — kể cả radio
Primary của tab Details; bỏ hẳn thì trình đọc màn hình không biết mục đã ẩn.)

### 2.4 Lớp nổi của Popover và Tooltip

`libs/shared/ui/src/components/popover.tsx` và `tooltip.tsx` đổi `z-50` → `z-(--z-popover)`
(1500), cùng thang token với Select và Menu. `z-50` thấp hơn hộp thoại (`--z-modal` 1400) và
navbar web (`--z-sticky` 1100): đặt một popover hay tooltip vào trong hộp thoại là nó chìm.
Có test đếm token như `dropdown-menu.spec.ts`.

Sửa sau review 07/10: AlertDialog còn `z-50` nên nằm DƯỚI Sheet và hộp thoại (hộp "Discard
changes?" mở dưới sidebar trên điện thoại) và dưới navbar web. Thêm tầng token `--z-alert`
(1450 — trên `--z-modal` 1400, dưới `--z-popover` 1500) cho backdrop và popup của
AlertDialog; hover-card, context-menu, combobox về `--z-popover`.

### 2.5 Quick Create

**Hiện trạng:** nút "Quick Create" và nút phong bì cạnh nó chép nguyên từ block dashboard-01,
không gắn hành động nào. User từng giữ chúng ngày 21/08 ("sau này sẽ cần"); 05/10 chốt thay
bằng menu.

- Nút Quick Create mở **Menu** bốn mục; nhãn dùng lại đúng chữ nút tạo của từng vùng, icon
  dùng lại icon của vùng ấy trên sidebar (`lib/nav.ts`):

  | Mục | Hộp mở ra |
  | --- | --- |
  | New tour | New tour ở `/tours` |
  | New post | New post ở `/posts` |
  | Add category | Add category ở `/categories` |
  | Add destination | Add destination ở `/destinations` |

- Sửa sau review 07/10 — bản đầu dùng tham số `?create=1` cộng `router.replace` gỡ nó; review
  bắt ba lỗi (cùng trang thì sinh hai mục lịch sử trùng URL và mất bộ lọc; `router.replace`
  kéo thêm một lượt render server). Nay MỘT cơ chế phía client, không tham số URL
  (`lib/quick-create.ts`):
  - bấm mục ghi một yêu cầu tạo trong bộ nhớ tab (`requestCreate`), sống 10 giây;
  - trang đích KHÁC trang hiện tại: Link tới path trần; bảng hay hộp của trang ấy mount thì
    tiêu thụ yêu cầu và mở hộp (`useCreateRequest`);
  - trang đích CHÍNH LÀ trang hiện tại: không điều hướng, hộp mở ngay, query lọc giữ nguyên;
  - yêu cầu tiêu thụ một lần, nên F5 hay Back không mở lại hộp; Ctrl/Cmd/Shift + bấm (mở tab
    mới) không ghi yêu cầu;
  - trên điện thoại bấm mục thì đóng Sheet sidebar; đóng hộp thì focus về nút Add/New của trang.
- Path và icon mỗi mục tra từ `NAV_GROUPS` theo khoá, không gõ lại.
- Form đang sửa dở: hộp hỏi rời trang (`kit/unsaved-changes.tsx`) chỉ `preventDefault` click của
  link, KHÔNG `stopPropagation` — chặn lan truyền ở pha capture làm `onClick` của mục menu không
  chạy, menu Quick Create kẹt mở và nổi trên hộp hỏi (sửa sau review 07/10).
- Menu mở bên dưới khi sidebar mở rộng, bên phải khi sidebar thu về cột icon. Ở cột icon, nút
  vẫn có tooltip như các mục khác.
- **Gỡ nút phong bì.** Nó không có đích, và Enquiries đã có mục riêng trên sidebar.

## 3. B — Xoá danh mục và điểm đến (ADR-0053)

### 3.1 Contract

| Thủ tục | Route | Lỗi | Kết quả |
| --- | --- | --- | --- |
| `admin.categories.delete` | `POST /api/admin/categories/{id}/delete` | `IN_USE` 409 · `NOT_FOUND` 404 | `{ slug }` |
| `admin.destinations.delete` | `POST /api/admin/destinations/{id}/delete` | `IN_USE` 409 · `NOT_FOUND` 404 | `{ slug }` |

- Input `{ id: uuid }`. Route `POST …/{id}/delete` và kết quả `{ slug }` theo đúng khuôn
  `admin.tours.delete`.
- `AdminCategoryRow` và `AdminDestinationRow` thêm `linkedTourCount` — số tour **mọi trạng
  thái** đang dùng hàng. `tourCount` giữ nguyên nghĩa: tour đang bán, nuôi câu cảnh báo lúc ẩn.
- JSDoc hai khối contract bỏ câu "KHÔNG có xoá" và trỏ ADR-0053.

### 3.2 API

**Danh mục**

- Câu xoá chạy trong `withCategoryOrderLock`.
- `P2003` (khoá ngoại `Restrict` của `tours`) → `CategoryInUseError` (`IN_USE`).
- `P2025` → `CategoryNotFoundError`.

**Điểm đến** — một `$transaction`:

1. `SELECT … FOR UPDATE` hàng điểm đến; không có hàng → `DestinationNotFoundError`.
2. Đếm `tour_destinations` của nó; còn dòng → `DestinationInUseError` (`IN_USE`).
3. `deleteMany` các dòng `media_assets` chủ `DESTINATION` của nó.
4. Xoá điểm đến.

Không `requeue` publicId nào vào hàng dọn (ADR-0053 §4).

**Chung cho hai bảng**

- Log `[admin] … deleted {id, slug}`.
- Bust `tours` sau commit, fire-and-forget; hỏng thì không bust.
- `list` và mọi lệnh ghi trả `linkedTourCount` cùng `tourCount`. Cả hai suy từ **cùng một lần
  đọc** liên kết tour của hàng, nên luôn `tourCount ≤ linkedTourCount`.

### 3.3 Admin

**Cột Tours**

- Tiêu đề đổi "Published tours" → "Tours".
- Ô in "5 tours", dưới là dòng muted "3 published". Bằng 0 thì in "No tours" muted — chính
  hàng ấy là hàng xoá được.

**Nút Delete** — nút thứ ba của hàng, sau Edit và Hide/Show:

- Dáng `outline`, chữ và icon `Trash2Icon` màu destructive.
- `linkedTourCount > 0`: nút khoá kiểu `aria-disabled` (`focusableWhenDisabled`, như các nút
  hàng khác). Tooltip "Used by 1 tour — hide it instead." / "Used by N tours — hide it
  instead." phải hiện được cả khi rê chuột lẫn khi focus bằng bàn phím.
- Sửa sau review 07/10:
  - nút chỉ mở khi đếm ĐÚNG 0; hàng thiếu `linkedTourCount` (khe deploy, API cũ) thì khoá với
    lý do chung "Delete isn't available right now. Reload the page and try again." và ô Tours
    in "—";
  - chạm nút đang khoá trên màn cảm ứng thì hiện lý do bằng toast (tooltip không mở bằng chạm);
  - xoá thành công thì focus sang nút Add của bảng (hàng và nút Delete đã bị gỡ);
  - lệnh ghi đi qua context của bảng, cột là hằng module: server action đổi danh tính mỗi lượt
    `router.refresh()`, để trong deps của cột thì mọi ô hành động bị dựng lại và focus rơi về
    `<body>` (cùng sửa ở bảng Departures).
- Bảng đang làm mới thì nút khoá như hai nút kia (cờ `disabled` sẵn có).

**Hộp xác nhận** (`ConfirmWriteDialog`, giọng đỏ):

| | Danh mục | Điểm đến |
| --- | --- | --- |
| Tiêu đề | Delete this category? | Delete this destination? |
| Thân | No tour uses this category, so nothing else changes. Its slug can be used again. | No tour goes to this destination. Its photos leave the photo library; tours keep any photos they already use. |
| Dòng | Category · Slug | Destination · Region · Slug |
| Cảnh báo | This cannot be undone. | This cannot be undone. |
| Nút | Delete category | Delete destination |

**Sau lệnh xoá**

- Lỗi `IN_USE`: "A tour started using this category a moment ago, so it can't be deleted.
  Hide it instead." (bản điểm đến cùng khuôn).
- Lỗi `NOT_FOUND`: "This category no longer exists."
- Toast thành công: "Category deleted" / "{name} is gone."
- Mọi kết cục đã chạm server đều làm mới bảng (`onSettled`).
- Phía khu sửa tour (sửa sau review 07/10, ADR-0053 AMEND 1): lưu tab Details hay tạo tour với
  danh mục hoặc điểm đến vừa bị xoá nhận `LINK_NOT_FOUND` — tab Details hiện dải lỗi, hộp New
  tour hiện câu báo; cả hai làm mới danh sách chọn và GIỮ chữ đang gõ, không đá về `/tours`.
- Server action `deleteCategoryAction` / `deleteDestinationAction` theo khuôn `actions.ts`
  sẵn có: re-parse input bằng schema contract, `cookies()` ngoài `try`, phân loại lỗi tại chỗ.

### 3.4 Kéo theo ở P4f

Plan và spec P4f viết trước ADR-0053. Cùng nhánh này sửa doc P4f:

- Hai khoá mới vào bảng `ADMIN_ACCESS`, tầng Owner — cùng họ `tours.delete`, `posts.delete`.
- Đếm lại mọi con số trong doc P4f lúc sửa, theo số `@Implement(contract.admin` thực tế:
  số `@Implement`, số thủ tục Owner, tổng thủ tục.

## 4. C — Sạn nhỏ

| # | Chỗ | Sạn (đo 05/10) | Sửa |
| --- | --- | --- | --- |
| 1 | Khung "Card on /tours" ở khu sửa tour | Summary cắt sau 2 dòng mà không ai báo. Khung rộng ~290px chữ 12px, tức ~24 em mỗi dòng — gần đúng card web trên điện thoại 360px; màn rộng card in được nhiều hơn | Giữ 2 dòng. Đo tràn (`scrollHeight > clientHeight`, đo lại khi chữ hay bề rộng đổi); tràn thì hiện dòng muted "The card cuts this after two lines; the tour page shows all of it." |
| 2 | Hộp Reject review | Thanh cuộn dính sát các lựa chọn | Hộp `sm:max-w-5xl` (1024px); cột lý do `minmax(0,20rem)`; vùng cuộn có lề phải và `scrollbar-gutter: stable` |
| 3 | Bảng Tours | Ô ảnh 40px mà tải ảnh gốc ~2400px, 20 ảnh mỗi trang | VM xin `w_160` như bảng Posts (`withDeliveryTransform`) |
| 4 | Bảng Subscribers | Nút Export CSV đè tiêu đề cột "Actions" (còn đọc được "Acti") | Gộp cột `export` vào ô tiêu đề cột Actions: nút canh phải, chữ "Actions" còn cho trình đọc màn hình |
| 5 | Dashboard | Đường doanh thu cong quá tay, vọt dưới 0 ở ngày không có doanh thu | `Area` `type="monotone"` |
| 6 | Bảng Outbox | Cuộn ngang ngay ở 1570px; cột Processed bị cắt | Thu hẹp cột Last error và dòng mã dưới cột Type, giữ `title` cho chuỗi đầy đủ. Đích: không cuộn ngang ở 1440px |
| 7 | Chi tiết booking | Email bẻ giữa chữ ("…@gmail.co" / "m") vì `wrap-anywhere` | Email in kèm cơ hội xuống dòng `<wbr>` sau `@`; `wrap-anywhere` của `LabelValueRow` còn làm lưới cuối. Áp cho mọi dòng email trong panel chi tiết admin |
| 8 | Chi tiết booking | Badge "Cancelled" đầu trang đỏ nhạt, trong Cancellation history xanh đậm | `cancellationStatusBadgeVariant('REFUNDED')` → `destructive`, cùng màu với booking `CANCELLED` |
| 9 | Chi tiết booking | Provider in thô "STRIPE" | Dùng lại map `messages.admin.paymentEvents.provider` (`Record` đủ member, vùng Payment events đang dùng) |
| 10 | Departures và mọi chỗ dùng `formatDateRange` | Chuyến một ngày in "27 Dec 2026 – 27 Dec 2026" | Ngày đầu trùng ngày cuối thì in một ngày |
| 11 | `/categories`, `/destinations` | Có tiêu đề lớn trùng thanh tiêu đề, các trang khác thì không | Bỏ tiêu đề lớn; câu giải thích giữ nguyên chỗ, thành dòng muted |
| 12 | Dashboard, Bookings ở màn hẹp | Bốn thẻ số liệu xếp dọc, chiếm hết màn đầu | Lưới thẻ 2 cột từ màn hẹp nhất; kiểm 375px không tràn |
| 13 | Ảnh trong admin | Ảnh hỏng thành ô xám trống (review của Emma Lindqvist, nợ G22) | Component ảnh của kit có `onError` → icon `ImageOffIcon` và chữ sr-only "Photo unavailable". Áp cho ảnh review, ô ảnh bảng Tours và bảng Posts |

## 5. Kiểm thử

**Unit (TDD)**

- `Picker`: mở, chọn, nhóm và nhãn nhóm, hint trên danh sách và trên ô, icon, placeholder,
  chặn `null`, bàn phím.
- Spec của mọi chỗ đã chuyển sang `Picker`.
- VM và copy của lệnh xoá: nút bật ở 0 tour, câu tooltip số ít/số nhiều, phân loại lỗi trong
  server action.
- Hook đo tràn Summary (giả `scrollHeight`/`clientHeight`).
- Hàm thuần của khối C: `formatDateRange`, variant badge, nhãn provider, URL thumb, tách email.
- Quick Create: cùng trang không điều hướng (giữ query), khác trang tới path trần rồi mở hộp;
  yêu cầu tạo tiêu thụ một lần, hết hạn sau 10 giây; Sheet điện thoại đóng; đóng hộp thì
  focus về nút Add/New.

**Integration**

- Xoá danh mục:
  - 0 tour → hàng mất;
  - có tour nháp → `IN_USE`, không gì đổi;
  - id lạ → `NOT_FOUND`;
  - xoá chen với `move` không để lại lỗi trần.
- Xoá điểm đến:
  - 0 tour → hàng và dòng ảnh `DESTINATION` mất, dòng ảnh `TOUR` mượn cùng publicId còn;
  - có liên kết (kể cả tour nháp) → `IN_USE`;
  - id lạ → `NOT_FOUND`;
  - đua với lệnh lưu tour gắn chính điểm đến ấy: không bao giờ cả hai cùng thành công.
- `list` trả `linkedTourCount` đúng và `tourCount ≤ linkedTourCount`.

**Cổng:** `pnpm gate:int` xanh trước khi khai xong (luật 11).

**Thử tay trên prod sau merge**, từng bước, chờ user xác nhận mỗi bước:

1. Dropdown ở khu sửa tour (Details, Costs, Content) và hộp New tour.
2. Lọc thư viện ảnh, Rows per page, ô trạng thái enquiry, dải trạng thái ở màn hẹp.
3. Quick Create: bốn mục mở đúng hộp tạo; cùng trang giữ bộ lọc; Back và F5 không mở lại; form
   đang sửa dở thì menu đóng và hộp hỏi rời trang hiện; điện thoại: Sheet đóng.
4. Danh mục đang có tour: nút Delete khoá, tooltip đúng.
5. Xoá điểm đến thử `abc` bằng nút Delete mới.
6. Hộp Reject và dòng báo Summary bị cắt.
7. Lượt qua mười một sạn còn lại.
8. Màn 375px.

## 6. Doc đi kèm

- Spec P4e-2 §2a: thêm một dòng trỏ ADR-0053 (quyết định cũ đã được thay).
- Doc P4f: §3.4.
- `docs/README.md`: thêm spec này và ADR-0053 vào bản đồ.
- `docs/CHANGELOG.md`: entry sau merge (luật 13).

## 7. Rủi ro đã biết

- **Khe deploy.** Push `main` thì Vercel (admin) xong trước Render (API) vài phút. Trong khe
  ấy admin mới gọi API cũ: `linkedTourCount` chưa có trong hàng, lệnh xoá trả 404. Chỉ một
  admin dùng, và thử tay luôn chờ Render live — chấp nhận, không thêm cờ tương thích. (Sửa
  sau review 07/10: nút Delete khoá theo mặc định khi hàng thiếu số tour, ô Tours in "—", nên
  khe chỉ làm nút tạm khoá; API mới gặp admin cũ thì `LINK_NOT_FOUND` rơi về thông báo lỗi
  chung — ADR-0053 AMEND 1.)
- **Đổi tên option phá spec cũ.** Bỏ "(hidden)" khỏi tên làm đổi tên trợ năng của option;
  spec nào tìm theo tên cũ sẽ đỏ. Sửa trong cùng task với chỗ đổi.
- **Thẻ số liệu 2 cột ở 375px:** con số tiền dài có thể chật. Nếu tràn thì thu cỡ chữ con số
  ở màn hẹp, không quay lại 1 cột.
