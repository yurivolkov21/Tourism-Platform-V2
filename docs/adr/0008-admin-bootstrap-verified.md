# ADR-0008 — Admin bootstrap: promote gated `emailVerified` + reconcile lúc boot

- **Trạng thái:** Accepted (2026-07-21)
- **Bối cảnh:** SEC-1 + AUTH-1 + AUTH-2 trong
  [rà soát độc lập 21/07](../analysis/2026-07-21-independent-review.md).

> Số ADR: `0007` đã bị `schema.prisma` "đặt chỗ" cho outbox (3 tham chiếu, file
> chưa tồn tại — docs-debt sẵn có, có thể backfill riêng), nên ADR này dùng `0008`.

> **Cập nhật 2026-08-03 (đại tu docs — đối chiếu code):**
> - **Đã thi hành trọn (4/4):** AUTH-2 outbox thật —
>   [apps/api/src/auth/auth.config.ts:39-53](../../apps/api/src/auth/auth.config.ts)
>   (không còn `console.log`); SEC-1 promote gated `emailVerified`; hai điểm
>   promote (verify-hook + `OnApplicationBootstrap` reconcile) —
>   [apps/api/src/auth/admin-reconcile.ts](../../apps/api/src/auth/admin-reconcile.ts);
>   `requireEmailVerification: false` giữ nguyên cho khách thường.
> - **Anchor test dời:** `auth.int.spec.ts:69-79` nay là
>   [`:95-104`](../../apps/api/src/auth/auth.int.spec.ts) (test b — SEC-1 chưa
>   verify không promote) và
>   [`:120-127`](../../apps/api/src/auth/auth.int.spec.ts) (test b2 — verify
>   xong mới promote ADMIN).
>
> Quyết định gốc giữ nguyên văn — đây chỉ là xác nhận đã thi hành + cập nhật
> con trỏ dòng.

## Bối cảnh

Promote admin hiện chỉ xảy ra trong hook `databaseHooks.user.create.after`
([auth.config.ts:74-89](../../apps/api/src/auth/auth.config.ts)): email khớp
`ADMIN_EMAILS` → set role ADMIN. Vì `requireEmailVerification: false`
([:37](../../apps/api/src/auth/auth.config.ts)) hook **tin một email CHƯA xác
minh sở hữu**. Hai lỗ:

- **SEC-1 (priv-esc):** kẻ đăng ký bằng một địa chỉ trong `ADMIN_EMAILS` TRƯỚC khi
  admin thật đăng ký → thành ADMIN ngay. Test `auth.int.spec.ts:69-79` hiện
  **khẳng định chính hành vi sai này**.
- **AUTH-1 (không self-heal):** email thêm vào `ADMIN_EMAILS` SAU khi account tồn
  tại thì không bao giờ được promote (hook chỉ chạy lúc create) — chicken-and-egg.

Gốc chung: promote tin **email-khớp** thay vì **sở hữu-đã-chứng-minh**. Và
`sendResetPassword`/`sendVerificationEmail` chỉ `console.log`
([:38-45](../../apps/api/src/auth/auth.config.ts)) — comment hứa "dây ở P2" nhưng
P2 đã merge chưa nối (AUTH-2), nên **không có kênh xác minh sở hữu nào chạy thật**.

## Quyết định

Ownership-proof qua email-verified, và bật kênh email thật:

1. **AUTH-2 — email chạy thật (Resend qua outbox).** `sendResetPassword` +
   `sendVerificationEmail` bỏ `console.log`, ghi **outbox row** (mẫu chung của
   app → `ResendDeliverer`, có retry/backoff). Bật `emailVerification.sendOnSignUp: true`.
   Thêm `EmailType.PASSWORD_RESET` + `EMAIL_VERIFICATION` (migration mới) và case
   render subject+html tương ứng. Vá luôn reset-mật-khẩu prod đang hỏng.

2. **Promote gated `emailVerified` (SEC-1).** BỎ auto-promote trong
   `create.after`. Promote MỚI **luôn promote-only**, điều kiện
   `emailVerified === true && email ∈ ADMIN_EMAILS`.

3. **Hai điểm promote (AUTH-1 self-heal):**
   - (a) **Khi verify email thành công** → promote ngay (hook sau-verify của Better
     Auth, hoặc `databaseHooks.user.update.after` bắt lúc `emailVerified` lật true).
   - (b) **Reconcile lúc boot** (`OnApplicationBootstrap`) → promote user hiện có
     thỏa điều kiện mà chưa-là-admin. Self-heal email-thêm-sau + backstop cho (a).

4. **`requireEmailVerification: false` GIỮ NGUYÊN** — khách dùng site/đặt tour
   không cần verify (ít ma sát cho demo). Verify chỉ **gate đặc quyền admin**,
   không chặn đăng nhập thường.

Bất biến: promote-only (không bao giờ demote — spec §5); role vẫn `input:false`
(server-owned); guard fail-closed (ADR-0003) không đổi.

## Hệ quả

- **SEC-1 đóng:** kẻ đăng ký email admin nhưng KHÔNG kiểm soát inbox → không verify
  được → `emailVerified` mãi false → không bao giờ promote.
- **AUTH-1 đóng:** reconcile lúc boot promote email thêm sau; verify-hook promote tức thì.
- Admin thật lần đầu: signup bằng địa chỉ `ADMIN_EMAILS` → nhận verify-email
  (`sendOnSignUp`) → verify → promote. Không chicken-and-egg (verify-email không cần admin nào tồn tại).
- **Edge — email-squatting (ghi nhận, không chặn):** attacker chiếm account bằng
  email admin nhưng **không thành admin** (không verify được). Admin thật nhận một
  verify-email lạ = tín hiệu cảnh báo; email được giải phóng khi account bị xóa
  (tombstone giải phóng citext-unique). Chấp nhận cho capstone.
- Test bắt buộc (mutation-aware): SEC-1 (signup admin **chưa verify** → CUSTOMER;
  gỡ gate → ĐỎ) · promote sau verify → ADMIN · reconcile promote đúng + KHÔNG demote
  · callback reset/verify ghi outbox (không `console.log`). **Sửa** test
  `auth.int.spec.ts:69-79` từ khẳng định hành-vi-sai thành hành-vi-đúng.

## Đã cân nhắc và loại

- **Seed admin out-of-band (script/CLI), bỏ promote-qua-signup.** Loại: đóng SEC-1
  nhưng kém tiện (thao tác tay mỗi admin) và KHÔNG buộc kênh email chạy thật — mà
  capstone "trang thật" cần email hoạt động; gate-emailVerified đạt cả hai.
- **`requireEmailVerification: true` cho MỌI user.** Loại: thêm ma sát cho mọi
  khách (phải verify mới đăng nhập) — thừa so với nhu cầu; chỉ đặc quyền admin cần
  ownership-proof, không phải mọi lượt duyệt/đặt tour.
- **Gửi reset/verify trực tiếp qua Resend client trong callback (không qua outbox).**
  Loại: mất retry/backoff + không nhất quán với mọi email khác của app; outbox là
  mẫu đã có, thêm một producer là đủ.
