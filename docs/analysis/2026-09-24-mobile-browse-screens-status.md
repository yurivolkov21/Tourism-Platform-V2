# Soát tiến độ nhánh `feat/mobile-browse-screens` (P5b-2)

Đối chiếu với [`docs/handoff/mobile-browse-handoff.md`](../handoff/mobile-browse-handoff.md)
(bảng chia việc T0–T7) và bản vẽ đã duyệt
[`mobile-browse-screens.src.html`](../design/mockups/mobile-browse-screens.src.html).
Toàn bộ nhánh hiện **chưa có commit nào** — mọi việc còn nằm ở working tree
(`git status` không có gì ở "Changes to be committed" cố định).

## 1. Đã làm — theo từng T

| # | Việc | Khung | Trạng thái |
| --- | --- | --- | --- |
| T0 | Tầng dữ liệu (client oRPC, 5 token, primitive `SearchField`/`Chip`/`BottomSheet`/tab icon) | — | ✅ Xong (thừa hưởng từ trước nhánh này) |
| T1 | Home: địa danh theo vùng, 3 trạng thái tải | H1–H4 | ✅ Xong |
| T2 | Explore: danh sách, lọc (region/duration/price/difficulty), sắp xếp, rỗng | E1, E3, E5 | ✅ Xong |
| T3 | Ô tìm chung Destinations + Tours, debounce 300ms | E2 | ✅ Xong |
| T4 | Explore lọc theo một địa danh (đầu trang + mô tả gấp/mở) | E4 | ✅ Xong |
| T5 | Chi tiết tour: Overview, Itinerary, Reviews, tour không còn/lỗi mạng | D1, D2, D4, D7 | ✅ Xong |
| T6 | Tab Dates — nhóm theo tháng, tag "Booking closed"/"Almost full", đợt đã chọn đổi đáy màn | D3 | ✅ Xong |
| T7 | Trình xem ảnh + tấm mời đăng nhập khi bấm tim | D5, D6 | ✅ Xong (có cắt giảm, xem mục 3) |

Thêm **ngoài** phạm vi bảng T0–T7 gốc, làm trong phiên vừa rồi vì phát sinh
từ D6:

- **Wishlist nối THẬT ở cả 3 nơi** (không chỉ D1 như handoff ghi tối thiểu):
  thẻ tour Explore (E1) và Explore lọc theo địa danh (E4) — trước đó
  `favorited` hardcode `false`, bấm tim không làm gì. Có `wishlist.check`
  (batch, không N+1) lúc tải trang + `wishlist.set` lạc quan, hỏng thì trả lại
  + banner lỗi ngắn tự tắt.
- **Hạ tầng ký phiên cho oRPC mobile** (`withMobileAuth()` ở
  `apps/mobile/src/lib/api/client.ts`) — trước đó chỉ có comment giữ chỗ
  "nối thật khi hạ tầng @better-auth/expo xong"; giờ đã nối qua
  `getAuthClient().getCookie()` (action chính thức của plugin `expoClient`).
- **Tim đặc ruột khi đã lưu** (Ionicons `heart`) thay vì chỉ đổi màu icon viền
  — áp cho cả 3 chỗ trên.
- **Gallery dev cho cụm xem tour** (`/dev/tour-gallery`, link ở tab Account) —
  12 khung D1–D7 dựng bằng props cứng, cùng khuôn gallery cụm auth đã có.
  `GalleryScreen` tổng quát hoá để nhận `title`/`entries` qua props thay vì
  hardcode cụm auth.

## 2. Kiểm tra đã chạy (phiên vừa rồi)

- `tsc --noEmit` (`apps/mobile`): sạch.
- `pnpm exec biome check` trên mọi file đã sửa: sạch.
- `node scripts/check-mobile-tokens-only.mjs`: sạch — 100 file nguồn mobile,
  không màu viết tay.
- `npx expo-doctor` (`apps/mobile`): 20/21 qua. 1 fail — lệch bản patch 4 gói
  (`expo`, `expo-constants`, `expo-linking`, `expo-router`) so với SDK 57
  pin, KHÔNG phải do nhánh này gây ra (drift từ trước). Chưa sửa vì đổi
  dependency cần hỏi trước (CLAUDE.md).
