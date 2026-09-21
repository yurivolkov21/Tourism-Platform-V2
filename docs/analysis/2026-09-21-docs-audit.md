# Rà soát tài liệu 21/09/2026 — quy mô, vấn đề, và bốn đợt sửa

> Ảnh chụp trước khi sửa, cộng nhật ký những gì đã làm. Đợt rà soát trước:
> [đại tu docs 03/08](2026-08-03-docs-overhaul-audit.md).
>
> Yêu cầu của user: viết gọn lại, tuốt nội dung cho dễ hiểu, "dù là lập trình
> viên hay không phải lập trình cũng hiểu được đại khái".

## 1. Quy mô đo được

**159 file Markdown · 78.970 dòng · 4,4 MB**, cộng 114 file khác (29 mockup
HTML, 51 ảnh tham chiếu, 28 snapshot JSON).

| Nhóm | File | Dung lượng | Tỷ lệ |
| --- | ---: | ---: | ---: |
| `plans/` | 38 | 2,11 MB | 48,1% |
| `CHANGELOG.md` | 1 | 589 KB | 13,4% |
| `adr/` | 43 | 564 KB | 12,8% |
| `specs/` | 38 | 506 KB | 11,5% |
| `analysis/` | 18 | 175 KB | 4,0% |
| `README.md` | 1 | 149 KB | 3,4% |
| `changelog/` | 2 | 101 KB | 2,3% |
| `conventions/` | 12 | 86 KB | 2,0% |
| `superpowers/` | 1 | 65 KB | 1,5% |
| `design/` | 4 | 31 KB | 0,7% |

Hai file cá biệt: `plans/2026-09-15-refund-deadline.md` nặng 753 KB / 16.966
dòng (17% toàn bộ docs) và `CHANGELOG.md` với 133 entry.

## 2. Bảy vấn đề

### V1 — Cửa vào bị nghẽn

`docs/README.md` chỉ 224 dòng nhưng 149 KB: trung bình **665 ký tự một dòng**,
ô dài nhất **5.772 ký tự**. Bảng "bản đồ" đã hoá thành bản tóm tắt đầy đủ của
từng ADR, kèm cả AMEND 1–4. Người mở tài liệu lần đầu không có chỗ bám.

Đo thêm: mọi AMEND chép trong bản đồ **đều đã có đủ trong chính file ADR**, và
bản chép còn cũ hơn bản gốc — bản đồ ghi ADR-0026 tới AMEND 4 trong khi ADR có
AMEND 5; ghi ADR-0009 tới AMEND 2 trong khi ADR có AMEND 3. Nên cắt phần chép
là xoá bản sao lỗi thời, không mất thông tin.

### V2 — Không có tầng cho người không lập trình

Không glossary, không trang "sản phẩm là gì · ai dùng · luồng chính". Mọi file,
kể cả những file viết tốt nhất, mở đầu bằng thuật ngữ nội bộ.

### V3 — Tài liệu lệch thực tế, đúng ở chỗ người lạ đọc đầu tiên

`README.md` ở gốc kho mã:

| Ghi trong README | Thực tế đo được |
| --- | --- |
| `@tourism/admin` — Vite · TanStack Router/Query SPA | Next.js 16.3.4 (ADR-0026) |
| `@tourism/mobile` — Expo SDK 56 · RN 0.85 | Expo 57.0.23 · RN 0.86.3 |
| web ⬜ P3 · admin ⬜ P4 · mobile ⬜ P5 | P3b đã deploy; P4a–d và P5a, P5b-1 đã xong |
| `@tourism/core` ⬜ "khi cần ở P2+" | đã có, 46 test |
| Nexora tại `/mnt/c/Dev Program Files/...` | đã chốt bỏ 14/09, không còn trên máy |

Thiếu hẳn `@tourism/ui` và `@tourism/mobile-ui` trong bảng. `CLAUDE.md` dòng 20
vẫn ghi "P4 admin (kế tiếp)".

### V4 — Bốn file ngoài bản đồ

`changelog/2026-07-p0-p3a-backend.md`, `changelog/2026-07-p3b-static.md` (chỉ
trỏ gián tiếp qua tên thư mục), `design/claude-design-brief.md`,
`superpowers/plans/2026-08-12-media-write-surface.md` (không đường nào trỏ tới).

### V5 — Bản đồ tự mâu thuẫn

Mục "Quy tắc viết" viết **"không tạo `docs/superpowers/`"**, nhưng thư mục đó
tồn tại với một plan 65 KB.

