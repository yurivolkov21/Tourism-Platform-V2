# ADR-0015 — Rút lớp tint theo vùng, trang vùng dùng bảng màu brand

- **Trạng thái:** accepted (user chốt 29/07/2026)
- **Đảo một phần:** [ADR-0013](0013-wuling-theme-tokens.md) mục 3 và 4
- **Bối cảnh thi hành:** cụm Destinations, nhánh `feat/destinations-pages`

## Bối cảnh

ADR-0013 dựng một lớp tint theo vùng: `regionDefaults` ở `:root` cộng ba khối
override `[data-region='north' | 'central' | 'south']`, mỗi vùng 6 slot
(`--region-primary/-deep/-surface/-spark/-on-surface`, và `--region-hero` thêm ở
Task 1 của cụm này). Ý đồ là ba trang vùng mang ba sắc riêng, thứ Nexora không có.

Dựng xong và xem thật, user bác: ba sắc làm **giao diện mất đồng nhất** với phần
còn lại của site, và màu **không phải** đòn bẩy đúng để tạo bản sắc vùng.

## Hai sự thật đo được, quyết định hình dạng của việc rút

**1. Giá trị `:root` của lớp region trùng KHÍT brand token — nhưng chỉ ở light.**

| `--region-*` tại `:root` | Trùng |
| --- | --- |
| `primary` `oklch(0.494 0.067 184.3)` | `--primary` |
| `surface` `oklch(0.914 0.01 174.3)` | `--secondary` · `--muted` |
| `deep` `oklch(0.411 0.053 184.5)` | `--secondary-foreground` |
| `spark` `oklch(0.731 0.13 73.3)` | `--rating` |
| `hero` `oklch(0.25 0.015 181.5)` | `--hero` |

Lớp `--region-*` khai **ngoài mọi scope `.dark`** nên bất biến theo theme, còn
brand token thì lật (`--primary` ở dark là `oklch(0.563 0.076 181.3)`). Vì vậy
**chỉ xoá ba khối override là chưa đủ**: trang vùng sẽ đúng màu ở light nhưng ở
dark vẫn dùng giá trị light-brand. Component phải trỏ **thẳng** vào token brand.

**2. `--region-*` còn phục vụ 8 file KHÔNG liên quan tới vùng.**
`home/gallery.tsx` · `about/about-timeline.tsx` · `about/about-gallery.tsx` ·
`auth/auth-screen.tsx` · `auth/password-strength-field.tsx` · `home/contact.tsx` ·
`contact/contact-cta.tsx` · `destinations-menu.tsx`. Những trang đó không có tổ
tiên `data-region` nên vốn đã đọc `:root` — chúng đang dùng lớp này như một **bảng
màu phụ**, không phải như tint vùng.

## Quyết định

1. **Xoá ba khối `[data-region='north' | 'central' | 'south']`** khỏi
   `tokens.mjs`. `regionDefaults` (giá trị `:root`) **giữ nguyên**.
2. **Component của trang vùng trỏ thẳng vào token brand** (`--primary`, `--hero`,
   `--secondary`, `--rating`…) thay vì `--region-*`, để chúng lật theo theme.
3. **Giữ họ `--region-*`** cho 8 file ở Home/About/Auth/Contact — không một trang
   đã duyệt nào đổi một pixel.
4. **Đồng nhất hero cả ba vùng**: bỏ khác biệt `heroMinH` và `scrim` theo vùng.
5. Bản sắc vùng từ nay do **cấu trúc** gánh, không do màu: ba khu chữ ký khác hẳn
   nhau (mùa-đi 12 tháng · timeline 3 chặng · 3 bưu thiếp) cộng copy riêng.

## Vì sao chọn hình dạng này thay vì xoá hẳn họ token

Xoá hẳn `--region-*` sạch hơn về mặt đặt tên, nhưng phải sửa 8 file trên các trang
**đã duyệt** rồi chụp và đo lại toàn bộ chúng — rủi ro lan xa mà không phục vụ mục
tiêu user nêu. Cái giá phải trả và ghi nhận: **tên `--region-*` từ nay sai nghĩa ở
8 file đó** (chúng chẳng liên quan gì tới vùng). Đổi tên thành thứ như
`--accent-alt` là việc dọn riêng, ghi thành nợ.

## Hệ quả

- Ba băng vùng ở `/destinations` và ba tiêu đề trong dropdown navbar **cũng mất
  màu riêng** — chúng đặt `data-region` nên phụ thuộc chính ba khối vừa xoá. Đây là
  hệ quả có chủ ý, thuận với lý do "đồng nhất giao diện".
- **Xoá luôn một họ lỗi.** Năm lỗi tương phản của cụm này đều cùng gốc: ghép token
  cố định (`--region-*`, `--on-media`) với token theo-theme (`--foreground`,
  `--background`). Khi trang vùng dùng toàn token brand, cả hai vế cùng lật nên
  lớp lỗi ấy không còn đất sống. Nhưng **trong lúc di trú thì rủi ro cao nhất**:
  mỗi cặp nền/chữ phải được kiểm lại xem hai vế có cùng hành vi theo theme không.
- `data-region` trên wrapper trang vùng thành vô dụng; `region-theme.ts` rụng hai
  field. Cả hai phải xoá chứ không để lại code chết.
- `tokens.spec.ts` có các test khẳng định "ba vùng đủ 6 slot", "ba hero cùng bậc
  tối", "ba hero khác nhau" — những bất biến đó **không còn tồn tại**, phải xoá
  hoặc thay bằng bất biến mới.

## Bất biến mới đáng canh

Thay cho các test cũ: **ba trang vùng dùng CÙNG một bảng màu**, và **không token
`--region-*` nào còn được tham chiếu trong `components/destinations/region-*`**.
