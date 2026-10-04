# Tiến độ nhánh `feat/mobile-booking-screens` — cập nhật 02/10/2026 (phiên 3)

> File này KHÔNG phải doc thường trực — chỉ để nối phiên nếu context AI bị mất
> giữa chừng. Xoá khi nhánh đã merge/xong.

## Trạng thái chung

Checkout gốc (không worktree): `C:\capstone\Tourism-Platform-v2\Tourism-Platform-V2`,
branch `feat/mobile-booking-screens` (stacked trên `feat/mobile-browse-screens` →
`feat/mobile-account-screens`, cả ba đều CHƯA merge vào `main`, CHƯA push đợt
này, CHƯA hỏi review). Toàn bộ thay đổi của nhánh **vẫn ở working tree, CHƯA
commit gì** (xem `git status` — nhiều file modified + 3 thư mục untracked:
`apps/mobile/src/app/bookings/new/`, `features/booking/`, `features/trips/`).

## Bản vẽ nguồn

`docs/design/mockups/mobile-booking-screens.src.html` — 25 khung, 5 mục:

| Mục | Khung | Trạng thái |
| --- | --- | --- |
| 1. Đặt tour | B1–B9 | ✅ đã code (file tồn tại, chưa soát pixel kỹ) |
| 2. Sau khi rời app trả tiền | B5–B8 | ✅ đã code |
| 3. Chuyến của tôi | T1–T8 | ✅ đã code — **đã soát + vá kỹ phiên này** (xem dưới) |
| 4. Bám ngày khởi hành | P1–P6 | ✅ đã code xong (W7/W8, xem dưới) |
| 5. Hỏi về chuyến | E1–E2 | ✅ đã code xong (W6, xem dưới) |

**Cả 5 mục / 25 khung của mockup đã có code.** Mục 1/2 (B1-B9) vẫn CHƯA soát
pixel-by-pixel như mục 3 đã làm (xem cảnh báo cũ dưới) — còn lại là việc soát
chất lượng, không phải "chưa code".

Bàn giao đầy đủ: `docs/handoff/mobile-booking-handoff.md` — đã có sẵn chia việc
W1–W8, endpoint từng màn, luật cứng, luật vào màn theo trạng thái/ngày. Coi
file đó là SPEC đã duyệt, KHÔNG cần viết spec mới (đã xác nhận với user
01/10). Thứ tự làm đã chốt với user: **W6 → W7 → W8**.

## Phiên 01/10 đã làm — soát mục 3 (T1–T8) theo mockup, vá nhiều bug thật

Tất cả trong `apps/mobile/src/features/booking/booking-detail-screen.tsx`,
`cancel-sheet.tsx`, `apps/mobile/src/app/bookings/[code].tsx`,
`libs/mobile/ui/src/lib/text-field.tsx`, `libs/shared/i18n/src/lib/messages.ts`:

- `CompactTripCard` riêng cho T4 (không dùng chung `BookingTripCard` của B1/B4
  — hai mockup khác kích thước, đổi chung sẽ lệch B1/B4). Pill "Paid" chuyển
  vào trong cột chữ, thumbnail 80dp, có border+bg card (chốt theo phản hồi
  nhiều vòng của user, khác literal mockup `border:none` — **cố ý**, user yêu
  cầu rõ).
- `KvRow`: hàng cuối (Total paid) bỏ border; label đổi variant theo
  emphasis (`label` không muted) thay vì tự chế style; value emphasis dùng
  ĐÚNG `variant="title"` (serif Literata, khớp mọi chỗ khác hiện tổng tiền
  trong app — tour price, bottom-bar total) thay vì Archivo Bold tự chế (bug
  đã tìm ra và sửa khi đối chiếu kỹ bảng `t-title/t-label/t-subtitle/t-caption`
  của mockup).
- Note "Free cancellation": icon `shield` của mockup là bản GHÉP khiên+tick
  (path riêng, không phải shield trơn của Feather) — ghép thêm icon `check`
  đè giữa bằng `View` absolute, CHỈ cho icon `'shield'`.
