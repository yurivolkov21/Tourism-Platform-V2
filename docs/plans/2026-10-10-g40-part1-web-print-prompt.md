# Prompt session THI CÔNG — G40 Phần 1: bản in voucher và hoá đơn chờ (10/10/2026)

> **CÒN DÙNG.** Prompt cho session thi công [plan G40 Phần 1](2026-10-10-g40-part1-web-print.md).
> Văn bản nguồn là [spec](../specs/2026-10-10-print-and-export-redesign-design.md) và
> [ADR-0057](../adr/0057-print-documents.md) — prompt chỉ dẫn đường, **spec mới là hợp đồng**.

## Cách dùng

- Mở một session Claude Code MỚI tại thư mục worktree
  `C:\Programming\Devs\Projects\Tourism-Platform-V2\.claude\worktrees\print-web` (nhánh
  `feat/print-web`, session gốc đã tạo). Đừng để app tạo worktree mới từ `main`.
- Dán nguyên khối prompt bên dưới.
- Session gốc (người viết plan) giữ vai review và không sửa file trong worktree khi session thi
  công đang chạy. Xong thì session gốc review max, vá trọn, đo bố cục bằng Edge headless, đưa user
  duyệt bằng mắt rồi mới merge (plan, mục "Sau khi thi công").

---

## Phần 1 — Task 1–11

