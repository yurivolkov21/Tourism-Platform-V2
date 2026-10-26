# Chạy thử và kiểm tra app mobile

Trang này hướng dẫn chạy app điện thoại trên máy của bạn, cách kiểm tra trước khi
gộp code, và giải thích những chỗ cấu hình cố ý khác mặc định. Áp dụng cho
`apps/mobile` (`@tourism/mobile`) và `libs/mobile/ui` (`@tourism/mobile-ui`). Lý
do của các quyết định nằm ở [ADR-0040](../adr/0040-mobile-app-expo.md).

## 0. Kiểm tra tự động và kiểm tra bằng tay

Kiểm tra tự động chạy bằng `typecheck`, `test` và `bundle` (§3), không cần mở dev
server. Dev server (`expo start`) do người phát triển tự bật khi muốn thử trên
điện thoại; trợ lý AI làm việc trong repo không tự bật hay tắt nó. Bước cuối là
cầm điện thoại quét mã QR để xem app chạy thật, và bước này phải có người làm.

## 1. Trước lần chạy đầu tiên

```bash
pnpm install
pnpm turbo run build --filter=@tourism/mobile^...
cp apps/mobile/.env.example apps/mobile/.env.local
```

Dòng build **không bỏ được**, và phải là `@tourism/mobile^...` (mọi package mà
app phụ thuộc) chứ không phải riêng `@tourism/tokens`: Metro cần `dist` của cả
`@tourism/i18n`, `@tourism/core`, `@tourism/tokens` và, từ P5b-2, `@tourism/contract`. Bản cũ chỉ build tokens
nên máy sạch chết ở `@tourism/i18n` — sửa 16/09 khi cụm auth mobile kéo thêm
`@tourism/core` vào cây import.

Vì sao phải build tay: `@tourism/tokens/theme` (`generated/theme.js`) và `dist`
của các package kia đều là build artifact và bị gitignore; Turbo tự lo thứ tự
cho `typecheck`/`test` qua `dependsOn: ^build`, nhưng **Metro lúc `expo start`
thì không** — máy chưa từng build sẽ thấy Metro báo thiếu module chứ không báo
"hãy build trước".

`.env.local` có hai biến bắt buộc và hai biến tuỳ chọn, tất cả đều công khai:

| Biến | Là gì |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | origin API oRPC, **không** kèm `/api` |
| `EXPO_PUBLIC_WEB_URL` | gốc web — checkout hosted và trang pháp lý mở bằng trình duyệt |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | tuỳ chọn — client web của Google; thiếu thì nút Google ẩn (§7) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | tuỳ chọn — client iOS của Google, chỉ bản iOS cần; bản iOS thiếu nó thì nút Google ẩn |

Mọi biến `EXPO_PUBLIC_*` **nằm trong bundle JS và đọc được bằng tay**. Mobile
là client công khai, cùng hạng browser: không secret nào ở đây, kể cả
`INTERNAL_READ_KEY` (ADR-0040 §9).

## 2. Chạy — LAN là mặc định

```bash
pnpm --filter @tourism/mobile dev
```

Đó là `expo start --go`. Khi máy dev chạy thẳng Windows, macOS hoặc Linux (không
qua WSL), Metro nghe trên máy và điện thoại trong cùng mạng Wi-Fi tới được, không
cần tunnel hay cài thêm gì. Trên Windows, tường lửa phải cho Node nhận kết nối
vào; lần đầu chạy nó sẽ hỏi, chọn Allow cho mạng Private.

Trên điện thoại: cài **Expo Go** rồi quét QR. Không cần Mac, Android Studio hay
tài khoản EAS — đó chính là thứ đổi lấy việc **Stripe PaymentSheet không dùng
được** (Expo Go không nạp native module ngoài danh sách dựng sẵn); thanh toán
mobile mở checkout web, đúng cách Nexora làm
([ADR-0001 AMEND 1](../adr/0001-tech-stack.md)).

Ba script `dev`, `dev:lan`, `dev:tunnel` có cờ `--go` từ 13/10: app nay có
`expo-dev-client` (ADR-0056), và thiếu cờ thì `expo start` thấy gói đó trong
`package.json` là tự chuyển QR sang dev build — Expo Go quét vào không mở được
app. Muốn nối dev build thì chạy `dev:client` (hoặc bấm `s` trong terminal của
Metro để đổi qua lại).

