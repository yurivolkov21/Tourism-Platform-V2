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

## AMEND 1 — 16/09/2026 (P5b-1, cụm auth): dependency, seam `AuthActions`, luật lỗi ba kênh

Bối cảnh: [spec P5b-1](../specs/2026-09-16-p5b-auth-wireframe-design.md). Template
P5a chỉ có màn giữ chỗ; đợt này dựng 17 khung TĨNH của cụm auth và CHƯA nối API —
phần nối do một thành viên khác làm sau, nên ranh giới phải nằm trong code chứ
không nằm trong lời dặn.

1. **Năm dependency được cấp phép** — đúng nhánh "thêm khi P5b thật sự dùng" ở mục
   *Đã cân nhắc và loại*: `expo-linear-gradient` (dải mờ dưới ảnh đầu trang; RN có
   `experimental_backgroundImage` nhưng còn là API thử nghiệm), `@expo/vector-icons`
   (bộ Feather — chính bộ mà lucide của web mọc ra, kèm chữ G của Google),
   `expo-font` cùng `@expo-google-fonts/literata` và `@expo-google-fonts/archivo`
   (chữ brand như web). Tất cả chạy trong Expo Go, không kéo native module ngoài
   danh sách dựng sẵn; `expo-doctor` vẫn là trọng tài (§7).
   **Vẫn KHÔNG cài:** `expo-image` (`Image` của RN đủ cho ảnh remote),
   `expo-web-browser` (link pháp lý mở bằng `Linking`), `react-native-svg` +
   `lucide-react-native` (Metro không lược icon thừa nên kéo cả bộ vào bundle),
   thư viện form, toast hay pager.
2. **Font không đi qua cầu token.** `rn-convert` chỉ mang màu, bo góc và type scale
   (§3, ADR-0013), không mang font family — nên `@tourism/mobile-ui` khai map family
   ngay tại theme (Literata cho tiêu đề, Archivo cho thân). Cỡ chữ vẫn đọc từ token,
   và luật "không hex viết tay" của §3 giữ nguyên: màu dải mờ suy từ token qua hàm
   `withAlpha`, không gõ chuỗi hex.
3. **Màn tĩnh nối hạ tầng qua một interface.** Màn gọi `AuthActions` (7 method) lấy
   từ provider ở layout gốc; đợt này cấp bản giả lập. Người làm hạ tầng viết bản
   `@better-auth/expo` (ADR-0017 §9) rồi đổi provider, không sửa màn nào. Cờ "đã xem
   onboarding" đi qua `OnboardingStore` cùng khuôn.
4. **Lỗi hiển thị theo ba kênh, và một hàm quyết kênh:** dưới ô (lỗi gắn được vào
   ô) · khung ngay trên nút chính (không gắn được nhưng vẫn thử lại được) · trạng
   thái cả màn (màn hết dùng được). Kênh dựa trên `fieldOfAuthError` dùng chung ở
   [ADR-0042](0042-shared-client-rules-core.md).
5. **Route `/dev/gallery` chỉ sống khi `__DEV__`** — chỗ xem đủ các khung và trạng
   thái trên máy thật mà không phải gõ dữ liệu; bản phát hành không có đường vào.
6. **Vào app không cần đăng nhập:** splash → onboarding (chỉ lần đầu) → Home với tư
   cách khách. Nhóm `(auth)` vẫn là modal như P5a, mở khi khách chạm việc cần tài khoản.

**Hệ quả:** ranh giới gate giữ nguyên (§5 — `bundle` vẫn ngoài `pnpm gate`); runbook
dev đổi bước build sang `pnpm turbo run build --filter=@tourism/mobile^...` vì Metro
cần `dist` của `tokens`, `i18n` và `core`.

## AMEND 2 — 21/09/2026: LAN trở lại làm mặc định (đảo §8)

**Tiền đề của §8 đã hết hiệu lực.** §8 chọn tunnel làm mặc định vì đúng một sự
thật của máy: WSL chạy ở chế độ NAT nên điện thoại trong LAN không tới được
Metro. Ngày 14/09/2026 máy dev dựng lại sang **Windows native** — Metro nay chạy
thẳng trên Windows, điện thoại cùng mạng tới được như mọi dự án Expo bình
thường. Lý do duy nhất khiến tunnel thành mặc định không còn.

**Quyết định:** `dev` = `expo start` (LAN). Thêm `dev:tunnel` = `expo start
--tunnel` cho ba ca còn cần: máy và điện thoại khác mạng, mạng công ty chặn
client-to-client, hoặc quay lại làm việc trong WSL. `dev:lan` giữ làm bí danh
của `dev` để lệnh đã ghi trong spec 08/09 (bản ghi lịch sử, không sửa được)
vẫn chạy.

