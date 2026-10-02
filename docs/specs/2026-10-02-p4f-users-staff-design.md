# Spec P4f — Vùng Users: Owner và Staff

- **Ngày:** 2026-10-02 · **Trạng thái:** thiết kế duyệt qua bốn phần trong chat cùng ngày;
  spec user duyệt cùng ngày. Plan thi công
  [2026-10-02-p4f-users-staff.md](../plans/2026-10-02-p4f-users-staff.md) sửa mười sáu chỗ
  cho khớp code — mỗi chỗ ghi "plan, quyết định N" ngay tại chỗ đã sửa.
- **Quyết định kiến trúc:** [ADR-0052](../adr/0052-admin-staff-tier.md)
- **Nền:** [ADR-0003](../adr/0003-auth-fail-closed.md) (fail-closed) ·
  [ADR-0026](../adr/0026-p4-admin-app.md) AMEND 1 §C §D, AMEND 3 §B ·
  [ADR-0017](../adr/0017-web-session-better-auth.md) (Better Auth) ·
  [ADR-0037](../adr/0037-default-write-throttle.md) (trần ghi) ·
  [ADR-0042](../adr/0042-shared-client-rules-core.md) (`@tourism/core`)
- **Đóng:** mục Users của sidebar (P4f). Media library, Appearance và G16 vẫn mở, không thuộc
  spec này.

## 1. Mục tiêu & phạm vi

### Vấn đề

Ai vào admin cũng có toàn quyền tiền, và chỉ có một người vào được. Muốn thêm người phụ
việc thì phải đưa email vào `ADMIN_EMAILS` (toàn quyền); muốn đá phiên hay chặn một tài khoản
thì chạy SQL tay theo runbook.

### Trong phạm vi

- Role mới `STAFF`, Owner cấp và thu hồi cho tài khoản khách đã xác minh.
- Bảng quyền ở contract; API và app admin áp cùng bảng.
- Khoá và mở khoá tài khoản; đăng xuất mọi nơi.
- Lịch sử thao tác theo từng người dùng.
- Trang `/users` và `/users/[id]` của admin; câu báo khoá ở form đăng nhập web và admin.

### Ngoài phạm vi, cố ý

- Quyền tuỳ chỉnh cho từng Staff; mời hoặc tạo tài khoản từ admin; đăng nhập thay người khác.
- Email báo đổi quyền hay báo khoá.
- Admin xoá tài khoản (khách vẫn tự xoá theo luồng sẵn có).
- Xuất CSV danh sách người dùng.
- Hạ Owner qua giao diện (vẫn là runbook ADR-0026 AMEND 1 §D).

## 2. Mô hình quyền

### 2.1 Hai bậc

| Bậc | Giá trị enum | Đến từ đâu | Nhãn giao diện |
| --- | --- | --- | --- |
| Owner | `ADMIN` | chỉ `ADMIN_EMAILS` (SEC-1, không đổi) | Owner |
| Staff | `STAFF` (mới) | Owner cấp trên `/users/[id]` | Staff |
| Khách | `CUSTOMER` | đăng ký | Customer |

Staff vẫn dùng web như khách bình thường. Nếu email của một Staff được thêm vào
`ADMIN_EMAILS`, reconcile lúc boot đưa người đó lên Owner (hành vi sẵn có, không ghi lịch sử).

### 2.2 Bảng quyền

`libs/shared/contract/src/admin-access.ts`, export qua subpath riêng
`@tourism/contract/admin-access` để chunk client của admin không kéo barrel contract; module
này chỉ `import type` từ `contract.ts`.

- `AdminProcedureKey` — kiểu suy từ `typeof contract.admin`, dạng `'bookings.refund'`.
- `AdminAccessLevel = 'owner' | 'staff'`.
- `ADMIN_ACCESS` — đủ 62 khoá, `satisfies Record<AdminProcedureKey, AdminAccessLevel>`.
- `ADMIN_APP_ROLES = ['ADMIN', 'STAFF']`, `isAdminAppRole(role)`.
- `canAccess(role, key)`: `ADMIN` → luôn `true`; `STAFF` → `ADMIN_ACCESS[key] === 'staff'`;
  role khác (kể cả rỗng, lạ) → `false`.

