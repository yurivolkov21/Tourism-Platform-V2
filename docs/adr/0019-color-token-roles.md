# ADR-0019 — Tách vai token màu: bề mặt, chữ, và ranh giới điều khiển

- **Trạng thái:** Accepted (2026-08-08)
- **Bối cảnh thi hành:** nhánh `feat/account-redesign`, đi trước code theo
  luật CLAUDE.md #5
- **Liên quan:** [design brief §6](../design/claude-design-brief.md) (ngưỡng
  tương phản) · [sổ nợ 06/08 mục A3](../analysis/2026-08-06-backlog-no-ky-thuat.md)
  · commit `cf8f821` (hạ `primary` dark 30/07) · commit `121cff6` (nâng nền
  dark 06/08)

## Bối cảnh

Sổ nợ A3 ghi "`primary` trên nền tối đo được 2.91 và 2.57 — dưới ngưỡng 4.5:1
mà design brief §6 mục 5 đặt ra". Đo lại toàn bộ bằng culori 4.0.2 trên nguồn
`style-dictionary/tokens.mjs` (kẹp về sRGB trước khi tính luminance) cho thấy
sổ nợ **đúng số nhưng sai chuẩn, và đếm thiếu**:

1. **Sai chuẩn.** 2.91 (nút/nền) và 2.58 (nút/card) là cặp **bề mặt** — thuộc
   WCAG 1.4.11 non-text, ngưỡng **3:1**, không phải 4.5:1. Ngưỡng 4.5:1 của
   brief là cho **chữ trên nền**.
2. **Đếm thiếu.** Nhóm thật sự chịu ngưỡng 4.5:1 — `text-primary` dùng làm chữ
   — thì sổ nợ không liệt kê, và đó mới là chỗ tệ nhất: **2.05:1** trên
   `bg-muted`. Tổng cộng 9 cặp trượt ở chế độ tối, không phải 2.

Số đo hiện trạng (dark, nền thật `background` L 0.275 · `card` L 0.309 ·
`muted` L 0.367):

| Cặp | Đo | Ngưỡng | |
| --- | --- | --- | --- |
| `primary-foreground` trên `primary` (nhãn nút) | 4.72 | 4.5 | ✅ |
| `primary` trên `background` (bề mặt nút) | 2.91 | 3.0 | ❌ |
| `primary` trên `card` (bề mặt nút) | 2.58 | 3.0 | ❌ |
| `text-primary` trên `background` | 2.91 | 4.5 | ❌ |
| `text-primary` trên `card` | 2.58 | 4.5 | ❌ |
| `text-primary` trên `muted` | 2.05 | 4.5 | ❌ |
| `ring` trên `card` (vòng focus) | 2.96 | 3.0 | ❌ |

### Vì sao vá tiếp bằng cách chỉnh L không cứu được

`primary` đang gánh **ba vai loại trừ nhau** ở chế độ tối:

- **Bề mặt** — phải đủ TỐI để cõng nhãn gần-trắng (`primary-foreground`).
  Nhãn 4.5:1 ép `L ≤ 0.542`.
- **Chữ** — phải đủ SÁNG để đọc trên nền tối. 4.5:1 trên `muted` đòi
  `L ≥ 0.74`.
- **Vòng focus** — phải đủ SÁNG để nhìn thấy trên `card`. 3:1 đòi `L ≥ 0.60`.

Hai khoảng đầu **rời hẳn nhau** (0.542 < 0.74). Không giá trị L nào thoả cả
hai. Lịch sử repo là chuỗi vá chạy vòng quanh đúng mâu thuẫn này mà chưa gọi
tên nó:

- `cf8f821` (30/07) hạ `primary` dark 0.563 → 0.53 để cứu **nhãn nút**
  (4.11 → 4.72). Đúng cho vai bề mặt, nhưng làm vai chữ tệ thêm.
- `121cff6` (06/08) nâng nền dark L 0.25 → 0.275 theo góp ý "nền tối quá khó
  nhìn". Đúng cho chữ thường, nhưng kéo **bề mặt** nút từ 3.13 xuống 2.91.

Comment tại `tokens.mjs:31-33` đã ghi lại một phương án bị loại: lật
`primary-foreground` dark thành mực tối. Kết luận đó **vẫn đúng và ADR này
không lật lại** — đã đo, kể cả chữ gần-đen L 0.16 trên `primary` sáng cũng chỉ
ra 4.37:1. Nhưng phân tích đó chỉ xét vai *bề mặt*; nó chưa từng xét
`text-primary` làm **chữ thường**, nên không thấy mâu thuẫn ba vai.

