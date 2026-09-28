# Plan thi công F18 — Ảnh tour (P4e-3b)

> **Cho agent thi công:** làm tuần tự từng task bằng skill
> `superpowers:executing-plans`. Bước dùng checkbox `- [ ]`. Prompt bàn giao ở
> cuối file KHÔNG cho dùng subagent.

**Mục tiêu:** admin dựng được bộ ảnh cho một tour — tải ảnh của mình lên, lấy ảnh
có sẵn từ kho địa danh, sắp thứ tự, chọn ảnh bìa, viết alt — và sửa bộ ảnh của một
tour đang bán, mà không bao giờ làm mất một ảnh thư viện đã kiểm chứng giấy phép.

**Kiến trúc (ADR-0048):** ảnh của tour là MỘT danh sách có thứ tự trong
`media_assets` (vị trí 0 là `hero` = ảnh bìa); một lệnh ghi `setPhotos` thay trọn
danh sách, khoá phiên bản như mọi tab F17; ảnh tải lên ký theo lô rồi đi thẳng lên
Cloudinary; thư viện là kho ảnh địa danh; chỉ ảnh tự tải lên mới vào lại hàng dọn
(ADR-0035). Không migration, không sửa web, không sửa mobile.

**Stack:** Zod 4 (contract) · NestJS 11 + Prisma 7 + oRPC (api) · Next.js 16 +
React 19 + Base UI (admin) · Vitest.

**Spec:** [2026-09-28-p4e-3b-tour-photos-design.md](../specs/2026-09-28-p4e-3b-tour-photos-design.md)
— HỢP ĐỒNG của việc này; plan chỉ nói cách làm.
**ADR:** [0048 — ảnh tour](../adr/0048-tour-photos.md) · nền:
[0021](../adr/0021-media-write-surface.md) · [0035](../adr/0035-media-lifecycle.md) ·
[0047](../adr/0047-tour-editor-sections.md)

| Tính năng | Nhánh | Task |
| --- | --- | --- |
| **F18** ảnh tour | `feat/p4e-3b-tour-photos` | 1–14 |

## Quyết định của plan

Spec để ngỏ hoặc nói chưa đúng tám chỗ dưới đây. Plan chốt như sau, và spec §2g,
§3 đã được sửa trong cùng commit với plan:

