# Plan thi công P4f — Vùng Users: Owner và Staff

> **Cho agent thi công:** làm tuần tự từng task bằng skill
> `superpowers:executing-plans`. Bước dùng checkbox `- [ ]`. Prompt bàn giao ở
> cuối file KHÔNG cho dùng subagent.

**Mục tiêu:** admin có hai bậc — Owner (role `ADMIN`, chỉ đến từ `ADMIN_EMAILS`) và Staff
(role `STAFF` mới, Owner cấp cho khách đã xác minh). Staff vào được admin trừ 16 thủ tục của
riêng Owner. Owner có vùng `/users`: danh sách, chi tiết, cấp/thu Staff, khoá/mở khoá, đăng
xuất mọi nơi, lịch sử theo từng người. Tài khoản bị khoá không đăng nhập được ở bất kỳ đường
nào; mọi thứ khác của họ chạy tiếp.

**Kiến trúc (ADR-0052):** contract giữ MỘT bảng quyền gõ kiểu chặt (`ADMIN_ACCESS`, 64 khoá)
cùng hai hàm thuần `userStatus` và `userActions`. API áp bảng bằng decorator
`@AdminImplement` (gộp `@Implement` với `@Roles` suy từ bảng); `@Roles(ADMIN)` cấp class giữ
làm lưới. Khoá = hook `session.create.before` của Better Auth cộng một vế ở `AuthGuard`. App
admin đọc cùng bảng để ẩn mục sidebar, ẩn nút và chặn trang chỉ Owner. Một migration chỉ
thêm: giá trị `STAFF`, cột `locked_at`, bảng `user_events`.

**Stack:** NestJS 11 + Prisma 7 + oRPC + Better Auth 1.6.23 (API) · Next.js 16 + React 19 +
Base UI (admin, web) · Tailwind v4 · Vitest + Testing Library.

**Spec:** [2026-10-02-p4f-users-staff-design.md](../specs/2026-10-02-p4f-users-staff-design.md)
— HỢP ĐỒNG của việc này; plan chỉ nói cách làm. Chỗ plan chốt khác chữ cũ của spec nằm ở
"Quyết định của plan"; spec đã sửa cho khớp trong cùng commit với plan này.
**ADR:** [0052 — nhân sự admin hai bậc](../adr/0052-admin-staff-tier.md) · nền:
[0003](../adr/0003-auth-fail-closed.md) · [0026](../adr/0026-p4-admin-app.md) ·
[0017](../adr/0017-web-session-better-auth.md) · [0037](../adr/0037-default-write-throttle.md)

| Tính năng | Nhánh | Task |
| --- | --- | --- |
| **P4f** vùng Users | `feat/p4f-users-staff` | 1–14 |

## Điều kiện bắt đầu

- **P4e-4 đã merge vào `main`.** `git log --oneline main` phải thấy các commit của P4e-4,
  commit plan này và `dca03bce` (ADR-0052 + spec). File
  `apps/admin/src/components/posts/editor/delete-post-zone.tsx` và
  `apps/api/src/modules/posts/admin-posts.controller.ts` phải tồn tại — thiếu thì DỪNG và hỏi.
- `git status` sạch, đang ở `main`. Docker Postgres chạy (`docker ps`; tắt thì mở Docker
  Desktop rồi `docker start tourism-v2-postgres-1`).
- `grep -r "@Implement(contract.admin" apps/api/src | wc -l` phải ra **58** (51 thủ tục cũ
  — gồm hai lệnh xoá danh mục/điểm đến của ADR-0053 — và 7 của bài viết), nằm trong đúng **13** file
  (`grep -rl "@Implement(contract.admin" apps/api/src | wc -l`). Khác số đó nghĩa là main
  đã đổi sau khi viết plan — DỪNG và hỏi.

## Quyết định của plan

Spec để ngỏ hay nói chưa khớp code ở các chỗ dưới đây; plan chốt như sau. Chỗ nào chữ cũ của
spec lệch (1–10, 13, 18, 19), spec đã sửa cho khớp trong cùng commit, ghi "plan, quyết định N"
tại chỗ sửa.

1. **`STAFF` nối ĐUÔI enum** (`CUSTOMER, ADMIN, STAFF`): `ALTER TYPE … ADD VALUE` không chèn
   giữa, và repo vẫn nối đuôi (`REVIEW` của `MediaOwnerType`). Thứ tự chỉ ảnh hưởng sắp xếp,
   mà không màn nào sắp theo role. `UserRoleSchema` của contract theo đúng thứ tự này.
2. **Năm thao tác khoá hàng bằng `SELECT … FOR UPDATE` rồi hỏi `userActions`** — nếp
   `AdminEnquiriesService.setStatus` — thay cho `updateMany` có điều kiện trạng thái. Cùng bảo
   đảm (hai lệnh trên cùng người xếp hàng), một khuôn duy nhất cho cả năm, và luật hợp lệ chỉ
   sống ở `userActions` chứ không chép lại vào từng `where`.
3. **Thiếu `AdminAccessProvider` thì `useCanAccess` trả `true`.** Ở app thật provider luôn có
   (layout `(admin)` bọc mọi trang); vắng chỉ xảy ra trong test. Gác thật ở API; mặc định
   ngược lại (ẩn) sẽ làm mất nút Refund của chính Owner nếu một ngày provider rơi khỏi cây, còn
   mặc định này chỉ để Staff thấy một nút bấm vào ra 403. Nhờ vậy ~30 ca test cũ của bốn
   component không phải bọc lại; ca Staff mới bọc bằng `withRole('STAFF')`.
4. **Form đăng nhập admin không đi qua `mapAuthError`** (nó tự so `error.code`, đo ở
   `components/auth/login-form.tsx`), nên thêm nhánh `ACCOUNT_LOCKED` riêng với câu riêng
   `messages.admin.login.errors.accountLocked` — "Ask the site owner" hợp với Staff hơn
   "Contact us" của web.
