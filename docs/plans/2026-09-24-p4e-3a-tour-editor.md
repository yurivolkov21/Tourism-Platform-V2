# Plan thi công F17 — Tạo và sửa tour (P4e-3a)

> **Cho agent thi công:** làm tuần tự từng task bằng skill
> `superpowers:executing-plans`. Bước dùng checkbox `- [ ]`. Prompt bàn giao ở
> cuối file KHÔNG cho dùng subagent.

**Mục tiêu:** admin tạo được tour mới (đang tắt bán), sửa mọi nội dung chữ và số
của tour qua bốn tab, bật bán khi tour đủ để bán, và xoá được tour chưa từng có
booking — mà không lần nào làm lệch số ngày, lịch trình, chuyến và ghế đang khớp
hôm nay.

**Kiến trúc (ADR-0047):** mỗi tab một lệnh ghi; khối danh sách thay nguyên cả
danh sách; một mã phiên bản (`updatedAt`) cho cả tour, so-và-ghi trong MỘT câu
lệnh; hàm thuần `tourReadiness` và ba hàm giá vốn (trên cent nguyên) sống ở
`@tourism/contract`. Không migration, không sửa web.

**Stack:** Zod 4 (contract) · NestJS 11 + Prisma 7 + oRPC (api) · Next.js 16 +
React 19 + Base UI (admin) · Vitest.

**Spec:** [2026-09-24-p4e-3a-tour-editor-design.md](../specs/2026-09-24-p4e-3a-tour-editor-design.md)
— HỢP ĐỒNG của việc này; plan chỉ nói cách làm.
**ADR:** [0047 — sửa tour theo từng khối](../adr/0047-tour-editor-sections.md)

| Tính năng | Nhánh | Task |
| --- | --- | --- |
| **F17** tạo và sửa tour | `feat/p4e-3a-tour-editor` | 1–13 |

## Quyết định của plan

Spec để ngỏ hoặc nói chưa đúng sáu chỗ dưới đây. Plan chốt như sau, và spec
§2c, §2d, §3 đã được sửa trong cùng commit với plan:

1. **Mọi lệnh ghi đi `POST`**, không `PUT`/`DELETE` như bản nháp spec §3. Cả bề
   mặt admin hiện ghi bằng `POST` (danh mục, điểm đến, chuyến, công tắc đăng),
   và thêm verb mới là phải sửa danh sách `methods` của CORS trong
   `apps/api/src/bootstrap.ts` kèm test canh (chú thích ở đó dặn vậy). Xoá là
   `POST /api/admin/tours/{id}/delete`, cùng khuôn `…/published`, `…/move`,
   `…/active`.
2. **`setPublished` không đẩy `updatedAt`.** Công tắc không đổi nội dung, nên
   form đang mở trong khu làm việc không được thành "cũ" chỉ vì admin vừa bấm On
   sale ở phần đầu trang. Hai lệnh vẫn xếp hàng nhau vì `setPublished` khoá hàng
   tour (`SELECT … FOR UPDATE`) trước khi đọc. Đổi lại: kiểu sắp "mới cập nhật"
   ngoài web thôi nhảy khi admin chỉ bật/tắt bán.
3. **Phiên bản mới luôn lớn hơn phiên bản cũ ít nhất 1 ms** (`nextTourVersion`).
   Hai lần lưu rơi cùng một mili-giây (int test chạy nhanh là gặp) sẽ cho hai
   phiên bản trùng nhau, và phép so mất tác dụng.
4. **Xoá tour kéo theo cả đánh giá gắn tour** (`Review.tour` khai
   `onDelete: Cascade` — spec §2d sót). Tour chưa từng có booking thì không có
   đánh giá của khách, nhưng vẫn có thể có đánh giá `CURATED`; hộp xác nhận phải
   nói ra.
5. **Spec §2c nói ngược một ví dụ.** Tour đang bán bị chặn khi TĂNG số ngày (ngày
   mới chưa có lịch trình), không phải khi giảm: giảm chỉ xoá ngày thừa, các ngày
   còn lại vẫn đủ. Muốn thêm ngày cho tour đang bán thì gỡ bán trước.
6. **Ngày lịch trình ngoài 1..N trả 400** bằng `ORPCError('BAD_REQUEST')` ném ở
   controller, không thêm mã contract (danh sách mã là cố định). Client đúng
   không bao giờ gửi.

## Ràng buộc toàn cục

Áp cho **mọi** task, không nhắc lại ở từng chỗ:

- **TDD** (luật 4): viết test trước, chạy cho ĐỎ đúng lý do, rồi mới cài. Mỗi ca
  test mới phải **thử đột biến**: sửa code cho sai, thấy ca ấy đỏ, trả lại — ghi
  kết quả vào báo cáo bàn giao.
- **Comment code tiếng Việt** (luật 8); **copy người dùng thấy bằng tiếng Anh**,
  nằm trong `@tourism/i18n` (luật 7). **Tokens-only**, không hex (luật 6).
- **Commit Conventional, tiếng Việt CÓ DẤU, không AI attribution** — không dòng
  `Co-Authored-By` (luật 12). Stage theo **đường dẫn tường minh**, không
  `git add -A`. Chạy `pnpm lint:fix` trước khi stage.
- **Không đụng**: `apps/web`, `apps/mobile`, `apps/api/prisma/schema.prisma` và
  `apps/api/prisma/migrations/` (F17 KHÔNG có migration), module
  `payments`/`refunds`, `apps/api/src/modules/catalog/catalog.service.ts` (API
  công khai). **Ngoại lệ có chủ đích:** `bookings.service.ts`,
  `admin-departures.service.ts` và `apps/api/prisma/seed.ts` được sửa ĐÚNG MỘT
  việc ở Task 2 — đổi chỗ import hàm giá vốn — không gì khác.
- **Không hạ tầng sống** (luật 15). F17 không cần gì từ hạ tầng; thấy mình sắp
  cần thì DỪNG và hỏi.
- **Tên cố định** (review sẽ grep đúng chữ):
  - Thao tác: `admin.tours.create` · `get` · `updateDetails` · `setItinerary` ·
    `setFaqsPolicies` · `setCosts` · `delete`; `setPublished` có sẵn.
  - Mã lỗi: `NOT_FOUND` · `SLUG_TAKEN` · `STALE_TOUR` · `DURATION_LOCKED` ·
    `GROUP_SIZE_BELOW_SEATS` · `TOUR_NOT_READY` · `TOUR_HAS_BOOKINGS`.
  - Route API: `POST /api/admin/tours` (create) · `GET /api/admin/tours/{slug}`
    (get) · `POST /api/admin/tours/{id}/details` · `…/{id}/itinerary` ·
    `…/{id}/faqs-policies` · `…/{id}/costs` · `…/{id}/delete`;
    `…/{id}/published` có sẵn.
  - Route admin: `/tours/[slug]` (Details) · `/tours/[slug]/itinerary` ·
    `/tours/[slug]/content` (FAQ & policies) · `/tours/[slug]/costs` ·
    `/tours/[slug]/departures` (có sẵn).
- **Trần dữ liệu** (contract gương cột DB — spec §3): slug 120 theo
  `SLUG_PATTERN` · tên 200 · tóm tắt 500 · ghi chú dữ kiện 280 · điểm hẹn 300 ·
  điểm nổi bật / bao gồm / không bao gồm ≤ 15 dòng, mỗi dòng 1..200 · ngày lịch
  trình: tiêu đề 1..200, mô tả ≤ 2000 · FAQ ≤ 20, câu hỏi 1..300, trả lời
  1..2000 · chính sách ≤ 10, loại `BOOKING`/`GENERAL`, tiêu đề 1..200, nội dung
  1..4000 · dòng chi phí ≤ 30, nhãn 1..120, số tiền ≥ 0 hai chữ số lẻ · giá gốc
  lớn hơn 0 theo `DeparturePriceSchema` · số ngày 1..30 · số khách tối đa
  1..100 · điểm đến 1..10, đúng một điểm chính.
- **Chữ trên giao diện** (bài học 20 của P4e-2): **On sale / Off sale** là công
  tắc đăng tour; **Bookable** là của chuyến; **Hide / Show** là của danh mục và
  điểm đến. KHÔNG dùng "Draft", "Publish", "Active".
- **Contract và i18n được đọc từ `dist`**: sửa hai gói ấy xong phải build lại
  trước khi test api/admin thấy thay đổi —
  `pnpm turbo run build --filter=@tourism/contract --filter=@tourism/i18n --output-logs=errors-only`.
- **Tài liệu `.md`:** không để dòng bắt đầu bằng `+` ở cột 0; `git diff` file
  `.md` trước khi stage; không sửa entry CHANGELOG cũ.

### Quy trình gate (luật 11) — dùng ở cuối MỖI task

`pnpm gate:int` trần chạy song song 10 luồng và từng làm máy phình RAM, nên chạy
tách bước, hãm song song. Build web prerender gọi API thật, nên phải có API sống.
Chạy từ gốc repo bằng **Git Bash**, Docker Postgres phải đang chạy
(`docker ps`; tắt thì mở Docker Desktop rồi `docker start tourism-v2-postgres-1`):

```bash
# 1. API sống cho bước build web
pnpm turbo run build --filter=@tourism/api --output-logs=errors-only
(cd apps/api && node dist/main.js > /tmp/f17-api.log 2>&1 &)
for i in $(seq 1 30); do curl -sf http://localhost:3001/api/health > /dev/null && echo "API sống" && break; sleep 2; done

# 2. build + typecheck
NEXT_PUBLIC_API_URL=http://localhost:3001 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm turbo run build typecheck --concurrency=2 --output-logs=errors-only

# 3. unit test — 16 worker làm ca zod-config.spec.ts của contract hết giờ (đo 23/09)
pnpm turbo run test --concurrency=2 --output-logs=errors-only -- --maxWorkers=4

# 4. lint + luật tokens của mobile
pnpm lint && node scripts/check-mobile-tokens-only.mjs

# 5. integration test
pnpm test:int --concurrency=2
```

Tắt API sau khi xong (PowerShell) — chỉ giết đúng tiến trình đang nghe cổng 3001:

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Cả năm bước xanh mới được khai task xong. Chạy gate trong một tác vụ nền thì
tác vụ ấy KHÔNG báo xong chừng nào API cổng 3001 còn sống (bẫy đo 24/09) — tắt
API là nó xong. Máy chậm bất thường thì dừng và báo.

## Bài học mang sang từ F14, F15, F16 — đọc TRƯỚC dòng code đầu tiên

Ba vòng review gần nhất tìm ra 15, 27 và 15 lỗi thật. Những lỗi dưới đây lặp đi
lặp lại; F17 lớn hơn cả ba cộng lại nên càng dễ đi lại đúng vết.

**API**

1. **Lỗi DB bắt ngay tại câu ghi, không SELECT kiểm trước.** Slug trùng →
   `P2002` → `SLUG_TAKEN`. Hàng không còn → `P2025` → `NOT_FOUND`. Khoá ngoại →
   `P2003`: ở `delete` là `TOUR_HAS_BOOKINGS`, ở `create`/`updateDetails` là
   `NOT_FOUND` (danh mục hay điểm đến không tồn tại). Kiểm-trước-ghi-sau để hở
   một cửa sổ, và lỗi ở cửa sổ ấy ra 500.
2. **So-và-ghi trong MỘT câu** (spec §2e): `updateMany` có điều kiện
   `updatedAt = version`, đếm `count`. Đọc `updatedAt` bằng một câu riêng rồi so
   là đúng cái lỗ ở mục 1.
3. **Lưu tab con cũng đẩy `updatedAt`.** Quên là người kia không biết tour đã đổi.
4. **Bust cache SAU commit**, `tourRevalidationTags(slug)`, fire-and-forget; lệnh
   ghi hỏng thì KHÔNG bust.
5. **Controller:** `@Roles(ADMIN)` cấp class, đổi lỗi bằng `toContractError` (có
   `declaredError` bên trong — `errors` của oRPC là Proxy trả hàm dựng cho MỌI
   mã). Không so `error.name`.

**Test**

6. **Mỗi ca test mới thử đột biến.** F14 có ba ca xanh giả, F15 có năm.
7. **Fixture phải phân biệt được kết quả đúng với kết quả lười.** Ca lọc/đếm cần
   ít nhất hai tour; ca "đọc từ response" cần response KHÁC request; ca biên độ
   dài phải có đúng N (được) và N+1 (bị bắt), ở CẢ contract lẫn validator admin.
8. **Khối guard của int spec kể ĐỦ mọi route mới, cộng một ca 401.**
9. **Khớp chữ chính xác, không `/…/i`**; ký tự Unicode trong test dựng từ mã số
   (`String.fromCodePoint`) hoặc lớp `\p{…}`.

**Admin**

10. **Nút mở hộp thoại khoá bằng `focusableWhenDisabled`** khi bảng hay trang
    đang làm mới — nút `disabled` thật làm focus bàn phím rơi về `<body>` khi hộp
    đóng (vòng review F15).
11. **Một chữ cho mỗi khái niệm**, và **mọi câu hứa hệ quả phải đo trên code
    trước khi viết** — hai vòng review liền bắt được câu copy nói sai.
12. **Dùng lại, đừng chép:** `FormField`, `ConfirmWriteDialog` (kèm `warningTone`),
    `StableLabel`, `hasFormErrors`, `createWriteErrorCodec`, `slugifyVietnamese`,
    `SLUG_PATTERN`, câu lỗi `slugShape` và ba thuộc tính tắt soát chính tả của ô
    slug, và **`FormSelect` của kit admin cho MỌI ô chọn** — không dùng
    `<select>` gốc (lượt thử tay F15, 24/09: user thấy dropdown gốc của trình
    duyệt thô, lệch mọi dropdown khác). Test chọn bằng `combobox` rồi `option`,
    khuôn `destination-form-dialog.spec.tsx`.

**Quy trình**

13. **Khe deploy:** field bắt buộc MỚI ở response của endpoint CŨ phải có đường
    lùi phía đọc (F16 từng làm trang sập 500). F17 không đổi response cũ nào —
    giữ nguyên như vậy.
14. **Comment không khai trạng thái tương lai** ("Task X sẽ…").
15. **Tiền là chuỗi thập phân và cent nguyên**, không bao giờ số thực.
16. **Entry CHANGELOG viết theo ngày viết**; session review thêm entry merge.

## Bản đồ file

| File | Trách nhiệm | Task |
| --- | --- | --- |
| `libs/shared/contract/src/schemas/tour-costs.ts` | Ba hàm giá vốn trên cent, hai enum chi phí | 1 |
| `apps/api/src/modules/catalog/tour-cost-items.ts` | Hàng Prisma → `CostItemLike` (một chỗ đổi `Decimal` ra chuỗi) | 2 |
| `apps/api/src/modules/catalog/tour-costs-fixture.spec.ts` | Đối chiếu hai bản trên fixture seed, rồi khoá bằng snapshot | 2 |
| `apps/api/src/modules/catalog/tour-costs.ts` + `.spec.ts` | XOÁ — call site chuyển sang contract | 2 |
| `libs/shared/contract/src/schemas/tour-readiness.ts` | `tourReadiness` + `TourReadinessSchema` — thuần | 3 |
| `libs/shared/contract/src/schemas/admin-tours.ts` | `AdminTourDetailSchema`, sáu input, hằng trần | 4 |
| `libs/shared/contract/src/contract.ts` | Bảy procedure mới, mã lỗi mới của `setPublished` | 4 |
| `apps/api/src/modules/catalog/tour-editor-fixture.spec.ts` | Mọi tour seed lưu lại được qua bốn schema sửa | 4 |
| `apps/api/src/modules/catalog/admin-tour-errors.ts` | Lỗi mang mã contract của vùng tour | 5 |
| `apps/api/src/modules/catalog/tour-editor-rules.ts` | `nextTourVersion`, `liveSeatsMax` — thuần | 5 |
| `apps/api/src/modules/catalog/tour-state.ts` | `claimTour` (so-và-ghi), `readTourReadiness` — trong transaction | 6, 7 |
| `apps/api/src/modules/catalog/admin-tours.service.ts` | `get` · `create` · `delete` (Task 5), bốn lệnh sửa (Task 6) | 5, 6 |
| `apps/api/src/modules/catalog/admin-tours.controller.ts` | Guard + `toContractError` | 5, 6, 7 |
| `apps/api/src/modules/catalog/admin-tours.int.spec.ts` | Int test bảy thao tác | 5, 6 |
| `apps/api/src/modules/catalog/admin-catalog.service.ts` | Cổng đăng trong `setTourPublished` | 7 |
| `apps/admin/src/lib/list-editor.ts` + `components/kit/list-editor.tsx` | Khung sửa danh sách dùng chung | 8 |
| `apps/admin/src/lib/unsaved-changes.ts` + `components/kit/unsaved-changes.tsx` | Hỏi lại khi rời trang lúc có thay đổi chưa lưu | 8 |
| `apps/admin/src/lib/api/tours.ts` | Client cho bảy thao tác + hai danh sách chọn | 9 |
| `apps/admin/src/lib/tour-editor-view.ts` | VM thuần: tab, readiness, ngày bị xoá, tổng chi phí | 9 |
| `apps/admin/src/lib/tour-editor-write.ts` | Codec lỗi, giá trị form, validator, payload | 9 |
| `apps/admin/src/lib/use-section-save.ts` | Vòng đời một lần Save của tab | 10 |
| `apps/admin/src/app/(admin)/tours/[slug]/{layout.tsx,load-tour.ts}` | Khu làm việc: đầu trang, tab, readiness; đọc tour một lần mỗi request | 10 |
| `apps/admin/src/app/(admin)/tours/[slug]/actions.ts` | Server action của bốn tab và lệnh xoá | 11, 12 |
| `apps/admin/src/test/tour-detail.ts` | Fixture `AdminTourDetail` cho mọi spec admin của F17 | 9 |
| `apps/admin/src/components/tours/editor/*.tsx` | Hộp New tour, phần đầu, thanh tab, bốn form, vùng xoá | 10–12 |
| `apps/admin/src/app/(admin)/tours/[slug]/{page,itinerary/page,content/page,costs/page}.tsx` | Bốn tab | 11, 12 |
| `libs/shared/i18n/src/lib/messages.ts` | `messages.admin.tours.editor` + `messages.admin.listEditor` | 4, 8–12 |

---

> Mở nhánh: `git checkout -b feat/p4e-3a-tour-editor` (từ `main` đã có ADR-0047,
> spec F17 và plan này).

## Task 1 — Ba hàm giá vốn trên cent nguyên (contract)

**Files:**

- Create: `libs/shared/contract/src/schemas/tour-costs.ts`
- Create: `libs/shared/contract/src/schemas/tour-costs.spec.ts`
- Modify: `libs/shared/contract/src/index.ts` (thêm `export * from './schemas/tour-costs.js';`
  theo thứ tự chữ cái, sau `stats.js`)

**Interfaces:**

- Consumes: `toCents(value: string): number`, `fromCents(cents: number): string`
  từ `./refund-policy.js` (có sẵn).
- Produces (Task 2, 4, 6, 9, 12 dùng):
  - `TourCostCategorySchema` (8 giá trị, gương enum Prisma `TourCostCategory`),
    `type TourCostCategory`
  - `TourCostBasisSchema` (`'PER_PERSON' | 'PER_DEPARTURE'`), `type TourCostBasis`
  - `interface CostItemLike { amount: string; basis: TourCostBasis }`
  - `perPersonTotal(items: readonly CostItemLike[]): string` — `'115.50'`
  - `perDepartureTotal(items: readonly CostItemLike[]): string`
  - `derivedCostPrice(items: readonly CostItemLike[], maxGroupSize: number): string`

- [ ] **Bước 1: Viết test đỏ** — `tour-costs.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  type CostItemLike,
  derivedCostPrice,
  perDepartureTotal,
  perPersonTotal,
} from './tour-costs.js';

/**
 * Giá vốn của một tour (ADR-0033 §2), dời lên contract ở F17 (ADR-0047 §8).
 * Bộ ca chép từ bản `Prisma.Decimal` cũ ở `apps/api`, cộng ba ca làm tròn mà
 * bản cent nguyên phải giữ đúng: nửa cent đi LÊN, không làm tròn chẵn, không cắt.
 */
const perPerson = (amount: string): CostItemLike => ({ amount, basis: 'PER_PERSON' });
const perDeparture = (amount: string): CostItemLike => ({ amount, basis: 'PER_DEPARTURE' });

describe('tour-costs', () => {
  it('danh sách rỗng cho "0.00" ở cả ba hàm, không phải null', () => {
    expect(perPersonTotal([])).toBe('0.00');
    expect(perDepartureTotal([])).toBe('0.00');
    expect(derivedCostPrice([], 20)).toBe('0.00');
  });

  it('mỗi hàm CHỈ cộng dòng thuộc cách tính của nó', () => {
    const items = [perPerson('30.00'), perDeparture('400.00'), perPerson('85.50')];

    expect(perPersonTotal(items)).toBe('115.50');
    expect(perDepartureTotal(items)).toBe('400.00');
  });

  it('costPrice = theo khách + theo chuyến chia số khách tối đa', () => {
    // 30.00 + 85.50 + 400 / 20 = 135.50
    const items = [perPerson('30.00'), perPerson('85.50'), perDeparture('400.00')];

    expect(derivedCostPrice(items, 20)).toBe('135.50');
  });

  it('nửa cent làm tròn LÊN — không làm tròn chẵn', () => {
    // 100.01 / 2 = 50.005 → 50.01 (làm tròn chẵn sẽ ra 50.00)
    expect(derivedCostPrice([perDeparture('100.01')], 2)).toBe('50.01');
  });

  it('phần lẻ dưới nửa cent bỏ đi, trên nửa cent làm tròn lên — không cắt, không làm tròn trần', () => {
    // 100.00 / 3 = 33.333… → 33.33 (làm tròn trần sẽ ra 33.34)
    expect(derivedCostPrice([perDeparture('100.00')], 3)).toBe('33.33');
    // 200.00 / 3 = 66.666… → 66.67 (cắt sẽ ra 66.66)
    expect(derivedCostPrice([perDeparture('200.00')], 3)).toBe('66.67');
  });

  it('maxGroupSize <= 0 thì BỎ phần theo chuyến thay vì chia cho 0', () => {
    const items = [perPerson('30.00'), perDeparture('400.00')];

    expect(derivedCostPrice(items, 0)).toBe('30.00');
    expect(derivedCostPrice(items, -5)).toBe('30.00');
  });

  it('số tiền thiếu chữ số lẻ vẫn cộng đúng cent', () => {
    // Chặn một bản lỡ tay dùng parseFloat/Number: 12.5 + 7 phải là 19.50.
    expect(perPersonTotal([perPerson('12.5'), perPerson('7')])).toBe('19.50');
  });
});
```

- [ ] **Bước 2: Chạy, thấy đỏ** —
  `pnpm --filter @tourism/contract exec vitest run src/schemas/tour-costs.spec.ts`
  → FAIL "Cannot find module './tour-costs.js'".

- [ ] **Bước 3: Cài** — `tour-costs.ts`:

```ts
import { z } from 'zod';
import { fromCents, toCents } from './refund-policy.js';

/**
 * Giá vốn của một tour (ADR-0033 §2) — THUẦN, không đụng DB.
 *
 * ## Ba hàm chứ không một
 *
 * `perPersonTotal` và `perDepartureTotal` là hai vế mà BÁO CÁO dùng tách riêng:
 * khách huỷ thì chi phí theo khách đi theo họ, còn chi phí theo chuyến ở lại —
 * xe vẫn chạy (ADR-0033 §4). `derivedCostPrice` gộp cả hai thành con số BÁN
 * HÀNG (`Tour.costPrice`), chỉ để đặt giá và xem biên lời. Gộp ba thành một là
 * mất đúng cái phân biệt đắt giá nhất của mô hình.
 *
 * ## Vì sao ở contract
 *
 * Dời từ `apps/api` lên đây ở F17 (ADR-0047 §8): màn Costs của admin tính tổng
 * ngay khi gõ, còn API tính lúc ghi — hai bên phải ra CÙNG một con số, nên chỉ
 * được có một bản.
 *
 * Tính trên CENT NGUYÊN như `refund-policy.ts`: tiền không bao giờ đi qua số
 * thực. Ba chuỗi trả về luôn có đúng hai chữ số lẻ ("135.50").
 */

/** Gương enum Prisma `TourCostCategory` — báo cáo nhóm theo hạng mục nên là enum đóng. */
export const TourCostCategorySchema = z.enum([
  'TRANSPORT',
  'ACCOMMODATION',
  'MEALS',
  'GUIDE',
  'ACTIVITIES',
  'PERMITS',
  'INSURANCE',
  'OTHER',
]);
export type TourCostCategory = z.output<typeof TourCostCategorySchema>;

/** Gương enum Prisma `TourCostBasis`. */
export const TourCostBasisSchema = z.enum(['PER_PERSON', 'PER_DEPARTURE']);
export type TourCostBasis = z.output<typeof TourCostBasisSchema>;

/** Hai field là đủ để cộng. `amount` là chuỗi thập phân như cột `Decimal(14,2)`. */
export interface CostItemLike {
  amount: string;
  basis: TourCostBasis;
}

function sumCents(items: readonly CostItemLike[], basis: TourCostBasis): number {
  return items.reduce((sum, item) => (item.basis === basis ? sum + toCents(item.amount) : sum), 0);
}

/** Σ dòng theo ĐẦU KHÁCH — nhân với số ghế của một booking, biến mất cùng khách khi họ huỷ. */
export function perPersonTotal(items: readonly CostItemLike[]): string {
  return fromCents(sumCents(items, 'PER_PERSON'));
}

/** Σ dòng theo CHUYẾN — tính MỘT lần cho mỗi chuyến đã chạy, không nhân ghế. */
export function perDepartureTotal(items: readonly CostItemLike[]): string {
  return fromCents(sumCents(items, 'PER_DEPARTURE'));
}

/**
 * `Tour.costPrice` — *chi phí theo chuyến ÷ số khách tối đa + chi phí theo khách*,
 * làm tròn nửa cent đi lên (HALF_UP) như bản `Prisma.Decimal` cũ.
 *
 * Mẫu số là `maxGroupSize`, tức cách đọc LẠC QUAN: chuyến bán nửa ghế thì giá
 * vốn thật mỗi khách cao hơn con số này (ADR-0033 §Giới hạn #1). Báo cáo không
 * dùng hàm này mà dùng hai vế tách riêng ở trên.
 *
 * `maxGroupSize <= 0` không xảy ra với dữ liệu hợp lệ; gặp thì bỏ phần theo
 * chuyến — con số thấp hơn sự thật, không phải một lỗi chia cho 0 giữa đường
 * tạo booking.
 */
export function derivedCostPrice(items: readonly CostItemLike[], maxGroupSize: number): string {
  const variable = sumCents(items, 'PER_PERSON');
  if (maxGroupSize <= 0) return fromCents(variable);
  const fixed = sumCents(items, 'PER_DEPARTURE');
  // HALF_UP trên số nguyên: ⌊(2·fixed + n) / 2n⌋ bằng fixed/n làm tròn nửa lên.
  const fixedShare = Math.floor((2 * fixed + maxGroupSize) / (2 * maxGroupSize));
  return fromCents(variable + fixedShare);
}
```

- [ ] **Bước 4: Chạy lại, thấy xanh.** Thêm dòng export vào `index.ts`.

- [ ] **Bước 5: Thử đột biến** (ghi kết quả vào báo cáo):
  1. `Math.floor((2 * fixed + maxGroupSize) / (2 * maxGroupSize))` → `Math.floor(fixed / maxGroupSize)` — ca 66.67 phải đỏ.
  2. → `Math.ceil(fixed / maxGroupSize)` — ca 33.33 phải đỏ.
  3. Trong `sumCents`, `toCents(item.amount)` → `Math.round(Number(item.amount) * 100)` — ca này KHÔNG đỏ được (tương đương trên dữ liệu 2 chữ số lẻ); ghi rõ là đột biến tương đương.
  4. `perPersonTotal` gọi `sumCents(items, 'PER_DEPARTURE')` — ca "mỗi hàm CHỈ cộng…" phải đỏ.
  5. Bỏ nhánh `maxGroupSize <= 0` — ca chia cho 0 phải đỏ (ra `NaN`).

- [ ] **Bước 6: Gate + commit.** Chạy Quy trình gate. Rồi:

```bash
git add libs/shared/contract/src/schemas/tour-costs.ts libs/shared/contract/src/schemas/tour-costs.spec.ts libs/shared/contract/src/index.ts
git commit -m "feat(contract): ba hàm giá vốn tính trên cent nguyên và hai enum chi phí"
```

---

## Task 2 — API gọi hàm giá vốn của contract, bỏ bản `Prisma.Decimal`

Đây là thay đổi DUY NHẤT của F17 chạm money-path (`bookings.service.ts` —
đường tạo booking). Chỉ đổi chỗ import và thêm một bước đổi `Decimal` ra chuỗi;
không đổi logic xung quanh. Đối chiếu hai bản TRƯỚC khi xoá bản cũ (spec §2f,
§4.7).

**Files:**

- Create: `apps/api/src/modules/catalog/tour-cost-items.ts` + `tour-cost-items.spec.ts`
- Create: `apps/api/src/modules/catalog/tour-costs-fixture.spec.ts`
- Modify: `apps/api/src/modules/bookings/bookings.service.ts` (dòng 27 import, dòng 381)
- Modify: `apps/api/src/modules/catalog/admin-departures.service.ts` (dòng 32 import, dòng 211)
- Modify: `apps/api/prisma/seed.ts` (dòng 40–44 import, 495–505, 800–827)
- Delete: `apps/api/src/modules/catalog/tour-costs.ts`, `apps/api/src/modules/catalog/tour-costs.spec.ts`

**Interfaces:**

- Consumes: Task 1 (`perPersonTotal`, `perDepartureTotal`, `derivedCostPrice`,
  `CostItemLike`, hai enum schema).
- Produces: `costItemsOf(rows: readonly { amount: Prisma.Decimal; basis: TourCostBasis }[]): CostItemLike[]`
  ở `tour-cost-items.ts` — Task 6 dùng lại khi tính lại `costPrice`.

- [ ] **Bước 1: Build contract** để api thấy Task 1:
  `pnpm turbo run build --filter=@tourism/contract --output-logs=errors-only`.

- [ ] **Bước 2: Test đỏ cho bộ đổi** — `tour-cost-items.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { costItemsOf } from './tour-cost-items.js';

describe('costItemsOf', () => {
  it('đổi Decimal ra chuỗi ĐỦ hai chữ số lẻ và giữ nguyên cách tính', () => {
    const rows = [
      { amount: new Prisma.Decimal('12.5'), basis: 'PER_PERSON' as const },
      { amount: new Prisma.Decimal('400'), basis: 'PER_DEPARTURE' as const },
    ];

    expect(costItemsOf(rows)).toEqual([
      { amount: '12.50', basis: 'PER_PERSON' },
      { amount: '400.00', basis: 'PER_DEPARTURE' },
    ]);
  });
});
```

  Chạy `pnpm --filter @tourism/api exec vitest run src/modules/catalog/tour-cost-items.spec.ts`
  → FAIL (thiếu module). Cài `tour-cost-items.ts`:

```ts
import type { CostItemLike } from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';
import type { TourCostBasis } from '../../generated/prisma/enums.js';

/**
 * Hàng `tour_cost_items` đọc từ Prisma → hình dạng mà ba hàm giá vốn của
 * contract nhận (ADR-0047 §8). Một chỗ duy nhất đổi `Decimal` ra chuỗi.
 *
 * `toFixed(2)` chứ không `toString()`: Decimal.js in dạng số mũ cho giá trị rất
 * nhỏ hoặc rất lớn, còn `toCents` chỉ hiểu dạng thập phân thường.
 */
export function costItemsOf(
  rows: readonly { amount: Prisma.Decimal; basis: TourCostBasis }[],
): CostItemLike[] {
  return rows.map((row) => ({ amount: row.amount.toFixed(2), basis: row.basis }));
}
```

  Chạy lại → PASS. Đột biến: `toFixed(2)` → `toString()` phải làm ca này đỏ.

- [ ] **Bước 3: Test đối chiếu trên fixture seed** — `tour-costs-fixture.spec.ts`,
  viết khi bản cũ CÒN sống:

```ts
import {
  derivedCostPrice,
  perDepartureTotal,
  perPersonTotal,
  TourCostBasisSchema,
  TourCostCategorySchema,
} from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';
import { Prisma } from '../../generated/prisma/client.js';
import { TourCostBasis, TourCostCategory } from '../../generated/prisma/enums.js';
// Bản cũ — chỉ sống tới hết Bước 5 của Task 2 F17.
import * as legacy from './tour-costs.js';

/**
 * Ba con số giá vốn của MỌI tour trong fixture seed, tính bằng bản contract
 * (ADR-0047 §8). Hai `it` đầu là cầu nối lúc dời: bản contract phải ra đúng con
 * số của bản `Prisma.Decimal` cũ. Sau khi bản cũ bị xoá, snapshot giữ các con số
 * ấy đứng yên.
 */
function itemsOf(tourId: string) {
  return catalog.tourCostItems
    .filter((item) => item.tourId === tourId)
    .map((item) => ({ amount: String(item.amount), basis: item.basis }));
}

function figures() {
  return catalog.tours.map((tour) => {
    const items = itemsOf(tour.id);
    return `${tour.slug} ${perPersonTotal(items)} ${perDepartureTotal(items)} ${derivedCostPrice(items, tour.maxGroupSize ?? 20)}`;
  });
}

describe('giá vốn trên fixture seed', () => {
  it('hai enum chi phí của contract gương đúng enum Prisma', () => {
    expect(TourCostCategorySchema.options).toEqual(Object.values(TourCostCategory));
    expect(TourCostBasisSchema.options).toEqual(Object.values(TourCostBasis));
  });

  it('bản contract ra ĐÚNG ba con số của bản Prisma.Decimal cho mọi tour', () => {
    // Fixture phải có dòng chi phí thật — so hai chuỗi "0.00" không chứng minh gì.
    expect(catalog.tourCostItems.length).toBeGreaterThan(0);
    for (const tour of catalog.tours) {
      const items = itemsOf(tour.id);
      const decimals = items.map((item) => ({
        amount: new Prisma.Decimal(item.amount),
        basis: item.basis,
      }));
      const size = tour.maxGroupSize ?? 20;
      expect(perPersonTotal(items)).toBe(legacy.perPersonTotal(decimals).toFixed(2));
      expect(perDepartureTotal(items)).toBe(legacy.perDepartureTotal(decimals).toFixed(2));
      expect(derivedCostPrice(items, size)).toBe(legacy.derivedCostPrice(decimals, size).toFixed(2));
    }
  });

  it('ba con số của mọi tour seed đứng yên', () => {
    expect(figures()).toMatchInlineSnapshot();
  });
});
```

  Kiểu của `item.amount`/`item.basis`/`tour.maxGroupSize` trong fixture: mở
  `apps/api/prisma/fixtures/catalog/*.ts` để xem; bỏ `String(…)`/`?? 20` nếu
  typecheck báo thừa. Chạy
  `pnpm --filter @tourism/api exec vitest run src/modules/catalog/tour-costs-fixture.spec.ts`
  (Git Bash, KHÔNG đặt biến `CI` — vitest chỉ ghi inline snapshot khi không ở
  CI). Kỳ vọng: ba `it` xanh, và `toMatchInlineSnapshot()` được vitest điền
  sẵn một mảng chuỗi — mỗi tour một dòng. Đọc lại snapshot: số dòng bằng
  `catalog.tours.length`.

