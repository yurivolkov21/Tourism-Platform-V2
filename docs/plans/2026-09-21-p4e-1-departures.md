# P4e-1 chuyến khởi hành — Implementation Plan

> **CÒN DÙNG.** Kế hoạch thi công cho ba session song song. Spec:
> [P4e-1](../specs/2026-09-21-p4e-1-departures-design.md). Prompt bàn giao cho
> từng session ở [mục cuối](#prompt-cho-từng-session).

Ba tính năng, mỗi tính năng một session và một nhánh:

| # | Tính năng | Nhánh | Task | Chạm tiền |
| --- | --- | --- | --- | --- |
| F11 | `/tours` danh sách + công tắc đăng | `feat/p4e-tours-list` | 1–3 | không |
| F12 | Bảng chuyến + tạo · sửa · đóng/mở | `feat/p4e-departures-crud` | 4–7 | không |
| F13 | Huỷ chuyến qua hàng đợi | `feat/p4e-departure-cancel` | 8–11 | **có** |

**Thứ tự:** F11 và F12 chạy song song được. F13 **phải đợi F12 merge** vì nút
huỷ gắn vào bảng chuyến và dùng lại `admin.departures.list`.

## Ràng buộc toàn cục

Áp cho cả ba session:

1. **TDD trên logic thuần** (luật 4) — test trước, đỏ rồi mới viết code.
2. **`pnpm gate:int` trước khi khai xong** (luật 11). `pnpm gate` trần chỉ dùng
   trong vòng lặp; nó KHÔNG chạy integration test.
3. **Comment code tiếng Việt** (luật 8). Tên biến, hàm, identifier vẫn tiếng Anh.
4. **Copy người dùng thấy bằng tiếng Anh** và nằm trong `@tourism/i18n` (luật 7).
   Không viết chuỗi tiếng Anh trực tiếp trong component.
5. **Tokens-only, không hex** (luật 6).
6. **Commit Conventional Commits, tiếng Việt CÓ DẤU**, không AI attribution
   (luật 12).
7. **KHÔNG chạm hạ tầng sống** (luật 15): không deploy migration lên Supabase,
   không set env hay redeploy Render/Vercel, không đổi thiết lập Cloudinary.
   Việc cần hạ tầng thì ghi thành checklist trong phần bàn giao.
8. **Không tự bật/tắt dev server.** Cần chạy thử thì nhờ người dùng.
9. Trước khi bắt tay, rà [docs/skills.md](../skills.md) xem có skill nào phủ
   đúng việc này (luật 9).

## Bản đồ file

**Chung (cả F11 và F12 đều đụng — nguồn xung đột duy nhất):**

- `libs/shared/contract/src/contract.ts` — thêm nhánh `admin.tours` và
  `admin.departures`
- `apps/admin/src/lib/nav.ts` — mục `tours` đổi `enabled: false` → `true`

**F11:**

- Create: `libs/shared/contract/src/schemas/admin-catalog.ts`
- Create: `apps/api/src/modules/catalog/admin-tours.controller.ts`
- Create: `apps/api/src/modules/catalog/admin-catalog.service.ts`
- Create: `apps/admin/src/app/(admin)/tours/page.tsx` và các component cùng cụm
- Create: `apps/admin/src/lib/api/tours.ts`

**F12:**

- Modify: `libs/shared/contract/src/schemas/admin-catalog.ts`
- Create: `apps/api/src/modules/catalog/admin-departures.controller.ts`
- Modify: `apps/api/src/modules/catalog/admin-catalog.service.ts`
- Create: `apps/api/src/modules/catalog/departure-rules.ts` (logic thuần)
- Create: `apps/admin/src/app/(admin)/tours/[slug]/departures/page.tsx`
- Create: `apps/admin/src/lib/api/departures.ts`

**F13:**

- Modify: `apps/api/src/modules/bookings/cancellations.service.ts`
  (`initiator` mở kiểu)
- Create: `apps/api/src/modules/catalog/departure-cancel.service.ts`
- Modify: `apps/api/src/worker/start-worker.ts` (queue mới)
- Create: `apps/api/src/worker/departure-refund.service.ts`
- Modify: bảng chuyến của F12 (nút huỷ, hộp xác nhận, cột tiến độ)

---

# F11 — `/tours` danh sách + công tắc đăng

## Task 1 — Contract `admin.tours` (schema + shape)

Đứng riêng vì F12 cũng sửa `contract.ts`; làm gọn và merge sớm thì F12 rebase
nhẹ.

**Files:**

- Create: `libs/shared/contract/src/schemas/admin-catalog.ts`
- Modify: `libs/shared/contract/src/contract.ts`
- Test: `libs/shared/contract/src/schemas/admin-catalog.spec.ts`

**Produces:**

```ts
AdminTourRow = {
  id: string; slug: string; title: string;
  categoryName: string; basePrice: string; currency: string;
  isPublished: boolean; isFeatured: boolean;
  heroUrl: string | null;
  openDepartureCount: number;   // trong khoảng lọc, KHÔNG phải toàn bộ lịch sử
}
```

- [ ] **B1.** Viết spec cho `AdminTourRowSchema` và input của `list`
      (`{ categoryId?, isPublished?, month?, page?, perPage? }`) → FAIL.
- [ ] **B2.** Viết schema, dùng lại `DecimalStringSchema` và
      `CalendarDateSchema` sẵn có — đừng khai kiểu tiền mới.
- [ ] **B3.** Gắn `admin.tours.list` và `admin.tours.setPublished` vào
      `contract.ts`, đúng nếp `admin.<vùng>.<động từ>`.
- [ ] **B4.** `pnpm gate` xanh.
- [ ] **B5.** Commit: `feat(contract): thêm admin.tours.list và setPublished`.

## Task 2 — Service + controller + int spec

**Files:**

- Create: `apps/api/src/modules/catalog/admin-catalog.service.ts`,
  `admin-tours.controller.ts`
- Modify: `apps/api/src/modules/catalog/catalog.module.ts`
- Test: `apps/api/src/modules/catalog/admin-catalog.int.spec.ts`

- [ ] **B1.** Int spec: `list` trả đúng `openDepartureCount` theo khoảng lọc
      tháng; tour không có chuyến nào trả `0` chứ không vắng mặt → FAIL.
- [ ] **B2.** Int spec: `setPublished` đổi cờ và **không** bị chặn khi tour
      đang có booking sống — khách đã mua vẫn đi, chỉ thôi chào bán.
- [ ] **B3.** Viết service. Đếm chuyến còn mở bằng một truy vấn gom nhóm, đừng
      N+1 theo từng tour.
- [ ] **B4.** Controller dùng `AuthGuard` + `@Roles('ADMIN')` sẵn có. Trần ghi
      mặc định của ADR-0037 tự áp cho `setPublished`.
- [ ] **B5.** `setPublished` gọi `void this.webRevalidation.revalidate(['tours', tourTag(slug)])`
      **SAU** commit — tiền lệ ở `reviews.service.ts`.
- [ ] **B6.** `pnpm gate:int` xanh.
- [ ] **B7.** Commit: `feat(api): endpoint admin đọc danh sách tour và bật tắt đăng`.

## Task 3 — Màn `/tours` + bật mục sidebar

**Files:**

- Create: `apps/admin/src/app/(admin)/tours/page.tsx` và component cụm
- Create: `apps/admin/src/lib/api/tours.ts`
- Modify: `apps/admin/src/lib/nav.ts`
- Modify: `libs/shared/i18n` (khoá chữ mới)
- Test: component spec cho bảng và công tắc

- [ ] **B1.** Component spec: công tắc bật/tắt hiển thị optimistic và **hoàn
      nguyên khi API lỗi** → FAIL.
- [ ] **B2.** Dựng bảng bằng CRUD kit của P4b, bộ lọc bằng `ToolbarFilterMenu`
      của P4c. Không dựng primitive mới.
- [ ] **B3.** Cột "chuyến sắp tới" đọc `openDepartureCount`; hàng bấm được để
      sang `/tours/[slug]/departures` (trang F12 dựng — tạm thời 404 là chấp
      nhận được, ghi rõ trong PR).
- [ ] **B4.** `nav.ts`: mục `tours` đổi `enabled: true`.
- [ ] **B5.** Chữ mới vào `@tourism/i18n`, tiếng Anh.
- [ ] **B6.** `pnpm gate:int` xanh.
- [ ] **B7.** Commit: `feat(admin): màn danh sách tour với công tắc đăng`.

---

# F12 — Bảng chuyến + tạo · sửa · đóng/mở

## Task 4 — Luật chuyến (hàm thuần, TDD)

Tách riêng vì đây là phần dễ sai nhất và phải có test trước tiên.

**Files:**

- Create: `apps/api/src/modules/catalog/departure-rules.ts`
- Test: `apps/api/src/modules/catalog/departure-rules.spec.ts`

**Produces:**

```ts
// null = hợp lệ; chuỗi = lý do từ chối, đã sẵn sàng cho người đọc
seatsChangeBlocker(seatsTotal: number, seatsBooked: number): string | null
dateChangeBlocker(liveBookingCount: number): string | null
reopenBlocker(startDate: string, endDate: string, now: Date): string | null
```

- [ ] **B1.** Spec cho `seatsChangeBlocker`: hạ xuống bằng `seatsBooked` là hợp
      lệ, thấp hơn là từ chối kèm con số thật → FAIL.
- [ ] **B2.** Spec cho `dateChangeBlocker`: `0` booking sống là hợp lệ, `≥ 1` là
      từ chối.
- [ ] **B3.** Spec cho `reopenBlocker`: mở lại sau hạn chót bị từ chối. Hạn chót
      lấy từ `cancellationDeadline` của
      `libs/shared/contract/src/schemas/refund-policy.ts` — **không** viết lại
      luật `N` (ADR-0041 §8).
- [ ] **B4.** Viết ba hàm, thuần, không chạm Prisma.
- [ ] **B5.** `pnpm gate` xanh.
- [ ] **B6.** Commit: `feat(api): ba luật chuyến khởi hành dạng hàm thuần`.

## Task 5 — Contract `admin.departures`

**Files:**

- Modify: `libs/shared/contract/src/schemas/admin-catalog.ts`, `contract.ts`
- Test: `admin-catalog.spec.ts`

**Produces:**

```ts
AdminDepartureRow = {
  id: string; startDate: string; endDate: string;
  price: string; currency: string;
  seatsBooked: number; seatsTotal: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  cancellationDeadline: string;   // tính bằng hàm của contract
  liveBookingCount: number;       // nuôi luật chặn đổi ngày và cột tiến độ F13
}
```

- [ ] **B1.** Spec cho row và bốn input (`list`, `create`, `update`,
      `setStatus`) → FAIL.
- [ ] **B2.** `setStatus` chỉ nhận `'OPEN' | 'CLOSED'` — **không** nhận
      `CANCELLED`. Huỷ là đường riêng của F13; để lọt vào đây là mở một cửa
      hậu bỏ qua toàn bộ luật hoàn tiền.
- [ ] **B3.** Mã lỗi riêng cho ba ca từ chối, để màn in đúng câu:
      `DEPARTURE_HAS_BOOKINGS` · `SEATS_BELOW_BOOKED` · `DEADLINE_PASSED`.
- [ ] **B4.** `pnpm gate` xanh.
- [ ] **B5.** Commit: `feat(contract): thêm admin.departures với bốn thao tác`.

## Task 6 — Service + controller + int spec

**Files:**

- Create: `apps/api/src/modules/catalog/admin-departures.controller.ts`
- Modify: `apps/api/src/modules/catalog/admin-catalog.service.ts`
- Test: `admin-catalog.int.spec.ts`

- [ ] **B1.** Int spec: `update` đổi ngày trên chuyến có 1 booking `PAID` → trả
      `DEPARTURE_HAS_BOOKINGS`, dữ liệu không đổi → FAIL.
- [ ] **B2.** Int spec: hạ `seatsTotal` dưới `seatsBooked` → trả
      `SEATS_BELOW_BOOKED` **ở tầng API**, không phơi lỗi 23514 của CHECK.
- [ ] **B3.** Int spec: `create` từ chối ngày đi trong quá khứ và ngày về trước
      ngày đi.
- [ ] **B4.** Viết service. **Đọc số booking sống TRONG cùng transaction với
      phép ghi** — đọc trước rồi ghi sau là đúng cái bẫy
      [read-then-write](../conventions/read-then-write-races.md) đã cắn dự án
      hai lần. Khoá hàng chuyến bằng `SELECT … FOR UPDATE` ở một statement
      riêng trước khi ghi.
- [ ] **B5.** Cả bốn endpoint bust `tour:<slug>` sau commit; `create` và
      `update` bust thêm `tours` nếu chuyến đó là chuyến nuôi giá ở card.
- [ ] **B6.** `pnpm gate:int` xanh.
- [ ] **B7.** Commit: `feat(api): bốn endpoint quản lý chuyến khởi hành`.

## Task 7 — Màn bảng chuyến

**Files:**

- Create: `apps/admin/src/app/(admin)/tours/[slug]/departures/page.tsx` và
  component cụm
- Create: `apps/admin/src/lib/api/departures.ts`
- Modify: `libs/shared/i18n`
- Test: component spec

- [ ] **B1.** Component spec: form sửa khoá ô ngày khi `liveBookingCount > 0`,
      kèm dòng giải thích vì sao → FAIL.
- [ ] **B2.** Bảng: ngày, giá, ghế đã đặt/tổng, trạng thái, **hạn chót huỷ**.
      Hạn chót hiện luôn, không giấu sau tooltip — admin cần thấy mốc trước khi
      quyết bất cứ điều gì.
- [ ] **B3.** Ba hành động: tạo (dialog) · sửa (dialog) · đóng/mở lại (nút tại
      hàng). Ba mã lỗi của Task 5 map sang ba câu tiếng Anh trong i18n.
- [ ] **B4.** Breadcrumb về `/tours`.
- [ ] **B5.** `pnpm gate:int` xanh.
- [ ] **B6.** Commit: `feat(admin): màn quản lý chuyến khởi hành của một tour`.

---

# F13 — Huỷ chuyến qua hàng đợi

> **Đợi F12 merge vào `main` rồi mới mở nhánh này.**

## Task 8 — Mở `initiator` cho đường operator (TDD)

**Files:**

- Modify: `apps/api/src/modules/bookings/cancellations.service.ts`
- Modify hoặc Create: chỗ chọn `refundAmount`
- Test: spec logic thuần cho phép chọn số tiền

- [ ] **B1.** Spec: với `initiator: 'operator'`, số tiền hoàn là **trọn phần
      chưa hoàn** kể cả khi đã quá hạn chót — trong khi `'customer'` ở cùng
      tình huống ra `0.00` → FAIL.
- [ ] **B2.** Mở `CancelInLockInput.initiator` thành `'customer' | 'operator'`.
- [ ] **B3.** Nhánh chọn `refundAmount` rẽ theo `initiator`. Đường operator
      **không** gọi `refundOnCancelForBooking`; `expectedRefundAmount` đặt bằng
      chính `refundAmount`.
- [ ] **B4.** `cancellationBlocker` **giữ nguyên** — vẫn chặn khi đã tới ngày
      khởi hành.
- [ ] **B5.** JSDoc tiếng Việt nói rõ vì sao hai đường tính tiền khác nhau, dẫn
      ADR-0041 §6.
- [ ] **B6.** `pnpm gate:int` xanh.
- [ ] **B7.** Commit: `feat(api): lõi huỷ nhận initiator operator, hoàn trọn phần chưa hoàn`.

## Task 9 — Queue hoàn tiền mang payload

**Files:**

- Create: `apps/api/src/worker/departure-refund.service.ts`
- Modify: `apps/api/src/worker/start-worker.ts`
- Test: `apps/api/src/worker/departure-refund.int.spec.ts`

- [ ] **B1.** Int spec: job chạy **hai lần** cho cùng một booking chỉ hoàn một
      lần (khoá chống trùng theo `capture`) → FAIL.
- [ ] **B2.** Int spec: booking đã hoàn một phần thì job hoàn đúng phần còn lại.
- [ ] **B3.** Đăng ký queue mới trong `start-worker.ts` cạnh năm queue hiện có.
      Payload `{ bookingId, departureId, adminId }`.
- [ ] **B4.** Khai `policy` và `retryLimit` **tường minh**. Năm queue kia đặt
      `retryLimit: 0` vì lượt cron kế tiếp là đủ — ở đây bỏ một lượt là một
      khách không được hoàn tiền, nên phải có retry thật.
- [ ] **B5.** `pnpm gate:int` xanh.
- [ ] **B6.** Commit: `feat(api): hàng đợi hoàn tiền cho chuyến bị huỷ`.

## Task 10 — Endpoint `admin.departures.cancel`

**Files:**

- Create: `apps/api/src/modules/catalog/departure-cancel.service.ts`
- Modify: `contract.ts`, `admin-departures.controller.ts`
- Test: int spec

- [ ] **B1.** Int spec: chuyến có 3 booking hỗn hợp (`PAID` · `PENDING` · đã
      `CANCELLED`) → chuyến đổi `CANCELLED`, `PENDING` huỷ ngay và trả ghế,
      đúng **một** job đẩy cho booking `PAID`, booking đã `CANCELLED` bị bỏ qua
      → FAIL.
- [ ] **B2.** Int spec: bấm huỷ lần hai trên chuyến đã `CANCELLED` → từ chối,
      không đẩy job trùng.
- [ ] **B3.** Viết service: một transaction khoá chuyến, đổi trạng thái, chụp
      ba nhóm booking, huỷ nhóm `PENDING`, đẩy job cho nhóm phải hoàn.
- [ ] **B4.** `reason` bắt buộc, vào sổ.
- [ ] **B5.** Gọi revalidate **ngay sau transaction đồng bộ**, không đợi hàng
      đợi — chuyến phải biến mất khỏi web lập tức.
- [ ] **B6.** `pnpm gate:int` xanh.
- [ ] **B7.** Commit: `feat(api): endpoint huỷ chuyến, đẩy hoàn tiền vào hàng đợi`.

## Task 11 — Nút huỷ + cột tiến độ

**Files:**

- Modify: bảng chuyến của F12
- Modify: `libs/shared/i18n`
- Test: component spec

- [ ] **B1.** Component spec: hộp xác nhận in **đúng số khách bị ảnh hưởng**, và
      nút gửi bị khoá khi ô lý do trống → FAIL.
- [ ] **B2.** Cột tiến độ đọc từ đếm booking (`đã hoàn x/y`), không thêm bảng
      mới.
- [ ] **B3.** Hàng `CANCELLED` không còn nút sửa hay đóng/mở.
- [ ] **B4.** Một dòng giải thích khi tiến độ đứng yên lâu — worker Render gói
      free ngủ sau 15 phút (xem Rủi ro trong spec).
- [ ] **B5.** `pnpm gate:int` xanh.
- [ ] **B6.** Commit: `feat(admin): nút huỷ chuyến và cột tiến độ hoàn tiền`.

---

## Nghiệm thu cuối (sau khi cả ba merge)

- [ ] `pnpm gate:int` trọn xanh trên `main`.
- [ ] Liếc đèn CI sau push (luật 14): `gh run list --branch main --limit 1`.
- [ ] Entry CHANGELOG cho từng tính năng (luật 13), cập nhật bản đồ nếu thêm
      tài liệu.
- [ ] Gạch mục "P4e" và "P4e-1 nút Cancel departure" trong
      [open-items.md](../open-items.md).
- [ ] Chạy thử trên máy: tạo một chuyến, đóng nó, mở lại, rồi huỷ một chuyến có
      booking sandbox — xem tiến độ chạy tới đủ.

## Prompt cho từng session

Ba đoạn prompt ở [file riêng](2026-09-21-p4e-1-prompts.md), kèm lệnh dựng
worktree. Mỗi session mở **một worktree riêng**, làm đúng một tính năng, không
đụng sang tính năng khác.