5. **`/not-authorized` nói theo role.** Câu hiện tại ("Your account doesn’t have admin
   access") sai với Staff bị chặn ở trang chỉ Owner. Trang đọc phiên: `STAFF` → khối "Owner
   only" kèm link về Dashboard; còn lại giữ nguyên. Quyết định bằng hàm thuần
   `notAuthorizedVariant` ở `lib/admin-gate.ts`.
6. **Nhãn Owner/Staff nằm trong menu tài khoản** (header của dropdown `nav-user`), không chen
   dòng thứ ba vào nút sidebar cao `lg` vốn đã có tên và email.
7. **"View bookings" là `/bookings?q=<email>&dates=all`.** URL trần của `/bookings` tự lọc
   tháng hiện tại (`resolveDates`, chốt 04/09), nên link không có `dates=all` sẽ giấu booking
   cũ. Dựng bằng hàm mới `bookingsSearchHref` trong `lib/bookings-query.ts`.
8. **Hộp khoá dùng nguyên kit `ConfirmWriteDialog` với ô ghi chú bắt buộc** (`noteRequired`;
   kit đã đặt `maxLength={500}` đúng bằng `USER_LOCK_REASON_MAX`). Không bộ đếm ký tự — kit
   không có, và thêm vào kit là đổi một component sáu vùng đang dùng.
9. **Tra phiên của web và admin coi `lockedAt` như `deletedAt`** (phiên coi như không có) —
   cùng lưới với vế `lockedAt` ở `AuthGuard`, cho khe hở giữa lúc hook kiểm và lúc phiên được
   ghi.
10. **Ô Refund của Staff thay nút bằng câu** "Only the owner can issue refunds." — Staff vẫn
    thấy sổ hoàn tiền, và biết phải hỏi ai thay vì tưởng booking không hoàn được.
11. **Lỗi `admin.users.*` đi qua `ContractError` + `toContractError`** (nếp catalog, F15).
    `STATE_CHANGED` và `NOT_FOUND` không lộ câu của service (`exposeMessage = false`): câu có
    id là để đọc log.
12. **Nhãn role ở `lib/role-label.ts` chỉ import `@tourism/i18n`.** `nav-user` là chunk client
    của mọi trang; lấy nhãn từ `lib/users-view.ts` sẽ kéo barrel contract vào chunk ấy — điều
    `lib/nav.ts` đã cố ý tránh.
13. **Trang chỉ Owner lấy phiên TRƯỚC rồi mới fetch**, không gộp `Promise.all` với lượt fetch
    sẽ 403. `lookupServerSession` đã `cache()` và layout vừa gọi nó, nên không tốn thêm lượt
    gọi API nào.
14. **Test quét quyền thay mọi `{param}` bằng MỘT uuid giả**, GET không body, POST body `{}`;
    ba ca: khách → 403 ở mọi thủ tục; Staff → theo bảng; Owner → không 401/403 ở mọi thủ tục.
    Không thủ tục nào chạy thật: input rỗng hay id không tồn tại dừng ở 400/404.
15. **`UserRoleSchema` và `UserEventTypeSchema` của contract soi gương enum Prisma** bằng một
    unit test ở API (nếp `EnquiryStatusSchema`), nên một bên thêm giá trị mà bên kia quên là
    đỏ.
16. **Trang chi tiết tách `UserDetail` (component thường) khỏi `page.tsx`** để có spec và để
    Task 13 soi bố cục được — `page.tsx` không chạy được trong Vitest.
17. **Không đổi seed.** Lượt demo dùng chính màn `/users` để cấp Staff cho một khách seed.
18. **Card Access không có nút tắt.** Khách chưa xác minh hay đang khoá: không nút Grant, câu
    của card nói vì sao (`accessNote`) — `userActions` là nguồn duy nhất của "có nút hay
    không", một nút tắt kèm gợi ý chỉ nói lại đúng câu ấy lần hai. Ngày tham gia lên đầu trang
    cạnh hai chip; Profile còn bốn dòng.
19. **Sau lệnh ghi: kit đóng hộp, toast, `router.refresh()`** — không `revalidatePath` (trang
    chi tiết là server component động, nếp `enquiries/[id]/actions.ts`). Vì kit tự làm tươi ở
    ca trạng-thái-cũ, câu `STATE_CHANGED` nói "the page has been refreshed" thay cho "Refresh
    and try again".

## Ràng buộc toàn cục

Áp cho **mọi** task, không nhắc lại ở từng chỗ:

- **TDD** (luật 4): viết test trước, chạy cho ĐỎ đúng lý do, rồi mới cài. Mỗi ca test
  mới phải **thử đột biến**: sửa code cho sai, thấy ca ấy đỏ, trả lại — ghi kết quả vào
  báo cáo bàn giao. Đột biến KHÔNG khôi phục bằng `git checkout`/`git restore` khi còn
  thay đổi chưa commit — giữ bản gốc trong bộ nhớ hay một bản sao, rồi ghi lại.
- **Comment code tiếng Việt** (luật 8); **copy người dùng thấy bằng tiếng Anh**, nằm
  trong `@tourism/i18n` (luật 7). **Tokens-only**, không hex (luật 6).
- **Commit Conventional, tiếng Việt CÓ DẤU, không AI attribution** — không dòng
  `Co-Authored-By` (luật 12). Stage theo **đường dẫn tường minh**, không `git add -A`.
  Chạy `pnpm lint:fix` trước khi stage.
- **Không đụng**: `apps/mobile`, `apps/api/prisma/seed.ts` và fixture, các migration đã có,
  component của `libs/shared/ui`. Ngoài "Bản đồ file" chỉ được chạm đúng 13 controller admin
  ở Task 3. Thấy mình sắp cần sửa chỗ khác thì DỪNG và hỏi.
- **Migration** (Task 2) chỉ chạy trên Postgres Docker ở máy. Viết xong header và dòng RLS
  RỒI mới apply; đã apply mà cần sửa thì DỪNG và hỏi — không sửa `migration.sql` đã chạy.
- **Không hạ tầng sống** (luật 15): không Supabase, Cloudinary, webhook, env hay redeploy
  Render/Vercel. Migration lên Supabase là việc của session gốc SAU review.
- **Tên cố định** (review sẽ grep đúng chữ): route API như spec §6; route admin `/users` và
  `/users/[id]`; khối i18n `messages.admin.users`; decorator `AdminImplement`; file đúng như
  "Bản đồ file".
- **Contract, core và i18n được đọc từ `dist`**: sửa xong phải build lại trước khi test gói
  khác thấy thay đổi —
  `pnpm turbo run build --filter=@tourism/contract --filter=@tourism/core --filter=@tourism/i18n --output-logs=errors-only`.
- **Next.js 16** (`apps/admin/AGENTS.md`): trước khi thêm route ở Task 10 và Task 11, đọc
  hướng dẫn trong `apps/admin/node_modules/next/dist/docs/` và theo khuôn
  `app/(admin)/enquiries/`.
- **Tài liệu `.md`:** không để dòng bắt đầu bằng `+` ở cột 0; `git diff` file `.md`
  trước khi stage; không sửa entry CHANGELOG cũ.

### Quy trình gate (luật 11) — dùng ở cuối MỖI task

`pnpm gate:int` trần chạy song song 10 luồng và từng làm máy phình RAM, nên chạy tách
bước, hãm song song. Build web prerender gọi API thật, nên phải có API sống. Chạy từ gốc
repo bằng **Git Bash**.

```powershell
# 0. (PowerShell) Liếc commit memory trống — dưới 6 GB thì DỪNG, báo session gốc, đừng tự giết tiến trình nào.
"{0:N1} GB commit trống" -f ((Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory / 1MB)
```

```bash
# 1. API sống cho bước build web
pnpm turbo run build --filter=@tourism/api --output-logs=errors-only
(cd apps/api && node --env-file-if-exists=.env.local dist/main.js > /tmp/p4f-api.log 2>&1 &)
for i in $(seq 1 30); do curl -sf http://localhost:3001/api/health > /dev/null && echo "API sống" && break; sleep 2; done

# 2. build + typecheck
NEXT_PUBLIC_API_URL=http://localhost:3001 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm turbo run build --concurrency=1 --output-logs=errors-only
pnpm turbo run typecheck --concurrency=3 --output-logs=errors-only

# 3. unit test — concurrency 1: đợt F18 một lượt concurrency 2 làm commit trống tụt còn 1,6 GB
pnpm turbo run test --concurrency=1 --output-logs=errors-only -- --maxWorkers=4

# 4. lint + luật tokens của mobile
pnpm lint && node scripts/check-mobile-tokens-only.mjs

# 5. integration test, rồi lưới RLS trên DB test vừa migrate
pnpm test:int --concurrency=2
./scripts/check-rls.sh
```

Tắt API sau khi xong (PowerShell) — chỉ giết đúng tiến trình đang nghe cổng 3001:

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Cả năm bước xanh mới được khai task xong. Trước bước 5, xem `git worktree list` và cổng
3001: một session khác đang chạy `test:int` thì chờ nó xong — int dùng chung DB
`tourism_test`. Máy chậm bất thường thì dừng và báo. Từ Task 2 trở đi, API ở bước 1 chạy
trên DB dev đã có migration mới (Task 2 bước B5 apply nó).

## Bài học mang sang — đọc TRƯỚC dòng code đầu tiên

Vòng review F17 tìm ra 24 lỗi thật; F14, F15, F16, F18, F19 lần lượt 15, 27, 15, 15, 15.
P4f chạm vùng nhạy nhất từ trước tới nay: đăng nhập, phiên và phân quyền của mọi thủ tục admin.

**Test**

1. **Mỗi ca test mới thử đột biến.** F14 có ba ca xanh giả, F15 có năm.
2. **Fixture phải phân biệt được kết quả đúng với kết quả lười.** Ca "search không phân biệt
   hoa thường" phải gõ chữ hoa khác email đã lưu; ca "lý do được trim" phải gửi dấu cách hai
   đầu; ca "phiên bị xoá" phải có phiên SỐNG trước lệnh và kiểm bằng request thật sau lệnh.
3. **Khớp chữ chính xác, không `/…/i`.**
4. **Base UI trong jsdom:** mở Select, Tabs, Dialog, menu xong thì CHỜ bằng `findByRole`,
   không `getByRole` ngay sau cú bấm.
5. **Bố cục không đo được bằng jsdom** — Task 13 soi bằng CSS build thật.

**API**

6. **Quyền chỉ đọc từ bảng.** Không rải `@Roles(ADMIN, STAFF)` tay ở handler nào; handler
   admin nào cũng `@AdminImplement`. Lưới cấp class `@Roles(ADMIN)` không bao giờ gỡ.
7. **Một transaction cho mỗi thao tác**: khoá hàng, kiểm, ghi, xoá phiên, ghi sự kiện. Sự
   kiện ghi được mà thao tác không ghi được (hay ngược lại) là lịch sử nói dối.
8. **Không tự viết đường đăng nhập riêng.** Chặn khoá đi qua hook của Better Auth — đường
   duy nhất mọi cách đăng nhập cùng đi qua (`internalAdapter.createSession`).

**Admin**

9. **Mọi câu copy hứa hệ quả phải đo trên code trước khi viết.** Copy của plan đã đo (ghi
   cạnh từng câu); thêm câu nào mới thì đo trước.
10. **Dùng lại, đừng chép:** `ConfirmWriteDialog`, `createWriteErrorCodec`, `DataTableFrame`,
    `DataTableBody`, `ColumnVisibilityMenu`, `StatusFilterTabs`, `TableSearchForm`,
    `ToolbarClearFilters`, `TablePagination`, `LabelValueRow`, `Timeline`, `formatDateTime`,
    `formatCalendarDate`, `orphanPageHref`, `toContractError`, `escapeLike`, `toPaged`,
    `accountDisplayName`.
11. **Không sửa component nào của `@tourism/ui`.**

**Quy trình**

12. **Comment không khai trạng thái tương lai** ("Task X sẽ…").
13. **Entry CHANGELOG viết theo ngày viết**; session review thêm entry merge.

## Bản đồ file

| File | Trách nhiệm | Task |
| --- | --- | --- |
| `libs/shared/contract/src/admin-access.ts` (mới, + spec) | `AdminProcedureKey`, `ADMIN_ACCESS`, `canAccess`, `isAdminAppRole` | 1 |
| `libs/shared/contract/src/admin-procedures.ts` (mới, + spec) | `listAdminProcedures`, `adminProcedureKey` | 1 |
| `libs/shared/contract/src/schemas/admin-users.ts` (mới, + spec) | Hằng, enum, `userStatus`, `userActions`, schema của `admin.users.*` | 1 |
| `libs/shared/contract/src/contract.ts`, `contract.spec.ts`, `src/index.ts`, `package.json` | Khối `admin.users`; ghim route; export; subpath `./admin-access` | 1 |
| `apps/api/prisma/schema.prisma`, `prisma/migrations/<giờ>_p4f_users_staff/migration.sql` (mới) | `STAFF`, `locked_at`, `user_events` và RLS | 2 |
| `apps/api/src/modules/users/user-enums.spec.ts` (mới) | Gương enum contract ↔ Prisma | 2 |
| `apps/api/scripts/export-snapshot.mjs`, `reset-operational-data.mjs` | Bảng `user_events` | 2 |
| `apps/api/src/auth/admin-implement.decorator.ts` (mới, + spec) | `AdminImplement`, `adminRolesFor` | 3 |
| 13 file `apps/api/src/modules/**/admin-*.controller.ts` | `@Implement` → `@AdminImplement` | 3 |
| `apps/api/src/config/default-throttler.guard.ts`, `default-write-throttle.int.spec.ts` | Tầng ghi admin cho Staff | 3 |
| `apps/api/src/auth/admin-access.int.spec.ts` (mới) | Quét quyền mọi thủ tục admin | 3 |
| `apps/api/src/auth/auth.config.ts`, `auth.guard.ts`, `account-lock.int.spec.ts` (mới) | Chặn tạo phiên; 401 cho phiên sót | 4 |
| `apps/api/src/modules/users/admin-user-errors.ts`, `admin-user-row.ts` (+ spec), `admin-users.service.ts`, `admin-users.controller.ts`, `users.module.ts`, `admin-users.int.spec.ts` (mới) | Sáu route `admin.users.*` | 5 |
| `apps/api/src/app.module.ts` | Khai `UsersModule` | 5 |
| `libs/shared/core/src/lib/auth-errors.ts` (+ spec) | Khoá lỗi `accountLocked` | 6 |
| `libs/shared/i18n/src/lib/messages.ts` | `authForms.errors.accountLocked` (6); `admin.login.errors.accountLocked`, `admin.notAuthorized.ownerOnly` (7); `admin.users` (8, 10–12); `admin.bookings.refund.ownerOnly` (9) | 6–12 |
| `apps/web/src/components/auth/login-form.tsx`, `register-form.tsx`, `lib/api/session.ts` (+ spec mỗi file) | `errorCallbackURL`, `?error=`, `lockedAt` | 6 |
| `apps/admin/src/lib/admin-gate.ts` (+ spec) | Staff vào app; `notAuthorizedVariant` | 7 |
| `apps/admin/src/components/admin-access-provider.tsx` (mới, + spec), `src/test/access.tsx` (mới) | `AdminAccessProvider`, `useCanAccess`, `withRole` | 7 |
| `apps/admin/src/lib/admin-access.ts` (mới, + spec) | `requirePageAccess` | 7 |
| `apps/admin/src/lib/export-route.ts` (+ spec), `lib/export-route-gate.spec.ts` | Khoá quyền của route xuất | 7 |
| `apps/admin/src/app/(admin)/layout.tsx`, `reports/page.tsx`, `reports/export/route.ts`, `payment-events/page.tsx`, `app/not-authorized/page.tsx` | Cổng, provider, trang chỉ Owner | 7 |
| `apps/admin/src/lib/api/session.ts` (+ spec), `components/auth/login-form.tsx` (+ spec) | `lockedAt`; câu báo khoá | 7 |
| `apps/admin/src/lib/role-label.ts` (mới, + spec), `lib/nav.ts` (+ spec), `components/nav-main.tsx` (+ spec), `app-sidebar.tsx` (+ spec), `nav-user.tsx` | Sidebar theo role; nhãn role | 8 |
| `apps/admin/src/components/bookings/refund-panel.tsx`, `departures/departure-row-actions.tsx`, `tours/editor/delete-tour-zone.tsx`, `posts/editor/delete-post-zone.tsx` (+ spec mỗi file) | Ẩn bốn nút với Staff | 9 |
| `apps/admin/src/lib/users-query.ts`, `lib/users-view.ts` (mới, + spec), `lib/api/users.ts` (mới) | URL, VM, bọc API | 10–12 |
| `apps/admin/src/components/users/users-toolbar.tsx`, `users-table.tsx` (+ spec) (mới), `app/(admin)/users/page.tsx` (mới) | Trang `/users` | 10 |
| `apps/admin/src/lib/bookings-query.ts` (+ spec) | `bookingsSearchHref` | 11 |
| `apps/admin/src/components/users/user-detail.tsx` (+ spec), `src/test/user-detail.ts` (mới), `app/(admin)/users/[id]/page.tsx` (mới) | Trang `/users/[id]` | 11, 12 |
| `apps/admin/src/lib/users-write.ts` (+ spec), `components/users/user-role-action.tsx`, `user-lock-action.tsx`, `user-sessions-action.tsx` (+ spec mỗi file), `app/(admin)/users/[id]/actions.ts` (mới) | Bốn thao tác ghi | 12 |
| `docs/CHANGELOG.md`, `docs/open-items.md`, `docs/handoff/mobile-auth-handoff.md` | Entry, dòng P4f, ghi chú mobile | 14 |

Mọi file `.tsx`/`.ts` mới có spec cạnh nó trừ trang (`app/**` — Vitest của admin không quét
`src/app/**`), `users-toolbar.tsx` (phủ qua spec của bảng), `lib/api/users.ts` (bọc mỏng,
phủ qua int test của API) và file chỉ khai kiểu.

## Task 1 — Contract: bảng quyền admin và khối `admin.users`

**Files:**

- Create: `libs/shared/contract/src/schemas/admin-users.ts`, `admin-users.spec.ts`
- Create: `libs/shared/contract/src/admin-access.ts`, `admin-access.spec.ts`
- Create: `libs/shared/contract/src/admin-procedures.ts`, `admin-procedures.spec.ts`
- Modify: `libs/shared/contract/src/contract.ts`, `contract.spec.ts`, `src/index.ts`,
  `package.json`

**Interfaces:**

- Produces (mọi task sau dùng đúng tên này):
  - `USER_LOCK_REASON_MAX = 500`, `USER_SEARCH_MAX = 120`
  - `UserRoleSchema` (`'CUSTOMER' | 'ADMIN' | 'STAFF'`) · `UserRoleValue`
  - `UserStatusSchema` (`'active' | 'locked' | 'unverified'`) · `UserStatusValue`
  - `UserEventTypeSchema` (năm giá trị) · `UserEventTypeValue`
  - `UserAction` = `'grantStaff' | 'revokeStaff' | 'lock' | 'unlock' | 'revokeSessions'`
  - `userStatus({ emailVerified, lockedAt })`, `userActions({ role, emailVerified, lockedAt })`
  - `AdminUsersView` (`'all' | 'staff' | 'locked'`), `AdminUsersListQuerySchema`,
    `AdminUserRowSchema`/`AdminUserRow`, `AdminUsersListResultSchema`,
    `UserEventSchema`/`UserEventItem`, `AdminUserDetailSchema`/`AdminUserDetail`,
    `AdminUserByIdInputSchema`/`AdminUserByIdInput`,
    `AdminUserSetRoleInputSchema`/`AdminUserSetRoleInput`/`AdminUserSetRoleResult`,
    `AdminUserLockInputSchema`/`AdminUserLockInput`/`AdminUserLockResult`,
    `AdminUserUnlockResult`, `AdminUserRevokeSessionsResult`
  - `contract.admin.users.{list, byId, setRole, lock, unlock, revokeSessions}`
  - `AdminProcedureKey`, `AdminAccessLevel`, `ADMIN_ACCESS`, `ADMIN_APP_ROLES`,
    `AdminAppRole`, `isAdminAppRole(role)`, `canAccess(role, key)` — cả ở barrel lẫn
    subpath `@tourism/contract/admin-access`
  - `listAdminProcedures(): readonly AdminProcedureEntry[]`,
    `adminProcedureKey(procedure: unknown): AdminProcedureKey | undefined`

- [ ] **B1. Test luật người dùng (đỏ).** Tạo `libs/shared/contract/src/schemas/admin-users.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AdminUserLockInputSchema,
  AdminUserSetRoleInputSchema,
  AdminUsersListQuerySchema,
  USER_LOCK_REASON_MAX,
  userActions,
  userStatus,
} from './admin-users.js';

const ID = '11111111-1111-4111-8111-111111111111';
const LOCKED_AT = '2026-10-02T03:00:00.000Z';

describe('userStatus', () => {
  it('khoá thắng mọi thứ — kể cả khi chưa xác minh', () => {
    expect(userStatus({ emailVerified: false, lockedAt: LOCKED_AT })).toBe('locked');
    expect(userStatus({ emailVerified: true, lockedAt: new Date(LOCKED_AT) })).toBe('locked');
  });

  it('không khoá: chưa xác minh là unverified, đã xác minh là active', () => {
    expect(userStatus({ emailVerified: false, lockedAt: null })).toBe('unverified');
    expect(userStatus({ emailVerified: true, lockedAt: null })).toBe('active');
  });
});

describe('userActions (spec §4.1)', () => {
  it('Owner không là mục tiêu của thao tác nào — trừ mở khoá khi đang khoá', () => {
    expect(userActions({ role: 'ADMIN', emailVerified: true, lockedAt: null })).toEqual([]);
    expect(userActions({ role: 'ADMIN', emailVerified: true, lockedAt: LOCKED_AT })).toEqual([
      'unlock',
    ]);
  });

  it('Staff: thu Staff, khoá hoặc mở khoá, đăng xuất mọi nơi', () => {
    expect(userActions({ role: 'STAFF', emailVerified: true, lockedAt: null })).toEqual([
      'revokeStaff',
      'lock',
      'revokeSessions',
    ]);
    expect(userActions({ role: 'STAFF', emailVerified: true, lockedAt: LOCKED_AT })).toEqual([
      'revokeStaff',
      'unlock',
      'revokeSessions',
    ]);
  });

  it('khách đã xác minh, không khoá: cấp Staff được', () => {
    expect(userActions({ role: 'CUSTOMER', emailVerified: true, lockedAt: null })).toEqual([
      'grantStaff',
      'lock',
      'revokeSessions',
    ]);
  });

  it('khách chưa xác minh, hoặc đang khoá: KHÔNG cấp Staff được', () => {
    expect(userActions({ role: 'CUSTOMER', emailVerified: false, lockedAt: null })).toEqual([
      'lock',
      'revokeSessions',
    ]);
    expect(userActions({ role: 'CUSTOMER', emailVerified: true, lockedAt: LOCKED_AT })).toEqual([
      'unlock',
      'revokeSessions',
    ]);
  });
});

describe('schema admin.users', () => {
  it('lý do khoá được trim; toàn dấu cách là 400; trần đúng USER_LOCK_REASON_MAX', () => {
    expect(AdminUserLockInputSchema.parse({ id: ID, reason: '  Chargeback abuse  ' }).reason).toBe(
      'Chargeback abuse',
    );
    expect(AdminUserLockInputSchema.safeParse({ id: ID, reason: '   ' }).success).toBe(false);
    const max = 'x'.repeat(USER_LOCK_REASON_MAX);
    expect(AdminUserLockInputSchema.safeParse({ id: ID, reason: max }).success).toBe(true);
    expect(AdminUserLockInputSchema.safeParse({ id: ID, reason: `${max}x` }).success).toBe(false);
  });

  it('setRole chỉ nhận CUSTOMER hoặc STAFF — giao diện không bao giờ đặt được ADMIN', () => {
    expect(AdminUserSetRoleInputSchema.safeParse({ id: ID, role: 'STAFF' }).success).toBe(true);
    expect(AdminUserSetRoleInputSchema.safeParse({ id: ID, role: 'CUSTOMER' }).success).toBe(true);
    expect(AdminUserSetRoleInputSchema.safeParse({ id: ID, role: 'ADMIN' }).success).toBe(false);
  });

  it('list: view mặc định all, search được trim, view lạ là 400', () => {
    expect(AdminUsersListQuerySchema.parse({})).toEqual({ page: 1, limit: 20, view: 'all' });
    expect(AdminUsersListQuerySchema.parse({ search: '  ada  ' }).search).toBe('ada');
    expect(AdminUsersListQuerySchema.safeParse({ view: 'owners' }).success).toBe(false);
  });
});
```

  Chạy `pnpm --filter @tourism/contract exec vitest run src/schemas/admin-users.spec.ts` —
  đỏ vì chưa có module.

- [ ] **B2. Cài.** Tạo `libs/shared/contract/src/schemas/admin-users.ts`:

```ts
import { z } from 'zod';
import { PagedSchema } from './catalog.js';
import { AdminPageQuerySchema } from './common.js';

/**
 * Vùng Users của admin (P4f, ADR-0052) — hằng, enum, hai hàm thuần mà API và admin cùng
 * gọi, và schema của sáu thủ tục `admin.users.*`.
 */

/** Trần lý do khoá — cột `user_events.note VarChar(500)`. */
export const USER_LOCK_REASON_MAX = 500;
/** Trần ô tìm tên/email — cùng trần của bookings, enquiries, subscribers. */
export const USER_SEARCH_MAX = 120;

/**
 * Gương enum Prisma `UserRole`, ĐÚNG thứ tự của DB: `STAFF` nối đuôi vì
 * `ALTER TYPE … ADD VALUE` không chèn giữa (plan P4f, quyết định 1). `ADMIN` là Owner —
 * enum giữ tên cũ, giao diện mới gọi là Owner.
 */
export const UserRoleSchema = z.enum(['CUSTOMER', 'ADMIN', 'STAFF']);
export type UserRoleValue = z.output<typeof UserRoleSchema>;

/** Trạng thái HIỂN THỊ — suy bằng `userStatus`, không có cột riêng. */
export const UserStatusSchema = z.enum(['active', 'locked', 'unverified']);
export type UserStatusValue = z.output<typeof UserStatusSchema>;

/** Gương enum Prisma `UserEventType` — năm việc Owner làm được với một tài khoản. */
export const UserEventTypeSchema = z.enum([
  'STAFF_GRANTED',
  'STAFF_REVOKED',
  'LOCKED',
  'UNLOCKED',
  'SESSIONS_REVOKED',
]);
export type UserEventTypeValue = z.output<typeof UserEventTypeSchema>;

export type UserAction = 'grantStaff' | 'revokeStaff' | 'lock' | 'unlock' | 'revokeSessions';

export interface UserStatusInput {
  emailVerified: boolean;
  lockedAt: Date | string | null;
}

/** Khoá thắng mọi thứ; còn lại là chuyện đã xác minh email hay chưa. */
export function userStatus({ emailVerified, lockedAt }: UserStatusInput): UserStatusValue {
  if (lockedAt != null) return 'locked';
  return emailVerified ? 'active' : 'unverified';
}

export interface UserActionTarget extends UserStatusInput {
  role: UserRoleValue;
}

/**
 * Thao tác hợp lệ với MỘT tài khoản lúc này (spec §4.1) — nguồn duy nhất của luật: API hỏi
 * hàm này trong transaction, trang chi tiết hỏi nó để chọn nút. Owner không bao giờ là mục
 * tiêu (SEC-1 giữ nguyên: quyền Owner chỉ đến từ `ADMIN_EMAILS`), trừ mở khoá — ca hiếm khi
 * email của một khách đang bị khoá được thêm vào `ADMIN_EMAILS`.
 */
export function userActions(target: UserActionTarget): UserAction[] {
  const locked = target.lockedAt != null;
  if (target.role === 'ADMIN') return locked ? ['unlock'] : [];
  const actions: UserAction[] = [];
  if (target.role === 'STAFF') actions.push('revokeStaff');
  if (target.role === 'CUSTOMER' && target.emailVerified && !locked) actions.push('grantStaff');
  actions.push(locked ? 'unlock' : 'lock', 'revokeSessions');
  return actions;
}

/** Ba tab của `/users`: mọi tài khoản · chỉ Staff · chỉ tài khoản đang khoá. */
export const AdminUsersViewSchema = z.enum(['all', 'staff', 'locked']);
export type AdminUsersView = z.output<typeof AdminUsersViewSchema>;

export const AdminUsersListQuerySchema = AdminPageQuerySchema.extend({
  view: AdminUsersViewSchema.default('all'),
  /** Khớp tên HOẶC email, không phân biệt hoa thường. */
  search: z.string().trim().min(1).max(USER_SEARCH_MAX).optional(),
});
export type AdminUsersListQuery = z.output<typeof AdminUsersListQuerySchema>;

/** Một hàng của `/users`. Tài khoản đã xoá (tombstone) không bao giờ có mặt. */
export const AdminUserRowSchema = z.object({
  id: z.uuid(),
  name: z.string().max(120).nullable(),
  email: z.string().min(1).max(320),
  image: z.string().max(500).nullable(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  createdAt: z.iso.datetime(),
  /** `max(sessions.updated_at)` — Better Auth gia hạn phiên tối đa một lần mỗi ngày. */
  lastActiveAt: z.iso.datetime().nullable(),
});
export type AdminUserRow = z.output<typeof AdminUserRowSchema>;

export const AdminUsersListResultSchema = PagedSchema(AdminUserRowSchema);

/** Một dòng lịch sử. `actor` null khi tài khoản của người làm đã bị xoá (SetNull). */
export const UserEventSchema = z.object({
  id: z.uuid(),
  type: UserEventTypeSchema,
  /** Chỉ dòng LOCKED mang chữ: lý do khoá. */
  note: z.string().max(USER_LOCK_REASON_MAX).nullable(),
  createdAt: z.iso.datetime(),
  actor: z.object({ name: z.string().min(1).max(320) }).nullable(),
});
export type UserEventItem = z.output<typeof UserEventSchema>;

export const AdminUserDetailSchema = AdminUserRowSchema.extend({
  phone: z.string().max(30).nullable(),
  emailVerified: z.boolean(),
  lockedAt: z.iso.datetime().nullable(),
  /** Ghi chú của dòng LOCKED mới nhất khi ĐANG khoá; không khoá thì null. */
  lockReason: z.string().max(USER_LOCK_REASON_MAX).nullable(),
  signInMethods: z.array(z.enum(['password', 'google'])),
  counts: z.object({
    bookings: z.int().nonnegative(),
    reviews: z.int().nonnegative(),
    enquiries: z.int().nonnegative(),
  }),
  sessions: z.object({
    /** Phiên `expires_at > now`. */
    active: z.int().nonnegative(),
    lastActiveAt: z.iso.datetime().nullable(),
  }),
  /** Mọi dòng `user_events`, MỚI NHẤT trước. */
  history: z.array(UserEventSchema),
});
export type AdminUserDetail = z.output<typeof AdminUserDetailSchema>;

/** Input của `byId`, `unlock`, `revokeSessions` — server action admin re-parse bằng chính schema này. */
export const AdminUserByIdInputSchema = z.object({ id: z.uuid() });
export type AdminUserByIdInput = z.output<typeof AdminUserByIdInputSchema>;

/** Chỉ hai đích: giao diện không bao giờ đặt được ADMIN (SEC-1). */
const SettableRoleSchema = z.enum(['CUSTOMER', 'STAFF']);

export const AdminUserSetRoleInputSchema = z.object({ id: z.uuid(), role: SettableRoleSchema });
export type AdminUserSetRoleInput = z.output<typeof AdminUserSetRoleInputSchema>;
export const AdminUserSetRoleResultSchema = z.object({ id: z.uuid(), role: SettableRoleSchema });
export type AdminUserSetRoleResult = z.output<typeof AdminUserSetRoleResultSchema>;

export const AdminUserLockInputSchema = z.object({
  id: z.uuid(),
  reason: z.string().trim().min(1).max(USER_LOCK_REASON_MAX),
});
export type AdminUserLockInput = z.output<typeof AdminUserLockInputSchema>;
export const AdminUserLockResultSchema = z.object({ id: z.uuid(), lockedAt: z.iso.datetime() });
export type AdminUserLockResult = z.output<typeof AdminUserLockResultSchema>;

export const AdminUserUnlockResultSchema = z.object({ id: z.uuid() });
export type AdminUserUnlockResult = z.output<typeof AdminUserUnlockResultSchema>;

export const AdminUserRevokeSessionsResultSchema = z.object({
  id: z.uuid(),
  /** Số phiên vừa xoá — 0 vẫn là thành công. */
  revoked: z.int().nonnegative(),
});
export type AdminUserRevokeSessionsResult = z.output<typeof AdminUserRevokeSessionsResultSchema>;
```

  Chạy lại lệnh B1 — xanh. Đột biến: bỏ vế `&& !locked` (ca khách đang khoá phải đỏ); đổi
  thứ tự `lock`/`revokeSessions` (ca Staff đỏ); bỏ `.trim()` của `reason` (ca trim đỏ).

- [ ] **B3. Ghim route (đỏ).** Trong `libs/shared/contract/src/contract.spec.ts`, thêm sáu
  dòng vào cuối mảng `routes` của `describe('contract routes')`:

```ts
    [contract.admin.users.list, 'GET /api/admin/users'],
    [contract.admin.users.byId, 'GET /api/admin/users/{id}'],
    [contract.admin.users.setRole, 'POST /api/admin/users/{id}/role'],
    [contract.admin.users.lock, 'POST /api/admin/users/{id}/lock'],
    [contract.admin.users.unlock, 'POST /api/admin/users/{id}/unlock'],
    [contract.admin.users.revokeSessions, 'POST /api/admin/users/{id}/sessions/revoke'],
```

  và một ca trong cùng `describe`:

```ts
  it('bốn lệnh ghi admin.users khai đúng hai lỗi, STATE_CHANGED là 409', () => {
    for (const procedure of [
      contract.admin.users.setRole,
      contract.admin.users.lock,
      contract.admin.users.unlock,
      contract.admin.users.revokeSessions,
    ]) {
      const errorMap = procedure['~orpc'].errorMap as Record<string, { status?: number } | undefined>;
      expect(Object.keys(errorMap).sort()).toEqual(['NOT_FOUND', 'STATE_CHANGED']);
      expect(errorMap.STATE_CHANGED?.status).toBe(409);
      expect(errorMap.NOT_FOUND?.status).toBe(404);
    }
  });
```

  `pnpm --filter @tourism/contract exec vitest run src/contract.spec.ts` — đỏ (typecheck của
  vitest không chặn, nhưng `contract.admin.users` là `undefined` nên ca route ném).

- [ ] **B4. Khối `admin.users`.** Trong `libs/shared/contract/src/contract.ts`:
  - thêm import (Biome tự xếp chỗ khi `lint:fix`):

```ts
import {
  AdminUserByIdInputSchema,
  AdminUserDetailSchema,
  AdminUserLockInputSchema,
  AdminUserLockResultSchema,
  AdminUserRevokeSessionsResultSchema,
  AdminUserSetRoleInputSchema,
  AdminUserSetRoleResultSchema,
  AdminUsersListQuerySchema,
  AdminUsersListResultSchema,
  AdminUserUnlockResultSchema,
} from './schemas/admin-users.js';
```

  - ngay trên dòng `export const contract = {`:

```ts
/**
 * Hai lỗi chung của bốn lệnh ghi `admin.users.*` (ADR-0052). `STATE_CHANGED` là 409:
 * input đúng, nhưng trạng thái tài khoản không còn cho phép thao tác (tab cũ, người khác
 * vừa làm, hoặc mục tiêu là Owner).
 */
const ADMIN_USER_WRITE_ERRORS = {
  NOT_FOUND: { status: 404, message: 'User not found' },
  STATE_CHANGED: { status: 409, message: 'This account changed — refresh and try again' },
} as const;
```

  - trong khối `admin`, ngay SAU khối `posts`:

```ts
    /**
     * Vùng Users (P4f, ADR-0052) — CHỈ Owner (bảng `ADMIN_ACCESS`). Bốn lệnh ghi khoá hàng
     * user bằng `SELECT … FOR UPDATE` rồi hỏi `userActions`; thao tác không còn hợp lệ →
     * `STATE_CHANGED`. Mỗi lệnh ghi đúng một dòng `user_events` trong cùng transaction.
     */
    users: {
      list: oc
        .route({
          method: 'GET',
          path: '/api/admin/users',
          summary: 'List accounts (admin, paged, all/staff/locked views, name or email search)',
        })
        .input(AdminUsersListQuerySchema)
        .output(AdminUsersListResultSchema),
      byId: oc
        .route({
          method: 'GET',
          path: '/api/admin/users/{id}',
          summary: 'One account with activity counts, sessions and its history',
        })
        .input(AdminUserByIdInputSchema)
        .errors({ NOT_FOUND: ADMIN_USER_WRITE_ERRORS.NOT_FOUND })
        .output(AdminUserDetailSchema),
      setRole: oc
        .route({
          method: 'POST',
          path: '/api/admin/users/{id}/role',
          summary: 'Grant or revoke staff access (revoking signs the account out everywhere)',
        })
        .input(AdminUserSetRoleInputSchema)
        .errors(ADMIN_USER_WRITE_ERRORS)
        .output(AdminUserSetRoleResultSchema),
      lock: oc
        .route({
          method: 'POST',
          path: '/api/admin/users/{id}/lock',
          summary: 'Lock an account: sign it out everywhere and block every new sign-in',
        })
        .input(AdminUserLockInputSchema)
        .errors(ADMIN_USER_WRITE_ERRORS)
        .output(AdminUserLockResultSchema),
      unlock: oc
        .route({
          method: 'POST',
          path: '/api/admin/users/{id}/unlock',
          summary: 'Unlock an account so it can sign in again',
        })
        .input(AdminUserByIdInputSchema)
        .errors(ADMIN_USER_WRITE_ERRORS)
        .output(AdminUserUnlockResultSchema),
      revokeSessions: oc
        .route({
          method: 'POST',
          path: '/api/admin/users/{id}/sessions/revoke',
          summary: 'Sign an account out on every device',
        })
        .input(AdminUserByIdInputSchema)
        .errors(ADMIN_USER_WRITE_ERRORS)
        .output(AdminUserRevokeSessionsResultSchema),
    },
```

  Chạy lại lệnh B3 — xanh.

- [ ] **B5. Test bảng quyền (đỏ).** Tạo `libs/shared/contract/src/admin-access.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ADMIN_ACCESS,
  ADMIN_APP_ROLES,
  type AdminProcedureKey,
  canAccess,
  isAdminAppRole,
} from './admin-access.js';

/**
 * Danh sách user duyệt 02/10 (ADR-0052 §2). Sửa một dòng của bảng mà không sửa danh sách
 * này là test đỏ — CỐ Ý: đổi quyền phải là một quyết định, không phải một lần gõ nhầm.
 */
const OWNER_ONLY: AdminProcedureKey[] = [
  'bookings.refund',
  'categories.delete',
  'departures.cancel',
  'destinations.delete',
  'paymentEvents.byId',
  'paymentEvents.list',
  'posts.delete',
  'reports.monthly',
  'stats.paymentEvents',
  'tours.delete',
  'users.byId',
  'users.list',
  'users.lock',
  'users.revokeSessions',
  'users.setRole',
  'users.unlock',
];

describe('ADMIN_ACCESS', () => {
  it('đúng 16 thủ tục là của riêng Owner', () => {
    const owner = Object.entries(ADMIN_ACCESS)
      .filter(([, level]) => level === 'owner')
      .map(([key]) => key)
      .sort();
    expect(owner).toEqual([...OWNER_ONLY].sort());
  });
});

describe('canAccess', () => {
  it('Owner (ADMIN) vào mọi thủ tục', () => {
    for (const key of Object.keys(ADMIN_ACCESS) as AdminProcedureKey[]) {
      expect(canAccess('ADMIN', key), key).toBe(true);
    }
  });

  it('Staff vào thủ tục staff, không vào thủ tục owner', () => {
    expect(canAccess('STAFF', 'bookings.list')).toBe(true);
    expect(canAccess('STAFF', 'stats.dashboard')).toBe(true);
    expect(canAccess('STAFF', 'bookings.refund')).toBe(false);
    expect(canAccess('STAFF', 'users.list')).toBe(false);
  });

  it('khách, rỗng, lạ, sai hoa thường: không vào gì — fail-closed (ADR-0003)', () => {
    for (const role of ['CUSTOMER', '', 'MODERATOR', 'admin', 'staff']) {
      expect(canAccess(role, 'bookings.list'), role).toBe(false);
    }
  });
});

describe('isAdminAppRole', () => {
  it('đúng hai role vào được app admin', () => {
    expect(ADMIN_APP_ROLES).toEqual(['ADMIN', 'STAFF']);
    expect(isAdminAppRole('ADMIN')).toBe(true);
    expect(isAdminAppRole('STAFF')).toBe(true);
    expect(isAdminAppRole('CUSTOMER')).toBe(false);
    expect(isAdminAppRole('')).toBe(false);
  });
});
```

- [ ] **B6. Cài.** Tạo `libs/shared/contract/src/admin-access.ts` — CHỈ `import type` từ
  `contract.ts`, để subpath `./admin-access` không kéo zod hay schema nào vào chunk client:

```ts
import type { AnyContractProcedure } from '@orpc/contract';
import type { contract } from './contract.js';

/**
 * Bảng quyền admin (ADR-0052 §2) — MỘT nguồn cho API (`@AdminImplement`) và app admin
 * (sidebar, nút, trang chỉ Owner).
 *
 * Module này chỉ `import type`: app admin đọc nó qua subpath `@tourism/contract/admin-access`
 * từ chunk client của sidebar, nên nó không được kéo barrel contract (zod, mọi schema) theo.
 */

/** Đường của mọi thủ tục dưới một cây router, dạng `'bookings.refund'`. */
type ProcedurePaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends AnyContractProcedure
    ? `${Prefix}${K}`
    : ProcedurePaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Khoá của MỘT thủ tục `contract.admin.*`. */
export type AdminProcedureKey = ProcedurePaths<(typeof contract)['admin']>;

/** `owner` = chỉ Owner (role ADMIN); `staff` = Staff và Owner. */
export type AdminAccessLevel = 'owner' | 'staff';

/** Role được vào app admin. `ADMIN` là Owner — enum giữ tên cũ (ADR-0052 §1). */
export const ADMIN_APP_ROLES = ['ADMIN', 'STAFF'] as const;
export type AdminAppRole = (typeof ADMIN_APP_ROLES)[number];

/**
 * Mỗi thủ tục admin một dòng. `satisfies` bắt cả hai chiều: thiếu một thủ tục hay thừa một
 * khoá không tồn tại là typecheck đỏ — thêm thủ tục admin mới là PHẢI quyết quyền của nó.
 * Thứ tự theo `contract.admin`.
 */
export const ADMIN_ACCESS = {
  'bookings.list': 'staff',
  'bookings.byCode': 'staff',
  'bookings.refund': 'owner',
  'reviews.list': 'staff',
  'reviews.moderate': 'staff',
  'stats.bookings': 'staff',
  'stats.reviews': 'staff',
  'stats.outbox': 'staff',
  'stats.paymentEvents': 'owner',
  'stats.enquiries': 'staff',
  'stats.subscribers': 'staff',
  'stats.dashboard': 'staff',
  'outbox.list': 'staff',
  'outbox.retry': 'staff',
  'paymentEvents.list': 'owner',
  'paymentEvents.byId': 'owner',
  'enquiries.list': 'staff',
  'enquiries.byId': 'staff',
  'enquiries.setStatus': 'staff',
  'enquiries.addNote': 'staff',
  'subscribers.list': 'staff',
  'subscribers.unsubscribe': 'staff',
  'reports.monthly': 'owner',
  'tours.list': 'staff',
  'tours.get': 'staff',
  'tours.create': 'staff',
  'tours.updateDetails': 'staff',
  'tours.setItinerary': 'staff',
  'tours.setFaqsPolicies': 'staff',
  'tours.setCosts': 'staff',
  'tours.setPhotos': 'staff',
  'tours.signPhotoUploads': 'staff',
  'tours.photoLibrary': 'staff',
  'tours.delete': 'owner',
  'tours.setPublished': 'staff',
  'categories.list': 'staff',
  'categories.create': 'staff',
  'categories.update': 'staff',
  'categories.setActive': 'staff',
  'categories.move': 'staff',
  'categories.delete': 'owner',
  'destinations.list': 'staff',
  'destinations.create': 'staff',
  'destinations.update': 'staff',
  'destinations.setActive': 'staff',
  'destinations.delete': 'owner',
  'departures.list': 'staff',
  'departures.create': 'staff',
  'departures.update': 'staff',
  'departures.cancel': 'owner',
  'departures.setStatus': 'staff',
  'posts.list': 'staff',
  'posts.get': 'staff',
  'posts.create': 'staff',
  'posts.update': 'staff',
  'posts.delete': 'owner',
  'posts.signCoverUpload': 'staff',
  'posts.tags': 'staff',
  'users.list': 'owner',
  'users.byId': 'owner',
  'users.setRole': 'owner',
  'users.lock': 'owner',
  'users.unlock': 'owner',
  'users.revokeSessions': 'owner',
} as const satisfies Record<AdminProcedureKey, AdminAccessLevel>;

export function isAdminAppRole(role: string): role is AdminAppRole {
  return (ADMIN_APP_ROLES as readonly string[]).includes(role);
}

/**
 * Role này có gọi được thủ tục này không. So BẰNG chuỗi, không hạ hoa thường; role lạ hay
 * rỗng là `false` — cùng tinh thần fail-closed của ADR-0003.
 */
export function canAccess(role: string, key: AdminProcedureKey): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'STAFF') return ADMIN_ACCESS[key] === 'staff';
  return false;
}
```

  Chạy `pnpm --filter @tourism/contract exec vitest run src/admin-access.spec.ts` — xanh;
  `pnpm --filter @tourism/contract typecheck` — xanh. Thử nhanh lưới kiểu: xoá tạm dòng
  `'posts.tags'` → typecheck phải đỏ ("Property 'posts.tags' is missing"); thêm tạm
  `'posts.ghost': 'staff'` → đỏ; trả lại. Đột biến: đổi `'bookings.refund'` thành `'staff'`
  (ca 16 thủ tục đỏ); đổi nhánh STAFF thành `return true` (ca Staff đỏ).

- [ ] **B7. Test bản liệt kê lúc chạy (đỏ).** Tạo `libs/shared/contract/src/admin-procedures.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ADMIN_ACCESS } from './admin-access.js';
import { adminProcedureKey, listAdminProcedures } from './admin-procedures.js';
import { contract } from './contract.js';

describe('listAdminProcedures', () => {
  it('đúng tập khoá của bảng quyền — kiểu và lúc chạy không lệch nhau', () => {
    const keys = listAdminProcedures()
      .map((entry) => entry.key)
      .sort();
    expect(keys).toEqual(Object.keys(ADMIN_ACCESS).sort());
  });

  it('mọi thủ tục admin có method HTTP và path dưới /api/admin/', () => {
    for (const entry of listAdminProcedures()) {
      expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], entry.key).toContain(entry.method);
      expect(entry.path.startsWith('/api/admin/'), entry.key).toBe(true);
    }
  });

  it('mang đúng route và đúng đối tượng của từng thủ tục', () => {
    const refund = listAdminProcedures().find((entry) => entry.key === 'bookings.refund');
    expect(refund).toMatchObject({ method: 'POST', path: '/api/admin/bookings/{code}/refund' });
    expect(refund?.procedure).toBe(contract.admin.bookings.refund);
  });
});

describe('adminProcedureKey', () => {
  it('tra ngược từ chính đối tượng thủ tục', () => {
    expect(adminProcedureKey(contract.admin.users.lock)).toBe('users.lock');
    expect(adminProcedureKey(contract.admin.tours.signPhotoUploads)).toBe('tours.signPhotoUploads');
  });

  it('thủ tục ngoài contract.admin → undefined', () => {
    expect(adminProcedureKey(contract.catalog.tours.list)).toBeUndefined();
    expect(adminProcedureKey({})).toBeUndefined();
  });
});
```

- [ ] **B8. Cài.** Tạo `libs/shared/contract/src/admin-procedures.ts`:

```ts
import { type AnyContractProcedure, isContractProcedure } from '@orpc/contract';
import type { AdminProcedureKey } from './admin-access.js';
import { contract } from './contract.js';

/**
 * Bản liệt kê LÚC CHẠY của mọi thủ tục `contract.admin.*` (ADR-0052 §3) — cho decorator
 * `@AdminImplement` của API (tra khoá từ đối tượng thủ tục) và cho int test quét quyền (đọc
 * method + path). Nằm ở barrel, KHÔNG ở subpath `admin-access`: nó cần giá trị `contract`.
 */
export interface AdminProcedureEntry {
  key: AdminProcedureKey;
  method: string;
  path: string;
  procedure: AnyContractProcedure;
}

function collect(node: Record<string, unknown>, prefix: string, out: AdminProcedureEntry[]): void {
  for (const [name, child] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (isContractProcedure(child)) {
      const route = child['~orpc'].route;
      // oRPC mặc định POST khi route không khai method — cùng luật `fallbackContractConfig`.
      out.push({
        key: key as AdminProcedureKey,
        method: route.method ?? 'POST',
        path: route.path ?? '',
        procedure: child,
      });
    } else if (child !== null && typeof child === 'object') {
      collect(child as Record<string, unknown>, key, out);
    }
  }
}

let cached: readonly AdminProcedureEntry[] | undefined;

export function listAdminProcedures(): readonly AdminProcedureEntry[] {
  if (!cached) {
    const out: AdminProcedureEntry[] = [];
    collect(contract.admin as unknown as Record<string, unknown>, '', out);
    cached = out;
  }
  return cached;
}

/** Khoá của một thủ tục admin, tra bằng ĐỐI TƯỢNG (so `===`); không phải thủ tục admin → undefined. */
export function adminProcedureKey(procedure: unknown): AdminProcedureKey | undefined {
  return listAdminProcedures().find((entry) => entry.procedure === procedure)?.key;
}
```

  Chạy lệnh vitest của B7 — xanh. Đột biến: bỏ nhánh đệ quy `else if` (ca tập khoá đỏ).

- [ ] **B9. Export.** `libs/shared/contract/src/index.ts` — thêm ba dòng (Biome xếp chỗ):

```ts
export * from './admin-access.js';
export * from './admin-procedures.js';
export * from './schemas/admin-users.js';
```

  `libs/shared/contract/package.json`, trong `exports`, sau khối `"."`:

```json
    "./admin-access": {
      "types": "./dist/admin-access.d.ts",
      "import": "./dist/admin-access.js",
      "default": "./dist/admin-access.js"
    }
```

  Build rồi kiểm subpath chạy được và KHÔNG kéo zod:
  `pnpm turbo run build --filter=@tourism/contract --output-logs=errors-only`, rồi
  `grep -c "from 'zod'\|from \"zod\"\|contract.js" libs/shared/contract/dist/admin-access.js`
  phải ra `0`.

- [ ] **B10.** `pnpm lint:fix`; quy trình gate. Commit:
  `feat(contract): bảng quyền admin hai bậc và khối admin.users`

## Task 2 — DB: role `STAFF`, cột `locked_at`, bảng `user_events`

**Files:**

- Create: `apps/api/src/modules/users/user-enums.spec.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<giờ>_p4f_users_staff/migration.sql` (Prisma sinh tên)
- Modify: `apps/api/scripts/export-snapshot.mjs`, `apps/api/scripts/reset-operational-data.mjs`

**Interfaces:**

- Consumes: `UserRoleSchema`, `UserEventTypeSchema` (Task 1).
- Produces: enum Prisma `UserRole.STAFF`, enum `UserEventType`, `User.lockedAt`, model
  `UserEvent` (`prisma.userEvent`) với quan hệ `User.userEvents` (mục tiêu) và
  `User.actedUserEvents` (người làm).

- [ ] **B1. Test gương enum (đỏ).** Tạo `apps/api/src/modules/users/user-enums.spec.ts`:

```ts
import { UserEventTypeSchema, UserRoleSchema } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { UserEventType, UserRole } from '../../generated/prisma/enums.js';

/**
 * Contract và Prisma giữ hai bản của cùng hai enum (plan P4f, quyết định 15). Một bên thêm
 * giá trị mà bên kia quên thì zod từ chối đúng giá trị DB vừa trả — test này đỏ trước.
 */
describe('enum người dùng: contract soi gương Prisma', () => {
  it('UserRoleSchema khớp UserRole, cả thứ tự', () => {
    expect([...UserRoleSchema.options]).toEqual(Object.values(UserRole));
  });

  it('UserEventTypeSchema khớp UserEventType, cả thứ tự', () => {
    expect([...UserEventTypeSchema.options]).toEqual(Object.values(UserEventType));
  });
});
```

  `pnpm --filter @tourism/api exec vitest run src/modules/users/user-enums.spec.ts` — đỏ
  (`UserEventType` chưa tồn tại, `UserRole` thiếu `STAFF`).

- [ ] **B2. Schema.** Trong `apps/api/prisma/schema.prisma`:
  - enum `UserRole` thành:

```prisma
enum UserRole {
  CUSTOMER
  ADMIN
  // P4f (ADR-0052): Staff do Owner cấp. Nối ĐUÔI vì `ALTER TYPE … ADD VALUE` không chèn
  // giữa; Owner vẫn là ADMIN và chỉ đến từ ADMIN_EMAILS (SEC-1).
  STAFF
}
```

  - ngay dưới enum `UserRole`, enum mới:

```prisma
/// Năm việc Owner làm được với một tài khoản (ADR-0052 §5) — một dòng `user_events` mỗi lần.
enum UserEventType {
  STAFF_GRANTED
  STAFF_REVOKED
  LOCKED
  UNLOCKED
  SESSIONS_REVOKED
}
```

  - model `User`: thêm `lockedAt` ngay dưới `deletedAt`, và hai quan hệ cuối danh sách quan
    hệ (sau `enquiries`):

```prisma
  // Khác null = bị khoá: Better Auth không tạo phiên mới, AuthGuard 401 phiên sót
  // (ADR-0052 §4). Lý do khoá nằm ở `user_events.note` của dòng LOCKED.
  lockedAt      DateTime? @map("locked_at")
```

```prisma
  userEvents            UserEvent[]             @relation("UserEventTarget")
  actedUserEvents       UserEvent[]             @relation("UserEventActor")
```

  - model mới, đặt ngay sau model `Session`:

```prisma
/// Lịch sử Owner thao tác lên MỘT tài khoản (ADR-0052 §5) — chỉ ghi thêm, ghi trong cùng
/// transaction với thao tác. Khuôn `enquiry_status_events`.
model UserEvent {
  id        String        @id @default(uuid(7)) @db.Uuid
  userId    String        @map("user_id") @db.Uuid
  actorId   String?       @map("actor_id") @db.Uuid
  type      UserEventType
  // Chỉ dòng LOCKED mang chữ: lý do khoá (contract bắt buộc, trim, tối đa 500).
  note      String?       @db.VarChar(500)
  createdAt DateTime      @default(now()) @map("created_at")

  user  User  @relation("UserEventTarget", fields: [userId], references: [id], onDelete: Cascade)
  actor User? @relation("UserEventActor", fields: [actorId], references: [id], onDelete: SetNull)

  // Dòng thời gian của một tài khoản (trang chi tiết).
  @@index([userId, createdAt])
  @@map("user_events")
}
```

- [ ] **B3. Sinh migration, CHƯA apply** (Git Bash, từ gốc repo):
  `pnpm --filter @tourism/api exec prisma migrate dev --create-only --name p4f_users_staff`.
  `prisma.config.ts` không đọc `.env.local`, nên lệnh này nói chuyện với Postgres Docker
  (`tourism`) — đúng chỗ. Prisma hỏi reset DB thì DỪNG và hỏi.

  Mở file vừa sinh. Phần thân phải tương đương (thứ tự câu có thể khác):

```sql
-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'STAFF';

-- CreateEnum
CREATE TYPE "UserEventType" AS ENUM ('STAFF_GRANTED', 'STAFF_REVOKED', 'LOCKED', 'UNLOCKED', 'SESSIONS_REVOKED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "locked_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" "UserEventType" NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_events_user_id_created_at_idx" ON "user_events"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

  Thấy câu nào khác (đổi cột cũ, drop gì đó) thì DỪNG và hỏi.

- [ ] **B4. Header và RLS — TRƯỚC khi apply.** Chèn lên ĐẦU file:

```sql
-- P4f vùng Users (ADR-0052). Ba thay đổi, cả ba chỉ THÊM — code cũ chạy được trên
-- schema mới, nên migration đi trước code được.
--
-- ① `STAFF` nối đuôi enum `UserRole`. Owner vẫn là `ADMIN` và chỉ đến từ `ADMIN_EMAILS`
--    (SEC-1); Staff do Owner cấp trên giao diện admin.
-- ② `users.locked_at`: khác null là tài khoản bị khoá — Better Auth không tạo phiên mới
--    (hook `session.create.before`), AuthGuard trả 401 cho phiên sót. Lý do khoá KHÔNG nằm
--    ở đây mà ở `user_events.note` của dòng LOCKED: một sự thật, một chỗ.
-- ③ `user_events`: lịch sử Owner thao tác lên một tài khoản, chỉ ghi thêm. `user_id`
--    CASCADE — lịch sử đi theo tài khoản (tài khoản chỉ bị xoá hàng thật ở TRUNCATE của
--    test và script reset; luồng khách tự xoá là tombstone, giữ hàng). `actor_id` SET NULL
--    — dòng lịch sử sống tiếp khi tài khoản người làm biến mất.
```

  và nối vào CUỐI file:

```sql

-- RLS backstop như mọi bảng (default deny, KHÔNG policy — API nối bằng role chủ bảng nên
-- bypass; đây là lưới cho đường anon/direct). `scripts/check-rls.sh` canh trong CI.
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
```

  Comment KHÔNG được nói trạng thái deploy (gotcha CLAUDE.md: checksum khoá vĩnh viễn).

- [ ] **B5. Apply lên DB dev và sinh client:**
  `pnpm --filter @tourism/api exec prisma migrate dev` (áp file vừa sửa, tự `generate`).
  Chạy lại lệnh vitest của B1 — xanh. Đột biến: tạm đổi thứ tự `UserRoleSchema` ở contract
  thành `['CUSTOMER', 'STAFF', 'ADMIN']`, build contract, chạy lại — ca role đỏ; trả lại,
  build lại.

- [ ] **B6. Lưới RLS trên DB dev** (Git Bash):
  `DATABASE_URL=postgresql://tourism:tourism@localhost:5432/tourism ./scripts/check-rls.sh`
  — không in bảng nào. Đo đột biến bằng cách chạy câu
  `docker exec tourism-v2-postgres-1 psql -U tourism -d tourism -c "ALTER TABLE user_events DISABLE ROW LEVEL SECURITY"`,
  chạy lại script (phải in `user_events` và exit 1), rồi
  `docker exec tourism-v2-postgres-1 psql -U tourism -d tourism -c "ALTER TABLE user_events ENABLE ROW LEVEL SECURITY"`.

- [ ] **B7. Hai script vận hành.**
  - `apps/api/scripts/export-snapshot.mjs`, trong `RIENG_TU`, ngay sau dòng `sessions`:

```js
  user_events: 'select * from user_events order by 1',
```

  - `apps/api/scripts/reset-operational-data.mjs`, trong `KE_HOACH`, ngay TRƯỚC dòng
    `['sessions', …]`:

```js
  ['user_events', null, 'CASCADE ← users, xoá tường minh cho rõ ý (P4f)'],
```

  `node --check apps/api/scripts/export-snapshot.mjs && node --check apps/api/scripts/reset-operational-data.mjs`
  — không lỗi. KHÔNG chạy hai script này.

- [ ] **B8.** `pnpm lint:fix`; quy trình gate (bước 5 chạy `globalSetup` migrate
  `tourism_test`, rồi `check-rls.sh` trên chính DB ấy). Commit:
  `feat(api): role STAFF, cột khoá tài khoản và bảng lịch sử user_events`

## Task 3 — API: áp bảng quyền ở mọi controller admin

**Files:**

- Create: `apps/api/src/auth/admin-implement.decorator.ts`, `admin-implement.decorator.spec.ts`
- Modify: 13 file `apps/api/src/modules/**/admin-*.controller.ts` (danh sách ở B4)
- Modify: `apps/api/src/config/default-throttler.guard.ts`
- Modify: `apps/api/src/config/default-write-throttle.int.spec.ts`
- Create: `apps/api/src/auth/admin-access.int.spec.ts`

**Interfaces:**

- Consumes: `ADMIN_ACCESS`, `adminProcedureKey`, `listAdminProcedures`, `isAdminAppRole`
  (Task 1); `UserRole.STAFF` (Task 2).
- Produces: `AdminImplement(procedure)` — decorator thay `@Implement` cho MỌI handler admin,
  kể cả của Task 5; `adminRolesFor(procedure): UserRole[]`.

- [ ] **B1. Test decorator (đỏ).** Tạo `apps/api/src/auth/admin-implement.decorator.spec.ts`:

```ts
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { contract } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { UserRole } from '../generated/prisma/enums.js';
import { AdminImplement, adminRolesFor } from './admin-implement.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';

/**
 * `@AdminImplement` = `@Implement` của oRPC + `@Roles` suy từ bảng quyền (ADR-0052 §3).
 * AuthGuard đọc metadata của handler TRƯỚC của class, nên dòng `@Roles` này là thứ quyết
 * định; `@Roles(ADMIN)` cấp class chỉ còn là lưới cho handler quên đổi decorator.
 */
class Probe {
  @AdminImplement(contract.admin.bookings.refund)
  refund() {
    return undefined;
  }

  @AdminImplement(contract.admin.bookings.list)
  list() {
    return undefined;
  }
}

describe('AdminImplement', () => {
  it('khoá owner → chỉ ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, Probe.prototype.refund)).toEqual([UserRole.ADMIN]);
  });

  it('khoá staff → ADMIN và STAFF', () => {
    expect(Reflect.getMetadata(ROLES_KEY, Probe.prototype.list)).toEqual([
      UserRole.ADMIN,
      UserRole.STAFF,
    ]);
  });

  it('vẫn gắn route của contract — Implement chạy thật, không bị thay', () => {
    expect(Reflect.getMetadata(PATH_METADATA, Probe.prototype.list)).toBe('/api/admin/bookings');
    expect(Reflect.getMetadata(METHOD_METADATA, Probe.prototype.list)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, Probe.prototype.refund)).toBe(
      '/api/admin/bookings/:code/refund',
    );
  });

  it('thủ tục ngoài contract.admin → ném ngay lúc khai, không lặng lẽ thành Owner-only', () => {
    expect(() => adminRolesFor(contract.catalog.tours.list)).toThrow(
      'AdminImplement chỉ nhận thủ tục thuộc contract.admin',
    );
  });
});
```

  `pnpm --filter @tourism/api exec vitest run src/auth/admin-implement.decorator.spec.ts` —
  đỏ vì chưa có module.

- [ ] **B2. Cài.** Tạo `apps/api/src/auth/admin-implement.decorator.ts`:

```ts
import { Implement } from '@orpc/nest';
import { ADMIN_ACCESS, adminProcedureKey } from '@tourism/contract';
import { UserRole } from '../generated/prisma/enums.js';
import { Roles } from './roles.decorator.js';

/**
 * Role được gọi một thủ tục admin, suy từ bảng quyền của contract (ADR-0052 §3):
 * `owner` → chỉ ADMIN (Owner), `staff` → ADMIN và STAFF.
 *
 * Thủ tục không thuộc `contract.admin` là lỗi lập trình: ném lúc NẠP module (decorator chạy
 * khi class được định nghĩa) để API không boot được, thay vì để handler ấy âm thầm rơi về
 * lưới `@Roles(ADMIN)` cấp class.
 */
export function adminRolesFor(procedure: unknown): UserRole[] {
  const key = adminProcedureKey(procedure);
  if (!key) throw new Error('AdminImplement chỉ nhận thủ tục thuộc contract.admin');
  return ADMIN_ACCESS[key] === 'staff' ? [UserRole.ADMIN, UserRole.STAFF] : [UserRole.ADMIN];
}

type ImplementDecorator = ReturnType<typeof Implement>;

/**
 * Thay `@Implement(contract.admin.…)` ở MỌI handler admin: gắn route của contract như cũ,
 * cộng `@Roles(...)` lấy từ bảng quyền. Quyền vì vậy chỉ có một nguồn — không handler nào tự
 * khai `@Roles(ADMIN, STAFF)` bằng tay. Kiểu đã đo bằng tsc trên `@orpc/nest` 1.14.8.
 */
export function AdminImplement(procedure: Parameters<typeof Implement>[0]): ImplementDecorator {
  const roles = adminRolesFor(procedure);
  const implement = Implement(procedure);
  const decorate: ImplementDecorator = (target, propertyKey, descriptor) => {
    implement(target, propertyKey, descriptor);
    Roles(...roles)(target, propertyKey, descriptor);
  };
  return decorate;
}
```

  Chạy lại lệnh B1 — xanh. Đột biến: cho nhánh `staff` trả `[UserRole.ADMIN]` (ca hai đỏ);
  bỏ dòng `implement(...)` (ca route đỏ).

- [ ] **B3. Test quét quyền (đỏ).** Tạo `apps/api/src/auth/admin-access.int.spec.ts`:

```ts
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ADMIN_ACCESS, type AdminProcedureEntry, listAdminProcedures } from '@tourism/contract';
import { AppModule } from '../app.module.js';
import { UserRole } from '../generated/prisma/enums.js';
import { prisma } from './auth.config.js';

/**
 * Integration (Docker PG, db tourism_test) — bảng quyền admin áp ĐÚNG ở API (ADR-0052 §3,
 * plan P4f quyết định 14). Gọi MỌI thủ tục `contract.admin.*` bằng ba phiên: khách, Staff,
 * Owner. Method và path đọc từ contract, nên thủ tục mới thêm tự vào lưới này.
 *
 * Không thủ tục nào chạy thật: mọi `{param}` thay bằng một uuid không tồn tại, GET không
 * body, POST body `{}` — AuthGuard quyết 401/403 TRƯỚC khi oRPC đọc input, nên thứ bị đo là
 * cổng quyền; qua được cổng thì dừng ở 400/404.
 */

const PASSWORD = 'password-123';
const PLACEHOLDER = '00000000-0000-4000-8000-0000000000f4';

function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = (Array.isArray(raw) ? raw : [raw]).filter(
    (c): c is string => typeof c === 'string',
  );
  const session = cookies.find((c) => c.includes('session_token'));
  if (!session) throw new Error(`No session cookie in: ${JSON.stringify(raw)}`);
  const pair = session.split(';')[0];
  if (!pair) throw new Error('Malformed set-cookie');
  return pair;
}

describe('bảng quyền admin áp đúng ở API (ADR-0052)', () => {
  let app: NestFastifyApplication;
  const cookie = { owner: '', staff: '', customer: '' };

  async function signUpAs(email: string, role: UserRole): Promise<string> {
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password: PASSWORD, name: 'Sweep' },
    });
    await prisma.user.update({ where: { email }, data: { emailVerified: true, role } });
    return sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email, password: PASSWORD },
      }),
    );
  }

  const call = (entry: AdminProcedureEntry, sessionCookieValue: string) =>
    app.inject({
      method: entry.method as 'GET' | 'POST',
      url: entry.path.replace(/\{[^}]+\}/g, PLACEHOLDER),
      headers: { cookie: sessionCookieValue },
      ...(entry.method === 'GET' ? {} : { payload: {} }),
    });

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE users, sessions, accounts, verifications CASCADE');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    cookie.owner = await signUpAs('owner-sweep@tourism.test', UserRole.ADMIN);
    cookie.staff = await signUpAs('staff-sweep@tourism.test', UserRole.STAFF);
    cookie.customer = await signUpAs('customer-sweep@tourism.test', UserRole.CUSTOMER);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE users, sessions, accounts, verifications CASCADE');
    await app.close();
  });

  it('bản liệt kê đủ mọi khoá của bảng quyền', () => {
    expect(listAdminProcedures().length).toBe(Object.keys(ADMIN_ACCESS).length);
  });

  it('khách thường: 403 ở MỌI thủ tục admin', async () => {
    for (const entry of listAdminProcedures()) {
      const res = await call(entry, cookie.customer);
      expect(res.statusCode, `${entry.method} ${entry.path} (${entry.key})`).toBe(403);
    }
  });

  it('Staff: thủ tục owner → 403; thủ tục staff → qua cổng quyền', async () => {
    for (const entry of listAdminProcedures()) {
      const res = await call(entry, cookie.staff);
      const label = `${entry.method} ${entry.path} (${entry.key})`;
      if (ADMIN_ACCESS[entry.key] === 'owner') {
        expect(res.statusCode, label).toBe(403);
      } else {
        expect([401, 403], label).not.toContain(res.statusCode);
      }
    }
  });

  it('Owner: qua cổng quyền ở MỌI thủ tục', async () => {
    for (const entry of listAdminProcedures()) {
      const res = await call(entry, cookie.owner);
      expect([401, 403], `${entry.method} ${entry.path} (${entry.key})`).not.toContain(
        res.statusCode,
      );
    }
  });
});
```

  `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/auth/admin-access.int.spec.ts`
  — ca Staff ĐỎ ở thủ tục staff đầu tiên (mọi controller còn `@Roles(ADMIN)` cấp class),
  ba ca kia xanh. Đỏ đúng lý do mới đi tiếp.

- [ ] **B4. Đổi 13 controller** (Git Bash, từ gốc repo). Đúng 13 file, cùng một dòng import
  `import { Implement, implement } from '@orpc/nest';` (đo lúc viết plan) — kiểm trước:

```bash
FILES=$(grep -rl "@Implement(contract.admin" apps/api/src --include=*.controller.ts)
echo "$FILES" | wc -l                                    # phải là 13
grep -L "^import { Implement, implement } from '@orpc/nest';" $FILES   # phải rỗng
sed -i \
  -e "s#^import { Implement, implement } from '@orpc/nest';#import { implement } from '@orpc/nest';\nimport { AdminImplement } from '../../auth/admin-implement.decorator.js';#" \
  -e 's/@Implement(contract\.admin\./@AdminImplement(contract.admin./' \
  $FILES
pnpm lint:fix
grep -rn "@Implement(" $FILES                            # phải rỗng
grep -rc "@AdminImplement(contract.admin" $FILES         # tổng 58
```

  Mười ba file đều nằm ở `apps/api/src/modules/<vùng>/`, nên đường `../../auth/` đúng cho
  cả 13. GIỮ NGUYÊN `@Roles(UserRole.ADMIN)` cấp class ở cả 13 — đó là lưới. Comment nào
  trong 13 file nói "`@Roles(ADMIN)` ở cấp class được AuthGuard đọc… không phải admin → 403"
  thì sửa đúng câu ấy thành: "`@Roles(ADMIN)` cấp class là lưới; quyền thật của từng handler
  do `@AdminImplement` suy từ bảng `ADMIN_ACCESS` (ADR-0052) — khách → 403, Staff → 403 ở
  thủ tục chỉ Owner". Không sửa comment nào khác.

  Chạy lại lệnh int của B3 — cả bốn ca xanh. Đột biến: trả MỘT handler staff (ví dụ
  `reviews.moderate`) về `@Implement` — ca Staff đỏ đúng ở thủ tục ấy; trả lại.

- [ ] **B5. Tầng ghi admin cho Staff (đỏ).** Trong
  `apps/api/src/config/default-write-throttle.int.spec.ts`, thêm ngay sau ca `5.`:

```ts
  it('5b. STAFF dưới /api/admin/* cũng được ADMIN_WRITE_THROTTLE (P4f, ADR-0052 §3)', async () => {
    await signUpAndSignIn('probe-staff@example.com');
    await prisma.user.update({
      where: { email: 'probe-staff@example.com' },
      data: { role: UserRole.STAFF },
    });
    const staffCookie = await signUpAndSignIn('probe-staff@example.com'); // phiên mới mang role mới
    const post = () =>
      app.inject({
        method: 'POST',
        url: '/api/admin/throttle-probe',
        remoteAddress: PUBLIC_IP,
        headers: { cookie: staffCookie },
      });
    for (let i = 0; i < ADMIN_WRITE_THROTTLE.limit; i++) {
      expect((await post()).statusCode).toBe(201);
    }
    expect((await post()).statusCode).toBe(429);
  });
```

  Chạy file int này — ca 5b đỏ ở lượt thứ 21 (429 thay vì 201).

- [ ] **B6. Cài.** `apps/api/src/config/default-throttler.guard.ts`:
  - import `isAdminAppRole` từ `@tourism/contract`; bỏ import `UserRole` (không còn dùng);
  - đổi điều kiện tầng thành:

```ts
      // Owner và Staff (ADR-0052) cùng tầng 60/60s trên bề mặt admin — Staff dọn hàng đợi
      // review/enquiry y như Owner, trần 20/60s của khách sẽ chặn họ giữa chừng.
      const tier =
        isAdminAppRole(user.role) && isAdminSurface(req.url)
          ? ADMIN_WRITE_THROTTLE
          : AUTHED_WRITE_THROTTLE;
```

  Chạy lại file int của B5 — mọi ca xanh. Đột biến: đổi lại `user.role === 'ADMIN'` (5b đỏ).

- [ ] **B7.** Quy trình gate. Commit:
  `feat(api): áp bảng quyền hai bậc cho mọi thủ tục admin`

## Task 4 — API: khoá tài khoản chặn tạo phiên và chặn phiên sót

**Files:**

- Create: `apps/api/src/auth/account-lock.int.spec.ts`
- Modify: `apps/api/src/auth/auth.config.ts`, `apps/api/src/auth/auth.guard.ts`

**Interfaces:**

- Consumes: cột `users.locked_at` (Task 2).
- Produces: mã lỗi Better Auth `ACCOUNT_LOCKED` (HTTP 403) ở mọi đường đăng nhập; field
  `lockedAt` trong `SessionUser` và trong body `GET /api/auth/get-session` (`user.lockedAt`,
  chuỗi ISO hoặc null) — Task 6 và Task 7 đọc nó.

- [ ] **B1. Test (đỏ).** Tạo `apps/api/src/auth/account-lock.int.spec.ts`:

```ts
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { EmailType } from '../generated/prisma/enums.js';
import { prisma } from './auth.config.js';

/**
 * Integration (Docker PG, db tourism_test) — khoá tài khoản (ADR-0052 §4): hook
 * `session.create.before` chặn MỌI đường tạo phiên (đo hai đường gọi được trong test: mật
 * khẩu và OTP email; Google đi qua cùng `internalAdapter.createSession`), và AuthGuard trả
 * 401 cho một phiên sót — phiên được ghi đúng lúc lệnh khoá đang chạy.
 *
 * Fixture khoá bằng cách ghi THẲNG `locked_at`: lệnh khoá thật của Owner (xoá phiên, ghi
 * lịch sử) là việc của `admin-users.int.spec.ts`.
 */

const PASSWORD = 'password-123';
const EMAIL = 'locked-user@tourism.test';

function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = (Array.isArray(raw) ? raw : [raw]).filter(
    (c): c is string => typeof c === 'string',
  );
  const session = cookies.find((c) => c.includes('session_token'));
  if (!session) throw new Error(`No session cookie in: ${JSON.stringify(raw)}`);
  const pair = session.split(';')[0];
  if (!pair) throw new Error('Malformed set-cookie');
  return pair;
}

describe('khoá tài khoản chặn mọi phiên (ADR-0052 §4)', () => {
  let app: NestFastifyApplication;

  const signIn = () =>
    app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: EMAIL, password: PASSWORD },
    });
  const setLocked = (locked: boolean) =>
    prisma.user.update({ where: { email: EMAIL }, data: { lockedAt: locked ? new Date() : null } });
  const sessionCount = () => prisma.session.count({ where: { user: { email: EMAIL } } });
  const mine = (cookie: string) =>
    app.inject({ method: 'GET', url: '/api/bookings', headers: { cookie } });

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, outbox CASCADE',
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: EMAIL, password: PASSWORD, name: 'Locked Person' },
    });
    await prisma.user.update({ where: { email: EMAIL }, data: { emailVerified: true } });
  });

  beforeEach(async () => {
    await prisma.session.deleteMany({ where: { user: { email: EMAIL } } });
    await setLocked(false);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, outbox CASCADE',
    );
    await app.close();
  });

  it('đối chứng: chưa khoá thì đăng nhập mật khẩu được', async () => {
    const res = await signIn();
    expect(res.statusCode).toBe(200);
    expect(await sessionCount()).toBe(1);
  });

  it('khoá → đăng nhập mật khẩu 403 ACCOUNT_LOCKED, không phiên nào được ghi', async () => {
    await setLocked(true);
    const res = await signIn();
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'ACCOUNT_LOCKED' });
    expect(await sessionCount()).toBe(0);
  });

  it('khoá → đăng nhập bằng OTP email cũng 403 ACCOUNT_LOCKED', async () => {
    await setLocked(true);
    const sent = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/send-verification-otp',
      payload: { email: EMAIL, type: 'sign-in' },
    });
    expect(sent.statusCode).toBe(200);
    const row = await prisma.outbox.findFirstOrThrow({
      where: { type: EmailType.EMAIL_OTP },
      orderBy: { createdAt: 'desc' },
    });
    const { otp } = row.payload as { otp: string };

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email-otp',
      payload: { email: EMAIL, otp },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'ACCOUNT_LOCKED' });
    expect(await sessionCount()).toBe(0);
  });

  it('phiên sót của tài khoản bị khoá → 401; get-session vẫn mang lockedAt cho web và admin', async () => {
    const cookie = sessionCookie(await signIn());
    expect((await mine(cookie)).statusCode).toBe(200);

    // KHÔNG xoá phiên: mô phỏng phiên được ghi đúng lúc lệnh khoá đang chạy.
    await setLocked(true);

    expect((await mine(cookie)).statusCode).toBe(401);
    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie },
    });
    expect(session.json()).toMatchObject({ user: { email: EMAIL } });
    expect(session.json().user.lockedAt).not.toBeNull();
  });

  it('mở khoá → đăng nhập lại được ngay', async () => {
    await setLocked(true);
    expect((await signIn()).statusCode).toBe(403);
    await setLocked(false);
    expect((await signIn()).statusCode).toBe(200);
  });
});
```

  `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/auth/account-lock.int.spec.ts`
  — đỏ ở ba ca khoá (200 thay vì 403/401) và ở `lockedAt` của get-session.

- [ ] **B2. Cài hook và field.** Trong `apps/api/src/auth/auth.config.ts`:
  - `user.additionalFields`, ngay dưới `deletedAt`:

```ts
      // ADR-0052 §4: mốc khoá — expose để AuthGuard và hai app đọc từ session, không nhận input.
      lockedAt: { type: 'date', required: false, input: false },
```

  - `databaseHooks`, thêm khối `session` cạnh khối `user`:

```ts
    session: {
      // ADR-0052 §4: tài khoản bị khoá không được có phiên MỚI. Mọi đường đăng nhập (mật
      // khẩu, OTP email, Google, cả phiên xoay vòng khi đổi mật khẩu) đều tạo phiên qua
      // `internalAdapter.createSession`, nên chặn ở đây là chặn hết — đúng cơ chế plugin
      // `admin` của BA 1.6.23 dùng cho user bị ban (đã đọc mã nguồn). Với Google, BA đổi lỗi
      // này thành redirect `errorCallbackURL?error=ACCOUNT_LOCKED`.
      create: {
        before: async (session) => {
          const owner = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { lockedAt: true },
          });
          if (owner?.lockedAt) {
            throw new APIError('FORBIDDEN', {
              code: 'ACCOUNT_LOCKED',
              message: 'This account is locked',
            });
          }
        },
      },
    },
```

- [ ] **B3. Cài vế guard.** Trong `apps/api/src/auth/auth.guard.ts`, điều kiện 401 thành:

```ts
    // 401 khi tombstone HOẶC bị khoá (ADR-0052 §4). Lệnh khoá đã xoá mọi phiên và hook chặn
    // phiên mới; vế `lockedAt` bịt khe hở một phiên được ghi đúng lúc lệnh khoá đang chạy.
    if (!session || session.user.deletedAt != null || session.user.lockedAt != null) {
      throw new UnauthorizedException();
    }
```

  và câu thứ hai của JSDoc lớp thành: "401: không có session, user đã tombstone (deletedAt
  set) HOẶC đang bị khoá (lockedAt set, ADR-0052) — defense in depth, hai luồng ấy vốn đã
  xoá hết session."

