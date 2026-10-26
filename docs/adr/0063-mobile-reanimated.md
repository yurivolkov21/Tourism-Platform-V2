# ADR-0063 — App mobile dùng `react-native-reanimated` cho chuyển động chạy theo ngón tay và theo layout

- **Trạng thái:** Proposed (2026-10-26) — **viết SAU khi code đã chạy** trên nhánh
  `feat/mobile-m3-surfaces`, trái luật 5 (ADR đi trước code). Chờ user duyệt; nếu không duyệt
  thì gỡ theo mục "Đường lùi" cuối ADR. Quyết định này đảo [ADR-0040](0040-mobile-app-expo.md)
  AMEND 3 (KHÔNG cài `reanimated`).
- **Bối cảnh:** đợt làm mượt giao diện app mobile 25–26/10, chạy thử trên máy thật
  (Galaxy S24 Ultra, Expo Go). Không có spec riêng: yêu cầu đến từng lượt từ user, mỗi thay đổi
  có test.
- **Liên quan:** [ADR-0040](0040-mobile-app-expo.md) AMEND 3 và AMEND 4 (lịch sử bỏ `reanimated`
  và vá `@babel/traverse` cho `react-native-worklets`) · [ADR-0001](0001-tech-stack.md) AMEND 3
  (freeze 31/10/2026) · [ADR-0055](0055-mobile-data-layer.md) (tầng dữ liệu màn mobile).

## Bối cảnh

**Vì sao trước đây bỏ.** ADR-0040 AMEND 3 (24/09) thử `react-native-reanimated@4.5.1` cho trình
xem ảnh và gặp hai bản `react-native-worklets` sống cùng lúc trong cây pnpm: `0.10.1` mà
Reanimated đòi, và `0.12.1` mà `@expo/ui` kéo theo. Reanimated tự chặn lúc khởi tạo, nên app
vỡ ở runtime thật. Quyết định lúc đó: bỏ Reanimated, dùng `react-native-gesture-handler` với
callback JS (`.runOnJS(true)`) và `Animated` của React Native.

**Vì sao nay cần.** Các chuyển động còn lại của app đều đụng cùng một giới hạn của `Animated` lõi:
chiều cao, bề rộng, màu và góc bo **không chạy được bằng native driver**, nên chạy trên luồng JS
mỗi khung hình. Đo trên máy thật (26/10): mở và thu từng ngày của Itinerary giật rõ khi tour có
nhiều ngày, còn tour một ngày thì không. Đã thử hai hướng không cần thư viện mới và cả hai thất
bại:

- `LayoutAnimation` (cấu hình `create(220, easeInEaseOut, opacity)` của `animateNextLayout`):
  trên máy của user nội dung bật ra tức thì, không có chuyển động nào.
- Tách từng ngày thành `memo` để chỉ dựng lại hai hàng: giảm phần dựng lại nhưng chiều cao vẫn
  tính lại layout mỗi khung hình trên JS, nên vẫn giật.

**Rào cản cũ nay đã hết.** Cài trực tiếp cả hai gói đúng bản Expo SDK 57 gắn với Expo Go khiến
`@expo/ui` phân giải peer `react-native-worklets` về cùng một bản. Đo 26/10 trên `pnpm-lock.yaml`:
mỗi gói còn **đúng một** phiên bản (`react-native-reanimated@4.5.1`, `react-native-worklets@0.10.1`),
và `npx expo install --check` báo "Dependencies are up to date" (không cảnh báo hai gói này).

## Quyết định

### 1. Cài và ghim đúng bản Expo gắn với Expo Go

- `apps/mobile`: `react-native-reanimated` **4.5.1** và `react-native-worklets` **0.10.1**, ghim
  tuyệt đối (không `~`, không `^`) vì phần native trong Expo Go là bản cố định; lệch một trong hai
  là app chết lúc khởi tạo (đúng lỗi AMEND 3 đã ghi).
- `libs/mobile/ui`: khai hai gói ở `peerDependencies` (`*`) và `devDependencies` (cùng bản ghim) vì
  thư viện UI tự dùng Reanimated, không chỉ app.
- Nâng cấp **chỉ qua `npx expo install`**. Không nâng tay từng gói, không nâng sang 4.6 hoặc
  worklets 0.12 dù có sẵn trong registry.