### Khi nào cần tunnel

```bash
pnpm --filter @tourism/mobile dev:tunnel
```

Ba ca: máy và điện thoại **khác mạng** · mạng chặn thiết bị nói chuyện với nhau
(Wi-Fi công ty, khách sạn) · hoặc quay lại làm việc **trong WSL**, nơi mạng ở
chế độ NAT nên điện thoại trong LAN không tới được Metro (đó là lý do tunnel
từng là mặc định tới 14/09 — xem [ADR-0040 AMEND 2](../adr/0040-mobile-app-expo.md)).

Tunnel có một cửa ải riêng, làm **một lần cho cả máy**: nó đòi `@expo/ngrok`,
gói này không nằm trong kho mã và Expo CLI không tự cài ngầm — nó **dừng lại
hỏi y/n** rồi chạy `npm install --global`. Chạy lệnh rồi bỏ đi chờ QR là ngồi
nhìn màn hình đứng im mà không có lỗi nào. Cài trước cho khỏi vấp (thư mục nào
cũng được, không cần quyền quản trị, không đụng `pnpm-lock.yaml`):

```bash
npm install --global "@expo/ngrok@^4.1.0"
```

Kiểm bằng `npm ls -g --depth=0 @expo/ngrok`. **Đừng kiểm bằng `which ngrok`** —
gói này không khai trường `bin` nên lệnh đó vẫn rỗng sau khi cài.

### `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_WEB_URL` khi chạy thật

`localhost:3001`/`localhost:3000` là địa chỉ của **máy dev**, điện thoại không
hiểu — với điện thoại, `localhost` là chính nó. Nên khi chạy LAN, `env()` tự
thay host loopback (`localhost`, `127.0.0.1`) bằng IP LAN mà Metro đang phục
vụ, giữ nguyên scheme và cổng — cho CẢ HAI biến (`resolveDevOrigin`, đến
25/09 chỉ API được thay, WEB thì không: bấm link pháp lý/biên tập ở Account
trên điện thoại thật ra "localhost đã từ chối kết nối"). Để mặc định là điện
thoại gọi được cả API lẫn web trên máy dev (cả hai đều nghe `0.0.0.0`, web
chạy `pnpm dev` ở `apps/web`).

Chạy tunnel thì **không có phép thay đó**, vì ngrok chỉ chuyển cổng Metro: trỏ
vào API đã deploy, hoặc mở thêm một tunnel cho cổng 3001. Giá trị trỏ host thật
luôn được giữ nguyên ở mọi chế độ.

## 3. Nghiệm thu bằng máy

```bash
pnpm turbo run typecheck test --filter=@tourism/mobile --filter=@tourism/mobile-ui
pnpm turbo run bundle --filter=@tourism/mobile
cd apps/mobile && pnpm exec expo-doctor
```

Dòng thứ hai **không nằm trong `pnpm gate`**. Task turbo tên `bundle` chứ
không phải `build` là cố ý (ADR-0040 §5): `gate` là vòng lặp TDD, còn
`expo export` tốn ~1–2 phút và chạy lại mỗi lần bất kỳ package chung nào đổi.
Hệ quả cần nhớ: `pnpm gate` xanh chưa chứng minh app mobile bundle được. Lưới
bắt lỗi này là bước *"App mobile bundle được"* trong CI, nên ai sửa `apps/mobile`
cần xem kết quả CI (luật 14 trong `CLAUDE.md`) hoặc tự chạy dòng thứ hai.

## 4. Hai phiên bản cố ý lệch ma trận Expo

`package.json` của `apps/mobile` khai `expo.install.exclude` cho hai gói. Đây
là đường Expo mở sẵn cho lệch phiên bản có chủ đích — nhưng phải hiểu đúng nó
làm gì: **`exclude` không đổi resolution, nó chỉ gỡ gói khỏi tầm kiểm của
`expo-doctor`.** Nghĩa là con số "xanh N/N" KHÔNG nói gì về hai gói dưới đây;
chúng được canh bằng chính bảng này chứ không bằng máy.