- [ ] **B4.** Chạy lại lệnh B1 — năm ca xanh. Đột biến: bỏ khối `session` (ca mật khẩu và
  ca OTP đỏ); bỏ vế `lockedAt` ở guard (ca phiên sót đỏ); bỏ dòng `lockedAt` ở
  `additionalFields` (ca get-session đỏ, và TS báo `lockedAt` không có trên user ở guard).

- [ ] **B5.** Quy trình gate (cả `auth.int.spec.ts`, `require-verification.int.spec.ts`,
  `session-revoke.int.spec.ts` phải xanh nguyên — hook mới chạy trên mọi lần đăng nhập).
  Commit: `feat(api): khoá tài khoản chặn tạo phiên và chặn phiên sót`

## Task 5 — API: sáu route `admin.users.*`

**Files:**

- Create: `apps/api/src/modules/users/admin-user-errors.ts`
- Create: `apps/api/src/modules/users/admin-user-row.ts`, `admin-user-row.spec.ts`
- Create: `apps/api/src/modules/users/admin-users.service.ts`
- Create: `apps/api/src/modules/users/admin-users.controller.ts`
- Create: `apps/api/src/modules/users/users.module.ts`
- Create: `apps/api/src/modules/users/admin-users.int.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: schema và hàm `admin.users.*` (Task 1), `prisma.userEvent`, `User.lockedAt`
  (Task 2), `AdminImplement` (Task 3), hook khoá (Task 4 — ca khoá ở B5 kiểm lại nó).
- Produces: sáu route của spec §6, chạy thật.

- [ ] **B1. Test mapper (đỏ).** Tạo `apps/api/src/modules/users/admin-user-row.spec.ts`:

```ts
import { AdminUserDetailSchema } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { signInMethods, toAdminUserDetail, type UserDetailRow } from './admin-user-row.js';

const CREATED = new Date('2026-09-01T08:00:00.000Z');
const LOCKED = new Date('2026-10-02T03:00:00.000Z');
const LAST = new Date('2026-10-01T09:30:00.000Z');

function row(patch: Partial<UserDetailRow> = {}): UserDetailRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    image: null,
    role: 'CUSTOMER',
    emailVerified: true,
    lockedAt: null,
    createdAt: CREATED,
    phone: null,
    accounts: [{ providerId: 'credential' }],
    _count: { bookings: 2, reviews: 1, enquiries: 0 },
    userEvents: [],
    ...patch,
  };
}

function event(
  id: string,
  type: UserDetailRow['userEvents'][number]['type'],
  note: string | null,
  createdAt: Date,
  actor: { name: string | null; email: string } | null = { name: 'Owner Olive', email: 'o@x.com' },
): UserDetailRow['userEvents'][number] {
  return { id, type, note, createdAt, actor };
}

describe('signInMethods', () => {
  it('credential là mật khẩu; thứ tự cố định mật khẩu trước Google; provider lạ bị bỏ', () => {
    expect(signInMethods(['google', 'credential', 'github', 'google'])).toEqual([
      'password',
      'google',
    ]);
    expect(signInMethods([])).toEqual([]);
  });
});

describe('toAdminUserDetail', () => {
  it('khớp schema contract; mốc giờ là ISO; phiên lấy từ tham số', () => {
    const detail = toAdminUserDetail(row(), { active: 2, lastActiveAt: LAST });
    expect(AdminUserDetailSchema.parse(detail)).toEqual(detail);
    expect(detail).toMatchObject({
      createdAt: '2026-09-01T08:00:00.000Z',
      lastActiveAt: '2026-10-01T09:30:00.000Z',
      sessions: { active: 2, lastActiveAt: '2026-10-01T09:30:00.000Z' },
      counts: { bookings: 2, reviews: 1, enquiries: 0 },
      signInMethods: ['password'],
      status: 'active',
      lockReason: null,
    });
  });

  it('đang khoá: lockReason là ghi chú của dòng LOCKED MỚI NHẤT (lịch sử đã sắp mới trước)', () => {
    const detail = toAdminUserDetail(
      row({
        lockedAt: LOCKED,
        userEvents: [
          event('e3', 'LOCKED', 'Second lock', LOCKED),
          event('e2', 'UNLOCKED', null, new Date('2026-10-01T00:00:00.000Z')),
          event('e1', 'LOCKED', 'First lock', new Date('2026-09-30T00:00:00.000Z')),
        ],
      }),
      { active: 0, lastActiveAt: null },
    );
    expect(detail.status).toBe('locked');
    expect(detail.lockedAt).toBe('2026-10-02T03:00:00.000Z');
    expect(detail.lockReason).toBe('Second lock');
  });

  it('không khoá: lockReason null dù lịch sử còn dòng LOCKED cũ', () => {
    const detail = toAdminUserDetail(
      row({ userEvents: [event('e1', 'LOCKED', 'Old reason', LOCKED)] }),
      { active: 0, lastActiveAt: null },
    );
    expect(detail.lockReason).toBeNull();
  });

  it('tên người làm: tên có chữ thì lấy, rỗng thì email; tài khoản người làm đã mất → null', () => {
    const detail = toAdminUserDetail(
      row({
        userEvents: [
          event('e3', 'STAFF_GRANTED', null, LAST, { name: '  ', email: 'blank@x.com' }),
          event('e2', 'SESSIONS_REVOKED', null, LAST, null),
          event('e1', 'UNLOCKED', null, LAST),
        ],
      }),
      { active: 0, lastActiveAt: null },
    );
    expect(detail.history.map((item) => item.actor)).toEqual([
      { name: 'blank@x.com' },
      null,
      { name: 'Owner Olive' },
    ]);
  });
});
```

  `pnpm --filter @tourism/api exec vitest run src/modules/users/admin-user-row.spec.ts` — đỏ.

- [ ] **B2. Cài mapper.** Tạo `apps/api/src/modules/users/admin-user-row.ts`:

```ts
import { type AdminUserDetail, type AdminUserRow, userStatus } from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';
import { accountDisplayName } from '../enquiries/enquiry-row.js';

/**
 * Select và mapper của vùng Users (P4f). Thuần — service chỉ đọc DB rồi gọi các hàm này,
 * nên mọi luật hiển thị (trạng thái, cách đăng nhập, lý do khoá, tên người làm) có unit test.
 */

export const ROW_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  emailVerified: true,
  lockedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
export type UserListRow = Prisma.UserGetPayload<{ select: typeof ROW_SELECT }>;

export const DETAIL_SELECT = {
  ...ROW_SELECT,
  phone: true,
  accounts: { select: { providerId: true } },
  _count: { select: { bookings: true, reviews: true, enquiries: true } },
  // Lịch sử MỚI NHẤT trước — `lockReason` lấy dòng LOCKED đầu tiên của danh sách này.
  userEvents: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      type: true,
      note: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  },
} satisfies Prisma.UserSelect;
export type UserDetailRow = Prisma.UserGetPayload<{ select: typeof DETAIL_SELECT }>;

export function toAdminUserRow(row: UserListRow, lastActiveAt: Date | null): AdminUserRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    role: row.role,
    status: userStatus({ emailVerified: row.emailVerified, lockedAt: row.lockedAt }),
    createdAt: row.createdAt.toISOString(),
    lastActiveAt: lastActiveAt?.toISOString() ?? null,
  };
}

/** `providerId` của Better Auth → cách đăng nhập in ra màn. Provider khác bị bỏ: không có nhãn. */
const SIGN_IN_METHOD: Record<string, 'password' | 'google'> = {
  credential: 'password',
  google: 'google',
};

export function signInMethods(providerIds: string[]): Array<'password' | 'google'> {
  const found = new Set(
    providerIds.flatMap((providerId) => {
      const method = SIGN_IN_METHOD[providerId];
      return method ? [method] : [];
    }),
  );
  return (['password', 'google'] as const).filter((method) => found.has(method));
}

export function toAdminUserDetail(
  row: UserDetailRow,
  sessions: { active: number; lastActiveAt: Date | null },
): AdminUserDetail {
  const history = row.userEvents.map((event) => ({
    id: event.id,
    type: event.type,
    note: event.note,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor ? { name: accountDisplayName(event.actor) } : null,
  }));
  return {
    ...toAdminUserRow(row, sessions.lastActiveAt),
    phone: row.phone,
    emailVerified: row.emailVerified,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    lockReason: row.lockedAt
      ? (history.find((event) => event.type === 'LOCKED')?.note ?? null)
      : null,
    signInMethods: signInMethods(row.accounts.map((account) => account.providerId)),
    counts: {
      bookings: row._count.bookings,
      reviews: row._count.reviews,
      enquiries: row._count.enquiries,
    },
    sessions: {
      active: sessions.active,
      lastActiveAt: sessions.lastActiveAt?.toISOString() ?? null,
    },
    history,
  };
}
```

  Chạy lại lệnh B1 — xanh. Đột biến: bỏ điều kiện `row.lockedAt ?` của `lockReason` (ca
  "không khoá" đỏ); đổi `find` thành `findLast` (ca "dòng LOCKED mới nhất" đỏ).

- [ ] **B3. Test sáu route (đỏ).** Tạo `apps/api/src/modules/users/admin-users.int.spec.ts`:

```ts
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminUserDetailSchema,
  AdminUserLockResultSchema,
  AdminUserRevokeSessionsResultSchema,
  AdminUserSetRoleResultSchema,
  AdminUsersListResultSchema,
} from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { UserEventType, UserRole } from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test) — vùng Users (P4f, spec §4 và §6). Năm tài khoản
 * sống cùng một tài khoản đã xoá; mỗi ca tự dựng thứ nó cần (phiên, enquiry, account Google)
 * trên nền `beforeEach` trả role và khoá về đầu.
 *
 * "Phiên bị xoá" luôn kiểm bằng request thật sau lệnh (bài học 2): đếm hàng `sessions` thôi
 * thì không chứng minh được cookie đang cầm đã chết.
 */

const PASSWORD = 'password-123';
const OWNER = 'owner-users@tourism.test';
const STAFF = 'staff-users@tourism.test';
const ADA = 'ada-users@tourism.test';
const BOB = 'bob-users@tourism.test'; // CHƯA xác minh email
const CARA = 'cara-users@tourism.test';
const GONE = 'gone-users@tourism.test'; // tombstone
const MISSING_ID = 'f4f00001-0000-4000-8000-999999999999';

const MINUTE = 60_000;
const at = (minutesAgo: number): Date => new Date(Date.now() - minutesAgo * MINUTE);

function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = (Array.isArray(raw) ? raw : [raw]).filter(
    (c): c is string => typeof c === 'string',
  );
  const session = cookies.find((c) => c.includes('session_token'));
  if (!session) throw new Error(`No session cookie in: ${JSON.stringify(raw)}`);
  const pair = session.split(';')[0];
  if (!pair) throw new Error('Malformed set-cookie');
  return pair;
}