- [ ] **Bước 4: Đổi ba call site.**
  - `bookings.service.ts`: bỏ `import { perPersonTotal } from '../catalog/tour-costs.js';`,
    thêm `perPersonTotal` vào import `@tourism/contract` sẵn có (hoặc một dòng
    import mới) và `import { costItemsOf } from '../catalog/tour-cost-items.js';`.
    Dòng 381:

    ```ts
    const costPerPerson = costItems.length > 0 ? perPersonTotal(costItemsOf(costItems)) : null;
    ```

    `costPerPerson` thành `string | null` và đi thẳng vào `data` của lệnh tạo
    booking (dòng 417) — Prisma nhận chuỗi cho cột `Decimal`. Không sửa gì khác
    trong file.
  - `admin-departures.service.ts`: đổi import tương tự; dòng 211:

    ```ts
    fixedCostAmount:
      tour.costItems.length > 0 ? perDepartureTotal(costItemsOf(tour.costItems)) : null,
    ```

  - `seed.ts`: import ba hàm từ `@tourism/contract`. Fixture giữ tiền dạng
    chuỗi nên bỏ `new Prisma.Decimal(...)` ở hai chỗ `.map(...)` (dòng ~504 và
    ~812): `.map((item) => ({ amount: String(item.amount), basis: item.basis }))`.
    `giaVonTheoTour` thành `Map<string, string | null>`. Sửa hai câu comment
    đang nói "`perPersonTotal` nhận `Prisma.Decimal`" cho đúng (hàm giờ nhận
    chuỗi, cùng bản mà `bookings.service.ts` gọi).

- [ ] **Bước 5: Xoá bản cũ.** `git rm apps/api/src/modules/catalog/tour-costs.ts apps/api/src/modules/catalog/tour-costs.spec.ts`
  (bộ ca của spec cũ đã chép sang contract ở Task 1). Trong
  `tour-costs-fixture.spec.ts`: xoá import `legacy`, xoá `it` "bản contract ra
  ĐÚNG…" và câu comment "Hai `it` đầu là cầu nối…" (sửa thành: "Snapshot được
  ghi ở F17 SAU khi đối chiếu từng tour với bản `Prisma.Decimal` cũ — ba con số
  không được đổi mà không có lý do"). Kiểm: `grep -rn "tour-costs\.js" apps/api`
  → rỗng.

- [ ] **Bước 6: Chạy test của đường tiền.** Build api rồi chạy unit api và các
  int spec chạm hai cột snapshot:

```bash
pnpm --filter @tourism/api exec vitest run
grep -rln "costPerPerson\|fixedCostAmount" apps/api/src --include=*.int.spec.ts
pnpm --filter @tourism/api test:int -- <từng file grep ra ở trên>
```

  Kỳ vọng: xanh hết, không sửa test nào. Test nào đỏ vì kiểu (`Decimal` so với
  chuỗi) thì DỪNG — đó là dấu hiệu logic xung quanh bị đổi, không được vá bằng
  cách sửa test.

- [ ] **Bước 7: Gate + commit.**

```bash
git add apps/api/src/modules/catalog/tour-cost-items.ts apps/api/src/modules/catalog/tour-cost-items.spec.ts apps/api/src/modules/catalog/tour-costs-fixture.spec.ts apps/api/src/modules/bookings/bookings.service.ts apps/api/src/modules/catalog/admin-departures.service.ts apps/api/prisma/seed.ts
git status --short   # hai file xoá đã được `git rm` stage ở Bước 5 — phải thấy "D "
git commit -m "refactor(api): gọi hàm giá vốn của contract ở booking, chuyến và seed; bỏ bản Prisma.Decimal"
```

---

## Task 3 — `tourReadiness` (contract, hàm thuần)

**Files:**

- Create: `libs/shared/contract/src/schemas/tour-readiness.ts` + `tour-readiness.spec.ts`
- Modify: `libs/shared/contract/src/index.ts` (export, sau `tour-costs.js`)

**Interfaces:**

- Produces (Task 4, 5, 6, 7, 9, 10 dùng):
  - `interface TourReadinessInput { summary: string | null; destinations: readonly { isPrimary: boolean }[]; durationDays: number; itineraryDays: readonly number[] }`
  - `interface TourReadiness { summary: boolean; primaryDestination: boolean; missingDays: number[]; ready: boolean }`
  - `tourReadiness(input: TourReadinessInput): TourReadiness`
  - `TourReadinessSchema` (Zod, cùng hình dạng — cho `AdminTourDetailSchema`)

- [ ] **Bước 1: Test đỏ** — `tour-readiness.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { type TourReadinessInput, tourReadiness } from './tour-readiness.js';

/** Một tour 3 ngày đủ để bán — mỗi ca đổi ĐÚNG một thứ so với nó. */
const READY: TourReadinessInput = {
  summary: 'Three days on the bay.',
  destinations: [{ isPrimary: true }, { isPrimary: false }],
  durationDays: 3,
  itineraryDays: [1, 2, 3],
};

describe('tourReadiness (ADR-0047 §4)', () => {
  it('đủ cả ba thì ready, không thiếu ngày nào', () => {
    expect(tourReadiness(READY)).toEqual({
      summary: true,
      primaryDestination: true,
      missingDays: [],
      ready: true,
    });
  });

  it('tóm tắt null hoặc chỉ có khoảng trắng là thiếu', () => {
    for (const summary of [null, '', '   ']) {
      const result = tourReadiness({ ...READY, summary });
      expect(result.summary).toBe(false);
      expect(result.ready).toBe(false);
    }
  });

  it('không có điểm chính, hay có HAI điểm chính, đều là thiếu', () => {
    const none = tourReadiness({ ...READY, destinations: [{ isPrimary: false }] });
    const two = tourReadiness({ ...READY, destinations: [{ isPrimary: true }, { isPrimary: true }] });

    expect(none.primaryDestination).toBe(false);
    expect(none.ready).toBe(false);
    expect(two.primaryDestination).toBe(false);
    expect(two.ready).toBe(false);
  });

  it('ngày thiếu liệt kê tăng dần, kể cả khi ngày có sẵn đến lộn xộn', () => {
    const result = tourReadiness({ ...READY, durationDays: 5, itineraryDays: [4, 1, 2] });

    expect(result.missingDays).toEqual([3, 5]);
    expect(result.ready).toBe(false);
  });

  it('tour 1 ngày: thiếu ngày 1 rồi đủ', () => {
    expect(tourReadiness({ ...READY, durationDays: 1, itineraryDays: [] }).missingDays).toEqual([1]);
    expect(tourReadiness({ ...READY, durationDays: 1, itineraryDays: [1] }).ready).toBe(true);
  });

  it('ngày vượt số ngày không bù cho ngày thiếu', () => {
    // Ngày 4 của một tour 3 ngày không lấp được ngày 2 đang trống.
    const result = tourReadiness({ ...READY, itineraryDays: [1, 3, 4] });

    expect(result.missingDays).toEqual([2]);
  });
});
```

- [ ] **Bước 2: Chạy, thấy đỏ** —
  `pnpm --filter @tourism/contract exec vitest run src/schemas/tour-readiness.spec.ts`.

- [ ] **Bước 3: Cài** — `tour-readiness.ts`:

```ts
import { z } from 'zod';

/**
 * "Tour này đã đủ để bán chưa" (ADR-0047 §4) — THUẦN, dùng ở ba nơi: API chặn
 * `setPublished(true)` và chặn lệnh sửa làm một tour ĐANG BÁN trở nên thiếu;
 * admin in khung readiness và báo trước khi lưu. Một luật, một bản.
 *
 * Ba điều kiện, cả 29 tour hiện có đều đạt (đo 24/09): có tóm tắt, đúng một
 * điểm đến chính, lịch trình đủ mọi ngày 1..N. F18 thêm ảnh bìa.
 */
export interface TourReadinessInput {
  summary: string | null;
  destinations: readonly { isPrimary: boolean }[];
  durationDays: number;
  /** `dayNumber` của các ngày ĐÃ có hàng — hàng lịch trình luôn có tiêu đề. */
  itineraryDays: readonly number[];
}

export const TourReadinessSchema = z.object({
  summary: z.boolean(),
  primaryDestination: z.boolean(),
  /** Ngày 1..N chưa có lịch trình, tăng dần. */
  missingDays: z.array(z.int().positive()),
  ready: z.boolean(),
});
export type TourReadiness = z.output<typeof TourReadinessSchema>;

export function tourReadiness(input: TourReadinessInput): TourReadiness {
  const summary = (input.summary ?? '').trim() !== '';
  const primaryDestination = input.destinations.filter((link) => link.isPrimary).length === 1;
  const present = new Set(input.itineraryDays);
  const missingDays: number[] = [];
  for (let day = 1; day <= input.durationDays; day += 1) {
    if (!present.has(day)) missingDays.push(day);
  }
  return {
    summary,
    primaryDestination,
    missingDays,
    ready: summary && primaryDestination && missingDays.length === 0,
  };
}
```

- [ ] **Bước 4: Xanh.** Thêm export vào `index.ts`.

- [ ] **Bước 5: Đột biến:** `=== 1` → `>= 1` (ca hai điểm chính đỏ); bỏ
  `.trim()` (ca `'   '` đỏ); `day <= input.durationDays` → `<` (ca tour 1 ngày
  đỏ); `ready` bỏ vế `missingDays.length === 0` (ca ngày thiếu đỏ).

- [ ] **Bước 6: Gate + commit.**

```bash
git add libs/shared/contract/src/schemas/tour-readiness.ts libs/shared/contract/src/schemas/tour-readiness.spec.ts libs/shared/contract/src/index.ts
git commit -m "feat(contract): hàm tourReadiness — ba điều kiện để một tour được bán"
```

---

## Task 4 — Contract `admin.tours`: bảy thao tác mới và cổng của `setPublished`

**Files:**

- Create: `libs/shared/contract/src/schemas/admin-tours.ts` + `admin-tours.spec.ts`
- Modify: `libs/shared/contract/src/index.ts` (export, sau `admin-destinations.js`)
- Modify: `libs/shared/contract/src/contract.ts` (khối `admin.tours`, dòng ~1027–1073, cả JSDoc)
- Modify: `libs/shared/contract/src/schemas/admin-catalog.spec.ts` (ca dòng 159–167)
- Modify: `libs/shared/contract/src/schemas/catalog.ts` (ba type: `TourDifficulty`, `TravellerType`, `TourBadge`)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (`admin.tours.publish.errors`)
- Create: `apps/api/src/modules/catalog/tour-editor-fixture.spec.ts`

**Interfaces:**

- Consumes: Task 1 (`TourCostCategorySchema`, `TourCostBasisSchema`), Task 3
  (`TourReadinessSchema`); có sẵn: `slugSchema`, `descriptionSchema`,
  `DecimalStringSchema`, `DeparturePriceSchema`, `TourDifficultySchema`,
  `TravellerTypeSchema`, `TourBadgeSchema`, `PolicyKindSchema`.
- Produces (mọi task sau dùng — tên chính xác):
  - Hằng: `TOUR_SLUG_MAX = 120` · `TOUR_TITLE_MAX = 200` · `TOUR_SUMMARY_MAX = 500`
    · `TOUR_FACT_NOTE_MAX = 280` · `TOUR_MEETING_POINT_MAX = 300` ·
    `TOUR_LIST_ITEMS_MAX = 15` · `TOUR_LIST_ITEM_MAX = 200` ·
    `TOUR_DAY_TITLE_MAX = 200` · `TOUR_DAY_DESCRIPTION_MAX = 2000` ·
    `TOUR_FAQS_MAX = 20` · `TOUR_FAQ_QUESTION_MAX = 300` · `TOUR_FAQ_ANSWER_MAX = 2000`
    · `TOUR_POLICIES_MAX = 10` · `TOUR_POLICY_TITLE_MAX = 200` ·
    `TOUR_POLICY_BODY_MAX = 4000` · `TOUR_COST_ITEMS_MAX = 30` ·
    `TOUR_COST_LABEL_MAX = 120` · `TOUR_DURATION_MAX = 30` · `TOUR_GROUP_MAX = 100`
    · `TOUR_DESTINATIONS_MAX = 10` · `TOUR_CURRENCY = 'USD'`
  - Schema + type (`z.output`): `TourSlugSchema`, `TourBasePriceSchema`,
    `TourEditorPolicyKindSchema`, `AdminTourDetailSchema`/`AdminTourDetail`,
    `AdminTourGetInputSchema`/`AdminTourGetInput`,
    `AdminTourCreateInputSchema`/`AdminTourCreateInput`,
    `AdminTourCreateResultSchema`/`AdminTourCreateResult`,
    `AdminTourDetailsInputSchema`/`AdminTourDetailsInput`,
    `AdminTourItineraryInputSchema`/`AdminTourItineraryInput`,
    `AdminTourFaqsPoliciesInputSchema`/`AdminTourFaqsPoliciesInput`,
    `AdminTourCostsInputSchema`/`AdminTourCostsInput`,
    `AdminTourDeleteInputSchema`/`AdminTourDeleteInput`,
    `AdminTourDeleteResultSchema`/`AdminTourDeleteResult`.
  - Ở `catalog.ts`, ngay dưới schema tương ứng: `export type TourDifficulty = z.output<typeof TourDifficultySchema>;`,
    `TravellerType`, `TourBadge` cùng khuôn — admin cần chúng cho kiểu giá trị form (Task 9).
  - Procedure: `contract.admin.tours.{get, create, updateDetails, setItinerary, setFaqsPolicies, setCosts, delete}`.

- [ ] **Bước 1: Test đỏ cho schema** — `admin-tours.spec.ts`. Mỗi trần có đúng
  hai ca: N (qua) và N+1 (bị bắt) — bài học 7. Dùng bảng ca cho gọn:

```ts
import { describe, expect, it } from 'vitest';
import { contract } from '../contract.js';
import {
  AdminTourCostsInputSchema,
  AdminTourCreateInputSchema,
  AdminTourDetailSchema,
  AdminTourDetailsInputSchema,
  AdminTourFaqsPoliciesInputSchema,
  AdminTourItineraryInputSchema,
} from './admin-tours.js';

const ID = '11111111-1111-4111-8111-111111111111';
const CATEGORY = '22222222-2222-4222-8222-222222222222';
const DEST_A = '33333333-3333-4333-8333-333333333333';
const DEST_B = '44444444-4444-4444-8444-444444444444';
const VERSION = '2026-09-24T10:11:12.345Z';
const text = (length: number) => 'x'.repeat(length);

const CREATE = {
  title: 'Ha Long Bay Cruise',
  slug: 'ha-long-bay-cruise',
  categoryId: CATEGORY,
  primaryDestinationId: DEST_A,
  durationDays: 3,
  maxGroupSize: 12,
  basePrice: '199.00',
};

const DETAILS = {
  id: ID,
  version: VERSION,
  title: 'Ha Long Bay Cruise',
  summary: 'Three days on the bay.',
  categoryId: CATEGORY,
  difficulty: null,
  isFeatured: false,
  durationDays: 3,
  maxGroupSize: 12,
  basePrice: '199.00',
  destinations: [
    { destinationId: DEST_A, isPrimary: true },
    { destinationId: DEST_B, isPrimary: false },
  ],
  suitableFor: [],
  badges: [],
  highlights: [],
  included: [],
  excluded: [],
  meetingPoint: null,
  factDurationNote: null,
  factGroupSizeNote: null,
  factDifficultyNote: null,
  factGoodForNote: null,
};

/** [tên ca, input, có qua không] — mỗi trần một cặp N / N+1. */
const detailsCases: Array<[string, Record<string, unknown>, boolean]> = [
  ['tên 200', { title: text(200) }, true],
  ['tên 201', { title: text(201) }, false],
  ['tên toàn khoảng trắng', { title: '   ' }, false],
  ['tóm tắt 500', { summary: text(500) }, true],
  ['tóm tắt 501', { summary: text(501) }, false],
  ['ghi chú dữ kiện 280', { factGoodForNote: text(280) }, true],
  ['ghi chú dữ kiện 281', { factGoodForNote: text(281) }, false],
  ['điểm hẹn 300', { meetingPoint: text(300) }, true],
  ['điểm hẹn 301', { meetingPoint: text(301) }, false],
  ['số ngày 30', { durationDays: 30 }, true],
  ['số ngày 31', { durationDays: 31 }, false],
  ['số ngày 0', { durationDays: 0 }, false],
  ['số khách 100', { maxGroupSize: 100 }, true],
  ['số khách 101', { maxGroupSize: 101 }, false],
  ['số khách 0', { maxGroupSize: 0 }, false],
  ['giá 0.01', { basePrice: '0.01' }, true],
  ['giá 0.00', { basePrice: '0.00' }, false],
  ['giá 3 chữ số lẻ', { basePrice: '1.234' }, false],
  ['điểm nổi bật 15 dòng', { highlights: Array.from({ length: 15 }, () => 'a') }, true],
  ['điểm nổi bật 16 dòng', { highlights: Array.from({ length: 16 }, () => 'a') }, false],
  ['một dòng 200', { included: [text(200)] }, true],
  ['một dòng 201', { included: [text(201)] }, false],
  ['một dòng trắng', { excluded: ['   '] }, false],
  ['khách trùng', { suitableFor: ['FAMILY', 'FAMILY'] }, false],
  ['huy hiệu trùng', { badges: ['NEW', 'NEW'] }, false],
  [
    '10 điểm đến',
    {
      destinations: Array.from({ length: 10 }, (_, i) => ({
        destinationId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        isPrimary: i === 0,
      })),
    },
    true,
  ],
  [
    '11 điểm đến',
    {
      destinations: Array.from({ length: 11 }, (_, i) => ({
        destinationId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        isPrimary: i === 0,
      })),
    },
    false,
  ],
  ['không điểm đến nào', { destinations: [] }, false],
  ['không điểm chính', { destinations: [{ destinationId: DEST_A, isPrimary: false }] }, false],
  [
    'hai điểm chính',
    {
      destinations: [
        { destinationId: DEST_A, isPrimary: true },
        { destinationId: DEST_B, isPrimary: true },
      ],
    },
    false,
  ],
  [
    'điểm đến trùng',
    {
      destinations: [
        { destinationId: DEST_A, isPrimary: true },
        { destinationId: DEST_A, isPrimary: false },
      ],
    },
    false,
  ],
];

describe('AdminTourDetailsInputSchema', () => {
  it.each(detailsCases)('%s', (_name, patch, ok) => {
    expect(AdminTourDetailsInputSchema.safeParse({ ...DETAILS, ...patch }).success).toBe(ok);
  });

  it('không nhận slug — khoá sau khi tạo (ADR-0047 §7)', () => {
    const parsed = AdminTourDetailsInputSchema.parse({ ...DETAILS, slug: 'another-slug' });
    expect(parsed).not.toHaveProperty('slug');
  });

  it('ô chữ tuỳ chọn để trống thành null, chữ được cắt khoảng trắng', () => {
    const parsed = AdminTourDetailsInputSchema.parse({
      ...DETAILS,
      title: '  Ha Long  ',
      summary: '   ',
      meetingPoint: '',
    });
    expect(parsed.title).toBe('Ha Long');
    expect(parsed.summary).toBeNull();
    expect(parsed.meetingPoint).toBeNull();
  });

  it('version giữ nguyên mili-giây qua một lượt parse', () => {
    expect(AdminTourDetailsInputSchema.parse(DETAILS).version).toBe(VERSION);
  });
});
```

  Viết tiếp trong cùng file, cùng khuôn bảng ca `[tên, patch, có qua không]`:
  - `AdminTourCreateInputSchema` (gốc `CREATE`): slug 120 ký tự qua / 121 bị
    bắt; `'Ha Long'`, `'-ha-long'`, `'ha--long'` bị bắt; giá `'0.01'` qua,
    `'0'` và `'0.00'` bị bắt; số ngày 1 và 30 qua, 0 và 31 bị bắt; số khách 1 và
    100 qua, 0 và 101 bị bắt; thiếu `primaryDestinationId` bị bắt.
  - `AdminTourItineraryInputSchema` (gốc `{ id: ID, version: VERSION, days: [{ dayNumber: 1, title: 'Arrive', description: null }] }`):
    `dayNumber` 0 và 31 bị bắt, 30 qua; hai ngày cùng `dayNumber` bị bắt; tiêu đề
    200 qua / 201 và `'  '` bị bắt; mô tả 2000 qua / 2001 bị bắt; mô tả `''`
    parse ra `null`; `days: []` qua (lưu dở được — spec §2b.3).
  - `AdminTourFaqsPoliciesInputSchema`: 20 FAQ qua / 21 bị bắt; câu hỏi 300/301;
    trả lời 2000/2001; 10 chính sách qua / 11 bị bắt; `kind: 'CANCELLATION'` bị
    bắt (chính sách huỷ tính từ độ dài chuyến — ADR-0041); tiêu đề 200/201; nội
    dung 4000/4001; hai danh sách rỗng qua.
  - `AdminTourCostsInputSchema`: 30 dòng qua / 31 bị bắt; nhãn 120/121; số tiền
    `'0'` và `'0.00'` qua (chi phí 0 là có thật), `'-1'` và `'1.234'` bị bắt;
    `category: 'FOOD'` bị bắt.
  - `AdminTourDetailSchema`: một object đủ field (lấy `DETAILS` bỏ `version`
    input, cộng `slug`, `version`, `isPublished`, `currency`, `costPrice: null`,
    `ratingAvg: '4.5'`, `ratingCount`, `itinerary`, `faqs`, `policies`,
    `costItems`, `departureCount`, `liveSeatsMax: null`, `bookingCount`,
    `readiness`) parse qua; `liveSeatsMax: 12` cũng qua.
  - Route và mã lỗi — so tập mã đã sắp:

```ts
describe('contract.admin.tours (F17)', () => {
  const codes = (procedure: { '~orpc': { errorMap?: object } }) =>
    Object.keys(procedure['~orpc'].errorMap ?? {}).sort();
  const t = contract.admin.tours;

  it('route của bảy thao tác mới', () => {
    expect(t.create['~orpc'].route).toMatchObject({ method: 'POST', path: '/api/admin/tours' });
    expect(t.get['~orpc'].route).toMatchObject({ method: 'GET', path: '/api/admin/tours/{slug}' });
    expect(t.updateDetails['~orpc'].route).toMatchObject({ method: 'POST', path: '/api/admin/tours/{id}/details' });
    expect(t.setItinerary['~orpc'].route).toMatchObject({ method: 'POST', path: '/api/admin/tours/{id}/itinerary' });
    expect(t.setFaqsPolicies['~orpc'].route).toMatchObject({ method: 'POST', path: '/api/admin/tours/{id}/faqs-policies' });
    expect(t.setCosts['~orpc'].route).toMatchObject({ method: 'POST', path: '/api/admin/tours/{id}/costs' });
    expect(t.delete['~orpc'].route).toMatchObject({ method: 'POST', path: '/api/admin/tours/{id}/delete' });
  });

  it('mỗi thao tác khai ĐÚNG tập mã của spec §3', () => {
    expect(codes(t.get)).toEqual(['NOT_FOUND']);
    expect(codes(t.create)).toEqual(['NOT_FOUND', 'SLUG_TAKEN']);
    expect(codes(t.updateDetails)).toEqual([
      'DURATION_LOCKED',
      'GROUP_SIZE_BELOW_SEATS',
      'NOT_FOUND',
      'STALE_TOUR',
      'TOUR_NOT_READY',
    ]);
    expect(codes(t.setItinerary)).toEqual(['NOT_FOUND', 'STALE_TOUR', 'TOUR_NOT_READY']);
    expect(codes(t.setFaqsPolicies)).toEqual(['NOT_FOUND', 'STALE_TOUR']);
    expect(codes(t.setCosts)).toEqual(['NOT_FOUND', 'STALE_TOUR']);
    expect(codes(t.delete)).toEqual(['NOT_FOUND', 'TOUR_HAS_BOOKINGS']);
  });

  it('mọi mã "thế giới đã đổi" là 409', () => {
    const map = t.updateDetails['~orpc'].errorMap as Record<string, { status: number }>;
    for (const code of ['STALE_TOUR', 'DURATION_LOCKED', 'GROUP_SIZE_BELOW_SEATS', 'TOUR_NOT_READY']) {
      expect(map[code]?.status).toBe(409);
    }
    expect((t.delete['~orpc'].errorMap as Record<string, { status: number }>).TOUR_HAS_BOOKINGS?.status).toBe(409);
    expect((t.create['~orpc'].errorMap as Record<string, { status: number }>).SLUG_TAKEN?.status).toBe(409);
  });
});
```

  Sửa ca cũ ở `admin-catalog.spec.ts` dòng 159–167: đổi tên thành
  "setPublished khai NOT_FOUND và TOUR_NOT_READY, KHÔNG khai mã nào chặn vì có
  booking", kỳ vọng `Object.keys(errorMap).sort()` bằng
  `['NOT_FOUND', 'TOUR_NOT_READY']` và `errorMap.TOUR_NOT_READY?.status` bằng 409.

- [ ] **Bước 2: Chạy, thấy đỏ** — `pnpm --filter @tourism/contract exec vitest run src/schemas/admin-tours.spec.ts src/schemas/admin-catalog.spec.ts`.

- [ ] **Bước 3: Cài schema** — `admin-tours.ts`:

```ts
import { z } from 'zod';
import { DeparturePriceSchema } from './admin-departures.js';
import {
  DecimalStringSchema,
  PolicyKindSchema,
  TourBadgeSchema,
  TourDifficultySchema,
  TravellerTypeSchema,
} from './catalog.js';
import { descriptionSchema } from './common.js';
import { slugSchema } from './slug.js';
import { TourCostBasisSchema, TourCostCategorySchema } from './tour-costs.js';
import { TourReadinessSchema } from './tour-readiness.js';

/**
 * Khu làm việc của MỘT tour phía admin (spec F17, ADR-0047) — bảy thao tác:
 * tạo, đọc, bốn lệnh sửa theo tab, xoá.
 *
 * Ba quyết định hiện ra ngay trong hình dạng schema dưới đây:
 *
 * - **Mỗi tab một input, khối danh sách gửi NGUYÊN cả danh sách đã sắp**
 *   (§2). Không có thao tác cho từng hàng, nên không có đua ghi thứ tự.
 * - **Mọi input sửa mang `version`** = `updatedAt` của tour dạng ISO có
 *   mili-giây (§3). Server so trong CÙNG câu `UPDATE`; lệch là `STALE_TOUR`.
 * - **`updateDetails` không mang `slug`** (§7) — slug là đường dẫn
 *   `/tours/<slug>` và là thẻ cache `tour:<slug>`. Zod bỏ field lạ, nên client
 *   gửi thừa thì slug cũng không đổi.
 *
 * Trần của từng field gương cột DB (spec §3). Export để admin đếm ký tự và
 * validate bằng CHÍNH các con số này.
 */
export const TOUR_SLUG_MAX = 120;
export const TOUR_TITLE_MAX = 200;
export const TOUR_SUMMARY_MAX = 500;
export const TOUR_FACT_NOTE_MAX = 280;
export const TOUR_MEETING_POINT_MAX = 300;
/** Điểm nổi bật, bao gồm, không bao gồm — mỗi danh sách. */
export const TOUR_LIST_ITEMS_MAX = 15;
export const TOUR_LIST_ITEM_MAX = 200;
export const TOUR_DAY_TITLE_MAX = 200;
export const TOUR_DAY_DESCRIPTION_MAX = 2000;
export const TOUR_FAQS_MAX = 20;
export const TOUR_FAQ_QUESTION_MAX = 300;
export const TOUR_FAQ_ANSWER_MAX = 2000;
export const TOUR_POLICIES_MAX = 10;
export const TOUR_POLICY_TITLE_MAX = 200;
export const TOUR_POLICY_BODY_MAX = 4000;
export const TOUR_COST_ITEMS_MAX = 30;
export const TOUR_COST_LABEL_MAX = 120;
export const TOUR_DURATION_MAX = 30;
export const TOUR_GROUP_MAX = 100;
export const TOUR_DESTINATIONS_MAX = 10;
/** Cả 29 tour là USD; F17 không có ô tiền tệ (spec §1). */
export const TOUR_CURRENCY = 'USD';

export const TourSlugSchema = slugSchema(TOUR_SLUG_MAX);

/** Giá gốc: khuôn giá chuyến (≤ 2 chữ số lẻ, dưới trần cột) và LỚN HƠN 0. */
export const TourBasePriceSchema = DeparturePriceSchema.refine((value) => Number(value) > 0, {
  message: 'base price must be above zero',
});

/** Chính sách viết tay chỉ còn hai loại — chính sách huỷ tính từ độ dài chuyến (ADR-0041). */
export const TourEditorPolicyKindSchema = z.enum(['BOOKING', 'GENERAL']);

const VersionSchema = z.iso.datetime();
const TitleSchema = z.string().trim().min(1).max(TOUR_TITLE_MAX);
const DurationDaysSchema = z.int().min(1).max(TOUR_DURATION_MAX);
const MaxGroupSizeSchema = z.int().min(1).max(TOUR_GROUP_MAX);
const ListSchema = z
  .array(z.string().trim().min(1).max(TOUR_LIST_ITEM_MAX))
  .max(TOUR_LIST_ITEMS_MAX);

/** Mảng enum không được lặp — ô tích ở admin không bao giờ gửi trùng, API cũng không nhận. */
function uniqueArray<T extends z.ZodType<string>>(item: T) {
  return z
    .array(item)
    .refine((values) => new Set(values).size === values.length, {
      message: 'values must not repeat',
    });
}

const DestinationsSchema = z
  .array(z.object({ destinationId: z.uuid(), isPrimary: z.boolean() }))
  .min(1)
  .max(TOUR_DESTINATIONS_MAX)
  .refine((links) => links.filter((link) => link.isPrimary).length === 1, {
    message: 'exactly one destination must be primary',
  })
  .refine((links) => new Set(links.map((link) => link.destinationId)).size === links.length, {
    message: 'a destination can only be listed once',
  });

// ── Đọc ─────────────────────────────────────────────────────────────────────

/**
 * Một tour như khu làm việc cần. Schema HÀNG cố ý LỎNG hơn input (cùng lý lẽ
 * `AdminDestinationRowSchema`): nó mô tả thứ DB đang giữ, không phải luật ghi —
 * một tour seed vượt một trần mới không được làm cả khu làm việc sập 500 đúng
 * lúc admin cần mở nó ra để sửa.
 */
export const AdminTourDetailSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(TOUR_SLUG_MAX),
  /** `updatedAt` dạng ISO có mili-giây — gửi lại nguyên văn ở mọi lệnh sửa. */
  version: VersionSchema,
  title: z.string(),
  summary: z.string().nullable(),
  categoryId: z.uuid(),
  difficulty: TourDifficultySchema.nullable(),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  durationDays: z.int(),
  maxGroupSize: z.int(),
  basePrice: DecimalStringSchema,
  currency: z.string(),
  /** Suy ra từ dòng chi phí (ADR-0033); `null` = tour chưa khai giá vốn. */
  costPrice: DecimalStringSchema.nullable(),
  ratingAvg: DecimalStringSchema.nullable(),
  ratingCount: z.int().nonnegative(),
  suitableFor: z.array(TravellerTypeSchema),
  badges: z.array(TourBadgeSchema),
  highlights: z.array(z.string()),
  included: z.array(z.string()),
  excluded: z.array(z.string()),
  meetingPoint: z.string().nullable(),
  factDurationNote: z.string().nullable(),
  factGroupSizeNote: z.string().nullable(),
  factDifficultyNote: z.string().nullable(),
  factGoodForNote: z.string().nullable(),
  /** Điểm chính đứng đầu. */
  destinations: z.array(z.object({ destinationId: z.uuid(), isPrimary: z.boolean() })),
  /** Theo `dayNumber` tăng dần. Ngày chưa có tiêu đề thì không có hàng. */
  itinerary: z.array(
    z.object({ dayNumber: z.int().positive(), title: z.string(), description: z.string().nullable() }),
  ),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  /** Đọc lỏng cả ba loại; ghi chỉ nhận hai (`TourEditorPolicyKindSchema`). */
  policies: z.array(z.object({ kind: PolicyKindSchema, title: z.string(), body: z.string() })),
  costItems: z.array(
    z.object({
      category: TourCostCategorySchema,
      label: z.string(),
      amount: DecimalStringSchema,
      basis: TourCostBasisSchema,
    }),
  ),
  /** Mọi chuyến, kể cả đã huỷ — số ngày khoá khi con số này lớn hơn 0. */
  departureCount: z.int().nonnegative(),
  /** Số ghế lớn nhất của chuyến chưa về và chưa huỷ; `null` khi không có. */
  liveSeatsMax: z.int().positive().nullable(),
  /** Mọi booking, mọi trạng thái — nút Delete chỉ hiện khi bằng 0. */
  bookingCount: z.int().nonnegative(),
  readiness: TourReadinessSchema,
});
export type AdminTourDetail = z.output<typeof AdminTourDetailSchema>;

/** Đọc theo slug vì khu làm việc sống ở `/tours/[slug]`. Lỏng như dữ liệu, không khắt như input tạo. */
export const AdminTourGetInputSchema = z.object({ slug: z.string().min(1).max(TOUR_SLUG_MAX) });
export type AdminTourGetInput = z.output<typeof AdminTourGetInputSchema>;

// ── Tạo, xoá ────────────────────────────────────────────────────────────────

/** Bảy ô của hộp New tour (spec §2a). Tour sinh ra đang TẮT bán. */
export const AdminTourCreateInputSchema = z.object({
  title: TitleSchema,
  slug: TourSlugSchema,
  categoryId: z.uuid(),
  primaryDestinationId: z.uuid(),
  durationDays: DurationDaysSchema,
  maxGroupSize: MaxGroupSizeSchema,
  basePrice: TourBasePriceSchema,
});
export type AdminTourCreateInput = z.output<typeof AdminTourCreateInputSchema>;

export const AdminTourCreateResultSchema = z.object({ id: z.uuid(), slug: z.string() });
export type AdminTourCreateResult = z.output<typeof AdminTourCreateResultSchema>;

export const AdminTourDeleteInputSchema = z.object({ id: z.uuid() });
export type AdminTourDeleteInput = z.output<typeof AdminTourDeleteInputSchema>;

export const AdminTourDeleteResultSchema = z.object({ slug: z.string() });
export type AdminTourDeleteResult = z.output<typeof AdminTourDeleteResultSchema>;

// ── Bốn lệnh sửa ────────────────────────────────────────────────────────────

/** Tab Details — mọi cột sửa được của hàng tour cộng danh sách điểm đến. */
export const AdminTourDetailsInputSchema = z.object({
  id: z.uuid(),
  version: VersionSchema,
  title: TitleSchema,
  summary: descriptionSchema(TOUR_SUMMARY_MAX),
  categoryId: z.uuid(),
  difficulty: TourDifficultySchema.nullable(),
  isFeatured: z.boolean(),
  durationDays: DurationDaysSchema,
  maxGroupSize: MaxGroupSizeSchema,
  basePrice: TourBasePriceSchema,
  destinations: DestinationsSchema,
  suitableFor: uniqueArray(TravellerTypeSchema),
  badges: uniqueArray(TourBadgeSchema),
  highlights: ListSchema,
  included: ListSchema,
  excluded: ListSchema,
  meetingPoint: descriptionSchema(TOUR_MEETING_POINT_MAX),
  factDurationNote: descriptionSchema(TOUR_FACT_NOTE_MAX),
  factGroupSizeNote: descriptionSchema(TOUR_FACT_NOTE_MAX),
  factDifficultyNote: descriptionSchema(TOUR_FACT_NOTE_MAX),
  factGoodForNote: descriptionSchema(TOUR_FACT_NOTE_MAX),
});
export type AdminTourDetailsInput = z.output<typeof AdminTourDetailsInputSchema>;

/**
 * Tab Itinerary — chỉ những ngày ĐÃ có tiêu đề (lưu dở được, spec §2b.3).
 * Trần `dayNumber` ≤ số ngày của tour là phán quyết của server, sau phép so
 * phiên bản: contract không biết N.
 */
export const AdminTourItineraryInputSchema = z.object({
  id: z.uuid(),
  version: VersionSchema,
  days: z
    .array(
      z.object({
        dayNumber: z.int().min(1).max(TOUR_DURATION_MAX),
        title: z.string().trim().min(1).max(TOUR_DAY_TITLE_MAX),
        description: descriptionSchema(TOUR_DAY_DESCRIPTION_MAX),
      }),
    )
    .max(TOUR_DURATION_MAX)
    .refine((days) => new Set(days.map((day) => day.dayNumber)).size === days.length, {
      message: 'each day can only appear once',
    }),
});
export type AdminTourItineraryInput = z.output<typeof AdminTourItineraryInputSchema>;

/** Tab FAQ & policies — hai danh sách thay nguyên, thứ tự là thứ tự gửi. */
export const AdminTourFaqsPoliciesInputSchema = z.object({
  id: z.uuid(),
  version: VersionSchema,
  faqs: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(TOUR_FAQ_QUESTION_MAX),
        answer: z.string().trim().min(1).max(TOUR_FAQ_ANSWER_MAX),
      }),
    )
    .max(TOUR_FAQS_MAX),
  policies: z
    .array(
      z.object({
        kind: TourEditorPolicyKindSchema,
        title: z.string().trim().min(1).max(TOUR_POLICY_TITLE_MAX),
        body: z.string().trim().min(1).max(TOUR_POLICY_BODY_MAX),
      }),
    )
    .max(TOUR_POLICIES_MAX),
});
export type AdminTourFaqsPoliciesInput = z.output<typeof AdminTourFaqsPoliciesInputSchema>;

/** Tab Costs — dòng chi phí thay nguyên; `costPrice` do server tính lại, không có ô nhập. */
export const AdminTourCostsInputSchema = z.object({
  id: z.uuid(),
  version: VersionSchema,
  items: z
    .array(
      z.object({
        category: TourCostCategorySchema,
        label: z.string().trim().min(1).max(TOUR_COST_LABEL_MAX),
        /** Chi phí 0 là có thật (vé miễn phí) — khuôn giá chuyến, cho phép 0. */
        amount: DeparturePriceSchema,
        basis: TourCostBasisSchema,
      }),
    )
    .max(TOUR_COST_ITEMS_MAX),
});
export type AdminTourCostsInput = z.output<typeof AdminTourCostsInputSchema>;
```

