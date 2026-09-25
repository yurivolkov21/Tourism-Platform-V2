# Cụm tài khoản mobile (P5b-4) — Saved · Account/hồ sơ/bảo mật · Travel stories — Design Spec

> Đây là SPEC (kiến trúc + hợp đồng giữa các phần), không phải plan chạy tay-bước.
> V2 (Saved), V3/V5/V6 (Account hub/mật khẩu/đăng xuất) port pattern đã có sẵn trong
> repo (cùng khuôn browse-screens/auth) nên KHÔNG cần plan riêng — implement thẳng theo
> spec này + handoff. V1 (shared auth-gate) và cơ chế return-to là kiến trúc MỚI, mô tả
> chi tiết ở đây vì mọi cluster khác phụ thuộc vào nó. A4 (avatar) và A7 (xoá tài khoản)
> cần quyết định riêng trước khi code — xem mục tương ứng.

**Goal:** Dựng 14 khung P5b-4 (`docs/design/mockups/mobile-account-screens.src.html`,
user duyệt 21/09) trên nhánh `feat/mobile-account-screens`: tab Saved (S1–S3), tab
Account + hồ sơ + bảo mật (A1–A7), cụm Travel stories/blog (G1–G4). Đóng luôn nợ cũ
"chặn tab khi chưa đăng nhập" + "quay lại đúng chỗ sau đăng nhập" (từng treo ở D6 của
P5b-2).

**Spec nguồn:** [mobile-account-handoff.md](../handoff/mobile-account-handoff.md) ·
[mockup 14 khung](../design/mockups/mobile-account-screens.src.html) · ADR tham chiếu:
[0017 (session/mật khẩu)](../adr/0017-web-session-better-auth.md) §7a ·
[0021 (media write)](../adr/0021-media-write-surface.md) · ADR MỚI cần viết cho A4 (xem
mục A4 bên dưới).

**Không thuộc phạm vi:** Tab Trips (stub P5a, chờ cụm P5b-3). "My reviews" (khung R4,
thuộc P5b-5) — dòng menu trỏ tới đó chỉ cần tồn tại, màn đích chưa dựng ở đợt này.

---

## 1. Kiến trúc: khối chặn tab dùng chung + quay lại sau đăng nhập

### 1a. `AuthGateScreen` — component full-screen MỚI

Khác `AuthGateSheet` hiện có (`apps/mobile/src/features/auth/auth-gate-sheet.tsx` —
BottomSheet nổi lên trong lúc khách đang xem một màn khác, dùng cho D6/tim). Đây là
**thay TOÀN BỘ nội dung tab** khi tab đó cần phiên mà chưa có — không phải overlay.

```
apps/mobile/src/features/auth/auth-gate-screen.tsx
```

Props (thuần trình bày, không tự gọi API/điều hướng):

```typescript
export interface AuthGateScreenProps {
  icon: FeatherIconName;       // 'heart' (Saved) | 'user' (Account)
  title: string;
  body: string;
  signInLabel: string;
  createAccountLabel: string;
  onSignIn: () => void;
  onCreateAccount: () => void;
  /** A2 riêng: ba dòng pháp lý vẫn mở được dù chưa đăng nhập. undefined = không có khối này (S3). */
  legalLinks?: readonly { label: string; onPress: () => void; icon: FeatherIconName }[];
}
```

Dựng từ `Screen` + `EmptyState`-khuôn (ô vuông icon + tiêu đề + câu + hai nút) đã lặp lại
ở S2/S3/A2 — **tái dùng `EmptyState` hiện có** (`libs/mobile/ui`), không viết lại bố cục
ô-vuông-icon từ đầu; chỉ thêm hai nút bên dưới qua `children`/slot nếu `EmptyState` chưa
hỗ trợ, hoặc dựng `AuthGateScreen` composite từ `EmptyState` + `Button` × 2 (+ khối
`legalLinks` khi có).

### 1b. Cơ chế "quay lại đúng chỗ sau đăng nhập"

**Vấn đề:** chuỗi đăng nhập/đăng ký hiện có 3–4 chặng, MỖI chặng đang hardcode
`router.replace('/')`:

- `apps/mobile/src/app/(auth)/login.tsx` — 2 chỗ (email, Google)
- `apps/mobile/src/app/(auth)/register.tsx` — 1 chỗ (hiếm khi tới thẳng, thường qua verify)
- `apps/mobile/src/app/(auth)/verify-email.tsx` → `router.replace('/success', {kind:'verified'})`
- `apps/mobile/src/app/(auth)/success.tsx` → `onAction` (kind `verified` → `/login`, kind khác → cần soát thêm khi code)

