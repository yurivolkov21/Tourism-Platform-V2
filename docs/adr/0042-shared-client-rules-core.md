# ADR-0042 — `@tourism/core`: luật dùng chung cho mọi client, và hàng rào giữ nó không phình

- **Trạng thái:** Accepted (2026-09-16, phiên brainstorming P5b-1; ADR đi trước code)
- **Bối cảnh:** [spec P5b-1 cụm auth mobile](../specs/2026-09-16-p5b-auth-wireframe-design.md).
  Cụm auth mobile cần đúng bộ luật kiểm ô nhập và quy lỗi mà web đang chạy thật.
- **Liên quan:** [ADR-0040](0040-mobile-app-expo.md) §AMEND 1 (cùng ngày — cụm auth
  mobile) · [ADR-0017](0017-web-session-better-auth.md) §9 (auth mobile dùng
  `@better-auth/expo`, cùng bộ mã lỗi với web) · [ADR-0011](0011-p3b-web-architecture.md)
  (ranh giới `libs/`) · [ADR-0024](0024-deploy-targets.md) (Vercel build qua turbo)

## Bối cảnh

Web có hai file thuần, không dính React, đã chạy thật từ đợt sweep 19/08:

- `apps/web/src/lib/auth-form.ts` — `validateLogin/Register/ForgotPassword/ResetPassword/ChangePassword/Otp/ProfileName/ProfilePhone`. Ngưỡng đọc từ `@tourism/contract` (`EmailSchema`, `PasswordSchema`, `CreateEnquiryInputSchema`, `CreateBookingInputSchema`), câu chữ lấy từ `@tourism/i18n` (`messages.formErrors`).
- `apps/web/src/lib/auth-errors.ts` — `AuthErrorKey`, `mapAuthError` (mã lỗi Better Auth → khoá copy), `fieldOfAuthError` (khoá → ô nhập, hoặc null nghĩa là lỗi cấp form).

Mobile P5b cần **đúng** bộ đó: cùng API, cùng Better Auth 1.6.23, cùng copy tiếng
Anh. Nếu chép, repo sẽ có bản thứ ba — và đã có tiền lệ: `apps/admin/src/components/auth/login-form.tsx`
tự viết lại phần rút gọn (comment tại chỗ còn trỏ ngược về `auth-form.ts` của web).
Bài học "hai bản chép tay là hai bản sẽ trôi lệch" đã ghi sẵn trong `@tourism/i18n`.

`libs/shared/core` là thư mục P0 chừa từ đầu, tới nay chỉ có `.gitkeep` và chưa
ADR nào nói nó để làm gì.

## Quyết định

### 1. Dựng `@tourism/core` tại `libs/shared/core`, đóng gói y hệt `@tourism/i18n`

`package.json` xuất `dist` (`type: module`, exports `import`/`default`), `tsconfig.json`
+ `tsconfig.build.json`, `vitest.config.ts`, build bằng `tsc`. Import nội bộ có
đuôi `.js` như i18n.

Chọn khuôn i18n vì đó là khuôn ĐÃ chạy qua cả bốn người tiêu thụ của repo — Next
(web, admin), Nest (api), Metro + jest-expo (mobile). Dựng khuôn mới là mở một
mặt trận không ai yêu cầu.

### 2. Đợt này chuyển NGUYÊN VĂN hai file của web, kèm test

Không sửa một dòng logic trong bước chuyển. Đổi chỗ và đổi hành vi trong cùng một
commit là tự bịt mắt mình lúc review — và đây là code đang chạy trên web thật.
Việc mở rộng (thêm ô `otp` cho `fieldOfAuthError`) để sang nhánh mobile, có test riêng.

### 3. Hàng rào phạm vi — thứ giữ cho `core` không thành thùng rác

- **Chỉ TS thuần.** Cấm import `react`, `react-native`, `next/*`, API DOM và API Node.
- **Chỉ được phụ thuộc `@tourism/contract` và `@tourism/i18n`.** `i18n` KHÔNG BAO
  GIỜ được import ngược lại `core` — đồ thị phải một chiều.