- [ ] **Bước 4: Cài procedure** — trong `contract.ts`, import các schema mới
  và thay khối `tours: { … }` bằng khối dưới đây. Viết lại đoạn JSDoc phía trên
  khối: bỏ câu "`setPublished` CỐ Ý không khai mã lỗi nào ngoài `NOT_FOUND`",
  thay bằng: "`setPublished` khai thêm `TOUR_NOT_READY` (ADR-0047 §4) — CHỈ ở
  chiều bật bán; gỡ bán vẫn không bao giờ bị chặn, kể cả khi tour có booking
  sống (lý do của F11 giữ nguyên)". Thêm một đoạn cho khu làm việc: "Bảy thao
  tác của khu làm việc (spec F17): mỗi tab một lệnh ghi, khối danh sách thay
  nguyên, một `version` cho cả tour (ADR-0047). Mọi lệnh ghi là `POST` như cả bề
  mặt admin — thêm verb mới là phải sửa danh sách `methods` của CORS."

```ts
    tours: {
      list: /* giữ nguyên */,
      get: oc
        .route({
          method: 'GET',
          path: '/api/admin/tours/{slug}',
          summary: 'One tour with everything the editor needs (admin, on or off sale)',
        })
        .input(AdminTourGetInputSchema)
        .errors({ NOT_FOUND: { status: 404, message: 'Tour not found' } })
        .output(AdminTourDetailSchema),
      create: oc
        .route({ method: 'POST', path: '/api/admin/tours', summary: 'Create a tour — it starts off sale' })
        .input(AdminTourCreateInputSchema)
        .errors({
          SLUG_TAKEN: { status: 409, message: 'Another tour already uses this slug' },
          NOT_FOUND: { status: 404, message: 'Category or destination not found' },
        })
        .output(AdminTourCreateResultSchema),
      updateDetails: oc
        .route({
          method: 'POST',
          path: '/api/admin/tours/{id}/details',
          summary: 'Save the Details tab of one tour',
        })
        .input(AdminTourDetailsInputSchema)
        .errors({
          STALE_TOUR: { status: 409, message: 'This tour changed since it was opened' },
          DURATION_LOCKED: {
            status: 409,
            message: 'The number of days is locked while the tour has departures',
          },
          GROUP_SIZE_BELOW_SEATS: {
            status: 409,
            message: 'The group size cannot go below the seats of a departure',
          },
          TOUR_NOT_READY: { status: 409, message: 'A tour on sale must stay ready to sell' },
          NOT_FOUND: { status: 404, message: 'Tour, category or destination not found' },
        })
        .output(AdminTourDetailSchema),
      setItinerary: oc
        .route({
          method: 'POST',
          path: '/api/admin/tours/{id}/itinerary',
          summary: 'Replace the itinerary of one tour',
        })
        .input(AdminTourItineraryInputSchema)
        .errors({
          STALE_TOUR: { status: 409, message: 'This tour changed since it was opened' },
          TOUR_NOT_READY: { status: 409, message: 'A tour on sale must stay ready to sell' },
          NOT_FOUND: { status: 404, message: 'Tour not found' },
        })
        .output(AdminTourDetailSchema),
      setFaqsPolicies: oc
        .route({
          method: 'POST',
          path: '/api/admin/tours/{id}/faqs-policies',
          summary: 'Replace the FAQ and the policies of one tour',
        })
        .input(AdminTourFaqsPoliciesInputSchema)
        .errors({
          STALE_TOUR: { status: 409, message: 'This tour changed since it was opened' },
          NOT_FOUND: { status: 404, message: 'Tour not found' },
        })
        .output(AdminTourDetailSchema),
      setCosts: oc
        .route({
          method: 'POST',
          path: '/api/admin/tours/{id}/costs',
          summary: 'Replace the cost lines of one tour and recompute its cost price',
        })
        .input(AdminTourCostsInputSchema)
        .errors({
          STALE_TOUR: { status: 409, message: 'This tour changed since it was opened' },
          NOT_FOUND: { status: 404, message: 'Tour not found' },
        })
        .output(AdminTourDetailSchema),
      delete: oc
        .route({
          method: 'POST',
          path: '/api/admin/tours/{id}/delete',
          summary: 'Delete a tour that has never been booked',
        })
        .input(AdminTourDeleteInputSchema)
        .errors({
          TOUR_HAS_BOOKINGS: { status: 409, message: 'A tour with bookings cannot be deleted' },
          NOT_FOUND: { status: 404, message: 'Tour not found' },
        })
        .output(AdminTourDeleteResultSchema),
      setPublished: oc
        .route({ /* giữ nguyên */ })
        .input(AdminTourSetPublishedInputSchema)
        .errors({
          NOT_FOUND: { status: 404, message: 'Tour not found' },
          TOUR_NOT_READY: { status: 409, message: 'This tour is not ready to sell yet' },
        })
        .output(AdminTourSetPublishedResultSchema),
    },
```

  Nhớ đổi summary cũ của `setPublished` nếu nó hứa "never blocked" chung chung:
  `'Put a tour on sale (only when it is ready) or take it off (never blocked)'`.

- [ ] **Bước 5: Xanh** — chạy lại hai spec ở Bước 2. Export `admin-tours.js`
  trong `index.ts`.

- [ ] **Bước 6: Giữ admin xanh.** `apps/admin/src/lib/tours-publish.spec.ts` đối
  chiếu tập mã của codec với `errorMap` thật, nên thêm ngay câu cho mã mới vào
  `messages.admin.tours.publish.errors` (i18n):

```ts
        /**
         * Tour còn thiếu thứ khách cần (ADR-0047 §4). Không phải trạng-thái-cũ:
         * mở tour ra, điền cho đủ, rồi bật lại. Toast ở bảng Tours kèm nút mở
         * thẳng tour (Task 10).
         */
        TOUR_NOT_READY: "This tour isn't ready to sell yet — open it to see what's missing.",
```

  Build lại contract và i18n (lệnh ở Ràng buộc toàn cục), chạy
  `pnpm --filter @tourism/admin exec vitest run src/lib/tours-publish.spec.ts` → xanh.

- [ ] **Bước 7: Đo fixture seed bằng test** — mọi tour seed phải lưu lại được
  qua bốn schema sửa, không thì admin mở một tour đang bán ra là không bấm Save
  được. `apps/api/src/modules/catalog/tour-editor-fixture.spec.ts`:

```ts
import {
  AdminTourCostsInputSchema,
  AdminTourDetailsInputSchema,
  AdminTourFaqsPoliciesInputSchema,
  AdminTourItineraryInputSchema,
} from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';

/**
 * Mọi tour seed qua được bốn schema sửa của F17 (spec §3) — tức admin mở bất kỳ
 * tour nào đang bán ra rồi bấm Save mà không đổi gì thì lệnh ghi đi qua. Một trần
 * đặt chặt hơn dữ liệu thật sẽ đỏ ở đây, không phải ở tay người dùng.
 */
const VERSION = new Date(0).toISOString();

/** Issues của một lần parse hỏng, in kèm slug để biết tour nào vượt trần nào. */
function failures(slug: string, result: { success: boolean; error?: { issues: unknown[] } }) {
  return result.success ? [] : [`${slug}: ${JSON.stringify(result.error?.issues)}`];
}

describe('fixture seed vừa khuôn khu làm việc F17', () => {
  it('bốn schema sửa đều nhận mọi tour seed', () => {
    const problems = catalog.tours.flatMap((tour) => {
      const byTour = <T extends { tourId: string }>(rows: readonly T[]) =>
        rows.filter((row) => row.tourId === tour.id);
      return [
        ...failures(
          tour.slug,
          AdminTourDetailsInputSchema.safeParse({
            id: tour.id,
            version: VERSION,
            title: tour.title,
            summary: tour.summary ?? null,
            categoryId: tour.categoryId,
            difficulty: tour.difficulty ?? null,
            isFeatured: tour.isFeatured ?? false,
            durationDays: tour.durationDays,
            maxGroupSize: tour.maxGroupSize ?? 20,
            basePrice: String(tour.basePrice),
            destinations: byTour(catalog.tourDestinations).map((link) => ({
              destinationId: link.destinationId,
              isPrimary: link.isPrimary ?? false,
            })),
            suitableFor: tour.suitableFor ?? [],
            badges: tour.badges ?? [],
            highlights: tour.highlights ?? [],
            included: tour.included ?? [],
            excluded: tour.excluded ?? [],
            meetingPoint: tour.meetingPoint ?? null,
            factDurationNote: tour.factDurationNote ?? null,
            factGroupSizeNote: tour.factGroupSizeNote ?? null,
            factDifficultyNote: tour.factDifficultyNote ?? null,
            factGoodForNote: tour.factGoodForNote ?? null,
          }),
        ),
        ...failures(
          tour.slug,
          AdminTourItineraryInputSchema.safeParse({
            id: tour.id,
            version: VERSION,
            days: byTour(catalog.tourItineraryDays).map((day) => ({
              dayNumber: day.dayNumber,
              title: day.title,
              description: day.description ?? null,
            })),
          }),
        ),
        ...failures(
          tour.slug,
          AdminTourFaqsPoliciesInputSchema.safeParse({
            id: tour.id,
            version: VERSION,
            faqs: byTour(catalog.tourFaqs).map((faq) => ({ question: faq.question, answer: faq.answer })),
            policies: byTour(catalog.tourPolicies).map((policy) => ({
              kind: policy.kind,
              title: policy.title,
              body: policy.body,
            })),
          }),
        ),
        ...failures(
          tour.slug,
          AdminTourCostsInputSchema.safeParse({
            id: tour.id,
            version: VERSION,
            items: byTour(catalog.tourCostItems).map((item) => ({
              category: item.category,
              label: item.label,
              amount: String(item.amount),
              basis: item.basis,
            })),
          }),
        ),
      ];
    });

    expect(problems).toEqual([]);
  });
});
```

  Bỏ các `?? …` mà typecheck báo thừa (tuỳ kiểu thật của fixture). Build
  contract rồi chạy
  `pnpm --filter @tourism/api exec vitest run src/modules/catalog/tour-editor-fixture.spec.ts`.
  **Đỏ ở đây là dữ liệu thật vượt trần của spec** — DỪNG và báo (kèm dòng
  `problems`), đừng tự nới trần hay sửa fixture.

- [ ] **Bước 8: Đột biến:** bỏ `.refine` "đúng một điểm chính" (ca hai điểm chính
  đỏ); `TOUR_LIST_ITEMS_MAX` 15 → 16 (ca 16 dòng đỏ); `TourBasePriceSchema` bỏ
  `.refine(> 0)` (ca `'0.00'` đỏ); bỏ `.trim()` ở `ListSchema` (ca dòng trắng đỏ);
  đổi `TourEditorPolicyKindSchema` thành `PolicyKindSchema` (ca `CANCELLATION` đỏ).

- [ ] **Bước 9: Gate + commit.**

```bash
git add libs/shared/contract/src/schemas/admin-tours.ts libs/shared/contract/src/schemas/admin-tours.spec.ts libs/shared/contract/src/schemas/admin-catalog.spec.ts libs/shared/contract/src/schemas/catalog.ts libs/shared/contract/src/contract.ts libs/shared/contract/src/index.ts libs/shared/i18n/src/lib/messages.ts apps/api/src/modules/catalog/tour-editor-fixture.spec.ts
git commit -m "feat(contract): bảy thao tác khu làm việc tour và mã TOUR_NOT_READY cho công tắc đăng"
```

---

## Task 5 — API: đọc, tạo và xoá tour

**Files:**

- Create: `apps/api/src/modules/catalog/admin-tour-errors.ts`
- Create: `apps/api/src/modules/catalog/tour-editor-rules.ts` + `tour-editor-rules.spec.ts`
- Create: `apps/api/src/modules/catalog/admin-tours.service.ts`
- Create: `apps/api/src/modules/catalog/admin-tours.int.spec.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.controller.ts`
- Modify: `apps/api/src/modules/catalog/catalog.module.ts` (provider `AdminToursService`)

**Interfaces:**

- Consumes: Task 3 (`tourReadiness`), Task 4 (schema + type + `TOUR_CURRENCY`);
  có sẵn: `departurePhase` (contract), `calendarDate(value: Date): string`
  (`apps/api/src/lib/calendar-date.ts`), `ContractError`, `toContractError`,
  `tourRevalidationTags(slug): string[]`, `WebRevalidationService.revalidate(tags)`.
- Produces (Task 6, 7 dùng):
  - `admin-tour-errors.ts`: `AdminTourNotFoundError(ref)` · `TourLinkNotFoundError()`
    · `TourSlugTakenError(slug)` · `StaleTourError()` ·
    `TourRuleError(code: 'DURATION_LOCKED' | 'GROUP_SIZE_BELOW_SEATS', message)`
    · `TourNotReadyError(readiness: TourReadiness)` · `TourHasBookingsError()` ·
    `ItineraryDayOutOfRangeError(message)` (lớp `Error` thường, KHÔNG phải `ContractError`).
  - `tour-editor-rules.ts`: `nextTourVersion(version: string, now: Date): Date` ·
    `liveSeatsMax(departures: readonly DepartureSeats[], now: Date): number | null`
    · `interface DepartureSeats { seatsTotal: number; startDate: Date; endDate: Date; status: 'OPEN' | 'CLOSED' | 'CANCELLED' }`.
  - `AdminToursService`: `get(slug)`, `create(input)`, `delete(input)`; private
    `bust(slug)`; hằng module `TOUR_DETAIL_SELECT`, hàm `toDetail(row, now)`,
    `prismaCode(error)`.

- [ ] **Bước 1: Test đỏ cho hai luật thuần** — `tour-editor-rules.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { liveSeatsMax, nextTourVersion } from './tour-editor-rules.js';

describe('nextTourVersion (plan F17, quyết định 3)', () => {
  const version = '2026-09-24T10:00:00.000Z';

  it('đồng hồ đã qua phiên bản cũ thì lấy đồng hồ', () => {
    const now = new Date('2026-09-24T10:00:05.000Z');
    expect(nextTourVersion(version, now).toISOString()).toBe('2026-09-24T10:00:05.000Z');
  });

  it('cùng mili-giây với phiên bản cũ thì cộng 1 ms — hai phiên bản không bao giờ trùng', () => {
    const now = new Date(version);
    expect(nextTourVersion(version, now).toISOString()).toBe('2026-09-24T10:00:00.001Z');
  });

  it('đồng hồ server lùi (NTP) vẫn cho phiên bản lớn hơn bản cũ', () => {
    const now = new Date('2026-09-24T09:59:59.000Z');
    expect(nextTourVersion(version, now).toISOString()).toBe('2026-09-24T10:00:00.001Z');
  });
});

describe('liveSeatsMax (spec §2e, ADR-0046)', () => {
  // 10:00 sáng 10/10 giờ Việt Nam.
  const now = new Date('2026-10-10T03:00:00.000Z');
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const departure = (
    seatsTotal: number,
    start: string,
    end: string,
    status: 'OPEN' | 'CLOSED' | 'CANCELLED' = 'OPEN',
  ) => ({ seatsTotal, startDate: d(start), endDate: d(end), status });

  it('không có chuyến nào thì null', () => {
    expect(liveSeatsMax([], now)).toBeNull();
  });

  it('chỉ có chuyến đã về hay đã huỷ thì null', () => {
    expect(
      liveSeatsMax(
        [departure(30, '2026-10-01', '2026-10-03'), departure(40, '2026-11-01', '2026-11-02', 'CANCELLED')],
        now,
      ),
    ).toBeNull();
  });

  it('lấy số ghế lớn nhất của chuyến chưa về và chưa huỷ — kể cả chuyến đang chạy và chuyến đã đóng', () => {
    const departures = [
      departure(30, '2026-10-01', '2026-10-03'), // đã về — bỏ
      departure(40, '2026-11-01', '2026-11-02', 'CANCELLED'), // đã huỷ — bỏ
      departure(25, '2026-10-09', '2026-10-11'), // đang chạy — tính
      departure(20, '2026-11-05', '2026-11-06', 'CLOSED'), // đã đóng — tính
      departure(12, '2026-12-01', '2026-12-02'), // đang bán — tính
    ];
    expect(liveSeatsMax(departures, now)).toBe(25);
  });
});
```

  Chạy `pnpm --filter @tourism/api exec vitest run src/modules/catalog/tour-editor-rules.spec.ts` → đỏ.

- [ ] **Bước 2: Cài** — `tour-editor-rules.ts`:

```ts
import { departurePhase } from '@tourism/contract';
import { calendarDate } from '../../lib/calendar-date.js';

/**
 * Hai luật THUẦN của khu làm việc tour (spec F17) — tách khỏi service để test
 * không cần DB.
 */

/**
 * Phiên bản kế tiếp của một tour: đồng hồ hiện tại, nhưng không bao giờ nhỏ hơn
 * hay bằng phiên bản cũ (plan F17, quyết định 3). Hai lần lưu rơi cùng một
 * mili-giây mà ra cùng phiên bản thì phép so-và-ghi mất tác dụng — người cầm
 * phiên bản cũ ghi đè được lên lần lưu thứ hai.
 */
export function nextTourVersion(version: string, now: Date): Date {
  return new Date(Math.max(now.getTime(), Date.parse(version) + 1));
}

export interface DepartureSeats {
  seatsTotal: number;
  startDate: Date;
  endDate: Date;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
}

/**
 * Sàn của số khách tối đa (spec §2b.2): số ghế lớn nhất của các chuyến có giai
 * đoạn khác `completed` và `cancelled`. Giai đoạn lấy từ `departurePhase`
 * (ADR-0046) — một chuyến đã về 30 ghế không được khoá oan một tour giờ chỉ chạy
 * đoàn 12 (spec §4.8).
 */
export function liveSeatsMax(departures: readonly DepartureSeats[], now: Date): number | null {
  let max: number | null = null;
  for (const departure of departures) {
    const phase = departurePhase({
      status: departure.status,
      startDate: calendarDate(departure.startDate),
      endDate: calendarDate(departure.endDate),
      now,
    });
    if (phase === 'completed' || phase === 'cancelled') continue;
    if (max === null || departure.seatsTotal > max) max = departure.seatsTotal;
  }
  return max;
}
```

  Chạy lại → xanh. Đột biến: bỏ `+ 1` (ca cùng mili-giây đỏ); bỏ vế
  `phase === 'completed'` (ra 30, đỏ); bỏ vế `'cancelled'` (ra 40, đỏ); thêm
  `phase === 'departed'` vào điều kiện bỏ (ra 20, đỏ).

- [ ] **Bước 3: Lỗi mang mã** — `admin-tour-errors.ts`:

```ts
import type { TourReadiness } from '@tourism/contract';
import { ContractError } from '../../lib/contract-error.js';

/**
 * Lỗi nghiệp vụ của khu làm việc tour (spec F17). Controller đổi chúng thành
 * lỗi contract bằng `toContractError` — chỉ mã mà procedure KHAI mới đi qua.
 *
 * Tên có tiền tố riêng: repo đã có năm lớp tên `TourNotFoundError` ở năm module
 * (bài học vòng hai F12), trong đó một lớp ngay ở `admin-catalog.service.ts`.
 */

export class AdminTourNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor(ref: string) {
    super('NOT_FOUND', `Tour not found: ${ref}`, false);
  }
}

/** Danh mục hay điểm đến không tồn tại — khoá ngoại `P2003` ở lệnh tạo hoặc sửa. */
export class TourLinkNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor() {
    super('NOT_FOUND', 'Category or destination not found', false);
  }
}

/** Slug đã có tour khác dùng. 409: input đúng, thế giới đã đổi. */
export class TourSlugTakenError extends ContractError<'SLUG_TAKEN'> {
  constructor(slug: string) {
    super('SLUG_TAKEN', `Another tour already uses the slug ${slug}`);
  }
}

/** Phiên bản trong form không còn khớp hàng tour (ADR-0047 §3). */
export class StaleTourError extends ContractError<'STALE_TOUR'> {
  constructor() {
    super('STALE_TOUR', 'This tour changed since it was opened.');
  }
}

/** Hai luật giữ dữ liệu khớp (ADR-0047 §6). */
export class TourRuleError extends ContractError<'DURATION_LOCKED' | 'GROUP_SIZE_BELOW_SEATS'> {}

/**
 * Tour thiếu thứ khách cần (ADR-0047 §4). Câu liệt kê đúng chỗ thiếu để API
 * đọc được một mình; admin tự dựng câu của nó từ `tourReadiness`.
 */
export class TourNotReadyError extends ContractError<'TOUR_NOT_READY'> {
  constructor(readonly readiness: TourReadiness) {
    super('TOUR_NOT_READY', `This tour is missing: ${missingParts(readiness).join(', ')}.`);
  }
}

function missingParts(readiness: TourReadiness): string[] {
  return [
    ...(readiness.summary ? [] : ['a summary']),
    ...(readiness.primaryDestination ? [] : ['one primary destination']),
    ...(readiness.missingDays.length > 0
      ? [`itinerary for day ${readiness.missingDays.join(', ')}`]
      : []),
  ];
}

/** Khoá ngoại `Restrict` của booking chặn lệnh xoá (ADR-0047 §5). */
export class TourHasBookingsError extends ContractError<'TOUR_HAS_BOOKINGS'> {
  constructor() {
    super('TOUR_HAS_BOOKINGS', 'This tour has bookings, so it cannot be deleted. Take it off sale instead.');
  }
}

/**
 * Ngày lịch trình vượt số ngày của tour SAU khi phiên bản đã khớp — client hỏng,
 * không phải thế giới đổi. Controller trả 400; KHÔNG phải `ContractError` vì
 * danh sách mã contract là cố định (plan F17, quyết định 6).
 */
export class ItineraryDayOutOfRangeError extends Error {}
```

- [ ] **Bước 4: Int test đỏ** — `admin-tours.int.spec.ts`. Phần dựng chép khuôn
  `admin-destinations.int.spec.ts` (sign-up hai người, admin qua `role`, cookie):

```ts
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminTourCreateResultSchema,
  AdminTourDeleteResultSchema,
  AdminTourDetailSchema,
  vietnamToday,
} from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, PaymentProvider } from '../../generated/prisma/enums.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';

/**
 * Integration (Docker PG, db `tourism_test`) — khu làm việc tour (spec F17,
 * ADR-0047). Bốn ca đắt nhất:
 *
 *  ① Hai lệnh sửa cùng một `version` bắn cùng lúc: ĐÚNG MỘT lệnh qua, lệnh kia
 *    `STALE_TOUR` — phép so nằm trong câu `UPDATE` chứ không ở một câu đọc riêng.
 *  ② Lưu tab con cũng đẩy `version` — lưu Itinerary xong thì form Details mở
 *    trước đó phải bị từ chối.
 *  ③ Tour đang bán không bao giờ trở nên thiếu: lệnh làm thiếu bị từ chối và
 *    rollback trọn.
 *  ④ Xoá kéo theo đúng các bảng con, giữ câu hỏi của khách, và bị khoá ngoại
 *    chặn khi tour đã có booking.
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test';
const CUSTOMER_EMAIL = 'tour-editor-customer@example.com';

const uuid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tourId = (n: number) => uuid('f1700001', n);
const CATEGORY_ID = uuid('f1700002', 1);
const OTHER_CATEGORY_ID = uuid('f1700002', 2);
const DEST_1 = uuid('f1700003', 1);
const DEST_2 = uuid('f1700003', 2);
const DEST_3 = uuid('f1700003', 3);
const MISSING = uuid('f17000ff', 1);

/** Ngày lịch Việt Nam hôm nay lệch `offset` ngày, khuôn 00:00 UTC của `@db.Date`. */
const today = vietnamToday(new Date());
const day = (offset: number) => {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
};

function sessionCookie(res: { headers: Record<string, unknown> }): string {
  /* chép nguyên từ admin-destinations.int.spec.ts */
}

describe('admin tours integration (F17)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let customerId: string;
  let web: WebRevalidationService;

  beforeAll(async () => {
    // Int spec chạy tuần tự (`fileParallelism: false`), nên dọn cả `posts` ở đây
    // không giẫm lên `posts.int.spec.ts`.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, tour_categories, destinations, media_assets, posts CASCADE',
    );
    /* dựng app + hai phiên như admin-destinations.int.spec.ts; lấy customerId */
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    // Booking trỏ tour bằng khoá ngoại RESTRICT — xoá booking TRƯỚC tour.
    await prisma.booking.deleteMany();
    await prisma.enquiry.deleteMany();
    await prisma.post.deleteMany();
    await prisma.tour.deleteMany();
    await prisma.destination.deleteMany();
    await prisma.tourCategory.deleteMany();
    await prisma.tourCategory.createMany({
      data: [
        { id: CATEGORY_ID, slug: 'day-trips', name: 'Day trips', order: 1 },
        { id: OTHER_CATEGORY_ID, slug: 'retired', name: 'Retired', order: 2, isActive: false },
      ],
    });
    await prisma.destination.createMany({
      data: [
        { id: DEST_1, slug: 'hoi-an', name: 'Hội An', region: 'Central Vietnam' },
        { id: DEST_2, slug: 'hanoi', name: 'Hà Nội', region: 'Northern Vietnam' },
        { id: DEST_3, slug: 'an-bang', name: 'An Bàng', region: 'Central Vietnam', isActive: false },
      ],
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  /** Một tour ĐỦ để bán, 2 ngày, đang bán — ca nào cần khác thì đè bằng `patch`. */
  const makeTour = (n: number, patch: Partial<Prisma.TourUncheckedCreateInput> = {}) =>
    prisma.tour.create({
      data: {
        id: tourId(n),
        slug: `f17-tour-${n}`,
        title: `F17 Tour ${n}`,
        summary: 'A day on the water.',
        categoryId: CATEGORY_ID,
        durationDays: 2,
        maxGroupSize: 12,
        basePrice: '99.00',
        isPublished: true,
        destinations: { create: [{ destinationId: DEST_1, isPrimary: true }] },
        itinerary: {
          create: [
            { dayNumber: 1, title: 'Arrive' },
            { dayNumber: 2, title: 'Leave' },
          ],
        },
        ...patch,
      },
    });

  const makeDeparture = (
    tour: string,
    patch: Partial<Prisma.TourDepartureUncheckedCreateInput> & { startDate: Date; endDate: Date },
  ) => prisma.tourDeparture.create({ data: { tourId: tour, seatsTotal: 10, ...patch } });

  /** Booking tối thiểu — khuôn `admin-catalog.int.spec.ts`. */
  const makeBooking = async (tour: string, departure: string, code: string) =>
    prisma.booking.create({
      data: {
        code,
        userId: customerId,
        tourId: tour,
        departureId: departure,
        numAdults: 1,
        totalAmount: '99.00',
        status: BookingStatus.PAID,
        tourTitle: 'F17 Tour',
        departureStartDate: day(30),
        departureEndDate: day(31),
        unitPrice: '99.00',
        contactName: 'Ada Lovelace',
        contactEmail: 'ada@example.com',
        paymentProvider: PaymentProvider.STRIPE,
        paidAt: new Date(),
      },
    });

  const get = (slug: string, cookie = adminCookie) =>
    app.inject({ method: 'GET', url: `/api/admin/tours/${slug}`, headers: { cookie } });
  const post = (url: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    app.inject({ method: 'POST', url, headers: { cookie }, payload });
  const create = (payload: Record<string, unknown>, cookie = adminCookie) =>
    post('/api/admin/tours', payload, cookie);
  const remove = (id: string, cookie = adminCookie) => post(`/api/admin/tours/${id}/delete`, {}, cookie);

  const detailOf = async (slug: string) => {
    const res = await get(slug);
    expect(res.statusCode).toBe(200);
    return AdminTourDetailSchema.parse(res.json());
  };

  const CREATE = {
    title: 'Hoi An Lantern Walk',
    slug: 'hoi-an-lantern-walk',
    categoryId: CATEGORY_ID,
    primaryDestinationId: DEST_1,
    durationDays: 1,
    maxGroupSize: 10,
    basePrice: '45.00',
  };

  describe('guard', () => {
    it('khách thường thì mọi đường đều 403', async () => {
      await makeTour(1);
      expect((await get('f17-tour-1', customerCookie)).statusCode).toBe(403);
      expect((await create(CREATE, customerCookie)).statusCode).toBe(403);
      expect((await remove(tourId(1), customerCookie)).statusCode).toBe(403);
    });

    it('chưa đăng nhập thì mọi đường đều 401', async () => {
      await makeTour(1);
      expect((await get('f17-tour-1', '')).statusCode).toBe(401);
      expect((await create(CREATE, '')).statusCode).toBe(401);
      expect((await remove(tourId(1), '')).statusCode).toBe(401);
    });
  });

  describe('get', () => {
    it('trả đủ tour, danh sách con theo thứ tự, version có mili-giây', async () => {
      await makeTour(1, {
        isPublished: false,
        durationDays: 3,
        destinations: {
          create: [
            { destinationId: DEST_2, isPrimary: false },
            { destinationId: DEST_1, isPrimary: true },
          ],
        },
        itinerary: {
          create: [
            { dayNumber: 3, title: 'Third' },
            { dayNumber: 1, title: 'First' },
          ],
        },
        faqs: {
          create: [
            { question: 'Second?', answer: 'B', order: 1 },
            { question: 'First?', answer: 'A', order: 0 },
          ],
        },
        costItems: {
          create: [
            { category: 'GUIDE', label: 'Guide', amount: '40.00', basis: 'PER_DEPARTURE', sortOrder: 1 },
            { category: 'MEALS', label: 'Lunch', amount: '8.50', basis: 'PER_PERSON', sortOrder: 0 },
          ],
        },
      });
      const row = await prisma.tour.findUniqueOrThrow({ where: { id: tourId(1) } });

      const detail = await detailOf('f17-tour-1');

      // Tour TẮT bán vẫn đọc được — khu làm việc là nơi soạn tour chưa bán.
      expect(detail.isPublished).toBe(false);
      expect(detail.version).toBe(row.updatedAt.toISOString());
      expect(detail.destinations).toEqual([
        { destinationId: DEST_1, isPrimary: true },
        { destinationId: DEST_2, isPrimary: false },
      ]);
      expect(detail.itinerary.map((d) => d.dayNumber)).toEqual([1, 3]);
      expect(detail.faqs.map((f) => f.question)).toEqual(['First?', 'Second?']);
      expect(detail.costItems.map((c) => c.label)).toEqual(['Lunch', 'Guide']);
      expect(detail.costItems[0]?.amount).toBe('8.50');
      expect(detail.readiness).toEqual({
        summary: true,
        primaryDestination: true,
        missingDays: [2],
        ready: false,
      });
    });

    it('đếm chuyến, booking và sàn ghế theo giai đoạn', async () => {
      await makeTour(1);
      await makeDeparture(tourId(1), { startDate: day(-10), endDate: day(-9), seatsTotal: 30 }); // đã về
      await makeDeparture(tourId(1), { startDate: day(20), endDate: day(21), seatsTotal: 40, status: 'CANCELLED' });
      const live = await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31), seatsTotal: 11 });
      await makeBooking(tourId(1), live.id, 'BK-F17GET01');

      const detail = await detailOf('f17-tour-1');

      expect(detail.departureCount).toBe(3);
      expect(detail.liveSeatsMax).toBe(11);
      expect(detail.bookingCount).toBe(1);
    });

    it('slug không có thì 404 với câu của contract', async () => {
      const res = await get('no-such-tour');
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND', message: 'Tour not found' });
    });
  });

  describe('create', () => {
    it('tạo tour TẮT bán, USD, một điểm chính, chưa có giá vốn — và không bust', async () => {
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await create({ ...CREATE, title: '  Hoi An Lantern Walk  ' });

      expect(res.statusCode).toBe(200);
      const created = AdminTourCreateResultSchema.parse(res.json());
      expect(created.slug).toBe('hoi-an-lantern-walk');
      const row = await prisma.tour.findUniqueOrThrow({
        where: { id: created.id },
        include: { destinations: true, itinerary: true },
      });
      expect(row).toMatchObject({
        title: 'Hoi An Lantern Walk',
        isPublished: false,
        currency: 'USD',
        costPrice: null,
        durationDays: 1,
        maxGroupSize: 10,
      });
      expect(row.basePrice.toFixed(2)).toBe('45.00');
      expect(row.destinations).toEqual([expect.objectContaining({ destinationId: DEST_1, isPrimary: true })]);
      expect(row.itinerary).toEqual([]);
      // Tour mới đang tắt bán — web chưa có trang nào chứa nó.
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('slug trùng thì 409 SLUG_TAKEN, kể cả hai lượt tạo bắn cùng lúc', async () => {
      const [a, b] = await Promise.all([create(CREATE), create(CREATE)]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      const loser = a.statusCode === 409 ? a : b;
      expect(loser.json()).toMatchObject({ code: 'SLUG_TAKEN' });
      expect(await prisma.tour.count({ where: { slug: CREATE.slug } })).toBe(1);
    });

    it('danh mục hay điểm đến không tồn tại thì 404 NOT_FOUND, không để lại hàng nào', async () => {
      const noCategory = await create({ ...CREATE, categoryId: MISSING });
      const noDestination = await create({ ...CREATE, slug: 'other-slug', primaryDestinationId: MISSING });

      expect(noCategory.statusCode).toBe(404);
      expect(noCategory.json()).toMatchObject({ code: 'NOT_FOUND', message: 'Category or destination not found' });
      expect(noDestination.statusCode).toBe(404);
      expect(await prisma.tour.count()).toBe(0);
    });

    it('danh mục và điểm đến ĐANG ẨN vẫn chọn được (spec §2b.4)', async () => {
      const res = await create({ ...CREATE, categoryId: OTHER_CATEGORY_ID, primaryDestinationId: DEST_3 });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('delete', () => {
    it('xoá tour chưa từng có booking kéo theo mọi bảng con, giữ câu hỏi của khách', async () => {
      await makeTour(1, {
        faqs: { create: [{ question: 'Q?', answer: 'A' }] },
        policies: { create: [{ kind: 'GENERAL', title: 'T', body: 'B' }] },
        costItems: { create: [{ category: 'MEALS', label: 'Lunch', amount: '8.00', basis: 'PER_PERSON' }] },
      });
      await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31) });
      // Một hàng cho mỗi bảng còn lại mà spec §2d và plan (quyết định 4) kể tên.
      // Đọc model trong schema.prisma để lấy field bắt buộc tối thiểu.
      await prisma.wishlist.create({ data: { userId: customerId, tourId: tourId(1) } });
      /* Review CURATED gắn tourId(1) · Post + PostTour gắn tourId(1) */
      const enquiry = await prisma.enquiry.create({
        data: { name: 'Ada', email: 'ada@example.com', message: 'Is it rainy?', tourId: tourId(1) },
      });

      const res = await remove(tourId(1));

      expect(res.statusCode).toBe(200);
      expect(AdminTourDeleteResultSchema.parse(res.json())).toEqual({ slug: 'f17-tour-1' });
      const where = { tourId: tourId(1) };
      expect(await prisma.tour.count({ where: { id: tourId(1) } })).toBe(0);
      expect(await prisma.tourDeparture.count({ where })).toBe(0);
      expect(await prisma.tourItineraryDay.count({ where })).toBe(0);
      expect(await prisma.tourFaq.count({ where })).toBe(0);
      expect(await prisma.tourPolicy.count({ where })).toBe(0);
      expect(await prisma.tourCostItem.count({ where })).toBe(0);
      expect(await prisma.tourDestination.count({ where })).toBe(0);
      expect(await prisma.wishlist.count({ where })).toBe(0);
      expect(await prisma.review.count({ where })).toBe(0);
      expect(await prisma.postTour.count({ where })).toBe(0);
      const kept = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
      expect(kept.tourId).toBeNull();
    });

    it('tour đã có booking thì 409 TOUR_HAS_BOOKINGS, không mất gì, không bust', async () => {
      await makeTour(1);
      const departure = await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31) });
      await makeBooking(tourId(1), departure.id, 'BK-F17DEL01');
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await remove(tourId(1));

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'TOUR_HAS_BOOKINGS' });
      expect(await prisma.tour.count({ where: { id: tourId(1) } })).toBe(1);
      expect(await prisma.tourDeparture.count({ where: { tourId: tourId(1) } })).toBe(1);
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('bust hai tag của tour SAU khi xoá xong', async () => {
      await makeTour(1);
      const seen: Array<{ tags: string[]; exists: boolean }> = [];
      vi.spyOn(web, 'revalidate').mockImplementation(async (tags) => {
        seen.push({ tags, exists: (await prisma.tour.count({ where: { id: tourId(1) } })) > 0 });
      });

      await remove(tourId(1));

      await vi.waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0]).toEqual({ tags: ['tours', 'tour:f17-tour-1'], exists: false });
    });

    it('id không có thì 404', async () => {
      const res = await remove(MISSING);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND', message: 'Tour not found' });
    });
  });
});
```

  Chỗ `/* … */` là việc chép hoặc dựng theo schema — KHÔNG để nguyên chú thích
  trong file thật. `app.module` phải thấy `web = moduleRef.get(WebRevalidationService)`
  như spec điểm đến. Chạy
  `pnpm --filter @tourism/api test:int -- src/modules/catalog/admin-tours.int.spec.ts`
  → đỏ (404 vì route chưa có).

