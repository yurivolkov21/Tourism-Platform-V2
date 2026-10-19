# P4f Appearance — Plan thi công ảnh các khe của web (19/10/2026)

Spec: [2026-10-15-p4f-appearance-design.md](../specs/2026-10-15-p4f-appearance-design.md), Yuri
duyệt 19/10. Quyết định kiến trúc: [ADR-0059](../adr/0059-site-slot-appearance.md). Nhánh
`feat/admin-p4f-appearance` tách từ `68f65ef`, mỗi bước một commit, một draft PR. Không migration,
không env mới, không dependency mới; không chạm hạ tầng sống (luật 15).

## Bước

1. **ADR và plan** — ADR-0059, plan này, dòng mục lục ở `docs/adr/README.md` và
   `docs/plans/README.md`; spec đổi trạng thái sang "đã duyệt 19/10".
2. **Danh mục và contract (TDD)** — `site-slots.spec.ts` trước, rồi `site-slots.ts` (47 mục, khung
   §3.2 của spec, sáu khe `inMobileApp`: `auth-panel`, `cta-band`, bốn `moment-*` mà
   `apps/mobile/src/features/auth/auth-media.ts` ghim). Schema `admin-appearance.ts`: khoá khe ảnh
   (video bị chặn), alt tối đa 300, `SiteSlotImageSourceSchema`, hàng của `list`. Ba thủ tục trong
   `contract.ts` và `ADMIN_ACCESS` (`staff`). Web: `siteMediaImage(key: SiteSlotKey)`, khoá ghép
   chuỗi của trang vùng ép kiểu qua một hàm kiểm danh mục, spec web canh khoá của mock.
3. **API (TDD trên phần thuần)** —
   - `upload-signing.ts`: `siteSlotFolder`, `isSiteSlotUploadPublicId`, `site` vào
     `UPLOAD_ZONE_OWNERS` (spec trước).
   - `site-slot-originals.ts` sinh từ một câu SELECT chỉ đọc trên production (Supabase MCP).
   - `appearance-rules.ts`: `planSlotImage`, `slotImageSource`, `versionMatches` (spec trước).
   - `AppearanceService` và `AdminAppearanceController` trong `SiteMediaModule` (cần thêm
     `MediaGarbageModule` qua `MediaModule` và `WebRevalidationModule`); `siteMediaRevalidationTags`
     ở `revalidation-decision.ts`.
   - Sửa comment `schema.prisma` và `SITE_SLOT_KEYS` của seed; spec API canh danh mục nằm trong
     seed. `media-upload.mjs` bỏ qua khe đã có ảnh.
   - Int: `list` đủ 47 khe theo thứ tự, nguồn đúng, khe chưa có dòng; `setSlot` bốn nguồn,
     `STALE_SLOT` (kể cả hai lệnh cùng phiên bản), `PHOTO_NOT_ALLOWED`, hàng dọn, bust sau commit;
     khách 403, Staff được; `signUpload` tạo dòng, thư mục đúng, publicId vào hàng dọn.
4. **Admin** — chữ `admin.appearance` ở `@tourism/i18n`; `lib/api/appearance.ts`,
   `lib/appearance-view.ts` (nhóm, câu chú thích, thu nhỏ khung, cảnh báo cỡ ảnh) và
   `lib/appearance-write.ts` (codec lỗi) kèm spec; trang `/appearance`, thẻ khe,
   hộp Replace (Upload dùng `uploadPhoto`, From library dùng `PhotoLibraryDialog`, hai khung xem
   trước, alt, ghi công chỉ đọc, dòng 7 ngày), Restore original; bật mục sidebar. Spec component cho
   thẻ và hộp.
5. **Đo** — `gate:int` xanh; Chromium trên bản build với API sống: 1440, 768, 390px, sáng và tối,
   không cuộn ngang; hai khung xem trước đúng tỉ lệ; Restore original lấp khe trống của DB dev.
6. **PR nháp** — đẩy nhánh, mở draft PR (không footer), theo dõi CI. Merge chỉ khi Yuri nói trong
   thread; push main xin lượt từ coordinator.

## Quyết định nhỏ đã chốt lúc lập plan

- `list` trả 47 khe kể cả khe video (chỉ xem); khung, nhóm và đường dẫn admin đọc thẳng danh mục,
  không đi qua API.
- `original` trong hàng của `list` mang `publicId`, `url`, `alt`, `width`, `height`: Restore original
  gửi lại alt gốc, và thẻ vẽ ảnh thu nhỏ của nó.
- Câu chú thích của ba khe Team là chức danh trên web (`role` trong `mocks/team.ts`), không chép tên
  người sang admin.
- Restore original đi qua hộp xác nhận (`ConfirmWriteDialog`), không mở hộp Replace.
- Sửa lúc thi công: trang KHÔNG gọi `requirePageAccess`. Hàm ấy là cổng của trang chỉ Owner; ba
  thủ tục Appearance là bậc Staff như `/posts`, mọi tài khoản vào được admin đều gọi được.
- Sửa lúc thi công: hộp Replace mở sẵn ảnh đang dùng, nên lưu ngay là đổi alt (nguồn thứ nhất của
  ADR-0059 §2) — không cần một nút sửa alt riêng.
