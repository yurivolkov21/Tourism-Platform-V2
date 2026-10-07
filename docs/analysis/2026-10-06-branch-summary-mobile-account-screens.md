# Tóm tắt nhánh `feat/mobile-account-screens` (P5b-4) — cập nhật 2026-10-06

Bản này thay [bản 26/09](2026-09-26-branch-summary-mobile-account-screens.md)
làm nguồn đúng cho tình trạng hiện tại. Bản 26/09 giữ nguyên làm lịch sử; chỗ
nào nó nói khác bản này thì tin bản này (ví dụ A7 nay đã nối API thật).

Nguồn: `git log main..HEAD` (bản 06/10 tính tới `9a5f2a85`; 07/10 thêm L2–L5, F9, F12, Q1–Q3, N1–N6), spec
[`2026-09-25-mobile-account-screens.md`](../plans/2026-09-25-mobile-account-screens.md),
review 6 ảnh (24 phát hiện: B1–B3, F1–F12, L1–L5, Q1–Q4), và working tree ngày 06/10.

## Kết luận nhanh

- **Chức năng: đủ theo spec.** 14 khung S1–S3, A1–A7, G1–G4 đều đã dựng và nối API.
  Thiếu duy nhất là DỮ LIỆU cho G4 (D2), không phải code.
- **Chưa merge được.** Còn chặn bởi B1–B3 (phía API/ADR), chưa chạy `gate:int`,
  chưa thử máy thật cho đợt sửa 06/10, và nhánh chậm `main` 212 commit.

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

## 2. Đã sửa sau review (đợt 01–06/10)

| Mục | Nội dung | Commit |
| --- | --- | --- |
| F6 | Xoá tài khoản nối API, map đủ mã lỗi server | `21c0bfa5` |
| F1 | Rời nhóm auth bằng back/vuốt thì dọn hộp nhớ return-to | `5390a8bc` |
| F2 | Trình xem ảnh: `GestureHandlerRootView` đặt trong `Modal` (Android) | `4a97c379` |
| F3 | Tấm trượt né bàn phím iOS | `a709fc1c` |
| F4 | Saved hiện lại tour đã bỏ lưu rồi lưu lại | `cc462690` |
| F7, F8 | Chọn ảnh thư viện không xin quyền; đăng xuất xoá cache | `f592cbea` |
| D3 (1, 2) | Explore nhớ đường về sau đăng nhập; nút X về đúng chỗ mở | `9a5f2a85` |
| L2, L5 | `AppImage` kẹp mật độ 2x, hero dùng bề rộng màn, viewer bỏ `* 2`; Saved tải hết các trang (`useInfiniteQuery`), lọc trùng | `e3a73ab8` |
| L3 | Gỡ wrapper chết `components/app-image.tsx`; ADR-0047 AMEND 2 | `c8fa1c6e` |
| F9, F12 | `readHasSeen()` bắt lỗi SecureStore (lỗi thì vào app, không kẹt splash); huỷ cửa sổ Google thì hỏi lại `getSession`, không có user thì `cancelled` | `ba2a1881` |
| L4 | `Chip` nhận `removeLabel`; Explore truyền copy từ `@tourism/i18n` | `b6973451` |
| Q2, Q3 | Thêm 7 doc mới của nhánh vào `docs/README.md`; gỡ `docs/PROGRESS.md` | `56856bdc` |
| Q1 | Gỡ `Co-Authored-By` khỏi message 55 commit (`filter-branch`, tree không đổi) | 07/10, bản cũ ở `backup/account-truoc-q1` |

Hash trong bảng là hash SAU Q1 (07/10). Hash cũ trước Q1 (`868fb82e`,
`3e9ffb3c`, `cc6a6612`…) chỉ còn trên nhánh `backup/account-truoc-q1`.

Kiểm 07/10 (sau F9/F12/L4): `typecheck` và `test` xanh — mobile **478/478**,
mobile-ui **133/133**; Biome sạch; tokens-only sạch.

## 3. Đang treo — việc của nhánh này

1. **Push** — sau Q1 nhánh local lệch remote (ahead 53, behind 50) dù tree ở
   `c8fa1c6e` trùng khít remote `4c52265e`; push phải dùng
   `--force-with-lease`, chỉ khi user đồng ý.
