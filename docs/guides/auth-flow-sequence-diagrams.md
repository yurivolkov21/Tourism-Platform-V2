# Luồng đăng nhập: sơ đồ tuần tự

Trang này mô tả bằng sơ đồ tuần tự (*sequence diagram*) cách đăng nhập, đăng ký và
khôi phục tài khoản chạy trên web khách, trang quản trị và app mobile. Viết cho lập
trình viên; bản dễ hiểu cho người không rành kỹ thuật ở
[auth-flow-simple](auth-flow-simple.md).

Thư viện dùng: **better-auth 1.6.23** (`apps/api`, `apps/web`, `apps/admin`, `apps/mobile`). Session kiểu cookie httpOnly (`better-auth.session_token`), không JWT/bearer cho web/admin, không có endpoint refresh riêng — cookie tự gia hạn qua `updateAge` của better-auth. App mobile dùng cùng Better Auth qua plugin `expoClient` (mục 3).

## Tổng quan nguồn

- `apps/api/src/auth/auth.config.ts` — cấu hình `betterAuth()`: email/password, email OTP verification, social Google, hooks, cookie cross-subdomain.
- `apps/api/src/auth/auth.controller.ts` — mount toàn bộ route better-auth tại `ALL /api/auth/*`.
- `apps/api/src/auth/auth.guard.ts` — guard toàn cục, fail-closed, verify session qua `auth.api.getSession()`, check role qua `@Roles()`.
- `apps/api/src/auth/admin-bootstrap.ts` + `admin-reconcile.ts` — promote role ADMIN theo `ADMIN_EMAILS`.
- `apps/api/src/auth/account.controller.ts` — self-service account (me, xoá tài khoản).
- `apps/web/src/lib/auth-client.ts`, `apps/web/src/components/auth/*` — client web (login, register, verify OTP, forgot/reset password, sign-out).
- `apps/admin/src/lib/auth-client.ts`, `apps/admin/src/components/auth/*`, `apps/admin/src/app/(admin)/layout.tsx`, `apps/admin/src/lib/admin-gate.ts` — client admin, role gate.
- `apps/mobile/src/lib/auth-client.ts`, `apps/mobile/src/features/auth/better-auth-actions.ts` — mobile gọi Better Auth thật qua plugin `expoClient`; Google bằng SDK gốc và ID token ([ADR-0056](../adr/0056-mobile-google-native-signin.md)).

---

## 1. Web — login + truy cập trang bảo vệ

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Người dùng
    participant W as Web (Next.js client)
    participant P as Web proxy.ts
    participant A as API (Better Auth handler)
    participant DB as DB (Prisma)

    rect rgb(245, 240, 230)
    U->>W: Nhập email/password, submit
    W->>A: POST /api/auth/sign-in/email
    A->>DB: Kiểm tra user + password hash

    alt email chưa verify
        A-->>W: 403 EMAIL_NOT_VERIFIED
        W->>A: POST /api/auth/email-otp/send-verification-otp
        W->>U: Redirect /verify-email
    else credential sai
        A-->>W: error code
        W->>U: Hiện lỗi field
    else thành công
        A-->>W: Set-Cookie better-auth.session_token
        W->>U: router.push(redirect)
        W->>U: router.refresh()
    end

    Note over U,A: Sau login, browser tự đính cookie mỗi request

    U->>P: GET /account/... (trang cần login)
    P->>P: Kiểm tra cookie tồn tại (không phải security boundary)

    alt không có cookie
        P-->>U: Redirect /login?redirect=...
    else có cookie
        P->>W: Cho qua, render page/layout
        W->>A: GET /api/auth/get-session (forward cookie)
        A->>A: auth.api.getSession() verify cookie
        A-->>W: session user hoặc null
        alt null hoặc deletedAt
            W->>U: requireSession() redirect /login
        else hợp lệ
            W->>U: Render trang với dữ liệu user
        end
    end
    end
