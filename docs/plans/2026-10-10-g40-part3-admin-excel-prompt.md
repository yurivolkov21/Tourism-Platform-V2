# Prompt session THI CÔNG — G40 Phần 3: Excel báo cáo tháng D1 và danh sách xuất Excel (10/10/2026)

> **CÒN DÙNG.** Prompt cho session thi công [plan G40 Phần 3](2026-10-10-g40-part3-admin-excel.md).
> Văn bản nguồn là [spec](../specs/2026-10-10-print-and-export-redesign-design.md) và
> [ADR-0034](../adr/0034-excel-report-export.md) AMEND 3 — prompt chỉ dẫn đường, **spec mới là hợp
> đồng**.

## Cách dùng

- Mở một session Claude Code MỚI tại thư mục worktree
  `C:\Programming\Devs\Projects\Tourism-Platform-V2\.claude\worktrees\admin-excel` (nhánh
  `feat/admin-excel`, session gốc đã tạo). Đừng để app tạo worktree mới từ `main`.
- Dán nguyên khối prompt bên dưới.
- Phần 1 (bản in web) chạy SONG SONG ở worktree `print-web`. Hai phần không đụng file của nhau, trừ
  `libs/shared/i18n/src/lib/messages.ts` (khác khối) — nhánh merge sau rebase và gỡ xung đột ở bước
  merge của session gốc.
- Session gốc giữ vai review; xong thì review max, vá trọn, mở ba file bằng Excel thật, đưa user duyệt
  bằng mắt rồi mới merge (plan, mục "Sau khi thi công").

---

## Phần 3 — Task 1–8

