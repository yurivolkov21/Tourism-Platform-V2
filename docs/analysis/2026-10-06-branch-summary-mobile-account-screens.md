# Tóm tắt nhánh `feat/mobile-account-screens` (P5b-4) — cập nhật 2026-10-06

Bản này thay [bản 26/09](2026-09-26-branch-summary-mobile-account-screens.md)
làm nguồn đúng cho tình trạng hiện tại. Bản 26/09 giữ nguyên làm lịch sử; chỗ
nào nó nói khác bản này thì tin bản này (ví dụ A7 nay đã nối API thật).

Nguồn: `git log main..HEAD` (63 commit tính tới `3e9ffb3c`), spec
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
| F6 | Xoá tài khoản nối API, map đủ mã lỗi server | `868fb82e` |
| F1 | Rời nhóm auth bằng back/vuốt thì dọn hộp nhớ return-to | `b30f9088` |
| F2 | Trình xem ảnh: `GestureHandlerRootView` đặt trong `Modal` (Android) | `b9223ef2` |
| F3 | Tấm trượt né bàn phím iOS | `79324226` |
| F4 | Saved hiện lại tour đã bỏ lưu rồi lưu lại | `bb5e6c63` |
| F7, F8 | Chọn ảnh thư viện không xin quyền; đăng xuất xoá cache | `2b148235` |
| D3 (1, 2) | Explore nhớ đường về sau đăng nhập; nút X về đúng chỗ mở | `3e9ffb3c` |
| L2 | `AppImage` kẹp mật độ 2x; hero dùng bề rộng màn; viewer bỏ `* 2` | chưa commit |
| L3 | Gỡ wrapper chết `components/app-image.tsx`; ADR-0047 AMEND 2 | chưa commit |
| L5 | Saved tải hết các trang (`useInfiniteQuery`), lọc trùng | `e75c0b2c` |
| F9 | `readHasSeen()` bắt lỗi SecureStore — lỗi thì vào app, không kẹt splash | `cc6a6612` |
| F12 | Huỷ cửa sổ Google: hỏi lại `getSession`, không có user thì `cancelled` | `cc6a6612` |
| L4 | `Chip` nhận `removeLabel`; Explore truyền copy từ `@tourism/i18n` | `70169bce` |
| Q2 | Thêm 7 doc mới của nhánh vào `docs/README.md` | 07/10 |
| Q3 | Gỡ `docs/PROGRESS.md` | 07/10 |

Hash F9/F12/L4/Q1 trở đi đổi sau đợt rebase lên `main` — tra lại bằng `git log`.

Kiểm 07/10 (sau F9/F12/L4): `typecheck` và `test` xanh — mobile **478/478**,
mobile-ui **133/133**; Biome sạch; tokens-only sạch.

## 3. Đang treo — việc của nhánh này

1. **Push** các commit từ `cc6a6612` trở đi — user dặn 07/10 chỉ test local,
   push khi user nói.
2. **D2** — gán tour liên quan cho bài viết (admin hoặc `seed.ts`) để G4 có dữ liệu.
   DB local 07/10: bảng `post_tours` trống.
3. **D3 mục 3** — đăng nhập xong đang `router.replace` về tour đã mount dưới
   modal, có thể đẩy bản sao vào stack. Chỉ đổi sau khi thử máy thật.
4. **Q1 và rebase lên `main`** — gỡ `Co-Authored-By` khỏi 7 commit riêng của
   nhánh (trái luật 12). Cả hai viết lại lịch sử nên cần force push, phải hỏi trước.
   Ba commit còn lại mang dòng đó (`9a1db2de`, `c4a2f926`, `5232e4b9`) đã nằm
   trên `feat/mobile-browse-screens`, phải sửa ở nhánh đó.
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
