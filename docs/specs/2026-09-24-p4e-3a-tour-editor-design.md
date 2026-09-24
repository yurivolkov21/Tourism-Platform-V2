# Spec F17 — Tạo và sửa tour (P4e-3a)

24/09/2026 · thiết kế duyệt qua năm phần trong chat cùng ngày. Quyết định kiến
trúc nằm ở [ADR-0047](../adr/0047-tour-editor-sections.md); spec này nói cách
làm.

Đánh số **F17**. Ảnh tour là **F18 (P4e-3b)**, làm ngay sau, spec riêng.

## 1. Mục tiêu & phạm vi

### Vấn đề

Admin chưa tạo được tour và chưa sửa được nội dung tour nào. Nội dung 29 tour
đang bán chỉ đổi được bằng seed hoặc sửa thẳng DB. Nexora có đủ tạo, sửa và xoá
tour, nên đây là thụt lùi cần vá (luật 10).

**Mục tiêu:** admin tạo được một tour mới từ con số 0, điền đủ nội dung, đăng
bán, và sửa được mọi nội dung chữ và số của một tour đang bán — mà không lần
nào làm lệch dữ liệu đang khớp hôm nay (số ngày, lịch trình, chuyến, ghế).

### Trong phạm vi

- Hộp **New tour** ở trang Tours: tạo tour ở dạng đang tắt bán.
- **Khu làm việc** `/tours/[slug]` chia tab: Details · Itinerary · FAQ &
  policies · Costs · Departures (có sẵn từ F12).
- Bảy thao tác API mới dưới `admin.tours` và một mã lỗi mới ở `setPublished`.
- Hàm thuần `tourReadiness` và ba hàm giá vốn (tính bằng cent) ở contract.
- Nút **Delete** cho tour chưa từng có booking.
- Copy tiếng Anh mới trong `@tourism/i18n`.

### Ngoài phạm vi, cố ý

| Không làm | Vì sao |
| --- | --- |
| Ảnh tour (tải, sắp, ảnh bìa, alt) | F18 (P4e-3b), ngay sau F17 |
| Xem trước tour nháp trên web | ADR-0047 §KHÔNG mở ra: tắt bán là trạng thái nháp duy nhất |
| Đổi slug sau khi tạo | ADR-0047 §7 |
| Tiền tệ khác USD, giá gạch cấp tour | Cả 29 tour là USD; web thôi hiện giá gạch cấp tour từ 15/09 |
| Nhật ký thao tác của admin | P4f (`AdminAuditLog`) |
| Sửa code web | Web đọc tour qua endpoint công khai có sẵn; §6 |
| Migration | Mọi cột và bảng đã có |

## 2. Quyết định thiết kế

### 2a. Tạo tour

- Hộp New tour hỏi **bảy ô**: tên · slug · danh mục · điểm đến chính · số ngày ·
  số khách tối đa · giá gốc.
- Tour sinh ra với `isPublished = false`, `currency = 'USD'`, một dòng
  `tour_destinations` là điểm chính, mọi danh sách rỗng, `costPrice = null` (chưa
  có dòng chi phí).
- Slug gợi ý bằng `slugifyVietnamese(title, 120)`, tự điền theo tên cho tới khi
  admin sửa tay ô slug. Ô slug dùng đúng câu lỗi `slugShape` và ba thuộc tính tắt
  soát chính tả của danh mục và điểm đến (plan P4e-2, bài học 8). Sau khi tạo,
  slug khoá hẳn (ADR-0047 §7).
- Slug trùng: bắt `P2002` ngay ở lệnh ghi rồi đổi thành `SLUG_TAKEN` (409), form
  giữ nguyên chữ đã gõ (plan P4e-2, bài học 1).
- Tạo xong, màn hình chuyển vào tab Details kèm toast "Tour created — it stays
  off sale until you put it on sale."

### 2b. Luật khi sửa

1. **Số ngày** khoá khi tour có ít nhất một chuyến, bất kể giai đoạn
   (`DURATION_LOCKED`). Chưa có chuyến thì đổi được:
   - Tăng: lịch trình có thêm ô ngày trống.
   - Giảm: các ngày lịch trình vượt số ngày mới bị xoá trong cùng transaction.
     Form báo trước khi lưu: "Days 4–5 of the itinerary will be removed."
