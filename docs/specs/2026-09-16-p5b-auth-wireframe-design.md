# Spec P5b-1 — Cụm auth app mobile: 17 khung tĩnh và hợp đồng với hạ tầng

16/09/2026 · tiếp phase P5 sau [template P5a](2026-09-08-p5a-mobile-template-design.md).
Quyết định kiến trúc đã chốt TRƯỚC spec này:
[ADR-0042](../adr/0042-shared-client-rules-core.md) (package `@tourism/core`) và
[ADR-0040 §AMEND 1](../adr/0040-mobile-app-expo.md) (dependency, seam `AuthActions`,
luật lỗi ba kênh). Đọc hai văn bản đó trước — spec này **không lặp lý lẽ**, chỉ nói
*xây gì* và *nghiệm thu thế nào*.

Bản vẽ user đã duyệt: [mockup 17 khung](../design/mockups/mobile-auth-screens.src.html).

Không migration. Không chạm `apps/api`, `apps/admin`, không chạm hạ tầng sống
(CLAUDE.md §15). Đụng: `libs/shared/core` (mới) · `apps/web` (chỉ dòng import) ·
`libs/mobile/ui` · `apps/mobile` · `libs/shared/i18n` (copy mới) ·
`docs/conventions/` (runbook + tài liệu bàn giao).

## 1. Đợt này dựng GIAO DIỆN, không nối API

Phần nối API do **một thành viên khác** trong nhóm làm sau. Vì vậy đầu ra của đợt
này là ba thứ, theo đúng thứ tự quan trọng: **màn hình tĩnh** · **hợp đồng bằng
code** để người kia cắm vào · **bản giả lập** để bấm thử được ngay trên điện thoại.

**KHÔNG thuộc phạm vi:** gọi Better Auth thật, lưu phiên, chặn tab Saved/Trips/Account
khi chưa đăng nhập (thuộc cụm tabs), icon app, các cụm màn còn lại (Home, Explore,
tour, booking, trips, account).

## 2. Hai nhánh, làm theo thứ tự

| # | Nhánh | Nội dung | Vì sao tách |
| --- | --- | --- | --- |
| 1 | `refactor/shared-auth-rules` | Dựng `@tourism/core`; chuyển nguyên văn `auth-form.ts` + `auth-errors.ts` và 2 spec; đổi import ở 7 file web; spec canh import cấm; **cổng** mobile tiêu thụ được | Đụng web đang chạy thật. Giữ nhánh nhỏ, review riêng, đẩy lên cho CI soi trước khi ff |
| 2 | `feat/p5b-auth-screens` | Component mới ở `@tourism/mobile-ui`; 17 khung; seam `AuthActions` + bản giả lập; gallery dev; copy i18n; runbook; tài liệu bàn giao | Đây mới là phần giao diện, không ảnh hưởng web |

**Cổng ở nhánh 1 (dừng nếu đỏ):** `apps/mobile` import được `@tourism/core` trong
jest-expo **và** `pnpm turbo run bundle --filter=@tourism/mobile` xanh. `@tourism/i18n`
đóng gói y hệt và đã chạy qua cả hai từ P5a, nên đây là thủ tục xác nhận, không
phải canh bạc — nhưng đỏ thì **dừng, báo user**, không tự chế cấu hình riêng.

## 3. Cây route và luồng

```text
Mở app → splash native ─┬─ lần đầu → onboarding (3 trang) ─┬─ "Get started" → Home (khách)
                        │                                   └─ "Sign in" ─────┐
                        └─ đã xem → Home (khách)                              ▼
[modal (auth)]   login ⇄ register
                   │        └→ verify-email?email= → success?kind=verified → login
                   ├─ emailNotVerified → verify-email?email= (lý do nằm ở phụ đề)
                   └─ forgot-password → trạng thái "đã gửi link"
Link trong email → reset-password?token= → success?kind=password-updated → login
```