describe('admin users integration (P4f)', () => {
  let app: NestFastifyApplication;
  let ownerCookie: string;
  const ids = new Map<string, string>();

  const idOf = (email: string): string => {
    const id = ids.get(email);
    if (!id) throw new Error(`fixture thiếu ${email}`);
    return id;
  };
  const get = (url: string, cookie: string) =>
    app.inject({ method: 'GET', url, headers: { cookie } });
  const post = (url: string, cookie: string, payload: Record<string, unknown> = {}) =>
    app.inject({ method: 'POST', url, headers: { cookie }, payload });
  const signIn = async (email: string): Promise<string> =>
    sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email, password: PASSWORD },
      }),
    );
  /** Một route bất kỳ cần đăng nhập — 200 là phiên còn sống, 401 là đã chết. */
  const alive = async (cookie: string) => (await get('/api/bookings', cookie)).statusCode;
  const eventsOf = (email: string) =>
    prisma.userEvent.findMany({
      where: { userId: idOf(email) },
      orderBy: { createdAt: 'asc' },
    });
  const list = async (query: string) => {
    const res = await get(`/api/admin/users${query}`, ownerCookie);
    expect(res.statusCode).toBe(200);
    return AdminUsersListResultSchema.parse(res.json());
  };
  const detail = async (email: string) => {
    const res = await get(`/api/admin/users/${idOf(email)}`, ownerCookie);
    expect(res.statusCode).toBe(200);
    return AdminUserDetailSchema.parse(res.json());
  };

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE users, sessions, accounts, verifications CASCADE');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // [email, tên, số phút trước] — CARA mới nhất, OWNER cũ nhất.
    const people: Array<[string, string, number]> = [
      [OWNER, 'Owner Olive', 5],
      [STAFF, 'Staff Sam', 4],
      [ADA, 'Ada Lovelace', 3],
      [BOB, 'Bob Builder', 2],
      [CARA, 'Cara Mia', 1],
    ];
    for (const [email, name] of people) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email, password: PASSWORD, name },
      });
    }
    for (const [email, , minutesAgo] of people) {
      const user = await prisma.user.update({
        where: { email },
        data: { emailVerified: email !== BOB, createdAt: at(minutesAgo) },
      });
      ids.set(email, user.id);
    }
    const gone = await prisma.user.create({
      data: { email: GONE, name: 'Gone Away', emailVerified: true, deletedAt: at(30) },
    });
    ids.set(GONE, gone.id);

    await prisma.user.update({ where: { email: OWNER }, data: { role: UserRole.ADMIN } });
    ownerCookie = await signIn(OWNER);
  });

  beforeEach(async () => {
    await prisma.userEvent.deleteMany();
    await prisma.enquiry.deleteMany();
    await prisma.account.deleteMany({ where: { providerId: 'google' } });
    await prisma.session.deleteMany({ where: { userId: { not: idOf(OWNER) } } });
    await prisma.user.update({
      where: { email: OWNER },
      data: { role: UserRole.ADMIN, lockedAt: null },
    });
    await prisma.user.update({
      where: { email: STAFF },
      data: { role: UserRole.STAFF, lockedAt: null },
    });
    for (const email of [ADA, BOB, CARA]) {
      await prisma.user.update({ where: { email }, data: { role: UserRole.CUSTOMER, lockedAt: null } });
    }
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE users, sessions, accounts, verifications CASCADE');
    await app.close();
  });

  describe('list', () => {
    it('mặc định: mọi tài khoản còn sống, mới nhất trước; tài khoản đã xoá không có mặt', async () => {
      await signIn(STAFF);
      await signIn(ADA);
      const page = await list('');
      expect(page.items.map((row) => row.email)).toEqual([CARA, BOB, ADA, STAFF, OWNER]);
      expect(page.total).toBe(5);
      const byEmail = new Map(page.items.map((row) => [row.email, row]));
      expect(byEmail.get(OWNER)).toMatchObject({ role: 'ADMIN', status: 'active' });
      expect(byEmail.get(STAFF)).toMatchObject({ role: 'STAFF', status: 'active' });
      expect(byEmail.get(BOB)).toMatchObject({ status: 'unverified', lastActiveAt: null });
      expect(byEmail.get(ADA)?.lastActiveAt).not.toBeNull();
      expect(byEmail.get(CARA)?.lastActiveAt).toBeNull();
    });

    it('view=staff chỉ Staff; view=locked chỉ tài khoản đang khoá', async () => {
      await prisma.user.update({ where: { email: CARA }, data: { lockedAt: at(1) } });
      expect((await list('?view=staff')).items.map((row) => row.email)).toEqual([STAFF]);
      const locked = await list('?view=locked');
      expect(locked.items.map((row) => row.email)).toEqual([CARA]);
      expect(locked.items[0]?.status).toBe('locked');
    });

    it('search: tên hoặc email, không phân biệt hoa thường; % là chữ, không phải ký tự đại diện', async () => {
      expect((await list('?search=ADA-USERS')).items.map((row) => row.email)).toEqual([ADA]);
      expect((await list('?search=builder')).items.map((row) => row.email)).toEqual([BOB]);
      // Không escape thì '%' khớp cả năm tài khoản.
      expect((await list('?search=%25')).total).toBe(0);
    });

    it('Staff gọi users.list → 403 (vùng chỉ Owner)', async () => {
      const staffCookie = await signIn(STAFF);
      expect((await get('/api/admin/users', staffCookie)).statusCode).toBe(403);
    });
  });

  describe('byId', () => {
    it('cách đăng nhập, đếm hoạt động, phiên sống, lịch sử rỗng', async () => {
      await signIn(ADA);
      await prisma.account.create({
        data: { userId: idOf(ADA), providerId: 'google', accountId: 'google-ada' },
      });
      await prisma.enquiry.create({
        data: {
          name: 'Ada Lovelace',
          email: ADA,
          message: 'A question about a private tour for two people.',
          userId: idOf(ADA),
        },
      });
      const ada = await detail(ADA);
      expect(ada).toMatchObject({
        email: ADA,
        name: 'Ada Lovelace',
        role: 'CUSTOMER',
        status: 'active',
        emailVerified: true,
        lockedAt: null,
        lockReason: null,
        signInMethods: ['password', 'google'],
        counts: { bookings: 0, reviews: 0, enquiries: 1 },
        history: [],
      });
      expect(ada.sessions.active).toBe(1);
      expect(ada.sessions.lastActiveAt).not.toBeNull();
    });

    it('tài khoản đã xoá và id lạ → 404 NOT_FOUND; id rác → 400', async () => {
      for (const id of [idOf(GONE), MISSING_ID]) {
        const res = await get(`/api/admin/users/${id}`, ownerCookie);
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
      }
      expect((await get('/api/admin/users/not-a-uuid', ownerCookie)).statusCode).toBe(400);
    });
  });

  describe('setRole', () => {
    it('cấp Staff cho khách đã xác minh: role đổi, ghi STAFF_GRANTED, phiên của họ GIỮ', async () => {
      const adaCookie = await signIn(ADA);
      const res = await post(`/api/admin/users/${idOf(ADA)}/role`, ownerCookie, { role: 'STAFF' });
      expect(res.statusCode).toBe(200);
      expect(AdminUserSetRoleResultSchema.parse(res.json())).toEqual({
        id: idOf(ADA),
        role: 'STAFF',
      });
      expect((await prisma.user.findUniqueOrThrow({ where: { email: ADA } })).role).toBe(
        UserRole.STAFF,
      );
      const events = await eventsOf(ADA);
      expect(events.map((e) => [e.type, e.actorId, e.note])).toEqual([
        [UserEventType.STAFF_GRANTED, idOf(OWNER), null],
      ]);
      expect(await alive(adaCookie)).toBe(200);
    });

    it('khách chưa xác minh, khách đang khoá → 409 STATE_CHANGED, không ghi gì', async () => {
      await prisma.user.update({ where: { email: CARA }, data: { lockedAt: at(1) } });
      for (const email of [BOB, CARA]) {
        const res = await post(`/api/admin/users/${idOf(email)}/role`, ownerCookie, {
          role: 'STAFF',
        });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toMatchObject({ code: 'STATE_CHANGED' });
        expect((await prisma.user.findUniqueOrThrow({ where: { email } })).role).toBe(
          UserRole.CUSTOMER,
        );
      }
      expect(await prisma.userEvent.count()).toBe(0);
    });

    it('thu Staff: về CUSTOMER, MỌI phiên của họ chết, ghi STAFF_REVOKED', async () => {
      const staffCookie = await signIn(STAFF);
      expect(await alive(staffCookie)).toBe(200);
      const res = await post(`/api/admin/users/${idOf(STAFF)}/role`, ownerCookie, {
        role: 'CUSTOMER',
      });
      expect(res.statusCode).toBe(200);
      expect(await alive(staffCookie)).toBe(401);
      expect((await eventsOf(STAFF)).map((e) => e.type)).toEqual([UserEventType.STAFF_REVOKED]);
    });

    it('Owner — kể cả chính mình — không bao giờ là mục tiêu: 409, role giữ ADMIN', async () => {
      for (const role of ['CUSTOMER', 'STAFF']) {
        const res = await post(`/api/admin/users/${idOf(OWNER)}/role`, ownerCookie, { role });
        expect(res.statusCode).toBe(409);
      }
      expect((await prisma.user.findUniqueOrThrow({ where: { email: OWNER } })).role).toBe(
        UserRole.ADMIN,
      );
      expect(await alive(ownerCookie)).toBe(200);
    });

    it('role ADMIN bị contract từ chối (400) — giao diện không bao giờ đặt được Owner', async () => {
      const res = await post(`/api/admin/users/${idOf(ADA)}/role`, ownerCookie, { role: 'ADMIN' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('lock / unlock', () => {
    it('khoá: đặt locked_at, MỌI phiên chết, lý do được trim, đăng nhập lại bị chặn', async () => {
      const caraCookie = await signIn(CARA);
      const res = await post(`/api/admin/users/${idOf(CARA)}/lock`, ownerCookie, {
        reason: '  Chargeback abuse  ',
      });
      expect(res.statusCode).toBe(200);
      const body = AdminUserLockResultSchema.parse(res.json());
      const db = await prisma.user.findUniqueOrThrow({ where: { email: CARA } });
      expect(db.lockedAt?.toISOString()).toBe(body.lockedAt);
      // Đếm hàng chứ không chỉ gọi thử: vế `lockedAt` của AuthGuard (Task 4) cũng trả 401,
      // nên request một mình không chứng minh được phiên đã bị xoá.
      expect(await prisma.session.count({ where: { userId: idOf(CARA) } })).toBe(0);
      expect(await alive(caraCookie)).toBe(401);
      expect((await eventsOf(CARA)).map((e) => [e.type, e.note])).toEqual([
        [UserEventType.LOCKED, 'Chargeback abuse'],
      ]);
      const again = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: CARA, password: PASSWORD },
      });
      expect(again.json()).toMatchObject({ code: 'ACCOUNT_LOCKED' });
    });

    it('khoá lần hai, khoá Owner → 409; lý do toàn dấu cách → 400', async () => {
      await post(`/api/admin/users/${idOf(CARA)}/lock`, ownerCookie, { reason: 'First' });
      expect(
        (await post(`/api/admin/users/${idOf(CARA)}/lock`, ownerCookie, { reason: 'Again' }))
          .statusCode,
      ).toBe(409);
      expect(
        (await post(`/api/admin/users/${idOf(OWNER)}/lock`, ownerCookie, { reason: 'No' }))
          .statusCode,
      ).toBe(409);
      expect(
        (await post(`/api/admin/users/${idOf(ADA)}/lock`, ownerCookie, { reason: '   ' }))
          .statusCode,
      ).toBe(400);
      expect((await eventsOf(CARA)).map((e) => e.type)).toEqual([UserEventType.LOCKED]);
    });

    it('mở khoá: locked_at về null, ghi UNLOCKED, đăng nhập được; tài khoản không khoá → 409', async () => {
      await post(`/api/admin/users/${idOf(CARA)}/lock`, ownerCookie, { reason: 'Temporary' });
      const res = await post(`/api/admin/users/${idOf(CARA)}/unlock`, ownerCookie);
      expect(res.statusCode).toBe(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { email: CARA } })).lockedAt).toBeNull();
      expect((await eventsOf(CARA)).map((e) => e.type)).toEqual([
        UserEventType.LOCKED,
        UserEventType.UNLOCKED,
      ]);
      expect(await alive(await signIn(CARA))).toBe(200);
      expect((await post(`/api/admin/users/${idOf(ADA)}/unlock`, ownerCookie)).statusCode).toBe(
        409,
      );
    });

    it('chi tiết khi đang khoá mang lockReason; lịch sử mới nhất trước, có tên người làm', async () => {
      await post(`/api/admin/users/${idOf(ADA)}/role`, ownerCookie, { role: 'STAFF' });
      await post(`/api/admin/users/${idOf(ADA)}/lock`, ownerCookie, { reason: 'Left the team' });
      const ada = await detail(ADA);
      expect(ada.status).toBe('locked');
      expect(ada.lockReason).toBe('Left the team');
      expect(ada.history.map((item) => [item.type, item.actor?.name])).toEqual([
        ['LOCKED', 'Owner Olive'],
        ['STAFF_GRANTED', 'Owner Olive'],
      ]);
    });
  });

  describe('revokeSessions', () => {
    it('xoá MỌI phiên, trả số phiên, ghi SESSIONS_REVOKED; tài khoản vẫn đăng nhập lại được', async () => {
      const first = await signIn(ADA);
      const second = await signIn(ADA);
      const res = await post(`/api/admin/users/${idOf(ADA)}/sessions/revoke`, ownerCookie);
      expect(res.statusCode).toBe(200);
      expect(AdminUserRevokeSessionsResultSchema.parse(res.json())).toEqual({
        id: idOf(ADA),
        revoked: 2,
      });
      expect(await alive(first)).toBe(401);
      expect(await alive(second)).toBe(401);
      expect((await eventsOf(ADA)).map((e) => e.type)).toEqual([UserEventType.SESSIONS_REVOKED]);
      expect(await alive(await signIn(ADA))).toBe(200);
    });

    it('không phiên nào vẫn thành công (revoked: 0); Owner → 409', async () => {
      const res = await post(`/api/admin/users/${idOf(BOB)}/sessions/revoke`, ownerCookie);
      expect(AdminUserRevokeSessionsResultSchema.parse(res.json()).revoked).toBe(0);
      expect(
        (await post(`/api/admin/users/${idOf(OWNER)}/sessions/revoke`, ownerCookie)).statusCode,
      ).toBe(409);
      expect(await alive(ownerCookie)).toBe(200);
    });
  });

  it('bốn lệnh ghi với id lạ hoặc tài khoản đã xoá → 404 NOT_FOUND', async () => {
    for (const id of [MISSING_ID, idOf(GONE)]) {
      const calls = [
        post(`/api/admin/users/${id}/role`, ownerCookie, { role: 'STAFF' }),
        post(`/api/admin/users/${id}/lock`, ownerCookie, { reason: 'x' }),
        post(`/api/admin/users/${id}/unlock`, ownerCookie),
        post(`/api/admin/users/${id}/sessions/revoke`, ownerCookie),
      ];
      for (const res of await Promise.all(calls)) {
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
      }
    }
    expect(await prisma.userEvent.count()).toBe(0);
  });
});
```

  `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/users/admin-users.int.spec.ts`
  — đỏ (404 vì route chưa có). Đếm: 18 ca.

- [ ] **B4. Lỗi.** Tạo `apps/api/src/modules/users/admin-user-errors.ts`:

```ts
import type { UserAction } from '@tourism/contract';
import { ContractError } from '../../lib/contract-error.js';

/**
 * Hai lỗi của vùng Users (plan P4f, quyết định 11). Cả hai `exposeMessage = false`: câu mặc
 * định của contract là thứ client cần, còn câu có id ở đây là để đọc log.
 */

/** Không có tài khoản, hoặc đã tombstone — vùng Users coi hai ca là một. */
export class UserNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor(id: string) {
    super('NOT_FOUND', `User not found: ${id}`, false);
  }
}

/** `userActions` không còn cho phép thao tác: tab cũ, người khác vừa làm, hoặc mục tiêu là Owner. */
export class UserStateChangedError extends ContractError<'STATE_CHANGED'> {
  constructor(id: string, action: UserAction) {
    super('STATE_CHANGED', `User ${id} does not allow ${action} right now`, false);
  }
}
```

- [ ] **B5. Service.** Tạo `apps/api/src/modules/users/admin-users.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import {
  type AdminUserByIdInput,
  type AdminUserDetail,
  type AdminUserLockInput,
  type AdminUserLockResult,
  type AdminUserRevokeSessionsResult,
  type AdminUserRow,
  type AdminUserSetRoleInput,
  type AdminUserSetRoleResult,
  type AdminUsersListQuery,
  type AdminUserUnlockResult,
  type Paged,
  type UserAction,
  userActions,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { UserEventType, UserRole } from '../../generated/prisma/enums.js';
import { escapeLike } from '../../lib/like.js';
import { toPaged } from '../../lib/paged.js';
import { UserNotFoundError, UserStateChangedError } from './admin-user-errors.js';
import { DETAIL_SELECT, ROW_SELECT, toAdminUserDetail, toAdminUserRow } from './admin-user-row.js';

/** Hàng `users` đã khoá `FOR UPDATE` — đúng ba cột `userActions` cần. */
interface ClaimedUser {
  role: UserRole;
  email_verified: boolean;
  locked_at: Date | null;
}

/**
 * Vùng Users của admin (P4f, ADR-0052). Đọc: danh sách và chi tiết. Ghi: bốn lệnh, mỗi lệnh
 * MỘT transaction — khoá hàng, hỏi `userActions`, ghi, xoá phiên khi cần, nối đúng một dòng
 * `user_events`. Sự kiện ghi được mà thao tác không (hay ngược lại) là lịch sử nói dối.
 */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  /**
   * Một trang tài khoản còn sống (tombstone không bao giờ có mặt), MỚI NHẤT trước. `search`
   * khớp tên HOẶC email không phân biệt hoa thường, qua `escapeLike` — email có `_` là
   * chuyện thường và `%` gõ vào không được thành ký tự đại diện.
   */
  async list(query: AdminUsersListQuery): Promise<Paged<AdminUserRow>> {
    const { page, limit, view, search } = query;
    const term = search ? escapeLike(search) : undefined;
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(view === 'staff' ? { role: UserRole.STAFF } : {}),
      ...(view === 'locked' ? { lockedAt: { not: null } } : {}),
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: ROW_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const lastActive = await this.lastActiveByUser(rows.map((row) => row.id));
    return toPaged(
      rows.map((row) => toAdminUserRow(row, lastActive.get(row.id) ?? null)),
      { page, limit, total },
    );
  }

  async byId(id: string): Promise<AdminUserDetail> {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: DETAIL_SELECT,
    });
    if (!user) throw new UserNotFoundError(id);
    const [active, last] = await Promise.all([
      prisma.session.count({ where: { userId: id, expiresAt: { gt: new Date() } } }),
      prisma.session.aggregate({ where: { userId: id }, _max: { updatedAt: true } }),
    ]);
    return toAdminUserDetail(user, { active, lastActiveAt: last._max.updatedAt });
  }

  /** CUSTOMER → STAFF (`grantStaff`) hoặc STAFF → CUSTOMER (`revokeStaff`, kèm xoá mọi phiên). */
  async setRole(actor: { id: string }, input: AdminUserSetRoleInput): Promise<AdminUserSetRoleResult> {
    const action: UserAction = input.role === 'STAFF' ? 'grantStaff' : 'revokeStaff';
    await prisma.$transaction(async (tx) => {
      await this.claim(tx, input.id, action);
      await tx.user.update({
        where: { id: input.id },
        data: { role: input.role === 'STAFF' ? UserRole.STAFF : UserRole.CUSTOMER },
      });
      // Bất biến ADR-0026 AMEND 1 §D: hạ quyền LUÔN kèm thu hồi phiên.
      if (action === 'revokeStaff') await tx.session.deleteMany({ where: { userId: input.id } });
      await tx.userEvent.create({
        data: {
          userId: input.id,
          actorId: actor.id,
          type: action === 'grantStaff' ? UserEventType.STAFF_GRANTED : UserEventType.STAFF_REVOKED,
        },
      });
    });
    this.audit(action, actor.id, input.id);
    return { id: input.id, role: input.role };
  }

  /** Khoá: đặt mốc, xoá mọi phiên NGAY trong cùng transaction, ghi lý do vào dòng LOCKED. */
  async lock(actor: { id: string }, input: AdminUserLockInput): Promise<AdminUserLockResult> {
    const lockedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await this.claim(tx, input.id, 'lock');
      await tx.user.update({ where: { id: input.id }, data: { lockedAt } });
      await tx.session.deleteMany({ where: { userId: input.id } });
      await tx.userEvent.create({
        data: { userId: input.id, actorId: actor.id, type: UserEventType.LOCKED, note: input.reason },
      });
    });
    this.audit('lock', actor.id, input.id);
    return { id: input.id, lockedAt: lockedAt.toISOString() };
  }

  async unlock(actor: { id: string }, input: AdminUserByIdInput): Promise<AdminUserUnlockResult> {
    await prisma.$transaction(async (tx) => {
      await this.claim(tx, input.id, 'unlock');
      await tx.user.update({ where: { id: input.id }, data: { lockedAt: null } });
      await tx.userEvent.create({
        data: { userId: input.id, actorId: actor.id, type: UserEventType.UNLOCKED },
      });
    });
    this.audit('unlock', actor.id, input.id);
    return { id: input.id };
  }

  /** Đăng xuất mọi nơi — 0 phiên vẫn là thành công (người bấm muốn "không còn phiên nào"). */
  async revokeSessions(
    actor: { id: string },
    input: AdminUserByIdInput,
  ): Promise<AdminUserRevokeSessionsResult> {
    const revoked = await prisma.$transaction(async (tx) => {
      await this.claim(tx, input.id, 'revokeSessions');
      const { count } = await tx.session.deleteMany({ where: { userId: input.id } });
      await tx.userEvent.create({
        data: { userId: input.id, actorId: actor.id, type: UserEventType.SESSIONS_REVOKED },
      });
      return count;
    });
    this.audit('revokeSessions', actor.id, input.id);
    return { id: input.id, revoked };
  }

  /**
   * `SELECT … FOR UPDATE` rồi hỏi `userActions` (plan P4f, quyết định 2; nếp
   * `AdminEnquiriesService.setStatus`): hai lệnh trên cùng một người xếp hàng, nên lệnh sau
   * thấy trạng thái lệnh trước vừa ghi. Luật hợp lệ chỉ sống ở `userActions` — không chép
   * lại vào `where` của từng câu ghi.
   */
  private async claim(tx: Prisma.TransactionClient, id: string, action: UserAction): Promise<void> {
    const [target] = await tx.$queryRaw<ClaimedUser[]>(Prisma.sql`
      SELECT role, email_verified, locked_at FROM users
      WHERE id = ${id}::uuid AND deleted_at IS NULL
      FOR UPDATE
    `);
    if (!target) throw new UserNotFoundError(id);
    const allowed = userActions({
      role: target.role,
      emailVerified: target.email_verified,
      lockedAt: target.locked_at,
    });
    if (!allowed.includes(action)) throw new UserStateChangedError(id, action);
  }

  /** `max(sessions.updated_at)` theo người — một câu `groupBy` cho cả trang. */
  private async lastActiveByUser(ids: string[]): Promise<Map<string, Date>> {
    if (ids.length === 0) return new Map();
    const groups = await prisma.session.groupBy({
      by: ['userId'],
      where: { userId: { in: ids } },
      _max: { updatedAt: true },
    });
    const result = new Map<string, Date>();
    for (const group of groups) {
      if (group._max.updatedAt) result.set(group.userId, group._max.updatedAt);
    }
    return result;
  }

  /** Dòng log quy hành vi về người — nếp `[admin] enquiry status`. */
  private audit(action: UserAction, adminId: string, userId: string): void {
    this.logger.log(`[admin] user ${action} ${JSON.stringify({ adminId, userId })}`);
  }
}
```

- [ ] **B6. Controller và module.** Tạo `apps/api/src/modules/users/admin-users.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import type { SessionUser } from '../../auth/auth.config.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { toContractError } from '../../lib/contract-error.js';
import { AdminUsersService } from './admin-users.service.js';

/**
 * Vùng Users (P4f, ADR-0052). Sáu thủ tục đều `owner` trong `ADMIN_ACCESS` — `@AdminImplement`
 * suy `@Roles(ADMIN)` từ bảng; `@Roles(ADMIN)` cấp class là lưới như mọi controller admin.
 * Người làm lấy từ PHIÊN (`@CurrentUser`), không bao giờ từ input.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @AdminImplement(contract.admin.users.list)
  list() {
    return implement(contract.admin.users.list).handler(({ input }) => this.users.list(input));
  }

  @AdminImplement(contract.admin.users.byId)
  byId() {
    return implement(contract.admin.users.byId).handler(async ({ input, errors }) => {
      try {
        return await this.users.byId(input.id);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.users.setRole)
  setRole(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.users.setRole).handler(async ({ input, errors }) => {
      try {
        return await this.users.setRole({ id: user.id }, input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.users.lock)
  lock(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.users.lock).handler(async ({ input, errors }) => {
      try {
        return await this.users.lock({ id: user.id }, input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.users.unlock)
  unlock(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.users.unlock).handler(async ({ input, errors }) => {
      try {
        return await this.users.unlock({ id: user.id }, input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.users.revokeSessions)
  revokeSessions(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.users.revokeSessions).handler(async ({ input, errors }) => {
      try {
        return await this.users.revokeSessions({ id: user.id }, input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }
}
```

  Tạo `apps/api/src/modules/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersService } from './admin-users.service.js';

/**
 * Vùng Users của admin (P4f, ADR-0052) — chỉ đường admin. Khách tự quản tài khoản của mình
 * ở `AuthModule` (`account.*`), không qua đây.
 */
@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class UsersModule {}
```

  `apps/api/src/app.module.ts`: import `UsersModule` từ `./modules/users/users.module.js` và
  thêm vào `imports` ngay sau `OutboxModule`.

- [ ] **B7.** Chạy lại lệnh B3 — 18 ca xanh; chạy lại `admin-access.int.spec.ts` (Task 3) —
  sáu khoá `users.*` giờ đi qua route thật, vẫn xanh. Đột biến (mỗi cái một lần, trả lại):
  - bỏ `deleteMany` trong `lock` → ca "khoá … MỌI phiên chết" đỏ;
  - bỏ `deleteMany` trong `setRole` → ca "thu Staff" đỏ;
  - bỏ `tx.userEvent.create` của `unlock` → ca "mở khoá" đỏ;
  - cho `claim` bỏ qua `userActions` → ca Owner 409 và ca khoá lần hai đỏ;
  - bỏ `escapeLike` → ca `%25` đỏ;
  - bỏ `deletedAt: null` ở `list` → ca mặc định đỏ (total 6).

- [ ] **B8.** Quy trình gate. Commit:
  `feat(api): vùng Users cho Owner — danh sách, chi tiết, cấp và thu Staff, khoá, đăng xuất mọi nơi`

## Task 6 — Core và web: câu báo khoá, đường Google quay về form

**Files:**

- Modify: `libs/shared/core/src/lib/auth-errors.ts`, `auth-errors.spec.ts`
- Modify: `libs/shared/i18n/src/lib/messages.ts`
- Modify: `apps/web/src/components/auth/login-form.tsx`, `login-form.spec.tsx`
- Modify: `apps/web/src/components/auth/register-form.tsx`, `register-form.spec.tsx`
- Modify: `apps/web/src/lib/api/session.ts`, `session.spec.ts`

**Interfaces:**

- Consumes: mã `ACCOUNT_LOCKED` và field `user.lockedAt` của get-session (Task 4).
- Produces: `AuthErrorKey` thêm `'accountLocked'`; `messages.authForms.errors.accountLocked`.
  App mobile nhận khoá mới tự động khi nó đi qua `mapAuthError` (tài liệu bàn giao mobile
  bắt buộc điều đó) — KHÔNG sửa `apps/mobile`.

- [ ] **B1. Test core (đỏ).** Trong `libs/shared/core/src/lib/auth-errors.spec.ts`, thêm vào
  `describe` của `mapAuthError`:

```ts
  it('code ACCOUNT_LOCKED (403 từ hook tạo phiên, hoặc ?error= của Google) -> accountLocked', () => {
    expect(mapAuthError({ status: 403, code: 'ACCOUNT_LOCKED' })).toBe('accountLocked');
    expect(mapAuthError({ code: 'ACCOUNT_LOCKED' })).toBe('accountLocked');
  });
```

  và vào `describe` của `fieldOfAuthError`:

```ts
  it('tài khoản bị khoá là lỗi cấp form — không ô nào sửa được nó', () => {
    expect(fieldOfAuthError('accountLocked')).toBeNull();
  });
```

  `pnpm --filter @tourism/core exec vitest run src/lib/auth-errors.spec.ts` — đỏ (typecheck
  của vitest không chặn; ca đầu ra `generic`).

- [ ] **B2. Cài core.** `libs/shared/core/src/lib/auth-errors.ts`:
  - union `AuthErrorKey`, thêm ngay trước `| 'generic'`:

```ts
  // ADR-0052 §4: hook tạo phiên của API trả 403 kèm code ACCOUNT_LOCKED.
  | 'accountLocked'
```

  - trong `mapAuthError`, ngay sau dòng `if (status === 401) return 'invalidCredentials';`:

```ts
  // ADR-0052 §4: tài khoản bị khoá. Mã của chính repo (hook `session.create.before`), không
  // phải của BA — so BẰNG. Đường Google mang nó về qua `?error=` nên không có status.
  if (code === 'ACCOUNT_LOCKED') return 'accountLocked';
```

- [ ] **B3. Copy.** `libs/shared/i18n/src/lib/messages.ts`, trong `authForms.errors`, ngay sau
  `noPasswordAccount`:

```ts
      // ADR-0052 §4: Owner khoá tài khoản này. Hệ quả đo trên code: mọi đường đăng nhập bị
      // chặn ở hook tạo phiên; liên hệ đi qua trang /contact sẵn có.
      accountLocked: 'This account is locked. Contact us.',
```

  Build: `pnpm turbo run build --filter=@tourism/core --filter=@tourism/i18n --output-logs=errors-only`.
  Chạy lại lệnh B1 — xanh. Đột biến: đổi `===` thành `includes('LOCK')` vẫn xanh — chấp
  nhận, ghi lại; đổi so sánh thành `code === 'LOCKED'` → đỏ.

- [ ] **B4. Test web (đỏ).** `apps/web/src/components/auth/login-form.spec.tsx`:
  - ca `nút Google gọi authClient.signIn.social đúng provider + callbackURL` — kỳ vọng mới:

```ts
    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: `${window.location.origin}/`,
      errorCallbackURL: `${window.location.origin}/login?redirect=%2F`,
    });
```

  - thêm vào `describe('LoginForm — Google')`:

```ts
  it('Google quay về với ?error=ACCOUNT_LOCKED → câu báo khoá hiện ngay khi mở form', () => {
    searchParamsGet.mockImplementation((key: string) =>
      key === 'error' ? 'ACCOUNT_LOCKED' : null,
    );
    render(<LoginForm />);
    expect(screen.getByText(messages.authForms.errors.accountLocked)).toBeInTheDocument();
  });

  it('mã OAuth lạ ở ?error= → câu chung, không in mã thô ra màn', () => {
    searchParamsGet.mockImplementation((key: string) => (key === 'error' ? 'state_mismatch' : null));
    render(<LoginForm />);
    expect(screen.getByText(messages.authForms.errors.generic)).toBeInTheDocument();
    expect(screen.queryByText('state_mismatch')).not.toBeInTheDocument();
  });
```

  - thêm vào `describe('LoginForm — submit')`:

```ts
  it('mật khẩu đúng nhưng tài khoản bị khoá (403 ACCOUNT_LOCKED) → câu báo khoá, KHÔNG push', async () => {
    signInEmail.mockResolvedValueOnce({ data: null, error: { status: 403, code: 'ACCOUNT_LOCKED' } });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: messages.authForms.login.submit }));

    expect(await screen.findByText(messages.authForms.errors.accountLocked)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
```

  `apps/web/src/components/auth/register-form.spec.tsx`, thêm cạnh ca Google sẵn có:

```ts
  it('nút Google gửi errorCallbackURL về /login — lỗi của BA quay về form chứ không ra domain API', async () => {
    signInSocial.mockResolvedValueOnce({ data: null, error: null });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.click(screen.getByRole('button', { name: /Continue with Google/i }));

    await waitFor(() => expect(signInSocial).toHaveBeenCalledTimes(1));
    expect(signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ errorCallbackURL: `${window.location.origin}/login?redirect=%2F` }),
    );
  });
```

  (Đặt ca này trong `describe` chứa ca "Google lỗi" — `beforeEach` ở đó đã cho
  `searchParamsGet` trả `null`. Nút tìm bằng đúng regex ca ấy đang dùng: tên nút là copy
  của file, không phải câu khẳng định.)

  `pnpm --filter @tourism/web exec vitest run src/components/auth/` — các ca mới đỏ.

- [ ] **B5. Cài web.** `apps/web/src/components/auth/login-form.tsx`:
  - khởi tạo `formError` từ URL:

```tsx
  // Google quay về đây với `?error=<mã>` khi BA từ chối (ADR-0052 §4: tài khoản bị khoá ra
  // `ACCOUNT_LOCKED`); mã OAuth khác rơi về câu chung qua `mapAuthError`. Đọc MỘT lần lúc
  // dựng: redirect của OAuth là một lượt tải trang mới.
  const [formError, setFormError] = useState<AuthErrorKey | null>(() => {
    const code = searchParams.get('error');
    return code ? mapAuthError({ code }) : null;
  });
```

  - trong `handleGoogleSignIn`:

```tsx
      const redirect = safeRedirect(searchParams.get('redirect'));
      const { error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}${redirect}`,
        // BA từ chối (tài khoản bị khoá, OAuth hỏng) thì quay về form này kèm `?error=`, thay
        // vì trang lỗi mặc định ở domain API (ADR-0052, giới hạn đã biết 4).
        errorCallbackURL: `${window.location.origin}/login?redirect=${encodeURIComponent(redirect)}`,
      });
```

  `apps/web/src/components/auth/register-form.tsx`, trong `handleGoogleSignIn`, cùng hai
  thay đổi của khối gọi `signIn.social` (biến `redirect` và dòng `errorCallbackURL` kèm
  comment ấy) — đích lỗi là `/login`, không phải `/register`.

- [ ] **B6. Phiên web coi khoá như tombstone (đỏ rồi cài).** `apps/web/src/lib/api/session.spec.ts`,
  thêm cạnh ca tombstone:

```ts
  it('user có lockedAt khác null (bị khoá, ADR-0052) → coi như null-session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          session: { id: 's1' },
          user: { ...validUser, lockedAt: '2026-10-02T03:00:00.000Z' },
        }),
      }),
    );
    const { getServerSession } = await freshSessionModule();

    expect(await getServerSession()).toBeNull();
  });
```

  Đỏ. Rồi `apps/web/src/lib/api/session.ts`: thêm `lockedAt?: string | null;` vào
  `GetSessionApiResponse.user` (ngay dưới `deletedAt`), điều kiện thành
  `if (!data || data.user.deletedAt != null || data.user.lockedAt != null) return null;`, và
  câu JSDoc "User đã tombstone (`deletedAt != null`) coi như null-session" thành "User đã
  tombstone (`deletedAt != null`) hay đang bị khoá (`lockedAt != null`, ADR-0052) coi như
  null-session".

- [ ] **B7.** Chạy lại `pnpm --filter @tourism/web exec vitest run src/components/auth/ src/lib/api/session.spec.ts`
  — xanh. Đột biến: bỏ dòng `errorCallbackURL` ở login (ca Google đỏ); khởi tạo `formError`
  bằng `null` (ca `?error=` đỏ); bỏ vế `lockedAt` ở session (ca khoá đỏ).

- [ ] **B8.** `pnpm lint:fix`; quy trình gate. Commit:
  `feat(web): câu báo tài khoản bị khoá và đường Google quay về form đăng nhập`

## Task 7 — Admin: cổng cho Staff, quyền ở client, trang chỉ Owner

**Files:**

- Modify: `apps/admin/src/lib/admin-gate.ts`, `admin-gate.spec.ts`
- Create: `apps/admin/src/components/admin-access-provider.tsx`, `admin-access-provider.spec.tsx`
- Create: `apps/admin/src/test/access.tsx`
- Create: `apps/admin/src/lib/admin-access.ts`, `admin-access.spec.ts`
- Modify: `apps/admin/src/lib/export-route.ts`, `export-route.spec.ts`, `export-route-gate.spec.ts`
- Modify: `apps/admin/src/app/(admin)/layout.tsx`, `reports/page.tsx`, `reports/export/route.ts`,
  `payment-events/page.tsx`, `apps/admin/src/app/not-authorized/page.tsx`
