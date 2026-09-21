# Hệ màu — luật đang thi hành

> Chỉ những điều **còn hiệu lực mỗi lần dựng trang mới**. Chuyện màu từ đâu ra,
> đo thế nào, và ba palette vùng đã rút nằm ở
> [bản ghi phân tích](../analysis/2026-07-22-color-system-analysis.md).
>
> Giá trị máy-đọc-được ở `@tourism/tokens` — nguồn sự thật khi hai bên lệch.
> Luật `tokens-only, không hex` ở [CLAUDE.md](../../CLAUDE.md) §6.

## Tên codename không được rời khỏi kho mã

Hệ màu lấy cảm hứng từ một trò chơi; các tên **Wuling · Arcane · Tangtang ·
Gilberta** là **codename nội bộ**, chỉ xuất hiện trong tài liệu và tên token.

**Tuyệt đối không** đưa chúng — hay art, logo, asset nào của trò chơi đó — vào
bất cứ thứ gì người dùng thấy. Màu sắc không có bản quyền, tên gọi thì có. Copy
sản phẩm gọi ba vùng là North / Central / South Vietnam.

## Tỷ lệ phối

Sương ~62% · celadon ~16% · ngọc ~12% · mực ~6% · đỏ và vàng vài %.
**Cái đẹp nằm ở liều lượng, không ở mã màu lẻ.**

Vùng **không bao giờ** đụng nút, chữ hay form — đó là lãnh thổ của brand.

## Font (chốt 22/07/2026 — xem ADR-0013)

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


## Bề mặt hero — token `hero`

**Luật: hero LUÔN là mảng tối nhất của trang, ở cả hai chế độ màu.**

| | Hero | Nền trang | Card |
| --- | --- | --- | --- |
| Light | `oklch(0.25 0.015 181.5)` | `0.977` | `0.996` |
| Dark | `oklch(0.17 0.019 182.5)` | `0.25` | `0.309` |

Thứ bậc hero → trang → card giữ nguyên chiều ở cả hai chế độ, chỉ dịch cả thang.

**Vì sao có token này.** Trước 27/07 hero không có token riêng: nó mượn
`background` bên trong một scope `dark`. Light mode ổn, nhưng dark mode nền
trang ĐÃ là `0.25` nên hero trùng màu tuyệt đối và biến mất — đo được
`lab(13.19 -5.13 -0.19)` cho cả hero lẫn nền, trên `/tours`, `/blog` và `/faq`.

**Vì sao KHÔNG đảo thành hero sáng ở dark mode.** Navbar lúc chưa cuộn dùng
`on-media`, token cố ý không lật theo theme (*"the scrim is always dark, so this
must NOT flip"*). Nền hero sáng làm chữ navbar tàng hình — đúng lý do luật
"hero luôn tối" ra đời ở `/contact`. Muốn đảo thì phải cho navbar biến thể theo
từng trang; cái giá đó không đáng cho một thay đổi thị giác.

**Cách dùng.** Đặt `bg-hero text-hero-foreground` trên `<section>` (đọc theme
CỦA TRANG), rồi bọc nội dung trong `<div className="dark contents">` để chữ
luôn sáng. **Không** đặt `dark` lên chính section — đó chính là cái đã gây lỗi:
`bg-background` khi đó bị đọc trong scope dark. `contents` để wrapper không tạo
hộp; biến CSS vẫn kế thừa bình thường qua `display:contents`.

Vân topo đặt NGOÀI scope dark để biến thể `dark:` đọc được theme trang —
`opacity-[0.12]` sáng, `dark:opacity-[0.2]` tối, vì nền tối hơn thì vân phải
đậm lên mới đọc được.

