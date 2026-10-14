# Tóm tắt nhánh `feat/mobile-account-screens` (P5b-4) — cập nhật 2026-09-27

Đọc nhanh cho người chưa theo dõi nhánh. Nhánh này RẼ TỪ `feat/mobile-browse-screens`
(chứa nguyên 35 commit của nhánh đó + 24 commit riêng lên trên) — nên đọc
[tóm tắt browse-screens](2026-09-26-branch-summary-mobile-browse-screens.md)
trước nếu cần nền. Nguồn: `git log`, [`docs/handoff/mobile-account-handoff.md`](../handoff/mobile-account-handoff.md),
`docs/PROGRESS.md` (bản cuối 25/09, working-doc không còn trên `main`),
[`docs/open-items.md`](../open-items.md). Diff so `main` tính tới 26/09: **149
file, +15776/-770 dòng** (riêng so browse-screens: 53 file, +3547/-300) —
**CHƯA tính đợt 27/09** bên dưới (31 file đổi thêm, chưa commit lúc ghi dòng
này).

> **Bản ghi 26/09 ở dưới GIỮ NGUYÊN làm lịch sử — mục "Cập nhật 27/09" ngay
> sau đây là nguồn đúng cho tình trạng HIỆN TẠI.** Ba mục "Chưa làm trong
> nhánh" (Travel stories, A4, A7) mà bản 26/09 liệt — hai mục ĐẦU đã xong,
> A7 mới có UI.

## Cập nhật 27/09 — A4 (avatar), Personal details, Travel stories (G1–G4)

Phiên làm việc riêng, KHÔNG qua SDD — trực tiếp với user, nhiều vòng phản hồi
trên máy thật (Android) đã bắt được vài bug UI/tầng RN mà không subagent nào
tự thấy được nếu không cầm điện thoại lên.

**1. A4 — đổi ảnh đại diện (đã xong, có ADR).**
[ADR-0040 AMEND 5](../adr/0040-mobile-app-expo.md) duyệt trước khi code (luật
5) — thêm `expo-image-picker@~57.0.20`, quyền camera/thư viện trong
`app.json`. File mới: `features/account/avatar-flow.ts` (logic thuần: chọn
MIME hợp lệ, trần `AVATAR_MAX_BYTES`, orchestrate sign→upload→setAvatar, có
test), `features/account/edit-avatar-sheet.tsx` (tấm 3 lựa chọn: Take a
photo/Choose from library/Remove photo), `lib/media-upload.ts` (upload thật).
Route `account.tsx` refetch session sau khi đổi — mobile không có
`router.refresh()` của web.

Ba bug THẬT chỉ lộ ra khi chạy trên máy thật (không unit test nào bắt được):
- **`Unsupported FormDataPart implementation`** — `globalThis.fetch` của
  Expo SDK 57 là "winter" fetch chuẩn WHATWG, KHÔNG hiểu object
  `{uri,name,type}` (mẹo riêng của XHR/fetch legacy RN).
- **Blob 14 byte, MIME rỗng** — thử fetch(uri).blob() để né lỗi trên thì lại
  đọc SAI file cục bộ, Cloudinary từ chối "Raw file format not allowed".
  → **Chốt: dùng `XMLHttpRequest`** cho bước upload (native, không qua winter
  fetch) — đúng cách chuẩn RN vẫn làm, không phải lối tắt.
- **Ảnh mờ trên máy thật** — bug CHUNG của `AppImage` (`libs/mobile/ui`),
  không riêng avatar: `transformUrl` nhận thẳng số **dp**, không nhân
  `PixelRatio.get()`, nên Cloudinary trả ảnh đúng số dp = ít hơn số pixel vật
  lý máy cần vẽ (2–3x). Sửa MỘT chỗ trong `AppImage`, mọi ảnh trong app nét
  lại — không phải sửa riêng avatar.

**2. "Personal details" — màn RIÊNG (đã xong, đổi hướng so với plan cũ).**
Plan 25/09 viết "Personal details" mở tấm A3 (sửa tên) trực tiếp — SAI so với
mockup thật: đó là một MÀN, không phải tấm. Route mới `/personal-details`
(header native), hiển thị Name/Email (hàng ngang, nhãn trái/giá trị phải —
đúng `.kv` mockup) + dòng "Delete account" cuối màn (tách khỏi Sign out).
Bút chì sửa tên vẫn ở A1 như cũ, không đổi.

**3. A7 — xoá tài khoản: CHỈ UI, chưa nối API (chốt "UI trước", user quyết).**
`DeleteAccountSheet` dựng đúng khung mockup (heading, câu giải thích, ô mật
khẩu, hai nút) nhưng `onConfirm` CỐ Ý no-op — `deleteUser` vẫn chưa tồn tại ở
API/web, vẫn cần vòng ADR cascade riêng như bản 26/09 đã ghi. KHÔNG coi là
xong.

