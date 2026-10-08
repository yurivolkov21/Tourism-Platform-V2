# Tóm tắt nhánh `feat/mobile-account-screens` (P5b-4) — cập nhật 2026-10-08

Bản này thay [bản 26/09](2026-09-26-branch-summary-mobile-account-screens.md)
làm nguồn đúng cho tình trạng hiện tại. Bản 26/09 giữ nguyên làm lịch sử; chỗ
nào nó nói khác bản này thì tin bản này (ví dụ A7 nay đã nối API thật). Tên
file giữ ngày 06/10 vì `docs/README.md` đã trỏ vào đây; nội dung viết lại 08/10.

Nguồn: `git log main..HEAD` tới `0bd1609b` (08/10), spec
[`2026-09-25-mobile-account-screens.md`](../plans/2026-09-25-mobile-account-screens.md),
review 05/10 (24 phát hiện: B1–B3, F1–F12, L1–L5, Q1–Q4) và đợt rà 07/10 (N1–N10).

## Kết luận nhanh

- **Chức năng: đủ theo spec.** 14 khung S1–S3, A1–A7, G1–G4 đều đã dựng và nối API.
  Thiếu duy nhất là DỮ LIỆU cho G4 (D2), không phải code.
- **Ba lỗi chặn merge B1–B3 đã sửa 08/10** (mục 4).
- **Còn mở:** 4 lỗi kế thừa F5, F10, F11, L1 (mục 5); N7–N10 mức thấp (mục 7);
  3 commit kế thừa còn `Co-Authored-By`; nhánh chậm `main` **359 commit**
  (đo 08/10, chưa rebase); chưa thử máy thật cho đợt sửa 06/10–08/10.

## 1. Chức năng theo spec

| Khung | Nội dung | Trạng thái |
| --- | --- | --- |
| Hạ tầng | `AuthGateScreen` dùng chung, hộp nhớ return-to, đóng nợ D6 | ✅ |
| S1–S3 | Saved: danh sách, rỗng, chặn khi chưa đăng nhập | ✅ (06/10 thêm tải nhiều trang, L5) |
| A1 | Account hub: hồ sơ, menu, Sign out tách riêng | ✅ |
| A2 | Account khi chưa đăng nhập, 5 dòng ngoại tuyến | ✅ |
| A3 | Sửa tên | ✅ |
| A4 | Đổi ảnh đại diện (ADR-0040 AMEND 5, upload bằng XHR) | ✅ |
| A5 | Đăng xuất (06/10: xoá cache query, F8) | ✅ |
| A6 | Đổi mật khẩu, `revokeOtherSessions: true` | ✅ |
| A7 | Xoá tài khoản, nối `DELETE /api/account` (F6) | ✅ — bản 26/09 ghi "chỉ UI" nay đã sai |
| G1–G3 | Travel stories: danh sách, tìm, lọc tag, chi tiết | ✅ |
| G4 | "Trips in this story" | ✅ code, ❌ chưa có dữ liệu (D2) |

Ngoài phạm vi theo spec: tab Trips (P5b-3) và màn "My reviews" (R4, P5b-5) —
dòng menu "My reviews" cố ý chưa làm gì khi bấm.

## 2. Đã sửa sau review 05/10