Route thêm so với P5a: `onboarding` (ở gốc, toàn màn hình) · `(auth)/verify-email` ·
`(auth)/reset-password` · `(auth)/success` · `dev/gallery` (chỉ `__DEV__`).
`routes.spec.tsx` có bản kiểm kê route — thêm route nào cũng phải đi qua đó.

Nút thoát: màn ĐẦU của modal dùng **X** (đóng cả nhóm, `replace('/')` như P5a);
màn đi tiếp dùng **back**; `reset-password` mở từ link nên cũng dùng **X**.

## 4. Mười bảy khung và trạng thái phải dựng

| Mã | Màn | Trạng thái |
| --- | --- | --- |
| 1a | Splash | Native (app.json): nền token tối + logo hai viên kim cương |
| 1b–1d | Onboarding 1/2/3 | Ảnh dọc + Skip (trang 1, 2) · trang 3 có "Get started" và "I already have an account" |
| 2a | Sign in | Trống |
| 2b | Sign in | Lỗi cấp form (`invalidCredentials`) |
| 3a | Create account | Trống, nút khoá tới khi tick Terms |
| 3b | Create account | Lỗi từng ô (email sai định dạng, mật khẩu quá ngắn), Terms đã tick |
| 4a | Verify email | Sau đăng ký: mã 3+3, đếm ngược 60 giây, câu nhắc đăng ký trùng email |
| 4b | Verify email | Vào từ Sign in: lý do ở phụ đề + mã sai (lỗi của ô) |
| 4c | Verify email | Vừa bấm gửi lại mã: khung thông tin trên nút ghim |
| 5a | Forgot password | Nhập email |
| 5b | Forgot password | Đã gửi link (luôn hiện, kể cả email không tồn tại) |
| 5c | Reset password | Xác nhận không khớp |
| 5d | Reset password | Link hỏng hoặc hết hạn — trạng thái cả màn |
| 6a | Kết quả | Đã xác minh email → nút Sign in |
| 6b | Kết quả | Đã đổi mật khẩu → nút Sign in |

App vẫn theo chế độ màu của hệ thống (`userInterfaceStyle: automatic`, giữ nguyên từ P5a).
Mockup vẽ ở nền tối vì đó là bản user duyệt; bản nền sáng dùng đúng token sáng và phải
được liếc qua ở bước nghiệm thu. Nếu bản sáng vỡ bố cục thì việc khoá app ở nền tối là
quyết định của user, ghi vào CÒN TREO chứ session thi công không tự chốt.

Thêm hai trạng thái **không vẽ riêng nhưng bắt buộc có**: nút primary lúc đang gửi
(khoá + chỉ báo) ở mọi form, và ô mật khẩu có nút hiện/ẩn.

Copy: câu lỗi và các câu đã có lấy **nguyên** từ `messages.authForms` và
`messages.formErrors` (một nguồn với web). Câu mới của mobile (onboarding, tiêu đề,
phụ đề, nhãn nút) nằm trong khối mới `messages.mobile.auth`; tiêu đề route mới thêm
vào `messages.mobile.appShell.titles`.

## 5. Luật lỗi ba kênh

| Kênh | Dùng khi | Hiển thị |
| --- | --- | --- |
| 1 · Lỗi của ô | Lỗi chỉ ra được ô sai: kiểm ở máy (trống, sai định dạng, quá ngắn, không khớp) hoặc lỗi server quy được về ô (`invalidEmail`, `emailExists`, `passwordTooShort/Long`, `invalidOtp`) | Dưới ô, gạch chân đổi sang `destructive-emphasis` |
| 2 · Khung của form | Không quy được về ô nhưng màn vẫn thử lại được: `invalidCredentials`, `tooManyRequests`, `notAvailable`, `generic` — và tin báo (`đã gửi mã mới`) | **Một** khung mỗi form, ngay trên nút chính; hai tông: lỗi và thông tin |
| 3 · Trạng thái cả màn | Màn không dùng tiếp được (`invalidToken` ở reset, thiếu `email` ở verify) hoặc đã xong việc (6a, 6b) | Thay cả thân màn, luôn kèm một nút đi tiếp |

