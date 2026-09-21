# Bàn giao cụm xem tour mobile (P5b-2) — Home · Explore · chi tiết tour

> Viết cho thành viên dựng các màn này. Khác P5b-1: đợt này **chỉ có bản vẽ**, không có
> code dựng sẵn — người nhận dựng màn **và** nối dữ liệu thật luôn, không cần bản giả lập.

Bản vẽ user đã duyệt 18/09: `docs/design/mockups/mobile-browse-screens.src.html` (mở bằng
trình duyệt) · Nền tảng: [ADR-0040](../adr/0040-mobile-app-expo.md) · Luật hạn chót đặt chỗ:
[ADR-0041](../adr/0041-single-cancellation-deadline.md) · Khuôn code mẫu:
[mobile-auth-handoff.md](mobile-auth-handoff.md) · Chạy thử:
[mobile-dev-loop.md](../conventions/mobile-dev-loop.md).

## 1. Đọc bản vẽ

- Thanh công cụ đầu trang: **Nền tối / Nền sáng**, **Hiện vùng an toàn**, thu phóng. Link
  nhận `?scheme=light&safe=on&zoom=0.5` để gửi đúng trạng thái cho người khác.
- **Chép thẳng 1:1.** Khung 390×844 là dp thật. Trong mã nguồn file:
  `calc(var(--s) * n)` ⇔ `theme.spacing(n)`; biến CSS trùng tên token
  (`--primary-emphasis` ⇔ `theme.colors['primary-emphasis']`); `--inset-top` /
  `--inset-bottom` ⇔ `useSafeAreaInsets()`.
- **KHÔNG dùng `fromMockup()` cho cụm này.** Hàm đó chỉ dành cho mockup auth, vốn vẽ trên
  khung thu nhỏ 324×700. Khung ở đây đã là cỡ máy thật.
- **Chú thích dưới mỗi khung là spec của khung đó:** field nào của contract, khoá i18n
  **có sẵn** và khoá **phải thêm**, tên icon Feather, số đo đặc biệt.

## 2. Luật bắt buộc

1. **Màn chỉ vẽ, route giữ state và gọi dữ liệu** — đúng khuôn cụm auth
   (`apps/mobile/src/features/auth/*-screen.tsx` + `apps/mobile/src/app/(auth)/*.tsx`).
2. **Token, không hex** (lưới `scripts/check-mobile-tokens-only.mjs`). **Copy qua
   `@tourism/i18n`**, tiếng Anh. Comment code tiếng Việt. Chỉ Biome — không ESLint/Prettier.
3. **Mỗi màn đọc dữ liệu có đủ ba trạng thái:** đang tải (khung xám cùng bố cục; sau ~3
   giây thêm câu `home.slowServer` vì API trên Render ngủ) · lỗi (thay thân màn, giữ header
   và thanh tab) · rỗng. Khuôn vẽ ở H2–H4, dùng lại cho mọi màn.
4. **Test bằng jest-expo + RNTL 14:** mọi `fireEvent.*`, `unmount()`, `rerender()` phải
   `await` — thiếu một chỗ là các test SAU trong cùng file render ra cây rỗng
   (CHANGELOG 16/09). Route mới phải thêm vào kiểm kê `apps/mobile/src/routes.spec.tsx`.
5. **Soi cả nền sáng lẫn nền tối trên máy thật** trước khi báo xong.
6. **Cổng trước khi báo xong:** `pnpm gate:int` · `pnpm turbo run bundle --filter=@tourism/mobile`
   · `expo-doctor` (trong `apps/mobile`) · tokens-only.

## 3. Việc phải làm trước (T0)

- **Tầng dữ liệu mobile chưa tồn tại** — app chưa có client oRPC, chưa phụ thuộc
  `@tourism/contract`. Đây là quyết định kiến trúc: **viết ADR trước code** (CLAUDE.md
  luật 5), lấy [ADR-0016](../adr/0016-web-data-layer.md) của web làm mẫu. Các màn ở đây
  đọc toàn endpoint công khai, không cần đăng nhập — trừ nút tim.
- **Mở 5 token** trong `MOBILE_COLOR_KEYS` (`libs/mobile/ui/src/lib/theme.ts`, token đã có sẵn
  ở `@tourism/tokens`): `rating`, `rating-muted`, `price-compare`, `warning`, `overlay`.