Một param URL xuyên 4 chặng dễ rơi rớt (mỗi `router.push`/`replace` phải nhớ forward nó).

**Quyết định:** module-scope singleton, KHÔNG thêm thư viện state (không có
zustand/jotai trong repo, không cần thêm cho một giá trị ephemeral, đọc một lần).

```
apps/mobile/src/features/auth/return-to.ts
```

**Điểm dễ sai:** `path` phải đọc ở CHẶNG AUTH (điều hướng xong là hết việc), còn `replay`
phải đọc ở MÀN ĐÍCH sau khi đã điều hướng tới đó (màn đích mount lại, effect mount-once
mới đọc được). Hai thời điểm đọc khác nhau ⇒ **hai hàm consume riêng**, cùng một object
nguồn — gọi `consumeReturnPath()` ở chặng auth mà lỡ xoá luôn `replay` thì màn đích không
bao giờ thấy nó nữa.

```typescript
interface PendingReturn {
  /** Đường expo-router điều hướng TỚI sau khi có phiên, vd '/(tabs)/saved'. */
  path: string;
  /** Cờ để màn đích tự làm nốt việc dở (D6: tự lưu wishlist). Tối giản CỐ Ý:
      chỉ một chuỗi định danh việc + optional payload, KHÔNG phải closure — closure
      sống sót qua unmount/remount của cả chuỗi 4 màn auth là giả định không chắc,
      chuỗi + payload thì luôn serializable-an-toàn dù không thực sự serialize. */
  replay?: { kind: 'wishlist'; tourId: string };
}

let pending: PendingReturn | null = null;

export function setPendingReturn(next: PendingReturn): void {
  pending = next;
}

/** Gọi Ở CHẶNG AUTH khi thành công — chỉ lấy path, KHÔNG xoá `replay`. */
export function consumeReturnPath(): string | null {
  return pending?.path ?? null;
}

/** Gọi Ở MÀN ĐÍCH (effect mount-once, sau khi `signedIn` thành true) — lấy VÀ xoá
    hẳn `replay`. Đây mới là điểm THẬT SỰ dọn `pending` về null. */
export function consumePendingReplay(): PendingReturn['replay'] {
  const replay = pending?.replay;
  pending = null;
  return replay;
}
```

Mọi điểm "thành công" hiện tại đổi từ:

```typescript
if (outcome.kind === 'success') router.replace('/');
```

thành:

```typescript
if (outcome.kind === 'success') {
  router.replace(consumeReturnPath() ?? '/');
}
```

**Nơi gọi `setPendingReturn`:**

- `AuthGateScreen`'s `onSignIn`/`onCreateAccount` (Saved/Account route) — path là chính
  tab đang đứng (`/(tabs)/saved` hoặc `/(tabs)/account`), không `replay`.
- `AuthGateSheet`'s `onSignIn`/`onCreateAccount` khi mở từ D6 (tim) — path là URL tour
  hiện tại (`/tours/${slug}`), `replay: { kind: 'wishlist', tourId }`.

**Nơi đọc `replay`:** route `[slug].tsx` (tour detail) đã có effect dọn `wished` về
`false` khi `signedIn` tắt — thêm effect anh em, mount-once, đọc
`consumePendingReplay()` MỘT LẦN khi `signedIn` vừa bật; khớp `replay.tourId` với tour
hiện tại thì tự gọi `wishlistMutation.mutate` y hệt `handleFavoritePress`. Nếu `pending`
đã bị dọn (ví dụ khách thoát app giữa chừng, `pending` mất theo vòng đời process — module
scope không sống qua app kill) thì `consumePendingReplay()` trả `undefined`, effect no-op
— đúng ý: mất phiên giữa chừng thì thôi, không cố khôi phục.

### 1c. Đóng nợ D6 cũ

`tour-detail-screen.tsx`'s `onSignIn`/`onCreateAccount` (hiện đóng sheet rồi
`router.navigate('/login')` trần) đổi thành gọi `setPendingReturn` trước khi điều hướng
— param `slug`/`tourId` route `[slug].tsx` đã có sẵn trong scope.

---

## 2. Saved (S1–S3)

Port 1:1 pattern Explore/tour-list-card đã có (nhánh này rẽ từ `feat/mobile-browse-screens`
nên `TourListCard`, `cloudinaryUrl`, `wishlist.ts` đã có sẵn).