2. **Số khách tối đa** không được hạ dưới số ghế lớn nhất của các chuyến có
   giai đoạn khác `completed` và `cancelled` (`GROUP_SIZE_BELOW_SEATS`). Tăng thì
   luôn được. Đổi số này thì `costPrice` được tính lại.
3. **Lịch trình**: tối đa N ngày (N = số ngày), mỗi ngày một hàng
   `tour_itinerary_days` với `dayNumber` trong 1..N, không trùng. Lưu dở được:
   ngày chưa có tiêu đề thì không có hàng. Ô mô tả giữ quy ước `HH:MM — …` mà
   web tách thành điểm dừng (`parseItineraryStops`).
4. **Điểm đến**: 1..10 dòng, không trùng, **đúng một** điểm chính (refine ở
   contract). Danh mục và điểm đến đang ẩn vẫn chọn được, có nhãn "(hidden)".
5. **Giá vốn** luôn tính lại, không nhập tay (§2f).

Không có ô nhập cho: slug (sau khi tạo), tiền tệ, giá gạch cấp tour
(`compareAtPrice` giữ nguyên dữ liệu cũ), điểm đánh giá, `isPublished` (công tắc
riêng).

**Hiệu lực của thay đổi về tiền** — màn hình ghi ngay cạnh nút Save:

- Giá gốc mới áp ngay cho mọi chuyến không đặt giá riêng, từ booking kế tiếp.
- Bảng chi phí mới chỉ áp cho chuyến và booking tạo sau đó
  (`fixedCostAmount` của chuyến và `costPerPerson` của booking là bản chụp).

### 2c. Đăng tour và `tourReadiness`

```ts
// libs/shared/contract/src/schemas/tour-readiness.ts
export interface TourReadinessInput {
  summary: string | null;
  destinations: readonly { isPrimary: boolean }[];
  durationDays: number;
  itineraryDays: readonly number[]; // dayNumber của các ngày ĐÃ có tiêu đề
}
export interface TourReadiness {
  summary: boolean;            // có tóm tắt sau khi trim
  primaryDestination: boolean; // đúng một điểm chính
  missingDays: number[];       // ngày 1..N chưa có, sắp tăng dần
  ready: boolean;              // cả ba đều đạt
}
export function tourReadiness(input: TourReadinessInput): TourReadiness;
```

- `setPublished(true)`: trong cùng transaction, sau khi khoá hàng tour, tính
  `tourReadiness`; chưa `ready` → `TOUR_NOT_READY` (409), rollback.
- `setPublished(false)`: không kiểm gì, như F11.
- **Tour đang bán thì luôn đủ để bán.** `updateDetails` và `setItinerary` trên
  tour đang bán tính lại `tourReadiness` sau khi ghi, trong cùng transaction;
  chưa `ready` → `TOUR_NOT_READY`. Ví dụ bị chặn: xoá tóm tắt, xoá tiêu đề một
  ngày, giảm số ngày của tour đang bán chưa có chuyến.
- `get` trả `readiness` để khu làm việc hiện khung "Ready to sell" hoặc
  "Missing before it can go on sale: …", mỗi mục là link tới tab cần sửa.
- F18 thêm `coverPhoto` vào `TourReadiness`. Cả 29 tour hiện có đều đạt cả bốn
  điều kiện (đo 24/09).

### 2d. Xoá tour

- Nút Delete nằm cuối tab Details, chỉ hiện khi `bookingCount = 0`.
- Server gọi thẳng `tour.delete`. Khoá ngoại `Restrict` của booking chặn → bắt
  `P2003` → `TOUR_HAS_BOOKINGS` (409). `P2025` → `NOT_FOUND`. Không đếm trước.
- DB tự xoá theo: chuyến, lịch trình, FAQ, chính sách, chi phí, liên kết điểm
  đến, wishlist, liên kết bài viết. `Enquiry.tourId` thành `null`.
- Hộp xác nhận (kit `ConfirmWriteDialog`, giọng đỏ) liệt kê những gì mất, kèm số
  chuyến bị xoá theo. Xoá xong về `/tours` kèm toast.