1. **Dòng nguồn của ảnh thư viện là "From the library", không kèm tên địa danh.**
   `AdminTourPhoto` không mang địa danh, và tra ngược publicId → địa danh chỉ để in
   một nhãn là một câu truy vấn không đáng. Phần ghi công ("Photo: tác giả, giấy
   phép") vẫn in khi có.
2. **Không có nút huỷ khi đang tải.** Mockup có dấu ×, nhưng huỷ giữa chừng cần
   `xhr.abort()` cộng một trạng thái "đã huỷ" nữa. Tải xong thì gỡ bằng thùng rác;
   tải hỏng thì Remove.
3. **Schema `upload` chỉ canh dạng, không canh trần.** `width`/`height`/`bytes` là
   số nguyên dương, `version` là chuỗi chữ số. Trần 2400px và 10 MB do Cloudinary
   thi hành (tham số ký và gói free); đặt lại ở schema chỉ sinh thêm một cách để
   một ảnh ĐÃ tải lên thành công bị từ chối lúc lưu.
4. **`EditorFormFrame` nhận `blockedNote`.** Save khoá khi còn file đang tải, câu
   "Waiting for N uploads to finish." thay chỗ ghi chú. `pending` không dùng được:
   nhãn nút sẽ thành "Saving…" trong khi chẳng có gì đang lưu.
5. **Khe deploy:** `fetchAdminTour` lùi `photos` về `[]` và `readiness.cover` về
   `true` khi API cũ chưa trả hai field ấy (bài học 13 của F17). Client oRPC của
   admin không kiểm response, nên thiếu field là `undefined` và tab sập.
6. **G11 chỉ đếm điều kiện DO lệnh này làm hỏng** (bản hiện tại đạt, bản dự tính
   hỏng). Đúng y ba luật viết tay cũ, và không đổ lỗi cho lệnh sửa vì một chỗ thiếu
   có từ trước. Server vẫn là trọng tài cuối.
7. **"Make cover" chuyển tiêu điểm vào ô alt của ảnh bìa mới** — nút vừa bấm biến
   mất cùng dòng cũ, tiêu điểm không được rơi về `<body>` (bài học 10).
8. **Thứ tự tab:** Details · Photos · Itinerary · FAQ & policies · Costs ·
   Departures.

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
- **Không đụng**: `apps/web`, `apps/mobile`, `apps/api/prisma/schema.prisma`,
  `apps/api/prisma/migrations/` (F18 KHÔNG có migration), `apps/api/prisma/seed.ts`,
  bộ script `apps/api/scripts/media-*.mjs` và `apply-alt-text.mjs`, module
  `payments`/`refunds`/`bookings`, `catalog.service.ts` (API công khai),
  `media.controller.ts` và `upload-signing.service.ts` (đường ký của KHÁCH).
- **Không hạ tầng sống** (luật 15): không Supabase, không Cloudinary thật, không
  env hay redeploy Render/Vercel. F18 không cần gì từ hạ tầng; thấy mình sắp cần
  thì DỪNG và hỏi.
- **Tên cố định** (review sẽ grep đúng chữ):
  - Thao tác: `admin.tours.setPhotos` · `admin.tours.signPhotoUploads` ·
    `admin.tours.photoLibrary`; `admin.tours.get` trả thêm `photos`.
  - Mã lỗi mới: `PHOTO_NOT_ALLOWED`. Dùng lại: `STALE_TOUR` · `TOUR_NOT_READY` ·
    `NOT_FOUND` · `MEDIA_UPLOAD_NOT_CONFIGURED`.
  - Route API: `POST /api/admin/tours/{id}/photos` · `POST
    /api/admin/tours/{id}/photo-uploads` · `GET /api/admin/tour-photo-library`.
  - Route admin: `/tours/[slug]/photos`.
  - Readiness: input `hasCover`, output `cover`.
  - Thư mục tải lên: `<root>/tours/<tourId>` (`root` = `CLOUDINARY_UPLOAD_FOLDER`).
- **Trần dữ liệu** (spec §3): ≤ 30 ảnh mỗi tour (`TOUR_PHOTOS_MAX`), alt 1..300 sau
  khi bỏ khoảng trắng (`TOUR_PHOTO_ALT_MAX`), file ≤ 10 MB (`TOUR_PHOTO_MAX_BYTES`,
  chỉ canh ở admin), `count` ký 1..30.
- **Chữ trên giao diện:** On sale / Off sale là công tắc đăng; "cover" là ảnh bìa;
  "library" là kho địa danh. Không dùng "gallery" trên giao diện admin.
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
(cd apps/api && node --env-file-if-exists=.env.local dist/main.js > /tmp/f18-api.log 2>&1 &)
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

Cả năm bước xanh mới được khai task xong. Chạy gate trong một tác vụ nền thì tác vụ
ấy KHÔNG báo xong chừng nào API cổng 3001 còn sống — tắt API là nó xong. Máy chậm
bất thường thì dừng và báo.

## Bài học mang sang — đọc TRƯỚC dòng code đầu tiên

Vòng review F17 tìm ra 24 lỗi thật; F14, F15, F16 lần lượt 15, 27, 15. Những lỗi
dưới đây lặp đi lặp lại, và F18 đi đúng qua các vùng ấy.

**API**

1. **Lỗi DB bắt ngay tại câu ghi**, không SELECT kiểm trước: `P2025` →
   `NOT_FOUND`, `P2003` ở `delete` → `TOUR_HAS_BOOKINGS`.
2. **So-và-ghi phiên bản trong MỘT câu** — gọi `claimTour` đầu transaction, không
   tự đọc `updatedAt` rồi so.
3. **Bust cache SAU commit** bằng `this.bust(slug)`; lệnh ghi hỏng thì KHÔNG bust.
4. **Controller:** `@Roles(ADMIN)` đã ở cấp class; đổi lỗi bằng `toContractError`,
   chỉ mã procedure KHAI mới đi qua. Không so `error.name`.
5. **Việc phụ không làm hỏng việc chính** (ADR-0035 §7): `requeue` nằm TRONG
   transaction của lệnh ghi; `enqueueQuietly` khi không có transaction.

**Test**

6. **Mỗi ca test mới thử đột biến.** F14 có ba ca xanh giả, F15 có năm.
7. **Fixture phải phân biệt được kết quả đúng với kết quả lười.** Ca "chép ghi công
   từ thư viện" cần ghi công KHÁC nhau giữa dòng thư viện và thứ client gửi; ca thứ
   tự cần thứ tự gửi KHÁC thứ tự đang lưu; ca biên cần đúng N (được) và N+1 (bị bắt).
8. **Khối guard của int spec kể ĐỦ mọi route mới, cộng một ca 401.**
9. **Khớp chữ chính xác, không `/…/i`.**

**Admin**

10. **Tiêu điểm không bao giờ rơi về `<body>`:** nút có thể bị khoá lúc đang focus
    dùng `focusableWhenDisabled`; nút biến mất sau khi bấm thì chủ động chuyển
    tiêu điểm (quyết định 7); gỡ dòng cuối thì về nút Upload photos (`emptyFocus`).
11. **Mọi câu copy hứa hệ quả phải đo trên code trước khi viết.** Hai vòng review
    liền bắt được câu copy nói sai. F18 phải sửa ba câu cũ đang nói sai sau khi có
    điều kiện ảnh bìa (Task 9).
12. **Key của dòng dựng từ dữ liệu server phải tất định** (`photo-0`, `photo-1`…),
    không `newItemKey()` — form dựng hai lần (SSR rồi hydrate). Dòng thêm MỚI trên
    trình duyệt mới dùng `newItemKey()`.
13. **Dùng lại, đừng chép:** `FormField`, `ListEditor` (`labelledRows`),
    `EditorFormFrame`, `useTourFormState`, `useSectionSave`, `usePublishSavedDetail`,
    `createWriteErrorCodec`, `FormSelect` (MỌI ô chọn), `DIALOG_FRAME`.
14. **Thumbnail không `c_fill`** (ADR-0020 §4) — khác `reviewPhotoThumb`.

**Quy trình**

15. **Khe deploy:** field MỚI ở response của endpoint CŨ phải có đường lùi phía đọc
    (quyết định 5).
16. **Comment không khai trạng thái tương lai** ("Task X sẽ…").
17. **Entry CHANGELOG viết theo ngày viết**; session review thêm entry merge.

## Bản đồ file

| File | Trách nhiệm | Task |
| --- | --- | --- |
| `libs/shared/contract/src/schemas/media.ts` | `MediaPublicIdSchema` — cổng ký tự MỌI publicId client gửi | 1 |
| `libs/shared/contract/src/schemas/reviews.ts` | `ReviewPhotoPublicIdSchema` thành bí danh | 1 |
| `libs/shared/contract/src/schemas/tour-readiness.ts` | `hasCover` → `cover` | 1 |
| `apps/api/src/modules/catalog/tour-state.ts` | `readTourReadiness` đếm ảnh bìa | 1 |
| `apps/api/src/modules/catalog/admin-tour-errors.ts` | Câu thiếu "a cover photo"; lỗi `PHOTO_NOT_ALLOWED`, `MEDIA_UPLOAD_NOT_CONFIGURED` | 1, 3, 5 |
| `libs/shared/contract/src/schemas/admin-tours.ts` | Hằng trần, schema ảnh, `photos` trong detail, ba input mới | 2–5 |
| `libs/shared/contract/src/contract.ts` | Ba thủ tục mới | 3–5 |
| `apps/api/src/lib/upload-signing.ts` | `tourPhotoFolder`, `isTourUploadPublicId` | 2 |
| `apps/api/src/modules/catalog/tour-photos.ts` | Thuần: thứ tự ảnh, dòng → ảnh admin, `planTourPhotos` | 2, 4, 5 |
| `apps/api/src/modules/catalog/admin-tours.service.ts` | `get`, `signPhotoUploads`, `photoLibrary`, `setPhotos`, `delete` | 1–6 |
| `apps/api/src/modules/catalog/admin-tours.controller.ts` | Ba handler mới | 3–5 |
| `apps/api/src/modules/catalog/admin-tours.int.spec.ts` | Int test của mọi thứ trên | 1–6 |
| `apps/api/src/modules/catalog/admin-catalog.int.spec.ts` | Cổng đăng tour có điều kiện ảnh bìa | 1 |
| `apps/admin/src/test/tour-detail.ts` | Fixture có `photos` | 1, 2 |
| `apps/admin/src/lib/api/tours.ts` | Lùi khe deploy; ba client mới | 2, 11 |
| `apps/admin/src/lib/tour-editor-view.ts` | `projectedReadiness` nhận `photoCount`, `onSaleShortfalls`, tab Photos, mục readiness `cover`, `tourPhotoThumb`, `cloudinaryImageUrl` | 1, 7, 9 |
| `apps/admin/src/lib/tour-editor-write.ts` | Validator Details, Itinerary suy từ `onSaleShortfalls` (G11) | 7 |
| `apps/admin/src/components/kit/list-editor.tsx` | `newItem` tuỳ chọn, `emptyFocus` | 8 |
| `apps/admin/src/components/tours/editor/editor-form-frame.tsx` | `blockedNote` | 8 |
| `libs/shared/i18n/src/lib/messages.ts` | Khối `photos`, sửa ba câu cũ | 9 |
| `apps/admin/src/lib/security-headers.ts` | `connect-src https://api.cloudinary.com` | 9 |
| `apps/admin/src/components/tours/editor/delete-tour-zone.tsx` | Hàng "Photos" trong hộp xoá | 9 |
| `apps/admin/src/lib/tour-photos.ts` | Thuần: giá trị form, kiểm, payload, lọc file, sức chứa, chạy song song có trần | 10 |
| `apps/admin/src/lib/photo-upload.ts` | Dựng form Cloudinary, đọc phản hồi, XHR có tiến độ | 10 |
| `apps/admin/src/app/(admin)/tours/[slug]/actions.ts` | Ba server action | 11 |
| `apps/admin/src/app/(admin)/tours/[slug]/photos/page.tsx` | Tab Photos | 11 |
| `apps/admin/src/components/tours/editor/tour-photos-form.tsx` | Tab Photos: danh sách, tải lên, lưu | 12 |
| `apps/admin/src/components/tours/editor/photo-library-dialog.tsx` | Hộp Add from library | 13 |

---

> Mở nhánh: `git checkout -b feat/p4e-3b-tour-photos` (từ `main` đã có ADR-0048,
> spec F18 và plan này).

## Task 1 — Cổng ký tự publicId và điều kiện ảnh bìa trong readiness

**Files:**

- Modify: `libs/shared/contract/src/schemas/media.ts`, `media.spec.ts`
- Modify: `libs/shared/contract/src/schemas/reviews.ts`
- Modify: `libs/shared/contract/src/schemas/tour-readiness.ts`, `tour-readiness.spec.ts`
- Modify: `apps/api/src/modules/catalog/tour-state.ts`
- Modify: `apps/api/src/modules/catalog/admin-tour-errors.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.service.ts` (`toDetail`, `get`)
- Modify: `apps/api/src/modules/catalog/admin-tours.int.spec.ts`
- Modify: `apps/api/src/modules/catalog/admin-catalog.int.spec.ts`
- Modify: `apps/admin/src/lib/tour-editor-view.ts`, `tour-editor-view.spec.ts`
- Modify: `apps/admin/src/test/tour-detail.ts`
- Modify: `apps/admin/src/components/tours/editor/tour-readiness-panel.spec.tsx`
- Modify: `apps/admin/src/lib/use-section-save.spec.tsx`

**Interfaces:**

- Produces: `MediaPublicIdSchema` (contract, `media.ts`);
  `TourReadinessInput.hasCover: boolean`; `TourReadiness.cover: boolean`;
  `hasTourCover(db, tourId): Promise<boolean>` (`tour-state.ts`);
  `projectedReadiness(detail, { …, photoCount?: number })` (admin).

- [ ] **B1. Test đỏ ở contract.** Thêm vào `media.spec.ts`:

```ts
import { MediaItemSchema, MediaPublicIdSchema, SignUploadInputSchema } from './media.js';
import { ReviewPhotoPublicIdSchema } from './reviews.js';

describe('MediaPublicIdSchema — cổng ký tự cho publicId client gửi (ADR-0035 AMEND 2e)', () => {
  it('nhận publicId thật: thư mục lồng, uuid, gạch ngang, gạch dưới, dấu chấm', () => {
    for (const id of [
      'tourism/tours/7a1b2c3d-0000-4000-8000-000000000001/0f9e8d7c-aaaa-4bbb-8ccc-123456789abc',
      'tourism/catalog/destination/hoi-an/lantern_street.v2',
    ]) {
      expect(MediaPublicIdSchema.safeParse(id).success).toBe(true);
    }
  });

  it('chặn đoạn rỗng, `..`, khoảng trắng, dấu gạch chéo đầu/cuối, ký tự lạ', () => {
    for (const id of ['', '..', 'a/../b', 'a//b', '/a', 'a/', 'a b', 'a?b', 'ảnh']) {
      expect(MediaPublicIdSchema.safeParse(id).success).toBe(false);
    }
  });

  it('trần 300 ký tự — gương cột `public_id` VARCHAR(300)', () => {
    expect(MediaPublicIdSchema.safeParse('a'.repeat(300)).success).toBe(true);
    expect(MediaPublicIdSchema.safeParse('a'.repeat(301)).success).toBe(false);
  });

  it('ảnh review dùng CHÍNH cổng này — một cổng cho mọi publicId', () => {
    expect(ReviewPhotoPublicIdSchema).toBe(MediaPublicIdSchema);
  });
});
```

  Trong `tour-readiness.spec.ts`: thêm `hasCover: true` vào `READY`; ca "đủ cả ba"
  đổi tên thành "đủ cả bốn thì ready" và `toEqual` thêm `cover: true` (đặt giữa
  `missingDays` và `ready`). Thêm ca:

```ts
  it('không có ảnh bìa thì thiếu — ba điều kiện kia vẫn đủ (F18, ADR-0048 §8)', () => {
    expect(tourReadiness({ ...READY, hasCover: false })).toEqual({
      summary: true,
      primaryDestination: true,
      missingDays: [],
      cover: false,
      ready: false,
    });
  });
```

- [ ] **B2.** `pnpm --filter @tourism/contract exec vitest run src/schemas/media.spec.ts src/schemas/tour-readiness.spec.ts`
  → ĐỎ: `MediaPublicIdSchema` không tồn tại; `cover` không có trong kết quả.

- [ ] **B3. Cài ở contract.** `media.ts`, dưới `MediaItemSchema`:

```ts
/**
 * Cổng ký tự cho MỌI publicId client gửi lên (ADR-0035 AMEND 2e, ADR-0048): chữ,
 * số, `_`, `-`, nối bằng `.` hoặc `/`; không đoạn rỗng, không `..`. Từ ADR-0035
 * một chuỗi lạ ở đây không còn chỉ là ảnh vỡ — nó là đối số của một lệnh destroy
 * bảy ngày sau. Trần 300 gương cột `public_id`.
 */
export const MediaPublicIdSchema = z
  .string()
  .min(1)
  .max(300)
  .regex(/^[A-Za-z0-9_-]+(?:[./][A-Za-z0-9_-]+)*$/, 'Invalid photo reference');
```

  `reviews.ts`: thay khối khai `ReviewPhotoPublicIdSchema` bằng bí danh, giữ nguyên
  comment giải thích phía trên nó:

```ts
import { MediaPublicIdSchema } from './media.js';

export const ReviewPhotoPublicIdSchema = MediaPublicIdSchema;
```

  `tour-readiness.ts`:

```ts
/**
 * "Tour này đã đủ để bán chưa" (ADR-0047 §4) — THUẦN, dùng ở ba nơi: API chặn
 * `setPublished(true)` và chặn lệnh sửa làm một tour ĐANG BÁN trở nên thiếu;
 * admin in khung readiness và báo trước khi lưu. Một luật, một bản.
 *
 * Bốn điều kiện: có tóm tắt, đúng một điểm đến chính, lịch trình đủ mọi ngày 1..N,
 * và có ảnh bìa (F18, ADR-0048 §8). Cả 29 tour hiện có đều đạt cả bốn (đo 28/09).
 */
export interface TourReadinessInput {
  summary: string | null;
  destinations: readonly { isPrimary: boolean }[];
  durationDays: number;
  /** `dayNumber` của các ngày ĐÃ có hàng — hàng lịch trình luôn có tiêu đề. */
  itineraryDays: readonly number[];
  /** Tour có dòng `media_assets` role `hero` — ảnh đầu danh sách ảnh (ADR-0048 §1). */
  hasCover: boolean;
}

export const TourReadinessSchema = z.object({
  summary: z.boolean(),
  primaryDestination: z.boolean(),
  /** Ngày 1..N chưa có lịch trình, tăng dần. */
  missingDays: z.array(z.int().positive()),
  cover: z.boolean(),
  ready: z.boolean(),
});
```

  và trong `tourReadiness` thêm `const cover = input.hasCover;`, trả `cover`, và
  `ready: summary && primaryDestination && missingDays.length === 0 && cover`.

- [ ] **B4.** Chạy lại lệnh B2 → XANH. Build contract (lệnh ở Ràng buộc toàn cục).
  Đột biến: bỏ `&& cover` khỏi `ready` → ca "không có ảnh bìa" đỏ; nới regex thành
  `^[A-Za-z0-9_./-]+$` → ca `..`/`a//b` đỏ. Trả lại.

- [ ] **B5. Test đỏ ở API (int).** Trong `admin-tours.int.spec.ts`:

  - `beforeEach`, ngay sau `await prisma.post.deleteMany();`, thêm:

```ts
    // media_assets là bảng đa chủ, KHÔNG có khoá ngoại tới `tours` (ADR-0048) —
    // xoá tour không kéo dòng ảnh theo, nên id tour dùng lại giữa các ca sẽ nhặt
    // nhầm ảnh của ca trước.
    await prisma.mediaAsset.deleteMany();
    await prisma.mediaGarbage.deleteMany();
```

  - `makeTour` thành hàm async tạo thêm ảnh bìa — tour "ĐỦ để bán" từ F18 phải có:

```ts
  /** Một tour ĐỦ để bán, 2 ngày, đang bán, có ảnh bìa — ca nào cần khác thì đè bằng `patch`. */
  const makeTour = async (n: number, patch: Partial<Prisma.TourUncheckedCreateInput> = {}) => {
    const tour = await prisma.tour.create({
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
    await prisma.mediaAsset.create({
      data: {
        ownerType: 'TOUR',
        ownerId: tour.id,
        publicId: `tourism/catalog/tour/f17-${n}`,
        type: 'IMAGE',
        role: 'hero',
        sortOrder: 0,
        alt: `Cover of tour ${n}`,
        version: '1700000000',
      },
    });
    return tour;
  };
```

  - Hai chỗ so nguyên object `readiness` (`toEqual({ summary…, ready })`, trong ca
    "trả đủ tour…" và ca "tour TẮT bán: làm thiếu vẫn lưu được…") thêm `cover: true`
    trước `ready`.
  - Trong `describe('get')` thêm:

```ts
    it('tour chưa có ảnh bìa thì readiness.cover = false và không ready (F18)', async () => {
      await makeTour(1);
      await prisma.mediaAsset.deleteMany({ where: { ownerId: tourId(1) } });

      const detail = await detailOf('f17-tour-1');

      expect(detail.readiness.cover).toBe(false);
      expect(detail.readiness.ready).toBe(false);
    });
```

  - Trong `describe('setItinerary')` thêm (cổng "đang bán thì luôn đủ" biết điều kiện
    mới — dữ liệu sửa tay mất ảnh bìa):

```ts
    it('tour đang bán mà đã mất ảnh bìa thì lệnh sửa bị TOUR_NOT_READY, nói đúng chỗ thiếu', async () => {
      await makeTour(1);
      await prisma.mediaAsset.deleteMany({ where: { ownerId: tourId(1) } });
      const before = await detailOf('f17-tour-1');

      const res = await itinerary(before.id, {
        id: before.id,
        version: before.version,
        days: before.itinerary,
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({
        code: 'TOUR_NOT_READY',
        message: 'This tour is missing: a cover photo.',
      });
    });
```

  Trong `admin-catalog.int.spec.ts`:

  - `beforeEach`, sau khi tạo ngày lịch trình của ALPHA:

```ts
    // ALPHA đủ để bán từ F18 phải có ảnh bìa (ADR-0048 §8).
    await prisma.mediaAsset.create({
      data: {
        ownerType: 'TOUR',
        ownerId: ALPHA,
        publicId: 'tourism/catalog/tour/f11-alpha',
        type: 'IMAGE',
        role: 'hero',
        sortOrder: 0,
        alt: 'Alpha cover',
      },
    });
```

  - Câu của ca GAMMA thành
    `'This tour is missing: a summary, one primary destination, itinerary for day 1, a cover photo.'`.
  - Thêm một hàng vào `it.each`:

```ts
    [
      'chỉ thiếu ảnh bìa',
      () => prisma.mediaAsset.deleteMany({ where: { ownerId: ALPHA } }),
      'a cover photo',
    ],
```

- [ ] **B6.** `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/catalog/admin-tours.int.spec.ts src/modules/catalog/admin-catalog.int.spec.ts`
  → ĐỎ (TypeScript chưa đổi `toDetail`; `cover` chưa có; câu thiếu chưa có ảnh bìa).

- [ ] **B7. Cài ở API.** `tour-state.ts`:

```ts
import { type TourReadiness, tourReadiness } from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';
import { MediaOwnerType, MediaRole } from '../../generated/prisma/enums.js';

/**
 * Tour có ảnh bìa không — dòng `media_assets` role `hero` của tour (ADR-0048 §1).
 * Nhận client lẫn transaction: `get` hỏi ngoài transaction, `readTourReadiness`
 * hỏi trong transaction đang giữ khoá hàng tour.
 */
export async function hasTourCover(db: Prisma.TransactionClient, id: string): Promise<boolean> {
  const count = await db.mediaAsset.count({
    where: { ownerType: MediaOwnerType.TOUR, ownerId: id, role: MediaRole.hero },
  });
  return count > 0;
}
```

  và trong `readTourReadiness` truyền thêm `hasCover: await hasTourCover(tx, id)`.

  `admin-tour-errors.ts`, cuối `missingParts`:

```ts
    ...(readiness.cover ? [] : ['a cover photo']),
```

  `admin-tours.service.ts`: `toDetail(row, now, hasCover: boolean)` truyền
  `hasCover` vào `tourReadiness({ … })`; `get` gọi
  `toDetail(row, new Date(), await hasTourCover(prisma, row.id))` (import
  `hasTourCover` từ `./tour-state.js`). Task 2 thay đối số thứ ba bằng danh sách ảnh.

- [ ] **B8.** Chạy lại lệnh B6 → XANH. Đột biến: bỏ dòng `'a cover photo'` → ca
  it.each "chỉ thiếu ảnh bìa" đỏ; `readTourReadiness` truyền `hasCover: true` cứng →
  ca `setItinerary` mới đỏ. Trả lại.

- [ ] **B9. Admin.** `tour-editor-view.ts` — `projectedReadiness` nhận thêm số ảnh:

```ts
export function projectedReadiness(
  detail: AdminTourDetail,
  patch: {
    summary?: string | null;
    destinations?: readonly { isPrimary: boolean }[];
    durationDays?: number;
    itineraryDays?: readonly number[];
    /** Số ảnh của danh sách đang soạn ở tab Photos — ảnh đầu là ảnh bìa. */
    photoCount?: number;
  },
): TourReadiness {
  const durationDays = patch.durationDays ?? detail.durationDays;
  const days = patch.itineraryDays ?? detail.itinerary.map((day) => day.dayNumber);
  return tourReadiness({
    summary: patch.summary === undefined ? detail.summary : patch.summary,
    destinations: patch.destinations ?? detail.destinations,
    durationDays,
    itineraryDays: days.filter((day) => day <= durationDays),
    hasCover: patch.photoCount === undefined ? detail.readiness.cover : patch.photoCount > 0,
  });
}
```

  Test trong `describe('projectedReadiness')` của `tour-editor-view.spec.ts`:

```ts
  it('số ảnh đang soạn quyết ảnh bìa; vắng thì giữ ảnh bìa của server', () => {
    const detail = detailFixture();
    expect(projectedReadiness(detail, {}).cover).toBe(true);
    expect(projectedReadiness(detail, { photoCount: 0 }).cover).toBe(false);
    expect(projectedReadiness(detail, { photoCount: 0 }).ready).toBe(false);
    expect(projectedReadiness(detail, { photoCount: 2 }).cover).toBe(true);
  });
```

  `apps/admin/src/test/tour-detail.ts`: trong lời gọi `tourReadiness({ … })` thêm
  `hasCover: true,` (Task 2 đổi thành suy từ `photos`). Thêm `hasCover: true,` vào
  MỌI lời gọi `tourReadiness({` trong các spec admin — tìm bằng
  `grep -rn "tourReadiness({" apps/admin/src --include=*.spec.ts --include=*.spec.tsx`
  (đo 28/09: `tour-editor-view.spec.ts` ba chỗ, `tour-readiness-panel.spec.tsx` hai
  chỗ, `use-section-save.spec.tsx` một chỗ).

- [ ] **B10.** `pnpm --filter @tourism/admin exec vitest run src/lib/tour-editor-view.spec.ts`
  → ca mới xanh (đỏ trước khi thêm `photoCount`). Đột biến: đảo thành
  `patch.photoCount >= 0` → ca `photoCount: 0` đỏ.
- [ ] **B11.** Quy trình gate. Commit:
  `feat(contract): readiness đòi ảnh bìa, một cổng ký tự cho mọi publicId client gửi`

## Task 2 — `admin.tours.get` trả danh sách ảnh

**Files:**

- Modify: `libs/shared/contract/src/schemas/admin-tours.ts`, `admin-tours.spec.ts`
- Modify: `apps/api/src/lib/upload-signing.ts`, `upload-signing.spec.ts`
- Create: `apps/api/src/modules/catalog/tour-photos.ts`, `tour-photos.spec.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.service.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.int.spec.ts`
- Modify: `apps/admin/src/test/tour-detail.ts`
- Modify: `apps/admin/src/lib/api/tours.ts`, `tours.spec.ts`

**Interfaces:**

- Consumes: `hasTourCover` (Task 1).
- Produces: `TourPhotoSourceSchema`, `AdminTourPhotoSchema`, `AdminTourPhoto`,
  `AdminTourDetail.photos` (contract); `tourPhotoFolder(rootFolder, tourId)`,
  `isTourUploadPublicId(rootFolder, tourId, publicId)` (`upload-signing.ts`);
  `orderTourPhotos<T extends { role: string; sortOrder: number }>(items): T[]`,
  `toAdminTourPhoto(item: MediaItem, rootFolder, tourId): AdminTourPhoto`
  (`tour-photos.ts`); `withPhotoFallback(detail)` (admin `lib/api/tours.ts`).

- [ ] **B1. Test đỏ ở contract** (`admin-tours.spec.ts`):

```ts
describe('AdminTourDetailSchema.photos (F18)', () => {
  it('nhận ảnh có hoặc không có ghi công; nguồn chỉ là UPLOAD hay LIBRARY', () => {
    const photo = {
      publicId: 'tourism/catalog/destination/hoi-an/1',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/x',
      alt: 'Lanterns',
      width: 2400,
      height: 1600,
      source: 'LIBRARY',
      author: 'J. Nguyen',
      license: 'CC BY-SA 4.0',
    };
    expect(AdminTourPhotoSchema.parse(photo)).toEqual(photo);
    expect(AdminTourPhotoSchema.safeParse({ ...photo, source: 'CATALOG' }).success).toBe(false);
    expect(
      AdminTourPhotoSchema.safeParse({ ...photo, alt: null, author: null, license: null }).success,
    ).toBe(true);
  });
});
```

- [ ] **B2.** Chạy → ĐỎ (`AdminTourPhotoSchema` không tồn tại).
- [ ] **B3. Cài ở contract.** `admin-tours.ts`, mục `// ── Đọc ──`, trước
  `AdminTourDetailSchema`:

```ts
/** Nguồn của một ảnh tour — suy từ thư mục của publicId, không lưu thành cột (ADR-0048 §3). */
export const TourPhotoSourceSchema = z.enum(['UPLOAD', 'LIBRARY']);
export type TourPhotoSource = z.output<typeof TourPhotoSourceSchema>;

/**
 * Một ảnh của tour như tab Photos cần. Lỏng như mọi schema HÀNG: `alt` có thể
 * null ở dữ liệu cũ. Ghi công (ADR-0020) chỉ ảnh thư viện có.
 */
export const AdminTourPhotoSchema = z.object({
  publicId: z.string().min(1),
  url: z.url(),
  alt: z.string().nullable(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  source: TourPhotoSourceSchema,
  author: z.string().nullable(),
  license: z.string().nullable(),
});
export type AdminTourPhoto = z.output<typeof AdminTourPhotoSchema>;
```

  và trong `AdminTourDetailSchema`, ngay trước `readiness`:

```ts
  /** Theo thứ tự hiển thị: ảnh bìa (`hero`) đầu, rồi gallery theo `sortOrder` (ADR-0048 §1). */
  photos: z.array(AdminTourPhotoSchema),
```

- [ ] **B4.** Chạy lại → XANH. Build contract.
- [ ] **B5. Test đỏ, hàm thuần API.** `upload-signing.spec.ts`:

```ts
describe('tourPhotoFolder / isTourUploadPublicId (ADR-0048 §3)', () => {
  const TOUR = '7a1b2c3d-0000-4000-8000-000000000001';

  it('thư mục tải lên của một tour nằm dưới <root>/tours/<tourId>', () => {
    expect(tourPhotoFolder('tourism', TOUR)).toBe(`tourism/tours/${TOUR}`);
  });

  it('chỉ publicId trong ĐÚNG thư mục ấy mới là ảnh tải lên của tour', () => {
    expect(isTourUploadPublicId('tourism', TOUR, `tourism/tours/${TOUR}/abc`)).toBe(true);
    // Tiền tố gần giống: id tour khác bắt đầu bằng id này, thiếu `/` chốt đuôi thì khớp nhầm.
    expect(isTourUploadPublicId('tourism', TOUR, `tourism/tours/${TOUR}0/abc`)).toBe(false);
    expect(isTourUploadPublicId('tourism', TOUR, `tourism/tours/${TOUR}`)).toBe(false);
    // Thư mục cũ có sẵn trên cloud (ADR-0020 Hệ quả) và ảnh thư viện.
    expect(isTourUploadPublicId('tourism', TOUR, 'tourism/tours/hero/abc')).toBe(false);
    expect(isTourUploadPublicId('tourism', TOUR, 'tourism/catalog/tour/abc')).toBe(false);
  });
});
```

  `tour-photos.spec.ts` (mới):

```ts
import type { MediaItem } from '@tourism/contract';
import { orderTourPhotos, toAdminTourPhoto } from './tour-photos.js';

const TOUR = '7a1b2c3d-0000-4000-8000-000000000001';

const item = (over: Partial<MediaItem>): MediaItem => ({
  publicId: 'tourism/catalog/destination/hoi-an/1',
  url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/x',
  type: 'IMAGE',
  role: 'gallery',
  posterUrl: null,
  width: 2400,
  height: 1600,
  alt: 'Lanterns',
  sortOrder: 1,
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
  ...over,
});

describe('orderTourPhotos', () => {
  it('ảnh bìa đứng đầu bất kể sortOrder; gallery theo sortOrder tăng dần', () => {
    const hero = item({ publicId: 'h', role: 'hero', sortOrder: 9 });
    const second = item({ publicId: 'g2', sortOrder: 2 });
    const first = item({ publicId: 'g1', sortOrder: 1 });
    expect(orderTourPhotos([second, hero, first]).map((p) => p.publicId)).toEqual([
      'h',
      'g1',
      'g2',
    ]);
  });
});

describe('toAdminTourPhoto', () => {
  it('ảnh trong thư mục tải lên của tour là UPLOAD; còn lại là LIBRARY, giữ ghi công', () => {
    const upload = toAdminTourPhoto(
      item({ publicId: `tourism/tours/${TOUR}/abc`, author: null }),
      'tourism',
      TOUR,
    );
    const library = toAdminTourPhoto(
      item({ author: 'J. Nguyen', license: 'CC BY-SA 4.0' }),
      'tourism',
      TOUR,
    );
    expect(upload.source).toBe('UPLOAD');
    expect(library).toEqual({
      publicId: 'tourism/catalog/destination/hoi-an/1',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/x',
      alt: 'Lanterns',
      width: 2400,
      height: 1600,
      source: 'LIBRARY',
      author: 'J. Nguyen',
      license: 'CC BY-SA 4.0',
    });
  });
});
```

- [ ] **B6.** `pnpm --filter @tourism/api exec vitest run src/lib/upload-signing.spec.ts src/modules/catalog/tour-photos.spec.ts`
  → ĐỎ (hàm chưa có).
- [ ] **B7. Cài.** `upload-signing.ts`, dưới `uploadFolderFor`:

```ts
/** Thư mục ảnh admin tải lên cho MỘT tour (ADR-0048 §3) — server quyết, client không chọn. */
export function tourPhotoFolder(rootFolder: string, tourId: string): string {
  return `${rootFolder}/tours/${tourId}`;
}

/**
 * publicId có nằm trong thư mục tải lên của ĐÚNG tour này không. So theo tiền tố
 * có `/` chốt đuôi — cùng nếp `isOwnAvatarPublicId` — để tour có id là tiền tố của
 * id khác không khớp nhầm. Chỉ ảnh khớp ở đây mới được vào lại hàng dọn khi bị gỡ
 * (ADR-0048 §6); ảnh thư viện thì không bao giờ.
 */
export function isTourUploadPublicId(rootFolder: string, tourId: string, publicId: string): boolean {
  return publicId.startsWith(`${tourPhotoFolder(rootFolder, tourId)}/`);
}
```

  `tour-photos.ts` (mới):

```ts
import type { AdminTourPhoto, MediaItem } from '@tourism/contract';
import { isTourUploadPublicId } from '../../lib/upload-signing.js';

/**
 * Logic THUẦN của ảnh tour (ADR-0048) — thứ tự hiển thị và hình dạng admin.
 */

/**
 * Ảnh bìa (`hero`) đầu, rồi gallery theo `sortOrder` — đúng luật `tourGallery` của
 * web, để thứ tự admin thấy là thứ tự khách thấy. Không tin `sortOrder` của ảnh bìa:
 * dữ liệu seed không bảo đảm nó là 0.
 */
export function orderTourPhotos<T extends { role: string; sortOrder: number }>(
  items: readonly T[],
): T[] {
  const hero = items.filter((item) => item.role === 'hero');
  const rest = items
    .filter((item) => item.role !== 'hero')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return [...hero, ...rest];
}

/** Một asset đã dựng URL → ảnh như tab Photos cần; nguồn suy từ thư mục. */
export function toAdminTourPhoto(
  item: MediaItem,
  rootFolder: string,
  tourId: string,
): AdminTourPhoto {
  return {
    publicId: item.publicId,
    url: item.url,
    alt: item.alt,
    width: item.width,
    height: item.height,
    source: isTourUploadPublicId(rootFolder, tourId, item.publicId) ? 'UPLOAD' : 'LIBRARY',
    author: item.author,
    license: item.license,
  };
}
```

- [ ] **B8.** Chạy lại B6 → XANH. Đột biến: bỏ `/` chốt đuôi trong
  `isTourUploadPublicId` → ca "tiền tố gần giống" đỏ; bỏ `.sort(…)` → ca thứ tự đỏ.
- [ ] **B9. Test đỏ, int.** Trong `describe('get')` của `admin-tours.int.spec.ts`:

```ts
    it('trả ảnh theo thứ tự hiển thị, mỗi ảnh mang nguồn và ghi công (F18)', async () => {
      await makeTour(1);
      const media = (publicId: string, patch: Partial<Prisma.MediaAssetUncheckedCreateInput>) =>
        prisma.mediaAsset.create({
          data: {
            ownerType: 'TOUR',
            ownerId: tourId(1),
            publicId,
            type: 'IMAGE',
            role: 'gallery',
            alt: publicId,
            ...patch,
          },
        });
      // Chèn NGƯỢC thứ tự hiển thị — kết quả phải sắp lại, không theo thứ tự tạo.
      await media(`tourism/tours/${tourId(1)}/uploaded`, { sortOrder: 2, version: '1700000002' });
      await media('tourism/catalog/destination/hoi-an/1', {
        sortOrder: 1,
        author: 'J. Nguyen',
        license: 'CC BY-SA 4.0',
      });

      const detail = await detailOf('f17-tour-1');

      expect(detail.photos.map((p) => [p.publicId, p.source])).toEqual([
        ['tourism/catalog/tour/f17-1', 'LIBRARY'],
        ['tourism/catalog/destination/hoi-an/1', 'LIBRARY'],
        [`tourism/tours/${tourId(1)}/uploaded`, 'UPLOAD'],
      ]);
      expect(detail.photos[1]).toMatchObject({ author: 'J. Nguyen', license: 'CC BY-SA 4.0' });
      expect(detail.photos[2]?.url).toContain(`/v1700000002/tourism/tours/${tourId(1)}/uploaded`);
      expect(detail.readiness.cover).toBe(true);
    });
```

- [ ] **B10.** Chạy int spec của file → ĐỎ (`photos` chưa có trong response).
- [ ] **B11. Cài ở service.** Constructor nhận `MediaService`:

```ts
import { MediaOwnerType, MediaRole } from '../../generated/prisma/enums.js';
import { env } from '../../config/env.js';
import { MediaService } from '../media/media.service.js';
import { orderTourPhotos, toAdminTourPhoto } from './tour-photos.js';

  constructor(
    private readonly webRevalidation: WebRevalidationService,
    private readonly media: MediaService,
  ) {}
```

  `toDetail(row, now, media: readonly MediaItem[])` (import type `MediaItem` từ
  contract) — thay tham số `hasCover` của Task 1:

```ts
function toDetail(row: TourDetailRow, now: Date, media: readonly MediaItem[]): AdminTourDetail {
  const ordered = orderTourPhotos(media);
  return {
    // … mọi field như cũ …
    photos: ordered.map((item) => toAdminTourPhoto(item, env.CLOUDINARY_UPLOAD_FOLDER, row.id)),
    readiness: tourReadiness({
      summary: row.summary,
      destinations: row.destinations,
      durationDays: row.durationDays,
      itineraryDays: row.itinerary.map((day) => day.dayNumber),
      hasCover: ordered.some((item) => item.role === 'hero'),
    }),
  };
}
```

  `get`:

```ts
  async get(slug: string): Promise<AdminTourDetail> {
    const row = await prisma.tour.findUnique({ where: { slug }, select: TOUR_DETAIL_SELECT });
    if (!row) throw new AdminTourNotFoundError(slug);
    const media = await this.media.resolveForOwners(MediaOwnerType.TOUR, [row.id], [
      MediaRole.hero,
      MediaRole.gallery,
    ]);
    return toDetail(row, new Date(), media.get(row.id) ?? []);
  }
```

  Bỏ import `hasTourCover` ở service nếu không còn chỗ dùng (nó vẫn sống ở
  `readTourReadiness`). `CatalogModule` đã import `MediaModule` (export
  `MediaService`) — không đổi module.

- [ ] **B12.** Chạy lại int spec → XANH. Đột biến: `toDetail` bỏ `orderTourPhotos` →
  ca thứ tự đỏ; `hasCover: true` cứng → ca "chưa có ảnh bìa" (Task 1) đỏ.
- [ ] **B13. Admin: fixture và khe deploy.** `apps/admin/src/test/tour-detail.ts` —
  BASE thêm một ảnh thư viện, `hasCover` suy từ ảnh:

```ts
export const COVER_PHOTO: AdminTourPhoto = {
  publicId: 'tourism/catalog/tour/ha-long',
  url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1700000000/tourism/catalog/tour/ha-long',
  alt: 'Junk boats at sunset on Ha Long Bay',
  width: 2400,
  height: 1600,
  source: 'LIBRARY',
  author: null,
  license: null,
};
```

  (thêm `photos: [COVER_PHOTO],` vào BASE, `type AdminTourPhoto` vào import) và trong
  `tourReadiness({ … })` thay `hasCover: true` bằng `hasCover: merged.photos.length > 0`.

  Test đỏ trong `apps/admin/src/lib/api/tours.spec.ts`, `describe('fetchAdminTour …')`:

```ts
  it('khe deploy: API cũ chưa trả photos và readiness.cover → lùi về [] và true', async () => {
    const { photos: _photos, readiness, ...rest } = detailFixture();
    const { cover: _cover, ...oldReadiness } = readiness;
    getTourMock.mockResolvedValue({ ...rest, readiness: oldReadiness });

    const detail = await fetchAdminTour('cookie=x', 'ha-long-bay-cruise');

    expect(detail?.photos).toEqual([]);
    expect(detail?.readiness.cover).toBe(true);
  });
```

  Ca có sẵn "trả nguyên tour server gửi" so bằng `toBe(detail)` (cùng object) — hàm
  lùi trả object MỚI, nên đổi thành `toEqual(detail)`. Đó là sửa test đúng lý do:
  hành vi đọc không đổi, chỉ danh tính object đổi.
- [ ] **B14.** Chạy → ĐỎ. Cài trong `lib/api/tours.ts`:

```ts
/**
 * Hình dạng `admin.tours.get` của API TRƯỚC F18 — thiếu `photos` và `readiness.cover`.
 */
type PreF18TourDetail = Omit<AdminTourDetail, 'photos' | 'readiness'> & {
  photos?: AdminTourDetail['photos'];
  readiness: Omit<AdminTourDetail['readiness'], 'cover'> & { cover?: boolean };
};

/**
 * Khe deploy (bài học 13 của F17): Vercel đưa admin lên trước khi Render đưa API
 * lên, nên trong vài phút `get` của API cũ trả tour thiếu `photos` và
 * `readiness.cover`. Client oRPC của admin KHÔNG kiểm response, nên thiếu là
 * `undefined` và tab Photos sập. Lùi về: không ảnh, và coi như có ảnh bìa — API cũ
 * không chặn bật bán vì ảnh, và cả 29 tour đều có ảnh bìa.
 */
export function withPhotoFallback(detail: PreF18TourDetail): AdminTourDetail {
  return {
    ...detail,
    photos: detail.photos ?? [],
    readiness: { ...detail.readiness, cover: detail.readiness.cover ?? true },
  };
}
```

  và trong `fetchAdminTour` trả `withPhotoFallback(data)` thay vì `data`.
- [ ] **B15.** Chạy lại → XANH. Đột biến: `cover: … ?? false` → ca khe deploy đỏ.
- [ ] **B16.** Quy trình gate. Commit:
  `feat(api): admin.tours.get trả danh sách ảnh của tour theo thứ tự hiển thị`

## Task 3 — `admin.tours.signPhotoUploads`: ký một lô upload cho một tour

**Files:**

- Modify: `libs/shared/contract/src/schemas/admin-tours.ts`, `admin-tours.spec.ts`
- Modify: `libs/shared/contract/src/contract.ts`
- Modify: `apps/api/src/modules/catalog/admin-tour-errors.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.service.ts`, `admin-tours.controller.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.int.spec.ts`

**Interfaces:**

- Consumes: `tourPhotoFolder` (Task 2); `buildSignedUploadParams`,
  `resolveUploadConfig` (có sẵn); `MediaGarbageService.enqueueQuietly` (có sẵn).
- Produces: `TOUR_PHOTOS_MAX = 30`, `TOUR_PHOTO_ALT_MAX = 300`,
  `TOUR_PHOTO_MAX_BYTES = 10 * 1024 * 1024`,
  `AdminTourSignPhotoUploadsInputSchema` / `AdminTourSignPhotoUploadsInput`
  (contract); thủ tục `admin.tours.signPhotoUploads` trả `SignedUploadParams[]`;
  `AdminToursService.signPhotoUploads(input)`; lỗi
  `TourPhotoUploadsNotConfiguredError`.

- [ ] **B1. Test đỏ ở contract** (`admin-tours.spec.ts`):

```ts
describe('AdminTourSignPhotoUploadsInputSchema (ADR-0048 §4)', () => {
  const id = '7a1b2c3d-0000-4000-8000-000000000001';
  it('count từ 1 tới 30 — trần ảnh của một tour', () => {
    expect(AdminTourSignPhotoUploadsInputSchema.safeParse({ id, count: 1 }).success).toBe(true);
    expect(AdminTourSignPhotoUploadsInputSchema.safeParse({ id, count: 30 }).success).toBe(true);
    expect(AdminTourSignPhotoUploadsInputSchema.safeParse({ id, count: 0 }).success).toBe(false);
    expect(AdminTourSignPhotoUploadsInputSchema.safeParse({ id, count: 31 }).success).toBe(false);
    expect(AdminTourSignPhotoUploadsInputSchema.safeParse({ id, count: 1.5 }).success).toBe(false);
  });
});
```

- [ ] **B2.** Chạy → ĐỎ.
- [ ] **B3. Cài ở contract.** `admin-tours.ts`, cuối khối hằng trần:

```ts
/** Ảnh của MỘT tour (ADR-0048) — tour nhiều ảnh nhất hôm nay có 18. */
export const TOUR_PHOTOS_MAX = 30;
/** Gương cột `media_assets.alt` VARCHAR(300). */
export const TOUR_PHOTO_ALT_MAX = 300;
/**
 * Trần một file ảnh — admin canh TRƯỚC khi tải (bytes đi thẳng lên Cloudinary nên
 * API không cân được file). Cùng trần ảnh review; gói free của Cloudinary cũng chặn
 * ở 10 MB.
 */
export const TOUR_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
```

  và một mục mới cuối file:

```ts
// ── Ảnh (F18, ADR-0048) ─────────────────────────────────────────────────────

/**
 * Ký một LÔ upload cho một tour (ADR-0048 §4): một request cho cả lô, dưới trần
 * 20/60s của ADR-0037 — ký từng file thì lượt tải 30 ảnh bị 429 từ ảnh thứ 21.
 */
export const AdminTourSignPhotoUploadsInputSchema = z.object({
  id: z.uuid(),
  count: z.int().min(1).max(TOUR_PHOTOS_MAX),
});
export type AdminTourSignPhotoUploadsInput = z.output<typeof AdminTourSignPhotoUploadsInputSchema>;
```

  `contract.ts`: import `AdminTourSignPhotoUploadsInputSchema`; trong khối
  `tours`, sau `setCosts`:

```ts
      signPhotoUploads: oc
        .route({
          method: 'POST',
          path: '/api/admin/tours/{id}/photo-uploads',
          summary: 'Sign a batch of direct-to-Cloudinary uploads for one tour (ADR-0048)',
        })
        .input(AdminTourSignPhotoUploadsInputSchema)
        .errors({
          // 503 chứ không 500: thiếu cặp khoá là trạng thái cấu hình hợp lệ (ADR-0021 §6).
          MEDIA_UPLOAD_NOT_CONFIGURED: { status: 503, message: 'Uploads are not configured' },
          NOT_FOUND: { status: 404, message: 'Tour not found' },
        })
        .output(z.array(SignedUploadParamsSchema)),
```

  (`SignedUploadParamsSchema` đã được import cho `media.signUpload`.)
- [ ] **B4.** Chạy lại → XANH. Build contract.
- [ ] **B5. Test đỏ, int.** Trong `admin-tours.int.spec.ts`, cạnh các helper:

```ts
  const signUploads = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/photo-uploads`, payload, cookie);