```text
Bạn là session THI CÔNG của tourism-v2 cho G40 Phần 1, làm việc NGAY TRONG worktree
C:\Programming\Devs\Projects\Tourism-Platform-V2\.claude\worktrees\print-web
(nhánh feat/print-web). KHÔNG tạo worktree mới. KHÔNG đụng checkout gốc
C:\Programming\Devs\Projects\Tourism-Platform-V2 — session gốc đứng ở đó để review.
Trả lời tôi bằng tiếng Việt có dấu.

Đọc theo thứ tự:
  CLAUDE.md                                                     (15 luật + gotcha)
  docs/README.md                                                (bản đồ tài liệu)
  docs/adr/0057-print-documents.md                              (quyết định)
  docs/specs/2026-10-10-print-and-export-redesign-design.md     (spec — HỢP ĐỒNG; §1–§4, §8, §9)
  docs/plans/2026-10-10-g40-part1-web-print.md                  (plan — làm theo)
  docs/design/mockups/print-voucher.src.html (khối data-opt="5b") và
  docs/design/mockups/print-receipt.src.html (khối data-opt="B1") — bản vẽ đã duyệt, CHỈ ĐỌC.
Phần 2 (báo cáo in, admin) và Phần 3 (Excel) của spec không phải việc của session này.

VIỆC: G40 Phần 1 — bốn token màu và phạm vi .light ở @tourism/tokens; chữ printDoc ở
@tourism/i18n; khung tài liệu in print-doc ở @tourism/ui (tờ A4, đầu trang, chân trang, mộc,
giờ in, trang in tên doc); view-model voucherPrintView, receiptPrintView và component in ở
apps/web; nối vào /checkout/success và /checkout/cancel; gỡ CSS in cũ; cuống BookingReceipt của
đơn đã đóng (G37). Làm Task 1 → 11 đúng thứ tự, mỗi task một commit. Hết Task 11 thì DỪNG và
bàn giao. Không làm gì ngoài plan; thấy plan sai hay mâu thuẫn spec thì DỪNG và hỏi tôi. Freeze
15/10 — không mở rộng phạm vi, không thêm dependency.

TRƯỚC DÒNG CODE ĐẦU TIÊN: đọc "Global Constraints", "Điều kiện bắt đầu", cả 21 mục "Quyết định
của plan" và "Giao diện dùng chung". Plan được viết sau khi đối chiếu từng tên hàm, fixture, khoá
i18n và token với code thật ngày 10/10 — tên trong plan là tên thật; không khớp thì grep lại rồi
báo, đừng tự đặt tên mới.

MỞ ĐẦU
- `pwd` là đường dẫn worktree ở trên; `git branch --show-current` ra feat/print-web;
  `git status` sạch.
- `git log --oneline -3` thấy hai commit docs của session gốc: prompt thi công, rồi plan
  (fb0614e3). Sai điều nào thì DỪNG, báo tôi.
- Worktree chưa có node_modules và .env.local: làm theo "Điều kiện bắt đầu" của plan (bước 2–4:
  chép .env.local DEV của web và api từ checkout gốc — KHÔNG BAO GIỜ đọc hay chép
  .env.production; pnpm install --frozen-lockfile; build các gói web đọc từ dist).
- Rà docs/skills.md (luật 9). Làm trực tiếp theo superpowers:executing-plans và
  superpowers:test-driven-development.

LUẬT BẤT DI BẤT DỊCH CỦA SESSION NÀY
- KHÔNG merge, KHÔNG push, KHÔNG rebase, KHÔNG dùng subagent. Không `git stash` trần (stack stash
  dùng chung với checkout gốc).
- KHÔNG chạm hạ tầng sống (CLAUDE.md luật 15): không Supabase, Cloudinary, webhook, env hay
  redeploy Render/Vercel. Phần 1 không cần gì từ hạ tầng.
- KHÔNG sửa apps/api, apps/admin, apps/mobile, libs/shared/contract, component có sẵn của
  libs/shared/ui (chỉ THÊM thư mục print-doc và CSS cuối globals.css), và
  docs/design/mockups/*.src.html. Thấy mình sắp cần sửa chỗ khác thì DỪNG và hỏi tôi.
- TDD (luật 4): test đỏ đúng lý do trước, rồi mới cài. Ca test mới nào cũng thử đột biến thật
  (sửa code cho sai, thấy đỏ, trả lại bằng tay — không git checkout/restore khi còn thay đổi chưa
  commit), ghi kết quả, kể cả đột biến không giết được và vì sao.
- KHÔNG chạy `pnpm gate` hay `pnpm gate:int` (session gốc chạy sau). Vitest web luôn
  `--maxWorkers=2`. Commit memory trống dưới 6 GB thì DỪNG và báo.
- Comment code TIẾNG VIỆT (luật 8); chữ khách thấy bằng TIẾNG ANH trong @tourism/i18n (luật 7).
  Tokens-only, không hex (luật 6).
- Commit Conventional Commits, message TIẾNG VIỆT CÓ DẤU, KHÔNG AI attribution — không dòng
  Co-Authored-By (luật 12). Stage theo đường dẫn tường minh, không `git add -A`.
  `pnpm exec biome check --write <file>` trước khi stage. Không `--no-verify`.
- Tokens, i18n, contract đọc từ dist: sửa xong phải build lại trước khi test gói khác.
- Next.js 16: đọc tài liệu trong apps/web/node_modules/next/dist/docs/ trước khi sửa trang.

MƯỜI HAI CHỖ DỄ SAI (plan có đủ chi tiết)
1. Giấy luôn sáng: khối `.light` phải đứng SAU `.dark` trong tokens.css; DocPage mang class
   `light`. Trong tài liệu in KHÔNG dùng biến thể `dark:`. Ngoại lệ có chủ đích duy nhất:
   DocLetterhead tông photo gắn CLASS `dark` (scope) để primary-emphasis ra teal nhạt trên bìa
   (quyết định 2, 3).
2. IBM Plex Mono chỉ nạp 400/500: chữ mono dùng font-medium, không font-semibold.
3. Giờ in: Intl en-US + hourCycle h23 → "9 Oct 2026, 17:59", "Sep" không "Sept", nửa đêm "00:00".
   Mốc đặt đơn in NGÀY trước ("Booked 9 Oct 2026, 17:59"); câu giờ nhả in GIỜ trước
   ("released at 19:04, 9 Oct 2026") — đúng bản thảo B1.
4. Hoá đơn "đã đóng" = status khác PENDING hoặc giai đoạn lapsed. PENDING quá 65 phút mà cron
   chưa quét VẪN là đang chờ — đừng dùng pendingExpiry để khai đóng (quyết định 18).
5. Kicker bìa luôn là ngày đi có thứ ("Hà Nội · 3 days · Tue 3 Nov 2026"), kể cả chuyến nhiều
   ngày (quyết định 11).
6. Dùng lại khoá i18n sẵn có ở quyết định 21 — không khai trùng câu ở khoá mới.
7. voucherMeetingPoint đổi thành voucherTourData: sau Task 9, `rg voucherMeetingPoint` phải ra
   rỗng; ô Meeting point của màn hình lấy bằng tourMeetingPoint(tour).
8. Chỉ upcoming và on_tour đọc tour: voucher đã đi, đã huỷ không có lịch trình, mục gồm, giờ
   hẹn — kể cả khi được truyền tour.
9. CSS in của web: body:has([data-print-doc]) phải có `display: block` (body là cột flex);
   GIỮ luật in [data-slot="barcode"]; gỡ luật in receipt, receipt-status, stub và khối voucher cũ.
10. Ảnh bìa là <img loading="eager"> kèm biome-ignore lint/performance/noImgElement có lý do,
    KHÔNG next/image (ADR-0057 §4).
11. Tên tour trong tài liệu in là h2 (ContentHero giữ h1); mục con h3. Không bao giờ hai h1.
12. Số kỳ vọng trong test suy từ fixture sẵn có (voucherBooking, makeBooking, makeTourData):
    lệch thì sửa KỲ VỌNG cho khớp fixture và ghi lại — không sửa code cho khớp số đoán.

Khớp chữ chính xác trong test, không /…/i; chữ đến từ i18n thì so bằng chính khoá i18n.

BÀN GIAO KHI XONG (hết Task 11)
Không merge. Viết cho tôi: danh sách commit; số test từng gói đã chạy (tokens, i18n, ui, web) và
kết quả typecheck web, ui; đột biến đã thử và kết quả; chỗ lệch plan và vì sao; điều gì trong
plan bạn thấy đáng nghi mà vẫn làm theo; việc cần hạ tầng (dự kiến: không có); dung lượng ổ C
trước và sau khi dọn (xoá .turbo, .next sinh ra trong worktree).
```
