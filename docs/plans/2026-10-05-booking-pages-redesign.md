# Plan thi công P7 — Thiết kế lại ba trang đơn của khách

> **Cho agent thi công:** làm tuần tự từng task bằng skill
> `superpowers:subagent-driven-development` (khuyên dùng) hoặc `superpowers:executing-plans`.
> Bước dùng checkbox `- [ ]`. Ba phần A, B, C merge vào `main` lần lượt; hết một phần thì
> DỪNG, báo session gốc review và merge, rồi mới sang phần sau.

**Mục tiêu:** khách có trang My bookings tìm và lọc được, 10 đơn mỗi trang, phân trang
"Newer / Older trips"; trang chi tiết đơn có vé kiểu boarding pass, thanh hành trình có mốc
"Today", cột phải đổi theo giai đoạn (đếm ngược và chuẩn bị, ngày trong chuyến, review, hoàn
tiền); voucher là thẻ chia đôi mảng teal, phân biệt vừa trả tiền với mở lại.

**Kiến trúc (ADR-0054):** contract khai MỘT luật giai đoạn đơn (`bookingPhase`) mà API và web
cùng gọi. `bookings.mine` đọc tập khoá nhẹ của mọi đơn của khách, gắn giai đoạn, lọc, đếm,
xếp theo hành trình rồi mới nạp đủ dữ liệu cho 10 dòng của trang — không đổi DB. Web dựng ba
trang từ các hàm thuần có test (`journeyMilestones`, `getReadySteps`, `voucherView`,
tham số URL, phân trang) và các component nhỏ một việc.

**Stack:** NestJS 11 + Prisma 7 + oRPC (API) · Next.js 16 + React 19 + Base UI (web) ·
Tailwind v4 · Vitest + Testing Library.

**Spec:** [2026-10-05-booking-pages-redesign-design.md](../specs/2026-10-05-booking-pages-redesign-design.md)
— HỢP ĐỒNG của việc này; plan chỉ nói cách làm. Chỗ plan chốt khác chữ của spec nằm ở
"Quyết định của plan"; spec đã sửa cho khớp trong cùng commit với plan này.
**ADR:** [0054](../adr/0054-customer-bookings-list-phase-filters.md) · nền:
[0041](../adr/0041-single-cancellation-deadline.md) ·
[0016](../adr/0016-web-data-layer.md)
**Bản vẽ đã duyệt:** [booking-list](../design/mockups/booking-list.src.html) ·
[booking-detail](../design/mockups/booking-detail.src.html) ·
[booking-voucher](../design/mockups/booking-voucher.src.html)

| Phần | Nội dung | Nhánh | Task |
| --- | --- | --- | --- |
| **A** | Luật giai đoạn, `bookings.mine`, nút quay lại ở hero, trang My bookings, helper dòng tiền và tên cổng | `feat/booking-pages-redesign` | 1–12 (A1–A12) |
| **B** | Trang chi tiết đơn | cùng nhánh, sau khi A đã merge | 13–21 (B1–B8) |
| **C** | Voucher | cùng nhánh, sau khi A đã merge | 22–26 (C1–C5) |

## Điều kiện bắt đầu

- Làm trong **worktree** `.claude/worktrees/booking-pages-redesign` (nhánh
  `feat/booking-pages-redesign`). Checkout gốc đang dùng cho đợt sửa admin
  (`fix/admin-ui-polish`) — KHÔNG `git checkout` ở đó.
- `git log --oneline -3` phải thấy commit plan này và `d0f067ad` (ADR-0054 + spec + bản vẽ).
  `git status` sạch.
- Worktree mới chưa có `node_modules` và `.env.local`:
  - `pnpm install --frozen-lockfile` (khoảng 35 giây nhờ pnpm store);
  - chép env DEV (trỏ localhost) từ checkout gốc, KHÔNG bao giờ chép `.env.production`:
    ```bash
    for app in api web admin; do cp /c/Programming/Devs/Projects/Tourism-Platform-V2/apps/$app/.env.local apps/$app/.env.local; done
    ```
- Docker Postgres chạy (`docker ps`; tắt thì mở Docker Desktop rồi
  `docker start tourism-v2-postgres-1`).
- Không migration nào. Thấy mình sắp cần sửa `apps/api/prisma/` thì DỪNG và hỏi.
- Phần B và C chỉ bắt đầu khi `main` đã có Phần A: `git rebase main` trước task đầu tiên của
  phần.

## Quyết định của plan

Spec để ngỏ hay nói chưa khớp mã ở các chỗ dưới đây; plan chốt như sau.

1. **Ba phần, một nhánh, ba lần merge.** A → B → C. B và C chỉ phụ thuộc thứ A tạo (mục
   "Giao diện dùng chung") và mã có sẵn; B và C không phụ thuộc nhau, nên thiếu giờ thì có thể
   làm C trước B.
2. **Mã vạch dùng lại `ticketBarcodeWidths`** (`apps/web/src/lib/checkout.ts:122`), không viết
   `barcodeBars` mới như spec §4.2 từng ghi — hàm có sẵn đã tất định theo mã đơn và đang vẽ
   mã vạch của biên nhận. Spec sửa cho khớp.
3. **Dòng tiền thành `bookingPriceLines`** ở `lib/checkout.ts`, cạnh `computeBookingTotal`;
   `BookingReceipt` dùng nó (Task A10). Trang chi tiết và voucher dùng chung.
4. **Vé trang chi tiết dùng đường gạch đứt và hai vết khuyết nửa tròn.** JSDoc của
   `BookingReceipt` ghi ngày 19/08 rằng combo này từng bị bác là "card giả vờ làm vé"; user
   duyệt lại kiểu vé này ngày 05/10 cho trang chi tiết (bản vẽ `booking-detail.src.html`, vòng
   sửa vết khuyết che viền ngang). Quyết định cũ vẫn đúng cho biên nhận và voucher; Task A10
   thêm một câu vào JSDoc `BookingReceipt` trỏ sang quyết định mới để người sau khỏi "sửa lại".
5. **Mộc là `VisaStamp` có sẵn** (nghiêng 4°, chỉ chữ trạng thái). Mộc trong bản vẽ có thêm
   dòng ngày là đồ vẽ tay, không làm theo.
6. **Mảng trên query GET** theo ký pháp ngoặc có chỉ số của oRPC:
   `when[0]=UPCOMING&status[0]=PAID&status[1]=CANCELLED`. `status=PAID` kiểu cũ vẫn hợp lệ
   (Passport không đổi gì).
7. **Khối i18n chia theo phần** để ba lần merge không đụng nhau: A mở rộng `accountBookings`,
   B thêm khối mới `bookingDetail`, C thêm khối mới `voucher`.

8. **Tên cổng thanh toán là `paymentProviderLabel`** ở cuối `apps/web/src/lib/booking-vm.ts`
   (Task 10, A10). `BookingReceipt`, vé và khối Payment (Phần B), voucher (Phần C) cùng gọi; bỏ
   ba bảng nhãn riêng.
9. **Ngày của mốc Cancelled là `cancelledAt` trước** — mọi đường huỷ đều ghi nó
   (`cancellations.service.ts:329`, `departure-cancel.service.ts`, `pending-sweep.service.ts:53`,
   `payments.service.ts:211`); không có thì `cancellationDecidedAt`, rồi
   `cancellationRequestedAt`. Spec §2.2 đã sửa.
10. **Luật mốc của thanh hành trình** (spec §2.2 đã sửa): Free cancellation chỉ xong khi đã QUA
    ngày chót; Trip ends chỉ xong ở `travelled`; mốc Paid của đơn chưa trả giữ nhãn "Paid", dòng
    phụ "Awaiting payment"; nhãn Today kẹp trong [0.2, 0.8] của đoạn để khỏi đè icon; `lapsed`
    không có chip; biến thể huỷ bỏ mốc Paid và Refund khi đơn chưa từng thu tiền, dòng phụ của
    Refund là số tiền gọn.
11. **Luật voucher** (spec §2.6 đã sửa): `voucherView` trả `null` cho MỌI đơn chưa có `paidAt`
    (kể cả CANCELLED chưa từng trả) — trang giữ hoá đơn cũ; sắp đi mà quá hạn huỷ thì bỏ dòng
    điều kiện hạn huỷ và mốc nhật ký thành "Free cancellation ended" ✓; "Write a review" chỉ cho
    PAID (`checkReviewEligibility` chỉ nhận PAID); dòng phụ lúc vừa trả là "…and a copy is on its
    way to {email}." (email đi qua outbox).
12. **Màu nền: `bg-primary` + `text-primary-foreground`** cho dải vé và mảng teal, KHÔNG
    `bg-primary-emphasis` như spec §4.3 từng ghi — token đó chỉ dành cho chữ (JSDoc
    `libs/shared/tokens/style-dictionary/tokens.mjs:56-74`), ở chế độ tối chữ trắng trên nó chỉ
    ~1,8:1. Chế độ sáng không đổi một điểm ảnh. Chữ phụ trong mảng teal dùng `/90`.
13. **Mốc màn hình** (spec §5.1 đã sửa): lề nội dung khớp hero (`xl:px-32`) nên ở khổ 1280 chỉ
    còn 1024px — vé nằm ngang từ `xl`, dưới đó xếp dọc; thanh hành trình ngang từ `md`; hai cột
    từ `lg`. Voucher: cột trái còn ~584px nên mộc nằm cùng hàng tiêu đề (flex), không nổi.
14. **Hợp đồng đổi làm hai nhịp:** Task 2 (A2) chỉ THÊM (`when`, `q`, `order`, `facets`,
    `BookingsListResultSchema`); hai thay đổi phá vỡ — `status` nhận mảng và route `mine` trả
    schema mới — đi cùng service ở Task 4 (A4). Đổi route sớm thì gate của A2 đỏ (controller còn
    trả `Paged<Booking>`, mọi `GET /api/bookings` ra 500).
15. **Khoá tìm** là `searchKey = foldAccents(x).replace(/[^a-z0-9]/g, '')` ở cả hai phía (dùng lại
    `foldAccents` của contract, `slug.ts:64`): chỉ bỏ dấu thì "hanoi" không khớp "Hà Nội". "Tên
    tour" là snapshot `bookings.tour_title`; tên điểm đến đọc sống qua quan hệ tour. ADR-0054 §3
    đã sửa.
16. **Thân trang tách ra component để có test** — Vitest của web không quét `src/app/**`:
    `BookingsListView` (A9), `BookingDetailView` (B7), `VoucherCard` (C4, mang luôn pháo giấy để
    luật "chỉ khi vừa trả" có test). `page.tsx` chỉ còn phiên, URL, lời gọi API, `redirect`.
17. **`pagerView(params, totalPages, total, limit)`** nhận cả bộ tham số vì link Newer/Older phải
    giữ bộ lọc. Spec §4.2 đã sửa. Điện thoại: dòng "Page … of …" lên hàng trên, hai link xuống
    hàng dưới; DOM giữ thứ tự đọc.
18. **Nút lọc dựng bằng `Popover` + `Checkbox`** của `@tourism/ui`, không `Command` (cmdk) như mẫu
    shadcn — menu 3–5 dòng không cần ô gõ; khuôn hàng ô tích lấy y `OptionRow` của
    `tours-filters.tsx`. Hàng lọc dùng `useOptimistic` theo hướng dẫn Next 16
    (`01-app/02-guides/interactive-apps.md`).
19. **Accordion đọc `bookingPhase` cho cả dòng phụ, Pay now và Review.** Hệ quả cố ý: đơn
    `lapsed` mất nút Pay now (chuyến hết nhận đặt); PARTIALLY_REFUNDED có "In N days", "Ends …"
    như PAID.
20. **Gỡ thứ hết người dùng:** Task 9 gỡ `groupBookingsByTime`, `BookingGroups`,
    `daysUntilDeparture` (cùng 16 ca test), `BOOKINGS_PAGE_SIZE`, `accountBookings.loadMore`,
    `passportBookings.back`; Task 20 (B7) gỡ `passportVisa.back`, `cancelLead`, `fineLine`,
    `requestsLine`; Task 25 (C4) gỡ `booking.success.nextHeading|nextEmail|nextVoucher|nextManage`.
    GIỮ `booking.list.browse` (Phần B dùng).
21. **Tiền:** dòng tiền và tổng dùng `formatMoney` (không số lẻ) cho khớp `BookingReceipt`; tiền
    HOÀN luôn `formatMoneyExact` (đối chiếu sao kê).
22. **Đọc tour hỏng không làm sập trang:** `fetchTourDetail` trả `null` khi tour gỡ; lỗi khác ở
    trang chi tiết và voucher bị bắt về `null` (sau `unstable_rethrow`) kèm `console.warn` — chỉ
    mất các ô lấy từ tour.
23. **Ngày có thứ:** Phần B thêm `calendarDateParts`, `formatWeekdayDate` vào `lib/tours.ts`.
    Voucher giữ `formatDate`/`formatDateRange` (không thứ) để Phần C không phụ thuộc Phần B; số
    ngày của chuyến ở voucher dùng `tripLengthDays` có sẵn (`refund-policy.ts:134`).
24. **Chỗ chèn để ba lần merge ít đụng nhau:** khối `bookingDetail` ngay sau `accountBookingDetail`,
    khối `voucher` ngay sau `cancellationDeadline`; CSS vết khuyết của vé ngay TRƯỚC phần in ấn
    của `globals.css`, khối in của voucher ở CUỐI file.
25. **Bản in voucher:** chữ đổi sang `--hero` ngay trên thẻ để in từ giao diện tối vẫn ra mực tối;
    giấu phần ngoài thẻ bằng `body:has([data-slot="voucher"]) > :not(main)` thay vì gắn
    `print:hidden` vào linh kiện dùng chung; cột phải hẹp còn 17rem để khổ A4 giữ hai cột.
26. **`docs/open-items.md` (dòng P7) và roadmap trong `CLAUDE.md` do session gốc sửa lúc merge** —
    cả ba phần cùng đụng một dòng. Session thi công chỉ viết entry CHANGELOG của phần mình.
27. **Mã task** đánh số liên tục 1–26 cho script trích task của skill thi công; tiêu đề mang thêm
    mã phần (A1…C5) để đọc. Bước trong task ghi "Bước N".


## Ràng buộc toàn cục

Áp cho **mọi** task, không nhắc lại ở từng chỗ:

- **TDD** (luật 4): viết test trước, chạy cho ĐỎ đúng lý do, rồi mới cài. Mỗi ca test mới
  phải **thử đột biến**: sửa mã cho sai, thấy ca ấy đỏ, trả lại — ghi kết quả vào báo cáo.
  Đột biến KHÔNG khôi phục bằng `git checkout`/`git restore` khi còn thay đổi chưa commit.
- **Comment mã tiếng Việt** (luật 8); **chữ khách thấy bằng tiếng Anh**, nằm trong
  `@tourism/i18n` (luật 7). **Tokens-only**, không hex (luật 6).
- **Commit Conventional, tiếng Việt CÓ DẤU, không AI attribution** — không dòng
  `Co-Authored-By` (luật 12). Stage theo **đường dẫn tường minh**, không `git add -A`. Chạy
  `pnpm lint:fix` trước khi stage.
- **Không đụng:** `apps/mobile`, `apps/admin`, `apps/api/prisma/` (schema, migration, seed),
  component có sẵn của `libs/shared/ui` (chỉ dùng). Trang Passport (`/account`) chỉ được
  chạm đúng chỗ task kể tên. Thấy mình sắp cần sửa chỗ khác thì DỪNG và hỏi.
- **Không hạ tầng sống** (luật 15): không Supabase, Cloudinary, webhook, env hay redeploy
  Render/Vercel. Việc này không cần gì từ hạ tầng.
- **Ngày so bằng chuỗi `YYYY-MM-DD`**, "hôm nay" là ngày lịch Việt Nam do server tính
  (`vietnamToday` ở API, `todayDateString` ở web). Không `new Date('YYYY-MM-DD')` để so ngày
  (nửa đêm UTC lệch bảy tiếng so với lịch Việt Nam), không đọc đồng hồ trình duyệt.
- **Tên cố định** (review sẽ grep đúng chữ): như mục "Giao diện dùng chung" và "Bản đồ file".
- **Contract và i18n được đọc từ `dist`**: sửa xong phải build lại trước khi test gói khác
  thấy thay đổi —
  `pnpm turbo run build --filter=@tourism/contract --filter=@tourism/i18n --output-logs=errors-only`.
- **Next.js 16**: trước khi sửa trang, đọc hướng dẫn trong
  `apps/web/node_modules/next/dist/docs/` (Next 16 khác dữ liệu huấn luyện cũ — đọc phần
  `searchParams`, `redirect`, Server/Client Component) và theo khuôn các trang `account/`.
- **Tài liệu `.md`:** không để dòng bắt đầu bằng `+` ở cột 0; `git diff` file `.md` trước khi
  stage; không sửa entry CHANGELOG cũ; không sửa file `docs/design/mockups/*.src.html` (bản
  ghi bất biến).

### Quy trình gate (luật 11) — dùng ở cuối MỖI task

`pnpm gate:int` trần chạy song song 10 luồng và từng làm máy phình RAM, nên chạy tách bước,
hãm song song. Build web prerender gọi API thật, nên phải có API sống. Chạy từ GỐC WORKTREE
bằng **Git Bash**. Checkout gốc còn session khác đang thi công thì bước 1, 2, 5 và lệnh tắt API
đi theo bản cô lập ở mục kế tiếp.

```powershell
# 0. (PowerShell) Liếc commit memory trống — dưới 6 GB thì DỪNG, báo session gốc, đừng tự giết tiến trình nào.
"{0:N1} GB commit trống" -f ((Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory / 1MB)
```

```bash
# 1. API sống cho bước build web
pnpm turbo run build --filter=@tourism/api --output-logs=errors-only
(cd apps/api && node --env-file-if-exists=.env.local dist/main.js > /tmp/p7-api.log 2>&1 &)
for i in $(seq 1 30); do curl -sf http://localhost:3001/api/health > /dev/null && echo "API sống" && break; sleep 2; done

# 2. build + typecheck
NEXT_PUBLIC_API_URL=http://localhost:3001 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm turbo run build --concurrency=1 --output-logs=errors-only
pnpm turbo run typecheck --concurrency=3 --output-logs=errors-only

# 3. unit test — concurrency 1 (đợt F18 một lượt concurrency 2 làm commit trống tụt còn 1,6 GB)
pnpm turbo run test --concurrency=1 --output-logs=errors-only -- --maxWorkers=4

# 4. lint + luật tokens của mobile
pnpm lint && node scripts/check-mobile-tokens-only.mjs

# 5. integration test
pnpm test:int --concurrency=2
```

Tắt API sau khi xong (PowerShell) — chỉ giết đúng tiến trình đang nghe cổng 3001:

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Cả năm bước xanh mới được khai task xong. Máy chậm bất thường thì dừng và báo.

### Chạy song song với session khác ở checkout gốc

Checkout gốc (`fix/admin-ui-polish`, đợt sửa admin) chạy gate cùng lúc với worktree này. Int
test của mọi session dùng CHUNG DB `tourism_test` (hằng `TEST_DATABASE_URL` trong
`apps/api/vitest.int.config.ts`), còn bản trần ở trên dựng API cổng 3001 rồi giết tiến trình
đang nghe cổng ấy. Chạy đè nhau là hai bên TRUNCATE dữ liệu của nhau và giết API của nhau; và
session kia có thể bắt đầu gate NGAY GIỮA lúc bên này chuẩn bị (đã dính 29/09), nên soát cổng
một lần rồi mới quyết là không đủ. Vì vậy, **chừng nào session gốc chưa báo đợt kia đã xong,
mọi lượt gate chạy bản cô lập dưới đây** thay cho bước 1, 2, 5 và lệnh tắt API ở trên; bước 0,
3, 4 giữ nguyên. KHÔNG BAO GIỜ chạy lệnh tắt API theo cổng 3001.

**Chờ lượt nặng của bên kia** — ngay trước bước 1 và bước 5 (PowerShell). Còn dòng nào thì
chờ rồi soát lại, tới khi 30 giây liền không còn dòng nào; hai gate cùng lúc nhân đôi tải RAM:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'turbo|vitest|next|tsgo|biome' -and $_.CommandLine -notmatch 'booking-pages-redesign' } |
  Select-Object ProcessId, @{ n = 'Cmd'; e = { $_.CommandLine.Substring(0, [Math]::Min(120, $_.CommandLine.Length)) } }
```

**Bước 1 và 2 cô lập — API của mình ở cổng 3101** (Git Bash, gốc worktree):

```bash
pnpm turbo run build --filter=@tourism/api --output-logs=errors-only
(cd apps/api && PORT=3101 node --env-file-if-exists=.env.local dist/main.js > /tmp/p7-api.log 2>&1 &)
for i in $(seq 1 30); do curl -sf http://localhost:3101/api/health > /dev/null && echo "API sống" && break; sleep 2; done
grep -m1 -o '\[Nest\] [0-9]*' /tmp/p7-api.log   # PID của node — ghi lại để tắt

API_URL=http://localhost:3101 NEXT_PUBLIC_API_URL=http://localhost:3101 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm turbo run build --concurrency=1 --output-logs=errors-only
pnpm turbo run typecheck --concurrency=3 --output-logs=errors-only
```

Biến cổng 3101 chỉ gắn vào lệnh build, đừng `export`: bước test kế thừa biến thì
`apps/admin/src/proxy.spec.ts` đỏ giả. `PORT=3101` thắng giá trị trong `.env.local`. Kiểm API
bằng `curl` của Git Bash — `Invoke-WebRequest` của PowerShell thử IPv6 `::1` trước nên báo
trượt dù API sống.

**Tắt API — đúng PID của mình** (PowerShell, thay `<pid>` bằng số đã ghi):

```powershell
Get-Process -Id <pid> | Select-Object Id, ProcessName, Path   # phải là node.exe
Stop-Process -Id <pid> -Force
```

**Bước 5 cô lập — int test trên DB riêng `tourism_test_p7`.** Tạo một lần ba file tạm dưới đây
(thư mục `apps/api/out/` đã gitignore; Biome đọc `.gitignore`, tsconfig của api không include
nó), rồi mỗi lượt gate chạy:

```bash
pnpm turbo run db:generate --filter=@tourism/api --output-logs=errors-only
(cd apps/api && pnpm exec vitest run --config out/iso-int/vitest.int.iso.config.ts)
```

Lệnh vitest gọi thẳng KHÔNG kéo `^build` và `db:generate` như `pnpm test:int` qua turbo: worktree
mới chưa có Prisma client (`apps/api/src/generated/`, gitignored) thì mọi file int chết vì
`Cannot find module '../generated/prisma/client.js'`. Trong gate, bước 1–2 đã build đủ; chạy lẻ
(như Task 4 Bước 6) thì build contract, i18n trước (lệnh ở Ràng buộc toàn cục). Đo 06/10 trong
worktree này: `check-rls.int.spec` và `bookings.int.spec` xanh 31 ca trên `tourism_test_p7`.

`apps/api/out/iso-int/iso-constants.ts`:

```ts
// Hằng DB int RIÊNG của session P7 — file tạm, xoá cùng apps/api/out/ khi xong việc.
export const TEST_DATABASE_URL = 'postgresql://tourism:tourism@localhost:5432/tourism_test_p7';
```

`apps/api/out/iso-int/iso-global-setup.ts`:

```ts
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { TEST_DATABASE_URL } from './iso-constants';

// Bản chép của vitest.int.global-setup.ts, trỏ DB riêng: tạo DB (idempotent) rồi áp migration.
export default async function setup(): Promise<void> {
  const adminUrl = TEST_DATABASE_URL.replace(/\/tourism_test_p7$/, '/postgres');
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query('CREATE DATABASE tourism_test_p7');
  } catch (error) {
    // 42P04 = duplicate_database: DB đã có từ lượt trước.
    if ((error as { code?: string }).code !== '42P04') throw error;
  } finally {
    await client.end();
  }
  execSync('pnpm prisma migrate deploy', {
    stdio: 'inherit',
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
```

`apps/api/out/iso-int/vitest.int.iso.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import base from '../../vitest.int.config';
import { TEST_DATABASE_URL } from './iso-constants';

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url));

const merged = mergeConfig(base, {
  test: { env: { DATABASE_URL: TEST_DATABASE_URL } },
  // check-rls.int.spec import thẳng hằng của config gốc — thiếu alias thì nó đo nhầm tourism_test.
  resolve: { alias: { '../../vitest.int.config.js': here('./iso-constants.ts') } },
});

// mergeConfig NỐI mảng globalSetup chứ không thay, nên gán đè sau khi merge.
export default { ...merged, test: { ...merged.test, globalSetup: [here('./iso-global-setup.ts')] } };
```

Lượt đầu phải thấy `prisma migrate deploy` áp migration vào `tourism_test_p7` và
`check-rls.int.spec` xanh; không vậy thì DỪNG, báo session gốc. Hết Phần A (Task 12) thì dọn:
`docker exec tourism-v2-postgres-1 psql -U tourism -d postgres -c "DROP DATABASE IF EXISTS tourism_test_p7"`
và xoá `apps/api/out/`.

## Bài học mang sang — đọc TRƯỚC dòng mã đầu tiên

Các vòng review F14–F19 và P4e-4 tìm ra 15–27 lỗi thật mỗi vòng. Việc này đi qua đúng các vùng
từng hỏng: so ngày, luật trạng thái đơn, phân trang, form có trạng thái trên URL, bố cục.

**Test**

1. **Mỗi ca test mới thử đột biến.** F14 có ba ca xanh giả, F15 có năm.
2. **Fixture phải phân biệt được kết quả đúng với kết quả lười.** Ca thứ tự hành trình phải có
   ngày tạo đơn KHÁC thứ tự ngày đi (đơn tạo trước đi sau); ca tìm không dấu phải gõ chữ khác
   chữ đang lưu ("ha noi" cho "Hà Nội"); ca giai đoạn phải có đơn REFUNDED ngày tương lai và đơn
   PARTIALLY_REFUNDED đang đi.
3. **Khớp chữ chính xác, không `/…/i`.**
4. **Base UI trong jsdom:** mở Popover, Dialog xong thì CHỜ bằng `findByRole`, không
   `getByRole` ngay sau cú bấm.
5. **Bố cục không đo được bằng jsdom** — mỗi phần có một task soi bằng CSS build thật.

**Web**

6. **Mọi câu chữ hứa hệ quả phải đo trên mã trước khi viết** ("saved on this device",
   "full refund", "Your review opens after…").
7. **Dùng lại, đừng chép:** `ContentHero`, `VisaStamp`, `BookingAccordion`, `BookingActions`,
   `ReviewComposer`, `RetractReviewButton`, `CopyCodeButton`, `SuccessCelebration`,
   `PrintButton`, `CheckoutAutoRefresh`, `bookingView`, `cancellationDeadlineText`,
   `refundSummary`, `reviewSlot`, `ticketBarcodeWidths`, `formatMoney`, `formatDate`,
   `formatDateRange`, `fetchTourDetail`.
8. **Không sửa component nào của `@tourism/ui`** — kit dùng chung với admin.
9. **Không bao giờ hai `h1`** trên một trang: `ContentHero` giữ `h1`, mọi tiêu đề khác là
   `h2` trở xuống.

**Quy trình**

10. **Comment không khai trạng thái tương lai** ("Task X sẽ…").
11. **Entry CHANGELOG viết theo ngày viết**; session gốc thêm entry merge.

## Giao diện dùng chung

Phần A tạo; Phần B và C dùng ĐÚNG các tên này.

**`libs/shared/contract/src/schemas/booking-phase.ts`** (export qua barrel của contract):

```ts
export const BookingPhaseSchema = z.enum([
  'awaiting_payment', 'upcoming', 'on_tour', 'travelled', 'cancelled', 'lapsed',
]);
export type BookingPhase = z.output<typeof BookingPhaseSchema>;
export const BookingWhenSchema = z.enum(['ON_TOUR', 'UPCOMING', 'PAST']);
export type BookingWhen = z.output<typeof BookingWhenSchema>;
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatusValue[];
export interface BookingPhaseInput {
  status: BookingStatusValue;
  departureStartDate: string;
  departureEndDate: string;
}
export function bookingPhase(booking: BookingPhaseInput, today: string): BookingPhase;
export function bookingWhen(phase: BookingPhase): BookingWhen;
export function calendarDaysBetween(from: string, to: string): number;
export interface TripDayNumbers { daysToGo: number; dayOfTrip: number; tripLength: number }
export function tripDayNumbers(
  dates: { departureStartDate: string; departureEndDate: string },
  today: string,
): TripDayNumbers;
```

**`libs/shared/contract/src/schemas/bookings.ts`:** `BookingsListOrderSchema`,
`BookingsListQuerySchema` (thêm `status` một giá trị hoặc mảng, `when`, `q`, `order`),
`BookingsListFacetsSchema`, `BookingsListResultSchema`, kiểu `BookingsListResult`; route
`bookings.mine` trả `BookingsListResultSchema`.

**Web:** prop `back?: { href: string; label: string }` của `ContentHero`;
`PriceLine` và `bookingPriceLines(booking)` ở `apps/web/src/lib/checkout.ts`.


## Bảng mã task

Số task chạy liên tục 1–26 cho script trích task của skill thi công; mã phần (A1…C5) giữ trong
tiêu đề để đọc, và chữ trong task vẫn gọi nhau bằng mã phần ("Task A10", "B3").

| Task | Mã | Nội dung |
| --- | --- | --- |
| 1 | A1 | Contract: luật giai đoạn đơn dùng chung (`booking-phase.ts`) |
| 2 | A2 | Contract: hình dạng mới cho query và kết quả của `bookings.mine` |
| 3 | A3 | API: lọc, tìm, xếp, đếm và cắt trang thuần (`booking-list.ts`) |
| 4 | A4 | Contract + API: `status` nhận mảng, `bookings.mine` mới, int test |
| 5 | A5 | Web: `ContentHero` có nút quay lại (`back`) |
| 6 | A6 | Web: tham số URL, input API và phân trang của My bookings |
| 7 | A7 | Web: hàng tìm và lọc của My bookings |
| 8 | A8 | Web: phân trang "Newer / Older trips" |
| 9 | A9 | Web: trang My bookings mới |
| 10 | A10 | Web: dòng tiền và tên cổng thanh toán dùng chung |
| 11 | A11 | Soi bố cục Phần A bằng CSS build thật |
| 12 | A12 | Gate cuối Phần A, docs, bàn giao |
| 13 | B1 | Chữ của trang, hàm ngày có thứ, mốc thanh hành trình |
| 14 | B2 | Các bước "Get ready" và ô tích nhớ trên máy (logic thuần) |
| 15 | B3 | Vé kiểu boarding pass, đường xé và hai vết khuyết |
| 16 | B4 | Thanh hành trình |
| 17 | B5a | Khối "Get ready" và ô tích nhớ trên máy |
| 18 | B5b | Khối cột phải cho đơn đang đi, đã huỷ hay lỡ hạn, chờ trả; khu review |
| 19 | B6 | Cột trái: thông tin đơn và hàng nút đáy |
| 20 | B7 | Ráp trang theo giai đoạn |
| 21 | B8 | Soi bố cục, gate cuối, docs, bàn giao |
| 22 | C1 | `voucherView`: luật vừa trả, mở lại và giai đoạn của voucher |
| 23 | C2 | Cột trái của voucher |
| 24 | C3 | Mảng teal: ô mã, điều kiện, mã vạch, Receipt overview, Trip journal |
| 25 | C4 | Ráp thẻ voucher và viết lại nhánh đã trả của `/checkout/success` |
| 26 | C5 | Bản in, soi bố cục, gate cuối, docs, bàn giao |

## Bản đồ file

| File | Trách nhiệm | Task |
| --- | --- | --- |
| `libs/shared/contract/src/schemas/booking-phase.ts` (mới, có spec) | Giai đoạn đơn, nhóm When, số ngày lịch | 1 |
| `libs/shared/contract/src/index.ts` | Export `booking-phase` | 1 |
| `libs/shared/contract/src/schemas/bookings.ts` (có spec) | Query thêm `when`, `q`, `order`, `facets`, kết quả mới (Task 2); `status` nhận mảng (Task 4) | 2, 4 |
| `libs/shared/contract/src/contract.ts` (có `contract.spec.ts`) | `bookings.mine` trả `BookingsListResultSchema` | 4 |
| `apps/api/src/modules/bookings/booking-list.ts` (mới, có spec) | Lọc, tìm, xếp, đếm, cắt trang thuần | 3 |
| `apps/api/src/modules/bookings/bookings.service.ts` | `mine` đọc khoá nhẹ rồi nạp đủ dòng của trang | 4 |
| `apps/api/src/modules/bookings/bookings.int.spec.ts` | Int test lọc, tìm, thứ tự hành trình | 4 |
| `apps/web/src/components/content/content-hero.tsx` (spec mới) | Prop `back` | 5 |
| `apps/web/src/lib/bookings-list.ts` (mới, có spec) | Tham số URL, input API, `pagerView` | 6 |
| `apps/web/src/lib/api/bookings.ts` (spec mới) | `fetchMyBookingsPage` (Task 6); gỡ `BOOKINGS_PAGE_SIZE` (Task 9) | 6, 9 |
| `libs/shared/i18n/src/lib/messages.ts` | A: mở rộng `accountBookings`, gỡ `loadMore` và `passportBookings.back` (Task 6–9). B: khối `bookingDetail` (Task 13), gỡ bốn khoá mồ côi của `passportVisa` (Task 20). C: khối `voucher` (Task 22), gỡ `booking.success.next*` (Task 25) | 6–9, 13, 20, 22, 25 |
| `libs/shared/i18n/src/lib/messages.spec.ts` | Ca chữ của `bookingDetail` | 13 |
| `apps/web/src/components/account/facet-filter.tsx` (mới, có spec) | Nút lọc chọn nhiều | 7 |
| `apps/web/src/components/account/bookings-toolbar.tsx` (mới, có spec) | Hàng tìm và lọc | 7 |
| `apps/web/src/components/account/trip-pager.tsx` (mới, có spec) | Phân trang Newer / Older trips | 8 |
| `apps/web/src/components/account/bookings-list-view.tsx` (mới, có spec) | Thân trang My bookings | 9 |
| `apps/web/src/app/(site)/account/bookings/page.tsx` | URL → API → thân trang; về trang cuối | 9 |
| `apps/web/src/components/passport/booking-accordion.tsx`, `passport.spec.tsx` | Dòng phụ, Pay now, Review theo `bookingPhase`; nhãn Total | 9 |
| `apps/web/src/lib/account-stats.ts` (có spec) | Gỡ `groupBookingsByTime`, `daysUntilDeparture` | 9 |
| `apps/web/src/lib/checkout.ts` (có spec) | `PriceLine`, `bookingPriceLines` | 10 |
| `apps/web/src/lib/booking-vm.ts` (có spec) | `paymentProviderLabel` | 10 |
| `apps/web/src/components/checkout/booking-receipt.tsx` | Dùng hai hàm chung (Task 10); JSDoc (Task 25) | 10, 25 |
| `docs/handoff/mobile-booking-handoff.md` | Hàng T1 | 12 |
| `apps/web/src/lib/tours.ts` (có spec) | `calendarDateParts`, `formatWeekdayDate` | 13 |
| `apps/web/src/lib/booking-journey.ts` (mới, có spec) | `journeyMilestones` và kiểu của thanh hành trình | 13 |
| `apps/web/src/lib/get-ready.ts` (mới, có spec) | `BookingTourData`, `tourMeetingPoint`, `getReadySteps`, `prepStorageKey`, `readPrepChecked` | 14 |
| `apps/web/src/components/account/booking-ticket.tsx` (mới, có spec) | Vé boarding pass | 15 |
| `apps/web/src/app/globals.css` | Hai vết khuyết của đường xé (Task 15); bản in voucher, comment khối in cũ (Task 26) | 15, 26 |
| `apps/web/src/components/account/trip-journey.tsx` (mới, có spec) | Thanh hành trình | 16 |
| `apps/web/src/components/account/prep-checklist.tsx` (mới, có spec) | Ô tích lưu `localStorage` | 17 |
| `apps/web/src/components/account/get-ready-panel.tsx` (mới, có spec) | Khối Get ready | 17 |
| `apps/web/src/components/account/on-tour-panel.tsx` (mới, có spec) | Khối đang đi | 18 |
| `apps/web/src/components/account/trip-closed-panel.tsx` (mới, có spec) | Khối đã huỷ, lỡ hạn trả | 18 |
| `apps/web/src/components/account/awaiting-payment-panel.tsx` (mới, có spec) | Khối chờ trả | 18 |
| `apps/web/src/components/account/review-panel.tsx` (mới, có spec) | Khu review dời từ trang | 18 |
| `apps/web/src/components/account/booking-details-panel.tsx` (mới, có spec) | Cột trái, hàng nút đáy | 19 |
| `apps/web/src/components/account/booking-detail-view.tsx` (mới, có spec) | Khung dưới hero, chọn khối theo giai đoạn | 20 |
| `apps/web/src/app/(site)/account/bookings/[code]/page.tsx` | Nạp dữ liệu, hero có nút quay lại | 20 |
| `apps/web/src/lib/voucher.ts` (mới, có spec) | `voucherView`, `VOUCHER_FRESH_MINUTES`, kiểu `VoucherView`, `VoucherJournalItem`, `VoucherPhase` | 22 |
| `apps/web/src/test/fixtures/voucher.ts` (mới) | Đơn của bản vẽ voucher, mốc "bây giờ" chung, cờ huỷ còn hạn | 22 |
| `apps/web/src/components/checkout/voucher-code.tsx` (mới; phủ qua spec của Task 23, 24) | `VoucherCode`, `VoucherCancelledNotice` | 23 |
| `apps/web/src/components/checkout/voucher-overview.tsx` (mới, có spec) | Cột trái: mộc, tiêu đề, thẻ ảnh, bốn ô, ô mã gọn | 23 |
| `apps/web/src/components/checkout/copy-code-button.tsx` | Chỉ JSDoc | 23 |
| `apps/web/src/components/checkout/voucher-pass.tsx` (mới, có spec) | Mảng teal: ô mã, điều kiện, mã vạch, Receipt overview, Trip journal | 24 |
| `apps/web/src/components/checkout/voucher-card.tsx` (mới, có spec) | Thẻ chia đôi, pháo giấy khi vừa trả | 25 |
| `apps/web/src/app/(site)/checkout/success/page.tsx` | Hai nhánh voucher / hoá đơn chờ, gọi `fetchTourDetail`, trang không tìm thấy, tiêu đề tab | 25 |
| `apps/web/src/components/checkout/success-celebration.tsx` | Chỉ JSDoc | 25 |
| `docs/CHANGELOG.md` | Entry của từng phần | 12, 21, 26 |

`docs/open-items.md` và roadmap trong `CLAUDE.md` KHÔNG có trong bảng: session gốc sửa lúc merge
(quyết định 26).


## Phần A — Luật giai đoạn, `bookings.mine`, My bookings (Task 1–12)

> Làm ngay trên nhánh hiện tại. Hết Task 12 thì DỪNG: session gốc review, merge Phần A, rồi mới
> sang Phần B.

### Task 1 — A1 · Contract: luật giai đoạn đơn dùng chung (`booking-phase.ts`)

**Files:**

- Create: `libs/shared/contract/src/schemas/booking-phase.ts`
- Test: `libs/shared/contract/src/schemas/booking-phase.spec.ts`
- Modify: `libs/shared/contract/src/index.ts` (một dòng export)

**Interfaces:**

- Consumes: kiểu `BookingStatusValue` (`schemas/bookings.ts:38`, import CHỈ kiểu — tránh vòng
  import khi Task A2 cho `bookings.ts` import ngược file này), `tripLengthDays`
  (`schemas/refund-policy.ts:134`, ném `RangeError` khi ngày hỏng hay ngày về trước ngày đi).
- Produces: đúng chữ ký ở "Giao diện dùng chung" — `BookingPhaseSchema`, `BookingPhase`,
  `BookingWhenSchema`, `BookingWhen`, `ACTIVE_BOOKING_STATUSES`, `BookingPhaseInput`,
  `bookingPhase(booking, today)`, `bookingWhen(phase)`, `calendarDaysBetween(from, to)`,
  `TripDayNumbers`, `tripDayNumbers(dates, today)`. Phần B và C dùng nguyên văn các tên này.

- [ ] **Bước 1. Test trước.** Tạo `booking-phase.spec.ts` (Vitest của contract bật `globals`, như
  `departure-phase.spec.ts` ngay cạnh — không import `describe/it/expect`):

```ts
import {
  ACTIVE_BOOKING_STATUSES,
  BookingPhaseSchema,
  BookingWhenSchema,
  bookingPhase,
  bookingWhen,
  calendarDaysBetween,
  tripDayNumbers,
} from './booking-phase.js';
import { BookingStatusSchema } from './bookings.js';

/**
 * Giai đoạn của một đơn (ADR-0054 §1) — MỘT luật cho `bookings.mine` (lọc, xếp, đếm) và ba
 * trang đơn của web. Bộ này canh từng mốc biên: lệch một dấu so sánh là ra một bảng trông
 * hợp lý mà sai đúng vào ngày khách cần. "Hôm nay" là chuỗi ngày lịch Việt Nam.
 *
 * Chuyến mẫu 10/10 → 14/10, xét ở năm mốc: hôm trước ngày đi, ngày đi, giữa chuyến, ngày
 * về, hôm sau ngày về.
 */
const TRIP = { departureStartDate: '2026-10-10', departureEndDate: '2026-10-14' } as const;
const DAYS = ['2026-10-09', '2026-10-10', '2026-10-12', '2026-10-14', '2026-10-15'] as const;

describe('bookingPhase — năm trạng thái qua năm mốc ngày', () => {
  it.each([
    ['PAID', ['upcoming', 'on_tour', 'on_tour', 'on_tour', 'travelled']],
    // Sự thật 4 của ADR-0054: hoàn một phần mà chuyến vẫn đi — đi đúng đường của PAID.
    ['PARTIALLY_REFUNDED', ['upcoming', 'on_tour', 'on_tour', 'on_tour', 'travelled']],
    // Tới ngày đi mà chưa trả là hết cơ hội: hạn chót luôn trước ngày đi (ADR-0041 §3).
    ['PENDING', ['awaiting_payment', 'lapsed', 'lapsed', 'lapsed', 'lapsed']],
    ['CANCELLED', ['cancelled', 'cancelled', 'cancelled', 'cancelled', 'cancelled']],
    // Sự thật 3: đơn REFUNDED còn ngày đi tương lai KHÔNG được vào nhóm sắp đi.
    ['REFUNDED', ['cancelled', 'cancelled', 'cancelled', 'cancelled', 'cancelled']],
  ] as const)('%s', (status, expected) => {
    expect(DAYS.map((today) => bookingPhase({ status, ...TRIP }, today))).toEqual(expected);
  });
});

describe('bookingPhase — chuyến MỘT ngày', () => {
  const DAY_TRIP = { departureStartDate: '2026-10-10', departureEndDate: '2026-10-10' } as const;

  it.each([
    ['2026-10-09', 'upcoming'],
    ['2026-10-10', 'on_tour'],
    ['2026-10-11', 'travelled'],
  ] as const)('PAID, hôm nay %s → %s', (today, expected) => {
    expect(bookingPhase({ status: 'PAID', ...DAY_TRIP }, today)).toBe(expected);
  });

  it('PENDING đúng ngày đi đã là lapsed', () => {
    expect(bookingPhase({ status: 'PENDING', ...DAY_TRIP }, '2026-10-10')).toBe('lapsed');
  });
});

describe('bookingWhen — giai đoạn sang ba nhóm của bộ lọc When', () => {
  it.each([
    ['on_tour', 'ON_TOUR'],
    ['upcoming', 'UPCOMING'],
    ['awaiting_payment', 'UPCOMING'],
    ['travelled', 'PAST'],
    ['cancelled', 'PAST'],
    ['lapsed', 'PAST'],
  ] as const)('%s → %s', (phase, when) => {
    expect(bookingWhen(phase)).toBe(when);
  });

  it('sáu giai đoạn phủ đủ ba nhóm — không nhóm nào bỏ không', () => {
    const reached = new Set(BookingPhaseSchema.options.map(bookingWhen));
    expect([...reached].sort()).toEqual([...BookingWhenSchema.options].sort());
  });
});

describe('ACTIVE_BOOKING_STATUSES', () => {
  it('đúng PAID và PARTIALLY_REFUNDED', () => {
    expect(ACTIVE_BOOKING_STATUSES).toEqual(['PAID', 'PARTIALLY_REFUNDED']);
  });

  it('khớp bookingPhase: chỉ đơn còn hiệu lực mới tới được giai đoạn của chuyến đi', () => {
    const tripPhases: readonly string[] = ['upcoming', 'on_tour', 'travelled'];
    for (const status of BookingStatusSchema.options) {
      const reachesTrip = DAYS.some((today) =>
        tripPhases.includes(bookingPhase({ status, ...TRIP }, today)),
      );
      expect(reachesTrip).toBe(ACTIVE_BOOKING_STATUSES.includes(status));
    }
  });
});

describe('calendarDaysBetween — ngày lịch, không giờ', () => {
  it.each([
    ['2026-10-05', '2026-10-05', 0],
    ['2026-10-05', '2026-10-06', 1],
    ['2026-10-06', '2026-10-05', -1],
    ['2026-10-05', '2026-11-03', 29],
    ['2026-12-31', '2027-01-01', 1],
    ['2028-02-28', '2028-03-01', 2],
  ] as const)('%s → %s là %i ngày', (from, to, days) => {
    expect(calendarDaysBetween(from, to)).toBe(days);
  });

  it('ngày hỏng ném RangeError, không trả NaN', () => {
    expect(() => calendarDaysBetween('2026-02-30', '2026-03-01')).toThrow(RangeError);
    expect(() => calendarDaysBetween('2026-10-05', 'soon')).toThrow(RangeError);
  });
});

describe('tripDayNumbers — còn mấy ngày, ngày thứ mấy, dài mấy ngày', () => {
  it('trước chuyến: daysToGo dương, dayOfTrip chưa tới 1', () => {
    expect(tripDayNumbers(TRIP, '2026-10-07')).toEqual({
      daysToGo: 3,
      dayOfTrip: -2,
      tripLength: 5,
    });
  });

  it('ngày đi là ngày 1, ngày về là ngày cuối', () => {
    expect(tripDayNumbers(TRIP, '2026-10-10')).toEqual({ daysToGo: 0, dayOfTrip: 1, tripLength: 5 });
    expect(tripDayNumbers(TRIP, '2026-10-14')).toEqual({
      daysToGo: -4,
      dayOfTrip: 5,
      tripLength: 5,
    });
  });

  it('chuyến vắt qua tháng', () => {
    const dates = { departureStartDate: '2026-10-30', departureEndDate: '2026-11-02' };
    expect(tripDayNumbers(dates, '2026-11-01')).toEqual({
      daysToGo: -2,
      dayOfTrip: 3,
      tripLength: 4,
    });
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/contract exec vitest run src/schemas/booking-phase.spec.ts`
  — ĐỎ vì chưa có module `./booking-phase.js`.

- [ ] **Bước 3. Cài.** Tạo `booking-phase.ts`:

```ts
import { z } from 'zod';
import type { BookingStatusValue } from './bookings.js';
import { tripLengthDays } from './refund-policy.js';

/**
 * Giai đoạn của MỘT đơn của khách (ADR-0054 §1) — SUY từ trạng thái đơn và hai ngày của
 * chuyến, không lưu ở đâu cả. Một luật cho API (lọc, xếp, đếm của `bookings.mine`) và cho
 * ba trang đơn của web. Trước ADR-0054 luật này rải ở sáu chỗ trên web, và
 * `groupBookingsByTime` xếp đơn REFUNDED còn ngày đi tương lai vào nhóm "sắp đi".
 *
 * Viết thường, nối gạch dưới — giá trị SUY RA, không phải enum của DB (viết hoa).
 */
export const BookingPhaseSchema = z.enum([
  'awaiting_payment',
  'upcoming',
  'on_tour',
  'travelled',
  'cancelled',
  'lapsed',
]);
export type BookingPhase = z.output<typeof BookingPhaseSchema>;

/**
 * Ba nhóm của bộ lọc "When" (ADR-0054 §2). Viết HOA vì giá trị đi trên query của
 * `bookings.mine` (`when[0]=UPCOMING`), cùng nếp với các enum khác của contract.
 */
export const BookingWhenSchema = z.enum(['ON_TOUR', 'UPCOMING', 'PAST']);
export type BookingWhen = z.output<typeof BookingWhenSchema>;

/**
 * PAID và PARTIALLY_REFUNDED: đơn còn hiệu lực, chuyến vẫn đi — đúng hai trạng thái
 * `isCancellableStatus` của API nhận (`apps/api/src/modules/bookings/booking-cancellation.ts`).
 */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatusValue[] = ['PAID', 'PARTIALLY_REFUNDED'];

/** Phần của một đơn mà luật giai đoạn cần — `Booking` của contract khớp sẵn kiểu này. */
export interface BookingPhaseInput {
  status: BookingStatusValue;
  /** Ngày lịch `YYYY-MM-DD` (snapshot lúc đặt). */
  departureStartDate: string;
  /** Ngày lịch `YYYY-MM-DD` (snapshot lúc đặt). */
  departureEndDate: string;
}

/**
 * Giai đoạn của đơn vào ngày `today` — ngày lịch Việt Nam do SERVER tính (`vietnamToday` ở
 * API, `todayDateString` ở web). Không bao giờ so bằng đồng hồ trình duyệt.
 *
 * So CHUỖI `YYYY-MM-DD`: thứ tự từ điển trùng thứ tự thời gian. Biên đóng hai đầu: ngày đi và
 * ngày về đều là `on_tour`. PENDING tới ngày đi là `lapsed` vì chuyến đã hết nhận đặt — hạn
 * chót luôn trước ngày đi (ADR-0041 §3).
 */
export function bookingPhase(booking: BookingPhaseInput, today: string): BookingPhase {
  const { status, departureStartDate, departureEndDate } = booking;
  switch (status) {
    case 'CANCELLED':
    case 'REFUNDED':
      return 'cancelled';
    case 'PENDING':
      return departureStartDate > today ? 'awaiting_payment' : 'lapsed';
    case 'PAID':
    case 'PARTIALLY_REFUNDED':
      if (departureEndDate < today) return 'travelled';
      return departureStartDate <= today ? 'on_tour' : 'upcoming';
  }
}

/** Giai đoạn → nhóm của bộ lọc "When". Đơn chờ trả vẫn là "sắp đi": khách còn trả được. */
export function bookingWhen(phase: BookingPhase): BookingWhen {
  switch (phase) {
    case 'on_tour':
      return 'ON_TOUR';
    case 'upcoming':
    case 'awaiting_payment':
      return 'UPCOMING';
    case 'travelled':
    case 'cancelled':
    case 'lapsed':
      return 'PAST';
  }
}

/**
 * Số ngày lịch từ `from` tới `to` (to − from), cả hai `YYYY-MM-DD`; âm khi `to` trước `from`.
 *
 * Dựng trên `tripLengthDays` của luật huỷ (đếm CẢ HAI đầu, chỉ nhận đầu ≤ cuối) thay vì chép
 * lại phép đổi ngày: trừ 1 ra khoảng cách, đảo hai đầu cho chiều âm. Ngày hỏng ném
 * `RangeError` từ chính hàm ấy — một cột ngày lỗi thành 500 nhìn thấy được, không thành NaN.
 */
export function calendarDaysBetween(from: string, to: string): number {
  return from <= to ? tripLengthDays(from, to) - 1 : 1 - tripLengthDays(to, from);
}

/** Ba con số của mục 2.3 spec P7 — đếm ngược, ngày trong chuyến, độ dài chuyến. */
export interface TripDayNumbers {
  daysToGo: number;
  dayOfTrip: number;
  tripLength: number;
}

/** daysToGo = start − today; dayOfTrip = today − start + 1; tripLength = end − start + 1. */
export function tripDayNumbers(
  dates: { departureStartDate: string; departureEndDate: string },
  today: string,
): TripDayNumbers {
  return {
    daysToGo: calendarDaysBetween(today, dates.departureStartDate),
    dayOfTrip: calendarDaysBetween(dates.departureStartDate, today) + 1,
    tripLength: tripLengthDays(dates.departureStartDate, dates.departureEndDate),
  };
}
```

- [ ] **Bước 4.** `index.ts`: thêm `export * from './schemas/booking-phase.js';` ngay TRƯỚC dòng
  `export * from './schemas/bookings.js';` (thứ tự chữ cái: `-` đứng trước `s`).

- [ ] **Bước 5.** Chạy lại lệnh Bước 2 — XANH (28 ca). **Đột biến** (mỗi cái một lần, thấy đỏ, trả lại):
  `departureStartDate > today` thành `>=` ở nhánh PENDING (cột ngày đi của PENDING phải đỏ);
  `departureEndDate < today` thành `<=` (cột ngày về của PAID đỏ); `departureStartDate <= today`
  thành `<` (cột ngày đi đỏ); chuyển `case 'REFUNDED':` sang nhóm PAID (dòng REFUNDED đỏ);
  `awaiting_payment` trả `'PAST'` trong `bookingWhen`; bỏ `'PARTIALLY_REFUNDED'` khỏi
  `ACTIVE_BOOKING_STATUSES` (hai ca của describe đó đỏ); `- 1` thành `- 0` trong
  `calendarDaysBetween`; `1 - tripLengthDays` thành `tripLengthDays - 1` (ca −1 đỏ); bỏ `+ 1`
  của `dayOfTrip`.

- [ ] **Bước 6.** `pnpm --filter @tourism/contract typecheck` xanh. Build contract:
  `pnpm turbo run build --filter=@tourism/contract --output-logs=errors-only`. Chạy quy trình
  gate ở mục Ràng buộc toàn cục. Commit (stage
  `libs/shared/contract/src/schemas/booking-phase.ts`,
  `libs/shared/contract/src/schemas/booking-phase.spec.ts`,
  `libs/shared/contract/src/index.ts`):
  `feat(contract): luật giai đoạn đơn dùng chung cho API và web`

### Task 2 — A2 · Contract: hình dạng mới cho query và kết quả của `bookings.mine`

Task này CHỈ THÊM: ba trường tuỳ chọn của query (`when`, `q`, `order`), schema `facets` và
`BookingsListResultSchema`. Hai thay đổi phá vỡ — `status` nhận mảng và route `bookings.mine`
trả schema mới — đi cùng service ở Task A4, để gate cuối MỖI task xanh (lý do ở quyết định
14).

**Files:**

- Modify: `libs/shared/contract/src/schemas/bookings.ts` (import dòng 1–8; khối query
  dòng 244–256)
- Test: `libs/shared/contract/src/schemas/bookings.spec.ts` (khối import đầu file; thêm cuối file)

**Interfaces:**

- Consumes: `BookingWhenSchema` (Task A1), `PagedSchema` (`schemas/catalog.ts:276`),
  `BookingSchema` (cùng file).
- Produces: hằng `BOOKINGS_SEARCH_MAX` = 80; `BookingsListOrderSchema` + kiểu
  `BookingsListOrder` (`'recent' | 'journey'`); `BookingsListQuerySchema` thêm `when`, `q`,
  `order` (mặc định `'recent'`); `BookingsListFacetsSchema` + kiểu `BookingsListFacets`;
  `BookingsListResultSchema` + kiểu `BookingsListResult`.

- [ ] **Bước 1. Test trước.** Trong `bookings.spec.ts`, thêm vào khối import từ `'./bookings.js'`
  ba tên `BOOKINGS_SEARCH_MAX`, `BookingsListFacetsSchema`, `BookingsListResultSchema` (để
  `pnpm lint:fix` xếp lại thứ tự). Thêm CUỐI file (sau describe
  `CancellationRequestSchema — ai quyết`, để `validBooking` khai ở dòng ~394 đã có):

```ts
describe('BookingsListQuerySchema — lọc, tìm, thứ tự (ADR-0054 §2)', () => {
  it('mặc định: trang 1, 12 dòng, thứ tự recent — không tự thêm bộ lọc nào', () => {
    expect(BookingsListQuerySchema.parse({})).toEqual({ page: 1, limit: 12, order: 'recent' });
  });

  it('order nhận recent và journey, từ chối giá trị lạ', () => {
    expect(BookingsListQuerySchema.parse({ order: 'journey' }).order).toBe('journey');
    expect(BookingsListQuerySchema.safeParse({ order: 'price' }).success).toBe(false);
  });

  it('when: mảng 1–3 nhóm viết hoa; chuỗi trần, mảng rỗng, chữ thường đều bị bắt', () => {
    expect(BookingsListQuerySchema.parse({ when: ['UPCOMING', 'PAST'] }).when).toEqual([
      'UPCOMING',
      'PAST',
    ]);
    expect(BookingsListQuerySchema.safeParse({ when: [] }).success).toBe(false);
    expect(BookingsListQuerySchema.safeParse({ when: ['upcoming'] }).success).toBe(false);
    expect(BookingsListQuerySchema.safeParse({ when: 'UPCOMING' }).success).toBe(false);
    expect(
      BookingsListQuerySchema.safeParse({ when: ['PAST', 'PAST', 'PAST', 'PAST'] }).success,
    ).toBe(false);
  });

  it('q: cắt khoảng trắng TRƯỚC khi đo trần 80; toàn khoảng trắng bị bắt', () => {
    const x = (length: number) => 'x'.repeat(length);
    expect(BOOKINGS_SEARCH_MAX).toBe(80);
    expect(BookingsListQuerySchema.parse({ q: '  ha noi  ' }).q).toBe('ha noi');
    expect(BookingsListQuerySchema.parse({ q: `  ${x(80)}  ` }).q).toBe(x(80));
    expect(BookingsListQuerySchema.safeParse({ q: x(81) }).success).toBe(false);
    expect(BookingsListQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
  });
});

describe('BookingsListFacetsSchema / BookingsListResultSchema (ADR-0054 §2)', () => {
  const FACETS = {
    when: { ON_TOUR: 1, UPCOMING: 2, PAST: 3 },
    status: { PENDING: 0, PAID: 4, CANCELLED: 0, REFUNDED: 1, PARTIALLY_REFUNDED: 1 },
  };
  const RESULT = {
    items: [validBooking],
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
    facets: FACETS,
    overallTotal: 6,
  };

  it('nhận kết quả đủ facets và overallTotal', () => {
    expect(BookingsListResultSchema.parse(RESULT)).toEqual(RESULT);
  });

  it('facets đòi ĐỦ mọi khoá — lựa chọn không có đơn vẫn mang số 0', () => {
    const { PAST: _past, ...noPast } = FACETS.when;
    const { CANCELLED: _cancelled, ...noCancelled } = FACETS.status;
    expect(BookingsListFacetsSchema.safeParse({ ...FACETS, when: noPast }).success).toBe(false);
    expect(BookingsListFacetsSchema.safeParse({ ...FACETS, status: noCancelled }).success).toBe(
      false,
    );
  });

  it('facets từ chối khoá lạ và số âm', () => {
    const extra = { ...FACETS, when: { ...FACETS.when, SOMEDAY: 0 } };
    const negative = { ...FACETS, status: { ...FACETS.status, PAID: -1 } };
    expect(BookingsListFacetsSchema.safeParse(extra).success).toBe(false);
    expect(BookingsListFacetsSchema.safeParse(negative).success).toBe(false);
  });

  it('overallTotal bắt buộc', () => {
    const { overallTotal: _overall, ...withoutOverall } = RESULT;
    expect(BookingsListResultSchema.safeParse(withoutOverall).success).toBe(false);
  });
});
```

  Ca "facets đòi đủ khoá" dựa trên hành vi đã đọc ở zod 4.4.3
  (`node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/schemas.js:1422-1490`): khoá enum
  có `values` thì `$ZodRecord` duyệt MỌI giá trị enum — khoá vắng mặt cho `undefined` vào
  `z.int()` và bị bắt; khoá lạ sinh lỗi `unrecognized_keys`.

- [ ] **Bước 2.** `pnpm --filter @tourism/contract exec vitest run src/schemas/bookings.spec.ts` —
  ĐỎ: `BOOKINGS_SEARCH_MAX`, `BookingsListFacetsSchema`, `BookingsListResultSchema` chưa
  export; ca mặc định đỏ vì thiếu `order`.

- [ ] **Bước 3. Cài.** Trong `bookings.ts`:
  - dòng 2 thành `import { DecimalStringSchema, DestinationLinkSchema, PagedSchema } from './catalog.js';`
    và thêm `import { BookingWhenSchema } from './booking-phase.js';` ngay dưới
    `import { z } from 'zod';` (vòng import an toàn: `booking-phase.ts` chỉ import KIỂU từ
    file này, `verbatimModuleSyntax` xoá nó khi biên dịch);
  - thay trọn khối từ `/**\n * Query cho \`bookings.mine\`` (dòng 244) tới hết dòng
    `export type BookingsListQuery = z.output<typeof BookingsListQuerySchema>;` (dòng 256) bằng:

```ts
/** Trần ô tìm của danh sách đơn — web cắt chuỗi URL và đặt `maxLength` bằng CHÍNH số này. */
export const BOOKINGS_SEARCH_MAX = 80;

/**
 * Thứ tự của `bookings.mine` (ADR-0054 §2–3). `recent` (mặc định) giữ đúng `createdAt desc,
 * id asc` như trước cho trang Passport; `journey` là đang đi → sắp đi → đã qua, dành cho trang
 * My bookings — hai nhãn "Newer / Older trips" chỉ đúng với thứ tự này.
 */
export const BookingsListOrderSchema = z.enum(['recent', 'journey']);
export type BookingsListOrder = z.output<typeof BookingsListOrderSchema>;

/**
 * Query cho `bookings.mine`. Cùng quy ước pagination như list catalog (field gõ
 * kiểu thuần — ZodSmartCoercionPlugin lo coerce query string ở server).
 *
 * ADR-0054 §2 thêm ba trường TUỲ CHỌN, người gọi cũ không phải đổi gì. Mảng đi trên query
 * GET theo ký pháp ngoặc có chỉ số của oRPC: `when[0]=UPCOMING&when[1]=PAST`.
 */
export const BookingsListQuerySchema = z.object({
  // Cùng trần với PageQuerySchema (W4 R3, vòng vá review): offset tuỳ ý là
  // Postgres đếm qua từng row bị skip — kể cả trên list đã lọc theo user.
  page: z.int().min(1).max(10_000).default(1),
  limit: z.int().min(1).max(50).default(12),
  status: BookingStatusSchema.optional(),
  /** Nhóm thời gian của `bookingWhen`; nhiều giá trị là HOẶC. */
  when: z.array(BookingWhenSchema).min(1).max(3).optional(),
  /**
   * Tìm theo mã đơn, tên tour, tên điểm đến — server bỏ dấu và hạ chữ thường cả hai phía.
   * Cắt khoảng trắng TRƯỚC khi đo, nên chuỗi toàn khoảng trắng là 400.
   */
  q: z.string().trim().min(1).max(BOOKINGS_SEARCH_MAX).optional(),
  order: BookingsListOrderSchema.default('recent'),
});

export type BookingsListQuery = z.output<typeof BookingsListQuerySchema>;

/**
 * Số đơn theo từng lựa chọn của hai bộ lọc — đếm trên TOÀN BỘ đơn của khách, bỏ qua mọi bộ
 * lọc và từ khoá (ADR-0054 §2: con số đứng yên khi khách bấm). `z.record` với khoá enum của
 * Zod 4 đòi ĐỦ mọi khoá và từ chối khoá lạ, nên lựa chọn không có đơn vẫn có mặt với số 0.
 */
export const BookingsListFacetsSchema = z.object({
  when: z.record(BookingWhenSchema, z.int().nonnegative()),
  status: z.record(BookingStatusSchema, z.int().nonnegative()),
});

export type BookingsListFacets = z.output<typeof BookingsListFacetsSchema>;

/**
 * Output của `bookings.mine`: khuôn phân trang chung (`total`/`totalPages` tính SAU khi lọc)
 * cộng `facets` và `overallTotal` — tổng đơn của khách, không lọc, cho dòng "N trips" ở hero.
 * Mở rộng cho ĐÚNG route này, cùng lý do `BookingDetailSchema`: không đẩy field vào
 * `BookingSchema` dùng chung của cả chục route.
 */
export const BookingsListResultSchema = PagedSchema(BookingSchema).extend({
  facets: BookingsListFacetsSchema,
  overallTotal: z.int().nonnegative(),
});

export type BookingsListResult = z.output<typeof BookingsListResultSchema>;
```

- [ ] **Bước 4.** Chạy lại lệnh Bước 2 — XANH (ca cũ `BookingsListQuerySchema` dùng `toMatchObject`
  nên vẫn xanh). `pnpm --filter @tourism/contract typecheck` xanh. **Đột biến:** đổi
  `.default('recent')` thành `'journey'`; bỏ `.trim()` của `q`; đặt `.trim()` SAU `.max(...)`
  (ca `  x×80  ` phải đỏ); `.min(1)` của `when` thành `.min(0)`; `facets.when` thành
  `z.partialRecord(...)` (ca thiếu khoá phải đỏ); `.nonnegative()` của `status` bỏ đi.

- [ ] **Bước 5.** Build contract (lệnh ở Ràng buộc toàn cục). API, web, admin, mobile không đổi dòng
  nào mà vẫn biên dịch: trường mới đều tuỳ chọn, route chưa đổi. Chạy quy trình gate ở mục Ràng
  buộc toàn cục. Commit (stage `libs/shared/contract/src/schemas/bookings.ts`,
  `libs/shared/contract/src/schemas/bookings.spec.ts`):
  `feat(contract): bộ lọc, tìm, thứ tự và số đếm cho danh sách đơn của khách`

### Task 3 — A3 · API: lọc, tìm, xếp, đếm và cắt trang thuần (`booking-list.ts`)

**Files:**

- Create: `apps/api/src/modules/bookings/booking-list.ts`
- Test: `apps/api/src/modules/bookings/booking-list.spec.ts`

**Interfaces:**

- Consumes: `bookingPhase`, `bookingWhen` (Task A1); `foldAccents`
  (`libs/shared/contract/src/schemas/slug.ts:64` — bản bỏ dấu duy nhất của repo, ô tìm tour
  và blog của web cũng gọi nó); kiểu `BookingStatusValue`, `BookingsListFacets`,
  `BookingsListOrder`, `BookingWhen`.
- Produces: kiểu `BookingListKey`, `BookingListFilter`, `BookingListSelection`; hàm
  `searchKey(value)`, `matchesSearch(key, q)`,
  `selectBookingsPage(keys, filter, today): BookingListSelection`. `BookingListFilter` khớp
  cấu trúc `BookingsListQuery` của contract (sau Task A4 `status` là một giá trị HOẶC mảng)
  nên service truyền thẳng query vào.

Luật (ADR-0054 §3): `journey` = `ON_TOUR` theo ngày đi tăng → `UPCOMING` (gồm đơn chờ trả)
theo ngày đi tăng → `PAST` theo ngày đi giảm; hoà thì `createdAt` giảm dần rồi `id` tăng dần.
`recent` = `createdAt` giảm dần rồi `id` tăng dần (đúng `orderBy` cũ của service). `facets`
đếm trên TOÀN BỘ khoá trước khi lọc. Tìm: so trên khoá đã bỏ dấu, hạ chữ thường và bỏ mọi ký
tự không phải chữ hoặc số, ở cả hai phía (lý do ở quyết định 15).

- [ ] **Bước 1. Test trước.** Tạo `booking-list.spec.ts` (Vitest unit của API bật `globals`, như
  `booking-cancellation.spec.ts` cạnh đó):

```ts
import {
  type BookingListFilter,
  type BookingListKey,
  matchesSearch,
  searchKey,
  selectBookingsPage,
} from './booking-list.js';

/**
 * Lọc, tìm, xếp, đếm của `bookings.mine` (ADR-0054 §2–3), thuần trên tập khoá nhẹ. Hôm nay
 * cố định 05/10/2026. Bộ đơn dựng sao cho thứ tự hành trình KHÁC mọi thứ tự lười: thứ tự đưa
 * vào, ngày tạo tăng hay giảm, ngày đi tăng hay giảm, và "nhóm rồi theo ngày tạo".
 */
const TODAY = '2026-10-05';
const NOW = Date.parse('2026-10-05T03:00:00.000Z');

/** Một khoá; `id` trùng `code` để kết quả đọc được bằng mắt. */
function key(
  code: string,
  patch: Partial<Omit<BookingListKey, 'createdAt'>> & { minutesAgo: number },
): BookingListKey {
  const { minutesAgo, ...rest } = patch;
  return {
    id: code,
    code,
    status: 'PAID',
    createdAt: new Date(NOW - minutesAgo * 60_000),
    departureStartDate: '2026-11-01',
    departureEndDate: '2026-11-01',
    tourTitle: 'Test Tour',
    destinationNames: [],
    ...rest,
  };
}

/** Tám đơn quanh 05/10 — thứ tự đưa vào cố ý lộn xộn. */
const KEYS: BookingListKey[] = [
  key('BK-AWAITPAY', {
    status: 'PENDING',
    departureStartDate: '2026-10-25',
    departureEndDate: '2026-10-25',
    minutesAgo: 45,
  }),
  key('BK-TRAVELD1', {
    departureStartDate: '2026-09-05',
    departureEndDate: '2026-09-06',
    minutesAgo: 40,
  }),
  key('BK-ONTOUR01', {
    departureStartDate: '2026-10-04',
    departureEndDate: '2026-10-06',
    minutesAgo: 10,
  }),
  // Hoàn đủ mà ngày đi còn ở tương lai: thuộc nhóm ĐÃ QUA (sự thật 3 của ADR-0054).
  key('BK-REFUNDED', {
    status: 'REFUNDED',
    departureStartDate: '2026-10-20',
    departureEndDate: '2026-10-20',
    minutesAgo: 30,
  }),
  key('BK-UPCOMNG1', {
    departureStartDate: '2026-10-15',
    departureEndDate: '2026-10-16',
    minutesAgo: 60,
  }),
  // Chưa trả mà ngày đi đã qua: `lapsed`, nhóm ĐÃ QUA.
  key('BK-LAPSED01', {
    status: 'PENDING',
    departureStartDate: '2026-09-30',
    departureEndDate: '2026-09-30',
    minutesAgo: 90,
  }),
  // Hoàn một phần mà chuyến vẫn đi: đang đi như PAID.
  key('BK-PARTREF1', {
    status: 'PARTIALLY_REFUNDED',
    departureStartDate: '2026-10-03',
    departureEndDate: '2026-10-07',
    minutesAgo: 70,
  }),
  // Cùng ngày đi với UPCOMNG1 nhưng tạo SAU: hoà ngày đi thì đứng trước.
  key('BK-UPCOMNG2', {
    departureStartDate: '2026-10-15',
    departureEndDate: '2026-10-16',
    minutesAgo: 50,
  }),
];

const JOURNEY = [
  'BK-PARTREF1',
  'BK-ONTOUR01',
  'BK-UPCOMNG2',
  'BK-UPCOMNG1',
  'BK-AWAITPAY',
  'BK-REFUNDED',
  'BK-LAPSED01',
  'BK-TRAVELD1',
];
const RECENT = [
  'BK-ONTOUR01',
  'BK-REFUNDED',
  'BK-TRAVELD1',
  'BK-AWAITPAY',
  'BK-UPCOMNG2',
  'BK-UPCOMNG1',
  'BK-PARTREF1',
  'BK-LAPSED01',
];
const FULL_FACETS = {
  when: { ON_TOUR: 2, UPCOMING: 3, PAST: 3 },
  status: { PENDING: 2, PAID: 4, CANCELLED: 0, REFUNDED: 1, PARTIALLY_REFUNDED: 1 },
};

const filter = (patch: Partial<BookingListFilter> = {}): BookingListFilter => ({
  page: 1,
  limit: 50,
  order: 'journey',
  ...patch,
});
const ids = (patch: Partial<BookingListFilter> = {}) =>
  selectBookingsPage(KEYS, filter(patch), TODAY).pageIds;

describe('selectBookingsPage — thứ tự', () => {
  it('journey: đang đi → sắp đi (gồm chờ trả) theo ngày đi tăng → đã qua theo ngày đi giảm', () => {
    expect(ids()).toEqual(JOURNEY);
  });

  it('recent: ngày tạo giảm dần — đúng thứ tự trước ADR-0054', () => {
    expect(ids({ order: 'recent' })).toEqual(RECENT);
  });

  it('hoà cả ngày đi lẫn ngày tạo thì id tăng dần, bất kể thứ tự đọc từ DB', () => {
    const twin = (code: string) =>
      key(code, { departureStartDate: '2026-10-15', departureEndDate: '2026-10-15', minutesAgo: 5 });
    const forward = [twin('BK-ZZZZ0001'), twin('BK-AAAA0001')];
    for (const keys of [forward, [...forward].reverse()]) {
      for (const order of ['journey', 'recent'] as const) {
        expect(selectBookingsPage(keys, filter({ order }), TODAY).pageIds).toEqual([
          'BK-AAAA0001',
          'BK-ZZZZ0001',
        ]);
      }
    }
  });
});

describe('selectBookingsPage — cắt trang', () => {
  it('ba trang ba dòng nối lại đúng thứ tự journey, không trùng không sót', () => {
    const pages = [1, 2, 3].map((page) =>
      selectBookingsPage(KEYS, filter({ page, limit: 3 }), TODAY),
    );
    expect(pages.map((result) => result.pageIds)).toEqual([
      JOURNEY.slice(0, 3),
      JOURNEY.slice(3, 6),
      JOURNEY.slice(6),
    ]);
    expect(pages.map((result) => result.total)).toEqual([8, 8, 8]);
  });

  it('trang vượt số trang: không dòng nào, total giữ nguyên', () => {
    const beyond = selectBookingsPage(KEYS, filter({ page: 4, limit: 3 }), TODAY);
    expect(beyond.pageIds).toEqual([]);
    expect(beyond.total).toBe(8);
  });
});

describe('selectBookingsPage — lọc', () => {
  it('when nhiều giá trị là HOẶC', () => {
    expect(ids({ when: ['ON_TOUR', 'UPCOMING'] })).toEqual([
      'BK-PARTREF1',
      'BK-ONTOUR01',
      'BK-UPCOMNG2',
      'BK-UPCOMNG1',
      'BK-AWAITPAY',
    ]);
  });

  it('status nhiều giá trị là HOẶC', () => {
    expect(ids({ status: ['PENDING', 'REFUNDED'] })).toEqual([
      'BK-AWAITPAY',
      'BK-REFUNDED',
      'BK-LAPSED01',
    ]);
  });

  it('status một giá trị (cú pháp cũ `status=PAID`) vẫn lọc', () => {
    expect(ids({ status: 'PAID', order: 'recent' })).toEqual([
      'BK-ONTOUR01',
      'BK-TRAVELD1',
      'BK-UPCOMNG2',
      'BK-UPCOMNG1',
    ]);
  });

  it('hai trục là VÀ: PAST cộng PENDING chỉ còn đơn lỡ hạn', () => {
    expect(ids({ when: ['PAST'], status: ['PENDING'] })).toEqual(['BK-LAPSED01']);
  });
});

describe('selectBookingsPage — đếm', () => {
  it('facets đếm TOÀN BỘ đơn, bỏ qua bộ lọc và từ khoá; overallTotal không lọc', () => {
    const narrow = selectBookingsPage(
      KEYS,
      filter({ when: ['PAST'], status: ['PENDING'], q: 'nothing matches this' }),
      TODAY,
    );
    expect(narrow.total).toBe(0);
    expect(narrow.facets).toEqual(FULL_FACETS);
    expect(narrow.overallTotal).toBe(8);
  });

  it('khách chưa có đơn nào: đủ mọi khoá, toàn số 0', () => {
    expect(selectBookingsPage([], filter(), TODAY)).toEqual({
      pageIds: [],
      total: 0,
      facets: {
        when: { ON_TOUR: 0, UPCOMING: 0, PAST: 0 },
        status: { PENDING: 0, PAID: 0, CANCELLED: 0, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
      },
      overallTotal: 0,
    });
  });
});

describe('searchKey / matchesSearch (ADR-0054 §3)', () => {
  it.each([
    ['Hà Nội', 'hanoi'],
    ['Đà Lạt', 'dalat'],
    ['BK-B6VCOQNW', 'bkb6vcoqnw'],
    ['Ninh Bình: Tràng An', 'ninhbinhtrangan'],
  ])('searchKey(%j) = %j', (value, expected) => {
    expect(searchKey(value)).toBe(expected);
  });

  /** Tên tour KHÔNG chứa "Hanoi": khớp "ha noi" chỉ có thể đến từ tên điểm đến. */
  const OLD_QUARTER = key('BK-B6VCOQNW', {
    tourTitle: 'Old Quarter Food Walk',
    destinationNames: ['Hà Nội'],
    minutesAgo: 1,
  });

  it.each(['ha noi', 'hanoi', 'Hà Nội', 'HA NOI'])('tên điểm đến: %j khớp "Hà Nội"', (q) => {
    expect(matchesSearch(OLD_QUARTER, q)).toBe(true);
  });

  it.each(['quarter food', 'FOOD WALK'])('tên tour: %j', (q) => {
    expect(matchesSearch(OLD_QUARTER, q)).toBe(true);
  });

  it.each(['b6vcoqnw', 'BK-B6VC', 'bk b6vc'])('mã đơn có hay không có BK-: %j', (q) => {
    expect(matchesSearch(OLD_QUARTER, q)).toBe(true);
  });

  it.each(['hoi an', 'saigon', '!!!', ' - '])('không khớp: %j', (q) => {
    expect(matchesSearch(OLD_QUARTER, q)).toBe(false);
  });

  it('q lọc trước khi cắt trang; total đếm sau lọc, overallTotal thì không', () => {
    const lantern = key('BK-TRIP0002', {
      tourTitle: 'Hội An Old Town & Lantern Evening',
      destinationNames: ['Hội An'],
      minutesAgo: 2,
    });
    const result = selectBookingsPage([OLD_QUARTER, lantern], filter({ q: 'hoi an' }), TODAY);
    expect(result.pageIds).toEqual(['BK-TRIP0002']);
    expect(result.total).toBe(1);
    expect(result.overallTotal).toBe(2);
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/api exec vitest run src/modules/bookings/booking-list.spec.ts`
  — ĐỎ vì chưa có module `./booking-list.js`. (Contract đã build ở Task A1–A2; API đọc
  contract từ `dist`.)

- [ ] **Bước 3. Cài.** Tạo `booking-list.ts`:

```ts
import type {
  BookingStatusValue,
  BookingsListFacets,
  BookingsListOrder,
  BookingWhen,
} from '@tourism/contract';
import { bookingPhase, bookingWhen, foldAccents } from '@tourism/contract';

/**
 * Lọc, tìm, xếp, đếm và cắt trang của `bookings.mine` (ADR-0054 §2–3) — hàm THUẦN trên tập
 * khoá nhẹ của mọi đơn của MỘT khách. Service đọc khoá, gọi `selectBookingsPage`, rồi mới
 * nạp đủ dữ liệu cho đúng các id của trang. Tách khỏi service để test không cần DB.
 *
 * Không làm bằng SQL (ADR-0054 "Phương án đã loại"): luật giai đoạn ở contract là MỘT bản
 * cho cả web, còn bỏ dấu tiếng Việt cần extension `unaccent` mà DB chưa bật. Khách nhiều đơn
 * nhất trên prod có 14 đơn (05/10) — đọc hết rồi xếp ở đây không đáng kể.
 */

/** Phần nhẹ của một đơn mà lọc, tìm, xếp và đếm cần. */
export interface BookingListKey {
  id: string;
  code: string;
  status: BookingStatusValue;
  createdAt: Date;
  /** Ngày lịch `YYYY-MM-DD` (snapshot lúc đặt). */
  departureStartDate: string;
  departureEndDate: string;
  /** Snapshot tên tour lúc đặt — đúng chữ khách thấy trên dòng của mình. */
  tourTitle: string;
  /** Tên các điểm đến của tour, đọc sống như `tourDestinations` của `toBooking`. */
  destinationNames: readonly string[];
}

/** Bộ lọc của một lần gọi — cùng cấu trúc `BookingsListQuery` của contract. */
export interface BookingListFilter {
  page: number;
  limit: number;
  order: BookingsListOrder;
  when?: readonly BookingWhen[];
  /** Một giá trị (cú pháp cũ `status=PAID`) hoặc nhiều. */
  status?: BookingStatusValue | readonly BookingStatusValue[];
  q?: string;
}

export interface BookingListSelection {
  /** Id của trang được hỏi, đúng thứ tự hiển thị. */
  pageIds: string[];
  /** Số đơn khớp bộ lọc, trước khi cắt trang. */
  total: number;
  /** Đếm trên TOÀN BỘ đơn, bỏ qua bộ lọc (ADR-0054 §2). */
  facets: BookingsListFacets;
  /** Tổng đơn của khách, không lọc. */
  overallTotal: number;
}

/**
 * Khoá so khớp của ô tìm: bỏ dấu và hạ chữ thường bằng `foldAccents`, rồi bỏ MỌI ký tự không
 * phải chữ hoặc số. Bước cuối làm "hanoi" khớp "Hà Nội" và "bk b6vc" khớp "BK-B6VCOQNW":
 * ADR-0054 §3 hứa cả "ha noi" lẫn "hanoi" đều ra tour Hà Nội — chỉ bỏ dấu thì "hanoi" chỉ
 * khớp khi tên tour tình cờ viết liền.
 */
export function searchKey(value: string): string {
  return foldAccents(value).replace(/[^a-z0-9]/g, '');
}

/** Đơn có khớp từ khoá không: mã đơn, tên tour, hay tên một điểm đến. */
export function matchesSearch(key: BookingListKey, q: string): boolean {
  const needle = searchKey(q);
  // Từ khoá toàn ký hiệu ("!!!") không còn gì để so: không khớp đơn nào, thay vì khớp tất cả.
  if (needle === '') return false;
  return [key.code, key.tourTitle, ...key.destinationNames].some((text) =>
    searchKey(text).includes(needle),
  );
}

/** Hạng nhóm của thứ tự `journey`: đang đi → sắp đi → đã qua. */
const JOURNEY_RANK: Readonly<Record<BookingWhen, number>> = { ON_TOUR: 0, UPCOMING: 1, PAST: 2 };

interface PlacedKey {
  key: BookingListKey;
  when: BookingWhen;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Hoà: tạo sau đứng trước, rồi id tăng dần — đúng khoá phụ `createdAt desc, id asc` cũ. */
function compareTie(a: BookingListKey, b: BookingListKey): number {
  return b.createdAt.getTime() - a.createdAt.getTime() || compareText(a.id, b.id);
}

function compareRecent(a: PlacedKey, b: PlacedKey): number {
  return compareTie(a.key, b.key);
}

/**
 * `journey` (ADR-0054 §3): xếp theo hạng nhóm; trong `ON_TOUR` và `UPCOMING` ngày đi TĂNG dần
 * (việc gần nhất trước), trong `PAST` ngày đi GIẢM dần (ký ức gần nhất trước).
 */
function compareJourney(a: PlacedKey, b: PlacedKey): number {
  const rank = JOURNEY_RANK[a.when] - JOURNEY_RANK[b.when];
  if (rank !== 0) return rank;
  const byStart = compareText(a.key.departureStartDate, b.key.departureStartDate);
  return (a.when === 'PAST' ? -byStart : byStart) || compareTie(a.key, b.key);
}

/** `status` một giá trị hoặc mảng → tập; `null` là không lọc. */
function statusSet(status: BookingListFilter['status']): ReadonlySet<BookingStatusValue> | null {
  if (status === undefined) return null;
  return new Set(typeof status === 'string' ? [status] : status);
}

export function selectBookingsPage(
  keys: readonly BookingListKey[],
  filter: BookingListFilter,
  today: string,
): BookingListSelection {
  // Đủ mọi khoá ngay từ đầu: contract đòi record ĐỦ (lựa chọn không có đơn vẫn là 0).
  const facets: BookingsListFacets = {
    when: { ON_TOUR: 0, UPCOMING: 0, PAST: 0 },
    status: { PENDING: 0, PAID: 0, CANCELLED: 0, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
  };
  const placed = keys.map((key): PlacedKey => {
    const when = bookingWhen(bookingPhase(key, today));
    facets.when[when] += 1;
    facets.status[key.status] += 1;
    return { key, when };
  });

  const whens = filter.when === undefined ? null : new Set(filter.when);
  const statuses = statusSet(filter.status);
  const matched = placed.filter(
    ({ key, when }) =>
      (whens === null || whens.has(when)) &&
      (statuses === null || statuses.has(key.status)) &&
      (filter.q === undefined || matchesSearch(key, filter.q)),
  );
  matched.sort(filter.order === 'journey' ? compareJourney : compareRecent);

  const start = (filter.page - 1) * filter.limit;
  return {
    pageIds: matched.slice(start, start + filter.limit).map(({ key }) => key.id),
    total: matched.length,
    facets,
    overallTotal: keys.length,
  };
}
```

- [ ] **Bước 4.** Chạy lại lệnh Bước 2 — XANH. `pnpm --filter @tourism/api typecheck` xanh. **Đột biến**
  (mỗi cái một lần, thấy đỏ, trả lại): bỏ `.replace(/[^a-z0-9]/g, '')` (ca `hanoi`, `bk b6vc`
  đỏ); bỏ guard `needle === ''` (ca `!!!` đỏ); bỏ `-` trước `byStart` ở nhánh `PAST` (ca
  journey đỏ); đổi hạng `UPCOMING: 1` và `PAST: 2` cho nhau; `b.createdAt - a.createdAt` thành
  `a - b` (ca recent và ca UPCOMNG2/UPCOMNG1 đỏ); `compareText(a.id, b.id)` thành
  `compareText(b.id, a.id)` (ca hoà đỏ); đếm facets trên `matched` thay vì `placed` (ca facets
  đỏ); `slice(start, start + filter.limit)` thành `slice(start, filter.limit)` (trang 2 đỏ);
  `statusSet` bỏ nhánh chuỗi (`new Set(status)` trên chuỗi — ca `status: 'PAID'` đỏ); bỏ
  `...key.destinationNames` (ca "ha noi" đỏ).

- [ ] **Bước 5.** Chạy quy trình gate ở mục Ràng buộc toàn cục. Commit (stage
  `apps/api/src/modules/bookings/booking-list.ts`,
  `apps/api/src/modules/bookings/booking-list.spec.ts`):
  `feat(api): lọc, tìm, xếp và đếm danh sách đơn của khách trên tập khoá nhẹ`

### Task 4 — A4 · Contract + API: `status` nhận mảng, `bookings.mine` mới, int test

**Files:**

- Modify: `libs/shared/contract/src/schemas/bookings.ts` (dòng `status:` của
  `BookingsListQuerySchema`)
- Modify: `libs/shared/contract/src/schemas/bookings.spec.ts` (thêm cuối file)
- Modify: `libs/shared/contract/src/contract.ts` (import dòng 59–71; route `mine` dòng 550–557)
- Modify: `libs/shared/contract/src/contract.spec.ts` (import đầu file; thêm hai ca)
- Modify: `apps/api/src/modules/bookings/bookings.service.ts` (import dòng 2–10 và 41–43;
  `mine` dòng 677–715)
- Modify: `apps/api/src/modules/bookings/bookings.int.spec.ts` (import dòng 3–9; describe mới
  chèn trước ca `GET /api/bookings/{code} is owner-or-404`, dòng 762)

**Interfaces:**

- Consumes: `BookingsListResultSchema` (Task A2), `selectBookingsPage` + `BookingListKey`
  (Task A3), `bookingTourInclude`, `toBooking`, `pickCover`, `calendarDate`, `vietnamToday`
  (đã import ở service).
- Produces: `BookingsListQuerySchema.status` nhận một giá trị HOẶC mảng 1–5; route
  `bookings.mine` `.output(BookingsListResultSchema)`;
  `BookingsService.mine(userId, query): Promise<BookingsListResult>`. `GET /api/bookings`
  không truyền tham số mới thì trả y như cũ, cộng hai trường `facets`, `overallTotal`.

- [ ] **Bước 1. Test trước — contract.** Thêm CUỐI `bookings.spec.ts`:

```ts
describe('BookingsListQuerySchema.status — một giá trị hoặc mảng (ADR-0054 §2)', () => {
  it('một giá trị kiểu cũ vẫn nhận (`?status=PAID`)', () => {
    expect(BookingsListQuerySchema.parse({ status: 'PAID' }).status).toBe('PAID');
  });

  it('mảng 1–5 giá trị hợp lệ', () => {
    expect(BookingsListQuerySchema.parse({ status: ['PAID', 'CANCELLED'] }).status).toEqual([
      'PAID',
      'CANCELLED',
    ]);
    expect(BookingsListQuerySchema.safeParse({ status: [] }).success).toBe(false);
    expect(BookingsListQuerySchema.safeParse({ status: ['PAID', 'NOPE'] }).success).toBe(false);
    expect(
      BookingsListQuerySchema.safeParse({
        status: ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'PAID'],
      }).success,
    ).toBe(false);
  });
});
```

  Trong `contract.spec.ts` thêm import (để `pnpm lint:fix` xếp chỗ):

```ts
import { type BookingsListResult, BookingsListResultSchema } from './schemas/bookings.js';
```

  thêm ca này ngay sau ca `bookings.create declares its typed business errors…` (trong describe
  `contract routes`):

```ts
  it('bookings.mine trả BookingsListResult — phân trang cộng facets và overallTotal (ADR-0054)', () => {
    expect(contract.bookings.mine['~orpc'].outputSchema).toBe(BookingsListResultSchema);
  });
```

  và ca này cuối describe `contract type inference`:

```ts
  it('bookings.mine output infers as BookingsListResult', () => {
    expectTypeOf<ContractOutputs['bookings']['mine']>().toEqualTypeOf<BookingsListResult>();
  });
```

- [ ] **Bước 2.** `pnpm --filter @tourism/contract exec vitest run src/schemas/bookings.spec.ts src/contract.spec.ts`
  — ĐỎ: mảng `status` bị từ chối; `outputSchema` vẫn là `PagedSchema(BookingSchema)`.
  `pnpm --filter @tourism/contract typecheck` — ĐỎ ở ca `expectTypeOf` (output thiếu `facets`).

- [ ] **Bước 3. Cài — contract.** Trong `bookings.ts`, thay dòng
  `  status: BookingStatusSchema.optional(),` của `BookingsListQuerySchema` (KHÔNG phải dòng
  cùng chữ của `AdminBookingsListQuerySchema` phía dưới) bằng:

```ts
  /**
   * Một giá trị (`status=PAID`, người gọi cũ) hoặc mảng (`status[0]=PAID&status[1]=CANCELLED`);
   * nhiều giá trị là HOẶC. Trần 5 = số giá trị của `BookingStatusSchema`.
   */
  status: z.union([BookingStatusSchema, z.array(BookingStatusSchema).min(1).max(5)]).optional(),
```

  Trong `contract.ts`: thêm `BookingsListResultSchema,` vào khối import từ
  `'./schemas/bookings.js'` ngay sau `BookingsListQuerySchema,`; thay khối route `mine`
  (dòng 550–557):

```ts
    mine: oc
      .route({
        method: 'GET',
        path: '/api/bookings',
        summary: 'List own bookings with filters, search, journey order and facet counts (authed, paged)',
      })
      .input(BookingsListQuerySchema)
      // ADR-0054: `facets` đếm trên MỌI đơn của khách, bỏ qua bộ lọc; `overallTotal` không lọc.
      .output(BookingsListResultSchema),
```

  `PagedSchema` vẫn còn 12 chỗ khác dùng trong `contract.ts` — giữ import.

- [ ] **Bước 4.** Chạy lại hai lệnh Bước 2 — XANH. Build contract (lệnh ở Ràng buộc toàn cục).
  `pnpm --filter @tourism/api typecheck` lúc này ĐỎ ở `bookings.controller.ts` (handler trả
  `Paged<Booking>` thiếu `facets`) và ở `bookings.service.ts` (`status` mảng không gán được cho
  `where`) — đúng chỗ Bước 6 sửa.

- [ ] **Bước 5. Test trước — int.** Trong `bookings.int.spec.ts`, thêm `BookingsListResultSchema`
  vào khối import từ `'@tourism/contract'` (dòng 3–9). Chèn describe này ngay TRƯỚC dòng
  `  it('GET /api/bookings/{code} is owner-or-404', async () => {` (vẫn trong describe gốc, để
  dùng `vnDay`, `dayTour`, `unpublishedTour`, `depOpen`, `signUpUser`; `beforeEach` gốc đã
  TRUNCATE `users`, `bookings` trước mỗi ca):

```ts
  describe('GET /api/bookings — lọc, tìm, thứ tự hành trình (ADR-0054)', () => {
    /** Một đơn dựng thẳng bằng Prisma: lệnh tạo đơn của API không ra được trạng thái và ngày tuỳ ý. */
    interface SeedRow {
      code: string;
      status: BookingStatus;
      /** Ngày đi, tính bằng số ngày so với hôm nay giờ Việt Nam (`vnDay`). */
      start: number;
      end?: number;
      /** Tạo cách đây bao nhiêu phút — chọn để thứ tự `journey` khác hẳn `recent`. */
      minutesAgo: number;
      tourId?: string;
      tourTitle?: string;
    }

    async function seedBookings(email: string, rows: SeedRow[]): Promise<string> {
      const cookie = await signUpUser(email);
      const { id: userId } = await prisma.user.findUniqueOrThrow({
        where: { email },
        select: { id: true },
      });
      const now = Date.now();
      await prisma.booking.createMany({
        data: rows.map(
          (row): Prisma.BookingCreateManyInput => ({
            code: row.code,
            userId,
            tourId: row.tourId ?? dayTour.id,
            departureId: depOpen.id,
            numAdults: 1,
            totalAmount: '39.00',
            unitPrice: '39.00',
            currency: 'USD',
            status: row.status,
            tourTitle: row.tourTitle ?? dayTour.title,
            departureStartDate: vnDay(row.start),
            departureEndDate: vnDay(row.end ?? row.start),
            contactName: 'Alice Nguyen',
            contactEmail: email,
            paymentProvider: 'STRIPE',
            createdAt: new Date(now - row.minutesAgo * 60_000),
          }),
        ),
      });
      return cookie;
    }

    /** Mảng đi theo ký pháp ngoặc của oRPC; `URLSearchParams` mã hoá `[` `]` như trình duyệt. */
    async function listMine(cookie: string, params: Record<string, string> = {}) {
      const search = new URLSearchParams(params).toString();
      const res = await app.inject({
        method: 'GET',
        url: search === '' ? '/api/bookings' : `/api/bookings?${search}`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      return BookingsListResultSchema.parse(res.json());
    }

    const codes = (result: { items: Array<{ code: string }> }) =>
      result.items.map((item) => item.code);

    /**
     * Tám đơn quanh hôm nay, đưa vào LỘN XỘN; ngày tạo không đi cùng chiều thứ tự nào. Mép
     * ngày rộng hơn một ngày ở mọi phía: file chạy vắt qua nửa đêm giờ Việt Nam vẫn đúng.
     */
    const JOURNEY_ROWS: SeedRow[] = [
      { code: 'BK-AWAITPAY', status: BookingStatus.PENDING, start: 20, minutesAgo: 45 },
      { code: 'BK-TRAVELD1', status: BookingStatus.PAID, start: -30, end: -29, minutesAgo: 40 },
      { code: 'BK-ONTOUR01', status: BookingStatus.PAID, start: -1, end: 1, minutesAgo: 10 },
      { code: 'BK-REFUNDED', status: BookingStatus.REFUNDED, start: 15, minutesAgo: 30 },
      { code: 'BK-UPCOMNG1', status: BookingStatus.PAID, start: 10, end: 11, minutesAgo: 60 },
      { code: 'BK-LAPSED01', status: BookingStatus.PENDING, start: -5, minutesAgo: 90 },
      {
        code: 'BK-PARTREF1',
        status: BookingStatus.PARTIALLY_REFUNDED,
        start: -2,
        end: 2,
        minutesAgo: 70,
      },
      { code: 'BK-UPCOMNG2', status: BookingStatus.PAID, start: 10, end: 11, minutesAgo: 50 },
    ];
    const JOURNEY = [
      'BK-PARTREF1',
      'BK-ONTOUR01',
      'BK-UPCOMNG2',
      'BK-UPCOMNG1',
      'BK-AWAITPAY',
      'BK-REFUNDED',
      'BK-LAPSED01',
      'BK-TRAVELD1',
    ];
    const FULL_FACETS = {
      when: { ON_TOUR: 2, UPCOMING: 3, PAST: 3 },
      status: { PENDING: 2, PAID: 4, CANCELLED: 0, REFUNDED: 1, PARTIALLY_REFUNDED: 1 },
    };

    it('journey liền mạch qua ba trang; facets và overallTotal chỉ đếm đơn của chính mình', async () => {
      const alice = await seedBookings('journey@example.com', JOURNEY_ROWS);
      await seedBookings('journey-bob@example.com', [
        { code: 'BK-BOBTRIP1', status: BookingStatus.PAID, start: 10, minutesAgo: 5 },
      ]);

      // Tuần tự, không `Promise.all`: ba trang đọc cùng một tập, thứ tự gọi không đổi gì.
      const pages = [
        await listMine(alice, { order: 'journey', limit: '3', page: '1' }),
        await listMine(alice, { order: 'journey', limit: '3', page: '2' }),
        await listMine(alice, { order: 'journey', limit: '3', page: '3' }),
      ];

      expect(pages.map(codes)).toEqual([JOURNEY.slice(0, 3), JOURNEY.slice(3, 6), JOURNEY.slice(6)]);
      for (const page of pages) {
        expect(page).toMatchObject({
          limit: 3,
          total: 8,
          totalPages: 3,
          overallTotal: 8,
          facets: FULL_FACETS,
        });
      }
    });

    it('lọc when và nhiều status bằng ký pháp mảng; facets bỏ qua bộ lọc; status kiểu cũ vẫn nhận', async () => {
      const alice = await seedBookings('filters@example.com', JOURNEY_ROWS);

      const soon = await listMine(alice, {
        order: 'journey',
        'when[0]': 'ON_TOUR',
        'when[1]': 'UPCOMING',
      });
      expect(codes(soon)).toEqual(JOURNEY.slice(0, 5));
      expect(soon).toMatchObject({ total: 5, overallTotal: 8, facets: FULL_FACETS });

      const unpaid = await listMine(alice, {
        order: 'journey',
        'status[0]': 'PENDING',
        'status[1]': 'REFUNDED',
      });
      expect(codes(unpaid)).toEqual(['BK-AWAITPAY', 'BK-REFUNDED', 'BK-LAPSED01']);
      expect(unpaid.facets).toEqual(FULL_FACETS);

      const lapsed = await listMine(alice, {
        order: 'journey',
        'when[0]': 'PAST',
        'status[0]': 'PENDING',
      });
      expect(codes(lapsed)).toEqual(['BK-LAPSED01']);

      // Cú pháp cũ một giá trị, thứ tự mặc định `recent` (ngày tạo giảm dần).
      const paid = await listMine(alice, { status: 'PAID' });
      expect(codes(paid)).toEqual(['BK-ONTOUR01', 'BK-TRAVELD1', 'BK-UPCOMNG2', 'BK-UPCOMNG1']);
    });

    it('q khớp mã có và không có BK-, tên tour, tên điểm đến khi gõ không dấu', async () => {
      const alice = await seedBookings('search@example.com', [
        // Tour Hà Nội, tên snapshot KHÔNG chứa "Hanoi", mã không chứa chữ nào được tìm.
        {
          code: 'BK-TRIP0001',
          status: BookingStatus.PAID,
          start: 10,
          minutesAgo: 30,
          tourId: unpublishedTour.id,
          tourTitle: 'Old Quarter Food Walk',
        },
        {
          code: 'BK-TRIP0002',
          status: BookingStatus.PAID,
          start: 11,
          minutesAgo: 20,
          tourTitle: 'Hội An Old Town & Lantern Evening',
        },
        // Tour Hội An, tên không có "Hội An": khớp "hoi an" chỉ có thể nhờ tên điểm đến.
        {
          code: 'BK-B6VCOQNW',
          status: BookingStatus.PAID,
          start: 12,
          minutesAgo: 10,
          tourTitle: 'Riverside Supper Cruise',
        },
      ]);
      const search = async (q: string) => codes(await listMine(alice, { order: 'journey', q }));

      for (const q of ['ha noi', 'hanoi', 'Hà Nội']) {
        expect(await search(q)).toEqual(['BK-TRIP0001']);
      }
      expect(await search('lantern')).toEqual(['BK-TRIP0002']);
      expect(await search('b6vcoqnw')).toEqual(['BK-B6VCOQNW']);
      expect(await search('BK-B6VC')).toEqual(['BK-B6VCOQNW']);
      expect(await search('hoi an')).toEqual(['BK-TRIP0002', 'BK-B6VCOQNW']);

      const one = await listMine(alice, { q: 'ha noi' });
      expect(one).toMatchObject({ total: 1, totalPages: 1, overallTotal: 3 });
      expect(one.facets.status).toEqual({
        PENDING: 0,
        PAID: 3,
        CANCELLED: 0,
        REFUNDED: 0,
        PARTIALLY_REFUNDED: 0,
      });
    });

    it('không truyền tham số mới: thứ tự recent, 12 dòng — như trước ADR-0054', async () => {
      const alice = await seedBookings('defaults@example.com', JOURNEY_ROWS);

      const all = await listMine(alice);
      expect(all).toMatchObject({ page: 1, limit: 12, total: 8, totalPages: 1, overallTotal: 8 });
      expect(codes(all)).toEqual([
        'BK-ONTOUR01',
        'BK-REFUNDED',
        'BK-TRAVELD1',
        'BK-AWAITPAY',
        'BK-UPCOMNG2',
        'BK-UPCOMNG1',
        'BK-PARTREF1',
        'BK-LAPSED01',
      ]);
    });

    it('giá trị lạ của bộ lọc là 400, không lặng lẽ bỏ qua', async () => {
      const alice = await seedBookings('invalid@example.com', []);
      for (const query of ['when%5B0%5D=SOMEDAY', 'order=price', 'q=%20%20']) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/bookings?${query}`,
          headers: { cookie: alice },
        });
        expect(res.statusCode).toBe(400);
      }
    });
  });

```

- [ ] **Bước 6.** `(cd apps/api && pnpm exec vitest run --config out/iso-int/vitest.int.iso.config.ts src/modules/bookings/bookings.int.spec.ts)`
  — ĐỎ: route đã khai output mới nên mọi `GET /api/bookings` trả 500 (output thiếu `facets`),
  kể cả ca cũ `GET /api/bookings returns OWN bookings only…` và ca BK-1. Đó là lý do đỏ đúng.
  Lệnh chạy trên DB riêng `tourism_test_p7` (mục "Chạy song song" của Ràng buộc toàn cục — ba
  file tạm phải có trước); khi session gốc báo không còn ai chạy song song thì thay
  `out/iso-int/vitest.int.iso.config.ts` bằng `vitest.int.config.ts`.

- [ ] **Bước 7. Cài — service.** Trong `bookings.service.ts`:
  - thêm `BookingsListResult,` vào khối `import type {…} from '@tourism/contract'` (dòng 2–10),
    ngay sau `BookingsListQuery,`;
  - thêm `import { selectBookingsPage } from './booking-list.js';` ngay sau dòng
    `import { mintBookingCode } from './booking-code.js';`;
  - thay trọn JSDoc và thân `mine` (từ dòng `  /** Booking của chính user, mới nhất trước (id làm tiebreak ổn định), status`
    tới dấu `}` đóng hàm ngay trước JSDoc của `byCode`) bằng:

```ts
  /**
   * Đơn của chính user (ADR-0054 §3): đọc tập khoá NHẸ của mọi đơn, để `selectBookingsPage`
   * gắn giai đoạn, lọc, tìm, đếm, xếp và cắt trang; rồi mới nạp đủ dòng cho đúng các id của
   * trang — giữ nguyên thứ tự hàm thuần trả về (`IN (…)` không giữ thứ tự nào).
   *
   * Giá: mỗi lần gọi đọc mọi đơn của một khách ở dạng nhẹ — nhiều nhất trên prod là 14 đơn
   * (05/10). `cancellationStatus`, `refundedTotal`, `reviewedAt` vẫn để mặc định của
   * `toBooking` (Task 6a, A2): danh sách không gánh N query phụ cho trường chỉ trang chi tiết
   * (`byCode`) cần.
   */
  async mine(userId: string, query: BookingsListQuery): Promise<BookingsListResult> {
    const keyRows = await prisma.booking.findMany({
      where: { userId },
      select: {
        id: true,
        code: true,
        status: true,
        createdAt: true,
        departureStartDate: true,
        departureEndDate: true,
        tourTitle: true,
        tour: {
          select: { destinations: { select: { destination: { select: { name: true } } } } },
        },
      },
    });
    const selection = selectBookingsPage(
      keyRows.map((row) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        createdAt: row.createdAt,
        departureStartDate: calendarDate(row.departureStartDate),
        departureEndDate: calendarDate(row.departureEndDate),
        tourTitle: row.tourTitle,
        destinationNames: row.tour.destinations.map((link) => link.destination.name),
      })),
      query,
      vietnamToday(new Date()),
    );

    // Câu thứ hai chỉ cho các id của trang; `userId` lặp lại làm hàng rào thứ hai.
    const rows =
      selection.pageIds.length === 0
        ? []
        : await prisma.booking.findMany({
            where: { id: { in: selection.pageIds }, userId },
            include: { tour: bookingTourInclude },
          });
    const byId = new Map(rows.map((row) => [row.id, row]));
    // Một đơn biến mất giữa hai câu đọc (tài khoản vừa xoá) thì rơi khỏi trang, không ném.
    const ordered = selection.pageIds.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });

    // MỘT query media cho cả trang (chống N+1, cùng khuôn `catalog.listTours`).
    const coverMap = await this.media.resolveForOwners(
      MediaOwnerType.TOUR,
      ordered.map((row) => row.tourId),
      // Chỉ cần cover cho hàng danh sách (W4 R3).
      [MediaRole.hero],
    );

    return {
      items: ordered.map((row) => toBooking(row, null, pickCover(coverMap.get(row.tourId)))),
      page: query.page,
      limit: query.limit,
      total: selection.total,
      totalPages: Math.ceil(selection.total / query.limit),
      facets: selection.facets,
      overallTotal: selection.overallTotal,
    };
  }
```

  `Paged` vẫn còn `adminList` dùng — giữ import. Controller (`bookings.controller.ts:87-92`)
  không đổi: handler trả thẳng kết quả của `mine`.

- [ ] **Bước 8.** Chạy lại lệnh Bước 6 — XANH, gồm cả ca cũ (`PagedSchema(BookingSchema).parse` bỏ
  qua hai trường thừa) và ca 401. `pnpm --filter @tourism/api typecheck` xanh;
  `pnpm --filter @tourism/api exec vitest run src/modules/bookings/booking-list.spec.ts` xanh.
  **Đột biến** (mỗi cái một lần): trả `rows` theo thứ tự `findMany` thay vì `ordered` (ca
  journey đỏ — thứ tự đưa vào cố ý lộn xộn); gán cứng `order: 'recent'` khi gọi
  `selectBookingsPage` (ca journey đỏ); `destinationNames: []` (ca "ha noi" đỏ); bỏ `userId`
  khỏi `where` câu khoá (ca overallTotal đỏ — tính cả đơn của Bob).

- [ ] **Bước 9.** Chạy quy trình gate ở mục Ràng buộc toàn cục (bước 5 phải xanh TRỌN, gồm
  `refunds.int.spec.ts`, `cancellations.int.spec.ts`). Commit (stage
  `libs/shared/contract/src/schemas/bookings.ts`,
  `libs/shared/contract/src/schemas/bookings.spec.ts`,
  `libs/shared/contract/src/contract.ts`, `libs/shared/contract/src/contract.spec.ts`,
  `apps/api/src/modules/bookings/bookings.service.ts`,
  `apps/api/src/modules/bookings/bookings.int.spec.ts`):
  `feat(api): bookings.mine lọc theo thời gian và trạng thái, tìm, xếp theo hành trình`

### Task 5 — A5 · Web: `ContentHero` có nút quay lại (`back`)

**Files:**

- Modify: `apps/web/src/components/content/content-hero.tsx` (import dòng 3–7; props dòng
  15–31; hàng breadcrumb dòng 53–78)
- Create (test): `apps/web/src/components/content/content-hero.spec.tsx` — hero chưa có spec

**Interfaces:**

- Consumes: không có gì mới.
- Produces: prop `back?: { href: string; label: string }` của `ContentHero` — đúng chữ ký ở
  "Giao diện dùng chung". Phần B truyền `{ href: '/account/bookings', label: … }`.

- [ ] **Bước 1. Test trước.** Tạo `content-hero.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContentHero } from './content-hero';

/**
 * Nút quay lại của hero (spec P7 §4.1). Mười bảy trang đang dùng hero không truyền `back`,
 * nên ca thứ hai canh DOM của chúng không đổi.
 */
describe('ContentHero — nút quay lại', () => {
  it('có `back`: link tròn đứng TRƯỚC breadcrumb, tên đọc và tooltip là nhãn', () => {
    render(
      <ContentHero
        breadcrumb="Bookings"
        title="My bookings"
        back={{ href: '/account', label: 'Back to Passport' }}
      />,
    );
    const back = screen.getByRole('link', { name: 'Back to Passport' });
    expect(back).toHaveAttribute('href', '/account');
    expect(back).toHaveAttribute('title', 'Back to Passport');
    // Chỉ có icon — không chữ nào thấy được.
    expect(back.textContent).toBe('');
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(back.compareDocumentPosition(crumb)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('không có `back`: breadcrumb đứng thẳng trong hàng như cũ, link duy nhất là Home', () => {
    render(<ContentHero breadcrumb="Terms" title="Terms of service" />);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Home']);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).parentElement).toHaveClass(
      'justify-between',
    );
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/web exec vitest run src/components/content/content-hero.spec.tsx`
  — ĐỎ ở ca đầu (không có link "Back to Passport"); ca thứ hai đã xanh (canh hồi quy).

- [ ] **Bước 3. Cài.** Trong `content-hero.tsx`:
  - dòng 3 thành `import { ArrowLeftIcon, ChevronRightIcon } from 'lucide-react';` và thêm
    `import Link from 'next/link';` ngay dưới `import { motion } from 'motion/react';`;
  - thêm prop `back` vào cả danh sách tham số (sau `action,`) lẫn kiểu (sau khai báo
    `action?: ReactNode;`):

```tsx
  /**
   * Nút tròn quay lại, đứng TRƯỚC breadcrumb (spec P7 §4.1). Chỉ có icon, nên `label` vừa là
   * tên đọc-màn-hình vừa là tooltip. Không truyền thì DOM y như trước — các trang đang dùng
   * hero không đổi một nút nào.
   */
  back?: { href: string; label: string };
```

  - ngay trước `return (` thêm:

```tsx
  // Breadcrumb dựng MỘT lần, đặt vào một trong hai chỗ: có `back` thì cùng nút vào một hàng
  // con, không có thì đứng thẳng trong hàng như trước.
  const breadcrumbNav = (
    <motion.nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm text-muted-foreground"
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1, ...SPRING }}
    >
      <a href="/" className="transition-colors hover:text-foreground">
        Home
      </a>
      <ChevronRightIcon className="size-3.5" aria-hidden="true" />
      <span aria-current="page" className="text-foreground">
        {breadcrumb}
      </span>
    </motion.nav>
  );
```

  - thay khối `<motion.nav …>…</motion.nav>` đang nằm trong
    `<div className="flex items-center justify-between gap-4">` (dòng 54–68) bằng:

```tsx
            {back ? (
              // Cách breadcrumb 12px như bản vẽ `booking-list.src.html` (`.x-crumbrow`).
              <div className="flex min-w-0 items-center gap-3">
                <motion.div
                  initial={{ y: -16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, ...SPRING }}
                >
                  {/* Viền và nền là `foreground` mờ: trong scope `dark` của hero nó là chữ
                      sáng, nên ra đúng "viền trắng mờ trên nền tối" mà vẫn tokens-only. */}
                  <Link
                    href={back.href}
                    aria-label={back.label}
                    title={back.label}
                    className="grid size-8.5 place-items-center rounded-full border border-foreground/30 bg-foreground/5 text-foreground transition-colors outline-none hover:bg-foreground/15 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <ArrowLeftIcon aria-hidden="true" className="size-4" />
                  </Link>
                </motion.div>
                {breadcrumbNav}
              </div>
            ) : (
              breadcrumbNav
            )}
```

  Khối `{action ? (…) : null}` ngay sau giữ nguyên.

- [ ] **Bước 3b.** Trước khi chạy lại, đọc `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`
  (Next 16): `Link` dùng được trong Client Component, không cần prop nào thêm.

- [ ] **Bước 4.** Chạy lại lệnh Bước 2 — XANH. `pnpm --filter @tourism/web typecheck` xanh. **Đột
  biến:** luôn bọc `breadcrumbNav` trong `div` kể cả khi không có `back` (ca hai đỏ); bỏ
  `title` (ca một đỏ); đặt `{breadcrumbNav}` TRƯỚC `motion.div` (ca một đỏ — vị trí). Bỏ
  `aria-label` KHÔNG giết được: `title` vẫn cho link cái tên ấy — ghi vào bàn giao, giữ cả hai
  thuộc tính vì spec §4.1 đòi cả hai.

- [ ] **Bước 5.** Chạy quy trình gate ở mục Ràng buộc toàn cục. Commit (stage
  `apps/web/src/components/content/content-hero.tsx`,
  `apps/web/src/components/content/content-hero.spec.tsx`):
  `feat(web): ContentHero có nút quay lại cạnh breadcrumb`

### Task 6 — A6 · Web: tham số URL, input API và phân trang của My bookings (`lib/bookings-list.ts`)

**Files:**

- Create: `apps/web/src/lib/bookings-list.ts`
- Test: `apps/web/src/lib/bookings-list.spec.ts`
- Modify: `apps/web/src/lib/api/bookings.ts` (import dòng 1–4; thêm hàm sau `fetchMyBookings`)
- Create (test): `apps/web/src/lib/api/bookings.spec.ts`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `accountBookings`, dòng 2424–2442)

**Interfaces:**

- Consumes: `BOOKINGS_SEARCH_MAX`, `BookingWhenSchema`, `BookingStatusSchema`, kiểu
  `BookingWhen`, `BookingStatusValue`, `BookingsListResult`, `ContractInputs` (contract);
  `listParam`, `singleParam`, `RawSearchParam` (`apps/web/src/lib/search-params.ts`).
- Produces (dùng ở A7, A8, A9):
  - `BOOKINGS_LIST_PATH` = `'/account/bookings'`, `BOOKINGS_LIST_LIMIT` = 10;
  - kiểu `BookingsListParams { q: string | null; when: BookingWhen[]; status: BookingStatusValue[]; page: number }`,
    hằng `EMPTY_BOOKINGS_LIST_PARAMS`;
  - `searchTermOf(text): string | null`, `toggleValue(list, value)`,
    `hasListFilters(params)`, `bookingsListParams(searchParams)`, `bookingsListHref(params)`,
    `bookingsListApiInput(params): ContractInputs['bookings']['mine']`;
  - kiểu `PagerView { summary; newerHref: string | null; older: { href; range } | null }`,
    `pagerView(params, totalPages, total, limit): PagerView | null`;
  - `fetchMyBookingsPage(cookie, input): Promise<BookingsListResult>` ở `lib/api/bookings.ts`;
  - khoá i18n `accountBookings.pageSummary`, `accountBookings.olderRange`.

Định dạng URL (spec §2.7): `?q=…&when=upcoming,past&status=paid&page=2` — giá trị viết thường,
nhiều giá trị ngăn bằng dấu phẩy, giá trị lạ bỏ qua, `page` không hợp lệ về 1. Chữ ký
`pagerView` nhận cả `params` thay vì riêng `page` như spec §4.2 ghi: link Newer/Older phải giữ
bộ lọc (spec §7.4), nên hàm cần bộ lọc để dựng href.

- [ ] **Bước 1. Test trước.** Tạo `bookings-list.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  BOOKINGS_LIST_LIMIT,
  type BookingsListParams,
  bookingsListApiInput,
  bookingsListHref,
  bookingsListParams,
  EMPTY_BOOKINGS_LIST_PARAMS,
  hasListFilters,
  pagerView,
  searchTermOf,
  toggleValue,
} from './bookings-list';

/**
 * Trạng thái của My bookings nằm trọn trên URL (spec P7 §2.7, §7.4). Mọi ca so TRỌN chuỗi —
 * URL là thứ khách chia sẻ và bấm Back, lệch một ký tự là một trang khác.
 */
describe('bookingsListParams — đọc URL', () => {
  it('URL trống: không lọc, trang 1', () => {
    expect(bookingsListParams({})).toEqual({ q: null, when: [], status: [], page: 1 });
  });

  it('đọc đủ bốn tham số; when và status về thứ tự chuẩn, viết hoa như contract', () => {
    expect(
      bookingsListParams({ q: '  ha noi ', when: 'past,on_tour', status: 'refunded,paid', page: '2' }),
    ).toEqual({ q: 'ha noi', when: ['ON_TOUR', 'PAST'], status: ['PAID', 'REFUNDED'], page: 2 });
  });

  it('giá trị lạ bị bỏ qua, giá trị trùng gộp một', () => {
    expect(bookingsListParams({ when: 'someday,upcoming,upcoming', status: 'paid,lost' })).toEqual({
      q: null,
      when: ['UPCOMING'],
      status: ['PAID'],
      page: 1,
    });
  });

  it('khoá lặp lại (Next trả mảng): danh sách nối lại, giá trị đơn lấy cái đầu', () => {
    expect(bookingsListParams({ when: ['upcoming', 'past'], q: ['hue', 'hoi an'] })).toEqual({
      q: 'hue',
      when: ['UPCOMING', 'PAST'],
      status: [],
      page: 1,
    });
  });

  it.each(['0', '-1', '1.5', 'abc', '10001', ''])('page=%j không hợp lệ thì về 1', (page) => {
    expect(bookingsListParams({ page }).page).toBe(1);
  });

  it('page=10000 là trần contract, còn nhận', () => {
    expect(bookingsListParams({ page: '10000' }).page).toBe(10_000);
  });
});

describe('searchTermOf', () => {
  it.each([
    ['  ha noi  ', 'ha noi'],
    ['   ', null],
    ['', null],
  ])('%j → %j', (text, term) => {
    expect(searchTermOf(text)).toBe(term);
  });

  it('cắt còn 80 ký tự RỒI mới cắt khoảng trắng đuôi', () => {
    expect(searchTermOf(`${'x'.repeat(79)} yz`)).toBe('x'.repeat(79));
  });
});

describe('toggleValue / hasListFilters', () => {
  it('chưa có thì thêm, có rồi thì bỏ; mảng gốc không đổi', () => {
    const list = ['PAID', 'CANCELLED'];
    expect(toggleValue(list, 'REFUNDED')).toEqual(['PAID', 'CANCELLED', 'REFUNDED']);
    expect(toggleValue(list, 'PAID')).toEqual(['CANCELLED']);
    expect(list).toEqual(['PAID', 'CANCELLED']);
  });

  const cases: Array<[Partial<BookingsListParams>, boolean]> = [
    [{}, false],
    [{ page: 3 }, false],
    [{ q: 'hue' }, true],
    [{ when: ['PAST'] }, true],
    [{ status: ['PAID'] }, true],
  ];
  it.each(cases)('hasListFilters(%j) = %s', (patch, expected) => {
    expect(hasListFilters({ ...EMPTY_BOOKINGS_LIST_PARAMS, ...patch })).toBe(expected);
  });
});

describe('bookingsListHref — dựng lại URL', () => {
  it('không lọc, trang 1: đường dẫn trần', () => {
    expect(bookingsListHref(EMPTY_BOOKINGS_LIST_PARAMS)).toBe('/account/bookings');
  });

  it('khoá theo thứ tự q, when, status, page; giá trị viết thường theo thứ tự chuẩn', () => {
    expect(
      bookingsListHref({
        q: 'ha noi',
        when: ['PAST', 'UPCOMING'],
        status: ['PARTIALLY_REFUNDED', 'PAID'],
        page: 2,
      }),
    ).toBe('/account/bookings?q=ha+noi&when=upcoming,past&status=paid,partially_refunded&page=2');
  });

  it('khứ hồi: đọc lại URL vừa dựng ra đúng bộ tham số, kể cả dấu phẩy trong từ khoá', () => {
    const params: BookingsListParams = {
      q: 'Hà Nội, Huế',
      when: ['ON_TOUR'],
      status: ['CANCELLED'],
      page: 3,
    };
    const search = new URLSearchParams(bookingsListHref(params).split('?')[1]);
    expect(bookingsListParams(Object.fromEntries(search))).toEqual(params);
  });
});

describe('bookingsListApiInput — URL sang input của bookings.mine', () => {
  it('luôn journey, 10 dòng; không gửi khoá rỗng', () => {
    expect(bookingsListApiInput(EMPTY_BOOKINGS_LIST_PARAMS)).toEqual({
      page: 1,
      limit: 10,
      order: 'journey',
    });
  });

  it('mang đủ bộ lọc; status luôn là mảng', () => {
    expect(
      bookingsListApiInput({ q: 'hue', when: ['UPCOMING'], status: ['PAID'], page: 3 }),
    ).toEqual({
      page: 3,
      limit: BOOKINGS_LIST_LIMIT,
      order: 'journey',
      when: ['UPCOMING'],
      status: ['PAID'],
      q: 'hue',
    });
  });
});

describe('pagerView — "Newer / Older trips" (spec §7.4)', () => {
  const FILTERED: BookingsListParams = { q: null, when: ['UPCOMING'], status: [], page: 1 };

  it('một trang hay không trang nào thì không có thanh phân trang', () => {
    expect(pagerView(FILTERED, 1, 7, 10)).toBeNull();
    expect(pagerView(FILTERED, 0, 0, 10)).toBeNull();
  });

  it('trang đầu: không có Newer; Older sang trang 2, giữ bộ lọc', () => {
    expect(pagerView(FILTERED, 2, 18, 10)).toEqual({
      summary: 'Page 1 of 2 · trips 1–10 of 18',
      newerHref: null,
      older: { href: '/account/bookings?when=upcoming&page=2', range: 'Trips 11–18' },
    });
  });

  it('trang giữa: Newer về trang 1 — URL không mang page=1', () => {
    expect(pagerView({ ...FILTERED, page: 2 }, 3, 25, 10)).toEqual({
      summary: 'Page 2 of 3 · trips 11–20 of 25',
      newerHref: '/account/bookings?when=upcoming',
      older: { href: '/account/bookings?when=upcoming&page=3', range: 'Trips 21–25' },
    });
  });

  it('trang cuối: không có Older; trang chỉ một đơn thì nói số ít', () => {
    expect(pagerView({ ...FILTERED, page: 3 }, 3, 21, 10)).toEqual({
      summary: 'Page 3 of 3 · trip 21 of 21',
      newerHref: '/account/bookings?when=upcoming&page=2',
      older: null,
    });
  });

  it('trang kế chỉ còn một đơn: "Trip 11"', () => {
    expect(pagerView(FILTERED, 2, 11, 10)?.older?.range).toBe('Trip 11');
  });
});
```

  Tạo `lib/api/bookings.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMyBookingsPage } from './bookings';

// Mock client oRPC — chỉ soi procedure, input và cookie; không gọi API thật.
const { mine } = vi.hoisted(() => ({ mine: vi.fn() }));
vi.mock('./client', () => ({
  api: { bookings: { mine } },
  withAuthHeaders: (cookie: string) => ({ auth: { cookie } }),
}));

beforeEach(() => {
  mine.mockReset();
});

describe('fetchMyBookingsPage', () => {
  it('gửi NGUYÊN input của trang cùng cookie phiên, trả nguyên kết quả', async () => {
    const result = {
      items: [],
      page: 2,
      limit: 10,
      total: 11,
      totalPages: 2,
      facets: {
        when: { ON_TOUR: 0, UPCOMING: 11, PAST: 3 },
        status: { PENDING: 0, PAID: 14, CANCELLED: 0, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
      },
      overallTotal: 14,
    };
    mine.mockResolvedValueOnce(result);
    const input = {
      page: 2,
      limit: 10,
      order: 'journey' as const,
      when: ['UPCOMING' as const],
      q: 'hue',
    };

    await expect(fetchMyBookingsPage('session=abc', input)).resolves.toBe(result);
    expect(mine).toHaveBeenCalledWith(input, { context: { auth: { cookie: 'session=abc' } } });
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/web exec vitest run src/lib/bookings-list.spec.ts src/lib/api/bookings.spec.ts`
  — ĐỎ: chưa có module `./bookings-list`; `fetchMyBookingsPage` chưa export.

- [ ] **Bước 3. Cài — i18n.** Trong `messages.ts`, khối `accountBookings`, chèn ngay TRƯỚC dòng
  `    // Trang hộ chiếu: nút hiện diện tĩnh cho "Load more" (chunk \`?page=\`,` (dòng 2439):

```ts
    // ── Danh sách `/account/bookings` (spec P7 §7, ADR-0054) ──
    /** Dòng giữa của phân trang. Trang chỉ một đơn thì nói số ít ("trip 21 of 21"). */
    pageSummary: (page: number, pages: number, from: number, to: number, total: number) =>
      `Page ${page} of ${pages} · ${from === to ? `trip ${from}` : `trips ${from}–${to}`} of ${total}`,
    /** Dòng nhỏ dưới "Older trips": các đơn của trang kế. */
    olderRange: (from: number, to: number) =>
      from === to ? `Trip ${from}` : `Trips ${from}–${to}`,
```

  Build i18n: `pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only`.

- [ ] **Bước 4. Cài — lib.** Tạo `apps/web/src/lib/bookings-list.ts`:

```ts
import type {
  BookingStatusValue,
  BookingWhen,
  ContractInputs,
} from '@tourism/contract';
import { BOOKINGS_SEARCH_MAX, BookingStatusSchema, BookingWhenSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { listParam, type RawSearchParam, singleParam } from './search-params';

/**
 * Trạng thái của trang My bookings nằm TRỌN trên URL (spec P7 §2.7, ADR-0054 §4):
 * `?q=…&when=upcoming,past&status=paid&page=2`. File này đọc URL ấy, dựng lại nó, và dịch nó
 * thành input của `bookings.mine`. Giá trị lạ thì bỏ qua: URL gõ tay hay link cũ không được
 * làm sập trang (cùng bài học `search-params.ts`).
 */
export const BOOKINGS_LIST_PATH = '/account/bookings';

/** 10 đơn mỗi trang (spec §2.7) — khác mặc định 12 của contract; web luôn gửi tường minh. */
export const BOOKINGS_LIST_LIMIT = 10;

/** Gương trần `page` của `BookingsListQuerySchema` — vượt là 400 ở API. */
const PAGE_MAX = 10_000;

export interface BookingsListParams {
  /** Từ khoá đã cắt khoảng trắng và cắt trần; `null` là không tìm. */
  q: string | null;
  /** Theo thứ tự chuẩn của `BookingWhenSchema`, không trùng. */
  when: BookingWhen[];
  /** Theo thứ tự chuẩn của `BookingStatusSchema`, không trùng. */
  status: BookingStatusValue[];
  page: number;
}

export const EMPTY_BOOKINGS_LIST_PARAMS: BookingsListParams = {
  q: null,
  when: [],
  status: [],
  page: 1,
};

/** Chữ trong ô tìm → từ khoá gửi đi: cắt trần TRƯỚC, rồi cắt khoảng trắng; rỗng là `null`. */
export function searchTermOf(text: string): string | null {
  const term = text.trim().slice(0, BOOKINGS_SEARCH_MAX).trim();
  return term === '' ? null : term;
}

/** Một lần bấm chọn: có thì bỏ, chưa có thì thêm. Thứ tự do `bookingsListHref` chuẩn hoá. */
export function toggleValue<V>(list: readonly V[], value: V): V[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Đang lọc hoặc đang tìm — quyết dòng "{n} of {total} trips" và nút Reset. */
export function hasListFilters(params: BookingsListParams): boolean {
  return params.q !== null || params.when.length > 0 || params.status.length > 0;
}

/** Giữ các giá trị hợp lệ theo thứ tự chuẩn của `options` — một bộ lọc, một chuỗi URL. */
function inOrder<V extends string>(values: Iterable<string>, options: readonly V[]): V[] {
  const picked = new Set(values);
  return options.filter((option) => picked.has(option));
}

/** `when=past,on_tour` → `['ON_TOUR', 'PAST']`; viết hoa để so với enum của contract. */
function parseList<V extends string>(raw: string | undefined, options: readonly V[]): V[] {
  if (raw === undefined) return [];
  return inOrder(
    raw.split(',').map((part) => part.trim().toUpperCase()),
    options,
  );
}

export function bookingsListParams(
  searchParams: Readonly<Record<string, RawSearchParam>>,
): BookingsListParams {
  const rawPage = singleParam(searchParams.page);
  const page = rawPage !== undefined && /^\d{1,5}$/.test(rawPage) ? Number(rawPage) : 1;
  return {
    q: searchTermOf(singleParam(searchParams.q) ?? ''),
    when: parseList(listParam(searchParams.when), BookingWhenSchema.options),
    status: parseList(listParam(searchParams.status), BookingStatusSchema.options),
    page: page >= 1 && page <= PAGE_MAX ? page : 1,
  };
}

export function bookingsListHref(params: BookingsListParams): string {
  const query = new URLSearchParams();
  if (params.q !== null) query.set('q', params.q);
  const when = inOrder(params.when, BookingWhenSchema.options);
  if (when.length > 0) query.set('when', when.map((value) => value.toLowerCase()).join(','));
  const status = inOrder(params.status, BookingStatusSchema.options);
  if (status.length > 0) {
    query.set('status', status.map((value) => value.toLowerCase()).join(','));
  }
  if (params.page > 1) query.set('page', String(params.page));
  // Dấu phẩy là sub-delim hợp lệ trong query (RFC 3986) — để nguyên cho link đọc được, cùng
  // nếp trang /tours; `URLSearchParams` đọc lại được cả hai dạng.
  const search = query.toString().replace(/%2C/g, ',');
  return search === '' ? BOOKINGS_LIST_PATH : `${BOOKINGS_LIST_PATH}?${search}`;
}

/** Bộ tham số của trang → input của `bookings.mine`: luôn `journey`, 10 dòng, bỏ khoá rỗng. */
export function bookingsListApiInput(
  params: BookingsListParams,
): ContractInputs['bookings']['mine'] {
  return {
    page: params.page,
    limit: BOOKINGS_LIST_LIMIT,
    order: 'journey',
    ...(params.when.length > 0 ? { when: params.when } : {}),
    ...(params.status.length > 0 ? { status: params.status } : {}),
    ...(params.q === null ? {} : { q: params.q }),
  };
}

/** Chữ và link của phân trang "Newer / Older trips" (spec §7.4). */
export interface PagerView {
  /** "Page 1 of 2 · trips 1–10 of 18". */
  summary: string;
  /** `null` ở trang đầu: nút Newer mờ, không bấm được. */
  newerHref: string | null;
  /** `null` ở trang cuối: không có Older. */
  older: { href: string; range: string } | null;
}

/** `null` khi dưới hai trang — thanh phân trang không hiện. Link giữ nguyên bộ lọc. */
export function pagerView(
  params: BookingsListParams,
  totalPages: number,
  total: number,
  limit: number,
): PagerView | null {
  if (totalPages < 2) return null;
  const tb = messages.accountBookings;
  const page = Math.min(Math.max(params.page, 1), totalPages);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return {
    summary: tb.pageSummary(page, totalPages, from, to, total),
    newerHref: page > 1 ? bookingsListHref({ ...params, page: page - 1 }) : null,
    older:
      page < totalPages
        ? {
            href: bookingsListHref({ ...params, page: page + 1 }),
            range: tb.olderRange(to + 1, Math.min(to + limit, total)),
          }
        : null,
  };
}
```

- [ ] **Bước 5. Cài — lời gọi API.** Trong `apps/web/src/lib/api/bookings.ts`, dòng 2 thành
  `import type { Booking, BookingDetail, BookingsListResult, ContractInputs, Paged } from '@tourism/contract';`
  rồi thêm ngay sau hàm `fetchMyBookings` (sau dòng 22):

```ts
/**
 * Một trang của My bookings (ADR-0054): bộ lọc, từ khoá, thứ tự hành trình và số trang đi
 * thẳng xuống `bookings.mine`; server trả kèm `facets` và `overallTotal`. Mảng đi trên query
 * GET theo ký pháp ngoặc có chỉ số của oRPC (`when[0]=UPCOMING`). Dựng input bằng
 * `bookingsListApiInput` (`@/lib/bookings-list`).
 */
export async function fetchMyBookingsPage(
  cookie: string,
  input: ContractInputs['bookings']['mine'],
): Promise<BookingsListResult> {
  return api.bookings.mine(input, { context: withAuthHeaders(cookie) });
}
```

- [ ] **Bước 6.** Chạy lại lệnh Bước 2 — XANH. `pnpm --filter @tourism/web typecheck` xanh. **Đột
  biến:** bỏ `.replace(/%2C/g, ',')` (ca thứ tự khoá đỏ); bỏ `inOrder` trong
  `bookingsListHref`, ghép thẳng `params.when` (ca thứ tự chuẩn đỏ); `page > 1` thành
  `page >= 1` (ca URL trần và ca Newer về trang 1 đỏ); bỏ `.trim()` thứ hai của
  `searchTermOf` (ca 80 ký tự đỏ); `/^\d{1,5}$/` thành `/^\d+$/` (ca `10001` đỏ); đổi
  `order: 'journey'` thành `'recent'`; bỏ nhánh số ít của `pageSummary` (ca trang cuối đỏ);
  `olderRange(to + 1, …)` thành `olderRange(to, …)`; `fetchMyBookingsPage` gửi
  `{ page: 1, limit: 10 }` thay vì `input` (ca của nó đỏ).

- [ ] **Bước 7.** Chạy quy trình gate ở mục Ràng buộc toàn cục. Commit (stage
  `apps/web/src/lib/bookings-list.ts`, `apps/web/src/lib/bookings-list.spec.ts`,
  `apps/web/src/lib/api/bookings.ts`, `apps/web/src/lib/api/bookings.spec.ts`,
  `libs/shared/i18n/src/lib/messages.ts`):
  `feat(web): tham số URL, input API và phân trang của danh sách đơn`

### Task 7 — A7 · Web: hàng tìm và lọc của My bookings

**Files:**

- Create: `apps/web/src/components/account/facet-filter.tsx`
- Test: `apps/web/src/components/account/facet-filter.spec.tsx`
- Create: `apps/web/src/components/account/bookings-toolbar.tsx`
- Test: `apps/web/src/components/account/bookings-toolbar.spec.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `accountBookings`)

**Interfaces:**

- Consumes: `Popover`, `PopoverContent`, `PopoverTrigger`
  (`libs/shared/ui/src/components/popover.tsx`), `Checkbox` (`checkbox.tsx`), `Button`
  (`button.tsx`), `Input` (`input.tsx`), `Separator` (`separator.tsx`) — chỉ dùng, không sửa;
  `BookingsListParams`, `bookingsListHref`, `EMPTY_BOOKINGS_LIST_PARAMS`, `hasListFilters`,
  `searchTermOf`, `toggleValue` (Task A6); `BOOKINGS_SEARCH_MAX`, `BookingWhenSchema`,
  `BookingStatusSchema`, kiểu `BookingsListFacets` (contract); nhãn trạng thái
  `messages.booking.list.status` (`messages.ts:526`).
- Produces: `FacetFilter<V extends string>({ label, options, selected, onToggle, onClear, className })`
  và kiểu `FacetFilterOption<V> { value; label; count }`;
  `BookingsToolbar({ params, facets })`, hằng `SEARCH_DEBOUNCE_MS` = 300; khoá i18n
  `accountBookings.searchPlaceholder`, `clearSearch`, `whenFilter`, `statusFilter`,
  `whenOptions`, `selectedCount`, `filterButtonAria`, `optionCount`, `clearFilters`, `reset`.

Dựng nút lọc bằng `Popover` + `Checkbox` có sẵn thay cho `Command` của mẫu shadcn: menu chỉ
3–5 dòng, không cần ô gõ; hàng `<label htmlFor>` + `Checkbox` + đuôi `sr-only` là đúng khuôn
`OptionRow` ở `apps/web/src/components/tours/tours-filters.tsx:73-106`, nên tên đọc của ô tích
ra "Upcoming, 2 trips" như `'Trekking, 3 tours'` của `tours-explorer.spec.tsx:339`.

- [ ] **Bước 1. Test trước — nút lọc.** Tạo `facet-filter.spec.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FacetFilter, type FacetFilterOption } from './facet-filter';

/**
 * Nút lọc chọn nhiều của My bookings (spec P7 §7.2). Bố cục (cỡ cố định 176×36, viền gạch
 * đứt) không đo được bằng jsdom — Task A11 đo bằng CSS build thật.
 */
type When = 'ON_TOUR' | 'UPCOMING' | 'PAST';

const OPTIONS: FacetFilterOption<When>[] = [
  { value: 'ON_TOUR', label: 'On tour now', count: 0 },
  { value: 'UPCOMING', label: 'Upcoming', count: 1 },
  { value: 'PAST', label: 'Past trips', count: 12 },
];

function renderFilter(selected: When[] = []) {
  const onToggle = vi.fn();
  const onClear = vi.fn();
  render(
    <FacetFilter
      label="When"
      options={OPTIONS}
      selected={selected}
      onToggle={onToggle}
      onClear={onClear}
    />,
  );
  return { onToggle, onClear };
}

describe('FacetFilter — nút', () => {
  it('chưa chọn gì: tên nút là nhãn trần', () => {
    renderFilter();
    expect(screen.getByRole('button', { name: 'When' })).toBeInTheDocument();
  });

  it('chọn một giá trị: nút bày nhãn giá trị, tên đọc "When: Upcoming"', () => {
    renderFilter(['UPCOMING']);
    const button = screen.getByRole('button', { name: 'When: Upcoming' });
    expect(within(button).getByText('Upcoming')).toBeInTheDocument();
  });

  it('chọn từ hai giá trị: "{n} selected"', () => {
    renderFilter(['UPCOMING', 'PAST']);
    const button = screen.getByRole('button', { name: 'When: 2 selected' });
    expect(within(button).getByText('2 selected')).toBeInTheDocument();
  });
});

describe('FacetFilter — menu', () => {
  it('mỗi dòng: ô tích, nhãn, số đếm — tên đọc kèm số đơn, số ít đúng', async () => {
    const user = userEvent.setup();
    renderFilter(['PAST']);
    await user.click(screen.getByRole('button', { name: 'When: Past trips' }));

    expect(await screen.findByRole('checkbox', { name: 'On tour now, 0 trips' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Upcoming, 1 trip' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Past trips, 12 trips' })).toBeChecked();
  });

  it('bấm ô tích gọi onToggle với giá trị của dòng, đúng một lần', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderFilter();
    await user.click(screen.getByRole('button', { name: 'When' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Upcoming, 1 trip' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('UPCOMING');
  });

  it('bấm vào CHỮ của dòng cũng tích được — cả hàng là vùng bấm', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderFilter();
    await user.click(screen.getByRole('button', { name: 'When' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByText('Past trips'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('PAST');
  });

  it('chưa chọn gì thì không có "Clear filters"', async () => {
    const user = userEvent.setup();
    renderFilter();
    await user.click(screen.getByRole('button', { name: 'When' }));
    await screen.findByRole('dialog');

    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('"Clear filters" gọi onClear rồi đóng menu', async () => {
    const user = userEvent.setup();
    const { onClear } = renderFilter(['PAST']);
    await user.click(screen.getByRole('button', { name: 'When: Past trips' }));
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
```

- [ ] **Bước 2. Test trước — hàng lọc.** Tạo `bookings-toolbar.spec.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BookingsListFacets } from '@tourism/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingsListParams } from '@/lib/bookings-list';
import { BookingsToolbar, SEARCH_DEBOUNCE_MS } from './bookings-toolbar';

/**
 * Hàng tìm và lọc của My bookings (spec P7 §7.2): mọi thay đổi thay URL bằng
 * `router.replace(…, { scroll: false })` và đưa page về 1. Router là mock nên `params` không
 * tự đổi sau cú bấm — ca nào cần "URL về tới" thì `rerender` tường minh.
 */
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const FACETS: BookingsListFacets = {
  when: { ON_TOUR: 1, UPCOMING: 2, PAST: 5 },
  status: { PENDING: 1, PAID: 5, CANCELLED: 0, REFUNDED: 2, PARTIALLY_REFUNDED: 0 },
};
const NONE: BookingsListParams = { q: null, when: [], status: [], page: 1 };
const SCROLL = { scroll: false };
const SEARCH = { name: 'Search tour or booking code' };

function renderToolbar(params: Partial<BookingsListParams> = {}) {
  return render(<BookingsToolbar params={{ ...NONE, ...params }} facets={FACETS} />);
}

beforeEach(() => {
  replace.mockReset();
});

describe('BookingsToolbar — lọc', () => {
  it('tích Upcoming: replace sang ?when=upcoming, page về 1, giữ từ khoá', async () => {
    const user = userEvent.setup();
    renderToolbar({ q: 'hue', page: 3 });
    await user.click(screen.getByRole('button', { name: 'When' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Upcoming, 2 trips' }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/account/bookings?q=hue&when=upcoming', SCROLL);
  });

  it('bỏ tích giá trị đang chọn: chỉ giá trị ấy rời URL', async () => {
    const user = userEvent.setup();
    renderToolbar({ when: ['UPCOMING', 'PAST'] });
    await user.click(screen.getByRole('button', { name: 'When: 2 selected' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Upcoming, 2 trips' }));

    expect(replace).toHaveBeenCalledWith('/account/bookings?when=past', SCROLL);
  });

  it('Status chỉ bày trạng thái có đơn, cộng trạng thái đang chọn dù đếm 0', async () => {
    const user = userEvent.setup();
    renderToolbar({ status: ['CANCELLED'] });
    await user.click(screen.getByRole('button', { name: 'Status: Cancelled' }));
    const dialog = within(await screen.findByRole('dialog'));

    expect(dialog.getByRole('checkbox', { name: 'Awaiting payment, 1 trip' })).toBeInTheDocument();
    expect(dialog.getByRole('checkbox', { name: 'Paid, 5 trips' })).toBeInTheDocument();
    expect(dialog.getByRole('checkbox', { name: 'Cancelled, 0 trips' })).toBeChecked();
    expect(dialog.getByRole('checkbox', { name: 'Refunded, 2 trips' })).toBeInTheDocument();
    expect(dialog.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('"Clear filters" của Status chỉ xoá Status', async () => {
    const user = userEvent.setup();
    renderToolbar({ when: ['UPCOMING'], status: ['PAID'] });
    await user.click(screen.getByRole('button', { name: 'Status: Paid' }));
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(replace).toHaveBeenCalledWith('/account/bookings?when=upcoming', SCROLL);
  });
});

describe('BookingsToolbar — ô tìm', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gõ xong 300 ms mới áp; page về 1, giữ bộ lọc', async () => {
    vi.useFakeTimers();
    renderToolbar({ when: ['PAST'], page: 2 });
    fireEvent.change(screen.getByRole('searchbox', SEARCH), { target: { value: 'ha noi' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(replace).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/account/bookings?q=ha+noi&when=past', SCROLL);
  });

  it('Enter áp ngay và huỷ lượt đang chờ — không gửi lần hai', async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.type(screen.getByRole('searchbox', SEARCH), 'hanoi{Enter}');

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/account/bookings?q=hanoi', SCROLL);
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('nút ✕ xoá từ khoá, URL bỏ q, tiêu điểm về ô tìm', async () => {
    const user = userEvent.setup();
    renderToolbar({ q: 'hanoi', status: ['PAID'] });
    const box = screen.getByRole('searchbox', SEARCH);
    expect(box).toHaveValue('hanoi');

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(box).toHaveValue('');
    expect(box).toHaveFocus();
    expect(replace).toHaveBeenCalledWith('/account/bookings?status=paid', SCROLL);
  });

  it('URL đổi từ ngoài (nút Back, link Reset) thì ô tìm theo URL', () => {
    const { rerender } = renderToolbar({ q: 'hanoi' });
    rerender(<BookingsToolbar params={NONE} facets={FACETS} />);

    expect(screen.getByRole('searchbox', SEARCH)).toHaveValue('');
  });

  it('lượt tìm của CHÍNH ô về tới thì không đè chữ khách đang gõ dở', async () => {
    vi.useFakeTimers();
    const { rerender } = renderToolbar();
    const box = screen.getByRole('searchbox', SEARCH);
    fireEvent.change(box, { target: { value: 'ha noi' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });
    // Trong lúc trang mới đang về, khách gõ tiếp.
    fireEvent.change(box, { target: { value: 'ha noi old' } });
    rerender(<BookingsToolbar params={{ ...NONE, q: 'ha noi' }} facets={FACETS} />);

    expect(box).toHaveValue('ha noi old');
  });
});

describe('BookingsToolbar — Reset', () => {
  it('không lọc, không tìm thì không có Reset', () => {
    renderToolbar();
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('đang lọc: Reset về danh sách gốc và trả tiêu điểm cho ô tìm', async () => {
    const user = userEvent.setup();
    renderToolbar({ q: 'hue', when: ['PAST'], status: ['PAID'], page: 2 });
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(replace).toHaveBeenCalledWith('/account/bookings', SCROLL);
    expect(screen.getByRole('searchbox', SEARCH)).toHaveFocus();
  });
});
```

- [ ] **Bước 3.** `pnpm --filter @tourism/web exec vitest run src/components/account/facet-filter.spec.tsx src/components/account/bookings-toolbar.spec.tsx`
  — ĐỎ vì chưa có hai module.

- [ ] **Bước 4. Cài — i18n.** Trong `messages.ts`, khối `accountBookings`, chèn ngay TRƯỚC dòng
  `    // Trang hộ chiếu: nút hiện diện tĩnh cho "Load more" (chunk \`?page=\`,` (tức ngay sau
  `olderRange` của Task A6):

```ts
    /** Ô tìm của hàng lọc — vừa là chữ mờ trong ô, vừa là tên đọc-màn-hình của ô. */
    searchPlaceholder: 'Search tour or booking code',
    clearSearch: 'Clear search',
    whenFilter: 'When',
    statusFilter: 'Status',
    /** Ba nhóm thời gian — khoá là `BookingWhen` của contract (ADR-0054 §1). */
    whenOptions: { ON_TOUR: 'On tour now', UPCOMING: 'Upcoming', PAST: 'Past trips' },
    /** Trên nút lọc khi chọn từ hai giá trị trở lên. */
    selectedCount: (n: number) => `${n} selected`,
    /** Tên đọc-màn-hình của nút lọc đang có giá trị: "When: Upcoming". */
    filterButtonAria: (label: string, value: string) => `${label}: ${value}`,
    /** Đuôi chỉ trình đọc màn hình nghe, sau nhãn lựa chọn — không thì nhãn và số dính nhau. */
    optionCount: (n: number) => `, ${n} ${n === 1 ? 'trip' : 'trips'}`,
    clearFilters: 'Clear filters',
    reset: 'Reset',
```

  Build i18n: `pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only`.

- [ ] **Bước 5. Cài — nút lọc.** Tạo `facet-filter.tsx`:

```tsx
'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Checkbox } from '@tourism/ui/components/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@tourism/ui/components/popover';
import { Separator } from '@tourism/ui/components/separator';
import { cn } from '@tourism/ui/lib/utils';
import { CirclePlusIcon } from 'lucide-react';
import { useId, useState } from 'react';

/** Một lựa chọn: giá trị đi vào URL, nhãn khách đọc, số đơn (tổng tĩnh, ADR-0054 §2). */
export interface FacetFilterOption<V extends string> {
  value: V;
  label: string;
  count: number;
}

/**
 * Nút lọc chọn nhiều kiểu "faceted filter" của shadcn/ui (spec P7 §7.2) — dựng bằng
 * `Popover` + `Checkbox` có sẵn của `@tourism/ui`, không thêm gì vào kit. Chữ của nút và menu
 * là chữ của My bookings ("trips"), nên file nằm ở `components/account`.
 *
 * Nút (bản vẽ `booking-list.src.html` phần 1): viền gạch đứt, icon ⊕; chọn một giá trị thì
 * hiện vạch ngăn và nhãn giá trị, từ hai trở lên thì "{n} selected". Cỡ cố định do nơi dùng
 * truyền qua `className`. Menu đang mở thì chỉ đổi nền nhạt — `aria-expanded:bg-muted` của
 * biến thể `outline` lo, không thêm viền.
 *
 * "Clear filters" đóng menu: nút ấy biến mất ngay sau cú bấm, để menu mở là tiêu điểm rơi về
 * `<body>`; đóng menu thì Base UI trả tiêu điểm về nút lọc.
 */
export function FacetFilter<V extends string>({
  label,
  options,
  selected,
  onToggle,
  onClear,
  className,
}: {
  label: string;
  options: readonly FacetFilterOption<V>[];
  selected: readonly V[];
  onToggle: (value: V) => void;
  onClear: () => void;
  className?: string;
}) {
  const tb = messages.accountBookings;
  const idPrefix = useId();
  const [open, setOpen] = useState(false);
  const first = selected[0];
  const summary =
    first === undefined
      ? null
      : selected.length === 1
        ? (options.find((option) => option.value === first)?.label ?? first)
        : tb.selectedCount(selected.length);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={summary === null ? label : tb.filterButtonAria(label, summary)}
            className={cn(
              'h-9 justify-start gap-2 overflow-hidden border-dashed border-muted-foreground/60 px-3 text-[13px] font-semibold',
              className,
            )}
          >
            <CirclePlusIcon aria-hidden="true" />
            {label}
            {summary === null ? null : (
              <>
                <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
                <span className="min-w-0 truncate rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] font-semibold">
                  {summary}
                </span>
              </>
            )}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-60 gap-0 p-1">
        {options.map((option) => {
          // Id ghép từ `useId`: hai nút lọc trên cùng trang không bao giờ trùng id ô tích.
          const id = `${idPrefix}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted"
            >
              <Checkbox
                id={id}
                checked={selected.includes(option.value)}
                onCheckedChange={() => onToggle(option.value)}
              />
              <span className="flex-1 truncate">{option.label}</span>
              <span className="sr-only">{tb.optionCount(option.count)}</span>
              <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">
                {option.count}
              </span>
            </label>
          );
        })}
        {selected.length === 0 ? null : (
          <>
            <Separator className="my-1" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setOpen(false);
                onClear();
              }}
            >
              {tb.clearFilters}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Bước 6. Cài — hàng lọc.** Tạo `bookings-toolbar.tsx`:

```tsx
'use client';

import {
  BOOKINGS_SEARCH_MAX,
  type BookingStatusValue,
  type BookingsListFacets,
  BookingStatusSchema,
  type BookingWhen,
  BookingWhenSchema,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { SearchIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startTransition, useEffect, useOptimistic, useRef, useState } from 'react';
import {
  type BookingsListParams,
  bookingsListHref,
  EMPTY_BOOKINGS_LIST_PARAMS,
  hasListFilters,
  searchTermOf,
  toggleValue,
} from '@/lib/bookings-list';
import { FacetFilter, type FacetFilterOption } from './facet-filter';

/** Gõ xong bao lâu thì áp ô tìm (spec P7 §7.2); Enter áp ngay. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Hàng tìm và lọc của My bookings (spec P7 §7.2, bản vẽ `booking-list.src.html` phần 1).
 * Trạng thái THẬT nằm trên URL: mọi thay đổi thay URL bằng `router.replace` (không làm dài
 * lịch sử), đưa `page` về 1, rồi server lọc và trả trang mới. Không có nút Sort (ADR-0054 §4).
 *
 * Ba chỗ phải để ý:
 *
 * 1. **Ô tích đổi ngay khi bấm**: `useOptimistic` trong `startTransition`, khuôn "Filter with
 *    pending feedback" của tài liệu Next 16 (`01-app/02-guides/interactive-apps.md`). Giá trị
 *    lạc quan đứng tới khi lượt điều hướng xong rồi về đúng `params` mới của server.
 * 2. **Ô tìm có state riêng** (chữ đang gõ); chỉ đẩy lên URL sau 300 ms hoặc khi Enter.
 * 3. **URL đổi từ NGOÀI** (nút Back, link Reset của trạng thái trống) thì ô tìm theo URL; còn
 *    lượt tìm của CHÍNH ô này về tới thì không được đè chữ khách đang gõ dở. `sentQ` nhớ từ khoá
 *    vừa gửi để phân biệt hai ca.
 */
export function BookingsToolbar({
  params,
  facets,
}: {
  params: BookingsListParams;
  facets: BookingsListFacets;
}) {
  const tb = messages.accountBookings;
  const statusLabels = messages.booking.list.status;
  const router = useRouter();
  const [current, setCurrent] = useOptimistic(params);
  const [query, setQuery] = useState(params.q ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentQ = useRef(params.q);

  useEffect(() => {
    if (params.q !== sentQ.current) {
      sentQ.current = params.q;
      setQuery(params.q ?? '');
    }
  }, [params.q]);

  // Rời trang khi còn lượt tìm đang chờ: huỷ, không điều hướng từ một trang đã đóng.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  function cancelPendingSearch() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function navigate(next: BookingsListParams) {
    cancelPendingSearch();
    // Mọi thay đổi lọc hay tìm đưa về trang 1 (spec §7.2): giữ trang cũ là cách chắc nhất
    // để ra một trang trắng.
    const target = { ...next, page: 1 };
    sentQ.current = target.q;
    startTransition(() => {
      setCurrent(target);
      router.replace(bookingsListHref(target), { scroll: false });
    });
  }

  function applySearch(text: string) {
    const q = searchTermOf(text);
    if (q === current.q) {
      cancelPendingSearch();
      return;
    }
    navigate({ ...current, q });
  }

  function onQueryChange(text: string) {
    setQuery(text);
    cancelPendingSearch();
    timer.current = setTimeout(() => applySearch(text), SEARCH_DEBOUNCE_MS);
  }

  // Nút ✕ và Reset biến mất ngay sau cú bấm — đưa tiêu điểm về ô tìm, không để rơi về `<body>`.
  function clearSearch() {
    setQuery('');
    inputRef.current?.focus();
    applySearch('');
  }

  function reset() {
    setQuery('');
    inputRef.current?.focus();
    navigate(EMPTY_BOOKINGS_LIST_PARAMS);
  }

  /** Lọc kèm chữ đang gõ dở: một lần bấm áp cả hai, không bỏ rơi từ khoá chưa kịp gửi. */
  function filterBy(patch: Partial<BookingsListParams>) {
    navigate({ ...current, q: searchTermOf(query), ...patch });
  }

  const whenOptions: FacetFilterOption<BookingWhen>[] = BookingWhenSchema.options.map(
    (value) => ({ value, label: tb.whenOptions[value], count: facets.when[value] }),
  );
  // Status: chỉ trạng thái có đơn, cộng trạng thái đang chọn (spec §2.7) — một lựa chọn đã
  // chọn mà biến khỏi menu là khách không bỏ chọn được.
  const statusOptions: FacetFilterOption<BookingStatusValue>[] = BookingStatusSchema.options
    .filter((value) => facets.status[value] > 0 || current.status.includes(value))
    .map((value) => ({
      value,
      label: statusLabels[value] ?? value,
      count: facets.status[value],
    }));
  const showReset = hasListFilters(current) || searchTermOf(query) !== null;

  return (
    // Điện thoại (spec §7.2): ô tìm chiếm hàng đầu; hai nút lọc chia đôi hàng hai; Reset chỉ
    // còn icon. Từ `sm`: cỡ cố định của bản vẽ — cao 36, ô tìm 290, hai nút lọc 176.
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="relative w-full sm:w-[290px]"
        onSubmit={(event) => {
          event.preventDefault();
          applySearch(query);
        }}
      >
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          maxLength={BOOKINGS_SEARCH_MAX}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={tb.searchPlaceholder}
          aria-label={tb.searchPlaceholder}
          className="h-9 bg-background pr-9 pl-9 text-[13px] [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query === '' ? null : (
          // Bọc trong `span` định vị: `translate` của chính nút sẽ đụng hiệu ứng nhấn
          // `active:translate-y-px` của `Button`.
          <span className="absolute inset-y-0 right-1 flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={tb.clearSearch}
              onClick={clearSearch}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </span>
        )}
      </form>
      <FacetFilter
        label={tb.whenFilter}
        options={whenOptions}
        selected={current.when}
        onToggle={(value) => filterBy({ when: toggleValue(current.when, value) })}
        onClear={() => filterBy({ when: [] })}
        className="flex-1 sm:w-44 sm:flex-none"
      />
      <FacetFilter
        label={tb.statusFilter}
        options={statusOptions}
        selected={current.status}
        onToggle={(value) => filterBy({ status: toggleValue(current.status, value) })}
        onClear={() => filterBy({ status: [] })}
        className="flex-1 sm:w-44 sm:flex-none"
      />
      {showReset ? (
        <Button
          type="button"
          variant="ghost"
          onClick={reset}
          className="h-9 gap-1.5 px-2.5 text-[13px] font-semibold"
        >
          <span className="sr-only sm:not-sr-only">{tb.reset}</span>
          <XIcon aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Bước 7.** Chạy lại lệnh Bước 3 — XANH (8 ca nút lọc, 11 ca hàng lọc). `pnpm --filter @tourism/web typecheck`
  xanh. **Đột biến** (mỗi cái một lần): `SEARCH_DEBOUNCE_MS` dùng `0` trong `setTimeout` (ca
  300 ms đỏ); bỏ `cancelPendingSearch()` trong `navigate` (ca Enter đỏ — lần gửi thứ hai);
  bỏ `page: 1` trong `navigate` (ca tích Upcoming đỏ); bỏ điều kiện
  `|| current.status.includes(value)` (ca Status đỏ — thiếu Cancelled); đổi điều kiện
  `params.q !== sentQ.current` thành `searchTermOf(query) !== params.q` (ca "không đè chữ" đỏ);
  bỏ hẳn effect đồng bộ `params.q` (ca "URL đổi từ ngoài" đỏ); bỏ `inputRef.current?.focus()`
  trong `clearSearch` (ca ✕ đỏ); `filterBy` dùng `current.q` thay cho `searchTermOf(query)`
  (ca tích Upcoming vẫn xanh vì chữ khớp URL — ghi vào bàn giao là đột biến không giết được
  bằng bộ ca này); bỏ `setOpen(false)` của Clear filters (ca đóng menu đỏ);
  `selected.length === 1` thành `=== 2` (ca một giá trị đỏ).

- [ ] **Bước 8.** Chạy quy trình gate ở mục Ràng buộc toàn cục. Commit (stage
  `apps/web/src/components/account/facet-filter.tsx`,
  `apps/web/src/components/account/facet-filter.spec.tsx`,
  `apps/web/src/components/account/bookings-toolbar.tsx`,
  `apps/web/src/components/account/bookings-toolbar.spec.tsx`,
  `libs/shared/i18n/src/lib/messages.ts`):
  `feat(web): hàng tìm và lọc của My bookings`

### Task 8 — A8 · Web: phân trang "Newer / Older trips"

**Files:**

- Create: `apps/web/src/components/account/trip-pager.tsx`
- Test: `apps/web/src/components/account/trip-pager.spec.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `accountBookings`)

**Interfaces:**

- Consumes: `pagerView`, `BookingsListParams` (Task A6).
- Produces: `TripPager({ params, totalPages, total, limit })` — Server Component, `null` khi
  dưới hai trang; khoá i18n `accountBookings.pagerAria`, `newerTrips`, `olderTrips`,
  `olderTripsAria`.

Bố cục theo bản vẽ (kiểu 3, `.p3`): lưới `1fr auto 1fr`, kẻ vạch trên, trái "← Newer trips"
(trang 1 thì mờ, không phải link), giữa "Page … of … · trips …", phải "Older trips" + dòng nhỏ
"Trips c–d" + nút tròn mũi tên (trang cuối thì không có). Bản vẽ không có khổ điện thoại; ba
phần một hàng không vừa 375px, nên ở điện thoại dòng giữa lên hàng trên, hai link xuống hàng
dưới — DOM giữ thứ tự đọc Newer → tóm tắt → Older ở mọi khổ.

- [ ] **Bước 1. Test trước.** Tạo `trip-pager.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BookingsListParams } from '@/lib/bookings-list';
import { TripPager } from './trip-pager';

/** Phân trang "Newer / Older trips" (spec P7 §7.4). Chữ và href đã có test ở `pagerView`;
 *  ở đây canh thứ được VẼ: link hay chữ mờ, có hay không có Older. */
const FILTERED: BookingsListParams = { q: null, when: ['UPCOMING'], status: [], page: 1 };

describe('TripPager', () => {
  it('một trang thì không vẽ gì', () => {
    const { container } = render(<TripPager params={FILTERED} totalPages={1} total={7} limit={10} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('trang đầu: Newer mờ không bấm được; Older sang trang 2, giữ bộ lọc', () => {
    render(<TripPager params={FILTERED} totalPages={2} total={18} limit={10} />);

    expect(screen.queryByRole('link', { name: 'Newer trips' })).toBeNull();
    expect(screen.getByText('Newer trips')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Page 1 of 2 · trips 1–10 of 18')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Older trips, Trips 11–18' })).toHaveAttribute(
      'href',
      '/account/bookings?when=upcoming&page=2',
    );
  });

  it('trang giữa: hai link, Newer về trang 1 không mang page', () => {
    render(<TripPager params={{ ...FILTERED, page: 2 }} totalPages={3} total={25} limit={10} />);

    expect(screen.getByRole('link', { name: 'Newer trips' })).toHaveAttribute(
      'href',
      '/account/bookings?when=upcoming',
    );
    expect(screen.getByRole('link', { name: 'Older trips, Trips 21–25' })).toHaveAttribute(
      'href',
      '/account/bookings?when=upcoming&page=3',
    );
  });

  it('trang cuối: không có Older', () => {
    render(<TripPager params={{ ...FILTERED, page: 3 }} totalPages={3} total={25} limit={10} />);

    expect(screen.getByRole('link', { name: 'Newer trips' })).toHaveAttribute(
      'href',
      '/account/bookings?when=upcoming&page=2',
    );
    expect(screen.queryByText('Older trips')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Trip pages' })).toBeInTheDocument();
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/web exec vitest run src/components/account/trip-pager.spec.tsx`
  — ĐỎ vì chưa có module `./trip-pager`.

- [ ] **Bước 3. Cài — i18n.** Trong `messages.ts`, khối `accountBookings`, chèn ngay TRƯỚC dòng
  `    // Trang hộ chiếu: nút hiện diện tĩnh cho "Load more" (chunk \`?page=\`,` (tức ngay sau
  `reset` của Task A7):

```ts
    /** Tên vùng điều hướng của phân trang. */
    pagerAria: 'Trip pages',
    newerTrips: 'Newer trips',
    olderTrips: 'Older trips',
    /** Tên đọc của link Older — nhãn cộng dải đơn của trang kế. */
    olderTripsAria: (range: string) => `Older trips, ${range}`,
```

  Build i18n (lệnh ở Task A6 Bước 3).

- [ ] **Bước 4. Cài.** Tạo `trip-pager.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import { type BookingsListParams, pagerView } from '@/lib/bookings-list';

/**
 * Phân trang "Newer / Older trips" của My bookings (spec P7 §7.4, bản vẽ `booking-list.src.html`
 * kiểu 3). Hai nhãn chỉ đúng vì danh sách luôn xếp theo hành trình (ADR-0054 §4). Link thường
 * — vào lịch sử trình duyệt, khác `router.replace` của hàng lọc — và giữ nguyên bộ lọc.
 *
 * Điện thoại: dòng "Page … of …" lên hàng trên, hai link xuống hàng dưới; từ `sm` là ba phần
 * một hàng như bản vẽ. Vị trí đặt bằng lưới, DOM giữ thứ tự đọc Newer → tóm tắt → Older.
 */
export function TripPager({
  params,
  totalPages,
  total,
  limit,
}: {
  params: BookingsListParams;
  totalPages: number;
  total: number;
  limit: number;
}) {
  const view = pagerView(params, totalPages, total, limit);
  if (view === null) return null;
  const tb = messages.accountBookings;
  const newerClass =
    'col-start-1 row-start-2 inline-flex items-center gap-2 justify-self-start font-semibold sm:row-start-1';

  return (
    <nav
      aria-label={tb.pagerAria}
      className="mt-4 grid grid-cols-2 items-center gap-y-3 border-t border-border pt-3.5 text-[13.5px] sm:grid-cols-[1fr_auto_1fr]"
    >
      {view.newerHref === null ? (
        <span aria-disabled="true" className={`${newerClass} text-muted-foreground/45`}>
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {tb.newerTrips}
        </span>
      ) : (
        <Link
          href={view.newerHref}
          className={`${newerClass} transition-colors hover:text-primary-emphasis`}
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {tb.newerTrips}
        </Link>
      )}
      <p className="col-span-2 col-start-1 row-start-1 text-center text-[13px] text-muted-foreground tabular-nums sm:col-span-1 sm:col-start-2">
        {view.summary}
      </p>
      {view.older === null ? null : (
        <Link
          href={view.older.href}
          aria-label={tb.olderTripsAria(view.older.range)}
          className="group col-start-2 row-start-2 inline-flex items-center gap-2.5 justify-self-end font-semibold sm:col-start-3 sm:row-start-1"
        >
          <span className="text-right">
            <span className="block transition-colors group-hover:text-primary-emphasis">
              {tb.olderTrips}
            </span>
            <small className="block text-[11.5px] font-normal text-muted-foreground tabular-nums">
              {view.older.range}
            </small>
          </span>
          <span
            aria-hidden="true"
            className="grid size-8.5 place-items-center rounded-full border border-border bg-background transition-colors group-hover:bg-muted"
          >
            <ArrowRightIcon className="size-4" />
          </span>
        </Link>
      )}
    </nav>
  );
}
```

- [ ] **Bước 5.** Chạy lại lệnh Bước 2 — XANH. `pnpm --filter @tourism/web typecheck` xanh. **Đột
  biến:** vẽ Newer luôn là `Link` (ca trang đầu đỏ); bỏ điều kiện `view.older === null` và vẽ
  Older bằng `href` của trang hiện tại (ca trang cuối đỏ); bỏ `aria-label` của link Older (ca
  trang đầu đỏ — tên đọc thành chữ dính "Older tripsTrips 11–18").

- [ ] **Bước 6.** Chạy quy trình gate ở mục Ràng buộc toàn cục. Commit (stage
  `apps/web/src/components/account/trip-pager.tsx`,
  `apps/web/src/components/account/trip-pager.spec.tsx`,
  `libs/shared/i18n/src/lib/messages.ts`):
  `feat(web): phân trang Newer / Older trips cho My bookings`

### Task 9 — A9 · Web: trang My bookings mới (`/account/bookings`)

**Files:**

- Create: `apps/web/src/components/account/bookings-list-view.tsx`
- Test: `apps/web/src/components/account/bookings-list-view.spec.tsx`
- Modify: `apps/web/src/app/(site)/account/bookings/page.tsx` (viết lại trọn)
- Modify: `apps/web/src/components/passport/booking-accordion.tsx` (import dòng 3 và 17; thân
  vòng `map` dòng 63–78; ô tổng dòng 151–158)
- Modify: `apps/web/src/components/passport/passport.spec.tsx` (describe `BookingAccordion`,
  dòng 143–227)
- Modify: `apps/web/src/lib/account-stats.ts`, `apps/web/src/lib/account-stats.spec.ts` (gỡ hai
  helper hết người dùng)
- Modify: `apps/web/src/lib/api/bookings.ts` (gỡ `BOOKINGS_PAGE_SIZE`, sửa JSDoc
  `fetchMyBookings`)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (`accountBookings`: thêm bốn khoá, gỡ
  `loadMore`, sửa ba comment; `passportBookings`: gỡ `back`)

**Interfaces:**

- Consumes: `ContentHero` prop `back` (A5); `bookingsListParams`, `bookingsListHref`,
  `bookingsListApiInput`, `hasListFilters`, `BOOKINGS_LIST_PATH`, `fetchMyBookingsPage` (A6);
  `BookingsToolbar` (A7); `TripPager` (A8); `bookingPhase`, `tripDayNumbers` (A1); có sẵn:
  `requireSession` (`lib/api/session.ts:93`), `todayDateString` (`lib/account-stats.ts:23`),
  `BookingAccordion`, `ButtonLink`, `messages.passportBookings.{breadcrumb,title,metaTrips,emptyHeading,emptyBody,emptyCta}`,
  `messages.checkoutSummary.totalLabel` ("Total"), `messages.passportVisa.labels.total`
  ("Total paid").
- Produces: `BookingsListView({ result, params, today })`; khoá i18n
  `accountBookings.backToPassport`, `tripsOf`, `noMatchHeading`, `noMatchBody`. Gỡ hẳn:
  `accountBookings.loadMore`, `passportBookings.back`, `BOOKINGS_PAGE_SIZE`,
  `groupBookingsByTime`, `BookingGroups`, `daysUntilDeparture`.

Thân trang tách thành `BookingsListView` vì Vitest của web không quét `src/app/**`
(`apps/web/vitest.config.ts`, glob `src/components/**`, `src/lib/**`): mọi nhánh khách thấy
(trống, đếm, rỗng do lọc, mở hàng đầu) có test; `page.tsx` chỉ còn phiên, URL, lời gọi API và
chuyển về trang cuối — phủ bằng typecheck, build và Task A11.

- [ ] **Bước 1. Test trước — thân trang.** Tạo `bookings-list-view.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { BookingsListResult } from '@tourism/contract';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { BookingsListParams } from '@/lib/bookings-list';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingsListView } from './bookings-list-view';

// Hàng lọc gọi `useRouter` — mock như `bookings-toolbar.spec.tsx`; ở đây không bấm gì.
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

// `BookingAccordion` bọc từng hàng trong `RevealItem` (motion `whileInView`) — jsdom không có
// IntersectionObserver. Stub CỤC BỘ, cùng nếp `passport.spec.tsx`.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

/** Thân trang My bookings (spec P7 §7.1–7.4). */
const TODAY = '2026-10-05';
const NONE: BookingsListParams = { q: null, when: [], status: [], page: 1 };
const FACETS: BookingsListResult['facets'] = {
  when: { ON_TOUR: 0, UPCOMING: 12, PAST: 6 },
  status: { PENDING: 0, PAID: 18, CANCELLED: 0, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
};
const ZERO: BookingsListResult['facets'] = {
  when: { ON_TOUR: 0, UPCOMING: 0, PAST: 0 },
  status: { PENDING: 0, PAID: 0, CANCELLED: 0, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
};

/** Đơn thứ n — mã khác nhau để biết hàng nào đang mở. */
const trip = (n: number) =>
  makeBooking({
    id: `b0000000-0000-4000-8000-00000000000${n}`,
    code: `BK-TRIP000${n}`,
    tourTitle: `Trip ${n}`,
  });

function result(patch: Partial<BookingsListResult>): BookingsListResult {
  return {
    items: [],
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    facets: FACETS,
    overallTotal: 18,
    ...patch,
  };
}

describe('BookingsListView', () => {
  it('khách chưa có đơn nào: giữ trạng thái trống cũ, không bày hàng lọc', () => {
    render(
      <BookingsListView
        result={result({ overallTotal: 0, facets: ZERO })}
        params={NONE}
        today={TODAY}
      />,
    );

    expect(screen.getByRole('heading', { name: 'No trips booked yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveAttribute('href', '/tours');
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('chưa lọc: dòng "{total} trips", hàng lọc, danh sách và phân trang', () => {
    render(
      <BookingsListView
        result={result({ items: [trip(1), trip(2)], total: 12, totalPages: 2 })}
        params={NONE}
        today={TODAY}
      />,
    );

    expect(screen.getByText('12 trips')).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: 'Search tour or booking code' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2 · trips 1–10 of 12')).toBeInTheDocument();
  });

  it('đang lọc: "{total} of {overallTotal} trips"; một trang thì không phân trang', () => {
    render(
      <BookingsListView
        result={result({ items: [trip(1), trip(2)], total: 2, totalPages: 1 })}
        params={{ ...NONE, when: ['UPCOMING'] }}
        today={TODAY}
      />,
    );

    expect(screen.getByText('2 of 18 trips')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Trip pages' })).toBeNull();
  });

  it('lọc ra rỗng: No trips match, câu gợi ý, link Reset về danh sách gốc', () => {
    render(
      <BookingsListView
        result={result({})}
        params={{ ...NONE, status: ['CANCELLED'] }}
        today={TODAY}
      />,
    );

    expect(screen.getByText('0 of 18 trips')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No trips match' })).toBeInTheDocument();
    expect(screen.getByText('Try another search or clear the filters.')).toBeInTheDocument();
    // Hàng lọc cũng có NÚT Reset (role button); ở đây là LINK của trạng thái rỗng.
    expect(screen.getByRole('link', { name: 'Reset' })).toHaveAttribute(
      'href',
      '/account/bookings',
    );
    expect(screen.queryByRole('navigation', { name: 'Trip pages' })).toBeNull();
  });

  it('sang trang khác thì hàng ĐẦU của trang mới mở sẵn', () => {
    const { rerender } = render(
      <BookingsListView
        result={result({ items: [trip(1), trip(2)], total: 12, totalPages: 2 })}
        params={NONE}
        today={TODAY}
      />,
    );
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute(
      'href',
      '/account/bookings/BK-TRIP0001',
    );

    rerender(
      <BookingsListView
        result={result({ items: [trip(3), trip(4)], page: 2, total: 12, totalPages: 2 })}
        params={{ ...NONE, page: 2 }}
        today={TODAY}
      />,
    );
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute(
      'href',
      '/account/bookings/BK-TRIP0003',
    );
  });
});
```

- [ ] **Bước 2. Test trước — dòng của accordion.** Trong `passport.spec.tsx`, thêm vào CUỐI describe
  `BookingAccordion` (ngay trước dấu `});` đóng describe, sau ca
  `REFUNDED đã qua ngày → không mời Review`). `TODAY` của describe là `'2026-08-15'`, `one` là
  helper có sẵn:

```tsx
  /** Dòng meta dưới tên tour — so TRỌN chuỗi "mã · dòng phụ · ngày". */
  const meta = (text: string) =>
    screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === text);

  // ADR-0054 §1: dòng phụ đọc giai đoạn qua `bookingPhase`. PARTIALLY_REFUNDED là đơn CÒN
  // hiệu lực — "Ends …" và đếm ngược như PAID (bản cũ chỉ cho PAID).
  it('PARTIALLY_REFUNDED đang đi → "Ends …"', () => {
    render(
      one({
        status: 'PARTIALLY_REFUNDED',
        departureStartDate: '2026-08-14',
        departureEndDate: '2026-08-16',
      }),
    );
    expect(meta('BK-TESTAAAA · Ends 16 Aug 2026 · 14–16 Aug 2026')).toBeInTheDocument();
  });

  it('PARTIALLY_REFUNDED sắp đi → đếm ngược', () => {
    render(
      one({
        status: 'PARTIALLY_REFUNDED',
        departureStartDate: '2026-08-27',
        departureEndDate: '2026-08-29',
      }),
    );
    expect(meta('BK-TESTAAAA · In 12 days · 27–29 Aug 2026')).toBeInTheDocument();
  });

  it('REFUNDED còn ngày đi tương lai → không đếm ngược (giai đoạn cancelled)', () => {
    render(
      one({ status: 'REFUNDED', departureStartDate: '2026-08-27', departureEndDate: '2026-08-29' }),
    );
    expect(meta('BK-TESTAAAA · 27–29 Aug 2026')).toBeInTheDocument();
  });

  it('PENDING chưa tới ngày đi → đếm ngược và mời trả', () => {
    render(
      one({
        status: 'PENDING',
        paidAt: null,
        departureStartDate: '2026-08-27',
        departureEndDate: '2026-08-29',
      }),
    );
    expect(meta('BK-TESTAAAA · In 12 days · 27–29 Aug 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pay now' })).toBeInTheDocument();
  });

  it('PENDING tới đúng ngày đi (lapsed) → không Pay now, không đếm ngược', () => {
    render(
      one({
        status: 'PENDING',
        paidAt: null,
        departureStartDate: '2026-08-15',
        departureEndDate: '2026-08-15',
      }),
    );
    expect(meta('BK-TESTAAAA · 15 Aug 2026')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pay now' })).not.toBeInTheDocument();
  });

  it('chưa trả tiền thì ô tổng ghi "Total"; đã trả ghi "Total paid"', () => {
    const { unmount } = render(one({ status: 'CANCELLED', paidAt: null }));
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.queryByText('Total paid')).not.toBeInTheDocument();
    unmount();

    render(one({ status: 'REFUNDED', paidAt: '2026-07-01T00:00:00.000Z' }));
    expect(screen.getByText('Total paid')).toBeInTheDocument();
  });
```

- [ ] **Bước 3.** `pnpm --filter @tourism/web exec vitest run src/components/account/bookings-list-view.spec.tsx src/components/passport/passport.spec.tsx`
  — ĐỎ: chưa có module `./bookings-list-view`; trong `passport.spec.tsx` đỏ đúng bốn ca mới
  (PARTIALLY_REFUNDED đang đi, PARTIALLY_REFUNDED sắp đi, lapsed, nhãn "Total"); hai ca REFUNDED
  tương lai và PENDING sắp đi xanh ngay (canh hồi quy), mọi ca cũ xanh.

- [ ] **Bước 4. Cài — i18n.** Trong `messages.ts`, khối `accountBookings`, chèn ngay TRƯỚC dòng
  `    // Trang hộ chiếu: nút hiện diện tĩnh cho "Load more" (chunk \`?page=\`,` (tức ngay sau
  `olderTripsAria` của Task A8):

```ts
    /** Nút tròn quay lại ở hero của My bookings (`ContentHero.back`). */
    backToPassport: 'Back to Passport',
    /** Dòng đếm khi đang lọc hay tìm; chưa lọc thì dùng `passportBookings.metaTrips`. */
    tripsOf: (n: number, total: number) => `${n} of ${total} ${total === 1 ? 'trip' : 'trips'}`,
    noMatchHeading: 'No trips match',
    noMatchBody: 'Try another search or clear the filters.',
```

  Build i18n: `pnpm turbo run build --filter=@tourism/i18n --output-logs=errors-only`.

- [ ] **Bước 5. Cài — thân trang.** Tạo `bookings-list-view.tsx`:

```tsx
import type { BookingsListResult } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { BookingsToolbar } from '@/components/account/bookings-toolbar';
import { TripPager } from '@/components/account/trip-pager';
import { BookingAccordion } from '@/components/passport/booking-accordion';
import {
  BOOKINGS_LIST_PATH,
  type BookingsListParams,
  bookingsListHref,
  hasListFilters,
} from '@/lib/bookings-list';

/**
 * Thân trang My bookings (spec P7 §7.2–7.4) — tách khỏi `page.tsx` để test được: Vitest của
 * web không quét `src/app/**`. Trang lo phiên, URL, lời gọi API và chuyển trang; component này
 * lo mọi thứ khách thấy dưới hero.
 *
 * - Khách chưa có đơn nào: trạng thái trống cũ, không bày hàng lọc.
 * - Dòng đếm: "{total} trips"; đang lọc hay tìm thì "{total} of {overallTotal} trips".
 * - Lọc ra rỗng: "No trips match" kèm link Reset về danh sách gốc.
 * - `BookingAccordion` mang `key` theo URL: mỗi trang và mỗi bộ lọc dựng accordion MỚI, nên
 *   hàng đầu của trang mới mở sẵn. `defaultValue` chỉ được đọc lúc dựng — giữ accordion cũ thì
 *   sang trang 2 không hàng nào mở.
 */
export function BookingsListView({
  result,
  params,
  today,
}: {
  result: BookingsListResult;
  params: BookingsListParams;
  /** Ngày lịch Việt Nam do server tính (`todayDateString`). */
  today: string;
}) {
  const t = messages.passportBookings;
  const tb = messages.accountBookings;

  if (result.overallTotal === 0) {
    return (
      <div className="mt-12 text-center">
        <h2 className="font-heading text-2xl font-semibold text-balance">{t.emptyHeading}</h2>
        <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground">
          {t.emptyBody}
        </p>
        <ButtonLink href="/tours" className="mt-6">
          {t.emptyCta}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <BookingsToolbar params={params} facets={result.facets} />
      {/* `aria-live`: lọc xong thì trình đọc màn hình đọc lại số đơn mới. */}
      <p aria-live="polite" className="mt-3 text-[12.5px] text-muted-foreground tabular-nums">
        {hasListFilters(params)
          ? tb.tripsOf(result.total, result.overallTotal)
          : t.metaTrips(result.total)}
      </p>
      {result.total === 0 ? (
        <div className="mt-10 text-center">
          <h2 className="font-heading text-2xl font-semibold text-balance">{tb.noMatchHeading}</h2>
          <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground">
            {tb.noMatchBody}
          </p>
          <ButtonLink href={BOOKINGS_LIST_PATH} variant="outline" className="mt-6">
            {tb.reset}
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-2.5">
          <BookingAccordion key={bookingsListHref(params)} bookings={result.items} today={today} />
          <TripPager
            params={params}
            totalPages={result.totalPages}
            total={result.total}
            limit={result.limit}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Bước 6. Cài — dòng của accordion.** Trong `booking-accordion.tsx`:
  - dòng 3 thành `import { type Booking, bookingPhase, tripDayNumbers } from '@tourism/contract';`;
    xoá dòng 17 `import { daysUntilDeparture } from '@/lib/account-stats';`;
  - trong JSDoc đầu file, ngay sau dòng
    ` * review) vẫn ở trang chi tiết, ở đây chỉ có thông tin + lối vào.` thêm:

```tsx
 *
 * Dòng phụ ("In N days" / "Ends …"), nút Pay now và link Review đọc giai đoạn qua
 * `bookingPhase` của contract (ADR-0054 §1) — cùng luật API dùng để xếp danh sách.
```

  - thay khối từ `        const started = booking.departureStartDate <= today;` tới hết dòng
    `        const canReview = view.tone === 'success' && ended;` (dòng 64–78; dòng
    `const detailHref` ở giữa giữ nguyên chữ) bằng:

```tsx
        // Giai đoạn qua MỘT luật dùng chung với API (ADR-0054 §1): danh sách đã xếp theo chính
        // luật này, nên dòng phụ và vị trí của hàng không bao giờ nói hai điều khác nhau.
        const phase = bookingPhase(booking, today);
        const detailHref = `/account/bookings/${booking.code}`;
        const lead =
          phase === 'on_tour'
            ? tb.endsOn(formatDateRange(booking.departureEndDate, booking.departureEndDate))
            : phase === 'upcoming' || phase === 'awaiting_payment'
              ? tb.inDays(tripDayNumbers(booking, today).daysToGo)
              : null;
        // Tới ngày đi mà chưa trả là `lapsed`: chuyến đã hết nhận đặt (ADR-0041 §3), nên không
        // mời trả tiền nữa.
        const canPay = phase === 'awaiting_payment' && view.actions.includes('payNow');
        // Hôm sau ngày về theo giờ VN thì ngày UTC ít nhất đã tới ngày về, nên
        // cổng review (UTC) của API chắc chắn đã mở — link không dẫn tới form
        // bị từ chối. Review chỉ dành cho đơn PAID (`reviewSlot`).
        const canReview = phase === 'travelled' && booking.status === 'PAID';
        // "Total paid" chỉ đúng khi tiền đã về — cùng luật `isVoucher` của `BookingReceipt`.
        const totalLabel =
          booking.paidAt === null ? messages.checkoutSummary.totalLabel : tv.labels.total;
```

  - trong ô thứ tư của lưới (dòng 151–158), thay `{tv.labels.total}` bằng `{totalLabel}`.

- [ ] **Bước 7. Cài — trang.** Đọc trước `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
  (mục `searchParams`: Promise, giá trị `string | string[] | undefined`) và
  `.../04-functions/redirect.md` (Server Component: `redirect` ném để ngắt render, mặc định 307 —
  không đặt trong `try/catch`). Thay TRỌN `apps/web/src/app/(site)/account/bookings/page.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BookingsListView } from '@/components/account/bookings-list-view';
import { ContentHero } from '@/components/content/content-hero';
import { todayDateString } from '@/lib/account-stats';
import { fetchMyBookingsPage } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import {
  BOOKINGS_LIST_PATH,
  bookingsListApiInput,
  bookingsListHref,
  bookingsListParams,
} from '@/lib/bookings-list';
import type { RawSearchParam } from '@/lib/search-params';

/**
 * `/account/bookings` — My bookings (spec P7 §7, ADR-0054). Bộ lọc, từ khoá và số trang nằm
 * trên URL; server lọc, xếp theo hành trình và cắt 10 đơn mỗi trang. Thay "Load more" cộng dồn
 * cũ: sang trang không còn xáo thứ tự, và đơn thứ 51 trở đi tới được.
 */
export const metadata: Metadata = {
  title: 'My bookings — Nexora',
};

export default async function AccountBookingsPage({
  searchParams,
}: {
  // `string[]` khi một khoá lặp lại trên URL — `bookingsListParams` chuẩn hoá ở biên.
  searchParams: Promise<Record<string, RawSearchParam>>;
}) {
  await requireSession(BOOKINGS_LIST_PATH);
  const params = bookingsListParams(await searchParams);
  const cookie = (await cookies()).toString();
  const result = await fetchMyBookingsPage(cookie, bookingsListApiInput(params));

  // `page` vượt số trang (link cũ, gõ tay, vừa huỷ bớt đơn) → về trang cuối (spec §2.7).
  // `redirect` ném để ngắt render, nên không bọc trong `try/catch`.
  if (result.totalPages > 0 && params.page > result.totalPages) {
    redirect(bookingsListHref({ ...params, page: result.totalPages }));
  }

  const t = messages.passportBookings;
  return (
    <div>
      <ContentHero
        breadcrumb={t.breadcrumb}
        title={t.title}
        meta={t.metaTrips(result.overallTotal)}
        back={{ href: '/account', label: messages.accountBookings.backToPassport }}
      />
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-16 md:px-8 md:pb-20">
        <BookingsListView result={result} params={params} today={todayDateString()} />
      </div>
    </div>
  );
}
```

  Link chữ "← Passport" dưới hero biến mất cùng bản cũ (spec §4.1).

- [ ] **Bước 8.** Chạy lại lệnh Bước 3 — XANH (5 ca thân trang; 13 ca accordion: 7 cũ, 6 mới).

- [ ] **Bước 9. Gỡ thứ hết người dùng.** Trang cũ là người dùng duy nhất của các thứ dưới đây
  (đo: `grep -rn "loadMore\|BOOKINGS_PAGE_SIZE\|groupBookingsByTime\|daysUntilDeparture" apps libs --include=*.ts --include=*.tsx`
  trước bước này chỉ ra trang cũ, accordion cũ, `account-stats.*` và chính định nghĩa;
  `passportBookings.back` chỉ có `t.back` của trang cũ):
  - `messages.ts`, khối `accountBookings`: xoá ba dòng
    `    // Trang hộ chiếu: nút hiện diện tĩnh cho "Load more" (chunk \`?page=\`,`,
    `    // xem \`AccountPassportPage\`).`, `    loadMore: 'Load more',`;
  - `messages.ts`, khối `passportBookings`: xoá dòng `    back: '← Passport',` nằm GIỮA
    `    metaTrips: (n: number) => …` và `    emptyHeading: 'No trips booked yet',` (ba khối
    khác cũng có `back: '← Passport'` — chỉ xoá dòng của `passportBookings`);
  - `messages.ts`, ba comment đã nói sai — thay GIỮ ĐÚNG số dòng, để dòng của `travellers`
    vẫn là `messages.ts:2433` mà Phần C trích:
    - bốn dòng comment ngay trên `  accountBookings: {` (từ `  // Chỉ còn phần SỐNG sau khi trang`
      tới `  // Dọn key mồ côi ngày 11/08 (fixer cuối, xem docs/CHANGELOG.md).`) thành:

```ts
  // Trang My bookings `/account/bookings` (spec P7 §7, ADR-0054): dòng phụ của
  // `BookingAccordion`, hàng tìm và lọc, phân trang, nút quay lại Passport.
  // `travellers` dùng chung với trang chi tiết đơn và admin (`bookings-view.ts`)
  // — một booking một câu. "Load more" và khoá `loadMore` đã gỡ (P7 Phần A).
```

    - hai dòng JSDoc của `inDays` thành:

```ts
    /** Dòng phụ của hàng sắp đi (`upcoming`, `awaiting_payment` — luôn n ≥ 1);
     *  biên hai đầu có câu riêng, "N days" chỉ dùng từ ngày thứ hai trở đi. */
```

    - một dòng JSDoc của `endsOn` thành
      ``    /** Dòng phụ của hàng đang đi (`on_tour`) — thay `inDays`. */``;
  - `apps/web/src/lib/api/bookings.ts`: xoá khối `BOOKINGS_PAGE_SIZE` (dòng 6–8, JSDoc và hằng);
    thay JSDoc của `fetchMyBookings` (sáu dòng từ `/**` tới ` */` ngay trên hàm) bằng:

```ts
/**
 * Booking của chính user, mới nhất trước (thứ tự `recent` mặc định của `bookings.mine`). Chỉ
 * trang Passport (`/account`) gọi — một lượt `BOOKINGS_MAX_LIMIT` để tính thống kê, tem và bản
 * đồ. My bookings dùng `fetchMyBookingsPage`.
 */
```

  - `apps/web/src/lib/account-stats.ts`: dòng 1 thành `import { vietnamToday } from '@tourism/contract';`;
    xoá từ dòng 27 (`/** Số mili-giây một ngày — dùng để đếm ngày, không phải để cộng giờ. */`)
    tới hết file — tức `MS_PER_DAY`, `daysUntilDeparture`, `BookingGroups`,
    `groupBookingsByTime`. Luật nhóm của `groupBookingsByTime` (REFUNDED tương lai vào "sắp đi")
    chính là sự thật 3 mà ADR-0054 sửa; thứ tự nay do server xếp.
  - `apps/web/src/lib/account-stats.spec.ts`: dòng 2–3 thành MỘT dòng
    `import { todayDateString } from './account-stats';` (bỏ import `makeBooking`); xoá hai
    describe `daysUntilDeparture — …` và `groupBookingsByTime — …` (dòng 37 tới hết file). Giữ
    `beforeEach`/`afterEach` đồng hồ giả và describe `todayDateString`.

  Build i18n lại. Rồi:
  `grep -rn "loadMore\|BOOKINGS_PAGE_SIZE\|groupBookingsByTime\|daysUntilDeparture" apps/web/src libs/shared/i18n/src --include=*.ts --include=*.tsx`
  — RỖNG. `pnpm --filter @tourism/web typecheck` xanh (nó bắt mọi chỗ còn đọc
  `passportBookings.back`).

- [ ] **Bước 10.** `pnpm --filter @tourism/web exec vitest run src/components src/lib` — XANH (số ca
  của `account-stats.spec.ts` giảm 16: 5 ca `daysUntilDeparture`, 11 ca `groupBookingsByTime`
  — ghi vào bàn giao). **Đột biến** (mỗi cái một lần): bỏ `key` của `BookingAccordion` (ca "sang
  trang khác" đỏ); `hasListFilters(params)` thành `false` (ca "2 of 18 trips" đỏ); bỏ nhánh
  `overallTotal === 0` (ca trống đỏ); dòng phụ bỏ vế `|| phase === 'awaiting_payment'` (ca
  PENDING chưa tới ngày đi đỏ); `canPay` trở lại
  `view.actions.includes('payNow') && booking.departureEndDate >= today` (ca lapsed đỏ);
  `totalLabel` theo `booking.status === 'PENDING'` thay vì `paidAt` (ca CANCELLED chưa trả đỏ);
  dòng phụ chỉ cho `booking.status === 'PAID'` (hai ca PARTIALLY_REFUNDED đỏ).

- [ ] **Bước 11.** Chạy quy trình gate ở mục Ràng buộc toàn cục (build web prerender trang khác —
  trang này động vì đọc `cookies()`). Commit (stage
  `apps/web/src/components/account/bookings-list-view.tsx`,
  `apps/web/src/components/account/bookings-list-view.spec.tsx`,
  `apps/web/src/app/(site)/account/bookings/page.tsx`,
  `apps/web/src/components/passport/booking-accordion.tsx`,
  `apps/web/src/components/passport/passport.spec.tsx`, `apps/web/src/lib/account-stats.ts`,
  `apps/web/src/lib/account-stats.spec.ts`, `apps/web/src/lib/api/bookings.ts`,
  `libs/shared/i18n/src/lib/messages.ts`):
  `feat(web): My bookings lọc, tìm, 10 đơn mỗi trang theo thứ tự hành trình`

### Task 10 — A10 · Web: dòng tiền và tên cổng thanh toán dùng chung (`bookingPriceLines`, `paymentProviderLabel`)

**Files:**

- Modify: `apps/web/src/lib/checkout.ts` (import dòng 1; thêm sau `computeBookingTotal`,
  dòng 39–45)
- Modify: `apps/web/src/lib/checkout.spec.ts` (import dòng 3–10; thêm describe cuối file)
- Modify: `apps/web/src/lib/booking-vm.ts` (thêm hàm CUỐI file, sau `refundSummary`)
- Modify: `apps/web/src/lib/booking-vm.spec.ts` (import dòng 4–9; thêm describe cuối file)
- Modify: `apps/web/src/components/checkout/booking-receipt.tsx` (JSDoc thêm sau dòng 29;
  import dòng 8; xoá bảng `PROVIDER_LABEL` dòng 47–51; xoá dòng 107–114; dòng 192; dòng 245–248)

**Interfaces:**

- Consumes: `messages.checkoutSummary.adultsLine` / `childrenLine` (`messages.ts:546-547`),
  `formatMoney` (`apps/web/src/lib/tours.ts:424`, làm tròn đơn vị),
  `messages.booking.form.stripe` = `'Card (Stripe)'` (`messages.ts:289`),
  `messages.booking.form.paypal` = `'PayPal'` (`messages.ts:291`).
- Produces (Phần B và C chỉ import, không tự dựng bản thứ hai):
  - ĐÚNG chữ ký ở "Giao diện dùng chung" — B và C đã viết test ghim
    "2 adults · $98 · 1 child · $49" theo nó: `interface PriceLine { label: string; amount: string }`,
    `bookingPriceLines(booking: Pick<Booking, 'unitPrice' | 'numAdults' | 'numChildren' | 'currency'>): PriceLine[]`
    ở `apps/web/src/lib/checkout.ts`;
  - `paymentProviderLabel(provider: Booking['paymentProvider']): string` ở CUỐI
    `apps/web/src/lib/booking-vm.ts` — `'STRIPE'` → `'Card (Stripe)'`, `'PAYPAL'` → `'PayPal'`.
  `BookingReceipt` dùng cả hai và bỏ bảng `PROVIDER_LABEL` riêng; hành vi không đổi. Bảng
  `PROVIDER_LABEL` thứ hai ở trang chi tiết đơn (`app/(site)/account/bookings/[code]/page.tsx:30-33`)
  để nguyên — Phần B viết lại trang ấy và import hàm này.

Không đổi dòng 13 của `booking-receipt.tsx` (`* Hoá đơn kiêm cuống vé cho \`/checkout/success\` …`):
Task C4 sửa đúng dòng ấy bằng khớp chữ. Câu JSDoc mới chèn SAU dòng 29, nên dòng 13 và đoạn
27–29 mà Phần B trích giữ nguyên số dòng.

- [ ] **Bước 1. Test trước.** Trong `booking-vm.spec.ts`, thêm `paymentProviderLabel` vào khối import
  từ `'./booking-vm'` (dòng 4–9), rồi thêm cuối file:

```ts
describe('paymentProviderLabel — tên cổng thanh toán cho khách đọc', () => {
  // Chữ ghim nguyên văn `messages.booking.form.stripe|paypal` (messages.ts:289,291).
  it.each([
    ['STRIPE', 'Card (Stripe)'],
    ['PAYPAL', 'PayPal'],
  ] as const)('%s → %s', (provider, label) => {
    expect(paymentProviderLabel(provider)).toBe(label);
  });
});
```

  Trong `checkout.spec.ts`, thêm `bookingPriceLines` vào khối import từ `'./checkout'` (đứng đầu
  theo thứ tự chữ cái), rồi thêm cuối file:

```ts
describe('bookingPriceLines — dòng tiền theo người lớn và trẻ em (spec P7 §4.2)', () => {
  it('tách người lớn và trẻ em; số tiền = đơn giá × số người', () => {
    expect(
      bookingPriceLines({ unitPrice: '49.00', numAdults: 2, numChildren: 1, currency: 'USD' }),
    ).toEqual([
      { label: '2 adults', amount: '$98' },
      { label: '1 child', amount: '$49' },
    ]);
  });

  /** Một dòng "0 children" chỉ làm hoá đơn dài ra mà không thêm sự thật nào. */
  it('không có trẻ em thì chỉ một dòng', () => {
    expect(
      bookingPriceLines({ unitPrice: '39.00', numAdults: 1, numChildren: 0, currency: 'USD' }),
    ).toEqual([{ label: '1 adult', amount: '$39' }]);
  });

  it('làm tròn đơn vị như biên nhận trước nay (`formatMoney`)', () => {
    expect(
      bookingPriceLines({ unitPrice: '19.50', numAdults: 3, numChildren: 2, currency: 'USD' }),
    ).toEqual([
      { label: '3 adults', amount: '$59' },
      { label: '2 children', amount: '$39' },
    ]);
  });

  it('nhận thẳng một Booking — đúng cách trang chi tiết và voucher gọi', () => {
    expect(
      bookingPriceLines(makeBooking({ unitPrice: '120.00', numAdults: 2, numChildren: 0 })),
    ).toEqual([{ label: '2 adults', amount: '$240' }]);
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/web exec vitest run src/lib/checkout.spec.ts src/lib/booking-vm.spec.ts`
  — ĐỎ: `bookingPriceLines` và `paymentProviderLabel` chưa export.

- [ ] **Bước 3. Cài.** Cuối `booking-vm.ts` (sau hàm `refundSummary`; file đã import `Booking` và
  `messages`) thêm:

```ts
/**
 * Tên cổng thanh toán cho khách đọc ("Card (Stripe)", "PayPal") — MỘT nguồn cho biên nhận,
 * trang chi tiết đơn và voucher. Trước P7 có hai bảng `PROVIDER_LABEL` chép tay (biên nhận và
 * trang chi tiết đơn); hai bản là hai chỗ sẽ trôi lệch khi thêm cổng. `switch` đủ mọi giá trị:
 * enum `PaymentProvider` thêm cổng mới thì typecheck đỏ ngay ở đây.
 */
export function paymentProviderLabel(provider: Booking['paymentProvider']): string {
  switch (provider) {
    case 'STRIPE':
      return messages.booking.form.stripe;
    case 'PAYPAL':
      return messages.booking.form.paypal;
  }
}
```

  Trong `checkout.ts`, sau dòng 1 thêm:

```ts
import { messages } from '@tourism/i18n';
import { formatMoney } from './tours';
```

  rồi chèn ngay sau hàm `computeBookingTotal` (sau dấu `}` ở dòng 45):

```ts
/** Một dòng tiền của đơn: nhãn ("2 adults") và số tiền đã định dạng ("$98"). */
export interface PriceLine {
  label: string;
  amount: string;
}

/**
 * Dòng tiền theo người lớn và trẻ em — MỘT nguồn cho biên nhận (`BookingReceipt`), trang chi
 * tiết đơn và voucher (spec P7 §4.2). Trẻ em cùng đơn giá người lớn (luật của
 * `computeBookingTotal` ngay trên). Nhãn từ `messages.checkoutSummary`, số tiền là
 * `formatMoney(đơn giá × số người)` — làm tròn đơn vị đúng như biên nhận trước nay. Không có
 * trẻ em thì bỏ hẳn dòng ấy.
 */
export function bookingPriceLines(
  booking: Pick<Booking, 'unitPrice' | 'numAdults' | 'numChildren' | 'currency'>,
): PriceLine[] {
  const ts = messages.checkoutSummary;
  const line = (label: string, travellers: number): PriceLine => ({
    label,
    amount: formatMoney((Number(booking.unitPrice) * travellers).toFixed(2), booking.currency),
  });
  const lines = [line(ts.adultsLine(booking.numAdults), booking.numAdults)];
  if (booking.numChildren > 0) {
    lines.push(line(ts.childrenLine(booking.numChildren), booking.numChildren));
  }
  return lines;
}
```

  (`tours.ts` không import `checkout.ts` — không có vòng import.)

- [ ] **Bước 4.** Chạy lại lệnh Bước 2 — XANH.

- [ ] **Bước 5. `BookingReceipt` dùng helper.** Trong `booking-receipt.tsx`:
  - JSDoc đầu file: ngay SAU dòng 29
    `` * vờ làm vé"). Đường xé ở đây là hàng chấm — cùng công thức `TicketTear`. `` thêm đúng
    MỘT câu (ba dòng, cùng đoạn):

```tsx
 * Riêng vé của TRANG CHI TIẾT ĐƠN, user duyệt lại đúng combo gạch đứt + vết khuyết ngày
 * 05/10/2026 (plan P7 quyết định 4, bản vẽ `booking-detail.src.html`); quyết định 19/08 ở đây
 * vẫn đúng cho biên nhận này và cho voucher.
```

  - dòng 8 thành
    `import { bookingPriceLines, ticketBarcodeWidths, ticketSerial } from '@/lib/checkout';`
    và thêm `import { paymentProviderLabel } from '@/lib/booking-vm';` ngay trên nó (thứ tự
    chữ cái của đường dẫn: `booking-vm` trước `checkout`);
  - xoá bảng `PROVIDER_LABEL` (dòng 47–50, cùng dòng trống 51 sau nó); dòng 192
    `<p className="font-medium">{PROVIDER_LABEL[booking.paymentProvider]}</p>` thành
    `<p className="font-medium">{paymentProviderLabel(booking.paymentProvider)}</p>`;
  - xoá hai hằng `adultsAmount` và `childrenAmount` (dòng 107–114);
  - thay bốn dòng (245–248)

```tsx
            <Row k={ts.adultsLine(booking.numAdults)} v={adultsAmount} />
            {booking.numChildren > 0 ? (
              <Row k={ts.childrenLine(booking.numChildren)} v={childrenAmount} />
            ) : null}
```

    bằng:

```tsx
            {bookingPriceLines(booking).map((line) => (
              <Row key={line.label} k={line.label} v={line.amount} />
            ))}
```

  `ts`, `messages` và `formatMoney` vẫn còn người dùng trong file (cột Travellers, chế độ thử,
  tổng, dòng thuế) — giữ import.

- [ ] **Bước 6.** `pnpm --filter @tourism/web exec vitest run src/lib/checkout.spec.ts src/lib/booking-vm.spec.ts src/components/checkout/booking-receipt.spec.tsx`
  — XANH, spec biên nhận không đổi một dòng nào (ca "tách dòng người lớn và trẻ em",
  "numChildren = 0 thì bỏ hẳn dòng trẻ em" và ba cột dữ liệu vẫn xanh).
  `pnpm --filter @tourism/web typecheck` xanh. Hai lệnh Phần B và C dùng để kiểm sự tồn tại phải
  ra đúng một dòng mỗi lệnh:
  `grep -n "export function bookingPriceLines" apps/web/src/lib/checkout.ts`,
  `grep -n "export function paymentProviderLabel" apps/web/src/lib/booking-vm.ts`; và
  `grep -n "PROVIDER_LABEL" apps/web/src/components/checkout/booking-receipt.tsx` — rỗng.
  **Đột biến:** nhân cả hai dòng với `numAdults + numChildren` (ca đầu đỏ); bỏ điều kiện
  `numChildren > 0` (ca một dòng đỏ); in `formatMoney(booking.unitPrice, …)` không nhân (ca đầu
  đỏ); `formatMoneyExact` thay `formatMoney` (ca làm tròn đỏ — "$58.50"); đảo hai nhánh của
  `paymentProviderLabel` (hai ca của nó đỏ).

- [ ] **Bước 7.** Chạy quy trình gate ở mục Ràng buộc toàn cục. Commit (stage
  `apps/web/src/lib/checkout.ts`, `apps/web/src/lib/checkout.spec.ts`,
  `apps/web/src/lib/booking-vm.ts`, `apps/web/src/lib/booking-vm.spec.ts`,
  `apps/web/src/components/checkout/booking-receipt.tsx`):
  `refactor(web): dòng tiền và tên cổng thanh toán của đơn thành hàm dùng chung`

### Task 11 — A11 · Soi bố cục Phần A bằng CSS build thật

jsdom không có bố cục (bài học 5). Cách làm của Task 13 plan P4e-4: DOM của CHÍNH các
component, đổ ra trang tĩnh, nối với CSS mà `next build` của web vừa sinh, rồi đo bằng trình
duyệt ở hai khổ — 1280px (bề rộng bản vẽ `booking-list.src.html`) và 375px (spec §11 bước 10).
Không commit gì — trừ khi phải sửa lỗi bố cục tìm ra.

**Files (tạm, xoá ở Bước 7):**

- Create: `apps/web/src/components/__layout-check__/render.spec.tsx` (project `dom` của Vitest
  quét `src/components/**/*.spec.tsx`)
- Output: `apps/web/.next/layout-check/*.html` (`.next/` đã nằm trong `.gitignore`)

- [ ] **Bước 1.** Build web (đã có nếu vừa chạy gate của Task A10 — cần API sống, xem bước 1 của
  Quy trình gate). `ls apps/web/.next/static/chunks/*.css` phải ra ít nhất hai file; font của
  `next/font` trỏ `url(../media/…)` tương đối nên máy chủ tĩnh ở Bước 3 phục vụ được.

- [ ] **Bước 2.** Tạo spec tạm `render.spec.tsx` (bọc đúng khung của `page.tsx` — hero có `back`
  rồi khối `max-w-5xl` — vì trang là Server Component async, không render thẳng trong jsdom
  được):

```tsx
// TẠM — soi bố cục P7 Phần A bằng CSS build thật (plan P7, Task A11). KHÔNG commit.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import type { BookingStatusValue, BookingsListResult } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeAll, describe, it, vi } from 'vitest';
import { BookingsListView } from '@/components/account/bookings-list-view';
import { ContentHero } from '@/components/content/content-hero';
import type { BookingsListParams } from '@/lib/bookings-list';
import { makeBooking } from '@/test/fixtures/booking';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// cwd của vitest là apps/web.
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

/**
 * Trang tĩnh không có JS: `motion` để lại `opacity: 0` của `initial` trong DOM. Đây là bản sao
 * quy tắc `<noscript>` của `app/layout.tsx`; jsdom ghi style có dấu cách sau dấu hai chấm nên
 * phải bắt cả hai dạng.
 */
const NO_JS_MOTION =
  '<style>[style*="opacity:0"],[style*="opacity: 0"]{opacity:1!important;transform:none!important}</style>';

const TODAY = '2026-10-05';
const STATUSES: BookingStatusValue[] = [
  'PAID',
  'PAID',
  'PENDING',
  'PAID',
  'PARTIALLY_REFUNDED',
  'PAID',
  'CANCELLED',
  'REFUNDED',
  'PAID',
  'PAID',
];
/** Mười đơn đủ kiểu; đơn đầu có tên tour rất dài để soi chỗ dễ tràn. */
const ITEMS = STATUSES.map((status, index) =>
  makeBooking({
    id: `b0000000-0000-4000-8000-0000000000${String(index).padStart(2, '0')}`,
    code: `BK-LAYOUT${String(index).padStart(2, '0')}`,
    status,
    paidAt: status === 'PENDING' ? null : '2026-09-01T00:00:00.000Z',
    tourTitle:
      index === 0
        ? 'Northern Highlights: Hanoi–Hạ Long–Ninh Bình 5D4N with a very long overnight cruise'
        : `Quy Nhơn Coastal Escape ${index + 1}D`,
    departureStartDate: `2026-11-${10 + index}`,
    departureEndDate: `2026-11-${12 + index}`,
  }),
);
const FACETS: BookingsListResult['facets'] = {
  when: { ON_TOUR: 1, UPCOMING: 12, PAST: 5 },
  status: { PENDING: 1, PAID: 14, CANCELLED: 1, REFUNDED: 1, PARTIALLY_REFUNDED: 1 },
};
const NONE: BookingsListParams = { q: null, when: [], status: [], page: 1 };
/** Một giá trị ở When, hai ở Status, có từ khoá: nút lọc phải giữ nguyên 176px. */
const FILTERED: BookingsListParams = {
  q: 'ha noi',
  when: ['UPCOMING'],
  status: ['PAID', 'REFUNDED'],
  page: 1,
};

function page(name: string, params: BookingsListParams, result: BookingsListResult) {
  const t = messages.passportBookings;
  render(
    <div>
      <ContentHero
        breadcrumb={t.breadcrumb}
        title={t.title}
        meta={t.metaTrips(result.overallTotal)}
        back={{ href: '/account', label: messages.accountBookings.backToPassport }}
      />
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-16 md:px-8 md:pb-20">
        <BookingsListView result={result} params={params} today={TODAY} />
      </div>
    </div>,
  );
  const links = CSS.map((file) => `<link rel="stylesheet" href="/static/chunks/${file}">`).join('');
  writeFileSync(
    `${OUT}/${name}.html`,
    `<!doctype html><html lang="en" class="${FONT_CLASSES.join(' ')} h-full antialiased"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${links}${NO_JS_MOTION}</head><body class="min-h-full flex flex-col">${document.body.innerHTML}</body></html>`,
  );
}

describe('layout-check P7 Phần A', () => {
  it('bookings-list', () =>
    page('bookings-list', NONE, {
      items: ITEMS,
      page: 1,
      limit: 10,
      total: 18,
      totalPages: 2,
      facets: FACETS,
      overallTotal: 18,
    }));
  it('bookings-filtered', () =>
    page('bookings-filtered', FILTERED, {
      items: ITEMS.slice(0, 3),
      page: 1,
      limit: 10,
      total: 3,
      totalPages: 1,
      facets: FACETS,
      overallTotal: 18,
    }));
});
```

  Chạy: `pnpm --filter @tourism/web exec vitest run src/components/__layout-check__/render.spec.tsx`
  — hai ca xanh, hai file trong `apps/web/.next/layout-check/`.

- [ ] **Bước 3.** Mở máy chủ tĩnh ở nền (Git Bash, từ gốc worktree):
  `python -m http.server 8767 --directory apps/web/.next` (cổng 8767 để khỏi đụng 8766 mà đợt
  sửa admin ở checkout gốc có thể đang dùng). Mở
  `http://localhost:8767/layout-check/bookings-list.html` trong Browser pane (`preview_start`
  với `url`). Chữ phải ra đúng Archivo/Literata của site; không có thì Bước 2 thiếu lớp font.

- [ ] **Bước 4. Đoạn đo** — chạy bằng `javascript_tool` ở mỗi trang, mỗi khổ:

```js
(() => {
  const box = (el) => el.getBoundingClientRect();
  const r = Math.round;
  const mid = (el) => box(el).top + box(el).height / 2;
  const search = document.querySelector('input[type="search"]');
  const row = search.closest('form').parentElement;
  const filters = [...row.querySelectorAll(':scope > button[aria-haspopup]')];
  const reset = [...row.children].find(
    (el) => el.tagName === 'BUTTON' && !el.hasAttribute('aria-haspopup'),
  );
  const back = document.querySelector('a[title="Back to Passport"]');
  const crumb = document.querySelector('nav[aria-label="Breadcrumb"]');
  const pager = document.querySelector('nav[aria-label="Trip pages"]');
  const [newer, summary, older] = pager ? [...pager.children] : [];
  return {
    viewport: innerWidth,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    back: [r(box(back).width), r(box(back).height)],
    backBeforeCrumb: box(back).right <= box(crumb).left,
    backMidDelta: r(mid(back) - mid(crumb)),
    rowWidth: r(box(row).width),
    search: [r(box(search).width), r(box(search).height), r(box(search).top)],
    filters: filters.map((b) => [r(box(b).width), r(box(b).height), r(box(b).top)]),
    reset: reset ? [r(box(reset).width), r(box(reset).height), r(box(reset).top)] : null,
    pager: pager && {
      midSpread: r(
        Math.max(mid(newer), mid(summary), mid(older)) -
          Math.min(mid(newer), mid(summary), mid(older)),
      ),
      linksMidDelta: r(mid(newer) - mid(older)),
      summaryAboveLinks: box(summary).bottom <= box(newer).top,
      newerLeft: r(box(newer).left - box(pager).left),
      olderRight: r(box(pager).right - box(older).right),
    },
  };
})()
```

- [ ] **Bước 5. Đo ở 1280px.** `resize_window` 1280×900, chạy đoạn đo ở `bookings-list.html` rồi
  `bookings-filtered.html`. Đạt khi, ở CẢ HAI trang:
  - `overflowX` 0;
  - `back` là `[34, 34]`, `backBeforeCrumb` true, `|backMidDelta|` ≤ 1;
  - `search` rộng 290, cao 36; `filters` là hai cặp `[176, 36, …]` — kể cả ở trang lọc, nơi When
    mang nhãn "Upcoming" và Status mang "2 selected" (spec §7.2: cỡ cố định dù đã chọn hay chưa);
  - ô tìm và hai nút lọc cùng `top` (±1) — một hàng;
  - trang lọc: `reset` cao 36, cùng `top` với nút lọc; trang chưa lọc: `reset` là `null`.

  Riêng `bookings-list.html`: `pager.midSpread` ≤ 2, `newerLeft` 0 (±1), `olderRight` 0 (±1).
  Chụp một ảnh màn mỗi trang để ghi vào bàn giao, đặt cạnh bản vẽ `booking-list.src.html` (phần
  "Trang đầy đủ") để soi bằng mắt: hàng lọc, dòng "18 trips", hàng thẻ, thanh phân trang.

- [ ] **Bước 6. Đo ở 375px.** `resize_window` 375×812, chạy lại đoạn đo ở hai trang. Đạt khi:
  - `overflowX` 0; `back` vẫn `[34, 34]`;
  - `search[0]` bằng `rowWidth` (±1), cao 36 — ô tìm chiếm cả hàng đầu;
  - hai nút lọc cùng `top`, `top` lớn hơn của ô tìm, rộng bằng nhau (±1); ở trang chưa lọc
    `w1 + w2 + 8` bằng `rowWidth` (±2) — chia đôi hàng hai (khoảng cách `gap-2`);
  - trang lọc: `reset[0]` ≤ 40 (chỉ còn icon) và cùng `top` với hai nút lọc;
  - `bookings-list.html`: `pager.summaryAboveLinks` true, `|linksMidDelta|` ≤ 2,
    `newerLeft` 0 (±1), `olderRight` 0 (±1).

  Trả khổ về `desktop` khi xong.

- [ ] **Bước 7. Dọn.** Tắt máy chủ tĩnh (PowerShell):
  `Get-NetTCPConnection -LocalPort 8767 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`;
  xoá `apps/web/src/components/__layout-check__/` và `apps/web/.next/layout-check/`.
  `git status` phải sạch.

- [ ] **Bước 8.** Có phép đo trượt: sửa đúng chỗ (TDD nếu sửa logic), gate, commit `fix(web): …` mô
  tả lỗi bố cục; rồi đo lại. Ghi mọi số đo (cả lần trượt) vào bàn giao.

### Task 12 — A12 · Gate cuối Phần A, docs, bàn giao

**Files:**

- Modify: `docs/CHANGELOG.md`
- Modify: `docs/handoff/mobile-booking-handoff.md` (hàng `T1` của bảng mục 4)

- [ ] **Bước 1.** `git log --oneline main..HEAD` — sau ba commit docs của session gốc (`d0f067ad`
  ADR-0054 + spec + bản vẽ, commit plan, commit prompt thi công) là mười commit của A1–A10 (cộng commit `fix` của A11 nếu có), không commit lạ.
  `git diff --stat main..HEAD` không chạm file nào ngoài "Bản đồ file" của Phần A và tài liệu của
  plan.

- [ ] **Bước 2.** Các phép kiểm phải đúng:
  - `grep -rn "loadMore\|BOOKINGS_PAGE_SIZE\|groupBookingsByTime\|daysUntilDeparture" apps/web/src libs/shared/i18n/src --include=*.ts --include=*.tsx`
    — rỗng;
  - `grep -n "output(BookingsListResultSchema)" libs/shared/contract/src/contract.ts` — một dòng;
  - `grep -n "export function bookingPriceLines" apps/web/src/lib/checkout.ts` và
    `grep -n "export function paymentProviderLabel" apps/web/src/lib/booking-vm.ts` — mỗi lệnh
    một dòng (Phần B và C bắt đầu bằng hai lệnh này).

  Quy trình gate trên đỉnh nhánh; ghi số test từng gói (Vitest) và số int (ca, file).

- [ ] **Bước 3. Ghi chú cho mobile.** `docs/handoff/mobile-booking-handoff.md`, bảng mục 4: thay
  hàng

```markdown
| T1 | `bookings.mine` | Phân trang, mới nhất trước. Lọc Upcoming/Past làm ở máy — API chưa có tham số đó |
```

  bằng:

```markdown
| T1 | `bookings.mine` | Phân trang. Từ P7 (ADR-0054) API lọc và tìm sẵn: `order: 'journey'` (đang đi → sắp đi → đã qua), `when` (mảng `ON_TOUR`/`UPCOMING`/`PAST`), `status` (một giá trị hoặc mảng), `q`; trả thêm `facets` và `overallTotal`. Không truyền gì thì như cũ — mới nhất trước |
```

  `git diff docs/handoff/mobile-booking-handoff.md` chỉ được có đúng hàng ấy.

- [ ] **Bước 4. Entry CHANGELOG** — chèn ngay dưới khối `> **File này chỉ giữ đợt đang chạy**…`, TRÊN
  entry mới nhất. Ngày là ngày chạy bước này. Khuôn:

```markdown
## 2026-MM-DD — P7 Phần A: My bookings lọc, tìm và phân trang theo hành trình (nhánh `feat/booking-pages-redesign`)

Trang `/account/bookings` có hàng tìm và lọc (When · Status, chọn nhiều, số đếm tĩnh), 10 đơn
mỗi trang xếp theo hành trình — đang đi, sắp đi, đã qua — và phân trang "Newer / Older trips";
hero có nút tròn quay lại Passport. Quyết định ở ADR-0054, hợp đồng ở spec 05/10 (§2.1, §2.7,
§3, §4, §7). Không migration, không env.

(Một đoạn cho contract và API: `bookingPhase` · `bookingWhen` · `tripDayNumbers` dùng chung;
`bookings.mine` nhận `when`, `status` mảng, `q`, `order=journey`, trả `facets` và
`overallTotal`; service đọc tập khoá nhẹ rồi nạp đủ dòng cho các id của trang. Một đoạn cho web:
`ContentHero.back`, tham số URL, hàng lọc, phân trang, `BookingsListView`, accordion đọc giai
đoạn, `bookingPriceLines` và `paymentProviderLabel` cho Phần B và C, gỡ "Load more" và hai
helper hết người dùng. Một đoạn chỗ lệch plan nếu có, kèm lý do; một đoạn số đo Task A11 ở
1280px và 375px.)

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **N** (web …, api …, admin …, contract …, core …, ui …, tokens …, i18n …,
mobile …, mobile-ui …), int **N ở N file**. Liệt kê số ca mới theo gói, số ca đã gỡ
(`account-stats.spec.ts` −16) và các đột biến đã thử, kể cả cái không giết được.

CÒN TREO cho session gốc: không có việc hạ tầng (không migration, không env, không webhook).
```

  Không để dòng nào bắt đầu bằng `+`; tổng số test gói trọn trong một dòng hoặc nối bằng chữ
  "và". `git diff docs/CHANGELOG.md` phải chỉ có phần thêm.

- [ ] **Bước 5.** Bỏ — dòng P7 của `docs/open-items.md` và roadmap trong `CLAUDE.md` do session gốc
  sửa lúc merge (quyết định 26).

- [ ] **Bước 6.** `./scripts/docs-freshness.sh` (Git Bash) — xanh.

- [ ] **Bước 7. Commit** (stage `docs/CHANGELOG.md`,
  `docs/handoff/mobile-booking-handoff.md`):
  `docs: entry CHANGELOG cho P7 Phần A — My bookings lọc, tìm, phân trang`

- [ ] **Bước 8. Dọn.** Tắt API (chạy cô lập thì tắt đúng PID của mình, không bao giờ theo cổng
  3001), xoá `/tmp/p7-api.log`. Không còn tiến trình nào CỦA MÌNH nghe cổng 3101 hay 8767 (cổng
  3001 có thể là API của session khác — không đụng). Đã
  dùng DB int riêng thì `DROP DATABASE tourism_test_p7` và xoá `apps/api/out/`. Xoá
  `apps/*/.turbo`, `.turbo` gốc và `apps/*/.next` của worktree; báo dung lượng ổ C trước và sau.

- [ ] **Bước 9. Bàn giao** — KHÔNG merge. Báo cho session gốc: danh sách commit · kết quả gate (số
  test từng gói, int) · đột biến đã thử và kết quả (kể cả cái không giết được: `aria-label` của
  nút quay lại ở A5, `filterBy` dùng `current.q` ở A7 — kèm lý do) · số đo Task A11 ở 1280px và
  375px, kèm ảnh · chỗ lệch plan và vì sao · việc cần hạ tầng (dự kiến: không có).

#### Sau khi bàn giao Phần A — việc của session gốc

1. Review nhánh ở mức max effort, vá TRỌN phát hiện trên chính nhánh này (nếp F14–F19, P4e-4).
   Đọc kỹ: `selectBookingsPage` (thứ tự `journey`, khoá phụ `createdAt desc, id asc`, `facets`
   đếm TRƯỚC khi lọc, `searchKey` bỏ cả khoảng trắng và dấu câu); `BookingsService.mine` giữ
   đúng thứ tự hàm thuần trả và rào `userId` ở cả hai câu đọc; hàng lọc (debounce, `sentQ`
   chống đè chữ đang gõ, `useOptimistic`, tiêu điểm sau ✕ và Reset); `key` của
   `BookingAccordion`; chuyển về trang cuối khi `page` vượt số trang; dòng phụ, Pay now và
   Review của accordion theo `bookingPhase` (đơn `lapsed` mất nút Pay now); các khoá i18n đã gỡ.
2. Hỏi user trước khi merge. Rebase nhánh lên `main`, `git merge --ff-only`, push bằng SHA đích
   danh; `gh run list --branch main --limit 1` phải xanh (luật 14).
3. Deploy: không migration, không env. Vercel đưa web lên có thể TRƯỚC Render đưa API: trong khe
   ấy `/account/bookings` ra trang lỗi (web mới gửi `status[0]=…` mà API cũ chỉ nhận một giá
   trị, và đọc `facets` mà API cũ không trả); Passport không bị gì — nó chỉ gửi `page`, `limit`.
   Kiểm Render bằng MCP (`list_deploys` của service API), không bằng uptime; thấy
   `update_failed` kiểu EMAXCONNSESSION (G23) thì hỏi user trước khi kích deploy lại.
   Để khỏi có khe ấy, push `main` hai nhịp: SHA của commit cuối Task 4 (A4) trước, chờ Render
   deploy API xong (web cũ vẫn chạy với API mới — nó chỉ gửi `page`, `limit` và chỉ đọc
   `items`, `total`), rồi mới push SHA cuối của Phần A.
4. Entry CHANGELOG ngày merge; dòng P7 trong `docs/open-items.md` và roadmap trong `CLAUDE.md` (Phần A đã merge); trạng thái
   ADR-0054 thành Accepted nếu user đã duyệt spec.
5. Thử tay trên production theo spec §11 bước 1–3, TỪNG BƯỚC, chờ user xác nhận mỗi bước;
   session gốc kiểm DB bằng SQL chỉ đọc:
   - **Bước 1 — hai trang:** chọn tài khoản có từ 11 đơn
     (`SELECT user_id, count(*) FROM bookings GROUP BY user_id ORDER BY 2 DESC LIMIT 3` — prod
     05/10 nhiều nhất 14). "Older trips" sang trang 2 mà thứ tự không xáo, "Newer trips" quay
     lại; đối chiếu thứ tự với `status`, `departure_start_date` của tài khoản ấy.
   - **Bước 2 — lọc:** When = Upcoming; thêm Status; Reset; số đếm cạnh mỗi lựa chọn khớp
     `SELECT status, count(*) … GROUP BY status` của tài khoản; mở một đơn rồi bấm Back của trình
     duyệt thì về đúng URL đã lọc (lọc dùng `router.replace`, nên mục lịch sử là URL đã lọc).
   - **Bước 3 — tìm:** "hanoi", "ha noi", mã đơn có và không có `BK-`.
6. Phần B và C bắt đầu sau khi Phần A đã vào `main` (`git rebase main` trước task đầu tiên của
   mỗi phần, mục "Điều kiện bắt đầu").


## Phần B — Trang chi tiết đơn (Task 13–21)

> Bắt đầu khi `main` đã có Phần A: `git rebase main` trước Task 13. Hết Task 21 thì DỪNG để
> session gốc review và merge.

### Task 13 — B1 · Chữ của trang, hàm ngày có thứ, mốc thanh hành trình

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` — khối MỚI cấp cao nhất `bookingDetail`, chèn
  ngay sau dấu `},` đóng khối `accountBookingDetail` (dòng ngay trên comment
  `// Trang \`/account/profile\` hợp nhất (spec §3): tên/phone + đổi mật khẩu +`). Neo theo
  chữ, không theo số dòng: Phần A sửa `accountBookings` ở phía trên nên số dòng đã dời.
- Test: `libs/shared/i18n/src/lib/messages.spec.ts` (thêm một `describe` cuối file)
- Modify: `apps/web/src/lib/tours.ts` — thêm `calendarDateParts`, `formatWeekdayDate` ngay sau
  hàm `formatDialogDate` (kết thúc ở `tours.ts:518`), trước JSDoc của `formatChipDate`
- Test: `apps/web/src/lib/tours.spec.ts` (thêm hai tên vào khối import, hai `describe` cuối file)
- Create: `apps/web/src/lib/booking-journey.ts`
- Test: `apps/web/src/lib/booking-journey.spec.ts`

**Interfaces:**

- Consumes (Phần A): `bookingPhase`, `BookingPhase`, `calendarDaysBetween`, `tripDayNumbers` từ
  `@tourism/contract`. Có sẵn: `refundSummary`, `RefundSummary` (`lib/booking-vm.ts:103,116`);
  `formatDate`, `formatChipDate`, `formatMoneyExact`, hằng `DOW`, `MONTHS` (`lib/tours.ts`);
  `messages.checkoutSummary.freeCancellation` ("Free cancellation").
- Produces:
  - `messages.bookingDetail` — TOÀN BỘ chữ mới của Phần B (Bước 3). Khối này tạo một lần ở đây
    vì B2–B7 đều đọc nó; gói i18n được đọc từ `dist` nên mỗi lần sửa là một lần build lại.
  - `calendarDateParts(date: string): { weekday: string; day: number; month: string; year: number }`
  - `formatWeekdayDate(date: string, options?: { year?: boolean }): string` — "Tue 3 Nov" /
    "Tue 3 Nov 2026".
  - `journeyMilestones(booking: BookingDetail, today: string): JourneyView` cùng các kiểu
    `JourneyView`, `JourneyMilestone`, `JourneyChip`, `JourneyChipTone`
    (`'active' | 'done' | 'warning' | 'muted'`), `JourneyVariant`
    (`'standard' | 'cancelled' | 'lapsed'`), `MilestoneKey`, `MilestoneState`
    (`'done' | 'now' | 'next'`).

- [ ] **Bước 0. Kiểm giao diện của Phần A đã có.** Từ gốc repo (Git Bash), cả bốn lệnh phải in
  ít nhất một dòng; thiếu dòng nào thì DỪNG, báo session gốc (Phần A chưa merge hay đã đổi tên):

```bash
grep -n "export function bookingPhase\|export function tripDayNumbers\|export function calendarDaysBetween\|export const ACTIVE_BOOKING_STATUSES" libs/shared/contract/src/schemas/booking-phase.ts
grep -n "booking-phase" libs/shared/contract/src/index.ts
grep -n "export function bookingPriceLines" apps/web/src/lib/checkout.ts
grep -n "back?: { href: string; label: string }" apps/web/src/components/content/content-hero.tsx
```

- [ ] **Bước 1. Test chữ trước.** Thêm vào CUỐI `libs/shared/i18n/src/lib/messages.spec.ts`
  (file chạy với `globals: true`, không import `describe`/`it`/`expect` — giữ đúng nếp file):

```ts
describe('messages: bookingDetail (P7 phần B — trang chi tiết đơn)', () => {
  const d = messages.bookingDetail;

  it('mọi chuỗi trong khối đều có chữ', () => {
    const walk = (node: unknown): string[] => {
      if (typeof node === 'string') return [node];
      if (typeof node === 'function' || node === null) return [];
      return Object.values(node as object).flatMap(walk);
    };
    for (const value of walk(d)) expect(value.trim().length).toBeGreaterThan(0);
  });

  it('độ dài chuyến: số ít và số nhiều', () => {
    expect(d.ticket.days(1)).toBe('1 day');
    expect(d.ticket.days(3)).toBe('3 days');
  });

  it('chip đơn sắp đi: còn một ngày thì "tomorrow"', () => {
    expect(d.journey.departsIn(1)).toBe('Departs tomorrow');
    expect(d.journey.departsIn(2)).toBe('Departs in 2 days');
    expect(d.journey.departsIn(29)).toBe('Departs in 29 days');
  });

  it('ngày trong chuyến, số khách, dòng đã hoàn, dòng đã trả, chân khối Get ready', () => {
    expect(d.journey.dayOf(2, 3)).toBe('Day 2 of 3');
    expect(d.ticket.admit(3)).toBe('Admit 3');
    // Dấu trừ là U+2212 (−), không phải gạch nối.
    expect(d.details.refundedAmount('$20.00')).toBe('−$20.00');
    expect(d.details.paidInFull('PayPal', '14 Aug 2026')).toBe(
      'Paid in full by PayPal on 14 Aug 2026',
    );
    expect(d.getReady.reviewOpens('Thu 5 Nov')).toBe(
      'Your review opens after the trip ends on Thu 5 Nov.',
    );
    expect(d.journey.refundPartial('$73.50', '$147.00')).toBe('$73.50 of $147.00');
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/i18n test -- src/lib/messages.spec.ts` — ĐỎ: bốn ca của
  `describe` mới ném `TypeError` (đọc thuộc tính của `messages.bookingDetail` là `undefined`).

- [ ] **Bước 3. Cài chữ.** Chèn khối dưới đây vào `messages.ts` ở vị trí đã nêu trong Files (sau
  `},` đóng `accountBookingDetail`). Dấu nháy đơn trong câu là ’ (U+2019), đúng nếp các khối
  bên cạnh (`accountBookingDetail.cancelDialog`, `reviews`):

```ts
  /**
   * Trang chi tiết đơn `/account/bookings/[code]` (spec P7 §2.2–2.5, §5, §8) — vé kiểu
   * boarding pass, thanh hành trình, cột trái thông tin đơn, cột phải theo giai đoạn.
   *
   * CHỈ chữ mới. Chữ đã có thì trang đọc tại chỗ, không chép sang đây: dải vé, mộc, nhãn
   * "Travellers", hai nút Contact us / View voucher (`passportVisa`); "View tour", chữ hoàn
   * tiền, câu kết thúc, khu review (`accountBookingDetail`, `reviews`); câu hạn huỷ
   * (`cancellationDeadline`); "Free cancellation", "Total", dòng người lớn/trẻ em
   * (`checkoutSummary`); "Total paid", "Payment", "Departs {ngày}", câu mã chưa thành voucher
   * (`booking.success`); tên cổng (`booking.form`); chế độ thử (`tourDetail.booking.testMode`);
   * "Day N" (`tourDetail.itinerary.dayLabel`); "Browse tours" (`booking.list.browse`).
   */
  bookingDetail: {
    /** Nút tròn cạnh breadcrumb của hero (`ContentHero.back`) — về danh sách đơn. */
    back: 'Back to My bookings',
    /** Ô của vé và khối đầu cột trái — một khái niệm một chữ. */
    leadTraveller: 'Lead traveller',
    /** Mốc đầu thanh hành trình, ô của vé và dòng ngày đặt ở khối Details. */
    booked: 'Booked',
    ticket: {
      departs: 'Departs',
      returns: 'Returns',
      /** Độ dài chuyến theo ngày lịch, tính cả ngày đi lẫn ngày về. */
      days: (n: number) => (n === 1 ? '1 day' : `${n} days`),
      paidWith: 'Paid with',
      /** Ô "Paid with" của đơn chưa từng thu tiền: chờ trả, huỷ khi chưa trả, lỡ hạn trả. */
      notPaid: 'Not paid',
      /** Dải đầu cuống vé — tổng số khách, người lớn cộng trẻ em. */
      admit: (n: number) => `Admit ${n}`,
      taxesIncluded: 'Taxes and fees included',
    },
    journey: {
      heading: 'Trip journey',
      paid: 'Paid',
      awaitingPayment: 'Awaiting payment',
      until: (date: string) => `Until ${date}`,
      ended: (date: string) => `Ended ${date}`,
      departure: 'Departure',
      departed: 'Departed',
      tripEnds: 'Trip ends',
      tripEnded: 'Trip ended',
      today: 'Today',
      /** Chip đơn sắp đi — `n` ≥ 1 vì `upcoming` nghĩa là ngày đi còn ở sau hôm nay. */
      departsIn: (n: number) => (n === 1 ? 'Departs tomorrow' : `Departs in ${n} days`),
      dayOf: (day: number, total: number) => `Day ${day} of ${total}`,
      completed: 'Completed',
      cancelled: 'Cancelled',
      refund: 'Refund',
      /** Nói cả hai số, cùng lý do với `accountBookingDetail.refundLine.partial`. */
      refundPartial: (amount: string, total: string) => `${amount} of ${total}`,
      refundNone: 'No refund due',
      paymentNotCompleted: 'Payment not completed',
    },
    getReady: {
      heading: 'Get ready',
      /** Đứng sau con số cỡ lớn ("29" · "days to go"); còn đúng một ngày thì thay bằng `tomorrow`. */
      daysToGo: 'days to go',
      tomorrow: 'Tomorrow',
      budget: 'Budget for what’s not included',
      /** Ô tích chỉ nằm ở `localStorage` của máy này (spec §2.4) — câu này nói đúng điều đó. */
      budgetNote: 'Tick them off — saved on this device.',
      pickupOn: (date: string) => `Pickup on ${date}`,
      fullItinerary: 'Full itinerary',
      reviewOpens: (date: string) => `Your review opens after the trip ends on ${date}.`,
    },
    onTour: {
      heading: 'Today’s plan',
      /** Câu dẫn đứng trước link "Contact us" (`passportVisa.contactUs`). */
      needHelp: 'Need help today?',
    },
    details: {
      cancellation: 'Cancellation',
      heading: 'Details',
      meetingPoint: 'Meeting point',
      specialRequests: 'Special requests',
      none: 'None',
      refunded: 'Refunded',
      /** Dấu trừ U+2212, không phải gạch nối. */
      refundedAmount: (amount: string) => `−${amount}`,
      paidInFull: (provider: string, date: string) => `Paid in full by ${provider} on ${date}`,
      questions: 'Questions about this trip?',
    },
    closed: {
      notPaidInTime: 'This booking wasn’t paid in time.',
      thanks: 'Thanks for travelling with us.',
    },
  },
```

- [ ] **Bước 4.** Build lại contract và i18n:
  `pnpm turbo run build --filter=@tourism/contract --filter=@tourism/i18n --output-logs=errors-only`,
  rồi chạy lại lệnh Bước 2 — XANH.

- [ ] **Bước 5. Test hàm ngày trước.** Trong `apps/web/src/lib/tours.spec.ts`, khối
  `import { … } from './tours';` thêm `calendarDateParts,` ngay TRƯỚC `cardPrice,` và
  `formatWeekdayDate,` ngay SAU `formatTicketDate,`. Thêm vào cuối file:

```ts
describe('calendarDateParts — mảnh ngày lịch cho khuôn ghép riêng (vé trang chi tiết đơn)', () => {
  it('tách thứ, ngày, tháng viết tắt, năm; thứ đọc theo UTC', () => {
    expect(calendarDateParts('2026-11-03')).toEqual({
      weekday: 'Tue',
      day: 3,
      month: 'Nov',
      year: 2026,
    });
    expect(calendarDateParts('2026-01-01')).toEqual({
      weekday: 'Thu',
      day: 1,
      month: 'Jan',
      year: 2026,
    });
  });
});

describe('formatWeekdayDate — "Tue 3 Nov" của trang chi tiết đơn', () => {
  it('thứ + ngày KHÔNG đệm 0 + tháng; không năm, không dấu phẩy', () => {
    expect(formatWeekdayDate('2026-11-03')).toBe('Tue 3 Nov');
    expect(formatWeekdayDate('2026-02-11')).toBe('Wed 11 Feb');
  });

  it('`year: true` thêm năm', () => {
    expect(formatWeekdayDate('2026-11-03', { year: true })).toBe('Tue 3 Nov 2026');
  });

  it('biên năm không lệch ở múi giờ âm', () => {
    expect(formatWeekdayDate('2026-12-31', { year: true })).toBe('Thu 31 Dec 2026');
  });
});
```

- [ ] **Bước 6.** `pnpm --filter @tourism/web test -- src/lib/tours.spec.ts` — ĐỎ: hai hàm mới
  là `undefined` (`TypeError: … is not a function`).

- [ ] **Bước 7. Cài.** Trong `apps/web/src/lib/tours.ts`, chèn ngay sau dấu `}` đóng
  `formatDialogDate`:

```ts
/**
 * Các mảnh của một ngày lịch `YYYY-MM-DD`: thứ viết tắt, ngày, tháng viết tắt, năm — cho chỗ
 * cần ghép ngày theo khuôn riêng (cặp "03 NOV" / "Tue · 2026" trên vé của trang chi tiết
 * đơn). Cùng luật timezone với `formatDialogDate`: tách chuỗi, thứ đọc theo UTC.
 */
export function calendarDateParts(date: string): {
  weekday: string;
  day: number;
  month: string;
  year: number;
} {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return {
    weekday: DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '',
    day: d,
    month: MONTHS[m - 1] ?? '',
    year: y,
  };
}

/**
 * "Tue 3 Nov" — thứ + ngày + tháng viết tắt, khuôn của bản vẽ trang chi tiết đơn (mốc hành
 * trình, "Pickup on …", "… trip ends on …"). `{ year: true }` thêm năm ("Tue 3 Nov 2026")
 * cho dòng "Departs …" của khối Get ready, nơi thiếu năm là mơ hồ. Khác `formatDialogDate`
 * ("Mon, 14 Sep"): không dấu phẩy, ngày không đệm 0.
 */
export function formatWeekdayDate(date: string, options: { year?: boolean } = {}): string {
  const { weekday, day, month, year } = calendarDateParts(date);
  return options.year ? `${weekday} ${day} ${month} ${year}` : `${weekday} ${day} ${month}`;
}
```

- [ ] **Bước 8.** Chạy lại lệnh Bước 6 — XANH.

- [ ] **Bước 9. Test mốc hành trình trước.** Tạo `apps/web/src/lib/booking-journey.spec.ts`:

```ts
import type { BookingCancellation } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { type JourneyView, journeyMilestones } from './booking-journey';

/**
 * Thanh hành trình (spec P7 §2.2). Ngày lấy từ bản vẽ `booking-detail.src.html`: đơn sắp đi
 * "Hanoi Heritage in a Day" đi 03/11, hôm nay 05/10 (còn 29 ngày, nhãn TODAY ở `left:43%`
 * của khung, vạch tô `width:33%`); đơn đã đi "Bà Nà Hills" đi 11/02. Ngày đặt và ngày trả
 * CỐ Ý khác nhau để bắt cách cài lấy nhầm mốc.
 */
const TODAY = '2026-10-05';

function cancellationOf(overrides: Partial<BookingCancellation> = {}): BookingCancellation {
  return {
    deadline: '2026-11-02',
    withinDeadline: true,
    refundAmount: '147.00',
    canCancel: true,
    ...overrides,
  };
}

const UPCOMING = makeBooking({
  status: 'PAID',
  createdAt: '2026-08-13T10:00:00.000Z',
  paidAt: '2026-08-14T03:05:00.000Z',
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-03',
  cancellationDeadline: '2026-11-02',
  cancellation: cancellationOf(),
  totalAmount: '147.00',
});

/** [khoá, nhãn, dòng phụ, trạng thái] — so cả bốn cùng lúc. */
const rows = (view: JourneyView) =>
  view.milestones.map((milestone) => [
    milestone.key,
    milestone.label,
    milestone.detail,
    milestone.state,
  ]);

describe('journeyMilestones — đơn sắp đi (bản vẽ, hôm nay 05/10)', () => {
  it('năm mốc theo thứ tự; mốc chưa xong đầu tiên là "now"', () => {
    expect(rows(journeyMilestones(UPCOMING, TODAY))).toEqual([
      ['booked', 'Booked', '13 Aug 2026', 'done'],
      ['paid', 'Paid', '14 Aug 2026', 'done'],
      ['freeCancellation', 'Free cancellation', 'Until Mon 2 Nov', 'now'],
      ['departure', 'Departure', 'Tue 3 Nov', 'next'],
      ['tripEnds', 'Trip ends', 'Tue 3 Nov', 'next'],
    ]);
  });

  it('Today theo tỷ lệ ngày giữa Paid (14/08) và hạn huỷ (02/11): 52/80 của đoạn thứ hai', () => {
    const view = journeyMilestones(UPCOMING, TODAY);
    expect(view.variant).toBe('standard');
    // (1 + 52/80) / 4 đoạn = 41.25% vạch; bản vẽ: 10% + 80% × 41.25% = 43% khung.
    expect(view.today).toEqual({ percent: 41.25, before: 2 });
    expect(view.fillPercent).toBe(41.25);
    expect(view.chip).toEqual({ label: 'Departs in 29 days', tone: 'active' });
  });

  it('đúng ngày chót vẫn còn hạn (hết 23:59 giờ VN); chip "tomorrow"; Today kẹp ở 80% đoạn', () => {
    const view = journeyMilestones(UPCOMING, '2026-11-02');
    expect(view.milestones[2]).toEqual({
      key: 'freeCancellation',
      label: 'Free cancellation',
      detail: 'Until Mon 2 Nov',
      state: 'now',
    });
    expect(view.chip).toEqual({ label: 'Departs tomorrow', tone: 'active' });
    // Tỷ lệ 80/80 = 1, kẹp về 0.8 để nhãn không đè icon mốc: (1 + 0.8) / 4.
    expect(view.today).toEqual({ percent: 45, before: 2 });
  });

  it('đã qua hạn huỷ: mốc ghi "Ended", tính là xong, Today nằm giữa hạn huỷ và ngày đi', () => {
    const late = makeBooking({
      status: 'PAID',
      createdAt: '2026-09-30T02:00:00.000Z',
      paidAt: '2026-10-01T02:10:00.000Z',
      departureStartDate: '2026-11-10',
      departureEndDate: '2026-11-12',
      cancellationDeadline: '2026-11-07',
      cancellation: cancellationOf({
        deadline: '2026-11-07',
        withinDeadline: false,
        refundAmount: '0.00',
      }),
    });
    const view = journeyMilestones(late, '2026-11-08');
    expect(rows(view).slice(2)).toEqual([
      ['freeCancellation', 'Free cancellation', 'Ended 7 Nov', 'done'],
      ['departure', 'Departure', 'Tue 10 Nov', 'now'],
      ['tripEnds', 'Trip ends', 'Thu 12 Nov', 'next'],
    ]);
    // (2 + 1/3) / 4 = 58.33%.
    expect(view.today).toEqual({ percent: 58.33, before: 3 });
    expect(view.chip).toEqual({ label: 'Departs in 2 days', tone: 'active' });
  });

  it('PARTIALLY_REFUNDED là đơn còn hiệu lực: vẫn thanh thường, vẫn đếm ngày', () => {
    const view = journeyMilestones(
      { ...UPCOMING, status: 'PARTIALLY_REFUNDED', refundedTotal: '20.00' },
      TODAY,
    );
    expect(view.variant).toBe('standard');
    expect(view.chip).toEqual({ label: 'Departs in 29 days', tone: 'active' });
  });
});

describe('journeyMilestones — đang đi (04–06/10)', () => {
  const ON_TOUR = makeBooking({
    status: 'PAID',
    createdAt: '2026-08-31T02:00:00.000Z',
    paidAt: '2026-09-01T02:10:00.000Z',
    departureStartDate: '2026-10-04',
    departureEndDate: '2026-10-06',
    cancellationDeadline: '2026-10-01',
    cancellation: cancellationOf({
      deadline: '2026-10-01',
      withinDeadline: false,
      refundAmount: '0.00',
      canCancel: false,
    }),
  });

  it('giữa chuyến: "Departed" đã xong, "Trip ends" là mốc đang tới, chip ngày thứ mấy', () => {
    const view = journeyMilestones(ON_TOUR, TODAY);
    expect(rows(view).slice(2)).toEqual([
      ['freeCancellation', 'Free cancellation', 'Ended 1 Oct', 'done'],
      ['departure', 'Departed', 'Sun 4 Oct', 'done'],
      ['tripEnds', 'Trip ends', 'Tue 6 Oct', 'now'],
    ]);
    expect(view.today).toEqual({ percent: 87.5, before: 4 });
    expect(view.chip).toEqual({ label: 'Day 2 of 3', tone: 'active' });
  });

  it('ngày về: chuyến CHƯA kết thúc — "Trip ends" vẫn là mốc đang tới', () => {
    const view = journeyMilestones(ON_TOUR, '2026-10-06');
    expect(view.milestones[4]).toEqual({
      key: 'tripEnds',
      label: 'Trip ends',
      detail: 'Tue 6 Oct',
      state: 'now',
    });
    expect(view.chip).toEqual({ label: 'Day 3 of 3', tone: 'active' });
    expect(view.today).toEqual({ percent: 95, before: 4 });
  });

  it('ngày đi: "Departed" ngay từ hôm nay; Today kẹp ở 20% đoạn cuối', () => {
    const view = journeyMilestones(ON_TOUR, '2026-10-04');
    expect(view.milestones[3]?.label).toBe('Departed');
    expect(view.chip).toEqual({ label: 'Day 1 of 3', tone: 'active' });
    expect(view.today).toEqual({ percent: 80, before: 4 });
  });
});

describe('journeyMilestones — đã đi (bản vẽ: Bà Nà Hills 11/02)', () => {
  it('mọi mốc xong, nhãn sang thì quá khứ, không còn Today', () => {
    const travelled = makeBooking({
      status: 'PAID',
      createdAt: '2026-02-09T08:00:00.000Z',
      paidAt: '2026-02-10T01:00:00.000Z',
      departureStartDate: '2026-02-11',
      departureEndDate: '2026-02-11',
      cancellationDeadline: '2026-02-10',
      cancellation: cancellationOf({
        deadline: '2026-02-10',
        withinDeadline: false,
        refundAmount: '0.00',
        canCancel: false,
      }),
    });
    const view = journeyMilestones(travelled, TODAY);
    expect(rows(view)).toEqual([
      ['booked', 'Booked', '9 Feb 2026', 'done'],
      ['paid', 'Paid', '10 Feb 2026', 'done'],
      ['freeCancellation', 'Free cancellation', 'Ended 10 Feb', 'done'],
      ['departure', 'Departed', 'Wed 11 Feb', 'done'],
      ['tripEnds', 'Trip ended', 'Wed 11 Feb', 'done'],
    ]);
    expect(view.today).toBeNull();
    expect(view.fillPercent).toBe(100);
    expect(view.chip).toEqual({ label: 'Completed', tone: 'done' });
  });
});

describe('journeyMilestones — chờ trả tiền', () => {
  const PENDING = makeBooking({
    status: 'PENDING',
    paidAt: null,
    createdAt: '2026-10-05T01:00:00.000Z',
    departureStartDate: '2026-10-20',
    departureEndDate: '2026-10-22',
    cancellationDeadline: '2026-10-17',
    cancellation: null,
  });

  it('mốc Paid ghi "Awaiting payment" và là mốc đang tới; Today giữa Booked và Paid', () => {
    const view = journeyMilestones(PENDING, TODAY);
    expect(rows(view)).toEqual([
      ['booked', 'Booked', '5 Oct 2026', 'done'],
      ['paid', 'Paid', 'Awaiting payment', 'now'],
      ['freeCancellation', 'Free cancellation', 'Until Sat 17 Oct', 'next'],
      ['departure', 'Departure', 'Tue 20 Oct', 'next'],
      ['tripEnds', 'Trip ends', 'Thu 22 Oct', 'next'],
    ]);
    // Paid chưa có ngày nên không chia theo tỷ lệ được — nhãn đứng giữa đoạn: 0.5 / 4.
    expect(view.today).toEqual({ percent: 12.5, before: 1 });
    expect(view.chip).toEqual({ label: 'Awaiting payment', tone: 'warning' });
  });

  it('không có cờ server: đúng ngày chót vẫn là "Until"', () => {
    const view = journeyMilestones(PENDING, '2026-10-17');
    expect(view.milestones[2]).toEqual({
      key: 'freeCancellation',
      label: 'Free cancellation',
      detail: 'Until Sat 17 Oct',
      state: 'next',
    });
  });

  it('không có cờ server: qua ngày chót là "Ended" dù tiền chưa trả', () => {
    const view = journeyMilestones(PENDING, '2026-10-18');
    expect(rows(view).slice(1, 4)).toEqual([
      ['paid', 'Paid', 'Awaiting payment', 'now'],
      ['freeCancellation', 'Free cancellation', 'Ended 17 Oct', 'done'],
      ['departure', 'Departure', 'Tue 20 Oct', 'next'],
    ]);
    expect(view.today).toEqual({ percent: 58.33, before: 3 });
  });
});

describe('journeyMilestones — đã huỷ', () => {
  const CANCELLED = makeBooking({
    status: 'CANCELLED',
    createdAt: '2026-08-14T03:00:00.000Z',
    paidAt: '2026-08-15T03:05:00.000Z',
    cancelledAt: '2026-09-21T02:00:00.000Z',
    cancellationDecidedAt: '2026-09-20T08:00:00.000Z',
    cancellationRequestedAt: '2026-09-19T08:00:00.000Z',
    refundedTotal: '147.00',
    totalAmount: '147.00',
    // Ngày đi còn ở tương lai: đơn huỷ KHÔNG được thành "sắp đi" (spec P7, mục Đóng).
    departureStartDate: '2026-11-03',
    departureEndDate: '2026-11-03',
    cancellation: null,
  });

  it('bốn mốc Booked → Paid → Cancelled → Refund; ngày huỷ lấy `cancelledAt`', () => {
    const view = journeyMilestones(CANCELLED, TODAY);
    expect(view.variant).toBe('cancelled');
    expect(rows(view)).toEqual([
      ['booked', 'Booked', '14 Aug 2026', 'done'],
      ['paid', 'Paid', '15 Aug 2026', 'done'],
      ['cancelled', 'Cancelled', '21 Sep 2026', 'done'],
      ['refund', 'Refund', '$147.00', 'done'],
    ]);
    expect(view.today).toBeNull();
    expect(view.fillPercent).toBe(100);
    expect(view.chip).toEqual({ label: 'Cancelled', tone: 'muted' });
  });

  it.each([
    ['không có `cancelledAt` thì lấy ngày quyết', { cancelledAt: null }, '20 Sep 2026'],
    [
      'không có cả ngày quyết thì lấy ngày gửi yêu cầu',
      { cancelledAt: null, cancellationDecidedAt: null },
      '19 Sep 2026',
    ],
    [
      'không còn mốc nào thì bỏ ngày',
      { cancelledAt: null, cancellationDecidedAt: null, cancellationRequestedAt: null },
      null,
    ],
  ] as const)('%s', (_, patch, detail) => {
    const view = journeyMilestones({ ...CANCELLED, ...patch }, TODAY);
    expect(view.milestones.find((milestone) => milestone.key === 'cancelled')?.detail).toBe(
      detail,
    );
  });

  it.each([
    ['hoàn một phần: in cả hai số', '73.50', '$73.50 of $147.00'],
    ['huỷ mà không hoàn đồng nào cũng phải nói ra', '0.00', 'No refund due'],
  ])('%s', (_, refundedTotal, detail) => {
    const view = journeyMilestones({ ...CANCELLED, refundedTotal }, TODAY);
    expect(view.milestones.at(-1)).toEqual({
      key: 'refund',
      label: 'Refund',
      detail,
      state: 'done',
    });
  });

  it('đơn chưa từng thu tiền: không mốc Paid, không mốc Refund', () => {
    const view = journeyMilestones({ ...CANCELLED, paidAt: null, refundedTotal: '0.00' }, TODAY);
    expect(view.milestones.map((milestone) => milestone.key)).toEqual(['booked', 'cancelled']);
  });

  it('REFUNDED còn ngày đi tương lai cũng là biến thể huỷ', () => {
    const view = journeyMilestones({ ...CANCELLED, status: 'REFUNDED' }, TODAY);
    expect(view.variant).toBe('cancelled');
    expect(view.chip).toEqual({ label: 'Cancelled', tone: 'muted' });
  });
});

describe('journeyMilestones — giữ chỗ không trả kịp', () => {
  it('hai mốc Booked → Payment not completed; không chip, không Today', () => {
    const lapsed = makeBooking({
      status: 'PENDING',
      paidAt: null,
      createdAt: '2026-09-20T01:00:00.000Z',
      departureStartDate: '2026-10-01',
      departureEndDate: '2026-10-03',
      cancellation: null,
    });
    const view = journeyMilestones(lapsed, TODAY);
    expect(view.variant).toBe('lapsed');
    expect(rows(view)).toEqual([
      ['booked', 'Booked', '20 Sep 2026', 'done'],
      ['paymentNotCompleted', 'Payment not completed', null, 'done'],
    ]);
    expect(view.chip).toBeNull();
    expect(view.today).toBeNull();
    expect(view.fillPercent).toBe(100);
  });
});
```

- [ ] **Bước 10.** `pnpm --filter @tourism/web test -- src/lib/booking-journey.spec.ts` — ĐỎ vì
  chưa có module `./booking-journey`.

- [ ] **Bước 11. Cài.** Tạo `apps/web/src/lib/booking-journey.ts`:

```ts
import {
  type BookingDetail,
  type BookingPhase,
  bookingPhase,
  calendarDaysBetween,
  tripDayNumbers,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { type RefundSummary, refundSummary } from './booking-vm';
import { formatChipDate, formatDate, formatMoneyExact, formatWeekdayDate } from './tours';

/**
 * Thanh hành trình của trang chi tiết đơn (spec P7 §2.2) — hàm thuần, component chỉ vẽ.
 *
 * Ba biến thể theo giai đoạn (`bookingPhase`, ADR-0054 §1):
 * - `standard` — chờ trả, sắp đi, đang đi, đã đi: Booked → Paid → Free cancellation →
 *   Departure → Trip ends, có nhãn Today ở ba giai đoạn đầu;
 * - `cancelled` — Booked → Paid (nếu đã trả) → Cancelled → Refund (nếu từng thu tiền);
 * - `lapsed` — Booked → Payment not completed.
 *
 * "Hôm nay" là ngày lịch Việt Nam do server tính (`todayDateString`), so bằng chuỗi
 * `YYYY-MM-DD` — không bao giờ giờ máy khách (spec §2.1).
 */
export type JourneyVariant = 'standard' | 'cancelled' | 'lapsed';

export type MilestoneKey =
  | 'booked'
  | 'paid'
  | 'freeCancellation'
  | 'departure'
  | 'tripEnds'
  | 'cancelled'
  | 'refund'
  | 'paymentNotCompleted';

/** `done` đã qua · `now` mốc chưa xong ĐẦU TIÊN · `next` các mốc chưa xong sau nó. */
export type MilestoneState = 'done' | 'now' | 'next';

export interface JourneyMilestone {
  key: MilestoneKey;
  label: string;
  /** Dòng nhỏ dưới nhãn: ngày hoặc số tiền; `null` khi không có gì đáng in. */
  detail: string | null;
  state: MilestoneState;
}

/** Tông chip góc phải — component tra bảng class token theo tông. */
export type JourneyChipTone = 'active' | 'done' | 'warning' | 'muted';

export interface JourneyChip {
  label: string;
  tone: JourneyChipTone;
}

export interface JourneyView {
  variant: JourneyVariant;
  milestones: JourneyMilestone[];
  /**
   * Nhãn Today. `percent` là vị trí trên vạch nối (0 = tâm mốc đầu, 100 = tâm mốc cuối);
   * `before` là chỉ số mốc mà dòng Today chen TRƯỚC ở danh sách dọc của điện thoại.
   * `null` ngoài ba giai đoạn chờ trả, sắp đi, đang đi.
   */
  today: { percent: number; before: number } | null;
  /** Phần vạch đã tô, cùng thang với `today.percent`. */
  fillPercent: number;
  chip: JourneyChip | null;
}

/**
 * Nhãn Today không sát mốc hơn 20% một đoạn: icon mốc rộng 40px, nhãn rộng ~50px — đặt đúng
 * tỷ lệ ở biên là nhãn đè lên icon. Lệch tối đa 20% đoạn, đổi lấy chữ đọc được.
 */
const TODAY_MIN = 0.2;
const TODAY_MAX = 0.8;

/** Mốc trước khi gắn trạng thái; `date` là ngày lịch dùng đặt nhãn Today (`null`: chưa có ngày). */
interface DraftMilestone {
  key: MilestoneKey;
  label: string;
  detail: string | null;
  done: boolean;
  date: string | null;
}

type StandardPhase = Exclude<BookingPhase, 'cancelled' | 'lapsed'>;

/** Phần ngày của một mốc ISO đầy đủ — cùng cách cắt với các dòng "Booked …" có sẵn của repo. */
const isoDay = (iso: string): string => iso.slice(0, 10);

export function journeyMilestones(booking: BookingDetail, today: string): JourneyView {
  const phase = bookingPhase(booking, today);
  if (phase === 'cancelled') return cancelledJourney(booking);
  if (phase === 'lapsed') return lapsedJourney(booking);
  return standardJourney(booking, phase, today);
}

function standardJourney(
  booking: BookingDetail,
  phase: StandardPhase,
  today: string,
): JourneyView {
  const t = messages.bookingDetail.journey;
  const bookedOn = isoDay(booking.createdAt);
  const paidOn = booking.paidAt ? isoDay(booking.paidAt) : null;
  const deadline = booking.cancellation?.deadline ?? booking.cancellationDeadline;
  // Hạn chót hết lúc 23:59 giờ VN của ngày chót: đúng ngày chót vẫn còn hạn. Có cờ server thì
  // in cờ server (ADR-0041 §7); đơn chưa trả không có `cancellation` nên so ngày lịch VN.
  const cancellationOpen = booking.cancellation
    ? booking.cancellation.withinDeadline
    : today <= deadline;
  const departed = booking.departureStartDate <= today;
  // Ngày về khách VẪN đang đi (chip "Day D of D"): chỉ "Trip ended" khi chuyến đã qua.
  const ended = phase === 'travelled';

  const drafts: DraftMilestone[] = [
    {
      key: 'booked',
      label: messages.bookingDetail.booked,
      detail: formatDate(bookedOn),
      done: true,
      date: bookedOn,
    },
    {
      key: 'paid',
      label: t.paid,
      detail: paidOn ? formatDate(paidOn) : t.awaitingPayment,
      done: paidOn !== null,
      date: paidOn,
    },
    {
      key: 'freeCancellation',
      label: messages.checkoutSummary.freeCancellation,
      detail: cancellationOpen ? t.until(formatWeekdayDate(deadline)) : t.ended(formatChipDate(deadline)),
      done: !cancellationOpen,
      date: deadline,
    },
    {
      key: 'departure',
      label: departed ? t.departed : t.departure,
      detail: formatWeekdayDate(booking.departureStartDate),
      done: departed,
      date: booking.departureStartDate,
    },
    {
      key: 'tripEnds',
      label: ended ? t.tripEnded : t.tripEnds,
      detail: formatWeekdayDate(booking.departureEndDate),
      done: ended,
      date: booking.departureEndDate,
    },
  ];

  const mark = phase === 'travelled' ? null : todayMark(drafts, today);
  return {
    variant: 'standard',
    milestones: withStates(drafts),
    today: mark,
    fillPercent: mark ? mark.percent : 100,
    chip: standardChip(booking, phase, today),
  };
}

/** Mốc chưa xong ĐẦU TIÊN là "now", các mốc chưa xong còn lại là "next" (spec §2.2). */
function withStates(drafts: readonly DraftMilestone[]): JourneyMilestone[] {
  const firstOpen = drafts.findIndex((draft) => !draft.done);
  return drafts.map(({ key, label, detail, done }, index) => ({
    key,
    label,
    detail,
    state: done ? 'done' : index === firstOpen ? 'now' : 'next',
  }));
}

/**
 * Today nằm trên vạch giữa mốc xong CUỐI CÙNG và mốc kế tiếp, theo tỷ lệ số ngày (spec §2.2).
 * Mốc kế tiếp chưa có ngày (Paid của đơn chưa trả) thì đứng giữa đoạn.
 */
function todayMark(
  drafts: readonly DraftMilestone[],
  today: string,
): { percent: number; before: number } | null {
  const lastDone = drafts.findLastIndex((draft) => draft.done);
  const from = drafts[lastDone];
  const to = drafts[lastDone + 1];
  if (!from || !to) return null;
  const span = from.date && to.date ? calendarDaysBetween(from.date, to.date) : 0;
  const ratio = span > 0 && from.date ? calendarDaysBetween(from.date, today) / span : 0.5;
  const clamped = Math.min(TODAY_MAX, Math.max(TODAY_MIN, ratio));
  const percent = ((lastDone + clamped) * 100) / (drafts.length - 1);
  // Làm tròn hai chữ số: phép chia số thực cho ra 41.250000000000007.
  return { percent: Math.round(percent * 100) / 100, before: lastDone + 1 };
}

function standardChip(booking: BookingDetail, phase: StandardPhase, today: string): JourneyChip {
  const t = messages.bookingDetail.journey;
  const { daysToGo, dayOfTrip, tripLength } = tripDayNumbers(booking, today);
  switch (phase) {
    case 'awaiting_payment':
      return { label: t.awaitingPayment, tone: 'warning' };
    case 'upcoming':
      return { label: t.departsIn(daysToGo), tone: 'active' };
    case 'on_tour':
      return { label: t.dayOf(dayOfTrip, tripLength), tone: 'active' };
    case 'travelled':
      return { label: t.completed, tone: 'done' };
  }
}

function cancelledJourney(booking: BookingDetail): JourneyView {
  const t = messages.bookingDetail.journey;
  // `cancelledAt` có ở MỌI đường huỷ (khách huỷ, quét giữ chỗ, huỷ chuyến); hai mốc của đơn
  // xin huỷ chỉ có khi khách tự huỷ đơn đã trả. Không còn mốc nào thì bỏ ngày, không bịa.
  const cancelledOn =
    booking.cancelledAt ?? booking.cancellationDecidedAt ?? booking.cancellationRequestedAt;
  const refund = refundSummary(booking);
  const milestones: JourneyMilestone[] = [
    {
      key: 'booked',
      label: messages.bookingDetail.booked,
      detail: formatDate(isoDay(booking.createdAt)),
      state: 'done',
    },
  ];
  if (booking.paidAt) {
    milestones.push({
      key: 'paid',
      label: t.paid,
      detail: formatDate(isoDay(booking.paidAt)),
      state: 'done',
    });
  }
  milestones.push({
    key: 'cancelled',
    label: t.cancelled,
    detail: cancelledOn ? formatDate(isoDay(cancelledOn)) : null,
    state: 'done',
  });
  // Đơn chưa từng thu tiền thì không có chuyện hoàn: `refundSummary` trả null, bỏ mốc Refund.
  if (refund) {
    milestones.push({
      key: 'refund',
      label: t.refund,
      detail: refundDetail(refund, booking.currency),
      state: 'done',
    });
  }
  return {
    variant: 'cancelled',
    milestones,
    today: null,
    fillPercent: 100,
    chip: { label: t.cancelled, tone: 'muted' },
  };
}

/** Dòng phụ của mốc Refund — số tiền thật nên `formatMoneyExact`, như mọi chỗ in tiền hoàn. */
function refundDetail(refund: RefundSummary, currency: string): string {
  const t = messages.bookingDetail.journey;
  if (refund.kind === 'full') return formatMoneyExact(refund.amount, currency);
  if (refund.kind === 'partial') {
    return t.refundPartial(
      formatMoneyExact(refund.amount, currency),
      formatMoneyExact(refund.total, currency),
    );
  }
  return t.refundNone;
}

function lapsedJourney(booking: BookingDetail): JourneyView {
  const t = messages.bookingDetail.journey;
  return {
    variant: 'lapsed',
    milestones: [
      {
        key: 'booked',
        label: messages.bookingDetail.booked,
        detail: formatDate(isoDay(booking.createdAt)),
        state: 'done',
      },
      { key: 'paymentNotCompleted', label: t.paymentNotCompleted, detail: null, state: 'done' },
    ],
    today: null,
    fillPercent: 100,
    chip: null,
  };
}
```

- [ ] **Bước 12.** Chạy lại lệnh Bước 10 — XANH. **Đột biến** (mỗi cái một lần, thấy đỏ, trả lại):
  `today <= deadline` thành `today < deadline` (ca "đúng ngày chót vẫn là Until" phải đỏ); bỏ
  nhánh cờ server, luôn so ngày — ghi lại nếu không giết được (cờ và ngày trùng nhau theo thiết
  kế); `departed` dùng `<` (ca "ngày đi: Departed" đỏ); `ended` thành
  `booking.departureEndDate <= today` (ca "ngày về" đỏ); bỏ `Math.min/Math.max` (ca 45, 80, 95
  đỏ); `: 0.5` thành `: 0` (ca 12.5 đỏ); `findLastIndex` thành `findIndex`; đổi thứ tự
  `cancelledAt ??` ra sau `cancellationDecidedAt` (ca đầu của "đã huỷ" đỏ); mốc Booked đọc
  `paidAt`; luôn đẩy mốc Refund (ca "chưa từng thu tiền" đỏ); trong i18n, `n === 1` của
  `departsIn` thành `n === 0` (ca i18n "tomorrow" đỏ).

- [ ] **Bước 13.** Chạy quy trình gate ở mục Ràng buộc toàn cục, rồi commit (stage tường minh
  `libs/shared/i18n/src/lib/messages.ts`, `libs/shared/i18n/src/lib/messages.spec.ts`,
  `apps/web/src/lib/tours.ts`, `apps/web/src/lib/tours.spec.ts`,
  `apps/web/src/lib/booking-journey.ts`, `apps/web/src/lib/booking-journey.spec.ts`):
  `feat(web): chữ, ngày có thứ và mốc hành trình của trang chi tiết đơn`

### Task 14 — B2 · Các bước "Get ready" và ô tích nhớ trên máy (logic thuần)

**Files:**

- Create: `apps/web/src/lib/get-ready.ts`
- Test: `apps/web/src/lib/get-ready.spec.ts`

**Interfaces:**

- Consumes: `tripDayNumbers` (Phần A); `cancellationDeadlineText` (`lib/booking-vm.ts:70`);
  `formatWeekdayDate` (B1); `TourDetailVM` (`lib/api/tours.ts:19`, chỉ kiểu);
  `messages.bookingDetail.getReady` (B1), `messages.booking.success.departsOn`,
  `messages.checkoutSummary.freeCancellation`, `messages.tourDetail.itinerary.dayLabel`.
- Produces:
  - `type BookingTourData = Pick<TourDetailVM, 'excluded' | 'meetingPoint' | 'itinerary'>` —
    phần dữ liệu tour mà cột phải và khối Details đọc;
  - `tourMeetingPoint(tour: BookingTourData | null): string | null` — điểm hẹn, `null` khi tour
    gỡ hay ô trống;
  - `getReadySteps(booking: BookingDetail, tour: BookingTourData | null, today: string): GetReadyView`
    với `GetReadyView = { countdown: { count: number | null; label: string }; departs: string;
    steps: GetReadyStep[]; footer: string }`;
  - `GetReadyStep = GetReadyStepBody & { number: string }`, `GetReadyStepBody` là union bốn
    khoá `freeCancellation` (`title`, `text`, `open`) · `budget` (`title`, `items`, `note`) ·
    `pickup` (`title`, `text`) · `dayOne` (`title`, `text: string | null`, `href`,
    `linkLabel`);
  - `prepStorageKey(code: string): string` → `prep:<mã>` (cùng nếp `confetti:<mã>` của
    `success-celebration.tsx`);
  - `readPrepChecked(raw: string | null, items: readonly string[]): string[]`.

- [ ] **Bước 1. Test trước.** Tạo `apps/web/src/lib/get-ready.spec.ts`:

```ts
import type { BookingCancellation } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  type BookingTourData,
  getReadySteps,
  prepStorageKey,
  readPrepChecked,
  tourMeetingPoint,
} from './get-ready';

/**
 * Khối "Get ready" của đơn sắp đi (spec P7 §2.4). Chuyến 3 ngày 03–05/11: ngày đi và ngày về
 * khác nhau để bắt chỗ lấy nhầm mốc; hôm nay 05/10 — còn 29 ngày.
 */
const TODAY = '2026-10-05';

function cancellationOf(overrides: Partial<BookingCancellation> = {}): BookingCancellation {
  return {
    deadline: '2026-10-31',
    withinDeadline: true,
    refundAmount: '147.00',
    canCancel: true,
    ...overrides,
  };
}

const BOOKING = makeBooking({
  code: 'BK-B6VCOQNW',
  tourSlug: 'hanoi-heritage-day',
  tourDestinations: [{ slug: 'ha-noi', name: 'Hà Nội', isPrimary: true }],
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
  cancellationDeadline: '2026-10-31',
  cancellation: cancellationOf(),
});

const DAY_ONE = [
  '08:00 — Hotel pickup, drive to Ba Đình Square',
  '08:30 — Hồ Chí Minh Mausoleum exterior',
].join('\n');
const DAY_TWO = { dayNumber: 2, title: 'Ninh Bình by boat', description: '07:00 — Depart' };

/** Ngày 2 đứng TRƯỚC ngày 1 trong mảng: bước "Day 1" phải tìm theo `dayNumber`. */
const TOUR: BookingTourData = {
  excluded: ['Lunch (own arrangement)', 'Tips', 'Personal expenses'],
  meetingPoint: 'Hotel pickup — hotels in Hoàn Kiếm, Ba Đình or Tây Hồ districts, Hà Nội',
  itinerary: [DAY_TWO, { dayNumber: 1, title: 'Ba Đình to the Old Quarter', description: DAY_ONE }],
};

const steps = (tour: BookingTourData | null, booking = BOOKING) =>
  getReadySteps(booking, tour, TODAY).steps.map((step) => `${step.number} ${step.key}`);

describe('getReadySteps — các bước (spec §2.4)', () => {
  it('đủ dữ liệu: bốn bước, đánh số 01–04', () => {
    expect(steps(TOUR)).toEqual(['01 freeCancellation', '02 budget', '03 pickup', '04 dayOne']);
  });

  it('nội dung từng bước', () => {
    const [cancel, budget, pickup, dayOne] = getReadySteps(BOOKING, TOUR, TODAY).steps;
    expect(cancel).toEqual({
      key: 'freeCancellation',
      number: '01',
      title: 'Free cancellation',
      text: 'Free cancellation until 31 Oct, 11:59 pm Vietnam time. No refund after that.',
      open: true,
    });
    expect(budget).toEqual({
      key: 'budget',
      number: '02',
      title: 'Budget for what’s not included',
      items: ['Lunch (own arrangement)', 'Tips', 'Personal expenses'],
      note: 'Tick them off — saved on this device.',
    });
    expect(pickup).toEqual({
      key: 'pickup',
      number: '03',
      title: 'Pickup on Tue 3 Nov',
      text: 'Hotel pickup — hotels in Hoàn Kiếm, Ba Đình or Tây Hồ districts, Hà Nội',
    });
    expect(dayOne).toEqual({
      key: 'dayOne',
      number: '04',
      title: 'Day 1 · Ba Đình to the Old Quarter',
      text: DAY_ONE,
      href: '/tours/hanoi-heritage-day#itinerary',
      linkLabel: 'Full itinerary',
    });
  });

  it('tour đã gỡ (null): chỉ còn bước hạn huỷ', () => {
    expect(steps(null)).toEqual(['01 freeCancellation']);
  });

  it('bỏ bước thiếu dữ liệu thì các bước sau đánh số lại', () => {
    expect(steps({ ...TOUR, excluded: [] })).toEqual([
      '01 freeCancellation',
      '02 pickup',
      '03 dayOne',
    ]);
    expect(steps({ ...TOUR, meetingPoint: '   ' })).toEqual([
      '01 freeCancellation',
      '02 budget',
      '03 dayOne',
    ]);
    expect(steps({ ...TOUR, itinerary: [DAY_TWO] })).toEqual([
      '01 freeCancellation',
      '02 budget',
      '03 pickup',
    ]);
  });

  it('không có cờ huỷ của server thì không bịa câu hạn huỷ', () => {
    expect(steps(TOUR, { ...BOOKING, cancellation: null })).toEqual([
      '01 budget',
      '02 pickup',
      '03 dayOne',
    ]);
  });

  it('mục trống và mục trùng trong danh sách không gồm bị bỏ', () => {
    const view = getReadySteps(
      BOOKING,
      { ...TOUR, excluded: ['Tips', ' ', 'Tips', 'Drinks'] },
      TODAY,
    );
    expect(view.steps.find((step) => step.key === 'budget')).toMatchObject({
      items: ['Tips', 'Drinks'],
    });
  });

  it('đã qua hạn huỷ: câu "đã qua" và bước không còn nổi', () => {
    const view = getReadySteps(
      { ...BOOKING, cancellation: cancellationOf({ withinDeadline: false, refundAmount: '0.00' }) },
      TOUR,
      TODAY,
    );
    expect(view.steps[0]).toMatchObject({
      text: 'The free-cancellation deadline (31 Oct) has passed.',
      open: false,
    });
  });

  it('ngày 1 không có mô tả: vẫn có bước, chỉ không có khối chữ', () => {
    const view = getReadySteps(
      BOOKING,
      { ...TOUR, itinerary: [{ dayNumber: 1, title: 'Arrival', description: null }] },
      TODAY,
    );
    expect(view.steps.at(-1)).toMatchObject({ key: 'dayOne', title: 'Day 1 · Arrival', text: null });
  });
});

describe('getReadySteps — đầu và chân khối', () => {
  it('số ngày cỡ lớn, dòng "Departs" có năm và điểm đến, chân nói ngày VỀ', () => {
    const view = getReadySteps(BOOKING, TOUR, TODAY);
    expect(view.countdown).toEqual({ count: 29, label: 'days to go' });
    expect(view.departs).toBe('Departs Tue 3 Nov 2026 · Hà Nội');
    expect(view.footer).toBe('Your review opens after the trip ends on Thu 5 Nov.');
  });

  it('còn đúng một ngày: "Tomorrow" thay cho con số', () => {
    expect(getReadySteps(BOOKING, TOUR, '2026-11-02').countdown).toEqual({
      count: null,
      label: 'Tomorrow',
    });
  });

  it('tour không gắn điểm đến: dòng "Departs" chỉ có ngày', () => {
    expect(getReadySteps({ ...BOOKING, tourDestinations: [] }, TOUR, TODAY).departs).toBe(
      'Departs Tue 3 Nov 2026',
    );
  });
});

describe('tourMeetingPoint', () => {
  it('in nguyên văn; tour gỡ hay ô trống thì null', () => {
    expect(tourMeetingPoint(TOUR)).toBe(TOUR.meetingPoint);
    expect(tourMeetingPoint(null)).toBeNull();
    expect(tourMeetingPoint({ ...TOUR, meetingPoint: '  ' })).toBeNull();
    expect(tourMeetingPoint({ ...TOUR, meetingPoint: null })).toBeNull();
  });
});

describe('ô tích lưu trên máy', () => {
  const ITEMS = ['Lunch (own arrangement)', 'Tips', 'Personal expenses'];

  it('khoá theo mã đơn', () => {
    expect(prepStorageKey('BK-B6VCOQNW')).toBe('prep:BK-B6VCOQNW');
  });

  it('giữ thứ tự của danh sách, bỏ mục không còn trong danh sách', () => {
    const raw = JSON.stringify(['Personal expenses', 'Gone item', 'Lunch (own arrangement)']);
    expect(readPrepChecked(raw, ITEMS)).toEqual(['Lunch (own arrangement)', 'Personal expenses']);
  });

  it.each([
    ['chưa lưu gì', null],
    ['JSON hỏng', '{oops'],
    ['không phải mảng', JSON.stringify({ Tips: true })],
  ])('%s → chưa tích gì', (_, raw) => {
    expect(readPrepChecked(raw, ITEMS)).toEqual([]);
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/web test -- src/lib/get-ready.spec.ts` — ĐỎ vì chưa có
  module `./get-ready`.

- [ ] **Bước 3. Cài.** Tạo `apps/web/src/lib/get-ready.ts`:

```ts
import { type BookingDetail, tripDayNumbers } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { TourDetailVM } from '@/lib/api/tours';
import { cancellationDeadlineText } from './booking-vm';
import { formatWeekdayDate } from './tours';

/**
 * Khối "Get ready" của đơn sắp đi (spec P7 §2.4) — hàm thuần, component chỉ vẽ.
 *
 * Bốn bước, bước nào thiếu dữ liệu thì bỏ và các bước sau đánh số lại. Dữ liệu tour đến từ
 * `fetchTourDetail` (cache 300 giây); tour đã gỡ thì `tour` là `null` và chỉ còn bước hạn huỷ.
 * Mô tả ngày 1 và điểm hẹn in NGUYÊN VĂN — không tách giờ ra thành dữ liệu (luật catalog).
 */

/** Phần dữ liệu tour mà cột phải và khối Details của trang chi tiết đơn đọc. */
export type BookingTourData = Pick<TourDetailVM, 'excluded' | 'meetingPoint' | 'itinerary'>;

export type GetReadyStepBody =
  | { key: 'freeCancellation'; title: string; text: string; open: boolean }
  | { key: 'budget'; title: string; items: string[]; note: string }
  | { key: 'pickup'; title: string; text: string }
  | { key: 'dayOne'; title: string; text: string | null; href: string; linkLabel: string };

/** Một bước đã đánh số "01", "02"… sau khi bỏ bước thiếu dữ liệu. */
export type GetReadyStep = GetReadyStepBody & { number: string };

export interface GetReadyView {
  /** `count: null` khi còn đúng một ngày — khi đó `label` là "Tomorrow" và đứng cỡ lớn. */
  countdown: { count: number | null; label: string };
  departs: string;
  steps: GetReadyStep[];
  footer: string;
}

/** Điểm hẹn của tour, `null` khi tour đã gỡ hay ô để trống. In nguyên văn, không cắt sửa. */
export function tourMeetingPoint(tour: BookingTourData | null): string | null {
  const point = tour?.meetingPoint ?? null;
  return point !== null && point.trim() !== '' ? point : null;
}

export function getReadySteps(
  booking: BookingDetail,
  tour: BookingTourData | null,
  today: string,
): GetReadyView {
  const t = messages.bookingDetail.getReady;
  const bodies: GetReadyStepBody[] = [];

  // Chỉ in cờ và ngày chót SERVER tính (ADR-0041 §7) — không có cờ thì không có bước này.
  const deadlineText = cancellationDeadlineText(booking.cancellation);
  if (booking.cancellation && deadlineText) {
    bodies.push({
      key: 'freeCancellation',
      title: messages.checkoutSummary.freeCancellation,
      text: deadlineText,
      open: booking.cancellation.withinDeadline,
    });
  }

  // Bỏ mục trống và mục trùng: hai mục cùng chữ là hai ô tích không phân biệt được.
  const excluded = [...new Set((tour?.excluded ?? []).filter((item) => item.trim() !== ''))];
  if (excluded.length > 0) {
    bodies.push({ key: 'budget', title: t.budget, items: excluded, note: t.budgetNote });
  }

  const meetingPoint = tourMeetingPoint(tour);
  if (meetingPoint) {
    bodies.push({
      key: 'pickup',
      title: t.pickupOn(formatWeekdayDate(booking.departureStartDate)),
      text: meetingPoint,
    });
  }

  // Tìm theo `dayNumber`, không lấy phần tử đầu: thứ tự mảng không phải thứ tự ngày.
  const dayOne = tour?.itinerary.find((day) => day.dayNumber === 1);
  if (dayOne) {
    bodies.push({
      key: 'dayOne',
      title: `${messages.tourDetail.itinerary.dayLabel(1)} · ${dayOne.title}`,
      text: dayOne.description && dayOne.description.trim() !== '' ? dayOne.description : null,
      href: `/tours/${booking.tourSlug}#itinerary`,
      linkLabel: t.fullItinerary,
    });
  }

  const { daysToGo } = tripDayNumbers(booking, today);
  const departs = messages.booking.success.departsOn(
    formatWeekdayDate(booking.departureStartDate, { year: true }),
  );
  const place = booking.tourDestinations[0]?.name;

  return {
    countdown:
      daysToGo === 1 ? { count: null, label: t.tomorrow } : { count: daysToGo, label: t.daysToGo },
    departs: place ? `${departs} · ${place}` : departs,
    steps: bodies.map((body, index) => ({ ...body, number: String(index + 1).padStart(2, '0') })),
    footer: t.reviewOpens(formatWeekdayDate(booking.departureEndDate)),
  };
}

/** Khoá `localStorage` của ô tích "Budget for…" — theo mã đơn, chỉ trên máy này (spec §2.4). */
export function prepStorageKey(code: string): string {
  return `prep:${code}`;
}

/**
 * Các mục đã tích còn có trong danh sách HIỆN TẠI, theo thứ tự danh sách. Bản lưu hỏng hay
 * sai hình (sửa tay, bản cũ) thì coi như chưa tích gì — không bao giờ ném ra ngoài.
 */
export function readPrepChecked(raw: string | null, items: readonly string[]): string[] {
  if (raw === null) return [];
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(stored)) return [];
  return items.filter((item) => stored.includes(item));
}
```

- [ ] **Bước 4.** Chạy lại lệnh Bước 2 — XANH. **Đột biến:** số bước lấy chỉ số trước khi lọc
  (đánh số cố định 01–04 theo khoá); `find(day.dayNumber === 1)` thành `itinerary[0]`; bỏ
  `new Set`; bỏ `.trim() !== ''` ở `tourMeetingPoint`; `daysToGo === 1` thành `=== 0`; chân khối
  đọc `departureStartDate`; dòng Departs bỏ `{ year: true }`; `readPrepChecked` trả `stored` thay
  vì lọc theo `items`.

- [ ] **Bước 5.** Chạy quy trình gate ở mục Ràng buộc toàn cục, rồi commit (stage hai file của
  task): `feat(web): các bước Get ready và khoá lưu ô tích của trang chi tiết đơn`

### Task 15 — B3 · Vé kiểu boarding pass, đường xé và hai vết khuyết

Quyết định đã chốt với user: vé của TRANG CHI TIẾT dùng đường gạch đứt cộng hai vết khuyết
nửa tròn — user duyệt lại ngày 05/10, thay ghi chú 19/08 trong JSDoc của `BookingReceipt`
(`booking-receipt.tsx:27-29`) vốn bác kiểu này. Ngoại lệ CHỈ cho trang chi tiết; `BookingReceipt`
không đổi. Vết khuyết che đường viền ngang của vé: tâm hình tròn đặt đúng mép NGOÀI viền, cắt bỏ
nửa ngoài (bản vẽ đã sửa đúng chỗ này, `booking-detail.src.html:106-109`).

**Files:**

- Create: `apps/web/src/components/account/booking-ticket.tsx`
- Test: `apps/web/src/components/account/booking-ticket.spec.tsx`
- Modify: `apps/web/src/app/globals.css` — khối vết khuyết, chèn ngay sau quy tắc
  `html:not(.dark) .stamp-ink { … }` (`globals.css:232-234`), TRƯỚC comment
  `/* ─── … IN ẤN — chỉ phục vụ hoá đơn` (`globals.css:236`)

**Interfaces:**

- Consumes: `ACTIVE_BOOKING_STATUSES`, `calendarDaysBetween` (Phần A); `bookingView`,
  `BookingView`, `paymentProviderLabel` (`lib/booking-vm.ts`; hàm cuối do Task A10 tạo); `ticketBarcodeWidths` (`lib/checkout.ts:122`);
  `calendarDateParts` (B1), `formatDate`, `formatMoney` (`lib/tours.ts`); `VisaStamp`
  (`components/passport/visa-stamp.tsx`); `RevealItem` (`components/motion/reveal-item.tsx`,
  `enter="stamp"`); chữ `messages.bookingDetail.ticket.*`, `bookingDetail.leadTraveller`,
  `bookingDetail.booked` (B1), `passportVisa.kicker`, `passportVisa.labels.travellers`,
  `accountBookingDetail.viewTour`, `accountBookings.travellers`, `booking.success.totalLabel`,
  `checkoutSummary.totalLabel`.
- Produces: `BookingTicket({ booking: BookingDetail; view: BookingView })`; các móc `data-slot`
  `booking-ticket`, `ticket-photo`, `ticket-body`, `ticket-band`, `ticket-stub`, `barcode`
  (dùng ở B8); quy tắc CSS `[data-slot="ticket-stub"]::before/::after`.

- [ ] **Bước 1. Kiểm hàm của Phần A.** `grep -n "export function paymentProviderLabel" apps/web/src/lib/booking-vm.ts`
  phải ra đúng một dòng (Task A10 tạo hàm này và ca test của nó). Không có thì DỪNG và báo.

- [ ] **Bước 2–3.** Bỏ — `paymentProviderLabel` thuộc Phần A (quyết định của plan), giữ số bước
  để các chỗ trỏ "Bước 5", "Bước 6" phía dưới không lệch.

- [ ] **Bước 4. Test vé trước.** Tạo `apps/web/src/components/account/booking-ticket.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { bookingView } from '@/lib/booking-vm';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingTicket } from './booking-ticket';

// jsdom không có IntersectionObserver — mộc vào bằng `RevealItem` (motion `whileInView`).
// Stub cục bộ theo nếp `booking-receipt.spec.tsx`.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const PHOTO: NonNullable<BookingDetail['tourImage']> = {
  publicId: 'tourism/catalog/tour/hanoi-heritage-day/hero',
  url: 'https://res.cloudinary.com/demo/image/upload/v1/tourism/catalog/tour/hanoi-heritage-day/hero',
  type: 'IMAGE',
  role: 'hero',
  posterUrl: null,
  width: 2400,
  height: 1600,
  alt: 'Temple of Literature',
  sortOrder: 0,
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
};

/** Chuyến 3 ngày 03–05/11; ngày đặt (13/08) khác ngày trả (14/08) để bắt ô "Booked" đọc nhầm. */
const PAID = makeBooking({
  code: 'BK-B6VCOQNW',
  status: 'PAID',
  tourTitle: 'Hanoi Heritage in a Day',
  tourSlug: 'hanoi-heritage-day',
  tourDestinations: [{ slug: 'ha-noi', name: 'Hà Nội', isPrimary: true }],
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
  createdAt: '2026-08-13T10:00:00.000Z',
  paidAt: '2026-08-14T03:05:00.000Z',
  numAdults: 2,
  numChildren: 1,
  unitPrice: '49.00',
  totalAmount: '147.00',
  contactName: 'Erik Lund',
  paymentProvider: 'PAYPAL',
});

function renderTicket(booking: BookingDetail = PAID) {
  return render(
    <BookingTicket booking={booking} view={bookingView(booking, booking.cancellation)} />,
  );
}

describe('BookingTicket — thân vé', () => {
  it('tên tour là h2 — hero giữ h1 duy nhất của trang', () => {
    const { container } = renderTicket();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Hanoi Heritage in a Day' }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(0);
  });

  it('dải trên ghi "Entry · Tour booking" và mã; mã in lại dưới cuống', () => {
    renderTicket();
    expect(screen.getByText('Entry · Tour booking')).toBeInTheDocument();
    expect(screen.getAllByText('BK-B6VCOQNW')).toHaveLength(2);
  });

  it('DEPARTS → RETURNS kiểu giờ bay; giữa là độ dài chuyến kèm điểm đến', () => {
    renderTicket();
    expect(screen.getByText('Departs')).toBeInTheDocument();
    expect(screen.getByText('03 NOV')).toBeInTheDocument();
    expect(screen.getByText('Tue · 2026')).toBeInTheDocument();
    expect(screen.getByText('Returns')).toBeInTheDocument();
    expect(screen.getByText('05 NOV')).toBeInTheDocument();
    expect(screen.getByText('Thu · 2026')).toBeInTheDocument();
    expect(screen.getByText('3 days · Hà Nội')).toBeInTheDocument();
  });

  it('chuyến trong ngày: "1 day"', () => {
    renderTicket({ ...PAID, departureEndDate: '2026-11-03' });
    expect(screen.getByText('1 day · Hà Nội')).toBeInTheDocument();
  });

  it('tour không gắn điểm đến: chỉ còn độ dài chuyến', () => {
    renderTicket({ ...PAID, tourDestinations: [] });
    expect(screen.getByText('3 days')).toBeInTheDocument();
  });

  it('bốn ô: người đặt, số khách, ngày ĐẶT (không phải ngày trả), cổng', () => {
    renderTicket();
    for (const label of ['Lead traveller', 'Travellers', 'Booked', 'Paid with']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Erik Lund')).toBeInTheDocument();
    expect(screen.getByText('2 adults, 1 child')).toBeInTheDocument();
    expect(screen.getByText('13 Aug 2026')).toBeInTheDocument();
    expect(screen.getByText('PayPal')).toBeInTheDocument();
  });

  it('link "View tour" về trang tour', () => {
    renderTicket();
    expect(screen.getByRole('link', { name: 'View tour →' })).toHaveAttribute(
      'href',
      '/tours/hanoi-heritage-day',
    );
  });

  it('mộc trạng thái là `VisaStamp` có sẵn', () => {
    renderTicket();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
  });

  it('có ảnh bìa thì có cột ảnh với alt', () => {
    renderTicket({ ...PAID, tourImage: PHOTO });
    expect(screen.getByRole('img', { name: 'Temple of Literature' })).toBeInTheDocument();
  });

  it('không có ảnh bìa thì bỏ cột ảnh', () => {
    const { container } = renderTicket({ ...PAID, tourImage: null });
    expect(container.querySelector('[data-slot="ticket-photo"]')).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
});

describe('BookingTicket — cuống vé', () => {
  it('Admit tổng số khách, "Total paid", số tiền, câu thuế phí', () => {
    renderTicket();
    expect(screen.getByText('Admit 3')).toBeInTheDocument();
    expect(screen.getByText('Total paid')).toBeInTheDocument();
    expect(screen.getByText('$147')).toBeInTheDocument();
    expect(screen.getByText('Taxes and fees included')).toBeInTheDocument();
  });

  it('cuống mang `data-slot="ticket-stub"` — móc của đường xé và hai vết khuyết ở globals.css', () => {
    const { container } = renderTicket();
    expect(container.querySelector('[data-slot="ticket-stub"]')).not.toBeNull();
  });

  it('đơn còn hiệu lực và đã trả: mã vạch 52 vạch tất định theo mã', () => {
    const { container } = renderTicket();
    expect(container.querySelectorAll('[data-slot="barcode"] span')).toHaveLength(52);
  });

  it('PARTIALLY_REFUNDED vẫn là đơn còn hiệu lực: vẫn có mã vạch', () => {
    const { container } = renderTicket({
      ...PAID,
      status: 'PARTIALLY_REFUNDED',
      refundedTotal: '20.00',
    });
    expect(container.querySelector('[data-slot="barcode"]')).not.toBeNull();
  });

  it.each([
    ['chưa trả', { status: 'PENDING', paidAt: null }],
    ['đã trả rồi huỷ', { status: 'CANCELLED', cancelledAt: '2026-09-21T02:00:00.000Z' }],
    ['đã hoàn đủ', { status: 'REFUNDED', refundedTotal: '147.00' }],
  ] as const)('%s: không mã vạch', (_, patch) => {
    const { container } = renderTicket({ ...PAID, ...patch });
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
  });

  it('chưa trả: nhãn "Total" và ô cổng ghi "Not paid"', () => {
    renderTicket({ ...PAID, status: 'PENDING', paidAt: null });
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.queryByText('Total paid')).toBeNull();
    expect(screen.getByText('Not paid')).toBeInTheDocument();
  });
});
```

- [ ] **Bước 5.** `pnpm --filter @tourism/web test -- src/components/account/booking-ticket.spec.tsx`
  — ĐỎ vì chưa có module `./booking-ticket`.

- [ ] **Bước 6. Cài vé.** Tạo `apps/web/src/components/account/booking-ticket.tsx`:

```tsx
import { ACTIVE_BOOKING_STATUSES, type BookingDetail, calendarDaysBetween } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { BusIcon } from 'lucide-react';
import Link from 'next/link';
import { RevealItem } from '@/components/motion/reveal-item';
import { VisaStamp } from '@/components/passport/visa-stamp';
import { type BookingView, paymentProviderLabel } from '@/lib/booking-vm';
import { ticketBarcodeWidths } from '@/lib/checkout';
import { calendarDateParts, formatDate, formatMoney } from '@/lib/tours';

/** Nhãn nhỏ in hoa của vé — `.k` của bản vẽ (10px, đậm, giãn chữ 0.15em). */
const KICKER = 'text-[10px] leading-none font-bold tracking-[0.15em] text-muted-foreground uppercase';

/**
 * Vé kiểu boarding pass đầu trang chi tiết đơn (spec P7 §5.2, bản vẽ `.tk`): ảnh tour · thân
 * vé · cuống vé.
 *
 * Bố cục: dưới `xl` xếp dọc (ảnh 16:9, thân, cuống; đường xé nằm ngang); từ `xl` ba phần
 * ngang `210px | 1fr | 262px`. Mốc `xl` chứ không `md`: nội dung thẳng mép với tiêu đề hero
 * (`xl:px-32`) chỉ còn 1024px ở khổ 1280, bớt ảnh và cuống thì thân vé ~550px — hẹp hơn nữa
 * là hàng DEPARTS → RETURNS gãy dòng.
 *
 * Vé KHÔNG được `overflow: hidden`: hai vết khuyết (CSS ở `globals.css`, móc
 * `data-slot="ticket-stub"`) đè lên viền, nằm ngoài hộp đệm của vé. Vì thế từng mảng màu sát
 * góc (ảnh, hai dải `bg-primary`, lưới ô) tự bo góc 15px = 16px của vé trừ viền 1px.
 *
 * Mã vạch chỉ in cho đơn CÒN HIỆU LỰC (`ACTIVE_BOOKING_STATUSES`) VÀ đã thu tiền: mã vạch nói
 * "quét tôi ở điểm đón", in nó cho đơn chưa trả hay đã huỷ là hứa một thứ không có (cùng bất
 * biến chống nói dối của `BookingReceipt`).
 */
export function BookingTicket({ booking, view }: { booking: BookingDetail; view: BookingView }) {
  const t = messages.bookingDetail;
  const photo = booking.tourImage;
  const paid = booking.paidAt !== null;
  const days = calendarDaysBetween(booking.departureStartDate, booking.departureEndDate) + 1;
  const place = booking.tourDestinations[0]?.name;
  const route = place ? `${t.ticket.days(days)} · ${place}` : t.ticket.days(days);
  const showBarcode = paid && ACTIVE_BOOKING_STATUSES.includes(booking.status);
  const facts = [
    { label: t.leadTraveller, value: booking.contactName },
    {
      label: messages.passportVisa.labels.travellers,
      value: messages.accountBookings.travellers(booking.numAdults, booking.numChildren),
    },
    // `createdAt` là ISO đầy đủ — `formatDate` chỉ nhận ngày lịch nên cắt phần ngày trước.
    { label: t.booked, value: formatDate(booking.createdAt.slice(0, 10)) },
    {
      label: t.ticket.paidWith,
      value: paid ? paymentProviderLabel(booking.paymentProvider) : t.ticket.notPaid,
    },
  ];

  return (
    <article
      data-slot="booking-ticket"
      className={cn(
        'grid rounded-2xl border border-border bg-card',
        photo
          ? 'xl:grid-cols-[210px_minmax(0,1fr)_262px]'
          : 'xl:grid-cols-[minmax(0,1fr)_262px]',
      )}
    >
      {photo ? (
        <div
          data-slot="ticket-photo"
          className="relative aspect-video overflow-hidden rounded-t-[15px] bg-muted xl:aspect-auto xl:rounded-tr-none xl:rounded-bl-[15px]"
        >
          {/* biome-ignore lint/performance/noImgElement: repo không dùng next/image (chưa khai remotePatterns — tiền lệ BookingReceipt). */}
          <img
            src={photo.url}
            alt={photo.alt ?? ''}
            className="absolute inset-0 size-full object-cover"
          />
        </div>
      ) : null}

      <div data-slot="ticket-body" className="flex min-w-0 flex-col">
        <div
          data-slot="ticket-band"
          className={cn(
            'flex h-[38px] items-center justify-between gap-3 bg-primary px-5 font-mono text-[11px] font-semibold tracking-[0.16em] text-primary-foreground uppercase sm:px-7',
            photo ? null : 'rounded-t-[15px] xl:rounded-tr-none',
          )}
        >
          <span className="truncate">{messages.passportVisa.kicker}</span>
          <span className="shrink-0">{booking.code}</span>
        </div>

        <div className="flex flex-1 flex-col px-5 pt-[18px] sm:px-7">
          {/* Điện thoại: mộc lên trên, sát phải; tên tour được trọn bề ngang bên dưới. */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-heading text-[22px] leading-[1.25] font-semibold text-balance">
                {booking.tourTitle}
              </h2>
              <Link
                href={`/tours/${booking.tourSlug}`}
                className="mt-0.5 inline-block text-[12.5px] font-semibold text-primary-emphasis underline-offset-4 hover:underline"
              >
                {messages.accountBookingDetail.viewTour} →
              </Link>
            </div>
            {/* Con dấu "đóng xuống" (nhóm motion 3, 19/08) — giữ nguyên như trang cũ. */}
            <RevealItem enter="stamp" delay={0.15} className="shrink-0 self-end sm:self-auto">
              <VisaStamp status={booking.status} tone={view.tone} />
            </RevealItem>
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4 sm:gap-6">
            <TicketDate label={t.ticket.departs} date={booking.departureStartDate} />
            <div className="relative flex h-[30px] items-center justify-center">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-border"
              />
              <span className="relative flex items-center gap-[7px] bg-card px-2.5 text-center text-[12.5px] font-semibold text-ink">
                <BusIcon aria-hidden="true" className="size-4 shrink-0" />
                {route}
              </span>
            </div>
            <TicketDate label={t.ticket.returns} date={booking.departureEndDate} alignEnd />
          </div>
        </div>

        {/* `gap-px` trên nền `bg-muted` vẽ đường kẻ giữa các ô ở mọi số cột. Không ảnh thì lưới
            nằm ở góc dưới-trái của vé ngang nên phải tự bo góc và cắt phần thừa. */}
        <dl
          className={cn(
            'grid grid-cols-2 gap-px border-t border-muted bg-muted lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4',
            photo ? null : 'overflow-hidden xl:rounded-bl-[15px]',
          )}
        >
          {facts.map((fact) => (
            <div key={fact.label} className="bg-card px-5 py-3.5 sm:px-7">
              <dt className={KICKER}>{fact.label}</dt>
              <dd className="mt-[5px] text-[13.5px] font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Đường xé là viền gạch đứt của cuống: điện thoại nằm ngang (cuống ở dưới), từ `xl`
          nằm dọc (cuống bên phải). Hai vết khuyết là `::before`/`::after` ở globals.css. */}
      <div
        data-slot="ticket-stub"
        className="relative flex flex-col border-t-2 border-dashed border-border xl:border-t-0 xl:border-l-2"
      >
        <div className="flex h-[38px] items-center justify-center bg-primary font-mono text-[11px] font-semibold tracking-[0.16em] text-primary-foreground uppercase xl:rounded-tr-[15px]">
          {t.ticket.admit(booking.numAdults + booking.numChildren)}
        </div>
        <div className="flex flex-1 flex-col px-[26px] py-[18px]">
          <p className={KICKER}>
            {paid ? messages.booking.success.totalLabel : messages.checkoutSummary.totalLabel}
          </p>
          <p className="mt-1.5 font-mono text-[28px] leading-[1.1] font-semibold tabular-nums">
            {formatMoney(booking.totalAmount, booking.currency)}
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t.ticket.taxesIncluded}</p>
          <div className="mt-auto pt-4">
            {showBarcode ? (
              <div data-slot="barcode" aria-hidden="true" className="flex h-11 justify-center">
                {ticketBarcodeWidths(booking.code).map((width, index) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: mảng tất định từ `code`, không đổi thứ tự
                    key={`${booking.code}-${index}`}
                    className={index % 2 === 0 ? 'bg-foreground' : 'bg-transparent'}
                    style={{ width: `${width}px` }}
                  />
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-center font-mono text-xs font-semibold tracking-[0.16em]">
              {booking.code}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Ngày kiểu giờ bay: "03 NOV" chữ mono cỡ lớn, dưới là "Tue · 2026" (bản vẽ `.tk-big`, `.tk-sub`). */
function TicketDate({
  label,
  date,
  alignEnd = false,
}: {
  label: string;
  date: string;
  alignEnd?: boolean;
}) {
  const { weekday, day, month, year } = calendarDateParts(date);
  return (
    <div className={alignEnd ? 'text-right' : undefined}>
      <p className={KICKER}>{label}</p>
      <p className="mt-1.5 font-mono text-[26px] leading-[1.05] font-semibold sm:text-[34px]">
        {`${String(day).padStart(2, '0')} ${month.toUpperCase()}`}
      </p>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{`${weekday} · ${year}`}</p>
    </div>
  );
}
```

- [ ] **Bước 7.** Chạy lại lệnh Bước 5 — XANH.

- [ ] **Bước 8. CSS vết khuyết.** Chèn vào `apps/web/src/app/globals.css` ở vị trí nêu trong
  Files. Chỉ có quy tắc pseudo-element (đường xé đã là class Tailwind ở Bước 6), nên không có
  cặp selector trần/pseudo nào để `noDescendingSpecificity` của Biome bắt:

```css
/* ── Vé của trang chi tiết đơn: hai vết khuyết ở đường xé (spec P7 §5.2) ──
 * Đường xé là viền gạch đứt 2px của cuống (class Tailwind trên `[data-slot="ticket-stub"]`).
 * Mỗi vết khuyết là một hình tròn 22px màu NỀN TRANG, tâm đặt đúng mép NGOÀI viền 1px của vé
 * và cắt bỏ nửa nằm ngoài vé — nên nó che luôn đoạn viền ngang của vé tại chỗ xé (bản vẽ
 * booking-detail.src.html đã sửa đúng chỗ này). Đặt ở -12px thì tâm ở -12 + 11 = -1px: cuống
 * nằm trong viền 1px của vé, mép ngoài viền cách hộp cuống đúng 1px; theo trục của đường xé,
 * -1px là giữa viền gạch đứt 2px.
 *
 * Điện thoại: cuống nằm DƯỚI thân vé — vết khuyết ở mép trái và mép phải của đường xé ngang.
 * Từ 80rem (`xl`, cùng mốc vé chuyển sang ba phần ngang): cuống nằm bên PHẢI — vết khuyết ở
 * mép trên và mép dưới của đường xé dọc.
 *
 * Ngoại lệ có chủ đích với JSDoc của `BookingReceipt` (19/08 bác "dashed + notch bán
 * nguyệt"): user duyệt lại kiểu này cho RIÊNG trang chi tiết đơn ngày 05/10/2026.
 */
[data-slot="ticket-stub"]::before,
[data-slot="ticket-stub"]::after {
  content: "";
  position: absolute;
  z-index: 2;
  top: -12px;
  width: 22px;
  height: 22px;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 9999px;
  background: var(--background);
}

[data-slot="ticket-stub"]::before {
  left: -12px;
  clip-path: inset(0 0 0 50%);
}

[data-slot="ticket-stub"]::after {
  right: -12px;
  clip-path: inset(0 50% 0 0);
}

@media (min-width: 80rem) {
  [data-slot="ticket-stub"]::before {
    clip-path: inset(50% 0 0 0);
  }

  [data-slot="ticket-stub"]::after {
    top: auto;
    right: auto;
    bottom: -12px;
    left: -12px;
    clip-path: inset(0 0 50% 0);
  }
}
```

  jsdom không tính CSS nên khối này không có test đơn vị — Task B8 đo nó bằng CSS build thật
  (vị trí, `clip-path`, màu nền trùng nền trang) ở 1280px và 375px.

- [ ] **Bước 9. Đột biến** (mỗi cái một lần, thấy đỏ, trả lại): bỏ `ACTIVE_BOOKING_STATUSES`
  khỏi điều kiện mã vạch (ca "đã trả rồi huỷ" đỏ); bỏ `paid &&` (ca "chưa trả" đỏ); ô Booked đọc
  `paidAt` (ca bốn ô đỏ); `days` bỏ `+ 1`; Admit chỉ đếm `numAdults`; ô ngày về đọc
  `departureStartDate`; tên tour thành `h1`; `paymentProviderLabel` đảo hai nhánh.

- [ ] **Bước 10.** Chạy quy trình gate ở mục Ràng buộc toàn cục, rồi commit (stage
  `apps/web/src/components/account/booking-ticket.tsx`,
  `apps/web/src/components/account/booking-ticket.spec.tsx`, `apps/web/src/app/globals.css`):
  `feat(web): vé kiểu boarding pass cho trang chi tiết đơn`

### Task 16 — B4 · Thanh hành trình

**Files:**

- Create: `apps/web/src/components/account/trip-journey.tsx`
- Test: `apps/web/src/components/account/trip-journey.spec.tsx`

**Interfaces:**

- Consumes: `JourneyView`, `JourneyMilestone`, `JourneyChip`, `JourneyChipTone`,
  `MilestoneKey`, `MilestoneState` (B1); `messages.bookingDetail.journey.heading`, `today`.
- Produces: `TripJourney({ journey: JourneyView })`; móc `data-slot` `journey-rail`,
  `journey-fill`, `journey-today`, `journey-chip` (`data-tone`), và `li[data-milestone]`
  (`data-state`, `aria-current="step"` cho mốc "now") — dùng ở B8.

- [ ] **Bước 1. Test trước.** Tạo `apps/web/src/components/account/trip-journey.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { JourneyView } from '@/lib/booking-journey';
import { TripJourney } from './trip-journey';

/** Đơn sắp đi của bản vẽ: Today ở 41.25% vạch → `left:43%` khung, vạch tô `width:33%`. */
const UPCOMING: JourneyView = {
  variant: 'standard',
  milestones: [
    { key: 'booked', label: 'Booked', detail: '13 Aug 2026', state: 'done' },
    { key: 'paid', label: 'Paid', detail: '14 Aug 2026', state: 'done' },
    { key: 'freeCancellation', label: 'Free cancellation', detail: 'Until Mon 2 Nov', state: 'now' },
    { key: 'departure', label: 'Departure', detail: 'Tue 3 Nov', state: 'next' },
    { key: 'tripEnds', label: 'Trip ends', detail: 'Tue 3 Nov', state: 'next' },
  ],
  today: { percent: 41.25, before: 2 },
  fillPercent: 41.25,
  chip: { label: 'Departs in 29 days', tone: 'active' },
};

const TRAVELLED: JourneyView = {
  ...UPCOMING,
  milestones: UPCOMING.milestones.map((milestone) => ({ ...milestone, state: 'done' })),
  today: null,
  fillPercent: 100,
  chip: { label: 'Completed', tone: 'done' },
};

const CANCELLED: JourneyView = {
  variant: 'cancelled',
  milestones: [
    { key: 'booked', label: 'Booked', detail: '14 Aug 2026', state: 'done' },
    { key: 'paid', label: 'Paid', detail: '15 Aug 2026', state: 'done' },
    { key: 'cancelled', label: 'Cancelled', detail: '21 Sep 2026', state: 'done' },
    { key: 'refund', label: 'Refund', detail: '$147.00', state: 'done' },
  ],
  today: null,
  fillPercent: 100,
  chip: { label: 'Cancelled', tone: 'muted' },
};

/** Thứ tự các dòng trong danh sách: khoá mốc, hay `journey-today` cho dòng Today. */
const order = (container: HTMLElement) =>
  [...container.querySelectorAll('ol > li')].map(
    (li) => li.getAttribute('data-milestone') ?? li.getAttribute('data-slot'),
  );

describe('TripJourney', () => {
  it('tiêu đề h2 "Trip journey" và chip góc phải', () => {
    render(<TripJourney journey={UPCOMING} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Trip journey' })).toBeInTheDocument();
    expect(screen.getByText('Departs in 29 days')).toHaveAttribute('data-tone', 'active');
  });

  it('năm mốc theo thứ tự, mỗi mốc mang trạng thái; dòng Today chen giữa Paid và Free cancellation', () => {
    const { container } = render(<TripJourney journey={UPCOMING} />);
    expect(order(container)).toEqual([
      'booked',
      'paid',
      'journey-today',
      'freeCancellation',
      'departure',
      'tripEnds',
    ]);
    expect(
      [...container.querySelectorAll('li[data-milestone]')].map((li) =>
        li.getAttribute('data-state'),
      ),
    ).toEqual(['done', 'done', 'now', 'next', 'next']);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Until Mon 2 Nov')).toBeInTheDocument();
  });

  it('mốc đang tới mang `aria-current="step"`', () => {
    const { container } = render(<TripJourney journey={UPCOMING} />);
    expect(container.querySelector('[aria-current="step"]')).toHaveAttribute(
      'data-milestone',
      'freeCancellation',
    );
  });

  it('vị trí khớp bản vẽ: Today ở 43% khung, vạch tô từ 10% rộng 33%', () => {
    const { container } = render(<TripJourney journey={UPCOMING} />);
    const today = container.querySelector<HTMLElement>('[data-slot="journey-today"]');
    const fill = container.querySelector<HTMLElement>('[data-slot="journey-fill"]');
    expect(today?.style.left).toBe('43%');
    expect(fill?.style.left).toBe('10%');
    expect(fill?.style.width).toBe('33%');
  });

  it('chuyến đã đi: không Today, vạch tô trọn (80% khung), chip tông "done"', () => {
    const { container } = render(<TripJourney journey={TRAVELLED} />);
    expect(container.querySelector('[data-slot="journey-today"]')).toBeNull();
    expect(container.querySelector<HTMLElement>('[data-slot="journey-fill"]')?.style.width).toBe(
      '80%',
    );
    expect(screen.getByText('Completed')).toHaveAttribute('data-tone', 'done');
  });

  it('biến thể huỷ bốn mốc: lưới bốn cột, vạch từ 12.5% rộng 75%', () => {
    const { container } = render(<TripJourney journey={CANCELLED} />);
    expect(container.querySelector('ol')).toHaveClass('md:grid-cols-4');
    const fill = container.querySelector<HTMLElement>('[data-slot="journey-fill"]');
    expect(fill?.style.left).toBe('12.5%');
    expect(fill?.style.width).toBe('75%');
  });

  it('không có chip (giữ chỗ lỡ hạn) thì không vẽ chip', () => {
    const { container } = render(
      <TripJourney
        journey={{
          variant: 'lapsed',
          milestones: [
            { key: 'booked', label: 'Booked', detail: '20 Sep 2026', state: 'done' },
            {
              key: 'paymentNotCompleted',
              label: 'Payment not completed',
              detail: null,
              state: 'done',
            },
          ],
          today: null,
          fillPercent: 100,
          chip: null,
        }}
      />,
    );
    expect(container.querySelector('[data-slot="journey-chip"]')).toBeNull();
    expect(container.querySelector('ol')).toHaveClass('md:grid-cols-2');
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/web test -- src/components/account/trip-journey.spec.tsx`
  — ĐỎ vì chưa có module `./trip-journey`.

- [ ] **Bước 3. Cài.** Tạo `apps/web/src/components/account/trip-journey.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import {
  BanknoteIcon,
  CircleAlertIcon,
  CircleXIcon,
  CreditCardIcon,
  FlagIcon,
  type LucideIcon,
  MapPinIcon,
  RotateCcwIcon,
  TicketIcon,
} from 'lucide-react';
import type {
  JourneyChip,
  JourneyChipTone,
  JourneyMilestone,
  JourneyView,
  MilestoneKey,
  MilestoneState,
} from '@/lib/booking-journey';

/**
 * Thanh hành trình (spec P7 §2.2, bản vẽ `.jr`) — chỉ VẼ `JourneyView` của
 * `journeyMilestones`; mọi luật nằm ở đó.
 *
 * MỘT danh sách cho cả hai khổ. Điện thoại: danh sách dọc, dòng Today chen giữa hai mốc đúng
 * chỗ của nó trong DOM (trình đọc màn hình nghe theo cùng thứ tự). Từ `md`: lưới ngang, dòng
 * Today rời khỏi luồng (`absolute`) và đứng trên vạch nối ở `left` tính từ `today.percent`.
 * `left` viết inline vô hại ở điện thoại vì khi ấy phần tử còn `position: static`.
 *
 * Vạch nối chạy từ tâm cột đầu tới tâm cột cuối: mỗi cột rộng `100 / n`%, tâm cột đầu cách mép
 * `50 / n`% — năm mốc là 10%…90%, đúng `.jr-line` của bản vẽ.
 */
const ICON: Record<MilestoneKey, LucideIcon> = {
  booked: TicketIcon,
  paid: CreditCardIcon,
  freeCancellation: RotateCcwIcon,
  departure: MapPinIcon,
  tripEnds: FlagIcon,
  cancelled: CircleXIcon,
  refund: BanknoteIcon,
  paymentNotCompleted: CircleAlertIcon,
};

const ICON_TONE: Record<MilestoneState, string> = {
  done: 'bg-primary text-primary-foreground',
  now: 'bg-card text-primary-emphasis ring-2 ring-primary',
  next: 'bg-muted text-muted-foreground',
};

const CHIP_TONE: Record<JourneyChipTone, string> = {
  active: 'bg-foreground text-background',
  done: 'border border-success/40 bg-success/10 text-success',
  warning: 'border border-warning/60 bg-warning/20 text-warning-foreground',
  muted: 'bg-muted text-muted-foreground',
};

/** Số cột của lưới ngang theo số mốc (2–5) — viết đủ tên class để Tailwind quét thấy. */
const COLUMNS: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
};

/** Làm tròn hai chữ số: phép nhân số thực cho ra `42.99999…%`. */
const round2 = (value: number) => Math.round(value * 100) / 100;

export function TripJourney({ journey }: { journey: JourneyView }) {
  const count = journey.milestones.length;
  const inset = 50 / count;
  const span = 100 - 2 * inset;
  const items = journey.milestones.flatMap((milestone, index) => {
    const mark =
      journey.today && journey.today.before === index
        ? [
            <TodayMark
              key="today"
              left={`${round2(inset + (span * journey.today.percent) / 100)}%`}
            />,
          ]
        : [];
    return [...mark, <MilestoneItem key={milestone.key} milestone={milestone} />];
  });

  return (
    <section
      aria-labelledby="trip-journey-heading"
      className="rounded-2xl border border-border bg-card px-5 pt-[18px] pb-[22px] sm:px-7"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="trip-journey-heading" className="text-[15px] font-semibold">
          {messages.bookingDetail.journey.heading}
        </h2>
        {journey.chip ? <Chip chip={journey.chip} /> : null}
      </div>
      <div data-slot="journey-rail" className="relative mt-4">
        <span
          aria-hidden="true"
          className="absolute top-[19px] hidden h-0.5 bg-muted md:block"
          style={{ left: `${inset}%`, right: `${inset}%` }}
        />
        <span
          aria-hidden="true"
          data-slot="journey-fill"
          className="absolute top-[19px] hidden h-0.5 bg-primary md:block"
          style={{ left: `${inset}%`, width: `${round2((span * journey.fillPercent) / 100)}%` }}
        />
        <ol
          className={cn(
            'relative flex flex-col gap-3 before:absolute before:top-5 before:bottom-5 before:left-5 before:w-0.5 before:-translate-x-1/2 before:bg-muted md:grid md:gap-0 md:before:hidden',
            COLUMNS[count],
          )}
        >
          {items}
        </ol>
      </div>
    </section>
  );
}

function MilestoneItem({ milestone }: { milestone: JourneyMilestone }) {
  const Icon = ICON[milestone.key];
  return (
    <li
      data-milestone={milestone.key}
      data-state={milestone.state}
      aria-current={milestone.state === 'now' ? 'step' : undefined}
      className="relative z-10 flex items-center gap-3 md:flex-col md:gap-0 md:px-2 md:text-center"
    >
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-[11px]',
          ICON_TONE[milestone.state],
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-semibold md:mt-2">{milestone.label}</span>
        {milestone.detail ? (
          <span className="text-xs text-muted-foreground">{milestone.detail}</span>
        ) : null}
      </span>
    </li>
  );
}

/** Nhãn TODAY (bản vẽ `.jr-today`): điện thoại là một dòng, từ `md` nằm đè lên vạch nối. */
function TodayMark({ left }: { left: string }) {
  return (
    <li
      data-slot="journey-today"
      style={{ left }}
      className="flex pl-[52px] md:absolute md:top-2.5 md:z-20 md:block md:-translate-x-1/2 md:pl-0"
    >
      <span className="rounded-full bg-foreground px-2 py-1 font-mono text-[9.5px] leading-none font-bold tracking-[0.12em] whitespace-nowrap text-background uppercase">
        {messages.bookingDetail.journey.today}
      </span>
    </li>
  );
}

function Chip({ chip }: { chip: JourneyChip }) {
  return (
    <span
      data-slot="journey-chip"
      data-tone={chip.tone}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-[11px] py-1.5 text-xs leading-none font-semibold whitespace-nowrap',
        CHIP_TONE[chip.tone],
      )}
    >
      {chip.tone === 'done' ? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
      ) : null}
      {chip.label}
    </span>
  );
}
```

- [ ] **Bước 4.** Chạy lại lệnh Bước 2 — XANH. **Đột biến:** `inset = 50 / count` thành `10`
  (ca bốn cột đỏ); bỏ `round2` ở `left` của Today (ca 43% có thể vẫn xanh vì 80 × 41.25 chia
  100 ra số nguyên — ghi lại nếu không giết được); chèn Today SAU mốc thay vì trước (ca thứ tự
  đỏ); `aria-current` cho mốc `done`; bỏ `COLUMNS[count]`.

- [ ] **Bước 5.** Chạy quy trình gate ở mục Ràng buộc toàn cục, rồi commit (stage hai file):
  `feat(web): thanh hành trình có mốc Today cho trang chi tiết đơn`

### Task 17 — B5a · Khối "Get ready" và ô tích nhớ trên máy

Tách B5 của dàn ban đầu làm hai (B5a, B5b): khối Get ready có phần tử client riêng
(`localStorage`, hydrate) và nhiều ca nhất; bốn khối còn lại là server component mỏng.

**Files:**

- Create: `apps/web/src/components/account/prep-checklist.tsx` (client)
- Test: `apps/web/src/components/account/prep-checklist.spec.tsx`
- Create: `apps/web/src/components/account/get-ready-panel.tsx`
- Test: `apps/web/src/components/account/get-ready-panel.spec.tsx`

**Interfaces:**

- Consumes: `readPrepChecked`, `prepStorageKey`, `GetReadyView`, `GetReadyStep` (B2);
  `Checkbox` (`@tourism/ui/components/checkbox`, chỉ dùng); `messages.bookingDetail.getReady`.
- Produces: `PrepChecklist({ storageKey: string; items: readonly string[] })`;
  `GetReadyPanel({ view: GetReadyView; bookingCode: string })` — `section` có `h2` "Get ready",
  `li[data-step]` (`data-open` ở bước hạn huỷ còn hạn).

- [ ] **Bước 1. Test ô tích trước.** Tạo
  `apps/web/src/components/account/prep-checklist.spec.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrepChecklist } from './prep-checklist';

const KEY = 'prep:BK-B6VCOQNW';
const ITEMS = ['Lunch (own arrangement)', 'Tips', 'Personal expenses'];

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PrepChecklist', () => {
  it('mỗi mục một ô tích có tên; chưa lưu gì thì chưa tích', () => {
    render(<PrepChecklist storageKey={KEY} items={ITEMS} />);
    for (const item of ITEMS) {
      expect(screen.getByRole('checkbox', { name: item })).not.toBeChecked();
    }
  });

  it('đọc lại bản đã lưu của ĐÚNG mã đơn sau khi mount', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(['Tips']));
    window.localStorage.setItem('prep:BK-OTHER', JSON.stringify(['Personal expenses']));
    render(<PrepChecklist storageKey={KEY} items={ITEMS} />);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Tips' })).toBeChecked());
    expect(screen.getByRole('checkbox', { name: 'Personal expenses' })).not.toBeChecked();
  });

  it('tích thì lưu theo thứ tự danh sách, không theo thứ tự bấm', async () => {
    const user = userEvent.setup();
    render(<PrepChecklist storageKey={KEY} items={ITEMS} />);
    await user.click(screen.getByRole('checkbox', { name: 'Personal expenses' }));
    await user.click(screen.getByRole('checkbox', { name: 'Lunch (own arrangement)' }));
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? 'null')).toEqual([
      'Lunch (own arrangement)',
      'Personal expenses',
    ]);
  });

  it('bỏ tích thì gỡ khỏi bản lưu', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(['Tips', 'Personal expenses']));
    const user = userEvent.setup();
    render(<PrepChecklist storageKey={KEY} items={ITEMS} />);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Tips' })).toBeChecked());
    await user.click(screen.getByRole('checkbox', { name: 'Tips' }));
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? 'null')).toEqual(['Personal expenses']);
  });

  it('storage bị chặn: không vỡ, vẫn tích được trên màn hình', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    render(<PrepChecklist storageKey={KEY} items={ITEMS} />);
    await user.click(screen.getByRole('checkbox', { name: 'Tips' }));
    expect(screen.getByRole('checkbox', { name: 'Tips' })).toBeChecked();
    expect(getItem).toHaveBeenCalledWith(KEY);
    expect(setItem).toHaveBeenCalled();
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/web test -- src/components/account/prep-checklist.spec.tsx`
  — ĐỎ vì chưa có module `./prep-checklist`.

- [ ] **Bước 3. Cài.** Tạo `apps/web/src/components/account/prep-checklist.tsx`:

```tsx
'use client';

import { Checkbox } from '@tourism/ui/components/checkbox';
import { useEffect, useId, useState } from 'react';
import { readPrepChecked } from '@/lib/get-ready';

/**
 * Ô tích "Budget for what's not included" (spec P7 §2.4) — nhớ trên ĐÚNG máy này bằng
 * `localStorage`, khoá theo mã đơn (`prepStorageKey`).
 *
 * Đọc sau khi mount chứ không lúc khởi tạo state: server không có `localStorage`, đọc lúc
 * render là HTML của server và của client lệch nhau. Mọi lần chạm storage đều bọc `try`:
 * chế độ riêng tư hay trình duyệt chặn storage thì vẫn tích được trên màn hình, chỉ không nhớ.
 *
 * `<label htmlFor>` trỏ vào `id` của `Checkbox`: Base UI tự nối `aria-labelledby` tới label
 * (cùng khuôn `login-form.tsx`, `tours-filters.tsx`).
 */
export function PrepChecklist({
  storageKey,
  items,
}: {
  storageKey: string;
  items: readonly string[];
}) {
  const baseId = useId();
  const [checked, setChecked] = useState<readonly string[]>([]);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(storageKey);
    } catch {
      raw = null;
    }
    setChecked(readPrepChecked(raw, items));
  }, [storageKey, items]);

  function toggle(item: string, on: boolean) {
    // Giữ thứ tự của danh sách chứ không thứ tự bấm — bản lưu không phụ thuộc cách khách tích.
    const next = items.filter((entry) => (entry === item ? on : checked.includes(entry)));
    setChecked(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage bị chặn: tích vẫn hiện trên màn hình, chỉ không nhớ sau khi tải lại.
    }
  }

  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item, index) => {
        const id = `${baseId}-${index}`;
        return (
          <li key={item}>
            <label
              htmlFor={id}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-[5px] text-[12.5px]"
            >
              <Checkbox
                id={id}
                checked={checked.includes(item)}
                onCheckedChange={(on) => toggle(item, on)}
              />
              {item}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Bước 4.** Chạy lại lệnh Bước 2 — XANH.

- [ ] **Bước 5. Test khối trước.** Tạo `apps/web/src/components/account/get-ready-panel.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { BookingCancellation } from '@tourism/contract';
import { beforeEach, describe, expect, it } from 'vitest';
import { type BookingTourData, getReadySteps } from '@/lib/get-ready';
import { makeBooking } from '@/test/fixtures/booking';
import { GetReadyPanel } from './get-ready-panel';

const TODAY = '2026-10-05';
const CANCELLATION: BookingCancellation = {
  deadline: '2026-10-31',
  withinDeadline: true,
  refundAmount: '147.00',
  canCancel: true,
};

const BOOKING = makeBooking({
  code: 'BK-B6VCOQNW',
  tourSlug: 'hanoi-heritage-day',
  tourDestinations: [{ slug: 'ha-noi', name: 'Hà Nội', isPrimary: true }],
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
  cancellationDeadline: '2026-10-31',
  cancellation: CANCELLATION,
});

const DAY_ONE = ['08:00 — Hotel pickup', '08:30 — Ba Đình Square', '09:15 — One Pillar Pagoda'].join(
  '\n',
);

const TOUR: BookingTourData = {
  excluded: ['Lunch (own arrangement)', 'Tips'],
  meetingPoint: 'Hotel pickup — Hoàn Kiếm, Ba Đình or Tây Hồ',
  itinerary: [{ dayNumber: 1, title: 'Ba Đình to the Old Quarter', description: DAY_ONE }],
};

function renderPanel(today = TODAY) {
  return render(
    <GetReadyPanel view={getReadySteps(BOOKING, TOUR, today)} bookingCode={BOOKING.code} />,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('GetReadyPanel', () => {
  it('đầu khối: h2 "Get ready", số ngày cỡ lớn, dòng Departs', () => {
    renderPanel();
    expect(screen.getByRole('heading', { level: 2, name: 'Get ready' })).toBeInTheDocument();
    expect(screen.getByText('29')).toBeInTheDocument();
    expect(screen.getByText('days to go')).toBeInTheDocument();
    expect(screen.getByText('Departs Tue 3 Nov 2026 · Hà Nội')).toBeInTheDocument();
  });

  it('còn một ngày: "Tomorrow" thay cho con số', () => {
    renderPanel('2026-11-02');
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    expect(screen.queryByText('days to go')).toBeNull();
  });

  it('bốn bước theo thứ tự, số 01–04; bước hạn huỷ còn hạn được làm nổi', () => {
    const { container } = renderPanel();
    const items = [...container.querySelectorAll('li[data-step]')];
    expect(items.map((li) => li.getAttribute('data-step'))).toEqual([
      'freeCancellation',
      'budget',
      'pickup',
      'dayOne',
    ]);
    expect(items.map((li) => li.querySelector('[data-slot="step-number"]')?.textContent)).toEqual([
      '01',
      '02',
      '03',
      '04',
    ]);
    expect(items[0]).toHaveAttribute('data-open');
    expect(
      screen.getByText(
        'Free cancellation until 31 Oct, 11:59 pm Vietnam time. No refund after that.',
      ),
    ).toBeInTheDocument();
  });

  it('bước Budget: một ô tích cho từng mục, kèm câu "saved on this device"', () => {
    renderPanel();
    expect(screen.getByText('Budget for what’s not included')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Lunch (own arrangement)' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Tips' })).toBeInTheDocument();
    expect(screen.getByText('Tick them off — saved on this device.')).toBeInTheDocument();
  });

  it('bước Pickup in nguyên văn điểm hẹn', () => {
    renderPanel();
    expect(screen.getByText('Pickup on Tue 3 Nov')).toBeInTheDocument();
    expect(screen.getByText('Hotel pickup — Hoàn Kiếm, Ba Đình or Tây Hồ')).toBeInTheDocument();
  });

  it('bước Day 1: mô tả in nguyên văn giữ xuống dòng, cắt 4 dòng; link Full itinerary', () => {
    const { container } = renderPanel();
    const text = container.querySelector('[data-step="dayOne"] [data-slot="day-text"]');
    expect(text?.textContent).toBe(DAY_ONE);
    expect(text).toHaveClass('whitespace-pre-line', 'line-clamp-4');
    expect(screen.getByRole('link', { name: 'Full itinerary →' })).toHaveAttribute(
      'href',
      '/tours/hanoi-heritage-day#itinerary',
    );
  });

  it('chân khối nói khi nào mở review', () => {
    renderPanel();
    expect(
      screen.getByText('Your review opens after the trip ends on Thu 5 Nov.'),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Bước 6.** `pnpm --filter @tourism/web test -- src/components/account/get-ready-panel.spec.tsx`
  — ĐỎ vì chưa có module `./get-ready-panel`.

- [ ] **Bước 7. Cài.** Tạo `apps/web/src/components/account/get-ready-panel.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { StarIcon } from 'lucide-react';
import Link from 'next/link';
import { PrepChecklist } from '@/components/account/prep-checklist';
import { type GetReadyStep, type GetReadyView, prepStorageKey } from '@/lib/get-ready';

/**
 * Cột phải của đơn sắp đi (spec P7 §2.4, §2.5, bản vẽ `.gr`): số ngày còn lại cỡ lớn, dòng
 * Departs, các bước đánh số kiểu timeline, chân khối nói khi nào mở review. Mọi luật (bỏ bước
 * thiếu dữ liệu, đánh số lại) ở `getReadySteps`; component chỉ vẽ.
 */
export function GetReadyPanel({ view, bookingCode }: { view: GetReadyView; bookingCode: string }) {
  const t = messages.bookingDetail.getReady;
  return (
    <section
      aria-labelledby="get-ready-heading"
      className="rounded-2xl border border-border bg-card"
    >
      <div className="px-6 pt-5 pb-1.5 sm:px-[26px]">
        <h2
          id="get-ready-heading"
          className="text-[10px] leading-none font-bold tracking-[0.15em] text-muted-foreground uppercase"
        >
          {t.heading}
        </h2>
        <p className="mt-1.5 flex items-baseline gap-2.5">
          {view.countdown.count === null ? (
            <span className="font-heading text-[46px] leading-none font-semibold">
              {view.countdown.label}
            </span>
          ) : (
            <>
              <span className="font-heading text-[46px] leading-none font-semibold tabular-nums">
                {view.countdown.count}
              </span>
              <span className="text-[15px] font-semibold">{view.countdown.label}</span>
            </>
          )}
        </p>
        <p className="text-[13px] text-muted-foreground">{view.departs}</p>
        <ol className="mt-4">
          {view.steps.map((step) => (
            <StepItem key={step.key} step={step} bookingCode={bookingCode} />
          ))}
        </ol>
      </div>
      <p className="flex items-center gap-2 border-t border-muted px-6 py-3 text-[12.5px] text-muted-foreground sm:px-[26px]">
        <StarIcon aria-hidden="true" className="size-4 shrink-0" />
        {view.footer}
      </p>
    </section>
  );
}

function StepItem({ step, bookingCode }: { step: GetReadyStep; bookingCode: string }) {
  // Bước hạn huỷ còn hạn được làm nổi (`.tl-it.on` của bản vẽ) — đó là việc khách còn làm được.
  const open = step.key === 'freeCancellation' && step.open;
  return (
    <li
      data-step={step.key}
      data-open={open ? '' : undefined}
      className="relative grid grid-cols-[42px_minmax(0,1fr)] gap-3.5 pb-4 before:absolute before:top-[42px] before:bottom-0 before:left-5 before:w-[1.5px] before:bg-border last:before:hidden"
    >
      <span
        data-slot="step-number"
        className={cn(
          'grid size-[42px] place-items-center rounded-full border border-border bg-card font-mono text-sm font-semibold',
          open && 'border-primary text-primary-emphasis ring-3 ring-primary/15',
        )}
      >
        {step.number}
      </span>
      <div className="min-w-0">
        <p className="mt-[3px] text-sm font-semibold">{step.title}</p>
        {step.key === 'freeCancellation' || step.key === 'pickup' ? (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{step.text}</p>
        ) : null}
        {step.key === 'budget' ? (
          <>
            <PrepChecklist storageKey={prepStorageKey(bookingCode)} items={step.items} />
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">{step.note}</p>
          </>
        ) : null}
        {step.key === 'dayOne' ? (
          <>
            {step.text ? (
              <p
                data-slot="day-text"
                className="mt-2 line-clamp-4 rounded-lg bg-muted/55 px-[11px] py-2 font-mono text-[11.5px] leading-[1.65] whitespace-pre-line"
              >
                {step.text}
              </p>
            ) : null}
            <Link
              href={step.href}
              className="mt-1.5 inline-block text-[12.5px] font-semibold text-primary-emphasis underline-offset-4 hover:underline"
            >
              {step.linkLabel} →
            </Link>
          </>
        ) : null}
      </div>
    </li>
  );
}
```

- [ ] **Bước 8.** Chạy lại lệnh Bước 6 — XANH. **Đột biến:** `PrepChecklist` đọc storage trong
  `useState(() => …)` thay vì effect (ca "đọc lại" vẫn có thể xanh trong jsdom — ghi lại; lý do
  giữ effect là hydrate, B8 không đo được việc này); `toggle` lưu theo thứ tự bấm (ca thứ tự đỏ);
  bỏ `try` quanh `getItem` (ca storage chặn đỏ); `data-open` gắn cho mọi bước; bỏ
  `line-clamp-4`.

- [ ] **Bước 9.** Chạy quy trình gate ở mục Ràng buộc toàn cục, rồi commit (stage bốn file):
  `feat(web): khối Get ready có ô tích nhớ trên máy`

### Task 18 — B5b · Khối cột phải cho đơn đang đi, đã huỷ hay lỡ hạn, chờ trả; khu review

**Files:**

- Create: `apps/web/src/components/account/on-tour-panel.tsx` (+ `on-tour-panel.spec.tsx`)
- Create: `apps/web/src/components/account/trip-closed-panel.tsx` (+ `trip-closed-panel.spec.tsx`)
- Create: `apps/web/src/components/account/awaiting-payment-panel.tsx` (+
  `awaiting-payment-panel.spec.tsx`)
- Create: `apps/web/src/components/account/review-panel.tsx` (+ `review-panel.spec.tsx`) — dời
  NGUYÊN VĂN `ReviewSlotNote` và `SlotNote` từ `app/(site)/account/bookings/[code]/page.tsx:414-473`
  (trang cũ còn giữ bản của nó tới Task B7 — B7 viết lại trang nên bản cũ tự mất)

**Interfaces:**

- Consumes: `tripDayNumbers` (Phần A); `BookingTourData`, `tourMeetingPoint` (B2);
  `bookingView`, `BookingView`, `legacyCancellationNote`, `refundSummary`, `RefundSummary`
  (`lib/booking-vm.ts`); `reviewSlot`, `ReviewSlot` (`lib/review.ts:40,50`); `BookingActions`
  (`components/account/booking-actions.tsx:272`); `ReviewComposer`, `RetractReviewButton`;
  `ButtonLink` (`@tourism/ui/components/button-link`); chữ `bookingDetail.*` (B1),
  `accountBookingDetail.terminalNote` · `refundLine` · `sections`, `cancellationDeadline.policyLink`,
  `booking.list.browse`, `booking.success.stubNotYetVoucher`, `checkoutSummary.totalLabel`,
  `passportVisa.contactUs`, `tourDetail.itinerary.dayLabel`, `reviews.*`, `nav.contact`.
- Produces:
  - `OnTourPanel({ booking: BookingDetail; tour: BookingTourData | null; today: string })`
  - `TripClosedPanel({ booking: BookingDetail; view: BookingView; kind: 'cancelled' | 'lapsed' })`
  - `AwaitingPaymentPanel({ booking: BookingDetail; view: BookingView })`
  - `ReviewPanel({ booking: BookingDetail })` — `section#review` (đích `#review` của
    `BookingAccordion`, `booking-accordion.tsx:179`)

- [ ] **Bước 1. Test cả bốn khối trước.** Tạo bốn file spec.

  `apps/web/src/components/account/on-tour-panel.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BookingTourData } from '@/lib/get-ready';
import { makeBooking } from '@/test/fixtures/booking';
import { OnTourPanel } from './on-tour-panel';

/** Chuyến 04–06/10, hôm nay 05/10 là ngày 2. Ba ngày lịch trình khác chữ để bắt chọn nhầm ngày. */
const BOOKING = makeBooking({ departureStartDate: '2026-10-04', departureEndDate: '2026-10-06' });
const TOUR: BookingTourData = {
  excluded: [],
  meetingPoint: 'Hội An Ancient Town gate, Trần Phú street',
  itinerary: [
    { dayNumber: 1, title: 'Đà Nẵng arrival', description: '14:00 — Check in' },
    { dayNumber: 2, title: 'Hội An old town', description: '08:00 — Walk\n12:00 — Cao lầu lunch' },
    { dayNumber: 3, title: 'Mỹ Sơn sanctuary', description: '06:00 — Sunrise visit' },
  ],
};

describe('OnTourPanel', () => {
  it('h2 "Today’s plan" và "Day 2 of 3"', () => {
    render(<OnTourPanel booking={BOOKING} tour={TOUR} today="2026-10-05" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Today’s plan' })).toBeInTheDocument();
    expect(screen.getByText('Day 2 of 3')).toBeInTheDocument();
  });

  it('lịch trình ĐÚNG ngày hôm nay, in nguyên văn giữ xuống dòng', () => {
    const { container } = render(<OnTourPanel booking={BOOKING} tour={TOUR} today="2026-10-05" />);
    expect(screen.getByText('Day 2 · Hội An old town')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="day-text"]')?.textContent).toBe(
      '08:00 — Walk\n12:00 — Cao lầu lunch',
    );
    expect(screen.queryByText('Day 1 · Đà Nẵng arrival')).toBeNull();
  });

  it('điểm hẹn và lối "Need help today? Contact us"', () => {
    render(<OnTourPanel booking={BOOKING} tour={TOUR} today="2026-10-05" />);
    expect(screen.getByText('Meeting point')).toBeInTheDocument();
    expect(screen.getByText('Hội An Ancient Town gate, Trần Phú street')).toBeInTheDocument();
    expect(screen.getByText('Need help today?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
  });

  it('tour đã gỡ: vẫn còn ngày thứ mấy và lối liên hệ', () => {
    render(<OnTourPanel booking={BOOKING} tour={null} today="2026-10-06" />);
    expect(screen.getByText('Day 3 of 3')).toBeInTheDocument();
    expect(screen.queryByText('Meeting point')).toBeNull();
    expect(screen.getByRole('link', { name: 'Contact us' })).toBeInTheDocument();
  });
});
```

  `apps/web/src/components/account/trip-closed-panel.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { bookingView } from '@/lib/booking-vm';
import { makeBooking } from '@/test/fixtures/booking';
import { TripClosedPanel } from './trip-closed-panel';

const CANCELLED = makeBooking({
  status: 'CANCELLED',
  paidAt: '2026-08-15T03:05:00.000Z',
  cancelledAt: '2026-09-21T02:00:00.000Z',
  refundedTotal: '147.00',
  totalAmount: '147.00',
});

function renderClosed(booking: BookingDetail, kind: 'cancelled' | 'lapsed' = 'cancelled') {
  return render(
    <TripClosedPanel
      booking={booking}
      view={bookingView(booking, booking.cancellation)}
      kind={kind}
    />,
  );
}

describe('TripClosedPanel — đã huỷ', () => {
  it('h2 "Cancelled", câu kết thúc, chữ hoàn đủ và thời gian về tài khoản, Browse tours', () => {
    renderClosed(CANCELLED);
    expect(screen.getByRole('heading', { level: 2, name: 'Cancelled' })).toBeInTheDocument();
    expect(screen.getByText('This booking was cancelled.')).toBeInTheDocument();
    expect(
      screen.getByText('$147.00 has been refunded to your original payment method.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('It can take 5–10 business days to appear on your statement.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveAttribute('href', '/tours');
  });

  it('hoàn một phần: nói cả hai số', () => {
    renderClosed({ ...CANCELLED, refundedTotal: '73.50' });
    expect(
      screen.getByText('$73.50 of $147.00 has been refunded to your original payment method.'),
    ).toBeInTheDocument();
  });

  it('huỷ mà không hoàn đồng nào: nói ra, kèm link chính sách thay cho câu thời gian', () => {
    renderClosed({ ...CANCELLED, refundedTotal: '0.00' });
    expect(screen.getByText('No refund was due on this booking.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the cancellation policy' })).toHaveAttribute(
      'href',
      '/cancellation-policy',
    );
  });

  it('đơn chưa từng thu tiền: không câu hoàn tiền nào', () => {
    renderClosed({ ...CANCELLED, paidAt: null, refundedTotal: '0.00' });
    expect(screen.queryByText('No refund was due on this booking.')).toBeNull();
    expect(
      screen.queryByText('It can take 5–10 business days to appear on your statement.'),
    ).toBeNull();
  });

  it('REFUNDED: câu kết thúc của trạng thái ấy', () => {
    renderClosed({ ...CANCELLED, status: 'REFUNDED' });
    expect(screen.getByText('This booking was refunded.')).toBeInTheDocument();
  });

  it('yêu cầu huỷ của luồng cũ còn trên dữ liệu: kể lại sự việc', () => {
    renderClosed({
      ...CANCELLED,
      cancellationStatus: 'DENIED',
      cancellationRequestedAt: '2026-09-19T08:00:00.000Z',
    });
    expect(
      screen.getByText('Your cancellation request of 19 Sep 2026 was declined.'),
    ).toBeInTheDocument();
  });
});

describe('TripClosedPanel — giữ chỗ không trả kịp', () => {
  it('h2 "Payment not completed", câu giải thích, Browse tours', () => {
    renderClosed(
      makeBooking({ status: 'PENDING', paidAt: null, departureStartDate: '2026-10-01' }),
      'lapsed',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Payment not completed' }),
    ).toBeInTheDocument();
    expect(screen.getByText('This booking wasn’t paid in time.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveAttribute('href', '/tours');
  });
});
```

  `apps/web/src/components/account/awaiting-payment-panel.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { bookingView } from '@/lib/booking-vm';
import { makeBooking } from '@/test/fixtures/booking';
import { AwaitingPaymentPanel } from './awaiting-payment-panel';

// `BookingActions` dùng router và client oRPC — khoá cả hai, spec chỉ soi phần vẽ.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({
  api: { bookings: { checkout: vi.fn(), cancelPending: vi.fn(), cancel: vi.fn() } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

describe('AwaitingPaymentPanel', () => {
  it('số tiền phải trả và hai nút sẵn có của BookingActions', () => {
    const booking = makeBooking({
      code: 'BK-PENDING1',
      status: 'PENDING',
      paidAt: null,
      totalAmount: '147.00',
      cancellation: null,
    });
    render(<AwaitingPaymentPanel booking={booking} view={bookingView(booking, null)} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Awaiting payment' }),
    ).toBeInTheDocument();
    expect(screen.getByText('$147')).toBeInTheDocument();
    expect(screen.getByText('Total · Taxes and fees included')).toBeInTheDocument();
    expect(
      screen.getByText('This code becomes your voucher once payment is complete.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
  });
});
```

  `apps/web/src/components/account/review-panel.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { type MyReview, REVIEW_REJECTION_LIMIT } from '@tourism/contract';
import { describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { ReviewPanel } from './review-panel';

// Hai linh kiện client của khu review có spec riêng — ở đây chỉ soi chỗ nào hiện cái nào.
vi.mock('@/components/account/review-composer', () => ({
  ReviewComposer: ({ bookingCode, review }: { bookingCode: string; review?: MyReview }) => (
    <div data-testid="review-composer">
      {bookingCode}|{review ? review.id : 'new'}
    </div>
  ),
}));
vi.mock('@/components/account/retract-review-button', () => ({
  RetractReviewButton: ({ reviewId }: { reviewId: string }) => (
    <div data-testid="retract">{reviewId}</div>
  ),
}));

const REVIEW_ID = '11111111-1111-4111-8111-111111111111';

/** Một review của khách — cùng hình với fixture của `review.spec.ts`. */
function ownReview(over: Partial<MyReview> = {}): MyReview {
  return {
    id: REVIEW_ID,
    rating: 5,
    title: null,
    body: 'Chuyến đi rất đáng nhớ và hướng dẫn viên nhiệt tình',
    authorName: 'Erik Lund',
    authorDeleted: false,
    createdAt: '2026-02-12T00:00:00.000Z',
    media: [],
    isApproved: false,
    moderationState: 'pending',
    moderationNote: null,
    rejectionCount: 0,
    tourSlug: 'bana-hills-golden-bridge-day',
    tourTitle: 'Bà Nà Hills & Golden Bridge Day Trip',
    retractedAt: null,
    ...over,
  };
}

/** Chuyến đã xong từ 11/02 — `reviewSlot` mở form theo ngày UTC, nên ngày phải ở quá khứ thật. */
const DONE = makeBooking({
  code: 'BK-6EYNLUEK',
  status: 'PAID',
  departureStartDate: '2026-02-11',
  departureEndDate: '2026-02-11',
});

describe('ReviewPanel — khu review giữ nguyên linh kiện và luật, chỉ đổi chỗ', () => {
  it('chưa viết: tiêu đề, câu dẫn, form mới; section mang id "review"', () => {
    const { container } = render(<ReviewPanel booking={DONE} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Your review' })).toBeInTheDocument();
    expect(screen.getByText('Tell other travellers how it went.')).toBeInTheDocument();
    expect(screen.getByTestId('review-composer')).toHaveTextContent('BK-6EYNLUEK|new');
    expect(container.querySelector('section#review')).not.toBeNull();
  });

  it('đang chờ duyệt: câu trạng thái trước, form sửa sau', () => {
    const review = ownReview();
    render(<ReviewPanel booking={{ ...DONE, review, reviewedAt: review.createdAt }} />);
    expect(screen.getByText('Your review is with our team')).toBeInTheDocument();
    expect(screen.getByTestId('review-composer')).toHaveTextContent(`BK-6EYNLUEK|${REVIEW_ID}`);
  });

  it('bị bác còn lượt: lý do nguyên văn và form', () => {
    const review = ownReview({
      moderationState: 'rejected',
      moderationNote: 'The photos show other guests.',
      rejectionCount: 1,
    });
    render(<ReviewPanel booking={{ ...DONE, review, reviewedAt: review.createdAt }} />);
    expect(screen.getByText('Your review wasn’t published')).toBeInTheDocument();
    expect(screen.getByText('Why')).toBeInTheDocument();
    expect(screen.getByText('The photos show other guests.')).toBeInTheDocument();
    expect(screen.getByTestId('review-composer')).toBeInTheDocument();
  });

  it('hết lượt: không form, mở lối liên hệ', () => {
    const review = ownReview({
      moderationState: 'rejected',
      rejectionCount: REVIEW_REJECTION_LIMIT,
    });
    render(<ReviewPanel booking={{ ...DONE, review, reviewedAt: review.createdAt }} />);
    expect(screen.getByText('We’ve looked at this review twice')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.queryByTestId('review-composer')).toBeNull();
  });

  it('đã đăng: lời cảm ơn và nút rút, không form', () => {
    const review = ownReview({ isApproved: true, moderationState: 'approved' });
    render(<ReviewPanel booking={{ ...DONE, review, reviewedAt: review.createdAt }} />);
    expect(screen.getByText('You’ve already reviewed this trip')).toBeInTheDocument();
    expect(screen.getByTestId('retract')).toHaveTextContent(REVIEW_ID);
    expect(screen.queryByTestId('review-composer')).toBeNull();
  });

  it('đã rút: chỉ nói kết cục', () => {
    const review = ownReview({
      moderationState: 'retracted',
      retractedAt: '2026-02-20T00:00:00.000Z',
    });
    render(<ReviewPanel booking={{ ...DONE, review, reviewedAt: review.createdAt }} />);
    expect(screen.getByText('You retracted this review')).toBeInTheDocument();
    expect(screen.queryByTestId('retract')).toBeNull();
    expect(screen.queryByTestId('review-composer')).toBeNull();
  });

  it('slot ẩn (đơn hoàn một phần đã đi): lời cảm ơn và Browse tours, không khu review', () => {
    render(<ReviewPanel booking={{ ...DONE, status: 'PARTIALLY_REFUNDED' }} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Thanks for travelling with us.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveAttribute('href', '/tours');
    expect(screen.queryByText('Your review')).toBeNull();
  });
});
```

- [ ] **Bước 2.** Chạy bốn spec —
  `pnpm --filter @tourism/web test -- src/components/account/on-tour-panel.spec.tsx src/components/account/trip-closed-panel.spec.tsx src/components/account/awaiting-payment-panel.spec.tsx src/components/account/review-panel.spec.tsx`
  — ĐỎ cả bốn file vì chưa có bốn module.

- [ ] **Bước 3. Cài `on-tour-panel.tsx`:**

```tsx
import { type BookingDetail, tripDayNumbers } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { LifeBuoyIcon, MapPinIcon } from 'lucide-react';
import Link from 'next/link';
import { type BookingTourData, tourMeetingPoint } from '@/lib/get-ready';

/**
 * Cột phải của đơn đang đi (spec P7 §2.3, §2.5): "Day d of D", lịch trình ĐÚNG ngày đó in
 * nguyên văn (không tách giờ — luật catalog), điểm hẹn, lối "Need help today? Contact us".
 * `today` là ngày lịch Việt Nam do server tính — một mốc với chip của thanh hành trình.
 */
export function OnTourPanel({
  booking,
  tour,
  today,
}: {
  booking: BookingDetail;
  tour: BookingTourData | null;
  today: string;
}) {
  const t = messages.bookingDetail;
  const { dayOfTrip, tripLength } = tripDayNumbers(booking, today);
  const day = tour?.itinerary.find((entry) => entry.dayNumber === dayOfTrip) ?? null;
  const meetingPoint = tourMeetingPoint(tour);

  return (
    <section
      aria-labelledby="on-tour-heading"
      className="rounded-2xl border border-border bg-card px-6 py-5 sm:px-[26px]"
    >
      <h2
        id="on-tour-heading"
        className="text-[10px] leading-none font-bold tracking-[0.15em] text-muted-foreground uppercase"
      >
        {t.onTour.heading}
      </h2>
      <p className="mt-1.5 font-heading text-[34px] leading-tight font-semibold">
        {t.journey.dayOf(dayOfTrip, tripLength)}
      </p>
      {day ? (
        <div className="mt-4">
          <p className="text-sm font-semibold">
            {messages.tourDetail.itinerary.dayLabel(day.dayNumber)} · {day.title}
          </p>
          {day.description ? (
            <p
              data-slot="day-text"
              className="mt-2 rounded-lg bg-muted/55 px-[11px] py-2 font-mono text-[11.5px] leading-[1.65] whitespace-pre-line"
            >
              {day.description}
            </p>
          ) : null}
        </div>
      ) : null}
      {meetingPoint ? (
        <div className="mt-4 flex items-start gap-2 text-[13px]">
          <MapPinIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-emphasis" />
          <div>
            <p className="font-semibold">{t.details.meetingPoint}</p>
            <p className="text-muted-foreground">{meetingPoint}</p>
          </div>
        </div>
      ) : null}
      <p className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-muted pt-3 text-[13px] text-muted-foreground">
        <LifeBuoyIcon aria-hidden="true" className="size-4 shrink-0" />
        <span>{t.onTour.needHelp}</span>
        <Link
          href="/contact"
          className="font-semibold text-primary-emphasis underline-offset-4 hover:underline"
        >
          {messages.passportVisa.contactUs}
        </Link>
      </p>
    </section>
  );
}
```

- [ ] **Bước 4. Cài `trip-closed-panel.tsx`:**

```tsx
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  type BookingView,
  legacyCancellationNote,
  type RefundSummary,
  refundSummary,
} from '@/lib/booking-vm';
import { formatMoneyExact } from '@/lib/tours';

/**
 * Cột phải của đơn đã kết thúc mà không đi (spec P7 §2.5): đã huỷ hay đã hoàn đủ
 * (`cancelled` — câu kết thúc của `bookingView`, chữ hoàn tiền của `refundSummary`) và giữ chỗ
 * không trả kịp (`lapsed`). Cả hai mở lối "Browse tours".
 */
export function TripClosedPanel({
  booking,
  view,
  kind,
}: {
  booking: BookingDetail;
  view: BookingView;
  kind: 'cancelled' | 'lapsed';
}) {
  const t = messages.bookingDetail;
  if (kind === 'lapsed') {
    return (
      <ClosedFrame title={t.journey.paymentNotCompleted}>
        <p className="mt-2 text-[15px] font-semibold">{t.closed.notPaidInTime}</p>
      </ClosedFrame>
    );
  }
  const terminalNote = messages.accountBookingDetail.terminalNote[view.statusKey];
  const legacyNote = legacyCancellationNote(booking);
  const refund = refundSummary(booking);
  return (
    <ClosedFrame title={t.journey.cancelled}>
      {terminalNote ? <p className="mt-2 text-[15px] font-semibold">{terminalNote}</p> : null}
      {legacyNote ? <p className="mt-1 text-sm text-muted-foreground">{legacyNote}</p> : null}
      {refund ? <RefundText refund={refund} currency={booking.currency} /> : null}
    </ClosedFrame>
  );
}

function ClosedFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby="trip-closed-heading"
      className="rounded-2xl border border-border bg-card px-6 py-5 sm:px-[26px]"
    >
      <h2
        id="trip-closed-heading"
        className="text-[10px] leading-none font-bold tracking-[0.15em] text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {children}
      <ButtonLink href="/tours" variant="outline" className="mt-4">
        {messages.booking.list.browse}
      </ButtonLink>
    </section>
  );
}

/**
 * Chữ hoàn tiền — dời từ `RefundLine` của trang cũ, giữ nguyên luật: `formatMoneyExact` vì đây
 * là số tiền THẬT khách đối chiếu với sao kê; không hoàn đồng nào thì câu tiếp theo là chỗ tra
 * lý do (link chính sách), không phải lời hứa về thời gian chờ.
 */
function RefundText({ refund, currency }: { refund: RefundSummary; currency: string }) {
  const t = messages.accountBookingDetail.refundLine;
  const sentence =
    refund.kind === 'full'
      ? t.full(formatMoneyExact(refund.amount, currency))
      : refund.kind === 'partial'
        ? t.partial(
            formatMoneyExact(refund.amount, currency),
            formatMoneyExact(refund.total, currency),
          )
        : t.none;
  return (
    <div className="mt-3 text-[13.5px]">
      <p>{sentence}</p>
      <p className="mt-0.5 text-muted-foreground">
        {refund.kind === 'none' ? (
          <Link href="/cancellation-policy" className="underline-offset-4 hover:underline">
            {messages.cancellationDeadline.policyLink}
          </Link>
        ) : (
          t.timing
        )}
      </p>
    </div>
  );
}
```

- [ ] **Bước 5. Cài `awaiting-payment-panel.tsx`:**

```tsx
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { BookingActions } from '@/components/account/booking-actions';
import type { BookingView } from '@/lib/booking-vm';
import { formatMoney } from '@/lib/tours';

/**
 * Cột phải của đơn chờ trả (spec P7 §2.5): số tiền phải trả và các nút SẴN CÓ của
 * `BookingActions` (Pay now, huỷ giữ chỗ — hộp xác nhận, lỗi, toast giữ nguyên). Hàng nút đáy
 * của cột trái không lặp nút trả tiền (spec §5.3).
 */
export function AwaitingPaymentPanel({
  booking,
  view,
}: {
  booking: BookingDetail;
  view: BookingView;
}) {
  const t = messages.bookingDetail;
  return (
    <section
      aria-labelledby="awaiting-payment-heading"
      className="rounded-2xl border border-border bg-card px-6 py-5 sm:px-[26px]"
    >
      <h2
        id="awaiting-payment-heading"
        className="text-[10px] leading-none font-bold tracking-[0.15em] text-muted-foreground uppercase"
      >
        {t.journey.awaitingPayment}
      </h2>
      <p className="mt-1.5 font-mono text-[28px] leading-[1.1] font-semibold tabular-nums">
        {formatMoney(booking.totalAmount, booking.currency)}
      </p>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        {`${messages.checkoutSummary.totalLabel} · ${t.ticket.taxesIncluded}`}
      </p>
      <p className="mt-3 text-sm">{messages.booking.success.stubNotYetVoucher}</p>
      <div className="mt-4">
        <BookingActions view={view} code={booking.code} />
      </div>
    </section>
  );
}
```

- [ ] **Bước 6. Cài `review-panel.tsx`.** Hai hàm `ReviewSlotNote` và `SlotNote` dưới đây là bản
  chép NGUYÊN VĂN của `page.tsx:414-473` (kể cả JSDoc) — không sửa chữ, không sửa luật:

```tsx
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import Link from 'next/link';
import { RetractReviewButton } from '@/components/account/retract-review-button';
import { ReviewComposer } from '@/components/account/review-composer';
import { type ReviewSlot, reviewSlot } from '@/lib/review';

/**
 * Cột phải của chuyến đã đi (spec P7 §2.5): khu review cũ của trang chi tiết — CHỈ đổi chỗ,
 * giữ nguyên linh kiện, chữ và luật `reviewSlot` (spec §5.4). `id="review"` là đích của link
 * "Review →" ở `BookingAccordion`.
 *
 * Slot `hidden` (đơn đã đi nhưng không viết review được, vd hoàn một phần) thay bằng lời cảm
 * ơn và "Browse tours" — một cột trống là một trang trông như hỏng.
 */
export function ReviewPanel({ booking }: { booking: BookingDetail }) {
  const slot = reviewSlot(booking);
  if (slot === 'hidden') {
    return (
      <section
        aria-labelledby="review-heading"
        className="rounded-2xl border border-border bg-card px-6 py-5"
      >
        <h2 id="review-heading" className="font-heading text-[19px] leading-tight font-semibold">
          {messages.bookingDetail.closed.thanks}
        </h2>
        <ButtonLink href="/tours" variant="outline" className="mt-4">
          {messages.booking.list.browse}
        </ButtonLink>
      </section>
    );
  }

  const sec = messages.accountBookingDetail.sections;
  return (
    <section
      id="review"
      aria-labelledby="review-heading"
      className="rounded-2xl border border-border bg-card px-6 py-5"
    >
      <h2 id="review-heading" className="font-heading text-[19px] leading-tight font-semibold">
        {sec.reviewHeading}
      </h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{sec.reviewBlurb}</p>
      <div className="mt-3">
        {/* Trạng thái NÓI TRƯỚC, form đứng sau (ADR-0032 §7). */}
        <ReviewSlotNote slot={slot} reason={booking.review?.moderationNote ?? null} />
        {/* W4 U2 (ADR-0032 AMEND 1): review ĐANG đăng có đường rút. */}
        {slot === 'approved' && booking.review ? (
          <div className="mt-2">
            <RetractReviewButton reviewId={booking.review.id} />
          </div>
        ) : null}
        {slot === 'form' || slot === 'pending' || slot === 'rejected' ? (
          <ReviewComposer bookingCode={booking.code} review={booking.review ?? undefined} />
        ) : null}
      </div>
    </section>
  );
}

/**
 * Câu nói trạng thái của chỗ đánh giá — mỗi slot một câu, không ternary lồng
 * nhau trong JSX.
 *
 * `rejected` và `rejectedFinal` cùng in LÝ DO nhưng khác hẳn câu sau đó: một
 * bên mời viết lại, một bên nói thẳng đã hết đường và mở lối liên hệ. Gộp
 * chúng là để khách bấm vào một form không còn ở đó.
 */
function ReviewSlotNote({ slot, reason }: { slot: ReviewSlot; reason: string | null }) {
  const rv = messages.reviews;
  if (slot === 'form') return null;

  if (slot === 'approved') {
    return <SlotNote title={rv.alreadyReviewedTitle} body={rv.alreadyReviewedBody} />;
  }
  if (slot === 'retracted') {
    // W4 U2: kết cục đóng — nói rõ, không mời làm gì thêm.
    return <SlotNote title={rv.retractedTitle} body={rv.retractedBody} />;
  }
  if (slot === 'tooEarly') {
    return <SlotNote title={rv.tooEarlyTitle} body={rv.tooEarlyBody} />;
  }
  if (slot === 'pending') {
    return <SlotNote title={rv.pendingTitle} body={rv.pendingBody} />;
  }

  const final = slot === 'rejectedFinal';
  return (
    <div className="mb-4 flex flex-col gap-2">
      <SlotNote
        title={final ? rv.rejectedFinalTitle : rv.rejectedTitle}
        body={final ? rv.rejectedFinalBody : rv.rejectedBody}
      />
      {/* Nguyên văn lý do người duyệt viết — ĐÚNG câu khách đã nhận qua mail,
          nên hai nguồn không thể nói khác nhau. */}
      {reason ? (
        <figure className="rounded-md border border-border/60 bg-muted/40 p-3">
          <figcaption className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {rv.rejectedReason}
          </figcaption>
          <blockquote className="mt-1 text-sm whitespace-pre-wrap">{reason}</blockquote>
        </figure>
      ) : null}
      {final ? (
        <Link href="/contact" className="w-fit text-sm underline-offset-4 hover:underline">
          {messages.nav.contact}
        </Link>
      ) : null}
    </div>
  );
}

function SlotNote({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
```

- [ ] **Bước 7.** Chạy lại lệnh Bước 2 — XANH cả bốn file. **Đột biến:** `OnTourPanel` lấy
  `itinerary[0]` (ca "ĐÚNG ngày hôm nay" đỏ); `TripClosedPanel` bỏ nhánh `refund.kind === 'none'`
  của link (ca "không hoàn" đỏ); bỏ kiểm `refund` (ca "chưa từng thu tiền" — `refundSummary` trả
  null nên phải sửa thành luôn vẽ `t.none` mới thấy đỏ); `ReviewPanel` đưa `rejectedFinal` vào
  danh sách hiện form (ca "hết lượt" đỏ); bỏ nhánh `hidden` (ca slot ẩn đỏ).

- [ ] **Bước 8.** Chạy quy trình gate ở mục Ràng buộc toàn cục, rồi commit (stage tám file):
  `feat(web): khối cột phải cho đơn đang đi, đã huỷ, chờ trả và khu review`

### Task 19 — B6 · Cột trái: thông tin đơn và hàng nút đáy

**Files:**

- Create: `apps/web/src/components/account/booking-details-panel.tsx`
- Test: `apps/web/src/components/account/booking-details-panel.spec.tsx`

**Interfaces:**

- Consumes: `BookingPhase` (Phần A); `bookingPriceLines` (Phần A, `lib/checkout.ts`, trả
  `{ label, amount }[]`); `BookingView`, `cancellationDeadlineText`, `legacyCancellationNote`,
  `paymentProviderLabel` (B3) từ `lib/booking-vm.ts`; `BookingActions`, `CancelDialogBooking`
  (`booking-actions.tsx:100,272`); `ButtonLink`; `formatDate`, `formatMoney`,
  `formatMoneyExact`; chữ `bookingDetail.leadTraveller` · `booked` · `details.*` (B1),
  `booking.success.paymentLabel` · `totalLabel`, `checkoutSummary.totalLabel`,
  `tourDetail.booking.testMode`, `passportVisa.contactUs` · `viewVoucher`.
- Produces: `BookingDetailsPanel({ booking: BookingDetail; view: BookingView; phase: BookingPhase;
  meetingPoint: string | null })`, gốc mang `data-slot="booking-details"` (B8 đo).

- [ ] **Bước 1. Test trước.** Tạo `apps/web/src/components/account/booking-details-panel.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { BookingCancellation, BookingDetail, BookingPhase } from '@tourism/contract';
import { describe, expect, it, vi } from 'vitest';
import { bookingView } from '@/lib/booking-vm';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingDetailsPanel } from './booking-details-panel';

// `BookingActions` (nút huỷ ở hàng đáy) dùng router và client oRPC.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({
  api: { bookings: { checkout: vi.fn(), cancelPending: vi.fn(), cancel: vi.fn() } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const CANCELLATION: BookingCancellation = {
  deadline: '2026-11-02',
  withinDeadline: true,
  refundAmount: '147.00',
  canCancel: true,
};

/** Ngày đặt 13/08 khác ngày trả 14/08 — bắt chỗ đọc nhầm mốc. */
const PAID = makeBooking({
  code: 'BK-B6VCOQNW',
  contactName: 'Erik Lund',
  contactEmail: 'erik.lund@example.com',
  contactPhone: '+84 90 123 4567',
  numAdults: 2,
  numChildren: 1,
  unitPrice: '49.00',
  totalAmount: '147.00',
  paymentProvider: 'PAYPAL',
  createdAt: '2026-08-13T10:00:00.000Z',
  paidAt: '2026-08-14T03:05:00.000Z',
  specialRequests: null,
  cancellation: CANCELLATION,
});

function renderPanel(
  booking: BookingDetail = PAID,
  phase: BookingPhase = 'upcoming',
  meetingPoint: string | null = 'Hotel pickup — Hoàn Kiếm, Ba Đình or Tây Hồ',
) {
  return render(
    <BookingDetailsPanel
      booking={booking}
      view={bookingView(booking, booking.cancellation)}
      phase={phase}
      meetingPoint={meetingPoint}
    />,
  );
}

describe('BookingDetailsPanel — bốn khối (spec §5.3)', () => {
  it('Lead traveller: chữ cái đầu của họ và tên, email, điện thoại', () => {
    renderPanel();
    expect(screen.getByRole('heading', { level: 2, name: 'Lead traveller' })).toBeInTheDocument();
    expect(screen.getByText('EL')).toBeInTheDocument();
    expect(screen.getByText('Erik Lund')).toBeInTheDocument();
    expect(screen.getByText('erik.lund@example.com')).toBeInTheDocument();
    expect(screen.getByText('+84 90 123 4567')).toBeInTheDocument();
  });

  it('chữ cái đầu lấy từ ĐẦU và CUỐI tên; tên một chữ thì một chữ cái', () => {
    renderPanel({ ...PAID, contactName: 'Nguyễn Văn An' });
    expect(screen.getByText('NA')).toBeInTheDocument();
  });

  it('tên một chữ: một chữ cái', () => {
    renderPanel({ ...PAID, contactName: 'Madonna' });
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('Payment: dòng người lớn, trẻ em, "Total paid", ngày trả và chế độ thử', () => {
    renderPanel();
    expect(screen.getByRole('heading', { level: 2, name: 'Payment' })).toBeInTheDocument();
    expect(screen.getByText('2 adults')).toBeInTheDocument();
    expect(screen.getByText('$98')).toBeInTheDocument();
    expect(screen.getByText('1 child')).toBeInTheDocument();
    expect(screen.getByText('$49')).toBeInTheDocument();
    expect(screen.getByText('Total paid')).toBeInTheDocument();
    expect(screen.getByText('$147')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Paid in full by PayPal on 14 Aug 2026 · Test mode — no card is charged.',
      ),
    ).toBeInTheDocument();
  });

  it('có hoàn: thêm dòng "Refunded −…" với số tiền đủ hai số lẻ', () => {
    renderPanel({ ...PAID, status: 'PARTIALLY_REFUNDED', refundedTotal: '73.50' });
    expect(screen.getByText('Refunded')).toBeInTheDocument();
    expect(screen.getByText('−$73.50')).toBeInTheDocument();
  });

  it('chưa trả: nhãn "Total", không có dòng "Paid in full"', () => {
    renderPanel({ ...PAID, status: 'PENDING', paidAt: null, cancellation: null }, 'awaiting_payment');
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.queryByText('Total paid')).toBeNull();
    expect(screen.queryByText(/^Paid in full/)).toBeNull();
  });

  it('Cancellation: câu hạn huỷ của server', () => {
    renderPanel();
    expect(screen.getByRole('heading', { level: 2, name: 'Cancellation' })).toBeInTheDocument();
    expect(
      screen.getByText('Free cancellation until 2 Nov, 11:59 pm Vietnam time. No refund after that.'),
    ).toBeInTheDocument();
  });

  it('đơn đã huỷ: bỏ khối Cancellation (cột phải đã nói)', () => {
    renderPanel(
      { ...PAID, status: 'CANCELLED', cancellation: null, refundedTotal: '147.00' },
      'cancelled',
    );
    expect(screen.queryByRole('heading', { name: 'Cancellation' })).toBeNull();
  });

  it('Details: điểm hẹn, "None" khi không có yêu cầu, ngày ĐẶT', () => {
    renderPanel();
    expect(screen.getByRole('heading', { level: 2, name: 'Details' })).toBeInTheDocument();
    expect(screen.getByText('Meeting point')).toBeInTheDocument();
    expect(screen.getByText('Hotel pickup — Hoàn Kiếm, Ba Đình or Tây Hồ')).toBeInTheDocument();
    expect(screen.getByText('Special requests')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('Booked')).toBeInTheDocument();
    expect(screen.getByText('13 Aug 2026')).toBeInTheDocument();
  });

  it('Details: có yêu cầu thì in nguyên văn; không có dữ liệu tour thì bỏ dòng điểm hẹn', () => {
    renderPanel({ ...PAID, specialRequests: 'Vegetarian meals' }, 'upcoming', null);
    expect(screen.getByText('Vegetarian meals')).toBeInTheDocument();
    expect(screen.queryByText('None')).toBeNull();
    expect(screen.queryByText('Meeting point')).toBeNull();
  });
});

describe('BookingDetailsPanel — hàng nút đáy', () => {
  it('sắp đi, còn huỷ được: Cancel booking bên trái; Contact us và View voucher bên phải', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'View voucher' })).toHaveAttribute(
      'href',
      '/checkout/success?code=BK-B6VCOQNW',
    );
    expect(screen.queryByText('Questions about this trip?')).toBeNull();
  });

  it('đã đi: câu hỏi thay chỗ nút huỷ, vẫn có View voucher', () => {
    renderPanel({ ...PAID, cancellation: { ...CANCELLATION, canCancel: false } }, 'travelled');
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
    expect(screen.getByText('Questions about this trip?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View voucher' })).toBeInTheDocument();
  });

  it('chờ trả: không nút huỷ, không View voucher — nút trả tiền ở cột phải', () => {
    renderPanel({ ...PAID, status: 'PENDING', paidAt: null, cancellation: null }, 'awaiting_payment');
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay now' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'View voucher' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Contact us' })).toBeInTheDocument();
  });

  it('đã huỷ: không View voucher', () => {
    renderPanel(
      { ...PAID, status: 'CANCELLED', cancellation: null, refundedTotal: '147.00' },
      'cancelled',
    );
    expect(screen.queryByRole('link', { name: 'View voucher' })).toBeNull();
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/web test -- src/components/account/booking-details-panel.spec.tsx`
  — ĐỎ vì chưa có module `./booking-details-panel`.

- [ ] **Bước 3. Cài.** Tạo `apps/web/src/components/account/booking-details-panel.tsx`:

```tsx
import type { BookingDetail, BookingPhase } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { cn } from '@tourism/ui/lib/utils';
import { CalendarClockIcon, MessageSquareIcon, TicketIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { BookingActions, type CancelDialogBooking } from '@/components/account/booking-actions';
import {
  type BookingView,
  cancellationDeadlineText,
  legacyCancellationNote,
  paymentProviderLabel,
} from '@/lib/booking-vm';
import { bookingPriceLines } from '@/lib/checkout';
import { formatDate, formatMoney, formatMoneyExact } from '@/lib/tours';

/** Giai đoạn có voucher để xem: đơn đã trả và còn hiệu lực (spec §5.3). */
const VOUCHER_PHASES: ReadonlySet<BookingPhase> = new Set(['upcoming', 'on_tour', 'travelled']);

/**
 * Cột trái trang chi tiết đơn (spec P7 §5.3, bản vẽ `.pn`): bốn khối Lead traveller · Payment ·
 * Cancellation · Details, rồi hàng nút đáy.
 *
 * Hàng đáy: trái là "Cancel booking" khi `bookingView` cho phép — mở ĐÚNG hộp huỷ sẵn có của
 * `BookingActions`, hộp in và gửi kèm số tiền server tính (`bookings.byCode.cancellation`);
 * không huỷ được thì câu "Questions about this trip?". Phải là "Contact us" và, ở ba giai đoạn
 * đã trả còn hiệu lực, "View voucher". Đơn chờ trả không lặp nút trả tiền ở đây — nó ở cột phải.
 *
 * Khối Cancellation giữ icon lịch và tông cảnh báo khi đã qua hạn: hạn chót là thông tin TIỀN,
 * bản dòng xám cỡ nhỏ từng bị khách bỏ qua (góp ý user 17/09).
 */
export function BookingDetailsPanel({
  booking,
  view,
  phase,
  meetingPoint,
}: {
  booking: BookingDetail;
  view: BookingView;
  phase: BookingPhase;
  meetingPoint: string | null;
}) {
  const t = messages.bookingDetail;
  const paid = booking.paidAt !== null;
  const refunded = Number(booking.refundedTotal) > 0;
  const deadlineText = cancellationDeadlineText(booking.cancellation);
  const legacyNote = legacyCancellationNote(booking);
  const showCancellation = phase !== 'cancelled' && (deadlineText !== null || legacyNote !== null);
  const canCancel = view.actions.includes('cancelBooking');

  return (
    <div data-slot="booking-details" className="rounded-2xl border border-border bg-card">
      <Block title={t.leadTraveller}>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-muted font-bold text-ink"
          >
            {initials(booking.contactName)}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{booking.contactName}</p>
            <p className="truncate text-[12.5px] text-muted-foreground">{booking.contactEmail}</p>
            {booking.contactPhone ? (
              <p className="text-[12.5px] text-muted-foreground">{booking.contactPhone}</p>
            ) : null}
          </div>
        </div>
      </Block>

      <Block title={messages.booking.success.paymentLabel}>
        <dl>
          {bookingPriceLines(booking).map((line) => (
            <Row key={line.label} label={line.label} value={line.amount} mono />
          ))}
          <Row
            total
            mono
            label={paid ? messages.booking.success.totalLabel : messages.checkoutSummary.totalLabel}
            value={formatMoney(booking.totalAmount, booking.currency)}
          />
          {refunded ? (
            <Row
              mono
              label={t.details.refunded}
              // Số tiền THẬT đã hoàn — đủ hai số lẻ, như mọi chỗ in tiền hoàn của repo.
              value={t.details.refundedAmount(
                formatMoneyExact(booking.refundedTotal, booking.currency),
              )}
            />
          ) : null}
        </dl>
        {booking.paidAt ? (
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {t.details.paidInFull(
              paymentProviderLabel(booking.paymentProvider),
              formatDate(booking.paidAt.slice(0, 10)),
            )}
            {' · '}
            {messages.tourDetail.booking.testMode}
          </p>
        ) : null}
      </Block>

      {showCancellation ? (
        <Block title={t.details.cancellation}>
          {deadlineText ? (
            <p className="flex items-start gap-2 text-[13.5px]">
              <CalendarClockIcon
                aria-hidden="true"
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  booking.cancellation?.withinDeadline
                    ? 'text-primary-emphasis'
                    : 'text-warning-foreground',
                )}
              />
              <span>{deadlineText}</span>
            </p>
          ) : null}
          {legacyNote ? (
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">{legacyNote}</p>
          ) : null}
        </Block>
      ) : null}

      <Block title={t.details.heading} last>
        <dl>
          {meetingPoint ? <Row label={t.details.meetingPoint} value={meetingPoint} /> : null}
          <Row
            label={t.details.specialRequests}
            value={booking.specialRequests ?? t.details.none}
            muted={booking.specialRequests === null}
          />
          <Row label={t.booked} value={formatDate(booking.createdAt.slice(0, 10))} />
        </dl>
      </Block>

      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-b-[15px] bg-muted/55 px-6 py-3 sm:px-[26px]">
        {canCancel ? (
          <BookingActions
            // Hàng đáy chỉ mang nút huỷ đơn đã trả; các hành động khác ở cột phải.
            view={{ ...view, actions: ['cancelBooking'] }}
            code={booking.code}
            booking={cancelDialogBooking(booking)}
          />
        ) : (
          <p className="text-[12.5px] text-muted-foreground">{t.details.questions}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/contact" variant="outline" size="sm">
            <MessageSquareIcon aria-hidden="true" />
            {messages.passportVisa.contactUs}
          </ButtonLink>
          {VOUCHER_PHASES.has(phase) ? (
            <ButtonLink href={`/checkout/success?code=${booking.code}`} size="sm">
              <TicketIcon aria-hidden="true" />
              {messages.passportVisa.viewVoucher}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Chữ cái đầu của từ ĐẦU và từ CUỐI tên — "Erik Lund" → "EL", "Nguyễn Văn An" → "NA". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word !== '');
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** Phần đơn mà hộp xác nhận huỷ cần — cắt đúng chừng này như trang cũ đã làm. */
function cancelDialogBooking(booking: BookingDetail): CancelDialogBooking {
  return {
    code: booking.code,
    tourTitle: booking.tourTitle,
    tourSlug: booking.tourSlug,
    departureStartDate: booking.departureStartDate,
    departureEndDate: booking.departureEndDate,
    numAdults: booking.numAdults,
    numChildren: booking.numChildren,
    currency: booking.currency,
    cancellation: booking.cancellation,
  };
}

function Block({
  title,
  last = false,
  children,
}: {
  title: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn('px-6 py-4 sm:px-[26px]', last ? null : 'border-b border-muted')}>
      <h2 className="mb-2.5 text-[10px] leading-none font-bold tracking-[0.15em] text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  mono = false,
  total = false,
  muted = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  total?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex justify-between gap-4 py-[3px] text-[13.5px]',
        total && 'mt-1.5 border-t border-muted pt-2 font-bold',
      )}
    >
      <dt className={cn('shrink-0', total ? null : 'text-muted-foreground')}>{label}</dt>
      <dd
        className={cn(
          'text-right',
          mono && 'font-mono tabular-nums',
          muted && 'text-muted-foreground',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
```

- [ ] **Bước 4.** Chạy lại lệnh Bước 2 — XANH. **Đột biến:** `initials` lấy hai từ đầu (ca
  "Nguyễn Văn An" đỏ); hàng đáy truyền nguyên `view` (ca chờ trả: "Pay now" lọt xuống đáy, đỏ);
  bỏ `phase !== 'cancelled'` (ca đã huỷ đỏ); `VOUCHER_PHASES` thêm `awaiting_payment`; dòng
  Refunded dùng `formatMoney` (ca "−$73.50" đỏ vì ra "−$74"); ô Booked đọc `paidAt`.

- [ ] **Bước 5.** Chạy quy trình gate ở mục Ràng buộc toàn cục, rồi commit (stage hai file):
  `feat(web): cột thông tin đơn và hàng nút đáy của trang chi tiết đơn`

### Task 20 — B7 · Ráp trang theo giai đoạn

Trang (`app/**`) không có test — Vitest của web chỉ quét `src/components/**` và `src/lib/**`.
Vì thế bố cục dưới hero tách thành `BookingDetailView` (có spec, và B8 đổ nó ra HTML tĩnh để đo);
trang chỉ còn nạp dữ liệu và vẽ hero.

**Files:**

- Create: `apps/web/src/components/account/booking-detail-view.tsx`
- Test: `apps/web/src/components/account/booking-detail-view.spec.tsx`
- Modify (viết lại trọn): `apps/web/src/app/(site)/account/bookings/[code]/page.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts` — gỡ bốn khoá mồ côi của `passportVisa`
  (`back`, `cancelLead`, `fineLine`, `requestsLine` — consumer duy nhất là trang cũ), viết lại
  JSDoc khối ấy; sửa comment của `accountBookingDetail.viewTour`

**Interfaces:**

- Consumes: `bookingPhase`, `BookingPhase` (Phần A); `ContentHero` với `back` (Phần A);
  `journeyMilestones` (B1); `getReadySteps`, `BookingTourData` (B2); `BookingTicket` (B3);
  `TripJourney` (B4); `GetReadyPanel` (B5a); `OnTourPanel`, `TripClosedPanel`,
  `AwaitingPaymentPanel`, `ReviewPanel` (B5b); `BookingDetailsPanel`, `tourMeetingPoint` (B6, B2);
  `bookingView`; `todayDateString` (`lib/account-stats.ts:23`); `fetchBookingByCode`,
  `fetchTourDetail`; `requireSession`.
- Produces: `BookingDetailView({ booking: BookingDetail; tour: BookingTourData | null; today:
  string })` — bọc `data-slot="phase-panel"` quanh khối cột phải; trang mới.

- [ ] **Bước 1. Đọc trước** (luật `apps/web/AGENTS.md`):
  `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` và
  `…/04-functions/unstable_rethrow.md` — trang dùng `params` dạng Promise và bắt lỗi quanh một
  lời gọi `fetch` nên phải ném lại lỗi nội bộ của Next.

- [ ] **Bước 2. Test trước.** Tạo `apps/web/src/components/account/booking-detail-view.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { BookingCancellation, BookingDetail } from '@tourism/contract';
import { describe, expect, it, vi } from 'vitest';
import type { JourneyView } from '@/lib/booking-journey';
import type { GetReadyView } from '@/lib/get-ready';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingDetailView } from './booking-detail-view';

// Mọi khối con đã có spec riêng — ở đây chỉ soi khung: thứ tự, khối nào theo giai đoạn nào.
vi.mock('@/components/account/booking-ticket', () => ({
  BookingTicket: () => <div data-testid="ticket" />,
}));
vi.mock('@/components/account/trip-journey', () => ({
  TripJourney: ({ journey }: { journey: JourneyView }) => (
    <div data-testid="journey">{journey.variant}</div>
  ),
}));
vi.mock('@/components/account/booking-details-panel', () => ({
  BookingDetailsPanel: ({ phase, meetingPoint }: { phase: string; meetingPoint: string | null }) => (
    <div data-testid="details">
      {phase}|{meetingPoint ?? 'none'}
    </div>
  ),
}));
vi.mock('@/components/account/get-ready-panel', () => ({
  GetReadyPanel: ({ view, bookingCode }: { view: GetReadyView; bookingCode: string }) => (
    <div data-testid="panel">
      get-ready|{bookingCode}|{view.steps.length}
    </div>
  ),
}));
vi.mock('@/components/account/on-tour-panel', () => ({
  OnTourPanel: ({ today }: { today: string }) => <div data-testid="panel">on-tour|{today}</div>,
}));
vi.mock('@/components/account/review-panel', () => ({
  ReviewPanel: () => <div data-testid="panel">review</div>,
}));
vi.mock('@/components/account/trip-closed-panel', () => ({
  TripClosedPanel: ({ kind }: { kind: string }) => <div data-testid="panel">closed|{kind}</div>,
}));
vi.mock('@/components/account/awaiting-payment-panel', () => ({
  AwaitingPaymentPanel: () => <div data-testid="panel">awaiting-payment</div>,
}));

const TODAY = '2026-10-05';
const OPEN: BookingCancellation = {
  deadline: '2026-11-02',
  withinDeadline: true,
  refundAmount: '147.00',
  canCancel: true,
};
const TOUR = {
  excluded: ['Tips'],
  meetingPoint: 'Hotel pickup',
  itinerary: [{ dayNumber: 1, title: 'Old Quarter', description: null }],
};
const at = (patch: Partial<BookingDetail>) => makeBooking({ code: 'BK-B6VCOQNW', ...patch });

describe('BookingDetailView — khối cột phải theo giai đoạn (spec §2.5)', () => {
  it.each([
    [
      'awaiting_payment',
      at({ status: 'PENDING', paidAt: null, departureStartDate: '2026-10-20', departureEndDate: '2026-10-22' }),
      'awaiting-payment',
    ],
    [
      'upcoming',
      at({ departureStartDate: '2026-11-03', departureEndDate: '2026-11-03', cancellation: OPEN }),
      'get-ready|BK-B6VCOQNW|4',
    ],
    [
      'on_tour',
      at({ departureStartDate: '2026-10-04', departureEndDate: '2026-10-06' }),
      'on-tour|2026-10-05',
    ],
    ['travelled', at({ departureStartDate: '2026-02-11', departureEndDate: '2026-02-11' }), 'review'],
    ['cancelled', at({ status: 'CANCELLED', departureStartDate: '2026-11-03' }), 'closed|cancelled'],
    [
      'lapsed',
      at({ status: 'PENDING', paidAt: null, departureStartDate: '2026-10-01', departureEndDate: '2026-10-03' }),
      'closed|lapsed',
    ],
  ])('%s', (_, booking, expected) => {
    render(<BookingDetailView booking={booking} tour={TOUR} today={TODAY} />);
    expect(screen.getByTestId('panel')).toHaveTextContent(expected);
  });

  it('tour đã gỡ: Get ready chỉ còn một bước, cột trái không có điểm hẹn', () => {
    render(
      <BookingDetailView
        booking={at({ departureStartDate: '2026-11-03', departureEndDate: '2026-11-03', cancellation: OPEN })}
        tour={null}
        today={TODAY}
      />,
    );
    expect(screen.getByTestId('panel')).toHaveTextContent('get-ready|BK-B6VCOQNW|1');
    expect(screen.getByTestId('details')).toHaveTextContent('upcoming|none');
  });
});

describe('BookingDetailView — khung (spec §5.1)', () => {
  const UPCOMING = at({ departureStartDate: '2026-11-03', departureEndDate: '2026-11-03', cancellation: OPEN });

  it('vé → hành trình → hai cột; cột trái nhận giai đoạn và điểm hẹn của tour', () => {
    render(<BookingDetailView booking={UPCOMING} tour={TOUR} today={TODAY} />);
    const ticket = screen.getByTestId('ticket');
    const journey = screen.getByTestId('journey');
    const details = screen.getByTestId('details');
    expect(ticket.compareDocumentPosition(journey) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(journey.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(journey).toHaveTextContent('standard');
    expect(details).toHaveTextContent('upcoming|Hotel pickup');
  });

  it('DOM: thông tin đơn trước khối giai đoạn; CSS đưa khối giai đoạn lên trước ở điện thoại', () => {
    render(<BookingDetailView booking={UPCOMING} tour={TOUR} today={TODAY} />);
    const details = screen.getByTestId('details');
    const wrapper = screen.getByTestId('panel').closest('[data-slot="phase-panel"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass('order-first', 'lg:order-none');
    expect(details.compareDocumentPosition(wrapper as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('không có h1 — hero của trang giữ h1 duy nhất', () => {
    const { container } = render(<BookingDetailView booking={UPCOMING} tour={TOUR} today={TODAY} />);
    expect(container.querySelectorAll('h1')).toHaveLength(0);
  });
});
```

- [ ] **Bước 3.** `pnpm --filter @tourism/web test -- src/components/account/booking-detail-view.spec.tsx`
  — ĐỎ vì chưa có module `./booking-detail-view`.

- [ ] **Bước 4. Cài.** Tạo `apps/web/src/components/account/booking-detail-view.tsx`:

```tsx
import { type BookingDetail, type BookingPhase, bookingPhase } from '@tourism/contract';
import { AwaitingPaymentPanel } from '@/components/account/awaiting-payment-panel';
import { BookingDetailsPanel } from '@/components/account/booking-details-panel';
import { BookingTicket } from '@/components/account/booking-ticket';
import { GetReadyPanel } from '@/components/account/get-ready-panel';
import { OnTourPanel } from '@/components/account/on-tour-panel';
import { ReviewPanel } from '@/components/account/review-panel';
import { TripClosedPanel } from '@/components/account/trip-closed-panel';
import { TripJourney } from '@/components/account/trip-journey';
import { journeyMilestones } from '@/lib/booking-journey';
import { type BookingView, bookingView } from '@/lib/booking-vm';
import { type BookingTourData, getReadySteps, tourMeetingPoint } from '@/lib/get-ready';

/**
 * Thân trang chi tiết đơn, dưới hero (spec P7 §5.1, bản vẽ `.x-page`): vé → thanh hành trình →
 * hai cột `minmax(0,1.08fr) minmax(0,1fr)` — trái là thông tin đơn, phải đổi theo giai đoạn.
 *
 * Lề ngang trùng `ContentHero` (`px-4 md:px-16 lg:px-24 xl:px-32` quanh `max-w-7xl`) để mép
 * vé thẳng hàng với tiêu đề hero. Điện thoại một cột: khối giai đoạn lên TRƯỚC thông tin đơn
 * bằng `order-first`; DOM giữ trái trước phải sau nên trình đọc màn hình đọc theo thứ tự cột
 * (đánh đổi đã ghi ở spec §12).
 *
 * Giai đoạn đọc qua `bookingPhase` với `today` do server tính — một mốc cho cả vé, hành trình,
 * đếm ngược và ngày trong chuyến. Nút huỷ chỉ theo cờ SERVER (`cancellation`, ADR-0041 §7).
 */
export function BookingDetailView({
  booking,
  tour,
  today,
}: {
  booking: BookingDetail;
  tour: BookingTourData | null;
  today: string;
}) {
  const phase = bookingPhase(booking, today);
  const view = bookingView(booking, booking.cancellation);

  return (
    <div className="w-full px-4 pt-7 pb-16 md:px-16 md:pb-20 lg:px-24 xl:px-32">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <BookingTicket booking={booking} view={view} />
        <TripJourney journey={journeyMilestones(booking, today)} />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
          <BookingDetailsPanel
            booking={booking}
            view={view}
            phase={phase}
            meetingPoint={tourMeetingPoint(tour)}
          />
          <div data-slot="phase-panel" className="order-first lg:order-none">
            <PhasePanel phase={phase} booking={booking} view={view} tour={tour} today={today} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bảng giai đoạn → khối cột phải (spec §2.5). */
function PhasePanel({
  phase,
  booking,
  view,
  tour,
  today,
}: {
  phase: BookingPhase;
  booking: BookingDetail;
  view: BookingView;
  tour: BookingTourData | null;
  today: string;
}) {
  switch (phase) {
    case 'awaiting_payment':
      return <AwaitingPaymentPanel booking={booking} view={view} />;
    case 'upcoming':
      return (
        <GetReadyPanel view={getReadySteps(booking, tour, today)} bookingCode={booking.code} />
      );
    case 'on_tour':
      return <OnTourPanel booking={booking} tour={tour} today={today} />;
    case 'travelled':
      return <ReviewPanel booking={booking} />;
    case 'cancelled':
      return <TripClosedPanel booking={booking} view={view} kind="cancelled" />;
    case 'lapsed':
      return <TripClosedPanel booking={booking} view={view} kind="lapsed" />;
  }
}
```

- [ ] **Bước 5.** Chạy lại lệnh Bước 3 — XANH. **Đột biến:** đổi nhánh `on_tour` và `travelled`
  (ca it.each đỏ); bỏ `order-first`; truyền `tour?.meetingPoint ?? null` thay `tourMeetingPoint`
  (vẫn xanh với fixture này — ghi lại; ca trống đã có ở B2).

- [ ] **Bước 6. Viết lại trang.** Thay TRỌN nội dung `apps/web/src/app/(site)/account/bookings/[code]/page.tsx`:

```tsx
import { BookingCodeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, unstable_rethrow } from 'next/navigation';
import { BookingDetailView } from '@/components/account/booking-detail-view';
import { ContentHero } from '@/components/content/content-hero';
import { todayDateString } from '@/lib/account-stats';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { fetchTourDetail, type TourDetailVM } from '@/lib/api/tours';

/** Mã sai shape → null ngay (link cũ/bot), cùng nhánh notFound với mã lạ. */
async function findBooking(cookie: string, code: string) {
  if (!BookingCodeSchema.safeParse(code).success) return null;
  return fetchBookingByCode(cookie, code);
}

/**
 * Dữ liệu tour chỉ làm giàu trang (điểm hẹn, mục không gồm, lịch trình — spec §2.4): tour đã
 * gỡ trả `null`, và API catalog hỏng cũng KHÔNG được làm sập trang đơn của khách — rơi về
 * `null`, trang vẫn đủ vé, hành trình, tiền và hạn huỷ. `unstable_rethrow` trả lại cho Next
 * mọi lỗi nội bộ của nó (notFound, redirect, bail-out động) trước khi nuốt lỗi.
 */
async function loadTour(slug: string): Promise<TourDetailVM | null> {
  try {
    return await fetchTourDetail(slug);
  } catch (error) {
    unstable_rethrow(error);
    console.warn(`[booking-detail] không đọc được tour "${slug}" — trang chạy không dữ liệu tour`, error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  // Best-effort cho tiêu đề đẹp — gate/404 thật là việc của thân trang.
  const cookie = (await cookies()).toString();
  let booking: Awaited<ReturnType<typeof findBooking>> = null;
  try {
    booking = await findBooking(cookie, code);
  } catch {
    booking = null;
  }
  if (!booking) return { title: 'Booking not found — Nexora' };
  return {
    title: `${booking.tourTitle} — ${booking.code} — Nexora`,
  };
}

/**
 * Chi tiết một đơn của khách (spec P7 §5): hero (breadcrumb "Booking", tên tour, mã đơn, nút
 * tròn quay về My bookings) rồi `BookingDetailView`. Trang chỉ nạp dữ liệu; bố cục ở
 * `BookingDetailView` để test được và đo được bằng CSS build thật.
 *
 * `h1` duy nhất là tiêu đề hero; tên tour trên vé là `h2` (spec §5.2 — bản cũ có hai `h1`).
 * "Hôm nay" là ngày lịch Việt Nam tính ở server (`todayDateString`, spec §2.1).
 */
export default async function AccountBookingDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  await requireSession(`/account/bookings/${code}`);
  const cookie = (await cookies()).toString();
  const booking = await findBooking(cookie, code);
  if (!booking) notFound();
  const tour = await loadTour(booking.tourSlug);

  return (
    <div>
      <ContentHero
        breadcrumb={messages.passportVisa.heroBreadcrumb}
        title={booking.tourTitle}
        meta={booking.code}
        back={{ href: '/account/bookings', label: messages.bookingDetail.back }}
      />
      <BookingDetailView booking={booking} tour={tour} today={todayDateString()} />
    </div>
  );
}
```

- [ ] **Bước 7. Dọn chữ mồ côi.** Trong `libs/shared/i18n/src/lib/messages.ts`, khối
  `passportVisa` (neo theo chữ: khối bắt đầu bằng dòng `  passportVisa: {`):
  - thay ba dòng JSDoc ngay trên `passportVisa: {` (bắt đầu bằng
    `/** Trang visa (M2) — chi tiết booking dựng như giấy tờ dán trong hộ chiếu:`) bằng:

```ts
  /** Nhãn dùng chung của khu đơn: breadcrumb và mộc trạng thái (`VisaStamp`) của trang chi tiết
   *  đơn, dải vé "Entry · Tour booking", lưới nhãn của `BookingAccordion`, hai nút Contact us /
   *  View voucher. Tên khối giữ từ thời trang "visa" (M2); trang chi tiết đơn nay là vé kiểu
   *  boarding pass (spec P7 §5.2), chữ riêng của nó ở `bookingDetail`. */
```

  - xoá dòng `    back: '← Passport',` NGAY DƯỚI `    heroBreadcrumb: 'Booking',` (ba khối khác
    cũng có `back: '← Passport'` — chỉ xoá dòng trong `passportVisa`);
  - xoá dòng `    cancelLead: 'Need to change plans?',`;
  - xoá bốn dòng từ `    /** Fine print đáy giấy tờ — thay section Contact cũ, gọn một dòng mono. */`
    tới hết `    requestsLine: (requests: string) => \`Special requests: ${requests}\`.toUpperCase(),`.

  Trong `accountBookingDetail`, comment trên `viewTour: 'View tour',` đổi câu
  `link cạnh H1 sang trang tour công khai` thành `link dưới tên tour trên vé (spec P7 §5.2) sang
  trang tour công khai`. Kiểm không còn consumer (phải rỗng):
  `grep -rn "fineLine\|requestsLine\|cancelLead\|tv\.back" apps libs --include=*.ts --include=*.tsx`
  (ngoài `node_modules`, `dist`). Build lại i18n (lệnh ở Ràng buộc toàn cục).

- [ ] **Bước 8. Kiểm tay trong dev** (không thay gate): `pnpm --filter @tourism/web dev` với API
  dev chạy nền; đăng nhập tài khoản seed, mở `/account/bookings/<mã>` của một đơn đã đi và một đơn
  sắp đi (nếu seed có). Đạt khi: không lỗi console, hero có nút tròn quay lại, không còn link chữ
  "← Passport", trang có đúng một `h1` (`document.querySelectorAll('h1').length` trong console là
  1). Tắt `next dev` trước khi build (gotcha 4 của CLAUDE.md).

- [ ] **Bước 9.** Chạy quy trình gate ở mục Ràng buộc toàn cục, rồi commit (stage
  `apps/web/src/components/account/booking-detail-view.tsx`,
  `apps/web/src/components/account/booking-detail-view.spec.tsx`,
  `apps/web/src/app/(site)/account/bookings/[code]/page.tsx`,
  `libs/shared/i18n/src/lib/messages.ts`): `feat(web): dựng lại trang chi tiết đơn theo giai đoạn`

### Task 21 — B8 · Soi bố cục bằng CSS build thật, gate cuối, docs, bàn giao

jsdom không có bố cục. Cách làm như Task 13 của plan P4e-4: DOM của CHÍNH các component, đổ ra
trang tĩnh, nối CSS mà `next build` của web vừa sinh, đo bằng trình duyệt ở 1280px và 375px. Không
commit file tạm — chỉ commit khi phải sửa lỗi bố cục tìm ra, và commit docs.

**Files:**

- Create (tạm, xoá ở Bước 7): `apps/web/src/components/__layout-check__/render.spec.tsx`
- Output (tạm): `apps/web/.next/layout-check/*.html` (`.next/` đã nằm trong `.gitignore`)
- Modify: `docs/CHANGELOG.md`

- [ ] **Bước 1.** Web phải vừa build (đã có nếu vừa chạy gate ở B7):
  `ls apps/web/.next/static/chunks/*.css` ra ít nhất một file. Không có thì chạy bước 1–2 của Quy
  trình gate (cần API sống).

- [ ] **Bước 2.** Tạo spec tạm `apps/web/src/components/__layout-check__/render.spec.tsx`:

```tsx
// TẠM — soi bố cục trang chi tiết đơn bằng CSS build thật (plan P7 Phần B, Task B8). KHÔNG commit.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import type { BookingCancellation, BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeAll, describe, it, vi } from 'vitest';
import { BookingDetailView } from '@/components/account/booking-detail-view';
import { ContentHero } from '@/components/content/content-hero';
import type { BookingTourData } from '@/lib/get-ready';
import { makeBooking } from '@/test/fixtures/booking';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/account/bookings/BK-B6VCOQNW',
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// cwd của vitest là apps/web.
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

const TODAY = '2026-10-05';
const cancellation = (patch: Partial<BookingCancellation> = {}): BookingCancellation => ({
  deadline: '2026-11-02',
  withinDeadline: true,
  refundAmount: '147.00',
  canCancel: true,
  ...patch,
});
const photo = (url: string): NonNullable<BookingDetail['tourImage']> => ({
  publicId: 'tourism/catalog/tour/layout-check/hero',
  url,
  type: 'IMAGE',
  role: 'hero',
  posterUrl: null,
  width: 2400,
  height: 1600,
  alt: null,
  sortOrder: 0,
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
});

// Ảnh và chữ lấy đúng của bản vẽ booking-detail.src.html để so cạnh nhau.
const HANOI_PHOTO = photo(
  'https://res.cloudinary.com/dbkgeehow/image/upload/f_auto,q_auto,w_500/tourism/catalog/tour/hanoi-heritage-day/hero',
);
const BANA_PHOTO = photo(
  'https://res.cloudinary.com/dbkgeehow/image/upload/f_auto,q_auto,w_500/v1787029571/tourism/catalog/tour/bana-hills-golden-bridge-day/hero',
);
const HANOI_TOUR: BookingTourData = {
  excluded: ['Lunch (own arrangement)', 'Tips', 'Personal expenses'],
  meetingPoint: 'Hotel pickup — hotels in Hoàn Kiếm, Ba Đình or Tây Hồ districts, Hà Nội',
  itinerary: [
    {
      dayNumber: 1,
      title: 'Ba Đình to the Old Quarter',
      description: [
        '08:00 — Hotel pickup, drive to Ba Đình Square',
        '08:30 — Hồ Chí Minh Mausoleum exterior and Presidential Palace grounds',
        "09:15 — One Pillar Pagoda and Hồ Chí Minh's stilt house",
        "10:00 — Temple of Literature, Vietnam's first university (1070)",
        '11:15 — Train Street (Trần Phú) photo stop, timed to the track schedule',
      ].join('\n'),
    },
  ],
};
const LEAD = { contactName: 'Erik Lund', contactEmail: 'erik.lund@example.com' };

const PAGES: Record<string, { booking: BookingDetail; tour: BookingTourData | null }> = {
  upcoming: {
    booking: makeBooking({
      ...LEAD,
      code: 'BK-B6VCOQNW',
      tourTitle: 'Hanoi Heritage in a Day',
      tourSlug: 'hanoi-heritage-day',
      tourImage: HANOI_PHOTO,
      tourDestinations: [{ slug: 'ha-noi', name: 'Hà Nội', isPrimary: true }],
      numAdults: 3,
      unitPrice: '49.00',
      totalAmount: '147.00',
      paymentProvider: 'PAYPAL',
      createdAt: '2026-08-14T03:00:00.000Z',
      paidAt: '2026-08-14T03:05:00.000Z',
      departureStartDate: '2026-11-03',
      departureEndDate: '2026-11-03',
      cancellationDeadline: '2026-11-02',
      cancellation: cancellation(),
    }),
    tour: HANOI_TOUR,
  },
  travelled: {
    booking: makeBooking({
      ...LEAD,
      code: 'BK-6EYNLUEK',
      tourTitle: 'Bà Nà Hills & Golden Bridge Day Trip',
      tourSlug: 'bana-hills-golden-bridge-day',
      tourImage: BANA_PHOTO,
      tourDestinations: [{ slug: 'da-nang', name: 'Đà Nẵng', isPrimary: true }],
      numAdults: 2,
      numChildren: 1,
      unitPrice: '79.00',
      totalAmount: '237.00',
      paymentProvider: 'STRIPE',
      createdAt: '2026-02-10T02:00:00.000Z',
      paidAt: '2026-02-10T02:05:00.000Z',
      departureStartDate: '2026-02-11',
      departureEndDate: '2026-02-11',
      cancellationDeadline: '2026-02-10',
      cancellation: cancellation({
        deadline: '2026-02-10',
        withinDeadline: false,
        refundAmount: '0.00',
        canCancel: false,
      }),
    }),
    tour: { excluded: [], meetingPoint: 'Hotel pickup, Đà Nẵng city centre', itinerary: [] },
  },
  'on-tour': {
    booking: makeBooking({
      ...LEAD,
      code: 'BK-ONTOUR01',
      tourTitle: 'Hội An, Mỹ Sơn & the Marble Mountains',
      tourSlug: 'hoi-an-my-son',
      tourImage: BANA_PHOTO,
      tourDestinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
      numAdults: 2,
      unitPrice: '189.00',
      totalAmount: '378.00',
      departureStartDate: '2026-10-04',
      departureEndDate: '2026-10-06',
      cancellationDeadline: '2026-10-01',
      cancellation: cancellation({
        deadline: '2026-10-01',
        withinDeadline: false,
        refundAmount: '0.00',
        canCancel: false,
      }),
    }),
    tour: {
      excluded: [],
      meetingPoint: 'Hội An Ancient Town gate, Trần Phú street',
      itinerary: [
        { dayNumber: 1, title: 'Đà Nẵng arrival', description: '14:00 — Check in' },
        {
          dayNumber: 2,
          title: 'Hội An old town',
          description: '08:00 — Walk the old town\n12:00 — Cao lầu lunch\n19:00 — Lantern boats',
        },
        { dayNumber: 3, title: 'Mỹ Sơn sanctuary', description: '05:30 — Sunrise visit' },
      ],
    },
  },
  'cancelled-no-photo': {
    booking: makeBooking({
      ...LEAD,
      code: 'BK-CANCEL01',
      status: 'CANCELLED',
      tourTitle: 'Hanoi Heritage in a Day',
      tourImage: null,
      tourDestinations: [{ slug: 'ha-noi', name: 'Hà Nội', isPrimary: true }],
      totalAmount: '147.00',
      refundedTotal: '147.00',
      paidAt: '2026-08-14T03:05:00.000Z',
      cancelledAt: '2026-09-21T02:00:00.000Z',
      departureStartDate: '2026-11-03',
      departureEndDate: '2026-11-03',
      cancellation: null,
    }),
    tour: null,
  },
};

function page(name: string, { booking, tour }: { booking: BookingDetail; tour: BookingTourData | null }) {
  render(
    <>
      <ContentHero
        breadcrumb={messages.passportVisa.heroBreadcrumb}
        title={booking.tourTitle}
        meta={booking.code}
        back={{ href: '/account/bookings', label: messages.bookingDetail.back }}
      />
      <BookingDetailView booking={booking} tour={tour} today={TODAY} />
    </>,
  );
  const links = CSS.map((file) => `<link rel="stylesheet" href="/static/chunks/${file}">`).join('');
  writeFileSync(
    `${OUT}/${name}.html`,
    `<!doctype html><html lang="en" class="${FONT_CLASSES.join(' ')} h-full antialiased"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${links}</head><body class="min-h-full flex flex-col">${document.body.innerHTML}</body></html>`,
  );
}

describe('layout-check', () => {
  for (const [name, data] of Object.entries(PAGES)) {
    it(name, () => page(name, data));
  }
});
```

  Chạy: `pnpm --filter @tourism/web exec vitest run src/components/__layout-check__/render.spec.tsx`
  — bốn ca xanh, bốn file trong `apps/web/.next/layout-check/`.

- [ ] **Bước 3.** Mở máy chủ tĩnh ở nền (Git Bash, từ gốc repo):
  `python -m http.server 8766 --directory apps/web/.next`, và một máy chủ nữa cho bản vẽ:
  `python -m http.server 8767 --directory docs/design/mockups`. Mở
  `http://localhost:8766/layout-check/upcoming.html` trong Browser pane (`preview_start` với
  `url`). Chữ phải ra Literata/Archivo/IBM Plex Mono; không có thì Bước 2 thiếu class font.

- [ ] **Bước 4. Đo ở 1280px.** `resize_window` 1280×900, ở `upcoming.html` chạy bằng
  `javascript_tool`:

```js
(() => {
  const q = (selector) => document.querySelector(selector);
  const box = (element) => element.getBoundingClientRect();
  const stub = q('[data-slot="ticket-stub"]');
  const photo = q('[data-slot="ticket-photo"]');
  const body = q('[data-slot="ticket-body"]');
  const rail = q('[data-slot="journey-rail"]');
  const today = q('[data-slot="journey-today"]');
  const steps = [...document.querySelectorAll('li[data-milestone]')].map(box);
  const details = q('[data-slot="booking-details"]');
  const phase = q('[data-slot="phase-panel"]');
  const pageBg = getComputedStyle(document.body).backgroundColor;
  const notch = (pseudo) => {
    const style = getComputedStyle(stub, pseudo);
    return {
      top: style.top,
      right: style.right,
      bottom: style.bottom,
      left: style.left,
      clip: style.clipPath,
      pageBackground: style.backgroundColor === pageBg,
    };
  };
  return {
    viewport: innerWidth,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    h1: document.querySelectorAll('h1').length,
    alignLeft: Math.round(box(q('[data-slot="booking-ticket"]')).left - box(q('h1')).left),
    photoW: photo ? Math.round(box(photo).width) : null,
    stubW: Math.round(box(stub).width),
    bandH: Math.round(box(q('[data-slot="ticket-band"]')).height),
    threeParts: !!photo && box(photo).right <= box(body).left + 1 && box(body).right <= box(stub).left + 1,
    before: notch('::before'),
    after: notch('::after'),
    journeyOneRow: new Set(steps.map((rect) => Math.round(rect.top))).size === 1,
    todayPct: today
      ? Math.round(((box(today).left + box(today).width / 2 - box(rail).left) / box(rail).width) * 100)
      : null,
    twoColumns: box(phase).left >= box(details).right,
    topDelta: Math.round(box(phase).top - box(details).top),
  };
})()
```

  Đạt khi: `overflowX` 0; `h1` 1; `alignLeft` 0 (mép vé thẳng tiêu đề hero, spec §5.1);
  `photoW` 210; `stubW` 262; `bandH` 38 (ba số của `.tk` bản vẽ); `threeParts` true;
  `before.top` và `before.left` đều `-12px`, `before.clip` là `inset(50% 0px 0px)` (Chrome viết
  rút gọn theo luật shorthand của margin — điều cần là 50% ở cạnh TRÊN), `before.pageBackground`
  true; `after.bottom` và `after.left` đều `-12px`, `after.clip` là `inset(0px 0px 50%)`;
  `journeyOneRow` true; `todayPct` 43 (khớp `left:43%` của bản vẽ); `twoColumns` true;
  `topDelta` 0. Rồi `computer` `zoom` vào vùng mép trên và mép dưới của đường xé (quanh
  `box(stub).left`, `box(stub).top` và `.bottom`): viền ngang của vé phải ĐỨT đúng chỗ vết khuyết,
  không còn một vạch viền chạy ngang qua nửa hình tròn. Chụp một ảnh màn cả trang.

- [ ] **Bước 5. So với bản vẽ.** Mở `http://localhost:8767/booking-detail.src.html` cùng khổ
  1280: đặt ảnh chụp ở Bước 4 cạnh khung "CHUYẾN SẮP ĐI" của bản vẽ. Khác nhau ĐƯỢC PHÉP và phải
  ghi vào bàn giao: vé hẹp hơn (nội dung thẳng mép hero còn 1024px, bản vẽ dùng lề 40px); dải màu
  `bg-primary` thay `--pdeep` (không có token); ô Get ready bước 01 ghi "Free cancellation" và
  câu của `cancellationDeadlineText` (spec §2.4); tiền làm tròn đơn vị ("$147", bản vẽ "$147.00" —
  quyết định 21). Ngoài các chỗ đó mà lệch (thứ tự khối, cỡ chữ, vị trí mộc, nút) là lỗi.

- [ ] **Bước 6. Đo ở 375px.** `resize_window` 375×812, chạy lại đoạn đo ở `upcoming.html`. Đạt
  khi: `overflowX` 0; `h1` 1; `alignLeft` 0; `threeParts` false và xếp dọc đúng thứ tự (thêm vào
  đoạn đo `box(photo).bottom <= box(body).top + 1 && box(body).bottom <= box(stub).top + 1` → true);
  `before.top` `-12px`, `before.left` `-12px`, `before.clip` `inset(0px 0px 0px 50%)`;
  `after.top` `-12px`, `after.right` `-12px`, `after.clip` `inset(0px 50% 0px 0px)`; `zoom` vào
  hai mép của đường xé ngang — viền dọc của vé đứt đúng chỗ vết khuyết; `journeyOneRow` false và
  các mốc xếp dọc (`steps.every((rect, i) => i === 0 || rect.top > steps[i - 1].top)` → true), dòng
  Today nằm giữa mốc Paid và mốc Free cancellation; `twoColumns` false và khối giai đoạn ở TRÊN
  (`box(phase).bottom <= box(details).top + 1` → true); hàng DEPARTS → RETURNS không tràn (nhãn
  giữa được phép xuống hai dòng). Ba trang còn lại (`travelled`, `on-tour`, `cancelled-no-photo`)
  ở cả 1280 và 375: `overflowX` 0, `h1` 1; ở `travelled` form review nằm gọn trong cột phải; ở
  `on-tour` 1280 `todayPct` là 74 (10 + 80 × 0.8 — đoạn cuối, Today kẹp ở giữa ngày 2/3: tỷ lệ
  0.5 → 87.5% vạch → 80% khung; ghi số đo thật, lệch thì đối chiếu `journeyMilestones`); ở
  `cancelled-no-photo` 1280 dải đầu vé bo góc trái trên, lưới ô bo góc trái dưới, hai vết khuyết
  vẫn đúng. Trả khổ về `desktop` khi xong.

- [ ] **Bước 7. Dọn.** Tắt hai máy chủ tĩnh (PowerShell):
  `Get-NetTCPConnection -LocalPort 8766,8767 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`;
  xoá `apps/web/src/components/__layout-check__/` và `apps/web/.next/layout-check/`. `git status`
  phải sạch.

- [ ] **Bước 8.** Có phép đo trượt: sửa đúng chỗ (TDD nếu sửa logic), gate, commit
  `fix(web): …` mô tả lỗi bố cục; rồi đo lại. Ghi MỌI số đo (cả lần trượt) vào bàn giao.

- [ ] **Bước 9. Kiểm nhánh.** `git log --oneline main..HEAD` — commit của B1…B7 (cộng commit `fix`
  của Bước 8 nếu có), không commit lạ. `git diff --stat main..HEAD` không chạm file nào ngoài Bản
  đồ file của Phần B. Ba phép grep phải rỗng:

```bash
grep -rn "passportVisa\.\(back\|cancelLead\|fineLine\|requestsLine\)\|tv\.back" apps libs --include=*.ts --include=*.tsx
grep -rn "<h1\|motion.h1" apps/web/src/components/account apps/web/src/app/\(site\)/account/bookings/\[code\]
git diff main..HEAD -- apps/web libs | grep -nE "^\+.*#[0-9a-fA-F]{6}\b"
```

  Quy trình gate trên đỉnh nhánh; ghi số test từng gói (Vitest) và số int (ca, file).

- [ ] **Bước 10. Entry CHANGELOG** — chèn ngay dưới khối `> **File này chỉ giữ đợt đang chạy**…`,
  TRÊN entry mới nhất. Ngày là ngày chạy bước này. Khuôn:

```markdown
## 2026-MM-DD — P7 phần B: trang chi tiết đơn (nhánh `feat/booking-pages-redesign`)

Trang `/account/bookings/[code]` dựng lại theo bản vẽ duyệt 05/10: vé kiểu boarding pass (ảnh
tour, thân vé có mộc, cuống có mã vạch khi đơn còn hiệu lực và đã trả; đường xé gạch đứt với
hai vết khuyết che viền vé — ngoại lệ user duyệt riêng cho trang này), thanh hành trình năm mốc
có nhãn Today và chip theo giai đoạn (biến thể huỷ và lỡ hạn trả), hai cột: trái là thông tin
đơn bốn khối với hàng nút đáy, phải đổi theo `bookingPhase` — Get ready (đếm ngược, bước chuẩn
bị, ô tích nhớ trên máy), ngày trong chuyến, khu review (giữ nguyên linh kiện), đơn đã huỷ hay
lỡ hạn, đơn chờ trả. Hero có nút quay lại My bookings; trang còn đúng một `h1`; bỏ link chữ
"← Passport". Không đổi API, không migration, không env.

(Một đoạn chỗ lệch plan nếu có, kèm lý do; một đoạn số đo Task B8 ở 1280px và 375px; một dòng
về bốn khoá `passportVisa` mồ côi đã gỡ.)

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **N** (web …, i18n …, và các gói còn lại), int **N ở N file**. Liệt kê số
ca mới theo file và các đột biến đã thử.
```

  Không để dòng nào bắt đầu bằng `+`; tổng số test gói trọn trong một dòng hoặc nối bằng chữ
  "và". `git diff docs/CHANGELOG.md` phải chỉ có phần thêm.

- [ ] **Bước 11.** `./scripts/docs-freshness.sh` (Git Bash) — xanh. Commit:
  `docs: entry CHANGELOG cho P7 phần B trang chi tiết đơn`

- [ ] **Bước 12.** Tắt API (lệnh PowerShell ở Quy trình gate). Không còn tiến trình nào nghe cổng
  3001, 8766 hay 8767. Xoá `apps/*/.turbo`, `.turbo` gốc và `apps/*/.next` nếu còn; báo dung lượng
  ổ C trước và sau.

- [ ] **Bước 13. Bàn giao** — KHÔNG merge. Báo cho session gốc: danh sách commit · kết quả gate
  (số test từng gói, int) · đột biến đã thử và kết quả (kể cả cái không giết được, kèm lý do) · số
  đo Bước 4 và Bước 6 ở hai khổ, hai ảnh chụp (1280 cạnh bản vẽ; 375) · chỗ lệch plan và vì sao ·
  việc cần hạ tầng (dự kiến: không có).

#### Sau khi bàn giao Phần B — việc của session gốc

1. Review nhánh mức max effort, vá TRỌN phát hiện trên chính nhánh này. Đọc kỹ: CSS vết khuyết
   (tâm ở mép ngoài viền, nửa ngoài bị cắt, màu nền trang ở cả hai theme); vị trí Today và mức
   kẹp; mốc Free cancellation đúng ngày chót và mốc Trip ends ngày về; mã vạch chỉ cho đơn còn
   hiệu lực VÀ đã trả; khu review dời nguyên văn; hàng đáy không lặp nút trả tiền; `loadTour`
   nuốt lỗi sau `unstable_rethrow`; ô tích chịu storage bị chặn; bốn khoá i18n gỡ không còn
   consumer.
2. Hỏi user trước khi merge; rebase lên `main` (Phần A đã ở đó), `git merge --ff-only`, push bằng
   SHA đích danh; `gh run list --branch main --limit 1` phải xanh.
3. Deploy: chỉ web (Vercel tự deploy khi push `main`); không migration, không env, không webhook.
4. Entry CHANGELOG ngày merge; dòng P7 trong `CLAUDE.md` (roadmap) và `docs/open-items.md` (phần B
   xong).
5. Thử tay trên production theo spec §11, TỪNG BƯỚC, chờ user báo xong mới sang bước kế; session
   gốc kiểm DB bằng SQL chỉ đọc (`bookings` theo mã) khi cần:
   - **Bước 4** — chi tiết một đơn sắp đi: vé, thanh hành trình có Today, số ngày, Get ready; tích
     một mục rồi tải lại trang (mục vẫn tích);
   - **Bước 5** — chi tiết một đơn đã đi: form review ở cột phải, gửi được như cũ;
   - **Bước 6** — chi tiết một đơn đã huỷ: biến thể huỷ của thanh hành trình, chữ hoàn tiền;
   - phần trang chi tiết của **Bước 10** — khổ 375px: vé xếp dọc, vết khuyết ở hai mép trái phải,
     khối giai đoạn nằm trên thông tin đơn.
   Giai đoạn `on_tour` khó thử tay (cần đơn có ngày đi bao trùm hôm thử — spec §12); B8 đã đo nó
   bằng HTML tĩnh.


## Phần C — Voucher (Task 22–26)

> Bắt đầu khi `main` đã có Phần A (không cần Phần B): `git rebase main` trước Task 22. Hết Task 26
> thì DỪNG để session gốc review và merge.

### Task 22 — C1 · `voucherView`: luật vừa trả, mở lại và giai đoạn của voucher

**Files:**

- Create: `apps/web/src/lib/voucher.ts`
- Test: `apps/web/src/lib/voucher.spec.ts`
- Create: `apps/web/src/test/fixtures/voucher.ts`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối MỚI cấp cao nhất `voucher`, chèn ngay sau
  khối `cancellationDeadline`)

**Interfaces:**

- Consumes: `bookingPhase`, kiểu `BookingPhase` (Phần A, `@tourism/contract`);
  `tripLengthDays(startDate, endDate)` (`libs/shared/contract/src/schemas/refund-policy.ts:134`,
  đã export qua barrel); `refundSummary`, kiểu `RefundSummary`
  (`apps/web/src/lib/booking-vm.ts:116`, `:103`); `formatDate`, `formatChipDate`,
  `formatDateRange`, `formatMoneyExact` (`apps/web/src/lib/tours.ts:496`, `:532`, `:546`,
  `:446`); `makeBooking` (`apps/web/src/test/fixtures/booking.ts:17`); chữ có sẵn
  `messages.booking.form.stripe|paypal` (`messages.ts:289`, `:291`),
  `messages.checkoutSummary.taxesNote` (`:549`), `messages.cancellationDeadline.full` (`:561`),
  `messages.accountBookingDetail.refundLine.full|partial|none` (`:2551`),
  `messages.accountBookingDetail.sections.reviewBlurb` (`:2573`).
- Produces: hằng `VOUCHER_FRESH_MINUTES` (30); kiểu `VoucherPhase`
  (`'upcoming' | 'on_tour' | 'travelled' | 'cancelled'`), `VoucherJournalItem`
  (`{ label; detail: string | null; done }`), `VoucherView`; hàm
  `voucherView(booking: BookingDetail, now: Date, today: string): VoucherView | null`; khối chữ
  `messages.voucher` (đủ cho cả phần C — C2, C3 chỉ dùng, không thêm khoá); fixture
  `voucherBooking(overrides)`, `openCancellation(deadline)`, `minutesBeforeNow(minutes)`,
  `VOUCHER_NOW`, `VOUCHER_TODAY`.

- [ ] **Bước 0. Điều kiện của phần C.** Phần A đã merge vào `main` và nhánh đứng trên `main` mới
  nhất. Ba phép kiểm (Git Bash, gốc repo):
  - `grep -n "export function bookingPhase" libs/shared/contract/src/schemas/booking-phase.ts`
    — đúng một dòng;
  - `grep -n "export function bookingPriceLines" apps/web/src/lib/checkout.ts` — đúng một dòng;
  - `grep -n "^  voucher: {" libs/shared/i18n/src/lib/messages.ts` — RỖNG (chưa ai thêm khối).

  Sai một trong ba thì DỪNG, báo session gốc. Rồi build contract và i18n (lệnh ở Ràng buộc
  toàn cục) để web đọc được `bookingPhase` từ `dist`.

- [ ] **Bước 1. Test trước.** Tạo fixture `apps/web/src/test/fixtures/voucher.ts`:

```ts
import type { BookingCancellation, BookingDetail } from '@tourism/contract';
import { makeBooking } from './booking';

/**
 * Fixture dùng chung cho các spec voucher `/checkout/success` (plan P7, phần C).
 *
 * "Bây giờ" của mọi spec voucher: 10:00 giờ Việt Nam ngày 20/10/2026. Spec truyền mốc này
 * vào `voucherView` thay vì đọc đồng hồ thật.
 */
export const VOUCHER_NOW = new Date('2026-10-20T03:00:00.000Z');

/** Ngày lịch Việt Nam của `VOUCHER_NOW`. */
export const VOUCHER_TODAY = '2026-10-20';

/** Mốc ISO cách `VOUCHER_NOW` `minutes` phút về trước (số âm là về sau). */
export function minutesBeforeNow(minutes: number): string {
  return new Date(VOUCHER_NOW.getTime() - minutes * 60_000).toISOString();
}

/** Cờ `cancellation` server trả cho đơn còn trong hạn huỷ miễn phí. */
export function openCancellation(deadline: string): BookingCancellation {
  return { deadline, withinDeadline: true, refundAmount: '147.00', canCancel: true };
}

/**
 * Đơn của bản vẽ `booking-voucher.src.html`: Hà Nội một ngày 3/11, 3 người lớn × $49, trả
 * bằng PayPal hai ngày trước `VOUCHER_NOW` — mặc định là voucher MỞ LẠI của chuyến sắp đi.
 *
 * Hai điểm đến để ca `{nơi}` phân biệt "điểm đến đầu tiên" với "điểm đến nào cũng được".
 */
export function voucherBooking(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return makeBooking({
    code: 'BK-B6VCOQNW',
    status: 'PAID',
    tourTitle: 'Hanoi Heritage in a Day',
    tourSlug: 'hanoi-heritage-day',
    tourDestinations: [
      { slug: 'ha-noi', name: 'Hà Nội', isPrimary: true },
      { slug: 'ninh-binh', name: 'Ninh Bình', isPrimary: false },
    ],
    departureStartDate: '2026-11-03',
    departureEndDate: '2026-11-03',
    cancellationDeadline: '2026-11-02',
    unitPrice: '49.00',
    totalAmount: '147.00',
    currency: 'USD',
    numAdults: 3,
    numChildren: 0,
    contactName: 'Erik Lund',
    contactEmail: 'erik.lund@example.com',
    paymentProvider: 'PAYPAL',
    createdAt: '2026-10-18T02:00:00.000Z',
    paidAt: '2026-10-18T02:20:00.000Z',
    cancellation: openCancellation('2026-11-02'),
    ...overrides,
  });
}
```

  Tạo `apps/web/src/lib/voucher.spec.ts`:

```ts
import type { BookingCancellation } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import {
  minutesBeforeNow,
  openCancellation,
  VOUCHER_NOW,
  VOUCHER_TODAY,
  voucherBooking,
} from '@/test/fixtures/voucher';
import { VOUCHER_FRESH_MINUTES, type VoucherView, voucherView } from './voucher';

/**
 * Bảng quyết định của voucher `/checkout/success` (spec P7 §2.6). Chữ khớp NGUYÊN VĂN —
 * câu mới của khối `messages.voucher` lẫn câu dùng lại (thuế phí, hạn huỷ, hoàn tiền) đều
 * được ghim ở đây: đổi chữ là phải đổi test, có chủ ý.
 */
function view(...args: Parameters<typeof voucherView>): VoucherView {
  const result = voucherView(...args);
  if (result === null) throw new Error('fixture phải là đơn đã trả');
  return result;
}

/** Chuyến ba ngày 3–5/11: N = 3 nên hạn chót 31/10, hôm nay (20/10) còn trong hạn. */
const THREE_DAYS = {
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
  cancellationDeadline: '2026-10-31',
  cancellation: openCancellation('2026-10-31'),
};

/** Cờ server của chuyến ba ngày ấy khi hạn chót đã qua. */
const PASSED: BookingCancellation = {
  deadline: '2026-10-31',
  withinDeadline: false,
  refundAmount: '0.00',
  canCancel: false,
};

/**
 * Đơn đã trả rồi huỷ quá hạn: không hoàn đồng nào. Hai mốc huỷ lệch ngày nhau CHỈ để ca
 * nhật ký phân biệt được thứ tự ưu tiên `cancelledAt` → `cancellationDecidedAt` →
 * `cancellationRequestedAt`.
 */
const CANCELLED = {
  status: 'CANCELLED',
  cancellation: null,
  cancelledAt: '2026-11-01T10:00:00.000Z',
  cancellationDecidedAt: '2026-10-31T09:00:00.000Z',
} as const;

const SHOW_CODE = 'Show this code at pickup — printed or on your phone.';
const TAXES = 'Includes all taxes and fees.';

describe('voucherView — đơn nào dùng thiết kế voucher (spec §2.6)', () => {
  it('đơn chưa có paidAt (PENDING chờ webhook) → null: trang giữ hoá đơn chờ', () => {
    const pending = voucherBooking({ status: 'PENDING', paidAt: null, cancellation: null });
    expect(voucherView(pending, VOUCHER_NOW, VOUCHER_TODAY)).toBeNull();
  });

  it('giữ chỗ hết hạn rồi bị huỷ, chưa từng trả → null, dù giai đoạn là cancelled', () => {
    const lapsed = voucherBooking({ ...CANCELLED, paidAt: null });
    expect(voucherView(lapsed, VOUCHER_NOW, VOUCHER_TODAY)).toBeNull();
  });
});

describe('voucherView — vừa trả hay mở lại', () => {
  it('PAID 15 phút trước, chuyến một ngày → "Your day in {nơi} is booked."', () => {
    const v = view(voucherBooking({ paidAt: minutesBeforeNow(15) }), VOUCHER_NOW, VOUCHER_TODAY);
    expect(v.justPaid).toBe(true);
    expect(v.title).toBe('Your day in Hà Nội is booked.');
    expect(v.subtitle).toBe(
      'We’ve received booking BK-B6VCOQNW and a copy is on its way to erik.lund@example.com.',
    );
  });

  it('chuyến nhiều ngày → "Your trip to {nơi} is booked."', () => {
    const v = view(
      voucherBooking({ ...THREE_DAYS, paidAt: minutesBeforeNow(15) }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(v.title).toBe('Your trip to Hà Nội is booked.');
  });

  it('{nơi} là điểm đến ĐẦU TIÊN; tour không có điểm đến thì dùng tên tour', () => {
    // Fixture có hai điểm đến (Hà Nội, Ninh Bình): lấy nhầm điểm cuối là ca này đỏ.
    expect(view(voucherBooking(), VOUCHER_NOW, VOUCHER_TODAY).place).toBe('Hà Nội');
    const bare = view(
      voucherBooking({ tourDestinations: [], paidAt: minutesBeforeNow(1) }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(bare.place).toBe('Hanoi Heritage in a Day');
    expect(bare.title).toBe('Your day in Hanoi Heritage in a Day is booked.');
  });

  it(`đúng ${VOUCHER_FRESH_MINUTES} phút vẫn là vừa trả; lẻ thêm 1 ms là mở lại`, () => {
    const edge = VOUCHER_NOW.getTime() - VOUCHER_FRESH_MINUTES * 60_000;
    const atEdge = voucherBooking({ paidAt: new Date(edge).toISOString() });
    expect(view(atEdge, VOUCHER_NOW, VOUCHER_TODAY).justPaid).toBe(true);

    const late = view(
      voucherBooking({ paidAt: new Date(edge - 1).toISOString() }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(late.justPaid).toBe(false);
    expect(late.title).toBe('Your trip voucher');
    // "Booked on" là ngày ĐẶT (18/10), không phải ngày trả (20/10).
    expect(late.subtitle).toBe('Booked on 18 Oct 2026 · a copy went to erik.lund@example.com');
  });

  it('paidAt nhanh hơn đồng hồ web vài giây vẫn là vừa trả', () => {
    const ahead = voucherBooking({ paidAt: minutesBeforeNow(-0.1) });
    expect(view(ahead, VOUCHER_NOW, VOUCHER_TODAY).justPaid).toBe(true);
  });

  it('chỉ PAID mới là vừa trả — PARTIALLY_REFUNDED trả 10 phút trước vẫn là mở lại', () => {
    const partly = voucherBooking({
      status: 'PARTIALLY_REFUNDED',
      refundedTotal: '49.00',
      paidAt: minutesBeforeNow(10),
    });
    expect(view(partly, VOUCHER_NOW, VOUCHER_TODAY).justPaid).toBe(false);
  });
});

describe('voucherView — trường dùng chung của hai cột', () => {
  it('chuyến một ngày: ngày đi một mốc, 1 ngày, cổng PayPal, ngày trả', () => {
    const v = view(voucherBooking(), VOUCHER_NOW, VOUCHER_TODAY);
    expect([v.departure, v.tripDays, v.provider, v.paidOn]).toEqual([
      '3 Nov 2026',
      1,
      'PayPal',
      '18 Oct 2026',
    ]);
  });

  it('chuyến ba ngày trả bằng thẻ: khoảng ngày, 3 ngày, "Card (Stripe)", ngày TRẢ', () => {
    // paidAt 19/10 khác createdAt 18/10 CHỈ để phân biệt hai mốc.
    const v = view(
      voucherBooking({
        ...THREE_DAYS,
        paymentProvider: 'STRIPE',
        paidAt: '2026-10-19T03:00:00.000Z',
      }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect([v.departure, v.tripDays, v.provider, v.paidOn]).toEqual([
      '3–5 Nov 2026',
      3,
      'Card (Stripe)',
      '19 Oct 2026',
    ]);
  });
});

describe('voucherView — sắp đi (upcoming)', () => {
  it('ô mã, mã vạch và ba dòng điều kiện đúng thứ tự bảng §2.6', () => {
    const v = view(voucherBooking(), VOUCHER_NOW, VOUCHER_TODAY);
    expect(v.phase).toBe('upcoming');
    expect([v.showCode, v.showBarcode, v.cancelledNotice]).toEqual([true, true, null]);
    expect(v.conditions).toEqual([
      SHOW_CODE,
      'Free cancellation until 2 Nov, 11:59 pm Vietnam time. No refund after that.',
      TAXES,
    ]);
  });

  it('nhật ký: Booked and paid ✓ · Free cancellation ends · Pickup day', () => {
    expect(view(voucherBooking(), VOUCHER_NOW, VOUCHER_TODAY).journal).toEqual([
      { label: 'Booked and paid', detail: '18 Oct 2026 · PayPal', done: true },
      { label: 'Free cancellation ends', detail: '2 Nov, 11:59 pm Vietnam time', done: false },
      { label: 'Pickup day', detail: '3 Nov 2026 · Hà Nội', done: false },
    ]);
  });

  it('server nói đã quá hạn huỷ: bỏ dòng hạn huỷ, mốc nhật ký thành "Free cancellation ended" ✓', () => {
    // Chuyến 22–24/10, N = 3 → hạn chót 19/10; hôm nay 20/10 vẫn chưa đi.
    const v = view(
      voucherBooking({
        departureStartDate: '2026-10-22',
        departureEndDate: '2026-10-24',
        cancellationDeadline: '2026-10-19',
        cancellation: {
          deadline: '2026-10-19',
          withinDeadline: false,
          refundAmount: '0.00',
          canCancel: true,
        },
      }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(v.phase).toBe('upcoming');
    expect(v.conditions).toEqual([SHOW_CODE, TAXES]);
    expect(v.journal[1]).toEqual({
      label: 'Free cancellation ended',
      detail: '19 Oct, 11:59 pm Vietnam time',
      done: true,
    });
  });

  it('vắng cờ server thì so ngày chót với hôm nay của server — đúng ngày chót vẫn còn hạn', () => {
    const passed = voucherBooking({
      departureStartDate: '2026-10-22',
      departureEndDate: '2026-10-24',
      cancellationDeadline: '2026-10-19',
      cancellation: null,
    });
    expect(view(passed, VOUCHER_NOW, VOUCHER_TODAY).journal[1]?.label).toBe(
      'Free cancellation ended',
    );

    // Chuyến 23–25/10 → hạn chót 20/10 = hôm nay: hạn hết lúc 23:59 nên vẫn còn.
    const lastDay = voucherBooking({
      departureStartDate: '2026-10-23',
      departureEndDate: '2026-10-25',
      cancellationDeadline: '2026-10-20',
      cancellation: null,
    });
    expect(view(lastDay, VOUCHER_NOW, VOUCHER_TODAY).journal[1]?.label).toBe(
      'Free cancellation ends',
    );
  });
});

describe('voucherView — đang đi (on_tour)', () => {
  it('còn mã và mã vạch; điều kiện bỏ hạn huỷ; nhật ký Trip started ✓ · Trip ends', () => {
    // `now` vẫn là 20/10 — chỉ dùng để đo "vừa trả"; giai đoạn đọc theo `today`.
    const v = view(voucherBooking({ ...THREE_DAYS, cancellation: PASSED }), VOUCHER_NOW, '2026-11-04');
    expect(v.phase).toBe('on_tour');
    expect([v.showCode, v.showBarcode]).toEqual([true, true]);
    expect(v.conditions).toEqual([SHOW_CODE, TAXES]);
    expect(v.journal).toEqual([
      { label: 'Booked and paid', detail: '18 Oct 2026 · PayPal', done: true },
      { label: 'Trip started', detail: '3 Nov 2026', done: true },
      { label: 'Trip ends', detail: '5 Nov 2026', done: false },
    ]);
  });
});

describe('voucherView — đã đi (travelled)', () => {
  const AFTER = '2026-11-10';

  it('còn ô mã nhưng KHÔNG mã vạch; chỉ còn dòng giá đã gồm thuế phí', () => {
    const v = view(voucherBooking({ ...THREE_DAYS, cancellation: PASSED }), VOUCHER_NOW, AFTER);
    expect(v.phase).toBe('travelled');
    expect([v.showCode, v.showBarcode]).toEqual([true, false]);
    expect(v.conditions).toEqual([TAXES]);
  });

  it('chưa viết review → mục cuối "Write a review" mời viết', () => {
    const v = view(voucherBooking({ ...THREE_DAYS, cancellation: PASSED }), VOUCHER_NOW, AFTER);
    expect(v.journal).toEqual([
      { label: 'Booked and paid', detail: '18 Oct 2026 · PayPal', done: true },
      { label: 'Travelled', detail: '3–5 Nov 2026', done: true },
      { label: 'Write a review', detail: 'Tell other travellers how it went.', done: false },
    ]);
  });

  it('đã viết review → "Reviewed" ✓ kèm ngày viết', () => {
    const v = view(
      voucherBooking({ ...THREE_DAYS, cancellation: PASSED, reviewedAt: '2026-11-07T08:00:00.000Z' }),
      VOUCHER_NOW,
      AFTER,
    );
    expect(v.journal[2]).toEqual({ label: 'Reviewed', detail: '7 Nov 2026', done: true });
  });

  it('PARTIALLY_REFUNDED chưa review → không mời viết (API chỉ nhận review của đơn PAID)', () => {
    const v = view(
      voucherBooking({
        ...THREE_DAYS,
        cancellation: PASSED,
        status: 'PARTIALLY_REFUNDED',
        refundedTotal: '49.00',
      }),
      VOUCHER_NOW,
      AFTER,
    );
    expect(v.journal.map((item) => item.label)).toEqual(['Booked and paid', 'Travelled']);
  });
});

describe('voucherView — đã huỷ (cancelled)', () => {
  it('không ô mã, không mã vạch, không điều kiện — dải "no longer valid" thay chỗ', () => {
    const v = view(voucherBooking(CANCELLED), VOUCHER_NOW, VOUCHER_TODAY);
    expect(v.phase).toBe('cancelled');
    expect([v.showCode, v.showBarcode, v.conditions]).toEqual([false, false, []]);
    expect(v.cancelledNotice).toBe('This booking was cancelled — this voucher is no longer valid.');
  });

  it('nhật ký: Booked ✓ · Cancelled ✓ (ngày cancelledAt) · Refund chưa có đồng nào', () => {
    expect(view(voucherBooking(CANCELLED), VOUCHER_NOW, VOUCHER_TODAY).journal).toEqual([
      { label: 'Booked', detail: '18 Oct 2026', done: true },
      { label: 'Cancelled', detail: '1 Nov 2026', done: true },
      { label: 'Refund', detail: 'No refund was due on this booking.', done: false },
    ]);
  });

  it('REFUNDED đủ: Refund ✓ in đủ hai số lẻ; thiếu cancelledAt thì lấy ngày quyết huỷ', () => {
    const v = view(
      voucherBooking({
        status: 'REFUNDED',
        cancellation: null,
        refundedTotal: '147.00',
        cancelledAt: null,
        cancellationDecidedAt: '2026-10-25T02:00:00.000Z',
      }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(v.journal.slice(1)).toEqual([
      { label: 'Cancelled', detail: '25 Oct 2026', done: true },
      {
        label: 'Refund',
        detail: '$147.00 has been refunded to your original payment method.',
        done: true,
      },
    ]);
  });

  it('chỉ còn ngày gửi yêu cầu huỷ thì mục Cancelled lấy ngày đó', () => {
    const v = view(
      voucherBooking({
        ...CANCELLED,
        cancelledAt: null,
        cancellationDecidedAt: null,
        cancellationRequestedAt: '2026-10-24T02:00:00.000Z',
      }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(v.journal[1]).toEqual({ label: 'Cancelled', detail: '24 Oct 2026', done: true });
  });

  it('không mốc huỷ nào thì mục Cancelled không có dòng ngày', () => {
    const v = view(
      voucherBooking({
        ...CANCELLED,
        cancelledAt: null,
        cancellationDecidedAt: null,
        cancellationRequestedAt: null,
      }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(v.journal[1]).toEqual({ label: 'Cancelled', detail: null, done: true });
  });

  it('huỷ ngay trong 30 phút sau khi trả: không phải "vừa trả", không pháo giấy', () => {
    const v = view(
      voucherBooking({ ...CANCELLED, paidAt: minutesBeforeNow(10), cancelledAt: minutesBeforeNow(2) }),
      VOUCHER_NOW,
      VOUCHER_TODAY,
    );
    expect(v.justPaid).toBe(false);
    expect(v.title).toBe('Your trip voucher');
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/web test -- src/lib/voucher.spec.ts` — ĐỎ vì chưa có module
  `./voucher` (`Failed to resolve import "./voucher"`).

- [ ] **Bước 3. Chữ.** `libs/shared/i18n/src/lib/messages.ts`: thay đoạn cuối khối
  `cancellationDeadline` (chuỗi `ruleAfter` chỉ có đúng một chỗ trong file):

  old:

```ts
    ruleAfter: 'After that, bookings close and cancellations aren’t refunded.',
  },
  common: {
```

  new:

```ts
    ruleAfter: 'After that, bookings close and cancellations aren’t refunded.',
  },
  /**
   * Voucher `/checkout/success?code=` của đơn ĐÃ TRẢ (spec P7 §2.6, §6, §8) — thẻ chia đôi,
   * mảng teal. Chỉ khai chữ MỚI; nhãn đã có thì chỗ gọi dùng lại: "Total paid", "View
   * booking", "Browse more tours" (`booking.success`), "Includes all taxes and fees."
   * (`checkoutSummary.taxesNote`), câu hạn huỷ (`cancellationDeadline.full`), câu hoàn tiền
   * (`accountBookingDetail.refundLine`), chế độ thử (`tourDetail.booking.testMode`), chữ trên
   * mộc (`passportVisa.stampByStatus`).
   */
  voucher: {
    /** Vừa trả (≤ 30 phút sau `paidAt`), chuyến một ngày. `place`: điểm đến đầu tiên, không có thì tên tour. */
    freshDayTitle: (place: string) => `Your day in ${place} is booked.`,
    /** Vừa trả, chuyến nhiều ngày. */
    freshTripTitle: (place: string) => `Your trip to ${place} is booked.`,
    /**
     * Dòng phụ lúc vừa trả. "on its way" chứ không "emailed" như bản vẽ: email xác nhận đi qua
     * outbox (enqueue cùng transaction với PAID, worker gửi sau), lúc trang render có thể chưa đi.
     */
    freshSub: (code: string, email: string) =>
      `We’ve received booking ${code} and a copy is on its way to ${email}.`,
    /** Mở lại về sau — không chúc mừng, không hứa email "đang tới". */
    reopenedTitle: 'Your trip voucher',
    reopenedSub: (date: string, email: string) => `Booked on ${date} · a copy went to ${email}`,
    /** Dòng nhỏ trên ảnh bìa. */
    photoKicker: (place: string, days: number) =>
      `${place} · ${days} ${days === 1 ? 'day' : 'days'}`,
    /** Chip kính mờ: "2 adults, 1 child × $49" — `party` từ `accountBookings.travellers`. */
    partyPrice: (party: string, price: string) => `${party} × ${price}`,
    meetingPoint: 'Meeting point',
    /** Tour đã gỡ (hoặc chưa ghi điểm hẹn): email xác nhận đã mang chi tiết. */
    meetingPointFallback: 'Details are in your confirmation email.',
    paidWith: (provider: string) => `Paid with ${provider}`,
    leadTraveller: 'Lead traveller',
    needHelp: 'Need help?',
    /** Câu trước link — chỗ gọi nối `contactUs` (link `/contact`) và dấu chấm. */
    needHelpBody: 'Reply to the confirmation email, or',
    contactUs: 'contact us',
    codeLabel: 'Booking code',
    /** Tổng số khách (người lớn và trẻ em) — kiểu vé vào cổng. */
    admit: (n: number) => `Admit ${n}`,
    showCode: 'Show this code at pickup — printed or on your phone.',
    /** Dải thay ô mã khi đơn đã huỷ: không còn mã nào để chìa ra. */
    cancelledNotice: 'This booking was cancelled — this voucher is no longer valid.',
    receiptHeading: 'Receipt overview',
    refunded: 'Refunded',
    /** Số tiền đã định dạng (`formatMoneyExact`); dấu trừ là U+2212. */
    refundedAmount: (amount: string) => `−${amount}`,
    journal: {
      heading: 'Trip journal',
      /** Nhãn cho trình đọc màn hình của dấu tích trên mốc đã xong. */
      done: 'Done',
      booked: 'Booked',
      bookedAndPaid: 'Booked and paid',
      freeCancellationEnds: 'Free cancellation ends',
      /** Sắp đi mà đã quá hạn chót — mốc đã qua, không còn là "ends". */
      freeCancellationEnded: 'Free cancellation ended',
      /** `date` từ `formatChipDate` — cùng giờ chốt với `cancellationDeadline.full`. */
      deadlineAt: (date: string) => `${date}, 11:59 pm Vietnam time`,
      pickupDay: 'Pickup day',
      tripStarted: 'Trip started',
      tripEnds: 'Trip ends',
      travelled: 'Travelled',
      writeReview: 'Write a review',
      reviewed: 'Reviewed',
      cancelled: 'Cancelled',
      refund: 'Refund',
    },
  },
  common: {
```

  Build lại contract và i18n (lệnh ở Ràng buộc toàn cục).

- [ ] **Bước 4. Cài.** Tạo `apps/web/src/lib/voucher.ts`:

```ts
import {
  type BookingDetail,
  type BookingPhase,
  bookingPhase,
  tripLengthDays,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { paymentProviderLabel, type RefundSummary, refundSummary } from './booking-vm';
import { formatChipDate, formatDate, formatDateRange, formatMoneyExact } from './tours';

/**
 * Voucher còn "vừa trả tiền" trong bao nhiêu phút kể từ `paidAt` (spec P7 §2.6).
 *
 * Trong khoảng này trang chào "… is booked." và bắn pháo giấy; quá nó là khách MỞ LẠI voucher
 * (từ email, từ "View voucher") — lúc ấy chúc mừng hay hứa "email đang tới" là nói sai. Đo bằng
 * đồng hồ của server web lúc render, không bằng đồng hồ máy khách.
 */
export const VOUCHER_FRESH_MINUTES = 30;

/** Đơn đã có `paidAt` chỉ rơi vào bốn giai đoạn này (`awaiting_payment`, `lapsed` là của PENDING). */
export type VoucherPhase = Extract<BookingPhase, 'upcoming' | 'on_tour' | 'travelled' | 'cancelled'>;

/** Một mốc của "Trip journal" ở mảng teal. */
export interface VoucherJournalItem {
  label: string;
  /** Dòng nhỏ dưới nhãn (ngày, cổng, số tiền) — `null` khi không có gì đáng in. */
  detail: string | null;
  /** Mốc đã xảy ra: vẽ dấu tích. */
  done: boolean;
}

/** Mọi thứ hai cột của voucher cần, tính sẵn một lần ở server (spec P7 §2.6, §6). */
export interface VoucherView {
  phase: VoucherPhase;
  /** Vừa trả tiền: tiêu đề "… is booked." và pháo giấy. */
  justPaid: boolean;
  title: string;
  subtitle: string;
  /** Điểm đến đầu tiên của tour; tour không có điểm đến thì là tên tour. */
  place: string;
  /** Số ngày của chuyến, tính cả ngày đi lẫn ngày về. */
  tripDays: number;
  /** Ngày đi — một ngày ("3 Nov 2026") hoặc một khoảng ("3–5 Nov 2026"). */
  departure: string;
  /** Tên cổng thanh toán như trang chi tiết đơn in ("PayPal", "Card (Stripe)"). */
  provider: string;
  /** Ngày trả tiền đã định dạng. */
  paidOn: string;
  /** Có ô mã đơn (kèm ngày đi, "Admit n", dòng điều kiện) — đơn đã huỷ thì không. */
  showCode: boolean;
  /** Có mã vạch — chỉ khi mã còn để chìa ra ở điểm đón (sắp đi, đang đi). */
  showBarcode: boolean;
  /** Các dòng điều kiện có dấu tích dưới ô mã, đúng thứ tự bảng §2.6. */
  conditions: string[];
  /** Ba mốc nhật ký (hai khi mốc cuối không có gì thật để nói). */
  journal: VoucherJournalItem[];
  /** Dải thay ô mã khi đơn đã huỷ; `null` ở các giai đoạn còn hiệu lực. */
  cancelledNotice: string | null;
}

/**
 * Ngày lịch của một mốc ISO — cùng quy ước `formatDate(x.slice(0, 10))` của trang chi tiết đơn
 * và hoá đơn, để một đơn không hiện hai ngày đặt khác nhau ở hai trang.
 */
function calendarDay(iso: string): string {
  return iso.slice(0, 10);
}

/** Câu hoàn tiền: dùng lại nguyên văn khối `refundLine` của trang chi tiết đơn. */
function refundDetail(refund: RefundSummary, currency: string): string {
  const t = messages.accountBookingDetail.refundLine;
  switch (refund.kind) {
    case 'full':
      return t.full(formatMoneyExact(refund.amount, currency));
    case 'partial':
      return t.partial(
        formatMoneyExact(refund.amount, currency),
        formatMoneyExact(refund.total, currency),
      );
    case 'none':
      return t.none;
  }
}

/**
 * Bảng quyết định của voucher `/checkout/success` (spec P7 §2.6) — hàm THUẦN, component chỉ vẽ.
 *
 * Trả `null` khi đơn chưa có `paidAt`: đơn PENDING đang chờ webhook, hay giữ chỗ đã hết hạn rồi
 * bị huỷ khi chưa trả. Những đơn ấy giữ nguyên hoá đơn chờ (`BookingReceipt`) — mã của chúng
 * chưa bao giờ là voucher.
 *
 * `today` là ngày lịch Việt Nam do server tính (`todayDateString`); giai đoạn đọc qua
 * `bookingPhase` của contract như mọi trang đơn của đợt P7. `now` chỉ để đo 30 phút "vừa trả".
 */
export function voucherView(booking: BookingDetail, now: Date, today: string): VoucherView | null {
  const paidAt = booking.paidAt;
  if (paidAt === null) return null;
  const phase = bookingPhase(booking, today);
  // Không xảy ra với đơn đã có `paidAt`; nhánh này thu hẹp kiểu cho `switch` bên dưới.
  if (phase === 'awaiting_payment' || phase === 'lapsed') return null;

  const t = messages.voucher;
  const place = booking.tourDestinations[0]?.name ?? booking.tourTitle;
  const isDayTrip = booking.departureStartDate === booking.departureEndDate;
  const departure = isDayTrip
    ? formatDate(booking.departureStartDate)
    : formatDateRange(booking.departureStartDate, booking.departureEndDate);
  const paidOn = formatDate(calendarDay(paidAt));
  const provider = paymentProviderLabel(booking.paymentProvider);
  // Chỉ PAID: đơn đã huỷ hay đã hoàn một phần trong 30 phút đầu không có gì để chúc mừng.
  // Hiệu âm (đồng hồ API nhanh hơn web vài giây) vẫn là vừa trả.
  const justPaid =
    booking.status === 'PAID' &&
    now.getTime() - Date.parse(paidAt) <= VOUCHER_FRESH_MINUTES * 60_000;

  const common = {
    justPaid,
    title: justPaid
      ? isDayTrip
        ? t.freshDayTitle(place)
        : t.freshTripTitle(place)
      : t.reopenedTitle,
    subtitle: justPaid
      ? t.freshSub(booking.code, booking.contactEmail)
      : t.reopenedSub(formatDate(calendarDay(booking.createdAt)), booking.contactEmail),
    place,
    tripDays: tripLengthDays(booking.departureStartDate, booking.departureEndDate),
    departure,
    provider,
    paidOn,
  };
  const bookedAndPaid: VoucherJournalItem = {
    label: t.journal.bookedAndPaid,
    detail: `${paidOn} · ${provider}`,
    done: true,
  };
  const taxes = messages.checkoutSummary.taxesNote;

  switch (phase) {
    case 'upcoming': {
      // Cờ SERVER trước (`bookings.byCode.cancellation`, ADR-0041 §7); vắng thì so ngày chót
      // với hôm nay của server — cùng luật `isWithinDeadline` (ngày chót tính cả ngày).
      const withinDeadline =
        booking.cancellation?.withinDeadline ?? today <= booking.cancellationDeadline;
      const deadline = formatChipDate(booking.cancellationDeadline);
      return {
        ...common,
        phase,
        showCode: true,
        showBarcode: true,
        // Quá hạn thì BỎ dòng hạn huỷ: một dấu tích cạnh "đã hết hạn" đọc như một quyền lợi.
        conditions: withinDeadline
          ? [t.showCode, messages.cancellationDeadline.full(deadline), taxes]
          : [t.showCode, taxes],
        journal: [
          bookedAndPaid,
          {
            label: withinDeadline ? t.journal.freeCancellationEnds : t.journal.freeCancellationEnded,
            detail: t.journal.deadlineAt(deadline),
            done: !withinDeadline,
          },
          {
            label: t.journal.pickupDay,
            detail: `${formatDate(booking.departureStartDate)} · ${place}`,
            done: false,
          },
        ],
        cancelledNotice: null,
      };
    }
    case 'on_tour':
      return {
        ...common,
        phase,
        showCode: true,
        showBarcode: true,
        conditions: [t.showCode, taxes],
        journal: [
          bookedAndPaid,
          {
            label: t.journal.tripStarted,
            detail: formatDate(booking.departureStartDate),
            done: true,
          },
          { label: t.journal.tripEnds, detail: formatDate(booking.departureEndDate), done: false },
        ],
        cancelledNotice: null,
      };
    case 'travelled': {
      // "Write a review" chỉ cho PAID — cổng `checkReviewEligibility` của API nhận đúng PAID.
      // Đơn đã hoàn một phần chưa viết gì thì không có mốc thứ ba nào nói thật được.
      const review: VoucherJournalItem[] =
        booking.reviewedAt !== null
          ? [
              {
                label: t.journal.reviewed,
                detail: formatDate(calendarDay(booking.reviewedAt)),
                done: true,
              },
            ]
          : booking.status === 'PAID'
            ? [
                {
                  label: t.journal.writeReview,
                  detail: messages.accountBookingDetail.sections.reviewBlurb,
                  done: false,
                },
              ]
            : [];
      return {
        ...common,
        phase,
        showCode: true,
        // Chuyến đã xong: mã không còn để quét ở cổng nào.
        showBarcode: false,
        conditions: [taxes],
        journal: [bookedAndPaid, { label: t.journal.travelled, detail: departure, done: true }, ...review],
        cancelledNotice: null,
      };
    }
    case 'cancelled': {
      // `cancelledAt` có ở MỌI đường huỷ (khách huỷ, công ty huỷ chuyến, quét giữ chỗ);
      // `cancellationDecidedAt` rồi `cancellationRequestedAt` chỉ có khi đi qua yêu cầu huỷ —
      // dùng làm dự phòng, cùng thứ tự với thanh hành trình của trang chi tiết.
      const cancelledOn =
        booking.cancelledAt ?? booking.cancellationDecidedAt ?? booking.cancellationRequestedAt;
      const refund = refundSummary(booking);
      return {
        ...common,
        phase,
        showCode: false,
        showBarcode: false,
        conditions: [],
        journal: [
          { label: t.journal.booked, detail: formatDate(calendarDay(booking.createdAt)), done: true },
          {
            label: t.journal.cancelled,
            detail: cancelledOn === null ? null : formatDate(calendarDay(cancelledOn)),
            done: true,
          },
          ...(refund === null
            ? []
            : [
                {
                  label: t.journal.refund,
                  detail: refundDetail(refund, booking.currency),
                  // Không hoàn đồng nào thì chưa có gì "xảy ra" để đánh dấu.
                  done: refund.kind !== 'none',
                },
              ]),
        ],
        cancelledNotice: t.cancelledNotice,
      };
    }
  }
}
```

- [ ] **Bước 5.** Chạy lại spec — XANH. **Đột biến** (mỗi cái một lần, thấy đỏ, trả lại):
  `<=` thành `<` trong `justPaid` (ca "đúng 30 phút"); bỏ vế `booking.status === 'PAID'` của
  `justPaid` (ca PARTIALLY_REFUNDED và ca huỷ trong 30 phút); `tourDestinations[0]` thành
  `tourDestinations.at(-1)`; đảo hai nhánh `isDayTrip` của tiêu đề; `booking.createdAt` thành
  `paidAt` trong `reopenedSub` (ca 30 phút lẻ 1 ms); `paidOn` tính từ `createdAt` (ca ngày TRẢ
  19/10); `?? today <= booking.cancellationDeadline` thành `?? true` (ca vắng cờ server) và `<=`
  thành `<` (ca đúng ngày chót); luôn đưa dòng hạn huỷ vào `conditions` (ca quá hạn);
  `showBarcode: false` thành `true` ở `travelled`; bỏ vế `booking.status === 'PAID'` của mục
  "Write a review" (ca PARTIALLY_REFUNDED đã đi); đảo `cancelledAt ?? cancellationDecidedAt`
  (ca nhật ký huỷ: "1 Nov" thành "31 Oct"); bỏ vế `?? booking.cancellationRequestedAt` (ca
  chỉ còn ngày gửi yêu cầu); `done: refund.kind !== 'none'` thành `true` (ca
  không hoàn). Nhánh `awaiting_payment`/`lapsed` không giết được bằng test — gỡ nó thì
  `typecheck` đỏ vì `switch` hết vét cạn; ghi như vậy vào bàn giao.
- [ ] **Bước 6.** Chạy quy trình gate ở mục Ràng buộc toàn cục, rồi commit (stage
  `apps/web/src/lib/voucher.ts`, `apps/web/src/lib/voucher.spec.ts`,
  `apps/web/src/test/fixtures/voucher.ts`, `libs/shared/i18n/src/lib/messages.ts`):
  `feat(web): voucherView — luật vừa trả, mở lại và giai đoạn của voucher`

### Task 23 — C2 · Cột trái của voucher: mộc, tiêu đề, thẻ ảnh, bốn ô có icon, ô mã gọn cho điện thoại

**Files:**

- Create: `apps/web/src/components/checkout/voucher-code.tsx` (phủ qua spec của C2 và C3)
- Create: `apps/web/src/components/checkout/voucher-overview.tsx`
- Test: `apps/web/src/components/checkout/voucher-overview.spec.tsx`
- Modify: `apps/web/src/components/checkout/copy-code-button.tsx` (chỉ JSDoc, dòng 8–9)

**Interfaces:**

- Consumes: `voucherView`, `VoucherView` và fixture của C1; `CopyCodeButton({ code })`
  (`copy-code-button.tsx:13`); `VisaStamp({ status, tone })` (`passport/visa-stamp.tsx:22`);
  `SlotImage({ image, className, sizes, priority })` (`components/slot-image.tsx:28`);
  `bookingView(b)` → `tone` (`lib/booking-vm.ts:42`); `formatMoney` (`lib/tours.ts:424`);
  `messages.accountBookings.travellers` (`messages.ts:2433`),
  `messages.tourDetail.booking.testMode` (`:1563`), khối `messages.voucher` (C1).
- Produces: `VoucherCode({ code, className? })` — `data-slot="voucher-code"`;
  `VoucherCancelledNotice({ text, className? })` — `data-slot="voucher-cancelled"`;
  `VoucherOverview({ booking, view, meetingPoint })` — `data-slot="voucher-overview"`, thẻ ảnh
  `data-slot="voucher-photo"`.

- [ ] **Bước 1. Test trước.** Tạo `voucher-overview.spec.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { voucherView } from '@/lib/voucher';
import {
  openCancellation,
  VOUCHER_NOW,
  VOUCHER_TODAY,
  voucherBooking,
} from '@/test/fixtures/voucher';
import { VoucherOverview } from './voucher-overview';

/** Điểm hẹn dài của bản vẽ. */
const MEETING = 'Hotel pickup — hotels in Hoàn Kiếm, Ba Đình or Tây Hồ districts, Hà Nội';

/** Chuyến ba ngày, 2 người lớn và 1 trẻ em — chip khách (đơn giá $49) khác hẳn tổng ($147). */
const FAMILY_TRIP = {
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
  cancellationDeadline: '2026-10-31',
  cancellation: openCancellation('2026-10-31'),
  numAdults: 2,
  numChildren: 1,
};

/** Đơn đã trả rồi bị huỷ — voucher hết hiệu lực. */
const CANCELLED = {
  status: 'CANCELLED',
  cancellation: null,
  cancelledAt: '2026-10-19T08:00:00.000Z',
} as const;

function renderOverview(
  overrides: Partial<BookingDetail> = {},
  meetingPoint: string | null = MEETING,
) {
  const booking = voucherBooking(overrides);
  const view = voucherView(booking, VOUCHER_NOW, VOUCHER_TODAY);
  if (view === null) throw new Error('fixture phải là đơn đã trả');
  return render(<VoucherOverview booking={booking} view={view} meetingPoint={meetingPoint} />);
}

function slot(container: HTMLElement, name: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-slot="${name}"]`);
  if (!el) throw new Error(`thiếu [data-slot="${name}"]`);
  return el;
}

describe('VoucherOverview — tiêu đề và mộc', () => {
  it('tiêu đề là h2 (hero giữ h1 duy nhất), dòng phụ ngay dưới', () => {
    const { container } = renderOverview();
    expect(screen.getByRole('heading', { level: 2, name: 'Your trip voucher' })).toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(0);
    expect(
      screen.getByText('Booked on 18 Oct 2026 · a copy went to erik.lund@example.com'),
    ).toBeInTheDocument();
  });

  it('mộc theo trạng thái: CONFIRMED khi PAID, CANCELLED khi đã huỷ', () => {
    const { unmount } = renderOverview();
    expect(screen.getByText(messages.passportVisa.stampByStatus.PAID)).toBeInTheDocument();
    unmount();

    renderOverview(CANCELLED);
    expect(screen.getByText(messages.passportVisa.stampByStatus.CANCELLED)).toBeInTheDocument();
    expect(screen.queryByText(messages.passportVisa.stampByStatus.PAID)).toBeNull();
  });
});

describe('VoucherOverview — thẻ ảnh', () => {
  it('dòng "{nơi} · {D} days", tên tour, tổng đã trả và hai chip kính mờ', () => {
    const { container } = renderOverview(FAMILY_TRIP);
    const photo = within(slot(container, 'voucher-photo'));
    expect(photo.getByText('Hà Nội · 3 days')).toBeInTheDocument();
    expect(photo.getByText('Hanoi Heritage in a Day')).toBeInTheDocument();
    expect(photo.getByText('$147')).toBeInTheDocument();
    expect(photo.getByText('3–5 Nov 2026')).toBeInTheDocument();
    // Đơn giá ($49), KHÔNG phải tổng ($147).
    expect(photo.getByText('2 adults, 1 child × $49')).toBeInTheDocument();
  });

  it('chuyến một ngày: "1 day" số ít', () => {
    const { container } = renderOverview();
    expect(within(slot(container, 'voucher-photo')).getByText('Hà Nội · 1 day')).toBeInTheDocument();
  });
});

describe('VoucherOverview — bốn ô có icon', () => {
  it('Meeting point in nguyên văn dữ liệu tour', () => {
    renderOverview();
    expect(screen.getByText('Meeting point')).toBeInTheDocument();
    expect(screen.getByText(MEETING)).toBeInTheDocument();
  });

  it('tour đã gỡ (không có điểm hẹn) → chỉ sang email xác nhận', () => {
    renderOverview({}, null);
    expect(screen.getByText('Details are in your confirmation email.')).toBeInTheDocument();
  });

  it('Paid with {cổng}: ngày trả · ghi chú chế độ thử', () => {
    renderOverview();
    expect(screen.getByText('Paid with PayPal')).toBeInTheDocument();
    expect(
      screen.getByText(`18 Oct 2026 · ${messages.tourDetail.booking.testMode}`),
    ).toBeInTheDocument();
  });

  it('Lead traveller: họ tên · email', () => {
    renderOverview();
    expect(screen.getByText('Lead traveller')).toBeInTheDocument();
    expect(screen.getByText('Erik Lund · erik.lund@example.com')).toBeInTheDocument();
  });

  it('Need help? — link "contact us" tới /contact', () => {
    renderOverview();
    expect(screen.getByText('Need help?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'contact us' })).toHaveAttribute('href', '/contact');
  });
});

describe('VoucherOverview — ô mã gọn cho điện thoại (spec §6.4)', () => {
  it('có nhãn, mã và nút chép; giấu ở màn rộng và khi in (mảng teal mang ô mã ở đó)', () => {
    const { container } = renderOverview();
    const code = slot(container, 'voucher-code');
    expect(within(code).getByText('Booking code')).toBeInTheDocument();
    expect(within(code).getByText('BK-B6VCOQNW')).toBeInTheDocument();
    expect(
      within(code).getByRole('button', { name: messages.booking.success.copyCode }),
    ).toBeInTheDocument();
    expect(code.classList.contains('md:hidden')).toBe(true);
    expect(code.classList.contains('print:hidden')).toBe(true);
  });

  it('đơn đã huỷ: không có mã nào, dải hết hiệu lực thay chỗ (cũng chỉ trên điện thoại)', () => {
    const { container } = renderOverview(CANCELLED);
    expect(screen.queryByText('BK-B6VCOQNW')).toBeNull();
    const notice = slot(container, 'voucher-cancelled');
    expect(notice.textContent).toBe('This booking was cancelled — this voucher is no longer valid.');
    expect(notice.classList.contains('md:hidden')).toBe(true);
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/web test -- src/components/checkout/voucher-overview.spec.tsx`
  — ĐỎ vì chưa có module `./voucher-overview`.

- [ ] **Bước 3. Cài ô mã.** Tạo `voucher-code.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { CopyCodeButton } from '@/components/checkout/copy-code-button';

/**
 * Ô mã đơn của voucher (spec P7 §6.3–6.4) — MỘT linh kiện cho hai chỗ: ô gọn ngay dưới tiêu
 * đề trên điện thoại (`VoucherOverview`) và ô đầu mảng teal trên màn rộng (`VoucherPass`).
 * Chỗ gọi chọn bản nào hiện bằng class responsive truyền qua `className`.
 *
 * Nút chép giấu khi in: bấm vào giấy thì không được (spec §6.4).
 */
export function VoucherCode({ code, className }: { code: string; className?: string }) {
  return (
    <div
      data-slot="voucher-code"
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-3 py-2.5',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground uppercase">
          {messages.voucher.codeLabel}
        </p>
        <p className="mt-1.5 font-mono text-xl font-semibold tracking-[0.1em]">{code}</p>
      </div>
      <div className="shrink-0 print:hidden">
        <CopyCodeButton code={code} />
      </div>
    </div>
  );
}

/**
 * Dải thay ô mã khi đơn đã huỷ (spec §2.6): voucher hết hiệu lực nên không còn mã nào để chìa
 * ra, và mã vạch — thứ nói "quét tôi ở cổng" — cũng không được vẽ.
 */
export function VoucherCancelledNotice({ text, className }: { text: string; className?: string }) {
  return (
    <p
      data-slot="voucher-cancelled"
      className={cn(
        'rounded-xl border border-dashed border-muted-foreground bg-muted px-3 py-2.5 text-sm font-medium',
        className,
      )}
    >
      {text}
    </p>
  );
}
```

- [ ] **Bước 4. Cài cột trái.** Tạo `voucher-overview.tsx`:

```tsx
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  CalendarIcon,
  CreditCardIcon,
  MapPinIcon,
  MessageSquareIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { VoucherCancelledNotice, VoucherCode } from '@/components/checkout/voucher-code';
import { VisaStamp } from '@/components/passport/visa-stamp';
import { SlotImage } from '@/components/slot-image';
import { bookingView } from '@/lib/booking-vm';
import { formatMoney } from '@/lib/tours';
import type { VoucherView } from '@/lib/voucher';

/**
 * Cột trái của voucher (spec P7 §6.2, cách "A" của bản vẽ `booking-voucher.src.html`): mộc
 * trạng thái, tiêu đề và dòng phụ theo `voucherView`, thẻ ảnh bìa lớn, lưới bốn ô có icon.
 *
 * Tiêu đề là `h2` — `h1` duy nhất của trang là tên tour ở hero (cùng lý do `BookingReceipt`).
 *
 * Trên điện thoại ô mã bản gọn đứng ngay dưới tiêu đề: khách mở voucher ở điểm đón cần thấy mã
 * trước tiên, còn mảng teal (mang ô mã của màn rộng) nằm cuối trang (spec §6.4).
 */
export function VoucherOverview({
  booking,
  view,
  meetingPoint,
}: {
  booking: BookingDetail;
  view: VoucherView;
  /** Điểm hẹn của tour (`fetchTourDetail`); `null` khi tour đã gỡ hoặc chưa ghi điểm hẹn. */
  meetingPoint: string | null;
}) {
  const t = messages.voucher;
  return (
    <div data-slot="voucher-overview" className="p-6 md:px-10 md:pt-8 md:pb-9">
      {/* Điện thoại: mộc đứng trên tiêu đề (cột đảo chiều). Từ `sm` mộc sang phải, CÙNG HÀNG
          tiêu đề — không đặt tuyệt đối như bản vẽ: cột trái ở 1280px chỉ còn ~500px chữ (lề
          ngang khớp hero), mộc tuyệt đối sẽ đè lên tiêu đề hai dòng. */}
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-lg">
          <h2 className="font-heading text-2xl leading-tight font-semibold text-balance md:text-3xl">
            {view.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{view.subtitle}</p>
        </div>
        <div className="shrink-0 self-start sm:pt-1">
          <VisaStamp status={booking.status} tone={bookingView(booking).tone} />
        </div>
      </div>

      {view.showCode ? (
        <VoucherCode code={booking.code} className="mt-5 md:hidden print:hidden" />
      ) : view.cancelledNotice ? (
        <VoucherCancelledNotice
          text={view.cancelledNotice}
          className="mt-5 md:hidden print:hidden"
        />
      ) : null}

      <div
        data-slot="voucher-photo"
        className="relative mt-6 h-56 overflow-hidden rounded-3xl bg-muted md:h-72 print:h-44"
      >
        <SlotImage
          image={booking.tourImage}
          className="absolute inset-0"
          sizes="(min-width: 768px) 60vw, 100vw"
          priority
        />
        {/* Lớp tối mờ dần ở đáy để chữ sáng đọc được trên mọi ảnh. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-b from-transparent from-30% to-hero/90"
        />
        <div className="absolute inset-x-6 bottom-5 text-on-media">
          <p className="text-[10.5px] font-bold tracking-[0.16em] uppercase opacity-80">
            {t.photoKicker(view.place, view.tripDays)}
          </p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <p className="font-heading text-2xl leading-tight font-semibold">{booking.tourTitle}</p>
            <p className="shrink-0 font-mono text-xl font-semibold tabular-nums">
              {formatMoney(booking.totalAmount, booking.currency)}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <GlassChip icon={<CalendarIcon aria-hidden="true" />}>{view.departure}</GlassChip>
            <GlassChip icon={<UsersIcon aria-hidden="true" />}>
              {t.partyPrice(
                messages.accountBookings.travellers(booking.numAdults, booking.numChildren),
                formatMoney(booking.unitPrice, booking.currency),
              )}
            </GlassChip>
          </div>
        </div>
      </div>

      <div className="mt-4.5 grid gap-3 sm:grid-cols-2">
        <InfoCell icon={<MapPinIcon aria-hidden="true" />} title={t.meetingPoint}>
          {meetingPoint ?? t.meetingPointFallback}
        </InfoCell>
        <InfoCell icon={<CreditCardIcon aria-hidden="true" />} title={t.paidWith(view.provider)}>
          {`${view.paidOn} · ${messages.tourDetail.booking.testMode}`}
        </InfoCell>
        <InfoCell icon={<UserIcon aria-hidden="true" />} title={t.leadTraveller}>
          {`${booking.contactName} · ${booking.contactEmail}`}
        </InfoCell>
        <InfoCell icon={<MessageSquareIcon aria-hidden="true" />} title={t.needHelp}>
          {t.needHelpBody}{' '}
          <Link
            href="/contact"
            className="font-semibold text-primary-emphasis underline-offset-4 hover:underline"
          >
            {t.contactUs}
          </Link>
          .
        </InfoCell>
      </div>
    </div>
  );
}

/** Chip kính mờ trên ảnh — chữ `on-media` không lật theo theme vì nền luôn là ảnh tối. */
function GlassChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-on-media/30 bg-on-media/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm [&_svg]:size-3.5">
      {icon}
      {children}
    </span>
  );
}

/** Một ô của lưới 2×2: icon trong ô vuông nhạt, tiêu đề đậm, một dòng chữ phụ. */
function InfoCell({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2.375rem_minmax(0,1fr)] items-start gap-3 rounded-2xl border px-4 py-3.5">
      <span className="grid size-9.5 place-items-center rounded-xl bg-primary/10 text-primary-emphasis [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground wrap-anywhere">{children}</p>
      </div>
    </div>
  );
}
```

- [ ] **Bước 5. JSDoc.** `copy-code-button.tsx` dòng 8–9, thay:

```tsx
 * Nút chép mã đặt chỗ (booking code) vào clipboard, dùng cạnh khối voucher ở
 * `BookingReceipt`. Nhãn tự đổi `Copy code → Copied` trong 2 giây rồi quay lại
```

  bằng:

```tsx
 * Nút chép mã đặt chỗ (booking code) vào clipboard, dùng ở cuống `BookingReceipt` và ô mã
 * của voucher (`VoucherCode`). Nhãn tự đổi `Copy code → Copied` trong 2 giây rồi quay lại
```

- [ ] **Bước 6.** Chạy lại spec — XANH. **Đột biến**: `view.place` thành `booking.tourTitle` trong
  `photoKicker`; `view.tripDays` thành `1`; `booking.unitPrice` thành `booking.totalAmount` trong
  chip khách ("× $147"); `meetingPoint ?? …` thành luôn câu dự phòng; bỏ `md:hidden` của ô mã
  gọn; vẽ `VoucherCode` cả khi `showCode` là false (ca đã huỷ); `h2` thành `h1`.
- [ ] **Bước 7.** Chạy quy trình gate ở mục Ràng buộc toàn cục, rồi commit (stage ba file
  `voucher-code.tsx`, `voucher-overview.tsx`, `voucher-overview.spec.tsx` và
  `copy-code-button.tsx`):
  `feat(web): cột trái của voucher — thẻ ảnh, bốn ô thông tin, ô mã gọn cho điện thoại`

### Task 24 — C3 · Mảng teal: ô mã, điều kiện, mã vạch, Receipt overview, Trip journal

**Files:**

- Create: `apps/web/src/components/checkout/voucher-pass.tsx`
- Test: `apps/web/src/components/checkout/voucher-pass.spec.tsx`

**Interfaces:**

- Consumes: `VoucherView`, `VoucherJournalItem`, `voucherView` và fixture (C1); `VoucherCode`,
  `VoucherCancelledNotice` (C2); `bookingPriceLines(booking): PriceLine[]` (Phần A,
  `lib/checkout.ts`); `ticketBarcodeWidths(code)` (`lib/checkout.ts:122`); `formatMoney`,
  `formatMoneyExact` (`lib/tours.ts:424`, `:446`); `messages.booking.success.totalLabel`,
  `viewBooking`, `viewTours` (`messages.ts:421`, `:434`, `:432`); khối `messages.voucher`.
- Produces: `VoucherPass({ booking, view })` — `data-slot="voucher-pass"`; khối mã
  `data-slot="voucher-ticket"`, `voucher-meta`, `voucher-conditions`, `barcode` (dùng lại tên
  của cuống hoá đơn để ăn quy tắc in `print-color-adjust: exact` có sẵn), `voucher-receipt`,
  `voucher-journal`.

- [ ] **Bước 1. Test trước.** Tạo `voucher-pass.spec.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import type { BookingCancellation, BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { ticketBarcodeWidths } from '@/lib/checkout';
import { voucherView } from '@/lib/voucher';
import { VOUCHER_NOW, VOUCHER_TODAY, voucherBooking } from '@/test/fixtures/voucher';
import { VoucherPass } from './voucher-pass';

const CODE = 'BK-B6VCOQNW';

/** 2 người lớn + 1 trẻ em: "Admit 3" khác hẳn số người lớn, và có hai dòng tiền. */
const FAMILY = { numAdults: 2, numChildren: 1 };

/** Chuyến ba ngày 3–5/11 đã qua hạn huỷ — dùng cho ca đã đi. */
const PASSED: BookingCancellation = {
  deadline: '2026-10-31',
  withinDeadline: false,
  refundAmount: '0.00',
  canCancel: false,
};
const THREE_DAYS_PASSED = {
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
  cancellationDeadline: '2026-10-31',
  cancellation: PASSED,
};

function renderPass(overrides: Partial<BookingDetail> = {}, today = VOUCHER_TODAY) {
  const booking = voucherBooking(overrides);
  const view = voucherView(booking, VOUCHER_NOW, today);
  if (view === null) throw new Error('fixture phải là đơn đã trả');
  return render(<VoucherPass booking={booking} view={view} />);
}

function slot(container: HTMLElement, name: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-slot="${name}"]`);
  if (!el) throw new Error(`thiếu [data-slot="${name}"]`);
  return el;
}

function texts(elements: Iterable<Element>): (string | null)[] {
  return [...elements].map((el) => el.textContent);
}

describe('VoucherPass — khối mã (sắp đi)', () => {
  it('ô mã có nút chép; ngày đi và "Admit {tổng khách}"', () => {
    const { container } = renderPass(FAMILY);
    const ticket = within(slot(container, 'voucher-ticket'));
    expect(ticket.getByText(CODE)).toBeInTheDocument();
    expect(
      ticket.getByRole('button', { name: messages.booking.success.copyCode }),
    ).toBeInTheDocument();
    const meta = within(slot(container, 'voucher-meta'));
    expect(meta.getByText('3 Nov 2026')).toBeInTheDocument();
    expect(meta.getByText('Admit 3')).toBeInTheDocument();
  });

  it('ba dòng điều kiện đúng thứ tự bảng §2.6, mỗi dòng một dấu tích', () => {
    const { container } = renderPass();
    const items = slot(container, 'voucher-conditions').querySelectorAll('li');
    expect(texts(items)).toEqual([
      'Show this code at pickup — printed or on your phone.',
      'Free cancellation until 2 Nov, 11:59 pm Vietnam time. No refund after that.',
      'Includes all taxes and fees.',
    ]);
    for (const item of items) expect(item.querySelector('svg')).not.toBeNull();
  });

  it('mã vạch tất định theo mã đơn, ẩn khỏi trình đọc màn hình', () => {
    const { container } = renderPass();
    const barcode = slot(container, 'barcode');
    const widths = ticketBarcodeWidths(CODE);
    expect(barcode).toHaveAttribute('aria-hidden', 'true');
    const bars = [...barcode.querySelectorAll('span')];
    expect(bars.map((bar) => bar.style.width)).toEqual(widths.map((w) => `${w}px`));
  });

  it('ô mã giấu trên điện thoại (cột trái có ô gọn) nhưng hiện lại khi in', () => {
    const { container } = renderPass();
    const code = slot(container, 'voucher-code');
    expect(code.classList.contains('max-md:hidden')).toBe(true);
    expect(code.classList.contains('print:flex')).toBe(true);
    // Ngày, điều kiện và mã vạch vẫn cần trên điện thoại: khối KHÔNG giấu.
    expect(slot(container, 'voucher-ticket').classList.contains('max-md:hidden')).toBe(false);
  });
});

describe('VoucherPass — theo giai đoạn', () => {
  it('đã đi: còn mã, KHÔNG mã vạch, chỉ còn dòng giá đã gồm thuế phí', () => {
    const { container } = renderPass(THREE_DAYS_PASSED, '2026-11-10');
    expect(screen.getByText(CODE)).toBeInTheDocument();
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
    expect(texts(slot(container, 'voucher-conditions').querySelectorAll('li'))).toEqual([
      'Includes all taxes and fees.',
    ]);
  });

  it('đã huỷ: không mã, không Admit, không mã vạch — dải hết hiệu lực; khối giấu trên điện thoại', () => {
    const { container } = renderPass({
      status: 'CANCELLED',
      cancellation: null,
      cancelledAt: '2026-10-19T08:00:00.000Z',
    });
    expect(screen.queryByText(CODE)).toBeNull();
    expect(screen.queryByText('Admit 3')).toBeNull();
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
    const ticket = slot(container, 'voucher-ticket');
    expect(ticket.textContent).toBe('This booking was cancelled — this voucher is no longer valid.');
    // Cột trái đã nói điều này trên điện thoại; khi in thì hiện lại.
    expect(ticket.classList.contains('max-md:hidden')).toBe(true);
    expect(ticket.classList.contains('print:block')).toBe(true);
  });
});

describe('VoucherPass — Receipt overview', () => {
  it('các dòng tiền của bookingPriceLines rồi "Total paid"', () => {
    const { container } = renderPass(FAMILY);
    const receipt = slot(container, 'voucher-receipt');
    expect(
      within(receipt).getByRole('heading', { level: 3, name: 'Receipt overview' }),
    ).toBeInTheDocument();
    expect(texts(receipt.querySelectorAll('dt'))).toEqual(['2 adults', '1 child', 'Total paid']);
    expect(texts(receipt.querySelectorAll('dd'))).toEqual(['$98', '$49', '$147']);
  });

  it('PARTIALLY_REFUNDED: thêm "Refunded −{số tiền}" giữ đủ hai số lẻ', () => {
    const { container } = renderPass({ status: 'PARTIALLY_REFUNDED', refundedTotal: '73.50' });
    const receipt = slot(container, 'voucher-receipt');
    expect(texts(receipt.querySelectorAll('dt'))).toEqual(['3 adults', 'Total paid', 'Refunded']);
    // Dấu trừ U+2212, không phải gạch nối.
    expect(texts(receipt.querySelectorAll('dd'))).toEqual(['$147', '$147', '−$73.50']);
  });

  it('chưa hoàn đồng nào (refundedTotal 0.00) thì không có dòng Refunded', () => {
    const { container } = renderPass();
    expect(within(slot(container, 'voucher-receipt')).queryByText('Refunded')).toBeNull();
  });
});

describe('VoucherPass — Trip journal', () => {
  it('ba mốc đúng thứ tự; mốc đã xong mang dấu "Done" cho trình đọc màn hình, mốc chưa tới thì không', () => {
    const { container } = renderPass();
    const journal = slot(container, 'voucher-journal');
    expect(
      within(journal).getByRole('heading', { level: 3, name: 'Trip journal' }),
    ).toBeInTheDocument();
    const items = [...journal.querySelectorAll('li')];
    expect(items.map((li) => li.querySelector('p')?.textContent)).toEqual([
      'Booked and paid',
      'Free cancellation ends',
      'Pickup day',
    ]);
    expect(within(items[0]!).getByRole('img', { name: 'Done' })).toBeInTheDocument();
    expect(within(items[0]!).getByText('18 Oct 2026 · PayPal')).toBeInTheDocument();
    expect(within(items[1]!).queryByRole('img', { name: 'Done' })).toBeNull();
    expect(within(items[2]!).queryByRole('img', { name: 'Done' })).toBeNull();
  });
});

describe('VoucherPass — lối đi tiếp', () => {
  it('"View booking" tới trang chi tiết đơn, "Browse more tours" tới /tours; cả hai giấu khi in', () => {
    renderPass();
    const viewBooking = screen.getByRole('link', { name: messages.booking.success.viewBooking });
    expect(viewBooking).toHaveAttribute('href', `/account/bookings/${CODE}`);
    const browse = screen.getByRole('link', { name: messages.booking.success.viewTours });
    expect(browse).toHaveAttribute('href', '/tours');
    expect(viewBooking.classList.contains('print:hidden')).toBe(true);
    expect(browse.classList.contains('print:hidden')).toBe(true);
  });
});
```

- [ ] **Bước 2.** `pnpm --filter @tourism/web test -- src/components/checkout/voucher-pass.spec.tsx`
  — ĐỎ vì chưa có module `./voucher-pass`.

- [ ] **Bước 3. Cài.** Tạo `voucher-pass.tsx`:

```tsx
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { ArrowRightIcon, CalendarIcon, CheckIcon, UsersIcon } from 'lucide-react';
import Link from 'next/link';
import { VoucherCancelledNotice, VoucherCode } from '@/components/checkout/voucher-code';
import { bookingPriceLines, ticketBarcodeWidths } from '@/lib/checkout';
import { formatMoney, formatMoneyExact } from '@/lib/tours';
import type { VoucherJournalItem, VoucherView } from '@/lib/voucher';

/**
 * Cột phải của voucher — mảng teal 440px (spec P7 §6.3): ô mã đơn kèm ngày đi, "Admit n",
 * dòng điều kiện và mã vạch; Receipt overview; Trip journal; nút trắng "View booking".
 *
 * Nền `bg-primary`, KHÔNG `bg-primary-emphasis` như chữ của spec §4.3: `primary-emphasis` là
 * token VAI CHỮ (`tokens.mjs` — "KHÔNG dùng cho bg-*"), ở dark mode nó sáng lên L 0.76 và chữ
 * trắng trên đó chưa tới 2:1. `primary` là vai bề mặt, cõng `primary-foreground` ở cả hai theme;
 * ở light hai token trùng giá trị nên màu bản vẽ không đổi.
 *
 * Chữ phụ dùng `primary-foreground/90`, không mờ hơn: mức /72 của bản vẽ đặt trên `primary`
 * của site tụt dưới 4.5:1.
 */
export function VoucherPass({ booking, view }: { booking: BookingDetail; view: VoucherView }) {
  const t = messages.voucher;
  const refunded = Number(booking.refundedTotal) > 0;
  return (
    <div
      data-slot="voucher-pass"
      className="bg-primary px-6 py-7 text-primary-foreground md:px-8 md:pt-7.5 md:pb-8.5"
    >
      {/* Đơn còn hiệu lực: khối luôn hiện (ngày, điều kiện, mã vạch), chỉ ô mã giấu trên điện
          thoại vì cột trái đã có ô gọn. Đơn đã huỷ: khối chỉ còn dải hết hiệu lực mà cột trái
          đã nói trên điện thoại, nên giấu cả khối ở đó; khi in thì hiện lại. */}
      <div
        data-slot="voucher-ticket"
        className={cn(
          'rounded-2xl bg-card px-4.5 py-4 text-card-foreground',
          !view.showCode && 'max-md:hidden print:block',
        )}
      >
        {view.showCode ? (
          <>
            <VoucherCode code={booking.code} className="max-md:hidden print:flex" />
            <div
              data-slot="voucher-meta"
              className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground max-md:mt-0 print:mt-2.5"
            >
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon aria-hidden="true" className="size-3.5" />
                {view.departure}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UsersIcon aria-hidden="true" className="size-3.5" />
                {t.admit(booking.numAdults + booking.numChildren)}
              </span>
            </div>
            <ul data-slot="voucher-conditions" className="mt-2.5 grid gap-1.5 text-[12.5px]">
              {view.conditions.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <CheckIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-success" />
                  {line}
                </li>
              ))}
            </ul>
            {view.showBarcode ? <Barcode code={booking.code} /> : null}
          </>
        ) : view.cancelledNotice ? (
          <VoucherCancelledNotice text={view.cancelledNotice} />
        ) : null}
      </div>

      <section data-slot="voucher-receipt" className="mt-5.5">
        <h3 className="mb-2 text-base font-semibold">{t.receiptHeading}</h3>
        <dl className="text-[13.5px]">
          {bookingPriceLines(booking).map((line) => (
            <div key={line.label} className="flex justify-between gap-4 py-0.5">
              <dt className="text-primary-foreground/90">{line.label}</dt>
              <dd className="font-mono tabular-nums">{line.amount}</dd>
            </div>
          ))}
          <div className="mt-1.5 flex justify-between gap-4 border-t border-primary-foreground/25 pt-2 text-[15px] font-bold">
            <dt>{messages.booking.success.totalLabel}</dt>
            <dd className="font-mono tabular-nums">
              {formatMoney(booking.totalAmount, booking.currency)}
            </dd>
          </div>
          {/* Số tiền THẬT đã về tài khoản khách — đủ hai số lẻ (`formatMoneyExact`), khác giá
              tour làm tròn ở các dòng trên. */}
          {refunded ? (
            <div className="flex justify-between gap-4 py-0.5">
              <dt className="text-primary-foreground/90">{t.refunded}</dt>
              <dd className="font-mono tabular-nums">
                {t.refundedAmount(formatMoneyExact(booking.refundedTotal, booking.currency))}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section
        data-slot="voucher-journal"
        className="mt-4.5 rounded-2xl bg-primary-foreground/10 px-4 py-3.5"
      >
        <h3 className="mb-2.5 font-semibold">{t.journal.heading}</h3>
        <ol>
          {view.journal.map((item) => (
            <JournalItem key={item.label} item={item} />
          ))}
        </ol>
      </section>

      <Link
        href={`/account/bookings/${booking.code}`}
        className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-card font-bold text-primary-emphasis outline-none transition-colors hover:bg-card/90 focus-visible:ring-3 focus-visible:ring-primary-foreground/60 print:hidden"
      >
        {messages.booking.success.viewBooking}
        <ArrowRightIcon aria-hidden="true" className="size-4" />
      </Link>
      <Link
        href="/tours"
        className="mx-auto mt-3 block w-fit rounded-sm text-[13px] underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60 print:hidden"
      >
        {messages.booking.success.viewTours}
      </Link>
    </div>
  );
}

/**
 * Mã vạch trang trí, tất định theo mã đơn (`ticketBarcodeWidths`, cùng nguồn với cuống hoá
 * đơn). `data-slot="barcode"` ăn quy tắc in `print-color-adjust: exact` có sẵn ở `globals.css`
 * — vạch vẽ bằng nền, tắt "in nền" là mất vạch. Vạch `bg-current` để bản in tô chúng bằng màu
 * mực của mảng teal (đen), không bằng màu chữ của theme.
 */
function Barcode({ code }: { code: string }) {
  return (
    <div
      data-slot="barcode"
      aria-hidden="true"
      className="mt-3 flex h-7.5 max-w-full items-stretch overflow-hidden text-foreground"
    >
      {ticketBarcodeWidths(code).map((width, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: mảng tất định từ `code`, không đổi thứ tự
          key={`${code}-${i}`}
          className={i % 2 === 0 ? 'bg-current' : 'bg-transparent'}
          style={{ width: `${width}px` }}
        />
      ))}
    </div>
  );
}

/** Một mốc của Trip journal: vòng tròn (tích khi đã xong), nhãn, dòng phụ; vạch nối tới mốc sau. */
function JournalItem({ item }: { item: VoucherJournalItem }) {
  return (
    <li className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2.5 pb-3 text-[13px] before:absolute before:top-5 before:bottom-0 before:left-[9.5px] before:w-px before:bg-primary-foreground/35 last:pb-0 last:before:hidden">
      {item.done ? (
        <span
          role="img"
          aria-label={messages.voucher.journal.done}
          className="grid size-5 place-items-center rounded-full border-[1.5px] border-primary-foreground bg-primary-foreground text-primary"
        >
          <CheckIcon aria-hidden="true" className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="size-5 rounded-full border-[1.5px] border-primary-foreground"
        />
      )}
      <div className="min-w-0">
        <p className="font-semibold">{item.label}</p>
        {item.detail ? <p className="text-xs text-primary-foreground/90">{item.detail}</p> : null}
      </div>
    </li>
  );
}
```

- [ ] **Bước 4.** Chạy lại spec — XANH. **Đột biến**: bỏ `max-md:hidden` (rồi bỏ `print:flex`) của ô
  mã trong mảng teal; `t.admit(booking.numAdults)` (ca FAMILY: "Admit 2"); luôn vẽ `Barcode`
  (ca đã đi); `> 0` thành `>= 0` cho `refunded` (ca chưa hoàn); `formatMoneyExact` thành
  `formatMoney` ở dòng hoàn ("−$74"); gắn `role="img"` cho mọi mốc (ca Trip journal); luôn gắn
  `max-md:hidden` cho khối mã (ca "khối KHÔNG giấu"); đưa dòng "Total paid" lên trước các dòng
  tiền.
- [ ] **Bước 5.** Chạy quy trình gate ở mục Ràng buộc toàn cục, rồi commit (stage `voucher-pass.tsx`,
  `voucher-pass.spec.tsx`):
  `feat(web): mảng teal của voucher — ô mã, điều kiện, mã vạch, receipt, nhật ký chuyến`

### Task 25 — C4 · Ráp thẻ voucher và viết lại nhánh đã trả của `/checkout/success`

**Files:**

- Create: `apps/web/src/components/checkout/voucher-card.tsx`
- Test: `apps/web/src/components/checkout/voucher-card.spec.tsx`
- Modify (viết lại cả file): `apps/web/src/app/(site)/checkout/success/page.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (gỡ bốn khoá mồ côi `booking.success.next*`,
  sửa comment của `stubShowCode` — `messages.ts:474-482`)
- Modify (chỉ JSDoc): `apps/web/src/components/checkout/success-celebration.tsx:20`,
  `apps/web/src/components/checkout/booking-receipt.tsx:13`

**Interfaces:**

- Consumes: C1–C3; `SuccessCelebration({ bookingCode })` (`success-celebration.tsx:39`);
  `ContentHero({ breadcrumb, title, meta, action })` (`components/content/content-hero.tsx:15`,
  Phần A thêm `back` — trang này không truyền); `PrintButton()` (`print-button.tsx:18`);
  `BookingReceipt({ booking, mood })` (`booking-receipt.tsx:52`); `CheckoutAutoRefresh()`
  (`checkout-auto-refresh.tsx:26`); `checkoutMood` (`lib/checkout.ts:47`); `todayDateString()`
  (`lib/account-stats.ts:23`); `fetchBookingByCode` (`lib/api/bookings.ts:34`);
  `fetchTourDetail(slug)` (`lib/api/tours.ts:110`); `requireSession` (`lib/api/session.ts:93`).
- Produces: `VoucherCard({ booking, view, meetingPoint })` — `data-slot="voucher"`, gắn
  `SuccessCelebration` khi `view.justPaid`; trang `/checkout/success` hai nhánh (voucher cho đơn
  đã trả, hoá đơn chờ cho đơn chưa trả); trang không tìm thấy trỏ `/account/bookings`; tiêu đề
  tab "Voucher — Nexora".

- [ ] **Bước 1. Đọc trước.** `apps/web/AGENTS.md` (Next.js 16 khác bản quen tay) và
  `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
  (`searchParams` là Promise). Trang không thêm API Next nào mới — chỉ đổi cây JSX và gọi thêm
  `fetchTourDetail`.

- [ ] **Bước 2. Test trước.** Tạo `voucher-card.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voucherView } from '@/lib/voucher';
import {
  minutesBeforeNow,
  VOUCHER_NOW,
  VOUCHER_TODAY,
  voucherBooking,
} from '@/test/fixtures/voucher';
import { VoucherCard } from './voucher-card';

// Pháo giấy có spec riêng (một lần mỗi tab, tôn trọng reduced-motion). Ở đây chỉ hỏi thẻ CÓ
// gắn nó hay không: thay bằng một hàm ghi lại mã đơn, không vẽ gì (khuôn `vi.hoisted` như
// các spec khác của web — factory của `vi.mock` không chứa JSX).
const { celebrate } = vi.hoisted(() => ({ celebrate: vi.fn() }));
vi.mock('@/components/checkout/success-celebration', () => ({
  SuccessCelebration: ({ bookingCode }: { bookingCode: string }) => {
    celebrate(bookingCode);
    return null;
  },
}));

beforeEach(() => {
  celebrate.mockReset();
});

const CANCELLED_NOTICE = 'This booking was cancelled — this voucher is no longer valid.';

function renderCard(overrides: Partial<BookingDetail> = {}) {
  const booking = voucherBooking(overrides);
  const view = voucherView(booking, VOUCHER_NOW, VOUCHER_TODAY);
  if (view === null) throw new Error('fixture phải là đơn đã trả');
  return render(<VoucherCard booking={booking} view={view} meetingPoint={null} />);
}

describe('VoucherCard — ba khoảnh khắc của spec §2.6', () => {
  it('vừa trả: "Your day in Hà Nội is booked." và bắn pháo giấy đúng mã đơn', () => {
    renderCard({ paidAt: minutesBeforeNow(5) });
    expect(
      screen.getByRole('heading', { level: 2, name: 'Your day in Hà Nội is booked.' }),
    ).toBeInTheDocument();
    expect(celebrate).toHaveBeenCalledWith('BK-B6VCOQNW');
  });

  it('mở lại: "Your trip voucher", không pháo giấy', () => {
    renderCard();
    expect(screen.getByRole('heading', { level: 2, name: 'Your trip voucher' })).toBeInTheDocument();
    expect(celebrate).not.toHaveBeenCalled();
  });

  it('huỷ ngay sau khi trả: không pháo giấy, không mã, không mã vạch; dải hết hiệu lực ở cả hai chỗ', () => {
    const { container } = renderCard({
      status: 'CANCELLED',
      cancellation: null,
      paidAt: minutesBeforeNow(10),
      cancelledAt: minutesBeforeNow(2),
    });
    expect(celebrate).not.toHaveBeenCalled();
    expect(screen.queryByText('BK-B6VCOQNW')).toBeNull();
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
    // Một ở chỗ ô mã gọn (điện thoại), một trong mảng teal (màn rộng, bản in).
    expect(screen.getAllByText(CANCELLED_NOTICE)).toHaveLength(2);
  });

  it('hai cột trong MỘT thẻ; một h2 duy nhất, không h1 (h1 là tên tour ở hero)', () => {
    const { container } = renderCard();
    const card = container.querySelector('[data-slot="voucher"]');
    expect(card?.querySelector('[data-slot="voucher-overview"]')).not.toBeNull();
    expect(card?.querySelector('[data-slot="voucher-pass"]')).not.toBeNull();
    expect(container.querySelectorAll('h1')).toHaveLength(0);
    expect(container.querySelectorAll('h2')).toHaveLength(1);
  });
});
```

- [ ] **Bước 3.** `pnpm --filter @tourism/web test -- src/components/checkout/voucher-card.spec.tsx`
  — ĐỎ vì chưa có module `./voucher-card`.

- [ ] **Bước 4. Cài thẻ.** Tạo `voucher-card.tsx`:

```tsx
import type { BookingDetail } from '@tourism/contract';
import { SuccessCelebration } from '@/components/checkout/success-celebration';
import { VoucherOverview } from '@/components/checkout/voucher-overview';
import { VoucherPass } from '@/components/checkout/voucher-pass';
import type { VoucherView } from '@/lib/voucher';

/**
 * Voucher của đơn đã trả ở `/checkout/success` (spec P7 §6, bản vẽ `booking-voucher.src.html`):
 * MỘT thẻ bo góc `max-w-7xl` chia đôi — cột trái co giãn (`VoucherOverview`), cột phải 440px
 * mảng teal (`VoucherPass`). Điện thoại một cột, mảng teal xuống cuối theo thứ tự DOM. Khi in,
 * cột phải hẹp còn 17rem để cả thẻ nằm gọn một trang A4 (số đo ở plan P7, Task C5).
 *
 * Pháo giấy gắn Ở ĐÂY chứ không ở trang: luật "chỉ khi vừa trả" nhờ vậy có test (Vitest không
 * quét `app/**`). `SuccessCelebration` vẫn tự giữ "một lần mỗi tab".
 */
export function VoucherCard({
  booking,
  view,
  meetingPoint,
}: {
  booking: BookingDetail;
  view: VoucherView;
  meetingPoint: string | null;
}) {
  return (
    <>
      {view.justPaid ? <SuccessCelebration bookingCode={booking.code} /> : null}
      <article
        data-slot="voucher"
        className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-4xl border bg-card text-card-foreground md:grid-cols-[minmax(0,1fr)_440px] print:grid-cols-[minmax(0,1fr)_17rem]"
      >
        <VoucherOverview booking={booking} view={view} meetingPoint={meetingPoint} />
        <VoucherPass booking={booking} view={view} />
      </article>
    </>
  );
}
```

- [ ] **Bước 5. Viết lại trang.** Thay TRỌN `apps/web/src/app/(site)/checkout/success/page.tsx`:

```tsx
import { BookingCodeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { BookingReceipt } from '@/components/checkout/booking-receipt';
import { CheckoutAutoRefresh } from '@/components/checkout/checkout-auto-refresh';
import { PrintButton } from '@/components/checkout/print-button';
import { VoucherCard } from '@/components/checkout/voucher-card';
import { ContentHero } from '@/components/content/content-hero';
import { todayDateString } from '@/lib/account-stats';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { fetchTourDetail } from '@/lib/api/tours';
import { checkoutMood } from '@/lib/checkout';
import { voucherView } from '@/lib/voucher';

export const metadata: Metadata = {
  // "Voucher" chứ không "Booking confirmed": trang này mở lại được bất cứ lúc nào, kể cả với
  // đơn đã huỷ — tiêu đề tab nói "đã xác nhận" là đúng lớp lỗi spec P7 §1 sửa ở thân trang.
  title: `${messages.booking.success.heroBreadcrumb} — Nexora`,
  // Trang per-user sau thanh toán: không có gì để index, và `robots.ts` cũng đã
  // disallow `/checkout/`. Khai ở đây thêm một lớp cho chắc.
  robots: { index: false, follow: false },
};

/**
 * Khách quay về từ cổng thanh toán. Cổng dựng URL này ở API
 * (`bookings.service.ts` — `successUrl: ${FRONTEND_URL}/checkout/success?code=…`),
 * nên `code` LUÔN tới qua query string, không phải qua route param.
 *
 * Hai nhánh (spec P7 §2.6): đơn ĐÃ TRẢ (có `paidAt`) mở voucher `VoucherCard` — vừa trả thì
 * chào "… is booked." kèm pháo giấy, mở lại thì "Your trip voucher"; đơn CHƯA TRẢ giữ hoá đơn
 * chờ `BookingReceipt` (PENDING tự làm tươi bằng `CheckoutAutoRefresh`, webhook về là chính
 * cây server đổi sang voucher).
 *
 * ⚠️ TRANG NÀY CẦN SESSION: `bookings.byCode` là procedure authed (không có
 * đường tra công khai theo mã). Cookie sống sót qua redirect top-level GET từ
 * Stripe/PayPal vì nó là `SameSite=Lax` — đó là điều kiện để trang này đọc
 * được booking ngay khi khách vừa từ cổng về.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  await requireSession(`/checkout/success${code ? `?code=${code}` : ''}`);

  const t = messages.booking.success;

  // Mã không đúng shape (link cũ, gõ tay, bot) → dừng ngay, khỏi tốn round-trip.
  // KHÔNG `notFound()`: khách vừa trả tiền thật, một trang 404 trần ở đây là
  // khoảnh khắc tệ nhất có thể. Nói rõ không tìm thấy và chỉ đường về danh sách.
  const parsed = code ? BookingCodeSchema.safeParse(code) : null;
  const booking = parsed?.success
    ? await fetchBookingByCode((await cookies()).toString(), parsed.data)
    : null;

  if (!booking) {
    return (
      <div>
        <ContentHero breadcrumb={t.heroBreadcrumb} title={t.notFound} />
        <div className="mx-auto flex w-full max-w-2xl flex-wrap gap-2.5 px-4 pt-10 pb-16 md:pb-20">
          {/* "My bookings" trỏ đúng danh sách đơn (spec P7 §6.4) — bản cũ trỏ `/account` từ
              hồi danh sách đơn còn nằm trong trang hộ chiếu. */}
          <ButtonLink href="/account/bookings">{messages.booking.list.menuLink}</ButtonLink>
          <ButtonLink variant="outline" href="/tours">
            {t.viewTours}
          </ButtonLink>
        </div>
      </div>
    );
  }

  // "Hôm nay" là ngày lịch Việt Nam do server tính (spec P7 §2.1); `new Date()` chỉ để đo
  // 30 phút "vừa trả".
  const view = voucherView(booking, new Date(), todayDateString());

  if (!view) {
    // Đơn chưa có `paidAt` — PENDING đang chờ webhook, hay giữ chỗ hết hạn/bị huỷ khi chưa
    // trả: giữ NGUYÊN hoá đơn chờ. Mã của những đơn này chưa bao giờ là voucher.
    const mood = checkoutMood(booking);
    return (
      <div>
        {/* GIỮ `ContentHero`: `/checkout/success` nằm trong `HERO_LESS_EXCEPTIONS` của
            `site-header.tsx`, navbar ở đây giả định có mảng tối phía sau — gỡ hero là navbar
            tàng hình ở light mode (lỗi `/enquire` 19/08). Không `meta`: hoá đơn đã in mã ở
            bảng meta và ở cuống. */}
        <ContentHero
          breadcrumb={t.heroBreadcrumb}
          title={booking.tourTitle}
          action={<PrintButton />}
        />
        <div className="py-10 md:py-14">
          <BookingReceipt booking={booking} mood={mood} />
          <div className="mx-auto mt-8 flex w-full max-w-3xl flex-wrap items-center gap-2.5 px-4 print:hidden">
            <ButtonLink href={`/account/bookings/${booking.code}`}>{t.viewBooking}</ButtonLink>
            {mood === 'confirming' ? (
              <CheckoutAutoRefresh />
            ) : (
              <ButtonLink variant="outline" href="/tours">
                {t.viewTours}
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Điểm hẹn lấy từ tour (cache 300 giây, tag `tour:<slug>`); tour đã gỡ trả null. Lỗi gọi API
  // khác cũng rơi về null — voucher của đơn ĐÃ TRẢ không được sập vì một ô phụ.
  const tour = await fetchTourDetail(booking.tourSlug).catch((error: unknown) => {
    console.warn(`[checkout/success] không đọc được tour ${booking.tourSlug}`, error);
    return null;
  });

  return (
    <div>
      {/* Hero GIỮ (lý do ở nhánh trên) và thêm meta mã đơn (spec §6.1). Bản in chỉ in thẻ
          voucher, nên hero — cả nút Print trong đó — giấu khi in (spec §6.4). */}
      <div className="print:hidden">
        <ContentHero
          breadcrumb={t.heroBreadcrumb}
          title={booking.tourTitle}
          meta={booking.code}
          action={<PrintButton />}
        />
      </div>
      {/* Lề ngang CHÉP của hero (`px-4 md:px-16 lg:px-24 xl:px-32`, khung `max-w-7xl` trong
          thẻ) để mép thẻ thẳng hàng tiêu đề. */}
      <div className="px-4 py-10 md:px-16 md:py-14 lg:px-24 xl:px-32 print:p-0">
        <VoucherCard booking={booking} view={view} meetingPoint={tour?.meetingPoint ?? null} />
      </div>
    </div>
  );
}
```

- [ ] **Bước 6. Gỡ chữ mồ côi.** `libs/shared/i18n/src/lib/messages.ts` (khối `booking.success`), thay:

```ts
      // Dòng nhỏ dưới mã trong cuống vé (`CheckoutShell`) — khác `nextVoucher`
      // (câu đầy đủ trong list "What happens next"): đây là chú thích NGẮN,
      // ngay cạnh chính mã đó, không cần lặp lại "your booking code is…".
      stubShowCode: 'Show this code at the meeting point.',
      // Section "What happens next" — chỉ hiện ở mood confirmed.
      nextHeading: 'What happens next',
      nextEmail: 'A confirmation email is on its way to your inbox.',
      nextVoucher: 'Your booking code is your voucher — show it at the meeting point.',
      nextManage: 'View or cancel this trip in Trips.',
```

  bằng:

```ts
      // Dòng nhỏ dưới mã trong cuống hoá đơn (`BookingReceipt`) — chú thích NGẮN ngay
      // cạnh chính mã đó. Voucher của đơn đã trả có câu riêng `voucher.showCode`. Khối
      // "What happens next" (`nextHeading`…`nextManage`) gỡ ở P7: voucher kể những việc
      // ấy bằng dòng điều kiện và Trip journal.
      stubShowCode: 'Show this code at the meeting point.',
```

  Build lại contract và i18n. Phép grep phải RỖNG:
  `grep -rn "nextHeading\|nextEmail\|nextVoucher\|nextManage" apps libs --include=*.ts --include=*.tsx`.

- [ ] **Bước 7. JSDoc theo hành vi mới.**
  - `success-celebration.tsx:20`, thay
    `` * - CHỈ render ở mood `confirmed` (cha quyết) — ăn mừng đơn PENDING là sai. ``
    bằng hai dòng:

```tsx
 * - CHỈ render khi voucher VỪA TRẢ (`VoucherCard` quyết theo `voucherView`, spec P7 §2.6) —
 *   ăn mừng đơn PENDING hay voucher mở lại là sai.
```

  - `booking-receipt.tsx:13`, thay
    `` * Hoá đơn kiêm cuống vé cho `/checkout/success` — thay `CheckoutShell` (tấm vé ``
    bằng hai dòng (dòng 14 giữ nguyên, câu nối liền):

```tsx
 * Hoá đơn kiêm cuống vé cho đơn CHƯA TRẢ ở `/checkout/success` và cho `/checkout/cancel`
 * (đơn đã trả mở voucher `VoucherCard` từ P7, spec 05/10 §6) — thay `CheckoutShell` (tấm vé
```

  Edit báo không khớp (Phần A đã sửa đúng dòng ấy) thì DỪNG và hỏi, đừng đoán.

- [ ] **Bước 8.** Chạy lại spec của Bước 2 — XANH; chạy cả thư mục
  `pnpm --filter @tourism/web test -- src/components/checkout` — mọi spec cũ
  (`booking-receipt`, `copy-code-button`, `success-celebration`) vẫn xanh. **Đột biến**: luôn
  vẽ `SuccessCelebration` (ca mở lại); không bao giờ vẽ (ca vừa trả); bỏ `VoucherPass` khỏi thẻ
  (ca hai cột). Nhánh của trang (`app/**`) Vitest không quét — phủ bằng Task C5 và thử tay.
- [ ] **Bước 9.** Chạy quy trình gate ở mục Ràng buộc toàn cục (typecheck bắt mọi chỗ còn gọi khoá
  đã gỡ), rồi commit (stage `voucher-card.tsx`, `voucher-card.spec.tsx`, `page.tsx`,
  `messages.ts`, `success-celebration.tsx`, `booking-receipt.tsx`):
  `feat(web): trang /checkout/success mở voucher mới cho đơn đã trả`

### Task 26 — C5 · Bản in, soi bố cục bằng CSS build thật, gate cuối, docs, bàn giao

jsdom không có bố cục, càng không có bản in. Cách làm của Task 13 plan P4e-4: DOM của CHÍNH
các component, đổ ra trang tĩnh, nối với CSS mà `next build` của web vừa sinh, rồi đo bằng
trình duyệt ở hai khổ màn hình — cộng một khổ "giấy" giả lập bằng cách đổi các khối
`@media print` của CSS thật sang `all`. Không commit gì của phần đo.

**Files:**

- Modify: `apps/web/src/app/globals.css` (comment đầu khối in cũ, dòng 236–237; khối in mới ở
  cuối file)
- Create (tạm, xoá ở Bước 9): `apps/web/src/components/__layout-check__/render.spec.tsx`
- Output (tạm): `apps/web/.next/layout-check/*.html` (`.next/` đã nằm trong `.gitignore`)
- Modify: `docs/CHANGELOG.md`

**Interfaces:**

- Consumes: các `data-slot` của C2–C4: `voucher`, `voucher-overview`, `voucher-photo`,
  `voucher-code`, `voucher-pass`, `voucher-ticket`, `barcode`, `voucher-journal`; quy tắc in cũ
  `[data-slot="barcode"]`, `receipt`, `stub`, `receipt-status` (`globals.css:252-272`) — GIỮ
  NGUYÊN cho trang huỷ và hoá đơn chờ.
- Produces: bản in voucher: chỉ in thẻ, mảng teal nền trắng viền teal, mực tối cả ở giao diện tối,
  mã vạch đen, không ngắt trang giữa thẻ.

- [ ] **Bước 1. Bản in.** `apps/web/src/app/globals.css`:
  - dòng 237, thay `` * IN ẤN — chỉ phục vụ hoá đơn `/checkout/success` (19/08). `` bằng:

```css
 * IN ẤN — hoá đơn `BookingReceipt`: đơn chưa trả ở `/checkout/success` và trang
 * `/checkout/cancel` (19/08). Voucher của đơn đã trả có khối riêng ở cuối file (P7); quy tắc
 * `[data-slot="barcode"]` dưới đây phục vụ luôn mã vạch của voucher.
```

  - cuối file, thay đoạn đóng của khối in cũ:

```css
  [data-slot="stub"] {
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
    border-top: 1px dashed var(--border);
  }
}
```

  bằng chính nó cộng khối mới:

```css
  [data-slot="stub"] {
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
    border-top: 1px dashed var(--border);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * IN ẤN VOUCHER `/checkout/success` của đơn đã trả (spec P7 §6.4) — chỉ in THẺ.
 *
 * Mọi quy tắc neo vào `[data-slot="voucher"]`, nên hoá đơn chờ và trang `/checkout/cancel`
 * vẫn in theo khối ở trên, không đổi gì.
 *
 * - Chrome của site (top bar, navbar, footer, nút cuộn, toast) là anh em của `<main>` ngay
 *   dưới `<body>` (`SiteChrome`): giấu cả loạt bằng `:has()` thay vì gắn `print:hidden` vào
 *   từng linh kiện dùng chung — trang khác in vẫn như cũ. Hero và các nút giấu bằng
 *   `print:hidden` ở chính trang.
 * - Mực luôn tối, kể cả khi khách đang ở giao diện tối: đổi các biến chữ sang `--hero` (mảng
 *   tối nhất, tối ở CẢ hai theme) ngay trên thẻ. Utility của Tailwind đọc biến qua
 *   `@theme inline`, nên đổi biến là đổi màu chữ mà không đụng class nào.
 * - Mảng teal in nền trắng viền teal cho đỡ mực; mọi chữ và viền trong đó theo mực của mảng.
 * - Mã vạch vẽ bằng `bg-current`: ăn mực `--hero` (đen), và nhờ quy tắc `[data-slot="barcode"]`
 *   ở khối trên mà vẫn in khi trình duyệt tắt "in nền".
 * - Ảnh bìa ép in nền để lớp tối mờ dần vẫn còn — thiếu nó chữ sáng nằm trơ trên ảnh.
 * - Nền các khối bỏ hẳn: khách bật "in nền" ở giao diện tối thì thẻ không thành mảng tối.
 * ───────────────────────────────────────────────────────────────────────────── */
@media print {
  body:has([data-slot="voucher"]) > :not(main) {
    display: none;
  }

  [data-slot="voucher"] {
    --foreground: var(--hero);
    --card-foreground: var(--hero);
    --muted-foreground: var(--hero);
    --primary-emphasis: var(--primary);
    background: none;
    break-inside: avoid;
  }

  [data-slot="voucher-photo"] {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  [data-slot="voucher-pass"] {
    background: none;
    color: var(--hero);
    border: 2px solid var(--primary);
  }

  [data-slot="voucher-pass"] * {
    color: inherit;
    border-color: var(--primary);
  }

  [data-slot="voucher-ticket"] {
    background: none;
  }
}
```

- [ ] **Bước 2. Build web với CSS mới.** Tắt `next dev`/`next start` nếu đang chạy (trên Windows
  `guard-build.mjs` tự bỏ qua). Chạy bước 0–1 của Quy trình gate (commit memory, API sống), rồi:
  `NEXT_PUBLIC_API_URL=http://localhost:3001 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm turbo run build --filter=@tourism/web --concurrency=1 --output-logs=errors-only`.
  Kiểm: `ls apps/web/.next/static/chunks/*.css` ra ít nhất một file, và
  `grep -l "data-slot=voucher-pass" apps/web/.next/static/chunks/*.css` ra đúng một file.

- [ ] **Bước 3. Spec tạm** `apps/web/src/components/__layout-check__/render.spec.tsx`:

```tsx
// TẠM — soi bố cục voucher P7 phần C bằng CSS build thật (plan P7, Task C5). KHÔNG commit.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import type * as React from 'react';
import { beforeAll, describe, it, vi } from 'vitest';
import { BookingReceipt } from '@/components/checkout/booking-receipt';
import { PrintButton } from '@/components/checkout/print-button';
import { VoucherCard } from '@/components/checkout/voucher-card';
import { ContentHero } from '@/components/content/content-hero';
import { voucherView } from '@/lib/voucher';
import { VOUCHER_NOW, VOUCHER_TODAY, voucherBooking } from '@/test/fixtures/voucher';

// `BookingReceipt` "in ra" từng khối bằng `RevealItem` (motion `whileInView`) — jsdom không có
// IntersectionObserver.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// cwd của vitest là apps/web.
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

/** Điểm hẹn dài nhất của bản vẽ — ô Meeting point dễ tràn nhất. */
const MEETING = 'Hotel pickup — hotels in Hoàn Kiếm, Ba Đình or Tây Hồ districts, Hà Nội';

/** Chuyến ba ngày, 2 người lớn và 1 trẻ em, đã hoàn một phần — mộc dài nhất, đủ dòng tiền. */
const FAMILY = voucherBooking({
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
  cancellationDeadline: '2026-10-31',
  cancellation: {
    deadline: '2026-10-31',
    withinDeadline: true,
    refundAmount: '98.00',
    canCancel: true,
  },
  numAdults: 2,
  numChildren: 1,
  status: 'PARTIALLY_REFUNDED',
  refundedTotal: '49.00',
});

/** Đơn đã hoàn đủ — biến thể "no longer valid". */
const REFUNDED = voucherBooking({
  status: 'REFUNDED',
  cancellation: null,
  refundedTotal: '147.00',
  cancelledAt: '2026-10-25T02:00:00.000Z',
});

/** Chép ĐÚNG nhánh voucher của `checkout/success/page.tsx` (Task C4, B5). */
function voucherPage(booking: ReturnType<typeof voucherBooking>) {
  const view = voucherView(booking, VOUCHER_NOW, VOUCHER_TODAY);
  if (view === null) throw new Error('fixture phải là đơn đã trả');
  return (
    <div>
      <div className="print:hidden">
        <ContentHero
          breadcrumb={messages.booking.success.heroBreadcrumb}
          title={booking.tourTitle}
          meta={booking.code}
          action={<PrintButton />}
        />
      </div>
      <div className="px-4 py-10 md:px-16 md:py-14 lg:px-24 xl:px-32 print:p-0">
        <VoucherCard booking={booking} view={view} meetingPoint={MEETING} />
      </div>
    </div>
  );
}

/** `nav`/`footer` giả đứng anh em với `main` ngay dưới `body`, như `SiteChrome` thật. */
function page(name: string, body: React.ReactNode, htmlClass = '') {
  const { container, unmount } = render(
    <>
      <nav data-check="chrome">Site navigation</nav>
      <main className="flex-1">{body}</main>
      <footer data-check="chrome">Site footer</footer>
    </>,
  );
  const links = CSS.map((file) => `<link rel="stylesheet" href="/static/chunks/${file}">`).join('');
  writeFileSync(
    `${OUT}/${name}.html`,
    `<!doctype html><html lang="en" class="${FONT_CLASSES.join(' ')} h-full antialiased ${htmlClass}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${links}</head><body class="min-h-full flex flex-col">${container.innerHTML}</body></html>`,
  );
  unmount();
}

describe('layout-check', () => {
  it('voucher', () => page('voucher', voucherPage(FAMILY)));
  it('voucher-dark', () => page('voucher-dark', voucherPage(FAMILY), 'dark'));
  it('voucher-refunded', () => page('voucher-refunded', voucherPage(REFUNDED)));
  it('receipt', () =>
    page(
      'receipt',
      <div className="py-10">
        <BookingReceipt
          booking={voucherBooking({ status: 'PENDING', paidAt: null, cancellation: null })}
          mood="confirming"
        />
      </div>,
    ));
});
```

  Chạy: `pnpm --filter @tourism/web test -- src/components/__layout-check__/render.spec.tsx`
  — bốn ca xanh, bốn file trong `apps/web/.next/layout-check/`.

- [ ] **Bước 4.** Mở máy chủ tĩnh ở nền (Git Bash, gốc repo):
  `python -m http.server 8767 --directory apps/web/.next` — rồi mở
  `http://localhost:8767/layout-check/voucher.html` trong Browser pane (`preview_start` với
  `url`). Chữ phải ra đúng font Literata/Archivo/IBM Plex Mono (CSS build trỏ font bằng đường
  tương đối `../media/…`); không ra thì Bước 3 thiếu file CSS font.

- [ ] **Bước 5. Đo ở 1280px.** `resize_window` 1280×900, ở `voucher.html` chạy bằng
  `javascript_tool`:

```js
(() => {
  const q = (s) => document.querySelector(s);
  const all = (s) => [...document.querySelectorAll(s)];
  const box = (el) => el.getBoundingClientRect();
  const shown = (el) => el.getClientRects().length > 0;
  const root = document.documentElement;
  const card = q('[data-slot="voucher"]');
  const overview = q('[data-slot="voucher-overview"]');
  const pass = q('[data-slot="voucher-pass"]');
  const photo = q('[data-slot="voucher-photo"]');
  const title = q('[data-slot="voucher"] h2');
  const codes = all('[data-slot="voucher-code"]');
  const barcode = q('[data-slot="barcode"]');
  return {
    viewport: innerWidth,
    // So với clientWidth (không tính thanh cuộn dọc) — 0 là không tràn ngang.
    overflowX: root.scrollWidth - root.clientWidth,
    alignedWithHero: Math.round(box(card).left - box(q('h1')).left),
    twoColumns: box(pass).left >= box(overview).right - 1,
    passBelow: box(pass).top >= box(overview).bottom - 1,
    passWidth: Math.round(box(pass).width),
    codesShown: codes.map(shown),
    cancelledShown: all('[data-slot="voucher-cancelled"]').map(shown),
    ticketShown: shown(q('[data-slot="voucher-ticket"]')),
    compactUnderTitle:
      codes[0] && shown(codes[0])
        ? box(codes[0]).top >= box(title).bottom && box(codes[0]).bottom <= box(photo).top
        : null,
    photoHeight: Math.round(box(photo).height),
    barcodeOverflow: barcode ? barcode.scrollWidth - barcode.clientWidth : null,
  };
})()
```

  Đạt khi, ở `voucher.html`: `overflowX` 0, `alignedWithHero` trong ±1 (mép thẻ thẳng tiêu đề
  hero), `twoColumns` true, `passWidth` 440, `codesShown` `[false, true]` (ô gọn giấu, ô trong
  mảng teal hiện), `ticketShown` true, `compactUnderTitle` null, `photoHeight` 288,
  `barcodeOverflow` 0. Ở `voucher-refunded.html`: `overflowX` 0, `codesShown` `[]`,
  `cancelledShown` `[false, true]`, `ticketShown` true. Chụp một ảnh màn `voucher.html` để ghi
  vào bàn giao.

- [ ] **Bước 6. Đo ở 375px.** `resize_window` 375×812, chạy lại đoạn đo. Đạt khi, ở `voucher.html`:
  `overflowX` 0, `alignedWithHero` ±1, `twoColumns` false, `passBelow` true, `codesShown`
  `[true, false]`, `ticketShown` true (ngày, điều kiện, mã vạch vẫn hiện), `compactUnderTitle`
  true, `photoHeight` 224, `barcodeOverflow` 0. Ở `voucher-refunded.html`: `overflowX` 0,
  `codesShown` `[]`, `cancelledShown` `[true, false]` (dải của cột trái hiện, dải trong mảng
  teal giấu cùng khối), `ticketShown` false. Chụp một ảnh màn `voucher.html`.

- [ ] **Bước 7. Đo bản in giả lập.** Khổ giấy A4 lề mặc định của Chrome cho chừng 718px bề ngang:
  `resize_window` 718×1046. Ở MỖI trang (`voucher.html`, `voucher-dark.html`,
  `voucher-refunded.html`, `receipt.html`) tải lại trang rồi chạy:

```js
(() => {
  // Đổi mọi khối `@media print` của CSS build thật sang `all` — trình duyệt vẽ bản in lên màn.
  const toAll = (rules) => {
    for (const rule of rules) {
      if (rule instanceof CSSMediaRule && /\bprint\b/.test(rule.media.mediaText)) {
        rule.media.mediaText = rule.media.mediaText.replace(/\bprint\b/, 'all');
      }
      if (rule.cssRules) toAll(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) toAll(sheet.cssRules);

  const q = (s) => document.querySelector(s);
  const box = (el) => el.getBoundingClientRect();
  const shown = (el) => el.getClientRects().length > 0;
  const probe = document.createElement('i');
  probe.style.color = 'var(--hero)';
  document.body.append(probe);
  const hero = getComputedStyle(probe).color;
  const chrome = [...document.querySelectorAll('[data-check="chrome"]')];

  const card = q('[data-slot="voucher"]');
  if (!card) {
    // Hoá đơn chờ: quy tắc in cũ còn nguyên, chrome KHÔNG bị giấu.
    const stub = getComputedStyle(q('[data-slot="stub"]'));
    return {
      chromeShown: chrome.every(shown),
      stubTop: `${stub.borderTopStyle} ${stub.borderTopWidth}`,
      stubBreak: stub.breakInside,
    };
  }
  const overview = q('[data-slot="voucher-overview"]');
  const pass = q('[data-slot="voucher-pass"]');
  const passStyle = getComputedStyle(pass);
  const bar = q('[data-slot="barcode"] span');
  return {
    chromeHidden: chrome.every((el) => !shown(el)),
    heroHidden: !shown(q('h1')),
    buttonsHidden: [
      ...card.querySelectorAll('button, a[href^="/account/bookings/"], a[href="/tours"]'),
    ].every((el) => !shown(el)),
    codesShown: [...document.querySelectorAll('[data-slot="voucher-code"]')].map(shown),
    ticketShown: shown(q('[data-slot="voucher-ticket"]')),
    twoColumns: box(pass).left >= box(overview).right - 1,
    passWidth: Math.round(box(pass).width),
    cardFullWidth: Math.abs(box(card).width - document.documentElement.clientWidth) <= 1,
    cardHeight: Math.round(box(card).height),
    breakInside: getComputedStyle(card).breakInside,
    passBackground: passStyle.backgroundColor,
    passBorder: `${passStyle.borderTopStyle} ${passStyle.borderTopWidth}`,
    titleInk: getComputedStyle(q('[data-slot="voucher"] h2')).color === hero,
    subtitleInk: getComputedStyle(q('[data-slot="voucher"] h2 + p')).color === hero,
    passInk: passStyle.color === hero,
    barInk: bar ? getComputedStyle(bar).backgroundColor === hero : null,
  };
})()
```

  Đạt khi, ở `voucher.html` VÀ `voucher-dark.html`: `chromeHidden`, `heroHidden`,
  `buttonsHidden` true; `codesShown` `[false, true]`; `ticketShown` true; `twoColumns` true;
  `passWidth` 272; `cardFullWidth` true; `cardHeight` ≤ 1000 (vừa một trang A4); `breakInside`
  `avoid`; `passBackground` `rgba(0, 0, 0, 0)`; `passBorder` `solid 2px`; `titleInk`,
  `subtitleInk`, `passInk`, `barInk` true. Ở `voucher-refunded.html`: như trên nhưng
  `codesShown` `[]`, `barInk` null, `ticketShown` true (dải "no longer valid" in ra). Ở
  `receipt.html`: `chromeShown` true, `stubTop` `dashed 1px`, `stubBreak` `avoid` — quy tắc in
  của hoá đơn không bị khối voucher chạm vào. Chụp một ảnh `voucher-dark.html` sau khi đổi.

- [ ] **Bước 8. So với bản vẽ.** Máy chủ thứ hai (Git Bash):
  `python -m http.server 8768 --directory docs/design/mockups`; mở
  `http://localhost:8768/booking-voucher.src.html` ở 1280px, chụp một ảnh đặt cạnh ảnh Bước 5.
  Khác biệt CỐ Ý (ghi vào bàn giao, không sửa): mảng teal là `primary` (bản vẽ đậm hơn), cột
  trái hẹp hơn vì lề ngang khớp hero (`xl:px-32`), mộc nằm cùng hàng tiêu đề thay vì tuyệt đối,
  ngày không có thứ ("3 Nov 2026"), dòng tiền ghi "3 adults" không kèm "× $49.00", số tiền làm
  tròn như hoá đơn, chip "Hotel pickup" không có (spec chỉ có hai chip), nút Copy viền thay vì
  nền tối (`CopyCodeButton` dùng chung, không sửa).

- [ ] **Bước 9. Dọn đồ tạm.** Tắt hai máy chủ tĩnh (PowerShell):
  `Get-NetTCPConnection -LocalPort 8767,8768 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`;
  xoá `apps/web/src/components/__layout-check__/` và `apps/web/.next/layout-check/`. Trả khổ
  Browser pane về `desktop`. `git status` chỉ còn `apps/web/src/app/globals.css` sửa.

- [ ] **Bước 10.** Có phép đo trượt: sửa đúng chỗ (TDD nếu là logic), gate, commit
  `fix(web): …` mô tả lỗi bố cục; dựng lại spec tạm và đo lại. Ghi MỌI số đo (cả lần trượt)
  vào bàn giao.

- [ ] **Bước 11.** Chạy quy trình gate ở mục Ràng buộc toàn cục (đủ năm bước, trên đỉnh nhánh; ghi
  số test từng gói và số int), rồi commit (stage `apps/web/src/app/globals.css`):
  `feat(web): bản in voucher — chỉ in thẻ, mảng teal nền trắng viền teal`

- [ ] **Bước 12. Soát nhánh.** `git log --oneline main..HEAD` — đúng các commit của phần C (C1–C5,
  cộng `fix(web)` của Bước 10 nếu có), không commit lạ. `git diff --stat main..HEAD` không chạm file
  nào ngoài "Bản đồ file" của phần C. Các phép grep phải RỖNG:
  - `grep -rn "bg-primary-emphasis" apps/web/src/components/checkout`
  - `grep -rn "nextHeading\|nextEmail\|nextVoucher\|nextManage" apps libs --include=*.ts --include=*.tsx`
  - `grep -rn "#[0-9a-fA-F]\{3,8\}\b" apps/web/src/components/checkout/voucher-*.tsx`

- [ ] **Bước 13. Docs.**
  - `docs/CHANGELOG.md` — chèn ngay dưới khối `> **File này chỉ giữ đợt đang chạy**…`, TRÊN
    entry mới nhất. Ngày là ngày chạy bước này. Khuôn:

```markdown
## 2026-MM-DD — P7 phần C: voucher `/checkout/success` thiết kế lại (nhánh `feat/booking-pages-redesign`)

Đơn đã trả mở `/checkout/success?code=` thấy voucher mới theo bản vẽ
`booking-voucher.src.html`: một thẻ `max-w-7xl` chia đôi. Cột trái có mộc trạng thái, tiêu
đề, thẻ ảnh bìa với dòng "{nơi} · {D} days", tổng đã trả và hai chip kính mờ, bốn ô có icon
(Meeting point lấy từ tour, Paid with, Lead traveller, Need help?). Cột phải 440px mảng teal
có ô mã đơn, ngày đi và "Admit n", dòng điều kiện, mã vạch, Receipt overview và Trip journal.
Spec P7 §2.6 và §6; luật giai đoạn ở ADR-0054. Không đổi API, không migration, không env.

`voucherView` (hàm thuần ở `apps/web/src/lib/voucher.ts`) phân biệt **vừa trả** (PAID và
`paidAt` cách lúc render không quá 30 phút: "Your day in … is booked." hoặc "Your trip to …
is booked.", pháo giấy một lần mỗi tab) với **mở lại** ("Your trip voucher", không pháo
giấy), và đổi ô mã, mã vạch, dòng điều kiện, nhật ký theo `bookingPhase`. Đơn chưa có
`paidAt` giữ hoá đơn chờ `BookingReceipt` cùng `CheckoutAutoRefresh` như cũ. Điện thoại: ô
mã gọn ngay dưới tiêu đề, mảng teal xuống cuối. Bản in chỉ in thẻ: giấu navbar, hero,
footer và nút; mảng teal nền trắng viền teal; mã vạch mực đen; mực tối cả khi đang ở giao
diện tối. Trang không tìm thấy đơn trỏ "My bookings" về `/account/bookings`. Mảng teal dùng
`bg-primary` thay `bg-primary-emphasis` của spec (token vai chữ, dark mode sáng lên).

(Một đoạn chỗ lệch plan nếu có, kèm lý do. Một đoạn số đo C5: 1280px, 375px và bản in giả
lập 718px, cả giao diện tối.)

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **N** (web …, api …, admin …, contract …, core …, ui …, tokens …, i18n
…) và int **N ở N file**. Ca mới ở web: voucher.spec …, voucher-overview.spec …,
voucher-pass.spec …, voucher-card.spec …. Đột biến đã thử: … (kể cả cái không giết được).
```

    Không để dòng nào bắt đầu bằng `+`; tổng số test gói trọn trong một dòng hoặc nối bằng chữ
    "và". `git diff docs/CHANGELOG.md` chỉ có phần thêm.
  - `./scripts/docs-freshness.sh` (Git Bash) — xanh.
  - Commit (stage `docs/CHANGELOG.md`): `docs: entry CHANGELOG cho P7 phần C (voucher)`

- [ ] **Bước 14. Dọn máy.** Tắt API (lệnh PowerShell ở Quy trình gate). Không còn tiến trình nào nghe
  cổng 3001, 8767, 8768. Xoá `apps/*/.turbo`, `.turbo` gốc và `apps/*/.next` nếu còn; báo dung
  lượng ổ C trước và sau.

- [ ] **Bước 15. Bàn giao** — KHÔNG merge, KHÔNG push. Báo cho session gốc: danh sách commit · kết
  quả gate (số test từng gói, số int) · đột biến đã thử và kết quả (kể cả cái không giết được,
  kèm lý do) · số đo Bước 5–Bước 7 kèm ảnh chụp · khác biệt so với bản vẽ ở Bước 8 · chỗ lệch plan và vì
  sao · việc cần hạ tầng (dự kiến: không có).

#### Sau khi bàn giao — việc của session gốc (phần C)

1. Review nhánh ở mức max effort, vá TRỌN phát hiện trên chính nhánh này. Đọc kỹ: biên 30
   phút và luật "chỉ PAID" của `justPaid`; đơn chưa trả vẫn ra hoá đơn chờ, và lúc webhook về
   thì `CheckoutAutoRefresh` đưa trang sang voucher có pháo giấy; ô mã đôi (điện thoại, màn
   rộng, bản in) không bao giờ hiện cả hai; khối in neo đúng `[data-slot="voucher"]` (trang huỷ
   không đổi); `bg-primary` thay `bg-primary-emphasis`; câu "a copy
   is on its way" (lệch chữ bản vẽ, có lý do); lỗi đọc tour không làm sập voucher.
2. Hỏi user trước khi merge; rebase lên `main` (đã có phần A, B), `git merge --ff-only`, push
   bằng SHA đích danh; `gh run list --branch main --limit 1` phải xanh.
3. Deploy: chỉ web — Vercel tự deploy khi push `main`. Không migration, không env, không Render
   (phần C không đổi API).
4. Entry CHANGELOG ngày merge (rebase đổi ngày commit — bẫy `docs-freshness` khi merge qua
   ngày); dòng P7 ở `docs/open-items.md` và roadmap trong `CLAUDE.md`.
5. Thử tay trên production theo spec §11 bước 7–10, TỪNG BƯỚC, chờ user xác nhận mỗi bước;
   session gốc kiểm DB bằng SQL chỉ đọc (`bookings.status`, `paid_at`) khi cần:
   - bước 7 — user tự đặt một chuyến và tự nhập thẻ thử Stripe trên trang cổng: tiêu đề
     "… is booked.", pháo giấy; tải lại trong cùng tab thì không bắn lại;
   - bước 8 — sau 30 phút mở lại từ "View voucher" ở trang chi tiết đơn: "Your trip voucher",
     dòng "Booked on …", không pháo giấy;
   - bước 9 — xem trước bản in của trình duyệt (Ctrl+P): một trang, không navbar, hero, footer
     hay nút; mảng teal nền trắng viền teal; mã vạch đen; thử thêm một lần ở giao diện tối;
   - bước 10 — điện thoại 375px: ô mã gọn ngay dưới tiêu đề, mảng teal ở cuối không có ô mã thứ
     hai, không cuộn ngang.
6. Đơn thử của bước 7 là dữ liệu thật trên prod (sandbox): hỏi user huỷ trong hạn (hoàn đủ ở
   sandbox) hay để tới lượt seed lại ~03/11; ghi vào bản nhớ "dữ liệu thử tay còn sót".
