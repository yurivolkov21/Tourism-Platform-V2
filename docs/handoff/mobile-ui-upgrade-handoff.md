# Bàn giao nâng cấp giao diện app mobile — Material 3 cho Android (đợt 23–30/10)

> Viết cho Nghĩa. Vòng 1 do Nghĩa vẽ ngày 14/10; user review và chốt bản cuối ngày 19/10
> sau ba vòng sửa. Đợt này **chỉ đổi giao diện**: không đổi API, không thêm dependency, không
> đổi luồng màn.

Bản vẽ đã duyệt: `docs/design/mockups/mobile-ui-upgrade.src.html` (mở thẳng bằng trình duyệt;
bản xem online là artifact riêng tư của user, xin user chia sẻ) · Nền tảng:
[ADR-0040](../adr/0040-mobile-app-expo.md) · Luật chung các cụm mobile:
[mobile-browse-handoff](mobile-browse-handoff.md) §2 · Chạy thử:
[mobile-dev-loop](../conventions/mobile-dev-loop.md).

**Vì sao đổi.** Vòng 1 giữ nguyên bố cục, chỉ thêm bóng và kính mờ, nên app vẫn có dáng web
responsive: tiêu đề serif nằm như heading trang, chữ 14px cho tên hàng, thẻ có viền và bóng
khắp nơi, thanh tab là ô vuông tự vẽ, thiếu điều khiển quen thuộc của hệ thống. Buổi
thuyết trình thử demo trên **Android** là chính, nên bản cuối theo
[Material 3](https://github.com/material-components/material-components-android/tree/master/docs/components)
(bản Expressive của Android 16). Hai chỗ user chốt riêng: **Home giữ bố cục cũ** với rail ba
vùng dọc, và **All/Upcoming/Past ở Trips chỉ bo tròn hai đầu**.

## 1. Đọc bản vẽ

- Khung 390×844 là dp thật. Đầu trang có nút Nền tối/Nền sáng và thu phóng; màn hẹp tự thu khung.
- **Nhãn dưới khung:** "Đổi bố cục" là bố cục khác code hiện có. "Để sau" (A5, A6, A8, C5) là
  màn vòng 1 vẽ lại nhưng **không làm đợt này**. Không nhãn: giữ bố cục, chỉ nhận lớp áo mới
  (chữ, icon, nút, thẻ, ô nhập, thanh điều hướng) — phần lớn đi theo component dùng chung.
- **Chú thích dưới mỗi khung là spec của khung đó.** Cuối trang có bảng việc code, cùng mã với
  mục 4 ở đây.
- Mã nguồn file có bốn lớp CSS chồng nhau theo bốn vòng. **Số đo đúng là khối "vòng 4"**
  (cuối thẻ `<style>`); ghi chú iOS ở khối vòng 3 là vết cũ, đừng làm theo.
- Không chép: ảnh minh hoạ (dải màu vẽ tay), thanh trạng thái, chấm camera.

Ba màu nền của mockup pha từ token bằng `color-mix`; React Native không có hàm này, nên quy đổi:

| Biến mockup | Vai trò Material 3 | Ở app |
| --- | --- | --- |
| `--sc` | surface container: nền thanh điều hướng đáy, bottom sheet | `muted` pha 45% vào `background` (tối: `secondary` 45%) |
| `--sch` | surface container high: thanh tìm, ô segmented chưa chọn | `muted` 75% (tối: `secondary` 80%) |
| `--grouped` | nền màn có danh sách thẻ rời | `muted` 35% (tối: dùng thẳng `background`) |

Nền phải **đục** (thanh điều hướng nằm đè nội dung), nên `withAlpha` không đủ — xem T0 mục 3.

## 2. Luật bắt buộc

1. Giữ đủ luật ở [mobile-browse-handoff](mobile-browse-handoff.md) §2: màn chỉ vẽ, route giữ
   state; token không hex (`scripts/check-mobile-tokens-only.mjs`); copy tiếng Anh qua
   `@tourism/i18n`; comment tiếng Việt; chỉ Biome; test jest-expo phải `await` mọi
   `fireEvent`/`unmount`/`rerender`.
2. **Không thêm dependency, không nâng phiên bản** (freeze 31/10). Mọi thứ đợt này dùng đồ đã
   cài: `expo-router` 57 (có `NativeTabs`), `@expo/vector-icons` (có bộ Material), font hệ thống.
   App chạy bằng Expo Go (ADR-0001 AMEND 1), nên không có module native mới.
3. **Không sửa thang chữ ở `libs/shared/tokens/style-dictionary/tokens.mjs`** — web dùng chung.
   Đổi cách `AppText` ánh xạ bậc và độ đậm (N2), không đổi token.
4. **Không đụng bố cục Home:** `RegionRail` và `home-metrics.ts` giữ nguyên (user chốt 19/10).
5. Mỗi việc một nhánh; commit Conventional, message tiếng Việt có dấu, không ghi AI
   attribution. Không chạm hạ tầng sống (CLAUDE.md luật 15).
6. **Cổng trước khi báo xong:** `pnpm gate:int` · `pnpm turbo run bundle --filter=@tourism/mobile`
   · `expo-doctor` (trong `apps/mobile`) · tokens-only · **ảnh chụp máy Android thật, nền sáng
   và nền tối, đặt cạnh khung mockup tương ứng** trong mô tả PR.

## 3. Việc phải làm trước (T0, xong trước 23/10)

1. **ADR-0040 AMEND 3** (luật 5 — ADR đi trước code). AMEND 1 §1–§2 đã ghi Literata cho tiêu
   đề, Archivo cho thân, bộ icon Feather; đợt này đổi cả ba, nên phải ghi lại: (a) chữ thân dùng
   font hệ thống, Literata chỉ còn biến thể `brand`; (b) icon bộ Material trong
   `@expo/vector-icons`; (c) thanh tab dùng `NativeTabs` nếu spike ở mục 2 đạt. Không thêm
   dependency nào. User duyệt AMEND trước khi code N1, N2, N5.
2. **Spike `NativeTabs` trên máy Android thật qua Expo Go (tối đa nửa ngày).** Import từ
   `expo-router/unstable-native-tabs` — API còn nhãn unstable, đọc kiểu trong
   `node_modules/expo-router/build/native-tabs/` chứ đừng đoán tên prop. Cần trả lời ba câu:
   chạy được trong Expo Go SDK 57 không; đặt được màu nền thanh, màu viên chỉ báo, màu nhãn
   theo token không; bấm lại tab đang mở có cuộn lên đầu không (`FloatingTabBar` hiện tự làm
   việc này qua sự kiện `tabPress`). Đạt cả ba thì N1 dùng `NativeTabs`; thiếu một thì giữ
   `FloatingTabBar` và vẽ lại theo khung — cùng hình, chỉ khác cách dựng. Ghi kết quả vào AMEND.
3. **Hàm thuần pha màu** trong `libs/mobile/ui/src/lib/theme.ts` (viết test trước): nhận hai màu
   token và tỉ lệ, trả màu đục. Dùng cho ba nền ở bảng mục 1. Không gõ màu tay.

## 4. Chia việc

P1 đổi theo mọi màn và tạo cảm giác app nhiều nhất, làm trước: hết giờ giữa chừng thì app vẫn
đồng bộ. P2 làm theo thứ tự nếu còn giờ. Cỡ việc là ước lượng để chia PR, không phải cam kết giờ.

| Mã | Ưu tiên | Việc | Khung | Chỗ sửa chính | Cỡ |
| --- | --- | --- | --- | --- | --- |
| N1 | P1 | Thanh điều hướng đáy | mọi tab | `apps/mobile/src/app/(tabs)/_layout.tsx`, `floating-tab-bar.tsx` | Vừa |
| N2 | P1 | Chữ hệ thống, thang Material 3 | mọi màn | `app-text.tsx`, `theme.ts` | Nhỏ |
| N3 | P1 | Nút, thẻ, ô nhập | mọi màn | `button.tsx`, `card.tsx`, `text-field.tsx` | Vừa |
| N4 | P1 | Tiêu đề lớn bốn tab | B2, B9, B10, F1 | component mới trong `@tourism/mobile-ui` | Nhỏ |
| N5 | P2 | Icon Material | mọi màn | mọi chỗ import `Feather` | Vừa |
| N6 | P2 | Danh sách thẻ rời | F1, F2, C1, C3, C6, D1–D3 | `ListGroup`, `ListRow` mới | Vừa |
| N7 | P2 | Chip lọc, segmented Trips | B2, B3, B10 | `chip.tsx`, component segmented mới | Nhỏ |
| N8 | P2 | Thanh tìm, search view | B2, B4, F5 | `search-field.tsx` | Nhỏ |
| B2 | P2 | Thẻ tour mới | B2, B9 | `tour-list-card.tsx`, route Explore và Saved | Vừa |
| B3 | P2 | Ảnh đầu trang vuốt ngang | B5 | `features/tour-detail/tour-detail-screen.tsx` | Vừa |
| B4 | P2 | Bốn bước đặt tour | C1–C4 | `features/booking/booking-parts.tsx`, ba route `bookings/new` | Nhỏ |
| B5 | P2 | Thẻ Next trip | B10 | `features/trips/trips-list.ts` (TDD), `trips-screen.tsx` | Vừa |

Đường dẫn `features/...` tính từ `apps/mobile/src/`; file component (`button.tsx`, `chip.tsx`…)
nằm ở `libs/mobile/ui/src/lib/`.

Thứ tự gợi ý: T0 (22/10) → N1 (23/10) → N2 và N4 (24/10) → N3 (25–26/10) → P2 theo bảng tới
30/10. Để trống 31/10–1/11 cho user review và gộp.

### Spec từng việc

- **N1 — thanh điều hướng đáy.** Tràn ngang, cao 80 cộng lề an toàn dưới, nền `--sc`. Mỗi tab:
  icon 24 nằm trong viên chỉ báo 56×32 bo 16 (tab đang chọn: nền `secondary`, icon đặc), nhãn
  12/16 medium luôn hiện (đang chọn: `secondary-foreground`, còn lại `muted-foreground`). Nhãn
  lấy từ `messages.mobile.tabs`. Bỏ phần chừa đáy `TAB_BAR_LIFT + TAB_BAR_TILE` ở `sceneStyle`.
- **N2 — chữ.** Biến thể hệ thống đặt `fontWeight` và **không** đặt `fontFamily`; biến thể
  `brand` làm ngược lại (xem mục 7). Bảng ánh xạ, bậc đọc từ token có sẵn:

  | Biến thể | Bậc token | Độ đậm | Font |
  | --- | --- | --- | --- |
  | `display` | `3xl` 30/36 | 400 | hệ thống |
  | `title` | `2xl` 24/32 | 400 | hệ thống |
  | `heading` | `base` 16/24 | 500 | hệ thống |
  | `subtitle`, `body` | `sm` 14/20, `base` 16/24 | 400 | hệ thống |
  | `label` | `sm` 14/20 | 500 | hệ thống |
  | `caption` | `xs` 12/16 | 400 | hệ thống |
  | `brand` (mới) | `3xl` hoặc `2xl` | — | `Literata_700Bold` |

  Mockup vẽ tiêu đề lớn 32 (Headline Large); app dùng bậc 30 để khỏi đổi token, chấp nhận.
  `brand` chỉ dùng cho chữ nằm trên ảnh và con số thương hiệu: tiêu đề onboarding, tên địa
  danh ở Home, tên tour trên ảnh đầu trang, số đếm ngược (D1, thẻ Next trip), "You're going!",
  tiêu đề bài viết.
- **N3 — nút, thẻ, ô nhập.** Nút chính và nút phụ cao 56, bo 28, chữ 16 medium, không bóng,
  không ánh; nút phụ nền `secondary`, chữ `secondary-foreground`, không viền; nút nhỏ cao 40 bo
  20 chữ 14 medium; nút phá huỷ nền `destructive`, chữ `primary-foreground`. Thẻ bo 16, không
  viền, không bóng, nền `card` đặt trên nền `--grouped`. Ô nhập outlined: cao 56, bo 4, viền 1
  `input`; đang gõ viền 2 `primary-emphasis`, lỗi viền 2 `destructive-emphasis`; icon 24
  `muted-foreground`; nhãn 12/16 nổi **nằm trên đường viền**, có nền che đường viền (mục 7);
  ô cao (`tall`) 96. Bỏ `iconVariant="boxed"`.
- **N4 — tiêu đề lớn.** Explore, Saved, Trips, Account: hàng nút cao 64 (icon 24 trong vùng chạm
  48, badge số 16 nền `destructive`), dưới là tiêu đề `display` canh trái lề 16. Màn stack đã
  dùng header native nên trên Android vốn canh trái và có mũi tên lùi — chỉ cần kiểm không có
  `headerTitleAlign: 'center'`. Home giữ header cũ.
- **N5 — icon.** Đề xuất `MaterialCommunityIcons` vì có cặp viền/đặc cho tab (ví dụ `home` và
  `home-outline`). Bảng đổi tên Feather sang Material nằm ở biến `MAP` trong mã nguồn mockup;
  tên bên `@expo/vector-icons` viết khác Material Symbols, tra glyphmap trước khi dùng.
- **N6 — danh sách thẻ rời** (như Cài đặt Android 16). Mỗi hàng là một thẻ nền `card`, cách nhau
  2, hàng đầu bo trên 20, hàng cuối bo dưới 20, còn lại bo 4. Hàng cao tối thiểu 56, đệm 12/16,
  khoảng cách 16; icon trần 24 `muted-foreground`; tiêu đề `body`, dòng phụ 14 `muted-foreground`,
  giá trị cuối hàng 14 `muted-foreground`; mũi tên `chevron-right` 24, dòng mở trình duyệt dùng
  `open-in-new`. Nhãn nhóm 14/20 medium `primary-emphasis`; chân nhóm 12/16. Hàng phá huỷ
  (Sign out, Cancel this booking, Delete account) chữ `destructive-emphasis`.
- **N7 — chip và segmented.** Chip lọc cao 32, bo 8, viền 1 `border`; đang chọn nền `secondary`,
  chữ `secondary-foreground`, thêm icon `check` 18 bên trái. Segmented chỉ cho Trips: ba ô bằng
  nhau, cao 40, cách nhau 2, nền `--sch`; ô đầu bo 20 bên trái, ô cuối bo 20 bên phải, ô giữa
  vuông; ô đang chọn nền `primary`, chữ `primary-foreground` và **giữ nguyên hình**.
- **N8 — thanh tìm.** Cao 56, bo 28, nền `--sch`, không viền, icon 24, chữ 16. Bấm vào thì chuyển
  sang search view (B4): đầu màn cao 72 nền `--sch`, mũi tên lùi, ô gõ, nút xoá, đường kẻ dưới.
- **B2 — thẻ tour.** Không khung: ảnh cao 180 bo 14; trên ảnh có chip sao và tối đa một badge
  (`badges[0]`), nút tim 44 — nền `scrim` pha alpha 0,55 qua `withAlpha`. Dưới ảnh: tên 16 medium
  một dòng, giá bên phải ("From" 12 hoặc giá gạch `price-compare`, giá 16 medium); địa danh ·
  số ngày 14; dòng `nextDeparture`: icon lịch, "Next departure: {ngày}", số chỗ còn — đổi sang
  `warning-emphasis` khi `seatsLeft ≤ ALMOST_FULL_THRESHOLD` (`features/tour-detail/departures.ts`,
  hiện là 3); không có đợt thì "Dates on request". API đã trả sẵn `nextDeparture` và `badges`
  trên mọi thẻ (ADR-0058). Tour đã gỡ ở Saved: mờ 55%, chip "No longer available", bỏ dòng đợt.
- **B3 — ảnh đầu trang.** Pager ngang qua `galleryImages`; chip đếm "{i} / {n}" góc phải dưới;
  chạm ảnh mở `PhotoViewer` đúng ảnh đang xem; bỏ dải ba ảnh nhỏ và ô "+N"; khối tên tour chừa
  lề phải 96 cho chip đếm.
- **B4 — bốn bước.** `BookingStepProgress` thêm hàng tên bước dưới vạch: bước đã qua
  `primary-emphasis`, bước hiện tại `foreground` medium, bước sau `muted-foreground`.
  `totalSteps` 3 → 4 ở ba route; màn thanh toán hiện bước 4 "Pay". Header cả bốn màn dùng
  `appShell.titles.bookThisTour`.
- **B5 — thẻ Next trip.** Hàm thuần chọn đơn có giai đoạn `upcoming` hoặc `on_tour` và ngày đi
  sớm nhất (test trước, gồm cả trường hợp không có đơn nào và hai đơn trùng ngày). Thẻ: ảnh 120
  có dải mờ, "Departing in" và số ngày `brand`; khi đang đi thì "On tour now" và "Day {n} of
  {total}"; dưới ảnh là tên tour, ngày · số khách, "View trip" kèm mũi tên; bấm vào mở
  `/trips/[code]`. Danh sách bên dưới bỏ đơn đã lên thẻ lớn; không có đơn hợp lệ thì ẩn thẻ.

## 5. Chữ

Đã có, dùng lại: `mobile.tabs.*`, `appShell.titles.bookThisTour`, `tourDetail.nextDeparture(date)`,
`tourDetail.seatsLeft(n)`, `trip.departingIn`, `trip.daysCount(n)`, `trip.onTourNow`,
`trip.dayOfTotal(n, total)`. Có bên web nhưng mobile chưa có: "Dates on request", "View trip",
nhãn badge — thêm khoá mobile theo luật chữ của
[mobile-browse-handoff](mobile-browse-handoff.md). Phải thêm mới: bốn tên bước (Travellers,
Contact, Review, Pay), "Next trip", nhãn đọc màn hình cho chip đếm ảnh.

## 6. Cố tình không làm đợt này

- A5, A6, A8, C5 (nhãn "Để sau"): giữ bố cục hiện có, chỉ nhận lớp áo mới.
- Bố cục Home, `RegionRail`, `home-metrics.ts`.
- Kính mờ hay blur (`expo-blur` không có trong app), mọi dependency mới, token dùng chung với web.
- Bản riêng cho iOS: trên iPhone app vẫn chạy nhưng mang dáng Android — chấp nhận vì demo
  chạy Android.
- Năm thay đổi vào `main` sau 14/10 (màn Password updated, lời mời viết bài, lý do công ty huỷ
  chuyến, đơn chờ trả quá hạn) không có khung riêng; chúng tự nhận lớp áo qua component chung.

## 7. Chỗ dễ làm sai

1. **Android bôi đậm giả.** `theme.ts` dặn: font tải từ `@expo-google-fonts` thì đặt
   `fontFamily`, không đặt `fontWeight`. Font hệ thống thì **ngược lại**: đặt `fontWeight`, bỏ
   `fontFamily`. Lẫn hai luật là chữ Literata bị đậm giả, hoặc chữ hệ thống mất độ đậm.
2. **Nền che nhãn ô nhập phải trùng màu mặt phía sau.** Trên màn thường là `background` (hoặc
   `--grouped`); trong bottom sheet là `--sc`. Cho `TextField` nhận màu nền nhãn qua prop,
   đừng gắn cứng — không thì ô lý do huỷ (C7) hiện một mảng màu lệch trên đường viền.
3. **Bỏ `FloatingTabBar` thì bỏ luôn phần chừa đáy** ở `sceneStyle` của `(tabs)/_layout.tsx`, và
   giữ hành vi bấm lại tab đang mở để cuộn lên đầu.
4. **Segmented của Trips không phải "connected button group".** Kiểu Expressive làm ô đang chọn
   biến thành viên tròn; user đã chốt ô chọn giữ hình, chỉ đổi màu.
5. **Đừng nâng chữ thân lên 17** như mockup vòng 3 (iOS). Thang Material 3 là 16/14/12, khớp
   token hiện có.

## 8. Báo xong

Mỗi PR ghi: mã việc ở mục 4, khung mockup đã phủ, kết quả các cổng ở mục 2, ảnh máy Android thật
nền sáng và tối cạnh khung mockup. User review rồi gộp kiểu rebase + fast-forward; entry
CHANGELOG do người gộp viết (luật 13).
