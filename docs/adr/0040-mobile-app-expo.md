# ADR-0040 — App mobile Expo trong monorepo: SDK 57, Expo Go, jest-expo, ranh giới gate, màu đi qua cầu RN

- **Trạng thái:** Accepted (2026-09-08, P5a `feat/p5a-mobile-template`, ADR đi
  trước code)
- **Bối cảnh:** [spec P5a](../specs/2026-09-08-p5a-mobile-template-design.md).
  Mở phase P5 của [lộ trình ADR-0001](0001-tech-stack.md). Hiện trạng đo được
  08/09: `apps/mobile/` chỉ có `.gitkeep`, `libs/mobile/*` đã khai trong
  `pnpm-workspace.yaml` từ P0 nhưng rỗng.
- **Liên quan:** [ADR-0001](0001-tech-stack.md) §AMEND 1 (cùng ngày — SDK 56→57,
  Expo Go thay dev build) · [ADR-0011](0011-p3b-web-architecture.md) (cấu trúc
  `libs/mobile/*` tính từ P0) · [ADR-0013](0013-wuling-theme-tokens.md)
  (`rn-convert` là cầu sang mobile) · [ADR-0016](0016-web-data-layer.md) (tầng
  dữ liệu — mobile sẽ nối ở P5b) · [ADR-0017](0017-web-session-better-auth.md)
  §AMEND 9 (cùng ngày — auth mobile) · ADR-0037/0038 (trần + header, áp khi
  mobile bắt đầu gọi API thật).

## Bối cảnh

P0 đã đặt sẵn hai mảnh cho mobile rồi để đó 7 tuần: `pnpm-workspace.yaml` khai
`libs/mobile/*`, và `libs/shared/tokens/style-dictionary/build.mjs` sinh
`generated/theme.js` với comment nguyên văn *"React Native theme — hex colors +
dp radius, consumed by `@tourism/mobile-ui`"*. Nghĩa là **tên package và đường
đi của màu đã được quyết từ P0** — ADR này không phát minh lại, chỉ lấp vào.

Nexora có `apps/mobile` hoàn chỉnh (Expo SDK 54, expo-router 6, 5 tab + auth +
tours + bookings + legal, 24 spec jest-expo, `libs/mobile/ui` 15 primitive có
test, 4 flow Maestro, `eas.json`). Đó là mốc parity của luật 10 — nhưng nó cũng
mang theo 90 dòng `metro.config.js` vá Nx-trên-Windows mà v2 **không được port
theo quán tính**: tiền đề đã đổi (Turborepo + WSL ext4).

Ba ràng buộc thật của máy dev, đo 08/09 chứ không đoán:

1. **WSL ở chế độ NAT** — `hostname -I` ra `172.26.107.162`, default route
   `172.26.96.1`, không có `C:\Users\yuriv\.wslconfig`. Điện thoại trong LAN
   **không tới được** Metro chạy trong WSL. Nexora né được vì chạy Expo từ
   Windows native (`start-dev.ps1` set `REACT_NATIVE_PACKAGER_HOSTNAME`).
2. **Không có Mac, không có Android Studio trong WSL** — dev build tại chỗ
   không khả thi cho iOS và chưa sẵn cho Android.
3. **Freeze dependency 15/10/2026** — còn ~5 tuần. Thứ chọn hôm nay là thứ
   sống tới ngày bảo vệ.

## Quyết định

### 1. Expo SDK 57 + expo-router, chạy trên Expo Go

