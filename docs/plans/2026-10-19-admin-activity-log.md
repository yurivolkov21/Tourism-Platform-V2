# Nhật ký thao tác admin — Plan thi công (19/10/2026)

Spec: [2026-10-19-admin-activity-log-design.md](../specs/2026-10-19-admin-activity-log-design.md).
Quyết định kiến trúc: [ADR-0061](../adr/0061-admin-activity-log.md). Nhánh `feat/admin-audit-log`
tách từ main `3ae6c68`, một PR nháp. Thread giữ lượt migration của project từ 19/10 09:29 UTC.

## Task 1 — Contract

1. `schemas/admin-activity.ts`:
   - `ADMIN_ACTIVITY` (`'log' | 'skip'`) `satisfies Record<AdminProcedureKey, …>`.
   - `ACTIVITY_EXPORT_ACTIONS` (ba khoá xuất), `ACTIVITY_ACTIONS` (37 khoá `log` cộng ba khoá xuất),
     `ACTIVITY_AREAS` (14 khu vực), hàm thuần `activityArea(action)`.
   - Schema `ActivityDetailsSchema` (object phẳng, giá trị chuỗi ngắn, số, boolean, null; tối đa 8
     khoá), `AdminActivityItemSchema`, input và output của `list`, input `recordExport`.
2. `contract.admin.activity.list` (`GET /admin/activity`) và `recordExport`
   (`POST /admin/activity/exports`); `ADMIN_ACCESS`: `owner` và `staff`; `ADMIN_ACTIVITY`: `skip` cả hai.
3. Test trước: phân loại có đúng 37 khoá `log`; mọi khoá `log` là lệnh ghi đã kê ở spec §3;
   `activityArea`; input list (mặc định, khoảng ngược 400, area lạ 400); input recordExport (`month`
   chỉ đi với `reports`).

## Task 2 — API

1. Prisma model `AdminActivity` (bảng `admin_activity`, id `uuid(7)`), quan hệ `actor` tới `User`
   `SetNull`; migration tạo bằng `prisma migrate dev --create-only` trên Postgres docker, thêm comment
   tiếng Việt ở đầu và dòng RLS cuối file. Không comment nào nói trạng thái deploy.
2. `scripts/reset-operational-data.mjs`: thêm `admin_activity` vào `KE_HOACH` trước `users`.
3. `modules/activity/`:
   - `activity-describers.ts`: bảng mô tả `satisfies` đủ khoá `log`; mỗi mục có `before` (chỉ lệnh
     xoá) và `describe` (đọc input, output, và DB khi nhãn không có sẵn). Trả `null` khi output nói
     không đổi gì. Kiểu input và output suy từ contract.
   - `activity-recorder.ts`: ghi một dòng; lỗi thì log một dòng và `captureException`, không ném.
   - `admin-activity.interceptor.ts`: interceptor Nest mang khoá thủ tục, nối middleware oRPC
     (`procedure.use`) chạy `before`, `next()`, `describe`, ghi.
   - `activity.service.ts`: `list` (lọc, đếm, actors, `ref` đọc theo lô từng loại) và
     `recordExport`.
   - `admin-activity.controller.ts`, `activity.module.ts`, khai trong `AppModule`.
4. `@AdminImplement`: thủ tục `log` thì gắn interceptor. Test unit: thứ tự interceptor (nằm trong
   `ImplementInterceptor`), thủ tục `skip` không gắn.
5. Int test (`admin-activity.int.spec.ts`): theo spec §8.

## Task 3 — Admin

1. i18n: `admin.shell.activity`, `admin.activity.*` (tiêu đề, cột, lọc, nhãn khu vực, nhãn thao tác,
   câu tóm tắt, chữ thay thế cho đối tượng không nhãn, trống).
2. `lib/activity-query.ts` (đọc và dựng URL lọc), `lib/activity-view.ts` (câu tóm tắt và link từ
   `type` và `ref`), `lib/api/activity.ts` (gọi `list`, `recordExport`). Test trước cho cả ba.
3. Trang `(admin)/activity/page.tsx` với `requirePageAccess(session, 'activity.list')`; thanh lọc,
   bảng, phân trang theo khuôn `/subscribers`. Mục sidebar nhóm System, `access: 'activity.list'`.
4. Ba route xuất gọi `recordExport` khi trả file thành công.

## Task 4 — Kiểm và giao

`pnpm gate:int`; Chromium trên bản build với API sống ở 1440, 768 và 390 (Owner thấy trang và link
đúng, Staff không thấy mục); PR nháp không footer; hướng dẫn Yuri chạy migration Supabase.