| Mục | Nội dung | Commit |
| --- | --- | --- |
| B1 | `nexora://` được đứng trong `TRUSTED_ORIGINS` ở production (mục 4) | `98420206` |
| B2 | Khoá `expo-authorization-proxy`, hết open redirect (mục 4) | `f8b37239` |
| B3 | Đổi số ADR tầng dữ liệu mobile 0047 → 0055 (mục 4) | `0bd1609b` |
| F6 | Xoá tài khoản nối API, map đủ mã lỗi server | `21c0bfa5` |
| F1 | Rời nhóm auth bằng back/vuốt thì dọn hộp nhớ return-to | `5390a8bc` |
| F2 | Trình xem ảnh: `GestureHandlerRootView` đặt trong `Modal` (Android) | `4a97c379` |
| F3 | Tấm trượt né bàn phím iOS | `a709fc1c` |
| F4 | Saved hiện lại tour đã bỏ lưu rồi lưu lại | `cc462690` |
| F7, F8 | Chọn ảnh thư viện không xin quyền; đăng xuất xoá cache | `f592cbea` |
| D3 (1, 2) | Explore nhớ đường về sau đăng nhập; nút X về đúng chỗ mở | `9a5f2a85` |
| L2, L5 | `AppImage` kẹp mật độ 2x, hero dùng bề rộng màn, viewer bỏ `* 2`; Saved tải hết các trang (`useInfiniteQuery`), lọc trùng | `e3a73ab8` |
| L3 | Gỡ wrapper chết `components/app-image.tsx`; ADR-0055 AMEND 2 | `c8fa1c6e` |
| F9, F12 | `readHasSeen()` bắt lỗi SecureStore (lỗi thì vào app, không kẹt splash); huỷ cửa sổ Google thì hỏi lại `getSession`, không có user thì `cancelled` | `ba2a1881` |
| L4 | `Chip` nhận `removeLabel`; Explore truyền copy từ `@tourism/i18n` | `b6973451` |
| Q2, Q3 | Thêm 7 doc mới của nhánh vào `docs/README.md`; gỡ `docs/PROGRESS.md` | `56856bdc` |
| Q1 | Gỡ `Co-Authored-By` khỏi message 55 commit (`filter-branch`, tree không đổi) — trừ 3 commit kế thừa, xem mục 3 | 07/10, bản cũ ở `backup/account-truoc-q1` |
| Q4 | Đi theo B3: ADR nay là 0055. Việc ADR có sau 9 commit code là nợ lịch sử, không sửa được | — |
| N1–N6 | Lỗi mới tìm khi rà 07/10 (mục 7, 9) | `5a883871` · `bbfe667e` · `10730a35` · `a5a827ff` |

Hash là hash SAU Q1 (07/10). Hash cũ trước Q1 (`868fb82e`, `3e9ffb3c`,
`cc6a6612`…) chỉ còn trên nhánh `backup/account-truoc-q1`.

Kiểm 08/10 sau B1–B3 (máy Windows, Postgres service local, Docker tắt):
`pnpm gate` — test xanh hết (api **987/987**, mobile **487/487**, mobile-ui
**134/134**, contract 353, tokens 18), typecheck và Biome sạch; build `web`
đỏ vì SSG cần API đang chạy (`ECONNREFUSED`), build `admin` cần
`NEXT_PUBLIC_API_URL` — cả hai là thiếu môi trường local, CI có đủ.
`pnpm test:int` **594/599**: 5 đỏ ngoài phạm vi nhánh — `check-rls` (2) gọi
container Docker `tourism-v2-postgres-1` không chạy; `pending-sweep` (3)
"expected 2 to be 1", lỗi đã ghi từ 26/09 (mục 5). Spec auth đụng tới
(`auth-hardening`, `env`) xanh. Cần CI xác nhận lại sau push.

## 3. Đang treo — việc của nhánh này

1. **D2** — gán tour liên quan cho bài viết (admin hoặc `seed.ts`) để G4 có dữ liệu.
   DB local 07/10: bảng `post_tours` trống.
2. **D3 mục 3** — đăng nhập xong đang `router.replace` về tour đã mount dưới
   modal, có thể đẩy bản sao vào stack. Chỉ đổi sau khi thử máy thật.
3. **Rebase lên `main`** — chậm 359 commit (đo 08/10 sau `git fetch`). `main`
   có migration mới (`20261005003043_post_tag_links_order` trở đi) nên rebase
   xong chạy `pnpm db:deploy` cho DB local. Lúc rebase: bảng ADR ở
   `docs/README.md` giữ cả các dòng 0047–0054 của `main` lẫn dòng 0055 của
   nhánh; entry CHANGELOG của nhánh đặt lên trên. Rebase viết lại lịch sử nên
   push sau đó cần `--force-with-lease` — hỏi user trước.
4. **Ba commit còn `Co-Authored-By`** (`9a1db2de`, `c4a2f926`, `5232e4b9`) nằm
   trên `feat/mobile-browse-screens` — sửa ở nhánh đó.
5. **Kiểm trước khi xin review:** `bundle`, `expo-doctor`, thử máy thật Android và iOS:
   - F2 cử chỉ zoom (Android), F3 bàn phím (iPhone), F6 với API thật.
   - L2 độ nét ảnh hero/viewer trên máy 3x.
   - D3: tự lưu tim từ Explore, nút X, đường về sau đăng nhập.
   - Đăng nhập Google từ app (đi qua proxy đã khoá ở B2) — cần `GOOGLE_CLIENT_ID`.
   - Nền sáng/tối các màn mới.