```

## 2. Admin — login + role gate

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Admin
    participant AD as Admin (Next.js client)
    participant P as Admin proxy.ts
    participant L as (admin)/layout.tsx
    participant A as API (Better Auth)

    rect rgb(245, 240, 230)
    U->>AD: Nhập email/password
    AD->>A: POST /api/auth/sign-in/email
    A-->>AD: Set-Cookie session_token (cookie domain cha)
    AD->>U: router.push(redirect)

    Note over AD: Form KHÔNG check role, chỉ đăng nhập thành công

    U->>P: GET /(admin)/...
    P->>P: Kiểm tra cookie tồn tại (không phải biên quyền)

    alt không có cookie
        P-->>U: redirect /login
    else có cookie
        P->>L: forward + x-pathname header
        L->>A: GET /api/auth/get-session (forward cookie)
        A-->>L: session user + role

        alt không có session
            L-->>U: redirect /login
        else role khác ADMIN
            L-->>U: redirect /not-authorized
        else role là ADMIN
            L-->>U: render admin page
        end
    end
    end
```

## 3. Mobile — đăng nhập thật qua plugin Expo

Cập nhật 14/10/2026. Mobile không có cookie jar như trình duyệt: plugin `expoClient`
lưu cookie phiên trong `expo-secure-store` rồi tự đính vào mọi request sau. Google
không đi trình duyệt hay deep link nữa (ADR-0056, 13/10): SDK Google gốc trả ID
token, app đổi token đó lấy phiên.

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Người dùng mobile
    participant M as Mobile app
    participant C as authClient (plugin expoClient)
    participant SS as expo-secure-store
    participant A as API (Better Auth, plugin expo)

    rect rgb(245, 240, 230)
    Note over U,A: Email và mật khẩu
    U->>M: Nhập email/password
    M->>C: signIn.email()
    C->>A: POST /api/auth/sign-in/email
    A-->>C: set-cookie phiên
    C->>SS: Lưu cookie phiên
    end

    rect rgb(230, 223, 204)
    Note over U,A: Google (ADR-0056)
    U->>M: Bấm Continue with Google
    M->>M: SDK Google gốc trả ID token
    M->>C: signIn.social(provider google, idToken)
    C->>A: POST /api/auth/sign-in/social
    A-->>C: set-cookie phiên
    C->>SS: Lưu cookie phiên
    end

    M->>A: Request sau kèm cookie phiên lấy từ SecureStore
```

## 4. Đăng ký + xác minh email OTP (web)

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Người dùng
    participant W as Web (Next.js client)
    participant A as API (Better Auth)
    participant DB as DB (Prisma)

    rect rgb(245, 240, 230)
    U->>W: Nhập name/email/password, submit
    W->>A: POST /api/auth/sign-up/email
    A->>DB: Tạo user, role=CUSTOMER, emailVerified=false
    A->>A: sendOnSignUp - gửi email OTP 6 số (hết hạn 10 phút)
    A-->>W: Tạo thành công, KHÔNG có session (autoSignIn=false)
    W->>U: Redirect /verify-email?email=...

    U->>W: Nhập mã OTP
    W->>A: POST /api/auth/email-otp/verify-email {email, otp}
    A->>DB: Kiểm tra OTP, đánh dấu emailVerified=true

    A->>A: Hook afterEmailVerification chạy
    alt email nằm trong ADMIN_EMAILS
        A->>DB: Promote role -> ADMIN
    else không khớp
        A->>A: Giữ role CUSTOMER
    end

    A-->>W: Verify thành công (KHÔNG auto-login)
    W->>U: Toast + redirect /login?redirect=...
    end
```

## 5. Quên mật khẩu / đặt lại mật khẩu (web)

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Người dùng
    participant W as Web (Next.js client)
    participant A as API (Better Auth)
    participant DB as DB (Prisma)
    participant Mail as Email service

    rect rgb(245, 240, 230)
    U->>W: Nhập email, submit forgot-password
    W->>A: POST /api/auth/request-password-reset {email, redirectTo}
    A->>DB: Tạo reset token (hết hạn 1800s)
    A->>Mail: Gửi link reset-password kèm token
    A-->>W: Response OK (không lộ email có tồn tại hay không)
    W->>U: Thông báo kiểm tra email

    U->>U: Mở email, click link reset-password?token=...
    U->>W: Nhập mật khẩu mới
    W->>A: POST /api/auth/reset-password {token, newPassword}
    A->>DB: Verify token, update password hash
    A->>DB: revokeSessionsOnPasswordReset - thu hồi mọi session khác
    A-->>W: Thành công
    W->>U: Redirect /login
    end
