# Redesign khu account — thay da, đóng ba khoản nợ

- **Trạng thái:** ✅ Đã thi hành 10/08 — xem [plan](../plans/2026-08-10-account-redesign.md)

> ⚠️ **AMENDED 10/08 — hai chỗ spec nói khác code đã ship:**
>
> **§2 "cắt 4, hoãn 1, thêm 1, dựng 1".** Mục "Member since" (thêm một field
> additive vào `AccountMe`) KHÔNG làm: trang hồ sơ sau redesign là danh sách
> tóm tắt bốn dòng, không còn chỗ nào tự nhiên để đặt nó, và mở contract cho
> một dòng trang trí là không đáng. Field additive DUY NHẤT thật sự thêm là
> `reviewedAt` cho cụm B.
>
> **§6 "tách hook trước khi vẽ lại".** Không làm — mục đích của nó là để spec
> bám hook thay vì bám DOM, nhưng markup của cả 5 màn đều đổi thật nên spec
> phải viết lại bằng mọi giá. Hai việc còn lại của bước chuẩn bị (gom khối lỗi
> chép 4 lần, dời `TONE_CLASS` khỏi component màn hình) mới là thứ thật sự gỡ
> được ràng buộc chéo.
- **Nền:** [ADR-0019](../adr/0019-color-token-roles.md) (tách vai token màu) ·
  [ADR-0016](../adr/0016-web-data-layer.md) (tầng dữ liệu web) ·
  [ADR-0017](../adr/0017-web-session-better-auth.md) (session cookie)
- **Mockup:** [account-area.src.html](../design/mockups/account-area.src.html)
  (commit `13bc78e`)
- **Nợ đóng:** A1 (thiết kế lại) · A2 (ô lý do huỷ) · A3 (tương phản dark)
- **Branch:** `feat/account-redesign`

## 0. Luật cứng của cụm này

**Đây là thay da, không phải xây lại.** Khu account "dựng tạm" chỉ tạm ở phần
NHÌN. Dữ liệu và hành động là thật hoàn toàn: session forward cookie, checkout,
cancel-pending, cancel, đổi mật khẩu, xoá tài khoản. Phần wire đó ngốn 8 task
và 4 bug thật mới xong. Bốn thứ **tuyệt đối không được gỡ**:

| Phải giữ | Vì sao | Bằng chứng |
| --- | --- | --- |
| Tham số thứ hai `cancellation` của `bookingView` | Bỏ đi là âm thầm quay về "luôn hiện Request cancellation"; typecheck vẫn xanh vì tham số optional | `account/bookings/[code]/page.tsx:73` |
| Field "Current password" | Bắt buộc của Better Auth `changePassword`; gộp/bỏ là mutation chết | `change-password-form.tsx:69` |
| `DELETE` trong CORS `methods` | Thiếu thì `DELETE /api/account` chết ở preflight trên mọi browser | `apps/api/src/bootstrap.ts:60` |
| `proxy.ts` kiểm CẢ HAI tên cookie session | Thiếu tên `__Secure-` từng gây lockout loop `/account` trên prod (bug I-1) | `apps/web/src/proxy.ts:20` |

Thêm hai bẫy kiểu khác:

- `item.unavailable` PHẢI đi qua `UnavailableCard`, không qua `TourCard` —
  `TourCard` render link cứng `/tours/{slug}` mà tour đã unpublish thì đích đó
  chết (bug đã sửa ở `5a78fbb`, hai spec đang canh).
- `wishlistToTourCardVM` phải ở lib thuần, KHÔNG được dời vào file
  `'use client'` — `AccountDashboard` là Server Component gọi hàm này, Next 16
  chặn cứng ở build production.

## 1. Phạm vi

**Trong:** 5 màn thật (`/account`, `/bookings`, `/bookings/[code]`, `/profile`,
`/saved`) · nav khu account · nợ A2 · nợ A3 theo ADR-0019.

**Ngoài:** cụm B (tim wishlist trên catalogue, form review) — mockup đã chừa
slot, cụm này chỉ dựng chỗ trống đúng kích thước, không nối dây. `/two-factor`
vẫn PARK theo ADR-0017 §5b.

## 2. Mockup vẽ 7 chi tiết không có dữ liệu nuôi — xử lý từng cái

Luật cứng #4 của design brief: **không bịa dữ liệu trông như thật**. Quyết
định cho từng chi tiết:

