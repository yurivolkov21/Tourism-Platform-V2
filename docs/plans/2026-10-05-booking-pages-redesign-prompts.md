# Prompt session THI CÔNG — P7 ba trang đơn của khách (06/10/2026)

> **CÒN DÙNG.** Prompt cho session thi công từng phần của
> [plan P7](2026-10-05-booking-pages-redesign.md). Văn bản nguồn là
> [spec](../specs/2026-10-05-booking-pages-redesign-design.md) và
> [ADR-0054](../adr/0054-customer-bookings-list-phase-filters.md) — prompt chỉ dẫn đường,
> **spec mới là hợp đồng**.

## Cách dùng

- Mở một session Claude Code MỚI tại đúng thư mục worktree
  `C:\Programming\Devs\Projects\Tourism-Platform-V2\.claude\worktrees\booking-pages-redesign`
  (nhánh `feat/booking-pages-redesign`, đã có ADR, spec, plan và file này). Đừng để app tạo
  worktree mới từ `main` — nhánh mới không có plan.
- Dán nguyên khối prompt của phần đang làm.
- Session gốc (người viết plan) giữ vai review và không sửa file trong worktree khi session thi
  công đang chạy.
- Prompt Phần B và C viết sau khi Phần A đã merge, vì vòng review Phần A có thể đổi giao diện
  dùng chung.

---

## Phần A — Task 1–12

