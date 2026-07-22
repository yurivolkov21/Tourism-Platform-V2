# Hệ màu tourism-v2 — nguồn gốc, số đo, và giá trị đã chốt

> Chốt 22/07/2026 cùng user sau 6 vòng demo trực quan. File này là **bản ghi
> phân tích** (từ đâu ra, đo thế nào, đổi gì, vì sao); giá trị máy-đọc-được nằm
> trong `@tourism/tokens` (nguồn sự thật khi hai bên lệch — sửa file này theo code).

## 1. Nguồn cảm hứng & ghi chú pháp lý

Toàn bộ hệ màu lấy cảm hứng từ **Arknights: Endfield** (Hypergryph/GRYPHLINE) —
game user chơi và chọn làm chất liệu thẩm mỹ:

| Hệ | Nguồn trong game | Vai trò trong sản phẩm |
| --- | --- | --- |
| Brand "Wuling" | Map **Wuling** (thung lũng Jingyu — sương, rừng trúc, sông ngọc, "tranh thủy mặc") | Palette chính, ~90% giao diện mọi trang |
| Vùng **Bắc** | Operator **Arcane** (bản 1.4, 16/07/2026 — đội trưởng đặc nhiệm Yinglung, Bắc Wuling) | Tint vùng ~10% |
| Vùng **Trung** | Operator **Tangtang** | Tint vùng ~10% |
| Vùng **Nam** | Operator **Gilberta** | Tint vùng ~10% |

**Pháp lý (định hướng thương mại):** chỉ lấy cảm hứng **giá trị màu** (màu sắc
không có bản quyền); TUYỆT ĐỐI không dùng tên "Wuling"/"Arcane"/… , art, logo
hay asset nào của game trong sản phẩm user-facing. Các tên này chỉ là **codename
nội bộ** trong docs/tokens. Copy sản phẩm gọi vùng là North/Central/South Vietnam.

## 2. Phương pháp đo

- Ảnh nguồn: screenshot Wuling (PowerPyx, YouTube thumbnail) + card art 3 operator
  (CDN Prydwen), tải 22/07/2026.
- Trích màu bằng script sharp (quantize bin 32-mức/kênh, bỏ nền trong suốt/trắng,
  crop lề né HUD): **dãy chất liệu** = cụm theo % diện tích (tạo "không khí");
  **dãy điểm sắc** = cụm có độ bão hòa cao (tạo "cá tính").
- Nguyên tắc chốt: lấy **tín hiệu mạnh nhất trong bản raw** của mỗi nguồn làm
  chủ đạo; thuần hóa **tối thiểu** — chỉ sửa màu thực sự không dùng được trên
  web (đã đánh dấu ⚠ bên dưới), theo yêu cầu giữ chất gốc của user.

## 3. Brand — Wuling (mọi trang)

Số đo gốc đáng chú ý: nước sông `#526D6E`/`#57696B` · sương `#FBFBFA` · khói
`#CED1D0` · trúc `#345148` · mực `#1B2B2B` (giữ nguyên bản) · đêm `#131917`.

Giá trị chốt (⚠ = đã chỉnh so với đo, kèm lý do):

| Vai trò | Giá trị | Ghi chú |
| --- | --- | --- |
| Primary — ngọc bích trầm | `#2E6E66` | ⚠ nâng chroma nhẹ từ `#526D6E` (màu bị sương "đè", lên UI quá xám) |
| Primary hover/đậm | `#24544E` | dẫn xuất |
| Nền sáng — sương | `#F5F8F7` | từ `#FBFBFA` phớt lục |
| Card/paper | `#FDFEFD` | |
| Celadon muted (chip, dải section) | `#DCE5E2` | từ khói `#CED1D0` |
| Border — gỗ bạc | `#AEBBB8` | từ gỗ `#899092` |
| Chữ phụ | `#4F605C` | ⚠ đậm hơn một nấc sau feedback contrast (22/07) |
| Chữ chính — mực tàu | `#1B2B2B` | đo nguyên bản |
| Dark: nền — đêm trúc | `#1A2422` | ⚠ nâng sáng từ `#131917` đo được — bản gốc "ngột ngạt" trên UI (feedback user) |
| Dark: surface | `#243430` | ⚠ cùng lý do |
| Dark: border | `#3A4D47` | |
| Dark: chữ chính/phụ | `#DCE8E4` / `#9DB3AC` | |
| Đỏ sơn mài (destructive, flag) | `#A8423A` | từ dây buộc cầu/đèn lồng |
| Vàng hổ phách (CHỈ rating ★) | `#D99A3D` | từ đuốc |

Tonal ramp (cho tokens): ngọc `#EDF4F2 · #C9DDD9 · #8FBAB2 · #4C8D83 · #2E6E66 ·
#24544E · #1B3B36`; trung tính `#F5F8F7 · #DCE5E2 · #AEBBB8 · #7D8F8B · #4F605C ·
#2C3B39 · #1B2B2B`.

Tỷ lệ phối chuẩn (đúc kết từ demo landing được duyệt): sương ~62% · celadon ~16%
· ngọc ~12% · mực ~6% · đỏ/vàng vài %. **Cái đẹp nằm ở liều lượng, không ở mã lẻ.**

## 4. Ba vùng — luật 90/10

