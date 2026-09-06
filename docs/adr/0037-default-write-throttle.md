# ADR-0037 — Trần ghi MẶC ĐỊNH: ThrottlerGuard toàn cục, route ghi mới sinh ra đã có trần

- **Ngày:** 2026-09-06
- **Trạng thái:** Chấp nhận (đợt W2 `fix/auth-infra-hardening`, ADR đi trước code)
- **Liên quan:** [ADR-0003](0003-auth-fail-closed.md) (khuôn mẫu fail-closed
  toàn cục mà ADR này áp lại cho throttle), [ADR-0010](0010-infra-hardening.md)
  (nơi khai sinh rate limit opt-in), ADR-0029 AMEND 6 (ghi nợ "cân nhắc guard
  toàn cục"), bản rà 05/09 cụm 2/6 (`config/throttle.ts` "cố ý opt-in" bị điểm
  danh là lưới thiếu).

## Bối cảnh

Rate limit hiện là OPT-IN từng route: controller tự gắn
`@UseGuards(ThrottlerGuard | AuthedWriteThrottlerGuard)` +
`@Throttle({ default: … })`. Sau W1, đếm được **11 cặp decorator lặp** (9 ở
bề mặt khách: bookings create/checkout/cancel/cancelPending, reviews
create/update, wishlist.set, avatar, delete account; 2 ở admin: refund,
cancellations.decide) — và lịch sử của chính repo chứng minh mô hình opt-in
thua: `bookings.create/checkout` (mỗi lần gọi = một session provider THẬT)
sống KHÔNG trần từ P2 tới W1, vì "nhớ gắn decorator" không phải là một cơ
chế. Đây đúng dạng lỗ mà ADR-0003 đã xử cho auth: mặc định phải an toàn,
route mới quên khai thì hành vi phải là CÓ lưới chứ không phải không.

## Quyết định

Một guard toàn cục (`APP_GUARD`, chạy SAU AuthGuard để đọc được
`sessionUser`) áp trần cho MỌI route theo bảng:

| Route | Trần | Bucket |
| --- | --- | --- |
| GET/HEAD/OPTIONS | **không đếm** | — |
| non-GET, có session | `AUTHED_WRITE_THROTTLE` (20/60s) | `user.id` |
| non-GET, `@Public()` | `PUBLIC_WRITE_THROTTLE` (5/60s) | IP |
| `@Throttle({ default: X })` per-route | **X thắng mặc định** | theo guard |
| `@SkipThrottle()` | miễn — ngoại lệ TƯỜNG MINH, phải kèm lý do trong comment | — |

- **GET không đếm** — đường đọc công khai (catalogue) có mô hình dùng khác
  hẳn và đã có kết luận riêng ở bản rà (cache-control + PUBLIC_READ, đợt
  W4); đếm chung là khoá nhầm người thật, đúng lý do ADR-0010 từng chọn
  opt-in. ADR này chỉ đảo mặc định cho đường GHI.
- **Bucket theo `user.id` cho route đã auth** (fail-closed như
  `AuthedWriteThrottlerGuard` W1: non-GET không session mà không `@Public()`
  → 401): theo IP thì NAT bị khoá oan còn pool IP xoay lách được.
- **Trần riêng đang có GIỮ NGUYÊN, khai per-route qua `@Throttle`**:
  `WEBHOOK_THROTTLE` (600/60s theo IP — webhook là `@Public()` nhưng
  delivery thật burst theo dải IP hẹp của provider, 5/60s giết nó),
  `SIGN_UPLOAD_THROTTLE` (20/60s), và trần riêng cho `/api/auth/*`
  (AuthController — W2 mục 3). Guard toàn cục chỉ là ĐÁY.
- **11 cặp decorator lặp bị GỠ** — chúng nay là bản chép của mặc định.
  Route nào cần khác mặc định thì decorator per-route là nơi khai; giống
  mặc định mà vẫn khai là hai nguồn sự thật.
- **Nghiệm thu bằng int test đúng bản chất lưới**: một route ghi thử KHÔNG
  khai gì (dựng trong test module) vẫn bị trần chặn ở request thứ N+1 —
  test này canh cái "mặc định", không phải canh từng route.

## Hệ quả

- Route ghi mới từ nay có trần từ lúc sinh ra; quên là an toàn, nhớ mới
  phải hành động (`@SkipThrottle`/`@Throttle` riêng) — đảo đúng chiều.
- Webhook (`@Public()` + non-GET) BẮT BUỘC giữ `@Throttle` webhook riêng —
  rơi về 5/60s là tự tay bóp delivery thật; int test webhook hiện có canh.
- Storage vẫn in-memory per-process — ghim `numInstances: 1` (ADR-0024
  AMEND 2); guard toàn cục không đổi ràng buộc đó, chỉ mở rộng diện phủ.
- `ThrottlerModule.forRoot` vẫn khai default `PUBLIC_WRITE_THROTTLE`;
  logic chọn trần authed/public sống trong guard (một chỗ), không rải cấu
  hình theo module.

## Phương án đã cân nhắc rồi loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ opt-in, thêm lint/checklist "route ghi phải có throttle" | Checklist là trí nhớ mặc đồng phục; đã thua ở CHANGELOG (luật 13, 8 merge liên tiếp) và ở chính bookings.create. Máy canh được thì đừng giao cho người. |
| Trần toàn cục cho CẢ GET | Khoá nhầm người đọc thật (một trang tour = nhiều fetch), trong khi rủi ro đường đọc là cạn pool DB — thuốc đúng của nó là cache + trần đọc riêng (W4), không phải trần ghi. |
| Đếm mọi route theo IP cho đơn giản | Đã bác từ W1: NAT/proxy chung IP bị khoá oan theo nhau, pool IP xoay vòng lách sạch — trần theo IP trên route authed là trần giấy. |
| Store chung (Redis) ngay đợt này | Đổi hạ tầng deploy sát freeze 15/10 chỉ để phục vụ scale ngang chưa tồn tại (`numInstances: 1`). Ghi điều kiện tiên quyết ở ADR-0024 AMEND 2 là đủ. |
