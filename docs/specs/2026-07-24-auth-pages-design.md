# Spec — Cụm trang Auth (static-first)

**Ngày**: 2026-07-24 · **Trạng thái**: user đã duyệt hướng thiết kế · **Branch**: `feat/auth-pages`

## Phạm vi

6 trang UI auth, static-first (submit no-op, gắn Better Auth ở phase auth):

| Trang | Route | Ruột form |
| --- | --- | --- |
| Login | `/login` | email + password · "Forgot password?" · nút Google · link Register |
| Register | `/register` | name + email + password · điều khoản · nút Google · link Login |
| Forgot Password | `/forgot-password` | email · trạng thái "đã gửi mail" (mock state) |
| Reset Password | `/reset-password` | password ×2 + thanh độ mạnh |
| Verify Email | `/verify-email` | OTP 6 ô (`input-otp`) + đếm ngược gửi lại |
| 2FA | `/two-factor` | OTP 6 ô TOTP + link "dùng mã khôi phục" |

Quyết định user: **TOTP app** cho 2FA (không email OTP) · **có nút Google**
(UI trước, backend social sau) · thêm Reset Password thành 6 trang.

## Thiết kế (hướng A — "khung cửa lên đường" + chữ ký vé tàu)

- **AuthLayout split dùng chung**: TRÁI form card sáng; PHẢI panel tối cố định
  (ảnh placeholder + scrim + logo + quote đổi theo trang). Mobile: ẩn panel.
- **Chữ ký "TẤM VÉ"** (một chỗ, tiết chế): form card có mép răng cưa
  perforation mảnh + dòng cuống vé **IBM Plex Mono** ở chân card, đổi theo
  ngữ cảnh (`GATE: LOGIN` · `BOARDING CHECK` cho Verify/2FA...) — lần đầu
  font mono ra vai chính. Ý nghĩa: đăng nhập = soát vé lên chuyến đi.
- Token/typography theo hệ (jade, Literata italic accent, spring 320/70);
  án lệ #25; navbar/footer đầy đủ KHÔNG hiện trên trang auth (layout riêng
  tối giản: chỉ logo về Home).

## Nợ ghi sổ khi wire (phase auth)

- Better Auth client + social Google; bật plugin `twoFactor` (TOTP) +
  emailVerification phía API (ADR khi làm).
- Flow thật: Register → Verify → Login → 2FA; Forgot → mail → Reset.
- Validate/honeypot/rate-limit như nợ form chung.

## Quy trình dựng

Login dựng TRƯỚC làm mẫu layout → user duyệt → nhân ra 5 trang còn lại
(chỉ thay ruột form + câu quote + cuống vé).
