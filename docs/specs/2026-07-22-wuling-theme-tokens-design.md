# Spec — Theme Wuling vào `@tourism/tokens` + wire UI + fonts (2026-07-22)

Quyết định nền: [ADR-0013](../adr/0013-wuling-theme-tokens.md). Giá trị màu chốt:
[conventions/color-system.md](../conventions/color-system.md). Đây là task treo
"wire theme-tokens" của P3b (ADR-0011 #4).

## Mục tiêu

Web (và admin sau này) render đúng brand Wuling ở cả light/dark, sẵn slot tint
3 vùng, font thật có tiếng Việt — tất cả từ MỘT nguồn `@tourism/tokens`.

## Không thuộc phạm vi

- KHÔNG dựng trang vùng (chỉ chuẩn bị slot `data-region`).
- KHÔNG biến thể dark cho region tint (hoãn — ADR-0013 #3).
- KHÔNG đụng mobile/rn-convert (P5 dùng sau; không phá test sẵn có).
- KHÔNG đổi cấu trúc pipeline Style Dictionary.

## Thay đổi theo file

| File | Thay đổi |
| --- | --- |
| `libs/shared/tokens/style-dictionary/tokens.mjs` | Thay giá trị màu brand (light+dark, oklch quy đổi từ hex chốt bằng culori) · cập nhật `fonts` comment (Lora) · thêm export `regions` (north/central/south × 5 slot) + `regionDefaults` |
| `libs/shared/tokens/style-dictionary/build.mjs` | Emit thêm: `--region-*` default trong `:root` + ba khối `[data-region='…']` |
| `libs/shared/tokens/src/lib/tokens.ts` | Thay stub: export `REGIONS`, type `Region`, (giữ API nhỏ — chỉ thứ FE cần) |
| `libs/shared/tokens/src/lib/tokens.spec.ts` | Thay test stub bằng test thật (TDD — xem Kiểm thử) |
| `libs/shared/ui/src/styles/globals.css` | Thêm `@import "@tourism/tokens/tokens.css"` (sau shadcn, trước typeset) · XÓA khối `@theme inline` + `:root` + `.dark` neutral (tokens.css thay thế) · giữ `@custom-variant dark` + `@layer base` |
| `libs/shared/ui/package.json` | dependency `"@tourism/tokens": "workspace:*"` |
| `apps/web/src/app/layout.tsx` | `next/font/google`: Be Vietnam Pro (`--font-sans`) + Lora (`--font-heading`), gắn class lên `<html>`/`<body>` |
| `apps/web/package.json` | (chỉ nếu thiếu) dependency workspace `@tourism/tokens` không cần — ăn qua CSS của `@tourism/ui` |

## Giá trị (tham chiếu color-system.md — hex chốt, quy đổi oklch lúc author)

- Brand light/dark: bảng §3 (background/foreground/card/popover/primary/
  secondary/muted/accent/destructive/border/input/ring/sidebar\*/chart\*).
  Semantic giữ cấu trúc Nexora: `rating` → hổ phách `#D99A3D`; `success/warning/
  info` giữ nguyên (functional, không thuộc "gu" brand); `on-media`/`scrim`/
  `media-tint` đổi hue sang họ ngọc Wuling (180) giữ nguyên độ sáng/alpha.
  Chart ramp: `#2E6E66 · #4E728B · #D99A3D · #A8423A · #8D6A58` (5 hue brand+vùng).
- Region slots (§4): north `#4E728B/#33516B/#CECFD4/#6E63C8`; central
  `#8F0D11/#700D11/#EDD4D3/#D8BE12`; south `#8D6A58/#6F3029/#AD8A76/#AF1B10`;
  `--region-on-surface` mỗi vùng = màu chữ đọc được trên `--region-surface`
  (north `#33516B` · central `#2D3132` · south `#3F2822`).
  Default (`:root`): `#2E6E66/#24544E/#DCE5E2/#D99A3D/#24544E` (brand).
- Radius: giữ `0.375rem` (refined) — không đổi trong đợt này.

## Kiểm thử (TDD trên logic thuần — luật #4)

`tokens.spec.ts` viết TRƯỚC khi sửa tokens.mjs:

1. Mọi token màu có `value` + `darkValue` parse được bằng culori (không undefined/NaN).
2. `regions`: đúng 3 vùng north/central/south, mỗi vùng đủ 5 slot, cùng bộ key
   với `regionDefaults`.
3. Brand primary (light) nằm trong họ ngọc: hue oklch ∈ [170, 195], chroma ≤ 0.09
   (chặn regression "đổi brand nhầm").
4. `REGIONS` (src/lib/tokens.ts) khớp key của `regions` trong tokens.mjs.
5. rn-convert specs sẵn có phải tiếp tục xanh (có 1 test "emerald primary
   green-dominant" theo brand cũ → được PHÉP sửa theo brand mới, ghi chú rõ).

## Nghiệm thu

1. `pnpm turbo run build --filter=@tourism/tokens` → generated/tokens.css chứa
   `--primary: oklch(…)` (hue ~180) + 3 khối `[data-region=…]`.
2. Build web xanh; screenshot dev server: nền sương, nút ngọc, dark mode đêm
   trúc, heading Lora / thân Be Vietnam Pro (page tạm — xóa sau khi chụp).
3. Kiểm chứng nhanh region: gắn `data-region="central"` vào page tạm → biến
   `--region-primary` đổi thành đỏ rượu (đọc qua getComputedStyle/screenshot).
4. `pnpm gate:int` xanh (luật #11). Không merge/push — chờ user review.

## Rủi ro & lưu ý

- `@import` package CSS trong Tailwind v4/Turbopack: đã dùng pattern tương tự
  cho `shadcn/tailwind.css` (package import) ngay trong globals.css hiện tại →
  rủi ro thấp; nếu resolver trục trặc, fallback import theo đường dẫn tương đối
  qua node_modules là KHÔNG chấp nhận — thay bằng export map đúng (đã có sẵn
  `"./tokens.css"` trong package.json tokens).
- Xóa khối neutral trong globals.css: phải rà var nào shadcn components dùng mà
  tokens.css THIẾU (đối chiếu từng key hai bên trước khi xóa — tokens.mjs có
  on-media/scrim/… THỪA thì không sao, THIẾU key (vd `--radius-4xl` mapping) là gãy).
- Font qua `next/font`: subset `latin` + `vietnamese`; tránh preload cả hai
  weight-range quá rộng (Lora 400–700, Be Vietnam Pro 400/500/600/700 là đủ).