- Modify: `apps/admin/src/lib/api/session.ts`, `session.spec.ts`
- Modify: `apps/admin/src/components/auth/login-form.tsx`, `login-form.spec.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts`

**Interfaces:**

- Consumes: `isAdminAppRole`, `canAccess`, `AdminProcedureKey` từ
  `@tourism/contract/admin-access` (Task 1); `user.lockedAt` của get-session (Task 4).
- Produces: `AdminAccessProvider({ role, children })`, `useCanAccess(key): boolean`,
  `withRole(role)` (wrapper cho Testing Library), `requirePageAccess(session, key)`,
  `notAuthorizedVariant(role)`, `guardExportAccess(path, access?)`.

- [ ] **B1. Test cổng (đỏ).** `apps/admin/src/lib/admin-gate.spec.ts`, đổi import thành
  `import { decideAdminAccess, notAuthorizedVariant } from './admin-gate';` và thêm:

```ts
  it('STAFF → allow (ADR-0052: Staff vào app; quyền từng trang do bảng quyền quyết)', () => {
    expect(decideAdminAccess({ role: 'STAFF' }, '/bookings')).toEqual({ kind: 'allow' });
  });

  it('role sai hoa thường vẫn deny — so bằng, không hạ chữ', () => {
    expect(decideAdminAccess({ role: 'staff' }, '/')).toEqual({ kind: 'deny' });
  });
```

```ts
describe('notAuthorizedVariant', () => {
  it('Staff tới /not-authorized vì một trang chỉ Owner', () => {
    expect(notAuthorizedVariant('STAFF')).toBe('ownerOnly');
  });

  it('khách, chưa đăng nhập, role lạ: câu "không có quyền admin" như cũ', () => {
    for (const role of ['CUSTOMER', '', null]) {
      expect(notAuthorizedVariant(role)).toBe('noAccess');
    }
  });
});
```

- [ ] **B2. Cài cổng.** `apps/admin/src/lib/admin-gate.ts`:
  - import `isAdminAppRole` từ `@tourism/contract/admin-access`;
  - dòng `if (session.role !== 'ADMIN') return { kind: 'deny' };` thành
    `if (!isAdminAppRole(session.role)) return { kind: 'deny' };`;
  - câu JSDoc đầu file "role không phải 'ADMIN' — kể cả rỗng hay lạ — đều deny" thành "role
    không phải ADMIN (Owner) hay STAFF (ADR-0052) — kể cả rỗng hay lạ — đều deny";
  - cuối file:

```ts
/**
 * Trang `/not-authorized` nói theo role (plan P4f, quyết định 5): Staff tới đó vì một trang
 * chỉ Owner, nên câu "tài khoản không có quyền admin" sai với họ.
 */
export function notAuthorizedVariant(role: string | null): 'ownerOnly' | 'noAccess' {
  return role === 'STAFF' ? 'ownerOnly' : 'noAccess';
}
```

  `pnpm --filter @tourism/admin exec vitest run src/lib/admin-gate.spec.ts` — xanh.

- [ ] **B3. Provider (đỏ rồi cài).** Tạo `apps/admin/src/components/admin-access-provider.spec.tsx`:

```tsx
import { render } from '@testing-library/react';
import type { AdminProcedureKey } from '@tourism/contract/admin-access';
import { describe, expect, it } from 'vitest';
import { AdminAccessProvider, useCanAccess } from './admin-access-provider';

function Probe({ access }: { access: AdminProcedureKey }) {
  return <span>{useCanAccess(access) ? 'shown' : 'hidden'}</span>;
}

const BOTH = (
  <>
    <Probe access="bookings.refund" />
    <Probe access="bookings.list" />
  </>
);

describe('useCanAccess', () => {
  it('Staff: khoá owner ẩn, khoá staff hiện', () => {
    const { container } = render(<AdminAccessProvider role="STAFF">{BOTH}</AdminAccessProvider>);
    expect(container.textContent).toBe('hiddenshown');
  });

  it('Owner: mọi khoá hiện', () => {
    const { container } = render(<AdminAccessProvider role="ADMIN">{BOTH}</AdminAccessProvider>);
    expect(container.textContent).toBe('shownshown');
  });

  it('role lạ trong provider: ẩn hết — fail-closed', () => {
    const { container } = render(<AdminAccessProvider role="CUSTOMER">{BOTH}</AdminAccessProvider>);
    expect(container.textContent).toBe('hiddenhidden');
  });

  it('không có provider: hiện (plan P4f quyết định 3 — gác thật ở API)', () => {
    const { container } = render(BOTH);
    expect(container.textContent).toBe('shownshown');
  });
});
```

  Đỏ. Tạo `apps/admin/src/components/admin-access-provider.tsx`:

```tsx
'use client';

import { type AdminProcedureKey, canAccess } from '@tourism/contract/admin-access';
import * as React from 'react';

/**
 * Role của phiên đang mở, cho component client hỏi "nút này có hiện không" (ADR-0052 §2).
 * CHỈ để gọn mắt — gác thật ở API (`@AdminImplement`).
 *
 * Vắng provider thì `useCanAccess` trả `true` (plan P4f, quyết định 3). Ở app thật provider
 * luôn có — layout `(admin)` bọc mọi trang; vắng chỉ xảy ra trong test. Mặc định ngược lại
 * (ẩn) sẽ lấy mất nút Refund của chính Owner nếu một ngày provider rơi khỏi cây, còn mặc
 * định này chỉ để Staff thấy một nút bấm vào ra 403.
 */
const RoleContext = React.createContext<string | null>(null);

export function AdminAccessProvider({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useCanAccess(key: AdminProcedureKey): boolean {
  const role = React.useContext(RoleContext);
  return role === null || canAccess(role, key);
}
```

  Tạo `apps/admin/src/test/access.tsx`:

```tsx
import type * as React from 'react';
import { AdminAccessProvider } from '@/components/admin-access-provider';

/**
 * Wrapper cho `render(ui, { wrapper: withRole('STAFF') })` (ADR-0052). Spec không bọc thì UI
 * hiện đủ nút như Owner (plan P4f, quyết định 3) — ca của Staff phải bọc tường minh.
 */
export function withRole(role: string) {
  return function RoleWrapper({ children }: { children: React.ReactNode }) {
    return <AdminAccessProvider role={role}>{children}</AdminAccessProvider>;
  };
}
```

  Chạy spec provider — xanh. Đột biến: đổi `role === null ||` thành `role !== null &&` (ca
  không provider đỏ).

- [ ] **B4. Chặn trang (đỏ rồi cài).** Tạo `apps/admin/src/lib/admin-access.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect }));

import { requirePageAccess } from './admin-access';

describe('requirePageAccess', () => {
  beforeEach(() => {
    redirect.mockReset();
  });

  it('Staff mở trang chỉ Owner → /not-authorized', () => {
    requirePageAccess({ role: 'STAFF' }, 'reports.monthly');
    expect(redirect).toHaveBeenCalledWith('/not-authorized');
  });

  it('Staff ở trang staff, Owner ở mọi trang → không chuyển hướng', () => {
    requirePageAccess({ role: 'STAFF' }, 'bookings.list');
    requirePageAccess({ role: 'ADMIN' }, 'users.list');
    expect(redirect).not.toHaveBeenCalled();
  });
});
```

  Đỏ. Tạo `apps/admin/src/lib/admin-access.ts`:

```ts
import { type AdminProcedureKey, canAccess } from '@tourism/contract/admin-access';
import { redirect } from 'next/navigation';

/**
 * Trang chỉ Owner (ADR-0052 §2): role không gọi được thủ tục chính của trang → về
 * `/not-authorized` TRƯỚC khi gọi API. Gọi ngay sau `getServerSession()` và trước mọi fetch
 * (plan P4f, quyết định 13) — fetch song song với phiên thì 403 nổ trước khi kịp chặn.
 */
export function requirePageAccess(session: { role: string }, key: AdminProcedureKey): void {
  if (!canAccess(session.role, key)) redirect('/not-authorized');
}
```

- [ ] **B5. Route xuất (đỏ rồi cài).** `apps/admin/src/lib/export-route.spec.ts`, thêm:

```ts
  it('Staff + route xuất của thủ tục chỉ Owner → 403, không đi tiếp', async () => {
    lookupServerSession.mockResolvedValueOnce({
      kind: 'ok',
      user: { id: 's1', name: 'S', email: 's@example.com', role: 'STAFF', image: null },
    });
    const gate = await guardExportAccess('/reports/export', 'reports.monthly');
    expect(gate.ok).toBe(false);
    if (gate.ok) throw new Error('unreachable');
    expect(gate.response.status).toBe(403);
    expect(await gate.response.text()).toBe(messages.admin.errors.write.FORBIDDEN);
  });

  it('Staff + route xuất không khai khoá quyền (bookings, subscribers) → ok', async () => {
    const user = { id: 's1', name: 'S', email: 's@example.com', role: 'STAFF', image: null };
    lookupServerSession.mockResolvedValueOnce({ kind: 'ok', user });
    expect(await guardExportAccess('/bookings/export')).toEqual({ ok: true, session: user });
  });
```

  `apps/admin/src/lib/export-route-gate.spec.ts`, ca `GET /reports/export`: đổi kỳ vọng thành
  `expect(guardExportAccess).toHaveBeenCalledWith('/reports/export', 'reports.monthly');`.

  Đỏ. Cài `apps/admin/src/lib/export-route.ts`:
  - import `type AdminProcedureKey, canAccess` từ `@tourism/contract/admin-access`;
  - chữ ký `export async function guardExportAccess(path: string, access?: AdminProcedureKey): Promise<ExportGate>`;
  - ngay trước `return { ok: true, session };`:

```ts
  // Route xuất của thủ tục chỉ Owner (ADR-0052): Staff qua cổng app nhưng không qua đây.
  if (access && !canAccess(session.role, access)) {
    return {
      ok: false,
      response: new Response(messages.admin.errors.write.FORBIDDEN, { status: 403 }),
    };
  }
```

  `apps/admin/src/app/(admin)/reports/export/route.ts`: dòng gate thành
  `const gate = await guardExportAccess('/reports/export', 'reports.monthly');`.

- [ ] **B6. Phiên admin và form đăng nhập (đỏ rồi cài).**
  - `apps/admin/src/lib/api/session.spec.ts`, thêm cạnh ca tombstone:

```ts
  it('tài khoản bị khoá (lockedAt, ADR-0052) cũng là none', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ session: {}, user: { ...USER, lockedAt: '2026-10-02T03:00:00.000Z' } }),
    );
    expect(await lookupServerSession()).toEqual({ kind: 'none' });
  });
```

  - `apps/admin/src/components/auth/login-form.spec.tsx`: thêm `import { messages } from '@tourism/i18n';`
    và ca:

```tsx
  it('tài khoản bị khoá (ACCOUNT_LOCKED) → câu riêng bảo hỏi Owner', async () => {
    signInEmail.mockResolvedValue({ error: { code: 'ACCOUNT_LOCKED' } });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.admin.login.errors.accountLocked,
    );
    expect(push).not.toHaveBeenCalled();
  });
```

  Đỏ (câu chưa tồn tại). Cài:
  - `apps/admin/src/lib/api/session.ts`: `lockedAt?: string | null;` vào
    `GetSessionApiResponse.user` (dưới `deletedAt`); điều kiện
    `if (!data || data.user.deletedAt != null || data.user.lockedAt != null) return { kind: 'none' };`;
  - `apps/admin/src/components/auth/login-form.tsx`, biểu thức `form:` thành:

```tsx
          form:
            error.code === 'INVALID_EMAIL_OR_PASSWORD'
              ? t.errors.invalidCredentials
              : error.code === 'EMAIL_NOT_VERIFIED'
                ? t.errors.emailNotVerified
                : error.code === 'ACCOUNT_LOCKED'
                  ? t.errors.accountLocked
                  : t.errors.generic,
```

    kèm dòng comment ngay trên khối: "ADR-0052 §4: tài khoản bị khoá (hook tạo phiên của
    API) — form admin không đi qua `mapAuthError` nên tự nhận mã (plan P4f, quyết định 4)."
  - `messages.ts`, `admin.login.errors`, sau `emailNotVerified`:

```ts
        // ADR-0052 §4 — Staff bị khoá: người mở khoá được là Owner.
        accountLocked: 'This account is locked. Ask the site owner to unlock it.',
```

  - `messages.ts`, `admin.notAuthorized`, thêm khối:

```ts
      // Staff tới đây vì một trang chỉ Owner (plan P4f, quyết định 5).
      ownerOnly: {
        title: 'Owner only',
        body: 'This page is only for the site owner. Your staff account can’t open it.',
        back: 'Back to the dashboard',
      },
```

  Build i18n, chạy lại hai spec — xanh.

- [ ] **B7. Layout, trang chỉ Owner, `/not-authorized`** (app/** không có test Vitest — kiểm
  ở thử tay §8.4 của spec).
  - `apps/admin/src/app/(admin)/layout.tsx`: import `isAdminAppRole` từ
    `@tourism/contract/admin-access` và `AdminAccessProvider` từ
    `@/components/admin-access-provider`; dòng `if (session.role !== 'ADMIN') redirect('/not-authorized');`
    thành `if (!isAdminAppRole(session.role)) redirect('/not-authorized');`; trong comment
    ngay trên nó, "cần session ADMIN thật" thành "cần session ADMIN hoặc STAFF thật
    (ADR-0052)"; phần trả về thành:

```tsx
  return (
    <div data-admin-surface style={{ display: 'contents' }}>
      {/* Role cho component client hỏi nút nào hiện (ADR-0052) — gác thật vẫn ở API. */}
      <AdminAccessProvider role={session.role}>{children}</AdminAccessProvider>
    </div>
  );
```

  - `apps/admin/src/app/(admin)/reports/page.tsx` — thay khối `Promise.all` bằng:

```tsx
  const session = await getServerSession();
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở lần điều
  // hướng kế (cùng nếp ba trang vùng).
  if (!session) return null;
  // Trang chỉ Owner (ADR-0052): chặn TRƯỚC khi gọi API (plan P4f, quyết định 13).
  requirePageAccess(session, 'reports.monthly');
  const cookie = (await cookies()).toString();
  const report = await fetchAdminMonthlyReport(cookie, query.month);
```

  - `apps/admin/src/app/(admin)/payment-events/page.tsx` — cùng nếp:

```tsx
  const session = await getServerSession();
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở lần điều
  // hướng kế (cùng nếp các trang vùng khác).
  if (!session) return null;
  // Trang chỉ Owner (ADR-0052): chặn TRƯỚC khi gọi API (plan P4f, quyết định 13).
  requirePageAccess(session, 'paymentEvents.list');
  const cookie = (await cookies()).toString();
  const [paged, stats] = await Promise.all([
    fetchAdminPaymentEvents(cookie, query),
    fetchAdminPaymentEventsStats(cookie),
  ]);
```

    (thêm `import { requirePageAccess } from '@/lib/admin-access';` ở cả hai trang).
  - `apps/admin/src/app/not-authorized/page.tsx` — đọc phiên và rẽ nhánh:

```tsx
export default async function NotAuthorizedPage() {
  await connection();
  // Nói theo role (plan P4f, quyết định 5): Staff tới đây vì một trang chỉ Owner.
  const session = await getServerSession();
  if (notAuthorizedVariant(session?.role ?? null) === 'ownerOnly') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="font-heading text-xl">{t.ownerOnly.title}</CardTitle>
            <CardDescription>{t.ownerOnly.body}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link href="/" className={buttonVariants()}>
              {t.ownerOnly.back}
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{t.title}</CardTitle>
          <CardDescription>{t.body}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SignOutButton label={t.signOut} />
          <a href={SITE_URL} className="text-center text-sm text-muted-foreground underline">
            {t.backToSite}
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
```

    Import thêm `buttonVariants` từ `@tourism/ui/components/button`, `Link` từ `next/link`,
    `getServerSession` từ `@/lib/api/session`, `notAuthorizedVariant` từ `@/lib/admin-gate`.
    Khối `return` thứ hai là nguyên văn khối cũ — chỉ thêm nhánh `ownerOnly` phía trên.

- [ ] **B8.** `pnpm lint:fix`; quy trình gate. Đột biến đã ghi ở từng bước, thêm: bỏ dòng
  `requirePageAccess` của reports — không test nào đỏ (trang không có Vitest), ghi rõ ca
  này để thử tay bước 2 của spec §8.4 bắt. Commit:
  `feat(admin): cổng cho Staff, quyền ở client và trang chỉ Owner`

## Task 8 — Admin: sidebar theo role, nhãn Owner/Staff

**Files:**

- Create: `apps/admin/src/lib/role-label.ts`, `role-label.spec.ts`
- Modify: `apps/admin/src/lib/nav.ts`, `nav.spec.ts`
- Modify: `apps/admin/src/components/nav-main.tsx`, `nav-main.spec.tsx`
- Modify: `apps/admin/src/components/app-sidebar.tsx`, `app-sidebar.spec.tsx`
- Modify: `apps/admin/src/components/nav-user.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts`

**Interfaces:**

- Consumes: `canAccess`, `AdminProcedureKey` (Task 1).
- Produces: `NavItem.access?: AdminProcedureKey`, `navGroupsFor(role): NavGroup[]`,
  `NavMain({ role })`, `roleLabel(role): string`, khối i18n `messages.admin.users` (mới có
  `roles`; Task 10–12 thêm tiếp).

- [ ] **B1. Copy.** `libs/shared/i18n/src/lib/messages.ts`, trong `admin`, ngay SAU khối
  `posts` (P4e-4):

```ts
    // Vùng Users (P4f, ADR-0052). Enum giữ ADMIN, giao diện gọi là Owner (ADR-0052 §1).
    users: {
      roles: { ADMIN: 'Owner', STAFF: 'Staff', CUSTOMER: 'Customer' },
    },
```

  Build i18n.

- [ ] **B2. Nhãn role (đỏ rồi cài).** Tạo `apps/admin/src/lib/role-label.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { roleLabel } from './role-label';

describe('roleLabel', () => {
  it('ba role có nhãn — ADMIN in là Owner', () => {
    expect(roleLabel('ADMIN')).toBe('Owner');
    expect(roleLabel('STAFF')).toBe('Staff');
    expect(roleLabel('CUSTOMER')).toBe('Customer');
  });

  it('role lạ in nguyên chữ thay vì ô trống', () => {
    expect(roleLabel('MODERATOR')).toBe('MODERATOR');
  });
});
```

  Đỏ. Tạo `apps/admin/src/lib/role-label.ts`:

```ts
import { messages } from '@tourism/i18n';

/**
 * Nhãn của một role trên giao diện admin (ADR-0052 §1: enum giữ ADMIN, giao diện gọi là
 * Owner). File riêng CHỈ import i18n (plan P4f, quyết định 12): `nav-user` là chunk client
 * của mọi trang, lấy nhãn từ `lib/users-view.ts` sẽ kéo barrel contract theo.
 */
const ROLE_LABELS: Record<string, string> = messages.admin.users.roles;

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
```

- [ ] **B3. Lọc sidebar (đỏ).** `apps/admin/src/lib/nav.spec.ts`: đổi import thành
  `import { isActiveNav, NAV_GROUPS, navGroupsFor, navTooltip } from './nav';` và thêm:

```ts
describe('navGroupsFor (ADR-0052)', () => {
  const keys = (role: string) => navGroupsFor(role).flatMap((group) => group.items.map((i) => i.key));

  it('Owner thấy đủ mọi mục, đúng thứ tự', () => {
    expect(navGroupsFor('ADMIN')).toEqual(NAV_GROUPS);
  });

  it('Staff không thấy Reports, Payment events, Users — các mục khác còn nguyên', () => {
    const staff = keys('STAFF');
    expect(staff).not.toContain('reports');
    expect(staff).not.toContain('payment-events');
    expect(staff).not.toContain('users');
    expect(staff).toEqual(keys('ADMIN').filter((key) => !['reports', 'payment-events', 'users'].includes(key)));
  });
});
```

  `apps/admin/src/components/nav-main.spec.tsx`: `renderNav` nhận thêm role, mặc định Owner
  — sáu ca cũ không đổi assertion nào:

```tsx
function renderNav({ open, role = 'ADMIN' }: { open: boolean; role?: string }) {
  return render(
    <TooltipProvider>
      <SidebarProvider defaultOpen={open}>
        <NavMain role={role} />
      </SidebarProvider>
    </TooltipProvider>,
  );
}
```

  và thêm ca:

```tsx
  it('Staff: mục chỉ Owner ẩn HẲN — không hiện dạng "Soon" (ADR-0052)', () => {
    renderNav({ open: true, role: 'STAFF' });

    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment events')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bookings' })).toBeInTheDocument();
  });
```

  Chạy hai spec — đỏ.

- [ ] **B4. Cài.** `apps/admin/src/lib/nav.ts`:
  - import `type AdminProcedureKey, canAccess` từ `@tourism/contract/admin-access` (subpath:
    không kéo barrel — đúng lý do comment của mục subscribers đã ghi);
  - `NavItem` thêm:

```ts
  /**
   * Thủ tục chính của trang (ADR-0052). Role không gọi được nó thì mục bị ẩn HẲN — không
   * hiện "Soon" (Soon là "sắp có", còn đây là "không dành cho bạn"). Vắng = mọi role vào app.
   */
  access?: AdminProcedureKey;
```

  - thêm `access` cho ba mục: Reports `access: 'reports.monthly'`, Payment events
    `access: 'paymentEvents.list'`, Users `access: 'users.list'` (Users vẫn `enabled: false`
    — Task 10 bật);
  - cuối file:

```ts
/** Bản đồ sidebar của MỘT role — mục mà role ấy không gọi được thủ tục chính thì bỏ. */
export function navGroupsFor(role: string): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.access || canAccess(role, item.access)),
  }));
}
```

  `apps/admin/src/components/nav-main.tsx`: `export function NavMain({ role }: { role: string })`,
  `NAV_GROUPS.map(` thành `navGroupsFor(role).map(`, import `navGroupsFor` thay `NAV_GROUPS`;
  trong JSDoc thêm một câu: "Mục chỉ Owner bị ẩn HẲN với Staff (`navGroupsFor`, ADR-0052)."

  `apps/admin/src/components/app-sidebar.tsx`: `<NavMain />` thành `<NavMain role={user.role} />`.

  Chạy lại hai spec — xanh.

- [ ] **B5. Nhãn trong menu tài khoản (đỏ rồi cài).** `apps/admin/src/components/app-sidebar.spec.tsx`
  (file đã import `render`, `userEvent`, `SidebarProvider`), thêm hai ca vào
  `describe('AppSidebar')`:

```tsx
  it('menu tài khoản nói bậc của phiên: Owner (ADR-0052)', async () => {
    const user = userEvent.setup();
    renderSidebar({ open: true });

    await user.click(screen.getByText('admin@nexora.test'));

    expect(await screen.findByText('Owner')).toBeInTheDocument();
  });

  it('phiên Staff: sidebar không có Reports, menu tài khoản ghi Staff', async () => {
    const user = userEvent.setup();
    render(
      <SidebarProvider defaultOpen>
        <AppSidebar user={{ ...USER, role: 'STAFF' }} />
      </SidebarProvider>,
    );

    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    await user.click(screen.getByText('admin@nexora.test'));
    expect(await screen.findByText('Staff')).toBeInTheDocument();
  });
```

  Đỏ ở hai `findByText`. Cài `apps/admin/src/components/nav-user.tsx` — import `roleLabel`
  từ `@/lib/role-label`; trong `DropdownMenuLabel`, khối tên/email thành:

```tsx
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    {/* Bậc của phiên (ADR-0052) — trong menu chứ không ở nút sidebar: nút cao
                        `lg` chỉ đủ hai dòng (plan P4f, quyết định 6). */}
                    <span className="truncate text-xs text-muted-foreground">
                      {roleLabel(user.role)}
                    </span>
                  </div>
```

  Chạy lại `app-sidebar.spec.tsx` — xanh. Đột biến: cho `navGroupsFor` trả `NAV_GROUPS`
  nguyên (ca Staff của nav, nav-main, app-sidebar đỏ); bỏ dòng `access` của Reports (ca
  Staff đỏ).

- [ ] **B6.** `pnpm lint:fix`; quy trình gate. Commit:
  `feat(admin): sidebar theo bậc Owner/Staff và nhãn bậc trong menu tài khoản`

## Task 9 — Admin: ẩn bốn nút chỉ Owner với Staff

**Files:**

- Modify: `apps/admin/src/components/bookings/refund-panel.tsx`, `refund-panel.spec.tsx`
- Modify: `apps/admin/src/components/departures/departure-row-actions.tsx`, `departure-row-actions.spec.tsx`
- Modify: `apps/admin/src/components/tours/editor/delete-tour-zone.tsx`, `delete-tour-zone.spec.tsx`
- Modify: `apps/admin/src/components/posts/editor/delete-post-zone.tsx`, `delete-post-zone.spec.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts`

**Interfaces:**

- Consumes: `useCanAccess` (Task 7), `withRole` (Task 7).
- Produces: không gì mới cho task sau.

Mọi ca cũ của bốn spec giữ nguyên (không provider → hiện đủ như Owner, quyết định 3); chỉ
thêm ca Staff, bọc bằng `withRole('STAFF')`.

- [ ] **B1. Bốn ca Staff (đỏ).**
  - `refund-panel.spec.tsx` (thêm `import { withRole } from '@/test/access';`):

```tsx
describe('RefundPanel — Staff (ADR-0052)', () => {
  it('booking hoàn được: KHÔNG nút refund, có câu "chỉ Owner"; sổ hoàn tiền vẫn hiện', () => {
    render(
      <RefundPanel
        booking={{ ...PAID, refundedTotal: '40.50', refunds: [REFUND_ROW] }}
        refund={vi.fn()}
      />,
      { wrapper: withRole('STAFF') },
    );
    expect(screen.queryByRole('button', { name: t.cta })).not.toBeInTheDocument();
    expect(screen.getByText(t.ownerOnly)).toBeInTheDocument();
    expect(screen.queryByText(t.ledger.none)).not.toBeInTheDocument();
  });

  it('booking không hoàn được: câu "unavailable" như cũ, KHÔNG thêm câu "chỉ Owner"', () => {
    render(<RefundPanel booking={{ ...PAID, status: 'PENDING' }} refund={vi.fn()} />, {
      wrapper: withRole('STAFF'),
    });
    expect(screen.getByText(t.unavailable)).toBeInTheDocument();
    expect(screen.queryByText(t.ownerOnly)).not.toBeInTheDocument();
  });
});
```

  - `departure-row-actions.spec.tsx`: `renderActions` thêm tham số cuối `role?: string` và
    truyền `role ? { wrapper: withRole(role) } : undefined` làm đối số thứ hai của `render`
    (import `withRole`); thêm ca:

```tsx
  it('Staff (ADR-0052): không nút huỷ chuyến, không cả ô giữ chỗ của nó — Close vẫn còn', () => {
    const { dates } = renderActions(ROW, AFTER_DEADLINE, undefined, 'STAFF');

    expect(screen.queryByRole('button', { name: t.cancel.actionLabel(dates) })).not.toBeInTheDocument();
    expect(screen.queryByText(t.cancel.action)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.setStatus.closeLabel(dates) })).toBeEnabled();
  });