- `packageExtensions` của `react-native-worklets` (`@babel/traverse`, ADR-0040 AMEND 4) giữ nguyên.
- Cùng đợt, `npx expo install --fix` nâng bản vá của tám gói Expo (`expo` 57.0.31, `expo-router`
  57.0.29, `expo-constants`, `expo-dev-client`, `expo-linking`, `expo-network`,
  `expo-splash-screen`, `jest-expo`). `libs/mobile/ui` phải nâng `expo` và `jest-expo` theo: để lệch
  thì hai bản `expo` cùng tồn tại và hàng chục suite Jest vỡ ở `getDevServer`.

### 2. Phạm vi dùng: chuyển động theo ngón tay và theo layout

| Chỗ | Dùng |
| --- | --- |
| `Collapsible` (Itinerary ở trang tour và ở chuyến đã mua, "Good to know") | chiều cao trên luồng UI, độ mờ bằng lớp riêng |
| `ExitCollapse` (gỡ thẻ khỏi Saved) | co chiều cao và mờ trên luồng UI |
| `SwipeToRemove` (vuốt trái xoá thẻ Saved) | `Gesture.Pan` kèm lò xo |
| Trình xem ảnh toàn màn | pinch, pan, double-tap, vuốt xuống đóng, đều là worklet |
| Cuộn tour detail | `useAnimatedScrollHandler`: parallax ảnh bìa, header gọn, hàng tab dính |
| Vuốt ngang đổi tab ở tour detail, chấm báo ảnh bìa | `Gesture.Pan`, shared value cuộn ngang |
| Thanh step, dot onboarding, thanh sao, `SegmentedControl`, viền `TextField`, gạch dưới tab | bề rộng, màu, góc bo trên luồng UI; chỗ có chuyển đổi vị trí dùng lò xo |
| `CountUpText` | `TextInput` chỉ đọc, `useAnimatedProps` ghi chữ từ luồng UI |
| `Presence` (banner lỗi) | `Keyframe` `entering`/`exiting` |
| "Read more" ở Explore | `LinearTransition` |
| Bottom sheet theo bàn phím | `useAnimatedKeyboard`, **chỉ iOS** (mục 4) |

### 3. Những gì giữ nguyên `Animated` của React Native

Mọi chuyển động chỉ cần `transform` và `opacity` vẫn chạy bằng native driver của RN, vì đã mượt và
đổi sang Reanimated chỉ thêm rủi ro: các primitive trong `motion.tsx` (`FadeIn`, `PopIn`, `Pulse`,
`Shake`, `PressableScale`), thanh tab dưới, thanh vùng Home, parallax ảnh thẻ, carousel Home
(thu phóng theo `scrollX` đã có sẵn). Bottom sheet giữ `PanResponder` và tween riêng vì kéo tay
nắm đã chạy native driver và có test ngưỡng; chỉ phần bàn phím dùng Reanimated.

### 4. Hook chiếm quyền inset chỉ được chạy khi cần

`useAnimatedKeyboard` trên Android chiếm quyền xử lý inset của cửa sổ. Bản đầu đặt hook trong
`BottomSheet` (luôn được dựng ở mọi màn có sheet, kể cả khi đóng) làm vùng an toàn đổi thành
trắng (26/10). Nay hook nằm trong component con `IosKeyboardAvoider`, chỉ dựng khi nền tảng là iOS
**và** tấm đang mở (`Modal` chỉ có con lúc `mounted`). Luật chung: hook của Reanimated nào can
thiệp cửa sổ hay inset thì phải bọc trong component chỉ dựng lúc cần.

### 5. Jest dùng bản thay thế tối giản

Reanimated và worklets chạy native nên không nạp được ở Node. `expo-router/testing-library` tự
`jest.mock('react-native-reanimated')` bằng `react-native-reanimated/mock` và khi bản đó hỏng thì
trả `{}`. Cách xử lý: ánh xạ **hai** tên qua `moduleNameMapper` ở `apps/mobile/jest.config.js` và
`libs/mobile/ui/jest.config.js`: `react-native-reanimated` về `jest/reanimated-entry.js` và
`react-native-reanimated/mock` về `jest/reanimated-mock.js`. Hai tên **không được** trỏ cùng một
file, vì mock sẽ tự gọi lại chính nó. Mock chỉ đủ API đã dùng; thêm API mới thì thêm vào mock.

