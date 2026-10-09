# Spec — Đăng nhập Google native trên app mobile (ID token)

- **Ngày:** 2026-10-09 · **Trạng thái:** bản nháp, chờ user duyệt cùng ADR-0056. Plan thi
  công viết sau khi duyệt.
- **Quyết định kiến trúc:** [ADR-0056](../adr/0056-mobile-google-native-signin.md)
- **Nền:** [ADR-0017](../adr/0017-web-session-better-auth.md) §9–§11 ·
  [ADR-0040](../adr/0040-mobile-app-expo.md) §1, §9, AMEND 6 ·
  [ADR-0055](../adr/0055-mobile-data-layer.md) ·
  [handoff đăng nhập mobile](../handoff/mobile-auth-handoff.md)
- **Hạn:** merge trước freeze 15/10/2026, vì thêm dependency.

## 1. Mục tiêu và phạm vi

### Vấn đề

Đăng nhập Google trên app đang đi qua proxy `expo-authorization-proxy` và deep link
`nexora://` chở cookie phiên. Từ 09/10 production có cặp env Google và tin cậy `nexora://`,
nên chuỗi chiếm phiên ở ADR-0056 §Bối cảnh chạy được. User chốt phải giữ đăng nhập Google
trên mobile.

### Trong phạm vi

- App: nút Google ở Sign in và Create account đi qua SDK gốc, lấy ID token, đổi lấy phiên.
- API: đóng proxy, chặn luồng redirect social đổ về `nexora://`, audience nhận nhiều client ID.
- Build: `expo-dev-client` và `eas.json` (profile `development`, `preview`) cho Android.
- Docs: đóng ADR-0017 §11, cập nhật `open-items`, runbook `conventions/mobile-dev-loop.md`,
  entry CHANGELOG.

### Ngoài phạm vi, cố ý

- Bản iOS có Google: chờ tài khoản Apple Developer (câu hỏi mở 1). Code vẫn truyền
  `iosClientId` để bật được ngay khi có tài khoản.
- Credential Manager hay One Tap (bản trả phí Universal Sign In): sau v1.
- Liên kết Google vào tài khoản đang đăng nhập (`linkSocial`): chưa màn nào cần.
- Nonce: bản miễn phí không truyền nonce, server không đòi (Better Auth chỉ kiểm khi có).

## 2. Luồng mới

1. Route Sign in hoặc Create account hỏi `isGoogleSignInAvailable()`. Trong Expo Go hoặc
   khi thiếu env Google thì trả `false`, màn không vẽ nút Google và dải "or".
2. Người dùng bấm nút Google. Trên Android, app gọi `GoogleSignin.hasPlayServices()`.
3. App gọi `GoogleSignin.signIn()`. Kết quả `{ type: 'cancelled' }` thành kết cục
   `cancelled`: màn đứng yên, không báo lỗi (giữ hành vi F12).
4. Có `data.idToken` thì gọi
   `authClient.signIn.social({ provider: 'google', idToken: { token } })`.
5. API kiểm token, tạo hoặc liên kết user như luồng web, đặt cookie phiên và trả
   `{ redirect: false, token, user }`. Client Expo lưu `set-cookie` vào SecureStore.
6. Route chạy tiếp như đăng nhập email: `consumeReturnPath()` rồi `router.replace`.
7. Khi đăng xuất khỏi app, gọi thêm `GoogleSignin.signOut()` (bỏ qua lỗi) để lần sau
   chọn được tài khoản Google khác.

## 3. API (`apps/api`)

### 3.1 `src/auth/auth.config.ts`

- Before-hook: path `/expo-authorization-proxy` luôn ném
  `APIError('BAD_REQUEST', { message: 'Invalid authorizationURL' })`, ở mọi môi trường.
- Before-hook: path `/sign-in/social` và `/link-social`, body **không** có `idToken`, mà
  `callbackURL`, `errorCallbackURL` hoặc `newUserCallbackURL` bắt đầu bằng `nexora://` thì
  ném `BAD_REQUEST`. Luật quyết định đặt trong một hàm thuần để test riêng.
- Provider Google: `clientId` dạng mảng, `GOOGLE_CLIENT_ID` đứng đầu, rồi
  `GOOGLE_IOS_CLIENT_ID` nếu có. Phần tử đầu vẫn là client của luồng web.
- Gỡ import `isAllowedExpoAuthorizationUrl`; xoá `src/auth/expo-proxy-guard.ts` và spec.
- Comment khối `expo()`: plugin còn giữ để đổi `expo-origin`, proxy đã đóng (ADR-0056).

### 3.2 `src/config/env.ts`, `.env.example`

- `GOOGLE_IOS_CLIENT_ID: z.string().min(1).optional()`, có test ở `env.spec.ts`.
- `.env.example` thêm dòng mẫu bị comment, ghi rõ chỉ cần khi có bản iOS.

