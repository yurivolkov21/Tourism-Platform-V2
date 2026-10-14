# CHANGELOG — lưu trữ: admin catalog đợt đầu: chuyến khởi hành, danh mục, điểm đến (22/09–24/09/2026)

P4e-1 danh sách tour và lịch chạy, nút công ty huỷ chuyến có hoàn tiền; P4e-2
danh mục và điểm đến; F16 giai đoạn chuyến suy từ ngày.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 14/10/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`, và
link tới tài liệu dời thư mục cùng ngày 14/10 trỏ sang chỗ mới. Đừng
mở-rồi-save bằng editor có markdownlint: nó đổi `+` đầu dòng thành `-` và nói
sai con số test đã ghi.

## 2026-09-24 — Thử tay F15 trên production (`b39e6df3`): 6/6 bước đạt; ba góp ý giao diện vá trên nhánh `fix/f15-thu-tay-gop-y`

Chạy khi cả ba nơi đã lên bản `b39e6df3`: admin và web trên Vercel (READY), API
trên Render khởi động lại lúc 08:23 UTC, sau giờ push. Sáu bước, mỗi bước chờ
người thử xác nhận; mọi lệnh ghi đối chiếu thẳng với DB production bằng SQL chỉ
đọc, mọi hệ quả phía khách đo bằng `curl` trên trang thật.

Điểm đến thử chọn bằng một câu SQL chỉ đọc: **Quy Nhơn** — Central Vietnam, đúng
một tour đang bán (`quy-nhon-coastal-3d`, điểm chính), nên mỗi lệnh ghi chạm ít
khách nhất mà vẫn đủ để thấy hệ quả trên trang vùng.

1. **Ẩn.** Hộp Hide nói đúng từng câu của bản vá review F15: hai câu về trang
   Central Vietnam (bản của vùng Miền Trung, kết bằng "day-trip section"), ba câu
   về số đếm, hộ chiếu, journal; câu trấn an màu trung tính. Toast đúng. DB
   `is_active = false`, liên kết tour còn nguyên, tour vẫn đang bán. Phía khách:
   Quy Nhơn rời trang Central Vietnam, `/about` và bộ lọc `/tours`; tour của nó rời
   trang Central Vietnam (điểm dừng duy nhất ở vùng ấy) nhưng `/tours` vẫn đủ 29 tour
   và trang tour vẫn in "Based in Quy Nhơn" kèm link lọc.
2. **Web khi đang ẩn.** `/tours?destinations=quy-nhon` còn 1/29 tour; chip ghi TÊN
   "Quy Nhơn" chứ không in slug; trong Filters, Quy Nhơn có mặt ở cuối danh sách và
   đang được tích nên bỏ tích được — đúng hai lỗ mà Task 9a của F15 vá.
3. **Hiện lại.** Hộp Show và toast đúng; DB `is_active = true`; Quy Nhơn và tour
   của nó về lại trang Central Vietnam, `/tours`, `/about`.
4. **Đổi vùng sang Southern Vietnam.** Hộp Edit không có ô slug, ô vùng là danh
   sách chọn ba mục. DB đổi đúng cột `region`, tên/quốc gia/mô tả giữ nguyên. Trang
   Central Vietnam mất Quy Nhơn và tour của nó; trang Southern Vietnam có cả hai.
5. **Trả về Central Vietnam.** DB và hai trang vùng về như cũ.

**Cuối lượt DB khớp trạng thái gốc:** Quy Nhơn `Central Vietnam`, đang hiện, tên,
quốc gia, mô tả và liên kết tour không đổi. Trang `/destinations` không liệt kê
Quy Nhơn ở mọi thời điểm — trang ấy chỉ bày các điểm nổi bật (Vũng Tàu, Đà Lạt
cũng vắng), không phải hệ quả của lượt thử.

6. **Tạo với slug đã có** (bước bổ sung, sau khi user hỏi phần tạo mới). Gõ tên
   "Hội An", ô slug tự điền `hoi-an` — slug đã có — rồi bấm Add: server trả
   `SLUG_TAKEN`, câu "Another destination already uses this slug…" hiện ở cuối
   hộp, hộp giữ nguyên chữ đã gõ. DB vẫn 18 điểm đến, vẫn một `hoi-an`.

**Không chạy trên production: nhánh tạo thành công.** Nó để lại một hàng không xoá
được (F15 cố ý không có nút xoá, SQL trên prod chỉ đọc); int test đã canh nhánh ấy
(`admin-destinations.int.spec.ts`, kể cả hai lượt tạo cùng slug bắn cùng lúc).

**Ba góp ý của user trong lượt thử, vá cùng ngày trên nhánh `fix/f15-thu-tay-gop-y`:**

- **Cột tên của bảng Destinations rộng gần 900px** (`6e934329`). Khối `truncate`
  không có trần bề rộng, nên trong bảng tự giãn nó không cắt được gì. Rút thành
  kit `NameDescriptionCell`: trần `max-w-md` (khoảng nửa bề rộng cũ, theo góp ý),
  mô tả gói hai dòng, `title` giữ nguyên văn. Bảng Categories là bản chép y hệt,
  cùng lỗi, nên dùng chung.
- **Ô chọn vùng là `<select>` gốc, trông thô** (`6e934329`). Thay bằng kit
  `FormSelect` bọc `Select` của @tourism/ui — cùng dáng dropdown với thanh công cụ
  và phân trang. `inputClassName` hết người dùng nên thôi export. Plan F17 sửa theo:
  mọi ô chọn của khu làm việc tour là `FormSelect` (commit docs này).
- **Gỡ thành viên đã rút khỏi nhóm** (`22f245f1`). Trang About còn ba người, lưới
  ba cột, thôi đọc khe ảnh `about-team-ops`; câu trích dẫn ở `/verify-email` chuyển
  sang Giang Tử Dương, co-founder (user chọn).

**Review findings:** lượt thử không tìm ra lỗi chức năng nào; ba mục trên là góp ý
giao diện. Đột biến của hai mảnh kit mới: 7 cái, 6 chết; cái còn lại (đổi chuỗi
rỗng thành `null` trước khi đưa xuống Base UI) tương đương vì Base UI 1.6 vốn coi
`''` là chưa chọn, nên đoạn ấy đã bị bỏ.

**CÒN TREO:** seed vẫn tạo khe ảnh `about-team-ops` (ảnh robot giữ chỗ, không ai
đọc) — dọn ở lượt seed lại ~03/11 nếu muốn gọn.

Tests after: Vitest **4191** (tokens 18, i18n 16, ui 22, contract 419, core 46, api 985, admin 1112, web 1573), int **626 ở 44 file**. Tám ca mới đều ở kit admin (`FormSelect` 6, `NameDescriptionCell` 2).

## 2026-09-24 — Merge F15 lên main (`387824d0`)

Nội dung đã kể ở HAI entry ngay bên dưới — "Vòng review F15" và "F15 quản trị
điểm đến". Entry này chỉ ghi sự kiện merge, vì hai entry kia viết TRƯỚC merge
nên chưa mang hash.

Nhánh `feat/p4e-2-destinations` đã nằm sẵn trên đỉnh `main` (`310d6e9d`, commit
prompt bàn giao), nên fast-forward thẳng, không cần rebase: 10 commit — sáu
của session thi công, bốn của vòng review. Gate đầy đủ đã chạy xanh trên chính
đỉnh ấy. Cùng lượt đẩy có ADR-0047 và spec F17 (P4e-3a tạo và sửa tour), chỉ là
tài liệu. Không migration, không đổi env, nên không có bước hạ tầng nào.

Việc còn lại: thử tay trên production sau khi Vercel và Render deploy xong
(plan P4e-2, mục Nghiệm thu cuối: ẩn rồi hiện một điểm đến, đổi vùng của một
điểm đến và xem nó nhảy sang trang vùng khác).

Tests after: Vitest **4183** (web 1573, admin 1104, api 985, contract 419,
core 46, ui 22, tokens 18, i18n 16), int **626 ở 44 file**, jest mobile 159 và
mobile-ui 86.

## 2026-09-24 — Vòng review F15: 28 mục, vá 25, ba mục để lại có lý do (nhánh `feat/p4e-2-destinations`)

Review chạy ở session gốc, mức cao nhất: mười góc tìm độc lập, mỗi ứng viên một
agent kiểm chứng, cộng một lượt quét sót. 28 ứng viên sau lọc trùng, 27 xác nhận
và 1 bị bác (hai kiểu `CategoryOption`/`DestinationOption` trùng hình dạng là có
chủ đích). Lượt quét thêm 1 mục khả nghi: mất focus bàn phím sau khi hộp thoại
đóng — đọc ra từ mã nguồn Base UI, chưa tái hiện trên trình duyệt.

**URL gõ tay làm sập `/tours`.** Ba đường: `?durations=__proto__` (nhãn chip tra
bảng i18n ra Object.prototype, React ném ngay lần render đầu — có từ trước),
`?destinations=__proto__` (phần bù của Task 9a đưa slug ấy vào bộ đếm facet —
mới ở nhánh), và một khoá lặp lại (Next 16 trả mảng, `parseList` gọi `.split`).
Vá ở biên: `listParam`/`singleParam` chuẩn hoá tham số cho `/tours` lẫn
`/blog`; bảng nhãn tra bằng `ownLabel` (`Object.hasOwn`), bộ đếm là object không
prototype, sort cũng thôi dùng `in`.

**Id ô tích trùng giữa hai facet.** `facet-<slug>` không kèm tên facet: danh mục
`cruise` có sẵn trong seed, nên `/tours?destinations=cruise` — hoặc một điểm đến
admin tạo trùng slug danh mục — làm bấm dòng điểm đến bật ô DANH MỤC. Id nay là
`facet-<facet>-<slug>`.

**Bốn câu của hộp Hide/Show nói sai hoặc thiếu.** (1) Câu về chuyến riêng của
vùng hứa ba con số cho cả ba vùng, trong khi miền Bắc chỉ có khu "How long have
you got", miền Trung chỉ có khu chuyến một ngày, miền Nam chỉ có ô "Longest
trip" — nay mỗi vùng một câu. (2) Hộp Show chép câu của danh mục "tours do not
change", sai với điểm đến. (3) Câu hộ chiếu bỏ sót khách có chuyến SẮP đi. (4)
Điểm đến chưa có vùng vẫn bị nói "rời các trang điểm đến". Thêm dòng con số
(About và `/tours` đếm điểm đến đang hiện).

**Đính chính entry F15 ngay dưới.** Câu "Hộp xác nhận Hide nói đủ các điều ấy"
sai ở About và dòng "across n destinations" — dòng con số mới là phần còn
thiếu. Còn câu G4 cũ "hộp xác nhận nói thẳng cả hai" về link blog là một bộ lọc
vô hình mà hộp không hề nhắc tới: phía web nay vá hẳn (blog giữ chip cho mọi slug
đang lọc, tên tra ở cả hai trục), nên G4 đóng.

**Web lệch dữ liệu khi ẩn điểm đến.** Hộ chiếu đếm "places visited" theo booking
mà chia cho số điểm đến đang hiện — ẩn một nơi có thể ra 105%; nay chỉ đếm điểm
đến đang hiện. Hộ chiếu cũng thôi giữ bảng tên vùng chép tay (khớp đúng từng
chữ, trượt khi DB ghi `north`), gọi `findRegion` của contract như ADR-0045 đã
chốt. Điểm đến ẩn không còn tour đang bán nào thì chip in slug viết thành chữ
("Phong Nha") thay vì slug máy, ở cả nhánh endpoint hỏng.

**API.** `errors` của oRPC là Proxy dựng lỗi cho MỌI mã, nên nhánh "mã procedure
không khai thì trả nguyên lỗi" của `toContractError` — và của `mapError` phía
chuyến — chưa từng chạy; spec cũ xanh vì dùng object giả. `declaredError` kiểm
bằng `Object.hasOwn`, spec ghim bằng bảng lỗi thật của oRPC. Sửa hay ẩn/hiện
điểm đến nay bust thêm `tour:<slug>` của mọi tour gắn nó (đóng G5). Lệnh tạo
thôi đếm tour cho hàng vừa tạo.

**Admin.** Nút mở hộp thoại khoá bằng `aria-disabled` (`focusableWhenDisabled`)
trong lúc bảng làm mới, để Base UI trả focus về được — điểm đến, danh mục, nút
Add của màn chuyến; năm màn khác cùng khuôn ghi thành G6. Câu "quá dài" nói
đúng biên ("N characters or fewer"). `<select>` vùng mặc bộ class export từ
`Input` của kit thay vì chép chuỗi.

**Test xanh giả, đã sửa:** ca điền sẵn quốc gia tự cấp "Vietnam" qua fixture;
ca "toast đọc từ response" có mock phản chiếu đúng request (cả danh mục); ca
int "link lọc vẫn chạy" chỉ có một tour nên không phân biệt được bỏ lọc; ca
`tourCount` "cùng câu ghi" đổi tên theo đúng điều nó chứng minh. Thêm ca biên
độ dài cho slug, tên, quốc gia.

**Ba mục để lại, có lý do.** Endpoint điểm đến hỏng đúng lúc làm mới thì thẻ
facet suy từ tour và một điểm đến đã ẩn hiện lại tới lượt render kế — thẻ tour
không mang cờ ẩn, vá tận gốc phải thêm field vào contract công khai cho một ca
chỉ xảy ra khi API trục trặc; ghi ở `resolveFacetOptions` và spec §4.6. Bản đồ
tên dựng lại mỗi lần bấm chip điểm đến: khoảng 50 tour, không đáng tối ưu. Hai
hàm copy trùng danh mục tự hết trùng khi hộp điểm đến đổi theo vùng.

Ba mươi đột biến, cả ba mươi bị test bắt (web 14, api 4, admin 12).

Tests after: Vitest **4183** (web 1573, admin 1104, api 985, contract 419,
core 46, ui 22, tokens 18, i18n 16), int **626 ở 44 file**, jest mobile 159 và
mobile-ui 86.

## 2026-09-24 — F15 quản trị điểm đến, và web chịu được điểm đến đã ẩn (nhánh `feat/p4e-2-destinations`)

Vùng thứ ba của P4e, bản song sinh của F14: `/destinations` trong back office
(tạo, sửa, ẩn/hiện — không xoá), ba vùng miền dời về `@tourism/contract`, và
trang `/tours` của khách thôi in slug thô cho một điểm đến vừa bị ẩn. Sáu
commit, mỗi task một commit, thi công ở một session riêng theo đúng 21 bài học
mà vòng review F14 để lại ở đầu phần F15 của plan.

**Ba vùng là từ vựng của contract (ADR-0045).** `REGIONS`, `RegionNameSchema`
(cổng GHI: đúng ba tên) và `findRegion` (cổng ĐỌC: nhận cả tên lẫn khoá ngắn,
không phân biệt hoa-thường). `regionOf` của web gọi sang `findRegion` thay vì
giữ bản luật riêng — admin chọn sẵn ô vùng của form sửa bằng CHÍNH hàm ấy, nên
bảng admin và trang vùng không thể đọc cùng một hàng ra hai vùng khác nhau.
`mocks/regions.ts` chỉ còn tái xuất khẩu; `region-static-params.spec.ts` ghim
`generateStaticParams` trả đủ ba slug, và ghim web dùng CHÍNH mảng của contract.

**Đo trước, viết câu sau.** Bài học 10 bắt đo từng chỗ đọc `fetchDestinations`
trước khi viết câu cảnh báo của nút Hide. Đo được 7 lời gọi ở 7 trang, tỏa ra
14 hệ quả — bảng ở spec §4.6. Bản spec đầu chỉ kể ba (trang vùng, tile,
facet); bảng đo thêm trang chủ, About, blog, hộ chiếu của khách, và một hệ quả
không ai đoán ra: tour có điểm đến ấy là điểm DUY NHẤT trong vùng thì rời lưới
tour của trang vùng. Hộp xác nhận Hide nói đủ các điều ấy, rồi trấn an bằng
câu giọng trung tính: tour vẫn bán, vẫn in điểm đến trên lộ trình, link cũ vẫn
lọc được.

**Web chịu được điểm đến đã ẩn (Task 9a).** Đúng cái lỗ danh mục vừa vá:
`resolveCategoryOptions` tổng quát thành `resolveFacetOptions`, thêm
`resolveDestinationOptions` (tên tra từ MỌI điểm dừng của tour). Trang listing
truyền `null` khi endpoint hỏng thay vì `[]` — nhánh cũ vừa xoá sạch thẻ
Destination vừa in "across 0 destinations" lên hero.

**Màn quản trị.** Ô vùng là `<select>` gốc ba mục đọc thẳng `REGIONS`; form
sửa chọn sẵn tên CHUẨN, nên một hàng lưu kiểu cũ lưu lại là đúng tên; cột
Region báo "No region" khi chuỗi trong DB không khớp vùng nào — ca mà ADR-0045
mô tả là "biến khỏi mọi trang vùng mà không có lỗi nào ở đâu cả". Ô slug điền
sẵn bằng `slugifyVietnamese(name, 80)`, vắng ở form sửa, tắt soát chính tả.
Nút Hide/Show giữ chỗ bằng `StableLabel`.

**Rút chung ở bản thứ ba** (bài học 4, 6, 7, 11, 20):

- `SLUG_PATTERN` + `slugSchema(max)` về `slug.ts`, `descriptionSchema(max)`
  (rỗng thành `null`) về `common.ts` — danh mục đổi sang dùng, câu lỗi giữ
  nguyên.
- `ContractError` + `toContractError` ở `apps/api/src/lib/contract-error.ts`:
  lỗi mang mã, N nhánh `instanceof` gập thành một, vẫn nhận diện bằng
  `instanceof`. Danh mục chuyển sang dùng, 26 ca int cũ vẫn xanh.
- `hasFormErrors` về `apps/admin/src/lib/form-errors.ts`, danh mục đổi sang
  dùng.
- Hide/Show/Visible/Hidden, câu lỗi slug và câu gợi ý slug thành hằng ở đầu
  `messages.ts`; hai bảng đọc cùng hằng.

Bản của departures (`mapError`, `hasFormErrors`) GIỮ NGUYÊN, có chủ đích:
code departures của F16 nằm ngoài phạm vi F15. Nợ G3 vì thế mới đóng hai trên
ba bản.

**Lệch plan, đã ghi tại bước của plan:** luật so khớp vùng dời về contract
cùng ba vùng (plan chỉ kể ba giá trị và schema); `MockRegion`/`MockRegionKey`
thành bí danh của kiểu contract; mặc định `country: 'Vietnam'` chỉ ở lệnh tạo
(lệnh sửa bắt buộc gửi, không lặng lẽ ghi đè); schema HÀNG để `slug` và
`region` lỏng (output chặt thì một hàng kiểu cũ làm cả bảng sập 500); ca ghim
`generateStaticParams` XANH từ trước khi dời — cái đỏ ở web là ca so tham chiếu.

**Test xanh giả bắt được trong lúc làm:** lượt chạy đỏ của int spec lộ ba ca
xanh sẵn khi route chưa tồn tại (route lạ cũng trả 404 kèm `NOT_FOUND`), nên hai
ca 404 nay khớp câu của contract; seed int đặt tên sắp ngược slug để ca "sắp
theo tên" phân biệt được; ca "hai bảng báo cùng một câu lỗi slug" chỉ so câu
đầu nên để lọt một luật gắn thêm — nay so cả danh sách; ca component của web ban
đầu không canh số tour trên ô được bù.

**Không có việc hạ tầng.** Không migration (bảng `destinations` đã đủ cột),
không env mới, không webhook.

CÒN TREO cho session review:

- Merge (rebase + ff), CI (luật 14), rồi thử tay trên production mỗi lượt một
  bước: đổi vùng của một điểm đến và xem nó nhảy sang trang vùng khác; ẩn một
  điểm đến rồi mở `/tours?destinations=<slug>` (chip in tên, ô đang tích bỏ
  được); bật lại. Nhớ lượt seed lại prod khoảng 03/11 xoá mọi dữ liệu tạo tay.
- Hai hệ quả của nút Hide chưa vá, chỉ nói trong hộp xác nhận: `/blog` chuyển
  tag trùng slug từ trục Places sang Topics (link `?place=<slug>` vẫn lọc nhưng
  hết ô để bỏ), và hộ chiếu của khách mất mục điểm đến đã ẩn khỏi sổ hành trình.
- Đổi TÊN một điểm đến bust tag `tours` nhưng không bust `tour:<slug>` của các
  tour gắn nó: trang chi tiết tour giữ tên cũ tới hết lượt ISR 300 giây.

**Review findings:** chưa chạy vòng review riêng cho F15.

Tests after: Vitest **4152** (web 1552, api 983, admin 1096, contract 419,
core 46, ui 22, tokens 18, i18n 16), int **625 ở 44 file**, jest mobile 159.
Thêm 108 ca Vitest (contract 43, admin 49, web 11, api 5) và 20 ca int. Đột
biến: mười ở Task 6, mười hai ở Task 7, mười lăm ở Task 8, mười ở Task 9a, hai
mươi hai ở Task 9 — cả 69 đều bị giết.

## 2026-09-23 — Thử tay F16 trên production (`d5b519a5`): 7/7 bước đạt, không phải vá

Chạy khi cả hai nơi đã deploy xong: admin trên Vercel, API mới trên Render khởi
động lúc 13:02 UTC. Connector Render đòi chọn workspace, nên mốc Render đo bằng
`uptimeSec` của `/api/health`. Bảy bước, mỗi bước chờ người thử xác nhận; mỗi
lệnh ghi đều đối chiếu thẳng với DB production. Phủ đủ các ý của spec §6.

Hai tour thử chọn bằng một câu SQL chỉ đọc, tính giai đoạn ngay trên DB:
`central-honeymoon-5d` có đủ ba giai đoạn chính (3 chuyến sắp đi, 1 chuyến đang
chạy 22/09 → 26/09, 5 chuyến đã về); `ha-giang-loop-4d` có một chuyến quá hạn
chót mà chưa đi (khởi hành 24/09) và hai chuyến đã huỷ.

1. **Huy hiệu và nút.** Chuyến đang chạy ghi *Departed*, chỉ còn Edit, và nút
   ấy thẳng cột với Edit của mọi hàng. Chuyến sắp đi ghi *Bookable* đủ ba nút,
   chuyến đã về ghi *Completed*.
2. **Tab lọc.** Upcoming 3, Departed 1, Completed 5, Cancelled rỗng kèm câu báo.
   URL mang `?phase=…`; về All thì tham số biến mất.
3. **Quá hạn chót mà chưa đi.** Chuyến 24/09 ghi *Deadline passed* (hạn 17/09
   "Passed") và vẫn còn Close, vì có thể còn khách đang trả tiền dở. Hai chuyến
   đã huỷ ghi *Cancelled*, không có nút nào.
4. **Đóng** chuyến 25/12 (0 booking): toast câu mới, hàng ghi *Closed* kèm
   Reopen bấm được, vẫn nằm ở tab Upcoming. DB `CLOSED`.
5. **Mở lại:** thân hộp xác nhận và toast đều là câu mới, hàng về *Bookable*.
   DB `OPEN`.
6. **Tắt đăng tour.** Không tour nào đang ẩn, nên tạm tắt Hà Giang Loop như spec
   §6 cho phép. Trang Tours ghi 3 kèm "Hidden while off sale".
7. **Dòng báo tour chưa đăng.** Màn chuyến hiện khung "This tour is off sale",
   bảng giữ nguyên. Bật đăng lại thì khung biến mất.

**Cuối lượt DB khớp trạng thái gốc.** Tour `is_published = true` (tắt khoảng
hai phút rưỡi, 13:17 → 13:20 UTC), chuyến 25/12 về `OPEN`, tám chuyến còn lại
không đổi từ lượt seed 18/09. Trang khách `/tours/ha-giang-loop-4d` trả 200 kèm
tên tour ngay sau khi bật lại.

DB xác nhận thêm một điều: ba chuyến đã về của Hà Giang Loop vẫn ghi `CLOSED` ở
cột `status` mà màn hình ghi *Completed* — đúng như ADR-0046 định: không sửa
seed, giai đoạn suy từ ngày.

**Review findings:** không có. Lượt thử không tìm ra lỗi nào, nên không có nhánh
vá.

Tests after: không đổi code, số test giữ như entry merge F16 ngay dưới.

## 2026-09-23 — Merge F16 lên main (`fc704e3a`)

Nội dung đã kể ở HAI entry ngay bên dưới — "Vòng review F16" và "F16 giai
đoạn chuyến khởi hành". Entry này chỉ ghi sự kiện merge, vì hai entry kia viết
TRƯỚC merge nên chưa mang hash.

Nhánh `feat/departure-phase` rebase lên `2711e755` (bản vá web tính "hôm nay"
theo ngày lịch Việt Nam, từ một session riêng) rồi fast-forward: 8 commit. Xung
đột duy nhất ở CHANGELOG, vì hai bên cùng thêm entry vào đầu file — giữ cả hai,
entry F16 nằm trên. `pnpm gate:int` chạy lại xanh trên đỉnh mới trước khi đẩy.
Không migration, không đổi env, nên không có bước hạ tầng nào.

Việc còn lại: thử tay trên production sau khi Vercel và Render deploy xong
(spec §6).

Tests after: Vitest **4044** (web 1541, api 978, admin 1047, contract 376,
core 46, ui 22, tokens 18, i18n 16), int **605 ở 43 file**, jest mobile 159.

## 2026-09-23 — Vòng review F16: mười lăm phát hiện, vá trọn (nhánh `feat/departure-phase`)

Review chạy TRƯỚC merge, ở mức cao nhất: mười góc tìm độc lập, mỗi ứng viên
một agent kiểm chứng, cộng một lượt quét sót. Sau lọc trùng còn 22 ứng viên, ba
bị bác khi kiểm chứng. Mười lăm phát hiện vào bảng, vá cả mười lăm.

**Ba ứng viên bị bác, và vì sao.** (1) Cho luật "đã khởi hành" gọi
`canCancelOnline` thay vì tự so ngày: "đã đi" là một sự thật về lịch, nếu luật
huỷ đổi thì huy hiệu KHÔNG được đổi theo. (2) Gộp `showToggle` với `canCancel`
vì luôn bằng nhau: hai luật khác nhau, một gương server, một luật giao diện.
(3) Tab All đọc hết lịch sử chuyến: spec đã chấp nhận, mỗi tour khoảng 10 chuyến.

**Hai lỗi lúc chạy thật.**

1. **Khe deploy làm trang Departures sập.** Vercel thường xong trước Render.
   Trong vài phút ấy admin mới đọc API cũ, dựng `<undefined />` ở ô Status, và
   React ném: 500 cho mọi tour có chuyến. Tour không có chuyến thì hiện câu báo
   "chưa đăng" nhầm. Changelog 09/2026 đã ghi đúng bài học này (field bắt buộc
   mới phải có đường lùi phía đọc) mà spec §7 lại chấp nhận rủi ro. Nay ô Status
   để trống, hàng thiếu `phase` không mời đóng hay huỷ, câu báo chỉ hiện khi
   `isPublished === false`, và thiếu `today` thì lùi về đồng hồ server admin.
2. **Hai đồng hồ trên một hàng.** Huy hiệu tính bằng `now` của API, còn chữ
   "Passed" và nút Reopen đọc đồng hồ riêng của trang. Quanh nửa đêm cùng một
   hàng vừa xanh vừa "Passed". Nay `admin.departures.list` trả `today` của
   chính lượt đọc, và cả màn đọc nó.

**Chữ gây hiểu nhầm.**

3. **"On sale" trùng chữ công tắc đăng tour** ở trang Tours: tour đang tắt hiện
   "Off sale" ở đó mà mọi chuyến của nó ghi "On sale" ở đây. Huy hiệu đổi thành
   **"Bookable"** (người dùng chọn "ngắn gọn, dễ hiểu"), khớp cột "Bookable
   departures" sẵn có. Mọi copy cấp chuyến thôi nói "on/off sale"; câu báo tour
   chưa đăng nói bằng chữ của trang Tours; toast tạo chuyến đọc giai đoạn từ
   response, không hứa "bookable" cho chuyến vừa tạo đã quá hạn.
4. **Trang Tours đếm "bookable" cả tour tắt bán**, ngược với câu báo ở màn
   chuyến. Nay có câu phụ "Hidden while off sale", và bộ đếm gọi chính
   `departurePhase` để luật chỉ sống ở một chỗ.
5. **Chú thích đầu VM nói server chặn Close sau khởi hành** — thật ra chỉ giao
   diện chặn (ADR-0046 cố ý không thêm mã lỗi). Viết lại, kèm một ca int ghim
   rằng server vẫn nhận Close ngày khởi hành, để không ai nới chỗ ẩn nút.
6. **Docstring "on-sale = khách còn đặt được" nói quá** cả hai chiều: chuyến kín
   chỗ vẫn xanh, còn chuyến quá hạn vẫn có thể nhận khoản trả trễ.

**Gọn lại.**

7. Ba cờ `showToggle`/`canClose`/`canReopen` cộng chiều gửi mà component tự suy
   từ `status` gộp thành một field `toggle`. `canClose` từng luôn `true` ở mọi
   chỗ nó được đọc. Hộp đóng/mở nay chụp chiều lúc bấm, nên không đổi chiều khi
   bảng vẽ lại dưới chân nó (admin khác vừa đóng chuyến).
8. Ba tab một-giai-đoạn mượn nhãn và icon của huy hiệu thay vì khai lại.

**Test và fixture.**

9. Helper fixture tính cả `phase` lẫn hạn chót bằng chính hàm contract. Fixture
   `SAVED` từng ghi hạn chót 24/11 cho chuyến mà contract tính ra 28/11.
   `makeDepartureRow`, `serverRow`, `vmAt` thay ba bản chép tay.
10. Ca int "mỗi hàng đúng giai đoạn" so cặp theo thứ tự và ghim `total`, thay
    cho `Object.fromEntries` gộp mất hàng trùng.
11. `khongPhase` đổi thành `missingPhase` (luật 8: identifier tiếng Anh).

**Tài liệu lỗi thời (12–15):** glossary còn định nghĩa `status` kiểu cũ; JSDoc
row-actions nói "không có nút huỷ"; comment trang mồ côi nói Close đổi tab; mô
tả route contract, JSDoc `phaseOf` và JSDoc tháng ở trang Tours. Cộng ADR-0046
AMEND 1 (nhãn Bookable, một đồng hồ, công tắc không còn hiện từ ngày khởi hành)
và sửa bảng cổng thiếu điều kiện tour đã đăng; spec §2–§7 theo code.

**Vá kèm ngoài bảng:** bỏ tham số `now` thừa của `rowById`; `TOGGLE_LABELS`
dùng chung cho nút thật và ô giữ chỗ; đổi tên ca int "đóng sớm không hứa gì với
ai" vốn nói ngược ADR-0046.

**Ngoài phạm vi, đã tách việc:** khu account web tính "hôm nay" theo UTC. Một
session riêng đã vá và đưa lên `main` (`144e4f23` tới `2711e755`).

**Để lại, có lý do:** ca int có thể chập chờn đúng lúc 00:00 giờ Việt Nam (cửa
sổ vài chục mili-giây, cùng kiểu với các ca cũ). Ca `zod-config.spec.ts` của
contract hết giờ 5 giây khi chạy 16 worker trên máy này, xanh với 4 worker và
trên CI — không dính F16.

Bảy đột biến đều bị test bắt.

Tests after: Vitest **4036** (web 1533, api 978, admin 1047, contract 376,
core 46, ui 22, tokens 18, i18n 16), int **605 ở 43 file**. Ca mới: admin 12,
contract 1, int 1; hai ca int viết lại cho đúng.

## 2026-09-23 — F16 giai đoạn chuyến khởi hành (nhánh `feat/departure-phase`)

Màn Departures của admin thôi in cột `status` làm trạng thái chuyến. Lượt thử
tay F14 (23/09) cho thấy người đọc hiểu nhầm nó theo hai cách: chuyến đang
chạy vẫn ghi Open, và chuyến đã về ghi Closed khiến người xem tưởng hệ thống tự
đóng chuyến. Quyết định ở ADR-0046: `status` chỉ là công tắc bán hàng, còn giai
đoạn SUY từ ngày bằng một hàm thuần ở contract. Không migration, không job,
không đổi cổng tiền.

**Sáu huy hiệu.** `departurePhase` ở `@tourism/contract` là chỗ duy nhất giữ
luật: Cancelled, Completed, Departed, Closed, Deadline passed, On sale, xét
theo đúng thứ tự ấy và theo lịch Việt Nam. API tính `phase` cho từng hàng với
MỘT mốc `now` mỗi lượt xử lý; admin chỉ in `row.phase`, không gọi hàm (ngoại
lệ duy nhất là helper fixture `apps/admin/src/test/departure-row.ts`). Huy hiệu
dùng biến thể có sẵn của `Badge` kèm icon, xanh đặc đúng một chỗ là On sale.

**Năm tab lọc theo nhóm.** All, Upcoming, Departed, Completed, Cancelled — URL
`?phase=`. API lọc TRONG BỘ NHỚ bằng chính `departurePhase` rồi mới cắt trang,
nên `total` đếm sau khi lọc. URL cũ `?status=OPEN` rơi êm về All.

**Nút đóng/mở nhường chỗ từ ngày khởi hành.** Hàng Departed và Completed chỉ
còn Sửa; ô nút đóng/mở thành một `span` `aria-hidden` mượn lớp của nút để cột
vẫn thẳng. Quá hạn chót mà chưa đi thì Close vẫn bấm được, vì checkout mở
trước hạn có thể đang dở. Nút huỷ chuyến nay đọc cùng `phase` với huy hiệu
thay vì so `today` của trang.

**Dòng báo tour chưa đăng.** `AdminDepartureTour` thêm `isPublished`; màn
chuyến hiện một `Alert` với `role="status"` ngay dưới tiêu đề khi tour chưa
đăng, vì chuyến On sale của tour đang ẩn vẫn không ai đặt được.

**Lệch plan, đều nhỏ:**

1. Task 1: spec viết theo plan đỏ typecheck (TS2345) vì callback `it.each`
   nhận hai tham số trong khi tuple có ba — thêm tham số `_why`, cùng nếp
   `_label` plan dùng ở Task 4.
2. Task 2 B2: bốn ca đỏ chứ không phải ba — ca "key `status` cũ bị bỏ qua"
   cũng đỏ vì schema cũ vẫn nhận `status`. Đúng lý do.
3. Task 4: sửa thêm JSDoc của `canClose` và `canCancel` trong `DepartureRowVM`,
   vì câu cũ ("đóng lúc nào cũng được, trừ khi đã huỷ") thành sai sau F16.
4. Task 4 B3 và B11: đỏ vì B1 đã xoá `t.status` và B4 đã bỏ
   `departureStatusBadgeVariant`, nên ca cũ nổ `TypeError` cùng lúc với ca mới
   — vẫn là lý do "VM và bảng còn đọc công tắc".
5. Task 5 B7: đảo điều kiện `isPublished` làm đỏ hai ca chứ không phải ba — ca
   "không phải `alert`" vẫn xanh vì khi đảo thì không có `Alert` nào được
   dựng. Đột biến vẫn bị bắt.

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **4023** (web 1533, api 978, admin 1035, contract 375,
core 46, ui 22, tokens 18, i18n 16), int **604 ở 43 file**. Ca mới: contract
22, admin 22, int 8 (thêm chín, bỏ ca "lọc theo trạng thái"). Hai mươi đột
biến đều bị giết: tám ở `departurePhase`, ba ở `list` và `toTour`, hai ở tab
lọc, năm ở huy hiệu và nút, hai ở dòng báo.

## 2026-09-23 — Web tính "hôm nay" theo ngày lịch Việt Nam, khớp server và admin (nhánh `fix/web-vietnam-today`)

Phát hiện ở vòng review F16, ngoài phạm vi F16. `todayDateString()` của web cắt
ngày theo UTC, trong khi mọi cổng phía server đo bằng ngày lịch Việt Nam
(ADR-0041 §7) và màn Departures của admin cũng tính giai đoạn chuyến theo ngày
ấy (ADR-0046). Từ 00:00 tới 07:00 giờ VN mỗi ngày, trang account chậm một ngày:
in "còn 1 ngày" cho chuyến server đã thôi cho huỷ online và admin đã ghi
Departed; hôm sau ngày về thì admin ghi Completed mà web vẫn "Ends …" và ẩn
Review. Câu "web vốn đã tính theo ngày" ở ADR-0046 đúng về NGÀY, nhưng thước vẫn
là UTC cho tới bản vá này.

**Rà mọi chỗ web tự tính ngày quanh booking và chuyến đi:**

| Chỗ | Trước | Sau |
| --- | --- | --- |
| `todayDateString()`: nhóm journey, accordion (đã đi/đã về, đếm ngược, `canPay`, `canReview`), hộ chiếu | ngày UTC | `vietnamToday(new Date())` |
| Cuống receipt "Departs/Departed" | `new Date(ngày về) < giờ thật`, đổi chữ lúc 07:00 giờ VN của ngày về | từ NGÀY ĐI theo lịch VN, cùng nghĩa `departed` của admin |
| `itineraryDayState` (lịch trình chế độ live, chưa bật ở đâu) | getter UTC | quy `today` về ngày VN |
| `reviewSlot` (form review ở trang chi tiết) | ngày UTC | **giữ UTC có chủ đích**, thêm JSDoc và test ghim |
| Date picker của form chuyến riêng | nửa đêm giờ trình duyệt | giữ: chỉ ràng buộc UI, server không có luật ngày nào cho `travelDate` |
| Năm "member since" ở `/account` | năm UTC | giữ: trang trí, không quyết gì |
| Ngày của mốc đã qua (Booked, Paid, yêu cầu huỷ cũ) | cắt theo UTC | giữ: chỉ hiển thị, khớp email vốn cũng format UTC |

**Vì sao `reviewSlot` giữ UTC.** Nó là bản chép của `checkReviewEligibility`,
mà cổng ấy giữ UTC có chủ đích ([ADR-0009 AMEND 3](../adr/0009-refund-correctness.md)).
Đổi riêng web sang ngày VN là mở form từ 00:00 giờ VN của ngày về, trong khi API
tới 07:00 mới nhận: khách gõ xong bài mới bị từ chối. Link Review của accordion
vẫn an toàn: nó chỉ hiện từ hôm sau ngày về theo giờ VN, lúc ấy ngày UTC ít nhất
đã tới ngày về. Trước đây không test nào canh chuyện này; đột biến `reviewSlot`
sang `vietnamToday` nay làm đúng ca ghim đỏ.

**Receipt đổi neo, không chỉ đổi thước.** Code gốc neo "Departed" vào NGÀY VỀ,
nên suốt một chuyến nhiều ngày voucher vẫn ghi "Departs". User chốt ở vòng
review: "Departed" từ ngày khởi hành (`departureStartDate <= hôm nay`), để một
chữ chỉ có một nghĩa trên cả sản phẩm.

**Review findings** (một reviewer độc lập, 0 critical): một important là neo
của receipt (user chốt như trên). Minor đã sửa: trích dẫn sai "ADR-0009 AMEND 2"
(câu giữ UTC nằm ở AMEND 3), một câu JSDoc nói quá rộng, và test ghim review
thêm mép 23:59:59.999Z. Bỏ qua có lý do: trang `/account/bookings` gọi
`todayDateString()` hai lần (cách nhau vài micro giây, có từ trước), và
`canPay` của accordion lỏng hơn cổng `reCheckout` (có từ trước, không dính múi
giờ).

Không migration, không đụng hạ tầng. Bốn commit `144e4f23` · `06add356` ·
`cf7fd833` · `d8664032`.

Tests after: Vitest **3987** (web 1541, api 978, admin 1013, contract 353,
core 46, ui 22, tokens 18, i18n 16), int **596 ở 43 file**, jest mobile 159.
Tám ca mới ở web: năm ca đỏ trên code cũ trước khi sửa (cùng ca đếm ngược viết
lại); ba ca còn lại là mép trái hoặc ghim nên xanh sẵn theo thiết kế, và ca ghim
review đã kiểm bằng đột biến.

## 2026-09-23 — Thử tay F14 trên production: 8/8 bước đạt, bốn mục vá (nhánh `fix/p4e-2-f14-manual-test`)

Lượt thử tay chạy NGAY sau merge F14 thay vì đợi F15 như plan ghi: F14 đã
chạy thật, còn F15 sẽ chép lại cách làm của nó, nên lỗi tìm được lúc này là
lỗi F15 khỏi phải lặp. Tám bước, mỗi bước chờ người thử xác nhận, và sau mỗi
lệnh ghi thì đối chiếu thẳng với DB production.

**Không tạo danh mục thật.** Hệ thống cố ý không có nút xoá, nên một hàng
"test" sẽ nằm lại vĩnh viễn, kể cả lúc bảo vệ. Thay vào đó:
`seasonal-classics` (đang ẩn sẵn, 0 tour) để thử chip không có tour, và ẩn rồi
hiện `trekking` (5 tour) để thử đường "danh mục đã ẩn". Form tạo vẫn được kiểm,
chỉ là bấm Cancel. Cuối lượt DB khớp TUYỆT ĐỐI trạng thái gốc — sáu `order`
không trùng, trạng thái bật/tắt và số tour như cũ.

**Ba lỗi của vòng review F14 ở đường "ẩn danh mục" — đã kiểm tận mắt là hết.**
Link cũ `/tours?categories=trekking` vẫn lọc đúng 5 tour, chip đang bật in
"Trekking & Adventure" chứ không phải slug, ô facet được bù vào cuối và đang
tích nên bỏ được. Menu lọc bên back office vẫn có danh mục đã ẩn. Đường nối
"thứ tự admin đặt → thứ tự chip của khách" chạy đúng từ đầu tới cuối.

**Bốn mục lượt thử tìm ra, đã vá cả bốn:**

1. **Cụm nút lệch cột** (góp ý của người thử). Hide và Show rộng khác nhau, mà
   cụm nút canh phải, nên hàng mang nhãn hẹp hơn kéo mũi tên và nút Edit lệch
   khỏi cột. Màn chuyến khởi hành lệch nặng hơn: nút "Cancel departure" chỉ có
   ở hàng chưa khởi hành. Người thử đề xuất tách mỗi nút một cột bảng. Bản vá
   xử cùng cái gốc mà không phải xẻ `DepartureRowActions` — component chứa nút
   huỷ chuyến có hoàn tiền — chỉ để sửa bố cục: mỗi ô nút luôn chiếm bề rộng
   của trạng thái rộng nhất của nó (kit `StableLabel` mới), và hàng thiếu nút
   huỷ giữ một ô trống cùng cỡ.
2. **Câu lỗi slug nói sai luật.** Câu cũ bảo gạch nối được phép, trong khi gõ
   đúng một dấu `-` lại bị từ chối — vòng review siết khuôn slug mà câu báo
   lỗi không theo kịp. Câu mới kèm một ví dụ, và có ca test ghim rằng ví dụ ấy
   hợp lệ.
3. **Ô slug bị soát chính tả** — trình duyệt gạch đỏ `dao-phu-quoc`. Đã tắt,
   cùng tự viết hoa và tự sửa chữ trên bàn phím điện thoại.
4. **Câu cảnh báo trấn an mà tô đỏ.** Hộp ẩn danh mục tô đỏ cả câu "tour vẫn
   bán, link vẫn chạy" — màu nói ngược với chữ. Kit `ConfirmWriteDialog` nhận
   thêm `warningTone`, mặc định vẫn đỏ; hộp danh mục xin giọng trung tính. Kèm
   theo: menu lọc danh mục ở `/tours` nay đánh dấu "(hidden)" cho danh mục đã
   ẩn, để admin biết vì sao nhóm tour ấy không có chip trên web.

**Một lỗ test lượt đột biến bắt được:** `fetchTourCategories` chưa từng có
test, nên gán cứng `isActive: true` ở đó thì dấu (hidden) chẳng bao giờ hiện
mà không ca nào đỏ. Thêm spec theo khuôn mock client của `bookings.spec.ts`.

**Bố cục cần mắt người.** jsdom không dàn trang, nên việc cụm nút đã thẳng cột
chưa được test tự động nào chứng minh — bước kiểm cuối là nhìn trên production
sau khi deploy.

Plan F15 cập nhật theo: bài học 8 ghi câu lỗi slug đã sửa, thêm bài học 13
(`StableLabel`) và 14 (`warningTone`).

**Review findings:** không có vòng review riêng — đây là bản vá từ lượt thử tay.

Tests after: Vitest **3979** (web 1533, api 978, admin 1013, contract 353,
core 46, ui 22, tokens 18, i18n 16), int **596 ở 43 file**. Mười lăm ca mới ở
admin. Tám đột biến đều bị giết.

## 2026-09-23 — Merge F14 lên main (`892de4e8`)

Nội dung của lượt merge này đã kể đủ ở HAI entry ngày 22/09 ngay bên dưới —
"F14 quản trị danh mục tour" và "Vòng review F14". Entry này chỉ ghi sự kiện
merge, vì hai entry kia viết TRƯỚC merge nên chưa mang hash.

Nhánh `feat/p4e-2-categories` rebase lên `fa297460` (bản dọn `isValidDate` từ
một session song song) rồi fast-forward: 11 commit, không xung đột,
`pnpm gate:int` chạy lại xanh trên đỉnh mới trước khi đẩy. Không migration,
nên không có bước Supabase nào.

**Vì sao cần entry này — và vì sao CI lần đẩy đầu đỏ.** `docs-freshness.sh`
lọc commit theo NGÀY COMMIT (`git log --since`). Rebase ghi lại ngày commit
của cả 11 commit thành ngày rebase (23/09), còn entry mới nhất vẫn mang ngày
làm việc (22/09) — nên script thấy tám commit `feat`/`fix` "mới hơn" entry
cuối và đỏ, dù nội dung đã được kể. Bẫy này sẽ lặp lại MỖI KHI một nhánh viết
entry hôm trước rồi rebase-và-merge hôm sau. Cách tránh: viết entry vào đúng
ngày merge, hoặc thêm một entry merge ngắn như entry này.

Tests after: không đổi so với entry vòng review — Vitest **3964**, int
**596 ở 43 file**, đo lại trên đỉnh sau rebase.

## 2026-09-22 — Vòng review F14: mười lăm phát hiện, ba nhóm, ba cái gốc (nhánh `feat/p4e-2-categories`)

Vòng review chạy TRƯỚC merge, mười góc tìm cộng một lượt quét sót. Mười lăm
phát hiện, nhưng chúng gom về ba gốc chứ không phải mười lăm chỗ vá.

**Gốc thứ nhất — không ai bảo đảm mỗi lúc chỉ một người ghi thứ tự.** Năm phát
hiện quanh cột `order`. `move` đọc hai hàng RỒI mới `SELECT … FOR UPDATE`, nên
khoá xếp hàng người ghi mà không bảo vệ giá trị đã đọc: hai lượt trên hai cặp
giao nhau — (2,3) và (3,4) — để lượt sau ghi bằng ảnh chụp cũ, và vì cột ấy
không unique nên hai hàng cùng số sống chung im lặng, vĩnh viễn. JSDoc ngay
trên hai câu UPDATE khẳng định ngược lại. `create` tính `max + 1` cũng đua.
`assertSlugFree` là SELECT pre-flight, mà READ COMMITTED không serialize hai
INSERT — nên slug trùng thoát ra thành `P2002` trần, tức 500, tức admin phân
loại `GENERIC` rồi mất cả form vừa gõ. Và cờ đổi-chỗ ở phía client là state
của MỘT hàng, nên một admin bấm nhanh hai hàng là đủ gây đua, không cần hai
người.

Vá bằng một câu thay vì ba miếng dán: `withCategoryOrderLock`, khoá advisory
cấp bảng, cùng khuôn `withBookingRefundLock` (ADR-0006 AMEND 2b). Mọi lệnh đọc
nằm SAU khoá theo CẤU TRÚC, nên `move` hết stale read, `create` hết đua, và
`assertSlugFree` từ một lời hứa hão thành đúng thật. `FOR UPDATE` thô, phép
`.sort()` theo id và nhánh `CannotMoveError` không-thể-xảy-ra chết theo. Ba
lớp lưới cho đường không đi qua khoá: bắt `P2002`, bắt `P2025` (thay
`assertExists` + `update` vốn là check-then-act, bớt luôn một vòng mạng), và
khoá phụ `{ id: 'asc' }` ở cả hai đường đọc danh mục.

**Gốc thứ hai — web và admin đọc `is_active` bằng hai nghĩa khác nhau.** Ba
phát hiện. Menu lọc `/tours` của chính back office vẫn đọc endpoint CÔNG KHAI,
nên từ khi F14 có nút Hide, ẩn một danh mục là mất luôn cách lọc ra các tour
thuộc nó để đi sửa — đúng lúc cần nhất. Ở trang khách, một danh mục vừa ẩn thì
chip đang bật in slug máy và thẻ facet không có ô nào để bỏ tick, dù link cũ
vẫn lọc đúng. Và câu phụ đề "thứ tự ở đây là thứ tự khách nhìn thấy" nói sai,
vì bảng admin xen cả hàng ĐÃ ẨN còn trang khách lọc chúng đi.

Vá: menu back office đổi sang `admin.categories.list` (JSDoc ở đó đã hẹn
"P4e-2 sẽ thay nguồn" — P4e-2 chính là nhánh này). Trang khách tách "danh sách
chip nào tồn tại" khỏi "chip đang bật tên là gì", gom vào `resolveCategoryOptions`;
hàm ấy cũng phân biệt lời gọi HỎNG (`null`) với mảng rỗng hợp lệ, nên một lượt
500 của `/api/categories` không còn xoá sạch thẻ facet khỏi trang đang sống.
Câu phụ đề viết lại cho đúng.

**Gốc thứ ba — chỗ tự gây, và mấy cái nói sai.** `slugifyVietnamese` nuốt mất
`Ð`/`ð` (U+00D0, ETH) vì chỉ xử `Đ`/`đ` (U+0110): hai cặp vẽ y hệt nhau mà
TCVN3/VNI vẫn sinh ra cặp đầu, nên admin thấy tên ĐÚNG còn slug mất chữ đầu —
và slug khoá vĩnh viễn sau khi tạo. Regex dấu phụ viết bằng ký tự tổ hợp THÔ,
vô hình với mắt lẫn với diff; đo bằng `cat -A` thì viết escape cũng không
thoát, công cụ ghi file đổi nó thành ký tự thô, nên chuyển hẳn sang `\p{M}` và
dựng bốn ký tự D-có-gạch từ MÃ SỐ. `boDauTiengViet` đổi tên (luật 8 đòi
identifier tiếng Anh) và nuốt luôn bản trùng ở `apps/web/src/lib/text.ts`.
Khuôn slug siết lại — bản cũ nhận `-`, `---`, `-day-`; đã đo sáu slug đang
chạy trên production, tất cả đều qua. Mô tả rỗng nay thành `null` thật, đúng
như JSDoc của chính nó vẫn hứa. Bốn comment khai "Task 5 chưa làm" — sai từ
một commit CÙNG NHÁNH.

**`views={null}` sửa ở KHUNG, không ở call site.** Hàng điều khiển là
`justify-between` với đúng hai con, nên `views` rỗng làm cụm nút dạt sang
TRÁI, lệch với mười bảng còn lại. Khung nay tự bọc khe trái.

**Ba test xanh giả.** Ca int "hai lượt đối đầu" bắn `move(2,'down')` +
`move(3,'up')` — cùng MỘT phép đổi chỗ, nên không interleaving nào làm nó đỏ
được, kể cả khi gỡ sạch khoá. `expect(move).not.toHaveBeenCalled()` nằm trong
một ca không bấm gì. Ca contract "KHÔNG nhận số thứ tự" xanh vì thiếu
`direction` bắt buộc, chẳng liên quan tới `order`. Cả ba viết lại; khối guard
của int spec cũng thiếu `update`, nay đủ năm đường cộng một ca 401.

**Dọn.** `Field` chép nguyên văn giữa hai dialog về kit thành `FormField`,
trước khi màn `/destinations` của F15 chép lần thứ ba. Regex slug phía admin
thôi chép tay. Gỡ `isMoveStale`, `CategoryRowVM.order`, hai khoá i18n
`move.up`/`move.down`. JSDoc của `departures` về đúng key nó mô tả.

**Ba món ghi vào sổ nợ** (`open-items.md` G1–G3), có chủ đích chứ không bỏ
quên: payload `move` mà client vứt đi (tiêu thụ nó cần hai nguồn sự thật cho
một bảng sáu hàng), 23 bản chép `sessionCookie` trong int spec, và hai bản
`mapError` đáng rút chung khi F15 thêm bản thứ ba.

**Review findings:** 15 phát hiện, tất cả CONFIRMED, tất cả đã vá.

Tests after: Vitest **3964** (web 1533, api 978, admin 998, contract 353,
core 46, ui 22, tokens 18, i18n 16), int **596 ở 43 file**. Mười lăm ca mới.
Đo đột biến từng cụm: gỡ khoá khỏi `move` hay `create` → đỏ 3/3 lượt; mười ba
đột biến còn lại ở contract, admin và web đều bị giết.

## 2026-09-22 — F14 quản trị danh mục tour, và bộ chip của khách thôi nói dối (nhánh `feat/p4e-2-categories`)

Vùng thứ hai của P4e: `/categories` trong back office, cộng một đoạn dây nối
nó tới trang công khai mà trước nay không có.

**Màn quản trị.** Sáu hàng, không phân trang, không lọc, không tìm kiếm — đo
trên production thì bảng này có đúng sáu hàng, và một thanh công cụ cho sáu
hàng là nhiễu. Bốn hành động trên từng hàng: sửa, ẩn/hiện, lên, xuống. KHÔNG
có nút xoá: `is_active` đã có sẵn nên ẩn là đảo ngược được bằng một cú bấm,
còn xoá thì không.

**Slug khoá sau khi tạo**, và ô nhập chỉ CÓ MẶT ở form tạo — không phải mờ đi,
mà vắng mặt hẳn. Slug đi vào `/tours?categories=<slug>`, mà tham số truy vấn
thì không chuyển hướng được; một ô mờ chỉ mời người ta thử rồi bắt ta giải
thích. Lúc tạo, slug tự điền theo tên qua `slugifyVietnamese` cho tới khi admin
chạm vào ô đó — đo trên production thì slug thật do người chọn (`Hà Nội` thành
`hanoi`, không phải `ha-noi`), nên quyền quyết cuối phải ở họ.

**`move` khoá HAI hàng, sắp theo id trước khi khoá.** Đổi chỗ động tới hai
dòng; hai admin bấm ngược chiều cùng lúc mà khoá theo thứ tự khác nhau là một
deadlock có thật, không phải giả định.

**Đoạn dây nối.** Đây là phần đáng kể nhất của cụm: `/tours` vốn dựng bộ chip
lọc bằng cách suy từ danh sách tour đã tải, nên `is_active` và `order` **không
với tới trang công khai** — ẩn một danh mục vẫn thấy chip, đổi thứ tự vẫn không
đổi gì, và một danh mục mới tạo chưa gắn tour thì không có chip nào để admin
nhìn thấy. Trang nay đọc `catalog.categories.list`; hàm suy-từ-tour xoá hẳn,
vì còn để đó là còn đường quay lại.

Con số in trên chip thì GIỮ cách đếm cũ, ngược với điều bản plan ghi:
`toursCount` của endpoint là số toàn catalogue, in nó ra khi khách đang tìm
kiếm là hứa nhiều hơn thực tế. Endpoint quyết chip NÀO có mặt và theo thứ tự
nào; con số vẫn tính trên lưới đã lọc.

**Hai chỗ doc nói sai code, đã sửa doc:**

- Spec §2e ghi "trang 2 của danh sách tour có bộ chip khác trang 1" như một sai
  lệch cần vá. Đo lại thì không có sai lệch đó — `fetchTours()` gọi một lần
  `limit: 50` và explorer phân trang phía client bằng `history.replaceState`,
  không có vòng server nào. Đính chính ghi thẳng vào spec.
- Bước B5 của plan ghi ngược về con số trên chip (xem trên). Lý do lệch ghi
  ngay tại bước đó.

**Một lỗi tự bắt khi soát lại trước commit:** view model của bảng suy mô tả
hiển thị ra `No description` khi cột trống, rồi form sửa lại so ngược chuỗi ấy
để đoán về bản thô. Một danh mục có mô tả thật đúng bằng câu đó sẽ mở form ra ô
trống, và lưu một phát là mất mô tả. Mô tả thô nay đi riêng khỏi mô tả hiển thị.

**Review findings:** chưa chạy vòng review riêng cho F14.

Tests after: Vitest **3949** (web 1525, api 978, admin 997, contract 347,
core 46, ui 22, tokens 18, i18n 16), int **590 ở 43 file**. Thêm 41 ca admin,
26 ca contract, 20 ca int, và 3 ca web thay cho 3 ca của hàm đã xoá. Mọi ca
mới đều kiểm ĐỎ bằng đột biến — chín đột biến ở vùng admin, ba ở vùng web.

## 2026-09-22 — Vòng hai của F12: tám mục, và hai trong số đó đã tự đóng (nhánh `fix/p4e-f12-wave2`)

Tám mục không-chạm-tiền mà vòng review F12 (21/09) gác lại. Rà từng mục trong mã
hiện tại TRƯỚC khi vá — và **hai mục hoá ra đã đóng** do chính bản vá F12 và F13,
nên chúng được KIỂM chứ không được vá.

**Sáu mục vá thật:**

1. **Form giờ là `<form>` thật.** Gõ xong bốn ô rồi bấm Enter là phản xạ của mọi
   người từng điền form; trước vòng này khối ô chỉ là một `<div>` nên Enter rơi
   vào hư không.
2. **`aria-describedby` nối ô nhập với gợi ý và câu lỗi của nó.** Helper `Field`
   đổi sang render-prop và tự ghép chuỗi id — để mỗi chỗ gọi tự ghép là bốn nơi
   phải nhớ hai luật, và một `aria-describedby` trỏ vào id không tồn tại còn tệ
   hơn không có.
3. **`update` ghi dòng nhật ký kiểm toán.** `create` và `setStatus` đã có, mà
   `update` mới là lệnh đổi được nhiều thứ nhất (ngày, ghế, giá). Ghi CẢ trước
   và sau, vì "đổi 20 thành 45" mới là câu trả lời được cho *"ai hạ ghế xuống?"*.
4. **`TourNotFoundError` bắt bằng `instanceof`, không so `error.name`.** Repo có
   **năm** lớp trùng tên ở năm module, nên so theo tên là bắt nhầm lỗi của bất kỳ
   module nào lọt vào đây.
5. **`isRefreshing` rời khỏi deps của `useMemo` dựng cột, đi qua context.** Cờ ấy
   đổi hai lần mỗi lệnh ghi; nằm trong deps thì mảng cột dựng lại cả hai lần,
   TanStack thấy cột mới nên dựng lại ô, kéo theo `DepartureRowActions` unmount
   rồi mount lại cùng toàn bộ state của nó.
6. **Trần ghế theo cỡ nhóm tour** (`SEATS_ABOVE_TOUR_MAX`, 422) ở cả `create` lẫn
   `update`. `tours.max_group_size` là lời hứa in trên chính trang tour và nó
   quyết cỡ xe; một chuyến 40 ghế trên tour công bố tối đa 12 là bán thứ không
   giao được, mà không tầng nào bên dưới bắt — CHECK của DB chỉ canh
   `seats_booked <= seats_total`, không biết gì về tour. Đo trước khi bật: prod
   có **0** hàng vi phạm, nên không chuyến nào đang chạy bỗng thành không sửa được.

**Hai mục đã tự đóng, kiểm bằng đột biến mã chứ không bằng suy đoán:**

- *Test xanh giả ở `departure-row-actions.spec.tsx`.* Khối chứa nó đã được viết
  lại ở vòng vá F12 (câu `t.list.bookings(2)` thay bằng cặp khẳng-định/phủ-định
  theo nhãn). Quét đột biến ba hành vi mà file ấy canh — bỏ chốt hàng đã huỷ, mở
  khoá nút Reopen, luôn hiện nút huỷ — đều làm đúng số ca đỏ.
- *Dời ngày chuyến đã qua thì viết lại sổ P&L tháng đã chốt.* Báo cáo gom giá vốn
  cố định theo `end_date` và **chỉ đếm chuyến có khách đã trả tiền**; mà chuyến
  như thế thì `seats_booked` khác 0, nên chốt `dateChangeBlocker` chặn sẵn. Tính
  chất này chỉ đúng NHỜ thước `seats_booked` của vòng vá F12 — bản cũ đếm theo
  trạng thái booking và một booking hoàn-thiện-chí-trọn-tiền đọc ra 0 trong khi
  vẫn tính vào P&L. Nay có ca int ghim lại, kèm ca thứ hai cho hướng dời-về-quá-khứ
  (chốt `START_IN_PAST` bắt trước).

**Một hệ quả phụ đáng ghi:** fixture của int spec dựng chuyến 20 và 30 ghế trên
một tour fixture công bố tối đa **16** — tức dữ liệu test vốn đã mâu thuẫn với
lời hứa của chính tour đó, chỉ là chưa ai hỏi. Hạ xuống 12/14 cho khớp.

**Review findings:** không có vòng review riêng — đây là vòng hai của review F12.

Tests after: Vitest **3882** (web 1525, api 978, admin 956, contract 321, core 46,
ui 22, tokens 18, i18n 16), int **570 ở 42 file**. Thêm 7 ca unit và 4 ca int.
Bốn ca component mới đã kiểm ĐỎ bằng đột biến (đổi nút submit về `type="button"`
và cắt `aria-describedby`).

## 2026-09-22 — Vá lỗ hổng đường claim: chuyến dời ngày giữa lúc khách đang trả tiền (ADR-0009 AMEND 4, nhánh `fix/claim-gate-departure-moved`)

Mục cuối cùng còn chạm tiền của P4e-1, phát hiện ở vòng review F12 và để lại
trong [open-items](../open-items.md) vì nằm ngoài phạm vi F12.

**Lỗ hổng.** Booking `PENDING` không làm tăng `seats_booked` (bất biến #1 của
ADR-0009), mà chốt chặn đổi ngày của `admin.departures.update` lại đo bằng
`seats_booked`. Nên admin dời được ngày một chuyến ngay trong lúc khách còn ngồi
ở trang thanh toán — hoàn toàn hợp lệ theo luật hiện hành. Khi capture về, gate
claim của [ADR-0009 AMEND 1](../adr/0009-refund-correctness.md) chỉ hỏi *"chuyến
còn mở và chưa đi chưa"*, không hỏi *"chuyến còn là thứ khách đã mua không"* —
nên booking flip `PAID` mang BẢN SAO NGÀY CŨ. Khách cầm voucher in sai ngày và
một hạn huỷ tính từ một ngày không còn tồn tại, không có gì báo cho ai.

**Vá.** Qual của AMEND 1 thêm hai phép so `dep.start_date = b.departure_start_date`
và `dep.end_date = b.departure_end_date`. Lệch ngày → outcome MỚI
`departure-moved` → đi đúng đường auto-refund sẵn có của
`overbooked`/`departure-closed`: hoàn trọn, booking `CANCELLED`, email
`BOOKING_REFUNDED`, dedupe key riêng `departure-moved-refund:<bookingId>`.

**Ba quyết định, ghi đủ ở [AMEND 4](../adr/0009-refund-correctness.md):**

- *Outcome RIÊNG chứ không dùng lại `departure-closed`.* Hai đường xử lý giống
  hệt nhau nên gộp là rẻ hơn, nhưng chuyến ở đây đang MỞ và đang bán — một dòng
  log nói "departure-closed" về nó là câu sai nằm lại trong sổ sự kiện tiền.
  Cùng lý lẽ đã dùng khi bỏ cột "x / y refunded".
- *HOÀN TIỀN chứ không dời booking theo chuyến.* Đồng bộ bản sao xuống booking là
  âm thầm đổi thứ khách đã đồng ý; ADR-0041 §2b đã loại cách ấy cho người ĐÃ trả
  tiền, người ĐANG trả lại càng chưa đồng ý gì.
- *KHÔNG siết chốt chặn ở `admin.departures.update`.* Thêm "chặn khi có PENDING"
  chỉ thu hẹp cửa sổ chứ không đóng được: `bookings.create` không khoá chuyến,
  nên một booking mới luôn chen được vào giữa lúc admin đọc và lúc admin ghi.
  Chỉ gate claim mới đóng được, vì nó là nơi duy nhất thấy cả hai sự thật.

**Một test cũ phải sửa SETUP, và đó là phát hiện phụ đáng giữ.** Ca §3.2
("thanh toán đang dở lúc hạn chót trôi qua vẫn được nhận") giả lập hạn chót đã
qua bằng cách DỜI NGÀY CHUYẾN mà không dời bản sao trên booking — tức nó đang
giả lập nhầm một chuyện khác hẳn, và gate mới trả `departure-moved` đúng như nó
phải làm. §3.2 nói về ĐỒNG HỒ chạy tới, không nói về lịch bị sửa; setup nay dời
cả hai.

**Review findings:** không có vòng review riêng — bản vá một mục đã được review
gọi tên từ 21/09.

Tests after: Vitest 3875 không đổi, int **566 ở 42 file** (thêm 2 ca AMEND 4 —
một ca dời ngày, một ca dời-rồi-khởi-hành để ghim thứ tự phân loại). Ca dời ngày
đã kiểm ĐỎ bằng cách gỡ hai phép so ra khỏi CTE.

## 2026-09-22 — Chạy thử tay F13 trên production, và một câu copy nói dối (nhánh `fix/departure-cancel-reason-copy`)

Lượt nghiệm thu cuối của [plan P4e-1](../plans/2026-09-21-p4e-1-departures.md), chạy
trên chính production (Stripe test mode, worker inline). Đường huỷ chuyến chạy
đúng từ đầu tới cuối; một lỗi copy lộ ra, và nó là loại lỗi chỉ thử tay mới bắt.

**Đường huỷ: đạt.** Tạo chuyến 22/10 trên tour `hanoi-old-quarter-food-night`,
đóng rồi mở lại, đặt một chỗ và trả bằng thẻ test, rồi huỷ chuyến. Đo được trong
DB prod: chuyến `CANCELLED` với đủ ba cột sổ (`cancelled_at/by/reason`), booking
`CANCELLED`, một dòng sổ hoàn **35.00 USD** mang mã `re_…` do chính Stripe trả
về, ghế trả lại `0 / 4`, `cancellation_requests` ở `REFUNDED` đúng lý do, email
`BOOKING_CANCELLED` đã gửi và in đúng số tiền. Từ lúc bấm huỷ tới lúc hoàn xong:
**1,4 giây** — ảnh chụp kịp thấy cột "1 traveller still to refund" rồi nó biến
mất sau một lượt refresh, đúng hành vi đã đổi ở vòng review.

**Lỗi tìm được.** Hộp xác nhận huỷ nhắc dưới ô lý do: *"Say why — travellers see
this on their booking."* Câu ấy SAI. Lý do có vào `cancellation_requests.reason`
thật và admin đọc được, nhưng email báo huỷ không mang nó và trang booking phía
khách không render nó ở đâu cả — tra lại mã nguồn thì `apps/web` chỉ có ô
`reason` để KHÁCH tự gõ khi họ huỷ. Không mất tiền, nhưng là copy nói dối trên
màn tiền: nó khiến admin cân nhắc câu chữ cho một người đọc không tồn tại. Cùng
loại lỗi mà vòng review vừa bắt ở cột "x / y refunded".

Vá bằng cách nói đúng thứ đang xảy ra — câu nhắc nay là *"it is kept on every
affected booking for your team"*. Cho khách thật sự đọc được là việc KHÁC (phải
đụng payload outbox, template email và một vùng trên web, cộng một quyết định về
giọng văn vì lý do admin gõ là câu nội bộ); đã ghi thành đề xuất sản phẩm ở
[open-items](../open-items.md) chờ chủ dự án quyết.

Ghi chú vận hành: 3.877 test tự động không cái nào biết email trông ra sao. Đây
là giá trị của mục "chạy thử tay" trong plan, và là lý do nên giữ nó ở mọi phase
sau.

**Review findings:** không có vòng review riêng — đây là lượt vá một câu copy.

Tests after: không đổi con số nào (chỉ sửa chuỗi i18n và hai khối JSDoc). Vitest
3875, int 564 ở 42 file.

## 2026-09-22 — P4e-1 F13: nút công ty huỷ chuyến, hoàn tiền qua hàng đợi (nhánh `feat/p4e-departure-cancel`)

Đóng món nợ [ADR-0041 §6](../adr/0041-single-cancellation-deadline.md) mở từ đầu
tháng 9: *công ty huỷ chuyến hoàn 100% mọi lý do — lõi đã viết sẵn nhưng chưa
có nút*. Bốn task theo [plan](../plans/2026-09-21-p4e-1-departures.md), mỗi task
một commit.

**Hai đường huỷ, hai cách tính tiền.** `refundOnOperatorCancelForBooking` là
hàm mới, và toàn bộ lý do nó tồn tại nằm ở chỗ nó KHÔNG nhận `now`: hạn chót
là luật cho KHÁCH đổi ý (qua hạn thì chỗ không bán lại được nữa nên không tự
hoàn), còn chuyến bị công ty bỏ thì khách chẳng đổi ý gì cả. Cùng một mốc
18/10 với hạn chót 17/10, khách tự huỷ ra `0.00` và công ty huỷ ra trọn
`117.00`. Thêm `now` vào chữ ký là mời người đọc sau tin rằng thời điểm có ảnh
hưởng.

**Hàng đợi đầu tiên của dự án mang payload.** Năm queue hiện có đều là cron
không tham số với `retryLimit: 0`, vì lượt kế bù được. Ở đây bỏ một lượt là
MỘT KHÁCH KHÔNG ĐƯỢC HOÀN TIỀN, nên queue khai `retryLimit: 5` giãn luỹ thừa
từ 30 giây, và `policy` để mặc định chứ không `'short'` (`'short'` gộp các job
đang chờ thành một, mà mỗi job ở đây là một khách khác nhau). Retry chỉ an
toàn nhờ job idempotent: lượt giao lại đọc trạng thái booking TRONG khoá, thấy
`CANCELLED`, và dừng TRƯỚC cổng thanh toán. Trả `null` chứ không ném — "đã
hoàn rồi" là kết cục THÀNH CÔNG, ném ở đó sẽ đốt hết retry để báo lỗi cho một
việc đã xong.

**Một job mỗi booking, không phải mỗi chuyến.** Mỗi booking là một lời gọi ra
cổng thanh toán và hỏng độc lập; gom cả chuyến thì khách thứ 7 hỏng kéo theo
lượt retry của 6 người đã hoàn xong.

**Endpoint đồng bộ, tiền bất đồng bộ.** `admin.departures.cancel` khoá chuyến,
đổi `CANCELLED`, huỷ luôn nhóm `PENDING` tại chỗ (chưa trả tiền nên không có
gì hoàn; không trả ghế vì `PENDING` chưa từng claim ghế), chụp nhóm cần hoàn,
rồi trả về. Đợi hoàn tiền ngay trong request là sai: một chuyến 30 khách là 30
lời gọi ra cổng, và request đầu tiên hết giờ chờ để lại một lượt huỷ nửa chừng
mà không ai biết đã tới đâu.

**Màn admin.** Nút huỷ dùng thước NGÀY KHỞI HÀNH chứ không phải hạn nhận đặt —
khác hẳn nút Mở lại ngay bên cạnh, vì một chuyến quá hạn đặt mà hướng dẫn viên
gãy chân vẫn phải huỷ được. Hộp xác nhận in hai con số (bao nhiêu người được
hoàn, bao nhiêu phiên thanh toán bị huỷ) và bắt nhập lý do, kèm câu nhắc rằng
KHÁCH đọc được lý do ấy. Cột tiến độ đọc từ đếm booking, không thêm bảng nào.

**Hai thứ làm THÊM so với plan, cùng vì một lỗ hổng.** Job được đẩy SAU khi
transaction commit, nên có một khoảng hở thật: không worker nào đăng ký, hoặc
pg-boss lỗi, hoặc tiến trình chết đúng khe giữa — thì booking đã trả tiền nằm
lại trên chuyến đã huỷ và KHÔNG có gì đánh thức nó dậy (khác mọi queue khác,
ở đây không có cron nào tự chạy lại). Vá bằng: ba cột sổ trên `tour_departures`
(`cancelled_at/by/reason` — cũng là nơi DUY NHẤT trả lời "ai huỷ, vì sao" với
một chuyến không có khách nào), và lượt quét `sweepStranded` đi ké nhịp
`booking-sweep` 10 phút. Chuyến huỷ từ trước F13 không có sổ thì lượt quét BỎ
QUA và cảnh báo, không bịa ra người quyết.

**Một quyết định đo được, không phải suy đoán.** `cancelled_by` cố ý KHÔNG có
khoá ngoại tới `users`. Bản đầu có, và `TRUNCATE users CASCADE` lập tức kéo
theo cả `tour_departures` làm 25 integration test đỏ — `POST /api/bookings`
trả `DEPARTURE_NOT_AVAILABLE` vì lịch chạy biến mất giữa chừng. Lý do thứ nhất
đứng độc lập với lỗi ấy: một dấu vết kiểm toán phải sống lâu hơn tài khoản nó
trỏ tới, mà khoá ngoại chỉ cho chọn giữa `SET NULL` (xoá admin là xoá luôn vết
họ từng huỷ chuyến nào) và `RESTRICT` (không xoá được tài khoản nữa).

**Review findings:** vòng review 22/09 báo **4 phát hiện, nhưng chỉ hai chỗ
sai** — vá ở gốc thay vì vá bốn triệu chứng (`b221754f`).

*Gốc 1 — đường operator mượn cổng chặn của đường khách.* `cancellationBlocker`
chặn khi "đã tới ngày khởi hành": đúng với khách, SAI với lượt hoàn tiền của
công ty. Lượt ấy chạy bất đồng bộ — worker gói free ngủ 15 phút, cổng thanh
toán hờn rồi retry giãn luỹ thừa — nên job hoàn toàn có thể chạy sau ngày khởi
hành, mà chuyến khi ấy đã bị bỏ từ trước. Đo được bằng test: chuyến 10/10 huỷ
ngày 09/10, worker tỉnh ngày 11/10 → `cancelByOperator` trả `null` → pg-boss
ack THÀNH CÔNG → khách mất tiền, không log, không alert; lưới quét 10 phút/lần
vấp đúng chốt ấy nên không bao giờ cứu được, và vì chỉ đếm thành công nên cũng
không kêu. Vá: `cancellationBlocker` nhận `initiator` (mặc định `'customer'`
để mọi chỗ gọi cũ giữ nguyên nghĩa), chốt ngày chỉ áp cho khách. Kèm theo,
`cancelByOperator` tách hai kết cục vốn bị gộp: trạng thái đã đóng là ĐÃ XONG
(trả `null`), còn thiếu capture là CẦN NGƯỜI NHÌN (ném) — `claimSeatsForPaid`
nhận `providerPaymentId ?? null` nên hàng PAID không capture là có thật.

*Gốc 2 — cột "x / y refunded" nói sai.* Tử số `cancelledBookingCount` đếm cả
booking `PENDING` vừa bị huỷ tại chỗ (chưa trả tiền nên chưa từng được hoàn)
lẫn booking khách tự huỷ từ trước: chuyến 2 PENDING cộng 3 PAID hiện
"2 / 5 refunded" ngay khi chưa một đồng nào đi, và chuyến huỷ lúc chưa ai đặt
hiện "0 / 0 refunded". Vá bằng cách THAY thước chứ không sửa phép tính: cột in
"N travellers still to refund" đọc thẳng từ `liveBookingCount` và để TRỐNG khi
hết người chờ. `cancelledBookingCount` bỏ hẳn khỏi contract — một field không
ai dùng trên hàng tiền là một field sẽ lệch.

**CÒN TREO:**

- **Deploy migration `20260922120000_departure_cancellation_audit` lên Supabase**
  sau khi merge (luật 15).
- **Chạy thử tay** theo mục nghiệm thu của plan: tạo một chuyến, đóng, mở lại,
  rồi huỷ một chuyến có booking sandbox và xem cột tiến độ chạy tới đủ.
- Vòng hai của F12 (8 mục) vẫn mở.

Tests after: Vitest **3875** (web 1525, api 975, admin 952, contract 321, core 46,
ui 22, tokens 18, i18n 16), int **564 ở 42 file**, Jest mobile 245 không đổi.
Riêng F13 thêm 23 ca unit và 19 ca int (gồm vòng vá review). Task 8, Task 9 và luật
`departureCancelBlocker` đi đúng TDD (đỏ trước rồi mới implement); bảy ca int
của endpoint viết SAU phần cài đặt và được bù bằng đột biến mã — bỏ chốt
huỷ-lần-hai, bỏ chặn chuyến đã khởi hành, bỏ ghi sổ, bỏ huỷ nhóm `PENDING`,
bỏ chốt idempotent và bỏ guard chuyến đều làm đúng số ca dự kiến đỏ.

## 2026-09-22 — P4e-1: danh sách tour có công tắc đăng, và lịch chạy của từng tour (nhánh `feat/p4e-tours-list` rebase dưới `feat/p4e-departures-crud`)

Hai cụm việc đầu của P4e, dựng song song ở hai worktree rồi gộp làm một lượt vì
F12 nối thẳng từ màn F11 (nút "Departures" trên mỗi hàng tour). Thiết kế đi
trước: [spec](../specs/2026-09-21-p4e-1-departures-design.md) ·
[plan 11 task](../plans/2026-09-21-p4e-1-departures.md).

**F11 — `/tours`.** `admin.tours.list` trả CẢ tour chưa đăng (bề mặt công khai
không được biết chúng tồn tại), kèm `isPublished` và số chuyến còn bán được
trong khoảng lọc. `admin.tours.setPublished` là ĐÚNG MỘT công tắc, cố ý không
khai mã lỗi nào ngoài `NOT_FOUND`: gỡ đăng một tour đang có khách là hợp lệ và
không được chặn — khách đã mua vẫn đi, tour chỉ thôi được chào bán. Chặn ở đây
là khoá đúng thao tác vận hành cần nhất khi có chuyện.

**F12 — `/tours/[slug]/departures`.** Bốn thao tác: đọc danh sách, thêm, sửa,
đóng/mở lại. Hạn chót có CỘT RIÊNG chứ không giấu sau tooltip, vì nó là mốc
quyết định mọi thao tác trên hàng. Ba luật viết thành hàm thuần có test:

- **Đổi ngày** bị khoá khi chuyến đã có ghế bị giữ. `Booking` lưu BẢN SAO ngày
  khởi hành và ADR-0041 tính hạn huỷ từ bản sao ấy, nên đổi ngày chuyến là tạo
  hai sự thật. Bất biến: hạn huỷ không bao giờ xấu đi sau khi khách đã trả tiền.
  Giá và ghế thì vẫn sửa được, kể cả khi đã có khách.
- **Hạ ghế** dưới số đã đặt bị từ chối ở tầng nghiệp vụ. CHECK
  `departures_seats_within_total` vẫn đứng sau làm lưới, nhưng một SQLSTATE
  23514 phơi lên màn hình là câu trả lời cho máy, không phải cho người sửa lịch.
- **Mở lại** sau hạn chót bị từ chối: hạn chót cũng là lúc ngừng nhận đặt, nên
  mở lại sau mốc đó là bày ra một chuyến không ai đặt được.

KHÔNG có nút huỷ chuyến (đó là F13, và nó chạm tiền) và KHÔNG có lệnh xoá:
chuyến đã có người đặt thì phải huỷ có hoàn tiền, chuyến chưa ai đặt thì `CLOSED`
đã đủ — thêm lệnh xoá là thêm một đường làm mất bản ghi mà báo cáo tháng đang đếm.

**Review findings:** hai vòng review riêng, 10 góc mỗi vòng, tổng **28 mục vá**.

*F11 — mười ba mục* (`c3fc83c6`). Sáu mục chặn merge. Nặng nhất: công tắc đăng
KẸT sai trạng thái tới khi tải lại cả trang, vì gương `serverValue` được nâng
khi prop đổi giữa lúc lệnh ghi đang bay; bản vá ĐẦU TIÊN của vòng này cũng sai
theo đúng cách ấy, và chính hai test mới bắt được. Bust cache thôi gác sau
`changed` (revalidate là fire-and-forget, gác lại thì tour ở lại trên site trọn
300 giây ISR). Menu lọc danh mục gọi endpoint công khai nên ăn trần đọc theo
IP — nay hỏng thì trả rỗng thay vì kéo sập cả bảng. `page` kẹp cả TRẦN 10 000
theo contract: lỗ này ở kit dùng chung nên **sáu bảng admin cùng được vá**.
Đếm chuyến cắt thêm nhát `isWithinDeadline`, hệ quả cố ý là tháng quá khứ trả 0
và nhãn đổi sang "Bookable departures".

*F12 — mười lăm phát hiện, bảy mục vá* (`048cfc48`); tám mục còn lại dồn sang
vòng hai vì chúng không chạm tiền và không làm sập trang.

Năm mục chạm tiền:

1. **Trần giá và đúng 2 chữ số lẻ.** `129.999` từng đi lọt cả ba tầng rồi bị
   cột `Decimal(14,2)` làm tròn thành `130.00` — một con số khách phải trả mà
   không ai gõ vào. Quá 12 chữ số phần nguyên thì Postgres ném `22003`,
   `mapError` không nhận ra nên thành 500 trần, admin phân loại `GENERIC`, rồi
   kit ĐÓNG dialog: mất sạch bốn ô vừa điền.
2. **Token `version` chống ghi đè mù giữa hai tab**, kèm mã `DEPARTURE_STALE`.
   `FOR UPDATE` tuần tự hoá hai lệnh ghi nhưng KHÔNG phát hiện được cái cũ, vì
   giá trị "hiện tại" trong payload đến từ form trình duyệt chứ không từ hàng
   vừa khoá. A đổi 20 ghế thành 45, B bấm Lưu từ form mở trước đó và ghi đè về
   20: 25 ghế biến mất im lặng, khách đặt tiếp đâm trần, claim trả `overbooked`,
   hệ thống tự hoàn tiền người ĐÃ trả. Token là `updatedAt` nên không thêm cột;
   form CHỤP nó lúc mở chứ không đọc lại lúc gửi.
3. **Thước khoá ô ngày đổi sang `seats_booked`.** Bản đầu đếm trạng thái
   booking, nhưng [`booking-states`](../conventions/booking-states.md) nói ngược
   đúng chỗ đó: hoàn tiền thiện chí trọn tiền KHÔNG trả ghế, khách vẫn đi tour.
   Nên đếm theo trạng thái đọc ra 0 trên một chuyến vẫn còn khách thật rồi mở
   khoá ô ngày. Đổi thước còn xoá một mâu thuẫn bày ngay trên màn hình:
   "Seats 4 / 20" đứng cạnh "Live bookings 0".
4. **Tách `pendingBookingCount`.** Đóng chuyến gây hai hệ quả khác hẳn nhau:
   khách ĐÃ trả giữ chỗ và không ai báo gì, còn khách ĐANG trả bị đường claim
   từ chối rồi hoàn tiền tự động kèm email. Hộp xác nhận nay in hai dòng, và
   thêm một câu cảnh báo khi còn checkout dở.
5. **Copy tạo chuyến thôi hứa "goes on sale straight away"**, và form cảnh báo
   ngay khi chuyến sắp tạo đã quá hạn nhận đặt — hạn là `ngày đi − N` với N tới
   7 ngày, nên một chuyến 5 ngày khởi hành tuần sau đã quá hạn ngay lúc tạo.

Hai mục làm sập cả trang: `seatsTotal` ở hàng ĐẦU RA nới về `nonnegative()` (khai
chặt 1..500 nghĩa là một hàng hợp lệ với DB nhưng ngoài dải sẽ trượt validation
đầu ra và 500 cả trang, kể cả chính cái form dùng để sửa nó); và CHECK
`departures_date_range` (`end_date >= start_date`) — một hàng ngược ngày sinh ra
độ dài âm, `tripLengthDays` ném `RangeError`, mà hàm đó chạy cho MỌI hàng ở
`admin.departures.list` lẫn `catalog.getTourBySlug`, nên đúng một hàng hỏng kéo
sập luôn trang tour công khai.

**CÒN TREO:**

- **Vòng hai của F12** (8 mục, không chạm tiền): bọc `<form>` để Enter gửi được ·
  `aria-describedby` cho ô có gợi ý · `update` thiếu dòng nhật ký kiểm toán ·
  một test xanh giả ở `departure-row-actions.spec.tsx` · `TourNotFoundError` bắt
  bằng `error.name` thay vì `instanceof` · `isRefreshing` nằm trong deps của
  `useMemo` nên ô bảng bị dựng lại · thiếu kiểm `maxGroupSize` lúc tạo · dời
  ngày một chuyến đã qua thì viết lại sổ P&L của tháng đã chốt.
- **Lỗ hổng đường claim** (ngoài phạm vi F12, đã ghi ở
  [open-items](../open-items.md)): booking `PENDING` không làm tăng `seats_booked`,
  nên chuyến vẫn đổi ngày được trong lúc khách đang thanh toán; lượt claim về
  sau vẫn flip sang `PAID` với bản sao ngày CŨ. Cổng claim hiện chỉ kiểm chuyến
  còn `OPEN` và chưa khởi hành, không so bản sao ngày với ngày thật.
- **Deploy migration `20260922090000_departure_date_range_check` lên Supabase**
  sau khi merge (luật 15: hạ tầng sống chỉ đụng ở session gốc, sau review).

Tests after: Vitest **3852** (web 1525, api 965, admin 942, contract 318, core 46,
ui 22, tokens 18, i18n 16), int **545 ở 41 file**, Jest mobile 245 không đổi.
Riêng hai cụm này thêm 163 ca unit và 48 ca int. Ba ca mới của vòng vá F12 đã
kiểm ĐỎ bằng đột biến mã trước khi nhận là xanh thật. Build web chạy với API
sống trên máy (đúng cấu hình CI) — xanh.
