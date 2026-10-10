# Bối cảnh review G40 Phần 3 (đọc trước)

- Repo: C:\Programming\Devs\Projects\Tourism-Platform-V2 (Windows; Git Bash qua công cụ Bash). Monorepo pnpm.
- Code được review: worktree C:\Programming\Devs\Projects\Tourism-Platform-V2\.claude\worktrees\g40-part3-excel-report-a7944d
  (nhánh claude/g40-part3-excel-report-a7944d, HEAD ac1f846f, gốc e32c510b). ĐỌC FILE Ở ĐÓ. Bản trước thay đổi:
  `git -C <worktree> show e32c510b:<đường dẫn>`.
- Diff: C:\Users\yuriv\AppData\Local\Temp\claude\C--Programming-Devs-Projects-Tourism-Platform-V2\b4f65e4b-e7d4-4c13-b96c-25674fdfe608\scratchpad\g40-p3-review\diff.patch
  (git diff -U10 e32c510b...ac1f846f), kèm stat.txt và commits.txt cùng thư mục.
- Worktree ấy KHÔNG có node_modules. Muốn thử hành vi ExcelJS 4.4.0 thì `node -e` với require từ checkout gốc, ví dụ
  `require('C:/Programming/Devs/Projects/Tourism-Platform-V2/apps/admin/node_modules/exceljs')` (nếu không thấy thì tìm
  trong `node_modules/.pnpm/exceljs@4.4.0`). Chỉ đọc, không cài gì, không ghi file ngoài scratchpad.
- Việc: G40 Phần 3 — admin (Next.js 16): bộ đồ nghề Excel dùng chung `apps/admin/src/lib/xlsx-style.ts`; file Excel báo
  cáo tháng theo bản thảo D1 (`apps/admin/src/lib/xlsx.ts` — Summary dạng dashboard có thanh REPT, khung in A4 có đầu
  và chân trang, metadata, ngày ép `[$-409]`, mã đơn bấm được, SUBTOTAL); hai file Excel danh sách booking và subscriber
  thay CSV (`bookings-xlsx.ts`, `subscribers-xlsx.ts`); hai route xuất trả .xlsx (`export-route.ts` dùng chung); gỡ CSV;
  nút "Export Excel"; chữ ở `libs/shared/i18n` (khối `admin.*`, `admin.exportFile`).
- Hợp đồng: docs/specs/2026-10-10-print-and-export-redesign-design.md §6 (Excel D1), §7 (danh sách), §8, §9;
  docs/adr/0034-excel-report-export.md (AMEND 1–3); plan docs/plans/2026-10-10-g40-part3-admin-excel.md (8 task,
  17 "Quyết định của plan", "Giao diện dùng chung"). Bản thảo: docs/design/mockups/excel-report-d1.xlsx. Các file này có
  trong worktree.
- Luật repo: tiền chỉ Number() ở lớp ghi ô (money, sumMoney — cộng theo xu); hex ARGB chỉ ở xlsx-style.ts và phải là
  token quy đổi hoặc dẫn xuất có công thức; chữ người dùng thấy tiếng Anh ở @tourism/i18n; comment tiếng Việt; ngày giờ
  Việt Nam = UTC+7; ngày lịch YYYY-MM-DD ghi nửa đêm UTC; mốc vắng là ô trống; autoFilter tới hàng dữ liệu cuối, không
  gồm hàng Total; đầu/chân trang nhân đôi `&`, giữ mã &P &N; hyperlink lấy origin từ request.nextUrl.origin.
- Bẫy ExcelJS đã biết (đo 10/10): `book.company` đọc lại được; `calcProperties` không đọc lại; tooltip hyperlink không đọc
  lại; printTitlesRow đọc lại là "1:1"; chuỗi bắt đầu "=" lưu thành chuỗi (không injection); indent 0 bị bỏ khi đọc;
  khi ĐỌC lại `result` là chuỗi rỗng thì mất (file vẫn ghi đúng).

CHỈ ĐỌC — không sửa file trong worktree, không chạy lệnh đổi trạng thái git, không chạy build/gate/test.

## Đầu ra (mọi góc)
Tối đa 8 ứng viên, đánh số, mỗi ứng viên: file (tương đối từ gốc repo), line (ở ac1f846f), summary (một câu tiếng Việt
có dấu), failure_scenario (đầu vào/trạng thái cụ thể → kết quả sai, hay cái giá cụ thể với góc dọn dẹp), category
(kebab-case). Chỉ nêu điều đã đọc code xác nhận được cơ chế; trích dòng liên quan. Không có gì thì trả danh sách rỗng.