- Kênh do **một hàm** quyết, màn không tự chọn: `channelOf(key, screen)` trong
  `apps/mobile`, dựa trên `fieldOfAuthError` của `@tourism/core`. Màn chỉ nhận
  `fieldErrors` và `formMessage` rồi vẽ.
- Ngữ cảnh lúc vừa vào màn (bị chuyển từ Sign in sang Verify) nói bằng **phụ đề**,
  không thêm dải riêng.
- A11y: khung kênh 2 có `accessibilityRole="alert"`; submit mà kiểm ở máy thấy lỗi
  thì focus về ô sai ĐẦU TIÊN.
- `emailNotVerified` **không** hiện ra như lỗi: nó là lệnh chuyển màn.

## 6. Hợp đồng với hạ tầng

```ts
type AuthResult = { ok: true } | { ok: false; error: AuthErrorKey | 'emailNotVerified' };

interface AuthActions {
  signInWithEmail(input: { email: string; password: string }): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  signUpWithEmail(input: { name: string; email: string; password: string }): Promise<AuthResult>;
  verifyEmail(input: { email: string; otp: string }): Promise<AuthResult>;
  resendVerificationCode(input: { email: string }): Promise<AuthResult>;
  requestPasswordReset(input: { email: string }): Promise<AuthResult>;
  resetPassword(input: { token: string; newPassword: string }): Promise<AuthResult>;
}

interface OnboardingStore {
  hasSeen(): Promise<boolean>;
  markSeen(): Promise<void>;
}
```

Cả hai cấp qua provider ở `src/app/_layout.tsx`. Đợt này dùng bản giả lập; người
làm hạ tầng viết bản thật rồi đổi provider — **không sửa màn nào**.

**Bản giả lập** (trễ ~600ms để thấy trạng thái đang gửi):

| Nhập | Kết quả |
| --- | --- |
| Sign in với `unverified@example.com` | `emailNotVerified` → chuyển sang Verify |
| Sign in với mật khẩu `wrong-password` | `invalidCredentials` (kênh 2) |
| Sign in với `busy@example.com` · `offline@example.com` | `tooManyRequests` · `generic` |
| Verify với mã `000000` | `invalidOtp` (kênh 1); mã khác → thành công |
| Mở `reset-password?token=expired` | `invalidToken` (kênh 3) |
| Bấm Continue with Google | `notAvailable` |
| Mọi thứ còn lại | Thành công |

**Tài liệu bàn giao** `docs/conventions/mobile-auth-handoff.md` (thêm vào bản đồ
`docs/README.md`) phải có: bảng mỗi method ↔ lệnh Better Auth tương ứng (kể cả
nhánh `EMAIL_NOT_VERIFIED` phải gửi mã mới TRƯỚC khi trả `emailNotVerified`, đúng
như web đang làm) · `requestPasswordReset` truyền `redirectTo` deep link
`nexora://reset-password` · lỗi luôn đi qua `mapAuthError` của `@tourism/core`,
mạng đứt thì `generic` · việc phía API theo ADR-0017 §9 · chỗ đổi provider và chỗ
lưu cờ onboarding · ảnh trong bản giả lập đang là URL Cloudinary cố định, nối thật
thì lấy từ khe site-media · và danh sách **không được sửa**: màn, luật kiểm lỗi, copy.

## 7. Component mới