`expo@57.0.20` · `expo-router@57.0.19` · `react-native@0.86.3` — bản `latest`
trên npm ngày 08/09. ADR-0001 chốt SDK 56; dựng mới hôm nay mà nhận bản cũ hơn
một bậc là tự chuốc một lần nâng cấp nữa trước freeze. Đảo bằng
[ADR-0001 §AMEND 1](0001-tech-stack.md#amend-1--08092026-p5a-sdk-5657-expo-go-thay-dev-build).

**Chạy trên Expo Go**, không dev build. Hệ quả phải nói thẳng: Expo Go không
nạp được native module ngoài danh sách dựng sẵn, nên **Stripe PaymentSheet
không dùng được** — thanh toán trên mobile sẽ mở checkout web qua
`expo-web-browser`, đúng cách Nexora làm. Đây là nửa lời hứa của ADR-0001 bị
đảo, và nó đổi lấy: quét QR là chạy, không cần Mac / Android Studio / tài khoản
EAS / hạn mức build. Với một capstone cần **demo chạy được** chứ không cần bản
lên store, đó là đổi đúng chiều. Đường lên dev build vẫn để mở (§7 Hệ quả).

### 2. Hai package, ranh giới cứng với `@tourism/ui`

| Package | Vai trò |
| --- | --- |
| `apps/mobile` (`@tourism/mobile`) | App Expo — route, màn hình, nối API (P5b) |
| `libs/mobile/ui` (`@tourism/mobile-ui`) | Primitive RN dùng chung, đọc token |

`@tourism/mobile-ui` **cấm** phụ thuộc `@tourism/ui` — package đó là Base UI +
DOM, không có nghĩa gì trên RN. Dùng lại theo chiều ngang: `@tourism/tokens`
(màu/chữ), `@tourism/i18n` (copy tiếng Anh — luật 7 áp nguyên), `@tourism/contract`
(schema Zod, ở template mới dùng ở mức type).

Tách ui-lib **ngay từ template**, không đợi: Nexora chứng minh cụm này sẽ có 15
primitive. Để chúng mọc trong `apps/mobile` rồi bóc ra sau là đúng thứ refactor
mà một quyết định 10 phút hôm nay tránh được.

### 3. Màu và chữ đi qua cầu RN đã có — không hex nào trong mobile

`@tourism/tokens/theme` (`generated/theme.js`) là **nguồn duy nhất**: hex + dp
sinh bởi `rn-convert` từ **cùng file oklch** mà web ăn. `ThemeProvider` của
`@tourism/mobile-ui` là chỗ duy nhất `import` nó; mọi component lấy qua
`useTheme()`. CLAUDE.md #6 (tokens-only, không hex) vì thế áp cho mobile y
nguyên như web, và lời hứa của ADR-0013 — *"đổi brand = sửa MỘT file
tokens.mjs"* — từ nay phủ cả ba app.

`docs/navel/` (102 màn "Navel — Nature Travel", untracked, chỉ đọc) là **tham
chiếu bố cục và luồng**: cấu trúc màn, thứ tự thông tin, cách xếp thẻ/sheet/tab.
**Không phải bảng màu.** Bộ ảnh đó teal đậm + amber; brand v2 là Wuling. Lấy màu
từ ảnh là mở nhánh brand thứ hai phải giải trình trước hội đồng, đổi lấy thứ
duy nhất là "trông giống ảnh mẫu".

### 4. `jest-expo`, không phải Vitest — ngoại lệ đã có giấy phép từ P0

`jest-expo@57.0.5` + `@testing-library/react-native@14.0.1`. Đây **không phải
luật mới**: bảng toolchain ADR-0001 ghi *"Vitest (mobile giữ jest-expo)"* và
bảng toolchain CLAUDE.md ghi *"Vitest (mobile sau này: jest-expo)"* từ ngày
đầu. ADR này chỉ thi hành.

Lý do kỹ thuật giữ nguyên giá trị: preset RN chính chủ (transform Babel, mock
native module, điều kiện resolve `react-native`) chỉ `jest-expo` cung cấp.
Vitest + RN là glue không chính thức — dựng nó cách freeze 5 tuần là đổi rủi ro
lấy sự thuần khiết.

**Ranh giới cứng để ngoại lệ không lan:** Jest chỉ sống trong `apps/mobile` và
`libs/mobile/ui`. Không có config Jest ở root. Mọi package khác vẫn Vitest.

### 5. Ranh giới gate: `typecheck` + `test` vào gate, bundle Metro ra ngoài

Mobile khai `typecheck` + `test` như mọi package. `expo export` là task turbo
tên **`bundle`** — cố ý **không** đặt tên `build`, vì `pnpm gate` =
`turbo run build typecheck test` sẽ nuốt nó. CI chạy `bundle` ở step riêng.

Lý do: `gate` là vòng lặp TDD (chính CLAUDE.md #11 đã tách `gate` khỏi
`gate:int` theo đúng nguyên tắc này — thứ chậm không nằm trong vòng lặp nhanh).
Metro bundle tốn ~1–2 phút và `dependsOn: ^build` khiến nó chạy lại mỗi lần
**bất kỳ** package chung nào đổi.

**Đánh đổi phải nói thẳng, không giấu trong ngoặc:** từ nay "gate xanh" **không
còn** bảo chứng mobile bundle được. Lưới duy nhất là CI. Hệ quả thao tác: ai
chạm `apps/mobile` phải liếc đèn CI (CLAUDE.md #14 vốn đã bắt buộc sau mỗi push)
và có thể gọi tay `pnpm turbo run bundle --filter=@tourism/mobile`.

### 6. pnpm isolated + Metro tự lo monorepo — không vá gì cả

Docs Expo chính chủ: **SDK 54+ chạy được pnpm isolated install** (bỏ hẳn
`nodeLinker: hoisted`), và **SDK 52+ tự cấu hình Metro cho monorepo** — nếu
`metro.config.js` còn `watchFolders` / `resolver.nodeModulesPath` /
`extraNodeModules` / `disableHierarchicalLookup` thì phải **xoá** chúng đi.

Nên: `pnpm-workspace.yaml` **không đổi**, và v2 **không port** 90 dòng
`metro.config.js` của Nexora. Toàn bộ khối đó vá hai thứ v2 không có: Nx đặt
`projectRoot` sai chỗ, và Windows viết hoa/thường ổ đĩa lệch nhau. Port theo
quán tính là mang nợ của người khác.

### 7. React 19.2.3 ở mobile, 19.2.4 ở web — cố ý, và có trọng tài

Template SDK 57 ghim `react: 19.2.3` và `typescript: ~6.0.3`; repo đang ở React
19.2.4 và TS 7.0.2 (tsgo). pnpm cô lập `node_modules` nên hai bản React sống
cạnh nhau không đụng.

**Trọng tài cho dependency của `apps/mobile` là `expo-doctor`**, không phải
"đồng bộ số với web". Ma trận Expo là thứ quyết định app có chạy trên Expo Go
hay không; kéo React lên 19.2.4 cho đẹp mắt là đổi một con số lấy một lớp rủi
ro không ai đo. Script `doctor` có sẵn để chạy.

**TypeScript thì chưa ai đo.** Toolchain repo bắt tsgo (CLAUDE.md), nhưng chưa
có tiền lệ tsgo typecheck một codebase React Native. Vì vậy **task đầu tiên của
session thi công là một spike có cổng quyết định**: tsgo nuốt được thì mobile
`typecheck` như mọi package; **không nuốt được thì DỪNG, báo user, viết AMEND** —
cấm lặng lẽ cấp cho `apps/mobile` một compiler riêng, vì đó đúng là kiểu lệch
chuẩn mà ba lớp bảo vệ trong CLAUDE.md dựng lên để chặn.

### 8. Vòng lặp dev đi qua tunnel (vì WSL NAT)

`dev` = `expo start --tunnel` làm **mặc định**, không phải phương án dự phòng —
với WSL NAT thì LAN là thứ không chạy, còn tunnel là thứ chạy. Giữ thêm
`dev:lan` cho ngày user bật mirrored networking (việc trên Windows, thuộc về
user; runbook ghi cả hai đường).

Agent **không tự bật/tắt dev server** — user giữ. Đây là quy ước sẵn có của dự
án, ADR nhắc lại vì phase mobile là phase đầu tiên mà "chạy thử" nghĩa là cầm
điện thoại lên.

### 9. Env theo đúng gotcha env của repo — và mobile không giữ bí mật nào

`apps/mobile/.env.local` (dev, gitignored) + `.env.example` (commit) — đúng
quy ước đã chốt 19/07 và Expo CLI đọc `.env.local` sẵn. Hai biến:
`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL`.

**Mọi biến `EXPO_PUBLIC_*` nằm trong bundle JS và đọc được bằng tay.** Không có
secret nào được phép xuất hiện ở `apps/mobile` — kể cả `INTERNAL_READ_KEY`
(thứ web dùng để được miễn trần đọc, ADR-0037 AMEND 3). Mobile là client công
khai, cùng hạng với browser.

## Đối chiếu Nexora (luật 10 — phân loại)

Rà **cả hai tầng** như luật 10 đòi: (a) tính năng, (b) hạ tầng xuyên suốt.

| Hạng mục | Nexora | v2 (template này) | Phân loại |
| --- | --- | --- | --- |
| Cây route 5 tab + auth + tours + bookings | Có, đầy đủ nội dung | Có **khung**, màn là placeholder | thụt lùi **có kế hoạch** — P5b lấp nội dung |
| `libs/mobile/ui` | 15 primitive có test | 6 primitive có test | thụt lùi có kế hoạch — mọc theo nhu cầu P5b |
| Test runner | jest-expo 54 | jest-expo 57 | tương đương (kế thừa) |
| Token → RN | `@tourism/tokens` + rn-convert | y hệt, cầu đã dựng từ P0 | tương đương (kế thừa) |
| `metro.config.js` | 90 dòng vá Nx + Windows | gần rỗng (Metro tự lo) | **v2 tốt hơn** — tiền đề đổi |
| Package manager | pnpm + Nx | pnpm isolated, không `nodeLinker` | **v2 tốt hơn** |
| Auth | `@supabase/supabase-js` + user mirror | `@better-auth/expo` (ADR-0017 §9) | **v2 tốt hơn** — một bảng user, hết `USER_NOT_SYNCED` |
| Thanh toán | hosted checkout | hosted checkout (PaymentSheet hoãn) | tương đương — và ADR-0001 AMEND 1 ghi lý do |
| E2E Maestro (4 flow) | Có | **Chưa** | **cố ý hoãn** — chưa có màn hình thật để chạy qua; mở lại khi P5b xong |
| `eas.json` (3 profile) | Có | **Chưa** | **cố ý bỏ** — Expo Go không cần EAS; thêm khi (nếu) lên dev build |
| Dev loop qua mạng | `start-dev.ps1` (Windows LAN) | `--tunnel` (WSL NAT) | làm khác mà tương đương — tiền đề mạng đổi |
| Bundle trong gate | Nx target `build` cache | turbo task `bundle`, ngoài gate | làm khác — §5 ghi rõ đánh đổi |
| `react-native-svg-transformer` | Có | **Chưa** | cố ý hoãn — chưa có asset SVG nào |

## Hệ quả

- **P5b có thể bắt đầu bằng bố cục, không phải bằng hạ tầng.** Template này
  đóng đúng phần "dựng khung": route, theme, test runner, gate, env.
- **Đường lên dev build vẫn mở.** Ngày cần Stripe PaymentSheet (hoặc bất kỳ
  native module nào), việc phải làm là: thêm `eas.json`, chạy EAS Build hoặc
  build Android tại chỗ, và **không** phải viết lại route/theme/test nào — đó
  chính là lý do chọn Expo (dev build và Expo Go dùng chung một codebase).
- **Ngoại lệ Jest được đóng khung.** Repo từ nay có hai test runner; ranh giới
  ở §4 là thứ giữ cho nó không lan. Ai thêm Jest ngoài `*/mobile/*` là vi phạm.
- **`pnpm gate` yếu đi một chút** (§5) — bù bằng CI + thói quen liếc đèn.
- **`docs/navel/` vẫn untracked, vẫn chỉ đọc.** 187 MB ảnh cố ý ngoài git
  (`.git/info/exclude`); ADR này không đổi điều đó và session thi công không
  được `git add` nó.

## Đã cân nhắc và loại

| Phương án | Vì sao loại |
| --- | --- |
| **Expo SDK 56** (đúng ADR-0001 nguyên văn) | Dựng mới hôm nay thì bản `latest` là bản sống qua freeze; nhận 56 là hẹn một lần nâng nữa trong 5 tuần còn lại. ADR sai thì sửa ADR, không bẻ code theo ADR cũ. |
| **Dev build ngay từ template** | Mở khoá PaymentSheet nhưng đòi Mac (iOS) hoặc Android Studio (Android) hoặc hạn mức EAS — cả ba đều chưa có. Đổi thứ chắc chắn cần (demo chạy được) lấy thứ chưa tới lượt (thanh toán native). |
| **Vitest cho mobile** ("một tool cho mỗi việc") | Preset RN chính chủ chỉ có ở jest-expo; glue không chính thức sát freeze. Và ngoại lệ này đã được ADR-0001 + CLAUDE.md cấp phép từ đầu, không phải phát sinh. |
| **`expo export` vào `pnpm gate`** | Giữ trọn vẹn lời hứa "gate xanh = mọi thứ bundle được", nhưng bắt mọi vòng lặp TDD của **mọi** package trả ~1–2 phút Metro. Chọn giữ vòng lặp nhanh và nói rõ lỗ hổng thay vì giấu nó. |
| **Port `metro.config.js` của Nexora** | Vá cho Nx + Windows; v2 là Turborepo + WSL ext4 và Expo SDK 52+ tự lo. Port theo quán tính = nhận nợ của người khác. |
| **Lấy bảng màu `docs/navel/` làm brand mobile** | Mở nhánh brand thứ hai (teal+amber vs Wuling) phải giải trình trước hội đồng, phá lời hứa một-nguồn của ADR-0013, đổi lấy đúng một thứ: giống ảnh mẫu. Mượn bố cục là đủ. |
| **`@expo/ui`, `expo-glass-effect`, `expo-symbols`** (template mặc định có) | Chưa màn nào cần; mỗi dep thêm vào là một thứ phải đứng vững qua freeze. Thêm khi P5b thật sự dùng. |
| **`nodeLinker: hoisted`** | Docs Expo nói SDK 54+ không cần; đổi cách link `node_modules` của **cả repo** để chiều một app là cái giá sai. |