- [ ] **Bước 5: Cài service** — `admin-tours.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import {
  type AdminTourCreateInput,
  type AdminTourCreateResult,
  type AdminTourDeleteInput,
  type AdminTourDeleteResult,
  type AdminTourDetail,
  TOUR_CURRENCY,
  tourReadiness,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { tourRevalidationTags } from '../web-revalidation/revalidation-decision.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import {
  AdminTourNotFoundError,
  TourHasBookingsError,
  TourLinkNotFoundError,
  TourSlugTakenError,
} from './admin-tour-errors.js';
import { liveSeatsMax } from './tour-editor-rules.js';

/**
 * Khu làm việc của MỘT tour phía admin (spec F17, ADR-0047): đọc, tạo, xoá, và
 * bốn lệnh sửa theo tab.
 *
 * Mọi lỗi DB bắt NGAY tại câu ghi, không SELECT kiểm trước (bài học 1–2 của
 * vòng review F14): slug trùng → `P2002`, hàng không còn → `P2025`, khoá ngoại →
 * `P2003`. Kiểm-trước-ghi-sau để hở một cửa sổ, và lỗi ở cửa sổ ấy ra 500.
 *
 * Bust cache web SAU commit, fire-and-forget, hai tag của tour (ADR-0016);
 * lệnh ghi hỏng thì không bust.
 */

/** Tiền ra chuỗi 2 chữ số lẻ — không bao giờ thành số thực (cùng luật `admin-catalog.service.ts`). */
const money = (value: Prisma.Decimal): string => value.toFixed(2);

export function prismaCode(error: unknown): string | undefined {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

const TOUR_DETAIL_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  categoryId: true,
  difficulty: true,
  isFeatured: true,
  isPublished: true,
  durationDays: true,
  maxGroupSize: true,
  basePrice: true,
  currency: true,
  costPrice: true,
  ratingAvg: true,
  ratingCount: true,
  suitableFor: true,
  badges: true,
  highlights: true,
  included: true,
  excluded: true,
  meetingPoint: true,
  factDurationNote: true,
  factGroupSizeNote: true,
  factDifficultyNote: true,
  factGoodForNote: true,
  updatedAt: true,
  destinations: {
    select: { destinationId: true, isPrimary: true },
    // Điểm chính đứng đầu; còn lại theo tên để thứ tự không tuỳ kế hoạch truy vấn.
    orderBy: [{ isPrimary: 'desc' }, { destination: { name: 'asc' } }],
  },
  itinerary: {
    select: { dayNumber: true, title: true, description: true },
    orderBy: { dayNumber: 'asc' },
  },
  faqs: { select: { question: true, answer: true }, orderBy: [{ order: 'asc' }, { id: 'asc' }] },
  policies: {
    select: { kind: true, title: true, body: true },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  },
  costItems: {
    select: { category: true, label: true, amount: true, basis: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  },
  departures: { select: { seatsTotal: true, startDate: true, endDate: true, status: true } },
  _count: { select: { bookings: true } },
} satisfies Prisma.TourSelect;

type TourDetailRow = Prisma.TourGetPayload<{ select: typeof TOUR_DETAIL_SELECT }>;

function toDetail(row: TourDetailRow, now: Date): AdminTourDetail {
  return {
    id: row.id,
    slug: row.slug,
    version: row.updatedAt.toISOString(),
    title: row.title,
    summary: row.summary,
    categoryId: row.categoryId,
    difficulty: row.difficulty,
    isFeatured: row.isFeatured,
    isPublished: row.isPublished,
    durationDays: row.durationDays,
    maxGroupSize: row.maxGroupSize,
    basePrice: money(row.basePrice),
    currency: row.currency,
    costPrice: row.costPrice ? money(row.costPrice) : null,
    ratingAvg: row.ratingAvg ? row.ratingAvg.toFixed(1) : null,
    ratingCount: row.ratingCount,
    suitableFor: row.suitableFor,
    badges: row.badges,
    highlights: row.highlights,
    included: row.included,
    excluded: row.excluded,
    meetingPoint: row.meetingPoint,
    factDurationNote: row.factDurationNote,
    factGroupSizeNote: row.factGroupSizeNote,
    factDifficultyNote: row.factDifficultyNote,
    factGoodForNote: row.factGoodForNote,
    destinations: row.destinations,
    itinerary: row.itinerary,
    faqs: row.faqs,
    policies: row.policies,
    costItems: row.costItems.map((item) => ({ ...item, amount: money(item.amount) })),
    departureCount: row.departures.length,
    liveSeatsMax: liveSeatsMax(row.departures, now),
    bookingCount: row._count.bookings,
    readiness: tourReadiness({
      summary: row.summary,
      destinations: row.destinations,
      durationDays: row.durationDays,
      itineraryDays: row.itinerary.map((day) => day.dayNumber),
    }),
  };
}

@Injectable()
export class AdminToursService {
  private readonly logger = new Logger(AdminToursService.name);

  constructor(private readonly webRevalidation: WebRevalidationService) {}

  /** Một tour, mọi trạng thái bán — tour tắt bán chính là tour đang được soạn. */
  async get(slug: string): Promise<AdminTourDetail> {
    const row = await prisma.tour.findUnique({ where: { slug }, select: TOUR_DETAIL_SELECT });
    if (!row) throw new AdminTourNotFoundError(slug);
    return toDetail(row, new Date());
  }

  /**
   * Tạo tour ở dạng TẮT bán, một điểm chính, mọi danh sách rỗng, chưa có giá
   * vốn (spec §2a). Không bust: web chưa có trang nào chứa một tour tắt bán.
   */
  async create(input: AdminTourCreateInput): Promise<AdminTourCreateResult> {
    const created = await prisma.tour
      .create({
        data: {
          slug: input.slug,
          title: input.title,
          categoryId: input.categoryId,
          durationDays: input.durationDays,
          maxGroupSize: input.maxGroupSize,
          basePrice: input.basePrice,
          currency: TOUR_CURRENCY,
          isPublished: false,
          destinations: { create: [{ destinationId: input.primaryDestinationId, isPrimary: true }] },
        },
        select: { id: true, slug: true },
      })
      .catch((error: unknown) => {
        const code = prismaCode(error);
        if (code === 'P2002') throw new TourSlugTakenError(input.slug);
        if (code === 'P2003') throw new TourLinkNotFoundError();
        throw error;
      });

    this.logger.log(`[admin] tour created ${JSON.stringify(created)}`);
    return created;
  }

  /**
   * Xoá thẳng; khoá ngoại `Restrict` của booking là trọng tài (ADR-0047 §5) —
   * không đếm booking trước, vì một booking chen vào giữa câu đếm và câu xoá sẽ
   * mồ côi (spec §4.6). DB tự xoá theo mọi bảng con khai `Cascade`, kể cả đánh
   * giá gắn tour (plan F17, quyết định 4); câu hỏi của khách giữ lại, mất liên
   * kết (`SetNull`). Ảnh của tour không có khoá ngoại — F18 lo.
   */
  async delete(input: AdminTourDeleteInput): Promise<AdminTourDeleteResult> {
    const deleted = await prisma.tour
      .delete({ where: { id: input.id }, select: { slug: true } })
      .catch((error: unknown) => {
        const code = prismaCode(error);
        if (code === 'P2025') throw new AdminTourNotFoundError(input.id);
        if (code === 'P2003') throw new TourHasBookingsError();
        throw error;
      });

    this.logger.log(`[admin] tour deleted ${JSON.stringify({ id: input.id, slug: deleted.slug })}`);
    this.bust(deleted.slug);
    return { slug: deleted.slug };
  }

  /**
   * Bust cache web SAU khi lệnh ghi đã xong (ADR-0016 §3). `void` có chủ đích —
   * đường này chết thì site chỉ kém tươi, còn lệnh ghi đã ăn rồi.
   */
  private bust(slug: string): void {
    void this.webRevalidation.revalidate(tourRevalidationTags(slug));
  }
}
```

  Nếu int test cho thấy Prisma trả mã KHÁC `P2003` cho điểm đến không tồn tại
  trong `destinations: { create }` lồng nhau, hoặc cho lệnh xoá bị `Restrict`
  chặn, thì bắt đúng mã đo được và ghi vào báo cáo bàn giao — đừng nới test.

- [ ] **Bước 6: Controller và module.** `catalog.module.ts`: thêm
  `AdminToursService` vào `providers` (kèm comment "F17 (P4e-3a): khu làm việc
  tour — tạo, sửa theo tab, xoá"). `admin-tours.controller.ts`: tiêm thêm
  service, thêm ba handler theo khuôn `AdminDestinationsController`:

```ts
  constructor(
    private readonly adminCatalog: AdminCatalogService,
    private readonly adminTours: AdminToursService,
  ) {}

  @Implement(contract.admin.tours.get)
  get() {
    return implement(contract.admin.tours.get).handler(async ({ input, errors }) => {
      try {
        return await this.adminTours.get(input.slug);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.tours.create)
  create() {
    return implement(contract.admin.tours.create).handler(async ({ input, errors }) => {
      try {
        return await this.adminTours.create(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.tours.delete)
  delete() {
    return implement(contract.admin.tours.delete).handler(async ({ input, errors }) => {
      try {
        return await this.adminTours.delete(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }
```

  Sửa JSDoc đầu class: controller giờ phục vụ cả danh sách/công tắc (F11) lẫn
  khu làm việc (F17).

- [ ] **Bước 7: Xanh.** Build api, chạy lại int spec → xanh hết. Đột biến:
  `isPublished: false` → `true` (ca tạo đỏ); bỏ nhánh `P2002` (ca slug trùng ra
  500, đỏ); bỏ nhánh `P2003` ở `delete` (ca có booking ra 500, đỏ); gọi
  `this.bust` TRƯỚC `prisma.tour.delete` (ca bust thấy `exists: true`, đỏ).

- [ ] **Bước 8: Gate + commit.**

```bash
git add apps/api/src/modules/catalog/admin-tour-errors.ts apps/api/src/modules/catalog/tour-editor-rules.ts apps/api/src/modules/catalog/tour-editor-rules.spec.ts apps/api/src/modules/catalog/admin-tours.service.ts apps/api/src/modules/catalog/admin-tours.int.spec.ts apps/api/src/modules/catalog/admin-tours.controller.ts apps/api/src/modules/catalog/catalog.module.ts
git commit -m "feat(api): đọc, tạo và xoá tour cho khu làm việc admin"
```

---

## Task 6 — API: bốn lệnh sửa theo tab

**Files:**

- Create: `apps/api/src/modules/catalog/tour-state.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.service.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.controller.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.int.spec.ts`

**Interfaces:**

- Consumes: Task 2 (`costItemsOf`), Task 5 (lỗi, `nextTourVersion`,
  `liveSeatsMax`, `prismaCode`, `bust`, `get`), Task 1 (`derivedCostPrice`).
- Produces:
  - `tour-state.ts`: `claimTour(tx: Prisma.TransactionClient, id: string, version: string, now: Date): Promise<Date>`
    (trả phiên bản mới) · `readTourReadiness(tx: Prisma.TransactionClient, id: string): Promise<TourReadiness>`
    — Task 7 dùng cái sau.
  - `AdminToursService.updateDetails(input)`, `.setItinerary(input)`,
    `.setFaqsPolicies(input)`, `.setCosts(input)` — cả bốn trả `AdminTourDetail`
    đọc lại SAU commit.

- [ ] **Bước 1: Int test đỏ** — thêm vào `admin-tours.int.spec.ts`. Helper và
  bốn khối `describe`:

```ts
  const details = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/details`, payload, cookie);
  const itinerary = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/itinerary`, payload, cookie);
  const faqsPolicies = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/faqs-policies`, payload, cookie);
  const costs = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/costs`, payload, cookie);

  /** Payload tab Details dựng từ CHÍNH tour đang đọc — ca nào cần khác thì đè. */
  const detailsPayload = (detail: AdminTourDetail, patch: Record<string, unknown> = {}) => ({
    id: detail.id,
    version: detail.version,
    title: detail.title,
    summary: detail.summary,
    categoryId: detail.categoryId,
    difficulty: detail.difficulty,
    isFeatured: detail.isFeatured,
    durationDays: detail.durationDays,
    maxGroupSize: detail.maxGroupSize,
    basePrice: detail.basePrice,
    destinations: detail.destinations,
    suitableFor: detail.suitableFor,
    badges: detail.badges,
    highlights: detail.highlights,
    included: detail.included,
    excluded: detail.excluded,
    meetingPoint: detail.meetingPoint,
    factDurationNote: detail.factDurationNote,
    factGroupSizeNote: detail.factGroupSizeNote,
    factDifficultyNote: detail.factDifficultyNote,
    factGoodForNote: detail.factGoodForNote,
    ...patch,
  });
```

  (thêm `type AdminTourDetail` vào import `@tourism/contract`.) Guard: thêm bốn
  đường mới vào HAI ca guard của Task 5 (403 và 401) — bài học 8.

```ts
  describe('updateDetails', () => {
    it('ghi các cột của tab, trả tour mới với version mới; slug gửi thừa bị bỏ qua', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const res = await details(tourId(1), detailsPayload(before, {
        title: 'Renamed',
        slug: 'hijacked-slug',
        highlights: ['Sunset', 'Kayak'],
        difficulty: 'EASY',
      }));

      expect(res.statusCode).toBe(200);
      const after = AdminTourDetailSchema.parse(res.json());
      expect(after.title).toBe('Renamed');
      expect(after.slug).toBe('f17-tour-1');
      expect(after.highlights).toEqual(['Sunset', 'Kayak']);
      expect(after.difficulty).toBe('EASY');
      expect(after.version).not.toBe(before.version);
      expect(Date.parse(after.version)).toBeGreaterThan(Date.parse(before.version));
    });

    it('version cũ thì 409 STALE_TOUR và không đổi gì', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      await details(tourId(1), detailsPayload(before, { title: 'First save' }));

      const res = await details(tourId(1), detailsPayload(before, { title: 'Stale save' }));

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_TOUR' });
      expect((await detailOf('f17-tour-1')).title).toBe('First save');
    });

    it('hai lệnh cùng version bắn cùng lúc: đúng MỘT lệnh qua', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const [a, b] = await Promise.all([
        details(tourId(1), detailsPayload(before, { title: 'Writer A' })),
        details(tourId(1), detailsPayload(before, { title: 'Writer B' })),
      ]);

      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      const winner = a.statusCode === 200 ? 'Writer A' : 'Writer B';
      expect((await detailOf('f17-tour-1')).title).toBe(winner);
    });

    it('lưu tab con đẩy version — form Details mở trước đó bị từ chối', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      await faqsPolicies(tourId(1), { id: tourId(1), version: before.version, faqs: [], policies: [] });

      const res = await details(tourId(1), detailsPayload(before, { title: 'Late' }));

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_TOUR' });
    });

    it('id không có thì 404; danh mục không có thì 404 và rollback trọn', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const noTour = await details(MISSING, detailsPayload(before, { id: MISSING }));
      const noCategory = await details(tourId(1), detailsPayload(before, { categoryId: MISSING, title: 'X' }));

      expect(noTour.statusCode).toBe(404);
      expect(noCategory.statusCode).toBe(404);
      const after = await detailOf('f17-tour-1');
      expect(after.title).toBe(before.title);
      expect(after.version).toBe(before.version);
    });

    it('thay nguyên danh sách điểm đến, điểm chính đứng đầu', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      await details(tourId(1), detailsPayload(before, {
        destinations: [
          { destinationId: DEST_3, isPrimary: false },
          { destinationId: DEST_2, isPrimary: true },
        ],
      }));

      expect((await detailOf('f17-tour-1')).destinations).toEqual([
        { destinationId: DEST_2, isPrimary: true },
        { destinationId: DEST_3, isPrimary: false },
      ]);
    });

    it('số ngày khoá khi có chuyến, KỂ CẢ chuyến đã huỷ; giữ nguyên số ngày thì qua', async () => {
      await makeTour(1);
      await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31), status: 'CANCELLED' });
      const before = await detailOf('f17-tour-1');

      const changed = await details(tourId(1), detailsPayload(before, { durationDays: 3 }));
      const same = await details(tourId(1), detailsPayload(before, { title: 'Same days' }));

      expect(changed.statusCode).toBe(409);
      expect(changed.json()).toMatchObject({ code: 'DURATION_LOCKED' });
      expect(same.statusCode).toBe(200);
    });

    it('số khách không hạ dưới ghế của chuyến chưa về; chuyến đã về hay đã huỷ không khoá', async () => {
      await makeTour(1, { maxGroupSize: 40 });
      await makeDeparture(tourId(1), { startDate: day(-10), endDate: day(-9), seatsTotal: 30 });
      await makeDeparture(tourId(1), { startDate: day(20), endDate: day(21), seatsTotal: 40, status: 'CANCELLED' });
      await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31), seatsTotal: 12 });
      const before = await detailOf('f17-tour-1');

      const below = await details(tourId(1), detailsPayload(before, { maxGroupSize: 11 }));
      const atFloor = await details(tourId(1), detailsPayload(before, { maxGroupSize: 12 }));

      expect(below.statusCode).toBe(409);
      expect(below.json()).toMatchObject({ code: 'GROUP_SIZE_BELOW_SEATS' });
      expect(atFloor.statusCode).toBe(200);
    });

    it('đổi số khách thì tính lại giá vốn; giữ nguyên số khách thì không đụng', async () => {
      await makeTour(1, {
        maxGroupSize: 20,
        costPrice: '99.99',
        costItems: {
          create: [
            { category: 'MEALS', label: 'Lunch', amount: '30.00', basis: 'PER_PERSON' },
            { category: 'TRANSPORT', label: 'Bus', amount: '400.00', basis: 'PER_DEPARTURE' },
          ],
        },
      });
      const before = await detailOf('f17-tour-1');

      const same = AdminTourDetailSchema.parse(
        (await details(tourId(1), detailsPayload(before, { title: 'No size change' }))).json(),
      );
      const resized = AdminTourDetailSchema.parse(
        (await details(tourId(1), detailsPayload(same, { maxGroupSize: 10 }))).json(),
      );

      expect(same.costPrice).toBe('99.99');
      // 30.00 + 400.00 / 10
      expect(resized.costPrice).toBe('70.00');
    });

    it('giảm số ngày (chưa có chuyến) xoá các ngày lịch trình thừa trong cùng lệnh', async () => {
      await makeTour(1, {
        isPublished: false,
        durationDays: 4,
        itinerary: {
          create: [1, 2, 3, 4].map((dayNumber) => ({ dayNumber, title: `Day ${dayNumber}` })),
        },
      });
      const before = await detailOf('f17-tour-1');

      const after = AdminTourDetailSchema.parse(
        (await details(tourId(1), detailsPayload(before, { durationDays: 2 }))).json(),
      );

      expect(after.itinerary.map((d) => d.dayNumber)).toEqual([1, 2]);
      expect(after.readiness.missingDays).toEqual([]);
    });

    it('tour đang bán: tăng số ngày hay xoá tóm tắt bị từ chối và rollback trọn', async () => {
      await makeTour(1); // đang bán, đủ 2 ngày
      const before = await detailOf('f17-tour-1');

      const moreDays = await details(tourId(1), detailsPayload(before, { durationDays: 3 }));
      const noSummary = await details(tourId(1), detailsPayload(before, { summary: '' }));

      for (const res of [moreDays, noSummary]) {
        expect(res.statusCode).toBe(409);
        expect(res.json()).toMatchObject({ code: 'TOUR_NOT_READY' });
      }
      const after = await detailOf('f17-tour-1');
      expect(after.durationDays).toBe(2);
      expect(after.summary).toBe('A day on the water.');
      expect(after.version).toBe(before.version);
    });

    it('tour TẮT bán: làm thiếu vẫn lưu được, readiness nói ra chỗ thiếu', async () => {
      await makeTour(1, { isPublished: false });
      const before = await detailOf('f17-tour-1');

      const res = await details(tourId(1), detailsPayload(before, { durationDays: 3, summary: null }));

      expect(res.statusCode).toBe(200);
      expect(AdminTourDetailSchema.parse(res.json()).readiness).toEqual({
        summary: false,
        primaryDestination: true,
        missingDays: [3],
        ready: false,
      });
    });
  });

  describe('setItinerary', () => {
    it('thay nguyên lịch trình và đẩy version', async () => {
      await makeTour(1, { durationDays: 3, isPublished: false });
      const before = await detailOf('f17-tour-1');

      const res = await itinerary(tourId(1), {
        id: tourId(1),
        version: before.version,
        days: [
          { dayNumber: 3, title: 'Home', description: null },
          { dayNumber: 1, title: 'Arrive', description: '09:00 — Pick-up at your hotel' },
        ],
      });

      expect(res.statusCode).toBe(200);
      const after = AdminTourDetailSchema.parse(res.json());
      expect(after.itinerary).toEqual([
        { dayNumber: 1, title: 'Arrive', description: '09:00 — Pick-up at your hotel' },
        { dayNumber: 3, title: 'Home', description: null },
      ]);
      expect(after.readiness.missingDays).toEqual([2]);
      expect(after.version).not.toBe(before.version);
    });

    it('ngày vượt số ngày thì 400 và không đổi gì', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const res = await itinerary(tourId(1), {
        id: tourId(1),
        version: before.version,
        days: [{ dayNumber: 3, title: 'Too far', description: null }],
      });

      expect(res.statusCode).toBe(400);
      expect((await detailOf('f17-tour-1')).itinerary).toHaveLength(2);
    });

    it('tour đang bán mà bỏ trống một ngày thì 409 TOUR_NOT_READY', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const res = await itinerary(tourId(1), {
        id: tourId(1),
        version: before.version,
        days: [{ dayNumber: 1, title: 'Only one', description: null }],
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'TOUR_NOT_READY' });
      expect((await detailOf('f17-tour-1')).itinerary).toHaveLength(2);
    });

    it('version cũ thì 409 STALE_TOUR', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      await details(tourId(1), detailsPayload(before, { title: 'Moved on' }));

      const res = await itinerary(tourId(1), { id: tourId(1), version: before.version, days: [] });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_TOUR' });
    });
  });

  describe('setFaqsPolicies', () => {
    it('thay nguyên hai danh sách, giữ ĐÚNG thứ tự gửi', async () => {
      await makeTour(1, { faqs: { create: [{ question: 'Old?', answer: 'Gone' }] } });
      const before = await detailOf('f17-tour-1');

      const res = await faqsPolicies(tourId(1), {
        id: tourId(1),
        version: before.version,
        faqs: [
          { question: 'Zebra?', answer: 'Z' },
          { question: 'Alpha?', answer: 'A' },
        ],
        policies: [
          { kind: 'GENERAL', title: 'Weather', body: 'We sail when it is safe.' },
          { kind: 'BOOKING', title: 'Deposit', body: 'Pay in full to book.' },
        ],
      });

      expect(res.statusCode).toBe(200);
      const after = AdminTourDetailSchema.parse(res.json());
      // Thứ tự cố ý NGƯỢC bảng chữ cái — một bản lỡ tay sắp theo chữ sẽ đỏ.
      expect(after.faqs.map((f) => f.question)).toEqual(['Zebra?', 'Alpha?']);
      expect(after.policies.map((p) => p.title)).toEqual(['Weather', 'Deposit']);
    });

    it('hai danh sách rỗng là hợp lệ', async () => {
      await makeTour(1, { faqs: { create: [{ question: 'Q?', answer: 'A' }] } });
      const before = await detailOf('f17-tour-1');

      const res = await faqsPolicies(tourId(1), { id: tourId(1), version: before.version, faqs: [], policies: [] });

      expect(res.statusCode).toBe(200);
      expect(AdminTourDetailSchema.parse(res.json()).faqs).toEqual([]);
    });
  });

  describe('setCosts', () => {
    it('thay nguyên dòng chi phí theo thứ tự gửi và tính lại giá vốn', async () => {
      await makeTour(1, { maxGroupSize: 12 });
      const before = await detailOf('f17-tour-1');

      const res = await costs(tourId(1), {
        id: tourId(1),
        version: before.version,
        items: [
          { category: 'TRANSPORT', label: 'Boat', amount: '100.01', basis: 'PER_DEPARTURE' },
          { category: 'MEALS', label: 'Lunch', amount: '8.50', basis: 'PER_PERSON' },
        ],
      });

      expect(res.statusCode).toBe(200);
      const after = AdminTourDetailSchema.parse(res.json());
      expect(after.costItems.map((c) => c.label)).toEqual(['Boat', 'Lunch']);
      // 8.50 + 100.01 / 12 = 8.50 + 8.33 (8.334…) = 16.83
      expect(after.costPrice).toBe('16.83');
    });

    it('xoá hết dòng chi phí thì giá vốn về null — tour chưa khai giá vốn', async () => {
      await makeTour(1, {
        costPrice: '10.00',
        costItems: { create: [{ category: 'MEALS', label: 'Lunch', amount: '10.00', basis: 'PER_PERSON' }] },
      });
      const before = await detailOf('f17-tour-1');

      const res = await costs(tourId(1), { id: tourId(1), version: before.version, items: [] });

      expect(AdminTourDetailSchema.parse(res.json()).costPrice).toBeNull();
    });
  });

  describe('bust cache web của bốn lệnh sửa', () => {
    it('mỗi lệnh bust đúng hai tag của tour, SAU commit', async () => {
      await makeTour(1, { isPublished: false });
      const seen: Array<{ tags: string[]; title: string | undefined }> = [];
      vi.spyOn(web, 'revalidate').mockImplementation(async (tags) => {
        const row = await prisma.tour.findUnique({ where: { id: tourId(1) } });
        seen.push({ tags, title: row?.title });
      });
      let current = await detailOf('f17-tour-1');

      current = AdminTourDetailSchema.parse(
        (await details(tourId(1), detailsPayload(current, { title: 'Fresh' }))).json(),
      );
      current = AdminTourDetailSchema.parse(
        (await itinerary(tourId(1), { id: tourId(1), version: current.version, days: [] })).json(),
      );
      current = AdminTourDetailSchema.parse(
        (await faqsPolicies(tourId(1), { id: tourId(1), version: current.version, faqs: [], policies: [] })).json(),
      );
      await costs(tourId(1), { id: tourId(1), version: current.version, items: [] });

      await vi.waitFor(() => expect(seen).toHaveLength(4));
      for (const call of seen) expect(call).toEqual({ tags: ['tours', 'tour:f17-tour-1'], title: 'Fresh' });
    });

    it('lệnh hỏng thì không bust', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      await details(tourId(1), detailsPayload(before, { title: 'Moved on' }));
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      await details(tourId(1), detailsPayload(before, { title: 'Stale' }));
      await itinerary(tourId(1), { id: tourId(1), version: before.version, days: [] });

      expect(revalidate).not.toHaveBeenCalled();
    });
  });
```

  Chạy int spec → các khối mới đỏ (404).

- [ ] **Bước 2: `tour-state.ts`:**