6. **Doc tổng hợp cuối và `docs/open-items.md`** — user chốt để sau; `open-items`
   mục 1–2 (D3) vẫn ghi đang mở dù đã sửa. Khi merge, thêm vào đó rủi ro login
   CSRF còn lại của B2 (ADR-0017 §11).
7. **Việc hạ tầng cho session gốc, làm SAU review** (luật 15 — nhánh thi công
   không tự làm): thêm `nexora://` vào `TRUSTED_ORIGINS` trên Render khi deploy
   bản có B1. Nhánh này không có migration mới.

## 4. Ba lỗi chặn merge — đã sửa 08/10

Cả ba nằm ở phần chung với `feat/mobile-browse-screens`. Các nhánh mobile khác
(`browse`, `booking`, `review`) vẫn mang ADR số 0047 và B1/B2 cũ — nhánh nào
merge sau phải lấy bản sửa ở đây (đổi số y hệt sang 0055).

- **B1** (`98420206`) — ADR-0017 AMEND §10. `env.ts` miễn luật https cho
  đúng chuỗi `nexora://` (hằng `MOBILE_APP_ORIGIN`); `exp://`, `nexora://evil`,
  `other://` vẫn chặn ở production; `CORS_ORIGINS` không phải chứa nó. Test ở
  `env.spec.ts`.
- **B2** (`f8b37239`) — ADR-0017 AMEND §11. Không tắt được `expo()` ở
  production vì app bản build đăng nhập Google qua đúng endpoint proxy. Thay
  vào đó before-hook trong `auth.config.ts` chặn `/expo-authorization-proxy`
  TRƯỚC handler (không redirect, không đặt cookie), chỉ cho qua khi
  `isAllowedExpoAuthorizationUrl` (`auth/expo-proxy-guard.ts`) đúng cả ba:
  endpoint `https://accounts.google.com/o/oauth2/v2/auth`, `client_id` của
  mình, `redirect_uri` về `<baseURL>/callback/google`. Google chưa cấu hình thì
  chặn hết. Test: `expo-proxy-guard.spec.ts` (8 unit) và
  `auth-hardening.int.spec.ts` mục 3 (URL lạ → 400, không `location`, không
  `set-cookie`). Còn lại: login CSRF do `state` của plugin — ghi ở ADR, chưa xử lý.
- **B3** (`0bd1609b`) — `main` đã có 0047 `tour-editor-sections` và đi tới
  0054 (không phải 0052 như lúc review), nên đổi sang **0055** chứ không phải
  0053. Đổi tên file, sửa mọi chỗ viện dẫn (code mobile, mobile-ui,
  `jest.setup.js`, plan T0, `docs/README.md`, entry CHANGELOG chưa merge của
  nhánh), ghi dòng "Đánh số lại" ở đầu ADR. Message commit cũ vẫn ghi
  "ADR-0047" — không sửa lịch sử.

## 5. Lỗi kế thừa còn mở

Kế thừa từ browse-screens; đọc code 08/10 xác nhận vẫn còn. User chưa quyết sửa ở đâu.

| Mục | Lỗi | Chỗ |
| --- | --- | --- |
| F5 | "See all tours" ở Home mở `/explore` không param nên bộ lọc điểm đến cũ còn nguyên; bấm lại đúng điểm đến cũ thì param không đổi, effect không chạy | `(tabs)/index.tsx:48`, `(tabs)/explore.tsx:74` |
| F10 | Bấm lại chip sort đang chọn: `setReviewItems([])` mà query key không đổi → danh sách review rỗng, không tải lại | `tours/[slug].tsx:462` |
| F11 | `expandedDay` lấy giá trị lúc mount khi tour chưa về → ngày 1 không mở sẵn | `tour-detail-screen.tsx:333` |
| L1 | `withMobileAuth()` gọi `getCookie()` đọc SecureStore đồng bộ mỗi lần | `lib/api/client.ts:28` |

Ngoài mobile, bản 26/09 đã ghi int test `apps/api` flaky
(`pending-sweep.int.spec.ts` lặp lại "expected 2 to be 1") — không liên quan nhánh.

