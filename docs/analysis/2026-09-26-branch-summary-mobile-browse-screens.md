# Tóm tắt nhánh `feat/mobile-browse-screens` (P5b-2) — 2026-09-26

Đọc nhanh cho người chưa theo dõi nhánh. Nguồn: `git log main..feat/mobile-browse-screens`
(35 commit), [`docs/handoff/mobile-browse-handoff.md`](../handoff/mobile-browse-handoff.md),
status doc 24/09 và `docs/PROGRESS.md` (bản cuối trên nhánh, 25/09 — file working-doc,
không còn trên `main`). Diff so `main`: **109 file, +12433/-674 dòng**.

## Đã làm xong

Cụm màn xem tour mobile (Home · Explore · chi tiết tour), toàn bộ T0–T7 theo bảng
chia việc trong handoff:

- **T0 — hạ tầng dữ liệu:** client oRPC (`OpenAPILink`), 5 token màu mới, 4
  primitive mới (`SearchField`, `Chip`, `BottomSheet`, thanh tab icon Feather).
- **T1 Home:** địa danh theo vùng, 3 trạng thái tải/lỗi/rỗng.
- **T2 Explore:** danh sách + lọc (vùng/thời lượng/giá/độ khó) + sắp xếp + rỗng.
- **T3 Ô tìm chung** Destinations + Tours, debounce 300ms, lọc bỏ dấu ở CLIENT
  (API tìm bằng ILIKE có dấu chưa sửa được, port `foldAccents` từ web).
- **T4** Explore lọc theo một địa danh.
- **T5** Chi tiết tour: Overview/Itinerary/Reviews, tour không còn/lỗi mạng.
- **T6** Tab Dates — nhóm theo tháng, tag "Booking closed"/"Almost full", đợt
  đã chọn đổi đáy màn.
- **T7** Trình xem ảnh (pinch-zoom + vuốt-xuống-đóng, dùng
  `react-native-gesture-handler`, KHÔNG dùng `reanimated` — xung đột version,
  xem ADR-0040 AMEND 3) + tấm mời đăng nhập khi bấm tim (D6).
- **Thêm ngoài phạm vi gốc:** wishlist (tim) nối THẬT ở cả 3 nơi (D1 tour
  detail, E1 thẻ Explore, E4 Explore theo địa danh) — không chỉ D1 như handoff
  ghi tối thiểu; form "Ask about this date" (D3); phân trang review thủ công
  (D4, không dùng `useInfiniteQuery`); dev gallery `/dev/tour-gallery`.

## Kiểm đã chạy — xanh

`pnpm gate` (build+typecheck+unit+biome+tokens-only) xanh tuyệt đối · bundle
check (`pnpm turbo run bundle --filter=@tourism/mobile`) xanh, iOS 5.6MB/Android
5.8MB · `expo-doctor` 20/21 (1 fail là drift version cũ, không do nhánh này) ·
55 suite / 344 test mobile xanh.

## Chưa làm / còn treo

1. **Chưa soi nền sáng lẫn nền tối trên máy thật** (chỉ có ảnh máy thật nền
   tối từ user) — cần user tự làm, gửi ảnh nền sáng.
2. **D1 — flow "Book now"/đặt tour thật CHƯA làm.** Thuộc P5b-3, cỡ việc LỚN
   (~1170 dòng tham chiếu bên web, mobile chưa có hạ tầng WebView/deep-link
   thanh toán). User chưa quyết làm luôn hay giữ ranh giới nhánh.
3. **Tìm kiếm khớp đầu từ + bỏ dấu ở API (server-side) chưa sửa** — khác với
   client-side đã xong; API vẫn ILIKE có dấu, khớp giữa từ (không phải khớp
   đầu từ). Việc phía `apps/api`, ngoài phạm vi nhánh.
4. **`pnpm test:int` — 3 nguồn lỗi, 1 đã root-cause là bug có sẵn (không do
   nhánh này), 1 do môi trường máy (thiếu psql/Docker), 1 CHƯA root-cause**
   (`signUpUser → 500` khi chạy full suite, flaky theo thời gian/thứ tự —
   xem [`docs/open-items.md`](../open-items.md)).
5. **Bug tiềm ẩn phát hiện, KHÔNG do nhánh này gây** — `pending-sweep.service.ts`
   so sánh timestamp phụ thuộc timezone server (raw SQL so `timestamp without
   time zone`). Đã ghi [`docs/open-items.md`](../open-items.md), chưa vá,
   ngoài phạm vi nhánh.
6. **Chưa commit gì tính tới lúc viết status doc 24/09** — đã hết treo (nhánh
   hiện có 35 commit), nhưng **chưa mở PR/hỏi merge** tính tới bản ghi PROGRESS
   cuối (25/09).

## Quyết định kỹ thuật đáng chú ý (đừng hỏi lại)

- Thêm `react-native-gesture-handler`, dứt khoát KHÔNG thêm `reanimated`
  (xung đột version worklets, vỡ ở runtime) — xem ADR-0040 AMEND 3.
- Sắp xếp tour CHỈ 4 kiểu web đang có (newest/priceAsc/priceDesc/durationAsc),
  KHÔNG có popular/rating (đã bỏ có chủ đích, API không cho).
- Tab Dates dùng cờ server (`bookable`, `bookingDeadline`), KHÔNG tự tính bằng
  giờ máy (đề phòng giáo viên chỉnh đồng hồ khi chấm).
