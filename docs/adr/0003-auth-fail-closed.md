# ADR-0003 — Auth mặc định fail-closed (global guard + `@Public()`)

- **Trạng thái:** Accepted (2026-07-19)
- **Bối cảnh:** phát hiện A5 trong
  [quét sâu Nexora](../analysis/2026-07-19-nexora-deep-sweep.md)

## Bối cảnh

v2 hiện đăng ký auth **opt-in từng controller**: route nào cần bảo vệ thì
tự gắn `@UseGuards(AuthGuard)`. Rà toàn bộ 10 controller hiện có thì **tất
cả đều đúng** — không có lỗ nào đang sống.

Nhưng kiến trúc này là **fail-open**: route mới sinh ra mặc định là public.
Nexora làm ngược lại — `APP_GUARD` toàn cục (`app.module.ts:72-75`) cộng
`@Public()` để opt-out, nên route mới mặc định **an toàn**.

Rủi ro không nằm ở hôm nay mà ở quy mô sắp tới: P4 (admin CRUD) thêm hàng
loạt controller quản trị, P5 (mobile), P6 (AI concierge). Chỉ cần một lần
quên gõ `@UseGuards` trên controller mới là endpoint mutation hoặc dữ liệu
nhạy cảm thành public hoàn toàn — và **không có gì bắt được**: compiler
không biết, Biome không biết, test mặc định không biết. Nó chỉ lộ ra khi bị
dò quét hoặc lúc pentest.

Đây cũng đúng loại lỗ mà đợt mutation-test 19/07 đã vạch: xoá
`@Roles(ADMIN)` khỏi controller admin mà **72/72 test vẫn xanh**.

## Quyết định

Đảo mặc định thành **fail-closed**:

1. `AuthGuard` đăng ký làm `APP_GUARD` toàn cục trong `app.module.ts`.
2. Thêm decorator `@Public()` để opt-out tường minh.
3. Endpoint public phải khai báo `@Public()` — im lặng không còn nghĩa là
   public.
4. Gỡ các `@UseGuards(AuthGuard)` ở method/controller đã thành thừa;
   `@Roles(...)` giữ nguyên (guard toàn cục vẫn đọc metadata đó).

Bề mặt public sau khi đổi (mọi chỗ khác mặc định cần auth):

| Nơi | Vì sao public |
| --- | --- |
| `catalog.controller` (6 endpoint) | Catalogue là nội dung marketing, khách chưa đăng nhập phải xem được |
| `health.controller` | Probe hạ tầng — nền tảng deploy gọi, không có session |
| `webhooks.controller` (2) | Stripe/PayPal gọi vào; xác thực bằng **chữ ký HMAC**, không phải session |
| `auth.controller` | Mount Better Auth — chính là nơi đăng nhập, không thể đòi đã đăng nhập |
| `reviews.listByTour` | Review đã duyệt hiển thị công khai trên trang tour |

## Hệ quả

- Route mới mặc định 401 cho khách ẩn danh. Quên khai `@Public()` gây lỗi
  **nhìn thấy ngay** (endpoint không chạy) thay vì lỗ hổng im lặng — đúng
  hướng đánh đổi: sai kiểu ồn ào tốt hơn sai kiểu âm thầm.
- `webhooks.controller` phải `@Public()`. Nếu quên, Stripe/PayPal nhận 401,
  webhook retry rồi bỏ cuộc → booking kẹt PENDING dù tiền đã trừ. Vì vậy
  **bắt buộc có integration test** cho nhánh này, không chỉ dựa vào review.
- Guard toàn cục chạy cho MỌI request, kể cả route public → thêm một lần
  đọc session. Chấp nhận được: `@Public()` short-circuit trước khi gọi
  `auth.api.getSession()`, nên route public không tốn thêm gì.
- Test phải canh chính cái mặc định: một controller mới **không khai gì**
  phải bị chặn. Không có test đó thì ADR này chỉ là lời hứa.

## Đã cân nhắc và loại

- **Giữ opt-in + thêm lint rule bắt mọi `@Controller` khai stance tường
  minh.** Loại: phải tự viết rule cho Biome (không có sẵn), và nó chỉ ép
  *khai báo* chứ không đổi *mặc định* — quên vẫn là quên, chỉ khác chỗ báo.
- **Chỉ gắn global guard cho nhánh `/api/admin/*`.** Loại: bỏ sót đúng
  nhóm nguy hiểm thứ hai — endpoint khách hàng đọc/ghi dữ liệu cá nhân
  (booking, review, wishlist) không nằm dưới `/admin`.