- F18 thêm bước đưa ảnh của tour vào `media_garbage` (ADR-0035).

### 2e. Chống ghi đè

- `get` trả `version` = `updatedAt` dạng ISO có mili-giây.
- Mọi lệnh sửa bắt đầu bằng:

  ```ts
  const { count } = await tx.tour.updateMany({
    where: { id: input.id, updatedAt: new Date(input.version) },
    data: { ...tabFields, updatedAt: new Date() },
  });
  if (count === 0) {
    const exists = await tx.tour.findUnique({ where: { id: input.id }, select: { id: true } });
    throw exists ? new StaleTourError() : new TourNotFoundError();
  }
  ```

  Câu `UPDATE` khoá hàng tour tới hết transaction, nên hai lệnh ghi vào cùng
  tour xếp hàng. Tab chỉ đổi bảng con thì `tabFields` rỗng, nhưng `updatedAt`
  vẫn được đẩy.
- `setPublished` không nhận `version` (F11 giữ nguyên) nhưng cũng cập nhật hàng
  tour, nên nó cũng xếp hàng với các lệnh sửa.
- Bốn lệnh sửa (`updateDetails`, `setItinerary`, `setFaqsPolicies`, `setCosts`)
  trả về `AdminTourDetail` mới, đọc lại sau commit, để form lấy phiên bản mới mà
  không tải lại trang.
- `liveSeatsMax` = số ghế lớn nhất trong các chuyến có giai đoạn khác
  `completed` và `cancelled`; `null` khi không có chuyến nào như vậy.

### 2f. Giá vốn ở contract

```ts
// libs/shared/contract/src/schemas/tour-costs.ts
export interface CostItemLike { amount: string; basis: 'PER_PERSON' | 'PER_DEPARTURE' }
export function perPersonTotal(items: readonly CostItemLike[]): string;    // '12.50'
export function perDepartureTotal(items: readonly CostItemLike[]): string;
export function derivedCostPrice(items: readonly CostItemLike[], maxGroupSize: number): string;
```

- Tính trên cent nguyên bằng `toCents`/`fromCents` của `refund-policy.ts`.
  `derivedCostPrice` = theo khách + làm tròn HALF_UP của (theo chuyến ÷ số khách
  tối đa), đúng công thức ADR-0033. `maxGroupSize <= 0` thì bỏ phần theo chuyến,
  như bản cũ.
- Không có dòng chi phí nào thì `costPrice = null` (giữ nghĩa hôm nay: tour chưa
  khai giá vốn).
- API bỏ `apps/api/src/modules/catalog/tour-costs.ts` và gọi bản contract ở
  `bookings.service.ts` (`costPerPerson`), `admin-departures.service.ts`
  (`fixedCostAmount`) và `seed.ts` (`costPrice`). Chỉ đổi chỗ import, không đổi
  logic xung quanh.
- Test đối chiếu viết TRƯỚC khi xoá bản cũ: mọi tour trong fixture seed phải ra
  cùng ba con số ở hai bản.

### 2g. Khu làm việc ở admin

- Route: `/tours/[slug]` (Details) · `/tours/[slug]/itinerary` ·
  `/tours/[slug]/content` (FAQ & policies) · `/tours/[slug]/costs` ·
  `/tours/[slug]/departures` (có sẵn).
- `apps/admin/src/app/(admin)/tours/[slug]/layout.tsx` dựng phần đầu dùng chung:
  Back to tours · tên tour · công tắc On sale (dùng lại `PublishToggle` của F11,
  tắt khi chưa `ready`) · khung readiness · thanh tab. Layout và page cùng gọi
  `fetchAdminTour(slug)` bọc `cache()` của React nên chỉ tốn một request.
- Trang Departures bỏ tiêu đề và link Back riêng (layout đã có), giữ nguyên phụ
  đề, dòng báo "This tour is off sale" (F16) và bảng.
- Trang Tours: nút **New tour** ở thanh công cụ; tên tour thành link tới
  `/tours/[slug]`. Công tắc On sale gặp `TOUR_NOT_READY` thì toast "This tour
  isn't ready to sell yet" kèm link mở tour.
- Danh mục và điểm đến cho ô chọn lấy từ `admin.categories.list` (F14) và
  `admin.destinations.list` (F15), gồm cả mục đang ẩn.