**4. Travel stories G1–G4 (đã xong, TOÀN BỘ — mục mà bản 26/09 ghi "chưa bắt
đầu").** File mới: `features/posts/markdown.ts` (parser thuần — chỉ `##`
heading/đoạn văn/`- ` bullet, cú pháp lạ rơi về đoạn-văn-thường đã lọc ký
hiệu, có test riêng), `posts-list-screen.tsx` (G1 bài mới nhất thẻ lớn + hàng
gọn, chip lọc MỘT tag qua API, ô tìm debounce 300ms; G2 rỗng-vì-tìm nhắc đúng
chuỗi gõ), `post-detail-screen.tsx` (G3 ảnh bìa tràn mép + markdown render;
G4 "Trips in this story", ẩn khi `relatedTours` rỗng). Route `/posts` (list,
header native) + `/posts/[slug]` (detail, header TỰ VẼ đè ảnh bìa).
"Travel stories" ở Account giờ điều hướng vào đây (trước là `onPress: () =>
{}`).

Hai bug thêm bắt được khi cuộn màn chi tiết bài viết trên máy thật:
- Nút back + status bar dính đè lên ẢNH bìa lúc mới vào (thiếu cộng
  `insets.top`).
- **Bug sâu hơn:** ban đầu tưởng đã sửa xong bằng cách thêm dải che cố định,
  nhưng dải đó lại là CON của `ScrollView` mà `Screen` tự bọc (`scrollable`
  mặc định true) — nên nó CŨNG cuộn theo, và nút back biến mất khi cuộn qua
  hero. Phải đổi `scrollable={false}` + tự dựng `ScrollView` riêng, đặt dải
  che + nút back/mở-web làm SIBLING (ngoài `ScrollView`) mới thật sự cố định.
  Ghi lại vì đây là bẫy dễ lặp lại ở bất kỳ màn full-bleed-hero nào khác.

Ngoài ra: sửa `RootStack.screenOptions` (`_layout.tsx`) — `headerStyle` dùng
nhầm `theme.colors.card` (đậm hơn `background` ở dark mode), và thiếu
`headerShadowVisible: false` — mọi màn header native (Password, Personal
details...) có viền ngang không có trong mockup. Sửa CHUNG, không riêng màn
nào.

**Kiểm đã chạy (27/09):** `pnpm turbo run typecheck test --filter=@tourism/mobile`
— **436 test / 71 suite xanh** (từ 354 ở bản 26/09), biome sạch,
`pnpm turbo run bundle --filter=@tourism/mobile` chạy được (android + ios),
`expo-doctor` 20/21 (1 fail CŨ, lệch patch version, không liên quan
`expo-image-picker` mới thêm). Đã bắt và sửa 1 test lệch thật khi chạy `pnpm
gate` toàn repo: `messages.spec.ts` đếm cứng số tiêu đề route (15) — thêm 2
route mới (`personalDetails`, `travelStories`) phải sửa lên 17.

**`pnpm test:int` (Postgres) — chạy được lần đầu cho nhánh này, 592/598 pass.**
6 fail KHÔNG liên quan nhánh (`apps/api` 0 file đổi, xác nhận `git status`) và
**flaky** — tập lỗi cụ thể ĐỔI giữa các lần chạy (`payments`↔`refunds`↔
`bookings`, `check-rls` lúc qua lúc không do Docker Desktop). Riêng
`pending-sweep.int.spec.ts` ("expected 2 to be 1") lặp lại GIỐNG HỆT cả hai
lần — nghi bug thật trong chính spec đó (thiếu dọn dữ liệu giữa test), có sẵn
từ trước, không phải do nhánh này.

**`@tourism/web#build` local: đã xanh sau khi xác định nguyên nhân —** một
tiến trình VS Code (PID) chiếm `127.0.0.1:3000`/`3001`, trả `426 Upgrade
Required` giả cho request SSG lúc build, làm build tưởng API chết. Đóng VS
Code, bật lại `apps/api` dev server sạch → build web pass. CI thật
(`.github/workflows/ci.yml`) dựng Postgres + API mới hoàn toàn mỗi lần chạy
nên KHÔNG dính kiểu lỗi máy-cá-nhân này.

**Còn treo sau 27/09:**
- A7 vẫn cần ADR cascade (server) trước khi nối `onConfirm` thật.
- G4 (tour liên quan) code xong nhưng **`PostRelatedTour` chưa được seed** —
  `prisma/seed.ts` không gán record nào, nên `relatedTours` rỗng ở MỌI bài
  hiện tại; muốn thấy G4 chạy thật cần thêm liên kết mẫu vào seed (chưa làm).