```ts
import { type TourReadiness, tourReadiness } from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';
import { AdminTourNotFoundError, StaleTourError } from './admin-tour-errors.js';
import { nextTourVersion } from './tour-editor-rules.js';

/**
 * Hai bước đọc-ghi chạy TRONG transaction của khu làm việc tour (ADR-0047).
 */

/**
 * Câu ĐẦU TIÊN của mọi lệnh sửa: so phiên bản và giành hàng tour trong MỘT câu
 * `UPDATE … WHERE id = ? AND updated_at = ?` (ADR-0047 §3, spec §4.1).
 *
 * Câu ấy vừa so vừa khoá hàng tour tới hết transaction, nên hai lệnh ghi vào
 * cùng tour xếp hàng; lệnh đến sau chạy lại điều kiện trên hàng đã đổi và đếm
 * được 0. Đọc `updatedAt` bằng một câu riêng rồi mới so là để hở đúng cái khe
 * mà int test "hai lệnh cùng version" canh.
 *
 * Đếm 0 thì câu thứ hai chỉ để chọn MÃ: hàng còn thì phiên bản đã cũ, mất thì
 * tour không còn. Trả phiên bản mới để mọi câu ghi sau trong transaction đặt
 * đúng giá trị ấy (Prisma tự đặt `updatedAt` ở mỗi câu ghi nếu không truyền).
 */
export async function claimTour(
  tx: Prisma.TransactionClient,
  id: string,
  version: string,
  now: Date,
): Promise<Date> {
  const next = nextTourVersion(version, now);
  const { count } = await tx.tour.updateMany({
    where: { id, updatedAt: new Date(version) },
    data: { updatedAt: next },
  });
  if (count === 0) {
    const exists = await tx.tour.findUnique({ where: { id }, select: { id: true } });
    throw exists ? new StaleTourError() : new AdminTourNotFoundError(id);
  }
  return next;
}

/**
 * Độ đủ để bán đọc từ DB, trong transaction đang giữ khoá hàng tour — gọi SAU
 * khi ghi, TRƯỚC commit (spec §4.4), để không lệnh nào chen vào giữa.
 */
export async function readTourReadiness(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<TourReadiness> {
  const row = await tx.tour.findUniqueOrThrow({
    where: { id },
    select: {
      summary: true,
      durationDays: true,
      destinations: { select: { isPrimary: true } },
      itinerary: { select: { dayNumber: true } },
    },
  });
  return tourReadiness({
    summary: row.summary,
    destinations: row.destinations,
    durationDays: row.durationDays,
    itineraryDays: row.itinerary.map((day) => day.dayNumber),
  });
}
```

- [ ] **Bước 3: Bốn method trong `AdminToursService`** (import thêm
  `derivedCostPrice`, bốn type input từ contract; `costItemsOf`;
  `claimTour`, `readTourReadiness`; `ItineraryDayOutOfRangeError`,
  `TourLinkNotFoundError`, `TourNotReadyError`, `TourRuleError`):

```ts
/** Các cột của tab Details — KHÔNG có slug, tiền tệ, giá gạch, cờ bán, điểm đánh giá, giá vốn. */
function detailsColumns(input: AdminTourDetailsInput) {
  return {
    title: input.title,
    summary: input.summary,
    categoryId: input.categoryId,
    difficulty: input.difficulty,
    isFeatured: input.isFeatured,
    durationDays: input.durationDays,
    maxGroupSize: input.maxGroupSize,
    basePrice: input.basePrice,
    suitableFor: input.suitableFor,
    badges: input.badges,
    highlights: input.highlights,
    included: input.included,
    excluded: input.excluded,
    meetingPoint: input.meetingPoint,
    factDurationNote: input.factDurationNote,
    factGroupSizeNote: input.factGroupSizeNote,
    factDifficultyNote: input.factDifficultyNote,
    factGoodForNote: input.factGoodForNote,
  } satisfies Prisma.TourUncheckedUpdateInput;
}

/** Tour đang bán thì luôn đủ để bán (ADR-0047 §4) — kiểm sau khi ghi, trước commit. */
async function assertStillReady(tx: Prisma.TransactionClient, id: string): Promise<void> {
  const readiness = await readTourReadiness(tx, id);
  if (!readiness.ready) throw new TourNotReadyError(readiness);
}

/** Khoá ngoại hỏng ở lệnh sửa = danh mục hay điểm đến không tồn tại. */
function mapLinkError(error: unknown): never {
  if (prismaCode(error) === 'P2003') throw new TourLinkNotFoundError();
  throw error;
}
```

```ts
  /**
   * Tab Details (spec §2b). Thứ tự trong transaction: giành hàng tour → đọc
   * trạng thái hiện tại DƯỚI khoá → hai luật khớp dữ liệu → xoá ngày thừa nếu
   * giảm số ngày → thay điểm đến → ghi cột (kèm giá vốn nếu đổi số khách) →
   * kiểm "vẫn đủ để bán" nếu đang bán.
   */
  async updateDetails(input: AdminTourDetailsInput): Promise<AdminTourDetail> {
    const now = new Date();
    const slug = await prisma
      .$transaction(async (tx) => {
        const next = await claimTour(tx, input.id, input.version, now);
        const current = await tx.tour.findUniqueOrThrow({
          where: { id: input.id },
          select: {
            slug: true,
            durationDays: true,
            maxGroupSize: true,
            isPublished: true,
            departures: { select: { seatsTotal: true, startDate: true, endDate: true, status: true } },
          },
        });

        if (input.durationDays !== current.durationDays && current.departures.length > 0) {
          throw new TourRuleError(
            'DURATION_LOCKED',
            'This tour has departures, so its number of days is locked.',
          );
        }
        const floor = liveSeatsMax(current.departures, now);
        if (floor !== null && input.maxGroupSize < floor) {
          throw new TourRuleError(
            'GROUP_SIZE_BELOW_SEATS',
            `A departure of this tour has ${floor} seats, so the group size cannot go below ${floor}.`,
          );
        }

        if (input.durationDays < current.durationDays) {
          await tx.tourItineraryDay.deleteMany({
            where: { tourId: input.id, dayNumber: { gt: input.durationDays } },
          });
        }
        await tx.tourDestination.deleteMany({ where: { tourId: input.id } });
        await tx.tourDestination.createMany({
          data: input.destinations.map((link) => ({
            tourId: input.id,
            destinationId: link.destinationId,
            isPrimary: link.isPrimary,
          })),
        });

        // Giá vốn chỉ tính lại khi đổi số khách (spec §3) — mẫu số của nó.
        let costPrice: string | null | undefined;
        if (input.maxGroupSize !== current.maxGroupSize) {
          const rows = await tx.tourCostItem.findMany({
            where: { tourId: input.id },
            select: { amount: true, basis: true },
          });
          costPrice = rows.length > 0 ? derivedCostPrice(costItemsOf(rows), input.maxGroupSize) : null;
        }
        await tx.tour.update({
          where: { id: input.id },
          data: {
            ...detailsColumns(input),
            ...(costPrice === undefined ? {} : { costPrice }),
            updatedAt: next,
          },
        });

        if (current.isPublished) await assertStillReady(tx, input.id);
        return current.slug;
      })
      .catch(mapLinkError);

    this.logger.log(`[admin] tour details saved ${JSON.stringify({ id: input.id })}`);
    this.bust(slug);
    return this.get(slug);
  }

  /**
   * Tab Itinerary — thay nguyên. Ngày vượt số ngày là client hỏng (400, quyết
   * định 6); kiểm SAU phép so phiên bản, vì chỉ khi phiên bản khớp thì số ngày
   * client thấy mới đúng là số ngày của tour.
   */
  async setItinerary(input: AdminTourItineraryInput): Promise<AdminTourDetail> {
    const now = new Date();
    const slug = await prisma.$transaction(async (tx) => {
      await claimTour(tx, input.id, input.version, now);
      const current = await tx.tour.findUniqueOrThrow({
        where: { id: input.id },
        select: { slug: true, durationDays: true, isPublished: true },
      });
      const outside = input.days.find((day) => day.dayNumber > current.durationDays);
      if (outside) {
        throw new ItineraryDayOutOfRangeError(
          `Day ${outside.dayNumber} is outside this ${current.durationDays}-day tour.`,
        );
      }

      await tx.tourItineraryDay.deleteMany({ where: { tourId: input.id } });
      await tx.tourItineraryDay.createMany({
        data: input.days.map((day) => ({
          tourId: input.id,
          dayNumber: day.dayNumber,
          title: day.title,
          description: day.description,
        })),
      });

      if (current.isPublished) await assertStillReady(tx, input.id);
      return current.slug;
    });

    this.logger.log(`[admin] tour itinerary saved ${JSON.stringify({ id: input.id, days: input.days.length })}`);
    this.bust(slug);
    return this.get(slug);
  }

  /** Tab FAQ & policies — hai danh sách thay nguyên, `order` = vị trí trong danh sách gửi. */
  async setFaqsPolicies(input: AdminTourFaqsPoliciesInput): Promise<AdminTourDetail> {
    const now = new Date();
    const slug = await prisma.$transaction(async (tx) => {
      await claimTour(tx, input.id, input.version, now);
      const { slug } = await tx.tour.findUniqueOrThrow({
        where: { id: input.id },
        select: { slug: true },
      });

      await tx.tourFaq.deleteMany({ where: { tourId: input.id } });
      await tx.tourFaq.createMany({
        data: input.faqs.map((faq, index) => ({
          tourId: input.id,
          question: faq.question,
          answer: faq.answer,
          order: index,
        })),
      });
      await tx.tourPolicy.deleteMany({ where: { tourId: input.id } });
      await tx.tourPolicy.createMany({
        data: input.policies.map((policy, index) => ({
          tourId: input.id,
          kind: policy.kind,
          title: policy.title,
          body: policy.body,
          order: index,
        })),
      });
      return slug;
    });

    this.logger.log(`[admin] tour FAQ and policies saved ${JSON.stringify({ id: input.id })}`);
    this.bust(slug);
    return this.get(slug);
  }

  /**
   * Tab Costs — dòng chi phí thay nguyên, giá vốn tính lại cùng lệnh (ADR-0033,
   * ADR-0047 §8). KHÔNG đụng `fixedCostAmount` của chuyến có sẵn hay
   * `costPerPerson` của booking có sẵn: hai cột ấy là bản chụp (spec §2b).
   */
  async setCosts(input: AdminTourCostsInput): Promise<AdminTourDetail> {
    const now = new Date();
    const slug = await prisma.$transaction(async (tx) => {
      const next = await claimTour(tx, input.id, input.version, now);
      const current = await tx.tour.findUniqueOrThrow({
        where: { id: input.id },
        select: { slug: true, maxGroupSize: true },
      });

      await tx.tourCostItem.deleteMany({ where: { tourId: input.id } });
      await tx.tourCostItem.createMany({
        data: input.items.map((item, index) => ({
          tourId: input.id,
          category: item.category,
          label: item.label,
          amount: item.amount,
          basis: item.basis,
          sortOrder: index,
        })),
      });
      await tx.tour.update({
        where: { id: input.id },
        data: {
          costPrice: input.items.length > 0 ? derivedCostPrice(input.items, current.maxGroupSize) : null,
          updatedAt: next,
        },
      });
      return current.slug;
    });

    this.logger.log(`[admin] tour costs saved ${JSON.stringify({ id: input.id, items: input.items.length })}`);
    this.bust(slug);
    return this.get(slug);
  }
```

- [ ] **Bước 4: Controller** — bốn handler theo khuôn Task 5, riêng
  `setItinerary` thêm nhánh 400 (import `ORPCError` từ `@orpc/server`):

```ts
  @Implement(contract.admin.tours.setItinerary)
  setItinerary() {
    return implement(contract.admin.tours.setItinerary).handler(async ({ input, errors }) => {
      try {
        return await this.adminTours.setItinerary(input);
      } catch (error) {
        // Ngày ngoài 1..N khi phiên bản đã khớp là client hỏng, không phải thế
        // giới đổi — 400, không thêm mã contract (plan F17, quyết định 6).
        if (error instanceof ItineraryDayOutOfRangeError) {
          throw new ORPCError('BAD_REQUEST', { message: error.message });
        }
        throw toContractError(error, errors);
      }
    });
  }
```

  `updateDetails`, `setFaqsPolicies`, `setCosts`: y khuôn `get` của Task 5,
  gọi `this.adminTours.updateDetails(input)` / `.setFaqsPolicies(input)` /
  `.setCosts(input)`.

- [ ] **Bước 5: Xanh** — build api, chạy int spec. Đột biến (mỗi cái một lần,
  thấy đỏ, trả lại):
  1. `claimTour`: bỏ `updatedAt: new Date(version)` khỏi `where` — ca STALE và
     ca "hai lệnh cùng lúc" đỏ.
  2. `claimTour`: `data: { updatedAt: next }` → `data: {}` — ca "lưu tab con đẩy
     version" đỏ.
  3. `updateDetails`: bỏ `if (current.isPublished) await assertStillReady(…)` —
     ca "tour đang bán…" đỏ.
  4. Bỏ `deleteMany` ngày thừa — ca giảm số ngày đỏ.
  5. `liveSeatsMax` → dùng `Math.max` trên MỌI chuyến — ca sàn ghế đỏ.
  6. `setFaqsPolicies`: `order: index` → `order: 0` — ca thứ tự ngược chữ cái đỏ.
  7. `setCosts`: quên `costPrice` — ca 16.83 đỏ.
  8. `setItinerary`: kiểm ngày vượt TRƯỚC `claimTour` — không test nào đỏ được
     vì kết quả giống nhau; KHÔNG làm vậy vì lý do ở JSDoc, ghi là đột biến
     không giết được (nếu đúng vậy).

- [ ] **Bước 6: Gate + commit.**

```bash
git add apps/api/src/modules/catalog/tour-state.ts apps/api/src/modules/catalog/admin-tours.service.ts apps/api/src/modules/catalog/admin-tours.controller.ts apps/api/src/modules/catalog/admin-tours.int.spec.ts
git commit -m "feat(api): bốn lệnh sửa tour theo tab với khoá phiên bản và luật đủ để bán"
```

---

## Task 7 — API: cổng đăng tour trong `setPublished`

**Files:**

- Modify: `apps/api/src/modules/catalog/admin-catalog.service.ts` (`setTourPublished`, dòng 146–190, cả JSDoc)
- Modify: `apps/api/src/modules/catalog/admin-tours.controller.ts` (`setPublished`)
- Modify: `apps/api/src/modules/catalog/admin-catalog.int.spec.ts` (fixture + ca mới)

**Interfaces:**

- Consumes: Task 6 (`readTourReadiness`), Task 5 (`TourNotReadyError`), Task 4
  (mã `TOUR_NOT_READY` đã khai ở contract).
- Produces: `setTourPublished` chặn chiều bật bán khi thiếu; KHÔNG đẩy `updatedAt`.

- [ ] **Bước 1: Sửa fixture cho tour ALPHA ĐỦ để bán.** `admin-catalog.int.spec.ts`
  đang tạo tour trần (không tóm tắt, không điểm đến, không lịch trình), nên ca
  "tắt rồi bật lại" (dòng ~384–400) sẽ đỏ vì đúng cổng mới. Trong `beforeAll`,
  sau `tourCategory.createMany`, tạo một điểm đến
  (`{ id: 'f1100003-0000-4000-8000-000000000001', slug: 'f11-bay', name: 'F11 Bay' }`);
  thêm `summary: 'A day out.'` vào patch của ALPHA; trong `beforeEach`, sau
  `tour.createMany`, tạo liên kết điểm chính và ngày 1 cho ALPHA:

```ts
    await prisma.tourDestination.create({
      data: { tourId: ALPHA, destinationId: F11_DESTINATION, isPrimary: true },
    });
    await prisma.tourItineraryDay.create({ data: { tourId: ALPHA, dayNumber: 1, title: 'The day' } });
```

  BETA (3 ngày, đang bán, không lịch trình) giữ nguyên — nó là ca "đang bán mà
  thiếu" có sẵn cho Bước 2.

- [ ] **Bước 2: Ca mới, đỏ** — thêm vào khối setPublished của cùng file:

```ts
  it('bật bán tour THIẾU thì 409 TOUR_NOT_READY, câu nói đúng chỗ thiếu, không bust', async () => {
    const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);
    // GAMMA: tắt bán, không tóm tắt, không điểm đến, không lịch trình.
    const res = await setPublished(GAMMA, true, adminCookie);

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      code: 'TOUR_NOT_READY',
      message: 'This tour is missing: a summary, one primary destination, itinerary for day 1.',
    });
    const row = await prisma.tour.findUniqueOrThrow({ where: { id: GAMMA } });
    expect(row.isPublished).toBe(false);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('gỡ bán KHÔNG BAO GIỜ bị chặn, kể cả tour đang thiếu', async () => {
    // BETA đang bán mà thiếu lịch trình (dữ liệu cũ) — vẫn gỡ được.
    const res = await setPublished(BETA, false, adminCookie);
    expect(res.statusCode).toBe(200);
  });

  it('bật một tour ĐÃ đang bán là no-op, không kiểm gì', async () => {
    const res = await setPublished(BETA, true, adminCookie);
    expect(res.statusCode).toBe(200);
    expect(AdminTourSetPublishedResultSchema.parse(res.json()).changed).toBe(false);
  });

  it('bật/tắt bán KHÔNG đẩy updatedAt — form đang mở không thành cũ (plan F17, quyết định 2)', async () => {
    const before = await prisma.tour.findUniqueOrThrow({ where: { id: ALPHA } });

    await setPublished(ALPHA, false, adminCookie);
    await setPublished(ALPHA, true, adminCookie);

    const after = await prisma.tour.findUniqueOrThrow({ where: { id: ALPHA } });
    expect(after.isPublished).toBe(true);
    expect(after.updatedAt.toISOString()).toBe(before.updatedAt.toISOString());
  });
```

  Cần `web` (spy `WebRevalidationService`) như các int spec khác — thêm biến và
  `moduleRef.get(...)` nếu file chưa có; `vi.restoreAllMocks()` đầu `beforeEach`.
  GAMMA tạo từ `tour()` nên cần `durationDays: 1` (mặc định của helper) để câu
  lỗi kết thúc bằng "day 1". Chạy int spec → ba ca đầu đỏ (200 thay vì 409 ở ca 1;
  ca 4 đỏ vì Prisma đẩy `updatedAt`).

- [ ] **Bước 3: Cài** — `setTourPublished`:

```ts
  /**
   * Đưa một tour lên kệ hoặc rút khỏi kệ.
   *
   * **Bật bán có cổng** (ADR-0047 §4): tour phải đủ để bán theo
   * `tourReadiness`, đọc DƯỚI khoá hàng tour. Khoá (`SELECT … FOR UPDATE` ở MỘT
   * câu riêng, khuôn `admin-departures.service.ts`) để một lệnh sửa tab chen vào
   * giữa lúc đọc và lúc ghi phải xếp hàng: lệnh sửa bắt đầu bằng câu `UPDATE`
   * trên đúng hàng này (`claimTour`), và sau khi lệnh bật bán commit nó thấy tour
   * đang bán rồi tự kiểm "vẫn đủ" — bất biến "đang bán ⇒ đủ để bán" không có khe.
   *
   * **Gỡ bán không bao giờ bị chặn**, kể cả khi tour có booking sống hay đang
   * thiếu (spec §3-F11): khách đã mua vẫn đi, tour chỉ thôi được chào bán.
   *
   * **Không đẩy `updatedAt`** (plan F17, quyết định 2): công tắc không đổi nội
   * dung, nên form đang mở trong khu làm việc không được thành "cũ" chỉ vì admin
   * bấm On sale ở phần đầu trang. Đặt tường minh giá trị cũ — Prisma tự đẩy cột
   * `@updatedAt` ở mọi câu ghi nếu không truyền.
   */
  async setTourPublished(input: AdminTourSetPublishedInput): Promise<AdminTourSetPublishedResult> {
    const { id, isPublished } = input;

    const outcome = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        { slug: string; is_published: boolean; updated_at: Date }[]
      >(Prisma.sql`
        SELECT slug, is_published, updated_at FROM tours WHERE id = ${id}::uuid FOR UPDATE
      `);
      if (!locked) return null;
      if (locked.is_published === isPublished) return { slug: locked.slug, changed: false };
      if (isPublished) {
        const readiness = await readTourReadiness(tx, id);
        if (!readiness.ready) throw new TourNotReadyError(readiness);
      }
      await tx.tour.update({ where: { id }, data: { isPublished, updatedAt: locked.updated_at } });
      return { slug: locked.slug, changed: true };
    });

    if (!outcome) throw new TourNotFoundError();

    /* giữ nguyên đoạn comment + dòng bust cũ */
    void this.webRevalidation.revalidate(tourRevalidationTags(outcome.slug));

    return { id, isPublished, changed: outcome.changed };
  }
```

  Đổi `import type { Prisma }` thành import giá trị (cần `Prisma.sql`). Controller:

```ts
      } catch (err) {
        if (err instanceof TourNotFoundError) throw errors.NOT_FOUND();
        // `TOUR_NOT_READY` và mọi `ContractError` khác đi qua bảng mã ĐÃ KHAI.
        throw toContractError(err, errors);
      }
```

- [ ] **Bước 4: Xanh** — build api, chạy `admin-catalog.int.spec.ts` và
  `admin-tours.int.spec.ts`. Đột biến: bỏ `updatedAt: locked.updated_at` (ca 4
  đỏ); đổi `if (isPublished)` thành `if (true)` (ca gỡ bán BETA đỏ); đặt nhánh
  kiểm readiness TRƯỚC nhánh no-op (ca "bật tour đã đang bán" đỏ).

- [ ] **Bước 5: Gate + commit.**

```bash
git add apps/api/src/modules/catalog/admin-catalog.service.ts apps/api/src/modules/catalog/admin-tours.controller.ts apps/api/src/modules/catalog/admin-catalog.int.spec.ts
git commit -m "feat(api): chặn bật bán tour chưa đủ, giữ nguyên phiên bản khi bật tắt"
```

---

## Task 8 — Kit admin: khung sửa danh sách và hỏi lại khi rời trang

Hai mảnh dùng chung, dựng TRƯỚC form để bốn tab sau chỉ việc ghép.

**Files:**

- Create: `apps/admin/src/lib/list-editor.ts` + `list-editor.spec.ts`
- Create: `apps/admin/src/components/kit/list-editor.tsx` + `list-editor.spec.tsx`
- Create: `apps/admin/src/lib/unsaved-changes.ts` + `unsaved-changes.spec.ts`
- Create: `apps/admin/src/components/kit/unsaved-changes.tsx` + `unsaved-changes.spec.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (hai khối mới dưới `admin`: `listEditor`, `unsavedChanges`)

**Interfaces:**

- Produces (Task 10–12 dùng):
  - `lib/list-editor.ts`: `interface Keyed { key: string }` ·
    `newItemKey(): string` · `moveItem<T>(items: readonly T[], from: number, to: number): T[]`
    · `removeAt<T>(items: readonly T[], index: number): T[]`
  - `<ListEditor<Item extends Keyed>>` props: `items: readonly Item[]` ·
    `onChange(items: Item[])` · `max: number` · `newItem(): Item` ·
    `addLabel: string` · `itemName(index: number): string` ·
    `renderItem(item: Item, index: number): React.ReactNode` · `disabled?: boolean`
    · `empty?: string`
  - `lib/unsaved-changes.ts`: `interface LeaveClick` ·
    `leaveTarget(click: LeaveClick): string | null`
  - `<UnsavedChangesProvider>` · `useReportUnsaved(dirty: boolean): void`

- [ ] **Bước 1: Copy** — thêm vào `messages.admin` (cạnh `table`):

```ts
    /**
     * Khung sửa danh sách của kit (spec F17 §2h) — sáu danh sách của khu làm việc
     * tour dùng chung. `name` là tên MỘT dòng do nơi dùng truyền vào
     * ("highlight 2", "FAQ 3"), để trình đọc màn hình nghe được nút nào của dòng nào.
     */
    listEditor: {
      moveUp: (name: string) => `Move ${name} up`,
      moveDown: (name: string) => `Move ${name} down`,
      remove: (name: string) => `Remove ${name}`,
      limit: (max: number) => `You can add up to ${max}.`,
    },
    /** Hỏi lại khi rời một form có thay đổi chưa lưu (spec F17 §2i). */
    unsavedChanges: {
      title: 'Discard unsaved changes?',
      body: 'You changed this tab but have not saved it. Leaving now throws those changes away.',
      discard: 'Discard changes',
      keep: 'Keep editing',
    },
```

- [ ] **Bước 2: Test đỏ cho hai hàm thuần** — `lib/list-editor.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { moveItem, newItemKey, removeAt } from './list-editor';

describe('list-editor', () => {
  it('moveItem đổi chỗ đúng hai vị trí và không đụng mảng gốc', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 1, 0)).toEqual(['b', 'a', 'c']);
    expect(moveItem(items, 1, 2)).toEqual(['a', 'c', 'b']);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('moveItem ra ngoài biên thì trả bản sao nguyên vẹn', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 2)).toEqual(['a', 'b']);
  });

  it('removeAt bỏ đúng một phần tử', () => {
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });

  it('newItemKey không lặp', () => {
    expect(newItemKey()).not.toBe(newItemKey());
  });
});
```

  `lib/unsaved-changes.spec.ts` — mỗi nhánh của `leaveTarget` một ca, gốc là một
  cú bấm trái trơn vào link nội bộ khác trang khi form đang có thay đổi:

```ts
import { describe, expect, it } from 'vitest';
import { type LeaveClick, leaveTarget } from './unsaved-changes';

const BASE: LeaveClick = {
  dirty: true,
  defaultPrevented: false,
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  anchor: { href: 'https://admin.test/tours/ha-long/itinerary', target: '', hasDownload: false },
  current: 'https://admin.test/tours/ha-long',
};

describe('leaveTarget', () => {
  it('link nội bộ sang trang khác khi có thay đổi → trả đường cần hỏi', () => {
    expect(leaveTarget(BASE)).toBe('/tours/ha-long/itinerary');
  });

  it.each<[string, Partial<LeaveClick>]>([
    ['form không có thay đổi', { dirty: false }],
    ['không bấm vào link', { anchor: null }],
    ['cú bấm đã bị chặn ở chỗ khác', { defaultPrevented: true }],
    ['bấm chuột giữa', { button: 1 }],
    ['Ctrl+bấm (mở tab mới)', { ctrlKey: true }],
    ['Cmd+bấm', { metaKey: true }],
    ['Shift+bấm', { shiftKey: true }],
    ['Alt+bấm', { altKey: true }],
  ])('%s → không hỏi', (_name, patch) => {
    expect(leaveTarget({ ...BASE, ...patch })).toBeNull();
  });

  it('link mở tab mới, link tải file, link ra ngoài → không hỏi (beforeunload lo phần rời hẳn)', () => {
    const anchor = BASE.anchor as NonNullable<LeaveClick['anchor']>;
    expect(leaveTarget({ ...BASE, anchor: { ...anchor, target: '_blank' } })).toBeNull();
    expect(leaveTarget({ ...BASE, anchor: { ...anchor, hasDownload: true } })).toBeNull();
    expect(leaveTarget({ ...BASE, anchor: { ...anchor, href: 'https://nexora.test/tours' } })).toBeNull();
  });

  it('chỉ đổi #hash trên cùng trang → không hỏi; đổi query → hỏi', () => {
    const anchor = BASE.anchor as NonNullable<LeaveClick['anchor']>;
    expect(
      leaveTarget({ ...BASE, anchor: { ...anchor, href: 'https://admin.test/tours/ha-long#tour-summary' } }),
    ).toBeNull();
    expect(
      leaveTarget({ ...BASE, anchor: { ...anchor, href: 'https://admin.test/tours/ha-long?x=1' } }),
    ).toBe('/tours/ha-long?x=1');
  });

  it('target="_self" vẫn là cùng tab → hỏi', () => {
    const anchor = BASE.anchor as NonNullable<LeaveClick['anchor']>;
    expect(leaveTarget({ ...BASE, anchor: { ...anchor, target: '_self' } })).toBe('/tours/ha-long/itinerary');
  });
});
```

  Chạy `pnpm --filter @tourism/admin exec vitest run src/lib/list-editor.spec.ts src/lib/unsaved-changes.spec.ts` → đỏ.

- [ ] **Bước 3: Cài hai file thuần.**

```ts
// apps/admin/src/lib/list-editor.ts
/**
 * Phép biến đổi THUẦN của khung sửa danh sách (spec F17 §2h). Mỗi dòng mang
 * `key` riêng do client sinh: React giữ đúng nút DOM của dòng khi đổi chỗ, nên
 * tiêu điểm bàn phím đi theo dòng vừa dời thay vì ở lại vị trí cũ.
 */
export interface Keyed {
  key: string;
}

export function newItemKey(): string {
  return crypto.randomUUID();
}

/** Bản sao đã đổi chỗ hai vị trí; ra ngoài biên thì trả bản sao nguyên vẹn. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

export function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, position) => position !== index);
}
```

```ts
// apps/admin/src/lib/unsaved-changes.ts
/**
 * Một cú bấm có phải là "rời trang trong khi form còn thay đổi chưa lưu" không
 * (spec F17 §2i) — THUẦN, để mọi nhánh test được mà không cần DOM.
 *
 * Chỉ bắt điều hướng NỘI BỘ cùng tab: `beforeunload` của trình duyệt đã lo phần
 * rời hẳn (link ra ngoài, đóng tab, gõ địa chỉ), còn link mở tab mới hay tải
 * file thì form ở tab này vẫn còn nguyên.
 */
export interface LeaveClick {
  dirty: boolean;
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** Thẻ `<a href>` gần nhất bao quanh chỗ bấm; `null` khi bấm ngoài link. */
  anchor: { href: string; target: string; hasDownload: boolean } | null;
  /** `location.href` lúc bấm. */
  current: string;
}

/** Đường cần hỏi trước khi đi (pathname + query + hash), hoặc `null` = cứ để đi. */
export function leaveTarget(click: LeaveClick): string | null {
  const { anchor } = click;
  if (!click.dirty || click.defaultPrevented || anchor === null) return null;
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) {
    return null;
  }
  if ((anchor.target !== '' && anchor.target !== '_self') || anchor.hasDownload) return null;

  const here = new URL(click.current);
  const next = new URL(anchor.href, here);
  if (next.origin !== here.origin) return null;
  // Chỉ đổi #hash (link trong khung readiness trỏ tới một ô của CHÍNH trang này).
  if (next.pathname === here.pathname && next.search === here.search) return null;
  return `${next.pathname}${next.search}${next.hash}`;
}
```

  Chạy lại → xanh. Đột biến: bỏ vế `click.ctrlKey` (ca Ctrl đỏ); bỏ dòng so
  `origin` (ca link ngoài đỏ); bỏ dòng so pathname/search (ca `#hash` đỏ).

- [ ] **Bước 4: Test đỏ cho `ListEditor`** — `components/kit/list-editor.spec.tsx`.
  Dựng một harness giữ state để `onChange` thật sự đổi danh sách:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { type Keyed, newItemKey } from '@/lib/list-editor';
import { ListEditor } from './list-editor';

interface Line extends Keyed {
  text: string;
}

function Harness({ initial, max = 3 }: { initial: string[]; max?: number }) {
  const [items, setItems] = useState<Line[]>(initial.map((text) => ({ key: newItemKey(), text })));
  return (
    <>
      <ListEditor
        items={items}
        onChange={setItems}
        max={max}
        newItem={() => ({ key: newItemKey(), text: '' })}
        addLabel="Add highlight"
        itemName={(index) => `highlight ${index + 1}`}
        renderItem={(item, index) => (
          <input
            aria-label={`Highlight ${index + 1}`}
            value={item.text}
            onChange={(event) =>
              setItems((current) =>
                current.map((line) => (line.key === item.key ? { ...line, text: event.target.value } : line)),
              )
            }
          />
        )}
      />
      <output data-testid="order">{items.map((item) => item.text).join('|')}</output>
    </>
  );
}

describe('ListEditor', () => {
  it('dời lên / xuống đổi thứ tự; nút lên của dòng đầu bị khoá nhưng vẫn giữ được tiêu điểm', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Sunset', 'Kayak', 'Cave']} />);

    const up = screen.getByRole('button', { name: 'Move highlight 2 up' });
    await user.click(up);

    expect(screen.getByTestId('order').textContent).toBe('Kayak|Sunset|Cave');
    // Cùng nút DOM (dòng giữ key) — giờ là dòng đầu nên khoá, và tiêu điểm KHÔNG rơi về <body>.
    expect(up).toHaveAttribute('aria-disabled', 'true');
    expect(up).toHaveFocus();
  });

  it('xoá một dòng chuyển tiêu điểm sang nút xoá của dòng thay chỗ nó', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Sunset', 'Kayak']} />);

    await user.click(screen.getByRole('button', { name: 'Remove highlight 1' }));

    expect(screen.getByTestId('order').textContent).toBe('Kayak');
    expect(screen.getByRole('button', { name: 'Remove highlight 1' })).toHaveFocus();
  });

  it('thêm dòng đưa tiêu điểm vào ô đầu tiên của dòng mới; đủ trần thì nút thêm khoá và nói trần', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Sunset', 'Kayak']} max={3} />);

    const add = screen.getByRole('button', { name: 'Add highlight' });
    await user.click(add);

    expect(screen.getByRole('textbox', { name: 'Highlight 3' })).toHaveFocus();
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('You can add up to 3.')).toBeInTheDocument();
    await user.click(add);
    expect(screen.getByTestId('order').textContent).toBe('Sunset|Kayak|');
  });
});
```

- [ ] **Bước 5: Cài `ListEditor`** — `components/kit/list-editor.tsx`. Khung:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import * as React from 'react';
import { type Keyed, moveItem, removeAt } from '@/lib/list-editor';

/**
 * Khung sửa MỘT danh sách của khu làm việc tour (spec F17 §2h): thêm, xoá, lên,
 * xuống, trần số dòng. Nội dung từng dòng do nơi dùng dựng (`renderItem`), vì
 * sáu danh sách có sáu hình dạng dòng khác nhau.
 *
 * Ba luật tiêu điểm — bàn phím không được rơi về `<body>` (bài học 10):
 * - Nút lên/xuống/thêm khoá bằng `focusableWhenDisabled`: dời một dòng lên đầu
 *   thì nút "lên" của nó vừa bị khoá đúng lúc đang được focus.
 * - Xoá một dòng thì tiêu điểm sang nút xoá của dòng thay chỗ, hết dòng thì về
 *   nút thêm.
 * - Thêm dòng thì tiêu điểm vào ô nhập đầu tiên của dòng mới.
 */
const t = messages.admin.listEditor;

export interface ListEditorProps<Item extends Keyed> {
  items: readonly Item[];
  onChange: (items: Item[]) => void;
  max: number;
  newItem: () => Item;
  addLabel: string;
  /** Tên của một dòng cho trình đọc màn hình, vd "highlight 2". */
  itemName: (index: number) => string;
  renderItem: (item: Item, index: number) => React.ReactNode;
  disabled?: boolean;
  /** Câu hiện khi danh sách rỗng. */
  empty?: string;
}

export function ListEditor<Item extends Keyed>(props: ListEditorProps<Item>) {
  const { items, onChange, max, newItem, addLabel, itemName, renderItem, disabled = false, empty } = props;
  const rows = React.useRef(new Map<string, HTMLLIElement>());
  const removeButtons = React.useRef(new Map<string, HTMLButtonElement>());
  const addButton = React.useRef<HTMLButtonElement>(null);
  /** Việc tiêu điểm chờ làm SAU lượt render kế — dòng mới chưa có trong DOM lúc bấm. */
  const [focusAfter, setFocusAfter] = React.useState<
    { kind: 'row' | 'remove'; key: string } | { kind: 'add' } | null
  >(null);

  React.useEffect(() => {
    if (focusAfter === null) return;
    if (focusAfter.kind === 'add') addButton.current?.focus();
    else if (focusAfter.kind === 'remove') removeButtons.current.get(focusAfter.key)?.focus();
    else rows.current.get(focusAfter.key)?.querySelector<HTMLElement>('input, textarea, select')?.focus();
    setFocusAfter(null);
  }, [focusAfter]);

  const full = items.length >= max;

  function add() {
    if (disabled || full) return;
    const item = newItem();
    onChange([...items, item]);
    setFocusAfter({ kind: 'row', key: item.key });
  }

  function remove(index: number) {
    const next = removeAt(items, index);
    onChange(next);
    const successor = next[Math.min(index, next.length - 1)];
    setFocusAfter(successor ? { kind: 'remove', key: successor.key } : { kind: 'add' });
  }

  return (
    <div className="grid gap-3">
      {items.length === 0 && empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
      <ol className="grid gap-3">
        {items.map((item, index) => (
          <li
            key={item.key}
            ref={(node) => {
              if (node) rows.current.set(item.key, node);
              else rows.current.delete(item.key);
            }}
            className="flex items-start gap-2 rounded-md border p-3"
          >
            <div className="grid flex-1 gap-3">{renderItem(item, index)}</div>
            <div className="flex shrink-0 gap-1">
              {/* Ba nút icon; `aria-label` ghép tên dòng. Dòng đầu khoá "lên", dòng cuối khoá "xuống". */}
              {/* …Button variant="ghost" size="icon" focusableWhenDisabled disabled={disabled || index === 0}
                   aria-label={t.moveUp(itemName(index))} onClick={() => onChange(moveItem(items, index, index - 1))} … */}
              {/* …tương tự moveDown (index === items.length - 1) và remove (ref vào removeButtons) … */}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3">
        <Button
          ref={addButton}
          type="button"
          variant="outline"
          focusableWhenDisabled
          disabled={disabled || full}
          onClick={add}
        >
          <PlusIcon aria-hidden="true" />
          {addLabel}
        </Button>
        {full ? (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {t.limit(max)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
```

  Chỗ `{/* … */}` là ba `<Button>` viết đủ theo mô tả trong chú thích — viết
  thật, không để chú thích. Kiểm `Button` của kit UI nhận `ref`/`size="icon"`
  (đọc `libs/shared/ui/src/components/button.tsx`); icon mang `aria-hidden`.
  Chạy spec → xanh. Đột biến: bỏ `focusableWhenDisabled` ở nút lên (ca đầu đỏ ở
  `toHaveFocus`); bỏ `setFocusAfter` ở `remove` (ca xoá đỏ).