```

  - `delete-tour-zone.spec.tsx` (import `withRole`):

```tsx
  it('Staff (ADR-0052): vùng xoá không render gì — kể cả câu "đã có booking"', () => {
    for (const fixture of [detail, detailFixture({ bookingCount: 3 })]) {
      const { container, unmount } = render(<DeleteTourZone detail={fixture} remove={vi.fn()} />, {
        wrapper: withRole('STAFF'),
      });
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
```

  - `delete-post-zone.spec.tsx` (P4e-4; import `withRole`) — dùng đúng fixture và hằng phiên
    bản mà các ca khác trong file đang dùng (plan P4e-4 đặt tên `postDetailFixture()` và
    `FORM_VERSION`):

```tsx
  it('Staff (ADR-0052): vùng xoá bài không render gì', () => {
    const { container } = render(
      <DeletePostZone detail={postDetailFixture()} version={FORM_VERSION} remove={vi.fn()} />,
      { wrapper: withRole('STAFF') },
    );
    expect(container).toBeEmptyDOMElement();
  });
```

  Chạy `pnpm --filter @tourism/admin exec vitest run src/components/bookings src/components/departures src/components/tours/editor src/components/posts/editor`
  — năm ca mới đỏ (ca refund thứ hai đỏ vì `t.ownerOnly` chưa có → `undefined`; sẽ xanh sau
  B2–B3).

- [ ] **B2. Copy.** `messages.ts`, `admin.bookings.refund`, cạnh `unavailable`:

```ts
      // ADR-0052: hoàn tiền là thủ tục chỉ Owner — Staff biết phải hỏi ai (plan P4f, quyết định 10).
      ownerOnly: 'Only the owner can issue refunds.',
```

  Build i18n.

- [ ] **B3. Cài bốn component.** Mỗi chỗ import `useCanAccess` từ
  `@/components/admin-access-provider`; gọi hook CÙNG CHỖ các hook khác, TRƯỚC mọi
  `return` sớm.
  - `refund-panel.tsx`, trong `RefundPanel`:

```tsx
  // Hoàn tiền là thủ tục chỉ Owner (ADR-0052): Staff thấy sổ, không thấy nút.
  const mayRefund = useCanAccess('bookings.refund');
```

    điều kiện nút thành `{refundable && mayRefund ? (<RefundDialog … />) : null}`; dòng
    `{refundable ? null : <p className="text-muted-foreground">{t.unavailable}</p>}` thành:

```tsx
        {refundable ? null : <p className="text-muted-foreground">{t.unavailable}</p>}
        {refundable && !mayRefund ? (
          <p className="text-muted-foreground">{t.ownerOnly}</p>
        ) : null}
```

  - `departure-row-actions.tsx`, ngay dưới `const [cancelling, setCancelling] = useState(false);`:

```tsx
  // Huỷ chuyến là thủ tục chỉ Owner (ADR-0052): Staff không có nút, cũng không ô giữ chỗ —
  // không hàng nào của Staff có nút ấy, nên cột vẫn thẳng.
  const mayCancel = useCanAccess('departures.cancel');
```

    và khối `{row.canCancel ? (<Button …/>) : (<span …/>)}` bọc thành
    `{mayCancel ? (row.canCancel ? (<Button …/>) : (<span …/>)) : null}` — hai nhánh bên
    trong giữ nguyên từng dòng.
  - `delete-tour-zone.tsx`, đầu thân `DeleteTourZone`:

```tsx
  // Xoá tour là thủ tục chỉ Owner (ADR-0052): Staff không thấy vùng này.
  const mayDelete = useCanAccess('tours.delete');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!mayDelete) return null;
```

    (hai dòng `useRouter`/`useState` là hai dòng sẵn có, chỉ dời xuống dưới dòng mới).
  - `delete-post-zone.tsx`: thêm `const mayDelete = useCanAccess('posts.delete');` cạnh các
    hook sẵn có ở đầu thân `DeletePostZone`, và `if (!mayDelete) return null;` ngay sau hook
    cuối cùng, kèm comment "Xoá bài là thủ tục chỉ Owner (ADR-0052): Staff không thấy vùng
    này."

  Chạy lại lệnh B1 — xanh; các ca cũ của bốn file xanh nguyên. Đột biến: đổi khoá của
  `useCanAccess` ở refund thành `'bookings.list'` (ca Staff đỏ); bỏ `return null` của vùng
  xoá tour (ca Staff đỏ).

- [ ] **B4.** `pnpm lint:fix`; quy trình gate. Commit:
  `feat(admin): Staff không thấy nút hoàn tiền, huỷ chuyến, xoá tour và xoá bài`

## Task 10 — Admin: trang `/users`

**Files:**

- Create: `apps/admin/src/lib/users-query.ts`, `users-query.spec.ts`
- Create: `apps/admin/src/lib/users-view.ts`, `users-view.spec.ts`
- Create: `apps/admin/src/lib/api/users.ts`
- Create: `apps/admin/src/components/users/users-toolbar.tsx`
- Create: `apps/admin/src/components/users/users-table.tsx`, `users-table.spec.tsx`
- Create: `apps/admin/src/app/(admin)/users/page.tsx`
- Modify: `apps/admin/src/lib/nav.ts`, `libs/shared/i18n/src/lib/messages.ts`

**Interfaces:**

- Consumes: `AdminUsersViewSchema`, `USER_SEARCH_MAX`, `AdminUserRow`, `UserRoleValue`,
  `UserStatusValue` (Task 1); `roleLabel` (Task 8); `requirePageAccess` (Task 7).
- Produces (Task 11–13 dùng):
  - `UsersQuery { page; limit; view?: 'staff' | 'locked'; search? }`,
    `parseUsersSearchParams(raw)`, `usersHref(current, patch)`,
    `userDetailHref(id, listHref)`, `usersBackHref(raw)`;
  - `BadgeVariant`, `userDisplayName({ name, email })`, `formatDay(iso)`,
    `userRoleBadgeVariant(role)`, `userStatusLabel(status)`, `userStatusBadgeVariant(status)`,
    `UserRowVM`, `toUserRowVM(row, listHref)`;
  - `fetchAdminUsers(cookie, query)`;
  - `UsersTable({ rows, query, total, totalPages })`.

- [ ] **B1. Copy.** `messages.ts`, khối `admin.users` (Task 8), thêm sau `roles`:

```ts
      status: { active: 'Active', locked: 'Locked', unverified: 'Unverified' },
      list: {
        filterLabel: 'Filter users',
        all: 'All',
        staff: 'Staff',
        locked: 'Locked',
        searchLabel: 'Search users',
        searchPlaceholder: 'Name or email',
        empty: 'No users match this filter.',
        columns: {
          user: 'User',
          role: 'Role',
          status: 'Status',
          joined: 'Joined',
          lastActive: 'Last active',
        },
        viewLabel: (name: string) => `Open ${name}`,
      },
```

  Build i18n.

- [ ] **B2. URL của bảng (đỏ rồi cài).** Tạo `apps/admin/src/lib/users-query.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  parseUsersSearchParams,
  userDetailHref,
  usersBackHref,
  usersHref,
} from './users-query';

const ID = '11111111-1111-4111-8111-111111111111';

describe('parseUsersSearchParams', () => {
  it('URL trần: trang 1, 20 dòng, tab All (không có view)', () => {
    expect(parseUsersSearchParams({})).toEqual({ page: 1, limit: 20 });
  });

  it('view staff/locked giữ; all và rác rơi về All', () => {
    expect(parseUsersSearchParams({ view: 'staff' }).view).toBe('staff');
    expect(parseUsersSearchParams({ view: 'locked' }).view).toBe('locked');
    expect(parseUsersSearchParams({ view: 'all' }).view).toBeUndefined();
    expect(parseUsersSearchParams({ view: 'owners' }).view).toBeUndefined();
  });

  it('q được trim; rỗng là không lọc; quá dài cắt đúng 120', () => {
    expect(parseUsersSearchParams({ q: '  ada  ' }).search).toBe('ada');
    expect(parseUsersSearchParams({ q: '   ' }).search).toBeUndefined();
    expect(parseUsersSearchParams({ q: 'x'.repeat(130) }).search).toHaveLength(120);
  });
});

describe('usersHref', () => {
  it('đổi tab hay ô tìm thì về trang 1; giữ filter còn lại', () => {
    const current = { page: 3, limit: 20, view: 'staff' as const, search: 'ada' };
    expect(usersHref(current, { view: 'locked' })).toBe('/users?view=locked&q=ada');
    expect(usersHref(current, { search: null })).toBe('/users?view=staff');
    expect(usersHref(current, { page: 2 })).toBe('/users?view=staff&q=ada&page=2');
  });

  it('view null xoá tab — URL trần là tab All', () => {
    expect(usersHref({ page: 1, limit: 20, view: 'staff' }, { view: null })).toBe('/users');
  });
});

describe('userDetailHref / usersBackHref', () => {
  it('chỉ mang ?back= khi danh sách đang đứng KHÁC URL trần', () => {
    expect(userDetailHref(ID, '/users')).toBe(`/users/${ID}`);
    expect(userDetailHref(ID, '/users?view=locked')).toBe(
      `/users/${ID}?back=%2Fusers%3Fview%3Dlocked`,
    );
  });

  it('back chỉ nhận đường /users — chống open redirect', () => {
    expect(usersBackHref('/users?view=staff&q=ada')).toBe('/users?view=staff&q=ada');
    expect(usersBackHref('https://evil.example/users')).toBe('/users');
    expect(usersBackHref('/bookings')).toBe('/users');
    expect(usersBackHref(`/users/${ID}`)).toBe('/users');
    expect(usersBackHref(undefined)).toBe('/users');
  });
});
```

  Đỏ. Tạo `apps/admin/src/lib/users-query.ts`:

```ts
import { AdminUsersViewSchema, USER_SEARCH_MAX } from '@tourism/contract';
import {
  appendPaging,
  clampSearch,
  firstParam,
  parsePaging,
  pickPatch,
  type RawSearchParams,
  resolvePagePatch,
  tableHref,
} from './table-query';

/**
 * Trạng thái bảng `/users` sống TRÊN URL (P4f, cùng khuôn `enquiries-query.ts`): server
 * component đọc `searchParams` → input contract; bảng client đổi trang/lọc bằng điều hướng.
 * Hai filter: `view` (tab All · Staff · Locked; vắng = All) và `q` (tên hoặc email).
 */

export type UsersFilterView = 'staff' | 'locked';

/** Input đã sạch cho `admin.users.list` — vắng `view` = API mặc định `all`. */
export interface UsersQuery {
  page: number;
  limit: number;
  view?: UsersFilterView;
  search?: string;
}

/** URL là thứ NGƯỜI gõ được: view rác → All, q rỗng → không lọc, quá dài → cắt đúng trần. */
export function parseUsersSearchParams(raw: RawSearchParams): UsersQuery {
  const view = AdminUsersViewSchema.safeParse(firstParam(raw.view));
  const search = clampSearch(firstParam(raw.q), USER_SEARCH_MAX);
  return {
    ...parsePaging(raw),
    ...(view.success && view.data !== 'all' ? { view: view.data } : {}),
    ...(search ? { search } : {}),
  };
}

/** `undefined` = giữ nguyên field, `null` = xoá filter (luật chung của kit `pickPatch`). */
export interface UsersHrefPatch {
  page?: number;
  limit?: number;
  view?: UsersFilterView | null;
  search?: string | null;
}

export function usersHref(current: UsersQuery, patch: UsersHrefPatch): string {
  const view = pickPatch(patch.view, current.view);
  const search = clampSearch(pickPatch(patch.search, current.search), USER_SEARCH_MAX);
  const scopeChanged =
    patch.view !== undefined || patch.search !== undefined || patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (view) params.set('view', view);
  if (search) params.set('q', search);
  appendPaging(params, paging);
  return tableHref('/users', params);
}

const DEFAULT_BACK_HREF = '/users';

/** Link sang trang chi tiết, mang `?back=` khi danh sách đang đứng khác URL trần. */
export function userDetailHref(id: string, listHref: string): string {
  const params = new URLSearchParams();
  if (listHref !== DEFAULT_BACK_HREF) params.set('back', listHref);
  return tableHref(`/users/${id}`, params);
}

/** `?back=` chỉ được trỏ về chính `/users` — mọi thứ khác về URL trần (chống open redirect). */
export function usersBackHref(raw: string | string[] | undefined): string {
  const value = firstParam(raw);
  if (value && /^\/users(\?[^/#]*)?$/.test(value)) return value;
  return DEFAULT_BACK_HREF;
}
```

  Chạy spec — xanh. Đột biến: bỏ vế `view.data !== 'all'` (ca "all rơi về All" đỏ); bỏ
  `scopeChanged` khỏi `resolvePagePatch` (ca "về trang 1" đỏ); bỏ `$` cuối regex (ca
  `/users/<id>` đỏ).

- [ ] **B3. VM của hàng (đỏ rồi cài).** Tạo `apps/admin/src/lib/users-view.spec.ts`:

```ts
import type { AdminUserRow } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import {
  formatDay,
  toUserRowVM,
  userDisplayName,
  userRoleBadgeVariant,
  userStatusBadgeVariant,
} from './users-view';

const ROW: AdminUserRow = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  image: null,
  role: 'STAFF',
  status: 'locked',
  createdAt: '2026-09-01T23:30:00.000Z',
  lastActiveAt: null,
};

describe('userDisplayName', () => {
  it('tên có chữ thì lấy; rỗng hay toàn dấu cách thì email', () => {
    expect(userDisplayName({ name: 'Ada', email: 'a@x.com' })).toBe('Ada');
    expect(userDisplayName({ name: '   ', email: 'a@x.com' })).toBe('a@x.com');
    expect(userDisplayName({ name: null, email: 'a@x.com' })).toBe('a@x.com');
  });
});

describe('formatDay', () => {
  it('ngày theo UTC — 23:30 UTC vẫn là ngày 1, không trượt theo múi giờ máy', () => {
    expect(formatDay('2026-09-01T23:30:00.000Z')).toBe('1 Sep 2026');
  });

  it('null → gạch ngang của back-office', () => {
    expect(formatDay(null)).toBe('—');
  });
});

describe('toUserRowVM', () => {
  it('nhãn Owner/Staff/Customer, chip trạng thái, ngày, link mang ?back=', () => {
    expect(toUserRowVM(ROW, '/users?view=locked')).toEqual({
      id: ROW.id,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      image: null,
      initial: 'A',
      href: `/users/${ROW.id}?back=%2Fusers%3Fview%3Dlocked`,
      role: 'STAFF',
      roleLabel: 'Staff',
      status: 'locked',
      statusLabel: 'Locked',
      joined: '1 Sep 2026',
      lastActive: '—',
    });
  });

  it('không tên → email làm tên, chữ cái đầu từ email', () => {
    const vm = toUserRowVM({ ...ROW, name: null, email: 'zed@example.com' }, '/users');
    expect(vm.name).toBe('zed@example.com');
    expect(vm.initial).toBe('Z');
  });
});

describe('badge', () => {
  it('Owner nổi nhất, Staff vừa, khách nhạt; khoá là destructive', () => {
    expect(userRoleBadgeVariant('ADMIN')).toBe('default');
    expect(userRoleBadgeVariant('STAFF')).toBe('secondary');
    expect(userRoleBadgeVariant('CUSTOMER')).toBe('outline');
    expect(userStatusBadgeVariant('locked')).toBe('destructive');
    expect(userStatusBadgeVariant('unverified')).toBe('secondary');
    expect(userStatusBadgeVariant('active')).toBe('outline');
  });
});
```

  Đỏ. Tạo `apps/admin/src/lib/users-view.ts`:

```ts
import type { AdminUserRow, UserRoleValue, UserStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatCalendarDate } from './bookings-view';
import { roleLabel } from './role-label';
import { userDetailHref } from './users-query';

/**
 * Logic THUẦN của vùng Users (P4f): VM của bảng — và của trang chi tiết (Task 11). Component
 * không tự tính gì: mọi con chữ được nấu ở đây.
 */

const t = messages.admin.users;
/** Ô trống dùng chung của back-office — một dấu gạch, không phải chuỗi rỗng. */
const EMPTY = messages.admin.bookings.detail.empty;

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** Tên có chữ thì lấy, còn lại là email — cùng luật `accountDisplayName` của API. */
export function userDisplayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email;
}

/**
 * Mốc ISO → "1 Sep 2026" theo UTC. Cắt CHUỖI rồi qua `formatCalendarDate`, không
 * `new Date()`: ngày in ra không được trượt theo múi giờ của máy đang xem. "Lần hoạt động
 * cuối" vốn chỉ chính xác tới ngày (ADR-0052, giới hạn 3) nên không in giờ.
 */
export function formatDay(iso: string | null): string {
  return iso ? formatCalendarDate(iso.slice(0, 10)) : EMPTY;
}

export function userRoleBadgeVariant(role: UserRoleValue): BadgeVariant {
  switch (role) {
    case 'ADMIN':
      return 'default';
    case 'STAFF':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function userStatusLabel(status: UserStatusValue): string {
  return t.status[status];
}

export function userStatusBadgeVariant(status: UserStatusValue): BadgeVariant {
  switch (status) {
    case 'locked':
      return 'destructive';
    case 'unverified':
      return 'secondary';
    default:
      return 'outline';
  }
}

export interface UserRowVM {
  id: string;
  /** Tên hiển thị — rơi về email khi không có tên. */
  name: string;
  email: string;
  image: string | null;
  initial: string;
  /** Trang chi tiết — mang `?back=` về đúng trang bảng đang đứng. */
  href: string;
  role: UserRoleValue;
  roleLabel: string;
  status: UserStatusValue;
  statusLabel: string;
  joined: string;
  lastActive: string;
}

export function toUserRowVM(row: AdminUserRow, listHref: string): UserRowVM {
  const name = userDisplayName(row);
  return {
    id: row.id,
    name,
    email: row.email,
    image: row.image,
    initial: name.slice(0, 1).toUpperCase(),
    href: userDetailHref(row.id, listHref),
    role: row.role,
    roleLabel: roleLabel(row.role),
    status: row.status,
    statusLabel: userStatusLabel(row.status),
    joined: formatDay(row.createdAt),
    lastActive: formatDay(row.lastActiveAt),
  };
}
```

  Chạy spec — xanh. Đột biến: `formatDay` dùng `new Date(iso).getDate()` (ca 23:30 UTC đỏ
  trên máy múi giờ +7 — ghi rõ múi giờ máy khi thử); đổi `||` thành `??` trong
  `userDisplayName` (ca toàn dấu cách đỏ).

- [ ] **B4. Bọc API.** Tạo `apps/admin/src/lib/api/users.ts`:

```ts
import type { AdminUserRow, Paged } from '@tourism/contract';
import type { UsersQuery } from '@/lib/users-query';
import { api, withAdminAuth } from './client';

/** Bọc mỏng `admin.users.*` (P4f) — cùng nếp `lib/api/enquiries.ts`. Quyền gác ở API. */
export async function fetchAdminUsers(
  cookie: string,
  query: UsersQuery,
): Promise<Paged<AdminUserRow>> {
  return api.admin.users.list(query, { context: withAdminAuth(cookie) });
}
```

- [ ] **B5. Bảng (đỏ).** Tạo `apps/admin/src/components/users/users-table.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { UsersQuery } from '@/lib/users-query';
import type { UserRowVM } from '@/lib/users-view';
import { UsersTable } from './users-table';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const t = messages.admin.users.list;

const row = (patch: Partial<UserRowVM> = {}): UserRowVM => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  image: null,
  initial: 'A',
  href: '/users/11111111-1111-4111-8111-111111111111',
  role: 'CUSTOMER',
  roleLabel: 'Customer',
  status: 'active',
  statusLabel: 'Active',
  joined: '1 Sep 2026',
  lastActive: '1 Oct 2026',
  ...patch,
});

const QUERY: UsersQuery = { page: 1, limit: 20 };

function renderTable(rows: UserRowVM[]) {
  return render(<UsersTable rows={rows} query={QUERY} total={rows.length} totalPages={1} />);
}

describe('UsersTable', () => {
  it('tên là link sang trang chi tiết; email đứng ngay dưới tên', () => {
    renderTable([row()]);
    expect(screen.getByRole('link', { name: t.viewLabel('Ada Lovelace') })).toHaveAttribute(
      'href',
      '/users/11111111-1111-4111-8111-111111111111',
    );
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('chip role và chip trạng thái mang đúng nhãn; ngày tham gia và lần hoạt động cuối', () => {
    renderTable([row({ role: 'STAFF', roleLabel: 'Staff', status: 'locked', statusLabel: 'Locked' })]);
    expect(screen.getAllByText('Locked').length).toBeGreaterThan(0);
    expect(screen.getByText('1 Sep 2026')).toBeInTheDocument();
    expect(screen.getByText('1 Oct 2026')).toBeInTheDocument();
  });

  it('bảng rỗng nói câu empty, không phải một bảng câm', () => {
    renderTable([]);
    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });
});
```

  (`'Locked'` vừa là nhãn tab vừa là chip — vì vậy `getAllByText`.) Đỏ.

- [ ] **B6. Thanh công cụ và bảng.** Tạo `apps/admin/src/components/users/users-toolbar.tsx`:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { ListIcon, LockIcon, ShieldCheckIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { clearFiltersHref, ToolbarClearFilters } from '@/components/kit/toolbar-clear-filters';
import { type UsersFilterView, type UsersQuery, usersHref } from '@/lib/users-query';

/**
 * Ba mẩu điều khiển của `/users` (P4f): tab All · Staff · Locked (khe trái — kit
 * `StatusFilterTabs`), ô tìm tên/email và nút xoá lọc (khe phải). Cả ba chỉ đổi URL.
 */
const t = messages.admin.users.list;

const TAB_ITEMS = [
  { label: t.all, value: ALL, icon: ListIcon },
  { label: t.staff, value: 'staff', icon: ShieldCheckIcon },
  { label: t.locked, value: 'locked', icon: LockIcon },
];

function asView(value: string): UsersFilterView | null {
  return value === 'staff' || value === 'locked' ? value : null;
}

export function UsersViewTabs({ query }: { query: UsersQuery }) {
  const router = useRouter();
  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={query.view ?? ALL}
      label={t.filterLabel}
      selectId="users-view-selector"
      onSelect={(next) => router.push(usersHref(query, { view: asView(next) }))}
    />
  );
}

export function UsersSearch({ query }: { query: UsersQuery }) {
  const router = useRouter();
  return (
    <TableSearchForm
      inputId="users-search"
      label={t.searchLabel}
      placeholder={t.searchPlaceholder}
      value={query.search}
      onSearch={(term) => router.push(usersHref(query, { search: term }))}
    />
  );
}

/** Không đụng tab (`view`): nó nằm ở khe `views` và tự có mục All. */
export function UsersClearFilters({ query }: { query: UsersQuery }) {
  const router = useRouter();
  return (
    <ToolbarClearFilters
      label={messages.admin.table.clearFilters}
      href={clearFiltersHref(
        usersHref(query, { search: null, page: 1 }),
        usersHref(query, { page: 1 }),
      )}
      onNavigate={router.push}
    />
  );
}
```

  Tạo `apps/admin/src/components/users/users-table.tsx`:

```tsx
'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@tourism/ui/components/avatar';
import { Badge } from '@tourism/ui/components/badge';
import { CalendarIcon, ClockIcon, ShieldIcon, TagIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { UsersClearFilters, UsersSearch, UsersViewTabs } from '@/components/users/users-toolbar';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';
import { type UsersQuery, usersHref } from '@/lib/users-query';
import { type UserRowVM, userRoleBadgeVariant, userStatusBadgeVariant } from '@/lib/users-view';

/**
 * Bảng `/users` (P4f, spec §7.1) — dựng trọn trên kit như mọi bảng vùng (user chốt 31/08:
 * mọi bảng một kiểu). Cột: User (ảnh, tên là link, email) · Role · Status · Joined ·
 * Last active. Component KHÔNG tự tính gì: mọi con chữ do `toUserRowVM` nấu sẵn.
 */
const t = messages.admin.users.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, UserRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry. */
const COLUMN_LABELS: Record<string, string> = {
  roleLabel: t.columns.role,
  statusLabel: t.columns.status,
  joined: t.columns.joined,
  lastActive: t.columns.lastActive,
};

const COLUMN_ICONS = {
  roleLabel: ShieldIcon,
  statusLabel: TagIcon,
  joined: CalendarIcon,
  lastActive: ClockIcon,
};

const columns = columnHelper.columns([
  columnHelper.accessor('name', {
    header: t.columns.user,
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-8">
          {/* Ảnh trang trí — tên đứng ngay cạnh nên alt rỗng. */}
          {row.original.image ? <AvatarImage src={row.original.image} alt="" /> : null}
          <AvatarFallback>{row.original.initial}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0">
          <Link
            href={row.original.href}
            aria-label={t.viewLabel(row.original.name)}
            className="truncate font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.original.name}
          </Link>
          <span className="max-w-64 truncate text-xs text-muted-foreground" title={row.original.email}>
            {row.original.email}
          </span>
        </div>
      </div>
    ),
    enableHiding: false,
  }),
  columnHelper.accessor('roleLabel', {
    header: t.columns.role,
    cell: ({ row }) => (
      <Badge variant={userRoleBadgeVariant(row.original.role)} className="px-1.5">
        {row.original.roleLabel}
      </Badge>
    ),
  }),
  columnHelper.accessor('statusLabel', {
    header: t.columns.status,
    cell: ({ row }) => (
      <Badge variant={userStatusBadgeVariant(row.original.status)} className="px-1.5">
        {row.original.statusLabel}
      </Badge>
    ),
  }),
  columnHelper.accessor('joined', {
    header: t.columns.joined,
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-muted-foreground">{row.original.joined}</div>
    ),
  }),
  columnHelper.accessor('lastActive', {
    header: t.columns.lastActive,
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-muted-foreground">{row.original.lastActive}</div>
    ),
  }),
]);

export interface UsersTableProps {
  rows: UserRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: UsersQuery;
  total: number;
  totalPages: number;
}

export function UsersTable({ rows, query, total, totalPages }: UsersTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns,
    state: { columnVisibility },
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <DataTableFrame
      views={<UsersViewTabs query={query} />}
      actions={
        <>
          <UsersSearch query={query} />
          <UsersClearFilters query={query} />
          <ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} icons={COLUMN_ICONS} />
        </>
      }
      footer={
        <TablePagination
          page={query.page}
          totalPages={totalPages}
          total={total}
          pageSize={query.limit}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          hrefForPage={(page) => usersHref(query, { page })}
          hrefForPageSize={(limit) => usersHref(query, { limit })}
        />
      }
    >
      <DataTableBody table={table} empty={t.empty} />
    </DataTableFrame>
  );
}
```

  Chạy spec bảng — xanh.

- [ ] **B7. Trang và mục sidebar.** Đọc hướng dẫn route của Next 16 (Ràng buộc toàn cục).
  Tạo `apps/admin/src/app/(admin)/users/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { UsersTable } from '@/components/users/users-table';
import { requirePageAccess } from '@/lib/admin-access';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminUsers } from '@/lib/api/users';
import { orphanPageHref, type RawSearchParams } from '@/lib/table-query';
import { parseUsersSearchParams, usersHref } from '@/lib/users-query';
import { toUserRowVM } from '@/lib/users-view';

/**
 * `/users` — vùng Users của Owner (P4f, spec §7.1). Server component đúng nếp `/enquiries`:
 * `searchParams` → input contract → fetch kèm cookie forward → một trang đã nấu xuống bảng.
 * Chỉ Owner: chặn TRƯỚC khi gọi API (plan P4f, quyết định 13).
 */
export const metadata: Metadata = {
  title: 'Users — Nexora back office',
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseUsersSearchParams(await searchParams);
  const session = await getServerSession();
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở lần điều hướng kế.
  if (!session) return null;
  requirePageAccess(session, 'users.list');

  const cookie = (await cookies()).toString();
  const paged = await fetchAdminUsers(cookie, query);
  // Page mồ côi: tab Locked co lại sau mỗi lần mở khoá — về trang cuối còn thật.
  const orphan = orphanPageHref(paged, query, (page) => usersHref(query, { page }));
  if (orphan) redirect(orphan);

  const listHref = usersHref(query, {});
  return (
    <AdminShell user={session}>
      <UsersTable
        rows={paged.items.map((row) => toUserRowVM(row, listHref))}
        query={query}
        total={paged.total}
        totalPages={paged.totalPages}
      />
    </AdminShell>
  );
}
```

  `apps/admin/src/lib/nav.ts`: mục Users thành `enabled: true`, kèm comment một dòng
  "Vùng Users (P4f, ADR-0052) — chỉ Owner, Staff không thấy mục này."

- [ ] **B8.** `pnpm lint:fix`; quy trình gate. Commit:
  `feat(admin): trang Users — danh sách tài khoản cho Owner`

## Task 11 — Admin: trang `/users/[id]` (phần đọc)

**Files:**

- Modify: `apps/admin/src/lib/bookings-query.ts`, `bookings-query.spec.ts`
- Modify: `apps/admin/src/lib/users-view.ts`, `users-view.spec.ts`
- Modify: `apps/admin/src/lib/api/users.ts`
- Create: `apps/admin/src/test/user-detail.ts`
- Create: `apps/admin/src/components/users/user-detail.tsx`, `user-detail.spec.tsx`
- Create: `apps/admin/src/app/(admin)/users/[id]/page.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts`

**Interfaces:**

- Consumes: `AdminUserDetail`, `AdminUserByIdInputSchema`, `userActions`, `UserAction`
  (Task 1); `toUserRowVM`, `formatDay`, `userRoleBadgeVariant`, `userStatusBadgeVariant`,
  `usersBackHref` (Task 10); `requirePageAccess` (Task 7).
- Produces (Task 12 dùng): `bookingsSearchHref(search)`; `UserDetailVM` (có `actions`,
  `name`, `email`, `isOwner`, `sessions.count`); `toUserDetailVM(detail)`;
  `fetchAdminUser(cookie, input)`; `userDetailFixture(patch)`, `USER_ID`;
  `UserDetail({ detail, backHref })` với ba card Access, Lock, Sessions có khe `action`
  (Task 12 cắm nút vào).

- [ ] **B1. Copy.** `messages.ts`, khối `admin.users`, thêm sau `list`:

```ts
      detail: {
        back: 'Back to users',
        joinedOn: (date: string) => `Joined ${date}`,
        lockedSince: (at: string) => `Locked since ${at}`,
        // ADR-0052 §1: quyền Owner chỉ đến từ ADMIN_EMAILS trong env của server.
        owner: 'Owner access comes from the server configuration and can’t be changed here.',
        profile: {
          heading: 'Profile',
          email: 'Email',
          verified: 'Email verified',
          yes: 'Yes',
          no: 'Not yet',
          phone: 'Phone',
          signIn: 'Signs in with',
          methods: { password: 'Password', google: 'Google' },
          noMethod: 'No sign-in method',
        },
        activity: {
          heading: 'Activity',
          bookings: 'Bookings',
          reviews: 'Reviews',
          enquiries: 'Enquiries',
          viewBookings: 'View bookings',
        },
        sessions: {
          heading: 'Sessions',
          active: 'Active sessions',
          lastActive: 'Last active',
        },
        access: {
          heading: 'Staff access',
          // Đo trên ADMIN_ACCESS: 16 thủ tục chỉ Owner = hoàn tiền, huỷ chuyến, xoá tour,
          // xoá bài, xoá danh mục, xoá điểm đến, báo cáo, sổ thanh toán, vùng Users.
          customer:
            'Staff can work on bookings, reviews, enquiries, subscribers, the outbox, tours, departures, categories, destinations and posts. Only the owner can refund, cancel a departure, delete a tour or a post, or open reports, payment events and users.',
          staff: 'This account can use the back office as staff.',
          needsVerified: 'Staff access needs a verified email — this account hasn’t verified yet.',
          needsUnlock: 'Unlock the account before granting staff access.',
        },
        lock: {
          heading: 'Account lock',
          // Đo trên code: hook tạo phiên chặn đăng nhập ở cả www lẫn admin; booking, chuyến,
          // hoàn tiền và email giao dịch không đọc `locked_at`.
          unlocked:
            'Locking blocks sign-in on the website and the back office. Bookings, trips, refunds and booking emails carry on as normal.',
        },
      },
      history: {
        heading: 'History',
        empty: 'Nothing has been changed on this account yet.',
        removedActor: 'A removed account',
        actions: {
          STAFF_GRANTED: 'granted staff access',
          STAFF_REVOKED: 'revoked staff access',
          LOCKED: 'locked the account',
          UNLOCKED: 'unlocked the account',
          SESSIONS_REVOKED: 'signed this account out everywhere',
        },
        line: (actor: string, action: string) => `${actor} ${action}`,
        reason: (text: string) => `Reason: ${text}`,
      },
```

  Build i18n.

- [ ] **B2. Link sang bookings (đỏ rồi cài).** `apps/admin/src/lib/bookings-query.spec.ts`
  (thêm `bookingsSearchHref` vào import từ `./bookings-query`, `rawSearchParamsFrom` từ
  `./table-query` nếu chưa có):

```ts
describe('bookingsSearchHref (P4f, quyết định 7)', () => {
  it('lọc theo một chuỗi, MỌI ngày — và parse lại ra đúng bộ lọc ấy', () => {
    const href = bookingsSearchHref('ada@example.com');
    expect(href).toBe('/bookings?q=ada%40example.com&dates=all');

    const url = new URL(href, 'https://admin.example.com');
    const query = parseBookingsSearchParams(
      rawSearchParamsFrom(url.searchParams),
      new Date('2026-10-02T00:00:00.000Z'),
    );
    expect(query).toMatchObject({ search: 'ada@example.com', allDates: true });
    expect(query).not.toHaveProperty('from');
  });
});
```

  Đỏ. Cài ở cuối `apps/admin/src/lib/bookings-query.ts` (thêm `tableHref` vào import từ
  `./table-query` nếu file chưa import nó):

```ts
/**
 * Link sang `/bookings` lọc theo MỘT chuỗi tìm, MỌI ngày (P4f, quyết định 7) — dùng ở trang
 * chi tiết người dùng. URL trần của bảng tự lọc tháng hiện tại (`resolveDates`), nên thiếu
 * `dates=all` là giấu mọi booking cũ của người đang xem.
 */
export function bookingsSearchHref(search: string): string {
  const params = new URLSearchParams();
  appendFilters(params, { search: clampSearch(search, SEARCH_MAX_LENGTH), allDates: true });
  return tableHref('/bookings', params);
}
```

- [ ] **B3. Fixture và VM chi tiết (đỏ).** Tạo `apps/admin/src/test/user-detail.ts`:

```ts
import type { AdminUserDetail } from '@tourism/contract';

/** Một khách đã xác minh, không khoá, có booking và một phiên — patch cho từng ca. */
export const USER_ID = '11111111-1111-4111-8111-111111111111';

export function userDetailFixture(patch: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    id: USER_ID,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    image: null,
    role: 'CUSTOMER',
    status: 'active',
    createdAt: '2026-09-01T08:00:00.000Z',
    lastActiveAt: '2026-10-01T09:30:00.000Z',
    phone: null,
    emailVerified: true,
    lockedAt: null,
    lockReason: null,
    signInMethods: ['password'],
    counts: { bookings: 2, reviews: 1, enquiries: 0 },
    sessions: { active: 1, lastActiveAt: '2026-10-01T09:30:00.000Z' },
    history: [],
    ...patch,
  };
}
```

  Thêm vào `apps/admin/src/lib/users-view.spec.ts` (import `toUserDetailVM` và
  `userDetailFixture`):

```ts
describe('toUserDetailVM', () => {
  it('Profile in đủ bốn dòng; cách đăng nhập nối bằng dấu phẩy; điện thoại trống là gạch', () => {
    const vm = toUserDetailVM(userDetailFixture({ signInMethods: ['password', 'google'] }));
    expect(vm.profile).toEqual([
      { label: 'Email', value: 'ada@example.com' },
      { label: 'Email verified', value: 'Yes' },
      { label: 'Phone', value: '—' },
      { label: 'Signs in with', value: 'Password, Google' },
    ]);
    expect(vm.joined).toBe('Joined 1 Sep 2026');
  });

  it('có booking → link bookings mọi ngày; không booking → không link', () => {
    expect(toUserDetailVM(userDetailFixture()).bookingsHref).toBe(
      '/bookings?q=ada%40example.com&dates=all',
    );
    const none = userDetailFixture({ counts: { bookings: 0, reviews: 0, enquiries: 0 } });
    expect(toUserDetailVM(none).bookingsHref).toBeNull();
  });

  it('câu của card Access theo đúng lý do có hay không có nút', () => {
    const note = (patch: Parameters<typeof userDetailFixture>[0]) =>
      toUserDetailVM(userDetailFixture(patch)).accessNote;
    expect(note({})).toBe(messages.admin.users.detail.access.customer);
    expect(note({ role: 'STAFF' })).toBe(messages.admin.users.detail.access.staff);
    expect(note({ emailVerified: false, status: 'unverified' })).toBe(
      messages.admin.users.detail.access.needsVerified,
    );
    expect(note({ lockedAt: '2026-10-02T03:00:00.000Z', status: 'locked' })).toBe(
      messages.admin.users.detail.access.needsUnlock,
    );
    expect(note({ role: 'ADMIN' })).toBeNull();
  });

  it('đang khoá: từ khi nào (giờ UTC) và vì sao', () => {
    const vm = toUserDetailVM(
      userDetailFixture({
        status: 'locked',
        lockedAt: '2026-10-02T03:00:00.000Z',
        lockReason: 'Chargeback abuse',
      }),
    );
    expect(vm.lockedSince).toBe('Locked since 2 Oct 2026, 03:00 UTC');
    expect(vm.lockReason).toBe('Reason: Chargeback abuse');
    expect(vm.actions).toEqual(['unlock', 'revokeSessions']);
  });

  it('lịch sử: "ai làm gì", giờ UTC, lý do; người làm đã mất → "A removed account"', () => {
    const vm = toUserDetailVM(
      userDetailFixture({
        history: [
          {
            id: 'e2',
            type: 'LOCKED',
            note: 'Left the team',
            createdAt: '2026-10-02T03:00:00.000Z',
            actor: { name: 'Owner Olive' },
          },
          {
            id: 'e1',
            type: 'STAFF_GRANTED',
            note: null,
            createdAt: '2026-10-01T03:00:00.000Z',
            actor: null,
          },
        ],
      }),
    );
    expect(vm.history).toEqual([
      {
        id: 'e2',
        line: 'Owner Olive locked the account',
        at: '2 Oct 2026, 03:00 UTC',
        reason: 'Reason: Left the team',
      },
      {
        id: 'e1',
        line: 'A removed account granted staff access',
        at: '1 Oct 2026, 03:00 UTC',
        reason: null,
      },
    ]);
  });

  it('Owner: isOwner, không thao tác nào', () => {
    const vm = toUserDetailVM(userDetailFixture({ role: 'ADMIN' }));
    expect(vm.isOwner).toBe(true);
    expect(vm.roleLabel).toBe('Owner');
    expect(vm.actions).toEqual([]);
  });
});
```

  (Thêm `import { messages } from '@tourism/i18n';` nếu spec chưa có.) Đỏ.

- [ ] **B4. Cài VM.** Thêm vào `apps/admin/src/lib/users-view.ts` (import `AdminUserDetail`,
  `UserAction`, `userActions` từ `@tourism/contract`; `formatDateTime` cạnh
  `formatCalendarDate` từ `./bookings-view`; `bookingsSearchHref` từ `./bookings-query`):

```ts
export interface UserHistoryVM {
  id: string;
  /** "Owner Olive locked the account". */
  line: string;
  at: string;
  /** "Reason: …" — chỉ dòng có ghi chú (LOCKED). */
  reason: string | null;
}

export interface UserDetailVM {
  id: string;
  name: string;
  email: string;
  image: string | null;
  initial: string;
  role: UserRoleValue;
  roleLabel: string;
  roleVariant: BadgeVariant;
  status: UserStatusValue;
  statusLabel: string;
  statusVariant: BadgeVariant;
  /** "Joined 1 Sep 2026". */
  joined: string;
  isOwner: boolean;
  /** "Locked since 2 Oct 2026, 03:00 UTC" — null khi không khoá. */
  lockedSince: string | null;
  /** "Reason: …" — null khi không khoá hoặc không đọc được lý do. */
  lockReason: string | null;
  /** Câu của card Access — null với Owner (card ấy không render). */
  accessNote: string | null;
  profile: Array<{ label: string; value: string }>;
  activity: Array<{ label: string; value: string }>;
  /** `/bookings?q=<email>&dates=all` — null khi chưa có booking nào. */
  bookingsHref: string | null;
  sessions: { count: number; active: string; lastActive: string };
  history: UserHistoryVM[];
  /** Thao tác hợp lệ lúc này — CHÍNH hàm API hỏi trong transaction (`userActions`). */
  actions: UserAction[];
}

const d = t.detail;

function accessNote(detail: AdminUserDetail, actions: UserAction[]): string | null {
  if (detail.role === 'ADMIN') return null;
  if (detail.role === 'STAFF') return d.access.staff;
  if (actions.includes('grantStaff')) return d.access.customer;
  return detail.lockedAt ? d.access.needsUnlock : d.access.needsVerified;
}

export function toUserDetailVM(detail: AdminUserDetail): UserDetailVM {
  const row = toUserRowVM(detail, '/users');
  const actions = userActions(detail);
  return {
    id: detail.id,
    name: row.name,
    email: detail.email,
    image: detail.image,
    initial: row.initial,
    role: detail.role,
    roleLabel: row.roleLabel,
    roleVariant: userRoleBadgeVariant(detail.role),
    status: detail.status,
    statusLabel: row.statusLabel,
    statusVariant: userStatusBadgeVariant(detail.status),
    joined: d.joinedOn(row.joined),
    isOwner: detail.role === 'ADMIN',
    lockedSince: detail.lockedAt ? d.lockedSince(formatDateTime(detail.lockedAt)) : null,
    lockReason: detail.lockedAt && detail.lockReason ? t.history.reason(detail.lockReason) : null,
    accessNote: accessNote(detail, actions),
    profile: [
      { label: d.profile.email, value: detail.email },
      { label: d.profile.verified, value: detail.emailVerified ? d.profile.yes : d.profile.no },
      { label: d.profile.phone, value: detail.phone ?? EMPTY },
      {
        label: d.profile.signIn,
        value:
          detail.signInMethods.length > 0
            ? detail.signInMethods.map((method) => d.profile.methods[method]).join(', ')
            : d.profile.noMethod,
      },
    ],
    activity: [
      { label: d.activity.bookings, value: String(detail.counts.bookings) },
      { label: d.activity.reviews, value: String(detail.counts.reviews) },
      { label: d.activity.enquiries, value: String(detail.counts.enquiries) },
    ],
    bookingsHref: detail.counts.bookings > 0 ? bookingsSearchHref(detail.email) : null,
    sessions: {
      count: detail.sessions.active,
      active: String(detail.sessions.active),
      lastActive: formatDay(detail.sessions.lastActiveAt),
    },
    history: detail.history.map((event) => ({
      id: event.id,
      line: t.history.line(event.actor?.name ?? t.history.removedActor, t.history.actions[event.type]),
      at: formatDateTime(event.createdAt),
      reason: event.note ? t.history.reason(event.note) : null,
    })),
    actions,
  };
}
```

  Chạy `users-view.spec.ts` — xanh. Đột biến: bỏ nhánh `needsUnlock` (ca khoá đỏ); đổi
  `> 0` thành `>= 0` (ca không booking đỏ).

- [ ] **B5. Bọc API đọc.** Thêm vào `apps/admin/src/lib/api/users.ts` (import `isDefinedError`,
  `safe` từ `@orpc/client`; kiểu `AdminUserByIdInput`, `AdminUserDetail`):

```ts
/** Một tài khoản; `null` khi API nói NOT_FOUND (trang gọi `notFound()`). */
export async function fetchAdminUser(
  cookie: string,
  input: AdminUserByIdInput,
): Promise<AdminUserDetail | null> {
  const [error, data] = await safe(api.admin.users.byId(input, { context: withAdminAuth(cookie) }));
  if (error) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  return data;
}
```

- [ ] **B6. Component chi tiết (đỏ).** Tạo `apps/admin/src/components/users/user-detail.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { toUserDetailVM } from '@/lib/users-view';
import { userDetailFixture } from '@/test/user-detail';
import { UserDetail } from './user-detail';

const t = messages.admin.users;

function renderDetail(patch: Parameters<typeof userDetailFixture>[0] = {}) {
  return render(
    <UserDetail detail={toUserDetailVM(userDetailFixture(patch))} backHref="/users?view=staff" />,
  );
}

describe('UserDetail', () => {
  it('đầu trang và hai card đầu: tên, nút quay lại đúng danh sách, link bookings mọi ngày', () => {
    renderDetail({ signInMethods: ['password', 'google'] });
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.detail.back })).toHaveAttribute(
      'href',
      '/users?view=staff',
    );
    expect(screen.getByText('Password, Google')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.detail.activity.viewBookings })).toHaveAttribute(
      'href',
      '/bookings?q=ada%40example.com&dates=all',
    );
  });

  it('khách: ba card Access, Lock, Sessions; không có dòng của Owner', () => {
    renderDetail();
    expect(screen.getByText(t.detail.access.customer)).toBeInTheDocument();
    expect(screen.getByText(t.detail.lock.unlocked)).toBeInTheDocument();
    expect(screen.getByText(t.detail.sessions.active)).toBeInTheDocument();
    expect(screen.queryByText(t.detail.owner)).not.toBeInTheDocument();
  });

  it('Owner: chỉ dòng giải thích — không card Lock, không card Sessions', () => {
    renderDetail({ role: 'ADMIN' });
    expect(screen.getByText(t.detail.owner)).toBeInTheDocument();
    expect(screen.queryByText(t.detail.lock.unlocked)).not.toBeInTheDocument();
    expect(screen.queryByText(t.detail.sessions.active)).not.toBeInTheDocument();
  });

  it('Owner đang khoá (ca hiếm): card Lock vẫn hiện để còn đường mở', () => {
    renderDetail({ role: 'ADMIN', status: 'locked', lockedAt: '2026-10-02T03:00:00.000Z' });
    expect(screen.getByText('Locked since 2 Oct 2026, 03:00 UTC')).toBeInTheDocument();
  });

  it('đang khoá: card Lock nói từ khi nào và vì sao', () => {
    renderDetail({
      status: 'locked',
      lockedAt: '2026-10-02T03:00:00.000Z',
      lockReason: 'Chargeback abuse',
    });
    expect(screen.getByText('Locked since 2 Oct 2026, 03:00 UTC')).toBeInTheDocument();
    expect(screen.getAllByText('Reason: Chargeback abuse').length).toBeGreaterThan(0);
  });

  it('lịch sử rỗng nói câu empty', () => {
    renderDetail();
    expect(screen.getByText(t.history.empty)).toBeInTheDocument();
  });
});
```

  Đỏ.

- [ ] **B7. Cài component.** Tạo `apps/admin/src/components/users/user-detail.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@tourism/ui/components/avatar';
import { Badge } from '@tourism/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@tourism/ui/components/card';
import { ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';
import { LabelValueRow } from '@/components/kit/label-value-row';
import { Timeline, TimelineItem } from '@/components/kit/timeline';
import type { UserDetailVM } from '@/lib/users-view';

/**
 * Trang chi tiết một tài khoản (P4f, spec §7.2) — component thường: trang chỉ fetch rồi
 * truyền VM xuống (plan P4f, quyết định 16). Thứ tự khối theo dòng làm việc thật: ai đây
 * (đầu trang, Profile, Activity) → làm được gì (Access, Lock, Sessions) → đã làm gì
 * (History). Ba card giữa có khe `action` ở góc phải đầu card — chỗ của nút thao tác.
 */
const t = messages.admin.users;

export function UserDetail({ detail, backHref }: { detail: UserDetailVM; backHref: string }) {
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ChevronLeftIcon className="size-4" />
        {t.detail.back}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <Avatar className="size-10">
          {/* Ảnh trang trí — tên đứng ngay cạnh nên alt rỗng. */}
          {detail.image ? <AvatarImage src={detail.image} alt="" /> : null}
          <AvatarFallback>{detail.initial}</AvatarFallback>
        </Avatar>
        <h2 className="text-2xl font-semibold tracking-tight">{detail.name}</h2>
        <Badge variant={detail.roleVariant}>{detail.roleLabel}</Badge>
        <Badge variant={detail.statusVariant}>{detail.statusLabel}</Badge>
        <span className="text-sm text-muted-foreground">{detail.joined}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard title={t.detail.profile.heading}>
          <dl className="grid gap-2">
            {detail.profile.map((field) => (
              <LabelValueRow key={field.label} label={field.label} value={field.value} />
            ))}
          </dl>
        </DetailCard>
        <DetailCard title={t.detail.activity.heading}>
          <dl className="grid gap-2">
            {detail.activity.map((field) => (
              <LabelValueRow key={field.label} label={field.label} value={field.value} />
            ))}
          </dl>
          {detail.bookingsHref ? (
            <Link href={detail.bookingsHref} className="w-fit underline underline-offset-4">
              {t.detail.activity.viewBookings}
            </Link>
          ) : null}
        </DetailCard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {detail.isOwner ? (
          <DetailCard title={t.detail.access.heading}>
            <p className="text-muted-foreground">{t.detail.owner}</p>
          </DetailCard>
        ) : (
          <DetailCard title={t.detail.access.heading}>
            <p className="text-muted-foreground">{detail.accessNote}</p>
          </DetailCard>
        )}
        {/* Owner chỉ có card Lock khi ĐANG khoá — đường mở khoá duy nhất của ca hiếm ấy. */}
        {!detail.isOwner || detail.lockedSince ? (
          <DetailCard title={t.detail.lock.heading}>
            {detail.lockedSince ? (
              <>
                <p>{detail.lockedSince}</p>
                {detail.lockReason ? (
                  <p className="text-muted-foreground">{detail.lockReason}</p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">{t.detail.lock.unlocked}</p>
            )}
          </DetailCard>
        ) : null}
        {detail.isOwner ? null : (
          <DetailCard title={t.detail.sessions.heading}>
            <dl className="grid gap-2">
              <LabelValueRow label={t.detail.sessions.active} value={detail.sessions.active} />
              <LabelValueRow
                label={t.detail.sessions.lastActive}
                value={detail.sessions.lastActive}
              />
            </dl>
          </DetailCard>
        )}
      </div>

      <DetailCard title={t.history.heading}>
        <Timeline empty={t.history.empty}>
          {detail.history.map((event) => (
            <TimelineItem key={event.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{event.line}</span>
                <span className="text-muted-foreground">· {event.at}</span>
              </div>
              {event.reason ? <p className="text-muted-foreground">{event.reason}</p> : null}
            </TimelineItem>
          ))}
        </Timeline>
      </DetailCard>
    </div>
  );
}

/** Một card của trang: tiêu đề, khe nút ở góc phải (cùng nếp `RefundPanel`), thân chữ nhỏ. */
function DetailCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">{children}</CardContent>
    </Card>
  );
}
```

  Chạy `user-detail.spec.tsx` — xanh. Đột biến: bỏ vế `|| detail.lockedSince` (ca Owner
  đang khoá đỏ); đảo điều kiện card Sessions (ca khách và ca Owner đỏ).

- [ ] **B8. Trang.** Tạo `apps/admin/src/app/(admin)/users/[id]/page.tsx`:

```tsx
import { AdminUserByIdInputSchema } from '@tourism/contract';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { UserDetail } from '@/components/users/user-detail';
import { requirePageAccess } from '@/lib/admin-access';
import { getServerSession } from '@/lib/api/session';
import { fetchAdminUser } from '@/lib/api/users';
import type { RawSearchParams } from '@/lib/table-query';
import { usersBackHref } from '@/lib/users-query';
import { toUserDetailVM } from '@/lib/users-view';

/**
 * `/users/[id]` — một tài khoản (P4f, spec §7.2). `id` từ URL đi qua CHÍNH schema contract
 * trước khi fetch: đoạn rác là `notFound()` chứ không phải một 400 vẽ ra màn lỗi chung.
 * Chỉ Owner: chặn TRƯỚC khi gọi API (plan P4f, quyết định 13).
 *
 * Tiêu đề tab CỐ ĐỊNH, không mang tên người — tên và email là PII, không cần nằm trong lịch
 * sử duyệt web (cùng lý do `/enquiries/[id]`).
 */
export const metadata: Metadata = {
  title: 'User — Nexora back office',
};

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { id } = await params;
  const parsed = AdminUserByIdInputSchema.safeParse({ id });
  if (!parsed.success) notFound();

  const session = await getServerSession();
  if (!session) return null;
  requirePageAccess(session, 'users.byId');

  const backHref = usersBackHref((await searchParams).back);
  const cookie = (await cookies()).toString();
  const user = await fetchAdminUser(cookie, parsed.data);
  if (!user) notFound();

  return (
    <AdminShell user={session}>
      <UserDetail detail={toUserDetailVM(user)} backHref={backHref} />
    </AdminShell>
  );
}
```

- [ ] **B9.** `pnpm lint:fix`; quy trình gate. Commit:
  `feat(admin): trang chi tiết tài khoản — hồ sơ, hoạt động, phiên, lịch sử`

## Task 12 — Admin: bốn thao tác trên trang chi tiết

**Files:**

- Create: `apps/admin/src/lib/users-write.ts`, `users-write.spec.ts`
- Modify: `apps/admin/src/lib/api/users.ts`
- Create: `apps/admin/src/app/(admin)/users/[id]/actions.ts`
- Create: `apps/admin/src/components/users/user-role-action.tsx`, `user-role-action.spec.tsx`
- Create: `apps/admin/src/components/users/user-lock-action.tsx`, `user-lock-action.spec.tsx`
- Create: `apps/admin/src/components/users/user-sessions-action.tsx`, `user-sessions-action.spec.tsx`
- Modify: `apps/admin/src/components/users/user-detail.tsx`, `user-detail.spec.tsx`
- Modify: `apps/admin/src/app/(admin)/users/[id]/page.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts`

**Interfaces:**

- Consumes: `AdminUserSetRoleInput(Schema)`, `AdminUserLockInput(Schema)`,
  `AdminUserByIdInput(Schema)` (Task 1); `UserDetailVM`, `toUserDetailVM`,
  `userDetailFixture`, `USER_ID`, khe `action` của `DetailCard` (Task 11);
  `createWriteErrorCodec`, `ConfirmWriteDialog` (kit sẵn có).
- Produces: `UserDetailActions { setRole; lock; unlock; revokeSessions }` và prop
  `actions` BẮT BUỘC của `UserDetail`.

- [ ] **B1. Copy.** `messages.ts`, khối `admin.users`, thêm sau `history`. Mỗi câu hứa hệ quả
  đã đo trên code của Task 4–5 (ghi cạnh câu):

```ts
      actions: {
        cancel: 'Cancel',
        rows: { user: 'User', email: 'Email' },
        grant: {
          action: 'Grant staff access',
          dialog: {
            title: 'Grant staff access?',
            // Đo trên ADMIN_ACCESS: đúng 16 thủ tục chỉ Owner.
            body: 'They’ll be able to open the back office and work on everything except refunds, cancelling departures, deleting tours or posts, reports, payment events and users.',
            // Role đọc tươi ở mỗi request (không cookieCache) — không cần đăng nhập lại.
            warning: 'Access starts on their next page load — no new sign-in needed.',
            submit: 'Grant access',
            submitting: 'Granting…',
          },
          toast: {
            title: 'Staff access granted',
            body: (name: string) => `${name} can now use the back office.`,
          },
        },
        revoke: {
          action: 'Revoke staff access',
          dialog: {
            title: 'Revoke staff access?',
            body: 'They go back to being a customer. Their bookings and reviews stay as they are.',
            // `setRole → CUSTOMER` xoá MỌI phiên trong cùng transaction; cookie dùng chung www/admin.
            warning: 'This signs them out everywhere — on the website too.',
            submit: 'Revoke access',
            submitting: 'Revoking…',
          },
          toast: {
            title: 'Staff access revoked',
            body: (name: string) => `${name} has been signed out everywhere.`,
          },
        },
        lock: {
          action: 'Lock account',
          dialog: {
            title: 'Lock this account?',
            body: 'Their bookings, trips, refunds and booking emails carry on as normal.',
            // `lock` xoá mọi phiên; hook tạo phiên chặn mọi đường đăng nhập tới khi mở khoá.
            warning:
              'This signs them out everywhere straight away, and they can’t sign back in until the account is unlocked.',
            noteLabel: 'Reason (internal)',
            notePlaceholder: 'Why is this account being locked?',
            noteRequired: 'Write the reason — it stays in this account’s history.',
            submit: 'Lock account',
            submitting: 'Locking…',
          },
          toast: {
            title: 'Account locked',
            body: (name: string) => `${name} is signed out and can’t sign in.`,
          },
        },
        unlock: {
          action: 'Unlock account',
          dialog: {
            title: 'Unlock this account?',
            // `user_events` chỉ ghi thêm — dòng LOCKED và lý do của nó ở lại.
            body: 'The lock and its reason stay in the history.',
            warning: 'They can sign in again straight away.',
            submit: 'Unlock',
            submitting: 'Unlocking…',
          },
          toast: {
            title: 'Account unlocked',
            body: (name: string) => `${name} can sign in again.`,
          },
        },
        sessions: {
          action: 'Sign out everywhere',
          dialog: {
            title: 'Sign this account out everywhere?',
            body: 'Every device they’re signed in on loses its session.',
            warning: 'They can sign straight back in unless the account is locked.',
            submit: 'Sign out everywhere',
            submitting: 'Signing out…',
          },
          toast: {
            title: 'Signed out everywhere',
            body: (count: number) => (count === 1 ? '1 session ended.' : `${count} sessions ended.`),
          },
        },
      },
      errors: {
        NOT_FOUND: 'This account no longer exists — the page has been refreshed.',
        STATE_CHANGED: 'This account changed while you were looking — the page has been refreshed.',
      },
```

  Build i18n.

- [ ] **B2. Codec và kiểu (đỏ rồi cài).** Tạo `apps/admin/src/lib/users-write.spec.ts`:

```ts
import { contract } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  isUserWriteStale,
  USER_WRITE_CONTRACT_CODES,
  userConfirmRows,
  userWriteErrorCopy,
} from './users-write';

const t = messages.admin.users;

describe('codec lỗi của bốn lệnh ghi Users', () => {
  it('tập mã khớp errorMap của CẢ bốn thủ tục', () => {
    for (const procedure of [
      contract.admin.users.setRole,
      contract.admin.users.lock,
      contract.admin.users.unlock,
      contract.admin.users.revokeSessions,
    ]) {
      expect([...USER_WRITE_CONTRACT_CODES].sort()).toEqual(
        Object.keys(procedure['~orpc'].errorMap).sort(),
      );
    }
  });

  it('cả hai mã contract là trạng-thái-cũ; mã transport thì không', () => {
    expect(isUserWriteStale('NOT_FOUND')).toBe(true);
    expect(isUserWriteStale('STATE_CHANGED')).toBe(true);
    expect(isUserWriteStale('UNAUTHORIZED')).toBe(false);
    expect(isUserWriteStale('GENERIC')).toBe(false);
  });

  it('mỗi mã một câu; FORBIDDEN dùng câu ghi chung của admin', () => {
    expect(userWriteErrorCopy('STATE_CHANGED')).toBe(t.errors.STATE_CHANGED);
    expect(userWriteErrorCopy('FORBIDDEN')).toBe(messages.admin.errors.write.FORBIDDEN);
  });
});

describe('userConfirmRows', () => {
  it('tên rồi email — thứ phải đọc lại trước khi bấm', () => {
    expect(userConfirmRows({ name: 'Ada Lovelace', email: 'ada@example.com' })).toEqual([
      { label: t.actions.rows.user, value: 'Ada Lovelace' },
      { label: t.actions.rows.email, value: 'ada@example.com' },
    ]);
  });
});
```

  Đỏ. Tạo `apps/admin/src/lib/users-write.ts`:

```ts
import type {
  AdminUserByIdInput,
  AdminUserLockInput,
  AdminUserSetRoleInput,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';

/**
 * Logic THUẦN của bốn lệnh ghi vùng Users (P4f) — cùng khuôn `subscribers-unsubscribe.ts`:
 * codec lỗi suy từ khối i18n, hợp đồng vận chuyển của server action, dòng ngữ cảnh dialog.
 */
const t = messages.admin.users;

/**
 * CẢ HAI mã contract là trạng-thái-cũ: tài khoản biến mất, hoặc trạng thái đã đổi dưới chân
 * dialog (tab khác vừa khoá, vừa thu Staff). Đóng dialog, toast, kéo trang tươi về — bấm lại
 * tại chỗ chỉ ra 409 y như cũ.
 */
const codec = createWriteErrorCodec(t.errors, { stale: ['NOT_FOUND', 'STATE_CHANGED'] });

export const USER_WRITE_CONTRACT_CODES = codec.codes;
export type UserWriteContractCode = keyof typeof t.errors;
export type UserWriteFailureCode = UserWriteContractCode | TransportFailureCode;

export const classifyUserWriteError = codec.classify;
export const userWriteErrorCopy = codec.copy;
export const isUserWriteStale = codec.isStale;

type Failure = { ok: false; code: UserWriteFailureCode };

/** Kết quả server action — sống ở lib để tầng server không import tầng trình bày. */
export type SetUserRoleActionResult = { ok: true; role: 'CUSTOMER' | 'STAFF' } | Failure;
export type LockUserActionResult = { ok: true; lockedAt: string } | Failure;
export type UnlockUserActionResult = { ok: true } | Failure;
export type RevokeUserSessionsActionResult = { ok: true; revoked: number } | Failure;

export type SetUserRoleAction = (input: AdminUserSetRoleInput) => Promise<SetUserRoleActionResult>;
export type LockUserAction = (input: AdminUserLockInput) => Promise<LockUserActionResult>;
export type UnlockUserAction = (input: AdminUserByIdInput) => Promise<UnlockUserActionResult>;
export type RevokeUserSessionsAction = (
  input: AdminUserByIdInput,
) => Promise<RevokeUserSessionsActionResult>;

/** Bốn server action trang truyền xuống — component không tự import đường server nào. */
export interface UserDetailActions {
  setRole: SetUserRoleAction;
  lock: LockUserAction;
  unlock: UnlockUserAction;
  revokeSessions: RevokeUserSessionsAction;
}

/** Hai dòng ngữ cảnh của mọi hộp xác nhận: lệnh nào cũng nhắm ĐÚNG một người. */
export function userConfirmRows(detail: { name: string; email: string }) {
  return [
    { label: t.actions.rows.user, value: detail.name },
    { label: t.actions.rows.email, value: detail.email },
  ];
}
```

  Chạy spec — xanh.

- [ ] **B3. Bọc API ghi và server action.** Thêm vào `apps/admin/src/lib/api/users.ts`
  (kiểu tương ứng từ `@tourism/contract`):

```ts
export async function setAdminUserRole(
  cookie: string,
  input: AdminUserSetRoleInput,
): Promise<AdminUserSetRoleResult> {
  return api.admin.users.setRole(input, { context: withAdminAuth(cookie) });
}

export async function lockAdminUser(
  cookie: string,
  input: AdminUserLockInput,
): Promise<AdminUserLockResult> {
  return api.admin.users.lock(input, { context: withAdminAuth(cookie) });
}

export async function unlockAdminUser(
  cookie: string,
  input: AdminUserByIdInput,
): Promise<AdminUserUnlockResult> {
  return api.admin.users.unlock(input, { context: withAdminAuth(cookie) });
}

export async function revokeAdminUserSessions(
  cookie: string,
  input: AdminUserByIdInput,
): Promise<AdminUserRevokeSessionsResult> {
  return api.admin.users.revokeSessions(input, { context: withAdminAuth(cookie) });
}
```

  Tạo `apps/admin/src/app/(admin)/users/[id]/actions.ts`:

```ts
'use server';

import {
  type AdminUserByIdInput,
  AdminUserByIdInputSchema,
  type AdminUserLockInput,
  AdminUserLockInputSchema,
  type AdminUserSetRoleInput,
  AdminUserSetRoleInputSchema,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import {
  lockAdminUser,
  revokeAdminUserSessions,
  setAdminUserRole,
  unlockAdminUser,
} from '@/lib/api/users';
import {
  classifyUserWriteError,
  type LockUserActionResult,
  type RevokeUserSessionsActionResult,
  type SetUserRoleActionResult,
  type UnlockUserActionResult,
} from '@/lib/users-write';

/**
 * Bốn hành vi ghi của vùng Users (P4f) — cùng khuôn `enquiries/[id]/actions.ts`:
 *
 * - Quyền KHÔNG kiểm ở đây: server action là một endpoint POST mở, nên gác ở API
 *   (`@AdminImplement`, thủ tục `owner`), đọc chính cookie được forward.
 * - Input re-parse bằng CHÍNH schema contract trước khi đi → `INVALID_INPUT` thay vì GENERIC.
 * - `cookies()` NGOÀI `try`; `try` chỉ ôm đúng lời gọi API.
 * - Không `revalidatePath`: trang chi tiết là server component động; client gọi
 *   `router.refresh()` sau khi đã báo xong cho Owner (nếp kit `ConfirmWriteDialog`).
 */

export async function setUserRoleAction(
  input: AdminUserSetRoleInput,
): Promise<SetUserRoleActionResult> {
  const parsed = AdminUserSetRoleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };
  const cookie = (await cookies()).toString();
  try {
    const result = await setAdminUserRole(cookie, parsed.data);
    return { ok: true, role: result.role };
  } catch (error) {
    return { ok: false, code: classifyUserWriteError(error) };
  }
}

export async function lockUserAction(input: AdminUserLockInput): Promise<LockUserActionResult> {
  const parsed = AdminUserLockInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };
  const cookie = (await cookies()).toString();
  try {
    const result = await lockAdminUser(cookie, parsed.data);
    return { ok: true, lockedAt: result.lockedAt };
  } catch (error) {
    return { ok: false, code: classifyUserWriteError(error) };
  }
}

export async function unlockUserAction(input: AdminUserByIdInput): Promise<UnlockUserActionResult> {
  const parsed = AdminUserByIdInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };
  const cookie = (await cookies()).toString();
  try {
    await unlockAdminUser(cookie, parsed.data);
    return { ok: true };
  } catch (error) {
    return { ok: false, code: classifyUserWriteError(error) };
  }
}

export async function revokeUserSessionsAction(
  input: AdminUserByIdInput,
): Promise<RevokeUserSessionsActionResult> {
  const parsed = AdminUserByIdInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };
  const cookie = (await cookies()).toString();
  try {
    const result = await revokeAdminUserSessions(cookie, parsed.data);
    return { ok: true, revoked: result.revoked };
  } catch (error) {
    return { ok: false, code: classifyUserWriteError(error) };
  }
}
```

- [ ] **B4. Ba component thao tác — test (đỏ).** Ba spec dùng chung đầu file này (mock sonner
  và router y như `unsubscribe-action.spec.tsx`):

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toUserDetailVM } from '@/lib/users-view';
import { USER_ID, userDetailFixture } from '@/test/user-detail';

const t = messages.admin.users.actions;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh() }),
}));

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
});