- Chưa commit/push đợt 27/09 (31 file, xem `git status`).
- Flaky int test (`pending-sweep`, và tổng thể `apps/api` test:int) — ghi
  nhận, KHÔNG sửa (ngoài phạm vi nhánh mobile).

## Đã làm xong

Theo spec [`2026-09-25-mobile-account-screens.md`](../plans/2026-09-25-mobile-account-screens.md),
chạy bằng SDD (subagent-driven development):

1. **Plan A — return-to-auth + AuthGateScreen (mục 1).** Hộp nhớ "quay lại
   đúng chỗ sau đăng nhập" dùng chung mọi nơi (`return-to.ts`), component chặn
   tab dùng chung Saved/Account (`AuthGateScreen`). Đóng nợ D6 cũ: bấm tim khi
   chưa đăng nhập ở tour detail → đăng nhập xong → tự quay lại đúng tour VÀ
   tim tự đặc, không cần bấm lại.
2. **Saved (mục 2, S1–S3).** `wishlist.list`/`wishlist.set`, chưa đăng nhập →
   `AuthGateScreen`, rỗng → `EmptyState`, có dữ liệu → thẻ tour luôn `favorited`,
   bỏ lưu lạc quan. Cờ `unavailable` (tour đã gỡ publish) → thẻ mờ + pill
   "No longer available", khoá bấm, KHÔNG ẩn thẻ.
3. **Account hub + A3/A5/A6 (mục 3).** A1 hồ sơ (avatar/tên/email, 8 dòng menu
   theo tần suất, Sign out tách khoảng trắng) · A3 sửa tên (`EditNameSheet`,
   `authClient.updateUser`) · A5 đăng xuất (`SignOutSheet`, biến thể Button
   MỚI `"destructive"`) · A6 đổi mật khẩu (route riêng header native,
   `authClient.changePassword` kèm `revokeOtherSessions:true`).
4. **Loạt fix UI polish 26/09** (sau khi PROGRESS.md ghi lần cuối, chưa có
   tài liệu tổng hợp riêng — liệt từ commit log): bỏ tiêu đề "Account" thừa ở
   A1 khi đã đăng nhập (yêu cầu 26/09) · sửa icon nút sửa tên (`edit` đúng
   mockup, trước dùng nhầm `edit-2`) · A3 thêm heading/câu giải thích còn
   thiếu, sửa icon TextField sai khuôn Account · TextField (mobile-ui) thêm
   padding dọc riêng, tránh chữ sát gạch chân · nối `onboardingStore` thật
   bằng `expo-secure-store` (trước là bản giả lập RAM) · sửa
   `EXPO_PUBLIC_WEB_URL` tự thay `localhost` → IP LAN giống `API_URL` (thiếu
   thì 5 link mở-ngoài — FAQ/About/pháp lý — chết trên máy thật cùng mạng) ·
   ô avatar Home bo góc vuông thay vì tròn · thêm test API xác nhận
   `change-password` sai mật khẩu hiện tại trả đúng `INVALID_PASSWORD`.

**Chưa làm trong nhánh (đã lên lịch, chưa tới lượt — không phải lỗi):**
- **Travel stories (mục 4 spec)** — cụm bài viết, độc lập hoàn toàn không cần
  đăng nhập, spec đã có, CHƯA bắt đầu code.
- **A4 avatar** — cần ADR mới (AMEND vào ADR-0040) cho `expo-image-picker`
  TRƯỚC khi thêm dependency, CHƯA hỏi user.
- **A7 xoá tài khoản** — CỜ ĐỎ: `deleteUser` chưa tồn tại ở cả API lẫn web,
  cần vòng brainstorm/ADR riêng cho phần cascade booking/review/wishlist
  TRƯỚC khi động client. Việc riêng, đụng cả `apps/api`.

## Kiểm đã chạy — xanh (tính tới bản ghi PROGRESS 25/09)

57 suite / 354 test xanh, `tsc --noEmit` sạch, biome sạch, tokens-only sạch
(loạt fix UI 26/09 sau đó không có ghi số test mới trong tài liệu, chỉ có
trong commit message riêng lẻ).

## Chưa làm / còn treo

1. **Chưa kiểm tay trên máy thật cho TOÀN BỘ nhánh** — mọi mục (return-to,
   Saved, Account hub) đều ghi "phiên AI không có thiết bị". Quan trọng nhất:
   bấm tim chưa đăng nhập → Sign in → xác nhận quay đúng tour + tim tự đặc;
   VÀ nhánh "bấm X bỏ dở rồi đăng nhập lại từ chỗ khác" PHẢI không bị dạt về
   tour cũ (đây là bug quan trọng vừa vá, chưa xác nhận thật). Xem
   [`docs/open-items.md`](../open-items.md) mục "Cần thử lại bằng máy thật".
