# Spec P5a — Template app mobile: khung xương Expo + vỏ điều hướng + `@tourism/mobile-ui`

08/09/2026 · mở phase **P5 (mobile)** của [lộ trình ADR-0001](../adr/0001-tech-stack.md#lộ-trình-sửa-1907--vertical-slice).
Nhánh `feat/p5a-mobile-template`. Quyết định kiến trúc đã chốt TRƯỚC spec này ở
[ADR-0040](../adr/0040-mobile-app-expo.md) (mới) cùng
[ADR-0001 §AMEND 1](../adr/0001-tech-stack.md#amend-1--08092026-p5a-sdk-5657-expo-go-thay-dev-build)
và [ADR-0017 §9](../adr/0017-web-session-better-auth.md) — đọc ba văn bản đó
trước, spec này **không lặp lại lý lẽ**, chỉ nói *xây gì* và *nghiệm thu thế nào*.

Không có migration. Không đụng `apps/api`, `apps/web`, `apps/admin`. Đụng:
`apps/mobile` (mới), `libs/mobile/ui` (mới), `libs/shared/i18n` (thêm copy),
`turbo.json`, `.github/workflows/ci.yml`.

Nếp làm việc giữ nguyên: một session thi công trên nhánh (không merge, không
push, không subagent, **không chạm hạ tầng sống** — CLAUDE.md §15), session gốc
review 8 mũi theo tầng rồi vá cụm và merge.

## 1. P5a dựng KHUNG, không dựng màn hình

Ranh giới này là thứ giữ cho nhánh không phình. P5a xong nghĩa là: app cài lên
điện thoại qua Expo Go, mở ra thấy 5 tab bấm qua lại được, mỗi tab là một màn
placeholder có tiêu đề và `EmptyState`, màu/chữ lấy từ `@tourism/tokens`, và
`pnpm gate` xanh với test thật.

**KHÔNG thuộc P5a** (và đừng làm lấn): nội dung màn hình thật, gọi API, auth
thật, ảnh, animation, bố cục theo `docs/navel/`. Đó là P5b trở đi.

Lý do tách như vậy: mọi thứ ở P5a là **quyết định một lần rồi sống mãi** (cây
route, ranh giới package, test runner, đường đi của token, ranh giới gate) —
làm sai thì P5b phải viết lại. Còn nội dung màn hình thì đằng nào cũng sửa
nhiều vòng theo mắt user (memory `design-by-visual-demo`), làm sớm là làm phí.

**`docs/navel/` là tham chiếu bố cục, KHÔNG phải bảng màu** (ADR-0040 §3). Ở
P5a nó gần như chưa dùng tới — nêu ra để session thi công **không** tự ý lấy
màu từ ảnh. Nó untracked cố ý (187 MB, `.git/info/exclude`): **không bao giờ
`git add`** (memory `khong-stage-docs-navel`).

## 2. Phạm vi — 7 task, 7 commit

| # | Task | Đầu ra |
| --- | --- | --- |
| **T1** | Scaffold `apps/mobile` + nối toolchain — **có CỔNG, xem §4.1** | app chạy, biome xanh, turbo thấy |
| **T2** | `libs/mobile/ui` + `ThemeProvider`/`useTheme` | package mới, theme đọc từ tokens |
| **T3** | Primitive `Screen`, `AppText` | 2 component + spec |
| **T4** | Primitive `Button`, `Card`, `EmptyState` | 3 component + spec |
| **T5** | Copy mobile vào `@tourism/i18n` | nhãn tab + tiêu đề màn + EmptyState |
| **T6** | Cây route expo-router | 12 route + spec |
| **T7** | CI step `bundle` + runbook + docs sweep | CI xanh, CHANGELOG, README |

Thứ tự bắt buộc: T1 → T2 → (T3, T4) → T5 → T6 → T7. T5 đứng trước T6 vì T6 đọc
nhãn từ i18n — viết ngược lại là đẻ ra chuỗi inline rồi phải gỡ (luật 7).

## 3. Cây file mục tiêu

```text
apps/mobile/
  app.json                 name "Nexora Travel" · slug nexora-travel · scheme nexora
  package.json             @tourism/mobile — scripts dev/dev:lan/bundle/typecheck/test/doctor
  tsconfig.json            extends expo/tsconfig.base
  jest.config.js           preset jest-expo
  .env.example             EXPO_PUBLIC_API_URL · EXPO_PUBLIC_WEB_URL   (commit)
  .env.local               bản thật của máy dev                        (gitignored)
  src/
    app/
      _layout.tsx          ThemeProvider + SafeAreaProvider + splash
      +not-found.tsx
      (tabs)/_layout.tsx   tab bar 5 tab, nhãn từ @tourism/i18n
      (tabs)/index.tsx     Home        (tabs)/explore.tsx   Explore
      (tabs)/saved.tsx     Saved       (tabs)/trips.tsx     Trips
      (tabs)/account.tsx   Account
      (auth)/_layout.tsx   stack, presentation modal
      (auth)/login.tsx     (auth)/register.tsx   (auth)/forgot-password.tsx
      tours/[slug].tsx     bookings/[code].tsx
    lib/env.ts             đọc EXPO_PUBLIC_*, throw khi thiếu
libs/mobile/ui/
  package.json             @tourism/mobile-ui
  src/index.ts
  src/lib/theme.ts  theme-provider.tsx  screen.tsx  app-text.tsx
  src/lib/button.tsx  card.tsx  empty-state.tsx        (+ .spec.tsx từng cái)
```

Cây route là **xương của Nexora** (5 tab + auth + tours/[slug] + bookings/[code]),
cố ý — đó là bố cục đã chạy được với chính domain này, và luật 10 nói thứ Nexora
có mà đây thiếu là thụt lùi.

## 4. Ràng buộc kỹ thuật đã đo — đừng đo lại

### 4.1 CỔNG tsgo × React Native (T1 dừng ở đây nếu đỏ)

Repo bắt tsgo (TypeScript 7.0.2); Expo SDK 57 ghim `typescript: ~6.0.3`. **Chưa
ai đo tsgo trên codebase RN.** T1 phải chạy `pnpm turbo run typecheck --filter=@tourism/mobile`
và:

- **Xanh** → đi tiếp bình thường, ghi một dòng vào CHANGELOG là đã đo.
- **Đỏ** → **DỪNG LẠI, báo user, không tự quyết.** Cấm lặng lẽ cấp cho
  `apps/mobile` một compiler riêng: đó đúng là kiểu lệch chuẩn mà ba lớp bảo vệ
  của CLAUDE.md dựng lên để chặn. Hướng xử lý (user chốt): AMEND ADR-0040 §7.

Gotcha đã biết từ đợt TS7 ngày 04/08: **tsgo đòi khai `types` tường minh trong
tsconfig** (xem CHANGELOG 04/08). Thử điều đó trước khi kết luận là đỏ.

### 4.2 Ma trận version — chép, đừng sáng tác

Ma trận `expo-template-default@57.0.22` (đọc npm 08/09): `expo@~57.0.20` ·
`expo-router@~57.0.19` · `react-native@0.86.3` · `react@19.2.3` ·
`react-native-screens@~4.26.0` · `react-native-safe-area-context@~5.7.0` ·
`expo-status-bar@~57.0.1` · `expo-splash-screen@~57.0.8` ·
`expo-constants@~57.0.17` · `expo-linking@~57.0.9`. Test:
`jest-expo@~57.0.5` + `@testing-library/react-native@14.0.1`.

`expo-doctor` là trọng tài, không phải "đồng bộ số với web" (ADR-0040 §7).

**KHÔNG cài** `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-device`,
`react-native-reanimated`, `react-native-gesture-handler`, `react-native-web`,
`react-dom` — template mặc định có, P5a chưa màn nào cần (ADR-0040 §*Đã cân
nhắc và loại*). Thêm khi P5b thật sự dùng.

### 4.3 Gỡ sạch ESLint mà scaffold sinh ra

`create-expo-app` kèm `eslint` + `eslint-config-expo` + `eslint.config.js`.
CLAUDE.md cấm tuyệt đối ESLint/Prettier trong repo này. Gỡ **cả** dependency
**lẫn** file config, rồi xác nhận bằng
`grep -rn "eslint\|prettier" apps/mobile/package.json` ra rỗng.

### 4.4 Metro và pnpm — không cấu hình gì

Docs Expo chính chủ: SDK 54+ chạy được pnpm isolated (bỏ `nodeLinker: hoisted`),
SDK 52+ tự lo monorepo. Nên: **không sửa `pnpm-workspace.yaml`**, và nếu tạo
`metro.config.js` thì nó **không được** chứa `watchFolders`,
`resolver.nodeModulesPath`, `extraNodeModules`, `disableHierarchicalLookup` —
docs Expo nói thẳng phải xoá bốn khoá đó. Tốt nhất: đừng tạo file cho tới khi
có lý do cụ thể.

**Không port `metro.config.js` của Nexora** — 90 dòng đó vá Nx đặt `projectRoot`
sai và Windows lệch hoa/thường ổ đĩa; v2 không có cả hai.

### 4.5 `@tourism/tokens/theme` là build artifact

`generated/theme.js` gitignored, sinh bởi
`pnpm turbo run build --filter=@tourism/tokens`. Turbo lo thứ tự cho
typecheck/test (`dependsOn: ^build`), nhưng **Metro lúc `expo start` thì không** —
máy chưa từng build tokens sẽ thấy Metro báo thiếu module. Ghi vào runbook.

### 4.6 Supply-chain gate của pnpm

Repo có `minimumReleaseAgeExclude` trong `pnpm-workspace.yaml`. Nếu bản Expo nào
mới quá bị cửa sổ `minimumReleaseAge` chặn, thêm exclude **theo đúng nếp các đợt
trước** (`next@16.3.0`, `fastify@5.12.1`…): ghim tên@version tường minh, kèm một
dòng comment nói vì sao.

### 4.7 Mạng dev: WSL NAT

Đo 08/09: `hostname -I` → `172.26.107.162`, không có `.wslconfig`. Điện thoại
LAN **không tới được** Metro trong WSL. `dev` = `expo start --tunnel` là mặc
định. Session thi công **không chạy** `dev` (user giữ dev server) — nghiệm thu
bằng `bundle`, `typecheck`, `test`.

## 5. Test bắt buộc

TDD trên logic thuần (luật 4), ≥80% trên code mới. Chạy bằng `jest-expo`, chỉ
trong `apps/mobile` + `libs/mobile/ui` (ADR-0040 §4).

| Vùng | Phải có test |
| --- | --- |
| `theme.ts` | map token → giá trị RN; đổi `colorScheme` thì đổi bảng màu; **không** giá trị nào là hex viết tay |
| `useTheme` | ném lỗi rõ nghĩa khi dùng ngoài `ThemeProvider` |
| `AppText` | mỗi bậc type scale lấy đúng số từ token, không hardcode `fontSize` |
| `Button` | 3 variant ra đúng màu token; `disabled` chặn `onPress`; có `accessibilityRole` |
| `Screen`, `Card`, `EmptyState` | render + nhận đúng token nền/viền/bo góc |
| `lib/env.ts` | thiếu biến → throw kèm tên biến; có đủ → trả nguyên giá trị |
| Cây route | mỗi màn render không nổ; tab bar hiện đủ 5 nhãn **đọc từ i18n**; `+not-found` render |
| i18n | mọi khoá mobile mới có giá trị, không rỗng |

**Một test phải canh đúng thứ dễ trôi nhất:** không component nào trong
`libs/mobile/ui` được chứa chuỗi hex. Viết một spec quét source của thư mục
`src/lib` bằng regex `#[0-9a-fA-F]{3,8}` và assert rỗng — cùng tinh thần
`check-admin-prerender.mjs`: luật nào người hay quên thì để máy canh.

## 6. Nghiệm thu ở session gốc (trước merge)

1. `pnpm gate:int` trọn (API tạm :3001 trên docker theo memory `gate-int-can-api-song`).
2. `pnpm turbo run bundle --filter=@tourism/mobile` xanh — **cái này gate không chạy** (ADR-0040 §5).
3. `pnpm exec expo-doctor` trong `apps/mobile` không có mục đỏ.
4. `grep -rn "eslint\|prettier" apps/mobile libs/mobile` rỗng.
5. `git status --short docs/navel` rỗng.
6. **User cầm điện thoại nghiệm thu**: `pnpm --filter @tourism/mobile dev`, quét
   QR bằng Expo Go, bấm qua 5 tab. Đây là bước duy nhất agent không làm thay được.

## 7. Đầu ra bắt buộc của session thi công

- 7 commit Conventional **tiếng Việt có dấu**, không AI attribution, không
  trailer `Co-Authored-By` (grep sau mỗi commit — memory `subagent-commit-trailer-check`).
- Entry `docs/CHANGELOG.md` ghi rõ **"CHƯA merge, chờ review session riêng"**,
  kèm kết quả CỔNG tsgo (§4.1) và mục **CÒN TREO**.
- `docs/README.md`: thêm spec này + ADR-0040 vào bản đồ, cập nhật hàng
  "P5 Mobile" ở bảng roadmap (đang là ⬜ chưa mở).
- **Không** `pnpm add` gì ngoài §4.2 mà không hỏi.