- Route: `apps/mobile/src/app/(tabs)/saved.tsx` — hiện ĐANG là stub P5a (khác `account.tsx`
  đã có link dev-gallery), cần kiểm nội dung hiện tại trước khi viết đè.
- `signedIn === false` → `<AuthGateScreen icon="heart" .../>` (không `legalLinks`).
- `signedIn === true` → `useQuery(orpc.wishlist.list...)`, render `TourListCard` (variant
  đã có `favorited`/tim đặc), cờ `unavailable` → mờ + nhãn "No longer available" +
  không bấm được (khoá `onPress`, không phải ẩn thẻ — S1 caption).
- Bỏ lưu lạc quan: tim tắt ngay, lỗi thì bật lại — CÙNG pattern `handleFavoritePress` ở
  `[slug].tsx`, cân nhắc rút thành hook dùng chung `useWishlistToggle` nếu trùng ≥ 3 nơi
  (Explore/tour-detail/Saved) — rút hay không quyết lúc code, không quyết trước ở đây.
- Rỗng (S2): `EmptyState` (icon `heart`, `saved.empty`, `saved.browse` → điều hướng Explore).

## 3. Account hub + hồ sơ + bảo mật (A1, A3, A5, A6)

- Viết lại `apps/mobile/src/app/(tabs)/account.tsx` — GIỮ hai link dev-gallery hiện có
  (`isDevBuild()` gate), thay phần thân.
- `signedIn === false` → `<AuthGateScreen icon="user" legalLinks={...} .../>` (A2 — BA
  dòng pháp lý vẫn mở được, KHÔNG cần đăng nhập).
- `signedIn === true` (A1): avatar (chữ cái đầu nếu chưa có ảnh) + tên + email + nút edit
  → mở sheet A3; danh sách menu (Personal details, Saved tours, My reviews, Travel
  stories, Password, rồi 5 dòng external-link, rồi Sign out tách khoảng trắng). Cuộn
  được — ScrollView, không FlatList (11 dòng tĩnh, không cần ảo hoá).
- A3 (sửa tên): `BottomSheet` + `TextField`, gọi `authClient.updateUser({ name })`, kiểm
  bằng `validateProfileName` (`libs/shared/core/src/lib/auth-form.ts:146` — đã có sẵn,
  xác nhận tồn tại).
- A5 (đăng xuất): `BottomSheet` xác nhận, gọi `authClient.signOut()` + `router.replace('/')`
  về Home tư cách khách (KHÔNG dùng cơ chế return-to ở đây — đăng xuất luôn về Home).
- A6 (đổi mật khẩu): màn riêng (không phải sheet — mockup dùng `compact-head` + back, đủ
  dài cho 3 ô). Gọi `authClient.changePassword({ currentPassword, newPassword,
  revokeOtherSessions: true })`. Kiểm bằng `validateChangePassword`
  (`libs/shared/core/src/lib/auth-form.ts:124` — đã có sẵn, xác nhận tồn tại). Lỗi mật
  khẩu hiện tại sai → gắn ô đầu qua `placeAuthError`; còn lại rơi form-message.
- 5 external link: `Linking.openURL(`${env().webUrl}${path}`)` — pattern Y HỆT
  `openLegal` đã có ở `register-screen.tsx`, tái dùng luôn (rút thành helper dùng chung
  nếu ≥ 2 nơi gọi — Account có 5 dòng, Register có 2, đáng rút).

## 4. Đổi ảnh đại diện (A4) — CẦN QUYẾT ĐỊNH TRƯỚC (ADR)

Dependency mới `expo-image-picker` — theo CLAUDE.md luật 5, ADR đi TRƯỚC code. Viết
AMEND mới vào `docs/adr/0040-mobile-app-expo.md` (cùng khuôn AMEND 3 gesture-handler):
tên gói, lý do chọn (chuẩn Expo, không có lựa chọn khác hợp lý), 2 quyền cần khai trong
`app.json` (camera, photo library) + copy xin quyền (iOS `NSCameraUsageDescription`/
`NSPhotoLibraryUsageDescription`, Android runtime permission tự động qua plugin).

Luồng (ADR-0021 đã có, không đổi): chọn ảnh (camera/thư viện qua `expo-image-picker`) →
xin chữ ký `account.setAvatar` (oRPC) → PUT thẳng lên Cloudinary bằng chữ ký đó → gọi
`authClient.updateUser({ image })`. Lỗi (vượt trần dung lượng/sai định dạng) báo NGAY
trong sheet, không đóng sheet rồi mới báo (mockup A4 ghi rõ).