```

  Thêm vào HAI ca guard: `expect((await signUploads(tourId(1), { id: tourId(1), count: 1 }, customerCookie)).statusCode).toBe(403);`
  và bản `''` → 401. Rồi một `describe` mới:

```ts
  describe('signPhotoUploads (F18)', () => {
    it('ký đúng count bộ trong thư mục của tour, publicId khác nhau, cả lô vào hàng dọn', async () => {
      await makeTour(1);

      const res = await signUploads(tourId(1), { id: tourId(1), count: 3 });

      expect(res.statusCode).toBe(200);
      const params = SignedUploadParamsSchema.array().parse(res.json());
      expect(params).toHaveLength(3);
      expect(new Set(params.map((p) => p.publicId)).size).toBe(3);
      for (const p of params) {
        expect(p.folder).toBe(`tourism/tours/${tourId(1)}`);
        expect(p.overwrite).toBe(false);
        expect(p.transformation).toBe('c_limit,w_2400,h_2400,fl_force_strip');
      }
      // Ký là đăng ký theo dõi (ADR-0035 §3): publicId ĐẦY ĐỦ `<folder>/<basename>`.
      const queued = await prisma.mediaGarbage.findMany({ select: { publicId: true } });
      expect(queued.map((q) => q.publicId).sort()).toEqual(
        params.map((p) => `${p.folder}/${p.publicId}`).sort(),
      );
    });

    it('tour không có thì 404 và không ký gì; count ngoài 1..30 thì 400', async () => {
      const missing = await signUploads(MISSING, { id: MISSING, count: 1 });
      expect(missing.statusCode).toBe(404);
      expect(await prisma.mediaGarbage.count()).toBe(0);

      await makeTour(1);
      expect((await signUploads(tourId(1), { id: tourId(1), count: 31 })).statusCode).toBe(400);
      expect((await signUploads(tourId(1), { id: tourId(1), count: 0 })).statusCode).toBe(400);
    });
  });
```

  Import `SignedUploadParamsSchema` từ `@tourism/contract`.
  `MEDIA_UPLOAD_NOT_CONFIGURED` không có int test: env int luôn mang cặp khoá giả
  (`vitest.int.config.ts`) — cùng hoàn cảnh `media.signUpload`.
- [ ] **B6.** Chạy int spec → ĐỎ (route chưa có → 404 ở ca đầu).
- [ ] **B7. Cài ở API.** `admin-tour-errors.ts`:

```ts
/** Thiếu cặp khoá Cloudinary — trạng thái cấu hình hợp lệ (ADR-0021 §6), 503. */
export class TourPhotoUploadsNotConfiguredError extends ContractError<'MEDIA_UPLOAD_NOT_CONFIGURED'> {
  constructor() {
    super('MEDIA_UPLOAD_NOT_CONFIGURED', 'Uploads are not configured', false);
  }
}
```

  `admin-tours.service.ts` — constructor nhận thêm `MediaGarbageService`
  (`MediaModule` export sẵn `MediaGarbageModule`):

```ts
import { randomUUID } from 'node:crypto';
import {
  buildSignedUploadParams,
  resolveUploadConfig,
  tourPhotoFolder,
} from '../../lib/upload-signing.js';
import { MediaGarbageService } from '../media/media-garbage.service.js';

  constructor(
    private readonly webRevalidation: WebRevalidationService,
    private readonly media: MediaService,
    private readonly garbage: MediaGarbageService,
  ) {}

  /**
   * Ký một lô upload thẳng lên Cloudinary cho MỘT tour (ADR-0048 §4). Thư mục và
   * tên file do server quyết; bộ tham số ký y hệt đường ký của khách (ADR-0021
   * AMEND 1–2). Mỗi publicId vào hàng dọn NGAY lúc ký (ADR-0035 §3): tải lên rồi
   * không lưu thì bảy ngày sau tự được dọn.
   */
  async signPhotoUploads(input: AdminTourSignPhotoUploadsInput): Promise<SignedUploadParams[]> {
    const cfg = resolveUploadConfig(env);
    if (!cfg) throw new TourPhotoUploadsNotConfiguredError();
    const tour = await prisma.tour.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!tour) throw new AdminTourNotFoundError(input.id);

    const folder = tourPhotoFolder(cfg.rootFolder, input.id);
    const timestamp = Math.floor(Date.now() / 1000);
    const signed = Array.from({ length: input.count }, () =>
      buildSignedUploadParams(cfg, folder, randomUUID(), timestamp),
    );
    // Ghi `${folder}/${basename}` ĐẦY ĐỦ — Cloudinary lưu asset ở dạng ấy và
    // `destroy` nhận đúng dạng ấy (cùng lời dặn ở `upload-signing.service.ts`).
    await this.garbage.enqueueQuietly(signed.map((params) => `${params.folder}/${params.publicId}`));
    this.logger.log(
      `[admin] tour photo uploads signed ${JSON.stringify({ id: input.id, count: input.count })}`,
    );
    return signed;
  }
```

  `admin-tours.controller.ts`:

```ts
  @Implement(contract.admin.tours.signPhotoUploads)
  signPhotoUploads() {
    return implement(contract.admin.tours.signPhotoUploads).handler(async ({ input, errors }) => {
      try {
        return await this.adminTours.signPhotoUploads(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }
```

- [ ] **B8.** Chạy lại → XANH. Đột biến: bỏ lời gọi `enqueueQuietly` → ca "cả lô vào
  hàng dọn" đỏ; đổi `tourPhotoFolder(cfg.rootFolder, input.id)` thành
  `uploadFolderFor(cfg.rootFolder, { purpose: 'AVATAR', userId: input.id })` → ca
  thư mục đỏ. Trả lại.
- [ ] **B9.** Quy trình gate. Commit:
  `feat(api): ký một lô upload ảnh cho tour, thư mục do server quyết`

## Task 4 — `admin.tours.photoLibrary`: kho ảnh địa danh

**Files:**

- Modify: `libs/shared/contract/src/schemas/admin-tours.ts`, `admin-tours.spec.ts`
- Modify: `libs/shared/contract/src/contract.ts`
- Modify: `apps/api/src/modules/catalog/tour-photos.ts`, `tour-photos.spec.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.service.ts`, `admin-tours.controller.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.int.spec.ts`

**Interfaces:**

- Consumes: `orderTourPhotos` (Task 2), `MediaService.resolveForOwners` (có sẵn).
- Produces: `AdminLibraryPhotoSchema` / `AdminLibraryPhoto`,
  `AdminPhotoLibrarySchema` / `AdminPhotoLibrary` (mảng
  `{ destination: { id, name }, photos: AdminLibraryPhoto[] }`);
  `toLibraryPhoto(item: MediaItem): AdminLibraryPhoto` (`tour-photos.ts`); thủ tục
  `admin.tours.photoLibrary` (không input).

- [ ] **B1. Test đỏ ở contract** (`admin-tours.spec.ts`):

```ts
describe('AdminPhotoLibrarySchema (ADR-0048 §9)', () => {
  it('mỗi nhóm một địa danh kèm ảnh; ảnh mang ghi công khi có', () => {
    const library = [
      {
        destination: { id: '7a1b2c3d-0000-4000-8000-0000000000d1', name: 'Hội An' },
        photos: [
          {
            publicId: 'tourism/catalog/destination/hoi-an/1',
            url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/x',
            alt: 'Lanterns',
            width: 2400,
            height: 1600,
            author: 'J. Nguyen',
            license: 'CC BY-SA 4.0',
          },
        ],
      },
    ];
    expect(AdminPhotoLibrarySchema.parse(library)).toEqual(library);
  });
});
```

- [ ] **B2.** Chạy → ĐỎ. **B3. Cài ở contract**, mục `// ── Ảnh ──`:

```ts
/** Một ảnh trong kho địa danh (ADR-0020 §5) — thứ hộp Add from library bày ra. */
export const AdminLibraryPhotoSchema = z.object({
  publicId: z.string().min(1),
  url: z.url(),
  alt: z.string().nullable(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  author: z.string().nullable(),
  license: z.string().nullable(),
});
export type AdminLibraryPhoto = z.output<typeof AdminLibraryPhotoSchema>;

/** Kho ảnh theo địa danh, sắp theo tên; địa danh không có ảnh thì vắng mặt. */
export const AdminPhotoLibrarySchema = z.array(
  z.object({
    destination: z.object({ id: z.uuid(), name: z.string() }),
    photos: z.array(AdminLibraryPhotoSchema),
  }),
);
export type AdminPhotoLibrary = z.output<typeof AdminPhotoLibrarySchema>;
```

  `contract.ts` (import `AdminPhotoLibrarySchema`), sau `signPhotoUploads`:

```ts
      // Route KHÔNG nằm dưới `/api/admin/tours/…`: `GET /api/admin/tours/{slug}` có
      // sẵn sẽ nuốt nó, và một tour có slug `photo-library` là hợp lệ.
      photoLibrary: oc
        .route({
          method: 'GET',
          path: '/api/admin/tour-photo-library',
          summary: 'Every destination photo a tour can use (ADR-0048 §9)',
        })
        .output(AdminPhotoLibrarySchema),
```

- [ ] **B4.** Chạy lại → XANH. Build contract.
- [ ] **B5. Test đỏ, thuần** (`tour-photos.spec.ts`):

```ts
describe('toLibraryPhoto', () => {
  it('chở ảnh cùng ghi công; bỏ những cột thư viện không cần', () => {
    expect(toLibraryPhoto(item({ author: 'J. Nguyen', license: 'CC BY-SA 4.0' }))).toEqual({
      publicId: 'tourism/catalog/destination/hoi-an/1',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/x',
      alt: 'Lanterns',
      width: 2400,
      height: 1600,
      author: 'J. Nguyen',
      license: 'CC BY-SA 4.0',
    });
  });
});
```

- [ ] **B6.** Chạy → ĐỎ. **B7. Cài** (`tour-photos.ts`):

```ts
/** Một asset của kho địa danh → ảnh của hộp Add from library. */
export function toLibraryPhoto(item: MediaItem): AdminLibraryPhoto {
  return {
    publicId: item.publicId,
    url: item.url,
    alt: item.alt,
    width: item.width,
    height: item.height,
    author: item.author,
    license: item.license,
  };
}
```

- [ ] **B8. Test đỏ, int.** Helper:

```ts
  const library = (cookie = adminCookie) =>
    app.inject({ method: 'GET', url: '/api/admin/tour-photo-library', headers: { cookie } });
```

  Hai ca guard: `expect((await library(customerCookie)).statusCode).toBe(403);` và
  `expect((await library('')).statusCode).toBe(401);`. Rồi:

```ts
  describe('photoLibrary (F18)', () => {
    it('ảnh của mọi địa danh CÓ ảnh, theo tên; ảnh bìa đầu; địa danh ẩn vẫn có', async () => {
      const asset = (
        ownerId: string,
        publicId: string,
        patch: Partial<Prisma.MediaAssetUncheckedCreateInput> = {},
      ) => ({
        ownerType: 'DESTINATION' as const,
        ownerId,
        publicId,
        type: 'IMAGE' as const,
        role: 'gallery' as const,
        alt: publicId,
        ...patch,
      });
      await prisma.mediaAsset.createMany({
        data: [
          asset(DEST_1, 'tourism/catalog/destination/hoi-an/2', { sortOrder: 2 }),
          asset(DEST_1, 'tourism/catalog/destination/hoi-an/1', {
            sortOrder: 1,
            author: 'J. Nguyen',
            license: 'CC BY-SA 4.0',
          }),
          asset(DEST_1, 'tourism/catalog/destination/hoi-an/hero', { role: 'hero', sortOrder: 5 }),
          // An Bàng đang ẩn — ảnh của nó vẫn hợp lệ cho tour.
          asset(DEST_3, 'tourism/catalog/destination/an-bang/1', { sortOrder: 1 }),
          // Ảnh của TOUR không thuộc thư viện.
          {
            ...asset(tourId(9), 'tourism/catalog/tour/somewhere'),
            ownerType: 'TOUR' as const,
          },
        ],
      });

      const res = await library();

      expect(res.statusCode).toBe(200);
      const groups = AdminPhotoLibrarySchema.parse(res.json());
      // Hà Nội (DEST_2) không có ảnh nên vắng mặt.
      expect(groups.map((g) => g.destination.name)).toEqual(['An Bàng', 'Hội An']);
      expect(groups[1]?.photos.map((p) => p.publicId)).toEqual([
        'tourism/catalog/destination/hoi-an/hero',
        'tourism/catalog/destination/hoi-an/1',
        'tourism/catalog/destination/hoi-an/2',
      ]);
      expect(groups[1]?.photos[1]).toMatchObject({ author: 'J. Nguyen', license: 'CC BY-SA 4.0' });
    });
  });
```

  Import `AdminPhotoLibrarySchema`.
- [ ] **B9.** Chạy int → ĐỎ. **B10. Cài ở service** (import `type AdminPhotoLibrary`,
  `toLibraryPhoto`):

```ts
  /**
   * Kho ảnh địa danh làm thư viện của tour (ADR-0048 §9, ADR-0020 §5): mọi ảnh
   * `DESTINATION`, theo tên địa danh, trong MỘT lần gọi (khoảng 155 ảnh). Địa danh
   * đang ẩn vẫn có mặt — ảnh của nó vẫn dùng được; địa danh không có ảnh thì vắng.
   */
  async photoLibrary(): Promise<AdminPhotoLibrary> {
    const destinations = await prisma.destination.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const media = await this.media.resolveForOwners(
      MediaOwnerType.DESTINATION,
      destinations.map((destination) => destination.id),
      [MediaRole.hero, MediaRole.gallery],
    );
    return destinations.flatMap((destination) => {
      const photos = orderTourPhotos(media.get(destination.id) ?? []);
      return photos.length === 0 ? [] : [{ destination, photos: photos.map(toLibraryPhoto) }];
    });
  }
```

  Controller:

```ts
  @Implement(contract.admin.tours.photoLibrary)
  photoLibrary() {
    return implement(contract.admin.tours.photoLibrary).handler(() =>
      this.adminTours.photoLibrary(),
    );
  }
```

- [ ] **B11.** Chạy lại → XANH. Đột biến: bỏ `photos.length === 0 ? [] :` → Hà Nội
  xuất hiện, ca đỏ; đổi `DESTINATION` thành `TOUR` → ca đỏ. Trả lại.
- [ ] **B12.** Quy trình gate. Commit:
  `feat(api): thư viện ảnh của tour là kho ảnh địa danh`

## Task 5 — `admin.tours.setPhotos`: thay trọn danh sách ảnh

**Files:**

- Modify: `libs/shared/contract/src/schemas/admin-tours.ts`, `admin-tours.spec.ts`
- Modify: `libs/shared/contract/src/contract.ts`
- Modify: `apps/api/src/modules/catalog/tour-photos.ts`, `tour-photos.spec.ts`
- Modify: `apps/api/src/modules/catalog/admin-tour-errors.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.service.ts`, `admin-tours.controller.ts`
- Modify: `apps/api/src/modules/catalog/admin-tours.int.spec.ts`

**Interfaces:**

- Consumes: `MediaPublicIdSchema` (Task 1), `isTourUploadPublicId` (Task 2),
  `TOUR_PHOTOS_MAX`, `TOUR_PHOTO_ALT_MAX` (Task 3), `claimTour`,
  `assertStillReady`, `MediaGarbageService.requeue` (có sẵn).
- Produces: `TourPhotoUploadSchema` / `TourPhotoUpload`,
  `AdminTourPhotoInputSchema` / `AdminTourPhotoInput`,
  `AdminTourPhotosInputSchema` / `AdminTourPhotosInput` (contract); thủ tục
  `admin.tours.setPhotos` với mã `PHOTO_NOT_ALLOWED`;
  `planTourPhotos(args): TourPhotoPlan`, `StoredPhoto`, `PlannedPhotoRow`
  (`tour-photos.ts`); `AdminToursService.setPhotos(input)`.

- [ ] **B1. Test đỏ ở contract** (`admin-tours.spec.ts`):

```ts
describe('AdminTourPhotosInputSchema (ADR-0048 §2–3)', () => {
  const base = { id: '7a1b2c3d-0000-4000-8000-000000000001', version: '2026-09-28T01:02:03.456Z' };
  const photo = (n: number) => ({ publicId: `tourism/catalog/destination/x/${n}`, alt: `Photo ${n}` });

  it('alt bỏ khoảng trắng hai đầu; rỗng hay quá 300 ký tự là hỏng', () => {
    const parsed = AdminTourPhotosInputSchema.parse({ ...base, photos: [{ ...photo(1), alt: '  A  ' }] });
    expect(parsed.photos[0]?.alt).toBe('A');
    expect(AdminTourPhotosInputSchema.safeParse({ ...base, photos: [{ ...photo(1), alt: '   ' }] }).success).toBe(false);
    expect(AdminTourPhotosInputSchema.safeParse({ ...base, photos: [{ ...photo(1), alt: 'a'.repeat(300) }] }).success).toBe(true);
    expect(AdminTourPhotosInputSchema.safeParse({ ...base, photos: [{ ...photo(1), alt: 'a'.repeat(301) }] }).success).toBe(false);
  });

  it('tối đa 30 ảnh, không trùng publicId; danh sách rỗng là hợp lệ', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => photo(i));
    expect(AdminTourPhotosInputSchema.safeParse({ ...base, photos: many(30) }).success).toBe(true);
    expect(AdminTourPhotosInputSchema.safeParse({ ...base, photos: many(31) }).success).toBe(false);
    expect(AdminTourPhotosInputSchema.safeParse({ ...base, photos: [photo(1), photo(1)] }).success).toBe(false);
    expect(AdminTourPhotosInputSchema.safeParse({ ...base, photos: [] }).success).toBe(true);
  });

  it('upload chỉ canh dạng: số nguyên dương, version là chuỗi chữ số (quyết định 3)', () => {
    const upload = { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 };
    const withUpload = (u: object) => ({ ...base, photos: [{ ...photo(1), upload: u }] });
    expect(AdminTourPhotosInputSchema.safeParse(withUpload(upload)).success).toBe(true);
    expect(AdminTourPhotosInputSchema.safeParse(withUpload({ ...upload, version: 'v1' })).success).toBe(false);
    expect(AdminTourPhotosInputSchema.safeParse(withUpload({ ...upload, width: 0 })).success).toBe(false);
    expect(AdminTourPhotosInputSchema.safeParse(withUpload({ ...upload, format: '' })).success).toBe(false);
  });

  it('publicId đi qua cổng ký tự', () => {
    expect(
      AdminTourPhotosInputSchema.safeParse({ ...base, photos: [{ ...photo(1), publicId: 'a/../b' }] }).success,
    ).toBe(false);
  });
});
```

- [ ] **B2.** Chạy → ĐỎ. **B3. Cài ở contract** (import `MediaPublicIdSchema` từ
  `./media.js`), mục `// ── Ảnh ──`:

```ts
/**
 * Metadata Cloudinary trả về sau khi tải lên — admin gửi kèm ảnh MỚI tải
 * (ADR-0048 §5). Chỉ canh DẠNG: trần 2400px và 10 MB do Cloudinary thi hành
 * (tham số ký, gói free); đặt lại ở đây chỉ thêm một cách để một ảnh ĐÃ tải lên
 * thành công bị từ chối lúc lưu.
 */
export const TourPhotoUploadSchema = z.object({
  version: z.string().regex(/^\d{1,20}$/),
  width: z.int().positive(),
  height: z.int().positive(),
  format: z.string().min(1).max(10),
  bytes: z.int().positive(),
});
export type TourPhotoUpload = z.output<typeof TourPhotoUploadSchema>;

export const AdminTourPhotoInputSchema = z.object({
  publicId: MediaPublicIdSchema,
  alt: z.string().trim().min(1).max(TOUR_PHOTO_ALT_MAX),
  upload: TourPhotoUploadSchema.optional(),
});
export type AdminTourPhotoInput = z.output<typeof AdminTourPhotoInputSchema>;

/** Tab Photos — danh sách mới theo đúng thứ tự; ảnh đầu là ảnh bìa (ADR-0048 §1–2). */
export const AdminTourPhotosInputSchema = z.object({
  id: z.uuid(),
  version: VersionSchema,
  photos: z
    .array(AdminTourPhotoInputSchema)
    .max(TOUR_PHOTOS_MAX)
    .refine((photos) => new Set(photos.map((photo) => photo.publicId)).size === photos.length, {
      message: 'a photo can only be listed once',
    }),
});
export type AdminTourPhotosInput = z.output<typeof AdminTourPhotosInputSchema>;
```

  `contract.ts` (import `AdminTourPhotosInputSchema`), trước `signPhotoUploads`:

```ts
      setPhotos: oc
        .route({
          method: 'POST',
          path: '/api/admin/tours/{id}/photos',
          summary: 'Replace the photos of one tour; the first one is the cover (ADR-0048)',
        })
        .input(AdminTourPhotosInputSchema)
        .errors({
          STALE_TOUR: { status: 409, message: 'This tour changed since it was opened' },
          TOUR_NOT_READY: { status: 409, message: 'A tour on sale must stay ready to sell' },
          PHOTO_NOT_ALLOWED: {
            status: 400,
            message: 'A photo is not from this tour, its uploads or the destination library',
          },
          NOT_FOUND: { status: 404, message: 'Tour not found' },
        })
        .output(AdminTourDetailSchema),
```

- [ ] **B4.** Chạy lại → XANH. Build contract.
- [ ] **B5. Test đỏ, `planTourPhotos`** (`tour-photos.spec.ts`):

```ts
import { planTourPhotos, type StoredPhoto } from './tour-photos.js';

const stored = (publicId: string, over: Partial<StoredPhoto> = {}): StoredPhoto => ({
  publicId,
  type: 'IMAGE',
  posterId: null,
  format: 'jpg',
  width: 2400,
  height: 1600,
  durationSec: null,
  bytes: 400000,
  version: '1600000000',
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
  ...over,
});
const UPLOAD = { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 };
const mine = (name: string) => `tourism/tours/${TOUR}/${name}`;
const OTHER_TOUR = '7a1b2c3d-0000-4000-8000-000000000002';

describe('planTourPhotos (ADR-0048 §3, §6)', () => {
  const plan = (
    photos: { publicId: string; alt: string; upload?: typeof UPLOAD }[],
    current: StoredPhoto[] = [],
    library: StoredPhoto[] = [],
  ) =>
    planTourPhotos({
      tourId: TOUR,
      rootFolder: 'tourism',
      photos,
      current: new Map(current.map((row) => [row.publicId, row])),
      library: new Map(library.map((row) => [row.publicId, row])),
    });

  it('vị trí 0 là hero, còn lại gallery; sortOrder = vị trí; alt theo form', () => {
    const result = plan(
      [
        { publicId: 'lib/2', alt: 'Second' },
        { publicId: 'lib/1', alt: 'First' },
      ],
      [stored('lib/1'), stored('lib/2')],
    );
    expect(result.ok && result.rows.map((r) => [r.publicId, r.role, r.sortOrder, r.alt])).toEqual([
      ['lib/2', 'hero', 0, 'Second'],
      ['lib/1', 'gallery', 1, 'First'],
    ]);
  });

  it('giữ dòng cũ nguyên metadata và ghi công; `upload` gửi kèm dòng cũ bị bỏ qua', () => {
    const old = stored('lib/1', { version: '111', author: 'J. Nguyen', license: 'CC BY-SA 4.0' });
    const result = plan([{ publicId: 'lib/1', alt: 'A', upload: UPLOAD }], [old]);
    expect(result.ok && result.rows[0]).toMatchObject({
      version: '111',
      width: 2400,
      author: 'J. Nguyen',
      license: 'CC BY-SA 4.0',
    });
  });

  it('ảnh tải lên MỚI: metadata từ upload, ghi công null', () => {
    const result = plan([{ publicId: mine('a'), alt: 'Mine', upload: UPLOAD }]);
    expect(result.ok && result.rows[0]).toMatchObject({
      publicId: mine('a'),
      version: '1759000000',
      width: 2000,
      height: 1333,
      bytes: 523000,
      format: 'jpg',
      author: null,
      license: null,
    });
  });

  it('ảnh thư viện: chép metadata và ghi công từ dòng địa danh', () => {
    const lib = stored('lib/9', {
      version: '999',
      author: 'A. B.',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
    });
    const result = plan([{ publicId: 'lib/9', alt: 'Borrowed' }], [], [lib]);
    expect(result.ok && result.rows[0]).toMatchObject({
      version: '999',
      author: 'A. B.',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
      alt: 'Borrowed',
    });
  });

  it('từ chối: thư mục tour khác, avatar, chuỗi bịa, ảnh tải lên thiếu metadata', () => {
    for (const photo of [
      { publicId: `tourism/tours/${OTHER_TOUR}/a`, alt: 'x', upload: UPLOAD },
      { publicId: 'tourism/avatars/u-1/a', alt: 'x', upload: UPLOAD },
      { publicId: 'somewhere/else', alt: 'x' },
      { publicId: mine('no-meta'), alt: 'x' },
    ]) {
      expect(plan([photo])).toEqual({ ok: false, rejected: photo.publicId });
    }
  });

  it('requeue CHỈ ảnh tải lên bị gỡ — ảnh thư viện gỡ ra không vào hàng dọn', () => {
    const result = plan(
      [{ publicId: mine('kept'), alt: 'Kept' }],
      [stored(mine('kept')), stored(mine('gone')), stored('lib/1')],
    );
    expect(result.ok && result.requeue).toEqual([mine('gone')]);
  });
});
```

- [ ] **B6.** Chạy → ĐỎ. **B7. Cài** (`tour-photos.ts`, import
  `type AdminTourPhotoInput`):

```ts
/**
 * Các cột của một dòng `media_assets` mà ảnh tour chép khi GIỮ dòng cũ hay MƯỢN
 * dòng thư viện (ADR-0048 §3). Đủ bốn cột ghi công: thiếu một cột là phát hành ảnh
 * CC BY mà không thoả điều kiện giấy phép (ADR-0020 §3).
 */
export interface StoredPhoto {
  publicId: string;
  type: 'IMAGE' | 'VIDEO';
  posterId: string | null;
  format: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  bytes: number | null;
  version: string | null;
  author: string | null;
  license: string | null;
  licenseUrl: string | null;
  sourceUrl: string | null;
}

/** Một dòng sẽ ghi — `role` và `sortOrder` theo vị trí, `alt` theo form. */
export interface PlannedPhotoRow extends StoredPhoto {
  alt: string;
  role: 'hero' | 'gallery';
  sortOrder: number;
}

export type TourPhotoPlan =
  | { ok: true; rows: PlannedPhotoRow[]; requeue: string[] }
  | { ok: false; rejected: string };

/**
 * Danh sách ảnh gửi lên → các dòng sẽ ghi và các ảnh phải vào lại hàng dọn.
 *
 * Mỗi ảnh thuộc đúng MỘT nguồn, xét theo thứ tự: dòng ĐÃ CÓ của tour (giữ) →
 * ảnh TẢI LÊN trong thư mục của tour, có metadata (mới) → dòng THƯ VIỆN (mượn).
 * Không thuộc nguồn nào là từ chối cả lệnh.
 *
 * Chỉ ảnh tải lên bị gỡ mới vào lại hàng dọn (ADR-0048 §6): ảnh thư viện đã kiểm
 * chứng giấy phép và ghi công, bộ dọn không phân biệt được "chỉ còn tour này dùng"
 * với "rác".
 */
export function planTourPhotos(args: {
  tourId: string;
  rootFolder: string;
  photos: readonly AdminTourPhotoInput[];
  /** Dòng ảnh hiện có của tour, theo publicId. */
  current: ReadonlyMap<string, StoredPhoto>;
  /** Dòng `DESTINATION` của những publicId gửi lên, theo publicId. */
  library: ReadonlyMap<string, StoredPhoto>;
}): TourPhotoPlan {
  const rows: PlannedPhotoRow[] = [];
  for (const [index, photo] of args.photos.entries()) {
    const source =
      args.current.get(photo.publicId) ?? uploadedPhoto(args, photo) ?? args.library.get(photo.publicId);
    if (source === undefined) return { ok: false, rejected: photo.publicId };
    rows.push({ ...source, alt: photo.alt, role: index === 0 ? 'hero' : 'gallery', sortOrder: index });
  }
  const kept = new Set(args.photos.map((photo) => photo.publicId));
  const requeue = [...args.current.keys()].filter(
    (publicId) => !kept.has(publicId) && isTourUploadPublicId(args.rootFolder, args.tourId, publicId),
  );
  return { ok: true, rows, requeue };
}

/** Ảnh tải lên MỚI: đúng thư mục của tour VÀ có metadata Cloudinary — thiếu một là không nhận. */
function uploadedPhoto(
  args: { tourId: string; rootFolder: string },
  photo: AdminTourPhotoInput,
): StoredPhoto | undefined {
  if (photo.upload === undefined) return undefined;
  if (!isTourUploadPublicId(args.rootFolder, args.tourId, photo.publicId)) return undefined;
  return {
    publicId: photo.publicId,
    type: 'IMAGE',
    posterId: null,
    format: photo.upload.format,
    width: photo.upload.width,
    height: photo.upload.height,
    durationSec: null,
    bytes: photo.upload.bytes,
    version: photo.upload.version,
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
  };
}
```

- [ ] **B8.** Chạy lại → XANH. Đột biến: đảo thứ tự hai nguồn đầu (`uploadedPhoto`
  trước `current`) → ca "giữ dòng cũ… `upload` bị bỏ qua" đỏ; bỏ điều kiện
  `isTourUploadPublicId` trong `requeue` → ca "requeue CHỈ ảnh tải lên" đỏ; bỏ
  `photo.upload === undefined` → ca `no-meta` đỏ. Trả lại.
- [ ] **B9. Test đỏ, int.** Helper và dữ liệu:

```ts
  const photosWrite = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/tours/${id}/photos`, payload, cookie);
  const LIB_1 = 'tourism/catalog/destination/hoi-an/1';
  const LIB_2 = 'tourism/catalog/destination/hoi-an/2';
  const mine = (n: number, name: string) => `tourism/tours/${tourId(n)}/${name}`;
  const UPLOAD_META = { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 };
  /** Kho địa danh: LIB_1 có đủ ghi công — ca "chép ghi công" cần nó KHÁC thứ client gửi. */
  const makeLibrary = () =>
    prisma.mediaAsset.createMany({
      data: [
        {
          ownerType: 'DESTINATION',
          ownerId: DEST_1,
          publicId: LIB_1,
          type: 'IMAGE',
          role: 'gallery',
          sortOrder: 1,
          alt: 'Lanterns at dusk',
          width: 2400,
          height: 1600,
          version: '1600000001',
          author: 'J. Nguyen',
          license: 'CC BY-SA 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lanterns.jpg',
        },
        {
          ownerType: 'DESTINATION',
          ownerId: DEST_1,
          publicId: LIB_2,
          type: 'IMAGE',
          role: 'gallery',
          sortOrder: 2,
          alt: 'Old town',
          version: '1600000002',
        },
      ],
    });
  const tourPhotoRows = (n: number) =>
    prisma.mediaAsset.findMany({
      where: { ownerType: 'TOUR', ownerId: tourId(n) },
      orderBy: { sortOrder: 'asc' },
    });
```

  Hai ca guard: `photosWrite(tourId(1), {}, customerCookie)` → 403, `''` → 401.
  Rồi:

```ts
  describe('setPhotos (F18)', () => {
    it('lưu đủ ba nguồn theo thứ tự gửi; ảnh đầu là bìa; bust sau commit', async () => {
      await makeTour(1);
      await makeLibrary();
      const before = await detailOf('f17-tour-1');
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [
          { publicId: mine(1, 'new'), alt: 'Our own boat', upload: UPLOAD_META },
          // `author` gửi kèm bị Zod bỏ — ghi công chỉ đến từ dòng thư viện.
          { publicId: LIB_1, alt: 'Lanterns, our words', author: 'Someone else' },
          { publicId: 'tourism/catalog/tour/f17-1', alt: 'The old cover' },
        ],
      });

      expect(res.statusCode).toBe(200);
      const detail = AdminTourDetailSchema.parse(res.json());
      expect(detail.version > before.version).toBe(true);
      expect(detail.photos.map((p) => [p.publicId, p.source])).toEqual([
        [mine(1, 'new'), 'UPLOAD'],
        [LIB_1, 'LIBRARY'],
        ['tourism/catalog/tour/f17-1', 'LIBRARY'],
      ]);
      const rows = await tourPhotoRows(1);
      expect(rows.map((r) => [r.publicId, r.role, r.sortOrder, r.alt])).toEqual([
        [mine(1, 'new'), 'hero', 0, 'Our own boat'],
        [LIB_1, 'gallery', 1, 'Lanterns, our words'],
        ['tourism/catalog/tour/f17-1', 'gallery', 2, 'The old cover'],
      ]);
      expect(rows[0]).toMatchObject({ version: '1759000000', width: 2000, author: null });
      expect(rows[1]).toMatchObject({
        version: '1600000001',
        author: 'J. Nguyen',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lanterns.jpg',
      });
      expect(rows[2]).toMatchObject({ version: '1700000000' });
      expect(revalidate).toHaveBeenCalledWith(['tours', 'tour:f17-tour-1']);
    });

    it.each([
      ['thư mục tải lên của tour khác', { publicId: mine(2, 'x'), alt: 'x', upload: UPLOAD_META }],
      ['thư mục avatar', { publicId: 'tourism/avatars/u-1/x', alt: 'x', upload: UPLOAD_META }],
      ['chuỗi bịa', { publicId: 'somewhere/else', alt: 'x' }],
      ['ảnh tải lên thiếu metadata', { publicId: mine(1, 'no-meta'), alt: 'x' }],
    ])('%s → 400 PHOTO_NOT_ALLOWED, không đổi gì, không bust', async (_name, photo) => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [photo],
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'PHOTO_NOT_ALLOWED' });
      expect(revalidate).not.toHaveBeenCalled();
      const after = await detailOf('f17-tour-1');
      expect(after.version).toBe(before.version);
      expect(after.photos.map((p) => p.publicId)).toEqual(['tourism/catalog/tour/f17-1']);
    });

    it('version cũ → 409 STALE_TOUR; id không có → 404', async () => {
      await makeTour(1);
      const stale = await photosWrite(tourId(1), {
        id: tourId(1),
        version: '2020-01-01T00:00:00.000Z',
        photos: [],
      });
      expect(stale.statusCode).toBe(409);
      expect(stale.json()).toMatchObject({ code: 'STALE_TOUR' });

      const missing = await photosWrite(MISSING, {
        id: MISSING,
        version: '2020-01-01T00:00:00.000Z',
        photos: [],
      });
      expect(missing.statusCode).toBe(404);
    });

    it('tour ĐANG bán gỡ hết ảnh → 409 TOUR_NOT_READY, rollback trọn', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');

      const res = await photosWrite(tourId(1), { id: tourId(1), version: before.version, photos: [] });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({
        code: 'TOUR_NOT_READY',
        message: 'This tour is missing: a cover photo.',
      });
      expect(await tourPhotoRows(1)).toHaveLength(1);
      expect((await detailOf('f17-tour-1')).version).toBe(before.version);
    });

    it('tour TẮT bán gỡ hết ảnh được; readiness nói thiếu ảnh bìa', async () => {
      await makeTour(1, { isPublished: false });
      const before = await detailOf('f17-tour-1');

      const res = await photosWrite(tourId(1), { id: tourId(1), version: before.version, photos: [] });

      expect(res.statusCode).toBe(200);
      const detail = AdminTourDetailSchema.parse(res.json());
      expect(detail.photos).toEqual([]);
      expect(detail.readiness.cover).toBe(false);
    });

    it('gỡ ảnh tải lên → vào lại hàng dọn với đồng hồ mới; gỡ ảnh thư viện → không', async () => {
      await makeTour(1);
      await makeLibrary();
      await prisma.mediaAsset.createMany({
        data: [
          {
            ownerType: 'TOUR',
            ownerId: tourId(1),
            publicId: mine(1, 'old'),
            type: 'IMAGE',
            role: 'gallery',
            sortOrder: 1,
            alt: 'Old upload',
          },
          {
            ownerType: 'TOUR',
            ownerId: tourId(1),
            publicId: LIB_1,
            type: 'IMAGE',
            role: 'gallery',
            sortOrder: 2,
            alt: 'Borrowed',
          },
        ],
      });
      // Đồng hồ cũ: ký từ mười ngày trước (ADR-0035 §3).
      const signedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await prisma.mediaGarbage.create({ data: { publicId: mine(1, 'old'), createdAt: signedAt } });
      const before = await detailOf('f17-tour-1');

      const res = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [{ publicId: 'tourism/catalog/tour/f17-1', alt: 'Cover' }],
      });

      expect(res.statusCode).toBe(200);
      const queued = await prisma.mediaGarbage.findMany();
      expect(queued.map((q) => q.publicId)).toEqual([mine(1, 'old')]);
      expect(queued[0]?.createdAt.getTime()).toBeGreaterThan(signedAt.getTime());
    });

    it('schema: trùng publicId và 31 ảnh đều 400', async () => {
      await makeTour(1);
      const before = await detailOf('f17-tour-1');
      const cover = { publicId: 'tourism/catalog/tour/f17-1', alt: 'Cover' };

      const dup = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: [cover, cover],
      });
      expect(dup.statusCode).toBe(400);

      const tooMany = await photosWrite(tourId(1), {
        id: tourId(1),
        version: before.version,
        photos: Array.from({ length: 31 }, (_, i) => ({ publicId: `lib/${i}`, alt: 'x' })),
      });
      expect(tooMany.statusCode).toBe(400);
    });
  });