### 6. `AuroraGradient`: gradient tĩnh kèm nhiễu chống vỡ mảng

Component nền "giao thoa màu" ở `libs/mobile/ui/src/lib/aurora-gradient.tsx` (onboarding, đăng nhập,
màn đặt tour thành công, thẻ đếm ngược). Hai gradient chéo ngược hướng pha từ token (`primary`,
`secondary`, `primary-emphasis`), mỗi lớp 50%, **đứng yên** (user chọn bỏ chuyển động sau khi xem
thử). Gradient nhạt (alpha 0,12 đến 0,45) trên màn 8 bit bị vỡ thành mảng (banding), nên thêm một
lớp nhiễu đen trắng 256x256 (`libs/mobile/ui/assets/aurora-noise.png`, độ mờ 0,025) lát kín bằng
nhiều `Image` 96dp. Không dùng `resizeMode: 'repeat'`: trên Android nó chỉ vẽ một ô ở góc. Ảnh
nhiễu sinh bằng script xác định (hạt giống cố định) nên luôn giống nhau.

## Đã cân nhắc và loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ JS driver, tối ưu thêm | Chiều cao, màu, góc bo không có native driver. Đã thử `memo`: giảm dựng lại nhưng layout vẫn tính mỗi khung hình. |
| `LayoutAnimation` | Đã thử trên máy thật: không chạy (cấu hình chỉ có `opacity`, và nền tảng có thể bỏ qua). Không kiểm chứng được từ Jest. |
| Bỏ animation chiều cao, chỉ fade nội dung | Chạy mượt nhưng bố cục nhảy tức thì; user muốn kiểu mở dần. Giữ làm đường lùi nếu Reanimated hỏng trên máy khác. |
| `react-native-reanimated@3.x` | Lệch bản `expo install` coi là tương thích SDK 57 (đã loại ở AMEND 3). |
| Nâng lên 4.6 và worklets 0.12 | Lệch phần native của Expo Go, app chết lúc khởi tạo. |
| Thư viện đồ hoạ (Skia) cho mesh gradient | Dependency mới nặng cho một hiệu ứng trang trí; cross-fade hai gradient tĩnh cho kết quả gần giống. |

## Hệ quả

- **Dependency mới trước freeze 31/10.** Reanimated, Worklets và tám bản vá Expo vào trước mốc;
  sau 31/10 không nâng nữa (ADR-0001 AMEND 3).
- **Build thật phải dựng lại native.** Expo Go chạy ngay. Dev build (`expo-dev-client`) và EAS
  phải build lại vì Reanimated và Worklets là module native.
- **Mock Jest không kiểm chứng chuyển động.** Test xanh chỉ chứng minh logic và cây dựng, không
  chứng minh độ mượt hay cử chỉ. Mỗi chỗ phải thử tay trên máy.
- **`react-native-gesture-handler` đổi đường chạy.** Có Reanimated thì gesture-handler tự nối vào
  nó: các callback cử chỉ phải là worklet (hàm gọi trong đó cần `'worklet'`: `shouldDismissDrag`,
  `clampZoomScale`). Comment đầu `photo-viewer.tsx` đã sửa theo.
- **Chưa kiểm chứng:** iOS (chưa có thiết bị), Android ngoài Galaxy S24 Ultra, và va chạm cử chỉ
  giữa vuốt ngang đổi tab với dải ảnh review cuộn ngang ở tab Reviews.
- **Việc còn lại đã biết:** chấm onboarding dùng Reanimated với tween (chưa đổi sang lò xo); "Show all"
  ở "What's included" chưa có animation mở.

## Đường lùi

Gỡ Reanimated là việc nhỏ nhưng đụng nhiều file: thay `Collapsible` bằng bản `open ? <FadeIn> : null`
(đã từng chạy mượt, bố cục nhảy tức thì), đưa `SwipeToRemove`, trình xem ảnh và các thanh chạy
Reanimated về lại `Animated`/`runOnJS(true)` như trước 25/10, gỡ hai gói khỏi `package.json` và
`moduleNameMapper`. Commit gần nhất trước đợt này (`76a29e8`) vẫn giữ các bản `Animated` cũ làm điểm đối chiếu.