| Gói | Ma trận SDK 57 | Repo dùng | Vì sao |
| --- | --- | --- | --- |
| `typescript` | `~6.0.3` | **7.0.2** | Toolchain repo bắt tsgo (CLAUDE.md). Đã đo: tsgo typecheck được codebase RN, và bắt đúng lỗi prop RN. |
| `react` | `19.2.3` | **19.2.4** | `overrides` trong `pnpm-workspace.yaml` (chốt 27/07, chữa bug hai bản React ở Vitest) áp cho CẢ workspace. Sửa overrides để chiều mobile là mở lại đúng lớp bug đó. Manifest hai package mobile khai **19.2.4** — đúng bản thực cài; khai 19.2.3 cho khớp ma trận là một lời nói dối trong file mà người ta tra đầu tiên. |

Nếu `expo-doctor` báo đỏ về gói khác, **đừng thêm vào `exclude` theo phản xạ**
— `expo-doctor` là trọng tài cho dependency của `apps/mobile` (ADR-0040 §7),
mỗi lần loại một gói khỏi tầm mắt của nó là bớt đi một lớp canh.

## 5. Những chỗ tưởng thiếu mà là cố ý

- **Không có `metro.config.js`.** Expo SDK 52+ tự lo monorepo và SDK 54+ chạy
  được pnpm isolated. 90 dòng `metro.config.js` của Nexora vá Nx + Windows —
  v2 không có cả hai (ADR-0040 §6). Đã đo: `expo export` bundle được cả iOS
  lẫn Android mà không cần file nào.
- **Không có Maestro.** App chưa có test đầu cuối (E2E). `eas.json` có từ
  13/10/2026, chỉ để build bản có đăng nhập Google (§7); vòng dev hằng ngày vẫn
  là Expo Go.
- **Jest chứ không Vitest, và CHỈ ở hai package này.** Ngoại lệ đã được
  ADR-0001 + CLAUDE.md cấp từ P0; ranh giới ở ADR-0040 §4 là thứ giữ cho nó
  không lan. Không có config Jest nào ở root.
- **Spec của cây route nằm ở `src/routes.spec.tsx`, ngoài `src/app`.**
  expo-router coi mọi file `.tsx` dưới thư mục app là một route (ignore list
  của nó chỉ có `+html`, `+native-intent`, `+api`, `+middleware`) — để
  `.spec.tsx` trong đó là tự đẻ thêm một route rác.

## 6. Bẫy đã cắn, ghi lại để khỏi cắn lần hai

- **`jest` phải là `~29.7.0`.** `jest-expo@57` khai toàn bộ dependency ở
  `^29.2.1` và bản đồ version của SDK 57 cũng ghi `jest ~29.7.0`. Với Jest 30,
  runtime winter của expo ném *"trying to import a file outside of the scope
  of the test code"* ngay lúc nạp preset — thông báo không nói gì về phiên bản.
- **RNTL 14 bất đồng bộ.** `render()` trả Promise; chưa `await` thì `screen`
  còn rỗng và báo *"render function has not been called"*, cũng không nói gì
  về async.
- **`renderRouter` gắn `getPathname()` lên chính Promise đó.** Nên
  `await renderRouter(...)` mất hết mấy hàm ấy, và `return app` trong một hàm
  `async` cũng tự await thenable rồi mất y hệt.
- **`@orpc/*` chỉ có ESM** và app kéo vào gián tiếp qua `@tourism/i18n` →
  `@tourism/contract`. Phải nới HAI chỗ trong `jest.config.js` — thiếu chỗ nào
  cũng vẫn chết ở token `import`: `transformIgnorePatterns` (jest-expo không
  liệt kê `@orpc`) và `transform` (mẫu `\.[jt]sx?$` không khớp đuôi `.mjs`).
- **`newArchEnabled` không còn là khoá hợp lệ** trong app config SDK 57 (New
  Architecture là kiến trúc duy nhất); để lại thì `expo-doctor` báo đỏ.