2. **D2** — gán tour liên quan cho bài viết (admin hoặc `seed.ts`) để G4 có dữ liệu.
   DB local 07/10: bảng `post_tours` trống.
3. **D3 mục 3** — đăng nhập xong đang `router.replace` về tour đã mount dưới
   modal, có thể đẩy bản sao vào stack. Chỉ đổi sau khi thử máy thật.
4. **Rebase lên `main`** (chậm 212 commit; `main` có thêm migration
   `20261005003043_post_tag_links_order` nên rebase xong chạy `pnpm db:deploy`
   cho DB local). Q1 đã xong 07/10; ba commit còn mang `Co-Authored-By`
   (`9a1db2de`, `c4a2f926`, `5232e4b9`) nằm trên `feat/mobile-browse-screens`,
   phải sửa ở nhánh đó.
5. **Kiểm trước khi xin review:** `pnpm gate:int` (Postgres local hoặc Docker), `bundle`,
   `expo-doctor`, thử máy thật Android và iOS:
   - F2 cử chỉ zoom (Android), F3 bàn phím (iPhone), F6 với API thật.
   - L2 độ nét ảnh hero/viewer trên máy 3x.
   - D3: tự lưu tim từ Explore, nút X, đường về sau đăng nhập.
   - Nền sáng/tối các màn mới.
6. **Doc tổng hợp cuối và `docs/open-items.md`** — user chốt để sau; `open-items`
   mục 1–2 (D3) vẫn ghi đang mở dù đã sửa.

## 4. Chặn merge nhưng không phải lỗi riêng của nhánh

Ba mục này nằm trong 35 commit kế thừa từ `feat/mobile-browse-screens`. Cần
chốt với nhóm sửa ở nhánh nào để khỏi trùng công.

- **B1** — [`env.ts:251`](../../apps/api/src/config/env.ts) bắt mọi
  `TRUSTED_ORIGINS` là `https`, nên thêm `nexora://` thì API không khởi động.
  Luật cũ của API, xung đột với nhu cầu mobile. Cần AMEND ADR-0017 §9 trước.
- **B2** — [`auth.config.ts:195`](../../apps/api/src/auth/auth.config.ts) plugin
  `expo()` bật cả production → lỗ open redirect. Do commit mobile `242838b1` thêm vào.
- **B3** — hai ADR cùng số 0047 (`mobile-data-layer` và `tour-editor-sections`).
  Nhánh merge sau đổi số; đề xuất mobile đổi sang 0053.

## 5. Lỗi có sẵn, không do nhánh này gây ra

Kế thừa từ browse-screens, vẫn còn trong code. User chưa quyết sửa ở đâu.

| Mục | Lỗi |
| --- | --- |
| F5 | "See all tours" ở Home mở `/explore` không reset bộ lọc điểm đến |
| F10 | Bấm lại chip sort đang chọn → danh sách review rỗng, không tải lại |
| F11 | `expandedDay` lấy giá trị lúc mount khi tour chưa về → ngày 1 không mở sẵn |
| L1 | `getCookie()` đọc SecureStore đồng bộ mỗi lần render (`withMobileAuth`) |

F9, F12 và L4 (cùng nhóm kế thừa) đã sửa ngày 07/10, xem mục 2.

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
  `transformUrl={cloudinaryUrl}` (ADR-0047 AMEND 2).
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
Bốn commit chỉ ở local, chưa push.

## 10. Chạy local để test

Agent không tự bật dev server (`docs/conventions/mobile-dev-loop.md` §0) — các
lệnh dưới đây người chạy, mỗi tiến trình một cửa sổ Git Bash.

1. **Postgres.** Máy này có service Windows `postgresql-x64-17` đang nghe 5432,
   `apps/api/.env.local` trỏ vào đó. Không có thì `docker compose up -d postgres`
   (đổi `DATABASE_URL` về chuỗi trong `.env.example`). Không bật cả hai — trùng cổng.
2. **Cài và dựng thư viện** (ở root):

   ```bash
   pnpm install
   pnpm turbo run build --filter=@tourism/api^... --filter=@tourism/mobile^...
   ```