const vm = (patch: Parameters<typeof userDetailFixture>[0] = {}) =>
  toUserDetailVM(userDetailFixture(patch));
```

  `apps/admin/src/components/users/user-role-action.spec.tsx` (đầu file chung, thêm
  `import { UserRoleAction } from './user-role-action';`):

```tsx
describe('UserRoleAction', () => {
  it('khách đã xác minh: Grant → setRole STAFF, toast kể tên, trang làm tươi', async () => {
    const setRole = vi.fn(async () => ({ ok: true as const, role: 'STAFF' as const }));
    const user = userEvent.setup();
    render(<UserRoleAction detail={vm()} setRole={setRole} />);

    await user.click(screen.getByRole('button', { name: t.grant.action }));
    const dialog = await screen.findByRole('dialog', { name: t.grant.dialog.title });
    expect(within(dialog).getByText('ada@example.com')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.grant.dialog.submit }));

    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(t.grant.toast.title, {
        description: t.grant.toast.body('Ada Lovelace'),
      }),
    );
    expect(setRole).toHaveBeenCalledWith({ id: USER_ID, role: 'STAFF' });
    expect(refresh).toHaveBeenCalled();
  });

  it('Staff: Revoke → setRole CUSTOMER; hộp nói rõ bị đăng xuất mọi nơi', async () => {
    const setRole = vi.fn(async () => ({ ok: true as const, role: 'CUSTOMER' as const }));
    const user = userEvent.setup();
    render(<UserRoleAction detail={vm({ role: 'STAFF' })} setRole={setRole} />);

    await user.click(screen.getByRole('button', { name: t.revoke.action }));
    const dialog = await screen.findByRole('dialog', { name: t.revoke.dialog.title });
    expect(within(dialog).getByText(t.revoke.dialog.warning)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.revoke.dialog.submit }));

    await waitFor(() => expect(setRole).toHaveBeenCalledWith({ id: USER_ID, role: 'CUSTOMER' }));
  });

  it('khách chưa xác minh hoặc đang khoá, và Owner: không có nút nào', () => {
    for (const patch of [
      { emailVerified: false, status: 'unverified' as const },
      { lockedAt: '2026-10-02T03:00:00.000Z', status: 'locked' as const },
      { role: 'ADMIN' as const },
    ]) {
      const { unmount } = render(<UserRoleAction detail={vm(patch)} setRole={vi.fn()} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('STATE_CHANGED (trạng-thái-cũ): đóng hộp, toast đúng câu, trang làm tươi', async () => {
    const setRole = vi.fn(async () => ({ ok: false as const, code: 'STATE_CHANGED' as const }));
    const user = userEvent.setup();
    render(<UserRoleAction detail={vm()} setRole={setRole} />);

    await user.click(screen.getByRole('button', { name: t.grant.action }));
    const dialog = await screen.findByRole('dialog', { name: t.grant.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.grant.dialog.submit }));

    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith(messages.admin.users.errors.STATE_CHANGED),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
```

  `apps/admin/src/components/users/user-lock-action.spec.tsx` (đầu file chung, thêm
  `import { UserLockAction } from './user-lock-action';`):

```tsx
describe('UserLockAction', () => {
  it('chưa khoá: Lock bắt buộc lý do — trống thì không gửi', async () => {
    const lock = vi.fn(async () => ({ ok: true as const, lockedAt: '2026-10-02T03:00:00.000Z' }));
    const user = userEvent.setup();
    render(<UserLockAction detail={vm()} lock={lock} unlock={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: t.lock.action }));
    const dialog = await screen.findByRole('dialog', { name: t.lock.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.lock.dialog.submit }));

    expect(await within(dialog).findByText(t.lock.dialog.noteRequired)).toBeInTheDocument();
    expect(lock).not.toHaveBeenCalled();
  });

  it('chưa khoá: có lý do → lock({ id, reason }), toast kể tên', async () => {
    const lock = vi.fn(async () => ({ ok: true as const, lockedAt: '2026-10-02T03:00:00.000Z' }));
    const user = userEvent.setup();
    render(<UserLockAction detail={vm()} lock={lock} unlock={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: t.lock.action }));
    const dialog = await screen.findByRole('dialog', { name: t.lock.dialog.title });
    await user.type(within(dialog).getByLabelText(t.lock.dialog.noteLabel), 'Chargeback abuse');
    await user.click(within(dialog).getByRole('button', { name: t.lock.dialog.submit }));

    await waitFor(() =>
      expect(lock).toHaveBeenCalledWith({ id: USER_ID, reason: 'Chargeback abuse' }),
    );
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(t.lock.toast.title, {
        description: t.lock.toast.body('Ada Lovelace'),
      }),
    );
  });

  it('đang khoá: Unlock, không ô lý do → unlock({ id })', async () => {
    const unlock = vi.fn(async () => ({ ok: true as const }));
    const user = userEvent.setup();
    render(
      <UserLockAction
        detail={vm({ lockedAt: '2026-10-02T03:00:00.000Z', status: 'locked' })}
        lock={vi.fn()}
        unlock={unlock}
      />,
    );

    expect(screen.queryByRole('button', { name: t.lock.action })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.unlock.action }));
    const dialog = await screen.findByRole('dialog', { name: t.unlock.dialog.title });
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.unlock.dialog.submit }));

    await waitFor(() => expect(unlock).toHaveBeenCalledWith({ id: USER_ID }));
  });

  it('Owner không khoá: không nút; Owner đang khoá: có nút Unlock', () => {
    const { unmount } = render(
      <UserLockAction detail={vm({ role: 'ADMIN' })} lock={vi.fn()} unlock={vi.fn()} />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    unmount();

    render(
      <UserLockAction
        detail={vm({ role: 'ADMIN', lockedAt: '2026-10-02T03:00:00.000Z', status: 'locked' })}
        lock={vi.fn()}
        unlock={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: t.unlock.action })).toBeInTheDocument();
  });
});
```

  `apps/admin/src/components/users/user-sessions-action.spec.tsx` (đầu file chung, thêm
  `import { UserSessionsAction } from './user-sessions-action';`):

```tsx
describe('UserSessionsAction', () => {
  it('có phiên: Sign out everywhere → revokeSessions({ id }), toast kể số phiên đã kết thúc', async () => {
    const revokeSessions = vi.fn(async () => ({ ok: true as const, revoked: 2 }));
    const user = userEvent.setup();
    render(<UserSessionsAction detail={vm()} revokeSessions={revokeSessions} />);

    await user.click(screen.getByRole('button', { name: t.sessions.action }));
    const dialog = await screen.findByRole('dialog', { name: t.sessions.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.sessions.dialog.submit }));

    await waitFor(() => expect(revokeSessions).toHaveBeenCalledWith({ id: USER_ID }));
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(t.sessions.toast.title, {
        description: t.sessions.toast.body(2),
      }),
    );
  });

  it('không phiên nào: nút tắt', () => {
    render(
      <UserSessionsAction
        detail={vm({ sessions: { active: 0, lastActiveAt: null } })}
        revokeSessions={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: t.sessions.action })).toBeDisabled();
  });

  it('Owner: không có nút', () => {
    render(<UserSessionsAction detail={vm({ role: 'ADMIN' })} revokeSessions={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
```

  Chạy `pnpm --filter @tourism/admin exec vitest run src/components/users/` — ba spec mới
  đỏ (chưa có module).

- [ ] **B5. Cài ba component.** Tạo `apps/admin/src/components/users/user-role-action.tsx`:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ShieldCheckIcon, ShieldOffIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import type { UserDetailVM } from '@/lib/users-view';
import {
  isUserWriteStale,
  type SetUserRoleAction,
  type UserWriteContractCode,
  userConfirmRows,
  userWriteErrorCopy,
} from '@/lib/users-write';

/**
 * Nút cấp hoặc thu Staff (P4f). Chỉ hiện khi `userActions` cho phép — khách chưa xác minh hay
 * đang khoá không có nút (card Access nói vì sao). Vòng đời lệnh ở kit `ConfirmWriteDialog`;
 * file này chỉ còn phần domain. Nhận `setRole` từ trang — test dựng với hàm giả.
 */
const t = messages.admin.users.actions;

export function UserRoleAction({
  detail,
  setRole,
}: {
  detail: UserDetailVM;
  setRole: SetUserRoleAction;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [open, setOpen] = useState(false);

  const mode = detail.actions.includes('grantStaff')
    ? 'grant'
    : detail.actions.includes('revokeStaff')
      ? 'revoke'
      : null;
  if (mode === null) return null;
  const copy = t[mode];

  return (
    <>
      <Button
        type="button"
        variant={mode === 'grant' ? 'default' : 'outline'}
        size="sm"
        disabled={isRefreshing}
        onClick={() => setOpen(true)}
      >
        {mode === 'grant' ? (
          <ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <ShieldOffIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {copy.action}
      </Button>
      {open ? (
        <ConfirmWriteDialog<UserWriteContractCode>
          copy={{ ...copy.dialog, cancel: t.cancel }}
          rows={userConfirmRows(detail)}
          submitVariant={mode === 'revoke' ? 'destructive' : 'default'}
          // Cấp quyền không lấy đi gì — câu cảnh báo của nó là câu TRẤN AN.
          warningTone={mode === 'revoke' ? 'destructive' : 'neutral'}
          onSubmit={async () => {
            const result = await setRole({
              id: detail.id,
              role: mode === 'grant' ? 'STAFF' : 'CUSTOMER',
            });
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              toast: { title: copy.toast.title, description: copy.toast.body(detail.name) },
            };
          }}
          isStale={isUserWriteStale}
          errorCopy={userWriteErrorCopy}
          onClose={() => setOpen(false)}
          onSettled={() => startRefresh(() => router.refresh())}
        />
      ) : null}
    </>
  );
}
```

  Tạo `apps/admin/src/components/users/user-lock-action.tsx`:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { LockIcon, LockOpenIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import type { UserDetailVM } from '@/lib/users-view';
import {
  isUserWriteStale,
  type LockUserAction,
  type UnlockUserAction,
  type UserWriteContractCode,
  userConfirmRows,
  userWriteErrorCopy,
} from '@/lib/users-write';

/**
 * Khoá hoặc mở khoá (P4f, ADR-0052 §4). Khoá bắt buộc lý do — ô ghi chú của kit với
 * `noteRequired`, trần 500 của kit đúng bằng `USER_LOCK_REASON_MAX` (plan P4f, quyết định 8).
 * Owner chỉ có nút khi đang khoá — `userActions` quyết.
 */
const t = messages.admin.users.actions;

export function UserLockAction({
  detail,
  lock,
  unlock,
}: {
  detail: UserDetailVM;
  lock: LockUserAction;
  unlock: UnlockUserAction;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [open, setOpen] = useState(false);

  const mode = detail.actions.includes('lock')
    ? 'lock'
    : detail.actions.includes('unlock')
      ? 'unlock'
      : null;
  if (mode === null) return null;

  const shared = {
    rows: userConfirmRows(detail),
    isStale: isUserWriteStale,
    errorCopy: userWriteErrorCopy,
    onClose: () => setOpen(false),
    onSettled: () => startRefresh(() => router.refresh()),
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isRefreshing}
        onClick={() => setOpen(true)}
      >
        {mode === 'lock' ? (
          <LockIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <LockOpenIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {t[mode].action}
      </Button>
      {open && mode === 'lock' ? (
        <ConfirmWriteDialog<UserWriteContractCode>
          {...shared}
          copy={{ ...t.lock.dialog, cancel: t.cancel }}
          noteId={`user-lock-${detail.id}`}
          noteRequired={t.lock.dialog.noteRequired}
          submitVariant="destructive"
          onSubmit={async (reason) => {
            const result = await lock({ id: detail.id, reason });
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              toast: { title: t.lock.toast.title, description: t.lock.toast.body(detail.name) },
            };
          }}
        />
      ) : null}
      {open && mode === 'unlock' ? (
        <ConfirmWriteDialog<UserWriteContractCode>
          {...shared}
          copy={{ ...t.unlock.dialog, cancel: t.cancel }}
          warningTone="neutral"
          onSubmit={async () => {
            const result = await unlock({ id: detail.id });
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              toast: {
                title: t.unlock.toast.title,
                description: t.unlock.toast.body(detail.name),
              },
            };
          }}
        />
      ) : null}
    </>
  );
}
```

  Tạo `apps/admin/src/components/users/user-sessions-action.tsx`:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { LogOutIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmWriteDialog } from '@/components/kit/confirm-write-dialog';
import type { UserDetailVM } from '@/lib/users-view';
import {
  isUserWriteStale,
  type RevokeUserSessionsAction,
  type UserWriteContractCode,
  userConfirmRows,
  userWriteErrorCopy,
} from '@/lib/users-write';

/**
 * Đăng xuất mọi nơi (P4f). API nhận cả lúc 0 phiên (`revoked: 0`), nhưng nút tắt khi không
 * còn phiên nào sống — bấm một lệnh không làm gì chỉ để lại một dòng lịch sử vô nghĩa.
 */
const t = messages.admin.users.actions.sessions;

export function UserSessionsAction({
  detail,
  revokeSessions,
}: {
  detail: UserDetailVM;
  revokeSessions: RevokeUserSessionsAction;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [open, setOpen] = useState(false);

  if (!detail.actions.includes('revokeSessions')) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isRefreshing || detail.sessions.count === 0}
        onClick={() => setOpen(true)}
      >
        <LogOutIcon data-icon="inline-start" aria-hidden="true" />
        {t.action}
      </Button>
      {open ? (
        <ConfirmWriteDialog<UserWriteContractCode>
          copy={{ ...t.dialog, cancel: messages.admin.users.actions.cancel }}
          rows={userConfirmRows(detail)}
          warningTone="neutral"
          onSubmit={async () => {
            const result = await revokeSessions({ id: detail.id });
            if (!result.ok) return { ok: false, code: result.code };
            return {
              ok: true,
              toast: { title: t.toast.title, description: t.toast.body(result.revoked) },
            };
          }}
          isStale={isUserWriteStale}
          errorCopy={userWriteErrorCopy}
          onClose={() => setOpen(false)}
          onSettled={() => startRefresh(() => router.refresh())}
        />
      ) : null}
    </>
  );
}
```

  Chạy lại lệnh B4 — xanh. Đột biến: cho `UserRoleAction` gửi `role: 'STAFF'` ở cả hai
  nhánh (ca Revoke đỏ); bỏ `noteRequired` ở hộp khoá (ca "trống thì không gửi" đỏ); bỏ vế
  `detail.sessions.count === 0` (ca nút tắt đỏ).

  Nếu typecheck kêu ở `{...shared}` vì union props của kit (nhánh có/không `noteId`), viết
  bốn prop dùng chung trực tiếp ở mỗi nhánh thay vì spread — giữ nguyên giá trị.

- [ ] **B6. Cắm vào trang (đỏ rồi cài).** `apps/admin/src/components/users/user-detail.spec.tsx`:
  `renderDetail` truyền thêm `actions` giả, và thêm một ca:

```tsx
const ACTIONS = {
  setRole: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
  revokeSessions: vi.fn(),
};

function renderDetail(patch: Parameters<typeof userDetailFixture>[0] = {}) {
  return render(
    <UserDetail
      detail={toUserDetailVM(userDetailFixture(patch))}
      backHref="/users?view=staff"
      actions={ACTIONS}
    />,
  );
}
```

```tsx
  it('khách: ba nút nằm đúng ba card — Grant, Lock, Sign out everywhere', () => {
    renderDetail();
    const a = messages.admin.users.actions;
    expect(screen.getByRole('button', { name: a.grant.action })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: a.lock.action })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: a.sessions.action })).toBeInTheDocument();
  });
```

  (thêm `vi` vào import từ `vitest`, và mock `next/navigation` với
  `useRouter: () => ({ refresh: vi.fn() })` ở đầu file vì ba nút gọi router.) Đỏ. Cài:
  - `user-detail.tsx`: prop mới `actions: UserDetailActions` (import kiểu từ
    `@/lib/users-write`), import ba component; truyền vào khe `action` của ba card:
    card Access (nhánh không phải Owner) `action={<UserRoleAction detail={detail} setRole={actions.setRole} />}`;
    card Lock `action={<UserLockAction detail={detail} lock={actions.lock} unlock={actions.unlock} />}`;
    card Sessions `action={<UserSessionsAction detail={detail} revokeSessions={actions.revokeSessions} />}`.
    Comment JSDoc của component thêm câu: "Ba nút nhận server action qua `actions` — component
    không tự import đường server nào."
  - `page.tsx`: import bốn action từ `./actions` và truyền
    `actions={{ setRole: setUserRoleAction, lock: lockUserAction, unlock: unlockUserAction, revokeSessions: revokeUserSessionsAction }}`.

  Chạy lại `src/components/users/` — xanh.

- [ ] **B7.** `pnpm lint:fix`; quy trình gate. Commit:
  `feat(admin): cấp và thu Staff, khoá và mở khoá, đăng xuất mọi nơi trên trang tài khoản`

## Task 13 — Soi bố cục bằng CSS build thật

jsdom không có bố cục (bài học 5). Cách làm của P4e-4 Task 13: DOM của CHÍNH các component,
đổ ra trang tĩnh, nối với CSS mà `next build` của admin vừa sinh, rồi đo bằng trình duyệt ở
hai khổ. Không commit gì — trừ khi phải sửa lỗi bố cục tìm ra.

**Files (tạm, xoá ở B6):**

- Create: `apps/admin/src/components/__layout-check__/render.spec.tsx`
- Output: `apps/admin/.next/layout-check/*.html` (`.next/` đã nằm trong `.gitignore`)

- [ ] **B1.** Build admin (đã có nếu vừa chạy gate):
  `pnpm turbo run build --filter=@tourism/admin --output-logs=errors-only`.
  `ls apps/admin/.next/static/chunks/*.css` phải ra ít nhất hai file.

- [ ] **B2.** Tạo spec tạm `render.spec.tsx`:

```tsx
// TẠM — soi bố cục P4f bằng CSS build thật (plan P4f, Task 13). KHÔNG commit.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { SidebarInset, SidebarProvider } from '@tourism/ui/components/sidebar';
import type * as React from 'react';
import { describe, it, vi } from 'vitest';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { UserDetail } from '@/components/users/user-detail';
import { UsersTable } from '@/components/users/users-table';
import { toUserDetailVM, type UserRowVM } from '@/lib/users-view';
import { userDetailFixture } from '@/test/user-detail';

vi.mock('next/navigation', () => ({
  usePathname: () => '/users',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut: vi.fn() } }));

// cwd của vitest là apps/admin.
const CHUNKS = '.next/static/chunks';
const CSS = readdirSync(CHUNKS).filter((name) => name.endsWith('.css'));
const FONT_CLASSES = [
  ...new Set(
    CSS.flatMap((name) =>
      [...readFileSync(`${CHUNKS}/${name}`, 'utf8').matchAll(/\.([\w-]+__variable)\b/g)].map(
        (match) => match[1],
      ),
    ),
  ),
];
const OUT = '.next/layout-check';
mkdirSync(OUT, { recursive: true });

const OWNER = {
  id: 'u-1',
  name: 'Owner Nexora',
  email: 'owner@nexora-travel.agency',
  role: 'ADMIN',
  image: null,
};
const noop = vi.fn();
const ACTIONS = { setRole: noop, lock: noop, unlock: noop, revokeSessions: noop };

/** Tên và email dài, khoá kèm lý do dài, ba dòng lịch sử — bày đủ thứ dễ tràn. */
const LOCKED = toUserDetailVM(
  userDetailFixture({
    name: 'Maximilian Alexander von Habsburg-Lothringen',
    email: 'maximilian.alexander.von.habsburg.lothringen@example-travel-agency.com',
    role: 'STAFF',
    status: 'locked',
    lockedAt: '2026-10-02T03:00:00.000Z',
    lockReason:
      'Shared the back-office password with an outside contractor; locked until the owner talks to them in person next week.',
    signInMethods: ['password', 'google'],
    history: [
      {
        id: 'e3',
        type: 'LOCKED',
        note: 'Shared the back-office password with an outside contractor.',
        createdAt: '2026-10-02T03:00:00.000Z',
        actor: { name: 'Owner Nexora' },
      },
      {
        id: 'e2',
        type: 'SESSIONS_REVOKED',
        note: null,
        createdAt: '2026-10-01T03:00:00.000Z',
        actor: { name: 'Owner Nexora' },
      },
      {
        id: 'e1',
        type: 'STAFF_GRANTED',
        note: null,
        createdAt: '2026-09-20T03:00:00.000Z',
        actor: null,
      },
    ],
  }),
);

const row = (n: number, patch: Partial<UserRowVM>): UserRowVM => ({
  id: `row-${n}`,
  name: LOCKED.name,
  email: LOCKED.email,
  image: null,
  initial: 'M',
  href: `/users/row-${n}`,
  role: 'CUSTOMER',
  roleLabel: 'Customer',
  status: 'active',
  statusLabel: 'Active',
  joined: '1 Sep 2026',
  lastActive: '1 Oct 2026',
  ...patch,
});

/**
 * Đúng cây của `AdminShell` — chép tay vì `AdminShell` là async server component (đọc cookie
 * sidebar), Testing Library không render được trong jsdom. File tạm, không commit.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={OWNER} />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">{children}</div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function page(name: string, body: React.ReactNode) {
  render(
    <div data-admin-surface style={{ display: 'contents' }}>
      <Shell>{body}</Shell>
    </div>,
  );
  const links = CSS.map((file) => `<link rel="stylesheet" href="/static/chunks/${file}">`).join('');
  writeFileSync(
    `${OUT}/${name}.html`,
    `<!doctype html><html lang="en" class="${FONT_CLASSES.join(' ')} h-full antialiased"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${links}</head><body class="min-h-full bg-background text-foreground">${document.body.innerHTML}</body></html>`,
  );
}

describe('layout-check', () => {
  it('users-list', () =>
    page(
      'users-list',
      <UsersTable
        rows={[
          row(1, { role: 'ADMIN', roleLabel: 'Owner' }),
          row(2, { role: 'STAFF', roleLabel: 'Staff', status: 'locked', statusLabel: 'Locked' }),
          row(3, { status: 'unverified', statusLabel: 'Unverified', lastActive: '—' }),
        ]}
        query={{ page: 1, limit: 20 }}
        total={3}
        totalPages={1}
      />,
    ));
  it('user-detail', () =>
    page('user-detail', <UserDetail detail={LOCKED} backHref="/users" actions={ACTIONS} />));
});
```

  Trước khi chạy, mở `apps/admin/src/components/admin-shell.tsx` và so cây trong `Shell` với
  nó — khác chỗ nào thì chép theo file thật (file tạm này phải soi đúng bố cục đang chạy).

  Chạy: `pnpm --filter @tourism/admin exec vitest run src/components/__layout-check__/render.spec.tsx`
  — hai ca xanh, hai file trong `apps/admin/.next/layout-check/`.

- [ ] **B3.** Mở máy chủ tĩnh ở nền (Git Bash, từ gốc repo):
  `python -m http.server 8766 --directory apps/admin/.next` — rồi mở
  `http://localhost:8766/layout-check/user-detail.html` trong Browser pane (`preview_start`
  với `url`). Chữ phải ra đúng font của admin; không có thì B2 thiếu file CSS font.

- [ ] **B4. Đo ở 1600px.** `resize_window` 1600×1000. Ở `user-detail.html` chạy bằng
  `javascript_tool`:

```js
(() => {
  const cards = [...document.querySelectorAll('[data-slot="card"]')];
  const top = (el) => Math.round(el.getBoundingClientRect().top);
  const titles = cards.map((card) => card.querySelector('[data-slot="card-title"]')?.textContent);
  const at = (title) => cards[titles.indexOf(title)];
  return {
    viewport: innerWidth,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    profileActivitySameRow: top(at('Profile')) === top(at('Activity')),
    threeCardsSameRow: new Set(['Staff access', 'Account lock', 'Sessions'].map((t) => top(at(t)))).size === 1,
    widestCardOverflow: Math.max(...cards.map((card) => card.scrollWidth - card.clientWidth)),
  };
})()
```

  Đạt khi: `overflowX` 0, hai cờ `…SameRow` true, `widestCardOverflow` 0 (email và lý do
  dài phải xuống dòng, không đẩy card). Ở `users-list.html` chỉ đo
  `document.documentElement.scrollWidth - innerWidth` — phải 0 (bảng tự cuộn trong khung
  của kit). Chụp một ảnh màn trang chi tiết để ghi vào bàn giao.

- [ ] **B5. Đo ở 390px.** `resize_window` 390×844, chạy lại đoạn đo cho trang chi tiết. Đạt
  khi: `overflowX` 0, `threeCardsSameRow` false (ba card xếp chồng), `widestCardOverflow` 0.
  Ở `users-list.html`: `overflowX` 0. Trả khổ về `desktop` khi xong.

- [ ] **B6. Dọn.** Tắt máy chủ tĩnh (PowerShell):
  `Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`;
  xoá `apps/admin/src/components/__layout-check__/` và `apps/admin/.next/layout-check/`.
  `git status` phải sạch.

- [ ] **B7.** Có phép đo trượt: sửa đúng chỗ (TDD nếu sửa logic), gate, commit
  `fix(admin): …` mô tả lỗi bố cục; rồi đo lại. Ghi mọi số đo (cả lần trượt) vào bàn giao.

## Task 14 — Gate cuối, docs, bàn giao

**Files:**

- Modify: `docs/handoff/mobile-auth-handoff.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/open-items.md`

- [ ] **B1.** `git log --oneline main..HEAD` — mười hai commit của Task 1–12 (cộng commit
  `fix` của Task 13 nếu có), không commit lạ. `git diff --stat main..HEAD` không chạm file
  nào ngoài "Bản đồ file" và 13 controller của Task 3.
- [ ] **B2.** Các phép grep phải rỗng:
  `grep -rn "@Implement(contract.admin" apps/api/src` ·
  `grep -rn "role !== 'ADMIN'\|role === 'ADMIN'" apps/admin/src --include=*.ts --include=*.tsx`
  (trừ file spec) · `grep -rn "UserRole.ADMIN && isAdminSurface" apps/api/src`.
  Quy trình gate trên đỉnh nhánh; ghi số test từng gói (Vitest) và số int (ca, file).
- [ ] **B3. Ghi chú cho mobile.** `docs/handoff/mobile-auth-handoff.md`, mục 2 ("Bảy method
  sang lệnh Better Auth"), ngay sau luật 3 của "Ba luật bắt buộc khi viết bản thật", thêm
  đoạn (dòng mới, cùng thụt lề với các luật):

```markdown
Từ P4f (ADR-0052) có thêm một mã: tài khoản bị Owner khoá thì MỌI đường đăng nhập trả 403
kèm `code: 'ACCOUNT_LOCKED'`. Luật 1 đã phủ nó — `mapAuthError` trả khoá `accountLocked`, câu
ở `messages.authForms.errors.accountLocked`. Riêng `signInWithGoogle`: Better Auth đổi lỗi
này thành redirect tới `errorCallbackURL?error=ACCOUNT_LOCKED`, nên bản thật phải truyền
`errorCallbackURL` (deep link của app) và đọc `error` từ URL quay về, như web đã làm.
```

  `git diff docs/handoff/mobile-auth-handoff.md` chỉ được có phần thêm.
- [ ] **B4. Entry CHANGELOG** — chèn ngay dưới khối `> **File này chỉ giữ đợt đang chạy**…`,
  TRÊN entry mới nhất. Ngày là ngày chạy bước này. Khuôn:

```markdown
## 2026-MM-DD — P4f vùng Users: Owner và Staff (nhánh `feat/p4f-users-staff`)

Admin có hai bậc: Owner (role `ADMIN`, chỉ từ `ADMIN_EMAILS`) và Staff (role `STAFF`, Owner
cấp cho khách đã xác minh). Bảng quyền `ADMIN_ACCESS` ở contract quyết 64 thủ tục admin —
Staff dùng 48, 16 là của riêng Owner. Owner có `/users`: danh sách, chi tiết, cấp/thu Staff,
khoá/mở khoá, đăng xuất mọi nơi, lịch sử theo người. Quyết định ở ADR-0052, hợp đồng ở spec
02/10. Một migration chỉ thêm (`STAFF`, `locked_at`, `user_events`); không env.

(Một đoạn cho API: `@AdminImplement`, test quét quyền, hook khoá, sáu route. Một đoạn cho
web: câu báo khoá, `errorCallbackURL`. Một đoạn cho admin: cổng, provider, sidebar, bốn nút,
hai trang. Một đoạn chỗ lệch plan nếu có, kèm lý do; một đoạn số đo Task 13.)

**CÒN TREO cho session gốc:** chạy migration `p4f_users_staff` lên Supabase TRƯỚC khi push
(luật 15); không có việc hạ tầng nào khác.

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **N** (web …, api …, admin …, contract …, core …, ui …, tokens …,
i18n …), int **N ở N file**. Liệt kê số ca mới theo gói và các đột biến đã thử.
```

  Không để dòng nào bắt đầu bằng `+`; tổng số test gói trọn trong một dòng hoặc nối bằng chữ
  "và". `git diff docs/CHANGELOG.md` phải chỉ có phần thêm.
- [ ] **B5. `docs/open-items.md`:** ô ghi chú của dòng **P4f**: thay đoạn bắt đầu bằng
  "**Users**: ADR-0052 và spec 02/10" và kết thúc bằng "thi công sau khi P4e-4 merge." bằng
  "**Users** xong trên nhánh `feat/p4f-users-staff`, chờ review (ADR-0052, spec và plan
  02/10)." — giữ nguyên phần còn lại của ô (câu ADR-0026 AMEND 1 §D và câu Media library).
  `git diff docs/open-items.md` trước khi stage.
- [ ] **B6.** `./scripts/docs-freshness.sh` (Git Bash) — xanh.
- [ ] **B7. Commit:** `docs: entry CHANGELOG cho P4f vùng Users`
- [ ] **B8.** Tắt API (lệnh PowerShell ở Quy trình gate), xoá `/tmp/p4f-api.log`. Không còn
  tiến trình nào nghe cổng 3001 hay 8766. Xoá `apps/*/.turbo`, `.turbo` gốc và `apps/*/.next`
  nếu còn; báo dung lượng ổ C trước và sau.
- [ ] **B9. Bàn giao** — KHÔNG merge. Báo cho session gốc: danh sách commit · kết quả gate
  (số test từng gói, int) · đột biến đã thử và kết quả (kể cả cái không giết được, kèm lý
  do) · số đo Task 13 ở hai khổ · chỗ lệch plan và vì sao · việc cần hạ tầng (đúng một:
  migration lên Supabase).

## Sau khi bàn giao — việc của session gốc

1. Review nhánh ở mức max effort, vá TRỌN phát hiện trên chính nhánh này (nếp F14–F19, P4e-4).
   Đọc kỹ: mọi handler admin là `@AdminImplement` và lưới `@Roles(ADMIN)` cấp class còn đủ
   14 controller; `claim` khoá hàng TRƯỚC khi hỏi `userActions`; `lock` và
   `setRole → CUSTOMER` xoá phiên trong CÙNG transaction; hook tạo phiên và vế `lockedAt`
   của guard; tầng ghi của Staff; mặc định của `useCanAccess`; ba trang chỉ Owner chặn trước
   khi fetch; copy hứa hệ quả (bài học 9).
2. Hỏi user trước khi merge; rebase lên `main`, `git merge --ff-only`.
3. **Migration lên Supabase TRƯỚC khi push** (chỉ thêm — code cũ chạy được trên schema
   mới): từ `apps/api` bằng Git Bash,
   `export DATABASE_URL="$(grep '^DATABASE_URL=' .env.production | cut -d= -f2- | tr -d '\r')" && pnpm prisma migrate deploy`,
   rồi SQL chỉ-đọc xác nhận `user_events` có RLS và `UserRole` có `STAFF`. Hỏi user trước
   lệnh deploy migration.
4. Push bằng SHA đích danh; `gh run list --branch main --limit 1` phải xanh. Kiểm Render
   bằng MCP (`list_deploys` của service `srv-da36lvgu01pc7381cv10`), không bằng uptime; thấy
   `update_failed` kiểu EMAXCONNSESSION (G23) thì hỏi user trước khi kích deploy lại. Vercel
   đưa admin lên TRƯỚC Render — trong khe ấy `/users` ra trang lỗi.
5. Entry CHANGELOG ngày merge; dòng roadmap trong `CLAUDE.md` (P4f Users ✅) và
   `docs/open-items.md`.
6. Thử tay trên production theo spec §8.4, TỪNG BƯỚC, chờ user xác nhận mỗi bước. Cần một
   tài khoản khách THẬT thứ hai mà user giữ hộp thư (đăng ký trên www, xác minh OTP) — khách
   seed không đăng nhập được. Session gốc kiểm DB bằng SQL chỉ-đọc (`users.role`,
   `users.locked_at`, `sessions`, `user_events`) và log Render khi cần.
7. Sau thử tay: tài khoản thử về CUSTOMER và không khoá (bằng chính màn `/users`); các dòng
   `user_events` của lượt thử ở lại — lượt seed lại ~03/11 xoá chúng theo tài khoản (script
   reset giữ đúng một admin). Ghi vào bản nhớ "dữ liệu thử tay còn sót".

---

## Prompt bàn giao cho session thi công P4f

Dán nguyên khối dưới đây vào một session Claude Code MỚI mở tại
`C:\Programming\Devs\Projects\Tourism-Platform-V2`.

```text
Bạn là session THI CÔNG của tourism-v2, làm việc NGAY TRONG checkout gốc
C:\Programming\Devs\Projects\Tourism-Platform-V2 (không tạo worktree). Đọc
theo thứ tự:
  CLAUDE.md                                                (15 luật + gotcha)
  docs/README.md                                           (bản đồ tài liệu)
  docs/adr/0052-admin-staff-tier.md                        (quyết định)
  docs/specs/2026-10-02-p4f-users-staff-design.md          (spec — HỢP ĐỒNG)
  docs/plans/2026-10-02-p4f-users-staff.md                 (plan — làm theo)

VIỆC: tính năng P4f — vùng Users: hai bậc Owner (ADMIN, chỉ từ ADMIN_EMAILS) và
Staff (STAFF, Owner cấp); bảng quyền ADMIN_ACCESS ở contract áp cho MỌI thủ tục
admin qua @AdminImplement; khoá tài khoản chặn mọi đường đăng nhập; trang /users
và /users/[id] với cấp/thu Staff, khoá/mở khoá, đăng xuất mọi nơi, lịch sử.
Làm Task 1 → 14 đúng thứ tự, mỗi task một commit (Task 13 chỉ commit khi phải sửa
lỗi bố cục). Không làm gì ngoài plan; thấy plan sai hay mâu thuẫn spec thì DỪNG
và hỏi tôi.

TRƯỚC DÒNG CODE ĐẦU TIÊN: đọc "Điều kiện bắt đầu", cả 19 mục "Quyết định của plan"
và các bài học ở đầu plan. P4f chạm đăng nhập, phiên và quyền của mọi thủ tục admin.

MỞ ĐẦU
- P4e-4 PHẢI đã merge vào main (xem "Điều kiện bắt đầu" — có số đếm để kiểm).
- `git status` phải sạch và đang ở `main`.
- `git log --oneline -5 main` phải thấy commit "docs: plan thi công P4f…" và commit
  ADR-0052 + spec. Rồi: git checkout -b feat/p4f-users-staff
- Docker Postgres phải đang chạy (`docker ps`) — migration và int test cần nó.

LUẬT BẤT DI BẤT DỊCH CỦA SESSION NÀY
- KHÔNG merge, KHÔNG push, KHÔNG rebase, KHÔNG dùng subagent.
- KHÔNG chạm hạ tầng sống (CLAUDE.md §15): không Supabase (kể cả migration — đó là
  việc của tôi sau review), Cloudinary, webhook, env hay redeploy Render/Vercel.
- Migration CHỈ trên Postgres Docker; viết header + dòng RLS TRƯỚC khi apply; đã
  apply mà cần sửa thì DỪNG và hỏi — không sửa migration.sql đã chạy.
- KHÔNG sửa apps/mobile, seed/fixture, migration cũ, component của libs/shared/ui.
  Ngoài "Bản đồ file" chỉ được chạm 13 controller admin ở Task 3. Thấy mình sắp cần
  sửa chỗ khác thì DỪNG và hỏi tôi.
- TDD (luật 4): test đỏ đúng lý do trước, rồi mới cài. Ca test mới nào cũng phải kiểm
  bằng đột biến — làm thật (sửa code cho sai, thấy đỏ, trả lại), ghi kết quả, kể cả
  đột biến không giết được và vì sao.
- Gate cuối mỗi task theo mục "Quy trình gate" của plan: liếc commit memory trước, chạy
  tách bước, hãm song song, cần API sống cho build web; xong thì tắt API bằng lệnh
  PowerShell trong plan.
- Comment code TIẾNG VIỆT (luật 8); copy người dùng thấy bằng TIẾNG ANH trong
  @tourism/i18n (luật 7). Tokens-only, không hex (luật 6).
- Commit Conventional Commits, message TIẾNG VIỆT CÓ DẤU, KHÔNG AI attribution —
  không dòng Co-Authored-By (luật 12). Stage theo đường dẫn tường minh, không
  `git add -A`. Chạy `pnpm lint:fix` trước khi stage.
- Contract, core và i18n được đọc từ dist: sửa xong phải build lại trước khi test gói
  khác (lệnh ở Ràng buộc toàn cục của plan).
- Rà docs/skills.md trước khi bắt tay (luật 9).

TÁM CHỖ DỄ SAI (plan có đủ chi tiết)
1. Quyền chỉ đọc từ bảng: MỌI handler admin là @AdminImplement; lưới @Roles(ADMIN)
   cấp class ở cả 14 controller KHÔNG được gỡ (Task 3, 5).
2. Test quét quyền phải ĐỎ ở ca Staff TRƯỚC khi đổi controller — đỏ đúng lý do mới
   đi tiếp (Task 3 B3).
3. Một transaction mỗi thao tác: SELECT … FOR UPDATE → userActions → ghi → xoá phiên
   → đúng một dòng user_events (Task 5, quyết định 2).
4. "Phiên bị xoá" kiểm bằng ĐẾM hàng sessions, không chỉ gọi thử: vế lockedAt của
   AuthGuard cũng trả 401 (Task 5).
5. Hook session.create.before ném APIError('FORBIDDEN', { code: 'ACCOUNT_LOCKED' });
   lockedAt phải nằm trong additionalFields để get-session mang nó (Task 4).
6. useCanAccess không có provider → true (quyết định 3); ca Staff bọc
   withRole('STAFF') (Task 7, 9).
7. Trang chỉ Owner: lấy phiên → requirePageAccess → rồi mới fetch; không Promise.all
   với lượt fetch sẽ 403 (Task 7, 10, 11; quyết định 13).
8. Form admin không qua mapAuthError — nhánh ACCOUNT_LOCKED riêng (quyết định 4); web
   gửi errorCallbackURL về /login và đọc ?error= (Task 6).

BÀN GIAO KHI XONG
Không merge. Viết cho tôi: danh sách commit; kết quả gate (số test từng gói, số int);
đột biến đã thử và kết quả; số đo bố cục của Task 13 ở 1600px và 390px; chỗ lệch plan
và vì sao; việc cần hạ tầng (đúng một: migration lên Supabase).
```