- **tsgo đòi khai `types` tường minh** trong `tsconfig.json`, đúng gotcha
  04/08. Dùng `types: ["jest", "expo/types"]` — `expo/types/metro-require.d.ts`
  khai `process.env`, nên **không** cần `@types/node` (type Node trong app RN
  là sai bản chất). Hệ quả: spec nào cần API Node (đọc cây file) thì phải đổi
  cách, không phải mở `types` — xem `routes.spec.tsx` đọc cây route qua
  `getMockConfig` của expo-router thay vì `node:fs`.
- **Alias `@/*` của `tsconfig.json` chạy thẳng ở Metro**, không cần khai thêm
  trong `metro.config.js` (vốn không tồn tại) hay `babel.config.js`.
- **`react-native-safe-area-context` `SafeAreaView` mặc định `additive` cả 4
  cạnh** và không thấy phần navigator đã trừ. Màn dưới header hay trong tab
  PHẢI khai `edges` (dùng `SCREEN_EDGES_UNDER_HEADER` / `SCREEN_EDGES_UNDER_TABS`
  của `@tourism/mobile-ui`) — khai sai là dải trắng chết hoặc chữ chui xuống
  thanh cử chỉ, và spec component không bắt được vì test dựng ngoài navigator.

## 7. Đăng nhập Google — dev build và APK `preview` (ADR-0056)

Nút Google dùng SDK gốc `@react-native-google-signin/google-signin`, một native
module mà **Expo Go không nạp được**. Vì vậy trong Expo Go nút Google ẩn hẳn
(`canUseGoogleSignIn()` thấy `executionEnvironment` là `storeClient`), email và
mật khẩu vẫn chạy. Mỗi lần bấm, app dọn phiên Google cũ rồi mới mở bảng chọn, nên
lần nào cũng được chọn tài khoản. Thử Google phải cài một trong hai bản build của EAS:

| Profile | Là gì | Env đọc từ đâu |
| --- | --- | --- |
| `preview` | APK cài thẳng, trỏ API production — bản thử máy thật và demo | khối `env` trong `eas.json` |
| `development` | dev client, nạp JS từ Metro trên máy dev | `.env.local` (điền hai biến Google) |

EAS build trên cloud nên chạy được từ máy Windows, không cần Android Studio.
Lệnh chạy từ `apps/mobile` (EAS đòi chạy ở gốc app, không phải gốc monorepo):

```bash
npx eas-cli login                                   # một lần cho máy
npx eas-cli init                                    # một lần cho dự án: ghi extra.eas.projectId vào app.json, commit thay đổi đó
npx eas-cli build --platform android --profile preview
npx eas-cli credentials --platform android          # xem SHA-1 của khoá ký
```

Ba điều phải khớp, không thì SDK báo `DEVELOPER_ERROR` khi bấm Google:

1. **Client OAuth Android** ở Google Cloud, CÙNG dự án với client web (số dự án
   là phần trước dấu `-` của client ID): package `agency.nexoratravel.app`, SHA-1
   lấy từ `eas-cli credentials`. Build local bằng khoá debug thì thêm một client
   Android nữa với SHA-1 của khoá đó.
2. **Client web** trong `eas.json` và `.env.local` trùng `GOOGLE_CLIENT_ID` của
   API: SDK xin ID token với audience này và API kiểm đúng audience đó.
3. **`iosUrlScheme`** của plugin trong `app.json` là dạng đảo của client iOS.
   Plugin ném lỗi nếu thiếu khoá này, kể cả khi chỉ build Android.
   `src/app-config.spec.ts` canh điều 3 và việc hai client cùng dự án.

Trang cấu hình OAuth của dự án Google còn ở trạng thái **Testing** thì chỉ các
Gmail có tên trong Test users đăng nhập được, cả web lẫn app. Publish (sau khi
điền trang Branding) thì ai cũng đăng nhập được; với ba quyền cơ bản và không
tải logo, Google không bắt duyệt.

Build trên EAS không chạy turbo: script `eas-build-post-install` trong
`package.json` của app build các package của workspace (cùng dòng `^...` ở §1)
sau bước cài, vì Metro cần `dist` của chúng. Khối `base` của `eas.json` ghim
Node 24 và pnpm 11.9.0 cho khớp `packageManager` của repo. Gói miễn phí của EAS
có hạn mức và hàng đợi, nên gom thay đổi native vào ít lượt build: đổi JS thuần
thì bản `development` chỉ cần Metro, không phải build lại.