- **Chỉ chuyển vào đây khi đã có người tiêu thụ THỨ HAI thật sự.** Không dọn trước
  cho tương lai; một hàm mà chỉ web dùng thì cứ để ở web.
- **Máy canh, không trông vào trí nhớ:** một spec quét source của `core` tìm import
  cấm, cùng tinh thần `scripts/check-mobile-tokens-only.mjs`.

### 4. Copy vẫn ở i18n; `core` chỉ CHỌN copy

Validator trả chuỗi lấy từ `messages.formErrors`, `mapAuthError` trả khoá của
`messages.authForms.errors`. Luật 7 (chữ user-facing tập trung ở `@tourism/i18n`)
không đổi một chữ.

### 5. Ai đổi gì trong đợt này

| Nơi | Đổi gì |
| --- | --- |
| `libs/shared/core` | Package mới + 2 file + 2 spec chuyển sang + spec canh import |
| `apps/web` | 7 file đổi đường import (4 form auth, otp-form, change-password-form, profile-summary). Hành vi không đổi |
| `apps/mobile` | Thêm `@tourism/core` vào dependency; dùng cho kiểm ô nhập và quy lỗi |
| `apps/api`, `apps/admin` | Không đổi |

## Hệ quả

- Một nguồn luật cho web và mobile; admin có đường dọn nợ về sau (ghi CÒN TREO).
- Hạ tầng sẵn có nuốt package mới mà không phải sửa gì: `pnpm-workspace.yaml` đã
  khai `libs/shared/*`, turbo `build` có `dependsOn: ["^build"]`, biome quét `**`,
  Vercel build qua turbo (ADR-0024) nên thứ tự build tự lo. Đã rà từng chỗ trước
  khi chốt, không đoán.
- **`apps/api/Dockerfile` là chỗ DUY NHẤT phải nhớ bằng tay:** stage `deps` copy
  tường minh từng `package.json` (api, contract, tokens, i18n). Ngày nào API dùng
  `core` thì phải thêm một dòng COPY, không thì `pnpm install` trong image thiếu
  importer.
- Vòng lặp dev mobile nay cần `dist` của `tokens`, `i18n` **và** `core`. Runbook
  đổi sang `pnpm turbo run build --filter=@tourism/mobile^...` — lỗ này có từ
  trước (runbook chỉ build `tokens` trong khi Metro đã cần `i18n`), thêm package
  chỉ làm nó lộ ra.
- Rủi ro thật còn lại là `core` phình. Hàng rào ở §3 là thứ chặn; ai nới nó phải
  sửa ADR này chứ không nới trong im lặng.

## Đã cân nhắc và loại

| Phương án | Vì sao loại |
| --- | --- |
| **Nhét vào `@tourism/i18n`** | Rẻ nhất về hạ tầng (không package mới, mobile đã phụ thuộc sẵn), nhưng biến gói "chữ" thành gói "chữ + logic". Và các cụm mobile sau cần đúng loại hàm KHÔNG dính chữ (`paginate`, `slug`, format giá, `booking-form`) — những thứ đó không có cửa vào i18n, nên cuối cùng vẫn phải đẻ ra `core`, lúc ấy luật auth nằm lạc ở i18n. |
| **Chép sang mobile** | Rẻ nhất hôm nay, và đúng cái bẫy repo đã ghi. Admin đã dính một lần rồi. |
| **Nhét vào `@tourism/contract`** | Vòng phụ thuộc: validator cần `i18n`, mà `i18n` đã phụ thuộc `contract`. |
| **Đổi validator sang trả KHOÁ lỗi thay vì câu** | Sạch hơn về lý thuyết (core hết dính copy), nhưng đổi chữ ký hàm ở 7 chỗ đang chạy trên web thật, sát freeze 15/10, đổi lấy một lợi ích không ai cần lúc này. |
| **Dựng khuôn package "gọn hơn" (không build dist, trỏ thẳng `src`)** | Metro, Next, Nest và jest-expo đang ăn `dist` ở ba package khác. Một package lệch khuôn là một lớp cấu hình riêng phải nhớ. |