2. **`pnpm gate:int` CHƯA chạy trọn** — thử 25/09 bị chặn ở
   `@tourism/admin#build` (`Missing API origin: NEXT_PUBLIC_API_URL`), xác
   nhận KHÔNG do nhánh này (lỗi y hệt trên `main` sạch). Đã chạy RIÊNG phần
   mobile (typecheck/test/i18n) xanh, nhưng build web/admin + api int test
   đầy đủ vẫn thiếu — cần ai đó set biến môi trường build trước (việc hạ
   tầng, không tự set trong session thi công theo luật 15 CLAUDE.md).
3. **`pnpm turbo run bundle --filter=@tourism/mobile` chưa chạy** cho nhánh
   này (browse-screens đã chạy xanh, nhưng account-screens thêm code mới
   sau đó chưa re-run).
4. **`expo-doctor` chưa chạy riêng cho nhánh này** (kế thừa 20/21 từ
   browse-screens, chưa xác nhận lại).
5. **Ba nợ nhỏ đã ghi vào `docs/open-items.md`** (không chặn merge):
   - Explore-tab wishlist gate chưa gọi `setPendingReturn` — bấm tim ở thẻ
     tour trên Explore rồi đăng nhập xong thì về Home, KHÔNG về đúng Explore
     (spec §1b bỏ sót nơi này, chỉ tour-detail có).
   - `login.tsx`'s nút X đóng màn luôn về Home, kể cả khi mở từ một tour cụ
     thể — sửa để về đúng tour là việc nhỏ, chưa làm.
   - `router.replace` khi quay lại tour đã mount sẵn dưới modal login CÓ THỂ
     đẩy thêm bản sao vào stack thay vì đóng modal đúng cách — nghi đổi sang
     `router.back()` đúng hơn nhưng CẦN test tay máy thật trước khi đổi (rủi
     ro đổi sai điều hướng nếu không kiểm chứng được).
6. **Chưa soi nền sáng/tối trên máy thật** cho các màn mới (Saved, Account
   hub) — kế thừa nợ tương tự từ browse-screens.
7. **Chưa push/hỏi merge** tính tới bản ghi PROGRESS cuối (25/09) — cần xác
   nhận lại vì loạt commit 26/09 có thể đã đổi tình trạng này (ảnh chụp màn
   hình cho thấy nhánh đã có mặt trên remote/GitHub "4 giờ trước").

## Quyết định kỹ thuật đáng chú ý (đừng hỏi lại)

- Ba tab chặn (Saved/Trips/Account) khi chưa đăng nhập dùng CHUNG một
  component, KHÔNG viết ba lần và KHÔNG đá khách sang màn Sign in rời (phải
  quay lại đúng tab).
- Hồ sơ/mật khẩu đi qua Better Auth (`authClient.*`), KHÔNG qua oRPC.
- Đổi mật khẩu LUÔN kèm `revokeOtherSessions: true` (khớp web, ADR-0017 §7a).
- Xoá tài khoản đặt ở "Personal details", KHÔNG đặt cạnh nút đăng xuất (dễ
  bấm nhầm) — nhưng bản thân tính năng CHƯA làm (xem A7 ở trên).
- **(27/09) Upload ảnh dùng `XMLHttpRequest`, KHÔNG `fetch`** — winter fetch
  của Expo SDK 57 không đọc đúng file cục bộ qua `.blob()` và không hiểu
  `{uri,name,type}`. Áp dụng cho MỌI upload ảnh sau này trong mobile, không
  riêng avatar.
- **(27/09) `AppImage` PHẢI nhân `width` theo `PixelRatio.get()` trước khi
  gọi `transformUrl`** — đã sửa trong `libs/mobile/ui`, áp dụng chung mọi
  ảnh. Đừng revert.
- **(27/09) Màn full-bleed hero (ảnh tràn mép) + header tự vẽ đè lên ảnh:**
  header/overlay PHẢI là sibling của `ScrollView` (Screen `scrollable={false}`
  + tự dựng `ScrollView` riêng), KHÔNG được là children của `Screen`
  scrollable mặc định — nếu không header cuộn mất theo nội dung. Xem
  `post-detail-screen.tsx` làm mẫu.
- **(27/09) `RootStack.screenOptions` header: dùng `theme.colors.background`
  (không phải `card`) + `headerShadowVisible: false`** — khớp mockup
  `.compact-head` hoà phẳng vào nền, không viền.