```text
Bạn là session THI CÔNG của tourism-v2 cho P7 Phần A, làm việc NGAY TRONG worktree
C:\Programming\Devs\Projects\Tourism-Platform-V2\.claude\worktrees\booking-pages-redesign
(nhánh feat/booking-pages-redesign). KHÔNG tạo worktree mới. KHÔNG đụng checkout gốc
C:\Programming\Devs\Projects\Tourism-Platform-V2 — ở đó một session khác đang thi công đợt
sửa admin trên nhánh fix/admin-ui-polish. Trả lời tôi bằng tiếng Việt có dấu.

Đọc theo thứ tự:
  CLAUDE.md                                                  (15 luật + gotcha)
  docs/README.md                                             (bản đồ tài liệu)
  docs/adr/0054-customer-bookings-list-phase-filters.md      (quyết định)
  docs/specs/2026-10-05-booking-pages-redesign-design.md     (spec — HỢP ĐỒNG)
  docs/plans/2026-10-05-booking-pages-redesign.md            (plan — làm theo)
Trong plan: đọc trọn phần đầu (tới hết "Bản đồ file") và Phần A (Task 1–12). Phần B, C là
việc của session sau — không làm.

VIỆC: P7 Phần A — luật giai đoạn đơn dùng chung ở contract (bookingPhase); bookings.mine
lọc, tìm, xếp theo hành trình, đếm và phân trang ở server; nút quay lại trong ContentHero;
trang /account/bookings mới (ô tìm, hai nút lọc When và Status, 10 đơn mỗi trang, phân trang
"Newer / Older trips"); hai helper dùng chung bookingPriceLines, paymentProviderLabel cho
Phần B và C. Làm Task 1 → 12 đúng thứ tự, mỗi task một commit (Task 11 chỉ commit khi phải
sửa lỗi bố cục). Hết Task 12 thì DỪNG và bàn giao. Không làm gì ngoài plan; thấy plan sai
hay mâu thuẫn spec thì DỪNG và hỏi tôi. Freeze 15/10 — không mở rộng phạm vi.

TRƯỚC DÒNG CODE ĐẦU TIÊN: đọc "Điều kiện bắt đầu", cả 27 mục "Quyết định của plan", "Ràng
buộc toàn cục" (gồm "Quy trình gate" và "Chạy song song với session khác ở checkout gốc") và
11 bài học. Các vòng review F14–F19 và P4e-4 tìm ra 15–27 lỗi thật mỗi vòng, đúng ở các vùng
việc này đi qua: so ngày, luật trạng thái đơn, phân trang, form có trạng thái trên URL, bố cục.

MỞ ĐẦU
- `pwd` là đường dẫn worktree ở trên; `git branch --show-current` ra
  feat/booking-pages-redesign; `git status` sạch.
- `git log --oneline -4` thấy ba commit docs của session gốc: prompt thi công, plan
  (6f1aebb0), ADR-0054 + spec + bản vẽ (d0f067ad). Sai điều nào thì DỪNG, báo tôi.
- Worktree chưa có node_modules và .env.local: làm theo "Điều kiện bắt đầu" của plan
  (pnpm install --frozen-lockfile; chép .env.local DEV của api, web, admin từ checkout gốc —
  KHÔNG BAO GIỜ chép .env.production).
- Docker Postgres phải chạy (`docker ps`; tắt thì `docker start tourism-v2-postgres-1`).
- Tạo ba file tạm cho int test trên DB riêng (mã có sẵn ở mục "Chạy song song…" của plan).

LUẬT BẤT DI BẤT DỊCH CỦA SESSION NÀY
- KHÔNG merge, KHÔNG push, KHÔNG rebase, KHÔNG dùng subagent. Không `git stash` trần (stack
  stash dùng chung với checkout gốc).
- KHÔNG chạm hạ tầng sống (CLAUDE.md luật 15): không Supabase, Cloudinary, webhook, env hay
  redeploy Render/Vercel. Phần A không cần gì từ hạ tầng.
- KHÔNG sửa apps/mobile, apps/admin, apps/api/prisma/ (không migration nào), component có sẵn
  của libs/shared/ui. Trang Passport (/account) chỉ chạm đúng chỗ task kể tên. Thấy mình sắp
  cần sửa chỗ khác thì DỪNG và hỏi tôi.
- TDD (luật 4): test đỏ đúng lý do trước, rồi mới cài. Ca test mới nào cũng thử đột biến
  thật (sửa code cho sai, thấy đỏ, trả lại — không khôi phục bằng git checkout/restore khi còn
  thay đổi chưa commit), ghi kết quả, kể cả đột biến không giết được và vì sao.
- GATE CHẠY CÔ LẬP cho MỌI lượt, vì session admin chạy gate cùng lúc: chờ lượt nặng của bên
  kia xong; API của mình ở cổng 3101, tắt đúng PID của mình; int test trên DB riêng
  tourism_test_p7. TUYỆT ĐỐI không chạy lệnh giết tiến trình theo cổng 3001. Commit memory
  trống dưới 6 GB thì DỪNG và báo — đừng tự giết tiến trình nào không phải của mình.
- Comment code TIẾNG VIỆT (luật 8); chữ khách thấy bằng TIẾNG ANH trong @tourism/i18n
  (luật 7). Tokens-only, không hex (luật 6).
- Commit Conventional Commits, message TIẾNG VIỆT CÓ DẤU, KHÔNG AI attribution — không dòng
  Co-Authored-By (luật 12). Stage theo đường dẫn tường minh, không `git add -A`. Chạy
  `pnpm lint:fix` trước khi stage. Không `--no-verify`.
- Contract và i18n được đọc từ dist: sửa xong phải build lại trước khi test gói khác (lệnh ở
  Ràng buộc toàn cục).
- Next.js 16: đọc tài liệu trong apps/web/node_modules/next/dist/docs/ trước khi sửa trang.
- Rà docs/skills.md trước khi bắt tay (luật 9).

CHÍN CHỖ DỄ SAI (plan có đủ chi tiết)
1. Hợp đồng đổi HAI NHỊP: Task 2 chỉ THÊM; `status` nhận mảng và route bookings.mine trả
   schema mới đi cùng service ở Task 4 — đổi route sớm thì mọi GET /api/bookings ra 500
   (Quyết định 14).
2. Thứ tự journey: đang đi → sắp đi (gồm đơn chờ trả) theo ngày đi tăng → đã qua theo ngày
   đi giảm; hoà thì createdAt giảm rồi id tăng. Fixture phải có ngày tạo đơn KHÁC thứ tự ngày
   đi. `facets` đếm trên TOÀN BỘ đơn trước khi lọc (Task 3).
3. Khoá tìm searchKey bỏ dấu, hạ chữ thường, bỏ MỌI ký tự không phải chữ hoặc số, ở cả hai
   phía, dùng lại foldAccents của contract; ca test gõ "ha noi" cho "Hà Nội" (Quyết định 15).
4. Service đọc tập khoá nhẹ rồi nạp đủ dòng cho các id của trang: rào userId ở CẢ HAI câu
   đọc, và giữ đúng thứ tự hàm thuần trả (`id IN (…)` không giữ thứ tự) (Task 4).
5. Mảng trên query GET theo ký pháp ngoặc của oRPC (`when[0]=…`); `status=PAID` kiểu cũ vẫn
   hợp lệ, Passport không đổi gì. Int test của Task 4 là phép thử đầu tiên của repo cho mảng
   trên query GET — đỏ vì oRPC không dựng được mảng thì DỪNG và hỏi, đừng tự đổi cách truyền.
6. "Hôm nay" là ngày lịch Việt Nam do server tính (vietnamToday ở API, todayDateString ở
   web); so ngày bằng chuỗi YYYY-MM-DD, không `new Date('YYYY-MM-DD')`, không đồng hồ trình
   duyệt.
7. Hàng lọc: debounce 300 ms, Enter áp ngay; sentQ để lượt tìm của chính ô về tới không đè
   chữ đang gõ; useOptimistic; lọc và tìm dùng router.replace và đưa page về 1; phân trang là
   link thường giữ bộ lọc. Tiêu điểm không bao giờ rơi về <body> (✕, Reset, Clear filters).
   Mọi ô và nút cao 36px; hai nút lọc cùng rộng 176px dù đã chọn hay chưa (Task 6–8).
8. Accordion đọc bookingPhase cho dòng phụ, Pay now và Review: đơn lapsed mất Pay now (cố
   ý). `key` của BookingAccordion theo URL để hàng đầu mỗi trang mở sẵn; page vượt số trang
   thì chuyển về trang cuối (Task 9).
9. Task 9 gỡ thứ hết người dùng (groupBookingsByTime, daysUntilDeparture cùng 16 ca test,
   BOOKINGS_PAGE_SIZE, accountBookings.loadMore, passportBookings.back) nhưng GIỮ
   booking.list.browse — Phần B dùng. Tên bookingPriceLines, paymentProviderLabel,
   ContentHero.back phải đúng từng chữ: Phần B và C mở đầu bằng grep đúng các chuỗi ấy.

Base UI trong jsdom: mở Popover xong thì chờ bằng findByRole; khớp chữ chính xác, không
/…/i. Không bao giờ hai h1 trên một trang.

BÀN GIAO KHI XONG (Task 12 Bước 9)
Không merge. Viết cho tôi: danh sách commit; kết quả gate (số test từng gói, số int); đột
biến đã thử và kết quả; số đo Task 11 ở 1280px và 375px kèm ảnh; chỗ lệch plan và vì sao;
việc cần hạ tầng (dự kiến: không có); dung lượng ổ C trước và sau khi dọn.
```