| Chi tiết trong mockup | Nguồn dữ liệu | Xử lý |
| --- | --- | --- |
| Chuỗi điểm đến trên thẻ next-trip ("Hạ Long → Huế → …") | Không có. `BookingSchema` là **snapshot**, cố ý không mang | **CẮT** |
| "departs from Hà Nội" | Không có. `meetingPoint` chỉ ở `TourDetailSchema`, không phải bề mặt booking | **CẮT** |
| Hàng "Google — Connected" | Không có. `/api/account/me` không trả danh sách provider | **CẮT** — giữ đúng hàng "Email & password" có thật |
| Card tour đã lưu: "2 days · Nature", giá gạch $74 → $62 | Không có. `WishlistItemSchema` không mang `category`/`compareAtPrice` | **CẮT** — VM hiện đang phải bịa `{slug:'',name:''}`; đừng hợp thức hoá |
| Cờ "booking này đã review rồi" | Không có | **HOÃN sang cụm B** (cần field additive); slot dựng sẵn |
| "Member since Jul 2026" | `users.created_at` có trong DB, chưa phơi ra web | **THÊM** — additive `createdAt` vào `AccountMeApiResponse`, một field |
| "expires in 52 minutes" cho PENDING | **CÓ SẴN** — `BookingSchema.createdAt` + `pendingExpiry()` từ cụm C | **DỰNG** |

Hai dòng cuối là chỗ nhánh rà báo sai và đã kiểm lại: `createdAt` có ở
`bookings.ts:87`, `pendingExpiry()` có ở `lib/checkout.ts:47`.

Ngoài ra mockup vẽ trạng thái "Add to request" (bổ sung ghi chú vào đơn huỷ
đang mở) — **CẮT**, contract không có procedure nào phục vụ; gọi lại
`bookings.cancel` ở trạng thái đó chỉ nhận 409 `ALREADY_REQUESTED`.

## 3. Nợ A2 — ô lý do huỷ

Hiện `DEFAULT_CANCELLATION_REASON = 'Requested via account portal.'` hardcode
tại `booking-actions.tsx:33`. Chuỗi này **được gửi ngược cho chính khách** qua
email: `Your reason: ${reason}` (`resend.deliverer.ts:198`). Đây là copy sai
đang sống, không phải nợ thẩm mỹ.

**Quyết định (user chốt 08/08): lý do BẮT BUỘC nhập.** Contract đang là
`reason: z.string().min(1).max(1000)`; theo contract, sửa nhãn thay vì sửa
contract. Thuần web — không đụng API, không migration, cột `VarChar(1000)` đã
đúng trần.

- Ô nhập **chỉ gắn vào nhánh PAID** (`requestCancellation` /
  `resubmitCancellation`). Tuyệt đối không gắn vào dialog `cancelPending` —
  `cancelPending` nhận input chỉ `{code}`, không lý do, không admin, không
  đụng ghế.
- Copy lấy từ khối i18n **mồ côi** đã có sẵn tại `messages.booking.detail`
  (`reasonLabel`, `reasonPlaceholder`, `submitRequest`, `submitting`,
  `requestSent`, `requestError`) — 0 consumer, đúng chỗ cần. Sửa
  `reasonLabel` từ "Reason (optional)" thành bắt buộc.
- Bộ đếm ký tự: trần **1000**, không phải 500. (Mockup `booking-flow` ghi
  "0 / 500" — đó là trần `decisionNote` của admin, nhầm.)
- Tiện tay vá `classifyActionError` (`booking-actions.tsx:43`): hiện chỉ phân
  401/429/generic, nên 409 `ALREADY_REQUESTED` và 422 `NOT_CANCELLABLE` rơi
  hết vào generic — trong khi i18n **đã có** copy riêng cho đúng hai ca này.
- Xoá nhánh JSX dùng `deniedNote`: prop này LUÔN null (contract khách cố ý
  không mang `decisionNote`) nên đó là code chết. Thay bằng câu cố định + link
  `/cancellation-policy`.

## 4. Nợ A3 — token, theo ADR-0019

Thi hành 5 mục quyết định của ADR-0019. Việc trong nhánh này:

1. Thêm token vai chữ (dark `L 0.76`, light giữ `0.494`).
2. `ring` / `sidebar-ring` dark 0.563 → 0.60.
3. `sidebar-primary`, `chart-1` về đúng vai.
4. `input` nâng đạt 3:1 (dark `L ≥ 0.58`, light `L ≈ 0.66`); **`border` giữ
   nguyên** vai trang trí.
5. Nút primary ở dark nhận viền hairline mang ranh giới 3:1.
6. Sửa comment sai số tại `region-hero.tsx:163` (ghi 4.11, đo thật 4.72).

