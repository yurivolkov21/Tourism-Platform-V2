# Tóm tắt nhánh `feat/mobile-browse-screens` (P5b-2) — cập nhật 2026-10-11

Bản này thay [bản 26/09](2026-09-26-branch-summary-mobile-browse-screens.md)
làm nguồn đúng cho tình trạng hiện tại. Bản 26/09 giữ nguyên làm lịch sử: nó tả
nhánh lúc còn 35 commit riêng, nay đã sai (mục 2).

Nguồn: `git log origin/main..HEAD` tới `813d7da5` (09/10), bản review nhánh
05/10 (R1–R8, Q5–Q8 và phần chung B1–B3, F, L, Q1–Q4), code trên cây làm việc
ngày 11/10, kết quả chạy kiểm ngày 11/10 (mục 5).

## Kết luận nhanh

- **12 mục riêng của review 05/10 (R1–R8, Q5–Q8): đủ cả 12 trong code.** 11 mục
  đã nằm trong commit; **R7 sửa 11/10, CHƯA commit** (mục 3).
- **Phần chung với nhánh account (B1–B3, F, L, Q1–Q4): đã vào `main` 09/10** qua
  nhánh `feat/mobile-account-screens`; nhánh này dựng lại từ `main` nên có sẵn.
- **Nhánh chỉ còn 1 commit riêng** (`813d7da5`, R2 và R3), cộng phần R7 chưa commit.
- **Kiểm bằng máy 11/10: xanh** trừ các lỗi môi trường đã biết (mục 5).
- **Chưa thử trên điện thoại.** R2 (Android và Google) chỉ có unit test; kịch bản ở mục 6.
- **Nhánh chậm `origin/main` 84 commit** — phải rebase trước khi merge (mục 4).

## 1. Chức năng của cụm màn xem tour

Toàn bộ T0–T7 ở bản 26/09 đã vào `main` 09/10 (commit `e91201b6` và các bản vá
sau đó). Không có gì đổi về chức năng so với bản 26/09, trừ các điểm sau:

| Điểm | Bản 26/09 | Nay |
| --- | --- | --- |
| D6 quay lại sau đăng nhập | Lưu ý định trong SecureStore (`lib/return-to.ts`), tự lưu tim ở màn login | Hộp nhớ trong bộ nhớ (`features/auth/return-to.ts`), tự lưu tim ở màn đích — theo cách của nhánh account |
| Rời màn Sign in | `router.replace` | `leaveAuthTo`: gỡ modal bằng `dismissTo`, hết thì `navigate` |
| Tìm không dấu | Lọc ở client | Giữ nguyên ở client (`foldAccents` trong `features/explore/`); phía API chưa làm |
| Phân trang review | Thủ công | Giữ nguyên; bấm lại chip sort đang chọn là no-op (F10) |

Ngoài phạm vi nhánh, vẫn như bản 26/09: nút "Book now" (P5b-3, thành viên khác
dựng) và tìm không dấu ở API.

## 2. Nhánh đã đổi hình thế nào

Review 05/10 đề xuất: merge nhánh account trước, rồi tạo nhánh mới từ `main`
chỉ mang phần còn giá trị. Đã làm đúng vậy:

- 14 commit chung và các bản vá B, F, L, N vào `main` 09/10 qua nhánh account.
- Ba commit riêng cũ (`7b3d6701`, `ffcb70fe`, `bc8e7790`) **bị bỏ**: hai commit
  đầu sửa `catalog.service.ts` rồi hoàn tác (diff ròng bằng 0), commit thứ ba
  trùng bản vá test admin đã có trên `main`. Vì vậy Q6, Q7, Q8 hết.
- Phần D6 của nhánh này (SecureStore) **bị bỏ**, lấy cách của nhánh account.
- Nhánh hiện tại = `main` tại `a0102b9c` cộng 1 commit `813d7da5`.

Bản cũ còn ở hai nhánh local `backup/browse-before-q678` và
`backup/browse-q678-rewrite` (chỉ ở máy, không push). Xoá khi nhánh đã merge.