- [ ] **Bước 6: Test đỏ cho provider** — `components/kit/unsaved-changes.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesProvider, useReportUnsaved } from './unsaved-changes';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

function Form({ dirty }: { dirty: boolean }) {
  useReportUnsaved(dirty);
  return <p>form</p>;
}

function Page({ dirty, showForm = true }: { dirty: boolean; showForm?: boolean }) {
  return (
    <UnsavedChangesProvider>
      <a href="/tours/ha-long/itinerary">Itinerary</a>
      {showForm ? <Form dirty={dirty} /> : null}
    </UnsavedChangesProvider>
  );
}

beforeEach(() => push.mockReset());

describe('UnsavedChangesProvider', () => {
  it('có thay đổi mà bấm link nội bộ → hỏi, chưa đi đâu cả', async () => {
    const user = userEvent.setup();
    render(<Page dirty />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));

    expect(screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('Discard changes → đi đúng đường vừa bấm', async () => {
    const user = userEvent.setup();
    render(<Page dirty />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(push).toHaveBeenCalledWith('/tours/ha-long/itinerary');
  });

  it('Keep editing → đóng hộp, ở lại', async () => {
    const user = userEvent.setup();
    render(<Page dirty />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('không có thay đổi → không hỏi', async () => {
    const user = userEvent.setup();
    render(<Page dirty={false} />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('form gỡ khỏi trang thì thôi báo thay đổi', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Page dirty />);
    rerender(<Page dirty showForm={false} />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('có thay đổi thì beforeunload bị chặn; không có thì không', () => {
    const { rerender } = render(<Page dirty />);
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    rerender(<Page dirty={false} />);
    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
  });
});
```

- [ ] **Bước 7: Cài provider** — `components/kit/unsaved-changes.tsx`:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@tourism/ui/components/alert-dialog';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { leaveTarget } from '@/lib/unsaved-changes';

/**
 * Hỏi lại trước khi rời một tab còn thay đổi chưa lưu (spec F17 §2i).
 *
 * Bọc CẢ khu làm việc (đầu trang, thanh tab, nội dung), không chỉ form: link rời
 * trang nằm ở thanh tab, ở khung readiness, ở nút Back và ở sidebar — nên
 * provider nghe cú bấm ở `document`, pha CAPTURE, tức TRƯỚC `onClick` của
 * `next/link` (React gắn listener ở root, nằm dưới `document`). Chặn ở đó là
 * link không điều hướng; "Discard changes" thì tự `router.push` tới đúng đường.
 *
 * Rời hẳn trang (đóng tab, gõ địa chỉ, link ra ngoài) là việc của
 * `beforeunload`. Nút Back của trình duyệt không qua đường nào trong hai đường
 * này — giới hạn đã biết, ghi ở báo cáo bàn giao F17.
 */
const t = messages.admin.unsavedChanges;

const UnsavedContext = React.createContext<{ setDirty: (dirty: boolean) => void } | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [dirty, setDirty] = React.useState(false);
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Trình duyệt cũ chỉ hỏi khi `returnValue` được đặt.
      event.returnValue = '';
    };
    const onClick = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      const href = leaveTarget({
        dirty: true,
        defaultPrevented: event.defaultPrevented,
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        anchor: anchor
          ? { href: anchor.href, target: anchor.target, hasDownload: anchor.hasAttribute('download') }
          : null,
        current: window.location.href,
      });
      if (href === null) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const context = React.useMemo(() => ({ setDirty }), []);

  function discard() {
    const href = pendingHref;
    setPendingHref(null);
    setDirty(false);
    if (href !== null) router.push(href);
  }

  return (
    <UnsavedContext.Provider value={context}>
      {children}
      <AlertDialog
        open={pendingHref !== null}
        onOpenChange={(open) => {
          if (!open) setPendingHref(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.title}</AlertDialogTitle>
            <AlertDialogDescription>{t.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.keep}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discard}>
              {t.discard}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedContext.Provider>
  );
}

/** Form báo "đang có thay đổi chưa lưu"; gỡ khỏi trang thì tự rút. Ngoài provider thì không làm gì. */
export function useReportUnsaved(dirty: boolean): void {
  const context = React.useContext(UnsavedContext);
  React.useEffect(() => {
    context?.setDirty(dirty);
    return () => context?.setDirty(false);
  }, [context, dirty]);
}
```

  Prop `variant` của `AlertDialogAction` và tên thật của các export: đọc
  `libs/shared/ui/src/components/alert-dialog.tsx` rồi chỉnh cho khớp. Chạy spec
  → xanh. Đột biến: bỏ `true` (capture) ở `addEventListener` — ca "hỏi" đỏ nếu
  `next/link` điều hướng trước (trong test không có Link thì ghi rõ đột biến
  không giết được, và vì sao); bỏ cleanup trong `useReportUnsaved` (ca "form gỡ"
  đỏ).

- [ ] **Bước 8: Gate + commit.**

```bash
git add apps/admin/src/lib/list-editor.ts apps/admin/src/lib/list-editor.spec.ts apps/admin/src/components/kit/list-editor.tsx apps/admin/src/components/kit/list-editor.spec.tsx apps/admin/src/lib/unsaved-changes.ts apps/admin/src/lib/unsaved-changes.spec.ts apps/admin/src/components/kit/unsaved-changes.tsx apps/admin/src/components/kit/unsaved-changes.spec.tsx libs/shared/i18n/src/lib/messages.ts
git commit -m "feat(admin): kit sửa danh sách và hỏi lại khi rời trang còn thay đổi"
```

---

## Task 9 — Admin: client API, VM thuần và logic ghi của khu làm việc

Toàn bộ luật của khu làm việc sống ở hai file THUẦN; component ở Task 10–12
chỉ ghép.

**Files:**

- Modify: `apps/admin/src/lib/api/tours.ts` + `tours.spec.ts`
- Create: `apps/admin/src/lib/tour-editor-view.ts` + `tour-editor-view.spec.ts`
- Create: `apps/admin/src/lib/tour-editor-write.ts` + `tour-editor-write.spec.ts`
- Create: `apps/admin/src/test/tour-detail.ts` (fixture test dùng chung)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `admin.tours.editor` — phần
  lỗi, validate, readiness, chi phí)

**Interfaces:**

- Consumes: Task 1, 3, 4 (contract); Task 8 (`Keyed`, `newItemKey`);
  `createWriteErrorCodec`, `TransportFailureCode`.
- Produces:
  - `api/tours.ts`: `fetchAdminTour(cookie, slug): Promise<AdminTourDetail | null>` ·
    `interface TourDestinationOption { id: string; name: string; isActive: boolean }` ·
    `fetchTourDestinationOptions(cookie): Promise<TourDestinationOption[]>` (nuốt
    lỗi → `[]`, cho trang Tours) · `fetchTourEditorOptions(cookie): Promise<TourEditorOptions>`
    (KHÔNG nuốt lỗi) với `interface TourEditorOptions { categories: TourCategoryOption[]; destinations: TourDestinationOption[] }`
    · `createAdminTour` · `updateAdminTourDetails` · `setAdminTourItinerary` ·
    `setAdminTourFaqsPolicies` · `setAdminTourCosts` · `deleteAdminTour` (mỗi hàm
    `(cookie, input)` bọc mỏng `api.admin.tours.*`).
  - `tour-editor-view.ts`: `type TourEditorTab` · `TOUR_EDITOR_TABS` ·
    `tourTabHref(slug, tab)` · `activeTourTab(pathname, slug)` · `formatDayList(days)`
    · `interface ReadinessIssue { key: 'summary' | 'primaryDestination' | 'days'; label: string; href: string }`
    · `readinessIssues(readiness, slug)` · `removedItineraryDays(itinerary, nextDurationDays)`
    · `interface CostBreakdown` · `costBreakdown(items, basePrice, maxGroupSize)` ·
    `projectedReadiness(detail, patch)` · `optionLabel(option)`.
  - `tour-editor-write.ts`: codec của sáu lệnh (`classify…Error`, `…ErrorCopy`,
    `…_CONTRACT_CODES`, type `…ContractCode`) · `type EditorWriteResult<Code>` ·
    `type CreateTourResult` · kiểu action của sáu lệnh · giá trị form, validator,
    payload của hộp New tour và bốn tab (tên ở từng mục dưới).

- [ ] **Bước 1: Copy** — thêm `editor` vào `messages.admin.tours` (cạnh `list`,
  `publish`). Phần này là copy mà hai file thuần đọc; Task 10–12 thêm nhãn ô.
  Câu nào hứa hệ quả đã đo trên code (ghi nguồn ở comment):

```ts
      /**
       * Khu làm việc của MỘT tour (spec F17). Chữ đăng bán là On sale / Off sale;
       * KHÔNG "Draft", "Publish", "Active" (bài học 20 của P4e-2).
       */
      editor: {
        saved: 'Changes saved',
        save: 'Save changes',
        saving: 'Saving…',
        readiness: {
          ready: 'Ready to sell',
          readyBody: 'Everything a guest needs is filled in.',
          missingTitle: 'Missing before it can go on sale:',
          summary: 'A summary',
          primaryDestination: 'A primary destination',
          /** `list` từ `formatDayList`: "3", "3–5", "2, 4–6". */
          days: (list: string, count: number) =>
            count === 1 ? `An itinerary for day ${list}` : `An itinerary for days ${list}`,
        },
        banners: {
          stale:
            'Someone else saved this tour while you were editing. Reload to see their version — the changes on this tab will be lost.',
          reload: 'Reload',
          /** Dải của TOUR_NOT_READY: liệt kê chỗ thiếu như khung readiness. */
          notReady: 'This tour is on sale, so it has to stay ready to sell. This change would leave it missing:',
          /** Server nói thiếu mà bản dự tính ở trình duyệt thấy đủ — một lệnh khác vừa chen vào. */
          notReadyUnknown: 'This tour is on sale, so it has to stay ready to sell. Reload to see what changed.',
        },
        form: {
          errors: {
            required: 'Fill this in.',
            tooLong: (max: number) => `Keep it to ${max} characters or fewer.`,
            wholeNumber: (min: number, max: number) => `Enter a whole number from ${min} to ${max}.`,
            price: 'Enter an amount like 129 or 129.50.',
            priceAboveZero: 'Enter an amount above zero.',
            slugShape: SLUG_SHAPE_COPY,
            chooseCategory: 'Choose a category.',
            chooseDestination: 'Choose a destination.',
            duplicateDestination: 'This destination is already on the list.',
            emptyLine: 'Fill this line in, or remove it.',
            /** Tour đang bán luôn phải đủ để bán (ADR-0047 §4). */
            summaryOnSale: 'A tour on sale needs a summary. Take it off sale first to clear it.',
            /** Ngày mới chưa có lịch trình → tour thiếu; đo: `tourReadiness` đếm ngày 1..N. */
            addDaysOnSale: 'A tour on sale needs an itinerary for every day. Take it off sale before adding days.',
            durationLocked: 'Locked — this tour has departures.',
            groupFloor: (seats: number) =>
              `At least ${seats} — the largest departure has ${seats} seats.`,
            dayTitleOnSale: 'A tour on sale needs a title for every day.',
            /** Ngày không tiêu đề thì không có hàng (spec §2b.3) — mô tả của nó sẽ mất. */
            descriptionWithoutTitle: 'Add a title for this day, or clear its description.',
          },
        },
        create: {
          errors: {
            SLUG_TAKEN: 'Another tour already uses this slug. Pick a different one.',
            NOT_FOUND: 'That category or destination no longer exists. Close this and try again.',
          },
        },
        details: {
          errors: {
            STALE_TOUR: 'Someone else saved this tour while you were editing.',
            DURATION_LOCKED: 'This tour has departures, so its number of days is locked.',
            GROUP_SIZE_BELOW_SEATS: 'A departure has more seats than this group size.',
            TOUR_NOT_READY: 'This tour is on sale, so it has to stay ready to sell.',
            NOT_FOUND: 'This tour no longer exists.',
          },
        },
        itinerary: {
          errors: {
            STALE_TOUR: 'Someone else saved this tour while you were editing.',
            TOUR_NOT_READY: 'This tour is on sale, so it has to stay ready to sell.',
            NOT_FOUND: 'This tour no longer exists.',
          },
        },
        content: {
          errors: {
            STALE_TOUR: 'Someone else saved this tour while you were editing.',
            NOT_FOUND: 'This tour no longer exists.',
          },
        },
        costs: {
          errors: {
            STALE_TOUR: 'Someone else saved this tour while you were editing.',
            NOT_FOUND: 'This tour no longer exists.',
          },
        },
        delete: {
          errors: {
            TOUR_HAS_BOOKINGS: 'This tour has bookings now, so it cannot be deleted. Take it off sale instead.',
            NOT_FOUND: 'This tour no longer exists.',
          },
        },
      },
```

  `SLUG_SHAPE_COPY` là hằng sẵn có trong `messages.ts` (khối danh mục/điểm đến
  dùng). Đổi luôn câu `publish.errors.TOUR_NOT_READY` của Task 4 nếu cần cho khớp
  giọng — không đổi nghĩa.

- [ ] **Bước 2: Client API** — `lib/api/tours.ts`, thêm (khuôn `fetchAdminDepartures`
  cho nhánh `NOT_FOUND → null`, import `isDefinedError`, `safe` từ `@orpc/client`):

```ts
/** Một tour cho khu làm việc; `null` khi slug không có (trang gọi `notFound()`). */
export async function fetchAdminTour(cookie: string, slug: string): Promise<AdminTourDetail | null> {
  const [error, data] = await safe(api.admin.tours.get({ slug }, { context: withAdminAuth(cookie) }));
  if (error) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  return data;
}

export interface TourDestinationOption {
  id: string;
  name: string;
  /** Điểm đến đã ẩn vẫn chọn được, mang dấu "(hidden)" (spec §2b.4). */
  isActive: boolean;
}

export interface TourEditorOptions {
  categories: TourCategoryOption[];
  destinations: TourDestinationOption[];
}

/**
 * Điểm đến cho hộp New tour ở trang Tours — hỏng thì RỖNG, cùng luật
 * `fetchTourCategories`: hộp tạo mất danh sách là phiền, bảng tour mất đi là hỏng việc.
 */
export async function fetchTourDestinationOptions(cookie: string): Promise<TourDestinationOption[]> {
  return api.admin.destinations
    .list(undefined, { context: withAdminAuth(cookie) })
    .then((rows) => rows.map((row) => ({ id: row.id, name: row.name, isActive: row.isActive })))
    .catch(() => [] as TourDestinationOption[]);
}

/**
 * Hai danh sách chọn của khu làm việc — KHÔNG nuốt lỗi, khác bảng Tours: ô chọn
 * rỗng trong một form SỬA là mời admin lưu đè danh mục của tour bằng một ô
 * trống. Hỏng thì trang lỗi của app, không phải một form nói sai.
 */
export async function fetchTourEditorOptions(cookie: string): Promise<TourEditorOptions> {
  const context = { context: withAdminAuth(cookie) };
  const [categories, destinations] = await Promise.all([
    api.admin.categories.list(undefined, context),
    api.admin.destinations.list(undefined, context),
  ]);
  return {
    categories: categories.map((row) => ({ id: row.id, name: row.name, isActive: row.isActive })),
    destinations: destinations.map((row) => ({ id: row.id, name: row.name, isActive: row.isActive })),
  };
}
```

  và sáu hàm ghi bọc mỏng, ví dụ:

```ts
export async function updateAdminTourDetails(
  cookie: string,
  input: AdminTourDetailsInput,
): Promise<AdminTourDetail> {
  return api.admin.tours.updateDetails(input, { context: withAdminAuth(cookie) });
}
```

  (`createAdminTour` → `AdminTourCreateResult`; `setAdminTourItinerary`,
  `setAdminTourFaqsPolicies`, `setAdminTourCosts` → `AdminTourDetail`;
  `deleteAdminTour` → `AdminTourDeleteResult`.) Test ở `tours.spec.ts` theo khuôn
  ca sẵn có: `fetchAdminTour` trả `null` với `ORPCError` ĐÃ KHAI mã `NOT_FOUND`,
  ném lại với lỗi khác (và với `ORPCError('NOT_FOUND')` KHÔNG khai — dựng bằng
  `new ORPCError('NOT_FOUND')` không `defined`); `fetchTourDestinationOptions`
  trả `[]` khi API hỏng; `fetchTourEditorOptions` ném khi API hỏng.

- [ ] **Bước 3: Test đỏ cho VM** — `tour-editor-view.spec.ts`. Các ca (viết đủ,
  khớp chữ chính xác — bài học 9):

```ts
import { tourReadiness } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import {
  activeTourTab,
  costBreakdown,
  formatDayList,
  projectedReadiness,
  readinessIssues,
  removedItineraryDays,
  tourTabHref,
} from './tour-editor-view';
import { detailFixture } from '@/test/tour-detail';

describe('tab của khu làm việc', () => {
  it('đường của từng tab; Details là gốc /tours/[slug]', () => {
    expect(tourTabHref('ha-long', 'details')).toBe('/tours/ha-long');
    expect(tourTabHref('ha-long', 'itinerary')).toBe('/tours/ha-long/itinerary');
    expect(tourTabHref('ha-long', 'content')).toBe('/tours/ha-long/content');
    expect(tourTabHref('ha-long', 'costs')).toBe('/tours/ha-long/costs');
    expect(tourTabHref('ha-long', 'departures')).toBe('/tours/ha-long/departures');
  });

  it('tab đang mở đọc từ pathname', () => {
    expect(activeTourTab('/tours/ha-long', 'ha-long')).toBe('details');
    expect(activeTourTab('/tours/ha-long/costs', 'ha-long')).toBe('costs');
    expect(activeTourTab('/tours/ha-long/departures', 'ha-long')).toBe('departures');
  });
});

describe('formatDayList', () => {
  it.each<[number[], string]>([
    [[3], '3'],
    [[3, 4, 5], '3–5'],
    [[2, 4, 5, 6], '2, 4–6'],
    [[1, 2, 4, 6, 7], '1–2, 4, 6–7'],
  ])('%j → %s', (days, text) => {
    expect(formatDayList(days)).toBe(text);
  });
});

describe('readinessIssues', () => {
  it('đủ thì rỗng; thiếu thì mỗi mục một link tới đúng tab và đúng ô', () => {
    const ready = tourReadiness({ summary: 'x', destinations: [{ isPrimary: true }], durationDays: 1, itineraryDays: [1] });
    expect(readinessIssues(ready, 'ha-long')).toEqual([]);

    const missing = tourReadiness({ summary: null, destinations: [], durationDays: 4, itineraryDays: [1] });
    expect(readinessIssues(missing, 'ha-long')).toEqual([
      { key: 'summary', label: 'A summary', href: '/tours/ha-long#tour-summary' },
      { key: 'primaryDestination', label: 'A primary destination', href: '/tours/ha-long#tour-destinations' },
      { key: 'days', label: 'An itinerary for days 2–4', href: '/tours/ha-long/itinerary#day-2' },
    ]);
  });

  it('một ngày thì nói "day", không "days"', () => {
    const one = tourReadiness({ summary: 'x', destinations: [{ isPrimary: true }], durationDays: 2, itineraryDays: [1] });
    expect(readinessIssues(one, 'ha-long')[0]?.label).toBe('An itinerary for day 2');
  });
});

describe('removedItineraryDays', () => {
  it('chỉ kể ngày ĐANG có hàng vượt số ngày mới', () => {
    const itinerary = [{ dayNumber: 1 }, { dayNumber: 2 }, { dayNumber: 4 }];
    expect(removedItineraryDays(itinerary, 2)).toEqual([4]);
    expect(removedItineraryDays(itinerary, 1)).toEqual([2, 4]);
    expect(removedItineraryDays(itinerary, 5)).toEqual([]);
  });
});

describe('costBreakdown', () => {
  it('ba con số của contract, cộng biên lời so với giá gốc', () => {
    const items = [
      { amount: '30.00', basis: 'PER_PERSON' as const },
      { amount: '400.00', basis: 'PER_DEPARTURE' as const },
    ];
    expect(costBreakdown(items, '100.00', 20)).toEqual({
      perPerson: '30.00',
      perDeparture: '400.00',
      costPrice: '50.00',
      margin: { amount: '50.00', percent: 50 },
    });
  });

  it('không có dòng chi phí thì giá vốn và biên lời là null — tour chưa khai giá vốn', () => {
    expect(costBreakdown([], '100.00', 20)).toEqual({
      perPerson: '0.00',
      perDeparture: '0.00',
      costPrice: null,
      margin: null,
    });
  });

  it('lỗ thì biên lời âm, không kẹp về 0', () => {
    const items = [{ amount: '120.00', basis: 'PER_PERSON' as const }];
    expect(costBreakdown(items, '100.00', 10).margin).toEqual({ amount: '-20.00', percent: -20 });
  });
});