Danh sách đầy đủ:

| Nhóm | Staff và Owner | Chỉ Owner |
| --- | --- | --- |
| `bookings` | `list`, `byCode` | `refund` |
| `categories` | `create`, `list`, `move`, `setActive`, `update` | |
| `departures` | `create`, `list`, `setStatus`, `update` | `cancel` |
| `destinations` | `create`, `list`, `setActive`, `update` | |
| `enquiries` | `addNote`, `byId`, `list`, `setStatus` | |
| `outbox` | `list`, `retry` | |
| `paymentEvents` | | `list`, `byId` |
| `posts` | `list`, `get`, `create`, `update`, `signCoverUpload`, `tags` | `delete` |
| `reports` | | `monthly` |
| `reviews` | `list`, `moderate` | |
| `stats` | `bookings`, `dashboard`, `enquiries`, `outbox`, `reviews`, `subscribers` | `paymentEvents` |
| `subscribers` | `list`, `unsubscribe` | |
| `tours` | `create`, `get`, `list`, `photoLibrary`, `setCosts`, `setFaqsPolicies`, `setItinerary`, `setPhotos`, `setPublished`, `signPhotoUploads`, `updateDetails` | `delete` |
| `users` | | `list`, `byId`, `setRole`, `lock`, `unlock`, `revokeSessions` |

Tổng: 48 thủ tục Staff, 14 thủ tục chỉ Owner.

`libs/shared/contract/src/admin-procedures.ts` (barrel, chỉ API và test dùng):
`listAdminProcedures()` duyệt `contract.admin` lúc chạy, trả `{ key, procedure, method, path }`
cho từng thủ tục.

### 2.3 Áp ở API

- `apps/api/src/auth/admin-implement.decorator.ts`: `AdminImplement(procedure)` =
  `applyDecorators(Implement(procedure), Roles(...rolesOf(key)))`, với `owner` → `[ADMIN]`,
  `staff` → `[ADMIN, STAFF]`. Thủ tục không có trong `listAdminProcedures()` thì ném lỗi ngay
  lúc nạp module.
- 14 controller admin (13 hiện có cùng `AdminUsersController` mới) dùng `@AdminImplement` cho
  MỌI handler; `@Roles(UserRole.ADMIN)` cấp class giữ nguyên làm lưới.
- `AuthGuard`: không đổi logic role; thêm `lockedAt` (mục 5).
- `DefaultThrottlerGuard`: tầng `ADMIN_WRITE_THROTTLE` áp khi `isAdminAppRole(user.role)` và
  route thuộc bề mặt admin (hiện chỉ `UserRole.ADMIN`).

### 2.4 Áp ở app admin

- `decideAdminAccess` và layout `(admin)` cho qua khi `isAdminAppRole(session.role)`; vế ép
  role tường minh của layout (ADR-0026 AMEND 4) giữ, chỉ đổi điều kiện.
- Layout bọc con bằng `AdminAccessProvider role={session.role}`; component client hỏi bằng
  `useCanAccess(key)`, trang server gọi `canAccess(session.role, key)`. Vắng provider (chỉ
  xảy ra trong test) thì `useCanAccess` trả `true` — gác thật ở API (plan, quyết định 3).
- Trang và route chỉ Owner chặn trước khi gọi API bằng `requirePageAccess(session, key)` (về
  `/not-authorized`), gọi ngay sau `getServerSession()` và trước mọi fetch (plan, quyết định
  13): `/reports` và `/reports/export` (`reports.monthly`), `/payment-events`
  (`paymentEvents.list`; khung chi tiết của trang gọi `paymentEvents.byId` qua server action,
  API tự trả 403), `/users`, `/users/[id]` (`users.list`, `users.byId`). Boundary 403
  (`ADMIN_FORBIDDEN`, AMEND 3 §B) vẫn đỡ phía sau.
- `/not-authorized` nói theo role: Staff thấy khối "Owner only" kèm link về Dashboard, còn lại
  giữ câu cũ (plan, quyết định 5).