## 3. Đối chiếu từng mục của review 05/10

### Lỗi riêng của nhánh

| # | Lỗi | Trạng thái | Sửa thế nào | Kiểm bằng |
| --- | --- | --- | --- | --- |
| R1 | Đóng login bằng vuốt/back không xoá ý định trong SecureStore | ✅ | Ý định nằm trong bộ nhớ, mất khi tắt app. `(auth)/_layout.tsx` gọi `abandonPendingReturn` khi cả nhóm unmount, bất kể rời bằng X, back hay vuốt (`5fcfe115`) | `return-to.spec.ts` |
| R2 | Android và Google: callback đưa stack về tabs, `replace` thay luôn tabs, back là thoát app | ✅ code, chưa thử máy | `leaveAuthTo`: `canDismiss()` sai thì `navigate` đẩy đích LÊN TRÊN tabs (`813d7da5`) | `leave-auth.spec.ts` ca 3 |
| R3 | Bấm X hoặc đăng nhập xong, tour bị nhân đôi trong stack | ✅ | `leaveAuthTo` dùng `dismissTo` về đúng màn dưới modal; nút X dùng chung (`813d7da5`) | `leave-auth.spec.ts` ca 1, 2 |
| R4 | Huỷ Google bị báo thành công, gọi `wishlist.set` khi chưa có phiên | ✅ | Đóng cửa sổ Google thì hỏi lại `getSession`; không có user trả `cancelled`, màn đứng nguyên (`e73f3dca`). Login không còn gọi `wishlist.set` | `google-flow.spec.ts`, `better-auth-actions.spec.ts` |
| R5 | `wishlist.set` gọi không chờ, không bắt lỗi, không làm mới `wishlist.check` | ✅ | Tự lưu tim chuyển sang màn đích, đi qua `useWishlistSetMutation`: hỏng thì trả tim và báo lỗi, xong thì invalidate `wishlist.check` và `wishlist.list` (`244c64d0`) | `wishlist-mutation.spec.tsx` |
| R6 | SecureStore ghi lỗi thì nút Sign in / Create account không làm gì | ✅ | `setPendingReturn` là gán biến đồng bộ, không còn promise nào để hỏng | Đọc code `tours/[slug].tsx` |
| R7 | `setPending(false)` chạy trước khi rời màn; bấm hai lần thì lượt sau về Home | ✅ **chưa commit** | Đăng nhập thành công thì KHÔNG nhả `pending` nữa, nút khoá tới khi màn gỡ hẳn. Sửa ở `login.tsx` (email và Google) và `register.tsx` (Google) | Chưa có test tự động — logic nằm trong route, repo không có spec cho route; thử tay ở bước 9 mục 6 |
| R8 | `handleSuccess` chép hai nơi; nhánh `else` của `onBack` chết; comment "nợ return-to" sai; JSDoc `LoginRoute` mất | ✅ | Hai màn gọi chung `leaveAuthTo`; `onBack` chỉ còn `router.back()`; comment ở `tour-detail-screen.tsx` nay tả đúng `setPendingReturn`; JSDoc `LoginRoute` có lại | Đọc code |
| Q5 | `lib/return-to.ts` không có test (luật 4) | ✅ | File đó đã bỏ. `features/auth/return-to.ts` có `return-to.spec.ts`, `leave-auth.ts` có `leave-auth.spec.ts` | Chạy test |
| Q6 | Ba tiêu đề commit không dấu (luật 12) | ✅ | Ba commit đó không còn trên nhánh; commit duy nhất viết có dấu | `git log origin/main..HEAD` |
| Q7 | Sửa `catalog.service.ts` rồi hoàn tác | ✅ | Hai commit bị bỏ; nhánh không đụng `apps/api` | `git diff origin/main...HEAD --stat` (4 file, đều ở `apps/mobile`) |
| Q8 | Commit sửa test admin trùng `main` | ✅ | Commit bị bỏ | Như Q7 |

