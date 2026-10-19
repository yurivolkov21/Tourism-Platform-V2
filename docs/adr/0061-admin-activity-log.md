# ADR-0061 — Nhật ký thao tác admin: một bảng chỉ thêm, ghi tự động sau mỗi lệnh ghi thành công, chỉ Owner xem

- **Trạng thái:** Accepted (2026-10-19)
- **Bối cảnh thi hành:** mục 8 của bản rà "Việc còn thiếu ở api, web, admin" (19/10). Yuri chọn làm
  19/10 08:36 UTC và chọn "Chỉ Owner" cho câu hỏi ai xem trang lúc 08:49 UTC. Phạm vi đã gửi Yuri ở
  thư mục chung của project (`admin-audit/pham-vi-nhat-ky-thao-tac.md`). Đi trước code theo luật
  CLAUDE.md #5. Chi tiết từng thao tác ở
  [spec 19/10](../specs/2026-10-19-admin-activity-log-design.md).
- **Liên quan:** [ADR-0010](0010-infra-hardening.md) (Sentry seam) ·
  [ADR-0024](0024-deploy-targets.md) AMEND 4 (trần pool) ·
  [ADR-0026](0026-p4-admin-app.md) (app admin) ·
  [ADR-0037](0037-default-write-throttle.md) (trần ghi) ·
  [ADR-0052](0052-admin-staff-tier.md) (Owner và Staff, bảng quyền `ADMIN_ACCESS`, `user_events`)

## Bối cảnh

1. Vết thao tác admin hiện chỉ nằm trong log Render (bản rà bảo mật 05/09, cụm 8), mà Render chỉ giữ
   log khoảng một tuần. Owner không có cách trả lời "ai đã gỡ bán tour này" hay "ai hoàn tiền đơn kia".
2. Chỉ vùng Users có lịch sử riêng (`user_events`, ADR-0052). Ba lượt xuất Excel chỉ ghi một dòng
   `console.info` ở function Vercel.
3. API có 37 thủ tục admin ghi dữ liệu, rải ở 16 controller. Mọi handler admin đã đi qua MỘT cửa:
   `@AdminImplement`, decorator gắn route và quyền từ `ADMIN_ACCESS`.
4. `@orpc/nest` gọi method của controller mỗi request (sau guard, với tham số như `@CurrentUser()`
   đã giải), nhận về procedure, rồi `ImplementInterceptor` chạy procedure ấy. Procedure có `.use()`
   nối thêm middleware; middleware nối sau chạy SAU bước kiểm input và nhận output của handler (đọc
   ở `@orpc/server` 1.14.15, `executeProcedureInternal`).
5. Nexora không có nhật ký thao tác; đây là phần v2 thêm.

## Quyết định

### 1. Một bảng `admin_activity`, chỉ thêm

Mỗi dòng: `created_at`; người làm (`actor_id` trỏ `users`, `ON DELETE SET NULL`, cộng `actor_label`
và `actor_role` chụp lúc ấy, để dòng còn đọc được khi tài khoản đổi tên, đổi bậc hay mất); `action`
(khoá thao tác, ví dụ `tours.setPublished`); `area` (phần đầu của khoá, cho bộ lọc); đối tượng
(`target_type`, `target_id`, `target_label` chụp lúc ấy, cả ba có thể trống); `details` (jsonb, một
object phẳng vài giá trị ngắn như số tiền hoàn hay trạng thái mới). Ba chỉ mục: theo thời gian, theo
người làm và thời gian, theo khu vực và thời gian.

Không thủ tục nào sửa hay xoá dòng. RLS bật như mọi bảng (default deny, không policy).

### 2. Ghi cái gì: bảng phân loại ở contract, đủ mọi thủ tục admin

`ADMIN_ACTIVITY` cạnh `ADMIN_ACCESS`: mỗi thủ tục `contract.admin.*` một dòng `'log'` hoặc `'skip'`,
`satisfies Record<AdminProcedureKey, …>`. Thêm thủ tục admin mới mà chưa quyết nó có vào nhật ký hay
không là typecheck đỏ, cùng cách `ADMIN_ACCESS` buộc quyết quyền.

- `'log'`: 37 lệnh ghi (spec §3).
- `'skip'`: mọi lệnh chỉ đọc, bốn lệnh ký tải ảnh lên (chưa đổi gì; ảnh chỉ thành dữ liệu khi lệnh lưu
  sau đó chạy, và lệnh ấy được ghi), và hai thủ tục của chính nhật ký.
- Ba lượt xuất Excel là ba khoá riêng `bookings.export`, `subscribers.export`, `reports.export` (§5).

Lệnh thất bại không ghi: không có gì đổi, và lỗi đã có ở log Render.