## 6. Quyết định kỹ thuật mới (đừng hỏi lại)

- **Return-to tách hai phần:** đường dẫn do màn auth tiêu thụ, replay do màn đích
  tiêu thụ; replay mang `from` (`'tour-detail' | 'explore'`) để màn này không
  "cướp" replay của màn kia.
- **Nút X ở Sign in dùng `router.dismissTo(peekReturnPath() ?? '/')`** — `peek`,
  không `consume`, để bỏ dở thì không kích replay tự lưu tim.
- **`AppImage` nhận dp, tự nhân mật độ, kẹp ở 2x** (`physicalWidth()`). Nơi gọi
  không được tự nhân thêm. Thay quyết định 27/09 "nhân `PixelRatio.get()`".
- **Màn import `AppImage` thẳng từ `@tourism/mobile-ui`** và truyền
  `transformUrl={cloudinaryUrl}` (ADR-0055 AMEND 2 — số cũ 0047, đổi 08/10).
- **Saved tải hết các trang** vì contract kẹp `pageSize ≤ 100`; chỉ dọn tập
  "đã bỏ lưu" khi đã có đủ mọi trang.
- **Đăng xuất và xoá tài khoản đều đi qua `signOutAndClearCache()`** — xoá cache
  query trước và sau, không bao giờ ném lỗi.

## 7. Lỗi mới tìm thấy khi rà 07/10 (N1–N6 đã sửa cùng ngày, xem mục 9)

Rà toàn bộ cụm account/saved/posts sau F9/F12/L4. Mục 1, 2, 4 đã đọc code xác
nhận; còn lại là kết quả rà, chưa kiểm tay từng mục.

| # | Mức | Lỗi | Chỗ |
| --- | --- | --- | --- |
| N1 | cao | Bỏ lưu nhanh liên tiếp mất rollback/báo lỗi — `onError`/`onSettled` truyền vào `mutate()`, TanStack v5 bỏ callback của lần gọi trước | `saved.tsx:76-94`, `explore.tsx:200-209`, `tours/[slug].tsx:157-166, 195-204` |
| N2 | TB | `PanResponder` tạo một lần trong `useRef`, giữ `onClose` cũ — kéo tay nắm vượt guard `pending` khi đang xoá tài khoản | `bottom-sheet.tsx:75-99` |
| N3 | TB | Tấm Avatar/Edit name đóng được (backdrop, back Android) khi đang xử lý, lỗi bị nuốt | `account.tsx:300, 316` |
| N4 | TB | "Load more" bấm đúp nhảy trang 1 → 3, mất trang 2 | `posts/index.tsx:94` |
| N5 | TB | Đổi tag/search vẫn hiện bài cũ đến khi data mới về; không có skeleton | `posts-list-screen.tsx:130-198` |
| N6 | TB | Refetch `wishlist.check` đè trạng thái lạc quan — tim nháy khi lưu rồi bỏ nhanh | `explore.tsx:125-129`, `tours/[slug].tsx:130-134` |
| N7 | thấp | Bấm đúp Take photo/Choose library trước khi picker mở (nghi ngờ) | `account.tsx:175-201` |
| N8 | thấp | Change password: gõ lại không xoá lỗi form; thành công thì về mà không báo | `change-password.tsx:51-73` |
| N9 | thấp | Saved trên 100 mục: đếm "100 tours" trước khi các trang sau về | `saved.tsx:101-107` |
| N10 | thấp | A11y: chip thiếu `selected`, tag ở post detail đọc là "nút", backdrop không nhãn | `chip.tsx`, `post-detail-screen.tsx:145`, `bottom-sheet.tsx:110` |

Đề xuất: sửa N1–N6 trước khi xin review. **Đã làm 07/10 (mục 9);** N7–N10
vẫn mở. Cột "Chỗ" ghi số dòng TRƯỚC khi sửa.

## 8. Kịch bản test trên điện thoại

Chuẩn bị:

- Chạy API + Metro theo mục 10. `apps/mobile/.env.local` để nguyên
  `http://localhost:3001` — `resolveDevOrigin` (`src/lib/env.ts`) tự thay
  `localhost` bằng IP LAN của Metro khi chạy trên máy thật (kịch bản 06/10 dặn
  sửa tay sang IP LAN là thừa). Điện thoại và máy cùng Wi-Fi.