```

- [ ] **B10.** Chạy int → ĐỎ (route chưa có).
- [ ] **B11. Cài ở API.** `admin-tour-errors.ts`:

```ts
/**
 * Một ảnh không thuộc nguồn nào trong ba (ADR-0048 §3). 400: client đúng không bao
 * giờ gửi — nhưng chuỗi này là đối số của lệnh destroy sau này, nên từ chối cả lệnh.
 */
export class TourPhotoNotAllowedError extends ContractError<'PHOTO_NOT_ALLOWED'> {
  constructor(publicId: string) {
    super('PHOTO_NOT_ALLOWED', `Photo not allowed for this tour: ${publicId}`, false);
  }
}
```

  `admin-tours.service.ts` (import `type AdminTourPhotosInput`, `planTourPhotos`,
  `type StoredPhoto`, `TourPhotoNotAllowedError`):

```ts
/** Các cột `planTourPhotos` chép khi giữ hay mượn một dòng — khớp `StoredPhoto`. */
const STORED_PHOTO_SELECT = {
  publicId: true,
  type: true,
  posterId: true,
  format: true,
  width: true,
  height: true,
  durationSec: true,
  bytes: true,
  version: true,
  author: true,
  license: true,
  licenseUrl: true,
  sourceUrl: true,
} satisfies Prisma.MediaAssetSelect;

/** Dòng theo publicId; trùng thì giữ dòng ĐẦU (danh sách đã sắp theo `createdAt`). */
function byPublicId(rows: readonly StoredPhoto[]): Map<string, StoredPhoto> {
  const map = new Map<string, StoredPhoto>();
  for (const row of rows) if (!map.has(row.publicId)) map.set(row.publicId, row);
  return map;
}
```

```ts
  /**
   * Tab Photos (ADR-0048 §2): thay trọn danh sách ảnh. Thứ tự trong transaction:
   * giành hàng tour → đọc ảnh hiện có → tra thư viện cho publicId lạ → lập kế
   * hoạch (từ chối cả lệnh nếu một ảnh không thuộc nguồn nào) → thay dòng → đưa ảnh
   * tải lên bị gỡ vào lại hàng dọn → kiểm "vẫn đủ để bán" nếu đang bán.
   */
  async setPhotos(input: AdminTourPhotosInput): Promise<AdminTourDetail> {
    const now = new Date();
    const slug = await prisma.$transaction(async (tx) => {
      await claimTour(tx, input.id, input.version, now);
      const tour = await tx.tour.findUniqueOrThrow({
        where: { id: input.id },
        select: { slug: true, isPublished: true },
      });
      const current = await tx.mediaAsset.findMany({
        where: { ownerType: MediaOwnerType.TOUR, ownerId: input.id },
        select: STORED_PHOTO_SELECT,
      });
      const known = new Set(current.map((row) => row.publicId));
      const unknown = input.photos.map((photo) => photo.publicId).filter((id) => !known.has(id));
      const library =
        unknown.length === 0
          ? []
          : await tx.mediaAsset.findMany({
              where: { ownerType: MediaOwnerType.DESTINATION, publicId: { in: unknown } },
              select: STORED_PHOTO_SELECT,
              orderBy: { createdAt: 'asc' },
            });

      const plan = planTourPhotos({
        tourId: input.id,
        rootFolder: env.CLOUDINARY_UPLOAD_FOLDER,
        photos: input.photos,
        current: byPublicId(current),
        library: byPublicId(library),
      });
      if (!plan.ok) throw new TourPhotoNotAllowedError(plan.rejected);

      await tx.mediaAsset.deleteMany({
        where: { ownerType: MediaOwnerType.TOUR, ownerId: input.id },
      });
      if (plan.rows.length > 0) {
        await tx.mediaAsset.createMany({
          data: plan.rows.map((row) => ({
            ...row,
            ownerType: MediaOwnerType.TOUR,
            ownerId: input.id,
          })),
        });
      }
      // Cùng transaction (ADR-0035 §7): rollback thì hàng dọn không giữ dấu vết nào.
      await this.garbage.requeue(tx, plan.requeue);

      if (tour.isPublished) await assertStillReady(tx, input.id);
      return tour.slug;
    });

    this.logger.log(
      `[admin] tour photos saved ${JSON.stringify({ id: input.id, photos: input.photos.length })}`,
    );
    this.bust(slug);
    return this.get(slug);
  }
```

  Controller: handler `setPhotos` cùng khuôn `setCosts` (gọi
  `this.adminTours.setPhotos(input)`, đổi lỗi bằng `toContractError`).
- [ ] **B12.** Chạy int → XANH. Đột biến: bỏ `requeue` → ca hàng dọn đỏ; bỏ
  `assertStillReady` → ca `TOUR_NOT_READY` đỏ; bust bằng `input.id` ngay đầu hàm
  (trước transaction) → các ca `PHOTO_NOT_ALLOWED` đỏ ở kỳ vọng "không bust"; bỏ
  `select: STORED_PHOTO_SELECT` chép ghi công (thay bằng `{ publicId: true }` rồi ép
  kiểu) → ca "lưu đủ ba nguồn" đỏ ở `licenseUrl`. Trả lại.
- [ ] **B13.** Quy trình gate. Commit:
  `feat(api): lệnh ghi thay trọn danh sách ảnh của tour, chỉ ảnh tải lên vào lại hàng dọn`

## Task 6 — Xoá tour dọn luôn dòng ảnh

**Files:**

- Modify: `apps/api/src/modules/catalog/admin-tours.service.ts` (`delete`)
- Modify: `apps/api/src/modules/catalog/admin-tours.int.spec.ts`

**Interfaces:**

- Consumes: `isTourUploadPublicId` (Task 2), `MediaGarbageService.requeue` (có sẵn).
- Produces: `delete` chạy trong MỘT transaction (ADR-0048 §7).

- [ ] **B1. Test đỏ, int** (trong `describe('delete')`):

```ts
    it('xoá tour dọn luôn dòng ảnh; ảnh tải lên vào lại hàng dọn, ảnh thư viện thì không (F18)', async () => {
      await makeTour(1, { isPublished: false });
      const mineId = `tourism/tours/${tourId(1)}/mine`;
      await prisma.mediaAsset.create({
        data: {
          ownerType: 'TOUR',
          ownerId: tourId(1),
          publicId: mineId,
          type: 'IMAGE',
          role: 'gallery',
          sortOrder: 1,
          alt: 'Mine',
        },
      });

      const res = await remove(tourId(1));

      expect(res.statusCode).toBe(200);
      expect(await prisma.mediaAsset.count({ where: { ownerId: tourId(1) } })).toBe(0);
      // Ảnh bìa của `makeTour` là ảnh catalog (thư viện) — không vào hàng dọn.
      expect((await prisma.mediaGarbage.findMany()).map((q) => q.publicId)).toEqual([mineId]);
    });

    it('tour có booking → 409, dòng ảnh còn nguyên, hàng dọn không đổi (F18)', async () => {
      await makeTour(1);
      const departure = await makeDeparture(tourId(1), { startDate: day(30), endDate: day(31) });
      await makeBooking(tourId(1), departure.id, 'BK-F18DEL01');
      await prisma.mediaAsset.create({
        data: {
          ownerType: 'TOUR',
          ownerId: tourId(1),
          publicId: `tourism/tours/${tourId(1)}/mine`,
          type: 'IMAGE',
          role: 'gallery',
          sortOrder: 1,
          alt: 'Mine',
        },
      });

      const res = await remove(tourId(1));

      expect(res.statusCode).toBe(409);
      expect(await prisma.mediaAsset.count({ where: { ownerId: tourId(1) } })).toBe(2);
      expect(await prisma.mediaGarbage.count()).toBe(0);
    });