**Cái được:** hết phụ thuộc `@expo/ngrok` — gói cài toàn cục, không nằm trong
kho mã, và Expo CLI dừng lại hỏi y/n khi thiếu nó, làm người chạy lệnh ngồi
nhìn màn hình đứng im. Bundle qua LAN cũng nhanh hơn hẳn và không cần Internet.

**Cái mất:** người chạy phải để máy và điện thoại cùng mạng, và tường lửa
Windows phải cho Node nhận kết nối vào. Đổi lấy tốc độ thì đáng.

Đây là quay về đúng đường Nexora đã đi (`start-dev.ps1` set
`REACT_NATIVE_PACKAGER_HOSTNAME`, chạy Expo từ Windows native) — bảng đối chiếu
luật 10 ở trên xếp mục này vào "làm khác mà tương đương vì tiền đề mạng đổi";
nay tiền đề đổi lần thứ hai và hai bên gặp lại nhau.

Nợ này do CHANGELOG 16/09 ghi nhận, trả ngày 21/09 trong đợt rà soát tài liệu.

## AMEND 3 — 24/09/2026 (P5b-2 T7, D5): `react-native-gesture-handler` (KHÔNG `reanimated`)

Bối cảnh: [handoff P5b-2](../handoff/mobile-browse-handoff.md) T7 (D5 — trình
xem ảnh). Bản dựng đầu (24/09, cùng ngày) CỐ Ý bỏ chụm-để-phóng-to và
vuốt-xuống-để-đóng — lý do ghi trong doc comment
`features/tour-detail/photo-viewer.tsx` lúc đó: `PanResponder` lõi (RN core,
đã dùng cho `BottomSheet`) không đáng tin cho một bề mặt có HAI gesture cạnh
tranh (vuốt ngang đổi ảnh vs vuốt dọc đóng), và web cũng chưa làm zoom
(`tourDetail.gallery.zoomIn` — nợ A12) nên đây không phải thụt lùi. User yêu
cầu làm đủ trong phiên rà nợ treo cùng ngày.

### Quyết định

**Thêm MỘT dependency: `react-native-gesture-handler@~2.32.0`** (bản SDK 57
tương thích, cài qua `npx expo install` — trọng tài vẫn là `expo-doctor`, §7).
Chạy được trong **Expo Go** (§1) — native module NẰM SẴN trong danh sách Expo
Go dựng sẵn (bản thân `expo-router`/`@react-navigation` đã phụ thuộc gián
tiếp nó cho stack navigator mặc định), khác các thư viện dev-build-only mà §1
đã loại.

**THỬ rồi BỎ `react-native-reanimated@4.5.1`.** `npx expo install` chọn bản
này là "SDK 57 tương thích", nhưng nó đòi
`react-native-worklets@0.10.x` (`peerDependencies` của chính gói, đọc
`package.json` không đoán) trong khi cây phụ thuộc của `@expo/ui`
(kéo theo qua `expo-router`) lại tự kéo `react-native-worklets@0.12.1` — hai
bản khác nhau cùng sống trong cây, và `react-native-reanimated` tự chặn lúc
KHỞI TẠO module bằng `assertWorkletsVersion()`, ném lỗi *"is not compatible
with installed version of Worklets"*. Đây là lỗi RUNTIME THẬT (native, không
phải mock Jest) — dò bằng cách chạy thử `npx jest photo-viewer` sau khi cài,
lỗi hiện ngay ở bước `require`, TRƯỚC khi chạm test nào. Ghim tay
`react-native-worklets@0.10.1` để khớp reanimated thì gãy tiếp ở babel plugin
của chính worklets 0.10.x (thiếu `@babel/traverse` truy cập được qua cây pnpm
isolated) — hai lớp vỡ liên tiếp trong cùng một cặp gói, không phải một lần
xui. Không đáng mạo hiểm một tính năng PHỤ gần freeze 15/10 khi không có máy
thật để xác nhận runtime.

**`GestureDetector` chạy được KHÔNG cần reanimated** — thiếu babel plugin của
reanimated, gesture-handler tự rơi về gọi callback (`onUpdate`/`onEnd`…) như
hàm JS thường (không phải worklet chạy trên UI thread), driving
`Animated.Value` LÕI RN (đúng thứ `BottomSheet` đã dùng, `useNativeDriver:
true` cho các thuộc tính transform). Mất phần mượt-trên-UI-thread của
reanimated, không mất khả năng nhận diện/trọng tài gesture — thứ D5 thật sự
cần.

**`GestureHandlerRootView` bọc HAI nơi**, không chỉ gốc app:

1. `RootLayout` VÀ `ErrorBoundary` ở `app/_layout.tsx` — hai cây riêng (§ export
   `ErrorBoundary` không đi qua `RootLayout`), thiếu một trong hai là gesture
   không hoạt động đúng trên đường lỗi.
