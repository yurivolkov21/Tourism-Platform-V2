# ADR-0052 — Nhân sự admin hai bậc: Owner từ `ADMIN_EMAILS`, Staff do Owner cấp; bảng quyền ở contract; khoá tài khoản chặn tạo phiên

- **Trạng thái:** Accepted (2026-10-02)
- **Bối cảnh thi hành:** P4f vùng Users, đi trước code theo luật CLAUDE.md #5. Thiết kế chốt qua
  brainstorm 02/10, từng câu một, bốn phần thiết kế duyệt trong chat.
- **Liên quan:** [ADR-0003](0003-auth-fail-closed.md) (fail-closed) ·
  [ADR-0026](0026-p4-admin-app.md) AMEND 1 §B (blast radius), §C (SEC-1), §D (runbook và ba
  bất biến), AMEND 3 §B (boundary 403) · [ADR-0017](0017-web-session-better-auth.md) (Better Auth,
  xác minh email) · [ADR-0037](0037-default-write-throttle.md) (trần ghi) · spec
  [2026-10-02-p4f-users-staff-design.md](../specs/2026-10-02-p4f-users-staff-design.md)

## Bối cảnh

Admin mới có MỘT bậc. Năm sự thật đo được quyết định thiết kế:

1. `UserRole` là `CUSTOMER | ADMIN`; mọi controller admin mang `@Roles(ADMIN)` cấp class; app
   admin cho vào khi `role === 'ADMIN'`. Ai vào admin cũng có toàn quyền tiền (hoàn tiền,
   huỷ chuyến, sổ thanh toán).
2. Đường lên ADMIN duy nhất là `ADMIN_EMAILS` (SEC-1): hook sau xác minh email và reconcile
   lúc boot, cả hai CHỈ nâng. Một nút "hạ admin" trên UI bị reconcile lật lại ở lần boot kế
   nếu email còn trong biến.
3. Hạ quyền và đá phiên hiện là SQL tay (runbook ADR-0026 AMEND 1 §D). Không có cách nào
   chặn một tài khoản đăng nhập.
4. Nexora có danh sách, chi tiết, `PATCH role` và `DELETE` user; không có bậc hạn chế.
5. Prod 02/10: 1 ADMIN, 123 CUSTOMER, 0 tài khoản đã xoá, 10 phiên sống.

## Quyết định

### 1. Hai bậc: Owner là `ADMIN` hiện có, Staff là role mới `STAFF`

- **Owner** chỉ đến từ `ADMIN_EMAILS` — SEC-1 nguyên vẹn. Giao diện không bao giờ tạo, hạ,
  khoá hay đá phiên của Owner; chỉ xem.
- **Staff** do Owner cấp cho một tài khoản khách CÓ SẴN đã xác minh email (CUSTOMER ⇄ STAFF).
  Không có lời mời, không tạo tài khoản từ admin. Staff vẫn là khách: đặt tour, viết review
  như mọi người (không chỗ nào của web hay API đòi `role === 'CUSTOMER'`).
- Enum giữ tên `ADMIN`: đổi tên chạm SEC-1, reconcile, runbook và hàng loạt test; "Owner" chỉ
  là nhãn giao diện.
- Ba bất biến của ADR-0026 AMEND 1 §D đứng vững bằng cấu trúc: Owner không hạ được qua UI nên
  không ai tự hạ mình hay hạ Owner cuối cùng; thu hồi Staff luôn xoá mọi phiên của người đó.

### 2. Bảng quyền là MỘT bảng gõ kiểu chặt trong contract

- `ADMIN_ACCESS` ghi mỗi thủ tục `admin.*` là `owner` hay `staff`, ràng bằng
  `satisfies Record<AdminProcedureKey, AdminAccessLevel>` — thiếu hay thừa một khoá là
  typecheck đỏ. API và app admin đọc cùng bảng.
- **Owner-only (14):** `bookings.refund`, `departures.cancel`, `reports.monthly`,
  `paymentEvents.list`, `paymentEvents.byId`, `stats.paymentEvents`, `tours.delete`,
  `posts.delete` và sáu thủ tục `users.*`. **48 thủ tục còn lại** Staff dùng được, gồm
  dashboard có doanh thu và các nút xuất CSV của bookings, subscribers.
- Bảng nằm ở module riêng, import được mà không kéo barrel contract vào chunk client: sidebar
  là chunk client dùng chung và `nav.ts` đã cố ý tránh barrel.

### 3. API áp bảng bằng một decorator; lưới cũ giữ nguyên

- `@AdminImplement(procedure)` gộp `@Implement(procedure)` với `@Roles(...)` suy từ bảng
  (`owner` → `[ADMIN]`, `staff` → `[ADMIN, STAFF]`). Khoá tra bằng cách duyệt
  `contract.admin`; thủ tục không nằm trong đó thì boot lỗi ngay.
- `@Roles(ADMIN)` cấp class ở mọi controller admin GIỮ NGUYÊN: handler nào quên đổi
  decorator thì chỉ Owner vào được (fail-closed, ADR-0003). AuthGuard đã đọc handler trước
  class nên không đổi logic role.