- Tài khoản: user seed `@example.com`, mật khẩu là `SEED_CUSTOMER_PASSWORD` hoặc
  mặc định `MAT_KHAU_KHACH_MAC_DINH` (`apps/api/prisma/fixtures/chot-chan-seed.ts`).
  Test xoá tài khoản bằng một user seed khác.

Khởi động (F9):

1. Cài mới → onboarding → qua hết → vào Home.
2. Tắt hẳn, mở lại → không hiện onboarding, không kẹt splash.

Return-to khi chưa đăng nhập (D3):

3. Đăng xuất, bấm tim ở Explore → Sign in → đăng nhập → về Explore, tim đã đặc.
4. Lặp bước 3 ở tour detail → về đúng tour đó.
5. Ở Sign in bấm X, vuốt back (iOS), nút back (Android) → về màn trước, không kẹt.
6. Tab Saved khi chưa đăng nhập → lời mời đăng nhập → đăng nhập → về Saved.

Google (F12):

7. "Continue with Google" rồi đóng/huỷ → ở nguyên Sign in, không báo thành công, không lỗi đỏ.
8. Đăng nhập Google thật (nếu đã cấu hình) → vào app.

Saved (S1–S3):

9. Lưu 3 tour → Saved hiện "3 tours".
10. Gỡ một tour → mất ngay, bộ đếm giảm; tim ở Explore rỗng.
11. Lưu lại tour vừa gỡ → hiện lại trong Saved (F4).
12. Chế độ máy bay rồi gỡ → tour hiện lại, báo lỗi ngắn tự tắt ~3 giây.
13. Gỡ hết → hiện "Nothing saved yet" và nút Browse tours. (Saved KHÔNG có kéo
    để refresh — kịch bản 06/10 ghi bước này là sai so với code.)
14. (Tuỳ chọn) Trên 100 mục trong DB local → hiện đủ, không trùng (L5).

Tour detail và ảnh (F2, L2, L4):

15. Ảnh hero nét. Mở trình xem ảnh → pinch zoom, kéo (Android) → vuốt ảnh khác → đóng.
16. Explore chọn điểm đến → chip có ×, bấm × bỏ lọc.

Account (A1–A7):

17. Tab Account: avatar, tên, email, đủ menu.
18. Bút chì → Edit name; iOS bàn phím không che ô (F3); lưu tên mới → đổi ngay; tên rỗng bị chặn.
19. Avatar → Take a photo: từ chối quyền → câu nhắc; cho quyền, chụp → avatar đổi.
20. Choose from library → avatar đổi; ảnh trên 2MB → báo lỗi; Remove photo → về chữ cái đầu.
21. Password: sai mật khẩu hiện tại, dưới 8 ký tự, xác nhận lệch → báo lỗi; đúng → lưu, đăng nhập lại bằng mật khẩu mới được.
22. Personal details → Delete account: "Keep my account" đóng tấm; sai mật khẩu → lỗi; đúng → về trạng thái khách, đăng nhập lại thất bại.
23. Sign out: "Stay signed in" không đổi; Sign out → Saved/Account về trạng thái khách; đăng nhập tài khoản khác không thấy dữ liệu cũ (F8).
24. Help, About, Privacy, Terms, Cancellation → mở trình duyệt đúng trang.

Travel stories (G1–G4):

25. Account → Travel stories → danh sách hiện.
26. Gõ "hue" → lọc sau ~0,3 giây; gõ "zzzz" → "No stories match", Clear search về lại.
27. Chọn tag → chỉ bài của tag; All → về tất cả.
28. Load more → nối thêm, không trùng. Seed local chỉ 9 bài (< `pageSize` 20) nên nút không hiện — xem N4 ở mục 10.
29. Mở bài → nội dung, ảnh, tag; "Read this on…" mở web; "Trips in this story" không hiện vì `post_tours` rỗng (D2).

Giao diện:

30. Dark mode → lướt lại các màn: chữ đọc được, không ô trắng lạc.
31. Tắt mạng mở từng tab → trạng thái lỗi và Try again; bật mạng bấm lại → tải được.

## 9. Đã sửa N1–N6 (07/10)