Đổi token là việc TOÀN SITE, không riêng khu account — nên chạy `pnpm gate`
sau bước này để bắt chỗ vỡ ngoài phạm vi.

## 5. Năm màn — thay đổi cấu trúc

Mockup không đổi da, nó **đảo cấu trúc thông tin**. Tóm tắt khác biệt:

- **`/account`** — mở bằng thẻ chuyến kế tiếp (lifted, countdown 2rem), rồi 2
  ô số (thay 4), rồi "Recent bookings" dạng sheet. Bỏ khối 3 tour đã lưu.
  "Recent bookings" liệt kê **cả CANCELLED**, tức phép chọn KHÁC
  `upcomingBookings` hiện tại (chỉ PENDING/PAID, chỉ tương lai) → cần hàm
  thuần mới, không tái dùng được.
- **`/account/bookings`** — 3 nhóm thời gian (On the road now / Upcoming /
  Past) trên sheet hairline, thay list card phẳng.
- **`/account/bookings/[code]`** — thêm ô lý do huỷ (§3); slot form review
  (cụm B) dựng chỗ trống.
- **`/account/profile`** — summary-list đọc-trước kiểu GOV.UK: mỗi dòng có
  link "Change", chỉ dòng đang sửa nở thành form với Save riêng. Thay hai form
  luôn mở. Mockup **bỏ hẳn avatar**.
- **`/account/saved`** — giữ lưới, bỏ hai field không có dữ liệu (§2).

Ngoài ra: pill trạng thái đổi công thức (nền tone pha 18% vào card, viền tone
45%, **chữ luôn là `--foreground`**) — thay `text-success`/`text-warning` trần
đang trượt AA (3.26 và 2.01). Danger zone hạ giọng. Nav đổi sang chip nền
`accent`, nhãn đầu "Overview".

## 6. Test — đây là rủi ro lớn nhất của cụm

7 file spec (53 test) bám **rất sâu vào markup**, sẽ đỏ hàng loạt dù UI đúng:

| Spec | Bám vào | Vỡ khi |
| --- | --- | --- |
| `account-dashboard.spec.tsx:54` | `getAllByText('1')).toHaveLength(3)` | bất kỳ phần tử nào in số `1` trần |
| `booking-card.spec.tsx:11` | `getByRole('link')` không kèm tên | thêm link thứ hai → query **throw** |
| `danger-zone.spec.tsx:36` | `getByRole('textbox')` không kèm tên, 6/6 test | thêm bất kỳ ô nhập nào |
| `booking-card.spec.tsx:17` | `className).toContain('text-warning')` | tách nhãn ra span con |
| `booking-actions.spec.tsx:117` | `toBeEmptyDOMElement()` | bọc một div cho spacing |

**Chiến lược:** tách lớp gọi API + phân loại lỗi của mỗi component ra hook
riêng (`useBookingActions`, `useSavedList`, …) **trước** khi vẽ lại, để spec
bám hook thay vì bám DOM. Gom khối lỗi `sessionExpired` đang chép nguyên 4 lần
thành một component dùng chung. Dời `TONE_CLASS` ra khỏi `account-dashboard.tsx`
(nó đang bị `booking-card.tsx` và trang detail import ngược).

Test mới cần có:
- **Thuần (TDD):** hàm chọn "recent bookings" (có CANCELLED) · tính nhóm thời
  gian cho `/bookings`.
- **jsdom:** ô lý do rỗng → chặn submit, không gọi API · lý do >1000 ký tự ·
  409/422 hiện đúng copy riêng thay vì generic.
- **Siết lại:** hai test hiện dùng `reason: expect.any(String)` → khẳng định
  đúng nội dung khách gõ.

Hai form profile/password hiện **không có `noValidate`** và cũng chưa có
`required`/`type=email`, nên validate của mình vẫn chạy. Nếu redesign thêm
thuộc tính validate native thì **phải thêm `noValidate`** — đúng bug đã sửa ở
form đặt chỗ (`4959455`).

## 7. Nghiệm thu

- `pnpm gate:int` xanh (luật #11 — `gate` trần không đủ).
- Đo lại tương phản bằng culori, mọi cặp trong ADR-0019 đạt ngưỡng đã ghi.
- Đi tay 5 màn ở CẢ hai chế độ sáng/tối.
- Xin huỷ một booking PAID thật, xác nhận lý do khách gõ xuất hiện đúng trong
  `cancellation_requests.reason` và trong email — không còn chuỗi
  'Requested via account portal.'