```

## 6. Đăng xuất (web + admin)

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Người dùng
    participant C as Client (Web hoặc Admin)
    participant A as API (Better Auth)
    participant DB as DB (Prisma)

    rect rgb(245, 240, 230)
    U->>C: Click "Đăng xuất"
    C->>A: POST /api/auth/sign-out
    A->>DB: Thu hồi session hiện tại
    A-->>C: Set-Cookie xoá better-auth.session_token
    C->>U: router.push('/') hoặc '/login'
    C->>U: router.refresh()
    end
```

## 7. Đăng nhập Google OAuth

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Người dùng
    participant C as Client (Web/Admin)
    participant A as API (Better Auth)
    participant G as Google OAuth
    participant DB as DB (Prisma)

    rect rgb(245, 240, 230)
    U->>C: Click "Đăng nhập với Google"
    C->>A: POST /api/auth/sign-in/social {provider: google, callbackURL}
    A-->>C: URL redirect tới Google
    C->>G: Chuyển hướng browser tới Google consent
    U->>G: Đăng nhập + cấp quyền
    G-->>A: GET /api/auth/callback/google?code=...
    A->>G: Đổi code lấy access token + profile
    A->>DB: Tạo mới hoặc liên kết user theo email Google
    A-->>C: Set-Cookie session_token, redirect callbackURL
    end

    Note over U,A: Chỉ chạy nếu GOOGLE_CLIENT_ID/SECRET được cấu hình server
    Note over U,A: App mobile không đi luồng này: dùng SDK Google gốc và ID token (mục 3)
```

## 8. Bootstrap / promote role ADMIN

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    participant Boot as API (khởi động app)
    participant Hook as afterEmailVerification hook
    participant Rec as AdminReconcileService
    participant DB as DB (Prisma)

    rect rgb(245, 240, 230)
    Note over Hook,DB: (a) Tại thời điểm user verify email thành công
    Hook->>Hook: isBootstrapAdmin(email, ADMIN_EMAILS)
    alt email khớp ADMIN_EMAILS
        Hook->>DB: Update role -> ADMIN
    else không khớp
        Hook->>Hook: Giữ nguyên role
    end
    end

    rect rgb(230, 223, 204)
    Note over Boot,DB: (b) Backstop mỗi lần app khởi động
    Boot->>Rec: OnApplicationBootstrap
    Rec->>DB: updateMany where email in ADMIN_EMAILS AND emailVerified=true AND role != ADMIN
    DB-->>Rec: Set role = ADMIN cho các user khớp
    Note over Rec,DB: Chỉ promote, không bao giờ demote nếu email bị xoá khỏi ADMIN_EMAILS
    end
```

## 9. Xoá tài khoản (self-service)

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Người dùng
    participant W as Web (Next.js client)
    participant G as AuthGuard
    participant A as API (AccountController)
    participant DB as DB (Prisma)

    rect rgb(245, 240, 230)
    U->>W: Xác nhận xoá tài khoản, nhập password
    W->>A: DELETE /api/account {password}
    A->>G: Xác thực session (fail-closed, phải có session hợp lệ)
    G-->>A: session user OK

    A->>DB: Kiểm tra password + điều kiện xoá
    alt thiếu password
        A-->>W: 400 PASSWORD_REQUIRED
    else tài khoản Owner hoặc Staff (xét trước password)
        A-->>W: 403 ACCOUNT_IS_OWNER hoặc ACCOUNT_IS_STAFF
    else sai password
        A-->>W: 403 INVALID_PASSWORD
    else quá nhiều lần thử
        A-->>W: 429 TOO_MANY_ATTEMPTS
    else còn booking/đang huỷ/thiếu credential
        A-->>W: 409 Conflict (lý do cụ thể)
    else hợp lệ
        A->>DB: Đánh dấu deletedAt (tombstone, không xoá cứng)
        A-->>W: 204 No Content
        W->>A: POST /api/auth/sign-out
        W->>U: Redirect trang chủ
    end
    end
```

---

## Điều chưa xác nhận từ source

- Path chính xác từng route nội bộ better-auth suy ra từ client call (`authClient.signIn.email` ...), chưa mở `node_modules/better-auth/dist` để verify từng chữ.
- `account.service.ts` — chỉ đọc phần map lỗi ở controller, chưa đọc hết logic service (đếm số lần thử sai password, rule xoá).
- Giá trị `updateAge`/`expiresIn` cookie dùng default của better-auth, không override rõ trong `auth.config.ts`.
