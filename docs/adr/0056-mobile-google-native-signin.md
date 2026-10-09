# ADR-0056 — Đăng nhập Google trên app mobile bằng SDK gốc và ID token; đóng proxy `expo-authorization-proxy`

- **Trạng thái:** Accepted (2026-10-09) — user duyệt cùng ngày, chốt demo bằng APK `preview`
  Android. ADR này thay cơ chế của [ADR-0017](0017-web-session-better-auth.md) §11 và đảo một
  phần [ADR-0040](0040-mobile-app-expo.md) §1 (thêm dev build cho Android). Câu tài khoản
  Apple Developer chưa trả lời; tới khi có, iOS không có Google trong v1.
- **Bối cảnh:** review cuối nhánh `feat/mobile-account-screens` và merge P5b-4 (09/10, entry
  CHANGELOG cùng ngày). Spec thi công:
  [2026-10-09-mobile-google-native-signin-design.md](../specs/2026-10-09-mobile-google-native-signin-design.md).

## Bối cảnh

**Luồng hiện tại (ADR-0017 §9, §11).** App gọi `signIn.social({ provider: 'google' })`.
Client `@better-auth/expo` 1.6.23 nhận URL Google rồi mở
`GET /api/auth/expo-authorization-proxy` trong trình duyệt hệ thống. Proxy đặt cookie
`state` theo đúng giá trị nằm trong URL người gọi đưa vào, rồi chuyển sang Google. Sau
callback, plugin `expo()` phía server gắn **cookie phiên** vào deep link
`nexora://…?cookie=…` khi đích là origin tin cậy không phải http
(`@better-auth/expo/dist/index.js:81`). App đọc cookie đó từ deep link.

**§11 (08/10) mới đóng nửa lỗ.** Chốt chặn chỉ cho proxy chuyển tới URL Google đúng
`client_id` và callback của mình, nên hết open redirect. Nhưng URL hợp lệ vẫn mang `state`
do người gọi chọn, và §11 tính rủi ro còn lại trên giả định Google chưa cấu hình ở
production.

**Đo 09/10: giả định đó sai.** Production có cả `GOOGLE_CLIENT_ID` lẫn
`GOOGLE_CLIENT_SECRET` (user xác nhận trên Render), và `nexora://` vào `TRUSTED_ORIGINS`
cùng ngày theo §10. Hai điều kiện cùng có thì chuỗi sau chạy được:

1. Kẻ tấn công tự gọi `POST /api/auth/sign-in/social` với `callbackURL=nexora://…`.
   Request không mang cookie nên Better Auth bỏ qua kiểm Origin
   (`better-auth/dist/api/middlewares/origin-check.mjs`), còn `nexora://` là origin tin cậy.
2. Họ gửi nạn nhân link proxy mang URL Google của luồng đó. Chốt §11 cho qua vì URL hợp lệ.
3. Nạn nhân đăng nhập Google bằng tài khoản của chính mình. Callback tạo phiên **của
   nạn nhân** rồi gắn cookie phiên vào deep link `nexora://`.
4. App nào giành được scheme `nexora` trên máy nạn nhân sẽ nhận phiên đó.

Điều kiện khai thác: link lừa cộng một app độc mang cùng scheme. Không có app độc thì
còn biến thể login CSRF với đích web. Gốc rễ không vá được trong khuôn plugin: custom
scheme không độc quyền, proxy cho bất kỳ ai cắm `state` vào trình duyệt nạn nhân, và
deep link chở thẳng credential.

**Ràng buộc.** ADR-0040 §1 chạy Expo Go, không dev build (không Mac, không Android
Studio, chưa EAS). Freeze dependency 15/10/2026. User chốt 09/10: bỏ đăng nhập Google
trên mobile là bước lùi lớn, phải giữ.

## Quyết định

### 1. App lấy ID token bằng SDK Google gốc rồi đổi lấy phiên