### Trôi token chưa ai phát hiện

`cf8f821` hạ `primary` dark nhưng **bỏ quên bốn token soi gương nó**:
`ring`, `sidebar-primary`, `sidebar-ring`, `chart-1` vẫn kẹt ở
`oklch(0.563 0.076 181.3)`. Hệ quả đo được: vòng focus `ring`/`card` = 2.96,
dưới 3:1, ở 24 chỗ dùng `ring-ring`.

Với `ring` thì hướng vá **ngược** với `primary`: nó cần SÁNG HƠN để nổi trên
nền tối, không phải tối hơn. Đây là bằng chứng thứ hai cho thấy gộp chung một
token là sai từ gốc.

## Quyết định

### 1. `primary` giữ đúng MỘT vai: bề mặt

Giá trị không đổi — `oklch(0.494 0.067 184.3)` sáng, `oklch(0.53 0.076 181.3)`
tối. Nhãn nút 4.72 ✅. Không chỉnh L nữa; mọi lần chỉnh trước đây đều là đang
kéo co giữa các vai.

### 2. Thêm token vai CHỮ, chỉ khác ở chế độ tối

Vai chữ cần `L ≥ 0.74` để qua 4.5:1 trên nền tệ nhất (`muted`). Chọn **0.76**
để có đệm, thay vì 0.74 sát mép:

| L | /muted | /card | /nền |
| --- | --- | --- | --- |
| 0.74 | 4.67 ✅ | 5.87 | 6.61 |
| **0.76** | **5.01 ✅** | **6.30** | **7.10** |

Chế độ **sáng giữ nguyên** `oklch(0.494 …)` — đo được 5.57 (nền) · 5.88 (card)
· 4.62 (muted), qua hết. Token này chỉ tồn tại để giải mâu thuẫn ở dark.

### 2b. `destructive` mắc ĐÚNG bệnh đó — tách thêm `destructive-emphasis`

Bổ sung 11/08, phát hiện khi đo lại khu account. ADR gốc chỉ soi `primary`;
`destructive` mang y hệt hai vai loại trừ nhau và chưa ai đo.

| Vai | Ở đâu | Dark L 0.579 | Ngưỡng | |
| --- | --- | --- | --- | --- |
| Bề mặt cõng chữ | badge "−20%" (`bg-destructive` + `text-white`) | 4.62 | 4.5 | ✅ |
| Mực | `text-destructive` trên `background` | 3.19 | 4.5 | ❌ |
| Mực | `text-destructive` trên `card` | 2.83 | 4.5 | ❌ |

Nâng L để cứu vai mực thì giết vai bề mặt — đo chữ trắng trên badge:

| L | chữ trắng/badge | mực/nền | mực/card |
| --- | --- | --- | --- |
| 0.579 (nay) | 4.62 ✅ | 3.19 ❌ | 2.83 ❌ |
| 0.70 | 2.85 ❌ | 5.17 ✅ | 4.59 ✅ |
| **0.72** | 2.64 ❌ | **5.58 ✅** | **4.95 ✅** |

Hai khoảng rời hẳn nhau, đúng hình dạng mâu thuẫn ở mục 1. Nên lời giải cũng là
lời giải ở mục 2: **tách token vai mực**.

- `destructive` giữ nguyên → vai **bề mặt**. Badge giảm giá không đổi một pixel.
- `destructive-emphasis` mới → vai **mực**. Light giữ y hệt `destructive`
  (0.516) vì ở sáng vai mực đã đạt sẵn (nền 5.62 · card 5.93) — tách token
  không đổi gì ở light. Dark chọn **0.72** thay vì 0.70 (4.59 trên card, sát
  mép) để có đệm, cùng lối chọn với `primary-emphasis`.

Quét đổi 34 chỗ `text-destructive` sang token mới trong `apps/web/src` và
`libs/shared/ui/src`. Ba vai KHÁC giữ nguyên `destructive`, đếm được và không
đụng tới: 24 `bg-`, 25 `border-`, 30 `ring-`.

Không có token `destructive-foreground` — không chỗ nào đặt chữ sáng lên nền
`destructive` đặc ngoài badge (dùng `text-white` cứng ở cả hai theme, cố ý, vì
nền badge luôn đỏ đậm). Nên phép tách này không kéo theo token thứ hai.

### 3. `ring` và `sidebar-ring` nâng lên, không hạ xuống