- `CancelBookingSheet`: thêm `refundTone` ('good' dùng success-tint, 'info'
  dùng secondary — đúng `.note.good`/`.note.info` mockup, trước đó luôn dùng
  secondary sai cho T6). Thêm `reasonLabel`/`reasonPlaceholder` tách biệt (
  TextField thêm prop MỚI `placeholder` + `alwaysShowLabel`, mặc định giữ
  nguyên hành vi cũ — không vỡ 4 màn auth). Reason field giờ `iconVariant=
  "boxed"` đúng mockup `.field .ico` (trước thiếu, icon nhìn "lạc lõng" không
  khung — user tự phát hiện qua ảnh chụp máy). T7 (quá hạn) KHÔNG còn hiện ô
  Reason (mockup không có) và có title/body RIÊNG
  (`cancelAfterTitle`/`cancelAfterBody`) thay vì dùng nhầm title "Cancel this
  booking?" của T6.
- Thêm key i18n mobile MỚI: `cancelWithinBody`, `cancelAfterTitle`,
  `cancelAfterBody`, `cancelReasonLabel`, `cancelReasonPlaceholder` (trước đó
  cụm huỷ mobile ĐANG DÙNG NHẦM copy của web `accountBookingDetail.cancelDialog.*`
  — hai mockup viết khác chữ dù cùng endpoint).
- T8 đối chiếu kỹ — KHÔNG có bug (icon `refresh-cw` đúng, không hàng nào
  emphasis nên không dính fix Total-paid, bottom-bar 1 nút khớp).

**Việc còn treo từ vòng soát này** (phát hiện nhưng NGOÀI phạm vi, chưa làm):
- Thẻ `.trip-card`/`.t-label`/`.note` ở T4 cố ý to hơn mockup literal (phản
  hồi lặp lại của user qua nhiều ảnh) — không phải bug, đừng tự "sửa lại cho
  khớp mockup" nếu không ai yêu cầu.
- Mục 1/2 (B1-B9) **chưa soát pixel-by-pixel** như đã làm với mục 3 — có thể
  còn bug tương tự (sai copy/sai icon/sai variant) nhưng chưa kiểm.

## W6 (Hỏi về chuyến, E1/E2) — ĐÃ XONG phiên 02/10

**Đã xong:**
- `apps/mobile/src/features/booking/enquiry-form.ts` + `.spec.ts` — logic
  thuần TDD, 11 test xanh. `validateEnquiry`, `buildEnquiryPayload`, cộng
  `enquiryErrorCopy` mới (khuôn `cancelErrorCopy`: `error.status===429` →
  `errors.rateLimited`, còn lại → `errors.generic`).
- i18n: `enquiry.successTitle`/`backToTour`/`appShell.titles.askAboutTrip` đã
  có từ trước (16/16 xanh), KHÔNG thêm key "submitting" mới cho nút Send —
  nút chỉ `disabled`, không đổi chữ (bộ copy `mobile.enquiry` không có biến
  thể đó, đọc kỹ handoff xác nhận "chữ có sẵn nguyên khối" = đã đủ).
- `apps/mobile/src/features/booking/enquiry-screen.tsx` (+ `.spec.tsx`, 7
  test) — E1 (form, header native) + E2 (thành công). Tái dùng `BookingTripCard`
  cho khối trip-card tuỳ chọn (ẩn khi `tripTitle`/`tripSubtitle`/`tripImageUrl`
  đều `undefined`). 4 ô `iconVariant="boxed"`; ô Message DUY NHẤT dùng
  `alwaysShowLabel` + `placeholder={messagePlaceholder}` riêng (nhãn và
  placeholder là hai câu khác nhau trong mockup, ba ô kia label=placeholder
  nên dùng mặc định). Bottom bar tự vẽ (không tái dùng `BookingBottomBar` —
  mockup không có khối tổng tiền).
- Route `apps/mobile/src/app/enquiry.tsx` — điền sẵn tên/email từ session,
  tra `catalog.tours.bySlug` (enabled khi có `tourSlug`) lấy `tourId` cho
  payload, submit qua `enquiries.create`, lỗi qua `enquiryErrorCopy`.
  Đăng ký `<Stack.Screen name="enquiry">` trong `_layout.tsx`.
- Nối lối vào T7 (quá hạn) ở `bookings/[code].tsx`: `contactLine.onPress`
  đổi từ `router.push(\`/tours/${booking.tourSlug}\`)` (sai, chỉ về trang
  tour) sang `router.push({ pathname: '/enquiry', params: {...} })` mang kèm
  `tripTitle`/`tripSubtitle`/`tripImageUrl`. Hai lối còn lại (đợt đã đóng,
  tour hết đợt) vẫn CỐ Ý ngoài phạm vi — sống ở nhánh `mobile-browse-screens`.
