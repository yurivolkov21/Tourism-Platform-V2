# Vòng lặp dev app mobile — chạy thử, nghiệm thu, và những chỗ cố ý lệch

Áp dụng cho `apps/mobile` (`@tourism/mobile`) + `libs/mobile/ui`
(`@tourism/mobile-ui`). Quyết định đằng sau ở [ADR-0040](../adr/0040-mobile-app-expo.md);
văn bản này chỉ nói **làm thế nào** và **vì sao chỗ này không giống chỗ kia**.

## 0. Ai bấm nút

**Agent không tự bật/tắt dev server** — user giữ. Agent nghiệm thu bằng
`typecheck` + `test` + `bundle`, không bằng `expo start`. Bước cuối cùng —
cầm điện thoại quét QR — là bước duy nhất không ai làm thay được.

## 1. Trước lần chạy đầu tiên

```bash
pnpm install
pnpm turbo run build --filter=@tourism/tokens
cp apps/mobile/.env.example apps/mobile/.env.local
```

Dòng build tokens **không bỏ được**. `@tourism/tokens/theme`
(`generated/theme.js`) là build artifact và bị gitignore; Turbo tự lo thứ tự
cho `typecheck`/`test` qua `dependsOn: ^build`, nhưng **Metro lúc `expo start`
thì không** — máy chưa từng build tokens sẽ thấy Metro báo thiếu module chứ
không báo "hãy build tokens".

`.env.local` chỉ có hai biến, cả hai đều công khai:

| Biến | Là gì |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | origin API oRPC, **không** kèm `/api` |
| `EXPO_PUBLIC_WEB_URL` | gốc web — checkout hosted và trang pháp lý mở bằng trình duyệt |

Mọi biến `EXPO_PUBLIC_*` **nằm trong bundle JS và đọc được bằng tay**. Mobile
là client công khai, cùng hạng browser: không secret nào ở đây, kể cả
`INTERNAL_READ_KEY` (ADR-0040 §9).

## 2. Chạy — tunnel là mặc định, không phải phương án dự phòng

**Cửa ải trước tiên, làm MỘT lần cho cả máy:** `--tunnel` đòi `@expo/ngrok`,
gói này không nằm trong repo và Expo CLI không tự cài ngầm — nó **dừng lại hỏi
y/n** rồi chạy `npm install --global`. Chạy lệnh dev rồi bỏ đi chờ QR là ngồi
nhìn màn hình đứng im mà không có lỗi nào. Cài trước cho khỏi vấp (ở thư mục
nào cũng được, nhưng phải trong WSL — CLI chạy trong WSL nên chỉ tìm ở prefix
npm của WSL; không cần `sudo`, không đụng `pnpm-lock.yaml`):

```bash
npm install --global '@expo/ngrok@^4.1.0'
```

Kiểm bằng `npm ls -g --depth=0 @expo/ngrok`. **Đừng kiểm bằng `which ngrok`** —
gói này không khai trường `bin` nên lệnh đó vẫn rỗng sau khi cài.

Rồi mới:

```bash
pnpm --filter @tourism/mobile dev
```

Đó là `expo start --tunnel`. Lý do là một sự thật của máy chứ không phải sở
thích: **WSL ở chế độ NAT** (đo 08/09: `hostname -I` → `172.26.107.162`, không
có `C:\Users\<user>\.wslconfig`), nên điện thoại trong LAN **không tới được**
Metro chạy trong WSL. Tunnel đi vòng qua Internet nên chạy được ngay, đổi lại
chậm hơn và cần mạng.

Ngày nào bật mirrored networking trên Windows (việc của user, không phải của
agent) thì đường LAN nhanh hơn có sẵn:

```bash
pnpm --filter @tourism/mobile dev:lan
```

Trên điện thoại: cài **Expo Go** rồi quét QR. Không cần Mac, Android Studio
hay tài khoản EAS — đó chính là thứ đổi lấy việc **Stripe PaymentSheet không
dùng được** (Expo Go không nạp native module ngoài danh sách dựng sẵn);
thanh toán mobile mở checkout web, đúng cách Nexora làm
([ADR-0001 AMEND 1](../adr/0001-tech-stack.md)).

Lưu ý về `EXPO_PUBLIC_API_URL` khi chạy thật: `localhost:3001` là địa chỉ của
**máy dev**, điện thoại không hiểu. Muốn bấm ra dữ liệu thật (từ P5b) thì trỏ
vào API đã deploy, hoặc mở thêm một tunnel cho cổng 3001.

## 3. Nghiệm thu bằng máy

```bash
pnpm turbo run typecheck test --filter=@tourism/mobile --filter=@tourism/mobile-ui
pnpm turbo run bundle --filter=@tourism/mobile
cd apps/mobile && pnpm exec expo-doctor
```

Dòng thứ hai **không nằm trong `pnpm gate`**. Task turbo tên `bundle` chứ
không phải `build` là cố ý (ADR-0040 §5): `gate` là vòng lặp TDD, còn
`expo export` tốn ~1–2 phút và chạy lại mỗi lần bất kỳ package chung nào đổi.
Hệ quả phải nhớ: **"gate xanh" một mình không còn bảo chứng mobile bundle
được** — lưới là CI (step *"App mobile bundle được"*), nên ai chạm
`apps/mobile` phải liếc đèn CI (CLAUDE.md #14) hoặc gọi tay dòng đó.

## 4. Hai phiên bản cố ý lệch ma trận Expo

`expo-doctor` xanh 21/21, nhưng chỉ vì `package.json` của `apps/mobile` khai
`expo.install.exclude` cho hai gói. Đây là đường Expo mở sẵn cho lệch phiên
bản có chủ đích — không phải cách giấu lỗi:

| Gói | Ma trận SDK 57 | Repo dùng | Vì sao |
| --- | --- | --- | --- |
| `typescript` | `~6.0.3` | **7.0.2** | Toolchain repo bắt tsgo (CLAUDE.md). Đã đo: tsgo typecheck được codebase RN, và bắt đúng lỗi prop RN. |
| `react` | `19.2.3` | **19.2.4** | `overrides` trong `pnpm-workspace.yaml` (chốt 27/07, chữa bug hai bản React ở Vitest) áp cho CẢ workspace. Sửa overrides để chiều mobile là mở lại đúng lớp bug đó. |

Nếu `expo-doctor` báo đỏ về gói khác, **đừng thêm vào `exclude` theo phản xạ**
— `expo-doctor` là trọng tài cho dependency của `apps/mobile` (ADR-0040 §7),
mỗi lần loại một gói khỏi tầm mắt của nó là bớt đi một lớp canh.

## 5. Những chỗ tưởng thiếu mà là cố ý

- **Không có `metro.config.js`.** Expo SDK 52+ tự lo monorepo và SDK 54+ chạy
  được pnpm isolated. 90 dòng `metro.config.js` của Nexora vá Nx + Windows —
  v2 không có cả hai (ADR-0040 §6). Đã đo: `expo export` bundle được cả iOS
  lẫn Android mà không cần file nào.
- **Không có `eas.json`, không có Maestro, không có icon tab.** Expo Go không
  cần EAS; E2E và icon chờ có màn hình thật (P5b).
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
  là sai bản chất).