### 3.3 Test — viết trước code (luật 4)

Unit cho hàm thuần của before-hook:

| Ca | Kết quả |
| --- | --- |
| `GET /expo-authorization-proxy`, URL Google hợp lệ | chặn |
| `/sign-in/social`, `callbackURL: 'nexora://saved'`, không `idToken` | chặn |
| như trên nhưng có `idToken` | cho qua |
| `callbackURL: '/'` hoặc `https://www.nexora-travel.agency/…` | cho qua |
| `errorCallbackURL` hoặc `newUserCallbackURL` là `nexora://…` | chặn |
| `/link-social`, `callbackURL: 'nexora://x'`, không `idToken` | chặn |

Int, trong `auth-hardening.int.spec.ts`:

- `GET /api/auth/expo-authorization-proxy` với URL Google **hợp lệ** (đúng `client_id`,
  đúng callback) trả 400 và không có `set-cookie`. Ca này thay ca cho qua của §11.
- `POST /api/auth/sign-in/social` với `{ provider: 'google', callbackURL: 'nexora://x' }`
  trả 400.
- `POST /api/auth/sign-in/social` với `{ provider: 'google', idToken: { token: 'not-a-jwt' } }`,
  không cookie, không Origin, trả 401. Ca này chứng minh nhánh ID token không bị hai hook
  mới hay lớp kiểm Origin chặn.

Int test hiện **chưa** bật provider Google. Bật bằng cặp giá trị giả trong env của test
int, rồi kiểm các int spec khác không đổi kết quả. Ca token hợp lệ không dựng được khi
offline nên nằm ở thử máy thật (§5.3).

## 4. App (`apps/mobile`)

### 4.1 Dependency và cấu hình

- `npx expo install @react-native-google-signin/google-signin expo-dev-client`: để Expo chọn
  bản khớp SDK 57. Đo 09/10, google-signin mới nhất là 16.1.5 (03/09), đã qua cửa sổ
  `minimumReleaseAge` của pnpm.
- `app.json`, mảng `plugins` thêm
  `["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.<phần đầu client iOS>" }]`.
  Plugin ném lỗi nếu thiếu khoá này, kể cả khi chỉ build Android. Giá trị là dạng đảo của
  client ID iOS, không phải bí mật.
- `eas init` ghi `extra.eas.projectId` vào `app.json`; commit thay đổi đó.
- `eas.json` mới, hai profile:
  - `development`: `developmentClient: true`, `distribution: internal`, Android `buildType: apk`.
  - `preview`: `distribution: internal`, Android `buildType: apk`, `env` trỏ production:
    `EXPO_PUBLIC_API_URL=https://api.nexora-travel.agency`,
    `EXPO_PUBLIC_WEB_URL=https://www.nexora-travel.agency` và hai client ID Google.

### 4.2 Env (`src/lib/env.ts`, `.env.example`)

- Thêm hai khoá **tuỳ chọn**: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. `env().google` trả `{ webClientId, iosClientId }`, hoặc
  `null` khi thiếu `webClientId` (khi đó nút Google ẩn).
- Không biến nào là bí mật; giữ cảnh báo của ADR-0040 §9 ở đầu file mẫu.

### 4.3 Code

- `src/features/auth/google-native.ts` (mới), seam trên module native:
  - `isGoogleSignInAvailable(executionEnvironment, googleEnv)` là hàm thuần: `false` khi
    `storeClient` (Expo Go) hoặc khi `googleEnv` là `null`.
  - `requestGoogleIdToken(sdk)` trả `{ kind: 'token', idToken }`, `{ kind: 'cancelled' }` hoặc
    `{ kind: 'error', code }`. Dùng `isSuccessResponse`, `isErrorWithCode` và `statusCodes`
    (`SIGN_IN_CANCELLED`, `IN_PROGRESS`, `PLAY_SERVICES_NOT_AVAILABLE`). Thiếu `idToken`
    tính là lỗi.
  - Nạp module native bằng `require` lười, chỉ khi `isGoogleSignInAvailable()` đúng, để Expo
    Go và Jest không chạm tới nó.
- `src/features/auth/better-auth-actions.ts`, `signInWithGoogle()`: bỏ luồng redirect và
  bước hỏi lại phiên của F12. Gọi `requestGoogleIdToken`, rồi `signIn.social` với `idToken`.
  Lỗi API đi qua `mapAuthError` như các hàm khác; kiểu `GoogleResult` giữ nguyên.
- Màn `sign-in-screen.tsx` và `register-screen.tsx` nhận prop `showGoogle`; route truyền kết
  quả `isGoogleSignInAvailable()`.