- `routes.spec.tsx`: thêm `'enquiry'` vào `EXPECTED_ROUTES`.
- `pnpm --filter @tourism/mobile test` — 84 suite/543 test xanh (gồm cả
  `routes.spec.tsx`). `pnpm --filter @tourism/mobile typecheck` sạch. Biome
  check sạch trên mọi file đổi.

**Cờ đỏ phát hiện khi chạy `pnpm gate:int` (KHÔNG liên quan nhánh này):**
`@tourism/web#build` chết ở bước prerender `/login` —
`MALFORMED_ORPC_ERROR_RESPONSE` status 426 khi `fetchSiteMedia` gọi
`api.siteMedia.list` lúc SSG, tức API server không chạy lúc build web (cần
`pnpm dev` phía api trước). Việc của mobile không đụng gì tới web; coi đây
là điều kiện môi trường cần bật trước khi chạy `gate:int` toàn repo, KHÔNG
phải lỗi do W6 sinh ra. Đã xác nhận riêng `@tourism/mobile` (test+typecheck+
build deps) xanh toàn bộ.

**CỐ Ý ngoài phạm vi W6 lần này** (đã nói rõ với user, KHÔNG tự mở rộng):
- Lối vào "đợt đã đóng ở tab Dates" — ĐÃ có `AskAboutDateSheet` (D3, nhánh
  `feat/mobile-browse-screens`) làm việc tương đương qua sheet, không phải
  E1 full-screen đúng mockup, nhưng SỐNG Ở BRANCH KHÁC — đừng đụng từ nhánh
  booking này (luật 1 CLAUDE.md, one feature = one branch).
- Lối vào "tour không còn đợt nào" — chưa xác minh có tồn tại trong
  `tour-detail-screen.tsx` hay không, cũng thuộc nhánh browse-screens.

## W7 + W8 (cụm P bám ngày khởi hành, P1–P6) — ĐÃ XONG phiên 02/10 (phiên 2)

Làm cả hai việc cùng lúc (user yêu cầu "xong hết nhánh rồi test 1 thể") — W7
(đồng hồ server + P1/P2/P6) và W8 (P3/P4/P5) không còn lý do tách phiên vì
W8 chỉ dùng lại hạ tầng W7, không có gì chặn giữa.