### V6 — Việc còn nợ không có nơi tập trung

Hơn 30 mục "CÒN TREO" rải trong 133 entry CHANGELOG. Muốn biết hôm nay còn nợ
gì phải đọc dọc cả file.

### V7 — Plans phình và không có dấu đóng

Chiếm 48% docs, hầu hết đã đóng từ lâu, nhưng không file nào nói ở đầu rằng nó
đã xong và kết quả nằm ở đâu.

## 3. Cái đang tốt, giữ nguyên

ADR có khuôn ổn định (Bối cảnh · Quyết định · Hệ quả · Phương án đã loại) và
viết chắc. `conventions/` đúng tinh thần ngắn-và-có-lý-do. CHANGELOG giàu thông
tin thật, không phải danh sách commit. Các luật bất biến (entry cũ,
`migration.sql`, mockup `.src.html`, dòng `+` ở cột 0) rõ ràng.

Kết luận về phạm vi: **không dịch toàn bộ 159 file sang ngôn ngữ phổ thông.**
ADR và plans tồn tại để người viết mã ra quyết định đúng; làm loãng chúng thì
mất chính xác mà không ai được lợi. Thay vào đó thêm một lớp mỏng ở trên.

## 4. Bốn đợt sửa

| Đợt | Nội dung | Trạng thái |
| --- | --- | --- |
| 1 | Vá thông tin sai (V3, V4, V5) | ✅ 21/09 |
| 2 | Viết lại `docs/README.md` thành bản đồ thật (V1) | ✅ 21/09 |
| 3 | Thêm lớp đọc cho người phổ thông (V2, V6) | ✅ 21/09 |
| 4 | Quy ước độ dài, đánh dấu plan đã đóng (V7) | ✅ 21/09 |
| 5 | Tách `CHANGELOG.md` theo kỷ nguyên, thêm mục lục kể chuyện | ✅ 21/09 |
| 6 | Rà `conventions/`: vá lệch code, tách bàn giao, tách hệ màu | ✅ 21/09 |
| 7 | `snapshots/` có mục lục; `screenshot/` rời khỏi kho mã | ✅ 21/09 |

### Đã làm

**Đợt 1.** Viết lại bảng gói trong `README.md` gốc theo số đo thật (thêm 2 gói
còn thiếu, thêm cột "Là gì" bằng tiếng Việt thường); cập nhật roadmap trong
`CLAUDE.md` và thay đường dẫn Nexora bằng ghi chú "không còn trên máy, đối chiếu
qua `docs/analysis/`"; chuyển `superpowers/plans/2026-08-12-media-write-surface.md`
sang `plans/`, xoá thư mục `superpowers/`.

**Đợt 2.** `docs/README.md` từ 149 KB xuống còn cỡ một phần mười: mỗi ADR một
dòng, cột "Lưu ý" chỉ giữ cảnh báo thật sự nguy hiểm nếu bỏ sót (ADR bị thay,
bị đảo, cột đã xoá). Specs và plans gom theo giai đoạn thay vì bảng dài. Bốn
file mồ côi vào bản đồ. Thêm mục "Bạn đang cần gì?" ở đầu.

**Đợt 3.** Ba tài liệu mới, viết cho người không lập trình:
[overview.md](../overview.md) (sản phẩm, vai người dùng, sáu luồng, sơ đồ bốn
app), [glossary.md](../glossary.md) (khoảng 60 mục chia sáu nhóm),
[open-items.md](../open-items.md) (mốc thời gian, phần chưa xây, việc tay trên hạ
tầng, trỏ về sổ nợ chi tiết).

**Đợt 4.** Thêm luật độ dài vào mục "Quy tắc viết" của bản đồ; gắn header một
dòng lên mỗi plan đã đóng, trỏ về entry CHANGELOG tương ứng.

**Đợt 5.** `CHANGELOG.md` từ 589 KB / 133 entry xuống **60 KB / 17 entry** — chỉ
còn đợt đang chạy từ 15/09. 116 entry còn lại chuyển vào 10 file lưu trữ mới
theo kỷ nguyên (28–75 KB mỗi file), cộng
[mục lục](../changelog/README.md) kể lại 12 giai đoạn bằng ngôn ngữ thường.

