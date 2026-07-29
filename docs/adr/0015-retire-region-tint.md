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

**2. Lớp region có HAI nhóm consumer khác hẳn nhau — và ranh giới không nằm ở
chỗ ban đầu tưởng.**

> ⚠️ **Đính chính (29/07, trước khi viết dòng code nào).** Bản nháp ADR này khẳng
> định 8 file ngoài trang vùng "không có tổ tiên `data-region` nên không đổi một
> pixel". **Sai** — phép grep dựng nên khẳng định đó lỗi cú pháp glob và bị đọc
> thiếu. Đo lại bằng bản đồ di trú 56 điểm:

| Nhóm | File | Có `data-region`? |
| --- | --- | --- |
| **Ăn tint thật** | `home/gallery.tsx:99` (từng thẻ địa điểm) · `about/about-timeline.tsx:66,89,207` (từng mốc) · `about/about-gallery.tsx:42` · `destinations-menu.tsx:49` · `region-group.tsx:35` · trang vùng | **CÓ** |
| **Chỉ mượn bảng màu** | `auth/auth-screen.tsx` · `auth/password-strength-field.tsx` · `home/contact.tsx` · `contact/contact-cta.tsx` | không |

Nhóm một **thật sự đổi giao diện** khi rút tint: thẻ địa điểm ở Home mất sắc riêng
(miền Nam đang là nâu đất `oklch(0.661 0.052 51.2)`), bốn mốc ở About timeline về
cùng một jade thay vì bốn màu. Nhóm hai đọc `:root` nên không đổi gì.

## Quyết định

1. **Xoá ba khối `[data-region='north' | 'central' | 'south']`** khỏi
   `tokens.mjs`. `regionDefaults` (giá trị `:root`) **giữ nguyên**.
2. **Component của trang vùng trỏ thẳng vào token brand** (`--primary`, `--hero`,
   `--secondary`, `--rating`…) thay vì `--region-*`, để chúng lật theo theme.
3. **Rút tint TOÀN SITE** (user chốt sau khi biết đính chính trên): Home và About
   cũng chuyển sang token brand. Chấp nhận **hai trang đã duyệt đổi giao diện** —
   phải chụp và đo lại cả hai như một phần của việc này.
4. **Giữ `regionDefaults` ở `:root`** cho 4 file nhóm hai (auth ×2, home/contact,
   contact-cta). Chúng không dùng tint, chỉ mượn giá trị; đụng vào là mở rộng
   phạm vi mà không phục vụ mục tiêu nào.
5. **Đồng nhất hero cả ba vùng**: bỏ khác biệt `heroMinH` và `scrim` theo vùng.
6. **Nền hero đổi sang `bg-hero` + `TopoPattern`**, bỏ nền gradient `RegionTile` —
   đúng khuôn mọi hero khác của site (`/tours`, `/contact`, `/destinations`).
7. Bản sắc vùng từ nay do **cấu trúc** gánh, không do màu: ba khu chữ ký khác hẳn
   nhau (mùa-đi 12 tháng · timeline 3 chặng · 3 bưu thiếp) cộng copy riêng.

## Vì sao hero phải bỏ nền gradient, không chỉ đổi token

Đo được trên bản đồ di trú: `RegionTile` làm nền hero nằm **trong scope `.dark`**,
nên sau khi bỏ token vùng thì brand token bị ghim bảng TỐI ở **cả hai theme** —
gradient ra `oklch(0.799 …)`, tức **nhạt**. Hero từ tối hoá sáng, lớp scrim mất
đối tượng để phủ, và navbar chưa-cuộn (chữ `on-media` trắng) thành tàng hình —
đúng luật "hero luôn tối" mà site giữ từ `/contact`. Thêm một lỗi hue: map 1-1
`--region-deep` → `--secondary-foreground` khiến stop thứ hai nội suy qua **123°,
xanh ô liu**, một sắc không có ở đâu trong brand.

## Vì sao không xoá hẳn họ token

Xoá hẳn `--region-*` sạch hơn về đặt tên, nhưng còn 4 file nhóm hai đang dùng nó
như bảng màu phụ, và chúng nằm trên trang auth/contact đã duyệt. Cái giá ghi nhận:
**tên `--region-*` từ nay sai nghĩa ở 4 file đó**. Đổi tên (ví dụ `--accent-alt`)
là việc dọn riêng — ghi thành nợ, không làm ở đây.

## Hệ quả

- Ba băng vùng ở `/destinations`, ba tiêu đề trong dropdown navbar, **thẻ địa điểm
  ở Home, bốn mốc ở About timeline và chấm ở About gallery** đều mất màu riêng —
  chúng đặt `data-region` nên phụ thuộc chính ba khối vừa xoá. Có chủ ý, thuận với
  lý do "đồng nhất giao diện".
- **Ba rủi ro cao đã đo, phải xử trong lúc di trú, không được map 1-1:**
  1. Nút/chip nền `--primary` với chữ `on-media` rơi từ 4.84–8.88:1 xuống
     **4.18:1** ở 5 chỗ. Bối cảnh: 4.18 **đúng bằng** cặp `bg-primary` /
     `primary-foreground` mặc định của site ở dark — ta *thừa kế* lỗi toàn site đã
     ghi nợ, không tạo lớp lỗi mới. Vẫn phải đo lại và ghi số.
  2. `RegionTile` gradient — xem mục hero ở trên; icon `on-media/70` trên gradient
     lật theo theme đo **1.74:1 ở dark**.
  3. Công thức nền băng `color-mix(--region-surface, --background 88%)` được canh
     cho một token surface **sáng, bất biến**; thay bằng token lật thì phép pha tự
     triệt tiêu — ở dark ΔL chỉ còn **+0.014**, ba băng Signature gần như biến mất.
     Phải chỉnh lại tỉ lệ hoặc dùng thẳng `bg-muted`, rồi đo.
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