**Hạ tầng đồng hồ server** (luật #5 handoff, "gọi `health.check` MỘT LẦN mỗi
phiên"):
- `apps/mobile/src/lib/server-clock.ts` (+ `.spec.ts`) — `clockOffsetMs`/
  `serverNow`, logic thuần.
- `apps/mobile/src/lib/use-server-clock.ts` — `useServerClock()`/`useServerToday()`,
  bọc `orpc.health.check` qua React Query (`staleTime`/`gcTime: Infinity` +
  `select` tính offset ngay lúc dữ liệu về — KHÔNG gọi lại giữa các màn).
  Không viết test cho hook (wiring mỏng, cùng nếp `useOnboardingStore`).

**Logic thuần cụm P** — `apps/mobile/src/features/trip-tracker/trip-tracker.ts`
(+ `.spec.ts`, 22 test): `tripPhase` (4 nhánh luật vào màn), `currentTripDay`,
`bookingProgressPercent`, `itineraryCalendarDate`, `whatToBringLines`/
`packingChecklistItems` (ghép policy `GENERAL` + 2 dòng đầu `excluded[]` —
**quyết định riêng, xem ghi chú `ponytail:` trong code** vì spec mô tả
"hai dòng đầu từ policy, hai dòng cuối từ excluded" không khớp đúng số dòng
của mockup thật), `visibleIncluded`, `vietnamTimeOfDay`/`timedStopStates`
(tô đậm mốc đang/đã qua trong "Today" của P5 — KHÔNG có trong spec gốc, tự
suy luật từ mockup vì spec chỉ nói cấp NGÀY, P5 cần cấp GIỜ).

**Ô tích packing list** — `apps/mobile/src/features/trip-tracker/packing-list.ts`
(+ `.spec.ts`): dùng **`expo-secure-store`, KHÔNG phải `AsyncStorage`** như
bản vẽ gốc ghi — repo chưa cài package đó, thêm dependency mới cần ADR riêng
(ADR-0040 §AMEND 1); `expo-secure-store` đã có sẵn (onboarding/session) và
đáp ứng đúng ý "lưu cấp máy, theo mã booking".

**Năm màn** (`apps/mobile/src/features/trip-tracker/`, mỗi màn kèm `.spec.tsx`):
- `trip-tracker-parts.tsx` — mảnh dùng chung (`SectionLabel`/`TripCountCard`/
  `TripMeter`/`RowLink`/`StaticTick`), cùng lý do tách `booking-parts.tsx`.
- `trip-upcoming-screen.tsx` — P1 (còn > 3 ngày, rail 4 mốc + "Get ready") VÀ
  P2 (≤ 3 ngày, chỗ gặp + checklist tương tác) trong MỘT component, chọn mặt
  qua prop `upcoming`/`imminent` (loại trừ nhau) — hai mockup chung khối đếm
  ngược trên đầu, tách hẳn thành hai file sẽ lặp lại khối đó.
- `trip-day-screen.tsx` — P5, tiêu đề header ĐỘNG "Day {n} of {total}".
- `trip-ended-screen.tsx` — P6. Nút "Write a review": **CHỈ khung UI, `onPress`
  no-op** — phát hiện giữa phiên có cả cụm **P5b-5 "Đánh giá" riêng** đã duyệt
  mockup (`mobile-review-screens.src.html`, 7 khung) + handoff
  (`docs/handoff/mobile-review-handoff.md`) + sẵn khối i18n `messages.reviews.*`
  dùng chung web, nhưng CHƯA branch nào dựng. Build form review (dù tối giản)
  ngay ở đây là phạm luật 1 CLAUDE.md — **đã hỏi lại và user đồng ý (02/10)
  chỉ dựng khung, nối thật ở nhánh `P5b-5` riêng sau này**, cùng nếp "Delete
  account" A7 trước đó.
- `trip-notes-screen.tsx` — P3. "Good to know" (FAQ) xổ NGAY TRONG màn (state
  cục bộ), không điều hướng đi đâu — mobile chưa có màn FAQ riêng ở nhánh
  nào, dựng link tới một màn không tồn tại là nói dối.
- `trip-itinerary-screen.tsx` — P4. Rail-dot numbered day giống hệt tab
  Itinerary của `tour-detail-screen.tsx` (D2) nhưng gắn ngày lịch thật; CỐ Ý
  không tách thành mảnh dùng chung với màn đó — màn đó đã có test ổn định
  riêng, tách lúc này là rủi ro không cần.

**Routes mới** — `apps/mobile/src/app/trips/[code]/` (Stack riêng, cùng khuôn
`bookings/new/_layout.tsx`): `index.tsx` (quyết P1/P2/P5/P6 theo `tripPhase`,
P5 tự đè tiêu đề header), `notes.tsx` (P3, nhận `tourSlug` qua query param),
`itinerary.tsx` (P4, nhận `tourSlug` + `departureStartDate`). Đăng ký
`trips/[code]` ở `_layout.tsx` gốc (`headerShown:false`, cùng khuôn
`bookings/new`).

**Đổi lối vào từ tab Trips** — `apps/mobile/src/app/(tabs)/trips.tsx`:
`onTripPress` giờ rẽ theo trạng thái (luật vào màn, handoff mục 3): `PAID` →
`/trips/${code}` (cụm P mới); còn lại (PENDING/CANCELLED/REFUNDED) → vẫn
`/bookings/${code}` như cũ.

**i18n** — khối `messages.mobile.trip` mới (toàn bộ khoá cụm P từ handoff
mục 5, cộng vài khoá tự suy — `endsOn`/`tomorrow`/`nearPlaces` — không có
trong danh sách spec nhưng cần để màn không có chữ trống) + ba title mới
(`yourTrip`/`beforeYouGo`/`yourItinerary`, P5 tiêu đề động không khai tĩnh).
`messages.spec.ts` đếm titles 21→24.

**Cổng đã chạy phiên này:**
`pnpm --filter @tourism/mobile test` — **92 suite / 596 test xanh** (gồm
`routes.spec.tsx` với 3 route mới). `pnpm --filter @tourism/mobile typecheck`
sạch. `pnpm turbo run build typecheck test --filter=@tourism/i18n --filter=
@tourism/mobile --filter=@tourism/contract` — 10/10 task xanh. Biome check
sạch trên mọi file đổi/mới của cả hai phiên 02/10.

`pnpm gate:int` ĐẦY ĐỦ chưa chạy lại (cùng cờ đỏ KHÔNG liên quan đã ghi ở
mục W6: `@tourism/web#build` chết vì API server không chạy lúc SSG — việc
môi trường, không phải do code nhánh này). Build/typecheck/test SCOPED của
mọi package nhánh này đụng tới (mobile, i18n, contract) đều xanh.

**CHƯA làm — biết trước, không phải bỏ sót:**
- Chưa thử máy thật/simulator cho TOÀN BỘ UI mới (P1-P6) — chỉ test đơn vị
  (render + tương tác qua RNTL), chưa soi bằng mắt trên máy.
- Nút "Write a review" (P6) chỉ là khung — xem ghi chú ở trên.
- Mục 1/2 (B1-B9) vẫn chưa soát pixel-by-pixel (treo từ phiên 01/10, không
  phải việc của phiên này).
- `nearPlaces`/thống kê "places" P6 nối nhiều điểm bằng `' and '` trần (không
  phải "A, B and C" chuẩn ngữ pháp khi ≥ 3 điểm) — đơn giản hoá cố ý, sửa nếu
  user thấy chướng.

## Phiên 02/10 (phiên 3) — vá bug `TextField` gạch chân trôi xa (phát hiện qua ảnh chụp máy)

User chụp màn thật: ô "Reason (optional)" (cụm huỷ booking, T6/T7) gạch chân
nằm xa hẳn phía dưới chữ — khoảng trống rỗng ở giữa. Nguyên nhân:
`libs/mobile/ui/src/lib/text-field.tsx` gộp `minHeight`/`alignItems` (tall,
`spacing(24)`, icon neo đầu) làm MỘT với `multiline` (chỉ nên là hành vi
`TextInput` xuống dòng) — nhưng đối chiếu lại mockup: `.field.tall` (B3
"Anything we should know?", E1 "Message") VÀ `.field.ph` KHÔNG tall (huỷ
booking "Reason") đều `multiline`-capable, chỉ khác ở việc có class `.tall`
hay không. Tách thành hai prop độc lập: `multiline` (TextInput) và `tall`
(minHeight/alignItems/icon margin). Gọi `tall` thêm ở
`booking-contact-screen.tsx` (B3) và `enquiry-screen.tsx` (E1 Message);
`cancel-sheet.tsx` (Reason) giữ nguyên — không `tall`, đúng mockup, đây chính
là chỗ fix. Test `text-field.spec.tsx`: sửa case cũ (`multiline` → thêm
`tall`) + thêm case mới canh ĐÚNG bug này (`multiline` không `tall` phải
giữ `minHeight(15)`/`alignItems:'center'`). `pnpm --filter @tourism/mobile-ui
test` 21 suite/130 test xanh, `pnpm --filter @tourism/mobile test` lại 92/596
xanh, typecheck sạch, biome sạch.

## Đang chờ — cách soi UI thật trên máy

User muốn soát từng màn thật khớp mockup (`mobile-booking-screens.src.html`),
từng trang một, tự nói "qua trang tiếp" khi xong. App là Expo/React Native,
không phải web — session này KHÔNG có computer-use (chưa bật ở Settings →
Desktop app → Computer use, `ToolSearch "computer"` không trả về tool nào).
User có cài ADB (platform-tools) riêng. Đã hỏi lại hai hướng, CHƯA chốt:

1. User tự bật Computer use trong Settings rồi báo lại — Claude điều khiển
   simulator/device Android thật qua ADB, giống app thật 100%.
2. Chạy `expo start --web` trong browser pane của Claude (không cần bật gì) —
   không phải app thật trên điện thoại, nhưng đủ soát bố cục/luồng từng màn.

Session sau đọc tới đây: hỏi lại user đã chọn hướng nào chưa trước khi tự
quyết.

## Chưa commit, chưa push

Toàn bộ thay đổi BA phiên (01/10: mục 3 fixes · 02/10 phiên 1: W6 · 02/10
phiên 2: W7+W8) vẫn nằm trên working tree, CHƯA `git add`/`git commit` gì —
chưa ai xác nhận commit. Nhánh này giờ đã code xong cả 25 khung mockup; bước
tiếp theo hợp lý là user tự thử trên máy/simulator rồi quyết commit.