### 2h. Bốn tab

**Details** — ba khung, một nút Save:

1. *Basics:* tên · tóm tắt · danh mục · độ khó (có "Not set") · cờ Featured on
   home · số ngày (ổ khoá kèm "Locked — this tour has departures" khi
   `departureCount > 0`) · số khách tối đa (ghi "At least N — the largest
   departure has N seats" khi `liveSeatsMax` có giá trị) · giá gốc (USD).
2. *Destinations:* mỗi dòng một ô chọn điểm đến, một nút chọn điểm chính
   (radio, luôn đúng một), một nút xoá; nút thêm dòng; tối đa 10.
3. *Selling points:* đối tượng khách và huy hiệu dạng ô tích · điểm nổi bật ·
   mục bao gồm · không bao gồm (khung sửa danh sách) · điểm hẹn · bốn ghi chú dữ
   kiện, nhãn theo đúng bốn thẻ trên trang tour (Duration, Group size,
   Difficulty, Good for).

Cuối tab: khung Delete (§2d).

**Itinerary** — đủ N ô ngày (Day 1…N), mỗi ô một tiêu đề và một mô tả, kèm ví
dụ `09:00 — Pick-up at your hotel`. Tour đang bán thì ô tiêu đề nào cũng bắt
buộc.

**FAQ & policies** — hai khung sửa danh sách. FAQ: câu hỏi, câu trả lời. Chính
sách: loại (Booking / General), tiêu đề, nội dung. Một dòng ghi "The
cancellation policy is generated from the trip length and shown automatically."

**Costs** — khung sửa danh sách: hạng mục · nhãn · số tiền · cách tính (Per
traveller / Per departure). Bên dưới tính trực tiếp khi gõ bằng hàm contract:
tổng theo khách, tổng theo chuyến, giá vốn mỗi khách khi đủ đoàn, và biên lời so
với giá gốc.

**Khung sửa danh sách dùng chung** — `apps/admin/src/components/kit/list-editor.tsx`:
thêm, xoá, lên, xuống, trần số dòng, nút icon có `aria-label`. Dùng cho sáu danh
sách: điểm nổi bật, bao gồm, không bao gồm, FAQ, chính sách, chi phí.

### 2i. Lưu, lỗi, rời trang

- Save chỉ sáng khi form có thay đổi. Lưu xong, form nhận `AdminTourDetail` mới
  từ response và gọi `router.refresh()` để phần đầu (readiness, công tắc) theo
  kịp.
- Có thay đổi chưa lưu: `beforeunload` hỏi khi rời trang; bấm tab khác hỏi
  "Discard unsaved changes?" (một provider client bọc thanh tab và nội dung).
- Mã lỗi hiện đúng chỗ:

| Mã | Hiện ở đâu |
| --- | --- |
| `STALE_TOUR` | Dải báo trên form kèm nút Reload; form giữ chữ đang gõ |
| `DURATION_LOCKED` | Dưới ô số ngày |
| `GROUP_SIZE_BELOW_SEATS` | Dưới ô số khách tối đa |
| `TOUR_NOT_READY` | Dải báo liệt kê chỗ thiếu, như khung readiness |
| `SLUG_TAKEN` | Dưới ô slug, hộp New tour vẫn mở |
| `TOUR_HAS_BOOKINGS` | Trong hộp xác nhận xoá |
| `NOT_FOUND` | Toast, rồi về `/tours` |

- Codec lỗi theo khuôn `destinations-write.ts`: derive từ khối i18n, rút
  `hasFormErrors` dùng chung ở `form-errors.ts`.

### 2j. Copy (tiếng Anh, `messages.admin.tours.editor`)

- Một chữ cho mỗi khái niệm (plan P4e-2, bài học 20): **On sale / Off sale** là
  công tắc đăng tour; **Bookable** là của chuyến; **Hide / Show** là của danh
  mục và điểm đến. Không dùng "Draft", "Publish", "Active".
- Mọi câu hứa hệ quả (xoá, đổi giá, đổi chi phí, giảm số ngày) phải đo trên
  code trước khi viết — hai vòng review F14 và F15 đều bắt được câu copy nói sai.

## 3. Bề mặt API

| Thao tác | Route | Nhận | Trả | Lỗi riêng |
| --- | --- | --- | --- | --- |
| `create` | `POST /api/admin/tours` | bảy ô §2a | `{ id, slug }` | `SLUG_TAKEN` · `NOT_FOUND` |
| `get` | `GET /api/admin/tours/{slug}` | slug | `AdminTourDetail` | `NOT_FOUND` |
| `updateDetails` | `PUT /api/admin/tours/{id}/details` | `version` + tab Details | `AdminTourDetail` | `STALE_TOUR` · `DURATION_LOCKED` · `GROUP_SIZE_BELOW_SEATS` · `TOUR_NOT_READY` · `NOT_FOUND` |
| `setItinerary` | `PUT /api/admin/tours/{id}/itinerary` | `version` + `days[]` | `AdminTourDetail` | `STALE_TOUR` · `TOUR_NOT_READY` · `NOT_FOUND` |
| `setFaqsPolicies` | `PUT /api/admin/tours/{id}/faqs-policies` | `version` + `faqs[]` + `policies[]` | `AdminTourDetail` | `STALE_TOUR` · `NOT_FOUND` |
| `setCosts` | `PUT /api/admin/tours/{id}/costs` | `version` + `items[]` | `AdminTourDetail` | `STALE_TOUR` · `NOT_FOUND` |
| `delete` | `DELETE /api/admin/tours/{id}` | `id` | `{ slug }` | `TOUR_HAS_BOOKINGS` · `NOT_FOUND` |
| `setPublished` (có sẵn) | như cũ | như cũ | như cũ | thêm `TOUR_NOT_READY` |

- `NOT_FOUND` của `create`/`updateDetails`: danh mục hay điểm đến không tồn tại
  (khoá ngoại `P2003`). Không xảy ra với client đúng — danh mục và điểm đến không
  xoá được.
- Ngày lịch trình ngoài 1..N sau khi qua phép so phiên bản: 400 `BAD_REQUEST`
  (client đúng không bao giờ gửi).
- `AdminTourDetail` gồm: mọi trường sửa được · `id` · `slug` · `version` ·
  `isPublished` · `costPrice` · `ratingAvg` · `ratingCount` · `itinerary[]` ·
  `faqs[]` · `policies[]` · `costItems[]` · `destinations[]` (`destinationId`,
  `isPrimary`) · `departureCount` · `liveSeatsMax` (số hoặc `null`) ·
  `bookingCount` · `readiness`.
- Khuôn mỗi lệnh sửa: so-và-ghi hàng tour (§2e) → thay bảng con (nếu có) → tính
  lại `costPrice` (nếu đổi chi phí hoặc số khách) → kiểm `tourReadiness` nếu
  đang bán → commit → bust `tourRevalidationTags(slug)` (fire-and-forget,
  ADR-0016). Controller `@Roles(ADMIN)` và `toContractError` dùng chung.
- Giới hạn 60 lệnh ghi mỗi phút của admin (ADR-0037) tự áp.

### Trần dữ liệu (contract gương cột DB)

| Trường | Trần |
| --- | --- |
| slug | 120, khuôn `SLUG_PATTERN` |
| tên · tóm tắt | 200 · 500 |
| ghi chú dữ kiện · điểm hẹn | 280 · 300 |
| điểm nổi bật · bao gồm · không bao gồm | mỗi danh sách ≤ 15 dòng, mỗi dòng 1..200 |
| ngày lịch trình | tiêu đề 1..200, mô tả ≤ 2000 |
| FAQ | ≤ 20; câu hỏi 1..300, trả lời 1..2000 |
| chính sách | ≤ 10; loại `BOOKING`/`GENERAL`; tiêu đề 1..200, nội dung 1..4000 |
| dòng chi phí | ≤ 30; nhãn 1..120; số tiền ≥ 0, 2 chữ số lẻ, trần `Decimal(14,2)` |
| giá gốc | > 0, khuôn `DeparturePriceSchema` |
| số ngày · số khách tối đa | 1..30 · 1..100 |
| điểm đến | 1..10, đúng một điểm chính |

### Bản đồ file

| File | Trách nhiệm |
| --- | --- |
| `libs/shared/contract/src/schemas/tour-readiness.ts` | `tourReadiness` — thuần |
| `libs/shared/contract/src/schemas/tour-costs.ts` | Ba hàm giá vốn trên cent — thuần |
| `libs/shared/contract/src/schemas/admin-tours.ts` | `AdminTourDetail` + sáu input + hằng trần |
| `libs/shared/contract/src/contract.ts` | Bảy procedure mới, mã lỗi của `setPublished` |
| `apps/api/src/modules/catalog/admin-tours.service.ts` | Bảy thao tác + khuôn so-và-ghi |
| `apps/api/src/modules/catalog/admin-tours.controller.ts` | Guard + `toContractError` |
| `apps/api/src/modules/catalog/admin-catalog.service.ts` | `setTourPublished` thêm cổng |
| `apps/api/src/modules/bookings/bookings.service.ts` · `admin-departures.service.ts` · `prisma/seed.ts` | Đổi chỗ import hàm giá vốn |
| `apps/admin/src/lib/tour-editor-view.ts` · `tour-editor-write.ts` · `api/tours.ts` | VM, codec lỗi, client |
| `apps/admin/src/app/(admin)/tours/[slug]/layout.tsx` + bốn page + `actions.ts` | Khu làm việc |
| `apps/admin/src/components/tours/editor/*.tsx` | Hộp New tour, bốn form, khung readiness, thanh tab |
| `apps/admin/src/components/kit/list-editor.tsx` | Khung sửa danh sách dùng chung |
| `libs/shared/i18n/src/lib/messages.ts` | `messages.admin.tours.editor` |

## 4. Chỗ dễ sai

1. **So rồi mới ghi.** Đọc `updatedAt` bằng một câu riêng rồi mới `update` là để
   hở khe giữa hai câu. Phép so phải nằm TRONG câu `UPDATE` (§2e).
2. **Lưu tab con mà quên đẩy `updatedAt`.** Người kia không biết tour đã đổi.
3. **`version` mất mili-giây** khi đi qua JSON hoặc `Date` → `STALE_TOUR` giả.
   Contract dùng `z.iso.datetime()` có mili-giây; test round-trip.
4. **Kiểm `tourReadiness` ngoài transaction** → một lệnh khác chen giữa. Kiểm sau
   khi ghi, trước commit.
5. **Giảm số ngày mà không xoá ngày thừa** → lịch trình có "Day 5" của tour 4
   ngày, và `tourReadiness` đếm sai.
6. **Đếm booking trước rồi mới xoá** → một booking chen vào khe. Để khoá ngoại
   quyết (§2d).
7. **Giá vốn lệch một cent** giữa bản contract và bản `Prisma.Decimal` cũ. Test
   đối chiếu trên toàn bộ fixture trước khi xoá bản cũ.
8. **`GROUP_SIZE_BELOW_SEATS` đếm cả chuyến đã về hay đã huỷ** → khoá oan tour
   có lịch sử lớn. Dùng `departurePhase`.
9. **Chặn gỡ đăng.** `setPublished(false)` không bao giờ đọc `tourReadiness`.
10. **Bust cache trong transaction** hoặc chỉ bust `tours` mà quên `tour:<slug>`
    (bài học nợ G5 của F15). Dùng `tourRevalidationTags(slug)` sau commit.
11. **Ô chọn chỉ có mục đang hiện** → tour thuộc danh mục đang ẩn mở ra thì ô
    trống và lưu sẽ đổi danh mục. Ô chọn phải có cả mục ẩn.
12. **Câu copy hứa sai hệ quả** (§2j).

## 5. Kiểm thử

TDD trên logic thuần (luật 4); mỗi ca mới phải kiểm bằng đột biến (plan P4e-2,
bài học 15).

- **Contract:** `tourReadiness` (từng điều kiện, ngày thiếu sắp tăng dần, tour
  1 ngày) · ba hàm giá vốn (làm tròn HALF_UP, `maxGroupSize` 0, danh sách rỗng)
  · schema: trần từng trường, đúng một điểm chính, ngày không trùng,
  `updateDetails` không nhận slug, `version` round-trip.
- **API (int):** mỗi thao tác có ca thành công và ca cho từng mã lỗi · thay danh
  sách giữ đúng thứ tự · lưu tab con đẩy `version` · hai lệnh cùng `version` thì
  đúng một lệnh `STALE_TOUR` · giảm số ngày xoá ngày thừa · tour đang bán bị chặn
  khi làm thiếu · `setPublished(false)` qua khi tour thiếu · xoá kéo theo đúng
  bảng và giữ `Enquiry` · giá vốn tính lại khi đổi chi phí và số khách · bust
  đúng hai tag sau commit · khối guard kể đủ mọi route cộng một ca 401 (bài học
  5) · test đối chiếu giá vốn trên fixture.
- **Admin:** VM thuần · hộp New tour (slug tự điền, thôi tự điền khi sửa tay) ·
  ổ khoá số ngày và sàn số khách · radio điểm chính · khung sửa danh sách (thêm,
  xoá, lên, xuống, trần) · tổng chi phí trực tiếp · link trong khung readiness ·
  codec cho từng mã lỗi · nút Delete chỉ hiện khi `bookingCount = 0` · hỏi lại
  khi rời trang có thay đổi.
- **Thử tay trên production** sau khi cả Render lẫn Vercel deploy xong, từng
  bước, chờ xác nhận: tạo tour → điền đủ bốn tab → thêm chuyến → bật bán → khách
  thấy và đặt được (Stripe test) → đổi giá gốc → xoá một tour chưa bán.

## 6. Đối chiếu Nexora (luật 10)

| Tầng | Nexora | F17 | Phân loại |
| --- | --- | --- | --- |
| Tính năng | Tạo và sửa tour | Có, theo tab | Vá thụt lùi |
| Tính năng | Xoá tour | Chỉ tour chưa từng có booking | Làm khác, an toàn hơn: lịch sử booking luôn còn |
| Tính năng | Ô chọn ảnh từ thư viện | F18 | Vá ở phần sau |
| Tính năng | Nhật ký thao tác | P4f | Đã xếp lịch, không tính thụt lùi |
| Hạ tầng | Phân quyền admin | `@Roles(ADMIN)` | Tương đương |
| Hạ tầng | Giới hạn tần suất ghi | ADR-0037 tự áp | Tương đương |
| Hạ tầng | Làm mới cache web | Mọi lệnh ghi bust hai tag sau commit | Tương đương |
| Hạ tầng | Ánh xạ lỗi | `toContractError` dùng chung | v2 tốt hơn |

Web không cần sửa: `/tours/[slug]` dựng sẵn slug có lúc build và dựng slug mới
khi có người mở lần đầu (`dynamicParams` mặc định, đã gỡ bản `false` từ trước),
nên tour mới hiện ngay sau khi bật bán; tour bị xoá trả 404 sau khi bust.

## 7. Definition of done

- `pnpm gate:int` xanh trên nhánh (theo mục Quy trình gate của plan).
- Review ở session gốc, vá hết phát hiện; rebase lên `main` rồi
  `git merge --ff-only`; CI trên `main` xanh.
- Entry `docs/CHANGELOG.md` viết đúng ngày merge; ADR-0047, spec và plan có mặt
  trong `docs/README.md`.
- Thử tay trên production theo §5.
- Không migration, không đổi env, không đụng hạ tầng sống (luật 15).

## 8. Rủi ro đã biết

- **Lượt seed lại khoảng 03/11.** `seed.ts` upsert nội dung tour kèm cập nhật,
  nên mọi chỉnh sửa trên 29 tour seed sẽ bị ghi đè; lượt ấy cũng làm lại DB, nên
  tour tạo tay mất. Tour dùng để demo buổi bảo vệ phải tạo SAU lượt seed.
- **Khe deploy** (ADR-0047 §Hệ quả): trang lỗi vài phút ở khu làm việc; thử tay
  chỉ bắt đầu khi cả hai đã lên.
- **Đường tạo booking đổi chỗ import hàm giá vốn.** Công thức không đổi, có test
  đối chiếu; vẫn là thay đổi ở money-path nên review phải đọc kỹ.
- **Khối lượng lớn so với freeze 15/10.** Plan chia task nhỏ; thi công ở session
  riêng, session gốc review (nếp F15, F16).