- Test unit mobile: 322/322 xanh (53 test suite), cộng 4/4 ở
  `libs/mobile/ui` (`tour-list-card.spec.tsx`).

## 3. Chưa làm / cắt giảm có chủ đích (nợ còn treo)

Tất cả đã được flag trực tiếp trong doc comment tại chỗ code liên quan, gom
lại đây cho dễ soát:

1. **D5 — Trình xem ảnh:** không có chụm-để-phóng-to, không vuốt-xuống-để-đóng.
   Lý do: cần theo dõi gesture đa điểm mà repo chưa cài
   `react-native-gesture-handler`/`reanimated`; web cũng CHƯA làm zoom
   (`tourDetail.gallery.zoomIn` — nợ A12 bên web), nên không phải thụt lùi.
   Đóng bằng nút X hoặc phím back cứng Android. Muốn làm đủ phải thêm
   dependency mới — cần hỏi trước.
2. **D6 — Tấm mời đăng nhập:** "Sign in"/"Create account" chỉ điều hướng
   `/login`/`/register`, CHƯA giữ ý định "quay lại đúng tour + tự lưu" sau khi
   đăng nhập xong (handoff §7 dặn cần). Chưa có hạ tầng return-to chung cho
   cụm auth.
3. **D3 — "Ask about this date":** link có mặt, bấm chưa mở form nào — form
   hỏi đợt thuộc cụm P5b-3, ngoài phạm vi nhánh này.
4. **D1 — Nút "Book now" (đã chọn đợt) / "Choose a date":** chưa có flow đặt
   chỗ thật ở mobile (P5b-3) — bấm chưa làm gì.
5. **D4 — Reviews chưa phân trang:** chỉ vẽ trang đầu server trả theo
   `reviewSort` đang chọn; không có "xem thêm"/cuộn vô hạn.
6. **Tìm kiếm chưa khớp đầu từ + bỏ dấu (handoff §6.2):** API hiện tìm bằng
   ILIKE có dấu, khớp giữa từ — gõ "ha" phải ra Hà Nội/Hạ Long/Hà Giang,
   KHÔNG ra Mai Châu/Phong Nha. Đây là việc phía API, đã ghi rõ trong handoff
   là "cần sửa" — nhánh này chưa đụng tới (không kiểm tra lại tình trạng thật
   trong phiên này, chỉ nhắc lại từ handoff).
7. **`pnpm gate:int` chưa chạy trong phiên này** (cần Postgres) — CLAUDE.md
   luật 11 bắt buộc trước khi khai một task xong. Đã chạy tương đương ở tầng
   unit (tsc/biome/tokens-only/jest) nhưng CHƯA có integration test thật.
8. **Bundle check `pnpm turbo run bundle --filter=@tourism/mobile` chưa chạy**
   (một trong các cổng ở handoff §2.6).
9. **Chưa soi nền sáng lẫn nền tối trên máy thật** (handoff §2.5) — phiên này
   chỉ xác nhận qua ảnh chụp máy thật của user (nền tối), chưa có ảnh nền
   sáng.
10. **Chưa commit gì** — toàn bộ nhánh còn ở working tree, chưa qua bước
    review/merge theo luật "one feature = one branch" (CLAUDE.md luật 1).

## 4. Đề xuất bước tiếp theo

Xếp theo mức ưu tiên hợp lý (không phải mệnh lệnh — user quyết):

1. Chạy `pnpm gate:int` (cần Postgres sống) + bundle check — hai cổng còn
   thiếu trong danh sách bắt buộc của handoff.
2. Soi nền sáng trên máy thật (đổi theme trong app) — ít nhất D1–D7 và
   Explore, vì tokens-only không bắt được lỗi tương phản màu.
3. Quyết có làm D5 zoom/swipe-dismiss không (cần thêm dependency — quyết định
   kiến trúc, theo CLAUDE.md luật 5 cần ADR trước).
4. Quyết có làm return-to-tour sau đăng nhập (D6) đợt này hay để P5b-3.
5. Commit theo từng T logic (hoặc theo phiên) + docs sweep (CHANGELOG,
   docs/README.md) trước khi mở PR — hiện chưa có commit nào.