### Phần chung với nhánh account

Tất cả đã vào `main`; hash dưới đây là hash trên `main`.

| Mục | Trạng thái | Commit |
| --- | --- | --- |
| B1 `nexora://` trong `TRUSTED_ORIGINS` production | ✅ | `cbbb7ea8` |
| B2 khoá `expo-authorization-proxy` | ✅ | `a7e8dbaf` |
| B3 đổi số ADR 0047 thành 0055 | ✅ | `169090ba` |
| F2 trình xem ảnh trên Android | ✅ | `dfd1e56b` |
| F3 bàn phím che tấm trượt iOS | ✅ | `7219356b` |
| F5 bộ lọc Explore, F10 chip sort review, F11 ngày 1 lịch trình, L1 đọc cookie | ✅ | `5fae8324` |
| F12 huỷ Google | ✅ | `e73f3dca` |
| L3 wrapper `AppImage` chết | ✅ | `1af570dd`, `61dab5fd` |
| L4 nhãn nút xoá lấy từ i18n | ✅ | `4f58e368`, `3ec947d6` |
| Q1 `Co-Authored-By` | ✅ | Commit riêng của nhánh không có trailer này |
| Q2 doc vào bản đồ, Q3 gỡ `docs/PROGRESS.md` | ✅ | Trên `main` |
| Q4 ADR có sau code | Nợ lịch sử, không sửa được | — |

### Mục "Hai cách làm D6" và "Thứ tự đề xuất"

| Việc review đề xuất | Trạng thái |
| --- | --- |
| Sửa B1–B3 trên nhánh account, merge account vào `main` | ✅ 09/10 |
| Chốt một cách làm D6 | ✅ Cách của nhánh account (bộ nhớ, tự lưu ở màn đích) |
| Tạo nhánh mới từ `main`, chỉ mang phần còn giá trị, kèm test, sửa R1–R8 | ✅ (R7 còn chờ commit) |
| Tiêu đề commit có dấu đầy đủ | ✅ |
| Chạy `pnpm gate:int` | ✅ 11/10, kết quả ở mục 5 |
| Kiểm trên máy Android luồng đăng nhập Google từ màn tour (R2) | ❌ chưa làm |
| Xoá nhánh sau khi phần cần giữ vào `main` | ❌ chưa tới lúc |
| Gợi ý: lưu bền ý định nếu đo được Android tắt app lúc đăng nhập Google | Chưa đo, chưa làm — đúng điều kiện review đặt ra |

## 4. Còn treo

1. **Commit phần R7** — hai file `app/(auth)/login.tsx`, `app/(auth)/register.tsx`
   đang sửa trên cây làm việc, chờ user duyệt.
2. **Thử máy thật** theo mục 6, nhất là R2 trên Android. Đăng nhập Google ở
   local cần `GOOGLE_CLIENT_ID`; nếu không có thì R2 chỉ kiểm được trên bản build
   trỏ API thật. ADR-0056 (Google native) khi thi công sẽ đổi luồng này — thử lại sau đó.
3. **Rebase lên `origin/main`** (chậm 84 commit, đo 11/10). `origin/main` không
   đổi gì ở `apps/mobile` và `libs/mobile` từ điểm tách; thử gộp bằng
   `git merge-tree` không xung đột.
4. **Khi merge** (việc của session gốc, luật 13): entry `docs/CHANGELOG.md`, và
   sửa dòng P5b-2 ở `docs/open-items.md` — dòng đó còn ghi "ba commit riêng chưa
   vào main, nhóm quyết port hay bỏ"; nay đã bỏ.
5. **Tìm không dấu ở API** — chưa làm, ngoài phạm vi nhánh. Client đã lọc không dấu.
6. **Soi nền sáng và nền tối trên máy thật** — treo từ bản 26/09.
7. **Xoá hai nhánh backup local** sau khi merge.

Nhánh không có migration và không cần đổi hạ tầng (luật 15).

## 5. Kết quả kiểm 11/10