describe('projectedReadiness', () => {
  it('giảm số ngày thì bỏ ngày vượt khỏi phép đếm, tăng thì thêm ngày thiếu', () => {
    const detail = detailFixture({ durationDays: 3, itinerary: [1, 2, 3].map((n) => ({ dayNumber: n, title: `D${n}`, description: null })) });

    expect(projectedReadiness(detail, { durationDays: 2 }).missingDays).toEqual([]);
    expect(projectedReadiness(detail, { durationDays: 5 }).missingDays).toEqual([4, 5]);
    expect(projectedReadiness(detail, { summary: '  ' }).summary).toBe(false);
    expect(projectedReadiness(detail, { itineraryDays: [1] }).missingDays).toEqual([2, 3]);
  });
});
```

  `detailFixture(patch)` là helper test DÙNG CHUNG cho mọi spec admin của F17 —
  tạo `apps/admin/src/test/tour-detail.ts` (cạnh `test/departure-row.ts`, nơi
  admin để fixture test): trả một `AdminTourDetail` hợp lệ (parse qua
  `AdminTourDetailSchema` trong chính helper) — tour 3 ngày đang bán, đủ để bán,
  một điểm chính, không chuyến, không booking — đè bằng `patch`.

- [ ] **Bước 4: Cài VM** — `tour-editor-view.ts`:

```ts
import {
  type AdminTourDetail,
  type CostItemLike,
  derivedCostPrice,
  fromCents,
  perDepartureTotal,
  perPersonTotal,
  type TourReadiness,
  toCents,
  tourReadiness,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * VM THUẦN của khu làm việc tour (spec F17 §2g–§2i) — mọi phép tính mà component
 * cần mà không phải chuyện hiển thị: đường của tab, danh sách thiếu của khung
 * readiness, ngày lịch trình sẽ bị xoá, tổng chi phí tính ngay khi gõ.
 */
const t = messages.admin.tours.editor;

export type TourEditorTab = 'details' | 'itinerary' | 'content' | 'costs' | 'departures';

export const TOUR_EDITOR_TABS: readonly TourEditorTab[] = [
  'details',
  'itinerary',
  'content',
  'costs',
  'departures',
];

export function tourTabHref(slug: string, tab: TourEditorTab): string {
  const base = `/tours/${encodeURIComponent(slug)}`;
  return tab === 'details' ? base : `${base}/${tab}`;
}

export function activeTourTab(pathname: string, slug: string): TourEditorTab {
  const rest = pathname.slice(tourTabHref(slug, 'details').length).replace(/^\//, '');
  const segment = rest.split('/')[0] ?? '';
  return (TOUR_EDITOR_TABS as readonly string[]).includes(segment)
    ? (segment as TourEditorTab)
    : 'details';
}

/** [2, 4, 5, 6] → "2, 4–6". Đầu vào đã sắp tăng dần (như `missingDays`). */
export function formatDayList(days: readonly number[]): string {
  const parts: string[] = [];
  let start = days[0];
  let previous = days[0];
  for (const day of [...days.slice(1), Number.NaN]) {
    if (previous !== undefined && day === previous + 1) {
      previous = day;
      continue;
    }
    if (start !== undefined && previous !== undefined) {
      parts.push(start === previous ? `${start}` : `${start}–${previous}`);
    }
    start = day;
    previous = day;
  }
  return parts.join(', ');
}

export interface ReadinessIssue {
  key: 'summary' | 'primaryDestination' | 'days';
  label: string;
  /** Tab cần sửa, kèm `#id` của ô (ô tóm tắt, khung điểm đến, thẻ ngày đầu tiên thiếu). */
  href: string;
}

export function readinessIssues(readiness: TourReadiness, slug: string): ReadinessIssue[] {
  const details = tourTabHref(slug, 'details');
  const issues: ReadinessIssue[] = [];
  if (!readiness.summary) {
    issues.push({ key: 'summary', label: t.readiness.summary, href: `${details}#tour-summary` });
  }
  if (!readiness.primaryDestination) {
    issues.push({
      key: 'primaryDestination',
      label: t.readiness.primaryDestination,
      href: `${details}#tour-destinations`,
    });
  }
  const [firstMissing] = readiness.missingDays;
  if (firstMissing !== undefined) {
    issues.push({
      key: 'days',
      label: t.readiness.days(formatDayList(readiness.missingDays), readiness.missingDays.length),
      href: `${tourTabHref(slug, 'itinerary')}#day-${firstMissing}`,
    });
  }
  return issues;
}

/** Ngày ĐANG có hàng sẽ bị xoá khi hạ số ngày xuống `nextDurationDays` (spec §2b.1). */
export function removedItineraryDays(
  itinerary: readonly { dayNumber: number }[],
  nextDurationDays: number,
): number[] {
  return itinerary
    .map((day) => day.dayNumber)
    .filter((dayNumber) => dayNumber > nextDurationDays)
    .sort((a, b) => a - b);
}

export interface CostBreakdown {
  perPerson: string;
  perDeparture: string;
  /** Giá vốn mỗi khách khi đủ đoàn; `null` khi chưa có dòng chi phí nào. */
  costPrice: string | null;
  /** Giá gốc − giá vốn, kèm phần trăm của giá gốc (làm tròn số nguyên); có thể âm. */
  margin: { amount: string; percent: number } | null;
}

/** Tổng chi phí tính NGAY khi gõ, bằng chính ba hàm của contract mà API gọi lúc lưu. */
export function costBreakdown(
  items: readonly CostItemLike[],
  basePrice: string,
  maxGroupSize: number,
): CostBreakdown {
  const costPrice = items.length > 0 ? derivedCostPrice(items, maxGroupSize) : null;
  const base = toCents(basePrice);
  const margin =
    costPrice === null || base <= 0
      ? null
      : (() => {
          const cents = base - toCents(costPrice);
          return { amount: signedCents(cents), percent: Math.round((cents / base) * 100) };
        })();
  return { perPerson: perPersonTotal(items), perDeparture: perDepartureTotal(items), costPrice, margin };
}

/** `fromCents` chỉ nhận số không âm theo nghĩa tiền; biên lời thì có thể âm. */
function signedCents(cents: number): string {
  return cents < 0 ? `-${fromCents(-cents)}` : fromCents(cents);
}

/**
 * Readiness NẾU lệnh sửa đang soạn đi qua — nuôi dải TOUR_NOT_READY và luật "tour
 * đang bán" phía form. Giảm số ngày thì ngày vượt bị xoá theo (spec §2b.1) nên
 * không còn được đếm.
 */
export function projectedReadiness(
  detail: AdminTourDetail,
  patch: {
    summary?: string | null;
    destinations?: readonly { isPrimary: boolean }[];
    durationDays?: number;
    itineraryDays?: readonly number[];
  },
): TourReadiness {
  const durationDays = patch.durationDays ?? detail.durationDays;
  const days = patch.itineraryDays ?? detail.itinerary.map((day) => day.dayNumber);
  return tourReadiness({
    summary: patch.summary === undefined ? detail.summary : patch.summary,
    destinations: patch.destinations ?? detail.destinations,
    durationDays,
    itineraryDays: days.filter((day) => day <= durationDays),
  });
}

/** Nhãn một mục trong ô chọn danh mục/điểm đến — mục đã ẩn mang dấu "(hidden)". */
export function optionLabel(option: { name: string; isActive: boolean }): string {
  return option.isActive ? option.name : messages.admin.tours.list.categoryHidden(option.name);
}
```

  Chạy spec → xanh. Đột biến: `formatDayList` bỏ nhánh gộp (ca `3–5` đỏ);
  `removedItineraryDays` dùng `>=` (ca đầu đỏ); `projectedReadiness` bỏ `filter`
  (ca giảm số ngày đỏ); `costBreakdown` kẹp biên lời về 0 (ca lỗ đỏ).

- [ ] **Bước 5: Test đỏ cho logic ghi** — `tour-editor-write.spec.ts`. Nhóm ca:
  1. **Tập mã của sáu codec khớp ĐÚNG `errorMap` của contract** (khuôn
     `categories-write.spec.ts` dòng 33–45): create, updateDetails, setItinerary,
     setFaqsPolicies, setCosts, delete.
  2. **Hộp New tour:** `newTourFormValues()` toàn chuỗi rỗng; `validateTourCreateForm`
     bắt: tên trống/201 ký tự; slug trống, sai khuôn (`'Ha Long'`), 121 ký tự; chưa
     chọn danh mục; chưa chọn điểm đến; số ngày `''`, `'0'`, `'31'`, `'2.5'`, `'abc'`
     (và `'1'`, `'30'` qua); số khách `'0'`, `'101'` (và `'1'`, `'100'` qua); giá
     `''`, `'0'`, `'1.234'` (và `'0.01'` qua). `tourCreatePayload` đổi số ngày/số
     khách ra số, cắt khoảng trắng.
  3. **Tab Details** (gốc `detailFixture()` đang bán, 3 ngày, đủ):
     - `detailsFormValues(detail)` rồi `tourDetailsPayload(id, version, values)`
       ra đúng input tương đương (round-trip) — mảng dòng bỏ `key`.
     - Tóm tắt trống khi ĐANG bán → `summaryOnSale`; khi tắt bán → không lỗi.
     - Tăng số ngày khi đang bán → `addDaysOnSale`; giảm → không lỗi.
     - `departureCount > 0` mà đổi số ngày → `durationLocked`.
     - `liveSeatsMax: 12` mà số khách `'11'` → `groupFloor(12)`; `'12'` qua.
     - Hai dòng cùng điểm đến → lỗi `duplicateDestination` ở dòng SAU; dòng chưa
       chọn → `chooseDestination`.
     - Dòng điểm nổi bật trống → `emptyLine`; dòng 201 ký tự → `tooLong(200)`.
     - Điểm hẹn 301, ghi chú dữ kiện 281 → `tooLong`.
  4. **Tab Itinerary:** `itineraryFormValues(detail)` dài đúng `durationDays`,
     ngày chưa có hàng thành ô trống; `itineraryPayload` chỉ gửi ngày có tiêu đề,
     `description` trống thành `null`; đang bán mà một tiêu đề trống →
     `dayTitleOnSale` ở đúng ngày; tắt bán thì không; có mô tả mà không tiêu đề →
     `descriptionWithoutTitle`.
  5. **Tab FAQ & policies** và **Costs:** mỗi ô bắt buộc trống → `required`; trần
     N/N+1 của từng ô; số tiền `'-1'`, `'1.234'`, `'abc'` → `price`; `'0'` qua;
     payload giữ thứ tự và bỏ `key`; `costDraftItems(values)` chỉ trả dòng có số
     tiền hợp lệ (để tổng ở màn Costs không nhảy `NaN` khi đang gõ dở).

- [ ] **Bước 6: Cài logic ghi** — `tour-editor-write.ts`. Khung và phần có luật;
  phần còn lại viết theo đúng khuôn `destinations-write.ts`:

```ts
import {
  type AdminTourCostsInput,
  type AdminTourCreateInput,
  type AdminTourCreateResult,
  type AdminTourDeleteInput,
  type AdminTourDeleteResult,
  type AdminTourDetail,
  type AdminTourDetailsInput,
  type AdminTourFaqsPoliciesInput,
  type AdminTourItineraryInput,
  DeparturePriceSchema,
  SLUG_PATTERN,
  TOUR_COST_LABEL_MAX,
  TOUR_DAY_DESCRIPTION_MAX,
  TOUR_DAY_TITLE_MAX,
  TOUR_DESTINATIONS_MAX,
  TOUR_DURATION_MAX,
  TOUR_FACT_NOTE_MAX,
  TOUR_FAQ_ANSWER_MAX,
  TOUR_FAQ_QUESTION_MAX,
  TOUR_GROUP_MAX,
  TOUR_LIST_ITEM_MAX,
  TOUR_MEETING_POINT_MAX,
  TOUR_POLICY_BODY_MAX,
  TOUR_POLICY_TITLE_MAX,
  TOUR_SLUG_MAX,
  TOUR_SUMMARY_MAX,
  TOUR_TITLE_MAX,
  TourBasePriceSchema,
  type TourBadge,
  type TourCostBasis,
  type TourCostCategory,
  type TourDifficulty,
  type TravellerType,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import { type Keyed, newItemKey } from './list-editor';

/**
 * Logic THUẦN của sáu hành vi ghi của khu làm việc tour (spec F17) — cùng khuôn
 * `destinations-write.ts`: codec lỗi derive từ khối i18n, hợp đồng vận chuyển của
 * server action, giá trị thô của form, validator soi gương contract, payload.
 *
 * Validator KHÔNG tự chế trần: mọi con số là hằng của contract (bài học 12).
 * Luật "tour đang bán" (ADR-0047 §4) cũng soi gương ở đây để admin thấy lỗi dưới
 * đúng ô trước khi bấm Save; server vẫn là trọng tài cuối.
 */
const e = messages.admin.tours.editor;
const fe = e.form.errors;

// ── Codec ───────────────────────────────────────────────────────────────────

const createCodec = createWriteErrorCodec(e.create.errors);
const detailsCodec = createWriteErrorCodec(e.details.errors);
const itineraryCodec = createWriteErrorCodec(e.itinerary.errors);
const contentCodec = createWriteErrorCodec(e.content.errors);
const costsCodec = createWriteErrorCodec(e.costs.errors);
/** Xoá đi qua `ConfirmWriteDialog`: `NOT_FOUND` là trạng-thái-cũ (đóng + toast + về /tours). */
const deleteCodec = createWriteErrorCodec(e.delete.errors, { stale: ['NOT_FOUND'] });

export type CreateTourContractCode = keyof typeof e.create.errors;
export type DetailsContractCode = keyof typeof e.details.errors;
export type ItineraryContractCode = keyof typeof e.itinerary.errors;
export type ContentContractCode = keyof typeof e.content.errors;
export type CostsContractCode = keyof typeof e.costs.errors;
export type DeleteTourContractCode = keyof typeof e.delete.errors;

export const CREATE_TOUR_CONTRACT_CODES = createCodec.codes;
export const DETAILS_CONTRACT_CODES = detailsCodec.codes;
export const ITINERARY_CONTRACT_CODES = itineraryCodec.codes;
export const CONTENT_CONTRACT_CODES = contentCodec.codes;
export const COSTS_CONTRACT_CODES = costsCodec.codes;
export const DELETE_TOUR_CONTRACT_CODES = deleteCodec.codes;

export const classifyCreateTourError = createCodec.classify;
export const createTourErrorCopy = createCodec.copy;
export const classifyDetailsError = detailsCodec.classify;
export const detailsErrorCopy = detailsCodec.copy;
export const classifyItineraryError = itineraryCodec.classify;
export const itineraryErrorCopy = itineraryCodec.copy;
export const classifyContentError = contentCodec.classify;
export const contentErrorCopy = contentCodec.copy;
export const classifyCostsError = costsCodec.classify;
export const costsErrorCopy = costsCodec.copy;
export const classifyDeleteTourError = deleteCodec.classify;
export const deleteTourErrorCopy = deleteCodec.copy;
export const isDeleteTourStale = deleteCodec.isStale;

// ── Hợp đồng vận chuyển của server action ──────────────────────────────────

/** Bốn lệnh sửa trả NGUYÊN tour server vừa ghi — form lấy `version` mới từ đây. */
export type EditorWriteResult<Code extends string> =
  | { ok: true; detail: AdminTourDetail }
  | { ok: false; code: Code | TransportFailureCode };

export type CreateTourResult =
  | { ok: true; created: AdminTourCreateResult }
  | { ok: false; code: CreateTourContractCode | TransportFailureCode };

export type DeleteTourResult =
  | { ok: true; deleted: AdminTourDeleteResult }
  | { ok: false; code: DeleteTourContractCode | TransportFailureCode };

export type CreateTourAction = (input: AdminTourCreateInput) => Promise<CreateTourResult>;
export type UpdateDetailsAction = (input: AdminTourDetailsInput) => Promise<EditorWriteResult<DetailsContractCode>>;
export type SetItineraryAction = (input: AdminTourItineraryInput) => Promise<EditorWriteResult<ItineraryContractCode>>;
export type SetContentAction = (input: AdminTourFaqsPoliciesInput) => Promise<EditorWriteResult<ContentContractCode>>;
export type SetCostsAction = (input: AdminTourCostsInput) => Promise<EditorWriteResult<CostsContractCode>>;
export type DeleteTourAction = (input: AdminTourDeleteInput) => Promise<DeleteTourResult>;

// ── Ô số và ô tiền ──────────────────────────────────────────────────────────

/** Chuỗi chữ số trần → số; mọi thứ khác (rỗng, "2.5", "abc", "1e2") → NaN. */
export function parseWholeNumber(text: string): number {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
}

function wholeNumberError(text: string, min: number, max: number): string | undefined {
  const value = parseWholeNumber(text);
  return Number.isInteger(value) && value >= min && value <= max ? undefined : fe.wholeNumber(min, max);
}

function basePriceError(text: string): string | undefined {
  const value = text.trim();
  if (!DeparturePriceSchema.safeParse(value).success) return fe.price;
  return TourBasePriceSchema.safeParse(value).success ? undefined : fe.priceAboveZero;
}

function textError(text: string, max: number, required: boolean): string | undefined {
  const value = text.trim();
  if (required && value === '') return fe.required;
  return value.length > max ? fe.tooLong(max) : undefined;
}

/** Ô chữ tuỳ chọn: trống thành `null` — cột nullable, "chưa viết" khác chuỗi rỗng. */
function orNull(text: string): string | null {
  const value = text.trim();
  return value === '' ? null : value;
}
```

  Phần còn lại của file — viết đủ, đúng tên dưới đây (test ở Bước 5 gọi đúng các
  tên này):

  - **New tour:** `interface TourCreateFormValues { title; slug; categoryId; primaryDestinationId; durationDays; maxGroupSize; basePrice }`
    (toàn `string`) · `type TourCreateFormErrors = Partial<Record<keyof TourCreateFormValues, string>>`
    · `newTourFormValues()` · `validateTourCreateForm(values)` (slug: trống →
    `required`, sai `SLUG_PATTERN` → `slugShape`, quá `TOUR_SLUG_MAX` → `tooLong`) ·
    `tourCreatePayload(values): AdminTourCreateInput`.
  - **Details:** `interface LineDraft extends Keyed { text: string }` ·
    `interface DestinationDraft extends Keyed { destinationId: string; isPrimary: boolean }` ·
    `interface TourDetailsFormValues { title; summary; categoryId; difficulty: TourDifficulty | ''; isFeatured: boolean; durationDays; maxGroupSize; basePrice; destinations: DestinationDraft[]; suitableFor: TravellerType[]; badges: TourBadge[]; highlights: LineDraft[]; included: LineDraft[]; excluded: LineDraft[]; meetingPoint; factDurationNote; factGroupSizeNote; factDifficultyNote; factGoodForNote }`
    · `interface TourDetailsFormErrors` (mỗi ô một `string?`, cộng
    `destinations?: string` cho lỗi cả khung và `lines?: Record<string, string>`
    khoá bằng `key` của dòng — dòng điểm đến lẫn dòng chữ) ·
    `detailsFormValues(detail)` · `validateTourDetailsForm(values, detail)` ·
    `tourDetailsPayload(id, version, values): AdminTourDetailsInput`.
    Luật riêng của `validateTourDetailsForm` (ngoài trần): tóm tắt trống khi
    `detail.isPublished` → `summaryOnSale`; số ngày khác `detail.durationDays` khi
    `detail.departureCount > 0` → `durationLocked`; số ngày lớn hơn
    `detail.durationDays` khi `detail.isPublished` → `addDaysOnSale`;
    `detail.liveSeatsMax !== null` và số khách nhỏ hơn nó → `groupFloor`; không
    dòng điểm đến nào → `chooseDestination` ở `destinations`; dòng chưa chọn →
    `chooseDestination`; trùng → `duplicateDestination` ở dòng sau.
  - **Itinerary:** `interface ItineraryDayDraft { title: string; description: string }` ·
    `interface ItineraryFormValues { days: ItineraryDayDraft[] }` (vị trí `i` là
    ngày `i + 1`) · `type ItineraryFormErrors = Record<number, { title?: string; description?: string }>`
    (khoá là `dayNumber`) · `itineraryFormValues(detail)` ·
    `validateItineraryForm(values, detail)` · `itineraryPayload(id, version, values)`.
  - **FAQ & policies:** `interface FaqDraft extends Keyed { question; answer }` ·
    `interface PolicyDraft extends Keyed { kind: 'BOOKING' | 'GENERAL'; title; body }` ·
    `interface ContentFormValues { faqs: FaqDraft[]; policies: PolicyDraft[] }` ·
    `type ContentFormErrors = Record<string, Partial<Record<'question' | 'answer' | 'title' | 'body', string>>>`
    (khoá `key` của dòng) · `contentFormValues(detail)` (chính sách loại
    `CANCELLATION` nếu có thì BỎ và giữ nguyên số đếm để component báo — không có
    ở dữ liệu thật, nhưng không được im lặng) · `validateContentForm(values)` ·
    `contentPayload(id, version, values)`.
  - **Costs:** `interface CostDraft extends Keyed { category: TourCostCategory; label: string; amount: string; basis: TourCostBasis }`
    · `interface CostsFormValues { items: CostDraft[] }` ·
    `type CostsFormErrors = Record<string, Partial<Record<'label' | 'amount', string>>>` ·
    `costsFormValues(detail)` · `validateCostsForm(values)` ·
    `costsPayload(id, version, values)` · `costDraftItems(values): CostItemLike[]`
    (chỉ dòng có số tiền qua `DeparturePriceSchema`).
  - `hasFormErrors` dùng bản ở `form-errors.ts`; lỗi dạng `Record` lồng thì viết
    `hasNestedErrors(errors)` ngay trong file này (đếm khoá có giá trị).
  - `sameValues(a, b)` so hai giá trị form BỎ QUA `key` của dòng — nuôi cờ "có
    thay đổi" của cả bốn tab: `JSON.stringify` sau khi xoá `key` là đủ.

  Chạy spec → xanh. Đột biến ít nhất bốn cái, mỗi cái giết được bởi một ca đã
  viết: bỏ luật `summaryOnSale`; đổi `>` thành `>=` ở luật thêm ngày; quên bỏ
  `key` trong payload; `itineraryPayload` gửi cả ngày không tiêu đề.

- [ ] **Bước 7: Gate + commit.**

```bash
git add apps/admin/src/lib/api/tours.ts apps/admin/src/lib/api/tours.spec.ts apps/admin/src/lib/tour-editor-view.ts apps/admin/src/lib/tour-editor-view.spec.ts apps/admin/src/lib/tour-editor-write.ts apps/admin/src/lib/tour-editor-write.spec.ts apps/admin/src/test/tour-detail.ts libs/shared/i18n/src/lib/messages.ts
git commit -m "feat(admin): client, VM và logic ghi thuần của khu làm việc tour"
```

---

## Task 10 — Admin: khung khu làm việc, tab Departures dời vào, vòng đời Save

Dựng phần CHUNG của khu làm việc. Sau task này `/tours/[slug]/departures` đã
nằm trong khung mới; bốn tab còn lại có trang ở Task 11–12 (giữa chừng, link
tab của chúng 404 — nhánh chưa merge nên không sao, ghi vào báo cáo).

**Files:**

- Create: `apps/admin/src/app/(admin)/tours/[slug]/load-tour.ts`
- Create: `apps/admin/src/app/(admin)/tours/[slug]/layout.tsx`
- Create: `apps/admin/src/components/tours/editor/tour-workspace-header.tsx`
- Create: `apps/admin/src/components/tours/editor/tour-readiness-panel.tsx` + `.spec.tsx`
- Create: `apps/admin/src/components/tours/editor/tour-tabs.tsx` + `.spec.tsx`
- Create: `apps/admin/src/lib/use-section-save.ts` + `use-section-save.spec.tsx`
- Create: `apps/admin/src/components/tours/editor/editor-form-frame.tsx` + `.spec.tsx`
- Modify: `apps/admin/src/components/tours/publish-toggle.tsx` + `.spec.tsx`
- Modify: `apps/admin/src/app/(admin)/tours/[slug]/departures/page.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts`

**Interfaces:**

- Consumes: Task 8 (`UnsavedChangesProvider`, `useReportUnsaved`), Task 9
  (`fetchAdminTour`, `fetchTourEditorOptions`, `tourTabHref`, `activeTourTab`,
  `TOUR_EDITOR_TABS`, `readinessIssues`, `ReadinessIssue`, `EditorWriteResult`);
  có sẵn: `AdminShell`, `getServerSession`, `TOURS_LIST_HREF` (`lib/departures-query.ts`),
  `setTourPublishedAction`, `isUncertainOutcome`.
- Produces (Task 11–12 dùng):
  - `loadAdminTour(slug): Promise<AdminTourDetail | null>` ·
    `loadTourEditorOptions(): Promise<TourEditorOptions>` — cả hai bọc `cache()`.
  - `useSectionSave<Code extends string>(options: { copy: (code: Code | TransportFailureCode) => string; projected: () => TourReadiness; slug: string; onSaved: (detail: AdminTourDetail) => void; onFieldError?: (code: Code) => boolean })`
    → `{ pending: boolean; banner: SectionBanner | null; save(run: () => Promise<EditorWriteResult<Code>>): Promise<void> }`,
    với `type SectionBanner = { kind: 'stale' } | { kind: 'notReady'; issues: ReadinessIssue[] } | { kind: 'error'; message: string; uncertain: boolean }`.
  - `<EditorFormFrame dirty pending banner note onSubmit children />` — form, dải
    báo, ghi chú cạnh nút, nút Save; tự gọi `useReportUnsaved(dirty)`.
  - `PublishToggle` nhận `tour: { id: string; title: string; isPublished: boolean }`
    (đổi tên prop từ `row`), cộng `blocked?: boolean`, `notReadyHref?: string`.

- [ ] **Bước 1: Copy** — thêm vào `messages.admin.tours.editor`:

```ts
        back: 'Back to tours',
        tabsLabel: 'Tour sections',
        tabs: {
          details: 'Details',
          itinerary: 'Itinerary',
          content: 'FAQ & policies',
          costs: 'Costs',
          departures: 'Departures',
        },
        /** Nhãn nhìn thấy cạnh công tắc — cùng chữ với cột "On sale" của bảng Tours. */
        onSale: 'On sale',
        /** Công tắc khoá chiều bật khi tour còn thiếu (ADR-0047 §4). */
        toggleBlocked: 'Fill in what is missing to put it on sale.',
```

  và vào `messages.admin.tours.publish`: `openTour: 'Open tour'`. Xoá khoá
  `messages.admin.departures.list.back` và `.heading` NẾU sau Bước 6 không còn
  ai dùng (`grep -rn "list.back\|list.heading" apps/admin/src`).

- [ ] **Bước 2: `PublishToggle` tổng quát hoá — test đỏ trước.** Trong
  `publish-toggle.spec.tsx` đổi mọi chỗ dựng component sang prop `tour`, rồi thêm:

```tsx
  it('blocked + đang tắt bán: công tắc khoá chiều bật', () => {
    render(<PublishToggle tour={{ ...TOUR, isPublished: false }} setPublished={vi.fn()} blocked />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('blocked + đang bán (dữ liệu cũ): vẫn gỡ bán được', () => {
    render(<PublishToggle tour={{ ...TOUR, isPublished: true }} setPublished={vi.fn()} blocked />);
    expect(screen.getByRole('switch')).not.toBeDisabled();
  });

  it('TOUR_NOT_READY từ server: toast lỗi kèm nút mở tour, không refresh', async () => {
    const user = userEvent.setup();
    const setPublished = vi.fn().mockResolvedValue({ ok: false, code: 'TOUR_NOT_READY' });
    render(
      <PublishToggle tour={{ ...TOUR, isPublished: false }} setPublished={setPublished} notReadyHref="/tours/ha-long" />,
    );

    await user.click(screen.getByRole('switch'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const [message, options] = vi.mocked(toast.error).mock.calls[0] ?? [];
    expect(message).toBe("This tour isn't ready to sell yet — open it to see what's missing.");
    expect(options?.action?.label).toBe('Open tour');
    options?.action?.onClick?.({} as never);
    expect(push).toHaveBeenCalledWith('/tours/ha-long');
    expect(refresh).not.toHaveBeenCalled();
  });
```

  (`TOUR`, `push`, `refresh` là mock sẵn có hoặc thêm vào `vi.mock('next/navigation')`
  của file.) Cài: đổi `row: TourRowVM` → `tour: PublishToggleTour` với
  `export type PublishToggleTour = Pick<TourRowVM, 'id' | 'title' | 'isPublished'>`;
  `disabled={pending || (blocked && !checked)}`; nhánh `!result.ok`:

```tsx
      if (result.code === 'TOUR_NOT_READY' && notReadyHref) {
        toast.error(setPublishedErrorCopy(result.code), {
          action: { label: t.openTour, onClick: () => router.push(notReadyHref) },
        });
        return;
      }
      toast.error(setPublishedErrorCopy(result.code));
```

  Cập nhật chỗ gọi ở `tours-table.tsx` (`tour={row.original}`). Chạy
  `publish-toggle.spec.tsx` và `tours-table.spec.tsx` → xanh.

- [ ] **Bước 3: `load-tour.ts`** (không test riêng — layout và page cùng dùng):

```ts
import { cookies } from 'next/headers';
import { cache } from 'react';
import { fetchAdminTour, fetchTourEditorOptions } from '@/lib/api/tours';

/**
 * Hai lượt đọc dùng chung của khu làm việc tour (spec F17 §2g). `cache()` của
 * React gộp các lần gọi CÙNG tham số trong MỘT request server: layout và page
 * cùng hỏi một slug mà chỉ tốn một request API.
 */
export const loadAdminTour = cache(async (slug: string) =>
  fetchAdminTour((await cookies()).toString(), slug),
);

export const loadTourEditorOptions = cache(async () =>
  fetchTourEditorOptions((await cookies()).toString()),
);
```

- [ ] **Bước 4: Khung readiness và thanh tab — test đỏ trước.**
  `tour-readiness-panel.spec.tsx`: tour đủ → thấy "Ready to sell"; tour thiếu
  tóm tắt và ngày 2–3 → thấy "Missing before it can go on sale:" và HAI link
  với tên và `href` CHÍNH XÁC (`A summary` → `/tours/ha-long#tour-summary`,
  `An itinerary for days 2–3` → `/tours/ha-long/itinerary#day-2`).
  `tour-tabs.spec.tsx` (mock `usePathname`): năm link đúng thứ tự và `href`
  (`tourTabHref`), đúng MỘT link mang `aria-current="page"` — ở
  `/tours/ha-long/costs` là "Costs", ở `/tours/ha-long` là "Details"; thanh tab
  là `navigation` tên "Tour sections".

  Cài: `TourReadinessPanel({ readiness, slug })` là server component —
  `readinessIssues(readiness, slug)` rỗng thì một khung giọng thành công (token
  `success`) với `ready` + `readyBody`; không rỗng thì `missingTitle` và một
  `<ul>` các `<Link href={issue.href}>{issue.label}</Link>`. `TourTabs({ slug })`
  là client component (`'use client'`, `usePathname`), `<nav aria-label={t.tabsLabel}>`
  bọc các `Link`, tab đang mở có `aria-current="page"` và gạch chân bằng token
  `primary`. Chạy hai spec → xanh.

- [ ] **Bước 5: Layout và phần đầu.** `layout.tsx`:

```tsx
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { UnsavedChangesProvider } from '@/components/kit/unsaved-changes';
import { TourReadinessPanel } from '@/components/tours/editor/tour-readiness-panel';
import { TourTabs } from '@/components/tours/editor/tour-tabs';
import { TourWorkspaceHeader } from '@/components/tours/editor/tour-workspace-header';
import { getServerSession } from '@/lib/api/session';
import { setTourPublishedAction } from '../actions';
import { loadAdminTour } from './load-tour';

/**
 * Khu làm việc của MỘT tour (spec F17 §2g): phần đầu dùng chung cho năm tab —
 * Back to tours · tên tour · công tắc On sale · khung readiness · thanh tab.
 *
 * `AdminShell` dời từ từng trang lên đây: các trang con chỉ còn phần thân của
 * tab. `UnsavedChangesProvider` bọc CẢ phần đầu lẫn thân, vì link rời trang nằm ở
 * cả hai chỗ (Task 8).
 *
 * Slug rác → `notFound()` ngay ở đây, trước khi trang con nào chạy.
 */
export default async function TourWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [session, detail] = await Promise.all([getServerSession(), loadAdminTour(slug)]);
  if (!session) return null;
  if (!detail) notFound();

  return (
    <AdminShell user={session}>
      <UnsavedChangesProvider>
        <div className="flex flex-col gap-4 px-4 lg:px-6">
          <TourWorkspaceHeader detail={detail} setPublished={setTourPublishedAction} />
          <TourReadinessPanel readiness={detail.readiness} slug={detail.slug} />
          <TourTabs slug={detail.slug} />
        </div>
        {children}
      </UnsavedChangesProvider>
    </AdminShell>
  );
}
```

  (Bỏ import `cookies` nếu không dùng.) `TourWorkspaceHeader({ detail, setPublished })`:
  `Link` về `TOURS_LIST_HREF` (chữ `t.back`, icon `ChevronLeftIcon` như trang
  Departures cũ), `<h2>` tên tour, và một hàng `On sale` + `PublishToggle`
  với `tour={detail}`, `blocked={!detail.readiness.ready}`; khi `blocked` và
  tour đang tắt bán thì hiện `t.toggleBlocked` và nối nó vào công tắc bằng
  `aria-describedby`. Không truyền `notReadyHref` — khung readiness đã ở ngay dưới.

- [ ] **Bước 6: Trang Departures dời vào khung.** Trong
  `tours/[slug]/departures/page.tsx`: bỏ `AdminShell`, bỏ `getServerSession` và
  nhánh `if (!session)`, bỏ link Back và `<h2>` (layout đã có); GIỮ phụ đề
  (`t.list.subtitle`), `TourUnpublishedNotice`, bảng, và mọi logic dữ liệu
  (`notFound()`, `orphanPageHref`, `today`). Sửa JSDoc đầu file cho đúng hiện
  trạng: trang là tab Departures của khu làm việc F17. Chạy typecheck admin.

- [ ] **Bước 7: Vòng đời Save — test đỏ trước.** `use-section-save.spec.tsx`
  (dùng `renderHook` + `act`; mock `sonner` và `next/navigation` như các spec
  admin khác). Ca:
  1. `ok: true` → `onSaved(detail)` đúng một lần, `toast.success('Changes saved')`,
     `router.refresh()`, `banner` null.
  2. `STALE_TOUR` → `banner` `{ kind: 'stale' }`, không toast, không refresh.
  3. `TOUR_NOT_READY` → `banner.kind === 'notReady'` và `issues` bằng
     `readinessIssues(options.projected(), slug)`.
  4. `NOT_FOUND` → `toast.error(copy('NOT_FOUND'))` và `router.push('/tours')`.
  5. Mã mà `onFieldError` trả `true` (vd `DURATION_LOCKED`) → không dải, không toast.
  6. `GENERIC` → `banner` `{ kind: 'error', uncertain: true }`; `FORBIDDEN` →
     `uncertain: false`.
  7. `run` ném → xử như `GENERIC`.
  8. Gọi `save` hai lần khi lần đầu chưa xong → `run` chạy đúng một lần.

  Cài `lib/use-section-save.ts`:

```ts
'use client';

import type { AdminTourDetail, TourReadiness } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { isUncertainOutcome, type TransportFailureCode } from '@/lib/api/write-error';
import { TOURS_LIST_HREF } from '@/lib/departures-query';
import { type ReadinessIssue, readinessIssues } from '@/lib/tour-editor-view';
import type { EditorWriteResult } from '@/lib/tour-editor-write';

/**
 * Vòng đời MỘT lần Save của một tab (spec F17 §2i) — cùng luật `useConfirmWrite`
 * nhưng cho form nằm trên trang chứ không trong hộp thoại:
 *
 * - `pending` là CỔNG: bấm đúp chỉ bắn một lệnh.
 * - Thành công: form nhận NGUYÊN tour mới (`version` mới) rồi `router.refresh()`
 *   cho phần đầu (readiness, công tắc) theo kịp.
 * - `STALE_TOUR`: dải báo kèm Reload, form GIỮ chữ đang gõ.
 * - `TOUR_NOT_READY`: dải liệt kê chỗ thiếu, tính từ bản dự tính của chính lệnh này.
 * - `NOT_FOUND`: tour đã bị xoá — toast rồi về `/tours`.
 * - Mã thuộc về một ô (`onFieldError` trả `true`): form tự in dưới ô ấy.
 * - Còn lại: dải lỗi; `GENERIC` là kết cục KHÔNG RÕ nên dải mời Reload thay vì bấm lại.
 */
export type SectionBanner =
  | { kind: 'stale' }
  | { kind: 'notReady'; issues: ReadinessIssue[] }
  | { kind: 'error'; message: string; uncertain: boolean };

export function useSectionSave<Code extends string>(options: {
  copy: (code: Code | TransportFailureCode) => string;
  projected: () => TourReadiness;
  slug: string;
  onSaved: (detail: AdminTourDetail) => void;
  onFieldError?: (code: Code) => boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [banner, setBanner] = useState<SectionBanner | null>(null);

  async function save(run: () => Promise<EditorWriteResult<Code>>) {
    if (pending) return;
    setPending(true);
    setBanner(null);
    let result: EditorWriteResult<Code>;
    try {
      result = await run();
    } catch {
      result = { ok: false, code: 'GENERIC' };
    }
    setPending(false);

    if (result.ok) {
      options.onSaved(result.detail);
      toast.success(messages.admin.tours.editor.saved);
      router.refresh();
      return;
    }
    const { code } = result;
    if (code === 'STALE_TOUR') return setBanner({ kind: 'stale' });
    if (code === 'TOUR_NOT_READY') {
      return setBanner({ kind: 'notReady', issues: readinessIssues(options.projected(), options.slug) });
    }
    if (code === 'NOT_FOUND') {
      toast.error(options.copy(code));
      router.push(TOURS_LIST_HREF);
      return;
    }
    if (options.onFieldError?.(code as Code)) return;
    setBanner({ kind: 'error', message: options.copy(code), uncertain: isUncertainOutcome(code) });
  }

  return { pending, banner, save };
}
```

  Chạy spec → xanh. Đột biến: bỏ `router.refresh()` (ca 1 đỏ); bỏ cổng
  `pending` (ca 8 đỏ).

- [ ] **Bước 8: `EditorFormFrame` — test đỏ trước.** `editor-form-frame.spec.tsx`:
  nút "Save changes" có `aria-disabled` khi `dirty={false}` và bấm không gọi
  `onSubmit`; `dirty` thì bấm gọi `onSubmit` đúng một lần; `pending` thì chữ nút
  là "Saving…"; `banner={{ kind: 'stale' }}` → thấy câu `banners.stale` và nút
  "Reload" gọi `router.refresh()`; `banner` notReady → câu `banners.notReady` và
  từng link của `issues`; notReady với `issues` rỗng → câu `banners.notReadyUnknown`;
  `banner` error `uncertain` → câu lỗi và nút Reload; `note` hiện cạnh nút Save.

  Cài `components/tours/editor/editor-form-frame.tsx`: `'use client'`; props
  `{ dirty: boolean; pending: boolean; banner: SectionBanner | null; note?: string; onSubmit: () => void; children: React.ReactNode }`;
  gọi `useReportUnsaved(dirty)`; `<form onSubmit={(event) => { event.preventDefault(); if (dirty && !pending) onSubmit(); }}>`;
  dải báo đặt TRÊN nội dung, `role="alert"`, token `destructive` cho lỗi và
  `warning` cho stale/notReady; chân form là `note` (chữ nhỏ, `text-muted-foreground`)
  và nút Save (`type="submit"`, `focusableWhenDisabled`, `disabled={!dirty || pending}`,
  chữ trong `StableLabel` giữa "Save changes" / "Saving…" để nút không co giãn).

- [ ] **Bước 9: Gate + commit.**

```bash
git add "apps/admin/src/app/(admin)/tours/[slug]/load-tour.ts" "apps/admin/src/app/(admin)/tours/[slug]/layout.tsx" "apps/admin/src/app/(admin)/tours/[slug]/departures/page.tsx" apps/admin/src/components/tours/editor/ apps/admin/src/components/tours/publish-toggle.tsx apps/admin/src/components/tours/publish-toggle.spec.tsx apps/admin/src/components/tours/tours-table.tsx apps/admin/src/lib/use-section-save.ts apps/admin/src/lib/use-section-save.spec.tsx libs/shared/i18n/src/lib/messages.ts
git commit -m "feat(admin): khung khu làm việc tour với công tắc, khung đủ để bán và thanh tab"
```

---

## Task 11 — Admin: tab Details, xoá tour, hộp New tour

**Files:**

- Create: `apps/admin/src/app/(admin)/tours/[slug]/page.tsx`
- Create: `apps/admin/src/app/(admin)/tours/[slug]/actions.ts`
- Create: `apps/admin/src/components/tours/editor/tour-details-form.tsx` + `.spec.tsx`
- Create: `apps/admin/src/components/tours/editor/delete-tour-zone.tsx` + `.spec.tsx`
- Create: `apps/admin/src/components/tours/editor/new-tour-dialog.tsx` + `.spec.tsx`
- Modify: `apps/admin/src/app/(admin)/tours/actions.ts` (thêm `createTourAction`)
- Modify: `apps/admin/src/app/(admin)/tours/page.tsx`
- Modify: `apps/admin/src/components/tours/tours-table.tsx` + `.spec.tsx`
- Modify: `apps/admin/src/lib/tours-view.ts` + `.spec.ts` (thêm `editorHref`)
- Modify: `libs/shared/i18n/src/lib/messages.ts`

**Interfaces:**

- Consumes: Task 8–10 (kit, lib thuần, `useSectionSave`, `EditorFormFrame`,
  `loadAdminTour`, `loadTourEditorOptions`); `ConfirmWriteDialog`,
  `useConfirmWrite`, `FormField`, `FormSelect`, `slugifyVietnamese`.
- Produces: `updateTourDetailsAction(input): Promise<EditorWriteResult<DetailsContractCode>>`,
  `deleteTourAction(input): Promise<DeleteTourResult>`,
  `createTourAction(input): Promise<CreateTourResult>`; `TourRowVM.editorHref`.

- [ ] **Bước 1: Copy** — thêm vào `messages.admin.tours.editor`. Câu hứa hệ quả
  đã đo: giá gốc (`bookings.service.ts` tính `unitPrice` từ `basePrice` lúc tạo
  booking khi chuyến không có giá riêng); ngày bị xoá (`updateDetails` xoá ngày
  vượt); xoá tour (khoá ngoại `Cascade`/`SetNull` trong `schema.prisma`, plan
  quyết định 4).

```ts
        details: {
          errors: { /* Task 9 */ },
          sections: { basics: 'Basics', destinations: 'Destinations', selling: 'Selling points' },
          title: 'Name',
          summary: 'Summary',
          summaryHint: (max: number) => `Up to ${max} characters.`,
          category: 'Category',
          categoryPlaceholder: 'Choose a category',
          difficulty: 'Difficulty',
          difficultyNotSet: 'Not set',
          featured: 'Featured',
          durationDays: 'Days',
          daysRemoved: (list: string, count: number) =>
            count === 1
              ? `Day ${list} of the itinerary will be removed when you save.`
              : `Days ${list} of the itinerary will be removed when you save.`,
          maxGroupSize: 'Maximum group size',
          basePrice: 'Base price (USD)',
          basePriceNote:
            'A new base price applies straight away to every departure without its own price, from the next booking.',
          destination: 'Destination',
          destinationPlaceholder: 'Choose a destination',
          primary: 'Primary',
          destinationsHint: 'Mark exactly one as the primary destination.',
          addDestination: 'Add destination',
          destinationName: (n: number) => `destination ${n}`,
          suitableFor: 'Good for',
          badges: 'Badges',
          highlights: 'Highlights',
          addHighlight: 'Add highlight',
          highlightName: (n: number) => `highlight ${n}`,
          included: "What's included",
          addIncluded: 'Add included item',
          includedName: (n: number) => `included item ${n}`,
          excluded: "What's not included",
          addExcluded: 'Add excluded item',
          excludedName: (n: number) => `excluded item ${n}`,
          meetingPoint: 'Meeting point',
          factsTitle: 'Notes under the four fact cards',
          factHint: (max: number) => `One sentence, up to ${max} characters.`,
        },
        delete: {
          errors: { /* Task 9 */ },
          title: 'Delete this tour',
          body: 'Only a tour that has never been booked can be deleted.',
          action: 'Delete tour',
          dialog: {
            title: 'Delete this tour?',
            body: (departures: number) =>
              `This removes the tour for good, together with ${departures === 1 ? '1 departure' : `${departures} departures`}, its itinerary, FAQ, policies, cost lines, destination links, wishlist saves, reviews and blog-post links. Enquiries about it are kept, without the link to the tour.`,
            warning: 'This cannot be undone.',
            submit: 'Delete tour',
            submitting: 'Deleting…',
            cancel: 'Cancel',
          },
          rows: { tour: 'Tour', departures: 'Departures' },
          toast: { title: 'Tour deleted', body: (title: string) => `${title} is gone from the catalogue.` },
        },
        create: {
          errors: { /* Task 9 */ },
          action: 'New tour',
          dialog: {
            title: 'New tour',
            body: 'It starts off sale. Fill in every tab, then put it on sale.',
            submit: 'Create tour',
            submitting: 'Creating…',
            cancel: 'Cancel',
          },
          slugHint: SLUG_HINT_COPY,
          primaryDestination: 'Primary destination',
          noOptions:
            'A tour needs a category and a destination. Add them first, or refresh if the lists did not load.',
          toast: { title: 'Tour created', body: 'It stays off sale until you put it on sale.' },
        },
```

  Nhãn độ khó, đối tượng khách, huy hiệu và bốn nhãn ghi chú dữ kiện: DÙNG LẠI
  copy của web (một chữ cho mỗi khái niệm) — `messages.travellerTypes`,
  `messages.tourDetail.badges`, `messages.tourDetail.facts.{duration, groupSize, difficulty, goodFor}`,
  và nhãn độ khó ở khối có `EASY: 'Easy'` (grep). Ô tên, slug, danh mục, số
  ngày, số khách, giá ở hộp New tour dùng chung nhãn với `details`.

- [ ] **Bước 2: Server action.** `tours/[slug]/actions.ts` — khuôn
  `destinations/actions.ts` (re-parse bằng schema contract → `INVALID_INPUT`;
  `cookies()` ngoài `try`; `try` chỉ ôm lời gọi API; phân loại bằng codec):

```ts
'use server';

import {
  AdminTourDeleteInputSchema,
  type AdminTourDeleteInput,
  type AdminTourDetail,
  type AdminTourDetailsInput,
  AdminTourDetailsInputSchema,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { deleteAdminTour, updateAdminTourDetails } from '@/lib/api/tours';
import {
  classifyDeleteTourError,
  classifyDetailsError,
  type DeleteTourResult,
  type DetailsContractCode,
  type EditorWriteResult,
} from '@/lib/tour-editor-write';

/**
 * Hành vi GHI của khu làm việc tour (spec F17) — cùng khuôn `destinations/actions.ts`.
 * KHÔNG `revalidatePath`: trang là server component động, client tự
 * `router.refresh()`; cache WEB do API tự bust sau commit.
 */
export async function updateTourDetailsAction(
  input: AdminTourDetailsInput,
): Promise<EditorWriteResult<DetailsContractCode>> {
  const parsed = AdminTourDetailsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let detail: AdminTourDetail;
  try {
    detail = await updateAdminTourDetails(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyDetailsError(error) };
  }
  return { ok: true, detail };
}

export async function deleteTourAction(input: AdminTourDeleteInput): Promise<DeleteTourResult> {
  /* cùng khuôn: AdminTourDeleteInputSchema → deleteAdminTour → { ok: true, deleted } */
}
```

  Và `createTourAction` trong `tours/actions.ts` (cạnh `setTourPublishedAction`):
  `AdminTourCreateInputSchema` → `createAdminTour` → `{ ok: true, created }`,
  lỗi qua `classifyCreateTourError`.

- [ ] **Bước 3: Form Details — test đỏ trước.** `tour-details-form.spec.tsx`
  (mock `sonner`, `next/navigation`; dựng với `detailFixture` và action giả).
  Ca, mỗi ca một `it`, khớp chữ chính xác:
  1. Mở ra đủ giá trị của tour; nút "Save changes" `aria-disabled` cho tới khi
     sửa một ô; sửa tên thì nút sáng.
  2. Lưu gửi ĐÚNG payload: `id`, `version` của tour, tên đã cắt khoảng trắng,
     danh sách điểm đến không mang `key`; thành công thì toast "Changes saved" và
     `refresh`.
  3. `departureCount: 2` → ô số ngày `disabled` kèm "Locked — this tour has departures.".
  4. Tour tắt bán, itinerary ngày 1–4, hạ số ngày về 2 → thấy
     "Days 3–4 of the itinerary will be removed when you save." (giọng cảnh báo,
     không phải lỗi); hạ về 4 → không thấy.
  5. `liveSeatsMax: 12`, số khách `11`, bấm Save → lỗi
     "At least 12 — the largest departure has 12 seats." dưới ô, action KHÔNG được gọi.
  6. Tour ĐANG bán, xoá tóm tắt, Save → lỗi `summaryOnSale` dưới ô tóm tắt,
     action không được gọi. Tour tắt bán thì lưu được.
  7. Chọn nút radio "Primary" của dòng thứ hai → đúng MỘT radio được chọn và
     payload có `isPrimary` ở dòng ấy.
  8. Danh mục đang ẩn của tour được chọn sẵn và nhãn là "Retired (hidden)".
  9. Server trả `DURATION_LOCKED` → câu hiện DƯỚI ô số ngày, không có dải; trả
     `STALE_TOUR` → dải "Someone else saved this tour…" kèm "Reload", chữ đang
     gõ còn nguyên.
  10. Ô tóm tắt có `id="tour-summary"`, khung điểm đến có `id="tour-destinations"`
      (đích của link trong khung readiness).
  11. `bookingCount: 0` → có nút "Delete tour"; `bookingCount: 1` → KHÔNG có (spec §2d).
  12. Lưu hai lần liền: lần hai gửi `version` của response lần một, không phải của props.

- [ ] **Bước 4: Cài form Details** — `tour-details-form.tsx`. Khung (phần
  `{/* … */}` viết thật theo mô tả, dùng `FormField` cho MỌI ô):

```tsx
'use client';

import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { ListEditor } from '@/components/kit/list-editor';
import { EditorFormFrame } from '@/components/tours/editor/editor-form-frame';
import { DeleteTourZone } from '@/components/tours/editor/delete-tour-zone';
import type { TourEditorOptions } from '@/lib/api/tours';
import { hasFormErrors } from '@/lib/form-errors';
import { projectedReadiness, removedItineraryDays } from '@/lib/tour-editor-view';
import {
  type DeleteTourAction,
  type DetailsContractCode,
  detailsErrorCopy,
  detailsFormValues,
  sameValues,
  type TourDetailsFormErrors,
  type TourDetailsFormValues,
  tourDetailsPayload,
  type UpdateDetailsAction,
  validateTourDetailsForm,
} from '@/lib/tour-editor-write';
import { useSectionSave } from '@/lib/use-section-save';

/**
 * Tab Details (spec F17 §2h): ba khung — Basics, Destinations, Selling points —
 * một nút Save, và vùng xoá ở cuối.
 *
 * `detail` đọc từ PROPS cho mọi luật phụ thuộc trạng thái server (đang bán? có
 * chuyến? sàn ghế?) — sau khi admin bấm On sale ở phần đầu, `router.refresh()`
 * đưa props mới xuống mà form không bị dựng lại (bật/tắt bán không đổi `version`,
 * plan F17 quyết định 2). Chỉ giá trị các ô, bản gốc để so "có thay đổi", và
 * `version` là state. Trang dựng form với `key={detail.version}`: phiên bản mới
 * (sau Reload) là một form mới.
 */
const t = messages.admin.tours.editor.details;

export function TourDetailsForm({
  detail,
  options,
  save: saveAction,
  remove,
}: {
  detail: AdminTourDetail;
  options: TourEditorOptions;
  save: UpdateDetailsAction;
  remove: DeleteTourAction;
}) {
  const [base, setBase] = useState<TourDetailsFormValues>(() => detailsFormValues(detail));
  const [values, setValues] = useState<TourDetailsFormValues>(base);
  const [version, setVersion] = useState(detail.version);
  const [showValidation, setShowValidation] = useState(false);
  /** Lỗi server thuộc về một ô (DURATION_LOCKED, GROUP_SIZE_BELOW_SEATS). */
  const [fieldError, setFieldError] = useState<{ field: 'durationDays' | 'maxGroupSize'; message: string } | null>(null);

  const errors: TourDetailsFormErrors = showValidation ? validateTourDetailsForm(values, detail) : {};
  const dirty = !sameValues(values, base);
  const removed = removedItineraryDays(detail.itinerary, Number(values.durationDays));

  const { pending, banner, save } = useSectionSave<DetailsContractCode>({
    copy: detailsErrorCopy,
    slug: detail.slug,
    projected: () =>
      projectedReadiness(detail, {
        summary: values.summary,
        destinations: values.destinations,
        durationDays: Number(values.durationDays),
      }),
    onSaved: (next) => {
      const fresh = detailsFormValues(next);
      setBase(fresh);
      setValues(fresh);
      setVersion(next.version);
      setShowValidation(false);
    },
    onFieldError: (code) => {
      if (code === 'DURATION_LOCKED') setFieldError({ field: 'durationDays', message: detailsErrorCopy(code) });
      else if (code === 'GROUP_SIZE_BELOW_SEATS') setFieldError({ field: 'maxGroupSize', message: detailsErrorCopy(code) });
      else return false;
      return true;
    },
  });

  function patch(next: Partial<TourDetailsFormValues>) {
    setValues((current) => ({ ...current, ...next }));
    setFieldError(null);
  }

  function submit() {
    setShowValidation(true);
    if (hasFormErrors(validateTourDetailsForm(values, detail))) return;
    void save(() => saveAction(tourDetailsPayload(detail.id, version, values)));
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <EditorFormFrame dirty={dirty} pending={pending} banner={banner} note={t.basePriceNote} onSubmit={submit}>
        {/* Khung Basics: tên · tóm tắt (id="tour-summary") · danh mục (`FormSelect`,
            mọi mục qua `optionLabel`) · độ khó (`FormSelect` có mục "Not set" mang
            giá trị canh `'NOT_SET'`, đổi qua lại với `''` của form — Base UI coi chuỗi
            rỗng là CHƯA CHỌN nên một mục không mang được `''`) · ô tích Featured · số ngày (disabled + lock khi
            detail.departureCount > 0; cảnh báo `daysRemoved` khi `removed` khác rỗng)
            · số khách (hint `groupFloor` khi detail.liveSeatsMax có giá trị) · giá gốc. */}
        {/* Khung Destinations (id="tour-destinations"): ListEditor max TOUR_DESTINATIONS_MAX,
            mỗi dòng một `FormSelect` điểm đến + radio "Primary" (name dùng chung, luôn đúng
            một — chọn dòng khác thì bỏ dòng cũ) ; xoá dòng đang là điểm chính thì
            dòng đầu còn lại thành điểm chính. */}
        {/* Khung Selling points: ô tích "Good for" (TravellerTypeSchema.options) và
            "Badges" (TourBadgeSchema.options) · ba ListEditor (highlights, included,
            excluded; max TOUR_LIST_ITEMS_MAX; mỗi dòng một Input) · điểm hẹn ·
            bốn ô ghi chú dữ kiện (nhãn là bốn nhãn thẻ của web). */}
        {/* `fieldError` hiện ở FormField của đúng ô; lỗi validate lấy từ `errors`. */}
      </EditorFormFrame>
      {detail.bookingCount === 0 ? <DeleteTourZone detail={detail} remove={remove} /> : null}
    </div>
  );
}
```

  Chạy spec → xanh. Đột biến: bỏ `key={detail.version}` ở trang KHÔNG giết được
  bằng unit test (ghi rõ); bỏ `setVersion(next.version)` → thêm một ca "lưu hai
  lần liền dùng version mới ở lần hai" nếu chưa có, cho nó đỏ; đảo luật radio
  cho phép hai điểm chính → ca 7 đỏ.

- [ ] **Bước 5: Vùng xoá — test đỏ trước.** `delete-tour-zone.spec.tsx`: nút
  "Delete tour" mở hộp (tên hộp "Delete this tour?"), thân hộp nói đúng số chuyến
  ("…together with 2 departures, …"); xác nhận gọi `remove({ id })`; thành công →
  `router.push('/tours')` và toast "Tour deleted"; `TOUR_HAS_BOOKINGS` → câu lỗi
  hiện TRONG hộp; `NOT_FOUND` → hộp đóng, toast lỗi, về `/tours`.

  Cài `delete-tour-zone.tsx`: một khung viền `destructive` với `t.delete.title`,
  `t.delete.body` và nút mở hộp; hộp là kit `ConfirmWriteDialog` với
  `submitVariant="destructive"`, `warningTone="destructive"`, `rows` (Tour, số
  chuyến), `isStale={isDeleteTourStale}`, `errorCopy={deleteTourErrorCopy}`,
  `onSettled={() => router.push(TOURS_LIST_HREF)}`. Nút mở hộp KHÔNG bị khoá
  (không có lượt làm mới nào chạy nền ở đây).

- [ ] **Bước 6: Trang Details** — `tours/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TourDetailsForm } from '@/components/tours/editor/tour-details-form';
import { deleteTourAction, updateTourDetailsAction } from './actions';
import { loadAdminTour, loadTourEditorOptions } from './load-tour';

export const metadata: Metadata = { title: 'Tour details — Nexora back office' };

/** Tab Details của khu làm việc (spec F17 §2h). Phần đầu và `AdminShell` ở layout. */
export default async function TourDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [detail, options] = await Promise.all([loadAdminTour(slug), loadTourEditorOptions()]);
  if (!detail) notFound();
  return (
    <TourDetailsForm
      key={detail.version}
      detail={detail}
      options={options}
      save={updateTourDetailsAction}
      remove={deleteTourAction}
    />
  );
}
```

- [ ] **Bước 7: Hộp New tour — test đỏ trước.** `new-tour-dialog.spec.tsx`:
  gõ tên "Hội An Lantern Walk" → ô slug tự thành `hoi-an-lantern-walk`; sửa tay ô
  slug rồi sửa tên → slug KHÔNG đổi theo nữa; ô slug có `spellcheck="false"`,
  `autocapitalize="none"`, `autocorrect="off"`; bấm tạo khi trống → lỗi dưới từng
  ô, action không được gọi; `SLUG_TAKEN` → câu lỗi DƯỚI ô slug, hộp vẫn mở, chữ đã
  gõ còn; thành công → `router.push('/tours/<slug>')` và toast "Tour created" /
  "It stays off sale until you put it on sale."; danh sách danh mục hay điểm đến
  rỗng → thấy câu `noOptions` và nút tạo khoá; mục đã ẩn mang "(hidden)".

  Cài `new-tour-dialog.tsx` theo khuôn `DestinationFormDialog` (Dialog +
  `useConfirmWrite` + `FormField`; danh mục và điểm đến chính là hai `FormSelect`
  với nhãn qua `optionLabel`; slug chạy theo tên bằng
  `slugifyVietnamese(title, TOUR_SLUG_MAX)` tới khi admin chạm ô slug). Trong
  `run`, nhánh thành công gọi `router.push(tourTabHref(created.slug, 'details'))`
  TRƯỚC khi trả `{ ok: true, toast }`. Lỗi `SLUG_TAKEN` là lỗi của ô slug: hiện
  `createTourErrorCopy('SLUG_TAKEN')` dưới ô slug (đọc `failure` của hook), không
  in thêm ở chân hộp.

- [ ] **Bước 8: Bảng Tours.** `tours-view.ts`: thêm `editorHref: tourTabHref(row.slug, 'details')`
  vào `TourRowVM` (test ở `tours-view.spec.ts`). `tours-table.tsx`: tên tour trỏ
  `editorHref` (thay `departuresHref`); nút cột Actions giữ nguyên là lối tắt
  sang Departures; `PublishToggle` nhận `notReadyHref={row.original.editorHref}`;
  thêm nút "New tour" vào `actions` của `DataTableFrame` (mở `NewTourDialog`).
  Bảng nhận thêm props `createOptions: TourEditorOptions` và
  `create: CreateTourAction`. `tours/page.tsx`: lấy thêm
  `fetchTourDestinationOptions(cookie)` trong cùng `Promise.all`, truyền
  `createOptions={{ categories, destinations }}` và `create={createTourAction}`.
  Sửa `tours-table.spec.tsx`: link tên tour trỏ `/tours/<slug>`; nút "New tour" có mặt.

- [ ] **Bước 9: Gate + commit.**

```bash
git add "apps/admin/src/app/(admin)/tours/[slug]/page.tsx" "apps/admin/src/app/(admin)/tours/[slug]/actions.ts" "apps/admin/src/app/(admin)/tours/actions.ts" "apps/admin/src/app/(admin)/tours/page.tsx" apps/admin/src/components/tours/ apps/admin/src/lib/tours-view.ts apps/admin/src/lib/tours-view.spec.ts libs/shared/i18n/src/lib/messages.ts
git commit -m "feat(admin): tab Details, xoá tour chưa từng bán và hộp New tour"
```

---

## Task 12 — Admin: ba tab Itinerary, FAQ & policies, Costs

**Files:**

- Create: `apps/admin/src/app/(admin)/tours/[slug]/itinerary/page.tsx`
- Create: `apps/admin/src/app/(admin)/tours/[slug]/content/page.tsx`
- Create: `apps/admin/src/app/(admin)/tours/[slug]/costs/page.tsx`
- Modify: `apps/admin/src/app/(admin)/tours/[slug]/actions.ts` (thêm ba action)
- Create: `apps/admin/src/components/tours/editor/tour-itinerary-form.tsx` + `.spec.tsx`
- Create: `apps/admin/src/components/tours/editor/tour-content-form.tsx` + `.spec.tsx`
- Create: `apps/admin/src/components/tours/editor/tour-costs-form.tsx` + `.spec.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts`

**Interfaces:**

- Consumes: như Task 11; thêm `costBreakdown`, `costDraftItems`, ba bộ
  giá trị/validator/payload của Task 9.
- Produces: `setTourItineraryAction`, `setTourContentAction`, `setTourCostsAction`
  (cùng khuôn `updateTourDetailsAction`, schema tương ứng của contract).

- [ ] **Bước 1: Copy.** Câu hứa hệ quả đã đo: khuôn giờ của lịch trình
  (`parseItineraryStops` ở `apps/web/src/lib/tour-detail.ts`: mỗi dòng là một điểm
  dừng, dòng `HH:MM — …` có cột giờ riêng); ngày không tiêu đề không được lưu
  (`itineraryPayload`); chi phí chỉ áp cho chuyến và booking tạo sau
  (`fixedCostAmount`, `costPerPerson` là bản chụp lúc tạo).

```ts
        itinerary: {
          errors: { /* Task 9 */ },
          intro: (days: number) =>
            `${days === 1 ? '1 day' : `${days} days`}, one card per day. A day without a title is not saved.`,
          day: (n: number) => `Day ${n}`,
          dayTitle: 'Title',
          description: 'Plan for the day',
          descriptionHint:
            'One line per stop. Start a line with a time, like “09:00 — Pick-up at your hotel”, and the tour page shows the time in its own column.',
          descriptionPlaceholder: '09:00 — Pick-up at your hotel',
        },
        content: {
          errors: { /* Task 9 */ },
          faqTitle: 'FAQ',
          addFaq: 'Add question',
          faqName: (n: number) => `question ${n}`,
          question: 'Question',
          answer: 'Answer',
          emptyFaq: 'No questions yet.',
          policiesTitle: 'Policies',
          addPolicy: 'Add policy',
          policyName: (n: number) => `policy ${n}`,
          kind: 'Type',
          kinds: { BOOKING: 'Booking', GENERAL: 'General' },
          policyTitle: 'Title',
          policyBody: 'Text',
          emptyPolicies: 'No policies yet.',
          cancellationNote:
            'The cancellation policy is generated from the trip length and shown automatically.',
          /** Chỉ hiện khi dữ liệu cũ còn chính sách loại CANCELLATION (đo 24/09: không còn). */
          droppedCancellation: (n: number) =>
            n === 1
              ? 'One old cancellation policy is not shown here and will be removed when you save.'
              : `${n} old cancellation policies are not shown here and will be removed when you save.`,
        },
        costs: {
          errors: { /* Task 9 */ },
          addItem: 'Add cost line',
          itemName: (n: number) => `cost line ${n}`,
          category: 'Category',
          categories: {
            TRANSPORT: 'Transport',
            ACCOMMODATION: 'Accommodation',
            MEALS: 'Meals',
            GUIDE: 'Guide',
            ACTIVITIES: 'Activities',
            PERMITS: 'Permits',
            INSURANCE: 'Insurance',
            OTHER: 'Other',
          },
          label: 'Label',
          amount: 'Amount (USD)',
          basis: 'Charged',
          bases: { PER_PERSON: 'Per traveller', PER_DEPARTURE: 'Per departure' },
          empty: 'No cost lines yet, so this tour has no cost price.',
          totals: {
            title: 'Totals',
            perPerson: 'Per traveller',
            perDeparture: 'Per departure',
            costPrice: (group: number) => `Cost per traveller with a full group of ${group}`,
            margin: 'Margin on the base price',
            marginValue: (amount: string, percent: number) => `${amount} (${percent}%)`,
            none: 'Add a cost line to see the cost price.',
          },
          note: 'Saved costs apply to departures and bookings created from now on. Existing ones keep the costs they were created with.',
        },
```

- [ ] **Bước 2: Ba form — test đỏ trước.** Mỗi form một spec, dựng với
  `detailFixture` và action giả. Ca tối thiểu:
  - **Itinerary:** tour 3 ngày → ba thẻ "Day 1…3", mỗi thẻ có `id="day-N"` và
    ví dụ `09:00 — Pick-up at your hotel` làm placeholder; ngày chưa có hàng thì
    ô trống; tour ĐANG bán mà xoá tiêu đề ngày 2, Save → lỗi `dayTitleOnSale` dưới
    đúng ô ngày 2, action không được gọi; tour tắt bán thì payload chỉ có ngày có
    tiêu đề; có mô tả mà không tiêu đề → `descriptionWithoutTitle`; server trả
    `TOUR_NOT_READY` → dải liệt kê ngày thiếu (tính từ `projectedReadiness` với
    các ngày có tiêu đề).
  - **FAQ & policies:** hai `ListEditor` (tối đa 20 và 10); thêm, dời, xoá một
    câu hỏi rồi Save → payload đúng thứ tự trên màn hình; ô trống → `required`;
    loại chính sách là `FormSelect` hai mục "Booking"/"General"; câu
    `cancellationNote` luôn hiện; `detailFixture` có một chính sách
    `CANCELLATION` → thấy `droppedCancellation(1)`.
  - **Costs:** thêm hai dòng (Lunch 8.50 theo khách, Boat 100.01 theo chuyến,
    số khách tối đa 12, giá gốc 99.00) → khung Totals hiện "8.50", "100.01",
    "16.83" và biên lời "82.17 (83%)" NGAY khi gõ, trước khi Save; gõ dở số tiền
    `'12.'` → tổng bỏ qua dòng ấy thay vì hiện `NaN`; xoá hết dòng → câu
    `totals.none`; ghi chú `note` hiện cạnh nút Save.

- [ ] **Bước 3: Cài ba form** theo đúng khuôn `TourDetailsForm` (state `base`,
  `values`, `version`; `useSectionSave` với codec tương ứng; `EditorFormFrame`).
  Riêng:
  - Itinerary: `projected` = `projectedReadiness(detail, { itineraryDays: <ngày có tiêu đề> })`;
    `onFieldError` không dùng.
  - Costs: khung Totals đọc `costBreakdown(costDraftItems(values), detail.basePrice, detail.maxGroupSize)`,
    có `aria-live="polite"` để trình đọc màn hình nghe tổng mới; không có ô nhập
    giá vốn.
  - Mọi ô chọn (loại chính sách, hạng mục và cách tính chi phí) là `FormSelect`
    của kit (bài học 12).

- [ ] **Bước 4: Ba trang và ba action.** Mỗi trang cùng khuôn trang Details
  (`loadAdminTour`, `notFound()`, form với `key={detail.version}`), metadata
  `'Tour itinerary — Nexora back office'`, `'Tour FAQ and policies — Nexora back office'`,
  `'Tour costs — Nexora back office'`. Ba action trong `tours/[slug]/actions.ts`
  cùng khuôn `updateTourDetailsAction`.

- [ ] **Bước 5: Gate + commit.**

```bash
git add "apps/admin/src/app/(admin)/tours/[slug]/itinerary/page.tsx" "apps/admin/src/app/(admin)/tours/[slug]/content/page.tsx" "apps/admin/src/app/(admin)/tours/[slug]/costs/page.tsx" "apps/admin/src/app/(admin)/tours/[slug]/actions.ts" apps/admin/src/components/tours/editor/ libs/shared/i18n/src/lib/messages.ts
git commit -m "feat(admin): ba tab lịch trình, FAQ và chính sách, chi phí của khu làm việc tour"
```

---

## Task 13 — Gate cuối, docs, bàn giao

**Files:**

- Modify: `docs/CHANGELOG.md`
- Modify: `docs/open-items.md`

- [ ] **B1.** `git log --oneline main..HEAD` — mười hai commit của Task 1–12,
  không commit lạ. `git diff --stat main..HEAD` không chạm file nào trong danh
  sách "Không đụng" của Ràng buộc toàn cục, trừ ba file ngoại lệ của Task 2 (và
  ở ba file ấy chỉ có phần đổi chỗ import — đọc lại `git diff main..HEAD -- apps/api/src/modules/bookings/bookings.service.ts`).
- [ ] **B2.** Quy trình gate trên đỉnh nhánh; ghi lại số test từng gói (Vitest)
  và số int (ca, file) từ output.
- [ ] **B3. Entry CHANGELOG** — chèn ngay dưới khối `> **File này chỉ giữ đợt đang chạy**…`,
  TRÊN entry mới nhất. Ngày là ngày chạy bước này. Khuôn:

```markdown
## 2026-09-DD — F17 tạo và sửa tour (nhánh `feat/p4e-3a-tour-editor`)

Admin tạo được tour mới (đang tắt bán), sửa mọi nội dung chữ và số của tour qua
bốn tab của khu làm việc `/tours/[slug]`, bật bán khi tour đủ để bán, và xoá
được tour chưa từng có booking. Quyết định ở ADR-0047: mỗi tab một lệnh ghi,
khối danh sách thay nguyên, một `version` cho cả tour so-và-ghi trong một câu,
`tourReadiness` chặn bật bán. Ba hàm giá vốn dời lên contract, tính trên cent.
Không migration, không sửa web.

(Một đoạn cho mỗi thứ thấy được: hộp New tour · khu làm việc và thanh tab ·
bốn tab · công tắc bị khoá khi thiếu · xoá tour. Một đoạn cho đường tạo booking
đổi chỗ import. Một đoạn cho chỗ lệch plan nếu có, kèm lý do.)

**Giới hạn đã biết:** nút Back của trình duyệt không hỏi lại khi form còn thay
đổi (chỉ link trong app và `beforeunload` được canh); tạo chuyến và hạ số khách
tối đa chạy cùng lúc có thể để lại một chuyến nhiều ghế hơn số khách tối đa (lệnh
tạo chuyến của F12 không khoá hàng tour — một admin thì không gặp).

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **N** (web …, api …, admin …, contract …, core …, ui …,
tokens …, i18n …), int **N ở N file**. Liệt kê số ca mới theo gói và các đột
biến đã thử.
```

  Không để dòng nào bắt đầu bằng `+`; tổng số test gói trọn trong một dòng hoặc
  nối bằng chữ "và". `git diff docs/CHANGELOG.md` phải chỉ có phần thêm.
- [ ] **B4. `docs/open-items.md`:** sửa dòng P4e cho đúng hiện trạng (P4e-3a xong
  trên nhánh, chờ review; kế là F18 ảnh tour); thêm hai giới hạn đã biết ở B3 nếu
  file có mục cho loại việc ấy. `git diff docs/open-items.md` trước khi stage.
- [ ] **B5.** `./scripts/docs-freshness.sh` (Git Bash) — xanh.
- [ ] **B6. Commit:** `docs: entry CHANGELOG cho F17 tạo và sửa tour`
- [ ] **B7.** Tắt API (lệnh PowerShell ở Quy trình gate), xoá `/tmp/f17-api.log`.
- [ ] **B8. Bàn giao** — KHÔNG merge. Báo cho session gốc: danh sách commit ·
  kết quả gate (số test từng gói, int) · đột biến đã thử và kết quả (kể cả cái
  không giết được, kèm lý do) · mã lỗi Prisma đo được ở ba chỗ (`create` lồng điểm
  đến không tồn tại, `delete` bị `Restrict` chặn, `updateDetails` với danh mục
  không tồn tại) · chỗ lệch plan và vì sao · việc cần hạ tầng (dự kiến: không có).

## Sau khi bàn giao — việc của session gốc

1. Review nhánh ở mức max effort, vá TRỌN phát hiện trên chính nhánh này (nếp
   F14, F15, F16). Đọc kỹ ba file money-path của Task 2.
2. Hỏi user trước khi merge; rebase lên `main`, `git merge --ff-only`, push
   bằng SHA đích danh; `gh run list --branch main --limit 1` phải xanh.
3. Entry CHANGELOG ngày merge (bẫy `docs-freshness` khi rebase qua ngày); cập
   nhật dòng roadmap P4e trong `CLAUDE.md` và `docs/open-items.md`.
4. Chờ Render và Vercel deploy xong (khe deploy, ADR-0047 §Hệ quả), rồi thử tay
   trên production TỪNG BƯỚC, chờ user xác nhận (spec §5): tạo tour → điền đủ bốn
   tab → thêm chuyến → bật bán → khách thấy và đặt được (Stripe test) → đổi giá
   gốc → xoá một tour chưa bán. Kiểm DB bằng SQL chỉ đọc; trả DB về trạng thái
   gốc. Tour tạo để thử bị xoá ở bước cuối — nhưng tour đã có booking thì KHÔNG
   xoá được: dùng một tour thứ hai chưa bán cho bước xoá.

---

## Prompt bàn giao cho session thi công F17

Dán nguyên khối dưới đây vào một session Claude Code MỚI mở tại
`C:\Programming\Devs\Projects\Tourism-Platform-V2`.

```text
Bạn là session THI CÔNG của tourism-v2, làm việc NGAY TRONG checkout gốc
C:\Programming\Devs\Projects\Tourism-Platform-V2 (không tạo worktree). Đọc
theo thứ tự:
  CLAUDE.md                                                (15 luật + gotcha)
  docs/README.md                                           (bản đồ tài liệu)
  docs/adr/0047-tour-editor-sections.md                    (quyết định)
  docs/specs/2026-09-24-p4e-3a-tour-editor-design.md       (spec — HỢP ĐỒNG)
  docs/plans/2026-09-24-p4e-3a-tour-editor.md              (plan — làm theo)

VIỆC: tính năng F17 — admin tạo tour mới, sửa nội dung tour qua bốn tab của
khu làm việc /tours/[slug], bật bán khi tour đủ để bán, xoá tour chưa từng có
booking. Làm Task 1 → 13 đúng thứ tự, mỗi task một commit. Không làm gì ngoài
plan; thấy plan sai hay mâu thuẫn spec thì DỪNG và hỏi tôi.

TRƯỚC DÒNG CODE ĐẦU TIÊN: đọc mục "Quyết định của plan" (sáu chỗ plan chốt khác
bản nháp spec) và 16 bài học ở đầu plan. Ba vòng review gần nhất tìm ra 15, 27
và 15 lỗi thật; F17 lớn hơn cả ba cộng lại.

MỞ ĐẦU
- `git status` phải sạch và đang ở `main`;
  `git log --oneline -- docs/plans/2026-09-24-p4e-3a-tour-editor.md` phải thấy
  hai commit: "docs: plan thi công F17…" và "…plan F17 dùng FormSelect…". Rồi:
  git checkout -b feat/p4e-3a-tour-editor
- Docker Postgres phải đang chạy (`docker ps`) — integration test cần nó.

LUẬT BẤT DI BẤT DỊCH CỦA SESSION NÀY
- KHÔNG merge, KHÔNG push, KHÔNG rebase, KHÔNG dùng subagent.
- KHÔNG chạm hạ tầng sống (CLAUDE.md §15): không Supabase, không webhook, không
  env/redeploy Render/Vercel, không Cloudinary. F17 không có migration; thấy
  mình sắp cần một cái thì DỪNG và hỏi tôi.
- KHÔNG sửa apps/web, apps/mobile, apps/api/prisma/schema.prisma,
  apps/api/prisma/migrations/, module payments/refunds, catalog.service.ts.
  NGOẠI LỆ DUY NHẤT: Task 2 đổi chỗ import hàm giá vốn ở bookings.service.ts,
  admin-departures.service.ts và prisma/seed.ts — không gì khác trong ba file ấy.
- TDD (luật 4): test đỏ đúng lý do trước, rồi mới cài. Ca test mới nào cũng
  phải kiểm bằng đột biến — làm thật (sửa code cho sai, thấy đỏ, trả lại), ghi
  kết quả, kể cả đột biến không giết được và vì sao.
- Gate cuối mỗi task theo mục "Quy trình gate" của plan: chạy tách bước, hãm
  song song (máy từng phình RAM khi chạy gate:int trần), cần API sống cho build
  web; xong thì tắt API bằng lệnh PowerShell trong plan (tác vụ nền của gate
  không báo xong chừng nào cổng 3001 còn sống).
- Comment code TIẾNG VIỆT (luật 8); copy người dùng thấy bằng TIẾNG ANH trong
  @tourism/i18n (luật 7). Tokens-only, không hex (luật 6).
- Commit Conventional Commits, message TIẾNG VIỆT CÓ DẤU, KHÔNG AI attribution —
  không dòng Co-Authored-By (luật 12). Stage theo đường dẫn tường minh, không
  `git add -A`. Chạy `pnpm lint:fix` trước khi stage.
- Contract và i18n được đọc từ dist: sửa xong phải build lại trước khi test
  api/admin (lệnh ở Ràng buộc toàn cục của plan).
- Rà docs/skills.md trước khi bắt tay (luật 9).

NĂM CHỖ DỄ SAI (plan có đủ chi tiết)
1. So-và-ghi phiên bản nằm TRONG câu UPDATE (`claimTour`), không đọc updatedAt
   bằng câu riêng. Lưu tab con cũng đẩy version. Mọi câu ghi sau trong cùng
   transaction đặt `updatedAt: next` tường minh (Task 6).
2. "Đang bán thì luôn đủ để bán": kiểm tourReadiness SAU khi ghi, TRƯỚC commit,
   chỉ khi tour đang bán. setPublished khoá hàng tour bằng SELECT … FOR UPDATE
   trước khi đọc, KHÔNG đẩy updatedAt, và gỡ bán không bao giờ bị chặn (Task 7).
3. Task 2 chạm đường tạo booking: viết test đối chiếu hai bản trên fixture seed
   TRƯỚC khi xoá bản Prisma.Decimal; chỉ đổi chỗ import và thêm costItemsOf.
   Test nào đỏ vì kiểu Decimal/chuỗi thì DỪNG, không sửa test.
4. Xoá tour: để khoá ngoại quyết (P2003 → TOUR_HAS_BOOKINGS), không đếm booking
   trước. DB xoá theo cả đánh giá gắn tour — hộp xác nhận phải nói đúng từng
   thứ mất (Task 5, 11).
5. Admin: nút bị khoá lúc đang focus dùng focusableWhenDisabled; MỌI ô chọn là
   FormSelect của kit (không <select> gốc); ô chọn có cả danh mục/điểm đến đang
   ẩn, mang "(hidden)"; form dựng với key={detail.version};
   mọi câu copy hứa hệ quả đã đo trên code — đừng tự thêm câu hứa mới chưa đo
   (Task 8–12).

BÀN GIAO KHI XONG
Không merge. Viết cho tôi: danh sách commit; kết quả gate (số test từng gói, số
int); đột biến đã thử và kết quả; mã lỗi Prisma đo được ở ba chỗ plan hỏi; chỗ
lệch plan và vì sao; việc cần hạ tầng (dự kiến: không có).
```
