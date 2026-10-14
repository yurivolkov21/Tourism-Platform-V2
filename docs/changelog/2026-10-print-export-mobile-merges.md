# CHANGELOG — lưu trữ: bản in và file xuất G40, gộp ba nhánh mobile (12/10/2026)

Ba phần của G40 (bản in voucher và hoá đơn chờ, bản in báo cáo tháng, Excel
báo cáo và danh sách) lên production, cùng ba nhánh mobile của thành viên khác
được review, vá tại chỗ rồi gộp: xem tour, đặt tour, đánh giá.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 14/10/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`, và
link tới tài liệu dời thư mục cùng ngày 14/10 trỏ sang chỗ mới. Đừng
mở-rồi-save bằng editor có markdownlint: nó đổi `+` đầu dòng thành `-` và nói
sai con số test đã ghi.

## 2026-10-12 — Thử tay G40 Phần 3 trên production 4/4 bước; đóng G40, ghi G43

**Thử tay** (spec §10 bước 5–6 chia thành bốn bước; sau push `9877e518`: Vercel web và admin READY,
Render live 11:20 UTC; Actions của `9877e518` bị push Phần 2 huỷ ở bước bundle mobile sau khi int,
build, typecheck và test đã xanh, run trên `c0dbb6e8` chứa trọn Phần 3 xanh 9m15s; user mở file bằng
Excel trên máy mình, gửi ảnh, session gốc đối chiếu):

1. Excel báo cáo tháng 9: Summary đúng D1 (thanh `REPT`, ngày tiếng Anh); sheet Detail có Refunded
   thật (35,00 ở các đơn huỷ); bấm mã đơn trong Excel mở thẳng trang đơn của admin, không qua form
   đăng nhập.
2. Bookings lọc Cancelled (tháng 10): nhãn cột đủ, không cột nào bị nút lọc che; Refunded 0,00 cho
   đơn chưa trả đã huỷ, 2,00 cho đơn đã hoàn; hàng Total 2 khách, 47,00 và 2,00.
3. Bookings tích ba hàng rồi xuất: file đúng ba hàng đã chọn; hàng Total 3 khách, 86,00 và 2,00.
4. Subscribers tab mặc định: Status "Active" hoặc "Awaiting confirmation", ba cột giờ Việt Nam đủ
   nhãn, ngày tiếng Anh.

**G40 đóng:** cả ba phần đã merge và thử tay production đạt (Phần 1 năm bước, Phần 2 bước 4, Phần 3
bước 5–6). Việc liên quan còn mở có mục riêng: câu `heldNote` của `/checkout/cancel` (G37), màn
hình hoá đơn chờ (G42) và lọc ngày, chọn hàng ở `/subscribers` (G43, bên dưới).

**G43 (mới):** ở bước 4 user để ý `/subscribers` không có ô tích chọn hàng, không lọc khoảng
ngày, nên mỗi lần xuất gần như cả danh sách. Thiết kế F10 (P4c, 02/09) chỉ có tab, tìm email, lọc
nguồn; chọn hàng và khoảng ngày làm cho `/bookings` từ trước, chưa xét lại cho `/subscribers`.

## 2026-10-12 — Thử tay G40 Phần 2 trên production: in `/reports` tháng 9 và tháng 10 đạt

**Thử tay** (spec §10 bước 4, sau push `c0dbb6e8`: Actions xanh 9m15s, Vercel web và admin deploy
xong; Render không xem được từ session cloud, nhánh không đổi API): user in `/reports` trên admin
production cho tháng 9 và tháng 10, báo kết quả đúng như mong đợi. User đã xoá nhánh
`claude/g40-part2-report-print` trên origin.

Push `c0dbb6e8` làm run CI của `9877e518` (merge Phần 3) bị huỷ giữa chừng vì `cancel-in-progress`;
bước build, typecheck, test của run đó đã xanh, và run của `c0dbb6e8` gồm trọn commit Phần 3 cũng
xanh.

**CÒN TREO:**

- Nhánh sao lưu `backup/g40-tam-dung-2026-10-10`: ba phần G40 đã lên main, user quyết giữ hay xoá.
- Docs, không đổi mã; không migration, không env.

## 2026-10-12 — Merge G40 Phần 2 lên main: bản in báo cáo tháng C2 ở `/reports` (`bbb4f3a6`..`e1c3f8c8`)

Bấm Print hay Ctrl+P ở `/reports` nay ra tờ A4 C2 thiết kế riêng thay vì trang màn hình đem in:
đầu trang nội bộ, tiêu đề và dòng kỳ, bốn ô số (Revenue recognised nền `paper`, Gross profit, Net
profit, Cash collected), thác nước "From revenue to net profit" cạnh bảng lãi lỗ kiểu kế toán,
thanh 100% "Bookings created this month" đủ năm trạng thái, lưới tám chỉ số vận hành, bảy chú giải
đánh số theo thứ tự sheet Definitions của Excel Phần 3, chân trang nội bộ. Spec G40 §5,
[ADR-0057](../adr/0057-print-documents.md), [plan](../plans/2026-10-12-g40-part2-report-print.md). Không
đổi API, không migration, không env, không thêm dependency.

- `@tourism/i18n`: khối `admin.reports.printDoc`. Tám khoá dùng chung với Phần 3 (`reportTitle`,
  `periodLine`, `waterfallHeading`, ba `cards.*Caption`, namespace `admin.exportFile`) đã lên main
  cùng Phần 3; nhánh này chép nguyên văn nên rebase gộp sạch, commit i18n chỉ còn `printDoc`.
- Admin, view-model thuần `lib/report-print.ts`: nhãn tiền ngắn, số kế toán định dạng thẳng trên
  chuỗi thập phân, vạch lưới "đẹp", hình học thác nước (miền chứa 0 nên tháng lỗ có cột dưới trục,
  tỉ lệ co để nhãn dưới cột không chạm hàng nhãn hạng mục, lề phải cho nhãn trục), hình học thanh
  trạng thái, `reportPrintView`. Component ở `components/reports/`: `report-print`, `waterfall`,
  `status-bar`, `hatch`, `report-print-brand`.
- Màu: năm trạng thái `chart-gain` · `chart-3` · `pending` · `info` · `chart-cost`, qua bộ kiểm
  dataviz (mù màu xấu nhất 15.0, mắt thường 20.1, tương phản từ 3:1). Vân cho in trắng đen:
  Cancelled 45°, Refunded 135°, Pending ngang vì in xám nó trùng độ sáng Paid; cột chi phí của thác
  nước cũng vân 45°.
- CSS: khối `@media print` chung của admin chỉ áp khi trang không có tài liệu in
  (`:root:not(:has([data-print-doc]))`), tờ in nhận bảng màu trung tính của admin; màn hình
  `/reports` bọc `print:hidden`, gỡ class in đã chết ở `report-tables.tsx`.
- Bố cục một trang: khoảng giữa các khối là phần tử co giãn trong cột flex của `DocPage` (dài như
  bản thảo, co tới mức sàn khi tháng nặng); nhịp chữ theo bản thảo (cỡ nền 9 pt, tên khối 10.5 pt,
  dãn dòng `normal` ở chỗ bản thảo khai bằng shorthand `font:`).

Nhánh `claude/g40-part2-report-print`, rebase hai lần: lên `755fe9f3`, rồi lên `9877e518` khi Phần 3
vừa lên main. 8 commit (đầu nhánh cũ `cfb88986`: `a1ef73bc`, `a1b7def0`, `536e2073`, `8dfdd3b7`,
`ea5188b5`, `154eb36a`, `157bdfab`, `cfb88986`) nay là `bbb4f3a6`, `c98bf2e3`, `b7d15f51`,
`e228a19f`, `1117e4a9`, `dae78113`, `c1871fe4`, `e1c3f8c8`. Xung đột duy nhất là hai khối test
i18n mới cùng chỗ trong `messages.spec.ts`, giữ cả hai.

**Duyệt bằng mắt 12/10.** Session cloud đo bằng Chromium headless (route đo tạm `zz-print` không
commit) và ghép ảnh cạnh bản thảo C2; user chọn merge sau khi nhận ảnh. Số đo trên code cuối: mười
tháng seed (2026-01 tới 2026-10) đúng một trang, dư 13.8 mm trên chân trang (bản thảo 13.4), không
nhãn SVG nào chồng nhau, chữ phụ và nét kẻ đúng token admin, không phần tử nào ngoài tờ hiện khi in;
mười bảy ca fixture một trang, ca chật nhất còn 2.2 mm (lãi ròng −$106k cùng cảnh báo giá vốn hai vế
và năm trạng thái; ca số hàng triệu); hộp lạ cao 300 mm chèn sau tờ vẫn một trang. Giới hạn ước
tính, chưa đo: tháng lỗ hàng triệu đô cùng đủ mọi thứ khác mà thêm một nhãn bảng lãi lỗ xuống dòng
thì chân trang bị cắt.

**Review findings:** review max 12/10 (skill code-review) trên `ae727bce..154eb36a` (hash trước
rebase), sáu phát hiện, vá hết ở `c1871fe4` và `e1c3f8c8`:

- Cờ `dense` cộng phần tờ cao thêm theo số đo bỏ sót tháng lỗ: ngoặc ở cột số đẩy nhãn chi phí
  xuống dòng, ca lãi ròng −$106k cùng cảnh báo hai vế tràn 0.26 mm. Thay bằng khoảng co giãn để bố
  cục tự co đúng phần thiếu, như một phát hiện khác của review đề xuất.
- `shortMoney` làm tròn hai lần: 1,049.62 ra "$1.1k", 39,649.5 ra "$39.7k". Nay làm tròn một lần từ
  giá trị gốc.
- Luật canh CSS in chỉ xét khối `@media print` đầu tiên và bỏ qua cả rule có selector đầu `:root`.
  Nay xét mọi khối media có `print`, kể cả lồng trong `@layer`, và mọi selector.
- Vân 45° viết hai lần, nay là `Hatch` dùng chung.
- Plan lệch code: hằng tỉ lệ 165.5, khối interface, số thứ tự quyết định.

Thêm theo lưu ý của review Phần 3: tháng lỗ nặng (chi phí gấp gần 60 lần doanh thu ghi nhận) giữ
mọi cột, vạch, nhãn trong khung, có test; cả tháng một trạng thái phủ kín thanh, chú thích "100%".
Số hoàn tiền của lưới chỉ số đọc `refundedTotal` và `refunds` của API báo cáo tháng (sổ cái
`refunds`), không đọc API danh sách đơn, nên không dính lỗi cột Refunded luôn 0.00 mà Phần 3 vá ở
`c0f6c145`: tháng 9 seed in $2,383.30 và 10 lượt, khớp DB. Đột biến: 24/24 ở view-model, 14/14 ở vòng vá
review.

Tests after (`gate:int` trên `e1c3f8c8`, 12/10, sau rebase lên `9877e518`): unit 7034 — web 2233,
admin 1998, api 1097, mobile 738, contract 675, mobile-ui 136, ui 47, core 46, i18n 43, tokens 21 —
và int 782/46. So với main: admin 1941 → 1998 (view-model 40, tờ in 15, luật CSS in 2), i18n 41 → 43.

**CÒN TREO:**

- [ ] Push đụng admin và i18n: canh đèn Actions, Vercel admin, Render.
- [ ] Thử tay prod theo spec §10 bước 4: in `/reports` tháng 9 và tháng hiện tại.
- Dọn sau merge: nhánh `claude/g40-part2-report-print` ở origin (session cloud không xoá được nhánh,
  user xoá). Nhánh sao lưu `backup/g40-tam-dung-2026-10-10`: ba phần G40 đã lên main, user quyết
  giữ hay xoá.
- Không migration, không env, không webhook, không đổi Cloudinary.

## 2026-10-12 — Merge G40 Phần 3 lên main: Excel báo cáo tháng D1, hai danh sách xuất Excel thay CSV (`8fedbb71`..`a7e7b136`)

Phần 3 của [spec bản in và file xuất](../specs/2026-10-10-print-and-export-redesign-design.md), theo
[ADR-0034](../adr/0034-excel-report-export.md) AMEND 3, thi công 10/10. Excel báo cáo tháng thành
dashboard D1: Summary có bốn ô số, thác nước từ doanh thu ghi nhận tới lãi ròng vẽ bằng `REPT`,
bảng trạng thái và bảng tiền; bốn sheet còn lại (Bookings, Operations, Detail, Definitions) có mã
đơn bấm được và hàng Total `SUBTOTAL`. `/bookings/export` và `/subscribers/export` xuất Excel thay
CSV (gỡ `csv.ts`, `bookings-csv.ts`, `subscribers-csv.ts`): ô đúng kiểu, ngày ép tiếng Anh
`[$-409]`, mốc thời gian theo giờ Việt Nam, khung in A4 có đầu và chân trang, nút ghi "Export
Excel". Bộ đồ nghề chung ở `apps/admin/src/lib/xlsx-style.ts`. API: `admin.bookings.list` nay điền
`refundedTotal` thật (shape contract không đổi, thêm một câu gom mỗi trang). Không migration, không
env, không thêm dependency.

Rebase lên `755fe9f3`: 8 commit thi công (đầu nhánh cũ `2fb4d5d9`: `26af0bf7`, `e7d8c304`,
`43c89248`, `4dabb116`, `b2d5b7e9`, `8bc2be7a`, `071f837f`, `2fb4d5d9`) nay là `8fedbb71`,
`ee116ed6`, `33379408`, `2d4b313a`, `33665ce4`, `fc6921ea`, `f0fcf039`, `8f8fcbfd`. Gỡ xung đột
`messages.spec` (giữ cả hai khối test).

**Review max 12/10.** 15 phát hiện, vá 14 trên nhánh, bỏ một:

- `9ba5e6d7` (#1, nặng): ExcelJS ghi thẳng U+FFFE/U+FFFF vào XML, nên một ký tự như vậy trong nguồn
  đăng ký (form công khai) hay tên, điện thoại của khách là Excel không mở được cả file. Chữ khách
  nhập nay đi qua `cellText`: bỏ ký tự XML cấm, và (#6) thêm dấu nháy cho chữ mở đầu như công thức,
  vì ADR-0034 AMEND 3 dặn Save As CSV mà CSV mở lại thì công thức chạy.
- `c0f6c145` (#2, nặng): cột Refunded của danh sách đơn và sheet Detail luôn 0.00 vì
  `adminList` để mặc định của `toBooking`. Nay một câu `refund.groupBy` cho cả trang; int test mới
  cho cả hai đường (có và không `includeMedia`).
- `9ba5e6d7` và `56702b39` (#3): thanh thác nước không có trần, nên tháng lỗ cho chuỗi quá 65 nghìn
  ký tự làm Excel không mở file, quá 32.767 thì `REPT` ra `#VALUE!`, tỉ lệ cực lớn ném `RangeError`
  sau khi audit đã ghi `ok`. Nay trần 50 ký tự, và ba route ghi audit `ok` chỉ sau khi dựng xong
  (`xlsxAfterBuild`; dựng lỗi thì ghi `failed`, trả 502 có lời).