Máy Windows, Node 24.19, pnpm 11.9, Postgres service local cổng 5432, Docker
không chạy container của repo, API không bật. Chạy trên cây có sẵn phần sửa R7.

| Lệnh | Kết quả |
| --- | --- |
| `typecheck` mọi package | Sạch |
| Unit test | Xanh hết: mobile **505**, mobile-ui **134**, api **1094**, admin **1911**, web **1764**, contract **665**, core 46, ui 36, i18n 24, tokens 19 |
| `biome check .` | 1679 file, không lỗi (1 dòng info có sẵn từ `main`) |
| tokens-only mobile | Đạt, 131 file |
| `bundle` mobile | Đạt: iOS 5.8MB, Android 6MB |
| `build` web và admin | Đỏ vì môi trường: web cần API đang chạy (`ECONNREFUSED`), admin cần `NEXT_PUBLIC_API_URL`. CI có đủ |
| `pnpm test:int` | **773/778**. 5 đỏ ngoài phạm vi nhánh: `check-rls` (2) gọi container Docker `tourism-v2-postgres-1` không chạy; `pending-sweep` (3) "expected 2 to be 1", lỗi đã ghi ở `docs/open-items.md` |

Hai ghi chú máy:

- `node_modules` của thư mục này hỏng lúc bắt đầu (cài từ đường dẫn
  `...\main\Tourism-Platform-V2` nay không còn, `babel-jest` không tìm thấy). Đã
  cài lại bằng `pnpm install --frozen-lockfile`; lockfile không đổi.
- `apps/api/.env.local` chưa có trên máy này — phải tạo trước khi chạy API (mục 6).

## 6. Kịch bản test trên điện thoại

### Chuẩn bị

Làm theo mục 10 của
[tóm tắt nhánh account](2026-10-06-branch-summary-mobile-account-screens.md)
(Postgres, build thư viện, `db:deploy`, `db:seed`, chạy API và Metro). Riêng máy
này phải tạo `apps/api/.env.local` từ `.env.example` và thêm dòng:

```bash
TRUSTED_ORIGINS=http://localhost:3000,http://localhost:3002,nexora://,exp://
```

Thiếu `exp://` thì đăng nhập từ Expo Go bị 403. Tài khoản: user seed
`…@example.com`, mật khẩu `Nexora!Demo2026` khi `SEED_CUSTOMER_PASSWORD` trống.

Mỗi kịch bản bắt đầu ở trạng thái **đã đăng xuất**, trừ khi ghi khác.

### Luồng quay lại sau đăng nhập (R1–R8)

| # | Mục | Thao tác | Kết quả đúng |
| --- | --- | --- | --- |
| 1 | R3 | Home → mở một tour → bấm tim → Sign in → đăng nhập email | Về đúng tour đó, tim đặc. Bấm back **một lần** là về Home/Explore |
| 2 | R3 | Mở tour → tim → Sign in → bấm X | Về đúng tour đó, tim rỗng. Back một lần là rời tour |
| 3 | R1 | Mở tour A → tim → Sign in → **vuốt xuống đóng** (iOS) hoặc **nút back** (Android). Rồi vào tab Account → Sign in → đăng nhập | Về tab Account, KHÔNG nhảy sang tour A. Mở tour A: tim rỗng, không tự lưu |
| 4 | R1 | Mở tour A → tim → Sign in → tắt hẳn app. Mở lại → tab Account → đăng nhập | Về Account; tour A không tự lưu |
| 5 | R1 | Lặp bước 3 nhưng lần đăng nhập sau dùng TÀI KHOẢN KHÁC | Tour A không vào Saved của tài khoản đó |
| 6 | R4 | Mở tour → tim → Sign in → "Continue with Google" → đóng cửa sổ Google | Ở nguyên Sign in, không báo thành công, không chữ đỏ, không về tour |
| 7 | R5 | Bước 1 xong → mở tab Saved | Tour có trong Saved. Quay lại Explore: tim của tour đó đặc |
| 8 | R5 | Đã đăng nhập. Tạm dừng tiến trình API (Suspend Process, cách làm ở mục 10 doc account) → mở tour → bấm tim | Tim đặc ngay, khoảng 10 giây sau trở về rỗng kèm dòng lỗi ngắn tự tắt |
| 9 | R7 | Mở tour → tim → Sign in → nhập đúng → bấm **Sign in hai lần thật nhanh** | Về đúng tour, KHÔNG về Home. Nút khoá từ lượt bấm đầu |
| 10 | R6 | Mở tour → tim → bấm "Create account" trên tấm mời | Sang màn đăng ký ngay; nút không bao giờ "bấm không ăn" |
| 11 | R8 | Ở Create account bấm mũi tên lùi | Lùi đúng một bước, không kẹt |
| 12 | D6 | Explore → bấm tim trên thẻ tour → Sign in → đăng nhập | Về Explore, tim của đúng thẻ đó đặc |
| 13 | D6 | Tab Saved khi chưa đăng nhập → Sign in → đăng nhập | Về Saved |