- **Primitive mới** ở `@tourism/mobile-ui`, mỗi cái có test: `SearchField`, `Chip` (thường ·
  đang chọn · gỡ được), `BottomSheet`, thanh tab có icon (Feather: `home`, `compass`, `heart`,
  `briefcase`, `user` — mục đang chọn có viên nền `primary`). Khối trạng thái "icon vuông +
  câu + nút" dùng ở H3/H4/E5/D7 nên đưa thành một component dùng chung.

## 4. Chia việc đề xuất

| # | Việc | Khung | Phụ thuộc |
| --- | --- | --- | --- |
| T0 | Tầng dữ liệu (ADR trước), 5 token, primitive mới | — | không |
| T1 | Home: địa danh theo vùng | H1–H4 | T0 |
| T2 | Explore: danh sách, lọc, sắp xếp, rỗng | E1, E3, E5 | T0 |
| T3 | Ô tìm chung (Destinations + Tours) | E2 | T2 |
| T4 | Explore lọc theo một địa danh (đầu trang địa danh) | E4 | T2 |
| T5 | Chi tiết tour: Overview, Itinerary, Reviews, tour không còn | D1, D2, D4, D7 | T0 |
| T6 | Tab Dates | D3 | T5 **và nhánh hoàn tiền `feat/refund-deadline` đã lên `main`** |
| T7 | Trình xem ảnh · tấm mời đăng nhập khi bấm tim | D5, D6 | T5; D6 cần phiên đăng nhập của cụm auth |

T1, T2, T5 chạy song song được sau T0.

## 5. Dữ liệu cho từng cụm

| Màn | Endpoint | Ghi chú |
| --- | --- | --- |
| Home | `catalog.destinations.list` | Nhóm theo `region` (Bắc 7 · Trung 5 · Nam 6), xếp `tourCount` giảm dần. Bấm thẻ → Explore lọc `destination=<slug>` |
| Explore | `catalog.tours.list`, `catalog.categories.list` | API lọc được: danh mục, địa danh, ô tìm. **Thời lượng, giá, độ khó API chưa lọc được** — web đang lọc ở máy trên toàn bộ tour, mobile làm y vậy |
| Tìm chung | `catalog.tours.list?search=` + lọc `Destination.name` ở máy | Chỉ 18 địa danh, lọc ở máy là đủ |
| Chi tiết | `catalog.tours.bySlug`, `reviews.listByTour` | `listByTour` trả kèm `breakdown` (đếm sao), có `sort`, `rating`, `withPhotos` |
| Tim | `wishlist.set` / `wishlist.check` | Cần đăng nhập; khách chưa đăng nhập → D6 |

## 6. Ba chỗ dễ làm sai

1. **Sắp xếp tour:** dùng đúng 4 kiểu web đang có — `toursPage.sortOptions` (newest, priceAsc,
   priceDesc, durationAsc). **Không** dùng khối `mobile.explore.sort` (popular / rating) chép từ
   Nexora: xếp theo độ phổ biến/sao đã bị bỏ có chủ đích, `TourSortKeySchema` không cho.
2. **Tìm kiếm phải khớp đầu từ và bỏ dấu:** gõ "ha" ra Hà Nội, Hạ Long, Hà Giang — không ra Mai
   Châu hay Phong Nha. API hiện tìm bằng ILIKE (có dấu, khớp giữa từ), nên phần API cần sửa.
3. **Tab Dates không tự tính hạn chót bằng giờ máy.** Dùng hai cờ server tính `bookable` và
   `bookingDeadline` của nhánh hoàn tiền (giáo viên hay chỉnh đồng hồ máy khi chấm — xem
   ADR-0041). Giá gạch chỉ khi có khuyến mãi thật (`priceFrom < basePrice` ở thẻ, đợt có
   `compareAtPrice` ở tab Dates).

## 7. Khoá i18n phải thêm

Gom từ chú thích các khung — thêm vào `libs/shared/i18n/src/lib/messages.ts`, khối `mobile`:

- `home.seeAllTours`; sửa chữ `home.error` từ "tours" thành "destinations" (khoá chưa màn nào dùng).
- `explore.regionTitle`, `explore.difficultyTitle`, `explore.readMore`. Nhãn độ khó dùng chung
  với web.
- `tourDetail`: nhãn 4 tab (Overview · Itinerary · Dates · Reviews), `chooseDate`, `perPerson`,
  nhãn 4 thẻ dữ kiện, `meetingPointTitle`, `bookingClosed`, `askAboutDate`, `almostFull`,
  `exploreOther`. Câu huỷ miễn phí và nhãn sắp xếp review dùng chung chữ với web.