```text
Bạn là session THI CÔNG của tourism-v2 cho G40 Phần 3, làm việc NGAY TRONG worktree
C:\Programming\Devs\Projects\Tourism-Platform-V2\.claude\worktrees\admin-excel
(nhánh feat/admin-excel). KHÔNG tạo worktree mới. KHÔNG đụng checkout gốc
C:\Programming\Devs\Projects\Tourism-Platform-V2 (session gốc review ở đó) và KHÔNG đụng worktree
.claude\worktrees\print-web (một session khác đang thi công Phần 1 ở đó).
Trả lời tôi bằng tiếng Việt có dấu.

Đọc theo thứ tự:
  CLAUDE.md                                                     (15 luật + gotcha)
  apps/admin/AGENTS.md                                          (Next.js 16)
  docs/README.md                                                (bản đồ tài liệu)
  docs/adr/0034-excel-report-export.md                          (AMEND 1–3 — quyết định)
  docs/specs/2026-10-10-print-and-export-redesign-design.md     (spec — HỢP ĐỒNG; §6, §7, §8, §9)
  docs/plans/2026-10-10-g40-part3-admin-excel.md                (plan — làm theo)
Phần 1 (bản in web) và Phần 2 (bản in báo cáo admin) của spec không phải việc của session này.

VIỆC: G40 Phần 3 — bộ đồ nghề Excel dùng chung (lib/xlsx-style.ts); file Excel báo cáo tháng theo
bản thảo D1 (Summary dạng dashboard có thanh REPT, khung in A4 có đầu và chân trang, metadata, ngày
ép [$-409], mã đơn bấm được, SUBTOTAL); hai file Excel danh sách booking và subscriber thay CSV; hai
route xuất trả .xlsx; gỡ csv.ts, bookings-csv.ts, subscribers-csv.ts; nút ghi "Export Excel". Làm
Task 1 → 8 đúng thứ tự, mỗi task một commit. Hết Task 8 thì DỪNG và bàn giao. Không làm gì ngoài
plan; thấy plan sai hay mâu thuẫn spec thì DỪNG và hỏi tôi. Freeze 15/10 — không mở rộng phạm vi,
không thêm dependency.

TRƯỚC DÒNG CODE ĐẦU TIÊN: đọc "Global Constraints", "Điều kiện bắt đầu", cả 17 mục "Quyết định của
plan" và "Giao diện dùng chung". Plan được viết sau khi đối chiếu từng hàm, route, test, khoá i18n
với code thật ngày 10/10 và thử ExcelJS 4.4.0 đọc lại metadata, tab màu, lưới, khung in, hyperlink,
công thức, printTitlesRow — tên và hành vi trong plan là thật; không khớp thì grep lại rồi báo, đừng
tự đặt tên mới.

MỞ ĐẦU
- `pwd` là đường dẫn worktree ở trên; `git branch --show-current` ra feat/admin-excel;
  `git status` sạch.
- `git log --oneline -2` thấy commit docs của session gốc có plan và prompt Phần 3 trên cùng. Sai
  điều nào thì DỪNG, báo tôi.
- Worktree chưa có node_modules và .env.local: làm theo "Điều kiện bắt đầu" của plan (chép .env.local
  DEV từ checkout gốc — KHÔNG BAO GIỜ đọc hay chép .env.production; pnpm install --frozen-lockfile;
  build gói admin đọc từ dist).
- Rà docs/skills.md (luật 9). Làm trực tiếp theo superpowers:executing-plans và
  superpowers:test-driven-development.

LUẬT BẤT DI BẤT DỊCH CỦA SESSION NÀY
- KHÔNG merge, KHÔNG push, KHÔNG rebase, KHÔNG dùng subagent. Không `git stash` trần.
- KHÔNG chạm hạ tầng sống (CLAUDE.md luật 15). Phần 3 không cần gì từ hạ tầng.
- CHỈ sửa apps/admin và khối admin.* của libs/shared/i18n/src/lib/messages.ts. KHÔNG format lại,
  KHÔNG di chuyển khối nào khác của messages.ts (Phần 1 sửa khối printDoc và booking.success ở nhánh
  khác). KHÔNG sửa apps/api, apps/web, apps/mobile, libs/shared/contract, libs/shared/ui,
  libs/shared/tokens, docs/design/mockups/*. Thấy mình sắp cần sửa chỗ khác thì DỪNG và hỏi tôi.
- TDD (luật 4): test đỏ đúng lý do trước, rồi mới cài. Ca test mới nào cũng thử đột biến thật (sửa
  code cho sai, thấy đỏ, trả lại bằng tay — không git checkout/restore khi còn thay đổi chưa commit),
  ghi kết quả, kể cả đột biến không giết được và vì sao.
- KHÔNG chạy `pnpm gate` hay `pnpm gate:int` (session gốc chạy sau). Vitest admin luôn
  `--maxWorkers=2`. Commit memory trống dưới 6 GB thì DỪNG và báo.
- Comment code TIẾNG VIỆT (luật 8); chữ người dùng thấy — nhãn cột, tên sheet, đầu và chân trang
  của file — TIẾNG ANH trong @tourism/i18n (luật 7).
- Hex ARGB CHỈ ở lib/xlsx-style.ts, mỗi hằng là token quy đổi (ghi oklch gốc) hoặc dẫn xuất có công
  thức (ADR-0034 AMEND 1b, 2d). Không bịa màu.
- Tiền: Number() CHỈ ở lớp ghi ô (money, sumMoney). Không phép tính tiền nào ở chỗ khác.
- Commit Conventional Commits, message TIẾNG VIỆT CÓ DẤU, KHÔNG AI attribution — không dòng
  Co-Authored-By (luật 12). Stage theo đường dẫn tường minh, không `git add -A`.
  `pnpm exec biome check --write <file>` trước khi stage. Không `--no-verify`.
- @tourism/i18n đọc từ dist: sửa xong phải build lại trước khi test admin.

MƯỜI CHỖ DỄ SAI (plan có đủ chi tiết)
1. Ngày phải ép tiếng Anh: DATE_FMT '[$-409]d mmm yyyy', DATETIME_FMT '[$-409]d mmm yyyy hh:mm'.
   Thiếu [$-409] thì máy Windows tiếng Việt ra "5 Thg10 2026".
2. Giờ Việt Nam = mốc ISO + 7 giờ rồi ghi Date (ExcelJS ghi theo UTC, Excel không có múi giờ). Ngày
   lịch YYYY-MM-DD ghi nửa đêm UTC. Mốc vắng là Ô TRỐNG, không phải chuỗi.
3. Dòng chi phí của thác nước là SỐ ÂM (money(…, { negate: true })); 0 không thành -0. Thanh REPT
   có chốt chia 0 (IF(…=0,"",…)); màu thanh: chi phí và số âm là COST, còn lại GAIN.
4. Mỗi ô công thức ghi kèm `result` (giá trị đệm); tổng tiền đệm cộng theo XU (sumMoney).
5. Vùng autoFilter tới hàng DỮ LIỆU cuối, KHÔNG gồm hàng Total; bảng trống thì không có hàng Total.
6. Dòng ghi chú của Detail nằm DƯỚI hàng Total (quyết định 8); bảng trống thì ở hàng 2.
7. Gán sheet.views để đóng băng là ghi đè showGridLines — dùng freezeHeader(sheet, grid).
8. Đầu, chân trang: & trong chữ phải nhân đôi (headerText); mã &P, &N giữ nguyên; phần giữa dài quá
   100 ký tự thì cắt kèm "…".
9. Hyperlink mã đơn lấy origin từ request.nextUrl.origin của route — builder không đoán domain.
10. Xoá khoá i18n ĐÚNG task (quyết định 15) và chỉ khi `rg` xác nhận không còn consumer.

Khớp chữ chính xác trong test, không /…/i; chữ đến từ i18n thì so bằng chính khoá i18n.

BÀN GIAO KHI XONG (hết Task 8)
Không merge. Viết cho tôi: danh sách commit; số test admin và i18n đã chạy, kết quả typecheck admin;
đột biến đã thử và kết quả; chỗ lệch plan và vì sao; điều gì trong plan bạn thấy đáng nghi mà vẫn
làm theo; kết quả `rg -n -i "csv" apps/admin/src` (chỉ còn câu lịch sử); việc cần hạ tầng (dự kiến:
không có); dung lượng ổ C trước và sau khi dọn (xoá .turbo, .next sinh ra trong worktree).
```