**Việc viết ADR này là bước ĐẦU của task A4 khi code, không phải việc của giai đoạn spec
— nêu ở đây để không quên "ADR trước, dependency sau".**

## 5. Xoá tài khoản (A7) — CỜ ĐỎ: có thể cần đổi API, chưa xác nhận

Đã tra `apps/api/src/auth/auth.config.ts` và toàn bộ `apps/web/src`: **không tìm thấy
`deleteUser` ở đâu cả** — tính năng xoá tài khoản CHƯA TỒN TẠI, kể cả bên web. Điều đó có
nghĩa A7 không đơn thuần là "gọi `authClient.deleteUser`" phía client như A3/A5/A6 —
better-auth cần bật plugin `user.deleteUser` phía API TRƯỚC, và phần "booking đã thanh
toán vẫn giữ vì kế toán" (mockup ghi rõ) đòi hỏi logic cascade/anonymize phía server
(review/wishlist xoá, booking giữ nhưng gỡ liên kết user hoặc theo cách nào đó — CHƯA
CÓ quyết định thiết kế cho phần server này).

**Khuyến nghị:** tách A7 làm việc RIÊNG sau khi 13 khung còn lại xong — cần một vòng
brainstorm/ADR nhỏ cho phần API (cascade rule) trước khi động tới client, và đó là việc
đụng cả `apps/api` (ngoài phạm vi "chỉ mobile" của cụm này). Không quyết ở đây — hỏi user
khi tới lượt A7.

## 6. Travel stories / blog (G1–G4)

Cụm hoàn toàn mới, KHÔNG cần đăng nhập — `posts.*` là route công khai.

- `apps/mobile/src/features/posts/` — `posts-list-screen.tsx`, `post-detail-screen.tsx`,
  `markdown.ts` (pure — parse 3 kiểu: `## heading`, đoạn văn, `- bullet`; cú pháp lạ rơi
  về đoạn-văn-thường, KHÔNG in ký hiệu thô — test riêng file này kỹ vì là logic thuần).
- List (G1): `posts.list` (`sort: publishedAt`, `order: desc`), chip lọc MỘT tag (không
  phải mảng — khác web), ô tìm debounce 300ms qua API (không lọc máy, có phân trang).
  Chip nguồn `posts.tags`, KHÔNG in `count` (toàn cục, sai ngay sau khi lọc).
- Rỗng-vì-tìm (G2): nhắc lại đúng chuỗi đã gõ, giữ ô tìm + chip tại chỗ.
- Chi tiết (G3/G4): `posts.bySlug`, `content` markdown qua `markdown.ts` ở trên. Nút góc
  phải mở bài trên web thật (`Linking.openURL`). `relatedTours` (đã có sẵn trong response,
  KHÔNG gọi thêm) render hàng gọn, rỗng thì ẩn cả khối.
- Route vào: dòng "Travel stories" ở `account.tsx` (mục 3) — `router.push('/posts')`
  hoặc tương đương, không cần đăng nhập nên không qua `AuthGateScreen`.

---

## Thứ tự implement đề xuất (không phải mệnh lệnh)

1. `return-to.ts` + sửa 4 điểm hardcode trong chuỗi auth (mục 1b) — nền cho mọi thứ sau.
2. `AuthGateScreen` (mục 1a) + đóng nợ D6 (mục 1c).
3. Saved (mục 2) — dùng lại `AuthGateScreen` ngay, kiểm tra cơ chế return-to hoạt động
   thật (đăng nhập từ Saved → quay lại Saved).
4. Account hub + A3/A5/A6 (mục 3) — KHÔNG gồm A4/A7.
5. Travel stories (mục 6) — độc lập, không phụ thuộc gì ở trên ngoài `account.tsx` có
   dòng dẫn vào.
6. A4 (mục 4) — sau khi có ADR riêng, user duyệt.
7. A7 (mục 5) — việc riêng, cần quyết định API trước.

## Testing

Giữ đúng luật đã áp dụng xuyên suốt nhánh browse-screens: mỗi file logic thuần
(`return-to.ts`, `markdown.ts`) có spec riêng viết TRƯỚC (TDD, CLAUDE.md luật 4); mỗi
screen component có spec RNTL (`await` mọi `fireEvent`/`rerender`); route mới thêm vào
`apps/mobile/src/routes.spec.tsx`. Cổng trước khi báo xong: `pnpm gate:int` ·
`pnpm turbo run bundle --filter=@tourism/mobile` · `expo-doctor` · tokens-only · soi
nền sáng/tối máy thật.
