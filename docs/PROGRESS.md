# Tiến độ nhánh `feat/mobile-browse-screens` — cập nhật 2026-09-25

> File này KHÔNG phải doc thường trực của repo — chỉ để nối phiên nếu context
> AI bị mất giữa chừng. Xoá khi nhánh đã merge/xong. Trạng thái đầy đủ hơn (đối
> chiếu từng T so với handoff) ở
> [`docs/analysis/2026-09-24-mobile-browse-screens-status.md`](analysis/2026-09-24-mobile-browse-screens-status.md)
> — đọc file đó trước, file này chỉ bổ sung phần MỚI PHÁT SINH sau khi viết
> file đó (xử lý nợ treo).

## Đang làm ngay lúc ghi file này

Phiên 25/09 (lượt hai) — user cho phép làm D3+D4 (câu hỏi #2 cũ, chỉ nửa D3;
D1 vẫn treo), sau đó chạy lại `gate:int` đầy đủ (#7/#8) + bundle check (#8).

**D3 (form "Ask about this date") — XONG.** File mới:
`features/tour-detail/ask-about-date.ts` (logic thuần — build payload +
validate bằng chính `CreateEnquiryInputSchema`, copy lỗi DÙNG CHUNG
`messages.contactForm.errors`, tên/email DÙNG CHUNG
`mobile.auth.register.name`/`mobile.auth.signIn.email`) +
`ask-about-date-sheet.tsx` (tấm form, khuôn y hệt `AuthGateSheet`). Nối vào
`tour-detail-screen.tsx` (compose sheet) + `[slug].tsx` (đọc tourId/travelDate
từ đợt đã bấm qua `tour.departures.find()`, điền sẵn tên/email nếu đã đăng
nhập, gửi `enquiries.create` — route @Public có sẵn từ trước, không đụng API).

**D4 (phân trang review) — XONG.** `[slug].tsx` gộp thủ công theo `page`
(KHÔNG `useInfiniteQuery` — không có tiền lệ nào trong repo), reset khi đổi
`reviewSort`. Nút "Load more" mới trong `tour-detail-screen.tsx`, tắt khi hết
trang (`reviewTotalPages` tách state riêng để không nhấp nháy ẩn lúc đang tải
trang kế).

Kiểm cả hai: tsc sạch, biome sạch, tokens-only sạch, 55 suite / 344 test xanh
(+13 test mới: 6 logic thuần + 7 component + 2 wiring vào `tour-detail-screen`).

**`pnpm gate` (build+typecheck+unit+biome+tokens-only): XANH TUYỆT ĐỐI**, chạy
lại đủ sau D3/D4. Phát hiện MỚI về port-forward VS Code (khác quyết định #8
cũ): `Get-NetTCPConnection -LocalPort 3001` cho thấy chủ cổng là **chính tiến
trình `Code.exe`** (đo PID, xác nhận `ProcessName: Code`) — không phải một
proxy lạ, không thể/không nên kill (đó là VS Code người dùng đang mở). Né bằng
cách tách `pnpm gate` thành ba lệnh riêng: `build` dùng
`NEXT_PUBLIC_API_URL=http://localhost:3005` (API build tạm ở port khác, cache
hit toàn bộ), rồi `typecheck test`/`biome check .`/tokens-check chạy với ENV
MẶC ĐỊNH (port 3001 y nguyên .env.local) — **quan trọng: đừng override
`NEXT_PUBLIC_API_URL` cho bước `test`**, `apps/admin/src/proxy.spec.ts` hardcode
`"connect-src 'self' http://localhost:3001"` trong assertion CSP, override lộ
ra sẽ làm gãy oan test đó (đã dính, đã sửa lại đúng cách). web 123/123 (1533
test), admin 91/91 (1013 test).

**`pnpm turbo run bundle --filter=@tourism/mobile` (#8) — XONG, XANH.** Export
iOS 5.6MB + Android 5.8MB, cache hit toàn bộ 5 task.

**`pnpm test:int`: vẫn 3 nguồn lỗi CŨ, KHÔNG có gì mới phát sinh từ D3/D4**
(worker/pending-sweep và enquiries không đụng nhau) — chạy lại lần 3 trong
phiên để xác nhận:

1. `check-rls.int.spec.ts` (2 test) — môi trường máy này (thiếu `psql`+Docker),
   không phải bug. Xem chi tiết lần chạy trước.
2. `pending-sweep.int.spec.ts` (2-3 test tuỳ lần) — bug timezone đã root-cause,
   đã ghi [`docs/open-items.md`](open-items.md#bug-tiềm-ẩn-pending-sweepservicets-so-sánh-timestamp-phụ-thuộc-timezone-server),
   ngoài phạm vi nhánh.
3. `signUpUser → 500` khi chạy full suite — lần này rơi vào
   `refunds.int.spec.ts` (khác file mọi lần trước, xác nhận thật sự flaky theo
   thời gian/thứ tự, không phải một file cụ thể bị hỏng). **VẪN CHƯA
   root-cause** — xem giả thuyết đã loại trừ ở lần ghi trước.

Soi tokens sáng/tối trên máy thật (#9) — **CHƯA làm**, cần user tự làm.

## Câu hỏi đang chờ user quyết (hỏi 25/09, user dismiss — CHƯA trả lời)

1. D5 zoom/dismiss đã xong, D3 đã xong (lượt hai) — hai câu hỏi cũ về việc có
   làm hay không đã LỖI THỜI, bỏ qua.
2. **D1 (flow "Book now"/booking thật) — VẪN TREO.** Doc handoff ghi rõ thuộc
   cụm P5b-3, ngoài phạm vi nhánh này. User CHƯA quyết làm luôn hay giữ ranh
   giới. Cỡ việc: LỚN (~1170 dòng tham chiếu bên web, mobile chưa có hạ tầng
   WebView/deep-link redirect thanh toán — xem đánh giá cỡ việc đã gửi user
   trong hội thoại, không lặp lại ở đây).
3. **Tìm kiếm khớp đầu từ + bỏ dấu phía API** (khác với #6 đã xong — #6 là
   client-side accent-fold cho Explore; đây là API `ILIKE` chưa sửa) — user
   CHƯA quyết sửa luôn hay để riêng.

## Quyết định quan trọng đã chốt trong phiên (không lặp lại nếu hỏi lại)

1. **Thêm `react-native-gesture-handler@~2.32.0`, KHÔNG thêm `react-native-reanimated`.**
   Lý do: reanimated 4.5.1 (bản `npx expo install` chọn cho SDK 57) đòi
   `react-native-worklets@0.10.x`, nhưng cây phụ thuộc của `@expo/ui`/
   `expo-router` tự kéo `0.12.1` — xung đột thật, vỡ ở RUNTIME
   (`assertWorkletsVersion`), không phải lỗi giả của Jest. Đã thử pin
   `worklets@0.10.1` tay thì gãy tiếp ở babel plugin (thiếu `@babel/traverse`).
   Quyết định: bỏ hẳn reanimated, dùng `GestureDetector` của gesture-handler
   chạy callback JS thuần (`.runOnJS(true)`) driving `Animated.Value` LÕI RN
   (đúng thứ `BottomSheet` đã dùng). Ghi đầy đủ ở
   [ADR-0040 AMEND 3](adr/0040-mobile-app-expo.md#amend-3--24092026-p5b-2-t7-d5-react-native-gesture-handler-không-reanimated).
2. **`GestureHandlerRootView` bọc HAI nơi**: `app/_layout.tsx` (cả
   `RootLayout` lẫn `ErrorBoundary` — hai cây riêng) VÀ bên trong `Modal` của
   `PhotoViewer` (Modal dựng root native tách biệt).
3. **Jest cần `import 'react-native-gesture-handler/jestSetup'`** ở
   `apps/mobile/jest.setup.js` — setup chính thức của gói, thiếu là vỡ test.
4. **Tìm kiếm tour (Explore) chuyển hẳn sang lọc CLIENT-SIDE** — không gửi
   `search` cho `catalog.tours.list` API nữa (API tìm bằng ILIKE có dấu, sai
   theo handoff §6.2). Port `searchTours()` y hệt `apps/web/src/lib/tours.ts`
   vào `apps/mobile/src/features/explore/tour-filters.ts`, dùng
   `foldAccents` từ `@tourism/contract` (đã có sẵn, không tự viết lại). Ngữ
   nghĩa là SUBSTRING sau khi bỏ dấu (không phải khớp-đầu-từ tuyệt đối) — cố
   ý, port nguyên xi từ web, đừng "sửa" thành word-prefix nếu không được yêu
   cầu rõ.
5. **Wishlist (tim) nối THẬT ở cả Explore (E1/E4) lẫn Tour detail (D1/D2)** —
   không chỉ D1 như bản tối thiểu handoff ghi. Hạ tầng `withMobileAuth()` ở
   `apps/mobile/src/lib/api/client.ts` (đính cookie phiên qua
   `getAuthClient().getCookie()`, action chính thức của plugin `expoClient`).
   Tim ĐẶC RUỘT (Ionicons `heart`) khi đã lưu, viền (Feather `heart`) khi
   chưa — không chỉ đổi màu icon viền.
6. **D6 (tấm mời đăng nhập) CHƯA giữ ý định "quay lại tour + tự lưu" sau khi
   đăng nhập xong** — nợ còn treo, cần hạ tầng return-to chung cho cụm auth
   (chưa có). "Sign in"/"Create account" chỉ điều hướng `/login`/`/register`.
7. **Dev gallery cho cụm xem tour**: route mới `/dev/tour-gallery`, link ở
   tab Account ("Tour gallery (dev)"). `GalleryScreen` (`libs`... không, ở
   `apps/mobile/src/features/dev/gallery-screen.tsx`) đã tổng quát hoá nhận
   `title`/`entries` qua props thay vì hardcode cụm auth — route
   `/dev/gallery` (cụm auth) không đổi hành vi, chỉ đổi cách gọi.
8. **`pnpm gate:int` cần API SỐNG cho bước build web/admin** — địa chỉ
   `localhost:3001` trên máy dev NÀY bị VS Code auto-port-forward chặn (trả
   426 giả). Né bằng cách truyền `NEXT_PUBLIC_API_URL=http://<IP LAN>:3001`
   CHỈ cho lượt build thủ công đó — KHÔNG sửa file cấu hình nào, chỉ là env
   var một lần. `apps/admin`/`apps/web` đều CHẶN origin không phải
   `localhost`/`127.0.0.1`/`[::1]` khi `NODE_ENV=production` (đọc
   `apps/*/src/lib/api/env.ts` hàm `isLoopback`) — nên IP LAN chỉ dùng được
   cho bước `test`/dev, KHÔNG dùng được cho `build` (đã đo: admin build ném
   lỗi "must use https in production" khi thấy IP LAN). Muốn build lại đúng
   cách: TẮT port-forward 3001 trong VS Code rồi build với `localhost:3001`
   thật.

## Đối chiếu 10 mục nợ treo (status doc 24/09) — trạng thái 25/09 (lượt hai)

- ✅ #1 (D5 zoom/dismiss) — xong.
- ✅ #3 (D3 form "Ask about this date") — xong, lượt hai (xem chi tiết trên).
- ✅ #5 (D4 phân trang review) — xong, lượt hai (xem chi tiết trên).
- ✅ #6 (tìm kiếm bỏ dấu client-side Explore) — xong.
- ✅ #7 (`pnpm gate:int` phần build/typecheck/unit/biome/tokens) — xanh tuyệt
  đối, chạy lại đủ sau D3/D4.
- ✅ #8 (bundle check) — xong, xanh.
- ⏳ #7 (phần `test:int`) — 2/3 nguồn lỗi đã root-cause + xác nhận ổn định
  qua nhiều lần chạy (không flaky, không phải regression từ D3/D4); phần
  `signUpUser 500` khi chạy full suite VẪN CHƯA root-cause.
- ❌ #9 (soi sáng/tối máy thật) — CHƯA làm, cần thiết bị thật, không tự làm
  được trong phiên AI.
- ❌ #2 (D6 return-to-tour), #4 (D1 booking flow) — CHƯA đụng, treo chờ user
  quyết ranh giới (xem mục trên; D1 cỡ việc LỚN).
- ❌ #10 (CHƯA COMMIT GÌ cho T1–T7 + nợ vá + D3/D4 mới) — vẫn ở working tree.
  12 commit cũ trên nhánh chỉ là T0 (primitives), không tính.

Bonus phát sinh ngoài 10 mục gốc: bug timezone `pending-sweep.service.ts` —
đã ghi [`docs/open-items.md`](open-items.md), KHÔNG vá (ngoài phạm vi nhánh).

## Next steps cụ thể (thứ tự đề xuất)

1. Quyết 2 câu hỏi ranh giới còn treo (mục trên) — D1 P5b-3 (cỡ lớn), search
   API bỏ dấu.
2. Quyết có làm D6 (return-to-tour) đợt này không — chưa hỏi riêng, nợ độc
   lập với 2 câu trên.
3. Soi tokens sáng/tối trên máy thật (#9) — cần user tự làm, gửi ảnh.
4. Tuỳ chọn: đào tiếp `signUpUser 500` flaky trong `test:int` full-suite nếu
   muốn `gate:int` xanh tuyệt đối trước khi khai xong (luật 11 CLAUDE.md).
5. Khi user đồng ý: commit theo từng T logic (CLAUDE.md luật 1/12), docs
   sweep (CHANGELOG + docs/README.md), rồi mới push/merge.
6. Xoá file `docs/PROGRESS.md` này sau khi nhánh merge (không phải doc
   thường trực).