- `9ba5e6d7` (#4): hàng chọn theo ngày UTC mà mốc ghi giờ Việt Nam, hàng ở mép khoảng trái với
  khoảng in trên đầu trang. Đầu trang nay ghi khoảng ngày kèm "(UTC)".
- `a7e7b136` (#5): bấm mã đơn trong Excel trên Windows rơi về form đăng nhập dù đang đăng nhập:
  Office tải URL trước, không mang cookie, proxy trả `/login?redirect=…`. Trang login nay hỏi
  `loginDestination` (hàm thuần, có test): phiên ADMIN thì chuyển thẳng tới đích qua
  `safeRedirect`; chỉ hỏi API khi có cookie phiên. Tên cookie phiên gom về `session-cookie.ts`.
- `9ba5e6d7` (#7): đầu trang cắt 100 ký tự TRƯỚC khi nhân đôi `&` và cắt từ cuối, nên có thể quá
  255 ký tự (Excel không mở file) và mất phần "n selected rows". Nay cắt theo chỗ còn lại sau khi
  nhân đôi, từ khoá cắt ở 40 ký tự.
- `9ba5e6d7` (#8, #12, #13): dòng 0.00 của thác nước vẽ một ô màu chi phí, nay để trống; cảnh báo
  thiếu giá vốn hai vế rơi ra ngoài vùng in A:I, nay gộp B:I và xuống dòng; subscribers in khổ ngang
  như bookings.
- `9ba5e6d7` (#9): đầu trang gọi tab mặc định là "Active" trong khi cột Status chỉ gọi "Active"
  địa chỉ đã xác nhận. Nay ghi "Active and awaiting confirmation".
- `9ba5e6d7` (#10): mốc giữ phần nghìn giây, Excel làm tròn lên giây rồi mới cắt phút, nên có ô
  sang phút sau, có khi sang ngày sau. Nay bỏ phần nghìn giây.
- `9ba5e6d7` (#11): nhãn tiêu đề bị cắt, cột rộng 9 bị ExcelJS bỏ khi ghi. Đo lại bằng Excel 16;
  lúc mở file xuất từ dữ liệu seed còn thấy nút lọc che "Children", "Price per person", "Currency"
  và tên tour dài bị cắt, nên mỗi cột cộng chỗ cho nút lọc, cột Tour 46 như sheet Detail.
- `9ba5e6d7` (#14): `sumMoney` tự làm phép tính cent, nay dùng `toCents`/`fromCents` của contract;
  JSDoc của `money()` trích ADR-0034 §2 thay cho một luật CLAUDE.md không có.
- Bỏ #15: gom phần dựng sheet chép lặp ở năm builder thành một `dataSheet()` — tái cấu trúc rộng,
  sát freeze. Riêng hàm giờ Việt Nam chép đôi đã gom về `dateTime()` của `xlsx-style.ts`.

Kiểm bằng Excel thật (12/10, Excel 16 trên máy user, định dạng vi-VN): tải sáu file qua route thật
của admin chạy local với dữ liệu seed (báo cáo tháng 9 và tháng 10, bookings tháng 9 cả tập và bốn
hàng chọn, lọc Refunded có từ khoá, subscribers). Mọi file mở không lỗi; ngày tiếng Anh; cột Refunded
khớp DB ở cả 40 đơn có hoàn; vết audit ghi `ok` sau khi dựng. Ảnh và ba file mẫu gửi user duyệt.

Tests after (`gate:int` trên `a7e7b136`, 12/10): unit 6975 — web 2233, admin 1941, api 1097,
mobile 738, contract 675, mobile-ui 136, ui 47, core 46, i18n 41, tokens 21 — và int 782/46. So với
main: admin 1911 → 1941, i18n 36 → 41, int 781 → 782 (Refunded của danh sách đơn).

## 2026-10-12 — Merge nhánh `fix/mobile-review-screens` lên main: P5b-5 đánh giá R1–R7 (`f5244d4c`..`4200735f`)

Cụm màn đánh giá của Nghia (P5b-5, [handoff đánh giá](../handoff/mobile-review-handoff.md)): R1 viết
đánh giá từ chuyến đã về (nút ở P6), R2 ảnh ký `media.signUpload` rồi tải thẳng Cloudinary (tối đa
5), R3 đã gửi, R4 My reviews bốn trạng thái, R5 viết lại bài bị bác, R6 hết lượt viết lại, R7 rút
bài đã đăng. Kèm bản vá V1–V9, Q2, Q3 của [review 05/10](../reviews/review-feat-mobile-review-screens.md)
cùng [hướng dẫn test](../reviews/testing-guide-review-fixes.md); Account và Personal details về đúng mockup
A1/A2 (V4). API: `MyReviewSchema` thêm `bookingCode` và `tourImage` (đều nullable), trả ở
`reviews.mine`, `update`, `retract` và khối review của `bookings.byCode`; ảnh bìa ở `mine` gom một
lượt cho cả trang (V5). Không migration, không env, không thêm dependency.

Rebase lên `ae727bce`: 8 commit riêng của Nghia (`c11091e9`, `8e9b79f5`, `05888cd3`, `15b4d081`,
`818f900a`, `ea154d49`, `94e0fdc4`, `525f4c04`) nay là `f5244d4c`, `5eda8e52`, `e54f9ce0`,
`be899663`, `cccae521`, `477c0c0c`, `6090493f`, `8bbee6ce`. `cc02e089` và `a1151721` đã vào main ở
merge đặt tour (`6373ab75`, `0ce5d4a4`); bỏ `4f9def36` như lần đó. Xung đột duy nhất là dòng bản đồ
ở `docs/README.md` (giữ cả hai); `trips/[code]/index.tsx` và `routes.spec.tsx` git tự gộp, đã đối
chiếu tay với bản vá N3/N5 của main.

**Review 12/10 trên session cloud.** V1–V9, Q2, Q3 đúng như hướng dẫn test; Q1 xong (8 commit
không còn dòng attribution). Ở màn của main, P6 chỉ nối nút "Write a review", Account chỉ nối dòng
My reviews. Tám phát hiện mới, vá hết trên nhánh review `claude/mobile-review-screens-review` (vá
tại chỗ như hai nhánh mobile trước):

- `60877663` (M1, chặn merge): sau rebase, typecheck mobile đỏ. Bản hoàn lại V4 gỡ cả
  `import { router }` ở Personal details vì gốc nhánh chỉ dòng Password dùng nó, còn main từ 06/10
  (F6) gọi `router.replace('/')` sau khi xoá tài khoản.
- `596ac8ce` (M2): R5 dùng lại màn đã gửi của R1, nên nút "Back to my trip" lùi về My reviews
  (cùng loại lỗi V8) và link "See my reviews" đẩy một R4 thứ hai lên stack. Nay R5 ghi "Back to my
  reviews" và ẩn link; spec mới cho màn đã gửi.
- `43f7e094` (M3): R1 gửi xong không làm mới `reviews.mine`; danh sách đã mở trước đó trong phiên
  hiện bản cũ cho tới khi tự tải lại.
- `402a876f` (M4): thẻ bị bác đủ hai lần vẫn mời "See why and rewrite" dù nút sửa đã đóng (mockup
  R6, handoff mục 7.3). Nay ghi "See why" (khoá `reviews.mine.seeWhyFinal`); spec mới cho R4.
- `ceebdaff` (M5): header R5 ghi "Rate this trip", mockup ghi "Rewrite your review" (khoá
  `reviews.rewriteHeading`); thẻ chuyến ở R5 in ngày viết bài vào chỗ R1 in ngày đi, nay chỉ giữ
  mã booking.
- `95ae6e4a` (M6): `bookingCode` và `tourImage` của `reviews.mine` (R5 cần để ký ảnh mới) chưa có
  int test; thêm ca hai tour, một có bìa một không.
- `f73a4d61` (M7): `huong-dan-test-may-that.md` mục D1/D2 còn tả sheet "Help & legal" và Password
  trong Personal details, tức bản đã hoàn lại ở V4.
- `4200735f` (M8, chặn merge): sau rebase typecheck web cũng đỏ vì fixture `makeReview` (thêm 09/10
  ở đợt vá P7 Phần B) thiếu hai trường mới của `MyReviewSchema`. Gate lượt đầu không thấy vì turbo
  dừng ở typecheck mobile (M1) trước khi typecheck web chạy xong.

Tests after (`gate:int` trên `4200735f`, 12/10 06:03–06:14, chạy trên cloud theo đúng các bước
của CI): unit 6940 — web 2233, admin 1911, api 1097, mobile 738, contract 675, mobile-ui 136, ui 47,
core 46, i18n 36, tokens 21 — và int 781/46. So với main: mobile 705 → 738 (nhánh của Nghia 27 ca,
bản vá review 6 ca: màn đã gửi 2, thẻ R4 4), int 779 → 781 (nhánh 1, M6 1). Hai lượt gate trước đỏ
ở typecheck (M1 rồi M8), nên lượt cuối chạy turbo với `--continue` để không lỗi nào bị che.

**CÒN TREO:**

- [ ] Thử máy thật cụm đánh giá: luồng C1–C6 của [hướng dẫn test máy thật](../guides/huong-dan-test-may-that.md)
  và hai đường của review 12/10 (R5 gửi lại xong bấm "Back to my reviews" về đúng danh sách, back
  thêm một lần là ra Account; thẻ bị bác hai lần ghi "See why" và mở R6). Ảnh bìa ở R5, R6 (V6) và
  thumbnail nhẹ ở R5 (V9) mới xác nhận qua code. Đã ghi ở open-items.
- [ ] Chưa kiểm: iOS (quyết bỏ 09/10), tải ảnh thật lên Cloudinary từ app.
- [ ] Bốn nợ nhỏ không chặn merge (R1 chỉ mở từ P6, rút bài không có toast, chữ lỗi ảnh ghi cứng
  "10 MB" và 5, back cứng mất bài đang gõ): mục mới ở open-items.
- Dọn sau merge: nhánh `fix/mobile-review-screens` và `claude/mobile-review-screens-review` trên
  origin (session cloud không xoá được nhánh trên GitHub).

## 2026-10-12 — Thử tay G40 Phần 1 trên production 5/5 bước sau bản vá `b5988b23`; ghi G42

**Thử tay** (spec §10 bước 1–3 chia thành năm bước; sau push `b5988b23` ba đèn xanh — Actions
14m03s, Vercel web và admin READY, Render live; user in bằng Edge thường có tiện ích, gửi ảnh khung
xem trước, session gốc đối chiếu):

1. Voucher một ngày BK-EET0JBTH (Hội An lantern evening): một trang, bìa tự thấp, chân trang tách
   khỏi dải cuối. Trước bản vá chính Edge này in hai trang.
2. Cùng voucher, giao diện tối, tắt "Background graphics": giấy vẫn sáng; ảnh bìa, dải teal của vé,
   mã vạch vẫn in.
3. Voucher nhiều ngày BK-QW3TNK58 (Hà Giang Loop 4D3N, đi 30/10): một trang, "Your trip · 4 days"
   đủ bốn ngày, bìa giữ 62 mm vì nội dung vừa.
4. Voucher đã đi BK-J9AUYIYB: không mã vạch, không lịch trình, dải Payment · Booking reference.
   Chuyến công ty huỷ BK-7D1FHRQG: mộc REFUNDED, dải "no longer valid", cuống "Refunded −$867.00".
   Mỗi bản một trang.
5. Đặt BK-DICJ1A7T (Bát Tràng, $45, Stripe test) rồi huỷ ở cổng: hoá đơn chờ in ở `/checkout/cancel`
   một trang, "Pay by 12:51" đúng 60 phút sau giờ đặt 11:51, chữ đậm và email xuống dòng như B1.

**G42 (mới):** ở bước 5 user để ý màn hình trang huỷ vẫn là hoá đơn `BookingReceipt` từ 19/08 —
spec P7 cố ý để đơn chưa trả ngoài phạm vi, G40 chỉ làm bản in B1. User chọn ghi thành việc treo vì
sát freeze 15/10; khi làm thì gộp phần chữ còn mở của G37 (`heldNote` gọi My bookings là "Trips").

**CÒN TREO:**

- [ ] G40 Phần 3 (nhánh `claude/g40-part3-excel-report-a7944d`): review max chưa chạy. Phần 2: viết
  plan sau khi Phần 3 review xong.
- [ ] G37 (`heldNote` của `/checkout/cancel`) và G42 (màn hình hoá đơn chờ): sau freeze, chờ user.
- Dữ liệu thử còn trên prod, để lượt seed lại ~03/11 dọn: đơn BK-DICJ1A7T (chờ trả, tự nhả sau 60
  phút).
- Docs, không đổi mã; không migration, không env.

## 2026-10-12 — Merge nhánh `fix/mobile-booking-screens` lên main: P5b-3 đặt tour, cụm P và tab Trips (`6373ab75`..`7b49291d`)

Cụm màn đặt tour của Nghia (P5b-3, [handoff đặt tour](../handoff/mobile-booking-handoff.md)): luồng
đặt B1–B9 (số khách, liên hệ, xem lại và trả, mở cổng, xác nhận, xong), chi tiết booking T5/T8,
cụm P bám ngày khởi hành P1–P6 (đếm ngược theo giờ server, lịch trình, ghi chú, ngày đang đi,
chuyến đã về) và tab Trips có chip Upcoming/Past. Kèm bản vá K1–K15 và Q1 của
[review 05/10](../reviews/review-feat-mobile-booking-screens.md) cùng
[hướng dẫn test](../reviews/testing-guide-booking-fixes.md); chú thích B9 trong mockup sửa theo mục 5 của
review đó. Không đổi API, không migration, không env, không thêm dependency.

Rebase lên `8c163cb2` lúc review, rồi lên `b5988b23` trước khi merge (main vừa nhận bản vá sau thử
tay G40 Phần 1, không xung đột code): 5 commit riêng của Nghia (`cc02e089`, `a1151721`, `c5cc35cb`,
`9b48fa9a`, `3d6b989c`) nay là `6373ab75`, `0ce5d4a4`, `eae67232`, `015098f9`, `2d65f2a3`; 56 commit
còn lại của nhánh gốc đã vào main qua nhánh account. Bỏ `4f9def36` (Q2: main ghim ngày cho cùng test admin ở
`b867596c`). Xung đột: `docs/open-items.md` giữ bản main, `docs/PROGRESS.md` xoá (Q3), import ở
`routes.spec.tsx` gộp hai bên.

**Review 12/10 trên session cloud.** K1, K3–K15 và Q1–Q3 đúng như hướng dẫn test; chỗ chạm main mới
(`leaveAuthTo`, G40 Phần 1) sạch. Năm phát hiện mới, vá hết trên nhánh review
`claude/mobile-booking-review` (Yuri chọn sửa tại chỗ thay vì trả nhánh):

- `7b1a745f` (N1): sau rebase, typecheck mobile đỏ — fixture `makeBooking` thiếu cờ bắt buộc
  `departureCancelled` mà main thêm 08/10 (ADR-0054 AMEND 1).
- `6a939e22` (N2): K2 mới sửa một nửa. React Query nhớ kết quả `select` riêng cho từng màn, nên màn
  mở sau lần gọi `health.check` đầu tính lệch bằng giờ máy lúc mở và đồng hồ bắt đầu lại từ mốc
  đầu: để app nền qua đêm thì P5 vẫn tưởng là hôm trước. Lệch nay đo bằng `dataUpdatedAt`.
- `0ce898eb` (N3): tab Trips và luật vào cụm P phân loại theo `status`, lệch `bookingPhase` mà API
  và web dùng: PARTIALLY_REFUNDED (vẫn đi) mất khỏi cả Upcoming lẫn Past, REFUNDED hoàn thiện chí bị
  coi là đã kết thúc, PENDING quá hạn chót vẫn mời "Finish payment", đơn PAID trên chuyến bị công ty
  huỷ hiện "On tour now" và vào cụm P. Nay cùng đọc `bookingPhase`; PARTIALLY_REFUNDED và REFUNDED
  hoàn thiện chí vào cụm P như PAID (mockup T1 ghi "đã huỷ/hoàn → T8" từ trước AMEND 1). Bảng luật
  vào màn của handoff sửa theo.
- `86c8fb4e` (N4): B4 gặp `NOT_PENDING` từ `bookings.checkout` (trả xong mà webhook tới muộn, hoặc
  cron đã huỷ) thì "Try again" gọi lại mãi; nay sang B6 đọc lại booking.
- `7b49291d` (N5): B9 "Choose another date" và B8 "Browse more tours" rời cụm bằng `replace`, dựng
  trang chồng lên trang tour (back hai lần mới ra; từ Home back lại về tour), cùng loại lỗi R3. Nay
  dùng `dismissTo`; `routes.spec.tsx` thêm hai ca chạy trên cây route thật, ca B8 đỏ trên code cũ.

Tests after (`gate:int` trên `7b49291d`, 12/10 04:28–04:37, chạy trên cloud theo đúng các bước
của CI): unit 6907 — web 2233, admin 1911, api 1097, mobile 705, contract 675, mobile-ui 136, ui 47,
core 46, i18n 36, tokens 21 — và int 779/46. So với main: mobile 509 → 705, mobile-ui 134 → 136;
bản vá review thêm 9 ca mobile (đồng hồ 1, Trips 5, B4 1, route 2). Một ca admin
(`photo-library-dialog.spec.tsx`, ảnh tải hỏng AL4) đỏ một lần khi cả repo chạy trên máy cloud tải
nặng; chạy riêng và lượt sau đều xanh, nhánh không đụng admin.

**CÒN TREO:**

- [ ] Thử máy thật các đường của review 12/10: để app nền qua đêm rồi mở chuyến đang đi (P5 đúng
  ngày); B9 về đúng trang tour, back một lần là ra; B8 mở Explore, back về Home rồi hết; đơn hoàn
  một phần mở cụm P và còn nút huỷ ở hoá đơn.
- [ ] Chưa kiểm: iOS (quyết bỏ 09/10), PayPal sandbox thật.
- [ ] Mobile chưa nói chuyến bị công ty huỷ trong lúc chờ job hoàn tiền: thẻ Trips ghi "Paid", hoá
  đơn thiếu khối báo như web. Mục mới ở open-items.
- Dọn sau merge: nhánh `fix/mobile-booking-screens` và `claude/mobile-booking-review` trên origin
  (session cloud không xoá được nhánh trên GitHub).

## 2026-10-12 — G40 Phần 1 thử tay production: trang 2 trắng do tiện ích trình duyệt, voucher dài hơn tờ với dữ liệu thật (`402b91b2`, `4a06f528`, nhánh `claude/project-thread-bfjal2`)

**Thử tay bước 1** (spec §10, sau push `3e409626`; user in voucher BK-EET0JBTH ở
`/checkout/success` bằng Edge): trang 1 đúng 5b, nhưng hộp in báo hai trang, trang 2 trắng mang ngày
giờ và tiêu đề tab của trình duyệt. Cửa sổ InPrivate chỉ một trang, tức một tiện ích của Edge chèn
phần tử vào trang. Đo Edge headless: chỉ cần một hộp rỗng nằm sau tờ là trình duyệt ép sang một
trang mặc định có lề (tên trang đổi từ `doc` về mặc định); tờ cao hơn A4 0,3 mm thì sang trang 2
nhưng vẫn trang `doc`, không ngày giờ. Trang công khai của production chèn tờ giả thì in một trang,
nên lỗi không nằm ở site.

- `402b91b2` luật in chung của `@tourism/ui`: `html`, `body` của trang có tài liệu cũng mang trang in
  `doc`; luật giấu mọi thứ ngoài tài liệu dùng `!important`; giấu cả phần tử chèn thẳng dưới
  `<html>`. Giả lập bảy kiểu chèn (div cuối body có hay không `!important`, phần tử con của
  `<html>`, custom element cố định, shadow host kiểu Grammarly): sáu kiểu về một trang; phần tử có
  chữ ép hiện bằng `!important` inline vẫn sang trang 2 nhưng lề 0, không ngày giờ, URL.

**Voucher dài hơn tờ với dữ liệu thật.** Dựng lại cây JSX của `/checkout/success` trên route đo tạm
với tour thật từ API local: tour Hội An lantern evening dài hơn tờ 5,6 mm, chân trang dính vào dải
cuối (khớp ảnh user chụp). Đo voucher của cả 29 tour seed, 59 biến thể (sắp đi; đang đi ngày 1 và
ngày cuối của tour nhiều ngày): 12 biến thể tràn tới 6,5 mm. Các lần đo 10/10 và sáng 12/10 chỉ dùng
dữ liệu mẫu. User chọn "bìa thấp khi dài" trong ba cách (bìa thấp khi dài, kẹp một dòng khi dài,
siết khoảng cách chung).

- `4a06f528` bìa là khối duy nhất co được trong cột flex của tờ: 62 mm, co tới 52 mm (đầu trang và tên
  tour hai dòng cần 49,4 mm), trình duyệt tự đo nên chính xác. Bìa 52 mm vẫn không đủ theo ước lượng
  (`flexHeightMm`, `flexBudgetMm`) thì mục lịch trình và mục gồm kẹp một dòng (`oneLine`). Số ký tự
  mỗi dòng lấy từ số đo mọi mục của tour seed: mục lịch trình có giờ ngắn hơn 45 ký tự, mục gồm ngắn
  hơn 53 ký tự chưa từng gãy dòng.
- Đo lại 59 biến thể: không biến thể nào tràn hay phải kẹp một dòng, chữ in đủ, bìa thấp nhất 55,6
  mm; ước lượng chưa ca nào thấp hơn thật quá 0,1 mm. Ca cực hạn giả (12 mục lịch trình dài, 8 và 8
  mục gồm dài, điểm hẹn dài) kẹp một dòng vẫn vừa một trang. Ảnh sau sửa trong Library của project.
- Spec §3.1, §3.4 (luật bìa co giãn, ca cực hạn), §9 (đo cả dữ liệu thật và phần tử lạ sau tờ);
  ADR-0057 §1, §2.

**Review findings:** không chạy review riêng — hai bản vá nhỏ, mỗi bản có số đo trước và sau trên
Edge headless (ma trận 59 biến thể, giả lập bảy kiểu chèn) và test mới.

Tests after (`gate:int` trên `4a06f528`, 12/10 11:02–11:05): unit 6709 — web 2233, admin 1911, api
1097, contract 675, mobile 509, mobile-ui 134, core 46, ui 47, i18n 36, tokens 21 — và int 779/46.
Web 2224 → 2233: ước lượng chiều cao 7 ca, bìa co giãn và kẹp một dòng 2 ca.

**CÒN TREO:**

- [ ] Push: canh ba đèn — Actions, Render, Vercel.
- [ ] Thử tay lại bước 1 trên Edge thường (có tiện ích): voucher BK-EET0JBTH một trang, bìa thấp
  hơn chút; rồi bước 2–5: giao diện tối và tắt Background graphics, voucher nhiều ngày, voucher đã
  đi và chuyến công ty huỷ, hoá đơn chờ ở `/checkout/cancel`.
- Không migration, không env, không webhook, không đổi Cloudinary.

## 2026-10-12 — G40 Phần 1: bản in voucher 5b và hoá đơn chờ B1, cuống đơn đã đóng của G37 (`c97d733c`..`29f79a13`, nhánh `claude/g40-print-web-part1-2ac874`)

Bấm Print ở `/checkout/success` (hay Ctrl+P ở `/checkout/cancel`) nay ra một tờ A4 thiết kế riêng
thay vì trang web đem in. Đơn đã trả in **voucher 5b**: bìa ảnh tour, tấm vé có cuống (mã vạch,
"Admit n"), lịch trình hai cột cùng Included và Not included, dải Where to meet · Cancellation ·
Payment. Đơn chưa trả in **hoá đơn chờ B1**: cùng họ 5b, tấm vé ở trạng thái chờ, cuống "Not yet a
voucher" kèm giờ nhả đơn, bảng Summary, dải How to pay · If it stays unpaid · Booking reference.
Spec G40 §2–§4, [ADR-0057](../adr/0057-print-documents.md). Không đổi API, không migration, không
env, không thêm dependency.

- `@tourism/tokens`: bốn màu in `chart-gain`, `chart-cost`, `pending`, `pending-soft` (giấy luôn
  sáng nên dark bằng light) và phạm vi `.light` để tờ in từ giao diện tối vẫn sáng.
- `@tourism/ui`, thư mục `print-doc/`: `DocPage` (tờ A4 mang trang in `doc` lề 0, nên trình duyệt
  thôi in ngày giờ và URL), `DocLetterhead` (biến thể giấy và ảnh), `DocFooter`, `DocStamp`,
  `PrintedAt` (giờ Việt Nam, đóng dấu lúc `beforeprint`); lớp chữ `PRINT_LABEL`, `PRINT_SECTION`;
  luật cô lập tài liệu khi in nằm ở CSS chung để admin dùng lại ở Phần 2.
- Web: view-model thuần ở `lib/print/` (`voucher-print`, `receipt-print`, `print-ticket`), mảnh in
  ở `components/print/` (bìa ảnh, tấm vé có cuống, dòng xé, dải cuối); gỡ khối CSS in cũ ép lên
  markup màn hình ở `globals.css`. Voucher đổi theo giai đoạn (sắp đi, đang đi, đã đi, đã huỷ —
  spec §3.3) và cắt nội dung dài cho vừa một trang (§3.4); hoá đơn có ba trạng thái (đang chờ, quá
  hạn chót, đã đóng — §4.2 tới §4.4). "Pay by" tính từ phiên 60 phút (`pendingDeadline`), kẹp ở hết
  ngày hạn chót.
- G37, phần cuống: đơn chưa trả đã đóng thôi in "Departs …" và "This code becomes your voucher once
  payment is complete." trên cuống màn hình; một câu `closedStubSentence` thay vào, bản in dùng
  cùng câu.

Thi công 10/10, tạm dừng tối 10/10 vì máy đem sửa, làm tiếp 12/10 sau khi cài lại máy. Rebase lên
`5a73b589` (main vừa nhận nhánh mobile browse), không xung đột. Hash trong file bàn giao 10/10
(nhánh sao lưu `backup/g40-tam-dung-2026-10-10`) là hash trước rebase: đầu nhánh `5b641ebc` nay là
`f5c72620`.

**Duyệt bằng mắt 12/10.** Session gốc chụp 19 biến thể bằng Edge headless (route đo tạm `zz-print`
không commit, dữ liệu fixture cùng hai tour seed dài) và ghép cạnh bản thảo, cùng dữ liệu đơn
BK-EET0JBTH: khớp 5b và B1. User chọn vá ngay hai chỗ lệch bản thảo:

- `21ee130d` email ở cột Booking reference xuống dòng nguyên khối ("Booked by" rồi
  "nora.dahl@example.com") như B1. Bản vá review `db2dfcba` đặt điểm ngắt trước "@" nên email ngắn
  cũng gãy ngay cạnh "Booked by"; nay email là khối `inline-block`, chỉ email dài hơn một dòng mới
  gãy trước "@" trong khối.
- `29f79a13` dải cuối B1 in đậm "My bookings", "Pay now" và giờ nhả đơn như bản thảo: hàm thuần
  `emphasize` tách câu i18n theo tên menu và tên nút thật của web; đổi một bên mà quên bên kia thì
  câu vẫn in trọn, chỉ mất chữ đậm, và một ca test đỏ.

Lệch bản thảo mà để nguyên: bỏ "Page 1 of 1" (spec §2.3); mã vạch canh giữa cuống (review); tên
"Hội An Old Town & Lantern Evening" trên bìa voucher gãy hai dòng vì Literata của web không có trục
optical size nên rộng hơn bản thảo 4px (631 so với hộp 627px), spec cho tối đa hai dòng.

Số đo trên code cuối: 19/19 biến thể đúng một trang (bốn giai đoạn voucher, một và 12 ngày, không
ảnh, tên dài, hai tour seed dài; hoá đơn chờ, đã đóng, bị thu rồi hoàn, quá hạn chót, email dài; in
từ giao diện tối), tờ ở đỉnh trang, không tràn, chân trang ở 286 mm, nền tờ vẫn sáng khi
`<html class="dark">`.

**Review findings:** review max 10/10 — 10 góc tìm lỗi, 3 agent kiểm chứng, 1 lượt quét lỗ hổng;
khoảng 35 ứng viên, 15 mục nặng nhất vá hết cùng khoảng 15 mục dọn dẹp:

- `cfd35da3` hoá đơn in kể đúng kết cục: đơn bị thu rồi hoàn thôi in "No payment was taken" cạnh
  khoản đã hoàn; đơn quá hạn chót chưa phải kết cục (mộc "Not paid", câu điều kiện như trang chi
  tiết đơn); chuyến công ty huỷ; hạn trả kẹp ở hết ngày hạn chót.
- `c43694aa` voucher in: vé đã huỷ giữ mộc CANCELLED hay REFUNDED; ngày không mô tả thì bỏ lịch
  trình; đang đi từ ngày 2 thì dải cuối không in giờ hẹn của ngày 1; mục gồm bỏ mục trống, mục trùng.
- `b1d899ae` khung in: `PrintedAt` cập nhật bằng `flushSync` trong `beforeprint` (bản trước in giờ
  tải trang); nền tờ `card`; luật cô lập lên `@tourism/ui`, thôi bám `body > main`.
- `db2dfcba` bìa và vé: dãn dòng tên tour, ảnh bìa ưu tiên thấp, mã vạch canh giữa, email dài ngắt
  trước "@".
- `47869666` vừa một trang với dữ liệu thật: tour seed `hue-imperial-day` và
  `vietnam-grand-journey-12d` từng đẩy chân trang tới 290–296 mm (giới hạn 286) — kẹp số dòng, bỏ
  cột giờ trống.
- `2fb43159` hạn trả theo phiên ngắn nhất (60 phút, Stripe) thay TTL quét 65 phút của API; voucher
  in kể "Refunded −$X" như màn hình.
- `f5c72620` dải cuối chỉ kẹp cột điểm hẹn — câu điều kiện của hoá đơn quá hạn từng bị cắt cụt.
- `9d1a4da8` và `f2a0dac4`: comment, ADR-0057, spec và plan ghi các sửa.

Bác 6 vì spec hay plan đã chốt: voucher huỷ vẫn in "Admit" và mã; "3 NOV"; `/checkout/success` in
hoá đơn khi đang Confirming; độ chính xác tiền khi không cùng cột; ảnh bìa 1400 px; brand chỉ tông
ảnh. Để lại, mức thấp và có từ trước G40: tên file "Save as PDF" lấy tiêu đề tĩnh của trang; hai
biến thể `voucher-stack`, `voucher-split` nay chỉ là bí danh của `max-xl`, `xl`.

Tests after (`gate:int` trên `29f79a13`, 12/10 09:27–09:30, sau rebase lên `5a73b589`): unit 6700 —
web 2224, admin 1911, api 1097, contract 675, mobile 509, mobile-ui 134, core 46, ui 47, i18n 36,
tokens 21 — và int 779/46. So với main: web 2138 → 2224, ui 36 → 47, i18n 31 → 36, tokens 19 → 21;
hai bản vá sau duyệt thêm 6 ca web (`emphasize` 4, dải cuối 1, hoá đơn in 1).

**CÒN TREO:**

- [ ] Push đụng web, `@tourism/ui`, tokens, i18n: canh ba đèn — Actions, Render, Vercel.
- [ ] Thử tay prod theo spec §10 bước 1–3: voucher một ngày và nhiều ngày (xem trước sáng, tối,
  tắt Background graphics); voucher đã đi và chuyến công ty huỷ; đặt rồi huỷ ở cổng, in hoá đơn
  chờ ở `/checkout/cancel`.
- [ ] G37: câu `heldNote` của `/checkout/cancel` vẫn mở.
- [ ] G40 Phần 3 (nhánh `claude/g40-part3-excel-report-a7944d`): review max chưa chạy. Phần 2:
  viết plan sau khi Phần 3 review xong.
- Dọn sau merge: nhánh `claude/g40-print-web-part1-2ac874` ở máy và origin. Nhánh sao lưu
  `backup/g40-tam-dung-2026-10-10` giữ tới khi Phần 2 và 3 xong (công cụ đo, file bàn giao).
- Không migration, không env, không webhook, không đổi Cloudinary.

## 2026-10-12 — Merge nhánh `feat/mobile-browse-screens` lên main: R3, R7 của review 05/10 và bản vá Sign in kẹt sau onboarding (`7dc3041b`..`616d782e`)

Nhánh dựng lại từ main 09/10 đúng như review 05/10 đề xuất: chức năng xem tour (P5b-2) đã vào
main cùng nhánh account (entry merge P5b-4 bên dưới), nhánh này chỉ mang phần còn giá trị. Ba
commit của Duy An: `leaveAuthTo` gỡ modal Sign in về đúng màn đang nằm dưới thay cho
`router.replace` (R3, hết nhân đôi tour; kèm nhánh R2 cho callback Google trên Android), giữ khoá
nút sau khi đăng nhập thành công (R7), và
[tóm tắt nhánh 11/10](../reviews/2026-10-11-branch-summary-mobile-browse-screens.md). Ba commit
riêng cũ (sửa rồi hoàn tác `catalog.service.ts`, D6 bằng SecureStore, một commit thử) bị bỏ, đóng
câu "nhóm quyết port hay bỏ" ở open-items. Không có migration, không cần đổi hạ tầng (luật 15).

Rebase lên `e32c510b`, không xung đột. Hash trong tóm tắt nhánh là hash trước rebase: `813d7da5`
nay là `7dc3041b`; R7 là `8f3ef57d` (tóm tắt còn ghi "chưa commit" vì viết trước commit này).

**Review 12/10 trên session cloud.** R3 đúng: đo trên cây route thật, main để lại hai bản tour
trong stack sau khi đăng nhập từ tour, nhánh còn một. Nhánh gây một lỗi lùi, vá lúc merge
(`616d782e`, Yuri chọn sửa ở đây thay vì trả nhánh): `leaveAuthTo` coi `canDismiss() = false` là
"callback OAuth đã đưa stack về tabs" nên `navigate` đẩy đích lên trên. Nhưng Sign in mở từ
onboarding ("I already have an account") là màn gốc duy nhất của stack, `canDismiss()` cũng
`false`: Home bị đẩy lên trên Sign in, back cứng Android quay về Sign in với nút kẹt "Signing in…"
(R7 không nhả `pending`), và nút X ở đường này cũng để lại Sign in. Trên main cả hai đường đều
sạch. Bản vá phân biệt bằng việc màn auth còn mount không (`useStillMounted`): còn thì `dismissTo`
(đích vắng khỏi stack thì tự thay chỗ), đã bị gỡ trong lúc chờ Google thì `navigate` như R2. Unit
test của helper dùng router giả nên không thấy lỗi; thêm `leave-auth-routes.spec.tsx` chạy trên
cây route thật: hai ca onboarding đỏ trên code nhánh, xanh sau vá; ca R3 canh "back một lần là về
Home". Tóm tắt nhánh ghi repo không có spec cho route, sai: `routes.spec.tsx` có từ trước.

**CÒN TREO:**

- [ ] Thử máy thật theo mục 6 của tóm tắt nhánh, nhất là R2 (bước 14–17: Android, đăng nhập
  Google từ màn tour, back cứng về Home chứ không thoát app). Kèm đường mới: mở app lần đầu →
  "I already have an account" → đăng nhập xong → back cứng ở Home không được về lại Sign in.
- [ ] R2 có một khe chưa đo, suy luận từ code: nếu callback gỡ cả nhóm auth TRƯỚC khi lượt đăng
  nhập Google trả kết quả, `abandonPendingReturn` đã xoá đường về, khách về Home thay vì tour và
  tim không tự lưu (app không thoát). ADR-0056 (Google native) sẽ thay luồng này.
- [ ] Duy An xoá hai nhánh backup ở máy (`backup/browse-before-q678`, `backup/browse-q678-rewrite`).

Tests after: unit 6596 — admin 1911, web 2138, api 1097, contract 675, mobile 509, mobile-ui 134,
core 46, ui 36, i18n 31, tokens 19 — và int 779/779 ở 46 file. Cây đã rebase chạy đủ các bước của
CI trên session cloud: RLS, build web với API sống, bundle mobile, admin prerender, lint,
tokens-only, docs-freshness.
