# ADR-0013 — Theme Wuling + region tint qua pipeline `@tourism/tokens` có sẵn

- **Trạng thái:** Accepted (2026-07-22)
- **Bối cảnh:** Nối tiếp [ADR-0011](0011-p3b-web-architecture.md) #4 (tokens-only,
  wire theme "giai đoạn sau") và [ADR-0012](0012-typeset-typography.md) (typeset
  đọc biến theme). Hệ màu mới đã chốt cùng user — phân tích đầy đủ tại
  [conventions/color-system.md](../conventions/color-system.md): brand "Wuling"
  + 3 region tint Bắc/Trung/Nam theo 3 operator Endfield (codename nội bộ).

## Bối cảnh

`libs/shared/tokens` KHÔNG phải stub như tưởng: P0 đã port nguyên kiến trúc
token của Nexora — **Style Dictionary 5 + culori**, nguồn
`style-dictionary/tokens.mjs` (màu light+dark · radius · type scale · shadow ·
z-index · density · semantic success/warning/info/rating/price · on-media/scrim)
→ build ra `generated/tokens.css` (@theme inline + :root + .dark) và
`generated/theme.js`; kèm `rn-convert` (oklch→hex, rem→dp) phục vụ mobile P5,
có test sẵn. Nhưng: (a) **giá trị màu vẫn là brand "Emerald Heritage" của
Nexora** — chưa phải brand v2 đã chốt; (b) `@tourism/ui` chưa import tokens.css
— `globals.css` đang dùng khối neutral mặc định của shadcn; (c) chưa có khái
niệm region; (d) font chưa wire (`--font-sans`/`--font-heading` là passthrough
chờ app đặt).

## Quyết định

1. **GIỮ nguyên pipeline có sẵn, chỉ thay giá trị + mở rộng.** Không dựng
   generator mới. Lý do: pipeline đã chạy, đã có test, và `rn-convert` là cầu
   sang mobile P5 — đập đi là thụt lùi so với Nexora (luật #10).
   - *Bỏ qua:* generator TS tự viết (mất rn-convert, thêm code phải nuôi);
     Tailwind `@theme` viết tay trong globals.css (web-only, mobile không ăn được).
2. **Giá trị brand → hệ Wuling đã chốt** (bảng tại color-system.md §3). Tác giả
   giá trị bằng **oklch** (quy đổi từ hex chốt bằng culori, làm tròn 3 chữ số)
   — giữ convention oklch sẵn có của file nguồn.
3. **Lớp region mới trong tokens.mjs**: 4 slot/vùng
   (`--region-primary/-deep/-surface/-spark` + `--region-on-surface`), emit:
   default trên `:root` = giá trị brand (trang không gắn vùng không đổi gì);
   override dưới `[data-region='north' | 'central' | 'south']`. **Tên tiếng Anh
   trong code**; codename nhân vật chỉ nằm trong docs. Dark mode dùng chung giá
   trị region (tint chủ yếu nằm ở hero/eyebrow — hoãn biến thể dark tới khi có
   trang vùng thật).
4. **Luật 90/10 cứng hóa bằng phạm vi biến**: component/`@tourism/ui` KHÔNG
   được tham chiếu `--region-*` — chỉ page-level của app (hero, eyebrow, chip
   vùng) được dùng. Ghi trong color-system.md; enforce bằng review.
5. **Wire vào UI**: `globals.css` của `@tourism/ui` `@import
   "@tourism/tokens/tokens.css"` và **xóa** khối `@theme inline`/`:root`/`.dark`
   neutral tự có (tokens.css đã emit đủ ba khối — hai nguồn song song là drift).
   `@tourism/ui` khai dependency `@tourism/tokens` (workspace); thứ tự build do
   turbo `^build` lo.
6. **Font chốt: Be Vietnam Pro (sans/body) + Lora (heading/serif)** — cả hai hỗ
   trợ tiếng Việt đầy đủ (địa danh trong copy tiếng Anh vẫn cần dấu), nạp qua
   `next/font/google` tại `apps/web` layout → biến `--font-sans`/`--font-heading`
   mà tokens/typeset/shadcn đã chờ sẵn. Thay cặp Geist+Fraunces của Nexora
   (không hỗ trợ tiếng Việt trọn vẹn) — phân loại: v2 tốt hơn.

## Đối chiếu Nexora (luật #10)

Hạ tầng token: **đã ngang bằng bằng cách giữ nguyên bản port P0** (type scale,
shadow, z-index, density compact, semantic colors, rn-convert). Khác biệt duy
nhất là giá trị brand (cố ý — rebrand) và lớp region (v2 tốt hơn — Nexora không
có). Font: đổi có chủ đích vì tiếng Việt.

## Hệ quả

- FE từ nay tokens-only thật sự (CLAUDE.md #6): mọi màu qua var, không hex
  trong component. Hex chỉ tồn tại ở docs (bản ghi) và tokens.mjs (dưới dạng oklch).
- `tokens()` stub trong `src/lib/tokens.ts` thay bằng export thật (type
  `Region`, danh sách region) cho FE dùng type-safe.
- Đổi brand sau này = sửa MỘT file tokens.mjs (+ docs sweep color-system.md).
- Trang vùng (P3b dựng trang) chỉ cần `data-region` trên container là ăn tint.