Dùng `@react-native-google-signin/google-signin` **16.1.5** (bản miễn phí, phát hành
03/09/2026, peer `expo >=52.0.40`, có config plugin). App gọi
`GoogleSignin.configure({ webClientId, iosClientId })` rồi `GoogleSignin.signIn()`. Bản này
trả `{ type: 'success', data }` hoặc `{ type: 'cancelled' }`, ID token nằm ở
`data.idToken`. App gửi token lên bằng
`authClient.signIn.social({ provider: 'google', idToken: { token } })`.

Đã đọc mã, không suy đoán:

- Better Auth 1.6.23 có sẵn nhánh này (`dist/api/routes/sign-in.mjs`): kiểm chữ ký,
  issuer, audience bằng `clientId` của provider, tuổi token tối đa 1 giờ, nonce nếu có.
  Phiên tạo qua cùng `handleOAuthUserInfo` với luồng web, nên liên kết tài khoản theo
  email giống hệt web.
- Client Expo thấy `idToken` thì không mở trình duyệt, không qua proxy, và lưu
  `set-cookie` của response vào SecureStore (`@better-auth/expo/dist/client.js`).
- Request không mang cookie nên không cần header `expo-origin`.

Vì sao an toàn: không trình duyệt, không `state`, không deep link. ID token có audience
là client ID của mình chỉ xin được từ app ký đúng — Android theo package và SHA-1 đăng
ký ở Google Cloud, iOS theo bundle id — nên app lạ không xin được token cho client này.

### 2. Dev build qua EAS cho Android; Expo Go vẫn là vòng dev hằng ngày

SDK Google là native module nên Expo Go không nạp được, đúng hệ quả ADR-0040 §1 đã ghi.
Thêm `expo-dev-client` và `eas.json` với hai profile: `development` (dev client, nối Metro)
và `preview` (APK cài thẳng, trỏ API production). Bản `preview` là bản thử máy thật và
demo. EAS build trên cloud nên chạy được từ máy Windows, không cần Android Studio.

- Trong Expo Go nút Google bị ẩn (`Constants.executionEnvironment` là `storeClient`), nên
  không có nút nào bấm mà chết. Email và mật khẩu vẫn chạy như cũ.
- iOS cần build ký bằng Apple Developer Program, hiện chưa có. Khi chưa có, iOS chỉ chạy
  Expo Go nên không có nút Google (câu hỏi mở 1).
- Config plugin của thư viện bắt buộc `iosUrlScheme` dạng `com.googleusercontent.apps.…`
  (`plugin/build/withGoogleSignIn.js` ném lỗi nếu thiếu), kể cả khi chỉ build Android. Vì
  vậy vẫn phải tạo client OAuth iOS ở Google Cloud; bước này miễn phí, không cần tài
  khoản Apple.

### 3. API đóng proxy ở mọi môi trường và chặn deep link chở phiên

- Before-hook trả 400 cho mọi `GET /expo-authorization-proxy`, thay chốt có điều kiện
  của §11. Gỡ `auth/expo-proxy-guard.ts` cùng spec của nó.
- Before-hook trả 400 cho `POST /sign-in/social` **không** kèm `idToken` mà
  `callbackURL`, `errorCallbackURL` hoặc `newUserCallbackURL` bắt đầu bằng `nexora://`. Đây
  là khoá thứ hai: dù bản plugin sau mở lại proxy, server cũng không còn luồng redirect
  nào đổ về deep link để gắn cookie.
- Giữ plugin `expo()`: nó vẫn cần để đổi `expo-origin` thành `origin` cho request mang
  cookie của app. Giữ `nexora://` trong `TRUSTED_ORIGINS` cho đăng nhập email và mật khẩu.
- Provider Google nhận `clientId` dạng mảng: `GOOGLE_CLIENT_ID` đứng đầu, rồi
  `GOOGLE_IOS_CLIENT_ID` nếu có. Better Auth dùng phần tử đầu cho luồng web
  (`getPrimaryClientId`) và cả mảng làm audience. Android không cần biến mới: SDK xin
  token với `webClientId`, nên audience là client web.

### 4. Env