Về luật bất biến: **nội dung entry nguyên văn, đã kiểm bằng máy** — ghép 11 file
lại rồi so từng dòng với bản gốc lấy từ git, 6.904 dòng nội dung khớp 100%, đủ
133 entry. Chỗ duy nhất đụng là **89 đường dẫn tương đối**: file xuống sâu một
cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`, đúng như hai file
lưu trữ đợt 03/08 đã làm. Header của hai file cũ tuyên bố "0 ký tự đổi" — không
chính xác, vì chúng cũng đã đổi tiền tố đường dẫn; header mười file mới nói
đúng việc này.

`scripts/docs-freshness.sh` chạy lại vẫn xanh: nó chỉ đọc entry mới nhất, mà
entry đó vẫn nằm đầu `CHANGELOG.md`.

**Đợt 6.** Đọc trọn 12 file `conventions/` và đối chiếu từng khẳng định với mã
nguồn. Bốn file đúng nguyên (`booking-states`, `read-then-write-races`,
`soft-404-loading-tsx`, `supabase-data-api-surface` — kiểm `cancelInLock`,
`vietnamToday`, `FOR UPDATE`, vị trí `loading.tsx`, 36 bảng RLS). Ba việc đã
làm:

- **`mobile-dev-loop.md` §2 viết lại.** Toàn bộ mục đứng trên tiền đề WSL NAT,
  lỗi thời từ 14/09 khi máy dev sang Windows native — nợ do CHANGELOG 16/09 ghi
  nhận, nay trả. Kèm [ADR-0040 AMEND 2](../adr/0040-mobile-app-expo.md) đảo §8:
  `dev` = `expo start` (LAN), thêm `dev:tunnel` cho ba ca còn cần, `dev:lan`
  giữ làm bí danh để lệnh trong spec 08/09 không gãy. Cần thử lại bằng điện
  thoại thật — ghi ở [open-items](../open-items.md).
- **`outbox-dedupe-key.md` vá bốn chỗ**: hai dòng bảng trùng nhau, ví dụ
  `cancellation-denied:` thuộc luồng ADR-0041 đã xoá, tên sự kiện `booking-paid`
  trong khi mã dùng `booking-confirmed`, và thiếu ba dạng đang chạy thật
  (`pwreset`, `email-otp`, `refund`). Thêm bảng "đang dùng thật" đo ngày 21/09.
- **`read-then-write-races.md`** thêm nơi áp dụng thứ ba (`admin-enquiries`,
  W4) — file nói "đã cắn hai lần" nhưng khuôn `FOR UPDATE` nay có ba chỗ dùng.

Hai việc sắp xếp lại:

- **Năm tài liệu bàn giao mobile sang [`docs/handoff/`](../handoff/README.md).**
  Chúng chiếm 45% dung lượng `conventions/` nhưng có hình dạng của plan (chia
  việc, endpoint từng màn) và có ngày hết hạn — dựng xong là thành lịch sử,
  trong khi `booking-states.md` thì mười năm nữa vẫn áp dụng.
- **`color-system.md` tách đôi**: luật đang thi hành (codename không rời kho mã,
  tỷ lệ phối, bộ font, luật hero luôn tối) ở lại `conventions/` còn 4 KB; phần
  nguồn gốc màu, phương pháp đo và ba palette vùng đã rút sang
  [analysis](2026-07-22-color-system-analysis.md), 9 KB. File cũ tự nhận là
  "bản ghi phân tích" — đúng định nghĩa của `analysis/`.

`conventions/` còn **7 file, 41 KB**, mọi file đều là luật thật.

**Đợt 7.** Hai thư mục không phải Markdown.

`docs/snapshots/` (1,7 MB, 28 file JSON, có commit) không có **một dòng giải
thích nào** — nay có [mục lục](../snapshots/README.md): bảy file là gì, ranh
giới với `backups/` (nơi chứa dữ liệu cá nhân, gitignored), lượt nào đang có
hiệu lực và vì sao (`reset-operational-data.mjs` đọc `keep-list.json` ở thư mục
có ngày lớn nhất). Đo được chuyện trùng lặp và ghi luôn vào mục lục để lần sau
không ai hoảng: bốn file `*-ids.json` cộng `site-media-slots.json` giống hệt ở
cả bốn lượt, `media-assets.json` có hai phiên bản, `keep-list.json` có ba, và
lượt `2026-09-18` trùng `2026-09-15` ở cả bảy file. **Không xoá lượt nào** —
mỗi lượt là bằng chứng của một bước đã làm và ba lượt gần nhất được entry
CHANGELOG nhắc đích danh.

`docs/screenshot/` (98 MB, 51 ảnh) **không phải tài liệu**: đó là ảnh tham chiếu
riêng của user, gitignored từ 16/09, dùng để vẽ năm cụm màn mobile — việc đã
đóng ngày 21/09. Đã dời hẳn ra ngoài kho mã sang
`C:\\Programming\\Devs\\Assets\\navel-mobile-reference\\`. Dòng `docs/screenshot/`
trong `.gitignore` giữ lại làm lưới an toàn, ghi chú cập nhật theo.

Cùng đợt: `design/prompts/` là thư mục tồn tại cho đúng một file, nay gộp lên
thành `design/prompt-booking.md`. Giữ lại chứ không xoá vì phần đầu file ghi vì
sao bản thiết kế 03/08 phải sửa (bỏ form thẻ và đặt cọc 20% do thanh toán là
hosted checkout, bỏ khối từng-người-đi vì API chỉ nhận số người) — nhưng bản đồ
nay nói rõ nội dung một-trang của nó đã bị wizard 4 bước thay ngày 19/08. Thói
quen lưu prompt đã dừng sau 04/08, nên thư mục ấy sẽ mãi chỉ có một file.

Một đường dẫn trong entry CHANGELOG 16/09 được sửa theo (`conventions/` →
`handoff/`), cùng nguyên tắc đã dùng ở đợt 5: sửa đường dẫn không phải viết lại
lịch sử. Các plan và spec P5b vẫn trỏ đường cũ ở dạng **văn bản trần** — đó là
mô tả bước thi công đã xong, để nguyên; `handoff/README.md` có ghi chú bắc cầu.

## 5. Đo lại sau khi sửa

| Chỉ số | Trước | Sau |
| --- | ---: | ---: |
| `docs/README.md` | 149 KB | **19,3 KB** (giảm 87%) |
| Dòng dài nhất trong bản đồ | 5.772 ký tự | **195** |
| Độ dài dòng trung bình | 665 ký tự | **68** |
| File ngoài bản đồ | 4 | **0** |
| Trang cho người không lập trình | 0 | **3** (19,3 KB) |
| Mâu thuẫn nội bộ đã biết | 1 | **0** |
| Thông tin sai ở `README.md` gốc | 5 dòng | **0** |
| Link `.md` gãy trong `adr/` | 3 | **0** |
| `docs/CHANGELOG.md` | 589 KB, 133 entry | **60 KB, 17 entry** |
| File lưu trữ changelog | 2 | **12** (max 75 KB) |

Ba trang mới: `overview.md` 7,9 KB · `glossary.md` 7,6 KB · `open-items.md`
3,8 KB. Tổng `docs/` gần như không đổi (4,40 MB → 4,32 MB, 159 → 174 file): năm
đợt này đổi **hình dạng** chứ không cắt nội dung.

## 6. Quyết định còn lại

**Tên file đặt bằng tiếng Anh** (user chốt 21/09). Sáu file đang mang tên tiếng
Việt bỏ dấu (`…-no-ky-thuat`, `…-thi-cong`, `…-cac-phase-con-lai`,
`…-khung-2026` ×2, `…-lich-van-hanh-2026`) **giữ nguyên**: `CHANGELOG.md` trỏ
tới chúng năm chỗ và entry CHANGELOG là bất biến, đổi tên là làm gãy bản ghi
lịch sử. Luật ghi ở mục "Quy tắc viết" của bản đồ, áp cho file sinh ra từ nay.

Ba link `.md` gãy trong `adr/` đã vá: ADR-0025 và ADR-0039 trỏ tới ADR outbox
chưa bao giờ tồn tại (nay trỏ spec P2 §3 W5 và ADR-0039), ADR-0031 gọi sai tên
file ADR-0016. Chùm link thiếu tiền tố `../` trong
`plans/2026-09-15-refund-deadline.md` cũng đã vá (13 chỗ). Sau đợt này **không
còn link `.md` gãy nào trong `docs/`**.

## 7. Phát hiện thêm, chưa xử lý

`plans/2026-08-03-auth-pages-api.md` chứa **một byte NUL thật** ở offset 9460.
Không phải file hỏng: đoạn đó đang liệt kê đầu vào độc hại cần chặn ("ký tự
điều khiển"), và người viết gõ luôn ký tự thật thay vì chuỗi thoát. Hậu quả:
`grep` coi cả file là nhị phân, nên **tài liệu này biến mất khỏi mọi lần tìm
kiếm trong `docs/`**.

Cách vá đề xuất: thay byte NUL bằng chuỗi thoát hai ký tự — hiển thị y hệt, ý
nghĩa không đổi, file trở lại dạng văn bản. Chưa làm vì đụng vào một plan đã
đóng; chờ user quyết.