| Ở đâu | Gì |
| --- | --- |
| `@tourism/mobile-ui` (dùng lại cho cụm sau) | `TextField` (gạch chân, icon, nhãn thu nhỏ khi có giá trị, dòng lỗi, nút hiện/ẩn mật khẩu) · `OtpInput` (6 ô chia 3+3) · `FormMessage` (hai tông) · `Checkbox` · `IconButton` · hàm `withAlpha` (nhận cả hex 6 lẫn 8 ký tự — token `scrim` có sẵn alpha) |
| `apps/mobile/src/features/auth` (riêng cụm này) | Ảnh đầu trang + dải mờ · onboarding · màn kết quả · logo hai viên kim cương |

`MOBILE_COLOR_KEYS` thêm bốn khoá thật sự dùng: `on-media`, `destructive-emphasis`,
`input`, `scrim`. Type scale giữ nguyên (tiêu đề dùng bậc `3xl` sẵn có). Theme thêm
map font family (Literata heading, Archivo body) theo ADR-0040 §AMEND 1 mục 2.

## 8. Test bắt buộc

TDD trên logic thuần (luật 4), ≥80% trên code mới.

| Vùng | Phải có test |
| --- | --- |
| `@tourism/core` | Hai spec chuyển sang chạy nguyên · spec quét source tìm import cấm (react, react-native, next, DOM, Node) · `fieldOfAuthError` quy `invalidOtp` về ô `otp` (nhánh 2) |
| `@tourism/mobile-ui` | `TextField` (nhãn, lỗi, ẩn/hiện, a11y) · `OtpInput` (chỉ nhận số, dán mã, trạng thái sai) · `FormMessage` (hai tông, `accessibilityRole="alert"`) · `Checkbox` · `IconButton` (vùng chạm ≥ `touchTargetMin`) · `withAlpha` · font theo vai trò chữ · lưới tokens-only vẫn xanh |
| Logic `apps/mobile` | Bảng kịch bản bản giả lập · `channelOf` cho từng màn · luồng submit (kiểm → gọi → đặt lỗi hoặc chuyển màn) · đếm ngược gửi lại mã · cờ onboarding |
| Màn `apps/mobile` | Mỗi khung ở §4 render đúng trạng thái của nó · kiểm kê route có 5 route mới · `/dev/gallery` không mở được khi không phải `__DEV__` |
| `@tourism/i18n` | Mọi khoá `mobile.auth` mới có giá trị, không rỗng |

## 9. Nghiệm thu ở session gốc (trước merge)

1. `pnpm gate:int` trọn (API tạm :3001 trên docker).
2. `pnpm turbo run bundle --filter=@tourism/mobile` xanh — gate KHÔNG chạy Metro.
3. `pnpm exec expo-doctor` trong `apps/mobile` không có mục đỏ.
4. `grep -rn --exclude-dir=.expo "eslint\|prettier" apps/mobile libs/mobile` rỗng.
5. `git diff --cached --name-only | grep docs/screenshot` rỗng — ảnh tham chiếu của user luôn hiện `??` vì không nằm trong ignore, thứ phải canh là **không stage** nó.
6. **User cầm điện thoại**: quét QR bằng Expo Go, mở `/dev/gallery`, xem đủ 17 khung
   ở cả hai chế độ sáng/tối. Đây là bước duy nhất agent không làm thay được.

## 10. Đầu ra bắt buộc và CÒN TREO

- Commit Conventional **tiếng Việt có dấu**, không AI attribution, mỗi mục một commit TDD.
- Entry `docs/CHANGELOG.md` ghi rõ "CHƯA merge, chờ review" kèm kết quả cổng ở §2.
- `docs/README.md`: thêm spec này, ADR-0042, tài liệu bàn giao, mockup vào bản đồ.
- `docs/conventions/mobile-dev-loop.md`: đổi bước build sang
  `pnpm turbo run build --filter=@tourism/mobile^...`.
- **CÒN TREO sau đợt này:** chặn tab khi chưa đăng nhập (cụm tabs) · icon app ·
  admin chuyển sang `@tourism/core` · thêm dòng COPY trong `apps/api/Dockerfile`
  nếu API dùng `core` · nối API thật (thành viên khác).