2. Bên TRONG `Modal` của `PhotoViewer` — `Modal` của RN dựng MỘT root native
   riêng, tách khỏi cây app chính; `GestureHandlerRootView` ở `_layout.tsx`
   không với vào được bên trong nó. Cùng lý do `BottomSheet` phải tự lo
   `Pressable`/`PanResponder` của chính nó thay vì nhờ context ngoài.

**Cử chỉ dựng bằng `Gesture.Pinch()` + `Gesture.Pan()` của gesture-handler,
composed qua `Gesture.Simultaneous`** (không dùng lại `PanResponder` cho D5) —
đây chính là thứ gesture-handler được viết ra để làm: trọng tài nhiều gesture
tranh chấp trên cùng bề mặt (vuốt ngang đổi ảnh của `ScrollView`
`pagingEnabled` vs chụm hai ngón vs vuốt dọc đóng), thứ mà bản dựng đầu đã từ
chối tự làm bằng `PanResponder`. Mỗi gesture khai `.runOnJS(true)` tường minh
— không cài reanimated nên không có worklet, để mặc định tự đoán thì
gesture-handler tự cảnh báo *"some callbacks are worklets and some are not"*.

**Jest cần setup CHÍNH THỨC của gói:** `apps/mobile/jest.setup.js` thêm
`import 'react-native-gesture-handler/jestSetup'` — thiếu dòng này thì
`GestureHandlerRootView` gọi `RNGestureHandlerModule.install()` (native thật,
không có trong Jest) và vỡ test.

### Hệ quả

- **Cần rebuild native SAU KHI cài** — `react-native-gesture-handler` có mã
  native, Expo Go cài sẵn nên KHÔNG cần `expo prebuild`/dev build riêng cho
  capstone này; nhưng Metro/Expo Go phải RESTART (không phải Fast Refresh) để
  nạp lại danh sách native module. Runbook: `expo start -c` (xoá cache) sau
  lượt cài này.
- **`expo-doctor` đã chạy lại sau khi cài** — vẫn 20/21 (1 fail cũ, lệch bản
  patch 4 gói `expo`/`expo-constants`/`expo-linking`/`expo-router`, KHÔNG liên
  quan gói mới — xem
  [docs/analysis/2026-09-24-mobile-browse-screens-status.md](../analysis/2026-09-24-mobile-browse-screens-status.md)).
- **Không đổi ranh giới gate** (§5) — gói chạy được trong Expo Go, không kéo
  theo dev build/EAS nào.
- **Animation không chạy trên UI thread** — đánh đổi đã nói ở trên. Nếu sau
  này D5 (hoặc chỗ khác) cần animation mượt khi JS thread bận, quay lại xét
  reanimated là hợp lý, nhưng phải giải quyết xung đột `react-native-worklets`
  ở TRÊN trước (khả năng cao là chờ `@expo/ui` (hoặc `expo-router`) lên bản
  đồng bộ `react-native-worklets`, không phải việc tự vá trong app này).

### Đã cân nhắc và loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ nguyên (không zoom/dismiss) | Đã là bản dựng đầu; user yêu cầu làm đủ hôm nay — mục "Đã cân nhắc và loại" của §1 bảng gốc ghi rõ nguyên tắc "thêm khi P5b thật sự dùng", và D5 giờ thật sự cần. |
| Tự viết pinch bằng `PanResponder` (đo khoảng cách hai `touches[]`) | Né được dependency mới, nhưng chính doc comment bản dựng đầu đã từ chối hướng này vì phải tự trọng tài NHIỀU gesture cạnh tranh tay — đúng thứ gesture-handler làm sẵn, và tái phát minh nó là rủi ro bug cao hơn phần dependency thêm vào. |
| `react-native-reanimated@4.5.1` (bản `npx expo install` chọn) | Xung đột `react-native-worklets` với cây phụ thuộc của `@expo/ui` — hai bản (`0.10.x` reanimated đòi vs `0.12.1` cây kéo theo) sống cùng lúc, reanimated tự chặn lúc khởi tạo. Ghim tay `0.10.1` thì gãy tiếp ở babel plugin của chính worklets (thiếu `@babel/traverse`). Chi tiết ở "Quyết định" trên. |
| `react-native-reanimated@3.x` (bản cũ hơn, không cần `react-native-worklets` riêng) | Né được xung đột trên (reanimated 3 tự mang JSI, không tách gói worklets), nhưng lệch khỏi bản `npx expo install` coi là "SDK 57 tương thích" — đổi rủi ro version cũ lấy né một xung đột mà bản thân `Gesture.Pinch/Pan` (không cần reanimated) đã giải quyết được với chi phí thấp hơn nhiều. Không đáng cho một tính năng phụ. |