| Mục | Cách sửa | Test thêm | Commit |
| --- | --- | --- | --- |
| N1, N6 | Hook chung `useWishlistSetMutation` (`src/lib/wishlist-mutation.ts`): rollback đặt ở `onError` của OPTIONS nên chạy cho TỪNG lượt, kể cả sau unmount; `onSettled` chỉ invalidate `wishlist.list`/`wishlist.check` khi đó là lượt cuối (`isMutating > 1` thì bỏ). Explore và tour detail không chép `wishlist.check` vào state khi còn lượt đang bay (`isWishlistMutating`). Saved, Explore, tour detail đều dùng hook này | `wishlist-mutation.spec.tsx` (3 test) | `5a883871` |
| N2 | `BottomSheet` giữ `onClose` trong `onCloseRef`; PanResponder gọi `onCloseRef.current()` nên kéo tay nắm đi qua guard mới nhất (`closeSheet` chặn khi `pending` ở Personal details) | `bottom-sheet.spec.tsx` (1 test) | `bbfe667e` |
| N3 | `EditNameSheet`, `EditAvatarSheet` truyền `onClose` rỗng khi `pending` — backdrop, back Android, kéo tay nắm đều không đóng | 2 test mỗi tấm | `10730a35` |
| N4, N5 | `app/posts/index.tsx` chuyển sang `useInfiniteQuery`: bộ lọc nằm trong query key, trang luôn thuộc đúng bộ lọc; Load more khoá bằng `loadingMore` (`isFetchingNextPage`); `status: 'loading'` vẽ khung chờ `PostsLoading` thay bài cũ. Input, mapping, `posts.tags` giữ như bản cũ (đã đối chiếu `a5a827ff^`) | `posts-list-screen.spec.tsx` (2 test) | `a5a827ff` |

Kiểm 07/10 sau N1–N6: `typecheck` + `test` xanh — mobile **487/487**,
mobile-ui **134/134**; `biome check .` sạch. Chưa chạy `gate:int`, chưa thử máy thật.
Bốn commit này đã push 07/10.

## 10. Chạy local để test

Agent không tự bật dev server (`docs/conventions/mobile-dev-loop.md` §0) — các
lệnh dưới đây người chạy, mỗi tiến trình một cửa sổ Git Bash.

1. **Postgres.** Máy này có service Windows `postgresql-x64-17` đang nghe 5432,
   `apps/api/.env.local` trỏ vào đó. Không có thì `docker compose up -d postgres`
   (đổi `DATABASE_URL` về chuỗi trong `.env.example`). Không bật cả hai — trùng cổng.
2. **Cài và dựng thư viện** (ở root):

   ```bash
   pnpm install
   pnpm turbo run build --filter=@tourism/api --filter=@tourism/mobile^...
   ```

   Phải là `@tourism/api` (không `^...`): task `build` của api kéo theo
   `db:generate` (Prisma client vào `src/generated/`, gitignore), còn `pnpm dev`
   của api chỉ chạy swc nên máy sạch thiếu bước này là API chết lúc import.

3. **DB** (ở `apps/api`): `pnpm db:deploy` rồi `pnpm db:seed`. Seed tạo 9 bài
   blog và khách `…@example.com`, mật khẩu `Nexora!Demo2026` (khi
   `SEED_CUSTOMER_PASSWORD` trống). Lấy email ở bảng `users` bằng pgAdmin (đi
   kèm PostgreSQL 17 trên máy — `psql` không có trên PATH).
4. **`apps/api/.env.local` phải có** dòng
   `TRUSTED_ORIGINS=http://localhost:3000,http://localhost:3002,nexora://,exp://`.
   Expo Go gửi origin `exp://<IP-LAN>:8081`; thiếu `exp://` thì đăng ký/đăng
   nhập từ điện thoại bị 403 và chỉ hiện "Something went wrong" (dính 07/10 —
   `.env.local` chỉ có `DATABASE_URL`, mặc định của `env.ts` không có mobile).
5. **API** (ở `apps/api`): `pnpm dev` → cổng 3001, nghe `0.0.0.0` nên điện thoại
   gọi được. Kịch bản N1–N6 không cần email. Cần OTP/link reset thì chạy thêm
   `pnpm dev:worker` (cửa sổ khác) — `.env.local` không bật `WORKER_INLINE` nên
   API một mình không drain outbox; thiếu `RESEND_API_KEY` thì worker in mail ra log.