Dark 0.563 → **0.60**: `/card` 2.96 → **3.44** ✅, `/nền` 3.34 → 3.88.
`sidebar-primary` và `chart-1` đồng bộ về đúng vai của chúng (bề mặt → theo
`primary`; chuỗi biểu đồ → giữ thang riêng, không soi gương `primary` nữa).

### 4. Nút primary trên card ở dark: ranh giới do VIỀN mang, không do nền

`primary`/`card` = 2.58 và **không thể** đạt 3:1 bằng cách đổi nền nút (ràng
buộc nhãn ở mục 1). WCAG 1.4.11 chỉ đòi **ranh giới** điều khiển đạt 3:1 — nó
không bắt phần tô phải đạt. Nên ở dark, nút primary nhận một viền hairline lấy
từ thang vai-chữ: `L 0.74` cho `/card` = 5.87 ✅.

Đây cũng chính là hướng comment `tokens.mjs:46` đã nêu ("chữa thật là đổi
`card` dark hoặc cho nút một viền") và trùng với ngôn ngữ hình thức mà mockup
redesign đã chọn — sheet ngăn bằng hairline.

### 5. `border` và `input` KHÔNG cùng một luật

Đo được cả hai đang rất thấp: `border`/card 1.30 (sáng) và 1.28 (tối). Nhưng
hai token này phục vụ hai việc khác nhau:

- **`input`** là ranh giới của một **điều khiển** → thuộc WCAG 1.4.11, phải
  đạt 3:1. Nâng: dark `L ≥ 0.58` (/card 3.08), light `L ≈ 0.66`.
- **`border`** dùng cho đường phân cách và mép thẻ → **trang trí, không thuộc
  1.4.11**. Nâng nó lên 3:1 sẽ biến toàn site thành lưới kẻ ô và phá hỏng
  ngôn ngữ hairline. Giữ vai trang trí, và dùng công thức pha 22% `foreground`
  của mockup khi cần tách bạch thị giác.

Gộp hai token này vào một phép "nâng tương phản" là sai — ghi rõ ở đây để lần
sau không ai vá nhầm.

## Ràng buộc lịch

Đổi token là việc **rẻ nhất ở thời điểm này và đắt dần về sau**:
`libs/shared/mobile-ui` chưa tồn tại và không file nào import
`generated/theme.js`, nên P5 chưa có consumer nào để vỡ. Sau khi P5 mở, mọi
thay đổi token phải đồng bộ hai nền tảng.

Freeze 15/10/2026: sau mốc đó không đổi token nữa.

## Hệ quả

- Phạm vi lan: 98 chỗ `text-primary`, 96 chỗ `bg-primary`, 56 chỗ
  `text-primary-foreground` trong `apps/web/src` và `libs/shared/ui/src`, cộng
  `::selection` và thumb thanh cuộn tự vẽ trong `globals.css`. Phần lớn KHÔNG
  phải sửa — chỉ những chỗ `text-primary` đứng làm chữ mới đổi sang token mới.
- `generated/theme.js` (artifact build, gitignored) sẽ có thêm token; P5 sau
  này nhận sẵn.
- Comment tại `region-hero.tsx:163` ghi "Đo: 4.11:1 ở CẢ hai theme" là số
  **trước** `cf8f821`; đo lại hôm nay là 4.72. Sửa comment cùng đợt này.
- Sổ nợ A3 phải viết lại: nó ghi sai ngưỡng và thiếu 7 cặp.

## Đã cân nhắc và loại

- **Lật `primary-foreground` dark thành mực tối.** Đã đo từ 30/07: trần 4.37:1
  kể cả với chữ gần-đen. Không đạt. ADR này giữ nguyên kết luận đó.
- **Hạ `primary` dark thêm nữa (< 0.53).** Cứu vai chữ thì giết vai bề mặt —
  ở L 0.50 nút/nền rơi xuống 2.75, nút tan vào nền trang.
- **Nâng `border` lên 3:1 cùng `input`.** Loại vì lý do ở mục 5: nó không phải
  yêu cầu WCAG và nó phá ngôn ngữ hairline của mockup.
- **Đổi `card` dark cho nút nổi hơn.** Sẽ kéo theo mọi bề mặt khác và làm lại
  toàn bộ vòng duyệt visual 06/08. Viền nút rẻ hơn nhiều và đạt cùng mục tiêu.

## AMEND 1 — 13/10/2026 (open-items G32, G20): `warning-emphasis` và `success-emphasis`

### Bối cảnh

`warning` và `success` là màu trạng thái, gánh đúng hai vai mà mục 1 và 2b đã tách cho `primary` và
`destructive`: **bề mặt** (`bg-warning` cõng `text-warning-foreground` ở dải nhắc xác minh email,
chip "Limited"; `bg-success` ở thanh bước của admin) và **mực** (`text-warning`, `text-success` làm
chữ, icon, mộc). Vai mực trượt chuẩn, đo bằng cùng cách của ADR này (OKLab sang sRGB, kẹp, độ chói
WCAG) trên nguồn `style-dictionary/tokens.mjs`:

| Token | Theme | /nền | /card | /muted |
| --- | --- | --- | --- | --- |
| `warning` | sáng | 1.90 ❌ | 2.01 ❌ | 1.58 ❌ |
| `warning` | tối | 8.33 | 7.39 | 5.88 |
| `success` | sáng | 3.19 ❌ | 3.37 ❌ | 2.65 ❌ |
| `success` | tối | 5.84 | 5.18 | 4.13 ❌ |

Hình dạng ngược với `primary`: `warning` hỏng ở theme **sáng** (hổ phách quá nhạt trên nền gần
trắng), `success` hỏng ở sáng và ở `muted` tối. Chỗ trượt đã thấy (open-items G32, G20): mộc
`VisaStamp` tông warning ("AWAITING PAYMENT"), huy hiệu warning của accordion My bookings, chữ
"limited" của rail đặt chỗ và khối ảnh, bộ đếm 90% của form review, mộc CONFIRMED (`text-success`
85% chỉ 2.77 trên card sáng), icon cảnh báo ở thanh bên khu sửa tour của admin (~2:1). Icon hạn huỷ
đã qua ở trang chi tiết đơn đang chữa tạm bằng `text-warning-foreground dark:text-warning`, vì không
token nào đạt ở cả hai theme.

Sửa thẳng `warning` thì giết vai bề mặt: dải nhắc vàng cõng chữ mực tối (`warning-foreground` trên
`warning` sáng 7.43), hạ `warning` sáng xuống L 0.5 thì cặp đó còn 2.48. Với `success` thì hai vai
không loại trừ nhau (hạ L sáng còn giúp nhãn trắng trên nền xanh, 3.26 lên 6.18), nhưng sửa thẳng
token sẽ đổi mọi bề mặt và mọi lớp tô pha `success` ở web, admin và mobile (`bg-success/10`, viền
40–55%, thanh bước của admin, hộp "Free cancellation" của app), là một vòng đổi giao diện chưa ai
duyệt sát freeze. Tách token chỉ đổi phần mực.

### Quyết định

Cùng lời giải với mục 2 và 2b: **tách token vai mực**, bề mặt giữ nguyên.

| Token mới | Theme | Giá trị | /nền | /card | /muted | 85% /nền | 85% /card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `warning-emphasis` | sáng | `oklch(0.47 0.095 75)` ≈ #79520A | 6.50 | 6.87 | 5.40 | 4.63 | 4.83 |
| `warning-emphasis` | tối | `oklch(0.82 0.14 80)` (= `warning`) | 8.33 | 7.39 | 5.88 | 6.43 | 5.78 |
| `success-emphasis` | sáng | `oklch(0.46 0.125 145)` ≈ #1D6926 | 6.32 | 6.68 | 5.25 | 4.57 | 4.76 |
| `success-emphasis` | tối | `oklch(0.75 0.15 145)` ≈ #6BC670 | 7.00 | 6.21 | 4.94 | 5.48 | 4.94 |

- Hai cột 85% là mộc: `VisaStamp` mang `opacity-85` cả khối, mộc CONFIRMED của hộ chiếu là
  `text-success/85`. Chữ mộc 13px đậm chưa tới cỡ "chữ lớn" của WCAG nên phải giữ 4.5 cả khi mờ, và
  chính ràng buộc này chọn L sáng: ở L 0.5 mộc warning mờ chỉ còn 4.36 trên card.
- `warning-emphasis` tối giữ Y HỆT `warning` vì vai mực ở tối đã đạt; tách token không đổi pixel nào
  ở tối. Sáng L 0.47, hue 80 → 75 vì ở L thấp hue 80 ngả màu ô liu; chroma 0.095 nằm trong gam
  sRGB (0.1 ở L 0.47 đã ra ngoài gam).
- `success-emphasis` khác ở cả hai theme: sáng L 0.46, tối L 0.75 (sàn 0.725 cho 4.5 trên `muted`).
- Mộc không đứng trên `muted`, nên cột `muted` chỉ tính cho mực không mờ (4.02–4.72 ở 85% trên
  `muted` là con số không dùng tới).

### Phạm vi

- Mọi `text-warning` và `text-success` đứng làm mực trên nền ở `apps/web/src` (chữ, icon, mộc) đổi
  sang token mới; mộc đổi cả `border-*` sang cùng mực để viền và chữ của mộc vẫn một màu. `bg-*`
  và `border-*` của huy hiệu giữ token bề mặt.
- Gỡ chữa tạm `text-warning-foreground dark:text-warning` của icon hạn huỷ.
- Admin (G20): icon cảnh báo và icon xong ở thanh bên khu sửa tour, chữ "good" của thẻ số liệu, nút
  duyệt tông success.
- Mobile không đổi trong đợt này: `MOBILE_COLOR_KEYS` là danh sách chọn lọc; mobile dùng `success`
  và `warning` ở chỗ nào làm mực thì là việc riêng của app.
- Bản in (`print-doc`) không dùng `success` từ G40 (mộc confirmed là teal `primary`), nên không đổi.
- Freeze 15/10/2026 vẫn giữ: AMEND này phải lên `main` trước mốc đó, không thì để sau capstone.

## AMEND 2 — 13/10/2026 (open-items G46): `destructive-emphasis` tối lên L 0.77

### Bối cảnh

Mục 2b chọn `destructive-emphasis` tối `oklch(0.72 0.148 26.7)` khi chỉ đo nền và card. Viết test
4.5:1 cho AMEND 1 thì thấy trên `muted` nó chỉ đạt 3.94 (G46). Soát chỗ dùng (13/10) chưa thấy câu lỗi
nào đặt thẳng trên `bg-muted`, nhưng lại thấy một chỗ trượt thường gặp hơn: nút và huy hiệu biến thể
`destructive` của `@tourism/ui` (`button.tsx`, `badge.tsx`, `bubble.tsx`) đặt mực này lên lớp tô
`dark:bg-destructive/20`. Đo bằng cách trộn alpha trong sRGB như trình duyệt vẽ:

| Mực tối | /nền | /card | /muted | /card + đỏ 20% | /card + đỏ 30% (hover) |
| --- | --- | --- | --- | --- | --- |
| `oklch(0.72 0.148 26.7)` (nay) ≈ #F37C71 | 5.58 | 4.95 | 3.94 ❌ | 4.21 ❌ | 3.82 ❌ |
| `oklch(0.76 0.13 26.7)` | 6.51 | 5.78 | 4.60 | 4.91 | 4.46 ❌ |
| **`oklch(0.77 0.13 26.7)`** ≈ #FC9287 | **6.75** | **5.99** | **4.77** | **5.09** | **4.62** |

Nút xoá tour, xoá bài viết, từ chối review, bỏ thay đổi chưa lưu ở admin và nút xoá tài khoản ở
web đều là biến thể này, nên chữ của chúng ở theme tối đang dưới chuẩn ngay ở trạng thái thường.

### Quyết định

`destructive-emphasis` tối đổi thành `oklch(0.77 0.13 26.7)`. Sáng giữ nguyên `oklch(0.516 0.136
27.3)` (nền 5.62, card 5.93, muted 4.66, card cộng đỏ 10% là 5.13).

- Chroma hạ 0.148 → 0.13 vì ở L 0.77 chroma 0.148 ra ngoài gam sRGB; hue giữ 26.7.
- Chọn 0.77 chứ không phải 0.76: ở 0.76 chữ của nút lúc hover chỉ 4.46.
- `destructive` (vai bề mặt) không đổi, nên badge giảm giá và lớp tô đỏ giữ nguyên từng pixel.
- Thấy đổi: ở theme tối mọi chữ đỏ (lỗi form, nút xoá, cảnh báo huỷ) sáng hơn một bậc và ngả hồng
  cam. Theme sáng không đổi.
- Mobile đọc cùng token (`MOBILE_COLOR_KEYS` có `destructive-emphasis`), nên chữ đỏ ở theme tối của
  app cũng sáng hơn khi app build lại.
- `tokens.spec.ts` thêm `destructive-emphasis` vào phép thử 4.5:1 trên nền, card và muted của AMEND 1.

### Chưa làm

Ở theme sáng, nút biến thể `destructive` lúc hover (`hover:bg-destructive/20`) cho chữ 4.40 trên
card và 4.19 trên nền. Đây là trạng thái thoáng qua và ngoài G46; ghi thành mục riêng trong
open-items.