3. **DB** (ở `apps/api`): `pnpm db:deploy` rồi `pnpm db:seed`. Seed tạo 9 bài
   blog và khách `…@example.com`, mật khẩu `Nexora!Demo2026` (khi
   `SEED_CUSTOMER_PASSWORD` trống). Lấy email ở bảng `users` bằng pgAdmin (đi
   kèm PostgreSQL 17 trên máy — `psql` không có trên PATH).
4. **API** (ở `apps/api`): `pnpm dev` → cổng 3001, nghe `0.0.0.0` nên điện thoại
   gọi được. Không có `RESEND_API_KEY` thì OTP/link reset in ở log API.
5. **Mobile** (ở `apps/mobile`): `pnpm dev` (thêm `-- -c` để xoá cache Metro),
   quét QR bằng Expo Go. Lần đầu cho Node qua tường lửa Windows (mạng Private).
   Khác mạng thì `pnpm dev:tunnel`.
6. Web (`apps/web`, cổng 3000) chỉ cần cho bước "Read this on…" và các link pháp lý.

Không test được ở local: đổi/xoá avatar (thiếu `CLOUDINARY_API_KEY/SECRET`),
Google (thiếu `GOOGLE_CLIENT_ID`), email thật (thiếu Resend).

Nghiệm thu bằng máy trước khi thử tay:

```bash
pnpm turbo run typecheck test --filter=@tourism/mobile --filter=@tourism/mobile-ui
pnpm turbo run bundle --filter=@tourism/mobile
```

### Kịch bản thử N1–N6

Mẹo tạo lỗi mạng giữa chừng: tắt API (Ctrl+C cửa sổ `pnpm dev`) — nhanh và chắc
hơn chế độ máy bay (máy bay làm Expo Go mất luôn kết nối Metro).

- **N1 — Saved.** Lưu 3 tour. Tắt API. Ở Saved bấm gỡ liên tiếp thật nhanh 2 tour
  → cả HAI hiện lại, báo lỗi ngắn (~3 giây). Trước sửa: chỉ tour bấm sau hiện lại.
- **N1 — Explore.** Tắt API, bấm tim 2 tour liên tiếp → cả hai trở về rỗng.
- **N1 — rời màn.** Tắt API, ở tour detail bấm tim rồi back ngay → mở lại tour
  (bật API) → tim đúng trạng thái server, không kẹt "đã lưu".
- **N6.** API bật. Ở Explore bấm tim một tour 4–5 lần thật nhanh → tim không nháy
  ngược giữa chừng, dừng ở trạng thái lượt bấm cuối; mở Saved khớp. Lặp ở tour detail.
- **N2.** Đăng nhập user seed phụ. Personal details → Delete account → nhập mật
  khẩu đúng → bấm xoá rồi kéo tay nắm xuống ngay khi nút hiện "Deleting…" → tấm
  KHÔNG đóng. Lỗi khó canh vì xoá nhanh; dễ thấy hơn khi tắt API ngay trước bấm
  (tấm giữ nguyên và hiện lỗi). Test này xoá thật tài khoản nếu API bật.
- **N3.** Account → bút chì → đổi tên → bấm Save rồi chạm nền tối/nút back
  Android ngay → tấm KHÔNG đóng khi đang "Saving…". Tắt API trước khi Save để có
  thời gian: tấm ở lại và hiện "Couldn't update your name…". Tấm Avatar cùng luật
  nhưng cần Cloudinary để có trạng thái pending — ở local chỉ kiểm được bằng unit test.
- **N4.** Seed chỉ có 9 bài, `pageSize` mặc định 20 → **Load more không hiện ở
  local**. Muốn thử tay phải có trên 20 bài PUBLISHED (tạo qua admin, hoặc nhân
  bản bài trong DB local). Khi có: bấm đúp Load more → nút mờ trong lúc tải, danh
  sách nối đúng trang 2, không nhảy trang 3.
- **N5.** Travel stories → chọn tag "Food" → thấy khung chờ xám rồi chỉ bài Food,
  không còn thấy bài của "All" trong lúc chờ. Gõ "hue" → khung chờ → bài Hue.
  API local trả nhanh nên khung chờ có thể chỉ chớp; chọn lại tag đã xem thì hiện
  ngay từ cache (đúng thiết kế, không phải lỗi).