### 3. Ghi ở đâu: `@AdminImplement` tự gắn, không controller nào tự gọi

Với thủ tục `'log'`, `@AdminImplement` gắn thêm một interceptor Nest nằm TRONG `ImplementInterceptor`.
Interceptor nhận procedure mà method trả về, nối một middleware oRPC bằng `.use()`, rồi trả procedure
đã nối cho `ImplementInterceptor` chạy. Middleware có input đã kiểm, gọi `next()`, và khi handler trả
về thành công thì ghi một dòng với người làm lấy từ `request.sessionUser` (AuthGuard đã gắn).

Phần riêng của từng thao tác (đối tượng là gì, nhãn đọc được, chi tiết nào) nằm ở một bảng mô tả trong
API, `satisfies` đủ mọi khoá `'log'`: thiếu một mô tả là typecheck đỏ. Mô tả đọc input và output; lệnh
xoá có thêm một bước đọc nhãn TRƯỚC khi handler chạy, vì sau đó đối tượng không còn.

Bác bỏ: (a) gọi ghi nhật ký tay trong 37 handler, vì quên một chỗ là lỗ không ai thấy; (b) interceptor
Nest đọc body thô, vì `@orpc/nest` đọc body lười và mỗi adapter một kiểu, còn middleware có sẵn input
đã kiểm và output.

### 4. Ghi sau khi thao tác thành công, lỗi ghi không làm hỏng thao tác

Dòng nhật ký ghi sau khi handler xong, nên sau transaction của chính thao tác. Ghi lỗi thì log một dòng
và đẩy Sentry seam, response giữ nguyên: thao tác đã xảy ra, báo lỗi lúc này dễ khiến admin bấm lại và
làm hai lần. Nhật ký vì vậy là vết để tra, không phải sổ cái: vết tiền vẫn là `refunds` và
`payment_events`; `user_events` giữ nguyên vai lịch sử từng tài khoản ở trang Users.

### 5. Ba lượt xuất Excel ghi qua thủ tục riêng

Xuất Excel chạy ở route của app admin, gom trang bằng các lệnh đọc nên API không phân biệt được với
xem trang. Route gọi `admin.activity.recordExport` (bậc `staff`, vì Staff xuất được bookings và
subscribers) một lần khi file đã dựng xong: loại, số dòng, chọn hàng hay cả tập, và bộ lọc ở dạng
có hay không (như `logExportAudit` hiện làm, không chép chuỗi tìm kiếm). Lượt xuất lỗi không ghi.

### 6. Dữ liệu cá nhân: chỉ nhãn tối thiểu, không nội dung

Không chép nội dung đã sửa, không lưu bản trước và sau. Nhãn đối tượng không bao giờ là email, số điện
thoại hay dữ liệu thanh toán của khách: đơn là mã đơn, người nhận tin không có nhãn (email là danh tính
duy nhất của họ), tài khoản là tên hiển thị. Chi tiết chỉ là giá trị ngắn có kiểu (số tiền, trạng thái,
bậc, số ảnh). Nhãn người làm là tên, trống thì email của chính admin ấy.

### 7. Chỉ Owner xem, link tới đối tượng nếu nó còn

`admin.activity.list` bậc `owner`: phân trang, mới nhất trước, lọc theo người làm, khu vực, khoảng
ngày. Response kèm danh sách người làm có trong nhật ký cho ô lọc, và với mỗi dòng là khoá đường hiện
tại của đối tượng (slug, mã đơn, id) nếu nó còn, đọc theo lô từng loại. Trang `/activity` của admin
dựng link từ khoá ấy; đối tượng đã xoá thì chỉ còn nhãn chụp lúc ấy. Staff không thấy mục Activity.

### 8. Lưu giữ và seed lại

Không tự xoá dòng cũ: dự kiến vài trăm dòng mỗi tháng. `data:reset` (lượt seed lại khoảng 03/11) xoá
sạch bảng cùng tầng vận hành, vì phần lớn dòng trỏ tới đơn và tài khoản bị xoá ở bước ấy.

## Hệ quả

- Mỗi lệnh ghi của admin thêm một câu INSERT trên pool Prisma sẵn có; không thêm client Postgres, trần
  pool của ADR-0024 AMEND 4 không đổi.
- Một migration (một bảng); Yuri chạy tay trên Supabase trước khi đẩy main, như G25.
- Thủ tục admin mới phải quyết cả quyền (`ADMIN_ACCESS`) lẫn nhật ký (`ADMIN_ACTIVITY`), và nếu là
  `'log'` thì phải có mô tả ở API.
- Không xem lại được thao tác trước ngày bật.