```

- [ ] **B2.** Chạy int → ca đầu ĐỎ (dòng ảnh còn lại sau khi xoá).
- [ ] **B3. Cài** — thay thân `delete`:

```ts
  /**
   * Xoá tour chưa từng có booking (ADR-0047 §5), trong MỘT transaction từ F18
   * (ADR-0048 §7): `media_assets` là bảng đa chủ, KHÔNG có khoá ngoại tới `tours`,
   * nên dòng ảnh phải xoá tay trong cùng lệnh — sót lại thì ảnh của một tour đã mất
   * vẫn "có người dùng" trong mắt bộ dọn mãi mãi. Ảnh tải lên của tour vào lại hàng
   * dọn; ảnh thư viện thì không (ADR-0048 §6). Khoá ngoại của booking vẫn quyết
   * (bài học 1): `P2003` rollback cả ba bước.
   */
  async delete(input: AdminTourDeleteInput): Promise<AdminTourDeleteResult> {
    const deleted = await prisma
      .$transaction(async (tx) => {
        const photos = await tx.mediaAsset.findMany({
          where: { ownerType: MediaOwnerType.TOUR, ownerId: input.id },
          select: { publicId: true },
        });
        const tour = await tx.tour.delete({ where: { id: input.id }, select: { slug: true } });
        await tx.mediaAsset.deleteMany({
          where: { ownerType: MediaOwnerType.TOUR, ownerId: input.id },
        });
        await this.garbage.requeue(
          tx,
          photos
            .map((photo) => photo.publicId)
            .filter((publicId) =>
              isTourUploadPublicId(env.CLOUDINARY_UPLOAD_FOLDER, input.id, publicId),
            ),
        );
        return tour;
      })
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
```

  (import `isTourUploadPublicId` từ `../../lib/upload-signing.js`.)
- [ ] **B4.** Chạy int → XANH, kể cả mọi ca `delete` cũ (xoá chen giữa lúc khách đặt
  chỗ, bust sau khi xoá, 404). Đột biến: bỏ bộ lọc `isTourUploadPublicId` → ca đầu
  đỏ (ảnh catalog vào hàng dọn); bỏ `deleteMany` → ca đầu đỏ. Trả lại.
- [ ] **B5.** Quy trình gate. Commit:
  `fix(api): xoá tour dọn luôn dòng ảnh của tour trong cùng transaction`

## Task 7 — G11: luật "tour đang bán thì luôn đủ" suy từ readiness dự tính

**Files:**

- Modify: `apps/admin/src/lib/tour-editor-view.ts`, `tour-editor-view.spec.ts`
- Modify: `apps/admin/src/lib/tour-editor-write.ts`, `tour-editor-write.spec.ts`

**Interfaces:**

- Consumes: `projectedReadiness` (Task 1).
- Produces: `OnSaleShortfalls { summary: boolean; days: number[]; cover: boolean }`,
  `onSaleShortfalls(detail, projected): OnSaleShortfalls` (`tour-editor-view.ts`).
  `validateDetailsForm` và `validateItineraryForm` giữ NGUYÊN chữ ký.

- [ ] **B1. Test đỏ** (`tour-editor-view.spec.ts`):

```ts
describe('onSaleShortfalls (G11)', () => {
  it('tour TẮT bán thì không có gì — tour nháp lưu thiếu thoải mái', () => {
    const offSale = detailFixture({ isPublished: false });
    expect(onSaleShortfalls(offSale, projectedReadiness(offSale, { summary: null, photoCount: 0 }))).toEqual({
      summary: false,
      days: [],
      cover: false,
    });
  });

  it('tour đang bán: đếm đúng chỗ lệnh này làm hỏng', () => {
    const detail = detailFixture();
    expect(onSaleShortfalls(detail, projectedReadiness(detail, { summary: '  ' })).summary).toBe(true);
    expect(onSaleShortfalls(detail, projectedReadiness(detail, { durationDays: 5 })).days).toEqual([4, 5]);
    expect(onSaleShortfalls(detail, projectedReadiness(detail, { itineraryDays: [1, 3] })).days).toEqual([2]);
    expect(onSaleShortfalls(detail, projectedReadiness(detail, { photoCount: 0 })).cover).toBe(true);
  });

  it('chỗ thiếu có TỪ TRƯỚC (dữ liệu cũ) không bị đổ cho lệnh này', () => {
    // Tour đang bán mà đã thiếu tóm tắt và ngày 3 — server không để điều này xảy
    // ra, nhưng dữ liệu sửa tay thì có thể.
    const legacy = detailFixture({
      summary: null,
      itinerary: [
        { dayNumber: 1, title: 'One', description: null },
        { dayNumber: 2, title: 'Two', description: null },
      ],
    });
    expect(onSaleShortfalls(legacy, projectedReadiness(legacy, { summary: null }))).toEqual({
      summary: false,
      days: [],
      cover: false,
    });
  });
});
```

  `tour-editor-write.spec.ts` — hai ca mới cạnh các ca `summaryOnSale`/`dayTitleOnSale`
  có sẵn (đọc chúng để dùng đúng helper dựng giá trị form của file ấy):

```ts
  it('G11: tour đang bán ĐÃ thiếu tóm tắt từ trước — sửa ô khác không bị đổ lỗi tóm tắt', () => {
    const legacy = detailFixture({ summary: null });
    const values = { ...detailsFormValues(legacy), title: 'Renamed' };
    expect(validateDetailsForm(values, legacy).summary).toBeUndefined();
  });

  it('G11: ngày vốn trống từ trước (dữ liệu cũ) không bị báo dayTitleOnSale', () => {
    const legacy = detailFixture({
      itinerary: [
        { dayNumber: 1, title: 'One', description: null },
        { dayNumber: 2, title: 'Two', description: null },
      ],
    });
    expect(validateItineraryForm(itineraryFormValues(legacy), legacy)).toEqual({});
  });
```

- [ ] **B2.** `pnpm --filter @tourism/admin exec vitest run src/lib/tour-editor-view.spec.ts src/lib/tour-editor-write.spec.ts`
  → ĐỎ (`onSaleShortfalls` chưa có; hai ca G11 nhận lỗi cũ).
- [ ] **B3. Cài** — `tour-editor-view.ts`, dưới `projectedReadiness`:

```ts
/** Điều kiện readiness mà lệnh sửa ĐANG SOẠN làm hỏng ở một tour đang bán (G11). */
export interface OnSaleShortfalls {
  summary: boolean;
  /** Ngày đang đủ mà bản dự tính làm thiếu, tăng dần. */
  days: number[];
  cover: boolean;
}

/**
 * Chỗ thiếu DO lệnh sửa này gây ra ở một tour ĐANG BÁN — nguồn DUY NHẤT của luật
 * "tour đang bán thì luôn đủ" phía admin (G11, ADR-0048 §8). Ba tab tự gắn kết quả
 * vào ô của mình.
 *
 * Chỉ đếm điều kiện bản hiện tại ĐẠT mà bản dự tính HỎNG: đúng ba luật viết tay cũ
 * (xoá tóm tắt, thêm ngày, xoá tiêu đề ngày) cộng ảnh bìa, và không đổ cho lệnh
 * này một chỗ thiếu có từ trước. Tour tắt bán thì rỗng. Server vẫn là trọng tài cuối.
 */
export function onSaleShortfalls(
  detail: AdminTourDetail,
  projected: TourReadiness,
): OnSaleShortfalls {
  if (!detail.isPublished) return { summary: false, days: [], cover: false };
  const current = detail.readiness;
  return {
    summary: current.summary && !projected.summary,
    days: projected.missingDays.filter((day) => !current.missingDays.includes(day)),
    cover: current.cover && !projected.cover,
  };
}
```

  `tour-editor-write.ts` (import `onSaleShortfalls`, `projectedReadiness` từ
  `./tour-editor-view`): trong `validateDetailsForm`, dời phép parse số ngày lên
  đầu và thay hai nhánh viết tay:

```ts
  const days = parseWholeNumber(values.durationDays);
  // G11: luật "tour đang bán" suy từ readiness dự tính, không viết tay từng luật.
  const shortfalls = onSaleShortfalls(
    detail,
    projectedReadiness(detail, {
      summary: orNull(values.summary),
      destinations: values.destinations,
      durationDays: Number.isInteger(days) ? days : detail.durationDays,
    }),
  );

  setError(errors, 'title', textError(values.title, TOUR_TITLE_MAX, true));
  if (shortfalls.summary) errors.summary = fe.summaryOnSale;
  else setError(errors, 'summary', textError(values.summary, TOUR_SUMMARY_MAX, false));
  if (values.categoryId === '') errors.categoryId = fe.chooseCategory;

  const daysError = wholeNumberError(values.durationDays, 1, TOUR_DURATION_MAX);
  if (daysError !== undefined) errors.durationDays = daysError;
  else if (days !== detail.durationDays && detail.departureCount > 0) {
    errors.durationDays = fe.durationLocked;
  } else if (shortfalls.days.length > 0) {
    errors.durationDays = fe.addDaysOnSale;
  }
```

  (xoá dòng `const days = …` cũ ở dưới; phần còn lại của hàm giữ nguyên). Trong
  `validateItineraryForm`, trước vòng `forEach`:

```ts
  const titled = values.days.flatMap((day, index) => (day.title.trim() === '' ? [] : [index + 1]));
  const newlyMissing = new Set(
    onSaleShortfalls(detail, projectedReadiness(detail, { itineraryDays: titled })).days,
  );
```

  và thay `if (detail.isPublished) entry.title = fe.dayTitleOnSale;` bằng
  `if (newlyMissing.has(index + 1)) entry.title = fe.dayTitleOnSale;`. Sửa comment
  đầu file và comment của `validateDetailsForm` cho đúng: luật "tour đang bán" nay
  suy từ `onSaleShortfalls`.
- [ ] **B4.** Chạy lại B2 → XANH, cả mọi ca cũ của hai file (câu lỗi không đổi). Đột
  biến: `summary: !projected.summary` (bỏ `current.summary &&`) → ca G11 tóm tắt
  đỏ; bỏ `.filter(…)` ở `days` → ca "ngày vốn trống" đỏ; bỏ nhánh
  `!detail.isPublished` → ca tắt bán đỏ. Trả lại.
- [ ] **B5.** Quy trình gate. Commit:
  `refactor(admin): luật tour đang bán ở Details và Itinerary suy từ readiness dự tính`

## Task 8 — Kit: danh sách không có nút thêm, khung form có lý do khoá Save

**Files:**

- Modify: `apps/admin/src/components/kit/list-editor.tsx`, `list-editor.spec.tsx`
- Modify: `apps/admin/src/components/tours/editor/editor-form-frame.tsx`, `editor-form-frame.spec.tsx`

**Interfaces:**

- Produces: `ListEditorProps.newItem?` và `addLabel?` (vắng → không vẽ nút thêm);
  `ListEditorProps.emptyFocus?: React.RefObject<HTMLElement | null>`;
  `EditorFormFrame` prop `blockedNote?: string`.

- [ ] **B1. Test đỏ** — `list-editor.spec.tsx` (thêm `useRef` vào import `react`):

```tsx
  it('không có newItem thì không vẽ nút thêm; gỡ dòng cuối đưa tiêu điểm tới emptyFocus', async () => {
    // Tab Photos (F18): ảnh vào danh sách qua nút Upload photos và Add from library,
    // nên kit không có nút thêm — gỡ dòng cuối mà không có đích thì tiêu điểm rơi về <body>.
    function NoAdd() {
      const [items, setItems] = useState<Line[]>([{ key: 'k-1', text: 'Only' }]);
      const target = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={target} type="button">
            Upload photos
          </button>
          <ListEditor
            items={items}
            onChange={setItems}
            max={3}
            itemName={(index) => `photo ${index + 1}`}
            emptyFocus={target}
            renderItem={(item) => <span>{item.text}</span>}
          />
        </>
      );
    }
    const user = userEvent.setup();
    render(<NoAdd />);

    expect(screen.queryByRole('button', { name: /^Add/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    expect(screen.getByRole('button', { name: 'Upload photos' })).toHaveFocus();
  });
```

  `editor-form-frame.spec.tsx` (đọc file để dùng đúng cách dựng khung của nó):

```tsx
  it('blockedNote: Save khoá dù form có thay đổi, câu lý do thay chỗ ghi chú, submit không chạy', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <EditorFormFrame
        dirty
        pending={false}
        banner={null}
        note="Saved costs apply from now on."
        blockedNote="Waiting for 2 uploads to finish."
        onSubmit={onSubmit}
        onReload={vi.fn()}
      >
        <input aria-label="Field" />
      </EditorFormFrame>,
    );

    expect(screen.getByText('Waiting for 2 uploads to finish.')).toBeInTheDocument();
    expect(screen.queryByText('Saved costs apply from now on.')).not.toBeInTheDocument();
    const save = screen.getByRole('button', { name: messages.admin.tours.editor.save });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await user.type(screen.getByLabelText('Field'), '{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });
```

- [ ] **B2.** Chạy hai spec → ĐỎ.
- [ ] **B3. Cài.** `list-editor.tsx`:

```ts
export interface ListEditorProps<Item extends Keyed> {
  items: readonly Item[];
  onChange: (items: Item[]) => void;
  max: number;
  /**
   * Vắng (cùng `addLabel`) thì kit KHÔNG vẽ nút thêm — dòng vào danh sách bằng
   * đường khác (tab Photos: tải lên, thư viện).
   */
  newItem?: () => Item;
  addLabel?: string;
  // … itemName, renderItem, disabled, reorderable, labelledRows, empty giữ nguyên …
  /**
   * Phần tử nhận tiêu điểm khi gỡ dòng CUỐI — mặc định là nút thêm của kit. Danh
   * sách không có nút thêm phải truyền nó, không thì tiêu điểm rơi về `<body>`.
   */
  emptyFocus?: React.RefObject<HTMLElement | null>;
}
```

  Trong component: destructure `emptyFocus`; `add()` mở đầu bằng
  `if (newItem === undefined || disabled || full) return;`; trong effect, nhánh
  `add` thành `(emptyFocus?.current ?? addButton.current)?.focus();`; khối nút thêm
  ở cuối chỉ vẽ khi `newItem !== undefined && addLabel !== undefined`. Sửa JSDoc
  đầu file: luật tiêu điểm thứ ba nói "hết dòng thì về nút thêm, hoặc `emptyFocus`".

  `editor-form-frame.tsx`:

```tsx
  /**
   * Lý do Save đang khoá dù form có thay đổi (tab Photos: còn ảnh đang tải lên) —
   * in thay chỗ `note`. Không dùng `pending`: nhãn nút sẽ thành "Saving…" trong khi
   * chẳng có gì đang lưu.
   */
  blockedNote?: string;
```

  `onSubmit` của form: `if (dirty && !pending && blockedNote === undefined) onSubmit();`;
  dòng ghi chú: `{(blockedNote ?? note) ? <p className="text-xs text-muted-foreground">{blockedNote ?? note}</p> : null}`;
  nút: `disabled={!dirty || pending || blockedNote !== undefined}`.
- [ ] **B4.** Chạy lại → XANH, cả mọi ca cũ của `list-editor.spec.tsx` và mọi spec
  form tab (`pnpm --filter @tourism/admin exec vitest run src/components/tours/editor src/components/kit`).
  Đột biến: effect bỏ `emptyFocus?.current ??` → ca mới đỏ; `onSubmit` bỏ điều kiện
  `blockedNote` → ca khung đỏ ở `onSubmit`. Trả lại.
- [ ] **B5.** Quy trình gate. Commit:
  `feat(admin): kit danh sách không nút thêm và khung form có lý do khoá Save`

## Task 9 — Copy, tab Photos trong VM, mục readiness ảnh bìa, CSP, hộp xoá

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts`
- Modify: `apps/admin/src/lib/tour-editor-view.ts`, `tour-editor-view.spec.ts`
- Modify: `apps/admin/src/lib/security-headers.ts`, `security-headers.spec.ts`
- Modify: `apps/admin/src/components/tours/editor/delete-tour-zone.tsx`, `delete-tour-zone.spec.tsx`
- Modify: spec so chữ cũ — tìm ở B6

**Interfaces:**

- Produces: `messages.admin.tours.editor.photos` (khối copy dưới đây, Task 10–13
  đọc ĐÚNG các khoá này); `TourEditorTab` có `'photos'`; `ReadinessIssue.key` có
  `'cover'`; `tourPhotoThumb(url)`, `cloudinaryImageUrl(cloudName, publicId, version)`.

- [ ] **B1. Copy** (`messages.ts`, khối `admin.tours.editor`) — sửa ba câu cũ đang
  nói sai sau khi readiness có ảnh bìa (bài học 11), thêm phần mới:

```ts
        tabs: {
          details: 'Details',
          photos: 'Photos',
          itinerary: 'Itinerary',
          content: 'FAQ & policies',
          costs: 'Costs',
          departures: 'Departures',
        },
```

```ts
          /** Nói ĐÚNG bốn điều kiện `tourReadiness` đo (F18 thêm ảnh bìa). */
          readyBody:
            'It has a summary, a primary destination, a plan for every day and a cover photo.',
          // … missingTitle, summary, primaryDestination, days giữ nguyên …
          cover: 'A cover photo',
```

  `form.errors` thêm:

```ts
            /** Tour đang bán phải còn ảnh bìa (ADR-0048 §8). */
            photosOnSale:
              'A tour on sale needs a cover photo. Take it off sale first to remove every photo.',
```

  `create.dialog.body` thành
  `'It starts off sale. Add a summary, a plan for every day and a cover photo, then put it on sale.'`
  (đúng điều server đòi để bật bán). `delete.dialog.body` chèn `photos, ` sau
  `cost lines, ` (đo: Task 6 xoá dòng ảnh trong cùng lệnh); `delete.rows` thêm
  `photos: 'Photos'`. Khối mới, ngay sau `costs`:

```ts
        /** Tab Photos (F18, ADR-0048). */
        photos: {
          errors: {
            STALE_TOUR: 'Someone else saved this tour while you were editing.',
            TOUR_NOT_READY: 'This tour is on sale, so it has to stay ready to sell.',
            /** Đo: `planTourPhotos` từ chối ảnh ngoài ba nguồn — client đúng không bao giờ gửi. */
            PHOTO_NOT_ALLOWED: 'One of these photos can no longer be used. Reload and try again.',
            NOT_FOUND: 'This tour no longer exists.',
          },
          /** Lỗi của lệnh ký upload (`signPhotoUploads`). */
          signErrors: {
            MEDIA_UPLOAD_NOT_CONFIGURED: 'Uploads are not set up on this server.',
            NOT_FOUND: 'This tour no longer exists.',
          },
          signFailed: 'Uploads could not start. Try again in a moment.',
          upload: 'Upload photos',
          library: 'Add from library',
          count: (n: number, max: number) => `${n} of ${max} photos`,
          /** Đo: web in `hero` trước (`tourGallery`); card lấy `hero` (`TourCardSchema.cover`). */
          intro:
            'The first photo is the cover. It shows on tour cards and opens the gallery on the tour page.',
          formats: 'JPG, PNG, WebP, AVIF or GIF, up to 10 MB each.',
          empty: 'No photos yet. Upload your own or add some from the library.',
          photoName: (n: number) => `photo ${n}`,
          cover: 'Cover',
          makeCover: 'Make cover',
          /** Tên đọc-màn-hình chứa nguyên chữ nhìn thấy "Make cover" (WCAG 2.5.3). */
          makeCoverFor: (name: string) => `Make cover: ${name}`,
          alt: 'Alt text',
          altRequired: 'Describe this photo for people who can’t see it.',
          uploaded: 'Uploaded',
          fromLibrary: 'From the library',
          credit: (author: string, license: string | null) =>
            license === null ? `Photo: ${author}` : `Photo: ${author}, ${license}`,
          uploading: (name: string, percent: number) => `${name} · Uploading ${percent}%`,
          uploadingLabel: (name: string) => `Uploading ${name}`,
          uploadFailed: (name: string) => `${name} didn’t upload.`,
          retry: 'Retry',
          remove: 'Remove',
          waiting: (n: number) =>
            n === 1 ? 'Waiting for 1 upload to finish.' : `Waiting for ${n} uploads to finish.`,
          skipped: {
            type: (name: string) => `${name} isn’t a JPG, PNG, WebP, AVIF or GIF.`,
            size: (name: string) => `${name} is larger than 10 MB.`,
            full: (name: string) => `${name} didn’t fit — a tour can have up to 30 photos.`,
          },
          dialog: {
            title: 'Add from library',
            body: 'Photos from the destination library, with their credits.',
            destination: 'Destination',
            thisTour: 'This tour’s destinations',
            added: 'Added',
            add: (n: number) => (n === 1 ? 'Add 1 photo' : `Add ${n} photos`),
            cancel: 'Cancel',
            loading: 'Loading the library…',
            empty: 'No photos for these destinations yet.',
            failed: 'The library could not be loaded.',
            retry: 'Try again',
            left: (n: number) =>
              n === 1 ? 'You can add 1 more photo.' : `You can add ${n} more photos.`,
          },
        },
```

  Build i18n.
- [ ] **B2. Test đỏ, VM** (`tour-editor-view.spec.ts`):

```ts
describe('tab Photos và mục ảnh bìa (F18)', () => {
  it('Photos đứng ngay sau Details', () => {
    expect(TOUR_EDITOR_TABS).toEqual(['details', 'photos', 'itinerary', 'content', 'costs', 'departures']);
    expect(tourTabHref('ha-long', 'photos')).toBe('/tours/ha-long/photos');
  });

  it('thiếu ảnh bìa là một mục readiness trỏ tới tab Photos', () => {
    const noCover = tourReadiness({
      summary: 'x',
      destinations: [{ isPrimary: true }],
      durationDays: 1,
      itineraryDays: [1],
      hasCover: false,
    });
    expect(readinessIssues(noCover, 'ha-long')).toEqual([
      { key: 'cover', label: 'A cover photo', href: '/tours/ha-long/photos' },
    ]);
  });
});

describe('tourPhotoThumb / cloudinaryImageUrl', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v17/tourism/x';
  it('thumbnail chèn w_320, KHÔNG bao giờ c_fill (ADR-0020 §4); URL lạ trả nguyên', () => {
    expect(tourPhotoThumb(url)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_320/v17/tourism/x',
    );
    expect(tourPhotoThumb(url)).not.toContain('c_fill');
    expect(tourPhotoThumb('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
  });

  it('ảnh vừa tải lên dựng đúng khuôn URL của API (buildCloudinaryUrl)', () => {
    expect(cloudinaryImageUrl('demo', 'tourism/tours/t/abc', '1759000000')).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1759000000/tourism/tours/t/abc',
    );
  });
});
```

  `security-headers.spec.ts`: hai kỳ vọng `connect-src` (production và dev) thêm
  ` https://api.cloudinary.com` ở cuối.
  `delete-tour-zone.spec.tsx`: thêm kỳ vọng hàng "Photos" mang số ảnh của fixture
  (`detailFixture()` có một ảnh):
  `expect(within(dialog).getByText('Photos')).toBeInTheDocument();` và giá trị `'1'`
  cạnh nó — đọc cách spec đang kiểm hàng "Departures" rồi làm y hệt.
- [ ] **B3.** Chạy ba spec → ĐỎ.
- [ ] **B4. Cài.** `tour-editor-view.ts`:

```ts
export type TourEditorTab = 'details' | 'photos' | 'itinerary' | 'content' | 'costs' | 'departures';

export const TOUR_EDITOR_TABS: readonly TourEditorTab[] = [
  'details',
  'photos',
  'itinerary',
  'content',
  'costs',
  'departures',
];
```

  `ReadinessIssue.key` thêm `'cover'`; cuối `readinessIssues`:

```ts
  if (!readiness.cover) {
    issues.push({ key: 'cover', label: t.readiness.cover, href: tourTabHref(slug, 'photos') });
  }
```

  và hai hàm mới:

```ts
/** Đoạn transform mà `buildCloudinaryUrl` phía API gắn cho ảnh (ADR-0005). */
const CLOUDINARY_IMAGE_TRANSFORM = '/upload/f_auto,q_auto/';

/**
 * Thumbnail 320px cho dòng ảnh của tab Photos. `w_` thu nhỏ giữ tỉ lệ; khung 3:2
 * do CSS `object-fit: cover` lo. KHÔNG `c_fill` như `reviewPhotoThumb`: cắt cúp ảnh
 * CC BY-SA tạo tác phẩm phái sinh (ADR-0020 §4). URL không theo khuôn trả nguyên.
 */
export function tourPhotoThumb(url: string): string {
  return url.includes(CLOUDINARY_IMAGE_TRANSFORM)
    ? url.replace(CLOUDINARY_IMAGE_TRANSFORM, '/upload/f_auto,q_auto,w_320/')
    : url;
}

/** URL delivery của ảnh VỪA tải lên — đúng khuôn `buildCloudinaryUrl` phía API. */
export function cloudinaryImageUrl(cloudName: string, publicId: string, version: string): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/v${version}/${publicId}`;
}
```

  `security-headers.ts`:

```ts
    // api.cloudinary.com: trình duyệt admin POST thẳng file đã ký lên đó (tab Photos,
    // ADR-0048) — thiếu dòng này là mọi lượt tải bị CSP chặn.
    `connect-src 'self' ${apiOrigin} https://api.cloudinary.com`,
```

  (sửa luôn comment cũ phía trên dòng này — "browser chỉ còn Better Auth" không
  còn đúng). `delete-tour-zone.tsx`: `rows` thêm
  `{ label: t.rows.photos, value: String(detail.photos.length) }` sau hàng Departures.
- [ ] **B5.** Chạy lại → XANH.
- [ ] **B6. Spec so chữ cũ.** Tìm và sửa theo câu mới:
  `grep -rn "a primary destination and a plan for every day\|Add a summary and a plan for every day\|cost lines, destination links" apps/admin/src libs/shared/i18n/src --include=*.spec.ts --include=*.spec.tsx`.
  `tour-tabs.spec.tsx` nếu đếm năm tab thì thành sáu. Chạy
  `pnpm --filter @tourism/admin exec vitest run` → XANH.
- [ ] **B7.** Đột biến: bỏ nhánh `cover` của `readinessIssues` → ca readiness đỏ; đổi
  thumbnail sang `w_320,c_fill` → ca `c_fill` đỏ. Trả lại. Quy trình gate. Commit:
  `feat(admin): tab Photos trong khu làm việc, mục readiness ảnh bìa, CSP cho Cloudinary`

## Task 10 — Logic thuần của tab Photos và hàm tải lên

**Files:**

- Create: `apps/admin/src/lib/tour-photos.ts`, `tour-photos.spec.ts`
- Create: `apps/admin/src/lib/photo-upload.ts`, `photo-upload.spec.ts`

**Interfaces:**

- Consumes: `projectedReadiness`, `onSaleShortfalls`, `cloudinaryImageUrl` (Task 1,
  7, 9); `createWriteErrorCodec` (có sẵn); copy `messages.admin.tours.editor.photos`
  (Task 9); contract của Task 2–5.
- Produces (`tour-photos.ts`): `PhotoDraft`, `PhotosFormValues`, `PhotosFormErrors`,
  `photosFormValues`, `validatePhotosForm`, `hasPhotoErrors`, `photosPayload`,
  `makeCover`, `remainingCapacity`, `acceptFiles`, `SkippedFile`, `skippedCopy`,
  `uploadedPhotoDraft`, `libraryPhotoDraft`, `photoSourceLine`,
  `runWithConcurrency`, `UPLOAD_CONCURRENCY = 3`; codec `PhotosContractCode`,
  `classifyPhotosError`, `photosErrorCopy`, `SignUploadsContractCode`,
  `classifySignUploadsError`, `signUploadsErrorCopy`; kiểu action
  `SetPhotosAction`, `SignPhotoUploadsAction`, `SignPhotoUploadsResult`,
  `LoadPhotoLibraryAction`, `PhotoLibraryResult`.
  (`photo-upload.ts`): `UploadedPhoto`, `imageExtensionOf`, `buildUploadFormData`,
  `parseUploadResponse`, `uploadPhoto`.

- [ ] **B1. Test đỏ** — `photo-upload.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildUploadFormData, imageExtensionOf, parseUploadResponse } from './photo-upload';

const PARAMS = {
  signature: 'sig',
  timestamp: 1_760_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: 'tourism/tours/t-1',
  publicId: 'pid-1',
  allowedFormats: 'jpg,jpeg,png,webp,avif,gif',
  transformation: 'c_limit,w_2400,h_2400,fl_force_strip',
  overwrite: false as const,
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
};

describe('imageExtensionOf', () => {
  it('đuôi whitelist, không phân biệt hoa thường; lạ hay không đuôi thì null', () => {
    expect(imageExtensionOf('Boat.JPG')).toBe('jpg');
    expect(imageExtensionOf('a.b.webp')).toBe('webp');
    expect(imageExtensionOf('doc.pdf')).toBeNull();
    expect(imageExtensionOf('noext')).toBeNull();
  });
});

describe('buildUploadFormData', () => {
  it('gửi ĐỦ từng tham số đã ký — thiếu một cái là Cloudinary 401', () => {
    const form = buildUploadFormData(new Blob(['x'], { type: 'image/png' }), PARAMS);
    expect(form.get('api_key')).toBe('key');
    expect(form.get('timestamp')).toBe('1760000000');
    expect(form.get('signature')).toBe('sig');
    expect(form.get('folder')).toBe('tourism/tours/t-1');
    expect(form.get('public_id')).toBe('pid-1');
    expect(form.get('allowed_formats')).toBe('jpg,jpeg,png,webp,avif,gif');
    expect(form.get('transformation')).toBe('c_limit,w_2400,h_2400,fl_force_strip');
    expect(form.get('overwrite')).toBe('false');
    expect(form.get('file')).toBeTruthy();
  });
});

describe('parseUploadResponse', () => {
  const body = {
    public_id: 'tourism/tours/t-1/pid-1',
    version: 1759000000,
    width: 2000,
    height: 1333,
    format: 'jpg',
    bytes: 523000,
  };

  it('đọc publicId đầy đủ và metadata; version số thành chuỗi', () => {
    expect(parseUploadResponse(body)).toEqual({
      publicId: 'tourism/tours/t-1/pid-1',
      upload: { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 },
    });
  });

  it('thiếu hay sai kiểu một field là null — không dựng ảnh nửa vời', () => {
    for (const broken of [
      null,
      'text',
      { ...body, public_id: '' },
      { ...body, version: undefined },
      { ...body, width: 20.5 },
      { ...body, format: 7 },
      { ...body, bytes: undefined },
    ]) {
      expect(parseUploadResponse(broken)).toBeNull();
    }
  });
});
```

  `tour-photos.spec.ts` — dùng `detailFixture`, `COVER_PHOTO` của fixture:

```ts
import { TOUR_PHOTOS_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { COVER_PHOTO, detailFixture } from '@/test/tour-detail';
import {
  acceptFiles,
  hasPhotoErrors,
  libraryPhotoDraft,
  makeCover,
  type PhotoDraft,
  photoSourceLine,
  photosFormValues,
  photosPayload,
  remainingCapacity,
  runWithConcurrency,
  skippedCopy,
  uploadedPhotoDraft,
  validatePhotosForm,
} from './tour-photos';

const t = messages.admin.tours.editor.photos;
const fe = messages.admin.tours.editor.form.errors;

const draft = (key: string, over: Partial<PhotoDraft> = {}): PhotoDraft => ({
  key,
  publicId: `lib/${key}`,
  url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/${key}`,
  alt: `Photo ${key}`,
  source: 'LIBRARY',
  author: null,
  license: null,
  ...over,
});

describe('photosFormValues', () => {
  it('key tất định theo vị trí (bài học 12); alt null thành chuỗi rỗng', () => {
    const detail = detailFixture({ photos: [COVER_PHOTO, { ...COVER_PHOTO, publicId: 'x', alt: null }] });
    const values = photosFormValues(detail);
    expect(values.photos.map((p) => p.key)).toEqual(['photo-0', 'photo-1']);
    expect(values.photos[1]?.alt).toBe('');
  });
});

describe('validatePhotosForm', () => {
  it('alt bắt buộc sau khi bỏ khoảng trắng, tối đa 300 ký tự; lỗi khoá theo key của dòng', () => {
    const detail = detailFixture();
    const errors = validatePhotosForm(
      { photos: [draft('a', { alt: '   ' }), draft('b', { alt: 'x'.repeat(301) }), draft('c', { alt: 'x'.repeat(300) })] },
      detail,
    );
    expect(errors.rows).toEqual({ a: t.altRequired, b: fe.tooLong(300) });
    expect(hasPhotoErrors(errors)).toBe(true);
  });

  it('tour đang bán gỡ hết ảnh → lỗi của cả danh sách; tắt bán thì không', () => {
    expect(validatePhotosForm({ photos: [] }, detailFixture()).list).toBe(fe.photosOnSale);
    expect(validatePhotosForm({ photos: [] }, detailFixture({ isPublished: false })).list).toBeUndefined();
    expect(hasPhotoErrors(validatePhotosForm({ photos: [] }, detailFixture({ isPublished: false })))).toBe(false);
  });
});

describe('photosPayload', () => {
  it('theo thứ tự danh sách, alt đã bỏ khoảng trắng, upload chỉ đi kèm ảnh vừa tải', () => {
    const upload = { version: '1', width: 1, height: 1, format: 'jpg', bytes: 1 };
    expect(
      photosPayload('id-1', 'v-1', {
        photos: [draft('b', { alt: ' B ', upload, source: 'UPLOAD' }), draft('a')],
      }),
    ).toEqual({
      id: 'id-1',
      version: 'v-1',
      photos: [
        { publicId: 'lib/b', alt: 'B', upload },
        { publicId: 'lib/a', alt: 'Photo a' },
      ],
    });
  });
});

describe('makeCover', () => {
  it('đưa ảnh lên đầu; ảnh bìa cũ lùi xuống vị trí hai, còn lại giữ thứ tự', () => {
    const values = { photos: [draft('a'), draft('b'), draft('c')] };
    expect(makeCover(values, 'c').photos.map((p) => p.key)).toEqual(['c', 'a', 'b']);
    expect(makeCover(values, 'zzz')).toBe(values);
  });
});

describe('remainingCapacity / acceptFiles', () => {
  const file = (name: string, bytes: number) => new File([new Uint8Array(bytes)], name);

  it('sức chứa = 30 trừ ảnh đang có trừ file đang tải; không âm', () => {
    expect(remainingCapacity(10, 2)).toBe(TOUR_PHOTOS_MAX - 12);
    expect(remainingCapacity(30, 1)).toBe(0);
  });

  it('loại file sai đuôi, quá 10 MB, và phần dư quá sức chứa — kèm lý do', () => {
    const { accepted, skipped } = acceptFiles(
      [
        file('a.jpg', 10),
        file('b.pdf', 10),
        file('c.png', 10 * 1024 * 1024 + 1),
        file('d.webp', 10 * 1024 * 1024),
        file('e.gif', 10),
      ],
      2,
    );
    expect(accepted.map((f) => f.name)).toEqual(['a.jpg', 'd.webp']);
    expect(skipped).toEqual([
      { name: 'b.pdf', reason: 'type' },
      { name: 'c.png', reason: 'size' },
      { name: 'e.gif', reason: 'full' },
    ]);
    expect(skipped.map(skippedCopy)).toEqual([
      t.skipped.type('b.pdf'),
      t.skipped.size('c.png'),
      t.skipped.full('e.gif'),
    ]);
  });
});

describe('uploadedPhotoDraft / libraryPhotoDraft / photoSourceLine', () => {
  it('ảnh vừa tải: nguồn UPLOAD, alt rỗng để admin điền, URL dựng từ cloudName và version', () => {
    const photo = uploadedPhotoDraft(
      {
        publicId: 'tourism/tours/t-1/pid',
        upload: { version: '17', width: 2, height: 1, format: 'jpg', bytes: 3 },
      },
      'demo',
    );
    expect(photo).toMatchObject({
      publicId: 'tourism/tours/t-1/pid',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v17/tourism/tours/t-1/pid',
      alt: '',
      source: 'UPLOAD',
      author: null,
    });
    expect(photoSourceLine(photo)).toBe(t.uploaded);
  });

  it('ảnh thư viện: alt chép từ ảnh gốc, ghi công in khi có', () => {
    const photo = libraryPhotoDraft({
      publicId: 'lib/1',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/1',
      alt: 'Lanterns',
      width: 1,
      height: 1,
      author: 'J. Nguyen',
      license: 'CC BY-SA 4.0',
    });
    expect(photo).toMatchObject({ alt: 'Lanterns', source: 'LIBRARY' });
    expect(photoSourceLine(photo)).toBe(`${t.fromLibrary} · ${t.credit('J. Nguyen', 'CC BY-SA 4.0')}`);
    expect(photoSourceLine({ ...photo, author: null })).toBe(t.fromLibrary);
  });
});

describe('runWithConcurrency', () => {
  it('chạy hết mọi việc, không bao giờ quá `limit` việc cùng lúc', async () => {
    let running = 0;
    let peak = 0;
    const done: number[] = [];
    const tasks = Array.from({ length: 7 }, (_, i) => async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      done.push(i);
    });
    await runWithConcurrency(tasks, 3);
    expect(done.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(peak).toBe(3);
  });
});
```

- [ ] **B2.** `pnpm --filter @tourism/admin exec vitest run src/lib/photo-upload.spec.ts src/lib/tour-photos.spec.ts`
  → ĐỎ (hai file chưa có).
- [ ] **B3. Cài `photo-upload.ts`:**

```ts
import {
  ALLOWED_IMAGE_EXTENSIONS,
  type SignedUploadParams,
  type TourPhotoUpload,
} from '@tourism/contract';

/**
 * Đường tải ảnh tour browser → Cloudinary (ADR-0048 §4, khuôn ADR-0021): API chỉ
 * ký, bytes không đi qua Nest. Bản web (`apps/web/src/lib/media-upload.ts`) chỉ trả
 * `public_id`; tab Photos cần thêm metadata để API ghi dòng ảnh không phải hỏi lại
 * Cloudinary (ADR-0048 §5). Phần thuần tách riêng để TDD; XHR vì fetch chưa có
 * tiến độ upload.
 */
type AllowedExt = (typeof ALLOWED_IMAGE_EXTENSIONS)[number];

export interface UploadedPhoto {
  /** publicId ĐẦY ĐỦ `<folder>/<basename>` — đúng chuỗi API nhận lại ở `setPhotos`. */
  publicId: string;
  upload: TourPhotoUpload;
}

/** Đuôi ảnh từ tên file, chuẩn hoá lowercase; ngoài whitelist → null. */
export function imageExtensionOf(filename: string): AllowedExt | null {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext) ? (ext as AllowedExt) : null;
}

/** Bộ field khớp TRỌN chữ ký — thiếu hay thừa một tham số đã ký là Cloudinary 401. */
export function buildUploadFormData(file: Blob, params: SignedUploadParams): FormData {
  const form = new FormData();
  form.set('file', file);
  form.set('api_key', params.apiKey);
  form.set('timestamp', String(params.timestamp));
  form.set('signature', params.signature);
  form.set('folder', params.folder);
  form.set('public_id', params.publicId);
  form.set('allowed_formats', params.allowedFormats);
  form.set('transformation', params.transformation);
  form.set('overwrite', String(params.overwrite));
  return form;
}

/**
 * Phản hồi thành công của Cloudinary → ảnh đã tải; thiếu hay sai kiểu một field →
 * null. Kiểm từng field bằng một `if` riêng để TypeScript thu hẹp kiểu chắc chắn.
 */
export function parseUploadResponse(body: unknown): UploadedPhoto | null {
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;
  const publicId = record.public_id;
  const version = record.version;
  const width = record.width;
  const height = record.height;
  const format = record.format;
  const bytes = record.bytes;
  if (typeof publicId !== 'string' || publicId === '') return null;
  if (typeof version !== 'number' && typeof version !== 'string') return null;
  if (typeof width !== 'number' || !Number.isInteger(width)) return null;
  if (typeof height !== 'number' || !Number.isInteger(height)) return null;
  if (typeof format !== 'string' || format === '') return null;
  if (typeof bytes !== 'number' || !Number.isInteger(bytes)) return null;
  return { publicId, upload: { version: String(version), width, height, format, bytes } };
}

/** POST file lên Cloudinary, báo tiến độ 0–100. Mọi thất bại đều reject. */
export function uploadPhoto(
  file: Blob,
  params: SignedUploadParams,
  onProgress?: (percent: number) => void,
): Promise<UploadedPhoto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', params.uploadUrl);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('load', () => {
      // try/catch bắt buộc: ném trong callback của executor KHÔNG reject promise —
      // body 2xx không phải JSON mà không bắt là caller await treo mãi.
      try {
        const uploaded =
          xhr.status >= 200 && xhr.status < 300
            ? parseUploadResponse(JSON.parse(xhr.responseText))
            : null;
        if (uploaded) resolve(uploaded);
        else reject(new Error(`Cloudinary upload failed (${xhr.status})`));
      } catch {
        reject(new Error('Cloudinary upload failed (invalid response)'));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Cloudinary upload failed (network)')));
    xhr.send(buildUploadFormData(file, params));
  });
}
```

- [ ] **B4. Cài `tour-photos.ts`:**

```ts
import {
  type AdminLibraryPhoto,
  type AdminPhotoLibrary,
  type AdminTourDetail,
  type AdminTourPhotosInput,
  type AdminTourSignPhotoUploadsInput,
  type SignedUploadParams,
  TOUR_PHOTO_ALT_MAX,
  TOUR_PHOTO_MAX_BYTES,
  TOUR_PHOTOS_MAX,
  type TourPhotoSource,
  type TourPhotoUpload,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import type { Keyed } from './list-editor';
import { newItemKey } from './list-editor';
import { imageExtensionOf, type UploadedPhoto } from './photo-upload';
import { cloudinaryImageUrl, onSaleShortfalls, projectedReadiness } from './tour-editor-view';
import type { EditorWriteResult } from './tour-editor-write';

/**
 * Logic THUẦN của tab Photos (spec F18 §2g, ADR-0048): codec lỗi, hợp đồng của ba
 * server action, giá trị form, kiểm trước khi gửi, payload, lọc file, sức chứa.
 */
const e = messages.admin.tours.editor;
const t = e.photos;

const photosCodec = createWriteErrorCodec(t.errors);
/**
 * Ký là lệnh chưa đụng gì: kết cục không rõ ở đây không có gì để "lỡ đi qua", nên
 * câu GENERIC là câu riêng thay vì giọng ghi chung (`transportCopy`, khuôn F8).
 */
const signCodec = createWriteErrorCodec(t.signErrors, { transportCopy: { GENERIC: t.signFailed } });

export type PhotosContractCode = keyof typeof t.errors;
export type SignUploadsContractCode = keyof typeof t.signErrors;
export const PHOTOS_CONTRACT_CODES = photosCodec.codes;
export const classifyPhotosError = photosCodec.classify;
export const photosErrorCopy = photosCodec.copy;
export const classifySignUploadsError = signCodec.classify;
export const signUploadsErrorCopy = signCodec.copy;

/** Số file tải song song — đủ nhanh mà không bóp băng thông của một máy admin. */
export const UPLOAD_CONCURRENCY = 3;

// ── Hợp đồng vận chuyển của server action ──────────────────────────────────

export type SetPhotosAction = (
  input: AdminTourPhotosInput,
) => Promise<EditorWriteResult<PhotosContractCode>>;

export type SignPhotoUploadsResult =
  | { ok: true; params: SignedUploadParams[] }
  | { ok: false; code: SignUploadsContractCode | TransportFailureCode };
export type SignPhotoUploadsAction = (
  input: AdminTourSignPhotoUploadsInput,
) => Promise<SignPhotoUploadsResult>;

export type PhotoLibraryResult =
  | { ok: true; library: AdminPhotoLibrary }
  | { ok: false; code: TransportFailureCode };
export type LoadPhotoLibraryAction = () => Promise<PhotoLibraryResult>;

// ── Giá trị form ────────────────────────────────────────────────────────────

export interface PhotoDraft extends Keyed {
  publicId: string;
  /** URL delivery `f_auto,q_auto` — thumbnail dựng từ nó (`tourPhotoThumb`). */
  url: string;
  alt: string;
  source: TourPhotoSource;
  author: string | null;
  license: string | null;
  /** Chỉ ảnh VỪA tải lên trong lần sửa này — metadata Cloudinary trả về. */
  upload?: TourPhotoUpload;
}

export interface PhotosFormValues {
  photos: PhotoDraft[];
}

export interface PhotosFormErrors {
  /** Lỗi của CẢ danh sách (tour đang bán gỡ hết ảnh). */
  list?: string;
  /** Lỗi ô alt, khoá theo `key` của dòng. */
  rows: Record<string, string>;
}

/** Key tất định theo vị trí (bài học 12) — form dựng hai lần, SSR rồi hydrate. */
export function photosFormValues(detail: AdminTourDetail): PhotosFormValues {
  return {
    photos: detail.photos.map((photo, index) => ({
      key: `photo-${index}`,
      publicId: photo.publicId,
      url: photo.url,
      alt: photo.alt ?? '',
      source: photo.source,
      author: photo.author,
      license: photo.license,
    })),
  };
}

export function validatePhotosForm(
  values: PhotosFormValues,
  detail: AdminTourDetail,
): PhotosFormErrors {
  const rows: Record<string, string> = {};
  for (const photo of values.photos) {
    const alt = photo.alt.trim();
    if (alt === '') rows[photo.key] = t.altRequired;
    else if (alt.length > TOUR_PHOTO_ALT_MAX) rows[photo.key] = e.form.errors.tooLong(TOUR_PHOTO_ALT_MAX);
  }
  // G11: luật "tour đang bán" suy từ readiness dự tính (ADR-0048 §8).
  const shortfalls = onSaleShortfalls(
    detail,
    projectedReadiness(detail, { photoCount: values.photos.length }),
  );
  return shortfalls.cover ? { list: e.form.errors.photosOnSale, rows } : { rows };
}

export function hasPhotoErrors(errors: PhotosFormErrors): boolean {
  return errors.list !== undefined || Object.keys(errors.rows).length > 0;
}

/** Giá trị form → input `setPhotos`. Gọi SAU khi kiểm đã sạch. */
export function photosPayload(
  id: string,
  version: string,
  values: PhotosFormValues,
): AdminTourPhotosInput {
  return {
    id,
    version,
    photos: values.photos.map((photo) => ({
      publicId: photo.publicId,
      alt: photo.alt.trim(),
      ...(photo.upload ? { upload: photo.upload } : {}),
    })),
  };
}

/** Đưa một ảnh lên đầu — ảnh bìa (ADR-0048 §1). Key lạ trả nguyên giá trị. */
export function makeCover(values: PhotosFormValues, key: string): PhotosFormValues {
  const photo = values.photos.find((item) => item.key === key);
  if (!photo) return values;
  return { photos: [photo, ...values.photos.filter((item) => item.key !== key)] };
}

// ── Tải lên ─────────────────────────────────────────────────────────────────

/** Chỗ còn trống: 30 trừ ảnh đang có trừ file đang tải (hỏng cũng giữ chỗ tới khi gỡ). */
export function remainingCapacity(photoCount: number, uploadCount: number): number {
  return Math.max(0, TOUR_PHOTOS_MAX - photoCount - uploadCount);
}

export interface SkippedFile {
  name: string;
  reason: 'type' | 'size' | 'full';
}

/** Lọc file trước khi ký: đuôi, dung lượng, rồi sức chứa — theo thứ tự admin chọn. */
export function acceptFiles(
  files: readonly File[],
  capacity: number,
): { accepted: File[]; skipped: SkippedFile[] } {
  const accepted: File[] = [];
  const skipped: SkippedFile[] = [];
  for (const file of files) {
    if (imageExtensionOf(file.name) === null) skipped.push({ name: file.name, reason: 'type' });
    else if (file.size > TOUR_PHOTO_MAX_BYTES) skipped.push({ name: file.name, reason: 'size' });
    else if (accepted.length >= capacity) skipped.push({ name: file.name, reason: 'full' });
    else accepted.push(file);
  }
  return { accepted, skipped };
}

export function skippedCopy(file: SkippedFile): string {
  return t.skipped[file.reason](file.name);
}

/** Ảnh vừa tải → dòng mới; alt để trống, admin phải điền trước khi lưu. */
export function uploadedPhotoDraft(uploaded: UploadedPhoto, cloudName: string): PhotoDraft {
  return {
    key: newItemKey(),
    publicId: uploaded.publicId,
    url: cloudinaryImageUrl(cloudName, uploaded.publicId, uploaded.upload.version),
    alt: '',
    source: 'UPLOAD',
    author: null,
    license: null,
    upload: uploaded.upload,
  };
}

/** Ảnh thư viện → dòng mới; alt chép từ ảnh gốc (sửa được), ghi công đi theo để hiển thị. */
export function libraryPhotoDraft(photo: AdminLibraryPhoto): PhotoDraft {
  return {
    key: newItemKey(),
    publicId: photo.publicId,
    url: photo.url,
    alt: photo.alt ?? '',
    source: 'LIBRARY',
    author: photo.author,
    license: photo.license,
  };
}

/** Dòng nguồn dưới ô alt — quyết định 1 của plan F18: không kèm tên địa danh. */
export function photoSourceLine(photo: PhotoDraft): string {
  if (photo.source === 'UPLOAD') return t.uploaded;
  return photo.author === null
    ? t.fromLibrary
    : `${t.fromLibrary} · ${t.credit(photo.author, photo.license)}`;
}

/** Chạy mọi việc, không quá `limit` việc cùng lúc; lỗi của một việc do chính nó bắt. */
export async function runWithConcurrency(
  tasks: readonly (() => Promise<void>)[],
  limit: number,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < tasks.length) {
      const task = tasks[next];
      next += 1;
      if (task) await task();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, lane));
}
```

- [ ] **B5.** Chạy lại B2 → XANH. Đột biến: `acceptFiles` đổi `>` thành `>=` ở dung
  lượng → file đúng 10 MB bị loại, ca đỏ; `makeCover` bỏ `filter` → ca đỏ;
  `runWithConcurrency` bỏ `Math.min(limit, …)` thay bằng `tasks.length` → `peak` đỏ;
  `parseUploadResponse` bỏ `Number.isInteger(width)` → ca `20.5` đỏ. Trả lại.
- [ ] **B6.** Quy trình gate. Commit:
  `feat(admin): logic thuần của tab Photos và hàm tải ảnh lên Cloudinary`

## Task 11 — Client và server action của tab Photos

**Files:**

- Modify: `apps/admin/src/lib/api/tours.ts`, `tours.spec.ts`
- Modify: `apps/admin/src/app/(admin)/tours/[slug]/actions.ts`

**Interfaces:**

- Consumes: contract Task 3–5; kiểu action và codec Task 10.
- Produces: `setAdminTourPhotos`, `signAdminTourPhotoUploads`,
  `fetchTourPhotoLibrary` (client); `setTourPhotosAction`,
  `signTourPhotoUploadsAction`, `loadTourPhotoLibraryAction` (server action) —
  trang `/tours/[slug]/photos` của Task 12 truyền ba action này vào form.

- [ ] **B1. Test đỏ** (`tours.spec.ts`; thêm `photoLibrary: vi.fn()` vào mock
  `api.admin.tours`):

```ts
describe('fetchTourPhotoLibrary (F18)', () => {
  it('gọi thủ tục thư viện KHÔNG input, mang cookie admin; trả nguyên kết quả', async () => {
    const library = [{ destination: { id: 'd', name: 'Hội An' }, photos: [] }];
    const libraryMock = api.admin.tours.photoLibrary as unknown as Mock;
    libraryMock.mockResolvedValue(library);

    await expect(fetchTourPhotoLibrary('cookie=x')).resolves.toBe(library);
    expect(libraryMock).toHaveBeenCalledWith(undefined, { context: { cookie: 'cookie=x' } });
  });
});
```

- [ ] **B2.** Chạy → ĐỎ. **B3. Cài client** (`lib/api/tours.ts`, cạnh `setAdminTourCosts`):

```ts
export async function setAdminTourPhotos(
  cookie: string,
  input: AdminTourPhotosInput,
): Promise<AdminTourDetail> {
  return api.admin.tours.setPhotos(input, { context: withAdminAuth(cookie) });
}

export async function signAdminTourPhotoUploads(
  cookie: string,
  input: AdminTourSignPhotoUploadsInput,
): Promise<SignedUploadParams[]> {
  return api.admin.tours.signPhotoUploads(input, { context: withAdminAuth(cookie) });
}

/** Kho ảnh địa danh cho hộp Add from library — KHÔNG nuốt lỗi: action phân loại. */
export async function fetchTourPhotoLibrary(cookie: string): Promise<AdminPhotoLibrary> {
  return api.admin.tours.photoLibrary(undefined, { context: withAdminAuth(cookie) });
}
```

  (`setPhotos` trả tour server vừa ghi — đi qua `withPhotoFallback` là thừa: nó chỉ
  chạy khi API đã có F18.)
- [ ] **B4. Server action** (`actions.ts`), cùng khuôn các action có sẵn:

```ts
export async function setTourPhotosAction(
  input: AdminTourPhotosInput,
): Promise<EditorWriteResult<PhotosContractCode>> {
  const parsed = AdminTourPhotosInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let detail: AdminTourDetail;
  try {
    detail = await setAdminTourPhotos(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyPhotosError(error) };
  }
  return { ok: true, detail };
}

/**
 * Ký một lô upload — trả bộ tham số cho TRÌNH DUYỆT POST thẳng lên Cloudinary.
 * Bộ tham số không mang api_secret (ADR-0021 §1); chữ ký sống mười phút.
 */
export async function signTourPhotoUploadsAction(
  input: AdminTourSignPhotoUploadsInput,
): Promise<SignPhotoUploadsResult> {
  const parsed = AdminTourSignPhotoUploadsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let params: SignedUploadParams[];
  try {
    params = await signAdminTourPhotoUploads(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifySignUploadsError(error) };
  }
  return { ok: true, params };
}

/** Kho ảnh địa danh — thủ tục không khai mã lỗi, nên chỉ còn lỗi vận chuyển. */
export async function loadTourPhotoLibraryAction(): Promise<PhotoLibraryResult> {
  const cookie = (await cookies()).toString();
  let library: AdminPhotoLibrary;
  try {
    library = await fetchTourPhotoLibrary(cookie);
  } catch (error) {
    return { ok: false, code: classifyWriteError(error, new Set<never>()) };
  }
  return { ok: true, library };
}
```

  (import `classifyWriteError` từ `@/lib/api/write-error`; các kiểu và codec từ
  `@/lib/tour-photos`; schema và kiểu contract tương ứng.)
- [ ] **B5.** Chạy `tours.spec.ts` → XANH. Đột biến: gọi `photoLibrary({}, …)` → ca
  đỏ. Quy trình gate. Commit:
  `feat(admin): client và server action cho tab Photos`

## Task 12 — Tab Photos: danh sách, tải lên, lưu

**Files:**

- Create: `apps/admin/src/components/tours/editor/tour-photos-form.tsx`, `tour-photos-form.spec.tsx`
- Create: `apps/admin/src/app/(admin)/tours/[slug]/photos/page.tsx`

**Interfaces:**

- Consumes: mọi thứ của Task 8–11.
- Produces: `TourPhotosForm({ detail, save, sign, loadLibrary })` — Task 13 thêm
  nút Add from library và hộp thư viện vào CHÍNH component này.

- [ ] **B1. Test đỏ** (`tour-photos-form.spec.tsx`):

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SignedUploadParams } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { uploadPhoto } from '@/lib/photo-upload';
import type {
  LoadPhotoLibraryAction,
  SetPhotosAction,
  SignPhotoUploadsAction,
} from '@/lib/tour-photos';
import { COVER_PHOTO, detailFixture, TOUR_ID, VERSION } from '@/test/tour-detail';
import { TourPhotosForm } from './tour-photos-form';

/** Tab Photos (spec F18 §2g, ADR-0048). */
const e = messages.admin.tours.editor;
const t = e.photos;

const success = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => success(...args), error: vi.fn() },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
// Giữ phần thuần thật (đuôi file…), chỉ thay đường XHR.
vi.mock('@/lib/photo-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/photo-upload')>()),
  uploadPhoto: vi.fn(),
}));
const uploadMock = uploadPhoto as unknown as Mock;

