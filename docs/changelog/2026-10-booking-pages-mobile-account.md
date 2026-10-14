# CHANGELOG — lưu trữ: trang đơn của khách P7 phần B và C, màn tài khoản mobile (08/10–10/10/2026)

Trang chi tiết đơn và voucher thiết kế lại rồi vá gộp sau review, Saved và
Settings của khách đổi giao diện, cụm màn tài khoản mobile gộp vào `main`, và
duyệt thiết kế bản in G40.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 14/10/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`, và
link tới tài liệu dời thư mục cùng ngày 14/10 trỏ sang chỗ mới. Đừng
mở-rồi-save bằng editor có markdownlint: nó đổi `+` đầu dòng thành `-` và nói
sai con số test đã ghi.

## 2026-10-10 — Duyệt thiết kế G40 bản in và file xuất (ADR-0057, ADR-0034 AMEND 3, spec); thử lại P7 B và C 3/3; ghi G41

**Thử lại P7 B và C trên production** (đóng CÒN TREO của entry 09/10 ngay dưới): sau push
`d6555616` ba đèn xanh — Actions 12m26s, Render live, Vercel READY. User thử lại 3/3 đạt: nhãn
TODAY nằm giữa vạch nối và link "Full itinerary" mở tab Itinerary đúng chỗ, kể cả Back rồi bấm lại
(cái "không mở tab" của 09/10 là trang dừng sai chỗ do Lenis, không tái hiện được sau bản vá);
toast "Thanks for your review" khi gửi lại review thử trên BK-J9AUYIYB; receipt voucher BK-7D1FHRQG
in "$867.00" trên "−$867.00". Đã dọn ở máy: worktree `booking-pages-redesign` và `booking-voucher`,
sáu nhánh (ba nhánh đã merge, ba nhánh `backup/p7*`), scratchpad 271 MB.

**G40 — thiết kế bản in và file xuất, duyệt bằng mắt trong chat.** Rà sáu đầu ra (voucher in, hoá
đơn chờ in, báo cáo tháng in, Excel báo cáo, CSV bookings, CSV subscribers): cả ba bản in là trang
web đem in chứ không phải tờ giấy. Tham khảo voucher của Musement, GetYourGuide và boarding pass in
khổ A4; bản thảo là trang A4 thật với dữ liệu prod (BK-EET0JBTH, tháng 9/2026). User chốt:

| Đầu ra | Bản chốt |
| --- | --- |
| Voucher in | 5b — user tự ghép: bìa ảnh tour, tấm vé có cuống, lịch trình hai cột cùng Included, dải Where to meet · Cancellation · Payment |
| Hoá đơn chờ in | B1 — cùng họ 5b, tấm vé ở trạng thái chờ, cuống "Not yet a voucher" kèm giờ nhả đơn |
| Báo cáo tháng in | C2 — dashboard trên giấy, thác nước lãi lỗ SVG |
| Excel báo cáo | D1 — Summary dashboard có thanh `REPT` trong ô |
| Xuất danh sách | Excel thay CSV |

Phát hiện khi dựng và đo:

- **CSV không mở được bằng bấm đúp trên Windows tiếng Việt** (đo bằng Excel 16 trên máy user,
  dấu thập phân `,`): cả dòng dồn vào cột A. Mẹo `sep=,` tách được cột nhưng Excel bỏ BOM, "Hội
  An" thành "Há»™i An", tiền thành chữ. Từ đó danh sách chuyển sang Excel (ADR-0034 AMEND 3).
- **Ngày trong Excel đang xuất ra "5 Thg10 2026"** trên máy tiếng Việt: định dạng `d mmm yyyy`
  lấy tên tháng theo Windows; từ nay ép `[$-409]`.
- **Teal thương hiệu trượt ngưỡng chroma** của bộ kiểm bảng màu (dataviz) khi dùng cho biểu đồ;
  cặp `chart-gain` / `chart-cost` mới qua đủ các bài kiểm, chi phí có thêm vân 45° cho bản in
  trắng đen.
- Panel xem file của app không tải ảnh từ mạng và không chạy script: bản thảo gửi user kèm ảnh
  chụp bằng Edge headless (bản HTML nhúng ảnh base64 cùng mã vạch vẽ sẵn).

Bản ghi: [ADR-0057](../adr/0057-print-documents.md) (bản in là component chỉ-in, trang in `doc`
A4 lề 0 để trình duyệt thôi in ngày giờ và URL, khung đầu và chân trang chung, token màu mới),
ADR-0034 AMEND 3, [spec G40](../specs/2026-10-10-print-and-export-redesign-design.md), bốn bản thảo ở
`docs/design/mockups/` (`print-voucher`, `print-receipt`, `print-report` `.src.html`,
`excel-report-d1.xlsx`). Spec chia ba phần thi công: web in · admin in · Excel.

**G41 (mới):** bộ dọn ảnh trên production gần như không chạy — `media_garbage` còn 19 mục
`attempts = 0`, log từ 15/09 chỉ có một lượt (03/10). Gốc: API Render gói free ngủ sau 15 phút mà
worker chạy chung tiến trình, nên ba job hằng ngày 03:00–04:00 UTC chỉ chạy khi đúng lúc ấy máy
đang thức. Đề xuất chạy bù khi worker khởi động; chưa duyệt.

**CÒN TREO:**

- [ ] User duyệt spec G40, rồi plan và thi công Phần 1 (web in).
- [ ] G41: chốt hướng vá, AMEND ADR-0024 trước code, xong trước lượt seed lại ~03/11.
- Docs và bản thảo, không đổi mã; không migration, không env.

## 2026-10-09 — Thử tay P7 phần B và C trên production; năm bản vá (nhánh `fix/p7-journey-itinerary`)

**Thử tay** (sau deploy `072df39c`; tài khoản seed nora.dahl, user bấm, session gốc soát DB chỉ
đọc; 09/10 khoảng 17:00–18:40): bước 4–14 của spec P7 §11 (bước 1–3 là phần A, thử 06/10) và
badge accordion My bookings (I1). Bảy bước đạt nguyên trạng: 6 đơn đã huỷ cả hai kiểu (khách huỷ
sau hạn chót BK-QQ2P3HBC "No refund due"; chuyến công ty huỷ BK-7D1FHRQG ở bước 11 "Departure
cancelled", không form review), 7 voucher vừa trả (đặt BK-EET0JBTH bằng thẻ thử Stripe: "Your day
in Hội An is booked.", pháo giấy), 8 voucher mở lại sau 30 phút, 10 bốn trang ở 375px, 11, 13
`/checkout/cancel` của đơn đã trả sang voucher, 14 voucher đã đi và đã huỷ không ô Meeting point.
Thấy lỗi, vá ở nhánh này:

- Bước 4 (đơn sắp đi): nhãn TODAY lệch xuống dưới vạch nối; "Full itinerary →" thừa mũi tên.
- Bước 12 (link "Full itinerary"): lần đầu mở đúng tab Itinerary nhưng "thanh cuộn có lúc kẹt";
  Back rồi bấm lại thì user thấy tab không mở.
- Bước 5 (đơn đã đi): gửi review thành công mà không có thông báo nào, user tưởng nút không chạy.
  Thụt lùi từ 05/09 (`15cde0be`, ADR-0032): form ở lại để còn sửa tới lúc duyệt, nên dấu hiệu duy
  nhất là dòng "Your review is with our team" đầu khung và chữ nút đổi thành "Send for review
  again"; trước đó lời cảm ơn thay chỗ form. Đợt B dời khu review sang cột phải nên càng khó thấy.
- Bước 11 (voucher BK-7D1FHRQG): receipt in "$867" ngay trên "−$867.00" — hai độ chính xác trong
  một cột.

Bước 9 (bản in voucher) chạy được — chỉ in thẻ, hai cột, gọn một trang A4 — nhưng user chê "như
làm đại" và muốn thiết kế lại cùng bản in và file xuất của admin: ghi G40, đợt riêng.

**Vá** (5 commit; ba việc đầu agent Opus thi công, session gốc soát diff; hai việc sau session gốc
làm, TDD):

- `22281513` bỏ "→" sau link "Full itinerary" (các link "View tour →" giữ).
- `c65dbffc` TODAY: từ `md` dòng đổi sang `block` nên viên thành phần tử inline — hộp nền cao theo
  font (21px thay vì 17,5px) và ngồi trên đường cơ sở, tâm lệch 3,5px dưới vạch ở mọi khổ máy bàn.
  Nay đặt tâm bằng `top-5` và `-translate-y-1/2`: lệch 0 ở 768, 1024, 1280, 1440, 1920; 375 không
  đổi.
- `f79df8c8` Lenis (G33 vá một phần): `naiveDimensions` — Lenis nhớ đáy trang lúc khởi tạo, mà
  `<html>` mang `h-full` nên trang dài ra (điều hướng mềm, đổi tab) không báo gì, lăn chuột bị kẹp
  ở đáy cũ (1378 thay vì 2812); `stopInertiaOnNavigate` — bấm link trong khoảng 1,2 giây sau cú lăn
  thì quán tính kéo trang mới về đích cũ (1080 thay vì 1167). Hai ca test chạy Lenis thật. Phần
  "Back rồi bấm lại không mở tab" không tái hiện được ở sáu biến thể (`next dev`, next build, 1280,
  375, site thật chỉ đọc): tab luôn mở, chỉ chỗ dừng sai vì hai cơ chế trên — chờ user thử lại.
- `1296df8a` toast "Thanks for your review" sau khi gửi, cả lần đầu lẫn gửi lại — dùng lại
  `successTitle`, `successBody` mà màn đã gửi của app mobile (nhánh `feat/mobile-review-screens`)
  đọc; thêm test cho nhánh sửa (`reviews.update`) vốn chưa có test nào.
- `b564954f` receipt của voucher có dòng tiền hoàn thì mọi số đủ hai số lẻ: `formatBookingMoney`
  và `bookingPriceLines` nhận tuỳ chọn `exact`. Chỉ receipt của voucher, chỗ duy nhất tiền hoàn
  đứng cùng cột với tổng; nơi khác kể tiền hoàn bằng câu.

**Review findings:** nhánh nhỏ, không chạy review riêng: session gốc soát diff của agent (đọc mã
nguồn Lenis 1.3.25 xác nhận hai tuỳ chọn có thật, `naiveDimensions` chỉ đổi getter `limit`), mỗi
bản vá có test hay số đo trước và sau.

**CÒN TREO cho session gốc:**

- [ ] Push đụng web và i18n: canh đủ ba đèn — Actions, Render (API tự deploy theo push, G23),
  Vercel.
- [ ] User thử lại trên prod: TODAY; "Full itinerary" lần đầu, rồi Back và bấm lại; gửi lại review
  thử trên BK-J9AUYIYB thấy toast; receipt voucher BK-7D1FHRQG in "$867.00" trên "−$867.00".
- Dữ liệu thử còn trên prod, để lượt seed lại ~03/11 dọn: review "Test review" chờ duyệt trên
  BK-J9AUYIYB; đơn BK-EET0JBTH (Stripe test, $39, đi 29/10).
- Dọn ở máy sau merge: worktree `booking-pages-redesign` và `booking-voucher`, các nhánh
  `feat/booking-pages-redesign`, `feat/booking-voucher`, `fix/p7-journey-itinerary` và ba nhánh
  `backup/p7*`.
- Không migration, không env, không webhook, không đổi Cloudinary.

Tests after (`gate:int` trên `1296df8a`, 09/10 18:48–18:55): unit 6589 — web 2138, admin 1911, api 1097,
contract 675, mobile 502, mobile-ui 134, core 46, ui 36, i18n 31, tokens 19 — và int 779/46. Web
2130 → 2138: Lenis 2 ca, toast 3 ca, receipt 3 ca.

## 2026-10-09 — P7 phần B và C: đợt vá gộp sau review max (nhánh `feat/booking-pages-redesign`)

**Bối cảnh.** Review max 08/10 của hai phần P7 chưa merge (hai entry ngay dưới): Phần C
(voucher) 15 phát hiện C#1–C#15 cộng các mục nhỏ ngoài trần (mục 15–19, 22 và "Ngoài diff"),
Phần B (trang chi tiết đơn) 15 phát hiện cộng bảy mục dọn mã ngoài trần (B13–B16, B18–B20); B8
bị bác. Nhiều phát hiện chung gốc giữa hai trang — luật giai đoạn bỏ sót đơn hoàn thiện chí và
chuyến công ty huỷ, ngày cắt theo UTC, câu hoàn tiền và mã vạch mỗi trang một bản — nên vá gộp
trên một nhánh: `feat/booking-pages-redesign` mang cả 11 commit của B lẫn 7 commit của C (nhánh
`feat/booking-voucher`), hai phần merge cùng một lượt. User chốt 08/10 ("theo đề xuất", "cứ làm
theo hướng tối ưu"): D1 luật giai đoạn theo ADR-0054 AMEND 1; D2 khu review giữ khung thẻ ở mọi
khổ, hàng sao và nút gửi xuống dòng khi hẹp, lưới một cột dưới `lg`; D3 đơn `lapsed` nói có điều
kiện, không khẳng định đã lỡ; D4 điểm hẹn dự phòng mời liên hệ; D5 bỏ mã đơn ở hero voucher; D6
khu review theo `reviewSlot` ở mọi giai đoạn, chân Get ready chỉ cho PAID. User bỏ: C mục 20
(phần fixture gộp vào T2), mục 21 (test ghim class Tailwind) và đề xuất đổi lớp phủ ảnh. Sáu nhóm
T1–T6 thi công bằng agent, tuần tự trên một worktree; sau T6 nhánh rebase lên `main` có Saved và
Settings (`f157517a` chỉnh chỗ xuống dòng ở `messages.spec.ts` sau lần rebase ấy).

**ADR-0054 AMEND 1** (`054fb044`, đi trước code): `Booking` của contract thêm `departureCancelled`
(API đọc `departure.status`, vì chuyến seed không có `cancelled_at`). Giai đoạn xét từ trên
xuống: chuyến công ty huỷ là `cancelled` với mọi trạng thái đơn; CANCELLED và REFUNDED có
`cancelledAt` là `cancelled`; REFUNDED không `cancelledAt` (hoàn thiện chí trọn, khách vẫn đi) đi
theo ngày như PAID. `lapsed` không phải kết cục: claim của webhook còn nhận phiên mở trước hạn.
Voucher, mã vạch, mộc đọc qua một hàm thuần; khu review theo `reviewSlot`.

**Nội dung theo nhóm.**

- **T1 contract và API** (`c8c81db7`): cờ `departureCancelled` trên mọi đường đọc đơn
  (`bookingInclude` dùng chung, `create` dựng từ chuyến có sẵn); `BookingPhaseInput` thêm
  `cancelledAt`, `departureCancelled`; `bookingPhase` theo AMEND 1; khoá lọc của `bookings.mine`
  mang hai trường để lọc, xếp, đếm theo luật mới. Giá: `adminList` và mỗi lần đọc đơn lẻ (trừ
  `byCode`, `create`) thêm một câu SQL nhỏ; câu khoá của `mine` thêm một câu nối đuôi, câu trang
  lấy chuyến từ câu khoá. Hai spec web mã hoá luật cũ (REFUNDED không mốc là huỷ) đổi dữ liệu,
  giữ nguyên assertion.
- **T2 helper chung** (`8771f485`..`dd26f54e`, 8 commit): `vietnamDay` thay mọi phép cắt
  `slice(0, 10)` trên mốc của đơn (B4, C#3 — khách huỷ 06:30 giờ VN ngày 01/11 từng đọc
  "Cancelled · 31 Oct" cạnh "No refund"); `wasCharged` cho `refundSummary` kể khoản hoàn của đơn
  bị thu rồi hoàn tự động (B1, C#5 nửa sau); `refundSentence` một câu hoàn tiền, `switch` đủ biến
  thể (B14, C#14); `cancelledOn` chỉ lấy mốc huỷ thật hay yêu cầu được duyệt (B3, B15);
  `freeCancellationOpen` chỉ đọc cờ server, web hết tự so ngày chót (B2, B15, C mục 16);
  `bookingPass` một luật voucher và mã vạch cho vé, nút "View voucher", voucher và accordion
  (B11); `TicketBarcode` thay ba bản vẽ mã vạch (B13, C#15); `fetchTourDetailOrNull` thay hai cách
  bọc lỗi đọc tour (B16, C#6 phần gom); fixture `makeCancellation`, `makeTourData` (B19).
- **T3 trang chi tiết đơn, luật và chữ** (`b460fb17`..`ad953687`, 7 commit): khu review theo
  `reviewSlot` ở mọi giai đoạn, đứng dưới khối của giai đoạn (D6: B6 — ngày về từ 07:00 giờ VN có
  form; B2 — đơn có review rồi bị hoàn, huỷ vẫn sửa, rút được; B7); chân Get ready chỉ PAID, "Your
  review opens on {date}." (B5); `lapsed` nói có điều kiện, mốc "Payment not completed" là `now`,
  mộc "NOT PAID" (D3, B9, S1); chuyến công ty huỷ: "Departure cancelled · We had to cancel this
  departure." kèm "Your full refund is on its way." khi job hoàn tiền chưa chạy; thanh hành trình
  bỏ mốc Free cancellation khi server không gửi thông tin huỷ; vé: "Paid with" theo `wasCharged`
  (B1), ảnh qua `SlotImage` (B17); chỉ đọc tour ở `upcoming`, `on_tour` (`needsTourData`, B16).
- **T4 trang chi tiết đơn, bố cục và dọn** (`1a2436fd`..`e36156b4`, 10 commit): khu review có
  khung ở mọi khổ, hàng sao và nút gửi thành hàng riêng dưới ô chữ, lưới `grid-cols-1` dưới `lg`
  (D2: B12, B12b); nhãn TODAY kẹp theo px quanh tâm mốc, vạch tô dừng tại nhãn (B21); nhãn tuyến
  của vé thành hàng riêng dưới `sm` (B22); ô chữ tự do bẻ dòng ở bất kỳ đâu (S2); chip "Awaiting
  payment" và icon hạn huỷ đã qua đạt tương phản ở hai theme (B24); ca qua hạn huỷ của Get ready
  (B23) và cây tiêu đề trên render thật (S3); `PanelCard`, `PanelKicker`, `DayText` gom vỏ thẻ,
  nhãn nhỏ, hộp lịch trình ngày (B18); bỏ prop và phép tính suy ra được (B20); comment về
  `lapsed` sửa theo AMEND 1.
- **T5 voucher** (`50a52e81`..`30648aac`, 17 commit): một đồng hồ cho cả "vừa trả" lẫn hôm nay
  (mục 17), mộc theo `bookingPass`, bỏ `phase`, `showCode` dư (mục 15) và nhánh chết (mục 16);
  chuyến công ty huỷ không còn "vừa trả", có dải "We had to cancel this departure — this voucher
  is no longer valid.", mốc Refund "Your full refund is on its way." khi job chưa chạy; nhật ký:
  mốc hạn huỷ chỉ khi server gửi thông tin huỷ, "Reviewed" theo phán quyết review (C#2); điểm hẹn
  dự phòng "Contact us for the meeting point — we reply within a day." (C#4, D4); hoá đơn chờ: câu
  dưới tiêu đề theo tâm trạng, hết "sent to" cho đơn chưa trả (`receiptNote`, C#5);
  `/checkout/cancel` đưa đơn đã trả sang voucher ("Ngoài diff"); hero bỏ mã đơn (C#10, D5);
  fixture phân biệt ngày đi với ngày về, ngày đặt với ngày trả, số hoàn với tổng (C#8); mã đơn
  không gãy dòng (C#9); bản in từ giao diện tối gỡ nền trang, ô mã, dải huỷ (C#7); vạch nối
  journal in được (C#11); `sizes` đúng ô ảnh và nạp lười (C#12); biến thể `voucher-split:`,
  `voucher-stack:` thay năm cặp `max-xl:` / `print:` (C#13); pháo giấy tải `canvas-confetti`
  động (mục 18); hằng `DEADLINE_CUTOFF_COPY` một nguồn cho giờ chốt (mục 19); "View booking" là
  `ButtonLink` (mục 22).
- **T6 trang tour và voucher** (`d9cce00a`, `bacacb2b`): mỗi nút tab của trang tour mang `id`
  bằng hash của nó cùng `scroll-mt`, nên `/tours/{slug}#itinerary` dừng ở dải tab với Itinerary
  mở — Next.js, trình duyệt và Lenis tự cuộn tới mốc, không thêm lệnh cuộn nào (B10); voucher chỉ
  đọc tour khi có ô Meeting point (sắp đi, đang đi), đã đi hay đã huỷ còn ba ô (C#6 phần còn).

**Phát hiện thêm trong lúc vá.**

- Sau khi `freeCancellationOpen` chỉ đọc cờ, đơn hoàn thiện chí trọn còn sắp đi in "Free
  cancellation · Ended {ngày chưa tới}" ở thanh hành trình và nhật ký voucher: server không gửi
  thông tin huỷ cho đơn ấy thì nay bỏ hẳn mốc (`a5acd7e3`, `c38fbedb`).
- Khu review ở cột phải từ khoảng 1100px: hàng sao vừa một dòng cạnh ô chữ nên ép ô còn 51,7px
  (1200px), 14px (1280px, slot pending). Vì vậy hàng sao và nút xuống dưới ô chữ ở MỌI khổ —
  rộng hơn chữ của D2; nếu user muốn giữ một hàng ở khổ rộng thì thay bằng `basis-48` cho ô chữ.
- Lý do bị bác của review (chữ admin gõ) có link dán liền làm trang 375px cuộn ngang 60px — vá
  chung với S2.
- Thẻ voucher một cột có cột ngầm `auto`: email 44 ký tự đẩy cột thành 349,8px trong thẻ 288px,
  `overflow-hidden` cắt 10 dòng ở mép phải ở 320px (`e3c9e86e`).
- Bản in voucher từ khổ 768px CSS bật `md:px-8` của màn hình, ô mã còn 142px cho mã 154px: đệm
  in cố định 1.5rem (trong `9f66b837`).
- Trang tour không có phần tử nào mang id `itinerary` (lẫn bốn hash còn lại): điều hướng mềm giữ
  vị trí cũ, tải cứng đứng đầu trang. Sửa xong thì link `#good-to-know` trong trang cũng tới dải
  tab. Cái giá đã đo: bấm Back về URL tour mang hash tab thì Chromium đưa về dải tab thay vì vị
  trí cũ.
- Lỗi có sẵn toàn site: quán tính Lenis giành vị trí cuộn khi điều hướng mềm trong khoảng 1,2
  giây sau cú lăn chuột (open-items G33).
- Đột biến của C#8: biểu thức M3 viết lại theo mã mới; trước đợt vá 4/5 đột biến sống, sau 0.

**Số đo bố cục** (markup thật, CSS build thật, font thật, Edge headless).

- **Trang chi tiết đơn (T4)**, 15 ca × 320/360/375/768/1024/1280 = 90 lượt: trang cuộn ngang 23
  ca → 0 (nặng nhất 115px ở 320px, slot rejected); nút bị cắt 2 → 0 ("Send for review again" lố
  14,1px ở 1024px); nhãn TODAY đè icon 16 ca → 0, khe nhỏ nhất −22px → 2,9px; nhãn tuyến tràn
  hay đè 45 ca → 0 ("2 days · TP. Hồ Chí Minh" ở 320px: 6 dòng, lố 41,3px → một dòng); ô chữ của
  form review ở 1280px (slot pending) 14px → 322,8px; email 44 ký tự `truncate` được dưới `lg`.
  Tương phản theme tối tính từ token: chip 2,14 → 4,98:1, icon quá hạn 1,39 → 7,39:1.
- **Voucher (T5)**, 6 ca × sáng/tối × 7 khổ màn hình (320–1536) và 3 khổ in (718, 777, 1047) =
  120 lượt: 120/120 không cuộn ngang, không chữ bị cắt hay đè; mã đơn một dòng ở mọi khổ (trước:
  hai dòng ở 320px và bản in 777, 1047); `sizes` so với ô ảnh 0,9–1,4 → 1,0; bản in từ giao diện
  tối có bật "in nền": tương phản nhỏ nhất 1,3:1 (24–33 dòng trượt ngưỡng) → 5,1:1 ở hai ca đã
  huỷ, bốn ca còn lại còn đúng một dòng 2,2:1 là mộc CONFIRMED (có từ trước, G32); vạch journal
  khi tắt "in nền": mất → viền 5,9:1 sáng, 5,1:1 tối.
- **Trang tour (T6)**, `next dev` và API dev: tải cứng `/tours/x#itinerary` ở 1280px dải tab từ
  1310px (ngoài khung) → 143px, dưới navbar 124px; ở 375px từ 2022px → 112px, dưới navbar 88px;
  điều hướng mềm từ trang đang cuộn 1400px: dải từ −90px (khuất phía trên) → 143px; bấm tab hay
  tải lại trang giữ nguyên vị trí như trước; giảm chuyển động thì tới thẳng. Voucher sau việc 2:
  60 lượt sạch.

**Tự chốt trong lúc thi công, chờ user nhìn qua:** hàng sao luôn dưới ô chữ (ở trên); icon quá
hạn dùng `dark:text-warning` tạm tới khi có token (G32); nút "Copy code" xuống hàng dưới mã ở ô
hẹp; "View booking" thành `ButtonLink` — `<a>` thường, mất prefetch như mọi CTA điều hướng của
web, chữ 16px thành 14px, thêm viền 1px của hệ; trang tour không thêm lệnh cuộn lúc mount, và
Back về URL có hash tab thì về dải tab (user không nhận thì ghi thêm một mục open-items).

**Review findings:** xem Bối cảnh — 30 phát hiện, vá hết, cùng các mục ngoài trần user chọn
làm. Review cuối của diff đợt vá (`453691cd..f157517a`): 0 Critical, 1 Important, 3 Minor — I1
badge accordion My bookings hiện "Paid" xanh cho đơn còn PAID trên chuyến công ty huỷ trong khi
trang chi tiết đơn và voucher nói chuyến bị huỷ; M1 mời viết review cho chuyến công ty huỷ khi job
hoàn tiền kẹt qua ngày về; M2 thanh hành trình không kể tiền đang về (đơn PAID mất mốc Refund) và
kể số của lần hoàn cũ như đã xong; M3 nhánh "đã là voucher" của hoá đơn chờ thành mã chết. Vá hết
ở `ce041d01`..`b08f2fb4`, mỗi mục một commit, TDD (web 2117 → 2130: thêm 20 ca, gỡ 7 ca canh nhánh
chết): badge theo `bookingPass` cùng luật với mộc; `reviewSlot` trả `hidden` cho chuyến công ty
huỷ chưa có review; mốc Refund đang đứng "On its way" với khoá mới
`bookingDetail.journey.refundOnItsWay`; gỡ nhánh chết của hoá đơn cùng `ticketSerial` và sáu khoá
i18n mồ côi (`confirmedTitle`, `confirmedBody`, `receiptSentTo`, `paidAtLine`, `statusPaid`,
`stubShowCode`). Ngoài phạm vi, vào open-items: G36 cổng review của API chưa chặn chuyến công ty
huỷ; G37 chữ cuống hoá đơn của đơn chưa trả đã đóng, chờ user chốt; G38 năm khoá i18n mồ côi từ
thời `CheckoutShell` và JSDoc `TICKET_BARCODE_BAR_COUNT`; G39 `passport.ts` chưa theo AMEND 1.

**CÒN TREO cho session gốc:**

- [ ] Thử tay production từng bước sau merge: spec P7 §11, bước 1–14 (11–14 thêm cho đợt vá).
- [ ] Push đụng cả API (contract, `bookings.service.ts`) lẫn web: canh đủ ba đèn — Actions,
  Render, Vercel (G23). Web không kiểm response bằng Zod, nên khoảng lệch web lên trước API chỉ
  khiến cờ vắng (coi như chuyến còn chạy), không vỡ trang.
- [ ] Dọn ở máy sau merge: worktree và nhánh `feat/booking-voucher`, ba nhánh `backup/p7*`.
- Không migration (cờ `departureCancelled` đọc `departure.status` có sẵn qua include), không
  env, không webhook, không đổi Cloudinary.

Ca mới của đợt vá, đo ở từng nhóm trước khi rebase lên `main` có Saved và Settings: web 1882 →
2060 (T2 thêm 56, T3 thêm 59, T4 thêm 10, T5 thêm 32, T6 thêm 21); i18n 29 sau T5; sau T1:
contract 675, api 1088, int 776/46. Đột biến của voucher (C#8): 5/5 chết.

Tests after (`gate:int` trên `b08f2fb4`, 09/10 16:44–16:51, sau rebase lên `c070db87`): unit 6581 — web 2130,
admin 1911, api 1097, contract 675, mobile 502, mobile-ui 134, core 46, ui 36, i18n 31, tokens 19 — và int 779/46.

## 2026-10-08 — P7 phần C: voucher `/checkout/success` thiết kế lại (nhánh `feat/booking-voucher`)

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
`paidAt` giữ hoá đơn chờ `BookingReceipt` cùng `CheckoutAutoRefresh` như cũ. Dưới `xl`
(điện thoại, máy tính bảng) thẻ một cột: ô mã gọn ngay dưới tiêu đề, mảng teal xuống cuối.
Bản in chỉ in thẻ: giấu navbar, hero,
footer và nút; mảng teal nền trắng viền teal; mã vạch mực đen; mực tối cả khi đang ở giao
diện tối. Trang không tìm thấy đơn trỏ "My bookings" về `/account/bookings`. Mảng teal dùng
`bg-primary` thay `bg-primary-emphasis` của spec (token vai chữ, dark mode sáng lên).

Chỗ lệch plan: `.catch` của `fetchTourDetail` ở trang gọi thêm `unstable_rethrow` như quyết
định 22 dặn (mã mẫu của plan bỏ sót); một ca của `voucher-pass.spec.tsx` destructure có kiểm
thay `items[0]!` vì Biome cảnh báo `noNonNullAssertion`; hai phép grep "phải rỗng" của Bước 12
(`bg-primary-emphasis`, `next*`) mỗi cái còn khớp đúng một dòng comment do chính plan viết sẵn
(JSDoc `VoucherPass`, comment `stubShowCode`), không mã nào dùng. Gate chạy cô lập trên DB
`tourism_test_p7c` với API cổng 3102 ở mọi lượt (kể cả build web của Task C5) vì Phần B chạy
song song ở worktree khác; máy chủ tĩnh của Task C5 mở bằng Git Bash.

Đợt vá sau C5 (cùng ngày, user duyệt làm ngay trên nhánh): soi thêm khổ máy tính bảng và chữ
trên ảnh thì lộ ba lỗi nằm ngay trong mã mẫu của plan, vá cả ba ở `f1042646`.

1. **Hai cột từ `md` vỡ ở 768–1279px.** Cột phải cố định 440px nên ở 768px cột trái còn 194px,
   cột chữ của bốn ô thông tin rộng 0px (chữ xếp dọc từng ký tự, mỗi ô cao 1141px), ở 1024px
   còn 63px. Nay hai cột từ `xl` (1280px: cột trái ~580px, đúng khổ bản vẽ, cùng mốc vé của
   trang chi tiết), dưới đó một cột; ô mã gọn và ô mã của mảng teal đổi chỗ theo cùng mốc,
   `sizes` của ảnh bìa sửa theo. Đo lại: cột chữ 187px ở 768px, 283px ở 1024px.
2. **Chữ trên ảnh không đọc được trên ảnh sáng.** Lớp phủ cũ trong suốt tới 30% chiều cao
   ảnh: ở 375px dòng "{nơi} · {D} days" và tên tour nằm trên ảnh trần (1,04:1 và 1,0:1 trên
   ảnh trắng), ở 1280px dòng ấy chỉ có ~0,4 alpha. Nay MỘT gradient gắn vào khối chữ (khuôn
   caption của `journey-moments.tsx`): 90% ở đáy, 70% đúng mép trên chữ, mờ dần qua phần đệm
   4rem; dòng nhỏ bỏ `opacity-80`. Mọi dòng chữ trên ảnh ≥ 5,45:1 kể cả trên ảnh trắng tinh, ở
   cả bốn khổ đo.
3. **Tên tour dài bị cắt trên điện thoại.** Ảnh cao cố định 224px, khối chữ neo đáy: tên tour
   dài nhất của seed ("Northern Highlights: Hanoi–Hạ Long–Ninh Bình 5D4N") đẩy dòng nhỏ quá mép
   trên ảnh và bị cắt. Nay ảnh chỉ có chiều cao tối thiểu, khối chữ nằm trong luồng ở đáy: tên
   ấy làm ảnh cao 330px, không mất chữ nào. Hệ quả: ở 375px ảnh của đơn mẫu cao 240px thay vì
   224px như plan ghi.

Số đo C5 trên CSS build thật, đo lại sau đợt vá. 1280px: không tràn ngang, mép thẻ thẳng tiêu
đề hero, hai cột, mảng teal 440px, chỉ ô mã của mảng teal hiện, ảnh 288px, mã vạch không tràn;
bản đã hoàn đủ không ô mã nào, dải "no longer valid" hiện trong mảng teal. 768px và 1024px: một
cột, ô mã gọn hiện, ô mã của mảng teal giấu, không tràn ngang. 375px: một cột, mảng teal xuống
dưới, ô mã gọn nằm giữa tiêu đề và ảnh, ảnh 240px, không tràn ngang; bản đã hoàn đủ chỉ dải
cột trái hiện, khối mã của mảng teal giấu (lần đo đầu ở lượt C5 chạy khi CSS chưa nạp xong nên
ra hai dải cùng hiện, đo lại sau `load` thì đạt). Bản in giả lập 718px, cả sáng lẫn tối, không
đổi sau đợt vá: chrome, hero và mọi nút giấu, thẻ hết khổ cao 758px (đã hoàn đủ 613px), mảng
teal 272px nền trong viền `solid 2px`, `break-inside: avoid`, tiêu đề, dòng phụ, mảng teal và
vạch mã đều mực `--hero`; hoá đơn chờ in như cũ (chrome còn, cuống `dashed 1px`).

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **5519** (web 1723, api 1068, admin 1718, contract 656, core 46, ui 27,
tokens 18, i18n 18, mobile 159, mobile-ui 86) và int **753 ở 46 file**. Ca mới ở web:
voucher.spec 25, voucher-overview.spec 13, voucher-pass.spec 11, voucher-card.spec 4. Đột biến
đã thử: 50, giết cả 50 (C1 14, C2 7, C3 9, C4 3, đợt vá 17); nhánh `awaiting_payment`/`lapsed`
của `voucherView` không test nào giết được — gỡ nó thì typecheck đỏ vì `switch` hết vét cạn.

CÒN TREO: không có việc hạ tầng (không migration, không env, không webhook, không đổi API).

## 2026-10-08 — P7 phần B: trang chi tiết đơn (nhánh `feat/booking-pages-redesign`)

Trang `/account/bookings/[code]` dựng lại theo bản vẽ duyệt 05/10: vé kiểu boarding pass (ảnh
tour, thân vé có mộc, cuống có mã vạch khi đơn còn hiệu lực và đã trả; đường xé gạch đứt với
hai vết khuyết che viền vé — ngoại lệ user duyệt riêng cho trang này), thanh hành trình năm mốc
có nhãn Today và chip theo giai đoạn (biến thể huỷ và lỡ hạn trả), hai cột: trái là thông tin
đơn bốn khối với hàng nút đáy, phải đổi theo `bookingPhase` — Get ready (đếm ngược, bước chuẩn
bị, ô tích nhớ trên máy), ngày trong chuyến, khu review (giữ nguyên linh kiện), đơn đã huỷ hay
lỡ hạn, đơn chờ trả. Hero có nút quay lại My bookings; trang còn đúng một `h1`; bỏ link chữ
"← Passport". Không đổi API, không migration, không env.

Chỗ lệch plan. Soi bố cục B8 tìm ba lỗi, sửa ở `5636ca66`: khung "Day 1" lộ nửa dòng thứ năm
(`overflow: hidden` của `line-clamp` cắt ở mép vùng đệm — đệm và nền chuyển ra lớp bọc); hàng
nút đáy xuống dòng vì link chính sách của `BookingActions` làm cụm Contact us / View voucher
dạt sang trái (thêm `ml-auto`, spec §5.3 đặt cụm này bên phải); khu review tràn ngang 31px ở
375px vì `ReviewComposer` rộng tối thiểu khoảng 339px mà thẻ bọc có viền và `px-6` chỉ chừa
293px — dưới `sm` khu review để trần như trang cũ, từ `sm` mới là thẻ (linh kiện giữ nguyên,
spec §5.4). Hai ca test được siết để giết đột biến plan dự kiến chết (chỉ sửa test):
`get-ready-panel` kiểm các bước khác không mang `data-open`, `booking-details-panel` cho đơn huỷ
mang yêu cầu huỷ của luồng cũ. `8bd11a4f` gỡ biến `paid` thừa trong mã plan cấp cho cột thông
tin đơn (Biome cảnh báo). Plan ghi `todayPct` của trang đang đi ở 1280px là 74, nhưng phép tính
của chính plan (87,5% vạch) ra 80 — số đo thật là 80, khớp ca 87,5 của Task 13. Kiểm tay trên
dev (Task 20 Bước 8) với năm đơn seed của một khách (sắp đi, đang đi, đã đi, đã huỷ chưa trả,
đã hoàn): mỗi trang một `h1`, có nút quay lại, khối cột phải đúng giai đoạn, không lỗi console,
ô tích Budget còn nguyên sau khi tải lại.

Số đo B8 bằng CSS build thật. 1280px (đơn sắp đi): không tràn ngang, một `h1`, mép vé thẳng
tiêu đề hero (lệch 0), ảnh 210px, cuống 262px, dải 38px, ba phần ngang; vết khuyết `::before`
top và left −12px, clip `inset(50% 0px 0px)`, `::after` bottom và left −12px, clip
`inset(0px 0px 50%)`, cả hai mang màu nền trang, phóng to thấy viền ngang của vé đứt đúng chỗ
khuyết; thanh hành trình một hàng, Today ở 43% khung (khớp `left:43%` của bản vẽ); hai cột, đỉnh
lệch 0. 375px: không tràn, một `h1`, lệch mép 0, vé xếp dọc ảnh → thân → cuống; `::before` top
và left −12px, clip `inset(0px 0px 0px 50%)`, `::after` top và right −12px, clip
`inset(0px 50% 0px 0px)`, viền dọc đứt đúng chỗ khuyết; mốc xếp dọc, Today chen giữa Paid và Free
cancellation; khối giai đoạn nằm trên thông tin đơn; hàng DEPARTS → RETURNS không tràn. Ba trang
còn lại: đang đi không tràn ở hai khổ, Today 80%; đã huỷ không ảnh không tràn ở hai khổ, dải đầu
vé bo góc trái trên và lưới ô bo góc trái dưới 15px, hai vết khuyết đúng; đã đi không tràn ở 1280
và 1024 (cột phải 481px và 388px), ở 375 tràn 31px trước bản sửa, 0 sau.

Bốn khoá i18n mồ côi của `passportVisa` đã gỡ (`back`, `cancelLead`, `fineLine`,
`requestsLine` — người dùng duy nhất là trang cũ), JSDoc khối ấy viết lại; chữ mới của trang nằm
trong khối `bookingDetail`.

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **5347** (web 1792, admin 1718, api 1068, contract 656, core 46, ui 27, i18n 22 và tokens 18), jest mobile 159 và mobile-ui 86, int **753 ở 46 file** (DB riêng `tourism_test_p7b`). Ca mới 126: web 122 (`booking-journey` 21, `booking-ticket` 18, `get-ready` 17, `booking-details-panel` 14, `booking-detail-view` 10, `trip-journey` 7, `get-ready-panel` 7, `trip-closed-panel` 7, `review-panel` 7, `prep-checklist` 5, `tours` 4, `on-tour-panel` 4, `awaiting-payment-panel` 1) và i18n 4.
Đột biến: 54 lượt, 47 giết. Bảy cái sống, kèm lý do: bỏ nhánh cờ server ở mốc hạn huỷ (cờ và
ngày trùng nhau theo thiết kế); `calendarDateParts` đọc thứ theo giờ máy (máy +7 và CI UTC đều
không lộ); bỏ `paid &&` ở điều kiện mã vạch (PENDING vốn không thuộc `ACTIVE_BOOKING_STATUSES`,
PAID thiếu `paidAt` không xảy ra); bỏ `round2` ở vị trí Today (fixture ra số chẵn); `PrepChecklist`
đọc storage trong `useState` (jsdom không có hydrate); hàng đáy truyền nguyên `view` (đột biến
tương đương — `BookingActions` ở đáy chỉ hiện khi `actions` có `cancelBooking`, mà luật
`bookingView` chỉ cho nó đứng một mình); `tour?.meetingPoint` thô thay `tourMeetingPoint` (ca ô
trống có ở B2). Hai đột biến khác lúc đầu sống, đã giết sau khi siết test như trên.

## 2026-10-09 — Thử tay Saved và Settings trên production, 8/8 bước; nút Settings của hộ chiếu bỏ "⚙" (`1b27c8d4`, nhánh `fix/passport-settings-label`)

**Thử tay production** sau merge `a0102b9c` (CI `gate` xanh 13 phút, Vercel web và admin READY; Render không
deploy vì lượt push chỉ đổi web và docs). User làm trên Edge máy bàn và DevTools 375px, tài khoản admin, từng
bước một: bước 1–8 đạt.

- Saved máy bàn: ảnh thật, lưới 3 cột, tim ở góc phải trên ảnh, "SAVED 9 OCT", "4 TOURS", nút tròn quay lại.
- Saved 375px: một cột, tim luôn hiện, trang không cuộn ngang.
- Bỏ lưu: thẻ rời ngay, số ở hero giảm theo; về "0 TOURS" thì hiện trạng thái trống khung viền đứt.
- Bỏ lưu khi DevTools đặt Offline: thẻ quay về đúng chỗ cũ, toast "Couldn't remove this tour", hero giữ "2 TOURS".
- Settings máy bàn: hai cột, thẻ danh tính dính khi cuộn, Connected accounts nằm trong thẻ, nút "Upload avatar"
  chỉ chữ.
- Sửa tại dòng: Phone lưu được; Phone và Password mở cùng lúc, mỗi thẻ một dòng.
- Danger zone: hộp xác nhận đủ chữ và hai ô, nút xoá khoá; bấm Cancel, không xoá.
- Settings 375px: một cột, thẻ danh tính lên đầu, mỗi dòng hai hàng, không cuộn ngang.

**Góp ý khi thử:** nút "Settings" trong khung hộ chiếu (`/account`) còn ký tự "⚙" viết thẳng trong chuỗi
`passportHome.settingsLink`, lệch ba nút chỉ chữ cạnh nó — bỏ ở `1b27c8d4`, kèm ca test khoá bốn nhãn. Lượt góp ý
trước session gốc hiểu nhầm đó là icon của nút "Upload avatar" và đã bỏ icon ở nút này (`b58da161`); user vẫn giữ
thay đổi ấy. Thêm vào `open-items`: G30 (số điện thoại chỉ lưu, không xác minh OTP — giới hạn đã biết) và G31
(trình quản lý mật khẩu của Edge điền email vào ô gõ DELETE của hộp xoá tài khoản, có từ trước).

**CÒN TREO:** không. Không migration, không env, không webhook.

Tests after (`gate:int` trên `1b27c8d4`, 09/10 15:27–15:34): unit 6196 — admin 1911, web 1764, api 1094,
contract 665, mobile 502, mobile-ui 134, core 46, ui 36, i18n 25, tokens 19 — và int 778/46.

## 2026-10-09 — Saved và Settings của khách thiết kế lại (nhánh `feat/account-saved-settings`)

**Bối cảnh:** user nhắc hai trang `/account/saved` và `/account/settings` còn link chữ "← Passport" và bố cục
cũ (09/10). Chỉ đổi giao diện, giữ nguyên chức năng và API. Wireframe ba phương án mỗi trang, lấy mẫu từ ReUI,
shadcn/studio, Shadcn UI Kit, shadcnspace và ui.shadcn.com; user chọn **Settings C** và **Saved A**. Spec cùng bản
ghi wireframe `f9ac258e`, plan 7 task `76bc9e99`.

- **Saved:** lưới thẻ ảnh 1/2/3 cột. Tim nổi trên ảnh, luôn hiện, là nút hành động "Remove {tour} from saved
  tours". Dòng "Saved {ngày}" theo lịch Việt Nam, ẩn sao khi tour chưa có đánh giá. Tour không còn bán: ảnh xám,
  nhãn "No longer available", không giá. Bỏ lưu xong thì số ở hero cập nhật (`router.refresh()`), bỏ bằng bàn
  phím thì focus sang tim kế tiếp. Trạng thái trống mới, nút tròn quay lại trong hero.
- **Settings:** từ `lg` hai cột. Bên trái là thẻ danh tính dính khi cuộn: ảnh 96px, tên, email, nút "Upload
  avatar" chỉ chữ, Connected accounts. Bên phải là thẻ Personal information, thẻ Password và khối Danger zone.
  Dưới `lg` một cột, thẻ danh tính lên đầu. Nút tròn quay lại trong hero; gỡ các khoá chữ mồ côi.

**Review:** hai lượt gộp (Saved; Settings). Saved có 5 mục nhỏ: tim vừa `aria-pressed` vừa nhãn hành động,
focus rơi về `body` khi bỏ bằng bàn phím, hai test chưa phân biệt, `refresh` nằm trong `try`. Settings có 1 mục
quan trọng (email dài làm trang 320px cuộn ngang 74px) và 3 mục nhỏ (hai điểm dừng "Upload avatar", test nút xoá
chưa đủ, tiêu đề rỗng khi tên trống). Vá hết ở `ea5bf637` và `8b543f90`. Phát hiện thêm: câu lỗi tải ảnh mang
tên tệp dài làm tràn 240px, vá `0fba5fd4`.

**Duyệt bằng mắt:** session gốc dựng hai trang thật trên dev, chụp 375 và 1280 cả sáng lẫn tối, đặt cạnh
wireframe; user xác nhận 09/10 và bỏ icon ở nút "Upload avatar" (`b58da161`). Thi công bằng agent sonnet theo
plan có mã đầy đủ đã chạy thử trước.

**CÒN TREO:** thử tay production từng bước sau deploy. Không migration, không env, không webhook.

Tests after (`gate:int` trên `7edf43d0`, bản trước khi rebase; rebase chỉ mang thêm hai commit docs, 09/10
14:27–14:35): unit 6195 — admin 1911, web 1764, api 1094, contract 665, mobile 502, mobile-ui 134, core 46,
ui 36, i18n 24, tokens 19 — và int 778/46.


## 2026-10-09 — Đính chính rủi ro proxy Google sau merge P5b-4; duyệt ADR-0056 đăng nhập Google native

**Đính chính entry merge ngay bên dưới.** Câu "Production hiện thiếu cặp env Google nên proxy
chặn hết" sai: user xác nhận 09/10 Render có `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`, và
cùng ngày đã thêm `nexora://` vào `TRUSTED_ORIGINS`. Hai điều kiện cùng có nên chuỗi chiếm phiên
qua proxy và deep link đang khai thác được (cần link lừa và app độc mang scheme `nexora`). Mục
CÒN TREO "thêm `nexora://`" của entry đó đã xong.

**Hướng vá, chưa thi công:** [ADR-0056](../adr/0056-mobile-google-native-signin.md) (user duyệt) và
[spec](../specs/2026-10-09-mobile-google-native-signin-design.md). App lấy ID token bằng
`@react-native-google-signin/google-signin` rồi đổi lấy phiên ở `POST /sign-in/social`;
proxy đóng ở mọi môi trường; thêm dev build EAS cho Android vì Expo Go không nạp được module
native. Ghi chú vào ADR-0017 §11 và AMEND 6 của ADR-0040. User chốt demo bằng APK Android;
câu tài khoản Apple Developer còn mở, tới khi có thì iOS không có Google.

**Deploy web 09/10.** Bản production của `39967db0` đỏ: prerender
`/blog/two-days-among-the-karsts` nhận HTTP 500 từ API sáu lượt. Bản preview cùng commit lúc
02:39 UTC, trước khi push main, cũng nhận 500 ở review của năm tour, nên lỗi không do code merge.
Redeploy lúc 03:06 UTC xanh và đã gắn `www.nexora-travel.agency`. Nguyên nhân 500 chưa xác nhận,
ghi ở open-items.

Chỉ đổi docs, không có test mới.

## 2026-10-09 — Merge P5b-4 màn tài khoản mobile lên main (`3ec947d6`)

Nội dung và các vòng review của nhánh đã kể ở entry ngay bên dưới; entry này ghi sự kiện merge
và lượt review cuối 09/10 chạy trên session cloud. Nhánh mang theo phần chung với
`feat/mobile-browse-screens` (T0, nối auth thật, T1–T7 của P5b-2), nên màn xem tour vào main
cùng lượt này. Ba commit riêng của nhánh browse (tìm không dấu, D6 return-to, một commit thử)
không đi theo — ghi ở open-items.

Nhánh rebase lên `7a6e36b1` (main có thêm bản vá dòng đếm My bookings). Một xung đột ở
CHANGELOG: entry T0 của nhánh và entry mới của main cùng chen vào đầu file; gỡ theo nếp F18,
entry nhánh lên trên, cả hai giữ nguyên văn. 83 commit còn lại áp sạch. Hash trong
[tóm tắt nhánh](../reviews/2026-10-06-branch-summary-mobile-account-screens.md) là hash trước
lần rebase này; ba bản sửa B1–B3 trên main là `cbbb7ea8`, `a7e8dbaf`, `169090ba`.

**Review cuối 09/10.** B1–B3 sửa đúng: B1 miễn đúng chuỗi `nexora://`, `exp://` vẫn bị chặn ở
production; B2 chỉ cho proxy chuyển tới URL Google đúng `client_id` và callback của mình;
ADR-0055 không trùng số. Của 24 phát hiện review 05/10, L4 mới sửa nửa (nút gỡ của Chip); phần
nút xoá ô tìm ở Explore vá lúc merge (`3ec947d6`): `clearLabel` của SearchField thành bắt buộc,
nhãn lấy từ `messages.mobile.explore.clearSearch`, kèm test đỏ trước khi sửa. Sau commit đó câu
"sửa hết trừ Q4" ở entry nhánh mới đúng. Còn mở: N7–N10 mức thấp, và chưa thử máy thật (F2
trên Android; F3, F7 trên iOS).

**Rủi ro còn lại của B2 rộng hơn login CSRF ghi ở ADR-0017 §11.** Sau callback OAuth, plugin
`expo()` (`@better-auth/expo` 1.6.23, `dist/index.js:81`) gắn cookie phiên vào deep link
`nexora://` khi đích là origin tin cậy không phải http. Cộng với `state` do người gọi chọn, một
app khác đăng ký scheme `nexora` trên máy nạn nhân có thể nhận phiên của nạn nhân. Production
hiện thiếu cặp env Google nên proxy chặn hết; giữ nguyên như vậy tới khi đổi cơ chế state.

**CÒN TREO cho session gốc (luật 15):**

- [ ] Render: thêm `nexora://` vào `TRUSTED_ORIGINS` — chưa làm, chờ user duyệt. Không thêm
  `exp://`. Chưa thêm thì app bản build bị 403 khi gọi auth; web không ảnh hưởng.
- [ ] KHÔNG đặt `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` trên Render chỉ để app đăng nhập
  Google (thay mục tương ứng ở entry nhánh) — xem rủi ro ngay trên.
- [ ] Nhánh `feat/mobile-booking-screens` và `feat/mobile-review-screens` xếp chồng lên nhánh
  này: chủ nhánh rebase lên main trước vòng review tiếp.

Tests after: unit 6137 — admin 1911, web 1707, api 1094, contract 665, mobile 502, mobile-ui 134,
core 46, ui 36, i18n 23, tokens 19 — và int 778/778 ở 46 file trên Postgres giờ UTC (ở máy thi
công 5 test đỏ là `check-rls` cần Docker và `pending-sweep` dính bug múi giờ đã ghi ở
open-items). Cây đã rebase chạy lại đủ các bước của CI: RLS, build web với API sống, bundle
mobile, admin prerender, lint, tokens-only, docs-freshness.

## 2026-10-08 — P5b-4 màn tài khoản mobile: Saved, Account, Travel stories, vá review 05/10 (nhánh `feat/mobile-account-screens`)

Nhánh dựng đủ 14 khung theo [spec P5b-4](../plans/2026-09-25-mobile-account-screens.md):
Saved S1–S3, Account A1–A7 (sửa tên, ảnh đại diện, đổi mật khẩu, xoá tài
khoản nối `DELETE /api/account`), Travel stories G1–G4, cùng hạ tầng
return-to sau đăng nhập. Tình trạng chi tiết, hash từng bản sửa và kịch bản
thử máy thật ở [tóm tắt nhánh](../reviews/2026-10-06-branch-summary-mobile-account-screens.md).
Hash entry này ghi khi merge — nhánh đã rebase 08/10 nên hash trước đó không
còn dùng được.

Phía API (hai AMEND ở [ADR-0017](../adr/0017-web-session-better-auth.md)):
§10 cho `nexora://` đứng trong `TRUSTED_ORIGINS` ở production (B1); §11 khoá
`/api/auth/expo-authorization-proxy` chỉ nhận URL đăng nhập Google của chính
mình, hết open redirect (B2). ADR tầng dữ liệu mobile đổi số 0047 → 0055 vì
`main` đã dùng 0047 (B3).

**Review findings:** review 05/10 có 24 phát hiện (B1–B3, F1–F12, L1–L5,
Q1–Q4) — sửa hết trừ Q4 (ADR ra sau code, nợ lịch sử không sửa được). Đợt
rà 07/10 thêm N1–N10: N1–N6 đã sửa, N7–N10 mức thấp còn mở.

Tests after (08/10, sau rebase): api 1094, admin 1911, web 1707, mobile 501,
mobile-ui 134, contract 665 — xanh hết; typecheck và Biome sạch;
`test:int` 773/778, 5 đỏ là môi trường máy (`check-rls` cần Docker,
`pending-sweep` lỗi cũ từ 26/09).

**CÒN TREO cho session gốc (luật 15 — làm SAU review, nhánh thi công không tự làm):**

- [ ] Render: thêm `nexora://` vào `TRUSTED_ORIGINS` khi deploy bản có B1.
  Không thêm `exp://` (chỉ dùng cho Expo Go ở máy dev).
- [ ] Đăng nhập Google từ app (qua proxy đã khoá ở B2) cần `GOOGLE_CLIENT_ID`
  và `GOOGLE_CLIENT_SECRET` trên Render — thiếu thì proxy chặn hết; kiểm sau deploy.
- Không migration mới, không webhook, không đổi Cloudinary.

Việc của nhánh chưa xong: thử máy thật Android và iOS; D2 (gán tour cho bài
viết để G4 có dữ liệu); cập nhật `open-items` mục return-to (đã sửa) và thêm
rủi ro login CSRF còn lại của B2.