### Riêng Android và Google (R2)

Cần Google đã cấu hình (`GOOGLE_CLIENT_ID`) và máy Android thật.

| # | Thao tác | Kết quả đúng |
| --- | --- | --- |
| 14 | Home → mở tour → tim → Sign in → "Continue with Google" → chọn tài khoản | Về tour, tim đặc |
| 15 | Ngay sau bước 14 bấm **back cứng** | Về Home (tabs), app KHÔNG thoát |
| 16 | Bấm back lần nữa ở Home | Lúc này mới thoát app |
| 17 | Lặp bước 14 từ Create account | Như bước 14–16 |

### Cụm màn xem tour (hồi quy sau khi đổi D6)

| # | Thao tác | Kết quả đúng |
| --- | --- | --- |
| 18 | Home: tải, kéo danh sách địa danh theo vùng | Có nội dung; tắt mạng thì hiện lỗi và Try again |
| 19 | Home bấm một điểm đến → Explore; bấm × bỏ lọc; về Home bấm lại CÙNG điểm đến | Explore lọc lại đúng điểm đó (F5) |
| 20 | Home "See all tours" | Explore hết lọc điểm đến |
| 21 | Explore: lọc vùng, thời lượng, giá, độ khó; đổi sắp xếp | Danh sách đổi theo; không khớp gì thì hiện trạng thái rỗng |
| 22 | Ô tìm gõ "hoi an" và "da nang" (không dấu) | Ra Hội An, Đà Nẵng sau khoảng 0,3 giây |
| 23 | Mở tour chưa mở lần nào → tab Itinerary | Ngày 1 mở sẵn (F11) |
| 24 | Tab Dates | Nhóm theo tháng; có tag "Booking closed" / "Almost full"; chọn một đợt thì đáy màn đổi |
| 25 | Tab Reviews → bấm lại chip sort đang chọn; đổi sort; Load more | Bấm lại không làm rỗng danh sách (F10); đổi sort tải lại; Load more nối thêm |
| 26 | Bấm ảnh bìa → trình xem ảnh → chụm phóng to, kéo, vuốt xuống đóng | Chạy được trên cả Android (F2) |
| 27 | "Ask about this date" → nhập → gửi | iOS bàn phím không che ô (F3); gửi xong có xác nhận |
| 28 | Đã đăng nhập: bấm tim một tour 4–5 lần thật nhanh | Tim không nháy ngược, dừng ở trạng thái lượt cuối; Saved khớp |
| 29 | Mở slug không tồn tại (sửa tay đường dẫn ở dev) | Màn "tour không còn" |
| 30 | Bật dark mode, lướt Home, Explore, chi tiết tour | Chữ đọc được, không ô trắng lạc |

### Nghiệm thu bằng máy trước khi thử tay

```bash
pnpm turbo run typecheck test --filter=@tourism/mobile --filter=@tourism/mobile-ui
```

```bash
pnpm turbo run bundle --filter=@tourism/mobile
```

```bash
pnpm gate:int
```