beforeEach(() => {
  success.mockReset();
  uploadMock.mockReset();
  // jsdom không có hai hàm này.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

const SECOND = { ...COVER_PHOTO, publicId: 'tourism/catalog/destination/ha-long/2', alt: 'Kayaks in a lagoon' };

const params = (n: number): SignedUploadParams => ({
  signature: 'sig',
  timestamp: 1_760_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: `tourism/tours/${TOUR_ID}`,
  publicId: `pid-${n}`,
  allowedFormats: 'jpg,jpeg,png,webp,avif,gif',
  transformation: 'c_limit,w_2400,h_2400,fl_force_strip',
  overwrite: false,
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
});
const uploaded = (n: number) => ({
  publicId: `tourism/tours/${TOUR_ID}/pid-${n}`,
  upload: { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 1000 },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderForm(
  detail = detailFixture({ photos: [COVER_PHOTO, SECOND] }),
  actions: { save?: SetPhotosAction; sign?: SignPhotoUploadsAction } = {},
) {
  const save = actions.save ?? vi.fn<SetPhotosAction>();
  const sign = actions.sign ?? vi.fn<SignPhotoUploadsAction>();
  const loadLibrary = vi.fn<LoadPhotoLibraryAction>();
  const user = userEvent.setup({ applyAccept: false });
  render(<TourPhotosForm detail={detail} save={save} sign={sign} loadLibrary={loadLibrary} />);
  return { user, save: save as Mock, sign: sign as Mock };
}

const saveButton = () => screen.getByRole('button', { name: e.save });
const altInputs = () => screen.getAllByRole('textbox', { name: t.alt });
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const file = (name: string, bytes = 10) => new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });

describe('TourPhotosForm', () => {
  it('mở ra đủ ảnh theo thứ tự; ảnh đầu mang nhãn Cover; bộ đếm; Save khoá khi chưa sửa', () => {
    renderForm();

    expect(altInputs().map((input) => (input as HTMLInputElement).value)).toEqual([
      COVER_PHOTO.alt,
      SECOND.alt,
    ]);
    expect(screen.getAllByText(t.cover)).toHaveLength(1);
    expect(screen.getByText(t.count(2, 30))).toBeInTheDocument();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('Make cover đưa ảnh lên đầu, tiêu điểm vào ô alt của nó; Save gửi đúng thứ tự mới', async () => {
    const save = vi.fn<SetPhotosAction>().mockResolvedValue({ ok: true, detail: detailFixture() });
    const { user } = renderForm(undefined, { save });

    await user.click(screen.getByRole('button', { name: t.makeCoverFor(t.photoName(2)) }));

    expect((altInputs()[0] as HTMLInputElement).value).toBe(SECOND.alt);
    expect(altInputs()[0]).toHaveFocus();
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toEqual({
      id: TOUR_ID,
      version: VERSION,
      photos: [
        { publicId: SECOND.publicId, alt: SECOND.alt },
        { publicId: COVER_PHOTO.publicId, alt: COVER_PHOTO.alt },
      ],
    });
  });

  it('alt rỗng thì báo dưới đúng ô và không gửi', async () => {
    const { user, save } = renderForm();

    await user.clear(altInputs()[1] as HTMLElement);
    await user.click(saveButton());

    expect(screen.getByRole('alert')).toHaveTextContent(t.altRequired);
    expect(save).not.toHaveBeenCalled();
  });

  it('tour đang bán gỡ hết ảnh → lỗi của danh sách, không gửi; tiêu điểm về nút Upload photos', async () => {
    const { user, save } = renderForm(detailFixture());

    await user.click(screen.getByRole('button', { name: messages.admin.listEditor.remove(t.photoName(1)) }));

    expect(screen.getByRole('button', { name: t.upload })).toHaveFocus();
    await user.click(saveButton());
    expect(screen.getByRole('alert')).toHaveTextContent(e.form.errors.photosOnSale);
    expect(save).not.toHaveBeenCalled();
  });

  it('tải lên: ký MỘT lần cho cả lô; ảnh tải xong nối vào cuối, alt trống; Save khoá khi còn file đang tải', async () => {
    const sign = vi.fn<SignPhotoUploadsAction>().mockResolvedValue({ ok: true, params: [params(1), params(2)] });
    const second = deferred<ReturnType<typeof uploaded>>();
    uploadMock.mockResolvedValueOnce(uploaded(1)).mockReturnValueOnce(second.promise);
    const { user } = renderForm(undefined, { sign });

    await user.upload(fileInput(), [file('a.jpg'), file('b.jpg')]);

    expect(sign).toHaveBeenCalledWith({ id: TOUR_ID, count: 2 });
    await waitFor(() => expect(altInputs()).toHaveLength(3));
    expect((altInputs()[2] as HTMLInputElement).value).toBe('');
    expect(screen.getByText(t.waiting(1))).toBeInTheDocument();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');

    second.resolve(uploaded(2));
    await waitFor(() => expect(altInputs()).toHaveLength(4));
    expect(screen.queryByText(t.waiting(1))).not.toBeInTheDocument();
    expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('file sai đuôi hay quá 10 MB bị loại kèm lý do; không còn file nào thì không ký', async () => {
    const { user, sign } = renderForm();

    await user.upload(fileInput(), [file('doc.pdf'), file('huge.jpg', 10 * 1024 * 1024 + 1)]);

    expect(screen.getByText(t.skipped.type('doc.pdf'))).toBeInTheDocument();
    expect(screen.getByText(t.skipped.size('huge.jpg'))).toBeInTheDocument();
    expect(sign).not.toHaveBeenCalled();
  });

  it('tải hỏng → báo lỗi; Retry ký lại MỘT chữ ký rồi tải lại', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValueOnce({ ok: true, params: [params(1)] })
      .mockResolvedValueOnce({ ok: true, params: [params(9)] });
    uploadMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(uploaded(9));
    const { user } = renderForm(undefined, { sign });

    await user.upload(fileInput(), [file('a.jpg')]);
    await screen.findByText(t.uploadFailed('a.jpg'));
    await user.click(screen.getByRole('button', { name: t.retry }));

    expect(sign).toHaveBeenLastCalledWith({ id: TOUR_ID, count: 1 });
    await waitFor(() => expect(altInputs()).toHaveLength(3));
    expect(screen.queryByText(t.uploadFailed('a.jpg'))).not.toBeInTheDocument();
  });

  it('ký hỏng → câu của mã, không có dòng tải nào', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValue({ ok: false, code: 'MEDIA_UPLOAD_NOT_CONFIGURED' });
    const { user } = renderForm(undefined, { sign });

    await user.upload(fileInput(), [file('a.jpg')]);

    expect(await screen.findByText(t.signErrors.MEDIA_UPLOAD_NOT_CONFIGURED)).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('kéo thả file vào vùng danh sách cũng tải lên', async () => {
    const sign = vi.fn<SignPhotoUploadsAction>().mockResolvedValue({ ok: true, params: [params(1)] });
    uploadMock.mockResolvedValueOnce(uploaded(1));
    renderForm(undefined, { sign });

    fireEvent.drop(screen.getByTestId('photo-drop-zone'), {
      dataTransfer: { files: [file('a.jpg')] },
    });

    await waitFor(() => expect(sign).toHaveBeenCalledWith({ id: TOUR_ID, count: 1 }));
  });

  it('lưu thành công: toast, form nhận bản server trả về', async () => {
    const next = detailFixture({ version: '2026-09-28T10:00:00.000Z', photos: [{ ...COVER_PHOTO, alt: 'Saved alt' }] });
    const save = vi.fn<SetPhotosAction>().mockResolvedValue({ ok: true, detail: next });
    const { user } = renderForm(detailFixture(), { save });

    await user.clear(altInputs()[0] as HTMLElement);
    await user.type(altInputs()[0] as HTMLElement, 'Saved alt');
    await user.click(saveButton());

    await waitFor(() => expect(success).toHaveBeenCalledWith(e.saved));
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  });
});
```

- [ ] **B2.** `pnpm --filter @tourism/admin exec vitest run src/components/tours/editor/tour-photos-form.spec.tsx`
  → ĐỎ (component chưa có).
- [ ] **B3. Cài `tour-photos-form.tsx`:**

```tsx
'use client';

import {
  ALLOWED_IMAGE_EXTENSIONS,
  type AdminTourDetail,
  type SignedUploadParams,
  TOUR_PHOTOS_MAX,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { UploadIcon } from 'lucide-react';
import * as React from 'react';
import { FormField } from '@/components/kit/form-field';
import { ListEditor } from '@/components/kit/list-editor';
import { EditorFormFrame } from '@/components/tours/editor/editor-form-frame';
import { usePublishSavedDetail } from '@/components/tours/editor/tour-detail-context';
import { newItemKey } from '@/lib/list-editor';
import { uploadPhoto } from '@/lib/photo-upload';
import { projectedReadiness, tourPhotoThumb } from '@/lib/tour-editor-view';
import {
  acceptFiles,
  hasPhotoErrors,
  type LoadPhotoLibraryAction,
  makeCover,
  type PhotoDraft,
  type PhotosContractCode,
  type PhotosFormErrors,
  type PhotosFormValues,
  photoSourceLine,
  photosErrorCopy,
  photosFormValues,
  photosPayload,
  remainingCapacity,
  runWithConcurrency,
  type SetPhotosAction,
  type SignPhotoUploadsAction,
  signUploadsErrorCopy,
  skippedCopy,
  UPLOAD_CONCURRENCY,
  uploadedPhotoDraft,
  validatePhotosForm,
} from '@/lib/tour-photos';
import { useSectionSave } from '@/lib/use-section-save';
import { useTourFormState } from '@/lib/use-tour-form-state';

/**
 * Tab Photos (spec F18 §2g, ADR-0048): một danh sách có thứ tự, ảnh đầu là ảnh bìa.
 *
 * - Ảnh vào danh sách bằng hai đường ở thanh trên (tải lên, thư viện) — kit
 *   `ListEditor` không có nút thêm; gỡ dòng cuối trả tiêu điểm về Upload photos.
 * - Tải lên: ký MỘT lần cho cả lô, tối đa `UPLOAD_CONCURRENCY` file cùng lúc,
 *   thẳng lên Cloudinary. File đang tải hay hỏng nằm ở danh sách riêng dưới các
 *   dòng ảnh — chúng chưa phải ảnh của tour cho tới khi tải xong.
 * - Save khoá khi còn file đang tải (`blockedNote`). Rời trang lúc chưa lưu thì
 *   hộp hỏi lại của F17 bật lên; ảnh đã tải mà bỏ nằm trong hàng dọn từ lúc ký.
 */
const t = messages.admin.tours.editor.photos;
const ACCEPT = ALLOWED_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
const NO_ERRORS: PhotosFormErrors = { rows: {} };

interface UploadDraft {
  key: string;
  file: File;
  preview: string;
  status: 'uploading' | 'failed';
  percent: number;
}

export function TourPhotosForm({
  detail,
  save: saveAction,
  sign,
}: {
  detail: AdminTourDetail;
  save: SetPhotosAction;
  sign: SignPhotoUploadsAction;
  loadLibrary: LoadPhotoLibraryAction;
}) {
  const publishSaved = usePublishSavedDetail();
  const form = useTourFormState<PhotosFormValues>(detail, photosFormValues);
  const { values, version, dirty, showValidation } = form;
  const [uploads, setUploads] = React.useState<UploadDraft[]>([]);
  const [notices, setNotices] = React.useState<string[]>([]);
  const [focusAlt, setFocusAlt] = React.useState<string | null>(null);
  const uploadButton = React.useRef<HTMLButtonElement>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  /** URL xem trước còn sống — thu hồi hết khi rời tab. */
  const previews = React.useRef(new Set<string>());

  const errors = showValidation ? validatePhotosForm(values, detail) : NO_ERRORS;
  const uploadingCount = uploads.filter((upload) => upload.status === 'uploading').length;
  const capacity = remainingCapacity(values.photos.length, uploads.length);

  const { pending, banner, save } = useSectionSave<PhotosContractCode>({
    copy: photosErrorCopy,
    slug: detail.slug,
    version,
    projected: () => projectedReadiness(detail, { photoCount: values.photos.length }),
    onSaved: (next) => {
      form.adopt(next);
      // Phần đầu (readiness, công tắc) theo kịp ngay, không chờ lượt refresh.
      publishSaved(next);
    },
  });

  React.useEffect(() => {
    const live = previews.current;
    return () => {
      for (const url of live) URL.revokeObjectURL(url);
    };
  }, []);

  // "Make cover" làm nút vừa bấm biến mất cùng dòng cũ (quyết định 7 của plan).
  React.useEffect(() => {
    if (focusAlt === null) return;
    document.getElementById(`photo-${focusAlt}-alt`)?.focus();
    setFocusAlt(null);
  }, [focusAlt]);

  function patchUpload(key: string, next: Partial<UploadDraft>) {
    setUploads((current) => current.map((upload) => (upload.key === key ? { ...upload, ...next } : upload)));
  }

  function dropUpload(draft: UploadDraft) {
    URL.revokeObjectURL(draft.preview);
    previews.current.delete(draft.preview);
    setUploads((current) => current.filter((upload) => upload.key !== draft.key));
  }

  async function uploadOne(draft: UploadDraft, params: SignedUploadParams) {
    try {
      const done = await uploadPhoto(draft.file, params, (percent) => patchUpload(draft.key, { percent }));
      dropUpload(draft);
      form.setValues((current) => ({
        photos: [...current.photos, uploadedPhotoDraft(done, params.cloudName)],
      }));
    } catch {
      patchUpload(draft.key, { status: 'failed' });
    }
  }

  async function startUploads(files: readonly File[]) {
    const { accepted, skipped } = acceptFiles(files, capacity);
    const skippedNotes = skipped.map(skippedCopy);
    setNotices(skippedNotes);
    if (accepted.length === 0) return;

    const signed = await sign({ id: detail.id, count: accepted.length });
    if (!signed.ok) {
      setNotices([...skippedNotes, signUploadsErrorCopy(signed.code)]);
      return;
    }
    const drafts = accepted.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { key: newItemKey(), file, preview, status: 'uploading' as const, percent: 0 };
    });
    setUploads((current) => [...current, ...drafts]);
    await runWithConcurrency(
      drafts.flatMap((draft, index) => {
        const params = signed.params[index];
        return params ? [() => uploadOne(draft, params)] : [];
      }),
      UPLOAD_CONCURRENCY,
    );
  }

  /** Chữ ký cũ có thể đã hết hạn — Retry luôn ký lại MỘT chữ ký mới. */
  async function retry(draft: UploadDraft) {
    patchUpload(draft.key, { status: 'uploading', percent: 0 });
    const signed = await sign({ id: detail.id, count: 1 });
    const params = signed.ok ? signed.params[0] : undefined;
    if (params === undefined) {
      patchUpload(draft.key, { status: 'failed' });
      if (!signed.ok) setNotices([signUploadsErrorCopy(signed.code)]);
      return;
    }
    await uploadOne(draft, params);
  }

  function submit() {
    form.setShowValidation(true);
    if (hasPhotoErrors(validatePhotosForm(values, detail))) return;
    void save(() => saveAction(photosPayload(detail.id, version, values)));
  }

  function patchAlt(key: string, alt: string) {
    form.setValues((current) => ({
      photos: current.photos.map((photo) => (photo.key === key ? { ...photo, alt } : photo)),
    }));
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      <EditorFormFrame
        dirty={dirty}
        pending={pending}
        banner={banner}
        serverChanged={form.serverChanged}
        blockedNote={uploadingCount > 0 ? t.waiting(uploadingCount) : undefined}
        onSubmit={submit}
        onReload={form.reload}
      >
        <section className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              ref={uploadButton}
              type="button"
              variant="outline"
              focusableWhenDisabled
              disabled={pending || capacity === 0}
              onClick={() => fileInput.current?.click()}
            >
              <UploadIcon aria-hidden="true" />
              {t.upload}
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                // Chọn lại đúng file ấy lần nữa vẫn phải bắn `change`.
                event.target.value = '';
                void startUploads(files);
              }}
            />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t.count(values.photos.length, TOUR_PHOTOS_MAX)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.intro} {t.formats}
          </p>
          {notices.length > 0 ? (
            <ul role="status" className="grid gap-1 text-sm text-destructive-emphasis">
              {notices.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
          {errors.list ? (
            <p role="alert" className="text-sm text-destructive-emphasis">
              {errors.list}
            </p>
          ) : null}

          <div
            data-testid="photo-drop-zone"
            className="grid gap-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void startUploads([...event.dataTransfer.files]);
            }}
          >
            <ListEditor<PhotoDraft>
              items={values.photos}
              onChange={(photos) => form.setValues({ photos })}
              max={TOUR_PHOTOS_MAX}
              labelledRows
              emptyFocus={uploadButton}
              itemName={(index) => t.photoName(index + 1)}
              disabled={pending}
              empty={t.empty}
              renderItem={(photo, index) => {
                const altId = `photo-${photo.key}-alt`;
                return (
                  <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                    <div className="relative">
                      {/* Ảnh là phần trang trí: ô alt ngay cạnh đã mô tả nó. */}
                      <img
                        src={tourPhotoThumb(photo.url)}
                        alt=""
                        className="aspect-[3/2] w-32 rounded-md bg-muted object-cover"
                      />
                      {index === 0 ? (
                        <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          {t.cover}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-1.5">
                      <FormField id={altId} label={t.alt} error={errors.rows[photo.key]}>
                        {(describedBy) => (
                          <Input
                            id={altId}
                            value={photo.alt}
                            disabled={pending}
                            aria-invalid={errors.rows[photo.key] !== undefined}
                            aria-describedby={describedBy}
                            onChange={(event) => patchAlt(photo.key, event.target.value)}
                          />
                        )}
                      </FormField>
                      <p className="text-xs text-muted-foreground">{photoSourceLine(photo)}</p>
                      {index > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          focusableWhenDisabled
                          disabled={pending}
                          aria-label={t.makeCoverFor(t.photoName(index + 1))}
                          onClick={() => {
                            form.setValues((current) => makeCover(current, photo.key));
                            setFocusAlt(photo.key);
                          }}
                        >
                          {t.makeCover}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              }}
            />

            {uploads.map((upload) => (
              <div
                key={upload.key}
                className="flex items-center gap-3 rounded-md border border-dashed p-3"
              >
                <img
                  src={upload.preview}
                  alt=""
                  className="aspect-[3/2] w-32 rounded-md bg-muted object-cover"
                />
                <div className="grid flex-1 gap-1.5">
                  {upload.status === 'uploading' ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {t.uploading(upload.file.name, upload.percent)}
                      </p>
                      <div
                        role="progressbar"
                        aria-label={t.uploadingLabel(upload.file.name)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={upload.percent}
                        className="h-1 overflow-hidden rounded-full bg-muted"
                      >
                        <div className="h-1 bg-primary" style={{ width: `${upload.percent}%` }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <p role="alert" className="text-sm text-destructive-emphasis">
                        {t.uploadFailed(upload.file.name)}
                      </p>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => void retry(upload)}>
                          {t.retry}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => dropUpload(upload)}>
                          {t.remove}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </EditorFormFrame>
    </div>
  );
}
```

  Nếu Biome báo `noImgElement` hay luật tương tự: admin KHÔNG dùng `next/image` ở đâu
  cả (`next.config.ts` của admin ghi rõ lý do, `images.unoptimized`), nên `<img>`
  trần là đúng — đọc cách `review-details-dialog.tsx` xử lý cảnh báo ấy rồi làm y
  hệt, không thêm `next/image`.

- [ ] **B4. Trang** `apps/admin/src/app/(admin)/tours/[slug]/photos/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TourPhotosForm } from '@/components/tours/editor/tour-photos-form';
import {
  loadTourPhotoLibraryAction,
  setTourPhotosAction,
  signTourPhotoUploadsAction,
} from '../actions';
import { loadAdminTour } from '../load-tour';

export const metadata: Metadata = { title: 'Tour photos — Nexora back office' };

/** Tab Photos của khu làm việc (spec F18 §2g). Phần đầu và `AdminShell` ở layout. */
export default async function TourPhotosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await loadAdminTour(slug);
  if (!detail) notFound();
  return (
    <TourPhotosForm
      detail={detail}
      save={setTourPhotosAction}
      sign={signTourPhotoUploadsAction}
      loadLibrary={loadTourPhotoLibraryAction}
    />
  );
}
```

- [ ] **B5.** Chạy spec B2 → XANH. Đột biến: bỏ `blockedNote` → ca tải lên đỏ; bỏ
  `setFocusAlt` → ca Make cover đỏ ở tiêu điểm; `startUploads` ký
  `count: files.length` thay vì `accepted.length` → ca file bị loại đỏ (ký với 2 dù
  không còn file nào); Retry dùng lại `params` cũ thay vì ký mới → ca Retry đỏ ở
  `toHaveBeenLastCalledWith`. Trả lại.
- [ ] **B6.** Quy trình gate. Commit:
  `feat(admin): tab Photos — sắp ảnh, chọn ảnh bìa, alt, tải ảnh lên Cloudinary`

## Task 13 — Hộp Add from library

**Files:**

- Create: `apps/admin/src/components/tours/editor/photo-library-dialog.tsx`, `photo-library-dialog.spec.tsx`
- Modify: `apps/admin/src/components/tours/editor/tour-photos-form.tsx`, `tour-photos-form.spec.tsx`

**Interfaces:**

- Consumes: `AdminPhotoLibrary`, `AdminLibraryPhoto` (Task 4);
  `LoadPhotoLibraryAction`, `libraryPhotoDraft` (Task 10); `FormSelect`,
  `DIALOG_FRAME` (có sẵn); copy `t.dialog` (Task 9).
- Produces: `PhotoLibraryDialog({ open, onOpenChange, library, onLoaded, load,
  tourDestinationIds, existing, capacity, onAdd })`.

- [ ] **B1. Test đỏ** (`photo-library-dialog.spec.tsx`):

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminLibraryPhoto, AdminPhotoLibrary } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { LoadPhotoLibraryAction } from '@/lib/tour-photos';
import { DEST_A, DEST_B } from '@/test/tour-detail';
import { PhotoLibraryDialog } from './photo-library-dialog';

const t = messages.admin.tours.editor.photos.dialog;

const photo = (id: string, alt: string): AdminLibraryPhoto => ({
  publicId: `lib/${id}`,
  url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/${id}`,
  alt,
  width: 2400,
  height: 1600,
  author: null,
  license: null,
});
const LIBRARY: AdminPhotoLibrary = [
  { destination: { id: DEST_A, name: 'Hạ Long' }, photos: [photo('a1', 'Bay at dawn'), photo('a2', 'Cave lights')] },
  { destination: { id: DEST_B, name: 'Hà Nội' }, photos: [photo('b1', 'Old Quarter')] },
];

function Harness({
  load,
  capacity = 30,
  existing = [],
  onAdd = vi.fn(),
}: {
  load: LoadPhotoLibraryAction;
  capacity?: number;
  existing?: string[];
  onAdd?: (photos: AdminLibraryPhoto[]) => void;
}) {
  const [library, setLibrary] = useState<AdminPhotoLibrary | null>(null);
  return (
    <PhotoLibraryDialog
      open
      onOpenChange={vi.fn()}
      library={library}
      onLoaded={setLibrary}
      load={load}
      tourDestinationIds={[DEST_A]}
      existing={new Set(existing)}
      capacity={capacity}
      onAdd={onAdd}
    />
  );
}

describe('PhotoLibraryDialog', () => {
  it('tải thư viện MỘT lần; mặc định bày ảnh các địa danh của tour', async () => {
    const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: true, library: LIBRARY });
    render(<Harness load={load} />);

    expect(screen.getByText(t.loading)).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Bay at dawn' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Cave lights' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Old Quarter' })).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('đổi địa danh ở ô chọn thì bày ảnh của địa danh ấy', async () => {
    const user = userEvent.setup();
    const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: true, library: LIBRARY });
    render(<Harness load={load} />);
    await screen.findByRole('checkbox', { name: 'Bay at dawn' });

    await user.click(screen.getByRole('combobox', { name: t.destination }));
    await user.click(screen.getByRole('option', { name: 'Hà Nội' }));

    expect(screen.getByRole('checkbox', { name: 'Old Quarter' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Bay at dawn' })).not.toBeInTheDocument();
  });

  it('ảnh đã có trong tour hiện "Added", không tích được', async () => {
    const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: true, library: LIBRARY });
    render(<Harness load={load} existing={['lib/a1']} />);

    const added = await screen.findByRole('checkbox', { name: 'Bay at dawn' });
    expect(added).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(`Bay at dawn · ${t.added}`)).toBeInTheDocument();
  });

  it('không tích quá sức chứa; Add gửi đúng ảnh đã tích theo thứ tự bày', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: true, library: LIBRARY });
    render(<Harness load={load} capacity={1} onAdd={onAdd} />);

    await user.click(await screen.findByRole('checkbox', { name: 'Cave lights' }));

    expect(screen.getByRole('checkbox', { name: 'Bay at dawn' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: t.add(1) }));
    expect(onAdd).toHaveBeenCalledWith([photo('a2', 'Cave lights')]);
  });

  it('tải hỏng → câu lỗi và nút thử lại', async () => {
    const user = userEvent.setup();
    const load = vi
      .fn<LoadPhotoLibraryAction>()
      .mockResolvedValueOnce({ ok: false, code: 'GENERIC' })
      .mockResolvedValueOnce({ ok: true, library: LIBRARY });
    render(<Harness load={load} />);

    await user.click(await screen.findByRole('button', { name: t.retry }));

    expect(await screen.findByRole('checkbox', { name: 'Bay at dawn' })).toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});
```

  Trong `tour-photos-form.spec.tsx`, `renderForm` nhận thêm `loadLibrary`:

```tsx
function renderForm(
  detail = detailFixture({ photos: [COVER_PHOTO, SECOND] }),
  actions: {
    save?: SetPhotosAction;
    sign?: SignPhotoUploadsAction;
    loadLibrary?: LoadPhotoLibraryAction;
  } = {},
) {
  const save = actions.save ?? vi.fn<SetPhotosAction>();
  const sign = actions.sign ?? vi.fn<SignPhotoUploadsAction>();
  const loadLibrary = actions.loadLibrary ?? vi.fn<LoadPhotoLibraryAction>();
  const user = userEvent.setup({ applyAccept: false });
  render(<TourPhotosForm detail={detail} save={save} sign={sign} loadLibrary={loadLibrary} />);
  return { user, save: save as Mock, sign: sign as Mock };
}
```

  rồi thêm:

```tsx
  it('Add from library: ảnh nối vào cuối, alt chép từ ảnh gốc, dòng nguồn có ghi công', async () => {
    const loadLibrary = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({
      ok: true,
      library: [
        {
          destination: { id: DEST_A, name: 'Hạ Long' },
          photos: [
            {
              publicId: 'lib/cave',
              url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/cave',
              alt: 'Cave lights',
              width: 2400,
              height: 1600,
              author: 'J. Nguyen',
              license: 'CC BY-SA 4.0',
            },
          ],
        },
      ],
    });
    const { user } = renderForm(undefined, { loadLibrary });

    await user.click(screen.getByRole('button', { name: t.library }));
    await user.click(await screen.findByRole('checkbox', { name: 'Cave lights' }));
    await user.click(screen.getByRole('button', { name: t.dialog.add(1) }));

    expect((altInputs()[2] as HTMLInputElement).value).toBe('Cave lights');
    expect(
      screen.getByText(`${t.fromLibrary} · ${t.credit('J. Nguyen', 'CC BY-SA 4.0')}`),
    ).toBeInTheDocument();
  });
```

  (`DEST_A` import từ `@/test/tour-detail`; `detailFixture` có `DEST_A` làm điểm chính.)
- [ ] **B2.** Chạy hai spec → ĐỎ.
- [ ] **B3. Cài `photo-library-dialog.tsx`:**

```tsx
'use client';

import type { AdminLibraryPhoto, AdminPhotoLibrary } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Checkbox } from '@tourism/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tourism/ui/components/dialog';
import { cn } from '@tourism/ui/lib/utils';
import * as React from 'react';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import { FormField } from '@/components/kit/form-field';
import { FormSelect } from '@/components/kit/form-select';
import { tourPhotoThumb } from '@/lib/tour-editor-view';
import type { LoadPhotoLibraryAction } from '@/lib/tour-photos';

/**
 * Hộp Add from library (spec F18 §2g, ADR-0048 §9): kho ảnh địa danh.
 *
 * - Thư viện tải MỘT lần khi hộp mở lần đầu; form giữ nó (`library`/`onLoaded`)
 *   cho các lần mở sau.
 * - Mặc định bày ảnh các địa danh tour đi qua; ô chọn đổi sang từng địa danh.
 * - Ảnh đã có trong tour hiện "Added" và khoá; không cho tích quá sức chứa.
 */
const t = messages.admin.tours.editor.photos.dialog;
const THIS_TOUR = 'tour';

export function PhotoLibraryDialog({
  open,
  onOpenChange,
  library,
  onLoaded,
  load,
  tourDestinationIds,
  existing,
  capacity,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  library: AdminPhotoLibrary | null;
  onLoaded: (library: AdminPhotoLibrary) => void;
  load: LoadPhotoLibraryAction;
  tourDestinationIds: readonly string[];
  existing: ReadonlySet<string>;
  capacity: number;
  onAdd: (photos: AdminLibraryPhoto[]) => void;
}) {
  const [failed, setFailed] = React.useState(false);
  const [filter, setFilter] = React.useState(THIS_TOUR);
  const [picked, setPicked] = React.useState<ReadonlySet<string>>(new Set());
  /** Cổng một lượt tải — effect và nút Try again không được bắn hai lượt chồng nhau. */
  const loading = React.useRef(false);

  const fetchLibrary = React.useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    setFailed(false);
    try {
      const result = await load();
      if (result.ok) onLoaded(result.library);
      else setFailed(true);
    } finally {
      loading.current = false;
    }
  }, [load, onLoaded]);

  // Tải MỘT lần, lúc hộp mở lần đầu; form giữ kết quả cho các lần mở sau.
  React.useEffect(() => {
    if (open && library === null) void fetchLibrary();
  }, [open, library, fetchLibrary]);

  const hasTourPhotos =
    library?.some((group) => tourDestinationIds.includes(group.destination.id)) ?? false;
  const shownFilter = filter === THIS_TOUR && !hasTourPhotos ? (library?.[0]?.destination.id ?? THIS_TOUR) : filter;
  const photos = dedupe(
    (library ?? [])
      .filter((group) =>
        shownFilter === THIS_TOUR
          ? tourDestinationIds.includes(group.destination.id)
          : group.destination.id === shownFilter,
      )
      .flatMap((group) => group.photos),
  );
  const options = [
    ...(hasTourPhotos ? [{ value: THIS_TOUR, label: t.thisTour }] : []),
    ...(library ?? []).map((group) => ({ value: group.destination.id, label: group.destination.name })),
  ];

  function toggle(publicId: string, checked: boolean) {
    setPicked((current) => {
      const next = new Set(current);
      if (checked) next.add(publicId);
      else next.delete(publicId);
      return next;
    });
  }

  function add() {
    const all = dedupe((library ?? []).flatMap((group) => group.photos));
    onAdd(all.filter((photo) => picked.has(photo.publicId)));
    setPicked(new Set());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_FRAME, 'sm:max-w-3xl')}>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.body}</DialogDescription>
        </DialogHeader>

        {library === null ? (
          failed ? (
            <div className="grid gap-3">
              <p role="alert" className="text-sm text-destructive-emphasis">
                {t.failed}
              </p>
              <Button type="button" variant="outline" className="w-fit" onClick={() => void fetchLibrary()}>
                {t.retry}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t.loading}
            </p>
          )
        ) : (
          <div className="grid gap-4">
            <FormField id="photo-library-destination" label={t.destination}>
              {(describedBy) => (
                <FormSelect
                  id="photo-library-destination"
                  value={shownFilter}
                  options={options}
                  placeholder={t.destination}
                  describedBy={describedBy}
                  onValueChange={setFilter}
                />
              )}
            </FormField>
            {photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.empty}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => {
                  const added = existing.has(photo.publicId);
                  const checked = added || picked.has(photo.publicId);
                  const full = !checked && picked.size >= capacity;
                  const name = photo.alt ?? photo.publicId;
                  return (
                    <li key={photo.publicId} className="grid gap-1.5">
                      <img
                        src={tourPhotoThumb(photo.url)}
                        alt=""
                        className="aspect-[3/2] w-full rounded-md bg-muted object-cover"
                      />
                      <span className="flex items-start gap-2 text-sm">
                        <Checkbox
                          aria-label={name}
                          checked={checked}
                          disabled={added || full}
                          onCheckedChange={(value) => toggle(photo.publicId, value === true)}
                        />
                        <span className="line-clamp-2">{added ? `${name} · ${t.added}` : name}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 items-center">
          <p className="mr-auto text-xs text-muted-foreground">{t.left(Math.max(0, capacity - picked.size))}</p>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={picked.size === 0} onClick={add}>
            {t.add(picked.size)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Một ảnh có thể nằm ở hai địa danh — bày và gửi MỘT lần. */
function dedupe(photos: readonly AdminLibraryPhoto[]): AdminLibraryPhoto[] {
  const seen = new Set<string>();
  return photos.filter((photo) => {
    if (seen.has(photo.publicId)) return false;
    seen.add(photo.publicId);
    return true;
  });
}
```

  Nối vào `tour-photos-form.tsx`: prop `loadLibrary` dùng thật; state
  `libraryOpen`, `library` (`AdminPhotoLibrary | null`); nút cạnh Upload photos:

```tsx
            <Button
              type="button"
              variant="outline"
              focusableWhenDisabled
              disabled={pending || capacity === 0}
              onClick={() => setLibraryOpen(true)}
            >
              <ImagePlusIcon aria-hidden="true" />
              {t.library}
            </Button>
```

  và cuối component (ngoài `EditorFormFrame`, trong `div` gốc):

```tsx
      <PhotoLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        library={library}
        onLoaded={setLibrary}
        load={loadLibrary}
        tourDestinationIds={detail.destinations.map((link) => link.destinationId)}
        existing={new Set(values.photos.map((photo) => photo.publicId))}
        capacity={capacity}
        onAdd={(photos) => {
          form.setValues((current) => ({
            photos: [...current.photos, ...photos.map(libraryPhotoDraft)],
          }));
          setLibraryOpen(false);
        }}
      />
```

- [ ] **B4.** Chạy hai spec → XANH. Đột biến: bỏ điều kiện `full` → ca sức chứa đỏ;
  bỏ `existing.has` → ca "Added" đỏ; bỏ `library === null` trong effect → `load`
  gọi lại sau khi đã có thư viện, ca đầu đỏ. Trả lại.
- [ ] **B5.** Quy trình gate. Commit:
  `feat(admin): hộp Add from library lấy ảnh từ kho địa danh`

## Task 14 — Gate cuối, docs, bàn giao

**Files:**

- Modify: `docs/CHANGELOG.md`
- Modify: `docs/open-items.md`

- [ ] **B1.** `git log --oneline main..HEAD` — mười ba commit của Task 1–13, không
  commit lạ. `git diff --stat main..HEAD` không chạm file nào trong danh sách "Không
  đụng" của Ràng buộc toàn cục.
- [ ] **B2.** Quy trình gate trên đỉnh nhánh; ghi lại số test từng gói (Vitest) và
  số int (ca, file) từ output.
- [ ] **B3. Entry CHANGELOG** — chèn ngay dưới khối `> **File này chỉ giữ đợt đang chạy**…`,
  TRÊN entry mới nhất. Ngày là ngày chạy bước này. Khuôn:

```markdown
## 2026-MM-DD — F18 ảnh tour (nhánh `feat/p4e-3b-tour-photos`)

Tab Photos trong khu làm việc tour: tải ảnh lên thẳng Cloudinary (ký theo lô),
lấy ảnh từ kho ảnh địa danh kèm ghi công, sắp thứ tự, chọn ảnh bìa (ảnh đầu), sửa
alt. Quyết định ở ADR-0048: một danh sách có thứ tự trong `media_assets`, một lệnh
`setPhotos` thay trọn và khoá phiên bản, chỉ ảnh tự tải lên mới vào lại hàng dọn.
Readiness thêm điều kiện ảnh bìa; luật "tour đang bán thì luôn đủ" phía admin suy
từ `projectedReadiness` (đóng G11). Xoá tour dọn luôn dòng ảnh. Không migration,
không sửa web.

(Một đoạn cho mỗi thứ thấy được: tab Photos · tải lên · hộp thư viện · khung
readiness và công tắc · hộp xoá. Một đoạn cho chỗ lệch plan nếu có, kèm lý do.)

**Giới hạn đã biết:** ảnh bìa catalog của 29 tour không nằm trong kho địa danh —
gỡ rồi lưu là không chọn lại được từ hộp thư viện (spec §8).

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **N** (web …, api …, admin …, contract …, core …, ui …,
tokens …, i18n …), int **N ở N file**. Liệt kê số ca mới theo gói và các đột biến
đã thử.
```

  Không để dòng nào bắt đầu bằng `+`; tổng số test gói trọn trong một dòng hoặc nối
  bằng chữ "và". `git diff docs/CHANGELOG.md` phải chỉ có phần thêm.
- [ ] **B4. `docs/open-items.md`:** đóng G11 (ghi "đóng ở F18, `onSaleShortfalls`");
  thêm một dòng: "Sau F18 không chạy lại `media:*` và `apply-alt-text.mjs` trên prod
  — chúng ghi `media_assets` theo fixture, đè alt, thứ tự, ảnh bìa admin đã sửa";
  sửa dòng P4e cho đúng hiện trạng (P4e-3b xong trên nhánh, chờ review).
  `git diff docs/open-items.md` trước khi stage.
- [ ] **B5.** `./scripts/docs-freshness.sh` (Git Bash) — xanh.
- [ ] **B6. Commit:** `docs: entry CHANGELOG cho F18 ảnh tour`
- [ ] **B7.** Tắt API (lệnh PowerShell ở Quy trình gate), xoá `/tmp/f18-api.log`.
- [ ] **B8. Bàn giao** — KHÔNG merge. Báo cho session gốc: danh sách commit · kết
  quả gate (số test từng gói, int) · đột biến đã thử và kết quả (kể cả cái không
  giết được, kèm lý do) · chỗ lệch plan và vì sao · việc cần hạ tầng (dự kiến: không
  có).

## Sau khi bàn giao — việc của session gốc

1. Review nhánh ở mức max effort, vá TRỌN phát hiện trên chính nhánh này (nếp F14–F17).
   Đọc kỹ: `planTourPhotos` (ba nguồn, requeue), transaction của `setPhotos` và
   `delete`, cổng ký tự publicId, luồng tải lên (chữ ký hết hạn, Retry, thu hồi URL
   xem trước), CSP.
2. Hỏi user trước khi merge; rebase lên `main`, `git merge --ff-only`, push bằng
   SHA đích danh; `gh run list --branch main --limit 1` phải xanh.
3. Entry CHANGELOG ngày merge; dòng roadmap P4e trong `CLAUDE.md` (P4e-3b xong) và
   `docs/open-items.md`.
4. Chờ Render và Vercel deploy xong (khe deploy: quyết định 5), rồi thử tay trên
   production TỪNG BƯỚC, chờ user xác nhận (spec §5): tạo tour thử → tải hai ảnh
   (kéo thả và bấm nút) → thêm ba ảnh thư viện → sắp lại, đổi bìa, sửa alt → lưu →
   web hiện đúng bìa và gallery → gỡ một ảnh tải lên và một ảnh thư viện → đối
   chiếu `media_garbage` bằng SQL chỉ đọc → bật bán, thử gỡ hết ảnh bị chặn → xoá
   tour thử. Kiểm DB bằng SQL chỉ đọc; trả DB về trạng thái gốc.

---

## Prompt bàn giao cho session thi công F18

Dán nguyên khối dưới đây vào một session Claude Code MỚI mở tại
`C:\Programming\Devs\Projects\Tourism-Platform-V2`.

```text
Bạn là session THI CÔNG của tourism-v2, làm việc NGAY TRONG checkout gốc
C:\Programming\Devs\Projects\Tourism-Platform-V2 (không tạo worktree). Đọc
theo thứ tự:
  CLAUDE.md                                                (15 luật + gotcha)
  docs/README.md                                           (bản đồ tài liệu)
  docs/adr/0048-tour-photos.md                             (quyết định)
  docs/specs/2026-09-28-p4e-3b-tour-photos-design.md       (spec — HỢP ĐỒNG)
  docs/plans/2026-09-28-p4e-3b-tour-photos.md              (plan — làm theo)

VIỆC: tính năng F18 — tab Photos trong khu làm việc tour: tải ảnh lên Cloudinary,
lấy ảnh từ kho ảnh địa danh, sắp thứ tự, chọn ảnh bìa, sửa alt; readiness thêm
điều kiện ảnh bìa; xoá tour dọn dòng ảnh. Làm Task 1 → 14 đúng thứ tự, mỗi task
một commit. Không làm gì ngoài plan; thấy plan sai hay mâu thuẫn spec thì DỪNG và
hỏi tôi.

TRƯỚC DÒNG CODE ĐẦU TIÊN: đọc mục "Quyết định của plan" (tám chỗ plan chốt khác
spec) và 17 bài học ở đầu plan. Vòng review F17 tìm ra 24 lỗi thật.

MỞ ĐẦU
- `git status` phải sạch và đang ở `main`;
  `git log --oneline -- docs/plans/2026-09-28-p4e-3b-tour-photos.md` phải thấy
  commit "docs: plan thi công F18…". Rồi:
  git checkout -b feat/p4e-3b-tour-photos
- Docker Postgres phải đang chạy (`docker ps`) — integration test cần nó.

LUẬT BẤT DI BẤT DỊCH CỦA SESSION NÀY
- KHÔNG merge, KHÔNG push, KHÔNG rebase, KHÔNG dùng subagent.
- KHÔNG chạm hạ tầng sống (CLAUDE.md §15): không Supabase, không Cloudinary thật,
  không webhook, không env/redeploy Render/Vercel. F18 không có migration; thấy
  mình sắp cần một cái thì DỪNG và hỏi tôi.
- KHÔNG sửa apps/web, apps/mobile, apps/api/prisma/schema.prisma,
  apps/api/prisma/migrations/, apps/api/prisma/seed.ts, apps/api/scripts/media-*.mjs,
  apps/api/scripts/apply-alt-text.mjs, module payments/refunds/bookings,
  catalog.service.ts, media.controller.ts, upload-signing.service.ts.
- TDD (luật 4): test đỏ đúng lý do trước, rồi mới cài. Ca test mới nào cũng phải
  kiểm bằng đột biến — làm thật (sửa code cho sai, thấy đỏ, trả lại), ghi kết quả,
  kể cả đột biến không giết được và vì sao.
- Gate cuối mỗi task theo mục "Quy trình gate" của plan: chạy tách bước, hãm song
  song (máy từng phình RAM khi chạy gate:int trần), cần API sống cho build web; xong
  thì tắt API bằng lệnh PowerShell trong plan (tác vụ nền của gate không báo xong
  chừng nào cổng 3001 còn sống).
- Comment code TIẾNG VIỆT (luật 8); copy người dùng thấy bằng TIẾNG ANH trong
  @tourism/i18n (luật 7). Tokens-only, không hex (luật 6).
- Commit Conventional Commits, message TIẾNG VIỆT CÓ DẤU, KHÔNG AI attribution —
  không dòng Co-Authored-By (luật 12). Stage theo đường dẫn tường minh, không
  `git add -A`. Chạy `pnpm lint:fix` trước khi stage.
- Contract và i18n được đọc từ dist: sửa xong phải build lại trước khi test api/admin
  (lệnh ở Ràng buộc toàn cục của plan).
- Rà docs/skills.md trước khi bắt tay (luật 9).

SÁU CHỖ DỄ SAI (plan có đủ chi tiết)
1. Thêm điều kiện ảnh bìa làm đỏ int test cũ tạo tour "đủ để bán" không có ảnh —
   Task 1 sửa `makeTour` và `admin-catalog.int.spec.ts`; `media_assets` không có
   khoá ngoại tới tour nên `beforeEach` phải tự xoá nó.
2. Tiền tố thư mục tải lên có `/` chốt đuôi (`<root>/tours/<tourId>/`); CHỈ ảnh khớp
   tiền tố ấy mới vào lại hàng dọn — ảnh thư viện gỡ ra thì không bao giờ (Task 2, 5, 6).
3. `setPhotos` giữ dòng cũ phải chép ĐỦ metadata và bốn cột ghi công; ghi công ảnh
   thư viện chép ở server, không lấy từ client; `requeue` nằm TRONG transaction (Task 5).
4. Khe deploy: `fetchAdminTour` lùi `photos` về [] và `readiness.cover` về true (Task 2).
5. Tiêu điểm không rơi về <body>: gỡ dòng cuối → nút Upload photos (`emptyFocus`);
   Make cover → ô alt của ảnh bìa mới (Task 8, 12).
6. Thumbnail không `c_fill`; CSP admin phải có `https://api.cloudinary.com` ở
   connect-src (Task 9).

BÀN GIAO KHI XONG
Không merge. Viết cho tôi: danh sách commit; kết quả gate (số test từng gói, số
int); đột biến đã thử và kết quả; chỗ lệch plan và vì sao; việc cần hạ tầng (dự
kiến: không có).
```