- `src/features/auth/sign-out.ts`: gọi `GoogleSignin.signOut()` khi có module, nuốt lỗi.
- Không thêm copy mới. Lỗi native rơi về câu lỗi chung đã có.

### 4.4 Test — jest-expo, viết trước code

- `google-native.spec.ts`: bảng khả dụng (Expo Go, thiếu env, dev build); ánh xạ thành
  công, huỷ, ba mã lỗi, thiếu `idToken`.
- `better-auth-actions.spec.ts`: gửi đúng body `idToken`; API 401 thành lỗi chung; huỷ thành
  `cancelled`; không gọi `expo-web-browser`.
- Spec hai màn: `showGoogle={false}` thì không có nút Google lẫn dải "or".
- `sign-out.spec.ts`: có gọi `GoogleSignin.signOut()` khi module có mặt; lỗi của nó không
  chặn đăng xuất.
- Mock module native một lần trong `jest.setup.js`.

## 5. Nghiệm thu

### 5.1 Tự động

`pnpm gate:int` xanh, `pnpm turbo run bundle --filter=@tourism/mobile` xanh, build web với
API sống như bước CI.

### 5.2 Kiểm test bằng phá thử

Gỡ chặn proxy thì int test proxy phải đỏ. Gỡ chặn `nexora://` thì int test redirect phải
đỏ. Trả lại code rồi chạy lại cho xanh.

### 5.3 Thử máy thật — Android, APK `preview`, API production sau deploy

1. Expo Go: không thấy nút Google; đăng nhập email và mật khẩu vẫn được.
2. APK `preview`: bấm Google, bảng chọn tài khoản gốc hiện ra, chọn xong vào app; Account
   hiện đúng tên và ảnh.
3. Mở bảng chọn rồi huỷ: màn đứng yên, không báo lỗi.
4. Tài khoản email và mật khẩu sẵn có trùng Gmail: đăng nhập Google vào đúng tài khoản đó.
5. Đăng xuất, bấm Google lại: được chọn tài khoản khác.
6. Bấm tim khi chưa đăng nhập, rồi đăng nhập Google: quay lại đúng tour, tim đã đặc.
7. Từ máy dev, gọi proxy với một URL Google hợp lệ: trả 400, không có `set-cookie`.

## 6. Hạ tầng — luật 15, root session làm sau review

- [ ] Google Cloud, đúng project chứa `GOOGLE_CLIENT_ID` đang chạy: tạo OAuth client
  **Android** (package `agency.nexoratravel.app`, SHA-1 lấy từ `eas credentials`; có build
  local thì thêm SHA-1 khoá debug) và OAuth client **iOS** (bundle `agency.nexoratravel.app`).
- [ ] Kiểm màn đồng ý OAuth: nếu đang ở chế độ Testing thì chỉ test user đăng nhập được.
- [ ] Tài khoản Expo cho EAS, `eas init` trên nhánh thi công.
- [ ] Render: `GOOGLE_IOS_CLIENT_ID` chỉ khi có bản iOS. API tự deploy khi merge.
- [ ] Sau merge: build `preview` Android trên EAS, cài máy thật, chạy §5.3.
- Thử luồng ID token với API local cần cặp env Google trong `apps/api/.env.local` của máy
  dev. Không commit giá trị đó, không đặt ở session cloud.

## 7. Thứ tự thi công, giả định duyệt 09/10

| Ngày | Việc |
| --- | --- |
| 10/10 | User tạo hai client OAuth và tài khoản Expo. Nhánh `feat/mobile-google-native-signin`: API làm trước (test trước code), rồi seam và test phía app. |
| 11/10 | `eas.json`, dev build Android đầu tiên, thử với API local. |
| 12/10 | Review nhánh, vá. |
| 13/10 | Merge; root session làm §6; build `preview`; thử §5.3. |
| 14/10 | Đệm cho lỗi `DEVELOPER_ERROR` hoặc hàng đợi EAS. |
| 15/10 | Freeze. |

## 8. Rủi ro và giới hạn đã biết

- SHA-1 hoặc package lệch giữa EAS và Google Cloud thì SDK báo `DEVELOPER_ERROR`; đối
  chiếu `eas credentials` với client Android trước khi nghi code.
- SDK miễn phí dùng Google Sign-In cũ trên Android, đã deprecated; chuyển Credential
  Manager sau v1 (ghi open-items).
- EAS free có hạn mức và hàng đợi; gom thay đổi native vào ít lượt build.
- iOS không có Google tới khi có Apple Developer.
- Expo Go không còn nút Google: ghi vào `conventions/mobile-dev-loop.md` để không ai tưởng
  là lỗi.

## 9. Câu hỏi mở — trùng ADR-0056

1. Nhóm có tài khoản Apple Developer không?
2. Buổi bảo vệ demo bằng APK `preview` Android hay Expo Go?