- Sidebar: `NavItem` thêm `access?: AdminProcedureKey` — Reports `reports.monthly`, Payment
  events `paymentEvents.list`, Users `users.list` (mục này bật `enabled: true`). `NavMain` nhận
  role và **ẩn hẳn** mục không được vào (không hiện "Soon").
- Nhãn Owner hoặc Staff nằm trong menu tài khoản của `nav-user`, dưới email — nút sidebar chỉ
  đủ hai dòng (plan, quyết định 6).
- Bốn chỗ ẩn với Staff: nút Refund (chi tiết booking — thay bằng câu "Only the owner can issue
  refunds.", sổ hoàn tiền vẫn hiện; plan, quyết định 10), Cancel departure, khung xoá tour,
  khung xoá bài viết.
- Dashboard và các trang Staff được vào không đổi: chúng chỉ gọi thủ tục `staff`
  (`stats.paymentEvents` chỉ có ở trang Payment events).

## 3. Dữ liệu

### 3.1 Migration (một file)

`STAFF` nối ĐUÔI enum — `ALTER TYPE … ADD VALUE` không chèn giữa (plan, quyết định 1):

```prisma
enum UserRole {
  CUSTOMER
  ADMIN
  STAFF
}

enum UserEventType {
  STAFF_GRANTED
  STAFF_REVOKED
  LOCKED
  UNLOCKED
  SESSIONS_REVOKED
}

model User {
  // … như cũ
  lockedAt     DateTime?   @map("locked_at")
  userEvents   UserEvent[] @relation("UserEventTarget")
  actedEvents  UserEvent[] @relation("UserEventActor")
}

model UserEvent {
  id        String        @id @default(uuid(7)) @db.Uuid
  userId    String        @map("user_id") @db.Uuid
  actorId   String?       @map("actor_id") @db.Uuid
  type      UserEventType
  note      String?       @db.VarChar(500)
  createdAt DateTime      @default(now()) @map("created_at")

  user  User  @relation("UserEventTarget", fields: [userId], references: [id], onDelete: Cascade)
  actor User? @relation("UserEventActor", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@map("user_events")
}
```

- Thêm dòng `ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;` (default deny, không policy —
  cùng lưới với mọi bảng; `check-rls` canh).
- Cả ba thay đổi chỉ THÊM: code cũ chạy được trên schema mới.

### 3.2 Script vận hành

- `export-snapshot.mjs`: thêm `user_events` vào nhóm riêng tư.
- `reset-operational-data.mjs`: thêm `['user_events', null, 'CASCADE ← users, xoá tường minh
  cho rõ ý']` trước dòng `sessions`. Lượt reset vẫn giữ đúng một admin; Staff là khách nên bị
  xoá như khách.

## 4. Luật thao tác

### 4.1 Hàm thuần dùng chung

`libs/shared/contract/src/schemas/admin-users.ts`:

- `USER_LOCK_REASON_MAX = 500` (cột `note VarChar(500)`).
- `userStatus({ emailVerified, lockedAt })` → `'locked'` nếu có `lockedAt`, ngược lại
  `'unverified'` nếu chưa xác minh, ngược lại `'active'`.
- `userActions({ role, emailVerified, lockedAt })` → danh sách thao tác hợp lệ:

| Role | Thao tác hợp lệ |
| --- | --- |
| `ADMIN` | `unlock` nếu đang khoá; ngoài ra không gì |
| `STAFF` | `revokeStaff`, `lock` hoặc `unlock`, `revokeSessions` |
| `CUSTOMER` | `grantStaff` nếu đã xác minh và không khoá; `lock` hoặc `unlock`; `revokeSessions` |

API dùng hàm này để kiểm; trang chi tiết dùng nó để chọn nút nào hiện.

### 4.2 Năm thao tác

Điều kiện chung: user tồn tại và `deletedAt` null, không thì `NOT_FOUND`. Thao tác không nằm
trong `userActions(target)` thì `STATE_CHANGED` 409.

| Thao tác | Ghi gì (một transaction) | Sự kiện |
| --- | --- | --- |
| `setRole → STAFF` | `role = STAFF` | `STAFF_GRANTED` |
| `setRole → CUSTOMER` | `role = CUSTOMER`, xoá mọi phiên | `STAFF_REVOKED` |
| `lock` | `locked_at = now`, xoá mọi phiên | `LOCKED`, `note` = lý do |
| `unlock` | `locked_at = null` | `UNLOCKED` |
| `revokeSessions` | xoá mọi phiên | `SESSIONS_REVOKED` |

- Mỗi transaction khoá hàng user bằng `SELECT … FOR UPDATE`, hỏi `userActions`, rồi mới ghi
  — nếp `AdminEnquiriesService.setStatus` (plan, quyết định 2). Hai lệnh trên cùng một người
  xếp hàng, nên lệnh sau thấy trạng thái lệnh trước vừa ghi; luật hợp lệ chỉ sống ở
  `userActions`.
- `actorId` là Owner đang thao tác. `note` chỉ có ở `LOCKED`.
- `revokeSessions` thành công cả khi không có phiên nào (`revoked: 0`); trang chi tiết tắt nút
  khi số phiên sống là 0.
- Không gửi email cho người bị tác động.

## 5. Chặn đăng nhập khi khoá

- `auth.config.ts`:
  - `user.additionalFields.lockedAt: { type: 'date', required: false, input: false }`.
  - `databaseHooks.session.create.before`: đọc `locked_at` của `session.userId` bằng Prisma;
    có giá trị thì `throw new APIError('FORBIDDEN', { code: 'ACCOUNT_LOCKED', message:
    'This account is locked' })` (câu khách thấy lấy từ i18n theo mã, không từ `message`).
    Phủ mật khẩu, OTP email, Google, và mọi đường tạo phiên khác của Better Auth.
- `AuthGuard`: 401 khi `session.user.lockedAt != null`, cùng nhánh với `deletedAt`. Tra phiên
  của web và admin (`lib/api/session.ts`) cũng coi `lockedAt` như `deletedAt` — phiên coi như
  không có (plan, quyết định 9).
- `libs/shared/core/src/lib/auth-errors.ts`: `mapAuthError` nhận `ACCOUNT_LOCKED` → khoá
  `accountLocked`; copy ở `messages.authForms.errors.accountLocked` = "This account is locked.
  Contact us." Form đăng nhập web hiện qua đường `mapAuthError` sẵn có. Form admin không đi qua
  `mapAuthError` nên thêm nhánh riêng, câu riêng "This account is locked. Ask the site owner to
  unlock it." (plan, quyết định 4).
- **Đường Google:** `login-form.tsx` và `register-form.tsx` của web truyền
  `errorCallbackURL` về `/login` (giữ `redirect` nếu có). Trang `/login` đọc `?error=` và hiện
  qua `mapAuthError`; mã lạ rơi về câu generic.
- Không đổi: booking, chuyến, hoàn tiền, email giao dịch, webhook của người bị khoá.

## 6. Contract `admin.users`

| Thủ tục | Route | Input | Output | Lỗi |
| --- | --- | --- | --- | --- |
| `list` | `GET /api/admin/users` | `AdminPageQuerySchema` cùng `view` (`all`, `staff`, `locked`; mặc định `all`) và `search` (trim, 1–120) | `PagedSchema(AdminUserRowSchema)` | |
| `byId` | `GET /api/admin/users/{id}` | `{ id }` | `AdminUserDetailSchema` | `NOT_FOUND` |
| `setRole` | `POST /api/admin/users/{id}/role` | `{ id, role: 'CUSTOMER' \| 'STAFF' }` | `{ id, role }` | `NOT_FOUND`, `STATE_CHANGED` |
| `lock` | `POST /api/admin/users/{id}/lock` | `{ id, reason }` (trim, 1–500) | `{ id, lockedAt }` | `NOT_FOUND`, `STATE_CHANGED` |
| `unlock` | `POST /api/admin/users/{id}/unlock` | `{ id }` | `{ id }` | `NOT_FOUND`, `STATE_CHANGED` |
| `revokeSessions` | `POST /api/admin/users/{id}/sessions/revoke` | `{ id }` | `{ revoked }` | `NOT_FOUND`, `STATE_CHANGED` |

- `AdminUserRowSchema`: `id`, `name` (null được), `email`, `image` (null được), `role`,
  `status`, `createdAt`, `lastActiveAt` (null được).
- `AdminUserDetailSchema`: các trường của hàng, thêm `phone`, `emailVerified`, `lockedAt`,
  `lockReason` (ghi chú của dòng `LOCKED` mới nhất khi đang khoá, ngược lại null),
  `signInMethods` (`'password' | 'google'`, suy từ `accounts.provider_id`: `credential` →
  `password`), `counts { bookings, reviews, enquiries }`, `sessions { active, lastActiveAt }`,
  `history` (mọi dòng `user_events`, mới nhất trước; mỗi dòng `id`, `type`, `note`,
  `createdAt`, `actor { name } | null` với `name` = tên, thiếu thì email).
- `list`: loại tài khoản đã xoá; `view = staff` → `role = STAFF`; `view = locked` →
  `lockedAt` khác null; `search` khớp tên hoặc email (không phân biệt hoa thường); sắp
  `createdAt` giảm dần rồi `id`.
- `lastActiveAt` = `max(sessions.updated_at)` của user; `sessions.active` = số phiên có
  `expires_at > now`.

## 7. Giao diện admin

### 7.1 `/users`

- Ba tab All · Staff · Locked (query `?view=`), ô tìm, phân trang 20 dòng — cùng bộ bảng của
  các vùng khác.
- Cột: User (ảnh, tên, email), Role (chip Owner/Staff/Customer), Status (chip
  Active/Locked/Unverified), Joined (ngày), Last active (ngày, "—" nếu không có).
- Bấm một hàng mở `/users/[id]`.

### 7.2 `/users/[id]`

- **Đầu trang:** ảnh, tên, chip role, chip status, ngày tham gia (plan, quyết định 18).
- **Profile:** email, đã xác minh hay chưa, số điện thoại, cách đăng nhập.
- **Activity:** số booking, review, enquiry; link "View bookings" sang
  `/bookings?q=<email>&dates=all` (tìm theo email liên hệ của booking; `dates=all` vì URL trần
  của bảng tự lọc tháng hiện tại — plan, quyết định 7).
- **Sessions:** số phiên sống, lần hoạt động cuối, nút "Sign out everywhere" (tắt khi 0 phiên)
  kèm hộp xác nhận.
- **Access:** "Grant staff access" hoặc "Revoke staff access" theo `userActions`. Khách chưa
  xác minh hay đang khoá: KHÔNG có nút, câu của card nói vì sao (plan, quyết định 18). Hộp xác
  nhận thu hồi nói rõ người đó bị đăng xuất mọi nơi.
- **Lock:** "Lock account" mở hộp bắt buộc nhập lý do (ô ghi chú của kit `ConfirmWriteDialog`,
  trần 500, không bộ đếm — plan, quyết định 8); "Unlock account" là hộp xác nhận. Đang khoá thì
  hiện "Locked since …" và "Reason: …".
- **History:** dòng thời gian `history`, mỗi dòng "{actor} {hành động} · {thời điểm}", dòng
  khoá kèm lý do.
- **Owner:** chỉ đầu trang, Profile, Activity, History; thay Access/Lock/Sessions bằng dòng
  "Owner access comes from the server configuration and can't be changed here." (Owner đang
  khoá — ca hiếm — vẫn có nút Unlock.)
- `STATE_CHANGED` và `NOT_FOUND` là trạng-thái-cũ: kit đóng hộp, toast "This account changed
  while you were looking — the page has been refreshed." (hay câu NOT_FOUND tương ứng) rồi
  `router.refresh()` (plan, quyết định 19).
- Mọi thao tác là server action; trang chi tiết là server component động, nên làm tươi bằng
  `router.refresh()` phía client sau khi đã báo xong — không `revalidatePath` (plan, quyết định
  19).

### 7.3 Copy

Toàn bộ ở `messages.admin.users` (tiếng Anh) và `messages.authForms.errors.accountLocked`;
nhãn sidebar Users đã có sẵn.

## 8. Test & nghiệm thu

### 8.1 Unit (TDD)

- `canAccess`: ma trận role × khoá; danh sách 14 khoá Owner-only GHIM tường minh trong test.
- `userStatus`, `userActions`: đủ các nhánh của bảng 4.1.
- `mapAuthError`: `ACCOUNT_LOCKED` → `accountLocked`.
- `decideAdminAccess`: `STAFF` được qua; `CUSTOMER`, rỗng, lạ vẫn `deny`.
- Lọc sidebar theo role; `useCanAccess`.

### 8.2 Int (Postgres)

- **Quét quyền:** phiên Staff gọi mọi phần tử của `listAdminProcedures()` với body rỗng —
  `owner` phải 403, `staff` phải khác 403. Giữ số lượt ghi dưới trần 60/phút của tầng admin
  (hoặc dọn bucket giữa chừng).
- `admin.users.*`: đúng đường cho cả năm thao tác; phiên bị xoá đúng lúc; dòng sự kiện đúng
  loại, đúng actor, đúng note; Owner làm mục tiêu → `STATE_CHANGED`; tài khoản đã xoá →
  `NOT_FOUND`; Staff gọi `users.*` → 403.
- Khoá rồi đăng nhập bằng mật khẩu và bằng OTP → 403 `ACCOUNT_LOCKED`; mở khoá → đăng nhập
  lại được.
- Phiên tạo thẳng trong DB cho user bị khoá → API trả 401.
- Staff ghi trên bề mặt admin được hưởng trần 60/phút, không phải 20.
- `check-rls` xanh với `user_events`.

### 8.3 Mutation tay

Mỗi ca phải làm ít nhất một test đỏ: đổi một `@AdminImplement` của khoá Staff về
`@Implement`; bỏ hook `session.create.before`; bỏ vế `lockedAt` ở AuthGuard; bỏ bước xoá phiên
của `lock` và của `setRole → CUSTOMER`; đổi một dòng Owner-only thành `staff` trong bảng.

### 8.4 Thử tay trên prod sau merge (từng bước, chờ xác nhận)

1. Owner cấp Staff cho một tài khoản khách thử; lịch sử có dòng `STAFF_GRANTED`.
2. Đăng nhập admin bằng tài khoản Staff: sidebar không có Reports, Payment events, Users;
   chi tiết booking không có Refund mà có câu "Only the owner can issue refunds."; mở thẳng
   `/reports` về `/not-authorized` với khối "Owner only"; menu tài khoản ở góc dưới ghi Staff
   (plan, quyết định 5, 6, 10).
3. Staff sửa một tour hoặc duyệt một review được bình thường.
4. Owner thu hồi Staff: tab của Staff bị đẩy về đăng nhập.
5. Owner khoá tài khoản (có lý do): đăng nhập bằng mật khẩu và bằng Google đều hiện "This
   account is locked. Contact us."
6. Owner mở khoá: đăng nhập lại được; lịch sử đủ năm dòng theo đúng thứ tự.

## 9. Deploy

1. Migration lên Supabase (session gốc, sau review — luật 15): chỉ thêm, an toàn với code cũ.
2. Push main: Render (API) và Vercel (admin, web) tự deploy. Khe vài phút admin lên trước API
   thì `/users` lỗi; chưa có Staff nào nên không có rủi ro quyền.
3. Không env mới, không đổi webhook hay Cloudinary.

## 10. Đối chiếu Nexora (luật 10)

| Nexora | v2 | Phân loại |
| --- | --- | --- |
| `GET` list, `GET :id` | `users.list`, `users.byId` | Tương đương |
| `GET me` | session sẵn có (`account`) | Tương đương |
| `PATCH role` (đặt role bất kỳ) | `setRole` chỉ CUSTOMER ⇄ STAFF | Làm khác: ADMIN chỉ từ `ADMIN_EMAILS` (SEC-1) |
| `DELETE` user | không có | Cố ý bỏ: lách ba lớp chặn của luồng tự xoá; khoá thay thế |
| không có | Staff, khoá, thu hồi phiên, lịch sử | v2 tốt hơn |

Hạ tầng xuyên suốt: guard (fail-closed giữ), throttler (mở tầng admin cho Staff), RLS (bảng
mới có), CSP và boundary 403 không đổi.

## 11. Giới hạn đã biết

Như ADR-0052 mục "Giới hạn đã biết" (sáu điểm); thêm: link "View bookings" tìm theo email liên
hệ nên booking khách nhập email khác sẽ không hiện.