- Canh bằng hai test: int test gọi TOÀN BỘ thủ tục admin bằng phiên Staff, method và path đọc
  từ contract (khoá `owner` phải 403, khoá `staff` phải khác 403 — guard chạy trước khi oRPC
  đọc input); unit test ghim tường minh danh sách Owner-only, sửa bảng là phải sửa test.
- Trần ghi admin (ADR-0037) áp cho cả STAFF trên bề mặt admin.

### 4. Khoá tài khoản là chặn TẠO phiên; mọi thứ khác chạy tiếp

- Cột `users.locked_at`. Khoá xoá mọi phiên ngay trong cùng transaction.
- Hook `databaseHooks.session.create.before` ném 403 mã `ACCOUNT_LOCKED` khi user có
  `locked_at` — đúng cơ chế plugin `admin` của Better Auth 1.6.23 dùng cho user bị ban (đã đọc
  mã nguồn) — phủ cả ba đường đăng nhập: mật khẩu, OTP email, Google.
- AuthGuard trả 401 cho user có `lockedAt`, như với `deletedAt`: bịt khe hở giữa lúc hook
  kiểm và lúc phiên được ghi.
- Booking, chuyến đi, hoàn tiền, email giao dịch không đổi. Lý do khoá bắt buộc, chỉ nội bộ.
  Mở khoá bất cứ lúc nào. Áp cho Customer và Staff; không bao giờ khoá Owner.

### 5. Lịch sử theo người dùng: bảng `user_events` chỉ ghi thêm

- Năm loại sự kiện: `STAFF_GRANTED`, `STAFF_REVOKED`, `LOCKED`, `UNLOCKED`,
  `SESSIONS_REVOKED`; mỗi dòng mang người làm, ghi chú (lý do khoá) và thời điểm. Ghi trong
  cùng transaction với thao tác; không có đường sửa hay xoá. Khuôn `enquiry_status_events`.
- Việc của hệ thống (reconcile đưa một Staff lên Owner) không ghi.

## Phương án đã cân nhắc và bỏ

- **Nâng/hạ ADMIN qua UI, không có bậc Staff.** Reconcile lúc boot lật lại; muốn giữ phải đổi
  `ADMIN_EMAILS` thành "chỉ gieo lần đầu" — mở lại một quyết định an ninh sát freeze. Ai được
  nâng cũng có toàn quyền tiền.
- **Plugin `admin` của Better Auth.** Có sẵn ban, `setRole`, thu hồi phiên, nhưng mở
  `/api/auth/admin/*` nằm ngoài contract, guard, throttler và bảng lịch sử — hai hệ phân quyền
  chồng nhau; `setRole` của nó đặt được cả ADMIN, phá SEC-1. Chỉ mượn cơ chế chặn tạo phiên.
- **Khai quyền trên từng route** (`@Roles(ADMIN, STAFF)` rải ở controller). Ít file hơn nhưng
  app admin phải tự nhớ nút nào ẩn — hai bản có thể lệch nhau mà không test nào thấy.
- **Quyền tuỳ chỉnh cho từng Staff.** Thêm bảng quyền, UI ma trận, test tổ hợp — không đáng cho
  một nhóm vài người trước freeze.
- **Khoá chặn cả đặt tour và huỷ booking.** Chạm money-path, email, hoàn tiền; khách đã trả
  tiền mà bị khoá thì chuyến vẫn phải chạy.
- **Admin xoá tài khoản như `DELETE` của Nexora.** Lách ba lớp chặn của luồng khách tự xoá
  (booking đã trả, checkout đang mở, yêu cầu huỷ đang chờ); khoá thay thế.
- **Cột `lock_reason` trên `users`.** Trùng với `note` của dòng `LOCKED` — hai chỗ giữ một sự
  thật.

## Giới hạn đã biết

1. Hạ một Owner vẫn là runbook SQL của ADR-0026 AMEND 1 §D (gỡ email khỏi `ADMIN_EMAILS`
   trước).
2. Staff dùng chung cookie với www (`crossSubDomainCookies`): một XSS ở www cưỡi được phiên
   Staff để gọi 48 thủ tục Staff — cùng loại rủi ro với Owner hôm nay (AMEND 1 §B), phạm vi
   hẹp hơn. Khoá hoặc thu hồi phiên là đường xử lý.
3. "Lần hoạt động cuối" lấy từ `sessions.updated_at`; Better Auth gia hạn phiên tối đa một
   lần mỗi ngày nên con số chính xác tới ngày, và đăng xuất xoá dòng phiên nên nó chỉ phản
   ánh các phiên còn lại.
4. Google: Better Auth đổi lỗi `ACCOUNT_LOCKED` thành redirect `errorCallbackURL?error=…`;
   web phải truyền `errorCallbackURL`, thiếu thì khách rơi vào trang lỗi mặc định ở domain
   API.
5. App mobile chỉ hiện câu báo khoá nếu nó dùng `mapAuthError` chung của `@tourism/core`.
6. Reconcile đưa một Staff lên Owner không để lại dòng lịch sử.