Vùng KHÔNG BAO GIỜ đụng nút/chữ/form (lãnh thổ brand). Mỗi vùng chỉ được:
hero trang vùng, eyebrow, chip vùng, tint ảnh card. Cả ba vùng cộng lại chỉ
thêm ~12 giá trị token (không phải 3 palette đầy đủ).

### Bắc — codename Arcane (sương núi, đá vôi: Hạ Long/Sa Pa/Hà Giang)

Raw: bạc `#E8E6E8→#8B8D96` · navy `#151928`/`#2D374A` · họ thép `#33516B·#4E728B·#528994` · tím mắt `#6E63C8` · dây đỏ (quá nhỏ, bỏ).

| Vai trò vùng | Chốt | So với raw |
| --- | --- | --- |
| Chủ đạo — thép sương núi | `#4E728B` | nguyên bản |
| Đậm (hover/đáy gradient) | `#33516B` | nguyên bản |
| Nền vùng — bạc titan | `#CECFD4` | nguyên bản |
| Chấm nhận diện — tím | `#6E63C8` | nguyên bản |

### Trung — codename Tangtang (hoàng thành Huế: vàng hoàng gia trên đỏ tía)

Raw: trắng phớt hồng `#EDD4D3`/`#ECE5E7` · graphite `#2D3132` · vàng chanh
`#FAEB0B→#D1B30D` · đỏ rượu `#4F0B0D→#8F0D11` · periwinkle `#7287B3` (không dùng —
nhường xanh cho Bắc).

| Vai trò vùng | Chốt | So với raw |
| --- | --- | --- |
| Chủ đạo — đỏ rượu hoàng thành | `#8F0D11` | nguyên bản |
| Vàng hoàng gia (liều nhỏ) | `#D8BE12` | ⚠ hạ một nấc từ `#EBD109` — vàng neon phát sáng trên màn hình, không đọc được lâu |
| Nền vùng — trắng phớt hồng | `#EDD4D3` | nguyên bản |
| Chữ trên nền vùng — graphite | `#2D3132` | nguyên bản |

Bài học ghi lại: bản thuần hóa đầu tiên (kéo vàng về `#E0B23F` đất) làm mất
"chất Tangtang" — user bắt được. Vàng phải giữ họ chanh-hoàng-gia, chỉ hạ độ chói.

### Nam — codename Gilberta (Mekong: phù sa + gạch nung Mang Thít)

Raw: nâu `#312D2D→#AD8A77` (chất liệu áp đảo) · đỏ son `#EA140D→#AF1B10` ·
nâu đỏ `#6F3029`.

| Vai trò vùng | Chốt | So với raw |
| --- | --- | --- |
| Chủ đạo — nâu phù sa | `#8D6A58` | nguyên bản |
| Điểm rực — đỏ gạch nung | `#AF1B10` | nguyên bản (cụm gạch, không lấy `#EA140D` sân khấu) |
| Nền vùng — nâu sáng | `#AD8A76` | nguyên bản |
| Đậm (hover/đáy gradient) | `#6F3029` | nguyên bản |

## 5. Lịch sử phân tích (tóm tắt các vòng)

1. Đề xuất 3 hướng brand trừu tượng → user chọn rebrand, gợi nguồn Wuling.
2. Đo Wuling từ screenshot → demo phối tỷ lệ → fix bug hero + nâng sáng dark mode.
3. Landing demo Wuling ("tạm ổn") → thử theo character Arcane → user mở rộng
   thành brand + 3 vùng theo 3 nhân vật tự chọn.
4. Tôi từng đề xuất hoán đổi Trung↔Nam khi nhìn qua lăng kính thuần-hóa;
   xem lại bằng bản RAW thì phân công gốc của user đúng hơn (vàng+đỏ rượu = Huế;
   nâu+gạch = Mekong) → rút đề xuất. **Bài học: phân tích màu phải bắt đầu từ
   nguyên bản, thuần hóa là bước cuối và tối thiểu.**
5. User chốt bộ chủ đạo vùng chọn từ raw (22/07/2026).

Trang trực quan đã dùng khi chốt (artifact private của user, giữ làm tham chiếu):
bảng so màu/mock · landing Wuling · landing Arcane · landing lai · bảng 4 hệ ·
bảng màu gốc + chủ đạo vùng.

## 6. Font (chốt cùng đợt — xem ADR-0013)

Chốt sau 2 vòng specimen (22/07/2026) — cả ba đều có subset `vietnamese`:

- **Heading + journal: Literata** — serif đọc hiện đại (gốc font sách Google
  Play Books), bền ở cả cỡ lớn lẫn tên tour trong card. User chọn trực tiếp.
- **Sans (thân + UI): Archivo** — grotesque x-height cao, chắc khỏe, giọng
  "editorial" ghép tự nhiên với Literata.
- **Mono (mã đặt chỗ, số kỹ thuật): IBM Plex Mono** — cùng khí chất kỹ thuật
  với Archivo, phân biệt 0/O 1/l rõ, hiển thị được tiếng Việt trong mã vé.
- Nạp qua `next/font/google`, expose biến `--font-sans`/`--font-heading`/
  `--font-mono` — typeset.css và shadcn theme ăn theo tự động.
- Lịch sử: đề xuất ban đầu Be Vietnam Pro + Lora (+ Geist Mono) chạy tạm từ
  ADR-0013 tới khi user duyệt specimen và đổi sang bộ trên.