6. **Mobile** (ở `apps/mobile`): `pnpm dev` (thêm `-- -c` để xoá cache Metro),
   quét QR bằng Expo Go. Lần đầu cho Node qua tường lửa Windows (mạng Private).
   Khác mạng thì `pnpm dev:tunnel`.
7. Web (`apps/web`, cổng 3000) chỉ cần cho bước "Read this on…" và các link pháp lý.

Không test được ở local: đổi/xoá avatar (thiếu `CLOUDINARY_API_KEY/SECRET`),
Google (thiếu `GOOGLE_CLIENT_ID`), email thật (thiếu Resend).

Nghiệm thu bằng máy trước khi thử tay:

```bash
pnpm turbo run typecheck test --filter=@tourism/mobile --filter=@tourism/mobile-ui
pnpm turbo run bundle --filter=@tourism/mobile
```

### Kịch bản thử N1–N6

Mẹo tạo request TREO (cần cho N1–N3): **tạm dừng** tiến trình API chứ đừng
tắt. Tắt API (Ctrl+C) thì máy trả "connection refused" trong vài ms — lỗi về
ngay, không có khoảng chờ nào để bấm chồng. Tạm dừng thì request treo tới
timeout 10 giây của client oRPC (`src/lib/api/client.ts`) rồi mới lỗi:

1. Lấy PID của API (PowerShell): `(Get-NetTCPConnection -LocalPort 3001 -State Listen).OwningProcess`.
2. `resmon` → tab CPU → tick đúng PID đó → chuột phải → **Suspend Process**.
3. Thử xong: chuột phải → **Resume Process**.

Chế độ máy bay không dùng được — Expo Go mất luôn kết nối Metro.

- **N1 — Saved.** Lưu 3 tour. Suspend API. Ở Saved gỡ liên tiếp 2 tour → cả hai
  mất ngay; ~10 giây sau cả HAI hiện lại, báo lỗi ngắn (~3 giây). Trước sửa: chỉ
  tour gỡ sau hiện lại. Resume API.
- **N1 — Explore.** Suspend API, bấm tim 2 tour liên tiếp → ~10 giây sau cả hai
  trở về rỗng.
- **N1 — rời màn.** Suspend API, ở tour detail bấm tim rồi back ngay, chờ ~10
  giây, Resume, mở lại tour → tim đúng trạng thái server, không kẹt "đã lưu".
- **N6.** API chạy bình thường. Ở Explore bấm tim một tour 4–5 lần thật nhanh →
  tim không nháy ngược giữa chừng, dừng ở trạng thái lượt bấm cuối; mở Saved
  khớp. Lặp ở tour detail.
- **N2.** Đăng nhập user seed PHỤ. Personal details → Delete account → nhập mật
  khẩu đúng → Suspend API → bấm "Delete account" (nút đổi "Deleting…") → kéo tay
  nắm xuống, chạm nền tối → tấm KHÔNG đóng. Sau ~10 giây (timeout của
  `account-api.ts`) tấm hiện lỗi. Resume API trước khi bấm lại — bấm lại là xoá thật.
- **N3.** Account → bút chì → đổi tên → Suspend API → bấm Save (nút "Saving…") →
  chạm nền tối / nút back Android / kéo tay nắm → tấm KHÔNG đóng. Đường này
  (`authClient.updateUser`) không có timeout nên treo tới khi Resume; Resume xong
  tên được lưu và tấm tự đóng. Tấm Avatar cùng luật nhưng cần Cloudinary để có
  trạng thái pending — ở local chỉ có unit test che.
- **N4.** Seed chỉ có 9 bài, `pageSize` mặc định 20 → **Load more không hiện ở
  local**. Muốn thử tay phải có trên 20 bài PUBLISHED (tạo qua admin, hoặc nhân
  bản bài trong DB local). Khi có: bấm đúp Load more → nút mờ trong lúc tải, danh
  sách nối đúng trang 2, không nhảy trang 3.
- **N5.** Travel stories → chọn tag "Food" → thấy khung chờ xám rồi chỉ bài Food,
  không còn thấy bài của "All" trong lúc chờ. Gõ "hue" → khung chờ → bài Hue.
  API local trả nhanh nên khung chờ có thể chỉ chớp; chọn lại tag đã xem thì hiện
  ngay từ cache (đúng thiết kế, không phải lỗi).