| Biến | Nơi | Bắt buộc | Ghi chú |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | mobile | ở build có Google | bằng `GOOGLE_CLIENT_ID` của API |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | mobile | ở build có Google | `iosUrlScheme` của plugin là dạng đảo của nó, ghi thẳng trong `app.json` |
| `GOOGLE_IOS_CLIENT_ID` | API | không | thêm vào audience khi có bản iOS |

Client ID không phải bí mật; mobile vẫn không giữ bí mật nào (ADR-0040 §9).

### 5. Một nhánh, API và app cùng merge, trước freeze

Không đóng proxy trước khi bản `preview` Android đăng nhập Google được trên máy thật,
để không có khoảng nào app mất Google. Trong lúc chờ, chấp nhận rủi ro hiện tại: app chưa
phát hành, và khai thác cần app độc nhắm riêng scheme `nexora`. Hai dependency mới phải
vào trước 15/10.

## Hệ quả

- Hết chuỗi chiếm phiên và login CSRF qua proxy. Luồng Google trên web không đổi.
- `apps/mobile` thêm hai dependency (`@react-native-google-signin/google-signin`,
  `expo-dev-client`) và `eas.json`. Root session tạo ở Google Cloud một client OAuth
  Android (package `agency.nexoratravel.app` cùng SHA-1 khoá ký của EAS) và một client iOS.
- Thử Google phải cài dev build hoặc APK `preview`; Expo Go không còn nút Google.
- Bản miễn phí dùng Google Sign-In SDK cũ trên Android, đã bị Google đánh dấu deprecated.
  Nó vẫn chạy; chuyển sang Credential Manager để sau v1 (ghi ở open-items).
- EAS cần tài khoản Expo và chịu hạn mức build miễn phí — mỗi lần đổi native là một lượt.
- Chưa có Apple Developer thì iOS không có Google; email và mật khẩu vẫn chạy.

## Đối chiếu Nexora (luật 10 — phân loại)

| Hạng mục | Nexora | v2 sau ADR này | Phân loại |
| --- | --- | --- | --- |
| Đăng nhập Google trên mobile | Bản ghi trong `docs/analysis` không nhắc tới | SDK gốc và ID token | tính năng mới, không có mốc parity |
| `eas.json` | Có, 3 profile | 2 profile (`development`, `preview`) | tương đương — ADR-0040 cố ý bỏ khi chưa cần native module |
| Credential trên app | Bearer Supabase trong storage | cookie phiên trong SecureStore, không bao giờ đi qua deep link | **v2 tốt hơn** |

## Đã cân nhắc và loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ proxy (§11), chấp nhận rủi ro | Chuỗi chiếm phiên sống ở production; đi bảo vệ đồ án với một lỗ đã biết. |
| Đóng proxy, bỏ Google trên app | User coi là bước lùi lớn (09/10). |
| Gỡ cặp env Google trên Render | Làm hỏng đăng nhập Google của người dùng web. |
| PKCE giữa app và API, deep link chở mã một lần thay cookie | Chặn được kẻ đọc trộm deep link ở luồng app tự khởi tạo, nhưng không chặn luồng do kẻ tấn công khởi tạo vì họ giữ verifier; lại phải viết lại lõi plugin sát freeze. |
| `expo-auth-session` (OAuth qua trình duyệt, PKCE, client Google native) | Cũng cần dev build; Google đã tắt mặc định redirect custom scheme cho client OAuth Android. |
| Universal Sign In (bản trả phí, Credential Manager) | Hiện đại hơn nhưng tốn license cho một capstone. |
| App Links hoặc Universal Links thay custom scheme | Plugin `expo()` chỉ gắn cookie cho deep link không phải http(s), nên không khớp; còn phải host `assetlinks.json` và AASA. |

## Câu hỏi khi duyệt (09/10)

1. Tài khoản Apple Developer: **chưa trả lời**. Mặc định iOS không có Google trong v1, email
   và mật khẩu vẫn chạy. Có tài khoản thì bật theo spec, không phải viết lại code.
2. Demo buổi bảo vệ: **APK `preview` Android**, có Google (user chốt 09/10).
